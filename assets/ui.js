/* Chicken Khata — screens */
'use strict';

let view = 'home';
let sellDraft = null;
let eventDraft = null;
let lotDraft = null;
let recFilter = { kind: 'all', lot: '' , limit: 150 };
let buyDraft = null;
let reportTab = 'profit', reportPeriod = 'month';

// ---------- sheet + toast ----------
function openSheet(html, isAsk) {
  if (!isAsk && pendingAsk) cancelAsk();
  $('#sheet').innerHTML = '<div class="grab"></div>' + html;
  $('#sheetWrap').classList.remove('hidden');
  $('#sheet').scrollTop = 0;
}
function closeSheet(fromAsk) {
  $('#sheetWrap').classList.add('hidden');
  $('#sheet').innerHTML = '';
  if (!fromAsk && pendingAsk) cancelAsk();
}
const sheetOpen = () => !$('#sheetWrap').classList.contains('hidden');

let toastTimer = null, toastUndo = null;
function toast(msg, undoId, isRestore) {
  const el = $('#toast');
  toastUndo = undoId ? { id: undoId, restore: !!isRestore } : null;
  el.innerHTML = `<span>${esc(msg)}</span>${undoId ? `<button data-act="toastUndo">UNDO</button>` : ''}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), undoId ? 7000 : 4500);
}

// ---------- navigation ----------
function go(v) {
  if (v === 'lots' || v === 'records') { reportTab = v; v = 'reports'; }
  view = v;
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  $$('.navbtn').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  renderView(v);
  window.scrollTo(0, 0);
}
function render() {
  renderHeader();
  const active = document.activeElement;
  if (active && $('#v-' + view) && $('#v-' + view).contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;
  renderView(view);
}
function renderView(v) {
  ({ home: renderHome, sell: renderSell, buy: renderBuy, shop: renderShop, reports: renderReports, settings: renderSettings })[v]();
}
function renderHeader() {
  const t = today(), b = adToBs(t), d = new Date();
  $('#topDate').textContent = DAY[d.getDay()] + ', ' + BS_MONTHS[b.m - 1] + ' ' + b.d + ', ' + b.y + ' · 👤 ' + currentUser();
  $('#priceChip').innerHTML = '💰 Prices';
  updateSyncDot();
}

// ---------- HOME ----------
function renderHome() {
  const t = today();
  const td = periodStats(t, t), wk = periodStats(addDays(t, -6), t), mo = periodStats(bsMonthStart(t), t);
  const st = computeStats();
  const act = activeLots();
  const flags = computeFlags();
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = addDays(t, -i); days.push({ d, s: periodStats(d, d) }); }
  const max = Math.max(1, ...days.map(x => x.s.amount));
  const recent = recentRecords(6);

  $('#v-home').innerHTML = `
    <form class="cmd" data-form="cmd"><input id="cmdInput" placeholder="Type: sold 2 kg meat" autocomplete="off" enterkeyhint="go"><button class="btn primary" type="submit">Go</button></form>
    ${updateBannerHtml()}
    ${flags.map(f => `<button class="flag ${f.cls}" data-act="${f.act}" ${f.id ? `data-id="${f.id}"` : ''}><span class="fi">${f.icon}</span><span>${esc(f.text)}</span><span class="go">${f.go}</span></button>`).join('')}

    <div class="card today">
      <div class="row between"><div class="label">🐔 Chicken sales today</div><div class="label">${td.count} sale${td.count === 1 ? '' : 's'}</div></div>
      <div class="huge" style="margin:6px 0 12px">${money(td.amount)}</div>
      <div class="grid3">
        <div class="stat"><b>${nfmt(td.liveKg)}</b><span>Live kg</span></div>
        <div class="stat"><b>${nfmt(td.meatKg)}</b><span>Meat kg</span></div>
        <div class="stat"><b>${td.dead}</b><span>Dead</span></div>
      </div>
    </div>

    ${(() => { const sh = shopRange(t, t), shm = shopRange(bsMonthStart(t), t); return `<div class="card" style="border-left:8px solid var(--green)">
      <div class="row between"><div class="label">🏪 Shop today</div><button class="btn sm ghost" data-act="goShop">Open shop</button></div>
      <div class="huge" style="margin:6px 0 10px;color:var(--green)">${money(sh.total)}</div>
      <div class="grid3">
        <div class="stat"><b>${shortMoney(sh.cash)}</b><span>💵 Cash</span></div>
        <div class="stat"><b>${shortMoney(sh.qr)}</b><span>📱 QR</span></div>
        <div class="stat"><b style="color:var(--red)">${shortMoney(sh.goods)}</b><span>📦 Goods</span></div>
      </div>
      <div class="row between small muted" style="margin-top:8px"><span>${BS_MONTHS[adToBs(t).m - 1]}: collected ${money(shm.total)}</span><span>goods ${money(shm.goods)}</span></div>
      <form class="hshop" data-form="homeShop">
        <label><span>💵 Cash</span><input data-hs="cash" type="number" inputmode="decimal" step="any" placeholder="0"></label>
        <label><span>📱 QR</span><input data-hs="qr" type="number" inputmode="decimal" step="any" placeholder="0"></label>
        <label><span>📦 Goods</span><input data-hs="goods" type="number" inputmode="decimal" step="any" placeholder="0" enterkeyhint="done"></label>
      </form>
      <div class="btnrow" style="margin-top:8px"><button class="btn green" data-act="homeShopSave">✔ Add to today</button><button class="btn ghost" data-act="shopMic" aria-label="Speak shop amounts">🎤</button></div>
      ${(() => { const n = shopEntries(t, t).length; return n ? `<div class="small muted" style="margin-top:6px">${n} entr${n === 1 ? 'y' : 'ies'} today · <a href="#" data-act="shopDay" data-d="${t}">see / edit</a></div>` : ''; })()}
    </div>`; })()}
    <div class="grid2">
      <div class="card tight"><div class="label">Last 7 days</div><div style="font-size:22px;font-weight:900">${money(wk.amount)}</div><div class="small muted">${kgs(wk.kg)}</div></div>
      <div class="card tight"><div class="label">${BS_MONTHS[adToBs(t).m - 1]} (month)</div><div style="font-size:22px;font-weight:900">${money(mo.amount)}</div><div class="small muted">${kgs(mo.kg)}</div></div>
    </div>

    <div class="grid3" style="margin-bottom:12px">
      <button class="btn ghost" style="flex-direction:column;min-height:72px" data-act="askLeft"><span style="font-size:24px">🐔</span>Birds left</button>
      <button class="btn ghost" style="flex-direction:column;min-height:72px" data-act="openStock"><span style="font-size:24px">📦</span>Stock</button>
      <button class="btn ghost" style="flex-direction:column;min-height:72px" data-act="openReport"><span style="font-size:24px">📊</span>Profit</button>
    </div>

    <div class="row between"><h2>Active lots ${act.length ? `<span class="pill">${act.length}</span>` : ''}</h2>
      <span class="row" style="gap:6px">${act.length > 1 ? `<button class="btn sm ghost" data-act="foldAll">${openLotIds().some(id => act.some(l => l.id === id)) ? '☰ List' : '▾ Open'}</button>` : ''}<button class="btn sm primary" data-act="newLot">+ New lot</button></span></div>
    ${act.length ? act.map(l => lotCard(l, st[l.id])).join('') : `<div class="card empty"><div class="e">🐣</div><p><b>No active lots.</b><br>Add your first lot to start.</p><button class="btn big primary" data-act="newLot">+ Add lot</button></div>`}

    <h2>Sales — last 7 days <span class="small muted" style="font-weight:600">· tap a bar</span></h2>
    <div class="card"><div class="bars">${days.map(x => `<div class="bar ${x.d === t ? 'today' : ''}" data-act="dayDetail" data-d="${x.d}" style="cursor:pointer"><em>${x.s.amount ? shortMoney(x.s.amount) : ''}</em><i style="height:${Math.round(x.s.amount / max * 100)}%"></i><small>${x.d === t ? 'Today' : adToBs(x.d).d}</small></div>`).join('')}</div></div>

    <h2>Recent entries</h2>
    ${recent.length ? recent.map(itemHtml).join('') : '<p class="muted">Nothing recorded yet. Tap 🎤 and say “sold 2 kg meat”.</p>'}
    ${recent.length ? '<button class="btn big ghost" data-act="go" data-view="records">See all records</button>' : ''}
  `;
}

function shortMoney(n) { return n >= 100000 ? round(n / 100000, 1) + 'L' : n >= 1000 ? round(n / 1000, 1) + 'k' : String(Math.round(n)); }

// Folding: at most 3 lot cards open; closed lots start folded. Remembered on this phone.
const MAX_OPEN_LOTS = 3;
function openLotIds() {
  if (!Array.isArray(db.meta.unfolded)) db.meta.unfolded = activeLots().slice(0, MAX_OPEN_LOTS).map(l => l.id);
  return db.meta.unfolded;
}
function isUnfolded(id) { return openLotIds().includes(id); }
function toggleLot(id) {
  let list = openLotIds().filter(x => lotById(x));
  if (list.includes(id)) list = list.filter(x => x !== id);
  else { list.push(id); while (list.length > MAX_OPEN_LOTS) list.shift(); }
  db.meta.unfolded = list;
  persist();
}
function lotCard(l, s) {
  const low = Number(getSet('lowStock')) || 0;
  const no = lotVoiceNo(l);
  if (!isUnfolded(l.id)) {
    return `<button class="card lot tight ${lotColor(l)}" data-act="toggleLot" data-id="${l.id}" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-size:20px;color:var(--muted)">▸</span>
      <span style="min-width:0;flex:1"><b style="font-size:18px;word-break:break-all">${esc(l.name)}</b>
        <span class="small muted" style="display:block">${no ? 'Lot ' + no + ' · ' : ''}${esc(mixLabel(l))} · Day ${s.age}${l.closed ? ' · Closed' : ''}${s.revenue ? ' · sales ' + shortMoney(s.revenue) : ''}</span></span>
      <span style="text-align:right"><b style="font-size:24px;color:${s.remaining <= low && !l.closed ? 'var(--red)' : 'var(--green)'}">${s.remaining}</b><span class="label" style="display:block;font-size:10px">left</span></span>
    </button>`;
  }
  return `<div class="card lot ${lotColor(l)}">
    <div class="row between" style="align-items:flex-start">
      <button data-act="toggleLot" data-id="${l.id}" style="text-align:left;min-width:0">
        <div class="lotname"><span style="font-size:18px;color:var(--muted)">▾</span> ${esc(l.name)}</div>
        <div style="margin:4px 0">${no ? `<span class="pill blue">Lot ${no}</span> ` : ''}${lotBreeds(l).map(b => `<span class="pill purple">${esc(breedName(b))}</span>`).join(' ')}</div>
        <div class="small muted">Day ${s.age} · from ${fmtDate(l.startDate)}</div>
        <div class="small muted">≈ ${nfmt(estBirdKg(l, lotBreeds(l)[0], today()).kg)} kg per bird now</div>
      </button>
      <div class="remain ${s.remaining <= low ? 'low' : ''}"><div class="huge">${s.remaining}</div><div class="label">left</div></div>
    </div>
    ${s.mixed ? `<div class="grid${Math.min(3, Object.keys(s.byBreed).length)}" style="margin-top:10px">${Object.keys(s.byBreed).map(b => `<div class="stat" style="background:var(--purple-l)"><b>${s.byBreed[b].remaining}</b><span>${esc(breedName(b))} left</span></div>`).join('')}</div>` : ''}
    <div class="grid3 lotstats" style="margin-top:12px">
      <div class="stat" ${ent(l, 'chicks')}><b>${s.totalIn}</b><span>Chicks in ›</span></div>
      <div class="stat" ${ent(l, 'dead')}><b>${s.dead}</b><span>Dead ${s.chicks ? '· ' + round(s.mortality, 1) + '%' : ''} ›</span></div>
      <div class="stat" ${ent(l, 'live')}><b>${s.soldBirds}</b><span>Sold live ›</span></div>
      <div class="stat" ${ent(l, 'cut')}><b>${s.cutBirds}</b><span>Cut ›</span></div>
      <div class="stat" ${ent(l, 'sales')}><b>${nfmt(s.kg)}</b><span>Kg sold ›</span></div>
      <div class="stat" ${ent(l, 'sales')}><b>${shortMoney(s.revenue)}</b><span>Sales Rs ›</span></div>
      <div class="stat" ${ent(l, 'buy')} style="background:var(--red-l)"><b style="color:var(--red)">${shortMoney(s.expenses)}</b><span>🛒 Spent Rs ›</span></div>
      <div class="stat" ${ent(l, 'feed')} style="background:var(--blue-l)"><b>${shortMoney(s.costFeed)}</b><span>🌾 Grain Rs ›</span></div>
      <div class="stat" style="background:${s.profit >= 0 ? 'var(--green-l)' : 'var(--red-l)'}"><b style="color:${s.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${s.profit < 0 ? '−' : ''}${shortMoney(Math.abs(s.profit))}</b><span>${s.profit >= 0 ? 'Profit' : 'Loss'} Rs</span></div>
    </div>
    ${grainChips(s, l)}
    <div class="small muted" style="margin-top:6px">Spent = chicks ${money(s.costChicks)} · grain ${money(s.costFeed)} · medicine ${money(s.costMed)}${s.costOther ? ' · other ' + money(s.costOther) : ''}</div>
    ${s.meatStock ? `<div class="small" style="margin-top:8px">🔪 About <b>${kgs(s.meatStock)}</b> cut meat not sold yet</div>` : ''}
    ${l.closed ? '' : `<div class="actions">
      <button class="btn sm primary" data-act="sellLot" data-id="${l.id}">+ Sale</button>
      <button class="btn sm" data-act="addEvent" data-id="${l.id}" data-type="dead">💀<br>Dead</button>
      <button class="btn sm" data-act="addEvent" data-id="${l.id}" data-type="feed">🌾<br>Feed</button>
      <button class="btn sm" data-act="countCheck" data-id="${l.id}">🔢<br>Count</button>
    </div>`}
    <button class="btn ghost" style="width:100%;margin-top:8px" data-act="openLot" data-id="${l.id}">📋 Lot details, daily sales & history ›</button>
  </div>`;
}

// "6:42 PM · Roshan · ✎ edited by Hari"
function whoWhen(r) {
  const who = r.by || r.device || '';
  return `🕒 ${fmtTime(r.createdAt)} · 👤 ${esc(who)}${r.editedBy ? ` · <span style="color:var(--amber-d)">✎ edited${r.editedBy !== who ? ' by ' + esc(r.editedBy) : ''}</span>` : ''}`;
}
function auditLine(a, showWhat) {
  const icon = { create: '➕', edit: '✎', delete: '🗑', restore: '↺', archive: '🗄', unarchive: '↺' }[a.action] || '•';
  const verb = { create: 'added', edit: 'changed', delete: 'deleted', restore: 'restored', archive: 'archived', unarchive: 'restored' }[a.action] || a.action;
  const ch = a.changes ? Object.keys(a.changes).map(k => `<b>${esc(FIELD_LABEL[k] || k)}</b> ${esc(fmtField(k, a.changes[k][0]))} → ${esc(fmtField(k, a.changes[k][1]))}`).join('<br>') : '';
  return `<div class="line" style="align-items:flex-start;gap:10px"><span style="min-width:0">${icon} <b>${esc(a.by || '')}</b> ${verb}${showWhat ? ': ' + esc(a.summary || '') : ''}
      ${ch && a.action === 'edit' ? `<div class="small" style="margin-top:3px">${ch}</div>` : ''}</span><span class="small muted" style="white-space:nowrap;text-align:right">${fmtDate(iso(new Date(a.at)))}<br>${fmtTime(a.at)}</span></div>`;
}
function historyHtml(id) {
  if (!id) return '';
  const list = auditsFor(id);
  const r = db.records[id];
  return `<details style="margin-top:12px"${list.length > 1 ? ' open' : ''}><summary class="small" style="font-weight:800;color:var(--muted)">📜 History (${list.length || 1})</summary>
    <div class="summary small" style="margin-top:6px">${list.length ? list.map(a => auditLine(a, false)).join('') : `<div class="line"><span>➕ <b>${esc((r && (r.by || r.device)) || '')}</b> added</span><span class="muted">${r ? fmtStamp(r.createdAt) : ''}</span></div>`}</div></details>`;
}
function renderLog() {
  const users = knownUsers();
  const f = recFilter.logUser || '';
  const list = Object.values(db.records).filter(r => r.kind === 'audit' && (!f || r.by === f)).sort((a, b) => b.at - a.at);
  $('#repBody').innerHTML = `
    <div class="chips" style="margin-bottom:10px"><button class="chip sm ${!f ? 'on' : ''}" data-act="logUser" data-v="">Everyone</button>${users.map(u => `<button class="chip sm ${f === u ? 'on' : ''}" data-act="logUser" data-v="${esc(u)}">👤 ${esc(u)}</button>`).join('')}</div>
    ${list.length ? `<div class="summary small">${list.slice(0, 300).map(a => auditLine(a, true)).join('')}</div>` : '<div class="card empty"><div class="e">📜</div><p>No changes logged yet.</p></div>'}
    <p class="small muted">Every add, change, delete and archive is logged with the user, date and time — on every phone.</p>`;
}
function openUserSwitch(first) {
  const users = knownUsers();
  openSheet(`<h2>👤 Who is using this phone?</h2>
    <p class="small muted">New entries are saved with this name, date and time.</p>
    <div class="choice">${users.map(u => `<button class="btn big ${u === currentUser() && !first ? 'primary' : 'ghost'}" data-act="pickUser" data-v="${esc(u)}">👤 ${esc(u)}</button>`).join('')}</div>
    <div class="field" style="margin-top:12px"><label>Or a new name</label><input id="newUser" placeholder="e.g. Ram" autocomplete="off"></div>
    <button class="btn big green" data-act="pickUserNew">✔ Use this name</button>`);
}
// grain used by a lot, per size: big bora number, kg small
function grainChips(s, l) {
  const gs = Object.keys(s.feedByGrade).filter(g => s.feedByGrade[g] > 0).sort();
  if (!gs.length) return '';
  const bag = bagKg();
  const total = gs.reduce((a, g) => a + s.feedByGrade[g], 0);
  return `<div class="row wrap" style="gap:6px;margin-top:10px">${gs.map(g => `<div class="stat" ${l ? ent(l, 'feed:' + g) : ''} style="padding:6px 10px;background:var(--amber-l);flex:1;min-width:76px;cursor:pointer">
      <span style="font-size:12px">🌾 ${esc(g)}</span><b style="font-size:20px">${nfmt(round(s.feedByGrade[g] / bag, 2))} <span style="font-size:13px">bora</span></b>
      <span style="font-size:11px;text-transform:none">${nfmt(round(s.feedByGrade[g], 1))} kg</span></div>`).join('')}
    <div class="stat" ${l ? ent(l, 'feed') : ''} style="padding:6px 10px;flex:1;min-width:76px;cursor:pointer"><span style="font-size:12px">Total</span><b style="font-size:20px">${nfmt(round(total / bag, 2))} <span style="font-size:13px">bora</span></b>
      <span style="font-size:11px;text-transform:none">${nfmt(round(total, 1))} kg</span></div></div>`;
}
// quick shop entry typed on the Home card
function saveHomeShop() {
  const v = k => num(($(`#v-home [data-hs=${k}]`) || {}).value);
  const rec = { kind: 'shop', date: today(), cash: v('cash') || 0, qr: v('qr') || 0, goods: v('goods') || 0, note: '' };
  if (!rec.cash && !rec.qr && !rec.goods) { toast('Type cash, QR or goods amount'); return; }
  if (document.activeElement) document.activeElement.blur();
  put(rec);
  const d = shopRange(today(), today());
  renderHome();
  toast(`Shop ✓ today: collected ${money(d.total)} · goods ${money(d.goods)}`, rec.id);
}
// ---- tap a number on a lot card → the entries behind it (edit / delete each) ----
const ent = (l, key) => `data-act="lotEntries" data-id="${l.id}" data-v="${key}"`;
const ENTRY_VIEWS = {
  sales: { title: '💰 All sales', f: r => r.kind === 'sale' },
  live: { title: '🐔 Live sales', f: r => r.kind === 'sale' && r.type === 'live' },
  cut: { title: '🔪 Chickens cut (meat)', f: r => (r.kind === 'sale' && r.type === 'meat') || (r.kind === 'event' && r.type === 'cut') },
  dead: { title: '💀 Deaths', f: r => r.kind === 'event' && r.type === 'dead' },
  chicks: { title: '🐣 Chicks & count changes', f: r => r.kind === 'event' && ['restock', 'adjust', 'check', 'soldfix'].includes(r.type) },
  buy: { title: '🛒 Everything bought', f: r => r.kind === 'purchase' || (r.kind === 'event' && r.type === 'restock') },
  feed: { title: '🌾 Grain (bought & used)', f: r => (r.kind === 'purchase' && r.category === 'feed') || (r.kind === 'event' && r.type === 'feed') }
};
function openLotEntries(lotId, key) {
  const l = lotById(lotId);
  if (!l) return;
  const [base, grade] = key.split(':');
  const v = ENTRY_VIEWS[base] || ENTRY_VIEWS.sales;
  const list = Object.values(db.records).filter(r => !hidden(r) && r.lotId === lotId && v.f(r) && (!grade || (r.grade || 'Other') === grade))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
  const amt = list.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const kg = list.reduce((a, r) => a + (r.kind === 'sale' ? Number(r.kg) || 0 : (r.category === 'feed' || r.type === 'feed') ? stockQty('feed', r) : 0), 0);
  const birds = list.reduce((a, r) => a + (Number(r.count) || Number(r.birds) || 0), 0);
  const extra = base === 'chicks' ? `<div class="line"><span>First chicks (${fmtDate(l.startDate, true)})</span><b>${l.chicks} · ${money(l.chickCost || 0)} <button class="btn sm ghost" data-act="editLot" data-id="${l.id}">✎</button></b></div>` : '';
  openSheet(`<button class="btn sm ghost" data-act="openLot" data-id="${l.id}">‹ ${esc(l.name)}</button>
    <h2>${v.title}${grade ? ' · ' + esc(grade) : ''}</h2>
    <div class="summary small">${extra}
      <div class="line"><span>${list.length} entr${list.length === 1 ? 'y' : 'ies'}</span><b>${amt ? money(amt) : ''}${kg && base !== 'dead' ? ' · ' + (base === 'feed' ? nfmt(round(kg / bagKg(), 2)) + ' bora (' + nfmt(round(kg, 1)) + ' kg)' : kgs(kg)) : ''}${birds && ['dead', 'cut', 'live', 'chicks'].includes(base) ? ' · ' + birds + ' birds' : ''}</b></div></div>
    <p class="small muted">Tap an entry to edit it, or 🗑 to delete a mistake. Every change is logged.</p>
    ${list.length ? list.map(r => `<div class="row" style="gap:6px;align-items:stretch">${itemHtml(r).replace('class="item"', 'class="item" style="flex:1;min-width:0;width:auto;margin-bottom:6px"')}
      <button class="btn redl" style="margin-bottom:6px;min-width:48px;padding:0 10px" data-act="deleteEntry" data-id="${r.id}" data-lot="${lotId}" data-v="${key}" aria-label="Delete">🗑</button></div>`).join('') : '<p class="muted">Nothing here yet.</p>'}
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}
function recentRecords(n) {
  return Object.values(db.records).filter(r => !hidden(r) && (r.kind === 'sale' || r.kind === 'event'))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt).slice(0, n);
}
function itemHtml(r) {
  if (r.kind === 'sale') {
    return `<button class="item" data-act="editRec" data-id="${r.id}">
      <div class="ic ${r.type}">${r.type === 'live' ? '🐔' : r.type === 'parts' ? '🍗' : '🔪'}</div>
      <div class="mid"><div class="t">${r.flag ? '<span class="flagmark">⚑</span> ' : ''}${kgs(r.kg)} ${SALE_LABEL[r.type] || r.type}${r.type === 'parts' ? '' : ' · ' + esc(breedName(r.breed || lotBreed(lotById(r.lotId))))}</div>
      <div class="s">${fmtDate(r.date)} · ${esc(lotName(r.lotId))} · ${money(r.rate)}/kg${r.birds ? ' · ' + r.birds + ' birds' : ''}${r.invoice ? ' · Inv ' + esc(r.invoice) : ''} · ${whoWhen(r)}</div></div>
      <div class="amt">${money(r.amount)}</div></button>`;
  }
  if (r.kind === 'grainsale') {
    return `<button class="item" data-act="editRec" data-id="${r.id}">
      <div class="ic" style="background:var(--amber-l)">🌾</div>
      <div class="mid"><div class="t">${r.flag ? '<span class="flagmark">⚑</span> ' : ''}Sold grain ${esc(r.grade)} · ${nfmt(r.qty)} ${r.unit === 'kg' ? 'kg' : 'bora'}</div>
      <div class="s">${fmtDate(r.date)} · ${money(r.rate)}/${r.unit === 'kg' ? 'kg' : 'bora'}${r.note ? ' · ' + esc(r.note) : ''} · ${whoWhen(r)}</div></div>
      <div class="amt" style="color:var(--green)">${money(r.amount)}</div></button>`;
  }
  if (r.kind === 'purchase') {
    const c = PURCHASE_CATS[r.category] || PURCHASE_CATS.other;
    return `<button class="item" data-act="editRec" data-id="${r.id}">
      <div class="ic" style="background:var(--blue-l)">🛒</div>
      <div class="mid"><div class="t">${r.flag ? '<span class="flagmark">⚑</span> ' : ''}${c.icon} ${esc(purchaseTitle(r))}</div>
      <div class="s">${fmtDate(r.date)} · bought${r.supplier ? ' from ' + esc(r.supplier) : ''}${r.lotId ? ' · for ' + esc(lotName(r.lotId)) : ''} · ${whoWhen(r)}</div></div>
      <div class="amt" style="color:var(--red)">−${money(r.amount)}</div></button>`;
  }
  const t = EVENT_TYPES[r.type] || { icon: '•' };
  return `<button class="item" data-act="editRec" data-id="${r.id}">
    <div class="ic">${t.icon}</div>
    <div class="mid"><div class="t">${esc(eventTitle(r))}${r.item ? ' · ' + esc(r.item) : ''}</div>
    <div class="s">${fmtDate(r.date)} · ${esc(lotName(r.lotId))}${r.note ? ' · ' + esc(r.note).slice(0, 60) : ''} · ${whoWhen(r)}</div></div>
    <div class="amt">${r.amount ? money(r.amount) : ''}</div></button>`;
}


// ---------- SELL ----------
function newSellDraft(keep) {
  const act = activeLots();
  return { type: (keep && keep.type) || getSet('defaultType') || 'meat', lotId: keep && keep.lotId && lotById(keep.lotId) ? keep.lotId : (act.length === 1 ? act[0].id : ''),
    date: (keep && keep.date) || today(), kg: '', birds: '', rate: '', amount: '', amountManual: false, invoice: '', flag: false, note: '' };
}

function goSell(sale) {
  if (sale) {
    sellDraft = Object.assign({}, sale, { kg: sale.kg || '', birds: sale.birds != null ? sale.birds : '', birdsManual: true, rate: sale.rate != null ? sale.rate : '', amount: sale.amount != null ? sale.amount : '', amountManual: true });
    if (!sale.id) sellDraft.amountManual = false;
  }
  closeSheet();
  go('sell');
}
function sellCalc(d) {
  const lot = lotById(d.lotId);
  const breed = lot ? recBreed({ breed: d.breed }, lot) : (d.breed || 'broiler');
  const def = priceFor(d.type, breed);
  const rate = num(d.rate) != null ? num(d.rate) : def;
  const kg = num(d.kg) || 0;
  const amount = d.amountManual && num(d.amount) != null ? num(d.amount) : round(kg * rate, 2);
  return { def, rate, kg, amount, breed };
}

function renderSell() {
  if (!sellDraft) sellDraft = newSellDraft();
  const d = sellDraft, c = sellCalc(d);
  const allLots = d.id ? lots() : activeLots();
  $('#v-sell').innerHTML = `
    <h2>${d.id ? 'Edit sale' : 'New sale'}</h2>
    <div class="card" id="sellForm">
      <div class="field"><label>What did you sell?</label>
        <div class="chips"><button class="chip live ${d.type === 'live' ? 'on' : ''}" data-act="sellType" data-v="live">🐔 Live chicken</button>
        <button class="chip meat ${d.type === 'meat' ? 'on' : ''}" data-act="sellType" data-v="meat">🔪 Cut meat</button>
        <button class="chip ${d.type === 'parts' ? 'on' : ''}" data-act="sellType" data-v="parts">🍗 Khutta-tauko</button>
        <button class="chip ${d.type === 'grain' ? 'on' : ''}" data-act="sellType" data-v="grain">🌾 Grain</button></div></div>
      ${d.type === 'grain' ? grainSellFields(d) : `
      <div class="field"><label>From which lot?</label>
        ${allLots.length ? `<div class="choice">${allLots.map(l => `<button class="chip ${d.lotId === l.id ? 'on' : ''}" style="text-align:left" data-act="sellLotPick" data-id="${l.id}">${esc(l.name)} <span style="font-weight:600;opacity:.75">· ${esc(mixLabel(l))}</span></button>`).join('')}</div>`
          : `<button class="btn primary" data-act="newLot">+ Add a lot first</button>`}</div>
      ${lotById(d.lotId) && lotBreeds(lotById(d.lotId)).length > 1 ? `<div class="field"><label>Which chicken type?</label><div class="chips">${lotBreeds(lotById(d.lotId)).map(b => `<button class="chip ${c.breed === b ? 'on' : ''}" data-act="sellBreed" data-v="${b}">${esc(breedName(b))} <span style="opacity:.7">· ${lotStats(d.lotId).byBreed[b].remaining} left</span></button>`).join('')}</div></div>` : ''}
      <div class="field"><label>Weight (kg)</label><input data-f="kg" type="number" inputmode="decimal" step="any" value="${esc(d.kg)}" placeholder="0"></div>
      ${d.type === 'parts' ? '' : `<div class="field"><label>${d.type === 'live' ? '🐔 Birds sold' : '🔪 Chickens cut now for this sale'}</label>
        <div class="row" style="gap:8px"><button class="btn ghost" data-act="sellBirdsStep" data-d="-1">−</button>
          <input data-f="birds" type="number" inputmode="numeric" value="${esc(d.birds == null ? '' : d.birds)}" placeholder="0" style="text-align:center">
          <button class="btn ghost" data-act="sellBirdsStep" data-d="1">+</button></div>
        ${d.type === 'meat' ? `<div class="chips" style="margin-top:8px">${[0, 1, 2, 3, 4].map(n => `<button class="chip sm ${String(d.birds) === String(n) ? 'on' : ''}" data-act="sellBirdsSet" data-n="${n}">${n}</button>`).join('')}</div>` : ''}
        <div class="hint" id="sellBirdsHint">${esc(sellBirdsHint(d))}</div></div>`}
      <div class="field"><label>Rate Rs/kg</label><input data-f="rate" type="number" inputmode="decimal" step="any" value="${esc(d.rate)}" placeholder="${c.def || 'price'}">
        <div class="hint">${d.type === 'parts' ? 'Khutta-tauko' : esc(breedName(c.breed)) + ' ' + d.type} default: ${c.def ? money(c.def) : 'not set'}${d.amountManual && !num(d.kg) ? ' · kg will be worked out from the amount' : ''}</div></div>
      <div class="totalbox"><span><b style="font-size:15px">TOTAL</b><br><span class="small" id="sellCalcTxt">${d.amountManual ? 'entered by you' : kgs(c.kg) + ' × ' + money(c.rate)}</span></span><b id="sellTotal">${money(c.amount)}</b></div>
      <div class="field"><label>Total received (change only if different)</label><input data-f="amount" type="number" inputmode="decimal" step="any" value="${d.amountManual ? esc(d.amount) : ''}" placeholder="${round(c.amount)}"></div>
      <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('sell', d.date)}</div>`}
      <div class="field"><label>Invoice no. <span class="muted">(optional)</span></label><input data-f="invoice" value="${esc(d.invoice || '')}" placeholder="—" autocomplete="off"></div>
      <div class="field"><label>Note / customer <span class="muted">(optional)</span></label><input data-f="note" value="${esc(d.note || '')}" placeholder="—" autocomplete="off"></div>
      <label class="switch"><span><b>⚑ Flag this sale</b><br><span class="small muted">Credit / unpaid / check later</span></span><input type="checkbox" data-f="flag" ${d.flag ? 'checked' : ''}></label>
      <div style="height:12px"></div>
      <button class="btn big green" data-act="saveSale">✔ ${d.id ? 'Update sale' : 'Save sale'}</button>
      ${d.id ? `<div style="height:10px"></div><div class="btnrow"><button class="btn ghost" data-act="cancelEditSale">Cancel</button><button class="btn redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button></div>${historyHtml(d.id)}` : ''}
    </div>
    <p class="muted small" style="text-align:center">Or tap 🎤 and say “sold 2 kg meat”</p>`;
}

function sellDraftSale(d) {
  const c = sellCalc(d);
  return { lotId: d.lotId, breed: c.breed, type: d.type, kg: c.kg, date: d.date || today(), id: d.id };
}
function sellBirdsHint(d) {
  if (!d.lotId || !num(d.kg)) return d.type === 'live' ? 'Enter the weight — the app fills in the birds' : 'Enter the weight — the app suggests how many to cut';
  const e = saleBirdEstimate(sellDraftSale(d));
  const left = lotStats(d.lotId).byBreed[sellCalc(d).breed];
  return (d.birdsManual ? '' : 'Estimated — change if different. ') + e.note + (left ? ` · left now: ${left.remaining}` : '');
}
function sellAutoBirds(d) {
  if (d.birdsManual || !d.lotId) return;
  d.birds = num(d.kg) ? saleBirdEstimate(sellDraftSale(d)).birds : '';
  const el = $('#sellForm [data-f=birds]'); if (el) el.value = d.birds;
  $$('#sellForm [data-act=sellBirdsSet]').forEach(c => c.classList.toggle('on', String(d.birds) === c.dataset.n));
}
function sellInput(el) {
  const f = el.dataset.f, d = sellDraft;
  if (f === 'flag') d.flag = el.checked;
  else if (f === 'amount') { d.amount = el.value; d.amountManual = el.value !== ''; }
  else d[f] = el.value;
  if (d.type === 'grain') {
    if (f === 'unit') { d.rate = ''; renderSell(); return; }
    const g = grainCalc(d), tot = $('#sellTotal'), txt = $('#sellCalcTxt');
    if (tot) tot.textContent = money(g.amount);
    if (txt) txt.textContent = d.amountManual ? 'entered by you' : `${nfmt(g.qty)} × ${money(g.rate)}`;
    return;
  }
  if (f === 'birds') d.birdsManual = el.value !== '';
  if (f === 'kg' || f === 'date') sellAutoBirds(d);
  const h = $('#sellBirdsHint'); if (h) h.textContent = sellBirdsHint(d);
  const c = sellCalc(d);
  const tot = $('#sellTotal'), txt = $('#sellCalcTxt');
  if (tot) tot.textContent = money(c.amount);
  if (txt) txt.textContent = d.amountManual ? 'entered by you' : `${kgs(c.kg)} × ${money(c.rate)}`;
  const amt = $('#sellForm [data-f=amount]');
  if (amt && !d.amountManual) amt.placeholder = round(c.amount);
}
// ---- selling grain from the Sell page
function grainCalc(d) {
  const unit = d.unit || 'bags', qty = num(d.qty) || 0;
  const rate = num(d.rate) != null ? num(d.rate) : (d.grade ? feedRateFor(d.grade, 'sell', unit) : 0);
  const amount = d.amountManual && num(d.amount) != null ? num(d.amount) : round(qty * rate, 2);
  return { unit, qty, rate, amount };
}
function grainSellFields(d) {
  const c = grainCalc(d), inv = computeInventory(), si = d.grade ? inv[stockKey('feed', d)] : null;
  return `<div class="field"><label>Grain size</label><div class="chips">${FEED_GRADES.map(g => `<button class="chip ${d.grade === g ? 'on' : ''}" data-act="sellGrade" data-v="${g}">🌾 ${g}</button>`).join('')}</div>
      ${si && si.boughtAll ? `<div class="hint">In stock: ${fmtStockQty(si)}</div>` : ''}</div>
    <div class="grid2">
      <div class="field"><label>Quantity</label><input data-f="qty" type="number" inputmode="decimal" step="any" value="${esc(d.qty == null ? '' : d.qty)}" placeholder="0"></div>
      <div class="field"><label>Unit</label><select data-f="unit"><option value="bags" ${c.unit === 'bags' ? 'selected' : ''}>bora</option><option value="kg" ${c.unit === 'kg' ? 'selected' : ''}>kg</option></select></div>
    </div>
    <div class="field"><label>Rate Rs per ${c.unit === 'kg' ? 'kg' : 'bora'}</label><input data-f="rate" type="number" inputmode="decimal" step="any" value="${esc(d.rate == null ? '' : d.rate)}" placeholder="${c.rate || 'rate'}">
      <div class="hint">${d.grade ? `Saved ${d.grade} selling rate: ${feedRates()[d.grade].sell ? money(feedRates()[d.grade].sell) + ' / bora (' + money(feedRates()[d.grade].sell / bagKg()) + '/kg)' : 'not set'}` : 'Pick the grain size'}</div></div>
    <div class="totalbox"><span><b style="font-size:15px">TOTAL</b><br><span class="small" id="sellCalcTxt">${nfmt(c.qty)} × ${money(c.rate)}</span></span><b id="sellTotal">${money(c.amount)}</b></div>
    <div class="field"><label>Total received (change only if different)</label><input data-f="amount" type="number" inputmode="decimal" step="any" value="${d.amountManual ? esc(d.amount) : ''}" placeholder="${round(c.amount)}"></div>
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('sell', d.date)}</div>`;
}
function saveGrainSaleForm() {
  const d = sellDraft, c = grainCalc(d);
  if (!d.grade) { toast('Pick the grain size'); return; }
  if (!c.qty) { toast('Enter the quantity'); return; }
  if (!c.amount) { toast('Enter the rate or total'); return; }
  const rec = { kind: 'grainsale', date: d.date || today(), grade: d.grade, qty: c.qty, unit: c.unit, rate: c.qty ? round(c.amount / c.qty, 2) : c.rate, amount: c.amount,
    customer: '', invoice: (d.invoice || '').trim(), flag: !!d.flag, note: (d.note || '').trim() };
  const editing = d.id && db.records[d.id] && db.records[d.id].kind === 'grainsale';
  if (editing) { rec.id = d.id; rec.createdAt = db.records[d.id].createdAt; }
  put(rec);
  const sl = stockLeftNote('feed', rec);
  toast(`${editing ? 'Updated' : 'Saved'} ✓ sold ${rec.grade} ${nfmt(rec.qty)} ${rec.unit === 'kg' ? 'kg' : 'bora'} · ${money(rec.amount)}. ${sl.text}`, editing ? null : rec.id);
  if (num(d.rate) != null || d.amountManual) askFeedRate(rec.grade, 'sell', perBag(rec.rate, rec.unit), false, () => {});
  sellDraft = Object.assign(newSellDraft(d), { type: 'grain', grade: d.grade, unit: c.unit });
  render();
  if (editing) go('records');
}
function saveSaleForm() {
  if (sellDraft.type === 'grain') return saveGrainSaleForm();
  const d = sellDraft, c = sellCalc(d);
  if (!d.lotId) { toast('Pick a lot first'); return; }
  if (!c.kg && !c.amount) { toast('Enter the weight (kg) or the amount'); return; }
  if (!c.rate && !c.amount) { toast('Enter the rate'); return; }
  const rate = c.kg ? (d.amountManual && num(d.rate) == null ? round(c.amount / c.kg, 2) : c.rate) : c.rate;
  if (!c.kg && c.amount && c.rate) { c.kg = round(c.amount / c.rate, 2); if (d.type === 'live' && !d.birdsManual) d.birds = saleBirdEstimate({ lotId: d.lotId, breed: c.breed, type: 'live', kg: c.kg, date: d.date || today() }).birds; }
  if (d.type === 'parts') d.birds = 0;
  if (d.type === 'live' && !(num(d.birds) > 0)) { toast('How many birds were sold? Enter at least 1'); return; }
  const sale = { kind: 'sale', date: d.date || today(), lotId: d.lotId, breed: c.breed, type: d.type, kg: c.kg, birds: num(d.birds) ? Math.round(num(d.birds)) : 0,
    rate, amount: c.amount, invoice: (d.invoice || '').trim(), flag: !!d.flag, note: (d.note || '').trim() };
  if (d.id) { const old = db.records[d.id]; Object.assign(sale, { id: d.id, createdAt: old && old.createdAt, heard: old && old.heard }); }
  const told = num(d.rate) != null || d.amountManual;
  const editing = !!d.id;
  sellDraft = newSellDraft(d);
  saveSale(sale, told, false);
  if (editing) go('records'); else renderSell();
}

// ---------- process entry form ----------
function openEventForm(ev) {
  const act = activeLots();
  eventDraft = Object.assign({ kind: 'event', type: 'dead', date: today(), lotId: act.length === 1 ? act[0].id : '', count: '', qty: '', unit: '', amount: '', note: '', grade: '' }, ev || {});
  if (!eventDraft.unit) eventDraft.unit = PURCHASE_CATS[eventDraft.type] ? PURCHASE_CATS[eventDraft.type].units[0] : 'kg';
  renderEventForm();
}

function renderEventForm() {
  const e = eventDraft, t = EVENT_TYPES[e.type];
  const types = e.id && !USER_EVENT_TYPES.includes(e.type) ? USER_EVENT_TYPES.concat([e.type]) : USER_EVENT_TYPES;
  const lotList = e.id ? lots() : activeLots();
  openSheet(`<h2>${e.id ? 'Edit' : 'Add'} process entry</h2>
    <div id="evForm">
    <div class="field"><label>Type</label><div class="chips">${types.map(k => `<button class="chip ${e.type === k ? 'on' : ''}" data-act="evType" data-v="${k}">${EVENT_TYPES[k].icon} ${EVENT_TYPES[k].label}</button>`).join('')}</div></div>
    <div class="field"><label>Lot</label><div class="choice">${lotList.map(l => `<button class="chip ${e.lotId === l.id ? 'on' : ''}" style="text-align:left" data-act="evLot" data-id="${l.id}">${esc(l.name)} <span style="font-weight:600;opacity:.75">· ${esc(breedName(l.breed))}</span></button>`).join('') || '<span class="muted">Add a lot first</span>'}</div></div>
    ${BIRD_TYPES.includes(e.type) && lotById(e.lotId) && (e.type === 'restock' || lotBreeds(lotById(e.lotId)).length > 1) ? `<div class="field"><label>Chicken type</label><div class="chips">${(e.type === 'restock' ? breeds().map(x => x.id) : lotBreeds(lotById(e.lotId))).map(bb => `<button class="chip ${recBreed(e, lotById(e.lotId)) === bb ? 'on' : ''}" data-act="evBreed" data-v="${bb}">${esc(breedName(bb))}</button>`).join('')}</div></div>` : ''}
    ${t.grade ? `<div class="field"><label>Feed grain size</label><div class="chips">${FEED_GRADES.concat(['']).map(g => `<button class="chip ${(e.grade || '') === g ? 'on' : ''}" data-act="evGrade" data-v="${g}">${g || 'Other'}</button>`).join('')}</div></div>` : ''}
    ${t.count ? `<div class="field"><label>${e.type === 'restock' ? 'How many chicks added?' : e.type === 'dead' ? 'How many dead?' : e.type === 'cut' ? 'How many birds cut?' : e.type === 'adjust' ? 'Change (+/-)' : 'Birds'}</label><input data-ef="count" type="number" inputmode="numeric" value="${esc(e.count != null ? e.count : '')}" placeholder="0"></div>` : ''}
    ${t.item ? `<div class="field"><label>${t.label} name</label><input data-ef="item" list="itemList" value="${esc(e.item || '')}" placeholder="e.g. Amprolium" autocomplete="off">
      <datalist id="itemList">${knownItems(e.type).map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>` : ''}
    ${t.qty ? `<div class="grid2"><div class="field"><label>${e.type === 'weight' ? 'Avg weight' : e.type === 'cut' ? 'Meat weight' : 'Quantity used'}</label><input data-ef="qty" type="number" inputmode="decimal" step="any" value="${esc(e.qty != null ? e.qty : '')}" placeholder="0"></div>
      <div class="field"><label>Unit</label>${PURCHASE_CATS[e.type] ? `<select data-ef="unit">${PURCHASE_CATS[e.type].units.map(u => `<option value="${u}" ${e.unit === u ? 'selected' : ''}>${u === 'bags' ? 'bora (bag)' : u}</option>`).join('')}</select>` : '<input value="kg" disabled>'}</div></div>` : ''}
    ${t.amount ? `<div class="field"><label>Cost Rs <span class="muted">(${USAGE_TYPES.includes(e.type) ? 'leave empty if bought in the app' : 'optional'})</span></label><input data-ef="amount" type="number" inputmode="decimal" step="any" value="${esc(e.amount != null ? e.amount : '')}" placeholder="0"></div>` : ''}
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('ev', e.date)}</div>
    <div class="field"><label>Note <span class="muted">(optional)</span></label><textarea data-ef="note" placeholder="—">${esc(e.note || '')}</textarea></div>
    <button class="btn big green" data-act="saveEvent">✔ ${e.id ? 'Update' : 'Save'}</button>
    ${e.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteRec" data-id="${e.id}">🗑 Delete entry</button>${historyHtml(e.id)}` : ''}
    </div>`);
}

function readEventForm() { $$('#evForm [data-ef]').forEach(el => { eventDraft[el.dataset.ef] = el.value; }); }

function saveEventForm() {
  readEventForm();
  const e = eventDraft, t = EVENT_TYPES[e.type];
  if (!e.lotId) { toast('Pick a lot'); return; }
  const rec = { kind: 'event', type: e.type, date: e.date || today(), lotId: e.lotId, count: t.count ? (num(e.count) != null ? Math.round(num(e.count)) : null) : null,
    qty: t.qty ? num(e.qty) : null, unit: t.qty ? (e.type === 'feed' ? e.unit || 'bags' : 'kg') : '', amount: t.amount ? num(e.amount) : null, note: (e.note || '').trim() };
  if (t.grade) rec.grade = e.grade || '';
  if (BIRD_TYPES.includes(e.type)) rec.breed = e.type === 'restock' ? (e.breed || lotBreeds(lotById(e.lotId))[0]) : recBreed(e, lotById(e.lotId));
  if (e.type === 'cut' && rec.count && !rec.qty) { rec.qty = round(rec.count * estBirdKg(lotById(e.lotId), rec.breed, rec.date).kg * dressYield(), 2); rec.qtyEst = true; }
  if (t.item) rec.item = (e.item || '').trim();
  if (PURCHASE_CATS[e.type] && t.qty) rec.unit = e.unit || PURCHASE_CATS[e.type].units[0];
  if ((e.type === 'dead' || e.type === 'cut') && !rec.count) { toast('Enter how many birds'); return; }
  if (e.id) { rec.id = e.id; rec.createdAt = e.createdAt; }
  if (rec.type === 'restock') { if (!rec.count) { toast('Enter how many chicks'); return; } addRestock(rec); } else put(rec);
  closeSheet(); render();
  const lot = lotById(rec.lotId);
  toast(`Saved ✓ ${lot.name}: ${eventTitle(rec)}${['dead', 'cut'].includes(rec.type) ? '. ' + lowNote(lot).text : ''}`, e.id ? null : rec.id);
}

// ---------- lots ----------
function renderLots() {
  const st = computeStats();
  const act = activeLots(), closed = lots().filter(l => l.closed);
  $('#repBody').innerHTML = `
    <button class="btn big primary" data-act="newLot" style="margin-top:6px">+ Add new lot</button>
    <h2>Active lots</h2>
    ${act.length ? act.map(l => lotCard(l, st[l.id])).join('') : '<p class="muted">No active lots.</p>'}
    ${closed.length ? `<h2>Closed lots</h2>${closed.map(l => lotCard(l, st[l.id])).join('')}` : ''}
    <div style="height:12px"></div>
    <button class="btn big ghost" data-act="openArchive">🗄 Archive${archivedLots().length ? ' (' + archivedLots().length + ')' : ''} — restore deleted lots</button>`;
}
let lotHistTab = 'sales';
function openLot(id, tab) {
  const l = lotById(id);
  if (!l) return;
  if (tab) lotHistTab = tab;
  const s = lotStats(id);
  const recs = Object.values(db.records).filter(r => !r.deleted && r.lotId === id && (r.kind === 'sale' || r.kind === 'event' || r.kind === 'purchase'))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
  const groups = { sales: recs.filter(r => r.kind === 'sale'), buy: recs.filter(r => r.kind === 'purchase' || (r.kind === 'event' && r.type === 'restock')),
    process: recs.filter(r => r.kind === 'event' && r.type !== 'restock'), all: recs };
  const shown = groups[lotHistTab] || recs;
  const sumAmt = list => list.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const feed = Object.keys(s.feedByGrade).sort();
  openSheet(`
    <div class="row between" style="align-items:flex-start"><div style="min-width:0"><div class="lotname">${esc(l.name)}</div>
      <div style="margin:4px 0">${lotVoiceNo(l) ? `<span class="pill blue">Lot ${lotVoiceNo(l)}</span> ` : ''}${lotBreeds(l).map(b => `<span class="pill purple">${esc(breedName(b))}</span>`).join(' ')}${l.closed ? ' <span class="pill red">Closed</span>' : ''}</div>
      <div class="muted small">Day ${s.age} · ${fmtDate(l.startDate, true)}${l.closed ? ' → ' + fmtDate(l.closedDate, true) : ''}</div></div>
      <div class="remain"><div class="huge">${s.remaining}</div><div class="label">left</div></div></div>
    <div class="grid3" style="margin:14px 0">
      <div class="stat"><b>${s.totalIn}</b><span>Chicks in</span></div>
      <div class="stat"><b>${s.dead}</b><span>Dead ${round(s.mortality, 1)}%</span></div>
      <div class="stat"><b>${s.soldBirds}</b><span>Sold live</span></div>
      <div class="stat"><b>${s.cutBirds}</b><span>Cut</span></div>
      <div class="stat"><b>${nfmt(s.liveKg)}</b><span>Live kg</span></div>
      <div class="stat"><b>${nfmt(s.meatKg)}</b><span>Meat kg</span></div>
      <div class="stat"><b>${shortMoney(s.revenue)}</b><span>Sales Rs</span></div>
      <div class="stat"><b>${shortMoney(s.expenses)}</b><span>Costs Rs</span></div>
      <div class="stat"><b style="color:${s.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${shortMoney(s.profit)}</b><span>${s.profit >= 0 ? 'Profit' : 'Loss'}</span></div>
    </div>
    <div class="summary small">
      <div class="line"><span><b>Chickens by type</b></span><b>in · dead · sold · cut · <span style="color:var(--green)">left</span></b></div>
      ${Object.keys(s.byBreed).map(b => { const x = s.byBreed[b]; return `<div class="line"><span>${esc(breedName(b))}<br><span class="muted">≈ ${nfmt(estBirdKg(l, b, today()).kg)} kg/bird${x.meatStock ? ' · meat in stock ' + kgs(x.meatStock) : ''}</span></span><b>${x.totalIn} · ${x.dead} · ${x.soldBirds} · ${x.cutBirds} · <span style="color:var(--green);font-size:18px">${x.remaining}</span></b></div>`; }).join('')}
    </div>
    <div class="summary small">
      <div class="line"><span><b>Costs</b></span><b>${money(s.expenses)}</b></div>
      <div class="line"><span>🐣 Chicks</span><b>${money(s.costChicks)}</b></div>
      <div class="line"><span>🌾 Feed</span><b>${money(s.costFeed)}</b></div>
      <div class="line"><span>💊 Medicine / vitamin / vaccine</span><b>${money(s.costMed)}</b></div>
      <div class="line"><span>🧾 Other</span><b>${money(s.costOther)}</b></div>
      ${s.birdsOut ? `<div class="line"><span>Profit per bird sold</span><b>${money(s.profitPerBird)}</b></div>` : ''}
      ${s.feedPerKg ? `<div class="line"><span>Feed per kg sold</span><b>${nfmt(round(s.feedPerKg, 2))} kg</b></div>` : ''}
    </div>
    ${feed.length ? `<div class="summary small"><div class="line"><span><b>🌾 Feed used</b></span><b></b></div>${feed.map(g => `<div class="line"><span>${esc(g)}</span><b>${nfmt(s.feedByGrade[g])} kg · ${nfmt(round(s.feedByGrade[g] / bagKg(), 1))} bags</b></div>`).join('')}</div>` : ''}
    ${s.lastWeight ? `<p class="small">⚖️ Last avg weight: <b>${kgs(s.lastWeight)}</b> (${fmtDate(s.lastWeightDate)})</p>` : ''}
    ${s.meatStock ? `<p class="small">🔪 Cut meat not sold yet: <b>${kgs(s.meatStock)}</b></p>` : ''}
    <div class="grid2" style="margin-bottom:10px">
      ${l.closed ? '' : `<button class="btn primary" data-act="sellLot" data-id="${id}">+ Sale</button><button class="btn" data-act="addEvent" data-id="${id}" data-type="dead">+ Process entry</button>
      <button class="btn" data-act="countCheck" data-id="${id}">🔢 Count check</button>`}
      <button class="btn ghost" data-act="editLot" data-id="${id}">✎ Edit lot</button>
      ${l.closed ? `<button class="btn ghost" data-act="reopenLot" data-id="${id}">↺ Reopen lot</button>` : `<button class="btn ghost" data-act="closeLot" data-id="${id}">✅ Close lot</button>`}
      <button class="btn redl" data-act="deleteLot" data-id="${id}">🗄 Archive lot</button>
    </div>
    ${lotDailyHtml(l)}
    <h3>History</h3>
    <div class="seg">${[['sales', `💰 Sales (${groups.sales.length})`], ['buy', `🛒 Purchases (${groups.buy.length})`], ['process', `📝 Process (${groups.process.length})`], ['all', 'All']]
      .map(([k, lab]) => `<button class="${lotHistTab === k ? 'on' : ''}" data-act="lotHist" data-id="${id}" data-v="${k}">${lab}</button>`).join('')}</div>
    ${lotHistTab === 'sales' && shown.length ? `<div class="summary small"><div class="line"><span>Total sales</span><b style="color:var(--green)">${money(sumAmt(shown))} · ${kgs(shown.reduce((a, r) => a + (Number(r.kg) || 0), 0))} · ${shown.reduce((a, r) => a + (Number(r.birds) || 0), 0)} birds</b></div></div>` : ''}
    ${lotHistTab === 'buy' && shown.length ? `<div class="summary small"><div class="line"><span>Total purchases</span><b style="color:var(--red)">${money(sumAmt(shown) + (Number(l.chickCost) || 0))}</b></div>
      <div class="line"><span>incl. first chicks</span><b>${money(l.chickCost || 0)}</b></div></div>` : ''}
    ${shown.length ? shown.slice(0, 300).map(itemHtml).join('') : '<p class="muted">No entries here yet.</p>'}
  `);
}
// day-by-day sales of one lot: chart of the last 14 days + every day that had sales
function lotDailyHtml(l) {
  const byDay = {};
  all('sale').filter(r => r.lotId === l.id).forEach(r => {
    const d = byDay[r.date] || (byDay[r.date] = { amount: 0, kg: 0, birds: 0, n: 0 });
    d.amount += Number(r.amount) || 0; d.kg += Number(r.kg) || 0; d.birds += Number(r.birds) || 0; d.n++;
  });
  const t = today(), days = [];
  for (let i = 13; i >= 0; i--) { const d = addDays(t, -i); days.push({ d, s: byDay[d] || { amount: 0 } }); }
  const max = Math.max(1, ...days.map(x => x.s.amount));
  const list = Object.keys(byDay).sort().reverse();
  return `<h3>📈 Daily sales</h3>
    <div class="card tight"><div class="bars" style="height:120px">${days.map(x => `<div class="bar ${x.d === t ? 'today' : ''}" data-act="dayDetail" data-d="${x.d}" data-id="${l.id}" style="cursor:pointer"><em>${x.s.amount ? shortMoney(x.s.amount) : ''}</em><i style="height:${Math.round(x.s.amount / max * 100)}%"></i><small>${adToBs(x.d).d}</small></div>`).join('')}</div>
      <div class="small muted" style="text-align:center;margin-top:4px">Last 14 days · tap a bar for that day</div></div>
    ${list.length ? `<details${list.length <= 7 ? ' open' : ''}><summary class="small" style="font-weight:800;color:var(--muted)">Every day with sales (${list.length})</summary>
      <div class="summary small" style="margin-top:6px">${list.map(d => `<div class="line" data-act="dayDetail" data-d="${d}" data-id="${l.id}" style="cursor:pointer"><span><b>${fmtDate(d, true)}</b><br><span class="muted">${byDay[d].n} sale${byDay[d].n > 1 ? 's' : ''} · ${kgs(byDay[d].kg)} · ${byDay[d].birds} birds</span></span><b style="color:var(--green)">${money(byDay[d].amount)} ›</b></div>`).join('')}</div></details>` : ''}`;
}
// everything recorded on one day (optionally for one lot)
function openDay(date, lotId) {
  const lot = lotId ? lotById(lotId) : null;
  const inLot = r => !lotId || r.lotId === lotId;
  const day = Object.values(db.records).filter(r => !hidden(r) && r.date === date && inLot(r));
  const sales = day.filter(r => r.kind === 'sale' || (!lotId && r.kind === 'grainsale'));
  const buys = day.filter(r => r.kind === 'purchase' || (r.kind === 'event' && r.type === 'restock'));
  const proc = day.filter(r => r.kind === 'event' && r.type !== 'restock');
  const shop = lotId ? [] : day.filter(r => r.kind === 'shop');
  const sum = (l, k) => l.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const by = t => sales.filter(r => r.type === t);
  const perLot = {};
  if (!lotId) sales.filter(r => r.lotId).forEach(r => { perLot[r.lotId] = (perLot[r.lotId] || 0) + (Number(r.amount) || 0); });
  const sh = shopSum(shop);
  openSheet(`${lot ? `<button class="btn sm ghost" data-act="openLot" data-id="${lot.id}">‹ Back to ${esc(lot.name)}</button>` : ''}
    <h2>${fmtDate(date, true)}${lot ? ' · ' + esc(lot.name) : ''}</h2>
    <div class="summary">
      <div class="line"><span><b>Sales</b> (${sales.length})</span><b style="font-size:22px;color:var(--green)">${money(sum(sales, 'amount'))}</b></div>
      ${by('live').length ? `<div class="line"><span>🐔 Live</span><b>${kgs(sum(by('live'), 'kg'))} · ${sum(by('live'), 'birds')} birds · ${money(sum(by('live'), 'amount'))}</b></div>` : ''}
      ${by('meat').length ? `<div class="line"><span>🔪 Meat</span><b>${kgs(sum(by('meat'), 'kg'))} · ${sum(by('meat'), 'birds')} cut · ${money(sum(by('meat'), 'amount'))}</b></div>` : ''}
      ${by('parts').length ? `<div class="line"><span>🍗 Khutta-tauko</span><b>${kgs(sum(by('parts'), 'kg'))} · ${money(sum(by('parts'), 'amount'))}</b></div>` : ''}
      ${sales.filter(r => r.kind === 'grainsale').length ? `<div class="line"><span>🌾 Grain</span><b>${money(sum(sales.filter(r => r.kind === 'grainsale'), 'amount'))}</b></div>` : ''}
      ${Object.keys(perLot).map(id => `<div class="line"><span class="muted">${esc(lotName(id))}</span><b>${money(perLot[id])}</b></div>`).join('')}
      ${buys.length ? `<div class="line"><span><b>Bought</b> (${buys.length})</span><b style="color:var(--red)">${money(sum(buys, 'amount'))}</b></div>` : ''}
      ${shop.length ? `<div class="line"><span>🏪 Shop collected</span><b>${money(sh.total)} <span class="small muted">(goods ${money(sh.goods)})</span></b></div>` : ''}
    </div>
    ${sales.length ? `<h3>💰 Sales</h3>${sales.sort((a, b) => a.createdAt - b.createdAt).map(itemHtml).join('')}` : '<p class="muted">No sales this day.</p>'}
    ${buys.length ? `<h3>🛒 Purchases</h3>${buys.map(itemHtml).join('')}` : ''}
    ${proc.length ? `<h3>📝 Process</h3>${proc.map(itemHtml).join('')}` : ''}
    ${shop.length ? `<h3>🏪 Shop</h3>${shop.map(r => `<button class="item" data-act="editShopFromDay" data-id="${r.id}"><div class="ic" style="background:var(--green-l)">🏪</div><div class="mid"><div class="t">Collected ${money((Number(r.cash) || 0) + (Number(r.qr) || 0))}${r.goods ? ' · Goods ' + money(r.goods) : ''}</div><div class="s">Cash ${money(r.cash)} · QR ${money(r.qr)} · ${whoWhen(r)}</div></div></button>`).join('')}` : ''}
    <div style="height:10px"></div>
    <div class="btnrow"><button class="btn ghost" data-act="dayShift" data-d="${addDays(date, -1)}" data-id="${lotId || ''}">‹ ${esc(fmtDate(addDays(date, -1)))}</button>
      ${date < today() ? `<button class="btn ghost" data-act="dayShift" data-d="${addDays(date, 1)}" data-id="${lotId || ''}">${esc(fmtDate(addDays(date, 1)))} ›</button>` : ''}</div>
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}

function openLotForm(lot) {
  lotDraft = Object.assign({ kind: 'lot', name: '', breed: 'broiler', startDate: today(), chicks: '', chickCost: '', closed: false, note: '' }, lot || {});
  if (lot && lot.id) lotDraft.mix = lotMix(lot).map(m => Object.assign({}, m));
  lotDraft.nameManual = !!(lot && lot.id && lot.name && !/^[A-Za-z]+\d{2}(_\d{1,2})?_\d+_\d+$/.test(lot.name));
  if (!lotDraft.name) updateLotAutoName(true);
  const d = lotDraft;
  openSheet(`<h2>${d.id ? 'Edit lot' : 'New lot'}</h2><div id="lotForm">
    <div class="field"><label>Chicks by type <span class="muted">(fill one or more)</span></label>
      <div class="summary" style="padding:10px">${breeds().map(b => { const m = (d.mix || []).find(x => x.breed === b.id); return `<div class="row" style="gap:8px;margin-bottom:8px">
        <b style="flex:1">🐔 ${esc(b.name)}</b><input data-mix="${b.id}" type="number" inputmode="numeric" value="${m && m.chicks ? m.chicks : ''}" placeholder="0" style="width:120px;border:2px solid var(--line);border-radius:12px;padding:10px;font-size:20px;font-weight:800"></div>`; }).join('')}
        <div class="row between"><button class="btn sm ghost" data-act="addBreed">+ New type</button><b>Total: <span id="mixTotal">${num(d.chicks) || 0}</span> chicks</b></div></div></div>
    <div class="field"><label>Chicks arrived on (नेपाली)</label>${bsDateHtml('lot', d.startDate)}</div>
    <div class="field"><label>Lot name <span class="muted">(automatic)</span></label><input data-lf="name" value="${esc(d.name)}" autocomplete="off">
      <div class="hint">Month+year _ day _ lot no. in that month _ chicks, e.g. Ashar83_10_1_100</div></div>
    <div class="field"><label>Chick cost total Rs <span class="muted">(optional)</span></label><input data-lf="chickCost" type="number" inputmode="decimal" value="${esc(d.chickCost == null ? '' : d.chickCost)}" placeholder="—"></div>
    <div class="field"><label>Note <span class="muted">(optional)</span></label><textarea data-lf="note">${esc(d.note || '')}</textarea></div>
    <button class="btn big green" data-act="saveLot">✔ ${d.id ? 'Update lot' : 'Add lot'}</button>
    ${d.id ? `<div style="height:10px"></div><button class="btn big redl" data-act="deleteLot" data-id="${d.id}">🗄 Archive (delete) lot</button>${historyHtml(d.id)}` : ''}
  </div>`);
}

function saveLotForm() {
  $$('#lotForm [data-lf]').forEach(el => { lotDraft[el.dataset.lf] = el.value; });
  readLotMix();
  const d = lotDraft;
  const chicks = num(d.chicks);
  if (!chicks) { toast('Enter number of chicks for at least one type'); return; }
  if (!String(d.name || '').trim()) d.nameManual = false;
  if (!d.nameManual) updateLotAutoName(true);
  d.name = String(d.name || '').trim().replace(/\s+/g, '_');
  if (!d.name) { toast('Enter a lot name'); return; }
  const dup = lotByName(d.name);
  if (dup && dup.id !== d.id) { toast(`Lot ${d.name} already exists`); return; }
  const rec = Object.assign({}, d, { chicks: Math.round(chicks), chickCost: num(d.chickCost), note: (d.note || '').trim() });
  delete rec.nameManual;
  put(rec);
  closeSheet(); render();
  toast(`Lot ${rec.name} ${d.id ? 'updated' : 'added'} ✓`);
}

// ---------- RECORDS ----------
function renderRecords() {
  const f = recFilter;
  let list = Object.values(db.records).filter(r => !hidden(r) && (r.kind === 'sale' || r.kind === 'event' || r.kind === 'purchase' || r.kind === 'grainsale'));
  if (f.kind === 'sale') list = list.filter(r => r.kind === 'sale' || r.kind === 'grainsale');
  else if (f.kind === 'grain') list = list.filter(r => r.kind === 'grainsale');
  else if (f.kind === 'live' || f.kind === 'meat') list = list.filter(r => r.kind === 'sale' && r.type === f.kind);
  else if (f.kind === 'event') list = list.filter(r => r.kind === 'event');
  else if (f.kind === 'buy') list = list.filter(r => r.kind === 'purchase');
  else if (f.kind === 'flag') list = list.filter(r => (r.kind === 'sale' || r.kind === 'purchase' || r.kind === 'grainsale') && r.flag);
  if (f.lot) list = list.filter(r => r.lotId === f.lot);
  if (f.user) list = list.filter(r => (r.by || r.device) === f.user);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
  const sales = list.filter(r => r.kind === 'sale');
  const totKg = sales.reduce((a, r) => a + (Number(r.kg) || 0), 0), totAmt = sales.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  let html = '', lastDate = null;
  const byDay = {};
  sales.forEach(r => { byDay[r.date] = (byDay[r.date] || 0) + (Number(r.amount) || 0); });
  list.slice(0, f.limit).forEach(r => {
    if (r.date !== lastDate) { lastDate = r.date; html += `<div class="dayhead"><span>${fmtDate(r.date, true)}</span><span>${byDay[r.date] ? money(byDay[r.date]) : ''}</span></div>`; }
    html += itemHtml(r);
  });
  $('#repBody').innerHTML = `
    <div class="seg">${[['all', 'All'], ['sale', 'Sales'], ['live', 'Live'], ['meat', 'Meat'], ['grain', 'Grain'], ['buy', 'Bought'], ['event', 'Process'], ['flag', '⚑ Flag']]
      .map(([k, l]) => `<button class="${f.kind === k ? 'on' : ''}" data-act="recKind" data-v="${k}">${l}</button>`).join('')}</div>
    ${knownUsers().length > 1 ? `<div class="chips" style="margin-bottom:8px"><button class="chip sm ${!f.user ? 'on' : ''}" data-act="recUser" data-v="">All users</button>${knownUsers().map(u => `<button class="chip sm ${f.user === u ? 'on' : ''}" data-act="recUser" data-v="${esc(u)}">👤 ${esc(u)}</button>`).join('')}</div>` : ''}
    <div class="chips" style="margin-bottom:12px"><button class="chip ${!f.lot ? 'on' : ''}" data-act="recLot" data-id="">All lots</button>
      ${lots().map(l => `<button class="chip ${f.lot === l.id ? 'on' : ''}" data-act="recLot" data-id="${l.id}">${esc(l.name)}</button>`).join('')}</div>
    ${sales.length ? `<div class="card tight row between"><div><div class="label">Sales shown</div><b style="font-size:22px">${money(totAmt)}</b></div><div style="text-align:right"><div class="label">${sales.length} sales</div><b style="font-size:22px">${kgs(totKg)}</b></div></div>` : ''}
    <div class="btnrow" style="margin-bottom:6px"><button class="btn ghost sm" data-act="goSellNew">+ Sale</button><button class="btn ghost sm" data-act="goBuyNew">+ Purchase</button><button class="btn ghost sm" data-act="addEvent" data-id="${f.lot}">+ Process</button></div>
    ${html || '<div class="card empty"><div class="e">📋</div><p>No records yet.</p></div>'}
    ${list.length > f.limit ? `<button class="btn big ghost" data-act="recMore">Show more (${list.length - f.limit})</button>` : ''}`;
}
function editRec(id) {
  const r = db.records[id];
  if (!r) return;
  if (r.kind === 'sale') goSell(r);
  else if (r.kind === 'grainsale') { sellDraft = Object.assign({}, r, { type: 'grain', amountManual: true }); closeSheet(); go('sell'); }
  else if (r.kind === 'purchase') goBuy(r);
  else if (r.kind === 'event') openEventForm(Object.assign({}, r));
}
function deleteRec(id, after) {
  const r = db.records[id];
  if (!r) return;
  ask({ title: 'Delete this entry?', sub: r.kind === 'sale' ? `${kgs(r.kg)} ${r.type} · ${money(r.amount)} · ${fmtDate(r.date)}` : r.kind === 'purchase' ? `Bought ${purchaseTitle(r)} · ${money(r.amount)}` : r.kind === 'grainsale' ? `Sold grain ${r.grade} · ${money(r.amount)}` : `${lotName(r.lotId)}: ${eventTitle(r)}`,
    buttons: [{ label: '🗑 Delete', value: 'yes', cls: 'red' }, { label: 'Keep', value: 'no' }],
    onAnswer: a => {
      if (a !== 'yes') return;
      removeRec(id);
      if (sellDraft && sellDraft.id === id) { sellDraft = newSellDraft(sellDraft); if (view === 'sell') go('records'); }
      if (buyDraft && buyDraft.id === id) { buyDraft = null; if (view === 'buy') go('records'); }
      render(); toast('Deleted', id, true);
      if (after) after();
    } });
}
function deleteLot(id) {
  const l = lotById(id);
  if (!l) return;
  const n = Object.values(db.records).filter(r => !r.deleted && r.lotId === id).length;
  ask({ title: `Archive lot ${l.name}?`, sub: `It disappears from Home, reports and voice${n ? ', together with its ' + n + ' entries' : ''}. Nothing is deleted — restore it any time from Reports → Lots → 🗄 Archive.`,
    buttons: [{ label: `🗄 Archive ${esc(l.name)}`, value: 'yes', cls: 'red' }, { label: 'Keep', value: 'no' }],
    onAnswer: a => {
      if (a !== 'yes') return;
      archiveLot(id);
      if (sellDraft && sellDraft.lotId === id) sellDraft = null;
      closeSheet(); render(); toast(`Lot ${l.name} moved to archive`, null);
    } });
}
function openArchive() {
  const list = archivedLots();
  openSheet(`<h2>🗄 Archived lots</h2>
    <p class="small muted">Archived lots and their entries are hidden from Home, reports and voice. Restore brings everything back.</p>
    ${list.length ? list.map(l => {
      const n = Object.values(db.records).filter(r => !r.deleted && r.lotId === l.id);
      const sales = n.filter(r => r.kind === 'sale').reduce((a, r) => a + (Number(r.amount) || 0), 0);
      return `<div class="card tight">
        <div class="row between" style="align-items:flex-start"><div style="min-width:0"><b style="font-size:19px;word-break:break-all">${esc(l.name)}</b>
          <div class="small muted">${esc(breedName(l.breed))} · ${l.chicks} chicks · from ${fmtDate(l.startDate, true)}</div>
          <div class="small muted">${n.length} entries · sales ${money(sales)} · archived ${fmtDate(l.archivedAt, true)}</div></div></div>
        <button class="btn green" style="width:100%;margin-top:10px" data-act="restoreLot" data-id="${l.id}">↺ Restore</button></div>`; }).join('')
      : '<div class="card empty"><div class="e">🗄</div><p>The archive is empty.</p></div>'}
    <button class="btn big ghost" data-act="closeSheet">Close</button>`);
}

// ---------- SETTINGS ----------
function renderSettings() {
  const m = db.meta, pend = Object.keys(m.pending).length;
  const counts = { sale: all('sale').length, event: all('event').length, lot: all('lot').length };
  $('#v-settings').innerHTML = `
    <h2>Chicken types & prices</h2>
    <div class="card">
      ${breedPriceTable('sp')}
      <div class="field" style="margin-top:12px"><label>🍗 Khutta-tauko price Rs/kg</label><input data-set="partsPrice" type="number" inputmode="decimal" value="${getSet('partsPrice')}"></div>
      <h3>🌾 Grain rates (per bora)</h3>
      ${feedRateTable()}
      <div class="field"><label>When I don't say live or meat, use</label>
        <div class="chips"><button class="chip live ${getSet('defaultType') === 'live' ? 'on' : ''}" data-act="setDefType" data-v="live">🐔 Live</button>
        <button class="chip meat ${getSet('defaultType') === 'meat' ? 'on' : ''}" data-act="setDefType" data-v="meat">🔪 Meat</button></div></div>
      <div class="grid2">
        <div class="field"><label>Low stock alert (birds)</label><input data-set="lowStock" type="number" inputmode="numeric" value="${getSet('lowStock')}"></div>
        <div class="field"><label>Weight at day 30 (kg/bird)</label><input data-growth="d30" type="number" inputmode="decimal" step="any" value="${growth().d30}"></div>
        <div class="field"><label>Weight at day 45 (kg/bird)</label><input data-growth="d45" type="number" inputmode="decimal" step="any" value="${growth().d45}"></div>
        <div class="field"><label>Weight at day 60 (kg/bird)</label><input data-growth="d60" type="number" inputmode="decimal" step="any" value="${growth().d60}"></div>
        <div class="field"><label>Maximum weight (kg/bird)</label><input data-growth="max" type="number" inputmode="decimal" step="any" value="${growth().max}"></div>
        <div class="field"><label>Meat from 1 bird (% of live)</label><input data-set="dressPct" type="number" inputmode="numeric" value="${getSet('dressPct')}"><div class="hint">Used to guess chickens cut</div></div>
        <div class="field"><label>Feed bag size (kg)</label><input data-set="bagKg" type="number" inputmode="numeric" value="${bagKg()}"></div>
        <div class="field"><label>Ask for count every (days)</label><input data-set="checkDays" type="number" inputmode="numeric" value="${getSet('checkDays')}"><div class="hint">0 = never</div></div>
      </div>
      <p class="small muted">Types, prices and alerts are shared with all your phones.</p>
    </div>

    <h2>Voice</h2>
    <div class="card">
      <div class="field"><label>Voice language</label><select data-meta="voiceLang">
        ${[['en-IN', 'English (India) — best for Nepali accent'], ['en-US', 'English (US)'], ['ne-NP', 'नेपाली (Nepali)'], ['hi-IN', 'हिन्दी (Hindi)']].map(([v, l]) => `<option value="${v}" ${m.voiceLang === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></div>
      <label class="switch"><span><b>Speak replies</b><br><span class="small muted">The app talks back after voice commands</span></span><input type="checkbox" data-meta="speakOn" ${m.speakOn ? 'checked' : ''}></label>
      <label class="switch"><span><b>Listen for my answer</b><br><span class="small muted">After a question, the mic opens by itself</span></span><input type="checkbox" data-meta="autoListen" ${m.autoListen ? 'checked' : ''}></label>
      <label class="switch"><span><b>Confirm before saving</b><br><span class="small muted">Show what I heard and ask “Save?”</span></span><input type="checkbox" data-meta="confirmVoice" ${m.confirmVoice ? 'checked' : ''}></label>
      <div class="btnrow" style="margin-top:12px"><button class="btn" data-act="help">📖 Voice commands</button>${HAS_ANDROID ? '<button class="btn ghost" data-act="voiceSettings">Offline voice</button>' : ''}</div>
    </div>

    <h2>Phones & sync</h2>
    <div class="card">
      <div class="field"><label>👤 Who is using this phone</label><button class="btn big ghost" data-act="switchUser">👤 ${esc(currentUser())} — tap to change</button><div class="hint">Every new entry and change is saved with this name and the time.</div></div>
      <div class="field"><label>This phone's name</label><input data-meta="deviceName" value="${esc(m.deviceName)}"><div class="hint">Shown on every entry, so you know who recorded it.</div></div>
      <div class="field"><label>Google Sheet sync link</label><input data-meta="syncUrl" value="${esc(m.syncUrl)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div>
      <div class="field"><label>Farm sync key</label><input data-meta="syncKey" value="${esc(m.syncKey)}" placeholder="same on every phone" autocomplete="off"></div>
      <div class="summary small">
        <div class="line"><span>Status</span><b>${!m.syncUrl ? 'Not set up' : syncing ? 'Syncing…' : m.syncError ? '⚠ ' + esc(m.syncError) : '✓ OK'}</b></div>
        <div class="line"><span>Last sync</span><b>${m.lastSync ? new Date(m.lastSync).toLocaleString() : '—'}</b></div>
        <div class="line"><span>Waiting to upload</span><b>${pend}</b></div>
      </div>
      <div class="btnrow"><button class="btn primary" data-act="syncNow">☁️ Sync now</button><button class="btn ghost" data-act="syncHelp">How to set up</button></div>
      <h3>No internet? Use a sync file</h3>
      <p class="small muted">Send the file to the other phone (WhatsApp, Bluetooth, Drive), then “Import” there. Entries are merged — nothing is duplicated.</p>
      <div class="btnrow"><button class="btn" data-act="exportSync">📤 Send sync file</button><button class="btn" data-act="importSync">📥 Import</button></div>
    </div>

    ${updatesCardHtml()}
    <h2>Reports & backup</h2>
    <div class="card">
      <div class="grid2">
        <button class="btn" data-act="exportCsv" data-v="sales">📄 Sales (Excel CSV)</button>
        <button class="btn" data-act="exportCsv" data-v="process">📄 Process (CSV)</button>
        <button class="btn" data-act="exportCsv" data-v="lots">📄 Lots (CSV)</button>
        <button class="btn" data-act="exportCsv" data-v="purchases">📄 Purchases (CSV)</button>
        <button class="btn" data-act="exportCsv" data-v="shop">📄 Shop (CSV)</button>
        <button class="btn" data-act="shareSummary">💬 Share today</button>
      </div>
      <p class="small muted">The sync file is also a full backup.</p>
    </div>
    <p class="small muted" style="text-align:center">Chicken Khata v${APP_VERSION} · ${counts.lot} lots · ${counts.sale} sales · ${counts.event} process entries</p>`;
}
function openPriceSheet() {
  openSheet(`<h2>Prices by chicken type</h2><p class="small muted">Rs per kg. Used as the default rate for each sale.</p>
    <div id="priceForm">${breedPriceTable('bp')}
    <div class="field" style="margin-top:12px"><label>🍗 Khutta-tauko Rs/kg</label><input data-p="partsPrice" type="number" inputmode="decimal" value="${getSet('partsPrice')}"></div>
    <h3>🌾 Grain rates</h3>${feedRateTable()}</div>
    <button class="btn big green" data-act="savePrices">✔ Save prices</button>
    <p class="small muted">Tip: say “set giriraj meat price 650”.</p>`);
}

function openSyncSetup() {
  openSheet(`<h2>Use on many phones</h2>
    <p>All phones share one Google Sheet. Do this <b>once</b> on a computer or phone (5 minutes):</p>
    <ol class="steps">
      <li>Open <b>sheets.google.com</b> and create a blank sheet named <b>Chicken Khata</b>.</li>
      <li>Menu <b>Extensions → Apps Script</b>. Delete what is there and paste the code from the file <b>ChickenKhata-Sync.gs</b> (I gave it to you with the app).</li>
      <li>In the code, change <code>SYNC_KEY</code> to a secret word, e.g. <code>myfarm2026</code>. Press 💾 Save.</li>
      <li>Click <b>Deploy → New deployment</b> → type <b>Web app</b>. “Execute as”: <b>Me</b>. “Who has access”: <b>Anyone</b>. Click Deploy and allow access.</li>
      <li>Copy the <b>Web app URL</b> (ends with <code>/exec</code>).</li>
      <li>On <b>every phone</b>: Settings → paste the link and the same sync key → <b>Sync now</b>.</li>
    </ol>
    <p class="small muted">Phones sync automatically when the app opens, after each entry, and every 2 minutes. Without internet, entries wait and upload later. The sheet also shows readable Sales, Process and Lots tabs.</p>
    <button class="btn big primary" data-act="closeSheet">OK</button>`);
}
function onboarding() {
  openSheet(`<div style="text-align:center;font-size:56px">🐔</div><h2 style="text-align:center">Welcome to Chicken Khata</h2>
    <p class="muted" style="text-align:center">Record sales, deaths and feed by voice. Let's set a few things.</p>
    <div id="onbForm">
    <div class="field"><label>👤 Your name (who is entering)</label><input data-o="userName" value="${esc(db.meta.userName || '')}" placeholder="e.g. Ram"></div>
    <div class="field"><label>Name of this phone</label><input data-o="deviceName" value="${esc(db.meta.deviceName)}"></div>
    <label style="font-size:14px;font-weight:800;color:var(--muted)">Prices (Rs per kg) — fill what you sell</label>
    ${breedPriceTable('op')}
    <button class="btn big green" data-act="saveOnb">Continue → add first lot</button>
    <div style="height:10px"></div>
    <button class="btn big ghost" data-act="syncHelpFromOnb">I already use it on another phone</button></div>`);
}

// ---------- export / import ----------
const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
function exportCsv(which) {
  let rows, name;
  if (which === 'sales') {
    rows = [['Date (BS)', 'Date (AD)', 'Lot', 'Chicken type', 'Sale type', 'Kg', 'Birds', 'Rate', 'Amount', 'Invoice', 'Flag', 'Note', 'Phone']];
    all('sale').sort((a, b) => a.date.localeCompare(b.date)).forEach(r => rows.push([bsIso(r.date), r.date, lotName(r.lotId), breedName(r.breed || lotBreed(lotById(r.lotId))), r.type, r.kg, r.birds || '', r.rate, r.amount, r.invoice || '', r.flag ? 'FLAG' : '', r.note || '', r.device || '']));
    all('grainsale').sort((a, b) => a.date.localeCompare(b.date)).forEach(r => rows.push([bsIso(r.date), r.date, '', 'Grain ' + r.grade, 'grain', r.unit === 'kg' ? r.qty : r.qty * bagKg(), '', r.rate, r.amount, r.invoice || '', r.flag ? 'FLAG' : '', (r.unit === 'kg' ? '' : r.qty + ' bora ') + (r.note || ''), r.device || '']));
    name = 'chicken-sales-' + bsIso(today()) + '.csv';
  } else if (which === 'shop') {
    rows = [['Date (BS)', 'Date (AD)', 'Cash', 'QR', 'Collected', 'Goods bought', 'Collected − goods', 'Note', 'Phone']];
    all('shop').sort((a, b) => a.date.localeCompare(b.date)).forEach(r => { const c = (Number(r.cash) || 0) + (Number(r.qr) || 0); rows.push([bsIso(r.date), r.date, r.cash || 0, r.qr || 0, c, r.goods || 0, c - (Number(r.goods) || 0), r.note || '', r.device || '']); });
    name = 'shop-' + bsIso(today()) + '.csv';
  } else if (which === 'purchases') {
    rows = [['Date (BS)', 'Date (AD)', 'Category', 'Grain size', 'Item', 'Qty', 'Unit', 'Rate', 'Amount', 'Supplier', 'Bill no.', 'Credit', 'For lot', 'Note', 'Phone']];
    all('purchase').sort((a, b) => a.date.localeCompare(b.date)).forEach(r => rows.push([bsIso(r.date), r.date, (PURCHASE_CATS[r.category] || {}).label || r.category, r.grade || '', r.item || '', r.qty == null ? '' : r.qty, r.unit || '', r.rate == null ? '' : r.rate, r.amount, r.supplier || '', r.invoice || '', r.flag ? 'CREDIT' : '', r.lotId ? lotName(r.lotId) : '', r.note || '', r.device || '']));
    name = 'chicken-purchases-' + bsIso(today()) + '.csv';
  } else if (which === 'process') {
    rows = [['Date (BS)', 'Date (AD)', 'Lot', 'Type', 'Grain size', 'Item', 'Birds', 'Qty', 'Unit', 'Cost', 'Note', 'Phone']];
    all('event').sort((a, b) => a.date.localeCompare(b.date)).forEach(r => rows.push([bsIso(r.date), r.date, lotName(r.lotId), (EVENT_TYPES[r.type] || {}).label || r.type, r.grade || '', r.item || '', r.count == null ? '' : r.count, r.qty == null ? '' : r.qty, r.unit || '', r.amount == null ? '' : r.amount, r.note || '', r.device || '']));
    name = 'chicken-process-' + bsIso(today()) + '.csv';
  } else {
    const st = computeStats();
    rows = [['Lot', 'Chicken type', 'Start (BS)', 'Status', 'Chicks', 'Dead', 'Mortality %', 'Sold live', 'Cut', 'Left', 'Live kg', 'Meat kg', 'Sales Rs', 'Chick cost', 'Feed cost', 'Medicine cost', 'Other cost', 'Total cost', 'Profit Rs', 'Profit per bird', 'Feed kg', 'Feed per kg sold']];
    lots().forEach(l => { const s = st[l.id]; rows.push([l.name, breedName(l.breed), bsIso(l.startDate), l.closed ? 'Closed ' + bsIso(l.closedDate || '') : 'Active', s.totalIn, s.dead, round(s.mortality, 1), s.soldBirds, s.cutBirds, s.remaining, round(s.liveKg), round(s.meatKg), round(s.revenue), round(s.costChicks), round(s.costFeed), round(s.costMed), round(s.costOther), round(s.expenses), round(s.profit), round(s.profitPerBird), round(s.feedKg), round(s.feedPerKg, 2)]); });
    name = 'chicken-lots-' + bsIso(today()) + '.csv';
  }
  saveTextFile(name, 'text/csv', csv(rows), ok => toast(ok ? 'Saved ' + name : 'Not saved'));
}

function exportSync() {
  const data = { app: 'chickenkhata', kind: 'sync', version: 1, from: db.meta.deviceName, exportedAt: new Date().toISOString(), records: Object.values(db.records) };
  const name = 'chicken-khata-' + normName(db.meta.deviceName).slice(0, 12) + '-' + today() + '.json';
  saveTextFile(name, 'application/json', JSON.stringify(data), ok => toast(ok ? 'Saved. Now send this file to the other phone and Import it there.' : 'Not saved'));
}
function importSync() {
  openTextFile(text => {
    if (!text) { toast('No file opened'); return; }
    let data;
    try { data = JSON.parse(text); } catch (e) { toast('This is not a Chicken Khata sync file'); return; }
    if (!data || data.app !== 'chickenkhata' || !Array.isArray(data.records)) { toast('This is not a Chicken Khata sync file'); return; }
    const before = {};
    data.records.forEach(r => { if (r && r.id) before[r.id] = db.records[r.id] && db.records[r.id].updatedAt; });
    const n = mergeRecords(data.records);
    if (db.meta.syncUrl) data.records.forEach(r => { if (r && r.id && db.records[r.id] && db.records[r.id].updatedAt !== before[r.id]) db.meta.pending[r.id] = 1; });
    persist(true); render(); scheduleSync(500);
    info('Import finished', `<p style="font-size:20px"><b>${n}</b> new or changed entries merged from <b>${esc(data.from || 'other phone')}</b>.</p>`, '', false);
  });
}
function shareSummary() {
  const t = today(), s = periodStats(t, t), st = computeStats();
  const lines = [`🐔 Chicken Khata — ${fmtDate(t, true)}`, `Sales: ${money(s.amount)} (${s.count} sales)`, `Live: ${kgs(s.liveKg)} · Meat: ${kgs(s.meatKg)}`, `Dead today: ${s.dead}`, '',
    ...activeLots().map(l => `${l.name}: ${st[l.id].remaining} left (day ${st[l.id].age})`)];
  shareText(lines.join('\n'));
}

// ---------- Nepali date picker ----------
function bsDateHtml(key, adIso) {
  adIso = adIso || today();
  const b = adToBs(adIso), tb = adToBs(today());
  const years = [];
  for (let y = tb.y - 2; y <= tb.y + 1; y++) years.push(y);
  if (!years.includes(b.y)) years.unshift(b.y);
  const opt = (v, l, sel) => `<option value="${v}" ${sel ? 'selected' : ''}>${l}</option>`;
  let days = '';
  for (let d = 1; d <= bsDays(b.y, b.m); d++) days += opt(d, d, d === b.d);
  return `<div class="bsdate" data-bsdate="${key}">
      <select data-bsp="d">${days}</select>
      <select data-bsp="m">${BS_MONTHS.map((m, i) => opt(i + 1, m, i + 1 === b.m)).join('')}</select>
      <select data-bsp="y">${years.map(y => opt(y, y, y === b.y)).join('')}</select>
    </div>
    <div class="row between" style="margin-top:6px">
      <div class="chips"><button class="chip sm ${adIso === today() ? 'on' : ''}" data-act="bsQuick" data-key="${key}" data-days="0">Today</button>
      <button class="chip sm ${adIso === addDays(today(), -1) ? 'on' : ''}" data-act="bsQuick" data-key="${key}" data-days="-1">Yesterday</button></div>
      <span class="hint" data-bshint="${key}">AD ${adIso}</span>
    </div>`;
}

function readBsDate(wrap) {
  const g = p => Number(wrap.querySelector(`[data-bsp=${p}]`).value);
  return bsToAd(g('y'), g('m'), g('d'));
}

function setBsDraftDate(key, ad) {
  if (key === 'sell' && sellDraft) sellDraft.date = ad;
  else if (key === 'ev' && eventDraft) eventDraft.date = ad;
  else if (key === 'lot' && lotDraft) { lotDraft.startDate = ad; updateLotAutoName(); }
  else if (key === 'buy' && buyDraft) buyDraft.date = ad;
  else if (key === 'shop' && shopDraft) { $$('#shopForm [data-s]').forEach(el => { shopDraft[el.dataset.s] = el.value; }); shopDraft.date = ad; renderShop(); }
}

function bsDateChanged(sel) {
  const wrap = sel.closest('[data-bsdate]');
  const key = wrap.dataset.bsdate;
  const y = Number(wrap.querySelector('[data-bsp=y]').value), m = Number(wrap.querySelector('[data-bsp=m]').value);
  const dSel = wrap.querySelector('[data-bsp=d]');
  const max = bsDays(y, m), cur = Math.min(Number(dSel.value), max);
  if (dSel.options.length !== max) { let h = ''; for (let d = 1; d <= max; d++) h += `<option value="${d}" ${d === cur ? 'selected' : ''}>${d}</option>`; dSel.innerHTML = h; }
  const ad = readBsDate(wrap);
  const hint = document.querySelector(`[data-bshint=${key}]`);
  if (hint) hint.textContent = 'AD ' + ad;
  $$(`[data-act=bsQuick][data-key=${key}]`).forEach(c => c.classList.toggle('on', ad === addDays(today(), Number(c.dataset.days))));
  setBsDraftDate(key, ad);
}

function bsQuick(key, days) {
  const ad = addDays(today(), days), b = adToBs(ad);
  const wrap = document.querySelector(`[data-bsdate=${key}]`);
  if (!wrap) return;
  wrap.querySelector('[data-bsp=y]').value = b.y;
  wrap.querySelector('[data-bsp=m]').value = b.m;
  bsDateChanged(wrap.querySelector('[data-bsp=m]'));
  wrap.querySelector('[data-bsp=d]').value = b.d;
  bsDateChanged(wrap.querySelector('[data-bsp=d]'));
}

function readLotMix() {
  const mix = [];
  $$('#lotForm [data-mix]').forEach(el => { const n = Math.round(num(el.value) || 0); if (n > 0) mix.push({ breed: el.dataset.mix, chicks: n }); });
  lotDraft.mix = mix;
  lotDraft.chicks = mix.reduce((a, m) => a + m.chicks, 0);
  lotDraft.breed = mix.length ? mix[0].breed : lotDraft.breed;
  const t = $('#mixTotal'); if (t) t.textContent = lotDraft.chicks;
}
function updateLotAutoName(silent) {
  const d = lotDraft;
  if (!d || d.nameManual) return;
  const old = d.id ? db.records[d.id] : null;
  const sameMonth = old && adToBs(old.startDate) && adToBs(d.startDate) && adToBs(old.startDate).m === adToBs(d.startDate).m && adToBs(old.startDate).y === adToBs(d.startDate).y;
  d.seq = sameMonth && old.seq ? old.seq : nextLotSeq(d.startDate, d.id);
  d.name = lotAutoName(d.startDate, d.seq, num(d.chicks) || 0);
  if (!silent) { const el = $('#lotForm [data-lf=name]'); if (el) el.value = d.name; }
}

function breedPriceTable(prefix) {
  return `<div class="summary" style="padding:10px">
    <div class="row" style="font-size:13px;font-weight:800;color:var(--muted);padding:0 2px 6px"><span style="flex:1.3">Type</span><span style="flex:1">🐔 Live /kg</span><span style="flex:1">🔪 Meat /kg</span></div>
    ${breeds().map(b => `<div class="row" style="gap:6px;margin-bottom:8px">
      <b style="flex:1.3;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(b.name)}</b>
      <input style="flex:1;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px;font-size:18px;font-weight:700" data-${prefix}="${b.id}" data-ptype="live" type="number" inputmode="decimal" value="${b.live || ''}" placeholder="—">
      <input style="flex:1;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px;font-size:18px;font-weight:700" data-${prefix}="${b.id}" data-ptype="meat" type="number" inputmode="decimal" value="${b.meat || ''}" placeholder="—">
    </div>`).join('')}
    <button class="btn sm ghost" data-act="addBreed">+ Add chicken type</button>
  </div>`;
}

function feedRateTable() {
  const r = feedRates(), inp = (g, k) => `<input style="flex:1;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px;font-size:18px;font-weight:700" data-fr="${g}" data-fk="${k}" type="number" inputmode="decimal" value="${r[g][k] || ''}" placeholder="—">`;
  return `<div class="summary" style="padding:10px">
    <div class="row" style="font-size:13px;font-weight:800;color:var(--muted);padding:0 2px 6px"><span style="flex:.7">Grain</span><span style="flex:1">🛒 Buy /bora</span><span style="flex:1">💰 Sell /bora</span></div>
    ${FEED_GRADES.map(g => `<div class="row" style="gap:6px;margin-bottom:4px"><b style="flex:.7">🌾 ${g}</b>${inp(g, 'buy')}${inp(g, 'sell')}</div>
      <div class="small muted" style="margin:0 0 8px 2px">${r[g].buy || r[g].sell ? `per kg: buy ${money(r[g].buy / bagKg())} · sell ${money(r[g].sell / bagKg())}` : '&nbsp;'}</div>`).join('')}
    <div class="small muted">1 bora = ${bagKg()} kg (change in Settings)</div>
  </div>`;
}
function saveFeedRateInputs() {
  const r = feedRates();
  $$('[data-fr]').forEach(el => { r[el.dataset.fr][el.dataset.fk] = num(el.value) || 0; });
  setSet('feedRates', r);
}
function readBreedPrices(prefix) {
  const list = breeds().map(b => Object.assign({}, b));
  $$(`[data-${prefix}]`).forEach(el => { const b = list.find(x => x.id === el.dataset[prefix]); if (b) b[el.dataset.ptype] = num(el.value) || 0; });
  return list;
}

// ---------- BUY (purchases) ----------
function newBuyDraft(keep) {
  return { kind: 'purchase', category: (keep && keep.category) || 'feed', grade: (keep && keep.grade) || '', item: '', qty: '', unit: (keep && keep.unit) || 'bags', rate: '', amount: '',
    amountManual: false, date: (keep && keep.date) || today(), supplier: (keep && keep.supplier) || '', invoice: '', flag: false, lotId: '', note: '' };
}
function goBuy(rec) {
  buyDraft = rec ? Object.assign({}, rec, { qty: rec.qty == null ? '' : rec.qty, rate: rec.rate == null ? '' : rec.rate, amount: rec.amount == null ? '' : rec.amount, amountManual: true }) : null;
  if (rec && !rec.id) buyDraft.amountManual = rec.amount != null;
  closeSheet();
  go('buy');
}
function knownItems(cat) {
  const set = {};
  Object.values(db.records).forEach(r => { if (!hidden(r) && r.item && ((r.kind === 'purchase' && r.category === cat) || (r.kind === 'event' && r.type === cat))) set[r.item.trim()] = 1; });
  return Object.keys(set).sort();
}
function knownSuppliers() {
  const set = {};
  all('purchase').forEach(r => { if (r.supplier) set[r.supplier.trim()] = 1; });
  return Object.keys(set).sort();
}
function buyCalc(d) {
  const qty = num(d.qty) || 0;
  let rate = num(d.rate);
  if (rate == null && d.category === 'feed' && d.grade) rate = feedRateFor(d.grade, 'buy', d.unit) || null;
  const amount = d.amountManual && num(d.amount) != null ? num(d.amount) : (rate != null ? round(qty * rate, 2) : 0);
  return { qty, rate, amount };
}
function renderBuy() {
  if (!buyDraft) buyDraft = newBuyDraft();
  const d = buyDraft, c = buyCalc(d), cat = PURCHASE_CATS[d.category] || PURCHASE_CATS.other;
  const inv = computeInventory();
  const si = STOCK_CATS.includes(d.category) ? inv[stockKey(d.category, d)] : null;
  $('#v-buy').innerHTML = `
    <h2>${d.id ? 'Edit purchase' : 'New purchase'}</h2>
    <div class="card" id="buyForm">
      <div class="field"><label>What did you buy?</label><div class="chips">${Object.keys(PURCHASE_CATS).map(k => `<button class="chip ${d.category === k ? 'on' : ''}" data-act="buyCat" data-v="${k}">${PURCHASE_CATS[k].icon} ${PURCHASE_CATS[k].label}</button>`).join('')}</div></div>
      ${d.category === 'feed' ? `<div class="field"><label>Grain size</label><div class="chips">${FEED_GRADES.concat(['']).map(g => `<button class="chip ${(d.grade || '') === g ? 'on' : ''}" data-act="buyGrade" data-v="${g}">${g || 'Other'}</button>`).join('')}</div></div>`
        : `<div class="field"><label>${cat.label} name</label><input data-b="item" list="buyItems" value="${esc(d.item || '')}" placeholder="e.g. ${d.category === 'vitamin' ? 'Vitamin AD3' : d.category === 'vaccine' ? 'Ranikhet (F1)' : d.category === 'medicine' ? 'Amprolium' : 'Feeder'}" autocomplete="off">
          <datalist id="buyItems">${knownItems(d.category).map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>`}
      <div class="grid2">
        <div class="field"><label>Quantity</label><input data-b="qty" type="number" inputmode="decimal" step="any" value="${esc(d.qty)}" placeholder="0"></div>
        <div class="field"><label>Unit</label><select data-b="unit">${cat.units.map(u => `<option value="${u}" ${d.unit === u ? 'selected' : ''}>${u === 'bags' ? 'bora (bag)' : u}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Rate Rs per ${esc(d.unit === 'bags' ? 'bora' : d.unit || 'unit')}</label><input data-b="rate" type="number" inputmode="decimal" step="any" value="${esc(d.rate)}" placeholder="${d.category === 'feed' && d.grade && feedRateFor(d.grade, 'buy', d.unit) ? feedRateFor(d.grade, 'buy', d.unit) : '0'}">
        ${d.category === 'feed' && d.grade ? `<div class="hint">Saved ${esc(d.grade)} buying rate: ${feedRates()[d.grade].buy ? money(feedRates()[d.grade].buy) + ' / bora (' + money(feedRates()[d.grade].buy / bagKg()) + '/kg)' : 'not set'}</div>` : ''}</div>
      <div class="totalbox" style="background:var(--red-l);color:var(--red)"><span><b style="font-size:15px">TOTAL PAID</b><br><span class="small" id="buyCalcTxt">${d.amountManual ? 'entered by you' : nfmt(c.qty) + ' × ' + money(c.rate || 0)}</span></span><b id="buyTotal">${money(c.amount)}</b></div>
      <div class="field"><label>Total (change only if different)</label><input data-b="amount" type="number" inputmode="decimal" step="any" value="${d.amountManual ? esc(d.amount) : ''}" placeholder="${round(c.amount)}"></div>
      <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('buy', d.date)}</div>
      <div class="field"><label>Shop / supplier <span class="muted">(optional)</span></label><input data-b="supplier" list="buySup" value="${esc(d.supplier || '')}" placeholder="—" autocomplete="off">
        <datalist id="buySup">${knownSuppliers().map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="field"><label>Bill no. <span class="muted">(optional)</span></label><input data-b="invoice" value="${esc(d.invoice || '')}" placeholder="—" autocomplete="off"></div>
      <div class="field"><label>Only for one lot? <span class="muted">(optional — then it is charged to that lot directly, not kept in stock)</span></label>
        <div class="choice">${activeLots().map(l => `<button class="chip ${d.lotId === l.id ? 'on' : ''}" style="text-align:left" data-act="buyLot" data-id="${l.id}">${esc(l.name)}</button>`).join('') || '<span class="muted small">No active lots</span>'}</div></div>
      <label class="switch"><span><b>⚑ Bought on credit</b><br><span class="small muted">Not paid yet (udharo)</span></span><input type="checkbox" data-b="flag" ${d.flag ? 'checked' : ''}></label>
      <div class="field" style="margin-top:10px"><label>Note <span class="muted">(optional)</span></label><input data-b="note" value="${esc(d.note || '')}" placeholder="—" autocomplete="off"></div>
      <button class="btn big green" data-act="saveBuy">✔ ${d.id ? 'Update purchase' : 'Save purchase'}</button>
      ${d.id ? `<div style="height:10px"></div><div class="btnrow"><button class="btn ghost" data-act="cancelEditBuy">Cancel</button><button class="btn redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button></div>${historyHtml(d.id)}` : ''}
    </div>
    ${si && si.boughtAll ? `<p class="muted small" style="text-align:center">In stock now: <b>${esc(si.label)} ${fmtStockQty(si)}</b></p>` : ''}
    <p class="muted small" style="text-align:center">Or tap 🎤 and say “bought 10 bags B2 feed for 34000”</p>`;
}
function readBuyForm() {
  $$('#buyForm [data-b]').forEach(el => { const f = el.dataset.b; if (f === 'flag') buyDraft.flag = el.checked; else if (f !== 'amount') buyDraft[f] = el.value; });
}
function buyInput(el) {
  const f = el.dataset.b, d = buyDraft;
  if (f === 'flag') d.flag = el.checked;
  else if (f === 'amount') { d.amount = el.value; d.amountManual = el.value !== ''; }
  else d[f] = el.value;
  if (f === 'unit') { renderBuy(); return; }
  const c = buyCalc(d);
  const tot = $('#buyTotal'), txt = $('#buyCalcTxt');
  if (tot) tot.textContent = money(c.amount);
  if (txt) txt.textContent = d.amountManual ? 'entered by you' : nfmt(c.qty) + ' × ' + money(c.rate || 0);
  const amt = $('#buyForm [data-b=amount]');
  if (amt && !d.amountManual) amt.placeholder = round(c.amount);
}
function saveBuyForm() {
  readBuyForm();
  const d = buyDraft, c = buyCalc(d);
  if (!c.amount) { toast('Enter the rate or the total paid'); return; }
  if (d.category !== 'feed' && d.category !== 'other' && d.category !== 'equipment' && !String(d.item || '').trim()) { toast('Enter the name, e.g. Amprolium'); return; }
  const rec = { kind: 'purchase', date: d.date || today(), category: d.category, grade: d.category === 'feed' ? (d.grade || '') : '', item: d.category === 'feed' ? '' : String(d.item || '').trim(),
    qty: c.qty || null, unit: d.unit, rate: c.rate != null ? c.rate : (c.qty ? round(c.amount / c.qty, 2) : null), amount: c.amount,
    supplier: String(d.supplier || '').trim(), invoice: String(d.invoice || '').trim(), flag: !!d.flag, lotId: d.lotId || '', note: String(d.note || '').trim() };
  const editing = !!d.id;
  if (editing) { rec.id = d.id; rec.createdAt = d.createdAt; rec.heard = d.heard; }
  put(rec);
  if (rec.category === 'feed' && rec.grade && num(d.rate) != null) askFeedRate(rec.grade, 'buy', perBag(num(d.rate), rec.unit), false, () => {});
  const sl = stockLeftNote(rec.category, rec);
  toast(`${editing ? 'Updated' : 'Saved'} ✓ bought ${purchaseTitle(rec)} · ${money(rec.amount)}. ${sl.text}`, editing ? null : rec.id);
  buyDraft = newBuyDraft(rec);
  render();
  if (editing) go('records');
}

// ---------- REPORTS ----------
function goReport(tab, period) {
  if (tab) reportTab = tab;
  if (period) reportPeriod = period;
  go('reports');
}
function reportRange(key) {
  const t = today(), b = adToBs(t);
  const fyStartY = b.m >= 4 ? b.y : b.y - 1;
  switch (key) {
    case 'lastmonth': { const y = b.m === 1 ? b.y - 1 : b.y, m = b.m === 1 ? 12 : b.m - 1; return [bsToAd(y, m, 1), bsToAd(y, m, bsDays(y, m)), BS_MONTHS[m - 1] + ' ' + y]; }
    case 'fy': return [bsToAd(fyStartY, 4, 1), t, 'This year (FY ' + fyStartY + '/' + pad2((fyStartY + 1) % 100) + ')'];
    case 'lastfy': return [bsToAd(fyStartY - 1, 4, 1), addDays(bsToAd(fyStartY, 4, 1), -1), 'Last year (FY ' + (fyStartY - 1) + '/' + pad2(fyStartY % 100) + ')'];
    case 'all': return ['0000-00-00', '9999-99-99', 'All time'];
    default: return [bsMonthStart(t), t, BS_MONTHS[b.m - 1] + ' ' + b.y + ' (this month)'];
  }
}
function renderReports() {
  const tabs = [['profit', '📊 Profit'], ['lots', '🐣 Lots'], ['stock', '📦 Stock'], ['records', '📋 Records'], ['log', '📜 Log']];
  $('#v-reports').innerHTML = `<div class="seg" style="margin-top:6px">${tabs.map(([k, l]) => `<button class="${reportTab === k ? 'on' : ''}" data-act="repTab" data-v="${k}">${l}</button>`).join('')}</div><div id="repBody"></div>`;
  ({ profit: renderProfit, lots: renderLots, stock: renderStock, records: renderRecords, log: renderLog })[reportTab]();
}
function renderProfit() {
  const [from, to, label] = reportRange(reportPeriod);
  const R = farmReport(from, to);
  const st = computeStats();
  const lotList = lots().filter(l => reportPeriod === 'all' || (l.startDate <= to && (!l.closed || !l.closedDate || l.closedDate >= from)));
  const line = (k, v, style) => `<div class="line"><span>${k}</span><b ${style ? `style="${style}"` : ''}>${v}</b></div>`;
  $('#repBody').innerHTML = `
    <div class="chips" style="margin-bottom:12px">${[['month', 'This month'], ['lastmonth', 'Last month'], ['fy', 'This year'], ['lastfy', 'Last year'], ['all', 'All time']]
      .map(([k, l]) => `<button class="chip sm ${reportPeriod === k ? 'on' : ''}" data-act="repPeriod" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="card ${R.profit >= 0 ? 'today' : ''}" style="${R.profit < 0 ? 'background:var(--red);color:#fff' : ''}">
      <div class="label" style="color:rgba(255,255,255,.85)">${esc(label)}</div>
      <div class="label" style="color:rgba(255,255,255,.85);margin-top:8px">${R.profit >= 0 ? 'Profit' : 'Loss'}</div>
      <div class="huge">${money(Math.abs(R.profit))}</div>
      <div class="grid2" style="margin-top:12px">
        <div class="stat" style="background:rgba(255,255,255,.18)"><b>${money(R.sales)}</b><span style="color:rgba(255,255,255,.85)">Money in (sales)</span></div>
        <div class="stat" style="background:rgba(255,255,255,.18)"><b>${money(R.costs)}</b><span style="color:rgba(255,255,255,.85)">Money out (costs)</span></div>
      </div>
    </div>
    <h3>Sales</h3>
    <div class="summary">
      ${line('🐔 Live', kgs(R.liveKg) + ' · ' + money(R.liveRev))}
      ${line('🔪 Meat', kgs(R.meatKg) + ' · ' + money(R.meatRev))}
      ${R.partsRev ? line('🍗 Khutta-tauko', kgs(R.partsKg) + ' · ' + money(R.partsRev)) : ''}
      ${R.grainRev ? line('🌾 Grain sold', nfmt(round(R.grainKg / bagKg(), 1)) + ' bora · ' + money(R.grainRev)) : ''}
      ${line('Number of sales', R.salesCount)}
      ${R.credit ? line('⚑ Not yet received (credit)', money(R.credit), 'color:var(--red)') : ''}
      ${line('<b>Total sales</b>', money(R.sales), 'color:var(--green);font-size:20px')}
    </div>
    <h3>Costs</h3>
    <div class="summary">
      ${line('🐣 Chicks (' + R.chicks + ')', money(R.chicksCost))}
      ${line('🌾 Feed / grain', money(R.feed))}
      ${line('💊 Medicine, vitamin, vaccine', money(R.med))}
      ${R.equip ? line('🧰 Equipment', money(R.equip)) : ''}
      ${R.other + R.expenses ? line('🧾 Other expenses', money(R.other + R.expenses)) : ''}
      ${R.payable ? line('⚑ Bought on credit (to pay)', money(R.payable), 'color:var(--red)') : ''}
      ${line('<b>Total costs</b>', money(R.costs), 'color:var(--red);font-size:20px')}
    </div>
    <div class="summary small">
      ${line('Dead birds', R.dead)}
      ${line('Feed bought / used', nfmt(round(R.feedKgBought)) + ' / ' + nfmt(round(R.feedKgUsed)) + ' kg')}
      ${line('Stock in hand now (value)', money(R.stockValue))}
      <div class="muted" style="padding-top:6px">Profit = sales − everything bought or spent in this period. Feed and medicine still in stock are shown above (not subtracted twice).</div>
    </div>
    <h3>Profit by lot</h3>
    ${lotList.length ? lotList.map(l => { const s = st[l.id]; return `<button class="item" data-act="openLot" data-id="${l.id}" style="align-items:flex-start">
      <div class="ic">${l.closed ? '📦' : '🐣'}</div>
      <div class="mid"><div class="t">${esc(l.name)} <span class="pill purple">${esc(breedName(l.breed))}</span></div>
        <div class="s">Sales ${money(s.revenue)} · Cost ${money(s.expenses)}<br>Dead ${s.dead} (${round(s.mortality, 1)}%) · Sold ${s.birdsOut} birds · ${kgs(s.kg)}${s.feedPerKg ? ' · Feed/kg ' + nfmt(round(s.feedPerKg, 2)) : ''}</div></div>
      <div class="amt" style="color:${s.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${s.profit >= 0 ? '' : '−'}${money(Math.abs(s.profit))}${s.birdsOut ? `<div class="small muted">${money(s.profitPerBird)}/bird</div>` : ''}</div></button>`; }).join('')
      : '<p class="muted">No lots in this period.</p>'}
    <p class="small muted">Lot profit counts all of a lot's life: chick cost, purchases made for that lot, feed &amp; medicine used (at average bought price) and other expenses.</p>
    <div class="grid2" style="margin-top:10px"><button class="btn" data-act="shareReport">💬 Share report</button><button class="btn" data-act="exportCsv" data-v="lots">📄 Lots (CSV)</button></div>`;
}
function reportText() {
  const [from, to, label] = reportRange(reportPeriod);
  const R = farmReport(from, to), st = computeStats();
  return [`🐔 Chicken Khata — ${label}`, `Sales: ${money(R.sales)} (live ${kgs(R.liveKg)}, meat ${kgs(R.meatKg)})`,
    `Costs: ${money(R.costs)} (chicks ${money(R.chicksCost)}, feed ${money(R.feed)}, medicine ${money(R.med)}, other ${money(R.other + R.expenses + R.equip)})`,
    `${R.profit >= 0 ? 'PROFIT' : 'LOSS'}: ${money(Math.abs(R.profit))}`, R.credit ? `To receive (credit sales): ${money(R.credit)}` : '', R.payable ? `To pay (credit purchases): ${money(R.payable)}` : '', '',
    ...lots().filter(l => !l.closed || (l.closedDate || '') >= from).map(l => `${l.name}: profit ${money(st[l.id].profit)}, left ${st[l.id].remaining}, dead ${st[l.id].dead}`)].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
}
function renderStock() {
  const inv = computeInventory();
  const list = Object.keys(inv).filter(k => k[0] !== '_').map(k => inv[k]).filter(i => i.boughtAll || i.used)
    .sort((a, b) => STOCK_CATS.indexOf(a.cat) - STOCK_CATS.indexOf(b.cat) || a.label.localeCompare(b.label));
  const group = cat => list.filter(i => i.cat === cat);
  $('#repBody').innerHTML = `
    <button class="btn big primary" data-act="goBuyNew">🛒 Record a purchase</button>
    ${list.length ? STOCK_CATS.filter(c => group(c).length).map(c => `<h3>${PURCHASE_CATS[c].icon} ${PURCHASE_CATS[c].label}</h3>
      ${group(c).map(i => `<div class="card tight">
        <div class="row between"><b style="font-size:19px">${esc(i.label)}</b><b style="font-size:22px;color:${i.left <= 0 ? 'var(--red)' : 'var(--green)'}">${fmtStockQty(i)}</b></div>
        <div class="small muted" style="margin-top:4px">Bought ${fmtStockQty(i, i.bought)} · Used ${fmtStockQty(i, i.used)}${i.avg ? ' · Avg ' + money(i.cat === 'feed' ? i.avg * bagKg() : i.avg) + '/' + (i.cat === 'feed' ? 'bag' : i.unit || 'unit') : ''}${i.value ? ' · Worth ' + money(i.value) : ''}</div>
      </div>`).join('')}`).join('')
      : '<div class="card empty"><div class="e">📦</div><p>No purchases yet.<br>Say “bought 10 bags B2 feed for 34000”.</p></div>'}
    <p class="small muted">Stock left = bought − used. Record use with a process entry (Feed / Medicine / Vitamin / Vaccine) on the lot.</p>`;
}

// ---------- events ----------
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, id = b.dataset.id, v = b.dataset.v;
  switch (act) {
    case 'go': closeSheet(); go(b.dataset.view); break;
    case 'mic': if (listening) cancelListening(); else listen(); break;
    case 'cancelVoice': cancelListening(); break;
    case 'closeSheet': closeSheet(); break;
    case 'askBtn': if (pendingAsk) resolveAsk(pendingAsk.buttons[+b.dataset.i].value); break;
    case 'askInputOk': {
      const raw = $('#askInput').value.trim();
      if (pendingAsk && pendingAsk.input && pendingAsk.input.text) { if (!raw) { toast('Type a name'); return; } resolveAsk(raw); break; }
      const x = num(raw); if (x == null) { toast('Enter a number'); return; } resolveAsk(x); break;
    }
    case 'toastUndo': if (toastUndo) { (toastUndo.restore ? restoreRec : removeRec)(toastUndo.id); render(); $('#toast').classList.add('hidden'); toast(toastUndo.restore ? 'Restored' : 'Undone'); toastUndo = null; } break;
    case 'editPrice': openPriceSheet(); break;
    case 'savePrices': saveBreeds(readBreedPrices('bp')); saveFeedRateInputs(); { const pp = num($('[data-p=partsPrice]').value); if (pp != null) setSet('partsPrice', pp); } closeSheet(); render(); toast('Prices saved ✓'); break;
    case 'addBreed': {
      const keep = $('#onbForm') ? readBreedPrices('op') : $('#priceForm') ? readBreedPrices('bp') : $('#v-settings').contains(b) ? readBreedPrices('sp') : null;
      if (keep) saveBreeds(keep);
      const from = $('#lotForm') ? 'lot' : $('#onbForm') ? 'onb' : $('#priceForm') ? 'price' : 'settings';
      if (from === 'lot') { $$('#lotForm [data-lf]').forEach(el => { lotDraft[el.dataset.lf] = el.value; }); readLotMix(); }
      ask({ title: 'New chicken type', sub: 'For example Kadaknath, Australorp, Sonali', input: { text: true, placeholder: 'Name' },
        onAnswer: name => {
          const nb = addBreed(name);
          if (!nb) toast('That type already exists'); else toast(`Added ${nb.name} ✓ — set its prices`);
          if (from === 'lot') openLotForm(lotDraft);
          else if (from === 'onb') onboarding();
          else if (from === 'price') openPriceSheet();
          else renderSettings();
        } });
      break;
    }
    case 'lotBreedPick': $$('#lotForm [data-lf]').forEach(el => { lotDraft[el.dataset.lf] = el.value; }); lotDraft.breed = v; $$('[data-act=lotBreedPick]').forEach(c => c.classList.toggle('on', c.dataset.v === v)); break;
    case 'evGrade': readEventForm(); eventDraft.grade = v; renderEventForm(); break;
    case 'evBreed': readEventForm(); eventDraft.breed = v; renderEventForm(); break;
    case 'bsQuick': bsQuick(b.dataset.key, Number(b.dataset.days)); break;
    case 'syncNow': syncNow(true); setTimeout(() => view === 'settings' && renderSettings(), 300); break;
    case 'syncHelp': openSyncSetup(); break;
    case 'syncHelpFromOnb': { const nm = $('#onbForm [data-o=deviceName]').value.trim(); if (nm) db.meta.deviceName = nm; persist(); closeSheet(); go('settings'); openSyncSetup(); break; }
    case 'saveOnb': {
      const f = {}; $$('#onbForm [data-o]').forEach(el => { f[el.dataset.o] = el.value; });
      if (f.deviceName.trim()) db.meta.deviceName = f.deviceName.trim();
      if (f.userName && f.userName.trim()) db.meta.userName = f.userName.trim();
      saveBreeds(readBreedPrices('op'));
      persist(); render(); openLotForm(); break;
    }
    case 'newLot': openLotForm(); break;
    case 'editLot': openLotForm(Object.assign({}, lotById(id))); break;
    case 'saveLot': saveLotForm(); break;
    case 'deleteLot': deleteLot(id); break;
    case 'openArchive': openArchive(); break;
    case 'lotHist': openLot(id, v); break;
    case 'lotEntries': openLotEntries(id, v); break;
    case 'deleteEntry': deleteRec(id, () => openLotEntries(b.dataset.lot, v)); break;
    case 'toggleLot': toggleLot(id); renderView(view); break;
    case 'foldAll': db.meta.unfolded = openLotIds().some(x => activeLots().some(l => l.id === x)) ? [] : activeLots().slice(0, MAX_OPEN_LOTS).map(l => l.id); persist(); renderView(view); break;
    case 'dayDetail': case 'dayShift': openDay(b.dataset.d, id || null); break;
    case 'shopDay': openShopDay(b.dataset.d); break;
    case 'editShopFromDay': closeSheet(); shopDraft = Object.assign({}, db.records[id]); go('shop'); setTimeout(() => window.scrollTo(0, $('#shopForm').offsetTop - 70), 50); break;
    case 'restoreLot': { const l = db.records[id]; unarchiveLot(id); render(); openArchive(); toast(`Lot ${l.name} restored ✓`); break; }
    case 'openLot': openLot(id); break;
    case 'closeLot': closeLotFlow(id); break;
    case 'reopenLot': { const l = lotById(id); const c = Object.assign({}, l, { closed: false }); delete c.closedDate; put(c); render(); openLot(id); toast(`Lot ${l.name} reopened`); break; }
    case 'countCheck': startCountCheck(id, false); break;
    case 'sellLot': sellDraft = newSellDraft({ lotId: id, type: sellDraft && sellDraft.type }); closeSheet(); go('sell'); break;
    case 'goSellNew': sellDraft = newSellDraft(sellDraft && !sellDraft.id ? sellDraft : null); go('sell'); break;
    case 'sellType': sellDraft.type = v; sellAutoBirds(sellDraft); renderSell(); break;
    case 'sellLotPick': sellDraft.lotId = id; sellDraft.breed = null; sellAutoBirds(sellDraft); renderSell(); break;
    case 'sellGrade': sellDraft.grade = v; sellDraft.rate = ''; renderSell(); break;
    case 'sellBreed': sellDraft.breed = v; sellAutoBirds(sellDraft); renderSell(); break;
    case 'sellBirdsStep': sellDraft.birds = Math.max(0, (num(sellDraft.birds) || 0) + Number(b.dataset.d)); sellDraft.birdsManual = true; renderSell(); break;
    case 'sellBirdsSet': sellDraft.birds = Number(b.dataset.n); sellDraft.birdsManual = true; renderSell(); break;
    case 'saleBirds': if (curSaleCtx && pendingAsk) { const sl = curSaleCtx.sale; sl.birds = Math.max(0, (Number(sl.birds) || 0) + Number(b.dataset.d)); sl.birdsEst = false; confirmSale(sl, curSaleCtx.told, curSaleCtx.v, true); } break;
    case 'saleBirdsSet': if (curSaleCtx && pendingAsk) { const sl = curSaleCtx.sale; sl.birds = Number(b.dataset.n); sl.birdsEst = false; confirmSale(sl, curSaleCtx.told, curSaleCtx.v, true); } break;
    case 'saveSale': saveSaleForm(); break;
    case 'cancelEditSale': sellDraft = newSellDraft(); go('records'); break;
    case 'addEvent': openEventForm({ lotId: id || (activeLots().length === 1 ? activeLots()[0].id : ''), type: b.dataset.type || 'dead' }); break;
    case 'evType': readEventForm(); eventDraft.type = v; eventDraft.unit = PURCHASE_CATS[v] ? PURCHASE_CATS[v].units[0] : 'kg'; renderEventForm(); break;
    case 'evLot': readEventForm(); eventDraft.lotId = id; renderEventForm(); break;
    case 'saveEvent': saveEventForm(); break;
    case 'editRec': editRec(id); break;
    case 'deleteRec': deleteRec(id); break;
    case 'recKind': recFilter.kind = v; recFilter.limit = 150; renderRecords(); break;
    case 'recLot': recFilter.lot = id; recFilter.limit = 150; renderRecords(); break;
    case 'recMore': recFilter.limit += 300; renderRecords(); break;
    case 'showFlagged': recFilter = { kind: 'flag', lot: '', limit: 150 }; go('records'); break;
    case 'openReport': closeSheet(); goReport('profit'); break;
    case 'checkUpdates': checkForUpdates(true); break;
    case 'switchUser': openUserSwitch(false); break;
    case 'pickUser': db.meta.userName = v; persist(true); closeSheet(); render(); toast(`👤 Now entering as ${v}`); break;
    case 'pickUserNew': { const nm = ($('#newUser').value || '').trim(); if (!nm) { toast('Type a name'); return; } db.meta.userName = nm; persist(true); closeSheet(); render(); toast(`👤 Now entering as ${nm}`); break; }
    case 'logUser': recFilter.logUser = v; renderLog(); break;
    case 'recUser': recFilter.user = v; renderRecords(); break;
    case 'installApk': installApkUpdate(); break;
    case 'openStock': closeSheet(); goReport('stock'); break;
    case 'repTab': reportTab = v; renderReports(); break;
    case 'repPeriod': reportPeriod = v; renderReports(); break;
    case 'shareReport': shareText(reportText()); break;
    case 'goBuyNew': buyDraft = null; go('buy'); break;
    case 'buyCat': readBuyForm(); buyDraft.category = v; buyDraft.unit = PURCHASE_CATS[v].units[0]; renderBuy(); break;
    case 'buyGrade': readBuyForm(); buyDraft.grade = v; renderBuy(); break;
    case 'buyLot': readBuyForm(); buyDraft.lotId = buyDraft.lotId === id ? '' : id; renderBuy(); break;
    case 'saveBuy': saveBuyForm(); break;
    case 'saveShop': saveShopForm(); break;
    case 'editShop': shopDraft = Object.assign({}, db.records[id]); renderShop(); window.scrollTo(0, $('#shopForm').offsetTop - 70); break;
    case 'cancelShopEdit': shopDraft = newShopDraft(shopDraft.date); renderShop(); break;
    case 'deleteShop': ask({ title: 'Delete this shop entry?', buttons: [{ label: '🗑 Delete', value: 'yes', cls: 'red' }, { label: 'Keep', value: 'no' }],
      onAnswer: a => { if (a === 'yes') { removeRec(id); shopDraft = newShopDraft(shopDraft.date); renderShop(); toast('Deleted', id, true); } } }); break;
    case 'shopTab': shopTab = v; renderShop(); break;
    case 'shareShop': shareText(shopReportText()); break;
    case 'goShop': goShop(); break;
    case 'shopMic': if (view !== 'shop') go('shop'); listen(); break;
    case 'homeShopSave': saveHomeShop(); break;
    case 'cancelEditBuy': buyDraft = null; go('records'); break;
    case 'askLeft': sayLeft({}, false); break;
    case 'askSummary': saySummary({ period: 'today' }, false); break;
    case 'help': info('Voice commands', helpHtml(), '', false); break;
    case 'voiceSettings': Android.openVoiceSettings(); break;
    case 'setDefType': setSet('defaultType', v); renderSettings(); break;
    case 'exportCsv': exportCsv(v); break;
    case 'exportSync': exportSync(); break;
    case 'importSync': importSync(); break;
    case 'shareSummary': shareSummary(); break;
  }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.f && sellDraft) sellInput(el);
  if (el.dataset.b && buyDraft) buyInput(el);
  if (el.dataset.s && shopDraft) shopInput(el);
  if (el.dataset.lf && lotDraft) {
    lotDraft[el.dataset.lf] = el.value;
    if (el.dataset.lf === 'name') lotDraft.nameManual = true;
    if (el.dataset.lf === 'chicks') updateLotAutoName();
  }
  if (el.dataset.mix && lotDraft) { readLotMix(); updateLotAutoName(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.bsp) { bsDateChanged(el); return; }
  if (el.dataset.f && sellDraft) sellInput(el);
  if (el.dataset.b && buyDraft) buyInput(el);
  if (el.dataset.sp) { saveBreeds(readBreedPrices('sp')); renderHeader(); toast('Price saved ✓'); }
  if (el.dataset.fr && !$('#priceForm')) { saveFeedRateInputs(); toast('Grain rate saved ✓'); if (view === 'settings') renderSettings(); }
  if (el.dataset.growth) { const x = num(el.value); if (x > 0) { const g = growth(); g[el.dataset.growth] = x; setSet('growth', g); toast('Weight guide saved ✓'); } }
  if (el.dataset.set) {
    const x = num(el.value);
    if (x != null && x !== Number(getSet(el.dataset.set))) { setSet(el.dataset.set, x); renderHeader(); toast('Saved ✓'); }
  }
  if (el.dataset.meta) {
    const k = el.dataset.meta;
    db.meta[k] = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (k === 'syncUrl' || k === 'syncKey') { db.meta.lastRev = 0; db.meta.syncError = ''; Object.values(db.records).forEach(r => { db.meta.pending[r.id] = 1; }); }
    if (k === 'deviceName' && !db.meta.deviceName) db.meta.deviceName = 'Phone';
    persist(); renderHeader();
    if (k === 'syncUrl' && db.meta.syncUrl) syncNow(true);
  }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.dataset.form === 'homeShop') { saveHomeShop(); return; }
  if (e.target.dataset.form === 'cmd') {
    const inp = $('#cmdInput'), t = inp.value.trim();
    if (!t) return;
    inp.value = ''; inp.blur();
    handleInput([t], 'text');
  }
});
$('#sheet').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'askInput') { e.preventDefault(); $('[data-act=askInputOk]').click(); } });

// ---------- Android lifecycle ----------
window.onBack = function () {
  if (listening) { cancelListening(); return true; }
  if (sheetOpen()) { closeSheet(); return true; }
  if (view !== 'home') { go('home'); return true; }
  return false;
};
window.onAppPause = () => { persist(true); stopSpeaking(); };
let lastDay = today();
window.onAppResume = () => {
  if (today() !== lastDay) { lastDay = today(); render(); }
  scheduleSync(300);
  if (!db.meta.lastUpdateCheck || Date.now() - db.meta.lastUpdateCheck > 3 * 3600 * 1000) checkForUpdates(false);
};

// ---------- start ----------
loadDb();
go('home');
renderHeader();
if (!Object.keys(db.records).length) onboarding();
else if (!db.meta.userName) setTimeout(() => openUserSwitch(true), 600);
if (db.meta.syncUrl) scheduleSync(800);
startUpdater();
setInterval(() => { if (db.meta.syncUrl && !document.hidden) syncNow(false); }, 120000);
setInterval(() => { if (today() !== lastDay) { lastDay = today(); render(); } }, 60000);
