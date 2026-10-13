// v57.53 automation coverage records (P1731-P1737) for scripts/record-fix.mjs.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const note = 'v57.53 수동 데이터 자동화·만료 감시(공식 일정·연준 금리·웹검색 검증 lane·휴장일·만료 레지스트리) 반영(P1731~P1737).';
const base = { version: 'v57.53', date: '2026-10-13', r: null, status: null, note, qa_section: '검증 스킬' };
const e = (id, title, symptom, root_cause, fix, violated_rule, prevention, verification, changelog) => ({ p: { id, title, symptom, root_cause, fix, violated_rule, prevention, verification }, changelog });
const entries = [
  e(1731, 'FOMC 회의 일정이 손으로 적은 표(12/9까지)뿐이라 다음 해 일정·일정 변경이 반영되지 않음',
    '화면 일정의 FOMC 행이 2026-12-09에서 끝났고 SEP 표시는 고정값이었다.', 'AIO_MACRO_OFFICIAL_SCHEDULES의 us-fomc가 수동 목록이었고 생산 경로가 없었다.',
    'scripts/lib/official-calendars.mjs가 연준 공식 FOMC 일정 페이지를 12시간마다 읽어 올해·내년 회의(결정일·시작일·SEP)를 macro-calendar.json schedules·events·meta에 싣는다. 올해 8회·SEP 4회·오름차순 등 검사를 통과하지 못하면 직전 일정을 stale로 유지(fail-closed). 브라우저는 fomcStatus ok일 때만 해당 연도 날짜를 교체한다.',
    '수동 값 자동화 / fail-closed', 'P1731: ci-data-pipeline-contract-check(파서 fixture 6건)·ci-artifact-semantics-check', '실제 페이지: 2026 8회(SEP 4), 2027 8회 파싱, 수동 값과 일치.',
    '**FOMC 일정 자동 수집 (P1731):** 연준 공식 일정 페이지에서 올해·내년 회의와 경제전망 발표 회의를 자동으로 가져오고, 구조가 바뀌면 직전 일정을 유지한다.'),
  e(1732, '연준 정책금리 범위가 문자열 "3.75-4.00%"로 하드코딩돼 다음 FOMC 이후 낡음',
    '브리핑·일정·대시보드가 수동 문자열을 현재 범위로 표시했다.', 'FRED DFEDTARL/DFEDTARU를 수집하면서도 화면 범위는 수동 레지스트리에서 읽었다.',
    'data.json policyRates.fed{lower,upper,asOf,status}를 FRED 상·하단에서 파생(날짜 불일치·폭 이상·5일 초과는 stale)하고, AIO.getFedPolicyRange가 current 산출물 → FRED 스냅샷 → 기한 내 수동 → 보류 순으로 읽는다.',
    '수동 값 자동화', 'P1732: ci-data-pipeline-contract-check·ci-runtime-contract-check(P1275/P1737)', '현재 데이터: 3.75–4.00, asOf 10/12, current.',
    '**연준 금리 범위 자동화 (P1732):** 정책금리 범위를 수집 중인 FRED 상·하단에서 계산해 FOMC 결정이 바뀌면 다음 갱신에 반영한다.'),
  e(1733, 'ISM PMI 발표일이 수동 목록(12월까지)뿐', 'ISM 일정이 12/1·12/3 이후 비어 있었다.', 'ISM 공식 달력은 로그인이 필요해 수동 입력했다.',
    'ISM 공표 규칙(제조업 첫 영업일, 서비스업 세 번째 영업일, 1월은 두 번째·네 번째, 연방 공휴일 제외)으로 다음 12개월 일정을 계산해 macro-calendar.json에 싣는다.',
    '공표 규칙 기반 계산', 'P1733: ci-data-pipeline-contract-check', '수동 2026년 7–12월 12개 날짜와 일치.',
    '**ISM 발표 일정 자동 계산 (P1733):** ISM 공표 규칙으로 다음 12개월 제조업·서비스업 PMI 일정을 만든다.'),
  e(1734, '한은 기준금리·한국 CPI·수출 잠정치·NAAIM이 운영자 수동 웹검색 스냅샷(8/21)에 멈춤',
    '수출 잠정치는 7/13, NAAIM은 7/22 값이 표시됐다.', 'refresh-web-research.mjs가 고정 CHECKED_AT 스냅샷을 다시 쓰는 수동 스크립트였다.',
    'refresh-data에 자동 lane을 넣었다: 공용 Worker AI 웹검색(공식 도메인만, low context)으로 값·날짜·출처 URL 후보를 받고, 스크립트가 그 공식 페이지를 직접 가져와 본문에서 값·날짜·라벨을 확인한 것만 official-references.json에 verified로 발행한다. 실패하면 직전 검증값을 stale로 유지. 발표일이 지난 항목만 하루 1회, 아니면 30일 재확인, 월 40회 상한. NAAIM은 공식 페이지가 날짜 없는 지연값만 보여 검증 불가 → 퇴역.',
    '모델 요약값 발행 금지 / 공식 원천 대조', 'P1734: ci-official-references-check(약 45 단언)·worker/openai-contract.test.mjs', '실제 페이지 fixture: 한은 3.00%(8/27)·다음 10/22 verified, 이웃 행 2.75 거부, 관세청 7월 잠정치 verified.',
    '**공식 참고값 자동 수집 (P1734):** 한은 기준금리·다음 금통위, 한국 CPI, 수출 잠정치를 AI 웹검색으로 찾고 공식 페이지 본문에서 직접 확인한 값만 발행한다. 검증할 수 없는 NAAIM은 화면에서 뺐다.'),
  e(1735, '휴장일 표가 세 곳에 따로 있고 브리핑 일정 표는 2026년만 있음', '2027년 이후 브리핑 일정의 휴장일이 비게 돼 있었다.',
    'market-calendar.js·aio-core.js DATE_ENGINE·schedule.js가 각자 표를 가졌다.',
    'schedule.js의 별도 표를 없애 market-calendar.js 레지스트리(2026·2027 이름표)를 쓰게 하고, classic 부팅 순서 때문에 남는 aio-core.js 사본은 동일성 gate로 고정했다.', '단일 원천', 'P1735: ci-market-session-contract-check', 'fixture: 연말연시·2027 추석 행 표시.',
    '**휴장일 원천 통일 (P1735):** 브리핑 일정이 시장 달력 레지스트리를 쓰고 2027년 휴장일을 반영한다.'),
  e(1736, '남은 수동 값이 조용히 낡아도 화면은 현재 값처럼 표시', '수출 잠정치 7/13, 금통위 일정 하드코딩(10/16·11/27, 공식은 10/22·11/26) 등이 현재처럼 보였다.',
    '수동 값에 기한이 없었고 만료를 감시하는 곳이 없었다.',
    '모든 수동 참조 값·일정 행·휴장일 표에 asOf와 만료 기준을 단 레지스트리(18항목)를 두고, 만료 시 화면은 \'기한 지남\'으로 보류(hover에 기준·기한), data-watchdog가 이슈를 하나 열고 해소되면 닫으며, 신규 gate가 기한 누락·만료를 잡는다. getNextBOK 하드코딩 날짜를 공식 일정 읽기로 바꿨다.',
    '만료된 값을 현재처럼 보이지 않게', 'P1736: ci-manual-reference-expiry-check(구조 검사 + fixture 11종)', 'headless 1146/1146 PASS. 오늘 만료: 수출 잠정치 1건.',
    '**수동 값 만료 감시 (P1736):** 남은 수동 값마다 기준일과 기한을 두어, 기한이 지나면 화면이 \'기한 지남\'으로 표시하고 감시 워크플로가 이슈를 연다.'),
  e(1737, '자동 산출물이 생겨도 화면이 수동 값을 읽음', '화면 FOMC·ISM·연준 범위·한은·CPI·수출이 수동 레지스트리를 읽었다.', '소비처가 새 산출물을 읽지 않았다.',
    'mergeProducedMacroCalendar로 FOMC(ok일 때 연도 교체)·ISM(산출 달 교체)·FRED(합집합)를 반영하고, SEP 표시는 공식 이벤트에서만, policyRates.fed와 official-references.json(verified만 대체)을 로드한다. 산출물이 없거나 검증 전이면 수동 값을 기한과 함께 표시한다.',
    '자동 원천 우선', 'P1737: ci-manual-reference-expiry-check·ci-runtime-contract-check·aio-tests T684/T884', 'fixture: verified 대체, unverified 미대체·만료 시 보류.',
    '**화면이 자동 원천을 우선 사용 (P1737):** FOMC·ISM 일정, 연준 금리, 한은·물가·수출 값을 자동 산출물에서 먼저 읽고, 없으면 수동 값을 기한과 함께 보여 준다.')
];
const qa = [{
  id: 'QA-VERIFY-20',
  text: 'P1731~P1737: 배포 후 refresh-data에서 macro-calendar.json meta.fomcStatus=ok·us-fomc 16개, data.json policyRates.fed.status=current, official-references.json에 bokBaseRate·krCpi·krExports가 verified 또는 stale(원인 기재)로 발행되고 lane.callsThisMonth가 상한 안이며, data-watchdog manual-reference-expiry 이슈가 만료 항목만 연다.',
  verify_by: 'push 뒤 refresh-data 2회·data-watchdog 1회 후 산출물·이슈 확인',
  done: false
}];
entries.forEach((entry, index) => {
  const record = { ...base, p: entry.p, qa: index === entries.length - 1 ? qa : [], changelog: [entry.changelog] };
  writeFileSync(join(here, `record-p${entry.p.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
});
console.log(`wrote ${entries.length} records`);
