/* Gram Hisab — data, stats and sync */
'use strict';

const HAS_ANDROID = typeof window.Android !== 'undefined';
const APP_VERSION = '2.6.1';

// ---------- small utils ----------
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = (n, d = 2) => { const f = Math.pow(10, d); return Math.round((Number(n) || 0) * f) / f; };
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : null; };

function iso(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
function today() { return iso(new Date()); }
function addDays(isoStr, n) { const d = new Date(isoStr + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Dates are stored in AD (YYYY-MM-DD) and always shown in Nepali BS.
function fmtDate(s, long) {
  if (!s) return '';
  const t = today();
  const b = adToBs(s), tb = adToBs(t);
  if (!b) return s;
  const base = BS_MONTHS[b.m - 1] + ' ' + b.d + ((long || !tb || b.y !== tb.y) ? ', ' + b.y : '');
  if (s === t) return long ? 'Today · ' + base : 'Today';
  if (s === addDays(t, -1)) return long ? 'Yesterday · ' + base : 'Yesterday';
  return base;
}
function bsMonthStart(adIsoStr) { const b = adToBs(adIsoStr); return bsToAd(b.y, b.m, 1); }
const NF = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
function money(n) { n = Number(n) || 0; return 'Rs ' + (Math.abs(n) >= 1000 ? NF0 : NF).format(round(n, 2)); }
function kgs(n) { return NF.format(round(n, 2)) + ' kg'; }
function nfmt(n) { return NF.format(round(n, 2)); }
function sayMoney(n) { return NF0.format(round(n, 0)) + ' rupees'; }
function sayKg(n) { n = round(n, 2); return (n === 1 ? '1 kilo' : n + ' kilo'); }

function rid() {
  const dev = (db && db.meta && db.meta.deviceId) || 'x';
  return dev.slice(0, 4) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---------- storage ----------
let db = null;
const DB_FILE = 'chickenkhata.json';

function loadDb() {
  let raw = null;
  try { raw = HAS_ANDROID ? Android.load(DB_FILE) : localStorage.getItem(DB_FILE); } catch (e) { raw = null; }
  try { db = raw ? JSON.parse(raw) : null; } catch (e) { db = null; }
  if (!db || !db.records) db = { v: 1, meta: {}, records: {} };
  const m = db.meta;
  if (!m.deviceId) m.deviceId = Math.random().toString(36).slice(2, 8);
  if (!m.deviceName) {
    let n = 'Phone';
    try { if (HAS_ANDROID) n = Android.deviceName() || n; } catch (e) {}
    m.deviceName = n;
  }
  const defaults = { voiceLang: 'en-IN', speakOn: true, autoListen: true, confirmVoice: true, syncUrl: '', syncKey: '', lastRev: 0, pending: {}, lastSync: 0, syncError: '' };
  for (const k in defaults) if (m[k] === undefined) m[k] = defaults[k];
  refreshArchived();
}

let saveTimer = null;
function persist(now) {
  clearTimeout(saveTimer);
  const doSave = () => {
    const txt = JSON.stringify(db);
    try { if (HAS_ANDROID) Android.save(DB_FILE, txt); else localStorage.setItem(DB_FILE, txt); } catch (e) { console.error(e); }
  };
  if (now) doSave(); else saveTimer = setTimeout(doSave, 120);
}

// Who is entering data on this phone (each entry remembers its user and time).
function currentUser() { return String(db.meta.userName || db.meta.deviceName || 'User').trim(); }
function knownUsers() {
  const set = {};
  set[currentUser()] = 1;
  for (const id in db.records) { const r = db.records[id]; if (r.by) set[r.by] = 1; if (r.editedBy) set[r.editedBy] = 1; }
  return Object.keys(set).sort();
}
function fmtTime(ts) { if (!ts) return ''; const d = new Date(ts); let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap; }
function fmtStamp(ts) { return ts ? fmtDate(iso(new Date(ts))) + ' ' + fmtTime(ts) : ''; }

function put(rec) {
  const prev = rec.id ? db.records[rec.id] : null;
  if (!rec.id) rec.id = rid();
  const now = Date.now();
  rec.updatedAt = Math.max(now, prev ? (prev.updatedAt || 0) + 1 : 0);
  if (!rec.createdAt) rec.createdAt = prev && prev.createdAt ? prev.createdAt : now;
  rec.device = db.meta.deviceName;
  if (prev) { rec.by = prev.by || rec.by || prev.device || currentUser(); rec.editedBy = currentUser(); rec.editedAt = now; }
  else rec.by = rec.by || currentUser();
  if (rec.date) rec.bs = bsIso(rec.date);
  if (rec.kind === 'lot' && rec.startDate) rec.startBs = bsIso(rec.startDate);
  db.records[rec.id] = rec;
  db.meta.pending[rec.id] = 1;
  if (rec.kind !== 'audit') logChange(prev, rec, now);
  if (rec.kind === 'lot') refreshArchived();
  persist();
  scheduleSync();
  return rec;
}

// ---------- change log ----------
const AUDIT_SKIP = ['id', 'kind', 'updatedAt', 'createdAt', 'device', 'bs', 'startBs', 'by', 'editedBy', 'editedAt', 'heard', 'kgEst', 'birdsEst', 'qtyEst', 'cutKg', 'seq', 'areaInput'];
const FIELD_LABEL = { kg: 'kg', amount: 'amount', rate: 'rate', birds: 'birds', date: 'date', lotId: 'lot', type: 'type', breed: 'chicken type', count: 'birds', qty: 'quantity',
  unit: 'unit', grade: 'grain size', item: 'name', invoice: 'invoice', flag: 'flag', note: 'note', cash: 'cash', qr: 'QR', goods: 'goods', chicks: 'chicks', chickCost: 'chick cost',
  name: 'name', startDate: 'start date', khetiId: 'kheti', fieldId: 'field', workerId: 'worker', workType: 'work', workers: 'khetala', extraFull: 'other full', extraHalf: 'other half', rateFull: 'full rate', rateHalf: 'half rate', parma: 'parma', hours: 'hours', ratePerHour: 'rate/hour', hireAmount: 'hire', fuel: 'fuel', litres: 'litres', fuelCost: 'fuel cost', cost: 'cost', crop: 'crop', crops: 'crops', areaM2: 'area', plantDate: 'planted', season: 'season', status: 'status', family: 'family', phone: 'phone', full: 'full days', half: 'half days', mix: 'chicks by type', supplier: 'supplier', category: 'category', closed: 'closed', value: 'value', customer: 'customer' };
function recSummary(r) {
  try {
    const ks = typeof khetiRecSummary === 'function' ? khetiRecSummary(r) : null;
    if (ks) return ks;
    if (r.kind === 'sale') return `${kgs(r.kg)} ${SALE_LABEL[r.type] || r.type} · ${money(r.amount)} · ${lotName(r.lotId)}`;
    if (r.kind === 'event') return `${lotName(r.lotId)}: ${eventTitle(r)}`;
    if (r.kind === 'purchase') return `Bought ${purchaseTitle(r)} · ${money(r.amount)}`;
    if (r.kind === 'grainsale') return `Sold grain ${r.grade} ${nfmt(r.qty)} ${r.unit === 'kg' ? 'kg' : 'bora'} · ${money(r.amount)}`;
    if (r.kind === 'shop') return `Shop cash ${money(r.cash)} · QR ${money(r.qr)} · goods ${money(r.goods)}`;
    if (r.kind === 'lot') return `Lot ${r.name}`;
    if (r.kind === 'setting') return `Setting: ${r.key}`;
    if (r.kind === 'calnote') return `Calendar ${r.holiday ? 'holiday' : 'note'}: ${r.text}`;
  } catch (e) {}
  return r.kind;
}
function fmtField(k, v) {
  if (v == null || v === '') return '—';
  if (k === 'date' || k === 'startDate') return fmtDate(v, true);
  if (k === 'lotId') return lotName(v);
  if (k === 'khetiId' && typeof khetiById === 'function') return khetiTitle(khetiById(v)) || v;
  if (k === 'fieldId' && typeof fieldById === 'function') return (fieldById(v) || {}).name || v;
  if (k === 'workerId' && typeof workerById === 'function') return workerLabel(workerById(v));
  if (k === 'workType' && typeof workById === 'function') return workById(v).ne;
  if (k === 'crop' && typeof cropById === 'function') return cropById(v).ne;
  if (k === 'areaM2' && typeof fmtArea === 'function') return fmtArea(v, landSystem(), 'ne');
  if (k === 'workers' && Array.isArray(v) && typeof workerById === 'function') return v.map(w => (workerById(w.workerId) || {}).name + (w.shift === 'half' ? ' ½' : '')).join(', ') || '—';
  if (k === 'crops' && Array.isArray(v) && typeof cropById === 'function') return v.map(c => cropById(c.crop).ne + (c.role === 'aali' ? ' (आली)' : '')).join(', ');
  if (k === 'breed') return breedName(v);
  if (k === 'mix' && Array.isArray(v)) return v.map(m => breedName(m.breed) + ' ' + m.chicks).join(' + ');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return nfmt(v);
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return String(v).slice(0, 60);
}
function logChange(prev, rec, now) {
  let action = 'create', changes = null;
  if (prev) {
    if (rec.deleted && !prev.deleted) action = 'delete';
    else if (!rec.deleted && prev.deleted) action = 'restore';
    else if (rec.archived && !prev.archived) action = 'archive';
    else if (!rec.archived && prev.archived) action = 'unarchive';
    else action = 'edit';
    changes = {};
    new Set(Object.keys(prev).concat(Object.keys(rec))).forEach(k => {
      if (AUDIT_SKIP.includes(k) || k === 'deleted' || k === 'archived' || k === 'archivedAt') return;
      const blank = v => v === undefined || v === null || v === '' || v === false;
      const a = blank(prev[k]) ? null : prev[k], b = blank(rec[k]) ? null : rec[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) changes[k] = [a, b];
    });
    if (action === 'edit' && !Object.keys(changes).length) return;
  }
  const a = { id: rid(), kind: 'audit', refId: rec.id, refKind: rec.kind, action, changes, summary: recSummary(rec), at: now,
    by: currentUser(), device: db.meta.deviceName, createdAt: now, updatedAt: now };
  db.records[a.id] = a;
  db.meta.pending[a.id] = 1;
}
function auditsFor(id) { return Object.values(db.records).filter(r => r.kind === 'audit' && r.refId === id).sort((a, b) => b.at - a.at); }
function removeRec(id) {
  const r = db.records[id];
  if (!r) return;
  put(Object.assign({}, r, { deleted: true }));
}
function restoreRec(id) {
  const r = db.records[id];
  if (!r) return;
  const c = Object.assign({}, r); delete c.deleted; put(c);
}
// Archived lots (and every entry of an archived lot) are hidden everywhere until restored.
let archivedIds = new Set();
function refreshArchived() {
  archivedIds = new Set();
  for (const id in db.records) { const r = db.records[id]; if (r.kind === 'lot' && !r.deleted && r.archived) archivedIds.add(id); }
}
function hidden(r) { return !r || r.deleted || archivedIds.has(r.id) || (r.lotId && archivedIds.has(r.lotId)); }
function archivedLots() {
  return Object.values(db.records).filter(r => r.kind === 'lot' && !r.deleted && r.archived).sort((a, b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')));
}
function archiveLot(id) { const l = db.records[id]; if (l) put(Object.assign({}, l, { archived: true, archivedAt: today() })); }
function unarchiveLot(id) { const l = db.records[id]; if (l) { const c = Object.assign({}, l); delete c.archived; delete c.archivedAt; put(c); } }

function all(kind) {
  const out = [];
  for (const id in db.records) { const r = db.records[id]; if (!hidden(r) && r.kind === kind) out.push(r); }
  return out;
}

// synced settings
const SET_DEFAULTS = { livePrice: 0, meatPrice: 0, defaultType: 'meat', lowStock: 20, checkDays: 7, bagKg: 50, dressPct: 70, partsPrice: 150 };
function getSet(key) {
  const r = db.records['set:' + key];
  return r && !r.deleted && r.value !== undefined && r.value !== null ? r.value : SET_DEFAULTS[key];
}
function setSet(key, value) { put({ id: 'set:' + key, kind: 'setting', key, value }); }

// ---------- chicken types (breeds) and their prices ----------
const DEFAULT_BREEDS = [
  { id: 'broiler', name: 'Broiler', live: 0, meat: 0 },
  { id: 'local', name: 'Local', live: 0, meat: 0 },
  { id: 'giriraj', name: 'Giriraj', live: 0, meat: 0 }
];
function breeds() {
  const r = db.records['set:breeds'];
  if (r && !r.deleted && Array.isArray(r.value) && r.value.length) return r.value;
  // first run (or data from v1.0): start from defaults, carry old single prices over to Broiler
  const list = DEFAULT_BREEDS.map(b => Object.assign({}, b));
  list[0].live = Number(getSet('livePrice')) || 0;
  list[0].meat = Number(getSet('meatPrice')) || 0;
  return list;
}
function breedById(id) { const l = breeds(); return l.find(b => b.id === id) || l[0]; }
function breedName(id) { return breedById(id).name; }
function priceFor(type, breedId) {
  if (type === 'parts') return Number(getSet('partsPrice')) || 0; // khutta-tauko (feet & head), one rate for all types
  const b = breedById(breedId || 'broiler'); return Number(type === 'live' ? b.live : b.meat) || 0;
}
const SALE_LABEL = { live: 'live', meat: 'meat', parts: 'khutta-tauko' };
function saveBreeds(list) { setSet('breeds', list.map(b => ({ id: b.id, name: b.name, live: Number(b.live) || 0, meat: Number(b.meat) || 0 }))); }
function setBreedPrice(breedId, type, value) {
  const list = breeds().map(b => Object.assign({}, b));
  const b = list.find(x => x.id === breedId) || list[0];
  b[type === 'live' ? 'live' : 'meat'] = round(value);
  saveBreeds(list);
}
function addBreed(name) {
  name = String(name || '').trim();
  if (!name) return null;
  const list = breeds().map(b => Object.assign({}, b));
  if (list.some(b => b.name.toLowerCase() === name.toLowerCase())) return null;
  const b = { id: normName(name) || rid(), name: name.charAt(0).toUpperCase() + name.slice(1), live: 0, meat: 0 };
  list.push(b); saveBreeds(list);
  return b;
}

// ---------- lots ----------
// Lot names follow the Nepali date the chicks arrived: Ashar83_10_1_100 = Ashar 2083, day 10, 1st lot that month, 100 chicks.
function lots() {
  return all('lot').sort((a, b) => (a.closed - b.closed) || String(a.startDate).localeCompare(String(b.startDate)) || String(a.name).localeCompare(String(b.name)));
}
function activeLots() { return lots().filter(l => !l.closed); }
function lotById(id) { const r = db.records[id]; return r && !r.deleted && r.kind === 'lot' ? r : null; }
function lotName(id) { const l = lotById(id); return l ? l.name : '—'; }
const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]/g, '');
function lotByName(name) { const n = normName(name); return lots().find(l => normName(l.name) === n) || null; }
function lotBs(l) { return adToBs(l.startDate) || { y: 0, m: 1, d: 1 }; }
function lotSeq(l) { if (l.seq) return Number(l.seq); const m = /_(\d+)_\d+$/.exec(l.name || ''); return m ? +m[1] : 0; }
function lotAutoName(startDate, seq, chicks) {
  const b = adToBs(startDate) || { y: 0, m: 1, d: 1 };
  return BS_MONTHS[b.m - 1] + pad2(b.y % 100) + '_' + b.d + '_' + seq + '_' + (Math.round(chicks) || 0);
}
function nextLotSeq(startDate, excludeId) {
  const b = adToBs(startDate);
  let max = 0;
  lots().forEach(l => { if (l.id === excludeId) return; const lb = lotBs(l); if (b && lb.y === b.y && lb.m === b.m) max = Math.max(max, lotSeq(l)); });
  return max + 1;
}
function lotVoiceNo(l) { const i = activeLots().findIndex(x => x.id === l.id); return i < 0 ? null : i + 1; }
function lotSpeak(l) { // how the app says a lot name out loud
  if (!l) return 'the lot';
  const s = lotSeq(l);
  return s ? `${BS_MONTHS[lotBs(l).m - 1]} lot ${s}` : String(l.name).replace(/_/g, ' ');
}
function lotColor(lot) { const i = lots().findIndex(x => x.id === lot.id); return 'c' + ((i < 0 ? 0 : i + 1) % 5); }

const FEED_GRADES = ['B0', 'B1', 'B2', 'B3'];

const EVENT_TYPES = {
  dead: { label: 'Dead', icon: '💀', count: true },
  restock: { label: 'Chicks added', icon: '🐣', count: true, amount: true },
  cut: { label: 'Cut (meat)', icon: '🔪', count: true, qty: true },
  feed: { label: 'Feed', icon: '🌾', qty: true, amount: true, grade: true },
  medicine: { label: 'Medicine', icon: '💊', item: true, qty: true, amount: true },
  vitamin: { label: 'Vitamin', icon: '🧪', item: true, qty: true, amount: true },
  vaccine: { label: 'Vaccine', icon: '💉', item: true, qty: true, amount: true },
  weight: { label: 'Weight', icon: '⚖️', qty: true },
  expense: { label: 'Expense', icon: '🧾', amount: true },
  note: { label: 'Note', icon: '📝' },
  check: { label: 'Count check', icon: '🔢', count: true },
  soldfix: { label: 'Sold (not recorded)', icon: '🐔', count: true },
  adjust: { label: 'Count adjust', icon: '±', count: true }
};
const USER_EVENT_TYPES = ['dead', 'restock', 'cut', 'feed', 'medicine', 'vitamin', 'vaccine', 'weight', 'expense', 'note'];
const USAGE_TYPES = ['feed', 'medicine', 'vitamin', 'vaccine'];

// ---------- purchases & stock ----------
const PURCHASE_CATS = {
  feed: { label: 'Feed / grain', icon: '🌾', units: ['bags', 'kg'] },
  medicine: { label: 'Medicine', icon: '💊', units: ['bottle', 'packet', 'pcs', 'kg', 'g', 'litre', 'ml', 'dose'] },
  vitamin: { label: 'Vitamin', icon: '🧪', units: ['packet', 'bottle', 'kg', 'g', 'litre', 'ml', 'pcs'] },
  vaccine: { label: 'Vaccine', icon: '💉', units: ['vial', 'dose', 'bottle', 'pcs'] },
  equipment: { label: 'Equipment', icon: '🧰', units: ['pcs'] },
  other: { label: 'Other', icon: '🧾', units: ['pcs', 'kg', 'bags'] }
};
const STOCK_CATS = ['feed', 'medicine', 'vitamin', 'vaccine'];
function bagKg() { return Number(getSet('bagKg')) || 50; }
// Grain rates per bora (bag), for buying and selling each size
function feedRates() {
  const r = getSet('feedRates'), out = {};
  FEED_GRADES.forEach(g => { const x = r && r[g] ? r[g] : {}; out[g] = { buy: Number(x.buy) || 0, sell: Number(x.sell) || 0 }; });
  return out;
}
function setFeedRate(grade, kind, perBag) {
  const r = feedRates();
  if (!r[grade]) return;
  r[grade][kind] = round(perBag);
  setSet('feedRates', r);
}
// rate for one unit (bags or kg) from the per-bora rate
function feedRateFor(grade, kind, unit) {
  const r = feedRates()[grade];
  if (!r || !r[kind]) return 0;
  return unit === 'kg' ? round(r[kind] / bagKg(), 2) : r[kind];
}
function perBag(rate, unit) { return unit === 'kg' ? rate * bagKg() : rate; }
// Feed is tracked in kg per grain size; other items per name + unit.
function stockKey(cat, r) {
  if (cat === 'feed') return 'feed|' + (r.grade || 'Other');
  return cat + '|' + String(r.item || '').trim().toLowerCase() + '|' + (r.unit || '');
}
function stockQty(cat, r) {
  const q = Number(r.qty) || 0;
  return cat === 'feed' && (r.unit || 'bags') !== 'kg' ? q * bagKg() : q;
}
function stockLabel(cat, r) {
  if (cat === 'feed') return 'Feed ' + (r.grade || '(no size)');
  return (r.item ? r.item.charAt(0).toUpperCase() + r.item.slice(1) : PURCHASE_CATS[cat].label) + (r.unit ? ' (' + r.unit + ')' : '');
}
// Stock left = bought (not charged to a lot) − used (process entries).
function computeInventory() {
  const inv = {};
  const get = (cat, r) => {
    const k = stockKey(cat, r);
    if (!inv[k]) inv[k] = { key: k, cat, grade: r.grade || '', item: r.item || '', unit: cat === 'feed' ? 'kg' : (r.unit || ''), label: stockLabel(cat, r), bought: 0, used: 0, cost: 0, boughtAll: 0, costAll: 0 };
    return inv[k];
  };
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r)) continue;
    if (r.kind === 'purchase' && STOCK_CATS.includes(r.category)) {
      const it = get(r.category, r), q = stockQty(r.category, r);
      it.boughtAll += q; it.costAll += Number(r.amount) || 0;
      if (!r.lotId) { it.bought += q; it.cost += Number(r.amount) || 0; }
    }
  }
  for (const id in db.records) {
    const r = db.records[id];
    if (!hidden(r) && r.kind === 'grainsale' && r.qty) { get('feed', r).used += stockQty('feed', r); continue; }
    if (hidden(r) || r.kind !== 'event' || !USAGE_TYPES.includes(r.type) || !r.qty) continue;
    if (r.amount != null && r.amount !== '' && !inv[stockKey(r.type, r)]) continue; // bought outside the app, cost entered directly
    get(r.type, r).used += stockQty(r.type, r);
  }
  const feedAll = Object.values(inv).filter(i => i.cat === 'feed');
  const feedAvg = feedAll.reduce((a, i) => a + i.costAll, 0) / (feedAll.reduce((a, i) => a + i.boughtAll, 0) || 1);
  Object.values(inv).forEach(i => {
    i.left = round(i.bought - i.used, 3);
    i.avg = i.boughtAll ? i.costAll / i.boughtAll : (i.cat === 'feed' ? feedAvg : 0);
    i.value = Math.max(0, i.left) * i.avg;
  });
  inv._feedAvg = feedAvg;
  return inv;
}
// Cost of a process entry: the cost typed on it, else quantity × average purchase price.
function usageCost(r, inv) {
  if (r.amount != null && r.amount !== '' && !isNaN(Number(r.amount))) return Number(r.amount) || 0;
  if (!USAGE_TYPES.includes(r.type) || !r.qty) return 0;
  const i = inv[stockKey(r.type, r)];
  const avg = i ? i.avg : (r.type === 'feed' ? inv._feedAvg : 0);
  return stockQty(r.type, r) * (avg || 0);
}
function fmtStockQty(i, q) {
  q = q == null ? i.left : q;
  if (i.cat === 'feed') return nfmt(q) + ' kg' + (bagKg() ? ' (' + nfmt(round(q / bagKg(), 1)) + ' bora)' : '');
  return nfmt(q) + ' ' + (i.unit || '');
}
function purchaseTitle(r) {
  const c = PURCHASE_CATS[r.category] || PURCHASE_CATS.other;
  const what = r.category === 'feed' ? 'Feed ' + (r.grade || '') : (r.item || c.label);
  return what + (r.qty ? ' · ' + nfmt(r.qty) + ' ' + (r.unit === 'bags' ? 'bora' : r.unit || '') : '');
}

function eventTitle(e) {
  const t = EVENT_TYPES[e.type] || { label: e.type };
  switch (e.type) {
    case 'dead': return (e.count || 0) + ' dead';
    case 'restock': return 'Added ' + (e.count || 0) + ' chicks';
    case 'cut': return 'Cut ' + (e.count || 0) + ' birds' + (e.qty ? ' → ' + kgs(e.qty) + ' meat' : '');
    case 'feed': return 'Feed' + (e.grade ? ' ' + e.grade : '') + (e.qty ? ' · ' + nfmt(e.qty) + ' ' + ((e.unit || 'bags') === 'bags' ? 'bora' : e.unit) : '');
    case 'weight': return 'Avg weight ' + (e.qty ? kgs(e.qty) : '');
    case 'check': return 'Counted ' + (e.count || 0) + ' birds';
    case 'soldfix': return (e.count || 0) + ' sold (not recorded)';
    case 'adjust': return 'Count ' + (e.count > 0 ? '+' : '') + (e.count || 0);
    default: return t.label;
  }
}

// ---------- stats ----------
// ---------- chicken types inside a lot ----------
// lot.mix = [{breed, chicks}] (older lots: one breed from lot.breed)
function lotMix(l) {
  if (l && Array.isArray(l.mix) && l.mix.length) return l.mix.filter(m => Number(m.chicks) > 0 || m.added || l.mix.length === 1);
  return [{ breed: (l && l.breed) || 'broiler', chicks: Number(l && l.chicks) || 0 }];
}
function lotBreeds(l) { return lotMix(l).map(m => m.breed); }
function recBreed(r, l) { const bs = lotBreeds(l); return r.breed && bs.includes(r.breed) ? r.breed : bs[0]; }
function mixLabel(l) { const m = lotMix(l); return m.length === 1 ? breedName(m[0].breed) : m.map(x => breedName(x.breed) + ' ' + x.chicks).join(' + '); }

// ---------- weight estimate (kg per live bird) ----------
// Default growth guide: ~day 30 → 2–2.5 kg, ~day 45 → 3–4 kg, later 4–6 kg. Editable in Settings.
const GROWTH_DEFAULT = { d30: 2.25, d45: 3.5, d60: 5, max: 6 };
function growth() { const g = getSet('growth'); return Object.assign({}, GROWTH_DEFAULT, g && typeof g === 'object' ? g : {}); }
function curveKg(age) {
  const g = growth();
  const pts = [[0, 0.045], [7, 0.18], [14, 0.48], [21, 1.0], [30, g.d30], [45, g.d45], [60, g.d60], [80, g.max]];
  if (age <= 0) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (age <= pts[i][0]) { const [a0, w0] = pts[i - 1], [a1, w1] = pts[i]; return w0 + (w1 - w0) * (age - a0) / (a1 - a0); }
  }
  return g.max;
}
// average age of a type's birds in a lot, counting chicks added later as younger
function batchAge(l, breed, date) {
  const m = lotMix(l).find(x => x.breed === breed);
  let n = m ? Number(m.chicks) || 0 : 0, sum = n * Math.max(0, daysBetween(l.startDate, date));
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r) || r.kind !== 'event' || r.type !== 'restock' || r.lotId !== l.id || !r.date || r.date > date || recBreed(r, l) !== breed) continue;
    const c = Number(r.count) || 0; n += c; sum += c * Math.max(0, daysBetween(r.date, date));
  }
  return n ? Math.round(sum / n) : Math.max(0, daysBetween(l.startDate, date));
}
function dressYield() { return (Number(getSet('dressPct')) || 70) / 100; }
// Uses (1) a recent weigh-in, (2) recent live sales of this lot & type, else (3) the age curve.
function estBirdKg(l, breed, date, excludeId) {
  date = date || today();
  const age = batchAge(l, breed, date);
  const curve = curveKg(age);
  const grow = d => curve / Math.max(0.05, curveKg(Math.max(0, batchAge(l, breed, d))));
  let bestW = null;
  const sales = [];
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r) || r.lotId !== l.id || id === excludeId || !r.date || r.date > date || daysBetween(r.date, date) > 10) continue;
    if (r.kind === 'event' && r.type === 'weight' && r.qty && (!r.breed || recBreed(r, l) === breed)) { if (!bestW || r.date > bestW.date) bestW = r; }
    if (r.kind === 'sale' && r.type === 'live' && Number(r.birds) > 0 && Number(r.kg) > 0 && recBreed(r, l) === breed) sales.push(r);
  }
  if (bestW) return { kg: round(Number(bestW.qty) * grow(bestW.date), 2), source: 'weigh-in', age };
  if (sales.length) {
    sales.sort((a, b) => b.date.localeCompare(a.date));
    const use = sales.slice(0, 5);
    const avg = use.reduce((a, r) => a + (Number(r.kg) / Number(r.birds)) * grow(r.date), 0) / use.length;
    return { kg: round(avg, 2), source: 'recent sales', age };
  }
  return { kg: round(curve, 2), source: 'age (day ' + age + ')', age };
}
function estLiveBirds(kg, l, breed, date) {
  const e = estBirdKg(l, breed, date);
  return { birds: kg > 0 ? Math.max(1, Math.round(kg / e.kg)) : 0, est: e };
}
function estMeatCut(kg, l, breed, date) {
  const s = lotStats(l.id), b = s && s.byBreed[breed];
  const stock = b ? b.meatStock : 0;
  const e = estBirdKg(l, breed, date);
  const perBird = e.kg * dressYield();
  const need = kg - stock;
  return { birds: need <= 0.05 ? 0 : Math.max(1, Math.ceil(need / perBird)), stock, perBird: round(perBird, 2), est: e };
}

function computeStats() {
  const L = {};
  const blank = () => ({ chicks: 0, restock: 0, adjust: 0, dead: 0, soldBirds: 0, cutBirds: 0, cutKg: 0, liveKg: 0, meatKg: 0, revenue: 0 });
  lots().forEach(l => {
    const byBreed = {};
    lotMix(l).forEach(m => { byBreed[m.breed] = Object.assign(blank(), { chicks: Number(m.chicks) || 0 }); });
    L[l.id] = { lot: l, byBreed, chicks: Number(l.chicks) || 0, adjust: 0, dead: 0, soldBirds: 0, cutBirds: 0, cutKg: 0,
      liveKg: 0, meatKg: 0, partsKg: 0, partsRev: 0, restock: 0, revenue: 0, liveRev: 0, meatRev: 0, expenses: Number(l.chickCost) || 0, feedQty: 0, feedKg: 0,
      costChicks: Number(l.chickCost) || 0, costFeed: 0, costMed: 0, costOther: 0,
      bought: 0, buyCount: 0, sales: 0, salesNoBirds: 0, lastCheck: l.startDate, lastWeight: null, lastWeightDate: '', feedByGrade: {} };
  });
  const inv = computeInventory();
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r)) continue;
    const s = L[r.lotId];
    if (!s) continue;
    const b = s.byBreed[recBreed(r, s.lot)];
    if (r.kind === 'purchase') {
      const a = Number(r.amount) || 0;
      s.expenses += a;
      s.bought += a; s.buyCount++;
      if (r.category === 'feed') {
        s.costFeed += a; s.feedKg += stockQty('feed', r);
        const g = r.grade || 'Other';
        s.feedByGrade[g] = (s.feedByGrade[g] || 0) + stockQty('feed', r);
      }
      else if (['medicine', 'vitamin', 'vaccine'].includes(r.category)) s.costMed += a;
      else s.costOther += a;
    } else if (r.kind === 'sale') {
      const kg = Number(r.kg) || 0, amt = Number(r.amount) || 0, birds = Number(r.birds) || 0;
      s.sales++; s.revenue += amt; b.revenue += amt;
      if (r.type === 'live') { s.liveKg += kg; s.liveRev += amt; b.liveKg += kg; b.soldBirds += birds; if (!birds) s.salesNoBirds++; }
      else if (r.type === 'parts') { s.partsKg += kg; s.partsRev += amt; }
      else {
        s.meatKg += kg; s.meatRev += amt; b.meatKg += kg; b.cutBirds += birds;
        if (birds) b.cutKg += Number(r.cutKg) || birds * curveKg(daysBetween(s.lot.startDate, r.date)) * dressYield();
      }
    } else if (r.kind === 'event') {
      const c = Number(r.count) || 0, a = Number(r.amount) || 0;
      if (r.type === 'dead') b.dead += c;
      else if (r.type === 'restock') { b.restock += c; s.costChicks += a; s.expenses += a; }
      else if (r.type === 'cut') { b.cutBirds += c; b.cutKg += Number(r.qty) || c * curveKg(daysBetween(s.lot.startDate, r.date)) * dressYield(); }
      else if (r.type === 'soldfix') b.soldBirds += c;
      else if (r.type === 'adjust') b.adjust += c;
      else if (r.type === 'check') { if (r.date > s.lastCheck) s.lastCheck = r.date; }
      else if (r.type === 'weight') { if (!s.lastWeightDate || r.date >= s.lastWeightDate) { s.lastWeight = Number(r.qty) || null; s.lastWeightDate = r.date; } }
      if (r.type === 'feed') {
        s.feedQty += Number(r.qty) || 0;
        s.feedKg += stockQty('feed', r);
        const g = r.grade || 'Other';
        s.feedByGrade[g] = (s.feedByGrade[g] || 0) + stockQty('feed', r);
      }
      if (USAGE_TYPES.includes(r.type)) {
        const cst = usageCost(r, inv);
        s.expenses += cst;
        if (r.type === 'feed') s.costFeed += cst; else s.costMed += cst;
      } else if (r.type === 'expense') { s.expenses += a; s.costOther += a; }
    }
  }
  Object.values(L).forEach(s => {
    Object.values(s.byBreed).forEach(b => {
      b.totalIn = b.chicks + b.adjust;
      b.remaining = b.totalIn - b.dead - b.soldBirds - b.cutBirds;
      b.meatStock = round(Math.max(0, b.cutKg - b.meatKg), 2);
      b.totalIn = b.chicks + b.restock + b.adjust;
      b.remaining = b.totalIn - b.dead - b.soldBirds - b.cutBirds;
      ['restock', 'adjust', 'dead', 'soldBirds', 'cutBirds', 'cutKg'].forEach(k => { s[k] += b[k]; });
    });
    s.totalIn = s.chicks + s.restock + s.adjust;
    s.remaining = Object.values(s.byBreed).reduce((a, b) => a + b.remaining, 0);
    s.kg = s.liveKg + s.meatKg;
    s.profit = s.revenue - s.expenses;
    s.birdsOut = s.soldBirds + s.cutBirds;
    s.profitPerBird = s.birdsOut ? s.profit / s.birdsOut : 0;
    s.costPerBird = s.birdsOut ? s.expenses / s.birdsOut : 0;
    s.feedPerKg = s.kg ? s.feedKg / s.kg : 0;
    s.mortality = s.chicks + s.restock ? (s.dead / (s.chicks + s.restock)) * 100 : 0;
    s.age = s.lot.startDate ? daysBetween(s.lot.startDate, s.lot.closed && s.lot.closedDate ? s.lot.closedDate : today()) : 0;
    s.meatStock = Object.values(s.byBreed).reduce((a, b) => a + b.meatStock, 0) || null;
    s.daysSinceCheck = s.lastCheck ? daysBetween(s.lastCheck, today()) : 0;
    s.mixed = Object.keys(s.byBreed).length > 1;
  });
  return L;
}
function lotStats(id) { return computeStats()[id]; }

function periodStats(from, to) {
  const out = { kg: 0, liveKg: 0, meatKg: 0, amount: 0, birds: 0, count: 0, dead: 0, expenses: 0 };
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r) || !r.date || r.date < from || r.date > to) continue;
    if (r.kind === 'sale') {
      out.count++; out.kg += Number(r.kg) || 0; out.amount += Number(r.amount) || 0; out.birds += Number(r.birds) || 0;
      if (r.type === 'live') out.liveKg += Number(r.kg) || 0; else if (r.type === 'parts') out.partsKg = (out.partsKg || 0) + (Number(r.kg) || 0); else out.meatKg += Number(r.kg) || 0;
    } else if (r.kind === 'event') {
      if (r.type === 'dead') out.dead += Number(r.count) || 0;
      if (r.type === 'expense') out.expenses += Number(r.amount) || 0;
    } else if (r.kind === 'purchase') out.expenses += Number(r.amount) || 0;
  }
  return out;
}

// Money in and out for a period (cash view), used by the Profit report.
function farmReport(from, to) {
  const inv = computeInventory();
  const R = { sales: 0, grainRev: 0, grainKg: 0, liveKg: 0, meatKg: 0, liveRev: 0, meatRev: 0, birdsSold: 0, salesCount: 0, credit: 0,
    chicks: 0, chicksCost: 0, feed: 0, med: 0, equip: 0, other: 0, expenses: 0, payable: 0, dead: 0, feedKgUsed: 0, feedKgBought: 0 };
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r)) continue;
    if (r.kind === 'lot') {
      if (r.startDate >= from && r.startDate <= to) { R.chicks += Number(r.chicks) || 0; R.chicksCost += Number(r.chickCost) || 0; }
      continue;
    }
    if (!r.date || r.date < from || r.date > to) continue;
    const amt = Number(r.amount) || 0;
    if (r.kind === 'sale') {
      R.sales += amt; R.salesCount++; R.birdsSold += Number(r.birds) || 0;
      if (r.type === 'live') { R.liveKg += Number(r.kg) || 0; R.liveRev += amt; } else if (r.type === 'parts') { R.partsKg = (R.partsKg || 0) + (Number(r.kg) || 0); R.partsRev = (R.partsRev || 0) + amt; } else { R.meatKg += Number(r.kg) || 0; R.meatRev += amt; }
      if (r.flag) R.credit += amt;
    } else if (r.kind === 'grainsale') {
      R.sales += amt; R.grainRev += amt; R.grainKg += stockQty('feed', r); R.salesCount++;
      if (r.flag) R.credit += amt;
    } else if (r.kind === 'purchase') {
      if (r.category === 'feed') { R.feed += amt; R.feedKgBought += stockQty('feed', r); }
      else if (['medicine', 'vitamin', 'vaccine'].includes(r.category)) R.med += amt;
      else if (r.category === 'equipment') R.equip += amt;
      else R.other += amt;
      if (r.flag) R.payable += amt;
    } else if (r.kind === 'event') {
      if (r.type === 'dead') R.dead += Number(r.count) || 0;
      else if (r.type === 'restock') { R.chicks += Number(r.count) || 0; R.chicksCost += amt; }
      else if (r.type === 'expense') R.expenses += amt;
      else if (USAGE_TYPES.includes(r.type)) {
        if (r.type === 'feed') R.feedKgUsed += stockQty('feed', r);
        // a cost typed on a usage entry with no matching purchase = bought outside the app
        if (r.amount != null && r.amount !== '' && !(inv[stockKey(r.type, r)] && inv[stockKey(r.type, r)].boughtAll)) {
          if (r.type === 'feed') R.feed += amt; else R.med += amt;
        }
      }
    }
  }
  R.costs = R.chicksCost + R.feed + R.med + R.equip + R.other + R.expenses;
  R.profit = R.sales - R.costs;
  R.stockValue = Object.keys(inv).filter(k => k[0] !== '_').reduce((a, k) => a + inv[k].value, 0);
  return R;
}

function computeFlags() {
  const flags = [];
  const st = computeStats();
  const low = Number(getSet('lowStock')) || 0;
  const checkDays = Number(getSet('checkDays')) || 0;
  const needPrice = {};
  (activeLots().length ? activeLots().map(l => l.breed || 'broiler') : ['broiler']).forEach(b => { if (!priceFor('live', b) && !priceFor('meat', b)) needPrice[b] = 1; });
  Object.keys(needPrice).forEach(b => flags.push({ cls: 'amber', icon: '🏷️', text: `Set ${breedName(b)} prices (live & meat)`, act: 'editPrice', go: 'Set' }));
  if (!lots().length) flags.push({ cls: 'blue', icon: '🐣', text: 'Add your first lot of chicks', act: 'newLot', go: 'Add' });
  activeLots().forEach(l => {
    const s = st[l.id];
    if (s.remaining < 0) flags.push({ cls: 'red', icon: '⚠️', text: `${l.name}: count is ${s.remaining}. Please count the birds.`, act: 'countCheck', id: l.id, go: 'Count' });
    else if (s.remaining === 0 && (s.sales || s.dead)) flags.push({ cls: 'amber', icon: '✅', text: `${l.name} looks finished. Close this lot?`, act: 'closeLot', id: l.id, go: 'Close' });
    else if (low && s.remaining > 0 && s.remaining <= low) flags.push({ cls: 'red', icon: '🔻', text: `${l.name}: only ${s.remaining} chickens left`, act: 'openLot', id: l.id, go: 'View' });
    if (checkDays && s.daysSinceCheck >= checkDays && s.remaining > 0)
      flags.push({ cls: 'blue', icon: '🔢', text: `${l.name}: count check due (${s.daysSinceCheck} days). How many are left?`, act: 'countCheck', id: l.id, go: 'Count' });
  });
  const flagged = all('sale').filter(s => s.flag).length;
  if (flagged) flags.push({ cls: 'amber', icon: '⚑', text: `${flagged} flagged sale${flagged > 1 ? 's' : ''} (credit / check later)`, act: 'showFlagged', go: 'View' });
  const pend = Object.keys(db.meta.pending).length;
  if (db.meta.syncUrl && db.meta.syncError && pend) flags.push({ cls: 'amber', icon: '☁️', text: `${pend} entries not synced yet — ${db.meta.syncError}`, act: 'syncNow', go: 'Retry' });
  return flags;
}

// ---------- bridge helpers ----------
const httpCallbacks = {};
window.onHttp = function (id, status, text) { const cb = httpCallbacks[id]; delete httpCallbacks[id]; if (cb) cb(status, text); };
function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    if (HAS_ANDROID) {
      const id = 'h' + Math.random().toString(36).slice(2);
      httpCallbacks[id] = (status, text) => {
        if (status >= 200 && status < 300) resolve(text);
        else reject(new Error(status ? 'Server error ' + status : (text || 'No internet')));
      };
      Android.http(url, body, id);
    } else {
      fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
        .then(r => r.ok ? r.text() : Promise.reject(new Error('Server error ' + r.status))).then(resolve, reject);
    }
  });
}

let fileSavedCb = null, fileOpenedCb = null;
window.onFileSaved = ok => { const cb = fileSavedCb; fileSavedCb = null; if (cb) cb(ok); };
window.onFileOpened = text => { const cb = fileOpenedCb; fileOpenedCb = null; if (cb) cb(text); };
function saveTextFile(name, mime, text, cb) {
  if (HAS_ANDROID) { fileSavedCb = cb; Android.saveFile(name, mime, text); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click(); setTimeout(() => cb && cb(true), 100);
}
function openTextFile(cb) {
  if (HAS_ANDROID) { fileOpenedCb = cb; Android.openFile(); return; }
  const inp = document.createElement('input'); inp.type = 'file';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return cb(null); f.text().then(cb, () => cb(null)); };
  inp.click();
}
function shareText(text) {
  if (HAS_ANDROID) Android.shareText(text);
  else if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard && navigator.clipboard.writeText(text);
}

// ---------- merge (used by Google Sheet sync and sync files) ----------
function mergeRecords(list) {
  let changed = 0;
  (list || []).forEach(r => {
    if (!r || !r.id) return;
    const l = db.records[r.id];
    if (!l || (Number(r.updatedAt) || 0) > (Number(l.updatedAt) || 0)) {
      db.records[r.id] = r;
      if (l && db.meta.pending[r.id]) delete db.meta.pending[r.id];
      changed++;
    }
  });
  if (changed) refreshArchived();
  return changed;
}

// ---------- Google Sheet sync ----------
let syncing = false, syncTimer = null;
function scheduleSync(delay) {
  if (!db.meta.syncUrl) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(false), delay == null ? 2500 : delay);
}
async function syncNow(manual) {
  const m = db.meta;
  if (!m.syncUrl) { if (manual) openSyncSetup(); return; }
  if (syncing) return;
  syncing = true; updateSyncDot();
  try {
    let since = Number(m.lastRev) || 0, changedTotal = 0, rounds = 0;
    while (rounds++ < 20) {
      const ids = Object.keys(m.pending).slice(0, 300);
      const snapshot = {};
      const recs = ids.map(id => { const r = db.records[id]; if (r) snapshot[id] = r.updatedAt; return r; }).filter(Boolean);
      const body = JSON.stringify({ action: 'sync', key: m.syncKey || '', since, device: m.deviceName, app: 'chickenkhata', records: recs });
      const text = await httpPost(m.syncUrl.trim(), body);
      let res;
      try { res = JSON.parse(text); } catch (e) { throw new Error(/<html/i.test(text) ? 'Wrong link or sheet not shared as "Anyone"' : 'Bad reply from sheet'); }
      if (!res.ok) throw new Error(res.error || 'Sheet refused');
      if (Number(res.rev) < since) { since = 0; m.lastRev = 0; continue; } // sheet was reset → pull everything again
      ids.forEach(id => { const r = db.records[id]; if (!r || r.updatedAt === snapshot[id]) delete m.pending[id]; });
      changedTotal += mergeRecords(res.records);
      since = Number(res.rev) || since;
      m.lastRev = since;
      if (!Object.keys(m.pending).length) break;
    }
    m.lastSync = Date.now(); m.syncError = '';
    persist(true);
    if (manual) toast(changedTotal ? `Synced ✓ ${changedTotal} updates from other phones` : 'Synced ✓ Everything up to date');
    if (changedTotal || manual) render();
  } catch (e) {
    m.syncError = String(e.message || e).slice(0, 80);
    persist();
    if (manual) toast('Sync failed: ' + m.syncError);
  } finally {
    syncing = false; updateSyncDot();
  }
}
function updateSyncDot() {
  const d = document.getElementById('syncDot');
  if (!d) return;
  const m = db.meta, pend = Object.keys(m.pending).length;
  d.className = 'dot ' + (!m.syncUrl ? 'off' : syncing ? 'pending spin' : m.syncError ? 'err' : pend ? 'pending' : 'ok');
}
