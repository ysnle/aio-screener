# 잔여 source 보안·예산 전문 감사

MODE: review | VERDICT: FAIL(검토 경계에 기존 보완 2건), 제품 안전 전체 판정 아님 | REF: `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc`

확인된 보완 2건(기존 D4 실행 재확인 1건, publication 경계 1건). 제품 수정·Git 변경·외부 요청·실제 AI·producer 실행 없음. cstack review 및 review-rubric의 correctness/security/concurrency 기준으로 검토했다. 이 문서는 단일 담당자의 독립된 보안 렌즈이며 모델 간 독립 합의는 없다(`independence: limited`). 주 담당자의 통합 재검토가 남는다.

## 읽기·기준

지정 7개 파일 합계 2,802행(마지막 LF 뒤 빈 행 포함)을 전문 읽었다. `security-reading.tsv`에 고정 blob SHA256과 범위를 기록했다. 검토 시점 HEAD는 `659ffbad252f9eeacfa49a6ad1b895df87f66597`였으며 지정 7개 파일의 현행 바이트 SHA256은 모두 고정 REF와 같다. 현행 전체 diff가 필요한 변경 파일은 이 7개 중 0개다. 저장소의 다른 dirty 변경은 검토 범위 밖이며 그대로 두었다.

추가 caller는 `js/aio-chat.js:180-451,539-569`, `js/aio-core.js:5064-5140`, `src/ai/orchestrator/question-planner.js`의 classify 연결 및 `src/app/bootstrap.js`, `src/legacy/compatibility-facade.js`의 export 연결을 필요한 부분만 추적했다. 이 caller 파일을 FULL로 승격하지 않는다. publication 실행 fixture는 현행 chat 함수의 발췌 실행이며 고정 source 전체 chat 인증이 아니다.

## 확인된 보완

### SEC01 — [PRE-EXISTING][medium] D4 릴레이의 본문 수신 실패가 공급자 호출 카운트를 반환한다

위치: `cloudflare-worker-proxy.js:1355-1396`, 특히 `1394`; DO release `1061-1086`.

실제 호출 경로: `default.fetch('/relay') → handleRelay → quotaRpc('reserve') → fetchUpstream → readUpstreamText → catch → releaseQuota → mutateQuota('release')`. 숫자형 relay reservation에는 AI의 `started` 보존 조건이 없다. 공급자가 요청을 받은 뒤 본문 스트림을 끊으면 일일 사용이 0으로 돌아간다.

실행 증거: fake BOK key, `RELAY_DAILY_CAP=1`, 허용 Origin을 사용하고 모든 fetch를 검증된 fixture로 대체했다. 매 요청에서 첫 JSON 조각 뒤 stream error를 냈다. **응답 `[502,502,502]`, 공급자 fetch 3회, persisted day count 0**. [원시 결과](./security-probe-boundaries.json)의 `relay`, [재실행 helper](./security-probe-boundaries.mjs)를 따른다. 기존 D4의 정적 미재검증 상태를 이 조건에서 실행 재확인으로 보강한다.

반론·범위: 분당 limiter는 남아 있으며 BOK/KOSIS 일일 공급자 호출 원장이다. **OpenAI 공유 월 $20 원장을 우회한 증거가 아니다.** timeout·oversize도 동일 catch로 흘러가는 것은 정적 확인이며 본문 중단 조건만 실행했다.

최소 대안: fetch 발송 시작 이후의 불확실한 오류는 카운트를 유지한다. 사전 구성/검증 실패만 반환한다. 정상 4xx/5xx·HTML 응답에서 이미 사용하는 유지 의미와 일치시킨다.

### SEC02 — [PRE-EXISTING][medium] 비구조 fallback은 무근거 현재 사건 제거를 건너뛴다

위치: `src/ai/response/publication.js:127-141` 대 `221-230`; caller `js/aio-chat.js:287-292,386-398`.

조건: currentSensitive=true, 게시할 evidence 0개, answer-plan 파싱 실패/비구조 응답. `extractAnswerFallback`은 숫자 제거만 하고 현재 사건 제거 함수를 호출하지 않는다. 같은 비수치 사실 문장이라도 유효 plan이면 제거되고 비구조 fallback이면 남는다. 생성 모델의 형식 실패가 정직성 경계를 약하게 만든다.

실행 증거: `'연준이 금리를 인하했고 신용 스트레스도 해소됐다.'`를 동일 조건으로 넣었을 때 `buildPublishableAnswerPlan(...,[],true)`의 summary는 빈 문자열, `extractAnswerFallback(...,true)`는 원문이다. 실제 `_aioRunAIResponsePipeline`와 `_aioApplyAIActionGate`를 VM에서 발췌 실행하고 parser/evidence 경계를 명시 fixture로 제어했을 때 사건 문장이 안내 뒤 그대로 반환됐다(`blocked:false`). [원시 결과](./security-probe-boundaries.json)의 `publication`을 따른다.

증거 한계: 이 VM은 전체 앱·실제 모델·브라우저 실행이 아니다. action gate는 실제 함수이며 parser는 비구조 결과, evidence 수집은 빈 목록, claim/conduct 전역은 미설치로 제어했다. 실제 caller 정적 경로에서 claimAudit의 blocked는 전체 차단 대신 안내로 바뀌며, conduct 검사는 거래/금지행위 경계여서 해당 일반 시장 사건을 검증하지 않는다. 따라서 확정된 사실은 publication helper의 불일치와 제어된 실제 pipeline 반환이다. 실제 서비스에서 해당 모델 문장이 생성됐다는 주장은 하지 않는다.

반론·대안: currentSensitive=false인 교육 질문, 정상 plan, 사건을 만들지 않는 응답에는 이 반례가 적용되지 않는다. fallback에 현재 사건 제거를 evidence 유무와 함께 적용하되 역사·일반 설명·조건은 보존한다. parser 성공/실패 양쪽에 같은 문장을 넣는 대조가 최소 회귀 확인이다. 기존 A15(매매 지시 필터)와 다른 원인이며 재등록하지 않는다.

## 유지 확인·반례 기각

1. **[NOTED] OpenAI 원자 입장·발송·정산 경계:** `mutateQuota`의 `blockConcurrencyWhile` 안에서 월/일/연결 cap과 예약을 갱신한다(`939-1113`). duplicate reserve는 upstream 재호출 전 409가 된다(`1200`). 발송 시작 뒤 release는 보존하며 valid receipt만 차액 반환한다(`1067-1108`). late receipt는 원래 월을 정산한다. 계약 fixture의 동시·재시작·취소·중복·rollover 검증을 실행했다. 실제 Cloudflare DO 서비스의 일관성·장애 복구를 실측한 것은 아니다.

2. **[NOTED] 인증/Origin:** `/openai`는 허용 Origin(+설정 시 app token) 또는 Origin 없는 32자 이상 automation token을 요구한다(`1255-1259`). `/_ops/ai-usage`는 별도 operator token을 먼저 확인하고 미인증 404, no-store, CORS 없음(`561-594`). Workers AI 번역도 automation token을 먼저 확인한다(`1418-1423`). Origin과 배포된 public app token을 사용자 인증으로 취급하지 않는 소스 주석이 정확하다. spoofable Origin 자체를 새 취약점으로 보고하지 않는다. Secrets 실물·live 인증은 미검증이다.

3. **[NOTED] usage 단위·검색 cap·실패 의미:** micro-USD 정수로 월 최대 20,000,000을 검증한다(`openai-budget.mjs:43-49`). 요청 max_tool_calls는 최대 2, mixed tools와 확장 입력은 거부한다(`89-122`). receipt input/output/total 정수·합계·상한·model·tier를 검증하고 reasoning을 output에 중복 가산하지 않는다(`156-178`). malformed/failed/cancelled/과한 receipt는 원래 예약을 유지한다. SSE 본문이 끝날 때까지 deadline/cancel을 연결하고 검증된 terminal receipt만 정산한다(`proxy:731-803`, `openai-usage.mjs:1-54`). 계약 fixture가 이 분기들을 통과했다. 오류 안내가 청구 없음/환불을 뜻하지 않는다.

4. **[NOTED][UNPROVEN] 공급자 청구의 절대 상한:** 검색 content 32k/64k allowance는 소스가 스스로 정책 추정량이라고 명시한다(`openai-budget.mjs:15-20`). receipt가 상한을 넘으면 정산 거부로 예약을 보존하지만 이미 발생한 실제 청구를 되돌릴 수는 없다. 따라서 로컬 원장 admission cap 통과를 계정 청구 $20 보장으로 승격할 수 없다. 최신 공급자 가격/검색 과금 계약, 별도 호출 여부, provider project 실청구는 외부·계정 접근 금지 범위라 확인하지 않았다. 이것은 새 청구 초과 재현이 아니라 기존 잔여 한계의 명시다. Workers AI 번역은 별도 서비스 원장/요금 경계이고 OpenAI 원장 검증으로 인증되지 않는다.

## 실행 기록과 남은 검증

- `node _artifacts/architecture-quality-audit/reviews/remaining-20261022/security-probe-boundaries.mjs` → 지정 파일 SHA 동일, SEC01·SEC02 대조 관측. helper 종료 0은 제품 정상 PASS가 아니다.
- `node --input-type=module -e "globalThis.fetch = async () => { throw new Error('NETWORK DENIED'); }; await import('./worker/openai-contract.test.mjs');"` → **158 assertions PASS**, [로그](./security-probe-contract.log). 전문을 먼저 읽어 imports는 로컬 3모듈뿐이며 실제 외부 fetch 전에 test의 exact URL stub이 설치됨을 확인했다. 추가 deny guard를 import 전 설치했다. HTTP 호출·유료 요청 0회.
- 지정 제품 파일 수정 0, commit/push/deploy 0. 계정 청구·현행 Secrets·실서비스 인증/취소/region·브라우저 표시는 미검증이다. 보고서/TSV/helper 외 파일을 수정하지 않았다.

우선 후속은 D4의 dispatch 이후 카운트 보존과 publication fallback/정상 plan의 동일 정직성 처리를 주 담당자가 재검토하는 것이다.
