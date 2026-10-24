import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {buildPublishableAnswerPlan,extractAnswerFallback} from '../../src/ai/response/publication.js';
import {liveCurrentObservations} from '../../src/ui/knowledge/current-observations.js';
import {createAIOArchitecture} from '../../src/app/bootstrap.js';
const result=[];
const evidence=[{evidenceId:'unrelated',status:'verified',source:'Yahoo',asOf:'2026-10-23T20:00:00Z',metric:'price',entity:'AAPL',value:250,unit:'USD'}];
const summary='연준이 금리를 인하했고 신용 스트레스도 해소됐다.';
const plan=buildPublishableAnswerPlan({summary,sections:[],claims:{claims:[]},citations:[]},evidence,true,{nowMs:Date.parse('2026-10-24T00:00:00Z')});assert.equal(plan.plan.summary,summary);assert.equal(plan.droppedClaims.length,0);result.push({id:'AI-01',...plan});
const fallback=extractAnswerFallback('코스피는 2,450이다.',true,{evidenceCount:0});assert.equal(fallback,'코스피는 2,450이다.');result.push({id:'AI-02',fallback});
const artifact=JSON.parse(fs.readFileSync('public-data/knowledge/current-observations.json'));
const observation=liveCurrentObservations(artifact,{DATA_SNAPSHOT:{cpi:3.1,_cpi_src:'last-known-good',_fieldTs:{macro_cpi:'2025-01-01'}},_serverMacroEvidence:{cpi:{observedAt:'2025-01-01',source:'last-known-good',allowedUse:'reference-only'}}}).observations.find(x=>x.id.startsWith('bls-cpi-'));assert.equal(observation.live,true);assert.equal(observation.allowedUse,'current-context');result.push({id:'KNOW-01',observation});
const root=new EventTarget(),urls=[],timers=new Map();let id=0;
Object.assign(root,{location:{hash:'#home'},visibilityState:'visible',getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)});root.document=root;
const runtime=createAIOArchitecture({root,documentRef:root,fetchImpl:async url=>{urls.push(String(url));return {ok:false,status:503,json:async()=>({})};}});const stop=runtime.start();
try{await stop.ready;const before=urls.filter(u=>u.includes('market-snapshot')).length;root._serverDataMeta={marketSnapshotRevision:'recovered'};root.dispatchEvent(new Event('aio:serverDataLoaded'));await new Promise(r=>setTimeout(r,30));const after=urls.filter(u=>u.includes('market-snapshot')).length;assert.equal(before,1);assert.equal(after,1);assert.equal(runtime.getState().marketSnapshot,null);result.push({id:'RUNTIME-01',snapshotFetchBefore:before,snapshotFetchAfter:after,snapshot:runtime.getState().marketSnapshot});}finally{stop();}
for(const file of ['scripts/lib/knowledge-authoring-contract.mjs','scripts/lib/principles-stories.mjs','scripts/lib/principles-worked.mjs']){const r=spawnSync(process.execPath,['scripts/qa-runner.mjs','affected','--files',file,'--explain'],{encoding:'utf8',timeout:10000,env:{...process.env,AIO_QA_CACHE_DIR:'.cache/pipeline-review-20261024/selection'}});assert.equal(r.status,0);const p=JSON.parse(r.stdout);assert.equal(p.gates.some(g=>g.id==='knowledge-generated-parity'),false);result.push({id:'QA-01',file,groups:p.groups,gateIds:p.gates.map(g=>g.id)});}
fs.writeFileSync('_artifacts/pipeline-review-20261024/runtime-knowledge-reproductions.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.map(x=>({id:x.id,...(x.id==='QA-01'?{file:x.file,groups:x.groups}:x.id==='RUNTIME-01'?x:x.id==='KNOW-01'?{value:x.observation.value,allowedUse:x.observation.allowedUse,live:x.observation.live}:x.id==='AI-01'?{summary:x.plan.summary,droppedClaims:x.droppedClaims}:{fallback:x.fallback})})),null,2));
