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

## 2026-09-23 현재 상태와 요청 경계 명세

| 발견 | 최신 상태 | 닫힌 범위 | 남은 인수 |
|---|---|---|---|
| A01 | **조사/인수 대기** | charter의 기본 action 제한 및 기존 `actionLimitations` 존재가 확인됐다. | 정책 정본·실행·최종 공개가 같은 결정을 공유하는 구현/양 entrypoint fixture가 없다. P1172 residual도 미착수로 둔다. |
| A04 | **부분** | P1172는 텍스트 claim 하나로 수치 검사가 해제되는 것을 막고, numeric claim만 조건을 해제하도록 했다. contract CI가 있다. | 자유 문장 안 각 숫자의 claim binding, 한국어 수사/범위/단위 없는 숫자/가정 예시 분리, 실제 응답 공개 인수는 미완료다. |
| A05 | **부분** | P1172가 evidence request/entity binding과 mismatch 차단을 추가했다. | UNBOUND/UNVERIFIABLE은 표시만 하며 통과를 막지 않을 수 있고, reverse-order·classic/unified 교차 요청·실제 provider 답변은 미검증이다. |
| A06 | **열림** | 두 분류기가 같은 표현에 다른 intent를 줄 수 있고 downstream이 `actionLimitations`를 다시 소비하지 않는 현재 정적 경로가 기록됐다. | 두 chat 진입점의 행동 분류와 최종 응답 적용을 고정한 회귀 fixture가 없다. P1172도 이를 미착수로 명시한다. |

A01–A06의 상위 현재성, 포함 관계, E6 의존 순서는 [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md)와 [26](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)를 정본으로 한다. A01–A03은 서비스 사고 확정이 아니라 조사/인수 대기이며 A04/A05의 P1172 부분 구현은 나머지 claim semantics나 동시 요청 안전성을 완료 처리하지 않는다.

### 하나의 request decision envelope

두 chat entrypoint는 같은 불변 envelope를 만들고, planner·retriever·stream handler·publication guard는 이 envelope만 전달받는다. UI/legacy facade가 intent나 action permission을 다시 계산하지 않는다.

```ts
type AIRequestDecision = {
  contractVersion: 1;
  requestId: string;
  queryId: string;
  entityRefs: string[];
  intent: 'education' | 'general_analysis' | 'personalized_analysis' | 'scenario' | 'external_action';
  permission: 'allowed' | 'limited' | 'blocked';
  actionLimitations: string[];      // authoritative; never rebuilt downstream
  evidenceRequirements: string[];
  requestedAt: string;
  status: 'planned' | 'collecting' | 'partial' | 'sufficient' | 'drafting' | 'validated' | 'published' | 'cancelled' | 'failed';
};
```

`intent`는 사용자의 요청 유형이고 `permission`은 현재 profile/evidence/policy로 허용되는 범위다. 둘을 같은 boolean으로 줄이지 않는다. 주문/외부 변경을 위한 권한과 설명을 위한 분석 권한은 분리한다. 화면 공개는 `requestId`와 `AIRequestDecision`이 같고, status가 `validated` 이상이며 각 노출 claim이 정책·evidence guard를 통과한 경우에만 허용한다. blocked/limited 응답도 왜 제한됐는지, 어떤 비행동 정보는 제공 가능한지 설명할 수 있다.

각 numeric claim은 `claimId`, `claimType`, `value`, `unit`, `period`, `entity`, `evidenceIds`, `formulaId`(계산값인 경우)를 가진다. 문장 segment는 직접 `claimIds`를 참조한다. education/example/assumption 숫자는 UI에 예시라고 표시하고 현재 관측 claim으로 오인되지 않아야 한다. “출처에 연결됨”과 “원문이 이 문장을 지지한다고 확인됨”을 서로 다른 claim 상태로 둔다.

### 최소 반증 집합과 화면 의미

| Fixture | 필수 변형 | 기대 공개 |
|---|---|---|
| `A01-policy-matrix` | 일반 설명, 개인화 매수 추천, 수치 시나리오, 주문/외부 행동을 classic/unified 양쪽에 전달 | 같은 request decision·permission·limitation·최종 표현. 일반 교육은 허용된 범위에서 불필요하게 차단되지 않는다. |
| `A04-numeric-binding` | 올바른 numeric claim 옆 무관한 숫자, unit/period 불일치, 교육 예시, 한국어 수사/범위 | claim이 없는 current-sensitive 숫자는 공개되지 않고, 예시 숫자는 관측값과 다른 스타일/label을 가진다. |
| `A05-reverse-order` | 질문 A/B를 시작하고 완료 순서를 뒤집음, 취소 후 늦은 chunk, retry, 다른 entity/query citation, unbound citation | citation/evidence는 자신의 `requestId/queryId/entity`에만 결속한다. 불일치는 차단, 미확인은 화면에 그 상태 그대로 남긴다. |
| `A06-limitation-propagation` | profile/evidence 모두 있음·하나만 있음·둘 다 없음, classic/unified, legacy direct call | 공개 guard는 같은 authoritative `actionLimitations`를 사용한다. 일부 필드 부재로 제한이 사라지지 않는다. |
| `AI-zero-partial-failed` | 검색 0건, 부분 결과, native fallback 실패, timeout, 사용자가 검색 해제 | `검색 안 함/검색 결과 없음/부분 근거/검색 실패/제한된 답변`을 혼동하지 않는다. |

사용자에게는 내부 policy code 대신 `확인한 자료`, `아직 연결되지 않은 자료`, `이 답변이 할 수 있는 범위`를 질의 맥락과 함께 제시한다. 빈 citation 목록을 “근거 없음”으로, citation 하나를 “검증 완료”로 부르지 않는다.

### Cutover, rollback, 증거 한계

먼저 두 chat 진입점의 이벤트/취소/stream 순서를 기록한다. 새 envelope와 validation은 shadow compare로 도입하고, 답변 내용은 기존 publication path를 유지한 상태에서 불일치 로그만 검토한다. 양쪽 경로와 reverse-order fixture를 통과하면 request 단위로 한 guard를 켜며 두 guard를 동시 공개 경계로 두지 않는다. schema 변화는 optional/additive부터 배포하고, 구버전 citation은 `UNBOUND`로 downgrade한다. 회귀 시 안전한 동작은 광범위 차단이 아니라 기존 허용 정책으로 복귀하되 actionLimitations를 지우지 않는 것이다. 이전 request의 citation이나 검증 안 된 답변을 재사용하지 않는다.

이 문서의 P1172 증거는 합성 모듈/contract gate 수준이다. 사용자 영향에 대한 완료 선언에는 raw model output을 안전하게 비식별한 trace, query와 claim 매핑, 공개 전·후 결과, browser 화면, cancellation/ordering evidence가 필요하다. 실제 provider/model 품질, 데이터 전송·비용·지연, 권리 확인은 별도 인수다.
