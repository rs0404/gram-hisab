/* Gram Hisab — पञ्चाङ्ग: tithi, lunar month, sunrise/sunset and festivals / public holidays, calculated on the phone (no internet).
   Moon: Meeus, Astronomical Algorithms ch. 47 (main periodic terms); Sun: Meeus ch. 25; sunrise: NOAA method, Kathmandu.
   Tithi = (moon − sun longitude) / 12°, taken at sunrise (उदय तिथि). Lunar month is amanta, named by the sidereal (Lahiri)
   sign of the sun at the new moon that starts it; two new moons in one sign make an अधिक month.
   Festival days follow the usual rules; the official dates come from the Nepal Panchang Nirnayak Samiti and the
   government holiday list and can differ by a day, so every day can also carry the user's own note / holiday. */
'use strict';

const KTM = { lat: 27.7172, lon: 85.324, tz: 345 };   // Kathmandu, UTC+5:45 (minutes)
const RAD = Math.PI / 180, sinD = x => Math.sin(x * RAD), cosD = x => Math.cos(x * RAD);
const norm360 = x => ((x % 360) + 360) % 360;
const DELTA_T_DAYS = 69 / 86400;
const jdOf = ms => ms / 864e5 + 2440587.5;
const tCent = ms => (jdOf(ms) + DELTA_T_DAYS - 2451545) / 36525;

// Meeus table 47.A: D, M, M', F, Σl (1e-6 °)
const MOON_TERMS = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892], [2, 1, 1, 0, -810], [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381], [1, 1, 1, 0, 351], [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330], [2, -1, 2, 0, 327], [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294]
];
function moonLong(T) {
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699;
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let s = 3958 * sinD(A1) + 1962 * sinD(Lp - F) + 318 * sinD(A2);
  for (const [d, m, mp, f, c] of MOON_TERMS) s += c * (m ? Math.pow(E, Math.abs(m)) : 1) * sinD(d * D + m * M + mp * Mp + f * F);
  return norm360(Lp + s / 1e6);
}
function sunTrueLong(T) {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T, M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinD(M) + (0.019993 - 0.000101 * T) * sinD(2 * M) + 0.000289 * sinD(3 * M);
  return norm360(L0 + C);
}
// moon − sun (apparent; nutation cancels, the sun's aberration does not)
const elongation = ms => { const T = tCent(ms); return norm360(moonLong(T) - sunTrueLong(T) + 0.00569); };
const tithiAt = ms => Math.floor(elongation(ms) / 12) + 1;                  // 1..30
const lahiri = ms => 23.8531 + 0.0139663 * (jdOf(ms) - 2451545) / 365.25;
const sunRashi = ms => Math.floor(norm360(sunTrueLong(tCent(ms)) - 0.00569 - lahiri(ms)) / 30); // 0 = Mesha

// the new moon before (dir −1) or after (dir +1) an instant
function newMoon(ms, dir) {
  let t = ms + (dir < 0 ? -elongation(ms) : 360 - elongation(ms)) / 12.19 * 864e5;
  for (let i = 0; i < 8; i++) { let e = elongation(t); if (e > 180) e -= 360; t -= e / 12.19 * 864e5; if (Math.abs(e) < 1e-5) break; }
  return t;
}
// amanta lunar month at an instant: { m: 1 (Baisakh) .. 12 (Chaitra), adhik }
const lunarCache = {};
function lunarMonthAt(ms) {
  const nm0 = newMoon(ms, -1), key = Math.round(nm0 / 36e5);
  if (lunarCache[key]) return lunarCache[key];
  const s0 = sunRashi(nm0), s1 = sunRashi(newMoon(nm0 + 2 * 864e5, 1));
  return (lunarCache[key] = { m: s0 + 1, adhik: s0 === s1 });
}

// sunrise / sunset in Kathmandu (NOAA), as UTC milliseconds
function sunTimes(adIso) {
  const [y, mo, d] = adIso.split('-').map(Number), day0 = Date.UTC(y, mo - 1, d);
  const T = (jdOf(day0 + (12 * 60 - KTM.tz) * 6e4) - 2451545) / 36525;
  const L0 = norm360(280.46646 + T * (36000.76983 + 0.0003032 * T)), M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sinD(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sinD(2 * M) * (0.019993 - 0.000101 * T) + sinD(3 * M) * 0.000289;
  const om = 125.04 - 1934.136 * T, app = L0 + C - 0.00569 - 0.00478 * sinD(om);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * cosD(om);
  const dec = Math.asin(sinD(eps) * sinD(app)) / RAD, yy = Math.pow(Math.tan(eps / 2 * RAD), 2);
  const eot = 4 / RAD * (yy * sinD(2 * L0) - 2 * e * sinD(M) + 4 * e * yy * sinD(M) * cosD(2 * L0) - 0.5 * yy * yy * sinD(4 * L0) - 1.25 * e * e * sinD(2 * M));
  const ha = Math.acos(cosD(90.833) / (cosD(KTM.lat) * cosD(dec)) - Math.tan(KTM.lat * RAD) * Math.tan(dec * RAD)) / RAD;
  const noon = 720 - 4 * KTM.lon - eot;
  return { rise: day0 + (noon - 4 * ha) * 6e4, set: day0 + (noon + 4 * ha) * 6e4, noon: day0 + noon * 6e4 };
}
const fmtNpt = ms => { const d = new Date(ms + KTM.tz * 6e4); const h = d.getUTCHours(), m = d.getUTCMinutes(); return `${neNum((h + 11) % 12 + 1)}:${neNum(pad2(m))} ${h < 12 ? 'बिहान' : h < 16 ? 'दिउँसो' : 'बेलुका'}`; };

const TITHI_NE = ['प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पञ्चमी', 'षष्ठी', 'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी', 'एकादशी', 'द्वादशी', 'त्रयोदशी', 'चतुर्दशी'];
const TITHI_SHORT = ['प्रति', 'द्वि', 'तृती', 'चौथी', 'पञ्च', 'षष्ठी', 'सप्त', 'अष्ट', 'नवमी', 'दशमी', 'एका', 'द्वाद', 'त्रयो', 'चतु'];
const LUNAR_NE = ['वैशाख', 'ज्येष्ठ', 'आषाढ', 'श्रावण', 'भाद्र', 'आश्विन', 'कार्तिक', 'मार्ग', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'];
const tithiShort = t => t === 15 ? 'पूर्णे' : t === 30 ? 'औंसी' : TITHI_SHORT[(t - 1) % 15];
function tithiName(t) { return t === 15 ? 'पूर्णिमा' : t === 30 ? 'औंसी' : TITHI_NE[(t - 1) % 15]; }

// festivals by (amanta month, tithi). at: when the tithi must hold — rise (उदय, default, as Nepal mostly uses), aft (अपराह्न, Dashain tika),
// set (evening, Chhath), mid (midnight, Shivaratri), noon.
// h: 1 = public holiday, 'w' = women, 'k' = Kathmandu valley, 'c' = community, 0 = observance only
const LUNAR_FEST = [
  [1, 15, 'बुद्ध जयन्ती · उभौली', 'Buddha Jayanti', 1], [4, 5, 'नाग पञ्चमी', 'Nag Panchami', 0], [4, 15, 'जनै पूर्णिमा · रक्षाबन्धन', 'Janai Purnima', 1],
  [4, 16, 'गाईजात्रा', 'Gai Jatra', 'k'], [4, 23, 'श्रीकृष्ण जन्माष्टमी', 'Krishna Janmashtami', 1], [4, 30, 'कुशे औंसी · बुबाको मुख हेर्ने दिन', "Father's Day", 0],
  [5, 3, 'हरितालिका तीज', 'Teej', 'w'], [5, 5, 'ऋषि पञ्चमी', 'Rishi Panchami', 0], [5, 14, 'इन्द्रजात्रा', 'Indra Jatra', 'k'],
  [6, 1, 'घटस्थापना', 'Ghatasthapana', 1], [6, 7, 'फूलपाती', 'Fulpati', 1], [6, 8, 'महाअष्टमी', 'Maha Ashtami', 1], [6, 9, 'महानवमी', 'Maha Navami', 1],
  [6, 10, 'विजया दशमी', 'Vijaya Dashami', 1, 'aft'], [6, 11, 'पापाङ्कुशा एकादशी', 'Ekadashi (Dashain)', 1], [6, 15, 'कोजाग्रत पूर्णिमा', 'Kojagrat Purnima', 0],
  [6, 28, 'काग तिहार', 'Kag Tihar', 0, 'laxmi-2'], [6, 29, 'कुकुर तिहार · नरक चतुर्दशी', 'Kukur Tihar', 0, 'laxmi-1'], [6, 30, 'लक्ष्मी पूजा', 'Laxmi Puja', 1, 'laxmi'],
  [7, 1, 'गोवर्धन पूजा · म्ह पूजा · नेपाल संवत् नयाँ वर्ष', 'Govardhan / Mha Puja', 1], [7, 2, 'भाइटीका', 'Bhai Tika', 1], [7, 3, 'भाइटीकाको भोलिपल्ट (तिहार)', 'Day after Bhai Tika', 1],
  [7, 6, 'छठ पर्व', 'Chhath', 1, 'set'], [7, 11, 'हरिबोधिनी एकादशी', 'Haribodhini Ekadashi', 0],
  [8, 15, 'उधौली · योमरी पुन्ही', 'Udhauli / Yomari Punhi', 'c'], [10, 1, 'सोनाम ल्होसार', 'Sonam Lhosar', 1], [10, 5, 'श्री पञ्चमी · सरस्वती पूजा', 'Basanta Panchami', 0],
  [10, 29, 'महाशिवरात्रि', 'Maha Shivaratri', 1, 'mid'], [11, 1, 'ग्याल्पो ल्होसार', 'Gyalpo Lhosar', 1], [11, 15, 'फागु पूर्णिमा · होली (पहाड)', 'Holi (hills)', 1],
  [11, 16, 'होली (तराई)', 'Holi (Terai)', 1], [11, 29, 'घोडेजात्रा', 'Ghode Jatra', 'k'], [12, 9, 'रामनवमी', 'Ram Navami', 1],
  [12, 30, 'माता तीर्थ औंसी · आमाको मुख हेर्ने दिन', "Mother's Day", 0]
];
// fixed BS dates (month, day)
const BS_FEST = [
  [1, 1, 'नयाँ वर्ष', 'Nepali New Year', 1], [1, 11, 'लोकतन्त्र दिवस', 'Loktantra Diwas', 1], [2, 15, 'गणतन्त्र दिवस', 'Republic Day', 1],
  [4, 1, 'साउने संक्रान्ति', 'Saune Sankranti', 0], [6, 3, 'संविधान दिवस', 'Constitution Day', 1], [9, 15, 'तमु ल्होसार', 'Tamu Lhosar', 1],
  [9, 27, 'पृथ्वी जयन्ती', 'Prithvi Jayanti', 1], [10, 1, 'माघे संक्रान्ति · माघी', 'Maghe Sankranti', 1], [10, 16, 'शहीद दिवस', "Martyrs' Day", 0],
  [11, 7, 'प्रजातन्त्र दिवस', 'Democracy Day', 1]
];
// fixed AD dates (MM-DD)
const AD_FEST = [['03-08', 'अन्तर्राष्ट्रिय नारी दिवस', "Women's Day", 'w'], ['05-01', 'मजदुर दिवस', 'Labour Day', 'c'], ['12-25', 'क्रिसमस', 'Christmas', 1]];

// Islamic (tabular) date, for Eid — real dates depend on the moon being seen, so they are marked approximate
function hijri(adIso) {
  const [y, m, d] = adIso.split('-').map(Number);
  const jd = Math.floor((Date.UTC(y, m - 1, d) / 864e5) + 2440587.5 + 0.5);
  const l0 = jd - 1948440 + 10632, n = Math.floor((l0 - 1) / 10631), l1 = l0 - 10631 * n + 354;
  const j = Math.floor((10985 - l1) / 5316) * Math.floor(50 * l1 / 17719) + Math.floor(l1 / 5670) * Math.floor(43 * l1 / 15238);
  const l2 = l1 - Math.floor((30 - j) / 15) * Math.floor(17719 * j / 50) - Math.floor(j / 16) * Math.floor(15238 * j / 43) + 29;
  const hm = Math.floor(24 * l2 / 709);
  return { y: 30 * n + j - 30, m: hm, d: l2 - Math.floor(709 * hm / 24) };
}

// tithi and lunar month for one day (at sunrise, or another time of that day)
const dlCache = {};
function dayLunar(adIso, at) {
  const ck = adIso + (at || '');
  if (dlCache[ck]) return dlCache[ck];
  const st = sunTimes(adIso);
  const ms = at === 'aft' ? st.rise + 0.7 * (st.set - st.rise) : at === 'set' ? st.set + 72 * 6e4 : at === 'mid' ? st.noon + 12 * 36e5 : at === 'noon' ? st.noon : st.rise;
  return (dlCache[ck] = Object.assign({ t: tithiAt(ms) }, lunarMonthAt(ms)));
}
const panCache = {};
// everything about a day: tithi, paksha, lunar month, sunrise/sunset, festivals and holidays
function panchang(adIso) {
  if (panCache[adIso]) return panCache[adIso];
  const st = sunTimes(adIso), L = dayLunar(adIso), b = adToBs(adIso);
  const fests = [];
  const add = (ne, en, h, approx) => fests.push({ ne, en, holiday: h === 1, who: h === 'w' ? 'महिलाका लागि' : h === 'k' ? 'काठमाडौं उपत्यका' : h === 'c' ? 'सम्बन्धित समुदाय' : '', approx: !!approx });
  if (b) BS_FEST.forEach(f => { if (f[0] === b.m && f[1] === b.d) add(f[2], f[3], f[4]); });
  AD_FEST.forEach(f => { if (adIso.slice(5) === f[0]) add(f[1], f[2], f[3]); });
  LUNAR_FEST.forEach(f => {
    const on = f[5] === 'laxmi' ? isLaxmiPuja(adIso) : f[5] === 'laxmi-1' ? isLaxmiPuja(addDays(adIso, 1)) : f[5] === 'laxmi-2' ? isLaxmiPuja(addDays(adIso, 2)) : lunarFestOn(adIso, f[0], f[1], f[5]);
    if (on) add(f[2], f[3], f[4]);
  });
  const h = hijri(adIso);
  if (h.m === 10 && h.d === 1) add('इद-उल-फित्र (रमजान इद)', 'Eid al-Fitr', 1, true);
  if (h.m === 12 && h.d === 10) add('बकर इद', 'Eid al-Adha', 1, true);
  // purnimanta month name for the dark half, as Nepali patro write it (e.g. कार्तिक कृष्ण औंसी)
  const shukla = L.t <= 15, lm = shukla ? L.m : L.m % 12 + 1;
  return (panCache[adIso] = {
    tithi: L.t, shukla, name: `${L.adhik ? 'अधिक ' : ''}${LUNAR_NE[lm - 1]} ${shukla ? 'शुक्ल' : 'कृष्ण'} ${tithiName(L.t)}`,
    short: tithiShort(L.t), rise: st.rise, set: st.set, moon: L.t === 15 ? '🌕' : L.t === 30 ? '🌑' : '', fests,
    holiday: fests.some(f => f.holiday)
  });
}
// is the festival (amanta month m, tithi t) on this day? Uses the tithi at the required time; a tithi that never touches
// that time (क्षय) falls on the day it starts; when it holds on two days (वृद्धि), the first day.
function lunarFestOn(adIso, m, t, at) {
  const idx = x => (x.m * 30 + x.t) % 360;                  // lunar days count on through month ends
  const target = (m * 30 + t) % 360, a = dayLunar(adIso, at);
  if (a.adhik) return false;
  if (idx(a) === target) { const p = dayLunar(addDays(adIso, -1), at); return !(idx(p) === target && !p.adhik); }
  if (idx(a) === (target + 359) % 360) return idx(dayLunar(addDays(adIso, 1), at)) === (target + 1) % 360;
  return false;
}
// Laxmi Puja: the Ashwin औंसी that holds at sunrise, if it still lasts 24 min past sunset (प्रदोष); otherwise the evening before.
// Kag and Kukur Tihar are the two days before it.
function isLaxmiPuja(adIso) {
  const udaya = d => { const a = dayLunar(d); return !a.adhik && a.m === 6 && a.t === 30; };
  const lastsToEvening = d => { const st = sunTimes(d); const ms = st.set + 24 * 6e4; return tithiAt(ms) === 30; };
  if (udaya(adIso) && lastsToEvening(adIso)) return true;
  const next = addDays(adIso, 1);
  return udaya(next) && !lastsToEvening(next) && !udaya(adIso);
}
// when the tithi running at an instant ends (next multiple of 12° of elongation)
function tithiEnd(ms) {
  const target = (Math.floor(elongation(ms) / 12) + 1) * 12 % 360;
  let t = ms;
  for (let i = 0; i < 10; i++) { let d = target - elongation(t); if (d > 180) d -= 360; if (d < -180) d += 360; t += d / 12.19 * 864e5; if (Math.abs(d) < 1e-4) break; }
  return t;
}
