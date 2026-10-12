import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const dir = '_artifacts/entity-quality-20261012';
const entries = [
  [1624, '종목 첫 진입 자료 연결과 기업 분석 공통 구조', '가격 이력은 차트 탭을 먼저 열어야 채워졌고 기업 정체성·사업 정보와 손익 비교가 불완전했다.', '종목 요약이 캐시만 읽고 독립적인 자료 요청·기업 분석 계약이 없었다. 수익률 막대는 부호를 방향에 반영하지 않았다.', '모든 종목에 취소 가능한 공통 가격·일봉 요청, 출처·시점·통화 계약과 기업 분석 모델을 적용한다. 사업 설명은 issuer identity와 출처가 있는 자료만 연결한다. 예시 종목 전용 사업 설명을 하드코딩하지 않는다. 수익률은 공통 0선에서 부호에 따라 방향을 나눈다.', 'entity-summary', 'scripts/ci-entity-summary-fixture.mjs'],
  [1625, '시장별 순위 모집단과 선택 정렬의 일치', '미국·한국 종목이 섞이고 프리셋과 다른 균형 정렬이 적용되어 강한 종목을 발견하기 어려웠다.', '필터 이전에 글로벌 팩터 순위를 계산하고 UI가 프리셋 결과를 복합 순위로 재정렬했다.', '시장별 팩터 모집단과 US/KR 화면 선택을 일치시키고 프리셋 순서를 유지한다. 추세·3개월 수익률·균형 등 정렬을 명시하고 통화와 실제 활성 비중을 표시한다. 모집단 정책을 모델 지문에 포함해 이전 성과를 현재 검증으로 제시하지 않는다.', 'screener-market', 'scripts/ci-screener-market-fixture.mjs'],
  [1626, '차트 조건부 흐름과 거래량 가격대의 근거 계약', '차트 현재 상태만 제시하고 이후 확인할 조건과 계산 방법이 부족했다. 한국 종목에도 미국 벤치마크가 적용되었다.', '조건부 상태 변화 모델과 가격대 거래량 정의가 없고 60봉 이력을 6개월로 계산했다.', '관측한 고저점·피벗에서 회복/범위/약화 조건을 파생한다. 일봉 거래량을 관측 가격 범위에 균등 배분한 추정치를 실제 체결 매물대와 구분한다. 127봉 미만 6개월 수익률을 보류하고 한국 기준 지수를 연결한다. AI 문맥은 같은 issuer의 화면 근거를 공유한다.', 'chart-scenarios', 'scripts/ci-chart-scenarios-fixture.mjs'],
  [1627, '재무 손실 방향과 동일 회계기간 원본 정밀도', '손실이 양수 방향으로 그려지고 재무 흐름과 공시 기본 보고의 이익률·성장률이 달랐다. 금액표와 누락 항목 설명이 부족했다.', 'compact 이력이 USD 백만 정수로 반올림되고 회계기간·issuer 계약 없이 원본과 비교했다. 양수 막대만 설계되어 손실 방향이 없었다.', '손실은 공통 0선 아래에 표시한다. 같은 issuer/FY 원본만 정밀값으로 조정하고 연간 간격을 확인한다. 연간/분기 금액 및 현금흐름·부채·주식수 표를 추가하고 누락 자료와 실제 공시 링크를 표시한다. producer 코드의 금액 정밀도를 개선하되 로컬 생산이나 생성물 변경은 하지 않는다.', 'fiscal-quality', 'scripts/ci-fiscal-quality-fixture.mjs']
];
for (const [id,title,symptom,root_cause,fix,slug,script] of process.argv.includes('--gates-only') ? [] : entries) {
  const path = `${dir}/record-${slug}.json`;
  const entry = { version:'v57.40', date:'2026-10-12', p:{id,title,symptom,root_cause,fix, violated_rule:'종목 identity·관측 기준·원본 단위 보존; R670 완료 종가 비교', prevention:`{P}: ${script}와 ci-entity-quality-browser-check.mjs에서 공통 모델과 실제 화면 경로를 검증한다.`, verification:'로컬 회귀 및 실제 경로 브라우저 검증을 진행한다. 유료 AI·현재 외부 시세·실기기·배포 증거와 구분한다.'}, r:null, qa:[{id:`QA-${slug.toUpperCase()}-01`, text:`{P}: ${title} 공통 경로와 화면 회귀 확인.`, verify_by:`node ${script}; node scripts/ci-entity-quality-browser-check.mjs`, done:false}], qa_section:'종목 분석 구조·시장 분리', changelog:[`**${title} ({P}):** ${fix}`], note:'전체 종목 요약·기업 분석·시장별 스크리너·조건부 차트·정밀 재무 개선. 로컬 검증 진행; commit/push/deploy 미실행.', status:null };
  writeFileSync(path, JSON.stringify(entry,null,2)+'\n');
  const result = spawnSync(process.execPath,['scripts/record-fix.mjs',path],{encoding:'utf8'});
  console.log(result.stdout); if(result.status) { console.error(result.stderr); process.exit(result.status); }
}
const file = 'architecture/qa-pipeline.json';
const pipeline = JSON.parse(readFileSync(file,'utf8'));
for (const [, , , , ,slug,script] of entries) if (!pipeline.groups.core.gates.some(g=>g.id===`${slug}-fixture`)) pipeline.groups.core.gates.push({id:`${slug}-fixture`,script});
if (!pipeline.groups.core.gates.some(g=>g.id==='company-analysis-fixture')) pipeline.groups.core.gates.push({id:'company-analysis-fixture',script:'scripts/ci-company-analysis-fixture.mjs'});
if (!pipeline.groups['browser-viewport'].gates.some(g=>g.id==='browser-entity-quality')) pipeline.groups['browser-viewport'].gates.push({id:'browser-entity-quality',script:'scripts/ci-entity-quality-browser-check.mjs',timeoutMs:300000});
writeFileSync(file,JSON.stringify(pipeline,null,2)+'\n');
