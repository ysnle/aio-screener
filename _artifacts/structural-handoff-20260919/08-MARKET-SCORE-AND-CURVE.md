# 08 — 시장 점수와 거시 연결의 해석 경계

Astra 설계 · 근거 조사 Luna MAX · 2026-09-20 / v55.22 / `54428470`. 연구 설명과 실제 운용 의사결정은 동일 계약이 아니다.

## H01 / W08-A — 표본 부족을 강한 리더십으로 표시하지 않기

`src/domain/market/health.js:36`의 `computeMarketHealth`는 SPY·QQQ 등락률과 VIX가 있으면 available을 반환한다. M7은 수신된 개수만 분모에 넣어 1/1 상승에도 +8과 ‘강한 리더십’을 준다(:66–82). MA/ATH/sector 누락은 missing/partial로 반환되지 않으며 status=current이다(:138–145).

root 합성 실행: SPY0%, QQQ0%, VIX20, AAPL+1%만 입력 → score50, current, missing=[], ‘M7 1/1 상승 (강한 리더십)’, trend bar50. [증거](market-health.json). 이 표본에서 M7 전체와 추세 중립이 관측된 것은 아니다. upstream freshness gate가 있어도 표본 completeness는 별도다.

`src/ui/pages/analysis.js:258–263`은 점수 구간별로 포지션 축소·현금비중 확대·타이트한 손절 같은 전략 문구를 붙인다. 참고 지표의 불완전 입력이 행동 지침처럼 전달되는 연결이므로, model의 참고용 선언만으로 충분하지 않다.

설계: component마다 expectedUniverse, observedCount, missingIds, minimumCoverage, contribution, freshness를 반환한다. M7의 분모는 7개 집합임을 보존하며 현재 관측비율과 상승비율을 분리한다. 최소표본 미달이면 ‘1/7 수신 · 리더십 판단 보류’로 표시한다. MA 결측 bar는50이 아니라 unavailable이다. 전체 점수는 coverage 정책을 만족할 때만 산출하고 partial 상태를 전파한다.

단순 합성 점수에서 자산배분/손절 행동을 자동 생성하지 않는다. 우선 화면을 관측 해석과 확인할 추가 근거로 구성한다. 별도 검증된 의사결정 정책이 있다면 그 policy와 eligibility를 명시적으로 연결한다. 사용자별 적합성이나 전략 승인을 추정하지 않는다.

인수: M7 0/7,1/7,6/7,7/7, sector 부족, MA만 결측, 최신성 다른 quote, valid zero. 숫자와 coverage·해석 문장이 같은 viewmodel에서 나와야 한다. 실제 네트워크에서 부분수신 빈도는 미측정이다.

## H02 / W08-B — 수익률 곡선의 두 시점 정렬

Luna 정적 추적: `src/ui/pages/market.js:518–567`의 renderMacro는 `_live2Y`/DGS2와 ^TNX를 직접 빼서 2s10s와 역전 해석을 표시한다. `_live2Y`는 FRED DGS2 경로(`js/aio-data.js:3187–3191`)다. 같은 날짜의 FRED spread를 우선하는 `src/domain/macro/treasury-curve.js:63–73`의 deriveTreasuryCurveEvidence와 renderer 계산 경로가 다르다.

설계: 두 leg에 instrumentId, tenor, yield unit, observedAt, session, provider를 갖춘 curve evidence를 만들고 native helper를 단일 계산 소유자로 둔다. 공식 same-date spread가 있으면 그 값을 사용한다. 다른 시점 leg의 차이는 별도 ‘혼합 시점 참고 계산’으로만 표시하며 실시간 동일시점 curve로 부르지 않는다. 각 leg의 시각과 차이를 보여준다. 허용 age/시차는 사전에 정한 관측 빈도 기준으로 둔다.

인수: 같은 날, 다른 날, 한 leg stale, percent/basis-point 혼합, 공급자 교체, 음수/0 spread, DGS2 결측. 현재 브라우저에서 실제 시차가 얼마였는지는 미검증이다. 경제적 해석에서 역전 하나를 확정 경기·수익 예측으로 바꾸지 않는다.

## H03 — trading score는 검증 대상 휴리스틱

`src/domain/signal/trading-score.js`의 deriveTradingScoreComponents/computeTradingScoreModel은 고정 임계값과25/25/20/20/10 가중치를 사용한다. DXY/TNX/VIX/oil 일부는 component와 cross-risk/post-adjustment에 반복 기여한다. 이는 의도된 interaction일 수 있으므로 중복이라는 이유만으로 삭제하지 않는다.

기존 predictive validation=not-established, NO_ACTION/reference-only, evidence coverage gate는 유지한다. 다음 모델 검수는 입력→기본 component→상호작용→최종점수의 기여도 원장, threshold 경계 감도, 결측 재정규화, 경제 가설과 반증 조건부터 작성한다. out-of-sample 자료 없이 임계값을 최적화하거나 승률로 포장하지 않는다. 수익률 성과·calibration·상관 구조는 아직 검증하지 않았다.

## H04 — macro transmission의 단계 의미

deriveMacroTransmissionEvidence는 많은 미관측 지표를 gap/partial/blocked로 남기고 화면도 결론 보류를 명시한다. 좋은 경계다. 다만 stage observed는 여러 입력 중 하나만 있으면 true인 OR 정의다. ‘단계 완성’과 ‘일부 지표 관측’을 구분하고 각 단계에 observed/required count를 붙인다. 현재 공급되지 않는 treasurySupply/dealerGamma/chinaCredit를 가짜 기본값으로 채우지 않는다.
