/* Gram Hisab — Roman → नेपाली for people's names ("Ram Bahadur Thapa" → "राम बहादुर थापा").
   Common names and surnames come from a small word list; anything else is spelled by sound.
   It is only a suggestion: the Nepali spelling can be corrected per person. */
'use strict';

const NE_NAME_WORDS = {
  ram: 'राम', shyam: 'श्याम', sita: 'सीता', gita: 'गीता', geeta: 'गीता', hari: 'हरि', krishna: 'कृष्ण', krishn: 'कृष्ण', bishnu: 'विष्णु', vishnu: 'विष्णु',
  shiva: 'शिव', shiv: 'शिव', ganesh: 'गणेश', laxmi: 'लक्ष्मी', lakshmi: 'लक्ष्मी', laxman: 'लक्ष्मण', durga: 'दुर्गा', parbati: 'पार्वती', parvati: 'पार्वती',
  saraswati: 'सरस्वती', kamala: 'कमला', sarita: 'सरिता', sunita: 'सुनिता', anita: 'अनिता', babita: 'बबिता', radha: 'राधा', rita: 'रीता', mina: 'मीना', meena: 'मीना',
  maya: 'माया', devi: 'देवी', kumari: 'कुमारी', kumar: 'कुमार', bahadur: 'बहादुर', prasad: 'प्रसाद', narayan: 'नारायण', chandra: 'चन्द्र', raj: 'राज',
  bir: 'वीर', man: 'मान', lal: 'लाल', nath: 'नाथ', dev: 'देव', datta: 'दत्त', mani: 'मणि', jit: 'जित', jung: 'जङ्ग', shankar: 'शंकर', rajendra: 'राजेन्द्र', surendra: 'सुरेन्द्र', mahendra: 'महेन्द्र', narendra: 'नरेन्द्र', bishal: 'विशाल', bhagwati: 'भगवती', gyanu: 'ज्ञानु', gopal: 'गोपाल',
  suresh: 'सुरेश', ramesh: 'रमेश', dinesh: 'दिनेश', mahesh: 'महेश', rajesh: 'राजेश', naresh: 'नरेश', umesh: 'उमेश', binod: 'विनोद',
  prakash: 'प्रकाश', roshan: 'रोशन', santosh: 'सन्तोष', sanjay: 'सञ्जय', bikash: 'विकास', bikas: 'विकास', deepak: 'दीपक', dipak: 'दीपक', anil: 'अनिल',
  sunil: 'सुनिल', kiran: 'किरण', arjun: 'अर्जुन', bhim: 'भीम', govinda: 'गोविन्द', gobinda: 'गोविन्द', keshav: 'केशव', madhav: 'माधव', tika: 'टीका',
  til: 'तिल', tek: 'टेक', dil: 'दिल', dal: 'दल', nar: 'नर', hem: 'हेम', min: 'मीन', yam: 'यम', om: 'ओम', ishwar: 'ईश्वर', ishwor: 'ईश्वर', sagar: 'सागर',
  suman: 'सुमन', sujan: 'सुजन', rabin: 'रविन', rabi: 'रवि', ravi: 'रवि', shanti: 'शान्ति', sushila: 'सुशीला', sabitri: 'सावित्री', januka: 'जनुका',
  chandrakala: 'चन्द्रकला', bimala: 'विमला', nirmala: 'निर्मला', samjhana: 'सम्झना', sabina: 'सबिना', puja: 'पूजा', pooja: 'पूजा',
  thapa: 'थापा', magar: 'मगर', gurung: 'गुरुङ', tamang: 'तामाङ', rai: 'राई', limbu: 'लिम्बु', sherpa: 'शेर्पा', lama: 'लामा', newar: 'नेवार',
  shrestha: 'श्रेष्ठ', sharma: 'शर्मा', adhikari: 'अधिकारी', karki: 'कार्की', khadka: 'खड्का', bhandari: 'भण्डारी', poudel: 'पौडेल', paudel: 'पौडेल',
  dahal: 'दाहाल', pandey: 'पाण्डे', pande: 'पाण्डे', joshi: 'जोशी', basnet: 'बस्नेत', bista: 'बिष्ट', chhetri: 'क्षेत्री', kshetri: 'क्षेत्री', rana: 'राणा',
  bhattarai: 'भट्टराई', ghimire: 'घिमिरे', regmi: 'रेग्मी', neupane: 'न्यौपाने', aryal: 'अर्याल', subedi: 'सुवेदी', acharya: 'आचार्य', khanal: 'खनाल',
  koirala: 'कोइराला', devkota: 'देवकोटा', gautam: 'गौतम', pokharel: 'पोखरेल', bhusal: 'भुसाल', timilsina: 'तिमिल्सिना', lamichhane: 'लामिछाने',
  rijal: 'रिजाल', rimal: 'रिमाल', silwal: 'सिलवाल', oli: 'ओली', kc: 'केसी', bk: 'बिके', yadav: 'यादव', chaudhary: 'चौधरी', chaudhari: 'चौधरी',
  tharu: 'थारु', mahato: 'महतो', shah: 'शाह', sah: 'साह', singh: 'सिंह', kami: 'कामी', damai: 'दमाई', sarki: 'सार्की', pariyar: 'परियार',
  nepali: 'नेपाली', bohara: 'बोहरा', bhatta: 'भट्ट', giri: 'गिरी', puri: 'पुरी', budha: 'बुढा', rawal: 'रावल', malla: 'मल्ल', thakuri: 'ठकुरी',
  dai: 'दाइ', didi: 'दिदी', bhai: 'भाइ', bahini: 'बहिनी', kaka: 'काका', kaki: 'काकी', mama: 'मामा', maiju: 'माइजु', aama: 'आमा', ama: 'आमा',
  buwa: 'बुवा', baa: 'बा', ba: 'बा', hajurba: 'हजुरबा', hajuraama: 'हजुरआमा', bhinaju: 'भिनाजु', sasu: 'सासु', sasura: 'ससुरा', jwai: 'ज्वाइँ',
  sahu: 'साहु', saahu: 'साहु', sahuni: 'साहुनी', ji: 'जी', jee: 'जी', sir: 'सर', madam: 'म्याडम', mukhiya: 'मुखिया', pasal: 'पसल', wala: 'वाला',
  hotel: 'होटल', kirana: 'किराना', dokan: 'दोकान', shree: 'श्री', shri: 'श्री', sri: 'श्री', mr: 'मि.', ms: 'सुश्री', jethi: 'जेठी', maili: 'माइली',
  saili: 'साइली', kanchhi: 'कान्छी', kanchha: 'कान्छा', jetha: 'जेठा', maila: 'माइला', saila: 'साइला', thulo: 'ठूलो', sano: 'सानो', budo: 'बुढो',
  buda: 'बुढा', ko: 'को', ki: 'की', le: 'ले'
};

// consonants (longest first) and vowels: [independent, sign]
const NE_CONS = [['ksh', 'क्ष'], ['chh', 'छ'], ['shh', 'ष'], ['gy', 'ग्य'], ['kh', 'ख'], ['gh', 'घ'], ['ch', 'च'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'],
  ['ph', 'फ'], ['bh', 'भ'], ['sh', 'श'], ['ng', 'ङ'], ['k', 'क'], ['g', 'ग'], ['c', 'क'], ['j', 'ज'], ['t', 'त'], ['d', 'द'], ['n', 'न'], ['p', 'प'], ['f', 'फ'],
  ['b', 'ब'], ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['w', 'व'], ['v', 'व'], ['s', 'स'], ['h', 'ह'], ['z', 'ज'], ['x', 'क्स'], ['q', 'क']];
const NE_VOW = [['aa', 'आ', 'ा'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'], ['ee', 'ई', 'ी'], ['ii', 'ई', 'ी'], ['oo', 'ऊ', 'ू'], ['ou', 'औ', 'ौ'],
  ['a', 'अ', ''], ['i', 'इ', 'ि'], ['u', 'उ', 'ु'], ['e', 'ए', 'े'], ['o', 'ओ', 'ो']];

function neWordBySound(w) {
  let out = '', i = 0, prevCons = false, cluster = false;
  const vowAt = j => NE_VOW.find(([k]) => w.startsWith(k, j));
  while (i < w.length) {
    const v = vowAt(i);
    if (v) {
      const [k, ind] = v; let sign = v[2];
      const end = i + k.length >= w.length;
      if (end && k === 'a' && prevCons && !(cluster && /(dr|shn)a$/.test(w)) && w.length > 2) sign = 'ा'; // Sita → सिता, Thapa → थापा; Rajendra keeps -द्र
      if (end && k === 'i' && prevCons && w.length > 3) sign = 'ी';           // Kumari → कुमारी
      out += prevCons ? sign : ind; i += k.length; prevCons = false; continue;
    }
    let c = NE_CONS.find(([k]) => w.startsWith(k, i));
    if (!c) { out += w[i]; i++; prevCons = false; continue; }
    if (c[0] === 'ng' && i + 2 < w.length) c = ['n', 'न'];                     // ङ only at the end (Gurung); Ganga → गंगा
    const [k, ch] = c, j = i + k.length, nextCons = j < w.length && !vowAt(j);
    // n before k / g → nasal sign (Ganga → गंगा); elsewhere a half letter (Santa → सन्ता)
    if (k === 'n' && !prevCons && out && nextCons && /[kg]/.test(w[j])) { out += 'ं'; i = j; continue; }
    cluster = prevCons;
    out += (prevCons ? '्' : '') + ch; i = j; prevCons = true;
  }
  return out;
}
// "Ram Bahadur Thapa" → "राम बहादुर थापा"; names already in Devanagari come back unchanged
function romanToNe(name) {
  const s = String(name || '').trim();
  if (!s || /[ऀ-ॿ]/.test(s)) return '';
  return s.split(/(\s+|[.\-,])/).map(part => {
    const w = part.toLowerCase();
    if (!/^[a-z]+$/.test(w)) return part === '.' ? '' : part;
    return NE_NAME_WORDS[w] || neWordBySound(w);
  }).join('').replace(/\s+/g, ' ').trim();
}
