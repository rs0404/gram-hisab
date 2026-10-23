/* Gram Hisab — 🌾 Kheti screens: dashboard, forms, workers & settlement, reports */
'use strict';

let kDraft = null;          // the Kheti form being edited
let kRepSeason = 'all';
const kChip = (act, v, on, label, extra) => `<button class="chip sm ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(v)}" ${extra || ''}>${label}</button>`;
const kNum = (key, label, val, ph, step) => `<div class="field"><label>${label}</label><input data-k="${key}" type="number" inputmode="${step === 'int' ? 'numeric' : 'decimal'}" step="any" value="${val == null ? '' : esc(val)}" placeholder="${ph || '0'}"></div>`;
// an amount field that also takes sums like 2*200 (qty / rate fields get filled from "qty × rate")
const kAmt = (key, label, val, ph, qtyKey, rateKey) => `<div class="field"><label>${label}</label><input data-k="${key}" ${calcAttrs(qtyKey ? `#kForm [data-k=${qtyKey}]` : '', rateKey ? `#kForm [data-k=${rateKey}]` : '')} value="${val == null ? '' : esc(val)}" placeholder="${ph || '0'}"></div>`;
function kRead() { $$('#kForm [data-k]').forEach(el => { kDraft[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; }); }

// ================= DASHBOARD =================
function renderKheti() {
  const S = computeKheti(), t = today(), season = seasonOf(t);
  const act = activeKhetis(), fs = activeFields();
  const seasonInv = Object.values(S.K).filter(k => k.kheti.season === season).reduce((a, k) => a + k.total, 0);
  const allInv = Object.values(S.K).reduce((a, k) => a + k.total, 0);
  const due = Object.values(S.W).filter(w => w.due > 0).sort((a, b) => b.due - a.due);
  const dueTotal = due.reduce((a, w) => a + w.due, 0);
  const parma = Object.values(S.P).filter(p => p.balance);
  $('#v-kheti').innerHTML = `
    <div class="card today" style="background:linear-gradient(135deg,#15803d,#166534)">
      <div class="row between"><div class="label">🌾 Investment · ${esc(seasonLabel(season))}</div><button class="chip sm" style="background:rgba(255,255,255,.85);color:#166534" data-act="openConverter">📐 Converter</button></div>
      <div class="huge" style="margin:6px 0 10px">${money(seasonInv)}</div>
      <div class="grid3">
        <div class="stat"><b>${act.length}</b><span>Active kheti</span></div>
        <div class="stat"><b>${shortMoney(allInv)}</b><span>All time Rs</span></div>
        <div class="stat" data-act="go" data-view="workers"><b>${shortMoney(dueTotal)}</b><span>Wages due ›</span></div>
      </div>
      ${servicesDue().map(x => `<div class="small" style="margin-top:8px;color:#fff;cursor:pointer" data-act="mmOpen" data-id="${x.m.id}">🔧 <b>${esc(x.m.name)}</b> service ${x.nextDate < today() ? 'overdue since' : 'due'} ${fmtDate(x.nextDate)} ›</div>`).join('')}
      ${due.length ? `<div class="small" style="margin-top:8px;color:#fff">Due: ${due.slice(0, 3).map(w => esc(w.worker.name) + ' ' + money(w.due)).join(' · ')}${due.length > 3 ? ' …' : ''}</div>` : ''}
      ${parma.length ? `<div class="small" style="margin-top:4px;color:#fff">🤝 Parma: ${parma.slice(0, 3).map(p => p.balance > 0 ? `we owe ${esc(p.family)} ${nfmt(p.balance)} din` : `${esc(p.family)} owes us ${nfmt(-p.balance)} din`).join(' · ')}</div>` : ''}
    </div>
    <form class="cmd" data-form="cmd"><input id="kCmdInput" placeholder="Type: ropai 6 khetala · DAP 2 bora 9000" autocomplete="off" enterkeyhint="go"><button class="btn primary" type="submit">Go</button></form>
    <div class="row between"><h2>Fields <span class="pill">${fs.length}</span></h2>
      <span class="row" style="gap:6px"><button class="btn sm ghost" data-act="kFoldAll">☰ List</button><button class="btn sm primary" data-act="kNewField">+ Field</button></span></div>
    ${fs.length ? fs.map(f => fieldCard(f, S)).join('') : `<div class="card empty"><div class="e">🌾</div><p><b>No fields yet.</b><br>Add your khet (name + area) to start.</p><button class="btn big primary" data-act="kNewField">+ Add field</button></div>`}
    ${quickWorkHtml(act)}
    ${fields().filter(f => f.closed).length ? `<h3>Not in use</h3>${fields().filter(f => f.closed).map(f => fieldCard(f, S)).join('')}` : ''}`;
}

// fields: at most 3 open (remembered on this phone)
function kOpenIds() { if (!Array.isArray(db.meta.kOpen)) db.meta.kOpen = activeFields().slice(0, 3).map(f => f.id); return db.meta.kOpen; }
function kToggle(id) {
  let l = kOpenIds().filter(x => fieldById(x));
  if (l.includes(id)) l = l.filter(x => x !== id); else { l.push(id); while (l.length > 3) l.shift(); }
  db.meta.kOpen = l; persist();
}
// 🏠 switch: count the household's own work (at normal rates) in this crop's cost, or not
function famToggleHtml(k) {
  const mach = k.ownAll || k.ownMachineHours ? `<label class="switch kfam" style="padding:8px 0 2px"><span><b>🚜 Own machine in cost</b><br><span class="small muted">${nfmt(k.ownMachineHours)} hr · machine ${money(k.ownMachine)}${k.myTime ? ' + my time ' + money(k.myTime) : ''} · ${k.includeOwnMachine ? 'counted in total' : 'not counted'}</span></span>
    <input type="checkbox" data-act="kMachToggle" data-id="${k.kheti.id}" ${k.includeOwnMachine ? 'checked' : ''}></label>` : '';
  if (!workers().some(w => w.own) && !k.family) return mach;
  return mach + `<label class="switch kfam" style="padding:8px 0 2px"><span><b>🏠 Family work in cost</b><br><span class="small muted">${nfmt(k.familyFull + k.familyHalf * 0.5)} din · value ${money(k.family)} · ${k.includeFamily ? 'counted in total' : 'not counted'}</span></span>
    <input type="checkbox" data-act="kFamToggle" data-id="${k.kheti.id}" ${k.includeFamily ? 'checked' : ''}></label>`;
}
function fieldCard(f, S) {
  const cur = currentKheti(f.id), k = cur ? S.K[cur.id] : null, area = fmtAreaBoth(f.areaM2 || 0);
  const open = kOpenIds().includes(f.id);
  const head = `<span style="font-size:18px;color:var(--muted)">${open ? '▾' : '▸'}</span>
    <span style="min-width:0;flex:1"><b style="font-size:20px">${esc(f.name)}</b>
      <span class="small muted" style="display:block">${esc(area.main)} · <span style="font-size:11px">${esc(area.other)}</span></span>
      <span class="small" style="display:block;margin-top:2px">${cur ? `🌱 <b>${esc(cropById(mainCrop(cur)).ne)}</b> ${esc(cropById(mainCrop(cur)).en.split(' /')[0])}${(cur.crops || []).some(c => c.role === 'aali') ? ' + आली ' + (cur.crops || []).filter(c => c.role === 'aali').map(c => esc(cropById(c.crop).ne)).join(', ') : ''} · ${esc(seasonLabel(cur.season))} · Day ${k.age}` : '<span class="muted">खाली — Khali (no crop)</span>'}</span></span>
    <span style="text-align:right"><b style="font-size:22px;color:var(--red)">${k ? shortMoney(k.total) : '—'}</b><span class="label" style="display:block;font-size:10px">invested</span></span>`;
  if (!open) return `<button class="card lot tight c3" data-act="kToggle" data-id="${f.id}" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px;margin-bottom:8px">${head}</button>`;
  const past = khetiOfField(f.id).filter(x => x.status === 'done');
  const st = (key, val, label, color) => `<div class="stat" data-act="kEntries" data-id="${cur ? cur.id : ''}" data-v="${key}" ${color ? `style="background:${color}"` : ''}><b>${val}</b><span>${label} ›</span></div>`;
  return `<div class="card lot c3">
    <button data-act="kToggle" data-id="${f.id}" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px">${head}</button>
    ${cur ? `<div class="grid3 lotstats" style="margin-top:12px">
        ${st('labour', shortMoney(k.labour), `👷 Labour (${nfmt(k.labourFull + k.labourHalf * 0.5)} din)`)}
        ${st('machine', shortMoney(k.machineHire + k.fuelCost), `🚜 Machine ${nfmt(k.machineHours)} hr`)}
        ${st('input', shortMoney(k.seed + k.fert), '🌱 Seed + मल')}
        ${st('parma', nfmt(k.parmaDays), '🤝 Parma din')}
        ${st('fuel', nfmt(round(k.petrol + k.diesel, 1)) + ' L', '⛽ Fuel')}
        ${st('all', shortMoney(k.total), '💰 Total' + (k.includeFamily && k.family ? ' + 🏠' : '') + (k.includeOwnMachine && k.ownAll ? ' + 🚜' : '') + (k.total === k.cash ? ' Rs' : ''), 'var(--red-l)')}
      </div>
      ${famToggleHtml(k)}
      ${harvestText(k) ? `<div class="small" style="margin-top:8px" data-act="kEntries" data-id="${cur.id}" data-v="harvest">🌾 <b>Harvest:</b> ${esc(harvestText(k))}${k.costPerKg ? ` · cost ${money(k.costPerKg)}/kg` : ''} ›</div>` : ''}
      <div class="kacts">
        <button class="btn sm primary" data-act="kWork" data-id="${cur.id}">👷<br>Work</button>
        <button class="btn sm" data-act="kMachine" data-id="${cur.id}">🚜<br>Machine</button>
        <button class="btn sm" data-act="kInput" data-id="${cur.id}">🌱<br>Seed/मल</button>
        <button class="btn sm" data-act="kHarvest" data-id="${cur.id}">🌾<br>Harvest</button>
      </div>
      <div class="btnrow" style="margin-top:8px"><button class="btn sm ghost" data-act="kEditKheti" data-id="${cur.id}">✎ Kheti</button><button class="btn sm ghost" data-act="kFinish" data-id="${cur.id}">✅ Finish kheti</button></div>`
      : `<button class="btn big green" style="margin-top:10px" data-act="kNewKheti" data-id="${f.id}">🌱 Start new kheti (plant a crop)</button>`}
    ${past.length ? `<details style="margin-top:10px"><summary class="small" style="font-weight:800;color:var(--muted)">Past kheti (${past.length}) · lifetime ${money(S.F[f.id].lifetime)}</summary>
      <div class="summary small" style="margin-top:6px">${past.map(x => { const kk = S.K[x.id]; return `<div class="line" data-act="kOpenKheti" data-id="${x.id}"><span><b>${esc(cropById(mainCrop(x)).ne)}</b> · ${esc(seasonLabel(x.season))}<br><span class="muted">${esc(harvestText(kk, true) || 'no harvest recorded')}</span></span><b>${money(kk.total)} ›</b></div>`; }).join('')}</div></details>` : ''}
    <div class="btnrow" style="margin-top:8px"><button class="btn sm ghost" data-act="kEditField" data-id="${f.id}">✎ Field</button>${cur ? `<button class="btn sm ghost" data-act="kOpenKheti" data-id="${cur.id}">📋 All entries</button>` : ''}</div>
  </div>`;
}

// quick typed labour entry on the dashboard (count only; named workers via the full form)
function quickWorkHtml(act) {
  if (!act.length) return '';
  const q = db.meta.kQuick || (db.meta.kQuick = {});
  if (!act.some(k => k.id === q.khetiId)) q.khetiId = act[0].id;
  if (!q.work) q.work = 'ropai';
  return `<div class="card">
    <div class="label">👷 Quick work entry · today</div>
    <div class="chips" style="margin:8px 0">${act.map(k => kChip('kqKheti', k.id, q.khetiId === k.id, esc(fieldById(k.fieldId) ? fieldById(k.fieldId).name : '?') + ' · ' + esc(cropById(mainCrop(k)).ne))).join('')}</div>
    <div class="chips" style="margin-bottom:8px;max-height:84px;overflow:auto">${workTypes().filter(w => !w.hidden || w.id === q.work).sort((a, b) => (b.id === q.work) - (a.id === q.work)).map(w => kChip('kqWork', w.id, q.work === w.id, esc(w.ne))).join('')}</div>
    <form class="hshop" data-form="kQuick">
      <label><span>Khetala full</span><input data-kq="full" type="number" inputmode="numeric" placeholder="0"></label>
      <label><span>Khetala half</span><input data-kq="half" type="number" inputmode="numeric" placeholder="0"></label>
      <label><span>🤝 Parma</span><input data-kq="parma" type="number" inputmode="decimal" placeholder="0"></label>
    </form>
    <div class="small muted" id="kqHint" style="margin-top:6px">${esc(quickHint())}</div>
    <div class="btnrow" style="margin-top:8px"><button class="btn green" data-act="kqSave">✔ Save work</button><button class="btn ghost" data-act="kWork" data-id="${q.khetiId}">👷 With names…</button></div>
  </div>`;
}
function quickHint() {
  const q = db.meta.kQuick || {}, v = k => Number(($(`[data-kq=${k}]`) || {}).value) || 0;
  const f = wageRate(q.work, 'full'), h = wageRate(q.work, 'half');
  const amt = v('full') * f + v('half') * h;
  return `${workById(q.work).ne}: full Rs ${nfmt(f)} · half Rs ${nfmt(h)}${f || h ? '' : ' — set rates in Settings'}${amt ? ' → ' + money(amt) : ''}`;
}
function saveQuickWork() {
  const q = db.meta.kQuick || {}, v = k => Number(($(`[data-kq=${k}]`) || {}).value) || 0;
  const k = khetiById(q.khetiId);
  if (!k) { toast('Start a kheti first'); return; }
  if (!v('full') && !v('half') && !v('parma')) { toast('Type how many khetala or parma'); return; }
  const rec = { kind: 'fwork', khetiId: k.id, fieldId: k.fieldId, date: today(), workType: q.work, workers: [], extraFull: v('full'), extraHalf: v('half'),
    rateFull: wageRate(q.work, 'full'), rateHalf: wageRate(q.work, 'half'), parma: v('parma') ? [{ family: '', full: v('parma'), half: 0 }] : [], note: '' };
  rec.amount = fworkAmount(rec);
  if (document.activeElement) document.activeElement.blur();
  put(rec); render();
  toast(`Saved ✓ ${workById(rec.workType).ne}: ${rec.extraFull + rec.extraHalf} khetala${v('parma') ? ' + ' + v('parma') + ' parma' : ''} · ${money(rec.amount)}`, rec.id);
}

// ================= FIELD + KHETI FORMS =================
function openFieldForm(f) {
  kDraft = Object.assign({ kind: 'field', name: '', areaM2: 0, sys: landSystem(), location: '', note: '' }, f || {});
  if (f && !f.sys && f.areaInput && f.areaInput.system) kDraft.sys = f.areaInput.system;
  const d = kDraft;
  openSheet(`<h2>${d.id ? '✎ Field' : '+ New field (खेत)'}</h2><div id="kForm">
    <div class="field"><label>Field name</label><input data-k="name" value="${esc(d.name)}" placeholder="e.g. Purbe khet, Tallo bari" autocomplete="off"></div>
    <div class="field"><label>Area</label><div class="seg">${['pahad', 'tarai'].map(s => `<button class="${d.sys === s ? 'on' : ''}" data-act="kFieldSys" data-v="${s}">${s === 'pahad' ? '⛰️ Ropani-Aana' : '🌾 Bigha-Kattha'}</button>`).join('')}</div>
      ${areaInputsHtml(d.sys, d.areaM2, 'ka')}<div class="hint" id="kAreaHint">${d.areaM2 ? esc(fmtArea(d.areaM2, otherSystem(d.sys), 'ne')) + ' · ' + areaExtra(d.areaM2) : ''}</div></div>
    <div class="field"><label>Place / note <span class="muted">(optional)</span></label><input data-k="location" value="${esc(d.location || '')}" placeholder="—" autocomplete="off"></div>
    <button class="btn big green" data-act="kSaveField">✔ Save field</button>
    ${d.id ? `<div style="height:10px"></div><div class="btnrow"><button class="btn ghost" data-act="kFieldClose" data-id="${d.id}">${d.closed ? '↺ Use again' : '⏸ Not in use'}</button><button class="btn redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button></div>${historyHtml(d.id)}` : ''}
  </div>`);
}
function saveFieldForm() {
  kRead();
  const d = kDraft, shown = $$('#kForm [data-ka]').map(e => e.value).join('|');
  const m2 = d.exact && d.exact.shown === shown ? d.exact.m2 : readAreaInputs($('#kForm'), d.sys, 'ka');
  if (!String(d.name || '').trim()) { toast('Type the field name'); return; }
  const parts = LAND[d.sys].units.map((u, i) => Number(($(`#kForm [data-ka="${i}"]`) || {}).value) || 0);
  const rec = { kind: 'field', name: String(d.name).trim(), areaM2: round(m2, 3), areaInput: { system: d.sys, parts }, location: String(d.location || '').trim(), note: '', closed: !!d.closed };
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render();
  toast(`Field ${rec.name} saved ✓ ${fmtArea(rec.areaM2, landSystem(), 'ne')}`);
  if (!d.id) { db.meta.kOpen = kOpenIds().concat([rec.id]).slice(-3); persist(); }
}

function openKhetiForm(k, fieldId) {
  kDraft = Object.assign({ kind: 'kheti', fieldId: fieldId || (activeFields()[0] || {}).id || '', crops: [], variety: '', plantDate: today(), harvestDate: '', season: '', status: 'growing' }, k ? JSON.parse(JSON.stringify(k)) : {});
  renderKhetiForm();
}
function renderKhetiForm() {
  const d = kDraft, main = mainCrop(d), side = (d.crops || []).filter(c => c.role === 'aali').map(c => c.crop);
  const groups = {};
  cropList().filter(c => !c.hidden || (d.crops || []).some(x => x.crop === c.id)).forEach(c => { (groups[c.group] = groups[c.group] || []).push(c); });
  openSheet(`<h2>${d.id ? '✎ Kheti' : '🌱 New kheti'}</h2><div id="kForm">
    <div class="field"><label>Field</label><div class="chips">${activeFields().map(f => kChip('kkField', f.id, d.fieldId === f.id, esc(f.name))).join('')}</div></div>
    <div class="field"><label>Main crop</label>${Object.keys(groups).map(g => `<div class="small muted" style="margin:6px 0 4px">${CROP_GROUPS[g] || g}</div><div class="chips">${groups[g].map(c => kChip('kkMain', c.id, main === c.id, `${esc(c.ne)} <span style="opacity:.7">${esc(c.en.split(' /')[0])}</span>`)).join('')}</div>`).join('')}</div>
    <div class="field"><label>Side crops on the aali (आली) <span class="muted">(optional, tap to add)</span></label><div class="chips">${cropList().filter(c => (c.group === 'pulse' || c.group === 'veg') && (!c.hidden || side.includes(c.id))).map(c => kChip('kkSide', c.id, side.includes(c.id), esc(c.ne))).join('')}</div></div>
    <div class="field"><label>Variety <span class="muted">(optional)</span></label><input data-k="variety" value="${esc(d.variety || '')}" placeholder="e.g. Radha-4, Sabitri" autocomplete="off"></div>
    <div class="field"><label>Planted on (नेपाली)</label>${bsDateHtml('kplant', d.plantDate)}</div>
    <div class="field"><label>Season</label><input data-k="season" value="${esc(d.season || seasonOf(d.plantDate))}" placeholder="auto"><div class="hint">Auto from the planting date: Barkhe (Asar–Bhadra), Hiude (Ashoj–Poush), Chaite (Magh–Jestha)</div></div>
    <button class="btn big green" data-act="kSaveKheti">✔ Save kheti</button>
    ${d.id ? `<div style="height:10px"></div><div class="btnrow">${d.status === 'done' ? `<button class="btn ghost" data-act="kReopen" data-id="${d.id}">↺ Reopen</button>` : ''}<button class="btn redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button></div>${historyHtml(d.id)}` : ''}
  </div>`);
}
function saveKhetiForm() {
  kRead();
  const d = kDraft;
  if (!d.fieldId) { toast('Pick the field'); return; }
  if (!mainCrop(d)) { toast('Pick the main crop'); return; }
  const rec = { kind: 'kheti', fieldId: d.fieldId, crops: d.crops, variety: String(d.variety || '').trim(), plantDate: d.plantDate || today(),
    harvestDate: d.harvestDate || '', season: String(d.season || '').trim() || seasonOf(d.plantDate), status: d.status || 'growing', date: d.plantDate || today() };
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render();
  toast(`Kheti saved ✓ ${khetiTitle(rec)}`);
}

// ================= ENTRY FORMS (labour, machine, seed/fertilizer, harvest, payment, parma out) =================
function khetiChips(sel) {
  const list = activeKhetis(), cur = khetiById(sel);
  if (cur && !list.includes(cur)) list.unshift(cur);
  return `<div class="field"><label>Kheti</label><div class="chips">${list.map(k => kChip('kfKheti', k.id, sel === k.id, esc(khetiTitle(k)))).join('') || '<span class="muted">Start a kheti first</span>'}</div></div>`;
}
function openWorkForm(rec, khetiId) {
  const k0 = khetiId || (activeKhetis()[0] || {}).id || '';
  kDraft = Object.assign({ kind: 'fwork', khetiId: k0, date: today(), workType: 'ropai', workers: [], extraFull: '', extraHalf: '', parma: [], note: '' }, rec ? JSON.parse(JSON.stringify(rec)) : {});
  if (kDraft.rateFull == null || kDraft.rateFull === '') { kDraft.rateFull = wageRate(kDraft.workType, 'full'); kDraft.rateHalf = wageRate(kDraft.workType, 'half'); }
  renderWorkForm();
}
function renderWorkForm() {
  const d = kDraft, ws = workers();
  const shiftOf = id => { const x = (d.workers || []).find(w => w.workerId === id); return x ? x.shift : ''; };
  const fams = families();
  openSheet(`<h2>👷 ${d.id ? 'Edit work day' : 'Work day (khetala / parma)'}</h2><div id="kForm">
    ${khetiChips(d.khetiId)}
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('kwork', d.date)}</div>
    <div class="field"><label>Work</label><div class="chips">${workTypes().filter(w => !w.hidden || w.id === d.workType).map(w => kChip('kfWork', w.id, d.workType === w.id, esc(w.ne))).join('')}</div></div>
    <div class="grid2">${kNum('rateFull', 'Rate full day Rs', d.rateFull)}${kNum('rateHalf', 'Rate half day Rs', d.rateHalf)}</div>
    <div class="field"><label>Khetala who worked <span class="muted">(tap: — → full → half)</span></label>
      <div class="chips">${ws.filter(w => w.active !== false).map(w => { const s = shiftOf(w.id); return `<button class="chip sm ${s ? 'on' : ''}" data-act="kfWorker" data-id="${w.id}">${w.own ? '🏠 ' : ''}${esc(w.name)}${s ? ' · ' + (s === 'half' ? '½' : 'पूरा') : ''}</button>`; }).join('') || '<span class="muted small">No workers yet — add them in 👷 Workers, or use the counts below.</span>'}
      <button class="chip sm" data-act="kAddWorker" data-v="work">+ New</button></div></div>
    <div class="grid2">${kNum('extraFull', 'Other khetala full', d.extraFull, '0', 'int')}${kNum('extraHalf', 'Other khetala half', d.extraHalf, '0', 'int')}</div>
    <div class="field"><label>🤝 Parma (came to help)</label>
      ${(d.parma || []).map((p, i) => `<div class="row" style="gap:6px;margin-bottom:6px"><input data-kp="family" data-i="${i}" list="kFams" value="${esc(p.family || '')}" placeholder="Family / ghar" style="flex:2;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px">
        <input data-kp="full" data-i="${i}" type="number" inputmode="decimal" value="${p.full || ''}" placeholder="full" style="flex:1;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px">
        <input data-kp="half" data-i="${i}" type="number" inputmode="decimal" value="${p.half || ''}" placeholder="half" style="flex:1;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px"></div>`).join('')}
      <datalist id="kFams">${fams.map(f => `<option value="${esc(f)}">`).join('')}</datalist>
      <button class="btn sm ghost" data-act="kfAddParma">+ Parma family</button></div>
    <div class="totalbox"><span><b style="font-size:15px">WAGES</b><br><span class="small" id="kwHint">${esc(workHint())}</span></span><b id="kwTotal">${money(fworkAmount(workDraftRec()))}</b></div>
    <div class="field"><label>Note <span class="muted">(optional)</span></label><input data-k="note" value="${esc(d.note || '')}" placeholder="—" autocomplete="off"></div>
    <button class="btn big green" data-act="kSaveWork">✔ Save work day</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}
  </div>`);
}
function workReadParma() {
  $$('#kForm [data-kp]').forEach(el => { const p = kDraft.parma[+el.dataset.i]; if (p) p[el.dataset.kp] = el.dataset.kp === 'family' ? el.value : (Number(el.value) || 0); });
}
function workDraftRec() {
  const d = kDraft, rf = Number(d.rateFull) || 0, rh = Number(d.rateHalf) || 0;
  return Object.assign({}, d, { rateFull: rf, rateHalf: rh, extraFull: Number(d.extraFull) || 0, extraHalf: Number(d.extraHalf) || 0,
    workers: (d.workers || []).map(w => ({ workerId: w.workerId, shift: w.shift, rate: w.shift === 'half' ? rh : rf })) });
}
function workHint() {
  const r = workDraftRec(), paid = r.workers.filter(w => !isOwn(w.workerId)), fam = r.workers.length - paid.length, n = paid.length + r.extraFull + r.extraHalf;
  return `${n} khetala (${paid.filter(w => w.shift !== 'half').length + r.extraFull} full, ${paid.filter(w => w.shift === 'half').length + r.extraHalf} half)${fam ? ` · 🏠 ${fam} family (${money(fworkFamily(r))}, not paid)` : ''}`;
}
function updWorkTotal() { kRead(); workReadParma(); const t = $('#kwTotal'), h = $('#kwHint'); if (t) t.textContent = money(fworkAmount(workDraftRec())); if (h) h.textContent = workHint(); }
function saveWorkForm() {
  kRead(); workReadParma();
  const d = kDraft, k = khetiById(d.khetiId);
  if (!k) { toast('Pick the kheti'); return; }
  const r = workDraftRec();
  r.parma = (r.parma || []).filter(p => (Number(p.full) || 0) + (Number(p.half) || 0) > 0);
  if (!r.workers.length && !r.extraFull && !r.extraHalf && !r.parma.length) { toast('Pick khetala or type a count'); return; }
  const rec = { kind: 'fwork', khetiId: k.id, fieldId: k.fieldId, date: d.date || today(), workType: d.workType, workers: r.workers, extraFull: r.extraFull, extraHalf: r.extraHalf,
    rateFull: r.rateFull, rateHalf: r.rateHalf, parma: r.parma, note: String(d.note || '').trim() };
  rec.amount = fworkAmount(rec);
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render();
  toast(`Saved ✓ ${workById(rec.workType).ne} · ${money(rec.amount)}`, d.id ? null : rec.id);
  if (rec.rateFull !== wageRate(rec.workType, 'full') || rec.rateHalf !== wageRate(rec.workType, 'half')) {
    ask({ title: `Save these rates for ${workById(rec.workType).ne}?`, sub: `Full Rs ${nfmt(rec.rateFull)} · Half Rs ${nfmt(rec.rateHalf)} (used next time)`,
      buttons: [{ label: 'Yes, save rates', value: 'yes', cls: 'primary' }, { label: 'No', value: 'no' }], onAnswer: a => { if (a === 'yes') setWageRate(rec.workType, rec.rateFull, rec.rateHalf); } });
  }
}

function openMachineForm(rec, khetiId) {
  kDraft = Object.assign({ kind: 'machine', khetiId: khetiId || (activeKhetis()[0] || {}).id || '', date: today(), type: 'hiredTractor', hours: '', ratePerHour: '', hireAmount: '', fuel: '', litres: '', fuelCost: '', note: '' }, rec || {});
  if (!(MACHINES[kDraft.type] || {}).hired && !kDraft.ratePerHour) kDraft.ratePerHour = ownMachineRate(kDraft.type) || '';
  if (!(MACHINES[kDraft.type] || {}).hired && !kDraft.myRate) kDraft.myRate = myTimeRate() || '';
  renderMachineForm();
}
function renderMachineForm() {
  const d = kDraft, m = MACHINES[d.type] || {};
  openSheet(`<h2>🚜 ${d.id ? 'Edit machine' : 'Machine & fuel'}</h2><div id="kForm">
    ${khetiChips(d.khetiId)}
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('kmach', d.date)}</div>
    <div class="field"><label>Machine</label><div class="chips">${Object.keys(MACHINES).map(k => kChip('kfMach', k, d.type === k, MACHINES[k].icon + ' ' + MACHINES[k].en)).join('')}</div></div>
    ${m.hired ? '' : (() => { const mine = myMachinesOfType(d.type); if (mine.length === 1 && !d.machineId) d.machineId = mine[0].id;
      return `<div class="field"><label>Which machine</label><div class="chips">${mine.map(x => `<button class="chip sm ${d.machineId === x.id ? 'on' : ''}" data-act="kmPick" data-id="${x.id}">${esc(x.name)}</button>`).join('')}<button class="chip sm" data-act="kmNewFromUse">+ Add my ${esc(MACHINE_TYPE_NAME(d.type).replace(/^Own /, '').toLowerCase())}</button></div></div>`; })()}
    <div class="grid2">${kNum('hours', 'Hours', d.hours)}${kNum('ratePerHour', m.hired ? 'Rate per hour Rs' : 'Own machine rate / hour Rs', d.ratePerHour)}</div>
    ${m.hired ? kAmt('hireAmount', 'Hire paid Rs (auto = hours × rate)', d.hireAmount, 'auto · or 3×1500', 'hours', 'ratePerHour')
      : `<div class="hint" id="kmOwnHint" style="margin:-6px 0 12px">${esc(ownMachineHint())}</div>
      <div class="field"><label>🧑 My time (driving / running it)</label>
        <div class="grid2">${kNum('myHours', 'My hours', d.myHours, nfmt(num(d.hours) || 0) + ' (same)')}${kNum('myRate', 'My rate / hour Rs', d.myRate)}</div>
        <div class="hint" id="kmMyHint" style="margin-top:-6px">${esc(myTimeHint())}</div></div>`}
    <div class="field"><label>Fuel</label><div class="chips">${kChip('kfFuel', '', !d.fuel, 'None')}${kChip('kfFuel', 'petrol', d.fuel === 'petrol', '⛽ Petrol')}${kChip('kfFuel', 'diesel', d.fuel === 'diesel', '🛢️ Diesel')}</div></div>
    ${d.fuel ? `<div class="grid2">${kNum('litres', 'Litres', d.litres)}${kAmt('fuelCost', 'Fuel cost Rs', d.fuelCost, 'e.g. 2×200', 'litres')}</div>` : ''}
    <div class="field"><label>Note <span class="muted">(optional)</span></label><input data-k="note" value="${esc(d.note || '')}" placeholder="—" autocomplete="off"></div>
    <button class="btn big green" data-act="kSaveMachine">✔ Save</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}
  </div>`);
}
function ownMachineHint() {
  const h = num(($('#kForm [data-k=hours]') || {}).value != null ? $('#kForm [data-k=hours]').value : kDraft.hours) || 0;
  const r = num(($('#kForm [data-k=ratePerHour]') || {}).value != null ? $('#kForm [data-k=ratePerHour]').value : kDraft.ratePerHour) || 0;
  return `Own machine value = hours × rate${h && r ? ' = ' + money(h * r) : ''}. It counts in the crop's cost only when the crop's 🚜 Own machine switch is on. Fuel is always counted.`;
}
function myTimeHint() {
  const f = k => { const el = $(`#kForm [data-k=${k}]`); return num(el ? el.value : kDraft[k]); };
  const h = f('myHours') != null ? f('myHours') : (f('hours') || 0), r = f('myRate') || 0;
  return r ? `My time ${nfmt(h)} hr × ${money(r)} = ${money(h * r)} (with the 🚜 switch)` : 'Optional. Leave the rate empty to skip.';
}
function saveMachineForm() {
  kRead();
  const d = kDraft, k = khetiById(d.khetiId), m = MACHINES[d.type] || {};
  if (!k) { toast('Pick the kheti'); return; }
  const hours = num(d.hours) || 0, rate = num(d.ratePerHour) || 0;
  const hire = m.hired ? (num(d.hireAmount) != null ? num(d.hireAmount) : round(hours * rate, 2)) : 0;
  const rec = { kind: 'machine', khetiId: k.id, fieldId: k.fieldId, date: d.date || today(), type: d.type, hours, ratePerHour: rate, hireAmount: hire,
    ownValue: m.hired ? 0 : round(hours * rate, 2), fuel: d.fuel || '', ...(m.hired || !d.machineId ? {} : { machineId: d.machineId }),
    myHours: m.hired ? 0 : (num(d.myHours) != null ? num(d.myHours) : hours), myRate: m.hired ? 0 : num(d.myRate) || 0, litres: d.fuel ? num(d.litres) || 0 : 0, fuelCost: d.fuel ? num(d.fuelCost) || 0 : 0, note: String(d.note || '').trim() };
  rec.myValue = round(rec.myHours * rec.myRate, 2);
  if (!m.hired && rate && rate !== ownMachineRate(d.type)) setOwnMachineRate(d.type, rate);   // remembered for next time
  if (!m.hired && rec.myRate && rec.myRate !== myTimeRate()) setSet('myTimeRate', rec.myRate);
  if (!hours && !hire && !rec.litres && !rec.fuelCost) { toast('Type hours, hire or fuel'); return; }
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render();
  toast(`Saved ✓ ${m.en} ${hours ? nfmt(hours) + ' hr' : ''} · ${money(hire + rec.fuelCost)}${rec.ownValue ? ' · own value ' + money(rec.ownValue) : ''}${rec.myValue ? ' · my time ' + money(rec.myValue) : ''}`, d.id ? null : rec.id);
}

function openInputForm(rec, khetiId) {
  kDraft = Object.assign({ kind: 'finput', khetiId: khetiId || (activeKhetis()[0] || {}).id || '', date: today(), type: 'fert', item: 'Urea', qty: '', unit: 'bora', cost: '', note: '' }, rec || {});
  renderInputForm();
}
function renderInputForm() {
  const d = kDraft;
  openSheet(`<h2>🌱 ${d.id ? 'Edit' : 'Seed / fertilizer (मल)'}</h2><div id="kForm">
    ${khetiChips(d.khetiId)}
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('kinput', d.date)}</div>
    <div class="field"><label>What</label><div class="chips">${kChip('kfInType', 'seed', d.type === 'seed', '🌱 Seed / बीउ')}${kChip('kfInType', 'fert', d.type === 'fert', '🧪 Fertilizer / मल')}</div></div>
    ${d.type === 'fert' ? `<div class="field"><label>Which मल</label><div class="chips">${fertList().filter(x => !x.hidden || x.en === d.item).map(x => kChip('kfInItem', x.en, (FERT_ALIAS[d.item] || d.item) === x.en, `${esc(x.ne)} <span style="opacity:.7">${esc(x.en.replace(/ mal.*$/, ''))}</span>`)).join('')}${kChip('kfInItem', 'Other', !fertList().some(x => x.en === (FERT_ALIAS[d.item] || d.item)), 'अन्य Other')}</div>${fertList().some(x => x.en === (FERT_ALIAS[d.item] || d.item)) ? '' : `<input data-k="item" value="${esc(d.item || '')}" placeholder="Name of the मल" autocomplete="off" style="margin-top:8px">`}</div>`
      : `<div class="field"><label>Seed (variety)</label><input data-k="item" value="${esc(d.item === 'Urea' ? '' : d.item || '')}" placeholder="e.g. Dhaan Radha-4" autocomplete="off"></div>`}
    <div class="grid2">${kNum('qty', 'Quantity', d.qty)}<div class="field"><label>Unit</label><div class="chips">${INPUT_UNITS[d.type === 'fert' ? 'fert' : 'seed'].concat(INPUT_UNITS[d.type === 'fert' ? 'fert' : 'seed'].includes(d.unit) ? [] : [d.unit]).map(u => kChip('kfInUnit', u, d.unit === u, UNIT_NE[u] || u)).join('')}</div></div></div>
    ${kAmt('cost', 'Cost Rs', d.cost, 'e.g. 2×4500', 'qty')}
    <div class="field"><label>Note <span class="muted">(optional)</span></label><input data-k="note" value="${esc(d.note || '')}" placeholder="—" autocomplete="off"></div>
    <button class="btn big green" data-act="kSaveInput">✔ Save</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}
  </div>`);
}
function saveInputForm() {
  kRead();
  const d = kDraft, k = khetiById(d.khetiId);
  if (!k) { toast('Pick the kheti'); return; }
  const rec = { kind: 'finput', khetiId: k.id, fieldId: k.fieldId, date: d.date || today(), type: d.type, item: String(d.item || '').trim() || (d.type === 'seed' ? 'Seed' : 'Fertilizer'),
    qty: num(d.qty) || 0, unit: d.unit || 'kg', cost: num(d.cost) || 0, note: String(d.note || '').trim() };
  if (!rec.qty && !rec.cost) { toast('Type quantity or cost'); return; }
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render();
  toast(`Saved ✓ ${rec.item} ${rec.qty ? nfmt(rec.qty) + ' ' + rec.unit : ''} · ${money(rec.cost)}`, d.id ? null : rec.id);
}

function openHarvestForm(rec, khetiId) {
  const k = khetiById(khetiId || (rec && rec.khetiId)) || activeKhetis()[0];
  kDraft = Object.assign({ kind: 'harvest', khetiId: k ? k.id : '', crop: k ? mainCrop(k) : '', date: today(), qty: '', unit: 'muri', note: '' }, rec || {});
  renderHarvestForm();
}
function renderHarvestForm() {
  const d = kDraft, k = khetiById(d.khetiId), crops = k ? (k.crops || []).map(c => c.crop) : [];
  const kg = harvestKg({ qty: num(d.qty) || 0, unit: d.unit, crop: d.crop });
  openSheet(`<h2>🌾 ${d.id ? 'Edit harvest' : 'Harvest (उत्पादन)'}</h2><div id="kForm">
    <div class="field"><label>Kheti</label><div class="chips">${khetis().slice(0, 12).map(x => kChip('kfKheti', x.id, d.khetiId === x.id, esc(khetiTitle(x)) + (x.status === 'done' ? ' ✓' : ''))).join('')}</div></div>
    <div class="field"><label>Crop</label><div class="chips">${crops.map(c => kChip('kfHCrop', c, d.crop === c, esc(cropById(c).ne) + ' ' + esc(cropById(c).en.split(' /')[0]))).join('')}</div></div>
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('kharv', d.date)}</div>
    <div class="grid2">${kNum('qty', 'Quantity', d.qty)}<div class="field"><label>Unit</label><div class="chips">${Object.keys(HARVEST_UNITS).map(u => kChip('kfHUnit', u, d.unit === u, u)).join('')}</div></div></div>
    <div class="hint" id="khHint">${kg ? '≈ ' + nfmt(round(kg, 1)) + ' kg' : ''} · 1 pathi ${esc(cropById(d.crop).ne)} = ${pathiKg(d.crop)} kg, 1 bora = ${boraKg(d.crop)} kg (Settings)</div>
    <div class="field" style="margin-top:10px"><label>Note <span class="muted">(optional)</span></label><input data-k="note" value="${esc(d.note || '')}" placeholder="—" autocomplete="off"></div>
    <button class="btn big green" data-act="kSaveHarvest">✔ Save harvest</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}
  </div>`);
}
function saveHarvestForm() {
  kRead();
  const d = kDraft, k = khetiById(d.khetiId);
  if (!k) { toast('Pick the kheti'); return; }
  if (!num(d.qty)) { toast('Type the quantity'); return; }
  const rec = { kind: 'harvest', khetiId: k.id, fieldId: k.fieldId, crop: d.crop || mainCrop(k), date: d.date || today(), qty: num(d.qty), unit: d.unit || 'kg', note: String(d.note || '').trim() };
  rec.kg = round(harvestKg(rec), 2);
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render();
  toast(`Saved ✓ ${cropById(rec.crop).ne} ${nfmt(rec.qty)} ${rec.unit} (≈ ${nfmt(round(rec.kg))} kg)`, d.id ? null : rec.id);
}

// ================= WORKERS & SETTLEMENT =================
function renderWorkers() {
  const S = computeKheti(), ws = workers();
  const byFam = {}, own = ws.filter(w => w.own);
  ws.filter(w => !w.own).forEach(w => { (byFam[w.family || '—'] = byFam[w.family || '—'] || []).push(w); });
  const famValue = own.reduce((a, w) => a + S.W[w.id].earned, 0);
  const dueTotal = Object.values(S.W).reduce((a, w) => a + Math.max(0, w.due), 0);
  const parma = Object.values(S.P).filter(p => p.came || p.went).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  $('#v-workers').innerHTML = `
    <div class="card"><div class="row between"><div><div class="label">👷 Wages still to pay</div><div class="huge" style="color:var(--red)">${money(dueTotal)}</div></div>
      <div style="text-align:right"><button class="btn primary" data-act="kAddWorker">+ Worker</button><div style="height:6px"></div><button class="btn sm ghost" data-act="kPickContact">📇 From contacts</button></div></div></div>
    <div class="row between" style="margin-top:6px"><h3 style="margin:0">🏠 आफ्नै परिवार <span class="small muted">· my household</span></h3><button class="btn sm ghost" data-act="kAddWorker" data-v="own">+ Member</button></div>
    ${own.length ? own.map(w => { const x = S.W[w.id]; return `<button class="item" data-act="kWorker" data-id="${w.id}">
      <div class="ic" style="background:var(--amber-l)">🏠</div><div class="mid"><div class="t">${esc(w.name)}</div><div class="s">${x.fullDays} full + ${x.halfDays} half · not paid</div></div>
      <div class="amt">${money(x.earned)}<div class="small muted">work value</div></div></button>`; }).join('')
      : '<p class="small muted">Add the people of your own home who work in the fields. Their days are recorded and valued at the normal rate, but never shown as wages due. Each crop has a switch to count this value in its cost or not.</p>'}
    ${own.length ? `<p class="small muted" style="margin-top:-4px">Family work value: ${money(famValue)}</p>` : ''}
    <h3>👷 Hired khetala</h3>
    ${ws.some(w => !w.own) ? Object.keys(byFam).sort().map(f => `<h3>🏠 ${esc(f)}</h3>${byFam[f].map(w => { const x = S.W[w.id]; return `<button class="item" data-act="kWorker" data-id="${w.id}">
      <div class="ic" style="background:var(--green-l)">👷</div><div class="mid"><div class="t">${esc(w.name)}</div><div class="s">${esc(w.phone || 'no number')} · ${x.fullDays} full + ${x.halfDays} half · earned ${money(x.earned)}</div></div>
      <div class="amt" style="color:${x.due > 0 ? 'var(--red)' : 'var(--green)'}">${x.due > 0 ? money(x.due) + '<div class="small muted">due</div>' : x.earned ? '✓ settled' : '<span class="small muted">no work yet</span>'}</div></button>`; }).join('')}`).join('')
      : '<div class="card empty"><div class="e">👷</div><p>No workers yet. Add khetala by name (or pick from your contacts).</p></div>'}
    <h2>🤝 Parma balance</h2>
    ${parma.length ? `<div class="summary">${parma.map(p => `<div class="line"><span><b>${esc(p.family)}</b><br><span class="small muted">came ${nfmt(p.came)} din · we went ${nfmt(p.went)} din</span></span><b style="color:${p.balance > 0 ? 'var(--red)' : 'var(--green)'}">${p.balance > 0 ? 'we owe ' + nfmt(p.balance) + ' din' : p.balance < 0 ? 'owes us ' + nfmt(-p.balance) + ' din' : 'even ✓'}</b></div>`).join('')}</div>` : '<p class="muted">Parma who come to help are recorded on work days.</p>'}
    <button class="btn big ghost" data-act="kParmaOut">🤝 We worked for a family (parma tirne)</button>`;
}
function openWorkerForm(w, back) {
  kDraft = Object.assign({ kind: 'worker', name: '', family: back === 'own' ? 'आफ्नै परिवार' : '', own: back === 'own', phone: '', village: '', note: '', active: true, back }, w || {});
  const d = kDraft;
  openSheet(`<h2>${d.id ? '✎ Worker' : '+ New worker (खेताला)'}</h2><div id="kForm">
    <button class="btn ghost" style="width:100%;margin-bottom:10px" data-act="kPickContact">📇 Pick from phone contacts</button>
    <div class="field"><label>Name</label><input data-k="name" value="${esc(d.name)}" placeholder="e.g. Ram Bahadur" autocomplete="off"></div>
    <label class="switch" style="margin-bottom:8px"><span><b>🏠 My own household (आफ्नै परिवार)</b><br><span class="small muted">Not paid wages; their work is counted as family work</span></span><input type="checkbox" data-k="own" ${d.own ? 'checked' : ''}></label>
    <div class="field"><label>Family / ghar (थर)</label><input data-k="family" list="kFams2" value="${esc(d.family || '')}" placeholder="e.g. Thapa ghar" autocomplete="off">
      <datalist id="kFams2">${families().map(f => `<option value="${esc(f)}">`).join('')}</datalist></div>
    <div class="field"><label>Phone</label><input data-k="phone" type="tel" inputmode="tel" value="${esc(d.phone || '')}" placeholder="98XXXXXXXX"></div>
    <div class="field"><label>Village / tole <span class="muted">(optional)</span></label><input data-k="village" value="${esc(d.village || '')}" placeholder="—" autocomplete="off"></div>
    <button class="btn big green" data-act="kSaveWorker">✔ Save worker</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}
  </div>`);
}
window.onContactPicked = (name, phone) => {
  if (!name && !phone) { toast('No contact picked'); return; }
  if (!kDraft || kDraft.kind !== 'worker' || !$('#kForm')) openWorkerForm(null);
  kDraft.name = kDraft.name || name || ''; kDraft.phone = String(phone || '').replace(/[^\d+]/g, '');
  const n = $('#kForm [data-k=name]'), p = $('#kForm [data-k=phone]');
  if (n && !n.value) n.value = kDraft.name; if (p) p.value = kDraft.phone;
  toast(`📇 ${name || ''} ${phone || ''}`);
};
function saveWorkerForm() {
  kRead();
  const d = kDraft;
  if (!String(d.name || '').trim()) { toast('Type the name'); return; }
  const rec = { kind: 'worker', name: String(d.name).trim(), family: String(d.family || '').trim() || (d.own ? 'आफ्नै परिवार' : ''), own: !!d.own, phone: String(d.phone || '').trim(), village: String(d.village || '').trim(), note: '', active: true };
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec);
  toast(`${rec.own ? '🏠 Household member' : 'Worker'} ${rec.name} saved ✓`);
  if (d.back === 'work' && kDraft) { closeSheet(); render(); openWorkForm(null); return; }
  closeSheet(); render();
}
function openWorkerAccount(id) {
  const w = workerById(id); if (!w) return;
  const S = computeKheti(), x = S.W[id];
  const lines = [];
  all('fwork').forEach(r => (r.workers || []).forEach(y => { if (y.workerId === id) lines.push({ date: r.date, t: 'work', text: `${workById(r.workType).ne} · ${khetiById(r.khetiId) ? khetiTitle(khetiById(r.khetiId)) : ''} · ${y.shift === 'half' ? 'half' : 'full'}`, amt: Number(y.rate) || 0, id: r.id }); }));
  all('fpay').filter(p => p.workerId === id).forEach(p => lines.push({ date: p.date, t: 'pay', text: `Paid${p.method ? ' (' + p.method + ')' : ''}${p.note ? ' · ' + p.note : ''}`, amt: -(Number(p.amount) || 0), id: p.id }));
  lines.sort((a, b) => b.date.localeCompare(a.date));
  openSheet(`<h2>${w.own ? '🏠' : '👷'} ${esc(workerLabel(w))}</h2>
    <div class="row wrap" style="gap:6px;margin-bottom:10px">
      ${w.phone ? `<button class="btn sm" data-act="kCall" data-v="${esc(w.phone)}">📞 Call</button><button class="btn sm" data-act="kSaveContact" data-id="${w.id}">💾 Save to contacts</button>` : ''}
      <button class="btn sm" data-act="kShareContact" data-id="${w.id}">📤 Share</button><button class="btn sm ghost" data-act="kEditWorker" data-id="${w.id}">✎ Edit</button></div>
    ${x.own ? `<div class="summary">
      <div class="line"><span>🏠 Household member</span><b>not paid</b></div>
      <div class="line"><span>Worked</span><b>${x.fullDays} full + ${x.halfDays} half</b></div>
      <div class="line"><span><b>Work value</b> (at normal rates)</span><b style="font-size:22px">${money(x.earned)}</b></div></div>
      <div class="btnrow"><button class="btn ghost" data-act="kShareStatement" data-id="${w.id}">📤 Statement</button></div>` : `<div class="summary">
      <div class="line"><span>Worked</span><b>${x.fullDays} full + ${x.halfDays} half</b></div>
      <div class="line"><span>Earned</span><b>${money(x.earned)}</b></div>
      <div class="line"><span>Paid</span><b style="color:var(--green)">${money(x.paid)}</b></div>
      <div class="line"><span><b>Due</b></span><b style="font-size:24px;color:${x.due > 0 ? 'var(--red)' : 'var(--green)'}">${money(x.due)}</b></div></div>
    <div class="btnrow"><button class="btn green" data-act="kPay" data-id="${w.id}">💵 Pay</button>${x.due > 0 ? `<button class="btn primary" data-act="kSettle" data-id="${w.id}">✔ Settle ${money(x.due)}</button>` : ''}<button class="btn ghost" data-act="kShareStatement" data-id="${w.id}">📤 Statement</button></div>`}
    <h3>Statement</h3>
    ${lines.length ? `<div class="summary small">${lines.map(l => `<div class="line" data-act="editRec" data-id="${l.id}"><span>${fmtDate(l.date)} · ${esc(l.text)}</span><b style="white-space:nowrap;color:${l.t === 'pay' ? 'var(--green)' : 'inherit'}">${l.t === 'pay' ? '−' : ''}${money(Math.abs(l.amt))}</b></div>`).join('')}</div>` : '<p class="muted">No work or payments yet.</p>'}
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}
function workerStatementText(id) {
  const w = workerById(id), x = computeKheti().W[id];
  const lines = [];
  all('fwork').forEach(r => (r.workers || []).forEach(y => { if (y.workerId === id) lines.push([r.date, `${workById(r.workType).ne} ${y.shift === 'half' ? '(½)' : ''}`, money(y.rate)]); }));
  all('fpay').filter(p => p.workerId === id).forEach(p => lines.push([p.date, 'भुक्तानी Paid', '−' + money(p.amount)]));
  lines.sort((a, b) => a[0].localeCompare(b[0]));
  return [`${x.own ? '🏠' : '👷'} ${workerLabel(w)} — ग्राम हिसाब`, ...lines.map(l => `${fmtDate(l[0], true)} · ${l[1]} · ${l[2]}`), '', x.own ? `Work value ${money(x.earned)} (household, not paid)` : `Earned ${money(x.earned)} · Paid ${money(x.paid)} · Due ${money(x.due)}`].join('\n');
}
function openPayForm(id, amount) {
  const w = workerById(id), due = computeKheti().W[id].due;
  ask({ title: `💵 Pay ${w.name}`, sub: `Due now: ${money(due)}`, input: { placeholder: amount ? String(amount) : 'Rs' },
    buttons: [{ label: `✔ Pay full due ${money(due)}`, value: 'due', cls: 'green' }],
    onAnswer: a => {
      const amt = a === 'due' ? due : Number(a);
      if (!(amt > 0)) { toast('Type the amount'); return; }
      const rec = put({ kind: 'fpay', workerId: id, date: today(), amount: round(amt, 2), method: 'cash', note: a === 'due' ? 'Settled' : '' });
      render(); toast(`Paid ✓ ${w.name} ${money(rec.amount)} · due now ${money(computeKheti().W[id].due)}`, rec.id);
      openWorkerAccount(id);
    } });
}
function openParmaOutForm(rec) {
  kDraft = Object.assign({ kind: 'parmaout', date: today(), family: '', full: '', half: '', note: '' }, rec || {});
  const d = kDraft;
  openSheet(`<h2>🤝 We worked for a family (parma)</h2><div id="kForm">
    <div class="field"><label>Family / ghar</label><input data-k="family" list="kFams3" value="${esc(d.family)}" placeholder="e.g. Thapa ghar" autocomplete="off"><datalist id="kFams3">${families().map(f => `<option value="${esc(f)}">`).join('')}</datalist></div>
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('kparma', d.date)}</div>
    <div class="grid2">${kNum('full', 'Full days (people × days)', d.full)}${kNum('half', 'Half days', d.half)}</div>
    <div class="field"><label>Note <span class="muted">(optional)</span></label><input data-k="note" value="${esc(d.note || '')}" placeholder="e.g. their ropai" autocomplete="off"></div>
    <button class="btn big green" data-act="kSaveParmaOut">✔ Save</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}</div>`);
}
function saveParmaOutForm() {
  kRead();
  const d = kDraft;
  if (!String(d.family || '').trim() || !((num(d.full) || 0) + (num(d.half) || 0))) { toast('Type family and days'); return; }
  const rec = { kind: 'parmaout', date: d.date || today(), family: String(d.family).trim(), full: num(d.full) || 0, half: num(d.half) || 0, note: String(d.note || '').trim() };
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render(); toast(`Saved ✓ parma for ${rec.family}`);
}

// ================= WORK PAGE (all entry buttons + recent) =================
function renderKWork() {
  const recent = Object.values(db.records).filter(r => !hidden(r) && ['fwork', 'machine', 'finput', 'harvest', 'fpay', 'parmaout', 'kheti', 'mservice'].includes(r.kind))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt).slice(0, 60);
  let last = '', html = '';
  recent.forEach(r => { if (r.date !== last) { last = r.date; html += `<div class="dayhead"><span>${fmtDate(r.date, true)}</span></div>`; } html += kItemHtml(r); });
  $('#v-kwork').innerHTML = `<h2>📝 Record kheti work</h2>
    <div class="grid2">
      <button class="btn big green" data-act="kWork">👷 Work day</button><button class="btn big" data-act="kMachine">🚜 Machine & fuel</button>
      <button class="btn big" data-act="kInput">🌱 Seed / मल</button><button class="btn big" data-act="kHarvest">🌾 Harvest</button>
      <button class="btn big" data-act="goMachines">🚜 My machines</button><button class="btn big" data-act="mmService">🔧 Servicing</button>
      <button class="btn big ghost" data-act="kNewKheti">🌱 New kheti</button><button class="btn big ghost" data-act="kParmaOut">🤝 Parma tirne</button></div>
    <p class="small muted" style="text-align:center">Or tap 🎤: “Purbe khet ropai 6 khetala 3 parma”, “tractor 3 ghanta 1500”, “DAP 2 bora 9000”, “dhaan 20 muri”</p>
    <h2>Recent</h2>${html || '<p class="muted">Nothing yet.</p>'}`;
}
function kItemHtml(r) {
  let ic = '•', t = '', s = '', amt = '';
  const kt = r.khetiId && khetiById(r.khetiId) ? khetiTitle(khetiById(r.khetiId)) : '';
  if (r.kind === 'fwork') { ic = '👷'; t = `${workById(r.workType).ne} · ${(r.workers || []).length + (r.extraFull || 0) + (r.extraHalf || 0)} khetala${(r.parma || []).length ? ' + parma' : ''}`; s = kt; amt = money(fworkAmount(r)); }
  else if (r.kind === 'machine') { const m = MACHINES[r.type] || {}; ic = m.icon || '🚜'; t = `${r.machineId && myMachineById(r.machineId) ? myMachineById(r.machineId).name : m.en || r.type}${r.hours ? ' · ' + nfmt(r.hours) + ' hr' : ''}${r.litres ? ' · ' + nfmt(r.litres) + ' L ' + r.fuel : ''}`; s = kt + (machineOwnValue(r) ? ' · own value ' + money(machineOwnValue(r)) : '') + (machineMyValue(r) ? ' · my time ' + money(machineMyValue(r)) : ''); amt = money((r.hireAmount || 0) + (r.fuelCost || 0)); }
  else if (r.kind === 'finput') { ic = r.type === 'seed' ? '🌱' : '🧪'; t = `${r.item}${r.qty ? ' · ' + nfmt(r.qty) + ' ' + r.unit : ''}`; s = kt; amt = money(r.cost); }
  else if (r.kind === 'harvest') { ic = '🌾'; t = `${cropById(r.crop).ne} ${nfmt(r.qty)} ${r.unit} (≈ ${nfmt(round(r.kg || harvestKg(r)))} kg)`; s = kt; }
  else if (r.kind === 'fpay') { ic = '💵'; t = `Paid ${workerLabel(workerById(r.workerId))}`; amt = money(r.amount); }
  else if (r.kind === 'parmaout') { ic = '🤝'; t = `Parma for ${r.family} · ${nfmt((r.full || 0) + (r.half || 0) * 0.5)} din`; }
  else if (r.kind === 'kheti') { ic = '🌱'; t = `New kheti: ${khetiTitle(r)}`; s = seasonLabel(r.season); }
  else if (r.kind === 'mservice') { const m = myMachineById(r.machineId); ic = '🔧'; t = `Servicing ${m ? m.name : ''}`; s = (r.items || []).map(i => serviceItemName(i.item)).join(', '); amt = money(serviceTotal(r)); }
  return `<button class="item" data-act="editRec" data-id="${r.id}"><div class="ic" style="background:var(--green-l)">${ic}</div>
    <div class="mid"><div class="t">${esc(t)}</div><div class="s">${s ? esc(s) + ' · ' : ''}${whoWhen(r)}</div></div><div class="amt">${amt}</div></button>`;
}
// all entries of one kheti, optionally one kind
function openKhetiEntries(khetiId, key) {
  const k = khetiById(khetiId); if (!k) return;
  const S = computeKheti().K[khetiId];
  const f = { labour: r => r.kind === 'fwork', parma: r => r.kind === 'fwork' && (r.parma || []).length, machine: r => r.kind === 'machine', fuel: r => r.kind === 'machine' && r.fuel,
    input: r => r.kind === 'finput', harvest: r => r.kind === 'harvest', all: r => ['fwork', 'machine', 'finput', 'harvest'].includes(r.kind) }[key] || (() => true);
  const list = Object.values(db.records).filter(r => !hidden(r) && r.khetiId === khetiId && f(r)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
  openSheet(`<h2>${esc(khetiTitle(k))}</h2><div class="small muted" style="margin:-6px 0 10px">${esc(seasonLabel(k.season))} · planted ${fmtDate(k.plantDate, true)}${k.variety ? ' · ' + esc(k.variety) : ''}</div>
    <div class="summary small">
      <div class="line"><span>👷 Labour (${nfmt(S.labourFull)} full, ${nfmt(S.labourHalf)} half)</span><b>${money(S.labour)}</b></div>
      <div class="line"><span>🤝 Parma</span><b>${nfmt(S.parmaDays)} din</b></div>
      <div class="line"><span>🚜 Machine hire (${nfmt(S.machineHours - S.ownMachineHours)} hr)</span><b>${money(S.machineHire)}</b></div>
      <div class="line"><span>⛽ Fuel (petrol ${nfmt(S.petrol)} L · diesel ${nfmt(S.diesel)} L)</span><b>${money(S.fuelCost)}</b></div>
      <div class="line"><span>🌱 Seed</span><b>${money(S.seed)}</b></div>
      <div class="line"><span>🧪 Fertilizer</span><b>${money(S.fert)}</b></div>
      ${S.family || workers().some(w => w.own) ? `<div class="line"><span>🏠 Family work (${nfmt(S.familyFull)} full, ${nfmt(S.familyHalf)} half)${S.includeFamily ? '' : ' <span class="muted">— not counted</span>'}</span><b style="${S.includeFamily ? '' : 'color:var(--muted);text-decoration:line-through'}">${money(S.family)}</b></div>` : ''}
      ${S.ownMachine || S.ownMachineHours ? `<div class="line"><span>🚜 Own machine (${nfmt(S.ownMachineHours)} hr)${S.includeOwnMachine ? '' : ' <span class="muted">— not counted</span>'}</span><b style="${S.includeOwnMachine ? '' : 'color:var(--muted);text-decoration:line-through'}">${money(S.ownMachine)}</b></div>` : ''}
      ${S.myTime ? `<div class="line"><span>🧑 My time (${nfmt(S.myTimeHours)} hr)${S.includeOwnMachine ? '' : ' <span class="muted">— not counted</span>'}</span><b style="${S.includeOwnMachine ? '' : 'color:var(--muted);text-decoration:line-through'}">${money(S.myTime)}</b></div>` : ''}
      <div class="line"><span><b>Total investment</b>${S.total !== S.cash ? '<br><span class="muted">money spent ' + money(S.cash) + (S.includeFamily && S.family ? ' + family work ' + money(S.family) : '') + (S.includeOwnMachine && S.ownMachine ? ' + own machine ' + money(S.ownMachine) : '') + (S.includeOwnMachine && S.myTime ? ' + my time ' + money(S.myTime) : '') + '</span>' : ''}</span><b style="font-size:20px;color:var(--red)">${money(S.total)}</b></div>
      ${harvestText(S) ? `<div class="line"><span style="white-space:nowrap">🌾 Harvest</span><b style="text-align:right">${esc(harvestText(S))}</b></div>` : ''}
      ${S.costPerKg ? `<div class="line"><span>Cost per kg ${esc(cropById(mainCrop(k)).ne)}</span><b>${money(S.costPerKg)}</b></div>` : ''}</div>
    ${famToggleHtml(S)}
    <p class="small muted">Tap an entry to edit, 🗑 to delete a mistake. Every change is logged.</p>
    ${list.length ? list.map(r => `<div class="row" style="gap:6px;align-items:stretch">${kItemHtml(r).replace('class="item"', 'class="item" style="flex:1;min-width:0;width:auto;margin-bottom:6px"')}
      <button class="btn redl" style="margin-bottom:6px;min-width:48px;padding:0 10px" data-act="kDeleteEntry" data-id="${r.id}" data-k="${khetiId}" data-v="${key}">🗑</button></div>`).join('') : '<p class="muted">No entries here yet.</p>'}
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}

// ================= REPORTS =================
function renderKReports() {
  const S = computeKheti();
  const seasons = Array.from(new Set(khetis().map(k => k.season).filter(Boolean)));
  const ks = Object.values(S.K).filter(k => kRepSeason === 'all' || k.kheti.season === kRepSeason);
  const sum = key => ks.reduce((a, k) => a + (k[key] || 0), 0);
  $('#v-kreports').innerHTML = `<h2>📊 Kheti report</h2>
    <div class="chips" style="margin-bottom:10px">${kChip('kRepSeason', 'all', kRepSeason === 'all', 'All seasons')}${seasons.map(s => kChip('kRepSeason', s, kRepSeason === s, esc(seasonLabel(s)))).join('')}</div>
    <div class="card today" style="background:linear-gradient(135deg,#15803d,#166534)">
      <div class="label">Total investment</div><div class="huge">${money(sum('total'))}</div>
      <div class="grid3" style="margin-top:10px"><div class="stat"><b>${shortMoney(sum('labour'))}</b><span>Labour</span></div><div class="stat"><b>${shortMoney(sum('machineHire') + sum('fuelCost'))}</b><span>Machine+fuel</span></div><div class="stat"><b>${shortMoney(sum('seed') + sum('fert'))}</b><span>Seed+मल</span></div></div></div>
    <div class="summary small">
      <div class="line"><span>Khetala days</span><b>${nfmt(sum('labourFull'))} full · ${nfmt(sum('labourHalf'))} half</b></div>
      ${sum('ownMachine') ? `<div class="line"><span>🚜 Own machine value</span><b>${nfmt(sum('ownMachineHours'))} hr · ${money(sum('ownMachine'))}</b></div>` : ''}
      ${sum('myTime') ? `<div class="line"><span>🧑 My time on own machines</span><b>${nfmt(sum('myTimeHours'))} hr · ${money(sum('myTime'))}</b></div>` : ''}
      ${sum('family') ? `<div class="line"><span>🏠 Family work</span><b>${nfmt(sum('familyFull'))} full · ${nfmt(sum('familyHalf'))} half · ${money(sum('family'))}</b></div>
` : ''}
      ${sum('family') || sum('ownMachine') || sum('myTime') ? `<div class="line"><span>Money actually spent</span><b>${money(sum('cash'))}</b></div>` : ''}
      <div class="line"><span>Parma days</span><b>${nfmt(sum('parmaDays'))}</b></div>
      <div class="line"><span>Machine hours</span><b>${nfmt(sum('machineHours'))} hr</b></div>
      <div class="line"><span>Fuel</span><b>Petrol ${nfmt(round(sum('petrol'), 1))} L · Diesel ${nfmt(round(sum('diesel'), 1))} L</b></div></div>
    ${myMachines().length ? (() => { const MM = computeMachines(), tot = Object.values(MM).reduce((a, x) => a + x.serviceCost, 0); return `<div class="summary small" data-act="goMachines" style="cursor:pointer"><div class="line"><span>🔧 Machine servicing (all time, not in crop costs)</span><b>${money(tot)} ›</b></div></div>`; })() : ''}
    <h3>By kheti</h3>
    ${ks.length ? ks.map(k => `<button class="item" data-act="kOpenKheti" data-id="${k.kheti.id}" style="align-items:flex-start">
      <div class="ic" style="background:var(--green-l)">${k.kheti.status === 'done' ? '✅' : '🌱'}</div>
      <div class="mid"><div class="t">${esc(khetiTitle(k.kheti))}</div><div class="s">${esc(seasonLabel(k.kheti.season))} · labour ${money(k.labour)} · machine ${money(k.machineHire + k.fuelCost)} · seed+मल ${money(k.seed + k.fert)}${k.family ? ` · 🏠 ${money(k.family)}${k.includeFamily ? '' : ' (not counted)'}` : ''}${k.ownAll ? ` · 🚜 own ${money(k.ownAll)}${k.includeOwnMachine ? '' : ' (not counted)'}` : ''}<br>${esc(harvestText(k) || 'no harvest yet')}${k.costPerKg ? ' · ' + money(k.costPerKg) + '/kg' : ''}</div></div>
      <div class="amt" style="color:var(--red)">${money(k.total)}</div></button>`).join('') : '<p class="muted">No kheti yet.</p>'}
    <div class="grid2" style="margin-top:10px"><button class="btn" data-act="exportCsv" data-v="kheti">📄 Kheti (CSV)</button><button class="btn" data-act="exportCsv" data-v="khetiwork">📄 Work log (CSV)</button></div>`;
}

// ================= SECTIONS: 🌾 Kheti · 🐔 Poultry · 🏪 Shop =================
const SECTIONS = {
  kheti: { label: '🌾 खेती', home: 'kheti', nav: [['kheti', '🌾', 'Kheti'], ['kwork', '📝', 'Work'], null, ['workers', '👷', 'Workers'], ['kreports', '📊', 'Report']] },
  poultry: { label: '🐔 कुखुरा', home: 'home', nav: [['home', '🏠', 'Home'], ['sell', '💰', 'Sell'], null, ['buy', '🛒', 'Buy'], ['reports', '📊', 'Reports']] },
  shop: { label: '🏪 पसल', home: 'shop', nav: [['shop', '🏪', 'Shop'], null, ['settings', '⚙️', 'Settings']] },
  mill: { label: '⚙️ मिल', home: 'mill', nav: [['mill', '⚙️', 'Mill'], null, ['millreport', '📊', 'Report']] }
};
const VIEW_SECTION = { mill: 'mill', millreport: 'mill', kheti: 'kheti', kwork: 'kheti', kmachines: 'kheti', workers: 'kheti', kreports: 'kheti', home: 'poultry', sell: 'poultry', buy: 'poultry', reports: 'poultry', shop: 'shop' };
let section = null;
function openSectionPref() { const s = db.meta.openSection; return SECTIONS[s] ? s : 'kheti'; }
function setSection(s) {
  if (!SECTIONS[s] || s === section) return;
  section = s;
  document.body.className = document.body.className.replace(/\bsec-\w+/g, '').trim() + ' sec-' + s;
  renderSecbar(); renderNav();
  const pc = $('#priceChip'); if (pc) pc.classList.toggle('hidden', s !== 'poultry');
}
function renderSecbar() {
  const el = $('#secbar');
  if (el) el.innerHTML = Object.keys(SECTIONS).map(s => `<button class="${s === section ? 'on' : ''}" data-act="section" data-v="${s}">${SECTIONS[s].label}</button>`).join('');
}
function renderNav() {
  const nav = $('#nav'), mic = $('#micBtn');
  if (!nav || !mic) return;
  $$('#nav .navbtn').forEach(b => b.remove());
  SECTIONS[section].nav.forEach(n => {
    if (!n) { nav.appendChild(mic); return; }
    const b = document.createElement('button');
    b.className = 'navbtn'; b.dataset.act = 'go'; b.dataset.view = n[0];
    b.innerHTML = `<span>${n[1]}</span>${n[2]}`;
    nav.appendChild(b);
  });
  $$('.navbtn').forEach(b => b.classList.toggle('on', b.dataset.view === view));
}

// ================= SETTINGS card =================
function khetiSettingsHtml() {
  const sys = landSystem();
  return `<h2>🌾 Kheti</h2>
    <div class="card">
      <div class="field"><label>Land units (this phone)</label><div class="chips">${kChip('setLandSys', 'pahad', sys === 'pahad', '⛰️ Ropani-Aana-Paisa-Daam')}${kChip('setLandSys', 'tarai', sys === 'tarai', '🌾 Bigha-Kattha-Dhur')}</div>
        <div class="hint">The other system is shown in small text. <a href="#" data-act="openConverter">📐 Converter</a></div></div>
      <h3>👷 Khetala rates (Rs per person)</h3>
      <div class="summary small" id="wageTable">${workTypes().filter(w => !w.hidden).map(w => `<div class="line" style="gap:6px"><span style="flex:1">${esc(w.ne)}<br><span class="muted">${esc(w.en)}</span></span>
        <input data-wage="${w.id}" data-shift="full" type="number" inputmode="numeric" value="${wageRate(w.id, 'full') || ''}" placeholder="full" style="width:84px;border:2px solid var(--line);border-radius:10px;padding:8px">
        <input data-wage="${w.id}" data-shift="half" type="number" inputmode="numeric" value="${wageRate(w.id, 'half') || ''}" placeholder="half" style="width:84px;border:2px solid var(--line);border-radius:10px;padding:8px"></div>`).join('')}</div>
      <div class="row wrap" style="gap:6px"><button class="btn sm ghost" data-act="listOpen" data-k="work">✎ Work types</button><button class="btn sm ghost" data-act="listOpen" data-k="crops">✎ Crops</button><button class="btn sm ghost" data-act="listOpen" data-k="fert">✎ मल types</button></div>
      <h3>🌾 Harvest measures</h3>
      <div class="summary small">${['dhaan', 'gahun', 'makai', 'kodo', 'maas', 'masuro', 'kerau'].map(c => `<div class="line" style="gap:6px"><span style="flex:1">1 pathi ${esc(cropById(c).ne)} =</span>
        <input data-pathi="${c}" type="number" inputmode="decimal" step="any" value="${pathiKg(c)}" style="width:72px;border:2px solid var(--line);border-radius:10px;padding:8px"> kg</div>`).join('')}
        <div class="line" style="gap:6px"><span style="flex:1">1 bora (any crop) =</span><input data-borakg="1" type="number" inputmode="decimal" value="${boraKg('dhaan')}" style="width:72px;border:2px solid var(--line);border-radius:10px;padding:8px"> kg</div></div>
      <p class="small muted">1 muri = 20 pathi = 160 mana. Rates, work types and crops are shared with all your phones.</p>
    </div>`;
}

// ================= change log text, edit, delete =================
function khetiRecSummary(r) {
  if (r.kind === 'mymachine') return `Machine ${r.name}${r.number ? ' (' + r.number + ')' : ''}`;
  if (r.kind === 'mservice') { const m = myMachineById(r.machineId); return `Servicing ${m ? m.name : '?'}: ${(r.items || []).map(i => serviceItemName(i.item)).join(', ')} · ${money(serviceTotal(r))}`; }
  const kt = r.khetiId && khetiById(r.khetiId) ? khetiTitle(khetiById(r.khetiId)) : '';
  switch (r.kind) {
    case 'field': return `Field ${r.name} · ${fmtArea(r.areaM2 || 0, landSystem(), 'ne')}`;
    case 'kheti': return `Kheti ${khetiTitle(r)}`;
    case 'worker': return `Worker ${workerLabel(r)}`;
    case 'fwork': return `${kt}: ${workById(r.workType).ne} · ${money(fworkAmount(r))}`;
    case 'fpay': return `Paid ${workerLabel(workerById(r.workerId))} ${money(r.amount)}`;
    case 'parmaout': return `Parma for ${r.family} · ${nfmt((r.full || 0) + (r.half || 0) * 0.5)} din`;
    case 'machine': return `${kt}: ${(MACHINES[r.type] || {}).en || r.type} ${r.hours ? nfmt(r.hours) + ' hr' : ''} · ${money((r.hireAmount || 0) + (r.fuelCost || 0))}`;
    case 'finput': return `${kt}: ${r.item} ${r.qty ? nfmt(r.qty) + ' ' + r.unit : ''} · ${money(r.cost)}`;
    case 'harvest': return `${kt}: harvest ${cropById(r.crop).ne} ${nfmt(r.qty)} ${r.unit}`;
  }
  return null;
}
const KHETI_KINDS = ['field', 'kheti', 'worker', 'fwork', 'fpay', 'parmaout', 'machine', 'finput', 'harvest', 'mymachine', 'mservice'];
function khetiEditRec(r) {
  switch (r.kind) {
    case 'mymachine': openMyMachineForm(Object.assign({}, r)); return true;
    case 'mservice': openServiceForm(r); return true;
    case 'field': openFieldForm(r); return true;
    case 'kheti': openKhetiForm(r); return true;
    case 'worker': openWorkerForm(r); return true;
    case 'fwork': openWorkForm(r); return true;
    case 'machine': openMachineForm(Object.assign({}, r)); return true;
    case 'finput': openInputForm(Object.assign({}, r)); return true;
    case 'harvest': openHarvestForm(Object.assign({}, r)); return true;
    case 'parmaout': openParmaOutForm(Object.assign({}, r)); return true;
    case 'fpay': {
      const w = workerById(r.workerId);
      ask({ title: `💵 Payment to ${w ? w.name : '?'}`, sub: `${fmtDate(r.date, true)} · ${money(r.amount)} — type the correct amount`, input: { placeholder: String(r.amount) },
        buttons: [{ label: '🗑 Delete payment', value: 'del', cls: 'red' }],
        onAnswer: a => {
          if (a === 'del') { removeRec(r.id); render(); toast('Deleted', r.id, true); return; }
          if (!(Number(a) > 0)) return;
          put(Object.assign({}, r, { amount: round(Number(a), 2) })); render(); toast('Payment changed ✓');
        } });
      return true;
    }
  }
  return false;
}
// a field, kheti or worker with entries can't be deleted (that would leave orphans)
function khetiDeleteBlock(r) {
  let n = 0;
  if (r.kind === 'mymachine') { const n2 = all('mservice').filter(x => x.machineId === r.id).length + all('machine').filter(x => x.machineId === r.id).length; return n2 ? `${r.name} has ${n2} servicing / use entries. Mark it “Sold / not in use” instead, or delete those entries first.` : ''; }
  if (r.kind === 'field') n = khetiOfField(r.id).length;
  else if (r.kind === 'kheti') n = Object.values(db.records).filter(x => !hidden(x) && x.khetiId === r.id).length;
  else if (r.kind === 'worker') n = all('fwork').filter(x => (x.workers || []).some(y => y.workerId === r.id)).length + all('fpay').filter(x => x.workerId === r.id).length;
  if (!n) return '';
  return r.kind === 'field' ? `This field has ${n} kheti. Delete those first, or mark the field “Not in use”.`
    : r.kind === 'kheti' ? `This kheti has ${n} entries. Delete them first (tap a number on the field card), or tap “Finish kheti”.`
    : `${r.name} has ${n} work days / payments. Remove them from those entries first.`;
}

// ================= CSV =================
function khetiCsv(which) {
  const S = computeKheti();
  if (which === 'kheti') {
    const rows = [['Field', 'Area (m²)', 'Area', 'Main crop', 'Aali crops', 'Variety', 'Season', 'Planted (BS)', 'Status', 'Labour (paid)', 'Full days', 'Half days', 'Family work value', 'Family work counted', 'Parma days', 'Machine hire', 'Machine hours', 'Own machine value', 'My time value', 'Own machine counted', 'Fuel cost', 'Petrol L', 'Diesel L', 'Seed', 'Fertilizer', 'Total cost', 'Harvest', 'Main crop kg', 'Cost per kg']];
    Object.values(S.K).forEach(k => { const x = k.kheti, f = fieldById(x.fieldId) || {}; rows.push([f.name || '', round(f.areaM2 || 0), fmtArea(f.areaM2 || 0, landSystem(), 'en'), cropById(mainCrop(x)).en, (x.crops || []).filter(c => c.role === 'aali').map(c => cropById(c.crop).en).join(' + '), x.variety || '', x.season || '', bsIso(x.plantDate), x.status || '', round(k.labour), k.labourFull, k.labourHalf, round(k.family), k.includeFamily ? 'yes' : 'no', k.parmaDays, round(k.machineHire), k.machineHours, round(k.ownMachine), round(k.myTime), k.includeOwnMachine ? 'yes' : 'no', round(k.fuelCost), k.petrol, k.diesel, round(k.seed), round(k.fert), round(k.total), harvestText(k), round(k.mainKg), round(k.costPerKg, 2)]); });
    return { rows, name: 'kheti-' + bsIso(today()) + '.csv' };
  }
  const rows = [['Date (BS)', 'Date (AD)', 'Kheti', 'Entry', 'Details', 'Qty', 'Unit', 'Amount', 'Note', 'By', 'Phone']];
  Object.values(db.records).filter(r => !hidden(r) && ['fwork', 'machine', 'finput', 'harvest', 'fpay', 'parmaout'].includes(r.kind)).sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(r => {
    const kt = r.khetiId && khetiById(r.khetiId) ? khetiTitle(khetiById(r.khetiId)) : '';
    if (r.kind === 'fwork') rows.push([bsIso(r.date), r.date, kt, 'Work: ' + workById(r.workType).en, [(r.workers || []).map(w => (workerById(w.workerId) || {}).name + (w.shift === 'half' ? ' ½' : '')).join(', '), r.extraFull ? r.extraFull + ' more full' : '', r.extraHalf ? r.extraHalf + ' more half' : '', (r.parma || []).map(p => 'parma ' + p.family + ' ' + ((p.full || 0) + (p.half || 0) * 0.5)).join(', ')].filter(Boolean).join('; '), (r.workers || []).length + (r.extraFull || 0) + (r.extraHalf || 0), 'people', round(fworkAmount(r)), r.note || '', r.by || '', r.device || '']);
    else if (r.kind === 'machine') rows.push([bsIso(r.date), r.date, kt, (MACHINES[r.type] || {}).en || r.type, r.fuel ? r.litres + ' L ' + r.fuel + ' Rs ' + r.fuelCost : '', r.hours, 'hours', round((r.hireAmount || 0) + (r.fuelCost || 0)), r.note || '', r.by || '', r.device || '']);
    else if (r.kind === 'finput') rows.push([bsIso(r.date), r.date, kt, r.type === 'seed' ? 'Seed' : 'Fertilizer', r.item, r.qty, r.unit, round(r.cost), r.note || '', r.by || '', r.device || '']);
    else if (r.kind === 'harvest') rows.push([bsIso(r.date), r.date, kt, 'Harvest', cropById(r.crop).en + ' ≈ ' + round(r.kg || harvestKg(r)) + ' kg', r.qty, r.unit, '', r.note || '', r.by || '', r.device || '']);
    else if (r.kind === 'fpay') rows.push([bsIso(r.date), r.date, '', 'Payment', workerLabel(workerById(r.workerId)), '', '', round(r.amount), r.note || '', r.by || '', r.device || '']);
    else rows.push([bsIso(r.date), r.date, '', 'Parma (we worked)', r.family, (r.full || 0) + (r.half || 0) * 0.5, 'days', '', r.note || '', r.by || '', r.device || '']);
  });
  return { rows, name: 'kheti-work-' + bsIso(today()) + '.csv' };
}

// ================= clicks / inputs =================
let kWorkStash = null;
function khetiDate(key, ad) {
  if (!kDraft) return;
  if (key === 'kplant') { kDraft.plantDate = ad; kDraft.season = seasonOf(ad); const s = $('#kForm [data-k=season]'); if (s) s.value = kDraft.season; }
  else kDraft.date = ad;
}
function khetiClick(act, b) {
  const id = b.dataset.id, v = b.dataset.v;
  const rr = fn => { kRead(); if ($('#kForm [data-kp]')) workReadParma(); fn(); };
  switch (act) {
    case 'section': closeSheet(); setSection(v); go(SECTIONS[v].home); break;
    case 'setOpenSection': db.meta.openSection = v; persist(); renderSettings(); toast(`The app will open in ${SECTIONS[v].label}`); break;
    case 'setLandSys': db.meta.landSystem = v; persist(); renderSettings(); toast('Land units: ' + LAND[v].label); break;
    case 'openConverter': openAreaConverter(); break;
    case 'convSys': openAreaConverter(v); break;
    case 'kToggle': kToggle(id); renderKheti(); break;
    case 'kFoldAll': db.meta.kOpen = kOpenIds().length ? [] : activeFields().slice(0, 3).map(f => f.id); persist(); renderKheti(); break;
    case 'kNewField': openFieldForm(null); break;
    case 'kEditField': openFieldForm(Object.assign({}, fieldById(id))); break;
    case 'kFieldSys': {
      kRead(); const m2 = readAreaInputs($('#kForm'), kDraft.sys, 'ka');
      openFieldForm(Object.assign({}, kDraft, { areaM2: m2, sys: v }));
      kDraft.exact = { m2, shown: $$('#kForm [data-ka]').map(e => e.value).join('|') }; break;
    }
    case 'kSaveField': saveFieldForm(); break;
    case 'kFieldClose': { const f = fieldById(id); put(Object.assign({}, f, { closed: !f.closed })); closeSheet(); render(); toast(f.closed ? `${f.name} in use again` : `${f.name} marked not in use`); break; }
    case 'kNewKheti': openKhetiForm(null, id); break;
    case 'kEditKheti': openKhetiForm(khetiById(id)); break;
    case 'kkField': rr(() => { kDraft.fieldId = id || v; renderKhetiForm(); }); break;
    case 'kkMain': rr(() => {
      kDraft.crops = (kDraft.crops || []).filter(c => c.role === 'aali' && c.crop !== v);
      kDraft.crops.unshift({ crop: v, role: 'main' }); renderKhetiForm(); }); break;
    case 'kkSide': rr(() => {
      const has = (kDraft.crops || []).some(c => c.role === 'aali' && c.crop === v);
      kDraft.crops = has ? kDraft.crops.filter(c => !(c.role === 'aali' && c.crop === v)) : (kDraft.crops || []).concat([{ crop: v, role: 'aali' }]);
      renderKhetiForm(); }); break;
    case 'kSaveKheti': saveKhetiForm(); break;
    case 'kFinish': {
      const k = khetiById(id);
      ask({ title: `Finish ${khetiTitle(k)}?`, sub: 'Mark this crop as harvested and done. The field shows “Khali” until you start a new kheti. You can still add or edit its entries.',
        buttons: [{ label: '✅ Finish kheti', value: 'yes', cls: 'green' }, { label: '🌾 Record harvest first', value: 'harv' }, { label: 'Cancel', value: 'no' }],
        onAnswer: a => {
          if (a === 'harv') { openHarvestForm(null, id); return; }
          if (a !== 'yes') return;
          put(Object.assign({}, k, { status: 'done', harvestDate: today() })); render(); toast(`${khetiTitle(k)} finished ✓`);
        } });
      break;
    }
    case 'kReopen': { const k = khetiById(id); put(Object.assign({}, k, { status: 'growing', harvestDate: '' })); closeSheet(); render(); toast('Kheti reopened'); break; }
    case 'kOpenKheti': openKhetiEntries(id, 'all'); break;
    case 'kEntries': if (id) openKhetiEntries(id, v); break;
    case 'kDeleteEntry': deleteRec(id, () => openKhetiEntries(b.dataset.k, v)); break;
    case 'kWork': openWorkForm(null, id); break;
    case 'kMachine': openMachineForm(null, id); break;
    case 'kInput': openInputForm(null, id); break;
    case 'kHarvest': openHarvestForm(null, id); break;
    case 'kParmaOut': openParmaOutForm(null); break;
    case 'kfKheti': rr(() => {
      kDraft.khetiId = id || v;
      if (kDraft.kind === 'harvest') { const k = khetiById(kDraft.khetiId); kDraft.crop = k ? mainCrop(k) : ''; }
      ({ fwork: renderWorkForm, machine: renderMachineForm, finput: renderInputForm, harvest: renderHarvestForm })[kDraft.kind](); }); break;
    case 'kfWork': rr(() => {
      kDraft.workType = v; kDraft.rateFull = wageRate(v, 'full'); kDraft.rateHalf = wageRate(v, 'half'); renderWorkForm(); }); break;
    case 'kfWorker': rr(() => {
      const ws = kDraft.workers || (kDraft.workers = []), x = ws.find(w => w.workerId === id);
      if (!x) ws.push({ workerId: id, shift: 'full' });
      else if (x.shift === 'full') x.shift = 'half';
      else kDraft.workers = ws.filter(w => w.workerId !== id);
      renderWorkForm(); }); break;
    case 'kfAddParma': rr(() => { (kDraft.parma = kDraft.parma || []).push({ family: '', full: '', half: '' }); renderWorkForm(); }); break;
    case 'kSaveWork': saveWorkForm(); break;
    case 'kfMach': rr(() => { kDraft.type = v; kDraft.machineId = ''; kDraft.ratePerHour = MACHINES[v].hired ? '' : (ownMachineRate(v) || ''); if (!MACHINES[v].hired && !kDraft.myRate) kDraft.myRate = myTimeRate() || ''; renderMachineForm(); }); break;
    case 'kfFuel': rr(() => { kDraft.fuel = v; renderMachineForm(); }); break;
    case 'kSaveMachine': saveMachineForm(); break;
    case 'kfInType': rr(() => { kDraft.type = v; kDraft.item = v === 'fert' ? 'Urea' : ''; kDraft.unit = INPUT_UNITS[v][0]; renderInputForm(); }); break;
    case 'kfInItem': rr(() => { kDraft.item = v === 'Other' ? '' : v; renderInputForm(); if (v === 'Other') { const i = $('#kForm [data-k=item]'); if (i) i.focus(); } }); break;
    case 'kfInUnit': rr(() => { kDraft.unit = v; renderInputForm(); }); break;
    case 'kSaveInput': saveInputForm(); break;
    case 'kfHCrop': rr(() => { kDraft.crop = v; renderHarvestForm(); }); break;
    case 'kfHUnit': rr(() => { kDraft.unit = v; renderHarvestForm(); }); break;
    case 'kSaveHarvest': saveHarvestForm(); break;
    case 'kSaveParmaOut': saveParmaOutForm(); break;
    case 'kAddWorker': if (v === 'work') { rr(() => {}); kWorkStash = kDraft; } else kWorkStash = null; openWorkerForm(null, v); break;
    case 'kMachToggle': { const k = khetiById(id); put(Object.assign({}, k, { includeOwnMachine: !k.includeOwnMachine })); render(); if ($('#sheet .kfam')) openKhetiEntries(id, 'all');
      toast(!k.includeOwnMachine ? '🚜 Own machine now counted in this crop\'s cost' : '🚜 Own machine left out of this crop\'s cost'); break; }
    case 'kFamToggle': { const k = khetiById(id); put(Object.assign({}, k, { includeFamily: !k.includeFamily })); render(); if ($('#sheet .kfam')) openKhetiEntries(id, 'all');
      toast(!k.includeFamily ? '🏠 Family work now counted in this crop\'s cost' : '🏠 Family work left out of this crop\'s cost'); break; }
    case 'kEditWorker': openWorkerForm(Object.assign({}, workerById(id))); break;
    case 'kSaveWorker': saveWorkerForm(); break;
    case 'kWorker': openWorkerAccount(id); break;
    case 'kPickContact':
      if (!HAS_ANDROID || typeof Android.pickContact !== 'function') { toast('Contacts work in the Android app'); if (!$('#kForm [data-k=phone]')) openWorkerForm(null); break; }
      if (!$('#kForm [data-k=phone]')) openWorkerForm(null);
      kRead(); Android.pickContact(); break;
    case 'kCall': if (HAS_ANDROID && typeof Android.callNumber === 'function') Android.callNumber(v); else location.href = 'tel:' + v; break;
    case 'kSaveContact': { const w = workerById(id); if (HAS_ANDROID && typeof Android.saveContact === 'function') Android.saveContact(workerLabel(w), w.phone || ''); else toast('Works in the Android app'); break; }
    case 'kShareContact': { const w = workerById(id); shareText(`👷 ${workerLabel(w)}${w.phone ? '\n📞 ' + w.phone : ''}${w.village ? '\n📍 ' + w.village : ''}`); break; }
    case 'kShareStatement': shareText(workerStatementText(id)); break;
    case 'kPay': openPayForm(id); break;
    case 'kSettle': {
      const w = workerById(id), due = computeKheti().W[id].due;
      ask({ title: `Settle ${w.name}?`, sub: `Pay ${money(due)} now — the account becomes 0.`, buttons: [{ label: `✔ Paid ${money(due)}`, value: 'yes', cls: 'green' }, { label: 'Cancel', value: 'no' }],
        onAnswer: a => { if (a !== 'yes') return; const rec = put({ kind: 'fpay', workerId: id, date: today(), amount: due, method: 'cash', note: 'Settled' }); render(); toast(`${w.name} settled ✓ ${money(due)}`, rec.id); openWorkerAccount(id); } });
      break;
    }
    case 'kqKheti': case 'kqWork': {
      const vals = {}; $$('[data-kq]').forEach(el => { vals[el.dataset.kq] = el.value; });
      db.meta.kQuick[act === 'kqKheti' ? 'khetiId' : 'work'] = v; persist(); renderKheti();
      $$('[data-kq]').forEach(el => { el.value = vals[el.dataset.kq] || ''; }); const h = $('#kqHint'); if (h) h.textContent = quickHint(); break;
    }
    case 'kqSave': saveQuickWork(); break;
    case 'kRepSeason': kRepSeason = v; renderKReports(); break;
    case 'kAddWorkType': ask({ title: 'New work type', sub: 'e.g. Kodalo khanne, Jhar phalne', input: { text: true, placeholder: 'Name' }, onAnswer: name => {
      const list = workTypes().slice(), wid = 'w_' + normName(name).replace(/\s+/g, '').slice(0, 16) + '_' + list.length;
      if (list.some(w => normName(w.en) === normName(name) || w.ne === name)) { toast('Already there'); return; }
      list.splice(list.length - 1, 0, { id: wid, en: name, ne: name }); setSet('workTypes', list); renderSettings(); toast(`Added ${name} ✓ — set its rates`); } }); break;
    case 'kAddCrop': ask({ title: 'New crop', sub: 'e.g. Sunflower / सूर्यमुखी', input: { text: true, placeholder: 'Name' }, onAnswer: name => {
      const list = cropList().slice();
      if (list.some(c => normName(c.en) === normName(name) || c.ne === name)) { toast('Already there'); return; }
      list.push({ id: 'c_' + normName(name).replace(/\s+/g, '').slice(0, 16) + '_' + list.length, en: name, ne: name, group: 'veg' }); setSet('cropList', list); renderSettings(); toast(`Added ${name} ✓`); } }); break;
    default: return false;
  }
  return true;
}
function khetiInput(el) {
  if ($('#kmOwnHint') && (el.dataset.k === 'hours' || el.dataset.k === 'ratePerHour')) $('#kmOwnHint').textContent = ownMachineHint();
  if ($('#kmMyHint') && ['hours', 'myHours', 'myRate'].includes(el.dataset.k)) $('#kmMyHint').textContent = myTimeHint();
  if (el.dataset.k === 'hours' && $('#kForm [data-k=myHours]')) $('#kForm [data-k=myHours]').placeholder = nfmt(num(el.value) || 0) + ' (same)';
  if ($('#kwTotal') && (el.dataset.k || el.dataset.kp)) updWorkTotal();
  if (el.dataset.kq) { const h = $('#kqHint'); if (h) h.textContent = quickHint(); }
  if (el.dataset.ka !== undefined && kDraft && kDraft.kind === 'field') {
    const m2 = readAreaInputs($('#kForm'), kDraft.sys, 'ka'), h = $('#kAreaHint');
    if (h) h.textContent = m2 ? fmtArea(m2, otherSystem(kDraft.sys), 'ne') + ' · ' + areaExtra(m2) : '';
  }
  if ($('#khHint') && kDraft && kDraft.kind === 'harvest' && (el.dataset.k === 'qty')) {
    const kg = harvestKg({ qty: num(el.value) || 0, unit: kDraft.unit, crop: kDraft.crop });
    $('#khHint').textContent = (kg ? '≈ ' + nfmt(round(kg, 1)) + ' kg · ' : '') + `1 pathi = ${pathiKg(kDraft.crop)} kg, 1 bora = ${boraKg(kDraft.crop)} kg`;
  }
}
function khetiChange(el) {
  if (el.dataset.wage) {
    const w = el.dataset.wage, f = $(`[data-wage="${w}"][data-shift=full]`).value, h = $(`[data-wage="${w}"][data-shift=half]`).value;
    setWageRate(w, f, h); toast(`${workById(w).ne}: full Rs ${nfmt(Number(f) || 0)} · half Rs ${nfmt(Number(h) || 0)} ✓`); return true;
  }
  if (el.dataset.pathi) { const m = Object.assign({}, getSet('pathiKg') || {}); m[el.dataset.pathi] = Number(el.value) || 0; setSet('pathiKg', m); toast('Saved ✓'); return true; }
  if (el.dataset.borakg) { const m = {}; cropList().forEach(c => { m[c.id] = Number(el.value) || 50; }); setSet('boraKg', m); toast('Saved ✓'); return true; }
  return false;
}
