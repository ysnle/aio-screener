# v56.15 재검증과 포트폴리오 배분 계약 보강

2026-09-22 · Astra 작성. 제품 코드·데이터·설정 수정 없음. 스킬 미사용.

## 기준선과 이전 자료의 현재성

이번 시작점은 v56.15, HEAD `2195722dab571eaca0335249d02e84abdd128e94`, clean working tree다. 21의 v56.01 실브라우저 관측은 당시 증거로 보존한다. 이번 함수 실행을 현재 라이브 브라우저 검증으로 취급하지 않는다. 다른 작업이 구현한 내용을 이번 감사의 수정으로 계산하지 않는다.

| 과거 발견 | 현재 확인 | 상태 |
|---|---|---|
| 21 B02 HYG null.toFixed | `js/aio-macro-tech.js:558,564`에 null guard 존재 | 해당 정적 예외 경로 보강 확인. 전체 차트 동선 재인증 아님 |
| 22 PFR06 목표 미입력→0 | 입력 writer는 positive finite 또는 null. native normalizer도 target 0→null, targetWeight 0→0 | 실제 ESM 실행으로 타입 분리 확인. 저장·복구·전체 화면은 이번 미실행 |
| 22 PFR01 종점 가격→초기 비중 | `src/domain/portfolio/backtest.js:369–398`에 잔존 | root 합성 실행으로 재현, 미해결 |
| 22 PFR02 현금 분모 | `js/aio-workspace.js:891–918`은 positions 가치 합계로 가중치 생성 | 현재 정적 경로 잔존. 현금 포함 시계열 재설계 필요 |
| 22 PFR03 무위험수익률 | `js/aio-workspace.js:926`의 0.043, 월간 호출의 rfAnnual:null 병존 | 현재 정적 경로 잔존 |

주의: 현재 코드의 P1176 주석에 `22 PFR01`이 목표가 문제를 가리키는 부분이 있다. 이 핸드오프의 **PFR01은 초기 배분**, **PFR06은 목표가격**이다. 구현자가 번호만으로 완료 처리하면 초기 배분 문제를 누락한다. 코드 주석은 이번에 고치지 않는다. 후속 구현에서는 `문서 ID + finding ID + 의미 제목`을 함께 기록하고 동의어 매핑을 남겨야 한다.

## root 독립 재현

14개 월별 합성 관측일(2024-01-28부터 2025-02-28), A 가격 `100+900*i/13`, B 가격 `100-50*i/13`, SPY=100. 같은 timestamps의 close/adjustedClose, backtestEligible=true, adjusted-close 기준. A/B 각 1주·원가100, 초기자산10000, rebalanceType=none, RF=null. 실제 native ESM `buildPortfolioBacktestLab`을 실행했다. 실거래 가격·거래캘린더 검증용 fixture는 아니다.

| 입력 변경 | 실제 시작 배분 | 종료 잔액 | 해석 |
|---|---|---|---|
| 목표비중 미입력 | A95.2381% / B4.7619% | 95476.1905 | 종점 시장가치로 시작 배분 역산 |
| 목표비중 각50 | A50% / B50% | 52500 | 명시 배분 양성 대조 |
| 첫 입력과 같되 A의 마지막 값만200 | A80% / B20% | 17000 | 미래 종점 변경이 과거 초기 비중을 바꿈 |

모두 `decisionEligible:false`였다. 따라서 거래용 인증된 백테스트가 미래 정보를 쓴다고 과장하지 않는다. 현재구성 소급 시뮬레이션이라는 제한은 존재하지만, 과거 전략 성과로 사용할 수 없는 계산 기준은 여전히 남아 있다.

## 신규 PFR07 — 명시적 0 비중이 폴백으로 되살아난다

같은 fixture에 목표비중 `[0,0]`을 넣으면 `ok:true`, A95.2381%/B4.7619%인데 `targetWeightBasis:'explicit-target-weight'`를 반환한다. `[0,null]` 역시 A95.2381%/B4.7619%로 되돌아가므로 명시적으로 제외한 A가 다시 포함된다. `[0,100]`은 A0/B1을 올바르게 반환한다. 이는 '항상 0을 못 다룬다'는 문제가 아니라 **무효·부분 배분을 암묵적으로 다른 정책으로 바꾸는 것**이다.

근거: `backtest.js:370`은 explicit 여부로 basis를 먼저 정한다. :374에서 총합0이면 explicit=false로 바꾸지만 basis는 갱신하지 않는다. :378–395 폴백은 각 종목의 명시적 제외를 보존하지 않고 전 종목 시장가치로 정규화한다. 결과 설명의 거짓 provenance와 배분 의미 손실이 동시에 발생한다. UI 목표비중 입력은 현재 연결되지 않았으므로 신규 PFR07의 실제 사용자 입력 동선 발생은 미검증이다.

## 근본 설계: AllocationDefinition을 계산 전에 확정한다

22의 성과/시뮬레이션 분리 위에 다음 입력 계약을 추가한다.

```text
allocationMode: explicit_weights | start_date_holdings | current_composition_retrospective
effectiveAt / baseCurrency / universeRevision / allocationRevision
members: [{ instrumentRef, weight: number|null, inclusion: include|exclude|unspecified }]
cashWeight / leveragePolicy / partialWeightPolicy / normalizationPolicy
```

0은 제외, null은 미지정이다. 배분 모드를 사용자가 선택하거나 저장된 정의에서 읽고, 무효 입력 때문에 모드를 조용히 바꾸지 않는다. 총합0은 명시적 현금100% 모드가 없는 한 invalid다. 부분 비중은 기본적으로 보류하며, 잔여비중을 분배하려면 별도 정책·대상 집합·현금 취급을 명시한다. 0으로 제외된 종목은 잔여 분배에서 제외한다.

단계는 `validate → resolve allocation → immutable AllocationSnapshot → simulate`다. 실제 선택한 분기의 basis를 snapshot에서 생성하고 UI는 그 값을 그대로 표시한다. 성과 엔진 내부에서 누락 입력을 원가·종점 비중으로 대체하지 않는다. 모드별 미래정보 허용 범위도 타입으로 제한한다. current-composition-retrospective만 현재 구성을 과거에 적용하며 이름과 비교 가능한 결과 범위를 명시한다.

사용자는 실행 전에 '어떤 구성으로 시작하는가'를 확인해야 한다. A 제외/B 미지정이면 숫자 결과 대신 'B와 현금의 배분을 지정하세요'로 안내한다. 시뮬레이션 결과의 시작 배분표·기간·현금·통화·비용 가정이 저장된 실행과 동일해야 한다. 실제 계좌 성과 영역으로 복사하지 않는다.

## 구현 경계·이전·인수

- owner: allocation domain이 검증·분배·basis를 소유. backtest는 검증된 snapshot만 입력받는다. writer는 목표가격과 목표비중을 독립 보존한다.
- 이전: mode 없는 기존 저장 실행은 legacy-retrospective로 표시하고 자동으로 explicit 실행으로 변환하지 않는다. 다시 실행할 때 배분 선택을 요구한다. 기존 결과의 원본과 ID는 유지한다.
- 복구: 신규 엔진 실패 시 마지막 동일 계약의 결과 또는 보류 상태를 제공한다. 제외 종목을 암묵적으로 복원하는 폴백으로 돌아가지 않는다.
- 인수: `[0,0]`, `[0,null]`, `[0,100]`, 음수·과다합계·빈 구성·현금100%·목표가격만 있는 구성. 미래 가격 변화가 start-date/explicit 배분에 영향을 주면 실패다. 유효한 비중과 결과 basis가 항상 같아야 한다.
- 완료는 산술·provenance·화면 설명·보관 실행 재현을 모두 통과한 상태다. 단순 null guard 추가나 문구 변경만으로 이 항목을 닫지 않는다.

## 2026-09-23 독립 감사 반영 — ID crosswalk, 완전성 검증과 위험 경로

[25 현재성 교차표](25-CURRENT-FINDING-STATUS-CROSSWALK.md) 및 [26 실행·인수 계획](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)은 이 계약을 현재 열린 위험과 실행 카드 E3/E4에 연결한다. 코드 구현 때 PFR08–10을 제품 회귀 ledger와 연결하되, 문서 ID와 의미 제목을 함께 남긴다.

### PFR 번호 정본

finding은 숫자만 인용하지 않는다. v56.15 근거에서 보이는 불일치를 다음과 같이 고정한다.

| 정본 finding | 의미 제목 | 과거 별칭/혼동 | 상태 기준 |
|---|---|---|---|
| `22:PFR01` | 종점 가격에서 시작 비중을 역산 | `js/aio-workspace.js`의 P1176 주석은 문자열 `22 PFR01`로 목표가격 미입력 직렬화를 가리킴. 그 주석의 의미는 아래 `22:PFR06`이다. | 종점 가격이 explicit/start-date 배분을 바꾸면 미해결. |
| `22:PFR06` | 목표가격 미입력과 목표비중 구분 | P1176의 혼동된 `22 PFR01` 주석 | writer/normalizer 타입 분리 정적·ESM 재확인. 저장·복구·전체 화면 검증은 미완료. |
| `23:PFR07` | 명시적 0 및 부분 배분이 폴백으로 되살아남 | 이 문서의 `[0,0]`/`[0,null]` 합성 실행 | 미해결, UI 입력 동선 미검증. |
| `22:PFR08` | 의도 멤버 가격 이력 누락을 제거 후 재정규화 | R24-05 | 누락 종목 하나에서 결과 실행이 만들어지면 미해결. 상세 계약은 22 W22-H. |
| `22:PFR09` | 위험 계산 경로가 실제 보유 이력·현금·재조정을 보존하지 않음 | R24-06 risk path | 계산 경로·분모·현금/재조정 정책이 결과에 저장되지 않으면 미해결. 상세 계약은 22 W22-I. |
| `22:PFR10` | 현재 구성 소급 시뮬레이션의 기준 valuation snapshot 불명 | R24-06A | 수량·가격·FX·시각·평가 ID 없이 현재 구성 비중을 만들면 미해결. 상세 계약은 22 W22-J. |

신규 이슈 기록은 `artifact/document ID + finding ID + semantic title + evidence SHA/date`를 사용한다. `PFR01`처럼 bare number를 issue, 커밋 설명, run metadata에 쓰지 않는다. 기존 코드 주석은 이 문서에서 직접 고치지 않았으며 구현 변경 시 새 주석과 QA trace는 의미 제목으로 작성한다. 감사 ID는 `R24-*`, 제품 회귀 ledger의 P-number, 이 핸드오프의 `PFR*`를 서로 다른 namespace로 유지한다.

### 봉인되는 snapshot 계약

기존 `AllocationDefinition`은 사용자가 요청한 배분의 의도를 저장하고, 계산 입력 resolver는 시장 자료 적격성과 현재 구성의 평가 근거를 별도 immutable snapshot으로 확정한다.

```text
ResolvedAllocationSnapshot = {
  allocationSnapshotId, definitionId, allocationMode,
  compositionSource: explicit | start_date_holdings | valuation_snapshot,
  compositionAsOf, valuationSnapshotId, accountRevision,
  baseCurrency, weightBasis, normalizationPolicy,
  members: [{ instrumentId, inclusion, requestedWeight, resolvedWeight,
              quantity, quantityUnit, nativeMarketValue, priceCurrency,
              baseMarketValue, priceObservedAt, priceRevisionId,
              fxPath, fxRevisionIds, coverageState, exclusionReason }],
  cashByCurrency, cashWeight, unresolvedMembers, resolvedStatus
}

SimulationInputSnapshot = {
  simulationInputId, allocationSnapshotId, priceUniverseSnapshotId,
  windowRequested, windowResolved, returnBasis, calendarAlignmentPolicy,
  perMemberCoverage, missingRanges, priceRevisionIds, fxRevisionIds,
  corporateActionPolicy, feesAndExecutionAssumptions, engineVersion
}
```

`AllocationSnapshot`만으로 충분한 가격 series가 있다고 간주하지 않는다. `validate member identity + allocation + price/FX coverage → resolve allocation → freeze AllocationSnapshot and SimulationInputSnapshot → simulate`가 순서다. 입력 검증이 실패하면 `blockedRun`을 보존하되 성과 series를 만들지 않는다. 빈 `unresolvedMembers`만으로 완전성을 판정하지 않고, 요청했던 member set과 조회된 series의 일치·커버리지를 대조한다.

current-composition 모드는 실행 시점의 `valuationSnapshotId`를 필수로 갖는다. 이 snapshot에서 수량×같은 cut의 가격×그 cut의 FX로 base market value를 확정하고 `whole_account` 또는 `invested_sleeve` 분모로 weight를 만든다. 각 weight에 source quantity, price/FX observation time/revision과 환산 경로를 남긴다. 이 비중은 과거 가격 자료 마지막 날의 값을 이용해 새로 계산하지 않으며, 저장된 실행을 재생할 때 최신 계좌 상태로 대체되지 않는다. 관측시각이 허용 범위에 맞지 않거나 구성원 valuation/FX가 빠지면 snapshot creation은 blocked가 된다.

위험 추정은 AllocationSnapshot만 공유하더라도 별도의 risk input snapshot/result ID를 가진다. actual account history, current composition retrospective, fixed target strategy 중 어떤 노출 경로를 썼는지, 현금 포함 여부/현금 수익 가정, rebalance policy/frequency, return basis, period, currency/FX, RF series/model version을 저장한다. 현재 equity weights를 과거 하루 수익률마다 고정해서 계산한 값은 실제 계좌 path가 아니며, “daily fixed-weight” 또는 선택된 정확한 policy 이름으로만 노출한다. cash를 뺀 결과에 `whole_account` 표제를 붙이지 않는다. 구현 세부 및 독립 산술 fixture는 22 W22-I를 따른다.

### R24-05/06/06A 인수 및 복구 대장

| finding | 필수 반증 입력 | 성공 시 불변식 | 실패·복구 |
|---|---|---|---|
| `22:PFR08` | 의도 `[AAA 50%, BBB 50%]`, BBB 기간 전체 가격 없음; 별도 fixture는 기간 중간 gap | 실행 차단, 2-member 입력과 결측 사유 보존. AAA 100% 결과가 없어야 함. | blockedRun과 source revisions 저장. 사용자가 수정한 새 정의로 새 run. 가격 provider miss를 사용자의 제외 의도로 간주하지 않는다. |
| `22:PFR09` | equity 50/cash 50, equity −10%, cash return 0%; actual holdings history가 현재 구성과 다른 사례; daily/monthly/no-rebalance | 전체 계좌 −5%, sleeve −10%; 서로 다른 exposure path와 재조정 정책은 별개 result ID. | 미지원 경로는 보류. legacy 값은 read-only 비교로 두고 actual history로 이름 바꾸지 않는다. |
| `22:PFR10` | current quantity/price/FX snapshot 변경, 한 멤버 stale quote, 혼합 통화 cash | 새 snapshot에 valuation ID·as-of·수량·가격·FX·분모가 보존되고 같은 snapshot replay 시 같은 weights. | snapshot 생성 차단 또는 제한 상태. 누락 멤버 삭제·종점 가격 fallback으로 전환하지 않는다. |
| `22:PFR01`/`22:PFR06` 식별 충돌 | 목표가격만 설정/미설정, 목표비중만 설정/미설정, P1176 legacy reference | target price와 weight가 독립 타입이며 finding trace가 semantic title을 참조. | 기존 번호 alias를 crosswalk에 유지. 번호만으로 완료 처리하지 않는다. |

기존 snapshot/실행 ID, 원시 입력과 사용자 설정을 유지한다. 새 schema 전환에서 옛 실행의 누락 값을 현재 시세나 FX로 채워 과거 입력을 새로 꾸미지 않는다. 새 엔진이나 snapshot resolver가 실패하면 결과는 보류하거나 legacy 표시의 읽기 전용 산출물을 제공한다. 새 정의로 복구하는 경우 이전 blocked/legacy ID와 새 result ID를 서로 연결하되 덮어쓰지 않는다. 전체 시나리오와 calendar/휴장 구분, 금융 산술 검증은 22의 인수 fixture를 실행하기 전까지 미검증이다.
