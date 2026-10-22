import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='_artifacts/architecture-quality-audit/evidence/20261019',prior='_artifacts/architecture-quality-audit/evidence/20261018';
const inventory=JSON.parse(fs.readFileSync(`${dir}/source-inventory.json`,'utf8'));
const oldInventory=new Map(JSON.parse(fs.readFileSync(`${prior}/source-inventory.json`,'utf8')).sources.map(row=>[row.path,row]));
const old=new Map(JSON.parse(fs.readFileSync(`${prior}/reading-ledger.json`,'utf8')).map(row=>[row.path,row]));
const table=file=>fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(1).map(line=>line.split('\t'));
for(const [path,read,verdict,reason,interval]of table(`${prior}/ui-reading.tsv`))if(read==='FULL')old.set(path,{...oldInventory.get(path),status:'FULL_READ',reason:`${verdict}: ${reason}; ${interval}`,evidence:`${prior}/ui-reading.tsv`});
for(const [path,range,verdict,reason,,,sha]of table(`${prior}/domain-reading.tsv`))if(range==='FULL')old.set(path,{...oldInventory.get(path),sha256:sha,status:'FULL_READ',reason:`${verdict}: ${reason}`,evidence:`${prior}/domain-reading.tsv`});
for(const [path,status,reason,sha,interval]of table(`${prior}/tooling-ci-1.tsv`))if(status.startsWith('FULL_READ'))old.set(path,{...oldInventory.get(path),sha256:sha,status:'FULL_READ',reason:`${reason}; ${interval}`,evidence:`${prior}/tooling-ci-1.tsv`});
const rows=new Map(inventory.sources.map(row=>{
  const previous=old.get(row.path),same=previous?.sha256===row.sha256;
  const status=!previous?'NEW_REVIEW_REQUIRED':!same?'CHANGED_REVIEW_REQUIRED':previous.status==='FULL_READ'?'REUSED_FULL_STATIC_REVIEW':previous.status==='EXACT_PRIOR_REUSE'?'REUSED_PRIOR_STATIC_REVIEW':previous.status==='EXACT_MIRROR_REUSE'?'REUSED_CANONICAL_MIRROR':previous.status==='PARTIAL_READ'?'PARTIAL_PRIOR_READ':'NOT_SEMANTICALLY_REVIEWED';
  return [row.path,{...row,status,reason:same?previous.reason:'현재 소스로 전문 의미 검토 필요',evidence:same?(previous.evidence||`${prior}/reading-ledger.json`):null}];
}));
for(const name of ['financial-reading.tsv','boundary-reading.tsv','ui-pages-reading.tsv','root-reading.tsv']){
  const file=`${dir}/${name}`;if(!fs.existsSync(file))continue;
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean),headers=lines.shift().split('\t');
  for(const line of lines){
    const values=line.split('\t'),entry=Object.fromEntries(headers.map((h,index)=>[h,values[index]||'']));
    const p=entry.path||entry.file,row=rows.get(p);if(!row)throw new Error(`Unknown review source ${p}`);
    const sha=entry.sha256||entry.sha;if(sha&&sha!==row.sha256)throw new Error(`Review hash mismatch ${p}`);
    const status=entry.status||entry.read;
    if(status==='FULL'||status?.startsWith('FULL_READ'))Object.assign(row,{status:'FULL_CURRENT_REVIEW',reason:entry.reason||entry.verdict||'전문 정적 의미 검토',evidence:file});
    else if(status==='PARTIAL'&&!row.status.startsWith('FULL_')&&!row.status.startsWith('REUSED_FULL'))Object.assign(row,{status:'PARTIAL_CURRENT_REVIEW',reason:entry.reason||entry.verdict||'부분 읽기',evidence:file});
  }
}
const drift=[];
for(const row of rows.values())if(crypto.createHash('sha256').update(fs.readFileSync(row.path)).digest('hex')!==row.sha256){row.status='SOURCE_DRIFT_INVALIDATED';drift.push(row.path);}
const ledger=[...rows.values()],counts=Object.fromEntries([...new Set(ledger.map(row=>row.status))].map(status=>[status,ledger.filter(row=>row.status===status).length]));
const summary={observedAt:new Date().toISOString(),version:inventory.version,head:inventory.head,mode:'cstack review',verdict:'IN_PROGRESS',total:ledger.length,counts,sourceDrift:drift,
  boundary:'Full static reading, prior identical-SHA reuse, syntax parse, isolated probes, browser and live evidence remain distinct. Partial/unread is never PASS.',
  independence:'limited: same-model independent fresh-context reviewers; separate correctness and blast-radius/security lenses',
  unfinished:ledger.filter(row=>/REQUIRED|NOT_SEMANTICALLY|PARTIAL/.test(row.status)).map(row=>row.path)};
fs.writeFileSync(`${dir}/reading-ledger.json`,JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(`${dir}/reading-ledger.tsv`,'path\tstatus\tsha256\treason\tevidence\n'+ledger.map(row=>[row.path,row.status,row.sha256,row.reason,row.evidence||''].map(v=>String(v).replace(/[\t\r\n]/g,' ')).join('\t')).join('\n')+'\n');
fs.writeFileSync(`${dir}/coverage.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({version:summary.version,total:summary.total,counts,sourceDrift:drift},null,2));
if(drift.length)process.exitCode=1;
