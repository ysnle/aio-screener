import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ref='7e2411432f6ca0e5f02528b209b013bf5f7ff2dc',base='d36bb256';
const git=(args)=>execFileSync('git',args,{maxBuffer:32*1024*1024});
const hash=(r,p)=>{try{return createHash('sha256').update(git(['show',`${r}:${p}`])).digest('hex');}catch{return '';}};
const sources=['financial-delta-reading.tsv','interpretation-reading.tsv','producer-reading.tsv'];
const rows=new Map();
for(const file of sources){
 const data=readFileSync(`_artifacts/architecture-quality-audit/evidence/20261021/${file}`,'utf8').trim().split('\n').slice(1);
 for(const line of data){const [path,status,,sha256]=line.split('\t');if(!path.startsWith('src/domain/')&&!path.startsWith('scripts/producer/'))continue;
 if(!['FULL','FULL_DIFF_REVIEW'].includes(status))continue;
 const old=hash(base,path),next=hash(ref,path);
 rows.set(path,{path,status:old===sha256&&next===old?'HASH_REUSED_PRIOR_REVIEW':'REQUIRES_DELTA',baseSha256:old,sha256:next,reason:`${file}:${status}; prior SHA=${sha256}; base equality=${old===sha256}; current equality=${next===old}; 이번 전문 재독 아님`});}
}
const owned=['scripts/producer/macro-history.mjs','scripts/producer/market-narrative.mjs','scripts/producer/paths.mjs','scripts/lib/macro-sources.mjs','scripts/lib/market-analysis-validate.mjs','scripts/lib/market-analysis-numbers.mjs','scripts/lib/factors.mjs'];
const changed=git(['diff','--name-only',base,ref,'--','src/domain',...owned]).toString('utf8').trim().split('\n');
const full=new Set(['src/domain/fundamental/analysis-read.js','src/domain/macro/taylor-rule.js','src/domain/market/kr-investor-flows.js','src/domain/masters/ticker-exact.js','src/domain/portfolio/asset-class.js']);
const diffOnly=new Set(['scripts/lib/factors.mjs','scripts/lib/macro-sources.mjs','scripts/lib/market-analysis-numbers.mjs','scripts/lib/market-analysis-validate.mjs','src/domain/briefing/daily-diff.js','src/domain/briefing/market-read.js','src/domain/entity/stock-read.js']);
for(const path of changed) rows.set(path,{path,status:full.has(path)?'FULL':diffOnly.has(path)?'DIFF_ONLY':'FULL_DIFF_REVIEW',baseSha256:hash(base,path),sha256:hash(ref,path),reason:full.has(path)?'고정 REF 신규 모듈 전문 의미 검토':diffOnly.has(path)?'d36bb256→고정 REF 전체 diff만 의미 검토; 이전 FULL 기반 없음; 후속 두 파일 전문은 domain-complete-reading.tsv 별도':'d36bb256→고정 REF 전체 diff 의미 검토; 주변 caller는 별도 PARTIAL'});
for(const path of ['src/ui/components/stock-read.js','src/ui/components/fundamental-analysis-cards.js','src/ui/components/macro-board.js','src/ui/components/korea-participation.js','src/ui/components/portfolio-read.js','src/ui/panels/portfolio-stress.js','scripts/fetch-kr-investor-flows.mjs','public-data/data.json','public-data/sec-fiscal-history.json','public-data/masters/security-master-reference.json'])rows.set(path,{path,status:'PARTIAL',baseSha256:hash(base,path),sha256:hash(ref,path),reason:'호출 경계·관련 구간 또는 artifact 후보 조회; 전문 의미 검토 아님'});
const out=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path));
writeFileSync(new URL('./domain-reading.tsv',import.meta.url),'path\tstatus\tbaseSha256\tsha256\treason\n'+out.map(r=>[r.path,r.status,r.baseSha256,r.sha256,r.reason].join('\t')).join('\n')+'\n');
console.log(JSON.stringify({ref,base,counts:out.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),unmatched:out.filter(r=>r.status==='REQUIRES_DELTA')},null,2));
