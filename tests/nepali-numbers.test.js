const fs=require('fs'),vm=require('vm');const A=process.argv[2];const store={};
const ctx={console,Intl,Math,Date,JSON,String,Number,Object,Array,RegExp,Set,parseFloat,parseInt,isFinite,isNaN,setTimeout,clearTimeout,Function,
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},document:{getElementById:()=>null,addEventListener:()=>{}}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(['nepcal.js','core.js','parser.js'].map(f=>fs.readFileSync(A+'/'+f,'utf8')).join('\n')+';loadDb();scheduleSync=()=>{};',ctx);
const T=[['पाँच सय पचास',550],['डेढ हजार',1500],['साढे दुई हजार',2500],['एक हजार दुई सय',1200],['दुई हजार पाँच सय',2500],['तीन सय',300],['पैँतालिस',45],
['एक लाख बीस हजार',120000],['बाह्र सय',1200],['पन्ध्र सय',1500],['अढाई सय',250],['सवा दुई',2.25],['पौने तीन',2.75],['आधा',0.5],['५००',500],['५ सय',500],
['2 हजार 500',2500],['छ सय',600],['सात सय पचास',750],['नौ सय',900],['चार हजार दुई सय पचास',4250],['एक सय',100],['सय',100],['हजार',1000],['डेढ सय',150],
['साढे तीन सय',350],['दश हजार',10000],['पच्चीस सय',2500],['तीन हजार',3000],['दुई सय पचहत्तर',275],['एघार सय',1100],['एक हजार पाँच सय',1500],['रु ५००',500],['५००/-',500],['१,५००',1500],['1.5',1.5],['१.५',1.5],
['चार सय पचास रुपैयाँ',450],['दुई दशमलव पाँच',2.5],['तीन किलो',3],['साढे दुई केजी',2.5]];
let bad=0;for(const [t,w] of T){const s=vm.runInContext('normalize('+JSON.stringify(t)+').s',ctx);const nums=(s.match(/\d+(?:\.\d+)?/g)||[]).map(Number);const ok=nums.length===1&&nums[0]===w;if(!ok)bad++;console.log((ok?'ok  ':'FAIL')+' '+t.padEnd(24)+' → '+s+'   (want '+w+')');}
console.log(bad?bad+' fail':'ALL OK');
