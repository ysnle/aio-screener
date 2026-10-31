import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildSloWindow } from '../../scripts/build-operations-slo-window.mjs';
const require = createRequire(import.meta.url);
const yaml = fs.readFileSync('.github/workflows/operations-alert.yml', 'utf8');
const script = yaml.split('          script: |')[1].split('\n').map(line => line.replace(/^ {12}/, '')).join('\n');
const execute = new (Object.getPrototypeOf(async function(){}).constructor)('context','github','core','require',script);
async function alertCase(workflow, observation) {
  const makeRun = (id) => ({ id, name: workflow, workflow_id: 10, head_branch: 'main', head_repository: {full_name:'audit/repo'}, event:'workflow_run', conclusion:'success', updated_at:`2026-10-28T12:0${id}:00Z`, html_url:`https://example.invalid/run/${id}`, head_sha:'a'.repeat(40) });
  const run = makeRun(2), previous = makeRun(1), writes = [];
  const jobs = async () => { if (observation === 'error') throw Object.assign(new Error('injected API failure'), {status:503}); return [{name:'deploy',steps:[{name:'Verify released Pages and all external planes',conclusion:observation}]}]; };
  const issues = {
    getLabel: async()=>({}), listForRepo: async()=>[{number:1,state:'open',body:`<!-- aio-operations-alert:${workflow} -->`}],
    createComment: async args=>writes.push({kind:'comment',...args}), update:async args=>writes.push({kind:'update',...args})
  };
  await execute({payload:{workflow_run:run},repo:{owner:'audit',repo:'repo'}}, {
    rest:{actions:{listWorkflowRuns:async()=>({data:{workflow_runs:[run,previous]}}),listJobsForWorkflowRun:jobs},issues},
    paginate:async(fn,args)=>fn(args)
  }, {info:()=>{}}, require);
  return {workflow,observation,closed:writes.some(w=>w.state==='closed'),writes};
}
const skippedPages = await alertCase('Deploy GitHub Pages','skipped');
const unavailablePages = await alertCase('Deploy GitHub Pages','error');
const skippedWorker = await alertCase('Deploy AI proxy','skipped');
assert.equal(skippedPages.closed,false);
assert.equal(unavailablePages.closed,true);
assert.equal(skippedWorker.closed,true);
const runs = [
  {id:1,event:'schedule',conclusion:'failure',created_at:'2026-10-27T00:00:00Z',head_sha:'a'.repeat(40)},
  {id:2,event:'workflow_dispatch',conclusion:'success',display_title:'operator run',created_at:'2026-10-27T01:00:00Z',head_sha:'a'.repeat(40)},
  {id:3,event:'schedule',conclusion:'failure',created_at:'2026-10-27T02:00:00Z',head_sha:'a'.repeat(40)}
];
const slo = buildSloWindow({observed:{watchdog:runs},now:new Date('2026-10-29T00:00:00Z')});
assert.equal(slo.domains.watchdog.manualRunsExcluded,1);
assert.equal(slo.domains.watchdog.successRate,0);
assert.equal(slo.failureRecovery.recoveryCount,1);
assert.equal(slo.failureRecovery.consecutiveFailuresMax,1);
const old = JSON.parse(fs.readFileSync(new URL('./FILE-REVIEW-LEDGER.json',import.meta.url),'utf8'));
const oldMap = new Map(old.files.map(row=>[row.path,row]));
const paths = [...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean))];
const changedObserved = old.files.filter(row=>row.observedSha256&&fs.existsSync(row.path)&&createHash('sha256').update(fs.readFileSync(row.path)).digest('hex')!==row.observedSha256).map(row=>({path:row.path,previousHash:row.observedSha256,currentHash:createHash('sha256').update(fs.readFileSync(row.path)).digest('hex')}));
fs.writeFileSync(new URL('./pass15-inventory-drift.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),previousTotal:old.report.files,total:paths.length,newPaths:paths.filter(p=>!oldMap.has(p)),changedObserved},null,2)+'\n');
fs.writeFileSync(new URL('./pass15-reproductions.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),network:false,skippedPages,unavailablePages,skippedWorker,slo},null,2)+'\n');
console.log(JSON.stringify({skippedPagesClosed:skippedPages.closed,unavailablePagesClosed:unavailablePages.closed,skippedWorkerClosed:skippedWorker.closed,recovery:slo.failureRecovery,changedObserved}));
