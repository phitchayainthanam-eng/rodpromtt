import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, verifyPassword, todayStr, addDays } from './util.js';

// บน Render ตั้ง DATA_DIR / UPLOAD_DIR ให้ชี้ไปที่ persistent disk ได้
const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dirname, 'data');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(import.meta.dirname, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'rentcar.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// สมาชิก (member) บัญชีเดียวทั้งเช่ารถและปล่อยเช่ารถได้ ; admin แยกต่างหาก
const usersTable = (name) => `CREATE TABLE IF NOT EXISTS ${name} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  license_file TEXT,
  license_status TEXT NOT NULL DEFAULT 'none' CHECK (license_status IN ('none','pending','approved','rejected')),
  license_note TEXT,
  created_at INTEGER NOT NULL
);`;

db.exec(`
${usersTable('users')}
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  type TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 5,
  transmission TEXT NOT NULL DEFAULT 'auto',
  fuel TEXT NOT NULL DEFAULT 'gasoline',
  province TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  daily_price INTEGER NOT NULL,
  monthly_price INTEGER NOT NULL DEFAULT 0,
  deposit INTEGER NOT NULL DEFAULT 0,
  instant INTEGER NOT NULL DEFAULT 1,
  delivery INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL REFERENCES cars(id),
  renter_id INTEGER NOT NULL REFERENCES users(id),
  rent_type TEXT NOT NULL CHECK (rent_type IN ('daily','monthly')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  units INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  rental_price INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  deposit INTEGER NOT NULL DEFAULT 0,
  commission INTEGER NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  owner_payout INTEGER NOT NULL,
  pickup_method TEXT NOT NULL DEFAULT 'self',
  delivery_place TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  paid_at INTEGER,
  deposit_status TEXT NOT NULL DEFAULT 'none',
  deposit_deducted INTEGER NOT NULL DEFAULT 0,
  return_note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_car ON bookings(car_id, status, start_date, end_date);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
  car_id INTEGER NOT NULL REFERENCES cars(id),
  renter_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings(key, value) VALUES ('commission_rate', '10');
`);

// ---------- migration: รวมบทบาท renter/owner เป็น member (สร้างตาราง users ใหม่ตามขั้นตอนของ SQLite) ----------
const usersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get().sql;
if (usersSql.includes("'renter'")) {
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec(`BEGIN;
      ${usersTable('users_new')}
      INSERT INTO users_new (id,name,email,phone,password_hash,role,license_file,license_status,license_note,created_at)
        SELECT id,name,email,phone,password_hash, CASE WHEN role = 'admin' THEN 'admin' ELSE 'member' END,
               license_file,license_status,license_note,created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      UPDATE users SET license_status = 'approved' WHERE email = 'owner1@example.com' AND license_status = 'none';
      COMMIT;`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

// ---------- migration: เครดิตรูปรถ ----------
if (!db.prepare('PRAGMA table_info(cars)').all().some((c) => c.name === 'image_credit')) {
  db.exec('ALTER TABLE cars ADD COLUMN image_credit TEXT');
}

// ---------- บัญชีทดลอง: ชื่อผู้ใช้สั้นๆ รหัสผ่านเดียวกันหมด ----------
const DEMO_PASSWORD = '123456';
// ฐานข้อมูลเดิม: เปลี่ยนอีเมลทดลองชุดเก่าเป็นชุดใหม่ และตั้งรหัสผ่านเป็น 123456
const DEMO_RENAME = {
  'admin@example.com': 'admin@test.com', 'owner1@example.com': 'host@test.com',
  'owner2@example.com': 'host2@test.com', 'owner3@example.com': 'host3@test.com',
  'renter@example.com': 'user@test.com', 'renter2@example.com': 'user2@test.com',
};
for (const [oldEmail, newEmail] of Object.entries(DEMO_RENAME)) {
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?');
  if (exists.get(oldEmail) && !exists.get(newEmail)) {
    db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE email = ?').run(newEmail, hashPassword(DEMO_PASSWORD), oldEmail);
  }
}

// ---------- ข้อมูลตัวอย่าง (ใส่ครั้งแรกเท่านั้น) ----------
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
  const now = Date.now();
  const addUser = db.prepare(`INSERT INTO users(name,email,phone,password_hash,role,license_status,created_at)
    VALUES (?,?,?,?,?,?,?)`);
  const admin = addUser.run('ผู้ดูแลระบบ', 'admin@test.com', '020000000', hashPassword(DEMO_PASSWORD), 'admin', 'none', now).lastInsertRowid;
  const o1 = addUser.run('สมชาย ใจดี', 'host@test.com', '0811111111', hashPassword(DEMO_PASSWORD), 'member', 'approved', now).lastInsertRowid;
  const o2 = addUser.run('มาลี ทะเลงาม', 'host2@test.com', '0822222222', hashPassword(DEMO_PASSWORD), 'member', 'none', now).lastInsertRowid;
  const o3 = addUser.run('ประเสริฐ อีสานรุ่ง', 'host3@test.com', '0833333333', hashPassword(DEMO_PASSWORD), 'member', 'none', now).lastInsertRowid;
  const r1 = addUser.run('นภา เดินทาง', 'user@test.com', '0899999999', hashPassword(DEMO_PASSWORD), 'member', 'approved', now).lastInsertRowid;
  addUser.run('ธนา ยังไม่ยืนยัน', 'user2@test.com', '0888888888', hashPassword(DEMO_PASSWORD), 'member', 'none', now);
  void admin;

  const addCar = db.prepare(`INSERT INTO cars(owner_id,brand,model,year,type,seats,transmission,fuel,province,location,lat,lng,
    daily_price,monthly_price,deposit,instant,delivery,delivery_fee,description,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const cars = [
    [o1, 'Toyota', 'Yaris Ativ', 2022, 'eco', 5, 'auto', 'gasoline', 'เชียงใหม่', 'สนามบินเชียงใหม่', 18.7668, 98.9626, 900, 18000, 3000, 1, 1, 200, 'รถสะอาด ประหยัดน้ำมัน เหมาะเที่ยวในเมือง มีที่ชาร์จมือถือ'],
    [o1, 'Toyota', 'Fortuner', 2021, 'suv', 7, 'auto', 'diesel', 'เชียงใหม่', 'นิมมานเหมินท์', 18.7964, 98.9679, 2200, 45000, 5000, 1, 1, 300, 'SUV 7 ที่นั่ง ขึ้นดอยสบาย เหมาะกับครอบครัว'],
    [o1, 'Honda', 'City', 2023, 'sedan', 5, 'auto', 'gasoline', 'เชียงราย', 'ตัวเมืองเชียงราย (หอนาฬิกา)', 19.9105, 99.8406, 1000, 20000, 3000, 0, 0, 0, 'รถใหม่ ไมล์น้อย เจ้าของยืนยันการจองภายใน 1 ชม.'],
    [o1, 'Ford', 'Ranger Raptor', 2023, 'pickup', 5, 'auto', 'diesel', 'แม่ฮ่องสอน', 'ปาย', 19.3583, 98.4405, 2800, 0, 8000, 1, 0, 0, 'สายลุย ทางโค้งปาย-แม่ฮ่องสอน ไม่มีปัญหา'],
    [o2, 'Toyota', 'Commuter', 2019, 'van', 12, 'auto', 'diesel', 'ภูเก็ต', 'สนามบินภูเก็ต', 8.1132, 98.3169, 2500, 0, 5000, 1, 1, 400, 'รถตู้ 12 ที่นั่ง สำหรับกรุ๊ปทัวร์ (ไม่รวมคนขับ)'],
    [o2, 'Honda', 'Jazz', 2020, 'eco', 5, 'auto', 'gasoline', 'ภูเก็ต', 'หาดป่าตอง', 7.8961, 98.2965, 950, 19000, 3000, 1, 1, 300, 'คล่องตัว หาที่จอดง่ายในป่าตอง'],
    [o2, 'Mitsubishi', 'Xpander', 2022, 'suv', 7, 'auto', 'gasoline', 'กระบี่', 'อ่าวนาง', 8.0363, 98.819, 1500, 32000, 4000, 0, 1, 300, 'นั่งได้ 7 คน ห้องโดยสารกว้าง'],
    [o3, 'BYD', 'Atto 3', 2024, 'ev', 5, 'auto', 'ev', 'ขอนแก่น', 'มหาวิทยาลัยขอนแก่น', 16.4746, 102.8236, 1400, 30000, 5000, 1, 0, 0, 'รถไฟฟ้า ชาร์จเต็มก่อนส่งมอบ วิ่งได้ ~400 กม.'],
    [o3, 'Nissan', 'Almera', 2021, 'eco', 5, 'auto', 'gasoline', 'กรุงเทพมหานคร', 'BTS อ่อนนุช', 13.7057, 100.6011, 800, 16000, 2000, 1, 1, 150, 'ราคาประหยัด เหมาะใช้งานรายเดือน'],
    [o3, 'Toyota', 'Camry', 2022, 'sedan', 5, 'auto', 'hybrid', 'กรุงเทพมหานคร', 'สนามบินสุวรรณภูมิ', 13.69, 100.7501, 2000, 42000, 5000, 0, 1, 300, 'ซีดานหรู Hybrid เหมาะงานธุรกิจ'],
    [o3, 'Mazda', '2', 2021, 'eco', 5, 'auto', 'gasoline', 'อุดรธานี', 'สนามบินอุดรธานี', 17.3864, 102.7883, 850, 17000, 2000, 1, 1, 200, 'รับรถที่สนามบินได้ทันทีหลังเครื่องลง'],
    [o3, 'Isuzu', 'D-Max', 2020, 'pickup', 4, 'manual', 'diesel', 'น่าน', 'ตัวเมืองน่าน', 18.7756, 100.773, 1100, 22000, 3000, 1, 0, 0, 'กระบะ 4 ประตู ขึ้นดอยเสมอดาวสบาย'],
  ];
  for (const c of cars) addCar.run(...c, now);

  // ตัวอย่างการเช่าที่เสร็จสิ้นแล้ว + รีวิว
  const s = addDays(todayStr(), -20), e = addDays(todayStr(), -17);
  const b = db.prepare(`INSERT INTO bookings(car_id,renter_id,rent_type,start_date,end_date,days,units,unit_price,rental_price,
    delivery_fee,deposit,commission,commission_rate,total,owner_payout,pickup_method,status,payment_status,payment_method,paid_at,deposit_status,created_at)
    VALUES (1,?,'daily',?,?,3,3,900,2700,0,3000,270,10,5700,2430,'self','completed','paid','promptpay',?,'refunded',?)`)
    .run(r1, s, e, now, now).lastInsertRowid;
  db.prepare(`INSERT INTO reviews(booking_id,car_id,renter_id,rating,comment,created_at) VALUES (?,1,?,5,?,?)`)
    .run(b, r1, 'รถสะอาดมาก เจ้าของมาส่งที่สนามบินตรงเวลา แนะนำเลยครับ', now);
}

// ---------- รูปรถตัวอย่าง (Wikimedia Commons) ใส่ครั้งเดียว ----------
// รูปและเครดิตอยู่ใน seed-images/ ; คัดลอกไป uploads/cars แล้วผูกกับรถตัวอย่างคันที่ยังไม่มีรูป
const SEED_DIR = path.join(import.meta.dirname, 'seed-images');
const seedFlag = db.prepare("SELECT value FROM settings WHERE key = 'seed_photos_v1'").get();
if (!seedFlag && fs.existsSync(path.join(SEED_DIR, 'credits.json'))) {
  const credits = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'credits.json'), 'utf8'));
  const upDir = path.join(UPLOAD_DIR, 'cars');
  fs.mkdirSync(upDir, { recursive: true });
  const setImg = db.prepare('UPDATE cars SET image = ?, image_credit = ? WHERE id = ? AND image IS NULL');
  for (const [id, c] of Object.entries(credits)) {
    const src = path.join(SEED_DIR, path.basename(c.file));
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(upDir, path.basename(c.file)));
    const { file, ...credit } = c;
    void file;
    setImg.run(path.basename(c.file), JSON.stringify(credit), Number(id));
  }
  db.prepare("INSERT OR REPLACE INTO settings(key, value) VALUES ('seed_photos_v1', '1')").run();
}

// ---------- รหัสผ่านแอดมินจาก environment variable (ใช้บนเว็บจริง) ----------
// ตั้ง ADMIN_PASSWORD บน Render แล้วรหัสแอดมินจะเป็นค่านั้นทุกครั้งที่เซิร์ฟเวอร์เริ่ม
if (process.env.ADMIN_PASSWORD) {
  const admin = db.prepare("SELECT id, password_hash FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
  if (admin && !verifyPassword(process.env.ADMIN_PASSWORD, admin.password_hash)) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(process.env.ADMIN_PASSWORD), admin.id);
  }
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[security] ADMIN_PASSWORD is not set: the admin account still uses the demo password');
}
