/* Gram Hisab — 🌾 Kheti (खेती): fields, crop cycles (kheti), workers, labour, parma, machines, seeds/fertilizer, harvest.
   Records go through put() in core.js, so user, time, change log, edit/delete and Google Sheet sync come for free.
   kinds: field · kheti · worker · fwork · fpay · parmaout · machine · finput · harvest */
'use strict';

// ---------- built-in lists (editable in Settings) ----------
const CROPS_DEFAULT = [
  ['dhaan', 'Rice / Paddy', 'धान', 'grain'], ['gahun', 'Wheat', 'गहुँ', 'grain'], ['makai', 'Maize', 'मकै', 'grain'], ['kodo', 'Millet', 'कोदो', 'grain'],
  ['jau', 'Barley', 'जौ', 'grain'], ['phapar', 'Buckwheat', 'फापर', 'grain'],
  ['kerau', 'Pea', 'केराउ', 'pulse'], ['masuro', 'Lentil', 'मसुरो', 'pulse'], ['maas', 'Black gram', 'मास', 'pulse'], ['mugi', 'Mung', 'मुगी', 'pulse'],
  ['rahar', 'Pigeon pea', 'रहर', 'pulse'], ['bhatmas', 'Soybean', 'भटमास', 'pulse'], ['chana', 'Gram', 'चना', 'pulse'],
  ['tori', 'Mustard', 'तोरी', 'cash'], ['aalu', 'Potato', 'आलु', 'cash'], ['ukhu', 'Sugarcane', 'उखु', 'cash'], ['aduwa', 'Ginger', 'अदुवा', 'cash'], ['besar', 'Turmeric', 'बेसार', 'cash'],
  ['kauli', 'Cauliflower', 'काउली', 'veg'], ['banda', 'Cabbage', 'बन्दा', 'veg'], ['golbheda', 'Tomato', 'गोलभेडा', 'veg'], ['bhanta', 'Brinjal', 'भन्टा', 'veg'],
  ['khursani', 'Chilli', 'खुर्सानी', 'veg'], ['simi', 'Beans', 'सिमी', 'veg'], ['bodi', 'Bodi', 'बोडी', 'veg'], ['bhindi', 'Okra', 'भिन्डी', 'veg'],
  ['karela', 'Bitter gourd', 'करेला', 'veg'], ['lauka', 'Bottle gourd', 'लौका', 'veg'], ['farsi', 'Pumpkin', 'फर्सी', 'veg'], ['kakro', 'Cucumber', 'काँक्रो', 'veg'],
  ['mula', 'Radish', 'मुला', 'veg'], ['gajar', 'Carrot', 'गाजर', 'veg'], ['pyaj', 'Onion', 'प्याज', 'veg'], ['lasun', 'Garlic', 'लसुन', 'veg'], ['saag', 'Leafy greens (Rayo, Palungo)', 'साग', 'veg']
].map(([id, en, ne, group]) => ({ id, en, ne, group }));
const CROP_GROUPS = { grain: '🌾 Grains', pulse: '🫘 Pulses', cash: '🥔 Cash / oil', veg: '🥬 Vegetables' };
const WORK_DEFAULT = [
  ['goru', 'Goru jotne (halo)', 'गोरु जोत्ने'], ['tractorjot', 'Tractor jotne', 'ट्र्याक्टर जोत्ने'], ['bause', 'Bause', 'बाउसे'], ['lathe', 'Lathe', 'लाठे'],
  ['aali', 'Aali lagaune', 'आली लगाउने'], ['byad', 'Byad / Biu rakhne', 'ब्याड राख्ने'], ['ropai', 'Ropar / Ropai', 'रोपाइँ'], ['godmel', 'Godne / Godmel', 'गोडमेल'],
  ['malhalne', 'Mal bokne / halne', 'मल हाल्ने'], ['sinchai', 'Pani launa / Sinchai', 'सिँचाइ'], ['dawai', 'Dawai chharne', 'दबाई छर्ने'], ['katne', 'Katne (harvest)', 'कटनी'],
  ['bhari', 'Bhari bokne', 'भारी बोक्ने'], ['dain', 'Dain / Thresher', 'दाइँ'], ['sukaune', 'Sukaune / Bhitryaune', 'सुकाउने'], ['aalukhanne', 'Aalu khanne', 'आलु खन्ने'],
  ['other', 'Other', 'अन्य']
].map(([id, en, ne]) => ({ id, en, ne }));
const MACHINES = {
  hiredTractor: { en: 'Tractor (hired)', ne: 'ट्र्याक्टर भाडा', icon: '🚜', hired: true },
  ownTractor: { en: 'Own tractor', ne: 'आफ्नो ट्र्याक्टर', icon: '🚜' },
  powerTiller: { en: 'Power tiller', ne: 'पावर टिलर', icon: '⚙️' },
  pump: { en: 'Water pump', ne: 'पम्प', icon: '💧' },
  thresher: { en: 'Thresher / harvester', ne: 'थ्रेसर', icon: '🌾', hired: true }
};
const FERTILIZERS = ['Urea', 'DAP', 'Potash', 'Compost / Gobar mal', 'Zinc', 'Other'];
const HARVEST_UNITS = { kg: 'kg', quintal: 'quintal', muri: 'muri (मुरी)', pathi: 'pathi (पाथी)', mana: 'mana (माना)', bora: 'bora' };
const PATHI_KG_DEFAULT = { dhaan: 3.6, gahun: 4.5, makai: 4.2, kodo: 4.2, maas: 4.4, masuro: 4.6, kerau: 4.4 };

function cropList() { const c = getSet('cropList'); return Array.isArray(c) && c.length ? c : CROPS_DEFAULT; }
function cropById(id) { return cropList().find(c => c.id === id) || { id, en: id, ne: id, group: 'veg' }; }
function cropName(id, lang) { const c = cropById(id); return lang === 'en' ? c.en : `${c.ne} ${c.en.split(' /')[0]}`; }
function workTypes() { const w = getSet('workTypes'); return Array.isArray(w) && w.length ? w : WORK_DEFAULT; }
function workById(id) { return workTypes().find(w => w.id === id) || { id, en: id, ne: id }; }
function wageRate(wt, shift) { const r = (getSet('wageRates') || {})[wt] || {}; return Number(shift === 'half' ? r.half : r.full) || 0; }
function setWageRate(wt, full, half) { const r = Object.assign({}, getSet('wageRates') || {}); r[wt] = { full: Number(full) || 0, half: Number(half) || 0 }; setSet('wageRates', r); }
function pathiKg(crop) { const m = getSet('pathiKg') || {}; return Number(m[crop]) || PATHI_KG_DEFAULT[crop] || 4; }
function boraKg(crop) { const m = getSet('boraKg') || {}; return Number(m[crop]) || 50; }
function harvestKg(r) {
  const q = Number(r.qty) || 0;
  switch (r.unit) {
    case 'quintal': return q * 100;
    case 'muri': return q * 20 * pathiKg(r.crop);
    case 'pathi': return q * pathiKg(r.crop);
    case 'mana': return q * pathiKg(r.crop) / 8;
    case 'bora': return q * boraKg(r.crop);
    default: return q;
  }
}
// "20 muri 3 pathi" from kg (for crops measured in muri)
function fmtMuri(kg, crop) {
  const p = kg / pathiKg(crop), muri = Math.floor(p / 20 + 1e-9), pathi = Math.round((p - muri * 20) * 10) / 10;
  return (muri ? muri + ' muri ' : '') + (pathi ? pathi + ' pathi' : (muri ? '' : '0 pathi'));
}

// Nepali season of a planting date: Barkhe (Asar–Bhadra), Hiude (Ashoj–Poush), Chaite (Magh–Jestha)
function seasonOf(adDate) {
  const b = adToBs(adDate || today());
  if (!b) return '';
  if (b.m >= 3 && b.m <= 5) return 'Barkhe ' + b.y;
  if (b.m >= 6 && b.m <= 9) return 'Hiude ' + b.y;
  return 'Chaite ' + (b.m >= 10 ? b.y : b.y);
}
const SEASON_NE = { Barkhe: 'बर्खे', Hiude: 'हिउँदे', Chaite: 'चैते' };
function seasonLabel(s) { const [n, y] = String(s || '').split(' '); return SEASON_NE[n] ? `${SEASON_NE[n]} ${y} (${n})` : s; }

// ---------- lookups ----------
function fields() { return all('field').sort((a, b) => (a.closed - b.closed) || String(a.name).localeCompare(String(b.name))); }
function activeFields() { return fields().filter(f => !f.closed); }
function fieldById(id) { const r = db.records[id]; return r && !r.deleted && r.kind === 'field' ? r : null; }
function khetis() { return all('kheti').sort((a, b) => String(b.plantDate).localeCompare(String(a.plantDate))); }
function khetiById(id) { const r = db.records[id]; return r && !r.deleted && r.kind === 'kheti' ? r : null; }
function activeKhetis() { return khetis().filter(k => k.status !== 'done'); }
function khetiOfField(fid) { return khetis().filter(k => k.fieldId === fid); }
function currentKheti(fid) { return khetiOfField(fid).find(k => k.status !== 'done') || null; }
function mainCrop(k) { const c = (k.crops || []).find(x => x.role === 'main') || (k.crops || [])[0]; return c ? c.crop : ''; }
function khetiTitle(k) {
  if (!k) return '';
  const f = fieldById(k.fieldId);
  const side = (k.crops || []).filter(c => c.role === 'aali').map(c => cropById(c.crop).ne);
  return `${f ? f.name : '?'} · ${cropById(mainCrop(k)).ne}${side.length ? ' + आली: ' + side.join(', ') : ''}`;
}
function workers() { return all('worker').sort((a, b) => String(a.family || '').localeCompare(String(b.family || '')) || String(a.name).localeCompare(String(b.name))); }
function workerById(id) { const r = db.records[id]; return r && !r.deleted && r.kind === 'worker' ? r : null; }
function workerLabel(w) { return w ? w.name + (w.family ? ' (' + w.family + ')' : '') : '?'; }
function families() {
  const set = {};
  workers().forEach(w => { if (w.family) set[w.family] = 1; });
  all('fwork').forEach(r => (r.parma || []).forEach(p => { if (p.family) set[p.family] = 1; }));
  all('parmaout').forEach(r => { if (r.family) set[r.family] = 1; });
  return Object.keys(set).sort();
}

// ---------- money of one labour day ----------
function fworkAmount(r) {
  const named = (r.workers || []).reduce((a, w) => a + (Number(w.rate) || 0), 0);
  return named + (Number(r.extraFull) || 0) * (Number(r.rateFull) || 0) + (Number(r.extraHalf) || 0) * (Number(r.rateHalf) || 0);
}
const shiftDays = s => s === 'half' ? 0.5 : 1;

// ---------- all Kheti numbers in one pass ----------
function computeKheti() {
  const K = {}, F = {}, W = {}, P = {};
  const blank = () => ({ labour: 0, labourFull: 0, labourHalf: 0, parmaDays: 0, machineHire: 0, machineHours: 0, fuelCost: 0, petrol: 0, diesel: 0,
    seed: 0, fert: 0, total: 0, harvestKg: {}, harvestUnits: {}, entries: 0, lastDate: '' });
  khetis().forEach(k => { K[k.id] = Object.assign(blank(), { kheti: k }); });
  fields().forEach(f => { F[f.id] = { field: f, lifetime: 0, khetis: 0 }; });
  workers().forEach(w => { W[w.id] = { worker: w, earned: 0, paid: 0, fullDays: 0, halfDays: 0, last: '' }; });
  const fam = name => P[name] || (P[name] = { family: name, came: 0, went: 0 });
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r)) continue;
    const k = r.khetiId ? K[r.khetiId] : null;
    if (r.kind === 'fwork') {
      const amt = fworkAmount(r);
      (r.workers || []).forEach(x => {
        const w = W[x.workerId];
        if (w) { w.earned += Number(x.rate) || 0; if (x.shift === 'half') w.halfDays++; else w.fullDays++; if (r.date > w.last) w.last = r.date; }
      });
      (r.parma || []).forEach(p => { if (p.family) fam(p.family).came += (Number(p.full) || 0) + (Number(p.half) || 0) * 0.5; });
      if (k) {
        k.labour += amt; k.entries++;
        k.labourFull += (r.workers || []).filter(x => x.shift !== 'half').length + (Number(r.extraFull) || 0);
        k.labourHalf += (r.workers || []).filter(x => x.shift === 'half').length + (Number(r.extraHalf) || 0);
        k.parmaDays += (r.parma || []).reduce((a, p) => a + (Number(p.full) || 0) + (Number(p.half) || 0) * 0.5, 0);
        if (r.date > k.lastDate) k.lastDate = r.date;
      }
    } else if (r.kind === 'fpay') {
      if (W[r.workerId]) W[r.workerId].paid += Number(r.amount) || 0;
    } else if (r.kind === 'parmaout') {
      if (r.family) fam(r.family).went += (Number(r.full) || 0) + (Number(r.half) || 0) * 0.5;
    } else if (r.kind === 'machine' && k) {
      k.machineHire += Number(r.hireAmount) || 0; k.machineHours += Number(r.hours) || 0; k.fuelCost += Number(r.fuelCost) || 0;
      if (r.fuel === 'petrol') k.petrol += Number(r.litres) || 0; else if (r.fuel === 'diesel') k.diesel += Number(r.litres) || 0;
      k.entries++; if (r.date > k.lastDate) k.lastDate = r.date;
    } else if (r.kind === 'finput' && k) {
      if (r.kind2 === 'seed' || r.type === 'seed') k.seed += Number(r.cost) || 0; else k.fert += Number(r.cost) || 0;
      k.entries++; if (r.date > k.lastDate) k.lastDate = r.date;
    } else if (r.kind === 'harvest' && k) {
      const kg = harvestKg(r);
      k.harvestKg[r.crop] = (k.harvestKg[r.crop] || 0) + kg;
      const u = k.harvestUnits[r.crop] || (k.harvestUnits[r.crop] = {});
      u[r.unit || 'kg'] = (u[r.unit || 'kg'] || 0) + (Number(r.qty) || 0);
      k.entries++; if (r.date > k.lastDate) k.lastDate = r.date;
    }
  }
  Object.values(K).forEach(k => {
    k.total = k.labour + k.machineHire + k.fuelCost + k.seed + k.fert;
    const main = mainCrop(k.kheti);
    k.mainKg = k.harvestKg[main] || 0;
    k.costPerKg = k.mainKg ? k.total / k.mainKg : 0;
    k.age = daysBetween(k.kheti.plantDate, k.kheti.status === 'done' && k.kheti.harvestDate ? k.kheti.harvestDate : today());
    const f = F[k.kheti.fieldId];
    if (f) { f.lifetime += k.total; f.khetis++; }
  });
  Object.values(W).forEach(w => { w.due = round(w.earned - w.paid, 2); });
  Object.values(P).forEach(p => { p.balance = round(p.came - p.went, 2); }); // > 0: we owe them days
  return { K, F, W, P };
}
function harvestText(k, short) {
  const crops = Object.keys(k.harvestUnits);
  if (!crops.length) return '';
  return crops.map(c => `${cropById(c).ne} ${Object.entries(k.harvestUnits[c]).map(([u, q]) => nfmt(round(q, 2)) + ' ' + u).join(' + ')}${short ? '' : ' (' + nfmt(round(k.harvestKg[c])) + ' kg)'}`).join(' · ');
}
