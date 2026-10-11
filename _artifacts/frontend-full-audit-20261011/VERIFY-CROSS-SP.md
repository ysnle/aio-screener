# VERIFY-CROSS-SP — X-*/SP-* 더블체크 확정·기각 판정

- 역할: DeepSeek 횡단 관찰(CROSS-OBSERVATIONS / SP-OBSERVATIONS)을 코드·데이터 추적으로 재검증
- 방법: 값 writer file:line 추적 → 산출물 데이터 키 대조 → 확정/기각 판정. 브라우저 미사용, 읽기 전용(본 파일 1개만 생성)
- 기준일: 2026-10-11 (KST) / 최종 미국 종가 2026-10-09

## 판정 요약

| 구분 | 건수 | 항목 |
|---|---|---|
| 확정 (관찰 타당) | 11 | X-A1, X-A2/SP-B1, X-A3, X-B1, X-B2, X-B3, X-B4, X-B5, X-C1, SP-B2, SP-C1 |
| 기각 (값 오류 아님) | 1 | X-D5 (tier0 기준 정확 표기 — basis 라벨만 미표기) |
| 데이터 측 이상 확인 | 5 | DA1, DA2, DA3, DA4(=X-A2 동일 건), DA5 / DA6 이상 없음 |

## 판정표

| 항목ID | 판정 | 근거 (file:line / 데이터 키) | 수정 방향 | 우선순위 |
|---|---|---|---|---|
| **X-A1** breadth '판정 대상 804개' | **확정 — 분모 선택 오류** (신고·신저 전용 분모 804를 전체 '판정 대상' 문구에 사용) | writer: `src/ui/components/breadth-board.js:158-159` — `eligible?.highLow` → `판정 대상 ${eligible.highLow}개`. 데이터: `breadth-contributors.json` sessions[2026-10-09].eligible = `{movers:810, highLow:804}`. 같은 페이지 MA 비율(35%/51%/50%)은 `screener.json breadth.segments.us` = universe 813 / eligible 811 / d50 810 (above50 34.8). 즉 화면 비율의 실제 분모(~810)와 라벨 숫자(804)가 어긋남 | basis 라인은 MA 분모(`breadth.segments.us.eligible` 811 또는 `eligibleByWindow.d50` 810)를 쓰고, 804는 리더십(신고·신저) 카드에 '신고/신저 판정 대상 804'로 병기. 라벨 오류와 분모 선택 오류가 겹침 — 분모 선택이 근본 원인 | **High** |
| **X-A2 / SP-B1** 필드 준비 985 vs ok=989 | **확정 — 정의 차이가 화면에 미노출** (데이터 낡음 아님) | 계산: `src/domain/screener/screen-engine.js:309-318 summarizeScreenReadiness` — requiredFields 전부 보유 행만 eligibleCount. preset-balanced 필수 = `price.ret3m·price.pctSma200·price.rsi14` (`screen-engine.js:324`). rowCount=993(SCREENER_DB) → 985/993=99.2% 관측치와 정확 일치. 소비: `src/ui/pages/screener.js:1702`(미리보기), `:1243`, funnel `index.html:9285` ← `screener.js:1080-1090`. 산출물: `screener.json ok=989, universe=993` — 화면에 989 writer 없음. 993−989=4 수집 실패 + 989−985=4 수집됐지만 필수 필드 결측. funnel '데이터 부족 5'는 실행(run) 분모 소속이라 CROSS의 '985+5=990≠993' 산술이 곧 버그는 아님(실행 분모 칩·scope note로 분리됨, LC-25) | SP-B1 제안 채택: 라벨 분리 — "수집 성공 989/993(99.6%)"과 "프리셋 필수 필드 충족 985/993(ret3m·pctSma200·rsi14)" 병기. `ok`의 산정 주체를 화면 어딘가에 1회 고지 | **Medium-High** |
| **X-A3** 뉴스 39 vs 40 | **확정 — 카운트 기준 차이 + 1건 블랙리스트 무표기 소실** | writer: `src/ui/pages/news.js:364,368` — `model.outOfWindowCount`. 생성: `js/aio-data.js:11458`(블랙리스트 선제거) + `:11469` `outOfWindowCount = normalized.length − windowRows.length`. 데이터: `data.json news[]=40건, meta.newsCount=40` (`data.json:393,439`). 실측 재계산: `NEWS_BLACKLIST_KW`(`js/aio-data.js:8765`) 대입 시 정확히 1건 블랙리스트(그 1건: Washington Examiner 기사, 'nfl' 키워드) → normalized 39, 전건 창 밖(최신 pubDate 10-10 07:08 KST < 창 시작 08:00) → outOfWindowCount=39 | 39는 '블랙리스트 제외 후' 기준으로는 정확. 카운트 단일 소스화: meta.newsCount 기준으로 바꾸거나 '이전 수집분 39건(필터 제외 1건)'으로 남김. 무표기 소실 제거 | Low |
| **X-B1** home BTC 라이브 값 | **확정 — 세션 라벨 결여** (값 자체는 DA5 전제 하에 방어 가능) | writer: `index.html:6394` `data-live-price="BTC-USD"` → `js/aio-data.js:14420-14433`(가격)/`:14435-14450`(변화율) 공통 live 싱크. 데이터: `market-snapshot.json` quotes[market.crypto.btc] = 82,871.3, session=CURRENT_SESSION/quality=CURRENT (실측 확인). 같은 블록 이웃은 10/9 종가. 완료종가 82,546.32는 history.json 존재 | BTC 셀에 세션/기준 라벨 병기('현재 세션' 등) — '10/9 종가' 블록 문맥에 섞여 읽히지 않게 | Medium |
| **X-B2** F&G '전일 +5' vs +7 | **확정 — '전일' 기준 이중 (writer 2계열 공존)** | 표시 writer(+5): `src/ui/components/sentiment-board.js:75` — `seriesChange(fgSeries, 1)` 완료종가 시리즈 기준(45−40=+5). home 행: `src/domain/briefing/daily-diff.js:32,47-49,56-62` 같은 history 시리즈 기준. 서버 기준(+7): `data.json fearGreed.score=45, previousScore=38` → `js/aio-data.js:5924-5928` `_fearGreedDelta=+7`, element writer `:6206/:6230`('전일 대비'). previousWeek=40 → +5와 일치 | +5는 완료종가 기준으로 자체 일관. 라벨에 기준 병기('전일 종가 기록 +5 · CNN 전일 스코어 대비 +7')하거나 한 소스로 통일. '전일' 단어는 어느 기준인지 항상 명시 | Medium |
| **X-B3** 10Y 1일 변화 +1.3bp vs +1.0bp | **확정 — 반올림·소스 불일치** | home +1.3bp: `js/aio-data.js:14444` — unit 'bp' → `(move*100).toFixed(1)`, 기준 ^TNX 5.244 vs prev 5.231 → +1.3bp. briefing +1.0bp: `src/domain/briefing/market-read.js:321` — `signed(bp(tnx.value, tnx.d1), 1, 'bp')`, 기준 history tnx 2dp 행(5.24−5.23=+1.0bp) | 1-day bp 델타는 단일 반올림 규칙 + 단일 소스(^TNX 3dp 또는 dgs10 2dp 중 택일)로 통일 | Medium |
| **X-B4** 10Y 수준 5.244 vs 5.24% | **확정 — 포맷터·프로바이더 불일치** | home 5.244: `js/aio-data.js:14320-14326 _aioFormatLivePrice` — `^TNX` 계열 max=3(소수 3자리). briefing/fxbond/macro 5.24%: history tnx 2dp 행 및 `macro.dgs10=5.24`(`src/domain/briefing/market-read.js:191-192` 등) | 헤드라인 금리는 공식 dgs10(2dp) 단일 소스 + 단일 정밀도로 통일하고, ^TNX 기준값은 별도 표기. 두 프로바이더 basis 문서화 | Medium |
| **X-B5** '사상 최고치 부근' | **확정 — 라벨이 데이터 범위(420행)를 초과 서술** | writer: `js/aio-data.js:15878` — `pctFromATH >= -0.5 → '사상 최고치 부근'`. ATH 근거: `:15839` → `_aioSpxAthFloor()`(`:5284-5293`) = max(window._spxATH, DATA_SNAPSHOT.spxATH, live ^GSPC, history.json 'spx' 시리즈 전체). history.json은 420행(seriesMode=completed-market-cut, ≈1.7년) → -0.1% → 부근 표기. signal/breadth '1년 고점 대비 -0.1%·고점권'은 같은 수의 정확한 라벨 | '사상' → '기록 고점(수집 1.7년) 대비 -0.1%'로 서술 통일, 또는 ATH 근거 시리즈를 확장한 뒤에만 '사상' 사용 | Medium |
| **X-C1** VIX 배지 '—' 전 라우트 | **확정 — 싱크가 라이브 게이트 경로에만 바인딩(구조 결함)** | 유일 writer: `js/aio-data.js:15158` `[data-vix-badge]`, 포함 함수 `applyLiveQuotes()`(`:14675`, callers `:5708`=data.json quotes=[] 빈배열, `:13542/13782-13925` 라이브 fetch, `:14239` 캐시). P1508 폴백(`:15157`)도 동일 함수 내부(vp null + `window._aioHistory` vix>0 행 — history.json은 vix 보유, 데이터 측 정상). 서버 스냅샷이 홈 히어로·data-live 싱크는 채우지만 이 배지 갱신 경로는 실행되지 않음 → 마크업 기본값 'VIX —' 19개 라우트 지속. portfolio 'VIX 자료 없음'(#pf-exposure-rule)도 동일 게이트 | 배지 갱신을 서버데이터/완료종가 플레인에도 바인딩(스냅샷 apply 경로에서 재호출 또는 data-live 싱크화) | **Medium-High** |
| **X-D5** topbar '시세 16종' | **기각 — 값 오류 아님. 단, basis 미표기는 개선 여지** | writer: `js/aio-core.js:3960+3973` — `count = meta.count \|\| coverage.observed` = 16(market-snapshot tier0 커버리지, 실측 16 quotes와 일치) → `' · 시세 16종'`(P1599/G05 의도 표기). `data.json meta.symbolsOk=78`은 전체 데이터 플레인(별개 개념) — '과소표기'가 아니라 tier0 시세 플레인의 정확한 표기 | (선택) '시세 16종(tier0)' 라벨로 개념 명시. 카운트 소스 변경 불요 | Low |
| **SP-B2** 재무 커버리지 3중 노출 | **확정 — 서로 다른 3개 개념이 분모·스코프 라벨 없이 병존** | (a) 79.6%: writer `js/aio-data.js:6677/:6682` ← `screener.json fundamentalCoveragePct=79.6` (분자 fundamentalCount=647 / 분모 813 = US 스크리너 유니버스, mixed-fields — 분모·분자 미표기). (b) 652/757: writer `src/ui/pages/screener.js:1211-1212` ← `screener.json secFundamentalsStored=652 / secFundamentalsEligible=757` (SEC FY 정규화 전용, 분모 757 ≠ 993·813). (c) 649: `data.json meta.secFundamentalsCount=649` (SEC 수집 성공 카운트, `:450`) — 652와의 차이는 산출물 간 수집 시점 차이. 판정: 세 숫자는 같은 개념이 아님(혼합 필드 커버리지 / SEC FY 스코프 / SEC 수집량) | 커버리지 문장 1개로 통일 — "공시 재무 커버리지 647/813(79.6%, US 개별주 · 혼합 필드)" + SEC 계열(652/757)은 '별도 스코프(SEC FY, 분모 757)' 라벨 또는 접기. 649는 data-status 상세로만 | Medium |
| **SP-C1** 공통 배너 '데이터: 미수신' | **확정 — 근거 유형 미분해 표기 (환경 의존 caveat 유지)** | writer: `js/aio-core.js:6443-6451` sourceLabelMap.UNAVAILABLE='데이터: 미수신'. sourceKind 산출: `_aioBuildPageDecision`(`:4891`) 근거 병합 — `requireLiveDom && liveDom===0 → emptyKind UNAVAILABLE`(`:4621`), 최악 병합(`:4641`). 즉 라이브/현재성 근거(quotePolicy=client-direct-fetch-only + 감사 환경 CORS 차단)만 없어도 UNAVAILABLE → 정적 산출물(asOf 2026-10-10, 993행)이 최신임에도 '미수신'으로 읽힘. '공통컷 지연' 칩 = sharedCut(`:6452-6460`) | '데이터: 미수신' → '정적 스냅샷 10/10 도착 · 라이브 시세 근거 미수신'처럼 대상별 분해. 공통컷 지연 판정 근거(다음 사이클 예정 시각) 병기 | Medium |

## 데이터 측(DA) 검증

| 항목ID | 판정 | 근거 (데이터 키) | 수정 방향 | 우선순위 |
|---|---|---|---|---|
| DA1 | **확정** (이상 존재) | `data.json:1040-1041` fearGreed.score=45, rating='fear' — CNN 밴딩(45~55 중립)이면 boundary off-by-one 의심. X-C2의 반대편 | artifact 밴딩 임계 점검 후 화면 라벨과 정렬 | Medium |
| DA2 | **확정** (이상 존재) | `data.json macro._failedSeries=['cpi','unemployment']`인데 `_successfulSeries`에 동일 두 키 존재 + `meta.fredFailedSeries=[]` — 두 실패 뷰 상호 모순 (실측 재확인) | 실패 플래그 생성 로직 단일화, 어느 쪽이 참인지 산출물에 명시 | Medium |
| DA3 | **확정** (플래그-노출 불일치) | `meta.marketAnalysisOk=false && marketAnalysisSemanticOk=false` (실측) — briefing/signal은 auto interpretation·6축 내러티브 렌더 중 | 내러티브 신선도/검증 상태를 화면에 노출 | Low |
| DA4 | **확정** (=X-A2/SP-B1 동일 건) | `screener.json ok=989, universe=993` vs 화면 readiness.eligibleCount=985 | X-A2 수정 방향과 동일 | Medium-High |
| DA5 | **확정** (정상, 단 BTC 이중값 원인) | market-snapshot 16 quotes = 14 MARKET_CLOSED/CLOSED_CURRENT + 2 CURRENT_SESSION/CURRENT(BTC/ETH) — 24/7 자산이라 정상 (실측) | X-B1 라벨링으로 흡수 | Low |
| DA6 | 이상 없음 | market-snapshot-status.lastSuccessfulAt = data.json meta.marketSnapshotLastSuccessfulAt 일치 · 신선 | 없음 | — |

## 구조적 시사점

1. **카운트 단일 소스화**: 유니버스/준비/커버리지 카운트가 산출물 키와 런타임 계산을 넘나든다(993/989/985, 647/813·652/757·649, 40/39). 화면은 '한 개념=한 키'만 읽고, 다른 개념은 분모·스코프 라벨과 함께 별도 표기해야 한다 — 숫자 자체보다 '몇의 무엇인지'가 결함의 실체다.
2. **포맷터 통일**: 금리는 ^TNX 3dp(live)와 dgs10/history 2dp가, bp 델타는 toFixed(1)와 0dp 반올림이 화면마다 섞인다(5.244/5.24, +1.3bp/+1.0bp). 소스와 반올림 규칙을 한 곳(공용 formatter)으로 모으고 home/briefing이 같은 함수를 쓰게 한다.
3. **서술 단일화**: '사상 최고치'(420행 시리즈), '전일'(CNN previousScore vs 완료종가), '판정 대상'(highLow 804 vs MA 810)처럼 자연어 라벨이 데이터 근거 범위를 넘는 케이스가 반복된다. 라벨은 산출물이 실제로 갖는 기준(기록 범위·이전 세션·분모) 안에서만 쓴다.
4. **라이브 게이트 writer 분리**: [data-vix-badge]처럼 applyLiveQuotes 전용 경로에만 묶인 싱크는 서버 스냅샷/완료종가 플레인이 도착해도 갱신되지 않는다(X-C1·SP-C1 공통). '라이브 전용 싱크'와 '서버데이터 싱크'의 경계를 계약으로 명시하고, 판단 배너의 '미수신'은 근거 유형별로 분해 표기한다.
