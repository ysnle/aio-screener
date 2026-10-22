import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const dir='_artifacts/architecture-quality-audit/evidence/20261021-v5859',prior='_artifacts/architecture-quality-audit/evidence/20261021';
const inventory=JSON.parse(fs.readFileSync(`${dir}/source-inventory.json`,'utf8'));
const previous=new Map(JSON.parse(fs.readFileSync(`${prior}/reading-ledger.json`,'utf8')).map(r=>[r.path,{...r}]));
const oldInventory=JSON.parse(fs.readFileSync(`${prior}/source-inventory.json`,'utf8'));
function table(file){if(!fs.existsSync(file))return[];const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean),cell=s=>s.split('\t').map(v=>v.replace(/^"|"$/g,'')),headers=cell(lines.shift());return lines.map(l=>Object.fromEntries(cell(l).map((v,i)=>[headers[i],v])));}
for(const name of ['interpretation-reading.tsv','producer-reading.tsv','legacy-current-reading.tsv'])for(const e of table(`${prior}/${name}`)){
  const original=oldInventory.sources.find(r=>r.path===e.path);if(!original||original.sha256!==e.sha256)continue;
  if(e.status==='FULL'||e.status==='FULL_DIFF_REVIEW')previous.set(e.path,{...original,status:'FULL_PINNED_REVIEW',reason:e.reason,evidence:`${prior}/${name}`});
}
const rows=inventory.sources.map(r=>{const p=previous.get(r.path),same=p?.sha256===r.sha256;return{...r,status:!p?'NEW_REVIEW_REQUIRED':!same?'CHANGED_REVIEW_REQUIRED':/FULL/.test(p.status)?'REUSED_FULL_STATIC_REVIEW':p.status==='REUSED_CANONICAL_MIRROR'?'REUSED_CANONICAL_MIRROR':/PARTIAL/.test(p.status)?'PARTIAL_PRIOR_READ':p.status==='REUSED_PRIOR_STATIC_REVIEW'?'REUSED_PRIOR_STATIC_REVIEW':'NOT_SEMANTICALLY_REVIEWED',reason:same?p.reason:'最新固定 SHA 的 의미 검토 필요',evidence:same?p.evidence:null};});
const mismatches=[];
for(const name of ['ui-reading.tsv','domain-reading.tsv','legacy-core-reading.tsv','root-reading.tsv','tooling-reading.tsv','domain-complete-reading.tsv','remaining-root-reading.tsv','remaining-chat-reading.tsv','remaining-ui-reading.tsv','remaining-workflows-reading.tsv','remaining-workspace-tools-reading.tsv','remaining-qa-runner-reading.tsv'])for(const incoming of table(`${dir}/${name}`)){
  const e={...incoming,sha256:incoming.sha256||incoming.blobSHA256};
  const r=rows.find(r=>r.path===e.path);if(!r)continue;if(e.sha256!==r.sha256){mismatches.push(e.path);continue;}
  if(/DIFF/.test(e.status)){
    const base=previous.get(e.path);
    if(!base||!/FULL/.test(base.status)||base.sha256!==e.baseSha256){
      if(!/FULL/.test(r.status)){r.status='DIFF_ONLY_CURRENT_REVIEW';r.reason=`기준 전문 증거 미확인; ${e.reason||e.verdict||''}`;r.evidence=`${dir}/${name}`;}
      continue;
    }
  }
  const full=/^(FULL|FULL_READ|FULL_SOURCE_READ|FULL_DIFF_REVIEW|BASE_PLUS_DIFF|FULL_BASE_PLUS_DIFF_REVIEW|INHERITED_FULL)$/.test(e.status);
  if(!full&&/FULL/.test(r.status))continue;
  const composed=e.status==='FULL_SOURCE_READ'&&/reus|기준/i.test(e.reason||'');
  r.status=full?(e.status==='INHERITED_FULL'||e.baseSha256===e.sha256?'REUSED_FULL_STATIC_REVIEW':/DIFF/.test(e.status)||composed?'FULL_BASE_PLUS_DIFF_REVIEW':'FULL_CURRENT_REVIEW'):'PARTIAL_CURRENT_REVIEW';r.reason=e.reason||e.verdict;r.evidence=`${dir}/${name}`;
}
const drift=rows.filter(r=>!fs.existsSync(r.path)||crypto.createHash('sha256').update(fs.readFileSync(r.path)).digest('hex')!==r.sha256).map(r=>r.path);
// A newer checkout does not undo a reading of a pinned historical blob. Verify the fixed target,
// and report newer changes separately instead of relabelling them as reviewed or losing the receipt.
const targetMismatch=drift.filter(path=>crypto.createHash('sha256').update(execFileSync('git',['show',`${inventory.head}:${path}`],{maxBuffer:32*1024*1024})).digest('hex')!==rows.find(r=>r.path===path).sha256);
for(const r of rows)if(targetMismatch.includes(r.path))r.status='SOURCE_DRIFT_INVALIDATED';
const worktreeHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const counts=Object.fromEntries([...new Set(rows.map(r=>r.status))].map(s=>[s,rows.filter(r=>r.status===s).length]));
const summary={observedAt:new Date().toISOString(),version:inventory.version,head:inventory.head,verdict:'IN_PROGRESS',total:rows.length,counts,sourceDrift:targetMismatch,worktreeHead,workingTreeDrift:drift,receiptMismatch:mismatches,independence:'limited: same-model fresh-context read-only reviewers',boundary:'고정 REF 원장; 새 checkout 변경은 별도 delta이며 전문·기준전문+전체diff·같은SHA재사용·부분/미검토·구문·격리실행·브라우저·라이브 증거 구별',unfinished:rows.filter(r=>/REQUIRED|NOT_SEMANTICALLY|PARTIAL|DRIFT|DIFF_ONLY|REUSED_PRIOR_STATIC_REVIEW/.test(r.status)).map(r=>r.path)};
fs.writeFileSync(`${dir}/reading-ledger.json`,JSON.stringify(rows,null,2)+'\n');fs.writeFileSync(`${dir}/coverage.json`,JSON.stringify(summary,null,2)+'\n');
fs.writeFileSync(`${dir}/reading-ledger.tsv`,'path\tstatus\tsha256\treason\tevidence\n'+rows.map(r=>[r.path,r.status,r.sha256,r.reason,r.evidence||''].map(v=>String(v).replace(/[\t\r\n]/g,' ')).join('\t')).join('\n')+'\n');
console.log(JSON.stringify({...summary,unfinished:summary.unfinished.length},null,2));if(targetMismatch.length||mismatches.length)process.exitCode=1;
