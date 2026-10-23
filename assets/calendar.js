/* Gram Hisab — 📅 Nepali calendar (पात्रो)
   1) A month view (header 📅): BS days in Devanagari with the AD date small, Saturdays in red, today ringed,
      dots for days that have Kheti / poultry / shop entries, month totals; tap a day to see everything on it.
   2) A tap-to-pick calendar under every date field (the 📅 button next to the day / month / year boxes).
   3) AD ⇄ BS date converter. */
'use strict';

const NE_DIGITS = '०१२३४५६७८९';
const neNum = n => String(n).replace(/\d/g, d => NE_DIGITS[d]);
const WEEK_NE = ['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि'];
const AD_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const POULTRY_KINDS = ['sale', 'grainsale', 'purchase', 'event'];
const weekday = ad => new Date(ad + 'T12:00:00').getDay();
let calYM = null, calScroll = 0, calScrollYM = '';
function calTile(big) { const b = adToBs(today()); return `<span class="caltile${big ? ' big' : ''}"><i>${BS_MONTHS_NE[b.m - 1]}</i><b>${neNum(b.d)}</b></span>`; }

// money spent on Kheti by one record (wages, machine + fuel, seed / fertilizer)
function khetiCostOf(r) {
  if (r.kind === 'fwork') return typeof fworkAmount === 'function' ? fworkAmount(r) : Number(r.amount) || 0;
  if (r.kind === 'machine') return (Number(r.hireAmount) || 0) + (Number(r.fuelCost) || 0);
  if (r.kind === 'finput') return Number(r.cost) || 0;
  return 0;
}
// what happened on each day of a BS month: { adDate: {kheti, poultry, shop} } plus month totals
function monthMarks(y, m) {
  const from = bsToAd(y, m, 1), to = bsToAd(y, m, bsDays(y, m));
  const marks = {}, tot = { sales: 0, kheti: 0, shop: 0, bought: 0 };
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r) || !r.date || r.date < from || r.date > to || r.kind === 'audit' || r.kind === 'setting') continue;
    const k = marks[r.date] || (marks[r.date] = {});
    if (typeof KHETI_KINDS !== 'undefined' && KHETI_KINDS.includes(r.kind)) { k.kheti = 1; tot.kheti += khetiCostOf(r); }
    else if (POULTRY_KINDS.includes(r.kind)) { k.poultry = 1; if (r.kind === 'sale' || r.kind === 'grainsale') tot.sales += Number(r.amount) || 0; if (r.kind === 'purchase') tot.bought += Number(r.amount) || 0; }
    else if (r.kind === 'shop') { k.shop = 1; tot.shop += (Number(r.cash) || 0) + (Number(r.qr) || 0); }
  }
  return { marks, tot };
}
function adRangeLabel(y, m) {
  const a = bsToAd(y, m, 1).split('-').map(Number), b = bsToAd(y, m, bsDays(y, m)).split('-').map(Number);
  return a[0] === b[0] ? `${AD_MON[a[1] - 1]}/${AD_MON[b[1] - 1]} ${a[0]}` : `${AD_MON[a[1] - 1]} ${a[0]} / ${AD_MON[b[1] - 1]} ${b[0]}`;
}
function shiftMonth(y, m, n) { m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return [Math.min(BS_LAST_YEAR, Math.max(BS_FIRST_YEAR, y)), m]; }

// the grid used by both the month view and the date picker
function calGridHtml(y, m, o) {
  const first = bsToAd(y, m, 1), n = bsDays(y, m), t = today(), marks = o.marks || {};
  let cells = '';
  for (let i = 0; i < weekday(first); i++) cells += '<span class="cal-e"></span>';
  for (let d = 1; d <= n; d++) {
    const ad = addDays(first, d - 1), mk = marks[ad] || {}, wd = weekday(ad);
    const p = o.marks ? panchang(ad) : null, notes = o.marks ? calNotes(ad) : [];
    const hol = p && (p.holiday || notes.some(x => x.holiday)), fest = p && (p.fests.length || notes.length);
    const cls = ['cal-d', o.marks ? 'pan' : '', ad === t ? 'today' : '', ad === o.selected ? 'sel' : '', wd === 6 ? 'sat' : '', hol ? 'hol' : '', o.maxDate && ad > o.maxDate ? 'off' : ''].filter(Boolean).join(' ');
    cells += `<button class="${cls}" data-act="${o.act}" data-d="${ad}"${o.key ? ` data-key="${o.key}"` : ''}>${fest ? '<s></s>' : ''}<b>${neNum(d)}</b><small>${ad === t ? 'आज' : Number(ad.slice(8))}</small>${p ? `<em>${p.moon || p.short}</em>` : ''}${o.marks ? `<i>${mk.kheti ? '<u class="dk"></u>' : ''}${mk.poultry ? '<u class="dp"></u>' : ''}${mk.shop ? '<u class="ds"></u>' : ''}</i>` : ''}</button>`;
  }
  return `<div class="cal-grid">${WEEK_NE.map((w, i) => `<span class="cal-h${i === 6 ? ' sat' : ''}">${w}</span>`).join('')}${cells}</div>`;
}

// ---------- 1) month view ----------
function openCalendar(ad) {
  const b = adToBs(ad || today());
  calYM = [b.y, b.m];
  renderCalendar();
}
function renderCalendar() {
  const [y, m] = calYM, { marks, tot } = monthMarks(y, m), tb = adToBs(today());
  const [py, pm] = shiftMonth(y, m, -1), [ny, nm] = shiftMonth(y, m, 1);
  openSheet(`<div class="row between" style="align-items:center">
      <button class="btn sm ghost" data-act="calNav" data-y="${py}" data-m="${pm}">‹ ${BS_MONTHS_NE[pm - 1]}</button>
      <div style="text-align:center"><div style="font-size:24px;font-weight:900">${BS_MONTHS_NE[m - 1]} ${neNum(y)}</div><div class="small muted">${BS_MONTHS[m - 1]} ${y} · ${adRangeLabel(y, m)}</div></div>
      <button class="btn sm ghost" data-act="calNav" data-y="${ny}" data-m="${nm}">${BS_MONTHS_NE[nm - 1]} ›</button></div>
    ${calGridHtml(y, m, { act: 'calDay', marks })}
    <div class="cal-legend small muted"><span><u class="dk"></u> Kheti</span><span><u class="dp"></u> Poultry</span><span><u class="ds"></u> Shop</span><span><b style="color:var(--red)">रातो</b> = बिदा</span>${y !== tb.y || m !== tb.m ? `<button class="chip sm" data-act="calNav" data-y="${tb.y}" data-m="${tb.m}">Today</button>` : ''}</div>
    ${monthFestHtml(y, m)}
    <div class="summary small">
      ${tot.kheti ? `<div class="line"><span>🌾 Kheti spent</span><b style="color:var(--red)">${money(tot.kheti)}</b></div>` : ''}
      ${tot.sales ? `<div class="line"><span>🐔 Poultry sales</span><b style="color:var(--green)">${money(tot.sales)}</b></div>` : ''}
      ${tot.bought ? `<div class="line"><span>🛒 Poultry bought</span><b style="color:var(--red)">${money(tot.bought)}</b></div>` : ''}
      ${tot.shop ? `<div class="line"><span>🏪 Shop collected</span><b style="color:var(--green)">${money(tot.shop)}</b></div>` : ''}
      ${tot.kheti || tot.sales || tot.bought || tot.shop ? '' : '<div class="line"><span class="muted">Nothing recorded this month</span></div>'}
    </div>
    <p class="small muted">Tap a day for its tithi, festivals, sunrise and everything recorded on it. Tithi and festivals are calculated (sunrise in Kathmandu); the government's official holiday list can differ by a day — add your own note or holiday on any day.</p>
    <h3>🔁 Date converter</h3>
    <div class="grid2" id="calConv">
      <div class="field"><label>English date (AD)</label><input type="date" data-calconv="ad" value="${today()}" min="1943-04-14" max="${bsToAd(BS_LAST_YEAR, 12, bsDays(BS_LAST_YEAR, 12))}"></div>
      <div class="field"><label>नेपाली (BS)</label><div class="convout" id="calConvOut">${convText(today())}</div></div>
    </div>
    <button class="btn big primary" data-act="closeSheet">Close</button>`);
}
function convText(ad) {
  const b = ad && adToBs(ad);
  if (!b) return '—';
  return `<b>${BS_MONTHS_NE[b.m - 1]} ${neNum(b.d)}, ${neNum(b.y)}</b><br><span class="small muted">${BS_MONTHS[b.m - 1]} ${b.d}, ${b.y} · ${WEEK_NE[weekday(ad)]}बार</span>`;
}

// the day sheet (ui.js openDay) calls this to add the Kheti part
function dayKhetiHtml(date) {
  if (typeof KHETI_KINDS === 'undefined') return { line: '', list: '' };
  const recs = Object.values(db.records).filter(r => !hidden(r) && r.date === date && KHETI_KINDS.includes(r.kind) && r.kind !== 'worker' && r.kind !== 'field')
    .sort((a, b) => a.createdAt - b.createdAt);
  if (!recs.length) return { line: '', list: '' };
  const spent = recs.reduce((a, r) => a + khetiCostOf(r), 0);
  return { line: `<div class="line"><span>🌾 Kheti (${recs.length} ${recs.length > 1 ? 'entries' : 'entry'})</span><b style="color:var(--red)">${spent ? money(spent) + ' spent' : ''}</b></div>`, list: `<h3>🌾 Kheti</h3>${recs.map(kItemHtml).join('')}` };
}

// ---------- 2) tap-to-pick calendar under a date field ----------
function bsCalToggle(key) {
  const box = document.querySelector(`[data-bscalbox="${key}"]`), wrap = document.querySelector(`[data-bsdate="${key}"]`);
  if (!box || !wrap) return;
  if (box.innerHTML) { box.innerHTML = ''; return; }
  const ad = readBsDate(wrap), b = adToBs(ad);
  box.innerHTML = bsCalPickHtml(key, b.y, b.m, ad);
}
function bsCalPickHtml(key, y, m, selected) {
  const [py, pm] = shiftMonth(y, m, -1), [ny, nm] = shiftMonth(y, m, 1);
  return `<div class="cal-pick"><div class="row between" style="align-items:center;margin-bottom:6px">
      <button class="chip sm" data-act="bsCalNav" data-key="${key}" data-y="${py}" data-m="${pm}">‹</button>
      <b>${BS_MONTHS_NE[m - 1]} ${neNum(y)} <span class="small muted">· ${adRangeLabel(y, m)}</span></b>
      <button class="chip sm" data-act="bsCalNav" data-key="${key}" data-y="${ny}" data-m="${nm}">›</button></div>
    ${calGridHtml(y, m, { act: 'bsCalPick', key, selected })}</div>`;
}
// put a date into a field's day / month / year boxes (and the form behind it)
function bsSetDate(key, ad) {
  const wrap = document.querySelector(`[data-bsdate="${key}"]`);
  if (!wrap) return;
  const b = adToBs(ad), ys = wrap.querySelector('[data-bsp=y]');
  if (![...ys.options].some(o => Number(o.value) === b.y)) { ys.add(new Option(b.y, b.y)); [...ys.options].sort((p, q) => p.value - q.value).forEach(o => ys.appendChild(o)); }
  ys.value = b.y;
  wrap.querySelector('[data-bsp=m]').value = b.m;
  bsDateChanged(wrap.querySelector('[data-bsp=m]'));
  wrap.querySelector('[data-bsp=d]').value = b.d;
  bsDateChanged(wrap.querySelector('[data-bsp=d]'));
}

function calendarClick(act, b) {
  switch (act) {
    case 'openCalendar': openCalendar(b.dataset.d); return true;
    case 'calNav': calYM = [Number(b.dataset.y), Number(b.dataset.m)]; renderCalendar(); return true;
    case 'calDay': if ($('#sheet .cal-grid') && !$('#sheet .panday')) { calScroll = $('#sheet').scrollTop; calScrollYM = calYM.join('-'); } openDay(b.dataset.d, null, true); return true;
    case 'calAddNote': addCalNote(b.dataset.d); return true;
    case 'calDelNote': deleteRec(b.dataset.id, () => openDay(b.dataset.d, null, true)); return true;
    case 'bsCalToggle': bsCalToggle(b.dataset.key); return true;
    case 'bsCalNav': {
      const box = document.querySelector(`[data-bscalbox="${b.dataset.key}"]`), wrap = document.querySelector(`[data-bsdate="${b.dataset.key}"]`);
      if (box) box.innerHTML = bsCalPickHtml(b.dataset.key, Number(b.dataset.y), Number(b.dataset.m), wrap ? readBsDate(wrap) : '');
      return true;
    }
    case 'bsCalPick': {
      const box = document.querySelector(`[data-bscalbox="${b.dataset.key}"]`);
      bsSetDate(b.dataset.key, b.dataset.d);
      if (box) box.innerHTML = '';
      return true;
    }
  }
  return false;
}
document.addEventListener('input', e => {
  if (e.target.dataset.calconv) { const o = document.getElementById('calConvOut'); if (o) o.innerHTML = convText(e.target.value); }
});

// ---------- tithi, festivals, holidays and the user's own notes ----------
function calNotes(ad) { return all('calnote').filter(r => r.date === ad).sort((a, b) => a.createdAt - b.createdAt); }
const festBadge = f => f.holiday ? `<span class="pill red">सार्वजनिक बिदा${f.approx ? ' (अनुमानित)' : ''}</span>` : f.who ? `<span class="pill">बिदा: ${esc(f.who)}</span>` : '';
function monthFestHtml(y, m) {
  const first = bsToAd(y, m, 1), rows = [];
  for (let d = 1; d <= bsDays(y, m); d++) {
    const ad = addDays(first, d - 1), p = panchang(ad), notes = calNotes(ad);
    if (!p.fests.length && !notes.length) continue;
    const hol = p.holiday || notes.some(x => x.holiday);
    rows.push(`<div class="line" data-act="calDay" data-d="${ad}" style="cursor:pointer;align-items:flex-start">
      <span style="min-width:0"><b style="color:${hol ? 'var(--red)' : 'inherit'}">${neNum(d)} ${BS_MONTHS_NE[m - 1]}</b> <span class="muted">· ${WEEK_NE[weekday(ad)]}</span><br>
      ${p.fests.map(f => `${esc(f.ne)}${f.approx ? ' <span class="muted">(अनुमानित)</span>' : ''}`).concat(notes.map(x => '📝 ' + esc(x.text))).join('<br>')}</span>
      <span style="text-align:right;white-space:nowrap">${hol ? '<span class="pill red">बिदा</span>' : ''} ›</span></div>`);
  }
  return rows.length ? `<h3 style="margin-top:4px">🎉 पर्व र बिदा</h3><div class="summary small">${rows.join('')}</div>` : '';
}
// the top of a day's sheet: tithi, sunrise / sunset, festivals, holidays and notes
function dayPanchangHtml(ad) {
  const p = panchang(ad), notes = calNotes(ad);
  return `<div class="card tight panday${p.holiday || notes.some(x => x.holiday) ? ' hol' : ''}">
    <div style="font-size:20px;font-weight:900">${p.moon ? p.moon + ' ' : ''}${esc(p.name)}</div>
    ${(() => { const end = tithiEnd(p.rise + 6e4), nx = p.tithi % 30 + 1, sameDay = end < p.rise + 864e5;
      return `<div class="small">${tithiName(p.tithi)} ${sameDay ? fmtNpt(end) + ' सम्म, त्यसपछि ' + tithiName(nx) : 'भोलि सूर्योदयसम्म रहन्छ'}</div>`; })()}
    <div class="small muted" style="margin-top:2px">🌅 सूर्योदय ${fmtNpt(p.rise)} · 🌇 सूर्यास्त ${fmtNpt(p.set)} <span style="font-size:11px">(काठमाडौं)</span></div>
    ${p.fests.map(f => `<div style="margin-top:8px"><b style="font-size:17px">🎉 ${esc(f.ne)}</b> <span class="small muted">${esc(f.en)}</span><br>${festBadge(f)}${f.approx ? ' <span class="small muted">चन्द्र दर्शन अनुसार एक दिन फरक पर्न सक्छ</span>' : ''}</div>`).join('')}
    ${notes.map(x => `<div class="row between" style="margin-top:8px;gap:8px"><span>📝 <b>${esc(x.text)}</b> ${x.holiday ? '<span class="pill red">बिदा</span>' : ''}<br><span class="small muted">${whoWhen(x)}</span></span>
      <button class="btn sm redl" data-act="calDelNote" data-id="${x.id}" data-d="${ad}">🗑</button></div>`).join('')}
    <button class="btn sm ghost" style="margin-top:10px" data-act="calAddNote" data-d="${ad}">+ Add note / holiday</button>
  </div>`;
}
function addCalNote(ad) {
  ask({ title: `📝 ${fmtDate(ad, true)}`, sub: 'Festival, holiday, puja, a reminder… (shared with all your phones)', input: { text: true, placeholder: 'e.g. Kul puja, school holiday' },
    onAnswer: text => {
      ask({ title: `Is “${text}” a holiday (बिदा)?`, buttons: [{ label: 'Yes, holiday', value: 'yes', cls: 'red' }, { label: 'No, just a note', value: 'no', cls: 'ghost' }],
        onAnswer: a => { put({ kind: 'calnote', date: ad, text: String(text).trim(), holiday: a === 'yes' }); openDay(ad, null, true); toast('Saved ✓'); } });
    }, onCancel: () => openDay(ad, null, true) });
}
