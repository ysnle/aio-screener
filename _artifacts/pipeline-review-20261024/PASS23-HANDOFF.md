# PASS23 — 포트폴리오 화면·월별 백테스트·스트레스 연결

2026-10-30 직접 전체 판독: src/domain/portfolio/{surface,backtest,stress-sensitivity,portfolio-read}.js와 src/ui/panels/portfolio-stress.js(5파일). backtest932행을 1–120/121–245/246–370/371–495/496–620/621–745/746–855/856–끝으로 확인. portfolio-read 출력 누락은 해당 구간 재판독. 부분: src/ui/components/portfolio-read.js portfolioLens, js/aio-workspace.js1191–1250 실행 연결. 후자는 FULL 아님. reproduce-pass23.mjs 5묶음 exit0. 제품·데이터 수정/외부요청/브라우저 실행 없음.

## P23-CUT-01 — 월별 백테스트가 asOf 이후 관측을 포함

common은 startYear/endYear와 자산간 월말 관측 차이만 제한한다. asOf가 속한 달은 마지막 달과 같은 경우에만 제거하므로 더 뒤의 관측이 있으면 미래 전체가 남는다. 2024-01~2026-01 시계열, asOf2025-06-15에서 ok=true,endMonth2026-01. 운영 caller는 현재 연도를 endYear로 넘기고 보통 현재까지 수집하므로 실제 미래 데이터 존재는 미확인. 과거 cut 재현 API 계약 결함이다.

개편: 모든 observation<=asOf를 먼저 적용하고 마지막 완료월을 거래달력으로 판정. 회귀: 과거cut+미래관측, 미래달이 마지막이라 현재달 제거를 우회하는 경우, 월말 장중/마감후, timestamp epoch 단위, endYear와 cut 충돌. _aioBtMonthEnds는 마지막 timestamp가 아니라 입력 배열의 마지막 행을 월말로 덮어쓰므로 역순 입력도 회귀 필요(생산자 정렬 계약 확인).

## P23-CURRENCY-01 — 미확인 해외 통화를 선언 기준통화로 취급

fx.js는 ABC.L의 quoteCurrency를 null로 보류하지만 surface.effectiveCurrencies가 null을 filter하고 baseUSD만 남겨 declared-single로 만든다. 통화 없는 ABC.L shares1/price100 + baseUSD에서 positionValue100. 해외 suffix 방어가 합계 단계에서 사라진다. holding의 price 자체도 저장값 fallback이라 실시간 시세 검증과 별개로 재현된다.

개편: 기준통화 선언은 개별 시세 통화 확인을 대체하지 않는다. 각 row의 quote currency가 확인되거나 동일단위 legacy 가정이 명시적 마이그레이션된 때만 합산. 현금과 원가 축도 별도 검증. 이 문제를 티커를 다른 발행자로 추정했다는 주장으로 확대하지 않는다.

## P23-FX-01 — 평가 화면은 앱 환율로 환산, 위험 입력은 같은 환율을 거부

surface는 cashFx를 holdings fallback에 쓰지만 portfolio-risk-input은 holdings에 convertWithDeclaredRates만 쓰고 cashFx는 현금에만 사용한다. USD100/KRW base/app close1400에서 surface.positionValue140000, 위험 입력 currency-unconverted 재현. 허용환율 기준이 화면마다 달라 기능이 보류된다.

개편: valuation converter를 공유하되 가격·환율 기준일/현재성을 명시. 역사 수익률 환산은 별도 시계열 계약을 유지해야 하며 현재환율로 역사수익률을 대체하지 않는다. stale direct와 최신 app close 우선순위도 한 곳에서 정의.

## P23-CASH-01 — PASS22 잔액 오류가 surface에서도 제거됨

derivePortfolioSurface는 cashBalances를 finite 후 filter하므로 USD10 + 잘못된 KRW 잔액을 지우고 USD 주식100 포함 totalAssets110을 발행한다. 함수 경계 단독 문제가 아니라 surface 계산에도 도달함을 확인. 저장/import에서 발생 가능한지 후속 UI/스토리지 판독 필요. cashKnown=true에 오류 행만 있으면 cashEnteredZero가 되어 0으로 해석할 경로도 있다. 오류 잔액을 ‘현금0 명시’와 분리할 것.

## P23-FRESHNESS-01 — 오래된 close도 surface.status=current

closeOf는 양수 price만 확인하며 날짜 검증이 없다. 1990-01-01 close를 넘겨도 completed-close/count와 status=current. 날짜는 closeDate에 보존되므로 은폐와는 구별한다. sourceKind 집계는 completed-close도 portfolio-state로 요약하고 observedAt는 state.updatedAt를 쓰므로 AI portfolioRowsForAI의 asOf가 가격 관측일 대신 저장일이 될 수 있다. closeOf 공급자가 현재성을 강제하는지 추가 확인 필요.

개편: valuation completeness와 freshness를 분리. 각 자산 basis와 stale/missing 상태를 보존하고 전체는 가장 오래된 유효 관측·혼합일자 여부를 표시. 저장일을 가격 관측일로 사용하지 않는다. 오래된/미래 close·일부지연·저장값 fallback·0수량을 회귀 검증.

## 스트레스 모델의 의미·보강

estimateBookSensitivities는 현재 평가비중을 현지통화 주간 수익률에 적용하고 요인별 단변량 회귀를 한다. 실제 계좌 과거 성과가 아니다. 패널 head는 “내 계좌의 과거 주간 움직임”이므로 현재 보유분 가상 재구성이라는 설명이 필요하다. 상관효과/외삽/한국 beta1을 명시하는 문구는 정상.

scenarioImpact의 1.96×slope SE×shock은 회귀 기울기의 불확실성 범위이며 미래 실현 손익의 95% 예측구간이 아니다. 화면 “95% 범위”가 무엇의 범위인지 명시하고 표본30주의 finite-sample t값, 잔차 자기상관·이분산과 큰 shock의 외삽 안정성을 보강 후보로 제안. 실제 투자손실 보증으로 인증하지 않는다.

환율 시나리오는 local return 추정에 translation을 단순 더한다. base-currency growth=(1+local)*(1+FX)이므로 교차항이 빠지는 선형 근사다. 다른 요인의 FX동행은 제외되어 있다. 단순합 근사인지 정확한 가정 환산인지 구분하고 패널 기준통화 표시를 보강. isKr 외 모두 USD 가정은 해외 상장 통화 registry와 일치시켜야 한다.

weights Object.fromEntries는 같은 ticker 다중 lot를 마지막 값으로 덮어써 covered<.8 보류나 잘못된 구성으로 갈 수 있다. portfolioLens의 effectiveN도 종목이 아니라 lot로 나누어 계산하는 반면 lookThrough는 합산한다. 공통 종목단위 평가액 집계 뒤 파생시키는 방안. available=true여도 모든 factor fit=null일 수 있어 UI의 단일 표본수/80% 부족 이유가 정확하지 않을 수 있다. factor별 유효n·날짜·보류사유를 보존한다.

## 월별 엔진 추가 후보와 정상 계약

- 시작가치 배분은 과거 adjustedClose×현재수량을 현재 선언 FX leg로 환산한다. start-date market-value라는 설명에 비해 환율 cut은 실행시각이다. 역사 시작환율과 현재수량의 split 단위 정합성을 명시해야 한다. 실제계좌 과거 구성 아님은 이미 경고.
- 명시 targetWeight0도 missing price/adjusted series/공통월 교집합 검사를 통과해야 하므로 제외 의도가 샘플을 줄일 수 있다. 0비중과 미지정의 계약을 보존하면서 데이터 자격 검사 범위를 분리할지 검토.
- benchmark 통화는 priceMap에서 별도로 확인하지 않는다. KR포트폴리오 vs SPY의 alpha/beta/active return은 local currencies 비교일 수 있다. 공통 base 비교 또는 현지 비교 라벨 필요.
- baseCurrencyMonthlyReturns는 월별held가 있어도 status=ready. 소비자가 status만 보고 전기간 환산 완료라고 읽지 않도록 aggregate partial/held count 제공. FX는 마지막 월 관측을 사용하나 price와 실제 관측일 lag를 재검증하지 않는다.
- unknown rebalanceType는 조용히 no-rebalance로 작동한다. 정상 UI form validation은 있으므로 API 경계 후보. 도메인 enum 검증 보강.
- 월별 MDD는 월중 하락을 포착하지 못한다. 숫자 라벨에 월말 기준 명시. 현재 코드의 월별 그리드/시차상한/부분연도 구분/적절한 arithmetic Sharpe/Jensen alpha·손실기여% 보류는 정상 계약으로 확인.
- warning은 회전율 미모델링이라고 쓰지만 실제 turnover를 계산한다. 거래비용/turnover cost 미반영과 관측 turnover를 구분할 것.

## portfolio-read 연결

지수대비 비교는 buildAttribution으로 단일화되어 분해 항등식을 공유한다. 실제 수익률과 현재 구성 가상수익률을 구분하는 문구 확인. trend 판정은 row 현재성·SMA 기준일을 자체 확인하지 않으며 ‘미국시장폭 좁으면 먼저 흔들림’은 별도 검증 없는 해석으로 남는다. AI 입력은 수량·원가·금액·메모 대신 비중·수익률을 보내는 보호를 확인. mixed-without-conversion도 보류한다. 원장/import/browser 및 실제 가격 input 품질 검증은 미완료.

제품 수정·commit·push·deploy 없음. 전체 파일 감사는 계속 중이며 FULL 판독은 운영/의미 합격과 다르다.
