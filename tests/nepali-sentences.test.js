const fs=require('fs'),vm=require('vm');const A=process.argv[2];const store={};
const ctx={console,Intl,Math,Date,JSON,String,Number,Object,Array,RegExp,Set,parseFloat,parseInt,isFinite,isNaN,setTimeout,clearTimeout,Function,
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},document:{getElementById:()=>null,addEventListener:()=>{},querySelector:()=>null},$:()=>null,$$:()=>[]};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(['nepcal.js','core.js','calc.js','parser.js','shop.js','landunits.js','kheti.js','kheti-voice.js'].map(f=>fs.readFileSync(A+'/'+f,'utf8')).join('\n')+`
;loadDb();scheduleSync=()=>{};
const mk=(ad,chicks,breed)=>{const seq=nextLotSeq(ad);return put({kind:'lot',name:lotAutoName(ad,seq,chicks),seq,breed,startDate:ad,chicks});};
mk(addDays(today(),-30),100,'broiler');
var F1=put({kind:'field',name:'पूर्वे खेत',areaM2:1000}); put({kind:'kheti',fieldId:F1.id,crops:[{crop:'dhaan',role:'main'}],plantDate:today(),status:'growing'});
put({kind:'worker',name:'राम',family:'थापा'});
`,ctx);
// mill + credit parsers need a few helpers only
vm.runInContext(fs.readFileSync(A+'/mill.js','utf8').replace(/document\.addEventListener[\s\S]*$/,'')+'\n'+fs.readFileSync(A+'/credit.js','utf8').replace(/document\.addEventListener[\s\S]*$/,''),ctx);
const R=s=>vm.runInContext(s,ctx);
const P=t=>{const p=R('parseCommand('+JSON.stringify(t)+')');return p.intent+(p.kg?' kg='+p.kg:'')+(p.amount?' amt='+p.amount:'')+(p.type?' type='+p.type:'')+(p.count?' n='+p.count:'')+(p.grade?' '+p.grade:'')+(p.qty?' qty='+p.qty:'')+(p.cash?' cash='+p.cash:'')+(p.qr?' qr='+p.qr:'')+(p.goods?' goods='+p.goods:'')+(p.flag?' credit':'')+(p.birds?' birds='+p.birds:'');};
const K=t=>{const p=R('parseKheti('+JSON.stringify(t)+')');return p?p.intent+(p.workType?' '+p.workType:'')+(p.extraFull?' full='+p.extraFull:'')+(p.hours?' hr='+p.hours:'')+(p.hireAmount?' hire='+p.hireAmount:'')+(p.cost?' cost='+p.cost:'')+(p.qty?' qty='+p.qty:'')+(p.unit?' '+p.unit:'')+(p.amount?' amt='+p.amount:'')+(p.workerId?' worker':''):'null';};
const M=t=>{const p=R('parseMill('+JSON.stringify(t)+')');return p?p.intent+' '+p.item+' '+p.qty+' '+p.unit:'null';};
const C=t=>{const p=R('parseCredit('+JSON.stringify(t)+')');return p?p.type+' '+p.person+' '+p.amount:'null';};
const tests=[
 ['P','आज दुई किलो मासु बेचेँ','sale kg=2 type=meat'],['P','तीन किलो जिउँदो कुखुरा बेचेको','sale kg=3 type=live'],['P','पाँच सय रुपैयाँको मासु बेचेँ','sale amt=500 type=meat'],
 ['P','दुई वटा कुखुरा मरे','dead n=2'],['P','एउटा कुखुरा मर्‍यो','dead n=1'],['P','एउटा कुखुरा मर्यो','dead n=1'],['P','बी टु दाना दुई बोरा किनेँ','purchase B2 qty=2'],['P','बी वान दाना एक बोरा किनेको','purchase B1 qty=1'],
 ['P','कति कुखुरा बाँकी छ','queryLeft'],['P','आजको हिसाब','querySummary'],['P','यो महिनाको नाफा कति','report'],['P','खुट्टा टाउको एक किलो','sale kg=1 type=parts'],
 ['P','हिजो चार किलो मासु बेचेको थियो','sale kg=4 type=meat'],['P','दुई किलो मासु उधारो','sale kg=2 type=meat credit'],['P','डेढ किलो मासु','sale kg=1.5 type=meat'],
 ['P','मासु दुई केजी बेचियो','sale kg=2 type=meat'],['P','जिउँदो कुखुरा दुई वटा पाँच किलो','sale kg=5 type=live birds=2'],['P','दाना बी थ्री दुई बोरा हाल्यो','feed B3 qty=2'],
 ['P','नगद पाँच हजार क्यूआर तीन हजार','shop cash=5000 qr=3000'],
 ['P','एक केजी मासु','sale kg=1 type=meat'],['P','कुखुरा बेचेँ दुई किलो जिउँदो','sale kg=2 type=live'],['P','दुई वटा कुखुरा काटेँ तीन किलो मासु','cut n=2'],
 ['P','सात सय पचास रुपैयाँको जिउँदो कुखुरा','sale amt=750 type=live'],['P','आज एघार सय को मासु बेचियो','sale amt=1100 type=meat'],['P','साढे तीन किलो मासु पाँच सय रुपैयाँ किलो','sale kg=3.5 type=meat'],
 ['P','बी जिरो दाना पाँच बोरा किनेँ बीस हजार','purchase B0 qty=5 amt=20000'],['P','हिजो तीनवटा कुखुरा मरे','dead n=3'],['P','दुईवटा कुखुरा मरेका छन्','dead n=2'],['P','पसल नगद चार हजार सामान दुई हजार','shop cash=4000 goods=2000'],
 ['K','पूर्वे खेतमा रोपाइँ छ जना खेताला','kWork ropai full=6'],['K','आज गोडमेल तीन जना खेताला','kWork godmel full=3'],['K','ट्याक्टर तीन घण्टा पन्ध्र सय','kMachine hr=3 hire=1500'],
 ['K','डीएपी दुई बोरा नौ हजार','kInput cost=9000 qty=2 bora'],['K','धान बीस मुरी फल्यो','kHarvest qty=20 muri'],['K','रामलाई दुई हजार दिएँ','kPay worker'],
 ['K','युरिया एक बोरा अठार सय','kInput cost=1800 qty=1 bora'],['K','मल पाँच थुन्से हालियो','kInput qty=5 thunse'],
 ['M','धान पाँच पाथी कुटानी','mill dhan_kutani 5 pathi'],['M','मकै तीन पाथी पिसानी','mill makai_pisani 3 pathi'],['M','गहुँ दुई पाथी पिसाइ','mill gahun_pisani 2 pathi'],
 ['C','रामलाई पाँच सय उधारो','given राम 500'],['C','सीताले तीन सय तिर्नुभयो','paid सीता 300'],['C','हरि उधारो दुई हजार','given हरि 2000']];
let bad=0;for(const [k,t,w] of tests){const got=(k==='P'?P:k==='K'?K:k==='M'?M:C)(t);const ok=w.split(' ').every(x=>got.split(' ').includes(x));if(!ok)bad++;console.log((ok?'ok  ':'FAIL')+' '+k+' '+t.padEnd(34)+' → '+got+(ok?'':'   (want '+w+')'));}
console.log(bad?bad+' fail of '+tests.length:'ALL OK');
