import fs from 'node:fs';
import crypto from 'node:crypto';
import {openSessionDatesBetween,countOpenSessionsBetween} from '../../../../src/domain/market/market-calendar.js';
import {worstSessionMove} from '../../../../src/domain/portfolio/kr-stress.js';
import {indexReturns} from '../../../../src/domain/market/benchmarks.js';
const krDates=openSessionDatesBetween('2026-01-02','2027-12-30',{market:'KR',maxDays:800});
const sparse=[...krDates.slice(0,21),...Array.from({length:180},(_,i)=>krDates[22+i*2])].map((date,index)=>({date,value:100-index*0.1}));
const validWindows=sparse.flatMap((to,index)=>index>=20&&countOpenSessionsBetween(sparse[index-20].date,to.date,'KR')===20?[{from:sparse[index-20].date,to:to.date}]:[]);
const usDates=openSessionDatesBetween('2026-01-02','2026-10-16',{market:'US'}).slice(-140);
const history=usDates.map((date,index)=>({date,spx:100+index}));
const anchorIndex=history.length-1-63;
const missing=history.filter((_,index)=>index===anchorIndex||index===history.length-1||index%7!==1);
const full=indexReturns(history,'spx'),withMissing=indexReturns(missing,'spx');
const result={evidence:'Actual pure modules with synthetic complete/sparse calendar histories; not provider/live incidence',
  stress:{rows:sparse.length,valid20SessionWindows:validWindows.length,windows:validWindows,result:worstSessionMove(sparse,20,'KR')},
  benchmark:{full,withMissing,same63SessionReturn:full.ret3m===withMissing.ret3m},
  sources:Object.fromEntries(['src/domain/portfolio/kr-stress.js','src/domain/market/benchmarks.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261020/session-sample-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
