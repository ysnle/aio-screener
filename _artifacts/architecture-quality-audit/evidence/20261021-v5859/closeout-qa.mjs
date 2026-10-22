import {readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {SourceTextModule} from 'node:vm';
import {readFileSync} from 'node:fs';
const dir='_artifacts/architecture-quality-audit/evidence/20261021-v5859';
const files=readdirSync(dir).filter(n=>!['closeout-qa-result.json','closeout-qa.log'].includes(n)).map(n=>`${dir}/${n}`).sort();
const syntax=[];
for(const path of files.filter(p=>p.endsWith('.mjs'))){try{new SourceTextModule(readFileSync(path,'utf8'),{identifier:path});syntax.push({path,status:'PASS'});}catch(e){syntax.push({path,status:'FAIL',message:e.message});}}
const args=['scripts/qa-runner.mjs','affected','--session','architecture-quality-20261021-v5859','--files',files.join(','),'--no-cache'];
const startedAt=new Date().toISOString();let status=0,output='';
try{output=execFileSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});}catch(e){status=e.status??1;output=String(e.stdout||'')+'\n'+String(e.stderr||e.message);}
writeFileSync(`${dir}/closeout-qa.log`,output);
const result={startedAt,finishedAt:new Date().toISOString(),command:{exe:'node',args},ownedFiles:files.length,artifactSyntax:syntax,exitCode:status,scope:'explicit audit artifacts only; selected preflight is not full product or deployed certification'};
writeFileSync(`${dir}/closeout-qa-result.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,command:undefined,artifactSyntax:{files:syntax.length,failures:syntax.filter(r=>r.status==='FAIL')}},null,2));console.log(output.slice(-5000));if(status||syntax.some(r=>r.status==='FAIL'))process.exitCode=1;
