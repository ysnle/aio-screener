import {execFileSync} from 'node:child_process';
import {SourceTextModule} from 'node:vm';
import {posix} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const ref='659ffbad252f9eeacfa49a6ad1b895df87f66597';
const read=p=>execFileSync('git',['show',`${ref}:${p}`],{encoding:'utf8',maxBuffer:32*1024*1024});
const modules=new Map();
function moduleFor(p){if(!modules.has(p))modules.set(p,new SourceTextModule(read(p),{identifier:p}));return modules.get(p);}
async function load(p){const m=moduleFor(p);if(m.status==='unlinked')await m.link((s,from)=>{assert(s.startsWith('.'));return moduleFor(posix.normalize(posix.join(posix.dirname(from.identifier),s)));});if(m.status!=='evaluated')await m.evaluate();return m.namespace;}
const {createEntityProvider}=await load('src/data/providers/entity.js');
const acceptedAt='2026-07-29T20:30:00.000Z',different='2026-07-30T00:00:00.000Z';
const provider=createEntityProvider({read:()=>({id:'AAPL'}),httpClient:{requestJson:async()=>({ok:true,data:{data:{AAPL:{symbol:'AAPL',acceptedAt},MSFT:{symbol:'MSFT',acceptedAt,availableAt:different}}}})}});
const restored=await provider.readFundamentals(['AAPL','MSFT']);
assert.equal(restored.AAPL.availableAt,acceptedAt);assert.equal(restored.MSFT.availableAt,different);
const {normalizePromptLabels,reusableMarketAnalysis}=await load('scripts/lib/market-analysis-validate.mjs');
const leaked='코스피는 10/21 종가 +3.29%(METRIC_EVIDENCE: market.index.kospi:fbdb5f95), WTI는 -1.80%(REGIME_CONTEXT), 장중 -3.37%(MARKET_DRIVERS)였다.';
const cleaned=normalizePromptLabels(leaked);
assert.equal(cleaned,'코스피는 10/21 종가 +3.29%[market.index.kospi:fbdb5f95], WTI는 -1.80%[regime-context], 장중 -3.37%였다.');
const reused=reusableMarketAnalysis({status:'verified',semanticStatus:'verified',semanticIssues:[],generatedAt:'2026-10-21T13:00:00Z',full:leaked,metricEvidence:[{evidenceId:'a'}],newsEvidence:[],headlineContext:[]},{metricEvidence:[{evidenceId:'a'}],nowMs:Date.parse('2026-10-21T13:01:00Z')});
assert.equal(reused,null);
const projectionText=read('public-data/sec-fundamentals-summary.json');
const projection=JSON.parse(projectionText),records=Object.values(projection.data||{});
const data=JSON.parse(read('public-data/data.json'));
const result={ref,scope:'v58.60 delta only; pinned pure modules and static artifact reads; no producer/network/AI call',restoredAvailability:restored,normalizedLabels:cleaned,leakedPreviousReused:reused,projection:{bytes:Buffer.byteLength(projectionText),bound:1048576,rows:records.length,missingAvailableWithAccepted:records.filter(r=>r.availableAt==null&&r.acceptedAt).length},marketAnalysis:{status:data.marketAnalysis?.status,semanticStatus:data.marketAnalysis?.semanticStatus,generatedAt:data.marketAnalysis?.generatedAt,semanticIssues:data.marketAnalysis?.semanticIssues},loaded:[...modules.keys()]};
writeFileSync(new URL('./latest-delta-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
