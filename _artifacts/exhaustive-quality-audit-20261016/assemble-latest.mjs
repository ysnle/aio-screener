// Audit-only receipt assembly. It does not fetch data or write product artifacts.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='_artifacts/exhaustive-quality-audit-20261016';
const read=p=>fs.readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(name,value)=>fs.writeFileSync(`${dir}/${name}`,JSON.stringify(value,null,2)+'\n');
const table=name=>read(`${dir}/${name}`).trim().split(/\r?\n/).slice(1).map(r=>r.split('\t'));
const errors=[];
const requireTrue=(condition,reason)=>{if(!condition)errors.push(reason);};
const version=json('version.json').version;
requireTrue(version==='v57.98','Reviewed version changed');
// Freeze every independently read mutable text before carrying its judgments forward.
const readHashes={
  'js/aio-glossary.js':'69a6b24dd3c2e14190f7e68244d7eba3c6ef4686c93c5ad6ea9608c2692e7b9e',
  'public-data/knowledge/research-facts.json':'1f0ab209af8bdb24c3556f4c3227c1c65e8da2bf65e089ed76ec2b2ee85c513b',
  'public-data/principles/lesson-library.json':'15ad0bc9dcbad8f498263eae0af92ca310301bbfd5f2fb3926171d7f6132fc23'
};
for(const [p,expected] of Object.entries(readHashes))if(sha(p)!==expected)throw new Error(`Read source changed: ${p}; re-read before publishing judgments`);
if(errors.length)throw new Error(errors.join('; '));
const glossaryContext=Object.create(null);
vm.runInNewContext(read('js/aio-glossary.js'),glossaryContext,{timeout:3000});
const terms=glossaryContext.GLOSSARY;
const exceptions=new Map(table('glossary-exceptions.tsv').map(([term,verdict,reason])=>[term,{verdict,reason}]));
const termSet=new Set(terms.map(t=>t.term));
requireTrue(terms.length===280&&termSet.size===280,'Glossary identity boundary changed');
for(const key of exceptions.keys())requireTrue(termSet.has(key),`Unknown glossary exception ${key}`);
const glossary=terms.map((t,i)=>({ordinal:i+1,term:t.term,...(exceptions.get(t.term)||{verdict:'양호',reason:'정의·조건·예외의 내부 의미 검토에서 중대 문제 미발견'}),sourceHash:sha('js/aio-glossary.js'),externalCertified:false}));
if(errors.length)throw new Error(errors.join('; '));
write('glossary-review-v57.98.json',{boundary:'280 definitions and 72 numeric-source rows fully read; selective primary-source checks only; judgments are not all confirmed defects',source:'js/aio-glossary.js',sourceSha256:sha('js/aio-glossary.js'),numericSourceRows:Object.keys(glossaryContext.GLOSSARY_FIGURE_SOURCES).length,rows:glossary});
fs.writeFileSync(`${dir}/glossary-review-v57.98.tsv`,'term\t판정\t구체사유\n'+glossary.map(t=>[t.term,t.verdict,t.reason].join('\t')).join('\n')+'\n');
const worked=table('worked-review-v57.98.tsv');
const lessons=json('public-data/principles/lesson-library.json').lessons;
requireTrue(sha('public-data/principles/lesson-library.json')==='15ad0bc9dcbad8f498263eae0af92ca310301bbfd5f2fb3926171d7f6132fc23','Worked source changed since complete reading');
requireTrue(worked.length===112&&new Set(worked.map(t=>t[0])).size===112,'Worked review must have 112 unique IDs');
requireTrue(lessons.every(l=>l.worked&&worked.some(r=>r[0]===l.id)),'Worked review/source mismatch');
const mismatches={
  'nathan-frameworks:nathan-tokenomics-value-link':'token economics <- language-model attention',
  'taxonomy:power-transformer':'electric transformer <- Attention Is All You Need',
  'principles-lesson:D6':'neutral interest rate <- silicon doping fact',
  'principles:money-purchasing-power':'purchasing power <- data-center PUE',
  'taxonomy:space-rocket-physics':'rocket physics <- data-center efficiency/PUE',
  'taxonomy:defense-c2-isr-ew':'C2/ISR/EW <- Fed financial stability',
  'principles-lesson:E7':'yen carry <- ASML EUV',
  'nathan-frameworks:nathan-etf-nav-basket-integrity':'ETF NAV basket <- CPI basket',
  'atlas-foundation:capacity-and-yield':'old r-star mismatch removed; remaining DOE source insufficient; IN_PROGRESS',
  'principles-lesson:N9':'finance <- ASML EUV; IN_PROGRESS, no completed-research claim'
};
const factMap=new Map(json('public-data/knowledge/research-facts.json').facts.map(f=>[f.factId,f]));
const dossierDir='public-data/knowledge/research-dossiers';
const names=fs.readdirSync(dossierDir).filter(n=>n.endsWith('.json')).sort();
const bundle=crypto.createHash('sha256');
let absentSelectedRefs=0;
const dossiers=names.map(name=>{
  const p=`${dossierDir}/${name}`;
  bundle.update(name);bundle.update('\0');bundle.update(fs.readFileSync(p));
  const d=json(p),selected=new Set(d.selectedSources.map(s=>s.sourceId));
  const gaps=(d.researchFactIds||[]).flatMap(id=>{
    const fact=factMap.get(id);
    requireTrue(!!fact,`Unresolved fact ${id}`);
    return fact&&!selected.has(fact.sourceId)?[{factId:id,sourceId:fact.sourceId}]:[];
  });
  absentSelectedRefs+=gaps.length;
  return {contentUnitId:d.contentUnitId,title:d.title,path:p,sha256:sha(p),readScope:'all unique fields and unit-specific fact/source/claim bindings; identical templates reused after equality check',status:d.status,evidenceAttached:d.completion.evidenceAttached,semanticReview:d.completion.semanticReview,review:'READ_NOT_EXTERNAL_CERTIFICATION',commonTemplate:'Research instructions, not completed subject-specific argument',selectedSources:d.selectedSources.map(s=>s.sourceId),researchFactIds:d.researchFactIds,traceGaps:gaps,exception:mismatches[d.contentUnitId]||null};
});
const bundleHash=bundle.digest('hex');
requireTrue(names.length===455,'Dossier inventory changed');
requireTrue(bundleHash==='5dc2fc7a57b94e49ad9308ad2a688459990d48a6943e12670404bfda32d0d9e9','Dossier sources changed since complete reading');
if(errors.length)throw new Error(errors.join('; '));
const statusCounts=Object.fromEntries([...new Set(dossiers.map(d=>d.status))].map(s=>[s,dossiers.filter(d=>d.status===s).length]));
write('dossier-review-v57.98.json',{version,bundleHash,reviewer:'/root/governance_complete',scope:'455 dossier full fields and 43 fact texts; external pages not all reopened; no UI certification',statusCounts,traceGapUnitCount:dossiers.filter(d=>d.traceGaps.length).length,traceGapReferences:absentSelectedRefs,rows:dossiers});
fs.writeFileSync(`${dir}/dossier-review-v57.98.tsv`,'contentUnitId\t상태\t검토\t내부추적간극\t예외\n'+dossiers.map(d=>[d.contentUnitId,d.status,d.review,d.traceGaps.length,d.exception||''].join('\t')).join('\n')+'\n');
const previous=json(`${dir}/continued-source-receipt.json`).files;
const current=previous.map(f=>({path:f.path,sha256:fs.existsSync(f.path)?sha(f.path):null,previousSha256:f.sha256,changedSinceV5791:!fs.existsSync(f.path)||sha(f.path)!==f.sha256}));
write('latest-source-receipt.json',{observedAt:new Date().toISOString(),version,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dossierBundleSha256:bundleHash,workedSha256:sha('public-data/principles/lesson-library.json'),glossarySha256:sha('js/aio-glossary.js'),researchFactsSha256:sha('public-data/knowledge/research-facts.json'),files:current});
const counts={dossiers:dossiers.length,dossierStatuses:statusCounts,dossierTraceGapUnits:dossiers.filter(d=>d.traceGaps.length).length,dossierTraceGapRefs:absentSelectedRefs,facts:factMap.size,worked:worked.length,workedVerdicts:Object.fromEntries([...new Set(worked.map(w=>w[1]))].map(v=>[v,worked.filter(w=>w[1]===v).length])),glossary:glossary.length,glossaryExceptions:exceptions.size,changedSourcesSinceV5791:current.filter(f=>f.changedSinceV5791).length};
write('latest-validation.json',{observedAt:new Date().toISOString(),version,boundary:'Identity/hash/ledger integrity only. It does not mechanically validate semantic judgments.',errors,counts});
console.log(JSON.stringify({errors,counts}));
if(errors.length)process.exitCode=1;
