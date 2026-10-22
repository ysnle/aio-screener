> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 남은 AI 채팅 어댑터 전문 감사

MODE: review | VERDICT: FAIL | REF: 7e2411432f6ca0e5f02528b209b013bf5f7ff2dc (v58.59)

FINDINGS: 4 actionable, 모두 고정 스냅샷에 이미 존재하는 결함이다. 제품 소스 수정·커밋·push·배포는 없었다. cstack review의 호출 경로·반례 확인 절차를 적용했다. INDEPENDENCE: 분담 리뷰의 한 담당자이며 같은 모델이므로 limited. 이 문서는 별도 모델의 독립 승인이 아니다.

## 전문 읽기 증빙

`js/aio-chat.js` 1–6183 전체를 고정 REF의 `git show`로 실제 읽었다. 최초 1–1000 결합 출력은 잘렸으므로 그 출력을 FULL 증빙으로 삼지 않았다. 다음 비잘림 출력 범위로 전 줄을 다시 덮었다: 1–263 / 264–609 / 610–759 / 760–947 / 948–1198 / 1199–1416 / 1417–1810 / 1810–2182 / 2183–2490 / 2490–2767 / 2768–3030 / 3031–3302 / 3303–3600 / 3601–3876 / 3877–4172 / 4173–4454 / 4455–4754 / 4755–5050 / 5051–5424 / 5425–5749 / 5750–6000 / 6001–6183.

- Git blob: `2fb565448b69851e8f5bcd8fc6e4192d9b83bb7c`.
- 원본 바이트: 453270; SHA256: `b52abcc16cfa72aec353c99116d70c1d529156f5bf012e4f163803830173f34f`.
- 현재 checkout은 읽기 중 v58.62 및 다수 dirty 변경으로 관측됐다. 어떤 제품 파일도 현재 checkout으로 대체하거나 되돌리지 않았다.
- 추가 추적: 고정 `js/aio-core.js:5061–5136`, `src/ai/policy/conduct.js` 전체. 후자는 import 없는 순수 ESM 원본을 data URL로 격리 실행했다.

## CHAT-1 [ACT ON][P2][PRE-EXISTING] 부정절 하나가 같은 문장의 명백한 매수 지시를 통과시킨다

위치: `js/aio-chat.js:551–558` (핵심 558). 호출 경로는 `chatSendUnified` 완료 콜백 6016 → `_aioRunAIResponsePipeline` 296 → `_aioApplyAIActionGate` 539이다. 현재 절 분리는 쉼표·세미콜론·그러나/하지만/다만만 사용하고, 분리된 절의 어느 곳에든 부정어가 있으면 그 절 전체를 지시 검사에서 제외한다.

measured: 실제 함수를 추출하여 `NVDA를 지금 매수하세요 그리고 손절하지 마세요.`를 넣으면 원문 그대로, `blocked:false`, `reasons:[]`로 나온다. `NVDA를 지금 매수하세요.` 대조군은 한 문장을 대체한다. `You should buy NVDA now.`도 그대로 통과한다. 실제 core의 `evaluateAIActionPermission`와 실제 ESM conduct 분류기를 이어 실행해도 첫 문장은 `blocked:false`, `actionLike:true`였다. 이 뒤 경계는 불법 실행·동의 없는 개인 포트폴리오 사용을 차단할 뿐 일반 매수 지시를 다시 제거하지 않는다. 모형이 이런 문자열을 실제 생성한 브라우저 증거는 없으며, 검증된 것은 공개 응답 경계의 누락이다.

영향: 긍정 지시와 부정 절을 자연스럽게 함께 쓰거나 영어로 답하면 소유자의 개별 매매 지시 금지 경계가 작동하지 않는다. 대안은 부정어를 해당 행동 동사에 결속하여 검사하고, 같은 절의 다른 행동까지 면제하지 않는 것이다. 한국어 연결절·영어의 명백한 지시와 과거 인용·교육 설명을 함께 회귀 검증해야 한다.

## CHAT-2 [ACT ON][P2][PRE-EXISTING] 실제 health 대기는 7.5초에 끝나 12초 모바일 복구 시간을 쓰지 못한다

위치: `js/aio-chat.js:1887`; 관련 1865–1867. 호출 경로는 `chatSendUnified` 5527 → `_aioEnsureClaudeRoute` → 12초 health fetch·1.2초 재시도 → 바깥 `_aioRunChatTask(timeoutMs:7500)`이다. 1865는 느린 모바일 연결 때문에 제한을 12초로 늘렸다고 설명하지만 바깥 제한이 먼저 실패한다.

measured: 실제 route/task/abort 함수와 타이머를 100:1로 축소하고, 전송만 외부 호출 없는 8.5초 응답 stub으로 바꿨다. 첫 await는 `RESEARCH_TIMEOUT`으로 실패했고 그 뒤 같은 health 요청은 정상 완료되어 cache `ok:true`가 됐다. fetch는 한 번뿐이었다. 연결이 7.5–12초 구간에 응답하면 질문의 첫 전송이 정상 Worker에도 실패하는 반례다.

대안: 대기 wrapper의 제한을 health의 실제 총 수명과 일치시키고, 8.5초 성공·실제 12초 초과·사용자 취소를 서로 다른 상태로 검증한다. 이 현상은 비용 ledger 우회가 아니다. generation 호출 전의 경로 가용성 문제다.

## CHAT-3 [ACT ON][P2][PRE-EXISTING] route 예외 안내 조건이 cleanup이 만든 abort를 읽어 항상 거짓이 된다

위치: `js/aio-chat.js:5531–5532`; cleanup 1573–1591. route 예외에서 `_isCurrentUnifiedRun()`이 참이면 `_releaseUnifiedRun()`을 먼저 실행한다. 이 함수는 1580–1581에서 정상 cleanup 이유 `completed`로 controller를 abort한다. 바로 다음 줄의 `!_uniSignal.aborted`는 따라서 거짓이다.

measured: 실제 `_aioReleaseChatRequest`와 실제 5530–5533 예외 분기를 동일 run/controller에 실행했다. cleanup 뒤 `signal.aborted:true`, 오류 안내 `_appendAIMsg` 호출 0을 확인했다. CHAT-2와 같은 타임아웃 또는 public-config 조회 예외의 활성 요청에서 발생한다. 질문은 보존되지만 사용자는 실패 이유 없이 전송이 아무 일도 하지 않은 것처럼 보게 된다. 사용자 취소라서 조용히 끝난 상태와 구별되지 않는다.

대안: cleanup 전에 사용자의 취소 여부를 보존하거나 오류 표시 여부를 판정한다. lifecycle 정리를 마친 뒤 보존한 판정으로 안내한다. 타임아웃은 안내 1회, 실제 사용자 취소는 안내 생략이라는 동작 검증이 적절하다. CHAT-2의 시간만 고쳐도 다른 route 예외에서 이 결함은 남는다.

## CHAT-4 [ACT ON][P2][PRE-EXISTING] 검증된 종가 claim의 기준일이 실제 답변 근거 패널에 전달되지 않는다

위치: `js/aio-chat.js:6043`; 생성 425–426, 소비 516–522. pipeline은 실제 게시한 claim으로 `closeBasisDates`와 `otherPublishedClaims`를 계산해 반환하지만 unified 완료 콜백의 `_aioAppendAIPublicDisclosure` 호출은 이 두 필드를 생략한다. `_aioBuildAIResponseDisclosure`는 evidence 배열에서 이를 재계산하지 않는다.

measured: 6043의 실제 호출문을 실행하여 production 인자 객체를 그대로 소비 함수에 넣었다. 반환 결과에 `closeBasisDates:['2026-10-20']`, `otherPublishedClaims:0`이 있어도 근거 패널은 `확인 필요 / 미확인 / 원천 확인 필요`다. 반환 필드를 전달한 대조군은 `종가 기준 근거 / 2026-10-20 종가 / 완료된 종가 기록`이다. 실제 browser DOM 및 유료 답변 생성은 실행하지 않았다.

영향: 답변이 검증된 종가만 인용해도 사용자에게 기준일이 없는 답변으로 잘못 표시되고, 날짜를 밝히려는 기존 계약이 실제 단일 채팅 경로에서 손실된다. 대안은 pipeline이 게시 claim으로 계산한 두 필드를 그대로 전달하는 것이다. 수집했으나 인용하지 않은 live quote가 종가 답변의 표지를 덮지 않는 대조군도 유지해야 한다.

## 구조·안전 경계 판단

확인한 좋은 경계: 요청별 citation 저장(72–98, 2024–2039), 취소 epoch로 stale 콜백 배제(1568–1570, 5992·6008), 실패한 research를 최신 근거로 승격하지 않는 상태(394–398, 6013–6015), 공용 Worker 단일 generation 목적지(1810–1818, 1981–1995), 근거와 출판 검증의 ESM 위임(179–261). 이 사실만으로 배포 서비스·Worker 비용 ledger·모든 모델 응답이 안전하다고 인증하지 않는다.

구조상 6183줄의 classic adapter가 공개 정책, 참조 자료 literal, 종목 데이터 조립, 재무 검색 화면, sidebar/AI 패널 lifecycle을 함께 소유한다. 이번의 구체적인 손실은 어댑터 경계에서 발생했다(출판 결과→표시 인자, network 수명→UI 정리). 막연한 전면 분할을 결함으로 계산하지 않았으며, 기존 ESM 계약과 실제 단일 호출부의 값 전달을 먼저 고치는 것이 작은 대안이다. HWM CIK A01은 기존 발견이어서 재등록하지 않았다.

## 실행 근거와 제한

실행: `node _artifacts/architecture-quality-audit-20261021-v5859/chat-probe-boundaries.mjs` → 모든 assert 통과. 결과는 `chat-probe-boundaries.json`에 고정 REF·SHA256과 함께 기록했다. 이 PASS는 결함 반례가 재현되었다는 뜻이며 제품 동작 PASS가 아니다. 실제 함수 원본을 실행하고 fetch·DOM 경계를 stub했으며 외부 호출·유료 AI 호출·producer 실행은 모두 0이다.

미검증: 실제 브라우저의 느린 모바일 연결, 유료 AI 생성 문자열, 배포 Worker의 월 예산·예약 정산·search 2회 상한. 정적/격리 함수 증거를 browser/live/비용 인증으로 승격하지 않았다.
