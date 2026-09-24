# 웹검색을 실제 데이터 보강으로 연결하는 설계

최초 조사: 2026-09-21 · v56.01. 현재성 기준: v56.15 · 2026-09-23. Luna MAX 정적 경로 조사, Astra 설계. 외부 검색 공급자 실행이나 제품 코드 변경은 하지 않았다.

> 구현 순서·공통 ResearchCandidate/RightsContract·제품 과업 인수의 정본은 [26 E0/E6](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)다. 이 문서는 검색·추출 후보가 그 공통 경계에 들어가는 방법을 구체화한다. P1172의 request/citation 일부 수정이나 research evidence의 존재를 정형 수치 승격 완료로 읽지 않는다.

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

## v56.15 현재성

W01은 고정 AAII/NAAIM/reference seed 갱신과 범용 웹검색을 분리해 읽는다. 계약 검사 성공은 검색 job 수행이나 새 관측 수집을 뜻하지 않는다. W02의 chat research document는 출처 문서 evidence일 뿐 숫자 정본이 아니다. P1172는 request-bound citation/numeric prose의 일부를 보강했지만, 검색에서 뽑은 수치가 지속 저장되는 candidate→canonical observation→projection 경로는 여전히 이 설계 영역이다. 이에 따라 UI에서 검색 결과가 보인다는 이유로 Screener/차트의 coverage나 비교 결과가 자동 개선됐다고 표시하지 않는다.

## W18-C — E6의 공통 승격 경계에 검색 후보를 연결

26 E6의 공통 객체 정의와 승격 decision을 재사용한다. 검색 결과마다 별도의 숫자 DB·독립적인 verified 상태체계를 새로 만들지 않는다. 검색 adapter가 보장할 추가 입력은 request/query binding과 원문 위치다.

검색 retrieval은 `requestId`, `queryId`, `queryFingerprint`, 요구한 entity/listing과 metric/period, result URL, publisher, 문서 고유 식별자, fetchedAt, 관측/공표시각 근거, locator(페이지/표/행/문단), 허용된 content hash 또는 excerpt, extraction method/version을 함께 전달한다. URL만 일치하거나 도메인이 공식이라는 이유로 질문과 같은 숫자라고 판단하지 않는다. Redirect 후 최종 origin을 기록하고 document identity를 정규화한다.

후보 생성 전에 SourcePolicy/RightsContract를 확인한다. 문서 fetch·저장·excerpt 사용·파생 extraction·AI 전달·공개 projection은 각각 별도 권리 판단이다. 원문 지속 저장이 불허되거나 미확인이면 허용된 provenance/link/hash/locator만 보존하고 원문 text를 cache/로그/공용 artifact에 쓰지 않는다. 저장·재배포 범위와 삭제 기한은 실제 출처 조건을 확인한 owner와 revision을 남긴다. 미확인 권리는 “합법”으로 추정하지 않는다.

후보 key는 `requestId + entity/listing + metric definition version + period + source document identity + locator + extraction version`을 안정적으로 식별해 재시도나 같은 결과 재검색이 중복 observation을 만들지 않게 한다. 후보는 검토/검증 내역을 append하고 실패 후보를 삭제하지 않는다. canonical promotion은 26이 정의한 권리·필드·validation gate를 통과한 observation ID로만 이루어진다. 대화 응답의 문서 citation과 durable promotion은 서로 다른 상태이며, request-local candidate가 다른 질문·entity·period의 canonical fact를 갱신할 수 없다.

### 책임 경계

| 경계 | 책임 | 실패 처리 |
|---|---|---|
| Search adapter | query/result/request ID, final origin, fetch receipt·비용·응답 제한 | 검색 성공 후 추출 실패는 `document-found`로만 기록 |
| Rights resolver | SourcePolicy와 저장/파생/AI/공개 허용 범위, 검토자/시점 | 권리 불명은 해당 restricted action 차단; 허용 provenance는 유지 |
| Extractor | 원문 locator, raw/normalized value, period/unit/definition, extraction version | 표 문맥·기간·단위 불명은 review-required 또는 rejected |
| Candidate validator | entity identity, metric registry, 기간/availability, 충돌 및 source quality | canonical 값·coverage·rank를 변경하지 않음 |
| Review/promotion owner | 자동 기준이 아닌 review case 결정, supersedes/canonical observation 연결 | 승인 대기는 숫자로 승격하지 않음 |
| Projection/publication | 영향 종목·비교모집단·model revision 재계산, manifest publish | 실패하면 새 current pointer 미발행, last-good 유지 |
| Chat/UI consumer | request-local citation과 verified observation을 구분해 표시 | 문서 발견을 데이터베이스 반영 완료로 말하지 않음 |

### 검색 고유 반증과 끝단 인수

| 입력 | 기대 결과 |
|---|---|
| 같은 URL이 두 entity 또는 두 metric query의 결과로 반환 | request/query/entity binding 불일치 후보는 검증 실패; 기존 정본 불변 |
| 올바른 회사지만 unit 1,000배, FY/TTM/quarter, 연결/별도 혼동 | 원문 raw 표기와 normalized 값 분리; 정의가 미정이면 승격 보류 |
| 문서 공표일보다 과거 period를 사후에 재검색 | fetchedAt이 availableAt을 덮지 않음; 과거 PIT run에 사후 입력 배제 |
| 공식 사이트의 다른 표/문단, snippet만 있고 locator 없음 | authority만으로 `ready` 되지 않고 review-required/rejected |
| 새 문서가 정정/철회되거나 두 출처가 충돌 | 이전 observation 덮어쓰기 금지; 새 revision/supersedes 또는 disputed 상태 |
| 검색 성공·추출 실패, extraction 성공·metric 검증 실패 | candidate 실패 reason 보존, durable data·ranking은 변화 없음 |
| 동일 검색 retry 또는 publication 재시도 | dedupe key로 후보/observation 중복 없음; 발행 중복은 같은 immutable revision |
| raw storage 금지·권리 unknown·retention 만료 | raw text persist/redistribute 금지; 허용된 link/provenance와 제한 상태만 유지 |
| HTML redirect가 private/local host, active content, oversized response, hostile instructions 포함 | unsafe origin/size/content 차단; 내용은 untrusted data로 취급하고 도구 지시로 실행하지 않음 |
| 검색 query에 개인 portfolio/민감한 메모가 포함될 수 있음 | default 최소 query; 사용자 자산 데이터는 별도 승인된 목적·전송 경로 없이는 provider에 포함하지 않음 |
| 하나의 승인된 candidate가 canonical promotion을 완료 | positive control: 단 하나의 새 observationId, 명시된 supersedes/revision, 영향 projection·UI/AI가 같은 ID를 소비 |

검색 adapter는 허용 scheme/origin을 정책으로 제한하고 redirect마다 목적지를 재검증한다. private network 접근, credential 전달, 실행 가능한 HTML/스크립트 렌더, 무제한 body/시간 응답을 막는다. 원문은 untrusted input으로 표시하며 문서에 든 prompt/tool 지시를 신뢰 경계 밖으로 실행하지 않는다. 사용자 보유·메모를 provider query나 public candidate에 섞지 않고 감사 로그에는 request identity와 bounded error만 둔다.

사용자는 상태를 `문서 발견 → 위치/내용 확인 → 수치 후보 → 검증/검토 대기 → 정본 반영 → 영향을 받은 run 재계산`으로 이해한다. 해당 상태를 공통 UI 어휘로 맞추고, 검색 대화에만 쓰인 답은 “이 분석 데이터에 반영되지 않음”을 표시한다. 근거 링크·기간·단위·사용 가능 시각·권리 제한을 색만으로 전달하지 않는다. 키보드와 screen reader에서 출처/locator 및 실패 reason을 확인하고 닫을 수 있어야 한다. 사용자 과업·치명 오해 기준은 26의 E6 사용자 인수와 통합한다.

### 이행·복구

기존 고정 AAII/NAAIM/reference 자료는 실행 검색 결과로 재분류하지 않는다. 고정 입력·관측시각·출처를 보존한 seed/reference로 읽고 자동 refresh 표시를 분리한다. 새 search adapter와 candidate store를 한 KPI 또는 survey에만 shadow 연결해 같은 document ID가 AI 문서 citation 및 후보 검증에서 유지되는지 먼저 확인한다. 승인 전까지 existing canonical numeric projection을 변경하지 않는다.

수직 cutover는 rights 확인 → retrieval receipt → candidate validation → 허용된 review → observation promotion → 재계산 → immutable manifest → UI/AI 소비 순서다. 단계 하나라도 실패하면 request-local search 결과/문서 링크만 남기고 durable 값·순위·과거 run을 변경하지 않는다. 새 projection이 잘못되면 publication pointer를 이전 적격 revision으로 되돌리고 검색 후보·validator receipt는 분석 trace로 보존한다. 권리가 철회/만료되면 계약된 deletion action을 수행하고 tombstone으로 제거 사실과 재현 가능 범위를 남긴다. cache나 장부에 만료 원문이 남았는데 pointer만 되돌리는 식의 복구는 통과하지 않는다.

상태 crosswalk는 [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md), E6 선행/책임·실행 gate는 [26](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)에 둔다. W18-C는 설계 보강이며 provider 실행, 원문 권리 확인, 실제 데이터 승격, UI 인수는 미완료다.
