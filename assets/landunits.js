/* Gram Hisab — Nepali land units.
   Pahad (hills): 1 Ropani = 16 Aana = 64 Paisa = 256 Daam = 508.72 m²
   Tarai (plains): 1 Bigha = 20 Kattha = 400 Dhur = 6772.63 m²
   Areas are stored in m²; each phone shows its chosen system with the other one in small text. */
'use strict';

const LAND = {
  pahad: { label: 'Ropani-Aana-Paisa-Daam (Pahad)', units: [
    { key: 'ropani', en: 'Ropani', ne: 'रोपनी', m2: 508.72 },
    { key: 'aana', en: 'Aana', ne: 'आना', m2: 508.72 / 16 },
    { key: 'paisa', en: 'Paisa', ne: 'पैसा', m2: 508.72 / 64 },
    { key: 'daam', en: 'Daam', ne: 'दाम', m2: 508.72 / 256 }] },
  tarai: { label: 'Bigha-Kattha-Dhur (Tarai)', units: [
    { key: 'bigha', en: 'Bigha', ne: 'बिघा', m2: 6772.63 },
    { key: 'kattha', en: 'Kattha', ne: 'कट्ठा', m2: 6772.63 / 20 },
    { key: 'dhur', en: 'Dhur', ne: 'धुर', m2: 6772.63 / 400 }] }
};
const SQFT_PER_M2 = 10.7639;

function landSystem() { return (typeof db !== 'undefined' && db && db.meta && db.meta.landSystem) || 'pahad'; }
function otherSystem(sys) { return (sys || landSystem()) === 'pahad' ? 'tarai' : 'pahad'; }

// parts: numbers for each unit, biggest first, e.g. [2, 5, 1, 0] = 2 Ropani 5 Aana 1 Paisa 0 Daam
function toM2(sys, parts) {
  return LAND[sys].units.reduce((a, u, i) => a + (Number(parts[i]) || 0) * u.m2, 0);
}
// m² → parts; the smallest unit keeps 2 decimals
function fromM2(sys, m2) {
  const us = LAND[sys].units, out = [];
  let rest = Math.max(0, Number(m2) || 0);
  us.forEach((u, i) => {
    if (i === us.length - 1) { out.push(Math.round(rest / u.m2 * 100) / 100); return; }
    let n = Math.floor(rest / u.m2 + 1e-9);
    rest -= n * u.m2;
    out.push(n);
  });
  // carry rounding (e.g. 3.999 daam → next unit)
  for (let i = out.length - 1; i > 0; i--) {
    const per = us[i - 1].m2 / us[i].m2;
    if (out[i] >= per - 0.005) { out[i] = Math.round((out[i] - per) * 100) / 100; out[i - 1] += 1; }
  }
  return out;
}
// "2 रोपनी 5 आना 1 पैसा" (lang 'ne'), "2 Ropani 5 Aana 1 Paisa" ('en'), or "2-5-1-0" ('short')
function fmtArea(m2, sys, lang) {
  sys = sys || landSystem();
  const parts = fromM2(sys, m2), us = LAND[sys].units;
  if (parts[parts.length - 1] < 0.05) parts[parts.length - 1] = 0; // hide rounding dust
  if (lang === 'short') return parts.join('-');
  const bits = parts.map((n, i) => n ? `${String(Math.round(n * 100) / 100)} ${lang === 'en' ? us[i].en : us[i].ne}` : '').filter(Boolean);
  return bits.length ? bits.join(' ') : `0 ${lang === 'en' ? us[0].en : us[0].ne}`;
}
function fmtAreaBoth(m2) {
  const sys = landSystem();
  return { main: fmtArea(m2, sys, 'ne'), other: fmtArea(m2, otherSystem(sys), 'ne') };
}
function areaExtra(m2) { return `${Math.round(m2).toLocaleString('en-IN')} m² · ${Math.round(m2 * SQFT_PER_M2).toLocaleString('en-IN')} sq ft`; }

// form fields for an area in the given system (data-area="<key>")
function areaInputsHtml(sys, m2, prefix) {
  const parts = m2 ? fromM2(sys, m2) : [];
  return `<div class="area-in" data-area-sys="${sys}">${LAND[sys].units.map((u, i) => `<label><span>${u.ne}<br><small>${u.en}</small></span>
    <input data-${prefix || 'ar'}="${i}" type="number" inputmode="decimal" step="any" min="0" value="${parts[i] ? parts[i] : ''}" placeholder="0"></label>`).join('')}</div>`;
}
function readAreaInputs(container, sys, prefix) {
  const vals = LAND[sys].units.map((u, i) => Number(((container.querySelector(`[data-${prefix || 'ar'}="${i}"]`) || {}).value) || 0));
  return toM2(sys, vals);
}

// converter sheet: type in one system, see the other (and m², sq ft)
function openAreaConverter(startSys) {
  const sys = startSys || landSystem();
  openSheet(`<h2>📐 Land converter</h2>
    <div class="seg">${['pahad', 'tarai'].map(k => `<button class="${k === sys ? 'on' : ''}" data-act="convSys" data-v="${k}">${k === 'pahad' ? '⛰️ Pahad' : '🌾 Tarai'}</button>`).join('')}</div>
    <div id="convForm">${areaInputsHtml(sys, 0, 'cv')}</div>
    <div class="summary" id="convOut" style="margin-top:12px"></div>
    <p class="small muted">1 Ropani = 16 Aana = 64 Paisa = 256 Daam = 508.72 m² · 1 Bigha = 20 Kattha = 400 Dhur = 6,772.63 m² · 1 Bigha ≈ 13.31 Ropani · 1 Kattha ≈ 10.65 Aana</p>
    <button class="btn big primary" data-act="closeSheet">Close</button>`);
  const form = $('#convForm');
  const upd = () => {
    const m2 = readAreaInputs(form, sys, 'cv');
    const o = otherSystem(sys);
    $('#convOut').innerHTML = `<div class="line"><span>${o === 'pahad' ? '⛰️ Pahad' : '🌾 Tarai'}</span><b style="font-size:20px">${fmtArea(m2, o, 'ne')}</b></div>
      <div class="line"><span></span><b class="small">${fmtArea(m2, o, 'en')}</b></div>
      <div class="line"><span>Area</span><b>${areaExtra(m2)}</b></div>`;
  };
  form.addEventListener('input', upd);
  upd();
}
