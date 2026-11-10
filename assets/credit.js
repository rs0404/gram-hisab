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
  // lowest first: Nepali spellings (so "राम बहादुर लाई उधारो ५००" finds Ram Bahadur), then nicknames, then main names
  all('credit').forEach(r => { const ne = typeof romanToNe === 'function' ? romanToNe(r.person) : ''; if (ne && !m[personKey(ne)]) m[personKey(ne)] = normPerson(r.person); });
  ps.forEach(p => { const ne = p.ne || (typeof romanToNe === 'function' ? romanToNe(p.name) : ''); if (ne) m[personKey(ne)] = p.name; });
  ps.forEach(p => (p.nicks || []).forEach(n => { m[personKey(n)] = p.name; }));
  ps.forEach(p => { m[personKey(p.name)] = p.name; });   // a main name wins over someone's nickname
  return m;
}
// Nepali spelling of a person's name: the one saved for them, else spelled from the Roman name
const crNe = name => { const pr = crProfileOf(name); return (pr && pr.ne) || (typeof romanToNe === 'function' ? romanToNe(name) : ''); };
const crNeHtml = (ne, cls) => ne ? ` <span class="${cls || 'crne'}" lang="ne">${esc(ne)}</span>` : '';
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
  Object.values(P).forEach(p => { const pr = crProfileOf(p.name); p.nicks = pr ? (pr.nicks || []) : []; p.ne = (pr && pr.ne) || (typeof romanToNe === 'function' ? romanToNe(p.name) : ''); p.balance = round(p.given - p.paid, 2); p.oldest = p.open.length ? p.open[0].date : ''; p.age = p.oldest ? daysBetween(p.oldest, today()) : 0; });
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
  $('#v-credit').innerHTML = `
    <h2 style="margin:2px 0 8px">📒 उधारो · Udharo</h2>
    <div class="card today tight shoptoday" style="background:linear-gradient(135deg,#B91C1C,#7F1D1D)">
      <div class="row between" style="align-items:flex-end;gap:8px">
        <div><div class="label">To receive</div><div style="font-size:30px;font-weight:900;line-height:1.1">${money(total)}</div></div>
        <div class="small" style="text-align:right;line-height:1.35">${owing.length} ${owing.length === 1 ? 'person' : 'people'}<br>${BS_MONTHS[adToBs(t).m - 1]}: 📕 ${money(mo.given)} · 📗 ${money(mo.paid)}</div></div>
    </div>
    <div class="card tight" id="creditForm">
      <div class="row between" style="gap:6px;flex-wrap:wrap">
        <span class="chips" style="gap:4px"><button class="chip ${d.type !== 'paid' ? 'on' : ''}" data-act="crType" data-v="given">📕 उधारो लिग्यो</button><button class="chip ${d.type === 'paid' ? 'on' : ''}" data-act="crType" data-v="paid">📗 तिर्यो</button></span>
        <span class="chips" style="gap:4px"><button class="chip sm ${d.date === t ? 'on' : ''}" data-act="bsQuick" data-key="credit" data-days="0">Today</button><button class="chip sm ${d.date === y ? 'on' : ''}" data-act="bsQuick" data-key="credit" data-days="-1">Yest.</button><button class="chip sm ${d.date !== t && d.date !== y ? 'on' : ''}" data-act="bsCalToggle" data-key="credit" aria-label="Other date">${calTile()}</button></span></div>
      ${bsDateHtml('credit', d.date, { chips: false })}
      <div class="hshop" style="grid-template-columns:1.4fr 1fr">
        <label><span>👤 Person</span><input data-cr="person" value="${esc(d.person)}" placeholder="Name or nickname" autocomplete="off" autocapitalize="words" spellcheck="false"></label>
        <label><span>💰 Rs</span><input data-cr="amount" ${calcAttrs()} value="${esc(d.amount)}" placeholder="0"></label></div>
      <div id="crSug" class="crsug hidden"></div>
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
    <button class="btn crbookbtn" data-act="crBook">🔍 Search udharo · 👥 All ${P.length} ${P.length === 1 ? 'person' : 'people'} · ${all('credit').length} entries</button>
    <div class="row between"><h3 style="margin:8px 0">👥 Who owes</h3><span class="small muted">${td.n ? `Today: 📕 ${money(td.given)} · 📗 ${money(td.paid)}` : ''}</span></div>
    ${owing.length ? owing.map(p => `<button class="item" data-act="crPerson" data-v="${esc(p.key)}">
      <div class="ic" style="background:var(--red-l)">👤</div><div class="mid"><div class="t">${esc(p.name)}${crNeHtml(p.ne)}${p.nicks.length ? ` <span class="small muted" style="font-weight:600">(${esc(p.nicks.join(', '))})</span>` : ''}</div>
      <div class="s">since ${fmtDate(p.oldest)}${p.age >= 30 ? ` · <b style="color:${p.age > 90 ? 'var(--red)' : 'var(--amber-d)'}">${p.age} days</b>` : ''} · last ${fmtDate(p.last)}</div></div>
      <div class="amt" style="color:var(--red)">${money(p.balance)}</div></button>`).join('') : '<p class="muted">Nobody owes anything 🎉</p>'}
    ${adv.length ? `<h3>Paid extra (advance)</h3>${adv.map(p => `<button class="item" data-act="crPerson" data-v="${esc(p.key)}"><div class="ic">👤</div><div class="mid"><div class="t">${esc(p.name)}${crNeHtml(p.ne)}</div></div><div class="amt" style="color:var(--green)">${money(-p.balance)}</div></button>`).join('')}` : ''}
    ${P.some(p => Math.abs(p.balance) <= 0.5) ? `<details style="margin-top:8px"><summary class="small muted" style="font-weight:800">✓ Settled (${P.filter(p => Math.abs(p.balance) <= 0.5).length})</summary>${P.filter(p => Math.abs(p.balance) <= 0.5).sort((a, b) => b.last.localeCompare(a.last)).map(p => `<button class="item" data-act="crPerson" data-v="${esc(p.key)}"><div class="ic">👤</div><div class="mid"><div class="t">${esc(p.name)}${crNeHtml(p.ne)}</div><div class="s">last ${fmtDate(p.last)}</div></div><div class="amt">✓</div></button>`).join('')}</details>` : ''}
    ${(() => { const rec = all('credit').sort((a, b) => b.createdAt - a.createdAt).slice(0, 15); return rec.length ? `<h3>🕒 Recent entries</h3>${rec.map(r => `<button class="item" data-act="crEdit" data-id="${r.id}">
      <div class="ic" style="background:${r.type === 'paid' ? 'var(--green-l)' : 'var(--red-l)'}">${r.type === 'paid' ? '📗' : '📕'}</div>
      <div class="mid"><div class="t">${esc(r.person)}${crNeHtml(crNe(r.person))} · ${r.type === 'paid' ? 'paid back' + (r.pay === 'qr' ? ' (QR)' : '') : 'udharo'}</div><div class="s">${fmtDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''} · ${whoWhen(r)}</div></div>
      <div class="amt" style="color:${r.type === 'paid' ? 'var(--green)' : 'var(--red)'}">${r.type === 'paid' ? '−' : '+'}${money(r.amount)}</div></button>`).join('')}` : ''; })()}
    <div class="grid2" style="margin-top:12px"><button class="btn" data-act="crShareAll">💬 Share list</button><button class="btn" data-act="exportCsv" data-v="credit">📄 Udharo (CSV)</button></div>
    <p class="small muted" style="text-align:center">🎤 “Ram udharo 500” · “Ram le 300 tiryo” · “उधारो राम ५००”</p>`;
}
function creditHint(d) {
  const nm = crCanon(d.person), p = creditPeople()[personKey(nm)], a = num(d.amount) || 0;
  if (!normPerson(d.person)) return d.type === 'paid' ? 'Who paid back?' : 'Who took on credit?';
  const bal = p ? p.balance : 0, after = d.type === 'paid' ? bal - a : bal + a;
  const ne = crNe(nm);
  return `${personKey(nm) !== personKey(d.person) ? normPerson(d.person) + ' = ' : ''}${nm}${ne ? ' · ' + ne : ''}${p ? '' : ' (new)'}: owes ${money(bal)}${a ? ` → after this ${money(after)}` : ''}`;
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
function openCreditPerson(key, back) {
  const p = creditPeople()[key]; if (!p) return;
  if (back === undefined && crBookBack && crBookBack.key === key) back = crBookBack.fn;   // reopened after rename / nickname
  crBookBack = back ? { key, fn: back } : null;
  const list = crRecsOf(key).sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt);
  let run = 0; const rows = list.map(r => { run += (r.type === 'paid' ? -1 : 1) * (Number(r.amount) || 0); return { r, run }; }).reverse();
  openSheet(`${back ? '<button class="btn sm ghost" data-act="sheetBack">‹ Udharo book</button>' : ''}<div class="row between" style="gap:8px"><h2 style="min-width:0;word-break:break-word;margin-bottom:2px">👤 ${esc(p.name)}</h2><button class="btn sm ghost" data-act="crRename" data-v="${esc(key)}" style="flex:none">✎ Name</button></div>
    <button class="crne-edit" data-act="crNeEdit" data-v="${esc(key)}"><span lang="ne">${esc(p.ne || 'नेपाली नाम')}</span> ✎</button>
    <div class="chips" style="gap:6px;margin:4px 0 10px;flex-wrap:wrap"><span class="small muted" style="align-self:center">Also called:</span>
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
  if (back) sheetBackFn = back;
}
function creditPersonText(key) {
  const p = creditPeople()[key];
  const list = crRecsOf(key).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return [`📒 ${p.ne ? p.ne + ' (' + p.name + ')' : p.name} — उधारो हिसाब`, ...list.map(r => `${fmtDate(r.date, true)} · ${r.type === 'paid' ? 'तिर्नुभयो' : 'उधारो'} ${money(r.amount)}${r.note ? ' (' + r.note + ')' : ''}`), '', `बाँकी / Due: ${money(p.balance)}`].join('\n');
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
  const given = /उधारो|उधार|लिग्यो|लग्यो|\b(udharo|udhaaro|udhar|udhaar|credit|ligyo|lagyo)\b/i.test(t), paid = /तिर्यो|तिरे|तिर्नुभयो|फिर्ता|\b(tiryo|tirey|tire|tirnu|paid|returned|pay ?back)\b/i.test(t);
  if (!given && !paid) return null;
  let s = nepaliNumbers(t.toLowerCase());
  s = wordsToNumbers(s.replace(/उधारो|उधार|लिग्यो|लग्यो|तिर्यो|तिरे|तिर्नुभयो|फिर्ता|रुपैयाँ|रुपैया|रु\.?|ले\b|लाई\b|को\b|ले(?=\s)|लाई(?=\s)/g, ' ')
    .replace(/\b(udharo|udhaaro|udhar|udhaar|credit|tiryo|tirey|tire|tirnu|paid|returned|pay back|payback|rs|rupees?|le|lai|ko|ne|gave|took|liyo|diyo|ligyo|lagyo|today|aaja|cash|qr|esewa|khalti)\b/g, ' '));
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
    html: `<div class="summary"><div class="line"><span>${p.type === 'paid' ? '📗 Paid back' : '📕 Udharo'}</span><b>${esc(normPerson(p.person))}${crNeHtml(crNe(p.person))}</b></div><div class="line"><span>Amount</span><b style="font-size:20px">${money(p.amount)}</b></div>
      <div class="line"><span class="small muted">${esc(creditHint(creditDraft))}</span><b></b></div></div>`,
    speech: `${p.type === 'paid' ? 'Received from' : 'Udharo to'} ${normPerson(p.person)}, ${sayMoney(p.amount)}. Save?`,
    buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }], voice: yesNo, voiceMode: v,
    onAnswer: a => { if (a === 'yes') saveCredit(); else if (a === 'no') { creditDraft = newCreditDraft(); renderCredit(); toast('Cancelled — nothing saved'); } } });
}

function creditClick(act, b) {
  if (crBookClick(act, b)) return true;
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
    case 'crNeEdit': { const p = creditPeople()[v];
      ask({ title: `नेपाली नाम · ${p.name}`, sub: `Now: ${p.ne || '—'}. Type how it is written in Nepali. Leave empty to spell it automatically.`, input: { text: true, allowEmpty: true, placeholder: p.ne || 'राम बहादुर', value: p.ne || '', preview: t => !normPerson(t) ? `Empty → spelled automatically: <b lang="ne">${esc(romanToNe(p.name) || '—')}</b>` : /[\u0900-\u097F]/.test(t) ? '' : `Saved as <b lang="ne">${esc(romanToNe(t))}</b>` },
        onAnswer: t => { const ne = normPerson(t); crSaveProfile(p.name, null, p.name, ne && !/[\u0900-\u097F]/.test(ne) && typeof romanToNe === 'function' ? romanToNe(ne) : ne); render(); toast(`✓ ${p.name} · ${crNe(p.name) || '—'}`); openCreditPerson(v); },
        onCancel: () => openCreditPerson(v) });
      return true; }
    case 'crNickAdd': crNickAdd(v); return true;
    case 'crNickDel': { const p = creditPeople()[v], n = b.dataset.n;
      ask({ title: `Remove nickname “${n}”?`, sub: `${p.name}'s entries stay as they are.`, buttons: [{ label: '✕ Remove', value: 'yes', cls: 'red' }, { label: 'Keep', value: 'no' }],
        onAnswer: a => { if (a === 'yes') { crSaveProfile(p.name, (p.nicks || []).filter(x => personKey(x) !== personKey(n))); toast(`Removed ${n}`); render(); } openCreditPerson(v); }, onCancel: () => openCreditPerson(v) });
      return true; }
    case 'crShareAll': { const P = Object.values(creditPeople()).filter(p => p.balance > 0.5).sort((a, c) => c.balance - a.balance);
      shareText([`📒 उधारो — ${fmtDate(today(), true)}`, ...P.map(p => `${p.name}${p.ne ? ' ' + p.ne : ''}: ${money(p.balance)}${p.age >= 30 ? ' (' + p.age + ' days)' : ''}`), '', `Total: ${money(P.reduce((a, p) => a + p.balance, 0))}`].join('\n')); return true; }
    case 'crEdit': closeSheet(); creditDraft = Object.assign({}, db.records[b.dataset.id]); if (view !== 'credit') { setSection('shop'); go('credit'); } else renderCredit(); window.scrollTo(0, 0); return true;
  }
  return false;
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.cr && creditDraft) { creditDraft[el.dataset.cr] = el.value; const h = $('#crHint'); if (h) h.textContent = creditHint(creditDraft); }
});

// ---------- rename / nicknames ----------
// shown under the name box while typing: the Nepali spelling of what is typed in Roman
const crNePreview = t => { const ne = typeof romanToNe === 'function' ? romanToNe(t) : ''; return ne ? `नेपालीमा: <b lang="ne">${esc(ne)}</b> <span class="muted">(you can correct it later on their page)</span>` : ''; };
function crSaveProfile(name, nicks, oldName, ne) {
  const pr = crProfileOf(oldName || name) || crProfileOf(name);
  if (ne !== undefined) return put(Object.assign({}, pr || { kind: 'cperson', nicks: [] }, { name, ne, nicks: nicks || (pr && pr.nicks) || [] }));
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
  ask({ title: `✎ ${p.name}'s name`, sub: 'Type the new name. Old entries move to it; the old name is kept as a nickname.', input: { text: true, placeholder: p.name, value: p.name, preview: crNePreview },
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
        const pr2 = crSaveProfile(finalName, nicks, target ? finalName : p.name);
        if (!target && pr2.ne) put(Object.assign({}, pr2, { ne: '' }));   // new name → spell it again (correct with ✎)
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
  ask({ title: `+ Nickname for ${p.name}`, sub: 'Other names people use, e.g. Rame, Ram dai, राम. Separate several with commas.', input: { text: true, placeholder: 'Rame, Ram dai, राम', preview: t => splitNicks(t).length ? splitNicks(t).map(n => `<span class="chip sm">${esc(n)}${romanToNe(n) ? ' · <span lang="ne">' + esc(romanToNe(n)) + '</span>' : ''}</span>`).join(' ') : '' },
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

// ---------- 🔍 fuzzy search: Rame ≈ Raame ≈ Rami, Bishal ≈ Visal, Sita ≈ Seeta, सीता ≈ सिता ----------
const crDigits = s => String(s || '').replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d));
function crSound(s) {
  s = crDigits(s).toLowerCase().normalize('NFC');
  if (/[ऀ-ॿ]/.test(s)) return s.replace(/[़ँंः्‌‍]/g, '').replace(/ी/g, 'ि').replace(/ू/g, 'ु').replace(/ई/g, 'इ').replace(/ऊ/g, 'उ')
    .replace(/[शष]/g, 'स').replace(/व/g, 'ब').replace(/ण/g, 'न').replace(/[ङञ]/g, 'न').replace(/[^ऀ-ॿ0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.replace(/[^a-z0-9 ]+/g, ' ').replace(/chh/g, 'ch').replace(/ph/g, 'f').replace(/([kgcjtdpb])h/g, '$1').replace(/sh|ss|z/g, 's').replace(/[vw]/g, 'b')
    .replace(/ee|ii|y(?=[^aeiou]|$)/g, 'i').replace(/oo|uu/g, 'u').replace(/aa/g, 'a').replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
}
function crLev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
// 0 = no match … 100 = exact. Every word of the query has to match some word of the text.
function crFuzzy(q, text) {
  const qs = crSound(q), ts = crSound(text);
  if (!qs) return 1; if (!ts) return 0;
  if (ts === qs) return 100;
  if (ts.startsWith(qs)) return 95;
  if (qs.length <= 2) return (' ' + ts).includes(' ' + qs) ? 90 : 0;   // 1–2 letters: only the start of a word
  if (ts.includes(qs)) return 85;
  const tw = ts.split(' ');
  let score = 100;
  for (const w of qs.split(' ')) {
    const tol = w.length <= 3 ? 0 : w.length <= 6 ? 1 : 2;
    let best = 0;
    for (const t of tw) {
      if (t.startsWith(w)) best = Math.max(best, 90);
      else if (t.includes(w)) best = Math.max(best, 70);
      else if (tol && crLev(w, t, tol) <= tol) best = Math.max(best, 65);
      else if (tol && t.length > w.length && crLev(w, t.slice(0, w.length), tol) <= tol) best = Math.max(best, 55);
    }
    if (!best) return 0;
    score = Math.min(score, best);
  }
  return score;
}
// best match of the query against a person's name, nicknames and Nepali name → { score, via }
function crPersonMatch(q, p) {
  if (!normPerson(q)) return { score: 1, via: '' };
  const neQ = typeof romanToNe === 'function' && normPerson(q).length >= 3 ? romanToNe(q) : '';
  let best = { score: 0, via: '' };
  const tryOne = (t, via) => { if (!t) return; const sc = Math.max(crFuzzy(q, t), neQ && /[ऀ-ॿ]/.test(t) ? crFuzzy(neQ, t) - 5 : 0); if (sc > best.score) best = { score: sc, via }; };
  tryOne(p.name, ''); tryOne(p.ne, ''); (p.nicks || []).forEach(n => tryOne(n, n));
  return best;
}
// amount typed as the search ("500", "Rs 1,500", "५००")
function crAmountQ(q) { const t = crDigits(q).replace(/rs\.?|रु\.?|,|\s/gi, ''); return /^\d+(\.\d+)?$/.test(t) ? t : ''; }
function crEntryMatch(q, r, personScore) {
  if (!normPerson(q)) return 1;
  const aq = crAmountQ(q);
  if (aq) { const a = String(Math.round((Number(r.amount) || 0) * 100) / 100); return a === aq ? 100 : a.includes(aq) ? 60 : 0; }
  return Math.max(personScore || 0, crFuzzy(q, r.note || '') - (r.note ? 0 : 100));
}

// ---------- 👤 suggestions under the Person box (tap keeps the keyboard open) ----------
function crSuggest() {
  const box = $('#crSug'), el = $('#creditForm [data-cr=person]');
  if (!box || !el) return;
  const q = el.value, P = Object.values(creditPeople());
  if (!normPerson(q) || document.activeElement !== el) { box.classList.add('hidden'); return; }
  const hits = P.map(p => ({ p, m: crPersonMatch(q, p) })).filter(x => x.m.score >= 50).sort((a, b) => b.m.score - a.m.score || Math.abs(b.p.balance) - Math.abs(a.p.balance));
  const exact = hits.length === 1 && hits[0].m.score === 100 && personKey(hits[0].p.name) === personKey(q);
  if (!hits.length || exact) { box.innerHTML = hits.length ? '' : `<span class="small muted">No match · “${esc(normPerson(q))}” will be a new person</span>`; box.classList.toggle('hidden', exact); return; }
  box.innerHTML = `<span class="small muted crsug-n">${hits.length} match${hits.length === 1 ? '' : 'es'}</span>` + hits.slice(0, 8).map(({ p, m }) => `<button type="button" class="crsug-i" data-keepkb data-act="crSugPick" data-v="${esc(p.name)}">
    <b>${esc(p.name)}</b>${crNeHtml(p.ne)}${m.via ? ` <span class="small muted">(${esc(m.via)})</span>` : ''}<span class="crsug-bal" style="color:${p.balance > 0.5 ? 'var(--red)' : 'var(--green)'}">${money(p.balance)}</span></button>`).join('')
    + (hits.length > 8 ? `<span class="small muted">+${hits.length - 8} more — keep typing</span>` : '');
  box.classList.remove('hidden');
}

// ---------- 📒 Udharo book: all people + search all entries ----------
let crBook = { q: '', tab: 'people', sort: 'owe', esort: 'new', by: '', type: '' }, crBookBack = null;
function crBookData() {
  const m = crNameMap(), P = creditPeople(), st = crBook, q = st.q;
  const recs = all('credit').filter(r => (!st.by || (r.by || '') === st.by) && (!st.type || (r.type === 'paid' ? 'paid' : 'given') === st.type));
  const info = {};   // per person: entries passing the filters, first added
  recs.forEach(r => { const k = personKey(crCanon(r.person, m)); const o = info[k] || (info[k] = { n: 0, first: Infinity, firstBy: '' }); o.n++; if ((r.createdAt || 0) < o.first) { o.first = r.createdAt || 0; o.firstBy = r.by || ''; } });
  const pm = {};
  Object.values(P).forEach(p => { pm[p.key] = crPersonMatch(q, p); });
  const aq = crAmountQ(q);
  const people = Object.values(P).filter(p => info[p.key] && (!normPerson(q) || (aq ? recs.some(r => personKey(crCanon(r.person, m)) === p.key && crEntryMatch(q, r) > 0) : pm[p.key].score >= 50 || recs.some(r => personKey(crCanon(r.person, m)) === p.key && crEntryMatch(q, r, 0) >= 50))))
    .map(p => Object.assign({}, p, { f: info[p.key], via: pm[p.key].via, score: pm[p.key].score }));
  const cmp = { name: (a, b) => a.name.localeCompare(b.name), new: (a, b) => b.f.first - a.f.first, owe: (a, b) => b.balance - a.balance, recent: (a, b) => (b.last || '').localeCompare(a.last || '') }[st.sort] || (() => 0);
  people.sort((a, b) => (q && !aq ? (b.score >= 90) - (a.score >= 90) : 0) || cmp(a, b));
  const entries = recs.map(r => ({ r, sc: crEntryMatch(q, r, (pm[personKey(crCanon(r.person, m))] || {}).score) })).filter(x => x.sc >= 50 || (!normPerson(q)))
    .sort((a, b) => ({ new: () => (b.r.createdAt || 0) - (a.r.createdAt || 0), date: () => (b.r.date || '').localeCompare(a.r.date || '') || b.r.createdAt - a.r.createdAt,
      amount: () => (Number(b.r.amount) || 0) - (Number(a.r.amount) || 0), name: () => crCanon(a.r.person, m).localeCompare(crCanon(b.r.person, m)) }[st.esort] || (() => 0))());
  const byList = [...new Set(all('credit').map(r => r.by || '').filter(Boolean))].sort();
  return { people, entries: entries.map(x => x.r), byList, m };
}
function openCreditBook() {
  openSheet(`<h2 style="margin-bottom:6px">📒 Udharo book</h2>
    <div class="crsearch"><input id="crQ" value="${esc(crBook.q)}" placeholder="🔍 Name, nickname, item or amount" autocomplete="off" spellcheck="false" enterkeyhint="search">
      <button type="button" class="crq-x ${crBook.q ? '' : 'hidden'}" data-keepkb data-act="crBookClear" aria-label="Clear">✕</button></div>
    <div id="crBookBody"></div>
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
  crBookRender();
}
function crBookRender() {
  const body = $('#crBookBody'); if (!body) return;
  const st = crBook, d = crBookData(), q = normPerson(st.q);
  const chip = (act, v, on, label) => `<button type="button" class="chip sm ${on ? 'on' : ''}" data-keepkb data-act="${act}" data-v="${esc(v)}">${label}</button>`;
  const people = st.tab === 'people';
  const sorts = people ? [['owe', 'Most owed'], ['name', 'Name A–Z'], ['new', 'Newest added'], ['recent', 'Last entry']] : [['new', 'Newest entered'], ['date', 'Date'], ['amount', 'Amount'], ['name', 'Name']];
  const owe = d.people.reduce((a, p) => a + Math.max(0, p.balance), 0);
  body.innerHTML = `
    <div class="chips hrow" style="margin:8px 0 4px">${chip('crbTab', 'people', people, `👥 People <b>${d.people.length}</b>`)}${chip('crbTab', 'entries', !people, `📜 Entries <b>${d.entries.length}</b>`)}</div>
    <div class="chips hrow"><span class="small muted crlab">Type</span>${chip('crbType', '', !st.type, 'All')}${chip('crbType', 'given', st.type === 'given', '📕 लिग्यो')}${chip('crbType', 'paid', st.type === 'paid', '📗 तिर्यो')}</div>
    ${d.byList.length > 1 ? `<div class="chips hrow"><span class="small muted crlab">Entered by</span>${chip('crbBy', '', !st.by, 'Everyone')}${d.byList.map(b => chip('crbBy', b, st.by === b, '👤 ' + esc(b))).join('')}</div>` : ''}
    <div class="chips hrow"><span class="small muted crlab">Sort</span>${sorts.map(([k, l]) => chip(people ? 'crbSort' : 'crbESort', k, (people ? st.sort : st.esort) === k, l)).join('')}</div>
    <div class="small muted" style="margin:6px 2px">${q ? `“${esc(q)}”: ` : ''}<b>${d.people.length}</b> ${d.people.length === 1 ? 'person' : 'people'} · <b>${d.entries.length}</b> entr${d.entries.length === 1 ? 'y' : 'ies'}${people && owe ? ` · to receive <b style="color:var(--red)">${money(owe)}</b>` : ''}${st.by ? ' · by ' + esc(st.by) : ''}</div>
    ${people ? (d.people.length ? d.people.map(p => `<button class="item" data-act="crBookPerson" data-v="${esc(p.key)}">
        <div class="ic" style="background:${p.balance > 0.5 ? 'var(--red-l)' : 'var(--green-l)'}">👤</div>
        <div class="mid"><div class="t">${esc(p.name)}${crNeHtml(p.ne)}</div>
          <div class="s">${p.via ? `matched <b>${esc(p.via)}</b> · ` : p.nicks.length ? esc(p.nicks.join(', ')) + ' · ' : ''}<b>${p.f.n}</b> entr${p.f.n === 1 ? 'y' : 'ies'}${st.by || st.type ? '' : ''} · added ${p.f.first < Infinity ? fmtDate(iso(new Date(p.f.first))) : '—'}${p.f.firstBy ? ' by ' + esc(p.f.firstBy) : ''}</div>
          <div class="s">📜 Ledger ›${p.last ? ' · last ' + fmtDate(p.last) : ''}</div></div>
        <div class="amt" style="color:${p.balance > 0.5 ? 'var(--red)' : p.balance < -0.5 ? 'var(--green)' : 'var(--muted)'}">${Math.abs(p.balance) <= 0.5 ? '✓ 0' : money(Math.abs(p.balance))}<small>${p.balance > 0.5 ? 'owes' : p.balance < -0.5 ? 'advance' : 'settled'}</small></div></button>`).join('')
      : '<p class="muted">No one matches.</p>')
    : (d.entries.length ? d.entries.slice(0, 200).map(r => `<button class="item" data-act="crEdit" data-id="${r.id}">
        <div class="ic" style="background:${r.type === 'paid' ? 'var(--green-l)' : 'var(--red-l)'}">${r.type === 'paid' ? '📗' : '📕'}</div>
        <div class="mid"><div class="t">${esc(crCanon(r.person, d.m))}${crNeHtml(crNe(crCanon(r.person, d.m)))}${personKey(r.person) !== personKey(crCanon(r.person, d.m)) ? ` <span class="small muted">(${esc(r.person)})</span>` : ''}</div>
          <div class="dt">📅 ${fmtDate(r.date)} · ${r.type === 'paid' ? 'paid back' + (r.pay === 'qr' ? ' (QR)' : '') : 'udharo'}${r.note ? ' · ' + esc(r.note) : ''}</div><div class="s">${whoWhen(r)}</div></div>
        <div class="amt" style="color:${r.type === 'paid' ? 'var(--green)' : 'var(--red)'}">${r.type === 'paid' ? '−' : '+'}${money(r.amount)}</div></button>`).join('') + (d.entries.length > 200 ? `<p class="small muted">Showing 200 of ${d.entries.length} — search to narrow down.</p>` : '')
      : '<p class="muted">No entries match.</p>')}`;
  const x = $('#sheet .crq-x'); if (x) x.classList.toggle('hidden', !st.q);
}
function crBookClick(act, b) {
  const v = b.dataset.v;
  switch (act) {
    case 'crBook': crBook.q = ''; openCreditBook(); setTimeout(() => { const q = $('#crQ'); if (q) q.focus(); }, 250); return true;
    case 'crBookClear': crBook.q = ''; { const q = $('#crQ'); if (q) { q.value = ''; q.focus(); } } crBookRender(); return true;
    case 'crbTab': crBook.tab = v; crBookRender(); return true;
    case 'crbType': crBook.type = v; crBookRender(); return true;
    case 'crbBy': crBook.by = v; crBookRender(); return true;
    case 'crbSort': crBook.sort = v; crBookRender(); return true;
    case 'crbESort': crBook.esort = v; crBookRender(); return true;
    case 'crBookPerson': { if (document.activeElement) document.activeElement.blur(); const sc = $('#sheet').scrollTop; openCreditPerson(v, () => { openCreditBook(); $('#sheet').scrollTop = sc; }); return true; }
    case 'crSugPick': { const el = $('#creditForm [data-cr=person]'); if (!el) return true; el.value = v; creditDraft.person = v; const h = $('#crHint'); if (h) h.textContent = creditHint(creditDraft);
      $('#crSug').classList.add('hidden'); const a = $('#creditForm [data-cr=amount]'); if (a) a.focus(); return true; }
  }
  return false;
}
document.addEventListener('input', e => {
  if (e.target.id === 'crQ') { crBook.q = e.target.value; crBookRender(); }
  else if (e.target.dataset && e.target.dataset.cr === 'person') crSuggest();
});
document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.cr === 'person') crSuggest(); });
document.addEventListener('focusout', e => { if (e.target.dataset && e.target.dataset.cr === 'person') setTimeout(() => { if (document.activeElement !== e.target) { const b = $('#crSug'); if (b) b.classList.add('hidden'); } }, 150); });
// buttons marked data-keepkb act without taking the focus away from the field being typed in → the keyboard stays up
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('[data-keepkb]') && typeof isField === 'function' && isField(document.activeElement)) e.preventDefault(); }, true);
