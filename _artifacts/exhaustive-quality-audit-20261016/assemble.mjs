import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir='_artifacts/exhaustive-quality-audit-20261016';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(`${dir}/${p}`,JSON.stringify(v,null,2)+'\n');
const table=name=>fs.readFileSync(`${dir}/${name}`,'utf8').trim().split(/\r?\n/).slice(1).map(line=>line.split('|'));
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name).replaceAll('\\','/')]);
const articles=walk('public-data/knowledge/articles').filter(p=>p.endsWith('.json')).map(p=>({path:p,...read(p)}));
const articleMap=new Map(articles.map(a=>[a.articleId,a]));
const arows=table('article-review.tsv').map(([id,verdict,reason])=>({articleId:id,path:articleMap.get(id)?.path,verdict,reason,scope:'All unique draft summary/article/deepArticle/evidence strings; not all external sources',externalFactCertified:false}));
const aReview=new Map(arows.map(r=>[r.articleId,r]));
const claims=read('public-data/knowledge/claims.json').claims;
const newReview=new Map(table('claim-new-review.tsv').map(([id,verdict,reason])=>[id,{verdict,reason}]));
const explicit={ 'principles-lesson-G1':['보완','회계이익과 자본비용 차감 이익 혼합'], 'principles-lesson-G4':['수정','신규발행과 기존주주 매각의 발행자 혼동'], 'principles-lesson-M8':['수정','network를 facility 부하에 넣은 IT 경계 오류'] };
const crows=claims.map(c=>{
  const article=articles.find(a=>a.summary?.definition+' '+a.summary?.mechanism===c.statement);
  if(article){const x=explicit[c.claimId];return {claimId:c.claimId,directness:c.directness,articleId:article.articleId,exactEquality:true,verdict:x?.[0]||'정의·원리 읽기 검토',reason:x?.[1]||'동일한 정의·원리의 읽기 검토를 재사용; 원고 전체 판정을 상속하지 않음',reviewRef:'article-review.tsv#'+article.articleId,scope:'definition + mechanism only; excludes article evidence/example/visualization',externalFactCertified:false};}
  return {claimId:c.claimId,directness:c.directness,exactEquality:false,...newReview.get(c.claimId),scope:'Full statement',externalFactCertified:false};
});
const units=read('public-data/knowledge/coverage-matrix.json').units;
const domains=new Map(table('domain-review.tsv').map(([id,verdict,reason])=>[id,{verdict,reason}]));
const urows=units.map(u=>({unitId:u.unitId,kind:u.kind,title:u.title,sourceArtifact:u.sourceArtifact,dossierId:u.dossierId,articleRead:!!aReview.get(u.articleId),articleReviewRef:aReview.has(u.articleId)?'article-review.tsv#'+u.articleId:null,domainDossierReview:domains.get(u.unitId.replace(/^domain:/,''))||null,fullResearchDossierSemanticReview:false,claimSpecificExternalSupportCertified:false,browserCertification:false,boundary:'A related article/story/claim reading does not certify every dossier field or source. See independent per-item reading tables.'}));
const sources=read('public-data/knowledge/sources.json').sources.map(s=>({id:s.id,title:s.title,url:s.url,declaredDirectness:s.directness,claimSpecificSupportCertified:false,fullOriginalReadInThisPass:false,nextCheck:'Verify the exact linked claim, source passage, publication/validity date and reuse boundary; targeted checks in CONTENT.md do not certify this whole registry'}));
write('article-ledger.json',arows);write('claim-ledger.json',crows);write('unit-evidence-ledger.json',urows);write('external-source-queue.json',sources);
const historical=read(`${dir}/historical-rules.json`),hr=table('historical-review.tsv');
const errs=[];
if(arows.length!==articles.length||new Set(arows.map(a=>a.articleId)).size!==articles.length||arows.some(r=>!r.path||!r.reason))errs.push('article manifest mismatch');
if(crows.length!==claims.length||crows.some(c=>!c.verdict||!c.reason)||newReview.size!==114)errs.push('claim review incomplete');
if(hr.length!==historical.length||hr.some(([id,occ],i)=>id!==historical[i].id||Number(occ)!==i+1))errs.push('historical review row mismatch');
const lessons=read('public-data/principles/lesson-library.json').lessons;
const lr=table('active-lessons-review.tsv');
if(lr.length!==lessons.length||lr.some(([id,,why])=>!lessons.some(x=>x.id===id)||!why))errs.push('lesson review incomplete');
const drift=[];
for(const r of read(`${dir}/source-receipt.json`).files){if(fs.existsSync(r.path)){const hash=crypto.createHash('sha256').update(fs.readFileSync(r.path)).digest('hex');if(hash!==r.sha256)drift.push(r.path);}else drift.push(r.path);}
const result={checkedAt:new Date().toISOString(),errors:errs,counts:{articles:arows.length,claims:crows.length,equalArticleClaims:crows.filter(c=>c.exactEquality).length,newClaims:newReview.size,units:urows.length,externalSources:sources.length,historicalBlocks:hr.length,historicalUnique:new Set(hr.map(x=>x[0])).size,activeLessons:lr.length,activeNotesAndColumns:table('active-notes-review.tsv').length,domains:domains.size},sourceDrift:drift,boundary:'Manifest consistency only, not semantic correctness, full external verification or deployed certification'};
write('validation.json',result);console.log(JSON.stringify(result));if(errs.length)process.exitCode=1;
