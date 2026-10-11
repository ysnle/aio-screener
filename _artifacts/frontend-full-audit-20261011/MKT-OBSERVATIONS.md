# MKT-OBSERVATIONS — 시장 상태(#signal / #breadth / #sentiment) 실브라우저 전수 점검

- 제품: AIO Screener (`C:\Projects\AIO`), 하이브리드 정적 셸 + native ESM, desktop only, 앱 버전 **v57.35**
- 점검일: **2026-10-11 (일, KST)** · 브라우저: agent-browser 0.38.2 / Chromium headless / viewport **1440x900**
- 서버: `http://127.0.0.1:8931` → **200 OK** (감사자가 기동/종료하지 않음)
- 기준일: 마지막 완료 US 정규장 = **2026-10-09(금) 종가**. `market-snapshot-status.json` `lastSuccessfulAt=2026-10-10T15:23:15.089Z`, coverage `observed/required = 16/16` → **10/9 종가 표시는 stale 아님**. 주말을 "실시간"으로 표기한 곳은 없음(탑바가 `● 종가` + `서버 10/9 마감 · 시세 16종` 으로 명시).
- ground truth: `public-data/{market-snapshot,market-snapshot-status,breadth-contributors,history,cftc-positioning,data,macro-history}.json`

## 등급별 건수

| 등급 | 건수 | ID |
|---|---|---|
| **A** (틀림/낡음/추정 데이터 표시) | **1** | MKT-A1 |
| **B** (같은 값이 다른 basis/값으로 표시) | **2** | MKT-B1, MKT-B2 |
| **C** (staleness/basis/상태칩 오표기·누락) | **3** | MKT-C1, MKT-C2, MKT-C3 |
| **D** (카피/UX/접근성·개발용어 유출) | **5** | MKT-D1 … MKT-D5 |
| **콘솔 에러** | **1** | MKT-E1 |
| 참고(등급 없음) | 2 | MKT-N1, MKT-N2 |
| blocked | **0** | — |
| needs-double-check 표시 | 7 | A1, B2, C1, C2, C3, D1, D3 |

### A / B 한 줄 요약
- **MKT-A1 (A)** — 투자 심리 화면 하단에 **0-100 합산(종합) 점수 "자체 계산 심리 지수 51"** 이 사용자 화면에 남아 있다(0-100 시장/종합 점수는 사용자 화면에서 폐지된 상태여야 함). `needs-double-check`.
- **MKT-B1 (B)** — 시장 상태 '신용 · 위험선호' 축 카드가 단일 칩 **"10/8 · 1거래일 전"** 을 쓰는데, 그 카드의 풋/콜 0.82와 F&G 45는 **10/9** 관측이다(투자 심리 화면은 같은 값에 10/9·10/8을 각각 표기).
- **MKT-B2 (B)** — 시장 상태 '금리' 축 카드 칩이 **"10/9"** 이지만, 그 카드의 **실질금리 (10년 TIPS) 2.87%는 2026-10-08 관측**이다(기준일 미표시). `needs-double-check`.

## 발견 상세

### MKT-A1 · **A** · 등급 위반: 0-100 종합 점수 노출 · `#sentiment`
- 위치: '투자 심리' 최하단 카드 — 제목 `자체 계산 심리 지수 (참고)`, 값 `51 / 중립 / 10/9 기준 · 요소 5/7`, 구성 `시장 모멘텀 37 · 시장 폭 88 · 변동성 47 · 안전자산 수요 79 · 정크본드 수요 5`
- expected: 0-100 점수는 사용자 화면에서 퇴역. 근거 주석 `src/ui/components/market-regime.js:1-2`("the 0-100 score and the swing/day toggle are retired from user surfaces"), `src/domain/content/guide-screens.js:1`("retired surfaces (0~100 환경 점수 …)").
- actual: 0-100 합산 종합 점수 51이 화면에 존재. '(참고)'·결측 요소 고지는 있으나 0-100 종합이라는 점에서 규칙과 충돌.
- 근거값: `history.json`(spx/vix/tlt/advanceRatio…) + `macro-history.json`(`hyOas` 3.15 / `igOas` 0.82 → 스프레드 2.33). 계산 재현: 변동성 47→47, 시장 폭 88→88.7, 정크본드 5→4.6(반전 백분위), 모멘텀 37→37.4 — 즉 값 자체는 데이터와 일치(문제는 "0-100 종합 점수가 UI에 있음").
- 코드: `src/ui/components/sentiment-board.js:136-148`, `src/domain/sentiment/composite-fear-greed.js:90-138` (`aio-sentiment-composite.v1`).
- repro: `#sentiment` → '투자 심리' 탭 → 최하단 스크롤.
- 수정 방향: 사용자 화면에서 제거(개발자 모드/가이드로 이동)하거나, 허용하려면 "0-100 점수 폐지" 규칙 문구를 예외로 개정. `needs-double-check`: 개별 지표 카드와 달리 "심리 지수"라는 성격이 있어 규칙 해석 여지가 있음.

### MKT-B1 · **B** · 카드 기준일 오표기(혼합 basis) · `#signal`
- 위치: '신용 · 위험선호' 축 카드 칩 `10/8 · 1거래일 전`, 카드 값 `HY 신용 스프레드 315bp (5일 -9bp)` / `풋/콜 비율 0.82` / `F&G (참고) 45`
- expected: 값별 관측일 — HY OAS `2026-10-08`, 풋/콜 `2026-10-09`, F&G `2026-10-09`.
- actual: 단일 칩(10/8)이 10/9 값 2개까지 10/8 기준으로 보이게 함.
- 근거값: `data.json` `putCall{totalPutCall:0.82, asOf:"2026-10-09"}`, `fearGreed{score:45, asOf:"2026-10-09T23:59:54+00:00"}`, `macro{hyOAS:3.15, _asOf_hyOAS:"2026-10-08"}`. 코드: `src/domain/briefing/market-read.js:512-516`(credit 축 basisOf = `alignments.hy`). 대조: `#sentiment`은 같은 값에 `10/8 · 1거래일 전`(HY) / `10/9`(풋콜) / `10/9`(F&G)를 각각 표기.
- repro: `#signal` '신용 · 위험선호' 카드 ↔ `#sentiment` HY·풋콜 카드 날짜 비교.
- 수정 방향: 값별 기준일 표기 또는 "HY 10/8 · 풋/콜·F&G 10/9" 혼합 명시.

### MKT-B2 · **B** · 실질금리 기준일 미표시 · `#signal`
- 위치: '금리' 축 카드 칩 `10/9`, 값 `실질금리 (10년 TIPS) 2.87%`
- expected: 실질금리 2.87%는 `2026-10-08` 관측(`data.json` `macro.realYield10:2.87`, `_asOf_realYield10:"2026-10-08"`), 미 10년물 5.24%는 `2026-10-09`(`_asOf_dgs10:"2026-10-09"`).
- actual: 단일 칩 10/9. 실질금리 값 옆에 10/8 표기 없음. 코드가 기준일 불일치 시 '실질금리/기대인플레 (5일)' 줄을 숨기므로(`market-read.js:159-163`) 혼합은 인지하나 화면엔 미표기.
- repro: `#signal` '금리' 카드.
- 수정 방향: 값별 기준일 표기. `needs-double-check`.

### MKT-C1 · **C** · 분모 표기 불일치(804 vs 810) · `#breadth`
- 위치: 페이지 기준선 `10/9 미국 종가 기준 · 판정 대상 804개 종목`
- expected: 표시 분모가 각 지표의 실제 모집단과 일치.
- actual: 804 = `breadth-contributors.json` 최신 세션 `eligible.highLow`(이동평균 비율 모집단). 같은 화면의 `4% 이상 상승 22 · 하락 11`, `상승 종목 비율 64%`는 `eligible.movers=810` 모집단에서 계산됨(같은 파일 `sessions[-1] = {date:"2026-10-09", eligible:{movers:810, highLow:804}}`). 화면엔 804 하나만 표기.
- repro: `#breadth` 기준선 ↔ '4% 이상 상승 − 하락 종목 수' 카드.
- 수정 방향: 지표별 모집단 분리 표기. `needs-double-check`.

### MKT-C2 · **C** · 탑바 `VIX —` (콜드 로드) · 전 라우트
- 위치: 상단 상태 바 `VIX —`
- expected: `market-snapshot.json` `market.volatility.vix = 14.84` 표시.
- actual: 브라우저 최초 콜드 로드 시 `● 종가 / 서버 10/9 마감 · 시세 16종 / VIX —`. 이후 재로드·라우트 이동에서는 `VIX 14.84`.
- 근거: 증거 스크린샷 `<scratchpad>\evidence\MKT-signal-full.png`(탑바 `VIX —`); 이후 라이브 `header.topbar` = `… 서버 10/9 마감 · 시세 16종 VIX 14.84 …`. 콘솔 `[AIO:snap] snapshot timestamp unavailable; fallback seed skipped` / `[AIO:fetch] VIX history fetch failed` 다수.
- 수정 방향: 부팅 즉시 스냅샷 값으로 배지 시드. `needs-double-check`(재현성 낮음).

### MKT-C3 · **C** · F&G 밴드 라벨 상이(`중립` vs `fear`) · `#sentiment`/`#signal`
- 위치: `CNN 공포·탐욕 지수 45 / 중립` (및 신용축 `F&G (참고) 45`)
- expected(데이터 파일): `data.json` `fearGreed.rating = "fear"` (score 45).
- actual: 화면 `중립`. 앱 규칙 `src/domain/sentiment/metrics.js:7-18` + `src/domain/rules/thresholds.js:32`(정수 경계 0-24/25-44/45-55/56-75/76-100)에 따라 45=중립 → 파일의 `rating`과 갈림.
- repro: `#sentiment` CNN 카드 ↔ `data.json` `fearGreed.rating`.
- 수정 방향: 생산자 rating 매핑 또는 앱 밴드 경계 정합. `needs-double-check`(어느 쪽이 틀렸는지 파일 기준으로는 rating 쪽이 의심되나 단정 보류).

### MKT-D1 · **D** · `#options` → 투자 심리 별칭 · `#options`
- expected: 폐지된 옵션 라우트 부활 금지.
- actual: `#options` 진입 시 별도 옵션 화면 없이 `투자 심리`(`page-sentiment`) 렌더, 주소창 해시는 `#options` 유지(브레드크럼 `시장 상태/투자 심리`).
- 근거: `js/aio-core.js:21983` 별칭 맵 `options: 'sentiment'`. 라이브 `location.hash="#options"` → active `page-sentiment`. (부활이 아니라 명시적 별칭)
- 수정 방향: 진입 시 `replaceState`로 해시 정규화 또는 별칭 제거. `needs-double-check`(의도 여부).

### MKT-D2 · **D** · 불투명 라벨 `24.10~26.10 주간` · `#signal`
- 위치: '기관 포지셔닝' 카드 — `24.10~26.10 주간 · 순매수 범위 81만~110만 계약`
- 근거: `cftc-positioning.json` `percentileWeeks:104`, series 첫 관측 `2023-09-19`·최신 `2026-10-06`, es 자산운용사 순매수 최근 104주 min/max = 811,300 / 1,102,458. 값은 정확, 라벨이 2년 창임을 드러내지 못함.
- 수정 방향: `2024-10~2026-10(2년) 주간` 등으로 풀어쓰기.

### MKT-D3 · **D** · 면책 바의 '점수' 잔존 문구 · 전 라우트 하단
- 위치: `투자 면책 고지 — 본 도구의 모든 수치·점수·시그널·AI 답변은 …`, `내부 점수의 예측력은 검증되지 않았고 …`
- actual: 0-100 점수가 폐지된 화면에 '점수'를 지칭하는 레거시 문구가 남음. `needs-double-check`(일반 면책 문구).

### MKT-D4 · **D** · (기본 모드 숨김) 폐지 0-100 점수 + 영문 `UPTREND` · 전역 상단 `#market-pulse-bar`
- DOM 값: `환경 63 / 스트레스 신호 일부`, `시장폭 35% / 공포 영역`, `심리 45 / 중립`, `매크로 ● UPTREND`.
- `환경 63`은 폐지된 swing 트레이딩 점수(`js/aio-pages.js:990-997` `computeTradingScore('swing').total`), `UPTREND`는 영문 라벨(`:1047-1055`).
- **기본 모드에서는 렌더되지 않음**: `index.html:5059`가 `body:not(.aio-dev-mode) #market-pulse-bar`를 숨김. 라이브 검증: `display:none`, `getClientRects().length=0`, `offsetParent=null`. → 사용자 화면 영향 없음, 개발자 모드 노출 시 문제.
- 수정 방향: 폐지 점수 제거/개발자 전용 유지, `UPTREND` 한국어화.

### MKT-D5 · **D** · (기본 모드 숨김) decision-header 상태가 실제 판정과 모순 · 3개 라우트
- DOM: breadth/sentiment 헤더 `판단 보류 · 필수 현재성 근거 미수신 / 데이터: 미수신 / 공통컷 지연 · 10/10/08:00 KST / 시점 불일치` ↔ 같은 페이지 본문은 10/9 데이터로 확정 판정(`시장 폭 부담`, 심리 종합). signal 헤더 `시장환경 관찰 — 양호 구간` ↔ 본문 종합 `혼조(우호 3·부담 3)`.
- **기본 모드에서는 숨김**: `index.html:5088`(`body:not(.aio-dev-mode) .page > .aio-decision-header { display:none !important; }`). 라이브: display none, rects 0, offsetParent null.
- 수정 방향: 개발자 모드/접근성 검사 대비 문구 정합.

### MKT-E1 · 콘솔
- `error [AIO:api] proxy-primary: warn → error {errCount: 3}` (uncaught page error는 없음 — `agent-browser errors` 비어 있음)
- 동반 경고: `[AIO:proxy] … disabled (level 1/2) {fails: 3-4}` 다수, `[AIO:data-quality] ma-auto-update: 시세/자료 연결 실패`, `[AIO:VIX] VIX 히스토리 수신 실패 — 정적 차트 데이터 사용 중`, `[AIO:HY] HY 스프레드 프록시 전부 실패 — 정적 데이터 사용 중`, `[AIO:snap] snapshot timestamp unavailable; fallback seed skipped`(다수), `[AIO 운영 점검] 8 stale live price(s)`, `[AIO:시세 (3분)] auto refresh failed`.

## 전수 대조 기록 (화면 값 ↔ public-data JSON)

기준일 정합성: 화면이 쓰는 "20일/5일"은 **거래 세션 수**이며 `history.json`의 주말 null 행을 제외(즉 `buildCloseSeries`의 NY-date 키)로 계산됨 — 아래 값들은 그 규칙으로 재현해 화면과 일치함을 확인했다.

### #signal (국면 판정 / 시장 상태)
| 화면 표시 | 데이터 근거 | 판정 |
|---|---|---|
| S&P 500 7,811.54 | `market-snapshot.json` `market.index.spx.value=7811.54` (= `history.json` 2026-10-09 `spx`) | OK |
| S&P 500 20일 +2.0% | history spx 20세션 전(09-11) 7656.98 → +2.02% | OK |
| 50일선 / 200일선 7,697 / 7,251 | spx 50MA 7696.9 / 200MA 7250.6 | OK |
| 50일선 방향 상승 | 50MA(현재) > 50MA(20세션 전) | OK |
| 1년 고점 대비 -0.1% | spx 1년 최고 대비 -0.09% | OK |
| 나스닥 20일 +3.9% | 26333.03 → 27366.17 = +3.92% | OK |
| 분배일(최근 25거래일) 7일 | history `distributionDays`(2026-10-09)=7 | OK |
| 50일선 위 종목 35% | history `breadth50`=34.7 | OK |
| 200일선 위 종목 50% | `breadth200`=49.9 | OK |
| 종가일 상승 종목 비율(보합 제외) 64% | `advanceRatio`=0.639 | OK |
| 40일선 위 종목 36% | `breadth40`=36.2 | OK |
| 52주 신고가 / 신저가 24 / 13 | `breadthNewHighs/Lows`=24/13 (`breadth-contributors.json` 2026-10-09 최신 세션과 일치) | OK |
| 4% 이상 상승 / 하락 22 / 11 | `breadthUp4/Down4`=22/11 | OK |
| 러셀 2000 vs S&P 500 (20일) -3.3% vs +2.0% | rut -3.34%, spx +2.02% | OK |
| VIX 14.84 (5일 -3%) | snapshot vix 14.84; 5세션 -3.07% | OK |
| VIX / 3개월 VIX 0.84 (정상) | 14.84/17.77=0.835 | OK |
| 미 10년물 5.24% (5일 -4bp, 20일 +27bp) | tnx 5.24; -4.0bp; +27.0bp; `data.json macro.dgs10` 5.24 | OK |
| 1년 범위 내 위치 95% | tnx 연간 위치 94.9% | OK |
| 실질금리 (10년 TIPS) 2.87% | `data.json macro.realYield10`=2.87 (**asOf 2026-10-08**) | 값 OK · 기준일 미표시 → **MKT-B2** |
| HY 신용 스프레드 315bp (5일 -9bp) | `macro.hyOAS`=3.15(10/8), `hyOASDelta5`=-0.09 | OK |
| 풋/콜 비율 0.82 | `putCall.totalPutCall`=0.82 (**10/9**) | 값 OK · 카드 칩 10/8 → **MKT-B1** |
| F&G (참고) 45 | `fearGreed.score`=45 (`rating`=fear) | 값 OK · 밴드 상이 → **MKT-C3** |
| WTI 91.85달러 (20일 -9.4%) | wti 91.85; 20세션 -9.41% | OK |
| WTI 1년 범위 내 위치 63% | 63.4% | OK |
| 달러 인덱스 102.23 (20일 +2.8%) | dxy 102.23; +2.79% | OK |
| 금 4,216달러 (20일 -3.1%) | gold 4216.3; -3.12% | OK |
| 원/달러 1,340.9원 (20일 -1.7%) | usdkrw 1340.9; -1.73% | OK |
| 엔/달러 158.25엔 (20일 +2.5%) | usdjpy 158.25; +2.51% | OK |
| 코스피 6,625.93 (20일 -5.3%) | kospi 6625.93; -5.28% | OK |
| CFTC es 36백분위 / +906,615 / 4주 −5,746 / 레버리지 −415,087(25백분위) | `cftc-positioning.json` es `latest`·`assetManagerPercentile2y`·`change4w` | OK |
| CFTC nq 56 / +73,798 / −1,728 / lev −19,212(68) | nq | OK |
| CFTC ty 100 / +2,828,139 / +266,458 / lev −2,139,785(29) | ty | OK |
| 순매수 범위 81만~110만 / 3만~9만 / 152만~283만 | es/nq/ty 최근 104주 am min~max = 811,300~1,102,458 / 33,676~92,301 / 1,517,722~2,828,139 | OK |
| 각 축 전환 조건 문구 | `src/domain/rules/thresholds.js` (breadth 40/60, volatility 18/25/0.95/1/25%, rates 25bp·0.9, credit 350/450/25, oil 10%·0.85, dollar 2%, fx 2%·3%) | OK |
| `10/9 미국 종가 기준` / 탑바 `서버 10/9 마감 · 시세 16종` | `market-snapshot-status.json` lastSuccessfulAt 2026-10-10T15:23Z, coverage 16/16 | OK (stale 아님) |
| 각 카드 기준일 칩 (10/9, 10/8 · 1거래일 전, 10/6 기준 주간 보고) | HY 10/8, CFTC 2026-10-06 | OK (혼합 카드 예외 → B1/B2) |

### #breadth (시장 폭)
| 화면 표시 | 데이터 근거 | 판정 |
|---|---|---|
| 판정 대상 804개 종목 | `breadth-contributors.json` 최신 세션 `eligible.highLow`=804 (movers=810) | 값 OK · 모집단 혼합 → **MKT-C1** |
| 50일선 위 35% (5일 +6.6%p · 20일 -5.7%p) | 34.7; 28.1→34.7; 40.4→34.7 | OK |
| 20일선 위 51% (5일 +21.1%p · 20일 +22.6%p) | 50.7; 29.6→50.7; 28.1→50.7 | OK |
| 40일선 위 36% (5일 +9.4%p · 20일 -1.8%p) | 36.2; 26.8; 38.0 | OK |
| 200일선 위 50% (5일 +2.9%p · 20일 -6.9%p · 기록 시작 7/29) | 49.9; 47.0; 56.8; 첫 관측 2026-07-29 | OK |
| 상승 종목 비율 (10일 평균) 49% | advanceRatio 10세션 평균 48.92% | OK |
| 누적 상승-하락 종목 수 (A/D 라인) 3,881 (5일 +384 · 20일 -866) | advanceDecline 누적 3,881; 3,497→3,881; 4,747→3,881 | OK |
| 52주 신고가 − 신저가 +11 (신고가 24 · 신저가 13, 5일 +21, 기록 시작 9/25) | 24-13=11; Δ5 +21; 첫 관측 2026-09-25 | OK |
| 4% 이상 상승 − 하락 +17 (오늘 상승 22 · 하락 11, 5일 +5 · 20일 +8) | 5일 롤링합 17 / 12 / 9 | OK |
| S&P 500 분배일 7 (5일 +1 · 20일 +3 · 기록 시작 5/11) | distributionDays 7/6/4; 첫 관측 2026-05-11 | OK |
| S&P 500 7,812 (5일 +1.2% · 20일 +2.0%) | 7,811.54 반올림; +1.15% / +2.02% | OK |
| 종목 보기 목록(52주 신고가 24건: MRNA·HUM·DDOG…, 4% 이상 상승 22건, 하락 11건) | `breadth-contributors.json` signals (2026-10-09 `newHigh` 24, `up4` 22, `down4` 11) | OK |

### #sentiment (투자 심리)
| 화면 표시 | 데이터 근거 | 판정 |
|---|---|---|
| CNN 공포·탐욕 지수 45 (전일 +5 · 5일 +14 · 20일 +12) | history `fg` 45; 40; 31; 33 (반올림 차) | OK |
| 45 / 중립 | `data.json fearGreed.rating`='fear' | 라벨 상이 → **MKT-C3** |
| VIX 기간 구조 0.84 (5일 -0.01) | 0.8351; -0.015 | OK |
| HY 신용 스프레드 315bp 안정 (10/8 · 1거래일 전, 5일 -9bp) | `macro.hyOAS` 3.15, asOf 10/8, delta5 -0.09 | OK |
| 풋/콜 비율 0.82 중립 (10/9) | `putCall.totalPutCall` 0.82, asOf 10/9 | OK |
| AAII 개인 설문 약세 39.0% / 강세 40.3% (10/7 · 2거래일 전 주간; 장기 평균 강세 37.5% / 약세 31%) | `data.json marketSurveys.aaii{bearish:39, bullish:40.3, observedAt:"2026-10-07"}`; `AAII_AVERAGE` 37.5/31.0 | OK |
| 자체 계산 심리 지수 51 (요소 5/7; 모멘텀 37·폭 88·변동성 47·안전자산 79·정크 5) | `composite-fear-greed.js` 재현 일치(37.4/88.7/47.0/~79/4.6); 결측 = 주가 강도(11/60) · 풋·콜(0/60, history에 `pcr` 필드 없음) | 값 OK · 0-100 종합 존재 → **MKT-A1** |
| 심리 종합 문장 / 시장 상태 연결 문장 | `sentiment-board.js:100-126` 로직과 일치 | OK |

### 라우트 간 이동·새로고침 일관성
- 세 라우트 이동 시 공통 기준일이 `10/9 미국 종가 기준`으로 유지됨(각 페이지 기준선 + 카드 칩).
- 새로고침 후 동일 라우트의 값·판정·칩 재확인 결과 모두 동일(시장 폭 부담, 혼조 우호 3·중립 0·부담 3, F&G 45, HY 315bp, CFTC 수치 동일).
- 라우트 이동 시 탑바 브레드크럼만 바뀜(`시장 상태/국면 판정` → `시장 상태/시장 폭` → `시장 상태/투자 심리`).

## 개발자 모드 전용(기본 모드 숨김) 표면
`#market-pulse-bar`(환경 63 / UPTREND)와 `.aio-decision-header`(미수신·판단 보류 / 양호 구간)는 DOM에 존재하나 `index.html:5059,5088` CSS로 기본 모드에서 숨겨진다. 라이브 검증 `display:none`, `getClientRects().length=0`, `offsetParent=null`. 스크린샷(세 라우트)에서도 보이지 않음 → 사용자 화면 결함 아님. 등급 D(MKT-D4/D5)로 기록하되 "기본 모드 비노출"을 명시.

## blocked / 미확인
- **blocked: 없음.** 서버 200 응답, 세 라우트 모두 정상 렌더, 필수 데이터 파일 로드 확인.
- 미확인/저확신(needs-double-check): MKT-A1(규칙 해석), MKT-B2(값 기준일), MKT-C1(모집단), MKT-C2(콜드 로드 재현성), MKT-C3(어느 쪽 라벨이 틀렸는지), MKT-D1(#options 별칭 의도), MKT-D3(면책 문구).
- 대조 불가 항목: "국면 전환 히스토리" 표면이 세 라우트 어디에도 없어(화면 innerText에 없음) history.json과 대조할 대상이 존재하지 않음(해당 없음). history.json 자체는 최신 행 `date 2026-10-10` / `cycleEnd 2026-10-09T23:00:00Z` / `seriesMode completed-market-cut`으로 10/9 종가 기준과 일치.
- 환경 제약(결함 아님): 아웃바운드 프록시(라이브 시세·뉴스·FRED 등) 실패 → 콘솔 경고 다수(MKT-E1). 이 환경에서 화면은 서버 스냅샷/정적 데이터로 정상 렌더.

## 증거 파일
- 리포 근거(내구성): 위 대조표의 `C:\Projects\AIO\public-data\*.json` 및 소스 파일·라인.
- 스크린샷(세션 스크래치패드, 리포 산출물 제한 준수): `<scratchpad>\evidence\MKT-signal-full.png`, `MKT-breadth-full.png`, `MKT-sentiment-full.png`, `MKT-breadth-view.png`, `MKT-sentiment-view.png`.
- 실시간 추출 원문(화면 텍스트/DOM): 스크래치패드 `route_signal.json`, `route_breadth.json`, `route_sentiment.json`, `eval_out.txt`.

## 산출물 제약 준수
- 본 감사의 리포 산출물은 `_artifacts/frontend-full-audit-20261011/MKT-OBSERVATIONS.json` 와 `MKT-OBSERVATIONS.md` **두 파일뿐**이다. 그 외 파일 생성/수정 없음, git 미사용, 코드 미수정.
- (참고: 같은 폴더에 다른 작업의 `EXT-OBSERVATIONS.*`, `smoke-*.png`, `screens/`가 존재하나 이는 본 감사가 만든 것이 아니다.)
