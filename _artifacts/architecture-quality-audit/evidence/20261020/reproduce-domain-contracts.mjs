// Actual pure modules, synthetic fixtures, no storage/network/producer/browser.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {runScreen} from '../../../../src/domain/screener/screen-engine.js';
import {createScreenDefinition} from '../../../../src/data/contracts/screener.js';
import {measureFactorOverlap} from '../../../../src/domain/screener/factor-overlap.js';
import {replayRegime} from '../../../../src/domain/screener/regime.js';
import {normalizeScreener} from '../../../../src/data/normalize/screener.js';
import {consensusView} from '../../../../src/domain/fundamental/consensus-read.js';
const define = filtersAST => createScreenDefinition({name:'Audit fixture',filtersAST,ranking:{field:'rank',direction:'asc'}});
const range = () => ({type:'range',field:'price.close',min:50});
const run = (definition,price) => runScreen({definition,rows:[{symbol:'AUDIT',price,rank:1}],snapshotId:'fixed-observation'});
const notDefinition=define({type:'not',child:range()});
const directDefinition=define(range());
const notLow=run(notDefinition,40),notHigh=run(notDefinition,60);
const directLow=run(directDefinition,40),directHigh=run(directDefinition,60);
const constantRows=Array.from({length:30},()=>({_z_momentum:0,_z_trend:0}));
const varyingRows=Array.from({length:30},(_,index)=>({_z_momentum:index,_z_trend:index}));
const start=Date.parse('2026-10-01T00:00:00Z');
const inputs={trendScore:1,breadthScore:100,volatilityScore:100,creditScore:1,rotationScore:1};
const history=Array.from({length:6},(_,day)=>({now:start+day*86400000,inputs}));
const daily=replayRegime({initial:{state:'NEUTRAL',observedAt:new Date(start).toISOString()},history});
const sparse=replayRegime({initial:{state:'NEUTRAL',observedAt:new Date(start).toISOString()},history:[history[0],history[3]]});
const row={symbol:'AUDIT',_valuationPrice:100,factorSessionDate:'2026-10-16'};
const estimate={asOf:'2026-10-16',fwd:{eps:5},trailing:{eps:-1}};
const normalized=normalizeScreener({rows:[row]}).rows[0];
const options={now:Date.parse('2026-10-17T00:00:00Z')};
const result={evidence:'Isolated execution of actual pure modules with synthetic fixtures; no browser/live certification',
  notIdentity:{before:notLow.rows[0].screenStatus,after:notHigh.rows[0].screenStatus,sameInputId:notLow.run.calculationInputId===notHigh.run.calculationInputId,resultChanged:notLow.resultHash!==notHigh.resultHash,
    positiveControlDirectPriceDetected:directLow.run.calculationInputId!==directHigh.run.calculationInputId},
  overlap:{constant:measureFactorOverlap(constantRows,['momentum','trend']),positiveControlIdenticalVarying:measureFactorOverlap(varyingRows,['momentum','trend'])},
  regime:{dailyStates:daily.states.map(row=>row.state),dailyHold:daily.states.map(row=>row.hysteresisState),sparseStates:sparse.states.map(row=>row.state)},
  valuation:{before:consensusView(row,estimate,options),after:consensusView(normalized,estimate,options),fieldPreserved:Object.hasOwn(normalized,'_valuationPrice')},
  sources:Object.fromEntries(['src/domain/screener/screen-engine.js','src/domain/screener/factor-overlap.js','src/domain/screener/regime.js','src/data/normalize/screener.js','src/domain/fundamental/consensus-read.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261020/domain-contract-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
