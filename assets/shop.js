/* Gram Hisab — Shop register: daily cash + QR collection and goods bought */
'use strict';

let shopDraft = null;
let shopTab = 'daily', shopDateOpen = false, shopNoteOpen = false;

function shopSum(list) {
  const o = { cash: 0, qr: 0, goods: 0, n: list.length, days: new Set(list.map(r => r.date)).size };
  list.forEach(r => { o.cash += Number(r.cash) || 0; o.qr += Number(r.qr) || 0; o.goods += Number(r.goods) || 0; });
  o.total = o.cash + o.qr;
  o.net = o.total - o.goods;
  return o;
}
function shopEntries(from, to) { return all('shop').filter(r => r.date >= from && r.date <= to); }
// chicken money is collected at the same counter: optionally show the shop's own amount (collected − chicken sales)
// only on days the shop was recorded (a day without a shop entry has nothing to take it out of)
function chickenSales(from, to, days) { return all('sale').filter(r => r.date >= from && r.date <= to && (!days || days.has(r.date))).reduce((a, r) => a + (Number(r.amount) || 0), 0); }
function shopRange(from, to) { const list = shopEntries(from, to), o = shopSum(list); o.chicken = chickenSales(from, to, new Set(list.map(r => r.date))); o.own = o.total - o.chicken; return o; }
const shopLess = () => !!db.meta.shopLessChicken;
const shopShown = o => shopLess() ? o.own : o.total;
const shopSplit = o => shopLess() ? `Collected ${money(o.total)} − 🐔 chicken ${money(o.chicken)}` : '';

// ---------- entry form ----------
function newShopDraft(date) { return { kind: 'shop', date: date || today(), cash: '', qr: '', goods: '', note: '' }; }
function shopFormHtml(d) {
  const editing = !!d.id, t = today(), y = addDays(t, -1);
  const box = (f, label) => `<label><span>${label}</span><input data-s="${f}" ${calcAttrs()} value="${esc(d[f] == null || d[f] === 0 ? '' : d[f])}" placeholder="0"></label>`;
  return `<div class="card tight" id="shopForm">
    <div class="row between" style="gap:6px;flex-wrap:wrap">
      <b>${editing ? '✎ Edit' : '➕ Add'} · ${d.date === t ? 'आज Today' : esc(fmtDate(d.date))}</b>
      <span class="chips" style="gap:4px">
        <button class="chip sm ${d.date === t ? 'on' : ''}" data-act="bsQuick" data-key="shop" data-days="0">Today</button>
        <button class="chip sm ${d.date === y ? 'on' : ''}" data-act="bsQuick" data-key="shop" data-days="-1">Yesterday</button>
        <button class="chip sm ${d.date !== t && d.date !== y ? 'on' : ''}" data-act="bsCalToggle" data-key="shop" aria-label="Other date">${calTile()}</button></span></div>
    ${bsDateHtml('shop', d.date, { chips: false })}
    <div class="hshop shopboxes">${box('cash', '💵 Cash')}${box('qr', '📱 QR')}${box('goods', '📦 Goods')}</div>
    <div class="row between" style="margin-top:8px;gap:8px">
      <span style="min-width:0"><span class="small muted">Collected</span> <b id="shopTotal" style="font-size:20px;color:var(--green)">${money((num(d.cash) || 0) + (num(d.qr) || 0))}</b><br><span class="small muted" id="shopNetTxt">${shopFormNet(d)}</span></span>
      <span class="row" style="gap:6px;flex:none"><button class="btn sm ghost" data-act="shopNoteToggle" aria-label="Note">📝</button><button class="btn green" data-act="saveShop" style="padding:12px 18px">✔ ${editing ? 'Update' : 'Save'}</button></span></div>
    <div class="field ${d.note || shopNoteOpen ? '' : 'hidden'}" id="shopNoteBox" style="margin:8px 0 0"><input data-s="note" value="${esc(d.note || '')}" placeholder="Note (optional)" autocomplete="off"></div>
    ${editing ? `<div class="btnrow" style="margin-top:8px"><button class="btn sm ghost" data-act="cancelShopEdit">Cancel</button><button class="btn sm redl" data-act="deleteShop" data-id="${d.id}">🗑 Delete</button></div>${historyHtml(d.id)}` : ''}
  </div>`;
}
function shopFormNet(d) {
  const t = (num(d.cash) || 0) + (num(d.qr) || 0), g = num(d.goods) || 0;
  return g ? `after goods: ${money(t - g)}` : 'cash + QR';
}
function shopInput(el) {
  const d = shopDraft;
  d[el.dataset.s] = el.value;
  const t = $('#shopTotal'), n = $('#shopNetTxt');
  if (t) t.textContent = money((num(d.cash) || 0) + (num(d.qr) || 0));
  if (n) n.textContent = shopFormNet(d);
}
function saveShopForm() {
  $$('#shopForm [data-s]').forEach(el => { shopDraft[el.dataset.s] = el.value; });
  const d = shopDraft;
  const rec = { kind: 'shop', date: d.date || today(), cash: num(d.cash) || 0, qr: num(d.qr) || 0, goods: num(d.goods) || 0, note: String(d.note || '').trim() };
  if (!rec.cash && !rec.qr && !rec.goods) { toast('Enter cash, QR or goods amount'); return; }
  if (d.id) { rec.id = d.id; rec.createdAt = d.createdAt; }
  put(rec);
  const day = shopRange(rec.date, rec.date);
  toast(`${d.id ? 'Updated' : 'Saved'} ✓ ${fmtDate(rec.date)}: collected ${money(day.total)} · goods ${money(day.goods)}`, d.id ? null : rec.id);
  shopDraft = newShopDraft(rec.date);
  renderShop();
}

// ---------- reports ----------
function weekStart(adIso) { const d = new Date(adIso + 'T12:00:00'); return addDays(adIso, -d.getDay()); } // Nepali week starts Sunday
function shopReportRows(tab) {
  const t = today(), rows = [];
  if (tab === 'daily') {
    for (let i = 0; i < 31; i++) { const d = addDays(t, -i); rows.push({ label: fmtDate(d), sub: DAY[new Date(d + 'T12:00').getDay()], from: d, to: d }); }
  } else if (tab === 'weekly') {
    let ws = weekStart(t);
    for (let i = 0; i < 12; i++) {
      const we = addDays(ws, 6);
      rows.push({ label: bsLabel(ws) + ' – ' + (adToBs(ws).m === adToBs(we).m ? adToBs(we).d : bsLabel(we)), sub: i === 0 ? 'This week' : i === 1 ? 'Last week' : '', from: ws, to: we > t ? t : we });
      ws = addDays(ws, -7);
    }
  } else {
    let b = adToBs(t);
    for (let i = 0; i < 12; i++) {
      const from = bsToAd(b.y, b.m, 1), to = bsToAd(b.y, b.m, bsDays(b.y, b.m));
      rows.push({ label: BS_MONTHS[b.m - 1] + ' ' + b.y, sub: i === 0 ? 'This month' : '', from, to: to > t ? t : to });
      b = b.m === 1 ? { y: b.y - 1, m: 12 } : { y: b.y, m: b.m - 1 };
    }
  }
  rows.forEach(r => { r.s = shopRange(r.from, r.to); });
  return rows;
}
function shopBars(rows) {
  const list = rows.slice(0, 12).reverse();
  const max = Math.max(1, ...list.map(r => Math.max(shopShown(r.s), r.s.goods)));
  return `<div class="bars" style="height:150px">${list.map(r => `<div class="bar" data-act="shopDay" data-d="${r.from}" style="cursor:pointer">
      <em>${shopShown(r.s) ? shortMoney(shopShown(r.s)) : ''}</em>
      <div style="display:flex;gap:2px;align-items:flex-end;height:100%;width:100%;justify-content:center">
        <i style="height:${Math.max(0, Math.round(shopShown(r.s) / max * 100))}%;background:var(--green);max-width:16px"></i>
        <i style="height:${Math.round(r.s.goods / max * 100)}%;background:var(--red);max-width:16px"></i></div>
      <small>${shopTab === 'monthly' ? r.label.slice(0, 3) : shopTab === 'weekly' ? bsLabel(r.from).replace(/^(\w{3})\w*/, '$1') : adToBs(r.from).d}</small></div>`).join('')}</div>
    <div class="row small" style="justify-content:center;gap:14px;margin-top:6px"><span><b style="color:var(--green)">■</b> ${shopLess() ? 'Shop only (after chicken)' : 'Collected (cash + QR)'}</span><span><b style="color:var(--red)">■</b> Goods bought</span></div>`;
}
// one day (daily), one week or one month of shop entries, opened from a chart bar
function openShopDay(from, title) {
  const rows = shopReportRows(shopTab), r = rows.find(x => x.from === from) || { label: fmtDate(from, true), from, to: from };
  if (title && r.from === r.to) r.label = title + ' · ' + fmtDate(from, true).replace(/^(Today|Yesterday) · /, '');
  const list = shopEntries(r.from, r.to).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const s = shopRange(r.from, r.to);
  openSheet(`<h2>🏪 ${esc(r.label)}</h2>
    <div class="summary">
      <div class="line"><span>💵 Cash</span><b>${money(s.cash)}</b></div><div class="line"><span>📱 QR</span><b>${money(s.qr)}</b></div>
      <div class="line"><span>Collected</span><b style="font-size:${shopLess() ? 18 : 22}px;color:var(--green)">${money(s.total)}</b></div>
      ${s.chicken ? `<div class="line"><span>🐔 Chicken sales</span><b>− ${money(s.chicken)}</b></div>` : ''}
      ${shopLess() ? `<div class="line"><span><b>Shop only</b></span><b style="font-size:22px;color:var(--green)">${money(s.own)}</b></div>` : ''}
      <div class="line"><span>📦 Goods bought</span><b style="color:var(--red)">${money(s.goods)}</b></div>
      <div class="line"><span>${shopLess() ? 'Shop only − goods' : 'Collected − goods'}</span><b>${money(shopShown(s) - s.goods)}</b></div></div>
    ${list.length ? list.map(x => `<button class="item" data-act="editShopFromDay" data-id="${x.id}"><div class="ic" style="background:var(--green-l)">🏪</div>
      <div class="mid"><div class="t">${fmtDate(x.date)} · Collected ${money((Number(x.cash) || 0) + (Number(x.qr) || 0))}${x.goods ? ' · Goods ' + money(x.goods) : ''}</div>
      <div class="s">Cash ${money(x.cash)} · QR ${money(x.qr)} · ${whoWhen(x)}</div></div><div class="amt">✎</div></button>`).join('') : '<p class="muted">No entries.</p>'}
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}
function renderShop() {
  if (!shopDraft) shopDraft = newShopDraft();
  const t = today();
  const td = shopRange(t, t), wk = shopRange(weekStart(t), t), mo = shopRange(bsMonthStart(t), t);
  const rows = shopReportRows(shopTab);
  const withData = rows.filter(r => r.s.n);
  const tot = withData.length ? shopRange(rows[rows.length - 1].from, rows[0].to) : Object.assign(shopSum([]), { chicken: 0, own: 0 });
  const avgDays = tot.days || 1;
  const yd = addDays(t, -1), yy = shopRange(yd, yd);
  const mini = (o, label, from, to) => `<button class="card tight shopmini" data-act="shopRange" data-from="${from}" data-to="${to}" data-label="${esc(label)}">
      <div class="label">${esc(label)}</div><div class="v">${money(shopShown(o))}</div><div class="small muted">📦 ${shortMoney(o.goods)}${shopLess() && o.chicken ? ' · 🐔 −' + shortMoney(o.chicken) : ''} ›</div></button>`;
  $('#v-shop').innerHTML = `
    <div class="row between" style="margin:2px 0 8px"><h2 style="margin:0">🏪 Shop</h2>
      <label class="minitoggle" title="Take chicken sales out of the collection"><span>−🐔</span><input type="checkbox" data-act="shopLessChicken" ${shopLess() ? 'checked' : ''}></label></div>
    <div class="card today tight shoptoday">
      <div class="row between" style="align-items:flex-end;gap:8px">
        <div><div class="label">${shopLess() ? 'Today · shop only' : 'Today collected'}</div><div style="font-size:30px;font-weight:900;line-height:1.1">${money(shopShown(td))}</div></div>
        <div class="small" style="text-align:right;line-height:1.35">💵 ${money(td.cash)} · 📱 ${money(td.qr)}<br>📦 ${money(td.goods)}${shopLess() && td.chicken ? ' · 🐔 −' + money(td.chicken) : ''}</div></div>
    </div>
    ${shopFormHtml(shopDraft)}
    <div class="grid3" style="margin-bottom:12px">${mini(yy, 'Yesterday', yd, yd)}${mini(wk, 'This week', weekStart(t), t)}${mini(mo, BS_MONTHS[adToBs(t).m - 1], bsMonthStart(t), t)}</div>
    ${(() => { const rec = all('shop').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 12); return rec.length ? `<h3>🕒 Recent entries <span class="small muted">· tap to edit</span></h3>${rec.map(r => `<button class="item" data-act="editShop" data-id="${r.id}">
      <div class="ic" style="background:var(--green-l)">🏪</div>
      <div class="mid"><div class="t">${fmtDate(r.date)} · ${money((Number(r.cash) || 0) + (Number(r.qr) || 0))}${r.goods ? ' · goods ' + money(r.goods) : ''}</div>
      <div class="s">Cash ${money(r.cash)} · QR ${money(r.qr)}${r.note ? ' · ' + esc(r.note) : ''} · ${whoWhen(r)}</div></div>
      <div class="amt"></div></button>`).join('')}` : ''; })()}

    <h2>Report</h2>
    <div class="seg">${[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([k, l]) => `<button class="${shopTab === k ? 'on' : ''}" data-act="shopTab" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="card">${shopBars(rows)}<div class="small muted" style="text-align:center;margin-top:4px">Tap a bar to see its details</div></div>
    <div class="summary">
      <div class="line"><span><b>${shopTab === 'daily' ? 'Last 31 days' : shopTab === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}</b></span><b></b></div>
      <div class="line"><span>💵 Cash</span><b>${money(tot.cash)}</b></div>
      <div class="line"><span>📱 QR</span><b>${money(tot.qr)}</b></div>
      <div class="line"><span>Collected total</span><b style="color:var(--green);font-size:${shopLess() ? 17 : 20}px">${money(tot.total)}</b></div>
      ${tot.chicken ? `<div class="line"><span>🐔 Chicken sales (on shop days)</span><b>− ${money(tot.chicken)}</b></div>` : ''}
      ${shopLess() ? `<div class="line"><span><b>Shop only</b></span><b style="color:var(--green);font-size:20px">${money(tot.own)}</b></div>` : ''}
      <div class="line"><span>📦 Goods bought</span><b style="color:var(--red)">${money(tot.goods)}</b></div>
      <div class="line"><span>${shopLess() ? 'Shop only − goods' : 'Collected − goods'}</span><b>${money(shopShown(tot) - tot.goods)}</b></div>
      <div class="line"><span>Average per day (${tot.days} days recorded)</span><b>${money(shopShown(tot) / avgDays)} · goods ${money(tot.goods / avgDays)}</b></div>
    </div>
    ${rows.map(r => r.s.n || shopTab !== 'daily' ? `<div class="card tight" style="margin-bottom:6px">
      <div class="row between"><div><b>${esc(r.label)}</b> <span class="small muted">${esc(r.sub)}</span></div><b style="color:var(--green);font-size:19px">${money(shopShown(r.s))}</b></div>
      ${shopLess() && r.s.chicken ? `<div class="small muted">${shopSplit(r.s)}</div>` : ''}
      <div class="row between small muted" style="margin-top:2px"><span>Cash ${money(r.s.cash)} · QR ${money(r.s.qr)}</span><span style="color:var(--red)">Goods ${money(r.s.goods)}</span></div>
      ${shopTab !== 'daily' && r.s.days ? `<div class="small muted">${r.s.days} days · avg ${money(shopShown(r.s) / r.s.days)}/day</div>` : ''}
    </div>` : '').join('') || '<p class="muted">No shop entries yet.</p>'}
    <div class="grid2" style="margin-top:10px"><button class="btn" data-act="shareShop">💬 Share report</button><button class="btn" data-act="exportCsv" data-v="shop">📄 Shop (CSV)</button></div>
    <p class="muted small" style="text-align:center">Or tap 🎤 and say “shop cash 5000 QR 3000 goods 2000” / “पसल नगद पाँच हजार क्यूआर तीन हजार”</p>`;
}
function shopReportText() {
  const rows = shopReportRows(shopTab).filter(r => r.s.n);
  const t = today(), td = shopRange(t, t), mo = shopRange(bsMonthStart(t), t);
  const own = o => shopLess() ? ` · shop only ${money(o.own)} (after chicken ${money(o.chicken)})` : '';
  return [`🏪 Shop — ${fmtDate(t, true)}`, `Today: collected ${money(td.total)} (cash ${money(td.cash)}, QR ${money(td.qr)})${own(td)}, goods ${money(td.goods)}`,
    `${BS_MONTHS[adToBs(t).m - 1]}: collected ${money(mo.total)}${own(mo)}, goods ${money(mo.goods)}`, '',
    ...rows.slice(0, 14).map(r => `${r.label}: ${money(r.s.total)} (cash ${money(r.s.cash)}, QR ${money(r.s.qr)})${own(r.s)} · goods ${money(r.s.goods)}`)].join('\n');
}

// ---------- voice ----------
// "shop cash 5000 qr 3000 goods 2000", "पसल नगद पाँच हजार क्यूआर तीन हजार सामान दुई हजार"
function parseShop(p, ctx) {
  p.intent = 'shop';
  const labels = { cash: 'cash', qr: 'qr', goods: 'goods|bought|purchase|purchased|stock' };
  const firstLabel = ctx.s.search(/\b(cash|qr|goods|bought|purchase|purchased|stock)\b/), firstNum = ctx.s.search(/\d/);
  const numFirst = firstNum >= 0 && (firstLabel < 0 || firstNum < firstLabel);
  const after = l => new RegExp('\\b(?:' + l + ')\\s*(?:ma|bata|ko|le|from|in|by|of|is)?\\s*(?:rs\\s*)?(\\d+(?:\\.\\d+)?)');
  const before = l => new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:rs\\s*)?(?:in\\s+|by\\s+|ko\\s+|of\\s+)?(?:' + l + ')\\b');
  const grab = l => { let m = take(ctx, numFirst ? before(l) : after(l)) || take(ctx, numFirst ? after(l) : before(l)); return m ? parseFloat(m[1]) : null; };
  p.cash = grab(labels.cash); p.qr = grab(labels.qr); p.goods = grab(labels.goods);
  const rest = numbersLeft(ctx);
  p.loose = rest.length ? rest[0] : null;
}
function flowShop(p, v) {
  if (p.cash == null && p.qr == null && p.goods == null) {
    if (p.loose == null) { goShop(); if (v) sayShop(v); return; }
    ask({ title: `${money(p.loose)} — what is it?`, speech: `${sayMoney(p.loose)}. Is it cash, QR, or goods bought?`, hint: 'Say “cash”, “QR” or “goods”',
      buttons: [{ label: '💵 Cash collected', value: 'cash', cls: 'ghost' }, { label: '📱 QR collected', value: 'qr', cls: 'ghost' }, { label: '📦 Goods bought', value: 'goods', cls: 'ghost' }],
      voice: t => { const x = normalize(t).s; return /\bcash\b/.test(x) ? 'cash' : /\bqr\b/.test(x) ? 'qr' : /\b(goods|bought)\b/.test(x) ? 'goods' : undefined; },
      voiceMode: v, onAnswer: k => { p[k] = p.loose; p.loose = null; flowShop(p, v); } });
    return;
  }
  const rec = { kind: 'shop', date: p.date || today(), cash: p.cash || 0, qr: p.qr || 0, goods: p.goods || 0, note: '' };
  const save = () => {
    put(rec); render();
    const day = shopRange(rec.date, rec.date);
    toast(`Saved ✓ shop ${fmtDate(rec.date)}: collected ${money(day.total)} · goods ${money(day.goods)}`, rec.id);
    if (v) speak(`Saved. ${rec.date === today() ? 'Today' : fmtDate(rec.date)} the shop collected ${sayMoney(day.total)}${day.goods ? ', and goods bought ' + sayMoney(day.goods) : ''}.`);
  };
  if (!db.meta.confirmVoice) return save();
  ask({ title: 'Save shop entry?', sub: p.text ? `Heard: “${p.text}”` : '',
    html: `<div class="summary"><div class="line"><span>Date</span><b>${fmtDate(rec.date, true)}</b></div>
      <div class="line"><span>💵 Cash</span><b>${money(rec.cash)}</b></div><div class="line"><span>📱 QR</span><b>${money(rec.qr)}</b></div>
      <div class="line"><span>Collected</span><b style="color:var(--green);font-size:22px">${money(rec.cash + rec.qr)}</b></div>
      <div class="line"><span>📦 Goods bought</span><b style="color:var(--red)">${money(rec.goods)}</b></div></div>`,
    speech: `Shop. Cash ${sayMoney(rec.cash)}, QR ${sayMoney(rec.qr)}${rec.goods ? ', goods ' + sayMoney(rec.goods) : ''}. Save?`,
    buttons: [{ label: '✔ Save', value: 'yes', cls: 'green' }, { label: '✎ Edit', value: 'edit' }, { label: '✕ Cancel', value: 'no', cls: 'redl' }],
    voice: yesNo, voiceMode: v,
    onAnswer: a => { if (a === 'yes') save(); else if (a === 'edit') { shopDraft = Object.assign({}, rec); goShop(); } else toast('Cancelled — nothing saved'); } });
}
function sayShop(v) {
  const t = today(), td = shopRange(t, t), mo = shopRange(bsMonthStart(t), t);
  speak(`Today the shop collected ${sayMoney(td.total)}: cash ${sayMoney(td.cash)}, QR ${sayMoney(td.qr)}. Goods bought ${sayMoney(td.goods)}. This month collected ${sayMoney(mo.total)}.`);
}
function goShop() { closeSheet(); go('shop'); }

// a week / month: totals and every day (tap a day for its entries; Back returns here)
function openShopRange(from, to, label) {
  if (from === to) { openShopDay(from, label); return; }
  const s0 = shopRange(from, to), days = [];
  for (let d = to; d >= from; d = addDays(d, -1)) days.push(d);
  openSheet(`<h2>🏪 ${esc(label)}</h2><div class="small muted" style="margin:-6px 0 10px">${fmtDate(from, true)} – ${fmtDate(to, true)}</div>
    <div class="summary">
      <div class="line"><span>Collected <span class="small muted">(cash ${money(s0.cash)} · QR ${money(s0.qr)})</span></span><b style="color:var(--green);font-size:${shopLess() ? 17 : 22}px">${money(s0.total)}</b></div>
      ${s0.chicken ? `<div class="line"><span>🐔 Chicken sales (on shop days)</span><b>− ${money(s0.chicken)}</b></div>` : ''}
      ${shopLess() ? `<div class="line"><span><b>Shop only</b></span><b style="color:var(--green);font-size:22px">${money(s0.own)}</b></div>` : ''}
      <div class="line"><span>📦 Goods bought</span><b style="color:var(--red)">${money(s0.goods)}</b></div>
      <div class="line"><span>Days recorded</span><b>${s0.days} · avg ${money(shopShown(s0) / (s0.days || 1))}/day</b></div></div>
    <h3>Every day</h3>
    <div class="summary small">${days.map(d => { const x = shopRange(d, d); return `<div class="line" data-act="shopRangeDay" data-d="${d}" data-from="${from}" data-to="${to}" data-label="${esc(label)}" style="cursor:pointer">
      <span><b>${fmtDate(d)}</b> <span class="muted">· ${WEEK_NE[weekday(d)]}</span>${x.n ? `<br><span class="muted">💵 ${money(x.cash)} · 📱 ${money(x.qr)}${x.goods ? ' · 📦 ' + money(x.goods) : ''}${shopLess() && x.chicken ? ' · 🐔 −' + money(x.chicken) : ''}</span>` : ''}</span>
      <b style="color:${x.n ? 'var(--green)' : 'var(--muted)'};white-space:nowrap">${x.n ? money(shopShown(x)) : '—'} ›</b></div>`; }).join('')}</div>
    <div style="height:10px"></div><button class="btn big primary" data-act="closeSheet">Close</button>`);
}

// ---------- ✎ edit a shop entry in a popup (the form on the page is only for new entries) ----------
let shopEdit = null;
function openShopEdit(id, back) {
  const r = db.records[id]; if (!r) return;
  shopEdit = Object.assign({}, r);
  const box = (f, label) => `<label><span>${label}</span><input data-se="${f}" ${calcAttrs()} value="${esc(r[f] == null || r[f] === 0 ? '' : r[f])}" placeholder="0"></label>`;
  openSheet(`<h2>✎ Edit shop entry</h2><div id="shopEditForm">
    <div class="field"><label>Date (नेपाली)</label>${bsDateHtml('shopedit', r.date)}</div>
    <div class="hshop shopboxes">${box('cash', '💵 Cash')}${box('qr', '📱 QR')}${box('goods', '📦 Goods')}</div>
    <div class="field" style="margin-top:10px"><input data-se="note" value="${esc(r.note || '')}" placeholder="Note (optional)" autocomplete="off"></div>
    <div class="totalbox"><span><b style="font-size:15px">COLLECTED</b><br><span class="small" id="seNet">${shopFormNet(r)}</span></span><b id="seTotal">${money((Number(r.cash) || 0) + (Number(r.qr) || 0))}</b></div>
    <button class="btn big green" data-act="shopEditSave">✔ Update</button>
    <div style="height:10px"></div>
    <div class="btnrow"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn redl" data-act="deleteShop" data-id="${r.id}">🗑 Delete</button></div>
    ${historyHtml(r.id)}</div>`);
  if (back) sheetBackFn = back;
}
function shopEditRead() { $$('#shopEditForm [data-se]').forEach(el => { shopEdit[el.dataset.se] = el.value; }); }
function saveShopEdit() {
  shopEditRead();
  const d = shopEdit, old = db.records[d.id];
  const rec = Object.assign({}, old, { date: d.date || old.date, cash: num(d.cash) || 0, qr: num(d.qr) || 0, goods: num(d.goods) || 0, note: String(d.note || '').trim() });
  if (!rec.cash && !rec.qr && !rec.goods) { toast('Enter cash, QR or goods amount — or 🗑 Delete'); return; }
  put(rec); shopEdit = null; closeSheet(); renderShop();
  toast(`✎ Updated ✓ ${fmtDate(rec.date)}: collected ${money(rec.cash + rec.qr)}${rec.goods ? ' · goods ' + money(rec.goods) : ''}`);
}
document.addEventListener('input', e => {
  if (e.target.dataset && e.target.dataset.se && shopEdit) { shopEditRead(); const t = $('#seTotal'), n = $('#seNet'); if (t) t.textContent = money((num(shopEdit.cash) || 0) + (num(shopEdit.qr) || 0)); if (n) n.textContent = shopFormNet(shopEdit); }
});
