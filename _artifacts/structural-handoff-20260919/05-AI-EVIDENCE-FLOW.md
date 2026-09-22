# 05 — AI 답변의 근거·정책·공개 흐름

Astra 1차 설계 · Luna MAX 근거 조사 · v55.22→v56에서 동일 주요 경로 정적 확인. 실제 유료 공급자 호출·사용자 대화·자격증명은 사용하지 않았다. 아래 후보는 실행 반증 전까지 확정 서비스 사고로 다루지 않는다.

## A01 — 정책 정본과 실행 의미 맞추기

architecture/product-charter.json은 individualized action의 기본 BLOCKED와 적합성/현재근거 조건을 명시한다. createAIAnswerOrchestrator.execute는 actionPermission=false를 actionLimitations로 옮겨 legacyRunner를 실행한다. P1120 주석은 의도적인 완화라고 설명한다. 따라서 무조건 차단을 복구하는 처방부터 내리지 않는다.

W05-A: 교육적 분석, 개인화된 분석, 수치 시나리오, 주문/외부상태 변경을 분리한 decision table을 작성하고 charter/planner/renderer/tests가 같은 의미를 사용하게 한다. 사용자 질문에 대한 설명 허용과 외부 실행 허용은 다른 권한이다. 현재 제품 의도에 맞는 규칙을 정본화하고, 금지된 동작만 실행 경계에서 차단한다. 로그에 plan permission만 저장하고 결과는 다른 정책으로 공개되는 모순을 해소한다.

인수: 같은 질문을 chatSend/chatSendUnified 및 페이지별 진입으로 실행해 classification과 공개 수준 일치. 포트폴리오 데이터 동의와 개인화 분석 정책은 독립 검증한다. 사용자 지시 없이 외부 거래 기능을 새로 만들지 않는다.

## A02 — 검색 결과 존재와 근거 충분성을 구별

js/aio-chat.js의 research preparation은 externalEvidenceReady가 false이면 nativeFallbackRequired=true로 둔다. 두 chat 경로는 외부검색·native검색·스트리밍·최종claim검증을 별도로 조합한다. 부분 검색결과가 존재한다는 이유로 공개 guard가 느슨해지는 경로를 Luna가 후보로 지적했다. 전체 공급자 stream replay는 아직 하지 않았다.

W05-B: request별 상태를 planned→collecting→partial/sufficient→drafting→validated→published로 통일한다. 근거 payload가 있음과 질문의필수근거가충분함은 별도 boolean/state다. partial 상태에서는 진행상황과 검증된 범위만 공개하며 최종 주장문은 충분성/정책 검증을 통과한 단위로 내보낸다. 취소된 요청과 예전route의 stream은 새 화면에 합쳐지면 안 된다.

인수 fixture: 검색0건, 부분결과+native실패, timeout, 검색성공+출처날짜없음, 사용자검색해제, provider fallback, 취소후늦은chunk, 두질문연속. 실제 허용된 답변을 과도하게 막는지도 확인한다. 일반 설명 질문에 불필요한 실시간검색을 강제하지 않는다.

## A03 — source id와 주장 내용의 일치

claim ledger는 수치 identity/value/unit 일치를 검사하고 qualitative claim은 출처/시각/ID 연결을 확인한다. 이는 추적성의 기반이며 원문이 주장을 실제 지지한다는 검수와 다르다.

W05-C: claim type별로 관측사실/계산/인과해석/가설/시나리오를 분리한다. 숫자는 formula+operand evidence로, 요약은 실제문단/원문위치로, 인과해석은 기제와반대근거로 연결한다. 단순한 출처존재를 ‘검증완료’라고 표시하지 않는다. 전부 자동 entailment로 해결할 수 있다고 약속하지 않는다. 핵심 claim 표본과 모순 fixture를 사람 검수에 남긴다.

사용자 표시: 첫 답은 확인된결론과범위, 다음은이유, 그다음은결측/가설. 내부request id나정책코드를 길게 노출하기보다 ‘가격은9/18종가, 이번뉴스는제목만확인’처럼 의미를 말한다. 원문 링크는 해당 claim에서 바로 열 수 있어야 한다.

## 2026-09-21 추가 검증 — v56.01

Luna MAX가 실제 모듈과 공개 단계 helper를 합성 입력으로 실행했다. [입력·출력 요약](5601-chat-repros.json)은 공급자·브라우저 실행이 아니다.

**A04: claim 존재와 모든 문장 검증은 다르다.** `validateAnswerPlan`은 claim 하나가 있으면 untracked numeric prose 조건을 끈다. 다만 downstream `_aioStripUnverifiedCurrentNumericSentences`가 12%/15% 문장을 제거하므로, 그 숫자가 그대로 사용자에게 나온다고 단정하면 틀리다. 실제 renderer까지 통과한 합성 문장은 “A plain count moved from 17 to 19.”였다. 현재 정규식이 잡지 못하는 숫자는 남는다. 근거: `src/ai/response/claim-ledger.js:75`, `js/aio-chat.js:227–315`, `src/ai/response/renderer.js:12`.

설계: 수치 주장과 교육용 숫자·가정·단계 번호를 타입으로 구분한다. 현재 사실 수치는 typed claim에서만 렌더하고 자유문장은 해당 claim을 참조한다. 모든 숫자를 무조건 삭제하는 방식은 일반 설명을 훼손하므로 대안이 아니다. “근거 연결됨”과 “원문이 내용을 지지함”도 별도 상태다. 인수에는 올바른 claim 옆의 무관한 숫자, 단위 없는 건수, 한국어 수사, 범위/비교, 가정 숫자, 교육용 예제를 포함한다.

**A05: 요청별 출처 소유권 후보.** native citation/error가 전역 `_aioLastClaudeCitations` 등에 저장되고 두 chat 진입점에서 소비된다(`aio-chat.js:2210`, `6811`, `9017`). evidence floor는 URL의 도메인·출처 개수를 확인하며 요청/질문 일치를 검증하지 않는다. 다른 질문의 가상 SEC URL 하나를 넘기는 합성 실행은 ready를 반환했다. 실제 동시 요청에서 출처가 섞이는 현상은 아직 재현하지 않았다.

설계: provider 응답의 citation을 `requestId/queryId/entity/asOf`에 묶고 불변 request context로 전달한다. 공식 도메인이라는 이유만으로 질문 충족으로 승격하지 않는다. 취소/재시도/늦은 응답이 다른 요청 상태를 변경하지 못하게 한다. 두 질문의 완료 순서를 뒤집는 fixture와 classic/unified 교차 실행으로 후보를 확정 또는 기각한다. 사용자에게는 “검색 완료” 대신 질문에 필요한 근거 중 확보/누락된 항목을 보여준다.

**A06: 행동 제한 전달 불일치.** “나에게 MSFT 매수 추천해줘”는 새 taxonomy에서 개인화 요청이고 permission은 profile/current evidence 부족을 반환한다. orchestrator가 전달하는 `actionLimitations`를 chat 공개 단계는 소비하지 않으며, 별도 conduct 분류기는 같은 표현을 personalized=false로 분류한다. 이는 분류·상태 전달 차이의 합성/정적 근거이며 실제 모델이 부적합한 답변을 했다는 재현은 아니다.

설계: 질문 분류와 행동 허용 상태를 하나의 request policy 결과로 공유한다. 답변은 확보한 관측, 비교 가능한 조건부 시나리오, 적용에 필요한 미확인 조건을 구분한다. 허용된 교육·일반 분석을 포괄 차단하지 않는다. 동일 요청을 두 진입점에 넣어 limitation과 최종 표현이 같은지, profile/evidence가 일부만 있을 때 제한이 사라지지 않는지 검증한다.

## 구조 분리 순서

legacy chat 두 진입점의 실행순서를 먼저 기록하고 공통 request state/evidence gate를 추출한다. transport/provider adapter와 policy/evidence/presentation 소유권을 분리한다. 파일 분할 자체를 목표로 삼아 같은 guard를 양쪽에 복제하지 않는다. 기존 사용자 흐름을 고정한 replay fixture가 준비된 다음 compatibility wrapper를 줄인다.

미검증: 실제모델환각률, 공급자품질/가용성, 모든claim의원문일치, prompt injection 전수, 사용자자료전송전체, 비용/지연/취소통계. 이 패키지는 AI 기능 전체 인증이 아니다.
