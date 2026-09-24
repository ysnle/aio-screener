# 03 — 수집 결과를 사용자 값으로 승격하는 계약

> 현재성 기준은 v56.15 (2026-09-22)다. D01의 coverage·단위 반증은 P1145에서 계약과 게이트로 막혔다. 이 문서는 그 완료를 재작업 지시로 사용하지 않는다. R24-02의 metric 의미 검증은 별도 열린 항목이다.

Astra 설계 · 2026-09-20 · v55.22 / `54428470`. 범위: snapshot producer→validator→loader 및 quote 표시. 전체 공급자 검수 완료 아님.

## D01. 선언 coverage와 실측 coverage가 분리된다

`src/data/contracts/market-snapshot.js:106`의 `validateMarketSnapshot`은 선언된 coverage를 검사하지만 실제 필수 instrument 집합을 재계산하지 않는다. 같은 파일 `tier0Coverage`가 존재하지만 해당 validator 경로에서 호출되지 않는다. `src/data/market-snapshot-loader.js:16`은 이 검증과 published 상태를 수용 경계로 사용한다.

현재 저장된 published snapshot 복사본에 세 반증을 적용했다. quotes 전체 제거, 첫 instrument 제거, 첫 quote의 unit을 WRONG_UNIT으로 변경한 입력이 모두 `ok:true`였다. 원본 16/16은 정상이다. [실행 증거](snapshot-contract.json). 현재 `scripts/build-market-snapshot.mjs:190`의 producer는 coverage를 계산한다. **현재 producer가 손상 자료를 생성했다는 발견이 아니라, consumer 경계가 손상을 거르지 못한다는 발견**이다.

### W03-A: 실측 검증을 단일 계약으로 만들기

1. instrument registry의 identity, 필수 여부, expected unit, 허용 quote kind를 입력으로 받는 순수 audit 함수를 둔다. 파일/네트워크 접근은 loader가 담당한다.
2. 실제 identity 집합에서 missing/duplicate/unknown/mismatched-unit을 계산한다. 같은 종목을 두 번 넣어 coverage를 채울 수 없어야 한다. 심볼 alias로 중복 identity를 우회하지 못하게 한다.
3. declared coverage와 measured coverage를 별도 필드로 반환한다. published 수용에는 필수 집합 충족과 declared/measured 일치를 요구한다. tier1의 선택적 결측을 tier0 실패로 합치지 않는다.
4. producer와 loader가 같은 audit 결과를 사용한다. 검증 실패 시 last-good의 원래 시각·revision과 실패 원인을 유지하고 최신 정상 자료처럼 표시하지 않는다.
5. 단위 불일치는 임의 숫자 변환으로 복구하지 않는다. 변환이 정당한 경우 currency/unit transformation id와 원래 값을 남긴다.

인수: 정상16/16, 빈quotes, 누락, 중복, 다른unit, 알 수 없는instrument, 선언17/실제16, tier1 결측. 실패 입력이 UI/store의 current snapshot을 덮어쓰지 않음도 loader 통합시험으로 확인한다. 현재 반증은 pure validator 수준이며 loader/UI 장애 주입은 아직 하지 않았다.

현재 상태: P1145의 단위·identity coverage 검사와 W03-B freshness presentation은 해당 계약 검사에서 완료로 기록돼 있다. 발행·loader 통합 및 실사용 화면의 전 범위까지 인증한 것은 아니다. metric ID 대조는 아래 R24-02로 별도 추적한다. 기존 P1145를 닫았다는 사실은 아래 결함을 닫지 않는다.

## D02. 숫자 가용성과 현재성의 사용자 표시

`src/ui/pages/market.js`의 `quoteValue`/`renderLiveQuotes`는 숫자와 lineage를 읽지만 숫자 표시 자체에 freshness/allowedUse 판단을 일관되게 투영하지 않는다. reference를 보여주는 것 자체는 결함이 아니다. 사용자가 과거 참고 관측을 현재 사용 가능한 값으로 오해할 수 있는지가 인수 대상이다.

### W03-B: quote presentation 계약

하나의 값에 `value, unit, observedAt, receivedAt, sourceId, revision, freshnessState, allowedUse, displayRole`을 결합한다. observedAt은 시장 관측 시점, receivedAt은 수신 시점으로 구분한다. 도착 시간으로 과거 관측을 신선하게 만들지 않는다. provider 우선순위만으로 최신·정확함을 단정하지 않는다.

표시 상태는 current / delayed / stale-reference / missing / disputed를 구분한다. 값 옆에 관측일과 지연·참고 상태를 노출하고, 상세 출처는 펼침 영역에 둔다. source 이름 정규식으로 freshness를 추정하지 않는다. price와 changePct의 관측일·세션·기준종가가 다른 경우 하나의 coherent quote처럼 합치지 않는다.

인수: 휴장/주말, 장중·종가 혼합, 공급자 timeout, last-good fallback, 미래 timestamp, FX/지수/금리 단위 차이. 휴장일을 단순 calendar age만으로 오류 처리하는 정책은 피하고 자산별 session/calendar 기준을 명시한다. 실제 라이선스·공급자 SLA 검증은 별도 운영 증거가 필요하다.

## R24-02 — 종목·단위가 맞아도 잘못된 metricId가 published로 통과할 수 있다

독립 재검토(v56.15)에서 저장된 정상 market snapshot의 첫 quote에 `metricId: "wrong.metric.id"`만 넣은 순수 함수 반증이 `validateMarketSnapshot(...).ok === true`를 반환했다. 실제 발행 artifact에 오염이 있었다는 증거는 아니다. P1145가 필수 instrument·단위·coverage를 검증하지만 metric identity까지 닫았다고 볼 수 없다. 현 `TIER_0_INSTRUMENTS`의 각 행에는 기대 `instrumentId`, `metricId`, `unit`이 있으므로 registry 기준 대조가 가능하다.

### W03-C — quote의 의미 identity와 허용 출처를 한 계약으로 검증

정본은 instrument/metric registry다. 각 허용 quote 정의는 적어도 `instrumentId`, `metricId`, `unit`, 허용 `sourceKind`, 관측값 종류(value/price/index/rate 등), 적용 revision을 선언한다. Producer의 임의 문자열이나 quote가 선언한 `metricId`를 기대값의 근거로 삼지 않는다. `source`(제공자 표시 이름)와 `sourceKind`(전송·생성 경로)는 다른 축으로 보존한다.

입력 경계는 정규화 전 원 envelope와 정규화 후 snapshot을 구분한다. 명시적으로 들어온 잘못된 `metricId`는 registry 값으로 덮어쓰거나 alias 처리하지 않고 mismatch로 거부한다. metric ID가 빠진 입력은 해당 metric의 registry가 누락 유도를 명시적으로 허용할 때만 registry에서 파생하며 `suppliedMetricId: null`, `resolvedMetricId`, `metricIdBasis: "registry-derived"`를 남긴다. 허용 규칙이 없으면 missing으로 격리한다. 이로써 기본값 정규화가 명시적 모순을 감추지 않는다.

`published` snapshot은 모든 필수 `(instrumentId, metricId)` 쌍이 정확히 하나씩 있고 expected unit/source kind/value kind를 만족해야 한다. 같은 instrument의 중복은 거부한다. 잘못된 quote를 last-good과 섞어 정상처럼 만들지 않는다. 필수 quote가 없거나 격리되면 publication은 `partial` 또는 `failed` 정책을 사용하고, 원래 시각·revision의 last-good은 `stale-reference`로만 제공한다. `partial`을 current publication으로 간주할 수 있는 기능은 required set과 허용 결측 사유를 명시적으로 선언해야 한다.

반증 fixture는 기존 artifact 사본에서 순수 validator, producer, loader, presentation 소비자를 순서대로 확인한다.

| Fixture | 기대 결과 | 판별력 있는 대조 |
|---|---|---|
| 정상 16개 quote: registry와 일치 | `published` 수용 | 현재 적격 snapshot이 계속 수용됨 |
| instrument·unit은 정상이고 첫 quote의 metricId만 `wrong.metric.id` | 해당 quote mismatch, 필수 quote이면 publish 거부 | R24-02 재현 입력 |
| 두 종목의 metricId를 서로 바꿈 | 두 항목 모두 mismatch; coverage는 늘지 않음 | 값·단위가 그럴듯해도 identity가 검증되는지 |
| 허용 registry에 없는 sourceKind 또는 value kind | 격리·거부 | provider 이름 문자열만 바꾼 값으로 우회 불가 |
| metricId 누락, registry에 파생 허용 선언 있음/없음 | 허용 시 파생 provenance 보존; 그 외 거부 | 누락 허용과 모순 허용을 혼동하지 않음 |
| 이전 정상 snapshot + 새 잘못된 snapshot | current pointer와 성공시각 불변, 기존 것은 stale-reference | 오류가 last-good을 덮지 않음 |

완료 게이트는 해당 순수 fixture뿐 아니라 producer가 같은 validator를 호출하는지, loader가 실패를 current state에 반영하지 않는지, renderer가 mismatch 값을 현재 시세로 표시하지 않는지 확인한다. 정상 positive control이 있어 모든 입력을 거부하는 게이트를 방지한다. Evidence는 `instrumentId/metricId/registryRevision/sourceKind/unit/observedAt/fetchedAt/revision/validationReason`을 끝까지 보존한다.

소유권은 data-contract owner가 registry와 의미 validator를, snapshot producer/loader owner가 발행과 last-good 유지 규칙을, market UI owner가 현재/참고 상태를 소비한다. 임시 compatibility adapter가 별도 metric mapping을 만들지 않는다. 이행은 새 schema/registry revision의 shadow 검증 → 기존 snapshot read-only/reference 취급 → 동일 source로 새 snapshot 생성 → producer·loader·UI를 한 publication 경계로 전환 순서다. 전환 실패 시 마지막 적격 publication으로 pointer를 되돌리고, 새 metric 계약을 충족하지 못하면 기능을 `unavailable`로 둔다. 예전 오염을 current로 되살리는 rollback은 금지한다.

상태: **R24-02 설계 추가, 구현·게이트·화면 인수 미완료.** P1145는 coverage 계약만 닫는다. 새 예방 assertion을 추가할 때는 기존 결함을 막는 P 항목을 QA ledger에 먼저 등록하고 assertion trace에 그 ID를 인용한다. P 번호를 이 문서에서 선점하지 않는다.

## 아직 추적 중인 수집 경계

SEC fact의 공시 available-at/보고기간/통화/단위/수정공시, adjusted price의 corporate action, provider 간 symbol identity, 뉴스 원문과 요약의 시간 관계가 남아 있다. 데이터 사용권과 라이선스도 수집 성공이나 공개 가능 여부로부터 추론하지 않는다. 이 패키지가 해당 영역의 정확성을 인증하지 않는다. 함수별 진행은 FUNCTION-REVIEW.md에 누적한다.

구현 순서, 계약 소유자와 통합 fixture는 [25 finding 상태 crosswalk](25-CURRENT-FINDING-STATUS-CROSSWALK.md) 및 [26 실행·인수 계획 E1](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)을 따른다. 이 파일은 R24-02 metric 검증 설계를 보강했으며 제품 코드·artifact를 수정하지 않았다.
