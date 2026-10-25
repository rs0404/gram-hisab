/* Gram Hisab — 🌾 Kheti voice & typed commands (English, romanized Nepali, नेपाली)
   "Purbe khet ropai 6 khetala 3 parma", "Ram Hari pura Sita aadha godmel", "tractor 3 ghanta 1500",
   "pump 2 ghanta diesel 3 litre 450", "DAP 2 bora 9000", "biu 10 kg 1200", "dhaan 20 muri",
   "Ram lai 2000 tirey", "Thapa ghar parma tirne 2 din", "Ram ko hisab", "parma kati baki" */
'use strict';

const K_NE = [
  [/खेतालाहरू|खेतालाहरु|खेताला|खेतला|ज्यामी/g, ' khetala '], [/पर्मा|पर्म/g, ' parma '],
  [/रोपाइँ|रोपाईं|रोपाइ|रोपाई|रोपार|रोपर|रोप्ने|रोपेको|रोप्यो/g, ' ropai '], [/गोडमेल|गोड्ने|गोडेको|गोड्यो|गोडाइ/g, ' godmel '],
  [/गोरु\s*जोत्ने|हलो|हली/g, ' goru '], [/जोताइ|जोत्ने|जोतेको|जोत्यो|जोतनी|जोत्नी/g, ' jotne '], [/बाउसे/g, ' bause '], [/लाठे/g, ' lathe '],
  [/कटनी|काट्ने|कटाइ/g, ' katne '], [/दाइँ|दाईं|दाइ/g, ' dain '], [/सिँचाइ|सिंचाई|सिचाइ|पानी\s*लाउने/g, ' sinchai '], [/आली/g, ' aali '],
  [/ट्र्याक्टर|ट्याक्टर|ट्रयाक्टर|ट्रक्टर/g, ' tractor '], [/टिलर/g, ' tiller '], [/पम्पसेट|पम्प/g, ' pump '], [/थ्रेसर|थ्रेशर/g, ' thresher '], [/हार्भेस्टर/g, ' harvester '],
  [/घण्टा|घन्टा/g, ' ghanta '], [/लिटर|लीटर/g, ' litre '], [/डिजेल|डीजेल/g, ' diesel '], [/पेट्रोल/g, ' petrol '], [/भाडा/g, ' bhada '],
  [/मुरी/g, ' muri '], [/पाथी/g, ' pathi '], [/माना/g, ' mana '], [/क्विन्टल|क्वीन्टल/g, ' quintal '], [/बोरा/g, ' bora '], [/केजी|किलो|के\.जी\.?/g, ' kg '],
  [/बीउ|बिउ|बिऊ/g, ' biu '], [/थुन्से|थुनसे|थुन्सा/g, ' thunse '], [/कुखुराको|कुखुरा/g, ' kukhura '], [/भैंसीको|भैंसी|भैसीको|भैसी/g, ' bhaisi '],
  [/बाख्राको|बाख्रा|बाख्राको/g, ' bakhra '], [/गाईको|गाई|गाइ/g, ' gai '], [/गेडे|गेडा/g, ' gede '], [/युरिया/g, ' urea '], [/डीएपी|डिएपी|डि\s*ए\s*पि/g, ' dap '], [/पोटास|पोटाश/g, ' potash '], [/कम्पोस्ट|गोबर\s*मल|गोबर/g, ' compost '], [/(^|\s)मल(को|लाई|ले)?(?=\s|$)/g, ' mal '],
  [/उत्पादन|फसल|भित्र्याएको|भित्र्यायो|फल्यो|फलेको/g, ' harvest '],
  [/पूरा|पुरा|दिनभरि|दिनभर/g, ' pura '], [/दिन/g, ' din '], [/घर/g, ' ghar '],
  [/तिरें|तिरेँ|तिरे|तिर्यो|तिरेको|दिएँ|दिए|दियो|भुक्तानी/g, ' paid '], [/तिर्ने|तिर्न/g, ' tirne '], [/गएको|गयो|गए|गाको/g, ' gaye '], [/आएको|आयो|आए/g, ' aaye '],
  [/लाई(?=\s|$)/g, ' lai '], [/को(?=\s|$)/g, ' ko '], [/जना/g, ' '], [/हिसाब/g, ' hisab '], [/बाँकी|बाकी|बांकी/g, ' baki '], [/कति/g, ' kati '], [/चुक्ता/g, ' settle '],
  [/सर्भिसिङ|सर्भिसिंग|सर्भिस|सर्विस/g, ' service '], [/मोबिल/g, ' mobil '], [/गियर/g, ' gear '], [/हाइड्रोलिक/g, ' hydraulic '], [/ग्रिज/g, ' grease '],
  [/फिल्टर/g, ' filter '], [/पार्टस्|पार्टस|पार्ट्स/g, ' parts '], [/मिस्त्री/g, ' mechanic '], [/टायर/g, ' tyre '], [/ब्याट्री/g, ' battery '],
  [/आज/g, ' today '], [/हिजो/g, ' yesterday '], [/अस्ति/g, ' day before yesterday '], [/रुपैयाँ|रुपैयां|रुपैया|रु\.?/g, ' rs '], [/आफ्नो|आफ्नै/g, ' own '],
  [/धान/g, ' dhaan '], [/गहुँ|गहु/g, ' gahun '], [/मकै/g, ' makai '], [/कोदो/g, ' kodo '], [/(^|\s)मास(को)?(?=\s|$)/g, ' maas '], [/मसुरो/g, ' masuro '], [/आलु/g, ' aalu '], [/तोरी/g, ' tori '],
  [/केराउ/g, ' kerau '], [/भटमास/g, ' bhatmas '], [/खेत|बारी/g, ' khet ']
];
const K_ROMAN = [
  [/\b(khetalaharu|khetalas|khetalaa|khetla|khetala|jyami|labou?rs?|workers?)\b/g, ' khetala '], [/\b(paarma|perma|parmaa|parma)\b/g, ' parma '],
  [/\b(ropain|ropaai|ropai|ropar|roper|ropne|ropeko|ropyo|planting|transplant(?:ing)?)\b/g, ' ropai '], [/\b(godmel|godne|godeko|godyo|godai|weeding)\b/g, ' godmel '],
  [/\b(halo|hali|ox(?:en)?\s*plough(?:ing)?)\b/g, ' goru '], [/\b(jotai|jotne|joteko|jotyo|jotni|jotnee|ploughing|plowing)\b/g, ' jotne '],
  [/\b(katni|katai|katne|harvesting)\b/g, ' katne '], [/\b(daai|dain|threshing)\b/g, ' dain '], [/\b(sinchai|irrigation)\b/g, ' sinchai '],
  [/\b(tractor|tractar|tyaktor|traktor)\b/g, ' tractor '], [/\b(power\s*tiller|tiller)\b/g, ' tiller '], [/\b(pumpset|pump|motor)\b/g, ' pump '],
  [/\b(thresher|thresar|harvester)\b/g, ' thresher '],
  [/\b(ghanta|ghante|ghantaa|hours?|hrs?)\b/g, ' ghanta '], [/\b(litres?|liters?|ltrs?|ltr)\b/g, ' litre '], [/\b(dijel|dizel|disel)\b/g, ' diesel '],
  [/\b(quintals?|kwintal|kuintal)\b/g, ' quintal '], [/\b(boras?|bags?|sacks?)\b/g, ' bora '], [/\b(muris?)\b/g, ' muri '], [/\b(pathis?)\b/g, ' pathi '], [/\b(manas?)\b/g, ' mana '],
  [/\b(kgs|kilos?|kilograms?|keji)\b/g, ' kg '],
  [/\b(biu|beu|biyu|seeds?)\b/g, ' biu '], [/\b(thunse|thunshe|thunsey|thunsa|basket)\b/g, ' thunse '],
  [/\b(kukhurako|kukhura|kukura|chicken)\b/g, ' kukhura '], [/\b(bhaisiko|bhaisi|bhainsi|bhaishi|buffalo)\b/g, ' bhaisi '], [/\b(bakhrako|bakhra|bakra|goat)\b/g, ' bakhra '],
  [/\b(gaiko|gaai|gai|cow)\b/g, ' gai '], [/\b(gede|gedey|geda)\b/g, ' gede '], [/\b(khad|fertili[sz]ers?|maal)\b/g, ' mal '], [/\b(gobar|compost)\b/g, ' compost '], [/\b(d\s*a\s*p)\b/g, ' dap '], [/\b(yuria|uria)\b/g, ' urea '],
  [/\b(harvest(?:ed)?|utpadan|fasal|bhitryayo|falyo|yield)\b/g, ' harvest '],
  [/\b(pura|puraa|full|fullday|dinbhari)\b/g, ' pura '], [/\b(half|halfday)\b/g, ' halfshift '], [/\b(days?|din)\b/g, ' din '],
  [/\b(tirey|tire|tiren|tiryo|tireko|diye|diyen|diyo|paid|pay|payment|bhuktani)\b/g, ' paid '], [/\b(tirne|tirna)\b/g, ' tirne '], [/\b(gaye|gayo|gako|gaeko|went)\b/g, ' gaye '],
  [/\b(laai|lai)\b/g, ' lai '], [/\b(jana|janaa|people|persons?)\b/g, ' '], [/\b(hisaab|hisab|account|statement)\b/g, ' hisab '], [/\b(baaki|banki|baki|due)\b/g, ' baki '], [/\b(chukta|settle(?:d)?)\b/g, ' settle '],
  [/\b(servicing|service|sarvis|sarbhis)\b/g, ' service '], [/\b(mobil|mobile|engine oil)\b/g, ' mobil '], [/\b(gear oil|gear)\b/g, ' gear '], [/\b(mistri|mechanic)\b/g, ' mechanic '],
  [/\b(aaja|aja|aaj)\b/g, ' today '], [/\bhijo\b/g, ' yesterday '], [/\basti\b/g, ' day before yesterday '], [/\b(aafno|afno|aphno|own)\b/g, ' own '],
  [/\b(rupees?|rupaiya|rupiya|rs|npr)\b/g, ' rs '], [/\b(rice|paddy|dhan|dhaan)\b/g, ' dhaan '], [/\b(wheat|gahu|gahun|gau)\b/g, ' gahun '], [/\b(maize|corn|makai)\b/g, ' makai '],
  [/\b(millet|kodo)\b/g, ' kodo '], [/\b(potato|alu|aalu)\b/g, ' aalu '], [/\b(mustard|tori)\b/g, ' tori '], [/\b(lentil|masuro|musuro)\b/g, ' masuro '], [/\b(pea|peas|kerau)\b/g, ' kerau '],
  [/\b(khetma|khet|field|bari)\b/g, ' khet ']
];
// strong Kheti words: used to send a sentence to the Kheti parser from any section
const KHETI_WORD_RE = /\b(khetala|parma|ropai|godmel|jotne|goru|bause|lathe|tractor|tiller|pump|thresher|ghanta|muri|pathi|mana|quintal|biu|urea|dap|gede|potash|compost|mal|thunse|service|mobil|harvest|khet|dhaan|gahun|makai)\b/;

function kNorm(text) {
  let t = ' ' + cleanNepali(text).toLowerCase() + ' ';
  t = t.replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)));
  // "आधा / aadha" next to a worker = half shift (not 0.5), unless a unit follows
  t = t.replace(/(^|\s)(आधा|aadha|adha|aadhaa)(?!\s*(?:kg|केजी|किलो|bora|बोरा|muri|मुरी|pathi|पाथी|litre|लिटर|ghanta|घण्टा))(?=\s|$)/g, ' halfshift ');
  t = t.replace(/(\d)([a-zऀ-ॿ])/g, '$1 $2');
  t = nepaliNumbers(t);
  K_NE.forEach(([re, rep]) => { t = t.replace(re, rep); });
  t = t.replace(/(\d),(?=\d)/g, '$1').replace(/(\d)\.(\d)/g, '$1§$2').replace(/\./g, ' ').replace(/§/g, '.');
  t = t.replace(/[?!,;:"“”‘’()\[\]_\/-]/g, ' ').replace(/'/g, '');
  K_ROMAN.forEach(([re, rep]) => { t = t.replace(re, rep); });
  t = t.replace(/(\d)([a-z])/g, '$1 $2');
  t = wordsToNumbers(t);
  return (' ' + t + ' ').replace(/\s+/g, ' ');
}
const kWordsOf = s => normName(s).length ? String(s).toLowerCase().split(/\s+/).map(normName).filter(Boolean) : [];
// find names (fields, workers, families) inside the text, longest first; matched words are removed
function kFind(ctx, list, nameOf, tag) {
  const hits = [];
  list.map(x => ({ x, n: nameOf(x) })).filter(o => o.n).sort((a, b) => b.n.length - a.n.length).forEach(o => {
    const variants = [o.n, kNorm(o.n).trim()].map(v => v.toLowerCase().trim()).filter(Boolean);
    for (const v of variants) {
      const re = new RegExp('(^|\\s)' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)');
      if (re.test(ctx.s)) { ctx.s = ctx.s.replace(re, ' __' + (tag || 'x') + String.fromCharCode(97 + hits.length) + '__ '); hits.push(o.x); return; }
    }
  });
  return hits;
}
function kTakeDate(ctx) {
  const t = today();
  let d = null, m;
  if (/\bday before yesterday\b/.test(ctx.s)) { d = addDays(t, -2); ctx.s = ctx.s.replace(/\bday before yesterday\b/, ' '); }
  else if (/\byesterday\b/.test(ctx.s)) { d = addDays(t, -1); ctx.s = ctx.s.replace(/\byesterday\b/, ' '); }
  else if ((m = /\b(\d{1,2}) din (?:agadi|pahile|ago)\b/.exec(ctx.s))) { d = addDays(t, -parseInt(m[1], 10)); ctx.s = ctx.s.replace(m[0], ' '); }
  ctx.s = ctx.s.replace(/\btoday\b/g, ' ');
  return d || t;
}
function kTake(ctx, re) { const m = re.exec(ctx.s); if (m) ctx.s = ctx.s.replace(m[0], ' '); return m; }
const KN = '(\\d+(?:\\.\\d+)?)';
function kMoney(ctx) {
  const m = kTake(ctx, new RegExp('\\brs\\s*' + KN)) || kTake(ctx, new RegExp(KN + '\\s*rs\\b'));
  if (m) return parseFloat(m[1]);
  return null;
}
const K_WORK_WORDS = { goru: 'goru', jotne: 'tractorjot', bause: 'bause', lathe: 'lathe', aali: 'aali', ropai: 'ropai', godmel: 'godmel', sinchai: 'sinchai', katne: 'katne', dain: 'dain' };
const K_FERT = { urea: 'Urea', dap: 'Gede mal (DAP)', gede: 'Gede mal (DAP)', potash: 'Potash', kukhura: 'Kukhura mal', bhaisi: 'Bhaisi mal', bakhra: 'Bakhra mal', gai: 'Gai mal', compost: 'Gai mal' };
const K_ANIMAL_MAL = ['kukhura', 'bhaisi', 'bakhra', 'gai', 'compost']; // only manure when "mal" / thunse / bora is said too
const K_CROP_WORDS = ['dhaan', 'gahun', 'makai', 'kodo', 'maas', 'masuro', 'aalu', 'tori', 'kerau', 'bhatmas'];

function parseKheti(text) {
  const ctx = { s: kNorm(text) }, p = { text };
  // names first (before numbers or words get changed)
  const fieldHits = kFind(ctx, activeFields(), f => String(f.name).toLowerCase(), 'f');
  const workerHits = kFind(ctx, workers(), w => String(w.name).toLowerCase(), 'w');
  const famHits = kFind(ctx, families(), f => String(f).toLowerCase().replace(/\s*ghar$/, ''), 'h');
  ctx.s = ctx.s.replace(/(__h[a-z]__)\s+ghar\b/g, '$1');
  p.date = kTakeDate(ctx);
  p.field = fieldHits[0] || null;
  const s = () => ctx.s;
  const crops = K_CROP_WORDS.filter(c => new RegExp('\\b' + c + '\\b').test(s()));
  p.crop = crops[0] || '';
  p.khetiId = pickKhetiFor(p.field, p.crop);

  // --- questions: "Ram ko hisab", "parma kati baki"
  if (/\bhisab\b|\bkati\b.*\bbaki\b|\bbaki\b.*\bkati\b/.test(s()) && !/\d/.test(s())) {
    if (workerHits[0]) return Object.assign(p, { intent: 'kAccount', workerId: workerHits[0].id });
    if (/\bparma\b/.test(s())) return Object.assign(p, { intent: 'kParmaQuery' });
    return Object.assign(p, { intent: 'kWorkersQuery' });
  }
  // --- payment: "Ram lai 2000 tirey", "paid Ram 2000", "Ram settle"
  if (workerHits.length === 1 && /\b(paid|settle)\b/.test(s()) && !/\bparma\b/.test(s())) {
    const amt = kMoney(ctx) || (s().match(/\d+(?:\.\d+)?/) || [])[0];
    return Object.assign(p, { intent: 'kPay', workerId: workerHits[0].id, amount: amt ? parseFloat(amt) : null, settle: /\bsettle\b/.test(s()) || !amt });
  }
  // --- parma we gave: "Thapa ghar parma tirne 2 din", "parma gaye Thapa 3"
  if (/\bparma\b/.test(s()) && /\b(tirne|gaye)\b/.test(s())) {
    const n = (s().match(/(\d+(?:\.\d+)?)/) || [])[1];
    const half = /\bhalfshift\b/.test(s());
    let fam = famHits[0] || '';
    if (!fam) { const m = /\b([a-z]{3,})\s+ghar\b/.exec(s()); if (m) fam = m[1].charAt(0).toUpperCase() + m[1].slice(1) + ' ghar'; }
    return Object.assign(p, { intent: 'kParmaOut', family: fam, full: half ? 0 : parseFloat(n || 1), half: half ? parseFloat(n || 1) : 0 });
  }
  // --- servicing: "tractor service mobil 1500 gear oil 900 mechanic 500"
  if (/\bservice\b/.test(s()) && typeof myMachines === 'function') {
    const items = [], words = { mobil: 'mobil', gear: 'gear', hydraulic: 'hydraulic', grease: 'grease', filter: 'oilfilter', parts: 'parts', mechanic: 'mechanic', tyre: 'tyre', battery: 'battery' };
    let m2; const re = /\b(mobil|gear|hydraulic|grease|filter|parts|mechanic|tyre|battery)\b(?:\s+oil)?\s*(?:rs\s*)?(\d+(?:\.\d+)?)/g;
    while ((m2 = re.exec(s()))) items.push({ item: words[m2[1]], qty: '', cost: parseFloat(m2[2]) });
    const t = /\btiller\b/.test(s()) ? 'powerTiller' : /\bpump\b/.test(s()) ? 'pump' : /\btractor\b/.test(s()) ? 'ownTractor' : '';
    const own = myMachines().filter(x => x.active !== false), named = own.find(x => s().includes(' ' + String(x.name).toLowerCase() + ' '));
    const mach = named || (t ? own.filter(x => x.type === t)[0] : own.length === 1 ? own[0] : null);
    return Object.assign(p, { intent: 'kService', machineId: mach ? mach.id : '', items });
  }
  // --- machine
  const mm = /\b(tractor|tiller|pump|thresher)\b/.exec(s());
  if (mm && !/\bkhetala\b/.test(s())) {
    const own = /\bown\b/.test(s());
    p.type = mm[1] === 'tractor' ? (own ? 'ownTractor' : 'hiredTractor') : mm[1] === 'tiller' ? 'powerTiller' : mm[1];
    const fuel = /\bdiesel\b/.test(s()) ? 'diesel' : /\bpetrol\b/.test(s()) ? 'petrol' : '';
    const hrs = kTake(ctx, new RegExp(KN + '\\s*ghanta\\b'));
    const lit = kTake(ctx, new RegExp(KN + '\\s*litre\\b'));
    ctx.s = ctx.s.replace(/\b(tractor|tiller|pump|thresher|own|diesel|petrol|bhada|jotne)\b/g, ' ');
    let money = kMoney(ctx);
    const rest = (s().match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
    if (money == null && rest.length) money = rest.shift();
    const fuelMoney = rest.length ? rest.shift() : null;
    Object.assign(p, { intent: 'kMachine', hours: hrs ? parseFloat(hrs[1]) : 0, fuel: lit || fuel ? (fuel || 'diesel') : '', litres: lit ? parseFloat(lit[1]) : 0 });
    if (MACHINES[p.type].hired) { p.hireAmount = money || 0; p.fuelCost = fuelMoney || 0; }
    else { p.hireAmount = 0; p.fuelCost = money || 0; p.ratePerHour = ownMachineRate(p.type); p.myRate = myTimeRate(); }
    return p;
  }
  // --- harvest: "dhaan 20 muri", "harvest 5 quintal gahun"
  const hu = new RegExp(KN + '\\s*(muri|pathi|mana|quintal|kg|bora)\\b').exec(s());
  if (hu && (/\bharvest\b/.test(s()) || /\b(muri|pathi|mana|quintal)\b/.test(s())) && !/\brs\b/.test(s()) && !/\b(biu|mal|urea|dap|gede|potash|compost|thunse)\b/.test(s())) {
    return Object.assign(p, { intent: 'kHarvest', qty: parseFloat(hu[1]), unit: hu[2] });
  }
  // --- seed / fertilizer: "DAP 2 bora 9000", "biu 10 kg 1200", "mal 3 bora"
  const manureCtx = /\b(mal|thunse|bora)\b/.test(s());
  const fert = Object.keys(K_FERT).find(f => new RegExp('\\b' + f + '\\b').test(s()) && (!K_ANIMAL_MAL.includes(f) || manureCtx));
  if (fert || /\b(biu|mal)\b/.test(s())) {
    const isSeed = !fert && /\bbiu\b/.test(s());
    const q = kTake(ctx, new RegExp(KN + '\\s*(kg|bora|packet|thunse|mana|pathi)\\b'));
    let money = kMoney(ctx);
    const rest = (s().match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
    if (money == null && rest.length) money = rest.pop();
    return Object.assign(p, { intent: 'kInput', type: isSeed ? 'seed' : 'fert', item: isSeed ? (p.crop ? cropById(p.crop).en + ' seed' : 'Seed') : fert ? K_FERT[fert] : 'Other',
      qty: q ? parseFloat(q[1]) : 0, unit: q ? q[2] : (isSeed ? 'kg' : 'bora'), cost: money || 0 });
  }
  // --- work day: work type, named workers (pura / halfshift), "6 khetala", "2 halfshift khetala", "3 parma Thapa"
  const wt = Object.keys(K_WORK_WORDS).find(w => new RegExp('\\b' + w + '\\b').test(s()));
  const hasWorkers = workerHits.length || /\b(khetala|parma)\b/.test(s());
  if (wt || hasWorkers) {
    p.intent = 'kWork';
    p.workType = wt ? K_WORK_WORDS[wt] : '';
    if (wt === 'jotne' && /\bgoru\b/.test(s())) p.workType = 'goru';
    // shift word right after each worker name: "Ram pura Sita halfshift"
    p.workers = workerHits.map((w, i) => {
      const re = new RegExp('(__w' + String.fromCharCode(97 + i) + '__)\\s+(halfshift|pura)\\b'), m = re.exec(s());
      if (m) ctx.s = ctx.s.replace(re, '$1'); // the shift word belongs to this worker, not to a count after it
      return { workerId: w.id, shift: m && m[2] === 'halfshift' ? 'half' : 'full' };
    });
    let m;
    p.extraFull = 0; p.extraHalf = 0; p.parma = [];
    const halfK = new RegExp('(?:halfshift\\s+' + KN + '|' + KN + '\\s+halfshift)\\s*khetala\\b|' + KN + '\\s*khetala\\s+halfshift\\b');
    if ((m = kTake(ctx, halfK))) p.extraHalf = parseFloat(m[1] || m[2] || m[3]);
    if ((m = kTake(ctx, new RegExp(KN + '\\s*(?:jana\\s+)?khetala\\b')))) p.extraFull = parseFloat(m[1]);
    if ((m = kTake(ctx, new RegExp(KN + '\\s*(?:jana\\s+)?parma\\b|\\bparma\\s*' + KN)))) {
      const n = parseFloat(m[1] || m[2]);
      let fam = famHits[0] || '';
      if (!fam) { const g = /\b([a-z]{3,})\s+ghar\b/.exec(s()); if (g) fam = g[1].charAt(0).toUpperCase() + g[1].slice(1) + ' ghar'; }
      p.parma.push({ family: fam, full: n, half: 0 });
    }
    const amt = kMoney(ctx);
    if (amt) p.rate = amt;
    return p;
  }
  return null;
}
// which crop cycle the sentence is about
function pickKhetiFor(field, crop) {
  const act = activeKhetis();
  if (field) { const k = currentKheti(field.id); if (k) return k.id; }
  if (crop) { const hit = act.filter(k => (k.crops || []).some(c => c.crop === crop)); if (hit.length === 1) return hit[0].id; }
  if (act.length === 1) return act[0].id;
  return '';
}
function khetiLikely(text) { return KHETI_WORD_RE.test(kNorm(text)) || activeFields().some(f => kNorm(text).includes(' ' + String(f.name).toLowerCase() + ' ')); }

// ---------- run a parsed Kheti command ----------
function flowKheti(p, v) {
  const needKheti = ['kWork', 'kMachine', 'kInput', 'kHarvest'].includes(p.intent);
  if (needKheti && !khetiById(p.khetiId)) {
    const act = activeKhetis();
    if (!act.length) { info('No kheti yet', '<p>Add a field and start a kheti first: 🌾 Kheti → + Field → 🌱 Start new kheti.</p>', 'First add a field and start a kheti.', v); return; }
    ask({ title: 'Which kheti?', sub: p.text ? `Heard: “${p.text}”` : '', speech: 'Which field?', hint: 'Say the field name',
      buttons: act.map(k => ({ label: esc(khetiTitle(k)), value: k.id, cls: 'ghost' })),
      voice: t => { const c = { s: kNorm(t) }; const f = kFind(c, activeFields(), x => String(x.name).toLowerCase())[0]; return f && currentKheti(f.id) ? currentKheti(f.id).id : undefined; },
      voiceMode: v, onAnswer: id => { p.khetiId = id; if (p.intent === 'kHarvest' && !p.crop) p.crop = mainCrop(khetiById(id)); flowKheti(p, v); } });
    return;
  }
  const k = khetiById(p.khetiId);
  const base = k ? { khetiId: k.id, fieldId: k.fieldId, date: p.date || today() } : { date: p.date || today() };
  let rec, lines = [], speech = '', editForm = null;
  switch (p.intent) {
    case 'kService':
      openServiceForm({ machineId: p.machineId, date: p.date || today(), items: p.items.length ? p.items : [{ item: 'mobil', qty: '', cost: '' }] }, p.machineId);
      if (v) speak(p.items.length ? `Servicing, ${sayMoney(p.items.reduce((a, i) => a + i.cost, 0))}. Check and save.` : 'Servicing. Add the items and save.');
      return;
    case 'kAccount': openWorkerAccount(p.workerId); if (v) { const x = computeKheti().W[p.workerId]; speak(`${x.worker.name}: earned ${sayMoney(x.earned)}, paid ${sayMoney(x.paid)}, due ${sayMoney(x.due)}.`); } return;
    case 'kParmaQuery': case 'kWorkersQuery': {
      closeSheet(); go('workers');
      if (v) { const P = Object.values(computeKheti().P).filter(x => x.balance); speak(P.length ? P.map(x => x.balance > 0 ? `We owe ${x.family} ${nfmt(x.balance)} days` : `${x.family} owes us ${nfmt(-x.balance)} days`).join('. ') : 'No parma balance.'); }
      return;
    }
    case 'kPay': {
      const w = workerById(p.workerId), due = computeKheti().W[p.workerId].due;
      const amt = p.amount || (p.settle ? due : 0);
      if (!(amt > 0)) { openPayForm(p.workerId); return; }
      rec = { kind: 'fpay', workerId: w.id, date: p.date || today(), amount: round(amt, 2), method: 'cash', note: amt === due ? 'Settled' : '' };
      lines = [['👷 Worker', workerLabel(w)], ['💵 Paid', money(rec.amount)], ['Due after', money(due - rec.amount)]];
      speech = `Paid ${w.name} ${sayMoney(rec.amount)}. Save?`;
      break;
    }
    case 'kParmaOut':
      if (!p.family) { openParmaOutForm({ date: p.date, full: p.full, half: p.half }); return; }
      rec = { kind: 'parmaout', date: p.date || today(), family: p.family, full: p.full || 0, half: p.half || 0, note: '' };
      lines = [['🤝 Parma for', rec.family], ['Days', nfmt(rec.full + rec.half * 0.5)]];
      speech = `We worked ${nfmt(rec.full + rec.half * 0.5)} days of parma for ${rec.family}. Save?`;
      editForm = () => openParmaOutForm(rec);
      break;
    case 'kMachine': {
      const m = MACHINES[p.type];
      const rph = m.hired ? (p.hours && p.hireAmount ? round(p.hireAmount / p.hours, 2) : 0) : (p.ratePerHour || 0);
      rec = Object.assign({ kind: 'machine', type: p.type, hours: p.hours || 0, ratePerHour: rph, hireAmount: p.hireAmount || 0, ownValue: m.hired ? 0 : round((p.hours || 0) * rph, 2), myHours: m.hired ? 0 : p.hours || 0, myRate: m.hired ? 0 : p.myRate || 0, myValue: m.hired ? 0 : round((p.hours || 0) * (p.myRate || 0), 2), fuel: p.fuel, litres: p.litres || 0, fuelCost: p.fuelCost || 0, note: '' }, base);
      lines = [['🌾 Kheti', khetiTitle(k)], [m.icon + ' Machine', m.en], ['Hours', nfmt(rec.hours)]];
      if (m.hired) lines.push(['Hire', money(rec.hireAmount)]);
      if (rec.fuel) lines.push(['⛽ ' + rec.fuel, `${nfmt(rec.litres)} L · ${money(rec.fuelCost)}`]);
      if (!m.hired) lines.push(['🚜 Own machine value', rph ? `${money(rec.ownValue)} (${money(rph)}/hr)` : 'set the rate in the form (✎ Edit)']);
      if (!m.hired && rec.myValue) lines.push(['🧑 My time', `${money(rec.myValue)} (${money(rec.myRate)}/hr)`]);
      speech = `${m.en}, ${nfmt(rec.hours)} hours, ${sayMoney(rec.hireAmount + rec.fuelCost)}. Save?`;
      editForm = () => openMachineForm(rec);
      break;
    }
    case 'kInput':
      rec = Object.assign({ kind: 'finput', type: p.type, item: p.item, qty: p.qty || 0, unit: p.unit || 'kg', cost: p.cost || 0, note: '' }, base);
      lines = [['🌾 Kheti', khetiTitle(k)], [p.type === 'seed' ? '🌱 Seed' : '🧪 Fertilizer', rec.item], ['Quantity', rec.qty ? nfmt(rec.qty) + ' ' + rec.unit : '—'], ['Cost', money(rec.cost)]];
      speech = `${rec.item}${rec.qty ? ', ' + nfmt(rec.qty) + ' ' + rec.unit : ''}, ${sayMoney(rec.cost)}. Save?`;
      editForm = () => openInputForm(rec);
      break;
    case 'kHarvest': {
      const crop = p.crop && (k.crops || []).some(c => c.crop === p.crop) ? p.crop : mainCrop(k);
      rec = Object.assign({ kind: 'harvest', crop, qty: p.qty, unit: p.unit, note: '' }, base);
      rec.kg = round(harvestKg(rec), 2);
      lines = [['🌾 Kheti', khetiTitle(k)], ['Crop', cropName(crop)], ['Harvest', `${nfmt(rec.qty)} ${rec.unit} (≈ ${nfmt(round(rec.kg))} kg)`]];
      speech = `Harvest ${cropById(crop).en}, ${nfmt(rec.qty)} ${rec.unit}. Save?`;
      editForm = () => openHarvestForm(rec);
      break;
    }
    case 'kWork': {
      const wt = p.workType || (db.meta.kQuick && db.meta.kQuick.work) || 'other';
      const rf = p.rate || wageRate(wt, 'full'), rh = wageRate(wt, 'half') || (p.rate ? p.rate / 2 : 0);
      rec = Object.assign({ kind: 'fwork', workType: wt, workers: (p.workers || []).map(w => ({ workerId: w.workerId, shift: w.shift, rate: w.shift === 'half' ? rh : rf })),
        extraFull: p.extraFull || 0, extraHalf: p.extraHalf || 0, rateFull: rf, rateHalf: rh, parma: p.parma || [], note: '' }, base);
      rec.amount = fworkAmount(rec);
      if (!rec.workers.length && !rec.extraFull && !rec.extraHalf && !rec.parma.length) { openWorkForm(rec); return; }
      lines = [['🌾 Kheti', khetiTitle(k)], ['Work', workById(wt).ne + ' · ' + workById(wt).en]];
      if (rec.workers.length) lines.push(['👷 By name', rec.workers.map(w => (workerById(w.workerId) || {}).name + (w.shift === 'half' ? ' (½)' : '')).join(', ')]);
      if (rec.extraFull || rec.extraHalf) lines.push(['👷 Khetala', `${rec.extraFull} full${rec.extraHalf ? ' · ' + rec.extraHalf + ' half' : ''}`]);
      if (rec.parma.length) lines.push(['🤝 Parma', rec.parma.map(x => `${x.family || '—'} ${nfmt(x.full)}`).join(', ')]);
      lines.push(['Wages', money(rec.amount) + (rf ? '' : ' — rate not set')]);
      speech = `${workById(wt).en}. ${rec.workers.length + rec.extraFull + rec.extraHalf} khetala${rec.parma.length ? ', ' + rec.parma.reduce((a, x) => a + x.full, 0) + ' parma' : ''}. Wages ${sayMoney(rec.amount)}. Save?`;
      editForm = () => openWorkForm(rec);
      break;
    }
    default: return;
  }
  const save = () => {
    put(rec); render();
    toast(`Saved ✓ ${khetiRecSummary(rec)}`, rec.id);
    if (v) speak('Saved.');
  };
  if (!db.meta.confirmVoice && v !== false && p.intent !== 'kWork') return save();
  ask({ title: 'Save?', sub: p.text ? `Heard: “${p.text}”` : '',
    html: `<div class="summary">${[['Date', fmtDate(rec.date, true)]].concat(lines).map(([a, b]) => `<div class="line"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>`,
    speech, buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }].concat(editForm ? [{ label: '✎ Edit', value: 'edit' }] : []).concat([{ label: '✕ Cancel', value: 'no', cls: 'redl' }]),
    voice: yesNo, voiceMode: v,
    onAnswer: a => { if (a === 'yes') save(); else if (a === 'edit' && editForm) editForm(); else toast('Cancelled — nothing saved'); } });
}
