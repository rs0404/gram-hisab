/* Gram Hisab — calculator in amount fields (like Spotlight on a Mac): type "2*200" (or 2x200, 2×200, 1500+300) and get 400.
   Fields marked data-calc get a small bar under them with × + − ÷ (number keypads have no ×) and the live result.
   For "qty × rate", data-calc-qty / data-calc-rate (CSS selectors) are filled in when they are empty. */
'use strict';

// safe arithmetic: digits, . + - * / ( ) only; returns null when it is not a sum
function calcEval(str) {
  const s = String(str == null ? '' : str).replace(/,/g, '').replace(/[x×X]/g, '*').replace(/÷/g, '/').replace(/−/g, '-').trim();
  if (!s || /^\d{4}-\d\d-\d\d/.test(s) || !/^[\d.+\-*/() ]+$/.test(s) || !/\d\s*[+\-*/]\s*[\d(.]/.test(s)) return null;
  try { const v = Function('"use strict";return (' + s + ')')(); return isFinite(v) ? Math.round(v * 100) / 100 : null; } catch (e) { return null; }
}
const isCalcExpr = v => calcEval(v) != null;
// "2*200" → [2, 200] (a single multiplication = quantity × rate)
function calcQtyRate(str) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[x×X*]\s*(\d+(?:\.\d+)?)\s*$/.exec(String(str || '').replace(/,/g, ''));
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

let calcBar = null, calcInput = null;
function calcBarEl() {
  if (calcBar && document.body.contains(calcBar)) return calcBar;
  calcBar = document.createElement('div');
  calcBar.className = 'calcbar hidden';
  calcBar.innerHTML = ['×', '+', '−', '÷'].map(o => `<button type="button" data-calcop="${o}">${o}</button>`).join('') + '<span class="calcres"></span><button type="button" data-calcop="=" class="calceq">=</button>';
  // keep the keyboard open: act on pointerdown and stop the input from losing focus
  calcBar.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-calcop]');
    e.preventDefault();
    if (!b || !calcInput) return;
    const op = b.dataset.calcop;
    if (op === '=') { calcFinish(calcInput); return; }
    const el = calcInput, ch = { '×': '*', '+': '+', '−': '-', '÷': '/' }[op];
    const s = el.selectionStart != null ? el.selectionStart : el.value.length, en = el.selectionEnd != null ? el.selectionEnd : s;
    el.value = el.value.slice(0, s) + ch + el.value.slice(en);
    try { el.setSelectionRange(s + 1, s + 1); } catch (x) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.body.appendChild(calcBar);
  return calcBar;
}
function calcShow(el) {
  const bar = calcBarEl();
  calcInput = el;
  (el.closest('.grid2, .hshop, .svcrow') || el).insertAdjacentElement('afterend', bar);   // in rows of small boxes: full width under the row
  bar.classList.remove('hidden');
  calcUpdate(el);
}
function calcUpdate(el) {
  if (!calcBar || calcInput !== el) return;
  const v = calcEval(el.value), qr = calcQtyRate(el.value);
  calcBar.querySelector('.calcres').textContent = v != null ? `= ${money(v)}${qr && el.dataset.calcQty ? ` (${nfmt(qr[0])} × ${money(qr[1])})` : ''}` : 'type e.g. 2×200';
}
// replace the sum by its result, and fill quantity / rate when they are empty
function calcFinish(el) {
  const v = calcEval(el.value);
  if (v == null) return;
  const qr = calcQtyRate(el.value);
  const fill = (sel, val) => {
    if (!sel) return;
    const t = document.querySelector(sel);
    if (!t || (t.value !== '' && num(t.value) !== val)) return;
    t.value = val; t.dispatchEvent(new Event('input', { bubbles: true }));
  };
  if (qr) { fill(el.dataset.calcRate, qr[1]); fill(el.dataset.calcQty, qr[0]); }
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  calcUpdate(el);
}
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('input[data-calc]')) calcShow(e.target); });
document.addEventListener('focusout', e => {
  if (!e.target.matches || !e.target.matches('input[data-calc]')) return;
  calcFinish(e.target);
  setTimeout(() => { if (calcBar && document.activeElement !== calcInput) { calcBar.classList.add('hidden'); calcInput = null; } }, 150);
});
document.addEventListener('input', e => { if (e.target === calcInput) calcUpdate(e.target); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('input[data-calc]') && isCalcExpr(e.target.value)) calcFinish(e.target); }, true);
// attributes for an amount field: calcAttrs('#kForm [data-k=litres]') etc.
const calcAttrs = (qtySel, rateSel) => `type="text" inputmode="decimal" autocomplete="off" data-calc${qtySel ? ` data-calc-qty="${qtySel}"` : ''}${rateSel ? ` data-calc-rate="${rateSel}"` : ''}`;
