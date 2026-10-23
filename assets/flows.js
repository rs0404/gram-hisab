/* Gram Hisab — conversation flows (ask → answer by voice or tap → save → speak back) */
'use strict';

let pendingAsk = null;

/* ask({title, sub, html, speech, buttons:[{label,value,cls}], voice: fn(text)->value, hint, input:{placeholder, decimal},
        onAnswer(value), onCancel(), voiceMode}) */
function ask(o) {
  pendingAsk = o;
  o.hint = o.hint || 'Say “yes” or “no”';
  const inputHtml = o.input ? `<div class="field">${o.input.text ? `<input id="askInput" type="text" autocomplete="off" placeholder="${esc(o.input.placeholder || '')}">` : `<input id="askInput" ${calcAttrs()} placeholder="${esc(o.input.placeholder || '')}">`}</div>
      <button class="btn big green" data-act="askInputOk">OK</button><div style="height:10px"></div>` : '';
  openSheet(`<div class="ask">${esc(o.title)}</div>${o.sub ? `<div class="heard">${esc(o.sub)}</div>` : ''}${o.html || ''}${inputHtml}
    <div class="choice">${(o.buttons || []).map((b, i) => `<button class="btn big ${b.cls || 'ghost'}" data-act="askBtn" data-i="${i}">${b.label}</button>`).join('')}</div>
    ${o.voiceMode ? `<div class="row" style="justify-content:center;margin-top:14px"><button class="btn ghost sm" data-act="mic">🎤 Answer by voice</button></div>` : ''}`, true);
  if (o.input) setTimeout(() => { const el = $('#askInput'); if (el && !o.voiceMode) el.focus(); }, 200);
  if (o.voiceMode && !o.silent) speak(o.speech || o.title, () => { if (pendingAsk === o && db.meta.autoListen) listen(); });
}
function resolveAsk(v) {
  const o = pendingAsk;
  if (!o) return;
  pendingAsk = null;
  closeSheet(true);
  o.onAnswer(v);
}
function cancelAsk() {
  const o = pendingAsk;
  pendingAsk = null;
  if (o && o.onCancel) o.onCancel();
}
function info(title, html, speech, voiceMode) {
  pendingAsk = null;
  openSheet(`<div class="ask">${esc(title)}</div>${html}<button class="btn big primary" data-act="closeSheet">OK</button>`);
  if (voiceMode) speak(speech);
}

function handleInput(alts, origin) {
  const voiceMode = origin === 'voice';
  if (pendingAsk) {
    const o = pendingAsk;
    for (const a of alts) {
      const v = o.voice ? o.voice(a) : undefined;
      if (v !== undefined && v !== null) { resolveAsk(v); return; }
    }
    const p = parseCommand(alts[0]);
    if (p.intent !== 'unknown' && !['yes', 'no'].includes(alts[0].trim().toLowerCase())) {
      pendingAsk = null; closeSheet(true);
      runCommand(p, voiceMode);
      return;
    }
    o.retries = (o.retries || 0) + 1;
    toast(`Heard “${alts[0]}”. ${o.hint}`);
    if (voiceMode && o.retries <= 2) speak('Sorry. ' + o.hint.replace(/[“”]/g, ''), () => { if (pendingAsk === o && db.meta.autoListen) listen(); });
    return;
  }
  // On the Shop page, amounts without farm words are shop entries ("cash 5000 qr 3000", "नगद ५०००")
  if (typeof view !== 'undefined' && view === 'shop')
    alts = alts.map(a => /\b(kg|kilo|lot|dead|died|feed|dana|chicken|kukhura|masu|live|sold|bought)\b|केजी|किलो|कुखुरा|मासु|मरे|दाना|बेच/i.test(a) ? a : 'shop ' + a);
  // "patro", "calendar", "पात्रो" → the Nepali calendar
  if (alts.some(a => /^\s*(?:(?:aaja|aja|today|आज)\s*(?:ko)?\s*)?(?:patro|patra|calendar|calender|पात्रो|पत्रो|miti|मिति)(?:\s+(?:kholnu(?:s|hos)?|khola|open|show|dekhau))?\s*$/i.test(a))) { openCalendar(); if (voiceMode) { const b = adToBs(today()); speak(`Today is ${BS_MONTHS[b.m - 1]} ${b.d}, ${b.y}.`); } return; }
  // Kheti words (or the Kheti section): try the Kheti parser first
  if (typeof parseKheti === 'function' && ((typeof section !== 'undefined' && section === 'kheti') || (view !== 'shop' && alts.some(khetiLikely)))) {
    for (const a of alts) { const kp = parseKheti(a); if (kp) { flowKheti(kp, voiceMode); return; } }
  }
  let best = null;
  for (const a of alts) { const p = parseCommand(a); if (p.intent !== 'unknown') { best = p; break; } }
  if (!best) {
    info("Sorry, I didn't understand", `<div class="heard">I heard: “${esc(alts[0])}”</div>${helpHtml(true)}`, "Sorry, I didn't understand. Try saying, sold 2 kilo meat.", voiceMode);
    return;
  }
  runCommand(best, voiceMode);
}

function runCommand(p, v) {
  switch (p.intent) {
    case 'sale': return flowSale(p, v);
    case 'purchase': return flowPurchase(p, v);
    case 'grainsale': return flowGrainSale(p, v);
    case 'shop': return flowShop(p, v);
    case 'queryShop': goShop(); if (v) sayShop(v); return;
    case 'dead': case 'cut': case 'feed': case 'medicine': case 'vitamin': case 'vaccine': case 'weight': case 'expense': case 'note':
      return flowEvent(p.intent, p, v);
    case 'newlot': return flowNewLot(p, v);
    case 'restock': return flowRestock(p, v);
    case 'setprice': return flowSetPrice(p, v);
    case 'stockcount': return withLot(p, v, lot => withBreed(lot, p, v, b => stockCheck(lot, p.count, v, b), 'type did you count'), 'Which lot did you count?');
    case 'queryLeft': return sayLeft(p, v);
    case 'querySummary': return saySummary(p, v);
    case 'queryPrice': return sayPrice(v);
    case 'queryStock': return sayStock(p, v);
    case 'report': {
      const per = p.period === 'week' || p.period === 'today' ? 'month' : p.period || 'month';
      goReport('profit', per);
      if (v) { const [from, to, label] = periodRange(per); const fr = farmReport(from, to);
        speak(`${label}. Sales ${sayMoney(fr.sales)}. Costs ${sayMoney(fr.costs)}. ${fr.profit >= 0 ? 'Profit' : 'Loss'} ${sayMoney(Math.abs(fr.profit))}.`); }
      return;
    }
    case 'undo': return flowUndo(v);
    case 'help': return info('Voice commands', helpHtml(), 'Here are some things you can say.', v);
  }
}
const oneLot = lot => [{ ids: [lot.id], label: lot.name }];

function withLot(p, v, cb, question) {
  const act = activeLots();
  const ref = p.lotRefs && p.lotRefs[0];
  if (ref) {
    const list = ref.ids.map(lotById).filter(Boolean);
    if (list.length === 1) return cb(list[0]);
    if (list.length > 1) return chooseLot(question || 'Which lot?', v, cb, list);
    if (act.length) return chooseLot(`I can't find ${ref.label || 'that lot'}. Which lot?`, v, cb);
  }
  if (p.breed) {
    const bl = act.filter(l => lotBreeds(l).includes(p.breed));
    if (bl.length === 1) return cb(bl[0]);
    if (bl.length > 1) return chooseLot(question || `Which ${breedName(p.breed)} lot?`, v, cb, bl);
  }
  if (act.length === 1) return cb(act[0]);
  if (!act.length) {
    ask({ title: 'No active lot yet', sub: 'Add a lot of chicks first.', speech: 'There is no active lot. Please add a lot first.',
      buttons: [{ label: '🐣 Add new lot', value: 'add', cls: 'primary' }, { label: 'Cancel', value: 'no' }], voiceMode: v, voice: yesNo,
      onAnswer: a => { if (a === 'add' || a === 'yes') openLotForm(); } });
    return;
  }
  chooseLot(question || 'Which lot?', v, cb);
}
function chooseLot(title, v, cb, list) {
  list = list || activeLots();
  const st = computeStats();
  ask({
    title, speech: title + ' ' + list.map((l, i) => `${i + 1}, ${lotSpeak(l)} ${breedName(l.breed)}`).join('. '),
    hint: 'Say the number, like “1”, or the month, like “' + lotSpeak(list[0]) + '”',
    buttons: list.map((l, i) => ({ label: `${i + 1}. ${esc(l.name)} <span class="small muted">· ${esc(mixLabel(l))} · ${st[l.id].remaining} left</span>`, value: l.id, cls: 'ghost' })),
    voice: t => lotAnswer(t, list), voiceMode: v, onAnswer: id => cb(lotById(id))
  });
}
const typeLabel = t => t === 'live' ? 'Live' : 'Meat';
// In a lot with several chicken types, find out which one.
function withBreed(lot, p, v, cb, verb) {
  const bs = lotBreeds(lot);
  if (bs.length === 1) return cb(bs[0]);
  if (p.breed && bs.includes(p.breed)) return cb(p.breed);
  const st = lotStats(lot.id);
  ask({ title: `Which chicken${verb ? ' ' + verb : ''}?`, speech: `Which type? ${bs.map(b => breedName(b)).join(' or ')}?`,
    hint: 'Say ' + bs.map(b => '“' + breedName(b) + '”').join(' or '),
    buttons: bs.map(b => ({ label: `🐔 ${esc(breedName(b))} <span class="small muted">· ${st.byBreed[b].remaining} left</span>`, value: b, cls: 'ghost' })),
    voice: t => { const x = breedAnswer(t); return x && bs.includes(x) ? x : undefined; }, voiceMode: v, onAnswer: b => { p.breed = b; cb(b); } });
}
const lotBreed = l => (l && l.breed) || 'broiler';

// ---------- sale ----------
function flowSale(p, v) {
  withLot(p, v, lot => {
    p.lotRefs = oneLot(lot);
    if (p.type === 'parts') return flowSaleBreed(p, v, lot, lotBreeds(lot)[0]);
    withBreed(lot, p, v, breed => flowSaleBreed(p, v, lot, breed), 'type was sold');
  }, 'Which lot did you sell from?');
}
function flowSaleBreed(p, v, lot, breed) {
  {
    const type = p.type || getSet('defaultType') || 'meat';
    if (p.kg == null && p.amount == null) {
      ask({ title: `How many kg (${typeLabel(type).toLowerCase()})?`, speech: 'How many kilo?', hint: 'Say the kilo, like “2 kg”',
        input: { placeholder: 'kg', decimal: true }, voice: numberAnswer, voiceMode: v,
        onAnswer: kg => { p.kg = kg; flowSale(p, v); } });
      return;
    }
    const def = priceFor(type, breed);
    let rate = p.rate, amount = p.amount;
    const told = p.rate != null || (p.amount != null && p.kg != null);
    let kg = p.kg != null ? p.kg : null, kgEst = false;
    if (rate == null && amount != null && kg) rate = round(amount / kg, 2);
    if (rate == null) rate = def;
    if (kg == null && amount != null && rate) { kg = round(amount / rate, 2); kgEst = true; } // only the amount was said
    if (!rate && amount == null) {
      ask({ title: `${breedName(breed)} ${typeLabel(type).toLowerCase()} price per kg?`, sub: 'No default price is set yet for this chicken type.',
        speech: `What is the ${breedName(breed)} ${type} price per kilo?`,
        hint: 'Say the price, like “450”', input: { placeholder: 'Rs per kg' }, voice: numberAnswer, voiceMode: v,
        onAnswer: r => { p.rate = r; p.type = type; flowSale(p, v); } });
      return;
    }
    if (amount == null) amount = round((kg || 0) * rate, 2);
    const sale = { kind: 'sale', date: p.date || today(), lotId: lot.id, breed, type, kg: kg || 0, birds: p.birds != null ? p.birds : null, rate, amount,
      invoice: p.invoice || '', flag: !!p.flag, note: '', heard: p.text || '' };
    if (kgEst) sale.kgEst = true;
    if (type === 'parts') sale.birds = 0;
    else if (sale.birds == null) { sale.birds = saleBirdEstimate(sale).birds; sale.birdsEst = true; }
    if (db.meta.confirmVoice) confirmSale(sale, told, v);
    else saveSale(sale, told, v);
  }
}
// live: birds sold estimated from kg ÷ kg per bird; meat: chickens to cut, after using meat already in stock
function saleBirdEstimate(sale) {
  const lot = lotById(sale.lotId);
  if (!lot || !sale.kg) return { birds: 0, note: '' };
  if (sale.type === 'live') {
    const e = estLiveBirds(sale.kg, lot, sale.breed, sale.date);
    return { birds: e.birds, note: `≈ ${nfmt(e.est.kg)} kg per bird (from ${e.est.source})` };
  }
  const e = estMeatCut(sale.kg, lot, sale.breed, sale.date);
  return { birds: e.birds, note: `Cut meat in stock: ${kgs(e.stock)} · 1 chicken ≈ ${kgs(e.perBird)} meat (${e.est.source})`, perBird: e.perBird };
}

function saleSummaryHtml(sale) {
  const def = priceFor(sale.type, sale.breed);
  return `<div class="summary">
    <div class="line"><span>Type</span><b>${sale.type === 'live' ? '🐔 Live · ' + esc(breedName(sale.breed)) : sale.type === 'parts' ? '🍗 Khutta-tauko' : '🔪 Meat · ' + esc(breedName(sale.breed))}</b></div>
    <div class="line"><span>Lot</span><b>${esc(lotName(sale.lotId))}</b></div>
    <div class="line"><span>Date</span><b>${fmtDate(sale.date, true)}</b></div>
    <div class="line"><span>Weight</span><b>${sale.kgEst ? '≈ ' : ''}${kgs(sale.kg)}${sale.kgEst ? ' <span class="pill amber">from amount ÷ rate</span>' : ''}</b></div>
    ${sale.type === 'parts' ? '' : saleBirdsRow(sale)}
    <div class="line"><span>Rate</span><b>${money(sale.rate)}/kg ${def && round(def) !== round(sale.rate) ? `<span class="pill amber">default ${money(def)}</span>` : ''}</b></div>
    ${sale.invoice ? `<div class="line"><span>Invoice</span><b>${esc(sale.invoice)}</b></div>` : ''}
    ${sale.flag ? `<div class="line"><span>Flag</span><b class="flagmark">⚑ Credit / check later</b></div>` : ''}
    <div class="line"><span>Total</span><b style="font-size:26px;color:var(--green)">${money(sale.amount)}</b></div>
  </div>`;
}
function saleBirdsRow(sale) {
  const est = saleBirdEstimate(sale);
  const lot = lotById(sale.lotId), st = lot ? lotStats(lot.id) : null, left = st && st.byBreed[sale.breed] ? st.byBreed[sale.breed].remaining : null;
  const over = left != null && sale.birds > left;
  return `<div class="line" style="align-items:center"><span>${sale.type === 'live' ? '🐔 Birds sold' : '🔪 Chickens cut now'}</span>
      <span class="row" style="gap:6px"><button class="btn sm ghost" data-act="saleBirds" data-d="-1">−</button><b style="font-size:24px;min-width:30px;text-align:center">${sale.birds || 0}</b><button class="btn sm ghost" data-act="saleBirds" data-d="1">+</button></span></div>
    ${sale.type === 'meat' ? `<div class="chips" style="padding:6px 0">${[0, 1, 2, 3, 4].map(n => `<button class="chip sm ${Number(sale.birds) === n ? 'on' : ''}" data-act="saleBirdsSet" data-n="${n}">${n}</button>`).join('')}</div>` : ''}
    <div class="small muted" style="padding:2px 0 6px">${sale.birdsEst ? 'Estimated — change if different. ' : ''}${esc(est.note)}${left != null ? ` · ${esc(breedName(sale.breed))} left now: ${left}` : ''}${over ? ' <b class="flagmark">⚠ more than left!</b>' : ''}</div>`;
}
let curSaleCtx = null;
function confirmSale(sale, told, v, silent) {
  curSaleCtx = { sale, told, v };
  ask({ silent,
    title: 'Save this sale?', sub: sale.heard ? `Heard: “${sale.heard}”` : '', html: saleSummaryHtml(sale),
    speech: `${sale.type === 'parts' ? 'Khutta tauko' : breedName(sale.breed) + ' ' + sale.type}. ${sayKg(sale.kg)} from ${lotSpeak(lotById(sale.lotId))}, total ${sayMoney(sale.amount)}. Save?`,
    hint: 'Say “yes”, “no”, or a number of chickens',
    buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }].concat(sale.type === 'parts' ? [] : [{ label: `Switch to ${sale.type === 'live' ? 'Meat' : 'Live'}`, value: 'switch' }]).concat([
      { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }]),
    voice: t => { const s = normalize(t).s; const st = saleType(s); if (st && st !== sale.type && !/\b(yes|save)\b/.test(s)) return 'switch';
      const yn = yesNo(t); if (yn) return yn; const n = numberAnswer(t); return n != null && n <= 50 ? 'birds:' + Math.round(n) : undefined; },
    voiceMode: v,
    onAnswer: a => {
      if (String(a).startsWith('birds:')) { sale.birds = Number(a.slice(6)); sale.birdsEst = false; confirmSale(sale, told, v, true); if (v) speak(`${sale.birds} ${sale.type === 'live' ? 'birds' : 'chickens cut'}. Save?`, () => { if (pendingAsk && db.meta.autoListen) listen(); }); return; }
      if (a === 'yes') saveSale(sale, told, v);
      else if (a === 'edit') goSell(sale);
      else if (a === 'switch') {
        sale.type = sale.type === 'live' ? 'meat' : 'live';
        if (!told) { sale.rate = priceFor(sale.type, sale.breed) || sale.rate; if (sale.kgEst) sale.kg = round(sale.amount / sale.rate, 2); else sale.amount = round(sale.kg * sale.rate, 2); }
        if (sale.birdsEst) sale.birds = saleBirdEstimate(sale).birds;
        confirmSale(sale, told, v);
      } else toast('Cancelled — nothing saved');
    }
  });
}

function saveSale(sale, told, v) {
  const isNew = !sale.id;
  sale.birds = Number(sale.birds) || 0;
  if (sale.type === 'meat' && sale.birds) { const lot = lotById(sale.lotId); sale.cutKg = round(sale.birds * estBirdKg(lot, sale.breed, sale.date, sale.id).kg * dressYield(), 2); }
  else delete sale.cutKg;
  put(sale);
  render();
  const def = priceFor(sale.type, sale.breed);
  const finish = () => announceSale(sale, v, isNew);
  if (told && sale.rate > 0 && round(sale.rate) !== round(def)) {
    const what = sale.type === 'parts' ? 'khutta-tauko' : `${breedName(sale.breed)} ${sale.type}`;
    ask({
      title: def ? `Change default ${what} price?` : `Set default ${what} price?`,
      html: `<div class="summary"><div class="line"><span>Current default</span><b>${def ? money(def) + '/kg' : 'not set'}</b></div>
             <div class="line"><span>This sale</span><b>${money(sale.rate)}/kg</b></div></div>`,
      speech: def ? `Your default ${what} price is ${sayMoney(def)}. You sold at ${sayMoney(sale.rate)}. Make ${sayMoney(sale.rate)} the new default?`
        : `Save ${sayMoney(sale.rate)} as your default ${what} price?`,
      buttons: [{ label: `Yes, set ${money(sale.rate)}/kg`, value: 'yes', cls: 'primary' }, { label: def ? `No, keep ${money(def)}/kg` : 'No', value: 'no' }],
      voice: yesNo, voiceMode: v,
      onAnswer: a => { if (a === 'yes') { if (sale.type === 'parts') setSet('partsPrice', round(sale.rate)); else setBreedPrice(sale.breed, sale.type, sale.rate); render(); } finish(); },
      onCancel: finish
    });
  } else finish();
}

function lowNote(lot, breed) {
  const s = lotStats(lot.id);
  const low = Number(getSet('lowStock')) || 0;
  const sp = lotSpeak(lot);
  let text = `${lot.name} has ${s.remaining} chickens left.`;
  let speech = `${sp} has ${s.remaining} chickens left.`;
  if (s.mixed) {
    const parts = Object.keys(s.byBreed).map(b => `${breedName(b)} ${s.byBreed[b].remaining}`);
    text = `${lot.name} left: ${parts.join(', ')}.`; speech = `${sp} left: ${parts.join(', ')}.`;
  }
  if (s.remaining < 0) { text = `${lot.name} count is ${s.remaining} — please do a count check.`; speech = `Warning. ${sp} count is below zero. Please count the birds.`; }
  else if (s.remaining === 0) { text = `${lot.name} has no chickens left.`; speech = `${sp} has no chickens left.`; }
  else if (low && s.remaining <= low) { text = `⚠ Only ${s.remaining} left in ${lot.name}!`; speech = `Warning. Only ${s.remaining} chickens left in ${sp}.`; }
  return { text, speech, stats: s };
}
function announceSale(sale, v, isNew) {
  const lot = lotById(sale.lotId);
  const n = lot ? lowNote(lot, sale.breed) : { text: '', speech: '' };
  const t = periodStats(today(), today());
  toast(`${isNew ? 'Saved' : 'Updated'} ✓ ${kgs(sale.kg)} ${SALE_LABEL[sale.type] || sale.type}${sale.birds ? ' · ' + sale.birds + (sale.type === 'live' ? ' bird' + (sale.birds > 1 ? 's' : '') : ' cut') : ''} · ${money(sale.amount)}. ${n.text}`, isNew ? sale.id : null);
  if (v) speak(`Saved. ${n.speech} Today's total is ${sayMoney(t.amount)}.`);
}

// ---------- process entries ----------
const BIRD_TYPES = ['dead', 'restock', 'cut', 'weight', 'soldfix', 'adjust', 'check'];
function flowEvent(type, p, v) {
  withLot(p, v, lot => {
    p.lotRefs = oneLot(lot);
    if (BIRD_TYPES.includes(type) && lotBreeds(lot).length > 1 && !p.breed) return withBreed(lot, p, v, () => flowEvent(type, p, v), type === 'dead' ? 'type died' : type === 'cut' ? 'type was cut' : '');
    const def = EVENT_TYPES[type];
    const ev = { kind: 'event', type, date: p.date || today(), lotId: lot.id, count: p.count != null ? p.count : null, qty: p.qty != null ? p.qty : null,
      unit: p.unit || (type === 'feed' ? 'bags' : type === 'weight' || type === 'cut' ? 'kg' : ''), amount: p.amount != null ? p.amount : null,
      grade: type === 'feed' ? (p.grade || '') : undefined,
      item: EVENT_TYPES[type].item ? (p.item || '') : undefined,
      breed: BIRD_TYPES.includes(type) ? recBreed({ breed: p.breed }, lot) : undefined,
      note: type === 'note' || type === 'expense' ? (p.text || '') : '' };
    if (type === 'cut' && ev.count && !ev.qty) { ev.qty = round(ev.count * estBirdKg(lot, ev.breed, ev.date).kg * dressYield(), 2); ev.qtyEst = true; }
    if (type === 'cut' && !ev.count) {
      ask({ title: 'How many chickens did you cut?', speech: 'How many chickens did you cut?', hint: 'Say a number', input: { placeholder: 'birds' },
        voice: numberAnswer, voiceMode: v, onAnswer: c => { p.count = Math.round(c); flowEvent(type, p, v); } });
      return;
    }
    if (type === 'weight' && !ev.qty) {
      ask({ title: 'Average weight per bird (kg)?', speech: 'What is the average weight in kilo?', hint: 'Say like “1.8 kg”', input: { placeholder: 'kg', decimal: true },
        voice: numberAnswer, voiceMode: v, onAnswer: q => { p.qty = q > 20 ? q / 1000 : q; flowEvent(type, p, v); } });
      return;
    }
    if (type === 'feed' && p.grade == null) {
      ask({ title: 'Which feed grain size?', speech: 'Which feed? B 0, B 1, B 2 or B 3?', hint: 'Say “B1”, “B2”… or “skip”',
        buttons: FEED_GRADES.map(g => ({ label: '🌾 ' + g, value: g, cls: 'ghost' })).concat([{ label: 'Skip', value: '' }]),
        voice: gradeAnswer, voiceMode: v, onAnswer: g => { p.grade = g; flowEvent(type, p, v); } });
      return;
    }
    const save = () => {
      put(ev); render();
      const n = lowNote(lot);
      const what = eventTitle(ev) + (ev.amount ? ' · ' + money(ev.amount) : '');
      const sl = USAGE_TYPES.includes(type) ? stockLeftNote(type, ev) : { text: '', speech: '' };
      toast(`Saved ✓ ${lot.name}: ${what}. ${['dead', 'cut'].includes(type) ? n.text : sl.text}`, ev.id);
      if (v) speak(`Saved. ${lotSpeak(lot)}, ${eventSpeech(ev)}. ${['dead', 'cut'].includes(type) ? n.speech : sl.speech}`);
    };
    if (db.meta.confirmVoice) {
      ask({
        title: `Save ${def.label.toLowerCase()} entry?`, sub: p.text ? `Heard: “${p.text}”` : '',
        html: eventSummaryHtml(ev), speech: `${lotSpeak(lot)}, ${eventSpeech(ev)}. Save?`, hint: 'Say “yes” or “no”',
        buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }],
        voice: yesNo, voiceMode: v,
        onAnswer: a => { if (a === 'yes') save(); else if (a === 'edit') openEventForm(ev); else toast('Cancelled — nothing saved'); }
      });
    } else save();
  }, 'Which lot?');
}
const sayGrade = g => g ? g.replace(/^B/, 'B ') : '';
function eventSpeech(e) {
  switch (e.type) {
    case 'dead': return `${e.count} dead`;
    case 'cut': return `cut ${e.count} chickens${e.qty ? ', ' + sayKg(e.qty) + ' meat' : ''}`;
    case 'feed': return `feed ${sayGrade(e.grade)}${e.qty ? ', ' + e.qty + ' ' + e.unit : ''}${e.amount ? ', ' + sayMoney(e.amount) : ''}`;
    case 'weight': return `average weight ${sayKg(e.qty)}`;
    case 'medicine': case 'vitamin': case 'vaccine': return `${e.type} ${e.item || ''}${e.qty ? ', ' + e.qty + ' ' + e.unit : ''}${e.amount ? ', ' + sayMoney(e.amount) : ''}`;
    default: return (EVENT_TYPES[e.type] || {}).label + (e.amount ? ', ' + sayMoney(e.amount) : '');
  }
}
function eventSummaryHtml(e) {
  const t = EVENT_TYPES[e.type];
  return `<div class="summary">
    <div class="line"><span>Entry</span><b>${t.icon} ${t.label}</b></div>
    <div class="line"><span>Lot</span><b>${esc(lotName(e.lotId))}</b></div>
    <div class="line"><span>Date</span><b>${fmtDate(e.date, true)}</b></div>
    ${e.type === 'feed' ? `<div class="line"><span>Grain size</span><b>${esc(e.grade || '—')}</b></div>` : ''}
    ${t.item ? `<div class="line"><span>Name</span><b>${esc(e.item || '—')}</b></div>` : ''}
    ${e.breed && lotBreeds(lotById(e.lotId)).length > 1 ? `<div class="line"><span>Chicken type</span><b>${esc(breedName(e.breed))}</b></div>` : ''}
    ${e.count != null && t.count ? `<div class="line"><span>Birds</span><b>${e.count}</b></div>` : ''}
    ${e.qty != null && t.qty ? `<div class="line"><span>${e.type === 'weight' ? 'Avg weight' : e.type === 'cut' ? 'Meat' : 'Quantity'}</span><b>${e.qtyEst ? '≈ ' : ''}${nfmt(e.qty)} ${esc(e.unit || '')}</b></div>` : ''}
    ${e.amount != null && t.amount ? `<div class="line"><span>Cost</span><b>${money(e.amount)}</b></div>` : ''}
    ${e.note ? `<div class="line"><span>Note</span><b class="small">${esc(e.note)}</b></div>` : ''}
  </div>`;
}

// ---------- purchases ----------
function stockLeftNote(cat, r) {
  const inv = computeInventory();
  const i = inv[stockKey(cat, r)];
  if (!i || !i.boughtAll) return { text: '', speech: '' };
  const low = i.left <= 0;
  return { text: `${i.label} left: ${fmtStockQty(i)}${low ? ' ⚠' : ''}.`,
    speech: `${i.label.replace(/^Feed B/, 'Feed B ')} left, ${i.cat === 'feed' ? round(i.left / bagKg(), 1) + ' bags' : nfmt(i.left) + ' ' + i.unit}.` };
}
function purchaseSummaryHtml(r) {
  const c = PURCHASE_CATS[r.category] || PURCHASE_CATS.other;
  return `<div class="summary">
    <div class="line"><span>Bought</span><b>${c.icon} ${esc(c.label)}</b></div>
    ${r.category === 'feed' ? `<div class="line"><span>Grain size</span><b>${esc(r.grade || '—')}</b></div>` : `<div class="line"><span>Name</span><b>${esc(r.item || '—')}</b></div>`}
    <div class="line"><span>Quantity</span><b>${r.qty ? nfmt(r.qty) + ' ' + esc(r.unit === 'bags' ? 'bora' : r.unit || '') : '—'}</b></div>
    ${r.rate ? `<div class="line"><span>Rate</span><b>${money(r.rate)} / ${esc(r.unit === 'bags' ? 'bora' : r.unit || 'unit')}</b></div>` : ''}
    <div class="line"><span>Date</span><b>${fmtDate(r.date, true)}</b></div>
    ${r.supplier ? `<div class="line"><span>From</span><b>${esc(r.supplier)}</b></div>` : ''}
    ${r.lotId ? `<div class="line"><span>For lot</span><b>${esc(lotName(r.lotId))}</b></div>` : ''}
    ${r.invoice ? `<div class="line"><span>Bill no.</span><b>${esc(r.invoice)}</b></div>` : ''}
    ${r.flag ? `<div class="line"><span>Payment</span><b class="flagmark">⚑ On credit (not paid)</b></div>` : ''}
    <div class="line"><span>Total</span><b style="font-size:26px;color:var(--red)">${money(r.amount)}</b></div>
  </div>`;
}
function flowPurchase(p, v) {
  if (!p.category) {
    ask({ title: 'What did you buy?', speech: 'What did you buy? Feed, medicine, vitamin or vaccine?', hint: 'Say “feed”, “medicine”, “vitamin”, “vaccine”…',
      buttons: Object.keys(PURCHASE_CATS).map(k => ({ label: PURCHASE_CATS[k].icon + ' ' + PURCHASE_CATS[k].label, value: k, cls: 'ghost' })),
      voice: t => { const x = normalize(t); if (x.grades.length || /\b(feed|grain|dana)\b/.test(x.s)) return 'feed';
        for (const k of ['medicine', 'vitamin', 'vaccine', 'equipment', 'other']) if (new RegExp('\\b' + k).test(x.s)) return k; return undefined; },
      voiceMode: v, onAnswer: c => { p.category = c; flowPurchase(p, v); } });
    return;
  }
  if (p.category === 'feed' && p.grade == null) {
    ask({ title: 'Which feed grain size?', speech: 'Which feed? B 0, B 1, B 2 or B 3?', hint: 'Say “B1”, “B2”… or “skip”',
      buttons: FEED_GRADES.map(g => ({ label: '🌾 ' + g, value: g, cls: 'ghost' })).concat([{ label: 'Other / skip', value: '' }]),
      voice: gradeAnswer, voiceMode: v, onAnswer: g => { p.grade = g; flowPurchase(p, v); } });
    return;
  }
  if (p.qty == null) {
    const unit = p.unit || (p.category === 'feed' ? 'bags' : PURCHASE_CATS[p.category].units[0]);
    ask({ title: `How many ${unit}?`, speech: `How many ${unit}?`, hint: 'Say a number', input: { placeholder: unit, decimal: true },
      voice: numberAnswer, voiceMode: v, onAnswer: q => { p.qty = q; p.unit = unit; flowPurchase(p, v); } });
    return;
  }
  if (p.amount == null && p.category === 'feed' && p.grade && feedRateFor(p.grade, 'buy', p.unit || 'bags')) {
    p.rate = p.rate != null ? p.rate : feedRateFor(p.grade, 'buy', p.unit || 'bags');
    p.amount = round(p.rate * p.qty, 2); p.rateFromDefault = true;
  }
  if (p.amount == null) {
    ask({ title: 'Total amount paid (Rs)?', speech: 'How much was the total?', hint: 'Say the total, like “34000”', input: { placeholder: 'Rs total' },
      voice: numberAnswer, voiceMode: v, onAnswer: a => { p.amount = a; if (p.qty) p.rate = round(a / p.qty, 2); flowPurchase(p, v); } });
    return;
  }
  const ref = p.lotRefs && p.lotRefs[0];
  const rec = { kind: 'purchase', date: p.date || today(), category: p.category, grade: p.category === 'feed' ? (p.grade || '') : '', item: p.item || '',
    qty: p.qty, unit: p.unit || (p.category === 'feed' ? 'bags' : 'pcs'), rate: p.rate != null ? p.rate : (p.qty ? round(p.amount / p.qty, 2) : null), amount: p.amount,
    supplier: p.supplier || '', invoice: p.invoice || '', flag: !!p.flag, lotId: ref && ref.ids.length === 1 ? ref.ids[0] : '', note: '', heard: p.text || '' };
  const save = () => {
    put(rec); render();
    const sl = stockLeftNote(rec.category, rec);
    toast(`Saved ✓ bought ${purchaseTitle(rec)} · ${money(rec.amount)}. ${sl.text}`, rec.id);
    const done = () => { if (v) speak(`Saved. ${sayMoney(rec.amount)} spent. ${sl.speech}`); };
    if (rec.category === 'feed' && rec.grade && rec.rate && !p.rateFromDefault) askFeedRate(rec.grade, 'buy', perBag(rec.rate, rec.unit), v, done); else done();
  };
  if (!db.meta.confirmVoice) return save();
  ask({ title: 'Save this purchase?', sub: p.text ? `Heard: “${p.text}”` : '', html: purchaseSummaryHtml(rec),
    speech: `Bought ${rec.category === 'feed' ? 'feed ' + sayGrade(rec.grade) : (rec.item || rec.category)}, ${rec.qty} ${rec.unit}, total ${sayMoney(rec.amount)}. Save?`,
    buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }],
    voice: yesNo, voiceMode: v,
    onAnswer: a => { if (a === 'yes') save(); else if (a === 'edit') goBuy(rec); else toast('Cancelled — nothing saved'); } });
}

// If a grain rate differs from the saved one, offer to save it (like chicken prices).
function askFeedRate(grade, kind, bagRate, v, done) {
  const cur = feedRates()[grade] ? feedRates()[grade][kind] : 0;
  if (!bagRate || round(bagRate) === round(cur)) return done();
  const what = `${grade} ${kind === 'buy' ? 'buying' : 'selling'} rate`;
  ask({ title: cur ? `Change ${what}?` : `Save ${what}?`,
    html: `<div class="summary"><div class="line"><span>Saved rate</span><b>${cur ? money(cur) + ' / bora' : 'not set'}</b></div><div class="line"><span>This time</span><b>${money(bagRate)} / bora (${money(bagRate / bagKg())}/kg)</b></div></div>`,
    speech: `Save ${sayMoney(bagRate)} per bora as the ${grade.replace('B', 'B ')} ${kind === 'buy' ? 'buying' : 'selling'} rate?`,
    buttons: [{ label: `Yes, ${money(bagRate)} / bora`, value: 'yes', cls: 'primary' }, { label: cur ? `No, keep ${money(cur)}` : 'No', value: 'no' }],
    voice: yesNo, voiceMode: v, onAnswer: a => { if (a === 'yes') { setFeedRate(grade, kind, bagRate); render(); } done(); }, onCancel: done });
}

// ---------- grain sale ----------
function flowGrainSale(p, v) {
  if (!p.grade) {
    ask({ title: 'Which grain size did you sell?', speech: 'Which grain? B 0, B 1, B 2 or B 3?', hint: 'Say “B1”, “B2”…',
      buttons: FEED_GRADES.map(g => ({ label: '🌾 ' + g, value: g, cls: 'ghost' })), voice: t => { const g = gradeAnswer(t); return g || undefined; }, voiceMode: v,
      onAnswer: g => { p.grade = g; flowGrainSale(p, v); } });
    return;
  }
  if (p.qty == null) {
    ask({ title: `How many bora of ${p.grade}?`, sub: 'For kg, type it in the Sell page or say “10 kg”.', speech: 'How many bora?', hint: 'Say a number',
      input: { placeholder: 'bora', decimal: true }, voice: t => { const x = normalize(t).s; const n = numberAnswer(t); if (n == null) return undefined; if (/\bkg\b/.test(x)) p.unit = 'kg'; return n; },
      voiceMode: v, onAnswer: q => { p.qty = q; p.unit = p.unit || 'bags'; flowGrainSale(p, v); } });
    return;
  }
  const unit = p.unit || 'bags';
  let rate = p.rate != null ? (p.rateUnit && p.rateUnit !== unit ? (p.rateUnit === 'kg' ? p.rate * bagKg() : p.rate / bagKg()) : p.rate) : null;
  const told = rate != null || p.amount != null;
  if (rate == null && p.amount != null && p.qty) rate = round(p.amount / p.qty, 2);
  if (rate == null) rate = feedRateFor(p.grade, 'sell', unit);
  if (!rate && p.amount == null) {
    ask({ title: `${p.grade} selling rate per ${unit === 'kg' ? 'kg' : 'bora'}?`, sub: 'No selling rate saved yet.', speech: `What is the selling rate per ${unit === 'kg' ? 'kilo' : 'bora'}?`,
      hint: 'Say the rate', input: { placeholder: 'Rs' }, voice: numberAnswer, voiceMode: v, onAnswer: r => { p.rate = r; p.rateUnit = unit; flowGrainSale(p, v); } });
    return;
  }
  const rec = { kind: 'grainsale', date: p.date || today(), grade: p.grade, qty: p.qty, unit, rate: round(rate, 2), amount: p.amount != null ? p.amount : round(rate * p.qty, 2),
    customer: '', flag: !!p.flag, note: '', heard: p.text || '' };
  const save = () => {
    put(rec); render();
    const sl = stockLeftNote('feed', rec);
    toast(`Saved ✓ sold ${rec.grade} ${nfmt(rec.qty)} ${rec.unit === 'kg' ? 'kg' : 'bora'} · ${money(rec.amount)}. ${sl.text}`, rec.id);
    const done = () => { if (v) speak(`Saved. Grain sale ${sayMoney(rec.amount)}. ${sl.speech}`); };
    if (told) askFeedRate(rec.grade, 'sell', perBag(rec.rate, rec.unit), v, done); else done();
  };
  if (!db.meta.confirmVoice) return save();
  ask({ title: 'Save this grain sale?', sub: p.text ? `Heard: “${p.text}”` : '',
    html: `<div class="summary"><div class="line"><span>Grain</span><b>🌾 ${esc(rec.grade)}</b></div><div class="line"><span>Quantity</span><b>${nfmt(rec.qty)} ${rec.unit === 'kg' ? 'kg' : 'bora'}</b></div>
      <div class="line"><span>Rate</span><b>${money(rec.rate)} / ${rec.unit === 'kg' ? 'kg' : 'bora'}</b></div><div class="line"><span>Date</span><b>${fmtDate(rec.date, true)}</b></div>
      ${rec.flag ? '<div class="line"><span>Payment</span><b class="flagmark">⚑ Credit</b></div>' : ''}
      <div class="line"><span>Total</span><b style="font-size:26px;color:var(--green)">${money(rec.amount)}</b></div></div>`,
    speech: `Grain ${rec.grade.replace('B', 'B ')}, ${rec.qty} ${rec.unit === 'kg' ? 'kilo' : 'bora'}, total ${sayMoney(rec.amount)}. Save?`,
    buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }],
    voice: yesNo, voiceMode: v,
    onAnswer: a => { if (a === 'yes') save(); else if (a === 'edit') goSell(Object.assign({}, rec, { type: 'grain' })); else toast('Cancelled — nothing saved'); } });
}

// ---------- lots ----------
function askBreed(title, v, cb) {
  ask({ title, speech: title + ' ' + breeds().map(b => b.name).join(', or '), hint: 'Say ' + breeds().map(b => '“' + b.name + '”').join(', '),
    buttons: breeds().map(b => ({ label: '🐔 ' + esc(b.name), value: b.id, cls: 'ghost' })), voice: breedAnswer, voiceMode: v, onAnswer: cb });
}
function flowNewLot(p, v) {
  const counts = p.breedCounts || {};
  if (Object.keys(counts).length) { p.mix = Object.keys(counts).map(b => ({ breed: b, chicks: counts[b] })); p.chicks = p.mix.reduce((a, m) => a + m.chicks, 0); p.breed = p.mix[0].breed; }
  if (!p.chicks) {
    ask({ title: 'How many chicks in the new lot?', speech: 'How many chicks?', hint: 'Say a number, like “100”', input: { placeholder: 'chicks' },
      voice: numberAnswer, voiceMode: v, onAnswer: c => { p.chicks = Math.round(c); flowNewLot(p, v); } });
    return;
  }
  if (!p.breed) { askBreed('Which type of chicken?', v, b => { p.breed = b; flowNewLot(p, v); }); return; }
  if (!p.mix) p.mix = [{ breed: p.breed, chicks: p.chicks }];
  const date = p.date || today();
  const seq = nextLotSeq(date);
  if (p.free && p.mix.length) p.mix[0].free = p.free;
  const lot = { kind: 'lot', name: lotAutoName(date, seq, p.chicks), seq, breed: p.breed, mix: p.mix, startDate: date, chicks: p.chicks, ...(p.free ? { free: p.free } : {}),
    chickCost: p.cost != null ? p.cost : (p.chickRate ? round(p.chickRate * p.chicks) : null), closed: false, note: '' };
  ask({
    title: `Add new lot ${lot.name}?`,
    html: `<div class="summary"><div class="line"><span>Lot</span><b>${esc(lot.name)}</b></div><div class="line"><span>Type</span><b>${esc(mixLabel(lot))}</b></div>
      <div class="line"><span>Start date</span><b>${fmtDate(lot.startDate, true)}</b></div>
      <div class="line"><span>Chicks</span><b>${lot.chicks}${lot.free ? ` + 🎁${lot.free} free = ${lot.chicks + lot.free}` : ''}</b></div>${lot.chickCost ? `<div class="line"><span>Chick cost</span><b>${money(lot.chickCost)}</b></div>` : ''}</div>`,
    speech: `Add ${lotSpeak(lot)}, ${lot.mix.map(m => m.chicks + ' ' + breedName(m.breed)).join(' and ')} chicks?`,
    buttons: [{ label: '✔ Add lot', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }],
    voice: yesNo, voiceMode: v,
    onAnswer: a => {
      if (a === 'yes') { put(lot); render(); toast(`Lot ${lot.name} added ✓`); if (v) speak(`${lotSpeak(lot)} added with ${lot.chicks} chicks.`); }
      else if (a === 'edit') openLotForm(lot);
    }
  });
}

function flowRestock(p, v) {
  withLot(p, v, lot => {
    const counts = p.breedCounts || {};
    const go = (breed, count) => {
      const rec = { kind: 'event', type: 'restock', date: p.date || today(), lotId: lot.id, breed, count,
        amount: p.cost != null ? p.cost : (p.chickRate ? round(p.chickRate * count) : null), note: '' };
      if (p.free) rec.free = p.free;
      ask({ title: `Add ${count} ${breedName(breed)} chicks to ${lot.name}?`,
        html: `<div class="summary"><div class="line"><span>Lot</span><b>${esc(lot.name)}</b></div><div class="line"><span>Type</span><b>${esc(breedName(breed))}</b></div>
          <div class="line"><span>Chicks added</span><b>${count}${rec.free ? ` + 🎁${rec.free} free` : ''}</b></div><div class="line"><span>Date</span><b>${fmtDate(rec.date, true)}</b></div>
          ${rec.amount ? `<div class="line"><span>Cost</span><b>${money(rec.amount)}</b></div>` : ''}</div>`,
        speech: `Add ${count} ${breedName(breed)} chicks to ${lotSpeak(lot)}?`,
        buttons: [{ label: '✔ Add', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }],
        voice: yesNo, voiceMode: v,
        onAnswer: a => {
          if (a === 'edit') return openEventForm(rec);
          if (a !== 'yes') return;
          addRestock(rec);
          toast(`✓ Added ${count} ${breedName(breed)} chicks to ${lot.name}`);
          if (v) speak(`Added ${count} chicks to ${lotSpeak(lot)}.`);
        } });
    };
    const b = Object.keys(counts)[0] || p.breed;
    const count = (b && counts[b]) || p.chicks;
    if (!count) {
      ask({ title: 'How many chicks were added?', speech: 'How many chicks?', input: { placeholder: 'chicks' }, voice: numberAnswer, voiceMode: v,
        onAnswer: c => { p.chicks = Math.round(c); flowRestock(p, v); } });
      return;
    }
    if (b) return go(b, count);
    if (lotBreeds(lot).length === 1) return go(lotBreeds(lot)[0], count);
    askBreed('Which type of chicks?', v, x => go(x, count));
  }, 'Add chicks to which lot?');
}
// a chicks-added entry; a type new to the lot is added to its mix
function addRestock(rec) {
  const lot = lotById(rec.lotId);
  if (lot && !lotBreeds(lot).includes(rec.breed)) put(Object.assign({}, lot, { mix: lotMix(lot).concat([{ breed: rec.breed, chicks: 0, added: true }]) }));
  put(rec); render();
}

function flowSetPrice(p, v) {
  const go = (breed, type) => {
    if (p.rate == null) {
      ask({ title: `New ${breedName(breed)} ${type} price per kg?`, speech: `What is the new ${breedName(breed)} ${type} price per kilo?`, hint: 'Say the price',
        input: { placeholder: 'Rs per kg' }, voice: numberAnswer, voiceMode: v, onAnswer: r => { p.rate = r; go(breed, type); } });
      return;
    }
    const old = priceFor(type, breed);
    setBreedPrice(breed, type, p.rate); render();
    toast(`${breedName(breed)} ${type} price: ${money(p.rate)}/kg ${old ? '(was ' + money(old) + ')' : ''}`);
    if (v) speak(`Done. ${breedName(breed)} ${type} price is now ${sayMoney(p.rate)} per kilo.`);
  };
  const pickType = breed => {
    if (p.type) return go(breed, p.type);
    ask({ title: `${breedName(breed)}: live or meat price?`, speech: 'Live price or meat price?', hint: 'Say “live” or “meat”',
      buttons: [{ label: '🐔 Live price', value: 'live', cls: 'ghost' }, { label: '🔪 Meat price', value: 'meat', cls: 'ghost' }],
      voice: t => saleType(normalize(t).s) || undefined, voiceMode: v, onAnswer: t => go(breed, t) });
  };
  if (p.breed) return pickType(p.breed);
  if (breeds().length === 1) return pickType(breeds()[0].id);
  askBreed('Price for which chicken type?', v, pickType);
}

// ---------- count check: "how many do you have left?" ----------
function startCountCheck(lotId, v, onlyBreed) {
  const lot = lotById(lotId);
  if (!lot) return;
  const s = lotStats(lot.id);
  const bs = onlyBreed ? [onlyBreed] : lotBreeds(lot);
  const askOne = k => {
    if (k >= bs.length) return;
    const b = bs[k], what = bs.length > 1 || s.mixed ? breedName(b) + ' chickens' : 'chickens';
    ask({ title: `How many ${what} are left in ${lot.name}?`, sub: `The app expects ${s.byBreed[b].remaining}. Count them and tell me.`,
      speech: `How many ${what} are left in ${lotSpeak(lot)}?`, hint: 'Say the number you counted', input: { placeholder: 'counted birds' },
      voice: numberAnswer, voiceMode: v, onAnswer: c => stockCheck(lot, Math.round(c), v, b, () => askOne(k + 1)) });
  };
  askOne(0);
}
function stockCheck(lot, counted, v, breed, next) {
  if (!breed && lotBreeds(lot).length > 1) return startCountCheck(lot.id, v);
  breed = breed || lotBreeds(lot)[0];
  next = next || (() => {});
  if (counted == null || isNaN(counted)) return startCountCheck(lot.id, v, breed);
  const s = lotStats(lot.id);
  const expected = s.byBreed[breed].remaining;
  const diff = expected - counted;
  const sp = lotSpeak(lot) + (s.mixed ? ' ' + breedName(breed) : '');
  const label = lot.name + (s.mixed ? ' ' + breedName(breed) : '');
  put({ kind: 'event', type: 'check', date: today(), lotId: lot.id, breed, count: counted, note: `Expected ${expected}` });
  render();
  if (diff === 0) {
    toast(`✓ Count matches: ${label} has ${counted}`);
    if (v) speak(`Perfect. The count matches. ${sp} has ${counted} chickens.`, next); else next();
    return;
  }
  if (diff > 0) {
    ask({
      title: `${diff} chickens not recorded in ${label}`,
      sub: `Expected ${expected}, you counted ${counted}. What happened to the ${diff}?`,
      speech: `${sp} should have ${expected}, but you counted ${counted}. ${diff} are missing. Were they dead, sold live, or cut for meat?`,
      hint: 'Say “dead”, “sold”, “cut” or “ignore”',
      buttons: [{ label: `💀 ${diff} dead`, value: 'dead', cls: 'ghost' }, { label: `🐔 ${diff} sold live`, value: 'soldfix', cls: 'ghost' },
        { label: `🔪 ${diff} cut for meat`, value: 'cut', cls: 'ghost' }, { label: 'Ignore', value: 'ignore', cls: 'ghost' }],
      voice: t => { const x = normalize(t).s; if (/\b(dead|died|death)\b/.test(x)) return 'dead'; if (/\b(cut|meat|slaughter)/.test(x)) return 'cut';
        if (/\b(sold|sale|sell|live)\b/.test(x)) return 'soldfix'; if (/\b(ignore|nothing|leave|no|skip)\b/.test(x)) return 'ignore'; return undefined; },
      voiceMode: v,
      onAnswer: a => {
        if (a === 'ignore') put({ kind: 'event', type: 'adjust', date: today(), lotId: lot.id, breed, count: -diff, note: 'Count check (unexplained)' });
        else put({ kind: 'event', type: a, date: today(), lotId: lot.id, breed, count: diff, note: 'From count check' });
        render();
        toast(`✓ ${label} now shows ${counted} chickens`);
        if (v) speak(`Saved. ${sp} now has ${counted} chickens.`, next); else next();
      }
    });
  } else {
    const extra = -diff;
    ask({ title: `${extra} more than expected in ${label}`, sub: `Expected ${expected}, you counted ${counted}.`,
      speech: `You counted ${extra} more than expected. Correct ${sp} to ${counted}?`,
      buttons: [{ label: `✔ Set to ${counted}`, value: 'yes', cls: 'green' }, { label: 'No', value: 'no' }], voice: yesNo, voiceMode: v,
      onAnswer: a => { if (a === 'yes') { put({ kind: 'event', type: 'adjust', date: today(), lotId: lot.id, breed, count: extra, note: 'From count check' }); render(); toast(`✓ ${label} now shows ${counted}`); if (v) speak('Corrected.'); } next(); } });
  }
}

function closeLotFlow(lotId) {
  const lot = lotById(lotId);
  if (!lot) return;
  const s = lotStats(lot.id);
  const close = () => { put(Object.assign({}, lot, { closed: true, closedDate: today() })); render(); closeSheet(); toast(`Lot ${lot.name} closed ✓`); };
  if (s.remaining > 0) {
    ask({ title: `${lot.name} still shows ${s.remaining} chickens`, sub: 'What happened to them before closing?',
      buttons: [{ label: `💀 Dead`, value: 'dead', cls: 'ghost' }, { label: `🐔 Sold live`, value: 'soldfix', cls: 'ghost' }, { label: `🔪 Cut for meat`, value: 'cut', cls: 'ghost' },
        { label: 'Close anyway', value: 'close', cls: 'ghost' }, { label: 'Cancel', value: 'no', cls: 'redl' }],
      onAnswer: a => { if (a === 'no') return; if (a !== 'close') Object.keys(s.byBreed).forEach(b => { const n = s.byBreed[b].remaining; if (n > 0) put({ kind: 'event', type: a, date: today(), lotId: lot.id, breed: b, count: n, note: 'At lot close' }); }); close(); } });
  } else {
    ask({ title: `Close lot ${lot.name}?`, sub: 'You can reopen it later from the Lots tab.', buttons: [{ label: 'Close lot', value: 'yes', cls: 'primary' }, { label: 'Cancel', value: 'no' }],
      onAnswer: a => { if (a === 'yes') close(); } });
  }
}

// ---------- answers ----------
function sayLeft(p, v) {
  const st = computeStats();
  let list = activeLots();
  const ref = p.lotRefs && p.lotRefs[0];
  if (ref && ref.ids.length) list = ref.ids.map(lotById).filter(Boolean);
  else if (p.breed) list = list.filter(l => lotBreed(l) === p.breed);
  if (!list.length) { info('No active lots', '<p>Add a lot first.</p>', 'You have no active lots.', v); return; }
  const total = list.reduce((a, l) => a + st[l.id].remaining, 0);
  const html = `<div class="summary">${list.map(l => { const s = st[l.id]; return `<div class="line"><span><b>${esc(l.name)}</b><br><span class="small muted">${s.mixed ? Object.keys(s.byBreed).map(b => esc(breedName(b)) + ' ' + s.byBreed[b].remaining).join(' · ') : esc(breedName(lotBreeds(l)[0]))} · day ${s.age}</span></span><b style="font-size:26px">${s.remaining}</b></div>`; }).join('')}
    ${list.length > 1 ? `<div class="line"><span>Total</span><b style="font-size:26px;color:var(--green)">${total}</b></div>` : ''}</div>
    ${list.map(l => st[l.id].meatStock ? `<p class="small muted">${esc(l.name)}: about ${kgs(st[l.id].meatStock)} cut meat not sold yet.</p>` : '').join('')}`;
  const speech = list.map(l => `${lotSpeak(l)} has ${st[l.id].remaining}` + (st[l.id].mixed ? ': ' + Object.keys(st[l.id].byBreed).map(b => breedName(b) + ' ' + st[l.id].byBreed[b].remaining).join(', ') : '')).join('. ') + (list.length > 1 ? `. Total ${total} chickens.` : ' chickens.');
  info('Chickens left', html, speech, v);
}
function periodRange(period) {
  const t = today();
  if (period === 'week') return [addDays(t, -6), t, 'Last 7 days'];
  if (period === 'month') return [bsMonthStart(t), t, BS_MONTHS[adToBs(t).m - 1] + ' (this month)'];
  if (period === 'all') return ['0000-00-00', '9999-99-99', 'All time'];
  if (/^\d{4}-/.test(period || '')) return [period, period, fmtDate(period, true)];
  return [t, t, 'Today'];
}
function saySummary(p, v) {
  const [from, to, label] = periodRange(p.period);
  const s = periodStats(from, to);
  const fr = farmReport(from, to);
  const st = computeStats();
  const html = `<div class="summary">
    <div class="line"><span>Total sales</span><b style="font-size:26px;color:var(--green)">${money(s.amount)}</b></div>
    <div class="line"><span>🐔 Live</span><b>${kgs(s.liveKg)}</b></div>
    <div class="line"><span>🔪 Meat</span><b>${kgs(s.meatKg)}</b></div>
    <div class="line"><span>Sales</span><b>${s.count}</b></div>
    <div class="line"><span>Dead</span><b>${s.dead}</b></div>
    <div class="line"><span>Costs (bought / spent)</span><b>${money(fr.costs)}</b></div>
    <div class="line"><span>${fr.profit >= 0 ? 'Profit' : 'Loss'}</span><b style="font-size:22px;color:${fr.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${money(Math.abs(fr.profit))}</b></div>
  </div><button class="btn big ghost" data-act="openReport">📊 Full profit report</button><div style="height:10px"></div><div class="summary">${activeLots().map(l => `<div class="line"><span>${esc(l.name)} left</span><b>${st[l.id].remaining}</b></div>`).join('')}</div>`;
  const speech = `${label}, you sold ${sayKg(s.kg)} for ${sayMoney(s.amount)}. You spent ${sayMoney(fr.costs)}. ${fr.profit >= 0 ? 'Profit' : 'Loss'} ${sayMoney(Math.abs(fr.profit))}. ` + activeLots().map(l => `${lotSpeak(l)} has ${st[l.id].remaining} left`).join('. ');
  info(label + ' summary', html, speech, v);
}
function sayStock(p, v) {
  const inv = computeInventory();
  let list = Object.keys(inv).filter(k => k[0] !== '_').map(k => inv[k]).filter(i => i.boughtAll);
  if (p.grade) list = list.filter(i => i.grade === p.grade);
  else if (/\b(feed|grain|dana)\b/.test(normalize(p.text).s)) list = list.filter(i => i.cat === 'feed');
  if (!list.length) { info('Stock', '<p>No purchases recorded yet. Say “bought 10 bags B2 feed for 34000”.</p>', 'No purchases recorded yet.', v); return; }
  list.sort((a, b) => a.cat.localeCompare(b.cat) || a.label.localeCompare(b.label));
  info('Stock left', `<div class="summary">${list.map(i => `<div class="line"><span>${(PURCHASE_CATS[i.cat] || {}).icon || ''} ${esc(i.label)}</span><b style="color:${i.left <= 0 ? 'var(--red)' : 'inherit'}">${fmtStockQty(i)}</b></div>`).join('')}</div>
    <button class="btn big ghost" data-act="openStock">📦 Open stock page</button><div style="height:10px"></div>`,
    list.map(i => `${i.label.replace(/^Feed B/, 'Feed B ')}, ${i.cat === 'feed' ? round(i.left / bagKg(), 1) + ' bags' : nfmt(i.left) + ' ' + i.unit}`).join('. '), v);
}
function sayPrice(v) {
  const list = breeds();
  info('Default prices (Rs per kg)', `<div class="summary"><div class="line"><span></span><b>🐔 Live · 🔪 Meat</b></div>${list.map(b =>
    `<div class="line"><span>${esc(b.name)}</span><b>${b.live ? nfmt(b.live) : '—'} · ${b.meat ? nfmt(b.meat) : '—'}</b></div>`).join('')}</div>
    <button class="btn big ghost" data-act="editPrice">Change prices</button><div style="height:10px"></div>`,
    list.map(b => `${b.name}: live ${b.live ? sayMoney(b.live) : 'not set'}, meat ${b.meat ? sayMoney(b.meat) : 'not set'}`).join('. '), v);
}
function flowUndo(v) {
  let last = null;
  for (const id in db.records) {
    const r = db.records[id];
    if (hidden(r) || !['sale', 'event', 'lot'].includes(r.kind) || r.device !== db.meta.deviceName) continue;
    if (!last || r.createdAt > last.createdAt) last = r;
  }
  if (!last) { info('Nothing to undo', '', 'There is nothing to undo.', v); return; }
  const desc = last.kind === 'sale' ? `${kgs(last.kg)} ${last.type} sale · ${money(last.amount)} (${lotName(last.lotId)})` : last.kind === 'lot' ? `Lot ${last.name}` : `${lotName(last.lotId)}: ${eventTitle(last)}`;
  ask({ title: 'Delete the last entry?', sub: desc, speech: `Delete the last entry? ${desc.replace(/Rs /g, '').replace(/_/g, ' ')}`,
    buttons: [{ label: '🗑 Delete it', value: 'yes', cls: 'red' }, { label: 'Keep it', value: 'no' }], voice: yesNo, voiceMode: v,
    onAnswer: a => { if (a === 'yes') { removeRec(last.id); render(); toast('Deleted', last.id, true); if (v) speak('Deleted.'); } } });
}

function helpHtml(short) {
  const krows = [
    ['🌾 Work day', 'Purbe khet ropai 6 khetala 3 parma Thapa ghar', 'Ram Hari pura Sita aadha godmel', 'पूर्बे खेत रोपाइँ ६ खेताला'],
    ['🚜 Machine', 'tractor 3 ghanta 1500', 'aafno tractor diesel 5 litre 750', 'pump 2 ghanta diesel 3 litre 450'],
    ['🧪 Seed / मल', 'gede mal 2 bora 9000', 'bhaisi ko mal 10 thunse', 'kukhura mal 5 bora 1500', 'urea 1 bora 1800', 'dhaan biu 3 pathi 600', 'makai biu 4 mana'],
    ['🌾 Harvest', 'dhaan 20 muri', 'gahun 5 quintal', 'धान २० मुरी'],
    ['💵 Pay worker', 'Ram lai 2000 tirey', 'Ram settle'],
    ['🤝 Parma', 'Thapa ghar parma tirne 2 din', 'parma kati baki'],
    ['Ask', 'Ram ko hisab']
  ];
  const prows = [
    ['Sell meat', 'chicken sold 1 kg', 'sold 2 kg meat lot 1'],
    ['Sell live', 'sold 3 live chickens 7 kg Ashar lot 1 at 320'],
    ['By type', 'sold 2 kg giriraj meat', 'sold 1 local chicken 2 kg live'],
    ['Other price', 'sold 2 kg at 480', 'sold 5 kg for 2300'],
    ['Credit / flag', 'sold 2 kg credit'],
    ['Invoice', 'sold 4 kg invoice 25'],
    ['Date', 'yesterday sold 3 kg', 'Kartik 2 gate sold 3 kg'],
    ['Dead', '2 dead in lot 1', '1 giriraj chicken died'],
    ['Cut for meat', 'cut 5 chickens lot 2 9 kg'],
    ['Feed (grain size)', 'feed B2 2 bags 3400 rupees', 'B0 feed 1 bag lot 1'],
    ['Buy feed', 'bought 10 bags B2 feed for 34000 from Ram', 'bought 2 bora B1 dana (rate from settings)'],
    ['Sell grain', 'sold 2 bora B1 dana', 'B2 dana 10 kg becheko 1000'],
    ['Buy medicine', 'bought 2 bottles amprolium medicine 900 credit', 'bought vitamin 3 packets 450'],
    ['Give medicine', 'medicine amprolium 1 bottle lot 1', 'vitamin 1 packet lot 2'],
    ['Profit', 'this month summary', 'profit report'],
    ['Weight', 'lot 1 average weight 1.8 kg'],
    ['Count check', 'lot 1 has 220 left'],
    ['Ask', 'how many left?', "today's summary", 'this month summary'],
    ['New lot', 'new lot 100 giriraj chicks at 65', 'new lot 80 broiler 20 giriraj chicks', 'new lot 100 broiler chicks 2 free'],
    ['Chicks added later', 'added 100 broiler chicks to lot 1 at 120', 'lot 1 ma 100 challa thapeko'],
    ['Khutta-tauko', 'khutta tauko 2 kg', 'sold 3 kg khutta tauko 450'],
    ['Only amount', 'sold live 550 rupees (kg worked out from the rate)'],
    ['Birds in a sale', 'sold 2.5 kg live (app guesses 1 bird)', 'sold 3 kg meat 2 chickens cut'],
    ['Price', 'set broiler meat price 450', 'set local live price 600'],
    ['Undo', 'undo'],
    ['नेपाली', '१ केजी मासु', 'डेढ केजी जिउँदो कुखुरा', 'आज दुई वटा कुखुरा मरे', 'बी२ दाना दुई बोरा किनेको सात हजार', 'कति कुखुरा बाँकी छ'],
    ['Nepali (roman)', '1kg masu', 'sadhe dui kg jiudo kukhura', 'hijo 1 wota kukhura maryo', 'yo mahina ko nafa kati']
  ];
  const srows = [
    ['🏪 Shop amounts', 'cash 5000 QR 3000 goods 2000', 'nagad 4000 qr 2500', 'नगद पाँच हजार क्यूआर तीन हजार सामान दुई हजार'],
    ['Only one', 'QR 2500', 'goods 3000', '5000 (then it asks: cash, QR or goods?)'],
    ['Another day', 'yesterday cash 4000', 'हिजो नगद ४०००'],
    ['Ask', 'shop today', 'पसल आज कति']
  ];
  const all = [['🌾 Kheti', krows], ['🐔 Chicken', prows], ['🏪 Shop', srows]];
  const sec = typeof section !== 'undefined' ? ({ kheti: 0, poultry: 1, shop: 2 })[section] || 0 : 1;
  const rows = all[sec][1];
  const others = all.filter((x, i) => i !== sec);
  const list = rs => `<ul class="help">${rs.map(r => `<li><b>${r[0]}:</b> ${r.slice(1).map(x => `<code>${esc(x)}</code>`).join(' ')}</li>`).join('')}</ul>`;
  return `<p class="small muted" style="margin-top:0">Tap 🎤 and say it in English, roman Nepali or नेपाली. You can also type it.</p>
    <h3 style="margin-top:4px">${all[sec][0]}</h3>${list(short ? rows.slice(0, 6) : rows)}
    ${short ? '' : others.map(([t, rs]) => `<details><summary><b>${t}</b></summary>${list(rs)}</details>`).join('') + `<details><summary><b>📅 Patro</b></summary>${list([['Calendar', 'patro', 'calendar', 'पात्रो']])}</details>`}
    ${short ? '' : `<p class="small muted">Lots are named by Nepali date, e.g. <b>Ashar83_10_1_100</b> (Ashar 2083, day 10, 1st lot that month, 100 chicks). Say it as “Ashar lot 1”, or “lot 1” = the 1st lot on the Home screen, or by type (“the giriraj lot”). B0–B3 are feed grain sizes. Nepali works too: numbers (एक, डेढ, साढे दुई, आधा, सय, हजार), masu/मासु, jiudo/जिउँदो, mare/मरे, baki/बाँकी, dana/दाना, kineko/किनेको, gate/गते, hunchha/हजुर, hoina/पर्दैन. For Devanagari, set Voice language to नेपाली in Settings.</p>`}`;
}
