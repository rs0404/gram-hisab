/* Gram Hisab — 📒 उधारो (shop credit): who took goods on credit and who paid back.
   kind 'credit' {date, person, type: 'given' | 'paid', amount, pay?: 'cash' | 'qr', note}
   Separate from the daily cash / QR register.
   People book: kind 'cperson' {name, nicks: []}. A nickname typed or spoken saves under the main name;
   renaming rewrites the person's old entries (and keeps the old name as a nickname). */
'use strict';

let creditDraft = null, creditDateOpen = false;
const normPerson = s => String(s || '').trim().replace(/\s+/g, ' ');
const personKey = s => normPerson(s).toLowerCase();

// ---------- people book: main name + nicknames ----------
const crProfiles = () => all('cperson');
function crNameMap() {   // any name or nickname (lower case) → main name
  const m = {}, ps = crProfiles();
  ps.forEach(p => (p.nicks || []).forEach(n => { m[personKey(n)] = p.name; }));
  ps.forEach(p => { m[personKey(p.name)] = p.name; });   // a main name wins over someone's nickname
  return m;
}
const crCanon = (name, m) => (m || crNameMap())[personKey(name)] || normPerson(name);
const crProfileOf = name => crProfiles().find(p => personKey(p.name) === personKey(name)) || null;
function crRecsOf(key, m) { m = m || crNameMap(); return all('credit').filter(r => personKey(crCanon(r.person, m)) === key); }
const splitNicks = t => String(t || '').split(/[,،;\/|]+/).map(normPerson).filter(Boolean);

// balances per person (oldest unpaid date by first-in-first-out)
function creditPeople() {
  const P = {}, m = crNameMap();
  all('credit').sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt).forEach(r => {
    const nm = crCanon(r.person, m), k = personKey(nm); if (!k) return;
    const p = P[k] || (P[k] = { key: k, name: nm, given: 0, paid: 0, last: '', open: [], n: 0 });
    const a = Number(r.amount) || 0; p.n++; if (r.date > p.last) p.last = r.date;
    if (r.type === 'paid') { p.paid += a; let left = a; while (left > 0 && p.open.length) { const o = p.open[0], take = Math.min(o.amt, left); o.amt -= take; left -= take; if (o.amt <= 0.001) p.open.shift(); } }
    else { p.given += a; p.open.push({ date: r.date, amt: a }); }
  });
  Object.values(P).forEach(p => { const pr = crProfileOf(p.name); p.nicks = pr ? (pr.nicks || []) : []; p.balance = round(p.given - p.paid, 2); p.oldest = p.open.length ? p.open[0].date : ''; p.age = p.oldest ? daysBetween(p.oldest, today()) : 0; });
  return P;
}
function creditRange(from, to) {
  const o = { given: 0, paid: 0, n: 0 };
  all('credit').forEach(r => { if (r.date >= from && r.date <= to) { o.n++; o[r.type === 'paid' ? 'paid' : 'given'] += Number(r.amount) || 0; } });
  return o;
}
function newCreditDraft(k) { return { kind: 'credit', date: today(), person: (k && k.person) || '', type: (k && k.type) || 'given', amount: '', pay: 'cash', note: '' }; }

// ---------- 📒 page ----------
function renderCredit() {
  if (!creditDraft) creditDraft = newCreditDraft();
  const d = creditDraft, t = today(), y = addDays(t, -1), P = Object.values(creditPeople());
  const owing = P.filter(p => p.balance > 0.5).sort((a, b) => b.balance - a.balance), adv = P.filter(p => p.balance < -0.5);
  const total = owing.reduce((a, p) => a + p.balance, 0), mo = creditRange(bsMonthStart(t), t), td = creditRange(t, t);
  // age of unpaid udharo (FIFO): under 30 days, 30–90, over 90
  const ages = [0, 0, 0];
  owing.forEach(p => p.open.forEach(o => { const dd = daysBetween(o.date, t); ages[dd < 30 ? 0 : dd <= 90 ? 1 : 2] += o.amt; }));
  const maxAge = Math.max(1, ...ages);
  const names = P.map(p => p.name).sort(), nickOpts = P.flatMap(p => p.nicks.map(n => [n, p.name]));
  $('#v-credit').innerHTML = `
    <h2 style="margin:2px 0 8px">📒 उधारो · Udharo</h2>
    <div class="card today tight shoptoday" style="background:linear-gradient(135deg,#B91C1C,#7F1D1D)">
      <div class="row between" style="align-items:flex-end;gap:8px">
        <div><div class="label">To receive</div><div style="font-size:30px;font-weight:900;line-height:1.1">${money(total)}</div></div>
        <div class="small" style="text-align:right;line-height:1.35">${owing.length} ${owing.length === 1 ? 'person' : 'people'}<br>${BS_MONTHS[adToBs(t).m - 1]}: 📕 ${money(mo.given)} · 📗 ${money(mo.paid)}</div></div>
    </div>
    <div class="card tight" id="creditForm">
      <div class="row between" style="gap:6px;flex-wrap:wrap">
        <span class="chips" style="gap:4px"><button class="chip ${d.type !== 'paid' ? 'on' : ''}" data-act="crType" data-v="given">📕 उधारो दियो</button><button class="chip ${d.type === 'paid' ? 'on' : ''}" data-act="crType" data-v="paid">📗 तिर्यो</button></span>
        <span class="chips" style="gap:4px"><button class="chip sm ${d.date === t ? 'on' : ''}" data-act="bsQuick" data-key="credit" data-days="0">Today</button><button class="chip sm ${d.date === y ? 'on' : ''}" data-act="bsQuick" data-key="credit" data-days="-1">Yest.</button><button class="chip sm ${d.date !== t && d.date !== y ? 'on' : ''}" data-act="bsCalToggle" data-key="credit" aria-label="Other date">${calTile()}</button></span></div>
      ${bsDateHtml('credit', d.date, { chips: false })}
      <div class="hshop" style="grid-template-columns:1.4fr 1fr">
        <label><span>👤 Person</span><input data-cr="person" list="crNames" value="${esc(d.person)}" placeholder="Name" autocomplete="off"></label>
        <label><span>💰 Rs</span><input data-cr="amount" ${calcAttrs()} value="${esc(d.amount)}" placeholder="0"></label></div>
      <datalist id="crNames">${names.map(n => `<option value="${esc(n)}">`).join('')}${nickOpts.map(([n, of]) => `<option value="${esc(n)}">${esc(of)}</option>`).join('')}</datalist>
      <div class="row" style="gap:6px;margin-top:8px">
        <input data-cr="note" value="${esc(d.note || '')}" placeholder="${d.type === 'paid' ? 'Note (optional)' : 'What they took (optional)'}" autocomplete="off" style="flex:1;min-width:0;border:2px solid var(--line);border-radius:12px;padding:10px;font-size:16px;font-weight:700">
        <button class="btn green" data-act="crSave" style="padding:12px 18px;flex:none">✔ ${d.id ? 'Update' : 'Save'}</button></div>
      ${d.type === 'paid' ? `<div class="chips" style="gap:4px;margin-top:6px"><button class="chip sm ${d.pay !== 'qr' ? 'on' : ''}" data-act="crPay" data-v="cash">💵 Cash</button><button class="chip sm ${d.pay === 'qr' ? 'on' : ''}" data-act="crPay" data-v="qr">📱 QR</button></div>` : ''}
      <div class="small muted" id="crHint" style="margin-top:6px">${esc(creditHint(d))}</div>
      ${d.id ? `<div class="btnrow" style="margin-top:8px"><button class="btn sm ghost" data-act="crCancel">Cancel</button><button class="btn sm redl" data-act="deleteRec" data-id="${d.id}">🗑 Delete</button></div>${historyHtml(d.id)}` : ''}
    </div>
    ${total ? `<div class="card tight"><div class="label">How old is the udharo</div>
      ${[['Under 1 month', ages[0], 'var(--green)'], ['1 – 3 months', ages[1], 'var(--amber)'], ['Over 3 months', ages[2], 'var(--red)']].map(([l, v, c]) => `<div class="row" style="gap:8px;margin-top:6px"><span class="small" style="width:96px">${l}</span>
        <span style="flex:1;background:var(--line);border-radius:6px;height:12px;overflow:hidden"><i style="display:block;height:100%;width:${Math.round(v / maxAge * 100)}%;background:${c}"></i></span><b class="small" style="width:72px;text-align:right">${money(v)}</b></div>`).join('')}</div>` : ''}
    <div class="row between"><h3 style="margin:8px 0">👥 Who owes</h3><span class="small muted">${td.n ? `Today: 📕 ${money(td.given)} · 📗 ${money(td.paid)}` : ''}</span></div>
    ${owing.length ? owing.map(p => `<button class="item" data-act="crPerson" data-v="${esc(p.key)}">
      <div class="ic" style="background:var(--red-l)">👤</div><div class="mid"><div class="t">${esc(p.name)}${p.nicks.length ? ` <span class="small muted" style="font-weight:600">(${esc(p.nicks.join(', '))})</span>` : ''}</div>
      <div class="s">since ${fmtDate(p.oldest)}${p.age >= 30 ? ` · <b style="color:${p.age > 90 ? 'var(--red)' : 'var(--amber-d)'}">${p.age} days</b>` : ''} · last ${fmtDate(p.last)}</div></div>
      <div class="amt" style="color:var(--red)">${money(p.balance)}</div></button>`).join('') : '<p class="muted">Nobody owes anything 🎉</p>'}
    ${adv.length ? `<h3>Paid extra (advance)</h3>${adv.map(p => `<button class="item" data-act="crPerson" data-v="${esc(p.key)}"><div class="ic">👤</div><div class="mid"><div class="t">${esc(p.name)}</div></div><div class="amt" style="color:var(--green)">${money(-p.balance)}</div></button>`).join('')}` : ''}
    ${P.some(p => Math.abs(p.balance) <= 0.5) ? `<details style="margin-top:8px"><summary class="small muted" style="font-weight:800">✓ Settled (${P.filter(p => Math.abs(p.balance) <= 0.5).length})</summary>${P.filter(p => Math.abs(p.balance) <= 0.5).sort((a, b) => b.last.localeCompare(a.last)).map(p => `<button class="item" data-act="crPerson" data-v="${esc(p.key)}"><div class="ic">👤</div><div class="mid"><div class="t">${esc(p.name)}</div><div class="s">last ${fmtDate(p.last)}</div></div><div class="amt">✓</div></button>`).join('')}</details>` : ''}
    ${(() => { const rec = all('credit').sort((a, b) => b.createdAt - a.createdAt).slice(0, 15); return rec.length ? `<h3>🕒 Recent entries</h3>${rec.map(r => `<button class="item" data-act="crEdit" data-id="${r.id}">
      <div class="ic" style="background:${r.type === 'paid' ? 'var(--green-l)' : 'var(--red-l)'}">${r.type === 'paid' ? '📗' : '📕'}</div>
      <div class="mid"><div class="t">${esc(r.person)} · ${r.type === 'paid' ? 'paid back' + (r.pay === 'qr' ? ' (QR)' : '') : 'udharo'}</div><div class="s">${fmtDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''} · ${whoWhen(r)}</div></div>
      <div class="amt" style="color:${r.type === 'paid' ? 'var(--green)' : 'var(--red)'}">${r.type === 'paid' ? '−' : '+'}${money(r.amount)}</div></button>`).join('')}` : ''; })()}
    <div class="grid2" style="margin-top:12px"><button class="btn" data-act="crShareAll">💬 Share list</button><button class="btn" data-act="exportCsv" data-v="credit">📄 Udharo (CSV)</button></div>
    <p class="small muted" style="text-align:center">🎤 “Ram udharo 500” · “Ram le 300 tiryo” · “उधारो राम ५००”</p>`;
}
function creditHint(d) {
  const nm = crCanon(d.person), p = creditPeople()[personKey(nm)], a = num(d.amount) || 0;
  if (!normPerson(d.person)) return d.type === 'paid' ? 'Who paid back?' : 'Who took on credit?';
  const bal = p ? p.balance : 0, after = d.type === 'paid' ? bal - a : bal + a;
  return `${personKey(nm) !== personKey(d.person) ? normPerson(d.person) + ' = ' : ''}${nm}${p ? '' : ' (new)'}: owes ${money(bal)}${a ? ` → after this ${money(after)}` : ''}`;
}
function saveCredit() {
  $$('#creditForm [data-cr]').forEach(el => { creditDraft[el.dataset.cr] = el.value; });
  const d = creditDraft, person = crCanon(d.person), amount = num(d.amount);
  if (!person) { toast('Type the person\'s name'); return; }
  if (!amount) { toast('Type the amount'); return; }
  // same person typed with different capitals → use the name already in the book
  const ex = creditPeople()[personKey(person)];
  const rec = { kind: 'credit', date: d.date || today(), person: ex ? ex.name : person, type: d.type === 'paid' ? 'paid' : 'given', amount: round(amount, 2), note: String(d.note || '').trim() };
  if (rec.type === 'paid') rec.pay = d.pay === 'qr' ? 'qr' : 'cash';
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec);
  const bal = creditPeople()[personKey(rec.person)].balance;
  toast(`${rec.type === 'paid' ? '📗 Received' : '📕 Udharo'} ✓ ${rec.person} ${money(rec.amount)} · owes ${money(bal)}`, d.id ? null : rec.id);
  creditDraft = newCreditDraft(d.id ? null : { type: d.type }); renderCredit();
}
function openCreditPerson(key) {
  const p = creditPeople()[key]; if (!p) return;
  const list = crRecsOf(key).sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt);
  let run = 0; const rows = list.map(r => { run += (r.type === 'paid' ? -1 : 1) * (Number(r.amount) || 0); return { r, run }; }).reverse();
  openSheet(`<div class="row between" style="gap:8px"><h2 style="min-width:0;word-break:break-word">👤 ${esc(p.name)}</h2><button class="btn sm ghost" data-act="crRename" data-v="${esc(key)}" style="flex:none">✎ Name</button></div>
    <div class="chips" style="gap:6px;margin:-4px 0 10px;flex-wrap:wrap"><span class="small muted" style="align-self:center">Also called:</span>
      ${p.nicks.map(n => `<button class="chip sm" data-act="crNickDel" data-v="${esc(key)}" data-n="${esc(n)}" aria-label="Remove ${esc(n)}">${esc(n)} ✕</button>`).join('')}
      <button class="chip sm on" data-act="crNickAdd" data-v="${esc(key)}">+ Nickname</button></div>
    <div class="summary">
      <div class="line"><span>📕 Took on credit</span><b>${money(p.given)}</b></div>
      <div class="line"><span>📗 Paid back</span><b style="color:var(--green)">${money(p.paid)}</b></div>
      <div class="line"><span><b>${p.balance >= 0 ? 'Owes' : 'Advance'}</b>${p.oldest ? `<br><span class="small muted">unpaid since ${fmtDate(p.oldest, true)} (${p.age} days)</span>` : ''}</span><b style="font-size:24px;color:${p.balance > 0.5 ? 'var(--red)' : 'var(--green)'}">${money(Math.abs(p.balance))}</b></div></div>
    <div class="btnrow"><button class="btn" data-act="crAddFor" data-v="${esc(key)}" data-t="given">📕 + Udharo</button><button class="btn green" data-act="crAddFor" data-v="${esc(key)}" data-t="paid">📗 Received</button></div>
    <div class="btnrow" style="margin-top:8px">${p.balance > 0.5 ? `<button class="btn primary" data-act="crSettle" data-v="${esc(key)}">✔ Settle ${money(p.balance)}</button>` : ''}<button class="btn ghost" data-act="crShare" data-v="${esc(key)}">📤 Share</button></div>
    <h3>Ledger</h3>
    <div class="summary small">${rows.map(({ r, run }) => `<div class="line" data-act="crEdit" data-id="${r.id}" style="cursor:pointer">
      <span>${fmtDate(r.date, true)} · ${r.type === 'paid' ? '📗 paid' + (r.pay === 'qr' ? ' (QR)' : '') : '📕 udharo'}${r.note ? '<br><span class="muted">' + esc(r.note) + '</span>' : ''}<br><span class="muted" style="font-size:11px">${whoWhen(r)}</span></span>
      <b style="text-align:right;white-space:nowrap;color:${r.type === 'paid' ? 'var(--green)' : 'inherit'}">${r.type === 'paid' ? '−' : '+'}${money(r.amount)}<br><span class="small muted">= ${money(run)}</span></b></div>`).join('')}</div>
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}
function creditPersonText(key) {
  const p = creditPeople()[key];
  const list = crRecsOf(key).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return [`📒 ${p.name} — उधारो हिसाब`, ...list.map(r => `${fmtDate(r.date, true)} · ${r.type === 'paid' ? 'तिर्नुभयो' : 'उधारो'} ${money(r.amount)}${r.note ? ' (' + r.note + ')' : ''}`), '', `बाँकी / Due: ${money(p.balance)}`].join('\n');
}
function creditCsv() {
  const rows = [['Date (BS)', 'Date (AD)', 'Person', 'Type', 'Amount', 'Pay', 'Note', 'By']];
  all('credit').sort((a, b) => a.date.localeCompare(b.date)).forEach(r => rows.push([bsIso(r.date), r.date, r.person, r.type === 'paid' ? 'Paid back' : 'Udharo', r.type === 'paid' ? -r.amount : r.amount, r.pay || '', r.note || '', r.by || '']));
  return { rows, name: 'udharo-' + bsIso(today()) + '.csv' };
}

// ---------- voice: "Ram udharo 500", "Ram le 300 tiryo", "उधारो राम ५००", "Sita paid 200 qr" ----------
function parseCredit(text) {
  let t = ' ' + cleanNepali(text) + ' ';
  t = t.replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)));
  const given = /उधारो|उधार|\b(udharo|udhaaro|udhar|udhaar|credit)\b/i.test(t), paid = /तिर्यो|तिरे|तिर्नुभयो|फिर्ता|\b(tiryo|tirey|tire|tirnu|paid|returned|pay ?back)\b/i.test(t);
  if (!given && !paid) return null;
  let s = nepaliNumbers(t.toLowerCase());
  s = wordsToNumbers(s.replace(/उधारो|उधार|तिर्यो|तिरे|तिर्नुभयो|फिर्ता|रुपैयाँ|रुपैया|रु\.?|ले\b|लाई\b|को\b|ले(?=\s)|लाई(?=\s)/g, ' ')
    .replace(/\b(udharo|udhaaro|udhar|udhaar|credit|tiryo|tirey|tire|tirnu|paid|returned|pay back|payback|rs|rupees?|le|lai|ko|ne|gave|took|liyo|diyo|today|aaja|cash|qr|esewa|khalti)\b/g, ' '));
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
  const words = s.replace(/[\d.+*x×/-]+/g, ' ').replace(/\s+/g, ' ').trim();
  // the person: a known name in the sentence, else the leftover words
  const m = crNameMap(), said = ' ' + cleanNepali(String(text)).toLowerCase() + ' ';
  const known = Object.values(creditPeople()).flatMap(p => [p.name, ...p.nicks]).concat(Object.keys(m)).sort((a, b) => b.length - a.length).find(n => said.includes(' ' + n.toLowerCase() + ' '));
  return { intent: 'credit', type: paid && !given ? 'paid' : 'given', amount: nums.length ? nums[nums.length - 1] : null, person: crCanon(known || words.split(' ').slice(0, 3).join(' '), m), pay: /\b(qr|esewa|khalti|fonepay)\b|क्यूआर/i.test(text) ? 'qr' : 'cash', text };
}
function flowCredit(p, v) {
  if (view !== 'credit') { setSection('shop'); go('credit'); }
  creditDraft = Object.assign(newCreditDraft(), { type: p.type, person: p.person || '', amount: p.amount == null ? '' : p.amount, pay: p.pay });
  renderCredit();
  if (!p.person || !p.amount) { toast(!p.person ? 'Type the person\'s name' : 'Type the amount'); return; }
  ask({ title: 'Save?', sub: `Heard: “${p.text}”`,
    html: `<div class="summary"><div class="line"><span>${p.type === 'paid' ? '📗 Paid back' : '📕 Udharo'}</span><b>${esc(normPerson(p.person))}</b></div><div class="line"><span>Amount</span><b style="font-size:20px">${money(p.amount)}</b></div>
      <div class="line"><span class="small muted">${esc(creditHint(creditDraft))}</span><b></b></div></div>`,
    speech: `${p.type === 'paid' ? 'Received from' : 'Udharo to'} ${normPerson(p.person)}, ${sayMoney(p.amount)}. Save?`,
    buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }], voice: yesNo, voiceMode: v,
    onAnswer: a => { if (a === 'yes') saveCredit(); else if (a === 'no') { creditDraft = newCreditDraft(); renderCredit(); toast('Cancelled — nothing saved'); } } });
}

function creditClick(act, b) {
  const v = b.dataset.v, keep = () => $$('#creditForm [data-cr]').forEach(el => { creditDraft[el.dataset.cr] = el.value; });
  switch (act) {
    case 'crType': keep(); creditDraft.type = v; renderCredit(); return true;
    case 'crPay': keep(); creditDraft.pay = v; renderCredit(); return true;
    case 'crSave': saveCredit(); return true;
    case 'crCancel': creditDraft = newCreditDraft(); renderCredit(); return true;
    case 'crDatePick': creditDateOpen = !creditDateOpen; $('#creditDateBox').classList.toggle('hidden', !creditDateOpen); return true;
    case 'crPerson': openCreditPerson(v); return true;
    case 'crAddFor': { const p = creditPeople()[v]; closeSheet(); if (view !== 'credit') go('credit'); creditDraft = newCreditDraft({ person: p.name, type: b.dataset.t }); renderCredit(); window.scrollTo(0, 0); const a = $('#creditForm [data-cr=amount]'); if (a) a.focus(); return true; }
    case 'crSettle': { const p = creditPeople()[v];
      ask({ title: `Settle ${p.name}?`, sub: `Received ${money(p.balance)} — the account becomes 0.`, buttons: [{ label: `💵 Cash ${money(p.balance)}`, value: 'cash', cls: 'green' }, { label: `📱 QR ${money(p.balance)}`, value: 'qr', cls: 'ghost' }, { label: 'Cancel', value: 'no' }],
        onAnswer: a => { if (a === 'no') { openCreditPerson(v); return; } const rec = put({ kind: 'credit', date: today(), person: p.name, type: 'paid', amount: p.balance, pay: a, note: 'Settled' }); render(); toast(`✔ ${p.name} settled ${money(p.balance)}`, rec.id); openCreditPerson(v); } });
      return true; }
    case 'crShare': shareText(creditPersonText(v)); return true;
    case 'crRename': crRename(v); return true;
    case 'crNickAdd': crNickAdd(v); return true;
    case 'crNickDel': { const p = creditPeople()[v], n = b.dataset.n;
      ask({ title: `Remove nickname “${n}”?`, sub: `${p.name}'s entries stay as they are.`, buttons: [{ label: '✕ Remove', value: 'yes', cls: 'red' }, { label: 'Keep', value: 'no' }],
        onAnswer: a => { if (a === 'yes') { crSaveProfile(p.name, (p.nicks || []).filter(x => personKey(x) !== personKey(n))); toast(`Removed ${n}`); render(); } openCreditPerson(v); }, onCancel: () => openCreditPerson(v) });
      return true; }
    case 'crShareAll': { const P = Object.values(creditPeople()).filter(p => p.balance > 0.5).sort((a, c) => c.balance - a.balance);
      shareText([`📒 उधारो — ${fmtDate(today(), true)}`, ...P.map(p => `${p.name}: ${money(p.balance)}${p.age >= 30 ? ' (' + p.age + ' days)' : ''}`), '', `Total: ${money(P.reduce((a, p) => a + p.balance, 0))}`].join('\n')); return true; }
    case 'crEdit': closeSheet(); creditDraft = Object.assign({}, db.records[b.dataset.id]); if (view !== 'credit') { setSection('shop'); go('credit'); } else renderCredit(); window.scrollTo(0, 0); return true;
  }
  return false;
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.cr && creditDraft) { creditDraft[el.dataset.cr] = el.value; const h = $('#crHint'); if (h) h.textContent = creditHint(creditDraft); }
});

// ---------- rename / nicknames ----------
function crSaveProfile(name, nicks, oldName) {
  const pr = crProfileOf(oldName || name) || crProfileOf(name);
  const seen = {}, clean = nicks.map(normPerson).filter(n => n && personKey(n) !== personKey(name) && !seen[personKey(n)] && (seen[personKey(n)] = 1));
  return put(Object.assign({}, pr || { kind: 'cperson' }, { name, nicks: clean }));
}
// move every entry of these people to `to` (one put per entry, so each change is logged and synced)
function crMoveRecs(keys, to, m) {
  m = m || crNameMap(); let n = 0;
  all('credit').forEach(r => { if (keys.includes(personKey(crCanon(r.person, m))) && r.person !== to) { put(Object.assign({}, r, { person: to })); n++; } });
  return n;
}
function crRename(key) {
  const p = creditPeople()[key]; if (!p) return;
  const back = () => openCreditPerson(personKey(p.name));
  ask({ title: `✎ ${p.name}'s name`, sub: 'Type the new name. Old entries move to it; the old name is kept as a nickname.', input: { text: true, placeholder: p.name },
    onAnswer: t => {
      const nn = normPerson(t); if (!nn) { back(); return; }
      if (nn === p.name) { back(); return; }
      const m = crNameMap(), other = creditPeople()[personKey(crCanon(nn, m))];
      const go = mergeKey => {
        const target = mergeKey ? creditPeople()[mergeKey] : null, finalName = target ? target.name : nn;
        const nicks = [...(target ? target.nicks : []), ...p.nicks, ...(personKey(p.name) !== personKey(finalName) ? [p.name] : []), ...(target && personKey(nn) !== personKey(finalName) ? [nn] : [])];
        const moved = crMoveRecs([key], finalName, m);
        const own = crProfileOf(p.name);
        if (target && own && personKey(own.name) !== personKey(finalName)) removeRec(own.id);   // merged into the other person
        crSaveProfile(finalName, nicks, target ? finalName : p.name);
        render(); toast(`${target ? 'Merged' : 'Renamed'} ✓ ${p.name} → ${finalName} · ${moved} entr${moved === 1 ? 'y' : 'ies'}`); openCreditPerson(personKey(finalName));
      };
      if (other && other.key !== key) {
        ask({ title: `${other.name} is already in the book`, sub: `Same person? Merge ${p.name} (${money(p.balance)}) into ${other.name} (${money(other.balance)}).`,
          buttons: [{ label: `⇄ Merge into ${other.name}`, value: 'yes', cls: 'primary' }, { label: 'Cancel', value: 'no' }],
          onAnswer: a => a === 'yes' ? go(other.key) : back(), onCancel: back });
      } else go(null);
    }, onCancel: back });
}
function crNickAdd(key) {
  const p = creditPeople()[key]; if (!p) return;
  const back = () => openCreditPerson(key);
  ask({ title: `+ Nickname for ${p.name}`, sub: 'Other names people use, e.g. Rame, Ram dai, राम. Separate several with commas.', input: { text: true, placeholder: 'Rame, Ram dai, राम' },
    onAnswer: t => {
      const want = splitNicks(t).filter(n => personKey(n) !== key && !p.nicks.some(x => personKey(x) === personKey(n)));
      if (!want.length) { back(); return; }
      const m = crNameMap(), P = creditPeople();
      const taken = want.filter(n => { const c = personKey(crCanon(n, m)); return P[c] && c !== key && personKey(n) !== c; });   // already another person's nickname
      const others = want.filter(n => { const c = personKey(crCanon(n, m)); return P[c] && c !== key && personKey(n) === c; });  // a separate person with entries
      const add = want.filter(n => !taken.includes(n));
      const finish = mergeThem => {
        let moved = 0;
        if (mergeThem && others.length) {
          moved = crMoveRecs(others.map(personKey), p.name, m);
          others.forEach(n => { const pr = crProfileOf(n); if (pr) { add.push(...(pr.nicks || [])); removeRec(pr.id); } });
        }
        const keep = mergeThem ? add : add.filter(n => !others.includes(n));
        if (keep.length) crSaveProfile(p.name, [...p.nicks, ...keep]);
        render();
        toast(`${keep.length ? '✓ ' + p.name + ' also: ' + keep.join(', ') : 'Nothing added'}${moved ? ` · ${moved} entr${moved === 1 ? 'y' : 'ies'} merged` : ''}${taken.length ? ` · ${taken.join(', ')} already used for someone else` : ''}`);
        openCreditPerson(key);
      };
      if (others.length) {
        ask({ title: `${others.join(', ')} already ${others.length > 1 ? 'have' : 'has'} entries`, sub: `Same person as ${p.name}? Their entries move to ${p.name} (${others.map(n => n + ' ' + money(P[personKey(n)].balance)).join(', ')}).`,
          buttons: [{ label: `⇄ Yes, merge into ${p.name}`, value: 'yes', cls: 'primary' }, { label: 'No, different people', value: 'no' }],
          onAnswer: a => finish(a === 'yes'), onCancel: back });
      } else finish(false);
    }, onCancel: back });
}
