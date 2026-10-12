import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
const reports=[
 '.cache/aio-qa/runs/2026-10-12T01-37-27-757Z-20956-j6lr16.json',
 '.cache/aio-qa/runs/2026-10-12T01-46-27-428Z-14328-o4lhxw.json',
 '.cache/aio-qa/runs/2026-10-12T01-48-20-217Z-3068-hyyphg.json',
 '.cache/aio-qa/runs/2026-10-12T01-49-47-443Z-24304-hjk2i6.json'
];
const byGate=new Map();for(const path of reports){const report=JSON.parse(readFileSync(path));for(const result of report.results||[])if(result.status!=='SKIP')byGate.set(result.id,{id:result.id,status:result.status,report:path,evidenceLevel:result.evidenceLevel});}
const gates=[...byGate.values()],failed=gates.filter(gate=>!['PASS','CACHED'].includes(gate.status));
const evidence={status:failed.length?'FAIL':'PASS',version:JSON.parse(readFileSync('version.json')).version,scope:'Full profile plus affected local watchdog, completed as failure batches and exact reruns; not a single no-cache full rerun after every fix.',reports,counts:{gates:gates.length,pass:gates.filter(g=>g.status==='PASS').length,cached:gates.filter(g=>g.status==='CACHED').length,failed:failed.length},unresolvedFailedBatch:existsSync('.cache/aio-qa/failed-batch.json'),gates,paidCalls:0,commit:false,push:false,deploy:false,limits:['Live AI/search answers and provisioning unverified','iOS/iPadOS Safari and hardware unverified','Fiscal producer changes await Actions','KR flow/filing completeness not established']};
if(failed.length||evidence.unresolvedFailedBatch)throw Error('Cannot close out unresolved QA failure');
writeFileSync('_artifacts/entity-quality-20261012/QA-summary.json',JSON.stringify(evidence,null,2)+'\n');
appendFileSync('_artifacts/entity-quality-20261012/IMPLEMENTATION-REPORT.md',`\n최종 로컬 QA **PASS**: ${gates.length}개 게이트의 최신 결과가 PASS/CACHED이며 미해결 실패 배치는 없습니다 (${evidence.counts.pass} PASS, ${evidence.counts.cached} CACHED). 전체 실행의 발견된 실패를 일괄 수정한 뒤 정확한 실패 게이트만 다시 실행했습니다. 근거: QA-summary.json와 위 실행 JSON.\n\n종목 first-load/실제 Chart.js 픽셀/시장별 비어 있지 않은 표/3개월 순서/손실 그래프/기업 AI 초안 연결은 390·820·1440 화면 × light/dark 6조합 PASS입니다. browser-report.json은 합성 Yahoo HTTP 응답을 사용한 실제 경로 검사입니다. 19라우트 × 390·768·1024 모바일/iPad 크기의 overflow·사전·테마 전체 티커/포커스·시장6축/한국참여도·AI 입력은 responsive-browser/report.json PASS입니다. 마지막 실패는 표를 스크롤 region으로 옮길 때 포커스가 사라지는 원인이었고, 동일 요소로 포커스를 복원해 수정했습니다.\n\n현재 Chrome 실제 시장 화면의 근거는 chrome-korea-dark.png입니다. 배포나 실제 유료 AI 성공을 뜻하지 않습니다. 마지막 버전/workspace/generated state/knowledge lint/diff 검사 PASS이며 knowledge lint에는 기존 역사 문서의 인코딩/검증일 경고 3개가 남습니다.\n`);
console.log(JSON.stringify({status:evidence.status,counts:evidence.counts,report:'_artifacts/entity-quality-20261012/QA-summary.json'}));
