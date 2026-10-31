# PASS11 — AI 맥락·응답 공개·행동 경계·사용 기록

2026-10-28 / cstack review / v59.42 작업 트리 / 직접 판독, 에이전트 없음.
Important 0 · Pre-existing 3. 아래 첫 건은 기존 AI-01 계열의 남은 별도 경로다. 기존 문제와 합산할 때 독립 근본 원인으로 중복 계산하지 않는다. 제품 수정·외부 AI 호출·배포 없음. 전체 파일 전수 감사는 미완료다.

## P11-AI-01 — text claim은 출처·날짜만 같으면 사건 내용이 달라도 공개됨

ACT ON / high / 실제 공개 함수 및 renderer 재현.

`src/ai/response/publication.js:221–234`는 numeric claim일 때 entity/metric/scale/value/unit을 대조한다. text claim에는 source와 asOf 일치만 적용한다. summary/section을 청소하는 :256의 eventBoundToEvidence 검사가 safeClaims의 text에는 적용되지 않는다. 모델이 type=text로 현재 사건을 넣으면 가격 evidence도 그 사건의 증거처럼 결속된다.

합성 근거: AAPL price100USD, source=audit-price-provider, asOf=2026-10-27, status=reference, id=audit-price. 같은 source/asOf/id를 가진 text claim을 ‘연준이 금리를 인하했고 신용 스트레스도 해소됐다.’로 넣었다. 같은 문장을 summary에도 넣었다. 실제 buildPublishableAnswerPlan은 summary를 지우고 current-event-unverified를 기록했지만 text claim1개는 보존했다. 실제 renderAnswerPlan 출력은 ‘확인된 수치’ 제목 아래 그 사건 문장과 공급자·날짜를 표시했다. 합성100USD는 실제 가격 관측이 아니며 외부 조회는 없었다.

호출 연결: request-pipeline.js는 publishablePlan을 renderer로 보내고 safeClaims를 유효 claim으로 집계한다. js/aio-chat.js:4599–4600의 완료 콜백이 이 파이프라인을 사용한다. currentSensitive=true여도 text 경로가 남는 재현이다. 후단 action gate는 이 문장을 매매 지시로 보지 않으며, 별도 conduct 정책은 이 금융 사건의 사실 여부를 검증하는 계약이 아니다. 브라우저·실제 모델 출력 빈도는 측정하지 않았다.

기존 AI-01 수정 상태: 현재 소스에는 v58.77에서 도입한 문장 주제와 evidence 텍스트의 결속 검사가 있다. 따라서 ‘무관한 evidence 하나가 summary 검사 전체를 끈다’는 예전 상태를 현재 코드에 그대로 보고하면 안 된다. 이번 재현의 대조군 summary는 실제로 삭제됐다. 남은 문제는 typed text claim 공개와 summary 공개의 계약 차이다.

개편안: text claim의 사건 주체·사건 종류·관측 기간과 근거를 명시적으로 연결한다. 숫자 tuple이 맞는 것과 문장의 의미가 증명된 것을 구분한다. 임의 문자열 주제 하나의 일치만으로 사건 방향까지 확인됐다고 하지 않는다. 의미 검증이 없으면 출처가 달린 ‘모델 해석’으로 낮추거나 현재 사건 단정을 보류한다. 모든 claim을 ‘확인된 수치’로 묶는 renderer도 타입별로 구분한다. 회귀 사례는 같은 사건 문장을 summary/body/text claim 각각에 넣고, 무관한 가격·같은 주체의 반대 사건·실제 일치 사건을 대조한다.

## P11-AI-02 — 인용 예외가 같은 절의 새 매매 지시까지 면제

ACT ON / medium / 실제 `_aioApplyAIActionGate` 함수 재현.

`src/ai/response/request-pipeline.js:583`은 절 전체에 indirect 또는 englishIndirect가 맞으면 모든 directive 검사를 생략한다. 부정 표현은 해당 행동 주변에 한정했지만 인용 예외는 그렇게 결속하지 않았다.

대조 입력 ‘NVDA를 매수하세요.’는 정상적으로 공통 지시 제한 문장으로 치환됐다. ‘오닐은 추세를 따라야 한다고 봤습니다 그래서 NVDA를 매수하세요.’는 원문 그대로 남고 reasons=[]였다. 문장·절 분리 규칙에 ‘그래서’가 없고 앞 인용이 절 전체를 면제하기 때문이다. 이 문구는 테스트 데이터이며 투자 권고가 아니다. 첫 시도 ‘따르라고 말했습니다’는 인용 정규식에 해당하지 않아 정상 차단됐으며, 재현 실패를 숨기지 않고 기록한다. 실제 예외 형식인 ‘한다고 봤습니다’로 바꾼 뒤 재현했다.

연결: 공통 response pipeline이 gate를 호출한다. js/aio-core.js:4954 이후 conduct 래퍼는 금지 행위/포트폴리오 미동의 외에는 주로 limitations를 반환하며 이 교육 문맥의 개별 매매 지시 제거를 대신하지 않는다. 본 재현은 gate 함수 수준이며 배포 모델이 이 문구를 생성했다고 주장하지 않는다.

보강안: 인용 범위만 면제하고 그 밖의 새 행동 절은 독립 판정한다. 연결어를 계속 추가하는 방법은 임시 완화에 불과하므로, 인용된 발화와 답변자의 발화를 구분하는 형태와 보수적인 문장 분리를 검토한다. 과거 규칙 설명은 유지하고 인용 뒤 현재 지시·인용 앞 지시·영문 인용·부정 지시·소수 가격 지시를 대조한다. 일반 교육 답변 전체를 차단하는 방식은 피한다.

## P11-ENTITY-01 — 정확한 클래스 티커와 옛 추출기의 잘린 티커가 함께 사용됨

ACT ON / medium / 실제 extractor→registry resolver→chat merge 재현 및 caller 확인.

extract-tickers.js의 대문자 단어 정규식은 BRK.B에서 BRK를 뽑는다. resolver.js는 점·하이픈 변형을 registry와 대조해 BRK-B를 확인한다. chat-tickers.js는 추출 결과에 검증된 이름 결과를 추가하지만 같은 원문 토큰에서 파생된 BRK를 제거하지 않는다. KRX의 KS/KQ 중복에만 별도 제거 규칙이 있다.

합성 registry에 BRK-B 한 항목을 두고 ‘BRK.B 실적 분석’을 실행했다. resolveEntities 결과는 verified=true인 BRK-B 하나였지만 resolveChatTickers(companiesOnly=true, extract=실제extractTickers)의 결과는 [BRK, BRK-B]였다. 정확한 확인 단계가 있어도 잘린 미확인 후보가 앞에 남는다. 이는 BRK가 실제 다른 상장사라는 주장이 아니라 원문과 다른 요청 대상을 만든다는 재현이다.

js/aio-chat.js:4232의 결과가 :4237 freshness 요청과 :4256 ticker enrichment로 그대로 전달된다. :4354 단일 기업 심층 분석 선택도 이 배열을 사용하며, 실제 helper(:3278)는 길이1을 요구하므로 단일 질문이 두 항목으로 분류되면 해당 경로가 꺼진다. 공급자 요청은 실행하지 않았다.

개편안: 추출은 원문 token/span을 보존한 후보만 만들고 registry 확인 결과가 그 후보를 대체하도록 한다. raw 추출 목록과 확인된 목록의 합집합을 최종 subjects로 쓰지 않는다. BRK.B/BRK-B, 다른 클래스, 명시적 KQ/KS, $ 접두사, 알 수 없는 원문 티커, 약어와 회사명 혼합을 회귀로 검증한다. 미확인 원문은 유지하더라도 원문에 없던 잘린 티커로 바꾸지 않는다.

## 경로별 직접 검토

| 전체 본문 판독 파일 | 검토한 계약 |
|---|---|
| src/ai/context/market-content.js | 질문에 따른 거시·테마·차트 맥락 선택, 화면과 같은 interpretation, 조건별 lazy block |
| src/ai/context/manifest.js | evidence/claim의 manifest projection, revision·route 메타데이터 |
| src/ai/context-builder.js | evidence 수집과 정책 결과 병렬 보존; 정책 결과를 값 삭제와 혼동하지 않음 |
| src/ai/orchestrator/answer-orchestrator.js | 질문 계획, 최대4초 lazy 준비, UI adapter dispatch, domain analysis reference 경계, audit100 |
| src/ai/response/request-pipeline.js | 요청·시도 ID, 스트림별 출처8개 보관, 충돌 evidence, 공개·행동 gate, 제한 설명, disclosure |
| src/ai/response/publication.js | source/time/value 결속, 현재 숫자·사건 정리, citation URL 대조, 부분 복구 |
| src/ai/response/claim-ledger.js | claim 정규화, schema 검사, 부분 손상 JSON/plan 보존과 publication 연결 |
| src/ai/response/renderer.js | claim/section/citation 텍스트 표시; HTTP(S) URL 제한 |
| src/ai/policy.js | evidence 상태 및 allowedUse 평가, inferred numeric 제한 |
| src/ai/policy/conduct.js | 질문 분류와 답변 법률 표현 감사 분리, 교육/실행 구분 |
| src/ai/policy/suitability.js | 설명과 개인화 실행 요청 구분, profile/evidence 조건 |
| src/ai/policies/budget.js | shared Worker capability만 admission으로 사용, 로컬 횟수는 진단 |
| src/ai/session/chat-sessions.js | 동의 후 저장, 철회 시 삭제, 최신 대화 보존, quota 실패 축소, 재개 context |
| src/ai/session/user-profile.js | 선택값 정규화, 메모 길이/제어문자 처리, 설명 방식만 조정 |
| src/ai/session/usage-learning.js | 별도 동의, 질문 원문 대신 count, 14일 감쇠, bucket 상한, 선택 프로필 우선 |
| src/ai/entity/resolver.js | registry 기반 이름/티커 확인, 약어 제외, 원문 미확인 상태 |
| src/ai/entity/extract-tickers.js | legacy 대문자/$/6자리 후보 추출과 상한5 |
| src/ai/entity/chat-tickers.js | 확인된 종목 병합, 화면·이전 턴 fallback, 시장 proxy 분리 |
| src/ai/research/native-search.js | 내부 자료 우선, capability 기반 search 부착, 호출 상한2 |
| src/ai/research/capability.js | 질문의 필요성과 제공 경로의 준비 상태를 별도 모델링 |
| src/ai/research/decision.js | 현재성·인과·명시 검색 요구에서 requirement와 근거 최소치 파생 |

js/aio-core.js는 action permission 래퍼 주변, js/aio-chat.js는 완료 콜백 연결만 추가 확인했다. 이 두 legacy 전체 파일을 이번에 읽었다고 세지 않는다. 전체 판독은 의미를 검토했다는 기록이지 모든 실행 경로 무결성 PASS가 아니다.

정상 확인: 숫자 claim의 metric/entity/scale/value/unit/source/asOf 결속, 출처 충돌 ID의 conflict 처리, stream request ID 분리, 동의 철회 시 대화 저장 키 삭제, learning 동의 없을 때 저장 거부가 소스에 존재한다. 이 계약들 전체의 브라우저 회귀를 이번에 실행한 것은 아니다.

추가 후보/한계: manifest는 allowedUse·quality 등 원본의 모든 정책 정보를 복제하지 않는다(consumer가 manifest만으로 재판정하는지 추적 필요). profile save는 저장 실패를 사용자에게 반환하지 않는다(설정 UI 확인 필요). loadSessions는 turn 내부 q/a 형태를 검증하지 않아 손상 저장소의 복구 경로는 별도 검토 필요. 원문 인용과 사건 의미 대조는 문자열 일치만으로 완결되지 않는다. 위 후보는 확정2건에 포함하지 않는다.

## 증거와 전수 범위

`node _artifacts/pipeline-review-20261024/reproduce-pass11.mjs` exit0. 결과는 pass11-reproductions.json. 주입한 evidence와 직접 함수 호출만 사용했다. 모델 호출·외부 수집·public-data 쓰기·브라우저 실행 없음. baseline pipeline-review-pass11-20261028.

이전19개 변경 파일, 아직 파일별 증거와 대조하지 않은 항목, AI retrieval/research/time의 나머지 본문, portfolio·UI·knowledge·운영 workflow의 미판독 연결이 남아 있다. ‘모든 Pipeline 하나하나’의 완료 조건은 이 잔여가 없어지는 것이며, 이번21개 추가 판독을 전체 완료로 표현하지 않는다. commit/push/deploy 없음.

QA 기록: baseline pipeline-review-pass11-20261028의 audit 소유7개 경로로 affected 실행. run 2026-10-28T12-24-35-612Z-41808-7lexbo: pass3, cached9, fail0. workflow-yaml·product-charter·operations-contract 직접 통과. fixture 구문 검사·git diff --check도 통과. 이 결과는 감사 파일 검증이며 제품 전체 의미 검토 완료를 뜻하지 않는다.
