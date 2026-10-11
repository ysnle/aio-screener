# CROSS-OBSERVATIONS — AIO Screener 화면 횡단 데이터 기준선 정합성

- **감사일**: 2026-10-11 (일, KST) · **마지막 미국장 종가**: 2026-10-09 (금) · **사용자 기준**: 오늘 = 2026-10-11
- **대상**: `http://127.0.0.1:8931/index.html#<route>` 19개 라우트 전부 (home, signal, breadth, sentiment, briefing, technical, macro, fxbond, fundamental, themes, theme-detail, portfolio, ticker, market-news, principles, masters, atlas, guide, screener)
- **데이터 기준선(fresh)**: `market-snapshot-status.json lastSuccessfulAt = 2026-10-10T15:23:15.089Z` (캡처 시점 16h 경과 — 주말, 신선). UI/스냅샷/ops 모두 `market-snapshot:2026-10-10T15:23:15.089Z:b98b55b4` 로 일치.
- **방법**: 스크래치패드에 Node+Playwright 스크립트 1개(실행 2회: 전 라우트 3.2s 대기 캡처 + 주요 9라우트 warm 7s 라벨→값 재캡처). 리포에는 스크립트 미생성. 스크린샷은 `_artifacts/frontend-full-audit-20261011/cross-<route>.png` (19장).
- **수집량**: 원시 DOM 값 1,113개(ids 177·chips 348·metrics 494·dates 51·snap 9·subtitles 34) + 2차 라벨쌍 118·칩 120 → 대조에 사용한 라벨드 핵심값 **304개**. 값-출처 행 67, 화면 간 행 25.
- **등급**: A=틀린/낡은 데이터, B=같은 값 다른 basis/값, C=기준일/단위/상태칩 오류, D=기타. **A 3 · B 5 · C 6 · D 6 (총 20)**

> 기준일 3종이 공존하며 각각 라벨링돼 있다: **미국 종가 2026-10-09** · **KST 사이클 행 2026-10-10 (history.json `date`, cycleEnd 2026-10-09T23:00Z)** · **KST 달력 오늘 2026-10-11**. 혼용 자체는 정상(각 화면 라벨 보유).

---

## 1. 값–출처 매트릭스 (표시값 vs 데이터 값·키 경로)

표기: `M`=일치 · `MISMATCH`=불일치 · `BASIS`=basis 상이 · `NO_SOURCE`=출처없음. 데이터 파일 = 최신 리프레시 산물(기본 정답).

| ID | route | 위치 / 지표 | 표시값 | 데이터 키 경로 | 데이터 값 | 판정 |
|---|---|---|---|---|---|---|
| VS-01 | home | hero S&P500 | 7,811.54 (+0.59%) | market-snapshot.quotes[market.index.spx].value/.changePct | 7811.54 / 0.5946941 | M |
| VS-02 | home | hero Nasdaq | 27,366.17 (+0.64%) | quotes[market.index.nasdaq] | 27366.17 / 0.6355606 | M |
| VS-03 | home | hero US10Y | 5.244 (+1.3bp) | quotes[market.rates.us10y] / macro.dgs10 | 5.244 / 5.24 | M |
| VS-04 | home | hero WTI | 91.85 +0.36 (+0.39%) | quotes[market.commodity.wti] | 91.85 / 0.393488 | M |
| VS-05 | home | hero VIX | 14.84 -3.70% | quotes[market.volatility.vix] | 14.84 / -3.6988959 | M |
| VS-06 | home | hero F&G | 45 **중립** | fearGreed.score / .rating | 45 / **"fear"** | **MISMATCH** (→X-C2) |
| VS-07 | home | hero DXY | 102.23 +0.09% | quotes[market.fx.dxy] | 102.231 / 0.0890940 | M |
| VS-08 | home | hero Gold | 4,216.30 +1.43% | quotes[market.commodity.gold] | 4216.3 / 1.4265095 | M |
| VS-09 | home | hero KOSPI | 6,625.93 -2.62% | quotes[market.index.kospi] | 6625.93 / -2.6157043 | M |
| VS-10 | home | hero BTC | 82,871.30 | quotes[market.crypto.btc].value(CURRENT_SESSION) vs history[last].btc | 82871.3 vs **82546.32** | **BASIS** (→X-B1) |
| VS-11 | home | 직전종가 행 공포·탐욕 | +5 | fearGreed.previousScore=38 / previousWeek=40 | +7(전일) / +5(주간) | **BASIS** (→X-B2) |
| VS-12 | home | 직전종가 행 VIX | -0.6 (단위 없음) | quotes[vix].changePct | -3.6989% | **BASIS/단위** (→X-C6) |
| VS-13 | home | hero risk pill | S&P 500 사상 최고치 부근 | signal/breadth: 1년 고점 대비 -0.1% | ATH 근거 없음 | **NO_SOURCE** (→X-B5) |
| VS-14 | signal | 6축 S&P500 | 7,811.54 (20일 +2.0%) | quotes[market.index.spx].value | 7811.54 | M |
| VS-15 | signal | 시장폭 50일선 위 | 35% | screener.breadth.segments.us.above50 | 34.8 | M |
| VS-16 | signal | 시장폭 200일선 위 | 50% | breadth.segments.us.above200 | 49.9 | M |
| VS-17 | signal | 상승종목비율(보합제외) | 64% | breadth.segments.us.advanceRatio | 0.6382 | M |
| VS-18 | signal | 52주 신고/신저 | 24 / 13 | breadth-contributors.sessions[last].counts.newHigh/newLow | 24 / 13 | M |
| VS-19 | signal | 4%↑ / ↓ | 22 / 11 | contributors.sessions[last].counts.up4/down4 | 22 / 11 | M |
| VS-20 | signal | VIX/기간구조 | 14.84 / 0.84 | vix=14.84, vix3m=17.77 | 0.8351 | M |
| VS-21 | signal | 10Y / 실질금리 | 5.24% / 2.87% | macro.dgs10 / realYield10(10/8) | 5.24 / 2.87 | M |
| VS-22 | signal | HY / 풋콜 / F&G (chip '10/8 · 1거래일 전') | 315bp / 0.82 / 45 | hyOAS=3.15(10/8) / putCall 0.82 / fearGreed 45 | 3.15 / 0.82 / 45 | M (HY 기준일 라벨 정확) |
| VS-23 | signal | WTI/DXY/Gold | 91.85 / 102.23 / 4,216 | quotes[wti]/[dxy]/[gold] | 91.85 / 102.231 / 4216.3 | M |
| VS-24 | signal | USDKRW/USDJPY/KOSPI | 1,340.9 / 158.25 / 6,625.93 | usdkrw / history.usdjpy / kospi | 1340.9 / 158.25 / 6625.93 | M |
| VS-25 | breadth | 판정 대상 | **804개 종목** | breadth.segments.us.universe 813 / eligible 811 / d50 810 | 813/811/810 (804=highLow) | **MISMATCH** (→X-A1) |
| VS-26 | breadth | 50/20/200MA 위 | 35% / 51% / 50% | us.above50=34.8 / above20=50.6 / above200=49.9 | 34.8/50.6/49.9 | M |
| VS-27 | breadth | 40일선 위 | 36% | (40일 창 없음) | n/a | NO_SOURCE |
| VS-28 | breadth | 상승종목비율(10일평균) | 49% | (10일평균 없음; us 1일 63.8%) | n/a | NO_SOURCE |
| VS-29 | breadth | 신고−신저 | +11 (24·13) | contributors.sessions[last].counts | 24-13=+11 | M |
| VS-30 | breadth | 4%↑−↓(5일합) | +17 (22·11) | contributors counts up4/down4 | 오늘 22-11=+11 | M |
| VS-31 | breadth | S&P 500 | 7,812 | history[last].spx | 7811.54 | M |
| VS-32 | breadth | 분배일 | 7 | history[last].distributionDays | null | NO_SOURCE |
| VS-33 | sentiment | CNN F&G | 45 **중립** (전일 +5·5일 +14·20일 +12) | fearGreed.score/rating/previousScore/previousWeek | 45 / "fear" / 38 / 40 | **MISMATCH+BASIS** (→X-C2, X-B2) |
| VS-34 | sentiment | VIX 기간구조 | 0.84 정상 10/9 | 14.84/17.77 | 0.8351 | M |
| VS-35 | sentiment | HY | 315bp 안정 10/8·1거래일 전 | hyOAS=3.15(2026-10-08) | 3.15 | M |
| VS-36 | sentiment | 풋/콜 | 0.82 중립 10/9 | putCall.totalPutCall / asOf | 0.82 / 2026-10-09 | M |
| VS-37 | sentiment | AAII 약세 | 39.0% 10/7 | meta.aaiiObservedAt | 2026-10-07 | M |
| VS-38 | briefing | S&P/Nasdaq | 7,811.54 / 27,366.17 | quotes spx/nasdaq | 7811.54 / 27366.17 | M |
| VS-39 | briefing | 10Y 1일 | +1.0bp (행 +1bp) | macro.dgs10 prev 5.231 | +1.3bp | **BASIS** (→X-B3) |
| VS-40 | briefing | HY / 풋콜 / F&G | 315bp / 0.82 / 45 | hyOAS / putCall / fearGreed | 3.15 / 0.82 / 45 | M |
| VS-41 | briefing | KOSPI / USDKRW | 6,625.93 / 1,340.9 | kospi / usdkrw | M |
| VS-42 | briefing | 헤더 날짜 | 2026-10-11 (일) | 오늘 KST | 2026-10-11 | M |
| VS-43 | technical | 6축 판정 | 혼조 · 우호3·중립0·부담3 | signal #regime-counts 동일 payload | 우호3·중립0·부담3 | M |
| VS-44 | technical | SPY 일봉 | 불러오는 중…/판정 대기 | data.json quotes=[] (client-direct-fetch-only) | n/a | NO_SOURCE(키 없음) |
| VS-45 | macro | 10Y/WTI/DXY 축 | 5.24% / 91.85 / 102.23 | dgs10 / wti / dxy | M |
| VS-46 | macro | 연준범위·2년물 스프레드 | 3.75–4.00% / +0.92%p | fedTargetLower 3.75·Upper 4 / dgs2 4.8 | 4.8−3.875=0.925 | M |
| VS-47 | macro | CPI/근원/ PCE/근원PCE | 3.4/2.4/3.4/3.0% | macro.cpi/coreCpi/pce/corePce(8월) | 동일 | M |
| VS-48 | macro | 실업률/NFP/임금 | 4.2% / +29천 / 3.0% | unemployment/nfp/usWageGrowth(9월) | 동일 | M |
| VS-49 | macro | HY | 315bp (5일 −9bp) | hyOAS 3.15 / hyOASDelta5 −0.09 | M |
| VS-50 | macro | 다음 발표 | 미국 CPI 2026-10-14 | macro-stat meta '다음 10/14' | M |
| VS-51 | fxbond | 곡선 2/5/10/20/30 | 4.80/5.02/5.24/5.65/5.60% | dgs2/5/10/20/30 | 동일(10/9) | M |
| VS-52 | fxbond | 2s10s / 5s30s | +0.44%p / +0.58%p | t10y2y 0.44 / 5.60−5.02 | M |
| VS-53 | fxbond | 실질/기대/ HY /기간프리미엄 | 2.87(10/8)/2.33(10/9)/315bp(10/8)/1.08(10/2) | realYield10/breakeven10/hyOAS | M (카드별 as-of 표기) |
| VS-54 | fxbond | DXY/KRW/JPY/10Y | 102.23/1,340.9원/158.25엔/5.24% | dxy/usdkrw/usdjpy/dgs10 | M |
| VS-55 | fxbond | EUR/GBP/CNY/AUD | — (4행) | (durable 16종에 없음) | n/a | NO_SOURCE(예상) |
| VS-56 | market-news | 수집 창 | 10.9 08:00~10.10 08:00 KST | _serverDataMeta.newsCycleLabel | 동일 | M |
| VS-57 | market-news | 이전 수집분 | **39건** | data.json news[].length / meta.newsCount | **40** | **MISMATCH** (→X-A3) |
| VS-58 | market-news | 마지막 수집/경과 | 10.11 오전 12:23 · 17시간 | _serverDataMeta.generatedAt | 10-11 00:23 KST (16h) | M/BASIS (→X-C4) |
| VS-59 | screener | 아티팩트 기준 | 2026-10-10 생성 | screener.asOf (factorObservedAt 2026-10-09) | 2026-10-10 | M |
| VS-60 | screener | 유니버스/필드준비/부족 | **993 / 985 / 5** | screener.universe 993 / ok 989 | 993 / 989 | **MISMATCH** (→X-A2) |
| VS-61 | screener | 재무 커버리지 | 79.6% | fundamentalCoveragePct / denominator | 79.6 / 813 | M |
| VS-62 | screener | 사후검증 | 상위−하위 −0.84% · 2/6회 | rankingContract(predictiveValidation=not-established) | research-only | M |
| VS-63 | home | 헤더 날짜 | 2026.10.11 (일) KST | 오늘 KST | 2026-10-11 | M |
| VS-64 | ALL | 톱바 #live-quote-ts | 서버 10/9 마감 · **시세 16종** | coverage.observed 16 / meta.symbolsOk 78 | 16(tier0) / 78 | M(tier0), 78 미표기 (→X-D5) |
| VS-65 | ALL | 톱바 VIX 배지 | **VIX —** | quotes[vix].value / history[last].vix | **14.84** | **MISMATCH** (→X-C1) |
| VS-66 | portfolio | 노출 규칙 | VIX 자료 없음 | quotes[vix]=14.84 | 14.84 | **MISMATCH** (→X-C1) |
| VS-67 | home | 오늘 검증 뉴스 | 없음(all-news-outside-time-window) | newsCycleEnd 2026-10-09T23:00Z | 이전 사이클 40건만 | M(사이클 한정) |

---

## 2. 화면 간 동일값 매트릭스 (같은 지표의 값·기준일·basis)

| ID | 지표 | 화면별 표시 | 판정 |
|---|---|---|---|
| CS-01 | S&P 500 종가 | home 7,811.54 · signal 7,811.54 · briefing 7,811.54 · breadth 7,812 | 일치 (반올림) |
| CS-02 | Nasdaq | home 27,366.17 · briefing 27,366.17 | 일치 |
| CS-03 | **VIX** | **톱바 배지 19화면 '—'** · home 14.84(-3.70%) · signal 14.84 · briefing 14.84 | **불일치 → X-C1** |
| CS-04 | US10Y 수준 | home 5.244 · briefing/fxbond/macro 5.24% | 값 일치(정밀도 상이) → X-B4 |
| CS-05 | **US10Y 1일 변화** | home **+1.3bp** · briefing **+1bp(+1.0bp)** | **불일치 → X-B3** |
| CS-06 | US2Y | fxbond 4.80% · macro 스프레드 +0.92%p | 일치 |
| CS-07 | HY OAS | signal/sentiment/macro/briefing/fxbond 315bp (기준 10/8 라벨) | 일치 |
| CS-08 | DXY | home/briefing/fxbond/macro/signal 102.23 | 일치 |
| CS-09 | WTI | home/briefing/macro/signal 91.85 | 일치 |
| CS-10 | Gold | home 4,216.30 · briefing/macro/signal 4,216 | 일치 |
| CS-11 | USD/KRW | home/briefing/fxbond/signal 1,340.9 | 일치 |
| CS-12 | USD/JPY | signal 158.25 · fxbond 158.25 | 일치 |
| CS-13 | KOSPI | home/briefing/signal/fxbond 6,625.93 | 일치 |
| CS-14 | **BTC** | home 82,871.30(현재 세션) vs history 82,546.32(직전 종가) | **basis 상이 → X-B1** |
| CS-15 | **F&G 45 등급** | home/sentiment/pulse **중립** vs data **fear** | **불일치 → X-C2** |
| CS-16 | 풋/콜 | sentiment/signal/briefing 0.82 | 일치 |
| CS-17 | **50MA 위 비율** | signal/breadth/home/briefing 35% (값 일치) · 라벨 pulse **공포 영역** vs breadth/signal **부담** | 값 일치 / **라벨 불일치 → X-C3** |
| CS-18 | **breadth 유니버스** | breadth **804** vs screener us 813/811/810 (contributors highLow 804) | **불일치 → X-A1** |
| CS-19 | 6축 판정 | home/signal/technical 혼조·우호3·중립0·부담3 (동일) · pulse UPTREND/스트레스63 | 일치(별 어휘) |
| CS-20 | 미국 종가 기준일 | 8개 화면 모두 "10/9 미국 종가 기준" (+ 톱바 "서버 10/9 마감") | 일치 |
| CS-21 | 날짜 3종 | KST 달력 10/11(home/briefing) · KST 사이클 행 10/10(history) · 미국 종가 10/9 | 일치(각 라벨) |
| CS-22 | **S&P 고점 기준** | home **사상 최고치 부근** vs signal/breadth **1년 고점 대비 -0.1%·고점권** | **불일치 → X-B5** |
| CS-23 | screener 기준일 | asOf 2026-10-10 · KR 세션 2026-10-08 / US 2026-10-09 | 일치(행별 표기 없음 → X-D6) |
| CS-24 | 리비전 | UI _serverDataMeta / market-snapshot.json / ops.dataRevision = 동일 b98b55b4 | 일치 |
| CS-25 | 버전/ops | home v57.36 = ops.appRevision v57.36 (overall OPERATOR_REQUIRED) | 일치 |

---

## 3. 발견 (findings) — ID · route · 위치 · expected(데이터 근거) · actual · 수정 방향 · 확신도

### 등급 A — 틀린/낡은 데이터 (3)

**X-A1** · routes=`breadth` · 위치: `#breadth-basis` + "판정 대상 N개 종목"
- expected: **810 (또는 811/813)** — `screener.json breadth.segments.us.eligibleByWindow.d50=810`, `.eligible=811`, `.universe=813`; 804는 `breadth-contributors.json sessions[last].eligible.highLow`(신고/신저 분모)
- actual: "판정 대상 **804**개 종목"
- 수정: 같은 페이지의 50일선/200일선 비율(35%/50%)은 ~810 분모로 계산되는데 기준선은 804로 표기 → SMA 분모(811/810)로 고치거나, 804가 신고/신저 분모임을 명시.
- 확신도: 중간

**X-A2** · routes=`screener` · 위치: `#scr-funnel-ready`, `#scr-funnel-unavailable`, `#scr-workbench-status`
- expected: **989** — `screener.json ok=989` (universe=993). 표시된 985+5=990≠993 (내부 산술 불일치)
- actual: "필드 준비 985 / 데이터 부족 5 / 유니버스 993"
- 수정: ready = 아티팩트 ok(989)이거나, ready+unavailable = universe(993)가 되도록 정렬. 페이지가 별도 필수필드(ret3m·pctSma200·rsi14) 필터를 적용한다면 그 정의를 화면에 명시.
- 확신도: 중간

**X-A3** · routes=`market-news` · 위치: `#live-news-feed`
- expected: **40** — `data.json news[] length=40`, `meta.newsCount=40`
- actual: "이전 수집분 **39건**"
- 수정: 아티팩트 항목 수(40)와 일치시키거나 제외 1건의 사유 표기.
- 확신도: 낮음

### 등급 B — 같은 값이 다른 basis/값 (5)

**X-B1** · routes=`home` · 위치: hero BTC 카드
- expected: **82,546.32** — `history.json[last].btc=82546.32` (`fieldMeta.btc.valueBasis="previous-completed-close"`); 대조: `market-snapshot.quotes[market.crypto.btc].value=82871.3`, `session=CURRENT_SESSION/quality=CURRENT`
- actual: "BTC 82,871.30 (+0.39%)"
- 수정: 크립토는 종가가 없으므로 라이브 값 자체는 방어 가능하나, "10/9 종가" 블록에 섞지 말고 세션/as-of 라벨을 붙일 것. 완료-종가로 환산하면 82,546.32.
- 확신도: 중간

**X-B2** · routes=`sentiment`, `home` · 위치: F&G 카드 "전일"/home 공포·탐욕 행
- expected: **+7** — `fearGreed.score=45`, `fearGreed.previousScore=38` → 45−38=+7 (`previousWeek=40` → +5, history 2026-10-08=39.8 → +5)
- actual: "전일 **+5**"
- 수정: +5는 주간(previousWeek) 델타 → 라벨을 주간으로 바꾸거나 전일 델타(+7)로 재계산. 주간 값을 '전일'로 표기하지 말 것.
- 확신도: 중간

**X-B3** · routes=`briefing`, `home` · 위치: "미 10년물 (1일 …)"
- expected: **+1.3bp** — `macro.dgs10=5.24`(asOf 2026-10-09), 직전 5.231 → +1.3bp; `quotes[market.rates.us10y].changePct=0.2485`
- actual: briefing "+1.0bp/+1bp", home "+1.3bp"
- 수정: 동일 1일 bp 델타 반올림 규칙 통일.
- 확신도: 중간

**X-B4** · routes=`home` vs `briefing`/`fxbond`/`macro` · 위치: US10Y 수준
- expected: **5.244(^TNX) / 5.24(Treasury dgs10)** — `quotes[market.rates.us10y].value=5.244`, `macro.dgs10=5.24`
- actual: home 5.244 vs 나머지 5.24%
- 수정: 헤드라인 금리는 2dp·공식 dgs10 단일 소스로 통일하고, 두 provider 기저(^TNX vs Treasury)를 문서화.
- 확신도: 중간

**X-B5** · routes=`home` vs `signal`/`breadth` · 위치: home hero risk pill
- expected: **1년 고점 대비 -0.1%(고점권)** — signal `#regime-headline`, breadth `#breadth-read`("지수는 고점권(-0.1%)"); 아티팩트에 ATH 계열 없음
- actual: home "S&P 500 **사상 최고치** 부근"
- 수정: 데이터가 뒷받침하는 "1년 고점 대비 -0.1%·고점권"으로 낮추거나, ATH 시계열(예: 5y/전체)을 아티팩트에 추가.
- 확신도: 중간

### 등급 C — 기준일/단위/상태칩 오류 (6)

**X-C1** · routes=`ALL 19` (+ portfolio) · 위치: 톱바 `[data-vix-badge]`
- expected: **VIX 14.84 종가** — `market-snapshot.quotes[market.volatility.vix].value=14.84`, `history.json[last].vix=14.84`
- actual: "VIX —" (19화면 전부, 7초 warm 대기 후에도 동일)
- 수정: P1508 폴백(`js/aio-data.js:15156-15158`)이 발화하지 않음. 같은 화면 hero는 VIX 14.84(-3.70%)를 정상 표시하고 portfolio는 "VIX 자료 없음"을 띄움 → 배지를 durable 종가에 바인딩. **알려진 참고 재현·확인(콜드로드 한정 아님, 지속적).**
- 확신도: 높음

**X-C2** · routes=`home`, `sentiment`, `pulse` · 위치: CNN F&G 등급 라벨
- expected: **rating="fear"** — `data.json fearGreed.score=45`, `.rating="fear"` (45는 CNN 중립/공포 경계 — DA1 참조)
- actual: "중립"
- 수정: 아티팩트 등급(fear)과 정렬하거나, 45가 중립이어야 한다면 아티팩트 밴딩을 수정(화면만 고치지 말 것).
- 확신도: 중간

**X-C3** · routes=`pulse bar`, `breadth`, `signal` · 위치: market-pulse 시장폭 라벨 vs breadth/signal 상태칩
- expected: **부담** — `breadth.segments.us.above50=34.8` → `#breadth-state="부담"`; signal 동일 35%
- actual: pulse "35% · **공포 영역**" vs breadth/signal "**부담**" (동일 35%)
- 수정: 같은 폭 수치에 단일 어휘 사용. (`getBreadthRegime` js/aio-core.js:17941 은 <40을 '공포 영역'으로 매핑.) pulse bar는 현재 숨김(X-D1)이라 잠재 이슈.
- 확신도: 중간

**X-C4** · routes=`market-news`, ALL chrome · 위치: `#news-stale-age` vs `#server-data-age`
- expected: **16시간** — `_serverDataMeta.generatedAt=2026-10-10T15:23:15.089Z`(=10-11 00:23 KST)
- actual: `#news-stale-age` "17시간" vs chrome "16h 전"
- 수정: 동일 timestamp에서 파생되므로 연령 계산을 단일 클럭으로 통일.
- 확신도: 낮음

**X-C5** · routes=`home`, `macro` · 위치: home 다가오는 일정 vs `#macro-next-release`
- expected: **미국 CPI 2026-10-14 (오늘 10/11 → D+3)** — macro `#macro-next-release`, macro-stat meta "다음 10/14"
- actual: home "3일 안에 예정된 주요 발표가 없습니다"
- 수정: home 창 경계를 D+3 포함으로 하거나 창을 명시.
- 확신도: 낮음

**X-C6** · routes=`home` · 위치: 직전 종가 대비 변화 행
- expected: **-3.70%** — `quotes[vix].changePct=-3.6988959` (prev 15.41, 즉 -0.57pt)
- actual: "VIX **-0.6**"(단위 없음, 주변 행은 %)
- 수정: 이 블록에서 VIX만 포인트로 단위 없이 표기 → 단위 라벨 또는 %로 변환.
- 확신도: 중간

### 등급 D — 기타 (6)

**X-D1** · routes=ALL · `#market-pulse-bar`가 19화면 전부 `display:none`(값은 채워짐: mp-signal-score=63, mp-breadth-val=35%, mp-macro-val=UPTREND). 펄스 노출 또는 숨긴 sink 정리. (X-C3 라벨 불일치는 현재 비노출) · 확신도 높음
**X-D2** · routes=`home` · 최초 콜드 내비게이션에서 hero 전체 placeholder(VIX —, F&G 갱신 대기, 판정 대기) → warm 재로드 시 정상. 캡처 순서 아티팩트 가능성 높음 · 확신도 낮음
**X-D3** · routes=`technical` · `#stock-chart-status`/`#stock-chart-state` "SPY 일봉 불러오는 중…/판정 대기" — `data.json quotes=[]`·`meta.quotePolicy=client-direct-fetch-only(P715)` (헤드리스 키 없음). 데이터 파일 이상 아님 · 확신도 높음
**X-D4** · routes=`fundamental`,`ticker`,`portfolio` · 종목/보유 미선택 상태. 단 portfolio "VIX 자료 없음"은 X-C1과 동일 근원 · 확신도 중간
**X-D5** · ALL 톱바 `#live-quote-ts` = "서버 10/9 마감 · **시세 16종**" — `coverage.observed=16`(tier0)와 일치. **알려진 참고("시세 7종")는 재현되지 않음(16종)**. 다만 전체 데이터 플레인은 `meta.symbolsOk=78` 이므로 78 대비 과소표기 → 배지 의미 명확화 · 확신도 중간
**X-D6** · routes=`screener` · 랭킹 표의 KR 행은 `factorSessionDateByMarket.KR=2026-10-08`, US 행은 2026-10-09 인데 행/시장별 기준일 표기 없음 · 확신도 중간

---

## 4. blocked / 미확인

- breadth: 40일선 위 36%, 상승종목비율(10일 평균) 49%, A/D 라인 3,881, 분배일 7 — 7개 아티팩트에 대응 키 없음(`history[last].distributionDays=null` 포함).
- 20일 % 변화류(S&P +2.0%, Nasdaq +3.9%, DXY +2.8%, WTI -9.4%, Gold -3.1%) — 클라이언트 계산값, 이번 패스에서 history.json(420행)으로 독립 재계산하지 않음.
- CFTC 포지셔닝 백분위('10/6 기준 주간 보고') — `cftc-positioning.json` 미판독.
- fxbond EUR/GBP/CNY/AUD — durable 16종에 없음(정상 '—').
- 차트 canvas 픽셀(각 화면 차트) — OCR 미수행.
- 리짐 20일 축 내부 임계(1년 범위 95%/63% 등) — 파생 시리즈가 7개 아티팩트에 없음.
- home 콜드 vs warm 상이(X-D2) — 최초 로드 타이밍 문제인지 확인 필요.

---

## 5. 데이터 자체 이상 (별도 기록)

- **DA1** `data.json` fearGreed: score=45인데 rating="fear" (CNN 밴드 45–55=중립 → 아티팩트 등급이 경계에서 off-by-one 가능). X-C2의 반대편.
- **DA2** `data.json` macro: `_failedSeries=["cpi","unemployment"]`인데 같은 키가 `_successfulSeries`에도 있고 `meta.fredFailedSeries=[]` — 실패 시리즈 뷰 불일치.
- **DA3** `data.json` meta: `marketAnalysisOk=false`, `marketAnalysisSemanticOk=false`인데 briefing/signal이 자동 해석·6축 내러티브 렌더(evidence 11).
- **DA4** `screener.json` ok=989 vs 화면 "필드 준비 985" (X-A2).
- **DA5** `market-snapshot.json`: 크립토(BTC/ETH)만 `session=CURRENT_SESSION/quality=CURRENT`, 나머지 14종은 `MARKET_CLOSED/CLOSED_CURRENT` — X-B1의 근원.
- (참고) `market-snapshot-status.lastSuccessfulAt`과 `meta.marketSnapshotLastSuccessfulAt` 일치 → 신선도 앵커로 정상.

---

## 6. 방법 · 검증 노트

- 절약 절차 준수: 리포에 스크립트 미생성, 스크래치패드에서 Playwright 1개 스크립트 2회 실행, 서버 관리·git·타 파일 수정 없음. 산출물은 본 JSON/MD만.
- 각 라우트는 `?audit=<route>#<route>` 로 전체 문서 로드 후 `#page-<route>.active` 대기 + 3.2s(1차)/7s(2차) 렌더 대기. `window._aioHistory` 420행·`_liveData` 16종 확인(데이터 로드 성공 신호).
- DOM 추출: id별 텍스트, `data-snap/data-live-*` sink, 상태칩(`regime-state/basis-chip/…`), 라벨→값 쌍, 날짜 문자열, pulse/topbar 크롬.
- 대조 데이터는 `public-data/*.json` 7종 + `market-snapshot-status.json`. 데이터 파일을 기본 정답으로 하고, 값 불일치 시 데이터 근거(키 경로·정확값)를 findings에 명시(A/B 필수 조건 충족).
