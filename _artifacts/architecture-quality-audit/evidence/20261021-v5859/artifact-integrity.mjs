import fs from 'node:fs';
import path from 'node:path';
import {SourceTextModule} from 'node:vm';
const directory=path.resolve('_artifacts/architecture-quality-audit/evidence/20261021-v5859');
const files=fs.readdirSync(directory).filter(n=>fs.statSync(path.join(directory,n)).isFile());
const normalized=[],syntax=[],missingLinks=[];
for(const name of files){
 const file=path.join(directory,name);
 if(!/\.(?:md|mjs|json|tsv|txt|log)$/.test(name))continue;
 let text=fs.readFileSync(file,'utf8');
 if(text.includes('\r\n')){text=text.replace(/\r\n/g,'\n');fs.writeFileSync(file,text);normalized.push(name);}
 if(name.endsWith('.mjs')){try{new SourceTextModule(text,{identifier:file});syntax.push({file:name,status:'PASS'});}catch(e){syntax.push({file:name,status:'FAIL',message:e.message});}}
 if(name.endsWith('.md'))for(const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)){
   const href=match[1];if(/^(?:https?:|codex:|#)/.test(href))continue;
   const target=path.resolve(path.dirname(file),href.split('#')[0]);
   if(!fs.existsSync(target))missingLinks.push({file:name,href});
 }
}
const coverage=JSON.parse(fs.readFileSync(path.join(directory,'coverage.json'),'utf8'));
const full=Object.entries(coverage.counts).filter(([key])=>key.includes('FULL')).reduce((sum,[,count])=>sum+count,0);
const result={observedAt:new Date().toISOString(),auditDirectory:directory,syntax:{files:syntax.length,failures:syntax.filter(r=>r.status==='FAIL')},localMarkdownLinks:{missing:missingLinks},normalizedLineEndings:normalized,coverage:{fixedRef:coverage.head,total:coverage.total,fullEvidence:full,canonicalMirrors:coverage.counts.REUSED_CANONICAL_MIRROR,unfinished:coverage.unfinished.length,receiptMismatch:coverage.receiptMismatch,targetSourceMismatch:coverage.sourceDrift},scope:'audit artifacts only; no product write or deployment certification'};
fs.writeFileSync(path.join(directory,'artifact-integrity-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(missingLinks.length||syntax.some(r=>r.status==='FAIL')||coverage.receiptMismatch.length||coverage.sourceDrift.length)process.exitCode=1;
