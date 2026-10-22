/**
 * Poultry Record — Google Sheet sync for many phones.
 *
 * Setup (once):
 *  1. Create a blank Google Sheet named "Poultry Record".
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
  return out_({ ok: true, app: 'chickenkhata', message: 'Poultry Record sync is working. Paste this URL in the app.' });
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
    const l = lots[id], s = stats[id], chicks = (Number(l.chicks) || 0) + s.adj;
    return [l.name, breed(l.breed), l.startBs || '', l.startDate, l.closed ? 'Closed' : 'Active', chicks, s.dead, s.sold, s.cut, chicks - s.dead - s.sold - s.cut, s.liveKg, s.meatKg, s.rev, s.cost, s.rev - s.cost];
  });
  write_(ss, 'Sales', ['Date (BS)', 'Date (AD)', 'Lot', 'Chicken type', 'Sale type', 'Kg', 'Birds', 'Rate', 'Amount', 'Invoice', 'Flag', 'Note', 'Entered by'], sales);
  log.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  write_(ss, 'Change log', ['When (Nepal time)', 'User', 'Action', 'What', 'Changes', 'Phone'], log.slice(0, 5000));
  write_(ss, 'Shop', ['Date (BS)', 'Date (AD)', 'Cash', 'QR', 'Collected', 'Goods bought', 'Collected − goods', 'Note', 'Phone'], shop);
  write_(ss, 'Purchases', ['Date (BS)', 'Date (AD)', 'Category', 'Grain size', 'Item', 'Qty', 'Unit', 'Rate', 'Amount', 'Supplier', 'Bill no.', 'Credit', 'For lot', 'Note', 'Phone'], purchases);
  write_(ss, 'Process', ['Date (BS)', 'Date (AD)', 'Lot', 'Type', 'Grain size', 'Item', 'Birds', 'Qty', 'Unit', 'Cost', 'Note', 'Phone'], process);
  write_(ss, 'Lots', ['Lot', 'Chicken type', 'Start (BS)', 'Start (AD)', 'Status', 'Chicks', 'Dead', 'Sold live', 'Cut', 'Left', 'Live kg', 'Meat kg', 'Sales Rs', 'Costs Rs', 'Profit Rs'], lotRows);
}

function write_(ss, name, header, rows) {
  const sh = sheet_(ss, name, header);
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
}
