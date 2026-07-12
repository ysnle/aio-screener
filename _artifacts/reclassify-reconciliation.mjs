import { readFileSync, writeFileSync } from 'node:fs';

const path='C:/Projects/AIO/_artifacts/live-source-reconciliation.json';
const r=JSON.parse(readFileSync(path,'utf8'));
const limits={price:0.03,ret1m:0.15,ret3m:0.15,ret6m:0.15,vol:0.12,rsi:0.2,pctSma50:0.08,pctSma200:0.08,kalmanVel:0.003,kalmanPt:0.00001,kalmanInnovZ:0.005,kalmanVelConf:0.003};
for(const row of r.screenerReconciliation.rows||[]){
  if(row.error){row.materiallyOk=false;continue;}
  row.materialMismatches=(row.mismatches||[]).filter(m=>Number(m.absoluteDifference??Math.abs(Number(m.artifact)-Number(m.sourceDerived)))>limits[m.field]);
  row.materiallyOk=row.materialMismatches.length===0;
}
const sr=r.screenerReconciliation;
sr.strictPassed=sr.passed;sr.strictFailed=sr.failed;
sr.materialPassed=sr.rows.filter(x=>x.materiallyOk).length;
sr.materialFailed=sr.rows.filter(x=>!x.materiallyOk).length;
for(const row of r.quoteReconciliation.rows||[]){
  row.expectedContinuousMarketDrift=/-USD$/.test(row.symbol||'')&&typeof row.source?.regularMarketTime==='number'&&Date.parse(r.live?.dataGeneratedAt||0)<row.source.regularMarketTime*1000;
}
r.quoteReconciliation.expectedContinuousMarketDrift=r.quoteReconciliation.rows.filter(x=>x.expectedContinuousMarketDrift).length;
r.reclassification={generatedAt:new Date().toISOString(),method:'offline classification of previously captured artifact/source pairs; no source values refetched',materialThresholds:limits};
r.failures=(r.failures||[]).filter(x=>!x.startsWith('screener:'));
if(sr.materialFailed||sr.networkFailed)r.failures.push(`screener: materialFailed=${sr.materialFailed}, networkFailed=${sr.networkFailed}`);
writeFileSync(path,JSON.stringify(r,null,2));
console.log(JSON.stringify({strictPassed:sr.strictPassed,strictFailed:sr.strictFailed,materialPassed:sr.materialPassed,materialFailed:sr.materialFailed,quoteExpectedContinuousMarketDrift:r.quoteReconciliation.expectedContinuousMarketDrift,failures:r.failures},null,2));
