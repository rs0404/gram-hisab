/* Gram Hisab — ✂️ Cut entry, meat on hand, and chicken day / week / month detail.
   A cut is an event {type:'cut', lotId, breed, count, qty (meat kg), liveKg?, partsKg?, birdMeat?: [kg per bird]}.
   Meat sales then take from the cut meat on hand (no bird count needed); "meat left?" records any loss as {type:'meatloss', qty}. */
'use strict';

let cutDraft = null;
// meat on hand per lot + type, and the latest cut with what was sold since
function meatOnHand() {
  const st = computeStats(), out = [];
  activeLots().forEach(l => Object.keys(st[l.id].byBreed).forEach(b => { const x = st[l.id].byBreed[b]; if (x.meatStock > 0.04) out.push({ lot: l, breed: b, kg: x.meatStock }); }));
  return out;
}
function lastCut(lotId, breed) {
  return all('event').filter(r => r.type === 'cut' && r.lotId === lotId && (!breed || recBreed(r, lotById(lotId)) === breed)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt)[0] || null;
}
function soldSince(cut) {
  return all('sale').filter(s => s.type === 'meat' && s.lotId === cut.lotId && recBreed(s, lotById(cut.lotId)) === recBreed(cut, lotById(cut.lotId)) && (s.date > cut.date || (s.date === cut.date && s.createdAt >= cut.createdAt))).reduce((a, s) => a + (Number(s.kg) || 0), 0);
}

// ---------- ✂️ cut form ----------
function openCutForm(rec) {
  const act = activeLots(), l0 = rec && rec.lotId ? lotById(rec.lotId) : act[0];
  cutDraft = Object.assign({ kind: 'event', type: 'cut', date: today(), lotId: l0 ? l0.id : '', breed: l0 ? lotBreeds(l0)[0] : '', count: 1, qty: '', liveKg: '', partsKg: '', oneByOne: false, birdMeat: [], leftNow: '' }, rec ? JSON.parse(JSON.stringify(rec)) : {});
  if (cutDraft.birdMeat && cutDraft.birdMeat.length) cutDraft.oneByOne = true;
  renderCutForm();
}
function cutStockBefore(d) {
  const l = lotById(d.lotId); if (!l) return 0;
  const x = computeStats()[l.id].byBreed[d.breed || lotBreeds(l)[0]];
  let s = x ? x.meatStock : 0;
  if (d.id) { const old = db.records[d.id]; if (old) s = Math.max(0, s - (Number(old.qty) || 0)); }   // editing: don't count this cut itself
  return round(s, 2);
}
function cutCalc(d) {
  const n = Math.max(1, Math.round(num(d.count) || 1));
  const meat = d.oneByOne ? (d.birdMeat || []).slice(0, n).reduce((a, v) => a + (num(v) || 0), 0) : (num(d.qty) || 0);
  const live = num(d.liveKg) || 0, parts = num(d.partsKg) || 0;
  return { n, meat, live, parts, perMeat: meat / n, perLive: live / n, yieldPct: live ? meat / live * 100 : null };
}
function cutHint(d) {
  const c = cutCalc(d), l = lotById(d.lotId);
  if (!c.meat) {
    const learned = learnedMeatPerBird(d.breed);
    return learned ? `Your recent ${breedName(d.breed)} cuts gave about ${kgs(learned)} meat per bird.` : 'Weigh the cleaned meat. Live weight and khutta-tauko are optional.';
  }
  const est = l ? estBirdKg(l, d.breed, d.date) : null;
  return `Per bird: ${c.live ? kgs(c.perLive) + ' live → ' : (est ? '≈ ' + kgs(est.kg) + ' live (estimate) → ' : '')}${kgs(c.perMeat)} meat${c.yieldPct ? ` · yield ${round(c.yieldPct)}%` : ''}${c.parts ? ' · khutta-tauko ' + kgs(c.parts / c.n) : ''}`;
}
function renderCutForm() {
  const d = cutDraft, act = activeLots().concat(d.lotId && !activeLots().some(l => l.id === d.lotId) && lotById(d.lotId) ? [lotById(d.lotId)] : []);
  const l = lotById(d.lotId), n = Math.max(1, Math.round(num(d.count) || 1)), before = d.id ? 0 : cutStockBefore(d);
  const inp = (k, label, ph, attrs) => `<label><span>${label}</span><input data-cf="${k}" ${attrs || 'type="number" inputmode="decimal" step="any"'} value="${esc(d[k] == null ? '' : d[k])}" placeholder="${ph}"></label>`;
  openSheet(`<h2>✂️ ${d.id ? 'Edit cut' : 'Cut chickens'}</h2><div id="cutForm">
    <div class="field"><label>Lot</label><div class="chips">${act.map(x => `<button class="chip sm ${d.lotId === x.id ? 'on' : ''}" data-act="cutLot" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>
    ${l && lotBreeds(l).length > 1 ? `<div class="field"><label>Type</label><div class="chips">${lotBreeds(l).map(b => `<button class="chip sm ${d.breed === b ? 'on' : ''}" data-act="cutBreed" data-v="${b}">${esc(breedName(b))}</button>`).join('')}</div></div>` : ''}
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('cut', d.date)}</div>
    <div class="field"><label>How many birds cut</label><div class="chips">${[1, 2, 3, 4, 5].map(k => `<button class="chip ${n === k ? 'on' : ''}" data-act="cutCount" data-v="${k}">${k}</button>`).join('')}
      <input data-cf="count" type="number" inputmode="numeric" value="${n > 5 ? n : ''}" placeholder="more" style="width:76px;border:2px solid var(--line);border-radius:999px;padding:8px 10px;font-weight:800"></div></div>
    ${before > 0.04 ? `<div class="field"><label>🔪 Meat still on hand from before (kg)</label><input data-cf="leftNow" type="number" inputmode="decimal" step="any" value="${esc(d.leftNow)}" placeholder="${nfmt(before)}">
      <div class="hint">The app thinks ${kgs(before)} is left. If less is really left, type it — the difference is recorded as loss.</div></div>` : ''}
    <label class="switch" style="padding:4px 0 8px"><span><b>Weigh each bird's meat separately</b></span><input type="checkbox" data-act="cutOneByOne" ${d.oneByOne ? 'checked' : ''}></label>
    ${d.oneByOne ? `<div class="hshop cutbirds">${Array.from({ length: n }, (_, i) => `<label><span>Bird ${i + 1} meat kg</span><input data-cb="${i}" ${calcAttrs()} value="${esc((d.birdMeat || [])[i] || '')}" placeholder="0"></label>`).join('')}</div>`
      : `<div class="hshop" style="grid-template-columns:1fr">${inp('qty', `🍗 Meat after cleaning (kg) — ${n} bird${n > 1 ? 's' : ''} together`, '0', calcAttrs())}</div>`}
    <div class="hshop" style="grid-template-columns:1fr 1fr;margin-top:8px">${inp('liveKg', '⚖️ Live weight kg (optional)', 'before cut')}${inp('partsKg', '🍗 Khutta-tauko kg (optional)', '0')}</div>
    <div class="totalbox" style="margin-top:10px"><span class="small" id="cutHint" style="font-weight:700">${esc(cutHint(d))}</span><b id="cutMeat" style="font-size:24px;white-space:nowrap">${kgs(cutCalc(d).meat)}</b></div>
    <button class="btn big green" data-act="cutSave">✔ ${d.id ? 'Update' : 'Save cut'}</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button>${historyHtml(d.id)}` : ''}
  </div>`);
}
function readCutForm() {
  $$('#cutForm [data-cf]').forEach(el => { if (el.dataset.cf === 'count' && el.value === '') return; cutDraft[el.dataset.cf] = el.value; });
  $$('#cutForm [data-cb]').forEach(el => { (cutDraft.birdMeat = cutDraft.birdMeat || [])[+el.dataset.cb] = el.value; });
}
function updCutHint() { readCutForm(); const h = $('#cutHint'), m = $('#cutMeat'); if (h) h.textContent = cutHint(cutDraft); if (m) m.textContent = kgs(cutCalc(cutDraft).meat); }
function saveCut() {
  readCutForm();
  const d = cutDraft, c = cutCalc(d), l = lotById(d.lotId);
  if (!l) { toast('Pick the lot'); return; }
  if (!c.meat) { toast('Type the meat weight'); return; }
  const breed = d.breed || lotBreeds(l)[0];
  // meat left from before: record the difference as loss
  if (!d.id && String(d.leftNow).trim() !== '') {
    const before = cutStockBefore(d), now = num(d.leftNow) || 0;
    if (before - now > 0.04) put({ kind: 'event', type: 'meatloss', date: d.date || today(), lotId: l.id, breed, qty: round(before - now, 2), note: 'meat left was ' + nfmt(now) + ' kg' });
  }
  const rec = { kind: 'event', type: 'cut', date: d.date || today(), lotId: l.id, breed, count: c.n, qty: round(c.meat, 3), note: '' };
  if (c.live) rec.liveKg = round(c.live, 3);
  if (c.parts) rec.partsKg = round(c.parts, 3);
  if (d.oneByOne) rec.birdMeat = (d.birdMeat || []).slice(0, c.n).map(v => round(num(v) || 0, 3));
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec); closeSheet(); render();
  toast(`✂️ Saved ✓ ${c.n} bird${c.n > 1 ? 's' : ''} → ${kgs(c.meat)} meat${c.live ? ' · yield ' + round(c.yieldPct) + '%' : ''} · per bird ${kgs(c.perMeat)}`, d.id ? null : rec.id);
}

// ---------- 🔪 meat on hand ----------
function meatOnHandHtml() {
  const m = meatOnHand();
  if (!m.length) return '';
  const tot = m.reduce((a, x) => a + x.kg, 0);
  return `<button class="card tight" data-act="meatOpen" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px;margin-bottom:10px">
    <span style="font-size:26px">🔪</span><span style="flex:1"><span class="label">Meat on hand</span><br><b style="font-size:20px">${kgs(tot)}</b> <span class="small muted">${m.length > 1 || activeLots().length > 1 ? m.map(x => esc(lotLabelShort(x.lot)) + ' ' + kgs(x.kg)).join(' · ') : ''}</span></span><span class="small muted">Meat left? ›</span></button>`;
}
const lotLabelShort = l => { const b = adToBs(l.startDate); return b ? BS_MONTHS[b.m - 1] + ' lot' : l.name; };
function openMeatOnHand() {
  const m = meatOnHand();
  openSheet(`<h2>🔪 Meat on hand</h2>
    ${m.length ? m.map((x, i) => { const c = lastCut(x.lot.id, x.breed), sold = c ? soldSince(c) : 0; return `<div class="card tight">
      <div class="row between"><b>${esc(x.lot.name)}${lotBreeds(x.lot).length > 1 ? ' · ' + esc(breedName(x.breed)) : ''}</b><b style="font-size:20px">${kgs(x.kg)}</b></div>
      ${c ? `<div class="small muted">Last cut ${fmtDate(c.date, true)}: ${c.count} bird${c.count > 1 ? 's' : ''} → ${kgs(c.qty)} · sold since ${kgs(sold)}</div>` : ''}
      <div class="row" style="gap:6px;margin-top:8px"><input id="meatLeft${i}" type="number" inputmode="decimal" step="any" placeholder="really left kg" style="flex:1;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px;font-size:18px;font-weight:800">
        <button class="btn sm green" data-act="meatLeftSave" data-i="${i}" data-id="${x.lot.id}" data-v="${x.breed}">✔ Save</button><button class="btn sm ghost" data-act="meatFinished" data-id="${x.lot.id}" data-v="${x.breed}">None left</button></div></div>`; }).join('')
      : '<p class="muted">No cut meat on hand.</p>'}
    <p class="small muted">If less meat is really left than the app thinks (dried, trimmed, given away), the difference is saved as meat loss.</p>
    <button class="btn big green" data-act="cutNew">✂️ Cut chickens</button>
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}
function setMeatLeft(lotId, breed, left) {
  const x = (computeStats()[lotId] || { byBreed: {} }).byBreed[breed]; if (!x) return;
  const loss = round(x.meatStock - left, 2);
  if (loss > 0.04) { put({ kind: 'event', type: 'meatloss', date: today(), lotId, breed, qty: loss, note: 'meat left ' + nfmt(left) + ' kg' }); toast(`Saved ✓ ${kgs(loss)} meat loss · ${kgs(left)} left`); }
  else toast('Nothing to change ✓');
  render(); openMeatOnHand();
}
// after a meat sale: when only a little should be left, ask once
function askMeatLeftAfterSale(sale) {
  if (!sale || sale.type !== 'meat' || !sale.lotId) return;
  const l = lotById(sale.lotId), breed = recBreed(sale, l), x = l && computeStats()[l.id].byBreed[breed];
  if (!x || !(x.meatStock > 0.04 && x.meatStock <= 0.3)) return;
  setTimeout(() => !pendingAsk && !sheetOpen() && ask({ title: `About ${kgs(x.meatStock)} meat should be left`, sub: `${l.name} · is any left?`,
    buttons: [{ label: `Yes, ${kgs(x.meatStock)} left`, value: 'yes', cls: 'ghost' }, { label: 'None — finished', value: 'none', cls: 'primary' }],
    onAnswer: a => { if (a === 'none') { put({ kind: 'event', type: 'meatloss', date: today(), lotId: l.id, breed, qty: x.meatStock, note: 'finished' }); render(); toast('✓ Meat finished'); } } }), 1200);
}

// ---------- cutting summary for a lot ----------
function lotCutSummaryHtml(l) {
  const cuts = all('event').filter(r => r.type === 'cut' && r.lotId === l.id && Number(r.qty) > 0 && Number(r.count) > 0);
  if (!cuts.length) return '';
  const birds = cuts.reduce((a, r) => a + Number(r.count), 0), meat = cuts.reduce((a, r) => a + Number(r.qty), 0);
  const wl = cuts.filter(r => Number(r.liveKg) > 0), liveB = wl.reduce((a, r) => a + Number(r.count), 0), live = wl.reduce((a, r) => a + Number(r.liveKg), 0), meatW = wl.reduce((a, r) => a + Number(r.qty), 0);
  const parts = cuts.reduce((a, r) => a + (Number(r.partsKg) || 0), 0), partsB = cuts.filter(r => Number(r.partsKg) > 0).reduce((a, r) => a + Number(r.count), 0);
  const b = lotBreeds(l)[0], perMeat = meat / birds, perLive = liveB ? live / liveB : estBirdKg(l, b, today()).kg, perParts = partsB ? parts / partsB : 0;
  const cutValue = perMeat * priceFor('meat', b) + perParts * (Number(getSet('partsPrice')) || 0), liveValue = perLive * priceFor('live', b);
  return `<h3>✂️ Cutting</h3><div class="summary small">
    <div class="line"><span>Cut</span><b>${birds} birds → ${kgs(meat)} meat (${cuts.length} cut${cuts.length > 1 ? 's' : ''})</b></div>
    <div class="line"><span>Meat per bird</span><b>${kgs(perMeat)}</b></div>
    <div class="line"><span>Live per bird ${liveB ? '' : '<span class="muted">(estimate)</span>'}</span><b>${kgs(perLive)}</b></div>
    ${liveB ? `<div class="line"><span>Yield (meat ÷ live)</span><b>${round(meatW / live * 100)}%</b></div>` : ''}
    ${partsB ? `<div class="line"><span>Khutta-tauko per bird</span><b>${kgs(perParts)}</b></div>` : ''}
    <div class="line"><span>One bird cut & sold as meat</span><b style="color:var(--green)">≈ ${money(cutValue)}</b></div>
    <div class="line"><span>One bird sold live</span><b>≈ ${money(liveValue)}</b></div>
    <div class="line"><span>${cutValue >= liveValue ? '✂️ Cutting earns more' : '🐔 Selling live earns more'}</span><b>${money(Math.abs(cutValue - liveValue))} per bird</b></div></div>`;
}

// ---------- chicken: yesterday / week / month → every day ----------
function chickRangeSum(from, to) {
  const o = { amount: 0, liveKg: 0, meatKg: 0, partsKg: 0, birds: 0, sales: 0, dead: 0, cutBirds: 0, bought: 0 };
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r) || !r.date || r.date < from || r.date > to) continue;
    if (r.kind === 'sale') { o.sales++; o.amount += Number(r.amount) || 0; o[r.type === 'live' ? 'liveKg' : r.type === 'parts' ? 'partsKg' : 'meatKg'] += Number(r.kg) || 0; if (r.type === 'live') o.birds += Number(r.birds) || 0; }
    else if (r.kind === 'grainsale') { o.sales++; o.amount += Number(r.amount) || 0; }
    else if (r.kind === 'event' && r.type === 'dead') o.dead += Number(r.count) || 0;
    else if (r.kind === 'event' && r.type === 'cut') o.cutBirds += Number(r.count) || 0;
    else if (r.kind === 'purchase') o.bought += Number(r.amount) || 0;
  }
  return o;
}
function openChickRange(from, to, label) {
  if (from === to) { openDay(from); return; }
  const o = chickRangeSum(from, to), days = [];
  for (let d = to; d >= from; d = addDays(d, -1)) days.push(d);
  openSheet(`<h2>🐔 ${esc(label)}</h2><div class="small muted" style="margin:-6px 0 10px">${fmtDate(from, true)} – ${fmtDate(to, true)}</div>
    <div class="summary">
      <div class="line"><span><b>Sales</b> (${o.sales})</span><b style="color:var(--green);font-size:22px">${money(o.amount)}</b></div>
      <div class="line"><span>🐔 Live · 🔪 Meat · 🍗 Khutta</span><b>${nfmt(round(o.liveKg, 1))} · ${nfmt(round(o.meatKg, 1))} · ${nfmt(round(o.partsKg, 1))} kg</b></div>
      <div class="line"><span>Birds sold live · cut · dead</span><b>${o.birds} · ${o.cutBirds} · ${o.dead}</b></div>
      ${o.bought ? `<div class="line"><span>🛒 Bought</span><b style="color:var(--red)">${money(o.bought)}</b></div>` : ''}</div>
    <h3>Every day</h3>
    <div class="summary small">${days.map(d => { const x = chickRangeSum(d, d); return `<div class="line" data-act="chickRangeDay" data-d="${d}" data-from="${from}" data-to="${to}" data-label="${esc(label)}" style="cursor:pointer">
      <span><b>${fmtDate(d)}</b> <span class="muted">· ${WEEK_NE[weekday(d)]}</span>${x.sales || x.dead || x.cutBirds ? `<br><span class="muted">${x.liveKg ? '🐔 ' + nfmt(round(x.liveKg, 1)) + ' kg ' : ''}${x.meatKg ? '🔪 ' + nfmt(round(x.meatKg, 1)) + ' kg ' : ''}${x.cutBirds ? '✂️ ' + x.cutBirds + ' ' : ''}${x.dead ? '💀 ' + x.dead : ''}</span>` : ''}</span>
      <b style="color:${x.amount ? 'var(--green)' : 'var(--muted)'};white-space:nowrap">${x.amount ? money(x.amount) : '—'} ›</b></div>`; }).join('')}</div>
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}
function chickMiniCards() {
  const t = today(), y = addDays(t, -1), ws = typeof weekStart === 'function' ? weekStart(t) : addDays(t, -6);
  const card = (from, to, label) => { const o = chickRangeSum(from, to); return `<button class="card tight shopmini" data-act="chickRange" data-from="${from}" data-to="${to}" data-label="${esc(label)}">
    <div class="label">${esc(label)}</div><div class="v">${money(o.amount)}</div><div class="small muted">${nfmt(round(o.liveKg + o.meatKg, 1))} kg ›</div></button>`; };
  return `<div class="grid3" style="margin-bottom:12px">${card(y, y, 'Yesterday')}${card(ws, t, 'This week')}${card(bsMonthStart(t), t, BS_MONTHS[adToBs(t).m - 1])}</div>`;
}

function cutClick(act, b) {
  const id = b.dataset.id, v = b.dataset.v;
  switch (act) {
    case 'cutNew': openCutForm(null); return true;
    case 'cutLot': readCutForm(); cutDraft.lotId = id; cutDraft.breed = lotBreeds(lotById(id))[0]; renderCutForm(); return true;
    case 'cutBreed': readCutForm(); cutDraft.breed = v; renderCutForm(); return true;
    case 'cutCount': readCutForm(); cutDraft.count = Number(v); renderCutForm(); return true;
    case 'cutOneByOne': readCutForm(); cutDraft.oneByOne = !cutDraft.oneByOne; renderCutForm(); return true;
    case 'cutSave': saveCut(); return true;
    case 'meatOpen': openMeatOnHand(); return true;
    case 'meatLeftSave': { const el = $('#meatLeft' + b.dataset.i), val = num(el && el.value); if (val == null) { toast('Type how many kg are left'); return true; } setMeatLeft(id, v, val); return true; }
    case 'meatFinished': setMeatLeft(id, v, 0); return true;
    case 'chickRange': openChickRange(b.dataset.from, b.dataset.to, b.dataset.label); return true;
    case 'chickRangeDay': { const f = b.dataset.from, t2 = b.dataset.to, l = b.dataset.label; openDay(b.dataset.d); sheetBackFn = () => openChickRange(f, t2, l); return true; }
    case 'showHist': { const h = (b.closest('#sheet') || document).querySelector('details.hist'); if (h) { h.open = true; h.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return true; }
  }
  return false;
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && (el.dataset.cf || el.dataset.cb) && cutDraft && $('#cutForm')) {
    if (el.dataset.cf === 'count' && el.value) { readCutForm(); renderCutForm(); return; }
    updCutHint();
  }
});
// a "🕘 History" button next to the title of any entry that was changed after it was added
function addHistPill(root) {
  const box = typeof root === 'string' ? document.querySelector(root) : root;
  if (!box) return;
  const h = box.querySelector('details.hist'), t = box.querySelector('h2');
  if (h && t && h.dataset.n > 1 && !t.querySelector('[data-act=showHist]')) t.insertAdjacentHTML('beforeend', ` <button class="chip sm" data-act="showHist" style="vertical-align:middle">🕘 History (${h.dataset.n})</button>`);
}
