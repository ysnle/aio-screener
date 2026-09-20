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

## 구조 분리 순서

legacy chat 두 진입점의 실행순서를 먼저 기록하고 공통 request state/evidence gate를 추출한다. transport/provider adapter와 policy/evidence/presentation 소유권을 분리한다. 파일 분할 자체를 목표로 삼아 같은 guard를 양쪽에 복제하지 않는다. 기존 사용자 흐름을 고정한 replay fixture가 준비된 다음 compatibility wrapper를 줄인다.

미검증: 실제모델환각률, 공급자품질/가용성, 모든claim의원문일치, prompt injection 전수, 사용자자료전송전체, 비용/지연/취소통계. 이 패키지는 AI 기능 전체 인증이 아니다.
