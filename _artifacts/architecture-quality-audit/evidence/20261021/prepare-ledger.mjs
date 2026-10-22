import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='_artifacts/architecture-quality-audit/evidence/20261021',old='_artifacts/architecture-quality-audit/evidence/20261020';
let source=fs.readFileSync(`${old}/assemble.mjs`,'utf8').replaceAll(old,dir);
source=source.replace("['root-reading.tsv'],(entry,file)","['root-reading.tsv','ui-delta-reading.tsv','financial-delta-reading.tsv','legacy-current-reading.tsv','producer-reading.tsv'],(entry,file)");
source=source.replace("Object.assign(row,{status:entry.status==='FULL'?'FULL_CURRENT_REVIEW':'PARTIAL_CURRENT_REVIEW',reason:entry.reason,evidence:file});",`const full=entry.status==='FULL'||entry.status==='FULL_DIFF_REVIEW';if(!full&&/FULL/.test(row.status))return;if(full&&entry.status==='FULL_DIFF_REVIEW'&&entry.baseSha256!==entry.sha256&&old.get(entry.path)?.sha256!==entry.baseSha256){mismatch.push(entry.path);return;}Object.assign(row,{status:full?(entry.baseSha256===entry.sha256?'REUSED_FULL_STATIC_REVIEW':entry.status==='FULL_DIFF_REVIEW'?'FULL_BASE_PLUS_DIFF_REVIEW':'FULL_CURRENT_REVIEW'):'PARTIAL_CURRENT_REVIEW',reason:entry.reason,evidence:file});`);
fs.writeFileSync(`${dir}/assemble.mjs`,source);
const inventory=JSON.parse(fs.readFileSync(`${dir}/source-inventory.json`,'utf8'));
const prior20=JSON.parse(fs.readFileSync(`${old}/source-inventory.json`,'utf8'));
const prior19=JSON.parse(fs.readFileSync('_artifacts/architecture-quality-audit/evidence/20261019/source-inventory.json','utf8'));
const previouslyRead=[['scripts/lib/pages-bundle-config.mjs',prior20],['scripts/ci-boot-bundle-budget-check.mjs',prior20],['scripts/build-pages-bundle.mjs',prior20],['scripts/lib/producer-dry-run-fetch.mjs',prior20],['.github/workflows/pages-deploy.yml',prior20],['scripts/ci-generated-release-parity-check.mjs',prior19],['scripts/sync-data-release-manifests.mjs',prior19],['scripts/ci-fast-plane-live-check.mjs',prior19],['scripts/ci-csp-ratchet-check.mjs',prior19],['src/domain/market/benchmarks.js',prior19],['src/domain/market/session-time.js',prior19],['src/domain/portfolio/kr-stress.js',prior19],['scripts/start-local-node.mjs',prior19]];
const rows=[];
for(const[p,receipt]of previouslyRead){const prior=receipt.sources.find(r=>r.path===p),now=inventory.sources.find(r=>r.path===p);if(prior?.sha256===now?.sha256)rows.push([p,'FULL',now.sha256,now.sha256,'동일 SHA의 root 전문 읽기 재사용; 생성/게시·I/O·부분입력 경계 검토']);}
const dry=inventory.sources.find(r=>r.path==='scripts/ci-producer-dry-run.mjs');rows.push([dry.path,'FULL',prior20.sources.find(r=>r.path===dry.path).sha256,dry.sha256,'v58.50 전문 + v58.52 모든 diff 검토: Windows junction 변경; 실행하지 않음']);
fs.writeFileSync(`${dir}/root-reading.tsv`,'path\tstatus\tbaseSha256\tsha256\treason\n'+rows.map(r=>r.join('\t')).join('\n')+'\n');
console.log(`Recorded ${rows.length} root source readings without inflating partial source reads.`);
