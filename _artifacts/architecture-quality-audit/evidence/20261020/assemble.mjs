import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='_artifacts/architecture-quality-audit/evidence/20261020', prior='_artifacts/architecture-quality-audit/evidence/20261019';
const inventory=JSON.parse(fs.readFileSync(`${dir}/source-inventory.json`,'utf8'));
const oldInventory=JSON.parse(fs.readFileSync(`${prior}/source-inventory.json`,'utf8'));
const old=new Map(JSON.parse(fs.readFileSync(`${prior}/reading-ledger.json`,'utf8')).map(r=>[r.path,{...r}]));
const cells=line=>line.split('\t').map(s=>s.replace(/^"|"$/g,'').replaceAll('""','"'));
function reviews(folder,names,apply){for(const name of names){const file=`${folder}/${name}`;if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean),head=cells(lines.shift());for(const line of lines){const values=cells(line),entry=Object.fromEntries(head.map((k,i)=>[k,values[i]||'']));apply(entry,file);}}}
reviews(prior,['financial-reading.tsv','boundary-reading.tsv','ui-pages-reading.tsv','macro-market-reading.tsv','legacy-data-reading.tsv','root-reading.tsv'],(entry,file)=>{
  const p=entry.path||entry.file,source=oldInventory.sources.find(s=>s.path===p);if(!source)return;
  const sha=entry.sha256||entry.sha,status=entry.status||entry.read;
  if(sha!==source.sha256)return; // Mixed-version receipts never confer coverage.
  const reason=entry.reason||entry.judgment||entry.verdict||'전문 정적 의미 검토';
  if(status==='FULL'||status.startsWith('FULL_READ'))old.set(p,{...source,status:'FULL_CURRENT_REVIEW',reason,evidence:file});
  else if(status==='PARTIAL'&&!/FULL/.test(old.get(p)?.status||''))old.set(p,{...source,status:'PARTIAL_CURRENT_REVIEW',reason,evidence:file});
});
const rows=inventory.sources.map(source=>{
  const previous=old.get(source.path),same=previous?.sha256===source.sha256;
  const status=!previous?'NEW_REVIEW_REQUIRED':!same?'CHANGED_REVIEW_REQUIRED':/FULL/.test(previous.status)?'REUSED_FULL_STATIC_REVIEW':previous.status==='REUSED_CANONICAL_MIRROR'?'REUSED_CANONICAL_MIRROR':/PARTIAL/.test(previous.status)?'PARTIAL_PRIOR_READ':previous.status==='REUSED_PRIOR_STATIC_REVIEW'?'REUSED_PRIOR_STATIC_REVIEW':'NOT_SEMANTICALLY_REVIEWED';
  return {...source,status,reason:same?previous.reason:'現 SHA 전문 의미 검토 필요',evidence:same?previous.evidence:null};
});
const mismatch=[];
reviews(dir,['root-reading.tsv'],(entry,file)=>{const row=rows.find(r=>r.path===entry.path);if(!row)return;if(entry.sha256!==row.sha256){mismatch.push(entry.path);return;}Object.assign(row,{status:entry.status==='FULL'?'FULL_CURRENT_REVIEW':'PARTIAL_CURRENT_REVIEW',reason:entry.reason,evidence:file});});
const drift=rows.filter(row=>crypto.createHash('sha256').update(fs.readFileSync(row.path)).digest('hex')!==row.sha256).map(r=>r.path);
for(const row of rows)if(drift.includes(row.path))row.status='SOURCE_DRIFT_INVALIDATED';
const counts=Object.fromEntries([...new Set(rows.map(r=>r.status))].map(s=>[s,rows.filter(r=>r.status===s).length]));
const summary={observedAt:new Date().toISOString(),version:inventory.version,head:inventory.head,mode:'cstack review',verdict:'IN_PROGRESS',total:rows.length,counts,sourceDrift:drift,receiptMismatch:mismatch,independence:'limited: same-model fresh-context read-only reviewers',boundary:'전문 정적 검토, 동일 SHA 과거 검토 재사용, 구문 분석, 격리 실행, 브라우저, 라이브를 구별. 부분/미검토는 PASS가 아니다.',unfinished:rows.filter(r=>/REQUIRED|NOT_SEMANTICALLY|PARTIAL|DRIFT/.test(r.status)).map(r=>r.path)};
fs.writeFileSync(`${dir}/reading-ledger.json`,JSON.stringify(rows,null,2)+'\n');
fs.writeFileSync(`${dir}/coverage.json`,JSON.stringify(summary,null,2)+'\n');
fs.writeFileSync(`${dir}/reading-ledger.tsv`,'path\tstatus\tsha256\treason\tevidence\n'+rows.map(r=>[r.path,r.status,r.sha256,r.reason,r.evidence||''].map(v=>String(v).replace(/[\t\r\n]/g,' ')).join('\t')).join('\n')+'\n');
console.log(JSON.stringify({...summary,unfinished:summary.unfinished.length},null,2));
if(drift.length||mismatch.length)process.exitCode=1;
