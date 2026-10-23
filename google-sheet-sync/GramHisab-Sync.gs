/**
 * Gram Hisab — Google Sheet sync for many phones.
 *
 * Setup (once):
 *  1. Create a blank Google Sheet named "Gram Hisab".
 *  2. Extensions → Apps Script. Delete everything there and paste this whole file.
 *  3. Change SYNC_KEY below to your own secret word. Save (💾).
 *  4. Deploy → New deployment → type "Web app".
 *     Execute as: Me.  Who has access: Anyone.  → Deploy → allow access.
 *  5. Copy the Web app URL (ends with /exec).
 *  6. In the app on every phone: Settings → paste the URL and the same sync key → Sync now.
 *
 * If you edit this code later: Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 * (the URL stays the same).
 *
 * The "_data" tab is the app's database — do not edit it by hand.
 * The "Sales", "Purchases", "Process", "Lots" and "Shop" tabs are rebuilt automatically for you to read.
 * (Lot costs in the sheet = chick cost + purchases for that lot + costs typed on entries; the app's
 *  Reports page also values feed/medicine used from stock at the average bought price.)
 */

const SYNC_KEY = 'change-me';

function doGet() {
  return out_({ ok: true, app: 'chickenkhata', message: 'Gram Hisab sync is working. Paste this URL in the app.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const req = JSON.parse(e.postData.contents);
    if (SYNC_KEY && SYNC_KEY !== 'change-me' && req.key !== SYNC_KEY) return out_({ ok: false, error: 'Wrong sync key' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = sheet_(ss, '_data', ['id', 'updatedAt', 'rev', 'kind', 'deleted', 'device', 'json']);
    const props = PropertiesService.getScriptProperties();
    let rev = Number(props.getProperty('rev') || 0);

    const last = sh.getLastRow();
    const data = last > 1 ? sh.getRange(2, 1, last - 1, 7).getValues() : [];
    const index = {};
    data.forEach((row, i) => { index[row[0]] = i; });

    let changed = false;
    (req.records || []).forEach(r => {
      if (!r || !r.id) return;
      const i = index[r.id];
      const row = () => [r.id, Number(r.updatedAt) || 0, ++rev, r.kind || '', !!r.deleted, r.device || '', JSON.stringify(r)];
      if (i === undefined) { data.push(row()); index[r.id] = data.length - 1; changed = true; }
      else if ((Number(r.updatedAt) || 0) > Number(data[i][1])) { data[i] = row(); changed = true; }
    });

    if (changed) {
      sh.getRange(2, 1, data.length, 7).setValues(data);
      props.setProperty('rev', String(rev));
      try { rebuildReadable_(ss, data); } catch (err) { /* readable tabs are optional */ }
    }

    const since = Number(req.since || 0);
    const records = data.filter(row => Number(row[2]) > since).map(row => JSON.parse(row[6]));
    return out_({ ok: true, rev: rev, records: records });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function rebuildReadable_(ss, data) {
  const all = data.map(row => JSON.parse(row[6]));
  const archived = {};
  all.forEach(r => { if (r.kind === 'lot' && !r.deleted && r.archived) archived[r.id] = 1; });
  const recs = all.filter(r => !r.deleted && !archived[r.id] && !(r.lotId && archived[r.lotId]));
  const breedRec = recs.filter(r => r.id === 'set:breeds')[0];
  const breedNames = {};
  ((breedRec && breedRec.value) || []).forEach(b => { breedNames[b.id] = b.name; });
  const breed = id => breedNames[id || 'broiler'] || id || 'Broiler';
  const lots = {}, stats = {};
  recs.filter(r => r.kind === 'lot').forEach(l => {
    lots[l.id] = l;
    stats[l.id] = { dead: 0, sold: 0, cut: 0, adj: 0, liveKg: 0, meatKg: 0, rev: 0, cost: Number(l.chickCost) || 0 };
  });
  const name = id => (lots[id] ? lots[id].name : '');
  const sales = [], process = [], purchases = [], shop = [], log = [];
  recs.forEach(r => {
    const s = stats[r.lotId];
    if (r.kind === 'sale') {
      sales.push([r.bs || '', r.date, name(r.lotId), breed(r.breed || (lots[r.lotId] || {}).breed), r.type, r.kg, r.birds || '', r.rate, r.amount, r.invoice || '', r.flag ? 'FLAG' : '', r.note || '', (r.by || r.device || '') + ' ' + new Date(r.createdAt || 0).toISOString().slice(11, 16) + ' UTC']);
      if (s) {
        s.rev += Number(r.amount) || 0;
        if (r.type === 'live') { s.liveKg += Number(r.kg) || 0; s.sold += Number(r.birds) || 0; }
        else { s.meatKg += Number(r.kg) || 0; s.cut += Number(r.birds) || 0; }
      }
    } else if (r.kind === 'audit') {
      const d = new Date(r.at || 0);
      log.push([Utilities.formatDate(d, 'Asia/Kathmandu', 'yyyy-MM-dd HH:mm'), r.by || '', r.action || '', r.summary || '',
        r.changes ? Object.keys(r.changes).map(k => k + ': ' + JSON.stringify(r.changes[k][0]) + ' → ' + JSON.stringify(r.changes[k][1])).join('; ') : '', r.device || '']);
    } else if (r.kind === 'grainsale') {
      sales.push([r.bs || '', r.date, '', 'Grain ' + (r.grade || ''), 'grain', r.unit === 'kg' ? r.qty : '', r.unit === 'kg' ? '' : r.qty + ' bora', r.rate, r.amount, r.invoice || '', r.flag ? 'FLAG' : '', r.note || '', r.device || '']);
    } else if (r.kind === 'shop') {
      const c = (Number(r.cash) || 0) + (Number(r.qr) || 0);
      shop.push([r.bs || '', r.date, Number(r.cash) || 0, Number(r.qr) || 0, c, Number(r.goods) || 0, c - (Number(r.goods) || 0), r.note || '', r.device || '']);
    } else if (r.kind === 'purchase') {
      purchases.push([r.bs || '', r.date, r.category, r.grade || '', r.item || '', r.qty == null ? '' : r.qty, r.unit || '', r.rate == null ? '' : r.rate, r.amount, r.supplier || '', r.invoice || '', r.flag ? 'CREDIT' : '', name(r.lotId), r.note || '', r.device || '']);
      if (s) s.cost += Number(r.amount) || 0;
    } else if (r.kind === 'event') {
      process.push([r.bs || '', r.date, name(r.lotId), r.type, r.grade || '', r.item || '', r.count == null ? '' : r.count, r.qty == null ? '' : r.qty, r.unit || '', r.amount == null ? '' : r.amount, r.note || '', r.device || '']);
      if (s) {
        const c = Number(r.count) || 0;
        if (r.type === 'dead') s.dead += c;
        else if (r.type === 'cut') s.cut += c;
        else if (r.type === 'soldfix') s.sold += c;
        else if (r.type === 'adjust') s.adj += c;
        if (['feed', 'medicine', 'vitamin', 'vaccine', 'expense'].indexOf(r.type) >= 0) s.cost += Number(r.amount) || 0;
      }
    }
  });
  sales.sort((a, b) => String(b[1]).localeCompare(String(a[1])));
  process.sort((a, b) => String(b[1]).localeCompare(String(a[1])));
  purchases.sort((a, b) => String(b[1]).localeCompare(String(a[1])));
  shop.sort((a, b) => String(b[1]).localeCompare(String(a[1])));
  const lotRows = Object.keys(lots).map(id => {
    const l = lots[id], s = stats[id], chicks = (Number(l.chicks) || 0) + (Number(l.free) || 0) + s.adj;   // paid + free (bonus) chicks
    return [l.name, breed(l.breed), l.startBs || '', l.startDate, l.closed ? 'Closed' : 'Active', chicks, s.dead, s.sold, s.cut, chicks - s.dead - s.sold - s.cut, s.liveKg, s.meatKg, s.rev, s.cost, s.rev - s.cost];
  });
  write_(ss, 'Sales', ['Date (BS)', 'Date (AD)', 'Lot', 'Chicken type', 'Sale type', 'Kg', 'Birds', 'Rate', 'Amount', 'Invoice', 'Flag', 'Note', 'Entered by'], sales);
  log.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  write_(ss, 'Change log', ['When (Nepal time)', 'User', 'Action', 'What', 'Changes', 'Phone'], log.slice(0, 5000));
  write_(ss, 'Shop', ['Date (BS)', 'Date (AD)', 'Cash', 'QR', 'Collected', 'Goods bought', 'Collected − goods', 'Note', 'Phone'], shop);
  write_(ss, 'Purchases', ['Date (BS)', 'Date (AD)', 'Category', 'Grain size', 'Item', 'Qty', 'Unit', 'Rate', 'Amount', 'Supplier', 'Bill no.', 'Credit', 'For lot', 'Note', 'Phone'], purchases);
  write_(ss, 'Process', ['Date (BS)', 'Date (AD)', 'Lot', 'Type', 'Grain size', 'Item', 'Birds', 'Qty', 'Unit', 'Cost', 'Note', 'Phone'], process);
  write_(ss, 'Lots', ['Lot', 'Chicken type', 'Start (BS)', 'Start (AD)', 'Status', 'Chicks', 'Dead', 'Sold live', 'Cut', 'Left', 'Live kg', 'Meat kg', 'Sales Rs', 'Costs Rs', 'Profit Rs'], lotRows);
  rebuildKheti_(ss, recs);
  rebuildMill_(ss, recs);
}

// ---------- ⚙️ Mill tab ----------
function rebuildMill_(ss, recs) {
  const itemsRec = recs.filter(r => r.id === 'set:millItems')[0], names = { dhan_kutani: 'धान कुटानी', makai_pisani: 'मकै पिसानी', gahun_pisani: 'गहुँ पिसानी', kodo_pisani: 'कोदो पिसानी' };
  ((itemsRec && itemsRec.value) || []).forEach(x => { names[x.id] = x.ne; });
  const rows = recs.filter(r => r.kind === 'mill' || r.kind === 'millcost').map(r => r.kind === 'mill'
    ? [r.bs || '', r.date, r.own ? 'Own (free)' : 'Customer', names[r.item] || r.item, Number(r.qty) || 0, r.unit || 'pathi', Number(r.pathi) || 0, Number(r.rate) || 0, r.own ? 0 : Number(r.amount) || 0, r.pay || '', r.customer || '', r.note || '', r.by || '']
    : [r.bs || '', r.date, 'Electricity bill', '', r.units || '', 'kWh', '', '', -(Number(r.amount) || 0), '', '', r.note || '', r.by || '']);
  if (!rows.length) return;
  rows.sort((a, b) => String(b[1]).localeCompare(String(a[1])));
  write_(ss, 'Mill', ['Date (BS)', 'Date (AD)', 'Kind', 'Work', 'Qty', 'Unit', 'Pathi', 'Rate', 'Amount Rs', 'Pay', 'Customer', 'Note', 'Entered by'], rows);
}

// ---------- 🌾 Kheti tabs ----------
const CROP_NAMES_ = { dhaan: 'धान Rice', gahun: 'गहुँ Wheat', makai: 'मकै Maize', kodo: 'कोदो Millet', jau: 'जौ Barley', phapar: 'फापर Buckwheat', kerau: 'केराउ Pea',
  masuro: 'मसुरो Lentil', maas: 'मास Black gram', mugi: 'मुगी Mung', rahar: 'रहर Pigeon pea', bhatmas: 'भटमास Soybean', chana: 'चना Gram', tori: 'तोरी Mustard',
  aalu: 'आलु Potato', ukhu: 'उखु Sugarcane', aduwa: 'अदुवा Ginger', besar: 'बेसार Turmeric', kauli: 'काउली Cauliflower', banda: 'बन्दा Cabbage', golbheda: 'गोलभेडा Tomato',
  bhanta: 'भन्टा Brinjal', khursani: 'खुर्सानी Chilli', simi: 'सिमी Beans', bodi: 'बोडी Bodi', bhindi: 'भिन्डी Okra', karela: 'करेला Bitter gourd', lauka: 'लौका Bottle gourd',
  farsi: 'फर्सी Pumpkin', kakro: 'काँक्रो Cucumber', mula: 'मुला Radish', gajar: 'गाजर Carrot', pyaj: 'प्याज Onion', lasun: 'लसुन Garlic', saag: 'साग Greens' };
const WORK_NAMES_ = { goru: 'Goru jotne', tractorjot: 'Tractor jotne', bause: 'Bause', lathe: 'Lathe', aali: 'Aali lagaune', byad: 'Byad / Biu rakhne', ropai: 'Ropai',
  godmel: 'Godmel', malhalne: 'Mal halne', sinchai: 'Sinchai', dawai: 'Dawai chharne', katne: 'Katne', bhari: 'Bhari bokne', dain: 'Dain / Thresher', sukaune: 'Sukaune',
  aalukhanne: 'Aalu khanne', other: 'Other' };
const MACHINE_NAMES_ = { hiredTractor: 'Tractor (hired)', ownTractor: 'Own tractor', powerTiller: 'Power tiller', pump: 'Water pump', thresher: 'Thresher / harvester' };
const PATHI_KG_ = { dhaan: 3.6, gahun: 4.5, makai: 4.2, kodo: 4.2, maas: 4.4, masuro: 4.6, kerau: 4.4 };
function rebuildKheti_(ss, recs) {
  const of = kind => recs.filter(r => r.kind === kind);
  const setting = key => { const r = recs.filter(x => x.id === 'set:' + key)[0]; return r && r.value; };
  const pathiKg = c => Number((setting('pathiKg') || {})[c]) || PATHI_KG_[c] || 4, boraKg = c => Number((setting('boraKg') || {})[c]) || 50;
  const kgOf = r => {
    if (Number(r.kg)) return Number(r.kg);
    const q = Number(r.qty) || 0;
    return { quintal: q * 100, muri: q * 20 * pathiKg(r.crop), pathi: q * pathiKg(r.crop), mana: q * pathiKg(r.crop) / 8, bora: q * boraKg(r.crop) }[r.unit] || q;
  };
  const cropN = {}, workN = {};
  Object.keys(CROP_NAMES_).forEach(k => { cropN[k] = CROP_NAMES_[k]; });
  (setting('cropList') || []).forEach(c => { cropN[c.id] = c.ne === c.en ? c.en : c.ne + ' ' + c.en; });
  Object.keys(WORK_NAMES_).forEach(k => { workN[k] = WORK_NAMES_[k]; });
  (setting('workTypes') || []).forEach(w => { workN[w.id] = w.en; });
  const crop = id => cropN[id] || id || '', work = id => workN[id] || id || '';
  const fields = {}, khetis = {}, workers = {}, fam = {};
  of('field').forEach(f => { fields[f.id] = f; });
  of('worker').forEach(w => { workers[w.id] = { w: w, earned: 0, paid: 0, full: 0, half: 0 }; });
  const kc = () => ({ labour: 0, family: 0, own: 0, my: 0, parma: 0, hire: 0, hours: 0, fuel: 0, litres: 0, seed: 0, fert: 0, harvest: {} });
  of('kheti').forEach(k => { khetis[k.id] = { k: k, c: kc() }; });
  const mainCrop = k => { const c = (k.crops || []).filter(x => x.role === 'main')[0] || (k.crops || [])[0]; return c ? c.crop : ''; };
  const title = id => { const x = khetis[id]; if (!x) return ''; const f = fields[x.k.fieldId]; return (f ? f.name : '?') + ' · ' + crop(mainCrop(x.k)); };
  const wname = id => workers[id] ? workers[id].w.name + (workers[id].w.family ? ' (' + workers[id].w.family + ')' : '') : '';
  const by = r => (r.by || r.device || '');
  const famOf = n => fam[n] || (fam[n] = { came: 0, went: 0 });
  const workRows = [], payRows = [], machRows = [], inRows = [], harvRows = [], parmaRows = [];
  recs.forEach(r => {
    const c = khetis[r.khetiId] ? khetis[r.khetiId].c : null;
    if (r.kind === 'fwork') {
      const own = x => workers[x.workerId] && workers[x.workerId].w.own;   // household members are not paid
      const named = (r.workers || []).filter(x => !own(x)).reduce((a, x) => a + (Number(x.rate) || 0), 0);
      const famVal = (r.workers || []).filter(own).reduce((a, x) => a + (Number(x.rate) || 0), 0);
      const amt = named + (Number(r.extraFull) || 0) * (Number(r.rateFull) || 0) + (Number(r.extraHalf) || 0) * (Number(r.rateHalf) || 0);
      const pd = (r.parma || []).reduce((a, p) => a + (Number(p.full) || 0) + (Number(p.half) || 0) * 0.5, 0);
      (r.workers || []).forEach(x => { const w = workers[x.workerId]; if (w) { w.earned += Number(x.rate) || 0; if (x.shift === 'half') w.half++; else w.full++; } });
      (r.parma || []).forEach(p => { if (p.family) famOf(p.family).came += (Number(p.full) || 0) + (Number(p.half) || 0) * 0.5; });
      if (c) { c.labour += amt; c.family += famVal; c.parma += pd; }
      workRows.push([r.bs || '', r.date, title(r.khetiId), work(r.workType),
        (r.workers || []).map(x => (workers[x.workerId] ? workers[x.workerId].w.name : '?') + (x.shift === 'half' ? ' ½' : '')).join(', '),
        Number(r.extraFull) || 0, Number(r.extraHalf) || 0, Number(r.rateFull) || 0, Number(r.rateHalf) || 0,
        (r.parma || []).map(p => (p.family || '—') + ' ' + ((Number(p.full) || 0) + (Number(p.half) || 0) * 0.5)).join(', '), amt, famVal, r.note || '', by(r)]);
    } else if (r.kind === 'fpay') {
      if (workers[r.workerId]) workers[r.workerId].paid += Number(r.amount) || 0;
      payRows.push([r.bs || '', r.date, wname(r.workerId), Number(r.amount) || 0, r.method || '', r.note || '', by(r)]);
    } else if (r.kind === 'parmaout') {
      if (r.family) famOf(r.family).went += (Number(r.full) || 0) + (Number(r.half) || 0) * 0.5;
      parmaRows.push([r.bs || '', r.date, r.family || '', 'We worked for them', (Number(r.full) || 0) + (Number(r.half) || 0) * 0.5, r.note || '', by(r)]);
    } else if (r.kind === 'machine') {
      const hired = r.type === 'hiredTractor' || r.type === 'thresher';
      const ownVal = hired ? 0 : (r.ownValue != null ? Number(r.ownValue) || 0 : (Number(r.hours) || 0) * (Number(r.ratePerHour) || 0));
      const myVal = hired ? 0 : (r.myValue != null ? Number(r.myValue) || 0 : (Number(r.myHours) || 0) * (Number(r.myRate) || 0));
      if (c) { c.hire += Number(r.hireAmount) || 0; c.hours += Number(r.hours) || 0; c.fuel += Number(r.fuelCost) || 0; c.litres += Number(r.litres) || 0; c.own += ownVal; c.my += myVal; }
      machRows.push([r.bs || '', r.date, title(r.khetiId), MACHINE_NAMES_[r.type] || r.type, Number(r.hours) || 0, Number(r.ratePerHour) || 0, Number(r.hireAmount) || 0, ownVal, myVal, r.fuel || '', Number(r.litres) || 0, Number(r.fuelCost) || 0, r.note || '', by(r)]);
    } else if (r.kind === 'finput') {
      if (c) { if (r.type === 'seed') c.seed += Number(r.cost) || 0; else c.fert += Number(r.cost) || 0; }
      inRows.push([r.bs || '', r.date, title(r.khetiId), r.type === 'seed' ? 'Seed' : 'Fertilizer', r.item || '', Number(r.qty) || 0, r.unit || '', Number(r.cost) || 0, r.note || '', by(r)]);
    } else if (r.kind === 'harvest') {
      if (c) c.harvest[r.crop] = (c.harvest[r.crop] || 0) + kgOf(r);
      harvRows.push([r.bs || '', r.date, title(r.khetiId), crop(r.crop), Number(r.qty) || 0, r.unit || '', Math.round(kgOf(r) * 10) / 10, r.note || '', by(r)]);
    }
  });
  // parma that came on work days is also listed in the Parma tab
  recs.filter(r => r.kind === 'fwork').forEach(r => (r.parma || []).forEach(p => parmaRows.push([r.bs || '', r.date, p.family || '—', 'Came to help (' + work(r.workType) + ', ' + title(r.khetiId) + ')', (Number(p.full) || 0) + (Number(p.half) || 0) * 0.5, '', by(r)])));
  const desc = rows => rows.sort((a, b) => String(b[1]).localeCompare(String(a[1])));
  [workRows, payRows, machRows, inRows, harvRows, parmaRows].forEach(desc);
  const ropani = m2 => Math.round(m2 / 508.72 * 1000) / 1000, kattha = m2 => Math.round(m2 / 338.6315 * 100) / 100;
  const fieldRows = Object.keys(fields).map(id => {
    const f = fields[id], ks = Object.keys(khetis).filter(k => khetis[k].k.fieldId === id);
    const cur = ks.map(k => khetis[k].k).filter(k => k.status !== 'done')[0];
    const life = ks.reduce((a, k) => { const c = khetis[k].c; return a + c.labour + c.hire + c.fuel + c.seed + c.fert + (khetis[k].k.includeFamily ? c.family : 0) + (khetis[k].k.includeOwnMachine ? c.own + c.my : 0); }, 0);
    return [f.name, ropani(f.areaM2 || 0), kattha(f.areaM2 || 0), Math.round(f.areaM2 || 0), f.closed ? 'Not in use' : 'In use', cur ? crop(mainCrop(cur)) : 'Khali', ks.length, life, f.location || ''];
  });
  const khetiRows = Object.keys(khetis).map(id => {
    const x = khetis[id], k = x.k, c = x.c, f = fields[k.fieldId] || {}, total = c.labour + c.hire + c.fuel + c.seed + c.fert + (k.includeFamily ? c.family : 0) + (k.includeOwnMachine ? c.own + c.my : 0), mk = c.harvest[mainCrop(k)] || 0;
    return [f.name || '', crop(mainCrop(k)), (k.crops || []).filter(z => z.role === 'aali').map(z => crop(z.crop)).join(', '), k.variety || '', k.season || '', k.bs || '', k.plantDate || '',
      k.status === 'done' ? 'Done' : 'Growing', c.labour, c.family, k.includeFamily ? 'yes' : 'no', c.parma, c.hire, c.hours, c.own, c.my, k.includeOwnMachine ? 'yes' : 'no', c.fuel, c.litres, c.seed, c.fert, total,
      Object.keys(c.harvest).map(z => crop(z) + ' ' + Math.round(c.harvest[z]) + ' kg').join(', '), Math.round(mk), mk ? Math.round(total / mk * 100) / 100 : ''];
  }).sort((a, b) => String(b[6]).localeCompare(String(a[6])));
  const workerRows = Object.keys(workers).map(id => { const w = workers[id]; return [w.w.name, w.w.own ? 'Household (not paid)' : 'Hired', w.w.family || '', w.w.phone || '', w.w.village || '', w.full, w.half, w.earned, w.paid, w.w.own ? 0 : w.earned - w.paid]; });
  Object.keys(fam).forEach(n => parmaRows.unshift(['', '', n, 'BALANCE (+ we owe them, − they owe us)', fam[n].came - fam[n].went, 'came ' + fam[n].came + ' · went ' + fam[n].went, '']));
  // my machines and their servicing
  const ITEM_ = { mobil: 'Mobil', gear: 'Gear oil', hydraulic: 'Hydraulic oil', grease: 'Grease', oilfilter: 'Oil filter', airfilter: 'Air filter', dieselfilter: 'Diesel filter',
    parts: 'Parts', tyre: 'Tyre/tube', battery: 'Battery', coolant: 'Coolant', mechanic: 'Mechanic', other: 'Other' };
  const mm = {};
  of('mymachine').forEach(m => { mm[m.id] = { m: m, hours: 0, litres: 0, fuel: 0, svc: 0, n: 0, last: '', next: '' }; });
  const oneOfType = t => { const l = of('mymachine').filter(m => m.type === t && m.active !== false); return l.length === 1 ? l[0].id : ''; };
  of('machine').forEach(r => { if (r.type === 'hiredTractor' || r.type === 'thresher') return; const x = mm[r.machineId || oneOfType(r.type)]; if (x) { x.hours += Number(r.hours) || 0; x.litres += Number(r.litres) || 0; x.fuel += Number(r.fuelCost) || 0; } });
  const svcRows = [];
  of('mservice').forEach(r => {
    const tot = (r.items || []).reduce((a, i) => a + (Number(i.cost) || 0), 0), x = mm[r.machineId];
    if (x) { x.svc += tot; x.n++; if (r.date >= x.last) { x.last = r.date; x.next = r.nextDate || ''; } }
    svcRows.push([r.bs || '', r.date, x ? x.m.name : '', (r.items || []).map(i => (ITEM_[i.item] || i.item) + (i.qty ? ' ' + i.qty : '') + ' ' + (Number(i.cost) || 0)).join(', '), tot, r.meter == null ? '' : r.meter, r.nextDate || '', r.note || '', by(r)]);
  });
  svcRows.sort((a, b) => String(b[1]).localeCompare(String(a[1])));
  const mmRows = Object.keys(mm).map(id => { const x = mm[id]; return [x.m.name, x.m.type, x.m.number || '', x.m.active === false ? 'Not in use' : 'In use', x.hours, x.litres, x.fuel, x.n, x.svc, x.fuel + x.svc, x.last, x.next]; });
  if (mmRows.length) {
    write_(ss, 'My machines', ['Machine', 'Type', 'Number', 'Status', 'Hours used', 'Fuel L', 'Fuel Rs', 'Services', 'Servicing Rs', 'Running cost Rs', 'Last service', 'Next service'], mmRows);
    write_(ss, 'Servicing', ['Date (BS)', 'Date (AD)', 'Machine', 'Items (Rs)', 'Total Rs', 'Hour meter', 'Next service', 'Note', 'Entered by'], svcRows);
  }
  if (!fieldRows.length && !khetiRows.length && !workerRows.length) return; // no Kheti yet: don't add empty tabs
  write_(ss, 'Fields', ['Field', 'Ropani', 'Kattha', 'm²', 'Status', 'Current crop', 'Kheti count', 'Lifetime cost Rs', 'Place'], fieldRows);
  write_(ss, 'Kheti', ['Field', 'Main crop', 'Aali crops', 'Variety', 'Season', 'Planted (BS)', 'Planted (AD)', 'Status', 'Labour Rs (paid)', 'Family work Rs', 'Family work counted', 'Parma days', 'Machine hire Rs', 'Machine hours', 'Own machine value Rs', 'My time Rs', 'Own machine counted', 'Fuel Rs', 'Fuel litres', 'Seed Rs', 'Fertilizer Rs', 'Total cost Rs', 'Harvest', 'Main crop kg', 'Cost per kg'], khetiRows);
  write_(ss, 'Kheti work', ['Date (BS)', 'Date (AD)', 'Kheti', 'Work', 'Khetala by name', 'Other full', 'Other half', 'Full rate', 'Half rate', 'Parma (family days)', 'Wages Rs', 'Family work value Rs', 'Note', 'Entered by'], workRows);
  write_(ss, 'Workers', ['Name', 'Type', 'Family', 'Phone', 'Village', 'Full days', 'Half days', 'Earned Rs', 'Paid Rs', 'Due Rs'], workerRows);
  write_(ss, 'Payments', ['Date (BS)', 'Date (AD)', 'Worker', 'Amount', 'Method', 'Note', 'Entered by'], payRows);
  write_(ss, 'Machines', ['Date (BS)', 'Date (AD)', 'Kheti', 'Machine', 'Hours', 'Rate/hour', 'Hire Rs', 'Own machine value Rs', 'My time Rs', 'Fuel', 'Litres', 'Fuel Rs', 'Note', 'Entered by'], machRows);
  write_(ss, 'Inputs', ['Date (BS)', 'Date (AD)', 'Kheti', 'Type', 'Item', 'Qty', 'Unit', 'Cost Rs', 'Note', 'Entered by'], inRows);
  write_(ss, 'Harvest', ['Date (BS)', 'Date (AD)', 'Kheti', 'Crop', 'Qty', 'Unit', 'Kg', 'Note', 'Entered by'], harvRows);
  write_(ss, 'Parma', ['Date (BS)', 'Date (AD)', 'Family', 'What', 'Days', 'Note', 'Entered by'], parmaRows);
}

function write_(ss, name, header, rows) {
  const sh = sheet_(ss, name, header);
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
}
