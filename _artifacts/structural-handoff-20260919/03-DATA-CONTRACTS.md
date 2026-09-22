# 03 — 수집 결과를 사용자 값으로 승격하는 계약

> 역사 근거 주의: v55.22의 D01 반증 중 빈 quotes/coverage 불일치는 [v56 재검증](RECHECK-V56.md)에서 차단됐다. 아래 설명을 현재 미수정 결함 목록으로 그대로 사용하지 않는다. 나머지 인수조건의 완료는 별도 확인한다.

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

## D02. 숫자 가용성과 현재성의 사용자 표시

`src/ui/pages/market.js`의 `quoteValue`/`renderLiveQuotes`는 숫자와 lineage를 읽지만 숫자 표시 자체에 freshness/allowedUse 판단을 일관되게 투영하지 않는다. reference를 보여주는 것 자체는 결함이 아니다. 사용자가 과거 참고 관측을 현재 사용 가능한 값으로 오해할 수 있는지가 인수 대상이다.

### W03-B: quote presentation 계약

하나의 값에 `value, unit, observedAt, receivedAt, sourceId, revision, freshnessState, allowedUse, displayRole`을 결합한다. observedAt은 시장 관측 시점, receivedAt은 수신 시점으로 구분한다. 도착 시간으로 과거 관측을 신선하게 만들지 않는다. provider 우선순위만으로 최신·정확함을 단정하지 않는다.

표시 상태는 current / delayed / stale-reference / missing / disputed를 구분한다. 값 옆에 관측일과 지연·참고 상태를 노출하고, 상세 출처는 펼침 영역에 둔다. source 이름 정규식으로 freshness를 추정하지 않는다. price와 changePct의 관측일·세션·기준종가가 다른 경우 하나의 coherent quote처럼 합치지 않는다.

인수: 휴장/주말, 장중·종가 혼합, 공급자 timeout, last-good fallback, 미래 timestamp, FX/지수/금리 단위 차이. 휴장일을 단순 calendar age만으로 오류 처리하는 정책은 피하고 자산별 session/calendar 기준을 명시한다. 실제 라이선스·공급자 SLA 검증은 별도 운영 증거가 필요하다.

## 아직 추적 중인 수집 경계

SEC fact의 공시 available-at/보고기간/통화/단위/수정공시, adjusted price의 corporate action, provider 간 symbol identity, 뉴스 원문과 요약의 시간 관계. 이 패키지가 해당 영역의 정확성을 인증하지 않는다. 함수별 진행은 FUNCTION-REVIEW.md에 누적한다.
