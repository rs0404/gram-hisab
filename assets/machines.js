/* Gram Hisab — 🚜 My machines: own tractor / power tiller / pump / thresher…, their use, servicing and consumables.
   kinds: mymachine {name, type, number, note, active}
          mservice  {machineId, date, items: [{item, qty, cost}], total, meter, nextDate, note}
   Machine-use entries (kind 'machine') of own machines carry machineId. Servicing is the machine's own running cost:
   it is shown per machine and in the Kheti report, not added to any one crop. */
'use strict';

const SERVICE_ITEMS = [
  ['mobil', 'Mobil (engine oil)', 'मोबिल'], ['gear', 'Gear oil', 'गियर तेल'], ['hydraulic', 'Hydraulic oil', 'हाइड्रोलिक तेल'], ['grease', 'Grease', 'ग्रिज'],
  ['oilfilter', 'Oil filter', 'अयल फिल्टर'], ['airfilter', 'Air filter', 'एयर फिल्टर'], ['dieselfilter', 'Diesel filter', 'डिजेल फिल्टर'],
  ['parts', 'Parts change', 'पार्टस् फेर्ने'], ['tyre', 'Tyre / tube', 'टायर / ट्युब'], ['battery', 'Battery', 'ब्याट्री'],
  ['coolant', 'Coolant / water', 'कुलेन्ट'], ['mechanic', 'Mechanic charge', 'मिस्त्री ज्याला'], ['other', 'Other', 'अन्य']
];
const serviceItemName = id => { const x = SERVICE_ITEMS.find(s => s[0] === id); return x ? `${x[2]}` : id; };
const OWN_MACHINE_TYPES = Object.keys(MACHINES).filter(k => !MACHINES[k].hired).concat(['thresherOwn', 'mill', 'otherMachine']);
const MACHINE_TYPE_NAME = t => (MACHINES[t] && MACHINES[t].en) || ({ thresherOwn: 'Own thresher', mill: 'Mill (मिल)', otherMachine: 'Other machine' })[t] || t;
const MACHINE_TYPE_ICON = t => (MACHINES[t] && MACHINES[t].icon) || (t === 'thresherOwn' ? '🌾' : t === 'mill' ? '⚙️' : '🔧');

function myMachines() { return all('mymachine').sort((a, b) => (a.active === false) - (b.active === false) || String(a.name).localeCompare(String(b.name))); }
function myMachineById(id) { const r = db.records[id]; return r && !r.deleted && r.kind === 'mymachine' ? r : null; }
function myMachinesOfType(type) { return myMachines().filter(m => m.type === type && m.active !== false); }
// which of my machines a use entry belongs to (old entries without machineId go to the only machine of that type)
function useMachineId(r) {
  if (r.machineId) return r.machineId;
  const list = myMachinesOfType(r.type);
  return list.length === 1 ? list[0].id : '';
}
function serviceTotal(r) { return (r.items || []).reduce((a, x) => a + (Number(x.cost) || 0), 0); }

// everything about each machine: hours, fuel, servicing, last / next service
function computeMachines() {
  const M = {};
  myMachines().forEach(m => { M[m.id] = { m, hours: 0, uses: 0, litres: 0, fuelCost: 0, ownValue: 0, services: 0, serviceCost: 0, lastService: '', lastMeter: null, nextDate: '', byItem: {} }; });
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r)) continue;
    if (r.kind === 'machine' && !(MACHINES[r.type] || {}).hired) {
      const x = M[useMachineId(r)];
      if (x) { x.hours += Number(r.hours) || 0; x.uses++; x.litres += Number(r.litres) || 0; x.fuelCost += Number(r.fuelCost) || 0; x.ownValue += machineOwnValue(r); }
    } else if (r.kind === 'mservice' && M[r.machineId]) {
      const x = M[r.machineId];
      x.services++; x.serviceCost += serviceTotal(r);
      (r.items || []).forEach(i => { x.byItem[i.item] = (x.byItem[i.item] || 0) + (Number(i.cost) || 0); });
      if (r.date >= x.lastService) { x.lastService = r.date; x.lastMeter = r.meter != null && r.meter !== '' ? Number(r.meter) : x.lastMeter; x.nextDate = r.nextDate || ''; }
    }
  }
  return M;
}
// services due within a week (or overdue), for the Kheti dashboard
function servicesDue() {
  const t = today(), soon = addDays(t, 7);
  return Object.values(computeMachines()).filter(x => x.m.active !== false && x.nextDate && x.nextDate <= soon);
}

// ---------- 🚜 My machines page ----------
function renderKMachines() {
  const M = computeMachines(), list = myMachines(), t = today();
  const yearFrom = bsToAd(adToBs(t).y, 1, 1), svcYear = all('mservice').filter(r => r.date >= yearFrom).reduce((a, r) => a + serviceTotal(r), 0);
  $('#v-kmachines').innerHTML = `
    <div class="row between" style="margin:2px 0 8px"><h2 style="margin:0">🚜 My machines</h2><button class="btn primary" data-act="mmNew">+ Machine</button></div>
    ${list.length ? `<div class="card tight"><div class="row between"><span class="label">🔧 Servicing this year (${neNum(adToBs(t).y)})</span><b style="font-size:20px;color:var(--red)">${money(svcYear)}</b></div></div>` : ''}
    ${list.length ? list.map(m => { const x = M[m.id], due = x.nextDate && x.nextDate <= t, soon = x.nextDate && !due && x.nextDate <= addDays(t, 7);
      return `<button class="item" data-act="mmOpen" data-id="${m.id}" style="align-items:flex-start${m.active === false ? ';opacity:.6' : ''}">
        <div class="ic" style="background:var(--amber-l)">${MACHINE_TYPE_ICON(m.type)}</div>
        <div class="mid"><div class="t">${esc(m.name)}${m.number ? ` <span class="small muted">${esc(m.number)}</span>` : ''}</div>
          <div class="s">${nfmt(x.hours)} hr used · ⛽ ${nfmt(round(x.litres, 1))} L ${money(x.fuelCost)} · 🔧 ${x.services} service${x.services === 1 ? '' : 's'}</div>
          <div class="s">${x.lastService ? 'Last service ' + fmtDate(x.lastService, true) : 'No service yet'}${x.nextDate ? ` · <b style="color:${due ? 'var(--red)' : soon ? 'var(--amber-d)' : 'inherit'}">next ${fmtDate(x.nextDate, true)}${due ? ' ⚠️' : ''}</b>` : ''}</div></div>
        <div class="amt" style="color:var(--red)">${money(x.serviceCost)}<div class="small muted">servicing</div></div></button>`; }).join('')
      : `<div class="card empty"><div class="e">🚜</div><p>Add your own machines — tractor, power tiller, pump, thresher — to keep their servicing and running cost.</p><button class="btn big primary" data-act="mmNew">+ Add machine</button></div>`}
    ${list.length ? `<button class="btn big green" data-act="mmService">🔧 Record servicing</button>` : ''}
    <p class="small muted">Using a machine on a crop is recorded in 📝 Work → 🚜 Machine & fuel (pick which machine). Servicing is the machine's own cost and is not added to a crop.</p>`;
}

// ---------- machine form ----------
let mmDraft = null;
function openMyMachineForm(m) {
  mmDraft = Object.assign({ kind: 'mymachine', name: '', type: 'ownTractor', number: '', note: '', active: true }, m || {});
  const d = mmDraft;
  openSheet(`<h2>${d.id ? '✎ Machine' : '+ My machine'}</h2><div id="mmForm">
    <div class="field"><label>Type</label><div class="chips">${OWN_MACHINE_TYPES.map(t => `<button class="chip sm ${d.type === t ? 'on' : ''}" data-act="mmType" data-v="${t}">${MACHINE_TYPE_ICON(t)} ${MACHINE_TYPE_NAME(t)}</button>`).join('')}</div></div>
    <div class="field"><label>Name</label><input data-mm="name" value="${esc(d.name)}" placeholder="e.g. Mahindra 575, Kubota tiller" autocomplete="off"></div>
    <div class="field"><label>Number / model <span class="muted">(optional)</span></label><input data-mm="number" value="${esc(d.number || '')}" placeholder="e.g. Ba 1 Ta 1234" autocomplete="off"></div>
    <div class="field"><label>Note <span class="muted">(optional)</span></label><input data-mm="note" value="${esc(d.note || '')}" placeholder="—" autocomplete="off"></div>
    <button class="btn big green" data-act="mmSave">✔ Save machine</button>
    ${d.id ? `<div style="height:10px"></div><div class="btnrow"><button class="btn ghost" data-act="mmActive" data-id="${d.id}">${d.active === false ? '↺ In use again' : '⏸ Sold / not in use'}</button><button class="btn redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button></div>${historyHtml(d.id)}` : ''}
  </div>`);
}
function saveMyMachine() {
  $$('#mmForm [data-mm]').forEach(el => { mmDraft[el.dataset.mm] = el.value; });
  const d = mmDraft;
  if (!String(d.name || '').trim()) d.name = MACHINE_TYPE_NAME(d.type);
  const rec = { kind: 'mymachine', name: String(d.name).trim(), type: d.type, number: String(d.number || '').trim(), note: String(d.note || '').trim(), active: d.active !== false };
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render(); toast(`🚜 ${rec.name} saved ✓`);
  if (d.back) { const b = d.back; mmDraft = null; b(rec); }
}

// ---------- one machine: totals, servicing history, use ----------
function openMyMachine(id) {
  const m = myMachineById(id); if (!m) return;
  const x = computeMachines()[id];
  const svcs = all('mservice').filter(r => r.machineId === id).sort((a, b) => b.date.localeCompare(a.date));
  const uses = all('machine').filter(r => !(MACHINES[r.type] || {}).hired && useMachineId(r) === id).sort((a, b) => b.date.localeCompare(a.date));
  openSheet(`<h2>${MACHINE_TYPE_ICON(m.type)} ${esc(m.name)}</h2><div class="small muted" style="margin:-6px 0 10px">${esc(MACHINE_TYPE_NAME(m.type))}${m.number ? ' · ' + esc(m.number) : ''}${m.active === false ? ' · not in use' : ''}</div>
    <div class="summary">
      <div class="line"><span>Used</span><b>${nfmt(x.hours)} hr · ${x.uses} time${x.uses === 1 ? '' : 's'}</b></div>
      <div class="line"><span>⛽ Fuel</span><b>${nfmt(round(x.litres, 1))} L · ${money(x.fuelCost)}</b></div>
      <div class="line"><span>🔧 Servicing (${x.services})</span><b style="color:var(--red)">${money(x.serviceCost)}</b></div>
      ${Object.keys(x.byItem).length ? `<div class="line"><span class="small muted">${Object.entries(x.byItem).sort((a, b) => b[1] - a[1]).map(([k, v]) => esc(serviceItemName(k)) + ' ' + money(v)).join(' · ')}</span><b></b></div>` : ''}
      <div class="line"><span><b>Running cost</b> <span class="small muted">(fuel + servicing)</span></span><b style="font-size:20px">${money(x.fuelCost + x.serviceCost)}</b></div>
      ${x.hours ? `<div class="line"><span>Per hour</span><b>${money((x.fuelCost + x.serviceCost) / x.hours)}/hr</b></div>` : ''}
      <div class="line"><span>Last service</span><b>${x.lastService ? fmtDate(x.lastService, true) + (x.lastMeter != null ? ' · ' + nfmt(x.lastMeter) + ' hr meter' : '') : '—'}</b></div>
      ${x.nextDate ? `<div class="line"><span>Next service</span><b style="color:${x.nextDate <= today() ? 'var(--red)' : 'inherit'}">${fmtDate(x.nextDate, true)}</b></div>` : ''}</div>
    <div class="btnrow"><button class="btn green" data-act="mmService" data-id="${id}">🔧 Servicing</button><button class="btn ghost" data-act="mmEdit" data-id="${id}">✎ Edit</button></div>
    <h3>🔧 Servicing</h3>
    ${svcs.length ? svcs.map(r => `<button class="item" data-act="editRec" data-id="${r.id}"><div class="ic" style="background:var(--red-l)">🔧</div>
      <div class="mid"><div class="t">${fmtDate(r.date, true)}${r.meter ? ' · ' + nfmt(r.meter) + ' hr' : ''}</div><div class="s">${(r.items || []).map(i => esc(serviceItemName(i.item)) + (i.qty ? ' ' + esc(i.qty) : '')).join(', ')}${r.nextDate ? ' · next ' + fmtDate(r.nextDate) : ''}</div></div>
      <div class="amt">${money(serviceTotal(r))}</div></button>`).join('') : '<p class="muted">No servicing recorded yet.</p>'}
    <h3>🚜 Use</h3>
    ${uses.length ? `<div class="summary small">${uses.slice(0, 40).map(r => `<div class="line" data-act="editRec" data-id="${r.id}" style="cursor:pointer"><span>${fmtDate(r.date)} · ${esc(r.khetiId && khetiById(r.khetiId) ? khetiTitle(khetiById(r.khetiId)) : '')}</span><b>${nfmt(r.hours)} hr${r.litres ? ' · ' + nfmt(r.litres) + ' L' : ''}</b></div>`).join('')}</div>` : '<p class="muted">No use recorded yet.</p>'}
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}

// ---------- servicing form ----------
let svcDraft = null;
function openServiceForm(rec, machineId) {
  const first = myMachines().filter(m => m.active !== false)[0];
  svcDraft = Object.assign({ kind: 'mservice', machineId: machineId || (first ? first.id : ''), date: today(), items: [], meter: '', nextDate: '', note: '' }, rec ? JSON.parse(JSON.stringify(rec)) : {});
  if (!svcDraft.items.length) svcDraft.items = [{ item: 'mobil', qty: '', cost: '' }];
  renderServiceForm();
}
function readServiceForm() {
  $$('#svcForm [data-sv]').forEach(el => { svcDraft[el.dataset.sv] = el.value; });
  $$('#svcForm [data-svi]').forEach(el => { const i = svcDraft.items[+el.dataset.i]; if (i) i[el.dataset.svi] = el.value; });
}
function renderServiceForm() {
  const d = svcDraft, total = d.items.reduce((a, i) => a + (num(i.cost) || 0), 0);
  openSheet(`<h2>🔧 ${d.id ? 'Edit servicing' : 'Servicing'}</h2><div id="svcForm">
    <div class="field"><label>Machine</label><div class="chips">${myMachines().filter(m => m.active !== false || m.id === d.machineId).map(m => `<button class="chip sm ${d.machineId === m.id ? 'on' : ''}" data-act="svMachine" data-id="${m.id}">${MACHINE_TYPE_ICON(m.type)} ${esc(m.name)}</button>`).join('')}
      <button class="chip sm" data-act="mmNewFromService">+ New</button></div></div>
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('ksvc', d.date)}</div>
    <div class="field"><label>What was changed / bought</label>
      ${d.items.map((it, i) => `<div class="svcrow">
        <select data-svi="item" data-i="${i}">${SERVICE_ITEMS.map(s => `<option value="${s[0]}" ${it.item === s[0] ? 'selected' : ''}>${s[2]} · ${s[1]}</option>`).join('')}</select>
        <input data-svi="qty" data-i="${i}" value="${esc(it.qty || '')}" placeholder="qty" autocomplete="off">
        <input data-svi="cost" data-i="${i}" ${calcAttrs()} value="${esc(it.cost || '')}" placeholder="Rs">
        <button class="btn sm redl" data-act="svDelItem" data-i="${i}" aria-label="Remove">✕</button></div>`).join('')}
      <div class="chips" style="margin-top:4px">${SERVICE_ITEMS.slice(0, 8).map(s => `<button class="chip sm" data-act="svAddItem" data-v="${s[0]}">+ ${s[2]}</button>`).join('')}<button class="chip sm" data-act="svAddItem" data-v="mechanic">+ मिस्त्री</button></div></div>
    <div class="totalbox"><span><b style="font-size:15px">TOTAL</b></span><b id="svTotal">${money(total)}</b></div>
    <div class="grid2"><div class="field"><label>Hour meter <span class="muted">(optional)</span></label><input data-sv="meter" type="number" inputmode="decimal" value="${esc(d.meter || '')}" placeholder="—"></div>
      <div class="field"><label>Note <span class="muted">(optional)</span></label><input data-sv="note" value="${esc(d.note || '')}" placeholder="e.g. garage name" autocomplete="off"></div></div>
    <div class="field"><label>Next service <span class="muted">(reminder)</span></label><div class="chips">
      ${[['', 'None'], [30, '1 month'], [60, '2 months'], [90, '3 months'], [180, '6 months']].map(([n, l]) => `<button class="chip sm ${(!n && !d.nextDate) || (n && d.nextDate === addDays(d.date, n)) ? 'on' : ''}" data-act="svNext" data-v="${n}">${l}</button>`).join('')}</div>
      ${d.nextDate ? `<div class="hint">Next: ${fmtDate(d.nextDate, true)}</div>` : ''}</div>
    <button class="btn big green" data-act="svSave">✔ Save servicing</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}
  </div>`);
}
function updServiceTotal() { readServiceForm(); const t = $('#svTotal'); if (t) t.textContent = money(svcDraft.items.reduce((a, i) => a + (num(i.cost) || 0), 0)); }
function saveServiceForm() {
  readServiceForm();
  const d = svcDraft;
  if (!myMachineById(d.machineId)) { toast('Pick the machine'); return; }
  const items = d.items.map(i => ({ item: i.item, qty: String(i.qty || '').trim(), cost: round(num(i.cost) || 0, 2) })).filter(i => i.cost || i.qty);
  if (!items.length) { toast('Add what was changed and its cost'); return; }
  const rec = { kind: 'mservice', machineId: d.machineId, date: d.date || today(), items, total: round(items.reduce((a, i) => a + i.cost, 0), 2),
    meter: num(d.meter), nextDate: d.nextDate || '', note: String(d.note || '').trim() };
  if (rec.meter == null) delete rec.meter;
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render();
  toast(`🔧 Saved ✓ ${myMachineById(rec.machineId).name} · ${money(rec.total)}${rec.nextDate ? ' · next ' + fmtDate(rec.nextDate) : ''}`, d.id ? null : rec.id);
}

function machinesClick(act, b) {
  const id = b.dataset.id, v = b.dataset.v;
  switch (act) {
    case 'goMachines': closeSheet(); go('kmachines'); return true;
    case 'mmNew': openMyMachineForm(null); return true;
    case 'mmEdit': openMyMachineForm(Object.assign({}, myMachineById(id))); return true;
    case 'mmType': $$('#mmForm [data-mm]').forEach(el => { mmDraft[el.dataset.mm] = el.value; }); mmDraft.type = v; openMyMachineForm(mmDraft); return true;
    case 'mmSave': saveMyMachine(); return true;
    case 'mmActive': { const m = myMachineById(id); put(Object.assign({}, m, { active: m.active === false })); closeSheet(); render(); toast(m.active === false ? `${m.name} in use again` : `${m.name} marked not in use`); return true; }
    case 'mmOpen': openMyMachine(id); return true;
    case 'mmService': openServiceForm(null, id); return true;
    case 'mmNewFromService': readServiceForm(); { const keep = svcDraft; openMyMachineForm(null); mmDraft.back = rec => { svcDraft = keep; svcDraft.machineId = rec.id; renderServiceForm(); }; } return true;
    case 'svMachine': readServiceForm(); svcDraft.machineId = id; renderServiceForm(); return true;
    case 'svAddItem': readServiceForm(); svcDraft.items = svcDraft.items.filter(i => i.cost || i.qty || i.item !== 'mobil'); /* drop the empty starter row */ svcDraft.items.push({ item: v, qty: '', cost: '' }); renderServiceForm(); { const c = $$('#svcForm [data-svi=cost]').pop(); if (c) c.focus(); } return true;
    case 'svDelItem': readServiceForm(); svcDraft.items.splice(+b.dataset.i, 1); if (!svcDraft.items.length) svcDraft.items.push({ item: 'other', qty: '', cost: '' }); renderServiceForm(); return true;
    case 'svNext': readServiceForm(); svcDraft.nextDate = v ? addDays(svcDraft.date || today(), Number(v)) : ''; renderServiceForm(); return true;
    case 'svSave': saveServiceForm(); return true;
    case 'kmPick': { kRead(); kDraft.machineId = id; renderMachineForm(); return true; }
    case 'kmNewFromUse': { kRead(); const keep = kDraft; openMyMachineForm({ type: keep.type, name: '' }); mmDraft.back = rec => { kDraft = keep; kDraft.machineId = rec.id; renderMachineForm(); }; return true; }
  }
  return false;
}
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.svi === 'cost' && svcDraft && $('#svTotal')) updServiceTotal(); });
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.svi === 'item' && svcDraft) readServiceForm(); });
