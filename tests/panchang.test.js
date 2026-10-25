const fs=require('fs'),vm=require('vm');const A=process.argv[2];
const ctx={console,Math,Date,JSON,String,Number,Object,Array,RegExp,parseFloat,parseInt,isFinite,isNaN};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(A+'/nepcal.js','utf8')+`
const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const NE_DIGITS='०१२३४५६७८९';const neNum=n=>String(n).replace(/\\d/g,d=>NE_DIGITS[d]);
`+fs.readFileSync(A+'/panchang.js','utf8'),ctx);
const R=s=>vm.runInContext(s,ctx);
// find festival dates in a range
const find=(from,days)=>{const out={};for(let i=0;i<days;i++){const d=R(`addDays('${from}',${i})`);const p=R(`panchang('${d}')`);p.fests.forEach(f=>{(out[f.en]=out[f.en]||[]).push(d)});}return out;};
const f25=find('2025-07-15',140), f26=find('2026-01-15',330);
const want={ 'Kag Tihar':['2025-10-19','2026-11-06'],'Kukur Tihar':['2025-10-20',null],'Govardhan / Mha Puja':['2025-10-22',null],'Maha Ashtami':['2025-09-30',null],'Janai Purnima':['2025-08-09','2026-08-28'],'Krishna Janmashtami':['2025-08-16','2026-09-04'],'Teej':['2025-08-26','2026-09-14'],
 'Ghatasthapana':['2025-09-22','2026-10-11'],'Vijaya Dashami':['2025-10-02','2026-10-20'],'Laxmi Puja':['2025-10-21','2026-11-08'],
 'Bhai Tika':['2025-10-23','2026-11-11'],'Chhath':['2025-10-27','2026-11-15'],'Maha Shivaratri':[null,'2026-02-15'],'Buddha Jayanti':[null,'2026-05-01'],'Ram Navami':[null,'2026-03-27']};
let bad=0;for(const k in want){const got=[(f25[k]||[]).join('/'),(f26[k]||[]).join('/')];const ok=(want[k][0]==null||got[0]===want[k][0])&&(want[k][1]==null||got[1]===want[k][1]);if(!ok)bad++;console.log((ok?'ok  ':'DIFF')+' '+k.padEnd(20)+' got '+got.join(' | ')+'  want '+want[k].join(' | '));}
console.log('today', JSON.stringify(R(`(()=>{const p=panchang('2026-10-23');return {name:p.name,rise:fmtNpt(p.rise),set:fmtNpt(p.set),f:p.fests}})()`)));
console.log('purnima 2026-10-26', R(`panchang('2026-10-26').name`), R(`panchang('2026-10-25').name`));
console.log('Eid', JSON.stringify(Object.entries(Object.assign({},f26)).filter(([k])=>/Eid/.test(k))));
console.log(bad?bad+' differ':'ALL MATCH');
