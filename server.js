import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db, UPLOAD_DIR } from './db.js';
import { hashPassword, verifyPassword, todayStr, addDays, diffDays, isDate, distanceKm } from './util.js';
import { PROVINCES, PROVINCE_INFO } from './public/provinces.js';

const ROOT = import.meta.dirname;
const UP_CARS = path.join(UPLOAD_DIR, 'cars');
const UP_LIC = path.join(UPLOAD_DIR, 'licenses');
const IS_PROD = process.env.NODE_ENV === 'production';
fs.mkdirSync(UP_CARS, { recursive: true });
fs.mkdirSync(UP_LIC, { recursive: true });

const PORT = Number(process.env.PORT) || 3000;
const HOLD_MINUTES = 15; // เวลาที่ล็อกรถไว้ระหว่างรอชำระเงิน
const ACTIVE_STATUSES = ['awaiting_payment', 'pending', 'confirmed', 'active'];
const CAR_TYPES = ['eco', 'sedan', 'suv', 'pickup', 'van', 'ev'];

const app = express();
app.set('trust proxy', 1); // อยู่หลัง proxy ของ Render: ใช้ IP จริงของผู้ใช้และรู้ว่าเป็น HTTPS
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, msg) => { throw new HttpError(status, msg); };
const getRate = () => Number(db.prepare("SELECT value FROM settings WHERE key='commission_rate'").get()?.value ?? 10);

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  license_status: u.license_status, license_note: u.license_note, has_license: !!u.license_file,
  created_at: u.created_at,
});

function parseCredit(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
const carOut = (c) => ({ ...c, instant: !!c.instant, delivery: !!c.delivery, active: !!c.active, image_credit: parseCredit(c.image_credit) });

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const maxAge = 30 * 864e5;
  db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES (?,?,?)').run(token, userId, Date.now() + maxAge);
  res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge });
}

// แนบผู้ใช้จาก session cookie
app.use((req, res, next) => {
  const sid = parseCookies(req.headers.cookie).sid;
  if (sid) {
    req.user = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`).get(sid, Date.now());
  }
  next();
});

const auth = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'กรุณาเข้าสู่ระบบก่อน'));
  if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, 'คุณไม่มีสิทธิ์ทำรายการนี้'));
  next();
};

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const imageUpload = (dir) => multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + MIME_EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    MIME_EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'รองรับเฉพาะไฟล์รูป JPG, PNG หรือ WEBP')),
});
const uploadCar = imageUpload(UP_CARS);
const uploadLicense = imageUpload(UP_LIC);
const removeFile = (dir, name) => { if (name) fs.rm(path.join(dir, path.basename(name)), { force: true }, () => {}); };

function expireHolds() {
  db.prepare(`UPDATE bookings SET status='expired' WHERE status='awaiting_payment' AND created_at < ?`)
    .run(Date.now() - HOLD_MINUTES * 60000);
}

function isAvailable(carId, start, end, excludeId = 0) {
  expireHolds();
  const ph = ACTIVE_STATUSES.map(() => '?').join(',');
  const r = db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE car_id = ? AND id <> ? AND status IN (${ph})
    AND start_date < ? AND end_date > ?`).get(carId, excludeId, ...ACTIVE_STATUSES, end, start);
  return r.n === 0;
}

function computeQuote(car, b) {
  const rentType = b.rent_type === 'monthly' ? 'monthly' : 'daily';
  const start = b.start_date;
  if (!isDate(start)) fail(400, 'กรุณาเลือกวันรับรถ');
  if (start < todayStr()) fail(400, 'วันรับรถต้องไม่ย้อนหลัง');
  let end, days, units, unitPrice;
  if (rentType === 'daily') {
    end = b.end_date;
    if (!isDate(end)) fail(400, 'กรุณาเลือกวันคืนรถ');
    days = diffDays(start, end);
    if (days < 1) fail(400, 'วันคืนรถต้องหลังวันรับรถอย่างน้อย 1 วัน');
    if (days > 90) fail(400, 'เช่ารายวันได้สูงสุด 90 วัน หากเช่านานกว่านี้กรุณาเลือกแบบรายเดือน');
    units = days; unitPrice = car.daily_price;
  } else {
    if (!car.monthly_price) fail(400, 'รถคันนี้ไม่รองรับการเช่ารายเดือน');
    const m = parseInt(b.months, 10);
    if (!(m >= 1 && m <= 12)) fail(400, 'กรุณาเลือกจำนวน 1–12 เดือน');
    units = m; days = 30 * m; end = addDays(start, days); unitPrice = car.monthly_price;
  }
  const pickup = b.pickup_method === 'delivery' ? 'delivery' : 'self';
  if (pickup === 'delivery' && !car.delivery) fail(400, 'รถคันนี้ไม่มีบริการส่งรถ');
  const rental = units * unitPrice;
  const deliveryFee = pickup === 'delivery' ? car.delivery_fee : 0;
  const rate = getRate();
  const commission = Math.round((rental * rate) / 100);
  return {
    rent_type: rentType, start_date: start, end_date: end, days, units, unit_price: unitPrice,
    rental_price: rental, delivery_fee: deliveryFee, deposit: car.deposit, commission, commission_rate: rate,
    total: rental + deliveryFee + car.deposit, owner_payout: rental + deliveryFee - commission,
    pickup_method: pickup, available: isAvailable(car.id, start, end),
  };
}

const getCar = (id) => db.prepare(`SELECT c.*, u.name AS owner_name,
  (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.car_id = c.id) AS rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.car_id = c.id) AS review_count
  FROM cars c JOIN users u ON u.id = c.owner_id WHERE c.id = ?`).get(id);

function getBookingFor(req, id) {
  const b = db.prepare(`SELECT b.*, c.owner_id, c.brand, c.model, c.year, c.type, c.image, c.province, c.location, c.instant
    FROM bookings b JOIN cars c ON c.id = b.car_id WHERE b.id = ?`).get(id);
  if (!b) fail(404, 'ไม่พบการจองนี้');
  const u = req.user;
  if (u.role !== 'admin' && b.renter_id !== u.id && b.owner_id !== u.id) fail(403, 'คุณไม่มีสิทธิ์ดูการจองนี้');
  return b;
}

// ================= AUTH =================
app.post('/api/auth/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').replace(/[^\d+]/g, '');
  const password = String(req.body.password || '');
  const role = 'member'; // บัญชีเดียวทั้งเช่าและปล่อยเช่ารถได้
  if (name.length < 2) fail(400, 'กรุณากรอกชื่อ-นามสกุล');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'รูปแบบอีเมลไม่ถูกต้อง');
  if (!/^\+?\d{9,12}$/.test(phone)) fail(400, 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
  if (password.length < 6) fail(400, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'อีเมลนี้ถูกใช้สมัครแล้ว');
  const id = db.prepare(`INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES (?,?,?,?,?,?)`)
    .run(name, email, phone, hashPassword(password), role, Date.now()).lastInsertRowid;
  startSession(res, id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

// จำกัดการลองรหัสผ่าน: ผิดได้ 10 ครั้งต่อ 15 นาที ต่อ IP
const LOGIN_WINDOW = 15 * 60000, LOGIN_MAX = 10;
const loginFails = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of loginFails) if (now - v.start > LOGIN_WINDOW) loginFails.delete(k); }, LOGIN_WINDOW).unref();

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const rec = loginFails.get(ip);
  if (rec && Date.now() - rec.start < LOGIN_WINDOW && rec.count >= LOGIN_MAX) fail(429, 'ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาที');
  // เข้าสู่ระบบได้ทั้งอีเมลเต็ม หรือชื่อผู้ใช้ (ส่วนหน้า @ ของอีเมล) เช่น admin
  const login = String(req.body.email || '').trim().toLowerCase();
  let u;
  if (login.includes('@')) u = db.prepare('SELECT * FROM users WHERE email = ?').get(login);
  else if (login) {
    const rows = db.prepare("SELECT * FROM users WHERE substr(email, 1, instr(email, '@') - 1) = ?").all(login);
    if (rows.length === 1) u = rows[0];
  }
  if (!u || !verifyPassword(String(req.body.password || ''), u.password_hash)) {
    const r = loginFails.get(ip);
    if (!r || Date.now() - r.start > LOGIN_WINDOW) loginFails.set(ip, { start: Date.now(), count: 1 });
    else r.count++;
    fail(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  loginFails.delete(ip);
  startSession(res, u.id);
  res.json({ user: publicUser(u) });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = parseCookies(req.headers.cookie).sid;
  if (sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ user: publicUser(req.user) || null }));

app.put('/api/me', auth(), (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').replace(/[^\d+]/g, '');
  if (name.length < 2) fail(400, 'กรุณากรอกชื่อ-นามสกุล');
  if (!/^\+?\d{9,12}$/.test(phone)) fail(400, 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

app.post('/api/me/license', auth(), uploadLicense.single('license'), (req, res) => {
  if (!req.file) fail(400, 'กรุณาเลือกรูปใบขับขี่');
  removeFile(UP_LIC, req.user.license_file);
  db.prepare(`UPDATE users SET license_file = ?, license_status = 'pending', license_note = NULL WHERE id = ?`)
    .run(req.file.filename, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

// รูปใบขับขี่: ดูได้เฉพาะเจ้าของบัญชีและแอดมิน
app.get('/api/files/license/:userId', auth(), (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.role !== 'admin' && req.user.id !== id) fail(403, 'คุณไม่มีสิทธิ์ดูไฟล์นี้');
  const u = db.prepare('SELECT license_file FROM users WHERE id = ?').get(id);
  if (!u?.license_file) fail(404, 'ไม่พบไฟล์');
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(path.join(UP_LIC, path.basename(u.license_file)));
});

// ================= CARS (public) =================
app.get('/api/cars', (req, res) => {
  const q = req.query;
  const where = ['c.active = 1'];
  const params = [];
  if (q.province) { where.push('c.province = ?'); params.push(String(q.province)); }
  else if (q.region) {
    const list = PROVINCES.filter((p) => PROVINCE_INFO[p].region === String(q.region));
    if (list.length) { where.push(`c.province IN (${list.map(() => '?').join(',')})`); params.push(...list); }
  }
  if (q.type) { where.push('c.type = ?'); params.push(String(q.type)); }
  if (q.transmission) { where.push('c.transmission = ?'); params.push(String(q.transmission)); }
  if (q.seats) { where.push('c.seats >= ?'); params.push(Number(q.seats) || 0); }
  if (q.max_price) { where.push('c.daily_price <= ?'); params.push(Number(q.max_price) || 0); }
  if (q.instant === '1') where.push('c.instant = 1');
  if (q.delivery === '1') where.push('c.delivery = 1');
  if (q.monthly === '1') where.push('c.monthly_price > 0');
  if (q.q) {
    where.push("(c.brand || ' ' || c.model || ' ' || c.location) LIKE ?");
    params.push(`%${String(q.q).trim()}%`);
  }

  let rows = db.prepare(`SELECT c.*, u.name AS owner_name,
    (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.car_id = c.id) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.car_id = c.id) AS review_count
    FROM cars c JOIN users u ON u.id = c.owner_id WHERE ${where.join(' AND ')}`).all(...params);

  let start = isDate(q.start) ? q.start : null;
  let end = isDate(q.end) ? q.end : null;
  if (q.urgent === '1') {
    rows = rows.filter((c) => c.instant);
    if (!start) { start = todayStr(); end = addDays(start, 1); }
  }
  if (start && (!end || end <= start)) end = addDays(start, 1);
  if (start) rows = rows.filter((c) => isAvailable(c.id, start, end));

  const lat = Number(q.lat), lng = Number(q.lng);
  const hasGeo = q.lat && q.lng && Number.isFinite(lat) && Number.isFinite(lng);
  if (hasGeo) {
    const radius = Number(q.radius) || 50;
    rows = rows.filter((c) => c.lat != null && c.lng != null)
      .map((c) => ({ ...c, distance: Math.round(distanceKm(lat, lng, c.lat, c.lng) * 10) / 10 }))
      .filter((c) => c.distance <= radius);
  }

  const sort = q.sort || (hasGeo ? 'distance' : 'recommended');
  const sorters = {
    price_asc: (a, b) => a.daily_price - b.daily_price,
    price_desc: (a, b) => b.daily_price - a.daily_price,
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    distance: (a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9),
    newest: (a, b) => b.id - a.id,
    recommended: (a, b) => (b.instant - a.instant) || ((b.rating || 0) - (a.rating || 0)) || (b.id - a.id),
  };
  rows.sort(sorters[sort] || sorters.recommended);
  const limit = Math.min(Number(q.limit) || 100, 100);
  res.json({ cars: rows.slice(0, limit).map(carOut), start, end });
});

app.get('/api/cars/:id', (req, res) => {
  const c = getCar(Number(req.params.id));
  if (!c || (!c.active && c.owner_id !== req.user?.id && req.user?.role !== 'admin')) fail(404, 'ไม่พบรถคันนี้');
  expireHolds();
  const ph = ACTIVE_STATUSES.map(() => '?').join(',');
  const booked = db.prepare(`SELECT start_date, end_date FROM bookings WHERE car_id = ? AND status IN (${ph})
    AND end_date > ? ORDER BY start_date`).all(c.id, ...ACTIVE_STATUSES, todayStr());
  const reviews = db.prepare(`SELECT r.rating, r.comment, r.created_at, u.name FROM reviews r
    JOIN users u ON u.id = r.renter_id WHERE r.car_id = ? ORDER BY r.created_at DESC LIMIT 20`).all(c.id);
  res.json({ car: carOut(c), booked, reviews });
});

// จำนวนรถที่เปิดให้เช่าในแต่ละจังหวัด (ใช้ในตัวเลือกจังหวัด)
app.get('/api/provinces', (req, res) => {
  const rows = db.prepare('SELECT province, COUNT(*) AS n FROM cars WHERE active = 1 GROUP BY province').all();
  res.json({ counts: Object.fromEntries(rows.map((r) => [r.province, r.n])) });
});

app.get('/api/credits', (req, res) => {
  const rows = db.prepare(`SELECT id, brand, model, year, image_credit FROM cars
    WHERE active = 1 AND image_credit IS NOT NULL ORDER BY id`).all();
  res.json({ credits: rows.map((r) => ({ ...r, image_credit: parseCredit(r.image_credit) })) });
});

app.get('/api/cars/:id/quote', (req, res) => {
  const c = getCar(Number(req.params.id));
  if (!c || !c.active) fail(404, 'ไม่พบรถคันนี้');
  res.json({ quote: computeQuote(c, req.query) });
});

// ================= BOOKINGS (renter) =================
app.post('/api/bookings', auth('member'), (req, res) => {
  const c = getCar(Number(req.body.car_id));
  if (!c || !c.active) fail(404, 'ไม่พบรถคันนี้');
  if (c.owner_id === req.user.id) fail(400, 'ไม่สามารถจองรถของตัวเองได้');
  if (req.user.license_status !== 'approved')
    fail(403, 'ต้องอัปโหลดใบขับขี่และได้รับการยืนยันจากระบบก่อนจองรถ');
  const qt = computeQuote(c, req.body);
  if (!qt.available) fail(409, 'ขออภัย รถคันนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว');
  const place = String(req.body.delivery_place || '').trim();
  if (qt.pickup_method === 'delivery' && place.length < 3) fail(400, 'กรุณาระบุสถานที่ให้ส่งรถ');

  const id = db.prepare(`INSERT INTO bookings(car_id,renter_id,rent_type,start_date,end_date,days,units,unit_price,rental_price,
    delivery_fee,deposit,commission,commission_rate,total,owner_payout,pickup_method,delivery_place,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'awaiting_payment',?)`).run(
    c.id, req.user.id, qt.rent_type, qt.start_date, qt.end_date, qt.days, qt.units, qt.unit_price, qt.rental_price,
    qt.delivery_fee, qt.deposit, qt.commission, qt.commission_rate, qt.total, qt.owner_payout, qt.pickup_method,
    qt.pickup_method === 'delivery' ? place : null, Date.now()).lastInsertRowid;
  res.json({ id: Number(id) });
});

app.get('/api/bookings/my', auth(), (req, res) => {
  expireHolds();
  const rows = db.prepare(`SELECT b.*, c.brand, c.model, c.year, c.type, c.image, c.province, c.location,
      u.name AS owner_name, u.phone AS owner_phone,
      EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed
    FROM bookings b JOIN cars c ON c.id = b.car_id JOIN users u ON u.id = c.owner_id
    WHERE b.renter_id = ? ORDER BY b.created_at DESC`).all(req.user.id);
  // เปิดเผยเบอร์เจ้าของรถเมื่อการจองยืนยันแล้วเท่านั้น
  for (const r of rows) if (!['confirmed', 'active', 'completed'].includes(r.status)) r.owner_phone = null;
  res.json({ bookings: rows.map((r) => ({ ...r, reviewed: !!r.reviewed, expires_at: r.created_at + HOLD_MINUTES * 60000 })) });
});

app.get('/api/bookings/:id', auth(), (req, res) => {
  expireHolds();
  const b = getBookingFor(req, Number(req.params.id));
  res.json({ booking: { ...b, expires_at: b.created_at + HOLD_MINUTES * 60000 } });
});

// ชำระเงิน (โหมดสาธิต — จำลองการชำระผ่านระบบกลาง)
app.post('/api/bookings/:id/pay', auth(), (req, res) => {
  expireHolds();
  const b = getBookingFor(req, Number(req.params.id));
  if (b.renter_id !== req.user.id) fail(403, 'คุณไม่มีสิทธิ์ชำระการจองนี้');
  if (b.status === 'expired') fail(410, 'หมดเวลาชำระเงินแล้ว กรุณาจองใหม่');
  if (b.status !== 'awaiting_payment') fail(400, 'การจองนี้ชำระเงินแล้วหรือไม่อยู่ในสถานะรอชำระ');
  const method = ['promptpay', 'card'].includes(req.body.method) ? req.body.method : fail(400, 'กรุณาเลือกวิธีชำระเงิน');
  const status = b.instant ? 'confirmed' : 'pending';
  db.prepare(`UPDATE bookings SET status = ?, payment_status = 'paid', payment_method = ?, paid_at = ?, deposit_status = 'held'
    WHERE id = ?`).run(status, method, Date.now(), b.id);
  res.json({ ok: true, status });
});

app.post('/api/bookings/:id/cancel', auth(), (req, res) => {
  expireHolds();
  const b = getBookingFor(req, Number(req.params.id));
  if (b.renter_id !== req.user.id) fail(403, 'คุณไม่มีสิทธิ์ยกเลิกการจองนี้');
  if (!['awaiting_payment', 'pending', 'confirmed'].includes(b.status)) fail(400, 'ไม่สามารถยกเลิกการจองในสถานะนี้ได้');
  if (b.status === 'confirmed' && b.start_date <= todayStr()) fail(400, 'ยกเลิกได้ก่อนวันรับรถเท่านั้น กรุณาติดต่อเจ้าของรถ');
  const paid = b.payment_status === 'paid';
  db.prepare(`UPDATE bookings SET status = 'cancelled', payment_status = ?, deposit_status = ? WHERE id = ?`)
    .run(paid ? 'refunded' : 'unpaid', paid ? 'refunded' : 'none', b.id);
  res.json({ ok: true, refunded: paid });
});

app.post('/api/bookings/:id/review', auth(), (req, res) => {
  const b = getBookingFor(req, Number(req.params.id));
  if (b.renter_id !== req.user.id) fail(403, 'คุณไม่มีสิทธิ์รีวิวการจองนี้');
  if (b.status !== 'completed') fail(400, 'รีวิวได้หลังคืนรถเรียบร้อยแล้ว');
  if (db.prepare('SELECT 1 FROM reviews WHERE booking_id = ?').get(b.id)) fail(409, 'คุณรีวิวการจองนี้แล้ว');
  const rating = parseInt(req.body.rating, 10);
  if (!(rating >= 1 && rating <= 5)) fail(400, 'กรุณาให้คะแนน 1–5 ดาว');
  db.prepare('INSERT INTO reviews(booking_id,car_id,renter_id,rating,comment,created_at) VALUES (?,?,?,?,?,?)')
    .run(b.id, b.car_id, req.user.id, rating, String(req.body.comment || '').trim().slice(0, 1000), Date.now());
  res.json({ ok: true });
});

// ================= OWNER =================
function parseCarBody(b) {
  const s = (v) => String(v ?? '').trim();
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  const bool = (v) => (v === '1' || v === 'true' || v === true || v === 'on' ? 1 : 0);
  const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const car = {
    brand: s(b.brand), model: s(b.model), year: n(b.year), type: s(b.type), seats: n(b.seats) || 5,
    transmission: b.transmission === 'manual' ? 'manual' : 'auto',
    fuel: ['gasoline', 'diesel', 'hybrid', 'ev'].includes(b.fuel) ? b.fuel : 'gasoline',
    province: s(b.province), location: s(b.location), lat: num(b.lat), lng: num(b.lng),
    daily_price: n(b.daily_price), monthly_price: n(b.monthly_price), deposit: n(b.deposit),
    instant: bool(b.instant), delivery: bool(b.delivery), delivery_fee: n(b.delivery_fee),
    description: s(b.description).slice(0, 2000),
  };
  if (!car.brand || !car.model) fail(400, 'กรุณากรอกยี่ห้อและรุ่นรถ');
  if (!CAR_TYPES.includes(car.type)) fail(400, 'กรุณาเลือกประเภทรถ');
  if (!PROVINCES.includes(car.province)) fail(400, 'กรุณาเลือกจังหวัด');
  if (!car.location) fail(400, 'กรุณาระบุจุดรับรถ');
  if (car.daily_price < 100) fail(400, 'ราคาเช่ารายวันต้องไม่ต่ำกว่า 100 บาท');
  if (car.seats < 1 || car.seats > 15) fail(400, 'จำนวนที่นั่งไม่ถูกต้อง');
  if ((car.lat == null) !== (car.lng == null)) fail(400, 'พิกัดต้องมีทั้งละติจูดและลองจิจูด');
  if (!car.delivery) car.delivery_fee = 0;
  return car;
}

app.get('/api/owner/cars', auth('member'), (req, res) => {
  const rows = db.prepare(`SELECT c.*,
    (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.car_id = c.id) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.car_id = c.id) AS review_count,
    (SELECT COUNT(*) FROM bookings b WHERE b.car_id = c.id AND b.status IN ('confirmed','active','completed')) AS trips
    FROM cars c WHERE c.owner_id = ? ORDER BY c.id DESC`).all(req.user.id);
  res.json({ cars: rows.map(carOut) });
});

app.post('/api/owner/cars', auth('member'), uploadCar.single('image'), (req, res) => {
  try {
    const car = parseCarBody(req.body);
    const cols = Object.keys(car);
    const id = db.prepare(`INSERT INTO cars(owner_id,${cols.join(',')},image,created_at)
      VALUES (?,${cols.map(() => '?').join(',')},?,?)`)
      .run(req.user.id, ...Object.values(car), req.file?.filename ?? null, Date.now()).lastInsertRowid;
    res.json({ id: Number(id) });
  } catch (e) {
    removeFile(UP_CARS, req.file?.filename);
    throw e;
  }
});

app.put('/api/owner/cars/:id', auth('member'), uploadCar.single('image'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM cars WHERE id = ? AND owner_id = ?').get(Number(req.params.id), req.user.id);
    if (!existing) fail(404, 'ไม่พบรถคันนี้');
    const car = parseCarBody(req.body);
    if (req.file) car.image = req.file.filename;
    else if (req.body.remove_image === '1') car.image = null;
    if ('image' in car) car.image_credit = null; // รูปใหม่ของเจ้าของรถ ไม่ต้องมีเครดิตภายนอก
    const cols = Object.keys(car);
    db.prepare(`UPDATE cars SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(car), existing.id);
    if ('image' in car && existing.image) removeFile(UP_CARS, existing.image);
    res.json({ ok: true });
  } catch (e) {
    removeFile(UP_CARS, req.file?.filename);
    throw e;
  }
});

app.post('/api/owner/cars/:id/toggle', auth('member'), (req, res) => {
  const c = db.prepare('SELECT * FROM cars WHERE id = ? AND owner_id = ?').get(Number(req.params.id), req.user.id);
  if (!c) fail(404, 'ไม่พบรถคันนี้');
  db.prepare('UPDATE cars SET active = ? WHERE id = ?').run(c.active ? 0 : 1, c.id);
  res.json({ active: !c.active });
});

app.get('/api/owner/bookings', auth('member'), (req, res) => {
  expireHolds();
  const rows = db.prepare(`SELECT b.*, c.brand, c.model, c.image, c.type, c.location,
      u.name AS renter_name, u.phone AS renter_phone
    FROM bookings b JOIN cars c ON c.id = b.car_id JOIN users u ON u.id = b.renter_id
    WHERE c.owner_id = ? AND b.status NOT IN ('awaiting_payment','expired')
    ORDER BY CASE b.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'active' THEN 2 ELSE 3 END, b.start_date`)
    .all(req.user.id);
  for (const r of rows) if (['cancelled', 'rejected'].includes(r.status)) r.renter_phone = null;
  res.json({ bookings: rows });
});

app.get('/api/owner/summary', auth('member'), (req, res) => {
  const id = req.user.id;
  const one = (sql) => db.prepare(sql).get(id);
  res.json({
    cars: one('SELECT COUNT(*) AS n FROM cars WHERE owner_id = ?').n,
    active_cars: one('SELECT COUNT(*) AS n FROM cars WHERE owner_id = ? AND active = 1').n,
    pending: one(`SELECT COUNT(*) AS n FROM bookings b JOIN cars c ON c.id=b.car_id WHERE c.owner_id = ? AND b.status='pending'`).n,
    upcoming: one(`SELECT COUNT(*) AS n FROM bookings b JOIN cars c ON c.id=b.car_id WHERE c.owner_id = ? AND b.status IN ('confirmed','active')`).n,
    earned: one(`SELECT COALESCE(SUM(owner_payout + deposit_deducted),0) AS n FROM bookings b JOIN cars c ON c.id=b.car_id
      WHERE c.owner_id = ? AND b.status='completed'`).n,
    expected: one(`SELECT COALESCE(SUM(owner_payout),0) AS n FROM bookings b JOIN cars c ON c.id=b.car_id
      WHERE c.owner_id = ? AND b.status IN ('confirmed','active')`).n,
    commission_rate: getRate(),
  });
});

function ownerBooking(req) {
  const b = getBookingFor(req, Number(req.params.id));
  if (b.owner_id !== req.user.id) fail(403, 'คุณไม่ใช่เจ้าของรถคันนี้');
  return b;
}

app.post('/api/owner/bookings/:id/:action', auth('member'), (req, res) => {
  const b = ownerBooking(req);
  const set = (sql, ...p) => db.prepare(`UPDATE bookings SET ${sql} WHERE id = ?`).run(...p, b.id);
  switch (req.params.action) {
    case 'approve':
      if (b.status !== 'pending') fail(400, 'อนุมัติได้เฉพาะการจองที่รอยืนยัน');
      set("status = 'confirmed'");
      break;
    case 'reject':
      if (b.status !== 'pending') fail(400, 'ปฏิเสธได้เฉพาะการจองที่รอยืนยัน');
      set("status = 'rejected', payment_status = 'refunded', deposit_status = 'refunded'");
      break;
    case 'handover':
      if (b.status !== 'confirmed') fail(400, 'ส่งมอบรถได้เฉพาะการจองที่ยืนยันแล้ว');
      set("status = 'active'");
      break;
    case 'return': {
      if (b.status !== 'active') fail(400, 'รับรถคืนได้เฉพาะการจองที่กำลังเช่าอยู่');
      const deduct = Math.max(0, Math.round(Number(req.body.deduct) || 0));
      if (deduct > b.deposit) fail(400, 'จำนวนที่หักต้องไม่เกินเงินมัดจำ');
      const note = String(req.body.note || '').trim().slice(0, 1000);
      if (deduct > 0 && note.length < 3) fail(400, 'กรุณาระบุเหตุผลในการหักเงินมัดจำ');
      set("status = 'completed', deposit_status = ?, deposit_deducted = ?, return_note = ?",
        deduct > 0 ? 'deducted' : 'refunded', deduct, note || null);
      break;
    }
    default:
      fail(404, 'ไม่รู้จักคำสั่งนี้');
  }
  res.json({ ok: true });
});

// ================= ADMIN =================
app.get('/api/admin/stats', auth('admin'), (req, res) => {
  const n = (sql) => db.prepare(sql).get().n;
  res.json({
    users: n('SELECT COUNT(*) AS n FROM users'),
    members: n("SELECT COUNT(*) AS n FROM users WHERE role='member'"),
    owners: n('SELECT COUNT(DISTINCT owner_id) AS n FROM cars'),
    renters: n('SELECT COUNT(DISTINCT renter_id) AS n FROM bookings'),
    cars: n('SELECT COUNT(*) AS n FROM cars WHERE active = 1'),
    pending_licenses: n("SELECT COUNT(*) AS n FROM users WHERE license_status='pending'"),
    bookings: n("SELECT COUNT(*) AS n FROM bookings WHERE status IN ('confirmed','active','completed')"),
    gmv: n("SELECT COALESCE(SUM(rental_price + delivery_fee),0) AS n FROM bookings WHERE status IN ('confirmed','active','completed')"),
    commission: n("SELECT COALESCE(SUM(commission),0) AS n FROM bookings WHERE status IN ('confirmed','active','completed')"),
    deposits_held: n("SELECT COALESCE(SUM(deposit),0) AS n FROM bookings WHERE deposit_status='held'"),
    commission_rate: getRate(),
  });
});

app.get('/api/admin/users', auth('admin'), (req, res) => {
  const where = [], params = [];
  if (req.query.license) { where.push('license_status = ?'); params.push(String(req.query.license)); }
  if (req.query.role) { where.push('role = ?'); params.push(String(req.query.role)); }
  const rows = db.prepare(`SELECT * FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE license_status WHEN 'pending' THEN 0 ELSE 1 END, id DESC`).all(...params);
  res.json({ users: rows.map(publicUser) });
});

app.post('/api/admin/users/:id/license', auth('admin'), (req, res) => {
  const status = req.body.status;
  if (!['approved', 'rejected'].includes(status)) fail(400, 'สถานะไม่ถูกต้อง');
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) fail(404, 'ไม่พบผู้ใช้');
  if (!u.license_file) fail(400, 'ผู้ใช้นี้ยังไม่ได้อัปโหลดใบขับขี่');
  const note = String(req.body.note || '').trim().slice(0, 500) || null;
  if (status === 'rejected' && !note) fail(400, 'กรุณาระบุเหตุผลที่ไม่ผ่าน');
  db.prepare('UPDATE users SET license_status = ?, license_note = ? WHERE id = ?').run(status, note, u.id);
  res.json({ ok: true });
});

app.get('/api/admin/bookings', auth('admin'), (req, res) => {
  expireHolds();
  const rows = db.prepare(`SELECT b.*, c.brand, c.model, c.province, o.name AS owner_name, r.name AS renter_name
    FROM bookings b JOIN cars c ON c.id = b.car_id JOIN users o ON o.id = c.owner_id JOIN users r ON r.id = b.renter_id
    ORDER BY b.created_at DESC LIMIT 300`).all();
  res.json({ bookings: rows });
});

app.put('/api/admin/settings', auth('admin'), (req, res) => {
  const rate = Number(req.body.commission_rate);
  if (!(rate >= 0 && rate <= 50)) fail(400, 'ค่าคอมมิชชันต้องอยู่ระหว่าง 0–50%');
  db.prepare("UPDATE settings SET value = ? WHERE key = 'commission_rate'").run(String(rate));
  res.json({ commission_rate: rate });
});

// ================= STATIC & ERRORS =================
app.use('/uploads/cars', express.static(UP_CARS, { maxAge: '7d' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API นี้' }));

app.use((err, req, res, next) => {
  void next;
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError)
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ต้องมีขนาดไม่เกิน 5MB' : 'อัปโหลดไฟล์ไม่สำเร็จ' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' });
});

app.listen(PORT, () => {
  console.log(`\n  🚗 RodPrompt พร้อมใช้งานที่  http://localhost:${PORT}\n`);
});
