# 07 — 스크리너 수식·선택 기준·순위 의미

> 역사 근거 주의: M01/M02/M06의 해당 합성 반증은 [v56 재검증](RECHECK-V56.md)에서 차단됐다. M03/M04/M05는 이 문서의 v55.22 근거이며 현행 미수정으로 확정하지 않는다. 구현 전 최신 코드에 반증을 다시 적용한다.

Astra 기획·설계 · 2026-09-20 · v55.22 / `54428470`. 제품 코드 수정 없음. 기관/펀드 업무에서 검증 가능한 리서치 스크리너를 목표로 하며, 운용 적합성 인증이나 수익 예측력 인증을 의미하지 않는다.

## v55.22 당시 결론과 우선순위

현재 도메인은 research-relative-ranking-only를 명시하고, 결측 lineage·coverage gate·동점 처리·실행 재현 hash 등 유용한 기반을 갖고 있다. 그러나 **사용자가 요청한 기준, 실제 적용된 기준, 표시된 순위의 연결**에 확인된 단절이 있다. 화면 이름 변경에 앞서 이 연결을 명시적 계약으로 고친다.

| ID | 확인된 사실 | 증거 수준 | 우선순위 |
|---|---|---|---|
| M01 | quality 가중치 100% 요청, quality 미가용 입력에서 momentum 100%로 대체해 8종목 순위 생성 | 합성 함수 실행 | P1 |
| M02 | 점수 null인 종목이 screenStatus=passed, screenRank=1, explanation=explained | 합성 함수 실행 | P1 |
| M03 | 개별 factorScores는 선형 z-score 변환값이나 ticker profile은 백분위로 설명 | 수식과 최종 writer 정적 추적 | P2 |
| M04 | 장기 검증 수집 함수가 adjusted close 결측을 raw close로 채워 adjCloses로 전달 | 정적 경로 확인; 실제 공급자 결측 빈도 미검증 | P1 |
| M05 | 63거래일 forward 구간이 21일 간격으로 겹치는데 IC 신뢰구간은 단순 표준오차 사용 | 정적 수식 확인; 실제 유의성 변화 미산출 | P2 |
| M06 | 포트폴리오 월말 자료 한 달을 빼면 같은 시작·끝 자산의 CAGR이 12.68%→13.65%로 변함 | 합성 함수 실행 | P1 |

P1/P2는 이 핸드오프의 구현 우선순위다. 배포 사고나 실제 투자 손실이 발생했다는 뜻이 아니다. [합성 실행 증거](factor-screen.json).

## M01 / W07-A — 요청한 전략을 결측 때문에 바꾸지 않기

근거: `src/domain/screener/factor-ranks.js`의 `sanitizeWeights:194`, active candidate 선정 및 적용 `computeFactorRanks:302,410`. active 집합에 남은 양수 가중치가 없으면 모두 동일 가중치로 바뀐다.

재현: 8개 종목, 유효한 최신 price lineage, ret1m/ret3m만 제공, weights={quality:1}. 결과 available=true, activeFactors=[momentum], appliedFactorWeights={momentum:1}, ranked=8. 사용자 UI에서 해당 profile이 저장 가능한지는 별도 확인 대상이지만 순수 도메인 API는 이 입력을 수용한다.

설계 결정: omitted weights와 explicit weights를 구분한다. omitted는 버전된 기본 모델을 사용한다. explicit의 양수 requested factors가 하나도 계산 불가능하면 `rankingState=unavailable`, `reason=requested-factors-unavailable`로 반환한다. 명시적 0을 양수로 바꾸지 않는다.

부분 결측도 가용 팩터만으로 재정규화하기 전에 **원래 요청 가중치 기준 coverage**를 계산한다. 최소 coverage와 필수 factor는 모델 계약에 둔다. 예: quality .9 + momentum .1에서 quality가 없는데 momentum1로 승격하면 안 된다. 허용된 부분 산출은 requested/applied/excluded weights와 손실 coverage를 함께 표시한다. 기본 모델의 정책도 동일하게 버전 관리한다.

인수: weights omitted, 정상 explicit, 전부0/음수/NaN, requested 하나 전부결측, 일부결측 경계 직전/직후, 전부유효. 연구용 자동 대체를 허용하려면 별도 사용자가 선택한 profile로 남기고 원래 profile 결과로 보고하지 않는다.

## M02 / W07-B — 필터 통과와 순위 산출을 분리

근거: `src/domain/screener/screen-engine.js`의 `contributionFor`, `makeExplanation`, `runScreen:139`. 기본 preset-quality는 ROE/마진/성장률 준비상태를 검사하지만 정렬은 기본 rank를 쓴다. 이 세 필드는 CURRENT, rank=null인 합성 입력이 통과·1위·explained를 반환했다. 필터 통과 자체는 타당할 수 있으나 점수가 없는 1위는 다른 의미다.

설계 결정: `filterState={passed,rejected,unknown}`, `rankingState={ranked,unavailable,not-requested}`, `explanationState`를 분리한다. passed 결과 목록에는 남길 수 있으나 점수 없는 항목에 ordinal rank를 주지 않는다. 화면은 ‘조건 통과 · 순위 산출 불가’로 보이고 결측 ranking field를 명시한다. 기존 compatibility `screenStatus`는 이 상태들의 투영으로만 유지한다.

동점은 같은 rank와 별도 stable displayOrder로 표현한다. tie-break에 instrumentId를 사용할 수 있지만 경제적 우열로 해석하지 않게 한다. 여러 필드의 단순 평균은 단위가 같아도 경제적 의미·분포·방향이 같다는 보장이 없다. registry의 동일 unit 검증은 유지하되 ranking expression에 transform/direction/weight/missing-policy를 명시한다. 이를 공통 점수 DSL로 크게 확장하기 전에 현재 preset에 필요한 연산만 지원한다.

인수: 필터통과+점수결측, 필터탈락+점수유효, 동일점수, 순서가 바뀐 동일 입력, 일부 ranking field결측, opposite direction의 지표. capture/replay에 새 engine version을 사용하고 과거 record의 의미를 조용히 바꾸지 않는다.

## M03 / W07-C — 정규화 점수와 백분위를 구분

`factor-ranks.js:148`은 `round(50+16.67*z)`를 0~100으로 제한하고 :494에서 factorScores에 저장한다. z=1이면67이다. 이것은 empirical percentile도 정규분포 누적확률도 아니다. 반면 composite rank는 eligible 집합의 동점 midrank로 별도 계산되므로 두 개념을 함께 변경하면 안 된다.

`index.html:11636`에는 ‘스크리너 유니버스 내 상대 백분위’ 설명이 있다. `js/aio-ui.js:7158–7197`은 SCREENER_DB.factorScores를 ticker profile 행과 radar에 그대로 투영하므로 수식과 문구의 연결을 정적으로 확인했다. screener 표의 factor 셀도 `src/ui/pages/screener.js:359`에서 factorScores를 직접 표시한다. 현재 버전 실제 ticker 화면의 정상 데이터 동선은 추가 브라우저 확인 대상이다.

우선 설계는 수식을 보존하고 명칭을 ‘섹터 기준 정규화 점수’로 정정하는 것이다. 백분위가 제품 요구라면 factor별 eligible cohort, sector/global fallback, 동점, 최소표본을 정의한 실제 순위 통계로 별도 버전 구현한다. 기존 값의 이름만 percentile로 바꾸지 않는다. rank 80을 기대수익률·성공확률80%로 설명하지 않는다.

## M04–05 / W07-D — 과거 검증의 가격축과 추론 경계

`scripts/backtest-factors-longrun.mjs:74–83`의 adjusted 결측 fallback은 raw와 adjusted를 같은 배열에 섞는다. 반면 `scripts/fetch-data.mjs`의 backtestFactors는 날짜 calendar를 정렬하고 adjusted 입력을 구분하려는 보호장치가 있다. 장기 수집기가 upstream에서 결측을 숨기면 downstream은 이를 구별하지 못한다.

수집 결과에 raw/adjusted를 분리하고 adjusted 결측·corporate-action 상태를 보존한다. 계산 불가능한 창은 제외 사유와 기간별 coverage를 남긴다. 분할·배당 전후 fixture를 통해 raw fallback이 유효 adjusted로 승격되지 않는지 검사한다. 이번 감사는 네트워크 수집이나 전체 백테스트 재생성을 실행하지 않았다.

같은 파일 `computeICIR:200`의 se=std/sqrt(n), ci=mean±1.96*se는 의존성 조정이 없다. 중첩된 forward 구간에 대해서는 naive 기술통계임을 명시하고, 추론이 필요하면 HAC 또는 시간 block bootstrap 중 적절한 방법을 사전에 선택·버전 관리한다. 짧은 표본, 다중 horizon/factor 탐색, regime 분할의 선택 편향도 함께 보고한다. 방법 변경 후 유의성이 어떻게 달라지는지는 실제 계산 없이 주장하지 않는다.

현재 top-mcap 생존 종목과 4/7 factor 부분 검증이라는 자체 한계 표시는 유지한다. 단일 train/holdout 분할이 반복 재학습 rolling walk-forward와 같은 절차는 아니다. 전체 live 모델·PIT universe·유동성·비용·기업행동 조건의 parity가 없으면 운용 모델 검증 완료로 승격하지 않는다. 현재 코드가 이를 제한하는 researchBoundary는 보존한다.

## M06 / W07-E — 월별 성과의 시간축 보존

`src/domain/portfolio/backtest.js`의 `buildPortfolioBacktestLab`은 공통 월 키를 추리고(:309), 인접한 공통 원소를 한 달 수익률처럼 처리한다(:373). :437–443은 수익률 행 수를 nMonths로 사용하여 CAGR과 연율화를 계산한다. 공통 월에서 중간 한 달이 빠졌을 때 실제 두 달 구간이 한 달로 압축된다.

2024-01→2025-04의 매월 1% 성장한 동일 adjusted series를 자산/benchmark에 제공했다. 전체16월 관측은 CAGR12.6825%, 중간8월만 제거한15월 관측은 CAGR13.6477%였다. 시작·끝 값과 실제 경과15개월은 동일하다. 빠진 구간은 9월 monthlyReturn=2.01%로 처리됐다. [합성 증거](backtest-calendar.json). 이는 참고용·승격금지 표시가 있어도 정정해야 하는 산식 문제다.

설계 결정: 월별 모델은 연속된 monthly grid를 선행 조건으로 삼는다. 중간 결측을 채운 척하거나 여러 달 수익률을 한 달 표본에 넣지 않는다. 우선은 gap을 반환하고 해당 월별 성과 산출을 보류한다. 사용자가 선택한 충분한 연속 구간으로 축소할 수 있다면 실제 시작·종료와 제외 구간을 명시한다. 비정규 기간을 지원하는 새 모델은 별도로 설계한다.

CAGR의 경과 시간은 행 수가 아니라 실제 기간으로 검증한다. 다만 분모 하나만 바꾸면 Sharpe/Sortino/변동성/회전율·리밸런싱의 월별 의미는 여전히 틀리므로 완료로 보지 않는다. 인수: 중간1월/여러월 결측, 비동시 월말 제외로 생긴 gap, 연말 리밸런스 누락, 동일기간 정상연속, 최소표본 경계. 실제 producer가 이런 gap을 얼마나 생성하는지는 미측정이다.

## R24-04 / W07-G — 관측 세트, 계산 입력, 결과의 정체성 분리

[현재성 판정](25-CURRENT-FINDING-STATUS-CROSSWALK.md)은 P1177 quote churn의 특정 차단과 R24-04 live mcap 입력 정체성 공백을 분리해 `열림`으로 둔다. 구현 인수와 E2 실행 순서는 [26 실행·인수 계획](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)에 연결한다.

[독립 감사 R24-04](24-INDEPENDENT-STRUCTURAL-REVIEW-20260923.md)의 재현은 저장된 실행이 실제로 덮어써졌다는 관찰이 아니다. 확인된 경로는 provider의 live market cap이 `size` 팩터 입력으로 들어가고, `snapshotIdentityRows`가 최상위 quote 필드를 제거해도 중첩 `fieldReadiness`/`fieldObservations`에 live 값·시각·revision이 남는다는 것이다. 같은 시점에 live mcap만 1B에서 10B로 바꾼 합성 입력에서 AAA 점수/순위가 75/100에서 25/0으로 바뀌었고 당시 snapshot ID도 달라졌다. 최근 P1177의 “background quote tick은 ranked snapshot을 교체하지 않는다” 계약은 유지해야 하며, 새 mcap 계약이 그 불변식을 모호하게 만들지 않도록 ID의 의미를 좁힌다.

계산 입력에서 사용한 **모든 경제값과 lineage**가 실행의 불변 입력이다. ID 세 종류를 분리한다.

```text
observationSetId = screener artifact + universe + publication member revisions
                   + PIT/as-of + schema/model-validation revisions
calculationInputId = observationSetId + definition/model/engine version
                     + factor input policy + 실제 소비한 값과 관측 envelope
resultId/resultHash = calculationInputId + 정렬된 결과·상태·설명 출력
```

`observationSetId`는 출판된 artifact/universe 관측 세트를 식별하며 live quote가 변해도 유지된다. `calculationInputId`는 해당 run이 실제 소비한 입력을 식별하므로 live 입력 모드에서 mcap 값 또는 revision이 바뀌면 달라진다. `resultId`는 동일 입력·정의·엔진에서 결정적이어야 한다. 화면에 보이는 호환 `snapshotId`는 향후 `observationSetId`의 alias로만 쓴다. 같은 snapshot ID 아래 다른 산출 결과를 같은 저장 run으로 취급하지 않는다.

**기본 선택 제안:** 재현 가능한 cross-sectional research 결과를 위해 size 팩터는 스크리너 artifact에 고정된 market cap 입력을 기본으로 사용한다. 해당 필드가 없거나 관측 허용성·통화·시점·품질이 맞지 않으면 size 팩터는 unavailable로 두고 적용 가중치/coverage 규칙을 따른다. 화면 최신 quote는 참고 오버레이로 유지해도 rank 입력으로 자동 승격하지 않는다. 제품이 최신 live mcap 순위를 별도 지원하기로 결정하면 `live_capture` 모드를 별도 정의 버전으로 도입한다. 이 모드는 한 번의 실행 시작 시 quote envelope 전체를 동결한 새 계산 입력으로 저장하고, 다음 tick은 새 run을 만들 뿐 이전 run을 갱신하지 않는다. 두 모드를 한 rank profile 안에서 조용히 교체하지 않는다.

기본 artifact 정책에는 producer 계약도 필요하다. Published row는 identity-bound `marketCapObservation={value,currency,observedAt,fetchedAt,sourceId,revisionId,sourceKind,rightsId,qualityStatus,allowedUse}`를 제공하고 value unit을 단일하게 정의한다(예: USD billions). Provider는 instrument/listing·통화·시각·freshness·권리 검증을 통과한 이 필드만 `sizeRaw` 입력으로 projection한다. Producer가 해당 envelope를 아직 발행하지 않으면 size는 비활성이고 live quote를 암묵적 대체로 넣지 않는다. 역사 relative-rank와 point-in-time backtest는 요구 관측일에 맞는 과거 mcap/universe가 있어야 하며, 현재 시총을 과거 입력으로 소급해서 쓰지 않는다.

### 실행 저장 envelope

capture record에는 최소한 `observationSetId`, `calculationInputId`, `resultId`, definition hash, model/engine versions, ordered instrument IDs, factor별 실제 입력, 포함/제외/결측 상태, `value/unit/currency`, `observedAt/fetchedAt`, source/sourceKind, rights, quality, `revisionId`, allowed-use, calendar/PIT 기준, 실행 시각과 stable display order를 저장한다. 계산에 소비하지 않은 UI-only quote 오버레이는 계산 입력 해시에 넣지 않으며, 계산에 소비한 값을 저장 record에서 제외하지 않는다. Replay는 네트워크나 현재 `readLiveData`를 다시 읽지 않고 capture된 입력만으로 같은 결과·설명을 복원한다.

현재 구현의 live mcap을 hash 대상에서 예외 처리하는 얕은 키 목록은 충분한 경계가 아니다. provider는 입력 projection을 명시적 allowlist로 구성한다. `observationSetId`에는 artifact/universe에 귀속된 값만 들어가고, runtime overlay의 직접 키와 중첩 readiness/observation envelope는 들어가지 않는다. 선택된 live input envelope는 별도 `calculationInputId`에 정확히 한 번 canonicalize해 들어간다. 알 수 없는 중첩 live field가 identity 안팎에 우연히 남는 경로는 허용하지 않는다.

인수 fixture와 결과:

| fixture | 기대 계약 |
|---|---|
| artifact/universe/definition은 같고 live mcap만 1B→10B, 기본 `artifact` 정책 | `observationSetId`, `calculationInputId`, size 점수·rank, 기존 결과가 모두 유지된다. live 참고 표시만 바뀔 수 있다. |
| 동일 조건, 명시 `live_capture` 정책으로 mcap이 1B→10B | `observationSetId`는 고정되고 `calculationInputId`/새 `resultId`는 변경된다. 첫 capture의 저장 run과 replay는 불변이다. |
| 최상위 mcap은 같지만 중첩 readiness/observations의 값·시각·revision만 변경 | 기준 ID가 바뀌지 않는다(해당 nested data가 UI-only live overlay인 경우). 실제 계산에 소비한다면 선택된 envelope에 포함되어 `calculationInputId`가 바뀐다. |
| quote source가 실패하거나 stale/권리 차단/통화 불일치 | 이전 capture는 replay 가능하다. 현재 기본 run의 size 입력은 막히며 오래된 mcap 또는 무검증 USD 대체로 계산하지 않는다. |
| artifact, universe membership, factor 정의, model validation, engine version 각각 변경 | 입력 사용 여부에 맞는 ID 단계가 결정적으로 바뀌고 `resultHash`만 다른 경우도 함께 검사한다. |

이행: 기존 capture의 저장 ID와 결과는 보존하고 `legacy_identity_semantics`를 부여한다. 당시 저장 입력이 충분하지 않으면 현재 live feed로 옛 run을 재구성했다고 주장하지 않는다. 신규 writer/reader가 나란히 같은 captured fixture를 읽고 결과와 ID를 검증한 뒤 alias를 전환한다. 전환 오류 시 새 live capture rank를 보류하고 저장된 예전 실행을 읽기 전용으로 제공한다. P1177의 quote tick이 저장 run을 바꾸지 않는 회귀 조건을 계속 유지한다.

## 사용자가 이해해야 하는 최종 흐름

화면 상단은 `관측 시점/유니버스 → 사용 가능 데이터 → 필수 조건 통과 → 실제 적용 팩터 → 순위`의 단계별 건수를 보여준다. 숫자는 같은 run/snapshot에 속해야 한다. 제외 종목도 제외 사유를 확인할 수 있어야 한다.

종목의 ‘왜 이 순위인가’에는 (1) 조건의 실제값/기준값/판정, (2) 팩터 원값→변환값→비교집단→기여도, (3) 요청/적용 가중치, (4) 결측/반대 근거, (5) 출처·관측일·모델버전이 연결된다. 첫 화면은 짧게 표시하고 계산 상세는 펼친다. confidence는 입력 충분성인지 예측확률인지 구분한다.

한 종목 상세를 연 뒤 돌아와도 같은 run 기준을 유지한다. 새 데이터가 들어오면 새 run임을 알리고 이전과 순위 변화의 원인(값 변화/유니버스 변화/모델 변화)을 분리한다. 재현 record hash만 저장하고 사용자가 그 실행을 확인할 수 없으면 설명 가능성은 완료되지 않는다.

## 전문성 판단의 기준과 한계

백분위는 순서통계 정의를 기준으로 검토했다([NIST](https://itl.nist.gov/div898/handbook/prc/section2/prc262.htm)). backtest의 시점·생존편향·실제 과정 재현 검토는 [CFA Institute Backtesting and Simulation](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/backtesting-and-simulation)을 참고했다. screening/ranking 모델의 적절한 검증을 요구하는 전문적 기준은 [CFA V(A)](https://www.cfainstitute.org/standards/professionals/code-ethics-standards/standards-of-practice-v-a)와 비교했다. 이 자료들은 AIO가 특정 자격·규제·기관 인증을 충족한다는 근거가 아니다.

아직 전수 점검하지 않은 범위: SEC PIT/정정공시, sector별 재무 비교 적합성, technical 모든 창과 warmup, trading-score/macro 중복 노출, portfolio 나머지 통계·실제 수집 calendar, 실제 사용자 설명 이해도. 함수 대장에 개별 상태로 남긴다.
