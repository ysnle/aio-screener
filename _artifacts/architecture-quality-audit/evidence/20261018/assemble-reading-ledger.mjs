// Preserve evidence levels; an inventory/parser result never upgrades an unread file to semantic review.
import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='_artifacts/architecture-quality-audit/evidence/20261018';
const inventory=JSON.parse(fs.readFileSync(`${dir}/source-inventory.json`,'utf8'));
const parse=new Set(JSON.parse(fs.readFileSync(`${dir}/parse-ledger.json`,'utf8')).map(row=>row.path));
const rows=new Map(inventory.sources.map(file=>[file.path,{...file,status:'NOT_SEMANTICALLY_REVIEWED',reason:'전수 인벤토리/구조 분석만 완료. 전문 의미 검토 완료로 세지 않음',evidence:'source-inventory.json'}]));
const set=(path,status,reason,evidence)=>{if(!rows.has(path))throw new Error(`Unknown path ${path}`);Object.assign(rows.get(path),{status,reason,evidence});};
const tsv=name=>fs.readFileSync(`${dir}/${name}`,'utf8').split(/\r?\n/).filter(Boolean).slice(1).map(line=>line.split('\t'));
for(const [path,status,reason]of tsv('data-ai-reading.tsv'))set(path,'FULL_READ',`${status}: ${reason}`,'DATA-AI.md; data-ai-reading.tsv');
for(const [path,range,verdict,reason,,,,prior]of tsv('domain-reading.tsv')){
  if(range==='FULL')set(path,'FULL_READ',`${verdict}: ${reason}`,'domain-reading.tsv');
  else if(range==='EXACT_PRIOR_REUSE'){
    if(prior!==rows.get(path).sha256)throw new Error(`Prior mismatch ${path}`);
    set(path,'EXACT_PRIOR_REUSE',reason,'domain-reading.tsv; previous exhaustive audit');
  }else if(reason.includes('직접 읽음')||reason.includes('출력잘림'))set(path,'PARTIAL_READ',reason,'domain-reading.tsv');
}
const foundations=[...rows.keys()].filter(p=>/^src\/(app|state|platform|legacy|storage)\//.test(p));
if(foundations.length!==46)throw new Error('Foundations scope drift');
for(const p of foundations)set(p,'FULL_READ',p.includes('compatibility-globals')?'검색 clear 비동기 race 재현':p.includes('compat-facade')?'중복 projection/async event 경계 개선':p.includes('background-alerts')||p.includes('bootstrap')?'app 수명주기와 start/stop 범위 분리 권고':p.startsWith('src/storage/')&&!p.endsWith('financial-security.js')&&!p.endsWith('screener-runs.js')?'실사용 연결이 없는 일반 저장 helper; actual Vault 경계와 구분':'전문 검토에서 역할 유지 가능. 실행 PASS 의미 아님','FOUNDATIONS.md; structure_foundations final receipt');
const componentNames=['color-theme','deep-dive','dom','empty-state','knowledge-arrival','korea-participation','page-flow','page-sources','responsive-shell','scenario-outlook','scroll-cue','sector-moves','shell-overlays','term-marks','term-tooltip'];
const knowledgeNames=['capability-loader','evidence','graph','learning-controls','lesson','path','safe-external-link','supplied-material-bridge','tree'];
const uiFirst=[...componentNames.map(n=>`src/ui/components/${n}.js`),...knowledgeNames.map(n=>`src/ui/knowledge/${n}.js`),...[...rows.keys()].filter(p=>/^src\/ui\/(navigation|panels)\//.test(p))];
if(uiFirst.length!==32)throw new Error('UI first scope drift');
for(const p of uiFirst)set(p,'FULL_READ','1차 전문 완료. 개별 개선 후보와 유지 근거는 UI.md 참조','UI.md; structure_ui first-batch receipt');
for(const n of ['ai-answer-visuals','ai-infrastructure-lens','breadth-board','briefing-read','chat-sessions','company-analysis','daily-loop'])set(`src/ui/components/${n}.js`,'FULL_READ','2차 독자의 명시적 전문 완료 메시지. 나머지 2차 파일은 미완료로 보수적 집계','UI.md; structure_ui progress message');
if(fs.existsSync(`${dir}/ui-reading.tsv`))for(const [p,read,verdict,reason,interval]of tsv('ui-reading.tsv')){
  if(read==='FULL')set(p,'FULL_READ',`${verdict}: ${reason}; 읽기 구간 ${interval}`,'UI.md; ui-reading.tsv');
}
if(fs.existsSync(`${dir}/tooling-ci-1.tsv`))for(const [p,status,reason,sha,interval]of tsv('tooling-ci-1.tsv')){
  if(status.startsWith('FULL_READ')){
    if(sha!==rows.get(p)?.sha256)throw new Error(`CI source mismatch ${p}`);
    set(p,'FULL_READ',`${status}: ${reason}; ${interval}`,'TOOLING-CI-1.md; tooling-ci-1.tsv');
  }
}
const rootFull={
  'scripts/qa-runner.mjs':'캐시 fingerprint/실패배치/timeout/출력 redaction/candidate 경계 전문. 캐시 입력 반례 재현',
  'scripts/build-pages-bundle.mjs':'staged copy minify/split/global name/hash manifest 전문. esbuild 미설치로 실제 빌드 미실행',
  'scripts/lib/js-toplevel.mjs':'heuristic top-level scanner 전문. 정식 JS parser 인증으로 사용하지 않음',
  'scripts/lib/browser-gate.mjs':'로컬 서버 readiness/timeout/정리 helper 전문',
  'scripts/ci-decomp-hotspot-check.mjs':'line+nonwhitespace ratchet 전문. 파일 크기 감소를 설계 품질과 동일시하지 않음',
  'src/domain/fundamental/consensus-read.js':'종가/예상 EPS/기준 차이/결측 보류 전문. normalizer 경계 가격 손실 재현',
  'src/domain/market/quote-presentation.js':'envelope 우선/시각과 수신시각/quality·display 역할 분리 전문',
  'src/domain/news/earnings-context.js':'issuer 이름/분석사 오인 배제/예상대비 계산/관측창 전문',
  'js/aio-macro-tech.js':'완료된 이전 renderer 삭제와 pure health 호환 wrapper·초기 load 순서 전문',
  'scripts/lib/atomic-write.mjs':'같은 경로 temp/rename, Windows 일시오류 한정 retry, 실패 cleanup 전문',
  'scripts/lib/domain-receipt.mjs':'배치 시도와 보관 원장·새 관측 갱신·기존값 유지의 구분 전문. 수량/실패원장 불일치 입력의 caller 불변식 검토 필요',
  'scripts/lib/producer-http.mjs':'body deadline/4xx retry 제한/RSS bounded retry 전문. 현행 opts.signal caller 미확인',
  'scripts/lib/producer-math.mjs':'producer와 browser 공통 price-factor round로 위임하는 단일 export 전문',
  'scripts/lib/masters-raw-rows.mjs':'검증된 분기 행 identity 없는 raw holding의 비교 수치와 행동을 보류하는 전문',
  'scripts/lib/rule-ids.mjs':'규칙 heading/inline 세 형태와 sub-rule 제외 parser 전문',
  'scripts/lib/qa-failure-cause.mjs':'한정된 실패 진단선 추출·중복 제거·폭 제한 전문',
  'scripts/lib/telegram-text.mjs':'정책에 따른 pictograph/중국어 인용 구간 정리 전문. 의미 정확성 인증 도구로 보지 않음',
  'scripts/lib/producer-source.mjs':'기존 source-text 게이트를 위한 명시 source concatenation 전문. 행동 검사와 구분',
  'scripts/lib/refresh-continuity.mjs':'불완전 수집이 prior lastSuccessfulAt을 갱신하지 않는 공유 계약 전문',
  'scripts/lib/align-generated-version.mjs':'정확한3개 metadata 표면만 동기화하고 관측/data identity는 유지하는 전문',
  'scripts/lib/principles-stories.mjs':'literal 병합·길이/문단/질문 편집 규칙 전문. 의미 품질 인증과 구분',
  'scripts/lib/operational-health.mjs':'blocking PASS와 degraded 운영상태·workflow arrival를 분리하는 전문',
  'scripts/lib/principles-worked.mjs':'예제 shape·분량·숫자 존재 검사 전문. 산식 검산이나 전제 검증과 구분',
  'scripts/lib/rank-statistics.mjs':'midrank/Spearman·결측 pair 필터·CI 계산 전문. 누락 percentile 0.5의 caller 의미와 CI 가정은 추가 검토',
  'scripts/lib/13f-semantic-hash.mjs':'poll clock만 제외하는 semantic content digest와 unchanged-write 생략 전문',
  'scripts/lib/sec-ledger.mjs':'manifest digest에 맞는 full ledger만 채택하고 absent/stale을 labelled SKIP로 표현하는 전문',
  'scripts/lib/13f-compose.mjs':'amendment restatement 교체/new holdings 추가/미분류 실패·행 provenance 전문. caller 정렬 불변식 중요',
  'scripts/lib/market-analysis-numbers.mjs':'지표별 숫자 결속·시각/날짜/개수 배제·문장/목록 경계 parser 전문. prose 의미 전체 인증과 구분',
  'scripts/lib/sec-ledger-store.mjs':'결정적 줄 경계 part 분할·재결합 digest·주입 git plumbing·legacy layout read 전문',
  'sw.js':'install/activate/fetch/TTL/민감URL/cache key/message 전398행 전문. 타 앱 cache 삭제 callback 격리 재현',
};
for(const [p,reason]of Object.entries(rootFull))set(p,'FULL_READ',reason,'root direct reading; REPRODUCED.md');
for(const p of [...rows.keys()].filter(p=>p.startsWith('.claude/skills/verify-aio/scripts/')))set(p,'FULL_READ','verify-aio canonical 실행기·브라우저 helper·feature driver 전문. 표시/route assertion·skip·오류 경계 한계는 TOOLING.md 참조','root direct reading; TOOLING.md');
for(const p of [...rows.keys()].filter(p=>p.startsWith('.agents/skills/verify-aio/scripts/'))){
  const canonical=p.replace('.agents/','.claude/');
  if(!rows.has(canonical)||rows.get(p).sha256!==rows.get(canonical).sha256)throw new Error(`Mirror mismatch ${p}`);
  set(p,'EXACT_MIRROR_REUSE','canonical 원문과 SHA 동일. 물리적 mirror를 독립된 신규 의미 검토로 중복 계산하지 않음',canonical);
}
set('index.html','PARTIAL_READ','head/boot/briefing 날짜/차트 dependency inline3개 및 footer 읽음. inline3개 syntax parse·차트 fallback 격리 재현. 나머지 markup·inline CSS는 전문 미완료','chart-fallback-result.json; root direct reading');
set('scripts/ci-architecture-contract-check.mjs','PARTIAL_READ','첫115행 전문, 이후 출력 잘림. 텍스트 marker/구조 검사와 행동 검증의 구분을 검토했으나 전체 미완료','root direct reading');
const previous=JSON.parse(fs.readFileSync('_artifacts/exhaustive-quality-audit-20261016/latest-source-receipt.json','utf8')).files;
for(const file of previous.filter(f=>f.path.startsWith('.github/workflows/'))){
  const current=rows.get(file.path);
  if(current&&current.sha256===file.sha256)set(file.path,'EXACT_PRIOR_REUSE','이전13개 전문 및 v57.91→98 diff 의미 검토 재사용. 이번 인벤토리와 최신 재대조 SHA 동일. Actions 실행 증거 아님','../exhaustive-quality-audit-20261016/WORKFLOWS.md; LATEST-STATUS-v57.98.md; latest-source-receipt.json');
}
const drift=[];
for(const row of rows.values()){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(row.path)).digest('hex');
  row.syntaxParsed=parse.has(row.path);
  if(actual!==row.sha256){drift.push(row.path);row.status='SOURCE_CHANGED_REVIEW_INVALIDATED';}
}
const ledger=[...rows.values()];
const counts=Object.fromEntries([...new Set(ledger.map(r=>r.status))].map(s=>[s,ledger.filter(r=>r.status===s).length]));
const result={observedAt:new Date().toISOString(),version:inventory.version,head:inventory.head,scope:inventory.scope,total:ledger.length,counts,sourceDrift:drift,
  boundary:'FULL_READ is static semantic review, not runtime PASS. EXACT_PRIOR_REUSE is separate. PARTIAL/unreviewed remain open. A failed reader turn never upgrades coverage.',
  continuationState:'IN_PROGRESS. Three readers resumed after the account usage reset; only saved or explicit completion receipts count. Tooling/legacy/index and remaining UI/domain sources remain open.',
  categories:Object.fromEntries([...new Set(ledger.map(r=>r.category))].map(c=>[c,Object.fromEntries([...new Set(ledger.filter(r=>r.category===c).map(r=>r.status))].map(s=>[s,ledger.filter(r=>r.category===c&&r.status===s).length]))]))};
fs.writeFileSync(`${dir}/reading-ledger.json`,JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(`${dir}/reading-ledger.tsv`,'path\tstatus\tsha256\tsyntaxParsed\treason\tevidence\n'+ledger.map(r=>[r.path,r.status,r.sha256,r.syntaxParsed,r.reason,r.evidence].map(x=>String(x).replace(/[\t\r\n]/g,' ')).join('\t')).join('\n')+'\n');
fs.writeFileSync(`${dir}/coverage.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(drift.length)process.exitCode=1;
