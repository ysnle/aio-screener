# 포트폴리오 성과·위험의 근본 재설계

2026-09-22 · 설계·집필 Astra. 코드 조사 GPT-5.6 Luna MAX. 제품 수정 없음. 11의 저장·통화 계약 및19의 공통 식별·시간 계약을 전제로 한다.

## 판단

**v56.15 현재성 보강:** [23의 재검증](23-CURRENT-BASELINE-AND-ALLOCATION-CONTRACT.md)을 먼저 확인한다. PFR06 목표가 정규화는 수정 확인, PFR01 종점 초기 배분은 root 실행으로 잔존 확인했다. 명시적 0/부분 비중 폴백의 신규 PFR07도23에 추가했다. 아래 표는 최초 발견 시점의 근거다.

현재 보유구성의 과거 시뮬레이션, 실제 계좌 성과, 현재 위험 추정을 서로 다른 제품 결과로 정의해야 한다. 같은 '수익률 비교' 아래 합치면 더 정교한 차트를 그려도 의미 오류가 남는다. 기존 계산 경로 보존을 전제하지 않는다.

## 근거와 증거 수준

| ID | 로컬 코드/관측 | 의미와 한계 |
|---|---|---|
| PFR01 | `src/domain/portfolio/backtest.js:368–399`: targetWeight없으면 기간 마지막 adjusted close×qty로 초기비중 생성. UI는 target가격만 저장(`js/aio-workspace.js:1266–1285` 경로) | 미래 종점 정보를 시작 배분에 사용. Luna 합성 A100→1000/B100→50 동일수량에서95.24/4.76% 배분·종료95476, 명시50/50이면52500 보고. 실제 사용자 계좌 성과 재현이 아님 |
| PFR02 | 현금은 요약 총자산에 포함(`js/aio-workspace.js:753–762`, `src/domain/portfolio/surface.js:207–232`)되나 일일위험 weights는 positions만 정규화(`:889–918`) | 주식50/현금50, 주식−10%면 전체−5%인데 주식경로−10%. 위험 크기를 계좌전체로 오해. Sharpe/MDD의 오차 방향은 데이터와현금수익에 따라 달라지므로 일률 과대평가로 단정하지 않음 |
| PFR03 | `js/aio-workspace.js:924` SharpeRF0.043; :1111표시. 월간 :1282–1284RFnull | 서로 다른 RF/주기/표본 계약. 날짜·출처·만기 없는 상수로 같은 위험 의미를 제공하지 못함 |
| PFR04 | `js/aio-ui.js:7289–7384`: raw close, 현재 비중 과거적용, 상위10밖은30일 선형보간 | 현재구성 retrospective 참고도와 실제 계좌·배당 재투자 수익 경로를 분리. 브라우저에도 선형추정 고지 확인 |
| PFR05 | `src/domain/portfolio/backtest.js:316–324,501–505`:14개월=13수익률로5%VaR/CVaR허용 | Luna 합성[−20%,+1%×12]에서VaR7.4/CVaR20%,tail1개 보고. 수치 자체를 충분한 꼬리위험 추정으로 제시할 수 없음 |
| PFR06 | 입력`js/aio-workspace.js:375,405`target미입력→0. native`src/ui/pages/portfolio.js:246`0을금액표시. normalize`src/data/normalize/portfolio.js:33`0보존 | 9/21합성입력,9/22로컬브라우저 재확인: 목표미입력이$0.00. 유효현재가가있으면−100%잠재수익으로해석될 후보경로(:247–248)는 이번 브라우저에서 미관측 |

Luna의 합성 결과는 조사 보고이며 이 문서 작성 중 root가 동일 probe를 다시 실행한 원시 파일은 없다. 구현 에이전트는 아래 fixture를 재현해 독립 인수해야 한다. 브라우저 관측은21과 연결한다. 로컬 코드 발견을 다른SHA의 라이브 코드 결함으로 자동 승격하지 않는다.

## 최종 도메인 경계

**Valuation:** 관측시각의 보유수량·현금·부채·가격·FX로 평가한다. quote누락은 총자산의 일부미평가이며 나머지를100%로 재정규화하지 않는다. 종목비중은 주식내 비중과 총자산비중을 별도 필드로 제공한다.

**Account performance:** 거래·입출금·배당·수수료·세금·FX의 기간별 원장을 확보했을 때 실제 성과를 산출한다. TWR와MWR/IRR은 목적을 분리하고 현금흐름 시점을 고정한다. 현재보유수량만으로 과거 계좌성과를 만들어내지 않는다. 원장없으면 '실제 성과 계산 불가'로 명확히 표시한다.

**Research simulation:** 사용자가 명시한 시작배분 또는 시작시점 기준으로 평가한 구성과 리밸런싱 정책을 사용한다. 현재구성의 과거 적용은 그 이름을 그대로 쓰고 생존편향·선택편향을 설명한다. 기간 마지막 가격으로 초기배분을 역산하는 폴백은 폐기한다. 비용/체결/배당/기업행동/FX정책과 universePIT가 없으면 실전성과 검증으로 승격하지 않는다.

**Risk estimate:** 측정 대상(account전체/equity-sleeve),일/월주기,표본날짜,최소관측수,현금수익,RF시계열,FX,모형버전을 입력계약으로 받는다. VaR/CVaR은 confidence·horizon·quantile방법·tail표본수를 결과로 내보낸다. 적은 표본은 보류하거나 제한된 탐색값으로 표시하며 근거없는 보편최소치 하나로 인증하지 않는다. 선택한 방법의 표본안정성·bootstrap/민감도검증 후정책을 확정한다.

각 결과는 공통 PortfolioDefinition/ValuationSnapshot을 참조하지만 performance와risk의 시계열을 암묵적으로 공유하지 않는다. 반드시 동일 기간·통화·수익률 정의로 benchmark를 맞춘다. 연율화 규칙과 RF변환을 계산모듈 하나가 소유한다.

## 사용자에게 보여줄 흐름

상단에서 '현재 평가 / 실제 성과 / 구성 시뮬레이션 / 위험 추정'을 구분한다. 각 영역에 **무엇을 측정했는지→기간·통화→포함/제외 자산→근거→한계**를 짧게 제공한다. 사용자의 다음 행동은 원장가져오기, 누락시세 재시도, 현금입력, 시작배분 확인처럼 부족한 입력을 해소하는 과업으로 연결한다.

예를 들어 주식 $100과 현금 $900이면 전체 자산의 주식 노출은 10%, 주식 내 A 비중은 100%다. 둘을 동시에 표시한다. 'Sharpe 1 이상 양호', 'MDD 20% 권장', 'drift 5%p 리밸런싱'은 목적·기간·위험 정책 없는 보편 규칙으로 쓰지 않는다. 사용자 설정, 기관 운용 지침, 교육 예시 중 어느 것인지 명시하고 실제 실행과 분리한다. 목표가격과 목표비중은 서로 다른 타입이다.

## 이전·소유권·복구

1. normalizer는 nullable targetPrice와 nullable targetWeight를 구분한다. 과거 0은 당시 버전의 미입력 직렬화 증거가 있는 경우에만 null로 이전한다. 원본 로컬 자료의 복구 사본과 schemaVersion을 유지한다.
2. portfolio domain이 valuation/performance/simulation/risk를 각각 소유한다. workspace/UI에 남은 산식을 domain으로 이전하고 UI는 resultId와 표현 모델만 소비한다.
3. 기존 risk/benchmark 값을 새로운 성과로 마이그레이션하지 않는다. 과거 산출물에는 기존 모형 표시를 남기고 새 입력 계약으로 재계산한다.
4. 기존·새 경로의 결과를 병행 비교한 후 영역별로 전환한다. 회귀 시 이전 표현으로 돌아갈 수 있으나, 폐기한 미래 정보 배분이나 선형 추정을 실제 성과로 복원하지 않는다. 불확실하면 해당 결과를 보류하는 것이 복구 정책이다.

## 구현 순서와 완료 조건

| 순서 | 작업 단위 | 독립 인수 fixture |
|---|---|---|
| 1 | 목표·현금·통화 정의 | 미입력 target→미설정; 0/null/NaN 구분; 주식 100/현금 900→총자산 주식 10% |
| 2 | 초기 배분과 시점 | A/B 동일 시작 가격·수량은 50/50. 미래 마지막 가격 변경이 초기 비중을 바꾸면 실패 |
| 3 | 계좌와 주식 부분 위험 | 주식 −10%/현금 50%·현금 수익 0→전체 −5%, 주식 부분 −10%. 표제와 분모 일치 |
| 4 | 수익·RF·benchmark | 배당/분할/입출금/FX/수수료가 있는 고정 원장. 같은 통화·기간·총수익 정의. RF 미확보는 보류 또는 명시적 가정 |
| 5 | 표본·꼬리위험 | 수익률 13개·tail 1개에서 confidence/horizon/n/tailN 노출, 인증 상태 보류. 표본 증가·극단치 변경 민감도 확인 |
| 6 | 실제 화면 동선 | 빈 계좌→합성 보유→가격 실패→복구→현금 입력→기간 변경→위험 설명. 오래된 결과가 새 배분에 붙지 않음 |

금융 정의 인수는 실행 PASS와 별개다. 신규 성과 모형은 독립 산술 예제와 외부 검증된 기준 방법을 대조한 뒤 확정한다. 기관/펀드급이라는 목표는 이러한 측정·재현·감사 계약을 충족하는 것으로 평가한다.

## 2026-09-23 독립 감사 보강 — 누락 멤버, 위험 경로와 현재 구성 기준

[현재 판정표](25-CURRENT-FINDING-STATUS-CROSSWALK.md)에서 22:PFR08–10/R24-05/06/06A는 v56.15 현재 경로의 미해결 설계·입수 계약으로 남는다. 실행 패키지 E3/E4의 선후관계, 입력 차단과 승인 증거는 [26 실행·인수 계획](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)을 따른다.

이 보강은 [R24-05/06/06A](24-INDEPENDENT-STRUCTURAL-REVIEW-20260923.md)에서 확인한 정적 경로를 구현 명세로 내린다. 현재 `backtest.js`에서 가격 이력이 없는 종목을 먼저 버리고 남은 종목으로 비중을 재정규화하는 경로는 잘못된 계좌 손실이 관찰됐다는 주장이 아니라, 실행 전 fail-closed 인수가 빠진 위험이다. `refreshPortfolioRisk`의 현재 구성 비중을 과거 각 일별 수익률에 적용하고 cash를 제외하는 경로 역시 실제 과거 보유경로라고 표시하지 않는다.

### W22-H — 의도한 멤버 전체의 가격 경로를 먼저 검증

AllocationSnapshot 정규화 전에 simulation input resolver가 다음을 확정한다.

```text
SimulationInputSnapshot = {
  runRequestId, allocationSnapshotId, priceUniverseSnapshotId,
  requestedWindow, resolvedWindow, returnBasis, calendarAlignmentPolicy,
  intendedMembers: [{ instrumentId, inclusion, targetWeight, coverageState,
                      missingRanges, priceRevisionIds, nativeCurrency,
                      fxRevisionIds }],
  cashMember, unresolvedInputs, validationStatus
}
```

`intendedMembers`는 사용자가 선택한 계좌/전략 구성에서 만든다. Price provider가 데이터를 반환한 종목만으로 대상 집합을 역산하지 않는다. 각 포함 종목에 대해 요청 시작일 이후 필요한 관측 이력, 선택한 조정가격/총수익 basis, 기업행동 처리, 허용된 날짜 정렬과 quote freshness, 필요한 FX 경로를 검사한다. 서로 다른 거래소 달력은 버전이 있는 alignment policy와 최대 허용 staleness를 사용한다. 휴장일과 실제 결측을 구분하되, 정책이 설명할 수 없는 gap을 연속 관측처럼 채우지 않는다.

**기본 정책은 차단이다.** 의도 멤버 하나라도 전체 기간을 뒷받침할 입력이 없거나 required gap이 있으면 run은 `blocked`/`incomplete-inputs`로 끝나고 누락 종목·구간·사유를 제공한다. 그 멤버를 삭제한 후 나머지를 100%로 정규화하지 않는다. 자동 대체, 가격 forward-fill, raw-close를 adjusted series에 섞기는 별도 명시 모델과 근거 없이는 금지한다. 사용자가 종목을 제외하거나 명시 현금/잔여 처리 방식을 바꾸면 새 AllocationDefinition과 새 run ID로 계산한다. 명시 `weight=0, inclusion=exclude`는 애초 의도 멤버에서 제외된 것으로 보존되며, 미지정/null을 제외로 바꾸지 않는다.

실패한 입력 검증도 재현할 수 있도록 `blockedRun`에는 요청 기간·AllocationDefinition·누락 membership·가격/FX artifact revision·validator version을 저장한다. 차단된 결과를 performance/risk series, benchmark 비교, UI chart의 정상 결과로 내보내지 않는다. 사용자가 고친 뒤에는 별도 실행을 만든다. 원래 요청 ID와 차단 기록은 보존한다.

### W22-I — 위험 추정이 실제로 계산한 경로와 분모를 선언

`RiskEstimate`는 최소한 아래 입력을 고정한다.

```text
exposureHistoryMode:
  actual_account_history
  current_composition_retrospective
  fixed_target_weight_strategy
weightBasis: whole_account | invested_sleeve
cashTreatment: observed_cash_series | explicit_assumption | excluded_by_scope
rebalancePolicy: none | daily | weekly | monthly | threshold_rule | transaction_history
asOf / requestedWindow / resolvedWindow / baseCurrency / inputSnapshotIds
returnBasis / rfSeriesId / fxPolicyId / modelVersion
```

- `actual_account_history`는 날짜별 보유수량, 현금, 외부 입출금, 거래/수수료·배당/기업행동과 평가 cut을 재현할 자료가 있어야 한다. 현재 holdings를 과거 날짜로 복사해 채우지 않는다.
- `current_composition_retrospective`는 특정 `ValuationSnapshot`에서 정한 현재 구성으로 과거 시장 경로를 계산한 가상 분석이다. 시작 weight snapshot과 이후 `rebalancePolicy`를 명시하고 UI에 “현재 구성을 과거에 적용한 분석”으로 표시한다. 계좌의 실제 과거 수익률이나 실제 과거 위험으로 이름 붙이지 않는다.
- `fixed_target_weight_strategy`는 목표 weight, rebalance 일정/트리거, 비용·세금·체결 가정과 현금 수익 정책이 정해진 전략 시뮬레이션이다. `none`은 매일 목표 weight로 다시 맞추는 것과 다른 모델이다.

현금은 선택한 `weightBasis`에 맞춰 분모와 시계열에서 일관되게 다룬다. 계좌 전체 위험을 요청했는데 cash amount 또는 cash return series가 없으면 cash를 조용히 버리지 않는다. 사용자가 별도 0% return 등 `explicit_assumption`을 확인하거나 현금 제외 scope를 택할 때만 그 가정을 결과에 표시한다. 금리·RF는 현금 수익과 동일하지 않으며 둘 다 입력에서 분리한다. equity sleeve만 측정할 경우 분모·표제에서 이를 밝힌다.

`refreshPortfolioRisk`의 기존 current weights + historical return path는 사용 목적과 rebalance semantics가 확인될 때까지 `legacy-risk-path`로 보존하되 새 결과에는 승격하지 않는다. 새 `RiskEstimate`가 기존 값을 제자리에서 덮지 않는다. 필요한 holdings history가 없으면 actual-history 결과를 보류하고, 독립 snapshot을 택한 retrospective 결과만 그 이름과 제한 아래 허용한다.

### W22-J — current-composition-retrospective의 valuation basis 고정

PFR의 `current_composition_retrospective`는 한 개의 immutable `ValuationSnapshot`에서만 비중을 해석한다. 계좌 구성 스냅샷은 최소 다음을 포함한다.

```text
compositionSnapshotId / valuationSnapshotId / accountRevision
compositionAsOf / valuationCut / baseCurrency / fxPolicyId
weightBasis: whole_account | invested_sleeve
members: [{ instrumentId, inclusion, quantity, quantityUnit,
            nativeMarketValue, priceCurrency, priceObservedAt,
            priceSourceRevisionId, baseMarketValue, resolvedWeight,
            fxPath, fxRevisionIds }]
cashByCurrency + convertedCashWeights + excludedOrUnresolvedMembers
```

`resolvedWeight`의 산술 분모가 `whole_account`인지 `invested_sleeve`인지 snapshot과 화면 모두에 기록한다. 전체 자산 기준이면 모든 통화의 현금과 필요한 부채도 같은 cut으로 변환해 분모에 넣는다. 투자 종목만 100%로 표시하는 경우에는 invested-sleeve라고 분명히 한다. 구성원 가격 시각·FX 시각·시장 평가 시각은 서로 바꿔 쓰지 않으며 허용 신선도 정책을 만족하지 않는 관측은 기준 snapshot을 막는다.

현재 수량만 확보되지 않거나, 일부 종목 가격/FX가 없거나, 계좌 cash 통화가 확인되지 않으면 resolved allocation을 만들지 않는다. 손실 멤버를 빼고 다시 weight를 나누지 않는다. 종점 가격×수량은 snapshot을 재현할 때만 사용할 수 있고, 과거 기간의 시작 구성 폴백으로 사용하지 않는다. 새 quote가 들어오면 새로운 composition/valuation snapshot과 retrospective run을 만든다. 이미 저장된 과거 run은 처음 캡처한 `compositionSnapshotId`와 allocation으로 재생한다.

### 독립 인수 fixture

| fixture | 기대 결과 |
|---|---|
| intended `[AAA 50%, BBB 50%]`, BBB 전체 기간 가격 이력 없음 | 계산 차단, member set `[AAA, BBB]`와 BBB 누락 이유 보존. AAA 100% 성과를 내지 않음. |
| BBB 중간 기간에 required price gap | calendar/holiday alignment가 이를 정상 관측으로 설명하지 못하면 차단. 해당 월/일을 한 표본으로 압축하지 않음. |
| 사용자가 BBB를 명시 제외하고 새 run을 시작 | 새 AllocationDefinition/run ID. 기존 50/50 요청과 차단 이력은 바뀌지 않음. |
| `[AAA 50%, BBB 50%]`에서 BBB 비중을 현금 잔여로 명시 선택 | AAA/BBB 의도 또는 현금 잔액, 정책, 분모, 화면 설명을 snapshot에 저장. 다른 종목 비중을 자동으로 100% 재정규화하지 않음. |
| 한 날짜의 cash=50%, equity=50%, equity return=−10%, cash return=0% 명시 | whole-account return −5%; invested-sleeve return −10%. 같은 숫자를 두 scope 제목으로 표시하지 않음. |
| 동일 주식 두 종목, 현 보유비중 50/50, 과거 실제 holdings 100/0→0/100 | `actual_account_history`와 `current_composition_retrospective` 결과/ID가 구분된다. 하나를 다른 모드의 기록으로 표시하지 않음. |
| 같은 target weight에서 `none`/월간/일간 rebalance | 서로 다른 정책 ID와 재현 가능한 결과. 비용 가정을 포함하고 fixed-weight 주기 의미를 설명. |
| 현재 A/B 주가 또는 FX만 변경 | 새 valuation/composition snapshot과 새 run ID. 과거 capture 결과의 weight, 가격·FX basis, risk가 변하지 않음. |
| 계좌 전체 risk에서 cash return 미입력 | 보류하거나 사용자 선택한 명시 가정/범위를 기록. cash를 버린 기존 equity-only 값으로 total risk를 표시하지 않음. |

### 순서·이행·복구

1. AllocationDefinition의 `0/null/제외/현금` semantics(`23:PFR07`)를 먼저 확정한다.
2. W22-H의 intended member/price-history coverage와 W22-J의 valuation snapshot이 통과해야 AllocationSnapshot과 SimulationInputSnapshot을 봉인한다.
3. W22-I risk path를 `actual history`와 제한된 retrospective/strategy 경로로 분리한다. 통화·cash/rf와 동일 as-of 계약은 11을 따른다.
4. 각 단계에서 legacy output은 식별을 보존해 read-only로 비교한다. 신규 결과가 차단되면 새 결과를 `unavailable`로 표시하고 이전 결과를 실제성과로 승격하지 않는다.
5. 복구 시점에는 실패 run과 입력 snapshot을 그대로 보관하고, 원인이 해결된 후 새 revision/run을 발행한다. 누락 멤버를 삭제하거나 종점 weight로 되돌리는 fallback은 복구 동작이 아니다.

완료는 합성 산술·누락/휴장·현금·rebalance·통화·snapshot replay, 저장 실행 재현, 그리고 사용자 화면에서 모드/분모/누락 사유가 같은 내용을 설명하는 것까지다. R24 발견의 재현은 정적/합성 경계이므로 라이브 시세, 실제 계좌 원장, 사용자 금융 의사결정 적합성은 별도로 검증한다.
