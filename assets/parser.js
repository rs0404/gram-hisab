/* Gram Hisab — turns spoken/typed sentences into commands */
'use strict';

const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90 };
const SCALE = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, lac: 100000, lacs: 100000 };
const isDigitTok = t => /^\d+(\.\d+)?$/.test(t);

function wordsToNumbers(str) {
  const tk = str.split(/\s+/).filter(Boolean);
  const out = [];
  let i = 0;
  while (i < tk.length) {
    const t = tk[i];
    // a lone "सय" / "हजार" (said without a number) means 100 / 1000
    const startsNum = isDigitTok(t) || t in SMALL || (t === 'a' && tk[i + 1] in SCALE) || (t === 'half' && !(tk[i - 1] === 'and')) || (t in SCALE && !isDigitTok(tk[i - 1] || ''));
    if (!startsNum) { out.push(t); i++; continue; }
    let total = 0, cur = 0, has = false, j = i, lastScale = 0;
    if (t in SCALE) { cur = 1; has = true; }
    while (j < tk.length) {
      const w = tk[j];
      if (isDigitTok(w)) {
        // "दुई सय पचहत्तर" → 2 hundred 75: a smaller number right after a scale word is added
        if (has && cur !== 0 && !(lastScale && parseFloat(w) < (lastScale === 100 ? 100 : 1000) && (lastScale !== 100 || cur % 100 === 0))) break;
        cur += parseFloat(w); has = true; j++; lastScale = 0;
      } else if (w in SMALL) {
        const v = SMALL[w];
        if (has && cur !== 0 && !(cur % 100 === 0 || (cur >= 20 && cur % 10 === 0 && v < 10))) break;
        cur += v; has = true; j++; lastScale = 0;
      } else if (w in SCALE && has) {
        const sc = SCALE[w];
        if (sc === 100) cur = (cur || 1) * 100; else { total += (cur || 1) * sc; cur = 0; }
        j++; lastScale = sc;
      } else if (w === 'a' && !has && tk[j + 1] in SCALE) {
        cur = 1; has = true; j++;
      } else if (w === 'half' && !has) {
        cur = 0.5; has = true; j++; break;
      } else if (w === 'and' && has) {
        if (tk[j + 1] === 'half') { cur += 0.5; j += 2; break; }
        if (tk[j + 1] === 'a' && tk[j + 2] === 'half') { cur += 0.5; j += 3; break; }
        if (tk[j + 1] === 'quarter' || (tk[j + 1] === 'a' && tk[j + 2] === 'quarter')) { cur += 0.25; j += tk[j + 1] === 'a' ? 3 : 2; break; }
        if (tk[j + 1] in SMALL || isDigitTok(tk[j + 1] || '')) { j++; continue; }
        break;
      } else if (w === 'point' && has && (tk[j + 1] in SMALL || isDigitTok(tk[j + 1] || ''))) {
        let digits = ''; j++;
        while (j < tk.length && ((tk[j] in SMALL && SMALL[tk[j]] < 10) || /^\d+$/.test(tk[j]))) { digits += tk[j] in SMALL ? SMALL[tk[j]] : tk[j]; j++; }
        cur = Math.floor(cur) + parseFloat('0.' + digits);
        break;
      } else break;
    }
    if (!has) { out.push(t); i++; continue; }
    out.push(String(round(total + cur, 3)));
    i = j;
  }
  return mergeSplitNumbers(out).join(' ');
}
// Voice typing often splits one amount into pieces: "2000 500", "20 500", "25 100", "2 1000 500" → 2500
function mergeSplitNumbers(tk) {
  const isInt = t => /^\d+$/.test(t);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i + 1 < tk.length; i++) {
      if (!isInt(tk[i]) || !isInt(tk[i + 1])) continue;
      const a = +tk[i], b = +tk[i + 1];
      let m = null;
      if ((b === 100 || b === 1000 || b === 100000) && a > 0 && a < 100) m = a * b;                       // "25 100" = 25 hundred
      else if (a >= 1000 && a % 1000 === 0 && b > 0 && b < 1000) m = a + b;                                // "2000 500"
      else if (a >= 100 && a % 100 === 0 && a % 1000 !== 0 && b > 0 && b < 100 && b % 10 === 0) m = a + b; // "500 50"
      else if (a >= 20 && a <= 90 && a % 10 === 0 && b >= 100 && b <= 900 && b % 100 === 0) m = (a + b / 100) * 100; // "20 500" = twenty-five hundred
      if (m != null) { tk.splice(i, 2, String(m)); changed = true; break; }
    }
  }
  return tk;
}

const NE_MAP = [
  [/बैशाख|वैशाख/g, ' baisakh '], [/जेठ|जेष्ठ/g, ' jestha '], [/असार|आषाढ/g, ' ashar '], [/साउन|श्रावण/g, ' shrawan '], [/भदौ|भाद्र/g, ' bhadra '],
  [/असोज|आश्विन/g, ' ashoj '], [/कार्तिक|कात्तिक/g, ' kartik '], [/मंसिर|मङ्सिर/g, ' mangsir '], [/पुष|पौष/g, ' poush '], [/माघ/g, ' magh '],
  [/फागुन|फाल्गुन/g, ' falgun '], [/चैत्र|चैत/g, ' chaitra '], [/गते/g, ' gate '],
  [/ब्रोइलर|बोइलर|ब्रोईलर|ब्रोलर/g, ' broiler '], [/लोकल|देशी|स्थानीय/g, ' local '], [/गिरिराज|गिरीराज/g, ' giriraj '],
  [/किनेको|किन्यो|किनें|किने|खरिद/g, ' bought '], [/भिटामिन|भिटामीन/g, ' vitamin '], [/बोरा/g, ' bags '], [/बोतल/g, ' bottle '], [/प्याकेट/g, ' packet '],
  [/पर्दैन|हुँदैन|हुदैन|चाहिँदैन|चाहिदैन|नगर्नु|नगर/g, ' no '], [/गर्नुस्|गर्नुहोस्|गर्नुस|सेभ/g, ' yes '],
  [/बिक्यो|बिकेको|बिक्री/g, ' sold '], [/बचेको|बाँचेको/g, ' left '], [/अस्ति/g, ' day before yesterday '], [/के जी/g, ' kg '],
  [/पसल/g, ' shop '], [/नगद/g, ' cash '], [/क्यू\s*आर|क्युआर|किउआर|क्यूआर|अनलाइन/g, ' qr '], [/सामान|समान/g, ' goods '], [/कलेक्सन|उठेको|उठ्यो/g, ' collected '],
  [/महिना/g, ' month '], [/हप्ता/g, ' week '], [/नाफा/g, ' profit '], [/नोक्सान|घाटा/g, ' loss '], [/हिसाब/g, ' summary '], [/जिउँदै|ज्यूँदो/g, ' live '],
  [/खुट्टा\s*टाउको|खुट्टा|टाउको/g, ' parts '], [/थपेको|थप्यो|थपे/g, ' added '],
  [/कुखुराको|कुखुरा/g, ' chicken '], [/बेचेको|बेचें|बेचे|बेच्यो|बेच्नु|बिक्री|बेच/g, ' sold '], [/केजी|के\.जी\.?|किलो/g, ' kg '],
  [/मरेको|मर्यो|मरे|मृत/g, ' dead '], [/बाँकी|बाकी|बांकी/g, ' left '], [/रुपैयाँ|रुपैयां|रुपैया|रु\.?/g, ' rs '], [/दाना/g, ' feed '],
  [/औषधि|औषधी/g, ' medicine '], [/खोप/g, ' vaccine '], [/आज/g, ' today '], [/हिजो/g, ' yesterday '], [/कति/g, ' how many '],
  [/होइन|हैन|नाई/g, ' no '], [/हजुर|हुन्छ|ठिक|हो/g, ' yes '], [/गोटा|वटा|ओटा/g, ' birds '], [/जिउँदो|जिउदो|जिन्दा|ज्युँदो/g, ' live '],
  [/मासु|काटेको|काटे|काट्यो/g, ' meat '], [/लट|लोट|ब्याच/g, ' lot '], [/बी/g, ' b '], [/नयाँ/g, ' new '], [/चल्ला/g, ' chicks '],
  [/तौल/g, ' weight '], [/मूल्य|भाउ|दर/g, ' price '], [/उधारो/g, ' credit ']
];
const ROMAN_MAP = [
  [/\b(kukhura|kukura|kukhra)\b/g, ' chicken '], [/\b(becheko|bechyo|beche|bechen|bechna|bikri|bechiyo)\b/g, ' sold '],
  [/\b(mareko|maryo|marey|mare|mareka|marechha|marekochha|marisakyo|marye)\b/g, ' dead '],
  [/\b(bikyo|bikeko|bikri|bechyau|bechem|bechne|bechiyeko)\b/g, ' sold '], [/\b(aushadhi|ausadhi|ausadi|osadhi|ausadhi|dabai)\b/g, ' medicine '],
  [/\b(naya|nayaa|nayan)\b/g, ' new '], [/\b(khop)\b/g, ' vaccine '], [/\b(bacheko|bachyo)\b/g, ' left '], [/\b(asti)\b/g, ' day before yesterday '],
  [/\b(taul)\b/g, ' weight '], [/\b(dar|bhau|mol)\b/g, ' price '], [/\b(nafa|nafaa)\b/g, ' profit '], [/\b(noksan|nokshan|ghata)\b/g, ' loss '],
  [/\b(pasal|dokan|dukan|pasalko)\b/g, ' shop '], [/\b(nagad|nagat|nakad|nagadi)\b/g, ' cash '],
  [/\b(q\s*r|kyu\s*ar|kyuar|queue\s*r|cure|fonepay|phonepay|phone\s*pay|esewa|e\s*sewa|khalti|online|scan|qr\s*code)\b/g, ' qr '],
  [/\b(saman|samaan|maal|mal)\b/g, ' goods '], [/\b(collection|uthyo|utheko)\b/g, ' collected '],
  [/\b(hisab|hisaab)\b/g, ' summary '], [/\b(mahina|mahinako|mahina ko)\b/g, ' month '], [/\b(hapta|haptako)\b/g, ' week '], [/\b(botal|botals)\b/g, ' bottle '], [/\b(jyudo|jiudai|jiundai)\b/g, ' live '],
  [/\b(pardaina|hudaina|hundaina|chaidaina|chahidaina|nagara|nagarnu)\b/g, ' no '], [/\b(garnus|garnuhos|gara|hunchha|hunxa|huncha|ho)\b/g, ' yes '], [/\b(baki|banki|baaki)\b/g, ' left '], [/\b(dana|daana)\b/g, ' feed '],
  [/\b(aaja|aja|aaj)\b/g, ' today '], [/\bhijo\b/g, ' yesterday '], [/\bkati\b/g, ' how many '], [/\b(wota|ota|gota|wata)\b/g, ' birds '],
  [/\b(jinda|zinda|jiundo|jyundo|jiudo|alive|living)\b/g, ' live '], [/\b(masu|maasu|kateko|katyo)\b/g, ' meat '],
  [/\b(udharo|udhaaro|udhaar|udhar)\b/g, ' credit '], [/\bchalla\b/g, ' chicks '], [/\b(hajur|huncha|hunchha|thik|thikcha)\b/g, ' yes '],
  [/\b(hoina|haina|hoyina)\b/g, ' no '], [/\b(gatey|gte)\b/g, ' gate '], [/\b(kineko|kinyo|kinen|kine|kharid|kharida)\b/g, ' bought '],
  [/\b(bora|boras)\b/g, ' bags '], [/\b(khutta\s*tauko|khuttaa|khutta|khuta|tauko|taauko|taukko|feet|legs)\b/g, ' parts '],
  [/\b(thapeko|thapyo|thape)\b/g, ' added ']
];
const MONTH_ALIASES = [
  'baisakh|baishakh|baisak|besakh|vaisakh|baisakha|vaishakh', 'jestha|jeth|jeshta|jesth|jeth', 'ashar|asar|asadh|ashadh|asaar|aashar|ashad|asad|ashaar',
  'shrawan|saun|sawan|srawan|shravan|shrawn|sravan', 'bhadra|bhadau|bhado|bhadra', 'ashoj|asoj|ashwin|aswin|ashoja|ashwini|asoz',
  'kartik|kartick|kartika|kattik|karthik', 'mangsir|mansir|mangshir|mangsheer|mangseer', 'poush|push|paush|pousha|pus',
  'magh|maagh', 'falgun|fagun|phalgun|phagun', 'chaitra|chait|chaitr|chaita'
];
const MONTH_LOOKUP = {};
MONTH_ALIASES.forEach((a, i) => a.split('|').forEach(w => { MONTH_LOOKUP[w] = i + 1; }));
const NOT_LOT_NUM = '(?!\\.\\d|\\s*(?:kg|rs|chickens?|chicks?|birds?|bags?|pieces?|pcs|days?|g|per|percent)\\b)';
const MONTH_RE = new RegExp('\\b(on\\s+)?(' + MONTH_ALIASES.join('|') + ')\\b(?:\\s+(?:ko|ma|month))?(?:\\s+(?:lot|batch)(?:\\s+(?:no|number))?)?(?:\\s+(\\d{1,2})\\b' + NOT_LOT_NUM + ')?(\\s+(?:gate|tarikh|date))?', 'g');
const LOTNO_RE = new RegExp('\\b(?:lot|batch|lat)\\s*(?:number|no)?\\s*(\\d{1,2})\\b' + NOT_LOT_NUM, 'g');
const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };

function breedPatterns() {
  const builtIn = {
    broiler: /\b(broilers?|boilers?|brawlers?|broil|broylers?|broylor|broiller)\b/g,
    local: /\b(locals?|lokal|desi|deshi|dessi)\b/g,
    giriraj: /\b(giri\s*raja?|giriraaj|giriraja|giri raaj)\b/g
  };
  return breeds().map(b => [builtIn[b.id] || new RegExp('\\b' + b.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*') + '\\b', 'g'), b.id]);
}


// Nepali number words (Devanagari and romanized) → digits, plus fractions: डेढ 1.5, अढाई 2.5, साढे X = X½, सवा X = X¼, पौने X = X−¼, आधा ½
const NP_NUM_DEV = [["एक", 1], ["दुई", 2], ["तीन", 3], ["चार", 4], ["पाँच", 5], ["सात", 7], ["आठ", 8], ["नौ", 9], ["दश", 10], ["एघार", 11], ["बाह्र", 12], ["तेह्र", 13], ["चौध", 14], ["पन्ध्र", 15], ["सोह्र", 16], ["सत्र", 17], ["अठार", 18], ["उन्नाइस", 19], ["बीस", 20], ["एक्काइस", 21], ["बाइस", 22], ["तेइस", 23], ["चौबिस", 24], ["पच्चिस", 25], ["छब्बिस", 26], ["सत्ताइस", 27], ["अठ्ठाइस", 28], ["उनन्तिस", 29], ["तिस", 30], ["एकतिस", 31], ["बत्तिस", 32], ["तेत्तिस", 33], ["चौँतिस", 34], ["पैँतिस", 35], ["छत्तिस", 36], ["सैँतिस", 37], ["अठतिस", 38], ["उनन्चालिस", 39], ["चालिस", 40], ["एकचालिस", 41], ["बयालिस", 42], ["त्रिचालिस", 43], ["चवालिस", 44], ["पैँतालिस", 45], ["छयालिस", 46], ["सतचालिस", 47], ["अठचालिस", 48], ["उनन्पचास", 49], ["पचास", 50], ["एकाउन्न", 51], ["बाउन्न", 52], ["त्रिपन्न", 53], ["चउन्न", 54], ["पचपन्न", 55], ["छपन्न", 56], ["सन्ताउन्न", 57], ["अन्ठाउन्न", 58], ["उनन्साठी", 59], ["साठी", 60], ["एकसट्ठी", 61], ["बयसट्ठी", 62], ["त्रिसट्ठी", 63], ["चौसट्ठी", 64], ["पैँसट्ठी", 65], ["छयसट्ठी", 66], ["सतसट्ठी", 67], ["अठसट्ठी", 68], ["उनन्सत्तरी", 69], ["सत्तरी", 70], ["एकहत्तर", 71], ["बहत्तर", 72], ["त्रिहत्तर", 73], ["चौहत्तर", 74], ["पचहत्तर", 75], ["छयहत्तर", 76], ["सतहत्तर", 77], ["अठहत्तर", 78], ["उनासी", 79], ["असी", 80], ["एकासी", 81], ["बयासी", 82], ["त्रियासी", 83], ["चौरासी", 84], ["पचासी", 85], ["छयासी", 86], ["सतासी", 87], ["अठासी", 88], ["उनान्नब्बे", 89], ["नब्बे", 90], ["एकानब्बे", 91], ["बयानब्बे", 92], ["त्रियानब्बे", 93], ["चौरानब्बे", 94], ["पन्चानब्बे", 95], ["छयानब्बे", 96], ["सन्तानब्बे", 97], ["अन्ठानब्बे", 98], ["उनान्सय", 99], ["दस", 10], ["पाँच", 5], ["पांच", 5], ["बाह्रा", 12], ["उन्नाईस", 19], ["बिस", 20], ["पच्चीस", 25], ["तीस", 30], ["चालीस", 40], ["पैंतिस", 35], ["चौंतिस", 34], ["सैंतिस", 37], ["पैंतालिस", 45], ["पैंसट्ठी", 65]];
const NP_NUM_ROM = [["ek", 1], ["dui", 2], ["tin", 3], ["char", 4], ["panch", 5], ["saat", 7], ["aath", 8], ["nau", 9], ["das", 10], ["eghar", 11], ["bahra", 12], ["tehra", 13], ["chaudha", 14], ["pandhra", 15], ["sorha", 16], ["satra", 17], ["athara", 18], ["unnais", 19], ["bis", 20], ["ekkais", 21], ["bais", 22], ["teis", 23], ["chaubis", 24], ["pachchis", 25], ["chhabbis", 26], ["sattais", 27], ["aththais", 28], ["unantis", 29], ["tis", 30], ["ektis", 31], ["battis", 32], ["tettis", 33], ["chautis", 34], ["paitis", 35], ["chhattis", 36], ["saitis", 37], ["athtis", 38], ["unanchalis", 39], ["chalis", 40], ["ekchalis", 41], ["bayalis", 42], ["trichalis", 43], ["chawalis", 44], ["paintalis", 45], ["chhayalis", 46], ["satchalis", 47], ["athchalis", 48], ["unanpachas", 49], ["pachas", 50], ["ekaunna", 51], ["baunna", 52], ["tripanna", 53], ["chaunna", 54], ["pachpanna", 55], ["chhapanna", 56], ["santaunna", 57], ["anthaunna", 58], ["unansathi", 59], ["eksatthi", 61], ["bayasatthi", 62], ["trisatthi", 63], ["chausatthi", 64], ["painsatthi", 65], ["chhayasatthi", 66], ["satsatthi", 67], ["athsatthi", 68], ["unansattari", 69], ["sattari", 70], ["ekhattar", 71], ["bahattar", 72], ["trihattar", 73], ["chauhattar", 74], ["pachahattar", 75], ["chhayahattar", 76], ["satahattar", 77], ["athahattar", 78], ["unasi", 79], ["asi", 80], ["ekasi", 81], ["bayasi", 82], ["triyasi", 83], ["chaurasi", 84], ["pachasi", 85], ["chhayasi", 86], ["satasi", 87], ["athasi", 88], ["unannabbe", 89], ["nabbe", 90], ["ekanabbe", 91], ["bayanabbe", 92], ["triyanabbe", 93], ["chauranabbe", 94], ["panchanabbe", 95], ["chhayanabbe", 96], ["santanabbe", 97], ["anthanabbe", 98], ["unansaya", 99], ["ekk", 1], ["due", 2], ["duita", 2], ["teen", 3], ["chaar", 4], ["paanch", 5], ["pach", 5], ["sat", 7], ["aat", 8], ["dash", 10], ["baara", 12], ["pandra", 15], ["solah", 16], ["bees", 20], ["pachis", 25], ["tees", 30], ["pachaas", 50]];
const NP_SCALE = [[/(^|\s)(सय|सये)(?=\s|$)/g, ' hundred '], [/(^|\s)(हजार)(?=\s|$)/g, ' thousand '], [/(^|\s)(लाख)(?=\s|$)/g, ' lakh '],
  [/\b(saya|sau|sae|shaya)\b/g, ' hundred '], [/\b(hajar|hazar|hajaar|hazaar)\b/g, ' thousand '], [/\b(lakh|lac)\b/g, ' lakh ']];
const NP_SIX_RE = /(^|\s)(छ|chha|chhah)(?=\s+(?:kg|kilo|केजी|किलो|wota|ota|gota|वटा|ओटा|गोटा|bags?|bora|बोरा|hundred|thousand|सय|हजार|chickens?|kukhura|कुखुरा|birds?|जना|jana|खेताला|khetala|पाथी|pathi|माना|mana|मुरी|muri|घण्टा|घन्टा|ghanta|लिटर|litre|थुन्से|thunse|दिन|din|\d))/g;
function nepaliNumbers(t) {
  t = t.replace(/(^|\s)(दशमलव|दसमलव|प्वाइन्ट|पोइन्ट|पोइन्ट)(?=\s|$)/g, ' point ').replace(/\b(dasamalab|dashamlav|point)\b/g, ' point ');
  t = t.replace(/(^|\s)(साढे|साढ़े)\s+/g, ' sadhe ').replace(/(^|\s)सवा\s+/g, ' sawa ').replace(/(^|\s)पौने\s+/g, ' paune ');
  t = t.replace(/(^|\s)(डेढ|डेड)(?=\s|$)/g, ' 1.5 ').replace(/(^|\s)(अढाई|अढाइ|ढाई)(?=\s|$)/g, ' 2.5 ').replace(/(^|\s)(आधा)(?=\s|$)/g, ' 0.5 ');
  t = t.replace(/\b(dedh|derh|dedha)\b/g, ' 1.5 ').replace(/\b(adhai|adhaai|dhai|dhaai)\b/g, ' 2.5 ').replace(/\b(adha|aadha|aadhaa)\b/g, ' 0.5 ');
  // छ / chha is both "6" and "is" — only a number when a unit or number follows
  t = t.replace(NP_SIX_RE, ' 6 ');
  NP_NUM_DEV.forEach(([w, n]) => { t = t.replace(new RegExp('(^|\\s)' + w + '(?=\\s|$)', 'g'), ' ' + n + ' '); });
  NP_NUM_ROM.forEach(([w, n]) => { t = t.replace(new RegExp('\\b' + w + '\\b', 'g'), ' ' + n + ' '); });
  NP_SCALE.forEach(([re, rep]) => { t = t.replace(re, rep); });
  t = t.replace(/\bsadhe\s+(\d+(?:\.\d+)?)/g, (m, n) => ' ' + (parseFloat(n) + 0.5) + ' ');
  t = t.replace(/\bsawa\s+(\d+(?:\.\d+)?)/g, (m, n) => ' ' + (parseFloat(n) + 0.25) + ' ');
  t = t.replace(/\bpaune\s+(\d+(?:\.\d+)?)/g, (m, n) => ' ' + (parseFloat(n) - 0.25) + ' ');
  return t;
}

// Returns {s, refs:[{ids,label}], grades, breeds, bsDates, text}
// Nepali voice typing adds invisible joiners (मर्‍यो) and writes English words in Nepali letters (बी टु = B2)
function cleanNepali(t) {
  t = String(t || '').replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/([^\s\d])(वटा|ओटा|गोटा|जना)(?=\s|$)/g, '$1 $2');          // तीनवटा → तीन वटा
  return t
    .replace(/(बी|बि|भी)\s*-?\s*(जिरो|जीरो|शून्य|०|0)(?=\s|$)/g, ' B0 ').replace(/(बी|बि|भी)\s*-?\s*(वान|वन|१|1)(?=\s|$)/g, ' B1 ')
    .replace(/(बी|बि|भी)\s*-?\s*(टु|टू|२|2)(?=\s|$)/g, ' B2 ').replace(/(बी|बि|भी)\s*-?\s*(थ्री|थ्रि|३|3)(?=\s|$)/g, ' B3 ');
}
function normalize(text) {
  let t = ' ' + cleanNepali(text).toLowerCase() + ' ';
  // chickens: काटेँ / काटेको without a selling word = birds cut (✂️), not a meat sale
  if (/काट/.test(t) && !/बेच|बिक|sold|sell/i.test(t)) t = t.replace(/काटेँ|काटें|काटेको|काटियो|काट्यो|काट्यौं|काटे|काटिए/g, ' cut ');
  const refs = [], grades = [], breedsFound = [], bsDates = [];
  // a lot name typed in full, e.g. "ashar83_1_100"
  lots().forEach(l => {
    const nm = String(l.name || '').toLowerCase();
    if (nm.length > 3 && t.includes(nm)) { refs.push({ ids: [l.id], label: l.name }); t = t.split(nm).join(' lotx '); }
  });
  t = t.replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)));
  t = t.replace(/(\d)(केजी|किलो|के\.जी)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');
  t = nepaliNumbers(' ' + t + ' ');
  NE_MAP.forEach(([re, rep]) => { t = t.replace(re, rep); });
  t = t.replace(/₹/g, ' rs ').replace(/\/-/g, ' ');
  t = t.replace(/(\d),(?=\d)/g, '$1');
  t = t.replace(/(\d)\.(\d)/g, '$1§$2').replace(/\./g, ' ').replace(/§/g, '.');
  t = t.replace(/([a-z])-(?=[a-z])/g, '$1 ');
  t = t.replace(/@/g, ' at ').replace(/\/\s*kg/g, ' per kg ').replace(/[?!,;:"“”‘’()\[\]_]/g, ' ').replace(/'/g, '');
  ROMAN_MAP.forEach(([re, rep]) => { t = t.replace(re, rep); });
  t = t.replace(/(\d)([a-z])/g, '$1 $2');
  t = t.replace(/\bk\s+g\b/g, ' kg ').replace(/\b(kgs|kilos|kilo|kilograms?|kilogrammes?|keji|kezi)\b/g, ' kg ');
  t = t.replace(/\b(grams|gram|gms|gm)\b/g, ' g ');
  t = t.replace(/\brs(?=\d)/g, 'rs ').replace(/\b(rupees|rupee|rupaiya|rupiya|rupaye|rupaiyan|npr|nrs|inr)\b/g, ' rs ');
  t = wordsToNumbers(t);
  t = ' ' + t + ' ';
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:rs\s*)?(?:को|ko)(?=\s|$)/g, '$1 rs ');   // "एघार सय को मासु" = meat worth Rs 1100
  t = t.replace(/\b(a|an)\s+(kg|chicken|bird|bag|sack)\b/g, '1 $2');
  t = t.replace(/\b(to|too)\s+(kg|chickens?|birds?|bags?)\b/g, '2 $2');

  // feed grain size: B0, B1, B2, B3
  t = t.replace(new RegExp('\\b(?:b|bee|be|bi|v|vee)\\s*-?\\s*([0-3])\\b' + NOT_LOT_NUM, 'g'), (m, n) => { grades.push('B' + n); return ' feedgrade '; });
  // chicken type, and counts like "80 broiler 20 giriraj"
  const breedCounts = {};
  breedPatterns().forEach(([re, id]) => {
    if (!re.test(t)) return;
    breedsFound.push(id); re.lastIndex = 0;
    const withNum = new RegExp('(\\d+)\\s*(?:wota\\s+|birds\\s+)?' + re.source, 'g');
    let m; while ((m = withNum.exec(t))) breedCounts[id] = (breedCounts[id] || 0) + parseInt(m[1], 10);
    t = t.replace(re, ' ');
  });

  // Nepali month: "Ashar lot 1" (a lot) or "Kartik 5 gate" (a date)
  t = t.replace(MONTH_RE, (m, on, alias, num, gate) => {
    const month = MONTH_LOOKUP[alias];
    const n = num ? parseInt(num, 10) : null;
    const inMonth = lots().filter(l => lotBs(l).m === month);
    if (n != null && !on && !gate) {
      const hit = inMonth.filter(l => lotSeq(l) === n);
      if (hit.length) { refs.push({ ids: preferActive(hit), label: BS_MONTHS[month - 1] + ' lot ' + n }); return ' lotx '; }
    }
    if (n != null && n >= 1 && n <= 32) { bsDates.push({ m: month, d: n }); return ' '; }
    if (inMonth.length) { refs.push({ ids: preferActive(inMonth), label: BS_MONTHS[month - 1] + ' lot' }); return ' lotx '; }
    return ' ';
  });
  // "lot 2" = 2nd active lot on the dashboard
  t = t.replace(LOTNO_RE, (m, n) => {
    const l = activeLots()[parseInt(n, 10) - 1];
    refs.push({ ids: l ? [l.id] : [], label: 'lot ' + n });
    return ' lotx ';
  });
  t = t.replace(/\b(first|second|third|fourth|fifth|last|latest|newest|oldest)\s+(?:lot|batch)\b/g, (m, w) => {
    const act = activeLots();
    const l = w === 'last' || w === 'latest' || w === 'newest' ? act[act.length - 1] : w === 'oldest' ? act[0] : act[ORDINALS[w] - 1];
    refs.push({ ids: l ? [l.id] : [], label: w + ' lot' });
    return ' lotx ';
  });
  t = t.replace(/\s+/g, ' ').trim();
  return { s: t, refs, grades, breeds: breedsFound, breedCounts, bsDates, text: String(text || '') };
}
function preferActive(list) {
  const act = list.filter(l => !l.closed);
  if (act.length) return act.map(l => l.id);
  return [list.slice().sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0].id];
}

function takeDate(ctx, bsDates) {
  let s = ctx.s, d = null;
  const t = today();
  let m;
  if (bsDates && bsDates.length) {
    const tb = adToBs(t);
    let ad = bsToAd(tb.y, bsDates[0].m, bsDates[0].d);
    if (ad > t) ad = bsToAd(tb.y - 1, bsDates[0].m, bsDates[0].d);
    d = ad;
  } else if (/\bday before yesterday\b/.test(s)) { d = addDays(t, -2); s = s.replace(/\bday before yesterday\b/, ' '); }
  else if (/\b(yesterday|last night)\b/.test(s)) { d = addDays(t, -1); s = s.replace(/\b(yesterday|last night)\b/, ' '); }
  else if ((m = /\b(\d{1,2}) days? ago\b/.exec(s))) { d = addDays(t, -parseInt(m[1], 10)); s = s.replace(m[0], ' '); }
  s = s.replace(/\btoday\b/g, ' ').replace(/\bgate\b/g, ' ');
  ctx.s = s;
  return d;
}
function take(ctx, re) { const m = re.exec(ctx.s); if (m) ctx.s = ctx.s.replace(m[0], ' '); return m; }
function numbersLeft(ctx) { return (ctx.s.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat); }
const AMOUNT_RES = [
  /\b(?:for|total|amount|worth|received|got|paid|cash|of)\s*(?:rs\s*)?(\d+(?:\.\d+)?)(?:\s*rs)?/,
  /\brs\s*(\d+(?:\.\d+)?)/,
  /(\d+(?:\.\d+)?)\s*rs\b/
];
function takeAmount(ctx) { for (const re of AMOUNT_RES) { const m = take(ctx, re); if (m) return parseFloat(m[1]); } return null; }
function saleType(s) {
  if (/\bparts\b/.test(s)) return 'parts';
  if (/\blive\b/.test(s)) return 'live';
  if (/\b(meat|cut|dressed|chopped|boneless|processed|curry|cleaned)\b/.test(s)) return 'meat';
  return null;
}

function parseCommand(text) {
  const n = normalize(text);
  const s = n.s;
  const has = re => re.test(s);
  const p = { text: n.text, lotRefs: n.refs, breed: n.breeds[0] || null, breedCounts: n.breedCounts, grade: n.grades[0] || null, intent: 'unknown' };
  const ctx = { s: s.replace(/\b(lotx|feedgrade)\b/g, ' ') };
  p.date = takeDate(ctx, n.bsDates);
  const question = has(/\b(how many|how much|what|whats|tell me|show me|show|status|kitna)\b/) || /\?\s*$/.test(n.text);
  const sold = has(/\b(sold|sell|sale|sales|selling|gave|delivered)\b/);

  if (has(/\b(undo|delete last|remove last|cancel last)\b/)) p.intent = 'undo';
  else if (has(/^(help|commands)\b|\bwhat can (you|i) (do|say)\b/)) p.intent = 'help';
  else if (has(/\b(new|add|added|start|started|create|open|arrived|came|placed|brought)\b/) && has(/\b(lot|lotx|batch|chicks?)\b/) && !has(/\b(dead|died|feed|sold|medicine|vaccine)\b/)) {
    p.intent = n.refs.length ? 'restock' : 'newlot';
    if (p.intent === 'newlot') p.lotRefs = [];
    let fm = take(ctx, /(\d+)\s*(?:wota\s+|birds\s+|chicks?\s+)?(?:free|fri|bonus|muft|sittai|सित्तै|फ्री|फ्रि)\b|\b(?:free|fri|bonus|muft|sittai)\s*(\d+)/);
    if (fm) p.free = parseInt(fm[1] || fm[2], 10);
    let m = take(ctx, /\b(?:at|each|per chick|rate)\s*(?:rs\s*)?(\d+(?:\.\d+)?)(?:\s*rs)?(?:\s*(?:each|per chick))?/);
    if (m) p.chickRate = parseFloat(m[1]);
    else if ((m = take(ctx, /(\d+(?:\.\d+)?)\s*(?:rs\s*)?(?:each|per chick)/))) p.chickRate = parseFloat(m[1]);
    m = take(ctx, /(\d+)\s*(?:chicks?|chickens?|birds?|pieces?|pcs)\b/);
    if (m) p.chicks = parseInt(m[1], 10);
    const amt = takeAmount(ctx);
    if (amt != null && p.chickRate == null) p.cost = amt;
    if (p.chicks == null) { const rest = numbersLeft(ctx); if (rest.length) p.chicks = Math.round(Math.max.apply(null, rest)); }
  }
  else if (has(/\b(shop|collected)\b/) || (has(/\b(cash|qr)\b/) && has(/\d/) && !has(/\bkg\b/))) {
    if (question || !has(/\d/)) p.intent = 'queryShop'; else parseShop(p, ctx);
  }
  else if (!question && has(/\b(bought|buy|buying|purchase|purchased)\b/) && !has(/\bchicks?\b/)) parsePurchase(p, ctx, s);
  else if (has(/\b(price|rate)\b/) && !sold && !has(/\d\s*kg\b/) && (question || has(/\b(set|change|update|make|new|default|standard|is|to)\b/) || has(/\d/))) {
    p.type = saleType(s);
    if (question && !has(/\b(set|change|update|make)\b/)) p.intent = 'queryPrice';
    else { p.intent = 'setprice'; const ns = numbersLeft(ctx); p.rate = ns.length ? ns[0] : null; }
  }
  else if (question && !has(/\d+\s*(kg|chickens?|birds?)\b/)) {
    if (has(/\b(feed|feeds|grain|dana|feedgrade|medicines?|vitamins?|vaccines?)\b/) || (has(/\bstock\b/) && !has(/\bchickens?\b/))) p.intent = 'queryStock';
    else if (has(/\b(profit|loss|earn|earned|earning)\b/)) p.intent = 'report';
    else if (has(/\b(left|remaining|remain|balance|have|there|alive)\b/)) p.intent = 'queryLeft';
    else if (has(/\b(price|rate)\b/)) p.intent = 'queryPrice';
    else p.intent = 'querySummary';
    p.period = periodOf(s, p.date);
  }
  else if (has(/\b(profit|loss|report)\b/) && !has(/\d/)) { p.intent = 'report'; p.period = periodOf(s, p.date); }
  else if (has(/\b(stock)\b/) && !has(/\d/)) p.intent = 'queryStock';
  else if (has(/\b(summary|total)\b/) && !has(/\d/)) { p.intent = 'querySummary'; p.period = periodOf(s, p.date); }
  else if (has(/\b(dead|died|die|dies|death|deaths|dying|mortality|passed away)\b/)) {
    p.intent = 'dead';
    const ns = numbersLeft(ctx); p.count = ns.length ? Math.round(ns[0]) : 1;
  }
  else if (has(/\b(cut|cutting|slaughter|slaughtered|dressed|processed|chopped)\b/) && !sold && !has(/\brs\b/)) {
    p.intent = 'cut';
    let m = take(ctx, /(\d+(?:\.\d+)?)\s*kg\b/); if (m) p.qty = parseFloat(m[1]);
    m = take(ctx, /(\d+)\s*(?:chickens?|birds?|pieces?|pcs|hens?)\b/);
    if (m) p.count = parseInt(m[1], 10); else { const ns = numbersLeft(ctx); if (ns.length) p.count = Math.round(ns[0]); }
  }
  else if (sold && has(/\b(feed|feeds|feedgrade|grain|grains)\b/)) parseGrainSale(p, ctx, s);
  else if (has(/\b(feed|feeds|feeding|feedgrade)\b/)) {
    p.intent = 'feed';
    const m = take(ctx, /(\d+(?:\.\d+)?)\s*(bags?|sacks?|bora|boras|kg|packets?)\b/);
    if (m) { p.qty = parseFloat(m[1]); p.unit = /kg/.test(m[2]) ? 'kg' : 'bags'; }
    p.amount = takeAmount(ctx);
    if (p.amount == null) { const ns = numbersLeft(ctx); if (ns.length) { if (p.qty == null && ns[0] < 100) { p.qty = ns[0]; p.unit = 'bags'; ns.shift(); } if (ns.length) p.amount = ns[ns.length - 1]; } }
  }
  else if (has(/\b(vaccine|vaccines|vaccination|vaccinated|vaccinate)\b/)) parseUsage(p, ctx, 'vaccine');
  else if (has(/\b(vitamins?|tonic|multivitamin|electrolytes?|minerals?)\b/)) parseUsage(p, ctx, 'vitamin');
  else if (has(/\b(medicine|medicines|medication|antibiotics?|dawai|syrup|injection)\b/)) parseUsage(p, ctx, 'medicine');
  else if (has(/\b(weight|weigh|weighs|weighed|average)\b/) && !sold) {
    p.intent = 'weight';
    let m = take(ctx, /(\d+(?:\.\d+)?)\s*(kg|g)\b/);
    if (m) p.qty = m[2] === 'g' ? parseFloat(m[1]) / 1000 : parseFloat(m[1]);
    else { const ns = numbersLeft(ctx); if (ns.length) p.qty = ns[0] > 20 ? ns[0] / 1000 : ns[0]; }
    if (p.qty != null) p.qty = round(p.qty, 3);
  }
  else if (sold || has(/\d\s*kg\b/) || (has(/\bparts\b/) && has(/\d/)) || (has(/\b(live|meat)\b/) && has(/\d\s*rs\b|\brs\s*\d/))) parseSale(p, ctx, s);
  else if (has(/\d/) && has(/\b(left|remaining|remain|have|has|counted|count|there are|in stock|stock|alive)\b/)) {
    p.intent = 'stockcount'; const ns = numbersLeft(ctx); p.count = Math.round(ns[0]);
  }
  else if (has(/\b(expense|expenses|spent|spend|paid|electricity|labour|labor|rent|sawdust|husk|transport|bill|cost)\b/)) {
    p.intent = 'expense'; p.amount = takeAmount(ctx); if (p.amount == null) { const ns = numbersLeft(ctx); if (ns.length) p.amount = ns[0]; }
  }
  else if (has(/^(note|remember)\b/)) p.intent = 'note';
  return p;
}

const UNIT_RE = /(\d+(?:\.\d+)?)\s*(bags?|sacks?|kg|g|bottles?|packets?|pkts?|litres?|liters?|ltrs?|ml|pcs|pieces?|doses?|vials?|tablets?)\b/;
function unitName(u) {
  if (/^(bag|sack)/.test(u)) return 'bags';
  if (/^(bottle)/.test(u)) return 'bottle';
  if (/^(packet|pkt)/.test(u)) return 'packet';
  if (/^(litre|liter|ltr)/.test(u)) return 'litre';
  if (/^(piece|pcs|tablet)/.test(u)) return 'pcs';
  if (/^dose/.test(u)) return 'dose';
  if (/^vial/.test(u)) return 'vial';
  return u;
}
const STOP = new Set(('bought buy buying purchase purchased feed feeds grain grains dana medicine medicines medication vitamin vitamins vaccine vaccines vaccination ' +
  'for at of the a an and to in on from rs kg g ml bags bag sack sacks rate each per total amount worth paid cash credit unpaid invoice bill some new today yesterday ' +
  'got with i we ko ma lai le chicken chickens birds lot lotx batch litre bottle bottles packet packets pcs pieces piece doses dose vial vials tablets tablet ' +
  'gave give given used use put mixed water dawai antibiotic antibiotics tonic electrolyte electrolytes minerals multivitamin syrup injection feedgrade gate it them this that is was').split(' '));
function leftoverWords(ctx) {
  return ctx.s.split(/\s+/).filter(w => w && !/\d/.test(w) && !STOP.has(w)).join(' ').trim();
}
// "medicine amprolium 1 bottle lot 1", "vitamin 2 packets 300 rupees"
function parseUsage(p, ctx, type) {
  p.intent = type;
  const m = take(ctx, UNIT_RE);
  if (m) { p.qty = parseFloat(m[1]); p.unit = unitName(m[2]); }
  p.amount = takeAmount(ctx);
  if (p.amount == null) { const ns = numbersLeft(ctx); if (ns.length) { if (p.qty == null && ns[0] < 50) { p.qty = ns[0]; ns.shift(); } if (ns.length) p.amount = ns[ns.length - 1]; } }
  p.item = leftoverWords(ctx);
}
// "bought 10 bags B2 feed for 34000 from Ram", "bought 2 bottles amprolium medicine 900 credit"
function parsePurchase(p, ctx, s) {
  p.intent = 'purchase';
  p.category = p.grade || /\b(feed|feeds|grain|grains|dana|starter|grower|finisher)\b/.test(s) ? 'feed'
    : /\b(vitamins?|tonic|multivitamin|electrolytes?|minerals?)\b/.test(s) ? 'vitamin'
    : /\b(vaccines?|vaccination)\b/.test(s) ? 'vaccine'
    : /\b(medicines?|medication|antibiotics?|dawai|tablets?|syrup|injection|powder|drugs?)\b/.test(s) ? 'medicine'
    : /\b(feeders?|drinkers?|equipment|bulbs?|heaters?|net|buckets?|tray|trays)\b/.test(s) ? 'equipment' : null;
  p.flag = /\b(credit|unpaid|pending|later)\b/.test(s);
  let m = take(ctx, /\b(?:invoice|bill|receipt|voucher)\s*(?:no|number|num|#)?\s*([a-z]{0,3}\d[\w-]*)/);
  if (m) p.invoice = m[1].toUpperCase();
  m = take(ctx, /\bfrom\s+([a-z]+(?:\s+[a-z]+)?)/);
  if (m) { const sup = m[1].split(' ').filter(w => !STOP.has(w)).join(' '); if (sup) p.supplier = sup.replace(/\b\w/g, c => c.toUpperCase()); else ctx.s += ' ' + m[1]; }
  m = take(ctx, /\b(?:at|rate|each)\s*(?:rs\s*)?(\d+(?:\.\d+)?)(?:\s*rs)?(?:\s*(?:per|each|a)\s*[a-z]+)?/)
    || take(ctx, /(\d+(?:\.\d+)?)\s*(?:rs\s*)?per\s+(?:bag|kg|bottle|packet|pc|piece|vial|dose|litre)\b/);
  if (m) p.rate = parseFloat(m[1]);
  m = take(ctx, UNIT_RE);
  if (m) { p.qty = parseFloat(m[1]); p.unit = unitName(m[2]); }
  p.amount = takeAmount(ctx);
  const ns = numbersLeft(ctx);
  if (p.amount == null && ns.length) {
    if (p.qty == null && ns.length >= 2) { p.qty = ns[0]; p.amount = ns[ns.length - 1]; }
    else if (p.qty == null && ns[0] < 200 && p.rate != null) p.qty = ns[0];
    else if (p.qty == null && ns[0] < 200 && p.rate == null) p.qty = ns[0];
    else p.amount = ns[ns.length - 1];
  }
  if (p.amount == null && p.rate != null && p.qty != null) p.amount = round(p.rate * p.qty, 2);
  if (p.rate == null && p.amount != null && p.qty) p.rate = round(p.amount / p.qty, 2);
  if (p.qty != null && !p.unit) p.unit = p.category === 'feed' ? 'bags' : 'pcs';
  p.item = p.category === 'feed' ? '' : leftoverWords(ctx);
}

function periodOf(s, date) {
  if (/\b(week)\b/.test(s)) return 'week';
  if (/\b(month)\b/.test(s)) return 'month';
  if (/\b(all|ever|overall|total)\b/.test(s) && !/\btoday\b/.test(s)) return 'all';
  if (date) return date;
  return 'today';
}

// breed of the lot the sentence is about (for price guesses)
function guessBreed(p) {
  if (p.breed) return p.breed;
  const ref = p.lotRefs && p.lotRefs[0];
  const l = ref && ref.ids.length === 1 ? lotById(ref.ids[0]) : (activeLots().length === 1 ? activeLots()[0] : null);
  return l ? (l.breed || 'broiler') : 'broiler';
}

// "sold 2 bora B1 dana", "B2 dana 10 kg becheko 1000", "sold B0 feed 1 bag at 4600 credit"
function parseGrainSale(p, ctx, s) {
  p.intent = 'grainsale';
  p.flag = /\b(credit|unpaid|pending|later)\b/.test(s);
  let m = take(ctx, /\b(?:at|rate|each|price)\s*(?:rs\s*)?(\d+(?:\.\d+)?)(?:\s*rs)?(?:\s*(?:per|each|a)\s*(bags?|kg))?/)
    || take(ctx, /(\d+(?:\.\d+)?)\s*(?:rs\s*)?per\s+(bags?|kg)\b/);
  if (m) { p.rate = parseFloat(m[1]); if (m[2]) p.rateUnit = /kg/.test(m[2]) ? 'kg' : 'bags'; }
  m = take(ctx, /(\d+(?:\.\d+)?)\s*(bags?|sacks?|kg)\b/);
  if (m) { p.qty = parseFloat(m[1]); p.unit = /kg/.test(m[2]) ? 'kg' : 'bags'; }
  p.amount = takeAmount(ctx);
  const ns = numbersLeft(ctx);
  if (ns.length) {
    if (p.qty == null && ns.length >= 2) { p.qty = ns[0]; p.amount = p.amount == null ? ns[ns.length - 1] : p.amount; }
    else if (p.qty == null && ns[0] < 100) p.qty = ns[0];
    else if (p.amount == null) p.amount = ns[ns.length - 1];
  }
  if (p.qty != null && !p.unit) p.unit = 'bags';
}

function parseSale(p, ctx, s) {
  p.intent = 'sale';
  p.type = saleType(s);
  p.flag = /\b(flag|flagged|credit|unpaid|pending|later)\b/.test(s);
  let m = take(ctx, /\b(?:invoice|bill|receipt|voucher)\s*(?:no|number|num|#)?\s*([a-z]{0,3}\d[\w-]*)/);
  if (m) p.invoice = m[1].toUpperCase();
  m = take(ctx, /\b(?:at|rate|price)\s*(?:of\s*|is\s*)?(?:rs\s*)?(\d+(?:\.\d+)?)(?:\s*rs)?(?:\s*(?:per|a|each|every)\s*kg)?/)
    || take(ctx, /(?:rs\s*)?(\d+(?:\.\d+)?)\s*(?:rs\s*)?(?:per|a|each|every)\s+kg/)
    || take(ctx, /(\d+(?:\.\d+)?)\s*(?:rs\s*)?(?:ko\s+)?(?:price|rate)\b/);
  if (m) p.rate = parseFloat(m[1]);
  m = take(ctx, /(\d+(?:\.\d+)?)\s*kg\b/) || take(ctx, /\bkg\s*(\d+(?:\.\d+)?)/);
  if (m) p.kg = parseFloat(m[1]);
  m = take(ctx, /(\d+)\s*(?:live\s+|meat\s+)?(?:chickens?|birds?|pieces?|pcs|hens?|murga|murgi|nos)\b/) || take(ctx, /\b(?:cut|katyo|kate)\s+(\d+)\b/);
  if (m) p.birds = parseInt(m[1], 10);
  p.amount = takeAmount(ctx);
  const rest = numbersLeft(ctx);
  if (rest.length) {
    const x = rest[0];
    if (p.kg == null && p.amount == null && p.rate == null) p.kg = x;
    else if (p.kg != null && p.rate == null && p.amount == null) {
      const def = priceFor(p.type || getSet('defaultType'), guessBreed(p));
      if (def ? (x >= def * 0.5 && x <= def * 1.6) : x < 1500) p.rate = x; else p.amount = x;
    } else if (p.kg == null && (p.rate != null || p.amount != null)) p.kg = x;
  }
}

function yesNo(text) {
  const s = ' ' + normalize(text).s + ' ';
  if (/\b(edit|change|modify|correct it)\b/.test(s)) return 'edit';
  const y = s.search(/\b(yes|yeah|yep|yup|ya|yah|ok|okay|sure|save|saved|correct|right|haan|han|ha|ho|confirm|done|do it|go ahead|please|fine|good)\b/);
  const n = s.search(/\b(no|nope|nah|cancel|dont|not|wrong|nai|stop|never|nahi)\b/);
  if (y < 0 && n < 0) return undefined;
  if (y < 0) return 'no';
  if (n < 0) return 'yes';
  return y < n ? 'yes' : 'no';
}
// answer to "Which lot?" — list is the lots shown as buttons (numbered 1, 2, 3…)
function lotAnswer(text, list) {
  list = list || activeLots();
  const n = normalize(text);
  const inList = id => list.some(l => l.id === id);
  for (const r of n.refs) { const ids = r.ids.filter(inList); if (ids.length === 1) return ids[0]; }
  if (n.breeds.length) { const b = list.filter(l => (l.breed || 'broiler') === n.breeds[0]); if (b.length === 1) return b[0].id; }
  const ord = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: list.length };
  for (const k in ord) if (new RegExp('\\b' + k + '\\b').test(n.s) && list[ord[k] - 1]) return list[ord[k] - 1].id;
  const m = /^\s*(?:number\s*)?(\d{1,2})\s*$/.exec(n.s);
  if (m && list[+m[1] - 1]) return list[+m[1] - 1].id;
  return undefined;
}
function breedAnswer(text) { const n = normalize(text); return n.breeds[0] || undefined; }
function gradeAnswer(text) {
  const n = normalize(text);
  if (n.grades[0]) return n.grades[0];
  if (/\b(skip|none|no|nothing|other)\b/.test(n.s)) return '';
  const m = /^\s*([0-3])\s*$/.exec(n.s);
  return m ? 'B' + m[1] : undefined;
}
function numberAnswer(text) {
  const m = /(\d+(?:\.\d+)?)/.exec(normalize(text).s.replace(/\b(lotx|feedgrade)\b/g, ' '));
  return m ? parseFloat(m[1]) : undefined;
}
