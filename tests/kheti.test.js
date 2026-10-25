const fs=require('fs'),vm=require('vm');const A=process.argv[2];const store={};
const ctx={console,Intl,Math,Date,JSON,String,Number,Object,Array,RegExp,Set,parseFloat,parseInt,isFinite,isNaN,setTimeout,clearTimeout,
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},document:{getElementById:()=>null}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(['nepcal.js','core.js','parser.js','landunits.js','kheti.js','kheti-voice.js'].map(f=>fs.readFileSync(A+'/'+f,'utf8')).join('\n')+`
loadDb(); scheduleSync=()=>{};
var F1=put({kind:'field',name:'Purbe khet',areaM2:toM2('pahad',[3,4,0,0])});
var F2=put({kind:'field',name:'Tallo bari',areaM2:toM2('tarai',[0,5,0])});
var K1=put({kind:'kheti',fieldId:F1.id,crops:[{crop:'dhaan',role:'main'},{crop:'maas',role:'aali'}],plantDate:'2026-07-05',season:seasonOf('2026-07-05'),status:'growing'});
var K2=put({kind:'kheti',fieldId:F2.id,crops:[{crop:'makai',role:'main'}],plantDate:'2026-04-20',season:seasonOf('2026-04-20'),status:'growing'});
var W1=put({kind:'worker',name:'Ram',family:'Thapa ghar',phone:'9800000001'});
var W2=put({kind:'worker',name:'Sita',family:'Thapa ghar'});
var W3=put({kind:'worker',name:'Hari',family:'Rai ghar'});
setWageRate('ropai',700,400);
var r1={kind:'fwork',khetiId:K1.id,fieldId:F1.id,date:'2026-07-05',workType:'ropai',workers:[{workerId:W1.id,shift:'full',rate:700},{workerId:W2.id,shift:'half',rate:400}],extraFull:4,extraHalf:1,rateFull:700,rateHalf:400,parma:[{family:'Rai ghar',full:3,half:0}]};
r1.amount=fworkAmount(r1); put(r1);
put({kind:'machine',khetiId:K1.id,date:'2026-07-01',type:'hiredTractor',hours:3,ratePerHour:1500,hireAmount:4500,fuel:'',litres:0,fuelCost:0});
put({kind:'machine',khetiId:K1.id,date:'2026-07-20',type:'pump',hours:4,hireAmount:0,fuel:'diesel',litres:5,fuelCost:750});
put({kind:'finput',khetiId:K1.id,date:'2026-07-02',type:'seed',item:'Radha-4',qty:10,unit:'kg',cost:1200});
put({kind:'finput',khetiId:K1.id,date:'2026-07-10',type:'fert',item:'DAP',qty:2,unit:'bora',cost:9000});
put({kind:'harvest',khetiId:K1.id,crop:'dhaan',date:'2026-10-20',qty:20,unit:'muri'});
put({kind:'harvest',khetiId:K1.id,crop:'maas',date:'2026-10-20',qty:8,unit:'pathi'});
put({kind:'fpay',workerId:W1.id,date:'2026-07-10',amount:500});
put({kind:'parmaout',date:'2026-07-08',family:'Rai ghar',full:1,half:1});
`,ctx);
const R=s=>vm.runInContext(s,ctx); let fail=0;
const eq=(name,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);if(!ok)fail++;console.log((ok?'ok  ':'FAIL')+' '+name+(ok?'':' got '+JSON.stringify(got)+' want '+JSON.stringify(want)));};
eq('area 3-4-0-0 ropani',R("fmtArea(F1.areaM2,'pahad','short')"),'3-4-0-0');
eq('1 bigha in ropani',R("round(toM2('tarai',[1,0,0])/508.72,3)"),13.313);
eq('season Asar 2083',R("seasonOf('2026-07-05')"),'Barkhe 2083');
eq('season Baisakh',R("seasonOf('2026-04-20')"),'Chaite 2083');
eq('season Kartik',R("seasonOf('2026-10-25')"),'Hiude 2083');
eq('wage day',R("r1.amount"),700+400+4*700+400);
const S=R("computeKheti()");
const k=S.K[R('K1.id')];
eq('labour',k.labour,4300); eq('full/half',[k.labourFull,k.labourHalf],[5,2]); eq('parma days',k.parmaDays,3);
eq('machine',[k.machineHire,k.machineHours,k.fuelCost,k.diesel],[4500,7,750,5]); eq('seed/fert',[k.seed,k.fert],[1200,9000]);
eq('total',k.total,4300+4500+750+1200+9000);
eq('dhaan kg (20 muri × 20 × 3.6)',round(k.harvestKg.dhaan),1440); eq('maas kg (8 pathi × 4.4)',round(k.harvestKg.maas*10)/10,35.2);
eq('cost/kg',Math.round(k.costPerKg*100)/100,Math.round(19750/1440*100)/100);
eq('Ram earned/paid/due',[S.W[R('W1.id')].earned,S.W[R('W1.id')].paid,S.W[R('W1.id')].due],[700,500,200]);
eq('Sita half day',[S.W[R('W2.id')].halfDays,S.W[R('W2.id')].due],[1,400]);
eq('parma Rai: came 3 went 1.5',[S.P['Rai ghar'].came,S.P['Rai ghar'].went,S.P['Rai ghar'].balance],[3,1.5,1.5]);
eq('field lifetime',S.F[R('F1.id')].lifetime,19750);
function round(n){return Math.round(n);}
const P=t=>{const p=R('parseKheti('+JSON.stringify(t)+')');if(!p)return null;delete p.text;delete p.date;
  if(p.khetiId)p.kheti=R('khetiTitle(khetiById('+JSON.stringify(p.khetiId)+'))');delete p.khetiId;delete p.field;
  if(p.workers)p.workers=p.workers.map(w=>R('workerById('+JSON.stringify(w.workerId)+').name')+':'+w.shift).sort();
  if(p.workerId)p.worker=R('workerById('+JSON.stringify(p.workerId)+').name'),delete p.workerId;
  for(const x in p) if(p[x]===''||p[x]===0||p[x]==null||(Array.isArray(p[x])&&!p[x].length)) delete p[x];return p;};
const T=[
 ['Purbe khet ropai 6 khetala 3 parma Thapa ghar',{intent:'kWork',workType:'ropai',extraFull:6,parma:[{family:'Thapa ghar',full:3,half:0}]}],
 ['Ram pura Sita aadha 4 khetala katne',{intent:'kWork',workType:'katne',extraFull:4,workers:['Ram:full','Sita:half']}],
 ['Ram Hari pura Sita aadha godmel purbe khet',{intent:'kWork',workType:'godmel',workers:['Hari:full','Ram:full','Sita:half']}],
 ['पूर्बे खेत रोपाइँ ६ खेताला',{intent:'kWork',workType:'ropai',extraFull:6}],
 ['Purbe khet ma aaja 2 jana aadha khetala godmel',{intent:'kWork',workType:'godmel',extraHalf:2}],
 ['tallo bari tractor 3 ghanta 1500',{intent:'kMachine',type:'hiredTractor',hours:3,hireAmount:1500}],
 ['purbe khet aafno tractor diesel 5 litre 750',{intent:'kMachine',type:'ownTractor',fuel:'diesel',litres:5,fuelCost:750}],
 ['pump 2 ghanta diesel 3 litre 450 dhaan',{intent:'kMachine',type:'pump',hours:2,fuel:'diesel',litres:3,fuelCost:450}],
 ['DAP 2 bora 9000 makai',{intent:'kInput',type:'fert',item:'Gede mal (DAP)',qty:2,unit:'bora',cost:9000}],
 ['kukhura mal 5 bora 1500',{intent:'kInput',type:'fert',item:'Kukhura mal',qty:5,unit:'bora',cost:1500}],
 ['bhaisi ko mal 10 thunse',{intent:'kInput',type:'fert',item:'Bhaisi mal',qty:10,unit:'thunse'}],
 ['भैंसीको मल २० थुन्से',{intent:'kInput',type:'fert',item:'Bhaisi mal',qty:20,unit:'thunse'}],
 ['bakhra mal 3 thunse',{intent:'kInput',type:'fert',item:'Bakhra mal',qty:3,unit:'thunse'}],
 ['gai ko mal 8 thunse',{intent:'kInput',type:'fert',item:'Gai mal',qty:8,unit:'thunse'}],
 ['gede mal 1 bora 4500',{intent:'kInput',type:'fert',item:'Gede mal (DAP)',qty:1,unit:'bora',cost:4500}],
 ['potash 1 bora 2500',{intent:'kInput',type:'fert',item:'Potash',qty:1,unit:'bora',cost:2500}],
 ['dhaan biu 3 pathi 600',{intent:'kInput',type:'seed',qty:3,unit:'pathi',cost:600}],
 ['makai biu 4 mana 200',{intent:'kInput',type:'seed',qty:4,unit:'mana',cost:200}],
 ['मकै बीउ ४ माना',{intent:'kInput',type:'seed',qty:4,unit:'mana'}],
 ['urea ek bora athara saya',{intent:'kInput',type:'fert',item:'Urea',qty:1,unit:'bora',cost:1800}],
 ['dhaan biu 10 kg 1200',{intent:'kInput',type:'seed',item:'Rice / Paddy seed',qty:10,unit:'kg',cost:1200}],
 ['dhaan 20 muri',{intent:'kHarvest',crop:'dhaan',qty:20,unit:'muri'}],
 ['धान २० मुरी',{intent:'kHarvest',crop:'dhaan',qty:20,unit:'muri'}],
 ['makai 5 quintal harvest',{intent:'kHarvest',crop:'makai',qty:5,unit:'quintal'}],
 ['Ram lai 2000 tirey',{intent:'kPay',worker:'Ram',amount:2000}],
 ['paid Sita 400',{intent:'kPay',worker:'Sita',amount:400}],
 ['Ram settle',{intent:'kPay',worker:'Ram',settle:true}],
 ['Rai ghar parma tirne 2 din',{intent:'kParmaOut',family:'Rai ghar',full:2}],
 ['Ram ko hisab',{intent:'kAccount',worker:'Ram'}],
 ['parma kati baki',{intent:'kParmaQuery'}],
 ['sold 2 kg meat',null],
];
for(const [t,want] of T){const got=P(t);
  if(want&&got){for(const x in want) eq(t+' · '+x,got[x],want[x]);} else eq(t,got,want);}
// household member: Sita becomes own family
R("put(Object.assign({}, W2, { own: true }))");
let S2=R("computeKheti()"), k2=S2.K[R('K1.id')];
eq('household: paid labour', k2.labour, 3900); eq('household: family value', k2.family, 400); eq('household: excluded by default', [k2.includeFamily, k2.total, k2.cash], [false, 19350, 19350]);
eq('household: never due', [S2.W[R('W2.id')].due, S2.W[R('W2.id')].earned], [0, 400]);
R("put(Object.assign({}, khetiById(K1.id), { includeFamily: true }))");
S2=R("computeKheti()"); k2=S2.K[R('K1.id')];
eq('toggle on: total includes family', [k2.total, k2.cash], [19750, 19350]);
eq('field lifetime follows toggle', S2.F[R('F1.id')].lifetime, 19750);
// own machine: pump 4 hr at Rs 300/hr = 1200 value, counted only with the 🚜 switch
R("setOwnMachineRate('pump', 300); const mp = all('machine').find(r => r.type === 'pump'); put(Object.assign({}, mp, { ratePerHour: 300, ownValue: 1200 }))");
S2=R("computeKheti()"); k2=S2.K[R('K1.id')];
eq('own machine value', [k2.ownMachine, k2.ownMachineHours, k2.includeOwnMachine], [1200, 4, false]);
eq('own machine not counted by default', k2.total, 19750);
R("put(Object.assign({}, khetiById(K1.id), { includeOwnMachine: true }))");
S2=R("computeKheti()"); k2=S2.K[R('K1.id')];
eq('own machine switch on', [k2.total, k2.cash], [20950, 19350]);
eq('remembered rate', R("ownMachineRate('pump')"), 300);
R("setOwnMachineRate('ownTractor', 1500)");
const pv=R("parseKheti('purbe khet aafno tractor 3 ghanta diesel 4 litre 600')");
eq('voice own tractor', [pv.type, pv.hours, pv.ratePerHour, pv.fuelCost, pv.litres], ['ownTractor', 3, 1500, 600, 4]);
// my time on the own pump: 4 hr × Rs 200 = 800, behind the same 🚜 switch (currently on)
R("const mp2 = all('machine').find(r => r.type === 'pump'); put(Object.assign({}, mp2, { myHours: 4, myRate: 200, myValue: 800 })); setSet('myTimeRate', 200)");
S2=R("computeKheti()"); k2=S2.K[R('K1.id')];
eq('my time value', [k2.myTime, k2.myTimeHours, k2.ownAll], [800, 4, 2000]);
eq('my time counted with switch on', [k2.total, k2.cash], [21750, 19350]);
R("put(Object.assign({}, khetiById(K1.id), { includeOwnMachine: false }))");
S2=R("computeKheti()"); k2=S2.K[R('K1.id')];
eq('switch off removes machine + my time', k2.total, 19750);
const pv2=R("parseKheti('aafno tractor 2 ghanta diesel 3 litre 450')");
eq('voice own tractor my time rate', [pv2.myRate, pv2.hours], [200, 2]);
eq('khetiLikely poultry',R("khetiLikely('2 dead in lot 1')"),false);
eq('khetiLikely kheti',R("khetiLikely('dhaan 20 muri')"),true);
if(process.env.DUMP)fs.writeFileSync(process.env.DUMP,R("JSON.stringify(Object.values(db.records))"));
console.log(fail?fail+' FAILED':'ALL PASS');
