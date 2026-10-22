import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildMarketRead,buildMarketRegime} from '../../../../src/domain/briefing/market-read.js';
import {openSessionDatesBetween} from '../../../../src/domain/market/market-calendar.js';
const input={history:[{date:'2026-10-14',spx:100},{date:'2026-10-15',spx:101}],
  rates:{asOf:'2026-10-15',realYield10:1.5,realYield10Delta5:-0.20,breakeven10Delta5:-0.01,realAsOf:'2026-10-15',breakevenAsOf:'2026-10-15'},now:Date.parse('2026-10-16T22:00:00Z')};
const statement=value=>buildMarketRead(value).statements.find(row=>row.id==='real-yield-led');
const dates=openSessionDatesBetween('2026-07-01','2026-10-15',{market:'US'}).slice(-60);
const history=dates.map((date,index)=>({date,spx:100+index,tnx:4+index*0.05}));
function regime(rows){
  try {const model=buildMarketRegime({history:rows,now:Date.parse('2026-10-16T22:00:00Z')});return {threw:false,rates:model.axes?.find(row=>row.id==='rates')};}
  catch(error){return {threw:true,error:error.message};}
}
const result={evidence:'Actual buildMarketRead with synthetic dated inputs; no provider/browser/live occurrence certified',
  decliningRealYield:statement(input),risingPositiveControl:statement({...input,rates:{...input.rates,realYield10Delta5:0.20,breakeven10Delta5:0.01}}),
  staleRateHistory:regime(history.map((row,index)=>index>=history.length-6?{date:row.date,spx:row.spx}:row)),
  currentRatePositiveControl:regime(history),
  sourceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/domain/briefing/market-read.js')).digest('hex')};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261021/market-reading-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
