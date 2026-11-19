// ตัวเลือกจังหวัด: ค้นหาได้ทั้งไทย/อังกฤษ, กรองตามภาค, แสดงจำนวนรถ, ใช้คีย์บอร์ดได้
import { REGIONS, PROVINCE_INFO } from './provinces.js';
import { L, getLang } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (d) => `<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I_PIN = svg('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>');
const I_CHEV = svg('<path d="m6 9 6 6 6-6"/>');
const I_SEARCH = svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>');
const I_CHECK = svg('<path d="M20 6 9 17l-5-5"/>');

export const provinceName = (th) => (getLang() === 'en' ? PROVINCE_INFO[th]?.en || th : th);

let counts = {};
export async function loadProvinceCounts() {
  try {
    const r = await fetch('/api/provinces');
    if (r.ok) counts = (await r.json()).counts || {};
  } catch { /* counts are optional */ }
}

export const provinceCounts = () => counts;

const carsLabel = (n) => (n ? L(`${n} คัน`, `${n} ${n === 1 ? 'car' : 'cars'}`) : '');

/** HTML ของตัวเลือกจังหวัด ; ใส่ใน <form> ได้ (มี hidden input ชื่อ name) */
export function provincePicker({ name = 'province', value = '', id, allowEmpty = true, placeholder }) {
  const en = getLang() === 'en';
  const empty = placeholder || (allowEmpty ? L('ทุกจังหวัด', 'All provinces') : L('เลือกจังหวัด', 'Choose a province'));
  const opt = (th) => {
    const info = PROVINCE_INFO[th];
    const n = counts[th] || 0;
    return `<button type="button" class="pp-opt${th === value ? ' is-selected' : ''}" role="option" aria-selected="${th === value}"
      data-v="${esc(th)}" data-s="${esc((th + ' ' + info.en).toLowerCase())}">
      <span class="pp-name">${esc(en ? info.en : th)}<small>${esc(en ? th : info.en)}</small></span>
      <span class="pp-count">${carsLabel(n)}</span><span class="pp-check">${I_CHECK}</span></button>`;
  };
  const popular = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p]) => p).filter((p) => PROVINCE_INFO[p]);
  return `<div class="pp" data-pp data-empty="${esc(empty)}">
    <input type="hidden" name="${esc(name)}" value="${esc(value)}">
    <button type="button" class="pp-trigger${value ? '' : ' is-empty'}" ${id ? `id="${esc(id)}"` : ''} aria-haspopup="listbox" aria-expanded="false">
      ${I_PIN}<span class="pp-value">${esc(value ? provinceName(value) : empty)}</span>${I_CHEV}
    </button>
    <div class="pp-panel" hidden>
      <div class="pp-search">${I_SEARCH}<input type="text" autocomplete="off" placeholder="${L('ค้นหาจังหวัด ไทยหรืออังกฤษ', 'Search in Thai or English')}" aria-label="${L('ค้นหาจังหวัด', 'Search provinces')}"></div>
      ${popular.length ? `<div class="pp-popular"><span>${L('มีรถมากที่สุด', 'Most cars')}</span>${popular.map((p) => `<button type="button" class="pp-chip" data-v="${esc(p)}">${esc(provinceName(p))}</button>`).join('')}</div>` : ''}
      <div class="pp-regions" role="tablist">
        <button type="button" class="pp-region is-on" data-r="">${L('ทุกภาค', 'All regions')}</button>
        ${REGIONS.map((r) => `<button type="button" class="pp-region" data-r="${r.id}">${en ? r.en : r.th}</button>`).join('')}
      </div>
      <div class="pp-list" role="listbox" tabindex="-1">
        ${allowEmpty ? `<button type="button" class="pp-opt pp-any${value ? '' : ' is-selected'}" role="option" data-v="" data-s=""><span class="pp-name">${esc(empty)}</span><span class="pp-count"></span><span class="pp-check">${I_CHECK}</span></button>` : ''}
        ${REGIONS.map((r) => `<div class="pp-group" data-region="${r.id}"><div class="pp-group-title">${en ? r.en : r.th}</div>${r.list.map(([th]) => opt(th)).join('')}</div>`).join('')}
        <p class="pp-none" hidden>${L('ไม่พบจังหวัดนี้', 'No matching province')}</p>
      </div>
    </div>
  </div>`;
}

/** ผูกการทำงานให้ทุกตัวเลือกจังหวัดใน root */
export function mountProvincePickers(root = document) {
  root.querySelectorAll('[data-pp]').forEach((pp) => {
    if (pp.dataset.mounted) return;
    pp.dataset.mounted = '1';
    const hidden = pp.querySelector('input[type=hidden]');
    const trigger = pp.querySelector('.pp-trigger');
    const panel = pp.querySelector('.pp-panel');
    const search = pp.querySelector('.pp-search input');
    const list = pp.querySelector('.pp-list');
    let region = '';
    let active = -1;

    const visibleOpts = () => [...list.querySelectorAll('.pp-opt')].filter((o) => !o.hidden && !o.closest('.pp-group')?.hidden);
    const setActive = (i) => {
      const opts = visibleOpts();
      opts.forEach((o) => o.classList.remove('is-active'));
      active = Math.max(0, Math.min(i, opts.length - 1));
      const o = opts[active];
      if (o) { o.classList.add('is-active'); o.scrollIntoView({ block: 'nearest' }); }
    };
    const filter = () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll('.pp-group').forEach((g) => {
        let any = false;
        g.querySelectorAll('.pp-opt').forEach((o) => {
          const show = (!q || o.dataset.s.includes(q)) && (!region || g.dataset.region === region);
          o.hidden = !show;
          any ||= show;
        });
        g.hidden = !any;
      });
      const anyOpt = list.querySelector('.pp-any');
      if (anyOpt) anyOpt.hidden = !!q || !!region;
      list.querySelector('.pp-none').hidden = visibleOpts().length > 0;
      active = -1;
    };
    const open = () => {
      document.querySelectorAll('[data-pp] .pp-panel:not([hidden])').forEach((p) => { if (p !== panel) p.closest('[data-pp]').close(); });
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      search.value = ''; filter();
      const sel = list.querySelector('.pp-opt.is-selected');
      sel?.scrollIntoView({ block: 'center' });
      search.focus();
    };
    const close = (focusTrigger) => {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (focusTrigger) trigger.focus();
    };
    pp.close = close;
    const choose = (v) => {
      hidden.value = v;
      pp.querySelector('.pp-value').textContent = v ? provinceName(v) : pp.dataset.empty;
      trigger.classList.toggle('is-empty', !v);
      list.querySelectorAll('.pp-opt').forEach((o) => {
        const on = o.dataset.v === v;
        o.classList.toggle('is-selected', on);
        o.setAttribute('aria-selected', String(on));
      });
      close(true);
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    };

    trigger.addEventListener('click', () => (panel.hidden ? open() : close()));
    search.addEventListener('input', filter);
    pp.querySelectorAll('.pp-region').forEach((b) => b.addEventListener('click', () => {
      region = b.dataset.r;
      pp.querySelectorAll('.pp-region').forEach((x) => x.classList.toggle('is-on', x === b));
      filter(); search.focus();
    }));
    pp.querySelectorAll('.pp-chip').forEach((c) => c.addEventListener('click', () => choose(c.dataset.v)));
    list.addEventListener('click', (e) => { const o = e.target.closest('.pp-opt'); if (o) choose(o.dataset.v); });
    pp.addEventListener('keydown', (e) => {
      if (panel.hidden) {
        if (e.key === 'ArrowDown' && e.target === trigger) { e.preventDefault(); open(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter' && e.target === search) {
        e.preventDefault();
        const o = visibleOpts()[active >= 0 ? active : 0];
        if (o) choose(o.dataset.v);
      }
    });
    document.addEventListener('click', (e) => { if (!panel.hidden && !pp.contains(e.target)) close(); });
  });
}
