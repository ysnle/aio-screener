# 웹검색을 실제 데이터 보강으로 연결하는 설계

2026-09-21 · v56.01. Luna MAX 정적 경로 조사, Astra 설계·집필. 외부 검색 공급자 실행이나 제품 변경은 하지 않았다.

## W01 — 현재 검색 기능은 범용 데이터 보완 파이프라인이 아니다

`scripts/refresh-web-research.mjs:10–13,147–172`는 고정 CHECKED_AT(2026-08-21)와 survey/reference 상수를 사용한다. 실제 fetch는 AAII다. 실행하면 marketSurveys와 officialWebReferences를 통째로 대입하고 data.json/구조 evidence를 쓴다. 따라서 파일명만 보고 모든 결측값을 새로 검색하는 job으로 해석하면 안 된다.

현재 refresh-data workflow는 fetch-data를 실행하며 web-research 계약 검사는 하지만 이 script를 호출하지 않는다. 정기 fetch-data는 AAII를 다시 수집하고 이전 NAAIM/official references를 보존한다. 이는 source registry의 AAII scheduled, NAAIM operator-web-research 구분과 연결된다. 계약 검사 통과는 매번 검색 수행의 증거가 아니다. 이 스크립트를 단순히 자주 실행해도 고정 관측의 날짜와 값은 새로워지지 않는다. 새 수동 보강이 추가되면 통째로 대입하는 방식이 이를 잃게 할 가능성도 인수해야 한다.

## W02 — AI 문서 검색과 정형 숫자 저장은 별도 경로

`js/aio-chat.js:5047–5136`은 검색 결과로 research evidence document를 만든다. `src/ai/research/evidence.js:40–66`에는 URL/publisher/contentDepth/rights/time/status가 있으나 metric/value/unit observation은 없다. chat은 이를 metric=research-document, value=null, unit=document로 바인딩한다. numeric claim gate가 요구하는 entity/metric/value/unit/asOf/source tuple과는 다른 계약이다.

현재 조사한 `src/app/bootstrap.js:304–335,673–675`의 숫자 EvidenceStore ingest는 market snapshot이며, `src/data/evidence-store.js:67–94`는 메모리 Map이다. 검색 문서를 정형 수치로 검증해 지속 저장하는 연결은 확인하지 못했다. 이것은 해당 정적 경로 범위의 결론이며 모든 runtime 경로를 추적한 증거는 아니다.

스크리너는 screener/universe/model-validation artifact를, 차트는 history 계열을 별도로 소비한다. 따라서 AI에서 값을 검색했다고 스크리너와 차트가 자동 보강되는 현재 구조라고 말할 수 없다. 이 분리가 무조건 잘못된 것은 아니다. 검증 전 문서가 자동으로 숫자 정본을 오염시키지 않는 경계는 유지해야 한다.

## 목표: 검색 adapter와 승격 경계 추가

1. **요구 생성**: 결측 field에 대한 entity/listing, metric definition, unit, period, acceptableAge, requiredSource, allowedUse를 지정한다. 빈칸만 보고 무차별 검색하지 않는다.
2. **원문 확보**: 검색은 문서 후보를 찾는다. 원문 위치/표/문단, fetchedAt, hash 또는 허용된 보존 방식, 문서 공표시각을 기록한다. 검색 snippet을 확인된 값으로 쓰지 않는다.
3. **후보 추출**: rawText와 parsedValue를 함께 보존한다. 문서의 현재 값을 공시 당시 값으로 소급하지 않는다. FY/TTM/분기, 연결/별도, 통화, 배수, 백만 단위를 정규화하되 원래 표기를 유지한다.
4. **검증**: entity 일치, 시점, 단위, 회계 정의, 출처 충돌, 허용 범위를 검사한다. 자동 판정 가능한 기준과 사람 검토 대상을 분리한다. 근거 없는 AI confidence로 통과시키지 않는다.
5. **승격**: 통과한 observation만 canonical revision에 append하고 기존 값은 superseded 관계로 남긴다. 사람이 승인해야 하는 예외는 검토 대기다. 모든 정상 공식 API 행을 수동 승인으로 묶지는 않는다.
6. **재계산·분배**: 영향받은 팩터/비교 집단/설명/차트 projection을 재계산하고 묶음 manifest를 발행한다. request-local 답변과 durable 데이터 갱신의 완료 상태를 다르게 표시한다.

후보 계약의 최소 필드는 `candidateId, entityId, metricId, rawValue, value, unit, periodStart/end, observedAt, availableAt, retrievedAt, sourceUrl, locator, extractionMethod, definitionVersion, validationState, reviewState, allowedUse`다. 날짜를 모르면 null과 사유를 보존한다. 필수 의미 필드를 모르면 정본 승격을 막는다.

## 운영·사용자 경험

갱신 요구를 dedupe하고 source별 호출 예산·재시도·backoff를 둔다. 반복 미수집은 더 많은 검색을 반복하기 전에 “원문 없음/접근 제한/정의 불일치/검토 필요”로 분류한다. 갱신 주기는 데이터 공표 cadence와 과업 요구에서 정하며 모든 값에 30분 재검색을 적용하지 않는다. 비용과 데이터 사용 조건은 실제 출처별로 확인한다.

사용자는 “자료 찾는 중 → 원문 확보 → 기간/단위 확인 → 분석에 반영됨”을 구분해 볼 수 있어야 한다. 질문에 답할 근거를 찾았지만 스크리너에는 아직 반영하지 않았다면 그대로 표시한다. 검증 실패를 무한 loading으로 숨기지 않는다. 원문에서 그 숫자가 보이는 위치로 연결하고, 충돌한 출처가 있으면 함께 제시한다.

## 인수 및 구현 순서

먼저 한정된 기업 KPI 또는 한 survey로 수직 경로를 만든다. 기존 고정 snapshot을 seed fixture로 분리하고 실행형 adapter와 구분한다. 검색 문서→후보→정본→projection→실제 UI/AI까지 같은 observationId를 추적한 뒤 범위를 넓힌다.

필수 반증: 단위 1,000배 차이, 동명이인 종목, 오래된 표를 최신 검색 결과가 재노출, FY/TTM 혼동, 원문 정정, 상충 출처, 검색 성공/추출 실패, 추출 성공/검증 실패, publication 실패, 재실행 중복, 수동 보강 보존. 기대 결과는 “무조건 값이 채워짐”이 아니라 자격 있는 값만 일관되게 반영되고 부족 사유를 사용자가 이해하는 것이다.
