// ภาษาไทย / English — เก็บค่าที่เลือกไว้ในเบราว์เซอร์ (ไม่บังคับ ถ้าเก็บไม่ได้ก็ใช้ภาษาไทย)
const KEY = 'rodprompt-lang';
let lang = 'th';
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'th' || saved === 'en') lang = saved;
} catch { /* storage blocked */ }
// ?lang=en หรือ ?lang=th ในลิงก์ มีผลเหนือค่าที่บันทึกไว้ (ใช้แชร์ลิงก์ภาษาอังกฤษได้)
const fromUrl = new URLSearchParams(location.search).get('lang');
if (fromUrl === 'th' || fromUrl === 'en') lang = fromUrl;
document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'th';
  document.documentElement.lang = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* storage blocked */ }
}
/** เลือกข้อความตามภาษา: L('ไทย', 'English') */
export const L = (th, en) => (lang === 'en' ? en : th);
export const locale = () => (lang === 'en' ? 'en-GB' : 'th-TH');

// ข้อความ error จากเซิร์ฟเวอร์ (ภาษาไทย) -> ภาษาอังกฤษ
const ERR_EN = {
  'กรุณากรอกชื่อ-นามสกุล': 'Please enter your full name',
  'กรุณากรอกยี่ห้อและรุ่นรถ': 'Please enter the make and model',
  'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง': 'Please enter a valid phone number',
  'กรุณาระบุจุดรับรถ': 'Please enter a pickup point',
  'กรุณาระบุสถานที่ให้ส่งรถ': 'Please enter the delivery address',
  'กรุณาระบุเหตุผลที่ไม่ผ่าน': 'Please give a reason for rejecting',
  'กรุณาระบุเหตุผลในการหักเงินมัดจำ': 'Please give a reason for the deposit deduction',
  'กรุณาเข้าสู่ระบบก่อน': 'Please sign in first',
  'กรุณาเลือกจังหวัด': 'Please choose a province',
  'กรุณาเลือกจำนวน 1–12 เดือน': 'Please choose 1 to 12 months',
  'กรุณาเลือกประเภทรถ': 'Please choose a car type',
  'กรุณาเลือกรูปใบขับขี่': 'Please choose a photo of your driving licence',
  'กรุณาเลือกวันคืนรถ': 'Please choose a return date',
  'กรุณาเลือกวันรับรถ': 'Please choose a pickup date',
  'กรุณาเลือกวิธีชำระเงิน': 'Please choose a payment method',
  'กรุณาให้คะแนน 1–5 ดาว': 'Please give a rating from 1 to 5 stars',
  'การจองนี้ชำระเงินแล้วหรือไม่อยู่ในสถานะรอชำระ': 'This booking is already paid or no longer awaiting payment',
  'ขออภัย รถคันนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว': 'Sorry, this car is already booked for those dates',
  'ข้อมูลไม่ถูกต้อง': 'Invalid data',
  'คุณรีวิวการจองนี้แล้ว': 'You have already reviewed this booking',
  'คุณไม่มีสิทธิ์ชำระการจองนี้': 'You cannot pay for this booking',
  'คุณไม่มีสิทธิ์ดูการจองนี้': 'You cannot view this booking',
  'คุณไม่มีสิทธิ์ดูไฟล์นี้': 'You cannot view this file',
  'คุณไม่มีสิทธิ์ทำรายการนี้': 'You are not allowed to do this',
  'คุณไม่มีสิทธิ์ยกเลิกการจองนี้': 'You cannot cancel this booking',
  'คุณไม่มีสิทธิ์รีวิวการจองนี้': 'You cannot review this booking',
  'คุณไม่ใช่เจ้าของรถคันนี้': 'You are not the owner of this car',
  'ค่าคอมมิชชันต้องอยู่ระหว่าง 0–50%': 'Commission must be between 0 and 50%',
  'จำนวนที่นั่งไม่ถูกต้อง': 'Invalid number of seats',
  'จำนวนที่หักต้องไม่เกินเงินมัดจำ': 'The deduction cannot exceed the deposit',
  'ต้องอัปโหลดใบขับขี่และได้รับการยืนยันจากระบบก่อนจองรถ': 'Upload your driving licence and wait for approval before booking',
  'ปฏิเสธได้เฉพาะการจองที่รอยืนยัน': 'Only pending bookings can be declined',
  'ผู้ใช้นี้ยังไม่ได้อัปโหลดใบขับขี่': 'This user has not uploaded a licence',
  'พิกัดต้องมีทั้งละติจูดและลองจิจูด': 'Coordinates need both latitude and longitude',
  'ยกเลิกได้ก่อนวันรับรถเท่านั้น กรุณาติดต่อเจ้าของรถ': 'Bookings can only be cancelled before the pickup date. Please contact the owner',
  'รถคันนี้ไม่มีบริการส่งรถ': 'This car has no delivery service',
  'รถคันนี้ไม่รองรับการเช่ารายเดือน': 'This car is not available for monthly rental',
  'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร': 'Password must be at least 6 characters',
  'รองรับเฉพาะไฟล์รูป JPG, PNG หรือ WEBP': 'Only JPG, PNG or WEBP images are supported',
  'รับรถคืนได้เฉพาะการจองที่กำลังเช่าอยู่': 'Only active rentals can be returned',
  'ราคาเช่ารายวันต้องไม่ต่ำกว่า 100 บาท': 'Daily price must be at least ฿100',
  'รีวิวได้หลังคืนรถเรียบร้อยแล้ว': 'You can review after returning the car',
  'รูปแบบอีเมลไม่ถูกต้อง': 'Invalid email address',
  'วันคืนรถต้องหลังวันรับรถอย่างน้อย 1 วัน': 'Return date must be at least 1 day after pickup',
  'วันรับรถต้องไม่ย้อนหลัง': 'Pickup date cannot be in the past',
  'สถานะไม่ถูกต้อง': 'Invalid status',
  'ส่งมอบรถได้เฉพาะการจองที่ยืนยันแล้ว': 'Only confirmed bookings can be handed over',
  'หมดเวลาชำระเงินแล้ว กรุณาจองใหม่': 'Payment time has expired. Please book again',
  'อนุมัติได้เฉพาะการจองที่รอยืนยัน': 'Only pending bookings can be confirmed',
  'อีเมลนี้ถูกใช้สมัครแล้ว': 'This email is already registered',
  'อีเมลหรือรหัสผ่านไม่ถูกต้อง': 'Incorrect email or password',
  'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง': 'Incorrect username or password',
  'ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาที': 'Too many failed sign-in attempts. Please wait 15 minutes',
  'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่': 'Something went wrong. Please try again',
  'เช่ารายวันได้สูงสุด 90 วัน หากเช่านานกว่านี้กรุณาเลือกแบบรายเดือน': 'Daily rental is limited to 90 days. Choose monthly for longer rentals',
  'ไม่พบ API นี้': 'API not found',
  'ไม่พบการจองนี้': 'Booking not found',
  'ไม่พบผู้ใช้': 'User not found',
  'ไม่พบรถคันนี้': 'Car not found',
  'ไม่พบไฟล์': 'File not found',
  'ไม่รู้จักคำสั่งนี้': 'Unknown action',
  'ไม่สามารถจองรถของตัวเองได้': 'You cannot book your own car',
  'ไม่สามารถยกเลิกการจองในสถานะนี้ได้': 'This booking cannot be cancelled in its current status',
  'ไฟล์ต้องมีขนาดไม่เกิน 5MB': 'File must be 5MB or smaller',
  'อัปโหลดไฟล์ไม่สำเร็จ': 'Upload failed',
};
export const tErr = (msg) => (lang === 'en' ? ERR_EN[msg] || msg : msg);
