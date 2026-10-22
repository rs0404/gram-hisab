/* Nepali (Bikram Sambat) calendar.
   Month lengths for BS 2000–2100 come from yarsa/nepal-compliance
   (nepal_compliance/nepali_date_utils/data/nepali_calendar.csv); anchor 2000-01-01 BS = 1943-04-14 AD.
   Each digit below is (days in month − 29), 12 digits per year. */
'use strict';
const BS_FIRST_YEAR = 2000;
const BS_DATA = '132321110102223222101011223321101011232321110012132321110102223222101011223321101011232321110012222322011002223222101011223321101011232321110012222322011011223222101011223321101011232321110012222322011011223222101011232321101011232321110102222322101011223222101011232321110011232321110102222322101011223222101011232321110012132321110102223222101011223231101011232321110012132321110102223222101011223321101011232321110012132322011002223222101011223321101011232321110012222322011011223222101011223321101011232321110012222322011011223222101011232321101011232321110012222322101011223222101011232321110011232321110102222322101011223222101011232321110011232321110102223222101011223231101011232321110012132321110102223222101011223321101011232321110012222322010102223222101011223321101011232321110012222322011002223222101011223321101011232321110012222322011011223222101011232321101011232321110012222322101011223222101011232321110011232321110102222322101011223222101011232321110011232321110102223222101011223222101011223221110111232312110111132321110111223222101111123312110111132321110111132321110111223222110111123321110111132321110111223221110111223222101111123321101011232321110111223222010102223222100111232312101011';
const BS_MONTHS = ['Baisakh', 'Jestha', 'Ashar', 'Shrawan', 'Bhadra', 'Ashoj', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
const BS_MONTHS_NE = ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत'];
const BS_LAST_YEAR = BS_FIRST_YEAR + BS_DATA.length / 12 - 1;
const BS_ANCHOR_UTC = Date.UTC(1943, 3, 14);

function bsDays(y, m) { // m: 1..12
  const i = (y - BS_FIRST_YEAR) * 12 + (m - 1);
  return 29 + Number(BS_DATA[i]);
}
function bsYearDays(y) { let t = 0; for (let m = 1; m <= 12; m++) t += bsDays(y, m); return t; }

// AD 'YYYY-MM-DD' → {y, m, d} in BS (null when outside 2000–2100 BS)
function adToBs(adIso) {
  const p = String(adIso).split('-').map(Number);
  let days = Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - BS_ANCHOR_UTC) / 864e5);
  if (days < 0) return null;
  let y = BS_FIRST_YEAR;
  while (y <= BS_LAST_YEAR) { const yd = bsYearDays(y); if (days < yd) break; days -= yd; y++; }
  if (y > BS_LAST_YEAR) return null;
  let m = 1;
  while (days >= bsDays(y, m)) { days -= bsDays(y, m); m++; }
  return { y, m, d: days + 1 };
}
// BS → AD 'YYYY-MM-DD'
function bsToAd(y, m, d) {
  if (y < BS_FIRST_YEAR || y > BS_LAST_YEAR || m < 1 || m > 12) return null;
  d = Math.max(1, Math.min(d, bsDays(y, m)));
  let days = 0;
  for (let yy = BS_FIRST_YEAR; yy < y; yy++) days += bsYearDays(yy);
  for (let mm = 1; mm < m; mm++) days += bsDays(y, mm);
  days += d - 1;
  return new Date(BS_ANCHOR_UTC + days * 864e5).toISOString().slice(0, 10);
}
const pad2 = n => (n < 10 ? '0' : '') + n;
function bsIso(adIsoStr) { const b = adToBs(adIsoStr); return b ? b.y + '-' + pad2(b.m) + '-' + pad2(b.d) : ''; }
function bsLabel(adIsoStr, withYear) {
  const b = adToBs(adIsoStr);
  if (!b) return adIsoStr;
  return BS_MONTHS[b.m - 1] + ' ' + b.d + (withYear ? ', ' + b.y : '');
}
