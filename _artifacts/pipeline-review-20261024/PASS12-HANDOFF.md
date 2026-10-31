# PASS12 — 검색 계획·출처 자격·요청 결속·분석 엔진

2026-10-28, v59.42 작업 트리. cstack review의 기존 결함(Pre-existing) 검토. 사용자 지시에 따라 에이전트 없이 직접 판독했다. 제품 코드 수정 없음. 아래 재현은 로컬 함수에 합성 입력을 넣었으며 URL을 조회하지 않았다. 실제 모델 응답/배포 서비스에서 발생했다고 주장하지 않는다.

## P12-RESEARCH-01 — 기업 1차 출처 정책이 최종 판정에서 사라짐

판정: 수정 권고, 중요도 중간. `research/plan.js`의 company-primary는 sec.gov와 확인된 issuer IR만 primary이고 Nasdaq·investors.com은 secondary다. 그러나 `research/evidence.js`의 PRIMARY_OFFICIAL_SUFFIXES에는 nasdaq.com이 있으며 createEvidenceDocument가 질문과 무관하게 PRIMARY를 부여한다. evidenceFloor는 plan의 sourcePolicy를 읽지 않고 그 전역 분류로 minimumPrimarySources를 센다.

재현: company-primary 계획의 최소 독립 출처1/1차 출처1에 최근 날짜와 같은 queryId를 가진 Nasdaq citation 하나만 제공했다. 계획에는 Nasdaq이 secondary로 기록돼 있는데 결과는 primarySourceCount=1, currentClaimsAllowed=true다. 거래소 자체 발표와 거래소 사이트의 기업 집계 기사는 권위의 적용 범위가 다르다. 도메인의 일반 신뢰도를 기업 실적 원문 자격으로 사용할 수 없다.

연결: bootstrap.js:1152에서 같은 함수가 AIO_ARCH에 노출되고 request-pipeline.js:109의 래퍼를 거쳐 aio-chat.js:4597 완료 콜백이 사용한다. 최종 게이트는 숫자/문장 공개 검사와 별개이며 이것만으로 허위 답변이 반드시 공개된다는 뜻은 아니다.

개편안: 문서 일반 tier와 질문별 admissibility를 분리하고, 계획의 primary 목적·domain·검증된 issuer registry를 실제 floor에 전달한다. Nasdaq 원본 거래소 통계에는 해당 목적의 자격을 유지하되 기업 집계는 primary로 승격하지 않는다. 보강 회귀: SEC 공시, 확인된 issuer IR, Nasdaq 자체 거래소 자료/기업 집계, 외부 뉴스, allowlist 밖의 도메인을 질문 목적별 교차 비교한다.

## P12-RESEARCH-02 — 일부 결속을 전체 결속 확인으로 표시

판정: 수정 권고, 중요도 중간. verifyEvidenceBinding은 전체 rows에서 선언된 ID만 추려낸다. 하나라도 기대 ID가 있으면 나머지 무표기 문서가 있어도 BOUND다. 실제 사용 가능한 문서별 결속과 출처 개수 계산이 분리돼 있다.

재현: 최소 독립 출처2/1차1인 계획에 SEC citation(queryId 있음)과 Reuters citation(queryId 없음)을 넣었다. 둘 다 날짜가 창 안에 있으면 independentSourceCount=2, bindingVerified=true, currentClaimsAllowed=true다. 전부 ID가 없는 경우 UNBOUND로 구분하는 기존 보강은 존재하지만 혼합 묶음에는 적용되지 않는다.

영향: 취소·재시도·복수 공급자 결과의 일부가 요청 결속을 잃어도 출처 최소치를 채울 수 있고, 소비자는 bindingVerified를 전체 근거 확인으로 읽게 된다. 실제 cross-request 오염이 관찰됐다는 주장이 아닌, gate가 혼합 입력을 승인하는 재현이다.

개편안: citation/document의 URL 정규화 후 같은 문서 단위로 결속을 합치고, 확인된 문서만 current floor에 포함한다. 검증되지 않은 추가 자료는 reference로 남기며 정상 근거까지 폐기하지 않는다. 회귀: 전체 bound/unbound, mixed, 명시적 mismatch, duplicate URL의 상충 ID, 외부·native 경로 혼합, 최소치 충족에 미확인 자료가 필요한 경우를 구분한다.

## P12-RESEARCH-03 — 실제 question plan의 종목 구조를 entity 검사에서 놓침

판정: 수정 권고, 중요도 중간. question-planner.js는 entities를 resolver 객체 `{ entities: [...] }`로 생성한다. evidence.js의 expectedEntity는 questionPlan.entity 또는 배열형 questionPlan.entities만 확인한다. 실제 채팅 완료 호출에는 별도 entity 인자도 없다.

재현: 실제 plan 형태의 AAPL 질문에 queryId가 같은 MSFT citation을 제공하면 currentClaimsAllowed=true다. 동일 입력에 entity:'AAPL'을 명시한 대조군은 MISMATCHED_ENTITY와 currentClaimsAllowed=false를 반환한다. 즉 비교 함수 자체가 아니라 producer→consumer 형태 계약이 빠진 것이다.

개편안: resolver 결과에서 검증된 종목 집합을 정규화해서 전달한다. 단일 종목은 엄격히 일치시키되 비교 질문은 예상 집합과 claim별 대상 결속을 사용하고, 시장 공통 출처는 별도 scope로 분류한다. 첫 종목 하나로 모든 비교 질문을 강제하면 새 오탐이 생긴다. 회귀: 회사명/티커, 한미 혼합 비교, sector proxy, 미확인 이름, 종목별 근거+공통 거시 근거를 포함한다.

## 직접 전체 판독 범위와 정상 계약

아래 19파일은 본문 전체를 직접 읽었다. 출력이 잘렸던 research/evidence.js는 1–190 및 나머지로 다시 읽었다. 판독 완료는 실행/의미 무결성 인증이 아니다.

| 파일(src/ai/ 아래) | 검토 계약 |
|---|---|
| research/plan.js | 출처 목적·허용/제외 도메인·IR 확인·검색창·예산·계획 검증 |
| research/evidence.js | 정규 URL·권리·깊이·중복·citation 연결·독립/1차 개수·결속·발표 시점 |
| time/market-session.js | calendar 재노출·질문 시간·외부/runtime session·verified 조건 |
| orchestrator/question-planner.js | intent 합집합·회사/시장·요청 계획·근거/도구 요구·premise |
| orchestrator/capability-planner.js | evidence→tool 매핑·읽기 권한·개인화 action 구분 |
| orchestrator/premise.js | 동일 종목/지표/단위/기간·명시적 decision 권한·방향 충돌 |
| retrieval/evidence.js | store 기반 metric 조회·복사 |
| retrieval/knowledge.js | reference corpus·한국어 어미·ranking·길이 상한·공유 load·취소·재시도 |
| analysis/evidence-inputs.js | typed observation·ID/지표 충돌·같은 시각/단위·reference-only 입력 |
| analysis/registry.js | primary intent별 엔진 분기·reference 맥락 |
| analysis/company.js | 품질 입력 평균·밸류 percentile·fact 요약·부분 상태 |
| analysis/sector.js | 유효 수익률 표본·breadth·평균·leader/laggard·추적 가능성 |
| analysis/technical.js | 가격/MA·RSI·MACD 조건, 예측 없이 관측 차이 |
| analysis/macro-fx.js | edge 요건·관측과 전달 경로의 분리 |
| analysis/causal.js | 사건 선후·교차자산 방향·반대 근거·대안 후보 |
| inference.js | inferred reference 형식·range·URL/count·정확 현재 숫자 금지 |
| response/answer-visual-choice.js | 질문에 맞는 최대2개 그림·비교·KR 재무 제외 |
| response/answer-modes.js | quick/교육/분석/비교/조건부 선택/탐색 구성 |
| response/answer-principles.js | 현재성·모델 지식 경계·주입 여부·검색 없는 재시도 |

정상 계약: research 문서 URL은 HTTPS·credential 없음으로 제한; 권리 차단 문서는 최소치에서 제외; publication/eventTime 없는 검색 자료는 최신 사실로 승인하지 않음; premise는 가격 수준을 수익률로 바꾸지 않고 동일 기간·단위·명시 권한을 요구함. evidence-inputs의 기본 경로는 기업 품질 점수/sector membership/causal edges를 관측값에서 만들어내지 않고 reference로 유지한다. knowledge 취소는 공유 fetch를 취소하지 않으며 실패한 load는 재시도 가능하다.

## 후보·추가 보강 방향(확정3건과 분리)

- time/market-session은 supplied/state의 나이를 자체 검사하지 않으며 createTemporalEvidence의 status는 정규화 전 truthiness에 의존한다. calendar 전체와 호출자의 신선도 계약을 이어서 확인해야 한다.
- company 엔진은 출처 없는 quality 값 평균도 label을 만들 수 있다. 기본 evidence-inputs는 quality를 만들지 않으므로 활성 경로의 직접 공급자가 있는지 확인 전 사용자 노출 결함으로 확정하지 않는다.
- macro/causal 엔진은 sourceKind의 소수 차단 목록을 사용하고 arbitrary kind를 받는다. 기본 입력 경로는 edges/events를 생성하지 않아 해당 노출 조건이 아직 미확인이다.
- inference의 sourceCount는 URL보다 많아도 검증을 통과할 수 있다. 독립 원문 수가 실제 어디서 증명되는지와 소비자 도달 여부를 추가 검토한다.
- answer-principles는 각 통계의 cadence를 따르라면서 snapshot 72시간 뒤에는 정적 수치를 현재값으로 인용하지 말라고도 지시한다. 오래된 파일 안에 아직 최신인 월간 관측치가 있을 때 충돌하므로 cadence별 상태와 파일 운영 상태를 분리하는 방향이 맞다. 모델 행동은 미실행.
- domain analysis는 primary intent 하나만 분기한다. question plan은 복수 intent의 evidence를 합치므로, 복합 질문에 대한 보조 엔진 결과가 누락되는지 후속 UI 소비 경로 확인이 필요하다.

## 증거·미완료 범위

`reproduce-pass12.mjs` exit0: Nasdaq primary 승인, mixed binding 승인, nested entity 누락의 3재현과 명시 entity 대조군 확인. 출력 `pass12-reproductions.json`. URL은 합성 fixture이며 실제 기사 존재를 주장하지 않는다. baseline pipeline-review-pass12-20261028.

전체 저장소 검토는 미완료다. 이번 판독은 AI 하위 모듈의 범위를 넓힌 것으로, intent taxonomy·남은 context·market-calendar·legacy 대형 파일·UI/자료/QA/workflow 전체 및 이전 변경19파일의 재검토를 완료했다는 뜻이 아니다. 읽지 않은 파일이나 과거 서브에이전트 보고를 직접 검토로 승격하지 않는다. 제품 코드/데이터 변경·외부 수집·commit/push/deploy 없음.
