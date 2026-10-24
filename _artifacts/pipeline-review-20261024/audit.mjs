import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {load} from 'js-yaml';
const root=process.cwd();
const dir='_artifacts/pipeline-review-20261024';
const files=spawnSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).stdout.trim().split(/\r?\n/).filter(f=>!f.startsWith(dir+'/'));
const hashes=Object.fromEntries(files.filter(f=>fs.existsSync(f)&&fs.statSync(f).isFile()).map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const workflows=fs.readdirSync('.github/workflows').filter(f=>/\.ya?ml$/.test(f)).map(f=>{const w=load(fs.readFileSync('.github/workflows/'+f,'utf8'));return {file:'.github/workflows/'+f,name:w.name,on:w.on,concurrency:w.concurrency,permissions:w.permissions,jobs:Object.entries(w.jobs).map(([id,j])=>({id,needs:j.needs,if:j.if,permissions:j.permissions,steps:(j.steps||[]).map(s=>({name:s.name,uses:s.uses,run:s.run,if:s.if,continueOnError:s['continue-on-error']}))}))};});
const qa=JSON.parse(fs.readFileSync('architecture/qa-pipeline.json'));
fs.writeFileSync(dir+'/inventory.json',JSON.stringify({capturedAt:new Date().toISOString(),root,head:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),version:JSON.parse(fs.readFileSync('version.json')),files:hashes,workflows,qaGroups:Object.fromEntries(Object.entries(qa.groups).map(([k,v])=>[k,v.gates.map(g=>({id:g.id,command:g.command}))])),qaProfiles:qa.profiles},null,2)+'\n');
const commands=['scripts/ci-qa-pipeline-contract-check.mjs','scripts/ci-release-manifest-contract.mjs','scripts/ci-operations-contract-check.mjs','scripts/ci-operations-alert-policy-check.mjs','scripts/ci-operations-alert-source-check.mjs','scripts/ci-cloudflare-deployment-contract-check.mjs','scripts/ci-deployment-convergence-check.mjs'];
const results=[];
for(const f of commands){const t=Date.now();const r=spawnSync(process.execPath,[f],{encoding:'utf8',timeout:120000});const entry={command:'node '+f,exitCode:r.status,error:r.error?.message,elapsedMs:Date.now()-t,stdout:r.stdout,stderr:r.stderr};results.push(entry);console.log(JSON.stringify({command:entry.command,exitCode:r.status,tail:(r.stdout+r.stderr).slice(-900)}));}
fs.writeFileSync(dir+'/checks.json',JSON.stringify(results,null,2)+'\n');
console.log('workflow inventory:',workflows.length,'files:',Object.keys(hashes).length);
