/* Gram Hisab — ⚙️ मिल (mill): कुटानी (धान → चामल) and पिसानी (मकै, गहुँ, कोदो → पिठो) for customers and for home.
   kinds: mill     {date, item, qty, unit (pathi | mana | muri), pathi, rate, amount, pay (cash | qr), customer, own, note}
          millcost {date, type: 'electricity' | 'other', amount, units, note}
   Rates are per pathi for each item (synced setting 'millItems'). Servicing of the mill uses 🚜 My machines (type 'mill'). */
'use strict';

const MILL_ITEMS_DEFAULT = [
  { id: 'dhan_kutani', ne: 'धान कुटानी', en: 'Dhan → chamal', work: 'kutani', rate: 0 },
  { id: 'makai_pisani', ne: 'मकै पिसानी', en: 'Makai → pitho', work: 'pisani', rate: 0 },
  { id: 'gahun_pisani', ne: 'गहुँ पिसानी', en: 'Gahun → pitho', work: 'pisani', rate: 0 },
  { id: 'kodo_pisani', ne: 'कोदो पिसानी', en: 'Kodo → pitho', work: 'pisani', rate: 0 }
];
const MILL_UNITS = { pathi: { ne: 'पाथी', toPathi: 1 }, mana: { ne: 'माना', toPathi: 1 / 8 }, muri: { ne: 'मुरी', toPathi: 20 } };
function millItems() { const l = getSet('millItems'); return Array.isArray(l) && l.length ? l : MILL_ITEMS_DEFAULT; }
function millItem(id) { return millItems().find(x => x.id === id) || { id, ne: id, en: id, rate: 0 }; }
function millRate(id) { return Number(millItem(id).rate) || 0; }
function setMillRate(id, rate) { setSet('millItems', millItems().map(x => x.id === id ? Object.assign({}, x, { rate: Number(rate) || 0 }) : x)); }

// totals for a date range
function millRange(from, to) {
  const o = { n: 0, days: 0, cash: 0, qr: 0, total: 0, pathi: 0, ownPathi: 0, byItem: {}, electricity: 0, otherCost: 0, service: 0 };
  const days = new Set();
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r) || !r.date || r.date < from || r.date > to) continue;
    if (r.kind === 'mill') {
      o.n++; days.add(r.date);
      const p = Number(r.pathi) || 0, a = r.own ? 0 : Number(r.amount) || 0;
      if (r.own) o.ownPathi += p; else { o.pathi += p; if (r.pay === 'qr') o.qr += a; else o.cash += a; }
      const b = o.byItem[r.item] || (o.byItem[r.item] = { pathi: 0, own: 0, amount: 0 });
      if (r.own) b.own += p; else { b.pathi += p; b.amount += a; }
    } else if (r.kind === 'millcost') { if (r.type === 'electricity') o.electricity += Number(r.amount) || 0; else o.otherCost += Number(r.amount) || 0; }
    else if (r.kind === 'mservice') { const m = typeof myMachineById === 'function' && myMachineById(r.machineId); if (m && m.type === 'mill') o.service += serviceTotal(r); }
  }
  o.total = o.cash + o.qr; o.days = days.size;
  o.cost = o.electricity + o.otherCost + o.service; o.profit = o.total - o.cost;
  return o;
}
const millMachines = () => (typeof myMachines === 'function' ? myMachines().filter(m => m.type === 'mill') : []);

// ---------- ⚙️ Mill home ----------
let millDraft = null, millDateOpen = false;
function newMillDraft(keep) {
  const k = keep || {};
  return { kind: 'mill', date: k.date || today(), item: k.item || (db.meta.millLast && !millItem(db.meta.millLast).hidden ? db.meta.millLast : shown(millItems())[0].id), qty: '', unit: 'pathi', amount: '', pay: k.pay || 'cash', customer: '', own: false, note: '' };
}
function millCalc(d) {
  const pathi = (num(d.qty) || 0) * MILL_UNITS[d.unit || 'pathi'].toPathi, rate = millRate(d.item);
  const amount = d.own ? 0 : (num(d.amount) != null ? num(d.amount) : round(pathi * rate, 2));
  return { pathi, rate, amount };
}
function renderMill() {
  if (!millDraft) millDraft = newMillDraft();
  const d = millDraft, t = today(), y = addDays(t, -1), td = millRange(t, t), c = millCalc(d);
  const wk = millRange(weekStart(t), t), mo = millRange(bsMonthStart(t), t), yy = millRange(y, y);
  const list = all('mill').filter(r => r.date === d.date).sort((a, b) => b.createdAt - a.createdAt);
  const custs = Array.from(new Set(all('mill').map(r => r.customer).filter(Boolean))).sort();
  const mini = (o, label, from, to) => `<button class="card tight shopmini" data-act="millRange" data-from="${from}" data-to="${to}" data-label="${esc(label)}">
      <div class="label">${esc(label)}</div><div class="v">${money(o.total)}</div><div class="small muted">${nfmt(round(o.pathi, 2))} पाथी ›</div></button>`;
  const noRate = !c.rate && !d.own;
  $('#v-mill').innerHTML = `
    <h2 style="margin:2px 0 8px">⚙️ मिल · Mill</h2>
    <div class="card today tight shoptoday" style="background:linear-gradient(135deg,#6D28D9,#4C1D95)">
      <div class="row between" style="align-items:flex-end;gap:8px">
        <div><div class="label">Today's income</div><div style="font-size:30px;font-weight:900;line-height:1.1">${money(td.total)}</div></div>
        <div class="small" style="text-align:right;line-height:1.35">💵 ${money(td.cash)} · 📱 ${money(td.qr)}<br>${nfmt(round(td.pathi, 2))} पाथी${td.ownPathi ? ' · 🏠 ' + nfmt(round(td.ownPathi, 2)) : ''}</div></div>
    </div>
    <div class="card tight" id="millForm">
      <div class="row between" style="gap:6px;flex-wrap:wrap">
        <b>${d.id ? '✎ Edit' : '➕ Add'} · ${d.date === t ? 'आज Today' : esc(fmtDate(d.date))}</b>
        <span class="chips" style="gap:4px">
          <button class="chip sm ${d.date === t ? 'on' : ''}" data-act="bsQuick" data-key="mill" data-days="0">Today</button>
          <button class="chip sm ${d.date === y ? 'on' : ''}" data-act="bsQuick" data-key="mill" data-days="-1">Yesterday</button>
          <button class="chip sm ${d.date !== t && d.date !== y ? 'on' : ''}" data-act="millDatePick" aria-label="Other date">${calTile()}</button></span></div>
      <div id="millDateBox" class="${millDateOpen ? '' : 'hidden'}" style="margin-top:6px">${bsDateHtml('mill', d.date)}</div>
      <div class="chips" style="margin:8px 0">${millItems().filter(x => !x.hidden || x.id === d.item).map(x => `<button class="chip ${d.item === x.id ? 'on' : ''}" data-act="millItem" data-v="${x.id}">${esc(x.ne)}${x.rate ? ` <span style="opacity:.75;font-size:12px">${nfmt(x.rate)}</span>` : ''}</button>`).join('')}</div>
      <div class="row" style="gap:4px;align-items:center"><span class="small muted">Unit</span>${Object.keys(MILL_UNITS).map(u => `<button class="chip sm ${d.unit === u ? 'on' : ''}" data-act="millUnit" data-v="${u}" style="padding:3px 10px">${MILL_UNITS[u].ne}</button>`).join('')}</div>
      <div class="hshop millboxes">
        <label><span>Quantity (${MILL_UNITS[d.unit].ne})</span>
          <input data-ml="qty" type="number" inputmode="decimal" step="any" value="${esc(d.qty)}" placeholder="0"></label>
        <label><span>💰 Rs ${d.own ? '(free)' : `<span class="muted">· ${c.rate ? nfmt(c.rate) + '/पाथी' : 'set rate'}</span>`}</span><input data-ml="amount" ${calcAttrs()} value="${esc(d.amount)}" placeholder="${d.own ? '0' : round(c.amount)}" ${d.own ? 'disabled' : ''}></label>
      </div>
      <div class="chips" style="gap:4px;margin-top:8px">
        <button class="chip sm ${!d.own && d.pay !== 'qr' ? 'on' : ''}" data-act="millPay" data-v="cash">💵 Cash</button>
        <button class="chip sm ${!d.own && d.pay === 'qr' ? 'on' : ''}" data-act="millPay" data-v="qr">📱 QR</button>
        <button class="chip sm ${d.own ? 'on' : ''}" data-act="millOwn">🏠 Own (free)</button></div>
      <div class="row" style="gap:6px;margin-top:8px"><input data-ml="customer" list="millCusts" value="${esc(d.customer || '')}" placeholder="Customer (optional)" autocomplete="off" style="flex:1;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px;font-size:16px;font-weight:700">
        <datalist id="millCusts">${custs.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <button class="btn green" data-act="millSave" style="padding:12px 18px;flex:none">✔ ${d.id ? 'Update' : 'Save'}</button></div>
      <div class="small muted" id="millHint" style="margin-top:6px">${esc(millHint(d))}</div>
      ${noRate ? `<div class="small" style="margin-top:4px;color:var(--red)">Set the rate for ${esc(millItem(d.item).ne)} — <a href="#" data-act="millRates">⚙️ Rates</a></div>` : ''}
      ${d.id ? `<div class="btnrow" style="margin-top:8px"><button class="btn sm ghost" data-act="millCancel">Cancel</button><button class="btn sm redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button></div>${historyHtml(d.id)}` : ''}
    </div>
    <div class="grid3" style="margin-bottom:10px">${mini(yy, 'Yesterday', y, y)}${mini(wk, 'This week', weekStart(t), t)}${mini(mo, BS_MONTHS[adToBs(t).m - 1], bsMonthStart(t), t)}</div>
    <div class="grid3" style="margin-bottom:12px">
      <button class="btn" data-act="millBill">⚡ Bill</button><button class="btn" data-act="millService">🔧 Servicing</button><button class="btn" data-act="millRates">⚙️ Rates</button></div>
    <h3>${d.date === t ? 'Today' : esc(fmtDate(d.date, true))} (${list.length})</h3>
    ${list.length ? list.map(millItemHtml).join('') : '<p class="muted">No entries yet.</p>'}
    <p class="small muted" style="text-align:center">🎤 “dhan 5 pathi kutani” · “makai 3 pathi pisani qr” · “गहुँ २ पाथी पिसानी”</p>`;
}
function millHint(d) {
  const c = millCalc(d);
  if (!c.pathi) return `${millItem(d.item).ne}: ${c.rate ? money(c.rate) + ' per पाथी' : 'no rate yet'}`;
  return `${nfmt(round(c.pathi, 3))} पाथी${d.unit !== 'pathi' ? ' (' + nfmt(num(d.qty)) + ' ' + MILL_UNITS[d.unit].ne + ')' : ''} × ${money(c.rate)} = ${d.own ? 'free (own)' : money(round(c.pathi * c.rate, 2))}${!d.own && num(d.amount) != null ? ' · you typed ' + money(num(d.amount)) : ''}`;
}
function millItemHtml(r) {
  const it = millItem(r.item);
  return `<button class="item" data-act="millEdit" data-id="${r.id}"><div class="ic" style="background:#EDE9FE">⚙️</div>
    <div class="mid"><div class="t">${esc(it.ne)} · ${nfmt(r.qty)} ${MILL_UNITS[r.unit || 'pathi'].ne}${r.customer ? ' · ' + esc(r.customer) : ''}</div>
    <div class="s">${r.own ? '🏠 own · free' : (r.pay === 'qr' ? '📱 QR' : '💵 Cash')} · ${whoWhen(r)}</div></div><div class="amt">${r.own ? '—' : money(r.amount)}</div></button>`;
}
function saveMill() {
  $$('#millForm [data-ml]').forEach(el => { millDraft[el.dataset.ml] = el.value; });
  const d = millDraft, c = millCalc(d);
  if (!c.pathi) { toast('Type how many pathi'); return; }
  const rec = { kind: 'mill', date: d.date || today(), item: d.item, qty: num(d.qty), unit: d.unit || 'pathi', pathi: round(c.pathi, 4), rate: c.rate, amount: d.own ? 0 : round(c.amount, 2),
    pay: d.own ? '' : (d.pay || 'cash'), customer: String(d.customer || '').trim(), own: !!d.own, note: '' };
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); db.meta.millLast = rec.item; persist();
  toast(`⚙️ Saved ✓ ${millItem(rec.item).ne} ${nfmt(rec.qty)} ${MILL_UNITS[rec.unit].ne}${rec.own ? ' · own' : ' · ' + money(rec.amount)}`, d.id ? null : rec.id);
  millDraft = newMillDraft(d.id ? null : d); renderMill();
}

// ---------- rates, bill, period sheets ----------
function openMillRates() {
  openSheet(`<h2>⚙️ Mill rates <span class="small muted">per पाथी</span></h2><div id="millRateForm">
    <div class="summary">${millItems().filter(x => !x.hidden).map(x => `<div class="line" style="gap:8px"><span style="flex:1">${esc(x.ne)}<br><span class="small muted">${esc(x.en)}</span></span>
      <input data-mr="${x.id}" type="number" inputmode="decimal" value="${x.rate || ''}" placeholder="Rs" style="width:96px;border:2px solid var(--line);border-radius:10px;padding:8px;font-size:18px;font-weight:800"></div>`).join('')}</div>
    <button class="btn ghost" data-act="millAddItem">+ Add kind (e.g. जौ पिसानी)</button>
    <div style="height:10px"></div><button class="btn big green" data-act="millRatesSave">✔ Save rates</button></div>
    <p class="small muted">Rates are shared with all your phones. A sale can still have a different amount — type it in Rs.</p>`);
}
function saveMillRates() {
  const vals = {}; $$('#millRateForm [data-mr]').forEach(el => { vals[el.dataset.mr] = num(el.value) || 0; });
  setSet('millItems', millItems().map(x => Object.assign({}, x, { rate: vals[x.id] != null ? vals[x.id] : x.rate })));
  closeSheet(); renderMill(); toast('Mill rates saved ✓');
}
function openMillBill(rec) {
  const d = Object.assign({ kind: 'millcost', type: 'electricity', date: today(), amount: '', units: '', note: '' }, rec || {});
  openSheet(`<h2>⚡ ${d.id ? 'Edit bill' : 'Electricity bill'}</h2><div id="millBillForm">
    <div class="field"><label>Date paid (नेपाली)</label>${bsDateHtml('millbill', d.date)}</div>
    <div class="grid2"><div class="field"><label>Amount Rs</label><input data-mb="amount" ${calcAttrs()} value="${esc(d.amount)}" placeholder="0"></div>
      <div class="field"><label>Units (kWh) <span class="muted">optional</span></label><input data-mb="units" type="number" inputmode="decimal" value="${esc(d.units || '')}" placeholder="—"></div></div>
    <div class="field"><label>Note <span class="muted">(optional)</span></label><input data-mb="note" value="${esc(d.note || '')}" placeholder="e.g. Kartik bill" autocomplete="off"></div>
    <button class="btn big green" data-act="millBillSave" ${d.id ? `data-id="${d.id}"` : ''}>✔ Save bill</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}</div>`);
  millBillDate = d.date;
}
let millBillDate = null;
function saveMillBill(id) {
  const v = k => ($(`#millBillForm [data-mb=${k}]`) || {}).value;
  const amt = num(v('amount'));
  if (!amt) { toast('Type the bill amount'); return; }
  const rec = { kind: 'millcost', type: 'electricity', date: millBillDate || today(), amount: round(amt, 2), units: num(v('units')), note: String(v('note') || '').trim() };
  if (rec.units == null) delete rec.units;
  if (id) { const old = db.records[id]; rec.id = id; rec.createdAt = old.createdAt; }
  put(rec); closeSheet(); render(); toast(`⚡ Bill saved ✓ ${money(rec.amount)}`);
}
function millServicing() {
  const mm = millMachines();
  if (mm.length) { openServiceForm(null, mm[0].id); return; }
  openMyMachineForm({ type: 'mill', name: 'Mill' });
  mmDraft.back = rec => openServiceForm(null, rec.id);
  toast('First add the mill as a machine (name it), then the servicing opens');
}
function openMillRange(from, to, label) {
  const o = millRange(from, to), days = [];
  for (let d = to; d >= from; d = addDays(d, -1)) days.push(d);
  const items = Object.entries(o.byItem);
  openSheet(`<h2>⚙️ ${esc(label)}</h2><div class="small muted" style="margin:-6px 0 10px">${fmtDate(from, true)}${from !== to ? ' – ' + fmtDate(to, true) : ''}</div>
    <div class="summary">
      <div class="line"><span>Income <span class="small muted">(💵 ${money(o.cash)} · 📱 ${money(o.qr)})</span></span><b style="color:var(--green);font-size:22px">${money(o.total)}</b></div>
      ${items.map(([k, x]) => `<div class="line"><span>${esc(millItem(k).ne)}</span><b>${nfmt(round(x.pathi, 2))} पाथी · ${money(x.amount)}${x.own ? ` <span class="small muted">· 🏠 ${nfmt(round(x.own, 2))}</span>` : ''}</b></div>`).join('')}
      ${o.electricity ? `<div class="line"><span>⚡ Electricity</span><b style="color:var(--red)">− ${money(o.electricity)}</b></div>` : ''}
      ${o.service ? `<div class="line"><span>🔧 Servicing</span><b style="color:var(--red)">− ${money(o.service)}</b></div>` : ''}
      ${o.cost ? `<div class="line"><span><b>Profit</b></span><b style="font-size:20px">${money(o.profit)}</b></div>` : ''}</div>
    ${from === to ? `${all('mill').filter(r => r.date === from).sort((a, b) => b.createdAt - a.createdAt).map(millItemHtml).join('') || '<p class="muted">No entries.</p>'}`
      : `<h3>Every day</h3><div class="summary small">${days.map(d => { const x = millRange(d, d); return `<div class="line" data-act="millRangeDay" data-d="${d}" data-from="${from}" data-to="${to}" data-label="${esc(label)}" style="cursor:pointer">
        <span><b>${fmtDate(d)}</b> <span class="muted">· ${WEEK_NE[weekday(d)]}</span>${x.n ? `<br><span class="muted">${nfmt(round(x.pathi, 2))} पाथी · 💵 ${money(x.cash)} · 📱 ${money(x.qr)}</span>` : ''}</span>
        <b style="color:${x.n ? 'var(--green)' : 'var(--muted)'};white-space:nowrap">${x.n ? money(x.total) : '—'} ›</b></div>`; }).join('')}</div>`}
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}

// ---------- 📊 Mill report ----------
let millRepPeriod = 'month';
function renderMillReport() {
  const t = today(), b = adToBs(t);
  const P = { month: [bsMonthStart(t), t, BS_MONTHS[b.m - 1]], last: (() => { const [y, m] = b.m === 1 ? [b.y - 1, 12] : [b.y, b.m - 1]; return [bsToAd(y, m, 1), bsToAd(y, m, bsDays(y, m)), BS_MONTHS[m - 1]]; })(),
    year: [bsToAd(b.m >= 4 ? b.y : b.y - 1, 4, 1), t, 'This fiscal year'], all: ['2000-01-01', t, 'All time'] };
  const [from, to, label] = P[millRepPeriod], o = millRange(from, to);
  const months = [];
  for (let i = 0; i < 12; i++) { let y = b.y, m = b.m - i; while (m < 1) { m += 12; y--; } const f = bsToAd(y, m, 1), e = i === 0 ? t : bsToAd(y, m, bsDays(y, m)); months.push({ label: BS_MONTHS[m - 1] + ' ' + y, f, e, o: millRange(f, e) }); }
  $('#v-millreport').innerHTML = `<h2>📊 Mill report</h2>
    <div class="chips" style="margin-bottom:10px">${[['month', 'This month'], ['last', 'Last month'], ['year', 'This year'], ['all', 'All']].map(([k, l]) => `<button class="chip sm ${millRepPeriod === k ? 'on' : ''}" data-act="millRep" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="card today" style="background:linear-gradient(135deg,#6D28D9,#4C1D95)"><div class="label">${esc(label)} · income</div><div class="huge">${money(o.total)}</div>
      <div class="grid3" style="margin-top:10px"><div class="stat"><b>${nfmt(round(o.pathi, 1))}</b><span>पाथी milled</span></div><div class="stat"><b>${shortMoney(o.cost)}</b><span>Costs</span></div><div class="stat"><b>${shortMoney(o.profit)}</b><span>Profit</span></div></div></div>
    <div class="summary">
      <div class="line"><span>💵 Cash · 📱 QR</span><b>${money(o.cash)} · ${money(o.qr)}</b></div>
      ${Object.entries(o.byItem).map(([k, x]) => `<div class="line"><span>${esc(millItem(k).ne)}</span><b>${nfmt(round(x.pathi, 2))} पाथी · ${money(x.amount)}</b></div>`).join('')}
      ${o.ownPathi ? `<div class="line"><span>🏠 Own grain (free)</span><b>${nfmt(round(o.ownPathi, 2))} पाथी</b></div>` : ''}
      <div class="line"><span>⚡ Electricity</span><b style="color:var(--red)">${money(o.electricity)}</b></div>
      <div class="line"><span>🔧 Servicing</span><b style="color:var(--red)">${money(o.service)}</b></div>
      <div class="line"><span><b>Profit</b> (income − costs)</span><b style="font-size:20px">${money(o.profit)}</b></div></div>
    <h3>By month</h3>
    <div class="summary small">${months.map(x => `<div class="line" data-act="millRange" data-from="${x.f}" data-to="${x.e}" data-label="${esc(x.label)}" style="cursor:pointer"><span><b>${esc(x.label)}</b><br><span class="muted">${nfmt(round(x.o.pathi, 1))} पाथी · costs ${money(x.o.cost)}</span></span><b>${money(x.o.total)} ›</b></div>`).join('')}</div>
    <h3>Bills & servicing</h3>
    ${all('millcost').concat(all('mservice').filter(r => { const m = myMachineById(r.machineId); return m && m.type === 'mill'; })).sort((a, c) => c.date.localeCompare(a.date)).slice(0, 30).map(r => `<button class="item" data-act="${r.kind === 'millcost' ? 'millBillEdit' : 'editRec'}" data-id="${r.id}">
      <div class="ic" style="background:var(--red-l)">${r.kind === 'millcost' ? '⚡' : '🔧'}</div><div class="mid"><div class="t">${r.kind === 'millcost' ? 'Electricity bill' + (r.units ? ' · ' + nfmt(r.units) + ' units' : '') : 'Servicing · ' + (r.items || []).map(i => serviceItemName(i.item)).join(', ')}</div><div class="s">${fmtDate(r.date, true)}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
      <div class="amt">${money(r.kind === 'millcost' ? r.amount : serviceTotal(r))}</div></button>`).join('') || '<p class="muted">No bills yet.</p>'}
    <div class="grid2" style="margin-top:10px"><button class="btn" data-act="exportCsv" data-v="mill">📄 Mill (CSV)</button><button class="btn" data-act="millShare">💬 Share</button></div>`;
}
function millReportText() {
  const t = today(), td = millRange(t, t), mo = millRange(bsMonthStart(t), t);
  return [`⚙️ Mill — ${fmtDate(t, true)}`, `Today: ${money(td.total)} (${nfmt(round(td.pathi, 2))} पाथी)`, `${BS_MONTHS[adToBs(t).m - 1]}: ${money(mo.total)} · ${nfmt(round(mo.pathi, 1))} पाथी · costs ${money(mo.cost)} · profit ${money(mo.profit)}`,
    ...Object.entries(mo.byItem).map(([k, x]) => `${millItem(k).ne}: ${nfmt(round(x.pathi, 2))} पाथी · ${money(x.amount)}`)].join('\n');
}
function millCsv() {
  const rows = [['Date (BS)', 'Date (AD)', 'Kind', 'Item', 'Qty', 'Unit', 'Pathi', 'Rate', 'Amount', 'Pay', 'Customer', 'Note', 'By']];
  Object.values(db.records).filter(r => !hidden(r) && (r.kind === 'mill' || r.kind === 'millcost')).sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
    if (r.kind === 'mill') rows.push([bsIso(r.date), r.date, r.own ? 'Own' : 'Customer', millItem(r.item).en, r.qty, r.unit, r.pathi, r.rate, r.amount, r.pay, r.customer || '', r.note || '', r.by || '']);
    else rows.push([bsIso(r.date), r.date, 'Electricity bill', '', r.units || '', 'kWh', '', '', -r.amount, '', '', r.note || '', r.by || '']);
  });
  return { rows, name: 'mill-' + bsIso(today()) + '.csv' };
}

// ---------- voice: "dhan 5 pathi kutani", "makai 3 pathi pisani qr", "गहुँ २ पाथी पिसानी", "kutani 4 pathi 200" ----------
function parseMill(text) {
  let t = ' ' + String(text || '').toLowerCase() + ' ';
  t = t.replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)));
  t = nepaliNumbers(t);
  [[/धान/g, ' dhaan '], [/मकै/g, ' makai '], [/गहुँ|गहु/g, ' gahun '], [/कोदो/g, ' kodo '], [/जौ/g, ' jau '], [/कुटानी|कुटाइ|कुट्ने/g, ' kutani '], [/पिसानी|पिसाइ|पिस्ने/g, ' pisani '],
   [/पाथी/g, ' pathi '], [/माना/g, ' mana '], [/मुरी/g, ' muri '], [/आफ्नै|आफ्नो/g, ' own '], [/क्यूआर|क्यु आर/g, ' qr '], [/नगद/g, ' cash '], [/हिजो/g, ' yesterday ']].forEach(([re, rep]) => { t = t.replace(re, rep); });
  t = t.replace(/\b(dhan|dhaan|paddy|rice)\b/g, ' dhaan ').replace(/\b(maize|corn|makai)\b/g, ' makai ').replace(/\b(wheat|gahu|gahun)\b/g, ' gahun ').replace(/\b(kutani|kutai|kutne|husking)\b/g, ' kutani ')
    .replace(/\b(pisani|pisai|pisne|grinding|pitho)\b/g, ' pisani ').replace(/\b(pathis?)\b/g, ' pathi ').replace(/\b(manas?)\b/g, ' mana ').replace(/\b(aafno|afno|own|ghar ko)\b/g, ' own ')
    .replace(/\b(fonepay|esewa|khalti|online)\b/g, ' qr ');
  t = wordsToNumbers(t).replace(/\s+/g, ' ');
  if (!/\b(kutani|pisani)\b/.test(t) && !(/\b(pathi|mana|muri)\b/.test(t) && /\b(dhaan|makai|gahun|kodo|jau)\b/.test(t))) return null;
  const crop = (/\b(dhaan|makai|gahun|kodo|jau)\b/.exec(t) || [])[1] || '', work = /\bkutani\b/.test(t) ? 'kutani' : /\bpisani\b/.test(t) ? 'pisani' : crop === 'dhaan' ? 'kutani' : 'pisani';
  const it = millItems().find(x => x.id.startsWith(crop.replace('dhaan', 'dhan') + '_') && x.work === work) || millItems().find(x => x.work === work && (!crop || x.id.startsWith(crop.replace('dhaan', 'dhan'))));
  const q = /(\d+(?:\.\d+)?)\s*(pathi|mana|muri)\b/.exec(t);
  const rest = (t.replace(q ? q[0] : '', ' ').match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
  return { intent: 'mill', item: it ? it.id : '', qty: q ? parseFloat(q[1]) : (rest.length ? rest.shift() : null), unit: q ? q[2] : 'pathi', amount: q && rest.length ? rest[0] : null,
    pay: /\bqr\b/.test(t) ? 'qr' : 'cash', own: /\bown\b/.test(t), date: /\byesterday\b/.test(t) ? addDays(today(), -1) : today(), text };
}
function flowMill(p, v) {
  if (section !== 'mill') { setSection('mill'); go('mill'); }
  millDraft = Object.assign(newMillDraft(), { date: p.date, item: p.item || millDraft.item, qty: p.qty == null ? '' : p.qty, unit: p.unit, amount: p.amount == null ? '' : p.amount, pay: p.pay, own: p.own });
  if (!p.qty) { renderMill(); toast('Type the quantity'); return; }
  const c = millCalc(millDraft), it = millItem(millDraft.item);
  ask({ title: 'Save?', sub: `Heard: “${p.text}”`,
    html: `<div class="summary"><div class="line"><span>Date</span><b>${fmtDate(millDraft.date, true)}</b></div><div class="line"><span>Work</span><b>${esc(it.ne)}</b></div>
      <div class="line"><span>Quantity</span><b>${nfmt(millDraft.qty)} ${MILL_UNITS[millDraft.unit].ne}</b></div>
      <div class="line"><span>Amount</span><b>${p.own ? '🏠 own · free' : money(c.amount) + (p.pay === 'qr' ? ' · 📱 QR' : ' · 💵 cash')}</b></div></div>`,
    speech: `${it.en}, ${nfmt(millDraft.qty)} ${millDraft.unit}, ${p.own ? 'own, free' : sayMoney(c.amount)}. Save?`,
    buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }], voice: yesNo, voiceMode: v,
    onAnswer: a => { if (a === 'yes') saveMill(); else if (a === 'edit') renderMill(); else { millDraft = newMillDraft(); renderMill(); toast('Cancelled — nothing saved'); } } });
}

function millClick(act, b) {
  const id = b.dataset.id, v = b.dataset.v;
  const keep = () => $$('#millForm [data-ml]').forEach(el => { millDraft[el.dataset.ml] = el.value; });
  switch (act) {
    case 'millItem': keep(); millDraft.item = v; millDraft.amount = ''; renderMill(); return true;
    case 'millUnit': keep(); millDraft.unit = v; renderMill(); return true;
    case 'millPay': keep(); millDraft.pay = v; millDraft.own = false; renderMill(); return true;
    case 'millOwn': keep(); millDraft.own = !millDraft.own; renderMill(); return true;
    case 'millSave': saveMill(); return true;
    case 'millCancel': millDraft = newMillDraft(); renderMill(); return true;
    case 'millEdit': closeSheet(); if (section !== 'mill') { setSection('mill'); go('mill'); } millDraft = Object.assign({}, db.records[id]); renderMill(); window.scrollTo(0, 0); return true;
    case 'millDatePick': millDateOpen = !millDateOpen; $('#millDateBox').classList.toggle('hidden', !millDateOpen); return true;
    case 'millRates': openMillRates(); return true;
    case 'millRatesSave': saveMillRates(); return true;
    case 'millAddItem': ask({ title: 'New mill work', sub: 'e.g. जौ पिसानी, कोदो कुटानी', input: { text: true, placeholder: 'Name' }, onAnswer: name => {
      const l = millItems().slice(); l.push({ id: 'm_' + normName(name).slice(0, 16) + '_' + l.length, ne: name, en: name, work: /कुट|kut/i.test(name) ? 'kutani' : 'pisani', rate: 0 });
      setSet('millItems', l); openMillRates(); toast(`Added ${name} — set its rate`); }, onCancel: () => openMillRates() }); return true;
    case 'millBill': openMillBill(null); return true;
    case 'millBillEdit': openMillBill(Object.assign({}, db.records[id])); return true;
    case 'millBillSave': saveMillBill(b.dataset.id); return true;
    case 'millService': millServicing(); return true;
    case 'millRange': openMillRange(b.dataset.from, b.dataset.to, b.dataset.label); return true;
    case 'millRangeDay': { const f = b.dataset.from, t2 = b.dataset.to, l = b.dataset.label; openMillRange(b.dataset.d, b.dataset.d, fmtDate(b.dataset.d, true)); sheetBackFn = () => openMillRange(f, t2, l); return true; }
    case 'millRep': millRepPeriod = v; renderMillReport(); return true;
    case 'millShare': shareText(millReportText()); return true;
  }
  return false;
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.ml && millDraft) { millDraft[el.dataset.ml] = el.value; const h = $('#millHint'); if (h) h.textContent = millHint(millDraft); }
});
