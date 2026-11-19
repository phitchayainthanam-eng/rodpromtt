import { PROVINCE_INFO, REGIONS } from './provinces.js';
import { L, getLang, setLang, locale, tErr } from './i18n.js';
import { provincePicker, mountProvincePickers, loadProvinceCounts, provinceName, provinceCounts } from './province-picker.js';

// =====================================================================
// helpers
// =====================================================================
const $app = document.getElementById('app');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let me = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = (n) => '฿' + Number(n || 0).toLocaleString('en-US');
const price = (n) => `<span class="price">${baht(n)}</span>`;
const fmtDate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: getLang() === 'en' ? 'numeric' : '2-digit' }) : '-');
const fmtDateTime = (ms) => new Date(ms).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
const today = () => new Date().toLocaleDateString('sv-SE');
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const go = (hash) => { location.hash = hash; };

async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, headers: {} };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch('/api' + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(tErr(data.error || 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่'));
  return data;
}

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.textContent = msg;
  if (type === 'bad') el.className = 'bad';
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { toast(e.message, 'bad'); } finally { if (btn) btn.disabled = false; }
}

function modal(html, onMount) {
  const m = $('#modal');
  m.innerHTML = `<div class="card" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { m.hidden = true; m.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  m.onclick = (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); };
  onMount?.(m, close);
  $('button, a, input, textarea', m)?.focus();
  return close;
}

// ---------- icons: lucide geometry, one set, 1.4 stroke, ink colour ----------
const ICONS = {
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  locate: '<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  gear: '<circle cx="6" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><path d="M6 7v10M12 7v10M18 7v5H6"/>',
  fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
};
const ic = (name, size = 16, cls = '') =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ---------- labels (th, en) ----------
const T = (map, k) => { const v = map[k]; return v ? L(v[0], v[1]) : k; };
const TYPES = { eco: ['อีโคคาร์', 'Eco car'], sedan: ['ซีดาน', 'Sedan'], suv: ['SUV 7 ที่นั่ง', 'SUV, 7 seats'], pickup: ['กระบะ', 'Pickup'], van: ['รถตู้', 'Van'], ev: ['รถไฟฟ้า', 'Electric'] };
const FUELS = { gasoline: ['เบนซิน', 'Petrol'], diesel: ['ดีเซล', 'Diesel'], hybrid: ['ไฮบริด', 'Hybrid'], ev: ['ไฟฟ้า', 'Electric'] };
const TRANS = { auto: ['เกียร์ออโต้', 'Automatic'], manual: ['เกียร์ธรรมดา', 'Manual'] };
const STATUS = {
  awaiting_payment: [['รอชำระเงิน', 'Awaiting payment'], 'warn'], pending: [['รอเจ้าของรถยืนยัน', 'Awaiting owner'], 'warn'],
  confirmed: [['ยืนยันแล้ว', 'Confirmed'], 'ok'], active: [['กำลังเช่า', 'On rental'], 'info'], completed: [['เสร็จสิ้น', 'Completed'], 'muted'],
  cancelled: [['ยกเลิกแล้ว', 'Cancelled'], 'bad'], rejected: [['เจ้าของรถปฏิเสธ', 'Declined'], 'bad'], expired: [['หมดเวลาชำระ', 'Expired'], 'bad'],
};
const LICENSE = { none: [['ยังไม่อัปโหลด', 'Not uploaded'], 'muted'], pending: [['รอตรวจสอบ', 'Under review'], 'warn'], approved: [['ยืนยันแล้ว', 'Verified'], 'ok'], rejected: [['ไม่ผ่านการตรวจสอบ', 'Rejected'], 'bad'] };
const DEPOSIT = { none: ['-', '-'], held: ['ระบบถือไว้', 'Held'], refunded: ['คืนแล้ว', 'Refunded'], deducted: ['หักบางส่วน', 'Partly deducted'] };
const ROLES = { member: ['สมาชิก', 'Member'], admin: ['แอดมิน', 'Admin'] };
const badge = ([label, cls]) => `<span class="badge ${cls}">${esc(L(label[0], label[1]))}</span>`;
const plate = (prov, lg) => `<span class="plate${lg ? ' lg' : ''}" title="${esc(L('จังหวัด', 'Province'))}">${esc(provinceName(prov))}</span>`;
const rating = (c) => (c.rating ? `<span class="rating">${ic('star', 14, 'fill')} ${c.rating} <span class="muted">(${c.review_count})</span></span>` : `<span class="muted">${L('ยังไม่มีรีวิว', 'No reviews yet')}</span>`);
const unitLabel = (b) => (b.rent_type === 'daily' ? L(`${b.units} วัน`, `${b.units} ${b.units === 1 ? 'day' : 'days'}`) : L(`${b.units} เดือน`, `${b.units} ${b.units === 1 ? 'month' : 'months'}`));
const rentLabel = (b) => (b.rent_type === 'daily' ? L('รายวัน', 'Daily') : L('รายเดือน', 'Monthly'));

const CAR_SVG = `<svg viewBox="0 0 120 60" aria-hidden="true"><path fill="currentColor" d="M8 42v-6c0-3 2-5 5-6l14-3 12-11c2-2 4-3 7-3h30c3 0 5 1 7 3l11 11 12 2c3 1 6 3 6 7v6c0 2-1 3-3 3h-5a11 11 0 0 0-22 0H40a11 11 0 0 0-22 0h-7c-2 0-3-1-3-3z"/><circle cx="29" cy="46" r="7" fill="currentColor"/><circle cx="91" cy="46" r="7" fill="currentColor"/></svg>`;
const carImg = (c) => (c.image
  ? `<img src="/uploads/cars/${esc(c.image)}" alt="${esc(c.brand + ' ' + c.model)}" loading="lazy">`
  : `<div class="ph" role="img" aria-label="${esc(c.brand + ' ' + c.model)}">${CAR_SVG}</div>`);

const safeUrl = (u) => (/^https:\/\//.test(u || '') ? esc(u) : '#');
const creditLine = (cr) => `${L('รูปตัวอย่างโดย', 'Sample photo by')} ${esc(cr.author || '-')}, <a href="${safeUrl(cr.license_url)}" target="_blank" rel="noopener">${esc(cr.license)}</a>, ${L('จาก', 'via')} <a href="${safeUrl(cr.source)}" target="_blank" rel="noopener">Wikimedia Commons</a>`;

const opts = (map, sel, any) =>
  (any ? `<option value="">${any}</option>` : '') + Object.entries(map).map(([k, v]) => `<option value="${k}" ${String(k) === String(sel) ? 'selected' : ''}>${esc(Array.isArray(v) ? L(v[0], v[1]) : v)}</option>`).join('');

function guard(...roles) {
  if (!me) { go('/login?next=' + encodeURIComponent(location.hash.slice(1))); return false; }
  if (roles.length && !roles.includes(me.role)) { $app.innerHTML = `<div class="empty">${L('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'You do not have access to this page')}</div>`; return false; }
  return true;
}

// =====================================================================
// chrome: nav, footer, language
// =====================================================================
function renderChrome() {
  const path = (location.hash.slice(1) || '/').split('?')[0];
  const link = (href, text) => `<a href="#${href}" class="${path === href ? 'active' : ''}">${text}</a>`;
  let html = link('/search', L('ค้นหารถ', 'Find a car'));
  if (!me) html += link('/login', L('เข้าสู่ระบบ', 'Sign in')) + `<a class="btn sm" href="#/register">${L('สมัครสมาชิก', 'Join')}</a>`;
  else {
    if (me.role !== 'admin') html += link('/my/bookings', L('การจองของฉัน', 'My bookings')) + link('/owner', L('ปล่อยเช่ารถ', 'Host a car'));
    else html += link('/admin', L('ผู้ดูแลระบบ', 'Admin'));
    html += link('/my/profile', esc(me.name.split(' ')[0]));
    html += `<button class="link" id="logoutBtn" style="text-decoration:none">${L('ออกจากระบบ', 'Sign out')}</button>`;
  }
  const lang = getLang();
  html += `<span class="lang" role="group" aria-label="Language">
    <button type="button" data-lang="th" aria-pressed="${lang === 'th'}">TH</button>
    <button type="button" data-lang="en" aria-pressed="${lang === 'en'}">EN</button></span>`;
  const nav = $('#nav');
  nav.innerHTML = html;
  nav.classList.remove('open');
  $('#navToggle').setAttribute('aria-expanded', 'false');
  $('#navToggle').setAttribute('aria-label', L('เมนู', 'Menu'));
  $('#logoutBtn')?.addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    me = null; toast(L('ออกจากระบบแล้ว', 'Signed out')); go('/');
  });
  $$('[data-lang]', nav).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.lang === getLang()) return;
    setLang(b.dataset.lang);
    router();
  }));

  $('#footer').innerHTML = `
    <span class="logo-word">RodPrompt</span>
    <span>${L('แพลตฟอร์มรวมรถเช่าจากเจ้าของรถท้องถิ่นทั่วไทย', 'Car rental from local owners across Thailand')}</span>
    <span>${L('ระบบชำระเงินอยู่ในโหมดสาธิต', 'Payments run in demo mode')} <a href="#/credits">${L('เครดิตรูปภาพ', 'Photo credits')}</a></span>`;
  document.title = L('RodPrompt เช่ารถจากเจ้าของรถท้องถิ่นทั่วไทย', 'RodPrompt, car rental from local owners in Thailand');
}
$('#navToggle').addEventListener('click', (e) => {
  const open = $('#nav').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

const routes = [
  [/^\/$/, pageHome],
  [/^\/search$/, pageSearch],
  [/^\/car\/(\d+)$/, pageCar],
  [/^\/checkout\/(\d+)$/, pageCheckout],
  [/^\/login$/, pageLogin],
  [/^\/register$/, pageRegister],
  [/^\/my\/bookings$/, pageMyBookings],
  [/^\/my\/profile$/, pageProfile],
  [/^\/owner$/, pageOwner],
  [/^\/owner\/car\/new$/, pageCarForm],
  [/^\/owner\/car\/(\d+)$/, pageCarForm],
  [/^\/admin$/, pageAdmin],
  [/^\/credits$/, pageCredits],
];

let renderSeq = 0;
let cleanup = null;
async function router() {
  cleanup?.(); cleanup = null;
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  renderChrome();
  const seq = ++renderSeq;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    $app.innerHTML = `<div class="loading">${L('กำลังโหลด', 'Loading')}</div>`;
    try { await fn(params, ...m.slice(1)); mountProvincePickers($app); }
    catch (e) { if (seq === renderSeq) $app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    return;
  }
  $app.innerHTML = `<div class="empty">${L('ไม่พบหน้านี้', 'Page not found')} <a href="#/">${L('กลับหน้าแรก', 'Back to home')}</a></div>`;
}
window.addEventListener('hashchange', () => { router(); window.scrollTo(0, 0); });

// =====================================================================
// car card
// =====================================================================
function carCard(c, qs = '') {
  return `<a class="car-card" href="#/car/${c.id}${qs ? '?' + qs : ''}">
    <div class="car-media">${carImg(c)}${c.instant ? `<span class="tag tag-instant"><span class="ti-dot">${ic('zap', 11, 'fill')}</span>${L('ยืนยันทันที', 'Instant')}</span>` : ''}</div>
    <div class="car-body">
      <div class="car-title">${esc(c.brand)} ${esc(c.model)} <span>${c.year || ''}</span></div>
      <div class="car-loc">${plate(c.province)}<span>${esc(c.location)}${c.distance != null ? `, ${L('ห่าง', '')} ${c.distance} ${L('กม.', 'km away')}` : ''}</span></div>
      <div class="car-meta"><span>${ic('car', 14)} ${esc(T(TYPES, c.type))}</span><span>${ic('users', 14)} ${c.seats}</span><span>${ic('gear', 14)} ${esc(T(TRANS, c.transmission))}</span></div>
      <div class="car-meta">${rating(c)}${c.delivery ? `<span>${ic('truck', 14)} ${L('ส่งรถได้', 'Delivery')}</span>` : ''}</div>
      <div class="car-price"><span><b>${baht(c.daily_price)}</b> <span class="muted small">${L('ต่อวัน', '/ day')}</span></span>
        ${c.monthly_price ? `<span class="muted small">${price(c.monthly_price)} ${L('ต่อเดือน', '/ month')}</span>` : ''}</div>
    </div></a>`;
}

// =====================================================================
// pages
// =====================================================================
const REGION_COPY = {
  north: ['ภูเขา สายหมอก และถนนโค้งสู่ปาย', 'Mountains, mist and the road to Pai'],
  northeast: ['ปราสาทหิน วัฒนธรรม และอาหารอีสาน', 'Stone temples, culture and Isan food'],
  central: ['เมืองเก่า แม่น้ำ และเมืองหลวง', 'Old capitals, rivers and Bangkok'],
  east: ['ทะเล เกาะช้าง และสวนผลไม้', 'Islands, beaches and fruit orchards'],
  west: ['น้ำตก ป่า และทางรถไฟสายมรณะ', 'Waterfalls, forests and the river Kwai'],
  south: ['อ่าว เกาะ และทะเลอันดามัน', 'Bays, islands and the Andaman Sea'],
};

async function pageHome() {
  const t = today();
  const tm = addDays(t, 1);
  const counts = provinceCounts();
  const regionCount = (id) => Object.entries(counts).reduce((n, [p, c]) => n + (PROVINCE_INFO[p]?.region === id ? c : 0), 0);
  $app.innerHTML = `
  <section class="banner">
    <img class="banner-bg" src="/img/hero.jpg" alt="" fetchpriority="high">
    <div>
      <h1>${L('ถึงต่างจังหวัดแล้วไม่มีรถ<br>จองตอนนี้ รับรถได้วันนี้', 'Landed upcountry with no car?<br>Book now, drive today')}</h1>
      <p class="hero-sub">${L('เช่ารถรายวันหรือรายเดือนจากเจ้าของรถในพื้นที่ รับที่จุดนัด หรือให้ส่งถึงสนามบินและสถานีขนส่ง', 'Rent by the day or month from local owners. Collect at a meeting point, or have it brought to the airport or bus terminal.')}</p>
    </div>
    <form class="searchbar" id="heroSearch">
      <h2>${L('หารถว่าง', 'Find a car')}</h2>
      <div class="field"><label for="hs-prov">${L('จังหวัด', 'Province')}</label>${provincePicker({ id: 'hs-prov' })}</div>
      <div class="grid2">
        <div class="field"><label for="hs-start">${L('วันรับรถ', 'Pick-up')}</label><input id="hs-start" type="date" name="start" min="${t}" value="${t}"></div>
        <div class="field"><label for="hs-end">${L('วันคืนรถ', 'Return')}</label><input id="hs-end" type="date" name="end" min="${tm}" value="${tm}"></div>
      </div>
      <label class="check"><input type="checkbox" name="urgent" value="1"> ${L('เฉพาะรถที่ยืนยันทันที', 'Instant booking only')}</label>
      <button class="btn block mt">${ic('search')} ${L('ค้นหารถว่าง', 'Find available cars')}</button>
    </form>
  </section>

  <nav class="quick" aria-label="${L('ทางลัด', 'Shortcuts')}">
    <a href="#/search?urgent=1"><span class="qi">${ic('zap', 20)}</span><span><b>${L('รับได้วันนี้', 'Ready today')}</b><small>${L('รถที่ยืนยันทันที ว่างวันนี้', 'Instant cars free today')}</small></span>${ic('arrow')}</a>
    <button type="button" id="qNear"><span class="qi">${ic('locate', 20)}</span><span><b>${L('รถใกล้ฉัน', 'Cars near me')}</b><small>${L('ค้นหาในรัศมี 50 กม.', 'Within 50 km of you')}</small></span>${ic('arrow')}</button>
    <a href="#/search?monthly=1"><span class="qi">${ic('calendar', 20)}</span><span><b>${L('เช่ารายเดือน', 'Monthly rental')}</b><small>${L('ราคาพิเศษเมื่อเช่ายาว', 'Better rates for long stays')}</small></span>${ic('arrow')}</a>
    <a href="#/owner/car/new"><span class="qi">${ic('key', 20)}</span><span><b>${L('ปล่อยเช่ารถ', 'Host your car')}</b><small>${L('ลงประกาศฟรีด้วยบัญชีเดียว', 'Free, with the same account')}</small></span>${ic('arrow')}</a>
  </nav>

  <section class="section">
    <div class="section-head"><h2>${L('รถที่รับได้วันนี้', 'Ready to drive today')}</h2><a href="#/search?urgent=1">${L('ดูทั้งหมด', 'View all')}</a></div>
    <div class="cars" id="urgentCars"><div class="loading">${L('กำลังโหลด', 'Loading')}</div></div>
  </section>

  <section class="section">
    <div class="section-head"><h2>${L('ไปภาคไหน ก็มีรถรอ', 'Wherever you land, a car is waiting')}</h2><a href="#/search">${L('ทุกจังหวัด', 'All provinces')}</a></div>
    <div class="regions">
      ${REGIONS.map((r) => {
        const n = regionCount(r.id);
        return `<a class="region-tile" href="#/search?region=${r.id}">
          <img src="/img/region-${r.id}.jpg" alt="" loading="lazy">
          <div class="rt-body">
            <div><h3>${L(r.th, r.en)}</h3><p>${L(...REGION_COPY[r.id])}</p></div>
            <span class="rt-count">${n ? L(`${n} คัน`, `${n} ${n === 1 ? 'car' : 'cars'}`) : L('เร็วๆ นี้', 'Coming soon')} ${ic('arrow')}</span>
          </div></a>`;
      }).join('')}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>${L('เช่ารถใน 3 ขั้นตอน', 'Three steps to the road')}</h2></div>
    <div class="steps">
      <div><span class="n">01</span>${ic('search', 28)}<h3>${L('ค้นหาและคัดกรอง', 'Search and filter')}</h3><p>${L('เลือกจังหวัดและวันที่ กรองตามสเปค หรือหารถที่ใกล้ตำแหน่งของคุณ', 'Choose a province and dates, filter by spec, or find cars near you.')}</p></div>
      <div><span class="n">02</span>${ic('shield', 28)}<h3>${L('ยืนยันตัวตนและชำระเงิน', 'Verify and pay')}</h3><p>${L('อัปโหลดใบขับขี่ครั้งเดียว จ่ายผ่านระบบกลาง เงินมัดจำระบบถือไว้ให้', 'Upload your licence once and pay through the platform. We hold the deposit.')}</p></div>
      <div><span class="n">03</span>${ic('key', 28)}<h3>${L('รับรถออกเดินทาง', 'Collect the keys')}</h3><p>${L('รับเองที่จุดนัด หรือให้เจ้าของรถนำมาส่งที่สนามบินหรือสถานีขนส่ง', 'Collect at the meeting point, or have the owner bring it to the airport or terminal.')}</p></div>
    </div>
  </section>

  <section class="section">
    <div class="owner-band">
      <div><h2>${L('มีรถจอดว่างอยู่ ปล่อยเช่าได้', 'Your idle car can earn')}</h2>
      <p>${L('ลงประกาศฟรีด้วยบัญชีเดียวกับที่ใช้เช่า ตั้งราคารายวันและรายเดือนเอง ผู้เช่าทุกคนผ่านการตรวจใบขับขี่ และมีเงินมัดจำคุ้มครองความเสียหาย', 'List for free with the same account you rent with. Set your own daily and monthly prices. Every renter is licence-checked and a deposit covers damage.')}</p></div>
      <a class="btn light" href="#/owner/car/new">${L('ลงประกาศรถ', 'List your car')} ${ic('arrow')}</a>
    </div>
  </section>`;

  const form = $('#heroSearch');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v) p.set(k, v);
    go('/search?' + p);
  });
  const startIn = $('#hs-start'), endIn = $('#hs-end');
  startIn.addEventListener('change', () => { endIn.min = addDays(startIn.value, 1); if (endIn.value <= startIn.value) endIn.value = addDays(startIn.value, 1); });
  $('#qNear').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!navigator.geolocation) return toast(L('เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง', 'Your browser cannot share location'), 'bad');
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => go(`/search?lat=${pos.coords.latitude.toFixed(5)}&lng=${pos.coords.longitude.toFixed(5)}&radius=50&sort=distance`),
      () => { btn.disabled = false; toast(L('ระบุตำแหน่งไม่ได้ กรุณาอนุญาตให้เว็บเข้าถึงตำแหน่ง', 'Location unavailable. Please allow location access'), 'bad'); },
      { timeout: 10000 },
    );
  });

  const { cars } = await api('/cars?urgent=1&limit=8');
  $('#urgentCars').innerHTML = cars.length ? cars.map((c) => carCard(c)).join('') : `<div class="empty">${L('ยังไม่มีรถที่รับได้วันนี้', 'No cars ready today yet')}</div>`;
}

async function pageSearch(params) {
  const p = Object.fromEntries(params);
  const t = today();
  const region = REGIONS.find((r) => r.id === p.region);
  $app.innerHTML = `
  <div class="search-layout">
    <form class="card filters" id="filters">
      <h3>${L('คัดกรอง', 'Filters')}</h3>
      <div class="field"><label for="f-q">${L('ยี่ห้อ รุ่น หรือสถานที่', 'Make, model or place')}</label><input id="f-q" type="text" name="q" value="${esc(p.q)}" placeholder="${L('เช่น Yaris หรือ สนามบิน', 'e.g. Yaris or airport')}"></div>
      <div class="field"><label for="f-prov">${L('จังหวัด', 'Province')}</label>${provincePicker({ id: 'f-prov', value: p.province || '' })}
        ${p.region && !p.province && region ? `<div class="row mt" style="margin-top:8px"><span class="badge info">${L(region.th, region.en)}</span><button type="button" class="link small" id="clearRegion">${L('ทุกภาค', 'All regions')}</button></div><input type="hidden" name="region" value="${esc(p.region)}">` : ''}</div>
      <div class="grid2">
        <div class="field"><label for="f-start">${L('วันรับรถ', 'Pick-up')}</label><input id="f-start" type="date" name="start" min="${t}" value="${esc(p.start)}"></div>
        <div class="field"><label for="f-end">${L('วันคืนรถ', 'Return')}</label><input id="f-end" type="date" name="end" min="${t}" value="${esc(p.end)}"></div>
      </div>
      <div class="field"><label for="f-type">${L('ประเภทรถ', 'Car type')}</label><select id="f-type" name="type">${opts(TYPES, p.type, L('ทุกประเภท', 'All types'))}</select></div>
      <div class="grid2">
        <div class="field"><label for="f-tr">${L('เกียร์', 'Gearbox')}</label><select id="f-tr" name="transmission">${opts(TRANS, p.transmission, L('ทั้งหมด', 'Any'))}</select></div>
        <div class="field"><label for="f-seat">${L('ที่นั่งขั้นต่ำ', 'Min. seats')}</label><select id="f-seat" name="seats">${opts({ 4: '4+', 5: '5+', 7: '7+', 10: '10+' }, p.seats, L('ไม่ระบุ', 'Any'))}</select></div>
      </div>
      <div class="field"><label for="f-max">${L('ราคาต่อวันไม่เกิน (บาท)', 'Max. price per day (THB)')}</label><input id="f-max" type="number" name="max_price" min="0" step="100" value="${esc(p.max_price)}"></div>
      <div class="field">
        <label class="check"><input type="checkbox" name="urgent" value="1" ${p.urgent ? 'checked' : ''}> ${L('รับได้ด่วน วันนี้ถึงพรุ่งนี้', 'Ready today to tomorrow')}</label>
        <label class="check"><input type="checkbox" name="instant" value="1" ${p.instant ? 'checked' : ''}> ${L('ยืนยันทันทีหลังชำระเงิน', 'Instant booking')}</label>
        <label class="check"><input type="checkbox" name="delivery" value="1" ${p.delivery ? 'checked' : ''}> ${L('มีบริการส่งรถ', 'Delivery available')}</label>
        <label class="check"><input type="checkbox" name="monthly" value="1" ${p.monthly ? 'checked' : ''}> ${L('เช่ารายเดือนได้', 'Monthly rental')}</label>
      </div>
      <div class="field">
        <label>${L('ใกล้ตำแหน่งของฉัน', 'Near me')}</label>
        ${p.lat ? `<div class="row"><span class="badge info">${ic('locate', 14)} ${L('ตำแหน่งปัจจุบัน', 'Current location')}</span>
          <select name="radius" style="width:auto" aria-label="${L('รัศมี', 'Radius')}">${opts({ 10: '10 km', 25: '25 km', 50: '50 km', 100: '100 km', 200: '200 km' }, p.radius || '50')}</select>
          <button type="button" class="link" id="clearGeo">${L('ล้าง', 'Clear')}</button></div>
          <input type="hidden" name="lat" value="${esc(p.lat)}"><input type="hidden" name="lng" value="${esc(p.lng)}">`
        : `<button type="button" class="btn ghost block" id="nearMe">${ic('locate')} ${L('ใช้ตำแหน่งของฉัน', 'Use my location')}</button>`}
      </div>
      <div class="field"><label for="f-sort">${L('เรียงตาม', 'Sort by')}</label><select id="f-sort" name="sort">${opts({ recommended: ['แนะนำ', 'Recommended'], price_asc: ['ราคาต่ำไปสูง', 'Price, low to high'], price_desc: ['ราคาสูงไปต่ำ', 'Price, high to low'], rating: ['คะแนนรีวิว', 'Rating'], distance: ['ใกล้ที่สุด', 'Nearest'], newest: ['ลงประกาศล่าสุด', 'Newest'] }, p.sort)}</select></div>
      <button class="btn block">${L('ค้นหา', 'Search')}</button>
      <a class="btn ghost block mt" href="#/search">${L('ล้างตัวกรอง', 'Reset filters')}</a>
    </form>
    <div>
      <div class="section-head"><h2 id="resultTitle">${L('ผลการค้นหา', 'Results')}</h2></div>
      <div class="cars" id="results"><div class="loading">${L('กำลังค้นหา', 'Searching')}</div></div>
    </div>
  </div>`;

  const form = $('#filters');
  const submit = () => {
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v) q.set(k, v);
    go('/search?' + q);
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  form.addEventListener('change', (e) => { if (e.target.matches('select, input[type=checkbox], [data-pp] input[type=hidden]')) submit(); });
  $('#clearRegion')?.addEventListener('click', () => { form.region.remove(); submit(); });
  $('#clearGeo')?.addEventListener('click', () => { form.lat.remove(); form.lng.remove(); form.radius?.remove(); submit(); });
  $('#nearMe')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!navigator.geolocation) return toast(L('เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง', 'Your browser cannot share location'), 'bad');
    btn.disabled = true; btn.textContent = L('กำลังหาตำแหน่ง', 'Locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const q = new URLSearchParams(params);
        q.set('lat', pos.coords.latitude.toFixed(5)); q.set('lng', pos.coords.longitude.toFixed(5));
        q.set('radius', '50'); q.delete('province'); q.set('sort', 'distance');
        go('/search?' + q);
      },
      () => { toast(L('ระบุตำแหน่งไม่ได้ กรุณาอนุญาตให้เว็บเข้าถึงตำแหน่ง', 'Location unavailable. Please allow location access'), 'bad'); btn.disabled = false; btn.innerHTML = `${ic('locate')} ${L('ใช้ตำแหน่งของฉัน', 'Use my location')}`; },
      { timeout: 10000 },
    );
  });

  const { cars, start, end } = await api('/cars?' + params);
  const carry = new URLSearchParams();
  if (start) carry.set('start', start);
  if (end) carry.set('end', end);
  const placeName = p.province ? provinceName(p.province) : region ? L(region.th, region.en) : '';
  const where = placeName ? L(` ใน${placeName}`, ` in ${placeName}`) : '';
  $('#resultTitle').textContent = L(`รถว่าง ${cars.length} คัน${where}`, `${cars.length} ${cars.length === 1 ? 'car' : 'cars'} available${where}`)
    + (start ? L(` ช่วง ${fmtDate(start)} ถึง ${fmtDate(end)}`, `, ${fmtDate(start)} to ${fmtDate(end)}`) : '');
  $('#results').innerHTML = cars.length
    ? cars.map((c) => carCard(c, carry.toString())).join('')
    : `<div class="empty" style="grid-column:1/-1">${L('ไม่พบรถที่ตรงเงื่อนไข ลองเปลี่ยนวันที่ หรือขยายรัศมีการค้นหา', 'No cars match. Try other dates or a wider radius.')}</div>`;
}

async function pageCar(params, id) {
  const { car: c, booked, reviews } = await api('/cars/' + id);
  const t = today();
  const start = params.get('start') && params.get('start') >= t ? params.get('start') : t;
  const end = params.get('end') && params.get('end') > start ? params.get('end') : addDays(start, 1);
  const isOwn = me && me.id === c.owner_id;
  const starRow = (n) => `<span class="stars" aria-label="${n}/5">${[1, 2, 3, 4, 5].map((i) => ic('star', 14, i <= n ? 'fill' : 'off')).join('')}</span>`;
  const spec = (icon, label, value) => `<div><dt>${ic(icon)} ${label}</dt><dd>${value}</dd></div>`;

  $app.innerHTML = `
  <a class="back" href="javascript:history.back()">${ic('back')} ${L('ย้อนกลับ', 'Back')}</a>
  <div class="detail">
    <div class="stack">
      <div class="car-media${c.image ? ' has-img' : ''}">${carImg(c)}</div>
      <div class="card">
        <div class="detail-head">
          <h1>${esc(c.brand)} ${esc(c.model)} <span>${c.year || ''}</span></h1>
          ${plate(c.province, true)}
        </div>
        <div class="row text-2 small">
          <span>${ic('pin')} ${esc(c.location)}</span>
          ${rating(c)}
          ${c.instant ? `<span class="tag-instant on-light"><span class="ti-dot">${ic('zap', 11, 'fill')}</span>${L('ยืนยันทันที', 'Instant booking')}</span>` : `<span class="badge info">${L('เจ้าของรถยืนยันก่อน', 'Owner approves first')}</span>`}
          ${c.active ? '' : `<span class="badge bad">${L('ปิดให้เช่า', 'Unlisted')}</span>`}
        </div>
        <dl class="specs">
          ${spec('car', L('ประเภท', 'Type'), esc(T(TYPES, c.type)))}
          ${spec('users', L('ที่นั่ง', 'Seats'), c.seats)}
          ${spec('gear', L('เกียร์', 'Gearbox'), esc(T(TRANS, c.transmission)))}
          ${spec('fuel', L('เชื้อเพลิง', 'Fuel'), esc(T(FUELS, c.fuel)))}
          ${spec('tag', L('ราคารายวัน', 'Daily rate'), price(c.daily_price))}
          ${spec('calendar', L('ราคารายเดือน', 'Monthly rate'), c.monthly_price ? price(c.monthly_price) : L('ไม่รับรายเดือน', 'Not offered'))}
          ${spec('wallet', L('เงินมัดจำ ได้คืน', 'Refundable deposit'), price(c.deposit))}
          ${spec('truck', L('ส่งรถถึงที่', 'Delivery'), c.delivery ? price(c.delivery_fee) : L('ไม่มีบริการ', 'Not offered'))}
        </dl>
        ${c.description ? `<h3>${L('รายละเอียดจากเจ้าของรถ', 'From the owner')}</h3><p class="text-2" style="white-space:pre-line">${esc(c.description)}</p>` : ''}
        <p class="muted small" style="margin:0">${L('เจ้าของรถ', 'Hosted by')} ${esc(c.owner_name)}</p>
        ${c.image_credit ? `<p class="muted small" style="margin:4px 0 0">${creditLine(c.image_credit)}</p>` : ''}
        ${booked.length ? `<hr><h3>${L('ช่วงที่ไม่ว่าง', 'Unavailable dates')}</h3><div class="booked-list">${booked.map((b) => `<span class="badge muted">${fmtDate(b.start_date)} ${L('ถึง', 'to')} ${fmtDate(b.end_date)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="card">
        <h3>${L('รีวิวจากผู้เช่า', 'Reviews')}</h3>
        ${reviews.length ? reviews.map((r) => `<div class="review"><div class="row between"><b>${esc(r.name)}</b>${starRow(r.rating)}</div>
          <p class="text-2" style="margin:6px 0">${esc(r.comment)}</p><div class="muted small">${fmtDateTime(r.created_at)}</div></div>`).join('') : `<p class="muted" style="margin:0">${L('ยังไม่มีรีวิว', 'No reviews yet')}</p>`}
      </div>
    </div>

    <form class="card book-box" id="bookForm">
      <h3>${L('จองรถคันนี้', 'Book this car')}</h3>
      <div class="field seg">
        <label><input type="radio" name="rent_type" value="daily" checked> ${L('รายวัน', 'Daily')}</label>
        <label><input type="radio" name="rent_type" value="monthly" ${c.monthly_price ? '' : 'disabled'}> ${L('รายเดือน', 'Monthly')}</label>
      </div>
      <div class="field"><label for="b-start">${L('วันรับรถ', 'Pick-up')}</label><input id="b-start" type="date" name="start_date" min="${t}" value="${start}" required></div>
      <div class="field" id="endField"><label for="b-end">${L('วันคืนรถ', 'Return')}</label><input id="b-end" type="date" name="end_date" min="${addDays(start, 1)}" value="${end}"></div>
      <div class="field" id="monthsField" hidden><label for="b-m">${L('จำนวนเดือน (เดือนละ 30 วัน)', 'Months (30 days each)')}</label>
        <select id="b-m" name="months">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1} ${L('เดือน', i ? 'months' : 'month')}</option>`).join('')}</select></div>
      <div class="field">
        <label>${L('วิธีรับรถ', 'Pick-up method')}</label>
        <label class="check"><input type="radio" name="pickup_method" value="self" checked> ${L('รับเองที่', 'Collect at')} ${esc(c.location)}</label>
        ${c.delivery ? `<label class="check"><input type="radio" name="pickup_method" value="delivery"> ${L('ส่งรถถึงที่ เพิ่ม', 'Deliver to me, plus')} ${baht(c.delivery_fee)}</label>` : ''}
      </div>
      <div class="field" id="placeField" hidden><label for="b-place">${L('สถานที่ส่งรถ', 'Delivery address')}</label><input id="b-place" type="text" name="delivery_place" placeholder="${L('เช่น สนามบิน ประตู 3', 'e.g. Airport, gate 3')}"></div>
      <div id="quote" class="price-lines"></div>
      ${isOwn ? `<div class="msg info">${L('นี่คือรถของคุณ', 'This is your car')}</div>` : `<button class="btn block" id="bookBtn">${L('จองและชำระเงิน', 'Book and pay')}</button>`}
      <p class="muted small" style="margin:14px 0 0">${ic('shield', 14)} ${L('เงินมัดจำระบบถือไว้ และคืนเมื่อคืนรถโดยไม่มีความเสียหาย ยกเลิกได้ฟรีก่อนวันรับรถ', 'We hold the deposit and return it when the car comes back undamaged. Free cancellation before pick-up.')}</p>
    </form>
  </div>`;

  const form = $('#bookForm');
  let lastQuote = null;
  const sync = () => {
    const monthly = form.rent_type.value === 'monthly';
    $('#endField').hidden = monthly;
    $('#monthsField').hidden = !monthly;
    $('#placeField').hidden = form.pickup_method.value !== 'delivery';
    form.end_date.min = addDays(form.start_date.value || t, 1);
  };
  const refreshQuote = async () => {
    sync();
    const q = new URLSearchParams(new FormData(form));
    q.delete('delivery_place');
    const box = $('#quote');
    try {
      const { quote: qt } = await api(`/cars/${c.id}/quote?` + q);
      lastQuote = qt;
      box.innerHTML = `
        <div><span>${L('ค่าเช่า', 'Rental')} ${baht(qt.unit_price)} x ${unitLabel(qt)}</span><span>${baht(qt.rental_price)}</span></div>
        ${qt.delivery_fee ? `<div><span>${L('ค่าส่งรถ', 'Delivery')}</span><span>${baht(qt.delivery_fee)}</span></div>` : ''}
        <div><span>${L('เงินมัดจำ ได้คืน', 'Refundable deposit')}</span><span>${baht(qt.deposit)}</span></div>
        <div class="total"><span>${L('ชำระทั้งหมด', 'Total')}</span><span>${baht(qt.total)}</span></div>
        <div><span>${L('คืนรถวันที่', 'Return on')}</span><span>${fmtDate(qt.end_date)}</span></div>
        ${qt.available ? '' : `<div class="msg bad mt">${L('รถไม่ว่างในช่วงนี้ กรุณาเลือกวันอื่น', 'Not available for these dates. Please choose others.')}</div>`}`;
      if ($('#bookBtn')) $('#bookBtn').disabled = !qt.available;
    } catch (e) {
      lastQuote = null;
      box.innerHTML = `<div class="msg bad">${esc(e.message)}</div>`;
      if ($('#bookBtn')) $('#bookBtn').disabled = true;
    }
  };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'start_date' && form.end_date.value <= form.start_date.value) form.end_date.value = addDays(form.start_date.value, 1);
    if (e.target.name !== 'delivery_place') refreshQuote(); else sync();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!me) { toast(L('กรุณาเข้าสู่ระบบก่อนจอง', 'Please sign in to book')); return go('/login?next=' + encodeURIComponent(location.hash.slice(1))); }
    if (me.role === 'admin') return toast(L('บัญชีแอดมินจองรถไม่ได้', 'Admin accounts cannot book'), 'bad');
    if (me.license_status !== 'approved') {
      return modal(`<h3>${L('ยืนยันใบขับขี่ก่อนจอง', 'Verify your licence first')}</h3>
        <p class="text-2">${L('ผู้เช่าทุกคนต้องอัปโหลดใบขับขี่และผ่านการตรวจสอบก่อนจองรถ', 'Every renter uploads a driving licence and is verified before booking.')}</p>
        <p>${L('สถานะตอนนี้', 'Current status')} ${badge(LICENSE[me.license_status])}</p>
        <div class="row"><a class="btn" href="#/my/profile" data-close>${L('อัปโหลดใบขับขี่', 'Upload licence')}</a><button class="btn ghost" data-close>${L('ปิด', 'Close')}</button></div>`);
    }
    if (!lastQuote?.available) return;
    busy($('#bookBtn'), async () => {
      const body = Object.fromEntries(new FormData(form));
      body.car_id = c.id;
      const { id: bid } = await api('/bookings', { method: 'POST', body });
      go('/checkout/' + bid);
    });
  });
  refreshQuote();
}

async function pageCheckout(params, id) {
  if (!guard()) return;
  const { booking: b } = await api('/bookings/' + id);
  if (b.status !== 'awaiting_payment') {
    $app.innerHTML = `<div class="card auth-box" style="text-align:center"><h2>${badge(STATUS[b.status])}</h2>
      <p class="text-2">${L('การจองนี้ไม่ได้อยู่ในสถานะรอชำระเงิน', 'This booking is not awaiting payment')}</p><a class="btn" href="#/my/bookings">${L('ไปที่การจองของฉัน', 'Go to my bookings')}</a></div>`;
    return;
  }
  $app.innerHTML = `
  <div class="page-head"><h1>${L('ชำระเงิน', 'Payment')}</h1></div>
  <div class="msg warn mb">${L('โหมดสาธิต ระบบจำลองการชำระเงินผ่านระบบกลาง ยังไม่มีการตัดเงินจริง', 'Demo mode: payment is simulated and no money is charged')}</div>
  <div class="checkout">
    <form class="card" id="payForm">
      <p class="text-2">${L('ชำระภายใน', 'Pay within')} <span class="timer" id="timer">--:--</span> ${L('นาที หลังจากนั้นระบบจะปล่อยรถให้คนอื่นจอง', 'minutes, after which the car is released')}</p>
      <div class="pay-options">
        <label class="pay-opt"><input type="radio" name="method" value="promptpay" checked> ${ic('qr', 18)} PromptPay</label>
        <label class="pay-opt"><input type="radio" name="method" value="card"> ${ic('card', 18)} ${L('บัตรเครดิตหรือเดบิต', 'Credit or debit card')}</label>
      </div>
      <div id="payPromptpay" style="text-align:center">
        <div class="qr">${fakeQr(b.id)}</div>
        <p class="muted small">${L('สแกนเพื่อชำระ', 'Scan to pay')} ${baht(b.total)}</p>
      </div>
      <div id="payCard" hidden>
        <div class="field"><label for="cc-n">${L('หมายเลขบัตร', 'Card number')}</label><input id="cc-n" type="text" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="19" autocomplete="cc-number"></div>
        <div class="grid2"><div class="field"><label for="cc-e">${L('วันหมดอายุ', 'Expiry')}</label><input id="cc-e" type="text" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp"></div>
        <div class="field"><label for="cc-c">CVV</label><input id="cc-c" type="password" maxlength="4" autocomplete="cc-csc"></div></div>
      </div>
      <button class="btn block" id="payBtn">${L('ชำระ', 'Pay')} ${baht(b.total)}</button>
      <button type="button" class="btn ghost block mt" id="cancelBtn">${L('ยกเลิกการจอง', 'Cancel booking')}</button>
    </form>
    <div class="card">
      <div class="car-media" style="border-radius:var(--r-control)">${carImg(b)}</div>
      <div class="detail-head mt"><h3 style="margin:0">${esc(b.brand)} ${esc(b.model)} ${b.year || ''}</h3>${plate(b.province)}</div>
      <div class="price-lines">
        <div><span>${L('รับรถ', 'Pick-up')}</span><span>${fmtDate(b.start_date)}</span></div>
        <div><span>${L('คืนรถ', 'Return')}</span><span>${fmtDate(b.end_date)}</span></div>
        <div><span>${L('จุดรับรถ', 'Where')}</span><span>${b.pickup_method === 'delivery' ? L('ส่งถึง ', 'Deliver to ') + esc(b.delivery_place) : esc(b.location)}</span></div>
        <hr style="margin:8px 0">
        <div><span>${L('ค่าเช่า', 'Rental')} ${unitLabel(b)}</span><span>${baht(b.rental_price)}</span></div>
        ${b.delivery_fee ? `<div><span>${L('ค่าส่งรถ', 'Delivery')}</span><span>${baht(b.delivery_fee)}</span></div>` : ''}
        <div><span>${L('เงินมัดจำ ได้คืน', 'Refundable deposit')}</span><span>${baht(b.deposit)}</span></div>
        <div class="total"><span>${L('รวม', 'Total')}</span><span>${baht(b.total)}</span></div>
      </div>
      <p class="muted small" style="margin:0">${b.instant ? L('รถคันนี้ยืนยันทันทีหลังชำระเงิน', 'Confirmed as soon as you pay') : L('เจ้าของรถจะยืนยันหลังชำระเงิน ถ้าถูกปฏิเสธจะได้เงินคืนเต็มจำนวน', 'The owner confirms after payment. If declined, you get a full refund.')}</p>
    </div>
  </div>`;

  const form = $('#payForm');
  form.addEventListener('change', () => {
    const card = form.method.value === 'card';
    $('#payCard').hidden = !card; $('#payPromptpay').hidden = card;
  });
  const tick = () => {
    const left = Math.max(0, b.expires_at - Date.now());
    $('#timer').textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    if (left <= 0) { clearInterval(iv); $('#payBtn').disabled = true; toast(L('หมดเวลาชำระเงิน', 'Payment time expired'), 'bad'); }
  };
  const iv = setInterval(tick, 1000); tick();
  cleanup = () => clearInterval(iv);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('#payBtn'), async () => {
      const { status } = await api(`/bookings/${b.id}/pay`, { method: 'POST', body: { method: form.method.value } });
      toast(status === 'confirmed' ? L('ชำระเงินแล้ว การจองได้รับการยืนยัน', 'Paid. Your booking is confirmed') : L('ชำระเงินแล้ว รอเจ้าของรถยืนยัน', 'Paid. Waiting for the owner to confirm'));
      go('/my/bookings');
    });
  });
  $('#cancelBtn').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    await api(`/bookings/${b.id}/cancel`, { method: 'POST' });
    toast(L('ยกเลิกการจองแล้ว', 'Booking cancelled')); go('/car/' + b.car_id);
  }));
}

function fakeQr(seed) {
  let s = seed * 9301 + 49297, cells = '';
  const N = 25;
  const finder = (x, y) => { const inBox = (cx, cy) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7; return inBox(0, 0) || inBox(N - 7, 0) || inBox(0, N - 7); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let on;
    if (finder(x, y)) {
      const lx = x < 7 ? x : x - (N - 7), ly = y < 7 ? y : y - (N - 7);
      on = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
    } else { s = (s * 9301 + 49297) % 233280; on = s / 233280 > 0.5; }
    if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" fill="currentColor" role="img" aria-label="Demo QR">${cells}</svg>`;
}

async function pageLogin(params) {
  if (me) return go(params.get('next') || '/');
  const next = params.get('next') ? '?next=' + encodeURIComponent(params.get('next')) : '';
  $app.innerHTML = `
  <div class="card auth-box">
    <h2>${L('เข้าสู่ระบบ', 'Sign in')}</h2>
    <form id="loginForm">
      <div class="field"><label for="l-e">${L('ชื่อผู้ใช้หรืออีเมล', 'Username or email')}</label><input id="l-e" type="text" name="email" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${L('เช่น somchai หรือ somchai@gmail.com', 'e.g. somchai or somchai@gmail.com')}"></div>
      <div class="field"><label for="l-p">${L('รหัสผ่าน', 'Password')}</label><input id="l-p" type="password" name="password" required autocomplete="current-password"></div>
      <button class="btn block">${L('เข้าสู่ระบบ', 'Sign in')}</button>
    </form>
    <p class="muted small mt">${L('ยังไม่มีบัญชี', 'New here?')} <a href="#/register${next}">${L('สมัครสมาชิก', 'Create an account')}</a></p>
  </div>`;
  const form = $('#loginForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(form.querySelector('button'), async () => {
      ({ user: me } = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) }));
      toast(L('เข้าสู่ระบบแล้ว', 'Signed in'));
      go(params.get('next') || (me.role === 'admin' ? '/admin' : '/'));
    });
  });
}

async function pageRegister(params) {
  if (me) return go(params.get('next') || '/');
  const next = params.get('next') ? '?next=' + encodeURIComponent(params.get('next')) : '';
  $app.innerHTML = `
  <div class="card auth-box">
    <h2>${L('สมัครสมาชิก', 'Create an account')}</h2>
    <p class="text-2 small">${L('บัญชีเดียวใช้ได้ทั้งเช่ารถและปล่อยเช่ารถของคุณเอง', 'One account to rent cars and to host your own.')}</p>
    <form id="regForm">
      <div class="field"><label for="r-n">${L('ชื่อและนามสกุล', 'Full name')}</label><input id="r-n" type="text" name="name" required autocomplete="name"></div>
      <div class="field"><label for="r-e">${L('อีเมล', 'Email')}</label><input id="r-e" type="email" name="email" required autocomplete="email"></div>
      <div class="field"><label for="r-t">${L('เบอร์โทรศัพท์', 'Phone')}</label><input id="r-t" type="tel" name="phone" required placeholder="08xxxxxxxx" autocomplete="tel"></div>
      <div class="field"><label for="r-p">${L('รหัสผ่าน อย่างน้อย 6 ตัว', 'Password, at least 6 characters')}</label><input id="r-p" type="password" name="password" minlength="6" required autocomplete="new-password"></div>
      <button class="btn block">${L('สมัครสมาชิก', 'Create account')}</button>
    </form>
    <p class="muted small mt">${L('มีบัญชีแล้ว', 'Already a member?')} <a href="#/login${next}">${L('เข้าสู่ระบบ', 'Sign in')}</a></p>
  </div>`;
  const form = $('#regForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(form.querySelector('button.btn'), async () => {
      ({ user: me } = await api('/auth/register', { method: 'POST', body: Object.fromEntries(new FormData(form)) }));
      toast(L('สมัครสมาชิกแล้ว', 'Account created'));
      go(params.get('next') || '/my/profile');
    });
  });
}

async function pageProfile() {
  if (!guard()) return;
  ({ user: me } = await api('/me'));
  renderChrome();
  const needLicense = me.role !== 'admin';
  $app.innerHTML = `
  <div class="page-head"><h1>${L('บัญชีของฉัน', 'My account')}</h1></div>
  <div class="grid2" style="gap:16px;align-items:start">
    <form class="card" id="profileForm">
      <h3>${L('ข้อมูลส่วนตัว', 'Personal details')}</h3>
      <p class="muted small">${esc(me.email)}, ${esc(T(ROLES, me.role))}</p>
      <div class="field"><label for="p-n">${L('ชื่อและนามสกุล', 'Full name')}</label><input id="p-n" type="text" name="name" value="${esc(me.name)}" required></div>
      <div class="field"><label for="p-t">${L('เบอร์โทรศัพท์', 'Phone')}</label><input id="p-t" type="tel" name="phone" value="${esc(me.phone)}" required></div>
      <button class="btn">${L('บันทึก', 'Save')}</button>
    </form>
    ${needLicense ? `<form class="card" id="licForm">
      <div class="row between"><h3 style="margin:0">${L('ใบขับขี่', 'Driving licence')}</h3>${badge(LICENSE[me.license_status])}</div>
      <p class="text-2 small mt">${L('ใช้สำหรับการจองรถ ข้อมูลเห็นได้เฉพาะคุณและผู้ดูแลระบบ', 'Needed to book. Only you and our admins can see it.')}</p>
      ${me.license_status === 'rejected' && me.license_note ? `<div class="msg bad mb">${L('เหตุผล', 'Reason')}: ${esc(me.license_note)}</div>` : ''}
      ${me.license_status === 'pending' ? `<div class="msg warn mb">${L('แอดมินกำลังตรวจสอบ ปกติไม่เกิน 1 ชั่วโมง', 'Under review, usually within an hour')}</div>` : ''}
      ${me.has_license ? `<img class="license-img mb" src="/api/files/license/${me.id}?t=${Date.now()}" alt="${L('รูปใบขับขี่ของคุณ', 'Your licence')}">` : ''}
      ${me.license_status === 'approved' ? `<p class="text-2 small" style="margin:0">${L('ยืนยันแล้ว จองรถได้ทันที', 'Verified. You can book right away.')}</p>` : `
      <div class="field"><label for="p-l">${L('รูปใบขับขี่ JPG หรือ PNG ไม่เกิน 5MB', 'Licence photo, JPG or PNG up to 5MB')}</label><input id="p-l" type="file" name="license" accept="image/jpeg,image/png,image/webp" required></div>
      <button class="btn">${L('ส่งตรวจสอบ', 'Submit for review')}</button>`}
    </form>` : ''}
  </div>`;

  const pf = $('#profileForm');
  pf.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(pf.querySelector('button'), async () => {
      ({ user: me } = await api('/me', { method: 'PUT', body: Object.fromEntries(new FormData(pf)) }));
      renderChrome(); toast(L('บันทึกแล้ว', 'Saved'));
    });
  });
  const lf = $('#licForm');
  lf?.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(lf.querySelector('button'), async () => {
      ({ user: me } = await api('/me/license', { method: 'POST', form: new FormData(lf) }));
      toast(L('ส่งแล้ว รอแอดมินตรวจสอบ', 'Submitted for review')); pageProfile();
    });
  });
}

async function pageMyBookings() {
  if (!guard('member')) return;
  const { bookings } = await api('/bookings/my');
  const t = today();
  $app.innerHTML = `<div class="page-head"><h1>${L('การจองของฉัน', 'My bookings')}</h1></div>
  <div class="stack">
  ${bookings.length ? bookings.map((b) => {
    const actions = [];
    if (b.status === 'awaiting_payment') actions.push(`<a class="btn sm" href="#/checkout/${b.id}">${L('ชำระเงิน', 'Pay now')}</a>`);
    if (['awaiting_payment', 'pending'].includes(b.status) || (b.status === 'confirmed' && b.start_date > t))
      actions.push(`<button class="btn sm danger" data-cancel="${b.id}" data-paid="${b.payment_status === 'paid' ? 1 : 0}">${L('ยกเลิก', 'Cancel')}</button>`);
    if (b.status === 'completed' && !b.reviewed) actions.push(`<button class="btn sm" data-review="${b.id}">${L('เขียนรีวิว', 'Write a review')}</button>`);
    actions.push(`<a class="btn sm ghost" href="#/car/${b.car_id}">${L('ดูรถ', 'View car')}</a>`);
    return `<div class="card booking">
      <div class="car-media">${carImg(b)}</div>
      <div class="lines">
        <div class="title">${esc(b.brand)} ${esc(b.model)} ${badge(STATUS[b.status])}</div>
        <div class="row">${ic('calendar', 14)} ${fmtDate(b.start_date)} ${L('ถึง', 'to')} ${fmtDate(b.end_date)}, ${rentLabel(b)} ${unitLabel(b)}</div>
        <div class="row">${ic('pin', 14)} ${b.pickup_method === 'delivery' ? L('ส่งรถที่ ', 'Delivered to ') + esc(b.delivery_place) : esc(b.location)} ${plate(b.province)}</div>
        <div class="num">${L('ยอดชำระ', 'Paid')} ${baht(b.total)} ${L('รวมมัดจำ', 'incl. deposit')} ${baht(b.deposit)} (${esc(T(DEPOSIT, b.deposit_status))}${b.deposit_deducted ? ` ${L('หัก', 'less')} ${baht(b.deposit_deducted)}` : ''})</div>
        ${b.payment_status === 'refunded' ? `<div>${ic('check', 14)} ${L('คืนเงินเต็มจำนวนแล้ว', 'Fully refunded')}</div>` : ''}
        ${b.return_note ? `<div class="muted">${L('หมายเหตุจากเจ้าของรถ', 'Owner note')}: ${esc(b.return_note)}</div>` : ''}
        ${b.owner_phone ? `<div class="row">${ic('phone', 14)} ${esc(b.owner_name)} <a href="tel:${esc(b.owner_phone)}">${esc(b.owner_phone)}</a></div>` : ''}
        <div class="muted small">${L('รหัสจอง', 'Booking')} ${b.id}</div>
      </div>
      <div class="actions">${actions.join('')}</div>
    </div>`;
  }).join('') : `<div class="empty">${L('ยังไม่มีการจอง', 'No bookings yet.')} <a href="#/search">${L('ค้นหารถ', 'Find a car')}</a></div>`}
  </div>`;

  $$('[data-cancel]').forEach((btn) => btn.addEventListener('click', () => {
    const paid = btn.dataset.paid === '1';
    modal(`<h3>${L('ยกเลิกการจองนี้', 'Cancel this booking?')}</h3><p class="text-2">${paid ? L('ระบบจะคืนเงินทั้งหมด รวมเงินมัดจำ', 'You will be refunded in full, including the deposit.') : L('การจองนี้ยังไม่ได้ชำระเงิน', 'This booking has not been paid.')}</p>
      <div class="row"><button class="btn danger" id="doCancel">${L('ยกเลิกการจอง', 'Cancel booking')}</button><button class="btn ghost" data-close>${L('ไม่ยกเลิก', 'Keep it')}</button></div>`,
    (m, close) => $('#doCancel', m).addEventListener('click', (e) => busy(e.currentTarget, async () => {
      await api(`/bookings/${btn.dataset.cancel}/cancel`, { method: 'POST' });
      close(); toast(paid ? L('ยกเลิกแล้ว คืนเงินเรียบร้อย', 'Cancelled and refunded') : L('ยกเลิกแล้ว', 'Cancelled')); pageMyBookings();
    })));
  }));
  $$('[data-review]').forEach((btn) => btn.addEventListener('click', () => {
    modal(`<h3>${L('รีวิวการเช่ารถ', 'Review your rental')}</h3>
      <div class="star-input" id="starIn">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n}/5">${ic('star', 28)}</button>`).join('')}</div>
      <div class="field mt"><label for="revText">${L('ความคิดเห็น', 'Comment')}</label><textarea id="revText" placeholder="${L('สภาพรถและการบริการของเจ้าของรถ', 'The car and the owner')}"></textarea></div>
      <div class="row"><button class="btn" id="sendReview">${L('ส่งรีวิว', 'Post review')}</button><button class="btn ghost" data-close>${L('ยกเลิก', 'Cancel')}</button></div>`,
    (m, close) => {
      let score = 0;
      $$('#starIn button', m).forEach((s) => s.addEventListener('click', () => {
        score = +s.dataset.n;
        $$('#starIn button', m).forEach((x) => x.classList.toggle('on', +x.dataset.n <= score));
      }));
      $('#sendReview', m).addEventListener('click', (e) => busy(e.currentTarget, async () => {
        await api(`/bookings/${btn.dataset.review}/review`, { method: 'POST', body: { rating: score, comment: $('#revText', m).value } });
        close(); toast(L('ส่งรีวิวแล้ว ขอบคุณ', 'Review posted, thank you')); pageMyBookings();
      }));
    });
  }));
}

// ---------------- host ----------------
async function pageOwner(params) {
  if (!guard('member')) return;
  const tab = params.get('tab') || 'bookings';
  const [{ cars }, { bookings }, s] = await Promise.all([api('/owner/cars'), api('/owner/bookings'), api('/owner/summary')]);
  const tabLink = (k, label) => `<a href="#/owner?tab=${k}" class="${tab === k ? 'active' : ''}">${label}</a>`;
  if (!cars.length) {
    $app.innerHTML = `
    <div class="page-head"><h1>${L('ปล่อยเช่ารถ', 'Host a car')}</h1></div>
    <div class="owner-band">
      <div><h2>${L('มีรถจอดว่างอยู่ ปล่อยเช่าด้วยบัญชีนี้ได้เลย', 'Host your car with this account')}</h2>
      <p>${L(`ลงประกาศฟรี ตั้งราคารายวันและรายเดือนเอง เลือกได้ว่าจะยืนยันการจองทันทีหรือยืนยันเอง ระบบหักค่าธรรมเนียม ${s.commission_rate}% เฉพาะการจองที่สำเร็จ`, `Listing is free. Set daily and monthly prices, and choose instant or manual approval. We take ${s.commission_rate}% only on completed bookings.`)}</p></div>
      <a class="btn light" href="#/owner/car/new">${L('ลงประกาศรถคันแรก', 'List your first car')} ${ic('arrow')}</a>
    </div>`;
    return;
  }
  $app.innerHTML = `
  <div class="page-head"><h1>${L('ปล่อยเช่ารถ', 'Host a car')}</h1><a class="btn" href="#/owner/car/new">${L('ลงประกาศรถ', 'List a car')}</a></div>
  <div class="stats">
    <div class="stat lead"><small>${L('รอคุณยืนยัน', 'Awaiting you')}</small><b>${s.pending}</b></div>
    <div class="stat"><small>${L('กำลังจะมาถึงและกำลังเช่า', 'Upcoming and on rental')}</small><b>${s.upcoming}</b></div>
    <div class="stat"><small>${L('รายได้ที่ได้รับแล้ว', 'Earned')}</small><b>${baht(s.earned)}</b></div>
    <div class="stat"><small>${L('รายได้ที่จะได้รับ', 'Expected')}</small><b>${baht(s.expected)}</b><span class="sub">${L(`หักค่าธรรมเนียม ${s.commission_rate}% แล้ว`, `After the ${s.commission_rate}% fee`)}</span></div>
  </div>
  <p class="muted small mb">${L(`เปิดให้เช่า ${s.active_cars} จาก ${s.cars} คัน`, `${s.active_cars} of ${s.cars} cars listed`)}</p>
  <div class="tabs">${tabLink('bookings', `${L('การจอง', 'Bookings')} ${bookings.length}`)}${tabLink('cars', `${L('รถ', 'Cars')} ${cars.length}`)}</div>
  <div id="tabBody"></div>`;

  const body = $('#tabBody');
  if (tab === 'cars') {
    body.innerHTML = `<div class="card table-wrap" style="padding:8px 16px"><table>
      <tr><th>${L('รถ', 'Car')}</th><th>${L('จุดรับรถ', 'Pick-up')}</th><th class="num">${L('ราคา', 'Price')}</th><th>${L('เงื่อนไข', 'Terms')}</th><th class="num">${L('ทริป', 'Trips')}</th><th>${L('สถานะ', 'Status')}</th><th></th></tr>
      ${cars.map((c) => `<tr>
        <td><b>${esc(c.brand)} ${esc(c.model)}</b><div class="muted small">${c.year || ''} ${esc(T(TYPES, c.type))}</div></td>
        <td>${esc(c.location)}<div style="margin-top:4px">${plate(c.province)}</div></td>
        <td class="num">${baht(c.daily_price)} ${L('ต่อวัน', '/ day')}${c.monthly_price ? `<div class="muted small">${baht(c.monthly_price)} ${L('ต่อเดือน', '/ month')}</div>` : ''}</td>
        <td class="small">${c.instant ? L('ยืนยันทันที', 'Instant') : L('ยืนยันเอง', 'Manual')}<div class="muted">${c.delivery ? `${L('ส่งรถ', 'Delivery')} ${baht(c.delivery_fee)}` : L('ไม่มีส่งรถ', 'No delivery')}</div></td>
        <td class="num">${c.trips}<div class="small">${rating(c)}</div></td>
        <td>${c.active ? `<span class="badge ok">${L('เปิดให้เช่า', 'Listed')}</span>` : `<span class="badge muted">${L('ปิดอยู่', 'Unlisted')}</span>`}</td>
        <td><div class="row" style="flex-wrap:nowrap"><a class="btn sm ghost" href="#/owner/car/${c.id}">${L('แก้ไข', 'Edit')}</a>
          <button class="btn sm ghost" data-toggle="${c.id}">${c.active ? L('ปิด', 'Unlist') : L('เปิด', 'List')}</button></div></td>
      </tr>`).join('')}</table></div>`;
    $$('[data-toggle]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
      const { active } = await api(`/owner/cars/${b.dataset.toggle}/toggle`, { method: 'POST' });
      toast(active ? L('เปิดให้เช่าแล้ว', 'Listed') : L('ปิดการให้เช่าแล้ว', 'Unlisted')); pageOwner(params);
    })));
    return;
  }

  body.innerHTML = bookings.length ? `<div class="stack">${bookings.map((b) => {
    const acts = [];
    if (b.status === 'pending') acts.push(`<button class="btn sm" data-act="approve" data-id="${b.id}">${L('ยืนยันการจอง', 'Confirm')}</button>`, `<button class="btn sm danger" data-act="reject" data-id="${b.id}">${L('ปฏิเสธ', 'Decline')}</button>`);
    if (b.status === 'confirmed') acts.push(`<button class="btn sm" data-act="handover" data-id="${b.id}">${L('ส่งมอบรถแล้ว', 'Handed over')}</button>`);
    if (b.status === 'active') acts.push(`<button class="btn sm" data-return="${b.id}" data-deposit="${b.deposit}">${L('รับรถคืน', 'Car returned')}</button>`);
    return `<div class="card booking">
      <div class="car-media">${carImg(b)}</div>
      <div class="lines">
        <div class="title">${esc(b.brand)} ${esc(b.model)} ${badge(STATUS[b.status])}</div>
        <div class="row">${ic('calendar', 14)} <b style="color:var(--text);font-weight:500">${fmtDate(b.start_date)} ${L('ถึง', 'to')} ${fmtDate(b.end_date)}</b> ${rentLabel(b)} ${unitLabel(b)}</div>
        <div class="row">${ic('shield', 14)} ${esc(b.renter_name)} ${L('ใบขับขี่ยืนยันแล้ว', 'licence verified')}${b.renter_phone ? ` <a href="tel:${esc(b.renter_phone)}">${esc(b.renter_phone)}</a>` : ''}</div>
        <div class="row">${ic(b.pickup_method === 'delivery' ? 'truck' : 'pin', 14)} ${b.pickup_method === 'delivery' ? `${L('ส่งรถที่', 'Deliver to')} ${esc(b.delivery_place)}` : L('ผู้เช่ารับเองที่ ', 'Renter collects at ') + esc(b.location)}</div>
        <div class="num">${L('ค่าเช่า', 'Rental')} ${baht(b.rental_price)}${b.delivery_fee ? ` + ${L('ค่าส่ง', 'delivery')} ${baht(b.delivery_fee)}` : ''} − ${L('ค่าธรรมเนียม', 'fee')} ${baht(b.commission)} <b style="color:var(--text);font-weight:500">${L('รับสุทธิ', 'you receive')} ${baht(b.owner_payout)}</b></div>
        <div class="muted num">${L('มัดจำ', 'Deposit')} ${baht(b.deposit)} ${esc(T(DEPOSIT, b.deposit_status))}${b.deposit_deducted ? ` ${L('หัก', 'less')} ${baht(b.deposit_deducted)}` : ''}</div>
        ${b.return_note ? `<div class="muted">${L('หมายเหตุ', 'Note')}: ${esc(b.return_note)}</div>` : ''}
      </div>
      <div class="actions">${acts.join('')}</div>
    </div>`;
  }).join('')}</div>` : `<div class="empty">${L('ยังไม่มีการจอง', 'No bookings yet')}</div>`;

  $$('[data-act]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    await api(`/owner/bookings/${b.dataset.id}/${b.dataset.act}`, { method: 'POST' });
    toast({ approve: L('ยืนยันการจองแล้ว', 'Booking confirmed'), reject: L('ปฏิเสธแล้ว ระบบคืนเงินให้ผู้เช่า', 'Declined, the renter is refunded'), handover: L('บันทึกการส่งมอบรถแล้ว', 'Handover recorded') }[b.dataset.act]);
    pageOwner(params);
  })));
  $$('[data-return]').forEach((b) => b.addEventListener('click', () => {
    modal(`<h3>${L('รับรถคืน', 'Car returned')}</h3>
      <p class="text-2">${L(`ตรวจสภาพรถแล้ว ถ้ามีความเสียหาย หักจากเงินมัดจำได้ไม่เกิน ${baht(b.dataset.deposit)}`, `If there is damage, you can deduct up to ${baht(b.dataset.deposit)} from the deposit.`)}</p>
      <div class="field"><label for="deduct">${L('หักเงินมัดจำ (บาท) ใส่ 0 ถ้าไม่มีความเสียหาย', 'Deduct from deposit (THB), 0 if none')}</label><input type="number" id="deduct" min="0" max="${b.dataset.deposit}" value="0"></div>
      <div class="field"><label for="retNote">${L('หมายเหตุหรือเหตุผล', 'Note or reason')}</label><textarea id="retNote" placeholder="${L('เช่น รอยขีดข่วนที่ประตูหน้าซ้าย', 'e.g. scratch on the front left door')}"></textarea></div>
      <div class="row"><button class="btn" id="doReturn">${L('ยืนยันรับรถคืน', 'Confirm return')}</button><button class="btn ghost" data-close>${L('ยกเลิก', 'Cancel')}</button></div>`,
    (m, close) => $('#doReturn', m).addEventListener('click', (e) => busy(e.currentTarget, async () => {
      await api(`/owner/bookings/${b.dataset.return}/return`, { method: 'POST', body: { deduct: $('#deduct', m).value, note: $('#retNote', m).value } });
      close(); toast(L('ปิดงานเช่าแล้ว', 'Rental closed')); pageOwner(params);
    })));
  }));
}

async function pageCarForm(params, id) {
  if (!guard('member')) return;
  let c = { type: 'eco', seats: 5, transmission: 'auto', fuel: 'gasoline', instant: true, delivery: false, deposit: 3000, province: '' };
  if (id) ({ car: c } = await api('/cars/' + id));
  if (id && c.owner_id !== me.id) throw new Error(L('คุณไม่ใช่เจ้าของรถคันนี้', 'You are not the owner of this car'));
  $app.innerHTML = `
  <a class="back" href="#/owner?tab=cars">${ic('back')} ${L('กลับ', 'Back')}</a>
  <div class="page-head"><h1>${id ? L('แก้ไขข้อมูลรถ', 'Edit car') : L('ลงประกาศรถ', 'List a car')}</h1></div>
  <form class="card" id="carForm" style="max-width:840px">
    <h3>${L('ข้อมูลรถ', 'The car')}</h3>
    <div class="grid3">
      <div class="field"><label for="c-b">${L('ยี่ห้อ', 'Make')}</label><input id="c-b" type="text" name="brand" value="${esc(c.brand)}" required placeholder="Toyota"></div>
      <div class="field"><label for="c-m">${L('รุ่น', 'Model')}</label><input id="c-m" type="text" name="model" value="${esc(c.model)}" required placeholder="Yaris Ativ"></div>
      <div class="field"><label for="c-y">${L('ปี', 'Year')}</label><input id="c-y" type="number" name="year" value="${esc(c.year)}" min="1990" max="2100"></div>
      <div class="field"><label for="c-t">${L('ประเภท', 'Type')}</label><select id="c-t" name="type">${opts(TYPES, c.type)}</select></div>
      <div class="field"><label for="c-s">${L('ที่นั่ง', 'Seats')}</label><input id="c-s" type="number" name="seats" value="${esc(c.seats)}" min="1" max="15"></div>
      <div class="field"><label for="c-tr">${L('เกียร์', 'Gearbox')}</label><select id="c-tr" name="transmission">${opts(TRANS, c.transmission)}</select></div>
      <div class="field"><label for="c-f">${L('เชื้อเพลิง', 'Fuel')}</label><select id="c-f" name="fuel">${opts(FUELS, c.fuel)}</select></div>
    </div>
    <div class="field"><label for="c-img">${L('รูปรถ JPG หรือ PNG ไม่เกิน 5MB', 'Photo, JPG or PNG up to 5MB')}</label>
      ${c.image ? `<div class="row mb"><img src="/uploads/cars/${esc(c.image)}" alt="" style="height:88px;border-radius:var(--r-control)"><label class="check"><input type="checkbox" name="remove_image" value="1"> ${L('ลบรูปนี้', 'Remove photo')}</label></div>` : ''}
      <input id="c-img" type="file" name="image" accept="image/jpeg,image/png,image/webp"></div>
    <div class="field"><label for="c-d">${L('รายละเอียด', 'Description')}</label><textarea id="c-d" name="description" placeholder="${L('สภาพรถ อุปกรณ์เสริม เงื่อนไขพิเศษ', 'Condition, extras, house rules')}">${esc(c.description)}</textarea></div>
    <hr><h3>${L('จุดรับรถ', 'Pick-up point')}</h3>
    <div class="grid2">
      <div class="field"><label for="c-p">${L('จังหวัด', 'Province')}</label>${provincePicker({ id: 'c-p', value: c.province, allowEmpty: false })}</div>
      <div class="field"><label for="c-l">${L('จุดรับรถ', 'Pick-up point')}</label><input id="c-l" type="text" name="location" value="${esc(c.location)}" required placeholder="${L('เช่น สนามบินเชียงใหม่', 'e.g. Chiang Mai airport')}"></div>
    </div>
    <div class="grid3" style="align-items:end">
      <div class="field"><label for="c-lat">${L('ละติจูด', 'Latitude')}</label><input id="c-lat" type="number" step="any" name="lat" value="${esc(c.lat)}"></div>
      <div class="field"><label for="c-lng">${L('ลองจิจูด', 'Longitude')}</label><input id="c-lng" type="number" step="any" name="lng" value="${esc(c.lng)}"></div>
      <div class="field"><button type="button" class="btn ghost block" id="useGeo">${ic('locate')} ${L('ใช้ตำแหน่งปัจจุบัน', 'Use my location')}</button></div>
    </div>
    <p class="muted small">${L('พิกัดช่วยให้ผู้เช่าเจอรถของคุณเมื่อค้นหารถใกล้ตัว ไม่บังคับ', 'Optional. Coordinates let renters find your car with "near me".')}</p>
    <hr><h3>${L('ราคาและเงื่อนไข', 'Pricing and terms')}</h3>
    <div class="grid3">
      <div class="field"><label for="c-dp">${L('ราคาต่อวัน (บาท)', 'Price per day (THB)')}</label><input id="c-dp" type="number" name="daily_price" value="${esc(c.daily_price)}" min="100" required></div>
      <div class="field"><label for="c-mp">${L('ราคาต่อเดือน ใส่ 0 ถ้าไม่รับ', 'Per month, 0 if not offered')}</label><input id="c-mp" type="number" name="monthly_price" value="${esc(c.monthly_price ?? 0)}" min="0"></div>
      <div class="field"><label for="c-dep">${L('เงินมัดจำ (บาท)', 'Deposit (THB)')}</label><input id="c-dep" type="number" name="deposit" value="${esc(c.deposit)}" min="0"></div>
    </div>
    <label class="check"><input type="checkbox" name="instant" value="1" ${c.instant ? 'checked' : ''}> ${L('ยืนยันการจองอัตโนมัติทันทีที่ผู้เช่าชำระเงิน', 'Instant booking: confirm automatically once the renter pays')}</label>
    <div class="row">
      <label class="check" style="margin:0"><input type="checkbox" name="delivery" value="1" ${c.delivery ? 'checked' : ''}> ${L('ส่งรถถึงสถานีขนส่งหรือสนามบินได้ ค่าบริการ', 'Deliver to airport or terminal, fee')}</label>
      <input type="number" name="delivery_fee" value="${esc(c.delivery_fee ?? 0)}" min="0" style="width:120px" aria-label="${L('ค่าส่งรถ', 'Delivery fee')}"> ${L('บาท', 'THB')}
    </div>
    <div class="msg info mt">${L('ผู้เช่าทุกคนต้องผ่านการตรวจใบขับขี่ก่อนจอง รถที่ปล่อยเช่าควรมีประกันภัยรถยนต์เชิงพาณิชย์', 'Every renter is licence-checked before booking. Hosted cars should carry commercial insurance.')}</div>
    <div class="row mt"><button class="btn">${id ? L('บันทึก', 'Save') : L('ลงประกาศ', 'Publish listing')}</button><a class="btn ghost" href="#/owner?tab=cars">${L('ยกเลิก', 'Cancel')}</a></div>
  </form>`;

  const form = $('#carForm');
  $('#useGeo').addEventListener('click', () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => { form.lat.value = p.coords.latitude.toFixed(5); form.lng.value = p.coords.longitude.toFixed(5); toast(L('ใส่พิกัดแล้ว', 'Location added')); },
      () => toast(L('ระบุตำแหน่งไม่ได้', 'Location unavailable'), 'bad'),
    );
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (!fd.get('province')) { toast(L('กรุณาเลือกจังหวัด', 'Please choose a province'), 'bad'); $('#c-p').focus(); return; }
    if (!fd.get('instant')) fd.set('instant', '0');
    if (!fd.get('delivery')) fd.set('delivery', '0');
    if (!form.image.files.length) fd.delete('image');
    busy(form.querySelector('button.btn:not([type=button])'), async () => {
      await api(id ? `/owner/cars/${id}` : '/owner/cars', { method: id ? 'PUT' : 'POST', form: fd });
      await loadProvinceCounts();
      toast(id ? L('บันทึกแล้ว', 'Saved') : L('ลงประกาศแล้ว', 'Listing published')); go('/owner?tab=cars');
    });
  });
}

// ---------------- admin ----------------
async function pageAdmin(params) {
  if (!guard('admin')) return;
  const tab = params.get('tab') || 'licenses';
  const s = await api('/admin/stats');
  const tabLink = (k, label) => `<a href="#/admin?tab=${k}" class="${tab === k ? 'active' : ''}">${label}</a>`;
  $app.innerHTML = `
  <div class="page-head"><h1>${L('ผู้ดูแลระบบ', 'Admin')}</h1></div>
  <div class="stats">
    <div class="stat lead"><small>${L('รายได้แพลตฟอร์ม', 'Platform revenue')}</small><b>${baht(s.commission)}</b><span class="sub">${L(`ค่าธรรมเนียม ${s.commission_rate}% ของค่าเช่า`, `${s.commission_rate}% of rental value`)}</span></div>
    <div class="stat"><small>${L('มูลค่าการเช่ารวม', 'Rental value')}</small><b>${baht(s.gmv)}</b><span class="sub">${L(`จาก ${s.bookings} การจองที่สำเร็จ`, `From ${s.bookings} bookings`)}</span></div>
    <div class="stat"><small>${L('เงินมัดจำที่ระบบถือไว้', 'Deposits held')}</small><b>${baht(s.deposits_held)}</b></div>
    <div class="stat"><small>${L('ผู้ใช้', 'Users')}</small><b>${s.users}</b><span class="sub">${L(`สมาชิก ${s.members} คน, มีรถปล่อยเช่า ${s.owners} คน, เคยจองรถ ${s.renters} คน`, `${s.members} members, ${s.owners} hosts, ${s.renters} renters`)}</span></div>
  </div>
  <div class="tabs">${tabLink('licenses', `${L('ตรวจใบขับขี่', 'Licence checks')}${s.pending_licenses ? ` <span class="badge warn">${s.pending_licenses}</span>` : ''}`)}${tabLink('bookings', L('การจอง', 'Bookings'))}${tabLink('users', L('ผู้ใช้', 'Users'))}${tabLink('settings', L('ตั้งค่า', 'Settings'))}</div>
  <div id="tabBody"><div class="loading">${L('กำลังโหลด', 'Loading')}</div></div>`;
  const body = $('#tabBody');

  if (tab === 'licenses') {
    const { users } = await api('/admin/users?license=pending');
    body.innerHTML = users.length ? `<div class="stack">${users.map((u) => `<div class="card">
      <div class="row between"><div><b>${esc(u.name)}</b> <span class="muted small">${esc(u.email)}, ${esc(u.phone)}</span></div>${badge(LICENSE[u.license_status])}</div>
      <img class="license-img mt" src="/api/files/license/${u.id}" alt="${esc(u.name)}" data-zoom>
      <div class="row mt"><button class="btn sm" data-lic="${u.id}" data-s="approved">${ic('check', 14)} ${L('อนุมัติ', 'Approve')}</button>
        <input type="text" placeholder="${L('เหตุผลถ้าไม่ผ่าน', 'Reason if rejecting')}" id="note-${u.id}" style="max-width:300px" aria-label="${L('เหตุผล', 'Reason')}">
        <button class="btn sm danger" data-lic="${u.id}" data-s="rejected">${ic('x', 14)} ${L('ไม่ผ่าน', 'Reject')}</button></div>
    </div>`).join('')}</div>` : `<div class="empty">${L('ไม่มีใบขับขี่รอตรวจสอบ', 'No licences waiting')}</div>`;
    $$('[data-zoom]').forEach((img) => img.addEventListener('click', () => modal(`<img src="${img.src}" alt="${esc(img.alt)}" style="width:100%"><button class="btn ghost block mt" data-close>${L('ปิด', 'Close')}</button>`)));
    $$('[data-lic]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
      await api(`/admin/users/${b.dataset.lic}/license`, { method: 'POST', body: { status: b.dataset.s, note: $('#note-' + b.dataset.lic).value } });
      toast(b.dataset.s === 'approved' ? L('อนุมัติแล้ว', 'Approved') : L('บันทึกว่าไม่ผ่านแล้ว', 'Rejected')); pageAdmin(params);
    })));
  } else if (tab === 'bookings') {
    const { bookings } = await api('/admin/bookings');
    body.innerHTML = bookings.length ? `<div class="card table-wrap" style="padding:8px 16px"><table>
      <tr><th class="num">#</th><th>${L('รถ', 'Car')}</th><th>${L('ผู้เช่า', 'Renter')}</th><th>${L('เจ้าของ', 'Host')}</th><th>${L('ช่วงเวลา', 'Dates')}</th><th class="num">${L('ยอดรวม', 'Total')}</th><th class="num">${L('ค่าธรรมเนียม', 'Fee')}</th><th>${L('มัดจำ', 'Deposit')}</th><th>${L('สถานะ', 'Status')}</th></tr>
      ${bookings.map((b) => `<tr><td class="num">${b.id}</td><td>${esc(b.brand)} ${esc(b.model)}<div class="muted small">${esc(provinceName(b.province))}</div></td>
        <td>${esc(b.renter_name)}</td><td>${esc(b.owner_name)}</td>
        <td class="small">${fmtDate(b.start_date)} ${L('ถึง', 'to')} ${fmtDate(b.end_date)}<div class="muted">${rentLabel(b)}</div></td>
        <td class="num">${baht(b.total)}</td><td class="num">${baht(b.commission)}</td><td class="small">${esc(T(DEPOSIT, b.deposit_status))}</td><td>${badge(STATUS[b.status])}</td></tr>`).join('')}
    </table></div>` : `<div class="empty">${L('ยังไม่มีการจอง', 'No bookings yet')}</div>`;
  } else if (tab === 'users') {
    const { users } = await api('/admin/users');
    body.innerHTML = `<div class="card table-wrap" style="padding:8px 16px"><table>
      <tr><th>${L('ชื่อ', 'Name')}</th><th>${L('อีเมล', 'Email')}</th><th>${L('โทร', 'Phone')}</th><th>${L('บทบาท', 'Role')}</th><th>${L('ใบขับขี่', 'Licence')}</th><th>${L('สมัครเมื่อ', 'Joined')}</th></tr>
      ${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td class="num">${esc(u.phone)}</td><td>${esc(T(ROLES, u.role))}</td>
        <td>${u.role === 'admin' ? '-' : badge(LICENSE[u.license_status])}</td><td class="small">${fmtDateTime(u.created_at)}</td></tr>`).join('')}
    </table></div>`;
  } else {
    body.innerHTML = `<form class="card" id="setForm" style="max-width:480px">
      <h3>${L('ค่าธรรมเนียมแพลตฟอร์ม', 'Platform fee')}</h3>
      <div class="field"><label for="s-r">${L('เปอร์เซ็นต์ของค่าเช่าที่หักจากแต่ละการจอง', 'Percent of rental taken per booking')}</label><input id="s-r" type="number" name="commission_rate" min="0" max="50" step="0.5" value="${s.commission_rate}"></div>
      <p class="muted small">${L('ใช้กับการจองใหม่ การจองเดิมยังใช้อัตราเดิม', 'Applies to new bookings only')}</p>
      <button class="btn">${L('บันทึก', 'Save')}</button></form>`;
    const f = $('#setForm');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(f.querySelector('button'), async () => {
        await api('/admin/settings', { method: 'PUT', body: { commission_rate: Number(f.commission_rate.value) } });
        toast(L('บันทึกแล้ว', 'Saved')); pageAdmin(params);
      });
    });
  }
}

async function pageCredits() {
  const { credits } = await api('/credits');
  let site = {};
  try { site = await (await fetch('/img/credits.json')).json(); } catch { /* optional */ }
  const siteLabel = (k) => (k === 'hero' ? L('ภาพหน้าแรก', 'Home banner') : (() => { const r = REGIONS.find((x) => 'region-' + x.id === k); return r ? L(r.th, r.en) : k; })());
  $app.innerHTML = `
  <div class="page-head"><h1>${L('เครดิตรูปภาพ', 'Photo credits')}</h1></div>
  <p class="text-2">${L('รูปรถตัวอย่างในเว็บนี้มาจาก Wikimedia Commons ใช้ตามสัญญาอนุญาตที่ระบุ รูปที่เจ้าของรถอัปโหลดเองไม่อยู่ในรายการนี้', 'Sample car photos come from Wikimedia Commons under the licences shown. Photos uploaded by hosts are not listed.')}</p>
  <div class="card table-wrap" style="padding:8px 16px"><table>
    <tr><th>${L('รถ', 'Car')}</th><th>${L('ไฟล์ต้นฉบับ', 'Source file')}</th><th>${L('ผู้ถ่าย', 'Photographer')}</th><th>${L('สัญญาอนุญาต', 'Licence')}</th></tr>
    ${credits.map((c) => `<tr><td><a href="#/car/${c.id}">${esc(c.brand)} ${esc(c.model)}</a></td>
      <td><a href="${safeUrl(c.image_credit.source)}" target="_blank" rel="noopener">${esc(c.image_credit.title)}</a></td>
      <td>${esc(c.image_credit.author)}</td>
      <td><a href="${safeUrl(c.image_credit.license_url)}" target="_blank" rel="noopener">${esc(c.image_credit.license)}</a></td></tr>`).join('')}
    ${Object.entries(site).map(([k, c]) => `<tr><td>${esc(siteLabel(k))}</td>
      <td><a href="${safeUrl(c.source)}" target="_blank" rel="noopener">${esc(c.title)}</a></td>
      <td>${esc(c.author)}</td>
      <td>${c.license_url ? `<a href="${safeUrl(c.license_url)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}</td></tr>`).join('')}
  </table></div>`;
}

// =====================================================================
// boot
// =====================================================================
(async () => {
  try { ({ user: me } = await api('/me')); } catch { me = null; }
  await loadProvinceCounts();
  router();
})();
