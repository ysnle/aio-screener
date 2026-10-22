import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const directory='_artifacts/architecture-quality-audit/evidence/20261021-v5859';
const scratch=resolve('.cache/architecture-audit-temp');
mkdirSync(scratch,{recursive:true});
const args=['scripts/qa-runner.mjs','rerun-failed','--report','.cache/aio-qa/runs/2026-10-21T13-37-02-542Z-22468-cnva4x.json','--session','architecture-quality-20261021-v5859','--files',`${directory}/HANDOFF.md`,'--no-cache'];
const startedAt=new Date().toISOString();let code=0,output='';
try{output=execFileSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,TMP:scratch,TEMP:scratch}});}catch(e){code=e.status??1;output=String(e.stdout||'')+'\n'+String(e.stderr||e.message);}
writeFileSync(`${directory}/retry-qa.log`,output);
writeFileSync(`${directory}/retry-qa-result.json`,JSON.stringify({startedAt,finishedAt:new Date().toISOString(),exe:'node',args,temporaryDirectory:scratch,exitCode:code,scope:'rerun only the one failed gate with workspace-scoped temporary storage; original failure retained'},null,2)+'\n');
console.log(output.slice(-6000));process.exitCode=code;
