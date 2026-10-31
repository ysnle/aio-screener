import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const target='a'.repeat(40);
const setup=`process.argv=['node','fixture','--await-sha','${target}'];process.env.GH_TOKEN='fixture';process.env.GITHUB_REPOSITORY='owner/repo';globalThis.fetch=async url=>{if(!String(url).includes('/actions/workflows/ci.yml/runs?head_sha='))throw Error('unexpected fetch');return {ok:true,status:200,json:async()=>({workflow_runs:[{id:7,head_sha:'${target}',status:'completed',conclusion:'timed_out'}]})}};await import('./scripts/ensure-live-convergence.mjs');`;
const r=spawnSync(process.execPath,['--input-type=module','-e',setup],{encoding:'utf8',timeout:10000});
assert.equal(r.status,0);assert.match(r.stdout,/UNATTESTED_REVISION/);
const p='_artifacts/pipeline-review-20261024/reproductions.json';const result=JSON.parse(fs.readFileSync(p));result[1]={id:'OPS-02',actual:'real subprocess exits zero for timed_out CI',exitCode:r.status,stdout:r.stdout,stderr:r.stderr};fs.writeFileSync(p,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result[1],null,2));
