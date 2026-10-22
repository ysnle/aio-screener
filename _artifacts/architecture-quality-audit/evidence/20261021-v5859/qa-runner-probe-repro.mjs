import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {Readable,Writable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {StringDecoder} from 'node:string_decoder';
import path from 'node:path';
import {writeFileSync} from 'node:fs';
const ref='7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const raw=execFileSync('git',['show',`${ref}:scripts/qa-runner.mjs`]);
const source=raw.toString('utf8').replace(/^#![^\n]*\n/,'').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url','"file:///repo/scripts/qa-runner.mjs"');
const files=new Map();
const manifest={schemaVersion:'fixture.v1',cacheVersion:1,impactRules:[],profiles:{test:['fixture'],full:['fixture']},groups:{fixture:{phase:0,kind:'static',inputs:['scripts/fixture.mjs'],gates:[{id:'a',script:'scripts/fixture.mjs'}]}}};
files.set('/repo/manifest.json',JSON.stringify(manifest));files.set('/repo/scripts/fixture.mjs','fixture unchanged');
let childSpawns=0;
async function run(args,code){
 const logs=[]; let resultCode=0;
 const ctx={...path.posix,URL,createHash,Transform,pipeline,StringDecoder, freemem:()=>16*1024**3,
 existsSync:p=>files.has(p),mkdirSync:()=>{},readFileSync:(p,enc)=>{if(!files.has(p))throw Object.assign(new Error('ENOENT '+p),{code:'ENOENT'});return enc?String(files.get(p)):Buffer.from(files.get(p));},writeFileSync:(p,v)=>files.set(p,String(v)),renameSync:(a,b)=>{files.set(b,files.get(a));files.delete(a);},unlinkSync:p=>files.delete(p),rmSync:p=>{for(const k of files.keys())if(k===p||k.startsWith(p+'/'))files.delete(k);},
 createWriteStream:p=>new Writable({write(c,e,cb){files.set(p,(files.get(p)||'')+c.toString());cb();}}),createReadStream:p=>Readable.from([files.get(p)||'']),
 fileURLToPath:u=>new URL(u).pathname,spawnSync:(cmd,args)=>({status:0,stdout:args[0]==='ls-files'?'scripts/fixture.mjs\n':args[0]==='rev-parse'?'fixed\n':''}),
 spawn:()=>{childSpawns++;const ch=new EventEmitter();ch.stdout=new Readable({read(){}});ch.stderr=new Readable({read(){}});ch.pid=123;ch.kill=()=>{};setImmediate(()=>{ch.stdout.push(null);ch.stderr.push(null);ch.emit('close',code,null);});return ch;},
 console:{log:s=>logs.push(String(s)),error:s=>logs.push(String(s))},process:{argv:['node','qa-runner.mjs',...args],env:{CI:'false',AIO_QA_MANIFEST_PATH:'/repo/manifest.json',AIO_QA_CACHE_DIR:'/cache'},pid:Math.floor(Math.random()*100000),platform:'win32',versions:{node:'22.0.0'},execPath:'node',exit:n=>{throw Object.assign(new Error('EXIT '+n),{exitCode:n});}},
 validateBrowserEvidence:()=>[],evidenceDigest:()=>'',failureCauseLines:()=>[],setTimeout,clearTimeout,Atomics,SharedArrayBuffer,Int32Array,Buffer};
 try{await vm.runInNewContext('(async()=>{'+source+'\n})()',ctx,{filename:'scripts/qa-runner.mjs'});}catch(e){if(e.exitCode!==undefined)resultCode=e.exitCode;else throw e;}
 return {exitCode:resultCode,logs,report:JSON.parse(files.get('/cache/last-run.json')||'null'),failedBatch:JSON.parse(files.get('/cache/failed-batch.json')||'null'),cache:JSON.parse(files.get('/cache/success-cache.json')||'null'),childSpawns};
}
const pass=await run(['test'],0);
const fail=await run(['test','--no-cache'],1);
const retry=await run(['rerun-failed'],0);
// A separately failed run, followed by removal of that gate from an otherwise valid manifest.
const failedAgain=await run(['test','--no-cache'],1);
manifest.groups.fixture.gates=[{id:'replacement',script:'scripts/fixture.mjs'}];files.set('/repo/manifest.json',JSON.stringify(manifest));
const removedRetry=await run(['rerun-failed'],0);
const out={ref,sha256:createHash('sha256').update(raw).digest('hex'),boundary:'Pinned full runner evaluated in VM. Virtual FS and virtual child completion only; no real gates, subprocess commands beyond git show, producers or external services.',cacheRetry:{pass,fail,retry},removedGateRetry:{failedAgain,removedRetry}};
writeFileSync('_artifacts/architecture-quality-audit/evidence/20261021-v5859/qa-runner-probe-results.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({cacheRetry:[pass.report.counts,fail.report.counts,retry.report.counts],retryExit:retry.exitCode,retrySpawns:retry.childSpawns-fail.childSpawns,retryFailedBatch:retry.failedBatch,removedGate:{exit:removedRetry.exitCode,counts:removedRetry.report.counts,gates:removedRetry.report.results.length,preserved:removedRetry.failedBatch}},null,2));
