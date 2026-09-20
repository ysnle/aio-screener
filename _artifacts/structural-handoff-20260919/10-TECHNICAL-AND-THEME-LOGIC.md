# 10 — 기술지표와 테마 합산의 입력 계약

Astra 조사·설계 · 2026-09-20 10:19 UTC · v56 working tree. 다른 작업의 미커밋 변경을 포함한다. [함수 합성 증거와 파일 hash](theme-technical.json). Luna의 해당 수식 조사는 사용량 한도로 중단되어 아래는 Astra가 직접 확인한 범위다.

## T01 / W10-A — 테마 가중치의 단위와 0의 의미

`js/aio-pages.js:2233`의 calcCompositePerf는 `weights[t]`의 truthiness로 명시 가중치를 선택한다. 0이면 mcap 또는1로 fallback한다. mcap이 없는 종목만1을 사용하므로 ‘동일가중’ 주석과 달리 전체 집합의 동일가중이 아니다. 일부 명시 weights가 빠진 경우 비율과 시가총액을 같은 합에 섞을 수 있다.

합성: AAA +10%, BBB -10%, AAA mcap100, 명시 weights AAA0/BBB1 → 결과+9.802%. 올바르게 0을 제외비중으로 해석하면 BBB만 반영되어 -10%여야 한다. weights 없이 동일 자료도+9.802%다. 후자는 한 종목의 mcap 결측을 어떻게 처리할지 정책이 없어 의도한 지수로 해석할 수 없다. 실제 등록 theme에 0/불완전 weights가 있는지는 아직 전수 확인하지 않았다.

설계: weightMode를 explicit / market-cap / equal로 분리한다. explicit는 0을 보존하고 누락·음수·비유한값을 검증한다. market-cap은 동일 unit/동일 기준일의 eligible mcap만 사용하고, coverage 미달은 보류한다. equal fallback은 집합 전체의 별도 명시 정책이어야 한다. 관측 종목 기준 coverage와 요청 weight 기준 coverage를 모두 남긴다.

getThemePerf는 이 합성값을 coverage50% 이상이면 quality=live로 표시한다. calcCompositePerf는 component의 freshness를 검사하지 않으므로 live라는 이름을 수신 개수만으로 부여하지 않는다. composite의 source/observedAt/priceBasis/weightRevision을 결과에 연결한다. snapshot fallback이 섞인 실제 화면 영향은 브라우저로 추가 확인한다.

인수:0%,100%,일부 weight누락, mcap누락, 단위가 다른 mcap, stale component, 한 종목만 수신, negative return. ETF 실제수익률과 synthetic theme 수익률을 명확히 구분한다. 동적 가중 daily return의 표시는 자산운용 전략 수익률이나 과거 지수 track record가 아니다.

## T02 / W10-B — RRG의 동시점·주기·최신 관측

`src/domain/themes/rrg.js`의 computeRelativeRotation은 숫자 배열의 길이를 맞춰 tail을 대응시키며 date/session을 받지 않는다. invalid pair를 건너뛰고 남은 수치로 계산한다. 합성22개 입력의 마지막 asset 값만 null이어도 Leading을 반환했다. 반환에는 마지막 사용 시각/제외 구간이 없다.

`js/aio-pages.js:3385`의 hydrateRRGDailyHistory는 parsed.closes만 저장해 날짜를 버린다. :3360 collectPriceHistory는 daily marker가 없는 심볼에 세션 틱을 누적한다. calcLiveRS는 marker를 전달하지 않는다. 따라서 daily benchmark와 tick asset의 동일 주기 여부를 함수 계약에서 검사할 수 없다. 실제 혼합된 화면 빈도는 미검증이다.

설계: typed series에 instrumentId, interval, adjustmentBasis, calendar, bars[{date,value}], observedAt을 둔다. asset/benchmark를 같은 session 날짜로 join한다. 단순 길이 정렬을 동시점 정렬이라 부르지 않는다. 최신 필수 bar 결측은 stale-reference/unavailable로 표시하고 중간 결측 처리와 최소 연속창을 정한다. tick은 daily 모델에 투입하지 않는다.

계산은 현행 AIO 상대회전 휴리스틱으로 formulaVersion을 명시한다. 상용/외부 RRG 방법과 같다는 검증 없는 호환성을 주장하지 않는다. 100 경계의 의미, window 길이와 midpoint 선택, benchmark 선택이 quadrant를 바꾸는 예를 설명 상세에 넣는다. 주기·창·날짜가 다른 결과를 같은 화살표 이력에 연결하지 않는다.

## T03 / W10-C — 기술지표 시간 파싱과 전처리 일치

deriveTechnicalStageFromOhlcv는 observedAt/date/time/timestamp를 받아 Date.parse에 넘긴다. 동일210개 close와 날짜를 ISO 문자열로 넣으면 current/210, Unix초 time으로 넣으면 unavailable/0이었다. 입력에 time을 허용한다면 타입과 단위를 명시하고 경계에서 정규화해야 한다. 실제 caller가 항상 ISO로 변환하는지까지는 미확인이라 현재 사용자 장애로 단정하지 않는다.

legacy `_aioCleanOHLCV`는 invalid close row를 제거하고 누락 OHLC를 close로 채우며 volume을0으로 만든다. native stage는 invalid middle bar에서 tail을 끊는다. `_calcSMA/_calcEMAFull`은 null을 Number로 바꾸는 `_aioCleanNums`를 쓰고, RSI는0 이하를 제거한다. 같은 raw 입력이 지표별로 서로 다른 window가 되는 경계다. 정상 OHLCV에서의 공식 오류를 입증한 것은 아니다.

설계: 지표마다 계산 전에 정규화된 한 bar stream을 공유한다. 실제0 volume과 미수신 volume, OHLC 실측과 대체값을 분리한다. 보간/누락제거 정책을 조용히 적용하지 않는다. RSI 평탄창, EMA seed/warmup, ATR overnight gap, MACD warmup, split 전후 high/low/close 일관성을 golden fixture로 비교한다. 먼저 입력계약과 지표 정의를 고정하고 legacy와 native 수학을 함께 옮긴다.

## 다음 개별 검수

이번 범위에서 stage/RRG 및 SMA/EMA/ATR/RSI/MACD 앞부분을 읽었다. VCP·Fibonacci·volume profile·divergence·weekly context·매도압력·옵션 payoff/Greeks의 수학 전수검수는 미완료다. 패턴 taxonomy가 있다는 사실은 detector가 검증됐다는 뜻이 아니다.
