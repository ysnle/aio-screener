// Actual render functions with a minimal DOM seam; no browser/network/storage.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildFundamentalsVisual,buildRelativeVisual} from '../../../../src/ui/components/ai-answer-visuals.js';
const documentRef={createElement:tag=>({tag,children:[],style:{},append(...nodes){this.children.push(...nodes);},textContent:'',innerHTML:''})};
const quarters=['2025-09-30','2025-12-31','2026-03-31','2026-06-30'];
async function fundamentals(income){
  const figure=await buildFundamentalsVisual({documentRef,symbol:'AUDIT',root:{_aioSecFiscalHistory:{},_aioSecQuarterHistory:{AUDIT:quarters.map(date=>`${date}:100:${income}`).join(';')}}});
  return {zeroPercentLabels:(figure.children[1].innerHTML.match(/>0%<\/text>/g)||[]).length,caption:figure.children[2].textContent};
}
const dates=offset=>Array.from({length:20},(_,index)=>`2026-07-${String(index+1+offset).padStart(2,'0')}`);
const payload=dates=>({meta:{exchangeTimezoneName:'America/New_York'},timestamps:dates.map(date=>Date.parse(`${date}T20:00:00Z`)/1000),opens:dates.map((_,i)=>100+i),highs:dates.map((_,i)=>102+i),lows:dates.map((_,i)=>99+i),closes:dates.map((_,i)=>101+i)});
const shifted={AAA:payload(dates(0)),BBB:payload(dates(1))};
const relative=await buildRelativeVisual({documentRef,symbols:['AAA','BBB'],root:{_aioFetchYahooChartData:symbol=>shifted[symbol]}});
const result={evidence:'Actual renderer functions with synthetic inputs and a minimal DOM seam; real DOM/browser/live not certified',
  missingIncome:await fundamentals(''),positiveControlActualZero:await fundamentals('0'),
  relative:{firstSeriesDates:[dates(0)[0],dates(0).at(-1)],secondSeriesDates:[dates(1)[0],dates(1).at(-1)],caption:relative.children[2].textContent,secondSeriesEndDisclosed:relative.children[1].innerHTML.includes(dates(1).at(-1))},
  sourceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/ui/components/ai-answer-visuals.js')).digest('hex')};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261018/answer-visual-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
