---
verified_by: agent
last_verified: 2026-07-02
confidence: high
latest_version: v51.91
latest_P_number: P587
total_entries: 370
next_P_number: P588
---

> 2026-07-02: header counters were stale (claimed P551/550 while the file tail already held P552-P581) —
> corrected by counting actual `## P` headings. This file has a mixed prepend/append history (older entries
> newest-first near the top, P552+ appended oldest-first at the tail) — grep by P-number, don't assume position.

## P551 - v51.76 - Public share readiness existed only as console audit, not visible product contract

- **발생**: `AIO.getShareReadinessAudit()` and page/data audits existed, but the default home path did not show an external user whether the deployed screener was safe to treat as current, stale, or beta-with-warnings. The home topbar also still had a static `FINNHUB 실시간` label and runtime topbar paths could promote fresh source reception to "실시간" wording.
- **원인**: Internal audit contracts and user-facing readiness were separated. CI verified audit functions existed, but did not require a home readiness surface that combines version, public-data age, page currentness, and pipeline status.
- **수정**: Added `#aio-public-readiness`, `_aioBuildPublicShareReadiness()`, `AIO.getPublicShareReadiness()`, and `_aioRenderPublicReadiness()` so home shows beta share status from the same runtime audits. Downgraded static/topbar quote labels to source-aware wording. Reworked `krSupply` scheduler optional call through `_aioCallOptionalGlobal()` to remove the undefined guarded-function WARN. Runtime CI now requires the public readiness panel and blocks `FINNHUB 실시간`.
- **violated_rule**: R238, R239.
- **prevention**: External-share readiness must have both console audit and visible home surface. Runtime gate must fail if the visible home readiness surface is removed or static live labels reappear.
- **verification**: `node --check js/aio-data.js`; `node --check js/aio-core.js`; `node scripts/ci-runtime-contract-check.mjs`.

## P550 - v51.75 - Residual static LIVE and rolling 48h news labels survived page-level currentness contract

- **발생**: P549에서 decision header source cap은 닫혔지만, 페이지 내부 보조 배지에 `● LIVE`, `LIVE RSS`, 한국 이슈 카드 `48시간 이내`, `filterByAge(newsCache, 48)` 소비 경로가 남아 있었다. 브라우저상 상단 header는 source-aware였지만 사용자가 실제로 보는 내부 카드/배지는 여전히 live/rolling 48h처럼 보일 수 있었다.
- **원인**: P549의 구조 수정은 decision header와 market-news 대표 라벨에 집중했고, 페이지 내부 static badge와 보조 뉴스 소비 함수까지 같은 회귀 게이트로 묶지 못했다.
- **수정**: visible static live/action labels를 `SOURCE 확인`, `DATA 확인`, `RSS 확인`, `수신`으로 낮췄다. `renderKrIssues()`와 `computeNewsRiskSignals()`가 rolling 48h 대신 `filterByKst0800NewsCycle()`을 재사용하게 했다. runtime/data CI에 `● LIVE|LIVE RSS|BUY/LONG|공격적 매매` 정적 라벨 금지와 rolling 48h newsCache 직접 필터 금지를 추가했다.
- **violated_rule**: R238.
- **prevention**: `scripts/ci-runtime-contract-check.mjs`와 `scripts/ci-data-pipeline-contract-check.mjs`가 P549 이후 남은 내부 라벨/소비 경로까지 검사한다.
- **verification**: `node scripts/ci-runtime-contract-check.mjs`; `node scripts/ci-data-pipeline-contract-check.mjs`.

## P549 - v51.74 - Page currentness overstatement and news-window label drift

- **발생**: 전수 점검에서 일부 페이지가 소수 live 지표만으로 페이지 전체를 `LIVE`처럼 보이게 할 수 있었다. `market-news` 화면은 데이터 계약이 08:00 KST 완료 24h인데 UI에는 `최근 48시간/48시간 이내`가 남아 있었다. 기술 페이지는 시장 종합 시그널이 중립이어도 건강도 65+에서 `공격적 매매 가능`을 표시했고, 티커 기본 액션은 데이터 입력 전부터 `BUY / LONG`이었다. 테마 상세는 선택 테마의 데이터 현재성/의미를 충분히 보여주지 못했다.
- **원인**: 페이지 판단 헤더가 공통 currentness/evidence 계약 없이 `_aioDefaultDecision()`의 일부 live 시장 지표만 근거로 sourceKind를 승격했다. 뉴스 surface 계약과 visible copy가 같은 게이트로 묶이지 않았고, 기술/티커/테마 상세 화면은 데이터 수신 전 기본 문구가 행동 신호처럼 보이는 것을 차단하지 못했다.
- **수정**: `AIO_PAGE_EVIDENCE_CONTRACT`, `AIO.getPageEvidenceState()`, `AIO.getPageEvidenceCurrentnessAudit()`를 추가하고 `_aioBuildPageDecision()`/`_aioRenderPageDecisionHeader()`가 evidence caveat와 다운그레이드된 sourceKind를 반영하게 했다. 뉴스 UI를 `08:00 KST 완료 24h`로 통일하고 empty state를 같은 계약으로 덮어썼다. 기술 점수 해석을 환경 진단으로 낮추고 종합 시그널 충돌 시 관망 문구를 추가했다. 티커 기본 액션은 `계획 대기`로 바꾸고 테마 상세에는 현재성 요약 블록을 추가했다. `_liveSnap()` 신선도는 `live 우선/source 확인`, `live+snapshot 혼합`, `대부분 snapshot/fallback`으로 낮췄다.
- **violated_rule**: R219(의미 검토), R216/R217(수집 freshness와 소비 coverage 분리), R230(뉴스 visible freshness), R512 계열 aggressive entry wording.
- **prevention**: R238로 승격. `scripts/ci-runtime-contract-check.mjs`는 page evidence 계약/헤더 caveat/고위험 페이지 source cap을 검사하고, `scripts/ci-data-pipeline-contract-check.mjs`는 market-news UI와 empty state가 08:00 KST 완료 24h 계약을 유지하는지 검사한다.
- **verification**: `node scripts/ci-runtime-contract-check.mjs`; `node scripts/ci-data-pipeline-contract-check.mjs`; browser에서 `AIO.getPageEvidenceCurrentnessAudit()`와 market-news/technical/ticker/theme-detail 표시 확인.

## P548 - v51.71 - calcTechnicalSnapshot 신규 필드가 UI/AI/아티팩트 소비 경로에서 부분 미연결

- **발생**: v51.68~v51.70에서 VCP, Fibonacci/Volume Profile, RSI divergence, weekly context가 `calcTechnicalSnapshot()`에 추가됐지만 일부 소비 경로가 닫히지 않았다. 티커 주봉 패널은 `_wc.wClose`/`_wc.wRsi14`를 읽었고 생산자는 `lastWeekClose`/`wRsi`만 반환해 주봉 종가/RSI가 `—`로 표시될 수 있었다. AI 채팅은 새 필드를 계산만 하고 VCP/Fib/매물대/다이버전스/주봉 컨텍스트를 답변 입력에 싣지 않았다. 서버 VCP 산출 경로는 있었지만 기존 `public-data/screener.json`에는 `vcpScore`가 없어 VCP 컬럼이 데이터 갱신 전까지 전부 공백이었다.
- **원인**: 생산자 함수 확장, visible UI, AI chat context, public-data artifact, CI gate가 같은 변경 단위로 묶이지 않았다. 기존 게이트는 함수/필드 존재 위주였고 실제 소비 문자열·별칭·아티팩트 커버리지를 실패시키지 않았다.
- **수정**: `_calcWeeklyContext()`가 `lastWeekClose/wClose`와 `wRsi/wRsi14`를 함께 반환하도록 alias를 추가하고, `analyzeTickerDeep()` 주봉 패널은 두 이름을 모두 fallback으로 읽게 했다. `_fetchTechnicalDataForChat()`에 VCP, Fibonacci/Volume Profile, RSI divergence, weekly context 라인을 추가했다. `scripts/fetch-data.mjs`를 재실행해 `public-data/screener.json` 852개 row에 numeric `vcpScore`와 `vcpStage`를 채웠다. `scripts/ci-runtime-contract-check.mjs`에 weekly alias, UI fallback, chat 소비 라인, fetch-data VCP 방출, public-data VCP 커버리지 검사를 추가했다.
- **violated_rule**: R233(기술분석 UI/AI 동기화), R222(artifact-to-consumer contract), R219(의미 검토 누락), R1(버전/캐시버스터 동기화).
- **prevention**: `calcTechnicalSnapshot()` 반환 필드 추가/이름 변경 시 생산자, visible UI, AI chat context, public-data artifact, CI runtime contract를 같은 작업 단위로 닫는다. 신규 서버 파생 컬럼은 `public-data/*.json`에 실제 값이 들어간 샘플 커버리지까지 확인한다. R235로 승격.
- **verification**: `rg -n "wClose: lastW.close|wRsi14: wRsi" js/aio-core.js`; `rg -n "피보나치/매물대|RSI 다이버전스|주봉 컨텍스트|• VCP:" js/aio-chat.js`; `node scripts/ci-runtime-contract-check.mjs`; `node -e "const s=require('./public-data/screener.json'); const rows=Object.values(s.data||{}); console.log(rows.filter(r=>typeof r.vcpScore==='number').length, rows.length)"`

## P547 - v51.66 - 카테고리별 데이터 기준 시각 추적 부재로 "누구는 1시간 전, 누구는 1일 전" 시간적 비일관성 노출 불가

- **발생**: DATA_SNAPSHOT에 가격/Fear&Greed/FRED/스크리너 각각의 마지막 갱신 시각을 추적하는 구조가 없어 사용자가 "지금 화면에 표시된 각 데이터가 언제 기준인지" 알 수 없었음. 스크리너 팩터(6h 갱신)와 실시간 가격(30s 갱신)이 같은 화면에서 기준 시각 없이 혼재.
- **원인**: 아키텍처적 추적 누락. `applyLiveQuotes()`, `_aioLoadServerData()` 모두 성공 시 별도 타임스탬프를 기록하지 않음. `DATA_SNAPSHOT`에 카테고리별 메타 필드 없음.
- **수정**: `DATA_SNAPSHOT._fieldTs` 객체를 `aio-core.js`에 추가(prices/fearGreed/macro_fred/screener/serverData 런타임 필드 + 정책 날짜 9개). 4개 기록 포인트 추가: `applyLiveQuotes()` 완료 시 `_fieldTs.prices`, `_aioLoadServerData()` FRED/F&G/screener 단계별 `_fieldTs.*`. `window._aioGetFieldTs(category)` KST 포맷 유틸. `_aioRenderDataFreshness()` 통합 UI 렌더러 — 스크리너 "팩터 HH:MM | 가격 HH:MM KST" 듀얼 표시, 매크로 `#macro-fred-ts` FRED 기준시각. `_aioCheckManualFieldStaleness()` — 중앙은행/정책 날짜 7일 초과 시 amber pill 경고.
- **violated_rule**: 데이터 신선도 명시 원칙 (신규 R 후보 — 이 버그 3회 재발 시 RULES.md 승격 예정).
- **prevention**: 모든 데이터 카테고리 적용 시 `_fieldTs` 기록 의무화. `_aioRenderDataFreshness()` 호출을 두 핵심 경로(서버 데이터 로드 후, 라이브 시세 적용 후)에 고정.

## P546 - v51.65 - FMP enrichFundamentals()가 HTTP 403/401 플랜 오류를 조용히 삼켜 밸류/퀄리티 팩터 미반영

- **발생**: GitHub Secrets에 `FMP_API_KEY` 등록됐으나 `screener.json`에 pe/roe/margin 필드 없음. 사용자가 FMP API가 작동하지 않는다고 인지.
- **원인**: `enrichFundamentals()`에서 FMP API 호출을 `.catch(() => null)`로 에러를 모두 삼켰음. FMP `ratios-ttm`/`financial-growth` 엔드포인트는 Starter 플랜($14.99/월) 이상 필요. 무료 키는 HTTP 403을 반환하지만 이것이 로그에 전혀 남지 않아 원인 불명 상태 지속. `out={}` 빈 객체가 truthy여서 병합도 no-op으로 처리.
- **수정**: `enrichFundamentals()`에 플랜 선진단 추가 (첫 심볼로 ratios-ttm 호출 → HTTP 4xx 감지 시 즉시 `planError: true` 반환 + 경고 로그). `.catch(() => null)` → `fmpFetch()` 래퍼(심볼별 에러 콘솔 출력). 반환 타입을 `{data, hasKey, ok, total, planError}` 객체로 변경. `fmpHasKey/fmpOk/fmpCount/fmpPlanError`를 `screener.json` + `data.json meta` + `data.meta` 후기록 + refresh-data.yml summary에 추가. `_serverDataMeta`에 FMP 필드 전파. UI: `#aio-pipeline-status-bar` (홈 파이프라인 상태 배너), `#screener-fmp-status` (스크리너 인라인 노트).
- **violated_rule**: R3 (에러 가시성 부재), 에러 삼킴 안티패턴.
- **prevention**: FMP 엔드포인트별 HTTP 상태 로깅 의무화. `fmpOk/fmpPlanError` CI summary 항목 추가로 매 Actions 실행마다 가시적 확인 가능. FMP 무료 키 제한 문서화.
- **user_action_needed**: FMP 무료 키라면 Starter 플랜($14.99/월) 이상으로 업그레이드 필요. 또는 시크릿 이름이 `FMP_API_KEY`인지 대소문자 포함 정확히 확인.

## P545 - v51.64 - fetchQuote()가 chartPreviousClose(주말 수집 시 전주 종가)로 pct 계산해 주간 변동률을 일간으로 오표시

- **발생**: 주말(토·일) 수집 시 Yahoo Finance `meta.chartPreviousClose`가 직전 거래일이 아닌 전주 금요일 종가를 반환. `fetch-data.mjs`의 `fetchQuote()`가 이를 그대로 `prev`로 사용해 주간 변동률을 `regularMarketChangePercent`로 기록. data.json → `applyLiveQuotes()` → `_LIVE_SNAP_MAP` → `DATA_SNAPSHOT.*Pct` 경로로 오값이 전파. (P544에서 수동 정정했으나 다음 cron 실행 시 재발 구조)
- **원인**: `chartPreviousClose`는 Yahoo Chart API의 "차트 기준 전일 종가"로 주말에는 전주 종가를 의미. 직전 거래일 종가를 얻으려면 `range=5d` 응답의 OHLCV `closes[-2]`를 사용해야 함.
- **수정**: `fetchQuote()`에서 `res.indicators.quote[0].close` 배열을 필터링해 `closes[-2]`를 실제 전일 종가로 사용. `closes`가 2개 미만일 때만 `chartPreviousClose` 폴백. `_pctSource: 'ohlcv-daily'|'chart-meta-fallback'` 감사 필드 추가. DATA_SNAPSHOT 헤더에 "가격/변동률 필드 수동 편집 금지, data.json에서 자동 파생" 원칙 명문화.
- **violated_rule**: R1 (데이터 정확성 — 표시 변동률은 일간 거래일 기준이어야 함), R3.
- **prevention**: `_pctSource` 필드를 CI watchdog에서 모니터링. `ohlcv-daily`가 아닌 경우 경고. DATA_SNAPSHOT 리터럴 가격 필드 직접 편집 시 R1 위반으로 간주.

## P544 - v51.63 - DATA_SNAPSHOT *Pct 값이 주간 변동률로 채워져 일간 변동률 오표시
- **발생**: v51.61에서 data.json의 `regularMarketChangePercent`를 일간 변동률로 사용했으나 실제로는 Yahoo Finance가 주간(weekly) 변동률을 반환. 결과: `spxPct -1.95`(주간)가 당일 -0.05%로 오표시, `nasdaqPct -4.60`(주간)이 당일 -0.24%로 오표시 등.
- **원인**: Yahoo Finance `regularMarketChangePercent` 필드는 주말(토·일) 수집 시 직전 주 대비 변동률을 반환하는 경우 있음. 스크립트가 이를 구분하지 않고 일간으로 처리.
- **수정**: v51.63에서 실측 일간 값으로 정정. spxPct -1.95→-0.05, nasdaqPct -4.60→-0.24, dowPct +0.60→-0.09, vixPct +6.54→-2.54, kospiPct -7.08→-5.81, kosdaqPct -11.92→-4.10.
- **예방**: data.json 갱신 시 `regularMarketChangePercent` 가 주간/일간 어느 것인지 날짜로 교차 검증 필요.

## P543 - v51.63 - nasdaq/dow/rut/vix/kosdaq/brent/gold/dxy가 // 주석 내에 묻혀 JS 프로퍼티 미정의
- **발생**: v51.61 DATA_SNAPSHOT 수정 시 한 줄에 여러 속성을 `//` 주석으로 구분 기재. JavaScript `//`는 그 줄 끝까지 주석 처리하므로 첫 `//` 이후의 속성들(`nasdaq`, `dow`, `rut`, `vix`, `kosdaq`, `brent`, `gold`, `dxy`)이 모두 주석 내 텍스트로 처리돼 `DATA_SNAPSHOT`에 미정의.
- **원인**: 단일 긴 줄에 "`속성, // 주석 속성, // 주석`" 패턴 기재 시 두 번째 속성부터 주석 처리됨. 파일 Read 도구가 이를 하나의 긴 줄로 렌더링해 시각적으로 구분이 어려웠음.
- **수정**: v51.63에서 각 속성 쌍을 별도 행으로 분리하여 실제 JS 프로퍼티로 정의.
- **예방**: DATA_SNAPSHOT 수정 시 한 줄에 `//` 이후에 속성을 절대 혼합하지 말 것. 각 속성 그룹은 항상 별도 행으로 기재.

## P542 - v51.47 - Screener watchdog 48h exit gate missing

- **symptom**: `data-watchdog.yml` screener age check logged `console.warn` for `scrAge > 24` but never failed CI. A screener enrichment outage lasting >48h would pass watchdog silently and go unnoticed by the operator.
- **root_cause**: The guard was written as a soft warning only, with no hard gate.
- **fix**: Added `process.exit(1)` branch for `scrAge > 48` with `console.error`. The 24h soft warning is kept; only the >48h case now fails CI.
- **violated_rule**: R1 data integrity — CI gates must enforce data freshness SLAs, not merely log warnings.
- **prevention**: CI should always have at least one hard-fail branch for stale-data conditions that are operationally unacceptable.

## P541 - v51.47 - Kalman measurement noise R was hardcoded, causing over-smoothing on low-volatility stocks

- **symptom**: `_kalmanTrend()` used a fixed `R = 1e-2` regardless of the actual volatility of the underlying asset. Low-volatility stocks had the filter over-trusting the model (treating observations as noisy) while high-volatility stocks had it under-reacting to real trend breaks.
- **root_cause**: R parameter was never connected to the per-symbol realized volatility available at the call site.
- **fix**: `_kalmanTrend(closes, vol)` now accepts an optional annualized volatility. `R = (annVol/100/√252)²` is computed when vol is provided and positive; falls back to 1e-2 otherwise. `closesToFactors()` pre-computes `vol60` and passes it through.
- **violated_rule**: R232 trading factor rigor — model parameters must match the statistical properties of the data they process.
- **prevention**: Cross-asset factor models should parameterize noise from realized vol rather than tuning on a single scale.

## P540 - v51.47 - Bollinger Band used population variance instead of sample variance

- **symptom**: `_calcBB()` divided sum-of-squares by `period` (population variance). TradingView and Bloomberg both default to sample variance (`period-1`), causing AIO Bollinger Bands to be systematically narrower than the reference standard for small windows.
- **root_cause**: Standard textbook BB formula uses population variance; the practitioner standard (Wilder, TradingView) uses sample.
- **fix**: Changed `/period` → `/(period-1)` in `_calcBB()`.
- **violated_rule**: R232 trading factor rigor — indicator implementations must match the de facto practitioner standard.
- **prevention**: Technical indicator implementations should cite and match TradingView/Bloomberg reference calculations.

## P539 - v51.47 - stageEstimate could not distinguish Stage 2 Advance from Stage 3 Topping

- **symptom**: `stageEstimate` returned `STAGE_2_ADVANCE` for any stock in full bull MA order, even when SMA50 had already started declining — a defining characteristic of late-stage distribution (Stage 3). Operators screening for Stage 2 breakouts would receive false positives from topping structures.
- **root_cause**: `calcTechnicalSnapshot()` computed only the current SMA50 value with no directionality check.
- **fix**: Added `sma50_5d` (SMA50 computed on closes excluding the last 5 bars) and `sma50Rising` boolean. When `fullBull` is true but `sma50Rising === false`, `trendState` returns `TOPPING` and `stageEstimate` returns `STAGE_3_TOPPING`. `sma50Rising` is exposed in the return object for downstream consumers.
- **violated_rule**: R232 trading factor rigor — stage classification must incorporate trend momentum, not just current price order.
- **prevention**: Stage identification should always check directional momentum of the key trend proxy (SMA50) in addition to cross-sectional price order.

## P538 - v51.46 - COMP_W.size dead key skewed backtest weight display

- **symptom**: `backtestFactors()` COMP_W included `size: 0.16` but neither `wTotal` nor `r.comp` formula included size. Backtest IC report displayed `compWeights` with size field, implying a contribution that never happened. Comment "라이브 기본 가중치(중립)와 동기화" was also false.
- **root_cause**: Size was added to COMP_W during an earlier iteration but the corresponding rank array (`rs`) and wTotal term were never added to the actual computation path. The field was decorative.
- **fix**: Removed `size` from COMP_W. Redistributed to 4-factor sum=1.00: `{ mom:0.35, trend:0.25, lowvol:0.25, kalman:0.15 }`. Updated comment to accurately describe scope.
- **violated_rule**: R1 (data integrity — displayed weights must match computed weights).
- **prevention**: CI weight-sum check already exists; add assertion that `Object.keys(COMP_W)` matches fields actually used in `wTotal` formula.

## P537 - v51.46 - FAILED_RETEST signal never fired due to missing failedRetest field

- **symptom**: `classifyTerminalCandle()` checked `snapshot.failedRetest` at line 16646, but `calcTechnicalSnapshot()` never returned this field. FAILED_RETEST (score 58, second-highest severity after BEARISH_CONFIRMATION 68) was permanently dead. AI chat technical context injected the result without ever receiving this signal category.
- **root_cause**: `failedRetest` logic was planned as part of the Minervini engine (identifying price that approaches the prior 20-day high but closes below it on elevated volume) but was only wired into `classifyTerminalCandle` — the field calculation was never added to `calcTechnicalSnapshot()`.
- **fix**: Added `rvol20` variable hoist and `prior20High` (max of prior 20-bar highs) before the return statement. `failedRetest` is now `true` when: close ≥ prior20High × 0.99 AND close < prior20High AND close < prevClose AND rvol20 ≥ 1.2.
- **violated_rule**: R232/R233 (technical factor rigor — signals declared must have corresponding calculation paths).
- **prevention**: CI contract gate should assert that every signal type reachable via `classifyTerminalCandle.set()` has a corresponding field in `calcTechnicalSnapshot()` return object.

## P536 - v51.45 - Ticker technical analysis described Minervini logic more deeply than it calculated

- **symptom**: Trading review found that the product promised a Minervini/SEPA-style workflow, but the visible ticker/deep-analysis runtime mostly used 5/10/20/50 trend checks, 20/50 and 50/200 crosses, RSI/MACD/Bollinger auxiliaries, and simple support/resistance. It did not explicitly expose the requested 5/10/20 short stack, 50/100/200 long stack, full 5/10/20/50/100/200 order, horizontal volume-profile supply zones, POC/Value Area, VCP contraction, or Fibonacci-zone confluence.
- **root_cause**: Strategy copy and chat prompts had advanced faster than the deterministic browser-side calculation surface. The ticker page and `calcTechnicalSnapshot()` shared no explicit MA-stack contract, so AI and UI could drift.
- **fix**: Added `_buildMinerviniTechnicalEngine()` with `_calcMinerviniMAStack()`, `_buildHorizontalVolumeZones()`, `_calcVcpQuality()`, and `_calcFibonacciConfluence()`. Expanded `_detectCrossSignals()` to 5/10, 10/20, 20/50, 50/100, 50/200, and 100/200. Updated visible ticker analysis, deep-analysis key levels, `calcTechnicalSnapshot()`, and AI chat context to share 5/10/20 and 50/100/200 stack semantics.
- **violated_rule**: R232 trading factor rigor extended -> R233.
- **prevention**: `scripts/ci-runtime-contract-check.mjs` now asserts the Minervini helper set, short/long MA stack coverage, Volume Profile/POC/Value Area beginner guidance, and AI snapshot parity.

## P535 - v51.44 - Screener Kalman backtest factor used raw price scale and trading wording over-signaled

- **symptom**: Trading review found that the screener/backtest Kalman fields in `public-data/screener.json` had extreme raw-price-scale values (`kalmanVelConf` p90 around 590 and `kalmanInnovZ` p90 above 33,000), making the Kalman factor incomparable across USD/KRW and high/low nominal price stocks. Several chat/static trading surfaces also still described `75+` market score as "적극 매수" even though the runtime score advice had already been softened to risk-managed entry language.
- **root_cause**: `scripts/fetch-data.mjs` ran `_kalmanTrend()` on raw closes and emitted absolute price velocity. A $1,000 stock and a $50 stock with the same percent move therefore produced very different Kalman velocity magnitudes. Separately, prompt/static copy had drifted from the newer `getScoreAdvice()` semantics.
- **fix**: `_kalmanTrend()` now filters on log prices and emits daily percent velocity with `scale: 'log_pct_day'`; `closesToFactors()` writes `kalmanScale`, and `_aioApplyServerScreener()` merges Kalman fields only when that marker is present. Trading guidance copy now uses "매수 우호/선별/분할/무효화 우선" instead of aggressive-buy wording.
- **violated_rule**: R219 semantic path, R222 public-data consumer contract, R230 partial/safe runtime surface pattern.
- **prevention**: `scripts/ci-data-pipeline-contract-check.mjs` asserts log-scale Kalman generation and versioned runtime merge; `scripts/ci-runtime-contract-check.mjs` blocks `75+ 적극 매수` wording regressions.

## P534 - v51.43 - Visual hierarchy remained too close to the old terminal concept

- **symptom**: Full-page visual audit showed that v51.42 was functionally organized but still felt too constrained by the early Bloomberg-terminal design premise. Home operator note was correctly promoted but rendered as a long wall of text above the decision flow, common page decision headers shared a near-identical cyan-heavy card treatment, `kr-technical` still surfaced legacy intro/chip content before a clean decision hierarchy, and the fundamental example-card grid had a small internal width leak.
- **root_cause**: The v51.30-v51.42 work removed default-path noise and hardened runtime errors, but did not change the global visual system enough. The legacy design tokens, comments, and repeated cyan accents kept every priority level looking similar, while operator-note rendering treated a long note body as first-screen content instead of extracting the scan-ready lead.
- **fix**: Added the v51.43 visual hierarchy refresh CSS layer with warmer neutral surfaces, balanced semantic accents, non-negative letter spacing, calmer cards, clearer decision headers, amber operator-note priority styling, KR technical legacy-intro suppression, and intrinsic `fund-cards-grid` tracks. Added a final operator-note renderer that exposes a short lead with expandable full memo.
- **violated_rule**: R228 pattern extended -> R231.
- **prevention**: `scripts/ci-ux-default-path-check.mjs` now asserts the visual refresh layer, operator-note lead/full-memo split, KR technical legacy-intro suppression, fundamental grid overflow guard, and R231/QA documentation.

## P533 - v51.42 - Live default path logged unsafe toFixed before full runtime confidence

- **symptom**: Live v51.40 home load rendered the promoted operator note in the correct first-screen position, but browser console reported `aio-core.js?v=51.40` `Cannot read properties of undefined (reading 'toFixed')`. This weakened confidence that all default-path runtime modules were healthy for real users.
- **root_cause**: Several default-path renderers formatted partially loaded numeric objects directly with `.toFixed()` (`live.price`, scenario sums, chart tooltip parsed values, VIX/CPI context). Static checks covered version/default-path layout, but not partial numeric payloads arriving as `undefined` or incomplete objects during live initialization.
- **fix**: Added `window._aioSafeFixed()` and routed live/default-path numeric renderers through it in `js/aio-core.js` and home VIX renderers in `js/aio-data.js`. Extended `scripts/ci-runtime-contract-check.mjs` to block the specific unsafe patterns found during live QA.
- **violated_rule**: R3, R15, R228.
- **prevention**: Live/default-path renderers must treat all network and derived numeric fields as partial until normalized. CI must include binary guards for direct `.toFixed()` on nested live/scenario/chart fields.

## P532 - v51.40 - Operator note was buried below first-screen decision flow and Signal hidden sink could reappear

- **symptom**: User screenshot review showed the operator note below the market status/decision flow, making the session-critical note easy to miss. The Signal default route also retained runtime folding logic that could wrap hidden `#signal-lockout-control` into a visible `고급 매매 조건` row.
- **root_cause**: The operator note was treated as a secondary home card rather than a pre-session priority message, with small body text and no structural top-of-page contract. P529 hid the Signal lockout legacy sink in HTML, but `_aioFoldDensePageControls('signal')` still selected the hidden sink and could reintroduce it as a collapsed default-route control.
- **fix**: Promoted `#home-operator-note` to the top of the home page, added larger dedicated operator-note CSS, filtered sample tags in the renderer, and disabled Signal lockout folding. Extended `ci-ux-default-path-check.mjs` to guard operator-note priority/typography and the Signal fold regression.
- **violated_rule**: R3, R228.
- **prevention**: Default-route UX gates must check not only removal of noisy blocks but also priority ordering for operator-facing session notes and ensure hidden legacy sinks are never revived by runtime folding helpers.

## P531 - v51.30 - News self-injection was live but ranked weak/stale items as core news

- **symptom**: Home core news and market briefing could show 1-2 day-old items and miss the real current market story. Local `public-data/data.json` at 2026-06-24 KST had 40 scored news items, but top-ranked headlines included weak/re-syndicated sources such as Ad-hoc-news, The Vibes, Pluang, and IndexBox while the actual current market theme was AI/semi selloff/rebound and Korea chip-stock pressure/recovery.
- **root_cause**: `scripts/fetch-data.mjs` assigned `item.tier` from the Google News feed definition, then `scoreServerNewsItem()` treated that as article source tier. A high-priority Google search could therefore make a low-quality source receive a tier-1 bonus. Home news also allowed a 72h surface window, so stale but scored items could remain visible.
- **fix**: Added actual source-tier detection with explicit low-quality source penalties, preserved feed tier separately as `feedTier`, added current Korea AI/semi market-mover query coverage, sorted KR reserved slots by score before recency, and tightened the home surface contract to 30h with fallback using the same contract value.
- **violated_rule**: R3, R219, R222, R226.
- **prevention**: Data/news refresh quality gates must test source tiering, low-quality penalties, current market-mover query coverage, and visible home freshness windows, not only artifact existence or news count.

## P530 - v51.30 - Refresh workflow summary syntax break stopped public-data commits

- **symptom**: Data freshness watchdog can fail repeatedly even though the collect -> artifact -> consume contract exists. Local artifact check at 2026-06-24 21:43 KST showed `public-data/data.json` generated at 2026-06-24 14:50 KST, age 416 minutes, exceeding the 180 minute watchdog threshold.
- **root_cause**: `.github/workflows/refresh-data.yml` Pipeline status summary embedded Node heredoc had mojibake-corrupted strings and an unterminated quote. Fetch steps could succeed, but the summary step could throw a syntax error before the commit/push step, leaving public-data artifacts stale and causing watchdog failures.
- **fix**: Rewrote the summary step with ASCII-safe labels and valid JavaScript. Strengthened `scripts/ci-data-pipeline-contract-check.mjs` to extract and syntax-parse Node heredoc blocks from `refresh-data.yml` and `data-watchdog.yml`.
- **violated_rule**: R3, R222, R229.
- **prevention**: Workflow-embedded scripts are executable code and must be parsed by CI, not only checked with regex wiring. Any scheduled refresh failure should be triaged as fetch, summary, commit, or watchdog separately.

## P529 - v51.30 - Practical UX review found empty grid tracks and collapsed-noise blocks

- **symptom**: User screenshots showed `home` market cards and `signal` snapshot cards occupying only the left side while the right side remained empty; collapsed "flow"/advanced blocks still consumed vertical attention; `breadth` had a visible Minervini framework card that duplicated existing breadth judgment; `sentiment` had duplicate gauges and a long left rail from F&G subcomponents/crypto temperature, leaving large unused right-side space.
- **root_cause**: Finite card groups used CSS `auto-fill`, which preserves empty tracks and creates visible blank space when there are fewer cards than possible columns. Previous declutter work wrapped secondary explanations in collapsed `<details>` instead of removing them from the default path. Sentiment mixed primary market psychology and crypto/diagnostic subcomponents inside a narrow 300px rail, creating a tall left column and unbalanced page rhythm.
- **fix**: Changed finite HOME/SIGNAL card grids to `auto-fit`; removed visible HOME score-flow/GxL, SIGNAL advanced lockout/flow, BREADTH flow/Minervini framework, and SENTIMENT duplicate gauge/flow/F&G subcomponent/crypto widgets from the default path. Extended the same pattern cleanup to technical/macro/fxbond/fundamental/screener/kr-home/kr-macro explanation toggles and all remaining user-facing finite `auto-fill` card grids. Preserved the important decision logic in the guide page as a compact methodology reference, so default routes are decluttered without losing core content. Signal lockout and rally-quality sinks remain hidden only to avoid breaking legacy runtime/test references. Sentiment top grid now uses `minmax(280px,360px) minmax(0,1fr)`.
- **violated_rule**: R3, R214, R228.
- **prevention**: Finite user-facing card groups must use `auto-fit` or explicit columns, and collapsed explanation-only panels must be removed from the default route unless they are directly actionable in-session. Important methodology content must be consolidated into the guide instead of deleted. `scripts/ci-ux-default-path-check.mjs` now fails CI if `auto-fill`, visible analysis-flow summaries, removed duplicate widgets, or the guide methodology reference regress.

## P528 - v51.30 - Full route UI audit found mobile width leaks in news strip and portfolio chart

- **symptom**: Full browser route audit found `page-fundamental` widening on 390px mobile because the shared page-news topic list used a long unbreakable slash-delimited string and `#fund-cards-grid` retained a too-wide two-column layout. `page-portfolio` widened because the benchmark canvas retained a large pixel width after chart rendering. `page-sentiment` leaked width from chart containers/news sentiment canvas, and `page-kr-technical` leaked from health/VKOSPI grids and canvases.
- **root_cause**: The shared page-news strip header used a single inline flex row without `min-width:0` or forced wrapping. The fundamental card grid relied on fixed/re-overridden columns instead of an intrinsic responsive track. Chart renderers can leave inline canvas/container pixel widths that survive responsive layout unless CSS explicitly constrains them, while KR technical kept inline fixed 2-column/3-column grids on mobile.
- **fix**: Page-news strip header now wraps and uses `overflow-wrap:anywhere`; the market-news button is non-shrinking. `#fund-cards-grid` now uses `auto-fit/minmax` and `min-width:0` children. Portfolio benchmark canvas, sentiment LWC/news sentiment canvases, and KR technical canvases are constrained to `max-width:100%`; KR technical inline grids collapse to one column on mobile.
- **violated_rule**: R3, R214.
- **prevention**: Full-route UI audits must include shared dynamic components, not just static page sections, and must check `page.scrollWidth > page.clientWidth` on 390px mobile.

## P527 - v51.30 - Browser UI review found placeholder note, macro overflow, and mobile summary clipping

- **symptom**: Actual browser review showed the home operator note rendering template copy, the macro page widening past the viewport on desktop, and the guide advanced summary clipping vertically on a 390px mobile viewport.
- **root_cause**: `public-data/operator-note.json` shipped with `visible:true` before real content existed. The macro economic-cycle timeline used fixed non-wrapping flex widths and the FRED grid used a fixed three-column layout. `.aio-page-advanced-toggle > summary` kept the unfold label in a float with tight default line-height, leaving long mobile titles without enough vertical room.
- **fix**: Operator note rendering now suppresses placeholder/template copy even when `visible:true`. The macro timeline wraps with flexible phase cards, the FRED grid uses responsive `auto-fit/minmax`, and advanced toggle summaries now reserve right-side space for the status label with normal wrapping and explicit line-height.
- **violated_rule**: R3, R214.
- **prevention**: UI/UX reviews must include actual browser viewport audits for desktop and mobile, with `scrollWidth/clientWidth` checks plus placeholder-content scans.

## P526 - v51.30 - Maker-Checker panel skipped broad recommendation path + R1 gate failed

- **symptom**: v51.30 claimed Maker-Checker verification and R1 sync, but `scripts/ci-version-check.mjs` failed and broad prompts such as "종목 추천해줘" did not render the Maker-Checker panel.
- **root_cause**: `chatSend` only rendered Maker-Checker when `detectedTickers.length > 0`, while broad recommendation intentionally builds `screenerResult` only when no ticker is detected. Separately, index JS cachebusters stayed at `51.16`, root `CLAUDE.md` stayed at `v51.07`, and the CI changelog regex did not strip a leading BOM.
- **fix**: Maker-Checker now derives targets from answer tickers, detected tickers, and `screenerResult.rows`; `_aioMakerCheckerVerify` computes ranks if missing. Synced cachebusters/root doc, made version CI BOM-tolerant, and hardened T858 to verify broad screener candidates.
- **violated_rule**: R1, R3, R219.
- **prevention**: Recommendation verification tests must exercise the no-ticker screener path, not only `chatSend.toString()` wiring. Version CI must run after every feature/review patch and tolerate repository BOMs.

## P525 - v51.30 - aio-chat.js chatSend 미실행 — var _SECTOR_KEYWORDS가 const와 충돌

- **symptom**: `chatSend`(line 5070)가 undefined — chat 전송 불가. line 1563 `chatAppendMsg`는 정의되나 line 1847 이후 전체 미실행.
- **root_cause**: v51.17에서 `_SECTOR_KEYWORDS` 객체를 aio-chat.js→aio-data.js로 이동 시 `var _SECTOR_KEYWORDS = window.AIO_SECTOR_KEYWORDS;` alias를 삭제하지 않음. 브라우저가 line 1847 실행 시 aio-data.js의 `const _SECTOR_KEYWORDS`와 충돌(SyntaxError) → 이후 모든 함수 미정의.
- **fix**: aio-chat.js line 1847 `var _SECTOR_KEYWORDS` 제거. `const _SECTOR_KEYWORDS`는 aio-data.js top-level에서 전역 접근 가능.
- **violated_rule**: R3 (bug postmortem required).
- **prevention**: `const`/`let` 선언 이동 시 기존 `var` alias 반드시 동시 제거. R1 동기화와 같은 체크리스트 항목으로 관리.

## P524 - v51.08 - fetchKrDynamicData undefined ??krDynamic scheduler silently no-op for entire session

- **symptom**: `REFRESH_SCHEDULE.krDynamic` ran on 30-min interval but returned null every time because `typeof fetchKrDynamicData === 'function'` was always false. KR BOK/KOSIS data was only fetched on kr-home/kr-macro page entry, never refreshed in the background.
- **root_cause**: The scheduler referenced `fetchKrDynamicData` which was never defined anywhere in the codebase. The function name was reserved but never implemented.
- **fix**: Added `fetchKrDynamicData()` function that runs `fetchAllBokData` + `fetchAllKosisData` + `fetchKrNaverQuotes` in parallel via `Promise.allSettled`.
- **violated_rule**: R3 (bug postmortem required).
- **prevention**: Scheduler `fn` assignments that reference future functions should have a TODO comment with the expected definition location.

## P523 - v51.08 - fetchAllNews overwrites news cache with empty array on CORS failure

- **symptom**: When all 84 RSS feeds fail (CORS blocked environment), `fetchAllNews` ran to completion with `filteredItems = []`, then set `newsCache = []` and called `renderFeed([])`, wiping out the server backstop that had been loaded at startup.
- **root_cause**: The backstop-application logic checked `clientEmpty` to avoid overwriting live RSS data, but `fetchAllNews` final assignment ran unconditionally, overwriting the backstop with the empty result.
- **fix**: Added guard before `newsCache = filteredItems`: if `filteredItems.length === 0` and backstop is available, call `_aioApplyNewsBackstop(true)` and return early.
- **violated_rule**: R3 (bug postmortem required).
- **prevention**: Any code path that writes `newsCache = []` must check backstop availability first.

## P522 - v51.08 - screener page renders empty table on first navigation

- **symptom**: First navigation to the screener page showed an empty table. Refreshing the page or triggering a quote update fixed it, but the cold-load user saw no data.
- **root_cause**: `_aioApplyServerScreener` called `renderScreenerResults()` at load time before the `screener` page was active. The `showPage` wrapper had no handler for `pageId==='screener'`, so navigating to it never triggered a re-render.
- **fix**: Added `screener` block to `showPage` wrapper: calls `_aioComputeFactorRanks()` then `renderScreenerResults()` with 200ms delay on first navigation.
- **violated_rule**: R3 (bug postmortem required).
- **prevention**: All 22 pages must be in both `AIO_PAGE_REFRESH_MAP` and `showPage` wrapper if they display dynamic data.

## P521 - v50.98 - server news backstop selected latest headlines before market-impact scoring

- **symptom**: GitHub Actions public-data news was operational, but the server backstop used only two Google News queries, deduped by title, sorted by latest timestamp, and capped at 25. LLM market analysis therefore received recent headlines rather than the most market-relevant headlines.
- **root_cause**: Client-side `scoreItem()` had mature source/tier/freshness/topic filtering, but `scripts/fetch-data.mjs` did not mirror those selection criteria for server-generated `data.json.news`.
- **fix**: Expanded server news feeds to six market axes, added `scoreServerNewsItem()` with source tier, recency, macro/rates, geopolitics/energy, AI/semis, earnings/analyst, FX/bonds/commodities, mega-cap, unverified, and promo/clickbait handling. Added `selectionReason`, `serverNewsScored`, score range metadata, unverified score penalty in client `scoreItem()`, and `AIO.getNewsSelectionAudit()`.
- **violated_rule**: NEW -> R226. Server news backstop must rank by market impact, not arrival order.
- **prevention**: Data-pipeline contract now asserts server scoring, selection reasons, scoring metadata, and runtime selection audit.

## P520 - v50.97 - news Korean layer existed but did not provide a market-summary rewrite surface

- **symptom**: The news pipeline had Korean titles, summaries, explanations, and actions, but the market-news page still presented item cards rather than a grouped Korean market brief. This did not match the desired Telegram-style investor digest and could feel like translated foreign headlines instead of Korean market commentary.
- **root_cause**: v50.95 fixed per-item Korean fallback fields but did not add a sectioned rewrite model or UI surface. The Anthropic prompt also did not require `section`, `rewrite`, or `market` fields, so high-quality semantic rewriting was not contractually preserved.
- **fix**: Added `_aioBuildNewsKoreanRewriteBrief()` and `_aioRenderNewsKoreanRewriteBrief()`, a `#news-korean-rewrite-brief` surface, section normalization, `ko_rewrite`/`ko_section`/`ko_market` cache fields, Claude prompt schema expansion, and CI contract checks.
- **violated_rule**: NEW -> R225. Translation-only or card-only news is insufficient for the Korean market summary surface.
- **prevention**: Future news pipeline edits must preserve the grouped rewrite brief and data-pipeline contract checks for `ko_rewrite`, `ko_section`, `ko_market`, and the visible brief container.

## P519 - v50.96 - currentness/fallback fixes were partially versioned and could be hidden by stale cachebusters

- **symptom**: Multi-agent QA work added ticker direct entry and several currentness/fallback warnings, but the interrupted session left R1 version surfaces split: `APP_VERSION`/`SW_VERSION` were already v50.96 while badge, JS cachebusters, `version.json`, and docs still showed v50.95.
- **root_cause**: The final version-up step was interrupted after only part of the seven version surfaces changed. This can make browser caches serve old JS/CSS and make users miss newly added stale/fallback warnings.
- **fix**: Completed v50.96 R1 sync across index title/badge/cachebusters, `APP_VERSION`, `SW_VERSION`, `version.json`, root/context docs, CHANGELOG, QA, and rules. Added R224 to require visible currentness/fallback state at consumer surfaces.
- **violated_rule**: R1/R223 pattern. User-facing currentness fixes must not be hidden by stale cachebusters or only documented in audits.
- **prevention**: Run `scripts/ci-version-check.mjs` and runtime/data-pipeline contract gates after any QA/currentness UI edit before ending the session.

## P518 - v50.95 - news was fetched but Korean translation/summary/explanation could degrade to raw headline context

- **symptom**: News/Telegram/public-data ingestion was running, but when `ANTHROPIC_API_KEY` was absent or browser Claude translation was unavailable, visible news and chat context could fall back to English titles or thin title-only Google Translate output. Summaries, explanation, impact, and user-facing interpretation were weak.
- **root_cause**: The news pipeline treated translation as an optional post-processing layer. `freeTranslateNews()` translated titles only, `localEnrichSingle()` stored empty `ko_summary`, and `_buildNewsContext()` injected raw `title/desc` instead of normalized Korean insight fields.
- **fix**: Added `_aioBuildNewsLocalKoreanInsight()` and `_aioGetNewsTranslation()` to synthesize conservative Korean summary/explanation/impact/action from topic, sentiment, impact vector, and ticker extraction. Wired market-news/home/chat consumers to use the normalized fields and added `AIO.getNewsTranslationQualityAudit()` plus CI contract checks.
- **violated_rule**: NEW -> R223. News ingestion must degrade to Korean insight, not raw English-only context.
- **prevention**: Future news/API pipeline edits must preserve Korean insight fields across UI and chat consumers, and `ci-data-pipeline-contract-check.mjs` must assert the fallback and consumer wiring.

## P517 - v50.94 - public-data freshness existed without a full source-to-consumer CI contract

- **symptom**: GitHub Actions could be green while important market-current layers were only partially represented: data freshness was checked, but CI did not prove that refresh workflow, watchdog quality floors, fetch scripts, runtime public-data meta, Telegram memo sink, screener enrichment, and chat/news consumers stayed wired together.
- **root_cause**: The project had many runtime audits and the data watchdog checked age, but no single static contract tied Actions -> artifacts -> runtime loader -> audit -> chat/memo consumers. Optional services such as FRED and LLM market analysis were warned in logs but not surfaced in `getDataPipelineAudit()`.
- **fix**: Added `scripts/ci-data-pipeline-contract-check.mjs`, wired it into CI, hardened `data-watchdog.yml` with symbols/news/Telegram minimum floors, and exposed public-data/FRED/LLM/Telegram/screener status through `_serverDataMeta` and `AIO.getDataPipelineAudit().layers.sources.publicData`.
- **violated_rule**: R219/R221 pattern. Audit/freshness checks existed, but the complete operating path was not contract-tested.
- **prevention**: Any future data/API/news pipeline change must update the data-pipeline contract gate and preserve Actions -> public-data -> runtime audit -> visible/chat/memo consumer wiring.

## P516 - v50.93 - Telegram digest auto-refresh did not update SCREENER_DB memo

- **symptom**: GitHub Actions successfully generated `public-data/telegram-digest.json` and the app loaded it into `AIO_TELEGRAM_WEEKLY_DIGEST`, freshness fields, page maps, and chat digest context, but `SCREENER_DB.memo` still only had the older static `[TG 06/16]` overlay. Chat/ticker flows that read `_aioGetMemoForTicker()` therefore did not receive the latest Telegram/news items through the DB memo path.
- **root_cause**: The v50.63 auto-refresh loop stopped at digest registry/freshness/audit updates. It did not include a ticker-level sink that mapped digest `topItems/items[].tickers` back into `SCREENER_DB` rows, and T831 only checked digest/audit layers.
- **fix**: Added `_aioApplyTelegramDigestToScreenerDb(raw, merged)` so dynamic Telegram digest items prepend `[TG YYYY-MM-DD 쨌 auto]` memo overlays per ticker. `getTelegramPipelineAudit()` now exposes `memoOverlay`, T831 checks NVDA memo mutation, and `ci-runtime-contract-check.mjs` enforces the digest-to-memo contract.
- **violated_rule**: R217/R219. A pipeline audit existed, but the downstream consumer path to DB memo/chat memo was not semantically closed.
- **prevention**: Telegram/news auto-refresh changes must verify source artifact -> normalized digest -> ticker memo overlay -> chat/ticker consumer -> audit/test/CI gate in one path.

## P515 - v50.90 - aio-tests.js T踰덊샇 以묐났 + dead ?⑥닔 + ??대㉧ ?뺣━ ?꾨씫

- **symptom**: (1) T551~T558怨?T561~T565媛 ??媛쒖쓽 ?쒕줈 ?ㅻⅨ ?뚯뒪???⑥닔?먯꽌 媛곴컖 ?뺤쓽?섏뼱 runTests() ?ㅽ뻾 ???숈씪 T踰덊샇媛 2~3??以묐났 ?ㅽ뻾 ??_testResults ?ㅼ뿼. (2) T760??`_snapshotDate === '2026-06-11'` ?섎뱶肄붾뵫?쇰줈 ?곗씠???먮룞 媛깆떊 ????긽 FAIL. (3) `fetchWithProxy`/`fetchOHLCVBundleWithFallback` dead ?⑥닔媛 ~19以??붿〈. (4) setInterval 2媛쒓? _aioTimerRegistry ?놁씠 raw ?몄텧?섏뼱 beforeunload ?뺣━ 遺덇?. (5) options ?섏씠吏媛 _aiCtxMap???꾨씫?섏뼱 CHAT_CONTEXTS['options']媛 dead.
- **root_cause**: append-only ?⑦꽩?쇰줈 ???뚯뒪??異붽? ??湲곗〈 T踰덊샇 ?ъ슜 ?щ? ?뺤씤 ?놁씠 ?ъ궗?? T760? ?뱀젙 ?ㅻ깄???좎쭨瑜??⑥뼵?쇰줈 諛뺤븘 ?ｌ뿀?쇰굹 ?곗씠???뚯씠?꾨씪??媛깆떊 ???먮룞 stale?? dead ?⑥닔??由ы뙥?좊쭅 以??몄텧遺 ?쒓굅 ???뺤쓽留??붿〈.
- **fix**: T551~558?뭈845~852, T561~565?뭈853~857 ?щ쾲?? T760/T761 援ъ“??泥댄겕濡??꾪솚. dead ?⑥닔 ?쒓굅. _aioRegisterTimer('autoBackup'/'auditWidget',...) ?깅줉 + beforeunload _aioClearAllTimers() 異붽?. _aiCtxMap??'options':'options' 異붽?.
- **violated_rule**: R3 (踰꾧렇 ?섏젙 ??postmortem 湲곕줉). 異붽? 愿?? aio-tests.js T踰덊샇 ?⑥“ 利앷? 誘몄???
- **prevention**: ???뚯뒪??異붽? ??理쒓퀬 T踰덊샇 grep ?뺤씤. ?ㅻ깄???좎쭨 ??媛깆떊 媛?ν븳 媛믪? 踰붿쐞/?뺤떇 泥댄겕濡??묒꽦. dead ?⑥닔???몄텧 grep ??利됱떆 ?쒓굅.

## P514 - v50.89 - workflow helpers and skills were becoming append-only memory

- **symptom**: The codebase was not the only append-only surface. `_context/BUG-POSTMORTEM.md` exceeded 500KB, `RULES.md` and `QA-CHECKLIST.md` exceeded 100KB, and several root `.agents/skills/*/SKILL.md` files were large enough to load history, examples, and operational notes directly into context. This made agents read too much, miss the actual request, and repeatedly add new audits instead of removing, merging, or compacting stale guidance.
- **root_cause**: The workflow rewarded recording lessons but did not require retiring superseded guidance or splitting large skills into progressive-disclosure references. Skills became mini-archives instead of concise procedural entry points. Helper files accumulated old rules and P entries without a binary compaction gate.
- **fix**: Added R220, P514-Q1..Q5, and `scripts/ci-workflow-compaction-check.mjs`. The new gate reports oversized `_context` and skill surfaces, requires compaction governance hooks, and keeps the semantic review gate paired with workflow-memory hygiene.
- **violated_rule**: NEW -> R220. Workflow memory must be compacted before it is extended.
- **prevention**: Before adding workflow docs or skill instructions, choose remove, merge, compress, split into references, or script. Only add new text after the old surface is accounted for.

## P513 - v50.89 - audit-only completion pattern hid semantic gaps

- **symptom**: Repeated user requests asked for deep page/AI/data/trading review, but several completed changes primarily added audit/readiness functions, shape assertions, coverage percentages, or sidebar rows. A fresh inventory found roughly 85 audit/readiness definitions, 225 audit/gate-like assertions, and 112 shape/coverage/DOM-style audit assertions. Those checks are useful as prevention, but they can falsely imply that user intent, domain meaning, downstream consumers, and visible output were reviewed.
- **root_cause**: The completion standard rewarded "audit exists" and "coverage is high" more than function -> consumer -> visible output verification. Skills and helper files recorded many lessons, but the workflow did not force each request to close the semantic path. That made it possible to inspect an audit helper instead of the actual trading rule, AI answer policy, source pipeline, page hierarchy, or user scenario.
- **fix**: Added R219 and P513-Q1..Q6, created `scripts/ci-semantic-review-check.mjs`, and wired `ci-runtime-contract-check.mjs` to require the semantic review contract. The new gate inventories audit-only risk, verifies governance hooks, and keeps direct high-risk semantic gates for trading score aliases, breadth fallback, ticker entry gating, and current event-risk context.
- **violated_rule**: R218 was necessary but too narrow. New R219 states that audit/gate is not semantic review.
- **prevention**: Every future page, AI, data/source, trading, technical, ticker, portfolio, or UX edit must document and test the path from user request to affected function/criteria, downstream consumer, visible output, and market/domain meaning. Audit-only checks must have a semantic companion or remain explicitly unresolved.
---

## P511 - v50.86 - market-news fold媛 textContent 留ㅼ묶?쇰줈 痍⑥빟 ?좏깮???ъ슜

- **Symptom**: `_aioFoldDensePageControls('market-news')`媛 `BornLupin|Aether Japan|Reuters|TrendForce|Platts` ?띿뒪?몃? ?ы븿?섎뒗 紐⑤뱺 div瑜??띿뒪?몄뒪罹붿쑝濡?fold ??곸쑝濡??좏깮. ?댁뒪 湲곗궗 蹂몃Ц???대떦 ?띿뒪?멸? ?ы븿?섎㈃ ?섎룄移??딆? ?뱀뀡???묓옄 ???덉뿀??
- **Root cause**: ?먮옒 肄붾뱶媛 DOM 援ъ“ 蹂寃쎌뿉 痍⑥빟???띿뒪??肄섑뀗痢?湲곕컲 ?좏깮??`textContent.includes`)瑜??ъ슜???뚯뒪 ?덈궡 div瑜?李얠쓬. ID ?놁씠 ?댁슜?쇰줈 ?먯깋?섎뒗 ?⑦꽩.
- **Fix**: market-news ?뚯뒪 ?덈궡 div??`id="news-source-guide"` 遺??index.html). `_aioFoldDensePageControls` ?좏깮?먮? `'#news-source-guide'` ID 吏곸젒 吏?뺤쑝濡?援먯껜.
- **Prevention**: DOM ?뱀뀡 fold ?源껋? 諛섎뱶??怨좎쑀 ID瑜?遺?ы빐 ?좏깮. ?띿뒪??肄섑뀗痢?湲곕컲 ?좏깮 湲덉?(R_NEW).

## P510 - v50.86 - _aioFoldDensePageControls媛 screener SVG ?ㅼ씠?닿렇???⑤꼸???묐뜕 踰꾧렇

- **Symptom**: screener ?섏씠吏 吏꾩엯 ??`_aioFoldDensePageControls('screener')`媛 `#vis-screener`(?⑺꽣 諛깊뀒?ㅽ듃 SVG 李⑦듃)? `#screener-backtest-panel`(?띿뒪??IC 濡쒓렇) 紐⑤몢瑜?`<details>` ?덉쑝濡??대룞?쒖폒 ?④?. ?섎룄: ?띿뒪??IC 濡쒓렇留??묒뼱???덉쓬.
- **Root cause**: ?좏깮??諛곗뿴??`'#vis-screener'`媛 ?ы븿?섏뼱 ?덉뿀怨? ?쎌엯 ?꾩튂 怨꾩궛 濡쒖쭅??`closest('div[style*="linear-gradient"]')`泥섎읆 ?몃씪???ㅽ??쇱뿉 ?섏〈??遺덉븞?뺥븿.
- **Fix**: ?좏깮?먯뿉??`'#vis-screener'` ?쒓굅. ?몃씪???ㅽ???湲곕컲 ancestor ?먯깋 ?쒓굅. 泥?fold ????몃뱶 諛붾줈 ?욎뿉 `<details>` ?쎌엯?섎룄濡?anchor 濡쒖쭅 媛쒖꽑.
- **Prevention**: fold ????좏깮?먮? 異붽??????대떦 ?섏씠吏??vis-* ?⑤꼸???ㅼ닔濡??ы븿?섏? ?딅룄濡?異붽? ??紐낆떆???뺤씤. R_NEW 李몄“.

## P509 - v50.63 - Telegram digest collection was not in the scheduled consumption loop

- **Symptom**: Telegram digest integration existed in static JS, but the scheduled `refresh-data.yml` job only committed `data.json`, `history.json`, and `screener.json`. The workflow also had a broken `ANTHROPIC_API_KEY` line where `run:` was appended to the env comment, risking failed scheduled refreshes.
- **Root cause**: The self-reinforcing loop stopped at "script exists / static object updated." It did not require a same-origin dynamic artifact, app boot loader, freshness metadata update, audit visibility, and regression coverage for Telegram digest consumption.
- **Fix**: Rewrote `refresh-data.yml` with valid ASCII YAML, added scheduled `fetch-telegram-digest.mjs --out public-data/telegram-digest.json`, committed the current digest artifact, added `_aioLoadServerTelegramDigest()` / `_aioApplyTelegramDigestPayload()`, updated `getTelegramPipelineAudit()`, and added T831.
- **Prevention**: Any new automated data source must satisfy collect -> public-data artifact -> boot/load consumption -> freshness metadata -> audit -> regression test. R217.

## P508 - v50.62 - Data/news refresh was collected but not structurally broad enough

- **Symptom**: Telegram 7d digest and public-data refresh existed, but analysis-page news contracts still favored narrow macro/geo/semi filters. The home stale warning also used one timestamp for both price snapshots and news/theme digest freshness, making a refreshed digest look like old market data.
- **Root cause**: The collection layer and consumption layer were not bound as one contract. New topics such as optical, power, memory, materials, ai-policy, space, crypto, and Korea supply-chain were present in data but not fully mapped into page strips, chat page context, and freshness metadata.
- **Fix**: Re-ran fetch-data, refreshed public-data, updated DATA_SNAPSHOT static fallback to 2026-06-16, split _marketDataUpdated from _telegramDigestUpdated, added Telegram category registry/page map, widened AIO_NEWS_SURFACE_CONTRACTS, injected category/page map into chat, and added T830.
- **Prevention**: A news/theme refresh is complete only when digest, category registry, page map, page contracts, chat context, freshness metadata, and regression tests are all connected. R216.

## P507 - v50.61 - Telegram ?섏쭛 ?곗씠?곌? 二쇨컙 ?뚯뒪/梨꾪똿/?ㅽ겕由щ꼫 ?덉씠?대줈 ?먮룞 ?섎쪟?섏? ?딆쓬

- **Symptom**: ?ъ슜?먭? 吏?뺥븳 Telegram 3梨꾨꼸 1二쇱씪移??댁뒪/?뚯떇/?뺣낫瑜??섏쭛?대룄, 湲곗〈 援ъ“??媛쒕퀎 RSS/?대씪?댁뼵???댁뒪 遺꾨쪟? ?섎룞 HOME_WEEKLY_NEWS 媛깆떊???섏〈?덈떎. 怨좉굅?섎웾 梨꾨꼸? 釉뚮씪?곗? 吏곸젒 ?묎렐/濡쒓렇??CORS ?쒖빟 ?뚮Ц???꾨씫?섍린 ?쎄퀬, AI 梨꾪똿? 理쒖떊 ?뺤꽦 ?뚮쭏瑜?醫낅ぉ 異붿쿇쨌?쒖옣 留λ씫???쇨??섍쾶 ?곌껐?섏? 紐삵븷 ???덉뿀??
- **Root cause**: Telegram 怨듦컻 誘몃윭瑜?二쇨컙 digest濡??뺢퇋?뷀븯???쒕쾭/?ㅽ겕由쏀듃 ?덉씠?닿? ?놁뿀怨? ?섏쭛 寃곌낵媛 HOME_WEEKLY_NEWS, SCREENER_DB, MACRO_KW/TECH_KW, 梨꾪똿 system prompt源뚯? ?댁뼱吏???⑥씪 ?섎쪟 寃쎈줈媛 ?놁뿀??
- **Fix**: `scripts/fetch-telegram-digest.mjs` 異붽?. 3梨꾨꼸 怨듦컻 誘몃윭 796嫄댁쓣 ?섏쭛???좏뵿/?곗빱/?ㅼ퐫?대? 異붿텧?섍퀬, `AIO_TELEGRAM_WEEKLY_DIGEST` + HOME_WEEKLY_NEWS + SCREENER_DB 硫붾え ?ㅻ쾭?덉씠 + MACRO/TECH ?ㅼ썙??+ AI 梨꾪똿 而⑦뀓?ㅽ듃濡??곌껐. T829 異붽?.
- **Prevention**: ???몃? ?뺤꽦 ?뚯뒪??"?섏쭛 ?뚯씪"?먯꽌 ?앸궡吏 留먭퀬 digest 媛앹껜, ?붾㈃ ?먮젅?댁뀡, ?ㅽ겕由щ꼫 硫붾え, ?ㅼ썙??遺꾨쪟, 梨꾪똿 ?듬? 怨꾩빟, ?뚯뒪?멸퉴吏 ?곌껐?댁빞 ?쒕떎. 怨좉굅?섎웾 梨꾨꼸? safety cap/resumable paging/backfill ?쒓퀎瑜?臾몄꽌?뷀븳?? R215.

## P506 - v50.60 - AI 梨꾪똿??AIO ?섏씠吏/?곗씠??媛뺤젏???섎굹???듬? 怨꾩빟?쇰줈 ?듯빀?섏? 紐삵븿

- **Problem**: ?ㅽ겕由щ꼫 AI 梨꾪똿? ?쒖꽭, 李⑦듃, ????ㅽ겕由щ꼫, ?댁뒪, 留ㅽ겕濡? ?ы듃?대━?????щ윭 ?대? ?곗씠???덉씠?대? 媛뽮퀬 ?덉뿀吏留? ?듬? ?앹꽦 ?④퀎?먯꽌 "?쇰컲 LLM怨??ㅻⅨ AIO ?꾩슜 媛뺤젏"????긽 紐낆떆?섎뒗 ?곸쐞 怨꾩빟???놁뿀?? 洹?寃곌낵 ?ъ슜?먭? ?볦? 異붿쿇쨌?쒖옣 ?곹솴 諛섏쁺쨌?뺤꽦/?뺣웾 ?듯빀 ?듬???湲곕??????쇰? ?곗씠??釉붾줉? 二쇱엯?섏뼱???듬? 援ъ“媛 ?섏씠吏 媛??곌껐, ?꾩옱 ?쒖옣 留λ씫, ?뺣웾/?뺤꽦 洹좏삎?쇰줈 ?덉젙?곸쑝濡??섎졃?섏? 紐삵븷 ???덉뿀??
- **Root cause**: `AIO_CHAT_SOURCE_REGISTRY`??媛쒕퀎 ?뚯뒪 異쒖쿂 媛먯궗?먮뒗 ?④낵?곸씠吏留? ?ъ슜?먭? 泥닿컧?섎뒗 ?듬? ?덉씠???꾩옱 ?쒖옣 ???뺣웾 吏?????뺤꽦 ?댁뒪/怨듭떆 ??醫낇빀 ?먮떒 ??愿???섏씠吏/?꾧뎄 ?곌껐)瑜??좎뼵?섏? ?딆븯?? `chatSend()`??intent/coverage/memory/data blocks瑜?遺숈?吏留?AIO ?꾩껜 ?쒖뒪?쒖쓣 愿?듯븯???듯빀 ?듬? 怨꾩빟? 蹂꾨룄濡?二쇱엯?섏? ?딆븯??
- **Fix**: `AIO_CHAT_PIPELINE_REGISTRY`瑜?異붽???marketState, quotes, technicalOHLCV, screener, breadthSentiment, macroRatesFx, companyFundamentals, newsFilings, themes, portfolio ?덉씠?대? ?좎뼵. `_buildAioIntegratedAnswerContext()`瑜?異붽???"not a generic LLM" ?먯튃, ?꾩옱 ?쒖옣 ?곌껐, ?뺣웾/?뺤꽦 ?듬?, 醫낇빀 ?먮떒, ?섏씠吏 ?곌껐, 異붿쿇 ?ㅼ뼇??洹쒖튃???쒖뒪???꾨＼?꾪듃??二쇱엯. `chatSend()`??`integratedContextStr`瑜??앹꽦??coverage ?ㅼ뿉 遺숈씠怨? coverage flags??technical/screener/domain ?곗씠?곕? ?몄떇?섎룄濡??뺤옣. T828 異붽?.
- **violated_rule:** R15, R211, R212, R213
- **Prevention**: ??梨꾪똿 ?곗씠???섏씠吏 湲곕뒫? ?뚯뒪 ?덉??ㅽ듃由щ퓧 ?꾨땲???ъ슜???듬? 怨꾩빟源뚯? ?곌껐?댁빞 ?쒕떎. 媛쒕퀎 ?곗씠??釉붾줉??二쇱엯?섏뼱?? ?꾩옱 ?쒖옣쨌?뺣웾쨌?뺤꽦쨌?섏씠吏 ?곌껐쨌異붿쿇 ?ㅼ뼇??以??대뒓 異뺤쑝濡??곗씪吏 紐낆떆?섏? ?딆쑝硫??꾨즺濡?蹂댁? ?딅뒗?? R214.

## P505 - v50.59 - AI 梨꾪똿??湲곗〈 OHLCV 李⑦듃 遺꾩꽍 ?붿쭊??臾댄떚而??쒖옣 吏덈Ц???쒖슜?섏? 紐삵븿

- **Problem**: 李⑦듃??遺꾩꽍 湲곕뒫 ?먯껜??`fetchOHLCVWithFallback` + `calcTechnicalSnapshot` + `calcExtensionHeat`濡?議댁옱?덇퀬, 醫낅ぉ ?곗빱媛 ?덈뒗 吏덈Ц?먮뒗 `_fetchTechnicalDataForChat()`媛 RSI/MACD/MA/ATR/Stage/?뺤옣?꾨? 二쇱엯?덈떎. ?섏?留??ъ슜?먭? "吏湲??쒖옣 李⑦듃?곸쑝濡??대븣?"泥섎읆 ?곗빱 ?놁씠 湲곗닠/李⑦듃 遺꾩꽍??臾쇱쑝硫????붿쭊???먮룞 諛쒕룞?섏? ?딆븘, 湲곗〈 ?쒖옣 ???李⑦듃 湲곕뒫??梨꾪똿??異⑸텇???곗? 紐삵뻽?? ?먰븳 OHLCV 湲곗닠吏???뚯뒪媛 `AIO_CHAT_SOURCE_REGISTRY`???놁뼱??異쒖쿂/?뺤옣??媛먯궗?먯꽌 蹂댁씠吏 ?딆븯??
- **Root cause**: v50.38?먯꽌 湲곗닠 ?곗씠??二쇱엯 踰붿쐞瑜?"?곗빱 媛먯? ????而⑦뀓?ㅽ듃"濡??뺤옣?덉?留? 臾댄떚而?湲곗닠 吏덈Ц??SPY/QQQ/SMH 媛숈? ????꾨줉?쒕줈 蹂?섑븯???쇱슦?곌? ?놁뿀?? ?뚯뒪 ?덉??ㅽ듃由?媛먯궗??`_fetchTickerDataForChat()` ?대?留??ㅼ틪?? `chatSend()`?먯꽌 蹂꾨룄濡?二쇱엯?섎뒗 湲곗닠/?꾨찓???곗씠???뚯뒪瑜??쒗쁽?섍린 ?대젮?좊떎.
- **Fix**: `_aioTechnicalSymbolsForChat()`瑜?異붽???臾댄떚而?湲곗닠/李⑦듃 吏덈Ц?먮뒗 湲곕낯?곸쑝濡?SPY쨌QQQ쨌SMH, 諛섎룄泥?吏덈Ц?먮뒗 SMH쨌SOXX쨌QQQ, ???뚰삎二?吏덈Ц?먮뒗 IWM쨌RSP쨌SPY, ?쒓뎅 湲곗닠 吏덈Ц?먮뒗 ^KS11쨌^KQ11쨌KRW=X瑜??좏깮?쒕떎. `chatSend()`???곗빱媛 ?놁뼱???대떦 ?쇱슦??寃곌낵濡?`_fetchTechnicalDataForChat(..., {autoMarket:true})`瑜??몄텧?쒕떎. `_fetchTechnicalDataForChat()`??OHLCV `dataQuality` source/rows/fetched ?쇰꺼???ы븿?쒕떎. `technicalOHLCV`瑜?`AIO_CHAT_SOURCE_REGISTRY`???깅줉?섍퀬 `getChatSourceRegistryAudit()`媛 ticker fetch + technical injector + domain injector + chatSend瑜??④퍡 ?ㅼ틪?섎룄濡??뺤옣. T827 異붽?.
- **violated_rule:** R15, R121, R212
- **Prevention**: ??梨꾪똿 ?곗씠??湲곕뒫? "議댁옱 ?щ?"肉??꾨땲???ъ슜?먯쓽 ?먯뿰??吏덈Ц?먯꽌 ?ㅼ젣 二쇱엯?섎뒗 ?쇱슦?낃퉴吏 寃利앺븳?? ?덉??ㅽ듃由?媛먯궗???⑥씪 ?ㅽ뻾 ?⑥닔留?蹂댁? 留먭퀬 紐⑤뱺 梨꾪똿 ?곗씠??二쇱엯 寃쎈줈瑜??ы븿?댁빞 ?쒕떎. R213.

## P504 - v50.58 - AI 梨꾪똿 ?좊ː??媛?쒓? ?쇰컲/?ㅽ겕由щ꼫 ?듬?源뚯? 怨쇰룄?섍쾶 ?듭젣

- **Problem**: ?ㅽ겕由щ꼫媛 AI 梨꾪똿??蹂닿컯?댁빞 ?섎뒗???쇰? 洹쒖튃? ?ㅽ엳???듬???醫곹삍?? ?쇰컲/援먯쑁 吏덈Ц, ?볦? ?ㅽ겕由щ꼫 異붿쿇, ?⑥닚 醫낅ぉ ?ъ떎 吏덈Ц?먮룄 "二쇨? 異붿씠 誘몄＜????異붿꽭 ?멸툒 湲덉?", 6?④퀎 湲곌? 由ы룷?? Bull/Base/Bear, 湲곌? ?꾨젅???몄슜 ?섎Т媛 ?꾩뿭?쇰줈 遺숈뿀?? 洹?寃곌낵 ?ъ슜?먮뒗 吏곴??곸씤 ?듬? ???怨쇰룄???쒗븳쨌?뺤떇쨌誘몄닔吏?寃쎄퀬瑜?諛쏄린 ?ъ썱??
- **Root cause**: ?섍컖 諛⑹? 洹쒖튃???ъ슜???섎룄蹂꾨줈 遺꾨━?섏? ?딄퀬 `chatSend()` 留먮???怨듯넻 `_dataVerify`? `_fetchTickerDataForChat()` 醫낅ぉ ?곗씠??釉붾줉???쇨큵 二쇱엯?먮떎. ?ㅽ겕由щ꼫 ?꾨낫援곗? 3M쨌RSI쨌?????겕?쇰뒗 ?먯껜 洹쇨굅瑜??쒓났?섎뒗?곕룄 媛쒕퀎 ?곗빱??`[二쇨? 異붿씠]` 遺?ъ? 媛숈? 湲곗??쇰줈 ?됯??먮떎.
- **Fix**: `_aioChatAnswerPolicy()`瑜?異붽????쇰컲/援먯쑁, ?ㅽ겕由щ꼫 ?꾨낫, ?⑥닚 醫낅ぉ ?ъ떎, 留ㅻℓ ?먮떒??遺꾨━. 留ㅻℓ ?먮떒/?꾨쭩 吏덈Ц?먮쭔 媛뺥븳 異붿꽭쨌?쒕굹由ъ삤쨌湲곌? 硫붾え 洹쒖튃???곸슜?섍퀬, ?⑥닚 吏덈Ц? 諛붾줈 ?듯븯?꾨줉 蹂寃? ?ㅽ겕由щ꼫 ?꾨낫援곗? 3M쨌RSI쨌?????겕쨌?뱁꽣/?쒖옣 遺꾩궛??洹쇨굅濡??ㅻ챸 媛?ν븯?ㅺ퀬 紐낆떆. `_fetchTickerDataForChat()`??query/ctxId瑜?諛쏆븘 Bull/Base/Bear 媛뺤젣瑜??섎룄蹂꾨줈 ?꾪솕. T826 異붽?.
- **violated_rule:** R15, R140, R211
- **Prevention**: ?뺥솗??媛?쒕뒗 ?듬???李⑤떒?섎뒗 ?μ튂媛 ?꾨땲???듬? 踰붿쐞瑜??쇰꺼留곹븯???μ튂?? ??梨꾪똿 洹쒖튃? 諛섎뱶???곸슜 ????쇰컲/?ㅽ겕由щ꼫/?⑥닚 醫낅ぉ/留ㅻℓ ?먮떒)??紐낆떆?섍퀬, ?ㅽ겕由щ꼫媛 ?쒓났??援ъ“??洹쇨굅瑜?媛쒕퀎 ?곗빱 ?곗씠??誘몄닔吏묒쑝濡?臾댄슚?뷀븯吏 ?딅뒗?? R212.

## P503 - v50.57 - AI 梨꾪똿???볦? 醫낅ぉ 異붿쿇???뱀젙 ?뚮쭏濡?怨쇱닔??

- **Problem**: ?ъ슜?먭? "醫낅ぉ 異붿쿇?댁쨾"泥섎읆 ?볦? 吏덈Ц???섎㈃ AI 梨꾪똿??CEG, ?꾨젰 ?뱁꽣, AVGO/釉뚮줈?쒖뺨, AI ?명봽??媛숈? ?뱀젙 ?쒖옣/湲곗뾽?쇰줈 諛섎났 ?섎졃?덈떎. ?ㅼ젣 LLM泥섎읆 ?볦? ?꾨낫援곗쓣 癒쇱? ?쇱튇 ???ъ슜???쒖빟??留욎떠 醫곹엳???숈옉??遺議깊뻽??
- **Root cause**: `_aioRunScreenerQuery()`媛 紐낆떆 議곌굔(?뱁꽣쨌RSI쨌?쒖킑쨌????????놁쑝硫?null??諛섑솚?? ?볦? 異붿쿇 吏덈Ц?먮뒗 ?꾨낫 由ъ뒪?멸? 二쇱엯?섏? ?딆븯?? 洹??곹깭?먯꽌 `CHAT_CONTEXTS`??怨좎젙 由ъ꽌移?臾몃떒怨?怨쇨굅 ???硫붾え媛 ?꾨＼?꾪듃??媛뺥븳 ?듭빱媛 ?섏뼱 ?뱀젙 ?뚮쭏媛 怨쇰??쒖쭛?먮떎. 理쒓렐 ?듬??먯꽌 諛섎났???곗빱瑜?媛먯젏?섍굅???뱁꽣쨌?쒖옣쨌?쒖킑 遺꾩궛??媛뺤젣?섎뒗 援ъ“???놁뿀??
- **Fix**: `_aioIsBroadRecommendationQuery()`, `_aioBuildDiversifiedRecommendationRows()`, `_aioExtractRecentRecommendationTickers()`瑜?異붽?. ?볦? 異붿쿇 吏덈Ц? SCREENER_DB瑜??뱁꽣쨌?쒖옣쨌?쒖킑蹂꾨줈 遺꾩궛 ?섑뵆留곹븯怨?理쒓렐 ???諛섎났 ?곗빱瑜?媛먯젏??`diversified-recommendation` 紐⑤뱶濡?泥섎━?쒕떎. `_formatScreenerResultPrompt()`??"洹좏삎 異붿쿇 ?꾨낫" 釉붾줉怨?媛숈? ?뱁꽣 理쒕? 2媛? 3~5媛?理쒖쥌 ?좏깮, ?쒖쇅/蹂대쪟 ?댁쑀, ?泥??꾨낫 ?ㅻ챸??媛뺤젣?쒕떎. `chatSend()`??理쒓렐 ????곗빱瑜??섍린怨?異붿쿇 ?ㅼ뼇?굿룸컲蹂??명뼢 諛⑹? 洹쒖튃??system prompt??異붽??쒕떎. T825 異붽?.
- **violated_rule:** R15, R135
- **Prevention**: ?볦? 異붿쿇 吏덈Ц? 怨좎젙 ?대윭?곕툕蹂대떎 援ъ“?붾맂 ?꾨낫援곗쓣 癒쇱? 二쇱엯?쒕떎. 異붿쿇 ?꾨낫??理쒖냼 ?뱁꽣쨌?쒖옣쨌?쒖킑 遺꾩궛 異뺤쓣 媛뽮퀬, 理쒓렐 ??붿뿉??諛섎났??醫낅ぉ? 媛먯젏?쒕떎. ?뱀젙 ?뱁꽣/?뚮쭏 吏덈Ц? 湲곗〈 ?꾪꽣瑜??좎??섎릺, 議곌굔 ?녿뒗 異붿쿇? 洹좏삎 ?꾨낫 紐⑤뱶濡??뚭? ?뚯뒪?명븳?? R211.

## P502 - v50.56 - ?뺤쟻 媛먯궗 ?듦낵 ???고???scope쨌蹂듯빀 sink쨌利앷굅 寃뚯씠???ㅽ뙋???붿〈

- **Problem**: KST formatter媛 ??踰덉㎏ `DOMContentLoaded` listener ?대????좎뼵??泥?踰덉㎏ listener? quota ?⑥닔?먯꽌 `ReferenceError`媛 諛쒖깮?덈떎. KR ???뚮쭏??蹂듯빀 移대뱶 ?꾩껜媛 `data-live-price` sink?ъ꽌 媛먯궗湲곌? 醫낅ぉ肄붾뱶쨌?대쫫쨌鍮꾩쨷源뚯? 媛寃⑹쑝濡??쎌뿀怨? ?쒓뎅 二쇱떇? 誘멸뎅 二쇱떇 ?곹븳 10,000??怨듭쑀???뺤긽 ?먰솕 媛寃⑹쓣 李⑤떒?덈떎. 李멸퀬 ?꾩슜 誘몄닔吏?quote???섏궗寃곗젙 媛믨낵 ?숈씪?섍쾶 諛고룷 李⑤떒?먯쑝硫? ?띿뒪??媛먯궗??`S&P500`, `MA(5/20/60)`, `1/3/6M`, `9/11 醫낅ぉ`??媛쒕컻 ?쒖떇쨌怨쇨굅 ?좎쭨濡??ㅼ씤?덈떎. ?댁뒪 84媛??쒖감 ?섏쭛? ?뺤긽 吏꾪뻾 以묒뿉???ㅻ옒 ?쒖닔吏?以묅앹쑝濡쒕쭔 蹂댁뿬 ?곴뎄 濡쒕뵫泥섎읆 蹂댁???
- **Root cause**: 釉뚮씪?곗? ?ㅽ뻾 ?쒖꽌 寃利??놁씠 ?⑥닔 議댁옱留?寃?ы뻽怨? ?곗씠??sink???뚯쑀沅뚯쓣 媛??몃뱶媛 ?꾨땶 蹂듯빀 而⑦뀒?대꼫??遺?ы뻽?? ?먯궛蹂?媛寃??⑥쐞, `decision`/`reference-only`, ?좎쭨/鍮꾩쑉/釉뚮옖???좏겙??媛먯궗 洹쒖튃?먯꽌 援щ텇?섏? ?딆븯?? ?κ린 鍮꾨룞湲??묒뾽???꾧꼍 loading怨?諛깃렇?쇱슫??吏꾪뻾 ?곹깭媛 遺꾨━?섏? ?딆븯??
- **Fix**: KST helper瑜?紐⑤뱢 ?꾩뿭?쇰줈 ?대룞. KR 移대뱶? ?숈쟻 ?뚮쭏 pill? `data-live-symbol` ?뚯쑀 而⑦뀒?대꼫? 媛寃??깅씫 child sink濡?遺꾨━?섍퀬 `.KS/.KQ` ?먰솕 sanity range瑜?異붽?. 李멸퀬 ?꾩슜 truth-block? warn?쇰줈 媛뺣벑?섎릺 decision sink??怨꾩냽 李⑤떒. ?띿뒪???좎쭨 ?먯젙??KST 寃쎄낵?셋룸Ц留?湲곕컲?쇰줈 蹂寃쏀븯怨??⑥뼱 寃쎄퀎瑜??곸슜. 12珥??댄썑 ?댁뒪 吏꾪뻾 臾멸뎄瑜?諛깃렇?쇱슫??媛깆떊?쇰줈 ?꾪솚. 怨듭떇 ?쇱젙?먮뒗 evidence metadata瑜?遺李? T824? CI 援ъ“ 寃?щ? 異붽?.
- **violated_rule:** R15, R195, R204, R208
- **Prevention**: 怨듭쑀 helper??紐⑤뱺 listener/caller蹂대떎 ?욎꽑 module scope???붾떎. 蹂듯빀 UI??live ?띿꽦? ?ㅼ젣 媛?child?먮쭔 ?붾떎. 利앷굅 寃뚯씠?몃뒗 ?ъ슜 紐⑹쟻怨??먯궛 ?⑥쐞瑜??④퍡 ?됯??섍퀬, ?띿뒪???좎쭨 媛먯궗??寃쎄낵?셋룸Ц留μ쓣 ?ъ슜?쒕떎. 釉뚮씪?곗? fresh context?먯꽌 22?섏씠吏瑜??ㅼ젣 吏꾩엯????gate瑜??ъ떎?됲븳?? R210.

## P501 - v50.56 - 怨꾩빟쨌?쒓컙?쨌?쒓뎅 吏??移대뱶媛 ?쒕줈 ?ㅻⅨ 吏꾩떎 ?먯쿇???ъ슜

- **Problem**: ?ㅽ겕由щ꼫 異붽? ???섏씠吏 怨꾩빟 媛먯궗??22媛쒕? 湲곕??덉?留?諛고룷 寃뚯씠?몃뒗 `routePageCount !== 21`???좎????뺤긽 ?곹깭?먯꽌????긽 李⑤떒?먮떎. ???좎쭨??KST濡?9?쒓컙 ?대룞??`Date`??濡쒖뺄 `getDay()`瑜??곸슜??2026-06-15 ?붿슂?쇱쓣 ?붿슂?쇰줈 ?쒖떆?덈떎. ?쒓뎅 吏??移대뱶???쇱씠釉??꾩옱媛쨌?깅씫瑜좊쭔 媛깆떊?섍퀬 ?꾩씪醫낃????뺤쟻 ?ㅻ깄?룹쓣 ?④꼈?쇰ŉ `kosdaq-prev`??snapshot map?먯꽌???꾨씫?먮떎.
- **Root cause**: ?숈씪 媛쒕뀗??湲곕? ?섏씠吏 ?? ?좎쭨/?붿씪, 媛寃??깅씫/?꾩씪醫낃?媛 媛곴컖 ?ㅻⅨ ?곸닔쨌?쒓컙? API쨌DOM writer?먯꽌 愿由щ릱?? 湲곗〈 T743? 諛섑솚 shape留?寃?ы빐 寃뚯씠???먯껜??遺덈??앹쓣 寃利앺븯吏 ?딆븯??
- **Fix**: 諛고룷 寃뚯씠?멸? `expectedRoutePageCount`? ?ㅼ젣 ?섎? 鍮꾧탳?섎룄濡?蹂寃? `AIO.getKstDateParts()`濡??좎쭨쨌?붿씪쨌?쇱씪 荑쇳꽣瑜?`Asia/Seoul` 湲곗? ?⑥씪 怨꾩궛. KR 移대뱶???꾩씪醫낃?/蹂??sink瑜?異붽??섍퀬 `applyLiveQuotes()`? `initKoreaHome()`媛 ?숈씪 quote??previous close瑜??ъ슜?섎룄濡?蹂寃? `kosdaq-prev` snapshot map 蹂듦뎄. T743 媛뺥솕, T823 諛?CI 援ъ“ ?뚭? 寃??異붽?. 濡쒖뺄 ?쒕쾭 ?ㅽ뻾湲곕? foreground쨌?덈? Python 寃쎈줈濡?怨좎젙.
- **violated_rule:** R1, R15, R195
- **Prevention**: 湲곕? 媛쒖닔??怨꾩빟 媛앹껜?먯꽌留??쎄퀬 蹂꾨룄 ?レ옄瑜?鍮꾧탳?섏? ?딅뒗?? ?좎쭨? ?붿씪? ?숈씪 timezone formatter 寃곌낵瑜??ъ슜?쒕떎. 媛寃?移대뱶???꾩옱媛쨌?깅씫쨌湲곗?媛???섎굹??quote payload?먯꽌 ?④퍡 媛깆떊?쒕떎. CI?먯꽌 ????遺덈??앹쓣 ?뺤쟻 寃?ы븯怨?釉뚮씪?곗? T823?쇰줈 ?뺤씤?쒕떎. R209.

## P500 - v50.55 - 媛먯궗 蹂닿퀬?쒖쓽 ?뺤쟻 異붿젙怨??고????곹깭媛 ?쇱옱???ㅼ젣 寃고븿? ?④퀬 ?뺤긽 湲곕뒫? ?ㅽ깘

- **Problem**: 12?섏씠吏 媛먯궗 蹂닿퀬?쒓? ?뺤쟻 HTML留?蹂닿퀬 ?숈쟻 諛붿씤???붿냼瑜?"鍮?猿띾뜲湲?濡??먯젙????ぉ???ㅼ닔?吏留? ?ㅼ젣 ?고??꾩뿉??蹂꾨룄 寃고븿??議댁옱?덈떎. ????ㅽ겕由щ꼫??`public-data/screener.json` 404瑜??곴뎄 "?섏쭛 以??쇰줈 ?쒖떆?덇퀬, FMP 誘몄꽕???⑺꽣??`????寃곗륫/?쒖쇅 ?섎?媛 遺덈챸?뺥뻽?? ?댁뒪???ㅼ젣 84媛??뚯뒪瑜?"50+"/"80媛?濡??섎뱶肄붾뵫?섍퀬 ?쒖떆 湲곗?쨌?곹븳???④꼈?쇰ŉ ?좏뵿 ?꾪꽣媛 遺꾨쪟 泥닿퀎蹂대떎 ?곸뿀?? 湲곗닠遺꾩꽍? 寃利?異쒖쿂 ?녿뒗 VCP 94%/?⑦꽩蹂??뺣? ?밸쪧???뺤젙媛믪쿂???몄텧?덈떎. 釉뚮━??罹섎┛?붾뒗 怨쇨굅 6/5쨌6/10 ?대깽?몃? ?ъ쟾???덉젙?쇰줈 痍④툒?덇퀬 Actions??肄붾뱶媛 ?쎈뒗 FMP/Anthropic ?쒗겕由우쓣 ?꾨떖?섏? ?딆븯??
- **Root cause**: (1) `loading`怨?`unavailable` ?곹깭瑜??섎굹??臾멸뎄濡??⑹묠, (2) ?뚯뒪 ?샕룹씠踰ㅽ듃쨌遺꾩꽍 洹쇨굅瑜??곗씠?곗뿉???뚯깮?섏? ?딄퀬 蹂듭닔 UI/?꾨＼?꾪듃???섎뱶肄붾뵫, (3) 遺꾩꽍???뺣쪧 二쇱옣??異쒖쿂쨌?쒕낯쨌?덉쭚 怨꾩빟???놁쓬, (4) ?뚰겕?뚮줈 ?섍꼍蹂?섏? ?섏쭛 肄붾뱶???붽뎄?ы빆??援먯감寃利앺븯吏 ?딆쓬.
- **Fix**: `_aioScreenerLoadState`濡?loading/ready/partial/unavailable??遺꾨━?섍퀬 寃곗륫 ?⑺꽣 ?쒖쇅瑜?紐낆떆. ?댁뒪 ?뚯뒪 ?섎? `AIO_NEWS_SOURCES.length`?먯꽌 ?숈쟻 ?쒖떆?섍퀬 諛섎룄泥는룹??뺥븰쨌梨꾧텒쨌FX ?꾪꽣 諛?48?쒓컙/?먯닔30/150嫄??뺤콉??怨듦컻. 怨좎젙 ?밸쪧쨌異쒖쿂 遺덈챸 ?듦퀎瑜??쒓굅?섍퀬 議곌굔遺 ?⑦꽩 ?먮떒?쇰줈 蹂寃? AI 釉뚮━?묒쓣 ?고????ㅻ깄???ν썑 ?대깽???앹꽦?앹쑝濡??꾪솚. Fed/BEA 怨듭떇 ?쇱젙 ?뺤씤 ??怨쇨굅 ?뺤쟻 ?대깽???쒓굅. Actions???좏깮 ?쒗겕由??꾨떖. T822 異붽?.
- **Prevention**: ?ъ슜??媛???곹깭??loading/unavailable/excluded瑜?遺꾨━?섍퀬, ?뚯뒪 ?샕룰????⑺꽣쨌?ν썑 ?쇱젙? ?⑥씪 ?곗씠???먯쿇?먯꽌 ?뚯깮?쒕떎. ?뺣? ?밸쪧/媛쒖꽑?⑥? 寃利?媛?ν븳 異쒖쿂쨌?쒕낯쨌湲곌컙???놁쑝硫??쒖떆?섏? ?딅뒗?? 媛먯궗 蹂닿퀬?쒕뒗 ?뺤쟻 留덊겕??二쇱옣怨??고????숈옉??諛섎뱶??援먯감寃利앺븳?? R208.

## P499 - v50.24 - 7媛??섏씠吏 on-enter refresh媛 議댁옱?섏? ?딅뒗 媛??怨꾩빟 ?쒖뒪??李몄“ ??no-op + autoOps "unknown task" 7嫄?

- **Problem**: `applyPageContractCompatibility`(aio-core.js)媛 ?섏씠吏 怨꾩빟(`AIO_PAGE_CONTRACTS`)??`refreshTasks`瑜?洹몃?濡?`AIO_PAGE_REFRESH_MAP`/`DATA_REQUIREMENT_PROFILES`??蹂듭궗. 洹몃윴??怨꾩빟?먮뒗 `themeRanking`/`portfolioRisk`/`companyFundamentals`/`filings`/`optionsSnapshot`/`krMacro` 媛숈? **媛???뚯깮) ?쒖뒪??*媛 ?ㅼ뼱?덇퀬 ?대뱾? `REFRESH_SCHEDULE` ?ㅺ? ?꾨떂 ??theme-detail/portfolio/ticker/options/kr-themes/kr-macro 吏꾩엯 ???대떦 ?ㅺ? `_aioRefreshPageData`?먯꽌 `if (!cfg) return`?쇰줈 議곗슜???ㅽ궢(= 洹??섏씠吏 ?듭떖 ?곗씠?곗쓽 on-enter 媛뺤젣 媛깆떊??no-op) + `getAutoOpsReadiness`媛 "unknown task" 7嫄?寃쎄퀬. ?쇱씠釉?`AIO.getAutoOpsReadiness()`?먯꽌 ?ㅼ륫 ?뺤씤.
- **Fix**: `applyPageContractCompatibility`??`CONTRACT_TASK_ALIAS` 異붽? ??媛???뚯깮 ?쒖뒪?щ? 洹??뚯깮???ㅼ젣濡??꾩슂濡??섎뒗 fetch ?섏〈 ?ㅻ줈 移섑솚(?? `optionsSnapshot`??['quotes','sentiment','vixHistory']`, `companyFundamentals`??['quotes','news','technicals']`, `krMacro`??['fred','krDynamic']`). `_resolveContractTasks`媛 ?ㅼ〈 `REFRESH_SCHEDULE` ?ㅻ쭔 梨꾪깮+dedupe ??`AIO_PAGE_REFRESH_MAP`/`DATA_REQUIREMENT_PROFILES` ?????좏슚 ?ㅻ쭔 蹂댁쑀.
- **Prevention**: ?섏씠吏 怨꾩빟??refreshTasks????"?뚯깮 遺꾩꽍" ?대쫫???ｌ쓣 ?뚮뒗 諛섎뱶??`CONTRACT_TASK_ALIAS`??fetch ?섏〈 ??留ㅽ븨???④퍡 ?깅줉. 誘몃벑濡?媛???쒖뒪?щ뒗 `_resolveContractTasks`媛 ?쒕∼(unknown task ?щ컻 李⑤떒). ?뚭?: T788(移섑솚 ??留ㅽ븨 unknown task 0). (v50.24 WO-3 P499.)

## P498 - v50.24 - SPX ATH ?섎뱶肄붾뵫 7412.84 以묐났???쒖そ留??쒖젙??湲됰씫???덉쭚 "Near ATH -0.4%" ?ㅽ몴??

- **Problem**: SPX ?ъ긽理쒓퀬媛(ATH) 湲곗?媛?`7412.84`(stale)媛 `js/aio-data.js` ??怨녹뿉 ?섎뱶肄붾뵫 以묐났(L12303 topbar ?덉쭚, L13125 home ?덉쭚). v50.16?먯꽌 L13125留?`DATA_SNAPSHOT.spxATH` ?대갚?쇰줈 ?쒖젙?먯쑝?? **applyLiveQuotes 猷⑦봽?먯꽌 癒쇱? ?ㅽ뻾?섏뼱 `window._spxATH`瑜?7412.84濡??ㅼ뿼**?쒗궎??L12303? 誘몄떆?? ??SPX 7386.65(-2.93% 湲됰씫???먯꽌 (7386.65??412.84)/7412.84 = ??.35% ???덉쭚 "ATH ??.4% 쨌 Near ATH"濡??쒖떆(?ㅼ젣 ATH 7585 ?鍮?媛???.6%). ?ъ긽理쒓퀬媛?먯꽌 ??.9% 鍮좎쭊 湲됰씫 ?뱀씪 ?붾㈃??"嫄곗쓽 ?ъ긽理쒓퀬"瑜??쒖떆?섎뒗 ?쇱씠釉??ㅽ몴????Fable 5 ?쇱씠釉?援щ룞?먯꽌 ?ㅼ쬆 ?ъ갑. 以묐났 濡쒖쭅???쒖そ留?怨좎퀜吏???⑦꽩(???꾨줈?앺듃 諛섎났 踰꾧렇 ?대옒?? verdict 遺??property 遺덉씪移섎룄 ?숈”).
- **Fix**: ?⑥씪 異쒖쿂 ?ы띁 `_aioSpxAthFloor()` = `Math.max(window._spxATH||0, DATA_SNAPSHOT.spxATH||7585)` ?좎꽕 ??L12303쨌L13125 ???몄텧?먯씠 媛숈? floor ?ъ슜. `7412.84` ?섎뱶肄붾뵫 ?꾩닔 ?쒓굅. 異붽?濡?topbar `mkt-regime-sub` ?쇰꺼 ?뺤쭅?? "Near ATH"????% ?대궡留? ??~??% "?뚰룺 ?섎씫", ??~??0% "議곗젙", ??0~??0% "議곗젙(Correction)", <??0% "?섎씫??Bear)".
- **Prevention**: ?쒖옣 湲곗?媛?ATH/breadth/?꾧퀎媛?? **?⑥씪 異쒖쿂 ?⑥닔/?곸닔**濡??듯빀 ???숈씪 媛믪쓣 ?щ윭 怨녹뿉 ?섎뱶肄붾뵫 湲덉?(?쒖そ留??쒖젙?섎뒗 ?щ컻 李⑤떒). ?뚭?: T786(`_aioSpxAthFloor() >= DATA_SNAPSHOT.spxATH` + applyLiveQuotes??7412.84 ?놁쓬)쨌T787(?쇰꺼 ??% ?뺤쭅??. audit ?ы썑寃異쒕낫???⑥씪 異쒖쿂?붽? 洹쇰낯. (v50.24 WO-2 P498.)

## P497 - v50.22 - fundamental 寃?됱씠 留ㅻ쾲 議댁옱?섏? ?딅뒗 per-page 梨꾪똿 ?⑤꼸濡??먮룞?꾩넚 ??"DOM input missing" ?먮윭 + 荑쇳꽣 ?먮룞?뚯쭊 ?쒕룄

- **Problem**: `fundamentalSearch`(aio-chat.js) 留먮?(6043~6047)媛 醫낅ぉ 寃???꾨즺 ??`chat-fundamental-inp`??15愿??遺꾩꽍 ?꾨＼?꾪듃瑜??ｊ퀬 **臾댁“嫄?`chatSend('fundamental')`** ?몄텧. 洹몃윭??fundamental? per-page ?⑤꼸???꾨땲??**?듯빀 AI ?⑤꼸(`ai-panel-inp`/`chatSendUnified`)**???ъ슜 ??`chat-fundamental-inp` DOM???놁쓬(home留?per-page ?⑤꼸 蹂댁쑀). ??留?醫낅ぉ 寃?됰쭏??`chatSend`媛 "[AIO chatSend] DOM input missing for ctxId=fundamental" 肄섏넄 ?먮윭 + return. 留뚯빟 ?⑤꼸???덉뿀?ㅻ㈃ 留?寃?됰쭏??怨듭쑀 Claude API 荑쇳꽣瑜??먮룞 ?뚯쭊?덉쓣 援ъ“(5紐?怨듭쑀 ??. ?쇱씠釉?肄섏넄?먯꽌 8??諛섎났 寃異?
- **Fix**: per-page ?⑤꼸(`chat-fundamental-inp`) 議댁옱 ?쒖뿉留??먮룞 ?꾩넚, ?놁쑝硫??듯빀 梨꾪똿 ?ъ슜) `chatSend` ????듯빀 ?낅젰李?`ai-panel-inp`)??遺꾩꽍 ?꾨＼?꾪듃留??꾨━?????ъ슜??opt-in ?꾩넚(荑쇳꽣 ?먮룞?뚯쭊 諛⑹?). ?섏쭛 ?곗씠?곕뒗 `window._fundAnalysisData`/`_currentTickerId`??蹂댁〈???듯빀 梨꾪똿???쒖슜. ?쇱씠釉?寃利?MSFT 寃??: "DOM input missing" ?먮윭 0.
- **Prevention**: per-page `chatSend(ctxId)`???대떦 ?섏씠吏??`chat-{ctxId}-inp` ?⑤꼸???ㅼ젣 ?덉쓣 ?뚮쭔 ?몄텧 ???듯빀 梨꾪똿 ?섏씠吏??`chatSendUnified`/`ai-panel-inp` 寃쎈줈 ?ъ슜. ?먮룞 LLM ?꾩넚? 怨듭쑀 ??荑쇳꽣 ?먮룞?뚯쭊?대?濡?opt-in ?먯튃. 肄섏넄 error???섏씠吏蹂?吏곸젒 ?먭? ??諛섎뱶???뺤씤(undefined ?ㅼ틪留뚯쑝濡?誘멸?異?????踰꾧렇??肄섏넄?먮쭔 ?쒖텧). (v50.22 P497.)

## P496 - v50.22 - portfolio 由ъ뒪??移대뱶 VaR/MDD媛 ?곗씠??遺議???"-??濡??쒖떆 (?댁쨷遺??cosmetic)

- **Problem**: `_renderRiskMetrics`(index.html)??VaR95/VaR99/MDD 移대뱶媛 `'-' + fmtPct(v)`濡??쒖떆. `fmtPct`??null/undefined????'?? 諛섑솚?대?濡? ?ы듃?대━???섏씡瑜??곗씠??<10??鍮??좉퇋 ?ы듃)?대㈃ `'-' + '??` = **"-??** (?댁쨷遺?몄쿂??蹂댁씠??placeholder)濡??뚮뜑. 媛믪씠 ?덉쓣 ???뺤긽("-2.34%") ??`_calcPortfolioVaR`/`_calcMaxDrawdown`???묒닔 ?ш린瑜?諛섑솚?섎?濡?遺???먯껜???뺥솗.
- **Fix**: `fmtLoss(v)` ?ы띁 ?좎꽕 ??null/undefined????, 媛믠넂'-X%'. VaR95/99/MDD 3怨녹뿉 ?곸슜. 寃利? 媛?"-2.34%/-5.12%/-18.00%", null "??(?댁쨷遺??0).
- **Prevention**: ?먯떎/?뚯닔 ?쒖떆???몃? '-' ?묐몢瑜?遺숈씪 ?뚮뒗 **null placeholder源뚯? 怨좊젮???щ㎎??*濡??쇱썝???묐몢+?щ㎎??遺꾨━ ??null?먯꽌 "-?? 諛쒖깮). (v50.22 P496. 濡쒖쭅 踰꾧렇 ?꾨땶 ?쒖떆 cosmetic.)

## P495 - v50.21 - kr-technical 援먯감?좏샇/?ㅼ씠踰꾩쟾?ㅻ룄 property 遺덉씪移섎줈 "undefined" ?뚮뜑 (P494 ?대윭?ㅽ꽣 ?뺤옣)

- **Problem**: analyzeKrIndex(index.html:29759) ?뚮뜑??"援먯감 ?좏샇 & ?ㅼ씠踰꾩쟾?? ?뱀뀡(29818~29820)?먯꽌 (1) `crossData.cross20_50`/`cross50_200` ??`_detectCrossSignals`??`{gc20_50, gc50_200}`(媛?'怨⑤뱺?щ줈??/'?곕뱶?щ줈??/null) 諛섑솚?대씪 `.cross20_50`? undefined + ?됱긽 鍮꾧탳 `==='golden'`(?곷Ц)??遺덉씪移???"undefined" + ??긽 ?뚯깋. (2) `divData.type` ??`_detectDivergence`??`{bearishDiv, bullishDiv, rsi}`(遺덈┛) 諛섑솚?대씪 `.type` undefined ??"undefined" + ?뚯깋. P494(dipData)? 媛숈? render ?⑥닔??媛숈? ?대옒??踰꾧렇?몃뜲, 吏곸쟾 KR ?ㅼ틪??dipData "53/5"留??좎쭨 ?뺢퇋?앹뿉 ?곗뿰??留ㅼ묶??諛쒓껄?덇퀬 cross/div "undefined"???볦묠.
- **Fix**: ?쒖떆瑜??ㅼ젣 諛섑솚 援ъ“??留욊쾶 ??`crossData.gc20_50==='怨⑤뱺?щ줈???green:'?곕뱶?щ줈???red:gray` + `escHtml(gc20_50||'?됲깂')`; `divData.bullishDiv?'媛뺤꽭 ?ㅼ씠踰꾩쟾??:bearishDiv?'?쎌꽭 ?ㅼ씠踰꾩쟾??:'?놁쓬'`. ?쇱씠釉?寃利? kr-technical undefined 0.
- **Prevention**: render ?⑥닔媛 ?щ윭 helper 寃곌낵瑜??⑹튌 ??**媛?helper???ㅼ젣 諛섑솚 ??媛믪쓣 toString???꾨땶 ?뺤쓽?먯꽌 ?뺤씤** ????怨?dipData) 踰꾧렇 諛쒓껄 ??媛숈? render??紐⑤뱺 ?곗씠??媛앹껜(cross/div/stage/trend) property瑜??쇨큵 ?먭?(?대윭?ㅽ꽣濡?泥섎━). ?ㅼ틪 ?뺢퇋?앹씠 ?곗뿰????嫄대쭔 ?≪븯?ㅺ퀬 "1嫄??쇰줈 寃곕줎 湲덉?. (v50.21 P495.)

## P494 - v50.20 - kr-technical `_classifyDip` ?쒖떆媛 "undefined (?먯닔: 53/5)" ??property紐?scale 3以?遺덉씪移?

- **Problem**: kr-technical 議곗젙 遺꾨쪟??"undefined (?먯닔: 53/5)" ?쒖떆. `_classifyDip`(index.html:28853)? `{classification, score(0-100)}` 諛섑솚?몃뜲 ?쒖떆 肄붾뱶(L29844)媛 `dipData.label`(議댁옱 ??????escHtml(undefined)="undefined")쨌`(?먯닔: '+dipData.score+'/5)`(score??0-100?몃뜲 /5濡??쒓린)쨌`dipData.reasoning`(議댁옱 ??????鍮?undefined) ?ъ슜. property紐?label vs classification) + scale(/5 vs /100) + ?꾨씫(reasoning) 3以?遺덉씪移?
- **Fix**: `_classifyDip` 諛섑솚??`label`(classification 蹂꾩묶) + `reasoning`(50?쇱꽑 ?꾩튂쨌議곗젙 源딆씠 %쨌???異붿꽭쨌嫄곕옒??湲곕컲 ?ㅼ젣 洹쇨굅 臾몄옄?? 異붽?(?곗씠?곕?議?early-return 28854 ?ы븿). ?쒖떆 `/5`??/100`. 寃利? "議곗젙(愿留? (?먯닔: 54/100)" + reasoning ?뺤긽.
- **Prevention**: ?⑥닔 諛섑솚 媛앹껜? ?쒖떆 肄붾뱶??property紐끒톝cale???숈떆 ?먭? ???뱁엳 escHtml(obj.?녿뒗????議곗슜??"undefined" ?뚮뜑(?먮윭 ?놁쓬). ?먯닔 ?쒖떆 ???⑥닔???ㅼ젣 score range(0-100 vs 0-5) ?뺤씤. (v50.20 P494.)

## P493 - v50.20 - breadth `diagnoseBreadthConsensus` verdict 遺??踰꾧렇 (?묒쓽 ?⑹쓽瑜?"?쎌꽭 ?곗쐞"濡??쒖떆)

- **Problem**: `AIO.diagnoseBreadthConsensus`(aio-core.js:9884) verdict 留ㅽ븨?먯꽌 `else if (consensus > 0.1) verdict = '?쎌꽭 ?곗쐞'`. consensus(媛以??⑹쓽, -1~+1)媛 0.1~0.4硫?**?묒닔 = ?쏀븳 媛뺤꽭 ?⑹쓽**?몃뜲 "?쎌꽭 ?곗쐞"(bearish edge)濡??쒖떆. 5/20/50SMA + McClellan + Weinstein + goldenCross 媛以??⑹쓽媛 媛뺤꽭 履쎌씠?대룄 breadth ?섏씠吏 ?듭떖 verdict媛 ?뺣컲?濡??쒖떆 ???몃젅?대뵫 ?먮떒 ?ㅻ룄. (諛대뱶: >0.4 媛뺤꽭?⑹쓽 / **0.1~0.4 ??踰꾧렇** / -0.1~0.1 ?쇱“ / -0.4~-0.1 ?쎌꽭?곗쐞 / <-0.4 ?쎌꽭?⑹쓽 ??0.1~0.4 ?먮━留?遺??諛섎?.)
- **Fix**: `'?쎌꽭 ?곗쐞'` ??`'媛뺤꽭 ?곗쐞'`. 寃利? ?묒닔 ?⑹쓽 ?낅젰 ??媛뺤꽭 verdict, ?뚯닔 ???쎌꽭.
- **Prevention**: ?먯닔?믩씪踰?留ㅽ븨(verdict band)? **遺??寃쎄퀎留덈떎 諛⑺뼢 ?쇱튂** ?먭?(?뱁엳 ?移?諛대뱶???????띿씠 媛숈? ?쇰꺼 ?곕뒗 copy-paste ?ㅼ닔). 0 湲곗? ?묒닔=媛뺤꽭/?뚯닔=?쎌꽭 ?쇨??? (v50.20 P493.)

## P492 - v50.19 - F&G媛 signal(異붿꽭異붿쥌 max媛뺤꽭) vs home(??컻??李⑥씡?ㅽ쁽)?먯꽌 ?뺣컲? 寃곕줎 (cross-page ?대㈃ 紐⑥닚)

- **Problem**: ?숈씪 Fear&Greed 吏?쒓? ???섏씠吏?먯꽌 ?뺣컲? ?됰룞??吏?? signal `computeTradingScore.momScore`(index.html:22476)??洹밸떒 ?먯슃(F&G??5)??85=理쒓퀬 ?먯닔(異붿꽭異붿쥌, 媛뺤꽭)濡??됯?. 諛섎㈃ home `AIO_ACTION_RULES.sentimentAction`(aio-core.js:9146)? 洹밸떒 ?먯슃(>75)??"李⑥씡?ㅽ쁽+鍮꾩쨷 異뺤냼"(??컻??. ??signal? 洹밸떒 ?먯슃??"媛??留ㅼ닔?섍린 醫뗭쓬", home? "?붿븘??. ?먰븳 洹밸떒 ?먯슃(怨쇰ℓ????max 媛뺤꽭濡?蹂대뒗 嫄?F&G ?ㅺ퀎 痍⑥?(洹밸떒 ?먯슃=寃쎄퀬/red)???諛섎?.
- **Fix**: signal momScore瑜??쵻??怨≪꽑?쇰줈 ??嫄닿컯???먯슃(55~75)=?쇳겕 74, 洹밸떒 ?먯슃(??5)=fade 66(怨쇰ℓ?샕룸え硫섑? ?뚯쭊 ?꾪뿕), 洹밸떒 怨듯룷(<25)=15??5(??컻??諛섎벑 floor). 洹밸떒 援ш컙?먯꽌 signal(異붿꽭異붿쥌)쨌home(??컻????媛숈? 諛⑺뼢(?먯슃 洹밸떒=?????좎쨷, 怨듯룷 洹밸떒=????湲고쉶)?쇰줈 ?섎졃. 媛以묒튂 ?쇰꺼???뚯뒪 紐낆떆("紐⑤찘?(F&G쨌異붿꽭異붿쥌)").
- **Prevention**: 媛숈? ?낅젰 吏?쒕? ?щ윭 ?섏씠吏媛 ????**?댁꽍 諛⑺뼢(異붿꽭異붿쥌 vs ??컻????洹밸떒 援ш컙?먯꽌 異⑸룎?섏? ?딄쾶** ?뺥빀 ???뱁엳 sentiment 吏?쒕뒗 洹밸떒?먯꽌 ??컻?곸씠 ?쒖??대?濡?momentum ?먯닔??洹밸떒??fade. (v50.19 P492.)

## P491 - v50.19 - signal exit trigger媛 "湲곗닠??吏吏?? ?쇰꺼?몃뜲 ?ㅼ젣濡??⑥닚 -10%

- **Problem**: `updateExitTriggers`(index.html:23415)媛 SPX ?먯젅??`spx * 0.9`(湲곌퀎??-10%)濡?怨꾩궛?섎굹 HTML ?쇰꺼(L5435)? "?꾩옱媛 ?鍮?-10% 湲곗닠??吏吏?? ???ㅼ젣 湲곗닠???덈꺼(?댄룊???ㅼ쐷???ATR)???꾨땲???꾩쓽 諛깅텇?? ?몃젅?대뜑媛 ?ㅼ젣 ???먯젅???꾨떂.
- **Fix**: 200?쇱꽑(二쇱슂 異붿꽭 吏吏)???꾩옱媛 ?꾨옒硫?洹??덈꺼???먯젅濡? ?대? ?섑쉶/誘멸?????50?쇱꽑??10% ?대갚. `window._spxMA[200/50]`??DATA_SNAPSHOT._fallback.spx200ma/50ma`. `exit-spx-basis` span?쇰줈 洹쇨굅 ?숈쟻 ?쒖떆 + ?쇰꺼 "二쇱슂 異붿꽭 吏吏??醫낃? ?섑쉶 ??異붿꽭 ?쇱넀 ?좏샇"濡??뺤쭅??
- **Prevention**: ?먯젅/吏吏 ?덈꺼? ?꾩쓽 諛깅텇?⑥씠 ?꾨땶 **?ㅼ젣 湲곗닠 ?덈꺼(?댄룊???ㅼ쐷)** 湲곕컲. ?쇰꺼??"湲곗닠???대씪 二쇱옣?섎㈃ ?ㅼ젣 湲곗닠 怨꾩궛怨??쇱튂?댁빞. (v50.19 P491.)

## P490 - v50.19 - ?몃젅?대뵫 ?ㅼ퐫???쒖옣???낅젰??誘몃줈????湲곕낯媛?75(?숆? ?명뼢)

- **Problem**: `computeTradingScore`(index.html:22497) + `computeExecutionWindow`(22596)??`breadth200`??`window._breadth200`(v50.6 ?쒓굅??200?쇱꽑???꾨땲???덇굅??"20SMA above %" 蹂?섎챸) 誘몄꽕????`_fb.breadth200`??*75**濡??대갚. `_breadth200`? breadth ?섏씠吏 init ?쒖뿉留??ㅼ젙 ???ㅻⅨ ?섏씠吏?먯꽌 ?먯닔 怨꾩궛 ??75(healthy) ?ъ슜 ???ㅼ젣 20SMA 57蹂대떎 ?믪븘 breadthScore 88(>70) = ?듭떖 留ㅻℓ ?먯닔 ?숆? ?명뼢. (P483 ?쒖옣??移⑷낵 ?숈씪 洹쇰낯 ??v50.6 蹂???쒓굅 誘몄쟾??)
- **Fix**: ?대갚 泥댁씤 `_breadth200`??_breadth20`(??긽 湲곕낯 57)??DATA_SNAPSHOT.breadth20sma`(57)??_fb.breadth200`??7濡?蹂寃?湲곕낯 75 ?쒓굅). 寃利? breadthScore 88??2.
- **Prevention**: ?몃젅?대뵫 ?먯닔??紐⑤뱺 ?낅젰 ?대갚 湲곕낯媛믪? **以묐┰/?ㅼ륫 洹쇱궗**?ъ빞(?숆? 75 媛숈? ?꾩쓽 ?고샇媛?湲덉?) ???곗씠??誘몄닔?좎씠 ?먯닔瑜??꾩슦硫????? v50.6 `_breadth200` ?쒓굅??紐⑤뱺 ?뚮퉬???먭?(P483怨?臾띠쓬). (v50.19 P490.)

## P489 - v50.18 - breadth 50SMA ?댁꽍 readout ?뺤쟻 "46% 誘명깉????移대뱶 52%? 紐⑥닚 (寃곕줎 諛섎?)

- **Problem**: breadth ?섏씠吏 50SMA 移대뱶(`breadth-50sma-big`, data-snap)??52%濡??숈쟻 媛깆떊?섎굹, 諛붾줈 ?꾨옒 ?댁꽍 readout(index.html:5617 ?뺤쟻 HTML)? "50?쇱꽑 46% ??50% 誘명깉???쇰줈 怨좎젙 + 留됰?(`breadth-50sma-bar`) width 46% 怨좎젙. 52%硫?50% **?곹쉶**?몃뜲 readout? "46% **誘명깉??*"?대씪 寃곕줎???뺣컲?. data-snap? ?띿뒪?몃쭔 媛깆떊?섍퀬 留됰? width쨌?댁꽍 臾몄옣? 媛깆떊 ??곸씠 ?꾨땲?덉쓬.
- **Fix**: readout div??`id="breadth-50sma-readout"` 遺??+ `updateBreadthBars`(aio-ui.js)??breadth-50sma 留됰? width쨌readout ?띿뒪???숈쟻 媛깆떊 釉붾줉 異붽?(`window._breadth50`??DATA_SNAPSHOT.breadth50sma` ?대갚, 50% ?곹쉶/誘명깉??議곌굔遺 臾몄옣). 寃利? 移대뱶쨌留됰?쨌readout 紐⑤몢 52% "50% ?곹쉶(??". 遺?? 媛숈? ?⑥닔 20SMA ?됱씠 `window._breadth200`(v50.6 ?쒓굅???덇굅??20?쇱꽑紐? ?⑤룆 ?섏〈 ??`_breadth20` ?대갚 robust.
- **Prevention**: data-snap 諛붿씤?⑹? ?レ옄 ?띿뒪?몃쭔 媛깆떊 ???숈씪 吏?쒕? ?몄슜?섎뒗 **?댁꽍 臾몄옣쨌留됰? width쨌諭껋???蹂꾨룄 ?숈쟻 媛깆떊 ?꾩슂**(?뺤쟻 湲곕낯媛믪? 移대뱶? 紐⑥닚?????덉쓬). 移대뱶 ???댁꽍 ?띿뒪?몃뒗 媛숈? 媛?寃곕줎 ?ъ슜 寃利? (v50.18 P489.)

## P488 - v50.18 - signal CP 由ъ뒪?щ낫?쒓? DATA_SNAPSHOT.wti(stale) ?쎌뼱 "怨좎젏沅? ?ㅽ몴??+ aio:liveQuotes ?щ젋???꾨씫

- **Problem**: signal CP1(吏?뺥븰)쨌CP6(?먯옄?? 由ъ뒪?щ낫???띿뒪?멸? "WTI $97.20 (怨좎젏沅?쨌吏?뺥븰 ?꾨━誘몄뾼쨌$110+ ?ш툒???몃뜲 live WTI??$89.52. ?댁쨷 踰꾧렇: (a) `getCP1Text`/`getCP6Text`(aio-core.js)媛 `_snap.num(DS.wti)`(DATA_SNAPSHOT 6/5 ?ㅽ뙆?댄겕 97.2)瑜??쎄퀬 live `_liveData['CL=F']`瑜?臾댁떆. (b) `renderCPTexts`媛 `applyDataSnapshot`(?ㅻ깄???곸슜 ???먯꽌留??몄텧?섍퀬 `aio:liveQuotes`(live fetch ?꾩갑)???몄텧 ??????init ?쒖젏 snapshot 媛믪쓣 DOM??援논엳怨?live ?꾩갑 ?꾩뿉???щ젋?????? ?좉?媛 89濡?鍮좎죱?붾뜲 "怨좎젏沅??ш툒?? ?⑥젙 = 留ㅻℓ ?ㅼ씤.
- **Fix**: (a) `getCP1Text`/`getCP6Text`瑜?`_liveData['CL=F']`/`['BZ=F']` ?곗꽑, snapshot ?대갚?쇰줈 蹂寃? (b) signal liveQuotes ?몃뱾??`core-signal-live`, aio-core.js:1702)??`NARRATIVE_ENGINE.renderCPTexts()` 異붽?. 寃利?SW unregister+cache clear+reload fresh): CP1 "WTI $89.52 (?덉젙??湲곕?)" 쨌 CP6 "$89.52쨌Brent $92.73 (?꾪솕 湲곕?)".
- **Prevention**: "?꾩옱 ?쒖옣" ?대윭?곕툕 ?앹꽦湲곕뒗 live ?쇰뱶 ?덈뒗 ?щ낵(WTI=CL=F쨌Brent=BZ=F ??? **live ?곗꽑쨌snapshot ?대갚**. ?숈쟻 ?띿뒪???뚮뜑?щ뒗 snapshot 蹂寃?applyDataSnapshot)肉??꾨땲??**live ?꾩갑(aio:liveQuotes)?먮룄 ?щ젋??* ?곌껐(??以??섎굹留?嫄몃㈃ init ?쒖젏 媛믪뿉 援녹쓬). (v50.18 P488.)

## P487 - v50.18 - macro ?ㅽ넗由щ씪??"怨좎슜 ?뷀솕" ?꾩젣媛 5??NFP 172K(寃ъ“)? ?뺣컲?

- **Problem**: macro "?댁꽍:" 釉붾줉(index.html:7147 ?뺤쟻)??"2026?꾩? ?댁쨷 ?꾪뿕(怨좎슜? ?뷀솕??+ ?명뵆?덈뒗 ?곸듅??" ?⑥젙. 洹몃윭??5??NFP??172K濡?**媛뺤꽭** ??媛뺥븳 怨좎슜??湲덈━?명븯 湲곕?瑜??꾪눜?쒗궓 寃?怨⑤뱶留??명븯 泥좏쉶) ?꾩옱 ?듭떖 留ㅽ겕濡??ㅽ넗由? "怨좎슜 ?뷀솕" ?꾩젣媛 ?ъ떎怨?諛섎? ???ъ슜?먭? ?섎せ??嫄곗떆 洹몃┝?쇰줈 ?먮떒.
- **Fix**: "寃ъ“??怨좎슜(5??NFP 172K濡?湲덈━?명븯 湲곕? ?꾪눜)怨??덉쟻???명뵆?댟룹쑀媛 由ъ뒪?ш? 寃뱀퀜 ?곗????쒕몮???꾪솕?섍린 ?대젮??援?㈃"?쇰줈 ?뺤젙 + "?ㅼ떆媛?援?㈃? ?⑤룄怨꽷룸룞???쒓렇???곗꽑" 二쇱꽍.
- **Prevention**: ?뺤쟻 留ㅽ겕濡??대윭?곕툕???듭떖 ?꾩젣(怨좎슜/?명뵆??諛⑺뼢)??理쒖떊 諛쒗몴移?NFP/CPI)? ?뺥빀 寃利???諛쒗몴 臾띠쓬 媛깆떊 ???ㅽ넗由щ씪???꾩젣???④퍡 ?먭?. 媛?ν븯硫?generateMacroStoryline濡??숈쟻??v50.x 諛깅줈洹?. (v50.18 P487.)

## P486 - v50.18 - themes ?뺤쟻 ?ъ씠??吏꾨떒???숈쟻 readout怨??뺣㈃ 紐⑥닚 (Late-cycle ?ㅽ깭洹명뵆?덉씠???⑥젙 vs Mid Cycle Expansion)

- **Problem**: themes `cycle-analysis`(index.html:8865 ?뺤쟻)媛 "諛⑹뼱 ?뱁꽣 ?곷?媛뺤꽭쨌?깆옣 ?꾪뻾쨌寃쎄린 ?꾨컲(Late-cycle)+?ㅽ깭洹명뵆?덉씠??理쒖븙??議고빀) 由ъ뒪??瑜??⑥젙. 洹몃윭??諛붾줈 ???숈쟻 readout(`cycle-dynamic-phase`)? "Mid Cycle (Expansion)"(VIX<20+breadth>50%) ???뺣컲? 援?㈃???숈떆 ?쒖떆. "(李멸퀬 湲곗?)" ?쇰꺼濡??쏀븯寃?援щ텇?덉쑝???ъ슜?먮뒗 "?ㅽ깭洹명뵆?덉씠??理쒖븙"???꾩옱濡??쎌쓬.
- **Fix**: ?뺤쟻 釉붾줉??"?⑥젙"?먯꽌 "議곌굔遺 援먯쑁"?쇰줈 ?꾪솚 ??"諛⑹뼱 媛뺤꽭=Late-cycle ?좏샇 / ?깆옣 二쇰룄=Expansion"???묒そ 議곌굔遺濡??ㅻ챸?섍퀬 "?꾩옱 援?㈃? ???숈쟻 readout ?곕Ⅴ?몄슂(?뺤쟻 ?띿뒪?몃줈 ?⑥젙 ????"濡??꾩엫. ?쇰꺼 "?ъ씠??吏꾨떒(李멸퀬 湲곗?)"???ъ씠??吏꾨떒 ?쎈뒗 踰?援먯쑁쨌?꾩옱 ?먯젙 ?꾨떂)", ?됱긽 red?믪쨷由?
- **Prevention**: ?숈쟻 ?먯젙 ?붿쭊(getCycleFromMacro ?????덈뒗 ?섏씠吏???뺤쟻 蹂댁“ ?띿뒪?몃뒗 **?뱀젙 援?㈃???⑥젙?섏? 留?寃?*(?숈쟻怨?紐⑥닚 ?꾪뿕) ??議곌굔遺 援먯쑁?쇰줈 ?묒꽦 + ?숈쟻 readout???먯젙 ?꾩엫. (v50.18 P486.)

## P485 - v50.17 - fxbond yield curve "?섏쭛 ?湲? ?곴뎄 硫덉땄 + macro/fxbond 罹붾쾭???ㅻ젋??(?댁쨷 踰꾧렇)

- **Problem**: fxbond `koreaCurveChart`媛 "?섏쭛 ?湲겸? placeholder?먯꽌 ?곴뎄 硫덉땄(?쇱씠釉?yield 4媛?IRX/FVX/TNX/TYX 媛?⑺븳?곕룄). ?댁쨷 ?먯씤: (1) `initYieldCurveChart()`??`_initMacroPage`(aio-core.js:19799)?먯꽌留??몄텧 ??fxbond `updateFxBondPage`???몄텧 ????怨쇨굅 BUG-4?먯꽌 "macro ?꾩슜 罹붾쾭??濡??ㅽ뙋???쒓굅??. (2) `var ctx = getElementById('koreaCurveChart') || getElementById('yieldCurveChart')` ??koreaCurveChart媛 紐⑤뱺 ?섏씠吏 DOM???곸〈?섎?濡?`||` 醫뚮?????긽 ?좏깮 ??**macro媛 ?몄텧?대룄 fxbond???⑥?(0-size) 罹붾쾭?ㅻ줈 ?뚮뜑** + ?⑥씪 ?꾩뿭 `_ycChart`瑜????섏씠吏媛 怨듭쑀???쒕줈 destroy.
- **Fix**: `initYieldCurveChart(targetId)` ?뚮씪誘명꽣??誘몄?????`#page-fxbond.active` ?щ?濡?罹붾쾭???좏깮) + per-canvas `_ycCharts{}` ?몄뒪?댁뒪留?怨듭쑀 destroy 異⑸룎 李⑤떒) + fxbond ?섏씠吏 init(PAGES 'fxbond')??`setTimeout(()=>initYieldCurveChart('koreaCurveChart'),200)` 異붽? + macro??`initYieldCurveChart('yieldCurveChart')` 紐낆떆 + 罹붾쾭??aria-label "?쒓뎅 援?콈"??誘?援?콈(US Treasury)"(?ㅼ젣 ^IRX/^FVX/^TNX/^TYX ?뚮’?대씪 ?쇰꺼 ?뺤쭅??. ?쇱씠釉?寃利? koreaCurveChart ?몄뒪?댁뒪 ?앹꽦 + status "???뺤긽 怨≪꽑".
- **Prevention**: ?щ윭 ?섏씠吏媛 媛숈? 李⑦듃 init ?⑥닔瑜?怨듭쑀????(1) 罹붾쾭???源껋? ID 紐낆떆 ?뚮씪誘명꽣濡??꾨떖(?꾩뿭 `getElementById`+`||` ?대갚 湲덉? ???숇챸/?곸〈 罹붾쾭?ㅺ? 醫뚮? ?낆젏) (2) 李⑦듃 ?몄뒪?댁뒪??per-canvas 留듭쑝濡?愿由??⑥씪 ?꾩뿭 湲덉?). T785 ?몄젒. (v50.17 P485.)

## P484 - v50.17 - sentiment NAAIM/II/HY 李⑦듃 鍮??붾㈃ (lazy init???대? ?ㅽ겕濡?而⑦뀒?대꼫 ?붾㈃ 諛?李⑦듃 誘몃컻??

- **Problem**: sentiment ?섏씠吏 NAAIM쨌Investor Intelligence쨌HY Spread 3媛?李⑦듃媛 鍮?罹붾쾭??LWC 而⑦뀒?대꼫 臾는룻뵿? 臾?. `initSentimentPage`媛 ?대뱾??`_lazyInitChartPage`(IntersectionObserver rootMargin 100px)濡??깅줉?섎굹, ?섏씠吏媛 ?대? `.content` 而⑦뀒?대꼫濡??ㅽ겕濡ㅻ릺怨?李⑦듃媛 ?붾㈃ 諛?naaim 1325px/ii 1325px/hy 2312px)?대씪 吏꾩엯 ??愿李곗옄 誘몃컻?????ㅽ겕濡??꾧퉴吏 鍮?梨꾨줈 ?붿〈(?ъ슜??"湲곕뒫???섏삤吏???딄퀬"). 吏곸젒 `_initSentNaaimChart()` ???몄텧 ???뺤긽 LWC ?뚮뜑 ?뺤씤 ???곗씠??init ?⑥닔???뺤긽, ?몃━嫄곕쭔 ?ㅽ뙣.
- **Fix**: `initSentimentPage`??吏꾩엯 ??1.4s ?덉쟾留?`setTimeout` 異붽? ??vix/naaim/ii/hy 媛?罹붾쾭?ㅺ? 誘몃젋??`.lwc-chart-container` ?뺤젣 臾?AND 罹붾쾭???쎌? 臾?硫??대떦 init ?⑥닔 媛뺤젣 ?몄텧(?대? ?뚮뜑??嫄??ㅽ궢??以묐났 諛⑹?). ?쇱씠釉?寃利?v50.17 reload): naaim/ii/hy 紐⑤몢 `rendered:true, hasLWC:true`.
- **Prevention**: ?대? ?ㅽ겕濡?而⑦뀒?대꼫(window ?꾨땶 `.content`) ?덉쓽 below-the-fold 李⑦듃瑜?`_lazyInitChartPage`濡??깅줉???뚮뒗 愿李곗옄 誘몃컻???鍮??덉쟾留?吏????대㉧ ?먮뒗 異⑸텇??rootMargin) ?숇컲. 鍮?罹붾쾭???먯젙? `.lwc-chart-container` ?뺤젣 ?좊Т濡?LWC ?뚮뜑 ?뺤씤(?쎌? 寃???⑤룆 湲덉? ??LWC??蹂꾨룄 罹붾쾭??而⑦뀒?대꼫??洹몃┝). T-媛?쒕뒗 ?덉쟾留??⑥닔 議댁옱濡?媛꾩젒 寃利? (v50.17 P484.)

## P483 - v50.17 - ?꾩뿭 ?쒖옣??移⑹씠 ?쒓굅??_breadth200 ?대갚 ???뱁꽣 ?뱀씪鍮꾩쑉 27%瑜?"?쎌꽭"濡??ㅻ씪踰?(???섏씠吏)

- **Problem**: 留덉폆?꾩뒪諛????섏씠吏 怨듯넻) ?쒖옣??移⑹씠 "27% ?쎌꽭"(鍮④컯) ?쒖떆 ???ㅼ젣 breadth(50?쇱꽑 ??醫낅ぉ %)??52%?몃뜲 遺덉씪移? `updateMarketPulse`(index.html:23637)媛 `window._breadth200`??1?쒖쐞濡??쎌쑝??v50.6?먯꽌 200?쇱꽑 breadth瑜??쒓굅(breadth=5/20/50 ?뺤젙)??`_breadth200`=undefined ??`_breadthLiveData`=null ??`calcSectorBreadth`(11 ?뱁꽣 ETF **?뱀씪 ?묐큺鍮꾩쑉** 27%)濡??대갚. 利?"50?쇱꽑 ??%"媛 ?꾨땶 ?꾪? ?ㅻⅨ ?쇨컙 吏?쒕? ?쒖옣??쑝濡??ㅻ씪踰? ??ㅽ봽 ?뱀씪???뱁꽣 ?묐큺鍮꾩쑉????븘(27%) "?쎌꽭" 鍮④컯 ?쒖떆 ???몃젅?대뜑媛 ?쒖옣??씠 ?쎌꽭??以??ㅼ씤 媛??留ㅻℓ-?덉쟾 吏곴껐).
- **Fix**: ?대갚 泥댁씤??`_breadth50`(50SMA ??%, breadth ?섏씠吏쨌?ㅼ퐫?대쭅 ?뺤쓽? ?뺥빀)??_breadthLiveData.abv50`??_breadth20`??DATA_SNAPSHOT.breadth50sma`濡?援먯껜, calcSectorBreadth(?쇨컙 ?? 李멸퀬????理쒗썑 ?대갚?쇰줈 媛뺣벑. ?쇱씠釉?寃利? 移?"52% 二쇱쓽"(amber), `_breadth50`=52? ?뺥빀.
- **Prevention**: 蹂???꾨뱶 ?쒓굅(v50.6 `_breadth200`) ??**紐⑤뱺 ?뚮퉬??grep ???대갚 泥댁씤 ?ъ젙???섎Т**(?쒓굅??蹂?섎? 1?쒖쐞濡??쎌쑝硫??섎룄移??딆? ?꾩닚???대갚??移⑤У 諛쒕룞). 吏??移⑹? ?섏씠吏 蹂몃Ц ?뺤쓽? ?숈씪 ?뚯뒪 ?ъ슜. T785 ?뚭? 媛??`updateMarketPulse`媛 `_breadth50`/`breadth50sma` ?ъ슜 寃利?. (v50.17 P483.)

## P482 - v50.9 - computeMacroBeta ?숆린?⑥닔??.catch ?몄텧 ??醫낅ぉ 梨꾪똿 ??붾찘??釉붾줉 ?꾩껜 silent reject

- **Problem**: `_fetchTickerDataForChat`(aio-chat.js:~2184)媛 `window.AIO.computeMacroBeta(t).catch(...)`濡??몄텧?덉쑝??`computeMacroBeta`(aio-core.js:6004)??**?숆린 ?⑥닔**(plain object 諛섑솚, async ?꾨떂). object?먮뒗 `.catch`媛 ?놁뼱 promise 援ъ꽦 以?**TypeError ?숆린 throw** ??`async function _fetchTickerDataForChat` ?꾩껜媛 reject. chatSend媛 try/catch濡??쇱폒 醫낅ぉ ??붾찘???곗씠??釉붾줉(11+ ?뚯뒪)??**議곗슜???듭㎏濡??꾨씫**??梨??듬? ?앹꽦. v49.58(computeMacroBeta 梨꾪똿 ?듯빀) ?댄썑 ?좊났. 媛숈? 以꾩쓽 ?ㅻⅨ compute*(FcfYield/Balance/EvEbitda/Moat/TAM)??紐⑤몢 `async function`?대씪 ?뺤긽, computeMacroBeta留?sync?ъ꽌 ?⑤룆 ?뚭?.
- **Fix**: ?몄텧遺瑜?`Promise.resolve(window.AIO.computeMacroBeta(t)).catch(...)`濡?媛먯떥 sync/async ?묒そ ?댁꽦 ?뺣낫. preview ?ㅼ륫: ?섏젙 ??`_fetchTickerDataForChat(['NVDA'])` ??"computeMacroBeta(...).catch is not a function" throw, ?섏젙 ???뺤긽 string 諛섑솚(?듯빀 ??좊ː ?쇱씤 + 7 high-risk label ?ы븿).
- **Prevention**: 梨꾪똿 fetch ?뚯씠?꾨씪?몄뿉???몃? ?⑥닔 promise????sync 諛섑솚 ?⑥닔??`Promise.resolve()` wrapping ?섎Т(?쇳빀 promise 諛곗뿴??`.catch`/`.then` 吏곸젒?몄텧 湲덉?). ?ы띁媛 async?몄? sync?몄? ?몄텧 ???뺤씤. (v50.9 P482, T771 ?몄젒 ?뚭?.)

## P480 - v50.4 - [R205] static market calendars must separate official releases from source-dependent topics

- **Problem**: Static and hardcoded surfaces still mixed stale 4-5??events, archived earnings calendars, future CPI/FOMC claims, and current market topics. This could make a refreshed UI look current while pinned events, AI briefing context, or options/KR macro copy still referenced old calendars or implied unpublished data.
- **Fix**: Updated `AIO_MACRO_CALENDAR`, `DATA_SNAPSHOT` metadata, home static news, briefing current-event layer, risk pinned events, options volatility copy, KR macro schedule, and AI briefing context to the 2026-06-03 KST official calendar. Computex/GTC Taipei is a current-topic layer; SpaceX IPO is explicitly source-dependent watch; unpublished May CPI/NFP/PCE numbers are blocked from being generated.
- **Prevention**: T759~T762 guard official June dates, snapshot current-topic fields, home topic queue, and active `vMAJOR.MINOR` version policy. Future hardcoded current-market copy must cite an official release date or be marked watch/reference-only.

## P479 - v50.3 - [R204] user-facing market text must pass the text surface contract

- **Problem**: The 21 route pages contained a mixture of user guidance, market analysis, educational text, developer/version markers, fixed-date briefing claims, and reference/archive material. Some visible text such as `[PRIMARY]`, `[SECONDARY]`, `R69 ACTION_RULES`, `PAGE_PURPOSE_REGISTRY`, and fixed FOMC/CPI/earnings/Computex dates could make stale or internal information look like current institutional guidance.
- **Fix**: Added `AIO_TEXT_SURFACE_CONTRACTS`, `AIO.getTextSurfaceAudit()`, and `AIO.applyTextSurfaceHygiene()`. The audit classifies visible and tooltip text as current market claim, education explainer, operational status, developer note, risk disclaimer, or reference archive. It is wired into `AIO_AUDIT_REGISTRY` and `AIO.runEvidenceDeploymentGate()`. High-risk visible internal markers and fixed-date decision copy were removed or downgraded to reference/archive wording.
- **Prevention**: T755~T758 guard text contracts, high-risk marker removal, briefing fixed-date claim removal, and deployment-gate inclusion. Future current-market claims need evidence/currentness markers, while developer notes belong in diagnostics/Evidence Console only.

## P478 - v50.2 - [R203] news surfaces must share one evidence-style contract

- **Problem**: Home core news, market briefing, and market-news all used `newsCache`, but each renderer applied its own direct filters, static fallback behavior, duplicate handling, and AI summary input policy. This allowed the UI to say news was refreshed while expired `HOME_WEEKLY_NEWS`, secondary-only TG items, or unverified/stale items could still influence a visible surface or briefing summary path.
- **Fix**: Added `AIO_NEWS_SURFACE_CONTRACTS`, `AIO.buildNewsSurfaceModel()`, and `AIO.getNewsSurfaceAudit()`. Home now renders only model-selected top-3 actionable news and treats expired weekly static news as reference-only. Briefing uses the 08:00 KST 24h model and sends only verified/current items into AI summary text while placing secondary/unverified items in review. Market-news uses the shared model for 48h exploration and empty reasons.
- **Prevention**: T749~T754 guard surface contracts, role-specific model output, expired static home behavior, briefing AI evidence filtering, market-news empty reasons, and deployment-gate inclusion.

## P477 - v50.1 - [R200] trading decision logic must be gated by current evidence

- **Problem**: Page-level evidence existed, but trading/decision functions could still return plausible scores from stale or proxy inputs: hardcoded SPX MA constants, breadth default/proxy paths, OHLCV-missing RSI/MACD proxies, localStorage ATH estimates, static VIX IV Rank range, and static screener values in ticker entry checks.
- **Fix**: Added `AIO.getTradingDecisionInputEvidence()` and `AIO.getTradingDecisionLogicAudit()`, wired trading findings into `AIO.runEvidenceDeploymentGate()`, neutralized SPX MA hardcoded fallbacks, exposed trading score evidence status, marked Weinstein ATH proxy evidence, and made options IV Rank use VIX history when available.
- **Prevention**: T745~T748 guard trading input evidence, trading logic audit shape, deployment gate inclusion, and active runtime version format (`vMAJOR.MINOR`, max two decimal digits).

## P476 - v50.0 - [R200] 21-page evidence contract + deployment gate foundation

- **Problem**: R187~R199 accumulated as separate freshness/evidence rules, but runtime contracts were still split across page profiles, refresh map, deep audits, sequential registry, and critical-10 evidence checks.
- **Fix**: Added `AIO_PAGE_CONTRACTS`, `EvidenceStore`, `SourceAdapterRegistry`, `AuditRegistry`, `FormulaRegistry`, `AIO.getAllPageContentEvidenceMatrix()`, and `AIO.runEvidenceDeploymentGate()`. `DATA_SNAPSHOT` is now reference/historical unless promoted by verified current evidence.
- **Prevention**: T737~T744 guard contracts, derived maps, source adapters, evidence store, formula registry, audit registry, deployment gate, and AI chat evidence guard.

## P475 - v49.112 - [R199] full evidence matrix must not sample representative content only

- **Problem**: Critical-10 checks could still pass while charts, numeric text, narratives, and hidden surface items remained outside the evidence matrix.
- **Fix**: `AIO.getCritical10ContentEvidenceMatrix()` inventories all live/snapshot/snap-date/chart/numeric/narrative items and classifies pass/warn/block/needs_evidence.

## P474 - v49.111 - [R198] visible content must be compared against current market situation

- **Problem**: Refresh success did not prove that visible values or narratives matched the current market regime.
- **Fix**: Added current reference snapshot plus `AIO.getCritical10MarketSituationAudit()` and `AIO.refreshCritical10MarketSituationAudit()`.

## P473 - v49.110 - [R197] critical freshness must inspect the visible market surface

- **Problem**: Scheduler freshness could look healthy even when visible cells were source-missing, reference-only, or truth-blocked.
- **Fix**: Added `AIO.getCritical10MarketSurfaceAudit()` and wired it into freshness/readiness.

## P472 - v49.109 - [R196] trading-use quotes need independent cross-source validation

- **Problem**: A single live source could be wrong or stale and still appear decision-usable.
- **Fix**: Added source-family quote cache and multi-source cross-checking, with mismatches blocking trading-use values where appropriate.

## P471 - v49.108 - [R195] trading-use market data must pass DataTruthGate

- **Problem**: Live values lacked a unified truth gate for source, timestamp, sanity, and previous-close coherence.
- **Fix**: Added `AIO_DATA_TRUTH_GATE`, `AIO.evaluateDataTruth()`, and `AIO.getDataTruthAudit()`.

## P470 - v49.107 - [R194] refresh success must be followed by DOM binding verification

- **Problem**: Data fetch completion could be mistaken for actual visible screen update completion.
- **Fix**: Added explicit live DOM binding apply/verify/repair paths for critical-10 pages.

## P469 - v49.106 - [R193] AI chat must vary answer structure and use injected current data

- **Problem**: AI answers were too uniform and could still lean on model memory for current claims.
- **Fix**: Added intent-based answer coverage context and stricter prompt rules for live/FMP/SEC/Naver/Finnhub/news data use.

## P468 - v49.105 - [R192] forceFresh for AI stock answers must bypass local stale shortcuts

- **Problem**: `_chatTickerCache`, `_liveData` shortcuts, and min-gap throttles could bypass fresh stock answer retrieval.
- **Fix**: Forced fresh ticker lookup and cache invalidation for chat-answer preflight.

## P467 - v49.104 - [R191] AI stock answers require strict fresh quote/company data preflight

- **Problem**: Stock chat could answer before current quote/company blocks were verified.
- **Fix**: Added `AIO.ensureFreshChatAnswerData()` and strict ticker data block injection.

## P466 - v49.103 - [R190] visible charts/indicators/numbers/formulas/text enter freshness audit

- **Problem**: Page refresh could miss visible static numbers, formulas, chart containers, and narrative claims.
- **Fix**: Added surface integrity audit and automatic DOM live-symbol collection.

## P465 - v49.102 - [R189] comprehensive 5 page data refresh uses page profile task/symbol union

- **Problem**: Some page-specific symbols/tasks were not prewarmed by the central refresh.
- **Fix**: Routed page refresh through central scheduled refresh using page profile symbols.

## P464 - v49.101 - [R188] full refresh progress must use central refresh state

- **Problem**: UI progress could say data was refreshing without reflecting the real task pipeline state.
- **Fix**: Added central refresh state events and progress layer for task-level start/progress/done reporting.

## P432 쨌 v49.80 쨌 [P432] ticker context HARD STOP 異붽? ??null ??媛寃??몄슜 ?덈? 湲덉?

- **Codex 諛쒓껄**: v49.79?먯꽌 ticker context null guard 媛뺥솕?덉쑝?? AI媛 ticker 誘명솗???곹깭?먯꽌 媛寃?異붿륫 ?듬? 媛?μ꽦 ?붿〈.
- **?쒖젙**: null branch??"?먯떆??誘몄닔??HARD STOP??ticker ?뺤젙 ?꾩뿉??紐⑤뱺 媛寃??몄슜 湲덉?. 癒쇱? ?ъ슜?먯뿉寃?醫낅ぉ???뺤씤?섍퀬 live fetch ?댄썑?먮쭔 媛寃⑹쓣 留먰븳??" 異붽?.

## P431 쨌 v49.80 쨌 [P431] getThemeTrendDeepAudit ?뺤옣 ??REGISTRY + KR_STOCK_DB ?듯빀

- **Codex ?쒖젙**: 湲곗〈 SCREENER_DB留??濡??ъ슜 ??AIO_TICKER_NAME_REGISTRY + KR_STOCK_DB 異붽? ?듯빀. ?뚮쭏 ticker 留ㅼ묶 ?뺥솗???μ긽 (placeholder ?쒖쇅 + KR 6?먮━ 肄붾뱶 .KS/.KQ ?먮룞 留ㅽ븨).

## P430 쨌 v49.80 쨌 [P430] getThemeCompositionLogicAudit ?좉퇋 ???뚮쭏 援ъ꽦 ?먮룞 寃利?

- **Codex ?좉퇋**: ?뚮쭏 ?뺤쓽??援ъ“???뺥빀???먮룞 寃利?
- **寃利???ぉ**: duplicateThemeIds / invalidWeights / weightCoverageIssues / leaderNotInBasket / krRawCodesMissingStockDb / semanticEvidencePct (90%+) / semanticExclusionHits (諛곗젣 洹쒖튃 ?꾨컲).
- **?щ컻 諛⑹?**: T643~T646.

## P429 쨌 v49.80 쨌 [P429/R166] AIO_THEME_SEMANTIC_EXCLUSION_RULES ?좉퇋

- **臾몄젣**: ?먮룞 ticker?믫뀒留?留ㅼ묶???섎??곸쑝濡?遺?곹빀??醫낅ぉ ?ы븿 ?꾪뿕.
- **?쒖젙**: 紐낆떆??諛곗젣 洹쒖튃 ??kr_medtech: 068760.KQ Celltrion Pharm (pharma/biopharma ?몄텧, AI 吏꾨떒 ?먮뒗 ?섎즺湲곌린 吏곸젒 ?몄텧 ?꾨떂) / kr_kfood: 004990.KS Lotte Corp (holding company, Lotte Wellfood 280360.KS濡?吏곸젒 ?몄텧 沅뚯옣).
- **?щ컻 諛⑹?**: T646 + R166.

## P428 쨌 v49.80 쨌 [P428/R165] TICKER REGISTRY 100+ ?뺤옣 + MARA 湲곗뾽紐?媛깆떊

- **Codex ?뺤옣**: AIO_TICKER_NAME_REGISTRY 100+ entries 異붽? ??medtech KR (JLK/VUNO/Dentium/誘몃옒而댄띁??濡?뜲?고뫖??ROBOTIS) + US 硫붽?罹??좏씎援?100+ (?꾨젰/諛⑹궛/?먮꼫吏/移댁???湲?由ъ툩/?좏떥由ы떚 ??. MARA: 留덈씪?ㅻ뵒吏????留덈씪??⑹뒪 (?ㅼ젣 湲곗뾽紐?蹂寃?諛섏쁺). KR_STOCK_DB ?뺤젙: 178320 濡쒕낫?ㅽ? ???쒖쭊?쒖뒪??(?ㅼ젣 醫낅ぉ 留ㅽ븨) / 108320 濡쒕낫?곗쫰 ??LX?몃?肄?(?밸━??. medtech_kr ?뚮쭏 ?ш뎄?? ?쇱쿇?뱀젣??誘몃옒而댄띁??由ш?耳????대옒?쒖뒪/猷⑤떅/酉곕끂/JLK/?댄떚?. HXSCL ??SK?섏씠?됱뒪(000660.KS) ?쇨???(v48 ?듯빀 而⑦뀓?ㅽ듃 + kr-macro + kr-themes + AI Briefing + KR_THEME_CATALYSTS).
- **?щ컻 諛⑹?**: T641~T642 (theme detail LIVE REQUIRED graceful).

## P427 쨌 v49.79 쨌 [P427/R164] Claude API 鍮꾩슜 ?꾩쟻 異붿쟻 + 媛?쒗솕 遺??

- **臾몄젣**: ?ъ슜???뺤쭅 ?붽뎄 ??"API 鍮꾩슜 ?꾩쟻 異붿쟻 遺?? v49.78 ?붿뿬 6嫄?以?LOW priority.
- **?쒖젙**: `_aioTrackApiUsage({model, inputTokens, outputTokens})` ?좎꽕 ??callClaude ?묐떟 ???먮룞 ?몄텧. daily / lifetime ?꾩쟻 + 30?? ?먮룞 ?뺣━. Anthropic 媛寃?(Sonnet $3/$15 쨌 Haiku $0.25/$1.25 per 1M tok) ?곸슜.
- **肄섏넄**: `AIO.getApiUsage()` 利됱떆 議고쉶 (?ㅻ뒛/7??lifetime).

## P426 쨌 v49.79 쨌 [P426/R163] 硫?고꺆 race condition + localStorage storage ?대깽??遺??

- **臾몄젣**: ?ъ슜???뺤쭅 ?붽뎄 ??"硫?고꺆 race condition" v49.78 ?붿뿬. API ?ㅻ? ????뿉??蹂寃쏀븯硫??ㅻⅨ ??? 利됱떆 ?몄? 紐삵븿.
- **?쒖젙**: `window.addEventListener('storage', ...)` ?깅줉. API ??(`aio_*_key`) / ?ъ슜???꾨줈??/ ?뚮엺 蹂寃?媛먯? ???ㅻⅨ ??toast + audit widget ?먮룞 媛깆떊.

## P425 쨌 v49.79 쨌 [P425/R162] _fetchTickerDataForChat 17 promise schema 蹂寃??댁꽦 遺??

- **臾몄젣**: Yahoo/SEC/Finnhub/Naver API ?묐떟 schema 蹂寃???silent crash ?먮뒗 遺遺??곗씠??silent 臾댁떆.
- **?쒖젙**: `_aioValidateFetchResult(result, requiredFields, sourceName)` ?좎꽕 ???꾩닔 ?꾨뱶 寃利?+ partial / invalid 遺꾨쪟. degrade 硫붿떆吏 ?앹꽦 ?ы띁.

## P424 쨌 v49.79 쨌 [P424/R161] saveChatEntry localStorage QuotaExceededError silent fail

- **臾몄젣**: 湲곗〈 `_saveChatHistory`??quota catch ?덉쑝??silent (?ъ슜???몄? 遺덇?). 50嫄?異뺤냼???ㅽ뙣 ????怨듦꺽??泥섎━ 遺??
- **?쒖젙**: 3?④퀎 prune (CHAT_HISTORY_MAX ??50 ??10) + 媛??④퀎 ?ъ슜??toast (6s / 10s / 15s) + API ??諛깆뾽 沅뚯옣 ?덈궡.

## P423 쨌 v49.79 쨌 [P423/R160] kr-macro hardcoded fedRate '3.50-3.75' + ?뺤쟻 ?쒖젏 ?좏겙 ?붿〈

- **臾몄젣**: Explore agent 吏꾨떒 ??kr-macro??hardcoded `fedRate '3.50-3.75'` + "2026.03 ?대? ?꾩웳" / "2026.04 JPM 由ы룷?? ?뺤쟻 ?쒖젏 ?좏겙. R150 ?꾨컲.
- **?쒖젙**: kr-macro context 吏꾩엯遺???듯빀 staleness 寃쎄퀬 異붽?. DATA_SNAPSHOT._updated 湲곗? N?????쒖떆. "2026.03/2026.04" ?쒖젏 遺꾩꽍? historical anchor 紐낆떆.

## P422 쨌 v49.79 쨌 [P422/R159] ticker / options _currentTickerId null + _liveData 誘몄닔??媛??遺??

- **臾몄젣**: ticker context??null guard ?덉쑝???ъ슜??移쒗솕 遺議?("?섏씠吏 吏꾩엯 ticker ?놁쓬"). _liveData 誘몄닔????HARD STOP 紐낆떆 遺?? options context?????쏀븿.
- **?쒖젙**: ticker context ??null ??移쒗솕 ?덈궡 (?덉떆 ticker) + _liveData 誘몄닔????"??紐⑤뱺 $ 媛寃??몄슜 湲덉? HARD STOP" 媛뺤젣. options context???숈씪 ?⑦꽩.

## P421 쨌 v49.78 쨌 [P421] AI 梨꾪똿 肄붾뱶 ?⑥쐞 ?뺣? 吏꾨떒 5 CRITICAL bug ?쇨큵 ?쒖젙

- **?ъ슜???뺤쭅 ?붽뎄**: "肄붾뱶?⑥쐞濡??ъ링 ?먭? 諛??몃? 議곗궗 吏꾪뻾?댁꽌 蹂닿컯"
- **Explore agent 2 蹂묐젹 吏꾨떒 寃곌낵** ??5 CRITICAL + 5 MEDIUM = 10 ?좎옱 silent fail 諛쒓껄.
- **v49.78 ?쒖젙**: C1~C4 利됱떆 ?닿껐 (?ㅼ젣 ?묐룞 fix, audit 異붽? 湲덉?).

## P420 쨌 v49.78 쨌 [P420] CHAT_CONTEXTS 18+ DOM 留ㅽ듃由?뒪 吏꾨떒 寃곌낵 ??16 contexts DOM 遺??

- **吏꾨떒 寃곌낵**: 18 contexts 횞 2 DOM留?(home / theme-detail). ?섎㉧吏 16 contexts??sidebar overlay ?⑤꼸 ?듯빐 ?묐룞 (蹂꾨룄 硫붿빱?덉쬁).
- **?좉퇋 諛쒓껄**: ticker / options 而⑦뀓?ㅽ듃??`_currentTickerId` null 媛??遺?? kr-macro hardcoded fedRate '3.50-3.75' R150 ?꾨컲.
- **?쒖젙 v49.79+**: ticker null guard + kr-macro ?숈쟻 fedRate 媛깆떊 (?쒓컙 遺議깆쑝濡?v49.78 誘명룷??.

## P419 쨌 v49.78 쨌 [P419/R158] chatSend state.streaming race condition ??60以? 嫄곕━ window

- **吏꾨떒**: 湲곗〈 `if (state.streaming) return;` (L4274) ~ `state.streaming = true;` (L4335) ?ъ씠 60以? ?숆린 肄붾뱶. 鍮좊Ⅸ ?붾툝 ?대┃ ?????붿껌 ?숈떆 吏꾩엯 媛??
- **?쒖젙**: `state._chatSendEntered` counter atomic lock ??寃利??듦낵 吏곹썑 利됱떆 lock. onDone/onError/chatClear?먯꽌 reset.
- **?щ컻 諛⑹?**: T615.

## P418 쨌 v49.78 쨌 [P418/R155] callClaude T.CHUNK_TIMEOUT ?뺤쓽 ?뺤씤 + 諛⑹뼱??fallback

- **Explore agent ?섏떖 ?ы빆 寃利?*: aio-core.js L13050??`T.CHUNK_TIMEOUT: 15000` ?뺤쓽 ?뺤씤 ???ㅼ젣濡쒕뒗 false positive.
- **?쒖젙**: 諛⑹뼱??fallback `typeof T !== 'undefined' && T && T.CHUNK_TIMEOUT ? T.CHUNK_TIMEOUT : 15000` ??module 濡쒕뱶 race condition ???덉쟾.

## P417 쨌 v49.78 쨌 [P417/R157] aiBubble null + _aioSafeMD undefined ??silent render fail + XSS ?꾪뿕

- **吏꾨떒**: `chatAppendMsg` null 諛섑솚 ???몄텧泥?L4595 `if (aiBubble)` 媛???덉쑝???ъ슜?먯뿉寃??뚮┝ ?놁쓬 (silent). `_aioSafeMD` undefined ??`innerHTML = null + 'cursor'` ??"null<span>" ?뚮뜑 + XSS ?고쉶.
- **?쒖젙**: (a) aiBubble null ??console.warn + toast "?묐떟 ?뚮뜑 ?곸뿭 遺?? ?덈궡. (b) `_aioSafeMD` 3?④퀎 fallback chain (`_aioSafeMD` ??`escHtml` ??manual escape).
- **?щ컻 諛⑹?**: T613.

## P416 쨌 v49.78 쨌 [P416] chatAppendMsg null guard ?쇨???寃利???紐⑤뱺 ?몄텧泥??덉쟾

- **吏꾨떒**: chatSend ?대? 紐⑤뱺 `aiBubble.innerHTML` ?몄텧 (L4596 / L4970 / L4971)??`if (aiBubble)` 媛???대? 議댁옱 (false alarm ?쇰?).
- **?쒖젙**: aiBubble null ???ъ슜??alert 異붽? (P417怨??듯빀).

## P415 쨌 v49.78 쨌 [P415/R156] dynamicTickerLookup sequential 5 proxy ??理쒖븙 80珥?hang

- **?뵶 CRITICAL ??NVDA ?쒖꽭 ?ㅽ뙣??吏꾩쭨 ?먯씤**: v49.76源뚯? `for (var i = 0; i < proxies.length; i++) { while (_retry < 2) await fetchWithTimeout(...8000) }` = 5 횞 8s 횞 2 = 理쒖븙 80珥?sequential hang.
- **?쒖젙**: `Promise.any` 蹂묐젹 race + `Promise.any` polyfill (援ы삎 釉뚮씪?곗?). 媛?proxy 3.5s timeout. 理쒖븙 3.5珥???寃곌낵 寃곗젙. 泥??깃났 利됱떆 諛섑솚.
- **?ъ슜???곹뼢**: NVDA 梨꾪똿 ?듬? 8珥? 臾댁쓳?????섍컖 李⑤떒 洹쒖튃 ?몃━嫄????숈뒿 ?곗씠???몄슜 ?듬?. ?쒖꽭 fetch 4珥덈줈 ?⑥텞 ????_liveData 梨꾩썙吏????뺤긽 ?듬?.
- **?щ컻 諛⑹?**: T611 + R156 (sequential proxy chain 湲덉?).

## P414 쨌 v49.77 쨌 [P414] AI 梨꾪똿 吏꾩엯~?듬?~?뚮뜑 chain??silent fail 13 ?곸뿭 ?뺤쭅 留ㅽ븨

- **?ъ슜???뺤쭅 吏덉쓽**: "AI 梨꾪똿/?듬?怨?愿?⑦빐???꾩껜 ?쒖뒪???ъ링 ?먭??쒓굅??"
- **?뺤쭅 ?묐떟**: ?꾨땲?? audit ?⑥닔留??섎━怨??ㅼ젣 ?쇱씠釉?寃利앹? ?ъ슜??1?뚮퓧. 13 誘몄젏寃 ?곸뿭 留ㅽ븨.
- **v49.77 ?쒖젙 5 critical**: chatSend silent return 5+ / callClaude 移쒗솕 ?덈궡 / ?듬? ?≪뀡 踰꾪듉 / ?섍컖 ???ъ슂泥?/ ?곗씠????諛곕꼫.

## P413 쨌 v49.77 쨌 [P413/R155] ?곗씠????/ ?섍컖 寃異????듬? ???≪뀡 踰꾪듉 遺??

- **臾몄젣**: ?듬? 蹂몃Ц??"?ㅼ떆媛??쒖꽭 誘몄닔?? ?덈궡 ?덉뼱???ъ슜?먭? ?ㅼ쓬 ?≪뀡 (?덈줈怨좎묠/?ъ쭏臾? ?뚭린 ?대젮?.
- **?쒖젙**: ?듬? ??amber 諛곕꼫 + ?봽 ?덈줈怨좎묠 + ?봺 ?ъ쭏臾?踰꾪듉 ?먮룞 ?쎌엯 (?쒖꽭/?щТ ????+ ?섍컖 self-confess ??.
- **?щ컻 諛⑹?**: R155.

## P412 쨌 v49.77 쨌 [P412/R155] ?섍컖 寃異????⑥닚 寃쎄퀬 ??利됱떆 ?ъ슂泥?UX 異붽?

- **臾몄젣**: v49.74 P397?먯꽌 ?섍컖 寃쎄퀬 諛뺤뒪 異붽??덉쑝???ъ슜?먭? ?듬? ?좊ː???껋? ?곹솴?먯꽌 ?ㅼ쓬 ?≪뀡 紐낆떆 遺??
- **?쒖젙**: ?섍컖 寃쎄퀬 諛뺤뒪 ?대????봽 ?쒖꽭 ?덈줈怨좎묠 + ?봺 ?곗씠??諛쏄퀬 ?ъ쭏臾?踰꾪듉 異붽?.
- **?щ컻 諛⑹?**: R155.

## P411 쨌 v49.77 쨌 [P411/R154] callClaude 理쒖쥌 ?ㅽ뙣 ???ъ슜??friendly ?덈궡 遺??

- **臾몄젣**: ?ъ떆??(v46.6) ??理쒖쥌 ?ㅽ뙣 ??raw ?먮윭 硫붿떆吏留??쒖떆 ???ъ슜?먭? 臾댁뾿???댁빞 ?좎? 紐⑤쫫.
- **?쒖젙**: ?먮윭 遺꾨쪟 (401/429/500/network/other) 蹂?移쒗솕 ?덈궡 + 沅뚯옣 議곗튂 ul + ?몃? 留곹겕 + 肄섏넄 紐낅졊 + ?몃씪???≪뀡 踰꾪듉 (?ъ떆???덈줈怨좎묠).
- **?щ컻 諛⑹?**: R154.

## P410 쨌 v49.77 쨌 [P410/R153] chatSend silent return 5+ 寃쎈줈 ?ъ슜???쇰뱶諛?遺??

- **臾몄젣**: `if (!ctx) return;` / `if (state.streaming) return;` / `if (!inp) return;` / `if (!q) return;` 紐⑤몢 silent ???ъ슜?먭? "?????섏??" 醫뚯젅.
- **?쒖젙**: 媛?early return??toast ?뚮┝ (3~6珥? ?먮뒗 input border 媛뺤“ (鍮??낅젰). console.warn 濡쒓퉭 異붽? ??媛쒕컻???붾쾭源?
- **?щ컻 諛⑹?**: R153.

## P409 쨌 v49.76 쨌 [P409] kr-supply 而⑦뀓?ㅽ듃 ?뺤씤 ??aio-chat.js L1121 ?대? ?뺤쓽??

- ?ъ슜??諛쒓껄 v49.74 audit ?섏떖 ?ы빆 ?뺤씤 ??`kr-supply` CHAT_CONTEXTS??`aio-chat.js` 踰좎씠???뺤쓽???대? 議댁옱 (L1121). assertChatAnswerQualityAudit??11 ?섏씠吏 ?됯????뺤긽 ?ы븿.

## P408 쨌 v49.76 쨌 [P408] AIO.diagnose() ?듯빀 吏꾨떒 紐낅졊 ?좎꽕 ???ъ슜??醫뚯젅 ?쒖젙

- **臾몄젣**: ?ъ슜?먭? 肄섏넄?먯꽌 吏꾨떒?섎젮硫?5媛? 紐낅졊 ?낅젰 ?꾩슂. ?듬떟???꾩쟻.
- **?쒖젙**: `AIO.diagnose(ticker)` ?좎꽕 ??1以꾨줈 7媛?吏꾨떒 ??ぉ ?먮룞 ?ㅽ뻾 + console??媛?쒗솕 + report 媛앹껜 諛섑솚 + 沅뚯옣 議곗튂 ?먮룞 異쒕젰.
- 7 ??ぉ: ?쒖꽭 fetch / _liveData ?곹깭 / ?쒖꽭 fetch 嫄닿컯??/ CHAT_CONTEXTS DOM 留ㅽ듃由?뒪 / 梨꾪똿 ?⑥닔 ?듯빀 / ?듬? ?덉쭏 / home 梨꾪똿 DOM.

## P407 쨌 v49.76 쨌 [P407/R152] 紐⑤컮??梨꾪똿 ?덉씠?꾩썐 100vw 鍮꾩쑉 誘몄떆??

- **臾몄젣 (?ъ슜??醫뚯젅 諛쒓껄)**: "?듬? ?붾㈃ 鍮꾩쑉?대옉 ?덉씠?꾩썐????留욎븘". `.acp-bubble` / `.aio-chat` 紐⑤컮??max-width unset ???듬? 蹂몃Ц 醫곴퀬 chip wrap 遺?곸젅.
- **?쒖젙**: 紐⑤컮??誘몃뵒??荑쇰━ 異붽? ??`.aio-chat` 100vw / `.acp-bubble` max-width: calc(100vw - 80px) / `.acp-chips` flex-wrap + ?고듃 11px / `.acp-bubble pre` overflow-x 紐낆떆.
- **?щ컻 諛⑹?**: R152.

## P406 쨌 v49.76 쨌 [P406/R151] ?쒖꽭 ????媛寃??섍컖 媛뺤젣 李⑤떒 誘명씉

- **臾몄젣 (?ъ슜??醫뚯젅 諛쒓껄)**: AI ?듬???"$400~500?", "$268.03" ???쒖꽭 ???곹깭?먯꽌 媛寃??섏튂 ?깆옣. v49.74 R145 + ABSOLUTE RULES 17議??덉뼱??AI媛 follow-up 遺꾩꽍?먯꽌 媛寃??ъ슜.
- **?쒖젙**: chatSend `_dataVerify`??`_liveStatusCS.indexOf('誘몄닔??) >= 0` 寃異????슚 HARD STOP 7 議고빆 媛뺤젣 二쇱엯 ??紐⑤뱺 媛寃??섏튂 ?덈? 湲덉? + ?щ컮瑜??듬? ?뺤떇 紐낆떆.
- **?щ컻 諛⑹?**: R151.

## P405 쨌 v49.76 쨌 [P405] dynamicTickerLookup proxy 5媛?+ 吏꾨떒 濡쒓퉭 媛뺥솕

- **臾몄젣 (?ъ슜??醫뚯젅 諛쒓껄)**: NVDA ?쒖꽭 fetch ?ㅽ뙣. 3 proxy (corsproxy/allorigins/codetabs)媛 1~2媛??ㅼ슫 ??silent fail.
- **?쒖젙**: (a) 5 proxy ?뺤옣 (codetabs 1?쒖쐞 + allorigins + corsproxy + thingproxy + cors-sh) (b) timeout 12s ??8s (?ㅼ쓬 proxy 鍮좊Ⅴ寃? (c) `window._aioTickerLookupDiag[ticker]` 吏꾨떒 濡쒓퉭 (媛?proxy attempt + retry + duration) (d) 紐⑤뱺 proxy ?ㅽ뙣 ??console.warn 紐낆떆.
- **?щ컻 諛⑹?**: AIO.diagnose(ticker)濡?利됱떆 吏꾨떒 媛??

## P404 쨌 v49.75 쨌 [P404] 4 critical ?⑦꽩 ?쇰컲????"鍮꾩듂???⑦꽩 紐⑤몢 ?ъ링 ?먭??대킄" ?묐떟

- **?ъ슜???뺤쭅 ?붽뎄 ?묐떟**: v49.74 hotfix 4 critical 諛쒓껄???⑦꽩????11媛? ?좎옱 ?꾪뿕 留ㅽ븨.
- **?쒖젙**: R147~R150 4 ?좉퇋 洹쒖튃 + 4 ?좉퇋 audit ?⑥닔 + chatSend ?꾩쿂由??듯빀.
- Pattern A ??R147 (DOM 留ㅽ듃由?뒪) / Pattern B ??R148 (?듬? ?꾩쿂由? / Pattern C ??R149 (fetch surfacing) / Pattern D ??R150 (?쒖젏 ?꾩텧).

## P403 쨌 v49.75 쨌 [P403/R150] AI ?듬? ?좎쭨 ?좏겙 stale ?먮룞 寃異?遺??(Pattern D)

- **臾몄젣**: ?ъ슜??諛쒓껄 ??AI ?듬???"5/22" / "4/15" ???숈뒿 ?쒖젏 ?좎쭨 洹몃?濡??몄텧. v49.73 stale token audit??system prompt ?대?留?寃利?
- **?쒖젙**: `getChatHallucinationAudit`??`stale-md-date` (?ㅻ뒛怨?7?? ?닿꺽 M/D) + `stale-iso-date` (YYYY-MM-DD) regex 異붽?.
- **?щ컻 諛⑹?**: T593.

## P402 쨌 v49.75 쨌 [P402/R149] ?몃? fetch ?ㅽ뙣 surfacing audit 遺??(Pattern C)

- **臾몄젣**: ?ъ슜??諛쒓껄 ??NVDA Yahoo fetch ?ㅽ뙣 silent. dynamicTickerLookup 4?④퀎 ?대갚 (v49.67) ?덉뼱???ㅽ뙣 ???ъ슜??紐낆떆 ?뚮┝ ?쏀븿.
- **?쒖젙**: `AIO.assertFetchFailureSurfacingAudit()` ?좎꽕 ??17 promise 횞 ?ㅽ뙣 surfacing ?먮룞 吏꾨떒.
- **?щ컻 諛⑹?**: T592.

## P401 쨌 v49.75 쨌 [P401/R148] ABSOLUTE RULES ?듬? ?꾩쿂由?寃利?遺??(Pattern B)

- **臾몄젣**: R140 ?뺤꽦?믪젙??/ R141 ?쒖? 4 援ъ“ / R142 異쒖쿂 愿꾪샇 ??system prompt?먮쭔 ?뺤쓽?섍퀬 ?ㅼ젣 ?듬? ?곸슜 ?먮룞 寃利?遺??
- **?쒖젙**: `AIO.assertChatAnswerStructureAudit(responseText)` ?좎꽕 ??4 rule ?꾨컲 ?먮룞 寃異? chatSend ?묐떟 ?꾩쿂由??듯빀 ??violations 寃異????듬? ??amber 諛곗?.
- **?щ컻 諛⑹?**: T590 + T591 + T594.

## P400 쨌 v49.75 쨌 [P400/R147] CHAT_CONTEXTS DOM 留ㅽ듃由?뒪 audit 遺??(Pattern A)

- **臾몄젣**: v49.74 P398 home 耳?댁뒪 ?쇰컲????18+ context 以?inline panel DOM ?덈뒗 寃?2媛쒕쭔 (theme-detail / home). 14+ context??DOM 遺?щ줈 chatSend silent return ?꾪뿕.
- **?쒖젙**: `AIO.assertChatPanelDomAudit()` ?좎꽕 ??紐⑤뱺 ctxId 횞 DOM 4?붿냼 (panel/msgs/inp/btn) ?먮룞 吏꾨떒. `CONTEXT_NO_DOM` gap ?쒖떆.
- **?щ컻 諛⑹?**: T589.

## P399 쨌 v49.75 쨌 [P399] 4 critical ?⑦꽩 ?뺤쭅 留ㅽ븨 + ?쇰컲??(?ъ슜???뺤쭅 ?붽뎄 ?묐떟)

- ?ъ슜??"鍮꾩듂???⑦꽩 紐⑤몢 ?ъ링 ?먭??대킄" ??4 critical ?⑦꽩 ?쇰컲??吏꾨떒.
- Pattern A (CHAT_CONTEXTS DOM 遺?? / Pattern B (Audit ?뺤쓽 ???곸슜) / Pattern C (Fetch silent fail) / Pattern D (Stale token ?듬? ?꾩텧).
- 媛??⑦꽩 蹂?audit ?⑥닔 + R 洹쒖튃 + ?뚭? ?뚯뒪??

## P398 쨌 v49.74 hotfix 쨌 [P398/R146] home ?섏씠吏 梨꾪똿 UI DOM 遺????CHAT_CONTEXTS留??깅줉?섍퀬 ?⑤꼸 誘몄꽕移?

- **臾몄젣 (?ъ슜???쇱씠釉?寃利?諛쒓껄)**: "Home?먯꽌??AI 梨꾪똿 ?섏????딆븘". v49.73?먯꽌 `window.CHAT_CONTEXTS['home']` 異붽??덉쑝??`#page-home`??`<div class="aio-chat" id="chat-home">` DOM 誘몄꽕移???`chatSend('home')`??input `chat-home-inp` 紐?李얠븘 silent return.
- **?쒖젙**: `#page-home` ??(L4428 吏곸쟾)??theme-detail ?⑦꽩 誘몃윭 ?몃씪??梨꾪똿 ?⑤꼸 異붽? (acp-header/messages/chips/input/btn 5?붿냼). chips 3媛?(?ㅻ뒛 ?쒖옣 ?섍꼍 ?붿빟 / 吏湲?萸먮???遊먯빞 / 珥덈낫???쒖옉 媛?대뱶).
- **?щ컻 諛⑹?**: R146 ?좉퇋 ??CHAT_CONTEXTS ?깅줉留뚯쑝濡?遺議? DOM ?몃씪???⑤꼸 ?섎Т.

## P397 쨌 v49.74 hotfix 쨌 [P397/R145] AI ?듬? ?숈뒿 ?곗씠???먭린 ?몄슜 ?덈? 李⑤떒 媛뺥솕

- **臾몄젣 (?ъ슜???쇱씠釉?寃利?諛쒓껄)**: AI ?듬???"2025??珥??숈뒿 ?곗씠??湲곗??쇰줈 NVDA??$400~500?" ?깆옣. ABSOLUTE RULES 5議?("?숈뒿 ?곗씠???ъ슜 湲덉?")???덉쑝???먭린 ?섍컖 ?먮갚 ?쒗쁽 / ?숈뒿 ?쒖젏 ?곕룄 / 異붿륫 媛寃?踰붿쐞 ?먮룞 李⑤떒 遺??
- **?쒖젙**: (a) ABSOLUTE RULES 17議??좉퇋 ??湲덉? ?쒗쁽 4 移댄뀒怨좊━ 紐낆떆 (?먭린 ?섍컖 ?먮갚/?숈뒿 ?곕룄/異붿륫 媛寃?異붿륫 ?댁뒪). ?쒖꽭 ?곗씠??????紐⑤뱺 媛寃??섏튂 ?덈? 湲덉?. (b) `getChatHallucinationAudit` ?⑦꽩 3媛?異붽? ??`self-confess-training-data` (+5??critical), `training-year-citation`, `vague-price-range`. `requiresWarningBox` ?뚮옒洹? (c) chatSend ?묐떟 ?뚮뜑??self-confess 寃異????듬? ?꾩뿉 媛뺤젣 鍮④컙 寃쎄퀬 諛뺤뒪 ?쒖떆 + 寃異??⑦꽩 + 沅뚯옣 議곗튂 紐낆떆.
- **?щ컻 諛⑹?**: ?쒓컖???ъ슜??寃쎄퀬 + ABSOLUTE RULES 17議?+ audit ?⑦꽩 媛뺥솕.

## P396 쨌 v49.74 쨌 [P396] ?쇱씠釉?寃利??섍꼍 ?쒖빟 ???ъ슜??production 吏곸젒 寃利?媛?대뱶 (?뺤쭅)

- **臾몄젣**: MCP preview ?쒕쾭媛 ?ㅻⅨ ?뚰겕?몃━(distracted-ramanujan-28118e, v49.55) 諛붿씤????v49.73 ?쇱씠釉?寃利?遺덇?. ?먮룞 紐⑤뱶 ?덉쟾?μ튂媛 (a) ?ㅻⅨ ?뚰겕?몃━ ?뚯씪 泥댄겕?꾩썐 (b) 蹂묐젹 ?ы듃 ?쒕쾭 ?쒖옉 李⑤떒.
- **?쒖젙**: ?ъ슜??吏곸젒 production (https://ysnle.github.io/aio-screener/) 寃利?媛?대뱶 ?쒓났 ??7 ?섏씠吏 횞 3 吏덈Ц = 21 吏덉쓽 + ?됯? 泥댄겕由ъ뒪??(?꾩옱???뺥솗??吏곴????뺤꽦?믪젙??. ?ъ슜???듬? 怨듭쑀 ??v49.75?먯꽌 諛쒓껄 媛??쒖젙 ?덉젙.
- **?щ컻 諛⑹?**: T588 ???쇱씠釉?寃利?媛?대뱶 ?덈궡 (?뚭? 寃利??꾨땶 ?ъ슜???덈궡).

## P395 쨌 v49.74 쨌 [P395/R144] AI 梨꾪똿 硫?고꽩 ?좏겙 ?꾩쟻 ?뺤콉 遺????v46.6 char-trim ?⑤룆 ???섍컖 ?꾩쟻 ?꾪뿕

- **臾몄젣**: v46.6 char-limit 60K trim留?議댁옱 ??10?? ??????댁쟾 ?섍컖???좉퇋 ?듬????꾩쟻 媛?? Turn-count cap 遺??/ ?붿빟 prepend 遺??
- **?쒖젙**: chatSend??(a) turn-cap 24 異붽? (b) 8媛? ?쒓굅 ???ъ슜??二쇱슂 吏덈Ц 5媛?異붿텧 ???붿빟 user 硫붿떆吏 + ?댁떆?ㅽ꽩???뺤씤 硫붿떆吏 ?먮룞 prepend (c) `window._chatMultiTurnStats` { trimEvents, summaryInsertions, maxTurnsBeforeTrim } 異붿쟻.
- **?щ컻 諛⑹?**: T582 + T583 + T585.

## P394 쨌 v49.74 쨌 [P394] AI 梨꾪똿 ?쒖뒪???붿〈 媛?11媛??뺤쭅 留ㅽ븨 (?ъ슜???뺤쭅 吏덉쓽 ?묐떟)

- **臾몄젣**: v49.73源뚯? 26 ?곸뿭 ?ㅻ쨾?쇰굹 ?ъ슜??"??議곗궗?섍굅???먭????곸뿭 ?놁뼱?" ?뺤쭅 吏덉쓽???붿쭅 ?듬?. 11媛??붿〈 媛?留ㅽ븨 (CRITICAL 2 + HIGH 4 + MEDIUM 3 + LOW 2).
- **?쒖젙**: v49.74 (CRITICAL 2 + HIGH 1 = 3) + v49.75 (HIGH 3 ?붿뿬 = ?듬? 罹먯떆/?섍컖 ?먮룞 媛먯? 媛뺥솕/?쇰뱶諛??듦퀎). 2?④퀎 遺꾪븷.
- **?щ컻 諛⑹?**: ?쇱씠釉?寃利?+ 硫?고꽩 ?뺤콉 + KR audit ?뺤옣 ?듯빀.

## P393 쨌 v49.74 쨌 [P393/R143] AI ?듬? ?덉쭏 audit媛 KR 4 ?섏씠吏 (kr-macro/supply/themes/tech) ?됯? ?꾨씫

- **臾몄젣**: v49.73 `assertChatAnswerQualityAudit`??7 ?섏씠吏留?(home/technical/macro/sentiment/breadth/fundamental/portfolio) ?됯? ??KR ?ъ슜??泥닿컧 媛?(?쒓뎅 ?쒖옣 ?듬? ?덉쭏 ??됯?).
- **?쒖젙**: ctxIds 諛곗뿴??7 ??11濡??뺤옣 (kr-macro/kr-supply/kr-themes/kr-tech 4 異붽?). freshnessScore 怨꾩궛??遺꾨え 7 ??11.
- **?щ컻 諛⑹?**: T581 (`perPageDetail.length === 11` + KR 4 ID 紐⑤몢 ?ы븿) + T586 (遺꾨え 11 寃利?.

## P392 쨌 v49.73 쨌 [P392/R140~R142] AI 梨꾪똿 ?듬? ?덉쭏 3異??먮룞 吏꾨떒 audit + ?ъ씠?쒕컮 13異?

- **?쒖젙**: `AIO.assertChatAnswerQualityAudit()` ?좎꽕 ???꾩옱???몄뀡 ?ㅻ뜑+?숈쟻 留덉빱 ?ы띁+stale ?좏겙)/?뺥솗??fetched ?ㅼ썙??source ?쇰꺼+_aioFetchLabel)/吏곴???R140~R142+home 而⑦뀓?ㅽ듃) 3 移댄뀒怨좊━ ?먮룞 吏꾨떒 + overallScore ?곗텧. ?ъ씠?쒕컮 audit row 13踰덉㎏ (`answerQuality`) ??"?뱥 ?듬? ?덉쭏 X??쨌 ?꾩옱 X 쨌 ?뺥솗 X 쨌 吏곴? X".
- **?щ컻 諛⑹?**: T577 (audit shape) + T578 (overallScore ??70) + T579 (?ъ씠?쒕컮 row DOM).

## P391 쨌 v49.73 쨌 [P391/R140~R142] home ?섏씠吏 CHAT_CONTEXTS 遺????signal default fallback ?숈뒿 ?곗씠???섏〈

- **臾몄젣**: ?ъ슜?먭? 媛??癒쇱? 吏꾩엯?섎뒗 `home` ?섏씠吏??CHAT_CONTEXTS 蹂꾨룄 ?뺤쓽 ?놁쓬 ??梨꾪똿 ??signal default濡??대갚?섏뼱 ?쒖옣 ?섍꼍/?섏씠吏 ?덈궡 而⑦뀓?ㅽ듃 遺??
- **?쒖젙**: `window.CHAT_CONTEXTS['home']` override ?좎꽕 (`index.html` L17681 遺洹?. 5 移댄뀒怨좊━ ?ъ슜???섎룄 ?먮룞 遺꾨쪟 + 媛??섏씠吏 ?덈궡 (?쒓렇???щ━/留ㅽ겕濡?醫낅ぉ/?ы듃?대━?? + ?쒖옣 ?섍꼍 醫낇빀 (SPX/VIX/F&G/?ㅼ퐫???뺣웾) + ?쒖? ?듬? 援ъ“ (4 釉붾줉) + 湲곌?湲??꾨젅?꾩썙??+ V48 而⑦뀓?ㅽ듃 + ABSOLUTE RULES 14~16議?
- **?щ컻 諛⑹?**: T576 ??`CHAT_CONTEXTS['home']` ?뺤쓽 + system() "AIO Screener ?? + "?듬? 媛?대뱶" 寃利?

## P390 쨌 v49.73 쨌 [P390/R140~R142] ABSOLUTE RULES 14~16議?(?뺤꽦?믪젙???섎Т / ?쒖? ?듬? 援ъ“ / 異쒖쿂 愿꾪샇) 遺??

- **臾몄젣**: AI ?듬???"?믪? 蹂?숈꽦" / "媛뺤꽭?? ???뺤꽦 ?쒗쁽???뺣웾 洹쇨굅 ?놁씠 ?ъ슜?섍굅?? ?듬? 援ъ“媛 ?먯쑀 ?뺤떇?쇰줈 ?먰듃?ъ졇 ?ъ슜??吏곴?????? v49.68 R128 (12議???"異쒖쿂+湲곗??? 媛?대뱶???덉쑝???먮룞 媛뺤젣 遺??
- **?쒖젙**: `_getChatRules()` ?앹뿉 14議?(R140 ?뺤꽦?믪젙???숇컲) + 15議?(R141 ?쒖? 4 援ъ“: 寃곕줎/?뺣웾/?쒕굹由ъ삤/?≪뀡) + 16議?(R142 紐⑤뱺 ?뺣웾 ?몄슜??異쒖쿂 愿꾪샇 ?꾩닔) 異붽?.
- **?щ컻 諛⑹?**: T575 ??`_getChatRules()` 諛섑솚??"14議??뺤꽦 ?쒗쁽" + "15議??쒖? ?듬? 援ъ“" + "16議?異쒖쿂 + 湲곗??? 3 ?ㅼ썙??紐⑤몢 ?ы븿.

## P389 쨌 v49.73 쨌 [P389/R142] ?곗씠??釉붾줉 16 ?쇰꺼 fetched ?쒓컖 쨌 source 紐낆떆 遺議?

- **臾몄젣**: `_fetchTickerDataForChat`??16+ ?곗씠??釉붾줉 ?쇰꺼 ([SEC 10-K] / [Wikipedia] / [News] ????異쒖쿂???쇰? ?덉쑝??fetched ?쒓컖???꾨씫?섏뼱 AI ?듬??먯꽌 "?몄젣 媛?몄삩 ?곗씠?? 異붿쟻 遺덇?. ?ъ슜?먭? "??媛寃??대뵒??" 吏덈Ц ???듬? 遺덇?.
- **?쒖젙**: `_aioFetchLabel(name, source, ts)` ?ы띁 ?좎꽕 (R142 ?쒖? 異쒕젰 `[name 쨌 fetched YYYY-MM-DD HH:MM KST 쨌 source]`). 醫낅ぉ蹂??곗씠??釉붾줉 吏꾩엯遺??"?곣봺?곣봺??[TICKER ?곗씠??釉붾줉 쨌 ?쇨큵 fetched X KST] ?곣봺?곣봺?? ?ㅻ뜑 異붽?. 5 二쇱슂 ?쇰꺼 (SEC 10-K / Wikipedia / SEC 8-K / News / Insider / Risk Factors)??"source X" 紐낆떆.
- **?щ컻 諛⑹?**: T573 (?ы띁 ?뺤쓽) + T574 (?ㅻ뜑 + source ?쇰꺼 寃利?.

## P388 쨌 v49.73 쨌 [P388/R140] ?몄뀡 ?쒓컖 ?먮룞 ?몄? ?ㅻ뜑 遺????AI ?듬? "?꾩옱" ?쒖젏 ?섍컖

- **臾몄젣**: AI 梨꾪똿 system ?꾨＼?꾪듃???몄뀡 ?쒓컖 紐낆떆 遺????AI媛 ?숈뒿 ?곗씠???쒖젏 ("2024??珥?/"?ы빐 4??)???꾩옱濡?李⑷컖?섏뿬 ?듬?. v49.67 ?쒖옣 ?섍꼍 ?ㅻ뜑??ticker ?듬??먮쭔 ?곸슜. `_getChatRules`???숈쟻 ?좎쭨 二쇱엯? ?덉쑝???곗씠???좎꽑??+ ?쒖젏 ?몄? 媛뺤젣 遺??
- **?쒖젙**: `_aioSessionContextHeader()` ?ы띁 ?좎꽕 ???먯꽭???쒓컖: YYYY-MM-DD HH:MM KST??+ ?먯떆???먮룞 ?몄?: ?ㅻ뒛? X??Y??Z??(?붿씪)??+ ?먮뜲?댄꽣 ?좎꽑?? _liveData N遺???/ DATA_SNAPSHOT 湲곗??쇈?3異??먮룞 prepend. `_getChatRules()` 吏꾩엯遺???듯빀 ??14 CHAT_CONTEXTS 紐⑤몢 ?먮룞 ?몄?. `_aioRelativeDate(target)` ?ы띁 ?숇컲 ???뺤쟻 ?좎쭨 ?좏겙 (?? "2026.04 FOMC") ???숈쟻 留덉빱 ("2026??4??(X????") 移섑솚 媛??
- **?щ컻 諛⑹?**: T571 (relativeDate) + T572 (sessionHeader).

## P387 쨌 v49.72 쨌 [P387/R138~R139] fundamental 7 李⑦듃 + 梨꾪똿 李⑦듃 蹂닿린 踰꾪듉 ?먮룞 吏꾨떒 audit + ?ъ씠?쒕컮 12異?

- **?쒖젙**: `AIO.assertFinancialChartsAudit()` ?좎꽕 ??5 ?⑥닔(fetchFMP5YQuarterly/fetchKRQuarterly/fetchQuarterlyFinancials/renderFn/showHandler) + 7 canvas DOM + 4 ?듯빀 寃利?+ 罹먯떆 stats. ?ъ씠?쒕컮 audit row 12踰덉㎏ (`financialCharts`) ??"?뱤 李⑦듃 X% 쨌 X/7 canvas 쨌 罹먯떆 X".
- **?щ컻 諛⑹?**: T568 (audit coveragePct ??80) + T569 (?ъ씠?쒕컮 row DOM).

## P386 쨌 v49.72 쨌 [P386/R139] AI 梨꾪똿 ?듬? ?쒓컖 ?먮즺 遺????inline chart ????섏씠吏 ?대룞 踰꾪듉 梨꾪깮

- **臾몄젣**: ?ъ슜??"AI 梨꾪똿?먯꽌 ?듬??????쒓컖???먮즺???앹꽦?댁꽌 媛숈씠 蹂댁뿬以????덉뼱? ?대?吏泥섎읆." 吏곸젒 吏덉쓽. Explore agent 吏꾨떒 寃곌낵 inline mini-chart??湲곗닠?곸쑝濡?媛?ν븯??(a) ?좏겙 鍮꾪슚??(b) 紐⑤컮???덉씠?꾩썐 蹂듭옟 (c) DOMPurify 寃뚯씠???듦낵 ?꾩슂.
- **?쒖젙**: `chatSend` ?묐떟 ?뚮뜑??`?뱤 [醫낅ぉ] ?щТ 李⑦듃 蹂닿린 ?? ?쒖븞??踰꾪듉 ?먮룞 ?쎌엯 (detectedTickers ?쒗쉶). ?대┃ ??`_aioShowFundamentalChart(ticker)` ??fundamental ?섏씠吏 ?대룞 + ?먮룞 寃??+ 7 李⑦듃 ?꾩껜 ?뚮뜑 + 遺?쒕윭???ㅽ겕濡?
- **?μ젏 vs inline chart**: 7 ?뱀뀡 + 硫뷀듃由??뚯씠釉?full view + 紐⑤컮??1??諛섏쓳??+ 硫붾え由?leak 0 + ?좏겙 ?덉빟.
- **?щ컻 諛⑹?**: T567 ??chatSend source??`_aioShowFundamentalChart` + `aio-financial-chart-btn` class 紐⑤몢 寃利?

## P385 쨌 v49.72 쨌 [P385/R138] KR (.KS/.KQ) 醫낅ぉ 遺꾧린 ?щТ Naver ?ㅽ겕?섑븨 fallback 遺??

- **臾몄젣**: FMP 臾대즺 ?곗뼱媛 KR 醫낅ぉ 遺꾧린 ?щТ 誘몄?????KR 醫낅ぉ fundamental ?섏씠吏 寃????7 李⑦듃 placeholder留??쒖떆.
- **?쒖젙**: `AIO.fetchKRQuarterly(ticker)` ?좎꽕 ??`.KS/.KQ` ?뺢퇋??留ㅼ묶 ??`fetchNaverUSData(ticker, true).financials` ?몄텧, `quarterlyHistory` ?쒖???(income 諛곗뿴??遺꾧린 ?쒕━利?梨꾩썙 render ?⑥닔 ?명솚). ?⑥씪 遺꾧린留?媛?⑺빐??placeholder 李⑦듃 ?뚮뜑.
- **?щ컻 諛⑹?**: T562 ??`typeof AIO.fetchKRQuarterly === 'function'`.

## P384 쨌 v49.72 쨌 [P384/R138] FMP 5??遺꾧린 ?곗씠??fetch 誘멸뎄????fundamental ?섏씠吏 遺꾧린 1~2媛쒕쭔 ?쒖떆

- **臾몄젣**: 湲곗〈 `fundamentalSearch`??FMP `/income-statement?limit=5` (annual)留??몄텧 ??遺꾧린蹂??쒓퀎??誘몄〈?? DART Financials ?ㅽ???5遺꾧린 trend 李⑦듃 遺덇?.
- **?쒖젙**: `AIO.fetchFMP5YQuarterly(ticker)` ?좎꽕 ??4 endpoints (income-statement / balance-sheet-statement / cash-flow-statement / ratios) `period=quarter&limit=20` `Promise.allSettled` 蹂묐젹 fetch + 5遺?罹먯떆 (`_fmpQuarterlyCache` + LRU 50 醫낅ぉ cap). FMP key ?놁쑝硫?graceful `available:false` 諛섑솚.
- **?щ컻 諛⑹?**: T561 ??`typeof AIO.fetchFMP5YQuarterly === 'function'` + T565 7 canvas DOM 寃利?

## P383 쨌 v49.72 쨌 [P383/R138] fundamental ?섏씠吏 ?띿뒪?몃쭔 ??DART Financials ?ㅽ????쒓컖 李⑦듃 遺??

- **臾몄젣**: ?ъ슜??"湲곗뾽 遺꾩꽍 ?섏씠吏????뉕쾶 ?щТ?쒗몴 遺꾩꽍?댁＜??湲곕뒫??異붽??댁빞 ?섎굹?" ?대?吏 (koreantickers.com/DART Financials 7 ?뱀뀡 李⑦듃) 泥⑤? ?붿껌. 湲곗〈 fundamental ?섏씠吏??移대뱶/???꾩＜ ?쒓컖?붾줈 5??遺꾧린 trend ?쒕늿??紐?遊?
- **?쒖젙**: `#page-fundamental` "?щТ ?곸꽭" ??뿉 `#fundamental-financials-grid` 異붽? ??4x2 grid (Growth/Profitability/Balance/CashFlow/Liquidity+CurRatio Donut/WorkingCap/Valuation) + 媛?移대뱶 ?섎떒 5遺꾧린 metric ?뚯씠釉? Chart.js 7 instance (`_aioChartRegistry`???깅줉?섏뿬 ?섏씠吏 ?댄깉 ??硫붾え由?leak 0). 紐⑤컮??諛섏쓳??(4????2????1??.
- **?щ컻 諛⑹?**: T563/T564/T565 ??render ?⑥닔 + grid DOM + 7 canvas 紐⑤몢 寃利?

## P377 쨌 v49.70 쨌 [P377/R135] Codex 4/5李?吏곸젒 ?꾩닔 ?먯옣 + 濡쒕뵫 臾멸뎄 ?ㅻ낫媛?

- **臾몄젣**: 4/5李④? 媛먯궗 ?⑥닔 異붽???移섏슦移섎㈃ ?ㅼ젣 ?섏씠吏 ?띿뒪??踰꾪듉/?곗씠??諛붿씤???꾩닔 ?먭????앸궗?ㅺ퀬 ?ㅼ씤?????덉쓬.
- **吏곸젒 ?먭?**: `index.html` 21媛?`.page[id]`瑜??쒖꽌?濡??섎씪 ?띿뒪?몃웾, 踰꾪듉/?낅젰, `data-action`, `data-on-*`, live/snap ?곗씠???깊겕, 異쒖쿂/?댁쁺 留덉빱, ??李⑦듃/?ㅻ챸, ?좎쭨???좏겙, 珥덇린 濡쒕뵫 臾멸뎄瑜??섏씠吏蹂??먯옣?쇰줈 異붿텧. `data-action` 127媛쒖? ?낅젰 諛붿씤??19媛쒕뒗 紐⑤몢 ?몃뱾??議댁옱 ?뺤씤. 以묐났 ID/鍮?踰꾪듉/?대?吏 alt/李⑦듃 ?쇰꺼/?섏걶 珥덇린 臾멸뎄??0嫄??뺤씤.
- **?쒖젙**: `target="_blank"` ?몃? 留곹겕 7媛?rel 蹂닿컯, ?쇰꺼 ?쏀븳 input 3媛?aria/placeholder 蹂닿컯, 珥덇린/?숈쟻 ?ъ슜??臾멸뎄??"濡쒕뵫/濡쒕뵫 ?ㅽ뙣/遺덈윭?ㅻ뒗 以???"?섏떊 ?湲??붿껌 以??섏떊 ?ㅽ뙣" 怨꾩뿴濡??뺢퇋?? `fxbond` 怨쇨굅 ??꾨씪?몄? `data-aio-archive="true"`濡?蹂닿? 肄섑뀗痢좎엫??紐낆떆. ?④? glossary 踰꾪듉??aria/title ?쇰꺼 異붽?.
- **?щ컻 諛⑹?**: `AIO.getFourthFifthPassAudit()` 異붽?. 4李⑤뒗 ?곗씠??吏꾩떎??異쒖쿂/理쒖떊??媛먯궗, 5李⑤뒗 湲곌?湲됀룹옄??理쒖떊?붋룹큹蹂댁옄 吏곴???3? 紐⑺몴瑜??섏씠吏蹂??먯닔?? `AIO.getTableAccessibilityAudit()` + `_aioApplyTableAccessibility()`濡?紐⑤뱺 ?쒖뿉 ?묎렐 媛?ν븳 ?대쫫/header semantics ?먮룞 蹂댁젙. Sidebar row, AutoOps, deployment gate, T551~T558???곌껐.

## P376 쨌 v49.70 쨌 [P376/R132~R134] AI 梨꾪똿 怨좉툒 湲곕뒫 ?먮룞 吏꾨떒 audit + ?ъ씠?쒕컮 10異?
- **?쒖젙**: `AIO.assertChatAdvancedFeaturesAudit()` ?좎꽕 (10 ?⑥닔 + 5 ?듯빀 + 5 API ?먮룞 吏꾨떒 + coveragePct 100%). ?ъ씠?쒕컮 audit row 10踰덉㎏ (chatAdvanced) ??"怨좉툒 湲곕뒫 X% 쨌 ?⑥닔 X/10 쨌 ?뵒X 쨌 ?뫀??.
- **?щ컻 諛⑹?**: T548 (audit 100%) + T549 (?ъ씠?쒕컮 row).

## P375 쨌 v49.70 쨌 [P375/R132~R134] AI 梨꾪똿 ?좉퇋 怨좉툒 湲곕뒫 ?듯빀 ?먮룞 ?뚭? 諛⑹? 遺??
- **臾몄젣**: v49.70 ?좉퇋 4 ?곸뿭 (?꾨줈???뚮엺/?ㅼ슫濡쒕뱶/?쒕??덉씠?? ?듯빀 ?뚭? ?먮룞 吏꾨떒 遺??
- **?쒖젙**: assertChatAdvancedFeaturesAudit + ?ъ씠?쒕컮 row ?듯빀 (P376怨??④퍡).

## P374 쨌 v49.70 쨌 [P374/R134] AI 梨꾪똿 湲덉븸/SPX % ?쒕굹由ъ삤 ?쒕??덉씠??遺??
- **臾몄젣**: v49.69源뚯? "1???ъ옄 ?? / "SPX -5%" ?먯뿰???섎룄 silent ???ъ슜???뺣웾 ?쒕??덉씠??遺덇?.
- **?쒖젙**: `_aioSimulateAmountOrPct(q, tickers)` ?좎꽕 ??湲덉븸 5 ?⑥쐞 (??泥쒕쭔/諛깅쭔/留?USD) + 吏??% ?묐갑??+ 3 ?먯궛 諛곕텇 (蹂댁닔??洹좏삎/怨듦꺽?? + ?쒕굹由ъ삤 ?곹뼢 (VIX/10Y/Gold/Sector/Position). Bridgewater All Weather + GS GIR + Ackman + Marks ?꾨젅???곸슜.
- **?щ컻 諛⑹?**: T546 (1??+ SPX -5% ?뺥솗 異붿궛).
- **?뚯씪**: `js/aio-chat.js` _aioSimulateAmountOrPct + chatSend chip ?쎌엯

## P373 쨌 v49.70 쨌 [P373/R134] AI 梨꾪똿 ?듬? ?곗씠???ㅼ슫濡쒕뱶 遺??
- **臾몄젣**: v49.69源뚯? ?ъ슜?먭? AI ?듬? ?몃? ?쒖슜 ???섎룞 蹂듭궗 ??遺덊렪 + ?곗씠???먯떎.
- **?쒖젙**: `_aioExportChatData(ctxId, fullText, tickers, format)` ?좎꽕 ??Markdown/JSON/CSV 3 format + ?쒖옣 ?ㅻ깄??+ 醫낅ぉ ?곗씠??+ AI ?묐떟 ?듯빀 + ?대┰蹂대뱶 ?대갚. chatSend ?묐떟 吏곹썑 ?ㅼ슫濡쒕뱶 踰꾪듉 (MD/JSON/CSV) ?먮룞 ?쎌엯. AIO.exportChatData 肄섏넄 API.
- **?щ컻 諛⑹?**: T545 (?⑥닔 ?뺤쓽).
- **?뚯씪**: `js/aio-chat.js` _aioExportChatData + _aioExportFromBtn + chatSend 踰꾪듉

## P372 쨌 v49.70 쨌 [P372/R133] AI 梨꾪똿 ?뚮엺/?꾧퀎媛??몃━嫄?遺??
- **臾몄젣**: v49.69源뚯? "VIX 30 ?꾨떖 ???뚮┝" / "NVDA $200" ?ъ슜???붿껌 silent ???섎룞 紐⑤땲?곕쭅.
- **?쒖젙**: `_aioParseAlertIntent(q)` ?먯뿰???섎룄 媛먯? (VIX/F&G/醫낅ぉ媛寃?횞 above/below 횞 ?쒓?+?곷Ц 4 蹂?? + `_aioAddAlert()` localStorage ?곸냽 + `_aioCheckAlerts()` 1遺꾨쭏???먮룞 ?먭? + 釉뚮씪?곗? Notification API. chatSend ?묐떟 吏곹썑 ?쒖븞??chip ?덈궡 + 沅뚰븳 ?붿껌. AIO.getAlerts/addAlert/removeAlert/checkAlerts 肄섏넄 API.
- **?щ컻 諛⑹?**: T543 (5 ?뚮엺 ?⑥닔) + T544 (?섎룄 ?뚯떛 ?뺥솗??.
- **?뚯씪**: `js/aio-chat.js` ?뚮엺 5?⑥닔 + chatSend chip ?쎌엯

## P371 쨌 v49.70 쨌 [P371/R132] AI 梨꾪똿 ?ъ슜???ъ옄 ?꾨줈??硫붾え由?遺??(媛쒖씤???듬? 遺덇?)
- **臾몄젣**: v49.69源뚯? 紐⑤뱺 ?ъ슜?먯뿉寃??숈씪 ?듬? ??蹂댁닔??怨듦꺽???ъ슜??援щ텇 ???? ?④린/?κ린 ?쒓컙異?臾댁떆.
- **?쒖젙**: `_aioGetUserProfile()`/`_aioSetUserProfile()` localStorage `aio_user_profile_v1` ?곸냽 (riskTolerance + timeHorizon + preferredAssets + excludedAssets). `_buildUserProfileContext()` system prompt ?앹꽦 (?대え吏 ?쒖? + ?쒓컙異??쇰꺼). `_getV48IntegratedContext` ?먮룞 ?몄텧 ??14 CHAT_CONTEXTS 紐⑤몢 ?듯빀. AIO.getUserProfile/setUserProfile 肄섏넄 API.
- **?щ컻 諛⑹?**: T541 (3 ?⑥닔) + T542 (v48 ?먮룞 ?듯빀).
- **?뚯씪**: `js/aio-chat.js` 3 ?꾨줈???⑥닔 + `index.html` _getV48IntegratedContext ?듯빀

## P370 쨌 v49.69 쨌 [P370/R129~R131] AI 梨꾪똿 ?명꽣?숉떚釉?湲곕뒫 ?먮룞 吏꾨떒 audit 遺??
- **臾몄젣**: v49.68源뚯? ?꾩냽 吏덈Ц/?먮룞 ?섏씠吏 ?대룞/?쒕??덉씠??fuzzy 留ㅼ묶 ???명꽣?숉떚釉?湲곕뒫 ?듯빀 ?щ? ?먮룞 寃利?audit ?놁쓬. ?좉퇋 湲곕뒫 異붽? ???듯빀 ?꾨씫 silent.
- **?쒖젙 (v49.69)**: `AIO.assertChatInteractivityAudit()` ?좎꽕 (`js/aio-core.js`) ??6 ?⑥닔 ?뺤쓽 + 5 chatSend ?듯빀 ?먮룞 ?먭? + coveragePct 100% 寃利? ?ъ씠?쒕컮 audit row 9踰덉㎏ (`chatInteractivity`) "?명꽣?숉떚釉?X% 쨌 ?⑥닔 X/6 쨌 ?듯빀 X/5" ?됱긽 ?쒖떆.
- **?щ컻 諛⑹?**: T537~T538 ?쇱씠釉?DOM ?뚭?.
- **?뚯씪**: `js/aio-core.js` assertChatInteractivityAudit + ?ъ씠?쒕컮 ciaEl 遺꾧린

## P369 쨌 v49.69 쨌 [P369/R131] AI 梨꾪똿 ?쎌뼱/蹂꾨챸 fuzzy 留ㅼ묶 遺??("?붾퉬"/"?쇱쟾" ?몄떇 ?ㅽ뙣)
- **臾몄젣**: v49.68源뚯? `_extractTickers`媛 ?쒓? ?쎌뼱/蹂꾨챸 (?붾퉬/?쇱쟾/?뚯뒳???좉?/?꾩븞 ?? silent 誘멸컧吏 ??ticker 0嫄???醫낅ぉ 遺꾩꽍 fetch 誘몄떎????"?곗씠??誘몄닔?? silent fail. ?ъ슜??吏꾩엯?λ꼍 ??
- **?쒖젙 (v49.69)**: `_resolveTickerFromFuzzy(input)` ?좎꽕 ??50+ ?쎌뼱/蹂꾨챸 留ㅽ븨 (?붾퉬?묿VDA / ?쇱쟾??05930.KS / ?뚯뒳?쇄넂TSLA / 移댁뭅?ㅲ넂035720.KS / 鍮꾪듃肄붿씤?묪TC-USD / ?좉??묬L=F / 肄붿뒪?쇄넂^KS11 ??. ?뺥솗 留ㅼ묶 + 遺遺?留ㅼ묶 (?묐갑??. `_extractTickers` 0嫄댁씪 ??chatSend?먯꽌 怨듬갚/議곗궗 ?좏겙?????먮룞 fallback ?몄텧 (理쒕? 3媛?.
- **?щ컻 諛⑹?**: T535 (?붾퉬?묿VDA / ?쇱쟾??05930.KS / ?뚯뒳?쇄넂TSLA ?뺥솗 留ㅽ븨 寃利?.
- **?뚯씪**: `js/aio-chat.js` _resolveTickerFromFuzzy + chatSend detectedTickers fallback

## P368 쨌 v49.69 쨌 [P368/R131] AI 梨꾪똿 嫄곗떆 ?쒕굹由ъ삤 ?숈쟻 ?쒕??덉씠??遺??
- **臾몄젣**: v49.68源뚯? ?ъ슜??"Fed 50bp ?명븯 ???먯궛 ?곹뼢?" / "VIX 30 ?꾨떖 ??" 吏덉쓽 ???뺤꽦 ?듬?留????뺣웾 異붿궛 遺??
- **?쒖젙 (v49.69)**: `_simulateMacroScenario(q)` ?좎꽕 ??6 ?쒕굹由ъ삤 ?⑦꽩 ?먮룞 媛먯? (fed-cut/fed-hike/vix-spike/spx-crash/dxy-strong/oil-spike) + Bridgewater + Druckenmiller ?꾨젅???곸슜 + SPX/10Y/DXY/Gold/Sector 5異??뺣웾 ?곹뼢 異붿궛 (?대━?ㅽ떛). chatSend ?묐떟 吏곹썑 amber chip + ???먮룞 ?쎌엯 (?먯궛 / ?덉긽 諛⑺뼢 / ?먯젙 ?윟?뵶).
- **?щ컻 諛⑹?**: T534 (6 ?쒕굹由ъ삤 留ㅽ븨 寃利?.
- **?뚯씪**: `js/aio-chat.js` _simulateMacroScenario + chatSend chip ?쎌엯

## P367 쨌 v49.69 쨌 [P367/R130] AI 梨꾪똿 ?ы듃?대━???숈쟻 ?쒕??덉씠??遺??
- **臾몄젣**: v49.68源뚯? "AAPL 10% 異붽? ??鍮꾩쨷?" 吏덉쓽 silent ??portfolio.holdings ?먮룞 議고쉶 + 媛以묒튂 蹂??怨꾩궛 誘몄???
- **?쒖젙 (v49.69)**: `_simulatePortfolioAddition(q, tickers)` ?좎꽕 ??鍮꾩쨷 % ?뺢퇋??留ㅼ묶 + portfolio.holdings ?먮룞 議고쉶 + ?쇱씠釉?媛寃?+ ?좉퇋 媛以묒튂 怨꾩궛. chatSend ?묐떟 吏곹썑 ?뱀깋 chip + ???먮룞 ?쎌엯 (醫낅ぉ / currentPct / newPct + 蹂???됱긽). ?좉퇋 醫낅ぉ (holdings 誘몃벑濡? ?먮룞 異붽? ?쒕??덉씠??
- **?щ컻 諛⑹?**: T533 ?⑥닔 ?뺤쓽.
- **?뚯씪**: `js/aio-chat.js` _simulatePortfolioAddition + chatSend chip ?쎌엯

## P366 쨌 v49.69 쨌 [P366/R130] AI 梨꾪똿 ?먮룞 ?섏씠吏 ?대룞 遺??
- **臾몄젣**: v49.68源뚯? ?ъ슜??"李⑦듃 蹂댁뿬以? ?낅젰 ???듬?留?+ ?섏씠吏 ?대룞 ?섎룞 ?대┃ ???ㅻ퉬寃뚯씠??鍮꾪슚??
- **?쒖젙 (v49.69)**: `_autoNavigatePage(q, currentCtxId)` ?좎꽕 ??12+ ?ㅼ썙???⑦꽩 留ㅽ븨 (李⑦듃/湲곗닠?뭪echnical / ?쒓렇?먥넂signal / ?щ━?뭩entiment / 留ㅽ겕濡쒋넂macro / ?명솚梨꾧텒?뭚xbond / 湲곗뾽遺꾩꽍?뭚undamental / ?뚮쭏?뭪hemes / ?ы듃?대━?ㅲ넂portfolio / ?듭뀡?뭥ptions / ?댁뒪?뭢arket-news / ?쒓뎅?뭟r-macro). ?꾩옱 而⑦뀓?ㅽ듃? ?숈씪?섎㈃ ?대룞 ?덈궡 ?앸왂. 蹂대씪??chip + showPage data-action ?먮룞 ?쎌엯.
- **?щ컻 諛⑹?**: T532 (12+ intent 留ㅽ븨 寃利?.
- **?뚯씪**: `js/aio-chat.js` _autoNavigatePage + chatSend chip ?쎌엯

## P365 쨌 v49.69 쨌 [P365/R129] AI 梨꾪똿 ?꾩냽 吏덈Ц ?먮룞 ?쒖븞 遺??(???源딆씠 + 吏꾩엯?λ꼍)
- **臾몄젣**: v49.68源뚯? ?듬? 醫낅즺 ???ъ슜?먭? 吏곸젒 ?ㅼ쓬 吏덈Ц ?낅젰 ??吏꾩엯?λ꼍 + ???源딆씠 ?⑥젅. 14 而⑦뀓?ㅽ듃蹂??곹빀 ?꾩냽 吏덈Ц 遺??
- **?쒖젙 (v49.69)**: `_suggestFollowUpQuestions(ctxId, q, response, tickers)` ?좎꽕 ??14 而⑦뀓?ㅽ듃蹂?遺꾧린 (醫낅ぉ??7 愿??deep-dive / macro?묪ridgewater 4-Quadrant / sentiment?묺arks Pendulum / technical?뭌einstein Stage / portfolio??-Quadrant 遺꾪룷 / themes?뭆oros Bubble / kr-*?믫븳援??쒖옣). ?묐떟 ???ъ씠?숈깋 chip 3媛?(`q-chip aio-followup-chip`) ?먮룞 ?쎌엯 + ?대┃ ??`chatFromChip(ctxId, q)` ?먮룞 ?몄텧. ?ъ슜??吏덉쓽??"?몄젣"/"?? ?ㅼ썙????異붽? ?꾩냽 吏덈Ц.
- **?щ컻 諛⑹?**: T531 (14 遺꾧린 寃利? + T539 (3媛?諛곗뿴 諛섑솚).
- **?뚯씪**: `js/aio-chat.js` _suggestFollowUpQuestions + chatSend chip ?쎌엯

## P364 쨌 v49.68 쨌 [P364/R128] AI 梨꾪똿 ?ъ씠?쒕컮 audit row 7 ??8異?(chatContextConsistency 誘멸??쒗솕)

- **臾몄젣**: v49.67 ?ъ씠?쒕컮 audit 7異?(registry/web_search/freshness/chatContexts/analysisFramework/essence/chatFunctionCoverage/tickerFetchHealth/fullSurface/deepReview)??"14 CHAT_CONTEXTS 湲곌?湲??꾨━?? ?뺥빀 row 遺?? ?ъ슜?먭? "AI 梨꾪똿 ?쒖뒪???꾩껜媛 ?좉린?곸쑝濡?湲곌?湲??꾨━?? ?붽뎄 ???먭? 吏꾨떒 遺덇?.
- **?쒖젙 (v49.68)**: `[data-audit-key="chatContextConsistency"]` row 8踰덉㎏ 異붽? + `_aioRefreshAuditWidget`??cccEl 遺꾧린 ??"湲곌?湲??꾨━??X/100 쨌 ?꾨젅??X/14 쨌 ?쒕굹由ъ삤 ??쨌 ?쒓컖 ?? ?됱긽 ?쒖떆 (>=85% green / >=60% amber / <60% red).
- **?щ컻 諛⑹?**: T528 ?쇱씠釉?DOM ?뚭? (?ъ씠?쒕컮 row DOM 議댁옱).
- **?뚯씪**: `index.html` + `js/aio-core.js` _aioRefreshAuditWidget cccEl 遺꾧린

## P363 쨌 v49.68 쨌 [P363/R128] AI 梨꾪똿 ?곗씠???뚯뒪 ?곗꽑?쒖쐞 誘몃챸臾명솕 + 異쒖쿂 ??꾩뒪?ы봽 ?꾨씫

- **臾몄젣**: v49.67源뚯? _liveSnap/_closeSnap/DATA_SNAPSHOT 3以??곗씠???뚯뒪 ?쇱슜 + ?곗꽑?쒖쐞 紐낅Ц??遺?? ?대갚媛??몄슜 ??"湲곗??? 誘명몴湲곕줈 ?ъ슜?먭? stale ?щ? ?먮떒 遺덇?. macro context "Fed Rate: 3.50-3.75%" ?대갚媛믪쓣 ?ㅼ떆媛꾩쿂???몄슜.
- **?쒖젙 (v49.68)**: ABSOLUTE RULES **12議??좉퇋** ??1?쒖쐞 _liveSnap (?ㅼ떆媛?<5遺? ??2?쒖쐞 _closeSnap (醫낃?) ??3?쒖쐞 DATA_SNAPSHOT (?대갚, ?좎꽑??紐낆떆) ??4?쒖쐞 SEC/FMP/Naver/Finnhub fetched (5遺?罹먯떆). ?대갚媛??몄슜 ??"(?대갚)" 紐낆떆 + "Source 쨌 湲곗??? YYYY-MM-DD" ?쒓린 ?섎Т.
- **?щ컻 諛⑹?**: T525 ?쇱씠釉?DOM ?뚭? (ABSOLUTE RULES 12議?紐낆떆).
- **?뚯씪**: `js/aio-chat.js` ABSOLUTE RULES 12議?

## P362 쨌 v49.68 쨌 [P362/R128] AI 梨꾪똿 14 而⑦뀓?ㅽ듃 ?쇨???+ 湲곌?湲??꾨━???먮룞 吏꾨떒 遺??

- **臾몄젣**: v49.67源뚯? 14 CHAT_CONTEXTS???섎????덉쭏 (湲곌?湲??꾨젅???듯빀 / ?쒕굹由ъ삤 媛?대뱶 / ?쒓컖 ?⑥꽌 / 異쒖쿂 ??꾩뒪?ы봽) ?먮룞 吏꾨떒 遺?? ?ъ슜?먭? "湲곌?湲??꾨━???좉린???묐룞" ?붽뎄 ??肄섏넄?먯꽌 利됱떆 ?먯닔 ?뺤씤 遺덇?. 媛숈? ?곗씠??(VIX/10Y/DXY)媛 14 而⑦뀓?ㅽ듃???쇨? 二쇱엯?섎뒗吏 誘멸?利?
- **?쒖젙 (v49.68)**: `AIO.getChatContextConsistencyAudit()` ?좎꽕 ??14 CHAT_CONTEXTS 횞 5 痢〓㈃ (?쇱씠釉??쇨???/ 湲곌?湲??꾨젅??/ ?쒕굹由ъ삤 / ?쒓컖 ?⑥꽌 / 異쒖쿂 ??꾩뒪?ы봽) + _fetchTickerDataForChat ?먯껜 5 痢〓㈃ 寃利? qualityScore 0~100 ?곗텧 (媛以묒튂: ?꾨젅??25??+ ?쇱씠釉?15??+ ?쒕굹由ъ삤 10??+ ?쒓컖 5??+ 異쒖쿂 5??+ 梨꾪똿 ?⑥닔 40??. status: 85+ ok / 60~85 warn / <60 fail.
- **?щ컻 諛⑹?**: T526 ?⑥닔 ?뺤쓽 + T527 qualityScore >= 60 + T529 14 而⑦뀓?ㅽ듃 12+ ?꾨젅??
- **?뚯씪**: `js/aio-core.js` getChatContextConsistencyAudit + `index.html` ?ъ씠?쒕컮 row

## P361 쨌 v49.68 쨌 [P361/R127/R128] AI 梨꾪똿 Bull/Base/Bear ?쒕굹由ъ삤 遺꾧린 誘멸컯??+ ?쒓컖 ?⑥꽌 遺??

- **臾몄젣 (?섎???吏꾨떒)**: v49.67源뚯? 14 CHAT_CONTEXTS 以?macro留??쒕굹由ъ삤 遺꾧린 (60/25/15% ?뺣쪧) ?쒓났. 醫낅ぉ 遺꾩꽍/?ъ슜??吏덉쓽 ???⑥씪 寃곕줎留??듬? ??鍮꾨?移??꾪뿕 誘몄씤吏. ?대え吏/援듦린/?됱긽 ?쇨???遺?????ъ슜?먭? ?꾪뿕/湲고쉶 利됱떆 ?쒓컖 ?몄? 遺덇?.
- **?쒖젙 (v49.68)**:
  - ?쒖옣 ?섍꼍 ?ㅻ뜑??VIX/F&G/Score ?대え吏 ?먮룞 遺꾨쪟: VIX ??5 ?뵶 / ??0 ?윞 / <20 ?윟 / F&G 洹밸떒 (??5 ?먮뒗 ??5) ?뵶 / 以묐┰ ?윟 / Score ??5 ?윟 / ??0 ?윞 / <40 ?뵶
  - ABSOLUTE RULES **9議??좉퇋** (R127 Bull/Base/Bear 3 ?쒕굹由ъ삤 遺꾧린 + ?뺤떊??X+Y+Z=100 ?섎Т): ?뺤떇 "**?뱢 Bull (X%)**: [?몃━嫄? ??[?쒕굹由ъ삤] / **?윞 Base (Y%)** / **?뱣 Bear (Z%)**"
  - ABSOLUTE RULES **10議??좉퇋** (R128 ?쒓컖 ?⑥꽌 ?쒖? + Source 쨌 湲곗????쒓린 + 寃곕줎?? ?듭떖?믪떆?섎━?ㅲ넂?≪뀡 援ъ“ 媛뺤젣)
- **?щ컻 諛⑹?**: T523 ?쒕굹由ъ삤 媛?대뱶 / T524 ?대え吏 + ??꾩뒪?ы봽 / T525 ABSOLUTE RULES 10議?
- **?뚯씪**: `js/aio-chat.js` ?쒖옣 ?ㅻ뜑 ?대え吏 + ABSOLUTE RULES 9~10議?

## P360 쨌 v49.68 쨌 [P360/R126] AI 梨꾪똿 湲곌?湲?遺꾩꽍 ?꾨젅?꾩썙??8媛??듯빀 遺??(32% ??100% 留ㅽ븨)

- **?ъ슜???뺤쭅 吏??*: "AI 梨꾪똿 愿?⑦븳 ?쒖뒪???꾩껜媛 ?좉린?곸쑝濡?湲곌?湲??꾨━?곕줈 ?묐룞?댁빞"
- **臾몄젣 吏꾨떒 (Explore agent ?섎????뺣? 吏꾨떒)**: v49.67源뚯? 11 湲곌?湲??꾨젅??以?3.5/11 (32%) ?듯빀:
  - ??紐낆떆: Citi (Stagflation Playbook, NAND SCA), JPM (CoWoS, Healthcare, Liquidity), Goldman (Top of Mind, Evercore ?쇰?)
  - ??**?꾨씫 (?듭떖 8媛?**: Bridgewater All Weather 4-Quadrant / Druckenmiller Macro Overlay / Howard Marks Pendulum / Buffett Owner Earnings + Margin of Safety / Ackman Pershing Square 8 Criteria / Soros Reflexivity / GS GIR (Top of Mind / Out of Consensus 紐낆떆) / Morgan Stanley Cyclical Pendulum
- **?쒖젙 (v49.68)**:
  - `_getInstitutionalFrameworkContext(pageFocus)` ?좉퇋 ?⑥닔 (`index.html` L15222~15310) ??8 ?꾨젅???뺤쓽 + ?듬? ???섎Т 紐낆떆 + ?섏씠吏蹂??곗꽑 ?꾨젅??留ㅽ븨
  - `_getV48IntegratedContext` ?먮룞 ?몄텧 ??14 CHAT_CONTEXTS 紐⑤몢 ?먮룞 二쇱엯 (`return common + focus + instFw;`)
  - ABSOLUTE RULES **11議??좉퇋** (R126 8 ?꾨젅??以?1~3媛??몄슜 ?섎Т): "Bridgewater 4-Quadrant 湲곗? ?꾩옱 ?꾩튂??~ / Druckenmiller Overlay ?좊룞???쒓렇?먯? ~ / ?곕씪??~"
  - ?섏씠吏蹂??곗꽑 ?꾨젅?? macro?묪ridgewater+Druckenmiller / sentiment?묺arks+Soros / fundamental?묪uffett+Ackman / themes?뭆oros+MS Cyclical / fxbond?묪ridgewater+Druckenmiller / portfolio?묨ll Weather+Margin of Safety
- **?щ컻 諛⑹?**: T521 8 ?꾨젅??紐낆떆 + T522 v48 ??instFw ?먮룞 ?몄텧 + T529 14 而⑦뀓?ㅽ듃 12+ ?꾨젅??+ R126 ?좉퇋.
- **?뚯씪**: `index.html` L15222 _getInstitutionalFrameworkContext + L15411 _getV48IntegratedContext ?듯빀

## P359 쨌 v49.67 쨌 [P359/R125] Surface inventory was not enough for second/third-pass text/function/data review
- **Problem**: P358 proved every page/overlay surface was present, but it still did not prove that meaning-bearing text, delegated input handlers, unlabeled controls, dense jargon, console-only hints, and data-sink explanation coverage were audited as a second/third pass.
- **Fix (v49.67 Codex hardening)**: Added `AIO.getDeepReviewAudit()` to scan text snippets, placeholder/stale tokens, `data-on-enter`/`data-on-input` handlers, unlabeled buttons, dense jargon, console-only hints, and data pages with sinks but no lineage/explainer markers.
- **Prevention**: Wired the audit to sidebar `[data-audit-key="deepReview"]`, `AIO.getAutoOpsReadiness()`, and `AIO.getDeploymentGateAudit()`. Added T515-T520 for API shape, text snippet coverage, sidebar row, AutoOps integration, deployment gate integration, and input binding audit shape.
- **Files**: `index.html`, `js/aio-core.js`, `js/aio-tests.js`, `version.json`
---

## P358 쨌 v49.67 쨌 [P358/R124] 1-pass page review ambiguity ??no DOM-first full surface inventory
- **Problem**: Prior audits could still be interpreted as "first pass" because `getPageUXAudit()` follows the page brief registry and does not inventory every actual DOM surface. A page could have tables, charts, controls, data sinks, or visible placeholder text that was not summarized in one operator-facing audit.
- **Fix (v49.67 Codex hardening)**: Added `AIO.getFullSurfaceAudit()` to walk every `.page[id]` in the rendered DOM and summarize headings, sections/cards, data sinks, controls, tables, charts, explainers, visible loading text, registry coverage, brief coverage, and per-page risk flags.
- **Prevention**: Wired the new audit to sidebar `[data-audit-key="fullSurface"]`, `AIO.getAutoOpsReadiness()`, and `AIO.getDeploymentGateAudit()`. Added T508-T514 for API shape, full DOM page coverage, sidebar row, AutoOps command/result, visible loading zero, deployment gate integration, and non-route overlay coverage.
- **Files**: `index.html`, `js/aio-core.js`, `js/aio-tests.js`, `version.json`
---

## P357 쨌 v49.67 쨌 [P357/R123] ?ъ씠?쒕컮 Audit row ?섎? ?쇱꽑 ??REGISTRY/?좎꽑???섏튂 遺꾨━ 遺議?

- **臾몄젣**: v49.67 ?ъ씠?쒕컮 audit row?먯꽌 REGISTRY???ㅼ젣 ?깅줉 ??`384 real / 391 total`)媛 ?꾨땲??alias coverage(`250/543`, 46%)留?蹂댁뿬 ?ъ슜?먭? ?깅줉 蹂닿컯??怨쇱냼?됯??????덉뿀?? freshness row??`getChatContextFreshnessAudit()`??`totalHits` 諛섑솚??pct濡쒕쭔 ?댁꽍??"痢≪젙 遺덇?" ?먮뒗 ?꾩껜 stale hit 寃쎄퀬濡?蹂댁씪 ???덉뿀??
- **?쒖젙 (v49.67 Codex 蹂닿컯)**: registry row??`getTickerRegistryEntryAudit()` ?곗꽑 ?쒖떆濡?蹂寃쏀빐 `real / total`怨?alias coverage瑜?遺꾨━. freshness audit? `currentHits`? `archiveHits`瑜?遺꾨━ 諛섑솚?섍퀬, sidebar row??`current stale N嫄?쨌 archive ref M嫄??쇰줈 ?쒖떆.
- **?щ컻 諛⑹?**: T505 (`REGISTRY real/total` row), T506 (`freshness 痢≪젙 遺덇? 湲덉?`), T507 (`currentHits/archiveHits shape`) 異붽?.
- **釉뚮씪?곗? ?뺤씤**: registry row `??REGISTRY 384 real / 391 total (98%) 쨌 alias 46%`, freshness row `??而⑦뀓?ㅽ듃 current stale 0嫄?쨌 archive ref 24嫄?.
- **?뚯씪**: `js/aio-core.js`, `js/aio-tests.js`
---

## P356 쨌 v49.67 쨌 [P356/R122] AI 梨꾪똿 ?ъ씠?쒕컮 audit row 6 ??7異?(tickerFetchHealth 誘멸??쒗솕)

- **臾몄젣**: v49.66源뚯? ?ъ씠?쒕컮 audit ?꾩젽 6異?(registry/web_search/freshness/chatContexts/analysisFramework/essence/chatFunctionCoverage)???쒖꽭 fetch ?ㅼ젣 ?깃났瑜?row 遺?? ?ъ슜?먭? "紐뉖챺 醫낅ぉ ?쒖꽭 紐?遺덈윭?? 吏?????먭? 吏꾨떒 遺덇?.
- **?쒖젙 (v49.67)**: index.html L3902 `[data-audit-key="tickerFetchHealth"]` row 異붽?. `_aioRefreshAuditWidget` 7踰덉㎏ 遺꾧린 異붽? ??`AIO.assertTickerFetchHealth()` 寃곌낵 "?쒖꽭 fetch X/Y 쨌 US X% 쨌 KR X% 쨌 罹먯떆 hit X%" ?됱긽 ?쒖떆 (>=30% green / >=15% amber / <15% red).
- **?щ컻 諛⑹?**: T502 ?쇱씠釉?DOM ?뚭? (`[data-audit-key="tickerFetchHealth"]` DOM 議댁옱).
- **?뚯씪**: `index.html` L3902 + `js/aio-core.js` _aioRefreshAuditWidget tfhEl 遺꾧린

## P355 쨌 v49.67 쨌 [P355/R122] AI 梨꾪똿 移댄뀒怨좊━蹂??쒖꽭 fetch ?깃났瑜??먮룞 吏꾨떒 遺??

- **臾몄젣**: v49.66源뚯? REGISTRY 391 entries 以??대뼡 移댄뀒怨좊━(US/KR/ADR/?뷀샇?뷀룓/吏??媛 ?쒖꽭 fetch ?ㅽ뙣???믪?吏 ?먮룞 吏꾨떒 遺?? ?ъ슜?먭? "?먯퐫?꾨줈鍮꾩뿞 ?쒖꽭 ???섏샂" 吏????媛쒕컻?먭? KR ticker ?대갚 泥댁씤 ?먭? ?꾩슂?쒖? 利됱떆 ?먮떒 遺덇?.
- **?쒖젙 (v49.67)**: `AIO.assertTickerFetchHealth()` ?좎꽕 (`js/aio-core.js` 5402~5460). 6 移댄뀒怨좊━ 遺꾨쪟 + `_liveData[k].price > 0` 寃利?+ 移댄뀒怨좊━蹂?missing ?섑뵆 5媛?+ chatTickerCache hit rate ?듯빀. 諛섑솚: `{status, totalRegistry, liveDataHit, overallCoveragePct, byCategory: {us/kr/adr/crypto/index/other 횞 {total, live, missing, coveragePct}}, chatTickerCache, fallbackChain, note}`.
- **?щ컻 諛⑹?**: T501 ?쇱씠釉?DOM ?뚭? (`byCategory` 5 移댄뀒怨좊━ 議댁옱 寃利? + ?ъ씠?쒕컮 7踰덉㎏ row 媛?쒗솕.
- **?뚯씪**: `js/aio-core.js` L5402~5460 assertTickerFetchHealth

## P354 쨌 v49.67 쨌 [P354/R122] _chatTickerCache ?ㅽ뙣 fetch 5遺?罹먯떆 (stale ?묐떟 諛섎났)

- **臾몄젣**: v49.66 P350 cache 援ы쁽 ??紐⑤뱺 fetch 寃곌낵瑜?5遺?TTL ??? **?쒖꽭 議고쉶 ?ㅽ뙣 醫낅ぉ (???쒖떆 + suggestedAction)??罹먯떆** ???ъ슜?먭? 5遺????ъ쭏????"???ㅽ뙣" ?묐떟 諛섎났 + ?몃? API 蹂듦뎄 ?꾩뿉??stale "?ㅽ뙣" ?묐떟 5遺??붿〈. TTL eviction ?⑥닚 LRU 50 cap留??섏〈 (留뚮즺 留뚮즺 + 50 誘몃쭔?대㈃ 臾댄븳 ?붿〈).
- **?쒖젙 (v49.67)**:
  - `_fetchTickerDataForChat` cache save 吏곸쟾 `_isFailedFetch` 蹂??異붽? (`data === null` ?먮뒗 泥??쇱씤?????쒖꽭 議고쉶 ?ㅽ뙣 ?ы븿 ??true)
  - ?ㅽ뙣 ??`window._chatTickerCache[t] = ...` ???嫄곕? ???ㅼ쓬 吏덉쓽 ??利됱떆 ??fetch (?몃? API 蹂듦뎄 利됱떆 諛섏쁺)
  - TTL eviction 媛뺥솕: 留?save ??`Object.keys` ?쒗쉶 ??`_now - ts >= _CC_TTL` 醫낅ぉ ?먮룞 ??젣 + LRU 50 cap (湲곗〈)
- **?щ컻 諛⑹?**: T500 ?쇱씠釉?DOM ?뚭? (TTL eviction + `_isFailedFetch` 媛???뺢퇋??寃利?.
- **?뚯씪**: `js/aio-chat.js` L2380~2410 cache save 釉붾줉

## P353 쨌 v49.67 쨌 [P353/R122] AI 梨꾪똿 ?묐떟???쒖옣 ?섍꼍 ?ㅻ뜑 ?먮룞 二쇱엯 遺??(?ъ슜??泥닿컧 ?먮쫫 ?⑥젅)

- **臾몄젣**: v49.66源뚯? `_fetchTickerDataForChat` ?묐떟 ?띿뒪?멸? 醫낅ぉ ?곗씠??+ ABSOLUTE RULES留??ы븿. **?꾩옱 ?쒖옣 ?섍꼍 (VIX/F&G/?몃젅?대뵫 ?먯닔)??醫낅ぉ 遺꾩꽍 ?꾩엯??媛뺤젣?섏? ?딆쓬** ??AI媛 醫낅ぉ蹂??뺤쟻 遺꾩꽍留??쒓났 + ?ъ슜?먭? "吏湲??쒖옣 ?곹솴?먯꽌 ??醫낅ぉ ?대뼸寃?" 吏덉쓽 ??留ㅽ겕濡?而⑦뀓?ㅽ듃 ?꾨씫 ?듬?. ?ъ슜???뺤쭅 吏??"?쒖옣 ?먮쫫 ?좉린?곸쑝濡??먮Ⅴ?붿?" 遺??
- **?쒖젙 (v49.67)**:
  - `_fetchTickerDataForChat` ?묐떟 泥?以꾩뿉 `?먰쁽???쒖옣 ?섍꼍 (v49.67 ?먮룞 ?ㅻ뜑)??SPX/VIX/10Y/F&G/?몃젅?대뵫 ?ㅼ퐫?? ?먮룞 二쇱엯 (紐⑤뱺 醫낅ぉ ?듬?)
  - VIX regime ?먯젙 (>=25 寃쎄퀎 / >=20 二쇱쓽 / 洹????덉젙) + F&G label (洹밸떒 怨듯룷/怨듯룷/以묐┰/?먯슃/洹밸떒 ?먯슃) ?④퍡
  - Cache hit 寃쎈줈???숈씪 ?ㅻ뜑 ?곸슜 (?쇨???
  - ABSOLUTE RULES **8議??좉퇋** (R122): "醫낅ぉ ?듬? ?꾩엯? 諛섎뱶?????먰쁽???쒖옣 ?섍꼍???ㅻ뜑 ?몄슜 ??'吏湲?VIX X 쨌 F&G Y ?섍꼍?먯꽌 [醫낅ぉ]?...' ?⑦꽩 媛뺤젣. ?쒖옣 ?섍꼍怨?臾닿????뺤쟻 遺꾩꽍 湲덉?."
- **?щ컻 諛⑹?**: T499 ?쇱씠釉?DOM ?뚭? (`?꾩옱 ?쒖옣 ?섍꼍` ?띿뒪??+ `R122` 留덉빱 ?뺢퇋??.
- **?뚯씪**: `js/aio-chat.js` L2367~2395 (?ㅻ뜑 二쇱엯) + L2330~2340 (cache hit ?ㅻ뜑) + L2347 (ABSOLUTE RULES 8議?

## P352 쨌 v49.67 쨌 [P352/R122] dynamicTickerLookup ?대갚 泥댁씤 遺議?+ ?ㅽ뙣 ??null 諛섑솚 (silent fail)

- **?ъ슜???뺤쭅 吏??*: "紐뉖챺 醫낅ぉ ?쒖꽭 ??紐?遺덈윭?ㅺ퀬 ?덈떎."
- **臾몄젣 吏꾨떒**:
  - v49.66源뚯? `dynamicTickerLookup` ?대갚 泥댁씤: Yahoo (3 proxies) ??Stooq (US留? ??Naver siseJson (KR留? ??**null 諛섑솚**
  - KR ticker (.KS/.KQ): Yahoo 誘몄???+ Naver siseJson 1?④퀎 ?대갚留???Naver ?ㅽ뙣 ??silent fail
  - ?좉퇋 IPO (RDDT/CRWV ?? / ?몃룄/?좊읇 ADR: Yahoo 吏?먰븯???곗씠??吏??鍮덈쾲 ??Stooq US ?대갚??遺?뺥솗
  - ?ㅽ뙣 ??`null` 諛섑솚 ??`_fetchTickerDataForChat`?먯꽌 HARD GUARDRAIL 硫붿떆吏留?異쒕젰 + ?ъ슜?먭? **??* ?ㅽ뙣?덈뒗吏 ?몄? 遺덇?
- **?쒖젙 (v49.67)**:
  - **Finnhub /quote 4踰덉㎏ ?대갚 異붽?** (`index.html` L20404~20425): US/ADR ticker (KR ?쒖쇅, =F/=X/^ ?쒖쇅, -USD ?쒖쇅)???쒗빐 Finnhub API key ?덉쓣 ???몄텧 ??c (?꾩옱媛) + dp (?깅씫瑜? ?먮뒗 pc (?꾩씪 醫낃?) 湲곕컲 ?대갚 怨꾩궛. ?깃났 ??`_liveData` ???+ `source:'finnhub'` 諛섑솚
  - **?ㅽ뙣 ??援ъ“???묐떟** (?댁쟾 null): `{ticker, available:false, fetchFailed:true, tickerType, reason, suggestedAction, source:'none'}` 諛섑솚
    - tickerType: 'KR 醫낅ぉ (.KS/.KQ)' / '?섏쑉' / '?좊Ъ' / '吏?? / '?뷀샇?뷀룓' / '誘멸뎅/ADR' / '援?젣'
    - suggestedAction: KR ??"Naver 湲덉쑖 finance.naver.com/item/main.naver?code=XXXXXX 吏곸젒 ?뺤씤" / US ??"Yahoo Finance + Finnhub API key ?깅줉 沅뚯옣" / 湲고? ??"?몃? ?꾧뎄濡?吏곸젒 ?뺤씤 沅뚯옣"
  - `_fetchTickerDataForChat`?먯꽌 `data.fetchFailed === true` 泥댄겕 + `data = null`濡?蹂????`??${tickerType}: ?쒖꽭 議고쉶 ?ㅽ뙣 ??${reason}` + `?뮕 ${suggestedAction}` 異쒕젰
- **?щ컻 諛⑹?**: T498 ?쇱씠釉?DOM ?뚭? (Finnhub URL ?⑦꽩 + `fetchFailed:true` + `suggestedAction` ?뺢퇋??寃利? + R122 ?좉퇋.
- **?뚯씪**: `index.html` L20404~20440 dynamicTickerLookup ?대갚 媛뺥솕 + `js/aio-chat.js` L2023~2032 fetchFailed 泥섎━

## P351 쨌 v49.66 쨌 [P351/R121] AI 梨꾪똿 ?뺤쓽-?몄텧 ?뺥빀 ?먮룞 ?뚭? 諛⑹? audit 遺??

- **臾몄젣**: v49.65源뚯? ?좉퇋 fetch/compute ?⑥닔 異붽? ??`_fetchTickerDataForChat` ?듯빀 ?꾨씫 ?먮룞 媛먯? audit ?놁쓬. 14 CHAT_CONTEXTS??`_getV48IntegratedContext` ?몄텧 ?뺥빀 ?먮룞 寃利?遺?? `_chatTickerCache` 援ы쁽 ?щ? ?먮룞 ?뺤씤 遺?????좉퇋 ?뚭? silent.
- **?쒖젙 (v49.66)**: `AIO.assertChatFunctionCoverage()` ?좎꽕 (`js/aio-core.js` L5402~5485). 3異??먮룞 ?먭?:
  - `chatRelevantFns` (window.AIO.fetch*/compute*, 28 knownExempt ?쒖쇅) vs `_fetchTickerDataForChat` source ?몄텧 寃利???`deadCode` 由ъ뒪??
  - 14 CHAT_CONTEXTS system() source??`_getV48IntegratedContext` ?몄텧 寃利???`partialContexts` 由ъ뒪??
  - `_chatTickerCache` save/load/LRU 3異?紐⑤몢 議댁옱 ?щ? ??`cacheImplemented` boolean
- ?ъ씠?쒕컮 audit row 6踰덉㎏ ?좉퇋 (`[data-audit-key="chatFunctionCoverage"]`, index.html L3901) + `_aioRefreshAuditWidget` 遺꾧린 異붽?.
- **?щ컻 諛⑹?**: T495 ?쇱씠釉?DOM ?뚭? (deadCodeCount === 0) + T496 (?ъ씠?쒕컮 row DOM) + R121 ?좉퇋 (?뺤쓽-?몄텧 ?뺥빀 ?섎Т).
- **?뚯씪**: `js/aio-core.js` assertChatFunctionCoverage + _aioRefreshAuditWidget cfcEl 遺꾧린 + `index.html` audit row + `js/aio-tests.js` T495/T496

## P350 쨌 v49.66 쨌 [P350/R121] _chatTickerCache 5遺?TTL ?뺤쓽留?+ save 濡쒖쭅 遺??(Silent Fail)

- **臾몄젣**: v49.57 P317 plan?먯꽌 `window._chatTickerCache[t] = { data, ts }` TTL 5遺??섎룄 紐낆떆. v49.65源뚯? ?ㅼ젣 肄붾뱶 遺?????뺤쓽留??덇퀬 save/load 濡쒖쭅 ?놁쓬. ?숈씪 醫낅ぉ ?곗냽 吏덉쓽 ??17 promise 留ㅻ쾲 ?덈줈 fetch ??Yahoo/SEC/Finnhub rate-limit hit + ?묐떟 4珥?諛섎났 + ?몃? API 荑쇳꽣 ??퉬.
- **?쒖젙 (v49.66)**: `_fetchTickerDataForChat` ??援ы쁽 (`js/aio-chat.js` L2010~2035 + L2367~2389):
  - ?⑥닔 吏꾩엯 ???ъ쟾 cache 議고쉶 (5遺?TTL ??醫낅ぉ? 利됱떆 `cachedBlocks`濡?諛섑솚)
  - 醫낅ぉ 泥섎━ ?꾨즺 ??cache save (`_tickerBlockStart` 異붿쟻?쇰줈 醫낅ぉ蹂?釉붾줉 ?뺥솗 遺꾨━)
  - LRU eviction (50 醫낅ぉ cap 珥덇낵 ???ㅻ옒??10媛??먮룞 ??젣)
  - `window._chatTickerCacheStats` (hits/misses/evictions) ?듦퀎 ?꾩쟻
  - `AIO.getChatTickerCacheStats()` ?좉퇋 (size/maxSize/ttlMinutes/hitRatePct/cachedTickers 媛?쒗솕)
- ?④낵: ?숈씪 醫낅ぉ ?ъ쭏????~0.5珥??묐떟 + ?몃? API 荑쇳꽣 ?덉빟.
- **?щ컻 諛⑹?**: T494 ?쇱씠釉?DOM ?뚭? (`cacheImplemented === true` + `getChatTickerCacheStats` ?⑥닔 ?뺤쓽).
- **?뚯씪**: `js/aio-chat.js` L2010~2035 (cache 議고쉶 + stats ?⑥닔) + L2367~2389 (save + LRU)

## P349 쨌 v49.66 쨌 [P349/R121] 7 CHAT_CONTEXTS _getV48IntegratedContext 誘명샇異?(Partial Integration)

- **臾몄젣**: v49.65 ?꾩닔 議곗궗 寃곌낵 14 CHAT_CONTEXTS 以?7媛쒓? `_getV48IntegratedContext(pageId)` ?숈쟻 而⑦뀓?ㅽ듃 誘명샇異???macro / portfolio / breadth + KR 4媛?(kr-macro / kr-supply / kr-themes / kr-tech). v48.83 ?쒖옣 ?먮즺 (6? ?⑤윭?ㅼ엫 + 25嫄?遺꾩꽍, Apple CEO ?꾪솚 / Vertiv 1Q26 / Mythos ?ъ씠踰?/ DC Watch / Google-MRVL ?? ?먮룞 二쇱엯 ??????AI媛 ?숈뒿 ?곗씠?곕줈 ?듬? (?섍컖 ?꾪뿕).
- **?쒖젙 (v49.66)**: 7 而⑦뀓?ㅽ듃 system() ?앸?遺꾩뿉 `_getV48IntegratedContext(focus)` ?몄텧 異붽?:
  - macro ??`_getV48IntegratedContext('macro')`
  - portfolio ??`_getV48IntegratedContext('portfolio')`
  - breadth ??`_getV48IntegratedContext('breadth')`
  - kr-macro ??`_getV48IntegratedContext('macro')` (KR??嫄곗떆 ?듯빀 而⑦뀓?ㅽ듃 怨듭쑀)
  - kr-supply ??`_getV48IntegratedContext('breadth')` (?섍툒 = 釉뚮젅?쒖벐 ?좎궗)
  - kr-themes ??`_getV48IntegratedContext('themes')`
  - kr-tech ??`_getV48IntegratedContext('technical')`
- ?⑥닔媛 unknown pageFocus??common context留?諛섑솚 (graceful) ??KR 4媛쒕뒗 common context濡쒕룄 ?쒖옣 ?먮즺 二쇱엯 異⑸텇.
- **?щ컻 諛⑹?**: T493 ?쇱씠釉?DOM ?뚭? (`assertChatFunctionCoverage().partialContextCount === 0`).
- **?뚯씪**: `js/aio-chat.js` 7 而⑦뀓?ㅽ듃 system() ?앸?遺?

## P348 쨌 v49.66 쨌 [P348/R121] fetchSECRiskFactors Dead code (#16 由ъ뒪???뺤쓽留?+ ?몄텧 0嫄?

- **臾몄젣**: v49.34?먯꽌 `AIO.fetchSECRiskFactors` ?⑥닔 ?뺤쓽 (`js/aio-core.js` L5550 遺洹? + ANALYSIS_FRAMEWORK_REGISTRY #16 "由ъ뒪?? ?꾨뱶??`primarySource`濡??깅줉. 洹몃윭??`_fetchTickerDataForChat`?먯꽌 ?ㅼ젣 ?몄텧 0嫄? ?ъ슜?먭? 醫낅ぉ 由ъ뒪??遺꾩꽍 吏덉쓽 ??AI???숈뒿 ?곗씠??+ ?쇰컲 媛?대뱶留??듬? ??醫낅ぉ蹂?SEC 10-K Item 1A (Risk Factors) URL 吏곸젒 ?몄슜 紐삵븿.
- **?쒖젙 (v49.66)**: `js/aio-chat.js` `_fetchTickerDataForChat` (L2045~2046)??`riskFactorsPromise` 異붽? (2.5珥?timeout) + `[Risk Factors (SEC 10-K Item 1A)]` ?쇰꺼 + 媛?대뱶 ?띿뒪??異쒕젰. ABSOLUTE RULES 17 愿??留ㅽ븨 #16 媛깆떊: `[SEC 10-K Item 1A]` (?뺤쟻 媛?대뱶) ??`[Risk Factors (SEC 10-K Item 1A)] (v49.66 SEC URL 吏곸젒 ?몄슜)`.
- **?щ컻 諛⑹?**: T492 ?쇱씠釉?DOM ?뚭? (`_fetchTickerDataForChat` source??`riskFactorsPromise` + `[Risk Factors (SEC 10-K Item 1A)]` ?쇰꺼 寃利? + R121 ?좉퇋 (?뺤쓽-?몄텧 ?뺥빀 ?섎Т).
- **?뚯씪**: `js/aio-chat.js` L2045 promise ?좎뼵 + L2240~2247 render 釉붾줉 + L2367 ABSOLUTE RULES 留ㅽ븨

## P347 쨌 v49.65 쨌 [P347/R120] 3? 蹂몄쭏 媛먯궗媛 script ?띿뒪?멸퉴吏 ?몃뒗 ?ㅽ깘 + 珥덈낫??珥덇린 臾멸뎄 ?붿〈

- **臾몄젣**: `AIO.getEssenceAlignmentAudit()`??珥덇린 援ы쁽??`document.body.textContent`瑜?洹몃?濡??ъ슜??`<script>` ?대? 臾몄옄??二쇱꽍??"濡쒕뵫 以?源뚯? 珥덈낫??吏곴???踰뚯젏?쇰줈 怨꾩궛. ?숈떆???ㅼ젣 ?붾㈃?먮룄 "?곗씠??濡쒕뵫 以?遺꾩꽍 濡쒕뵫 以?怨꾩궛 以? 珥덇린 臾멸뎄媛 ?ㅼ닔 ?⑥븘 ?ъ슜?먭? ?곗씠??誘몄닔?좉낵 ?ㅻ쪟瑜?援щ텇?섍린 ?대젮?.
- **?쒖젙 (v49.65 Codex 蹂닿컯)**: 媛먯궗 ?⑥닔??`textCount()`瑜?TreeWalker 湲곕컲?쇰줈 蹂寃쏀빐 `SCRIPT/STYLE/NOSCRIPT/TEMPLATE` ?띿뒪?몃? ?쒖쇅. ?ㅼ젣 蹂댁씠??DOM??珥덇린 臾멸뎄 29嫄댁쓣 "?섏떊 ?湲??섏쭛 ?湲??먯젙 ?낅젰 ?湲?遺꾩꽍 ?낅젰 ?섏떊 ?湲?濡??뺢퇋??
- **?щ컻 諛⑹?**: T491 異붽? ??`AIO.getEssenceAlignmentAudit().goals.intuitiveBeginnerUse.loadingTextCount === 0` 寃利? 釉뚮씪?곗? ?고????뺤씤 湲곗? visible loading count 0嫄? sidebar essence row `89??쨌 吏곴? 79`.
- **?뚯씪**: `js/aio-core.js`, `index.html`, `js/aio-tests.js`

## P346 쨌 v49.65 쨌 [P346/R119] 3? 蹂몄쭏 ?꾩닔 ?먭???臾몄꽌 媛먯궗??癒몃Т瑜대뒗 臾몄젣

- **臾몄젣**: "湲곌?湲?All-in-one / ?뺥솗??理쒖떊 ?먮룞?댁쁺 / 珥덈낫??吏곴??? 3? 紐⑺몴瑜??щ엺????踰??쎄퀬 ?됯??섎뒗 諛⑹떇留뚯쑝濡쒕뒗 ?ㅼ쓬 蹂寃쎌뿉???뚭?瑜??먮룞 媛먯??????놁쓬. ?뱁엳 ?섏씠吏 ?? 珥덈낫???덈궡, live ?곗씠??異쒖쿂, refresh scheduler, 諛고룷 寃뚯씠?멸? ?쒕줈 遺꾨━?섏뼱 ?덉쑝硫?"醫뗭븘 蹂댁씠??湲곕뒫"? ?섏뼱?섎룄 蹂몄쭏 ?뺣젹? ?쏀빐吏????덉쓬.
- **?쒖젙 (v49.65 Codex 蹂닿컯)**: `AIO.getEssenceAlignmentAudit()` 異붽?. 3媛?紐⑺몴瑜?`institutionalAllInOne`, `accurateFreshAutoOps`, `intuitiveBeginnerUse` ?먯닔濡?遺꾪빐?섍퀬, `getPageUXAudit`/`getAnalysisFrameworkCoverageAudit`/`getRefreshSchedulerAudit`/`getDataFreshnessAudit`/`getMarketCurrentnessAudit`/`getDataActionHandlerAudit` 寃곌낵瑜?臾띠뼱 醫낇빀 ?먯닔? 議곗튂 ??ぉ??諛섑솚.
- **?щ컻 諛⑹?**: ?ъ씠?쒕컮 audit row `[data-audit-key="essence"]`, `AIO.getAutoOpsReadiness()`, `AIO.getDeploymentGateAudit()`???곌껐. ?꾩껜 ?먯닔 70 誘몃쭔? 諛고룷 寃뚯씠??blocker, warn ?곹깭??諛고룷 寃쎄퀬濡??몄텧. T486~T490?쇰줈 API shape, ?ъ씠?쒕컮 row, AutoOps ?듯빀, 諛고룷 寃뚯씠???듯빀, 紐⑤뱺 page brief 而ㅻ쾭由ъ?瑜??뚭? 寃利?
- **?뚯씪**: `js/aio-core.js`, `index.html`, `js/aio-tests.js`, `_context/RULES.md`

## P345 쨌 v49.65 쨌 [P345/R116] fundamental ?섏씠吏 17 愿???먮룞??留ㅽ듃由?뒪 媛?쒗솕 遺??

- **臾몄젣**: v49.64源뚯? fundamental ?섏씠吏??v49.36 "15 湲곗? 100% 留ㅽ븨" 諛뺤뒪留??쒖떆. ?ъ슜???붿껌 17 愿??(#13 ?뚮옯???앺깭怨??좎꽕)???섏씠吏???놁쓬 ???ъ슜?먭? "??醫낅ぉ 17 愿???먮룞 遺꾩꽍 媛??" ?몄? 遺덇?.
- **?쒖젙 (v49.65)**: index.html L8228~ ?몃씪??諛뺤뒪瑜?17 愿??留ㅽ듃由?뒪濡?媛깆떊 ???????됱긽 諛곗? + 媛?愿?먮퀎 ?곗씠???뚯뒪 ?쒖떆 ([SEC]/[FMP]/[Moat Score]/[TAM]/[Supply Chain] ??. Codex 蹂닿컯?쇰줈 "100% 留ㅽ븨" 怨쇱옣 ?쒗쁽???쒓굅?섍퀬 "17 愿??異쒖쿂/?⑥닔 留ㅽ븨 ?꾨즺 + partial/low-confidence ?쒓퀎 怨좎?"濡??뺤젙.
- **?щ컻 諛⑹?**: T485 ?쇱씠釉?DOM ?뚭? (page-fundamental textContent??"17 愿?? + "v49.65" + partial/?쒓퀎/confidence 怨좎? ?ы븿 寃利?.
- **?뚯씪**: `index.html` L8228~8232

## P344 쨌 v49.65 쨌 [P344/R116/R118] ?ъ씠?쒕컮 audit row 4異???5異?(analysisFramework ?좉퇋)

- **臾몄젣**: v49.59 4異?(registry/web_search/freshness/chatContexts)?먯꽌 17 愿??遺꾩꽍 ?꾨젅?꾩썙???먮룞???섏????ъ씠?쒕컮???놁쓬. ?ъ슜?먭? "17 愿??以?紐?媛??먮룞??" 肄섏넄 紐낅졊?쇰줈留??뺤씤.
- **?쒖젙 (v49.65)**: index.html L3899??`[data-audit-key="analysisFramework"]` row 異붽?. `_aioRefreshAuditWidget` (aio-core.js L8660~)??5踰덉㎏ 遺꾧린 異붽? ??`getAnalysisFrameworkCoverageAudit()` ?몄텧 寃곌낵 `implementedCount/totalCount/coveragePct` ?쒖떆 (>=85% green / >=60% amber / <60% red).
- **?щ컻 諛⑹?**: T484 ?쇱씠釉?DOM ?뚭? (analysisFramework row 議댁옱).
- **?뚯씪**: `index.html` L3899 + `js/aio-core.js` L8674~ widget 媛깆떊

## P343 쨌 v49.65 쨌 [P343/R116/R117] ABSOLUTE RULES 5議???7議?(17 愿???쇰꺼 ?몄슜 + dataConfidence ?섎Т)

- **臾몄젣**: v49.57 ABSOLUTE RULES 5議?([SEC 8-K]/[News]/[Insider]/[13F] 4 ?쇰꺼). v49.65 ?좉퇋 6 ?쇰꺼 ([Supply Chain]/[Partnerships]/[Platform Eco]/[Moat Score]/[Segments]/[TAM]) ?몄슜 ?섎Т 誘몃챸????AI媛 ?숈뒿 ?곗씠?곗뿉??異붿젙 媛??
- **?쒖젙 (v49.65)**: `js/aio-chat.js` `_fetchTickerDataForChat` 諛섑솚 ?띿뒪?몄쓽 ABSOLUTE RULES 媛깆떊:
  - ?좉퇋 6議?(R116): 6 ?좉퇋 ?쇰꺼 ?곗씠?곕쭔 ?몄슜 + ?숈뒿 ?곗씠?곗뿉??怨듦툒???뚰듃?덉떗/?뚮옯???ъ슜?먯닔/MAU/TAM 異붿젙 ?덈? 湲덉?
  - ?좉퇋 7議?(R117): dataConfidence:low/low-medium 遺꾩빞 (Platform/TAM/Moat ?쇰?)??"?뺤꽦 遺꾩꽍 ?쒓퀎 ???몃? ?뺤씤 沅뚯옣" 寃쎄퀬 ?섎Т + "Strong/Wide/Large" 媛뺥븳 ?뺤슜 湲덉?
  - 17 遺꾩꽍 愿??異쒖쿂 留ㅽ븨 ??異붽? (1~17 媛곴컖 ?곗씠???뚯뒪 紐낆떆)
  - fundamental 17 愿??媛?⑹꽦 ??媛깆떊 (??14 / ??3 / ??0)
- **?щ컻 諛⑹?**: T483 ?쇱씠釉?DOM ?뚭? (chat fn source??"17 遺꾩꽍 愿??異쒖쿂 留ㅽ븨" + "R116/R117" + "dataConfidence" ?뺢퇋??寃利?.
- **?뚯씪**: `js/aio-chat.js` `_fetchTickerDataForChat` 諛섑솚 ?띿뒪???앸?遺?

## P342 쨌 v49.65 쨌 [P342/R116] AIO_ANALYSIS_FRAMEWORK_REGISTRY 15 ??17 entries (?ъ슜???붿껌 17 愿??1:1 留ㅽ븨)

- **臾몄젣**: v49.34 ANALYSIS_FRAMEWORK_REGISTRY??15 entries留??뺤쓽. ?ъ슜???붿껌 17 愿??(#13 ?뚮옯???앺깭怨?+ #2 李쎈┰/?깆옣 蹂꾨룄 遺꾨━)??留ㅽ븨 ????
- **?쒖젙 (v49.65)**: REGISTRY 15 ??17 entries ?ш뎄議???`founding-growth` #2 ?좎꽕 (Wikipedia + News 湲곕컲) 쨌 `moat-economic` #7 ?좎꽕 (computeMoatScore ?먮룞 梨꾩젏, Morningstar ?泥? 쨌 `supply-chain` #12 implFn fetchSECSupplyChain 留ㅽ븨 ?꾩꽦 쨌 `platform-ecosystem` #13 ?좎꽕 (fetchPlatformEcosystem 3-source ?⑹꽦) 쨌 `partnership` #14 implFn fetchPartnershipAlerts 留ㅽ븨 ?꾩꽦 (?댁쟾 plannedFn ?붿〈). 媛?entry??num 1~17 ?꾨뱶 異붽? (?ъ슜??17 愿???뺥빀).
- **?щ컻 諛⑹?**: T482 ?쇱씠釉?DOM ?뚭? (fields.length >= 17 + platform-ecosystem/founding-growth/moat-economic ?좉퇋 寃利?.
- **?뚯씪**: `js/aio-core.js` AIO_ANALYSIS_FRAMEWORK_REGISTRY L5078~

## P341 쨌 v49.65 쨌 [P341/R116] 17 愿??遺遺?援ы쁽 4嫄???Moat/Segments/TAM ?먮룞??蹂닿컯

- **臾몄젣**: v49.64源뚯? #6 ?쒗뭹 ?ы듃?대━??/ #7 湲곗닠???댁옄 / #8 ?섏씡 援ъ“ / #11 TAM 紐⑤몢 遺遺?怨꾪쉷留?(Wiki ?숈뒿 ?곗씠???⑤룆 ?섏〈 ?먮뒗 Morningstar ?좊즺 ?꾩닔).
- **?쒖젙 (v49.65)**:
  - **`AIO.computeMoatScore`** (#7): SCREENER_DB + Naver financials ?먮룞 梨꾩젏 ??7媛吏 ?댁옄 ?좏삎 (R&D/留ㅼ텧 >=15% / GM 60%+ / FCF margin 20%+ / OpMargin 20%+ / SG&A ?섎씫 / license-regulatory / network effect memo). Wide(7+)/Narrow(3~6)/None(<3) 10??verdict.
  - **`AIO.fetchFMPSegments` ?듯빀** (#6/#8): `AIO.normalizeFMPSegments()`濡?raw ?묐떟??`{name,revenue,year}`濡??뺢퇋????`[Segments]` ?쇰꺼??二쇱엯. Wiki ?숈뒿 ?곗씠?곕줈 ?좉퇋 ?쒗뭹 ?섍컖 湲덉?.
  - **`AIO.computeTAMEstimate`** (#11): SEC SIC code + AIO_INDUSTRY_TAM_REGISTRY 21 SIC 留ㅽ븨 + SCREENER_DB.memo "TAM:"/"CAGR:" ?⑦꽩 grep. Codex 蹂닿컯?쇰줈 memo 異붿텧媛믪씠 indicators肉??꾨땲??`tamEstimate`/`cagrEstimate`?먮룄 諛섏쁺?섎룄濡??섏젙.
- **?щ컻 諛⑹?**: T479 (computeMoatScore + verdict 遺꾧린) / T480 (computeTAMEstimate + TAM_REGISTRY ?뺤쓽) / T481 (6 ?좉퇋 promise + 6 ?쇰꺼 ?듯빀).
- **?뚯씪**: `js/aio-core.js` (computeMoatScore + computeTAMEstimate + AIO_INDUSTRY_TAM_REGISTRY) + `js/aio-chat.js` _fetchTickerDataForChat

## P340 쨌 v49.65 쨌 [P340/R116/R117] 17 愿??誘멸뎄??3嫄???Supply Chain/Partnership/Platform Ecosystem ?좉퇋 fetch

- **臾몄젣**: v49.64源뚯? ?ъ슜???붿껌 17 愿??以?#12 諛몃쪟泥댁씤/怨듦툒留?/ #13 ?뚮옯???앺깭怨?/ #14 ?묐젰/?뚰듃?덉떗 3嫄?誘멸뎄?? AI媛 ?숈뒿 ?곗씠?곗뿉???섍컖 ?듬? ?꾪뿕.
- **?쒖젙 (v49.65)**:
  - **`AIO.fetchSECSupplyChain`** (#12): SEC 10-K Item 1 (Business) + Item 1C ?ㅼ썙??媛?대뱶. Codex 蹂닿컯?쇰줈 ?ㅼ젣 怨듦툒??異붿텧???꾨땲??`sourceMode:'filing-link+keyword-guide'`, `requiresManualFetch:true`, `dataConfidence:'low-medium'`?꾩쓣 紐낆떆.
  - **`AIO.fetchPartnershipAlerts`** (#14): SEC 8-K Item 1.01 + 7.01 理쒓렐 6媛쒖썡 ?꾪꽣. Codex 蹂닿컯?쇰줈 `fetchSECRecentFilings(opts.max8K)`瑜?異붽??섍퀬 partnership 寃쎈줈??理쒓렐 8-K 40嫄댁쓣 寃??
  - **`AIO.fetchPlatformEcosystem`** (#13): 3-source ?⑹꽦. Codex 蹂닿컯?쇰줈 `SCREENER_DB` 諛곗뿴??`db[ticker]`濡??섎せ 議고쉶?섎뜕 踰꾧렇瑜?`.find(r => r.sym === ticker)`濡??섏젙.
- **?щ컻 諛⑹?**: T476/T477/T478 ?쇱씠釉?DOM ?뚭? + R116 (4異??숈떆 媛깆떊 ?섎Т) + R117 (dataConfidence:low ?섍컖 李⑤떒 ?섎Т) ?좉퇋.
- **?뚯씪**: `js/aio-core.js` L4459~ 3 ?좉퇋 ?⑥닔

## P339 쨌 v49.65 쨌 [P339/R118] TICKER REGISTRY 34% 媛??뺤쭅 ?쒖젙 + placeholder ?쒖쇅 移댁슫??

- **?ъ슜???뺤쭅 吏덉쓽**: "AI 梨꾪똿?먯꽌 ?뚮쭏/?몃젋??醫낅ぉ 紐⑤몢 ?ㅼ뼱媛 ?덉뼱???? ??v49.64 吏꾨떒 寃곌낵 REGISTRY 273 entries / SCR_KEYWORD_ALIASES ~800 ticker = **34% coverage**, 500+ 誘몃벑濡?
- **誘몃벑濡?移댄뀒怨좊━ Top 5**: ?쒓뎅 KOSDAQ 200+ (移댁뭅???ㅼ씠踰??? / ?몃룄 ADR ??뺤＜ (ICICI/HDFC/Kotak) / ?좊읇 ADR (Siemens/Nestl챕/LVMH) / ?쒓뎅 2李⑥쟾吏쨌?뚯옱 / ?좏씎援?e-commerce.
- **?쒖젙 (v49.65)**: REGISTRY 273 ??391 total / 383 real / 8 placeholder (118媛??쒖쬆). Codex 蹂닿컯?쇰줈 `AIO.getTickerRegistryEntryAudit()`瑜?異붽???`_dup/_skip` placeholder瑜?coverage?먯꽌 ?쒖쇅:
  - KR KOSDAQ 50: 2李⑥쟾吏 (?먯퐫?꾨줈/?붿폁/L&F/SK IE Tech) + 諛섎룄泥?(由щ끂怨듭뾽/HPSP/?섎굹留덉씠?щ줎) + 諛붿씠??(?뚰뀒?ㅼ젨/?댁젮/猷⑤떅) + AI (?덉씤蹂댁슦濡쒕낫?깆뒪) + ?뷀꽣/寃뚯엫 (HYBE/JYP/?꾩뼱鍮꾩뒪)
  - KR KOSPI 25: ?뷀븰 (?쒗솕?붾（??濡?뜲/SKI/?섏씠釉? + 諛⑹궛 (KAI/LIG?μ뒪?? + 湲덉쑖 (?좏븳/KB/?섎굹/?곕━) + ?ъ뒪 (??몃━???쒕??쏀뭹)
  - KR ETF 10: TIGER 誘멸뎅?섏뒪??00/S&P500/?뚰겕 + KODEX 湲덊쁽臾??덈쾭由ъ?/?몃쾭??
  - ?몃룄 ADR 8: IBN ICICI / HDB HDFC / INFY / WIT / TTM / RDY
  - ?좊읇 ADR 15: SAP / SIEGY / NSRGY / LVMUY / RHHBY / NVS / UL / DEO / AZN / GSK / TM / HMC / SNY / EADSY
  - ?좏씎援?10: VALE / ITUB / BBD / MELI / SE / GLOB / BIDU / PDD / BABA
  - 誘멸뎅 蹂닿컯 20: ?ъ뒪 (VEEV/EW/BSX/DXCM/MDT/GEHC) + ?듭떊 (T/VZ) + 湲덉쑖 (SCHW/PNC/BK) + ?먯쟾 (TLN/OKLO/SMR) + 寃뚯엫 (NTDOY/SONY)
- **?щ컻 諛⑹?**: T471/T472/T473/T474/T475 ?쇱씠釉?DOM ?뚭? + R118 (placeholder ?쒖쇅 移댁슫?몄? coveragePct 遺꾨━) ?좉퇋.
- **?뚯씪**: `js/aio-core.js` AIO_TICKER_NAME_REGISTRY L2841~ ?좉퇋 移댄뀒怨좊━

## P338 쨌 v49.64 쨌 [P338/R115] Options mock 媛寃?(NVDA $130/SPY $550) ??template + reference-only (?쇰룞 李⑤떒)

- **臾몄젣**: v49.63 P333?먯꽌 Options trade ideas 3 移대뱶??template?뷀뻽?쇰굹 Section 5 ?듭뀡 ?먮쫫 ??6 mock ??(NVDA $130 PUT / SPY $550 PUT / TSLA $400 CALL / AMD $220 CALL / META $520 CALL / AAPL $200 PUT ?뺥솗 ?됱궗媛 + 留뚭린 + ?꾨━誘몄뾼)??洹몃?濡??붿〈. ?ъ슜?먭? "?ㅼ떆媛??듭뀡 ?먮쫫 ?곗씠?곗씤媛?" ?쇰룞.
- **?쒖젙 (v49.64)**: index.html L9981~10040 tbody ?꾩껜瑜??⑥씪 placeholder (colspan=8 + "???듭뀡 ?먮쫫 ?쇱씠釉??쇰뱶 誘몄뿰寃? + "CBOE/ToS/Polygon ?곌껐 ???먮룞 梨꾩썙吏?) + tbody??`data-operational-use="reference-only"` + `data-source="requires-broker-options-feed"` + `data-source-kind="template"` + `data-source-label="options-flow-pending"` 留덊궧. Section 7 trade ideas 3 移대뱶??generic template + ?덈궡 硫붿떆吏 異붽?.
- **?щ컻 諛⑹?**: T469 ?쇱씠釉?DOM ?뚭? ?뚯뒪??(`[data-source-label="options-strategy-template"]` 3+ 移대뱶 寃利?.
- **?뚯씪**: `index.html` L9981~10040 (mock table) + L10198~10236 (trade ideas)

## P337 쨌 v49.64 쨌 [P337/T394] risk-radar-body lineage 遺????decision narrative audit 誘멸?異?

- **臾몄젣**: T394 decision_narrative_without_lineage_is_reference_only ??`#risk-radar-body` 珥덇린 "由ъ뒪???덉씠??濡쒕뵫 以묅? ?띿뒪?멸? `data-operational-use` 留덊궧 ?놁씠 ?쒖떆 ??`getMarketCurrentnessAudit` 媛 narrative 誘몃쭏??sink濡??먮룞 ?먯? 紐삵븿. v49.42~v49.58 ?꾩쟻 ?붿〈.
- **?쒖젙 (v49.64)**: index.html L8454 `#risk-radar-body`??珥덇린 `data-operational-use="reference-only"` + `data-source-kind="unavailable"` + `data-source-label="risk-radar-pending"` 留덊궧. ?띿뒪?몃룄 "?섏떊 ?湲?濡??뺢퇋??(R115). loadRiskRadar ?⑥닔?먯꽌 ?곗씠???꾩갑 ??hook 異붽? ??filtered.length > 0?대㈃ `data-operational-use="decision"` + `data-source-kind="mixed"` + `data-source-label="risk-radar-static+finnhub"` + `data-source-ts` 媛깆떊.
- **?щ컻 諛⑹?**: T470 ?쇱씠釉?DOM ?뚭? (risk-radar-body 珥덇린 lineage 寃利?.
- **?뚯씪**: `index.html` L8454 (珥덇린) + L24144~24180 (loadRiskRadar 媛깆떊 hook)

## P336 쨌 v49.64 쨌 [P336/T263] assertChatResponseAccuracy ?꾧퀎媛?20% ??$150 vs $170.50 (12% ?몄감) false ?먯젙 ?ㅽ뙣

- **臾몄젣**: T263 `assert_chat_response_accuracy: $170 ?뺥솗 + $150 遺?뺥솗` ??QCOM live=$170.50, mock ?묐떟 "QCOM ?꾩옱 $150" ???몄감 -12.02%. 湲곗〈 ?꾧퀎媛?`Math.abs(dev) > 20`?쇰줈 `accurate=true` 諛섑솚 ???뚯뒪??expectation `acc2.accurate === false` ?ㅽ뙣.
- **洹쇰낯 ?먯씤**: T263 test expectation `Math.abs(acc2.deviation) > 10`怨??⑥닔 ?꾧퀎媛?20%??遺덉씪移? 10% ?몄감??媛寃??몄슜 ?뺥솗??痢〓㈃?먯꽌 ?대? "遺?뺥솗" ?먯젙 ?꾩슂.
- **?쒖젙 (v49.64)**: `assertChatResponseAccuracy` ?꾧퀎媛?`> 20` ??`> 10` (T263 ?뺥빀). 異붽?濡?thousand separator ?⑦꽩 `/\$\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\$\d{1,5}(?:\.\d{1,2})?/g` + `replace(/,/g, '')` ?뚯떛 異붽? ($1,234.56 ?뺤떇 吏??.
- **?щ컻 諛⑹?**: T468 ?쇱씠釉?DOM ?뚭? (live._liveData.QCOM=170.50 mock + assertChatResponseAccuracy('QCOM ?꾩옱 $150', ['QCOM']) ??accurate=false 寃利?.
- **?뚯씪**: `js/aio-core.js` L3068~3103 assertChatResponseAccuracy

## P335 쨌 v49.64 쨌 [P335/T176b] CHAT_CONTEXTS ?뺤쟻 2026.04 ?좏겙 5嫄????쇰컲??+ staleRe regex ?뺤옣

- **臾몄젣**: T176b `chat_context_freshness: stale date/event tokens = 0` ?곴뎄 ?ㅽ뙣 ??`js/aio-chat.js` 5怨녹뿉 "2026.04" ?뺤쟻 ?좏겙 ?붿〈: L112 (FOMC ?섏궗濡?二쇱꽍) + L462 (?쒖옣 留λ씫 二쇱꽍) + L463 (?ъ슜??媛??prompt ?ㅻ뜑) + L533/L538 (짠65/짠66 JPM CoWoS 由ъ꽌移??ㅻ뜑). v49.59 Phase 7 ?쒖젙 ?쒕룄?덉쑝???꾨씫.
- **洹쇰낯 ?먯씤**: ?뺤쟻 ?좎쭨????踰??묒꽦?섎㈃ 1媛쒖썡 ??stale. ?쇰컲??留덉빱 ("理쒓렐 遺꾧린" / "2026 Q2") 誘몄궗??
- **?쒖젙 (v49.64)**:
  - aio-chat.js: 5嫄?紐⑤몢 ?쇰컲?? "??026.04 ?쒖옣 留λ씫?? ??"?먯턀洹?遺꾧린 ?쒖옣 留λ씫??. 짠65 "(2026.04)" ??"(理쒓렐 遺꾧린 由ъ꽌移?". 짠66 ?숈씪. FOMC ?섏궗濡?二쇱꽍 ?쇰컲?? L462 二쇱꽍 v49.64 留덉빱.
  - aio-core.js staleRe regex ?뺤옣: `/2026\.04(\.\d+)?|2026\.05\.(0[1-9]|1[0-5])/` 異붽? ???ν썑 2026.04 / 2026.05 珥덈컲 ?좏겙 ?먮룞 ?먯? (4???꾩껜 + 5??1~15??.
- **?щ컻 諛⑹?**: ?뺤쟻 ?좎쭨 ?ъ슜 湲덉? 沅뚯옣 + staleRe ?뺢린 ?먭? (v49.65?먯꽌 6???좏겙 ?먮룞 stale濡??뺤옣).
- **?뚯씪**: `js/aio-chat.js` L112/L462/L463/L533/L538 + `js/aio-core.js` L6963 staleRe

## P334 쨌 v49.64 쨌 [P334/R115] Loading copy ?뺢퇋??11+怨???"怨꾩궛 以?/"濡쒕뵫 以? ?곴뎄 ?쒖떆 ??"?섏떊 ?湲?/"?섏쭛 ?湲? ?쒖?

- **Codex v49.61 ?붿뿬 諛쒓껄**: home market-regime (ATH/VIX ?덈꺼/VIX %ile) / risk-monitor (VIX ?좊Ъ/RSP-SPY/F&G) / sentiment badge / AAII / macro FRED / temperature / kr-macro 6 ETF ??紐⑤뱺 ?ъ슜??媛??placeholder媛 "怨꾩궛 以? / "濡쒕뵫 以? / "遺꾩꽍 以? ?ъ슜. ?섏씠吏 吏꾩엯 ???곴뎄 ?붿〈?섏뿬 "?곗씠??誘몄닔?? ?몄? 遺덇?.
- **?쒖젙 (v49.64)**: 11+ ?꾩튂 紐⑤몢 "?섏떊 ?湲? (incoming) / "?섏쭛 ?湲? (collecting) / "?щ━ ?낅젰 ?섏떊 ?湲? / "嫄곗떆 ?낅젰 ?섏떊 ?湲? ?쒖??? kr-macro 6 ETF??`replace_all` ?쇨큵. sent-overall-badge "遺꾩꽍 以?.." ??"?щ━ ?낅젰 ?섏떊 ?湲? (T467 ?뺥빀).
- **?щ컻 諛⑹?**: **R115 ?좉퇋** (?ъ슜??媛??placeholder ?띿뒪?몃뒗 "?섏떊 ?湲?/"?섏쭛 ?湲? ?쒖? ?섎Т, "怨꾩궛 以?/"濡쒕뵫 以? 湲덉?). T463 ?쇱씠釉?DOM ?뚭? (5 sink 寃利? + T467 (sent-overall-badge 寃利?.
- **?뚯씪**: `index.html` L4592/4603/4605 (home) + L4827/4848/4869 (risk) + L5740 (sent) + L5905 (AAII) + L7089 (FRED) + L7262 (temp) + L10746~10781 (kr-ETF 6怨?

## P333 쨌 v49.63 쨌 [P333/R114] Options trade ideas mock 媛寃????ㅼ떆媛?vs ?덉떆 ?쇰룞 ?꾪뿕

- **Codex v49.61 諛쒓껄**: index.html L10168~10207 ?듭뀡 嫄곕옒 ?꾩씠?붿뼱 ?뱀뀡??"SPY 550 Call 留ㅻ룄 (4/18)" / "?꾨━誘몄뾼 $2.40" 媛숈? mock 媛寃⑹씠 ?ㅼ떆媛꾩쿂???쒖떆.
- **?쒖젙 (v49.64 ?닿?)**: generic template ("蹂댁쑀 ETF ??OTM Call 留ㅻ룄" / "蹂?숈꽦 ?꾨━誘몄뾼 ?섏랬") + `data-operational-use="reference-only"` / `data-source-kind="template"` ?띿꽦. wizardly v49.63? ?쒓컙??蹂대쪟.
- **?щ컻 諛⑹?**: R114 (?몃? ?뚰겕?몃━ ?듯빀 ???섏씠吏 ?ㅽ뻾 寃利??섎Т) ?곸슜.

## P332 쨌 v49.63 쨌 [P332/R114] Breadth 20SMA 70%+ green ?쒖떆 ??怨쇱뿴 ?좏샇 ?꾨씫 ?뺤콉 蹂寃?

- **Codex v49.61 諛쒓껄**: index.html L5030~5032 `bb-20sma-bar` width 75% ?곹깭?먯꽌 background green + "媛뺤꽭" ?쇰꺼 ??怨쇱뿴 ?꾪뿕 ?좏샇 ?꾨씫. THRESHOLD.BREADTH 70%+ amber band? 遺덉씪移?
- **?쒖젙 (v49.63)**: bar background `var(--data-green)` ??`var(--data-amber)`, val color ?숈씪 蹂寃? badge "媛뺤꽭" / `rgba(0,229,160,0.1)` ??"怨쇱뿴" / `rgba(255,163,26,0.1)`.
- **?щ컻 諛⑹?**: T458 ?쇱씠釉?DOM ?뚭? ?뚯뒪??(amber + "怨쇱뿴" ?쇰꺼 寃利?.
- **?뚯씪**: `index.html` L5030~5032

## P331 쨌 v49.63 쨌 [P331/R114] v49.62 ?쒕㈃ ?듯빀 ??Codex 35% ?꾨씫 ?뺤쭅 ?쒖젙

- **?ъ슜???뺤쭅 吏덉쓽**: "3455 ?뚰겕?몃━ 紐⑤몢 諛섏쁺? ?꾩돩???? 洹쇰낯 蹂닿컯 + ?щ컻 諛⑹??"
- **3 Explore agent 吏꾨떒 寃곌낵**: v49.62 ?듯빀 ??4 ?곸뿭 stub留?cherry-pick (T451~T454 "?⑥닔媛 ?뺤쓽?섏뿀??). Codex ?ㅼ젣 ?섎룄 (T412~T429 "?섏씠吏媛 ?ㅼ젣濡??⑥닔瑜??몄텧?섍퀬 DOM??蹂寃쎈맂??) 14 ?뚯뒪???꾨씫. aio-ui.js 100以?/ aio-data.js 134以?/ index.html 736以?以??덈컲 / aio-tests.js 14 ?뚯뒪??誘명넻??= **35% ?꾨씫**.
- **寃⑹감 蹂몄쭏**: ?⑥쐞 ?뚯뒪??(?⑥닔 議댁옱) vs ?듯빀 ?뚯뒪??(?섏씠吏 ?ㅽ뻾) ???뚭? 諛⑹? 媛移?5諛?李⑥씠.
- **?쒖젙 (v49.63)**:
  - sentiment Canvas fallback 74以?(Chart.js 誘몃줈????8 李⑦듃 polyfill + initSentimentPage guard)
  - FRED ?대갚 50以?(_stampFredReference + _drawFredFallback + _drawAllFredFallback, API ??誘몄꽕????reference-only)
  - Breadth 20SMA CRITICAL ?됱긽 ?뺤콉 (green ??amber + "怨쇱뿴" ?쇰꺼)
  - T455~T462 8 ?쇱씠釉?DOM ?뚭? ?뚯뒪??(`_testV4963CodexFullIntegration`)
- **?щ컻 諛⑹? R114 ?좎꽕**: ?몃? ?뚰겕?몃━ ?듯빀 ???⑥닔 議댁옱 + ?섏씠吏 ?ㅽ뻾 + DOM 蹂寃?3以?寃利??섎Т. v49.62 ??v49.63 ?뺤쭅 ?쒖젙 ?좊?瑜?R114 ?듭떖 洹쇨굅濡??몄슜.
- **?붿뿬 (v49.64 ?닿?)**: Options template??+ Loading copy 11怨??뺢퇋??+ aio-data.js _applyFearGreedScore 38以?+ data-source ?띿꽦 7以?
- **?뚯씪**: `js/aio-ui.js` L69~150 sentiment fallback + L443~ initSentimentPage guard 쨌 `js/aio-data.js` L2592~2655 FRED fallback 쨌 `index.html` L5030~5032 Breadth amber 쨌 `js/aio-tests.js` _testV4963CodexFullIntegration + Group59 ?깅줉 쨌 `_context/RULES.md` R114

---

# AIO Screener ??踰꾧렇 ?ы썑 遺꾩꽍 濡쒓렇 (Bug Postmortem)

> 紐⑤뱺 踰꾧렇 ?섏젙 ???ш린??湲곕줉. QA/?먭? ?묒뾽 ??諛섎뱶???쎄퀬 湲곗〈 ?⑦꽩 ?뺤씤.
> 理쒖떊 ??ぉ???꾩뿉 ?ㅻ룄濡???닚 湲곕줉.
>

## P329 쨌 v49.59 쨌 [P329/R109] Claude ??誘몄엯????silent fail ???ъ슜???몄? ?ㅽ뙣

- **3 Explore agent UX 議곗궗 諛쒓껄**: chatSend Claude ??寃利????쇰컲 ?띿뒪??alert留??쒖떆. ?ъ슜?먭? ?ъ씠?쒕컮 ?꾩튂 ?몄? ?대젮?. ?좉퇋 ?ъ슜??泥??쒕룄 醫뚯젅.
- **?쒖젙**: inline alert 媛뺥솕 ("??Claude API ???낅젰 ?꾩슂 + console.anthropic.com 留곹겕 + sk-ant- ?뺤떇 ?덈궡") + ?ъ씠?쒕컮 input border 鍮④컙??pulse (3珥? + ?먮룞 focus.
- **?뚯씪**: `js/aio-chat.js` L3229 chatSend Claude ??寃利?釉붾줉

## P328 쨌 v49.59 쨌 [P328] AAII ?꾧퀎媛?-10/+10 ??-5/+5 fine-tune

- **3 Explore agent 諛쒓껄**: spread -7.3 (bull 35.7 / bear 43)??"以묐┰"?쇰줈 遺꾨쪟?섏뼱 ?쏀븳 鍮꾧? ?좏샇 ?꾨씫. P196 蹂댁젙 (T196) 異붽? fine-tune.
- **?쒖젙**: `AIO_THRESHOLD_REGISTRY.AAII.bands` ?꾧퀎媛?醫곹옒 ??以묒젙??鍮꾧? 踰붿쐞 -20~-5 / 以묐┰ 踰붿쐞 -5~+5濡?蹂寃?
- **?뚯씪**: `js/aio-core.js` AAII bands

## P327 쨌 v49.59 쨌 [P327/R112] 14 CHAT_CONTEXTS ?뺥빀??audit 遺?????뚭? 誘멸컧吏

- **3 Explore agent 諛쒓껄**: 14 CHAT_CONTEXTS??system() ?몄텧 ?깃났 ?щ?, 湲몄씠, _getChatRules ?몄텧 ?щ?, dynamic injection ?⑦꽩 ?먮룞 寃利?遺?? ?좉퇋 ?섏씠吏 異붽? ???뚭? 寃異??대젮?.
- **?쒖젙**: `AIO.auditAllChatContexts()` ?좉퇋 ?⑥닔. system() ?몄텧 ?깃났/?ㅽ뙣, 湲몄씠, ?숈쟻 ?⑦꽩 (_currentTickerId/_currentThemeId/_liveData/DATA_SNAPSHOT), _getChatRules ?몄텧 ?щ? ?먮룞 寃利? ?ъ씠?쒕컮 audit ?꾩젽??chatContexts row 異붽?.
- **?щ컻 諛⑹? R112**: 紐⑤뱺 CHAT_CONTEXTS??_getChatRules() ?몄텧 ?섎Т.
- **寃利?*: `AIO.auditAllChatContexts().validCount === totalContexts` 紐⑺몴.
- **?뚯씪**: `js/aio-core.js` `AIO.auditAllChatContexts` ?좉퇋 + `_aioRefreshAuditWidget` ?뺤옣 + `index.html` L3886 ?꾩젽 row

## P326 쨌 v49.59 쨌 [P326/R109] fxbond ?쒓뎅 湲덈━ ?ㅻ깄???쒖젏 紐⑦샇 ???섍컖 ?꾪뿕

- **3 Explore agent 諛쒓껄**: fxbond context??krBond3y/krBond10y媛 "?ㅻ깄??湲곗?" 紐낆떆 遺?? ?ъ슜?먭? "吏湲??쒓뎅 10Y 湲덈━?" 吏덈Ц ????誘멸뎅 10Y留??ㅼ떆媛? ?쒓뎅? ?뺢린 諛쒗몴 (BOK MPC/KRX) ?ㅻ깄?룹씤???쒖젏 遺덈챸??
- **?쒖젙**: fxbond system()??"?쒓뎅 湲덈━ [?ㅻ깄?? ?좎쭨 ???ㅼ떆媛?fetch ?놁쓬]" 留덉빱 + BOK 湲곗?湲덈━ + 3Y/10Y ?숈쟻 二쇱엯 + ?섍컖 李⑤떒 ?덈궡.
- **?뚯씪**: `js/aio-chat.js` L795 fxbond context system() IIFE

## P325 쨌 v49.59 쨌 [P325/R106] options ?섏씠吏 CHAT_CONTEXTS 遺?????듭뀡 遺꾩꽍 silent fallback

- **3 Explore agent 諛쒓껄**: aio-chat.js L4952??`options:{}` 諛쒓껄?섎굹 Chart.js ?듭뀡 媛앹껜. 吏꾩젙??CHAT_CONTEXTS.options 誘몄젙?????듭뀡 ?섏씠吏 吏꾩엯 ??basic fallback.
- **?쒖젙**: index.html??`window.CHAT_CONTEXTS['options']` override 異붽?. PCR/PCR Equity/PCR Index/VIX/VVIX/SKEW ?숈쟻 二쇱엯 + _currentTickerId ?쒖슜 (湲곗큹?먯궛 媛寃? + 5異??듭뀡 遺꾩꽍 ?꾨젅??(IV Surface/Percentile/Skew/Term Structure/GEX) + ?쒖옣 ?섍꼍蹂??꾨왂 留ㅽ븨.
- **?щ컻 諛⑹?**: R106 (???섏씠吏 CHAT_CONTEXTS ?좉퇋 ??_currentXxxId ?먮룞 二쇱엯) ?⑦꽩 ?곕쫫.
- **?뚯씪**: `index.html` L17613~ options CHAT_CONTEXTS override

## P324 쨌 v49.59 쨌 [P324/R110] signal/breadth/sentiment CHAT_CONTEXTS ?ㅻ뜲?댄꽣 誘몄＜?????섍컖 ?붿〈

- **3 Explore agent 諛쒓껄**: signal context???꾨젅?꾨쭔 ?뺤쓽 / breadth??_breadth5/200/50留??ъ슜 (20 ?뺤쓽 ?먯껜 ?ㅻ쪟) / sentiment??F&G + VIX留? AAII/SKEW/VVIX ??6 吏??遺??
- **?쒖젙**:
  - signal: AIO_ACTION_RULES (v49.5) ?숈쟻 ?됯? (HOLD_CORE/TRIM_X/EXIT_OR_HEDGE ?먮룞 異붿쿇 + VIX/score 踰붿쐞蹂?留ㅽ븨)
  - breadth: AIO.diagnoseBreadthConsensus ?몄텧 + DATA_SNAPSHOT ?대갚 (breadth5sma/20sma/50sma/200sma)
  - sentiment: 6 吏??Tail Risk Board (VIX/VVIX/SKEW/MOVE/VIX9D vs VIX3M structure/AAII spread/PCR/HY OAS)
- **?щ컻 諛⑹? R109**: signal/breadth/sentiment context???쇱씠釉??섏튂 ?먮룞 二쇱엯 ?섎Т.
- **?뚯씪**: `js/aio-chat.js` L868 signal / L906 breadth / L928 sentiment system() ?⑥닔

## P323 쨌 v49.59 쨌 [P323] Pre-existing 15 FAIL ?붿뿬 (v49.42 ?댁쟾 援ъ“ 蹂寃??뺥빀 遺??

- **3 Explore agent 諛쒓껄**: T317/T318? v49.41?먯꽌 auditStatus瑜?'partial' string ??6異?object 濡??꾪솚?덉쑝??test 誘멸갚?? T300? home subSections 8 ??15 ?뺤옣, test 誘몃컲?? T303? chips 7 ??13 ?뺤옣. T233? ?쇱씠釉??됱긽 蹂寃?vs static amber 遺덉씪移?
- **?쒖젙 (test 蹂댁젙)**:
  - T317/T318: `=== 'partial'` ??`=== 'partial' || (typeof === 'object')` 議곌굔 ?뺤옣
  - T300: `=== 8` ??`>= 8` 踰붿쐞 ?덉슜
  - T303: `=== 7` ??`>= 7` ?덉슜 (chips 異붽? ?덉슜)
  - T233: THRESHOLD.BREADTH.getLabel ?뺥빀 議곌굔 異붽?
  - T294: ?섏씠吏 ??諛곗? 1媛쒕? ?좊줈 蹂寃?(SEC 10-K ?泥?媛??
- **?뚯씪**: `js/aio-tests.js` 5 test 蹂댁젙 + `index.html` L8212 (T294 ???꾪솚)



## P322 쨌 v49.58 쨌 [P322/R108] Audit 11 ?⑥닔 肄섏넄 ?꾩슜 ???ъ슜???먭? 吏꾨떒 遺덇?

- **3 Explore agent 議곗궗 諛쒓껄**: assertTickerRegistryCompleteness/getWebSearchAudit/getChatContextFreshnessAudit ??11 audit ?⑥닔媛 肄섏넄?먯꽌留??몄텧 媛?? ?ъ슜?먭? ?ъ씠?쒕컮/??쒕낫?쒖뿉??吏곸젒 ?쒖뒪??嫄닿컯???뺤씤 遺덇?.
- **?쒖젙**: ?ъ씠?쒕컮 API ???뱀뀡 ?섎떒??`.aio-audit-widget` 而댄뙥??移대뱶 ?좎꽕. 3媛??듭떖 audit 寃곌낵 + `?뵇 Claude ??寃?? ?좉? (localStorage ?곕룞) + `?뱿 諛깆뾽 / ?뱾 蹂듭썝 / ?봽 ?먮룞` 3 踰꾪듉 (`AIO.exportApiKeys/importApiKeys/recoverApiKeysFromIdb` ?몄텧). 5遺??먮룞 媛깆떊.
- **?щ컻 諛⑹? R108**: audit ?⑥닔 異붽? ???ъ씠?쒕컮 ?꾩젽?먮룄 ?몄텧 ?섎Т.
- **?뚯씪**: `index.html` L3886 ?꾩젽 DOM + `js/aio-core.js` `_aioRefreshAuditWidget`/`_aioWebSearchToggle`/`_aioExportKeys`/`_aioImportKeysPrompt`/`_aioRecoverKeys` ?몃뱾??5媛?

## P321 쨌 v49.58 쨌 [P321/R107] _fetchTickerDataForChat Promise.all timeout 遺????梨꾪똿 ?묐떟 30珥? hang

- **3 Explore agent 議곗궗 諛쒓껄**: 醫낅ぉ??11+ fetch 蹂묐젹 ???쇰? hang (Yahoo CORS 李⑤떒/SEC EDGAR ?묐떟 吏?? ???꾩껜 ?묐떟 30珥??湲? ?ъ슜??寃쏀뿕 ???
- **洹쇰낯 ?먯씤**: 湲곗〈 `await secPromise` ?⑦꽩??timeout ?놁씠 臾댄븳 ?湲?
- **?쒖젙**: `_withTimeout(promise, ms, fallback)` helper ?좎꽕. 11媛?promise (sec/wiki/sec8K/fhNews/insider/13F/fcf/balance/ev/macro/short) 紐⑤몢 2.5珥?timeout?쇰줈 ?섑븨.
- **?щ컻 諛⑹? R107**: 梨꾪똿 fetch??諛섎뱶??Promise.allSettled + 媛쒕퀎 timeout ?섎Т.
- **寃利?*: ?묐떟 ?쒓컙 ??4珥?(?댁쟾 30珥?).
- **?뚯씪**: `js/aio-chat.js` L1848 `_withTimeout` ?뺤쓽 + L1871~1884 11 promise ?섑븨

## P320 쨌 v49.58 쨌 [P320/R104] v49.35 Roadmap 6 ?⑥닔 ?뺤쓽留?/ 梨꾪똿?먯꽌 誘명샇異????섍컖 ?붿〈

- **3 Explore agent 議곗궗 諛쒓껄**: computeFcfYield/computeBalanceSheetRatios/computeEvEbitda/computeMacroBeta/fetchFinnhubShortInterest 5 ?⑥닔媛 aio-core.js L3756~3943???뺤쓽?먯쑝??`_fetchTickerDataForChat`?먯꽌 ?몄텧 0?? fundamental ?섏씠吏?먯꽌留??ъ슜. 梨꾪똿?먯꽌 FCF/EV/Macro ??遺꾩꽍 ???숈뒿 ?곗씠???섏〈.
- **?쒖젙**: 5 promise 異붽? + system ?꾨＼?꾪듃 ?쇰꺼 5 ?좉퇋 ([FCF Yield], [Balance Sheet], [EV/EBITDA], [Macro Beta], [Short Interest]). ABSOLUTE RULES "援ы쁽 6??1" ?낅뜲?댄듃.
- **?щ컻 諛⑹?**: R104 "_fetchTickerDataForChat ??fetch 異붽? ??ABSOLUTE RULES ?숆린 ?뺤옣 ?섎Т" ?⑦꽩 ?곕쫫.
- **?뚯씪**: `js/aio-chat.js` L1877~1884 5 promise + L2070~2105 5 ?쇰꺼 + L2114 ABSOLUTE RULES ?낅뜲?댄듃

## P319 쨌 v49.58 쨌 [P319/R106] ticker / market-news ?섏씠吏 CHAT_CONTEXTS ?꾩쟾 ?꾨씫

- **3 Explore agent 議곗궗 諛쒓껄**: 14 CHAT_CONTEXTS ?섏씠吏 enumerate 寃곌낵 ticker? market-news ?섏씠吏 而⑦뀓?ㅽ듃 ?뺤쓽 遺?? ticker???ъ슜?먭? 媛???먯＜ ?ㅼ뼱媛???섏씠吏 ??梨꾪똿 吏꾩엯 ??basic fallback留??ъ슜. v49.57 R105 (themes _currentThemeId ?⑦꽩) 誘명솗??
- **?쒖젙**: index.html L17501??`window.CHAT_CONTEXTS['ticker']` + `window.CHAT_CONTEXTS['market-news']` override ?좉퇋. `window._currentTickerId` 留덉빱 (showTicker / fundamentalSearch 2 吏??set). ticker system()??5異??꾨젅?꾩썙??+ market-news system()???댁뒪 罹먯떆 ?먮룞 二쇱엯 + web_search ?먮룞 ?몃━嫄?
- **?щ컻 諛⑹? R106**: ???섏씠吏 CHAT_CONTEXTS ?좉퇋 ??window._currentXxxId ?먮룞 二쇱엯 ?섎Т.
- **?뚯씪**: `index.html` L17501~17615 ticker/market-news override + `js/aio-core.js` L12717 showTicker + `js/aio-chat.js` L3774/3970 fundamentalSearch 留덉빱 set



## P318 쨌 v49.57 쨌 [P318/R104] Claude web_search 議곌굔遺 ?듯빀 (寃??API ?놁씠 ?몃젋???댁뒪)

- **?ъ슜??蹂닿퀬**: "寃??API ?놁쑝硫?湲곗뾽??醫낅ぉ???묒쭏??理쒖떊 ?곗씠??紐?媛?몄??"
- **洹쇰낯 ?먯씤**: AIO Screener??SEC/Finnhub/Yahoo/Naver/Wikipedia ?뺣웾 80% + ?뺤꽦 70% 而ㅻ쾭?섎굹, breaking ?댁뒪/?몃젋???좏뵿/?좊꼸 由ы룷??蹂몃Ц? ?뺤쟻 臾대즺 API濡?紐?媛?몄샂. Perplexity/Google CSE???좊즺/???꾩슂.
- **?쒖젙**: `_shouldUseClaudeWebSearch(q, ctxId, detectedTickers)` ?대━?ㅽ떛 ?좎꽕 (?쒖젏 ?ㅼ썙???섏씠吏 而⑦뀓?ㅽ듃/?곗빱+?대깽?????놁쓣 ???대갚) + `reqBody.tools = [{type:'web_search_20250305', max_uses:3}]` 議곌굔遺 二쇱엯 + `localStorage.aio_web_search_enabled='off'` opt-out + `AIO.getWebSearchAudit()` ?듦퀎
- **?щ컻 諛⑹?**: `localStorage.setItem('aio_web_search_enabled','off')` 紐낆떆??鍮꾪솢?? max_uses 3 ?쒗븳?쇰줈 鍮꾩슜 媛?? ?대━?ㅽ떛 strict (?⑥닚 ?뺤쓽 吏덈Ц? ??諛쒕룞)
- **寃利?*: `_shouldUseClaudeWebSearch('?ㅻ뒛 NVDA ?댁뒪', 'ticker', ['NVDA'])` === true. `AIO.getWebSearchAudit().enabled === true && calls >= 0`
- **?뚯씪**: `js/aio-chat.js` `_shouldUseClaudeWebSearch` + `callClaude` reqBody.tools + chatSend webSearch opts ?꾨떖. `js/aio-core.js` `AIO.getWebSearchAudit`

## P317 쨌 v49.57 쨌 [P317/R104] _fetchTickerDataForChat 源딆씠 遺議???8-K/News/Insider/13F ?꾨씫 ???섍컖

- **?ъ슜??蹂닿퀬**: "媛?醫낅ぉ?ㅺ낵 湲곗뾽?ㅼ쓽 理쒖떊 ?뺣낫? ?곗씠?곕뱾??媛?몄삤怨??덈뒗 吏 ?몃??섍쾶 議곗궗"
- **洹쇰낯 ?먯씤**: v49.34?먯꽌 SEC 10-K + Wikipedia 2 ?뚯뒪留?二쇱엯. AI媛 "理쒓렐 NVDA ?몄닔 諛쒗몴" 媛숈? 吏덈Ц???숈뒿 ?곗씠??2024~2025) ?섏〈 ???섍컖 ?꾪뿕. Items 5.02 CEO 蹂寃?Items 2.02 ?ㅼ쟻 ?ъ쟾 怨듭떆 媛숈? event-driven 8-K, Finnhub 14???댁뒪, ?꾩썝 留ㅼ닔/留ㅻ룄, 13F 蹂댁쑀 ???꾨씫
- **?쒖젙**: 4媛?fetch 異붽? ??`AIO.fetchSECRecentFilings` (placeholder ???ㅼ젣 8-K 5嫄??뚯떛), `AIO.fetchFinnhubCompanyNews` ?좎꽕 (Top 5 14??, `AIO.fetchFinnhubInsider` (湲곗〈 ?⑥닔 ?쒖꽦), `AIO.fetchSEC13F` (URL ?덈궡). system ?꾨＼?꾪듃 ?쇰꺼 6媛쒕줈 ?뺤옣
- **?щ컻 諛⑹?**: ABSOLUTE RULES 5議?異붽? ??"??[SEC 8-K]/[News]/[Insider]/[13F] 釉붾줉 ?곗씠?곕쭔 ?몄슜. ?숈뒿 ?곗씠??嫄곗떆 ?ш굔 ?섍컖 ?덈? 湲덉?. 釉붾줉 鍮꾩뼱 ?덉쑝硫?'?곗씠???놁쓬 ??吏곸젒 ?뺤씤 沅뚯옣'"
- **寃利?*: `await _fetchTickerDataForChat(['NVDA'])` ?묐떟??`[SEC 8-K]`, `[News]`, `[Insider]` ?쇰꺼 ?ы븿
- **?뚯씪**: `js/aio-chat.js` L1857~1862 (4 ?좉퇋 promise) + L1953 ?댄썑 (4 ?쇰꺼 push). `js/aio-core.js` `fetchSECRecentFilings` 媛뺥솕 + `fetchFinnhubCompanyNews` ?좎꽕

## P316 쨌 v49.57 쨌 [P316/R103] AIO_TICKER_NAME_REGISTRY 47媛???SCR_KEYWORD_ALIASES 543 ticker ?쒓? ?몄떇 媛?133媛?

- **?ъ슜??蹂닿퀬**: "吏湲??ㅼ뼱媛 ?덈뒗 醫낅ぉ怨?湲곗뾽??遺꾩꽍 ?꾩뿉 ?뚮쭏/?몃젋?쒖뿉 ?덈뒗 醫낅ぉ?ㅼ? 紐⑤몢 ?ㅼ뼱媛 ?덈뒗 吏 ?뺤씤"
- **洹쇰낯 ?먯씤**: v49.32?먯꽌 AIO_TICKER_NAME_REGISTRY 47媛?(硫붽?罹?30 + KR 17)留??깅줉. SCR_KEYWORD_ALIASES 259 ?뚮쭏 / 543 unique ticker 以?133媛?24%)媛 誘몃벑濡????쒓?/蹂꾨챸 寃???ㅽ뙣 ("諛붿씠???뚮씪?⑦떛?? ??VKTX 蹂??????
- **?쒖젙**: REGISTRY 47 ??152 entries ?쇨큵 ?뺤옣 (US 80 + KR 5 + ADR 12). 諛섎룄泥댁옣鍮?8 / ?대씪?곕뱶 12 / GLP-1 8 / ?먯쟾 8 / ?곗＜ 5 / ?묒옄 4 / ?щ┰??8 / 愿묓넻??8 / EV 8 / 濡쒕낫?깆뒪 4 / ?곗씠?곗꽱??10 / ?붾씪 8 / 誘몃뵒??6 / ?먮꼫吏 8 / 諛⑹궛 8 / ?뚮퉬 10 / ?ы뻾 7 / ?ъ뒪 5 / 寃뚯엫 6 / AI 5 異붽?. CIK_MAP 50 ??134 entries ?숈떆 ?뺤옣 (SEC EDGAR fetch 媛??醫낅ぉ ?뺣?)
- **?щ컻 諛⑹?**: `AIO.assertTickerRegistryCompleteness()` ?좎꽕 ??SCR_KEYWORD_ALIASES vs REGISTRY ?뺥빀 ?먮룞 寃利?+ missingTickers 30媛쒓퉴吏 由ы룷??+ coveragePct. R103 洹쒖튃 ?깅줉. `AIO.getThemeFetchCoverageAudit(themeId)` ?좎꽕 ??ticker 횞 5梨꾨꼸(SEC/Wiki/Finnhub/FMP/Naver) 留ㅽ듃由?뒪
- **寃利?*: `AIO.assertTickerRegistryCompleteness().coveragePct >= 80`. `Object.keys(AIO_TICKER_NAME_REGISTRY.entries).length === 152`
- **?뚯씪**: `js/aio-core.js` L2316~2540 REGISTRY ?뺤옣 + L3828~3920 CIK_MAP ?뺤옣 + L2410~2510 ?좉퇋 audit 2媛?


> **??갭議??쒓렇**: 媛?踰꾧렇 ??ぉ??`violated_rule: R{N}` ?쒓렇瑜?湲곕줉?섏뿬 洹쒖튃?믩쾭洹???텛??媛??
> `/knowledge-lint` L7 ?④퀎?먯꽌 "R5 ?꾨컲 3????洹쒖튃 媛뺥솕 ?꾩슂" 媛숈? 鍮덈룄 遺꾩꽍 ?먮룞 ?섑뻾.

---

## 臾몄꽌 愿由??먯튃

### P 踰덊샇 泥닿퀎
- **P 踰덊샇 = ?⑦꽩 踰덊샇** (?덈갑 洹쒖튃 ID). ?숈씪 洹쇰낯 ?먯씤??媛吏?踰꾧렇??媛숈? P 踰덊샇濡?李몄“.
- **?⑥“ 利앷?**: ?좉퇋 P 踰덊샇??`next_P_number`?먯꽌 ?쒖옉 (?꾩옱 **P208**). ?쒕쾲 遺?щ맂 踰덊샇???ъ궗??湲덉?.
- **P 踰덊샇 ?ш컯??*: 媛숈? ?⑦꽩???щ컻?대룄 踰덊샇???좎?. "P25 ?ш컯?? / "P25 媛뺥솕" 媛숈? ?쒗쁽?쇰줈 body??湲곕줉.
- **?좎쭨 援щ텇 ?먯튃**: 怨쇨굅 以묐났 P 踰덊샇(P26~P33 ?쇰? 異⑸룎 議댁옱)??"?좎쭨 + 踰꾩쟾"?쇰줈 援щ텇?댁꽌 李몄“.

### 踰꾧렇 異붽? ?덉감
1. frontmatter??`next_P_number` ?뺤씤 ???대떦 踰덊샇濡?踰꾧렇 body ?묒꽦
2. body ?묒꽦 ??frontmatter ?낅뜲?댄듃:
   - `last_verified: YYYY-MM-DD` (?ㅻ뒛)
   - `latest_version: v{N}.{M}` (?섏젙??踰꾩쟾)
   - `latest_P_number: P{?ъ슜??踰덊샇}`
   - `next_P_number: P{?ъ슜??踰덊샇+1}`
   - `total_entries: {?댁쟾媛?1}`
3. ?꾨옒 "理쒓렐 P 踰덊샇 ?몃뜳????1以?異붽? (P41 ?댄썑留?愿由?
4. `CHANGELOG.md`???????ぉ 異붽? (?숈씪 ?몄뀡???꾩닔)

### 踰꾧렇 body ?꾩닔 ?꾨뱶
```markdown
### BUG-{N}: {??以??붿빟} ({HIGH|MEDIUM|LOW|CRITICAL})
- **violated_rule**: R{N} ?먮뒗 "?좉퇋 P{N}"
- **利앹긽**: ?ъ슜?먭? 蹂??꾩긽 (?붾㈃/肄섏넄/?숈옉)
- **洹쇰낯 ?먯씤**: 肄붾뱶/?곗씠??援ъ“ ?덈꺼 ?먯씤 (?⑥닚 "X ?섏젙" ?꾨떂)
- **?섏젙**: 蹂寃??뚯씪 + ?쇱씤 踰덊샇 + ?듭떖 diff
- **?덈갑**: P{N} ???щ컻 諛⑹? 洹쒖튃 (吏㏐퀬 紐낇솗?섍쾶)
```

---

## 理쒓렐 P 踰덊샇 ?몃뜳??(P41~P68)

> P1~P40? ?섎떒 "?⑦꽩 ?붿빟" ?뚯씠釉?李몄“. P41 ?댄썑???꾩쟻 愿由?

| P | ?꾩엯 踰꾩쟾 | ?좎쭨 | ?⑦꽩 ?붿빟 |
|---|-----------|------|-----------|
| P212 | v49.21 | 2026-05-16 | CHAT_CONTEXTS??`'kr-macro'`, `'kr-supply'`, `'kr-themes'`, `'kr-tech'` 4媛??ㅺ? ?놁뼱??`chatSend('kr-macro')` ?몄텧 ??`var ctx = CHAT_CONTEXTS[ctxId]; if (!ctx) return;` ?먯꽌 臾댁쓬 ?ㅽ뙣. KR ?섏씠吏 AI 梨꾪똿???꾪? ?숈옉?섏? ?딆븯?? `_CTX_TOPIC_MAP`??topic 留ㅽ븨留??덇퀬 system() ?⑥닔媛 ?녿뒗 ?곹깭. `js/aio-chat.js` ??4媛?KR system() ?⑥닔瑜??쎌엯(BOK 湲곗?湲덈━쨌KOSPI쨌KRW쨌VKOSPI ?ㅼ떆媛??ㅻ깄??+ 遺꾩꽍 ?먯튃 釉붾줉). `kr-home-kosdaq-comment`??"?멸뎅??湲곌? ?숇컲 留ㅻ룄 쨌 媛쒖씤 ?濡?諛⑹뼱" ?붿뿬 stale ?띿뒪?몃룄 鍮?臾몄옄?대줈 ?쒓굅(P210). R54 `data-aio-archive` 留덊궧 ?먯튃 臾몄꽌?? T180~T182 ?뚭? ?뚯뒪??異붽?. |
| P210 | v49.21 | 2026-05-16 | v49.20??`kr-idx-kosdaq-comment`(10404)???뺣━?덉쑝???ъ옄???먮쫫 ?뱀뀡 `kr-home-kosdaq-comment`(10472)??"?멸뎅??湲곌? ?숇컲 留ㅻ룄 쨌 媛쒖씤 ?濡?諛⑹뼱" ?ш굔 ?섏〈 ?띿뒪?멸? ?붿〈. P212? ?④퍡 v49.21?먯꽌 泥섎━. T182 ?뚭? ?뚯뒪?멸? ???⑦꽩??媛먯?. |
| P209 | v49.20 | 2026-05-16 | v49.17~18???곷Ц/誘멸뎅 10?섏씠吏 DOM stale???뺣━?덉쑝?? ?쒓뎅?쒖옣 5?섏씠吏(kr-home/kr-supply/kr-themes/kr-macro/kr-technical)???숈씪??freshness audit?먯꽌 ?쒖쇅?섏뼱 ?덉뿀?? DOM?먯꽌 "?멸뎅??7嫄곕옒???곗냽 ?쒕ℓ??, "3-4???꾩쟻 30議?", "4/8 異붿젙", "?대? ?ы삊???ш컻 ?꾨쭩", "媛쒖씤 留ㅼ닔???좎엯 쨌 諛붿씠??媛뺤꽭" ??HIGH stale 11嫄?諛쒓껄. ?ш굔 ?섏〈 肄붾찘?몃뒗 鍮?臾몄옄??JS媛 ?숈쟻 梨꾩?), ?좎쭨 留덉빱???쒓굅, 二쇨컙?섍툒 ???뺤콉?쇱젙 ?뚯씠釉붿? `data-aio-archive="true"` 留덊궧. `CRITICAL_PAGE_GROUPS.krMarket` 異붽?, `getCriticalKrPageFreshnessAudit()` ?좎꽕, stale regex??KR ?좏겙 5媛?異붽?(P211 ?듯빀), T177~T179 ?뚭? ?뚯뒪??異붽?. |
| P208 | v49.19 | 2026-05-15 | v49.18??DOM ?뺤쟻 湲곕낯媛믪? ?뺣━?덉?留?AI 梨꾪똿 ?쒖뒪???꾨＼?꾪듃(`CHAT_CONTEXTS`)??2026-04-12~18 ?섎뱶肄붾뵫 ?좎쭨쨌?대? ?묒긽 寃곕젹쨌Warsh 痍⑥엫 ?쒕굹由ъ삤쨌BLS Apr CPI +0.6%쨌?⑦떚 4/18 ?ъ“?빧룹씠?щ씪留덈컮???묒긽 ??stale ?좏겙??LLM?먭쾶 "?꾩옱 ?곹솴"?쇰줈 二쇱엯?섎뒗 P0 ?몄텧 踰꾧렇. `js/aio-chat.js` 13媛?吏???섏젙(?좎쭨 留덉빱 ?쒓굅, ?쒖젏 ?섏〈 ?뱀뀡 ??젣, ?앸룞 ?ㅻ깄??蹂??李몄“濡?援먯껜), `AIO.getChatContextFreshnessAudit()` ?뚯뒪 ?덈꺼 媛먯궗 API(`Function.prototype.toString` + stale ?뺢퇋??, T176 ?뚭? ?뚯뒪??異붽?. totalHits === 0 ?뺤씤. |
| P207 | v49.18 | 2026-05-15 | The previous v49.17 work proved that the critical 10 pages were in the audit set, but it did not yet prove their actual visible content was inspected line by line. Static DOM review found old live-like defaults in signal risk narratives, macro FOMC/energy copy, FX/bond KRW and yield fields, sentiment AAII date text, HOME top live pills, and a themes tooltip that could be read as a May 7 date. Replaced stale defaults with live placeholders or snapshot-backed wording, marked briefing archive blocks with `data-aio-archive`, made `AIO.getCritical10PageFreshnessAudit()` exclude archive content, and added T173~T175 regression tests for stale live-like tokens and hardcoded quote defaults. |
| P206 | v49.17 | 2026-05-15 | The previous freshness work strengthened Theme/Trend, but there was no explicit operational proof that the 10 top-level pages the user cares about most ??comprehensive `home/signal/breadth/sentiment/briefing` and market-analysis `technical/macro/fxbond/fundamental/themes` ??were audited as a fixed set. Several pages also had narrower quote requirements than their visible widgets used, especially FX/bonds, macro, briefing, and fundamental. Added `AIO.CRITICAL_PAGE_GROUPS`, `AIO.getCritical10PageFreshnessAudit()`, broadened the 10 pages' data requirement profiles, added visible input ticker harvesting for signal/technical/fundamental/ticker, and added T170~T172 to guard 10-page audit coverage and no-thin-profile regressions. |
| P205 | v49.16 | 2026-05-15 | Theme/Trend pages could look automatically refreshed at the broad scheduler level while their full leader/subtheme symbol universe was not part of the page freshness profile. Sector/theme rankings also retained old static pct fallback values that could render as current-like market leadership when live quotes were missing. Added dynamic page symbol collection for `THEME_MAP`, `SUB_THEMES`, `KR_SUB_THEMES`, `KR_THEME_MAP`, and RRG ETF sets; wired `AIO.ensureFreshDataForUse()` to pass required symbols into `fetchLiveQuotes()` batch requests; changed theme performance to return `LIVE_REQUIRED`/`missing` instead of 0%; disabled static sector pct fallback for current rankings and 20-day charts; added T165~T169 to guard dynamic theme profiles and no-static-current ranking behavior. |
| P204 | v49.15 | 2026-05-15 | Automatic freshness still depended on broad periodic schedules, so a page or AI answer could assemble prompts before stale quote/news/macro/technical layers had a chance to refresh. Added page/chat-level data requirement profiles, `AIO.getAutoFreshnessPlan()`, `AIO.getAutoDataContinuityAudit()`, and `AIO.ensureFreshDataForUse()`; made scheduled functions return their fetch promises; added per-task scheduler timeouts; wired chat and unified AI preflight to run bounded refresh before data prompt assembly; added T161~T164 to guard planner, preflight, and continuity contracts. |
| P203 | v49.14 | 2026-05-14 | AI chat used the current session messages but did not inject saved recent chat summaries into the next prompt, so similar questions could repeat the same explanation. The unified AI panel also limited single-ticker deep collection mostly to `fundamental` or explicit deep-analysis keywords, weakening `themes`, `theme-detail`, and `portfolio` ticker questions. Added `_classifyChatIntent`, `_buildChatMemoryContext`, `_buildChatIntentContext`, and `_shouldSingleDeepAnalyzeChat`; wired them into both `chatSend` and `chatSendUnified`; added T157~T160 to guard intent detection, repetition suppression, explicit missing-data labeling, and theme-context deep data collection. |
| P202 | v49.13 | 2026-05-14 | ?쒗빑?ы솕/媛꾩냼?붴앸? 異붽? ?ㅻ챸 ?덉씠?대줈 ?닿껐?섎㈃ 湲곗〈 ?섏씠吏 ?먯껜???ъ쟾??蹂듭옟??梨??덈궡臾몃쭔 ?섏뼱?섎뒗 臾몄젣媛 ?덉뿀?? v49.12??decision strip, secondary badges, forced explain summaries瑜?compact view?먯꽌 ?쒓굅?섍퀬, 湲곗〈 ?곸꽭/李멸퀬/?꾩뭅?대툕 肄섑뀗痢좊? ?묒뼱 泥??먮떒 ?먮쫫?먯꽌 諛?대궡??諛⑹떇?쇰줈 ?섏젙. T152~T156???ъ젙?섑빐 ?ν썑 媛꾩냼???묒뾽??異붽? ?ㅻ챸???㏓텤?대뒗 諛⑺뼢?쇰줈 ?뚭??섏? ?딄쾶 ??|
| P201 | v49.12 | 2026-05-14 | 湲곌?湲?遺꾩꽍 ?붾㈃???뺣낫?됱씠 留롮븘 珥덈낫?먭? ?쒕㉫? 蹂?寃??먮떒/?ㅼ쓬 ?됰룞?앹쓣 ?볦튂硫?湲곕뒫? 留롮븘???ㅼ젣 留ㅻℓ 猷⑦떞?쇰줈 ?곌껐?섏? ?딅뒗 臾몄젣媛 ?덉뿀?? 21媛??섏씠吏??`AIO_PAGE_CORE_GUIDES` watch/decide/next 怨꾩빟??異붽??섍퀬, Page Focus Brief??decision strip, ?듭떖 蹂닿린 ?좉?, ?곸꽭/李멸퀬 蹂댁“ ?뱀뀡 ?쇰꺼, T152~T156 ?뚯뒪?몃? ?꾩엯??蹂듭옟???꾨Ц 遺꾩꽍??泥??붾㈃?먯꽌???됰룞 移대뱶濡??뺤텞 |
| P200 | v49.11 | 2026-05-14 | Persistent auto-ops gap: static `DATA_SNAPSHOT`/`data-snap-date`/pinned event text could age while still looking live-like. Added `AIO.getStaticDataGovernanceAudit()`, `AIO.auditStaticTextFreshness()`, `AIO.renderStaticDataGovernanceBadges()`, `AIO.getAutoOpsReadiness()`, `AIO.getRefreshSchedulerAudit()`, `AIO.runScheduledRefresh()`, `AIO.forceRefreshAllData()`, and T146~T151 so stale static data, scheduler health, freshness, and pipeline status are continuously inspectable and manually refreshable. |
| P199 | v49.10 | 2026-05-14 | Blow-off Top/OPEX/?대깽???뚯쭊 遺꾩꽍??湲곗〈 technical exit engine怨?遺꾨━?섏뼱 ?덉쑝硫?CPI ?뺤씤 ?댄썑?먮룄 ?쏞PI ?덉젙??媛숈? stale 留λ씫?대굹 Telegram 2李??뚯뒪媛 ?뺤젙 ?댁뒪泥섎읆 ?듬????꾪뿕???덉뿀?? `calcBlowoffTopChecklist()`, Technical Brief 泥댄겕由ъ뒪??UI, sell-pressure ?곌껐, CPI/H2 liquidity prompt guardrail, Aether Telegram pipeline audit, T144~T145 ?뚯뒪?몃줈 怨쇱뿴 ?좊━ ?먮떒??議곌굔遺 ?ъ???愿由ъ? ?댁뒪 寃利??뺤콉??臾띠쓬 |
| P198 | v49.9 | 2026-05-13 | ?ㅼ젣 ?ъ씠???섏씠吏蹂?sweep?먯꽌 紐⑤컮???ы듃?대━???뚯튂由ъ뒪??select ?띿뒪?멸? 而⑦듃濡???쓣 ?섍퀬, ?곗빱 ?곸꽭 breadcrumb/back 踰꾪듉???고??꾩뿉 `onclick` ?띿꽦???ㅼ떆 ?앹꽦??v48.32 ?대깽???꾩엫 ?먯튃??源⑥쭏 ???덉뿀?? ?뚯튂由ъ뒪??而⑦듃濡ㅼ쓣 以꾨컮轅????쒗븳/吏㏃? 湲곕낯 臾멸뎄濡??뺣━?섍퀬, `showTicker()`???ㅻ줈媛湲?寃쎈줈瑜?`data-action="showPage"` + `data-arg`濡??듭씪?덉쑝硫?T143?쇰줈 ?고???`onclick` ?щ컻??留됱쓬 |
| P197 | v49.8 | 2026-05-13 | ?ㅼ젣 ?ъ씠??理쒖떊??媛먯궗?먯꽌 HOME ?듭떖 ?댁뒪媛 5/4~5/9 吏???대깽?몃? ?꾩옱 珥됰ℓ泥섎읆 怨좎젙 ?몄텧?섍퀬, ?뺤쟻 fallback snapshot??2026-05-11/12 湲곗???癒몃Ъ??珥덈낫?먭? ?ㅻ옒???곗씠?곕줈 留ㅻℓ ?먮떒???꾪뿕???덉뿀?? `DATA_SNAPSHOT`??2026-05-13 湲곗? 理쒖떊 ?뺤씤媛믪쑝濡?媛깆떊?섍퀬, `_aioGetCurrentHomeWeeklyNews()` 72?쒓컙 ?꾪꽣? T141~T142 ?뚯뒪?몃? 異붽???怨쇨굅 ?대깽?멸? 湲곕낯 HOME???щ벑?ν븯吏 紐삵븯寃???|
| P196 | v49.7 | 2026-05-13 | Chrome ?ㅼ륫 ?뚯뒪?몄뿉??technical prompt consistency ?ㅽ뙣 ??`CHAT_CONTEXTS`媛 lexical global `const`濡쒕쭔 議댁옱?섍퀬 `window.CHAT_CONTEXTS`???몄텧?섏? ?딆븘 T115/T132媛 action ladder/Lockout OPEX ?꾨＼?꾪듃瑜?李얠? 紐삵뻽?? `js/aio-chat.js`?먯꽌 `window.CHAT_CONTEXTS = CHAT_CONTEXTS`瑜?紐낆떆??釉뚮씪?곗? 吏꾨떒/AI 而⑦뀓?ㅽ듃 怨꾩빟??蹂듦뎄 |
| P195 | v49.7 | 2026-05-13 | ?섏씠吏 ?듭떖??蹂닿컯 ?곌껐 ?꾨씫 ???ㅼ젣 ?쇱슦?몃뒗 `ticker`/`theme-detail`?몃뜲 釉뚮━???ㅼ젙? `ticker-detail`留?媛뽮퀬 ?덉뼱 ?쇰? ?곸꽭 ?섏씠吏?먯꽌 珥덈낫???쒖슜 猷⑦떞???뚮뜑?섏? ?딆븯?? ?듭뀡 IV ?쒕룄 ?ㅻ옒???ㅼ쟻?쇨낵 以묐났 AAPL ?됱씠 理쒖떊 ?곗씠?곗쿂??蹂댁씪 ???덉뿀怨? 寃쎌젣 罹섎┛??怨좎젙 ?대깽?몃뒗 吏??珥됰ℓ瑜??덉젙泥섎읆 ?뚮뜑留곹뻽?? ?ㅼ젣 ?쇱슦???ㅻ? 蹂닿컯?섍퀬 ?듭뀡 ?쒕? 援먯쑁???덉떆濡??щ씪踰⑤쭅, past-event ?꾪꽣? stale ?대깽??臾멸뎄 ?뚯뒪??T137~T139 異붽? |
| P194 | v49.7 | 2026-05-13 | ?섏씠吏蹂??ㅻ챸/湲곕뒫 ?숈꽑 怨쇰? ???щ윭 ?섏씠吏??湲??댁꽕怨?以묐났 媛쒕뀗???욎뿬 珥덈낫?먭? 泥??붾㈃?먯꽌 臾댁뾿??癒쇱? 蹂닿퀬 ?대뼡 ?섏씠吏濡??댁뼱媛???섎뒗吏 ?먮떒?섍린 ?대젮?. `AIO_PAGE_BRIEFS`, `_aioRenderPageBrief`, `_aioSimplifyExplainLabels`濡??섏씠吏 紐⑹쟻쨌3?④퀎 猷⑦떞쨌愿???섏씠吏 ?대룞???쒖??뷀븯怨?湲??댁꽕? ?묓엺 ?곸꽭 ?⑤꼸濡??꾩닚?꾪솕 |
| P193 | v49.6 | 2026-05-12 | ?뺤쟻 fallback seed 理쒖떊???쒕━?꾪듃 ???쇱씠釉?API媛 ?ㅽ뙣/荑쇳꽣/罹먯떆 ?곹깭????湲곕낯 ?붾㈃???ㅻ옒??F&G쨌PCR쨌?쒓뎅?쒖옣쨌FX 媛믪쓣 ?ㅼ떆媛꾩쿂???꾨떖???꾪뿕. `DATA_SNAPSHOT` 諛?`_fallback`??US/KR 吏?? USD/KRW, DXY, oil, Cboe put-call, CNN/AAII seed瑜?2026-05-12 湲곗??쇰줈 媛깆떊?섍퀬 live store override ?먯튃??note??紐낆떆 |
| P192 | v49.5 | 2026-05-12 | Lockout Rally/OPEX ?꾨왂 濡쒖쭅 遺????RSI/怨쇱뿴留뚯쑝濡?珥덈낫?먭? 留ㅻ룄 ?먮떒???ㅽ빐?????덇퀬, OPEX 媛먮쭏 吏吏 ?쏀솕쨌???뺤옣 ?ㅽ뙣쨌留먮떒 罹붾뱾쨌20MA ATR/ADR ?뺤옣???섎굹???됰룞 ?щ떎由щ줈 ?듯빀?섏? 紐삵뻽?? `calcExtensionHeat`, `classifyTerminalCandle`, `calcOpexGammaRisk`, `calcBreadthRotation`, `calcLockoutAction`, Lockout Control UI, T125~T132 ?뚯뒪???꾩엯 |
| P191 | v49.4 | 2026-05-10 | ?곗씠??理쒖떊???먮룞 媛깆떊 嫄곕쾭?뚯뒪 遺?????뺤쟻 DATA_SNAPSHOT, live quote, fallback, macro/news stale 湲곗???遺꾩궛?섏뼱 ?대갚媛믪씠 ?ㅼ떆媛꾩쿂??蹂댁씪 ???덉뿀?? `FRESHNESS_POLICY`, `makeMetric`, `evaluateMetric`, `SnapshotStore`, `_aioSetLiveData`, `AIO.auditAllFreshness()`? scheduler telemetry, T116~T124 ?뚯뒪???꾩엯 |
| P190 | v49.3 | 2026-05-10 | ?꾩닔媛먯궗 蹂닿퀬??湲곗? ?꾪궎?띿쿂 ?덉씠??遺?????곗씠???덉쭏, ?댁뒪 ?곹뼢, ?ы듃?대━??湲곗닠 由ъ뒪?? AI ?명봽??怨쇱뿴???쒕줈 ?ㅻⅨ ?쒖??쇰줈 泥섎━?섏뼱 ?붾㈃/AI/由ъ뒪???꾨떖?깆씠 ?⑥뼱吏? `calcDataQuality`/`calcAIInfraHeat`/`calcPositionTechnicalRisk`/`calcPortfolioTechnicalRisk`/`calcNewsImpactVector` ?꾩엯 |
| P189 | v49.2 | 2026-05-09 | 湲곗닠遺꾩꽍 紐⑤뱢 OHLCV ?⑥씪 ?ㅻ깄??遺????硫붿씤 湲곗닠?쒕뒗 ?뱀씪 ?깅씫瑜?媛꾩씠媛? ?λ텇?앹? OHLCV ?ㅼ젣媛믪쓣 ?ъ슜???먮떒 ?쇨???泥?궛 ?ㅽ뻾?깆씠 ??쓬. `calcTechnicalSnapshot`/`calcSellPressure`/`calcSemiHeatMap`/`calcExitPlan` ?꾩엯 |
| P188 | v49.1 | 2026-05-09 | Claude ?듯빀 ??browser acceptance drift ??`_aioLRU.get()` miss 怨꾩빟(null)怨??몄텧遺(undefined check) 遺덉씪移섎줈 `fetchAllNews` null.tm 移섎챸 濡쒓렇, VaR 瑗щ━ 媛쒖닔 遺?숈냼??寃쎄퀎, DOMPurify 誘몃줈??fallback ?대깽???띿꽦 臾몄옄???붿〈, LightweightCharts ?대? canvas ?묎렐??媛먯궗 ?ㅽ깘 |
| P187 | v49.1 | 2026-05-09 | history.pushState ?꾩뿭 hijack(monkey-patch) + _fmtNum Infinity 鍮꾩쿂由???popstate ?몃뱾?ъ뿉??showPage 以?history.pushState瑜?function(){}濡?援먯껜, finally濡?蹂듦뎄. _aioInPopstate ?뚮옒洹몃줈 ?泥? _fmtNum(Infinity)??InfinityT" ?ㅽ몴?? _aioFiniteNum ?꾩엫 |
| P186 | v49.1 | 2026-05-09 | vixToPercentile 80?댁긽 ?섎뱶罹?99.5 ??VIX=85/90 紐⑤몢 99.5濡??숈씪 ?쒖떆, ?⑥“利앷? ?뚭눼. 濡쒓렇?몄궫 ?곸슜. _aioMemoStaleInfo 3??11??DST 짹1h ?좎쭨 鍮꾧탳 ?ㅻ쪟 |
| P185 | v49.1 | 2026-05-09 | _chartIv raw setInterval ??Chart.js 濡쒕뱶 ?湲?setInterval????대㉧ ?덉??ㅽ듃由??몃??먯꽌 ?ㅽ뻾, 以묐났 ?깅줉 ??湲곗〈 ?뺣━ ?놁쓬. _aioRegisterTimer('chartReady') 留덉씠洹?|
| P184 | v49.1 | 2026-05-09 | 11媛??꾩뿭 蹂??window 吏곸젒 李몄“ ?곗옱 ??prevPage쨌_lastPageShownFire쨌_currentTickerSym ??namespace ?놁쓬. window.AIO.state 珥덇린??+ Object.defineProperty shim + _aioGlobalRegistry ?깅줉 |
| P183 | v49.0 | 2026-05-09 | _renderFundValuation P/E쨌P/B쨌PEG쨌EV/EBITDA ??API 鍮꾩쑉??|| 0 ?⑦꽩 ??Infinity.toFixed()??Infinityx" ?뚮뜑. _aioFiniteNum 媛?쒕줈 援먯껜 |
| P182 | v49.0 | 2026-05-09 | scoreItem 罹먯떆쨌_tickerRegexCache 臾댄븳 ?깆옣 ???댁뒪 ?ㅼ퐫??諛섎났 ?몄텧 ??Map 利앷? ?≪젣?? _aioLRU(200/600 cap) 援먯껜 |
| P181 | v49.0 | 2026-05-09 | applyDataSnapshot 100+ data-snap ?⑥씪 try-catch ??1嫄?throw ???꾩껜 snap 媛깆떊 以묐떒. ?ㅻ퀎 ?낅┰ try-catch 遺꾪빐 |
| P180 | v48.99 | 2026-05-09 | index.html 22嫄?addEventListener 遺꾩궛 ???섏씠吏蹂??댁젣 遺덇?. _aioPageBus B3 留덉씠洹?|
| P179 | v48.99 | 2026-05-09 | aio-data.js 4嫄?addEventListener 遺꾩궛 ??_aioPageBus B2 留덉씠洹?|
| P178 | v48.99 | 2026-05-09 | aio-core.js 9嫄?addEventListener 遺꾩궛 ??_aioPageBus B1 留덉씠洹?|
| P177 | v48.98 | 2026-05-09 | aio-core.js ?꾨컲 NaN/Infinity/遺꾨え0 鍮꾧?????Fund P/E쨌PEG쨌EV/EBITDA 遺꾨え 0 ??Infinity ?뚮뜑 ?꾪뿕. _aioFiniteNum + _aioSafeDiv 異붽? |
| P176 | v48.98 | 2026-05-09 | ?숈씪 珥덇린???⑥닔 以묐났 ?몄텧 ?꾪뿕 + 11媛??꾩뿭 蹂??namespace ?곗옱 ??_aioOnce + _aioGlobalRegistry濡??ъ쟾 ?명봽??援ъ텞 |
| P175 | v48.98 | 2026-05-09 | aio:pageShown 17嫄?쨌 aio:liveQuotes 18嫄?媛쒕퀎 addEventListener 遺꾩궛 ???섏씠吏 ?댄깉 ???댁젣 遺덇?, listener ?꾩쟻 ?꾪뿕. _aioPageBus ?⑥씪 ?쇱슦???덈툕 異붽? |
| P174 | v48.97 | 2026-05-08 | localStorage API ??5媛?吏곸젒 ?묎렐 遺꾩궛 ???뷀샇??留덉뒪???쇨????놁쓬, UI???됰Ц ?몄텧 ?꾪뿕 |
| P173 | v48.97 | 2026-05-08 | IndexedDB ?댁뒪 ?덉퐫?쒖뿉 ?대찓?셋룹쟾?붾쾲??PII ?됰Ц ?????濡쒖뺄 釉뚮씪?곗? DB?댁?留?媛쒕컻?먮룄援?諛깆뾽 寃쎈줈 ?몄텧 |
| P172 | v48.97 | 2026-05-08 | API ?ъ떆???뺤콉 誘멸뎄?????쇱떆??502/503 ?먮윭 ???⑥닚 return null, 吏??諛깆삤???놁쓬 |
| P171 | v48.97 | 2026-05-08 | CORS ?꾨줉??3媛??숈떆 ?ㅼ슫 ??silent fail ???⑥씪 ?꾨줉???ㅻ쪟媛 諛붾줈 null 諛섑솚, ?대갚 ?놁쓬 |
| P170 | v48.96 | 2026-05-08 | ?ы듃?대━???뚯씠釉?th/td headers 誘몄뿰寃???WCAG 1.3.1(?뺣낫쨌愿怨? ?꾨컲, ?ㅽ겕由곕━?????쒕ぉ 誘몃룆 |
| P169 | v48.96 | 2026-05-08 | Fund ???꾪솚 ??lightweight-charts width=0 ??鍮꾪솢????뿉??李⑦듃 ?뚮뜑 ?????꾪솚 ??width 誘몃났援?|
| P168 | v48.96 | 2026-05-08 | canvas devicePixelRatio 誘몄쟻?????덊떚??HiDPI ?붾㈃?먯꽌 canvas ?뚮뜑 釉붾윭 |
| P167 | v48.96 | 2026-05-08 | Chart.js ?몄뒪?댁뒪 destroy ?놁씠 ?ъ깮????Fund waterfall ??諛섎났 ?щ젋?????몄뒪?댁뒪 ?꾩쟻, 硫붾え由??꾩닔 |
| P166 | v48.95 | 2026-05-08 | lastKrTradingDay: 15:30(?λ쭏媛?~16:00(EOD ?곗씠???뺤젙) grace window 誘몃컲????誘명솗???쒓컙???"?ㅻ뒛 醫낃?" ?쒖떆 |
| P165 | v48.95 | 2026-05-08 | scoreItem._kwHit: .includes(kw) ?ъ슜 ???④???'湲???'湲덈━','湲덉쑖','鍮꾧툑?????ㅻℓ移????댁뒪 ?ㅼ퐫???쒓끝 |
| P164 | v48.95 | 2026-05-08 | _calcSharpe: std===0 鍮꾧탳 ??遺?숈냼?섏젏 near-zero(1e-15 ?섏?)?먯꽌 0 鍮꾧탳 ?ㅽ뙣 ??Infinity 諛섑솚 |
| P163 | v48.95 | 2026-05-08 | _pearsonCorr: denA===0 鍮꾧탳 ??遺?숈냼?섏젏 near-zero(e.g. 1e-30) 遺꾨え?먯꽌 0 鍮꾧탳 ?ㅽ뙣 ??NaN 諛섑솚 |
| P162 | v48.95 | 2026-05-08 | _calcPortfolioVaR: Math.floor((1-conf)*n) nearest-neighbor 諛⑹떇 ??R-7 ?좏삎蹂닿컙 ?鍮?寃쎄퀎媛믪뿉??理쒕? 1?④퀎 ?ㅼ감 |
| P161 | v48.94 | 2026-05-08 | applyTechIndicators: parseFloat() 寃곌낵瑜?NaN 寃???놁씠 .toFixed() ?몄텧 ??吏??1媛?NaN?대㈃ ?꾩껜 ?⑥닔 throw |
| P160 | v48.94 | 2026-05-08 | chatSend('fundamental'): fundamentalSearch() ??chatSend 臾댄븳 ?ъ쭊??媛????_fundDepth ?곹븳 2 誘멸뎄??|
| P159 | v48.94 | 2026-05-08 | fetchNaverUSData: Promise.all ?ъ슜 ??3媛?以?1媛?reject ???섎㉧吏 ?곗씠??紐⑤몢 ?먯떎 |
| P158 | v48.94 | 2026-05-08 | AI chat: renderMarkdownLight() 寃곌낵瑜?DOMPurify 2李??놁씠 innerHTML ?쎌엯 ??AI ?묐떟 XSS ?붿뿬 寃쎈줈 violated_rule: R31(XSS 諛⑹?) |
| P157 | v48.91 | 2026-05-08 | SEC EDGAR API ?묐떟(CIK쨌SIC쨌嫄곕옒?뙿룰났??form/date/desc) innerHTML 二쇱엯 ??escHtml() ?꾨씫 XSS ?꾪뿕 |
| P156 | v48.91 | 2026-05-08 | _renderFundHeader: FMP API 湲곗뾽 ?ㅻ챸(description) 300???덈떒 ??escHtml() ?놁씠 innerHTML ?쎌엯 XSS |
| P155 | v48.91 | 2026-05-08 | _searchCitationsHTML: ?밴???API ?묐떟 URL/domain??escHtml() ?놁씠 href쨌?띿뒪???쎌엯 ??XSS ?꾪뿕 |
| P154 | v48.85 | 2026-05-07 | Price/percent pipeline must preserve missing percent semantics across PriceStore, Yahoo/Naver/Stooq/FX, KR health, and benchmark charts |
| P153 | v48.84 | 2026-05-07 | Chart/quote render must distinguish missing data from zero: leading null chart values stay null, and price-only quotes show unknown change instead of +0.00% |
| P152 | v48.82 | 2026-05-06 | Source/API-to-render lineage audit missing; use `AIO.getDataPipelineAudit()` to verify functions, stores, scheduler, and DOM/chart sinks |
| P41 | v42.1 | 2026-04-05 | ?댁뒪 ?쒖떆 而댄룷?뚰듃 理쒖냼 5?붿냼(?쒕ぉ/?ㅻ챸/?붿빟/?뚯뒪/?쒓컙) ?뚮뜑留?|
| P42 | v42.1 | 2026-04-05 | 吏??以묐났 ?쒖떆 諛⑹? ???숈씪 ?곗씠???щ윭 ?뱀뀡 ???쒖そ留??쒖떆 |
| P43 | v42.1 | 2026-04-05 | stale DOM reference ??`getElementById` 寃곌낵 null?대㈃ HTML???대떦 ID ?ㅼ옱 ?뺤씤 |
| P44 | v42.4 | 2026-04-06 | bar ?붿냼??`querySelector('div')` ?꾩뿉 ?대떦 ?붿냼 ?먯껜媛 bar?몄? ?뺤씤 |
| P45 | v42.4 | 2026-04-06 | HTML `data-snap="X"` 異붽? ??`applyDataSnapshot()` map???숈씪 ??議댁옱 ?뺤씤 |
| P46 | v42.4 | 2026-04-06 | Dead Static HTML ???숈쟻 ?곗씠???쒖떆 ?붿냼??諛섎뱶??ID 遺??+ update ?⑥닔 ??援ы쁽 |
| P47 | v42.4 | 2026-04-06 | raw Canvas 2D 李⑦듃??`clearRect()` + ?곹깭 由ъ뀑, `destroyPageCharts()` 耳?댁뒪 ?꾩닔 |
| P48 | v42.4 | 2026-04-06 | DATA_SNAPSHOT 媛깆떊 ??釉뚮젅?쒖벐 諛곗뿴(bpLabels/bhLabels/bp*) ?숈떆 媛깆떊 泥댄겕由ъ뒪??|
| P49 | v42.4 | 2026-04-06 | ?섎뱶肄붾뵫 ?곗씠??2??湲곗? stale ?쒖떆 (`getDataAge()` days > 1) |
| P50 | v42.3 | 2026-04-06 | flex/grid 而⑦뀒?대꼫 ???띿뒪?????`flex:1;min-width:0` ?꾩닔 |
| P51 | v42.3 | 2026-04-06 | ?섏씠吏 init ?⑥닔 ?몄텧 ???대떦 canvas/DOM ?ㅼ옱 ?뺤씤, 援먯감 ?몄텧 湲덉? |
| P52 | v42.5 | 2026-04-06 | TECH_KW/MACRO_KW ?ㅼ썙??異붽? ??len < 3 泥댄겕 + 湲곗〈 諛곗뿴 ??湲??숈쓽??議댁옱 ?뺤씤 |
| P53 | v42.5 | 2026-04-06 | ???붿빟 ?섏튂??R15 ?곸슜 ?꾩닔. `?.` + `\|\| ?レ옄` 議고빀 湲덉? |
| P54 | v42.5 | 2026-04-06 | 3?④퀎 score ?꾧퀎媛?怨좎젙: ??90+) / 釉뚮━??45+) / ?쇰뱶(30+) |
| P55 | v42.5 | 2026-04-06 | font-size CSS class ?뺤쓽??11px ?댁긽 ?뺤씤. inline override??class 誘명룷??|
| P56 | v42.6 | 2026-04-06 | init ?⑥닔 ??cleanup 猷⑦봽 以묐났 湲덉? ("?앹꽦 ??利됱떆 destroy" ?⑦꽩 寃異? |
| P57 | v42.6 | 2026-04-06 | 怨좎젙 `repeat(N,1fr)` 洹몃━??mobile 375px ?ㅻ쾭?뚮줈 ?뺤씤 ??6???댁긽 auto-fit/minmax |
| P58 | v42.7 | 2026-04-06 | applyDataSnapshot map ??異붽? ??HTML??`data-snap="?대떦??` ?ㅼ옱 ?뺤씤 |
| P59 | v42.7 | 2026-04-06 | API ?묐떟 ?섏〈 ?꾩뿭 蹂?섎뒗 ?뺤쟻 ?대갚(DATA_SNAPSHOT)?쇰줈 珥덇린???꾩닔 |
| P60 | v42.7 | 2026-04-06 | 蹂듭닔 ?섏씠吏 ?숈씪 ?곗씠???쒖떆 ??媛??섏씠吏 liveQuotes 由ъ뒪?덉뿉 怨듯넻 update ?⑥닔 ?곌껐 |
| P61 | v44.6 | 2026-04-08 | DATA_SNAPSHOT ?섏튂 媛깆떊 ???섎뱶肄붾뵫 ?쒖닠 ?띿뒪??肄붾찘???뱀뀡/?쒕굹由ъ삤) ?뺥빀??泥댄겕 蹂묓뻾 |
| P62 | v44.6 | 2026-04-08 | "???⑥닔??X瑜??쒗쁽?????녿떎" ?먮떒 ??WARN 諛⑹튂 湲덉? ??援ъ“ ?뺤옣?쇰줈 ?닿껐 |
| P63 | v44.6 | 2026-04-08 | 紐⑤뱺 setInterval 諛섑솚媛믪? `window._xxxInterval` 蹂????? setInterval/clearInterval ???쇱튂 |
| P64 | v44.9 | 2026-04-09 | SCREENER_DB ?좉퇋 醫낅ぉ 異붽? ??KNOWN_TICKERS ?뚰뙆踰녹닚 ?숈떆 ?깅줉 |
| P65 | v45.6 | 2026-04-09 | ???뱁꽣 釉뚮━???꾩쟾 ?섎뱶肄붾뵫 ???ㅼ떆媛?_liveData ?뱁꽣 ETF 湲곕컲 ?숈쟻 ?앹꽦?쇰줈 援먯껜 |
| P66 | v45.6 | 2026-04-09 | macro Pro CHAT_CONTEXTS ?쒕굹由ъ삤 ?섏튂媛 ?대깽???댁쟾 洹뱀젏??怨좎갑 ??_liveSnap() ?ㅼ떆媛?二쇱엯 |
| P67 | v45.6 | 2026-04-09 | signal VIX "?? ?곴뎄 ?뺤껜 ??quotes 誘몄닔????_liveData/DATA_SNAPSHOT ?대갚 泥댁씤 |
| P68 | v45.6 | 2026-04-09 | data-refresh ?ㅽ궗???쒓뎅???섍툒/?뚮쭏(H4~H5) + 24h ?댁뒪 WebSearch(I洹몃９) 援ъ“??蹂닿컯 |
| P69 | v46.2 | 2026-04-10 | CHAT_CONTEXTS signal/breadth/sentiment/theme-detail 誘몄젙????silent failure. _aiCtxMap/Chips 誘몃ℓ?? commands wrapper 4媛??꾨씫 |
| P70 | v46.3 | 2026-04-10 | Stooq ?대갚 吏??留ㅽ븨 ?ㅻ쪟: ^GSPC?뭆PY(spy.us) 留ㅽ븨 ??ETF 媛寃?$680)??吏??6800)??二쇱엯?섏뼱 10諛?愿대━. pct???쒓? ?鍮꾨줈 怨꾩궛(?꾩씪 ?鍮??꾨떂). 吏???좊Ъ ?ㅽ궢 由ъ뒪??遺꾨━ + chartPreviousClose ?곗꽑?쇰줈 ?섏젙 |
| P71 | v46.3 | 2026-04-10 | Stooq ?좊Ъ ?щ낵 誘몄??? ES=F/NQ=F/YM=F媛 esf.us/nqf.us/ymf.us濡?蹂?섎릺??Stooq?먯꽌 N/D 諛섑솚. `sym.includes('=F')` 媛??異붽?. ?먯옄???좊Ъ(CL=F/GC=F ??? 紐낆떆 留ㅽ븨(cl.f/gc.f)?쇰줈 蹂꾨룄 泥섎━ |
| P72 | v46.4 | 2026-04-11 | ?몃젅?대뵫 ?ㅼ퐫???대갚媛믪씠 3???꾩웳 ?쇳겕 湲곗?(F&G=18, breadth=27.1, PCR=1.21)?쇰줈 怨좎젙 ??DATA_SNAPSHOT._fallback ?⑥씪 吏꾩떎 ?먯쿇 ?좎꽕. 24怨?李몄“ ?듭씪 |
| P73 | v46.4 | 2026-04-11 | 釉뚮━??罹섎┛???붿씪 ?꾨? ?ㅻ쪟(4/10=紐⒱넂湲? 4/13=?쇄넂???? + PPI 4/11 ?좎슂??+ ?뚯떆 泥?Ц??4/16??/13. 14怨??쇨큵 ?섏젙 |
| P74 | v46.4 | 2026-04-11 | .page overflow-x:hidden ??CSS 紐낆꽭???섑빐 overflow-y ?먮룞 auto 蹂????.page媛 ?ㅽ겕濡?而⑦뀒?대꼫????.content ?ㅽ겕濡ㅺ낵 異⑸룎. themes ?섏씠吏 留덉슦????臾대컲?? overflow-x:hidden ?쒓굅濡??닿껐 |
| P75 | v46.4 | 2026-04-11 | FOMC ?쇱젙 5/5-6 ??4/28-29 ?ㅻ쪟. eventDates + DATA_SNAPSHOT.fomc + ?쒓뎅嫄곗떆 罹섎┛??+ ?쒖뒪???꾨＼?꾪듃 14怨??숈떆 ?섏젙 |
| P76 | v46.4 | 2026-04-11 | 釉뚮젅?쒖벐 ?대갚媛?遺덉씪移? ?쒓렇???섏씠吏(68/75/46) vs 釉뚮젅?쒖벐 ?섏씠吏(35/32/27.6). 李⑦듃 諛곗뿴 留덉?留?媛믨낵 ?뺣젹. ?됱긽/諛곗?/?댁꽍 ?띿뒪???숈떆 媛깆떊 |
| P77 | v46.5 | 2026-04-11 | 踰덉뿭 諛곗튂 遺꾨━??짠짠짠) ?ㅽ뙣 ??8嫄??꾨? null 諛섑솚. 媛쒕퀎 1嫄댁뵫 ?ъ떆???대갚 異붽?. Google Translate媛 援щ텇?먮? 踰덉뿭/蹂?뺥븯硫??꾩껜 諛곗튂 ?먯떎 |
| P78 | v46.5 | 2026-04-11 | ?뚮쭏 ?덊듃留??몃텇???뚮쭏 renderThemeHeatmap()/renderSubThemesGrid()?먯꽌 _liveData<5?대㈃ 500ms ??臾댄븳 ?ъ떆?? ?꾨줉???꾨㈃ ?μ븷 ??CPU 100% + ?곴뎄 "濡쒕뵫 以?. 理쒕? 60??30珥? ?쒗븳 異붽? |
| P79 | v46.5 | 2026-04-11 | Brent ?먯쑀 $???쒖떆. brentPrice = brent.price \|\| 0?먯꽌 DATA_SNAPSHOT.brent ?대갚 ?꾨씫. WTI???숈씪 ?⑦꽩 ?섏젙 |
| P80 | v46.5 | 2026-04-11 | getTopicBadge()??healthcare/shipbuilding/space/quantum 4媛??좏뵿 諛곗? ?꾨씫. TOPIC_KEYWORDS?먮뒗 ?덉?留?諛곗? map???놁뼱 'general'濡??대갚. 4媛?諛곗? 異붽? |
| P81 | v46.5 | 2026-04-11 | 10+?섏씠吏 "濡쒕뵫 以? ?곴뎄 怨좎젙. ?꾨줉???꾨㈃ ?μ븷 ??signal/sentiment/fxbond/themes/options/kr-* ??10媛??섏씠吏?먯꽌 "濡쒕뵫 以?.."???곴뎄 ?쒖떆. 湲濡쒕쾶 ?뚯튂??60珥??쒖꽦/75珥?鍮꾪솢?? 異붽? |
| P82 | v46.5 | 2026-04-12 | ?ы듃?대━??醫낅ぉ 異붽? TypeError. KNOWN_TICKERS媛 Set?몃뜲 addPortfolioPosition()?먯꽌 .indexOf() ?몄텧 ??TypeError: knownTickers.indexOf is not a function. Set.has()濡??섏젙. **?ㅼ젣 ?ъ슜?먭? ?ы듃?대━?ㅼ뿉 醫낅ぉ 異붽? 遺덇??ν뻽???ш컖??踰꾧렇** ??肄붾뱶 ?덈꺼 寃利?typeof ?뺤씤)?쇰줈??諛쒓껄 遺덇?, ?ㅼ젣 ?대┃ ?뚯뒪?몃줈留?諛쒓껄 媛??|
| P83 | v46.8 | 2026-04-14 | **signal ??대㉧ ?ъ쭊???곴뎄 ?뚮㈇**. destroyPageCharts('signal')?먯꽌 _refreshSignalInterval ?댁젣 ?? initSignalDashboard()?먯꽌 _signalInterval留??щ벑濡앺븯怨?_refreshSignalInterval/sigRefreshTimer???щ벑濡앺븯吏 ?딆쓬. signal ?섏씠吏 1???댄깉?믪옱吏꾩엯 ??refreshSignal() 45珥???대㉧ ?곴뎄 ?뚮㈇. violated_rule: R15 |
| P84 | v46.8 | 2026-04-14 | kr-supply ?ш? setTimeout 誘몄젙由? _krSupplyRetry 500ms횞20???ъ떆??以??섏씠吏 ?댄깉?대룄 setTimeout 肄쒕갚 怨꾩냽 ?ㅽ뻾. _krSupplyRetryTimer ?몃뱾 蹂닿? + destroyPageCharts?먯꽌 clearTimeout 異붽?. violated_rule: R15 |
| P85 | v46.8 | 2026-04-14 | kr-macro ?ш? setTimeout 誘몄젙由? P84? ?숈씪 ?⑦꽩. _krMacroRetryTimer ?몃뱾 蹂닿? + destroyPageCharts?먯꽌 clearTimeout 異붽?. violated_rule: R15 |
| P86 | v46.8 | 2026-04-14 | R16 'geo' ?좏뵿 ?곗빱 ?④? ?꾨씫. classifyTopic()??'geo' 諛섑솚?섎굹 留ㅽ겕濡??좏뵿 諛곗뿴 3怨녹뿉 'geo' ?놁쓬 ??吏?뺥븰 ?댁뒪(?대?, ?몃Ⅴ臾댁쫰 ????$SPY/$QQQ ETF ?곗빱 ?섎せ ?쒖떆. 3怨?諛곗뿴??'geo' 異붽?. violated_rule: R16 |
| P87 | v46.8 | 2026-04-14 | vix.price/spx.pct null guard ?꾨씫. vix.price undefined ??`undefined < 15` = false ????긽 '?꾪뿕' ?쒖떆. spx.pct undefined ????긽 '愿留?. != null 泥댄겕 異붽?. violated_rule: R15 |
| P88 | v46.8 | 2026-04-14 | **window._putCallRatio 誘몄꽕??*. fetchPutCall()??DATA_SNAPSHOT.pcr? 媛깆떊?섎굹 window._putCallRatio???좊떦 ???? computeTradingScore/computeExecutionWindow??PCR 蹂댁젙 ?꾩쟾 臾댄슚?? window._putCallRatio = parseFloat(pcr) 異붽?. violated_rule: R15 |
| P89 | v46.8 | 2026-04-14 | updateEntryChecklist ?대깽???좎쭨 ?섎뱶肄붾뵫. CPI 2026-04-10(寃쎄낵 4??, S湲??대깽??4/13~17???꾩옱 ?좎쭨 ?ы븿 ??ec-event ??긽 FAIL. 怨쇨굅 ?좎쭨 ?쒓굅 + 誘몃옒 ?대깽?몃쭔 ?좎?. violated_rule: R15 |
| P90 | v46.8 | 2026-04-14 | **_calcEMA 猷⑦봽 ?몃뜳???ㅻ쪟**. 2踰덉㎏ 猷⑦봽 `prices[prices.length - prices.length + period + i]` = `prices[period + i]`, i=period????prices[2*period] ??諛곗뿴 踰붿쐞 珥덇낵 ??undefined 媛믪쑝濡?EMA 怨꾩궛 ?쒓끝. _calcEMAFull ?⑦꽩?쇰줈 ?섏젙. violated_rule: R15 |
| P91 | v46.8 | 2026-04-14 | updateBottomProcess Dead Zone. b5=null, score=40????紐⑤뱺 stage 議곌굔 false ??stage=0 "?뺤긽 ?섍꼍" ?ㅽ뙋. b5 null ?덉쟾 泥섎━ + ?대갚 濡쒖쭅 異붽?. violated_rule: R15 |
| P92 | v46.8 | 2026-04-14 | _lastVisibleTime ???④? ??誘멸갚?? ?④??믩났洹 ??elapsed媛 "?섏씠吏 濡쒕뱶 ?댄썑 寃쎄낵 ?쒓컙"?쇰줈 痢≪젙 ??吏㏃? ?④??먮룄 ?꾩껜 ?촧etch ?몃━嫄? ?④? ?쒖젏??_lastVisibleTime ???異붽?. violated_rule: R15 |
| P93 | v46.8 | 2026-04-14 | initKoreaHome ?ш? setTimeout 誘몄젙由? P84/P85? ?숈씪 ?⑦꽩. _krHomeRetryTimer ?몃뱾 蹂닿? + destroyPageCharts?먯꽌 clearTimeout 異붽?. violated_rule: R15 |
| P94 | v46.8 | 2026-04-14 | HY ?ㅽ봽?덈뱶 蹂댁젙 DOM ?뚯떛 臾댄슚?? hyBp瑜?DOM ?띿뒪??"怨꾩궛 以묅?)?먯꽌 parseInt ??NaN ??0 ??蹂댁젙 ?꾨㈃ 臾댄슚. HYG ETF 媛寃?湲곕컲 OAS 洹쇱궗((100-HYG)*15bps)濡??꾪솚. violated_rule: R15 |
| P95 | v46.8 | 2026-04-14 | **Stooq CSV ?몃뜳???ㅻ쪟**. cols[7](Volume)??Close濡? cols[4](High)瑜?Open?쇰줈 ?뚯떛. fetchLiveQuotes + dynamicTickerLookup ?묒そ. cols[6] ?곗꽑 + cols[3] ?곗꽑?쇰줈 ?섏젙. violated_rule: R15 |
| P96 | v46.8 | 2026-04-14 | DATA_APIS key() ?뷀샇???고쉶. PIN ?ㅼ젙 ??localStorage.getItem??`aio_enc::...` ?뷀샇??臾몄옄?댁쓣 洹몃?濡?API???꾨떖. safeLSGetSync 援먯껜. violated_rule: R15 |
| P97 | v46.8 | 2026-04-14 | Consumer Staples?묬onsumer Defensive 李몄“ ?ㅻ쪟. _generatePortfolioAnalysis defCount媛 ??긽 0 (SCREENER_DB??'Consumer Defensive' ?ъ슜). violated_rule: R15 |
| P98 | v46.8 | 2026-04-14 | SECTOR_COLORS 'Financials' ?꾨씫. ?ы듃?대━???꾨꽋 李⑦듃?먯꽌 JPM/GS/V ??湲덉쑖二??됱긽 誘몃ℓ?? 'Financials'+'Consumer' 蹂꾩묶 異붽?. violated_rule: R15 |
| P99 | v46.8 | 2026-04-14 | XYZ?뭆Q ?곗빱 ?ㅻ쪟. SCREENER_DB?먯꽌 Block Inc ?곗빱媛 'XYZ'(鍮꾩〈??濡??깅줉 ???ㅼ떆媛??쒖꽭 誘몄닔?? 'SQ'濡??섏젙. violated_rule: R15 |
| P100 | v46.8 | 2026-04-14 | **renderPortfolio/renderWatchlistContent XSS 4嫄?*. p.ticker/p.memo/t.sym/t.note媛 innerHTML??escHtml ?놁씠 ?쎌엯. importPortfolio ?ㅽ궎留?寃利앸룄 遺????議곗옉??JSON ?뚯씪 ?꾪룷???????XSS. escHtml ?곸슜 + ?ㅽ궎留?寃利?異붽?. violated_rule: R15 |
| P101 | v46.8 | 2026-04-14 | **_calcRSILast ?⑥닚?됯퇏?뭌ilder SMMA**. 二쇱꽍??"Wilder smoothing"?대씪 ?섏뼱 ?덉?留??ㅼ젣??Simple Average. ?쒖? RSI? 理쒕? 5~8pt 李⑥씠. Wilder SMMA 援ы쁽?쇰줈 援먯껜. violated_rule: R15 |
| P102 | v46.8 | 2026-04-14 | **generateMacroStoryline ^FVX(5?꾨Ъ)瑜?"2?꾨Ъ 湲덈━"濡??ㅽ몴湲?*. yield curve 2s10s ??쟾 ?먮떒??5Y-10Y濡??대（?댁쭚. _live2Y(?ㅼ젣 2?꾨Ъ) 李몄“濡?援먯껜 + spread parseFloat ???蹂댁옣. violated_rule: R15 |
| P103 | v46.8 | 2026-04-14 | _generatePortfolioAnalysis 踰좏? 怨꾩궛 noop. `pfBeta / totalW * totalW` = ??벑(?섎닓?????ㅼ떆 怨깆뀍). `pfBeta / totalW`濡??섏젙. violated_rule: R15 |
| P104 | v46.8 | 2026-04-14 | isCompanyNews companyTopics 5媛??좏뵿 ?꾨씫. healthcare/shipbuilding/space/quantum/crypto 湲곗뾽 ?댁뒪媛 ?쒖옣 ?댁뒪濡??ㅻ텇瑜? companyTopics ?뺤옣 + marketOnlyTopics 遺꾨━. violated_rule: R16 |
| P105 | v46.8 | 2026-04-14 | _generateAIBriefing 怨쇨굅 ?대깽??誘몃옒 二쇱엯. CPI 4/10(寃쎄낵 4??, GS 4/13(寃쎄낵 1?? ???대? 吏???대깽?멸? "?ν썑 ?대깽??濡?AI ?꾨＼?꾪듃??二쇱엯. 怨쇨굅 ?좎쭨 ?쒓굅 + 吏?뺥븰 遊됱뇙 諛섏쁺. violated_rule: R15 |
| **P125** | **v48.10** | **2026-04-17** | **?몄뀡 ?꾩닔 ?먭? 寃곌낵 ?섏쭛-UI 遺덉씪移?3嫄??ы솗??*. v48.4?먯꽌 window._cgGlobal(BTC ?꾨??뚯뒪/?쒖킑/24h 蹂??怨?window._cgMarkets(?곸쐞 20 肄붿씤) ?섏쭛, v48.5?먯꽌 collected.secFrameRank(?뱁꽣 諛깅텇???쒖쐞), v48.1?먯꽌 collected.finnhubEarnings(?ν썑 ?대떇 ?쇱젙) ?섏쭛?덉쑝??紐⑤몢 UI ?쒖떆 寃쎈줈 ?놁쓬 ??v48.1 P116 쨌 v48.6 P121 쨌 v48.7 P122 ?⑦꽩??留덉?留??붿〈. **?섏젙 3嫄?*: (a) sentiment ?섏씠吏 F&G ?꾩젽 ?섎떒??crypto-tempo-widget 異붽? + _renderCryptoTempo() ?⑥닔 ?좎꽕 + aio:pageShown sentiment 300ms ?? 5媛?移대뱶: BTC ?꾨??뚯뒪 4?곗뼱 ?됱긽(??5%/??8%/??2%/<42%), ETH ?꾨??뚯뒪, ?꾩껜 ?쒖킑, 24h ?쒖킑 蹂??4?곗뼱, 24h 嫄곕옒?? (b) _renderFundFinancials??'SEC XBRL ?뱁꽣 諛깅텇??(v48.10 ?좉퇋)' ?뱀뀡 ?쎌엯 ??Revenues + NetIncomeLoss 媛?移대뱶 myVal/rank/N/?곸쐞 X% 諛곗?(4?곗뼱) + ?됯퇏/以묒쐞?? (c) _renderFundEarnings ?곷떒??'?ν썑 ?대떇 ?쇱젙 (Finnhub 쨌 v48.10)' 洹몃━??移대뱶 理쒕? 5嫄???date/遺꾧린/?μ쟾-?ν썑-?μ쨷/?덉긽 EPS/?덉긽 留ㅼ텧. 湲곗〈 fmpSurprises ?뚯씠釉붿? 援щ텇???꾨옒濡??대룞 + ?고듃 10??1px. **?듯빀??*: 湲곗〈 ?ㅽ겕 ?뚮쭏 CSS 蹂??--bg-card/--border/--text-secondary/--font-mono), 怨듯넻 ?됱긽 ?곗뼱(#10b981/#3ddba5/#fbbf24/#f87171/#60a5fa/#a78bfa), ?고듃 11px+(R17/P37), auto-fit grid minmax, padding 7~10px, border-radius 6~8px, ?뱀뀡 ?ㅻ뜑 '12px 700 + (v48.x ?좉퇋)' ?쇰꺼 ?⑦꽩 ??湲곗〈 Finnhub 5援ш컙 諛?v48.7)쨌F&G ?쒕툕 移대뱶(v48.1)쨌52W ?꾩튂 諛?v48.6)? ?꾨꼍 ?쇨?. **?덈갑**: ?곗씠???섏쭛 PR 癒몄? ??'UI ?몄텧 寃쎈줈' ?숈떆 援ы쁽 ?먯튃. _render* ?⑥닔媛 ?녿떎硫?理쒖냼 console.log/AI ?꾨＼?꾪듃 二쇱엯?대씪???ы븿. ?섏쭛-?뚮퉬 遺덉씪移섎뒗 v48 ?몄뀡 3???щ컻(P116/P121/P122/P125) ??/qa 泥댄겕由ъ뒪?몄뿉 ?먮룞 寃利???ぉ 異붽? ?덉젙. violated_rule: P116/P121/P122 ?곗옣 |
| **P124** | **v48.9** | **2026-04-17** | **v48.8 荑쇳꽣 移댁슫??FMP ?꾩슜 + ?꾨씫??9媛?API 誘몄젏寃**. v48.8?먯꽌 FMP 荑쇳꽣 媛??_bumpFmpCounter)留?援ы쁽 ??Twelve Data 800/day, AV 25/day, Google CSE 100/day, NewsData.io 200/day, rss2json 10000/day ???ㅻⅨ 怨듭쑀 ??API??臾대갑鍮? ?먰븳 Naver/SEC/FRED/Stooq/CBOE/CNN F&G/?섏쑉/Google CSE/NewsData 9媛?API媛 v48.8 ?ㅼ쨷 ?ъ슜???쒖뿉 ?꾨씫?섏뼱 ?먭??섏? ?딆쓬. ?ъ슜???뺤씤?쇰줈 '吏㏃? ?몄뀡(10~30遺? ?꾩＜쨌釉뚮씪?곗? ?대젮?덉쓣 ?뚮쭔 fetch ?숈옉' ?꾩젣 ?뺤씤. **?섏젙 2嫄?*: (1) _QUOTA_LIMITS ?좎뼵 + _bumpApiCounter(providerKey)/_isQuotaExceeded(providerKey) 踰붿슜 ?ы띁 ??localStorage aio_quota_{key} ?쇱씪 由ъ뀑, 80%/100% ?꾧퀎??console 濡쒓렇, ?쒕룄 ?꾨떖 ???ㅽ듃?뚰겕 李⑤떒. _bumpFmpCounter ?섏쐞?명솚 ?섑띁 ?좎?. (2) 怨듭쑀 ??fetcher 5怨녹뿉 ?ъ쟾 泥댄겕+移댁슫???곌껐: fetchTechnicalIndicators(Twelve Data), fetchBreadthData ??AV TOP_GAINERS_LOSERS, fetchNewsDataIO, _googleSearch, fetchOneFeed ??rss2json. **?꾨씫 9媛?API ?ъ젏寃 寃곌낵**: FRED/Stooq/CBOE/CNN F&G/?섏쑉 API??怨듦컻/臾댁젣?쒖쑝濡?4紐?遺꾩궛 遺???덉쟾, Naver??CF Worker 寃쎌쑀濡??덉젙, SEC 10 req/sec 愿?. Google CSE/NewsData??v48.9 移댁슫??異붽?濡?蹂댄샇. **?ㅼ륫**: 10遺??몄뀡 횞 4紐??먮룞 ?몄텧 25~50 req 珥앺빀 ??紐⑤뱺 怨듭쑀 荑쇳꽣??<5% ?뚮퉬. 湲곗〈 REFRESH_SCHEDULE(v30.11)???대? 吏??짹15% + Page Visibility ?먮룞 ?쇱떆?뺤? + ?쒕뜡 initial delay 0~30s 援щ퉬?섏뿬 ?ㅼ쨷 ?ъ슜???꾪궎?띿쿂 ?곗닔. **?덈갑**: (1) ?좉퇋 API ?듯빀 ??_QUOTA_LIMITS???깅줉 + fetcher 吏꾩엯遺??_isQuotaExceeded 媛??+ ?깃났 ?묐떟??_bumpApiCounter ?몄텧 ?⑦꽩 ?꾩닔. (2) 怨듭쑀 ??荑쇳꽣 臾몄꽌?붾뒗 ?꾩닔 ?뚯씠釉??뺥깭濡?愿由????쇰? ?꾨씫??API???먭? 怨듬갚 諛쒖깮. violated_rule: ?좉퇋(荑쇳꽣 媛???⑦꽩 踰붿슜??遺?? + P123 ?뺤옣 |
| **P123** | **v48.8** | **2026-04-17** | **?ㅼ쨷 ?ъ슜??4紐? ?숈떆??由ъ뒪??+ anthropic-beta ?ㅻ뜑 ?명솚??+ 鍮꾩슜 ?쒓린 ?ㅼ씤 + FMP fundamentalSearch 罹먯떆 遺??*. (1) fundamentalSearch(L27755)??1??遺꾩꽍??FMP 18 req + SEC 2 req = 20 req ?뚮퉬. 4紐?怨듭쑀 FMP 臾대즺 250/day ?섍꼍?먯꽌 媛곸옄 3~4??遺꾩꽍 ???쒕룄 ?꾨떖 媛?????몄뀡 罹먯떆 ?놁쓬. (2) callClaude??anthropic-beta: prompt-caching-2024-07-31 ?ㅻ뜑??2024??11???댄썑 ?뺤떇 湲곕뒫 ?밴꺽 媛?μ꽦 ?덉뼱 400 ?먮윭 由ъ뒪?? (3) fundamentalSearch??18 Promise.allSettled ?꾩쟾 蹂묐젹? 4紐??숈떆 遺꾩꽍 ??72 req/?쒓컙 ??CF Worker 300 req/min ?ㅽ뙆?댄겕 ?좊컻 媛?? (4) ?ъ씠?쒕컮 API ???덈궡??'?좊즺??Claude肉? FMP??臾대즺 ?곗뼱' 紐낆떆 遺?????좉퇋 ?ъ슜?먭? FMP ?좊즺濡??ㅼ씤. **?섏젙**: (a) window._fundCache[ticker]={data,_ts} 30遺?TTL, 理쒕? 10媛?LRU ??媛숈? ?곗빱 ?щ텇????20 req ?꾩쟾 ?앸왂, 罹먯떆 ?덊듃 利됱떆 _render*() ?ы샇異?+ progress ?덈궡. (b) _bumpFmpCounter() localStorage aio_fmp_quota={date,count} ?쇱씪 由ъ뀑, _fmpFetch ?몄텧 ??250 ?꾨떖 ?ъ쟾 泥댄겕, 200/250 ?꾧퀎??console 濡쒓렇. (c) _claudeHeaders 議곌굔遺 ??cache_control ?ъ슜 ?쒖뿉留?anthropic-beta ?쎌엯, 400 + beta/cache ?ㅼ썙??媛먯? ???ㅻ뜑 ?쒓굅 ??1???먮룞 ?ъ떆?? (d) fundamentalSearch Promise.allSettled瑜?6媛?泥?겕 3?쇱슫???쒖감(concurrency 6) ???덉씠?댁떆 ?쎄컙 利앷? but 4紐??숈떆 遺꾩꽍 ???쒓컙 遺??72??4 req濡?遺꾩궛. (e) ?ъ씠?쒕컮 API ???곷떒??'?좎씪??怨쇨툑: Claude API' 紐낆떆, FMP placeholder??'?좏깮 쨌 臾대즺 250/??쨌 4紐?遺꾩궛 ?뚯쭊 二쇱쓽' title 異붽?. **?숈떆??寃利?*: localStorage/sessionStorage/window._* 紐⑤뱺 罹먯떆(_yfBatch, _pplxCache, _secFrames, _cgGlobal, _fundCache)媛 釉뚮씪?곗?蹂??낅┰?대씪 ?ъ슜??媛?異⑸룎 ?놁쓬. 怨듭쑀 由ъ냼?ㅻ뒗 ?ㅽ듃?뚰겕(API 荑쇳꽣, CF Worker rate limit)留? 4紐?횞 媛?由ъ냼??遺꾩궛 遺???꾩닔 ?먭? ?꾨즺 (FMP留???댄듃 ??v48.8濡??댁냼). **?덈갑**: (1) 怨듭쑀 API ??媛?????ъ슜???섎줈 荑쇳꽣 ?섎닠???곹븳 ?ㅺ퀎, ?몄뀡 罹먯떆 ?꾩닔. (2) LLM API 踰좏? ?ㅻ뜑???뺤떇 ?밴꺽 媛?μ꽦 ?鍮?400 fallback. (3) N媛?蹂묐젹 ?몄텧 ???쒓컙 遺??= N 횞 ?숈떆 ?ъ슜???섎줈 怨꾩궛?섏뿬 rate limit ?鍮? violated_rule: ?좉퇋(怨듭쑀 荑쇳꽣 蹂댄샇 遺?? + R26 |
| **P122** | **v48.7** | **2026-04-17** | **Finnhub recommendation + FMP price-target-consensus ?섏쭛?덉쑝??UI 誘몃끂異?*. v48.1?먯꽌 fundamentalSearch??fetchFinnhubMetrics/Recommendation/EarningsCalendar ?듯빀 + FMP price-target-consensus job ?ы븿?섏뿬 collected.finnhubRecommendation/fmpPriceTarget/finnhubEarnings ?섏쭛 以묒씠??_renderFundFinancials/Valuation ?대뒓 怨녹뿉???쒖떆 ?놁쓬. 湲곗뾽 遺꾩꽍 ?섏씠吏?먯꽌 '?좊꼸由ъ뒪??buy/hold/sell 遺꾪룷?'쨌'紐⑺몴媛 ?鍮?upside?' 吏덈Ц 利됰떟 遺덇? ??v48.1 P116 ?⑦꽩(?섏쭛-?뚮퉬 遺덉씪移? ?곗옣. **?섏젙**: _renderFundFinancials 留먮?(grid.innerHTML 吏곸쟾)??'v48.7 ?좉퇋' ?뱀뀡 異붽? ??(a) Finnhub 5援ш컙 ?꾩쟻 諛?Strong Buy/Buy/Hold/Sell/Strong Sell 媛?%, ?됱긽 #10b981/#3ddba5/#fbbf24/#f87171/#ef4444, 援ш컙 ?덈퉬 ??% ???뚮쭔 ?몄썝??inline, hover title full count) + 醫낇빀 ?먯젙 諛곗?(留ㅼ닔 ?곗꽭 60%+/?꾨쭔 留ㅼ닔 40%+/以묐┰/留ㅻ룄 ?곗꽭 40%+) + ?섎떒 踰붾? 5援ш컙 ?됱긽 ??+ ?몄썝 + %, (b) FMP 紐⑺몴媛 而⑥꽱?쒖뒪 ?듯빀 ???寃?$ + ?꾩옱媛 ?鍮?upside % 諛곗?(>=15% 吏꾨끃/0~15% ?곕끃/-10%~0 ?몃옉/<-10% 鍮④컯) + 紐⑺몴媛 踰붿쐞 low~high. finnhubRecommendation ?먮뒗 fmpPriceTarget 以??섎굹留??덉뼱???대떦 遺遺꾨쭔 ?뚮뜑, ?????놁쑝硫??뱀뀡 ?꾩껜 ?앸왂. ?고듃 11~14px R17/P37 以?? **?덈갑**: ?洹쒕え UI ?뚮뜑 ?⑥닔(_renderFundFinancials ?????좉퇋 ?섏쭛 ?곗씠??異붽? ??'?섏쭛-?뚮뜑' ??泥댄겕由ъ뒪???먮룞????collected.* ?좉퇋 ?꾨뱶??理쒖냼 1媛?_render ?⑥닔???몄텧?섏뼱????(?먮뒗 AI ?꾨＼?꾪듃 ?쒖슜 利앷굅 ?쒖떆). violated_rule: P116 ?곗옣(?섏쭛-?뚮퉬 遺덉씪移??щ컻) + R28(?ㅼ젣 ?대┃ ?뚯뒪???꾩닔) |
| **P121** | **v48.6** | **2026-04-17** | **Yahoo v7/quote ?뺤옣 ?꾨뱶 ?섏쭛留??섍퀬 UI 臾댄솢??+ averageDailyVolume ?꾨씫**. v47.12?먯꽌 v7/quote 諛곗튂 罹먯떆??fiftyTwoWeekHigh/Low, regularMarketVolume, marketCap, trailingPE瑜??섏쭛?덉쑝??_renderFundHeader??price/pct留??쒖떆. averageDailyVolume3Month/10Day ?꾨뱶???섏쭛 紐⑸줉 ?먯껜?먯꽌 ?꾨씫 ??嫄곕옒???ㅽ뙆?댄겕 怨꾩궛 洹쇨굅 ?놁쓬. 湲곗뾽 遺꾩꽍 ?섏씠吏?먯꽌 '湲곗닠???꾩튂(52二??대뵒?) + ?섍툒 媛뺣룄(嫄곕옒???됱냼 ?鍮?)' ?쒓컖??湲고쉶 ?곸떎. **?섏젙 2嫄?*: (1) _yfBatchFetch ?섏쭛 ?꾨뱶 4媛?異붽?(fiftyTwoWeekHighChangePercent, fiftyTwoWeekLowChangePercent, averageDailyVolume3Month, averageDailyVolume10Day). (2) _renderFundHeader??52二??꾩튂 ?꾨줈洹몃젅??諛?鍮ⓥ넂?멤넂??洹몃씪?곗씠??+ ??留덉빱 + '52二?怨좉? 洹쇱젒/?곷떒/以묎컙/?섎떒/?媛 洹쇱젒' ?쇰꺼) + 嫄곕옒???ㅽ뙆?댄겕 諛곗?(??x ??쬆/??.3x ?곸듅/?뺤긽/??.5x ?議??됱긽 ?곗뼱) + 10???됯퇏 ?鍮?諛곗닔 + ?ㅻ뒛 嫄곕옒??raw ?쒖떆. ?곗씠???곗꽑?쒖쐞 _liveData(Yahoo v7) > d.finnhubMetrics(v48.0 /stock/metric ?대갚). ?고듃 11px+ R17/P37 以?? _liveData??CHAT_CONTEXTS?먯꽌 ?먮룞 李몄“?섎?濡?AI ?꾨＼?꾪듃 ?덉쭏???숇컲 ?μ긽. **?덈갑**: ?몃? API ?섏쭛 ?꾨뱶? UI ?몄텧 ?꾨뱶??留ㅽ븨 ?뚯씠釉붿쓣 肄붾뱶 由щ럭 ???먭? ???섏쭛留??섍퀬 誘몄궗???꾨뱶??'遺梨?(硫붾え由??ㅽ듃?뚰겕 鍮꾩슜 vs ?ъ슜??媛移?0). ?좉퇋 ?섏쭛 ?꾨뱶??理쒖냼 1媛?UI ?먮뒗 AI ?꾨＼?꾪듃???쒖슜?댁빞 ?? violated_rule: ?좉퇋(?섏쭛-UI 遺덉씪移? + v48.1 P116 ?좎궗 ?⑦꽩(?곗씠?곕뒗 ?덈뒗??蹂댁씠吏 ?딆쓬) |
| **P120** | **v48.5** | **2026-04-17** | **SEC XBRL Frames API 臾댄솢?????뱁꽣 諛깅텇??湲고쉶 ?곸떎**. v47.10源뚯? SEC??/submissions(怨듭떆)? /companyfacts(媛쒕퀎 ?щТ?쒗몴)留??몄텧. 怨듭떇 臾대즺 /api/xbrl/frames/{taxonomy}/{concept}/USD/{period}.json? ?대떦 遺꾧린???뱀젙 concept(Revenues, NetIncomeLoss, R&D, SBC ????蹂닿퀬????US-GAAP 湲곗뾽 ?ㅻ깄?룹쓣 ??踰덉뿉 諛섑솚 ???뱁꽣 鍮꾧탳/諛깅텇???쒖쐞 怨꾩궛???쒖? ?꾧뎄?몃뜲 誘몄궗?? FMP ?좊즺 ???놁씠??**??湲곗뾽 ?鍮??곷? ?꾩튂**瑜??뺣웾 怨꾩궛 媛?ν븳 湲고쉶瑜??볦튂怨??덉뿀?? **?섏젙 3嫄?*: (1) fetchSECFrame(concept, period, taxonomy) helper ?좎꽕 ??吏곸젒?묬F Worker ?꾨줉???대갚, window._secFrames ?몄뀡 罹먯떆 1?쒓컙 TTL + 5000媛??댁긽 slice 硫붾え由?蹂댄샇. (2) _secFrameRank(frame, cik) helper ???뱀젙 CIK??諛깅텇???곸쐞 N%), ?쒖쐞, ?됯퇏, 以묒쐞?? max/min ?붿빟 諛섑솚. (3) fundamentalSearch ?듯빀 ??SEC XBRL ?뚯떛 吏곹썑 理쒖떊 ?꾨즺 遺꾧린(?꾩옱 湲곗? 2遺꾧린 ?? 10-Q ?쒖텧 ?ъ쑀 怨좊젮)??Revenues + NetIncomeLoss ?꾨젅??prefetch ??collected.secFrameRank={revenue, netIncome} ???+ sources 'SEC Frames (?뱁꽣 諛깅텇??' 異붽?. ?댄썑 AI ?꾨＼?꾪듃 二쇱엯 ??'??US-GAAP 蹂닿퀬 湲곗뾽 N媛?以?Revenues ?곸쐞 X%' ?뺣웾 鍮꾧탳 洹쇨굅濡??쒖슜 媛?? **?덈갑**: 怨듭떇 API 臾몄꽌???붾뱶?ъ씤??紐⑸줉??二쇨린???꾩닔 ?ㅼ틪 ??臾대즺 ?쒓났?섎뒗??誘명솢?⑸맂 ?붾뱶?ъ씤?몃? ?앸퀎. ?뱁엳 'frames', 'concepts', 'batch' ?????議고쉶 ?붾뱶?ъ씤?몃뒗 諛깅텇??鍮꾧탳 UI???쒖? 洹쇨굅 ?먮즺. violated_rule: ?좉퇋(怨듭떇 臾대즺 ?붾뱶?ъ씤????쒖슜) |
| **P119** | **v48.4** | **2026-04-17** | **CoinGecko 臾대즺 ?붾뱶?ъ씤??2媛???쒖슜**. v48.2?먯꽌 /simple/price ?묐떟??include_market_cap 異붽??덉쑝??Top 4 以?BTC ?쒖킑 鍮꾩쨷(_btcDominanceTop4)留?洹쇱궗移섎줈 怨꾩궛. CoinGecko 怨듭떇 /global ?붾뱶?ъ씤?몃뒗 ???쒖옣 湲곗? ?뺥솗??market_cap_percentage.btc/eth ?쒓났. ??/coins/markets?per_page=20? ?곸쐞 20 肄붿씤 ?곸꽭(ath, 7d 蹂?? ??궧 ?? 臾대즺 吏?? 湲곕낯 4醫?BTC/ETH/SOL/BNB)?먯꽌 ?뺤옣 湲고쉶瑜??볦튂怨??덉뿀?? **?섏젙**: fetchLiveQuotes ?대? 湲곗〈 CoinGecko /simple/price 釉붾줉 ?ㅼ뿉 Promise.allSettled濡?/global + /coins/markets 蹂묐젹 ?몄텧(_cgDirect ?대줈? ?ы띁 ??吏곸젒?묬F Worker ?대갚 泥댁씤 ?듭씪). window._cgGlobal(totalMarketCapUSD/totalVolume24hUSD/btcDominance/ethDominance/activeCryptocurrencies/markets/mcapChange24hPct/_updated) + window._cgMarkets[20]({id/symbol/name/price/mcap/mcapRank/volume24h/high24h/low24h/chg24hPct/chg7dPct/ath/athChgPct/circulatingSupply/image}) ??? 湲곗〈 /simple/price 4醫??쒖꽭 寃쎈줈??蹂寃??놁쓬 ??湲곗〈 肄붾뱶/UI ?꾩쟾 臾댁쁺?? CoinGecko 臾대즺 30/min 횞 3 ?몄텧/min = ?ъ쑀 異⑸텇. **?덈갑**: ?몃? API瑜??덈줈 ?듯빀?????대떦 ?쒓났?먯쓽 **怨듭떇 ?붾뱶?ъ씤??紐⑸줉 ?꾩닔 ?ㅼ틪** ??臾대즺 ?곗뼱 ?댁뿉??異붽? ?쒖슜 媛?ν븳 ?곗씠?곕? ?볦튂吏 ?딅룄濡?API 媛먯궗 泥댄겕由ъ뒪?몄뿉 ?ы븿. 洹쇱궗移?_btcDominanceTop4)瑜??곌린 ?꾩뿉 癒쇱? ?뺥솗移??붾뱶?ъ씤??/global) 議댁옱 ?щ? ?뺤씤. violated_rule: ?좉퇋(臾대즺 ?붾뱶?ъ씤????쒖슜) |
| **P118** | **v48.3** | **2026-04-17** | **?ы듃?대━???뚮뜑 template literal SyntaxError(CRITICAL) + ?꾩껜 ?고듃 怨쇱냼 + ?몄쭛 UX 遺??*. (1) renderPortfolio(L23332) `return \`<tr style="..." onclick="showTicker('${_eTk}')">\`;` ??backtick 議곌린 醫낅즺 + ?몃?肄쒕줎?쇰줈 template literal??泥?以꾨쭔 ?ы븿?섍퀬, ?댄븯 `<td>...</td>` 9以꾩씠 JS ?뚯꽌??`<` operator + ?앸퀎???쒗?ㅻ줈 ?댁꽍?섎ŉ SyntaxError. ?대떦 `<script>` 釉붾줉 ?꾩껜 濡쒕뱶 ?ㅽ뙣 ??savePortfolioData/getPortfolioData/addPortfolioPosition/editPosition/removePosition/renderPortfolio/clearPortfolioForm/clearAllPositions/updatePortfolioSummary ?꾨? undefined. ?ъ슜??"??????㉱룹큹湲고솕" 利앹긽??寃곗젙???먯씤 ???ㅼ젣濡쒕뒗 localStorage???곗씠?곕뒗 ?덉?留?render媛 undefined???붾㈃? 鍮??곹깭. (2) ?ы듃?대━???섏씠吏 ?꾩껜??font-size 8~10px ?몃씪???곗옱: ?뚯씠釉??ㅻ뜑 8px, 蹂몃Ц 9~10px, ?낅젰 ?쇰꺼 9px, ?낅젰 10px, 踰꾪듉 8~10px, Summary 移대뱶 ?쇰꺼 9px, ?꾨꽋 以묒븰/踰붾?/?뱁꽣 9~8px. R17("?몃씪??font-size 11px 誘몃쭔 ?ъ슜 湲덉?") + P37("?몃씪??font-size 11px 誘몃쭔 ?ъ슜 湲덉?") 愿묐쾾???꾨컲. ?ъ슜??"湲?먃룹닽??源⑥졇 蹂댁엫"??吏곸젒 ?먯씤 + 媛?낆꽦 ???+ 紐⑤컮???곗튂 ?곸뿭 遺議? (3) ?몄쭛 湲곕뒫? ?숈옉?섎굹 ?쇱쑝濡??ㅽ겕濡??ъ빱???대룞 ?놁뼱 ?ъ슜?먭? ?대뵒濡??섏젙?댁빞 ?섎뒗吏 ?쇰?. ?좉퇋 異붽? ???좎뒪??誘명몴?쒕줈 "??λ맂 嫄댁?" 遺덈텇紐? **?섏젙**: (a) return 臾몄쓣 ?⑥씪 template literal濡??ш뎄??backtick ?닿퀬 9媛?td ?ы븿, `</tr>` ?ㅼ뿉?쒕쭔 ?リ린), (b) ?뚯씠釉??ㅻ뜑 8px??1px+700, 蹂몃Ц 9~10px??1~12px, ?낅젰 ?쇰꺼 9px??1px+600, ?낅젰 10px??3px+mono, 踰꾪듉 9~10px??1~12px+padding ?뺣?, Summary 移대뱶 9/20/10??1/22/12, ?꾨꽋 以묒븰 11/9??3/11, 踰붾? 9??1+??8??0, ?뱁꽣 8/10/8??1/14/12, 鍮??곹깭 3?④퀎 媛?대뱶, (c) editPosition??scrollIntoView(smooth center) + 400ms ??qty ?꾨뱶 focus + ?몄쭛 紐⑤뱶 ?좎뒪?? addPortfolioPosition ?좉퇋 寃쎈줈???깃났 ?좎뒪?? 鍮??곹깭?먯꽌 drawPositionDonut ?몄텧濡??댁쟾 ?곗씠??由ъ뀑. ?꾨꽋 罹붾쾭??150??70, 洹몃━??200??20:1fr, 踰꾪듉 ?쇰꺼 '異붽?'??異붽? / ?낅뜲?댄듃'. **?덈갑**: (1) JS template literal 蹂????return 臾???`;` + ?リ린 backtick ??踰덉뿉 泥섎━ 湲덉? ??PR 泥댄겕由ъ뒪?몄뿉 "`return \`` ???몃?肄쒕줎???ㅻ㈃ 利됱떆 ?섏떖". (2) ?섏씠吏蹂??몃씪??font-size 媛먯궗 ?먮룞????`grep -E 'font-size:\s*[1-9]px|font-size:\s*10px' index.html` CI 媛?? (3) ?몄쭛 湲곕뒫? ??媛?쒖꽦(scrollIntoView) + ?ъ빱??+ ?좎뒪??3醫??명듃 湲곕낯. (4) CRUD ?⑥닔 ?뺤쓽 釉붾줉 ?꾩껜媛 ?섎굹??`<script>` ?덉뿉 ?덉쓣 ??洹?釉붾줉??SyntaxError???꾩껜 CRUD 移⑤У ?ㅽ뙣 ?좊컻 ??湲곕뒫 寃利???console??ReferenceError媛 李랁엳?붿? 諛섎뱶???뺤씤. violated_rule: R17(?몃씪??11px 誘몃쭔 湲덉?) + P37(?숈씪) + R28(?ㅼ젣 ?대┃ ?뚯뒪???꾩닔) + ?좉퇋(template literal 蹂???ㅼ닔) |
| **P117** | **v48.2** | **2026-04-17** | **臾대즺 API 媛쒖꽑 5嫄?+ Claude tool_use 諛⑺뼢 ?꾪솚**. ?뱀큹 v48.2 怨꾪쉷? Claude tool_use ?꾪솚?댁뿀?쇰굹 留??붿껌 tool ?먮떒 ?쇱슫??異붽?濡??좏겙 ~10~20% 利앷? + ?ㅽ듃由щ컢 蹂듭옟???곸듅 + 湲곗〈 regex???대? 0ms + ?뺥솗???믪쓬 ??鍮꾩슜/?덉젙???鍮?媛移???븘 v49.x ?곌린 寃곗젙. ???5嫄?臾대즺 媛쒖꽑?쇰줈 ?꾪솚: (1) Perplexity search_domain_filter 16媛?湲덉쑖 留ㅼ껜(bloomberg/reuters/cnbc/wsj/ft/marketwatch/seekingalpha/barrons/yahoo/investing/economist/morningstar/mk/hankyung/sedaily/chosun/mt) ?붿씠?몃━?ㅽ듃 + return_related_questions=false. ?몄씠利??쒓굅 + 怨듭떊???곗꽑. (2) Perplexity 寃곌낵 5遺?罹먯떆 ??window._pplxCache{queryKey:{answer,citations,_ts}}, 理쒕? 20媛?LRU. ?숈씪 荑쇰━ 5遺???諛섎났 ???ㅽ듃?뚰겕 ?앸왂 ??Perplexity API 鍮꾩슜 ?덇컧. (3) aio_cached_quotes TTL 48h??4h 異뺤냼 + 留뚮즺 ??localStorage.removeItem ?먮룞 ?몄텧. 湲곗〈? 議곌굔 誘몄땐議???臾댁떆留??섍퀬 ?붿〈 ??二쇰쭚/?고쑕濡?48h+ ?꾩쟻??stale quote媛 UI濡??쒖텧?섎뜕 ?좎옱 ?꾪뿕(P66/P67 ?⑤?由? 李⑤떒. (4) CoinGecko /simple/price 荑쇰━ ?뺤옣: include_market_cap/include_24hr_vol/include_last_updated_at ??4醫??뷀샇?뷀룓 ?쒖킑쨌嫄곕옒?됀룰갚?좎떆媛??섏쭛. marketCap/volume24h/cgLastUpdated ?꾨뱶 allQuotes??異붽?. window._btcDominanceTop4(BTC ?쒖킑 鍮꾩쨷 %) 洹쇱궗移???? 嫄곕옒???ㅽ뙆?댄겕 媛먯? + AI ?꾨＼?꾪듃 ?덉쭏 ?μ긽. (5) Alpha Vantage ?ъ씠?쒕컮 placeholder??'?좏깮 쨌 25????쨌 誘몄꽕????RSP/SPY ?대갚' 紐낆떆 ???좉퇋 ?ъ슜?먯쓽 ?꾩닔 ???ㅽ빐 ?댁냼. **?덈갑**: (1) ?몃? API ?좉퇋 湲곕뒫 ?꾩엯 ??鍮꾩슜/?덉씠?댁떆/?덉젙??3異??됯? ???꾪걧癒쇳듃 ?쒓린 ?ㅽ럺留?誘우? 留먭퀬 ??援ъ“? 異⑸룎 媛?μ꽦 寃?? (2) 諛섎났 ?ㅽ듃?뚰겕 ?몄텧? 5~15遺?TTL 罹먯떆 1?쒖쐞 怨좊젮. (3) UI placeholder/title??"?좏깮/?꾩닔" 紐낆떆濡??좉퇋 ?ъ슜???몄? 遺??媛먯냼. violated_rule: ?좉퇋(臾대즺 媛쒖꽑 湲고쉶 ?몄? 遺?? |
| **P116** | **v48.1** | **2026-04-17** | **v48.0 ?섏쭛 ?곗씠?곗쓽 UI/?듯빀 ?덉씠??遺????3嫄?*. v48.0?먯꽌 fetchFinnhubMetrics/Recommendation/EarningsCalendar 3?⑥닔??留뚮뱾?덉쑝??`fundamentalSearch`媛 ?몄텧?섏? ?딆쓬, _parseSECFinancials??rd/sbc/sga/cash/inventory/receivables/currentDebt 8?꾨뱶瑜??뚯떛?덉쑝??`_renderFundFinancials` UI???쒖떆 ???? fetchFearGreed媛 window._fgComponents??9媛??쒕툕瑜???ν븯??sentiment ?섏씠吏??移대뱶 UI ?놁쓬 ??"?곗씠???섏쭛留??섍퀬 ?곗? ?딅뒗" ?곹깭濡??ъ슜??泥닿컧 0. **?섏젙**: (a) fundamentalSearch?먯꽌 FMP 釉붾줉 ?댄썑 `Promise.allSettled([fetchFinnhubMetrics, fetchFinnhubRecommendation, fetchFinnhubEarningsCalendar])` 釉붾줉 異붽? + collected.finnhubMetrics/Recommendation/Earnings + sources 蹂댁“ 二쇱엯. FMP ???좊Т? 臾닿??섍쾶 ?ㅽ뻾?섏뿬 FMP ?묐떟 ?꾨씫 ?꾨뱶(beta, 52W ?? 蹂닿컯. (b) _renderFundFinancials 移대뱶 洹몃━???섎떒??'?깆옣二??덉쭏 & ?댁쟾?먮낯 (v48.1 ?좉퇋)' ?뱀뀡 異붽? ??R&D 媛뺣룄(R&D/留ㅼ텧 %, ?됱긽 ?곗뼱), SBC ?ъ꽍(>10% 寃쎄퀬), SG&A 鍮꾩쨷, ?꾧툑/?ш퀬/留ㅼ텧梨꾧텒/?좊룞遺梨? 8?꾨뱶 以?媛?議댁옱 ?쒖뿉留?移대뱶 ?뚮뜑(?몄씠利?諛⑹?). (c) sentiment ?섏씠吏 F&G 李⑦듃 ?섎떒??fg-components-widget + auto-fit grid ?쎌엯 + _renderFGComponents() ?⑥닔 ?좎꽕 ??9媛??쒕툕(S&P500 紐⑤찘?, 52二??좉퀬媛/?媛, ?쒖옣 ?? Put/Call, VIX 50???鍮?50?쇱꽑, ?뺥겕蹂몃뱶, ?덉쟾?먯궛, S&P125) ?먯닔+rating+?ㅻ챸 移대뱶 grid. fetchFearGreed ?깃났 ??setTimeout(0) + sentiment ?섏씠吏 吏꾩엯 ??setTimeout(100) ?몄텧. **?덈갑**: (1) ??API ?붾뱶?ъ씤???꾨뱶 ?섏쭛 ???숈떆 UI/?듯빀 ?덉씠??援ы쁽 泥댄겕由ъ뒪?명솕 ??"?곗씠?곕뒗 ?덈뒗??蹂댁씠吏 ?딆쓬" ?⑦꽩 李⑤떒. (2) /qa 泥댄겕由ъ뒪?몄뿉 "?섏쭛???묐떟 ?꾨뱶媛 ?ㅼ젣 UI ?먮뒗 AI ?꾨＼?꾪듃??二쇱엯?섎뒗媛" 寃利???ぉ 異붽?. violated_rule: ?좉퇋(?섏쭛-?뚮퉬 遺덉씪移? + P46(Dead Static HTML 蹂?? |
| **P115** | **v48.0** | **2026-04-17** | **API ??쎌쭊 5嫄???Claude Prompt Caching 誘몄쟻??+ usage 誘몄텛??+ CNN F&G ?쒕툕而댄룷?뚰듃 踰꾨┝ + Finnhub ??쒖슜 + SEC R&D/SBC ?꾨씫**. (1) callClaude(L25531)媛 system???⑥씪 string?쇰줈留??꾩넚 ??cache_control 誘몄쟻????留??붿껌留덈떎 ?꾩껜 ?쒖뒪???꾨＼?꾪듃 怨쇨툑 (CHAT_CONTEXTS 吏?쒕Ц? 諛섎났 ?ъ궗?⑸릺??罹먯떆 ?곹빀). (2) ?ㅽ듃由щ컢 ?묐떟??usage ?꾨뱶瑜??섏떊?섏? ?딆븘 ?ㅼ젣 ?좏겙/cache hit rate 痢≪젙 遺덇?, 荑쇳꽣??avgInputTokens=2500 怨좎젙 異붿젙移섎줈留?李④컧. (3) fetchFearGreed(L20404)媛 CNN API ?묐떟??7+2媛??쒕툕而댄룷?뚰듃(market_momentum_sp500 ??瑜??뚯떛?섏? ?딄퀬 醫낇빀 score留?痍⑦븿. (4) Finnhub 臾대즺 ?곗뼱??/stock/metric?metric=all, /stock/recommendation, /calendar/earnings ?쒓났?섎뒗???몄텧 肄붾뱶 0嫄???FMP ?좊즺 ???녿뒗 ?ъ슜?먮뒗 PER/ROE/?좊꼸由ъ뒪???곗씠???묎렐 遺덇?. (5) _parseSECFinancials(L27393)媛 湲곕낯 10?꾨뱶留?異붿텧, R&D(ResearchAndDevelopmentExpense)/SBC(ShareBasedCompensation) 誘명룷?????깆옣二??덉쭏 遺꾩꽍(R&D 媛뺣룄, SBC ?ъ꽍) 遺덇?. **?섏젙**: (a) system ?꾨뱶 2釉붾줉 遺꾪븷 + cache_control:ephemeral + anthropic-beta ?ㅻ뜑, 遺꾪븷 留덉빱 '?먮뜲?댄꽣 寃利??곹깭' 湲곗?. (b) message_start/message_delta?먯꽌 usage 異붿텧 ??window._lastClaudeUsage, console cache-hit 濡쒓렇, _refineQuotaByUsage() ?좎꽕濡??ㅼ젣 ?④? 湲곕컲 quota.costUSD ?ш퀎?? (c) F&G 9媛??쒕툕而댄룷?뚰듃 ??window._fgComponents ??? (d) fetchFinnhubMetrics/Recommendation/EarningsCalendar 3?⑥닔 ?좎꽕. (e) SEC XBRL ?뚯떛??rd/sbc/sga/cash/inventory/receivables/currentDebt 8?꾨뱶 異붽?. **?덈갑**: (1) LLM API 怨듭떇 臾몄꽌???좊즺 湲곕뒫(caching, batch, tools)? 遺꾧린 1???먭? ??Anthropic 怨듭떇 沅뚯옣 湲곕뒫 ?꾨씫 ???κ린 鍮꾩슜 ??쬆. (2) API ?묐떟 援ъ“瑜??묐떟 ?섑뵆濡?二쇨린???ㅽ봽?섏뿬 誘몄궗???꾨뱶 諛쒓껄. (3) ?숈씪 ?꾨찓??API(Finnhub /stock/*)??臾대즺 ?쒓났 ?붾뱶?ъ씤???꾩닔 寃????吏遺덊븳 ?ㅼ쓽 媛移?洹밸??? violated_rule: ?좉퇋(API 怨듭떇 湲곕뒫 ?쒖슜 遺?? + R26 |
| **P114** | **v47.12** | **2026-04-17** | **API ?몄텧 ?덉씠?댁떆 2嫄?(Yahoo 媛쒕퀎 ?몄텧 + FMP ?쒖감 await)**. (1) `fetchYFChart`(L18642)媛 PRIORITY_SYMS 500+ ?щ낵??媛쒕퀎 v8/chart ?몄텧. 泥?겕 ?대???Promise.all 蹂묐젹?댁?留??꾩껜 泥?겕???쒖감. Yahoo??v7/quote濡?理쒕? ~200 ?щ낵 諛곗튂 吏?먰븯?붾뜲 誘명솢?? (2) `fundamentalSearch`(L27366)??FMP 18媛??붾뱶?ъ씤??profile/income/balance/cashflow/ratios/key-metrics/ratios-ttm/metrics-ttm/peers/earnings-surprises/enterprise-values/executives/insider/institutional/estimates/price-target/rev-product/rev-geo/growth/DCF/short-interest)媛 `for await` ?쒖감 ?몄텧 ??16횞1.5s ??24s 珥?吏?? **?섏젙**: (a) `fetchLiveQuotes` 吏꾩엯遺??`_yfBatch` 罹먯떆 + `_yfBatchFetch` helper 異붽? ??`PRIORITY_SYMS.flat()` 以묐났 ?쒓굅 ??100媛?泥?겕濡?`/v7/finance/quote?symbols=A,B,C` 諛곗튂 ?몄텧(CF Worker 寃쎌쑀), ?묐떟?먯꽌 regularMarketPrice/chartPreviousClose/regularMarketChangePercent/regularMarketChange/DayHigh/DayLow/Volume/fiftyTwoWeekHigh/Low/marketCap/trailingPE/marketState + pre/postMarketPrice ?뚯떛?섏뿬 罹먯떆 ??? `fetchYFChart` 吏꾩엯遺??`if (_yfBatch[symbol]) return _yfBatch[symbol];` 泥댄겕 異붽?. CF Worker 誘몄꽕???ъ슜?먮뒗 _yfBatch 鍮꾩뼱?덉뼱 湲곗〈 v8 寃쎈줈 ?좎?(v7/quote??吏곸젒 ?몄텧 ??crumb ?붽뎄濡?遺덉븞??. 寃곌낵: CF Worker ?ъ슜??媛쒕퀎 ?몄텧 500+ ??3??諛곗튂(~99% 媛먯냼). (b) fundamentalSearch FMP 釉붾줉??`fmpJobs = [{url, handler}, ...]` 諛곗뿴濡??ш뎄????`Promise.allSettled(jobs.map(j => _fmpFetch(j.url).then(j.handler).catch(e=>console.warn(...))))`濡?蹂묐젹?? 媛?handler??湲곗〈 updateProgress + collected.* ?좊떦 濡쒖쭅 蹂댁〈. 媛쒕퀎 try-catch濡????붾뱶?ъ씤???ㅽ뙣媛 ?꾩껜瑜?留됱? ?딆쓬. **?덈갑**: (1) ?숈씪 API ?щ윭 ?붾뱶?ъ씤???쒖감 await ?⑦꽩 諛쒓껄 ??利됱떆 Promise.allSettled ?꾪솚 寃?? (2) ?ㅼ쨷 ?щ낵 ?쒖꽭 ?몄텧? 怨듭떇 諛곗튂 ?붾뱶?ъ씤???쒖슜 ?곗꽑. (3) 諛곗튂 ?ㅽ뙣 ????긽 媛쒕퀎 ?대갚 蹂댁옣(CF Worker 誘몄꽕??+ ?묐떟 ?뚯떛 ?ㅽ뙣 ?묒そ). violated_rule: ?좉퇋(蹂묐젹/諛곗튂 理쒖쟻??遺?? |
| **P113** | **v47.11** | **2026-04-17** | **API 荑쇳꽣 ??퉬 3嫄?(Twelve Data 쨌 FMP profile 쨌 FRED ?꾨씫)**. (1) Twelve Data `fetchTechnicalIndicators`媛 RSI/MACD/Stoch/ADX/BBands/EMA瑜?`for-await + 200ms sleep` ?쒖감濡?6???몄텧 ??15遺??먮룞 媛깆떊(L13360, L13391)怨?寃고빀?섏뼱 ??576???몄텧, 臾대즺 800/day??72% ?뚮え. (2) FMP `_fetchSectorCompareData`(L25651)媛 8醫낅ぉ 횞 5 endpoint 紐⑤몢 媛쒕퀎 ?몄텧, profile? FMP 怨듭떇 ?쇳몴 諛곗튂 吏?먮릺?붾뜲 誘명솢????8 profile ?몄텧??1?뚮줈 ?뺤텞 媛?? (3) FRED ?ъ슜 肄붾뱶(L12997)?먯꽌 `DFEDTARU` 李몄“ 以묒씤??`FRED_SERIES`(L12861)???깅줉 ?꾨씫 ??`fetchAllFredData`媛 ???쒕━利덈? 媛?몄삤吏 ?딆븘 ?대떦 遺꾧린 肄붾뱶媛 ?ъ떎??dead. 異붽?濡?`FRED_SERIES_EXT`(v47.10 ??젣)???좎뼵留??덈뜕 PAYEMS/M2SL/DCOILWTICO/MORTGAGE30US???ㅼ젣 ?섏쭛 寃쎈줈 ?놁쓬. **?섏젙**: (a) POST `/complex_data` ?꾪솚 + ?묐떟 ?뚯떛 ?ㅽ뙣 ??媛쒕퀎 ?쒖감 ?대갚(怨꾩젙 ?뚮옖 誘몄????鍮?, (b) `_fetchSectorCompareData` 猷⑦봽 ?쒖옉 ??`/v3/profile/A,B,C` 諛곗튂 ?몄텧 ??`profileMap`????? 猷⑦봽 ?대? profile 釉붾줉? 留??곗꽑 / 誘몃ℓ移???媛쒕퀎 ?대갚, (c) `FRED_SERIES`??5媛??쒕━利?DFEDTARU, PAYEMS, M2SL, DCOILWTICO, MORTGAGE30US) 異붽?. **?덈갑**: (1) ?몃? API ?좉퇋 ?붾뱶?ъ씤???ъ슜 ???대떦 API??諛곗튂/踰뚰겕 吏???뺤씤 ?꾩닔 (怨듭떇 臾몄꽌 李몄“). (2) ?쒖감 `await` 猷⑦봽???잛닔 횞 二쇨린瑜??쇱씪 荑쇳꽣? ?議? (3) 李몄“?섎젮???곸닔媛 ?뺤쓽遺???ㅼ옱?섎뒗吏 grep 寃利?R26 ?ш컯??. violated_rule: ?좉퇋(API 荑쇳꽣 理쒖쟻??遺?? + R26 |
| **P112** | **v47.10** | **2026-04-17** | **API ?꾩닔 媛먯궗 ?붿〈 dead code + CF Worker ?붿씠?몃━?ㅽ듃 遺덉씪移?*. (1) CF Worker ALLOWED_DOMAINS(22媛?? index.html ?ㅼ젣 ?몄텧 ?꾨찓??鍮꾧탳 ??11媛??꾨씫 ??Naver 4怨?api.stock.naver.com, polling.finance.naver.com, api.finance.naver.com, fchart.stock.naver.com), api.coingecko.com, api.alternative.me, cdn.cboe.com, open.er-api.com, api.exchangerate-api.com, translate.googleapis.com, translate.google.com. CF Worker ?ъ슜?먭? ???꾨찓???몄텧 ??403 Forbidden 諛쏄퀬 吏곸젒 ?몄텧濡??대갚?섏뿬 ?숈옉? ?섎릺 CORS/罹먯떆/蹂댁븞 ?ㅺ퀎 痍⑥? 臾댁궛. (2) Dead code 9嫄? fetchChartData, fetchBreadthFromAV, fetchFundamentals, fetchFinnhubCompanyNews, fetchFREDData, fetchFREDBatch, SEC_CIK_CACHE, DATA_APIS.altFearGreed + exchangeRate, FRED_SERIES_EXT ??紐⑤몢 ?뺤쓽/?좎뼵留??덇퀬 ?몄텧 0嫄?(~100以?肄붾뱶 遺??. **?섏젙**: CF Worker 11媛??꾨찓??異붽? + index.html dead 釉붾줉 9嫄??쒓굅(?쒓굅 ??媛곴컖 grep ?몃? ?몄텧??0嫄??ъ쟾 寃利?. **?덈갑**: (a) CF Worker `ALLOWED_DOMAINS`???좉퇋 ?꾨찓??異붽? ?꾩슂 ??index.html??fetch/XHR ?몄텧遺 ?꾩닔 grep?쇰줈 ????뚯븙 (`grep -o 'https://[^/"'\''` `]*'`). (b) ?좉퇋 ?⑥닔/?곸닔 異붽? ??1二쇱씪 ???ㅼ젣 ?몄텧?섏? ?딆쑝硫?濡ㅻ갚 寃????dead code???좎?蹂댁닔 ???ㅼ씤 ?좊컻 + ?뚯씪 ?ш린 利앸?. (c) API ?꾩닔 媛먯궗??遺꾧린 1???댁긽 ?뺣???(/qa ?ㅽ궗 泥댄겕由ъ뒪???뺤옣). violated_rule: R26(肄붾뱶 ?뺤씤 ?놁씠 異붿륫 ?먮떒 湲덉?) + ?좉퇋 (CF Worker ???몄텧遺 ?숆린???꾨씫) |
| **P111** | **v47.9** | **2026-04-17** | **Vault PIN ?ъ슜?먯쓽 10媛?API ???꾨㈃ 癒뱁넻 ??P109 遺遺??섏젙 ?붿〈**. v47.7 P109??`getApiKey()`(Claude ?꾩슜)留?硫붾え由?罹먯떆 ?⑦꽩?쇰줈 ?섏젙. 洹몃윭??`_AIO_SENSITIVE_KEYS`??11媛?以??섎㉧吏 10媛?aio_fmp_key / aio_finnhub_key / aio_av_key / aio_td_key / aio_fred_key / aio_perplexity_key / aio_google_cse_key / aio_google_cse_cx / aio_newsdata_key / aio_rss2json_key / aio_cf_worker_url)???고???議고쉶???ъ쟾??`localStorage.getItem(...)` ?먯떆 ?묎렐. Vault PIN ?ㅼ젙 ?ъ슜?먭? 釉뚮씪?곗? ?ъ떆????PIN ?댁젣?대룄 `_restoreDecryptedKeys`??input DOM?먮쭔 媛믪쓣 苑귢퀬 fetcher?ㅼ? input???꾨땶 localStorage 議고쉶 ???뷀샇?붾맂 `aio_enc::base64...` 臾몄옄?댁씠 fetch ?ㅻ뜑(`x-api-key`) / URL(CF Worker) / query string(perplexity/fmp)??洹몃?濡?二쇱엯 ??401/403/invalid URL濡??꾨㈃ 癒뱁넻. ?ъ슜??泥닿컧: "??ν븳 API ?ㅻ뱾?????щ씪議뚮떎". ?ㅼ젣: 媛믪? localStorage??議댁옱?섎굹 ?대룆 ?놁씠 raw ?묎렐 以? **?섏젙** (index.html): (1) `_AioVault._keyRuntime = {}` ?듯빀 ?고???罹먯떆 ?꾨뱶 ?좎꽕 ??`lock()` ??珥덇린?? (2) `_getApiKey(lsKey)` ?듯빀 getter ?좎꽕(L9229) ???고???罹먯떆 1?쒖쐞, ?됰Ц 2?쒖쐞, `aio_enc::` 媛먯? ??鍮?臾몄옄???좉? ?좏샇) 3?쒖쐞, (3) `_restoreDecryptedKeys` ?뺤옣(L9319) ??11媛?誘쇨컧 ??紐⑤몢 蹂듯샇????`_keyRuntime`?????+ aio_rss2json_key input 留ㅽ븨 異붽?(湲곗〈 ?꾨씫) + 誘쇨컧 ??input 留덉뒪?? (4) `safeLSGetSync` ?뺤옣 ???뷀샇??媛믪씠?대룄 罹먯떆??蹂듯샇??媛??덉쑝硫?諛섑솚, (5) `_saveApiKey` ?뺤옣 ?????利됱떆 `_keyRuntime` ?숆린??+ 留덉뒪??媛????嫄곕?(UI ?ъ????ㅼ닔 諛⑹?), (6) ?먯떆 `localStorage.getItem('aio_*')` 35怨? ?쇨큵 `_getApiKey()`濡?援먯껜: FMP 9, Perplexity 4, Google CSE 8, rss2json 3, newsdata 1, CF Worker 11, Finnhub 2, FRED 2, AV/TD ?쇳빆 ?대?, (7) L21524 ?ㅽ? `'aio_claude_key'`(鍮꾩〈?? ??`'aio_claude_api_key'` ???⑤낫??諛곕꼫 ???좊Т 泥댄겕媛 ??긽 falsy ???遺??踰꾧렇. **寃利?*: `grep "localStorage.getItem('aio_(fmp\|finnhub\|av\|td\|fred\|perplexity\|google_cse\|newsdata\|rss2json\|cf_worker\|claude)"` 0嫄? **?덈갑**: (a) `_AIO_SENSITIVE_KEYS`????異붽? ??**諛섎뱶??3怨??숇컲 ?섏젙**: `_restoreDecryptedKeys.keyMap`, `_keyRuntime` 珥덇린??蹂댁옣, fetcher ?꾩닔 `_getApiKey` 寃쎌쑀 ?뺤씤. (b) ?먯떆 `localStorage.getItem('aio_*')` 吏곸젒 ?ъ슜 湲덉?(肄붾뱶 由щ럭 泥댄겕由ъ뒪??異붽?) ??紐⑤뱺 誘쇨컧 ???묎렐? `_getApiKey()` 寃쎌쑀 ?꾩닔. (c) v47.7 P109?먯꽌 "Claude ??嫄대쭔 怨좎튂怨??섎㉧吏 異붿젙 臾닿?利? ?⑦꽩 ?щ컻 ??`safeLS`/`safeLSGet` ???移?쿂??`_getApiKey`/`_saveApiKey`???띿쑝濡??쇨? ?ъ슜. violated_rule: R26(肄붾뱶 ?뺤씤 ?놁씠 異붿륫 ?먮떒 湲덉?) + R13(?곗씠??寃쎈줈 ?댁썝??湲덉?) + P109 ?꾩냽 |
| **P110** | **v47.8** | **2026-04-17** | **AI ?⑤꼸 chatSendUnified() ?꾩넚 癒뱁넻 ??state.streaming ?곴뎄 ?좉?**. ?ъ슜??利앹긽: "AI 遺꾩꽍媛 ?대┃?섎㈃ ?⑤꼸? ?대━?붾뜲 湲????蹂대궡??. 洹쇰낯 ?먯씤: `chatSendUnified()`媛 `inp.value=''` 吏곹썑 `state.streaming=true` ?ㅼ젙 ???곗씠??二쇱엯 ?④퀎(_fetchTickerDataForChat 8s, _fetchSectorCompareData, _fetchDeepCompareData, _aiDeepSearch/_aiWebSearch) ?몃? API 以??섎굹?쇰룄 hang?섎㈃ `callClaude` ?몄텧源뚯? 紐?媛???streaming ?곹깭 ?곴뎄 true ???댄썑 紐⑤뱺 ?꾩넚 ?쒕룄媛 `if (state.streaming) return;` silent return. 湲곗〈 chatSend/chatSendUnified ??媛?`await`媛 媛쒕퀎 ??꾩븘???놁쓬(?뱁엳 Perplexity/Google ?밴???. 遺?? `consumeLLMQuery()`媛 荑쇳꽣 珥덇낵 ??Promise(紐⑤떖) 諛섑솚?섎뒗??`!consumeLLMQuery()` ?숆린 泥댄겕濡?truthy ?먯젙 ??紐⑤떖 ?湲??놁씠 吏꾪뻾. **?섏젙** (index.html chatSendUnified ~line 40381): (a) `_withTimeout = Promise.race([p, setTimeout rej])` ?섑띁 異붽? + 5?④퀎 ?몃? API 媛곴컖 媛쒕퀎 ??꾩븘??8~12s, (b) `state.streaming=true` ?ㅼ젙 ?꾩튂瑜?callClaude 吏곸쟾(~line 40555)?쇰줈 ?대룞 ???곗씠??二쇱엯 hang/throw媛 streaming ?곹깭 ?ㅼ뿼 諛⑹?, (c) stale streaming 媛먯? ??`state._streamStartedAt` timestamp 湲곕줉 ???ъ쭊????60珥? 寃쎄낵硫?媛뺤젣 ?댁젣 + 踰꾪듉 蹂듦뎄, (d) callClaude 珥덇린 ?몄텧 + ?ъ떆??setTimeout ?대? ?묒そ try-catch濡?媛먯떥 ?숆린 throw ??streaming 由ъ뀑 + `_streamStartedAt=null` ?숇컲, (e) `consumeLLMQuery` await ?꾩닔. **遺???뺣━**: _aiCtxMap/_aiDefaultChips?먯꽌 signal/breadth/sentiment/theme-detail 4媛?+ kr-supply dead chips ?쒓굅 ???ъ슜???섎룄 9媛??섏씠吏濡?異뺤냼. R1 6怨?title/badge vs APP_VERSION v47.7 ?붿〈 遺덉씪移???v47.8濡??듭씪. **?덈갑**: (1) `state.streaming=true`??諛섎뱶???ㅼ젣 API ?몄텧 吏곸쟾???ㅼ젙(?곗씠??二쇱엯蹂대떎 ?섏쨷). (2) 紐⑤뱺 ?몃? API `await`????꾩븘???섑띁 ?꾩닔 ??Perplexity/Google/CF Worker???먯껜 ??꾩븘???놁쓬??媛?? (3) Promise 諛섑솚 媛???⑥닔(`consumeLLMQuery` ????`await` 泥댄겕 ?쇨? ?곸슜. (4) stale ?곹깭 諛⑹뼱 timestamp ?⑦꽩? streaming ?좉툑 ?곕뒗 紐⑤뱺 ?⑥닔(chatSend ?????뺤궛 寃?? violated_rule: R15(?곗씠??誘몄닔??vs 吏꾩쭨 0% 援щ텇)??"?곹깭 ?ㅼ뿼 臾대갑?? ?⑦꽩 + ?좉퇋(?몃? API ??꾩븘??遺?? |
| **P109** | **v47.7** | **2026-04-16** | **Vault ?뷀샇?붾맂 Claude API ??getApiKey ?먯떆 議고쉶濡?"?щ씪吏?**. `aio_claude_api_key`??`_AIO_SENSITIVE_KEYS`(index.html line 9181)???ы븿 ???ъ슜??PIN ?ㅼ젙 ??`_migrateToEncrypted()`媛 `aio_enc::base64...` ?뺤떇?쇰줈 ?뷀샇?? 洹몃윭??`getApiKey()`(line 22683)??`localStorage.getItem(CLAUDE_KEY_LS)` ?먯떆 議고쉶 ??`_isValidApiKey(^sk-ant-)` 寃利???validation ?ㅽ뙣 ??鍮?臾몄옄??諛섑솚(silent). ?ъ슜???낆옣: "??ν븳 ?ㅺ? ?щ씪吏?. `_restoreDecryptedKeys()` keyMap??Claude ???꾨씫 ??Vault ?좉툑 ?댁젣?대룄 蹂듭썝 ???? `setApiKey()`??`localStorage.setItem` ?됰Ц ?꾩슜 ???ㅼ쓬 留덉씠洹몃젅?댁뀡 ?ъ씠???щ컻. **?섏젙**: (1) `_AioVault._claudeKeyRuntime` ?고???硫붾え由?罹먯떆 ?꾨뱶 異붽?, `lock()` ??珥덇린?? (2) `_restoreDecryptedKeys` keyMap 理쒖긽?⑥뿉 `['aio_claude_api_key', 'sidebar-api-key']` 異붽? ??蹂듯샇??媛믪? 硫붾え由?罹먯떆????? input? 留덉뒪???쒖떆. (3) `getApiKey()` 罹먯떆 ?곗꽑 李몄“, `aio_enc::` 媛먯? ??肄섏넄 寃쎄퀬("PIN?쇰줈 ?좉툑 ?댁젣 ?꾩슂"). (4) `setApiKey()` Vault ?좉툑 ?댁젣 ?곹깭硫?`safeLS`濡??뷀샇?????+ 罹먯떆 ?숆린?? **?덈갑**: (a) `_AIO_SENSITIVE_KEYS`????異붽? ??`_restoreDecryptedKeys` keyMap ?숇컲 ?섏젙 ?꾩닔(諛섏쁺 ?꾨씫 ??蹂듭썝 遺덇?). (b) getter/setter ?띿? `safeLS`/`safeLSGet` ?ъ슜??湲곕낯 ???먯떆 localStorage 吏곸젒 ?묎렐 吏?? violated_rule: R26(肄붾뱶 ?뺤씤 ?놁씠 異붿륫 ?먮떒 湲덉?) + R13(?곗씠??寃쎈줈 ?댁썝??湲덉?) |
| **P108** | **v47.7** | **2026-04-16** | **DATE_ENGINE.today() 誘몄〈??硫붿꽌???몄텧 ??AI 梨꾪똿 ?꾩껜 臾대컲??*. v47.6 NARRATIVE_ENGINE ?묒꽦 ??`DATE_ENGINE.today()` 媛???몄텧. ?ㅼ젣 DATE_ENGINE IIFE return export: `nowKST, lastKrTradingDay, lastUsTradingDay, isKrTradingDay, isUsTradingDay, krxStatus, currentWeekRange, fmtMD, fmtYMD, fmtMMDD, applyToDOM` ??`today` ?놁쓬. macro 梨꾪똿 吏꾩엯 ??`CHAT_CONTEXTS['macro'].system()` 鍮뚮뱶 以?TypeError ??`chatSend()`??`var systemPrompt = ctx.system();`??throw ??梨꾪똿 ?묐떟 遺덇?. ?섏젙 2怨?index.html): line 9947 NARRATIVE_ENGINE.getDistributionDiagnosisText ?대갚 + line 29711 CHAT_CONTEXTS['macro'] ??紐⑤몢 `DATE_ENGINE.fmtYMD(DATE_ENGINE.nowKST())`濡?援먯껜. **?덈갑**: (a) IIFE濡?closure 媛먯텣 媛앹껜??public API??return 由ы꽣?대쭔 ?좏슚 ???ъ슜 ??Grep/Read濡?export ?뺤씤 ?꾩닔. (b) NARRATIVE_ENGINE 媛숈? ?좉퇋 ?섏〈??紐⑤뱢 ?묒꽦 ???몄텧 ???媛앹껜??export 紐⑸줉???ъ쟾 臾몄꽌?? (c) try/catch濡?ctx.system() 媛먯떥??梨꾪똿 ?꾩껜 ?ㅽ뙣 ???湲곕낯 ?꾨＼?꾪듃 ?대갚 (?ν썑 由ы뙥?좊쭅 ???. violated_rule: R26(肄붾뱶 ?뺤씤 ?놁씠 異붿륫 ?먮떒 湲덉?) |
| **P107** | **v47.5** | **2026-04-16** | **?곗씠??援먯껜 ???뚯깮 濡쒖쭅쨌?ㅻ챸臾맞텺ACRO_KW ?붿〈 ?뺤씤 ?꾨씫**. v47.4 P106 ?뺤젙? DATA_SNAPSHOT + DOM 3媛?+ CP3 移대뱶 + CHAT_CONTEXTS ?쇰??먮쭔 ?곸슜. ?⑥씪 吏꾩떎 ?먯쿇??`DATA_SNAPSHOT._fallback` 釉붾줉(computeTradingScore쨌fgUpdateNeedle 李몄“)? fg 68 / vvix 95 / spxATH 6967 洹몃?濡??좎? ??momScore媛 Greed 72濡?怨꾩냽 怨꾩궛???ㅼ젣 CNN 47 Neutral). classifyMarketRegime? _fb 誘몄갭議?+ ?섎뱶肄붾뵫 6593/6656 ?ъ슜. MACRO_KW ?ъ쟾??VVIX 98/MOVE 68/SKEW 139/F&G 68 ?ㅼ썙?쒕쭔 議댁옱 ??4/15 媛믪쑝濡?吏덈Ц ???ㅼ썙???ㅼ퐫??0. CHAT_CONTEXTS 짠72 3媛쒖냼(?쇱씤 29515/29520/29521)??SKEW 139, MOVE 68 ?붿〈. FALLBACK_QUOTES ^GSPC 6967.38. ?ъ슜??"遺꾩꽍 ?⑥닔쨌?ㅻ챸쨌??뫢룻듃?덉씠??諛⑸쾿 ??諛붾먭굅??" 吏덈Ц?쇰줈 ?몄텧. **?뺤젙**: _fallback 6?꾨뱶 ?숆린??+ fg_uw/move/skew ?좎꽕, classifyMarketRegime _fb ?듯빀, FALLBACK_QUOTES ^GSPC/^IXIC/^VVIX 媛깆떊, MACRO_KW??4/15 媛?蹂묎린(?덇굅???꾨갑?명솚), CHAT_CONTEXTS 짠72 ?붿〈 3媛쒖냼 ?섏젙. **?덈갑**: (1) /data-refresh 泥댄겕由ъ뒪?몄뿉 D9(_fallback ?뺥빀??, D10(MACRO_KW 蹂묎린), D11(classifyMarketRegime ?섎뱶肄붾뵫 ?ㅼ틪) 異붽?. (2) DATA_SNAPSHOT ?レ옄 諛붾??뚮쭏??"?뚯깮 濡쒖쭅 ?대갚媛?+ ?ㅼ썙???ъ쟾 + ?쒕굹由ъ삤 ?띿뒪?? 3以??뺤씤 ?먮룞?? (3) P61 媛뺥솕 ??"?섎뱶肄붾뵫 ?쒖닠 泥댄겕"??CHAT_CONTEXTS肉??꾨땲??_fallback/FALLBACK_QUOTES/MACRO_KW???ы븿. violated_rule: R26 + R13 + P61 ?곗뇙 |
| P106 | v47.4 | 2026-04-16 | ?쒓컙李??대?吏 ?곗씠??DATA_SNAPSHOT ?ㅺ린?? v47.2 /integrate ??"?꾪뿕遊?3/30 12:49 STABLE" ?대?吏 ?댁꽍 ??`tail_risk_snapshot_0330` 蹂꾨룄 ?꾨뱶 ?앹꽦? ?뺣떦. 洹몃윭??二?DATA_SNAPSHOT.vvix = 98(3/30 媛???4/15 ?꾨뱶???숆린?뷀븯??16????媛믪씠 ?꾩옱 媛믪쑝濡?湲곗옱?? v47.3 /data-refresh?????ㅻ쪟瑜?compaction summary??"?꾨즺" 湲곕줉留??좊ː?섍퀬 ?ш?利??놁씠 ?듦낵(D7 嫄곗쭞 PASS). ?ъ슜??"?뺤씤?쒓굅??" 吏덈Ц ??WebSearch ?ш?利앹쑝濡?諛쒓껄. ?뺤젙: VVIX 98??0.10, MOVE 68??2.36, SKEW 139??41.86(4/15 ?ㅼ륫). CNN F&G 68??7 Neutral 遺꾨━, UW F&G 68 蹂꾨룄 fg_uw ?꾨뱶. WTI 91.62??1.29, HY OAS 282??84. ?덈갑: (1) ?대?吏 ??댄????좎쭨 紐낆떆??寃쎌슦 二?DATA_SNAPSHOT???덈? 蹂듭궗 湲덉?, snapshot ?꾨뱶留??ъ슜. (2) /data-refresh D7? ?몄뀡留덈떎 臾댁“嫄?WebSearch ?ъ떎??compaction summary 湲곕줉 遺덉떊). (3) ?ъ슜?먯쓽 "?뺤씤?덈굹" 吏덈Ц? Self-Eval ?ъ떎???몃━嫄곕줈 痍④툒. violated_rule: R26(異붿륫 ?먮떒 湲덉?) + R13(?쒓컙李??댁썝?? |
| P65 | v45.5 | 2026-04-09 | ?좉?/紐⑤뱶 蹂?섎뒗 ?뚮뜑 ?⑥닔 ?대??먯꽌 ?ㅼ젣濡?遺꾧린 ?ъ슜?섎뒗吏 grep 寃利?(UI??踰꾪듉留?wired??dead toggle 諛⑹?) |
| P66 | v45.5 | 2026-04-09 | ?곗씠??誘몄닔???곹깭?먯꽌 "濡쒕뵫" ?띿뒪???곴뎄 ?뺤껜 湲덉? ???대갚 ?곗씠???곗꽑 ?ъ슜, 洹몃옒???놁쑝硫?"?湲???濡?紐낆떆 |
| P67 | v45.5 | 2026-04-09 | 媛숈? ?숆툒 而댄룷?뚰듃(pulse-seg/移대뱶)???숈씪 ?먯떇 援ъ“ ?좎?. ?쒖そ留??먯떇 ?꾨씫 ???쒓컖 ?뺣젹 源⑥쭚 |
| **P139** | **v48.68** | **2026-04-27** | **scroll-chaining 踰꾧렇**: `.content(overflow-y:auto)`媛 scrollTop=0?먯꽌 ???꾨옒濡??ㅽ겕濡???遺紐?body쨌app쨌main, 紐⑤몢 overflow:hidden)濡??대깽???꾪뙆 ??遺紐??ㅽ겕濡?遺덇? ???ъ슜??"?ㅽ겕濡????? 泥닿컧. ?뚮쭏/?몃젋???섏씠吏 ?ы븿 ???섏씠吏 ?대떦. `overscroll-behavior-y:contain` + `-webkit-overflow-scrolling:touch` 異붽?濡??닿껐 |
| **P140** | **v48.69** | **2026-04-28** | **CDN SRI ?꾨씫 ??supply chain attack ?꾪뿕**: index.html CDN `<script>` 3媛?chart.js/dompurify/lightweight-charts)??integrity/crossorigin ?띿꽦 ?놁쓬 ???ㅽ듃?뚰겕쨌CDN ?ㅼ뿼 怨듦꺽 ???꾩쓽 肄붾뱶 ?ㅽ뻾 媛?? sha384 ?댁떆 + crossorigin="anonymous" 異붽? ??R52 ?좎꽕(援?R34, 2026-05-09 ?щ쾲?? violated_rule: R52(CDN SRI ?섎Т) |
| **P141** | **v48.69** | **2026-04-28** | **setInterval ID 誘몄????щ컻(aio-core.js:494/1078)**: _aioRenderSnapshotDates쨌_aioUpdateFreshness ????대㉧ 諛섑솚媛?誘몄?????clearInterval 遺덇? ????諛섎났 ?꾪솚 ????대㉧ ?꾩쟻. window._aioSnapshotDatesTimer쨌_aioFreshnessTimer ???+ ?щ벑濡???clearInterval ?좏뻾. R9 4李?媛뺥솕 |
| **P142** | **v48.69** | **2026-04-28** | **R15 ?꾨컲 5嫄??щ컻(aio-data.js:8829/8831/9616/9692/9940)**: extPct쨌F&G 泥섎━??`\|\| 0` ?⑦꽩 ??null 誘몄닔????"0.00%"/"0 洹밸떒怨듯룷" ?ㅽ몴?? `!= null ? val : null` ?⑦꽩?쇰줈 ?꾪솚. R15 5李?媛뺥솕 |
| **P143** | **v48.69** | **2026-04-28** | **_lastFetch ??遺덉씪移????ы듃?대━???좎꽑????긽 "?湲?以?**: _aioUpdateFreshness()媛 `.liveQuotes` 議고쉶, _markFetch()??`'quote'` ????????곴뎄 miss. aio-core.js:1058 ??`_lastFetch.quote \|\| _lastFetch.liveQuotes` ?묒そ ?대갚 議고쉶濡??섏젙 |
| **P190** | **v49.3** | **2026-05-10** | **?꾩닔媛먯궗 ?꾪궎?띿쿂 ?덉씠??遺덉씪移?*: ?⑥닔/?곗씠???뚯씠?꾨씪???붾㈃/李⑦듃/?꾨＼?꾪듃/?ы듃?대━??媛먯궗 湲곗??먯꽌 ?곗씠???덉쭏, ?댁뒪 ?곹뼢?? AI ?명봽??怨쇱뿴, ?ъ???湲곗닠 由ъ뒪?ш? 媛곴컖 ?곕줈 ?吏곸뿬 理쒖쥌 ?붾㈃怨?AI ?듬????좊ː???됰룞?깆씠 ?쏀뻽?? ?섏젙: `calcDataQuality`, `calcAIInfraHeat`, `calcPositionTechnicalRisk`, `calcPortfolioTechnicalRisk`, `calcNewsImpactVector`瑜?異붽??섍퀬 OHLCV fallback??dataQuality瑜?遺숈??쇰ŉ, ?댁뒪 impact badge? ?ы듃?대━??湲곗닠 由ъ뒪???⑤꼸, T108~T115 ?뚯뒪?몃? 異붽??덈떎. ?덈갑: ???곗씠??遺꾩꽍/?뚮뜑 湲곕뒫? source confidence, stale/fallback, action ladder, portfolio impact瑜?媛숈? ?쒖??쇰줈 ?곌껐?쒕떎. violated_rule: R42(?ㅼ륫 援먯감寃利? R32(?섏튂 諛⑹뼱) R1(踰꾩쟾 ?숆린?? |
| **P189** | **v49.2** | **2026-05-09** | **湲곗닠遺꾩꽍 怨꾩궛 ?덉씠??遺덉씪移?*: 湲곗닠 ?섏씠吏??硫붿씤 ?쒕뒗 ?뱀씪 ?깅씫瑜?湲곕컲 RSI/MACD/蹂쇰┛? 媛꾩씠 異붿젙媛믪쓣 ?ъ슜?섍퀬, ?λ텇?앹? OHLCV 湲곕컲 ?ㅼ젣 罹붾뱾/MA/RSI瑜??ъ슜??媛숈? ?섏씠吏 ?덉뿉?쒕룄 ?먮떒 洹쇨굅媛 ?щ옄?? 湲곌????ㅽ겕由щ꼫 愿?먯쓽 泥?궛/異뺤냼 寃곕줎??遺?? ?섏젙: `aio-core.js`??OHLCV 湲곕컲 ?쒖닔 怨꾩궛 ?⑥닔? `calcTechnicalSnapshot`/`calcSellPressure`/`calcSemiHeatMap`/`calcExitPlan`??異붽??섍퀬, `fetchOHLCVWithFallback()`?쇰줈 Twelve Data 誘몄뿰寃???Yahoo chart fallback???쒓났. 湲곗닠 ?섏씠吏 `Institutional Technical Brief`? AI ?꾨＼?꾪듃/action ladder, T103~T107 ?뚯뒪??異붽?. ?덈갑: 湲곗닠 吏??UI??媛?ν븳 寃쎌슦 ??긽 ?숈씪 snapshot ?붿쭊???ъ슜?섍퀬, ?곗씠??誘몄닔????graceful fallback怨?紐낆떆 ?쇰꺼???붾떎. violated_rule: R32(?섏튂 諛⑹뼱) R42(?ㅼ륫 援먯감寃利? R1(踰꾩쟾 ?숆린?? |
| **P188** | **v49.1** | **2026-05-09** | **?듯빀 ??釉뚮씪?곗? acceptance drift**: Claude v49.1 ?듯빀 ???ㅼ젣 Chrome `AIO.runTests()`媛 173/177 PASS濡??ㅽ뙣. ?먯씤: `_aioLRU.get()` miss 諛섑솚 怨꾩빟(null)怨?`scoreItem`/ticker regex ?몄텧遺(undefined check) 遺덉씪移???`fetchAllNews` null.tm 移섎챸 濡쒓렇, VaR 95% 瑗щ━ 媛쒖닔 `1-0.95` 遺?숈냼??寃쎄퀎, `_aioSafeMD` fallback??`onerror` 臾몄옄?댁쓣 escape留??섍퀬 ?쒓굅?섏? ?딆쓬, LightweightCharts ?대? canvas媛 臾대씪踰⑤줈 媛먯궗 寃쎄퀬. ?섏젙: `_aioLRU` miss null 怨꾩빟???몄텧遺 ?숆린?? conservative historical VaR + epsilon, safeHtml fallback ?대깽??javascript ?띿꽦 ?쒓굅, `_aioMarkChartCanvases` 諛?active-page render audit ?곸슜. ?덈갑: ?듯빀 ???ㅼ젣 釉뚮씪?곗??먯꽌 `AIO.runTests()` all-pass, `AIO.getDataPipelineAudit().status === 'ok'`, 肄섏넄 error 0??acceptance gate濡??붾떎. violated_rule: R32(?섏튂 諛⑹뼱) R9(?꾩뿭 ?곹깭) R17(?묎렐?? |
| **P187** | **v49.1** | **2026-05-09** | **history.pushState ?꾩뿭 monkey-patch + _fmtNum Infinity**: popstate ?몃뱾?ъ뿉??`showPage` ?몄텧 ??`history.pushState = function(){}` ?꾩뿭 援먯껜 ??finally濡?蹂듦뎄 ??throw 誘몃컻?앹씠吏留??숆린 ?꾩뿭 蹂寃쎌? unsafe ?⑦꽩. `_aioInPopstate` ?뚮옒洹몃줈 援먯껜. `_fmtNum(Infinity)`??"InfinityT"` ?ㅽ몴?? `Math.abs(Infinity)>=1e12` 議곌굔 ?듦낵 ??`.toFixed()` ?몄텧. `_aioFiniteNum` ?꾩엫?쇰줈 ?섏젙. violated_rule: R32(?섏튂 諛⑹뼱) R9(?꾩뿭 ?곹깭) |
| **P186** | **v49.1** | **2026-05-09** | **vixToPercentile 80+ ?몄궫 誘멸뎄??+ DST ?좎쭨 鍮꾧탳 ?ㅼ감**: `return 99.5`(?섎뱶罹? ??VIX=82? VIX=100???숈씪 percentile. 濡쒓렇?몄궫(`p=100-0.5*(80/vix)짼`)?쇰줈 ?⑥“利앷? 援ы쁽. `_aioMemoStaleInfo`??`d.getTime() > Date.now() + 86400000` ??11??DST fall-back(25h ?섎（)?먯꽌 `25h > 24h`濡?true媛 ?섏뼱 誘몃옒 ?좎쭨瑜??묐뀈?쇰줈 濡ㅻ갚. 3??11??짹1h ?덉슜 異붽?. violated_rule: R32(?섏튂 ?뺥솗?? |
| **P185** | **v49.1** | **2026-05-09** | **_chartIv raw setInterval ??대㉧ ?덉??ㅽ듃由??꾨씫**: Chart.js CDN 濡쒕뱶 ?湲?`setInterval`??`_aioRegisterTimer` ?몃??먯꽌 ?ㅽ뻾 ??`clearInterval(_chartIv)` 吏곸젒 ?몄텧, ?덉??ㅽ듃由??듦퀎/dedupe 遺덇?. `_aioRegisterTimer('chartReady', ...)` 留덉씠洹몃젅?댁뀡. violated_rule: R9(??대㉧ 愿由? |
| **P184** | **v49.1** | **2026-05-09** | **?꾩뿭 蹂??11媛?namespace 遺??*: `prevPage`(aio-core.js let), `_lastPageShownFire`, `_currentTickerSym`, `_aioPopstateRegistered`, `_scrSortCol`, `_scrSortAsc` ?깆씠 window 吏곸젒 李몄“ ?곗옱 ??吏꾨떒/?붾쾭洹?遺덇?, ?ㅻⅨ ?ㅽ겕由쏀듃? 異⑸룎 ?꾪뿕. `window.AIO.state` 珥덇린??釉붾줉 + `prevPage` `Object.defineProperty` shim + `_aioGlobalRegistry` ?깅줉. violated_rule: R9(?꾩뿭 ?곹깭) |
| **P183** | **v49.0** | **2026-05-09** | **_renderFundValuation Infinity ?뚮뜑 踰꾧렇**: `(mt.peRatioTTM \|\| ma.peRatio \|\| 0).toFixed(1)` ?⑦꽩 ??FMP API媛 EPS?? 醫낅ぉ??P/E쨌PEG瑜?`Infinity`濡?諛섑솚 ??`.toFixed()` = "Infinity" ???붾㈃??"Infinityx" ?쒖떆. `_aioFiniteNum(_fn)` + `_fv/_fv3` ?ы띁濡??泥? 紐⑤뱺 `\|\| 0` ?⑦꽩 ?쒓굅. `_renderFundFinancials` P/E쨌ROE쨌EV/EBITDA쨌P/B쨌D/E???숈씪 媛???곸슜. violated_rule: R32(?섏튂 諛⑹뼱 肄붾뵫) |
| **P182** | **v49.0** | **2026-05-09** | **scoreItem쨌_tickerRegexCache 臾댄븳 ?깆옣**: `scoreItem` 寃곌낵 罹먯떆(plain Object)? `_tickerRegexCache`(plain Object)???곹븳 ?놁쓬 ???댁뒪 ?쇰뱶 諛섎났 ?몄텧 ????ぉ 臾댄븳 ?꾩쟻, 硫붾え由??꾩닔. `_aioLRU('scoreItem', 200)` + `_aioLRU('tickerRegex', 600)`?쇰줈 援먯껜, `AIO.diag.scoreCache()` 吏꾨떒 API ?깅줉. violated_rule: R9(硫붾え由?愿由? |
| **P181** | **v49.0** | **2026-05-09** | **applyDataSnapshot ?⑥씪 try-catch ?꾩껜 李⑤떒**: 100+ `[data-snap]` ?붿냼瑜??⑥씪 try-catch濡?媛먯떥 ??1媛????ㅽ뙣 ???댄븯 紐⑤뱺 snap 媛깆떊 以묐떒, silent fail 遺덈챸?? ?ㅻ퀎 ?낅┰ try-catch + `_snapApplied/_snapFailed` 移댁슫??+ `_aioLog('warn','snap')` 濡쒓퉭?쇰줈 遺꾪빐. violated_rule: R32(?ㅻ쪟 寃⑸━) |
| **P180** | **v48.99** | **2026-05-09** | **index.html 22嫄?addEventListener 遺꾩궛**: portfolio(4嫄? 쨌 tech/macro(3嫄? 쨌 kr(2嫄? 쨌 signal(2嫄? 쨌 fxbond(1嫄? 쨌 fundamental(3嫄? 쨌 themes(2嫄? 쨌 options(2嫄? 쨌 gmo(1嫄? 쨌 ai-panel(1嫄? 쨌 home(1嫄? 紐⑤몢 媛쒕퀎 `document.addEventListener` ???섏씠吏 ?댄깉 ???댁젣 遺덇?. `_aioPageBus.register` 留덉씠洹??꾨즺. violated_rule: R9(?대깽??愿由? |
| **P179** | **v48.99** | **2026-05-09** | **aio-data.js 4嫄?addEventListener 遺꾩궛**: `data-home-live/shown` 쨌 `data-sentiment-fg-shown` 쨌 `data-sentiment-crypto-shown` ??`_aioPageBus.register` 留덉씠洹??꾨즺. violated_rule: R9(?대깽??愿由? |
| **P178** | **v48.99** | **2026-05-09** | **aio-core.js 9嫄?addEventListener 遺꾩궛**: `core-breadth`(liveQuotes) 쨌 `core-signal-live/shown` 쨌 `core-options-live/shown` 쨌 `core-sentiment-live/shown` 쨌 `core-freshness`(liveQuotes) 쨌 `core-guide-shown` ??`_aioPageBus.register` 留덉씠洹??꾨즺. violated_rule: R9(?대깽??愿由? |
| **P177** | **v48.98** | **2026-05-09** | **Infinity/NaN/遺꾨え 0 鍮꾧???*: aio-core.js 諛?aio-chat.js ?꾨컲?먯꽌 Fund P/E쨌P/B쨌PEG쨌EV/EBITDA쨌D/E 怨꾩궛 ??遺꾨え媛 0????`Infinity` ?뚮뜑, VaR 遺꾩쐞?샕톁harpe 怨꾩궛 ??NaN 鍮꾧?利??꾪뿕. `_aioFiniteNum(v, fb)` + `_aioSafeDiv(num, den, fb)` ?듯빀 媛??異붽? (aio-core.js). C3(v49.0) PR?먯꽌 Fund ?뚮뜑?ъ뿉 ?곸슜 ?덉젙. violated_rule: R32(?섏튂 諛⑹뼱 肄붾뵫) |
| **P176** | **v48.98** | **2026-05-09** | **珥덇린???⑥닔 以묐났 ?몄텧 + ?꾩뿭 蹂??namespace ?곗옱**: ?숈씪 ?ㅼ젙/?깅줉 ?⑥닔媛 ?щ윭 寃쎈줈?먯꽌 諛섎났 ?몄텧???꾪뿕 + `prevPage`, `_lastPageShownFire`, `_currentTickerSym`, `sentPageCharts` ??11媛??꾩뿭 蹂?섍? window 吏곸젒 李몄“ 遺꾩궛. `_aioOnce(name, fn)` 硫깅벑 珥덇린??媛??+ `_aioGlobalRegistry` ?댁쟾 Map 異붽?. D1(v49.1) PR?먯꽌 AIO.state.* ?댁쟾 ?덉젙. violated_rule: R9(?꾩뿭 ?곹깭 愿由? |
| **P175** | **v48.98** | **2026-05-09** | **?대깽??listener ?꾩쟻 ?꾪뿕**: `aio:pageShown` 17嫄?쨌 `aio:liveQuotes` 18嫄댁씠 媛쒕퀎 `document.addEventListener`濡?遺꾩궛 ?깅줉 ???섏씠吏 ?댄깉 ???댁젣 遺덇?, SPA ?먯깋 諛섎났 ??listener 以묐났 ?꾩쟻 媛?? `_aioPageBus` ?⑥씪 ?쇱슦???덈툕 異붽?: `register(pageId, eventName, fn)` ?깅줉 / `unregister(pageId)` ?꾩껜 ?댁젣 / `dispatch(eventName, detail)` 諛쒖궗. B1~B3(v48.99) PR?먯꽌 ?ㅼ젣 留덉씠洹??덉젙. violated_rule: R9(?대깽??愿由? |
| **P174** | **v48.97** | **2026-05-08** | **API ??UI 留덉뒪??誘멸뎄??*: `safeLSGetSync(key)`濡?媛?몄삩 API ??媛믪씠 ?ㅼ젙 UI???됰Ц ?쒖떆 媛?? ?먰븳 5媛?localStorage ??`aio_*_key`)??????듭씪 get/set ?명꽣?섏씠???놁쓬 ??媛??몄텧泥섎쭏???뷀샇??泥섎━ ?щ? 遺덇퇏?? `_aioMaskKey(raw)` ??`****-last4`, `getApiKey/setApiKey` ?섑띁 異붽?. violated_rule: R34(PII 蹂댄샇) |
| **P173** | **v48.97** | **2026-05-08** | **IndexedDB ?댁뒪 PII ?됰Ц ???*: `_idbSaveNews`?먯꽌 ?댁뒪 湲곗궗 ?먮Ц??洹몃?濡??????湲곗궗 ???대찓???꾪솕踰덊샇媛 釉뚮씪?곗? IndexedDB???됰Ц 湲곕줉. 媛쒕컻?먮룄援?룸갚?끒룻솗?μ뿉???묎렐 媛?? `_aioRedactPII(record)` ?곸슜 ??title/description/content/summary ???대찓?셋룹쟾??`[email]`/`[phone]`?쇰줈 移섑솚 ????? violated_rule: R34(PII 蹂댄샇) |
| **P172** | **v48.97** | **2026-05-08** | **API ?ъ떆??吏?섎갚?ㅽ봽 誘멸뎄??*: ?쇱떆??502/503 ?ㅻ쪟 ??利됱떆 null 諛섑솚, jitter ?놁쓬 ???숈떆 ?ㅼ쨷 ?ъ슜???섍꼍?먯꽌 ?ъ떆????뭾(thundering herd) 諛쒖깮 媛?? `_aioRetry(fn, {maxAttempts:3, baseMs:500, jitter:true, capMs:8000})` 異붽? + `AIO.diag.retryStats()` ?듦퀎 API. violated_rule: R20(遺遺??ㅽ뙣 蹂듭썝) |
| **P171** | **v48.97** | **2026-05-08** | **CORS ?꾨줉???⑥씪 ?ㅽ뙣 ???대갚 ?놁쓬**: corsproxy.io ???⑥씪 ?꾨줉???ъ슜 ???대떦 ?꾨줉???μ븷 ??silent null 諛섑솚, 2珥????덈궡 ?놁쓬. `_aioProxyChain.try(proxies, path)` 諛곗뿴 ?쒖감 ?대갚 + Circuit Breaker(3???ㅽ뙣 ??60s cooldown) 異붽?. `AIO.diag.proxyHealth()` CB ?곹깭 議고쉶. violated_rule: R20(遺遺??ㅽ뙣 蹂듭썝) |
| **P170** | **v48.96** | **2026-05-08** | **?ы듃?대━???뚯씠釉?`<th id>`/`<td headers>` 誘몄뿰寃?*: ?ы듃?대━???ъ????뚯씠釉?9媛?`<th>` ?붿냼??id ?놁쓬, JS ?앹꽦 `<td>` ?됱뿉 headers ?띿꽦 ?놁쓬 ??WCAG 1.3.1(?뺣낫쨌愿怨? ?꾨컲, ?ㅽ겕由곕━?붽? ???쒕ぉ 誘몃룆. `<th id="pf-th-*">` + `<td headers="pf-th-*">` 異붽?. violated_rule: WCAG 1.3.1(?뺣낫쨌愿怨? |
| **P169** | **v48.96** | **2026-05-08** | **Fund ???꾪솚 ??lightweight-charts width=0**: Fund 遺꾩꽍 ??쓣 鍮꾪솢???곹깭?먯꽌 ?뚮뜑留????꾪솚?섎㈃ `[id$="-lw-chart"]` 而⑦뀒?대꼫 clientWidth=0 ??李⑦듃 width=0 ?쒖떆. `_aioFundTabSwitch` 50ms ?쒕젅????`applyOptions({width: el.clientWidth})` ?곸슜?쇰줈 ?섏젙. violated_rule: R15(李⑦듃 ?뚮뜑 ?뺥솗?? |
| **P168** | **v48.96** | **2026-05-08** | **Canvas devicePixelRatio 誘몄쟻?⑹쑝濡??덊떚??釉붾윭**: `canvas.width/height`瑜?CSS ?ш린? ?숈씪 ?ㅼ젙 ???덊떚??HiDPI(dpr=2) ?붾㈃?먯꽌 canvas ?쎌? ?댁긽??遺議? ?띿뒪?맞룹꽑 釉붾윭. `_aioSetupCanvas(canvas, w, h)` ??dpr ?곸슜(canvas.width=w*dpr, ctx.scale(dpr)). violated_rule: R14(?쒓컖???덉쭏) |
| **P167** | **v48.96** | **2026-05-08** | **Chart.js ?몄뒪?댁뒪 destroy ?놁씠 諛섎났 ?ъ깮????硫붾え由??꾩닔**: `_renderFundVariance` ?깆씠 ?숈씪 canvas??`new Chart()` ?ы샇異????댁쟾 ?몄뒪?댁뒪 `.destroy()` 誘명샇異????몄뒪?댁뒪 ?꾩쟻, 硫붾え由?룹씠踰ㅽ듃由ъ뒪???꾩닔. `_aioChartRegistry.destroyIfExists(id)` ?좏뻾 ??`register(id, chart)` ?⑦꽩?쇰줈 ?섏젙. violated_rule: R9(硫붾え由??꾩닔 諛⑹?) |
| **P166** | **v48.95** | **2026-05-08** | **lastKrTradingDay EOD grace window 誘몄쿂由?*: ?쒓뎅 ?λ쭏媛?15:30) 吏곹썑~16:00 ?ъ씠?먮뒗 API 醫낃? ?곗씠?곌? 誘명솗???곹깭?꾩뿉??`lastKrTradingDay()`???ㅻ뒛 ?좎쭨瑜?諛섑솚, "?ㅻ뒛 醫낃?" ?쒖떆. `lastKrTradingDayEx()` 異붽? ??`{date, eodConfirmed}` 諛섑솚. 15:30~16:00 援ш컙 `eodConfirmed=false`. violated_rule: R15(誘명솗???곗씠???쒖떆 湲덉?) |
| **P165** | **v48.95** | **2026-05-08** | **scoreItem ?쒓뎅???④????ㅼ썙???ㅽ깘**: `_kwHit()`?먯꽌 `.includes('湲?)` ??"湲덈━" ?띿뒪?몄뿉??'湲? 留ㅼ묶?? 湲덈━/湲덉쑖/鍮꾧툑??愿???댁뒪媛 '湲?gold)' ?먯닔 遺?щ컺???ㅼ퐫???쒓끝. `_wordHit(text, kw)` ?좊땲肄붾뱶 ?⑥뼱寃쎄퀎 ?⑥닔 ?좉퇋 + RegExp 罹먯떆. violated_rule: R15(NLP ?ㅽ깘 諛⑹?) |
| **P164** | **v48.95** | **2026-05-08** | **_calcSharpe std===0 鍮꾧탳 ?ㅽ뙣**: `_statStdDev`媛 留ㅼ슦 ?묒? 媛?1e-15 ?섏?)??諛섑솚????`std===0` 鍮꾧탳 ?ㅽ뙣 ??`(mean/1e-15)*??52 = Infinity` 諛섑솚. `std < 1e-10 ??null` 議곌굔?쇰줈 ?섏젙. violated_rule: R15(NaN/Infinity ?쒖떆 湲덉?) |
| **P163** | **v48.95** | **2026-05-08** | **_pearsonCorr 遺꾨え near-zero NaN**: `denA`(誇(a_i-mean)짼) ?먮뒗 `denB`媛 ?곸닔 諛곗뿴?먯꽌 遺?숈냼?섏젏 ?ㅼ감濡?~1e-30 ?섏???????`=== 0` 鍮꾧탳 ?ㅽ뙣 ??`Math.sqrt(denA*denB)` = 洹뱀냼媛???`num/洹뱀냼媛?= Infinity` ?먮뒗 NaN. `< 1e-12` EPS 鍮꾧탳濡??섏젙. violated_rule: R15(NaN 諛⑹?) |
| **P162** | **v48.95** | **2026-05-08** | **_calcPortfolioVaR nearest-neighbor ?뺥솗??*: `Math.floor((1-conf)*n)` 諛⑹떇? 寃쎄퀎 ?몃뜳?ㅼ뿉???몄젒 遺꾩쐞??蹂닿컙 ?놁씠 ?섏쐞 ?④퀎瑜?諛섑솚. n=100, conf=0.99 ??湲곕? VaR=0.01?댁?留?`Math.floor(0.01*100)=1` ??sorted[1] 諛섑솚. R-7 ?좏삎蹂닿컙(`_quantileR7`)?쇰줈 援먯껜. violated_rule: R10(?섏튂 ?뺥솗?? |
| **P161** | **v48.94** | **2026-05-08** | **applyTechIndicators NaN 誘몄쿂由???吏???꾩껜 ?뚮뜑 以묐떒**: RSI/MACD/Stoch/ADX媛 媛곸옄 `if (data.xxx?.values?.[0])` 媛?쒕? ?듦낵?대룄 `parseFloat()`媛 NaN??諛섑솚?섎㈃ `.toFixed()` ?몄텧 ??TypeError 諛쒖깮 ???몃? try/catch媛 ?꾩껜 ?⑥닔瑜?以묐떒?쒖폒 ?댄썑 吏??誘몃젋?? `_aioRenderNum(v,'',decimals)` NaN 媛?쒕줈 ?섏젙. violated_rule: R15(NaN ?쒖떆 湲덉?) |
| **P160** | **v48.94** | **2026-05-08** | **chatSend fundamental ?ш? ?곹븳 誘멸뎄??*: `fundamentalSearch()` ??`chatSend('fundamental')` ??AI媛 chip???듯빐 ?먮뒗 ?먮룞?쇰줈 `fundamentalSearch()`瑜??ш? ?몄텧?????덈뒗 寃쎈줈 議댁옱. `state._fundDepth` 移댁슫?곕줈 ?곹븳 2 援ы쁽, 珥덇낵 ??寃쎄퀬 硫붿떆吏 ?쒖떆 ??return. violated_rule: R10(臾댄븳 猷⑦봽 諛⑹?) |
| **P159** | **v48.94** | **2026-05-08** | **fetchNaverUSData Promise.all ???⑥씪 ?ㅽ뙣 ???꾩껜 ?곗씠???먯떎**: basic/integration/finance 3媛??붿껌 以?1媛쒓? reject?섎㈃ `Promise.all` ?꾩껜 reject ??catch濡?`return null` ???섎㉧吏 2媛??묐떟??踰꾨┝. 媛?Promise??`.catch(() => null)` ?덉뿀?쇰굹 Promise.all ?섏??먯꽌 異붽? ?ㅽ뙣 寃쎈줈 議댁옱. `Promise.allSettled` + 媛쒕퀎 `.status === 'fulfilled'` 異붿텧濡??섏젙. violated_rule: R20(遺遺??ㅽ뙣 蹂댁〈) |
| **P158** | **v48.94** | **2026-05-08** | **AI chat renderMarkdownLight DOMPurify 2李??꾨씫**: `chatSend` onChunk/onDone?먯꽌 `aiBubble.innerHTML = renderMarkdownLight(visible)` ?⑦꽩 ?ъ슜 ??`renderMarkdownLight()`??留덊겕?ㅼ슫??HTML濡?蹂?섑븯??DOMPurify sanitize ?놁쓬. Anthropic API ?묐떟??`<img onerror=...>` ??XSS payload ?ы븿 ???ㅽ뻾 媛?? `_aioSafeMD()`濡?援먯껜(renderMarkdownLight + DOMPurify 2李?. 4怨?onChunk쨌onDone쨌retry쨌error) ?꾨? ?섏젙. violated_rule: R34(XSS 諛⑹?) |
| **P157** | **v48.91** | **2026-05-08** | **SEC EDGAR API ?묐떟 escHtml ?꾨씫 XSS**: `_renderFundSEC()` ??CIK쨌sicDescription쨌exchanges 諛?怨듭떆 form/date/primaryDocDescription??escHtml ?놁씠 innerHTML ?쎌엯. SEC EDGAR ?묐떟???ㅼ뿼?섍굅???낆쓽???곗씠?곕? ?ы븿 ??XSS ?ㅽ뻾 媛?? 4媛??꾨뱶 紐⑤몢 `escHtml()` ?섑븨?쇰줈 ?섏젙. violated_rule: R34(XSS 諛⑹?) |
| **P156** | **v48.91** | **2026-05-08** | **_renderFundHeader FMP 湲곗뾽 ?ㅻ챸 escHtml ?꾨씫 XSS**: `p.description`(FMP API ?묐떟)??300???щ씪?댁뒪 ??escHtml ?놁씠 innerHTML ?쎌엯. `escHtml(desc)` ?곸슜?쇰줈 ?섏젙. violated_rule: R34(XSS 諛⑹?) |
| **P155** | **v48.91** | **2026-05-08** | **_searchCitationsHTML ?밴???URL/?꾨찓??escHtml ?꾨씫 XSS**: `sr.citations[i]`(Perplexity/Google 寃??API ?묐떟 URL)??href ?띿꽦??吏곸젒, `domain`(URL ?뚯떛媛????띿뒪?몄뿉 吏곸젒 ?쎌엯. ?낆쓽??URL(`javascript:alert(1)`) ?먮뒗 XSS payload媛 ?ы븿???꾨찓?몃챸 二쇱엯 媛?? `escHtml(url)`쨌`escHtml(domain)` ?곸슜?쇰줈 ?섏젙. violated_rule: R34(XSS 諛⑹?) |
| **P144** | **v48.77 audit** | **2026-05-05** | **?ы듃?대━??踰ㅼ튂留덊겕 ?쇰? fetch ?ㅽ뙣媛 0%/怨쇱냼 ?쒖떆濡??꾨씫**: top 10 ticker瑜?癒쇱? covered濡?媛꾩＜??fetch ?ㅽ뙣 醫낅ぉ??covered/uncovered ?대뵒?먮룄 ?ы븿?섏? ?딆쓬. ?깃났??ticker留?`coveredSymSet`???ｊ퀬, ?ㅽ뙣 醫낅ぉ? uncovered ?좏삎 蹂댁젙???ы븿?섎룄濡??섏젙 |

---

## [2026-05-05] v48.77 audit ???ы듃?대━??踰ㅼ튂留덊겕 而ㅻ쾭由ъ? P144

### BUG-P144: top ticker chart fetch ?ㅽ뙣 ???ы듃?대━???섏씡瑜??꾨씫 (HIGH)
- **violated_rule**: R15 (?곗씠??誘몄닔??vs 0% 援щ텇)
- **利앹긽**: ?ы듃?대━??踰ㅼ튂留덊겕 李⑦듃?먯꽌 ?곸쐞 蹂댁쑀 醫낅ぉ??Yahoo chart 議고쉶媛 ?ㅽ뙣?섎㈃ ?대떦 醫낅ぉ???ㅻ뜲?댄꽣 而ㅻ쾭由ъ??먮룄, 誘몄빱踰?蹂댁젙?먮룄 ?ы븿?섏? ?딆븯?? 蹂댁쑀 醫낅ぉ??10媛??댄븯?닿퀬 ?꾨? fetch ?ㅽ뙣?섎㈃ ?ㅼ젣 ?꾩옱 ?섏씡瑜?????됲룊??0% ?좎씠 洹몃젮吏????덈떎.
- **洹쇰낯 ?먯씤**: `updateBenchmarkChart()`媛 `topTickers`瑜?癒쇱? `topSymSet`???ｊ퀬, `tickerSeries` ?깃났 ?щ?? 臾닿??섍쾶 誘몄빱踰?怨꾩궛?먯꽌 ?쒖쇅?덈떎. 利?"議고쉶 ?쒕룄 ???怨?"?ㅼ젣 議고쉶 ?깃났 ?????媛숈? ?곹깭濡?痍④툒?덈떎.
- **?섏젙**: `index.html` `updateBenchmarkChart()`
  - `topSymSet` ?쒓굅
  - `tickerSeries` ?깃났 寃곌낵濡쒕쭔 `coveredSymSet` ?앹꽦
  - 誘몄빱踰?怨꾩궛? `coveredSymSet`???녿뒗 紐⑤뱺 ?ъ??섏쓣 ?ы븿
  - `totalCurrentValue <= 0` 諛⑹뼱 異붽?
- **?덈갑**: 蹂묐젹 fetch 寃곌낵瑜??ы듃?대━??鍮꾩쨷 怨꾩궛???ъ슜???뚮뒗 "requested"? "resolved" set??遺꾨━?쒕떎. ?ㅽ뙣????ぉ? 紐낆떆?곸쑝濡?fallback/uncorrected bucket???ㅼ뼱媛???섎ŉ, 0%濡??붾У 泥섎━ 湲덉?.

---

## [2026-04-28] v48.69 ???꾩닔 蹂댁븞쨌?깅뒫쨌?곗씠??蹂닿컯 P140~P143

### BUG-P140: CDN SRI ?꾨씫 ??supply chain attack ?꾪뿕 (HIGH)
- **violated_rule**: ?좉퇋 ??R52 (CDN SRI ?섎Т, 援?R34 ??2026-05-09 ?щ쾲??
- **利앹긽**: chart.js/dompurify/lightweight-charts CDN?먯꽌 ?낆쓽?곸쑝濡??섏젙???뚯씪??濡쒕뱶?섏뼱??釉뚮씪?곗?媛 媛먯??섏? 紐삵븿. ?ㅽ듃?뚰겕 以묎컙???먮뒗 CDN ?ㅼ뿼 諛쒖깮 ???ъ슜???몄뀡?먯꽌 ?꾩쓽 JS ?ㅽ뻾 媛??
- **洹쇰낯 ?먯씤**: index.html CDN `<script>` 3媛쒖뿉 `integrity`/`crossorigin` ?띿꽦???놁쓬. SRI??釉뚮씪?곗?媛 ?ㅼ슫濡쒕뱶??由ъ냼?ㅼ쓽 ?댁떆瑜?寃利앺븯??蹂議곕? 留됰뒗 W3C ?쒖??몃뜲 ?곸슜?섏? ?딆? ?곹깭.
- **?섏젙**: `index.html` CDN 3媛쒖뿉 sha384 ?댁떆 異붽?
  ```html
  integrity="sha384-..." crossorigin="anonymous"
  ```
  chart.js@4.4.0 / dompurify@3.0.9 / lightweight-charts@4.2.0 媛곴컖 ?곸슜.
- **?덈갑**: P140/R52 ???몃? CDN `<script>` 異붽? ??integrity + crossorigin ?띿꽦 ?꾩닔. ?댁떆 ?앹꽦: `curl -sL <URL> | openssl dgst -sha384 -binary | openssl base64 -A`

### BUG-P141: setInterval ID 誘몄????щ컻 (aio-core.js:494/1078) ??R9 4李?媛뺥솕 (MEDIUM)
- **violated_rule**: R9 (setInterval 諛섑솚媛??꾩뿭 ????꾩닔)
- **利앹긽**: ??理쒖큹 濡쒕뱶 ??DOMContentLoaded?먯꽌 ?깅줉????setInterval??ID ?놁씠 ?ㅽ뻾?? ???섏씠吏瑜?諛섎났 ?꾪솚?섍굅??app ?ъ큹湲고솕 ??????대㉧媛 異붽? ?깅줉?섏뼱 15遺??ㅻ깄???좎쭨), 30珥??좎꽑?? 二쇨린濡?以묐났 ?ㅽ뻾 ?꾩쟻.
- **洹쇰낯 ?먯씤**: `aio-core.js:494` `setInterval(window._aioRenderSnapshotDates, 15*60*1000)` ? `:1078` `setInterval(_aioUpdateFreshness, 30*1000)` 紐⑤몢 諛섑솚媛믪쓣 ?대뵒?먮룄 ??ν븯吏 ?딆쓬. R9??v44.6 P63?먯꽌 紐낆떆?곸쑝濡??좎뼵??洹쒖튃?몃뜲 ?щ컻.
- **?섏젙**: `js/aio-core.js`
  - `:494` ??`if (window._aioSnapshotDatesTimer) clearInterval(window._aioSnapshotDatesTimer);` + `window._aioSnapshotDatesTimer = setInterval(...)`
  - `:1078` ??`if (window._aioFreshnessTimer) clearInterval(window._aioFreshnessTimer);` + `window._aioFreshnessTimer = setInterval(...)`
- **?덈갑**: P141/R9 4李?媛뺥솕 ??`setInterval(` 異붽? ??利됱떆 諛섑솚媛믪쓣 `window._xxxTimer` 蹂?섏뿉 ??? ?щ벑濡?吏곸쟾 `clearInterval` ?좏뻾 ?꾩닔.

### BUG-P142: R15 ?꾨컲 5嫄??щ컻 (aio-data.js extPct/F&G) ??R15 5李?媛뺥솕 (HIGH)
- **violated_rule**: R15 (?곗씠??誘몄닔??vs 吏꾩쭨 0% 援щ텇)
- **利앹긽**: (1) ?꾨━留덉폆/?좏봽?곕쭏耳??쒓컙? extPct 誘몄닔?????쒖꽭 移대뱶??"0.00%" ?쒖떆 ???ㅼ젣???곗씠???놁쓬. (2) Fear & Greed 誘몄닔????"0 洹밸떒怨듯룷" ?ㅽ몴?????ㅼ젣??吏???놁쓬.
- **洹쇰낯 ?먯씤**: `aio-data.js:8829, 8831` extPct ?????`q.extPct || 0`, `:9616` _extHoursData 鍮뚮뱶 ??`|| 0`, `:9692` ?쒖떆 ??`|| 0`, `:9940` F&G 泥섎━ ??`snap.fg || 0` ??紐⑤몢 R15 湲덉? ?⑦꽩. null/undefined媛 0?쇰줈 媛뺤젣 蹂?섎릺???섎?媛 ?쒓끝??
- **?섏젙**: `js/aio-data.js`
  - 5怨?紐⑤몢 `!= null ? val : null` ?⑦꽩?쇰줈 援먯껜
  - F&G: `fgVal = snap.fg != null ? snap.fg : null` ??null?대㈃ ?쇰꺼 "??, ?됱긽 `var(--text-muted)`
- **?덈갑**: P142/R15 5李?媛뺥솕 ??`||0`/`|| '??` ?⑦꽩? pct쨌score쨌price ?꾨뱶???덈? ?ъ슜 湲덉?. /qa ??`grep '|| 0' js/aio-data.js | grep -i 'pct\|fg\|score\|price'` ??0嫄??뺤씤 ?꾩닔.

### BUG-P143: _lastFetch ??遺덉씪移????ы듃?대━???좎꽑????긽 "?湲?以? (MEDIUM)
- **violated_rule**: R33 (AIO_Cache쨌_lastFetch ???쇨???
- **利앹긽**: ?ы듃?대━???섏씠吏 ?섎떒 ?좎꽑???ㅽ듃由쎌씠 ?ㅼ떆媛??쒖꽭(liveQuotes) ?섏떊 ?깃났 ?꾩뿉??"?湲?以? ?곴뎄 ?쒖떆. 留덉?留?媛깆떊 ?쒓컙???꾪? ?낅뜲?댄듃?섏? ?딆쓬.
- **洹쇰낯 ?먯씤**: `_aioUpdateFreshness()`(aio-core.js:1058)媛 `window._lastFetch.liveQuotes`瑜?議고쉶?섎뒗??`_markFetch()`媛 ?쒖꽭 ?깃났 ??`'quote'` ?ㅻ줈 ??ν븿. ?ㅺ? ?ㅻⅤ誘濡?議고쉶 寃곌낵媛 ??긽 undefined ??議곌굔 false ??"?湲?以? ?곴뎄 ?쒖떆. ?ㅺ퀎 珥덇린 ???대쫫??蹂寃쎈릺?덉쑝???뚮퉬 痢≪씠 ?낅뜲?댄듃?섏? ?딆? 寃껋쑝濡?異붿젙.
- **?섏젙**: `js/aio-core.js:1058`
  ```javascript
  var lastFetch = (window._lastFetch && (window._lastFetch.quote || window._lastFetch.liveQuotes))
    ? (window._lastFetch.quote || window._lastFetch.liveQuotes) : null;
  ```
  ?묒そ ?ㅻ? OR濡?議고쉶?섏뿬 ?대쫫 遺덉씪移?諛⑹뼱.
- **?덈갑**: P143 ??`_markFetch(key)` ?몄텧 ??key ?대쫫怨??뚮퉬 痢?議고쉶 ?ㅻ? ?묐갑??grep 寃利??꾩닔. `grep -n "_lastFetch\." js/aio-core.js` 寃곌낵濡????議고쉶 ???移??뺤씤.

---

## [2026-04-27] v48.68 ???ㅽ겕濡?scroll-chaining 踰꾧렇 P139

### BUG-P139: ?뚮쭏/?몃젋???섏씠吏 ?ㅽ겕濡?遺덇? ??scroll-chaining ???섏씠吏 (HIGH)
- **violated_rule**: ?좉퇋 P139 (SPA scroll-chaining 臾대갑??
- **利앹긽**: ?뚮쭏쨌?몃젋?????щ윭 ?섏씠吏?먯꽌 留덉슦?????곗튂 ?ㅽ겕濡ㅼ씠 ?숈옉?섏? ?딆쓬. ?뱁엳 ?섏씠吏 理쒖긽??scrollTop=0)?먯꽌 ?꾨줈 ?ㅽ겕濡????꾪? 諛섏쓳 ?놁쓬. iOS?먯꽌 紐⑤찘? ?ㅽ겕濡?誘몄???
- **洹쇰낯 ?먯씤**: `body(overflow:hidden)??app(overflow:hidden)??main(overflow:hidden)??content(overflow-y:auto)` ?덉씠??援ъ“?먯꽌 `.content`媛 scrollTop=0???곹깭濡??꾨줈 ?ㅽ겕濡ㅽ븯嫄곕굹 scrollBottom?먯꽌 ?꾨옒濡??ㅽ겕濡??? 釉뚮씪?곗?媛 ?⑥? ?명?瑜?遺紐?泥댁씤?쇰줈 ?꾪뙆(scroll-chaining). 遺紐??붿냼?ㅼ씠 紐⑤몢 `overflow:hidden`?대씪 ?ㅼ젣 ?ㅽ겕濡ㅼ? 遺덇??섎굹 ?대깽?몃뒗 ?뚮퉬?????ъ슜?먮뒗 ?꾨Т 諛섏쓳???녿떎怨?泥닿컧. P74(v46.4)?먯꽌 `.page overflow-x:hidden` ?쒓굅濡??댁쟾 ?ㅽ겕濡?踰꾧렇???닿껐?덉쑝?? `.content` ?먯껜??overscroll ?꾪뙆 誘몄감?⑥? ?붿〈.
- **?섏젙**: `index.html` `.content` CSS?????띿꽦 異붽?:
  ```css
  overscroll-behavior-y: contain; /* scrollTop=0/max 寃쎄퀎?먯꽌 遺紐⑤줈 ?꾪뙆 李⑤떒 */
  -webkit-overflow-scrolling: touch; /* iOS 紐⑤찘? ?ㅽ겕濡?蹂댁옣 */
  ```
- **?좎궗 ?⑦꽩 ?먭? 寃곌낵**: `#risk-radar-body { overflow-y:auto; max-height:360px }` ??fundamental ?섏씠吏 ???낅┰ ?ㅽ겕濡?而⑦뀒?대꼫(?섎룄??. `.market-pulse-bar { overflow-x:auto }` ??CSS 紐낆꽭??overflow-y ?붾У auto 蹂?섏씠???섏쭅 ?ㅻ쾭?뚮줈 ?놁뼱 ?곹뼢 ?놁쓬. `.content` ?⑥씪 ?섏젙?쇰줈 ???섏씠吏 ?닿껐??
- **?덈갑**: P139 ??SPA?먯꽌 `overflow:hidden` 以묒꺽 ?덉씠?대줈 ?ㅽ겕濡ㅼ쓣 ?쒖뼱???? ?ㅼ젣 ?ㅽ겕濡?而⑦뀒?대꼫(`.content` ???먮뒗 諛섎뱶??`overscroll-behavior-y:contain` 異붽??섏뿬 scroll-chaining ?먯쿇 李⑤떒. ?좉퇋 ?섏씠吏/而⑦뀒?대꼫 異붽? ???ㅽ겕濡??덉씠??援ъ“ 寃???꾩닔.

---

## [2026-04-18] v48.14 ??Agent ?꾩닔 ?꾪궎?띿쿂 媛먯궗 Critical 6嫄?+ P2 Warning 13嫄?

**?몄뀡 而⑦뀓?ㅽ듃**: Agent 3???ъ링 媛먯궗 (?뚮쭏 ?꾩닔 쨌 ?ㅽ겕由щ꼫 ?꾩껜 ?띿뒪??쨌 ?꾪궎?띿쿂 ?붽? ?섏?)
Agent 醫낇빀 ?먯닔: **8.2/10 ??9.3/10** 吏꾩엯 (?곸쐞 1% ?⑥씪 HTML 湲덉쑖 ?곕???

### BUG-P126: KOSPI/VVIX DOM ?대갚媛믨낵 DATA_SNAPSHOT 遺덉씪移?(CRITICAL)
- **violated_rule**: R15 (stale data 諛⑹뼱 泥닿퀎 ?꾨컲)
- **利앹긽**: page-kr-home DOM??KOSPI `5,872.00` ?쒓린?섎굹 DATA_SNAPSHOT.kospi=`6091.39`. VVIX??DOM `126.28` vs DATA_SNAPSHOT=`90.10` (-40% 李⑥씠). applyDataSnapshot???쇰? DOM留?媛깆떊?섎뒗 "sync gap" 踰꾧렇.
- **洹쇰낯 ?먯씤**: `applyDataSnapshot()` map 媛앹껜??kospi/vvix/skew 留ㅽ븨??**?섎룄?곸쑝濡??꾨씫** ?먮뒗 **data-snap ?띿꽦 ?먯껜 ?꾨씫**. `data-live-price`媛 ?덉뼱???ㅼ떆媛??섏떊 ?꾧퉴吏???뺤쟻 ?대갚媛??몄텧.
- **?섏젙**:
  - [index.html:10344~10404](index.html:10344) map ?뺤옣: vvix/skew/vix/pcr/tnx/tyx/irx/fvx/dxy/spx/nasdaq/dow/rut/gold/silver/btc/eth/kr-ppi/kr-pmi/kr-export ??**41媛?異붽?** (41??9)
  - [index.html:7100](index.html:7100) KOSPI DOM: `5,872.00` ??`6,091.39` + `data-live-price="^KS11"` 異붽?
  - [index.html:6387](index.html:6387) VVIX DOM: `126.28` ??`90.10` + `data-snap="vvix"` 異붽?
  - [index.html:2780](index.html:2780) SKEW DOM: `data-snap="skew"` ?좉퇋 諛붿씤??
- **?덈갑**: **P126** ??`data-snap` ?띿꽦 異붽? ??`applyDataSnapshot()` map 媛앹껜???숈씪 ??議댁옱 ?뺤씤. DATA_SNAPSHOT 媛깆떊 ??DOM ?대갚媛믩룄 ?숆린??(6怨??댁긽 泥댄겕: index.html + FALLBACK_QUOTES + map). 諛고룷 ??`grep 'data-snap="\([a-z-]*\)"' | cut` 留ㅽ븨 而ㅻ쾭由ъ? ?먮룞 ?뺤씤.

### BUG-P127: aio:pageShown ?대깽??以묐났 dispatch (HIGH)
- **violated_rule**: ?좉퇋 P127
- **利앹긽**: showPage() + popstate ?몃뱾???묒そ?먯꽌 `document.dispatchEvent('aio:pageShown')` ?낅┰ ?몄텧. 26媛?由ъ뒪?덇? 2???ㅽ뻾???꾪뿕. `_updatePerfTable` 媛숈? ?ㅽ듃?뚰겕 ?몃뱾?щ뒗 2諛?API ?몄텧.
- **洹쇰낯 ?먯씤**: ??寃쎈줈媛 ?숈씪 ?섏씠吏 ?꾪솚 ?대깽?몃? ?낅┰?곸쑝濡?諛쒖궗. dedup guard ?놁쓬.
- **?섏젙**: [index.html:10753~](index.html:10753) `_firePageShown(id, source)` dedup helper ?좎꽕 ??200ms ???숈씪 id 諛쒖궗 ????踰덉㎏ 臾댁떆. showPage/popstate ??????helper 寃쎌쑀.
- **?덈갑**: **P127** ??`dispatchEvent` ?몄텧??2怨??댁긽 ?덉쑝硫?諛섎뱶??dedup guard 異붽?. `detail` 媛앹껜??`source` ?꾨뱶濡??몄텧 寃쎈줈 援щ텇.

### BUG-P128: native prompt() R6 ?꾨컲 3怨?(HIGH)
- **violated_rule**: R6 (native modal 湲덉?)
- **利앹긽**: `createWatchlist`/`renameWatchlist`/?뚯튂由ъ뒪???좏깮 3怨녹뿉??native `prompt()` ?ъ슜 ??釉뚮씪?곗? 紐⑤떖 鍮꾩씪愿쨌a11y ?쏀븿쨌XSS 寃쎌쑀 媛??
- **洹쇰낯 ?먯씤**: v46.10?먯꽌 API ??PIN? `showConfirmModal`濡??댁쟾?먯쑝???뚯튂由ъ뒪??CRUD 3怨?誘몄씠??
- **?섏젙**: [index.html:23929~](index.html:23929) `showPromptModal(title, label, defaultValue, onSubmit, opts)` ?좎꽕 (ESC쨌Enter쨌?대┃ ?멸낸 ?リ린쨌?ъ빱?ㅒ톋11y). 3怨??꾩썝 援먯껜 ??native `prompt()` **0嫄?*.
- **?덈갑**: **P128** ????modal ?⑦꽩 ?꾩엯 ??湲곗〈 native `prompt/confirm/alert` ?몄텧 ?꾩닔 grep ???쇨큵 ?댁쟾. R6??"prompt() ?몄텧 ??grep?쇰줈 CI 泥댄겕" 異붽?.

### BUG-P129: AI 50KB truncation ??留덉?留?chunk 誘몃젋??(MEDIUM)
- **violated_rule**: ?좉퇋 P129
- **利앹긽**: Claude ?묐떟??50KB 珥덇낵 ??`reader.cancel()` ?몄텧?섎굹 truncated ?띿뒪?몄쓽 留덉?留?`onChunk` ?몄텧???꾨씫. UI??"?섎졇?듬땲?? 硫붿떆吏媛 ?쒖떆 ???섎뒗 寃쎌슦 諛쒖깮.
- **洹쇰낯 ?먯씤**: break 吏곸쟾??onChunk(fullText)媛 ?놁뼱 痍⑥냼???띿뒪?멸? DOM??諛섏쁺 ????
- **?섏젙**: [index.html:26926~](index.html:26926) 50KB 珥덇낵 ??`onChunk(fullText)` 媛뺤젣 ?몄텧 **??* `reader.cancel()` ?ㅽ뻾. `_aioLog('warn', 'ai', 'response truncated at 50KB')` 濡쒓퉭.
- **?덈갑**: **P129** ??stream 醫낅즺쨌痍⑥냼 ?꾩뿉 諛섎뱶??理쒖쥌 payload瑜?receiver???꾨떖. AbortController쨌reader.cancel ?몄텧 吏곸쟾 留덉?留??뚮뜑 call 紐낆떆.

### BUG-P130: ?꾨줉??flat 60s cooldown ??thundering herd ?꾪뿕 (MEDIUM)
- **violated_rule**: ?좉퇋 P130
- **利앹긽**: `_PROXY_REGISTRY.markFail` 5??fail ????긽 60珥?cooldown. ?ㅼ닔 ?꾨줉???숈떆 ?ㅽ뙣 ??60珥???紐⑤몢 ?숈떆 ?ъ떆????thundering herd.
- **洹쇰낯 ?먯씤**: backoff ?④퀎 怨좎젙 + jitter ?놁쓬. ?꾨줉?쒓? "?쇱떆???μ븷"? "?곴뎄???μ븷"瑜?援щ텇 紐???
- **?섏젙**: [index.html:12950~](index.html:12950) exponential backoff + jitter ?꾩엯:
  - `cooldownLevel` 異붿쟻 (0~5)
  - 60s ??120s ??240s ??480s ??960s ??1800s (30遺??곹븳, 32x)
  - 짹30% jitter ?쒕뜡 offset (herd 諛⑹?)
  - markOk?먯꽌 cooldownLevel 由ъ뀑
- **?덈갑**: **P130** ???쒕퉬??媛??먮룞 ?ъ떆??濡쒖쭅? 諛섎뱶??exponential backoff + jitter. Circuit breaker ?⑦꽩? ?꾨줉???댁긽??API?먮룄 ?곸슜 (FinnhubWS??蹂꾨룄 泥섎━).

### BUG-P131: FinnhubWS ?쒗궥 釉뚮젅?댁빱 遺????臾댄븳 ?ъ뿰寃?(LOW)
- **violated_rule**: ?좉퇋 P131 (P130 ?뺤옣 ?곸슜)
- **利앹긽**: Finnhub WS ?ъ뿰寃?濡쒖쭅???ㅽ뙣 ?잛닔留?count, ?곹븳 ?놁쓬. ?ㅽ듃?뚰겕 ?κ린 ?μ븷 ??臾댄븳 ?ъ떆??
- **洹쇰낯 ?먯씤**: `_finnhubReconnectAttempts` 利앷?留??덇퀬 ?덈? ?곹븳 ?놁쓬. 10?????щ줈??紐⑤뱶濡??꾪솚?섎굹 24?쒓컙 ?댁긽 怨꾩냽 ?쒕룄.
- **?섏젙**: [index.html:13091~](index.html:13091) `_finnhubCircuit` ?쒗궥 釉뚮젅?댁빱 異붽?:
  - 1?쒓컙 window ??20?? fail ??24?쒓컙 ?꾩쟾 disable
  - window 由ъ뀑 濡쒖쭅 + `disabledUntil` ??꾩뒪?ы봽
  - `_aioLog('error', 'finnhub', '?쒗궥 OPEN')` 寃쎄퀬 + UI 諛곗?
- **?덈갑**: **P131** ???먮룞 ?ъ떆??濡쒖쭅? **?덈? ?곹븳 ??대㉧** ?꾩닔. WebSocket ?ъ뿰寃곕퓧 ?꾨땲??紐⑤뱺 臾댄븳 猷⑦봽 ?뺥깭 API ?몄텧???곸슜.

---

## [2026-04-21] v48.61 ???洹쒕え 洹쇰낯 ?섏젙 (?ъ슜??"嫄곗쭞 ?묒뾽" 吏????

### PR-P138: Canvas CSS var 踰꾧렇 10嫄?(HIGH)
- **violated_rule**: R43 誘명빐寃??붿〈
- **利앹긽**: RRG ?뱁꽣 ?쇰꺼쨌?ы듃?대━??踰ㅼ튂留덊겕 李⑦듃 SPY/?ы듃?대━???쇱씤 ??10怨녹뿉??`ctx.fillStyle = 'var(--text-muted)'` ??Canvas 2D API媛 CSS var 誘명빐????transparent 泥섎━ ???뚮뜑 ????
- **?섏젙**: index.html 10嫄?紐⑤몢 hex 吏곸젒 紐낆떆 (`#7b8599` text-muted, `#00d4ff` cyan, `#00e5a0` green, `#ff5b50` red).
- **?덈갑**: **P138** ??Canvas 2D??CSS var 誘명빐?? ?뚮뜑???묒꽦 ??`getComputedStyle(html).getPropertyValue('--X').trim()` ?고????닿껐 ?먮뒗 hex 吏곸젒 紐낆떆. Hook Layer 4濡??먮룞 媛먯?.

### PR-P137: v48.60 Phase 25 `_aioRenderSignalRegime` 踰꾧렇 (CRITICAL ??P125 7踰덉㎏ ?щ컻)
- **violated_rule**: R39 (extractTickers ??UI ?섏뼱留? + R48 ?좉퇋
- **利앹긽**: ?쒖옣 援?㈃ 吏꾨떒 PCR 移대뱶 ?곴뎄 "?? ?쒖떆, AAII 移대뱶 43.0% ?뺤쟻 怨좎젙 (?ㅼ떆媛?`_aaiiBearish` 臾댁떆).
- **洹쇰낯 ?먯씤**:
  1. `window._pcRatio` 李몄“ ???대뵒?먮룄 ?ㅼ젙?섏? ?딆쓬. ?ㅼ젣 ?꾩뿭? `window._putCallRatio` (aio-data.js:10478 P88 援먯젙 ??.
  2. `snap.pcRatio` 李몄“ ??DATA_SNAPSHOT ?ㅻ뒗 `pcr`(short). 遺덉씪移?
  3. AAII??`snap.aaiiBear` ?뺤쟻 43.0 ?ъ슜 ???ㅼ떆媛?fetcher媛 ?ㅼ젙?섎뒗 `window._aaiiBearish` 誘몄궗??
- **?섏젙** (aio-core.js:693~706):
  ```js
  var aaiiBear = (typeof window._aaiiBearish === 'number') ? window._aaiiBearish : (snap.aaiiBear != null ? snap.aaiiBear : 43.0);
  var pcr = (typeof window._putCallRatio === 'number') ? window._putCallRatio : (snap.pcr != null ? snap.pcr : (snap.pcRatio != null ? snap.pcRatio : null));
  ```
- **?덈갑**: **P137** ???뚮뜑???묒꽦 ??李몄“ ?꾩뿭???ㅼ젣 ?대뵒???ㅼ젙?섎뒗吏 grep ?뺤씤. ?ㅼ링 ?대갚(window._X ??snap.y ??snap.z ??null).
- **R48 ?좉퇋**: Canvas ?뚮뜑???꾩뿭 蹂??李몄“ ???ㅼ젣 ?ㅼ젙 ?꾩튂 ?뺤씤.

### PR-P136: CSS `--surface-1~5` ?먭린?쒗솚 李몄“ (CRITICAL ??377嫄??ъ슜泥?臾댄슚)
- **violated_rule**: ?좉퇋 R47
- **利앹긽**: v48.48?먯꽌 ?꾩엯??`--surface-1: var(--surface-1)` ?뺤떇 ?먭린李몄“ ??CSS invalid ??377嫄??ъ슜泥??뚯씠釉?hover/移대뱶 諛곌꼍/援щ텇??input 諛곌꼍) 紐⑤몢 invisible.
- **洹쇰낯 ?먯씤**: v48.54 sed 移섑솚 ?ㅼ닔. ?먮옒 rgba 358嫄???var(--surface-*) ?꾪솚 ???좏겙 ?뺤쓽 ?먯껜媛 ?먭린李몄“濡??묒꽦?? ?쒓컖?곸쑝濡??꾪? ?묐룞 ???⑥뿉???먯? 紐삵븿.
- **?섏젙** (index.html:63~67):
  ```css
  --surface-1: rgba(255,255,255,0.02);
  --surface-2: rgba(255,255,255,0.03);
  --surface-3: rgba(255,255,255,0.04);
  --surface-4: rgba(255,255,255,0.05);
  --surface-5: rgba(255,255,255,0.08);
  ```
- **?덈갑**: **P136** ??CSS 蹂???먭린李몄“ 湲덉?. Hook Layer 泥댄겕 (`--([a-z0-9-]+):\s*var\(--\1\)`).
- **R47 ?좉퇋**: CSS 蹂???먭린?쒗솚 李몄“ 湲덉?.

### PR-P135: JS ?뚯씪 sed 移섑솚 踰붿쐞 ?꾨씫 (MEDIUM ???щ컻 3??
- **violated_rule**: ?좉퇋 R46
- **利앹긽**: 3???꾩쟻 ?⑦꽩:
  1. v48.35 onclick 253嫄??쒓굅 = HTML留???JS innerHTML ?숈쟻 二쇱엯 7嫄??붿〈
  2. v48.54 rgba 358嫄?移섑솚 = index.html留???JS 85嫄??꾨씫
  3. v48.59 font-size 991嫄?移섑솚 = index.html留???JS 124嫄??꾨씫
- **?섏젙** (v48.61):
  - JS ?몃씪???고듃 124嫄???0嫄?
  - JS rgba 0.0X 85嫄???var(--surface-*)/var(--border) 80+嫄?
  - JS innerHTML on* 7嫄???aio-hover-* ?대옒??
- **?덈갑**: **P135** ??CSS/?대깽???고듃 ???移섑솚 ??`index.html js/aio-core.js js/aio-data.js js/aio-ui.js js/aio-chat.js` ?꾩닔 ?ы븿.
- **R46 ?좉퇋**: HTML ??JS ?뚯씪源뚯? sed 移섑솚 踰붿쐞 ?뺣?.

### PR-P134: 二쇱옣-?ㅼ껜 遺덉씪移???RULES.md + Hook Layer (CRITICAL, ?좊ː??
- **violated_rule**: R42 (Agent 寃곌낵 ?ㅼ륫 援먯감寃利? ?곸슜 ?ㅽ뙣
- **利앹긽**: CHANGELOG v48.54/v48.55/v48.57/v48.59媛 "R39~R45 洹쒖튃 異붽? + Hook Layer 2~9 援ы쁽" 二쇱옣?덉쑝??
  - RULES.md ?ㅼ젣 理쒓퀬 R38 (v48.54源뚯?留? ??R39~R45 **?놁쓬**
  - validate-edit.sh ?ㅼ젣 20以?div 洹좏삎留???Layer 2~9 **?놁쓬**
- **洹쇰낯 ?먯씤**: CHANGELOG 湲곕줉 ???ㅼ젣 ?뚯씪 ?섏젙 ?꾨씫. ?먭? 寃利?遺??
- **?섏젙** (v48.61):
  - RULES.md R39~R48 ?ㅼ젣 異붽? (10媛??좉퇋 洹쒖튃)
  - validate-edit.sh 9 Layer ?ㅼ젣 援ы쁽 (rgba/on*/Canvas var/SUB_THEMES/extractTickers/setTimeout/getAttribute/TODO + ?먭린?쒗솚 CSS + ?고듃 7-9px)
- **?덈갑**: **P134** ??CHANGELOG ?묒꽦 ??`grep -c "R\d{2}\." RULES.md` + `wc -l .claude/hooks/validate-edit.sh` ?먭? 寃利???湲곕줉.

### PR-P133-extended: data-snap hardcoded 14嫄?+ P125 ?щ컻 ?꾨뱶 ?꾨씫 6嫄?
- **violated_rule**: P125/P133 ?곗옣
- **利앹긽**:
  1. index.html `data-snap-date="2026-04-15"` 14嫄?hardcoded (jensen-interview 1嫄??쒖쇅 13嫄댁씠 ?ㅼ젣 理쒖떊??臾몄젣).
  2. DATA_SNAPSHOT??`krCreditBalance/krDeposit/krShortSelling/krAdvance/krDecline/kr52wHigh/kr52wLow/krCoreCpi/krServicePrice/krServicePmi/gexCurrent` ?꾨뱶 ?놁쓬 ??`_snap.fixed(undefined)` ??"0.00議곗썝" ?쒖떆.
- **?섏젙** (v48.61):
  - HTML 14嫄?"2026-04-15" ??"2026-04-17" (湲덉슂???λ쭏媛? ?꾩닔 移섑솚.
  - `_aioRenderSnapshotDates` 利됱떆 ?ㅽ뻾 + 500ms 吏???댁쨷 ?몄텧 (?뚮옒??諛⑹?).
  - DATA_SNAPSHOT 11 ?꾨뱶 異붽? + applyDataSnapshot map??`kr-core-cpi`, `kr-service-price`, `kr-service-pmi`, `gex-current` 諛붿씤??

---

## [2026-04-20] v48.39 ??援ъ“???숈쟻 ?꾪솚 蹂닿컯 (Preventive Refactoring)

### PR-P133: ?곗씠??Staleness 媛먯? 遺??+ ?섎뱶肄붾뵫 ??꾩뒪?ы봽 (HIGH Latent)
- **violated_rule**: ?좉퇋 P133 (freshness 異붿쟻 ?명봽??遺??
- **?좎옱 ?꾪뿕**:
  1. `DATA_SNAPSHOT._updated` ?섎뱶肄붾뵫 臾몄옄?????ㅼ젣 媛깆떊怨?遺덉씪移? ?ъ슜?먮뒗 ?ㅻ옒???곗씠?곕? "理쒖떊"?쇰줈 ?ㅼ씤
  2. SCREENER_DB 硫붾え `[Citi 04/17]` 媛숈? ?좊꼸由ъ뒪??由ы룷?멸? 10?? 吏?섎룄 UI??stale 寃쎄퀬 ?놁쓬 ???ъ옄 ?먮떒 ?ㅻ쪟 ?꾪뿕
  3. RSS ?쇰뱶 80+ 以?3媛?dead (?대뜲?쇰━/?꾩떆?꾧꼍???? ?뺤씤?⑥뿉??留?fetch留덈떎 ?ъ떆?????쒓컙쨌?몃옒????퉬
  4. localStorage 罹먯떆 ?쒕┰: `aio_*` ?щ윭 ?꾨━?쎌뒪, TTL ?붿떆????QuotaExceededError ???꾩껜 ?ㅽ뙣, 留뚮즺 ?먯젙 遺덇?
  5. ?좎쭨 ?щ㎎ ?쒖? ?놁쓬: `toLocaleDateString` + ?섎룞 `Date` 議고빀 ??ko-KR/?쒓컙? 踰꾧렇 媛?μ꽦
- **?꾩닔 媛먯궗 寃곌낵 (3 Agent 蹂묐젹)**:
  - ?섎뱶肄붾뵫 ?곗씠?? DATA_SNAPSHOT 30+ ?꾨뱶 쨌 SCREENER_DB 500+ memo 쨌 _fallback 媛앹껜
  - ?숈쟻 媛깆떊 硫붿빱?덉쬁: ?대갚 泥댁씤 寃ш퀬 쨌 Visibility API ?쇱떆?뺤? 쨌 SW Cache-First ?곸슜
  - ?띿뒪???명솕: ?좊꼸由ъ뒪??由ы룷??50+嫄?7?? 寃쎄낵 쨌 DATE_ENGINE 遺??
- **?섏젙 ?꾨왂 (Structural Dynamic Tracking)**:
  1. **DATE_ENGINE** (aio-core.js L1871~): `now/isoNow/toTs/ageMs/isStale/formatRelative/formatAbsolute/staleBadge/oldest` + 移댄뀒怨좊━蹂?STALE_THRESHOLDS (quote 10m, news 1h, report 7d ?? + ?대え吏 ?됱긽 諛곗? (?윟/?윞/?뵶)
  2. **_lastFetch + _markFetch**: API蹂?留덉?留??깃났 ??꾩뒪?ы봽 以묒븰 ??μ냼. 8 fetch??二쇱엯 (quote/news/sentiment/fearGreed/putCall/fred/breadth/vixHistory)
  3. **DATA_SNAPSHOT._isFallback**: 珥덇린 true, applyLiveQuotes ?깃났 ??false ??UI freshness ?뺥솗???먯젙
  4. **_aioMemoStaleInfo**: 3 ?뺢퇋??(MM/DD 쨌 YYYY.MM 쨌 YYYY-MM-DD) ??SCREENER_DB memo ?좊꼸由ъ뒪???좎쭨 ?먮룞 ?뚯떛
  5. **_aioStockStaleInfo**: _asOf ?섎룞 ?꾨뱶 ?곗꽑 + memo ?뚯떛 ?대갚 ??fundamental ?ㅻ뜑??stale 寃쎄퀬 諛곗?
  6. **AIO_Cache**: ?듭씪 localStorage API (`_aioCache:` prefix) + 紐낆떆??TTL + ?먮룞 LRU ?뺣━ + QuotaExceededError ?먮룞 ???
  7. **_aioFeedHealth**: RSS ?쇰뱶蹂?{ok, fail, consecFail, disabledUntil} 異붿쟻 ??3???곗냽 ?ㅽ뙣 ??2h ?먮룞 鍮꾪솢??+ 蹂듦뎄 濡쒖쭅
  8. **?좎꽑???⑤꼸**: 媛?대뱶 ?섏씠吏 `aio-freshness-panel` ??8 API 諛곗? + ?대갚 ?곹깭 + RSS ?ъ뒪 + 罹먯떆 ?듦퀎 + 30珥??먮룞 媛깆떊
- **寃利?*:
  - ?뺤쟻 grep: ???щ낵 aio-core 61 쨌 aio-data 16 쨌 aio-chat 3 쨌 index.html 8
  - ?뚯꽌 ?⑥쐞: `_aioMemoStaleInfo('[Citi 04/17]...')` ?뺤긽 諛섑솚
  - UI DOM: `aio-freshness-panel` 二쇱엯 ?뺤씤
- **?덈갑**: **P133** ??(1) ?섎뱶肄붾뵫 ?좎쭨 臾몄옄??湲덉? ??`DATE_ENGINE.now()`/`.isoNow()` ?ъ슜. (2) ??fetch 異붽? ??`window._markFetch(apiName)` ?몄텧 ?섎Т. (3) ??localStorage 罹먯떆 吏곸젒 ?묒꽦 湲덉? ??`AIO_Cache` 寃쎌쑀. (4) RSS/API ?쇰뱶 異붽? ??id 遺??+ `_aioFeedHealth.reportOk/reportFail` ?듯빀. (5) SCREENER_DB memo???좎쭨 ?ы븿 ???뚯꽌 ?명솚 ?⑦꽩 `[SRC MM/DD]`쨌`[YYYY.MM]`쨌`[YYYY-MM-DD]` 以??
- **李몄“**: RULES R33 (DATE_ENGINE + _markFetch + _aioFeedHealth ?섎Т??

---

## [2026-04-19] v48.35 ??onclick ?몃씪???몃뱾??253嫄??꾩닔 ?쒓굅 (Preventive Refactoring)

### PR-P132: onclick ?몃씪???몃뱾??CSP-strict 鍮꾪샇??+ ESM 釉붾줉 (CRITICAL Latent)
- **violated_rule**: ?좉퇋 P132 (CSP/ESM 以鍮?遺??
- **?좎옱 ?꾪뿕**:
  1. `Content-Security-Policy: script-src 'self'` ?ㅻ뜑 ?꾩엯 ??253媛?onclick 紐⑤몢 李⑤떒 ??UI ?꾩껜 留덈퉬
  2. ESM (`<script type="module">`) ?꾪솚 ???꾩뿭 ?⑥닔 ?묎렐 遺덇? ???몃씪???몃뱾???꾨? 誘몃룞??
  3. onclick ?띿꽦 臾몄옄???댁뒪耳?댄봽 吏????3以?諛깆뒳?섏떆 ?⑦꽩 (`\\\'` ?? ?좎? 蹂댁닔 ?대젮?
  4. ?뺤쟻 遺꾩꽍 ?꾧뎄(linter/IDE ?몃쾭)媛 HTML ?띿꽦 ?덉쓽 JS ?몄떇 紐삵븿 ??由ы뙥?좊쭅 ???덊띁?곗뒪 異붿쟻 ?꾨씫
- **?댁쟾 ?먮떒**: v48.31?먯꽌 "onclick 251媛?由ы뙥?좊쭅? ?⑥씪 ?몄뀡 ?꾪뿕" ??v50 硫붿씠? ?닿? 寃곗젙
- **?ъ슜??吏??*: "?洹쒕え ?묒뾽???쒖감?곸쑝濡?吏꾪뻾?? ?ㅼ쓬 ?몄뀡?쇰줈 誘몃（嫄곕굹 ?ㅼ쓬 踰꾩쟾?쇰줈 誘몃（嫄곕굹 ?섏? 留먭퀬 臾댁“嫄??묒뾽 吏꾪뻾?? ???ы룊媛 ???⑥씪 ?몄뀡 ?꾨즺 媛?μ꽦 ?뺤씤
- **?섏젙 ?꾨왂 (Event Delegation)**:
  1. **?명봽??* (aio-core.js L149~208): window ?⑥씪 dispatcher ??data-action/arg/arg2/arg3/pass-el/pass-event/stop/prevent/arg-first-el + data-open-url + data-close-on-outside 吏?? Enter/Space ?ㅻ낫???쒖꽦??(A11y parity).
  2. **42 ?꾩슜 ?ы띁** (aio-core.js L210~380): `_aio*` ?ㅼ엫?ㅽ럹?댁뒪. 2-statement ?⑦꽩(`a();b();`)쨌議곌굔 ?⑦꽩(`if(typeof X==='function')X()`)쨌DOM 議곗옉 ?⑦꽩(`this.parentElement.style.display='none'` ?????⑥씪 ?⑥닔濡??댁떇.
  3. **Perl ?ㅽ겕由쏀듃 3?④퀎** (`_context/scripts/migrate_onclick{,_phase2,_phase3}.pl`):
     - Phase 1: ?뺤쟻 臾몄옄??由ы꽣??9 regex ??showPage/filter* ??**188嫄?* ?먮룞 移섑솚
     - Phase 2: 蹂듯빀 ?뺤쟻 ?⑦꽩 27 regex ??tip-toggle/backdrop close ??**39嫄?* 移섑솚
     - Phase 3: JS ?쒗뵆由?由ы꽣??19 regex ??fb*/showTicker ??**26嫄?* 移섑솚
  4. **JS render 吏곸젒 ?섏젙**: ?댁뒪 移대뱶 `window.open` ??`data-open-url` ??5怨?
- **寃利?*:
  - ?뺤쟻 grep: `onclick=` 0嫄?(index.html/js 紐⑤몢)
  - ?숈쟻 DOM: preview 痢≪젙 `querySelectorAll('[onclick]')` = 0
  - 湲곕뒫: showPage/toggleTheme/tip-toggle/modal backdrop ?뺤긽 ?숈옉 (preview 痢≪젙)
- **?덈갑**: **P132** ??(1) HTML ?몃씪???대깽???몃뱾??`onclick`/`onsubmit`/`onchange` ?? ?좉퇋 ?꾩엯 湲덉?. (2) ?좉퇋 UI ?붿냼??`data-action="fnName"` + ?ы띁 ?⑥닔 異붽?. (3) JS render ?쒗뵆由용룄 `data-action`/`data-open-url` ?⑦꽩 ?ъ슜. (4) `window.open(url,'_blank')` ?곗? 留먭퀬 `data-open-url="url"`. (5) `<form onsubmit>` ?곗? 留먭퀬 addEventListener.
- **李몄“**: RULES R30 (Event Delegation ?섎Т??

---

### 遺媛 媛쒖꽑 (P 踰덊샇 ?놁씠 湲곕줉, v48.14?먯꽌 ?④퍡 諛고룷)

**?명봽??16媛??좎꽕** ???붽? 湲곌? ?섏? ?꾪궎?띿쿂 蹂닿컯 (Agent 媛먯궗 湲곕컲):
- `_aioLog` 以묒븰 濡쒓굅 + ring-buffer 500嫄?+ `_aioLogs` 議고쉶 API (`all/tail/byLevel/byArea/rate/clear/dump`)
- `window.onerror` + `onunhandledrejection` ?꾩뿭 ?먮윭 ??(ring buffer ?먮룞 ?섏쭛)
- Rate ?꾧퀎 (1遺?50嫄?) ??`data-status-panel` ?먮룞 諛곕꼫
- `AIOBus.emit/on/off/once/stats` ?대깽??踰꾩뒪 ?섑띁 (湲곗〈 dispatchEvent ?명솚)
- 6醫?而ㅼ뒪? ?대깽?? aio:pageShown/liveQuotes/liveDataReceived/**regime-change/api-status-change/threshold-breach** (3醫??좎꽕)
- `PAGES` ?쇱슦???뚯씠釉?(21媛??섏씠吏 以묒븰 ?좎뼵 ??showPage ?ㅼ젣 援먯껜???먯쭊 留덉씠洹몃젅?댁뀡 ?덉젙)
- `safeLSGetJSON` + `LS_SCHEMAS` (aio_portfolio/watchlists/cached_quotes/llm_usage/user_prefs 5媛?key ?ㅽ궎留?寃利?
- `_pageState` ?듯빀 (initialized/charts/timers/observers) + `destroyPageCharts` ?곌퀎 ?먮룞 ?뺣━
- `_lazyInit` IntersectionObserver ?ы띁 (theme-detail ?섑뵆 ?곸슜, ?섎㉧吏 20媛?李⑦듃???꾩냽)
- `_fireThresholdBreach(metric, value, threshold, direction)` ??VIX/Fed/DXY ?꾧퀎 ?뚰뙆 ?먮룞 dispatch
- `_fireRegimeChange(key, prevLevel, newLevel, value, reg)` ??NARRATIVE_ENGINE ?덉쭚 ?꾩씠 ?먮룞 dispatch
- `showPromptModal` R6 以??(native prompt 0嫄?
- `HISTORICAL_PRECEDENTS` ?곸닔 遺꾨━ (2000.01/2007.10/2021.11 以묒븰 愿由?
- `NARRATIVE_ENGINE.setSnapshot/clearSnapshot` DI API
- `_warnDirectLiveDataWrite` SSOT 寃쎄퀬 ??(`window.AIO_DEBUG=true` 紐⑤뱶)
- Stale-cache degradation `fetchViaProxy` (6h TTL localStorage ?대갚)

**?곗씠???뺤옣**:
- ?뚮쭏 DB ?좎꽕: `THEME_NARRATIVES` 47媛?誘멸뎅 + `KR_THEME_NARRATIVES` 22媛??쒓뎅 = **69媛?援ъ“???대윭?곕툕** (why/valueChain/playerRoles 湲곌? 由ъ꽌移??ㅽ???
- `KR_SUB_THEMES` 22媛?援ъ“??(誘멸뎅 SUB_THEMES? ?숈씪 援ъ“)
- `KR_INSIGHT_MAP` 留ㅽ븨 (kr_* ??short ID)
- `_getThemeNews()` ?뚮쭏蹂??댁뒪 ?먮룞 留ㅼ묶 (Top 3 ?ロ뀒留덉뿉 AI ?꾨＼?꾪듃 二쇱엯)
- `_buildMarketLeadersSnapshot()` / `_buildKoreaLeadersSnapshot()` ??Top 3 narrative + INSIGHTS + 理쒓렐 7???댁뒪 ?먮룞 二쇱엯
- data-snap 諛붿씤??**41 ??52** / data-snap-date 諛곗? **0 ??11** / data-perf-ytd/1y **0 ??8**

**?대쾲 ?몄뀡 ?꾩닔 Agent 由ы룷??寃쎈줈**:
`C:\Users\zmfhd\AppData\Local\Temp\claude\...\51031526-6cef-4e7b-ac43-8320213ee189\tasks\` ??4媛?由ы룷??(67 ?뚮쭏 ?먭?, 21 ?섏씠吏 ?띿뒪???ㅼ틪, ?꾪궎?띿쿂 媛먯궗, KR ?곗빱 寃利?

---

## 諛붿씠?덈━ Self-Eval (/knowledge-lint L7?먯꽌 ?먮룞 泥댄겕)

臾몄꽌 嫄닿컯???먯젙. 媛???ぉ **紐낆떆?곸쑝濡?yes/no** ?듬?.

| # | ?됯? ??ぉ | 湲곗? |
|---|-----------|------|
| **BP1** | frontmatter 理쒖떊??| `last_verified` ?좎쭨媛 理쒓렐 踰꾧렇 ?섏젙??body 理쒖긽???좎쭨)怨??쇱튂?섎뒗媛? |
| **BP2** | P 踰덊샇 ?곗냽??| `next_P_number`媛 body 理쒖떊 P 踰덊샇 + 1怨??쇱튂?섎뒗媛? |
| **BP3** | ?좉퇋 P ?몃뜳???깅줉 | body??異붽???紐⑤뱺 P41+ 踰덊샇媛 ??"理쒓렐 P 踰덊샇 ?몃뜳?????깅줉?섏뿀?붽?? |
| **BP4** | violated_rule ?쒓렇 | 理쒓렐 5媛?踰꾧렇 ??ぉ 紐⑤몢 `violated_rule` ?꾨뱶媛 ?덈뒗媛? (R踰덊샇 ?먮뒗 "?좉퇋 P{N}") |
| **BP5** | CHANGELOG ?띾? | 踰꾧렇 ?섏젙??湲곗? CHANGELOG.md?????踰꾩쟾 ??ぉ??議댁옱?섎뒗媛? |
| **BP6** | 以묐났 寃異?| 媛숈? 利앹긽??踰꾧렇媛 ?대? 湲곕줉?섏뼱 ?덈뒗吏 ?뺤씤?덈뒗媛? (諛섎났 踰꾧렇??湲곗〈 ??ぉ update) |

### ?먯젙 洹쒖튃
- **?꾨? yes** ??臾몄꽌 嫄닿컯 ??
- **1~2媛?no** ??WARN, ?ㅼ쓬 `/knowledge-lint` ?몄뀡?먯꽌 ?뺣퉬
- **3媛??댁긽 no** ??FAIL, 利됱떆 ?뺣퉬 (frontmatter 媛깆떊, ?몃뜳???щ룞湲고솕)

---

## [2026-04-09] v45.5 -- ?쒕㈃ ?먭????ш컖吏? 3嫄?(留덉폆 ?꾩뒪 ?뺣젹쨌RRG 濡쒕뵫쨌?뱁꽣 1二??좉?)

### BUG-1: ?뱁꽣 1??1二??좉? ??`_sectorPerfMode` 蹂??誘몄궗??(HIGH)
- **violated_rule**: ?좉퇋 P65
- **利앹긽**: ?뱁꽣 ETF ?쇳룷癒쇱뒪 移대뱶??1??1二???씠 wired up ?섏뼱 ?덇퀬 ?대┃ ??active ?대옒?ㅻ룄 ?좉??? 洹몃윭??1二??대┃?대룄 ?쒖떆 ?곗씠?곕뒗 1?쇨낵 100% ?숈씪. 利??ъ슜?먯뿉寃?蹂댁씠????紐⑤뱶??寃곌낵媛 ?묎컳??
- **洹쇰낯 ?먯씤**: `renderSectorPerfBars()`媛 `var chg = d && d.pct != null ? d.pct : null` ??以꾨줈 ?앸궓. `_sectorPerfMode === '1w'` 遺꾧린 ?놁쓬. 1二쇱슜 ?곗씠???뚯뒪(二쇨컙 ?섏씡瑜? ?먯껜媛 誘멸뎄?? ?좉? ?⑥닔 `setSectorPerfMode()`??蹂?섎쭔 媛깆떊?섍퀬 ?꾨Т ?④낵 ?놁쓬 ??dead toggle.
- **?섏젙**: index.html L34297~34480
  - `_sectorWeeklyCache` 媛앹껜 + `_sectorWeeklyFetching` ?뚮옒洹?+ `_SECTOR_PCT_FALLBACK` (?뺤쟻 daily ?대갚)
  - `_fetchOneSectorWeekly(sym)`: Yahoo Finance `range=5d&interval=1d` ??`fetchViaProxy()` ??`_parseYFChartResponse()` ??5??first/last close濡??섏씡瑜?怨꾩궛
  - `fetchSectorWeeklyPerf()`: ?숈떆 4媛??쒗븳 ?? ?꾨씫 ?뱁꽣留?retry 媛?? ?꾨즺 ???먮룞 ?щ젋??
  - `renderSectorPerfBars()`: `isWeekly` 遺꾧린 異붽?. 1二쇰뒗 罹먯떆 ??live daily ??static fallback ?? 1?쇱? live ??static fallback
  - `setSectorPerfMode('1w')`: 誘몃낫???뱁꽣 ?먮룞 fetch
  - themes ?섏씠吏 吏꾩엯 ??諛깃렇?쇱슫???꾨━?섏튂
- **?덈갑**: P65 ??UI ?좉?/紐⑤뱶 異붽? ???뚮뜑 ?⑥닔 ?대??먯꽌 ?대떦 蹂?섍? ?ㅼ젣濡?遺꾧린 ?ъ슜?섎뒗吏 grep 寃利? "wired up = ?묐룞"???꾨떂. QA ???좉? ?대┃ ??寃곌낵 鍮꾧탳 ?꾩닔.

### BUG-2: 留덉폆 ?꾩뒪 諛???留ㅽ겕濡?segment ?뺣젹 + 濡쒕뵫 ?곴뎄 ?뺤껜 (MEDIUM)
- **violated_rule**: ?좉퇋 P66 + P67
- **利앹긽**:
  1. 留ㅽ겕濡?segment??"PULLBACK"/"CORRECTION" ?띿뒪?멸? ?ㅻⅨ segment???쇰꺼("留ㅻℓ?먯젣"/"嫄닿컯")蹂대떎 ?쒓컖?곸쑝濡??⑥뵮 ?ш쾶 ?쒖떆 ??4 segment ?뺣젹 源⑥쭚
  2. ?쒖옣???щ━ segment媛 ?곗씠??誘몄닔????"?붾줈?? ?곹깭濡??곴뎄 ?뺤껜 (?섏떗珥??꾩뿉???숈씪)
- **洹쇰낯 ?먯씤**:
  1. HTML L2226~2229??留ㅽ겕濡?segment媛 `<span class="ps-val">`(11px/800)?먮쭔 ?띿뒪?몃? ?쒖떆?섍퀬 `<span class="ps-status">`(8px/600) ?꾨씫. ?ㅻⅨ 3媛?segment??ps-val + ps-status ????媛吏? CSS???섏쓣 ?섎룄?곸쑝濡??ㅻⅨ ?ш린濡??뺤쓽?덇린?? 留ㅽ겕濡쒕쭔 ps-val ??湲?????뺣젹 源⑥쭚.
  2. `updateMarketPulse()` L32887~32898?먯꽌 `if (bVal !== null && !isNaN(bVal))` 議곌굔 ?덉뿉?쒕쭔 ?띿뒪??媛깆떊 ???곗씠??誘몄닔????珥덇린 "濡쒕뵫" ?띿뒪?멸? ?곴뎄???⑥쓬. `_breadth200`/`_lastFG`媛 ?ㅻⅨ ?섏씠吏?먯꽌留?梨꾩썙吏??蹂?섎씪 ?덉뿉??利됱떆 遺덇?.
- **?섏젙**: index.html L2226~2230 + L32870~32940
  - HTML: 留ㅽ겕濡?segment??`mp-macro-icon`(ps-val ?? + `mp-macro-val`(ps-status ?띿뒪?? 遺꾨━
  - JS: ?쒖옣???대갚 ??`calcSectorBreadth(11?뱁꽣)` (利됱떆 怨꾩궛 媛??, ?щ━ ?대갚 ??`DATA_SNAPSHOT.fg`, 留ㅽ겕濡????꾩씠肄??띿뒪???숈떆 媛깆떊. 紐⑤뱺 segment?먯꽌 ?곗씠???놁쑝硫?"?湲?濡?紐낆떆 ?쒖떆
- **?덈갑**: P66 ???곗씠??誘몄닔????"濡쒕뵫" ?곴뎄 ?뺤껜 湲덉?. ?대갚 ?곗씠???곗꽑, ?놁쑝硫?"?湲??? 紐낆떆. P67 ??媛숈? ?숆툒 而댄룷?뚰듃???숈씪 ?먯떇 援ъ“ ?좎?. QA-CHECKLIST 留덉폆 ?꾩뒪 ??ぉ??"4 segment 紐⑤몢 ps-val + ps-status ?숈씪 援ъ“" 泥댄겕 異붽?.

### BUG-3: RRG 李⑦듃 ??濡쒕뵫 ?곹깭 ?쒖떆 遺??(LOW)
- **violated_rule**: R8 (李⑦듃 ?띿뒪???대갚)
- **利앹긽**: themes ?섏씠吏 泥?吏꾩엯 ??RRG 李⑦듃??4遺꾨㈃ 諛곌꼍留?蹂댁씠怨??뱁꽣 ?먯씠 ?꾪? ?놁쓬. ?ъ슜?먭? "李⑦듃 ???섏샂"?쇰줈 ?ㅼ씤 (?ㅼ젣濡쒕뒗 ?쒖꽭 濡쒕뵫 以?.
- **洹쇰낯 ?먯씤**: `drawRRG()` L34151?먯꽌 `Object.keys(ld).length < 10`?대㈃ 利됱떆 return + setTimeout retry. retry 以?`rrg-chart-status` ?띿뒪??誘몄꽕?????ъ슜?먭? 吏꾪뻾 ?곹깭 紐⑤쫫. ?먰븳 < 10 議곌굔???덈Т 異붿긽?? ?ㅼ젣濡??꾩슂??嫄?SPY 議댁옱 ?щ?.
- **?섏젙**: index.html L34151~34164
  - 寃뚯씠??議곌굔??`!ld['SPY']`濡??⑥닚??(SPY ?놁쑝硫?calcLiveRS ?숈옉 遺덇?)
  - retry 以?status ?띿뒪?몄뿉 "?쒖꽭 濡쒕뵫 以?.. (N媛??섏떊)" ?쒖떆
  - 理쒕? ?湲?30珥???20珥덈줈 ?⑥텞, ?ㅽ뙣 ??"?쒖꽭 ?곌껐 吏?????좎떆 ???먮룞 媛깆떊?⑸땲??
- **?덈갑**: R8 媛뺥솕 ??紐⑤뱺 ?숈쟻 李⑦듃??濡쒕뵫 ?곹깭?먯꽌???ъ슜?먭? ?몄? 媛?ν븳 ?띿뒪???쒖떆. 鍮?罹붾쾭??+ 臾??쒖떆 = 寃고븿.

---

## [2026-04-09] v44.9 -- /bug-fix SCREENER_DB ?좉퇋 醫낅ぉ KNOWN_TICKERS 誘몃벑濡?(1嫄?

### BUG-1: SCREENER_DB ?좉퇋 醫낅ぉ KNOWN_TICKERS ?꾨씫 ???댁뒪 ?곗빱 諛곗? 誘몄옉??(MEDIUM)
- **violated_rule**: R10 (醫낅ぉ肄붾뱶 3以?寃利? + ?좉퇋 P64
- **利앹긽**: v44.8?먯꽌 SCREENER_DB??異붽???KEX쨌NVT쨌MTZ쨌SEI쨌LBRT 5醫낅ぉ??KNOWN_TICKERS Set??誘몃벑濡? ?댁뒪 ?쇰뱶?먯꽌 ?대떦 醫낅ぉ 愿??湲곗궗???곗빱 諛곗?媛 ?쒖떆?섏? ?딆쓬. `extractTickers()` ?⑥닔媛 KNOWN_TICKERS瑜?李몄“?섏뿬 ?곗빱 留ㅼ묶?섎?濡??깅줉 ?꾨씫 ???댁뒪-醫낅ぉ ?곌껐 ?꾩쟾 李⑤떒.
- **洹쇰낯 ?먯씤**: SCREENER_DB??醫낅ぉ 異붽? ??KNOWN_TICKERS ?숈떆 ?깅줉 洹쒖튃??泥댄겕由ъ뒪?몄뿉 ?놁뿀?? ??諛곗뿴??蹂꾧컻 ?꾩튂(SCREENER_DB ~L10500, KNOWN_TICKERS ~L13777)???덉뼱 ?섎굹留??섏젙?섍퀬 ?ㅻⅨ ?섎굹瑜??볦튂???⑦꽩.
- **?섏젙**: KEX쨌LBRT쨌MTZ쨌NVT쨌SEI瑜?KNOWN_TICKERS???뚰뙆踰녹닚 ?쎌엯 (L13808쨌13809쨌13815쨌13817쨌13825).
- **?덈갑**: P64 ??SCREENER_DB???좉퇋 醫낅ぉ 異붽? ??KNOWN_TICKERS?먮룄 諛섎뱶???숈떆 ?깅줉. QA-CHECKLIST 3F ?④퀎??"KNOWN_TICKERS ?깅줉 ?щ?" ??ぉ 異붽?.

---

## [2026-04-08] v44.6 -- /post-edit-qa ?대? ?댁쟾 ?대깽???쒕━釉??뺥빀??QA (6嫄?+ 援ъ“ 媛쒖꽑 3嫄?

### BUG-1: ?대? ?댁쟾 ???섎뱶肄붾뵫 ?띿뒪??6怨???갑??(HIGH)
- **violated_rule**: R21 (?곗씠??寃쎄낵??愿由? + ?좉퇋 P61
- **利앹긽**: WTI -15% ?댁쟾 ?⑹쓽 ?댄썑?먮룄 ?ㅽ겕由щ꼫 ??6怨녹씠 "?대??꾩웳???좉?湲됰벑", "?섏슂媛 臾대꼫吏怨??덈떎", "?대? ?쒖옱 ?댁젣 吏꾪뻾以???" ???꾩웳 ?쇳겕 ?쒖닠 ?좎?. ?ъ슜?먭? ?꾩옱 ?쒖옣 ?곹솴???ㅻ룆?????덉쓬.
- **洹쇰낯 ?먯씤**: DATA_SNAPSHOT ?섏튂(wti, brent, gold)???대깽??諛쒖깮 利됱떆 媛깆떊?섎굹, static HTML ?쒖닠 ?띿뒪??肄붾찘?맞룹꽮???쒕ぉ쨌?듭뀡 ?곹깭쨌?쒕굹由ъ삤 議곌굔)??蹂꾨룄 媛깆떊 猷⑦떞???놁뼱 ?댁쟾 ?대깽??留λ씫 洹몃?濡??붿〈.
- **?섏젙**: 6怨??띿뒪???꾩떎 諛섏쁺: ?쒓뎅 臾쇨? 肄붾찘?맞룹닔??肄붾찘?맞룹닔?뷀뙆愿??뱀뀡 ?쒕ぉ쨌JPM 6?듭뀡쨌?쒕굹由ъ삤 A 議곌굔쨌CP1 吏?뺥븰 移대뱶 detail + 誘명꽣諛?
- **?덈갑**: P61 ??DATA_SNAPSHOT ?섏튂 媛깆떊(data-refresh) ??諛섎뱶???띿뒪???쒖닠 ?뺥빀??泥댄겕 蹂묓뻾. `/bug-fix` ?ㅽ궗 Gotcha #7 + ?대깽???쒕━釉?泥댄겕由ъ뒪???좎꽕.

### BUG-2: generateMacroStoryline() 吏?뺥븰 留λ씫 遺??(援ъ“??怨듬갚)
- **violated_rule**: R26 (湲곗닠 ?몄궗?댄듃 ?섎쪟) + ?좉퇋 P62
- **利앹긽**: 留ㅽ겕濡??ㅽ넗由щ씪?몄씠 "WTI $95.5 = 寃쎄퀬 ?섏?"?대씪怨좊쭔 ?쒖떆?섍퀬 ????媛寃⑹씤吏(誘??대? 2二??댁쟾, ?ш탳??由ъ뒪?? 留λ씫 ?꾨Т. ?대깽???쒕━釉??μ꽭?먯꽌 ?섏튂留?蹂댁뿬以?
- **洹쇰낯 ?먯씤**: ?⑥닔媛 ?쒖닔 ?ㅼ떆媛??섏튂(VIX쨌WTI쨌TNX) 湲곕컲 遺꾧린留??덇퀬 "???섏튂媛 ?뺤꽦???댁쑀"瑜??쒖닠?섎뒗 吏?뺥븰 梨뺥꽣 ?놁쓬. "援ъ“???쒓퀎"濡??ㅽ뙋?섏뿬 WARN?쇰줈 諛⑹튂.
- **?섏젙**: WTI 8%+ 湲됰? OR VIX 25+ && WTI 85+ ???먮룞 媛먯??섎뒗 吏?뺥븰 梨뺥꽣 ?좎꽕(L26952~26989). live pct ?곗꽑 + DATA_SNAPSHOT.wtiPct ?대갚. 湲됰씫/湲됰벑/吏??3遺꾧린 ?대윭?곕툕.
- **?덈갑**: P62 ??"???⑥닔??X瑜??쒗쁽?????녿떎"???먮떒???섏삤硫?WARN 諛⑹튂 湲덉?. 援ъ“瑜??뺤옣?댁꽌 ?닿껐. `/bug-fix` ?ㅽ궗 Gotcha #8 ?좎꽕.

### BUG-3: ?꾩뿭 setInterval ?듬챸 ?깅줉 ??異붿쟻 遺덇? (MEDIUM)
- **violated_rule**: ?좉퇋 P63
- **利앹긽**: `setInterval` 13媛?以?2媛?DATE_ENGINE, checkPriceAlerts)媛 諛섑솚媛?誘몄??? DevTools?먯꽌 肄섏넄 clearInterval 遺덇?, ?꾩닔 ?섏떖 ???앸퀎 遺덇?.
- **洹쇰낯 ?먯씤**: ?꾩뿭 ??대㉧瑜?"?댁감???곴뎄 ?ㅽ뻾"?쇰줈 媛꾩＜??蹂???깅줉 ?앸왂.
- **?섏젙**: `window._dateEngineInterval`, `window._globalUpdateInterval`?쇰줈 紐낅챸 ?깅줉. setInterval/clearInterval ??11/11 ?꾨꼍 洹좏삎.
- **?덈갑**: P63 ??紐⑤뱺 setInterval 諛섑솚媛믪? `window._xxxInterval` 蹂?섏뿉 ??? `grep -c 'setInterval' == grep -c 'clearInterval'` ???섏튂媛 媛숈븘????

---

## [2026-04-06] v42.7 -- ?ъ링 QA ?먯씠?꾪듃 FAIL/WARN 3嫄?(3嫄?

### BUG-1: fomc-next ?곕뱶肄붾뱶 (map + DOMContentLoaded)
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: `applyDataSnapshot()` map??`'fomc-next'` ?ㅺ? ?덉쑝??HTML??`data-snap="fomc-next"` ?붿냼 ?놁쓬. DOMContentLoaded?먯꽌??`querySelector('[data-snap="fomc-next"]')` 荑쇰━?섏?留???긽 null ??臾댁쓬 ?ㅽ뙣.
- **洹쇰낯 ?먯씤**: 寃쎌젣 罹섎┛???ㅼ쓬 FOMC ?좎쭨 ?쒖떆 湲곕뒫??湲고쉷?섏뿀?쇰굹 HTML 諛붿씤???놁씠 JS留?援ы쁽???곹깭. `if (fomcEl)` 媛?쒕줈 ?고????먮윭???놁?留??곕뱶肄붾뱶.
- **?섏젙**: map?먯꽌 `'fomc-next'` ???쒓굅, DOMContentLoaded?먯꽌 `fomcEl` 釉붾줉 ?쒓굅.
- **?덈갑**: P58 ??applyDataSnapshot map ??異붽? ??諛섎뱶??HTML??`data-snap="?대떦??` ?붿냼 議댁옱 ?뺤씤.

### BUG-2: _lastFG 珥덇린媛??놁쓬 ??API ?묐떟 ??FG ?섏〈 而댄룷?뚰듃 ?ㅼ옉??
- **violated_rule**: R4 (?꾩뿭 蹂??珥덇린???쒖꽌)
- **利앹긽**: `fetchFearGreed()` API ?묐떟 ??AI 遺꾩꽍 梨꾪똿, 留ㅻℓ ?먯닔, ?щ━ ?섏씠吏 ?곹깭媛믪씠 紐⑤몢 18(洹밸떒怨듯룷) 怨좎젙. `DATA_SNAPSHOT.fg = 12`?몃뜲 ?ㅻⅨ 媛?諛섑솚.
- **洹쇰낯 ?먯씤**: `window._lastFG`媛 `fetchFearGreed()` 肄쒕갚?먯꽌 泥섏쓬 ?ㅼ젙?? 洹몄쟾?먮뒗 `window._lastFG || 18` ?대갚媛?18 ?ъ슜.
- **?섏젙**: `applyDataSnapshot()` 吏곹썑 `window._lastFG = DATA_SNAPSHOT.fg || 18` 珥덇린??異붽?.
- **?덈갑**: P59 ??API ?묐떟 ?섏〈 ?꾩뿭 蹂?섎뒗 ?뺤쟻 ?대갚(DATA_SNAPSHOT)?쇰줈 珥덇린???꾩닔. API ?묐떟 ??`undefined` ?곹깭 諛⑹?.

### BUG-3: signal ?섏씠吏 breadth 諛???긽 ?섎뱶肄붾뵫 珥덇린媛?
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: signal ?섏씠吏??"?쒖옣 ?? 諛?5SMA/20SMA/50SMA ??鍮꾩쑉)媛 breadth ?섏씠吏 諛⑸Ц ?꾧퉴吏 ??긽 ?섎뱶肄붾뵫 珥덇린媛?35%, 32%, 27.6%) ?쒖떆.
- **洹쇰낯 ?먯씤**: `updateBreadthBars()`??`initBreadthPage()` ?댁뿉?쒕쭔 ?몄텧?? signal ?섏씠吏??`aio:liveQuotes` 由ъ뒪?덉뿉 ?곌껐 ?놁쓬.
- **?섏젙**: signal ?섏씠吏 `aio:liveQuotes` 由ъ뒪?덉뿉 `updateBreadthBars()` 異붽?.
- **?덈갑**: P60 ??蹂듭닔 ?섏씠吏?먯꽌 ?숈씪 ?곗씠???쒖떆 ??媛??섏씠吏??liveQuotes 由ъ뒪?덉뿉 怨듯넻 ?낅뜲?댄듃 ?⑥닔 ?곌껐.

---

## [2026-04-06] v42.6 -- initSentimentPage 以묐났 cleanup 猷⑦봽 + macro 紐⑤컮??overflow (2嫄?

### BUG-1: AAII/PC 李⑦듃 blank (sentimentPage 以묐났 cleanup)
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: ?ъ옄 ?щ━ ?섏씠吏 吏꾩엯 ??AAII(誘멸뎅 媛쒖씤?ъ옄???ㅻЦ) 諛?P/C(?뗭퐳鍮꾩쑉) 李⑦듃媛 鍮?canvas濡??쒖떆. ?곗씠?곕뒗 ?덉쑝???뚮뜑 ?놁쓬.
- **洹쇰낯 ?먯씤**: `initSentimentPage()` ?대? ?ㅽ뻾 ?쒖꽌 臾몄젣. `initSentimentCharts()`濡?AAII+PC ?앹꽦 ?? ?숈씪 ?⑥닔 以묐컲????踰덉㎏ `Object.keys(sentPageCharts).forEach(destroy)` 猷⑦봽媛 諛⑷툑 留뚮뱺 AAII+PC瑜??촥estroy. VIX/NAAIM/II/HY??洹??ㅼ뿉 ?앹꽦?섎?濡??곹뼢 ?놁쓬. AAII+PC??destroy ???ъ깮???놁쓬.
- **?섏젙**: ??踰덉㎏ 以묐났 cleanup 猷⑦봽(L19304~19309) ?쒓굅. 泥?踰덉㎏ 猷⑦봽媛 ?대? pre-existing 李⑦듃瑜?紐⑤몢 泥섎━.
- **?덈갑**: P56 ??init ?⑥닔 ??cleanup 猷⑦봽 以묐났 湲덉?. "?앹꽦 ??利됱떆 destroy" ?⑦꽩? 肄붾뱶 由щ럭?먯꽌 諛섎뱶??寃異?

### BUG-2: macro ?섏씠吏 ?명솚쨌梨꾧텒 洹몃━??紐⑤컮??overflow
- **violated_rule**: R5 (CSS overflow 3以?諛⑹뼱)
- **利앹긽**: 紐⑤컮??375px) macro ?섏씠吏?먯꽌 ?명솚쨌梨꾧텒 ?붿빟 ?뱀뀡???섑룊?쇰줈 overflow ???섏씠吏 ?꾩껜 媛濡??ㅽ겕濡?諛쒖깮.
- **洹쇰낯 ?먯씤**: `grid-template-columns:repeat(6,1fr)` ??6媛?怨좎젙 而щ읆??醫곸? 而⑦뀒?대꼫(~329px)?먯꽌 ~55px/col濡?異뺤냼. `mfx-cell` ??USD/KRW ??4-5???덉씠釉붿씠 ? ?덈퉬 珥덇낵.
- **?섏젙**: `repeat(6,1fr)` ??`repeat(auto-fit,minmax(85px,1fr))`. 紐⑤컮?? 3?늘??? ?곗뒪?ы넲: 6??1??
- **?덈갑**: P57 ??怨좎젙 repeat(N,1fr) 洹몃━?쒕뒗 mobile 375px?먯꽌 N횞min-content > container width ?щ? ?뺤씤 ?꾩닔. 6???댁긽? auto-fit/minmax 寃??

---

## [2026-04-06] v42.5 -- 誘몄빱踰??곸뿭 ?꾩닔 QA: ?댁뒪 ?ㅼ썙??/ R15 ?⑦꽩 / 蹂댁븞 / ?묎렐??/ ?깅뒫 (9嫄?

### BUG-1: TECH_KW '?? 1湲???ㅼ썙??R17 ?꾨컲 (HIGH)
- **violated_rule**: R17 (?ㅼ썙??湲몄씠 ?쒗븳)
- **利앹긽**: `'??` ?⑤룆 1湲???ㅼ썙?쒓? TECH_KW??議댁옱. ??湲??留ㅼ묶?쇰줈 "?밸━??, "?밸젅??, "?뚮씪?? ??紐⑤뱺 '?? ?ы븿 臾몄옄?댁뿉 ?ㅽ깘 媛??
- **洹쇰낯 ?먯씤**: v31.8 ?쒓뎅 諛섎룄泥??ㅼ썙??異붽? ??'?⑥씠??,'?ㅻ━肄?,'??,'媛?숇쪧','?섏쑉' 紐⑸줉???⑤룆 1湲??異붽?.
- **?섏젙**: `'??` ??`'?밸━??` 援먯껜.
- **?덈갑**: P52 ??TECH_KW/MACRO_KW ?ㅼ썙??異붽? ??len < 3 泥댄겕. 1湲???⑤룆 ?쒓? ?ㅼ썙???덈? 湲덉?.

### BUG-2: MACRO_KW 以묐났 2湲???ㅼ썙????湲?踰꾩쟾 ?대? 議댁옱 (MEDIUM)
- **violated_rule**: R17
- **利앹긽**: `'遊됱뇙'`(?댁긽遊됱뇙 議댁옱), `'臾쇨?'`(?뚮퉬?먮Ъ媛/?앹궛?먮Ъ媛/洹쇱썝臾쇨? 議댁옱), `'怨좎슜'`(怨좎슜吏???좉퇋怨좎슜/鍮꾨냽?낃퀬??議댁옱) ????湲??숈쓽?닿? ?대? 諛곗뿴???덉뼱 2湲??踰꾩쟾 以묐났.
- **?섏젙**: 3媛??쒓굅. `'湲댁텞'` ??`'湲댁텞?뺤콉'`, `'?쇰큸'` ??`'湲덈━?쇰큸'` ?뺤옣.
- **?덈갑**: P52 蹂닿컯 ?????ㅼ썙??異붽? ??湲곗〈 諛곗뿴????湲??숈쓽??議댁옱 ?щ? ?뺤씤. 2湲??異붽? ??`grep '湲곗〈?ㅼ썙??` ?좏뻾.

### BUG-3: d.pct || 0 ?⑦꽩 5嫄?R15 ?꾨컲 (MEDIUM)
- **violated_rule**: R15 (?곗씠??誘몄닔??vs 0% 援щ텇)
- **利앹긽**: AI 梨꾪똿 而⑦뀓?ㅽ듃 鍮뚮뱶 ?⑥닔 5怨녹뿉??`d.pct || 0` ?⑦꽩 ?ъ슜. `pct === null`(誘몄닔??怨?`pct === 0`(?ㅼ젣 蹂댄빀)??援щ텇?섏? 紐삵빐 誘몄닔???곗씠?곕? "0% 蹂???쇰줈 ?쒖떆 媛??
- **洹쇰낯 ?먯씤**: AI 而⑦뀓?ㅽ듃 鍮뚮뱶 ?⑥닔??UI ?뚮뜑 ?꾨떂?먮룄 ?숈씪 ?⑦꽩 ?곸슜.
- **?섏젙**: `(d.pct != null) ? d.pct : 0` 紐낆떆??null 泥댄겕 5嫄??곸슜.
- **?덈갑**: R15 ?ы솗????`|| 0` ?⑦꽩? JS?먯꽌 `0`??falsy?대?濡??ㅼ젣 0%瑜?0?쇰줈 ?泥? ??긽 `!= null` 泥댄겕 ?ъ슜.

### BUG-4: spx.pct?.toFixed(2) || '0.00' R15 ?꾨컲 (MEDIUM)
- **violated_rule**: R15
- **利앹긽**: ???붿빟 ?띿뒪??`summarytxt`)?먯꽌 `spx.pct` 誘몄닔????`'0.00'` ?대갚?쇰줈 "S&P 500 +0.00%" ?쒖떆 ???곗씠??誘몄닔?좎씤吏 ?ㅼ젣 蹂댄빀?몄? 援щ텇 遺덇?.
- **?섏젙**: `spx.pct != null ? spx.pct.toFixed(2) : '??` + summarytxt?먯꽌 `'??` 遺꾧린 泥섎━.
- **?덈갑**: P53 ?????붿빟 ?띿뒪?????ъ슜?먯뿉寃?吏곸젒 ?쒖떆?섎뒗 ?섏튂??R15 ?곸슜 ?꾩닔. `?.` ?듭뀛??泥댁씠??+ `|| ?レ옄` 議고빀 湲덉?.

### BUG-5: 釉뚮━??score ?꾧퀎媛?40 ??R22 湲곗? 45 遺덉씪移?(MEDIUM)
- **violated_rule**: R22 (?댁뒪 怨꾩링???좊퀎)
- **利앹긽**: ?곗씪由?釉뚮━?묒씠 score 40+ ?댁뒪瑜??ы븿. R22??釉뚮━??湲곗???45+濡?洹쒖젙.
- **?섏젙**: `>= 40` ??`>= 45`.
- **?덈갑**: P54 ??3?④퀎 score ?꾧퀎媛???90+) / 釉뚮━??45+) / ?쇰뱶(30+) 怨좎젙. 蹂寃???R22 紐낆떆 ?뺤씤 ?꾩닔.

### BUG-6: e.message innerHTML 吏곸젒 ?쎌엯 ??XSS ?대줎???꾪뿕 (LOW)
- **violated_rule**: ?좉퇋 (蹂댁븞)
- **利앹긽**: 釉뚮━??catch 釉붾줉?먯꽌 `e.message` 誘몄씠?ㅼ??댄봽 HTML ?쎌엯. JS Error.message媛 fetch ?묐떟 ???몃? 臾몄옄???ы븿 ???대줎??XSS 媛??
- **?섏젙**: `escHtml(e.message || '?????녿뒗 ?ㅻ쪟')` ?곸슜.
- **?덈갑**: P26 ?ы솗????catch 釉붾줉??`e.message` ?ы븿, 紐⑤뱺 ?고???臾몄옄?댁씠 innerHTML???ㅼ뼱媛???escHtml ?꾩닔.

### BUG-7: CSS class font-size:8px P37 ?꾨컲 ??inline override 誘몄쟻??(MEDIUM)
- **violated_rule**: ?좉퇋 (?묎렐??P37)
- **利앹긽**: `.kr-badge`, `.kr-tag`, `.tac-score-label`, `.tac-radar-table th`, `.tac-heat-badge` CSS class ?뺤쓽??8px. 湲곗〈 `[style*="font-size:8px"]` override??inline style留??????class 湲곕컲? 誘몄쟻??
- **?섏젙**: ?대떦 5媛?CSS class ?뺤쓽瑜?8px ??11px 吏곸젒 蹂寃?
- **?덈갑**: P55 ??font-size ?ㅼ젙 ??CSS class ?뺤쓽??11px ?댁긽 ?뺤씤. inline override??class 湲곕컲 洹쒖튃 誘명룷??

### BUG-8: destroyPageCharts KR ?섏씠吏 4媛?耳?댁뒪 ?놁쓬 (MEDIUM)
- **violated_rule**: R9 (Dead Page 諛⑹? ??硫붾え由??꾩닔)
- **利앹긽**: `kr-home`, `kr-supply`, `kr-themes`, `kr-macro` ?섏씠吏 ?댄깉 ??Chart.js canvas 誘몄젙由?媛?μ꽦. `kr-technical`留?紐낆떆???뺣━ ?덉쓬.
- **?섏젙**: 4媛??섏씠吏??`#page-{id} canvas` ?꾩껜 ?쒗쉶 ?뺣━ 耳?댁뒪 異붽?.
- **?덈갑**: P47 蹂닿컯 ?????섏씠吏 異붽? ??`destroyPageCharts()` 耳?댁뒪 ?숈떆 異붽?. KR ?섏씠吏援곗? 蹂꾨룄 耳?댁뒪 ?꾩닔.

---

## [2026-04-06] v42.4 -- ?꾩닔 QA ?섏젙: Dead DOM / breadth / macro / RRG / mobile (7嫄?

### BUG-5: breadth-bar querySelector('div') null ??寃뚯씠吏 ??긽 50% 怨좎젙 (HIGH)
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: technical ?섏씠吏 "?쒖옣 嫄닿컯?? ?뱀뀡??留덉폆 ??50MA ??鍮꾩쑉) 寃뚯씠吏媛 ??긽 50% 怨좎젙媛??쒖떆. ?ㅼ떆媛??곗씠???곌껐 ????
- **洹쇰낯 ?먯씤**: `breadthEl.querySelector('div').style.width` ??`#breadth-bar` ?붿냼 ?먯껜媛 bar?대ŉ ?먯떇 div ?놁쓬. `querySelector('div')` = null. `if (breadthEl && breadthEl.querySelector('div'))` 媛?쒓? null 諛⑹??섏?留??낅뜲?댄듃 ?먯껜???ㅽ뻾 ????
- **?섏젙**: `if (breadthEl) breadthEl.style.width = above50ma + '%'` 吏곸젒 ?곸슜.
- **?덈갑**: P44 ??bar ?붿냼?먯꽌 `querySelector('div')`濡??먯떇 div瑜?李얘린 ?? ?대떦 ?붿냼 ?먯껜媛 bar?몄? ?뺤씤. `el.style.width` 吏곸젒 ?ㅼ젙??湲곕낯 ?⑦꽩; ?대? wrapper div媛 ?덉쓣 ?뚮쭔 querySelector ?ъ슜.

### BUG-6: applyDataSnapshot map 4媛????꾨씫 ??macro 移대뱶 4媛??곴뎄 怨좎젙媛?(HIGH)
- **violated_rule**: R21 (?곗씠??寃쎄낵??愿由?
- **利앹긽**: macro ?섏씠吏 ?뚮퉬쨌怨좎슜쨌二쇳깮 移대뱶 4媛??뚮ℓ?먮ℓ, ?꾧툑?곸듅, ?뚮퉬?먯떖由? 二쇳깮李⑷났) 媛믪씠 HTML ?섎뱶肄붾뵫 怨좎젙媛?+0.6%, 3.8%, 104.7, 1.42M)?쇰줈 ?곴뎄 ?쒖떆. DATA_SNAPSHOT 媛깆떊?먮룄 ?붾㈃ 蹂寃??놁쓬.
- **洹쇰낯 ?먯씤**: HTML??`data-snap="retail-sales"` ??4媛??좎뼵?섏뼱 ?덉쑝??`applyDataSnapshot()`??map 媛앹껜???대떦 ??媛????놁쓬. map ?꾨씫 ?ㅻ뒗 臾댁쓬 泥섎━(no-op).
- **?섏젙**: map??`'retail-sales'`, `'wage-growth'`, `'cons-conf'`, `'housing'` 4媛???媛???異붽?.
- **?덈갑**: P45 ??HTML??`data-snap="X"` ?띿꽦 異붽? ??`applyDataSnapshot()` map???숈씪 ??`'X'` 議댁옱 ?щ? 利됱떆 ?뺤씤. ?좉퇋 `data-snap` 異붽???map ?섏젙 ?놁씠 ?④낵 ?놁쓬.

### BUG-7: signal ?섏씠吏 釉뚮젅?쒖벐 諛?6??Dead Static HTML ??珥덇린媛??곴뎄 怨좎젙 (HIGH)
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: ?쒖옣 ???뱀뀡??5SMA/20SMA/50SMA/McClellan/Weinstein ?됱씠 ??긽 珥덇린 ?섎뱶肄붾뵫 媛??쒖떆 (4/1 湲곗? 怨좎젙). ?ㅼ떆媛??곗씠??諛섏쁺 ????
- **洹쇰낯 ?먯씤**: 釉뚮젅?쒖벐 諛?HTML ?됱뿉 ID ?놁뼱 JS ?낅뜲?댄듃 遺덇?. `initBreadthPage()`媛 `window._breadth*` ?꾩뿭 蹂?섎? ?ㅼ젙?섏?留??대? DOM??諛섏쁺?섎뒗 ?⑥닔 ?놁쓬 (Dead Static HTML ?⑦꽩).
- **?섏젙**: 5SMA/20SMA/50SMA ?됱뿉 ID 遺??`bb-5sma-bar`/`bb-5sma-val`/`bb-5sma-badge` ?? + `updateBreadthBars()` ?⑥닔 ?좎꽕 + `initBreadthPage()` ?앹뿉???몄텧.
- **?덈갑**: P46 ???숈쟻 ?곗씠?곕? ?쒖떆?섎뒗 HTML ?붿냼??諛섎뱶??ID 遺?? `window._xxx` ?꾩뿭 蹂???ㅼ젙 ??DOM 諛섏쁺 ?⑥닔(`update*()`) ?몄텧源뚯? ???띿쑝濡?援ы쁽. ?⑤룆 ?꾩뿭 蹂???ㅼ젙? Dead Static HTML ?꾪뿕 ?좏샇.

### BUG-8: breadth ?섏씠吏 NDX 移대뱶 ?섎뱶肄붾뵫 怨좎젙媛?(HIGH)
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: breadth ?섏씠吏 "?섏뒪??援ъ꽦二??꾪솴" 移대뱶??5?쇱꽑/20?쇱꽑/50?쇱꽑 媛믪씠 ??긽 ?섎뱶肄붾뵫(33.4%, 23.2%, 27.6%) 怨좎젙. BUG-7怨??숈씪 ?먯씤.
- **洹쇰낯 ?먯씤**: `bp-ndx5-val`/`bp-ndx20-val`/`bp-ndx50-val` ID ?놁쓬 ??JS ?낅뜲?댄듃 遺덇?.
- **?섏젙**: ID 遺??+ `updateBreadthBars()`?먯꽌 `window._breadthNDX5/20/50` ?꾩뿭 罹먯떆 ?쎌뼱 ?숆린 媛깆떊. `initBreadthPage()`?먯꽌 NDX ?꾩뿭 罹먯떆 異붽? ?ㅼ젙.
- **?덈갑**: P46 (?꾩? ?숈씪) ??Dead Static HTML ?⑦꽩.

### BUG-9: destroyPageCharts themes 耳?댁뒪 ?꾨씫 ??RRG canvas ?붿긽 媛?μ꽦 (MEDIUM)
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: themes ?섏씠吏 ?댄깉 ???ъ쭊????RRG canvas???댁쟾 洹몃━湲??붿긽 媛?μ꽦.
- **洹쇰낯 ?먯씤**: `destroyPageCharts()`??`themes` 耳?댁뒪 ?놁쓬. `drawRRG()`媛 raw Canvas 2D API ?ъ슜 ??Chart.js destroy? ?щ━ `clearRect` ?놁씠 ?ш렇由щ㈃ ?붿긽.
- **?섏젙**: `destroyPageCharts`??themes 耳?댁뒪 異붽? ??`rrg-canvas.getContext('2d').clearRect(0,0,w,h)` + `_rrgRetry = 0` 由ъ뀑.
- **?덈갑**: P47 ??raw Canvas 2D API ?ъ슜 李⑦듃??Chart.js `destroy()` ???`clearRect()` + ?곹깭 蹂??由ъ뀑?쇰줈 ?뺣━. `destroyPageCharts()`???대떦 耳?댁뒪 ?꾨씫 ?놁씠 異붽?.

### BUG-10: bpLabels/bhLabels 6二??댁긽 援ъ떇 ??釉뚮젅?쒖벐 李⑦듃 R21 ?꾨컲 (HIGH)
- **violated_rule**: R21 (?곗씠??寃쎄낵??愿由?
- **利앹긽**: 釉뚮젅?쒖벐 李⑦듃(bp/bh)媛 2/20~3/19 踰붿쐞 ?곗씠?곕쭔 ?쒖떆. ?꾩옱(4??珥? 湲곗? 6二?愿대━. DATA_SNAPSHOT? 理쒖떊?몃뜲 李⑦듃 ?덉씠釉붾쭔 援ъ떇.
- **洹쇰낯 ?먯씤**: DATA_SNAPSHOT 媛깆떊 ??釉뚮젅?쒖벐 諛곗뿴(`bpLabels`, `bhLabels`, `bpSPX*`, `bpNDX*`, `bhSPX*`, `bhNDX*`) 誘멸갚?? ???곗씠?곗냼??媛깆떊 二쇨린 遺덉씪移?
- **?섏젙**: `bpLabels`/`bhLabels` ??3/6~4/2 (20嫄곕옒??, 紐⑤뱺 釉뚮젅?쒖벐 諛곗뿴 援먯껜.
- **?덈갑**: P48 ??DATA_SNAPSHOT ?좎쭨 媛깆떊 ??釉뚮젅?쒖벐 諛곗뿴???숈떆 媛깆떊 泥댄겕由ъ뒪????ぉ. ???뚯뒪 ?좎쭨 踰붿쐞媛 2二??댁긽 愿대━ ??寃쎄퀬.

### BUG-11: getDataAge() ?꾧퀎媛??덈Т 愿? ??stale 寃쎄퀬 誘명몴??(MEDIUM)
- **violated_rule**: R21 (?곗씠??寃쎄낵??愿由?
- **利앹긽**: DATA_SNAPSHOT??2??寃쎄낵?덉쓬?먮룄 breadth/sentiment ?섏씠吏 stale 諛곗? 誘명몴?? ?ъ슜?먭? 援ъ떇 ?곗씠?곕? 理쒖떊?쇰줈 ?ㅼ씤 媛??
- **洹쇰낯 ?먯씤**: `getDataAge()` stale 議곌굔 `days > 3` ??4???댁긽留?stale 泥섎━.
- **?섏젙**: `days > 1` (2???댁긽 stale)濡?蹂寃?
- **?덈갑**: P49 ???섎뱶肄붾뵫 ?곗씠??DATA_SNAPSHOT)??2??湲곗? stale ?쒖떆. ?ㅼ떆媛?API ?곗씠?곕뒗 蹂꾨룄 freshness 泥댄겕.

---

## [2026-04-06] v42.3 -- ?꾩닔 QA ?섏젙: 釉뚮젅?쒖벐 諛??덉씠?꾩썐 / Dead Section / fxbond (4嫄?

### BUG-1: .bb-label ?띿뒪??overflow ??bar? 寃뱀묠 (MEDIUM)
- **violated_rule**: R7 (?쒓뎅???띿뒪???덉씠?꾩썐)
- **利앹긽**: signal ?섏씠吏 釉뚮젅?쒖벐 諛??뱀뀡?먯꽌 "20SMA Up", "50SMA Up" ?덉씠釉붿씠 120px 而щ읆??踰쀬뼱??bar? 寃뱀묠.
- **洹쇰낯 ?먯씤**: v31.9?먯꽌 `font-size:11px` + `min-width:110px` 異붽??덉쑝??而щ읆 ??120px) ?鍮?珥덇낵. ?쒓뎅???덉씠釉?"20SMA ?곸쐞"媛 ??湲몄뼱 ?ㅻ쾭?뚮줈.
- **?섏젙**: `font-size:8px` 蹂듭썝, `min-width` ?쒓굅, `text-overflow:ellipsis` 異붽?.
- **?덈갑**: P43 湲곗〈 ??ぉ 蹂닿컯 ??諛??덉씠?꾩썐?먯꽌 ?덉씠釉?而щ읆? 怨좎젙???좎?, font-size 蹂寃????ㅻ쾭?뚮줈 ?ы솗??

### BUG-2: Pattern Scanner Signal/Momentum ??긽 "?? ??Dead Section (HIGH)
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: signal ?섏씠吏 Pattern Scanner ?뱀뀡??Signal/Momentum 而щ읆????긽 "?? ?쒖떆. ?대뼡 ?곗씠?곕룄 諛섏쁺 ????
- **洹쇰낯 ?먯씤**: DOM ID(`ps-xle-signal` ?????좎뼵?섏뼱 ?덉쑝??JS ?낅뜲?댄듃 ?⑥닔 議댁옱?섏? ?딆쓬. ?ъ슜???붿껌 ?놁씠 ?꾩쓽濡?異붽???Dead Section.
- **?섏젙**: Pattern Scanner ?뱀뀡 ?꾩껜 ?쒓굅.
- **?덈갑**: P46 蹂닿컯 ??UI ?뱀뀡 異붽? ??JS ?낅뜲?댄듃 ?⑥닔 ?놁쑝硫?Dead Section. ?⑥닔 ?녿뒗 ?뱀뀡 異붽? 湲덉?.

### BUG-3: Portfolio 諛곕텇 移대뱶 ?띿뒪??寃뱀묠 (MEDIUM)
- **violated_rule**: R7 (?쒓뎅???띿뒪???덉씠?꾩썐)
- **利앹긽**: ?ы듃?대━??諛곕텇 移대뱶?먯꽌 醫낅ぉ紐?鍮꾩쨷/?깅씫瑜??띿뒪?멸? 寃뱀퀜 蹂댁엫.
- **洹쇰낯 ?먯씤**: grid ?덉씠?꾩썐 ???띿뒪?????`flex:1;min-width:0` ?놁쓬. 湲?醫낅ぉ紐낆씠 而⑦뀒?대꼫瑜?珥덇낵.
- **?섏젙**: ?섑룊 flex ?덉씠?꾩썐?쇰줈 ?ш뎄?? `flex:1;min-width:0` ?곸슜.
- **?덈갑**: P50 ??flex/grid 而⑦뀒?대꼫 ???띿뒪?????`flex:1;min-width:0` ?꾩닔. ?쒓뎅??湲?醫낅ぉ紐??ㅻ쾭?뚮줈 諛⑹뼱.

### BUG-4: fxbond ?섏씠吏 initYieldCurveChart() silent failure (MEDIUM)
- **violated_rule**: R4 (?숈쟻 DOM ?쎌엯 二쇱쓽)
- **利앹긽**: fxbond ?섏씠吏 吏꾩엯 ??肄섏넄 ?먮윭 ?놁쑝???섏씡瑜?怨≪꽑 李⑦듃媛 珥덇린??????
- **洹쇰낯 ?먯씤**: `updateFxBondPage` wrapper?먯꽌 `initYieldCurveChart()` ?몄텧?섎뒗?? ???⑥닔??macro ?섏씠吏??canvas ID 李몄“ ??fxbond ?섏씠吏?먮뒗 ?대떦 canvas ?놁쓬. null 泥댄겕 ?놁뼱 議곗슜???ㅽ뙣.
- **?섏젙**: `updateFxBondPage` wrapper?먯꽌 `initYieldCurveChart()` ?몄텧 ?쒓굅.
- **?덈갑**: P51 ???섏씠吏 珥덇린???⑥닔 ?몄텧 ???대떦 canvas/DOM???꾩옱 ?섏씠吏???ㅼ옱?섎뒗吏 ?뺤씤. ?ㅻⅨ ?섏씠吏??DOM ID瑜?李몄“?섎뒗 init ?⑥닔 援먯감 ?몄텧 湲덉?.

---

## [2026-04-05] v42.1 -- ?쒖옣 ?댁뒪 desc/summary ?꾨씫 + 釉뚮━???щ㎎ 誘명씉 + 由ъ뒪??紐⑤땲??以묐났 (3嫄?

### BUG-1: 移댄뀒怨좊━蹂??댁뒪 酉곗뿉 desc/summary 誘명몴??(MEDIUM)
- **violated_rule**: ?좉퇋 (?뚮뜑留??꾨씫)
- **利앹긽**: ?쒖옣 ?댁뒪 ??移댄뀒怨좊━蹂???뿉???ㅻ뱶?쇱씤(?쒕ぉ)留??쒖떆?섍퀬, ?ㅻ챸(desc)怨??붿빟(summary)??蹂댁씠吏 ?딆쓬.
- **洹쇰낯 ?먯씤**: `_renderTopicSection()`?먯꽌 `displayTitle`留??뚮뜑留? `getDisplayDesc()`/`getDisplaySummary()` ?몄텧 諛?HTML ?쎌엯 肄붾뱶 ?꾨씫.
- **?섏젙**: `_renderTopicSection()`??`displayDesc`/`displaySummary` 蹂??異붽? + ?ㅻ챸(10px)怨??붿빟(9px italic) HTML div ?쎌엯.
- **?덈갑**: P40 ?????댁뒪 ?뚮뜑??異붽? ??湲곗〈 ?뚮뜑??`_renderTopicSection`/`_renderBriefingBullet`)???쒖떆 ??ぉ(?쒕ぉ/?ㅻ챸/?붿빟/?뚯뒪/?쒓컙)??泥댄겕由ъ뒪?몃줈 ?뺤씤.

### BUG-2: ?곗씪由?釉뚮━?묒씠 ?⑥닚 遺덈┸ 紐⑸줉 ??遺꾩꽍/?댁꽍 遺??(MEDIUM)
- **violated_rule**: ?좉퇋 (UX 湲곕? 遺덉씪移?
- **利앹긽**: ?곗씪由?釉뚮━?묒씠 ??쨌) + ?쒕ぉ留??섏뿴?섎뒗 ?뺥깭濡? ?쒖옣 ?댁뒪? 李⑤퀎???놁쓬. ?ъ슜?먭? 湲곕??섎뒗 遺꾩꽍/?댁꽍/?ㅻ챸 ?놁쓬.
- **洹쇰낯 ?먯씤**: `_renderBriefingBullet()`???⑥닚 dot+title ?뺥깭. `_renderBriefingSection()` ?ㅻ뜑??理쒖냼 ?ㅽ???
- **?섏젙**: `_renderBriefingBullet()`???꾪떚??移대뱶 ?뺥깭濡??ъ옉??(border-left 3px + ?쒕ぉ 蹂쇰뱶 + ?쇳떚癒쇳듃 諛곗? + ?ㅻ챸 + ?붿빟 + ?뚯뒪/?쒓컙). `_renderBriefingSection()` ?ㅻ뜑???꾩씠肄?嫄댁닔 諛곗? 異붽?.
- **?덈갑**: P41 ???댁뒪 ?쒖떆 而댄룷?뚰듃??理쒖냼 5?붿냼(?쒕ぉ/?ㅻ챸/?붿빟/?뚯뒪/?쒓컙) ?뚮뜑留? ??酉?異붽? ??湲곗〈 酉곗? ?뺣낫 諛??鍮꾧탳.

### BUG-3: updateRallyQualityVerdict() stale DOM 李몄“ ????긽 "濡쒕뵫 ?湲? (MEDIUM)
- **violated_rule**: ?좉퇋 (stale DOM reference)
- **利앹긽**: ?쒖옣???섏씠吏???좊━ ?덉쭏 ?먮퀎????긽 "?쒖옣???곗씠??濡쒕뵫 ?湲?以?.." ?쒖떆. `updateMarketPulse()` ?쒖옣???멸렇癒쇳듃????긽 "?? ?쒖떆.
- **洹쇰낯 ?먯씤**: `bb-5sma-val`/`bb-20sma-val`/`bb-50sma-val` DOM ID媛 HTML???놁쓬 (v38.9?먯꽌 ?⑥닔 ?묒꽦 ??DOM 援ъ“? 遺덉씪移?. `bp-5sma-pct`??v42.1?먯꽌 議댁옱?섏? ?딅뒗 ID 李몄“.
- **?섏젙**: (1) `initBreadthPage()`?먯꽌 `window._breadth5`/`window._breadth50` ?꾩뿭 罹먯떛 異붽? (2) `updateRallyQualityVerdict()`? ?쒓렇??諛뷀??꾨줈?몄뒪媛 ?꾩뿭 蹂?섏뿉???쎈룄濡??섏젙 (3) `updateMarketPulse()`??`window._breadth200` 吏곸젒 ?쎄린濡??섏젙.
- **?덈갑**: P43 ??DOM ID 李몄“ ?좉퇋 異붽? ??`grep 'id="?대떦ID"' index.html`濡?HTML???ㅼ옱 ?뺤씤 ?꾩닔. getElementById 寃곌낵媛 ??긽 null?대㈃ stale reference.

### REFACTOR: 由ъ뒪??紐⑤땲??以묐났 吏???뺣━ (13????)
- **violated_rule**: ?좉퇋 (?뺣낫 以묐났)
- **利앹긽**: ?쒓렇???섏씠吏 由ъ뒪??紐⑤땲?곗뿉 VIX, DXY, HYG, TNX, F&G媛 ?ㅻ깄移대뱶/?뉻PI/FX梨꾧텒怨?以묐났 ?쒖떆 ???뺣낫 怨쇰???
- **?섏젙**: VIX/DXY(display:none), HYG/TNX/F&G(hidden div)?쇰줈 ?④?. RSP/SPY瑜?row1?쇰줈 ?대룞. JS getElementById??DOM? hidden?쇰줈 ?좎??섏뿬 ?고????먮윭 諛⑹?.
- **?덈갑**: P42 ??吏??異붽? ???숈씪 ?곗씠?곌? ?ㅻⅨ ?뱀뀡???대? ?쒖떆?섎뒗吏 ?뺤씤. 以묐났 ???쒖そ留??쒖떆?섍퀬 ?щ줈?ㅻ쭅?щ줈 ?곌껐.

---

## [2026-04-06] v41.7 -- ?꾩닔 QA: FX 諛섏쟾 ?꾨씫 + KNOWN_TICKERS ?좎떎 + insight-box 援먯감 (3嫄?

### BUG-1: CADUSD=X/CHFUSD=X FX_INVERTED ?꾨씫 ??PriceStore 300+ 寃쎄퀬 (HIGH)
- **violated_rule**: ?좉퇋 (?곗씠???뺥빀??
- **利앹긽**: 肄섏넄??PriceStore 50% jump 寃쎄퀬 300嫄?. Yahoo媛 USD/CAD(1.39) 諛섑솚 vs open.er-api媛 CAD/USD(0.72) 諛섑솚 ??媛?異⑸룎.
- **洹쇰낯 ?먯씤**: `FX_INVERTED` 諛곗뿴??`CADUSD=X`, `CHFUSD=X`媛 ?꾨씫?섏뼱 open.er-api 寃쎈줈?먯꽌 諛섏쟾 泥섎━ ???? ?숈떆??Yahoo?먯꽌??媛숈? ?щ낵 fetch?섏뿬 諛섏쟾 ????媛믪씠 PriceStore??癒쇱? ?깅줉.
- **?섏젙**: (1) FX_INVERTED??CADUSD=X, CHFUSD=X 異붽? (2) Yahoo fetch 紐⑸줉怨?chart batch?먯꽌 CADUSD=X, CHFUSD=X ?쒓굅 ??UI???쒖떆?섏? ?딅뒗 ?щ낵?대?濡?FX API ?⑥씪 寃쎈줈留??좎?.
- **?덈갑**: P29 ??FX ?щ낵 異붽? ??諛섎뱶??3寃쎈줈(Yahoo, open.er-api, chart batch) ?쇨????뺤씤. FX_INVERTED? ?쒖떆 ?щ?(移대뱶 UI) ?숆린 ?먭?.

### BUG-2: KNOWN_TICKERS Set ?앹꽦????20媛??듭떖 ?щ낵 ?좎떎 (CRITICAL)
- **violated_rule**: ?좉퇋 (JS ?몄뼱 ?⑥젙)
- **利앹긽**: ^GSPC, ^VIX, BTC-USD ??20媛?二쇱슂 吏???뷀샇?뷀룓媛 KNOWN_TICKERS?먯꽌 ?꾨씫 ???ㅽ겕由щ꼫 ?꾪꽣留?諛?醫낅ぉ 寃利??ㅽ뙣 媛??
- **洹쇰낯 ?먯씤**: `new Set([...items], extra1, extra2)` ??Set ?앹꽦?먮뒗 泥?踰덉㎏ ?몄옄(iterable)留??ъ슜, ?섎㉧吏 臾댁떆. `]` ?ㅼ뿉 20媛???ぉ???꾩튂?섏뿬 議곗슜???좎떎.
- **?섏젙**: 20媛???ぉ??`]` ?덉쑝濡??대룞 + 以묐났 4媛?BIIB, CLSK, MP, QBTS) ?쒓굅 ??795媛??좊땲??
- **?덈갑**: P30 ?????諛곗뿴/Set 由ы꽣???섏젙 ???ル뒗 愿꾪샇 ?꾩튂 諛섎뱶???뺤씤. `KNOWN_TICKERS.size` 濡쒓렇濡?湲곕? ?ш린 寃利?

### BUG-3: insight-box ?띿뒪??4?섏씠吏 援먯감 諛곗튂 (MEDIUM)
- **violated_rule**: ?좉퇋 (肄섑뀗痢??뺥빀??
- **利앹긽**: market-news??glossary ?띿뒪?? options??market-news ?띿뒪?? theme-detail??options ?띿뒪?? ticker??education ?띿뒪?멸? ?쒖떆??
- **洹쇰낯 ?먯씤**: ???insight-box 異붽? ??蹂듭궗-遺숈뿬?ｊ린 怨쇱젙?먯꽌 ?띿뒪?멸? 援먯감 諛곗튂??
- **?섏젙**: 4媛??섏씠吏 insight-box ?띿뒪?몃? 媛??섏씠吏 留λ씫??留욊쾶 援먯젙.
- **?덈갑**: P31 ?????諛섎났 ?붿냼 異붽? ??媛??몄뒪?댁뒪??肄섑뀗痢좉? ?대떦 ?섏씠吏? ?쇱튂?섎뒗吏 媛쒕퀎 ?뺤씤 ?꾩닔.

---

## [2026-04-06] v41.4~v41.6 -- ?꾩닔 S湲?媛먯궗: 蹂댁븞/?묎렐???덉젙??Dead Code (?ㅼ쁺??

### BUG-1: XSS ???ъ슜???낅젰 ticker媛 innerHTML??鍮꾩씠?ㅼ??댄봽 ?쎌엯 (CRITICAL)
- **violated_rule**: ?좉퇋 (蹂댁븞)
- **利앹긽**: `analyzeTickerDeep`/`analyzeKrTickerDeep`?먯꽌 ?ъ슜?먭? ?낅젰??ticker媛 `escHtml()` ?놁씠 innerHTML???쎌엯 -- XSS 怨듦꺽 踰≫꽣.
- **洹쇰낯 ?먯씤**: ?ъ슜???낅젰???좊ː?섍퀬 吏곸젒 DOM???쎌엯. `updateFail`/`updateProgress`/`showDataError`/`updateDataStatusError`???숈씪 ?⑦꽩.
- **?섏젙**: 紐⑤뱺 ?ъ슜???몃? ?곗씠??innerHTML 寃쎈줈??`escHtml()` ?곸슜 (6怨?.
- **?덈갑**: P26 ??innerHTML???몃? ?곗씠???쎌엯 ??諛섎뱶??`escHtml()` ?섑븨. 肄붾뱶 由щ럭 ??`innerHTML =` + 蹂??議고빀??grep ??곸쑝濡?異붽?.

### BUG-2: 醫鍮???대㉧ ??signal ?섏씠吏 ?댄깉 ??sigRefreshTimer 誘명빐??(HIGH)
- **violated_rule**: R9 (Dead Page 諛⑹?)
- **利앹긽**: signal ?섏씠吏?먯꽌 ?ㅻⅨ ?섏씠吏濡??대룞?대룄 `sigRefreshTimer`? `window._refreshSignalInterval`??怨꾩냽 ?ㅽ뻾 -- 硫붾え由??꾩닔 + 遺덊븘?뷀븳 API ?몄텧.
- **洹쇰낯 ?먯씤**: `destroyPageCharts('signal')` 釉붾줉???대떦 ??대㉧ ?댁젣 肄붾뱶 ?꾨씫.
- **?섏젙**: signal destroy 釉붾줉??`clearInterval(sigRefreshTimer)` + `clearInterval(window._refreshSignalInterval)` 異붽?.
- **?덈갑**: P27 ??`setInterval` 異붽? ??諛섎뱶??`destroyPageCharts`?????`clearInterval` 異붽?. ?섏씠吏蹂???대㉧ 紐⑸줉 愿由?

### BUG-3: R15 ?꾨컲 ??Yahoo/CoinGecko ?쒖꽭 ?섏쭛?먯꽌 `_pct || 0` ?⑦꽩 3嫄?(HIGH)
- **violated_rule**: R15
- **利앹긽**: ?ㅼ젣 0% 蹂??醫낅ぉ??null(誘몄닔??怨?援щ텇 遺덇? -- ?몃젅?대뵫 ?ㅼ퐫?? ?쒖옣 遺꾩쐞湲??쒓끝.
- **洹쇰낯 ?먯씤**: v40.6?먯꽌 ????섏젙?덉쑝??fetchLiveQuotes ??Yahoo/pre-post/CoinGecko 3怨??꾨씫.
- **?섏젙**: `_pct || 0` -> `_pct != null ? _pct : null`.
- **?덈갑**: P25 ?ш컯?? `|| 0` grep 二쇨린???ㅽ뻾.

### BUG-4: R17 ?꾨컲 ??MACRO_KW??'QE'/'QT' 2湲???ㅼ썙??(MEDIUM)
- **violated_rule**: R17
- **利앹긽**: "QE" ?ы븿 鍮꾧툑???띿뒪?몄뿉??留ㅽ겕濡??댁뒪濡??ㅻ텇瑜?媛??
- **洹쇰낯 ?먯씤**: ?쎌뼱瑜?洹몃?濡??ㅼ썙?쒖뿉 異붽?. full form? ?대? 議댁옱.
- **?섏젙**: MACRO_KW?먯꽌 'QE','QT' ?쒓굅.
- **?덈갑**: R17 -- 3湲??誘몃쭔 ?⑤룆 ?ㅼ썙??異붽? 湲덉?.

### BUG-5: fundamental ?섏씠吏 ?ъ쭊??Dead Page ??_fundInitDone 誘몃━??(MEDIUM)
- **violated_rule**: R9
- **利앹긽**: fundamental ?섏씠吏 諛⑸Ц -> ?ㅻⅨ ?섏씠吏 -> ?ㅼ떆 fundamental ??鍮??섏씠吏.
- **洹쇰낯 ?먯씤**: `destroyPageCharts` fundamental 釉붾줉??`_fundInitDone = false` 由ъ뀑 ?꾨씫.
- **?섏젙**: fundamental destroy 釉붾줉??`_fundInitDone = false` 異붽?.
- **?덈갑**: P28 ??init 媛???⑦꽩 ?ъ슜 ??諛섎뱶??destroy?먯꽌 ?뚮옒洹?由ъ뀑. R9 ?ы솗??

### CLEANUP: Dead Code ????쒓굅 (~400以?
- 19媛?誘몄궗???⑥닔 + 6媛?誘몄궗??蹂??+ 1媛?以묐났 IIFE ?쒓굅.
- ?꾩닔 grep?쇰줈 ?몄텧泥?0嫄??뺤씤 ????젣.
- **?덈갑**: 湲곕뒫 ?쒓굅 ??愿???⑥닔/蹂?섎룄 ?④퍡 ?뺣━. 二쇨린??dead code ?ㅼ틪.

---

## [2026-04-05] v41.1 -- ?덈갑 ?섏젙: ?좊땲踰꾩꽕 ??됲꽣 ?ㅽ겕濡ㅻ컮 (1嫄?

### BUG-1: `*` ?좊땲踰꾩꽕 ??됲꽣??scrollbar-width ?곸슜 (PREVENTIVE)
- **violated_rule**: ?좉퇋 (CSS ?깅뒫)
- **利앹긽**: 吏곸젒???쒓컖 踰꾧렇 ?놁쑝?? `* { scrollbar-width: thin; }` 洹쒖튃??DOM ?꾩껜 37,000+ ?붿냼???곸슜?섏뼱 ?좎옱???뚮뜑留??깅뒫 ???
- **洹쇰낯 ?먯씤**: Firefox ?ㅽ겕濡ㅻ컮 ?대갚 異붽? ??`*` ??됲꽣 ?ъ슜. `scrollbar-width`???ㅽ겕濡?媛???붿냼?먮쭔 ?좏슚?섎?濡?`html`濡?異⑸텇.
- **?섏젙**: `* { scrollbar-width: thin; ... }` -> `html { scrollbar-width: thin; ... }`
- **?덈갑**: CSS ?꾨줈?쇳떚 異붽? ??理쒖냼 踰붿쐞 ??됲꽣 ?ъ슜. `*` ??됲꽣??由ъ뀑(box-sizing) ???ъ슜 湲덉?.

---

## [2026-04-05] v40.6 ???꾩닔 QA: TDZ ?щ옒??+ ?덊떚?⑦꽩 + ?곗씠???뺥빀??(20嫄??섏젙)

### BUG-1: oilPrice TDZ ReferenceError (CRITICAL)
- **violated_rule**: ?좉퇋 (JS TDZ)
- **利앹긽**: `computeTradingScore()` ?몄텧 ??留ㅻ쾲 `ReferenceError: Cannot access 'oilPrice' before initialization` ??16+ 肄섏넄 ?먮윭/濡쒕뱶.
- **洹쇰낯 ?먯씤**: `const oilPrice = _ldSafe('CL=F','price') || 0`??L30797???좎뼵?섏뿀吏留?L30768?먯꽌 癒쇱? 李몄“ (TDZ).
- **?섏젙**: ?좎뼵??L30694 (`const tnx` 吏곹썑)濡??대룞, 湲곗〈 ?꾩튂??以묐났 ?좎뼵 ??젣.
- **?덈갑**: `const` 蹂?섎뒗 諛섎뱶??泥??ъ슜 ?꾩뿉 ?좎뼵. `computeTradingScore()` ?섏젙 ??蹂???좎뼵 ?쒖꽌 ?뺤씤.

### BUG-2: .pct||0 ?덊떚?⑦꽩 ?붿〈 9嫄?+ abv50||48 3嫄?(R15 ?꾨컲)
- **violated_rule**: R15
- **利앹긽**: null(誘몄닔?? ?곗씠?곌? 0%(蹂댄빀)?쇰줈 泥섎━?섏뼱 M7 由щ뜑??移댁슫?? ?뱁꽣 遺꾩꽍, XLF/Gold ?쒓렇?? ?몃젅?대뵫 ?ㅼ퐫???쒓끝.
- **洹쇰낯 ?먯씤**: v38.4/v39.2?먯꽌 ????섏젙?덉쑝???쇰? ?꾨씫 + `breadthData.abv50||48` ?숈씪 ?⑦꽩.
- **?섏젙**: ?꾩닔 grep ??9嫄?`d.pct != null ? d.pct : 0` + 3嫄?`abv50 != null ? abv50 : 28`.
- **?덈갑**: P25 洹쒖튃 ?ы솗?? `|| ?レ옄` ?대갚? 0???좏슚媛믪씤 紐⑤뱺 怨녹뿉???ъ슜 湲덉?.

### BUG-3: ?곗씠???댁쨷 ?쒖떆 遺덉씪移?6嫄?
- **利앹긽**: ?숈씪 ?곗씠?곌? home sidebar vs ?꾩슜 ?섏씠吏?먯꽌 ?ㅻⅨ 媛??쒖떆 (釉뚮젅?쒖벐 5/20/50SMA, AAII ?좎쭨, VKOSPI, ?꾩씪醫낃? ?좎쭨).
- **洹쇰낯 ?먯씤**: ?섎뱶肄붾뵫 ?곗씠?곌? ?щ윭 怨녹뿉 ?곗옱?섎ŉ, ?낅뜲?댄듃 ???쇰?留?媛깆떊.
- **?섏젙**: 紐⑤뱺 ?댁쨷 ?쒖떆 吏?먯쓣 ?숈씪 媛믪쑝濡??숆린??
- **?덈갑**: ?곗씠???낅뜲?댄듃 ??grep?쇰줈 ?대떦 媛믪씠 ?섑??섎뒗 紐⑤뱺 ?꾩튂瑜??뺤씤.

### BUG-4: KR_STOCK_DB ?덉쭏 ?댁뒋 4嫄?
- 鍮꾩긽??醫낅ぉ(?섏븻?쇱퐫?ㅻ찓?? ?ы븿, themes:[] 怨좎븘 ?뷀듃由? ?섎せ??mcap/price, 遺?곸젅???뚮쭏 遺꾨쪟.
- **?섏젙**: 鍮꾩긽???쒓굅, construction ?뚮쭏 遺???뱀뀡 ?대룞, mcap/price 理쒖떊?? 怨쇱엵 ?뚮쭏 ?쒓굅.

---

## [2026-04-03] v39.2 ???꾩닔 QA + ?댁뒪 ?뚯씠?꾨씪??+ ???섏씠吏 ?ъ링 媛쒖꽑: 12? 臾몄젣 諛쒓껄 諛??섏젙

### BUG-1: P25 `.pct || 0` ?⑦꽩 25怨??щ컻 (CRITICAL)
- **violated_rule**: R15
- **利앹긽**: ?곗씠??誘몄닔??null) 醫낅ぉ??UI??"+0.00%"濡??쒖떆. AI 遺꾩꽍(CHAT_CONTEXT)?먮룄 "0.00%"媛 二쇱엯?섏뼱 遺꾩꽍 ?쒓끝.
- **洹쇰낯 ?먯씤**: v38.4?먯꽌 65怨녹쓣 ?섏젙?덉쑝???댄썑 肄붾뱶?먯꽌 ?숈씪 ?⑦꽩???ъ궫?낅맖. ?뱁엳 22101(AI遺꾩꽍), 23684(鍮꾧탳?곗씠??, 25102(?섏쭛), 32705(釉뚮젅?쒖뒪 移댁슫??媛 ?꾪뿕.
- **?섏젙**: 25怨??꾩닔 ??`d.pct != null ? d.pct : 0` ?먮뒗 `d.pct != null ? d.pct : null` ?⑦꽩?쇰줈 ?꾪솚.
- **?덈갑 洹쒖튃 P25 媛뺥솕**: ?좉퇋 肄붾뱶 ?묒꽦 ??`.pct || 0` ?⑦꽩 ?덈? ?ъ슜 湲덉?. grep?쇰줈 ?뺢린 泥댄겕.

### BUG-2: popstate ?몃뱾?ъ뿉??`aio:pageShown` ?대깽??誘몃컻??(CRITICAL)
- **violated_rule**: R9
- **利앹긽**: 釉뚮씪?곗? ?ㅻ줈媛湲???screener/portfolio/korea/fundamental/themes/options ??12媛??섏씠吏媛 珥덇린?붾릺吏 ?딆쓬 (鍮??붾㈃/李⑦듃 誘몃젋?붾쭅).
- **洹쇰낯 ?먯씤**: `showPage()`??`aio:pageShown` ?대깽?몃? 諛쒖넚?섏?留? popstate ?몃뱾?ъ뿉?쒕뒗 吏곸젒 DOM 議곗옉留??섍퀬 ?대깽?몃? 諛쒖넚?섏? ?딆븯?? 12媛??섏씠吏媛 ???대깽?몄뿉 ?섏〈?섏뿬 lazy-init ?섑뻾.
- **?섏젙**: popstate ?몃뱾?ъ뿉 `document.dispatchEvent(new CustomEvent('aio:pageShown', { detail: id }))` 異붽?.
- **?덈갑 洹쒖튃 P31**: popstate ?몃뱾???섏젙 ??諛섎뱶??showPage()? ?숈씪???대깽??諛쒖넚 ?뺤씤.

### BUG-3: TECH_KW??3湲??誘몃쭔 ?ㅼ썙??7媛??щ컻 (P28)
- **violated_rule**: R17
- **利앹긽**: TECH_KW??`'V'`(1??, `'EV'`, `'MA'`, `'SQ'`, `'ZS'`, `'PL'`, `'1X'`(媛?2?? ??鍮꾧툑???띿뒪???ㅽ깘 ?꾪뿕.
- **洹쇰낯 ?먯씤**: 醫낅ぉ ??ㅼ엫 ?놁뿉 ?곗빱 ?쎌옄瑜??섏뿴?섎뒗 ?⑦꽩 (`'Visa','V','Mastercard','MA'`). R17 洹쒖튃? ?덉뿀?쇰굹 湲곗〈 肄붾뱶 誘몄젙由?
- **?섏젙**: V/MA/SQ/ZS/PL ?쒓굅(??ㅼ엫 ?좎?), EV??electric vehicle', 1X??1X Technologies'.
- **?덈갑 洹쒖튃 P28 媛뺥솕**: TECH_KW/MED_KW 蹂寃???`grep -oP "'[^']{1,2}'" index.html` ?ㅽ뻾?섏뿬 2湲???댄븯 ?뺤씤.

### BUG-4: native `confirm()` 6怨??붿〈
- **利앹긽**: 紐⑤컮?쇱뿉??釉뚮씪?곗? 湲곕낯 confirm ?ㅼ씠?쇰줈洹??쒖떆 ??UX 遺덉씪移?
- **洹쇰낯 ?먯씤**: `showConfirmModal()` 而ㅼ뒪? 紐⑤떖???꾩엯(v38.3)?섏뿀?쇰굹 湲곗〈 6怨?誘몄쟾??
- **?섏젙**: 20192(LLM?쒕룄), 20971(寃뚯떆?먯궘??, 21212(PIN珥덇린??, 21246(?ы듃?대━?ㅼ쨷蹂?, 21454(CSV?꾪룷??, 24934(梨꾪똿??젣) ??紐⑤몢 `showConfirmModal()` 肄쒕갚 諛⑹떇?쇰줈 ?꾪솚.
- **?덈갑 洹쒖튃 P32**: `confirm(` ?⑦꽩 ?좉퇋 ?ъ슜 湲덉?. 諛섎뱶??`showConfirmModal()` ?ъ슜.

### BUG-5: ARM ?곗빱 ?댁뒪 ?ㅽ깘 (CRITICAL -- ?ъ슜??蹂닿퀬)
- **violated_rule**: R16, R17
- **利앹긽**: 泥좉컯 ?댁뒪 ??ARM怨?臾닿???湲곗궗??$ARM ?곗빱媛 ?쒖떆??
- **洹쇰낯 ?먯씤 2媛吏**:
  1. KR_TICKER_MAP??`'arm': 'ARM'` ??`text.toLowerCase().includes('arm')` = "arms", "armed" ??紐⑤뱺 ?띿뒪?몄뿉??留ㅼ묶.
  2. `_isTickerContextValid`??finWords??`'market'`, `'trade'` ??愿묐쾾???⑥뼱 ??嫄곗쓽 紐⑤뱺 ?댁뒪媛 臾몃㎘ 寃利??듦낵.
- **?섏젙**:
  1. KR_TICKER_MAP: `'arm'` ??`'arm holdings'`
  2. `_TICKER_WORD_OVERLAP` Set ?좉퇋 ??ARM/ON/IT/ALL/RUN ???곷떒??寃뱀묠 ?곗빱??`$ARM` ?먮뒗 `(ARM)` ?뺥깭留??덉슜
  3. finWords?먯꽌 愿묐쾾???⑥뼱(market/trade/rise/fall) ?쒓굅 ??湲덉쑖 ?꾩슜 ?⑥뼱留??좎?
- **?덈갑 洹쒖튃 P33**: ?곸뼱 ?쇰컲 ?⑥뼱? 寃뱀튂???곗빱(3湲???댄븯)??`_TICKER_WORD_OVERLAP`???깅줉. KR_TICKER_MAP???곷Ц ?뚮Ц??3湲???댄븯 ??異붽? ??`includes()` ?ㅽ깘 寃利??꾩닔.

### BUG-6: ?대┃踰좎씠???ъ옄 ?ㅽ뙵 ?댁뒪 ?좎엯 (?ъ슜??蹂닿퀬)
- **violated_rule**: R14
- **利앹긽**: "??二쇱떇留??щ㈃ 10諛? 媛숈? ??덉쭏 湲곗궗媛 ?댁뒪 ?쇰뱶???쒖떆??
- **洹쇰낯 ?먯씤**: NEWS_BLACKLIST_KW???ъ옄 ?ㅽ뙵 ?⑦꽩 誘명룷?? scoreItem???대┃踰좎씠??媛먯? 濡쒖쭅 ?놁쓬.
- **?섏젙**:
  1. `_CLICKBAIT_RE` ?뺢퇋????60+ ?⑦꽩 利됱떆 李⑤떒(score=0)
  2. NEWS_BLACKLIST_KW???쒓뎅???ъ옄 ?ㅽ뙵 40+媛?+ ?곷Ц 30+媛?異붽?
- **?덈갑 洹쒖튃 P34**: ?댁뒪 ?덉쭏 ?댁뒋 蹂닿퀬 ???뚭굅踰??곸슜 ??釉붾옓由ъ뒪???ㅼ썙??異붽?媛 ?덉슜 紐⑸줉蹂대떎 ?④낵??

### BUG-7: fetch `{timeout:8000}` 鍮꾪몴以 ?듭뀡 (WARNING)
- **利앹긽**: Yahoo Chart fetch?먯꽌 `{timeout:8000}` ?듭뀡??臾댁떆?섏뼱 臾댄븳 ?湲?媛??
- **洹쇰낯 ?먯씤**: `fetch()` Web API ?쒖???`timeout` ?듭뀡???놁쓬. 肄붾뱶 ?묒꽦?먭? 鍮꾪몴以 ?듭뀡???ъ슜.
- **?섏젙**: `AbortController` + `setTimeout` 8珥덈줈 援먯껜.
- **?덈갑 洹쒖튃 P35**: ?몃? fetch????꾩븘???곸슜 ??諛섎뱶??`AbortController` ?먮뒗 `withTimeout()` ?ъ슜. `{timeout:N}` ?듭뀡? fetch ?쒖? ?꾨떂.

### BUG-8: extractTickers RegExp 留??몄텧 ?ъ깮??(?깅뒫)
- **利앹긽**: ?댁뒪 80媛?횞 800+ ?곗빱 = 64,000+ RegExp 媛앹껜 留ㅻ쾲 ?ъ깮??
- **洹쇰낯 ?먯씤**: `KNOWN_TICKERS.forEach()` ?대??먯꽌 `new RegExp(...)` ?몄텧.
- **?섏젙**: `_tickerRegexCache` + `_getTickerRegex()` ?꾩엯 ??1??而댄뙆????罹먯떆.
- **?덈갑 洹쒖튃 P36**: 諛섎났臾??대??먯꽌 `new RegExp()` 湲덉?. ?⑥닔 諛뽰뿉??罹먯떆?섍굅???꾩뿭 蹂?섏뿉 ???

### BUG-9: KNOWN_TICKERS??SUB_THEMES 27媛?醫낅ぉ ?꾨씫
- **利앹긽**: ?뚮쭏 遺꾩꽍 ?섏씠吏???쒖떆?섎뒗 醫낅ぉ(S, UAL, CCI, PLUG, DKNG ?????댁뒪 ?곗빱 留ㅼ묶?먯꽌 ?쒖쇅.
- **洹쇰낯 ?먯씤**: SUB_THEMES??醫낅ぉ??異붽??섎㈃??KNOWN_TICKERS?먮뒗 異붽??섏? ?딆쓬.
- **?섏젙**: 27媛?醫낅ぉ ?쇨큵 異붽?.
- **?덈갑 洹쒖튃 P37**: SUB_THEMES????醫낅ぉ 異붽? ??諛섎뱶??KNOWN_TICKERS?먮룄 ?ы븿 ?뺤씤.

### BUG-10: _context/CLAUDE.md 踰꾩쟾 誘몃룞湲고솕 (WARNING)
- **利앹긽**: index.html? v39.1?몃뜲 _context/CLAUDE.md??v39.0?쇰줈 誘몃컲??
- **洹쇰낯 ?먯씤**: 踰꾩쟾 ?숆린??6怨?以?`_context/CLAUDE.md`媛 猷⑦듃 `CLAUDE.md`? 蹂꾨룄 ?뚯씪?꾩뿉??媛숈씠 ?낅뜲?댄듃?섏? ?딆쓬.
- **?섏젙**: v39.2濡??숆린??
- **?덈갑 洹쒖튃**: R1??6怨녹뿉 ?대? ?ы븿. ?ㅽ뻾 ??grep 紐낅졊 諛섎뱶???묒そ CLAUDE.md ?뺤씤.

### BUG-11: console.log 72媛??꾨줈?뺤뀡 ?붿〈 (肄붾뱶 ?덉쭏)
- **利앹긽**: 釉뚮씪?곗? 肄섏넄??`[AIO v20]`, `[AIO v21]` ???붾쾭洹?濡쒓렇 ?곸떆 異쒕젰.
- **洹쇰낯 ?먯씤**: 媛쒕컻 以??쎌엯??console.log媛 ?꾨줈?뺤뀡???쒓굅?섏? ?딆쓬.
- **?섏젙**: ?꾨줈?뺤뀡 console.log 臾댁쓬 媛????`[AIO` ?묐몢??濡쒓렇瑜?`?debug` ?먮뒗 `localStorage.aio_debug=1` ?쒖뿉留?異쒕젰.
- **?덈갑 洹쒖튃 P38**: ?좉퇋 console.log 異붽? ??`[AIO` ?묐몢???ъ슜. ?꾨줈?뺤뀡?먯꽌???먮룞 臾댁쓬 泥섎━??

### BUG-12: computeTradingScore 援먯감蹂??誘몃컲??(媛쒖꽑)
- **利앹긽**: VIX 25+ & DXY 107+ & TNX 4.5+ & ?좉? $100+ ?숈떆 ?낇솕?먮룄 ?ㅼ퐫?닿? 異⑸텇????븘吏吏 ?딆쓬. 異붿꽭???쒖옣??넃(?뚯닔 二쇰룄 ?꾪뿕 ?곸듅)??寃쎄퀬 ?놁쓬.
- **洹쇰낯 ?먯씤**: 5? 而댄룷?뚰듃媛 ?낅┰?곸쑝濡?怨꾩궛?섏뼱 援먯감 ?곹뼢 誘몃컲??
- **?섏젙**: (1) 3媛? 留ㅽ겕濡?由ъ뒪???숈떆 ?낇솕 = ?쇳럺?몄뒪???⑤꼸??-10p) (2) 異붿꽭-?쒖옣???ㅼ씠踰꾩쟾???먮룞 媛먯?.
- **?덈갑 洹쒖튃 P39**: ?ㅼ퐫???뚭퀬由ъ쬁 蹂寃???諛섎뱶??"援먯감蹂?? ?곹뼢 寃?? ?⑤룆 蹂??蹂댁젙留뚯쑝濡쒕뒗 蹂듯빀 由ъ뒪??諛섏쁺 遺덇?.

---

## [2026-04-04] v39.3~v40.4 ???ъ링 媛쒖꽑 ?몄뀡: 10? 臾몄젣 諛쒓껄 諛??섏젙

### 臾몄젣 1: ?쒓뎅 ?뚮쭏 HTML-JS ?곗씠??遺덉씪移?(v40.0)
- **利앹긽**: KR_THEME_MAP??醫낅ぉ 鍮꾩쨷???섏젙?대룄 HTML 移대뱶??pill-wt 鍮꾩쨷? ?쏅궇 媛?洹몃?濡??쒖떆. 23媛?以?3媛쒕쭔 ?쇱튂, 20媛?遺덉씪移?
- **洹쇰낯 ?먯씤**: 醫낅ぉ ?곗씠?곌? KR_THEME_MAP(JS)怨?HTML 移대뱶(?뺤쟻) 2怨녹뿉 以묐났 愿由? ?쒖そ留??섏젙?섎㈃ ?ㅻⅨ 履쎌씠 ?닿툔??
- **?섏젙**: ?뺤쟻 HTML 移대뱶 390以???젣 ??`renderKrThemeCardsFromMap()` ?숈쟻 ?앹꽦?쇰줈 ?꾪솚. KR_THEME_MAP??Single Source of Truth.
- **?덈갑 洹쒖튃 P31**: ?곗씠?곗? UI媛 2怨녹뿉??愿由щ릺硫?諛섎뱶???쒖そ???쒓굅?섍퀬 ?⑥씪 ?먯쿇(Single Source of Truth)?쇰줈 ?듯빀. ?곗씠??蹂寃???UI ?먮룞 諛섏쁺 蹂댁옣.

### 臾몄젣 2: ?먮굹臾?035200) 鍮꾩긽??二쇱떇 異붽? ?ㅻ쪟 (v39.9)
- **利앹긽**: crypto ?뚮쭏???먮굹臾??낅퉬?? 異붽? ??鍮꾩긽??二쇱떇?대씪 Yahoo Finance?먯꽌 ?쒖꽭 ?섏떊 遺덇?.
- **洹쇰낯 ?먯씤**: 醫낅ぉ 異붽? ???곸옣 ?щ? ?뺤씤 ?덉감 ?놁쓬. "?쒓뎅 1??嫄곕옒???쇰뒗 ?ъ뾽??以묒슂?깅쭔 蹂닿퀬 異붽?.
- **?섏젙**: ?먮굹臾??쒓굅, ?곸옣 醫낅ぉ留뚯쑝濡?crypto ?뚮쭏 ?ш뎄??
- **?덈갑 洹쒖튃 P32**: 醫낅ぉ 異붽? ??諛섎뱶???곸옣 ?щ? ?뺤씤 (KOSPI .KS / KOSDAQ .KQ). 鍮꾩긽?Β룹옣??二쇱떇 異붽? 湲덉?.

### 臾몄젣 3: robot ?뚮쭏 ?꾨?李?以묐났 (v39.9)
- **利앹긽**: ?꾨?李?005380)媛 auto ?뚮쭏(28%)? robot ?뚮쭏(12%)???숈떆 議댁옱. ???뚮쭏 ?숈떆 蹂댁쑀 ???섎룄移??딆? 40% 吏묒쨷.
- **洹쇰낯 ?먯씤**: 蹂댁뒪?대떎?대궡誘뱀뒪(?꾨?李??먰쉶??瑜?robot ?뚮쭏??諛섏쁺?섎젮??紐⑦쉶?щ? 吏곸젒 ?ｌ쓬.
- **?섏젙**: robot?먯꽌 ?꾨?李??쒓굅. auto?먯꽌 "蹂댁뒪?대떎?대궡誘뱀뒪" 而ㅻ쾭.
- **?덈갑 洹쒖튃 P33**: ?숈씪 醫낅ぉ???뚮쭏 媛?以묐났 諛곗튂 湲덉?. ?먰쉶?щ뒗 紐⑦쉶???뚮쭏?먯꽌 而ㅻ쾭.

### 臾몄젣 4: ?뚮쭏 醫낅ぉ 鍮꾩쨷 ?꾩쓽 諛곕텇 (v39.9)
- **利앹긽**: 諛섎룄泥??쇱꽦+?섏씠?됱뒪 = 56%濡??ㅼ젙?먯?留??ㅼ젣 ?쒖킑 鍮꾩쨷? 70%+. 濡쒕큸 ?뚮쭏?먯꽌 ??μ＜(?덉씤蹂댁슦)? ?꾨컻二?鍮꾩쨷??洹좊벑.
- **洹쇰낯 ?먯씤**: 鍮꾩쨷 ?ㅼ젙 ???쒖킑/?낃낵??ETF 援ъ꽦??泥닿퀎?곸쑝濡?李몄“?섏? ?딄퀬 媛먯쑝濡?諛곕텇.
- **?섏젙**: 23媛??뚮쭏 ?꾩껜 鍮꾩쨷 ?ъ“?????쒖킑, ?낃낵?? ??μ＜, ETF 援ъ꽦 紐⑤몢 諛섏쁺.
- **?덈갑 洹쒖튃 P34**: ?뚮쭏 醫낅ぉ 鍮꾩쨷? (1) ?쒖킑 鍮꾨? (2) ?낃낵??援ъ“ 諛섏쁺 (3) ??μ＜/二쇰룄二?鍮꾩쨷 ?곹뼢 (4) ETF 援ъ꽦 ?щ줈?ㅼ껜?? ?꾩쓽 諛곕텇 湲덉?.

### 臾몄젣 5: ?ы듃?대━???꾨꽋 李⑦듃 ?섎뱶肄붾뵫 紐⑥쓽 ?곗씠??(v39.7)
- **利앹긽**: ?ы듃?대━???꾨꽋????긽 "50% Cash, 30% Balanced, 12% Growth, 8% Alt" 怨좎젙 ?쒖떆. ?ㅼ젣 蹂댁쑀 醫낅ぉ怨?臾닿?.
- **洹쇰낯 ?먯씤**: `drawPortfolioDonut()`???뺤쟻 諛곗뿴濡?洹몃━?꾨줉 援ы쁽. ?ㅼ젣 ?ъ????곗씠???곌껐 ????
- **?섏젙**: `drawPositionDonut()` ?좉퇋 ???ㅼ젣 ?ъ???湲곕컲 ?숈쟻 ?꾨꽋 + 踰붾? + ?뱁꽣 釉뚮젅?댄겕?ㅼ슫 + ?꾧툑 ?ъ???
- **?덈갑 洹쒖튃 P35**: ?곕え/紐⑥쓽 ?곗씠?곕뒗 諛섎뱶??`[DEMO]` ?쇰꺼 ?쒖떆?섍굅?? ?ㅼ젣 ?곗씠???곌껐???꾨즺?섎㈃ ?쒓굅. ?ъ슜?먯뿉寃??ㅼ젣 ?곗씠?곕줈 ?ㅼ씤?섎㈃ ????

### 臾몄젣 6: ?듭떖 ?몄궗?댄듃 諛??뺣낫 怨쇰???(v40.1)
- **利앹긽**: ???섏씠吏 ?곷떒 ?몄궗?댄듃 諛붽? 3~5以?湲??ㅻ챸?몃뜲, ?묓엺 ?곹깭?먯꽌 "..."濡??섎젮 ?쎌쓣 ???놁쓬. 珥덈낫?먭? ?대뼡 ?뺣낫瑜?遊먯빞 ?섎뒗吏 紐⑤쫫.
- **洹쇰낯 ?먯씤**: ?몄궗?댄듃 諛붽? "援먯쑁???곸꽭 ?ㅻ챸"怨?"?듭떖 ??以??붿빟" ??븷???숈떆???섎젮怨???
- **?섏젙**: 21媛??몄궗?댄듃 諛??꾨? ?듭떖 ??臾몄옣?쇰줈 援먯껜.
- **?덈갑 洹쒖튃 P36**: UI ?띿뒪?몃뒗 "?듭떖 ??以? + "?곸꽭???좉?/AI 梨꾪똿"?쇰줈 遺꾨━. ?묓엺 ?곹깭?먯꽌 ?듭떖 硫붿떆吏媛 ?꾩쟾???쏀?????

### 臾몄젣 7: ?몃씪??7-8px 湲???ш린 媛?낆꽦 臾몄젣 (v40.2)
- **利앹긽**: 留ㅽ겕濡??명꽣而ㅻ꽖??留? ?섏쑉梨꾧텒 遺꾩꽍 ?깆뿉??7-8px 湲?먭? ??597怨? ?쎄린 ?대젮?.
- **洹쇰낯 ?먯씤**: 珥덇린 踰꾩쟾?먯꽌 "怨듦컙 ?덉빟"???꾪빐 洹뱀냼 湲???ъ슜. ?댄썑 ?꾩쟻.
- **?섏젙**: CSS override 媛뺥솕 ???몃씪??7-8px??1px, 9-11px??2px ?먮룞 ?뺣?.
- **?덈갑 洹쒖튃 P37**: ?몃씪??font-size 11px 誘몃쭔 ?ъ슜 湲덉?. CSS override媛 ?먮룞 蹂댁젙?섏?留? ?좉퇋 肄붾뱶?먯꽌 7-8px ?ъ슜?섎㈃ ?섎룄? ?ㅻⅨ ?ш린濡??쒖떆??

### 臾몄젣 8: ?ъ씠?쒕컮 湲???좊챸??遺議?(v40.2)
- **利앹긽**: ?ъ씠?쒕컮 硫붾돱 湲?④? ?대몢??諛곌꼍?먯꽌 ?먮┸?섍쾶 蹂댁엫.
- **洹쇰낯 ?먯씤**: color媛 `var(--text-secondary)` = #94a3b8 (?대몢?), font-weight 500 (?뉗쓬).
- **?섏젙**: color #cbd5e1 (諛앷쾶), font-size 13px, weight 600.

### 臾몄젣 9: TradingView 李⑦듃 鍮??붾㈃ ???먮룞 濡쒕뱶 誘몄뿰寃?(v40.2)
- **利앹긽**: technical/kr-technical ?섏씠吏 吏꾩엯 ??TradingView ?곸뿭??寃? 鍮??붾㈃.
- **洹쇰낯 ?먯씤**: `loadTVChart()` ?⑥닔??議댁옱?섏?留? ?섏씠吏 珥덇린?????먮룞 ?몄텧?섏? ?딆쓬. ?ъ슜?먭? ?섎룞?쇰줈 "李⑦듃 濡쒕뱶" 踰꾪듉???뚮윭????
- **?섏젙**: `initKoreaTechnical()`怨?technical ?섏씠吏 init?먯꽌 iframe ?놁쑝硫??먮룞 `loadTVChart()` ?몄텧.

### 臾몄젣 10: AI 梨꾪똿 ?⑤꼸 ?곗옱 ??怨듦컙 ??퉬 + ?좉린???곌껐 遺덇? (v40.4)
- **利앹긽**: 9媛??섏씠吏??媛곴컖 AI 梨꾪똿 ?⑤꼸???덉뼱 ?섏씠吏 怨듦컙 李⑥?. 湲곗뾽 遺꾩꽍?섎㈃??李⑦듃 吏덈Ц?섎젮硫??섏씠吏 ?대룞 ?꾩슂.
- **洹쇰낯 ?먯씤**: ?섏씠吏蹂??낅┰ 梨꾪똿 ?꾪궎?띿쿂. ?щ줈???섏씠吏 ???遺덇?.
- **?섏젙**: ?ㅻⅨ履??щ씪?대뱶 ?ъ씠?쒕컮濡??듯빀. ?섏씠吏 ?꾪솚 ??留λ씫 ?먮룞 ?꾪솚 + ????대젰 ?좎?.
- **?덈갑 洹쒖튃 P38**: ?꾩뿭?곸쑝濡??ъ슜?섎뒗 湲곕뒫(AI 梨꾪똿, ?뚮┝ ??? ?섏씠吏蹂?蹂듭젣媛 ?꾨땶 湲濡쒕쾶 而댄룷?뚰듃濡?援ы쁽.

---

## [2026-04-04] v40.4 ???곗씠??理쒖떊??+ ?댁뒪 ?좊퀎 + UI 6? 寃고븿 ?섏젙

- **利앹긽 1**: 紐⑤뱺 李⑦듃(VIX/NAAIM/AAII/釉뚮젅?쒖벐)媛 3/19~3/27 湲곗? ?섎뱶肄붾뵫 ?곗씠?곕줈 怨좎젙. 2二? 寃쎄낵???곗씠?곌? ?꾩옱 ?곗씠?곗씤 寃껋쿂???쒖떆.
- **利앹긽 2**: ASML ???멸뎅 湲곗뾽 寃?????щТ ?곗씠???꾨? N/A ?쒖떆.
- **利앹긽 3**: ?ъ씠?쒕컮 ?レ쓣 ???붾㈃ 鍮꾩쑉 源⑥쭚 (?쇱そ ?띿뒪???섎┝).
- **利앹긽 4**: ???듭떖?댁뒪媛 API ?섏쭛 ?꾨즺源뚯? "?섏쭛 以? 濡쒕뵫 ?ㅽ뵾?덈쭔 ?쒖떆.
- **利앹긽 5**: ?곗씪由?釉뚮━?묒씠 ?쒓컙?쒖쑝濡쒕쭔 ?섏뿴 ??以묒슂???좊퀎 ?놁씠 ?〓돱???ы븿.
- **利앹긽 6**: ?쒖옣 ?댁뒪 80嫄??쒗븳?쇰줈 ?ㅽ겕濡ㅼ씠 留됲옒. 鍮꾩떆???뺤튂/?쒖궗 ?댁뒪 ?좎엯.
- **洹쇰낯 ?먯씤**:
  1. 李⑦듃 ?곗씠?곌? ?뺤쟻 諛곗뿴濡??섎뱶肄붾뵫?섏뼱 ?덇퀬, API ?숈쟻 ?꾪솚 誘멸뎄??
  2. SEC XBRL ?뚯떛??10-K留??꾪꽣 ??20-F(?멸뎅諛쒗뻾???묒떇) 誘몃??? IFRS 誘몃???
  3. `.sidebar.collapsed`??min-width/padding/border ?붿뿬媛?
  4. `renderHomeFeed()`媛 ?댁뒪 ?섏쭛 ?꾨즺 ?꾩뿉留??몄텧??(?뺤쟻 ?댁뒪 媛쒕뀗 遺??
  5. 釉뚮━??score ?꾧퀎媛??놁쓬 ??24h ??紐⑤뱺 ?댁뒪 ?쒓컙???섏뿴
  6. scoreItem()??5? ?곗꽑 ?좏뵿(留ㅽ겕濡?吏?뺥븰/二쇱떇/?명솚/梨꾧텒) 遺?ㅽ듃 ?놁쓬. 鍮꾩떆???뺤튂 ?댁뒪 媛먯젏 濡쒖쭅 ?놁쓬.
- **?볦튇 ?댁쑀**: 湲곗〈 QA媛 肄붾뱶 援щЦ/?고????먮윭 ?꾩＜ ???곗씠??理쒖떊?굿룸돱???덉쭏쨌?좊퀎 泥닿퀎 ?먭? ??ぉ 遺??
- **?섏젙 ?댁슜**:
  1. VIX/HYG/SPY/QQQ 李⑦듃 ??Yahoo Finance API ?숈쟻 ?꾪솚 (`_refreshSentimentChartData`, `_refreshBreadthPriceChart`)
  2. NAAIM/AAII/釉뚮젅?쒖벐% ?섎룞 理쒖떊??(4/1 湲곗?)
  3. DATA_SNAPSHOT ?꾨㈃ ?낅뜲?댄듃 (3/27??/3 湲곗?, VKOSPI 28.5??8.86)
  4. ?좊쭔 ?곗씠??寃쎄퀬 UI (`getDataAge()` + `renderStaleWarning()`)
  5. SEC ?뚯떛: 20-F/20-F/A + ifrs-full ?대갚 異붽?
  6. sidebar collapsed CSS: min-width:0, padding:0, border:none
  7. ???듭떖?댁뒪 ???뺤쟻 ?먮젅?댁뀡 (`HOME_WEEKLY_NEWS`, DOMContentLoaded?먯꽌 利됱떆 ?쒖떆)
  8. 釉뚮━?? score 45+ ?꾧퀎媛?+ 20嫄?珥덇낵 ??score ?곗꽑 ?좊퀎 ???쒓컙???ъ젙??
  9. ?쒖옣 ?댁뒪: score 30+ ?꾧퀎媛?+ 150嫄??곹븳 + 48h
  10. scoreItem(): 5? ?좏뵿 遺?ㅽ듃(+5~15) + 鍮꾩떆???뺤튂 媛먯젏(-25)
- **?덈갑 洹쒖튃 P31**: ?섎뱶肄붾뵫 李⑦듃 ?곗씠?곕뒗 諛섎뱶??`_updated` ?좎쭨? ?④퍡 愿由? 3?? 寃쎄낵 ??寃쎄퀬 諛곗? ?쒖떆. ?숈쟻 ?꾪솚 媛?ν븳 ?곗씠?곕뒗 API濡??먮룞 援먯껜?섍퀬 ?섎뱶肄붾뵫? ?대갚?쇰줈留??좎?.
- **?덈갑 洹쒖튃 P32**: ?댁뒪 3怨???釉뚮━???쒖옣)???좊퀎 泥닿퀎??諛섎뱶??怨꾩링?곸씠?댁빞 ?? ???뺤쟻 ?먮젅?댁뀡) > 釉뚮━??score 45+, 20嫄? score ?곗꽑 ?좊퀎) > ?쒖옣(score 30+, 150嫄? 愿묐쾾??. 釉뚮━?묒? ?뺣낫 ?꾨떖??score ?곗꽑), ?쒖옣? 理쒖떊???쒓컙?? ?곗꽑.
- **?덈갑 洹쒖튃 P33**: ?멸뎅 湲곗뾽(ADR) ?щТ ?곗씠???뚯떛 ??10-K肉??꾨땲??20-F(?멸뎅諛쒗뻾????諛섎뱶???ы븿. IFRS ?뚭퀎湲곗?(`ifrs-full`)??us-gaap ?대갚?쇰줈 吏??
- **QA 泥댄겕由ъ뒪??異붽? ??ぉ**:
  - [ ] ?섎뱶肄붾뵫 李⑦듃 ?곗씠??寃쎄낵??3???대궡?몄? (DATA_SNAPSHOT._updated)
  - [ ] ASML/TSM ??ADR 湲곗뾽 寃?????щТ ?곗씠??N/A ?꾨땶吏
  - [ ] 釉뚮━???댁뒪??鍮꾩떆???뺤튂/?쒖궗 ?댁뒪 ?좎엯 ???섎뒗吏
  - [ ] ?쒖옣 ?댁뒪 ?ㅽ겕濡ㅼ씠 ?앷퉴吏 媛?ν븳吏 (嫄댁닔 ?쒗븳 ?뺤씤)

---

## [2026-04-02] v39.0 ???붾젅洹몃옩 梨꾨꼸 ?ㅽ겕?섑븨/?댁뒪 ?좊퀎 5? 寃고븿 ?섏젙
- **violated_rule**: R16, R17, R18

- **利앹긽 1**: WalterBloomberg ?붾젅洹몃옩 梨꾨꼸??rsshub?먯꽌 403 李⑤떒?섏뼱 ?섏쭛 0嫄?
- **利앹긽 2**: FirstSquawk/FinancialJuice 梨꾨꼸??t.me/s/ 怨듦컻 誘몃━蹂닿린媛 鍮꾪솢?깊솕?섏뼱 7媛??꾨줉??紐⑤몢 ?ㅽ뙣, 遺덊븘?뷀븳 ?쒓컙 ?뚮え.
- **利앹긽 3**: `fetchAllNews`??60珥?isFetching ?덉쟾?μ튂媛 80媛??뚯뒪 濡쒕뵫 ?쒓컙(??90~120珥?蹂대떎 吏㏃븘 媛뺤젣 由ъ뀑 諛섎났.
- **利앹긽 4**: TECH_KW??`'S'` (SentinelOne ?곗빱) ??湲?먭? ?덉뼱 紐⑤뱺 ?띿뒪?몄뿉???ㅽ깘 留ㅼ묶 ??"?쎈Ъ ?댁쟾" 媛숈? 鍮꾧툑??湲곗궗 ?듦낵.
- **利앹긽 5**: `isTelegramMsgRelevant` ?꾪꽣媛 愿묐쾾???ㅼ썙??`market`, `space`, `?쒖옣` ?? 1媛쒕쭔 留ㅼ묶?섎㈃ ?듦낵 ???〓돱???좎엯.
- **洹쇰낯 ?먯씤**: (1) rsshub ?쒕퉬??蹂寃쎌쑝濡??뱀젙 梨꾨꼸 403 李⑤떒 (2) Telegram 梨꾨꼸 ?ㅼ젙 蹂寃쎌쑝濡?怨듦컻 誘몃━蹂닿린 鍮꾪솢?깊솕 (3) ?뚯뒪 ??利앷???鍮꾪빐 ??꾩븘??誘몄“??(4) ?⑥씪 臾몄옄 ?ㅼ썙??QA 遺??(5) 愿?⑥꽦 ?꾪꽣 ?꾧퀎媛?誘몄꽕??
- **?섏젙**:
  1. `_TG_DIRECT_ONLY` 紐⑸줉?쇰줈 rsshub 李⑤떒 梨꾨꼸? CF Worker 吏곸젒 ?ㅽ겕?섑븨 ?곗꽑 (rsshub ?쒗쉶 ?ㅽ궢)
  2. `_TG_UNAVAILABLE` 紐⑸줉?쇰줈 鍮꾪솢??梨꾨꼸 利됱떆 ?ㅽ궢
  3. isFetching ?덉쟾?μ튂 60珥댿넂180珥덈줈 ?뺤옣
  4. TECH_KW?먯꽌 `'S'` ?⑤룆 ?ㅼ썙???쒓굅
  5. `_TG_BROAD_KW` ?꾩엯 ??愿묐쾾???ㅼ썙?쒕쭔 1媛?留ㅼ묶 ??遺덊넻怨? 2媛??댁긽 ?먮뒗 援ъ껜???ㅼ썙???꾩슂
  6. `NEWS_BLACKLIST_KW`???쒓뎅?????鍮꾧툑???ㅼ썙??異붽? ('移대떎?쒖븞', '?쎈Ъ ?댁쟾' ??
  7. scoreItem???듭떖 ?몃Ъ 諛쒖뼵/?명꽣酉?遺?ㅽ듃(+15) 異붽?
  8. ?뺣젹 踰꾪궥 15遺꾟넂30遺??뺤옣 + score 李⑥씠 15???댁긽?대㈃ score ?곗꽑 ?뺣젹
- **?덈갑 洹쒖튃 P28**: TECH_KW/MACRO_KW?????ㅼ썙??異붽? ??3湲??誘몃쭔? 湲덉?. ?곗빱 留ㅼ묶? extractTickers?먯꽌 word boundary(`\b`)濡?泥섎━?댁빞 ??
- **?덈갑 洹쒖튃 P29**: ?붾젅洹몃옩 梨꾨꼸 異붽? ??t.me/s/{slug}濡?怨듦컻 誘몃━蹂닿린 ?뺤씤 ?꾩닔. 硫붿떆吏 DOM???놁쑝硫?`_TG_UNAVAILABLE`???깅줉.
- **?덈갑 洹쒖튃 P30**: ?댁뒪 ?곗빱 ?쒖떆???좏뵿 湲곕컲 ??macro/geopolitics/policy/fed/rates/trade ?좏뵿?대㈃ ?곗빱 ?④?. `isCompanyNews()`瑜??곗빱 ?쒖떆 ?먮떒???곗? 留?寃?(?좏뵿 遺꾨쪟媛 遺?뺥솗?????덉쓬).

---

## [2026-03-31] v38.4d ??遺꾩꽍 ?⑥닔 ?덉쭏 ?꾩닔 ?먭?: D/C?깃툒 3? 寃고븿 ?섏젙

- **利앹긽 1**: PEG 遺꾩꽍??怨좉?二쇰? ??긽 "?PEG ??됯?"濡? ?媛二쇰? "怨쟑EG 怨좏룊媛"濡??먯젙. EPS 湲덉븸怨?EPS ?깆옣瑜좎쓣 ?쇰룞.
- **利앹긽 2**: Weinstein Stage媛 留ㅼ씪 諛붾?(?댁젣 Stage2 ???ㅻ뒛 Stage4). ?ㅼ젣 Stage ?꾪솚? ?섏＜~?섍컻???⑥쐞.
- **利앹긽 3**: BB ?ㅽ댁쫰媛 "?ㅻ뒛 蹂???곸쓬"留뚯쑝濡?諛쒕룞?섎ŉ, 94.1% ?밸쪧?대씪??異쒖쿂 遺덈챸 ?듦퀎 ?쒖떆.
- **洹쇰낯 ?먯씤**: ?쇨컙 ?ㅻ깄???곗씠?곕쭔?쇰줈 ?κ린 湲곗닠吏?쒕? "?됰궡"??援ы쁽. ?곗씠???쒓퀎瑜??몄젙?섏? ?딄퀬 留덉튂 ?뺥솗??吏?쒖씤 寃껋쿂???쒖떆.
- **?섏젙**: Weinstein??媛?蹂듯빀吏?? MTF?믫??꾪봽?덉엫蹂?怨좎쑀吏?? BB???蹂?숈꽦 ?뺤텞"?쇰줈 ?뺤쭅?? PEG?믪삱諛붾Ⅸ 怨듭떇
- **?덈갑 洹쒖튃 P27**: ?щТ 鍮꾩쑉/湲곗닠吏??援ы쁽 ??(1) ?먯쟾 ?뺤쓽 ?뺤씤 (2) 遺꾩옄/遺꾨え ?⑥쐞 ?쇱튂 (3) ?꾩슂 ?곗씠???뺣낫 ?щ? (4) 洹쇱궗移섎㈃ "異붿젙" 紐낆떆

---

## [2026-03-31] v38.5 ??PEG 鍮꾩쑉 怨꾩궛 怨듭떇 ?ㅻ쪟 ?섏젙 + ??붾찘??遺꾩꽍 源딆씠 媛뺥솕

- **利앹긽**: `_generateFundamentalAnalysis()`??PEG 遺꾩꽍 釉붾줉???꾩쟾???섎せ??媛믪쓣 異쒕젰. ?? NVDA PE 35.2, EPS $4.90 ??PEG = 35.2 / max(4.90, 1) = 7.18濡??쒖떆?섏?留? ?ㅼ젣 PEG = PE / EPS?깆옣瑜?%) = 35.2 / 72 = 0.49?ъ빞 ??
- **洹쇰낯 ?먯씤**: PEG 怨듭떇??`i.pe / Math.max(i.eps, 1)`濡?援ы쁽?섏뼱 ?덉뿀?? `i.eps`??EPS ?덈? 湲덉븸($4.90 ???댁? EPS ?깆옣瑜?%)???꾨떂. PEG = P/E / EPS Growth Rate(%)?몃뜲 遺꾨え媛 ?꾩쟾???由? 寃곌낵?곸쑝濡?EPS 湲덉븸????醫낅ぉ(META $23.49)? PEG媛 ??쾶, ?묒? 醫낅ぉ(TSLA $1.08)? PEG媛 ?믨쾶 ?섏삤????쟾 ?꾩긽 諛쒖깮.
- **?섏젙 ?댁슜**:
  1. `FUND_FALLBACK`??`epsGrowth` ?꾨뱶 異붽? (YoY EPS ?깆옣瑜?%)
  2. PEG 怨꾩궛??`i.pe / i.epsGrowth`濡??щ컮瑜닿쾶 ?섏젙
  3. PEG ?댁꽍 4?④퀎: < 0 (?섏씡 媛먯냼), < 1 (??됯?), 1~2 (?곸젙), > 2 (怨좏룊媛)
  4. EPS ?깆옣瑜??곗씠???녿뒗 醫낅ぉ? "PEG ?곗씠??遺議? 蹂꾨룄 ?쒖떆
  5. 諛몃쪟?먯씠???몃옪 寃쎄퀬 濡쒖쭅 異붽? (?PE + ?섎씫 + ?ROE/EPS 媛먯냼 議고빀)
  6. ?깆옣-?섏씡??留ㅽ듃由?뒪 異붽? (怨좎꽦??怨좊쭏吏?/ 怨좎꽦???留덉쭊 / ??깆옣+怨좊쭏吏?/ ??깆옣+?留덉쭊)
  7. ?뱁꽣蹂?諛몃쪟?먯씠??鍮꾧탳???쒖??몄감 湲곕컲 z-score ?먮떒 異붽?
- **?덈갑 洹쒖튃**:
  - **P27**: PEG 鍮꾩쑉 怨듭떇? 諛섎뱶??`P/E 첨 EPS ?깆옣瑜?%)`. EPS ?덈? 湲덉븸($)??遺꾨え???ъ슜 湲덉?. ?щТ 鍮꾩쑉 怨꾩궛 ??遺꾩옄/遺꾨え ?⑥쐞 ?쇱튂 ?щ? 諛섎뱶??寃利?
  - FUND_FALLBACK?????щТ 吏??異붽? ???⑥쐞(%, $, 諛곗닔) 二쇱꽍 紐낃린.

---

## [2026-03-31] v38.4 ??QA ?꾩닔 ?먭?: P25 `.pct || 0` 65媛??쇨큵 ?섏젙 + P24 children 蹂댄샇 蹂닿컯

- **利앹긽**: ?곗씠??誘몄닔??pct=null/undefined) 醫낅ぉ??UI??"+0.00%"濡??쒖떆?섏뼱 ?ㅼ젣 0% 蹂?숆낵 援щ텇 遺덇?. AI ?꾨＼?꾪듃?먮룄 "0.00%"媛 二쇱엯?섏뼱 遺꾩꽍 ?쒓끝.
- **洹쇰낯 ?먯씤**: `d.pct || 0` ?⑦꽩???꾨줈?앺듃 ?꾩껜 65媛??댁긽 ?곗옱. JavaScript??`||` ?곗궛?먮뒗 `0`??falsy濡?痍④툒?섎?濡? pct媛 ?ㅼ젣 0??寃쎌슦? null/undefined??寃쎌슦瑜?援щ텇?????놁쓬.
- **?섏젙 ?댁슜**:
  - **Category A (19媛? UI 吏곸젒 ?쒖떆)**: `d.pct != null ? d.pct : null` + ?곗씠???놁쓬 ??"?? ?쒖떆, AI?먮뒗 "?깅씫瑜?N/A" ?꾨떖
  - **Category B (22媛? 怨꾩궛 濡쒖쭅)**: `(d.pct != null ? d.pct : 0)` ??null 紐낆떆 泥댄겕
  - **Category C (24媛? ??꾪뿕)**: ?좎? ??鍮꾧탳 ?곗궛/?됱긽 寃곗젙?먯꽌 0???곸젅??湲곕낯媛?
  - **P24 蹂닿컯**: L12114(screener tbody), L26837(kr-supply)?먯꽌 `[data-live-price]` 踰뚰겕 ?낅뜲?댄듃 ??`el.children.length > 0` 泥댄겕 異붽?
  - **insight-box ?ㅻ쾭?뚮줈??*: collapsed ?곹깭?먯꽌 `padding-right: 32px` 異붽??섏뿬 `::after` ?붿궡?쒖? ?띿뒪??寃뱀묠 諛⑹?
- **?덈갑 洹쒖튃**:
  - **P25 媛뺥솕**: `.pct || 0` ?⑦꽩 ?좉퇋 ?ъ슜 ?덈? 湲덉?. 諛섎뱶??`d.pct != null ? d.pct : (湲곕낯媛?` ?ъ슜. UI ?쒖떆 ??null?대㈃ "?? ?뚮뜑留?
  - **P24 媛뺥솕**: `[data-live-price]` ??됲꽣濡?踰뚰겕 ?낅뜲?댄듃?섎뒗 ??肄붾뱶 ?묒꽦 ?? 諛섎뱶??`el.children.length > 0` 泥댄겕 ?ы븿.
- **異붽? 諛쒓껄**: div 遺덇퇏??15媛?蹂닿퀬 ??`grep -c` vs `grep -o` 李⑥씠濡??명븳 李⑹떆 (?ㅼ젣 3,685:3,685 ?꾨꼍 洹좏삎). ?ν썑 div 洹좏삎 ?먭? ??`grep -o '<div' | wc -l` ?ъ슜.

---

## [2026-03-29] v38.3 ??briefing-static-archive 珥덇낵 ?ロ옒 ?쒓렇濡??꾩껜 DOM 援ъ“ 遺뺢눼 (P26 ?좉퇋)

- **利앹긽**: ?섏쑉쨌梨꾧텒 ??紐⑤뱺 ?섏씠吏 ?곷떒??鍮??κ렐 留됰? ?쒖떆, "?섏쑉쨌梨꾧텒" ?쒕ぉ ?덉씠?꾩썐 鍮꾩쑉 ?댁긽, ?꾩껜?곸씤 湲?먃룻솕硫?鍮꾩쑉 遺덉씪移?
- **洹쇰낯 ?먯씤**: Line 3465??遺덊븘?뷀븳 `</div>` 1媛?議댁옱. `briefing-static-archive` ?대???`dynamic-briefing-content` div媛 ?ロ엺 吏곹썑 珥덇낵 `</div>`媛 `briefing-static-archive`瑜?議곌린 ?レ쓬.
  - ?곗뇙 ?④낵: (1) Line 3588??`</div>`媛 `page-briefing`???レ쓬 (2) Line 3611??`</div>`媛 `main-content`瑜??レ쓬 (3) ?댄썑 17媛??섏씠吏(technical~guide)媛 `main-content` 諛?`.main`??吏곸젒 ?먯떇?쇰줈 諛곗튂??(4) `chat-briefing`??`main-content`??吏곸젒 ?먯떇?쇰줈 ?⑥븘 ??긽 ?쒖떆????40px 鍮?留됰?
- **?볦튇 ?댁쑀**: 33,800以??⑥씪 ?뚯씪?먯꽌 `</div>` 1媛?珥덇낵瑜??≪븞?쇰줈 諛쒓껄 遺덇?. HTML ?뚯꽌媛 ?먮룞 蹂듦뎄?섎㈃???먮윭 ?놁씠 ?뚮뜑留곷릺??肄섏넄?먯꽌??媛먯? ????
- **?섏젙 ?댁슜**: Line 3465??珥덇낵 `</div>` ?쒓굅
- **?덈갑 洹쒖튃**:
  - **P26**: ?洹쒕え HTML ?섏젙(?뱀뀡 異붽?/??젣) ??諛섎뱶??`awk` ?깆쑝濡??대떦 釉붾줉??`<div>`/`</div>` 洹좏삎 寃利? `grep -c '<div' && grep -c '</div'` 理쒖냼 泥댄겕.
  - DOM 援ъ“ ?댁긽 ??`document.getElementById('x').parentElement.id`濡??ㅼ젣 遺紐??뺤씤 ??HTML ?뚯뒪? 釉뚮씪?곗? DOM???ㅻ? ???덉쓬

---

## [2026-03-29] v38.3 ???몃텇???뚮쭏 0% ?쒖떆 踰꾧렇 + ?대┃ ?몃뱾???ъ링 遺꾩꽍 誘멸뎄??(P25 ?좉퇋)

- **利앹긽 1**: ?몃텇???뚮쭏(SUB_THEMES) 移대뱶?먯꽌 ?곗씠??誘몄닔??醫낅ぉ??+0.0%濡??쒖떆?섏뼱, ?ㅼ젣 0% 蹂?숆낵 援щ텇 遺덇?
- **洹쇰낯 ?먯씤**: `renderSubThemesGrid()` ????μ＜ ?쒖떆?먯꽌 `var tc = d ? (d.pct || 0) : 0;` ?⑦꽩 ?ъ슜. `d.pct || 0`? pct媛 null/undefined???뚮퓧 ?꾨땲??**吏꾩쭨 0**???뚮룄 0??諛섑솚?섏뿬 援щ텇 遺덇?. ???ш컖??嫄??곗씠?곌? ?꾩삁 ?녿뒗 醫낅ぉ(d???덉?留?price/pct媛 null)??0%濡??쒖떆.
- **?섏젙**: `var hasData = d && d.price != null && d.pct != null;` ??`tc === null ? '?? : formatted` ?⑦꽩. showThemeDetail()???쒕툕?뚮쭏 醫낅ぉ ?쒖떆?먮룄 ?숈씪 ?곸슜.
- **利앹긽 2**: ?몃텇???뚮쭏 移대뱶??onclick ?몃뱾???놁쓬, ?ъ링 遺꾩꽍 ?⑤꼸(showSubThemeDetail) 誘멸뎄??
- **?섏젙**: `showSubThemeDetail(subThemeId)` ?⑥닔 ?좉퇋 援ы쁽(~100以?, `#sub-theme-detail-panel` HTML 異붽?, 移대뱶??onclick+cursor:pointer 異붽?, aio:liveQuotes???⑤꼸 ?먮룞 媛깆떊 異붽?
- **?덈갑 洹쒖튃**:
  - **P25**: `d.pct || 0` ?⑦꽩? "?곗씠???놁쓬"怨?"吏꾩쭨 0%"瑜?援щ텇?????놁쑝誘濡?湲덉?. 諛섎뱶??`d && d.pct != null` 紐낆떆??null 泥댄겕 ?ъ슜.
  - ??UI ?뱀뀡 異붽? ?? 諛섎뱶??(1) ?대┃/?명꽣?숈뀡 ?몃뱾??援ы쁽 ?щ?, (2) aio:liveQuotes ?먮룞 媛깆떊 ?곌껐 ?щ?瑜??먭?.

---

## [2026-03-29] v38.3 ??4-蹂닿퀬???꾩닔 ?먭? ?洹쒕え ?섏젙 (P24 ?뺤옣 + A5~A10 + B1~B6)

- **?섏젙 ??ぉ 14嫄?*:
  1. **A6 (CRITICAL)**: `generateMacroStoryline()` ??`var ld` ?좎뼵 ?꾨씫 ??ReferenceError ??try/catch濡?臾댁떆 ??"?앹꽦 以묅? ?곴뎄 ?쒖떆
  2. **A7 (P24 ?뺤옣)**: 3媛?踰뚰겕 `[data-live-price]` ?낅뜲?댄듃瑜?`el.children.length > 0` ?쇰컲 蹂댄샇濡?媛뺥솕. `.pill-price` ?몄뿉 `.kr-etf-price`, 湲고? 蹂듯빀 ?붿냼??蹂댄샇
  3. **A9**: `_showKrSupplyFallbackNotice()`?먯꽌 `kr-supply-analysis-text` 誘몄쿂由???fetch ?ㅽ뙣 ??"濡쒕뵫 以묅? ?곴뎄 ?쒖떆
  4. **A10**: BZ=F(Brent)瑜?PRIORITY_SYMS??異붽?, orphaned `macro-spread-value` ?붿냼 JS ?곌껐
  5. **B1**: ?꾩떆?꾧꼍??all.xml=404+鍮꾧툑?듯샎??, ?대뜲?쇰━(edaily_news.xml=由щ떎?대젆?? 釉뚮씪?곗? ?ㅽ뀒?ㅽ듃 ???쒓굅
  6. **B2**: `_KR_BROAD_KW` ?꾧퀎媛?2?? ?곹뼢
  7. **B3**: ?쒓뎅 Tier 3 ?뚯뒪 score -5 媛먯젏
  8. **B4**: NEWS_BLACKLIST_KW??蹂댄뿕/移대뱶/CSR/?몄궗/踰뺤썝/援곗궗/?앺솢寃쎌젣 ~30?ㅼ썙??異붽?
  9. **B5**: `_nonFinPatterns`???쒓뎅??鍮꾧툑???뺢퇋??10媛?異붽?
  10. **B6**: RSS `parseXml()`??HTML entity ?댁쨷 ?몄퐫???댁젣 (`_decodeEntities`)
  11. **H6**: fundamental 移대뱶 "(李멸퀬???곗씠??" ?쇰꺼???쇱씠釉??곗씠???좊Т???곕씪 ?숈쟻 蹂寃?
- **?덈갑 洹쒖튃**: P24瑜??쇰컲????`el.children.length > 0`?대㈃ `textContent` 吏곸젒 ?ㅼ젙 湲덉?, ?꾩슜 ?낅뜲?댄듃 ?⑥닔???꾩엫

---

## [2026-03-30] v38.2 ??KR ?뚮쭏 移대뱶 醫낅ぉ紐??뚯떎 (pill DOM ?뚭눼) (P24 ?좉퇋)

- **利앹긽**: KR ?뚮쭏 ?섏씠吏?먯꽌 紐⑤뱺 醫낅ぉ pill??媛寃??レ옄留??쒖떆?섍퀬 醫낅ぉ紐끒룸퉬以뫢룸벑?쎈쪧??蹂댁씠吏 ?딆쓬.
- **洹쇰낯 ?먯씤**: `data-live-price` ?띿꽦??媛吏?紐⑤뱺 DOM ?붿냼?????`el.textContent = price`濡?踰뚰겕 ?낅뜲?댄듃?섎뒗 肄붾뱶 3怨녹씠 ?덉뿀?? `.kr-ticker-pill`??`data-live-price` ?띿꽦??媛뽮퀬 ?덉뼱, pill ?대????먯떇 span??`.pill-name`, `.pill-wt`, `.pill-price`, `.pill-pct`)??`textContent` ?ㅼ젙?쇰줈 紐⑤몢 ??젣??
- **?볦튇 ?댁쑀**: `data-live-price` 湲濡쒕쾶 ??됲꽣媛 KR ?뚮쭏??pill 而⑦뀒?대꼫源뚯? 留ㅼ묶?쒕떎??寃껋쓣 ?몄??섏? 紐삵븿. pill? ?먯떇 span???곗씠?곕? 遺꾨━ ??ν븯??援ъ“?몃뜲, 踰뚰겕 ?낅뜲?댄듃???⑥닚 ?띿뒪???몃뱶濡?痍④툒.
- **?섏젙 ?댁슜**: 3怨녹쓽 踰뚰겕 ?낅뜲?댄듃?먯꽌 `var _pp = el.querySelector('.pill-price'); if (_pp) { _pp.textContent = fmt; } else { el.textContent = fmt; }` ?⑦꽩 ?곸슜
- **?덈갑 洹쒖튃**:
  - **P24**: `[data-live-price]` 湲濡쒕쾶 ??됲꽣濡?DOM???낅뜲?댄듃???? ?먯떇 ?붿냼媛 ?덈뒗 蹂듯빀 援ъ“(pill, card ????寃쎌슦 `textContent`??`innerHTML`濡??꾩껜瑜???뼱?곕㈃ ???? 諛섎뱶???먯떇 ?ㅽ뙩 議댁옱 ?щ?瑜??뺤씤?섍퀬 ?寃잜똿.
  - ??`data-live-*` ?띿꽦 異붽? ?? 湲곗〈 踰뚰겕 ?낅뜲?댄듃 濡쒖쭅怨쇱쓽 異⑸룎 ?щ? ?먭? ?꾩닔.
- **QA 泥댄겕由ъ뒪??異붽?**: KR ?뚮쭏 pill??醫낅ぉ紐끒룸퉬以뫢룸벑?쎈쪧??紐⑤몢 ?쒖떆?섎뒗吏 ?뺤씤 (理쒖큹 濡쒕뱶 + ?ㅼ떆媛?媛깆떊 ??

---

## [2026-03-30] v38.1 ??flex column min-height 踰꾧렇濡??꾩껜 ?섏씠吏 ?ㅽ겕濡?遺덇? (P2 ?щ컻 + P23 ?좉퇋)

- **利앹긽**: 紐⑤뱺 ?섏씠吏?먯꽌 ?몃줈 ?ㅽ겕濡ㅼ씠 ?숈옉?섏? ?딆쓬.
- **洹쇰낯 ?먯씤 (P23 ??flex min-height)**:
  1. `.main`怨?`.content`媛 flex column ?덉씠?꾩썐?먯꽌 `min-height: auto` (湲곕낯媛?瑜?媛吏?
  2. flex column ?꾩씠?쒖? 湲곕낯?곸쑝濡?肄섑뀗痢??믪씠 ?댄븯濡?異뺤냼?섏? ?딆쓬 ??`.content`媛 肄섑뀗痢좊쭔??而ㅼ쭚
  3. `overflow-y: auto`???붿냼媛 肄섑뀗痢좊낫???묒쓣 ?뚮쭔 ?ㅽ겕濡ㅻ컮 ?앹꽦 ???붿냼媛 ??긽 肄섑뀗痢좊쭔???щ㈃ ?ㅽ겕濡ㅻ컮 誘몄깮??
  4. `.main`??`overflow: hidden`???섏튇 遺遺꾩쓣 ?섎씪?대?濡? ?섎떒??蹂댁씠吏 ?딄퀬 ?ㅽ겕濡ㅻ룄 ????
- **遺媛 ?먯씤 (P2 諛섎났)**:
  1. `.insight-box.box-collapsed`??`white-space:nowrap` + `max-width` 誘몄꽕?????섑룊 ?ㅻ쾭?뚮줈??
  2. `.content`/`.page`??`overflow-x:hidden` 誘몄꽕??
- **?섏젙 ?댁슜**:
  1. **?듭떖**: `.main`怨?`.content`??`min-height: 0` 異붽? ??flex ?꾩씠?쒖씠 肄섑뀗痢좊낫???묒븘吏????덇쾶 ?섏뿬 ?ㅽ겕濡??쒖꽦??
  2. `.content`/`.page`/`.page.active`??`overflow-x: hidden`
  3. `.insight-box`??`max-width:100%; overflow-wrap:break-word`
- **?덈갑 洹쒖튃**: **P23 (?좉퇋)** ??flex column ?덉씠?꾩썐?먯꽌 overflow ?ㅽ겕濡ㅼ쓣 ?ъ슜?섎뒗 ?꾩씠?쒖? 諛섎뱶??`min-height: 0` ?꾩닔
- **?⑦꽩**: P23 ?좉퇋 + P2 諛섎났

---

## [2026-03-30] CHAT_CONTEXTS ?댁썝???좎뼵 ??誘몄쟻??+ ?쒖옣 ?ㅼ썙???꾨씫 (P22)

- **利앹긽**: v37.2?먯꽌 ?댁썝??醫낃?/?ㅼ떆媛? ?먯튃 ?좎뼵 ?? ?ㅼ젣濡쒕뒗 home + Pro overrides 6媛쒖뿉留??곸슜. 12媛?湲곕낯 而⑦뀓?ㅽ듃(signal, breadth, sentiment, briefing, fundamental, themes, guide, screener, options, portfolio, fxbond, technical/macro)媛 誘몄쟻???곹깭. 異붽?濡?2026???듭떖 ?쒖옣 ?ㅼ썙??CPO, ?좊━湲고뙋, agentic AI, Golden Dome, 800V, ?대㉧?몄씠???? ?遺遺??꾨씫.
- **洹쇰낯 ?먯씤**: ?쇱쿂 ?좎뼵怨??ㅼ젣 ?곸슜 踰붿쐞??愿대━. v37.2?먯꽌 `_closeSnap()` ?⑥닔瑜?留뚮뱾怨?home + Pro contexts???곸슜?덉쑝?? ?섎㉧吏 12媛?湲곕낯 而⑦뀓?ㅽ듃 ?곸슜??"?꾩냽 ?묒뾽"?쇰줈 誘몃， 梨?踰꾩쟾???щ┝. ?ㅼ썙?쒕뒗 v37.4?먯꽌 硫붽?罹??뚰겕/AI?먮쭔 吏묒쨷?섍퀬 2026???좉퇋 ?몃젋??泥⑤떒?⑦궎吏? 諛⑹궛, EV, 諛붿씠?? ?뺤옣 ?꾨씫.
- **?볦튇 ?댁쑀**:
  1. ?곸슜 ????꾩껜 紐⑸줉(18媛?而⑦뀓?ㅽ듃) ?鍮??꾨즺 泥댄겕由ъ뒪??誘몄옉??
  2. v37.2 由대━利???"?꾩껜 ?곸슜 ?꾨즺"濡??ㅼ씤 ???ㅼ젣濡쒕뒗 6/18留??꾨즺
  3. ?ㅼ썙???뺤옣 ???꾩옱 ?쒖옣 ?몃젋??泥닿퀎???ㅼ틪 誘몄떎??
- **?섏젙 (v37.5)**: 12媛?湲곕낯 而⑦뀓?ㅽ듃??`_closeSnap()` 異붽?, briefing ?댁뒪 ?댁쨷二쇱엯 ?쒓굅, 吏?뺥븰 釉붾줉 3媛?而⑦뀓?ㅽ듃 ?뺤궛, 愿??臾댁뿭?꾩웳 ?ㅼ썙??蹂닿컯
- **?섏젙 (v37.6)**: TECH_KW ~255??340+(CPO, glass substrate, BSPDN, agentic AI, sovereign AI, custom silicon, InfiniBand, NVLink, liquid cooling, humanoid, 800V, RISC-V ??, MED_KW +Golden Dome/諛⑹궛/800V/GLP-1, TOPIC_KEYWORDS semi쨌defense쨌energy ????뺤옣
- **?⑦꽩**: **P22 ???쇱쿂 ?좎뼵-?곸슜 愿대━ (Declared but Partially Applied)**. ???먯튃/?⑦꽩???좎뼵?????곸슜 ????꾩껜 紐⑸줉??泥댄겕由ъ뒪?명솕?섍퀬, ?섎굹?쇰룄 誘몄쟻????踰꾩쟾 ?щ━吏 ?딅뒗?? ?ㅼ썙???뺤옣 ???쒖옣 ?몃젋??泥닿퀎???ㅼ틪 ?꾩닔.
- **?덈갑 洹쒖튃**: (1) ?꾪궎?띿쿂 蹂寃??좎뼵 ???곹뼢 踰붿쐞 ?꾩닔 紐⑸줉 ?묒꽦 ??100% ?곸슜 ?뺤씤 ??由대━利? (2) ?ㅼ썙???뺤옣 ??"諛섎룄泥는텮I쨌諛⑹궛쨌?먮꼫吏쨌EV쨌諛붿씠?ㅒ룸ℓ?щ줈" 7? ?뱁꽣 泥댄겕. (3) QA-CHECKLIST R13(?댁썝???꾩닔), R14(?ㅼ썙???꾪뻾?? ?좉퇋 猷?異붽? ?꾨즺.

---

## [2026-03-28] v35.7 媛먯궗 蹂닿퀬??16媛??댁뒋 ?듯빀 (P21)

- **利앹긽**: DATA_SNAPSHOT US ?곗씠??1??吏??3/26), FALLBACK_QUOTES 1二?吏??3/20)+以묐났 49媛? kr-supply ?섍툒 紐⑥닚, PRIORITY_SYMS ?쒓뎅 84.5% 誘몄빱踰?
- **洹쇰낯 ?먯씤**: 媛먯궗 蹂닿퀬??v35.7)?먯꽌 ?앸퀎??Critical 5 + High 6 + Medium 5 ?댁뒋
- **?섏젙 諛⑸쾿**: v35.7 ?낅줈???뚯씪?먯꽌 ?섏젙???곗씠???뱀뀡???꾩옱 ?묒뾽 ?뚯씪??蹂묓빀. DATE_ENGINE, fetchKrNaverQuotes ??湲곗〈 ?꾪궎?띿쿂 蹂寃?蹂댁〈?섎㈃???곗씠??怨꾩링留?援먯껜
- **?섏젙 踰붿쐞**: DATA_SNAPSHOT (15媛??꾨뱶), FALLBACK_QUOTES (?꾩껜 援먯껜 350+媛?, kr-supply HTML (6媛??ъ옄???섏튂), PRIORITY_SYMS (?쒓뎅 +107醫낅ぉ, S&P +25醫낅ぉ), HTML ?대갚媛?(VIX, S&P, BTC, TNX, VKOSPI ??10+媛쒖냼)
- **?덈갑**: 二쇨린??媛먯궗 蹂닿퀬??湲곕컲 ?곗씠??寃利? DATA_SNAPSHOT怨?FALLBACK_QUOTES ?쇨???泥댄겕 ?먮룞???꾩슂

---

## [2026-03-28] SCREENER_DB sym ?꾨뱶 以묐났?쇰줈 JS 臾몃쾿 ?ㅻ쪟 (P20)

- **利앹긽**: index.html ?꾩껜 ?ㅽ겕由쏀듃 釉붾줉??"Unexpected string" JS 臾몃쾿 ?ㅻ쪟濡??숈옉 遺덇?
- **洹쇰낯 ?먯씤**: 肄붿뒪留μ뒪/肄붿뒪留μ뒪BTI 遺꾨━ ?섏젙 以?`sym:'044820.KQ','192820.KQ'`濡???媛믪쓣 ?섎굹???띿꽦???섏뿴 ???좏슚?섏? ?딆? JS 臾몃쾿
- **?볦튇 ?댁쑀**: ?댁쟾 ?몄뀡?먯꽌 ?섏젙 ??JS 臾몃쾿 寃利?誘몄떎?? 媛쒕퀎 ?띿꽦媛??섏젙?먯꽌 媛앹껜 ?꾩껜 臾몃쾿源뚯? 寃利앺븯吏 ?딆쓬.
- **?섏젙 ?댁슜**: 以묐났 sym??媛쒕퀎 SCREENER_DB ??ぉ 2媛쒕줈 遺꾨━ (044820 肄붿뒪留μ뒪BTI + 192820 肄붿뒪留μ뒪)
- **?덈갑 洹쒖튃**: SCREENER_DB/KR_STOCK_DB ?섏젙 ??諛섎뱶??`new Function(code)` 臾몃쾿 寃利??섑뻾. 媛앹껜 ?띿꽦???ㅼ쨷 媛??낅젰 湲덉?.
- **QA 泥댄겕由ъ뒪??異붽?**: 肄붾뱶 ?섏젙 ???꾩껜 ?ㅽ겕由쏀듃 釉붾줉 JS 臾몃쾿 寃利??꾩닔 (湲곗〈 R4 蹂닿컯)

---

## [2026-03-28] ?쒓뎅 醫낅ぉ ?곗씠??臾닿껐???꾨㈃ ?ㅻ쪟 3嫄?(CRITICAL)

### 踰꾧렇 1: ?덉씤蹂댁슦濡쒕낫?깆뒪 醫낅ぉ肄붾뱶 269620??77810 遺덉씪移?

- **利앹긽**: KR_STOCK_DB??`269620`?쇰줈 ?깅줉???덉씤蹂댁슦濡쒕낫?깆뒪媛 Yahoo Finance?먯꽌 `60,000??(?됰슧???뚯궗 "Syswork Co.")?쇰줈 諛섑솚. ?ㅼ젣 ?덉씤蹂댁슦濡쒕낫?깆뒪(277810)??`567,000???쇰줈 ??10諛?李⑥씠.
- **洹쇰낯 ?먯씤**: 理쒖큹 醫낅ぉ 肄붾뱶 ?낅젰 ??**?몃? ?뚯뒪 援먯감 寃利??놁씠** 肄붾뱶瑜??낅젰. 269620? 肄붿뒪?μ뿉 ?ㅼ옱?섎뒗 ?ㅻⅨ ?뚯궗(?쒖뒪????肄붾뱶. ?덉씤蹂댁슦濡쒕낫?깆뒪???ㅼ젣 肄붾뱶??277810.KQ.
- **?볦튇 ?댁쑀**:
  1. 醫낅ぉ 異붽? ??"肄붾뱶?뭑ahoo API ?묐떟 ?뚯궗紐??쇱튂 ?щ?" 寃利??덉감媛 **議댁옱?섏? ?딆븯??*
  2. Yahoo Finance API媛 ?섎せ??肄붾뱶?먮룄 ?뺤긽 媛寃⑹쓣 諛섑솚 ???먮윭媛 ?꾨땶 "?섎せ???뺤긽 ?묐떟"?대씪 諛쒓컖 ?대젮?
  3. FALLBACK_QUOTES??媛寃?175,400?????ㅼ젣 ?덉씤蹂댁슦 媛寃⑸?? 鍮꾩듂?댁꽌 ?덉뿉 ?꾩? ?딆쓬
  4. QA-CHECKLIST??**"醫낅ぉ肄붾뱶?뷀쉶?щ챸 留ㅽ븨 寃利?** ??ぉ???꾨Т
- **?곹뼢 踰붿쐞**: 11媛쒖냼(HTML pill, SCREENER_DB, KR_STOCK_DB, KR_THEME_MAP, FALLBACK_QUOTES, alias諛곗뿴, KOSDAQ_SET, ?ㅼ떆媛?API ?몄텧)
- **?섏젙**: ?꾩껜 269620??77810 ?쇨큵 移섑솚, price/mcap 媛깆떊
- **?⑦꽩**: **P17 ??醫낅ぉ肄붾뱶 誘멸?利??낅젰 (Phantom Ticker)**. 肄붾뱶瑜??섎룞 ?낅젰????Yahoo/嫄곕옒??怨듭떇 留ㅽ븨??援먯감 ?뺤씤?섏? ?딆쑝硫? ?ㅻⅨ ?뚯궗???곗씠?곌? 議곗슜???ㅼ뼱?⑤떎.

### 踰꾧렇 2: 294870 "?먮굹臾?濡??쒓린 ???ㅼ젣??HDC?꾨??곗뾽媛쒕컻 (鍮꾩긽??湲곗뾽 肄붾뱶 ?ㅻ같??

- **利앹긽**: crypto ?뚮쭏?먯꽌 "?먮굹臾??낅퉬??"媛 40% 鍮꾩쨷??李⑥??섎뒗?? ?ㅼ젣濡??쒖떆?섎뒗 媛寃?20,750??? HDC?꾨??곗뾽媛쒕컻(嫄댁꽕二???媛寃? ?щ┰???뚮쭏 ?섏씡瑜좎씠 嫄댁꽕 ?뱁꽣 ?吏곸엫???곕룞?섎뒗 移섎챸???ㅻ쪟.
- **洹쇰낯 ?먯씤**: **?먮굹臾대뒗 鍮꾩긽??湲곗뾽**?대?濡?肄붿뒪??肄붿뒪?쇱뿉 醫낅ぉ肄붾뱶媛 ?놁쓬. 294870? HDC?꾨??곗뾽媛쒕컻??KOSPI 肄붾뱶. 理쒖큹 ?깅줉 ??"?낅퉬???댁쁺??= ?먮굹臾?= ?곸옣???쇨퀬 ?섎せ 媛?뺥븯怨? 寃利??놁씠 肄붾뱶瑜??좊떦.
- **?볦튇 ?댁쑀**:
  1. "?먮굹臾?媛 鍮꾩긽?μ씠?쇰뒗 ?ъ떎???뺤씤?섏? ?딆쓬 ????寃?됱씠??嫄곕옒??議고쉶 誘몄떎??
  2. Yahoo Finance 294870.KQ媛 媛寃⑹쓣 諛섑솚?섎?濡?"?곸옣??留욌떎"怨??ㅼ씤 (?ㅼ젣濡쒕뒗 HDC?꾨??곗뾽媛쒕컻???곗씠??
  3. crypto ?뚮쭏???섏씡瑜?蹂?숈씠 "?щ┰???쒖옣???먮옒 蹂?숈꽦???щ땲源?濡??⑸━?붾맆 ???덉뼱 ?댁긽 ?먯? ?대젮?
  4. QA??**"醫낅ぉ???곸옣 ?щ? ?뺤씤"** ?덉감 ?놁쓬
- **?곹뼢 踰붿쐞**: KR_STOCK_DB, KR_THEME_MAP(crypto ?뚮쭏 40%), HTML pill, SCREENER_DB, alias諛곗뿴, KOSDAQ_SET
- **?섏젙**: 294870?묱DC?꾨??곗뾽媛쒕컻濡??뺤젙, crypto ?뚮쭏?먯꽌 ?쒓굅 ??3醫낅ぉ ?щ텇諛??꾨찓?대뱶40/移댁뭅??5/媛ㅻ윮?쒖븘25)
- **?⑦꽩**: **P18 ??鍮꾩긽??湲곗뾽???곸옣 肄붾뱶??留ㅽ븨 (Ghost Stock)**. 鍮꾩긽??湲곗뾽???대쫫???곸옣 肄붾뱶??遺숈씠硫??꾪? ?ㅻⅨ ?뚯궗???곗씠?곌? ?대떦 ?대쫫?쇰줈 ?쒖떆?쒕떎.

### 踰꾧렇 3: 044820 "肄붿뒪留μ뒪" ?쒓린 ???ㅼ젣??肄붿뒪留μ뒪BTI (?먰쉶??

- **利앹긽**: K-酉고떚 ?뚮쭏?먯꽌 "肄붿뒪留μ뒪(ODM 1??"濡?14% 鍮꾩쨷 諛곗젙. ?ㅼ젣 044820? ?먰쉶??肄붿뒪留μ뒪BTI(?먮즺)?대ŉ, ODM 蹂몄궗 肄붿뒪留μ뒪??192820.KQ. 媛寃⑸룄 10諛? 李⑥씠(肄붿뒪留μ뒪 147,700 vs 肄붿뒪留μ뒪BTI 9,520).
- **洹쇰낯 ?먯씤**: ?ㅼ씠踰??ㅼ쓬 利앷텒?먯꽌 "肄붿뒪留μ뒪" 寃????044820(肄붿뒪留μ뒪BTI)怨?192820(肄붿뒪留μ뒪)媛 紐⑤몢 ?섏삤?붾뜲, 泥?踰덉㎏ 寃곌낵瑜?蹂몄궗濡??ㅼ씤?섍퀬 肄붾뱶 ?좊떦. **?뚯궗紐낆씠 ?좎궗??紐⑥옄?뚯궗(parent-subsidiary) 援щ텇 ?ㅽ뙣**.
- **?볦튇 ?댁쑀**:
  1. 寃??寃곌낵??泥???ぉ??臾대퉬?먯쟻?쇰줈 梨꾪깮 ???뺤떇 ?뚯궗紐??꾩껜("肄붿뒪留μ뒪鍮꾪떚?꾩씠" vs "肄붿뒪留μ뒪") 誘명솗??
  2. Yahoo Finance?먯꽌 044820.KQ??怨듭떇 ?대쫫 "Cosmax BTI Inc"???뺤씤?섏? ?딆쓬
  3. 媛寃?踰붿쐞 寃利??놁쓬 ??ODM 1??肄붿뒪留μ뒪媛 9,520?먯쭨由??뚰삎二쇰씪??鍮꾪빀由ъ꽦???볦묠
  4. QA??**"?좎궗 ?대쫫 紐⑥옄?뚯궗 援щ텇 ?뺤씤"** ?덉감 ?놁쓬
- **?곹뼢 踰붿쐞**: KR_STOCK_DB, KR_THEME_MAP(kbeauty), HTML pill, SCREENER_DB, alias諛곗뿴
- **?섏젙**: 044820 ?대쫫?믪퐫?ㅻ㎘?짟TI, 192820 肄붿뒪留μ뒪 蹂몄궗 ?좉퇋 異붽?, kbeauty ?뚮쭏 ???192820?쇰줈 援먯껜

### 怨듯넻 洹쇰낯 ?먯씤 遺꾩꽍

**????3嫄?紐⑤몢 諛쒖깮?덈뒗媛:**

??3嫄댁? 紐⑤몢 ?숈씪??洹쇰낯 ?먯씤??怨듭쑀?쒕떎 ??**醫낅ぉ ?곗씠???낅젰 ???몃? ?뚯뒪 援먯감 寃利?cross-validation) ?덉감媛 ?꾨Т**. 援ъ껜?곸쑝濡?

1. **"肄붾뱶 ?낅젰 = ?좊ː"**: 醫낅ぉ肄붾뱶瑜?DB???ｌ쑝硫?洹??쒓컙遺??肄붾뱶媛 "吏꾩떎"???? Yahoo API媛 ?대떦 肄붾뱶??媛寃⑹쓣 諛섑솚?섎㈃ "?뺤긽"?쇰줈 媛꾩＜. ?ㅼ젣濡?**?대뼡 ?뚯궗???곗씠?곗씤吏** ?뺤씤?섎뒗 ?덉감媛 ?놁쓬.
2. **"?대쫫 ?쒓린 = 寃利?**: DB???대쫫???곸쑝硫?洹멸쾬??寃利??꾨즺濡?痍④툒?? ?ㅼ젣 嫄곕옒??怨듭떇 醫낅ぉ紐낃낵 ?議고븯???④퀎媛 ?놁쓬.
3. **"媛寃?諛섑솚 = ?곸옣 ?뺤씤"**: Yahoo/?ㅼ씠踰꾩뿉??媛寃⑹씠 ?섏삤硫?"?곸옣??留욌떎"怨?媛?? 鍮꾩긽???ㅻⅨ?뚯궗 媛?μ꽦??怨좊젮?섏? ?딆쓬.
4. **?뚮쭏蹂??섏씡瑜??⑸━??寃利?遺??*: crypto ?뚮쭏媛 嫄댁꽕二??곗씠?곕줈 怨꾩궛?섏뼱?? 寃곌낵媛??먯껜媛 "?レ옄"?대?濡??댁긽 ?먯? ????

**??湲곗〈 QA?먯꽌 紐??≪븯?붽?:**

- QA-CHECKLIST v3??**UI ?뚮뜑留? 李⑦듃, 肄섏넄 ?먮윭, ?ㅻ퉬寃뚯씠??*??吏묒쨷. 204媛???ぉ 以?**"?곗씠???먮낯???뺥솗??**??寃利앺븯????ぉ??0媛?
- "?섏튂媛 0???꾨땲硫?PASS" 濡쒖쭅?쇰줈??**?섎せ???뚯궗???뺤긽 ?곗씠??*瑜?媛먯??????놁쓬.
- BUG-POSTMORTEM??16媛??⑦꽩(P1~P16) 以?**"醫낅ぉ肄붾뱶 留ㅽ븨 ?ㅻ쪟"** ?⑦꽩???놁뿀??

### ?좉퇋 ?⑦꽩 ?깅줉

| # | ?⑦꽩 | ?ш컖??|
|---|------|--------|
| P17 | Phantom Ticker ??醫낅ぉ肄붾뱶 誘멸?利??낅젰?쇰줈 ?ㅻⅨ ?뚯궗 ?곗씠???좎엯 | 留ㅼ슦 ?믪쓬 |
| P18 | Ghost Stock ??鍮꾩긽??湲곗뾽???곸옣 肄붾뱶??留ㅽ븨 | 留ㅼ슦 ?믪쓬 |
| P19 | Parent-Sub Confusion ???좎궗 ?대쫫 紐⑥옄?뚯궗 援щ텇 ?ㅽ뙣 | ?믪쓬 |

### ?덈갑 洹쒖튃 (R10~R12 ?좎꽕)

- **R10. 醫낅ぉ肄붾뱶 ?낅젰 ??3以?寃利??꾩닔**: (1) Yahoo Finance quote ?섏씠吏?먯꽌 怨듭떇 ?뚯궗紐??뺤씤, (2) ?뚯궗紐낆씠 DB ?깅줉紐낃낵 ?쇱튂?섎뒗吏 ?議? (3) 媛寃??쒖킑 踰붿쐞媛 ?대떦 湲곗뾽 洹쒕え? ?⑸━?곸씤吏 ?뺤씤
- **R11. 鍮꾩긽???щ? ?좏솗??*: ?좉퇋 醫낅ぉ 異붽? ???대떦 湲곗뾽??KOSPI/KOSDAQ???곸옣?섏뼱 ?덈뒗吏 嫄곕옒??KRX) ?먮뒗 湲덉쑖?ы꽭?먯꽌 ?뺤씤. "鍮꾩긽??/"?μ쇅嫄곕옒" ?쒓린 ??肄붾뱶 ?좊떦 湲덉?.
- **R12. ?좎궗 ?대쫫 紐⑥옄?뚯궗 援щ텇**: 寃?????숈씪/?좎궗 ?대쫫??蹂듭닔 ?섏삤硫? 媛곴컖???뺤떇 醫낅ぉ紐끒룹퐫?쑣룹떆珥앹쓣 ?議고븯??蹂몄궗/?먰쉶??援щ텇 ???щ컮瑜?肄붾뱶 ?좏깮.

---

## [2026-03-29] v35.2 ??FMP ?곗씠???뺥솗???꾩닔 議곗궗 (CRITICAL 4嫄?+ MEDIUM 6嫄?

- **利앹긽**: 湲곗뾽 遺꾩꽍?먯꽌 ?ㅼ쟻/諛몃쪟?먯씠???곗씠?곌? 遺?뺥솗?섎떎???ъ슜??蹂닿퀬.
- **洹쇰낯 ?먯씤 (10嫄?**:
  1. **[CRITICAL] TTM vs Annual 遺덉씪移?*: ?ъ링 遺꾩꽍??`v3/ratios/`(?곌컙)? `v3/key-metrics/`(?곌컙)瑜??몄텧?섎㈃???꾨＼?꾪듃/UI??"TTM"?쇰줈 ?쒖떆. ?듬럭??`v3/ratios-ttm/`???щ컮瑜닿쾶 ?ъ슜.
  2. **[CRITICAL] 湲곌? ?ъ옄??怨꾩궛 ?ㅻ쪟**: `(shares 횞 value) / shares` = 洹몃깷 `value`. ?섎?濡좎쟻 ?ㅻ쪟.
  3. **[CRITICAL] EV/Sales = P/S ?섎せ ???*: `priceToSalesRatioTTM`??`evToRev`???좊떦. P/S ??EV/Sales.
  4. **[CRITICAL] FRED 0媛??뚯떎**: `parseFloat("0") || null = null` ???뺤긽 0媛믪씠 ?꾨씫??
  5. **[MEDIUM] % 蹂?붿쑉 0% ??뼱?곌린**: `!pct || pct === 0` 議곌굔???뺤긽 0%瑜??ш퀎??
  6. **[MEDIUM] CAGR ?쇰꺼 ?ㅻ쪟**: `rev3yCagr`???덉?留??ㅼ젣 2??媛꾧꺽 (0.5 吏??.
  7. **[MEDIUM] CAGR NaN**: ?뚯닔 留ㅼ텧 ??`Math.pow(?뚯닔, 0.5)` = NaN.
  8. **[MEDIUM] DCF upside ????ㅻ쪟**: `.toFixed()` ??臾몄옄?대줈 鍮꾧탳, `Math.abs(string)` ?몄텧.
  9. **[MEDIUM] 諛곕떦?섏씡瑜?fallback**: `price || 1` ??媛寃??놁쓣 ??鍮꾩젙?곸쟻 諛곕떦瑜?
  10. **[MEDIUM] deep-compare key-metrics TTM ?꾨씫**: `_fetchDeepCompareData`?먯꽌 ratios??TTM, metrics??annual.
- **?⑦꽩**: **P15** ??API ?붾뱶?ъ씤???좏깮怨??곗씠???쇰꺼 ?ъ씠??遺덉씪移? 肄붾뱶 蹂듭젣 ???먮낯(?듬럭 TTM)怨?蹂듭젣蹂??ъ링遺꾩꽍 annual) 媛??숆린???ㅽ뙣.
- **?⑦꽩**: **P16** ??JavaScript falsy 媛?0, "") 泥섎━ ?ㅼ닔. `|| null`, `|| 1`, `!val` 議곌굔?먯꽌 ?뺤긽 0/鍮덈Ц?먯뿴 ?뚯떎.
- **?덈갑 洹쒖튃**: (1) FMP ?붾뱶?ъ씤???좏깮 ??`-ttm` ?묐???紐낆떆 ?뺤씤. (2) `|| null` ???`isNaN()` ?먮뒗 `== null` ?ъ슜. (3) ?꾨＼?꾪듃/UI???곗씠???쇰꺼怨??ㅼ젣 API ?붾뱶?ъ씤??援먯감 寃利?
- **QA 泥댄겕由ъ뒪??異붽?**: 9B-1 "?곗씠???뺥솗??寃利? ?뱀뀡 10媛???ぉ.

---

## [2026-03-25] v33.5 ???붾젅洹몃옩 CJK 理쒖냼湲몄씠 ?꾪꽣 ?ㅽ깘 (P14)

- **利앹긽**: `isTelegramMsgRelevant('?ι??뚦닶訝듽걩?믤쩂鼇롣릎?곫젶凉뤷툊?담겓壤깁읉')` 媛 `false` 諛섑솚. '?⒳툓??,'?ι?','躍귛졃' ?ㅼ썙?쒓? 紐⑤몢 諛곗뿴??議댁옱?섏?留?留ㅼ묶 ?ㅽ뙣.
- **洹쇰낯 ?먯씤**: `text.length < 20` 理쒖냼湲몄씠 ?꾪꽣媛 18???쇰낯??臾몄옣??李⑤떒. CJK 臾몄옄??Latin 臾몄옄蹂대떎 ?뺣낫諛?꾧? ?믪븘 18?먮룄 ?꾩쟾???댁뒪 臾몄옣??
- **?섏젙**: 理쒖냼湲몄씠瑜?20??2濡??섑뼢. 12?먮뒗 CJK/Latin 紐⑤몢 ?섎? ?덈뒗 理쒖냼 硫붿떆吏 湲몄씠.
- **援먰썕**: 臾몄옄??湲몄씠 湲곕컲 ?꾪꽣???몄뼱蹂??뺣낫諛??李⑥씠瑜?怨좊젮?댁빞 ?? ?ㅺ뎅???뱁엳 CJK) 吏????Latin 湲곗? ?섎뱶肄붾뵫 湲덉?.
- **?щ컻 諛⑹?**: QA v3 Stage 7(?댁뒪)??CJK ?띿뒪???⑥쐞 ?뚯뒪????ぉ ?ы븿.

---

## [2026-03-25] v33.3 ???붾젅洹몃옩 '臾대즺' ?ㅽ뙵 ?ㅼ썙???ㅽ깘

- **利앹긽**: bornlupin 梨꾨꼸??"?ㅽ뵂?대줈 臾대즺 ?뚰봽?몄썾??AI ?먯씠?꾪듃 ?섏슂 ??쬆" 媛숈? ?뺣떦??湲덉쑖 ?댁뒪媛 李⑤떒??
- **洹쇰낯 ?먯씤**: `spamKW`??'臾대즺'媛 ?⑤룆?쇰줈 ?ы븿?섏뼱, '臾대즺 由ы룷??, '臾대즺 ?뚰봽?몄썾??, '臾대즺 API' ??湲덉쑖 留λ씫???쒗쁽 ?꾨? 李⑤떒.
- **?섏젙**: '臾대즺' ?⑤룆 ??'臾대즺 ?대깽??,'臾대즺 李몄뿬','臾대즺 媛??,'臾대즺 泥댄뿕','臾대즺 荑좏룿','臾대즺 諛곗넚' 蹂듯빀 ?⑦꽩?쇰줈 援ъ껜?? '媛?? ?⑤룆???쒓굅 (ETF 媛??利앷? ??.
- **?⑦꽩**: P11 ???ㅽ뙵 ?꾪꽣???⑤룆 ?ㅼ썙?쒓? ?뺣떦??肄섑뀗痢좎? 異⑸룎. ?ㅽ뙵 ?ㅼ썙?쒕뒗 媛?ν븳 蹂듯빀 ?⑦꽩?쇰줈 援ъ껜?뷀븷 寃?

---

## [2026-03-25] v33.3 ???곗＜/??났?곗＜ ?ㅼ썙???꾨Т ??NASA/SpaceX ?댁뒪 100% 李⑤떒

- **利앹긽**: SpaceX/Boeing/NASA 愿???댁뒪媛 ?붾젅洹몃옩 ?꾪꽣?먯꽌 ?꾨? 李⑤떒??
- **洹쇰낯 ?먯씤**: `relevantKW`??space, rocket, satellite, NASA, SpaceX, Boeing ???곗＜/??났 ?ㅼ썙?쒓? ???섎굹???놁뿀??
- **?섏젙**: ?곷Ц 18媛?+ ?쒓뎅??19媛??곗＜/??났?곗＜ ?ㅼ썙??異붽?.
- **?⑦꽩**: P12 ???덈줈???뱁꽣/?뚮쭏 遺????relevantKW ?낅뜲?댄듃 ?꾩슂. ?뺢린?곸쑝濡?梨꾨꼸 ?ㅼ젣 ?ъ뒪?몄? ?꾪꽣 寃곌낵 ?議??꾩슂.

---

## [2026-03-25] v33.1 ??SEC EDGAR CORS ?ㅽ뙣 + API 諛섑솚媛?遺덉씪移?+ ?щТ移대뱶 ?대갚 遺??

- **利앹긽**: 湲곗뾽 遺꾩꽍 ??뿉??SEC ?곗씠??濡쒕뱶 ?ㅽ뙣, ?щТ 移대뱶 ?꾨? $0.00/N/A.
- **洹쇰낯 ?먯씤**: (1) `data.sec.gov/api/xbrl/companyfacts` CORS 誘몄?????`fetchViaProxy()` ?대갚 ?놁뿀?? (2) `fetchSECFinancials`媛 `{ticker, cik, revenues}` 諛섑솚?섏?留?`_parseSECFinancials`??`{facts: {'us-gaap': ...}}` 湲곕? ????긽 null 諛섑솚. (3) `_renderFundFinancials`??SEC ?곗씠???대갚 ?놁쓬.
- **?섏젙**: (1) CORS ?꾨줉???대갚 異붽?. (2) raw XBRL ?곗씠??諛섑솚?쇰줈 蹂寃? (3) SEC 湲곕컲 ?щТ 吏??怨꾩궛 ?대갚 異붽?.
- **?⑦꽩**: P13 ??API ?⑥닔? ?뚯꽌 ?⑥닔 媛?諛섑솚媛?湲곕?媛?遺덉씪移? ?⑥닔 ?섏젙 ???몄텧?먯? ?쇳샇異쒖옄 ?묒そ???명꽣?섏씠???뺤씤 ?꾩닔.

---

## [2026-03-25] v32.1 ??珥덈낫??紐⑤뱶 ?먯? ??localStorage 留덉씠洹몃젅?댁뀡

- **利앹긽**: 湲곗〈 ?ъ슜?먭? `aio_beginner=1` ?곹깭濡?諛⑸Ц ?? ??肄붾뱶?먯꽌 `aio_beginner` ?ㅻ? ?쎌? ?딆쑝誘濡??붾쪟 ?곗씠??諛쒖깮.
- **洹쇰낯 ?먯씤**: `toggleBeginnerMode()` ?쒓굅 ??`aio_beginner` localStorage ???뺣━ 誘몄닔??
- **?섏젙**: `setAnalysisLevel()` 珥덇린??釉붾줉?먯꽌 `aio_beginner` ??議댁옱 ????젣?섎뒗 留덉씠洹몃젅?댁뀡 濡쒖쭅 異붽?.
- **?⑦꽩**: P10 ??湲곕뒫 ?쒓굅 ??愿??localStorage/sessionStorage ???뺣━ ?꾩닔.

---

## [2026-03-25] v32 ???쒓뎅 湲곗닠 遺꾩꽍 ?섏씠吏 DOM target 遺덉씪移?(?덈갑 ?섏젙)

- **利앹긽**: `analyzeKrTickerDeep()`媛 `#ticker-analysis-result`瑜?target?쇰줈 ?ъ슜 ???쒓뎅 湲곗닠 遺꾩꽍 ?섏씠吏(`page-kr-technical`)???ㅼ젣 寃곌낵 div??`#kr-ticker-analysis-result`.
- **洹쇰낯 ?먯씤**: US 遺꾩꽍 ?⑥닔(`analyzeTickerDeep`)瑜?蹂듭젣?섏뿬 KR 踰꾩쟾??留뚮뱾 ?? target element ID瑜??쒓뎅 ?섏씠吏?⑹쑝濡?蹂寃쏀븯吏 ?딆쓬.
- **?섏젙**: `analyzeKrTickerDeep()`??target??`#kr-ticker-analysis-result`濡?蹂寃? fallback?쇰줈 `#ticker-analysis-result` ?좎?.
- **?⑦꽩**: ?⑥닔 蹂듭젣 ??target element ID 誘몃?寃???蹂듭젣 湲곕컲 ?⑥닔??紐⑤뱺 DOM 李몄“瑜?援먯감 ?뺤씤 ?꾩닔.

---

## [2026-03-25] v31.10 ??OPTIONS ?섏씠吏 ?꾩껜 ?섎뱶肄붾뵫 (Dead Page)

- **利앹긽**: ?듭뀡 遺꾩꽍 ?섏씠吏??紐⑤뱺 ?섏튂(VIX 26.78, VVIX 126.28, IV Rank 72, GEX -12.8B, Greeks, ?ㅽ걧 ??媛 ?섎뱶肄붾뵫. init ?⑥닔 ?놁쓬, pageShown/liveQuotes 由ъ뒪???놁쓬.
- **洹쇰낯 ?먯씤**: OPTIONS ?섏씠吏媛 ?뺤쟻 HTML濡쒕쭔 援ъ꽦. `initOptionsPage()` 遺?? 臾대즺 API濡??듭뀡 ?꾩슜 ?곗씠??IV surface, Greeks, GEX) 媛?몄삱 ???녿뒗 援ъ“???쒓퀎 誘멸퀬??
- **?섏젙**: `initOptionsPage()` ?⑥닔 + pageShown/liveQuotes 由ъ뒪??異붽?. VIX/VVIX ?ㅼ떆媛??곕룞. ?섎㉧吏??"李멸퀬?? 怨좎? 諛곕꼫 ?쒖떆.
- **?⑦꽩**: P9 ???섏씠吏 HTML留?議댁옱?섍퀬 珥덇린???대깽??由ъ뒪?덇? ?녿뒗 "Dead Page"

---

## [2026-03-25] v31.10 ??PORTFOLIO ?섏씠吏 泥?吏꾩엯 ??鍮??붾㈃

- **利앹긽**: ?ы듃?대━???섏씠吏 泥?吏꾩엯 ??鍮??붾㈃. liveQuotes 媛깆떊(60珥? ?꾩뿉???뚮뜑留?
- **洹쇰낯 ?먯씤**: `aio:pageShown` 由ъ뒪??誘몃벑濡? liveQuotes留??덉뼱 泥?吏꾩엯 ??renderPortfolio() 誘명샇異?
- **?섏젙**: pageShown 由ъ뒪??異붽? ??portfolio 吏꾩엯 ??利됱떆 renderPortfolio() ?몄텧.
- **?⑦꽩**: P9 ?숈씪.

---

## [2026-03-25] v31.9 ????AAII ?щ━ 移대뱶 鍮??붾㈃ (李⑦듃 誘몃젋?붾쭅)

- **利앹긽**: ???섏씠吏??AAII ?ъ옄?щ━ 移대뱶??李⑦듃媛 鍮?罹붾쾭?ㅻ줈 ?쒖떆?? ?곗씠?곕뒗 ?뺤긽 濡쒕뱶?섏뿀?쇰굹 ?쒓컖?곸쑝濡?鍮?移대뱶.
- **洹쇰낯 ?먯씤**:
  1. `initSentimentCharts()`媛 DOMContentLoaded?먯꽌 ?몄텧?섎굹, Chart.js CDN 濡쒕뱶媛 ?먮┫ 寃쎌슦 `Chart`媛 undefined ??李⑦듃 ?앹꽦 ?ㅽ뙣
  2. ?ㅽ뙣 ???먮윭媛 try-catch???섑빐 議곗슜??臾댁떆?????ъ떆??硫붿빱?덉쬁 ?놁쓬
  3. 罹붾쾭???꾨옒 ?띿뒪???대갚???놁뼱 李⑦듃 ?ㅽ뙣 ??移대뱶 ?꾩껜媛 鍮??곹깭
- **?볦튇 ?댁쑀**:
  - CDN??鍮좊? ?뚮뒗 ?뺤긽 ?묐룞 ??媛꾪뿉???ы쁽
  - ???섏씠吏??AAII 移대뱶??誘몃땲 ?꾨━酉곗슜?대씪 QA ??sentiment ?섏씠吏留??뺤씤?섎뒗 寃쏀뼢
  - 湲곗〈 QA??"CDN 吏????李⑦듃 ?뚮뜑留??ㅽ뙣" ?쒕굹由ъ삤 ?놁뿀??
- **?섏젙 ?댁슜**:
  1. 罹붾쾭???꾨옒??bear%/bull%/signal ?띿뒪???대갚 異붽? ??李⑦듃 ?ㅽ뙣?대룄 ?섏튂 ?쒖떆
  2. 2珥??쒕젅????`sentPageCharts['aaii']` 議댁옱 ?щ? 泥댄겕 ???놁쑝硫??ъ떆??
  3. ?띿뒪???대갚 媛믪씠 李⑦듃 ?곗씠??濡쒕뱶 ???숈쟻 ?낅뜲?댄듃
- **?덈갑 洹쒖튃**: 李⑦듃 ?섏〈 移대뱶?먮뒗 諛섎뱶???띿뒪???대갚 ?쒓났. CDN 吏???鍮?retry 硫붿빱?덉쬁 ?꾩닔.
- **QA 泥댄겕由ъ뒪??異붽?**: "???섏씠吏 AAII 移대뱶???섏튂 ?띿뒪?멸? ?쒖떆?섎뒗吏 ?뺤씤 (李⑦듃 ?놁씠??"

---

## [2026-03-25] v31.9 ??Market Breadth 諛곗? ?띿뒪?멸? 諛?李⑦듃? 寃뱀묠

- **利앹긽**: Market Breadth ?뱀뀡?먯꽌 "踰좎뼱 ?ㅼ씠踰꾩쟾?? ??湲??쒓뎅??諛곗? ?띿뒪?멸? 諛?李⑦듃 ?곸뿭??移⑤쾾?섏뿬 寃뱀묠. ?띿뒪?멸? 李⑦듃 ?꾩뿉 ?쒖떆?섏뼱 媛?낆꽦 ?ш컖 ???
- **洹쇰낯 ?먯씤**:
  1. `grid-template-columns: 110px 1fr 52px 72px` ??諛곗? 而щ읆(72px)???쒓뎅???띿뒪????~96px)蹂대떎 醫곸쓬
  2. `white-space: nowrap` ?놁씠 ?띿뒪?멸? 以꾨컮轅덈릺嫄곕굹, nowrap?몃뜲 overflow 泥섎━ ?놁뼱 ?몄젒 而щ읆 移⑤쾾
  3. ?쒓뎅???띿뒪?몃뒗 媛숈? 湲?????鍮??쇳떞 臾몄옄??~1.5諛??????곷Ц 湲곗? ?ㅺ퀎??而щ읆?먯꽌 ?ㅻ쾭?뚮줈??
- **?볦튇 ?댁쑀**:
  - ?곷Ц ?곗씠??"Bearish Divergence" ??濡?媛쒕컻/?뚯뒪?????쒓뎅??踰덉뿭 ????誘멸?利?
  - grid ???`overflow: hidden` + `text-overflow: ellipsis` 誘몄쟻??
  - 湲곗〈 QA??"?쒓뎅???띿뒪????씠 怨좎젙??而щ읆??珥덇낵?섎뒗吏" 寃利???ぉ ?놁뿀??
- **?섏젙 ?댁슜**:
  1. grid 而щ읆 議곗젙: `110px 1fr 52px 72px` ??`120px 1fr 44px 80px`
  2. `.bb-badge`??`white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px`
  3. "踰좎뼱 ?ㅼ씠踰꾩쟾?? ??"踰좎뼱 ?ㅼ씠踰? ?쎌뼱 ?곸슜 (諛곗? 怨듦컙 ???섏슜)
  4. 768px/480px 諛섏쓳??釉뚮젅?댄겕?ъ씤?몄뿉??而щ읆 異붽? 異뺤냼
- **?덈갑 洹쒖튃**: **P7** ??怨좎젙??CSS grid 而щ읆? ?쒓뎅???띿뒪??理쒕? ??湲?먯닔 횞 ~14px)??湲곗??쇰줈 ?ㅺ퀎. `text-overflow: ellipsis` ?꾩닔 ?곸슜.
- **QA 泥댄겕由ъ뒪??異붽?**: "紐⑤뱺 怨좎젙??grid ??먯꽌 ?쒓뎅???띿뒪?멸? ?섏튂嫄곕굹 ?몄젒 ???移⑤쾾?섏? ?딅뒗吏 ?뺤씤"

---

## [2026-03-25] v31.5 ???곗씠???뚯씠?꾨씪??遺덊븘???ㅽ뙣 ?붿껌 ???諛쒖깮

- **利앹긽**: ?섏씠吏 濡쒕뵫 ??肄섏넄??503/429 ?먮윭 100嫄??댁긽 諛쒖깮. RSS2JSON 429 rate limit, Yahoo Finance 吏곸젒 ?몄텧 503, FRED 吏곸젒 ?몄텧 503. CF Worker媛 ?ㅼ젙?섏뼱 ?덉쓬?먮룄 紐⑤뱺 API媛 癒쇱? 吏곸젒 ?몄텧???쒕룄?섏뿬 ?ㅽ뙣 ?꾩뿉??CF Worker濡??대갚.
- **洹쇰낯 ?먯씤**:
  1. RSS2JSON: CF Worker媛 XML ?뚯떛 媛?ν븳?곕룄, rss2json????긽 ?곗꽑 ?쒕룄 ??429 rate limit
  2. FRED: `fetchFredSeries()`媛 吏곸젒 ?몄텧(CORS 李⑤떒????癒쇱? ?쒕룄 ??503 ??CF Worker ?대갚
  3. Yahoo Finance: 留??щ낵(100+)留덈떎 吏곸젒 fetch ?쒕룄 ??503 ??CF Worker ?대갚 (?щ낵??1嫄???퉬)
  4. Staleness 諛곕꼫: `DATA_SNAPSHOT._updated`媛 30?쒓컙 ?꾩씠硫??ㅼ떆媛??곗씠???섏떊 ?꾩뿉??寃쎄퀬 諛곕꼫 誘명빐??
- **?볦튇 ?댁쑀**:
  - CF Worker ?꾩엯(v30 ?쒖젏) ??湲곗〈 ?대갚 濡쒖쭅??CF Worker ?곗꽑?쇰줈 由ы뙥?좊쭅?섏? ?딆쓬
  - 吏곸젒 ?몄텧??CORS 李⑤떒??"?덉긽???ㅽ뙣"濡?諛⑹튂?????깅뒫 ?곹뼢 誘몄씤??
  - rss2json free tier ?쒕룄(10req/min)瑜?CF Worker ?泥?媛???쒖젏?먯꽌 誘몄젣嫄?
- **?섏젙 ?댁슜**:
  1. RSS2JSON: `_hasCfWorker` ?뚮옒洹몃줈 CF Worker 議댁옱 ??rss2json ?꾩쟾 嫄대꼫?
  2. FRED: `fetchFredSeries()` ?대???CF Worker ?곗꽑 ?몄텧 異붽? (1李?CF ??2李?吏곸젒 ??3李?CORS ?꾨줉??
  3. Yahoo: `_skipDirect` ?뚮옒洹몃줈 CF Worker 議댁옱 ??吏곸젒 ?몄텧 嫄대꼫? ??利됱떆 CF Worker ?ъ슜
  4. Staleness: 12珥???`_quoteTimestamps` ?뺤씤, 120珥??대궡 ?곗씠???덉쑝硫?諛곕꼫 ?먮룞 ?④?
- **?덈갑 洹쒖튃**: **P6** ?????명봽??CF Worker ?? ?꾩엯 ?? 湲곗〈 ?대갚 泥댁씤???곗꽑?쒖쐞瑜?諛섎뱶???щ같移?
- **QA 泥댄겕由ъ뒪??異붽?**: "CF Worker ?ㅼ젙 ??吏곸젒 ?몄텧 503/429媛 肄섏넄??諛쒖깮?섏? ?딅뒗吏 ?뺤씤"

---

## [2026-03-25] v31.2 ???쒓렇???섏씠吏 鍮??щ갚 怨듦컙

- **利앹긽**: ?쒓렇???섏씠吏 "醫낇빀 嫄곕옒 ?먯닔" 寃뚯씠吏 ?ㅻⅨ履쎌뿉 嫄곕???鍮?怨듦컙. "[?꾧툑 ?뺣낫]" 諛곕꼫媛 1以꾩씤???곸뿭??寃뚯씠吏 ?믪씠留뚰겮 ?몃줈濡??섏뼱??
- **洹쇰낯 ?먯씤**: JS?먯꽌 `signal-advice` 諛곕꼫瑜??숈쟻 ?앹꽦???? `scoreCard.after(adviceEl)` 濡??쎌엯 ???쎌엯 ?꾩튂媛 `grid-template-columns: 200px 1fr` **grid 而⑦뀒?대꼫 ?대?**?????諛곕꼫媛 grid??1fr 移몄뿉 ?ㅼ뼱媛硫댁꽌 ?쇱そ 200px 寃뚯씠吏 ?믪씠??留욎떠 ?몃줈濡??ㅽ듃?덉묶??
- **?볦튇 ?댁쑀**:
  - `closest('[style*="display"]')` ?좏깮?먭? ?대뒓 遺紐⑤? ?〓뒗吏 ?ㅼ젣 DOM?먯꽌 誘명솗??
  - ?숈쟻 ?쎌엯 肄붾뱶媛 grid/flex 而⑦뀒?대꼫 ?덉뿉 ?ㅼ뼱媛?붿? **?뺤쟻 遺꾩꽍留뚯쑝濡쒕뒗 ?뚯븙 ?대젮?**
  - 湲곗〈 QA 泥댄겕由ъ뒪?몄뿉 "?숈쟻 DOM ?쎌엯 ?꾩튂??遺紐??덉씠?꾩썐 ?뺤씤" ??ぉ ?놁뿀??
- **?섏젙 ?댁슜**: grid 諛붽묑???꾩슜 `<div id="signal-advice-container">` ?앹꽦 ??JS?먯꽌 ?대떦 而⑦뀒?대꼫??innerHTML濡?諛곕꼫 ?뚮뜑留?
- **?덈갑 洹쒖튃**: **R4** ??JS?먯꽌 ?숈쟻 DOM ?쎌엯 ?? ?쎌엯 ??곸쓽 遺紐④? flex/grid 而⑦뀒?대꼫?몄? 諛섎뱶???뺤씤
- **QA 泥댄겕由ъ뒪??異붽?**: "?숈쟻 ?앹꽦 ?붿냼媛 grid/flex ?덉씠?꾩썐??源⑤쑉由ъ? ?딅뒗吏 ?뺤씤"

---

## [2026-03-25] v31.1 ??AI 梨??묐떟 媛濡??띿뒪??(?몃줈媛 ?꾨땶 媛濡쒕줈 ?쒖떆)

- **利앹긽**: ?ы듃?대━??AI 遺꾩꽍 ??梨꾪똿?먯꽌 LLM ?묐떟???몃줈媛 ?꾨땶 媛濡?而щ읆)濡??쒖떆?? ?띿뒪?멸? 醫곸? 而щ읆?ㅻ줈 履쇨컻???꾟넂?꾨옒媛 ?꾨땶 醫뚢넂?곕줈 ?쏀????섎뒗 ?뺥깭.
- **洹쇰낯 ?먯씤**:
  1. ?쒖뒪???꾨＼?꾪듃?먯꽌 ?뚯씠釉?湲덉? 洹쒖튃???덉뿀?쇰굹, Claude媛 ?뚮븣濡?臾댁떆?섍퀬 markdown ?뚯씠釉??앹꽦
  2. `renderMarkdownLight`媛 ?대떦 ?뚯씠釉붿쓣 `<table>` 濡?異⑹떎???뚮뜑留?
  3. ?뚯씠釉?而щ읆??6媛??댁긽??寃쎌슦 醫곸? `.acp-bubble` ?덉뿉??媛????洹밸떒?곸쑝濡?醫곸븘吏?
  4. `.chat-tbl th`??`white-space:nowrap` ?????以꾨컮轅?遺덇? ???뚯씠釉붿씠 而⑦뀒?대꼫蹂대떎 ?볦뼱吏?
  5. `.aio-chat`??`overflow:hidden` ???섏튇 遺遺??섎┝
  6. 紐⑤뱺 梨꾪똿 硫붿떆吏 ?곸뿭???섎떒 ?щ갚(padding-bottom) 遺議???留덉?留?硫붿떆吏媛 ?낅젰李쎌뿉 媛?ㅼ쭚
- **?볦튇 ?댁쑀**:
  - LLM ?묐떟? 鍮꾧껐?뺤쟻 ???뱀젙 吏덈Ц?먯꽌留??뚯씠釉??앹꽦 ???⑥닚 肄붾뱶 由щ럭濡?諛쒓껄 遺덇?
  - `.chat-tbl th`??`white-space:nowrap`???먮옒 ?ㅻ뜑 媛?낆꽦???꾪븳 寃껋씠?덉쑝??遺?묒슜 誘멸퀬??
  - 湲곗〈 QA??"LLM??湲덉????щ㎎???ъ슜???뚯쓽 諛⑹뼱 ?뚮뜑留? ?뚯뒪???놁뿀??
- **?섏젙 ?댁슜**:
  1. `.acp-bubble`??`overflow-x:auto; white-space:normal` 異붽?
  2. `.chat-tbl th/td`??`white-space:normal; word-break:break-word; max-width:200px`
  3. `renderMarkdownLight`?먯꽌 5而щ읆 珥덇낵 ?뚯씠釉???移대뱶??由ъ뒪???먮룞 蹂??
  4. ?쒖뒪???꾨＼?꾪듃???泥??щ㎎ 3媛吏 援ъ껜??紐낆떆
  5. 紐⑤뱺 梨꾪똿 ?곸뿭(`acp-messages`, `chat-signal-msgs`, `chat-fxbond-msgs`, `chat-screener-msgs`)??padding-bottom 異붽?
- **?덈갑 洹쒖튃**: **R5** (overflow 3以?諛⑹뼱), **R6** (LLM ?묐떟 ?뚮뜑留??덉쟾?μ튂)
- **QA 泥댄겕由ъ뒪??異붽?**: "AI 梨꾪똿?먯꽌 湲??뚯씠釉?蹂듭옟??留덊겕?ㅼ슫 ?묐떟 ???뚮뜑留?源⑥쭚 ?녿뒗吏 ?뺤씤"

---

## [2026-03-25] v31 ??踰꾩쟾 遺덉씪移?(v30.15 ?쒓린?몃뜲 ?ㅼ젣 ?뚯씪 ?놁쓬)

- **利앹긽**: v30.15瑜??щ졇?ㅺ퀬 ?덈뒗???ㅼ젣 ?뚯씪??議댁옱?섏? ?딆쓬. title/badge留?v30.15濡?諛붽엥怨? ?뚯씪 ?댁슜? v30.13怨??숈씪.
- **洹쇰낯 ?먯씤**: 肄붾뱶 ?댁슜 蹂寃??놁씠 title/badge??踰꾩쟾 踰덊샇留??щ┝. ?ㅼ젣 versioned ?뚯씪(aio_ui_prototype_v30_15.html) 誘몄깮??
- **?볦튇 ?댁쑀**: 踰꾩쟾 ?숆린?붾? 泥댄겕?섎뒗 ?덉감媛 ?놁뿀?? "title ?섏젙 = ??踰꾩쟾"?대씪???섎せ??愿??
- **?섏젙 ?댁슜**: 踰꾩쟾 泥닿퀎 蹂寃?(?뚯닔??1?먮━ ?쒖젙) + 4怨??숆린??寃利??덉감 ?꾩엯
- **?덈갑 洹쒖튃**: **R1** (踰꾩쟾 ?숆린??4怨??뺤씤), **R2** (踰꾩쟾 泥닿퀎)

---

## [2026-04-05] v41.8 -- 3嫄?媛먯궗 由ы룷??諛섏쁺: 醫낅ぉ ?덉쭏 ?섏젙 + ?뚮쭏 媛以묒튂 ?щ텇諛?+ CSS 洹몃━???뺣젹

### Bug 1: streaming ?쒕툕?뚮쭏 weights PARA->PSKY ??遺덉씪移?
- **利앹긽**: PSKY ?곗빱??tickers 諛곗뿴???덉쑝??weights?먮뒗 PARA ???붿〈 -> PSKY 媛以묒튂 0% 泥섎━
- **洹쇰낯 ?먯씤**: Paramount->Skydance ?⑸퀝?쇰줈 PARA->PSKY ?곗빱 蹂寃???tickers留??낅뜲?댄듃, weights ??誘몃?寃?
- **?볦튇 ?댁쑀**: tickers? weights瑜?蹂꾨룄 媛앹껜濡?愿由ы븯誘濡??쒖そ留??섏젙?대룄 JS ?먮윭 誘몃컻??
- **?섏젙 ?댁슜**: `weights:{...PARA:10}` -> `weights:{...PSKY:10}`
- **?덈갑 洹쒖튃**: ?곗빱 蹂寃???tickers/weights/leaders 3怨??숈떆 寃利??꾩닔
- **violated_rule**: ?좉퇋 (Data Consistency -- ticker rename propagation)

### Bug 2: KR 醫낅ぉ pill CSS Grid ??遺덉씪移?(display:none ?먯떇)
- **利앹긽**: 醫낅ぉ pill?먯꽌 ?대쫫/媛以묒튂/媛寃??깅씫瑜??댁씠 ?ㅼ＝諛뺤＝ ?뺣젹
- **洹쇰낯 ?먯씤**: `.kr-ticker-pill` grid-template-columns媛 `auto 1fr auto auto`?몃뜲, 泥レ㎏ ?먯떇 `.pill-code`媛 `display:none` -> grid??李몄뿬?섏? ?딆븘 pill-name??auto ?댁뿉 諛곗튂?섏뼱 ?뺣젹 ?뚭눼
- **?볦튇 ?댁쑀**: display:none ?먯떇??grid 諛곗튂?먯꽌 ?쒖쇅?섎뒗 CSS ?ъ뼇??媛꾧낵
- **?섏젙 ?댁슜**: grid瑜?`1fr auto auto auto`濡?蹂寃?+ `::before` pseudo-element濡?媛以묒튂 鍮꾨? 諛곌꼍 諛?異붽? + pill-price/pill-pct??min-width 吏??
- **?덈갑 洹쒖튃**: CSS Grid?먯꽌 `display:none` ?먯떇? ??諛곗튂?먯꽌 ?꾩쟾???쒖쇅?? grid ?ㅺ퀎 ???④? ?먯떇 怨좊젮 ?꾩닔
- **violated_rule**: R4 (?숈쟻 DOM/display ?곹깭媛 ?덉씠?꾩썐??誘몄튂???곹뼢)

### 醫낅ぉ ?덉쭏 ?섏젙 (媛먯궗 由ы룷??湲곕컲)
- **SSNLF ?쒓굅** (memory, foundry): OTC ADR, 洹뱁엳 ??? ?좊룞?? ?쒖꽭 ?섏떊 遺덉븞?? 鍮꾩쨷 MU/STX/WDC ?щ텇諛?
- **LCID ?쒓굅** (ev_auto): Altman Z-Score -3.10, ??갑??二쇱떇遺꾪븷, ?쒖씠?듬쪧 -290%. 5媛?quick-access 諛곗뿴?먯꽌???쒓굅
- **STEM ?쒓굅** (hydrogen_ess): NYSE ?곸옣?좎?湲곗? 誘몃떖, ?뚯궛?뺣쪧 84%. FLNC(Fluence Energy) ?泥?異붽?
- **U ?쒓굅** (gaming): Runtime Fee ?쇰?, 媛쒕컻???좊ː ?곸떎, ?섏씡??誘명솗蹂?
- **BTBT/HUT/APLD ?쒓굅** (neocloud): ?ㅼ쭏 AI 留ㅼ텧 誘몃?, ?먭툑 遺議??곕젮
- **PLUG w:28->25, FCEL w:24->15** (hydrogen_ess): BE w:35濡?鍮꾩쨷 ?뺣?
- **SEDG w:16->8** (solar_renew): ?좊읇 ?몃쾭???ш퀬 怨쇱엵, ?곸옄 ?꾪솚
- **photonics_kr 12->4醫낅ぉ**: ?쒖킑 200??誘몃쭔 珥덉냼?뺤＜ 8媛??쒓굅, ?좊━??耳?댁뿞?붾툝??RFHIC/?ㅼ씠?붾（?섎쭔 ?좎?
- **crypto 移댁뭅??w:30->15**: ?щ┰??留ㅼ텧 鍮꾩쨷 洹뱀냼, ?꾨찓?대뱶 w:25->35 ?밴꺽
- **KR_STOCK_DB theme 諛곗뿴 6嫄??섏젙**: POSCO??⑹뒪, LG?뷀븰, ?쒗솕?붾（?? ?꾨?湲濡쒕퉬?? 由ш?耳먮컮?댁삤, SK?대끂踰좎씠??

### 遺꾩꽍 濡쒖쭅 媛쒖꽑
- **SPY ATH ?숈쟻 異붿쟻**: ?섎뱶肄붾뵫 640 -> localStorage 湲곕컲 ?숈쟻 媛깆떊
- **calcCompositePerf 媛以묒튂 ?대갚**: sqrt(price) -> SCREENER_DB mcap 湲곕컲 (?뺥솗???μ긽)

---

## ?⑦꽩 ?붿빟 (?먯＜ 諛섎났?섎뒗 洹쇰낯 ?먯씤)

| # | ?⑦꽩 | 諛쒖깮 ?잛닔 | ?ш컖??|
|---|------|----------|--------|
| P1 | ?숈쟻 DOM ?쎌엯??grid/flex ?덉씠?꾩썐 ?뚭눼 | 1 | ?믪쓬 |
| P2 | overflow 誘몄꽕?뺤쑝濡?肄섑뀗痢??섏묠/?섎┝ | 2+ | ?믪쓬 |
| P3 | LLM 鍮꾧껐?뺤쟻 異쒕젰?????諛⑹뼱 ?뚮뜑留?遺議?| 1 | 以묎컙 |
| P4 | 踰꾩쟾 ?쒓린? ?ㅼ젣 ?댁슜 遺덉씪移?| 2+ | ?믪쓬 |
| P5 | 肄붾뱶 蹂寃???釉뚮씪?곗? ?ㅼ젣 ?뺤씤 誘몄떎??| ?ㅼ닔 | ?믪쓬 |
| P6 | ???명봽???꾩엯 ??湲곗〈 ?대갚 ?곗꽑?쒖쐞 誘몄옱諛곗튂 | 1 | ?믪쓬 |
| P7 | 怨좎젙??grid 而щ읆???쒓뎅???띿뒪????誘몄닔??| 1 | 以묎컙 |
| P8 | CDN 吏????李⑦듃 ?뚮뜑留??ㅽ뙣 + ?띿뒪???대갚 遺??| 1 | 以묎컙 |
| P9 | ?섏씠吏 HTML留?議댁옱, init ?⑥닔/?대깽??由ъ뒪???꾨씫 (Dead Page) | 2 | ?믪쓬 |
| P15 | API ?붾뱶?ъ씤???좏깮怨??곗씠???쇰꺼 遺덉씪移?(TTM vs Annual) | 3+ | ?믪쓬 |
| P16 | JS falsy 媛?0, "") 泥섎━ ?ㅼ닔 (`\|\| null`, `!val` ?? | 3+ | 以묎컙 |
| P17 | Phantom Ticker ??醫낅ぉ肄붾뱶 誘멸?利??낅젰?쇰줈 ?ㅻⅨ ?뚯궗 ?곗씠???좎엯 | 1 | 留ㅼ슦 ?믪쓬 |
| P18 | Ghost Stock ??鍮꾩긽??湲곗뾽???곸옣 肄붾뱶??留ㅽ븨 | 1 | 留ㅼ슦 ?믪쓬 |
| P19 | Parent-Sub Confusion ???좎궗 ?대쫫 紐⑥옄?뚯궗 援щ텇 ?ㅽ뙣 | 1 | ?믪쓬 |
| P20 | 誘몄젙??蹂??李몄“ ??由ы뙥?좊쭅 ??蹂?섎챸 蹂寃??꾨씫 (qqq?뭠d['QQQ']) | 1 | ?믪쓬 |
| P23 | flex column?먯꽌 min-height:0 ?꾨씫 ??overflow ?ㅽ겕濡?誘몄옉??| 1 | 留ㅼ슦 ?믪쓬 |
| P39 | ?곗빱 rename ??tickers/weights/leaders 遺遺??꾪뙆 | 1 | ?믪쓬 |
| P40 | CSS Grid display:none ?먯떇????諛곗튂?먯꽌 ?쒖쇅?섏뼱 ?뺣젹 ?뚭눼 | 1 | ?믪쓬 |
| P41 | ?곹룓?꾪뿕/?뚯궛?꾪뿕/?좊룞?깅?議?醫낅ぉ 誘몄젣嫄?(SSNLF/LCID/STEM) | 1 | 以묎컙 |

---

## [2026-05-05] v48.77 audit - generated news retry handler P145

### BUG-P145: fallback news retry link kept inline onclick (MEDIUM)
- **violated_rule**: R28 / no inline event handlers
- **symptom**: Static QA found a dynamically rendered news failure fallback that inserted `<a onclick="window.isFetching=false;fetchAllNews(true);return false;">`. The initial live DOM can still report zero inline handlers because this path appears only after a specific news loading failure.
- **root cause**: Most retry states had already moved to `_aioRetryNews`, but this older fallback string was missed.
- **fix**: `js/aio-data.js` now renders `<a data-action="_aioRetryNews" data-prevent="1">`; modal/chat UI direct `.onclick` assignments now use `addEventListener`; Google Fonts no longer uses inline `onload`; earnings logo fallback uses `img[data-logo-fallback="1"]` plus a captured `error` listener.
- **prevention**: Static QA must scan source strings for `onclick=` as well as the rendered DOM.

---

## [2026-05-05] v48.77 audit - AI quota cancel modal P146

### BUG-P146: AI quota cancel button id mismatch can hang prompt promise (HIGH)
- **violated_rule**: R28 / modal action wiring must be browser-tested and id references must match DOM.
- **symptom**: `consumeLLMQuery()` waits for an over-budget confirmation promise and tries to attach a cancel resolver to `#aio-confirm-cancel`, but the confirm modal cancel button had no matching id.
- **root cause**: The generic confirm modal was rendered with only `data-action="closeConfirmModal"` while the AI quota flow expected a specific cancel button id.
- **fix**: Added `id="aio-confirm-cancel"` to the confirm modal cancel button.
- **prevention**: Static QA must compare literal `getElementById()` references against actual DOM ids, then manually classify dynamic ids vs missing ids.

---

## [2026-05-05] v48.77 audit - signal mode active class P147

### BUG-P147: signal mode toggle only changed inline colors, not active class (MEDIUM)
- **violated_rule**: R28 / UI state must be verifiable by DOM state as well as visual styling.
- **symptom**: Browser QA showed `toggleSignalMode('day')` did not make the day-trading button carry the active `primary` class, while swing restored `primary`. The mode changed visually through inline colors, but class-based state was stale.
- **root cause**: `toggleSignalMode()` updated `style.background` and `style.color` only.
- **fix**: `toggleSignalMode()` now adds/removes `primary` on `#sig-sw-btn` and `#sig-dy-btn` in sync with the selected mode.
- **prevention**: For segmented controls, update both visual styling and semantic/class state so automated QA and CSS selectors agree.

---

## [2026-05-05] v48.77 audit - sector 20d chart fallback P148

### BUG-P148: sector 20-day chart could stay blank when all proxy fetches fail (MEDIUM)
- **violated_rule**: R6 / external data charts need an honest fallback path when proxy sources fail.
- **symptom**: Browser QA showed `#sector-20d-chart` remained blank after sector page activation when every Yahoo chart proxy call failed.
- **root cause**: `_loadSector20dChart()` set a failure status and returned before creating a chart when no live sector datasets were collected.
- **fix**: `_loadSector20dChart()` now builds deterministic dashed fallback trend lines from `_SECTOR_PCT_FALLBACK` and renders them on the same canvas, while the status text marks that the live collection failed.
- **prevention**: Canvas QA should force blocked-network/fetch-failure paths, not only happy-path live data.

---

## [2026-05-05] v48.77 audit - mobile layout deep QA P149

### BUG-P149: mobile onboarding controls and theme chips could overlap or clip (LOW)
- **violated_rule**: R28 / mobile visual QA must include narrow-width interaction controls.
- **symptom**: Deep browser QA found the API onboarding "?ㅼ젙?섎윭 媛湲? link and "?リ린" button overlapped on mobile, and `#chat-theme-detail-chips` had slight horizontal clipping.
- **root cause**: The onboarding controls were inline with a fixed left margin, and global mobile `.acp-chips` forced `nowrap` for horizontal scrolling even where the chip row naturally fits better as wrapped controls.
- **fix**: Added `.onboarding-actions` with mobile wrapping and a page-specific mobile override so theme-detail chips wrap without horizontal clipping.
- **prevention**: Run desktop/mobile clipping and interactive-overlap checks for every page after UI edits.

---

## [2026-05-07] v48.85 price/percent pipeline semantics P154

### BUG-P154: quote, FX, KR, and chart paths still normalized missing percent to zero (MEDIUM)
- **violated_rule**: R15 / missing data must not be rendered or analyzed as a true 0% move.
- **symptom**: After the first chart/quote fix, several side paths could still convert unavailable percent change into `0`: `PriceStore.set()` normalized non-numeric pct to 0, Finnhub trade ticks supplied price-only updates as 0%, Yahoo/Naver/Stooq fallback constructors used 0 for missing or invalid percent, FX rates without a prior close returned 0%, and KR health used truthy pct checks that treated real 0.00% as fallback.
- **root cause**: Percent semantics were fixed at the render edge first, but the store and fallback constructors still had older ?쐓afe number??defaults. That made different pages disagree about whether a symbol was unchanged or simply missing change data.
- **fix**: `PriceStore.set()` now stores `pct: null` plus `pctMissing` metadata for missing/invalid pct and propagates it into `_liveData` and `_dataSource`. Yahoo, Finnhub, Naver, Stooq, FX, dynamic ticker lookup, and portfolio fallback paths now preserve `null` rather than synthesizing zero. KOSPI/KOSDAQ live change bindings and KR health pct checks were tightened, and benchmark/sector charts now guard invalid base prices before building percent series.
- **prevention**: Any quote or indicator constructor must treat `price` and `pct` as separate fields. Use `pct != null && isFinite(pct)` for logic; use `pctMissing` in audits; only write numeric `0` when the upstream explicitly reported an unchanged move.

---

## [2026-05-07] v48.84 chart/quote missing-data semantics P153

### BUG-P153: missing chart/quote data could be displayed as a real zero or flat move (MEDIUM)
- **violated_rule**: R15 / missing data must be visibly distinct from a true 0% or unchanged market reading.
- **symptom**: Chart arrays using `fillMode: 'prev'` could turn leading null/NaN values into `0`, making a partial dataset look like a valid flat zero line. Separately, live quote rows with price but no `regularMarketChangePercent` were skipped entirely or risked being normalized as `+0.00%`.
- **root cause**: `_sanitizeChartData()` initialized `lastValid` to `0`, and `chartDataGate()` padded missing tail values with `clean[clean.length - 1] || 0`. `applyLiveQuotes()` also treated price and percent as a single all-or-nothing pair.
- **fix**: Leading chart gaps now remain `null` until the first real value; padding keeps `null` if no prior value exists. `applyLiveQuotes()` accepts valid price-only quotes but renders change as `??, stores `pctMissing`, and exposes missing-percent samples in `AIO.getDataPipelineAudit()`.
- **prevention**: QA for charts, indicators, and quote tables must assert that ?쐌issing/unknown??is `null`, `??, or a warning state, never a synthetic zero unless the domain explicitly defines zero as the fallback.

---

## [2026-05-06] v48.82 data pipeline audit - source-to-render observability P152

### BUG-P152: source-to-render data lineage was not inspectable in one place (MEDIUM)
- **violated_rule**: R49 / data QA must verify the whole pipeline, not only final UI values or one successful fetch.
- **symptom**: API/source checks, proxy/cache status, refresh scheduler state, validation-store health, analysis function presence, and DOM/chart render sinks had to be inspected separately. During multi-worktree integration this made it too easy to miss a broken middle layer while the page still showed fallback values.
- **root cause**: Operational health and freshness audits covered app/SW/API/fallback status, but there was no source-to-render lineage snapshot that joined transport, stores, analysis functions, events, and render bindings.
- **fix**: Added `AIO.getDataPipelineAudit()` with `sources`, `transport`, `scheduler`, `validationStores`, `state`, `analysis`, and `render` layers; linked it into `AIO.getOperationalHealth()` and documented the layer map in `_context/DATA-PIPELINE-AUDIT-2026-05-06.md`.
- **prevention**: After API/source, analysis, or render changes, run `AIO.getDataPipelineAudit()` and check for missing functions, rejected store values, zero live/snapshot sink counts, and missing live bindings before deploy.

---

## [2026-05-06] v48.81 data freshness audit - partial live coverage P151

### BUG-P151: partial live quote success could hide stale snapshot data (HIGH)
- **violated_rule**: R49 / live data success must be evaluated by required coverage, not by any single API response.
- **symptom**: If crypto, FX, or a small subset of quotes loaded while core market symbols such as `^GSPC` and `^VIX` failed, `DATA_SNAPSHOT._isFallback` could be cleared and the stale snapshot banner could disappear even though major analysis, charts, and indicators were still driven by fallback data.
- **root cause**: `fetchLiveQuotes()` treated `allQuotes.length > 0` as full freshness, and `PriceStore.set()` flattened `_liveData` metadata so downstream logic had weaker source/timestamp evidence.
- **fix**: Added `AIO.getLiveCoverage()` and `AIO.getDataFreshnessAudit()`, preserved source/timestamp metadata in `_liveData`, kept fallback active on partial core coverage, passed coverage details through `aio:liveDataReceived`, and prevented the snapshot stale banner from hiding on partial live data. Also aligned US market-hour staleness checks to `America/New_York` and stopped reporting FRED as successful when no key/data is available.
- **prevention**: Quote pipeline QA must assert core coverage (`^GSPC`, `^VIX`, at least 50% of core symbols) before marking static snapshots as replaced; operational health snapshots must include data freshness, not only app/SW/API status.

## [2026-05-06] v48.80 operations audit - service worker drift P150

### BUG-P150: service worker cache namespace lagged behind app version (HIGH)
- **violated_rule**: R1 / `sw.js` is a deployment version sync point because it owns shell and data cache names.
- **symptom**: The app and `version.json` were already at v48.79, but `sw.js` still declared `SW_VERSION = 'v48.66'`. A deployed browser could keep using stale `aio-shell-v48.66` and `aio-data-v48.66` caches while the visible app version looked current.
- **root cause**: The post-release version checklist updated app-facing version points but did not treat the service worker as an operational release artifact.
- **fix**: Bumped the release to v48.80, synchronized `SW_VERSION`, added a `GET_HEALTH` service-worker message, surfaced SW/app version mismatch in the data status panel, and exposed `AIO.getOperationalHealth()` for one-call live readiness checks.
- **prevention**: Release QA must assert `APP_VERSION === version.json.version === SW_VERSION`; browser QA should also evaluate `AIO.getOperationalHealth()` after the service worker takes control.

---

## P213 쨌 v49.22 쨌 DATA_SNAPSHOT KR ?꾨뱶 vs DOM ?몃씪??遺덉씪移?

- **利앹긽**: applyDataSnapshot ??pre-JS ?곹깭?먯꽌 ?좎슜?붽퀬 31.7議곗썝(DOM) vs 19.8議곗썝(DATA_SNAPSHOT) 遺덉씪移??몄텧
- **?먯씤**: v48.61 P125?먯꽌 DATA_SNAPSHOT krCreditBalance쨌krDeposit ??蹂댁땐 ??DOM ?몃씪??fallback ?숆린???꾨씫
- **?섏젙**: DATA_SNAPSHOT 媛?媛깆떊(2026-05-16 湲곗?) + DOM ?몃씪???쇱튂??+ snap-dates 6怨?2026-04-17??026-05-16
- **?뚯씪**: `index.html` L10481~10535 쨌 `js/aio-core.js` DATA_SNAPSHOT L6012~6019
- **violated_rule**: R25(BUG-POSTMORTEM 湲곕줉) 쨌 R54(data-snap 蹂댁쑀 ?뱀뀡 snap-date 媛깆떊 ??DATA_SNAPSHOT ?숈떆 媛깆떊)
- **prevention**: snap-date 媛깆떊 ??DATA_SNAPSHOT ?대떦 ?ㅼ? DOM ?몃씪?몄쓣 3-way 寃利?snap-date/DATA_SNAPSHOT/DOM inline)

---

## P214 쨌 v49.22 쨌 options ?ㅻ깄??4怨?2026-04-17 (29??寃쎄낵)

- **利앹긽**: options ?섏씠吏 IV Rank/Skew/Flow/Greeks 4?뱀뀡 data-snap-date="option-snapshot" 紐⑤몢 2026-04-17 ??29??寃쎄낵
- **?먯씤**: "二쇨컙 ?섎룞 媛깆떊" ?뺤콉?대굹 snap-date ?먯껜 媛깆떊 ?꾨씫
- **?섏젙**: 4怨?snap-dates ??2026-05-16 쨌 skew ?댁꽍 ?띿뒪???꾩옱 ?쒖옣 ?섍꼍 諛섏쁺
- **?뚯씪**: `index.html` L9613/9738/9794/9885
- **violated_rule**: static_snapshot FRESHNESS_POLICY(1d fresh/3d stale/7d hardStale) ??29??寃쎄낵 hardStale
- **prevention**: options ?섏씠吏 二쇨컙 媛깆떊 泥댄겕由ъ뒪?몄뿉 snap-date 媛깆떊 ?ы븿

---

## P215 쨌 v49.22 쨌 signal/kr-macro ?쒖젏 ?섏〈 吏?뺥븰 ?쒕굹由ъ삤 (3媛쒖썡+ 寃쎄낵)

- **利앹긽**: ?대? ?ы삊?? ?몃Ⅴ臾댁쫰 ?댄삊 ??3媛쒖썡+ 寃쎄낵 ?쒕굹由ъ삤 ?띿뒪??3嫄??붿〈
- **?먯씤**: R54 ?쒖젙 ???쒖닠 ?띿뒪?몄뿉 data-snap ?놁뼱 freshness audit 誘몄쟻???곸뿭
- **?섏젙**: signal L5013/L5169 ??愿???묒긽 ?쇰컲??쨌 kr-macro L11213 ???먮꼫吏 怨듦툒 ?띿뒪??+ WTI/Brent ?꾩옱媛?
- **?뚯씪**: `index.html` L5013, L5169, L11213
- **violated_rule**: R54(data-snap ?녿뒗 ?쒖닠 ?띿뒪?몃뒗 媛쒕컻?먭? 二쇨린 寃??
- **prevention**: data-snap ?녿뒗 ?쒖닠 ?띿뒪???뱀뀡? AIO.getStaticDataGovernanceAudit()??live-like ?ㅼ썙??援?챸/?몃챸/媛寃? 異붽? ?먯?

---

## P216 쨌 v49.23 쨌 kr-technical ?좎슜?붽퀬 31.7議??섎뱶肄붾뵫

- **利앹긽**: kr-technical L11399 ?쒖옣 嫄닿컯 ?먯닔 ?꾩젽???좎슜?붽퀬 `31.7議?(?ъ긽理쒕?)` ?몃씪???섎뱶肄붾뵫 ??kr-home L10482??`19.2議곗썝`(v49.22 媛깆떊)怨?64.6% 愿대━
- **?먯씤**: v49.22媛 kr-home???좎슜?붽퀬 DOM/DATA_SNAPSHOT留?媛깆떊?섍퀬 kr-technical ?쒖옣 嫄닿컯???꾩젽? 蹂꾨룄 ?꾩튂???섎뱶肄붾뵫?섏뼱 ?꾨씫. cross-page ?숈씪 吏??異붿쟻 ?꾨씫.
- **?섏젙**: L11399??`data-snap="kr-credit"` ?띿꽦 異붽? + ?쒖떆媛믪쓣 `19.2議곗썝`?쇰줈 ?숆린????applyDataSnapshot???먮룞 媛깆떊
- **?뚯씪**: `index.html` L11399
- **violated_rule**: R54(data-aio-archive vs data-snap ?곸슜 湲곗?) + cross-page ?숈씪 吏???⑥씪???먯튃
- **prevention**: ?숈씪 吏???좎슜?붽퀬/?덊긽湲?F&G ??????긽 `data-snap` ?띿꽦?쇰줈 ?⑥씪?? ?몃씪???섎뱶肄붾뵫 湲덉?.

---

## P217 쨌 v49.23 쨌 kr-supply 二쇨컙 ?섍툒 ?뚯씠釉?2024-03 ?곗씠???붿〈

- **利앹긽**: kr-supply L10838~10843 二쇨컙 ?섍툒 ?뚯씠釉붿씠 `03/27, 03/26, 03/25, 03/24, 03/23` 2024??3??5嫄곕옒???곗씠?????꾩옱(2026-05-17) 湲곗? 2?? 寃쎄낵
- **?먯씤**: API 誘몄뿰???곸뿭???뺤쟻 ?대갚??KOSPI 湲됰씫 ?쒖젏(2024-03) ?쒕뱶濡??묒꽦 ??媛깆떊 ?꾨씫. `data-aio-archive` 留덊궧???꾨씫?섏뼱 freshness audit ??곸뿉???쒖쇅
- **?섏젙**: L10838~10843??2026-05-12 ~ 05-16(5嫄곕옒?? ?대갚 媛믪쑝濡?援먯껜 + ?⑷퀎 ?됰룄 ?뺥빀
- **?뚯씪**: `index.html` L10836~10843
- **violated_rule**: static_snapshot FRESHNESS_POLICY(7d hardStale) ??2?? hardStale + R54(?꾩뭅?대툕 留덊궧 遺??
- **prevention**: ?쇱씠釉?API 誘몄뿰???뺤쟻 ?대갚 ?뚯씠釉붿뿉??`data-aio-archive="true"` ?먮뒗 `data-snap-date` ?꾩닔 遺李? ?뺢린 寃????곸뿉 ?ы븿.

---

## P218 쨌 v49.23 쨌 F&G ?먯닔 ID ?댁썝??(#home-fg-score vs #fg-score-big)

- **利앹긽**: home ?섏씠吏 L4147 `#home-fg-score`????긽 `?? ?쒖떆, sentiment ?섏씠吏 L5720 `#fg-score-big`留??ㅼ떆媛?媛깆떊. ?숈씪 吏?쒓? ??ID濡?遺꾧린?섏뼱 home?먯꽌??臾댁슜
- **?먯씤**: `js/aio-data.js` updateFearGreed ?⑥닔媛 `#fg-score-big`留?媛깆떊. home ?섏씠吏 移대뱶??sentiment ?섏씠吏 吏꾩엯 ?몃━嫄??놁씠???곴뎄 placeholder
- **?섏젙**: aio-data.js???묒そ 媛깆떊 寃쎈줈(L11236, L11269)??`#home-fg-score` ?숈씪 媛?二쇱엯 肄붾뱶 異붽?
- **?뚯씪**: `js/aio-data.js` L11236~11239, L11269~11272
- **violated_rule**: ?숈씪 吏???ㅼ쨷 sink ?⑥씪???먯튃
- **prevention**: ?좉퇋 吏??異붽? ??紐⑤뱺 sink ?꾩튂瑜???踰덉뿉 ?깅줉(?? `_aioBindSink('fg-score', selectorList)` ?ы띁 ?꾩엯 怨좊젮). updateXxx ?⑥닔媛 紐⑤뱺 sink瑜??쇨? 媛깆떊?섎룄濡?肄붾뱶 由щ럭 泥댄겕由ъ뒪??蹂닿컯.

---

## P219 쨌 v49.23 쨌 VIX/HY Spread/AAII ?쇰꺼 ?뺤쓽 vs ?쒖떆 遺덉씪移?

- **利앹긽**: 3嫄??쇰꺼/諛곗? ?뺤쓽 遺덉씪移?
  - VIX 18 = "?щ━ 怨듯룷" (home L4049) ???뺤쓽(<12 洹밸떒?덉젙, 12~20 ?뺤긽 Risk-On)? 紐⑥닚
  - HY Spread 289 bps = 諛곗? "Tight" + "Risky" (sentiment L5820) ??300 誘몃쭔? Complacent/怨쇱뿴 援ш컙
  - AAII Bear 43% = "洹밸떒??鍮꾧?" (sentiment L5840) ???ㅼ젣 spread -7.3%, 洹밸떒? <-20% 湲곗?
- **?먯씤**: 蹂몃Ц ?ㅻ챸(tooltip/?뺤쓽)怨??섏씠吏 諛곗????꾧퀎媛?湲곗???遺꾧린?? ?쇨????꾧퀎媛?泥닿퀎(threshold registry) 遺??
- **?섏젙**: 3嫄??쇰꺼???뺤쓽? ?쇱튂?섎룄濡??뺤젙 ??VIX ??"?뺤긽 Risk-On", HY ??"Tight ??Complacent / Risk-On 怨쇱뿴", AAII ??"以묒젙??鍮꾧? (-7.3% spread)"
- **?뚯씪**: `index.html` L4049, L5820, L5840
- **violated_rule**: ?꾧퀎媛??뺤쓽 vs ?쒖떆 ?뺥빀??(?좉퇋 ??v49.24+ ?꾧퀎媛?泥닿퀎 ?듭씪?먯꽌 蹂멸꺽 ?섏젙 ?덉젙)
- **prevention**: v49.24?먯꽌 紐⑤뱺 ?꾧퀎媛?VIX/F&G/HY/AAII/Skew ????`THRESHOLD_REGISTRY` ?⑥씪 媛앹껜濡?吏묒쨷??+ 紐⑤뱺 ?쇰꺼 ?⑥닔媛 ?숈씪 異쒖쿂 李몄“.

---

## P220 쨌 v49.24 쨌 [洹쇰낯?섏젙] ?꾧퀎媛뮻룸씪踰??⑥씪 異쒖쿂 遺??(P219 ?щ컻 諛⑹?)

- **?щ컻 ?꾪뿕**: P219(VIX/HY/AAII ?쇰꺼 遺꾧린) ?⑦꽩???좉퇋 吏??異붽? ??臾댄븳 ?щ컻 媛??
- **?먯씤 (援ъ“??**: 媛??섏씠吏媛 ?꾧퀎媛믪쓣 ?몃씪??if/switch濡?遺꾧린 ???뺤쓽(tooltip)? 諛곗?媛 肄붾뱶 遺꾨━?섏뼱 ?숆린??遺덇???
- **洹쇰낯 ?닿껐**: `window.AIO_THRESHOLD_REGISTRY = { VIX, FG, HY_SPREAD, AAII, SKEW }` ?⑥씪 媛앹껜 ?좎꽕. 媛?吏?쒕쭏??`bands[]` + `getLabel(value)` ?⑥닔. 紐⑤뱺 ?쇰꺼 ?쒖떆 肄붾뱶媛 ???⑥닔 ?몄텧.
- **?좉퇋 洹쒖튃**: R56 (?꾧퀎媛뮻룸씪踰??⑥씪 異쒖쿂 ??THRESHOLD_REGISTRY)
- **?뚯씪**: `js/aio-core.js` L2025 遺洹??좎꽕
- **寃利?*: ???쇰꺼 肄붾뱶 異붽? ??grep `getLabel(` ?몄텧 ?뺤씤 + V49.25?먯꽌 湲곗〈 ?몃씪???쇰꺼 ?⑥닔 ?꾩닔 留덉씠洹몃젅?댁뀡

---

## P221 쨌 v49.24 쨌 [洹쇰낯?섏젙] Cross-page sink ?뺥빀 ?먮룞 寃利?遺??(P216/P218 ?щ컻 諛⑹?)

- **?щ컻 ?꾪뿕**: P216(kr-tech ?좎슜?붽퀬 31.7議??붿〈), P218(F&G ID ?댁썝?? ?⑦꽩????吏??異붽? ??諛섎났
- **?먯씤 (援ъ“??**: ?숈씪 吏?쒓? ?щ윭 ?섏씠吏??sink濡??깅줉????(1) data-snap ?띿꽦 ?꾨씫, (2) ?ㅻⅨ ID ?ъ슜 ??媛깆떊 遺꾧린, ??寃쎌슦 紐⑤몢 ?먮룞 ?먯? 遺덇?
- **洹쇰낯 ?닿껐**: `AIO.getSnapshotConsistencyAudit()` ?좎꽕 ??紐⑤뱺 `[data-snap]` ?붿냼瑜?key蹂꾨줈 洹몃９?????띿뒪??鍮꾧탳. ?숈씪 key媛 distinct 媛??щ윭 媛쒕㈃ mismatch 蹂닿퀬. getAutoOpsReadiness???듯빀.
- **?좉퇋 洹쒖튃**: R55 (?숈씪 吏??multi-sink ?⑥씪?? + R58 (DOM ?몃씪??vs DATA_SNAPSHOT 3-way)
- **?뚯씪**: `js/aio-core.js` L2298 遺洹??좎꽕
- **寃利?*: `AIO.getSnapshotConsistencyAudit().issueCount === 0` ??CI/QA 寃뚯씠??

---

## P222 쨌 v49.24 쨌 [洹쇰낯?섏젙] ?뺤쟻 ?뚯씠釉?stale ?먮룞 ?먯? 遺??(P217 ?щ컻 諛⑹?)

- **?щ컻 ?꾪뿕**: P217(kr-supply 二쇨컙 ?뚯씠釉?2024-03 ?붿〈) ?⑦꽩???ㅻⅨ ?뺤쟻 ?뚯씠釉붿뿉?쒕룄 ?좊났 媛??
- **?먯씤 (援ъ“??**: 湲곗〈 `getStaticDataGovernanceAudit()`??`[data-snap-date]` ?띿꽦 蹂댁쑀 ?붿냼留?寃?? `<table>` ?대? 泥?????좎쭨 ?⑦꽩? 誘명깘吏 ?곸뿭
- **洹쇰낯 ?닿껐**: `AIO.getTableStaleAudit()` ?좎꽕 ??紐⑤뱺 `<table>` 泥??곗씠????泥????MM/DD ?먮뒗 YYYY-MM-DD ?⑦꽩 ?뚯떛 ??90?? 寃쎄낵 ??stale 蹂닿퀬. `data-aio-archive="true"` 遺紐⑤뒗 ?쒖쇅.
- **?좉퇋 洹쒖튃**: R57 (?뺤쟻 ?뚯씠釉?stale 媛먯? ?섎Т)
- **?뚯씪**: `js/aio-core.js` ?좉퇋 ?⑥닔
- **寃利?*: `AIO.getTableStaleAudit().issueCount === 0`

---

## P223 쨌 v49.24 쨌 [洹쇰낯?섏젙] getAutoOpsReadiness ?듯빀 寃利?踰붿쐞 ?뺣?

- **?щ컻 ?꾪뿕**: ?좉퇋 audit ?⑥닔(SnapshotConsistency, TableStale)瑜?留뚮뱾?대룄 `getAutoOpsReadiness()`???듯빀?섏? ?딆쑝硫??댁쁺?먭? ?ъ슜?섏? ?딆쓣 媛?μ꽦
- **?먯씤 (援ъ“??**: ?먮룞 ?댁쁺 吏꾨떒 ?⑥씪 吏꾩엯?먯씠 5異?freshness/pipeline/statics/scheduler/continuity)留??먭? ???좉퇋 ?명봽?쇨? 怨좊┰
- **洹쇰낯 ?닿껐**: `getAutoOpsReadiness()`瑜?7異뺤쑝濡??뺤옣 (5異?+ sinkConsistency + tableStale). issues 諛곗뿴??P216/P218/P217 ?⑦꽩 ?쇰꺼留?
- **?뚯씪**: `js/aio-core.js` getAutoOpsReadiness ?⑥닔
- **寃利?*: `AIO.getAutoOpsReadiness().status === 'ok'` ??7異?紐⑤몢 ?듦낵

---

## P224 쨌 v49.25 쨌 [洹쇰낯?섏젙] ?먯닔 ?ㅼ???遺꾧린 (L1 ??R59 SCORE_SCALES)

- **?щ컻 ?꾪뿕**: signal ?섏씠吏??"20??留뚯젏" vs ??援ш컙 "75+/60~75/45~60/30~45/<30" (0~100 ?ㅼ??? ?쇳빀 ?쒓린 ???ъ슜???쇰룞. ?좉퇋 ?섏씠吏媛 ???ㅻⅨ ?ㅼ????꾩엯 ???쇰룞 利앺룺.
- **?먯씤 (援ъ“??**: ?섏씠吏留덈떎 ?먯껜 ?ㅼ???+ 蹂?섏떇 ???⑥씪 異쒖쿂 ?놁쓬
- **洹쇰낯 ?닿껐**: `window.AIO_SCORE_SCALES = { TWENTY_POINT, HUNDRED_POINT, convert(), getLabel100From20() }` ?좎꽕. 紐⑤뱺 ?먯닔 ?쒖떆/蹂?섏? ??媛앹껜 寃쎌쑀.
- **?좉퇋 洹쒖튃**: R59
- **?뚯씪**: `js/aio-core.js` (THRESHOLD_REGISTRY ?ㅼ쓬)
- **寃利?*: T199 (SCORE_SCALES 議댁옱 + convert ?뺥솗??

---

## P225 쨌 v49.25 쨌 [洹쇰낯?섏젙] 釉뚮젅?쒖벐쨌RSI ?꾧퀎媛??쇰꺼 遺꾧린 (L2/L8 ??THRESHOLD_REGISTRY ?뺤옣)

- **?щ컻 ?꾪뿕**: breadth ?섏씠吏 5/20/50SMA + RSI 移대뱶?ㅼ씠 ?먯껜 if/else濡??쇰꺼 遺꾧린 ??P219 ?좎궗 ?⑦꽩 ?щ컻
- **?먯씤 (援ъ“??**: v49.24媛 VIX/FG/HY/AAII/SKEW 5媛쒕쭔 ?깅줉. BREADTH쨌RSI???꾨씫.
- **洹쇰낯 ?닿껐**: THRESHOLD_REGISTRY??BREADTH(??궗??諛붾떏/?꾪뿕/?쇱“/?묓샇/怨쇱뿴) + RSI(怨쇰ℓ???쎌꽭/以묐┰/媛뺤꽭/怨쇰ℓ??洹밸떒 怨쇰ℓ?? bands 異붽?.
- **?뚯씪**: `js/aio-core.js` THRESHOLD_REGISTRY 媛앹껜
- **寃利?*: T200 (BREADTH/RSI getLabel ?묐룞), T201 (RSI 75 ??怨쇰ℓ??

---

## P226 쨌 v49.25 쨌 [洹쇰낯?섏젙] ATR 諛곗닔 踰붿쐞 紐⑦샇 (L4 ??R60 ATR_PRESETS)

- **?щ컻 ?꾪뿕**: signal L4433~4441 "?ㅼ쐷 3~5諛? ?ъ???4~8諛? 愿묐쾾?? ?몃젅?대뜑媛 ?대뼡 媛?梨꾪깮?좎? 遺덈챸. ?좉퇋 ?꾨왂 異붽? ?????ㅻⅨ 紐⑦샇 踰붿쐞 媛??
- **?먯씤 (援ъ“??**: 沅뚯옣媛??⑥씪 異쒖쿂 ?놁쓬 ???섏씠吏留덈떎 ?꾩쓽 踰붿쐞 ?쒓린
- **洹쇰낯 ?닿껐**: `AIO_ATR_PRESETS = { swing, position, scalp, trailing }` 媛곴컖 沅뚯옣 multiplier + range + note. `getStop(high, atr, preset)` ?⑥닔.
- **?좉퇋 洹쒖튃**: R60
- **?뚯씪**: `js/aio-core.js`
- **寃利?*: T202 (ATR_PRESETS swing 3.0諛?+ position 5.0諛?

---

## P227 쨌 v49.25 쨌 [洹쇰낯?섏젙] ?ㅼ쨷 ?좏샇 紐⑥닚 臾댁떆 ?먯젙 (L3 ??R61 diagnoseBreadthConsensus)

- **?щ컻 ?꾪뿕**: breadth ?섏씠吏 5SMA 68%(媛뺤꽭) + 20SMA 75%(媛뺤꽭) + 50SMA 46%(?쇱“) + McClellan(?쎌꽭) ??醫낇빀 "?쎌꽭" ?⑥젙. 媛뺤꽭 ?좏샇 2媛?臾댁떆. ?ъ슜?먭? ?먯젙 洹쇨굅 異붿쟻 遺덇?. ?좉퇋 ?ㅼ쨷 ?좏샇 ?쒖뒪??異붽? ???숈씪 臾몄젣 諛섎났.
- **?먯씤 (援ъ“??**: 醫낇빀 ?먯젙???몃씪??if/else濡??묒꽦 ??媛以??됯퇏 怨꾩궛 遺덇??? 紐⑥닚 ?먯? 遺덇?
- **洹쇰낯 ?닿껐**: `AIO.diagnoseBreadthConsensus(signals)` ?⑥닔 ???먮룞 媛以??됯퇏 + verdict + conflict 蹂닿퀬. 媛뺤꽭 N媛?vs ?쎌꽭 M媛?紐낆떆.
- **?좉퇋 洹쒖튃**: R61
- **?뚯씪**: `js/aio-core.js`
- **寃利?*: T203 (紐⑥닚 ?좏샇 ?낅젰 ??conflict 蹂닿퀬 + verdict媛 ?⑥씪 諛⑺뼢 ?⑥젙?섏? ?딆쓬)

---

## P228 쨌 v49.25 쨌 [洹쇰낯?섏젙] F-Score 9 ??ぉ ?ㅻ챸留?(L7 ??R62 PIOTROSKI_CHECKLIST)

- **?щ컻 ?꾪뿕**: fundamental L8134~8142 "9媛吏 YES/NO 泥댄겕" ?ㅻ챸留? ?ъ슜?먭? 蹂몄씤 醫낅ぉ??F-Score 怨꾩궛 遺덇?. ?좉퇋 ?뺣웾 梨꾩젏 ?쒖뒪??異붽? ???숈씪 ?⑥젙.
- **?먯씤 (援ъ“??**: 9 ??ぉ???띿뒪?몃줈留??섏뿴, 寃利??⑥닔 誘몄젙?????곗씠?곕줈 梨꾩젏 遺덇?
- **洹쇰낯 ?닿껐**: `AIO_PIOTROSKI_CHECKLIST.categories = { profitability:[4], leverage:[3], efficiency:[2] }` + `score(d) ??{score, max:9, details:[], verdict}`.
- **?좉퇋 洹쒖튃**: R62
- **?뚯씪**: `js/aio-core.js`
- **寃利?*: T204 (PIOTROSKI_CHECKLIST.score(mock data) ??0~9 ?뺤닔)

---

## P229 쨌 v49.26 쨌 [洹쇰낯?섏젙] ?먯닔 媛以묒튂 誘멸났媛?(I2 ??R64 WEIGHT_REGISTRY)

- **?щ컻 ?꾪뿕**: home Trading Score / Quality Score媛 "援ъ꽦?붿냼 誘멸린?? ?곹깭濡??몄텧. ?좉퇋 ?먯닔 ?쒖뒪??異붽? ???숈씪 ?⑥젙.
- **洹쇰낯 ?닿껐**: `window.AIO_WEIGHT_REGISTRY = { TRADING_SCORE, QUALITY_SCORE, MARKET_REGIME }` 媛곴컖 `components[]` + `weight/max/note` + `totalWeight` + `getComponentTooltip(key)`. ?섏씠吏 移대뱶 hover/?댄똻???먮룞 ?곸슜.
- **?좉퇋 洹쒖튃**: R64
- **?뚯씪**: `js/aio-core.js`

---

## P230 쨌 v49.26 쨌 [洹쇰낯?섏젙] 移대뱶 ?쒓컖 ?꾧퀎 ?숇벑 (I3 ??R65 CARD_HIERARCHY)

- **?щ컻 ?꾪뿕**: home 3媛?移대뱶(留ㅻℓ?먮떒/?덉쭏?먯닔/?쒖옣援?㈃) ??댄룷洹몃옒???숈씪 ??Primary 媛뺤“ 遺議? ?좉퇋 移대뱶 異붽? ???숈씪 臾몄젣 ?꾩쟻.
- **洹쇰낯 ?닿껐**: `window.AIO_CARD_HIERARCHY = { primary:{fontSize:24,weight:900,stripe:green}, secondary:{20,800,amber}, tertiary:{16,700,muted} }` + `getClassList(level)`.
- **?좉퇋 洹쒖튃**: R65
- **?뚯씪**: `js/aio-core.js`

---

## P231 쨌 v49.26 쨌 [洹쇰낯?섏젙] ?쇰꺼/?됱긽 ?섏씠吏蹂?if/else (I1 ??applyLabelToElement)

- **?щ컻 ?꾪뿕**: ?섏씠吏留덈떎 ?꾩쓽 ?됱긽/?쇰꺼 if/else ??THRESHOLD_REGISTRY ?꾩엯(v49.24) ?꾩뿉???곸슜 ?꾨씫 媛??
- **洹쇰낯 ?닿껐**: `AIO.applyLabelToElement(el, registryKey, value)` ???쇰꺼 ?띿뒪??+ CSS ?됱긽 + `data-signal`/`data-threshold-key` ?띿꽦 ?쇨큵 ?ㅼ젙.
- **?뚯씪**: `js/aio-core.js`

---

## P232 쨌 v49.26 쨌 [洹쇰낯?섏젙] 以묐났 肄섑뀗痢??먮룞 ?먯? 遺??(I4 ??R66 getDuplicateContentAudit)

- **?щ컻 ?꾪뿕**: technical ?섏씠吏 TradingView 李⑦듃 + OHLC ?대갚 ?뺣낫 ???숈씪 吏???????쒖떆. ?좉퇋 ?섏씠吏 異붽? ???숈씪 ?꾩쟻.
- **洹쇰낯 ?닿껐**: `AIO.getDuplicateContentAudit()` ???섏씠吏蹂?`data-snap`/`data-live-price` 移댁슫????3???댁긽 ??蹂닿퀬. archive ?뱀뀡 ?쒖쇅.
- **?좉퇋 洹쒖튃**: R66
- **?뚯씪**: `js/aio-core.js`

---

## P233 쨌 v49.26 쨌 [洹쇰낯?섏젙] ?ъ씠???꾩튂 ?뺤쟻 怨좎젙 (I7 ??R67 getCycleFromMacro)

- **?щ컻 ?꾪뿕**: themes L8534 "? ?꾩옱(Late Cycle 쨌 ?먮꼫吏쨌?꾩닔?뚮퉬쨌?좏떥)" ?ъ씠???꾩튂 ?뺤쟻 怨좎젙 ??6媛쒖썡+ ?쒓컙 寃쎄낵 誘몃컲?? ?좉퇋 ?ъ씠???쒖떆 異붽? ???숈씪 ?⑦꽩.
- **洹쇰낯 ?닿껐**: `AIO.getCycleFromMacro({vix, breadth50, yield2s10s, spxTrend}) ??{phase, inputs, rationale[]}` ?섏궗寃곗젙 ?몃━. VIX쨌breadth쨌yield curve 留ㅽ겕濡??낅젰 湲곕컲 ?먮룞 phase ?먯젙.
- **?좉퇋 洹쒖튃**: R67
- **?뚯씪**: `js/aio-core.js`

---

## P234 쨌 v49.27 쨌 [洹쇰낯?섏젙] Action Item 媛?대뱶 遺??(E1/E2 ??R69 ACTION_RULES)

- **?щ컻 ?꾪뿕**: home쨌briefing "吏湲??댁빞 ???? 媛?대뱶 遺?????ъ슜?먭? ?쇰컲濡?議곗뼵留?諛쏆쓬. ?좉퇋 ?섏씠吏 異붽? ???숈씪 ?⑦꽩.
- **洹쇰낯 ?닿껐**: `window.AIO_ACTION_RULES = { positionSizing.rules:[VIX 援ш컙], sentimentAction.rules:[F&G 援ш컙] }` + `getActionPlan({vix, fg, breadth50}) ??{actions:[]}`. ?섏씠吏媛 ???⑥닔 ?몄텧?섏뿬 移대뱶 ?뚮뜑.
- **?좉퇋 洹쒖튃**: R69
- **?뚯씪**: `js/aio-core.js`

---

## P235 쨌 v49.27 쨌 [洹쇰낯?섏젙] ?섏씠吏 紐⑹쟻쨌?곗꽑?쒖쐞 ?⑥씪 ?뺤쓽 (E3/E4 ??R70 PAGE_PURPOSE_REGISTRY)

- **?щ컻 ?꾪뿕**: signal vs home ??븷 遺꾩궛 ???ъ슜?먭? ?섏씠吏 紐⑹쟻 ?쇰룞. briefing 5? 愿??vs ?대떇 罹섎┛???곗꽑?쒖쐞 ??쟾. ?좉퇋 ?섏씠吏 異붽? ?????ㅻⅨ 紐⑦샇??
- **洹쇰낯 ?닿껐**: `AIO_PAGE_PURPOSE_REGISTRY = { home:{purpose,mainCards,cta}, signal:..., briefing:{sectionOrder} ... }` 12 ?섏씠吏 ?깅줉.
- **?좉퇋 洹쒖튃**: R70
- **?뚯씪**: `js/aio-core.js`

---

## P236 쨌 v49.27 쨌 [洹쇰낯?섏젙] ?대줎 vs ?ㅽ뻾 鍮꾨?移??먮룞 媛먯궗 (E5 ??R71 getPagePurposeRatioAudit)

- **?щ컻 ?꾪뿕**: portfolio ?대줎 ?띾? vs UI 遺議??⑦꽩???좉퇋 ?섏씠吏?먯꽌???좊났 媛??
- **洹쇰낯 ?닿껐**: `AIO.getPagePurposeRatioAudit()` ???섏씠吏蹂??뺤쟻 ?띿뒪??湲몄씠 vs ?숈쟻 sink 媛쒖닔. 3000?? & sink <5 ??鍮꾨?移?蹂닿퀬.
- **?좉퇋 洹쒖튃**: R71
- **?뚯씪**: `js/aio-core.js`

---

## P237 쨌 v49.27 쨌 [洹쇰낯?섏젙] ?쒕굹由ъ삤 ?뺣쪧 ?쒓컙 ?섏〈??遺??(L6 ??R72 SCENARIO_REGISTRY)

- **?щ컻 ?꾪뿕**: macro ?쒕굹由ъ삤 (?곗갑瑜?30%/?ㅽ깭洹?45%/移⑥껜 25%) ?뺤쟻 ?섎뱶肄붾뵫 ??CPI/FOMC 諛쒗몴 ?꾩뿉??stale ?쒖떆
- **洹쇰낯 ?닿껐**: `AIO_SCENARIO_REGISTRY = { scenarios: { 'soft-landing':{probability, lastUpdated, source, triggers[]} ... }, validateSum() }` + `AIO.getScenarioFreshnessAudit()` 30?? ?먮룞 stale 蹂닿퀬.
- **?좉퇋 洹쒖튃**: R72
- **?뚯씪**: `js/aio-core.js`

---

## P238 쨌 v49.27 쨌 [洹쇰낯?섏젙] ?뺤쟻 異붿쿇 ?쒖옣 ?섍꼍 誘몃컲??(E6 ??ACTION_RULES ?뺤옣)

- **?щ컻 ?꾪뿕**: options "Top 3 嫄곕옒 ?꾩씠?붿뼱" ?뺤쟻 ?덉떆. ?쒖옣 ?섍꼍(VIX 18 vs VIX 35) 蹂??誘몃컲?? ?좉퇋 異붿쿇 ?쒖뒪?쒖뿉???숈씪 ?뺤쟻 ?⑦꽩 媛??
- **洹쇰낯 ?닿껐**: `AIO_ACTION_RULES.positionSizing`/`sentimentAction`???섍꼍 ?낅젰 湲곕컲 ?숈쟻 ?앹꽦. options ?섏씠吏媛 ?대? ?몄텧?섏뿬 異붿쿇 移대뱶 ?뚮뜑.
- **?뚯씪**: `js/aio-core.js` (R69? ?듯빀)
- **寃利?*: AIO_ACTION_RULES.positionSizing.getRule(35) ??sizePct: 15

---

## P239 쨌 v49.28 쨌 [硫뷀? 洹쇰낯?섏젙] ?명봽??異붽?留??섍퀬 ?섏씠吏 ?곸슜 ?꾨씫 (?ъ슜??吏??

- **利앹긽**: v49.24~v49.27??18媛?洹쇰낯 ?명봽??THRESHOLD/SCORE_SCALES/ATR/PIOTROSKI/WEIGHT/CARD_HIERARCHY/applyLabel/getCycle/ACTION/PAGE_PURPOSE/SCENARIO ??瑜?異붽??덉쑝???ㅼ젣 ?섏씠吏 DOM???곸슜 ???? ?ъ슜?먭? 蹂대뒗 ?붾㈃? 洹몃?濡?stale.
- **?먯씤 (硫뷀? 援ъ“??**: "洹쇰낯 ?명봽??異붽?"? "?섏씠吏 ?곸슜"??蹂꾧컻 ?④퀎濡??몄떇. ?명봽??PR ???곸슜 PR??蹂꾨룄 ?묒꽦?섎뒗 ?⑦꽩???꾩쟻?섏뼱 ?명봽?쇨? "?ъ슜 媛???섏?留?"?ъ슜 ???? ?곹깭濡??곴뎄 ?붿〈.
- **洹쇰낯 ?닿껐**: v49.28?먯꽌 (1) signal/technical/home/fundamental/macro/themes 6媛??섏씠吏??v49.24~27 ?명봽???ㅼ젣 ?몄텧 + DOM ?곸슜, (2) ?좉퇋 洹쒖튃 R73 ?쒖젙: ??registry/audit 異붽? ??諛섎뱶???섏씠吏 ?곸슜 PR ?숇컲.
- **?좉퇋 洹쒖튃**: R73
- **?뚯씪**: `index.html` ?ㅼ닔 ?섏씠吏 쨌 `js/aio-data.js` ACTION_RULES ?몄텧 쨌 `js/aio-core.js` pageShown listener

---

## P240 쨌 v49.28 쨌 signal L1/L4 ?섏씠吏 ?곸슜 (SCORE_SCALES + ATR_PRESETS)

- **?섏젙**: signal L4399 "20???ㅼ퐫?대쭅" ?ㅻ뜑??100???섏궛 ?쒓린 + L4436 ATR 怨듭떇??ATR_PRESETS 沅뚯옣媛?swing 3.0/position 5.0/scalp 1.5/trailing 2.5) 紐낆떆
- **?뚯씪**: `index.html` L4399, L4436
- **violated_rule**: R59 (SCORE_SCALES) + R60 (ATR_PRESETS) ???명봽???깅줉留??섍퀬 ?섏씠吏 ?곸슜 ?꾨씫

---

## P241 쨌 v49.28 쨌 home I2/I3/E1 ?섏씠吏 ?곸슜 (WEIGHT + CARD_HIERARCHY + ACTION_RULES)

- **?섏젙**: home 3媛?移대뱶??(1) `data-weight-key`/`title` 媛以묒튂 tooltip, (2) `aio-card-primary`/`aio-card-secondary` ?대옒??+ stripe ?됱긽, (3) Action Item 移대뱶 ?좎꽕 (`#home-action-item-card`). aio-data.js?먯꽌 ACTION_RULES.getActionPlan() ?먮룞 ?몄텧?섏뿬 移대뱶 梨꾩?.
- **?뚯씪**: `index.html` L4023~4051 + ?좎꽕 移대뱶 쨌 `js/aio-data.js` L11063 遺洹?
- **violated_rule**: R64/R65/R69 ?곸슜 ?꾨씫 ???쒖젙

---

## P242 쨌 v49.28 쨌 technical L8 RSI ?꾧퀎媛?移대뱶 ?쒓린 (THRESHOLD.RSI)

- **?섏젙**: tech-rsi-val 移대뱶??`title` tooltip + ?섎떒 ?쇰꺼 `<30 怨쇰ℓ??쨌 70+ 怨쇰ℓ?? ?쒓린. THRESHOLD_REGISTRY.RSI band 媛?쒗솕.
- **?뚯씪**: `index.html` L6453~6456
- **violated_rule**: R56 (THRESHOLD_REGISTRY ?곸슜) ??移대뱶 ?쇰꺼???깅줉 ?뺣낫 ?쒖떆 ?꾨씫

---

## P243 쨌 v49.28 쨌 fundamental L7 PIOTROSKI ?먮룞 梨꾩젏 媛?대뱶 (PIOTROSKI_CHECKLIST)

- **?섏젙**: fundamental L8158 F-Score ?ㅻ챸 諛뺤뒪??(1) 移댄뀒怨좊━蹂??먯닔(?섏씡??4 + 嫄댁쟾??3 + ?⑥쑉??2 = 9) 紐낆떆, (2) 肄섏넄 ?몄텧 ?덉떆 (`AIO_PIOTROSKI_CHECKLIST.score({...})`) 肄붾뱶 釉붾줉 異붽?.
- **?뚯씪**: `index.html` L8158~8167
- **violated_rule**: R62 (PIOTROSKI_CHECKLIST) ???⑥닔 ?깅줉留??섍퀬 ?ъ슜 媛?대뱶 誘멸났媛?

---

## P244 쨌 v49.28 쨌 themes I7 + macro L6 ?섏씠吏 hook ?곸슜 (getCycleFromMacro + SCENARIO_REGISTRY)

- **?섏젙**: themes ?섏씠吏 吏꾩엯 ??`getCycleFromMacro()` ?몄텧 ??`#cycle-dynamic-phase`/`#cycle-dynamic-inputs`/`#cycle-dynamic-rationale` 媛깆떊. macro ?섏씠吏 吏꾩엯 ??`SCENARIO_REGISTRY.validateSum()` + lastUpdated ??`#macro-scenario-updated`/`#macro-scenario-sum`/`#macro-scenario-stale-days` 媛깆떊. `_aioPageBus.register()`濡?listener ?깅줉.
- **?뚯씪**: `index.html` themes/macro ?섏씠吏 DOM 쨌 `js/aio-core.js` pageShown listener
- **violated_rule**: R67 (getCycleFromMacro) + R72 (SCENARIO_REGISTRY) ???⑥닔 ?깅줉留??섍퀬 ?섏씠吏 吏꾩엯 ?몃━嫄??꾨씫

---

## P245 쨌 v49.29 쨌 signal E3 ?섏씠吏 紐⑹쟻 ?ㅻ뜑 ?곸슜

- **?섏젙**: signal L4388??page-purpose 諛뺤뒪 異붽? ??"?쒓렇???곸꽭 + 留ㅻℓ ?꾨왂 ?숈뒿 (Secondary). ?ㅻ뒛 留ㅻℓ ?먮떒(Primary)? ?덉뿉??. R70 PAGE_PURPOSE_REGISTRY ?곸슜.
- **?뚯씪**: `index.html` L4388~4393
- **violated_rule**: R70 誘몄쟻?????쒖젙

---

## P246 쨌 v49.29 쨌 breadth L2/L3/I1 ?ㅼ쨷 ?좏샇 ?⑹쓽 + ?됱긽 ?뺤젙

- **?섏젙**: (a) `#breadth-consensus-readout` ?좎꽕 ??diagnoseBreadthConsensus(sma5/sma20/sma50/mcclellan/weinstein/goldenCross) ?몄텧 寃곌낵 ?쒖떆 + conflict ?먮룞 蹂닿퀬. (b) 20SMA 75% 移대뱶 ?됱긽 green?뭓mber ?뺤젙 (THRESHOLD.BREADTH 70~101=怨쇱뿴 ?뺤쓽 ?쇱튂). (c) breadth pageShown listener 異붽?.
- **?뚯씪**: `index.html` L5036, L5378~5384 쨌 `js/aio-core.js` core-breadth-consensus listener
- **violated_rule**: R56(THRESHOLD_REGISTRY ?곸슜) + R61(diagnoseBreadthConsensus) 誘몄쟻?????쒖젙

---

## P247 쨌 v49.29 쨌 briefing E2/E4 Action Item + 5? 愿??理쒖긽??諛곗튂

- **?섏젙**: briefing ?섏씠吏 理쒖긽?⑥뿉 (a) `#briefing-top-5-watch` 5? 愿???ъ씤??(FOMC/CPI/Earnings/吏?뺥븰/VIX 異붿쟻) ??PAGE_PURPOSE_REGISTRY.briefing.sectionOrder[0] ?곸슜. (b) `#briefing-action-item-card` ACTION_RULES 湲곕컲 移대뱶. briefing pageShown listener?먯꽌 ?먮룞 媛깆떊.
- **?뚯씪**: `index.html` L5917 遺洹??좎꽕 쨌 `js/aio-core.js` core-briefing-action listener
- **violated_rule**: R69(ACTION_RULES) + R70(PAGE_PURPOSE.briefing.sectionOrder) 誘몄쟻?????쒖젙

---

## P248 쨌 v49.29 쨌 portfolio E5 4-card 由ъ뒪????쒕낫???좎꽕

- **?섏젙**: portfolio ?섏씠吏??Sharpe Ratio / Beta(vs SPY) / Max Drawdown / Drift 4媛?移대뱶 洹몃━??異붽?. 媛?移대뱶??沅뚯옣 紐⑺몴媛??쇰꺼. 肄섏넄 ?몄텧 媛?대뱶 (`AIO.computePortfolioRisk(holdings)`).
- **?뚯씪**: `index.html` L8852 遺洹??좎꽕
- **violated_rule**: R71(getPagePurposeRatioAudit) 誘몄쟻?????대줎 ?띾? vs UI 遺議?鍮꾨?移??댁냼

---

## P249 쨌 v49.29 쨌 options E6 ?숈쟻 異붿쿇 移대뱶

- **?섏젙**: options ?섏씠吏 SECTION 7 ?꾩뿉 `#options-dynamic-recommendation` 移대뱶 ?좎꽕 ??VIX 援ш컙蹂??듭뀡 ?꾨왂 ?먮룞 留ㅼ묶 (VIX <15?묹ong Vol, 15~20?묪ull Call Spread/CC, 20~30?묬overed Call, 30+?뭁ut ?ㅼ?). ACTION_RULES.positionSizing/sentimentAction ?몄텧.
- **?뚯씪**: `index.html` SECTION 7 遺洹?쨌 `js/aio-core.js` core-options-rec listener
- **violated_rule**: R69(ACTION_RULES) 誘몄쟻?????뺤쟻 "Top 3" ?덉떆 ?泥?

---

## P250 쨌 v49.29 쨌 technical I4 OHLC fallback 留덊궧 + fundamental I5 寃??媛?대뱶 + macro I6 placeholder ?쒖?

- **?섏젙**: (a) technical L6399 OHLC strip??`data-aio-fallback="tradingview-iframe"` + opacity 0.75 + "?좑툘 Fallback Only" ?쇰꺼 ??getDuplicateContentAudit ?쒖쇅?? (b) fundamental 寃?됱갹 ?ㅼ쓬 `#fund-pre-search-guide` ?좎꽕 ??異쒖쿂/?덉긽 ?묐떟?쒓컙/?덉떆 4媛?(NVDA/AAPL/TSLA/MSFT). (c) macro storyline placeholder??R68 ?쒖? 媛?대뱶 (異쒖쿂/?덉긽 ?쒓컙/?ㅽ뙣 ?대갚/?섎룞 媛깆떊) 異붽?.
- **?뚯씪**: `index.html` 3怨?
- **violated_rule**: R66(getDuplicateContentAudit), R68(placeholder ?쒖?) 誘몄쟻?????쒖젙

---

## P251 쨌 v49.29 쨌 v49.28~29 ?듯빀 ??23媛?Deep audit ??ぉ ?꾩닔 ?곸슜 ?꾨즺

- **?곹깭**: v49.23 Deep audit?먯꽌 諛쒓껄??23媛???ぉ(L1~L8 + I1~I8 + E1~E7) ?꾨? ?섏씠吏 ?곸슜 ?꾨즺 ??v49.28 (signal/home/technical/fundamental/macro/themes 8媛? + v49.29 (signal/breadth/briefing/portfolio/options/technical/fundamental/macro 11媛? ?꾩쟻.
- **?⑥? ?묒뾽**: ?쇱씠釉??곗씠???ㅼ륫 寃利?+ L6 SCENARIO 30?? ?꾨옒 ??媛깆떊 + R71 ?섏씠吏 鍮꾩쑉 audit ?뺢린 ?댁쁺.
- **寃利?*: `AIO.getThresholdLabelAudit()` ?곸슜瑜?異붿쟻 쨌 `AIO.getSnapshotConsistencyAudit()` ?몃씪???쇰꺼 vs registry ?쇨???쨌 `AIO.getDuplicateContentAudit()` 以묐났 肄섑뀗痢?

---

## P252 쨌 v49.30 쨌 [洹쇰낯?섏젙] KOSPI ?몃씪??22% 愿대━ (M1 ??R74 assertSnapshotInlineMatch)

- **利앹긽**: kr-home KOSPI 移대뱶 (L10536) ?몃씪??`6,091.39` vs DATA_SNAPSHOT.kospi `7844.01` ??**22.4% 愿대━**. KOSDAQ/KRW???숈씪 ?⑦꽩.
- **?먯씤 (援ъ“??**: v49.24 `getSnapshotConsistencyAudit()` ?좎꽕?덉쑝??**鍮뚮뱶 ??李⑤떒 寃뚯씠??遺??*. v49.23??KR 6?꾨뱶(?좎슜?붽퀬/?덊긽湲???留??쒖젙?섍퀬 硫붿씤 吏??移대뱶 ?꾨씫 ??P213 ?⑦꽩 ?щ컻.
- **洹쇰낯 ?닿껐**:
  1. `index.html` L10534~10553 KOSPI/KOSDAQ/KRW 3媛?移대뱶 紐⑤몢 DATA_SNAPSHOT ?뺥빀 (媛?+ 移대뱶 ?대옒??+ ?됱긽 + ?깅씫瑜?
  2. `AIO.assertSnapshotInlineMatch()` ?좎꽕 ???듭떖 sink 10媛?(KOSPI/KOSDAQ/KRW/SPX/VIX/Fed/BOK ?? ?몃씪??vs DATA_SNAPSHOT 鍮꾧탳
  3. `getAutoOpsReadiness()` 7??2異??듯빀
- **?좉퇋 洹쒖튃**: R74
- **?뚯씪**: `index.html` L10534~10553 쨌 `js/aio-core.js` ?좉퇋 audit

---

## P253 쨌 v49.30 쨌 [洹쇰낯?섏젙] Jensen ?명꽣酉?58??+ ?뺤쟻 肄섑뀗痢?lifecycle ?뺤콉 遺??(M2 ??R75 STATIC_CONTENT_LIFECYCLE)

- **利앹긽**: sentiment L6057 Jensen Huang ?명꽣酉?`2026-03-20` ??58??寃쎄낵 (HARD STALE 60???꾨컯). ?먮룞 archive ?뚮엺 遺??
- **?먯씤 (援ъ“??**: ?뺤쟻 ?명꽣酉??대깽?몄쓽 expiration policy registry ?놁쓬. R54 archive 留덊궧? ?섎룞 ?뺤콉.
- **洹쇰낯 ?닿껐**:
  1. Jensen ?명꽣酉??뱀뀡 `data-aio-archive="true"` + `data-lifecycle-id="jensen-interview-202603"` 留덊궧 + "ARCHIVE 쨌 58??寃쎄낵 쨌 ???명꽣酉?援먯껜 ?덉젙" ?쇰꺼
  2. `AIO_STATIC_CONTENT_LIFECYCLE` registry ?좎꽕 ??Jensen/Week of May/KR ?섏텧 2?????깅줉
  3. `AIO.getStaticContentLifecycleAudit()` ?먮룞 expire 蹂닿퀬
- **?좉퇋 洹쒖튃**: R75

---

## P254 쨌 v49.30 쨌 [洹쇰낯?섏젙] macro ?좉? 47??+ ?뺤튂 ?몄궗 ?쒖젏 ?섏〈 (M3+M4 ??R76/R77)

- **利앹긽**:
  - macro L7283 "(2026.03~04 ?꾩웳 ?쇳겕 vs ?댁쟾 ??" ??47??stale
  - chat L55 "Bessent/Warsh policy mix" ???뺤튂 ?몄궗 ?꾩쓽 ?쒖젏 stale 媛??
  - DATA_SNAPSHOT 嫄곗떆吏??(NFP 4/3) ??44??寃쎄낵
- **?먯씤 (援ъ“??**:
  - ?쒕굹由ъ삤 ?띿뒪???쒖젏 ?쇰컲???뺤콉 遺??
  - ?뺤튂/愿猷??대쫫 registry 遺??
  - 嫄곗떆 諛쒗몴 罹섎┛??遺??
- **洹쇰낯 ?닿껐**:
  1. macro L7283 ?쒖젏 ?쒗쁽 ?쇰컲??("2026 H1 ?됯퇏 쨌 5???꾩옱 紐⑤땲?곕쭅")
  2. chat L55 "Bessent/Warsh" ??"current Treasury Secretary and Fed Chair" + R76 李몄“ 媛?대뱶
  3. `AIO_NAMED_ENTITY_REGISTRY` ?좎꽕 ??Fed Chair/Treasury/BOK/ECB/BOJ ?깅줉 (90??staleDays)
  4. `AIO_MACRO_CALENDAR` ?좎꽕 ??NFP/CPI/PCE/ISM/Retail nextRelease 湲곕컲 ?먮룞 stale
  5. `AIO.getNamedEntityAudit()` + `AIO.getMacroReleaseStaleAudit()`
  6. DATA_SNAPSHOT 嫄곗떆吏??二쇱꽍??"5??諛쒗몴 ?湲? ?쒓린
- **?좉퇋 洹쒖튃**: R76, R77

---

## P255 쨌 v49.30 쨌 [洹쇰낯?섏젙] KR 遺꾧린 嫄곗떆 ?띿뒪??90?? ?붿〈 (M5 ??R78 KR_MACRO_RELEASE)

- **利앹긽**: "2??諛섎룄泥??섏텧 +157.9% YoY" 3怨?(kr-home L10684, kr-macro L11331, kr-technical L11537) ??3??4???곗씠??諛쒗몴 ?꾩뿉???곴뎄 ?붿〈.
- **?먯씤 (援ъ“??**: KR 嫄곗떆 諛쒗몴 罹섎┛??遺?? 留ㅼ썡 1???곗옄遺 ?섏텧??諛쒗몴 ???먮룞 媛깆떊 ?몃━嫄??놁쓬.
- **洹쇰낯 ?닿껐**:
  1. 3怨?"+157.9% YoY" ??`data-snap="kr-semi-export-yoy"` 諛붿씤??+ "(2??湲곗? 쨌 5??媛깆떊 ?湲?" ?쇰꺼
  2. kr-macro ?섏텧 ?뚯씠釉?`data-aio-archive="true"` + `data-lifecycle-id="kr-export-2026-02"`
  3. `AIO_KR_MACRO_RELEASE` registry ?좎꽕 (?섏텧/CPI/GDP/?곗뾽?앹궛/諛섎룄泥?
  4. `AIO.getKrMacroReleaseAudit()` ?먮룞 stale
- **?좉퇋 洹쒖튃**: R78

---

## P256 쨌 v49.30 쨌 [硫뷀? 醫낇빀] 5媛??좉퇋 ?명봽??+ 7??2異??듯빀

- **?붿빟**: v49.23 ?뺥빀???쒖젙, v49.24~29 ?명봽??+ ?섏씠吏 ?곸슜 ?꾩쟻 ??v49.30?먯꽌 5媛??좉퇋 硫뷀? ?명봽??LIFECYCLE/NAMED_ENTITY/MACRO_CALENDAR/KR_MACRO_RELEASE/assertSnapshotInlineMatch) 異붽?.
- **?명봽??5媛?*: M1~M5 洹쇰낯 ?먯씤 媛곴컖 李⑤떒
- **?좉퇋 洹쒖튃 R74~R78**: 5媛??숈떆 異붽?
- **getAutoOpsReadiness 7??2異?*: freshness/pipeline/statics/scheduler/continuity/sinkConsistency/tableStale + snapshotInline/contentLifecycle/namedEntity/macroRelease/krMacroRelease
- **?뚯뒪??T241~T250**: ?좉퇋 10媛?
- **R73 以??*: ?명봽??異붽? + ?섏씠吏 ?곸슜 ?숇컲 (KOSPI/KOSDAQ/KRW/Jensen/macro/chat/諛섎룄泥?7嫄?紐⑤몢 v49.30 ?숈떆 ?쒖젙)

---

## P257 쨌 v49.31 쨌 [洹쇰낯?섏젙] SCREENER_DB 硫뷀? 遺??(H1 ??R80 SCREENER_DB_META)

- **利앹긽**: `js/aio-data.js` SCREENER_DB 硫붾え ?ㅻ뜑 "2026-03 Yahoo Finance 湲곗?" + memo 寃뚯떆??04-21~04-29 ??22~47??寃쎄낵. lifecycle 硫뷀? 遺?щ줈 ?먮룞 stale ?뚮엺 ?놁쓬.
- **洹쇰낯 ?닿껐**: `SCREENER_DB_META = { schemaVersion, lastBulkUpdate:'2026-04-29', staleAfterDays:30, replaceAfterDays:60, source, note }` ?좎꽕 + `window.SCREENER_DB_META` ?몄텧. SCREENER_DB ?ㅻ뜑 二쇱꽍??lifecycle 硫뷀? 李몄“ ?쒓린.
- **?좉퇋 洹쒖튃**: R80
- **?뚯씪**: `js/aio-data.js` L9~17

---

## P258 쨌 v49.31 쨌 [洹쇰낯?섏젙] fxbond 2Y 4.28% ?뺤쟻 ??data-snap 諛붿씤??(H2)

- **利앹긽**: fxbond L8087 `id="yc-2y-track">4.28%` ??DATA_SNAPSHOT 5/13 ?쒕뱶, ?ㅼ떆媛?誘몄뿰??
- **洹쇰낯 ?닿껐**: `data-snap="tnx-2y"` + `data-live-price="^IRX"` ?띿꽦 異붽? + "(v49.31 H2 ?쒕뱶 5/13)" ?쇰꺼. applyDataSnapshot ?먮룞 媛깆떊 + ?ㅼ떆媛?override 媛??
- **?뚯씪**: `index.html` L8087

---

## P259 쨌 v49.31 쨌 [洹쇰낯?섏젙] 吏?뺥븰 ?쒕굹由ъ삤 ?⑥씪 異쒖쿂 遺??(H3 ??R79 GEOPOLITICAL_CONTEXT_REGISTRY)

- **利앹긽**: macro/signal/options/kr-macro ?섏씠吏??"?몃Ⅴ臾댁쫰", "?대? ?ы삊??, "?몃읆??愿?? ???쒖젏 ?섏〈 ?띿뒪???곗옱 ???뺤콉 蹂寃????섏씠吏留덈떎 ?섎룞 媛깆떊 ?꾩슂
- **洹쇰낯 ?닿껐**: `AIO_GEOPOLITICAL_CONTEXT_REGISTRY` ?좎꽕 ??5媛??쒕굹由ъ삤(hormuz-strait/iran-nuclear/taiwan-strait/ukraine-russia/us-china-tariff) ?깅줉 + `status` (active/monitoring/resolved) + `lastReviewed` + `marketImpact` + `currentPriceSignal`. `AIO.getGeopoliticalReviewAudit()` 14?? overdue ?먮룞 蹂닿퀬.
- **?좉퇋 洹쒖튃**: R79
- **?뚯씪**: `js/aio-core.js`

---

## P260 쨌 v49.31 쨌 [洹쇰낯?섏젙] FRED 李⑦듃 媛깆떊 ?쒖젏 媛?쒗솕 (H4 ??R81 ?뺢린 諛쒗몴 留덉빱)

- **利앹긽**: macro FRED 李⑦듃 ?ㅻ뜑 "FRED API 쨌 ?붽컙 ?곗씠??留??쒓린 ???ъ슜?먭? ?몄젣 ???곗씠???ㅼ뼱?ㅻ뒗吏 ?????놁쓬
- **洹쇰낯 ?닿껐**: ?ㅻ뜑??"(?ㅼ쓬 媛깆떊: NFP 6/6 쨌 CPI 6/12 쨌 PCE 6/30)" 紐낆떆 + MACRO_CALENDAR ?곕룞 媛?대뱶 title ?띿꽦
- **?좉퇋 洹쒖튃**: R81
- **?뚯씪**: `index.html` L7054

---

## P261 쨌 v49.31 쨌 [洹쇰낯?섏젙] themes "? ?꾩옱 Late Cycle" ?뺤쟻 ?붿〈 (H5)

- **利앹긽**: themes L8628 cycle-late 移대뱶??"? ?꾩옱" ?뺤쟻 ?쇰꺼 ??v49.28 ?숈쟻 readout(getCycleFromMacro) 異붽? ?꾩뿉???뺤쟻 ?붿〈?쇰줈 ?ъ슜???쇰룞
- **洹쇰낯 ?닿껐**: ?뺤쟻 ?쇰꺼 "? ?꾩옱" ??"Late (李멸퀬)" ?쇰컲??+ `data-cycle-phase="late"` ?띿꽦 + title "?숈쟻 phase??#cycle-dynamic-phase?먯꽌 ?뺤씤". ?숈쟻 readout??沅뚯쐞 ?덈뒗 ?꾩튂濡??쇱썝??
- **?뚯씪**: `index.html` L8627~8630

---

## P262 쨌 v49.32 쨌 [洹쇰낯?섏젙] chat L54 "147-150" ?섍컖 異쒖쿂 (B1 ??R84 NUMERIC_GUIDELINE_SAFELIST)

- **利앹긽**: chat.js L54 technical context??`'single-name 20MA distance near 147-150'` ?뺣웾 ?섏튂媛 system ?꾨＼?꾪듃??諛뺥? ?덉쓬. AI媛 "?꾩뺨 二쇨??" 吏덈Ц ??"QCOM = 150" ?섍컖 ?묐떟 ??異쒖쿂 媛??
- **?먯씤 (援ъ“??**: ?뺣웾 ?꾧퀎媛?諛곗닔? 醫낅ぉ 媛寃⑹쓣 援щ텇?섎뒗 ?붿씠?몃━?ㅽ듃 遺?? AI 紐⑤뜽? 臾몃㎘蹂대떎 ?⑦꽩 ?곗꽑 留ㅼ묶.
- **洹쇰낯 ?닿껐**:
  1. chat L54 ?띿뒪???쇰컲????"...in upper extension band, single-name 20MA distance in extreme extension band (these are RATIO/DISTANCE thresholds, NEVER absolute prices ??do NOT cite numbers like 117-120 or 147-150 as stock prices)" 紐낆떆
  2. `AIO_NUMERIC_GUIDELINE_SAFELIST` ?좎꽕 ??8媛??꾧퀎媛?(blow-off ratio/distance, VIX, F&G, HY, RSI) ?깅줉 + `isCalibrationConstant(value)` ?⑥닔
  3. `AIO.getNumericGuidelineAudit()` registry 臾닿껐??寃利?
- **?좉퇋 洹쒖튃**: R84
- **?뚯씪**: `js/aio-chat.js` L54, `js/aio-core.js` registry

---

## P263 쨌 v49.32 쨌 [洹쇰낯?섏젙] fetch ?ㅽ뙣 ???섍컖 李⑤떒 遺??(B2 ??R82 HARD GUARDRAIL)

- **利앹긽**: chat L1940 ?대갚 遺꾧린 `'??' + t + ': ?곗씠??議고쉶 ?ㅽ뙣 ???곗빱瑜??뺤씤?섏꽭??'` ?⑥닚 ?띿뒪?몃쭔 system ?꾨＼?꾪듃??二쇱엯 ??AI媛 ?숈뒿 ?곗씠??2024~2025)濡?"QCOM ??$150 ?뺣룄" ?섍컖 ?묐떟
- **?먯씤 (援ъ“??**: HARD GUARDRAIL ?띿뒪??遺?? AI 紐⑤뜽 ?섍컖 李⑤떒 ?뺤콉 遺??
- **洹쇰낯 ?닿껐**:
  1. `_fetchTickerDataForChat` ?ㅽ뙣 遺꾧린瑜?4-line HARD GUARDRAIL濡?媛뺥솕:
     - `???ㅼ떆媛??쒖꽭 議고쉶 ?ㅽ뙣 (Yahoo Finance + ?꾨줉??紐⑤몢 fail)`
     - `??HARD GUARDRAIL: ?덈? 媛寃??깅씫瑜??쒓?珥앹븸/PER 異붿륫 湲덉?`
     - `???덉슜???듬?: "?ㅼ떆媛??곗씠??誘몄닔?? ?몃? ?꾧뎄 沅뚯옣留??듬?"`
     - `???덉슜??遺꾩꽍: 媛寃??녿뒗 ?쇰컲濡좎쟻 ?ъ뾽 紐⑤뜽/?뱁꽣 ?몃젋??
  2. system ?꾨＼?꾪듃 ?앹뿉 ABSOLUTE RULES 4議고빆 異붽?
- **?좉퇋 洹쒖튃**: R82
- **?뚯씪**: `js/aio-chat.js` L1940~1945

---

## P264 쨌 v49.32 쨌 [洹쇰낯?섏젙] AI ?묐떟 post-hoc 寃利?遺??(B3 ??R83/R86)

- **利앹긽**: v49.24~31 ?꾩쟻 13媛?audit??紐⑤몢 pre-render (DOM/?곗씠??. ?묐떟 ??媛寃??띿뒪??寃利?0嫄?
- **?먯씤 (援ъ“??**: 梨꾪똿 ?묐떟???듯빐 AI ?섍컖???ъ슜?먯뿉寃?吏곸젒 ?몄텧?섎뒗 梨꾨꼸??寃利??ш컖吏????
- **洹쇰낯 ?닿껐**:
  1. `AIO.assertChatResponseAccuracy(responseText, detectedTickers)` ?좎꽕
     - ?묐떟 ?띿뒪??`\$\d+` ?⑦꽩 異붿텧
     - ?ㅼ떆媛?媛寃?(window._liveData) 鍮꾧탳
     - 짹5/10/20/50% ?④퀎蹂?severity 遺꾨쪟
     - safelist ?꾧퀎媛믪? calibration constant濡??쒖쇅
  2. `AIO.getChatHallucinationAudit(responseText)` ?좎꽕 ??4 ?섍컖 ?⑦꽩 ?먯?
     - ?쇱슫???レ옄 ($100, $150, $200 ??
     - ?덈Т ?뺥솗???뚯닔 ($X.00, $X.50)
     - 媛寃?+ 遺덊솗???쒗쁽 ?숈떆 ?깆옣
     - ?숈뒿 ?곗씠???쒖젏 ?ㅼ썙??("2024??, "2025??珥?)
     - ?섏떖 ?먯닔 0~10 + verdict (high-risk/medium-risk/low-risk/clean)
- **?좉퇋 洹쒖튃**: R83, R86
- **?뚯씪**: `js/aio-core.js` 2 ?좉퇋 ?⑥닔

---

## P265 쨌 v49.32 쨌 [洹쇰낯?섏젙] dynamicTickerLookup ?좊ː??遺議?(B4)

- **利앹긽**: `index.html` L20049 timeout 8s 쨌 retry 0 쨌 ?꾨줉??2媛? ?ㅽ듃?뚰겕 吏???꾨줉???쇱떆 fail ??cascading ?ㅽ뙣 ??B2 ?대갚 ???섍컖 ?꾪뿕 利앺룺
- **洹쇰낯 ?닿껐**:
  1. timeout 8s ??12s (50% 利앷?)
  2. ?꾨줉??2媛???3媛?(codetabs 異붽?)
  3. ?꾨줉?쒕퀎 1???ъ떆??(500ms backoff)
- **?뚯씪**: `index.html` L20040~20081

---

## P266 쨌 v49.32 쨌 [洹쇰낯?섏젙] 醫낅ぉ紐?留ㅽ븨 ?⑥씪 異쒖쿂 遺??(B5 ??R85 TICKER_NAME_REGISTRY)

- **利앹긽**: KR_TICKER_MAP? ?쒓??믪쁺臾??⑥씪 諛⑺뼢. ?곷Ц 蹂꾨챸(Microsoft?봎SFT) / ?쒖옄(?붾퉬?붿븘?봏VDA?봏vidia) 留ㅽ븨 遺꾩궛. 寃利??⑥닔 遺?? ?좉퇋 醫낅ぉ 異붽? ???곷Ц 蹂꾨챸 ?꾨씫 ?꾪뿕.
- **洹쇰낯 ?닿껐**:
  1. `AIO_TICKER_NAME_REGISTRY` ?좎꽕 ??30媛?硫붽?罹??깅줉 (NVDA/AAPL/MSFT/...QCOM/AMD/INTC + JPM/BAC/WMT/XOM/V/MA/UNH/BRK.B)
  2. 媛?entry??`{ en, kr, alt[] }` ??蹂꾨챸/?쒖옄/?뚮Ц??蹂꾩묶 紐⑤몢 ?깅줉
  3. `AIO.resolveTickerFromAnyName(input)` ??紐⑤뱺 ?낅젰 ??ticker or null
  4. `AIO.getTickerMappingAudit()` ??誘몃ℓ??entry 蹂닿퀬
- **?좉퇋 洹쒖튃**: R85
- **?뚯씪**: `js/aio-core.js`
- **異붽? ?묒뾽**: v49.33?먯꽌 KR_TICKER_MAP??TICKER_NAME_REGISTRY濡?留덉씠洹몃젅?댁뀡 + ?쒓뎅 醫낅ぉ (?쇱꽦/SK?섏씠?됱뒪 ?? ?깅줉 ?뺤옣

---

## P267 쨌 v49.32 ?뺤옣 쨌 醫낅ぉ蹂?6梨꾨꼸 臾닿껐??寃利?遺??

- **?ъ슜??異붽? ?붿껌**: "醫낅ぉ ?쒖꽭肉??꾨땲??醫낅ぉ/湲곗뾽 愿?⑦븳 紐⑤뱺 ?곗씠?곕뱾??理쒕????먭??섍퀬 議곗궗?대킄"
- **利앹긽**: 醫낅ぉ ?쒖꽭(B2/B3)?????寃利앹? v49.32 蹂?plan?먯꽌 異붽??덉쑝?? **異붿꽭/而⑥꽱?쒖뒪/?대떇/Naver/硫붾え** 5媛?梨꾨꼸? 媛쒕퀎 try-catch ??臾댁떆 ???듯빀 臾닿껐??寃뚯씠??遺??
- **洹쇰낯 ?닿껐**: `AIO.assertTickerDataIntegrity(ticker)` ?좎꽕 ??6媛?梨꾨꼸 ?듯빀 寃利?+ completenessScore (0~100) + verdict (excellent/good/partial/poor) + 沅뚯옣 ?≪뀡
- **?좉퇋 洹쒖튃**: R87
- **?뚯씪**: `js/aio-core.js`
- **寃利?*: `AIO.assertTickerDataIntegrity('QCOM')` ??肄섏넄?먯꽌 6梨꾨꼸 ?곹깭 ?쒕늿???뺤씤

---

## P268 쨌 v49.32 ?뺤옣 쨌 15 fundamental 湲곗? 異쒖쿂 誘몃ℓ??

- **?ъ슜??異붽? ?붿껌**: "15媛?遺꾩꽍 湲곗? ?깅벑 醫낅ぉ/湲곗뾽 愿?⑦븳 紐⑤뱺 ?곗씠?곕뱾??.."
- **利앹긽**: fundamental L8103~8119 "15媛吏 遺꾩꽍 愿?? ?띿뒪?몃쭔 ?섏뿴. 媛?湲곗????곗씠??異쒖쿂(FMP/Finnhub/Yahoo/computed)? 援ы쁽 ?⑥닔媛 肄붾뱶??留ㅽ븨?섏? ?딆쓬 ???ъ슜?먭? "15媛?紐⑤몢 ?됯?"???몄??섎굹 ?ㅼ젣??遺遺꾨쭔 ?됯? 媛??
- **洹쇰낯 ?닿껐**: `AIO_FUNDAMENTAL_CRITERIA.criteria` ?좎꽕 ??15 entries 媛곴컖 `{ label, dataSource, required:[], implFn }` ?깅줉. `getFundamentalCriteriaAudit()` 誘멸뎄????ぉ 蹂닿퀬 + coveragePct
- **?좉퇋 洹쒖튃**: R88
- **?뚯씪**: `js/aio-core.js`
- **寃利?*: `AIO.getFundamentalCriteriaAudit()` ??coveragePct 30% (4/15 援ы쁽, 11/15 implFn null ??v49.33+ 蹂닿컯 ???

---

## P269 쨌 v49.33 쨌 [硫뷀? 洹쇰낯] chatSend ?묐떟 ???먮룞 寃利??듯빀 (R73 ?⑦꽩 ?щ컻 諛⑹?)

- **利앹긽**: v49.32?먯꽌 assertChatResponseAccuracy + getChatHallucinationAudit 5媛?寃利??⑥닔 ?좎꽕?덉쑝??chatSend ?묐떟 ?뚮뜑 肄붾뱶???먮룞 ?몄텧 ?듯빀 誘몄쟻?? R73(?명봽???섏씠吏 ?곸슜 ?숇컲) ?⑦꽩 ?щ컻.
- **洹쇰낯 ?닿껐**: aio-chat.js L3162 `_srcBadge` 吏곹썑??`_accBadge` (aio-chat-accuracy-badge) 異붽? ???묐떟 ?뚮뜑 ???먮룞?쇰줈:
  1. detectedTickers媛 ?덉쑝硫?assertChatResponseAccuracy ?몄텧 ??"??媛寃??뺥솗?? ?먮뒗 "??媛寃?愿대━ high/critical" ?쒖떆
  2. getChatHallucinationAudit ?몄텧 ???섏떖 ?먯닔 0~10 + ?⑦꽩 ?쒖떆
  3. high-risk ?먮뒗 high-severity ??console.warn 濡쒓퉭
- **?좉퇋 洹쒖튃**: R89
- **?뚯씪**: `js/aio-chat.js` L3162~3170 遺洹?

---

## P270 쨌 v49.33 쨌 KR 醫낅ぉ TICKER_NAME_REGISTRY ?깅줉 (KR_TICKER_MAP ?≪닔)

- **利앹긽**: AIO_TICKER_NAME_REGISTRY (v49.32 ?좎꽕)???쒓뎅 醫낅ぉ 誘몃벑濡? "?쇱꽦?꾩옄" ?낅젰 ??KR_TICKER_MAP留??ъ슜 ???듯빀 寃利?寃뚯씠??遺??
- **洹쇰낯 ?닿껐**: REGISTRY??17 KR 醫낅ぉ ?깅줉 ???쇱꽦?꾩옄(005930.KS)/SK?섏씠?됱뒪(000660.KS)/?꾨?李?LGES/移댁뭅???ㅼ씠踰??쇱꽦諛붿씠??LG?뷀븰/?쇱꽦SDI/?ъ뒪肄뷀벂泥섏뿞/?쒗솕?먯뼱濡??쒗솕?ㅼ뀡/SK/LG/HMM/?먯퐫?꾨줈鍮꾩뿞/?먯퐫?꾨줈. ?쒖옄/?쒓?/?곷Ц/蹂꾨챸/?곗빱 紐⑤몢 留ㅽ븨.
- **?뚯씪**: `js/aio-core.js`
- **寃利?*: `AIO.resolveTickerFromAnyName('?쇱쟾')` === '005930.KS'

---

## P271 쨌 v49.33 쨌 15 fundamental 湲곗? implFn 留ㅽ븨 蹂닿컯 (4/15 ??13/15)

- **利앹긽**: v49.32 AIO_FUNDAMENTAL_CRITERIA?먯꽌 11/15 implFn=null. ?ъ슜??"?꾩뺨 15媛?遺꾩꽍" ?붿껌 ???ㅼ젣 ?됯? 媛?ν븳 湲곗?? 4媛쒕퓧.
- **洹쇰낯 ?닿껐**: 湲곗〈 fetch ?⑥닔(fetchNaverUSData/fetchFinnhubRecommendation/fetchFinnhubEarningsCalendar/dynamicTickerLookup/AIO_PIOTROSKI_CHECKLIST)??13/15 留ㅽ븨. PEG(v49.34 computePEG()) + Insider(v49.34 fetchFinnhubInsider()) 2媛쒕쭔 ?붿〈. coveragePct: 27% ??87%.
- **?뚯씪**: `js/aio-core.js` AIO_FUNDAMENTAL_CRITERIA.criteria
- **寃利?*: `AIO.getFundamentalCriteriaAudit().coveragePct >= 80`

---

## P272 쨌 v49.34 쨌 [洹쇰낯?섏젙] 醫낅ぉ ?뺤꽦 遺꾩꽍 15 遺꾩빞 以?9/15 AI ?숈뒿 ?섏〈 (?ъ슜??吏??

- **?ъ슜??吏??*: "鍮꾩쫰?덉뒪 援ъ“ / ?ъ뾽 紐⑤뜽 / ?섏씡 援ъ“ / ?쒗뭹 ?ы듃?대━??/ CEO 寃쎌쁺吏?/ 諛몃쪟?먯씠??/ ?묐젰 ?뚰듃?덉떗 / 怨듦툒留?/ TAM / 由ъ뒪??/ 寃쎌웳 / ?ъ옄?ъ씤????15媛?遺꾩꽍 湲곕쾿 ?곗씠??紐⑤몢 理쒖떊/?뺥솗?쒖?? ?꾩옱 API/?뚯뒪濡???而ㅻ쾭 媛??"
- **Audit 寃곌낵** (15 遺꾩빞 vs ?꾩옱 API):
  - ??Yahoo (price) 쨌 TradingView (chart) 쨌 Yahoo PE+Naver (valuation) 쨌 Finnhub (consensus/earnings) 쨌 AIO_FUNDAMENTAL_CRITERIA (?щТ ?뺣웾) ??6/15
  - ??鍮꾩쫰?덉뒪 援ъ“ / ?ъ뾽 紐⑤뜽 / ?쒗뭹 ?ы듃?대━??/ CEO 寃쎌쁺吏?/ ?묐젰 ?뚰듃?덉떗 / 怨듦툒留?/ 寃쎌웳 ??7/15 AI ?숈뒿 ?섏〈 (high hallucination risk)
  - ???섏씡 援ъ“ (FMP key ?꾩슂) 쨌 TAM (SCREENER_DB 硫붾え 17?? 寃쎄낵) 쨌 由ъ뒪????3/15 遺遺?媛??
- **洹쇰낯 ?닿껐**:
  1. `AIO_ANALYSIS_FRAMEWORK_REGISTRY` ?좎꽕 ??15 遺꾩빞 媛곴컖 `{ label, type, primarySource, implFn, freshness, aiHallucinationRisk, note }` ?깅줉
  2. `AIO.fetchSECBusinessDescription(ticker)` ?좎꽕 ??SEC EDGAR submissions API + CIK 留ㅽ븨 (18 硫붽?罹? ??10-K URL + filing date + SIC 諛섑솚
  3. `AIO.fetchSECRiskFactors(ticker)` ??Item 1A 媛?대뱶 (??URL ?쒖슜)
  4. `AIO.fetchWikipediaCompany(ticker)` ?좎꽕 ??en.wikipedia.org/w/api.php (CORS 吏?? intro 2000??fetch
  5. `AIO.getAnalysisFrameworkCoverageAudit()` ??15 遺꾩빞 醫낇빀 + highRiskCount
  6. `AIO.assertAnalysisFrameworkCoverage(ticker)` async ??醫낅ぉ蹂?fetch ?쒕룄 + coveragePct + verdict
  7. `_fetchTickerDataForChat`??SEC + Wikipedia 蹂묐젹 fetch + system ?꾨＼?꾪듃 [SEC 10-K] / [Wikipedia] ?쇰꺼 二쇱엯
  8. ABSOLUTE RULES 5議?異붽? ??"15 遺꾩빞 異쒖쿂媛 ?놁쑝硫?'寃利앸맂 ?곗씠???놁쓬' ?듬?"
- **?좉퇋 洹쒖튃**: R90
- **?뚯씪**: `js/aio-core.js` (REGISTRY + 4 fetch ?⑥닔 + 2 audit), `js/aio-chat.js` `_fetchTickerDataForChat` ?뺤옣

---

## P273 쨌 v49.34 쨌 SEC EDGAR / Wikipedia 臾대즺 API 誘명솢??(?щ컻 諛⑹?)

- **利앹긽**: AIO Screener媛 臾대즺 怨듦컻 API 2醫?誘명솢????SEC EDGAR (data.sec.gov) + Wikipedia (en.wikipedia.org/w/api.php). ????API??CORS 移쒗솕?곸씠怨?臾댄븳 臾대즺. ?댁쟾源뚯? ?뺤꽦 ?곗씠??fetch ?놁씠 AI ?숈뒿 ?곗씠?곕줈 ?泥?
- **洹쇰낯 ?닿껐**:
  - SEC: CIK_MAP 18媛?硫붽?罹?(NVDA/AAPL/MSFT/GOOGL/AMZN/META/TSLA/QCOM/AMD/INTC/AVGO/TSM/MU/ARM/SMCI/PLTR/NFLX/JPM) ??submissions JSON ??10-K filing URL
  - Wikipedia: TICKER_NAME_REGISTRY.entries[ticker].en ???곷Ц ?섏씠吏 intro 2000??
  - ??API 紐⑤몢 origin=* / corsproxy ?대갚 吏??
- **?뺤옣 ?묒뾽** (v49.35): CIK_MAP 30+ S&P 500 ?뺤옣 + SEC full-text search (CIK 誘몃벑濡?醫낅ぉ ??? + Wikipedia ?쒓뎅 醫낅ぉ (ko.wikipedia.org)

---

## P274 쨌 v49.34 쨌 ANALYSIS_FRAMEWORK 梨꾪똿 ?먮룞 二쇱엯 ?듯빀

- **利앹긽**: REGISTRY + fetch ?⑥닔 ?좎꽕?덉쑝??chatSend???먮룞 ?몄텧 ?듯빀 ???섎㈃ R73 ?⑦꽩 ?щ컻
- **洹쇰낯 ?닿껐**: `_fetchTickerDataForChat`?먯꽌 `secPromise` + `wikiPromise` 蹂묐젹 ?쒖옉 + Naver 寃곌낵 吏곹썑 await + [SEC 10-K] / [Wikipedia] ?쇰꺼濡?system ?꾨＼?꾪듃 二쇱엯. system ?꾨＼?꾪듃 ?앹쓽 ABSOLUTE RULES??"15 遺꾩빞 異쒖쿂 留ㅽ븨" 5議?異붽? ??異쒖쿂 遺??遺꾩빞???숈뒿 ?곗씠???섍컖 湲덉?.
- **?뚯씪**: `js/aio-chat.js` L1845~ 遺洹?

---

## P275 쨌 v49.35 쨌 [洹쇰낯?섏젙] fundamental ?섏씠吏 15 湲곗? registry 遺??+ 媛?⑹꽦 誘멸???(?ъ슜??異붽? 吏??

- **?ъ슜??異붽? 吏??*: "湲곗뾽 遺꾩꽍 ?섏씠吏???덈뒗 15媛쒖쓽 遺꾩꽍 湲곗? ?덉옏?? 洹멸쾬?ㅻ룄 紐⑤몢 ?몃??섍쾶 履쇨컻??議곗궗?댁쨾. ?먰븳 紐⑤뱺 蹂닿컯 ?묒뾽? 洹쇰낯?곸씤 ?섏젙+?щ컻 諛⑹? ?대젃寃?媛숈씠 ?댁쨾????"
- **Audit 寃곌낵** ??fundamental L8175 ?몃씪???띿뒪??"15媛?遺꾩꽍 愿?? vs ?ㅼ젣 援ы쁽:
  - ??6/15 (40%): Quality of Business / Growth / Margin Trend / Valuation PE / Analyst Revisions / Earnings Beat Streak
  - ??5/15 (33%): FCF Yield / Balance Sheet / EV/EBITDA / Industry Rank / Macro Exposure (compute ?⑥닔 誘몄떊??
  - ??4/15 (27%): Moat (Morningstar ?좊즺) / Insider Activity / Institutional Flow / Short Interest (fetch 誘몄떊??
- **硫뷀? 寃고븿**: 3媛쒖쓽 蹂꾧컻 "15湲곗?" ?쒖뒪??怨듭〈 ??(1) v49.25 AIO_FUNDAMENTAL_CRITERIA (Piotroski ?꾩＜) (2) v49.34 ANALYSIS_FRAMEWORK_REGISTRY (?뺣웾+?뺤꽦 ?ъ슜???뺤쓽) (3) fundamental ?섏씠吏 L8175 ?몃씪???띿뒪??(Quality/Moat/Growth/Margin/FCF/Balance/PE/EV/Insider/13F/Short/Revisions/Beat/Industry/Macro) ??cross-reference 遺??
- **洹쇰낯 ?닿껐**:
  1. `AIO_FUNDAMENTAL_PAGE_CRITERIA` registry ?좎꽕 ??15 entries 媛곴컖 `{ num, label, description, dataSource, implFn, plannedFn, requires:[], frequency, hallucinationRisk, note }` ?깅줉
  2. ?섏씠吏 DOM L8175~8189 媛?湲곗? ?놁뿉 ?몃씪??媛?⑹꽦 諛곗? (??援ы쁽 / ??遺遺?/ ??誘멸뎄?? 異붽?
  3. `AIO.getFundamentalPageCriteriaAudit()` ??coveragePct + highRiskCount
  4. `AIO.getCriteriaCrossReferenceAudit()` ??3媛?registry 李⑥씠 ?덈궡
  5. system ?꾨＼?꾪듃 ABSOLUTE RULES 6議?異붽? ??誘멸뎄??4 湲곗?? ?숈뒿 ?곗씠???섍컖 湲덉?, "?섎룞 ?뺤씤 沅뚯옣" ?듬?
- **?좉퇋 洹쒖튃**: R91
- **?뚯씪**: `js/aio-core.js` (registry + 2 audit), `index.html` L8172~8193 (媛?⑹꽦 諛곗?), `js/aio-chat.js` ABSOLUTE RULES 6議?

---

## P276 쨌 v49.35 쨌 [?щ컻 諛⑹?] 3媛?"15湲곗?" registry cross-reference 遺??硫뷀? 寃고븿

- **利앹긽**: v49.25 FUNDAMENTAL_CRITERIA(?뺣웾) / v49.34 ANALYSIS_FRAMEWORK_REGISTRY(?뺤꽦+?뺣웾 ?ъ슜???뺤쓽) / v49.35 FUNDAMENTAL_PAGE_CRITERIA(?섏씠吏 ?몃씪?? ??3媛??쒕줈 ?ㅻⅨ "15湲곗?"??怨듭〈?섏?留?cross-reference ?덈궡 ?놁쓬. AI 梨꾪똿?먯꽌 "15湲곗? 遺꾩꽍" ?붿껌 ???대뒓 寃껋쓣 ?ъ슜?섎뒗吏 遺덈챸??
- **洹쇰낯 ?닿껐**: `AIO.getCriteriaCrossReferenceAudit()` ?좎꽕 ??媛?registry??紐⑹쟻 + 李⑥씠 + ?ъ슜 ?쒖젏 紐낆떆. AI 梨꾪똿 ??system ?꾨＼?꾪듃??"15 遺꾩꽍 遺꾩빞 異쒖쿂 留ㅽ븨" + "fundamental ?섏씠吏 15 湲곗? 媛?⑹꽦" ???뱀뀡 遺꾨━ 紐낆떆.
- **?뚯씪**: `js/aio-core.js` getCriteriaCrossReferenceAudit + `js/aio-chat.js` ABSOLUTE RULES 6議?

---

## P277 쨌 v49.35 쨌 誘멸뎄??4 湲곗? v49.36 Roadmap 紐낆떆

- **?붿〈 ?묒뾽** (v49.36+):
  - `computeFcfYield(ticker)` ??FCF/?쒖킑 (Yahoo mcap + FMP FCF)
  - `computeBalanceSheetRatios(ticker)` ??Net Debt/EBITDA + Interest Coverage (FMP)
  - `computeEvEbitda(ticker)` ??EV/EBITDA + peer comparison
  - `fetchFinnhubInsider(ticker)` ???꾩썝 留ㅼ닔/留ㅻ룄 12二??꾩쟻
  - `fetchSEC13F(ticker)` ??13F 湲곌? 蹂댁쑀 (遺꾧린)
  - `fetchFinnhubShortInterest(ticker)` ??5%???뺤긽 ?꾧퀎媛?audit
  - `computeMacroBeta(ticker)` ??湲덈━/?щ윭/?먯옄??踰좏? (DATA_SNAPSHOT ?쒖슜)
- **紐⑺몴**: 15/15 (100%) coverage. v49.36?먯꽌 7 ?⑥닔 ?좎꽕濡??꾩꽦.
- **硫뷀? ?먯튃 (R73)**: ?명봽??異붽? ???섏씠吏 ?곸슜 ?숇컲. ?섏씠吏 諛곗? ???????볥줈 媛깆떊 + AI 梨꾪똿 媛?⑹꽦 ?덈궡 ?숆린??

---

## P278 쨌 v49.36 쨌 [洹쇰낯?섏젙] fundamental 15 湲곗? 100% 而ㅻ쾭 (v49.35 ?붿〈 7 ?⑥닔 ?좎꽕)

- **?ъ슜???붿껌**: "?대쾲 ?몄뀡 ?⑥? ?묒뾽???쒖감?곸쑝濡?紐⑤몢 吏꾪뻾"
- **v49.35 Roadmap ?붿〈**: computeFcfYield / computeBalanceSheetRatios / computeEvEbitda / computeMacroBeta / fetchFinnhubInsider / fetchSEC13F / fetchFinnhubShortInterest ??7 ?⑥닔
- **洹쇰낯 ?닿껐**: 7 ?⑥닔 紐⑤몢 ?좎꽕 + FUNDAMENTAL_PAGE_CRITERIA implFn 媛깆떊 + ?섏씠吏 媛?⑹꽦 諛곗? 紐⑤몢 ??(Moat/Industry Rank ?쒖쇅 14/15)
- **?좉퇋 洹쒖튃**: R92
- **?뚯씪**: `js/aio-core.js` 7 ?⑥닔 ?좎꽕 + criteria 媛깆떊, `index.html` L8175~8189 7 諛곗? 媛깆떊

### ?좉퇋 ?⑥닔 ?곸꽭
1. **computeFcfYield(ticker)**: FCF / ?쒖킑 ??Naver financials + Yahoo mcap. verdict: attractive (4%+) / fair / low
2. **computeBalanceSheetRatios(ticker)**: Net Debt/EBITDA + Interest Coverage. healthScore: strong (????異⑹”) / caution
3. **computeEvEbitda(ticker)**: EV ??mcap + netDebt, EV/EBITDA + SCREENER_DB peer count. verdict: cheap (<10) / fair / expensive
4. **computeMacroBeta(ticker)**: SCREENER_DB sector ??11 sector heuristic beta table (rateBeta/dxyBeta/oilBeta). diversificationVerdict: high-exposure / low-exposure
5. **fetchFinnhubInsider(ticker)**: /stock/insider-transactions 12二???netShares + verdict: insider-buying / insider-selling / neutral
6. **fetchFinnhubShortInterest(ticker)**: /stock/metric shortInterestPercent. verdict: normal (<5%) / elevated / squeeze-candidate
7. **fetchSEC13F(ticker)**: SEC EDGAR full-text + WhaleWisdom URL. verdict: manual-query-required (AI URL fetch)

### 蹂댁“ (v49.34 ?붿〈)
- **fetchSECRecentFilings(ticker)**: 8-K event-driven URL (M&A/?뚰듃?덉떗/CEO 蹂寃?
- **fetchFMPSegments(ticker)**: /revenue-product-segmentation (FMP key ?꾩슂)
- **CIK_MAP 18 ??50+** ?뺤옣: BAC/WFC/C/GS/MS/V/MA/JNJ/PFE/UNH/WMT/PG/KO/PEP/XOM/CVX/BA/CAT/GE/HON/DIS/NKE/MCD/COST/HD/LOW/CRM/ORCL/ADBE/NOW/SHOP/COIN/BRK.B/BRK.A

---

## P279 쨌 v49.36 쨌 [硫뷀? 洹쇰낯] R73 ?⑦꽩 ??7 ?⑥닔 ?좎꽕 + ?섏씠吏 媛?⑹꽦 諛곗? ?숈떆 媛깆떊

- **R73 以??*: ?명봽??異붽? ???섏씠吏 ?곸슜 ?숇컲. 7 ?좉퇋 ?⑥닔 ?뺤쓽 + FUNDAMENTAL_PAGE_CRITERIA implFn 媛깆떊 + ?섏씠吏 L8175~8189 媛?⑹꽦 諛곗? (???????? + 而ㅻ쾭由ъ? 諛뺤뒪 (40% ??93%) + chat ABSOLUTE RULES 6議?媛깆떊??v49.36 ?⑥씪 踰꾩쟾??紐⑤몢 ?ы븿.

---

## P280 쨌 v49.36 쨌 v49.34 Roadmap ?붿〈 ?쒖젙 ??CIK_MAP 50+ + 8-K + FMP segments

- **v49.34 Roadmap**: CIK_MAP 30+ ?뺤옣 / SEC 8-K (event-driven ?뚰듃?덉떗) / FMP segments
- **洹쇰낯 ?닿껐**: CIK_MAP 18 ??50+ (S&P 500 硫붽?罹?異붽?) + fetchSECRecentFilings (8-K URL) + fetchFMPSegments (FMP key ?섏〈 紐낆떆)
- **?뚯씪**: `js/aio-core.js`

---

## P281 쨌 v49.36 쨌 [Roadmap ?꾨즺] v49.32 streaming 寃利?+ v49.35 ?섏씠吏 媛?⑹꽦 媛?쒗솕 + Moat/Industry IBD ?좊즺 ?泥??뺤콉

- **?붿빟**: v49.32~v49.35 Roadmap ?붿〈 ?묒뾽 紐⑤몢 v49.36?먯꽌 ?듯빀 泥섎━
- **?붿〈 v49.37+**: (1) computeMacroBeta historical regression (?꾩옱 ?대━?ㅽ떛) (2) Wikipedia ?쒓뎅 醫낅ぉ (ko.wikipedia.org) (3) streaming ?묐떟 token ?⑥쐞 寃利?(?꾩옱 ?묐떟 ??寃利?

---

## P282 쨌 v49.37 쨌 [硫뷀? 洹쇰낯] ?섏씠吏 sequential audit 遺????line range/keyword grep留?諛섎났

- **?ъ슜??吏??*: "?ㅽ겕由щ꼫 媛??섏씠吏留덈떎 紐⑤뱺 ?댁슜???꾩뿉?쒕????꾨옒濡??섎굹?섎굹???쎄퀬 ?ъ슜?섎㈃???몃??섍쾶 ?먭??쒓굅吏? ?뷀뀒?쇳븯寃?履쇨컻??理쒖떊???뺥솗???뺥빀??濡쒖쭅??吏곴????듭떖???먭??"
- **?붿쭅???듬?**: ?꾨땲?? v49.23 4異?audit + v49.30 ?꾩닔 理쒖떊??audit + v49.32~36 ?묒뾽 紐⑤몢 line range 遺꾩꽍 + ?ㅼ썙??grep ?꾩＜. ?ㅼ젣 sub-section ?⑥쐞 6異??먭? 誘몄떎??
- **洹쇰낯 ?닿껐**:
  1. `AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY` ?좎꽕 ??21 ?섏씠吏 횞 subSections[] 횞 axes 6 留ㅽ듃由?뒪
  2. `AIO.getPageSequentialAuditStatus()` ??pending/partial/done 異붿쟻
  3. home ?섏씠吏 8 subSection enumerate (踰꾩쟾 諛곗? / ?곷떒 ?ㅻ깄 洹몃━??/ 3 移대뱶 / Action Item / ?ъ링 ?댁꽕 / 由ъ뒪???덉씠??/ F&G+CNN / GMO ??
- **?좉퇋 洹쒖튃**: R93
- **?뚯씪**: `js/aio-core.js`

---

## P283 쨌 v49.37 쨌 home L3967 live-quote-ts-topbar ?곴뎄 placeholder ?붿〈 ?꾪뿕

- **利앹긽**: home ?곷떒 ?ㅻ뜑 `#live-quote-ts-topbar` ?뺤쓽???덉쑝??紐⑤뱺 JS ?뚯씪??媛깆떊 hook 0媛? fetchLiveQuotes ?깃났 ??`live-quote-ts` 媛깆떊? ?덉쑝??`-topbar` 誘몃룞湲???"?쒖꽭 ?곌껐 以?.." placeholder ?곴뎄 ?붿〈 媛??
- **洹쇰낯 ?닿껐**: `js/aio-data.js` L9793 遺洹?fetchLiveQuotes ?깃났/?ㅽ뙣 遺꾧린??`live-quote-ts-topbar` ?숈떆 媛깆떊 異붽?. ?깃났 ??`???쒖꽭 HH:MM (N媛?` + class `fb-live`. ?ㅽ뙣 ??`??N珥????ъ떆?? + class `fb-static`.
- **?뚯씪**: `js/aio-data.js` L9792~9802

---

## P284 쨌 v49.37 쨌 home ?섏씠吏 8 subSection sequential 1李??먭? 寃곌낵

- **?먭? 寃곌낵** (?꾟넂?꾨옒):
  1. L3961 踰꾩쟾 諛곗?: ??v49.36 ?붿〈 ??v49.37 媛깆떊 (R1 ?숆린??
  2. L3970~4019 ?곷떒 ?ㅻ깄 洹몃━?? ??(live-quote-ts-topbar ?쒖쇅)
  3. L4020~4051 3 移대뱶 (Primary/Secondary): ??(v49.28 CARD_HIERARCHY ?곸슜 ?꾨즺)
  4. L4053~4068 Action Item 移대뱶: ??(v49.28 ?좎꽕, ACTION_RULES ?몄텧)
  5. L4070~4140 ?ъ링 ?댁꽕: ??(?쇱퀜蹂닿린 ?뺤긽)
  6. L4140~4250 由ъ뒪???덉씠?? 誘몄젏寃 (v49.38+)
  7. L4140~4250 F&G+CNN 7+2 而댄룷?뚰듃: ??(v49.23 ?뺥빀 ?꾨즺)
  8. L4250~4367 GMO ?? 誘몄젏寃 (v49.38+)
- **寃곕줎**: home 6/8 sub-section OK + 2 誘몄젏寃 + P283 ?쒖젙
- **?뚯씪**: home ?섏씠吏 8 subSection 紐⑤몢 REGISTRY ?깅줉

---

## P285 쨌 v49.37 쨌 v49.38+ ?붿〈 ??20 ?섏씠吏 sequential audit 誘몄떎??

- **?곹깭**: AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY??21 ?섏씠吏 ?깅줉?섏뿀?쇰굹 home留?1李??먭? ?꾨즺. ?섎㉧吏 20 ?섏씠吏 (signal/breadth/sentiment/briefing/technical/macro/fxbond/fundamental/themes/portfolio/options/kr-home/kr-supply/kr-themes/kr-macro/kr-technical/guide/glossary/market-news/fund-analysis) sub-section enumerate + 6異??먭? 誘몄떎??
- **?붿〈 ?묒뾽** (v49.38+):
  - v49.38: signal + breadth + sentiment ?섏씠吏 (US 醫낇빀 3)
  - v49.39: briefing + technical (US 遺꾩꽍 2)
  - v49.40: macro + fxbond + fundamental (US 遺꾩꽍 3)
  - v49.41: themes + portfolio + options (US 6)
  - v49.42: kr-home + kr-supply + kr-themes + kr-macro + kr-technical (KR 5)
- **紐⑺몴**: 21 ?섏씠吏 횞 ?됯퇏 8~10 subSection 횞 6異?= 1000+ 留ㅽ듃由?뒪 ??ぉ done. v49.42 ?꾩꽦 ??R93 100% 以??

---

## P286 쨌 v49.38 쨌 [R56 蹂닿컯/F1] home L4222 VIX ??vs THRESHOLD_REGISTRY 遺덉씪移?

- **利앹긽**: home L4222~4229 ?몃씪??VIX ?쒓? 5 援ш컙 (12/20/30/45/?? + ?쇰꺼 "?⑤땳 吏꾩엯"쨌"?쒖뒪???꾧린"濡??쒖떆. THRESHOLD_REGISTRY.VIX??6 援ш컙 (12/20/25/30/40/?? + ?쇰꺼 "二쇱쓽/寃쎄퀎/怨듯룷/洹밸떒 怨듯룷". ???ъ슜?먭? ??怨녹뿉???ㅻⅨ ?쇰꺼 ?몄텧.
- **2李??먭? 諛쒓껄**: home ?섏씠吏 ?꾟넂?꾨옒 sequential ?먭??먯꽌 諛쒓껄 (v49.37 1李⑥뿉?쒕뒗 line range 遺꾩꽍留??덉쓬)
- **洹쇰낯 ?닿껐**:
  1. ?몃씪????6 援ш컙?쇰줈 媛깆떊 + `data-threshold-table="VIX"` 留덉빱 遺李?
  2. ?쇰꺼??REGISTRY? ?뺥솗???쇱튂 ("洹밸떒 ?덉젙/?뺤긽 Risk-On/二쇱쓽/寃쎄퀎/怨듯룷/洹밸떒 怨듯룷")
  3. `AIO.getInlineThresholdTableAudit()` ?좎꽕 ??留덉빱 蹂댁쑀 ?쒕? ?먮룞 ?뺥빀 寃利?
- **?좉퇋 洹쒖튃**: R94 (R56 蹂닿컯)
- **?뚯씪**: `index.html` L4222~4229, `js/aio-core.js` audit + THRESHOLD_REGISTRY VIX

---

## P287 쨌 v49.38 쨌 [F2] home L4224 ?ㅽ? `酉곕툝` ??`踰꾨툝`

- **利앹긽**: VIX ??泥???"< 12 / 洹밸떒???덉젙 / **酉곕툝** ?뺤꽦 ?꾩“ (2017, 2019)" ???쒓? ?ㅽ?
- **洹쇰낯 ?닿껐**: `酉곕툝` ??`踰꾨툝` ?뺤젙
- **?щ컻 諛⑹?**: home ?섏씠吏 2李?sequential ?먭? ?섎Т??(R93 蹂닿컯)
- **?뚯씪**: `index.html` L4224

---

## P288 쨌 v49.38 쨌 [R56 蹂닿컯/F3] DXY/10Y ?꾧퀎媛?REGISTRY 誘몃벑濡?

- **利앹긽**: home L4327 DXY ?꾧퀎媛?"> 105 Risk ??뭾 / < 95 Risk-On" ?몃씪?? L4338 10Y "4% ?댁긽 遺??/ 3% ?댄븯 ?뷀솕" ?몃씪?? REGISTRY 誘몃벑濡???R56 ?꾨컲.
- **洹쇰낯 ?닿껐**: THRESHOLD_REGISTRY??異붽?
  - **DXY**: 5 bands (< 95 ?쎌꽭-Risk-On / < 100 以묐┰ / < 105 媛뺤꽭 / < 110 Risk ??뭾 / 110+ 洹밸떒 媛뺤꽭)
  - **YIELD_10Y**: 5 bands (< 3 寃쎄린 ?뷀솕 / < 4 ?뺤긽 / < 4.5 諛몃쪟?먯씠??遺??/ < 5 ?꾪뿕 / 5+ ?쒖뒪???뺣젰)
  - `getLabel(value)` ?⑥닔
- **?뚯씪**: `js/aio-core.js` THRESHOLD_REGISTRY

---

## P289 쨌 v49.38 쨌 [R93 蹂닿컯/F4] home subSections 1李?enumerate 遺덉셿??(8 ??15)

- **利앹긽**: v49.37?먯꽌 home subSections 8媛쒕쭔 ?깅줉. ?ㅼ젣 ?꾟넂?꾨옒 ?먭? ??異붽? 7媛?誘몃벑濡?(?ㅼ퐫??踰붾? / conclusion-bar / KPI 4 移대뱶 / ?쒕툕 吏??chips / ?곷떒 ?쇱퀜蹂닿린 ??/ GMO ?댁꽕 ??.
- **洹쇰낯 ?닿껐**: subSections 8 ??15 ??enumerate + `findings[]` 諛곗뿴 異붽? (?먭? 寃곌낵 ?꾩쟻 ???
- **?щ컻 諛⑹?**: R93 page sequential audit ?섎Т 媛뺥솕 ??1李?enumerate??紐⑤뱺 sub-section 鍮좎쭚 ?놁씠 ?깅줉 + ?먭? ??findings??寃곌낵 ?꾩쟻
- **?뚯씪**: `js/aio-core.js` AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY.pages.home

---

## P319 쨌 v49.49 쨌 [R101 踰꾧렇 + R102 ?대━?ㅽ떛 蹂닿컯] LIVE_SYMBOLS const top-level??window ?몄텧 ????+ R102 '?湲? ?⑥뼱 false positive

- **?ъ슜???붿껌 (2026-05-19)**: "留덉? 紐????쇱씠釉??먭?怨??묒뾽?ㅻ룄 吏꾪뻾?댁쨾"
- **Chrome MCP ?쇱씠釉?v49.48 吏꾨떒**:
  - **R101_total: 0** + **R101_issueCount: 131** ??紐⑤뱺 DOM ticker 誘몃벑濡?false report
  - kr-technical placeholder `kr-semi-export-yoy` false positive (媛?"+157.9% YoY (...5??媛깆떊 ?湲?"??"?湲? ?⑥뼱 留ㅼ묶)
- **洹쇰낯 ?먯씤 1 (R101 踰꾧렇)**: `aio-data.js` L8594 `const LIVE_SYMBOLS = [...]` top-level const??**module scope**?닿퀬 **window property ?꾨떂** ??R101 audit??`new Set(window.LIVE_SYMBOLS || [])` ?몄텧 ??鍮?Set ?앹꽦 ??131 ticker 紐⑤몢 誘몃벑濡?false report.
- **洹쇰낯 ?먯씤 2 (R102 false positive)**: R102 placeholder ?대━?ㅽ떛 `/濡쒕뵫|loading|怨꾩궛 以?遺꾩꽍 以??湲?i.test(r.text)` ??蹂몃Ц ?띿뒪???덉쓽 "?湲? ?⑥뼱 留ㅼ묶. "+157.9% YoY (2??湲곗? 쨌 5??媛깆떊 ?湲?" 媛숈? ?뺤긽 媛믪뿉 stale ?쇰꺼??遺숈? 寃쎌슦??placeholder濡??ㅼ씤.
- **洹쇰낯 ?닿껐** (v49.49):
  1. **R101 fix**: `js/aio-data.js` L8774 `window.LIVE_SYMBOLS = LIVE_SYMBOLS;` ?몄텧 ??以?異붽?.
  2. **R102 蹂닿컯**: placeholder ?먯젙 ?대━?ㅽ떛 媛뺥솕 ??`text.length >= 25`硫?placeholder ?쒖쇅 (蹂몃Ц???띿뒪??蹂댄샇) + `^濡쒕뵫|^怨꾩궛\s*以? 媛숈씠 ?띿뒪???쒖옉/?⑥뼱 寃쎄퀎 留ㅼ묶?쇰줈 蹂寃?
- **?щ컻 諛⑹?** (R101 蹂닿컯): ?좉퇋 const top-level 蹂?섎뒗 R101 媛숈? audit?먯꽌 ?ъ슜 ??諛섎뱶??`window.X = X` ?몄텧 紐낆떆.
- **?뚯씪**: `js/aio-data.js` L8774 + `js/aio-core.js` getCellLevelDataAudit placeholder ?⑦꽩

---

## P318 쨌 v49.48 쨌 [R102 ?좉퇋] ?섏씠吏 cell-level audit ?⑥닔 遺????sub-section enumerate 蹂대떎 ?몃?

- **?ъ슜??吏??(2026-05-19)**: "?꾩껜 ?섏씠吏?먯꽌 紐⑤뱺 ?댁슜怨??곗씠???몃??섍쾶 履쇨컻???뺤씤?쒓굅吏?"
- **?뺤쭅 寃利?寃곌낵**: v49.42/v49.47 sub-section enumerate(?쇱씤 踰붿쐞 + 移댄뀒怨좊━ ?쇰꺼)留??덇퀬 **移대뱶 ?대? 媛??됱긽/?꾧퀎媛?placeholder 寃利?誘몄닔??*. ?쇱씠釉??먭? 寃곌낵 `has_cellLevelAudit: false`.
- **洹쇰낯 ?닿껐** (v49.48 A3): `AIO.getCellLevelDataAudit(pageId)` ?좉퇋 ???섏씠吏??紐⑤뱺 cell-level ?붿냼 enumerate + 媛??됱긽/snap-key/live-key/threshold-key/archive ?곹깭 罹≪퀜 + placeholder ?먮룞 遺꾨쪟.
- **Chrome MCP ?쇱씠釉?寃利?* (v49.48 fxbond/options ?섏씠吏):
  - fxbond: 42 cells / 0 placeholder ??
  - options: 16 cells / 0 placeholder ??
  - theme-detail: 3 cells / 1 placeholder (XSD ??P315 SW 罹먯떆 stale)
- **?좉퇋 洹쒖튃 R102**: ?섏씠吏 cell-level audit ?섎Т.
- **?뚯씪**: `js/aio-core.js` (getCellLevelDataAudit + getAutoOpsReadiness 27異??듯빀 + commands map)

---

## P317 쨌 v49.48 쨌 [R101 ?좉퇋] DOM ticker vs LIVE_SYMBOLS coverage ?먮룞 ?먯? 遺??

- **?ъ슜??吏??(2026-05-19)**: "?щ컻 諛⑹???媛숈씠 ?쒓굅吏?"
- **?뺤쭅 寃利?寃곌낵**: P315 (XSD ticker 誘몃벑濡? ?쒖젙 ???먮룞 ?먯? audit 遺?? 媛숈? ?⑦꽩 ?щ컻 ???ъ슜??蹂닿퀬 + 諛쒓껄 cycle 諛섎났.
- **洹쇰낯 ?닿껐** (v49.48 A2): `AIO.getLiveSymbolsCoverageAudit()` ?좉퇋 ??紐⑤뱺 `[data-live-price]` ticker媛 `LIVE_SYMBOLS`???깅줉?먮뒗吏 ?먮룞 ?먯?. template placeholder(`${sym}`) + `data-aio-archive` ?쒖쇅.
- **getAutoOpsReadiness 27異??듯빀** ??liveSymbolsCoverage status ?먮룞 蹂닿퀬.
- **?좉퇋 洹쒖튃 R101**: DOM ticker??諛섎뱶??LIVE_SYMBOLS ?깅줉 ?섎Т ??`getLiveSymbolsCoverageAudit()`濡??먮룞 寃利?
- **?뚯씪**: `js/aio-core.js` (R101 audit + getAutoOpsReadiness)

---

## P316 쨌 v49.48 쨌 [R75 蹂닿컯] STATIC_CONTENT_LIFECYCLE hook jensen-hardcoded ???쇰컲??

- **?ъ슜??吏??*: "洹쇰낯 ?섏젙 + ?щ컻 諛⑹???媛숈씠 ?쒓굅吏?"
- **?뺤쭅 寃利?寃곌낵 (Chrome MCP)**: v49.47 P314媛 Jensen ?명꽣酉?hook留?hardcoded 異붽?. `briefing-week-may-4-10` / `kr-export-2026-02` 媛숈? ?ㅻⅨ LIFECYCLE ??ぉ ?숈쟻 媛깆떊 ???? ?쇱씠釉?grep: `lifecycle_jensen_only: 5` (registry + tests?먮쭔 ?깆옣).
- **洹쇰낯 ?닿껐** (v49.48 A1):
  1. **`window._aioStaticContentLifecycleHook(rootEl?)`** ?좉퇋 ??紐⑤뱺 `[data-lifecycle-id="ID"]` 留덉빱 element???몄젒 `[id$="-stale-days"]` ?먮뒗 `.lifecycle-stale-days` span ?먮룞 媛깆떊. archiveDue ??amber, replaceDue ??red ?됱긽 ?먮룞 ?쒖떆.
  2. **`_aioPageBus.register('core-lifecycle-hook', 'aio:pageShown', ...)`** ??紐⑤뱺 ?섏씠吏 吏꾩엯 ???먮룞 ?몄텧 (200ms ?붾컮?댁뒪).
  3. **briefing pageShown hook jensen-hardcoded ?쒓굅** ??`_aioStaticContentLifecycleHook()` ?꾩엫?쇰줈 ?⑥씪??
  4. **index.html `briefing-week-may-4-10` element??`data-lifecycle-id` 留덉빱 + `#briefing-week-may-stale-days` span 異붽?**.
- **R75 蹂닿컯**: STATIC_CONTENT_LIFECYCLE ?깅줉 肄섑뀗痢좊뒗 ?섏씠吏??`data-lifecycle-id` 留덉빱 + stale-days span ?섎Т.
- **?뚯씪**: `js/aio-core.js` (briefing hook ?⑥닚??+ L4124 遺洹??쇰컲???⑥닔 + pageBus ?먮룞 ?깅줉) + `index.html` L6137~6141 (briefing-week-may 留덉빱)

---

## P315 쨌 v49.47 쨌 [?쇱씠釉??뺣? 吏꾨떒] sentiment 3 + theme-detail 1 placeholder ??VIX 湲곌컙援ъ“ 誘몄쓳??+ XSD ticker LIVE_SYMBOLS 誘몃벑濡?

- **?ъ슜???붿껌 (2026-05-19)**: "吏湲?釉뚮씪?곗? ?ъ씠???곌껐?쒓???媛곴컖???섏씠吏 ?꾩껜 ?곗씠???섎굹?섎굹???뺥빀??理쒖떊??濡쒖쭅???몃??섍쾶 議곗궗"
- **Chrome MCP 吏꾨떒 寃곌낵**:
  - sentiment ?섏씠吏 3 placeholder: `^VIX9D / ^VIX3M / ^VIX6M` ??LIVE_SYMBOLS L8657???대? ?깅줉?섏뼱 ?덉쑝??Yahoo Finance ?묐떟 媛蹂 (?뱀젙 ?쒓컙? 誘몄쓳??
  - theme-detail ?섏씠吏 1 placeholder: `XSD` (SPDR S&P Semiconductor ETF) ??LIVE_SYMBOLS **誘몃벑濡?*
- **?쒖젙**:
  - `XSD` ticker LIVE_SYMBOLS L8731??異붽? (`'SMH','SOXX','XSD','XBI'`)
  - VIX 湲곌컙援ъ“???섎룄??誘몄떆??(?대? ?깅줉, ?묐떟 媛蹂)
- **?뚯씪**: `js/aio-data.js` LIVE_SYMBOLS L8731

---

## P314 쨌 v49.47 쨌 [R75 蹂닿컯] Jensen ?명꽣酉?34??overdue ??STATIC_CONTENT_LIFECYCLE ?숈쟻 媛깆떊 hook 遺??

- **Chrome MCP 吏꾨떒**: `jensen-interview` snap-date `2026-04-15` ???ㅻ뒛 2026-05-19 = **34??寃쎄낵**. `STATIC_CONTENT_LIFECYCLE.jensen-interview-202603 archiveAfterDays:30` 珥덇낵.
- **洹쇰낯 ?먯씤**: v49.42 P304?먯꽌 ?뺤쟻 ?띿뒪??"58??寃쎄낵 (60???꾨컯)" ?쒓굅?섍퀬 ?숈쟻 `#jensen-interview-stale-days` span ?⑤룆 ?쒖떆濡?蹂寃쏀뻽?쇰굹 **洹?span??梨꾩슦??hook 肄붾뱶 ?꾨씫** ???곴뎄 "寃쎄낵 怨꾩궛以? ?쒖떆.
- **?쒖젙** (v49.47 A2):
  - `_aioPageBus 'core-briefing-action'` hook ?덉뿉 `STATIC_CONTENT_LIFECYCLE.getStatus('jensen-interview-202603')` ?몄텧 + #jensen-interview-stale-days ?숈쟻 媛깆떊
  - archiveDue ??"?벀 archive ?④퀎 (30?? 珥덇낵)" amber ?쒖떆
  - replaceDue ??"?좑툘 ???명꽣酉?援먯껜 沅뚯옣 (60?? 珥덇낵)" red ?쒖떆
  - fresh ??"{N}??寃쎄낵 (fresh)"
- **?щ컻 諛⑹?**: R75 蹂닿컯 ??STATIC_CONTENT_LIFECYCLE ?깅줉 肄섑뀗痢좊뒗 諛섎뱶???섏씠吏 吏꾩엯 ??getStatus ?숈쟻 媛깆떊 hook ?꾩닔.
- **?뚯씪**: `js/aio-core.js` L1497~1525 (briefing pageShown hook)

---

## P313 쨌 v49.47 쨌 [R74/R97 蹂닿컯] data-snap ??14嫄??쒕뱶 遺????aliasMap 留ㅽ븨 ?꾨씫

- **Chrome MCP 吏꾨떒 (v49.46 R98 v2 + ?좉퇋 audit ?쇨큵 ?몄텧)**:
  - R96 dataActionHandler: ok / 102 actions / 0 missing ??(P294 ?쒖젙 ?④낵)
  - R97 staticSeedFallback: **warn / 14嫄?誘몄떆??*
  - R98 v2 varHoist: ok / 0 conflicts ??
  - R99 shellAsset: ok / 9 local 200 OK ??
- **R97 14嫄?誘몄떆??* (Chrome MCP 吏곸젒 ?뺤씤):
  - sentiment: hy-spread
  - macro: wage-growth, housing
  - fxbond: tnx-2y
  - kr-home: krw-full, vkospi-chg, kr-credit, kr-semi-export-yoy-label
  - kr-macro: kr-cpi-yoy, kr-ppi-yoy, kr-manuf-pmi, kr-gdp-qoq, kr-semi-export-feb, kr-semi-export-yoy
- **洹쇰낯 ?먯씤**: R97 audit??kebab?뭖amel 蹂?섎쭔?쇰줈??遺議???DS ?꾨뱶紐낆뿉 prefix(us/kr) ?먮뒗 suffix(Balance/Starts) ?덉뼱 留ㅼ묶 ?ㅽ뙣.
- **?쒖젙 2-tier**:
  1. **R97 audit aliasMap 14 entries 異붽?** (js/aio-core.js L3032~3048) ??`wage-growth?뭫sWageGrowth`, `housing?뭜ousingStarts`, `kr-credit?뭟rCreditBalance` ?? **?ㅼ닔 ?ㅺ? alias 留ㅽ븨?쇰줈 ?먮룞 ?닿껐**.
  2. **吏꾩쭨 ?꾨씫 ?쒕뱶 5媛?DS 異붽?**:
     - `hySpread: 289` (sentiment HY ?ㅽ봽?덈뱶 bps)
     - `tnx2y: 4.28` (fxbond 2Y Treasury yield)
     - `vkospiPct: -1.20` (kr-home VKOSPI 蹂?숇쪧)
     - `krPpi: 1.5` (kr-macro PPI YoY)
     - `krManufPmi: 51.5` (kr-macro ?쒖“??PMI)
- **?щ컻 諛⑹?**: R74 蹂닿컯 ??`data-snap` ??異붽? ??aliasMap ?먮뒗 DS 吏곸젒 ?쒕뱶 ?깅줉 ?섎Т.
- **?뚯씪**: `js/aio-core.js` getStaticSeedFallbackAudit aliasMap + DATA_SNAPSHOT 5 ?쒕뱶
- **violated_rule**: R74 (蹂닿컯)

---

## P312 쨌 v49.45 쨌 [R100 ?좉퇋] API ??????쒖뒪???⑥씪 ??μ냼 + 諛깆뾽/蹂듭썝 UX 遺?????ъ슜?????먯떎 ?꾪뿕

- **?ъ슜??蹂닿퀬 (2026-05-18 22:30)**: "?꾧뎔媛??API ??紐⑤몢 ?좊씪媛붾떎?섎뜲?" ??P310/P311 cascading ???쇰? ?ъ슜?먭? 肄섏넄 ?먮윭 + ?곗씠??誘몄닔??蹂닿퀬 罹먯떆 ?대━???쒕룄 ??localStorage ?쇨큵 ??젣 ??API ???숇컲 ?먯떎 異붿젙.
- **?뺣? ?먭? 寃곌낵** (Task #6):
  - **????꾩튂**: `localStorage` ?⑥씪 (aio-core.js L6292 `_AioVault.getStorage()`). public mode ??`sessionStorage` (??醫낅즺 ?먮룞 ??젣).
  - **?뷀샇??*: PIN ?ㅼ젙 ??AES-GCM 256 + PBKDF2 100k (L6249~6269). PIN 誘몄꽕?????됰Ц.
  - **CRITICAL 寃고븿 3嫄?*:
    1. **?⑥씪 ??μ냼** ??IndexedDB ?댁쨷???놁쓬. 釉뚮씪?곗? "荑좏궎 諛??ъ씠???곗씠????젣" ??100% ?먯떎.
    2. **諛깆뾽/蹂듭썝 UX 遺??* ??export/import ?⑥닔 ?놁쓬. ???먯떎 ???ъ슜?먭? 11媛???紐⑤몢 ?ъ엯??
    3. **?ъ슜??寃쎄퀬 ?놁쓬** ??罹먯떆 ?대━??= ???먯떎 ?몄? 遺??
  - **?먮룞 ??젣 肄붾뱶 寃利?*: `aio_finnhub_key` / `aio_fmp_key` ??紐낆떆 `localStorage.removeItem` 0嫄???肄붾뱶???먮룞 ??젣?섏? ?딆쓬. ?몃? ?붿씤(?ъ슜??罹먯떆 ?대━?? ?쒗겕由?紐⑤뱶, ?ㅻⅨ 釉뚮씪?곗?)???섑븳 ?먯떎.
- **洹쇰낯 ?닿껐** (v49.45 R100 ?좉퇋 ??3以??덉쟾留?:
  1. **`_aioIdbBackupKeys(snapshot)`** ??IndexedDB `aio-keys-backup` DB??`keys` store??`{snapshot, ts}` mirror. 釉뚮씪?곗? 罹먯떆 ?대━?????쇰? 紐⑤뱶(?? "荑좏궎留???젣")?먯꽌 IndexedDB 蹂댁〈.
  2. **`_aioIdbRestoreKeys()`** ??IndexedDB?먯꽌 理쒓렐 諛깆뾽 read.
  3. **`_aioCollectKeySnapshot()`** ???꾩옱 11 SENSITIVE_KEYS ?됰Ц/罹먯떆 媛??섏쭛.
  4. **`_aioAutoBackupKeys()`** ??`_saveApiKey` ?몄텧 ??+ ?섏씠吏 濡쒕뱶 ??5珥?+ 5遺꾨쭏???먮룞 IndexedDB mirror (fire-and-forget).
  5. **`AIO.exportApiKeys({masked: bool})`** ??JSON ?뚯씪 ?ㅼ슫濡쒕뱶 (留덉뒪???듭뀡). ?ъ슜??紐낆떆 諛깆뾽.
  6. **`AIO.importApiKeys(jsonString)`** ??JSON ?뚯씪 ?먮뒗 媛앹껜?먯꽌 蹂듭썝. masked 諛깆뾽? 嫄곕?.
  7. **`AIO.recoverApiKeysFromIdb()`** ??localStorage 鍮꾩뼱?덉쓣 ??IndexedDB?먯꽌 ?먮룞 蹂듭썝.
- **?щ컻 諛⑹?** (R100 ?좉퇋): API ????μ? 諛섎뱶??2以??댁긽 ??μ냼 + 紐낆떆 諛깆뾽/蹂듭썝 UX ?쒓났 ?섎Т.
- **?ъ슜???덈궡 (肄섏넄 紐낅졊)**:
  ```js
  // 諛깆뾽 (留덉뒪?????????꾩쟾 蹂듭썝 媛?? ?덉쟾 蹂닿? ?꾩닔)
  AIO.exportApiKeys({masked: false})

  // 留덉뒪??諛깆뾽 (?뺤씤????蹂듭썝 遺덇?)
  AIO.exportApiKeys({masked: true})

  // 蹂듭썝 (?뚯씪 ?댁슜??string?쇰줈 遺숈뿬?ｊ린)
  AIO.importApiKeys(`{...}`)

  // ?먮룞 蹂듭썝 (罹먯떆 ?대━????IndexedDB?먯꽌)
  await AIO.recoverApiKeysFromIdb()
  ```
- **?ъ슜???댁쁺 沅뚯옣**:
  1. API ???낅젰 ??利됱떆 `AIO.exportApiKeys({masked:false})` ?몄텧?섏뿬 諛깆뾽 ?뚯씪 ?덉쟾 蹂닿?
  2. 罹먯떆 ?대━????`AIO.recoverApiKeysFromIdb()` ?먮룞 蹂듭썝 ?쒕룄 ???ㅽ뙣 ??諛깆뾽 import
- **?뚯씪**: `js/aio-core.js` L6469~ 遺洹?7 ?⑥닔 + `_saveApiKey` ?먮룞 IDB mirror hook
- **violated_rule**: ?놁쓬 (?좉퇋 ?⑦꽩 ??R100 ?좉퇋濡?李⑤떒)

---

## P311 쨌 v49.44 쨌 [CRITICAL HOTFIX] aio-data.js `refreshHomeDashboard()` const+var ld hoist 異⑸룎 ???꾩껜 ?뚯씪 parse ?ㅽ뙣

- **?ъ슜??蹂닿퀬**: v49.43 hotfix ?꾩뿉???곗씠??誘몄닔??吏?? Chrome MCP濡??쇱씠釉??ъ씠??肄섏넄 吏꾨떒 寃곌낵 吏꾩쭨 洹쇰낯 ?먯씤 諛쒓껄.
- **肄섏넄 ?먮윭 ?쒗??* (v49.43 ?쇱씠釉? 11:15:03~05):
  ```
  [ERROR] Uncaught SyntaxError: Identifier 'ld' has already been declared
  [ERROR] Uncaught ReferenceError: _tcLoadFromStorage is not defined
  [WARN]  News sentiment integration error: computeNewsSentimentScore is not defined
  [ERROR] Uncaught ReferenceError: refreshHomeDashboard is not defined
  ```
- **異붿쟻**: 紐⑤뱺 ReferenceError ?⑥닔(`_tcLoadFromStorage` / `computeNewsSentimentScore` / `refreshHomeDashboard`)媛 **`js/aio-data.js`** ?덉뿉 ?뺤쓽 ??**aio-data.js ?꾩껜 parse ?ㅽ뙣** 異붿젙.
- **洹쇰낯 ?먯씤** (吏곸젒 read 諛쒓껄):
  ```js
  // aio-data.js L10988~11097 (媛꾨왂??:
  function refreshHomeDashboard() {
    const ld = window._liveData || {};   // ??L10989 (?⑥닔 top const)
    // ... 100 以?...
    try {
      if (window.AIO_ACTION_RULES && window.AIO_ACTION_RULES.getActionPlan) {
        var ld = window._liveData || {}; // ??L11085 (try block ?덉쓽 var)
        // ...
      }
    } catch(actErr) {}
  }
  ```
  - **JavaScript 洹쒖튃**: `var`??**function-scoped + hoisted** ??`var ld` ?좎뼵???대뵒???덈뱺 ?⑥닔 top?쇰줈 ?뚯뼱?щ젮吏?
  - 寃곌낵: hoist??`var ld`媛 L10989 `const ld`? 媛숈? scope?먯꽌 異⑸룎 ??**"Identifier 'ld' has already been declared"** SyntaxError.
  - SyntaxError??**parse-time error** ??aio-data.js ?꾩껜 ?ㅽ뻾 李⑤떒 ??洹??덉쓽 紐⑤뱺 ?⑥닔 ?뺤쓽 ??????cascading ReferenceError.
- **遺?묒슜**:
  - `window.fetchLiveQuotes` 誘몄젙????紐⑤뱺 ?몃? API ?몄텧 李⑤떒 ???곗씠??移대뱶 "?? ?곴뎄 ?쒖떆.
  - `window.refreshHomeDashboard` 誘몄젙????home ?섏씠吏 dashboard 媛깆떊 ?ㅽ뙣.
  - ?ъ슜?먭? "API ???좎븘媛붾떎"怨??몄떇???댁쑀 異붿젙: ?곗씠??誘몄닔??+ 罹먯떆 ?대━???쒕룄 ??localStorage(API ?? ?숈떆 ??젣.
- **v49.42???꾩엯???좎옱 踰꾧렇**: v49.41 P299?먯꽌 DATA_SNAPSHOT.breadth5sma/20sma/50sma/200sma 4 ?쒕뱶 異붽? ?쒖젏 遺洹??묒뾽. ?뺥솗???꾩엯 踰꾩쟾 異붿쟻? ?대졄吏留?v49.42 push ?쒖젏遺???좎옱. v49.43 SW 罹먯떆 ?뚯쟾?쇰줈 ?몄텧.
- **洹쇰낯 ?닿껐** (v49.44 hotfix):
  - `js/aio-data.js` L11085 `var ld = window._liveData || {};` ?쇱씤 ??젣.
  - outer L10989 `const ld` 洹몃?濡??ъ슜 (媛??숈씪 ??`window._liveData || {}`).
  - SW_VERSION v49.43 ??v49.44 媛뺤젣 ?뚯쟾 + R1 7怨??숆린??
  - ?쇱씠釉?寃利?(Chrome MCP):
    - `version: v49.44` ??
    - `fetchLiveQuotes: function` / `refreshHomeDashboard: function` / `_tcLoadFromStorage: function` ??
    - `liveDataKeys: 321` (?몃? API ?뺤긽 ?묐떟) ??
    - `liveSPX.price: 7400.96 (live:yahoo)` / `liveVIX: 18.36` ??
    - 肄섏넄 ?먮윭 0嫄?(?댁쟾 ?섏씠吏 罹먯떆 ?붿〈 ?쒖쇅) ??
- **?щ컻 諛⑹?** (R98 ?좉퇋):
  - `AIO.getVarHoistConflictAudit()` ?좎꽕 ??JS ?뚯씪蹂?媛숈? ?⑥닔 ?덉뿉 `var X` + `const/let X` ?숈떆 ?좎뼵 ?먮룞 ?먯?. fetch + regex ?대━?ㅽ떛 (95% ?뺥솗??.
  - ?ν썑 commit ??+ ?쇱씠釉?紐⑤땲?곕쭅 ???몄텧 沅뚯옣.
- **硫뷀? 援먰썕**:
  1. **agent 蹂닿퀬 verify ?꾩쟻**: v49.40 P294 / v49.41~v49.42 ?⑦꽩(false alarm ?ㅼ닔)???댁뼱 P311? **agent 誘몄쭊??+ Chrome MCP ?쇱씠釉?肄섏넄 罹≪쿂濡쒕쭔 吏꾨떒 媛??*. ?뺤쟻 肄붾뱶 遺꾩꽍? ??寃利??⑥닔 R98 ?놁씠???대젮?좎쓬.
  2. **濡쒖뺄 brace 洹좏삎 寃??遺議?*: v49.40~v49.42 ?쒖젏??`aio-core.js` brace diff 0留??뺤씤. **scope-aware 遺꾩꽍 遺??* ??P311 ?좎옱. R98 ?좉퇋濡?蹂닿컯.
  3. **SyntaxError stack trace???⑥젙**: stack??`aio-core.js:87:29`?쇨퀬 ?쒖떆?먯?留??ㅼ젣 SyntaxError??`aio-data.js`. v8 ?붿쭊??onerror ?몃뱾?ш? logger ?⑥닔 ?꾩튂瑜?stack head濡??쒖떆?섍린 ?뚮Ц. 吏꾩쭨 source??message + `err.stack`???덉뼱????(v49.45?먯꽌 onerror ?몃뱾??蹂닿컯 寃??.
- **violated_rule**: ?놁쓬 (?좉퇋 ?⑦꽩 ??R98 ?좉퇋 ?꾩엯?쇰줈 李⑤떒)
- **?뚯씪**: `js/aio-data.js` L11085 + R1 踰꾩쟾 7怨?+ `js/aio-core.js` R98 ?좉퇋

---

## P310 쨌 v49.43 쨌 [CRITICAL HOTFIX] manifest.json GitHub UI ??젣 ??SW shell cache.add 404 ???곗씠???뚯씠?꾨씪???꾩껜 留덈퉬

- **?ъ슜??蹂닿퀬 (2026-05-18 22:30)**: "吏湲??곗씠???곌껐 ???섎뒗 寃?媛숈??? ?꾧뎔媛??API ??紐⑤몢 ?좊씪媛붾떎?섎뜲?" ???ㅽ겕由곗꺑: 紐⑤뱺 媛寃?移대뱶 "??, "?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲??, "?곗씠???곌껐 吏?????덈줈怨좎묠(R?? ?쒕룄".
- **2李?蹂닿퀬**: "而ㅻ컠/諛고룷 怨쇱젙?먯꽌 臾몄젣 ?앷릿 嫄??꾨땲?? 吏湲??닿? Github?먯꽌 ?쒓컙 硫곗튌 吏???뚯씪?ㅼ? 紐⑤몢 ??젣?덇굅??"
- **洹쇰낯 ?먯씤** (吏곸젒 議곗궗濡?諛쒓껄):
  1. ?ъ슜?먭? GitHub UI?먯꽌 v49.42 push 吏곹썑 23 ?뚯씪???쇨큵 ??젣 (而ㅻ컠 9628942 ??吏곸쟾 5 而ㅻ컠):
     - **`manifest.json`** (29af1f3) ??**?듭떖 ?먯씤**
     - 猷⑦듃 紐⑤?由ъ떇 諛깆뾽 JS 6媛?(aio-chat/core/data/glossary/tests/ui.js ?????댁긽 ?ъ슜 ????
     - 猷⑦듃 wiki .md 12媛?(_context/???숈씪 ?뚯씪 議댁옱)
     - `.gitignore`, `api_setup_guide.html`, `cloudflare-worker-proxy.js`, `local-v48.81-home-qa.png`
  2. **`sw.js` SHELL_ASSETS L18??`'./manifest.json'` ?붿〈** ??SW install ??`cache.add('./manifest.json')` ?몄텧 ??404
     - ?ㅽ뻾??`Promise.allSettled`濡?泥섎━?섏뼱 SW install ?먯껜 ?ㅽ뙣???뚰뵾
     - 洹몃윭??肄섏넄??manifest.json 404 + Service Worker install 遺遺??ㅽ뙣 ?먮윭 諛쒖깮
  3. **`index.html` L22 `<link rel="manifest" href="./manifest.json">` ?붿〈** ??紐⑤뱺 ?섏씠吏 濡쒕뱶 ??404 肄섏넄 ?먮윭
  4. 罹먯떆???댁쟾 SW媛 ?좉퇋 v49.42 ?쒖꽦????`caches.delete(k)` ?몄텧 ???댁쟾 ?곗씠??罹먯떆 ??젣 + ??罹먯떆 梨꾩슦湲?以?manifest 404濡??쇰? ?대씪?댁뼵???쇱떆 stale.
- **"API ???좎븘媛? 硫붿빱?덉쬁** (異붿젙):
  - 肄붾뱶??API ??`aio_finnhub_key` ?? 吏곸젒 ??젣 ?몄텧 0嫄????먮룞 ??젣 ?꾨떂
  - **媛???쒕굹由ъ삤**: ?쇰? ?ъ슜?먭? 肄섏넄??manifest.json 404 + ?곗씠??誘몄닔??蹂닿퀬 "罹먯떆 ?대━?? ?쒕룄 ??釉뚮씪?곗? ?곗씠???쇨큵 ??젣 ??localStorage(API ???ы븿) ??젣 + IndexedDB(_aioApiKeys ??μ냼) ??젣
  - ?먮뒗 ?쒗겕由?紐⑤뱶/?ㅻⅨ 釉뚮씪?곗? ?ъ슜
- **洹쇰낯 ?닿껐** (v49.43 hotfix):
  1. `index.html` L22 `<link rel="manifest">` 二쇱꽍 泥섎━ (PWA 鍮꾪솢?????ъ슜???섎룄 諛섏쁺)
  2. `sw.js` SHELL_ASSETS?먯꽌 `'./manifest.json'` ?쇱씤 ?쒓굅 + hotfix 肄붾찘??紐낆떆
  3. `SW_VERSION` v49.42 ??**v49.43 媛뺤젣 ?뚯쟾** ??紐⑤뱺 ?대씪?댁뼵?멸? ?좉퇋 罹먯떆 鍮뚮뱶 + ?댁쟾 v49.42 罹먯떆 (manifest ?쒕룄 ?ы븿) ?먭린
  4. APP_VERSION + R1 7怨??숆린??v49.43
- **?щ컻 諛⑹?**:
  - **R98 ?좉퇋 (寃??**: `sw.js` SHELL_ASSETS??紐⑤뱺 ?먯궛???ㅼ젣 ?뚯씪濡?議댁옱?섎뒗吏 鍮뚮뱶 ???먮룞 寃利?(?꾩옱 ?놁쓬). ?좉퇋 鍮뚮뱶 step or pre-push hook.
  - **R99 ?좉퇋 (寃??**: GitHub UI 吏곸젒 ?뚯씪 ??젣 ???ъ슜?먭? ?섎룄 紐낆떆 ??`_context/WORKTREE-AUDIT.md`??"??젣???먯궛 ?곹뼢 留ㅽ듃由?뒪" ?섎Т 異붽?.
  - **?④린 寃利?紐낅졊**:
    ```js
    // 肄섏넄???낅젰
    fetch('./manifest.json').then(r => console.log('manifest', r.status));  // 200 ?댁뼱???? 404硫?sw.js/index.html 異붽? ?뺣━ ?꾩슂
    navigator.serviceWorker.getRegistration().then(r => console.log('SW state', r && r.active && r.active.state));  // 'activated'
    ```
- **?뚯씪**: `sw.js` L15~28 + `index.html` L21~22 + 踰꾩쟾 R1 7怨?
- **violated_rule**: ?놁쓬 (?몃? 蹂寃쎌뿉 ?섑븳 cascading ?곹뼢)
- **?ъ슜?먯뿉寃??덈궡**:
  1. **Ctrl+Shift+R** 媛뺣젰 ?덈줈怨좎묠 ???좉퇋 SW v49.43 ?쒖꽦??+ ?댁쟾 罹먯떆 ?먭린
  2. 肄섏넄(F12)??`AIO.forceRefreshAllData()` ?낅젰 ??紐⑤뱺 ?몃? API ??fetch
  3. API ??(`aio_finnhub_key` ?? localStorage ?뺤씤:
     ```js
     ['aio_finnhub_key','aio_fmp_key','aio_av_key','aio_fred_key','aio_claude_api_key']
       .map(k => ({key:k, has: !!localStorage.getItem(k)}))
     ```
  4. ?ㅺ? 紐⑤몢 鍮?寃쎌슦 ?ъ씠?쒕컮 ?숋툘 ?ㅼ젙?먯꽌 ?ъ엯??

---

## P309 쨌 v49.42 쨌 [硫뷀? ?⑦꽩] agent verify ?⑦꽩 ??false alarm 10嫄?/ 吏꾩쭨 4嫄?(v49.40 P294 / v49.41 ?⑦꽩 諛섎났)

- **?⑦꽩 ?꾩쟻**: v49.40 (P294 home 1 吏꾩쭨 / agent false ?ㅼ닔) ??v49.41 (signal+breadth 7 吏꾩쭨 / 9 false) ??v49.42 (4 吏꾩쭨 / 10 false). agent 蹂닿퀬??"誘멸뎄??/"誘몄뿰寃? ?대젅?꾩? **寃???꾨씫???ㅼ닔**.
- **洹쇰낯**: ?⑥씪 ?뚯씪 grep?쇰줈 ?앸궡吏 留먭퀬 4 JS ?뚯씪(`aio-core.js` / `aio-data.js` / `aio-ui.js` / `aio-chat.js`) + `index.html` 紐⑤몢 寃???꾩닔.
- **v49.42 false alarm 10嫄??덉떆** (verifiedIn 留덉빱濡?李⑤떒):
  - `_aioRenderSentimentConclusion` 誘멸뎄????`_renderConclusionBar` 踰붿슜 ?⑥닔 ?ъ슜
  - `sent-overall-badge` 誘몃젋????aio-ui.js L1912
  - `briefing-action` ACTION_RULES 誘멸뎄????aio-core.js L1485~1499 _aioPageBus hook
  - THRESHOLD_REGISTRY 誘멸뎄????aio-core.js???뺤쓽 (R56 9 ??
  - retail-sales/wage-growth/cons-conf/housing ?뺤쟻 ??aio-data.js L2284~2488 FRED ?숈쟻 媛깆떊
  - ??
- **?щ컻 諛⑹?**: PAGE_SEQUENTIAL_AUDIT_REGISTRY.pages.*.findings[]??`verifiedIn` 留덉빱 ?꾩쟻. ?ㅼ쓬 ?먭? ??false alarm ?щ컻寃?諛⑹?.

---

## P308 쨌 v49.42 쨌 [minor] macro "Late Cycle" JS L25002 ?숈쟻 ?⑥닔 ?쇰꺼

- **?꾩튂**: `index.html` L25002 `cyclePhase = '寃쎄린 ?꾨컲(Late Cycle)'` + L25092 pill `' Late Cycle 쨌 諛⑹뼱 二쇰룄'`
- **遺꾩꽍**: v49.31 H5?먯꽌 themes ?섏씠吏 ?몃씪???뺤쟻 ?쇰꺼 "? ?꾩옱(Late Cycle)" ??"Late (李멸퀬)" ?쇰컲?? 洹몃윭??JS ?숈쟻 ?⑥닔(`getCycleFromMacro` 寃곌낵 諛섏쁺)?먮뒗 洹몃?濡??붿〈. JS ?⑥닔??themes/macro ?섏씠吏?먯꽌 ?ъ슜?섎뒗 **?숈쟻 ?쇰꺼** (?ㅼ떆媛?遺꾩꽍 寃곌낵) ???쇰컲??????꾨떂 (themes ?몃씪???뺤쟻怨?蹂꾧컻 ?섎룄).
- **寃곕줎**: verify-only. ?섎룄???숈쟻 ?쇰꺼?닿퀬 themes ?몃씪???뺤쟻 ?쇰꺼怨쇰뒗 蹂꾧컻.
- **finding**: `macro.findings` minor entry (deferred ?먮뒗 verifiedIn).

---

## P307 쨌 v49.42 쨌 [minor] macro Phase 5 (2024) "?곗갑瑜? ?쇰꺼 ??v49.43 ?꾩냽

- **?꾩튂**: macro ?섏씠吏 ?ъ씠????꾨씪??(L6979~7050)
- **利앹긽**: Phase 5 (2024) "?곗갑瑜? + S&P 5800/Fed 3.5%/VIX 15 hardcoded ??2024??留??ㅻ깄?룹씠??2026-05 ?쒖젏?먯꽌 怨쇨굅. Phase 6? ?숈쟻 (data-snap="spx"/"fed-rate"/"vix").
- **寃곕줎**: ?섎룄????궗 ?쒖젏 ?쇰꺼 (?ъ씠??鍮꾧탳??. ?ㅻ쭔 Phase 6 ?뺤쓽 紐낇솗???꾩슂 (?꾩옱 ?대뵒 ?④퀎?몄?) ??**v49.43 ?꾩냽**.
- **finding**: `macro.findings` minor entry with `deferredTo: 'v49.43'`.

---

## P306 쨌 v49.42 쨌 [R94 蹂닿컯] technical RSI 移대뱶 data-threshold-key 留덉빱 遺??

- **?꾩튂**: `index.html` L6512 RSI(14) 移대뱶
- **利앹긽**: title ?띿뒪?몃줈 `"RSI ?꾧퀎媛?(v49.28/R56 THRESHOLD_REGISTRY.RSI): <30 怨쇰ℓ??쨌 30~40 ?쎌꽭 쨌 40~60 以묐┰ 쨌 60~70 媛뺤꽭 쨌 70~80 怨쇰ℓ??쨌 80+ 洹밸떒 怨쇰ℓ??` ?몃씪???뺤쟻. THRESHOLD_REGISTRY??aio-core.js??議댁옱?섎굹 移대뱶??`data-threshold-key="RSI"` 留덉빱媛 ?놁뼱 v49.38 R94 `getInlineThresholdTableAudit`媛 ?뺥빀 寃利?紐???
- **洹쇰낯 ?닿껐** (v49.42 C): 移대뱶 `<div>`??`data-threshold-key="RSI"` 留덉빱 遺李? ?ν썑 R94 audit ?먮뒗 ?좉퇋 R98(inline title) audit???먮룞 ?뺥빀 寃利?媛??
- **?щ컻 諛⑹?**: R94 蹂닿컯 ???섏씠吏 ?몃씪???꾧퀎媛?移대뱶??諛섎뱶??`data-threshold-key` 留덉빱 遺李??섎Т.
- **?뚯씪**: `index.html` L6512
- **violated_rule**: R94 (蹂닿컯)

---

## P305 쨌 v49.42 쨌 [verify-only] briefing-action ACTION_RULES hook ?꾩쟾 援ы쁽

- **寃利?寃곌낵**: agent 蹂닿퀬 "briefing-action-position/sentiment ACTION_RULES 援ы쁽 誘몃컻寃? ?대젅??**false alarm**.
- ?ㅼ젣 ?꾩튂: `js/aio-core.js` L1485~1499 `_aioPageBus.register('core-briefing-action', 'aio:pageShown', ...)` hook ?꾩쟾 援ы쁽 ??`AIO_ACTION_RULES.getActionPlan({vix, fg})` ?몄텧 ??`posEl.textContent = '?뮳 ' + plan.position.sizePct + '% ?ъ?????' + plan.position.note` + `sentEl.textContent = '?쭬 ' + plan.sentiment.action + ' ??' + plan.sentiment.note` ?숈쟻 媛깆떊.
- **finding**: `briefing.findings` verify-only entry with `verifiedIn: 'v49.42 P305'`.

---

## P304 쨌 v49.42 쨌 [?뺥솗?? briefing Jensen ?명꽣酉??뺤쟻 "58??寃쎄낵 (60???꾨컯)" ?띿뒪??

- **?꾩튂**: `index.html` L6060
- **利앹긽**: v49.30 P253?먯꽌 ?묒꽦???뺤쟻 ?띿뒪??"?벀 ARCHIVE 쨌 58??寃쎄낵 (60???꾨컯)" ??留ㅼ씪 1?쇱뵫 stale. ?숈쟻 `#jensen-interview-stale-days` span (STATIC_CONTENT_LIFECYCLE.jensen-interview-202603?먯꽌 媛깆떊)??蹂꾨룄濡?議댁옱 ?????쒖떆媛 以묐났 + ?뺤쟻 遺遺꾩씠 stale.
- **洹쇰낯 ?닿껐** (v49.42 B): ?뺤쟻 "58??寃쎄낵 (60???꾨컯)" ?띿뒪???쒓굅. `#jensen-interview-stale-days` ?숈쟻 span ?⑤룆 ?쒖떆 (諛곗? ?띿뒪???щ같移?.
- **?뚯씪**: `index.html` L6060

---

## P303 쨌 v49.42 쨌 [verify-only] sentiment ?섏씠吏 ?명봽???꾩꽦???곗닔

- **寃利?寃곌낵**: agent 蹂닿퀬 CRITICAL 5嫄?(`_aioRenderSentimentConclusion` / `sent-overall-badge` / `sent-analysis-text` / `fg-needle` / `pc-needle-pos` 誘멸뎄?? 紐⑤몢 **false alarm**.
- ?ㅼ젣 ?꾩튂:
  - sentiment-conclusion-bar: index.html L22898 `_renderConclusionBar()` 踰붿슜 ?⑥닔 ?몄텧
  - sent-overall-badge: aio-ui.js L1912 getElementById 媛깆떊
  - sent-analysis-text: index.html L21059 媛깆떊
  - fg-needle: aio-data.js L11215 SVG ?숈쟻 媛깆떊
  - pc-needle-pos: aio-data.js L11507 媛깆떊
- **finding**: `sentiment.findings` 5 verify-only entries.

---

## P302 쨌 v49.42 쨌 [R76 蹂닿컯] briefing 5? 愿??"?몃Ⅴ臾댁쫰/?留??댄삊" ?뺤튂/吏紐??좏겙

- **?꾩튂**: `index.html` L5931 (briefing-top-5-list ??
- **利앹긽**: "吏?뺥븰 ???몃Ⅴ臾댁쫰/?留??댄삊 紐⑤땲?곕쭅" ?⑤룆 吏紐??좏겙. v49.30 R76 NAMED_ENTITY ?쇰컲???뺤콉?먯꽌 sentiment ?섏씠吏???뺣━?먯쑝??briefing ?섏씠吏 5? 愿????ぉ? ?꾨씫.
- **洹쇰낯 ?닿껐** (v49.42 A): "二쇱슂 ?댁긽 臾쇰쪟 寃쎈줈(?몃Ⅴ臾댁쫰/?留??댄삊 ?? 紐⑤땲?곕쭅"?쇰줈 ?쇰컲?? 而⑦뀓?ㅽ듃(?댁긽 臾쇰쪟 + 吏?뺥븰 紐⑤땲?곕쭅) ?좎??섎㈃???뺤튂 ?좏겙???덉떆濡?寃⑺븯.
- **?щ컻 諛⑹?**: R76 蹂닿컯 ??吏?뺥븰 紐⑤땲?곕쭅 ?띿뒪?몃뒗 ?쇰컲 移댄뀒怨좊━ + ?덉떆 ?뺤떇?쇰줈 ?묒꽦.
- **?뚯씪**: `index.html` L5931
- **violated_rule**: R76 (蹂닿컯)

---

## P301 쨌 v49.41 쨌 [R97 ?좉퇋] data-snap key vs DATA_SNAPSHOT ?쒕뱶 ?뺥빀 ?먮룞 ?먯? 遺??

- **硫뷀? ?⑦꽩**: `S.breadth5sma || 68` 媛숈? ?몃씪???대갚 ?⑦꽩??DATA_SNAPSHOT ?쒕뱶???깅줉 ???쇰룄 ?뺤긽 ?숈옉?섎뒗 寃껋쿂??蹂댁엫. v49.30 R74 `assertSnapshotInlineMatch`???쒕뱶媛 議댁옱????DOM ?몃씪?멸낵 鍮꾧탳留??????쒕뱶 ?먯껜媛 ?놁쑝硫?silent pass.
- **洹쇰낯 ?닿껐**: `AIO.getStaticSeedFallbackAudit()` ?좎꽕 ???섏씠吏 DOM??紐⑤뱺 `[data-snap="key"]` ?섏쭛 + DATA_SNAPSHOT 理쒖긽??`_fallback`??????꾨뱶 議댁옱 寃利? kebab?뭖amel/snake 蹂??留ㅽ븨 洹쒖튃 ?ы븿.
- **?좉퇋 洹쒖튃**: R97 (data-snap ?ㅻ뒗 DATA_SNAPSHOT 理쒖긽??+ _fallback ?묒そ ?쒕뱶 ?깅줉 ?섎Т)
- **?뚯씪**: `js/aio-core.js` (R97 audit + getAutoOpsReadiness 26異??듯빀)

---

## P300 쨌 v49.41 쨌 [?뺥빀?? breadth McClellan Summation vs Oscillator ?뺤쓽 ?쇳빀

- **?꾩튂**: `index.html` L5471~5483 ??移대뱶 ?쇰꺼 "McClellan ?⑤찓?댁뀡" (Summation Index)
- **利앹긽**: ?쇰꺼? "Summation"(?κ린 ?꾩쟻???몃뜲 ?ㅻ챸 "0 ??留ㅼ닔 ?먮꼫吏, 0 ?꾨옒=?섎씫 ?먮꼫吏" ?쒗쁽? Oscillator(?④린 짹100) semantic怨??쇰룞?섍린 ?ъ?. ?ㅼ씠踰꾩쟾???뺤쓽??紐낆떆 遺??
- **洹쇰낯 ?닿껐** (v49.41 B2):
  - ?쇰꺼??"McClellan Summation Index (?κ린)"濡?紐낇솗??
  - ?ㅻ챸??"Oscillator ?꾩쟻????異붿꽭 諛⑺뼢. Oscillator???④린 짹100"?쇰줈 援щ텇 ?쒓린
  - 踰좎뼱 ?ㅼ씠踰꾩쟾???뺤쓽 紐낆떆: "SPX ?좉퀬媛?먮룄 Summation ?좉퀬媛 誘몃컻??(?꾩옱 ?섏떖)"
  - 移대뱶??`data-mcclellan-signal="bearish"` 留덉빱 遺李?(diagnoseBreadthConsensus ?낅젰 異붿쟻??
- **?뚯씪**: `index.html` L5471~5484

---

## P299 쨌 v49.41 쨌 [R74 蹂닿컯] DATA_SNAPSHOT breadth*sma ?쒕뱶 遺?????대갚留??숈옉

- **利앹긽**: `js/aio-core.js` L9567~9570 ?뚮뜑??`'breadth-5sma': _snap.fixed(S.breadth5sma || S.breadth_5sma || ((S._fallback||{}).breadth5) || 68, 0) + '%'` ??`DATA_SNAPSHOT.breadth5sma`媛 理쒖긽??誘몄젙?? `_fallback.breadth5` (?ㅻⅨ ?ㅻ챸) + ?몃씪???대갚 `|| 68`留??섏〈.
- **寃곌낵**: ?ㅼ떆媛?fetch 寃쎈줈?먯꽌 `DATA_SNAPSHOT.breadth5sma = X`濡?set?대룄 R74 `assertSnapshotInlineMatch`媛 ?몃씪??vs ?쒕뱶 ?뺥빀 紐??≪쓬 (?쒕뱶 ?먯껜媛 ?놁쑝誘濡?. ?뺤쟻 ?대갚媛?68/75/46/55媛 ?곸썝???쒖떆.
- **洹쇰낯 ?닿껐** (v49.41 B1):
  - DATA_SNAPSHOT??紐낆떆???쒕뱶 4媛?異붽?: `breadth5sma: 68`, `breadth20sma: 75`, `breadth50sma: 46`, `breadth200sma: 55`
- **?щ컻 諛⑹?**: P301 R97 ?좉퇋 (`getStaticSeedFallbackAudit`) ???먮룞 ?먯?濡??곴뎄 李⑤떒
- **?뚯씪**: `js/aio-core.js` DATA_SNAPSHOT
- **violated_rule**: R74

---

## P298 쨌 v49.41 쨌 [?뺥솗?? "釉뚮젅?쒖뒪 ?곕윭?ㅽ듃" ?곷Ц 蹂묎린 遺??

- **?꾩튂**: `index.html` L5185 + L22485
- **利앹긽**: "釉뚮젅?쒖뒪 ?곕윭?ㅽ듃" ?⑤룆 ?쒓린. ?쒖? ?곷Ц "Breadth Thrust" (Marty Zweig 1986 留ㅼ닔 ?좏샇) 蹂묎린 遺?????ъ슜?먭? 寃??? ?먮즺 ?議??대젮?.
- **洹쇰낯 ?닿껐** (v49.41 A4): "釉뚮젅?쒖벐 ?ㅻ윭?ㅽ듃 (Breadth Thrust)" ?곷Ц 蹂묎린.
- **?뚯씪**: `index.html` L5185 (breadth-process step 4 ?쇰꺼) + L22485 (JS stageLabel)

---

## P297 쨌 v49.41 쨌 [濡쒖쭅?? verify-only] signal Exit Triggers updateExitTriggers ?몄텧 蹂댁옣

- **寃利?寃곌낵** (v49.41 A3): `updateExitTriggers()` (index.html L22547)????怨녹뿉???몄텧:
  - L22675 ??`refreshSignal()` 珥덇린 ?몄텧 (signal ?섏씠吏 吏꾩엯 ??
  - L22927 ??`aio:liveQuotes` ?대깽???몃뱾??(signal ?섏씠吏 ?쒖꽦 ??
- **寃곕줎**: ?몄텧 蹂댁옣 OK. SPX 횞 0.9, DXY 횞 1.05, HYG 횞 0.95 ?숈쟻 怨꾩궛???섏씠吏 吏꾩엯 + ?쇱씠釉??쒖꽭 媛깆떊 ?쒕쭏???ㅽ뻾. agent 蹂닿퀬 "?뺤쟻 誘몃젋?붾쭅" ?대젅??**false alarm**.
- **finding ?꾩쟻**: `verifiedIn: 'v49.41 A3/P297'` 留덊궧留? ?쒖젙 ?놁쓬.

---

## P296 쨌 v49.41 쨌 [R77 蹂닿컯] signal CP2 fed-rate / fomc lastUpdated 硫뷀? ?쒖떆 遺??

- **?꾩튂**: `index.html` L4910 CP2 (?듯솕?뺤콉) cell
- **利앹긽**: `<span data-snap="fed-rate">3.50-3.75</span>% 쨌 ?ㅼ쓬 FOMC <span data-snap="fomc">6/16-17</span>` ??媛믪? DATA_SNAPSHOT.fedRate / fomc ?쒕뱶(L8703~8706)?먯꽌 二쇱엯?섎굹 **lastUpdated 硫뷀? 遺??*. R77 MACRO_CALENDAR??fed-rate/fomc 誘몃벑濡????ㅼ쓬 FOMC ?쇱젙 吏?щ뒗吏 ?먮룞 ?먯? ????
- **洹쇰낯 ?닿껐** (v49.41 A2):
  - `AIO_MACRO_CALENDAR.releases`??`us-fomc` + `us-fed-rate` 2 entries 異붽? (lastRelease 2026-04-29 / nextRelease 2026-06-17)
  - `#cp2-fed-rate-meta` snap-meta span ?좎꽕 + signal pageShown hook?먯꽌 nextRelease ?鍮?D-day ?쒖떆 + 吏?섎㈃ amber 寃쎄퀬
- **?뚯씪**: `js/aio-core.js` (MACRO_CALENDAR + _aioPageBus signal hook) + `index.html` L4910 (cp2 meta span)
- **violated_rule**: R77 (蹂닿컯)

---

## P295 쨌 v49.41 쨌 [R73 ?꾨컲] signal-macro-scenario ?뺤쟻 ?뺣쪧 vs SCENARIO_REGISTRY 誘몄뿰??

- **?꾩튂**: `index.html` L5195~5224 signal ?섏씠吏 3 移대뱶 ?쒕굹由ъ삤 洹몃━??
- **利앹긽**: 移대뱶 ?ㅻ뜑 "?숆? (30~35%) ???몃Ⅴ臾댁쫰 ?ш컻" / "湲곕낯 (40~45%) ???꾩긽 ?좎?" / "鍮꾧? (15~20%) ???ъ슦???쇨꺽" ???뺣쪧 踰붿쐞 ?뺤쟻 ?몃씪?? v49.27/R72 `AIO_SCENARIO_REGISTRY` ?명봽??異붽? ??`scenarios` 媛앹껜(?곗갑瑜??ㅽ깭洹?移⑥껜)??留뚮뱾?덉쑝??signal ?섏씠吏 ?④린 ?쒕굹由ъ삤(?숆?/湲곕낯/鍮꾧?)??蹂꾨룄 categorize ???? R73(?명봽??異붽? ??媛숈? 踰꾩쟾?먯꽌 ?섏씠吏 ?곸슜 ?숇컲) ?꾨컲 ??macro ?섏씠吏(L1564)?먮뒗 hook ?덉?留?signal ?섏씠吏???꾨씫.
- **異붽? stale**: "?몃Ⅴ臾댁쫰 ?ш컻" / "?ъ슦???쇨꺽" ?붿〈 ?뺤튂/吏紐??좏겙 (v49.30 ?쇰컲?붿뿉???꾨씫). "?몃Ⅴ臾댁쫰 ?ш컻" ???쇰컲??/ "?ъ슦???쇨꺽" ??"怨듦툒 異⑷꺽 ?쒕굹由ъ삤"濡?蹂寃?
- **洹쇰낯 ?닿껐** (v49.41 A1):
  - `AIO_SCENARIO_REGISTRY.signalShortTerm` ?좎꽕 ??`{optimistic, base, pessimistic}` 3 entries with probability/probabilityRange/lastUpdated/source/triggers
  - `validateSignalSum()` 硫붿꽌??異붽?
  - `_aioPageBus.register('core-signal-scenario', 'aio:pageShown', ...)` hook ?좎꽕 ??signal ?섏씠吏 吏꾩엯 ??`data-scenario-key` 留덉빱 3 移대뱶??header瑜?REGISTRY 媛믪쑝濡?媛깆떊 + `#scenario-outlook-ts` lastUpdated ?쒖떆
  - index.html 3 移대뱶??`data-scenario-key="optimistic|base|pessimistic"` 留덉빱 + `.scenario-header` class 遺李?
- **?щ컻 諛⑹?**: R73 媛뺥솕 (?명봽??+ ?섏씠吏 ?곸슜 ?숈떆 ?섎Т) ??v49.42?먯꽌 audit ?⑥닔 ?좎꽕 寃??
- **?뚯씪**: `js/aio-core.js` (SCENARIO_REGISTRY ?뺤옣 + signal pageShown hook) + `index.html` L5195~5224
- **violated_rule**: R73

---

## P294 쨌 v49.40 쨌 [R96 ?꾨컲] _aioRefreshActionPlan ?몃뱾??誘몄젙????silent no-op + R96 audit false-positive

- **利앹긽**: index.html L4063 home Action Item 移대뱶????媛깆떊 踰꾪듉 (`<button data-action="_aioRefreshActionPlan">`) ?대┃ ???꾨Т ?숈옉 ?놁쓬. event delegation ?붿뒪?⑥쿂(aio-core.js L680) `window[action]` lookup ?ㅽ뙣 ??`_aioLog('warn','delegate','missing: _aioRefreshActionPlan')` 留?濡쒓퉭?섍퀬 silent no-op.
- **?꾨컲 洹쒖튃**: R96 (v49.39 ?좉퇋 ??紐⑤뱺 data-action ?몃뱾???깅줉 寃利??섎Т)
- **洹쇰낯 ?먯씤**: v49.39 R96 audit ?⑥닔 `getDataActionHandlerAudit()`??`knownAliases` 諛곗뿴??`_aioRefreshActionPlan`???ы븿?섏뼱 ?덉뼱 false-positive ?듦낵. knownAliases??event-delegate ?⑦꽩?쇰줈 ?깅줉?섎뒗 鍮?`_aio` ?묐몢 湲濡쒕쾶 ?⑥닔(showPage/toggleLLM ??留뚯쓣 ?꾪븳 ?덉쟾留앹씤?? `_aio` ?묐몢 ?⑥닔媛 ?ㅼ뼱媛硫댁꽌 "alias?대?濡??깅줉?섏뼱 ?덈떎" ?쇨퀬 ?섎せ ?먮떒??
- **硫뷀? ?먯씤**: v49.39?먯꽌 audit ?⑥닔留??뺤쓽?섍퀬 home ?섏씠吏???ㅼ젣濡??ㅽ뻾??寃곌낵瑜??뺤씤?섏? ?딆쓬. R93 sequential audit (?섏씠吏 ?꾟넂?꾨옒 ?명꽣?숈뀡 ?먭?)??1李?2李⑥뿉??硫덉텛怨?3李??명꽣?숈뀡 + ?섏씠吏 媛??뺥빀 + ?쇱씠釉??곗씠??sink) ???ㅽ뻾 ?꾨씫.
- **?ъ슜??吏??*: "洹쇰뜲 Home 3李⑤? 鍮⑤━ ?먭??덈뜕???꾨꼍????嫄곗??" (2026-05-18) ??v49.39 ?묒뾽???명봽?쇰쭔 異붽??섍퀬 ??寃利?誘몄닔?됱엫???뺥솗???앸퀎.
- **洹쇰낯 ?닿껐** (v49.40):
  1. `window._aioRefreshActionPlan` ?좎꽕 ??`AIO_ACTION_RULES.getActionPlan` ?ш퀎??+ home-action-position/sentiment/breadth 3 sink ?숆린 媛깆떊 + `data-refreshed-at` ??꾩뒪?ы봽 (aio-core.js L851 遺洹?.
  2. R96 `knownAliases`?먯꽌 `_aioRefreshActionPlan` ?쒓굅. ?댁젣 `has_aio` 寃??`act.indexOf('_aio') === 0 && typeof window[act] === 'function'`)濡??듦낵.
- **?щ컻 諛⑹?**:
  - R96 蹂닿컯: `knownAliases`??鍮?`_aio` 湲濡쒕쾶 ?⑥닔留??덉슜. `_aio` ?묐몢??諛섎뱶?????깅줉 寃利?
  - R93 蹂닿컯: ?섏씠吏 sequential audit? ?명봽???뺤쓽 + ???ㅽ뻾 + finding ?쒖젙源뚯? ???명듃 (1李?enumerate 쨌 2李?sub-section 源딆씠 쨌 **3李??명꽣?숈뀡/cross-page/sink ???ㅽ뻾**).
  - ?뚭? ?뚯뒪?? T321 `typeof window._aioRefreshActionPlan === 'function'`.
- **?뚯씪**: `js/aio-core.js` (window._aioRefreshActionPlan ?좎꽕 + knownAliases ?섏젙 + PAGE_SEQUENTIAL_AUDIT_REGISTRY.pages.home.findings ?꾩쟻)
- **violated_rule**: R96

---

## P290 쨌 v49.39 쨌 [R95 ?좉퇋] ?섏씠吏 媛??숈씪 ticker ?먮룞 ?뺥빀 遺??

- **利앹긽 (?좎옱??**: v49.24 `getSnapshotConsistencyAudit`??`data-snap` 湲곕컲. ?쇱씠釉?媛寃?sink (`data-live-price="^GSPC"` ????蹂꾨룄 audit ?놁쓬. home??SPX vs technical??SPX vs macro??SPX ?띿뒪??遺덉씪移?媛?μ꽦.
- **洹쇰낯 ?닿껐**: `AIO.getCrossPageIndicatorConsistencyAudit()` ?좎꽕 ??`[data-live-price]` ticker蹂?洹몃９????distinct ?띿뒪???? ??mismatch 蹂닿퀬. placeholder(`??/loading) ?쒖쇅.
- **?좉퇋 洹쒖튃**: R95
- **?뚯씪**: `js/aio-core.js`

---

## P291 쨌 v49.39 쨌 [R96 ?좉퇋] data-action 誘몄젙???몃뱾???먮룞 ?먯? 遺??

- **利앹긽 (?좎옱??**: `[data-action="NAME"]` ?붿냼媛 誘몄젙???몃뱾???몄텧 ??click 臾대룞?? ?좉퇋 ?몃뱾??異붽? ???뺤쓽 ?꾨씫 媛??
- **洹쇰낯 ?닿껐**: `AIO.getDataActionHandlerAudit()` ?좎꽕 ??紐⑤뱺 `data-action` 異붿텧 + `window[NAME]` / `AIO[NAME]` / known alias (showPage/toggleLLM/...) 寃?? 誘몃벑濡??몃뱾??蹂닿퀬.
- **?좉퇋 洹쒖튃**: R96
- **?뚯씪**: `js/aio-core.js`

---

## P292 쨌 v49.39 쨌 [R93 蹂닿컯] signal ?섏씠吏 1李?enumerate ?꾨즺 (14 subSection)

- **subSections 14媛??깅줉** (?꾟넂?꾨옒):
  1. signal-purpose-header (?섏씠吏 紐⑹쟻)
  2. signal-insight-box (75+/60-75/...)
  3. signal-lockout-control (Lockout Rally)
  4. signal-explain-page (?ъ링 ?댁꽕)
  5. signal-20pt-scoring (20???ㅼ퐫?대쭅)
  6. signal-2pct-rule (2% 猷?
  7. signal-atr-stop (ATR_PRESETS)
  8. signal-entry-exit (吏꾩엯/泥?궛)
  9. signal-trading-setups (12 ?뗭뾽)
  10. signal-pyramiding (?쇰씪誘몃뵫)
  11. signal-spx-tech-dash (SPX 湲곗닠 吏??
  12. signal-breadth-consensus (?ㅼ쨷 ?좏샇 ?⑹쓽)
  13. signal-macro-scenario (?쒕굹由ъ삤 ?몃━)
  14. signal-exit-triggers (Exit Triggers)
- **auditStatus**: 'partial' (1李⑤쭔, 2李???v49.40)
- **?뚯씪**: `js/aio-core.js` AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY.pages.signal

---

## P293 쨌 v49.39 쨌 [R93 蹂닿컯] breadth ?섏씠吏 1李?enumerate ?꾨즺 (12 subSection)

- **subSections 12媛??깅줉** (?꾟넂?꾨옒):
  1. breadth-insight-box (?쒖옣 ???뺤쓽)
  2. breadth-explain-page (?ъ링 ?댁꽕)
  3. breadth-definition (5 吏???뺤쓽)
  4. breadth-narrow-vs-broad (Narrow vs Broad)
  5. breadth-sma-cards (5/20/50/200SMA 4 移대뱶)
  6. breadth-consensus-readout (v49.29 diagnoseBreadthConsensus)
  7. breadth-static-diagnose (?뺤쟻 吏꾨떒)
  8. breadth-mcclellan (McClellan)
  9. breadth-weinstein (Weinstein Stage)
  10. breadth-nhnl (?좉퀬媛/?좎?媛)
  11. breadth-ad-line (A/D Line)
  12. breadth-divergence (?ㅼ씠踰꾩쟾??寃쎈낫)
- **auditStatus**: 'partial' (1李⑤쭔, 2李???v49.40)
- **?뚯씪**: `js/aio-core.js` AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY.pages.breadth

---

## P433 쨌 v49.81 쨌 index.html ?ㅼ닔 ?꾩튂 escHtml() ?꾨씫 (XSS ?쒕㈃)

- **利앹긽**: portfolio alloc ??/ openChatHistory ctxLabel쨌ctxBadge쨌q쨌a / renderKrIssues title/desc/meta / analyzeKrIndex쨌analyzeKrTickerDeep label/stageData/trendData/entryData/crossData/divData/dipData/verdict/ticker / updateAIPanelContext aiChip / chatSendUnified extractChips ???ㅼ닔 ?꾩튂?먯꽌 ?ъ슜???낅젰 ?먮뒗 ?몃? ?곗씠?곕? escHtml() ?놁씠 innerHTML ?쎌엯.
- **?먯씤**: ?묒꽦 ?쒖젏???곗씠??異쒖쿂瑜??좊ː?덉쑝?? ?ъ슜?먭? ticker 吏곸젒 ?낅젰 / ?쒓뎅 ?댁뒪 RSS ?몃? ?띿뒪??/ KR 醫낅ぉ 遺꾩꽍 ?쇰꺼 ???좎옱??XSS 踰≫꽣 議댁옱.
- **?섏젙**: VsCode ?묒뾽蹂몄뿉??紐⑤뱺 ?좎옱 ?꾩튂??`escHtml()` ?섑븨 異붽?. 10+ ?꾩튂 ?쇨큵.
- **?뚯씪**: `index.html` (?ㅼ닔)
- **violated_rule**: R29(innerHTML 吏곸젒 ?쎌엯 ??escHtml ?꾩닔) 쨌 R167(?좉퇋)
- **prevention**: R167 ???ъ슜???몃? ?곗씠?곕? innerHTML???쎌엯 ??紐⑤뱺 蹂?섏뿉 escHtml() ?섎Т. PR/edit ??grep?쇰줈 `innerHTML.*\+.*[^h]` ?⑦꽩 ?먮룞 寃異?

---

## P434 쨌 v49.81 쨌 _aioGuideSearch ?뺢퇋???몄젥??+ escHtml ?꾨씫

- **利앹긽**: ?ъ슜?먭? `[.*` ???뺢퇋??硫뷀?臾몄옄瑜?寃???ㅼ썙?쒕줈 ?낅젰 ??`new RegExp(keyword, 'gi')` ?몄텧??SyntaxError ?먮뒗 ?섎룄移??딆? 留ㅼ묶 媛?? + label/text/id媛 escHtml ?놁씠 innerHTML ?쎌엯.
- **?먯씤**: keyword瑜??뺢퇋???⑦꽩 + innerHTML ?묒そ???덉쟾 泥섎━ ?놁씠 吏곸젒 ?ъ슜.
- **?섏젙**: `escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` + escHtml(keyword)/escHtml(label)/escHtml(text)/escHtml(m.el.id) ?숈떆 ?곸슜.
- **?뚯씪**: `js/aio-core.js` `_aioGuideSearch` L1738~1755
- **violated_rule**: R167(?좉퇋)
- **prevention**: ?숈쟻 ?뺢퇋???앹꽦 ??硫뷀?臾몄옄 ?댁뒪耳?댄봽 ?섎Т. ?좉퇋 lint hook: `new RegExp\(\w` ?⑦꽩 諛쒓껄 ???댁쟾 以꾩뿉 ?댁뒪耳?댄봽 ?몄텧 寃利?

---

## P435 쨌 v49.81 쨌 chatRenderChips safeQ 諛깆뒳?섏떆 ?댁뒪耳?댄봽 鍮꾪슚??

- **利앹긽**: `escHtml(q).replace(/\\/g, '\\\\').replace(/'/g, "\\'")` ??HTML attribute 媛믪뿉 ?곗씠?곕? ?ｌ쓣 ??諛깆뒳?섏떆 ?댁뒪耳?댄봽媛 遺덊븘?뷀븯怨?媛?낆꽦 ???
- **?먯씤**: HTML attribute 媛믪? escHtml留뚯쑝濡?異⑸텇, 諛깆뒳?섏떆??JavaScript 臾몄옄??由ы꽣?댁뿉留??섎?.
- **?섏젙**: `escHtml(q).replace(/'/g, '&#39;')` ??HTML entity ?ъ슜 ?⑥닚??(3 怨? chatRenderChips safeQ + chatSend _safeQ2). _missList.map(escHtml) + _navIntent.label escHtml ?숈씪.
- **?뚯씪**: `js/aio-chat.js` L1345 + L4691 + L4694 + L4888
- **violated_rule**: R167
- **prevention**: HTML attribute ???ъ슜???곗씠????escHtml() + `&#39;` ?쒖? ?⑦꽩. 諛깆뒳?섏떆 ?댁뒪耳?댄봽 湲덉?.

---

## P436 쨌 v49.81 쨌 CSS line-clamp ?쒖? ?띿꽦 ?꾨씫 (?명솚??

- **利앹긽**: `.insight-box.box-collapsed` / `.news-item-headline` / `.news-item-desc` 3怨녹뿉??`-webkit-line-clamp`留??ъ슜. ?쒖? `line-clamp` ?꾨씫 ???ν썑 ?쒖? 梨꾪깮 ??vendor-prefix ?쒓굅 ??源⑥쭚.
- **?먯씤**: vendor-prefix留??ъ슜?섎뜕 ?쒓린 CSS.
- **?섏젙**: ?쒖? `line-clamp: N;` ?띿꽦??`-webkit-line-clamp: N;` ?놁뿉 ?숈떆 ?좎뼵.
- **?뚯씪**: `index.html` L1655, L2470, L2475
- **violated_rule**: R168(?좉퇋)
- **prevention**: vendor-prefix ?ъ슜 ???쒖? ?띿꽦怨??숈떆 ?좎뼵 ?섎Т.

---

## P437 쨌 v49.81 쨌 inline hover: 臾댄슚 ?띿꽦 ?ъ슜 + dead CSS

- **利앹긽**: `news-refresh-btn` style??`hover:background:rgba(0,212,255,0.25);` ?ы븿 ??CSS hover pseudo-class??stylesheet?먯꽌留??숈옉, inline `style` ?띿꽦 ???섎? ?놁쓬. + `#page-options > div:nth-child(4)` 鍮?洹쒖튃 ?붿〈.
- **?먯씤**: Tailwind-style ?몃씪??hover ?쒓린 ?ㅼ슜 + ??CSS 洹쒖튃 誘몄젙由?
- **?섏젙**: inline hover: ?띿꽦 ?쒓굅 + 鍮?CSS 洹쒖튃 ?뺣━.
- **?뚯씪**: `index.html` L9714, L3326
- **violated_rule**: R168
- **prevention**: inline `style` ?띿꽦??`hover:`/`focus:` ??pseudo-class ?묒꽦 湲덉?.

---

## P438 쨌 v49.81 쨌 var ?ъ슜?쇰줈 hoist conflict ?꾪뿕 (P311 ?⑦꽩)

- **利앹긽**: 30+ ?⑥닔?먯꽌 `var ld = window._liveData || {};` ?ъ슜 ??`var`??function-scoped + hoisted. 媛숈? ?⑥닔 ???ㅻⅨ 怨녹뿉??`const ld` ?좎뼵 ??SyntaxError (P311 v49.44 hotfix ?⑦꽩).
- **?먯씤**: ??ES5 肄붾뱶 ?⑦꽩 ?붿〈.
- **?섏젙**: 30+ 怨녹쓣 `let ld`濡??쇨큵 ?꾪솚 (block-scoped). 媛숈? ?대쫫 異⑸룎 ??利됱떆 SyntaxError濡?媛먯?.
- **?뚯씪**: `index.html` (?ㅼ닔 ?⑥닔)
- **violated_rule**: R169(?좉퇋)
- **prevention**: R169 ???숈씪 ?⑥닔 ??媛숈? ?대쫫 var/const/let ?좎뼵 湲덉?. ?좉퇋 肄붾뱶??let/const ?곗꽑. `AIO.getVarHoistConflictAudit()` (v49.44 R98) ?먮룞 寃利?

---

## P439 쨌 v49.82 쨌 SCREENER_DB 178320 ?붿〈 留ㅽ븨 (Codex v49.80 ?쒕㈃ ?듯빀 ?꾨씫遺?

- **利앹긽**: `js/aio-data.js:902` SCREENER_DB??`178320.KQ ??濡쒕낫?ㅽ?` ??留ㅽ븨 ?붿〈. KR_STOCK_DB??Codex v49.80 P431?먯꽌 178320 ???쒖쭊?쒖뒪???뺤젙?덉?留?SCREENER_DB??誘몄젙????AI 梨꾪똿??"178320 遺꾩꽍" ??濡쒕낫?ㅽ?濡??듬?, KR ?섏씠吏???쒖쭊?쒖뒪???쒓린. ?ъ슜??遺꾩꽍 寃곌낵 紐⑥닚.
- **?먯씤**: Codex媛 `KR_STOCK_DB` ???꾩튂留??뺤젙?섍퀬 ?ㅻⅨ ?곗씠??援ъ“(SCREENER_DB) ?꾨씫. v49.80 ?듯빀 ??cross-verify ?놁씠 蹂寃쎈텇留?洹몃?濡??섏슜 (v49.80 ?뺤쭅 ?됯? #3 ?뺥솗??利앷굅).
- **?섏젙**: SCREENER_DB 178320.KQ ??'?쒖쭊?쒖뒪?? ?뺤젙 + 090360.KQ ??'濡쒕낫?ㅽ?' ?좉퇋 異붽? (LG?꾩옄 ?먰쉶??33.4%).
- **?몃? 寃利?*: WebSearch 2026-05-28 ??178320 = Seojin System (Google Finance/Yahoo/Bloomberg) / 108320 = LX Semicon / 108490 = ROBOTIS / 090360 = Robostar (LG?꾩옄 ?먰쉶?? 紐⑤몢 ?뺤씤.
- **?뚯씪**: `js/aio-data.js` L902~903
- **violated_rule**: R170(?좉퇋) 쨌 Codex ?쒕㈃ ?듯빀 ?⑦꽩
- **prevention**: R170 ??KR 醫낅ぉ肄붾뱶 留ㅽ븨 ?뺤젙 ??紐⑤뱺 ?꾩튂(SCREENER_DB / AIO_TICKER_NAME_REGISTRY / KR_STOCK_DB) cross-verify ?섎Т. `AIO.assertKrTickerMappingAudit()` ?먮룞 寃利?

---

## P440 쨌 v49.82 쨌 R167 ?먮룞 ?뚭? audit 遺??(XSS ?쒕㈃ ?щ컻 媛??

- **利앹긽**: v49.81?먯꽌 R167 ?좎꽕?덉?留??먮룞 寃利??⑥닔 ?놁쓬 ???ν썑 escHtml ?꾨씫????異붽??섎㈃ grep ???섎㈃ 媛먯? 遺덇?.
- **?먯씤**: 洹쒖튃留?異붽?, 寃利??명봽??誘몃룞諛?
- **?섏젙**: `AIO.assertXssEscapeCoverageAudit()` ?좉퇋 ??11 chat/render ?⑥닔 toString scan ?대━?ㅽ떛 (innerHTML ?좊떦 + 蹂??concat + escHtml 誘명샇異?= unsafe) + DOM `[style*="hover:"]` 寃??+ stylesheet line-clamp ?쒖? ?숈떆 ?좎뼵 寃利? xssCoveragePct ?곗텧. ?ъ씠?쒕컮 14異?row ?몄텧.
- **?뚯씪**: `js/aio-core.js` (L11260~ ?좉퇋)
- **violated_rule**: R167 ?댁쁺??遺??
- **prevention**: ?좉퇋 R 洹쒖튃 異붽? ???숆린 audit ?⑥닔 ?숇컲 ?섎Т. ?ъ씠?쒕컮 row ?숆린 ?몄텧.

---

## P441 쨌 v49.82 쨌 KR 醫낅ぉ肄붾뱶 留ㅽ븨 ?ㅼ쨷 ?꾩튂 cross-check audit 遺??(Codex ?쒕㈃ ?듯빀 ?щ컻 ?⑦꽩)

- **利앹긽**: Codex v49.80媛 ?쇰? ?꾩튂留??뺤젙?섍퀬 ?ㅻⅨ ?꾩튂 ?꾨씫 (P439 ?ㅼ쬆). ?ν썑 ?몃? ?묒뾽蹂??듯빀 ???숈씪 ?⑦꽩 ?щ컻 媛??
- **?먯씤**: cross-check ?먮룞??遺?????щ엺??grep?쇰줈 ?ㅼ쨷 ?꾩튂 ?뺤씤 ???섎㈃ silent fail.
- **?섏젙**: `AIO.assertKrTickerMappingAudit()` ?좉퇋 ??SCREENER_DB / AIO_TICKER_NAME_REGISTRY / KR_STOCK_DB 3 ?꾩튂 cross-check + WebSearch verified 8 known mappings (178320/108320/108490/090360/277810/454910/005930/000660) hardcoded check. Critical 異⑸룎 ?먮룞 蹂닿퀬. ?ъ씠?쒕컮 15異?row ?몄텧.
- **?뚯씪**: `js/aio-core.js` (P440 ?ㅼ쓬 ?좉퇋)
- **violated_rule**: R170(?좉퇋)
- **prevention**: R170 ??KR/?멸뎅 ticker 留ㅽ븨 ?뺤젙 ???ㅼ쨷 ?곗씠??援ъ“ cross-check ?섎Т. ?몃? ?묒뾽蹂?Codex/VsCode) ?듯빀 ??蹂?audit ?ㅽ뻾 ??0 conflict 寃利???commit.

---

## P443~P450 쨌 v49.83 쨌 湲곌?湲?+ 吏곴???9嫄??쇨큵 蹂닿컯 (?ъ슜???뺤쭅 諛깅줈洹?

- **P443 / R172**: MACRO_CALENDAR auto-advance hook 遺????`_aioRecomputeMacroCalendar` ?좉퇋 (?섏씠吏 濡쒕뱶 7s ???먮룞 1??+ dry-run preview ?ъ씠?쒕컮 18異?. monthly/every-6-7-weeks/fomc-decision/weekly ?⑦꽩 ?먮룞 next event compute. 諛쒗몴 寃쎄낵 ??stale audit false alarm ?먮룞 ?댁냼.
- **P444 / R173**: ?먯궛 媛?correlation matrix 遺??(cross-asset regime classification 遺?? ??`AIO.computeCrossAssetCorrelation` ?좉퇋. `_priceHistory` ?쒖슜 30??rolling Pearson + regime ?대━?ㅽ떛 (SPY-QQQ>0.85 + SPY-TLT<-0.2 = risk-on / SPY-^VIX<-0.6 + SPY-TLT>0.3 = risk-off / SPY-QQQ<0.5 = decoupled). ?ъ씠?쒕컮 16異?
- **P445 / R174**: AI ?듬? ?뺣웾 鍮꾩쑉 痢≪젙 遺????`AIO.assertQuantitativeRatioAudit` ?좉퇋. `localStorage.aio_chat_history` 理쒓렐 20嫄????뺣웾 ?좏겙 (\$/% / 1,234 / bp / ??/ ???? / ?⑥뼱 鍮꾩쑉 ?곗텧. 湲곌? 7%+/?쇰컲 4~7%/?뺤꽦 怨쇰떎 <4%. ?ъ씠?쒕컮 17異?
- **P446 / R175**: earnings call transcript ?듯빀 遺????`AIO.fetchFMPEarningsCallTranscript` ?좉퇋 + `_fetchTickerDataForChat` 18 promise ?듯빀. FMP /earning_call_transcript 5遺?罹먯떆 + [Earnings Call (Qx YYYY)] ?쇰꺼 + 600??諛쒖톸 ?듬? 二쇱엯. ASP/?쒗뭹 濡쒕뱶留?怨좉컼 commentary ?뺤꽦 遺꾩꽍 ?뺥솗???꾩빟.
- **P447 / R176**: AI ?듬? ?쒓컖 ?먮즺 遺??(湲곌?湲?吏곴???#8) ??`window._aioBuildSparklineSvg` ?좉퇋 + `chatSend` ?듯빀. ?듬? 醫낅ぉ蹂?30??mini sparkline SVG ?먮룞 ?몃씪??(Promise.all 蹂묐젹 理쒕? 3 醫낅ぉ, 240횞56 path + area fill, ?묒닔 green/?뚯닔 red). `_priceHistory` ?곗꽑 ??Yahoo Chart 1mo fallback.
- **P449 / R177**: ?ъ씠?쒕컮 18異?metric ?쇰컲 ?ъ슜??遺??(#7) ???쇰컲/媛쒕컻??mode ?좉? ?좉퇋 (`localStorage.aio_audit_mode` + checkbox). simple = ?????????꾩씠肄섎쭔 / detailed = metric ?곸꽭.
- **P450 / R178**: audit row ?숇벑 ?꾧퀎濡??꾧린 ?쒓렇??媛?쒖꽦 遺議?(#9) ??failure status sticky top + pulse ?좊땲硫붿씠?? ??priority 0 (top + 鍮④컙 border + 2s pulse) / ??1 (amber border) / ??2 / ??3. CSS flex order. + @media (min-width:1600px) ?곗뒪?ы깙 wide-mode 2??grid (#10).
- **prevention**: R172~R178 ???좉퇋 audit ?⑥닔 異붽? ??(1) fn ?뺤쓽 (2) ?ъ씠?쒕컮 row (3) ?뚭? T ?뚯뒪??3醫??뗮듃 ?숈떆 ?묒꽦 ?섎Т (R170 ?⑦꽩 ?쇰컲??.

---

## P447 쨌 v49.88 쨌 遺??泥??쇱씠釉??섏떊 媛????뺤쟻 ?대갚???쇱씠釉뚮줈 ?ㅼ씤

- **利앹긽**: ??遺????泥?`fetchLiveQuotes`媛 0~30珥??쒕뜡 ?쒕젅??startDataScheduler 吏??+ initV20DataEngine 15珥?吏??. ??援ш컙??珥덇린 濡쒕뵫 ?ㅻ쾭?덉씠媛 ?놁뼱(grep 0嫄? ?ъ슜?먭? DATA_SNAPSHOT ?뺤쟻 ?대갚媛믪쓣 ?ㅼ떆媛??곗씠?곕줈 ?ㅼ씤. /data-refresh濡??섎룞 媛깆떊??媛믪씠??洹몃윺??빐 ???꾪뿕.
- **?먯씤**: ?대씪?댁뼵???묒냽 ???먮룞?댁쁺 紐⑤뜽(媛쒖씤 ??遺꾩궛 ?ㅺ퀎)? ?щ컮瑜대굹, "?쇱씠釉??섏떊 ???뺤쟻 援ш컙"???ъ슜?먯뿉寃??쒓컖?곸쑝濡??뚮━???덉씠??遺??
- **?섏젙**: body 吏곹썑 鍮꾩묠??遺??濡쒕뜑 諛곕꼫 ?좎꽕 ??"?뱻 ?ㅼ떆媛??곗씠???섏떊 以?쨌 ?뺤쟻 ?ㅻ깄???쒖떆 以? ??`aio:liveQuotes`(applyLiveQuotes 諛쒖넚) 泥??섏떊 ??fade-out. 10珥?誘몄닔????"???ㅼ떆媛??곌껐 吏?????뺤쟻 ?ㅻ깄???ъ슜 以??쇰줈 ?꾪솚 + 4珥????댁젣. 20珥??덉쟾?곹븳. sessionStorage `aio_boot_done` ?щ갑臾?媛?? prefers-reduced-motion ???
- **?뚯씪**: `index.html` body 吏곹썑 DOM+script + `<style>` keyframes
- **violated_rule**: R115(placeholder ?쒖?) ?곗옣 ??濡쒕뵫 援ш컙 紐낆떆 쨌 R179 ?좉퇋
- **prevention**: R179 ???대씪?댁뼵???묒냽 ?먮룞?댁쁺 紐⑤뜽?먯꽌 泥??쇱씠釉??섏떊 ???뺤쟻 援ш컙? 遺??濡쒕뜑濡?紐낆떆. ?쒕쾭 cron ?꾩엯 湲덉? (媛쒖씤 ??紐⑤뜽 ?꾨같 + 怨듭쑀 ?꾨줉??荑쇳꽣 ?뚯쭊).

## P448 쨌 v49.88 쨌 fetchBreadthData US %above MA ?먮룞 fetch 誘몄옉??(?먮룞??媛???臾몄꽌??

- **利앹긽**: `fetchBreadthData`(aio-data.js:2896)媛 breadthSymbols濡?MMFI/MMTW/MMFD瑜??좎뼵?섎굹 ?ㅼ젣 fetch?????? Alpha Vantage advance/decline 洹쇱궗移??먮뒗 RSP/SPY 鍮꾩쑉留?`updateBreadthUI` 媛깆떊. ??DATA_SNAPSHOT.breadth5sma/20sma/50sma/200sma???쇱씠釉??먮룞 媛깆떊 寃쎈줈 ?놁쓬 ???뺤쟻 ?대갚 ?곴뎄 ?섏〈.
- **?먯씤**: ?⑥닔媛 % above MA 吏?쒕? 媛?몄삤??濡쒖쭅 誘멸뎄??(?щ낵 ?좎뼵留?dead).
- **?섏젙**: v49.88?먯꽌??**臾몄꽌?붾쭔** (v49.87 ?섎룞 媛깆떊???뺣떦?덈뜕 洹쇰낯 ?댁쑀 湲곕줉). ??fetch 援ы쁽? Barchart CORS/?꾨줉??寃利??꾩슂 ??蹂꾨룄 ?묒뾽(P449 ?꾨낫). ?꾩옱??/data-refresh ?섎룞 媛깆떊 + 遺??濡쒕뜑濡?stale ?몄? 蹂댁셿.
- **?뚯씪**: `js/aio-data.js:2896` fetchBreadthData
- **violated_rule**: ?놁쓬 (?ㅺ퀎 媛?臾몄꽌??
- **prevention**: C怨꾩링(?섎룞) + B怨꾩링(?먮룞?붽강) ?곗씠?곕뒗 `getAutoOpsReadiness`??stale 寃쎄낵??異?異붽? 寃??(v49.89+).

---

## P449 쨌 v49.89 쨌 F&G 珥덇린吏꾨떒 ?깃툒 (吏곸젒?몄텧留?蹂닿퀬 CORS 媛??먯젙 ???뺤젙)

- **利앹긽**: ?곗씠??lineage 議곗궗 泥?grep?먯꽌 `fetchFearGreed`媛 `fetchWithTimeout(url)` 吏곸젒 ?몄텧留?蹂닿퀬 "CNN dataviz CORS 李⑤떒 媛??쇰줈 ?깃툒 ?먯젙.
- **?먯씤**: ?⑥닔 catch 釉붾줉 誘명솗?? ?ㅼ젣濡쒕뒗 catch??(1) CORS_PROXY ?꾨줉???ъ떆??(2) DATA_SNAPSHOT snapshot ?대갚 3??泥댁씤 ?꾨퉬. `_applyFearGreedScore`媛 sourceKind live/proxy/snapshot 遺꾨쪟.
- **?섏젙**: 吏꾨떒 ?뺤젙 ??F&G??媛??꾨땲??紐⑤쾾 ?щ?. 肄붾뱶 ?섏젙 0嫄? 援먰썕 湲곕줉.
- **violated_rule**: P68(肄붾뱶 ?뺤씤 ?놁씠 異붿륫 湲덉?) ???⑥닔 ?꾩껜 ?쎄린 ??遺遺?grep?쇰줈 ?먯젙???덉감 ?ㅻ쪟.
- **prevention**: fetch ?⑥닔 lineage ?먯젙 ??catch/?대갚 釉붾줉源뚯? ?꾩껜 ?쎄퀬 ?먯젙. getDataLineageAudit???대갚 泥댁씤 ?ы븿 ?먮룞 寃利?

## P450 쨌 v49.89 쨌 ?곗씠??lineage(source?뭨ender) ?먮룞 audit 遺??

- **利앹긽**: ?ъ슜??"?곗씠???섎굹?섎굹 source?믪젙?뺤꽦?믨?怨듈넂render ?먮쫫 議곗궗?덈굹?" ???곗씠?곕퀎 5?④퀎 怨꾨낫瑜??먮룞 寃利앺븯???⑥닔 遺?? 湲곗〈 getDataPipelineAudit? ?덉씠?대퀎 移댁슫?몄? ?곗씠?곕퀎 lineage ?꾨떂.
- **?먯씤**: ?곗씠??怨꾨낫媛 肄붾뱶 ?꾨컲??遺꾩궛 (DATA_APIS source + REFRESH_SCHEDULE scheduler + PriceStore/MacroStore store + transform ?⑥닔 + data-live-price/data-snap render). ?⑥씪 留ㅽ븨 遺??
- **?섏젙**: `AIO.getDataLineageAudit()` ?좎꽕 ??13醫??곗씠??횞 {source URL, scheduler ?깅줉, transform, renderSink DOM 移댁슫?? ?먮룞 留ㅽ븨 + connected/gap(B怨꾩링)/manual(C怨꾩링)/broken 遺꾨쪟. broken 0嫄??뺤씤. ?ъ씠?쒕컮 19異?
- **?뚯씪**: `js/aio-core.js` getDataLineageAudit + _aioRefreshAuditWidget dataLineage 遺꾧린 / `index.html` ?ъ씠?쒕컮 row
- **violated_rule**: R180 ?좉퇋
- **prevention**: R180 ???곗씠??異붽?/蹂寃???5?④퀎 lineage ?곌껐 + getDataLineageAudit broken 0 ?섎Т. ?ъ슜??"議곗궗?덈굹?" 吏덉쓽???⑥닔 ??諛??묐떟.

---

## P451 쨌 v49.90 쨌 cell-level ?곗씠??sink-to-source ?꾩닔 寃利?遺??(援ъ“/移댄뀒怨좊━留?遊?

- **利앹긽**: ?ъ슜??"援ъ“留뚯씠 ?꾨땲???붾㈃ 湲곕뒫/?띿뒪???댁슜???ㅼ뼱媛???곗씠???섎굹?섎굹 ?몃? ?뺤씤?덈굹?" ??v49.88(援ъ“) + v49.89(13醫?移댄뀒怨좊━)???곗씠???먮쫫??"寃쎈줈 議댁옱"留?寃利? ?붾㈃???뚮뜑?섎뒗 媛쒕퀎 sink(data-live-price 149 + data-snap 83)媛 媛곴컖 source(LIVE_SYMBOLS/DATA_SNAPSHOT)???곌껐?먮뒗吏 cell-level cross-check 誘몄닔??
- **?먯씤**: lineage audit??移댄뀒怨좊━(13) ?덈꺼??癒몃Т由? 媛쒕퀎 sink蹂?source ??텛??遺??(湲곗〈 getLiveSymbolsCoverageAudit/getStaticSeedFallbackAudit??媛곴컖 ?섏?留?lineage audit??誘명넻??.
- **?섏젙**: ?뺤쟻 ?꾩닔 cross-check ?ㅽ뻾 ??data-live-price 54 怨좎쑀 ticker ??LIVE_SYMBOLS 636 (?딄? 0) / data-snap 59 怨좎쑀 key ??DATA_SNAPSHOT alias (?딄? 0). ?섏떖 3媛?krw-full/kr-cpi-yoy/kr-gdp-qoq) 紐⑤몢 applyDataSnapshot 留ㅽ븨+aliasMap ?곌껐 ?뺤씤. getDataLineageAudit??cellLevel ?꾨뱶 ?듯빀 ??移댄뀒怨좊━ + cell-level ?⑥씪 吏꾩엯??
- **?뚯씪**: `js/aio-core.js` getDataLineageAudit cellLevel + _aioRefreshAuditWidget dlEl
- **violated_rule**: R181 ?좉퇋 쨌 P68(異붿륫 湲덉? ??PCR/3媛????섏떖 ?깃툒?덉쑝??肄붾뱶 ?뺤씤?쇰줈 寃利?
- **prevention**: R181 ??lineage 寃利앹? 移댄뀒怨좊━ + cell-level(媛쒕퀎 sink?뭩ource) ???? getDataLineageAudit().cellLevel.totalOrphans === 0 ?섎Т.

---

## P452 쨌 v49.91 쨌 cell-level ?곗씠??"媛? ?뺥솗??誘멸?利?(?곌껐留?蹂닿퀬 媛믪? stale)

- **利앹긽**: ?ъ슜??"援ъ“/?곌껐留뚯씠 ?꾨땲???곗씠???섎굹?섎굹 ?뺥솗/理쒖떊 泥댄겕". v49.84~90? sink-to-source ?곌껐(orphan 0)留?寃利? ?ㅼ젣 媛??뺥솗?깆? 遺遺꾨쭔. 寃곌낵: **PCE pce/corePce 2.7/2.7** (?ㅼ젣 4??BEA 5/28 諛쒗몴 = Headline 3.8% / Core 3.3%, 3??理쒓퀬) ??1%p+ stale. + 5/27??/28 醫낃? 媛깆떊 ?꾨씫 (SPX 7520??563.63 ?좉퀬媛 / VIX 17.01??5.74).
- **?먯씤**: lineage/cell-level audit??"?곌껐 議댁옱"留?寃利? "媛??뺥솗??? ?먮룞 寃利?遺덇? (?몃? ?ㅼ륫 ?議??꾩슂). PCE??v49.86?먯꽌 CPI留?媛깆떊?섍퀬 PCE ?꾨씫.
- **?섏젙**: WebSearch 5/28 ?ㅼ륫 ??PCE 3.8/3.3, ?쒖꽭 4嫄?SPX/Nasdaq/Dow/VIX) + _fallback(spxATH/vix) + vvix. ?띿뒪?? CHAT_CONTEXTS PCE ?대갚 '2.6'??3.3' + sentiment Tail Risk Board ?섎뱶肄붾뵫(SKEW 141.86/VVIX 90.10/MOVE 62.36 3/30 ?ㅻ깄?? ??DATA_SNAPSHOT ?숈쟻 李몄“ ?꾪솚.
- **?뚯씪**: `js/aio-core.js` DATA_SNAPSHOT pce/corePce/spx/nasdaq/dow/vix/vvix + _fallback / `js/aio-chat.js` L73 PCE ?대갚 + L1039 Tail Risk ?숈쟻
- **violated_rule**: R182 ?좉퇋 쨌 R76(?쒖닠 ?띿뒪??stale ?좏겙) ??sentiment 3/30 ?섎뱶肄붾뵫
- **prevention**: R182 ??cell-level? ?곌껐(orphan 0) + 媛??뺥솗??二쇱슂 嫄곗떆/?쒖꽭 ?몃? ?ㅼ륫 ?議? ???? ?띿뒪?????섏튂??DATA_SNAPSHOT ?숈쟻 李몄“ ?곗꽑, ?섎뱶肄붾뵫 湲덉?.

---

## P453 쨌 v49.92 쨌 VKOSPI 74.02 ??WebSearch 遺?뺥솗 媛?寃利??놁씠 ?섏슜 (?곸떇 踰붿쐞 誘멸?利?

- **利앹긽**: v49.87?먯꽌 VKOSPI瑜?WebSearch "74.02"濡?媛깆떊. 洹몃윭??74??2020.3 肄붾줈???⑤땳 ?섏? ??VIX 15.74(誘멸뎅 ?됱삩) + KOSPI ?ъ긽理쒓퀬 8185? ?묐┰ 遺덇?. VKOSPI ?뺤긽踰붿쐞 12~25. WebSearch媛 Investing.com ?섏씠吏???ㅻⅨ ?レ옄瑜??ㅼ씤 諛섎났.
- **?먯씤**: WebSearch 寃곌낵瑜??곸떇(VKOSPI-VIX ?곴?愿怨? ?쒓뎅 蹂?숈꽦? 誘멸뎅 VIX? 鍮꾩듂?섍굅???쎄컙 ?믪쓬)?쇰줈 寃利앺븯吏 ?딄퀬 "?ㅼ륫"?대씪硫?洹몃?濡??섏슜. v49.84 異붿젙 18.50???ㅽ엳???뺥솗?덈뒗???섎せ??"?ㅼ륫"?쇰줈 ??뼱?.
- **?섏젙**: VKOSPI 74.02 ??18.20 (VIX 15.74 + KOSDAQ -2.54% 諛섏쁺 ?⑸━??異붿젙). ?쇱씠釉?fetchVkospiDynamic Naver) ?곗꽑 紐낆떆.
- **violated_rule**: R183 ?좉퇋 쨌 P68(異붿륫/誘멸?利??섏슜 湲덉?)
- **prevention**: R183 ??WebSearch ?섏튂??吏?쒕퀎 ?뺤긽 band 踰붿쐞 寃利????섏슜. VKOSPI 12~30 / VIX 9~80 / PE 5~50 ??sanity range ?댄깉 ???ы솗???먮뒗 蹂댁닔??異붿젙.

## P454 쨌 v49.92 쨌 DATA_SNAPSHOT ?섎㉧吏 ?꾨뱶 stale (湲濡쒕쾶 吏???먯옄??BOJ)

- **利앹긽**: cell-level 媛??議?寃곌낵 ?ㅼ닔 stale ??DAX 23200(?ㅼ젣 25068, ?ъ긽理쒓퀬沅? / Nikkei 64999(64693) / Hang Seng 25947(25006) / FTSE 10611(10428) / WTI 88.30(90.50, ?대? 異⑸룎 ?ш컻) / Brent 94.50(96.29) / Gold 4483(4411) / Silver 71.50(73.51) / BOJ 0.50(0.75 ?몄긽).
- **?먯씤**: /data-refresh媛 誘멸뎅 ?듭떖 吏??嫄곗떆 ?꾩＜, 湲濡쒕쾶 吏?샕룹쨷?숈???湲덈━??"異붿젙 ?좎?"濡?諛⑹튂. DAX??異붿젙??1800pt(7%) 踰쀬뼱??
- **?섏젙**: 8媛??꾨뱶 5/28 ?ㅼ륫 媛깆떊.
- **violated_rule**: R182(媛??뺥솗?? ?곗옣
- **prevention**: /data-refresh G洹몃９(湲濡쒕쾶 吏?? + E4(以묒븰???湲덈━)??遺꾧린 1?? ?ㅼ륫 ?議? "異붿젙 ?좎?" ?쇰꺼 ?꾨뱶??getDataLineageAudit?먯꽌 staleRisk ?쒖떆 寃??

## P455 쨌 v49.94 쨌 KR 2李?嫄곗떆吏??stale 4嫄?(CPI forecast ?쇰룞 + PPI/?좎슜?붽퀬 regime 誘몃컲??

- **利앹긽**: cell-level 媛??議?寃곌낵 ?쒓뎅 2李?嫄곗떆吏??4嫄?stale ??(1) krCpi 2.7(?ㅼ젣 4??2.6, ?듦퀎泥? (2) krManufPmi 51.5(?ㅼ젣 4??53.6, S&P Global 5/4 ??2022.2 ?댄썑 理쒓컯) (3) krPpi 1.5(?ㅼ젣 4??+6.9% YoY, ?쒓뎅?????28?꾨쭔 理쒕? 異⑷꺽, ?앹쑀쨌?앺깂 +73.9%) (4) krCreditBalance 19.2議??ㅼ젣 ~36議? ??? 理쒓퀬).
- **?먯씤**: (a) **forecast vs actual ?쇰룞** ??krCpi??BOK ?곌컙 臾쇨? *?꾨쭩移? 2.7%瑜??꾩옱 CPI YoY ?꾨뱶???낅젰. ?꾩옱媛??꾨뱶???ㅼ륫留??ㅼ뼱媛???? (b) **PPI 8媛쒖썡 ?곗냽 ?곸듅 + ?대? ?좉? 湲됰벑(?앹쑀쨌?앺깂 +73.9%)??1.5% ?됱떆媛믪쑝濡?諛⑹튂** ??5諛?媛源뚯슫 愿대━. (c) **?쒖옣 regime 蹂??誘몃컲??* ??KOSPI 2諛?湲됰벑(record 8185)?쇰줈 "鍮싴닾" ?좎슜?붽퀬媛 ??? 理쒓퀬 36議곗씤???됱떆 19.2議??좎? = ?쒖옣 ?곹솴怨?紐⑥닚. record rally硫?record margin debt媛 ?곸떇 ?숉뻾.
- **?섏젙**: 4媛??꾨뱶 WebSearch ?ㅼ륫 媛깆떊 + DOM ?몃씪??4怨?L10814/L11414/L11435/L11731) 3-way ?뺥빀(R58). L16491 retail-sentiment 怨듭떇???댁젣 36議?margin debt瑜?froth ?좏샇濡??뺥솗??諛섏쁺.
- **violated_rule**: R182(媛??뺥솗?? 쨌 R183(sanity band ??krPpi 1.5???대? ?좉? ?섍꼍?먯꽌 鍮꾪쁽?ㅼ쟻, krCreditBalance 19.2??record rally? 紐⑥닚) ?곗옣
- **prevention**: 嫄곗떆吏???꾨뱶??"?꾩옱媛?vs ?꾨쭩移? ?섎? 紐낇솗??援щ텇 (?꾨쭩移섎뒗 蹂꾨룄 *Fcst ?꾨뱶). ?쒖옣 regime 湲됰?(吏??湲됰벑/?좉? 湲됰벑) ???곕룞 2李⑥????좎슜?붽퀬/PPI)???숇컲 ?먭? ???⑥씪 吏?쒕쭔 媛깆떊?섎㈃ ?뚯깮 吏??stale ?붿〈. /data-refresh K洹몃９(?쒓뎅 2李?嫄곗떆: CPI/PPI/PMI/?좎슜?붽퀬/?덊긽湲?????1?? ?ㅼ륫 ?議?

## P456 쨌 v49.95 쨌 US 2李?嫄곗떆吏??stale 9嫄?+ data-snap ?뺤쟻 ?쒕뱶 紐⑥닚 + ?쇰꺼 ?ㅻ쪟

- **利앹긽**: ?ъ슜??"?꾩닔 議곗궗?덉뼱?" ?뺤쭅 ?먭? ??DATA_SNAPSHOT 141?꾨뱶 triage 寃곌낵 嫄곗떆쨌?쒖옣 ?듭떖留?寃利앸릱怨?2李⑥????ㅼ닔 stale 諛쒓껄. US 9嫄? ismPmi 52.4(??2.7) 쨌 ismPrice 70.7(??4.6, 14pt) 쨌 ismSvc 54.0(??3.6) 쨌 retailSales 0.6(??.5) 쨌 consConf 104.7(??3.1, 11pt + ?쇰꺼 '誘몄떆媛? ?ㅻ쪟) 쨌 housingStarts 1.42(??.47M) 쨌 move 62.5(??0.9) 쨌 usWageGrowth 3.5(??.6) 쨌 rut 2858.50(??936.57, 78pt). 異붽?濡?**`data-snap="move"` ?뺤쟻 ?쒕뱶媛 2怨녹뿉??遺덉씪移?* ??L4960 62.4(?뱀깋 "洹밸떒 ???) vs L7954 107.4(鍮④컯 "Elevated").
- **?먯씤**: (a) 4??諛쒗몴 ?꾨즺 吏??ISM/?뚮ℓ/?뚮퉬?먯떊猶?二쇳깮/?꾧툑)瑜??댁쟾 ?붽컪?쇰줈 諛⑹튂 ??"?ㅼ쓬 諛쒗몴 6?? 二쇱꽍留??ш퀬 4???ㅼ륫 誘몃컲?? (b) **`rut`/`move`瑜?"異붿젙 ?좎?"濡?肄붾찘?명븯怨??ㅼ륫 ????* ??Russell? ?좉퀬媛 ?좊━濡?78pt(+2.7%) 踰쀬뼱?? (c) **媛숈? data-snap ?ㅻ? 2媛?DOM ?꾩튂媛 ?쒕줈 ?ㅻⅨ ?뺤쟻 ?쒕뱶濡??섎뱶肄붾뵫** ??applyLiveQuotes媛 ?고??꾩뿉 ?듭씪?섎굹 ?쇱씠釉?誘몄닔???ㅽ봽?쇱씤 ??紐⑥닚 ?몄텧. (d) consConf ?쇰꺼??'Michigan'?몃뜲 媛?104.7??3.1)? Conference Board ?ㅼ??????뚯뒪/?쇰꺼 遺덉씪移?
- **?섏젙**: 9媛??꾨뱶 WebSearch ?ㅼ륫 媛깆떊 + DOM ?몃씪??6怨?macro 移대뱶 wage/cons-conf/housing + MOVE 2怨?+ risk-monitor) 3-way ?뺥빀 + MOVE ?쒕뱶 70.9 ?듭씪 + cons-conf ?쇰꺼 'Conf. Board (5??'濡??뺤젙.
- **?붿〈(援ъ“ ?댁뒋, 誘몄닔????湲곕줉留?**: cons-conf 移대뱶(data-snap, Conf Board)? 梨꾪똿 而⑦뀓?ㅽ듃(live FRED UMCSENT=誘몄떆媛?媛 ?ㅻⅨ ?뚯뒪. ?쇰꺼濡?援щ텇?섏뼱 ?ㅼ씤 ?꾪뿕 ??쓬. ?ν썑 ?⑥씪 ?뚯뒪 ?듭씪 寃??
- **violated_rule**: R182(媛??뺥솗?? 쨌 R58(DOM ?몃씪??vs DATA_SNAPSHOT 3-way ?뺥빀 ??媛숈? ???쒕뱶 ?⑥씪???섎Т) ?곗옣
- **prevention**: (1) 諛쒗몴 ?꾨즺 ???곗씠?곕뒗 利됱떆 ?ㅼ륫 諛섏쁺 ??"?ㅼ쓬 諛쒗몴 ?덉젙" 二쇱꽍留??먯? 留?寃? (2) "異붿젙 ?좎?" ?쇰꺼 ?꾨뱶??遺꾧린 1?? ?ㅼ륫 ?議?(?뱁엳 吏?? rut/shanghai/cac). (3) **?숈씪 data-snap ?ㅻ뒗 ?⑥씪 ?뺤쟻 ?쒕뱶** ??getSnapshotConsistencyAudit(R55)??媛숈? ???ㅼ쨷 ?쒕뱶 遺덉씪移??먯? 異붽? 寃?? (4) ?쇰꺼怨?媛??ㅼ????뺥빀 ?뺤씤 (Michigan ~50-100 vs Conf Board 1985=100).

## P457 쨌 v49.95 쨌 ?쇱씠釉뙿룹감?맞룸찓紐㉱룻뀓?ㅽ듃 4 移댄뀒怨좊━ ?꾩닔 寃利?(?ъ슜??"?쒖꽭/李⑦듃쨌?띿뒪??遺꾩꽍??" ?뺤쭅 ?먭?)

- **留λ씫**: ?ъ슜??"紐⑤뱺 ?곗씠??吏묓빀/?곸뿭/移댄뀒怨좊━ ?ㅼ쭏?곸쑝濡??꾩닔 議곗궗? ?쒖꽭/李⑦듃쨌?띿뒪??遺꾩꽍??" ???ㅻ깄????4 移댄뀒怨좊━(?쇱씠釉?sink쨌李⑦듃쨌硫붾え쨌?띿뒪??瑜?python http.server preview ?쇱씠釉?濡쒕뱶濡??ㅼ젣 寃利?
- **寃利?諛⑸쾿/寃곌낵**: (?쇱씠釉? data-live-price 55 ?ㅽ떚而?orphan 0(PCR留?derived) + preview?먯꽌 _liveData 234????fetch쨌DOM ?뚮뜑쨌?쇱씠釉?^GSPC=?ㅻ깄??援먯감寃利??쇱튂 + **v49.95 JS ?뚯떛 臾닿껐 ?뺤씤**(node 遺???泥닿?利? APP_VERSION v49.95 濡쒕뱶쨌肄섏넄 ?먮윭 0). (李⑦듃) canvas 46쨌Chart.js쨌registry쨌?섎룞?뚮뜑+?대갚 ?뺤긽 ????lazy IntersectionObserver???꾨줈洹몃옒留ㅽ떛 preview?먯꽌 誘몃컻???섎꽕???쒓퀎, **production 踰꾧렇 ?꾨떂**, ?ｋ텋由??⑥젙 ?뚰뵾). (硫붾え) ?좎꽑??硫붿빱?덉쬁 ?묐룞, 30??archive ?꾧퀎 ?꾨떖, META 二쇱꽍 媛깆떊. (?띿뒪?? SCENARIO ?좎꽑쨌?뺣쪧??100%쨌CHAT_CONTEXTS stale ?꾩텧 0쨌lifecycle 3 aged item ?뺥솗??flag.
- **諛쒓껄(誘몄떆?? /data-refresh ?곸뿭)**: briefing 二쇨컙 罹섎┛??5/4~5/8 二쇨컙 ?쇱젙쨌earnings쨌IPO)媛 "?대쾲 二?濡??쒖떆?섎굹 3二?寃쎄낵 ??STATIC_CONTENT_LIFECYCLE??`briefing-week-may-4-10` replaceDue濡??대? flag 以? 二쇨컙 ?몄쭛 媛깆떊? /data-refresh ?먮뒗 /integrate ?곸뿭(?⑥씪 ?곗씠?곌컪 ?꾨떂).
- **?ㅽ깘 ?앸퀎**: governance "stale-live-like-date" 以?macro "3/6"(遺꾧린 3/6/9/12???쎌뼱)쨌kr-home "3/11"(v49.95 ?섎룄??怨쇨굅 ?몄슜 "3/11 31.8議겸넂5??36議?)??false positive.
- **援먰썕**: ?쇱씠釉?lazy ?뚮뜑???뺤쟻 肄붾뱶 ?쎄린濡?"媛??뺥솗?? 寃利?遺덇? ??preview ?쇱씠釉?濡쒕뱶 ?꾩슂. ???꾨줈洹몃옒留ㅽ떛 ?섎꽕??showPage+scrollIntoView)??IntersectionObserver瑜?諛쒗솕 紐삵빐 lazy 李⑦듃 ?쒓컖寃利앹뿏 ?쒓퀎. ??釉뚮씪?곗? ?ъ슜???ㅽ겕濡ㅻ줈留?理쒖쥌 ?뺤씤 媛?????섎꽕???꾪떚?⑺듃瑜?踰꾧렇濡??ㅼ씤?섏? 留?寃?
- **violated_rule**: ?놁쓬 (寃利??묒뾽 쨌 ?곗씠???ㅻ쪟 0嫄?諛쒓껄). R101(LIVE_SYMBOLS coverage) ?곗옣 寃利?

## P458 쨌 v49.95 쨌 媛?蹂寃????섎?-?뺥빀??semantic consistency) ?꾩닔 寃利?(P61 ?댄뻾 ?먭?)

- **留λ씫**: ?ъ슜??"?⑥닚 寃됲븼湲??꾨땶 ?ㅼ쭏???섎?? ?뺥빀?깃퉴吏 泥댄겕?덉뼱?" ??v49.91~95??22媛?媛?蹂寃쎌씠 **二쇰? ?쒖닠쨌?댁꽍쨌?됱긽쨌?뚯깮?먯닔? ?뺥빀**?섎뒗吏 P61(?대깽?????섎뱶肄붾뵫 ?띿뒪???댄뻾) 愿???꾩닔 grep.
- **?먭? ???(regime ?ㅼ쭛? 蹂寃?**: krCreditBalance 19.2??6(record)쨌krPpi 1.5??.9(28??理쒓퀬)쨌consConf 104.7??3.1(?섎씫)쨌ismPrice 70.7??4.6쨌shanghai 3420??098쨌pcr 0.67??.83.
- **寃곌낵 ??紐⑥닚 0嫄?*: (1) ?좎슜?붽퀬 "媛먯냼/異뺤냼" ?쒖닠 0嫄????ㅻ깄??肄붾찘??"媛먯냼 異붿꽭"留??덉뿀怨?v49.94?먯꽌 ?대? 援먯껜) (2) PPI "?덉젙/?? ?쒖닠 0嫄?(3) Shanghai ???덈꺼 ?섎뱶肄붾뵫 0嫄?(4) CHAT_CONTEXTS ?섎뱶肄붾뵫 ?댁꽍 0嫄?(5) consConf 罹≪뀡 ?뱀깋? 移대뱶蹂?design accent(wage=amber/housing=cyan)吏 媛??곹깭 ?좏샇 ?꾨떂.
- **?뚯깮?먯닔 ?꾪뙆 寃利?(?뺥솗)**: pcr?뭦ut/call ?щ━怨꾩궛(aio-core L1646쨌aio-data L2086) 寃利앷컪?쇰줈 ???뺥솗?댁쭚 쨌 krCreditBalance?뭨etail froth ?먯닔(L16491 `(36-20)*2`) record 鍮싴닾瑜?froth濡??뺥솗 諛섏쁺 쨌 krPpi/ismPrice???쒖떆 ?щ㎎ ?꾩슜(遺꾨쪟?⑥닔 ?놁쓬).
- **援먯감 ?뺥빀??*: 蹂寃쎈뱾??"?명뵆??湲됰벑" ?뚮쭏濡??댁쟻 ?쇨? (krPpi?뫢톓smPrice?뫢톍onsConf?벬톍pi???숇갑??.
- **洹쇰낯 ?댁쑀**: ?깆씠 媛?醫낆냽 ?섎뱶肄붾뵫 ?댁꽍 ????숈쟻 諛붿씤??m.consConf=live FRED쨌data-snap) + ?ㅼ????ㅻ챸 罹≪뀡 + ?ш퀎???뚯깮?⑥닔 援ъ“ ??P61 ?댄뻾??援ъ“??媛뺥븿.
- **violated_rule**: ?놁쓬. P61 ?щ컻 諛⑹? 寃利??듦낵.
- **prevention**: 媛?regime 蹂寃?2諛? ?먮뒗 遺???꾪솚) ???섎?-?뺥빀??grep ?섎Т ??(吏?쒕챸).{0,40}(諛섎?諛⑺뼢 ?뺤슜?? ?⑦꽩 + ?뚯깮?먯닔 consumer 異붿쟻 + ?됱긽/罹≪뀡 媛??곹깭 vs design-accent 援щ텇.

## P459 쨌 v49.96 쨌 DATA_SNAPSHOT 蹂몄껜 ??_fallback 誘몃윭 silent drift (洹쇰낯 蹂닿컯 媛???좎꽕)

- **利앹긽**: ?ъ슜??"?⑥? ?곸뿭?놁씠 洹쇰낯 蹂닿컯" ??媛숈? 吏?쒓? `DATA_SNAPSHOT` 蹂몄껜 + `_fallback` 誘몃윭 ????μ냼??議댁옱?섎뒗???쒖そ留?媛깆떊??遺덉씪移? 5嫄?寃異? move(蹂몄껜 70.9 vs 誘몃윭 62)쨌vvix(83 vs 85)쨌skew(139 vs 142)쨌breadth200(56 vs 57, MMTW 20d/MMTH 200d ?쇰룞)쨌fg_uw(蹂몄껜 74 v48.70 stale vs 誘몃윭 65 v49.84).
- **?먯씤**: (a) **v49.95?먯꽌 move瑜?70.9濡?媛깆떊?섎ŉ _fallback.move 62 誘몃윭 ?숆린???꾨씫 ???닿? 留뚮뱺 遺덉씪移?*. (b) pcr???숈씪 ?⑦꽩(?댁쟾 ??0.67 vs 0.83, v49.95?먯꽌 ?쒖젙). (c) `_fallback`? computeTradingScore/computeMarketHealth媛 ?쎈뒗 ?먯닔怨꾩궛??誘몃윭?몃뜲 蹂몄껜? 蹂꾧컻 ?좎?蹂댁닔 ??媛깆떊 ???꾨씫 ?곸떆 ?꾪뿕. (d) 湲곗〈 runtime DOM audit(getSnapshotConsistencyAudit)??applyDataSnapshot ?뺢퇋??**??* DOM??遊먯꽌 ??JS ??μ냼 媛?遺덉씪移섎? 援ъ“?곸쑝濡?紐??≪쓬.
- **?섏젙**: 誘몃윭 5嫄?蹂몄껜? ?뺥빀 + **`AIO.getSnapshotFallbackConsistencyAudit()` ?좎꽕**(蹂몄껜 12?ㅲ넄誘몃윭 3% ?덉슜 援먯감寃利? + getAutoOpsReadiness ?듯빀 + T686 ?뚭?.
- **洹쇰낯 蹂닿컯 ?섏쓽**: ?ъ슜?먭? ?곕젮??"寃됲븼湲??꾨땶 ?뺥빀????媛??源딆? 痢????щ엺 ?덉뿉 ??蹂댁씠??**?댁쨷 ??μ냼 drift**瑜??먮룞 媛?쒕줈 ?밴꺽. ?닿? 吏곸젒 留뚮뱺 遺덉씪移?move)瑜?audit??利됱떆 寃異?= 媛???묐룞 ?낆쬆.
- **violated_rule**: R184 ?좉퇋 (?숈씪 吏??2??μ냼 ?뺥빀 ?섎Т). R55(snapshot consistency) ?곗옣 ??runtime DOM ?덈꺼 ??JS 媛앹껜 ?덈꺼 ?뺤옣.
- **prevention**: 誘몃윭 ??12媛? 媛깆떊 ???묒そ ?숈떆 ?섏젙 + `getSnapshotFallbackConsistencyAudit().issueCount === 0` 寃利? ?좉퇋 誘몃윭 ??異붽? ??aliasMap ?깅줉 ?섎Т.

## P460 쨌 v49.96 쨌 KR_STOCK_DB 肄붾뱶 異붿텧 0嫄???siseJson 理쒖쥌 ?대갚 tier 臾대젰??(???먯껜 audit??surfacing)

- **利앹긽**: ?ъ슜??"吏꾩쭨 ?⑥? ?곸뿭?놁씠 ?꾨꼍?" ?????먯떊??`getAutoOpsReadiness()` status 'warn' + `getDataQualityIssueAudit()`??"KR_STOCK_DB code extraction returned 0 codes" 寃쎄퀬. KR 媛쒕퀎醫낅ぉ fetch??siseJson(3~4李?理쒖쥌 ?대갚)?????肄붾뱶 0媛쒕줈 臾대젰??
- **?먯씤**: `_aioCollectKrCodes`(aio-data.js L8967)媛 媛앹껜 媛믪뿉??`.code`/`.symbol` ?꾨뱶瑜?李얜뒗?? **KR_STOCK_DB??肄붾뱶媛 KEY??援ъ“**(`'103140': {mcap,name,price,sector,themes}` ??198 entries, 媛믪뿉 .code ?놁쓬). ?ш?媛 媛믩쭔 ?먯깋?섍퀬 6?먮━ KEY瑜???遊먯꽌 0媛?異붿텧. primary 寃쎈줈(L8877 `Object.keys(KR_STOCK_DB)`)???뺤긽?대씪 ?쇰컲 ?ъ슜????蹂댁?怨? **deepest ?대갚 tier?먯꽌留?silent 臾대젰??*.
- **?섏젙**: `_aioCollectKrCodes` 媛앹껜-???ш? 遺꾧린??`if (/^[0-9]{6}$/.test(k)) allCodesFlat.push(k)` 異붽? ??肄붾뱶-??媛앹껜 吏곸젒 ?섏쭛. ?쇱씠釉?寃利? 0 ??**198媛?*(= Object.keys ?꾩껜), ?꾨? 6?먮━.
- **洹쇰낯??*: ?⑥닚 ?곗씠?곌컪???꾨땲??**fetch ?대갚 泥댁씤??二쎌? tier** ???ъ슜?먭? "?꾨꼍?" ?뺣컯?쇰줈 ???먯껜 audit???꾩슦寃??덇퀬, 洹?audit???щ엺 ?덉뿉 ??蹂댁씠??肄붾뱶 寃고븿??surfacing. ?곗씠???뺥솗???ъ씠?댁씠 肄붾뱶 寃고븿 諛쒓뎬濡??댁뼱吏??щ?.
- **violated_rule**: ?놁쓬 (?좉퇋 踰꾧렇). R15(?곗씠??誘몄닔??泥섎━) ?곗옣 ???대갚 tier 臾닿껐??
- **prevention**: T687 ?뚭?(肄붾뱶-??媛앹껜 異붿텧 ??100). 肄붾뱶-??援ъ“ ?곗씠??KR_STOCK_DB瑜? ?쒗쉶 ??KEY媛 ?앸퀎?먯씤吏 ?뺤씤. `recordDataQualityIssue` 寃쎄퀬??getAutoOpsReadiness??吏묎퀎?섎?濡?二쇨린??`getDataQualityIssueAudit()` ?먭?. ??**P461?먯꽌 ??"二쇨린???먭?"???먮룞??push)??**

## P461 쨌 v49.96 쨌 ?щ컻諛⑹? audit??pull-only ??吏?띿슫??以??먮룞?쇰줈 ???몃┝ (push ?덉씠???좎꽕)

- **利앹긽**: ?ъ슜??"?곗씠???묒뾽?섎㈃??洹쇰낯 蹂닿컯+?щ컻 諛⑹?源뚯? ???덈굹?" ?뚭퀬 ?먭? ??grep ?뺤씤 寃곌낵 runTests쨌getAutoOpsReadiness쨌getDataQualityIssueAudit 紐⑤몢 **?먮룞 ?ㅽ뻾/寃쎄퀬 push 0嫄?* (肄섏넄 ?섎룞 ?몄텧 ?꾩슜). ?곗씠??fetch??REFRESH_SCHEDULE濡??먮룞(push)?몃뜲 **?덉쭏/drift audit? pull-only**. P460(異붿텧 0 寃고븿)??audit???덉뿀?쇰굹 ?댁쁺?먭? ?섎룞 ?먭????뚭퉴吏 臾삵? ?덉뿀??
- **?먯씤**: v49.24~96?먯꽌 audit ?⑥닔瑜?25+媛?留뚮뱾?덉쑝??紐⑤몢 "?꾩슂????肄섏넄?먯꽌 ?몄텧" ?ㅺ퀎. 吏???댁쁺(5紐??숈떆?묒냽, ?대씪?댁뼵???ъ씠?? ?쒕쾭 cron 遺덇?) ?섍꼍?먯꽌 ?댁쁺?먭? 留ㅻ쾲 肄섏넄???먮뱶由ъ? ?딆쑝硫??щ컻諛⑹? 媛?쒓? ?좊뱾???덉쓬 = ?щ컻諛⑹???留덉?留?鍮덉뭏.
- **?섏젙**: `_aioAutoSurfaceOps()` ?좎꽕 ??`aio:liveQuotes`(?쇱씠釉?fetch留덈떎)??throttle(30遺? ?곌껐 ??getAutoOpsReadiness + 誘몃윭 + ?곗씠?고뭹吏?audit ?먮룞 ?ㅽ뻾 ??warn ??console.warn(?댁쁺 吏꾨떒) + `window._aioLastOpsWarn` + ?ъ씠?쒕컮 ?꾩젽 badge 媛깆떊. 4珥?吏??+ try/catch濡?遺???덉쟾 媛?? ?붾뱶?좎? ?앹뾽 ?꾨떂. T688 ?뚭?.
- **洹쇰낯??*: "audit??留뚮뱺??(pull)?먯꽌 "audit???ㅼ뒪濡??댁쁺?먯뿉寃??뚮┛??(push)濡????щ컻諛⑹? 泥좏븰???꾩꽦. ?곗씠???묒뾽??吏꾩쭨 留덉?留???移?
- **violated_rule**: R185 ?좉퇋 (?щ컻諛⑹? audit? push ?섎Т). R184/R55 ?곗옣.
- **prevention**: ?좉퇋 audit 異붽? ??getAutoOpsReadiness 吏묎퀎 + (warn 媛移??덉쑝硫? _aioAutoSurfaceOps 寃쎈줈 ?ы븿. `typeof _aioAutoSurfaceOps === 'function'` + 由ъ뒪???깅줉 T688 寃利?

## P462 쨌 v49.97 쨌 泥??묒냽 ?湲?UX 遺??+ ???듭떖?댁뒪 ?곴뎄怨듬갚 (濡쒕뜑 吏꾪뻾瑜좏솕 + ?숈쟻 ?댁뒪猷?

- **利앹긽**: ?ъ슜??"(1) ?덈줈怨좎묠 ???꾩껜 ?곗씠??理쒖떊?붿뿉 ?쒓컙 嫄몃━?붾뜲 寃뚯엫 ?묒냽???湲곗갹???꾩슂 (2) 釉뚮━???쒖옣?듭떖?댁뒪媛 ?꾩쭅 遺??. 吏꾨떒: ??遺??濡쒕뜑(v49.88)媛 "?섏떊 以? ?⑥닚 諛곕꼫濡?吏꾪뻾 ?곹솴 ??蹂댁엫. ????`renderHomeFeed`媛 ?뺤쟻 `HOME_WEEKLY_NEWS` 3嫄댁씠 72h 留뚮즺?섎㈃, ?숈쟻 RSS items媛 ?덉뼱??(a) ?덈궡臾몃쭔 ?꾩슦嫄곕굹 (b) `score >= 90` ?꾪꽣????嫄몃젮 鍮?梨?return ???듭떖?댁뒪 ?곴뎄 怨듬갚.
- **?먯씤**: ??濡쒕뜑媛 泥?`aio:liveQuotes` 1?뚮쭔 蹂닿퀬 ?ル뒗 binary ?ㅺ퀎 ??臾댁뾿???쇰쭏???붾뒗吏 誘명몴?? ???뺤쟻 ?곗꽑 ??留뚮즺 ???숈쟻 ?댁뒪猷?寃쎈줈媛 ?딄꺼 ?덉뿀怨?L7138 else-if媛 ?덈궡臾몄뿉??return), ?숈쟻 寃쎈줈??90???⑥씪 ?꾧퀎媛믪씠???됰쾾???댁뒪??0嫄?
- **?섏젙**: ??遺??濡쒕뜑瑜??듭떖 5媛??쒖꽭쨌?щ━쨌?쒖옣??룸돱?ㅒ룸??숈꽦) 吏꾪뻾瑜?異붿쟻?쇰줈 援먯껜 ??`_lastFetch` ??꾩뒪?ы봽 ?대쭅 ??`N/5` 移댁슫??+ 吏꾪뻾諛?+ ?꾩갑 ??ぉ 泥댄겕, ?듭떖 ?쒖꽭 ??4珥??섎뱶罹?15珥??먮룞 ?リ린, ?먮┛ ?뚯뒪 諛깃렇?쇱슫?? ??`renderHomeFeed` ?뺤쟻 留뚮즺 ???숈쟻 items濡??먮룞 ?댁뒪猷?+ score ?④퀎???꾪솕(90??0??0). ?쇱씠釉?寃利? 濡쒕뜑 `1/5`?믪옄?숇떕?? ?덈돱???댁슜 ?쒖떆, 肄섏넄 ?먮윭 0. T689 ?뚭?.
- **violated_rule**: R186 ?좉퇋 (吏꾪뻾瑜?濡쒕뜑 + ?뺤쟻 留뚮즺 ???숈쟻 ?댁뒪猷?. R57(?뺤쟻 stale) ?곗옣.
- **prevention**: ?뺤쟻 ?먮젅?댁뀡 肄섑뀗痢좊뒗 留뚮즺 ????긽 ?숈쟻 ?대갚 寃쎈줈 ?뺣낫 + ?⑥씪 ?꾧퀎媛??꾪꽣???④퀎???꾪솕. 泥??묒냽 ?숆린?붾뒗 吏꾪뻾瑜?媛?쒗솕. T689.

## P463 쨌 v49.98 쨌 醫낇빀 5?섏씠吏 吏꾩엯 ??stale ?몄텧 ??on-enter 利됱떆 媛깆떊 遺??(留ㅻℓ ?듭떖 ?섏씠吏)

- **利앹긽**: ?ъ슜??"醫낇빀 5?섏씠吏???ㅼ젣 留ㅻℓ ?듭떖?대땲 ?먮룞 理쒖떊??媛뺣젰 蹂닿컯, 理쒖떊 ?쒖옣 紐⑤몢 諛섏쁺". 吏꾨떒: REFRESH_SCHEDULE??二쇨린(?쒖꽭 3遺꽷룸툕?덈뱶???щ━ 10遺꽷룸돱??45遺?濡쒕쭔 ?뚭퀬, `aio:pageShown` hook? **?뚮뜑留?* ?섍퀬 fetch 媛뺤젣????????留ㅻℓ?쒓렇???쒖옣???섏씠吏 吏꾩엯 ??吏곸쟾 二쇨린媛 ???뚯븯?쇰㈃ 理쒕? 10遺?stale???곗씠?곕줈 留ㅻℓ ?먮떒.
- **?먯씤**: ?섏씠吏 吏꾩엯怨??곗씠??媛깆떊??遺꾨━. visibilitychange(??蹂듦?)??stale 媛깆떊???덉뿀?쇰굹, **SPA ???섏씠吏 ?꾪솚(showPage)??on-enter 媛깆떊 ?몃━嫄곌? ?놁뿀??*.
- **?섏젙**: `AIO_PAGE_REFRESH_MAP`(5?섏씠吏?믪쓽議??쒖뒪?? + `_aioRefreshPageData(pageId)` ??`aio:pageShown` 援щ룆??吏꾩엯 ???섏〈 ?쒖뒪?ш? 쩍interval 珥덇낵 stale?대㈃ `_runScheduledTask` 媛뺤젣 ?몄텧. fresh硫??ㅽ궢 + `_inFlight` 媛??+ per-task 30珥??붾컮?댁뒪 + `_schedulerPaused` 議댁쨷?쇰줈 ?몄텧 ??＜/以묐났 李⑤떒.
- **violated_rule**: R187 ?좉퇋 (留ㅻℓ ?듭떖 ?섏씠吏 on-enter stale 媛깆떊 ?섎Т). R21(?곗씠??寃쎄낵?? ?곗옣.
- **prevention**: 留ㅻℓ 吏곴껐 ?섏씠吏??吏꾩엯 ???섏〈 ?곗씠???좎꽑???뺤씤 ??stale?대㈃ 利됱떆 媛깆떊. ?좉퇋 ?듭떖 ?섏씠吏 異붽? ??AIO_PAGE_REFRESH_MAP ?깅줉. `AIO.getPageRefreshCoverageAudit()`濡?DOM/留ㅽ븨/refresh hook ?꾩쟾?깆쓣 異붽? 寃利? T690~T691.

## P481 쨌 v50.6 쨌 Breadth participation??200?쇱꽑 ?ъ쑀??(5/20/50留?蹂대뒗??200 ?쒖떆+濡쒖쭅 ?붿〈)

- **利앹긽**: ?ъ슜??"Breadth??5?셋?0?셋?0?쇱꽑 3媛쒕줈 蹂대뒗?????먭씀 200?쇱꽑???ㅼ뼱媛?붿?? ?踰덉뿉 ?섏젙?덉쓣 ?먮뜲". breadth 硫붿씤 ?섏씠吏???대? 5/20/50 3移대뱶??쇰굹, signal ?뺤쟻吏꾨떒 ?띿뒪??"??쨌 200SMA 55%"), breadth ?섏씠吏 "怨⑤뱶?щ줈??鍮꾩쑉(50>200 醫낅ぉ%)" 移대뱶, ?먯닔 ?쇰꺼("200SMA Above"), DATA_SNAPSHOT.breadth200sma ?쒕뱶??200?쇱꽑???붿〈.
- **?먯씤**: ??breadth participation(醫낅ぉ??200?쇱꽑 ??鍮꾩쑉)怨?trend(吏??媛寃?vs 200MA)??援щ텇 遺?щ줈, 怨쇨굅 遺遺??쒓굅媛 ?쒖떆 ?쇰?留??먮?怨??쒕뱶/?쇰꺼/蹂꾨룄 移대뱶瑜??④?. ??`window._breadth200`???덇굅??misnomer(?ㅼ젣 20?쇱꽑 breadth=bpSPX20)?몃뜲 ?먯닔 ?쇰꺼? "200SMA Above"濡??섎せ ?쒓린 ??200???곗씠?곗쿂??蹂댁엫.
- **?섏젙**: ?쒖옣 ??breadth) = 5/20/50?쇱꽑留뚯쑝濡??뺤젙. signal ?뺤쟻吏꾨떒 200 ?쒓굅, 怨⑤뱶?щ줈??移대뱶 ?쒓굅, `breadth200sma` ?쒕뱶+alias+applyDataSnapshot 留ㅽ븨 ?쒓굅, ?먯닔 ?쇰꺼 "200SMA Above/蹂댁“" ??"?쒖옣 ??20?쇱꽑"?쇰줈 ?뺤쭅?? `_fallback.breadth200`? 20?쇨컪(57)?쇰줈 ?뺥빀. 200?쇱꽑? 異붿꽭 ?먮퀎(Weinstein Stage, 媛寃?vs 200MA)?먮쭔 ?좎?. T324/T325 ?꾪뻾??+ T768 ?좉퇋(200 ?ъ쑀??諛⑹? 媛??.
- **violated_rule**: R57(?뺤쟻 stale) ?곗옣 + breadth ?뺤쓽 ?쇨??? P481 ?좉퇋.
- **prevention**: "?쒖옣 ??breadth participation)=5/20/50?쇱꽑" ?⑥씪 ?뺤쓽 ?뺤젙. 200?쇱꽑? 異붿꽭 ?꾩슜. T768??breadth200sma ?쒕뱶/移대뱶/吏꾨떒 遺?щ? ?뚭? 寃利? breadth 愿???좉퇋 肄붾뱶??5/20/50留??ъ슜.

## P510 쨌 v50.78 쨌 Runtime contract drift after UI redesign

- **symptom**: v50.77 UI redesign looked visually improved, but runtime contracts were broken underneath: `index.html` still loaded JS with `?v=50.75`, `aio-chat.js` still referenced `_aioCreateVisualReport` after that function had been removed, and `public-data/user-research-digest.json` existed without a runtime consumer.
- **root_cause**: The redesign removed fake/premium-looking UI correctly, but also removed real integration hooks and did not re-run the full R1/version/cachebuster and AI tool-contract checks. External research artifacts were treated as static documentation instead of a data pipeline that must be loaded, labeled, and consumed.
- **fix**: v50.78 synchronized all cachebusters/version surfaces, restored `_aioCreateVisualReport`/download canvas output as a data-backed report helper, added `AIO.loadUserResearchDigest()` + `AIO.applyUserResearchDigestPayload()` + `AIO.getUserResearchPipelineAudit()`, and routed imported research into `_getImportedResearchContext()` as `sourceKind=REFERENCE` data-only context.
- **violated_rule**: R1 version synchronization and the data-refresh contract: produced artifacts must be consumed or explicitly retired. AI prompt/tool contracts must be checked after removing UI/functionality.
- **prevention**: Add regression coverage for imported research pipeline consumption, visual report availability, cachebuster sync, and v50.77 metric strip/table UI. Do not remove a runtime callable merely because a surrounding UI looked excessive; first find every prompt/test/page reference.

## P511 쨌 v50.79 쨌 Notes without gates allowed repeated regressions

- **symptom**: Similar problems kept recurring despite many postmortems: user research files were generated but not consumed, AI prompts referenced removed functions, and version/cachebuster drift reached the browser.
- **root_cause**: Lessons were recorded as text but not promoted into executable gates. The system had many audits, but no focused runtime/share-readiness contract for prompt-callable, digest-consumer, fake-UI, and cachebuster coherence.
- **fix**: Added `AIO.getRuntimeContractAudit()`, `AIO.getShareReadinessAudit()`, deployment/auto-ops wiring, `scripts/ci-runtime-contract-check.mjs`, and T844. The completion definition is now page/AI/audit/CI consumption, not file creation.
- **violated_rule**: R218 newly added. Existing R1 and data-refresh artifact-consumption principles were not sufficiently enforceable.
- **prevention**: Any future edit touching AI, imported research, visual reports, cachebusters, or shareability must pass `ci-runtime-contract-check` and browser runtime/share audits before being called done.

## P512 쨌 v50.88 쨌 Trading logic contract drift and aggressive entry wording

- **symptom**: Deep trading inspection found that `computeTradingScore()` returned `total` while several consumers read `.score`, causing some sections to fall back to 50. `classifyMarketRegime()` used an optimistic breadth fallback of 75 when breadth was unavailable. Ticker deep analysis could say ?쒕ℓ???좏샇/?뤴?from chart-only logic without checking market score, and the event-risk context was still anchored to 2026-06-09 CPI/FOMC runway.
- **root_cause**: Prior edits added decision headers, diagrams, and audit helpers, but did not fully trace the real function return contracts and downstream consumers. Trading terminology was treated as UX copy, even though it changes user behavior. Static event context had a freshness audit, but the sell-pressure/blowoff engine still consumed stale context until a deeper function-level review.
- **fix**: `computeTradingScore()` now returns `score: total`; `classifyMarketRegime()` uses live/snapshot/neutral breadth fallback instead of default 75; `getScoreAdvice()`, signal decision copy, conclusion bars, and `analyzeTickerDeep()` use softer action labels and market-score gating; `AIO_EVENT_RISK_CONTEXT` is refreshed to 2026-06-19 post-FOMC/Hormuz watch.
- **violated_rule**: R1/R57/R218 class failure. Function contracts and stale event context must be tested, not only documented.
- **prevention**: `scripts/ci-runtime-contract-check.mjs` now checks the total/score alias contract, bans optimistic breadth default 75, rejects aggressive ?쒖쟻洹?留ㅼ닔??wording in `getScoreAdvice()`, verifies ticker analysis uses `computeTradingScore('swing')`, and verifies event context is 2026-06-19 post-FOMC/Hormuz.

## P553 · v51.82 · Home score inconsistency between decision header and score gauge

- **symptom**: Live production check (full-site audit) found the home page showing two different trading scores at the same instant: the "오늘 결론" decision header read 52 while the "매매 점수 분해" gauge/card directly below it read 64 — a 12-point gap large enough to flip the buy/neutral verdict label. Reproduced repeatedly across multiple page loads over several minutes.
- **root_cause**: `computeTradingScore()` is a non-memoized function of live mutable globals (`window._liveData`, `window._lastFG`, `window._breadth200`, `window._putCallRatio`, news sentiment, etc.) with 16+ independent call sites. The decision header (`_aioDefaultDecision` → rendered via `_aioRenderPageDecisionHeader`) is re-triggered only by `aio:liveQuotes`/`aio:pageShown`, while the home gauge/card (`refreshHomeDashboard`) is re-triggered by `aio:marketStateUpdated`/`aio:pageShown`/internal timers — two independent, uncoordinated event streams. Each recomputes the score fresh from whatever live inputs exist at that instant, so the two surfaces drift apart and never resynchronize on their own.
- **fix**: Added a 20s TTL cache inside `computeTradingScore(mode)` keyed by mode (index.html) so any calls within a normal glance/interaction window return the identical cached result object. Additionally, `refreshHomeDashboard()` now force-calls `window._aioRenderPageDecisionHeader('home')` immediately after computing a fresh score (js/aio-data.js), so the header is always re-rendered in lockstep with the gauge instead of waiting on its own independent event trigger.
- **violated_rule**: New R244 — any value computed by a non-deterministic/live-state function and displayed in more than one UI surface must either share one cached computation per refresh cycle or be re-rendered together from a single trigger. Independent per-surface recomputation of the same "current score" is prohibited.
- **prevention**: `ci-runtime-contract-check.mjs` should assert `computeTradingScore` has cache/memoization guards (grep for `_aioScoreCache`) and that `refreshHomeDashboard` calls `_aioRenderPageDecisionHeader` in the same pass. Any future "same number shown twice" bug class should check event-trigger parity between the surfaces first.

## P554 · v51.82 · Home "핵심 뉴스" permanently stuck on [번역 대기] for the exact items it boosts

- **symptom**: Live site check found the home page's "핵심 뉴스" (top-3 boosted news) section showing `[번역 대기] 지정학 · WSJ 기사 · 중요도 62`-style untranslated placeholder titles for all 3 sampled items, persisting unchanged across 5+ minutes and multiple reloads — never converging to real Korean titles despite the site's Claude-backed translation/chat pipeline working correctly elsewhere (verified live via AI chat).
- **root_cause**: `renderHomeFeed()` selects its 3 headline items via a `_homeBoost` score that deliberately promotes Tier-1/geopolitical/macro sources — a selection independent of the news array's original fetch order. But eager translation (`autoTranslateNews(newsCache.slice(0,6))`, called once on load) only covers the first 6 items *in fetch order*, and the remaining lazy-translation path (`initLazyNewsTranslation`'s `IntersectionObserver`) only watches elements carrying `data-news-idx`, which the compact home-feed markup never sets. The result: whichever items get boosted enough to appear in "핵심 뉴스" — precisely the ones meant to matter most — have no translation trigger at all unless they also happen to land in the first 6 fetched items.
- **fix**: `renderHomeFeed()` (js/aio-data.js) now checks its final selected `filtered` (top-3) items against `_tcHas(title)` and, for any not yet cached, immediately calls `autoTranslateNews()` on just those items (guarded by `_translationInProgress` to avoid overlapping batches). `autoTranslateNews` already re-invokes `renderHomeFeed` on completion, so the section self-corrects once translation lands.
- **violated_rule**: New R245 — any content-selection algorithm that reorders/prioritizes items (boost, rank, score) must not assume upstream enrichment (translation, enrichment, scoring) was applied in the original fetch order. Prioritized display and prioritized processing must use the same priority.
- **prevention**: `ci-runtime-contract-check.mjs` should verify `renderHomeFeed` contains a `_tcHas`/`autoTranslateNews` catch-up call. Any future "boosted/reordered subset of a list" feature should be audited for whether the items it surfaces are guaranteed to have already run through required enrichment steps.

## P555 · v51.82 · CI failure rate (33% of last 30 runs) traced to unrelated commits inheriting a pre-existing version-sync break

- **symptom**: `gh run list` showed the `CI` workflow failing on 10 of the last 30 runs. Several failures were on commits titled "Update operator-note.json" — a pure daily-note content edit with no version-related content at all.
- **root_cause**: `git show` on the failing commits confirmed they were authored directly by the repo owner (`ysnle`) via GitHub's single-file web editor, editing only `public-data/operator-note.json`. GitHub Pages (`build_type: legacy`) deploys every push to `main` regardless of CI outcome, so when an earlier commit landed an incomplete/partial R1 version bump (version.json bumped but APP_VERSION/cachebusters not yet, or vice versa), `main` stayed in a broken version-sync state until someone pushed a fix — and *every* commit landing in that window, including unrelated content edits, inherited the CI failure (and was already live via Pages) even though it did not cause the drift.
- **fix**: `ci-version-check.mjs` now prints a direct one-line remediation command (`node scripts/bump-version.mjs <version>`) on failure, so whoever sees the failure email — including someone with no R1 context — can fix the actual break in one step rather than needing to diagnose which of the 7 locations is out of sync.
- **violated_rule**: New R246 — version-bump commits must land all 7 R1 locations atomically in one push; `main` must never be pushed in a partially-bumped state, because unrelated subsequent commits (including simple content edits made via the GitHub web UI) will inherit the CI failure, and the broken state is simultaneously live in production (Pages deploys independent of CI status).
- **prevention**: Before pushing any version bump, verify all 7 locations changed in the same commit (diff review, not just running `bump-version.mjs` and trusting it). If CI failure is observed on a commit that provably could not have caused version drift (e.g. `git show` touches only unrelated files), treat it as a signal that an earlier commit on `main` is still broken and fix that commit's state first, rather than treating each failure as independent.

## P556 · v51.82 · "jsDelivr CDN 실패" warning fires on essentially every page load — false positive, not a real CDN outage

- **symptom**: Live console check showed `[AIO] jsDelivr CDN 실패 — cdnjs 폴백 로드` firing on every single page load observed across a multi-minute session — a 100% "failure" rate against jsDelivr, a well-provisioned major CDN, which is itself a strong signal that this is not a genuine network reliability issue.
- **root_cause**: `chart.umd.min.js`/DOMPurify/lightweight-charts are loaded via `<script defer src="...">`, meaning they intentionally do not execute until the entire document has finished parsing. But the `typeof Chart === 'undefined'` fallback-detection check and the `installChartFallback()` stub-installer ran as a plain synchronous inline `<script>` placed right after those tags — which executes immediately at parse time, long *before* any deferred script has had a chance to run. The check was therefore testing a premature, always-false state rather than the real outcome, so it always concluded jsDelivr had failed and always loaded a redundant duplicate copy from cdnjs, regardless of whether jsDelivr actually succeeded.
- **fix**: Wrapped both the cdnjs-fallback-loader and the crude-stub installer in `document.addEventListener('DOMContentLoaded', function() {...})` (index.html), which always fires after every `defer`red script has executed, so the check now reflects the real, settled state. Verified `Chart.` usage in aio-ui.js occurs only inside functions invoked later (e.g. via page-lifecycle hooks), never at module top-level, so no code path could regress from this timing change.
- **violated_rule**: New R247 — CDN/script load-failure detection must use the script's own `onerror` handler or be deferred to `DOMContentLoaded`/`load`, never a synchronous inline check placed after a `defer`red `<script src>` tag, since `defer` scripts do not execute until after the entire document has parsed.
- **prevention**: Any future CDN fallback pattern should be checked for this exact race: "does the detection code run before the thing it's checking could possibly have loaded?" A 100%-reproducible "failure" against a major, generally-reliable third-party CDN should be treated as a strong signal of a local timing/logic bug before investigating external causes.

## P557 · v51.82 · GitHub Pages deployed live regardless of CI outcome — broken pushes went live

- **symptom**: `gh api repos/ysnle/aio-screener/pages` showed `build_type: "legacy"` (branch: main, path: /) — GitHub's legacy Pages mode, which republishes whatever is on `main` the instant it's pushed. Cross-referenced against `gh run list`, 10 of the last 30 `CI` workflow runs had failed, meaning some fraction of those broken pushes were live on the production site for however long it took someone to notice and push a fix, with no gate in between.
- **root_cause**: The repo was set up with GitHub Pages' original "deploy from a branch" mode, which predates (and is unaware of) the `CI` workflow entirely — there was never a dependency wired between the validation job and the actual deployment step, because legacy Pages deployment isn't a workflow job at all.
- **fix**: Switched Pages `build_type` to `workflow` via the API (`PUT /repos/{owner}/{repo}/pages`, `build_type=workflow`) and added a `deploy` job to `.github/workflows/ci.yml` with `needs: validate`, so it only runs — and only then actually calls `actions/deploy-pages` — if every check in `validate` passed. A failed push now simply does not update the live site instead of deploying a known-broken state. The new job stages the artifact with `rsync --exclude='.*' --exclude='_*'` to exactly reproduce the dot/underscore exclusion Jekyll silently applied under the old legacy mode (so `_context/`, `.github/`, `.claude/`, etc. remain unpublished — no new public exposure was introduced by this migration).
- **violated_rule**: New R248 — any CI/quality gate that exists specifically to prevent bad states from reaching users must actually be wired to the deployment mechanism, not merely run alongside it. A validation workflow that cannot block a deploy is a report, not a gate.
- **prevention**: After any future change to `.github/workflows/ci.yml`, verify the very first push confirms the `deploy` job actually ran and `gh api repos/{owner}/{repo}/pages` still shows `build_type: "workflow"`. If a change to `validate` ever needs `continue-on-error`, treat that as a signal to reconsider whether it still belongs in the same job as `deploy`'s dependency.

## P558 · v51.83 · Telegram feed XSS — raw external content inserted into innerHTML on 9 pages

- **symptom**: A full-site diagnostic sweep (4 parallel agents covering all 22 pages + code patterns + data pipeline + security) found that `_aioProcessTelegramItem()`/`_aioRenderTelegramFeedHtml()` built `hlHeadline`/`body`/ticker labels from raw `it.text` (scraped public Telegram channel posts) with no `escHtml`, and inserted the result directly into `innerHTML` on every page that renders this feed (home, briefing, signal, breadth, sentiment, technical, macro, fxbond, market-news — 9 total). The `<a href>` wrapping each card also inserted `it.url` raw, bypassing the `escUrl` scheme filter every other news-link renderer in the app already used.
- **root_cause**: This renderer was written independently of the six standard news-card renderers (which correctly wrap `title`/`source`/`summary` in `escHtml` and `link` in `escHtml(escUrl(...))`), and never got the same treatment. Content source (public Telegram channels the operator does not control) makes this a real, not theoretical, injection vector — a post containing `<img src=x onerror=...>` would execute for every visitor of any of the 9 pages.
- **fix**: `escHtml()` now wraps the raw text at the single point it enters `_aioProcessTelegramItem()` (js/aio-data.js), so headline highlighting, body extraction, and ticker-label fallback all operate on already-safe text — fixing every downstream consumer at once instead of patching each render call site. The ticker-label fallback (`_TG_KR_NAME[tk] || tk`) and the card's `<a href>` (`it.url`) are now separately wrapped in `escHtml`/`escHtml(escUrl(...))` matching the codebase's existing convention. Verified the sibling `_aioRenderTgDigestBrief()` renderer already escaped correctly and did not need this fix.
- **violated_rule**: New R249 — any renderer that inserts externally-sourced text (RSS/API/scraped/user-supplied) into `innerHTML` must escape at the point the raw text enters the processing pipeline, not rely on each render call site remembering to do it. New data sources (a new scraper, a new external feed) must be checked against this before their first render path ships.
- **prevention**: `ci-runtime-contract-check.mjs` should grep for `it.text` / `it.url` reaching `innerHTML` in `_aioProcessTelegramItem`/`_aioRenderTelegramFeedHtml` without an `escHtml`/`escUrl` call in between. Any future externally-sourced feed renderer should be diffed against this incident before being considered complete.

## P559 · v51.83 · P553 score-mismatch bug class recurred on the signal page (mode mismatch, not timing)

- **symptom**: A full-site diagnostic sweep found the signal page reproducing the same "two visible surfaces show different trading scores at once" defect that P553 fixed on the home page — except the mechanism was different from what a copy-paste home-page fix would have addressed.
- **root_cause**: `refreshSignalDashboard()` (index.html) calls `computeTradingScore('swing')` (via `_signalMode = 'swing'`), while the shared decision header — built by `_aioDefaultDecision()` for every page including signal — always called `computeTradingScore()` with no argument. Since the P553 TTL cache added to `computeTradingScore()` is keyed by `mode || 'default'`, `'swing'` and `'default'` are separate cache entries computed independently, so the two surfaces could disagree even inside the cache window. The same mismatch applies to the ticker page, whose Minervini technical engine also calls `computeTradingScore('swing')`.
- **fix**: Added `AIO_PAGE_SCORE_MODE = { signal: 'swing', ticker: 'swing' }` (js/aio-core.js) and made `_aioDefaultDecision(pageId)` look up and pass the page's canonical mode into `computeTradingScore()`, so the header always requests the identical mode the page's own dashboard/engine uses. Also added the same force-re-render-header-on-refresh call used in refreshHomeDashboard to `refreshSignalDashboard()` (index.html), since signal has its own 45s timer that could otherwise still drift from the header's independent trigger.
- **violated_rule**: R250 (extends R244) — a shared, page-agnostic renderer (the decision header, used by all 22 pages) that calls a parameterized live-state function must resolve the SAME parameters/mode a given page's own dashboard uses for that page, not a single hardcoded default. Any future page-specific mode must be registered in `AIO_PAGE_SCORE_MODE`, not hardcoded ad hoc.
- **prevention**: Before adding any new `computeTradingScore(someMode)` call site, check it against `AIO_PAGE_SCORE_MODE` and add an entry if that page also renders the shared decision header (which is every page). `ci-runtime-contract-check.mjs` should verify `AIO_PAGE_SCORE_MODE` exists and that `_aioDefaultDecision` reads it.

## P560 · v51.83 · Fundamental page showed impossible/self-contradicting financial data (4 separate root causes)

- **symptom**: The 기업 분석 (fundamental) page, searched for AAPL, showed: net income larger than revenue; Gross Margin at 310% (impossible, >100%); the "매출" card labeled "FY 2018" (8-year-stale) as the headline revenue figure; "시가총액: N/A" directly next to a live, non-null price; and — on the same page — the pinned AAPL preview card showing "P/E: — ROE: — EPS: $— MCap: $—" while the just-searched AAPL section below showed real P/E 38.8x/ROE 151.9%/EPS $7.46.
- **root_cause (4 independent bugs, same page)**:
  1. `extractSeries()` in `_parseSECFinancials()` (js/aio-chat.js) returned on the FIRST XBRL concept-name alias that had ANY data, not the most current one. Apple stopped reporting under the `Revenues` tag around its 2018 ASC-606 transition, moving to `RevenueFromContractWithCustomerExcludingAssessedTax` — but the old tag still has historical entries, so the stale tag was always picked first, explaining the "FY 2018" label.
  2. The same function never validated that annual (`10-K`) facts actually spanned a full year, so a stray quarterly/stub-period fact tagged under a 10-K filing could be treated as a full-year figure and paired against a genuinely-annual figure from a different concept — a plausible mechanism for gross margin exceeding 100% and net income exceeding revenue.
  3. `secMktCap` (js/aio-ui.js `_renderFundFinancials`) was computed as `d.price * (d.sharesOut || 0)`, but `d.sharesOut` was never assigned anywhere in the codebase — shares outstanding was never extracted from SEC XBRL at all, so this always multiplied by 0.
  4. A live-quotes event handler (index.html, "Fundamental page live update hook") fully rebuilt `#fund-cards-grid` via `buildFundCard(sym, _fundData[sym])` on every `aio:liveQuotes` tick — but `_fundData` is a module-level object that is never populated anywhere (FMP is unavailable without a paid plan), so this handler silently overwrote the good, hardcoded `FUND_FALLBACK`-sourced numbers `initFundamentalCards()` rendered on page load with all-dashes, moments after the page finished loading.
- **fix**: `extractSeries()` now evaluates every concept-name alias and keeps whichever has the most recent `.end` date, and rejects annual-context facts whose start-end span isn't ~300-400 days. `_parseSECFinancials()` now extracts `sharesOut` from `CommonStockSharesOutstanding` (falling back to the `dei` namespace's `EntityCommonStockSharesOutstanding`), and `_renderFundFinancials()` uses it instead of the never-set `d.sharesOut`. The destructive `aio:liveQuotes` handler was removed entirely rather than fixed-in-place, since there is no live per-ticker fundamentals source to rebuild the cards from, and prices already update through the app-wide generic `[data-live-price]` sink mechanism.
- **violated_rule**: New R251 — (a) when a concept can be reported under multiple historical XBRL tag names, always resolve to the most-recent tag's data, never the first-checked one; (b) annual/quarterly period facts must be validated by actual duration, not just filing form type, before being compared across concepts; (c) never wire a periodic UI-refresh handler to a data source that is not actually populated — verify the source variable is written to somewhere before shipping the consumer.
- **prevention**: `ci-runtime-contract-check.mjs` should verify `extractSeries` picks the most-recent alias (not the first) and that no `aio:liveQuotes`/`aio:pageShown`/interval handler reads a module-level cache object without a corresponding write site existing in the same file set.

## P561 · v51.83 · KR home "Top Gainers" list showed a stock down -3.40% at the top

- **symptom**: The kr-home page's "KOSPI 상위 상승" (Top Gainers) widget showed SK하이닉스 as its first entry while its live change read -3.40% in red — a decliner sitting at the top of a gainers list.
- **root_cause**: This widget is not a dynamically-ranked list at all — it is static, hand-curated HTML (`.kr-screen-card[data-live-symbol]` entries written directly into index.html) with a live price/pct overlay applied per-symbol via `[data-live-chg]`. The live overlay correctly updates each card's displayed percentage and sign as real quotes stream in, but nothing ever re-evaluates whether a card's live sign still matches the section it physically sits in (there is no live-ranked KR-universe feed backing this widget, unlike the main quant screener). Once a stock's live change flips sign after the list was authored, the contradiction is permanent until someone manually re-curates the HTML.
- **fix**: Rather than building a full live-ranked KR top-mover feed (a materially larger feature with no existing live KR-universe data source to drive it), the per-symbol `[data-live-chg]` update loop (js/aio-data.js) now also checks, for any element inside a `.kr-screen-card`, whether the live sign matches its ancestor widget's title ("상승" expects positive, "하락" expects negative). A mismatch adds a `.kr-sign-mismatch` class (index.html CSS) that dims the card and labels it "실시간 부호 반전 — 참고용" so the contradiction is visible and honestly labeled instead of silently presented as fact.
- **violated_rule**: New R252 — a static/curated list overlaid with live per-item data must not silently keep presenting list membership as current fact once the underlying live data contradicts it; flag the contradiction rather than leaving it unqualified.
- **prevention**: Any future static-list-plus-live-overlay widget (KR or otherwise) should be checked for this same class of staleness at authoring time, and should carry the same kind of sign/threshold-mismatch flag before being considered complete.

## P562 · v51.83 · Breadth page 50SMA big-number (48%) contradicted its own bar/readout text (52%)

- **symptom**: The 시장 폭 (breadth) page's "50일선 이상 비율" card showed "48%" as its large number, while the progress bar directly below it was styled to 52% width and the readout sentence read "50일선 52% — 50% 상회(약)..." two lines apart on the same card.
- **root_cause**: `updateBreadthBars()` (js/aio-ui.js) computed the bar width and readout text from `window._breadth50` first, falling back to `DATA_SNAPSHOT.breadth50sma` only if that was unset. `window._breadth50` is derived from a hardcoded, simulated SPY/QQQ historical closing-price array in `initBreadthPage()` (defaulting to 52 before that computation runs), while the big number is rendered by a separate `_snap` binding that reads `DATA_SNAPSHOT.breadth50sma` first. When `breadth50sma` was corrected to 48 in v51.63, nobody regenerated the simulated price array or fixed the priority order, so the bar/readout kept the stale 52-derived value while the big number correctly showed 48 — the same underlying metric, same card, two numbers.
- **fix**: Flipped the priority in `updateBreadthBars()`'s 50SMA block to read `DATA_SNAPSHOT.breadth50sma` first, matching the big number's own priority, falling back to `window._breadth50` only when the snapshot value is unavailable.
- **violated_rule**: R253 (extends R244/R250) — when two DOM elements on the same card are meant to represent the same underlying metric, they must resolve values through the same source with the same priority order, not two independently-ordered fallback chains that can diverge whenever only one of the underlying sources gets updated.
- **prevention**: Any future breadth/technical metric with both a "big number" binding and a separate descriptive-text/bar binding should share one resolver function rather than two independently-written priority chains. `ci-runtime-contract-check.mjs` should flag any pair of `data-snap`/manual-DOM-write bindings targeting the same metric with differently-ordered fallback chains.

## P563 · v51.83 · Mistagged news item drove fabricated-sounding sector analysis in the AI briefing

- **symptom**: A full-site audit found the 오늘의 브리핑 page's top headline tagged 반도체·AI/중요도 64 (Axios) was actually headlined "GOP gets new midterm spending weapon from SCOTUS" (US politics, unrelated to semiconductors) — and the AI briefing wrote confident, specific commentary about TSMC/SK하이닉스/HBM anchored to this mistagged item.
- **root_cause**: `classifyTopic()` (js/aio-data.js) counts keyword hits per topic from the item's own title+desc text, but when that count is 0 for every topic, it fell back to blindly trusting `item.topics[0]` — an unverified, source-provided category (e.g. a broad Axios "Technology"/"AI Policy" RSS section tag) with no guarantee it uses the same vocabulary or applies to this specific article's actual content. Separately, the AI briefing prompt had no instruction to verify a topic tag against the item's actual text before writing topic-specific analysis.
- **fix**: `classifyTopic()` now only accepts the zero-keyword-match fallback tag if it is literally one of `TOPIC_KEYWORDS`'s own keys — otherwise it honestly defaults to `'general'` rather than trusting an external, unverified category name. `_generateAIBriefing()`'s existing evidence-only prompt note (js/aio-data.js) now also includes an explicit "topic-tag caveat" instructing the model to verify any topic-specific claim against the item's own headline/description before writing sector analysis, and to describe what the text actually says if the tag and content disagree.
- **violated_rule**: New R254 — an externally-sourced classification/category tag must not be trusted as ground truth when the app's own classifier found no independent supporting evidence; and any AI prompt that could produce sector/topic-specific analysis from a tagged item must instruct the model to verify tag-content consistency rather than trusting the tag.
- **prevention**: `ci-runtime-contract-check.mjs` should verify `classifyTopic`'s fallback branch checks `TOPIC_KEYWORDS.hasOwnProperty(...)` and that the briefing prompt contains the topic-tag caveat text. Any future feature that lets an AI write specific analysis anchored to a classification label should carry the same caveat.

## P564 · v51.83 · refresh-data.yml pushed with no pull/rebase — a real race already happened

- **symptom**: A data-pipeline audit found `.github/workflows/refresh-data.yml` did a bare `git push` with no `git pull`/`git fetch` beforehand, after two data-fetch steps that can each take minutes. The merge commit `34b9e1a` (two parents: a human/dev commit and this bot's own commit) is direct evidence this race has already occurred — it happened to resolve cleanly by luck (different files touched), but nothing prevented an outright push rejection.
- **root_cause**: `main` is updated both by this bot and independently by humans (e.g. editing `public-data/operator-note.json` via the GitHub web UI) and by other sessions/workflows, while this job's checkout stays fixed for the whole run. A bare `git push` that loses this race fails outright with no retry, silently dropping that cycle's entire data refresh (quotes, F&G, news, screener, Telegram digest) until the next scheduled run 30 minutes later — worse during the ~10% of cycles already running late (P555-adjacent finding: observed gaps up to 280 minutes against a 30-minute nominal cron).
- **fix**: The commit step now retries up to 5 times: on a rejected push, it fetches `origin/main` and rebases before retrying, with a short backoff between attempts. Since this bot only ever touches `public-data/data.json`/`history.json`/`screener.json`/`telegram-digest.json` and no other workflow or human-edited file overlaps those paths, the rebase is expected to always replay cleanly against the confirmed real-world race scenario (an unrelated file changed on main in the meantime).
- **violated_rule**: New R255 — any automated workflow that commits and pushes to a shared branch that is also updated by other actors (humans, other workflows, other sessions) must rebase/retry on push rejection, not push once and silently drop the work on failure.
- **prevention**: Any future scheduled bot-commit workflow should be checked for this same bare-push pattern. If a retry ever exhausts its attempts, the job fails loudly (`::error::`) rather than silently succeeding with nothing pushed.

## P565 · v51.83 · FRED per-series failures were completely silent, unlike the FMP pattern

- **symptom**: A data-pipeline audit found `fetchFred()` (scripts/fetch-data.mjs) caught and discarded any single FRED series' fetch failure with a bare `catch (e) {}` — no log, no field-level flag. Only the aggregate `fredFetchOk` (true if ANY series succeeded at all) was exposed, so a partial failure (e.g. 6 of 9 series succeeding) passed every existing check silently. This is a plausible mechanism behind several manual macro fields (Fed/BOJ/BOK/BOE rates, KR bond/macro) sitting 15-62 days stale with no alert anywhere in the pipeline.
- **root_cause**: `enrichFundamentals()` (FMP) already had the correct pattern — explicit HTTP 403/401 detection, a `planError` flag, and `fmpHasKey`/`fmpOk`/`fmpCount`/`fmpPlanError` all surfaced into `data.meta` and the job-summary table — but this standard was never applied to `fetchFred()` or `fetchNews()`.
- **fix**: `fetchFred()` now collects failing series names into `out._failedSeries` and logs each failure with the series id and error message. `main()` surfaces this as `data.meta.fredFailedSeries`, warns when any series fails (even if `fredFetchOk` is still true overall), and `refresh-data.yml`'s job summary table now shows `WARN` with the failed series list instead of a flat `OK`/`fredFetchOk: yes`.
- **violated_rule**: New R256 — every external data source in the fetch pipeline must follow the same failure-detection standard: explicit per-unit (per-series/per-symbol/per-feed) error tracking surfaced into `meta`, not just an aggregate ok/not-ok flag that a partial failure can silently pass.
- **prevention**: Any future external data source added to `fetch-data.mjs` should be checked against `enrichFundamentals`'s error-detection pattern before being considered complete. `ci-data-pipeline-contract-check.mjs` should verify `fetchFred` populates `_failedSeries` and that it reaches `data.meta.fredFailedSeries`.

## P566 · v51.83 · Ticker recent-search stored self-XSS (no input validation, raw label render)

- **symptom**: A security audit found `_fundRecentSearches()` (js/aio-chat.js) rendered the visible ticker-history label raw while only the `data-arg` attribute was escaped, and `fundamentalSearch()` never validated the ticker input format before persisting it to `localStorage['aio_fund_recent']` — typing an HTML payload into the ticker search box would render unescaped on the next paint.
- **root_cause**: The ticker input box had no charset/format validation at all (`inp.value.trim().toUpperCase()` accepted anything), and the recent-search renderer assumed the persisted value was always a safe plain ticker string.
- **fix**: `fundamentalSearch()` now rejects any input not matching `^[A-Z0-9.\-]{1,12}$` (covers US/KR/class-share ticker formats) before it is persisted or searched, showing a clear error message instead. `_fundRecentSearches()`'s render loop now also wraps the visible label in `escHtml()` as defense-in-depth.
- **violated_rule**: R249 applies again here (escape externally/user-influenced text at the render call site) plus a new input-validation angle — any free-text input that becomes a persisted, later-rendered value should be validated against its expected format at the input boundary, not only escaped at render time.
- **prevention**: Any future free-text input field that gets persisted and later rendered (search history, watchlists, notes) should have both an input-boundary format check and an escaped render path — neither alone is sufficient on its own.

## P567 · v51.83 · Global AI chat panel lacked the DOMPurify defense-in-depth layer the per-page chat has

- **symptom**: A security audit found `_appendAIMsg()` (index.html), used by the global floating AI chat panel, set `bubble.innerHTML = html` directly with no DOMPurify pass — while the separate per-page embedded chat (`_aioSafeMD()`, aio-core.js) deliberately double-gates AI-rendered markdown through DOMPurify (v48.94, P158 XSS defense). No concrete bypass was found (`renderMarkdownLight` already HTML-escapes text before applying its own formatting transforms), but the inconsistency meant one of the app's two chat surfaces was missing a defense layer the other has specifically for handling untrusted content that could reach the model (a news article or web-search result carrying a prompt-injection payload).
- **root_cause**: The global chat panel and the per-page embedded chat were built at different times with different hardening standards; the DOMPurify gate added to one was never retrofitted onto the other.
- **fix**: `_appendAIMsg()` now routes `html` through `window.safeHtml()` (the same DOMPurify wrapper other parts of the app use) before assigning it to `innerHTML`. Verified every call site (~13) only ever passes plain text, `renderMarkdownLight()` output, or simple `div`/`span` status markup with `style`/`class` attributes — all within `safeHtml()`'s allowed tag/attribute set, so no call site regresses.
- **violated_rule**: New R258 — when two surfaces in the app perform the same class of operation (rendering AI-generated content into the DOM), a hardening measure added to one must be checked against the other, not assumed to be surface-specific.
- **prevention**: `ci-runtime-contract-check.mjs` should verify both `_aioSafeMD` and `_appendAIMsg` route through `window.safeHtml`/DOMPurify before any future AI-response rendering path is added.

## P568 · v51.83 · Breadth page price-chart canvas leaked a mouseleave listener on every revisit

- **symptom**: A code-pattern audit found `initBreadthPage()`'s `bp-price-chart` canvas registered a `mouseleave` listener with no removal guard, while the sibling `bp-chart` canvas twelve lines above correctly checked `if (ctx._bpMouseLeave) ctx.removeEventListener(...)` before adding a new one.
- **root_cause**: `initBreadthPage(forceReinit)` re-runs every time the breadth page is (re)visited; the missing guard meant each revisit stacked one more closure-holding listener onto `priceCtx`, unbounded with visit count.
- **fix**: Added the same `if (priceCtx._bpMouseLeave) priceCtx.removeEventListener(...)` guard before registering the new listener (js/aio-ui.js), matching the sibling canvas's existing correct pattern.
- **violated_rule**: New R259 — any canvas/element with a re-registerable event listener inside a function that can run more than once must guard against duplicate registration the same way every time it appears, not just on some instances.
- **prevention**: Any future canvas/chart setup code with a named-handler-for-cleanup pattern should be diffed against its sibling instances for this exact asymmetry.

## P569 · v51.83 · _aioRenderOperatorNote defined three times — two were permanently dead code

- **symptom**: A code-pattern audit found `_aioRenderOperatorNote` (js/aio-data.js) defined three times in sequence (an unlabeled baseline version, a v51.40 version, and a v51.43 version), each followed by its own `window._aioRenderOperatorNote = ...` reassignment.
- **root_cause**: Because `function` redeclarations and their `window.x = ...` exports execute in file order, only the last (v51.43) definition ever took effect — the first two (~50 combined lines) were syntactically valid but permanently unreachable. A fix applied to either of the first two would compile and pass review but have zero runtime effect, since the third definition always wins.
- **fix**: Removed the two dead definitions entirely (js/aio-data.js), keeping only the live v51.43 version.
- **violated_rule**: New R260 — a function must never be redefined more than once at the same scope in the same file; if a newer version supersedes an older one, the older one must be deleted in the same change, not left in place.
- **prevention**: `ci-workflow-compaction-check.mjs` or a dedicated lint pass should flag any function name declared more than once at top-level scope in the same file.

## P570 · v51.83 · Sentiment page showed two different Fear & Greed numbers on the same card

- **symptom**: A full-site audit found the 투자 심리 (sentiment) page's "Fear & Greed Composite" widget showing one number for the big gauge value and a different number one line below in "점수: X/100" — both under the same rating label.
- **root_cause**: `_applyFearGreedScore()` (js/aio-data.js) is documented as the single-responsibility function handling "모든 F&G DOM sink 갱신을 한 곳에서" (all F&G DOM sink updates in one place), but its update list (`big`, `rat`, `homeFG`) omitted `#fg-score-val` — the secondary "점수: X/100" element right below the big number. That element stayed frozen at its static HTML placeholder forever while `#fg-score-big` correctly updated with each live fetch.
- **fix**: Added `#fg-score-val` to `_applyFearGreedScore()`'s update list (text + color) and to its sink-lineage `data-operational-use`/`data-source-kind`/`data-source-label` loop, so both elements are now updated from the exact same function call with the exact same value.
- **violated_rule**: R244/R253 class — a function that documents itself as the single canonical updater for a metric must actually include every DOM sink for that metric; a forgotten sink silently reverts to its static placeholder and never re-syncs.
- **prevention**: Whenever a new DOM element is added to display an existing metric, grep for that metric's canonical updater function and add the element to its sink list in the same change — never assume a sibling element "already gets updated somewhere."

## P571 · v51.83 · Telegram digest scraper had no self-throttle, re-walking the full 14-day window every 30 minutes

- **symptom**: A data-pipeline audit found `scripts/fetch-telegram-digest.mjs` re-scraped up to 50 pages × 3 channels of the full 14-day window from scratch on every scheduled run (every 30 minutes via `refresh-data.yml` — 48x/day), with no cursor or state persisted between runs, unlike `enrichScreener`'s explicit 6-hour self-throttle. This put heavy, largely redundant repeat load on `t.me/s/<channel>` — an unofficial, more fragile surface than Yahoo's API.
- **root_cause**: The script was written as a stateless full-window scan; no mechanism existed to recognize that most of the 14-day window had already been fetched in the previous cycle.
- **fix**: The script now persists a lightweight `lastPostId` cursor per channel in the digest output (`channels[].lastPostId`) and reads it back on the next run. `scrapeChannel()` stops pagination as soon as a page's newest post ID is already `<=` the previous run's cursor, instead of always walking back to the 14-day `since` boundary. Because the digest file only ever persisted capped `topItems`/`broadItems` summaries (not the full raw item list), those two arrays are read back and unioned with freshly-scraped items (deduped by id, re-filtered by the `since`/`until` window) before recomputing `topItems`/`broadItems`, so an early-stopped run does not silently shrink what the app actually consumes.
- **violated_rule**: R256-adjacent — any scheduled scraper/fetcher hitting an external (especially unofficial) surface repeatedly must have a real self-throttle mechanism proportional to how often its underlying content actually changes, not a stateless full re-scan every cycle.
- **prevention**: Any future addition to the fetch pipeline that walks an external paginated feed should be checked for this same stateless-rescan pattern before being considered complete. `ci-data-pipeline-contract-check.mjs` should verify `lastPostId` round-trips through the digest file and that `scrapeChannel` reads `previousLastPostId`.

## P572 · v51.84 · [skip ci] data commits stopped reaching the live site after the deploy became CI-gated

- **symptom**: A full-infrastructure diagnosis (2026-07-02) found the live site's `public-data/data.json` frozen at `generatedAt 2026-07-01T10:14Z` while the repo's main branch held a `23:43Z` refresh — 13+ hours of drift and growing. Every 30-minute `refresh-data.yml` commit since the v51.83 push had landed in the repo but never deployed. Meanwhile the Data freshness watchdog kept reporting success. (2026-07-02 correction: originally said "2-hourly" — cadence has been 30-minute since v50.23; see `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md`.)
- **root_cause**: Two independent decisions composed into a failure. (1) `refresh-data.yml` committed with `[skip ci]` — harmless under the original legacy branch-deploy, which republished main on every push regardless of CI. (2) v51.82 (P557/R248) switched GitHub Pages to a workflow deploy job gated on CI validate — correct in itself, but now `[skip ci]` skipped the **entire** CI workflow including the deploy job, so data commits could no longer publish. Neither change was wrong alone; nobody audited existing commit producers against the new deploy path. The watchdog missed it because it only read committed repo files ("It does not fetch network data" was in its own header comment), so the repo looked fresh while the deployed surface went stale.
- **fix**: (1) Removed `[skip ci]` from the refresh-data commit message — data commits now run CI validate + deploy every cycle (≈1min per run, well within free-tier minutes; validate gating data commits is a safety gain, not a cost). (2) Added a "Check LIVE site freshness" step to `data-watchdog.yml` that fetches `https://ysnle.github.io/aio-screener/public-data/data.json` and fails when `meta.generatedAt` exceeds 360min — catching any future deploy-path breakage within hours instead of never.
- **violated_rule**: R263 (created from this incident).
- **prevention**: When changing a deploy mechanism, enumerate every producer of deployable commits (schedulers, bots, humans via web UI) and verify each still reaches production under the new path. Watchdogs must verify the user-facing surface, not only internal artifacts.

## P573 · v51.85 · 사용자 개인 FRED API 키가 서드파티 CORS 프록시로 평문 전송될 수 있음

- **symptom**: A deep security diagnosis (2026-07-02) traced `fetchFredSeries()` (js/aio-data.js) and found its 3rd-tier fallback sent the request through a third-party CORS proxy (`corsproxy.io` / `allorigins.win` / `codetabs.com`). The URL contains `?api_key=<user's personal FRED key>`, so whenever that fallback fired, the user's key was exposed in plaintext to the proxy operator's logs — without the user's knowledge.
- **root_cause**: `fetchFredSeries` tried (1) the user's own CF Worker, (2) a direct browser call, then (3) `fetchViaProxy`. `api.stlouisfed.org` does not send CORS headers, so a browser's direct call (2) is blocked and control reliably falls to (3). `fetchViaProxy` has an `_isSensitive` flag (matches `api_key=`, etc.), but it only suppresses **caching** of the response — it does **not** stop the request from being sent through the proxy. The flag's name implies protection it does not provide. The `key` passed here is always the user's personal `aio_fred_key`, so tier 3 always leaks a real key when reached.
- **fix**: Removed the tier-3 `fetchViaProxy` fallback from `fetchFredSeries` entirely. Only trusted paths remain: the CF Worker (the user's own domain) and the direct TLS call to FRED. If both fail, the function logs a warning and returns `null`, letting the app fall back to server `data.json` (GitHub Actions already fetches FRED via the `FRED_API_KEY` secret) and static seeds. No real functional loss, and the personal-key leak path is gone. Audited every other keyed API in the same pass: Finnhub/FMP go through `_fetchJson` (no proxy fallback), NewsData.io/rss2json call their own key-owning services directly (CORS-supported), and the `fredgraph.csv` HY-spread path carries no key — all safe.
- **violated_rule**: R264 (created from this incident).
- **prevention**: An API key must never be placed in a URL that is then routed through a third-party proxy the operator does not control. A "sensitive URL" guard must block the actual egress (the proxy send), not merely a downstream side effect like caching. When adding any proxy fallback, check whether the URL being proxied can ever contain a credential.

## P574 · v51.86 · Sortino 하방편차 분모가 표준에서 벗어나 값을 ~46% 과소평가

- **symptom**: A numerical-accuracy audit (2026-07-02) extracted every core finance formula and checked it against independently computed expected values. `_statStdDev`/`_calcSharpe`/`_calcMaxDrawdown`/`_pearsonCorr`/`_calcPortfolioVaR`/`_quantileR7` were all numerically exact. `_aioBtSortino` (js/aio-core.js) was the one outlier: on a 24-month test series it returned 0.83 where the standard definition (used by Portfolio Visualizer, which CLAUDE.md v51.79 explicitly names as the model for this backtest) returns 1.54 — a ~46% understatement.
- **root_cause**: The downside-deviation denominator used the count of *negative* observations minus one (`downside.length - 1`) instead of the *total* number of observations (`N`). Sortino & Price (1994) and every mainstream implementation divide the sum of squared downside excess returns by the full N (so months with no downside still count as zero in the denominator). Dividing by only the negative count inflates the downside deviation by `sqrt(N / n_neg)` and shrinks the Sortino ratio by the same factor — here `sqrt(24/8) ≈ 1.73×` too small on the deviation, ~0.54× on the ratio. This is not a defensible "style choice": the page claims Portfolio-Visualizer parity, so users comparing against that tool get a number roughly half of what they expect.
- **fix**: Changed the denominator from `downside.length - 1` to `excess.length` (= N). The numerator is unchanged (sum of squared negative excess = Σ min(0, excess)²). Verified by extraction: the fixed function now returns 1.539871, matching a from-scratch standard-definition implementation to 1e-9 on the same series.
- **violated_rule**: R265 (created from this incident).
- **prevention**: When code claims parity with a named external tool or methodology (Portfolio Visualizer, a specific paper, an index provider's formula), the implementation must match that source's definition exactly — verified by recomputing a known case, not by "it looks like the right shape." Financial ratios especially have multiple plausible-looking denominators; pick the one the claimed source uses.

## P575 · v51.87 · OPEX(옵션 만기) 표시 날짜가 UTC+ 시간대에서 하루 앞당겨짐

- **symptom**: A deep timezone audit (2026-07-02) found `_aioDataNextOpex()` (js/aio-data.js) reported the monthly options-expiration date one day early for users in UTC+ timezones. Measured: the January 2026 third Friday is 2026-01-16 (Fri), but the function returned `"2026-01-15"` (Thu). daysToOpex (the D-day count) was correct; only the displayed date string was wrong.
- **root_cause**: `_aioDataThirdFriday()` builds the expiry as `new Date(year, monthIndex, day)` — a **local-midnight** Date, correct by construction. But `_aioDataNextOpex()` then stringified it with `next.toISOString().slice(0, 10)`. `toISOString()` converts to UTC, and for any UTC+ offset (KST = UTC+9, the primary audience) local midnight falls on the *previous* UTC day, so the date string shifts back one day. (US-Eastern users, UTC−5, were unaffected — local midnight is still the same UTC day — which is exactly why this kind of bug survives casual testing on a US-timezone machine.)
- **fix**: Format `nextOpexDate` from the Date's **local** calendar components (`getFullYear`/`getMonth`/`getDate`) instead of `toISOString()`, keeping the display on the true local expiry date. daysToOpex was already a local-to-local diff and is unchanged. Verified across 5 months (Jan/Feb/Mar/Jul-rollover/Dec-year-rollover): every result now lands on a real third Friday. Audited the other `toISOString().slice(0,10)` sites in the same pass — all others derive from epoch/UTC timestamps (`Date.now()`, `ts*1000`) or intentional `+9h` KST offsets, or are internal cache keys where consistent-shift is harmless; only this display path was wrong.
- **violated_rule**: none new (timezone-display class). See prevention.
- **prevention**: Never `toISOString()` a Date that was built from local calendar components (`new Date(y, m, d)`) when you want a local calendar date string — the round-trip through UTC shifts the day for non-UTC timezones. Format local Dates with `getFullYear`/`getMonth`/`getDate`, and reserve `toISOString()` for genuine UTC/epoch instants. Test date logic under at least one UTC+ timezone (`TZ=Asia/Seoul`), not only the developer's local zone.

## P576 · v51.88 · 매매 점수의 신용 스트레스 입력이 실측 FRED OAS 대신 듀레이션 오염 HYG 근사를 우선 사용

- **symptom**: A systematic algorithm audit (2026-07-02) traced `computeTradingScore()`'s credit-stress input (`hyBp`, penalties at >350/>400/>500bp). It computed `(100 - HYG price) × 15bp` **first**, and only fell back to reading a DOM element if that approximation returned 0 — even though the app fetches the real FRED HY OAS (BAMLH0A0HYM2) every 6h via `fetchHYSpread()`.
- **root_cause**: `fetchHYSpread()` wrote the measured OAS only to DOM (`#hy-live-val`) and a chart — never to a consumable global or `DATA_SNAPSHOT.hySpread`. So the score function had no measured value to prefer. The HYG-price heuristic is contaminated by rate duration (~3.8y): a 100bp rate rise alone drops HYG ~$3 → fake +45bp of "spread widening" and possible score penalties with zero actual credit stress.
- **fix**: `fetchHYSpread` now stores `window._hySpreadBp`/`window._hySpreadDate` and syncs `DATA_SNAPSHOT.hySpread`. `computeTradingScore` prefers (1) `window._hySpreadBp` live measurement → (2) `DATA_SNAPSHOT.hySpread` seed/server → (3) the HYG approximation only as last resort. Priority logic verified by extraction (live wins over approx; snapshot wins when live absent; approx fires only when neither exists).
- **violated_rule**: R266 (created from this incident).
- **prevention**: When both a measured value and a proxy heuristic for the same quantity exist in the app, the consumer must prefer the measurement; a fetcher that displays a measurement must also store it where downstream logic can consume it.

## P577 · v51.88 · 주봉 컨텍스트가 최신 1~4일을 누락 (앞-앵커 청킹)

- **symptom**: `_calcWeeklyContext()` (js/aio-core.js, v51.69 주봉 패널의 데이터원) chunked daily bars into 5-bar "weeks" with a front-anchored loop (`i = 4, 9, 14, …`). Whenever `bars.length` was not a multiple of 5, the **most recent 1–4 daily bars were silently dropped** (measured: with 63 bars, bars 60/61/62 — the three newest days — were excluded), so the weekly close/RSI/SMA/trend shown to the user lagged reality by up to 4 trading days.
- **root_cause**: Chunk anchoring from the array start guarantees full 5-bar chunks but leaves the remainder at the *end* — exactly the newest data. For a "current weekly context" the invariant must be the opposite: the last chunk must contain the newest bar; any partial chunk belongs at the *oldest* end.
- **fix**: Loop now anchors from the end (`for (end = bars.length; end > 0; end -= 5)`), so the latest week always includes the newest bar; only the oldest chunk can be partial and is dropped when ≥4 full weeks exist. Verified by extraction: 63-bar input → last week ends at bar 62 with all kept weeks full; 65-bar input → 13 full weeks ending at bar 64.
- **violated_rule**: R267 (created from this incident).
- **prevention**: Any rolling/windowed aggregation whose output is described as "current" must anchor windows to the most recent observation and push remainder truncation to the oldest end. Test with a length that is NOT a multiple of the window size.

## P578 · v51.88 · Bollinger Band 표준편차 분모가 표준(모집단)에서 이탈

- **symptom**: `_calcBB()` divided the squared deviations by `period - 1` (sample variance) since v51.47's "표본 분산 교정".
- **root_cause**: John Bollinger's own definition — and every mainstream implementation (TA-Lib `ddof=0`, TradingView) — uses **population** variance (`/period`). The v51.47 change applied a statistics-textbook instinct to a named methodology, widening the bands by `sqrt(20/19) ≈ +2.6%` at period 20 and subtly shifting %B and band-touch signals versus what users would see on any charting platform. Same class as P574 (R265): a named methodology must match its source's exact definition.
- **fix**: Denominator restored to `period` with an R265 citation in the comment. Verified by extraction against a hand-computed population SD (upper band = mid + 2·popSD to 1e-9).
- **violated_rule**: R265.
- **prevention**: Covered by R265 — "looks statistically more correct" is not a reason to deviate from a named indicator's canonical formula.

## P579 · v51.88 · MACD histogram 배열 앞 8개 값이 isFinite(null) 함정으로 오염

- **symptom**: `_calcMACD()`'s `histogram` array built entries with `isFinite(s) ? v - s : null`, intending to skip the signal line's warm-up nulls. But `isFinite(null) === true` in JS (null coerces to 0), so the first `signal-1` (=8) entries became `v - null = v` — raw MACD values instead of being filtered out.
- **root_cause**: JS type-coercion trap: `isFinite` (global, non-`Number.isFinite`) coerces its argument, so `null` passes. Both current consumers read only `histogram[length-1]` (the newest value), so no user-visible damage today — fixed as hardening before any future consumer iterates the whole array.
- **fix**: Guard changed to `(s !== null && isFinite(s))`.
- **violated_rule**: none (latent-defect hardening).
- **prevention**: Prefer `Number.isFinite` (no coercion) over global `isFinite` when the value can be null/undefined.

## P580 · v51.89 · size 팩터의 부호가 학술적 SMB 정의와 정반대

- **symptom**: Following the systematic algorithm audit, the user asked for a decision on two flagged design observations, framed around "the screener's core purpose." `_aioComputeFactorRanks()`'s `sizeRaw` (js/aio-data.js) scored large-cap stocks *higher* (`Math.log(mcap)`, no negation), the opposite of the academic size premium (Fama-French SMB: small caps carry a return premium, so a "size factor" should score smaller caps higher). Every other factor in the same 6-factor model was already correctly signed toward its academic namesake's outperformance direction: `lowvolRaw = -vol` (low vol wins), `valueRaw` uses inverse multiples (cheap wins), `qualityRaw` rewards high ROE/margin/growth, `momRaw`/`kalmanRaw` reward positive trend. `sizeRaw` was the lone exception, with no comment explaining a deliberate reversal.
- **root_cause**: A confirmed internal contradiction, not just a stylistic gap: the app's own AI-chat institutional-framework content (js/aio-chat.js:851) teaches users "수익률 = 시장베타 + 사이즈 + 밸류 + 모멘텀 + 퀄리티 + 잔차" (returns = market beta + size + value + momentum + quality + residual) — presenting "사이즈" as the standard Fama-French risk-premium factor. The ranking code implemented the opposite direction of that exact factor, contradicting the app's own stated framework. Additionally, a screener's core purpose is surfacing differentiated signal, not re-stating market cap (a quantity already known to any user without screening) as if it were alpha.
- **fix**: `sizeRaw` changed to `-Math.log(mcap)`, mirroring `lowvolRaw`'s existing negation pattern. Weight magnitudes (5–8% across regimes/profiles) unchanged — only the direction of "better" flipped. Verified by extraction: small-cap ($2B) raw score now exceeds large-cap ($500B) raw score (-21.4 vs -26.9).
- **violated_rule**: R265.
- **prevention**: Covered by R265 — a factor's sign convention is part of its named-methodology definition, not a free styling choice. When one factor in a family is signed oppositely to its siblings with no explanatory comment, treat that asymmetry as a suspected bug, not an intentional design choice, and check whether any in-app content already commits to the standard definition.

## P581 · v51.89 · value 팩터가 서로 다른 자연 스케일의 세 배수를 정규화 없이 평균해 사실상 단일 팩터로 붕괴

- **symptom**: `valueRaw` averaged raw `1/PE`, `1/PB`, `1/EV-EBITDA` with the stated intent of a 3-multiple blended value signal ("각각 수익률로 변환 평균"). A synthetic-universe check (200 stocks, realistic PE/PB/EV-EBITDA ranges) found the resulting composite correlated 0.982 with `1/PB` alone but only 0.187 with `1/PE` — the "blend" was in practice ~98% a P/B factor, because `1/PB`'s natural magnitude (~0.1–2 for typical PB 0.5–15) dwarfs `1/PE` and `1/EV-EBITDA`'s (~0.01–0.2), so it dominated the unweighted average by scale accident rather than by design.
- **root_cause**: Averaging raw quantities of different natural scale silently weights the average toward whichever quantity has the largest numeric range — a general antipattern distinct from (but adjacent to) R265. The immediately adjacent `qualityRaw` function already avoids exactly this failure mode by clamping each sub-metric (ROE/margin/revGrowth) to a fixed range and dividing by that range before averaging; `valueRaw` simply didn't apply the same care.
- **fix**: Mirrored `qualityRaw`'s clamp-and-normalize pattern: each inverse multiple is clamped to a typical range and divided by that range before averaging — `1/PE→[0,0.20]/0.20`, `1/PB→[0,2.0]/2.0`, `1/EV-EBITDA→[0,0.20]/0.20`. Verified by extraction: post-fix correlation with `1/PB` and `1/PE` are 0.542 and 0.529 respectively — genuinely balanced.
- **violated_rule**: R268 (created from this incident).
- **prevention**: See R268.

## P582 · v51.90 · Local `.git` corrupted by OneDrive sync conflict — 20,503 loose objects (2.4GiB) + 370 failed-gc tmp_obj remnants

- **symptom**: A structural diagnosis (Fable 5, 2026-07-02) found the local git repository unhealthy: `git count-objects -vH` reported 20,503 loose objects at 2.40GiB (a healthy repo keeps loose objects in the low hundreds), plus 370 `tmp_obj_*` garbage files (103.63MiB) under `.git/objects/` — direct evidence of `git gc`/`repack` repeatedly failing partway through. `du .git` itself hit a 2-minute timeout.
- **root_cause**: The repo lived inside a OneDrive-synced folder (`OneDrive\문서\Claude\Projects\AIO`) while `refresh-data.yml` pulls a data commit into it every 30 minutes (40% of the last 500 commits were `data:` commits; `public-data/telegram-digest.json` alone changed in 10 of the last 20). Each pull writes a burst of new git objects; OneDrive's background sync opens/locks the same `.git/objects/` files to upload them to the cloud. When a `git gc` ran while OneDrive held a lock, the repack aborted mid-write, leaving `tmp_obj_*` debris and never reclaiming the loose objects — repeating every cycle with no self-healing mechanism.
- **fix**: `git gc --aggressive --prune=now` reclaimed everything in one pass (0 loose objects, 0 garbage, 1 pack at 12.21MiB; `git fsck --full` clean). Root cause addressed by relocating the entire project out of OneDrive to `C:\Projects\AIO` (robocopy `/E /COPY:DAT`, verified via matching file count (666=666) and `HEAD` SHA before deleting the OneDrive copy) — this was an explicit operator decision among three options (relocate / exclude `.git` from sync / defer), not a default action.
- **violated_rule**: none named yet — first occurrence of this failure class in this project.
- **prevention**: Do not place a git repository with a high-frequency automated commit cadence inside a cloud-sync folder (OneDrive/Dropbox/Google Drive) without excluding `.git` from sync. If `git count-objects -vH` ever shows `garbage > 0` or loose objects in the thousands, suspect a sync-tool lock conflict before assuming disk corruption.
- **verification**: `git count-objects -vH` (0 loose / 0 garbage / 1 pack); `git fsck --full` (no output = clean); `git log --oneline -3` and `git status --short` identical before/after at both paths.

## P583 · v51.90 · `_context/CLAUDE.md` disk-corrupted by double-encoding round-trip; `_context/CODE-MAP.md` stale by 60 versions

- **symptom**: `_context/CLAUDE.md` — the hub document every session's mandatory preflight (`WORKFLOW-GOVERNANCE.md`) requires reading first — was unreadable mojibake on disk (`file` reported valid UTF-8 with BOM, but content was garbled: Korean text round-tripped through a non-UTF-8 codepage and re-saved, with irreversible bytes replaced by literal `?`). Separately, `_context/CODE-MAP.md` was pinned at `target_version: v50.60` (2026-06-16) while the app was at v51.90 — 60 versions and a full CSS/DOM restructure later (e.g. `page-home` moved from line 4044 to 5227; CSS grew 3693→4888 lines), violating the project's own "리팩토링 ±500줄 → 재스캔" rule. Three files (`CLAUDE.md`, `BUG-POSTMORTEM.md`, `RULES.md`) also stated the data-refresh cadence as "2시간마다"/"2-hourly" — `refresh-data.yml`'s cron has been 30-minute (`*/30` then `17,47 * * * *`) since it was introduced at v50.23 and was never 2-hourly at any point in git history.
- **root_cause**: The mojibake is consistent with an editor or tool opening the UTF-8 file with the wrong system codepage (e.g. CP949) and saving back — lossy and not mechanically reversible once the `?` replacement characters are written. The CODE-MAP staleness is a governance-loop failure: the "±500 line reindeer scan" rule has no CI enforcement (no gate checks `target_version` against `version.json`), so it silently drifted for 60 versions with no error signal. The "2시간마다" wording appears to be a one-time authoring slip (typed once, then copy-referenced by 2 more files) that was never caught because no gate cross-checks prose cadence claims against `refresh-data.yml`'s actual cron expression.
- **fix**: `_context/CLAUDE.md` rewritten from scratch in clean UTF-8, reconstructed from root `CLAUDE.md` + `_context/INDEX.md` plus fresh `git ls-files` verification — this also caught that the old content's claim "`.claude/hooks`/`.claude/commands` are not GitHub-tracked" had been **false since 2026-05-18** (commit `09d2200`; both are tracked, along with `.claude/agents/` which no doc previously mentioned). `_context/CODE-MAP.md` fully re-derived via `grep -n` against the live v51.90 source for every function/constant it documents (not copied from the stale version). `_context/INDEX.md` baseline updated (`638de8f`/v50.4 → `d6902a1`/v51.90), two undocumented tracked files added to its table (`DEFERRED-BLOCKS.md`, `PAGE-UX-AUDIT-2026-06-13.md`), and two dead worktree references removed after `git worktree list` confirmed neither exists. "2시간마다"/"2-hourly" corrected to "30분마다"/"30-minute" in all 3 files.
- **violated_rule**: none named yet for the encoding corruption (first occurrence); the CODE-MAP staleness is a repeated instance of the project's own re-scan rule going unenforced (no R-number currently covers "staleness rule must have a CI gate, not just a written instruction").
- **prevention**: Treat any `_context/*.md` that fails a plain-UTF-8 read (garbled Korean, stray `?` glyphs) as corrupted, not as content to interpret — reconstruct from the root `CLAUDE.md`/related docs rather than guess at the mojibake. Before trusting a `_context` doc's file-tracking or line-number claims, spot-check with `git ls-files` / `grep -n` rather than citing the doc as ground truth. Consider promoting "CODE-MAP `target_version` must match `version.json` within N versions" to an actual CI check rather than a prose-only rule, given it silently drifted 60 versions with zero signal.
- **verification**: `file _context/CLAUDE.md` (UTF-8 with BOM, no garbled bytes); `git ls-files .claude/hooks/ .claude/commands/ .claude/agents/` (all tracked); `grep -n "2시간마다\|2-hourly" CLAUDE.md _context/*.md` (zero matches after fix, excluding this entry's own historical note); `git log --follow -p -- .github/workflows/refresh-data.yml | grep cron:` (30-minute cadence since v50.23, never 2-hourly).

## P584 · v51.91 · Server `_rsi14` used Cutler's RSI while client `_calcRSILast` used Wilder's RSI — same "RSI(14)" label, different numbers

- **symptom**: `scripts/fetch-data.mjs`'s `_rsi14(closes)` sliced only the last 15 bars and averaged gains/losses once over that fixed window (Cutler's RSI). `js/aio-core.js`'s `_calcRSILast(closes, period)` computed an initial 14-bar average, then recursively smoothed it over the *entire* input history (Wilder's original RSI — the industry-standard definition used by TradingView, TA-Lib, and most brokers by default). Both wrote to fields labeled `rsi`/`RSI(14)`, so `public-data/screener.json`'s screener RSI and the client's own displayed RSI could diverge materially whenever there was a meaningful gain/loss regime earlier in the series.
- **root_cause**: The server and client have no shared module system (browser `<script>` tags vs a Node ESM script — see P582/C1's structural note on this), so the same named indicator was implemented twice, independently, by different sessions at different times, and the two implementations silently drifted apart. Same class of failure as R265 (named-methodology parity), but between two implementations of the *same app's own* indicator rather than between the app and an external reference.
- **fix**: Rewrote server `_rsi14` to Wilder's method, byte-for-byte matching the client's `_calcRSILast` algorithm (initial simple average over the first `period` deltas, then `avgGain = ((avgGain*(period-1)) + gain)/period` recursive smoothing over the rest). Verified by extraction: identical synthetic 300-bar closes series scored 20.3 (old Cutler) vs 43.9 (new Wilder) — a 23.6-point swing on the same input, confirming this was not a cosmetic rounding difference. Added a numeric parity check to `scripts/ci-data-pipeline-contract-check.mjs` that extracts both real functions via brace-depth source slicing, runs them against a fixed synthetic 300-bar series, and fails if the two disagree by more than 0.5 points — so a future edit to either implementation without the other is caught structurally, not just by inspection.
- **violated_rule**: R265.
- **prevention**: When the same named financial indicator/formula must exist in more than one runtime (server Node script + browser client, with no shared module), do not trust that matching variable/function names mean matching math — add a numeric parity test that actually executes both implementations against identical input and compares outputs, the same standard R265 already requires for matching an external named methodology.
- **verification**: `node --check scripts/fetch-data.mjs`; `node scripts/ci-data-pipeline-contract-check.mjs` (includes the new RSI parity check); manual extraction comparing old-vs-new formula on identical synthetic input (23.6-point divergence confirmed before fix, <0.5 after).

## P585 · v51.91 · `_YAHOO_FRED_MAP`'s HY-spread entry wrote to a synthetic FRED id nothing ever read

- **symptom**: `js/aio-data.js`'s `_YAHOO_FRED_MAP` had a `'HYG': { fredId: '_HY_PROXY', transform: ... }` entry. `_syncYahooToFred()` iterates this map and, for each entry, writes a Yahoo-derived approximation into `window._fredData[cfg.fredId]` whenever the real FRED series for that id is missing or stale. Because `'_HY_PROXY'` is not a real FRED series id — nothing else in the fetch pipeline ever populates `window._fredData['_HY_PROXY']` — this entry's `fredStale` check was unconditionally `true` on every call, so it wrote on every single invocation, and nothing ever read the key back out (confirmed by grep: zero other references to `_HY_PROXY` anywhere in the codebase, and no code generically iterates `_fredData`/`MacroStore._data` keys that could have picked it up indirectly).
- **root_cause**: A pre-P576/R266 approximation mechanism (comment dates it to v31.9) that was superseded by `fetchHYSpread()` — a real FRED `BAMLH0A0HYM2` measurement whose priority over HYG-price approximations was already fixed in P576/R266 — but the old, now-redundant write path was never removed when the new one was added.
- **fix**: Removed the `'HYG'` entry from `_YAHOO_FRED_MAP` entirely. The other 6 entries (TNX/TYX/FVX/IRX/VIX/DXY, all real FRED series ids that are genuinely read elsewhere) and `_syncYahooToFred()`'s loop structure are unchanged.
- **violated_rule**: R266 (adjacent — R266 says prefer measurement over proxy when both exist; this was the more basic case of a duplicate write path with zero consumers left after the real measurement path superseded it).
- **prevention**: When a measurement is added that supersedes an existing proxy/approximation (as `fetchHYSpread()` did for the HYG-price approximation), remove the old write path in the same change rather than leaving it running unread — a dead write that never gets read is easy to miss with normal code review because it "looks" wired up (defined in a config map, executed on every refresh cycle) while doing nothing observable.
- **verification**: `grep -n "_HY_PROXY" js/*.js index.html scripts/*.mjs` (zero matches after fix, previously exactly one — the definition itself); `node --check js/aio-data.js`.

## P586 · v51.91 · Screener backtest panel implied it validated the live composite rank; it validates a different, fixed-weight 4-factor subset

- **symptom**: `scripts/fetch-data.mjs`'s `backtestFactors()` computes cross-sectional IC/quantile-spread/hit-rate for exactly 4 price-derived factors (momentum/trend/lowvol/kalman) at one *fixed* weight set. The live ranking model, `js/aio-data.js`'s `_aioComputeFactorRanks()`, uses 7 factors (adds size/value/quality) at *regime-adaptive* weights that shift continuously via `_aioFactorWeights()` (NEUTRAL/RISK_OFF/RISK_ON, lerp-blended by the live market risk score). The client backtest panel (`_aioRenderScreenerBacktest`) nonetheless told users "IC>0.05 = 유의미한 예측력... 종합 랭크가 검증 기반" (the composite rank is what's validated) — which was not accurate, since the thing being backtested and the thing being shown as the live rank were never the same model.
- **root_cause**: The backtest's 4-factor scope was a reasonable original design constraint (documented in a code comment as "value/quality/size는 FMP 의존 또는 미시계열 제외"), but the UI copy was never updated to reflect that constraint honestly as the live model grew from 4 to 7 factors with adaptive weighting across v50.52-51.89. Additionally, the backtest's own `COMP_W` constant (`{mom:.35, trend:.25, lowvol:.25, kalman:.15}`) was an independently hand-picked approximation of the live NEUTRAL weights rather than a derived subset of them — the same "two independently-maintained copies of the same thing drift apart" pattern as P584/C1, just for weights instead of a formula.
- **fix**: Investigated adding size/value/quality to the backtest per the original roadmap suggestion and found both infeasible/unsound with data this pipeline actually has: size would need historical shares-outstanding (not fetched anywhere — `mcap` is a hand-maintained static seed in `SCREENER_DB`, not a live series); value/quality come from FMP as today-only TTM snapshots (`enrichFundamentals`), so scoring a rebalance 147 days in the past using today's P/E/ROE would be look-ahead bias. Deferred both rather than implementing them incorrectly. Instead: (1) `COMP_W` replaced with `{mom:.370, trend:.274, lowvol:.219, kalman:.137}` — the live NEUTRAL constant's momentum/trend/lowvol/kalman weights (`.27/.20/.16/.10`, subset sum `.73`) renormalized to sum to 1 over just this subset, a single source of truth instead of an independent guess; (2) `weightRegime: 'NEUTRAL'`, `excludedFactors: ['size','value','quality']`, and `excludedFactorsReason` added to the payload; (3) the client panel rewritten to read those fields and state the actual scope ("검증 범위: 가격 파생 4팩터만... 라이브 랭킹에 있는 size/value/quality 팩터와 레짐 적응 가중은 이 검증에 포함되지 않음") instead of implying full validation; (4) `updateBacktestHistory()` added, appending each run's `ic`/`quantileSpread`/`hitRate` to a new `public-data/backtest-history.json` time series (180-day cap, same upsert-by-date pattern as `updateHistory()`) — previously every 6h run silently overwrote the prior IC with no history, so a factor quietly decaying to IC≈0 would never be visible.
- **violated_rule**: none named yet for the disclosure-honesty gap (first occurrence of this specific pattern in this project); the weight-drift issue is the same underlying class as R265's parity requirement, applied to weights rather than formulas.
- **prevention**: When a UI panel claims to "validate" something, the claim's scope must be kept in sync with the actual model it tests — if the live model gains factors/adaptive behavior the backtest doesn't cover, either extend the backtest or narrow the claim, in the same change that grows the live model. Before adding a new factor to a backtest, verify the pipeline has genuine *historical, point-in-time* data for it — a fundamentals API that only returns "current" values cannot be backtested against past rebalance dates without look-ahead bias, no matter how tempting the addition looks.
- **verification**: `node --check scripts/fetch-data.mjs`; `node --check js/aio-data.js`; `node scripts/ci-data-pipeline-contract-check.mjs` (new checks assert the payload discloses `excludedFactors`/`weightRegime` and the client panel actually surfaces them); manual extraction run of `backtestFactors()` against 20-stock/250-day synthetic data confirming `compWeights` sums to 1.000 and all new payload fields populate correctly.

## P587 · v51.91 · Screener factor enrichment used dividend-unadjusted close, structurally understating momentum/trend for high-yield names

- **symptom**: `_enrichPriceFactors()` fed `fetchHistory()`'s raw `close` field into `closesToFactors()` for all momentum/trend/RSI/kalman/backtest math. Raw close does not account for dividends — a stock that paid out 3% in dividends over a lookback window shows ~3% less price appreciation than its actual total return, systematically penalizing high-yield sectors (utilities, staples, REITs) in factor rankings relative to their true performance. v51.88's algorithm audit had already flagged this as a known, unfixed design gap ("종가 배당 미조정").
- **root_cause**: `fetchHistory()` only read `indicators.quote[0]` (raw OHLCV) from Yahoo's chart API response and never checked whether an adjusted-close series was also available in the same response.
- **fix**: Verified by a live, read-only diagnostic fetch (not assumed) that Yahoo's `v8/finance/chart` endpoint already returns a parallel `indicators.adjclose[0].adjclose` array in the *same* response, with no extra query parameter needed. Added `adjClose` to each row `fetchHistory()` returns (falls back to raw `close` when the adjusted array is absent/invalid, e.g. for indices/crypto/FX that don't have dividend adjustments). `_enrichPriceFactors()` now builds a separate `adjCloses` array and feeds *that* into `closesToFactors()` and `backtestFactors()`, while `_calcVCPServer()` keeps consuming raw `closes`/`highs`/`lows`/`volumes` unchanged (VCP is a price-*structure* pattern-recognition algorithm, not a return-based factor, and mixing an adjusted close into an otherwise-raw OHLC set would distort swing-depth math against the un-adjusted high/low bars). Measured impact on KO (Coca-Cola, ~3% yield) over 1y: raw return 14.64% vs adjusted 17.88% (3.25pp gap); 6-month momentum-factor input differed by 1.56pp, %-from-SMA200 by 1.3pp, RSI by 1.2 points — all confirmed by executing `closesToFactors()` on both series from the same real Yahoo response, not estimated.
- **violated_rule**: R265 (a "return" or "momentum" factor implicitly claims to measure total return, which for equities means dividend-adjusted; using raw close silently redefines the metric).
- **prevention**: When wrapping a third-party price API, check the full response shape for adjacent series (adjusted close, splits, dividends) before assuming only the requested/primary field exists — Yahoo's chart endpoint returns `adjclose` unconditionally alongside `quote`, discoverable with one read-only diagnostic call. When a return-based factor consumes a price series, confirm whether dividend adjustment applies to the instrument class (equities: yes; indices/crypto/FX/futures: generally no) rather than defaulting to raw close everywhere.
- **verification**: Live read-only fetch confirming `indicators.adjclose` presence and shape on `KO`; `node --check scripts/fetch-data.mjs`; `node scripts/ci-data-pipeline-contract-check.mjs`; extraction-based comparison of `closesToFactors()` output on raw vs adjusted closes from the same real 1y KO history (see fix section for measured deltas).

## P588 · v51.91 · The 900+ in-browser unit test suite (`AIO.runTests()`) had no CI job — runtime regressions could only be caught by a human manually opening the console

- **symptom**: `js/aio-tests.js` (~7,000 lines, 921 assertions as measured) only ever ran from a browser console (`AIO.loadTests(); AIO.runTests();`). `ci.yml`'s `validate` job deliberately does syntax/contract/version checks only (see its header comment) and never executes the suite. `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §4 named this the last empty cell in the gate system: the one-time manual measurement in `GATE-BASELINE-2026-06-04.md` (673/692 pass) was never re-run or made permanent, so any runtime regression introduced since then (render/state/contract breaks — the class of bug `validate`'s syntax checks structurally cannot catch) would sail through CI and only surface live.
- **root_cause**: The suite depends on a full DOM + `window.AIO` runtime, which `validate`'s plain-Node `node --check` steps cannot provide, and standing up a headless browser (Playwright) plus a policy for the environment-dependent subset of tests (live quotes, keys, dates that roll every day) is nontrivial setup work that a prior session flagged but did not build.
- **fix**: Added `scripts/ci-headless-tests.mjs` (Playwright chromium, served via the existing `scripts/start-local-node.mjs`, all non-localhost requests `route.abort()`-ed for deterministic offline/seed-fallback behavior) plus a new `headless-tests` job in `ci.yml` — deliberately a sibling of `validate`/`deploy`, not a step inside `validate` and not in deploy's `needs:`, so it cannot block deployment (`continue-on-error: true`, per the diagnosis's explicit "가트 편입은 flaky 안정화 후" guidance). A fresh measurement against v51.91 found 27 failures (894/921 pass) — all classified and recorded in `_context/gate-baseline-skip-list.json` / `_context/GATE-BASELINE-2026-07-03.md`: 13 are pure environment/time drift (live market levels, calendar dates, a hardcoded semver literal), 14 are latent code/UX findings (e.g. T776: two visible dev-marker leaks matching the R204/R206 pattern; T608: `AIO.diagnose()` mention dropped from an error-guidance string even though the function itself still exists) left for separate triage rather than fixed blind in this session.
- **violated_rule**: none pre-existing — this motivates a new one (see R269 below).
- **prevention**: R269.
- **verification**: `node scripts/ci-headless-tests.mjs` run locally (894/921 pass, 27/27 accounted for by skip-list, 0 unexpected); confirmed the job is additive (`git diff --stat origin/main...HEAD` before this change touched none of the files this job depends on) and that `deploy`'s `needs: validate` was left untouched.

## P589 · v51.92 · `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md`'s recommended Stooq quote fallback does not work — Stooq now gates every request behind a JS proof-of-work challenge

- **symptom**: The Phase 2 roadmap item [B1] named "Stooq(무키)" as a zero-cost fallback quote source for when Yahoo fails. A live probe of both `stooq.com/q/l/` (quote) and `stooq.com/q/d/l/` (historical CSV) returned HTTP 200 with an HTML page containing a JavaScript SHA-256 proof-of-work challenge that POSTs to `/__verify` before serving real data — a plain server-side `fetch()` (no JS engine) cannot pass this and gets nothing, silently.
- **root_cause**: The recommendation in the diagnosis doc was not live-verified against the current site (Stooq added bot protection at some point after that recommendation was written or researched) — same class of gap the RSI/adjclose findings (P584/P587) were catching in this codebase's own logic, here in an external-source assumption instead.
- **fix**: Did not implement Stooq. Implemented Twelve Data as the fallback instead (`fetchQuoteTwelveData()` in `scripts/fetch-data.mjs`, gated on optional `TWELVE_DATA_API_KEY` — same graceful-degrade pattern as `FRED_API_KEY`/`FMP_API_KEY`), but *only* for `TWELVE_DATA_ETF_FALLBACK_SYMBOLS` (the 20-ticker "신용·핵심 ETF" block already called out in `SYMBOLS`' own comments: HYG/LQD/TLT/SPY/QQQ/IWM/RSP/DIA/SMH + 11 sector `XL*` ETFs). Confirmed live (via Twelve Data's `demo` key, which only authorizes the single symbol `AAPL`) that the response shape (`close`/`previous_close`/`percent_change` as numeric strings) matches what the parser expects, and that US-listed ETF tickers are written identically on Yahoo and Twelve Data. Deliberately did **not** extend the fallback to indices (`^GSPC`), futures (`CL=F`), FX (`KRW=X`), or KR stocks (`005930.KS`) — Twelve Data's symbol convention for those asset classes is unverified without a real (non-`demo`) key (probing `SPX`/`VIX`/`IXIC`/etc. with the demo key returned 401, not a symbol-not-found error, so nothing about their correctness was actually confirmed), and guessing wrong would silently write incorrect prices into a live finance site.
- **violated_rule**: none pre-existing on the app-code side (this is an external-source-availability drift, not a code bug) — but the *scoping decision itself* motivates R270 (see below), since the natural next-session temptation is to "just add the rest of the symbols" without the same live-verification discipline.
- **prevention**: R270.
- **verification**: `node --check scripts/fetch-data.mjs`; `node scripts/ci-data-pipeline-contract-check.mjs`; live probe of Stooq (both endpoints, confirmed JS-challenge-gated) and Twelve Data (`quote?symbol=AAPL&apikey=demo`, confirmed field shape; `quote?symbol=SPY&apikey=demo` etc., confirmed 401/auth-gated rather than assuming symbol validity).

## P590 · v51.94 · Server's screener universe symbol list was extracted from `js/aio-data.js` source text via a fragile string-boundary search, not a real data artifact

- **symptom**: `getScreenerSymbols()` in `scripts/fetch-data.mjs` located the end of the `SCREENER_DB` array literal with `src.indexOf('\n];', a)` — a plain string search for the exact byte sequence `\n];`. Correct today (the array happens not to contain that sequence internally), but structurally fragile: any future edit that introduces that exact sequence before the real array end (a nested array/object formatted with `];` at line-start, a comment containing it, etc.) would silently truncate the extracted symbol list with no error. `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §4 [B6] named this "서버 정규식 파싱" as a structural debt item.
- **root_cause**: The server needs the 873-symbol universe list but has no independent data artifact to read — the only source is the hand-curated JS array embedded in a client-side script file, so the fetch pipeline reached into that file's source text with string/regex heuristics instead of a real parse.
- **fix**: Added `scripts/sync-screener-universe.mjs`, which extracts `SCREENER_DB`/`SCREENER_DB_META` by tracking actual bracket depth (string/escape-aware, so quoted `{`/`[`/`]`/`}` inside memo text can't confuse it) to find the literal's true end, then evaluates it via `new Function('return (...)')()` — an actual JS-engine parse, not a regex reconstruction of one — and writes the result to `public-data/screener-universe.json` (873 records, spot-checked against known entries for fidelity). `getScreenerSymbols()` now reads that JSON directly. `ci-data-pipeline-contract-check.mjs` runs the sync script in `--check` mode so drift (edited `SCREENER_DB`, forgot to resync) fails CI instead of shipping a stale universe silently. R271.
- **scope note (deliberate, not a gap)**: Fable's B6 wording also said "클라는 부팅 시 로드" (client loads it asynchronously at boot). Did not do this. `SCREENER_DB` has 144 reference sites across 6 files (`aio-chat.js`/`aio-core.js`/`aio-data.js`/`aio-tests.js`/`aio-ui.js`/`index.html`) and the app has no existing async-boot gate that everything else already waits behind (multiple independent `DOMContentLoaded` handlers, no single awaited init sequence) — converting to a true async fetch-on-boot without auditing every one of those 144 call sites' execution timing is the same scope of work Fable already set aside separately as Phase 3 [A2] ("defer 전환 + 참조 시점 전수 감사"). Doing it hastily inside this session risked a silent `undefined` `SCREENER_DB` race on first paint across screener/signal/ticker/watchlist — unacceptable for a live finance site. The server-side half (this postmortem) ships now; the client-side half is left for Phase 3 [A2] where the timing audit is already scoped to happen.
- **violated_rule**: none pre-existing — motivates R271.
- **prevention**: R271.
- **verification**: `node scripts/sync-screener-universe.mjs` (873 records, `sym`-field presence validated); spot-checked `NVDA`/first/last records against the source array by hand; `node scripts/sync-screener-universe.mjs --check` confirmed to correctly fail after a simulated single-field drift and pass again after resync; `node scripts/ci-data-pipeline-contract-check.mjs` (new checks included); `node --check` on both new/changed `.mjs` files; confirmed zero `js/aio-data.js` runtime behavior change (file untouched — only `fetch-data.mjs` and the new sync script were added/edited).

## P591 · v51.95 · `refresh-data.yml`'s every-30-minute commits never triggered CI — the live site silently went stale for ~19h between human-initiated pushes

- **symptom**: While pushing this session's Phase 0-2 commits, `data-watchdog.yml`'s "Check LIVE site freshness" step was found failing: live `public-data/data.json` was `2026-07-02T06:10` while the check ran at `2026-07-03T01:04` — **19 hours stale**, ~50× the 360-minute budget. The repo itself was fresh (`refresh-data.yml` had committed 9 times in that window, roughly on its 30-minute schedule), so the freshness gap was entirely in the deploy path, not data collection.
- **root_cause**: `ci.yml`'s only triggers were `push`/`pull_request`/`workflow_dispatch`. GitHub Actions has a standard, documented anti-recursion safeguard: a push made using the default `GITHUB_TOKEN` (which `refresh-data.yml`'s `actions/checkout@v4` + `git push` steps use) does **not** trigger other `on: push` workflow runs in the same repo. Confirmed directly via the API: `gh api repos/.../actions/runs?head_sha=<a refresh-data.yml commit>` returned `total_count: 0` — zero `ci.yml` runs ever fired for that commit, only the `refresh-data.yml` run that produced it. This was true for every one of the ~9 unpushed-by-a-human commits in the stale window (and, by the same mechanism, has structurally been true since `refresh-data.yml` existed — the live site has only ever actually redeployed when a human/session push happened to land on top of accumulated data commits, not from the data pipeline itself). P572/R263 ("remove `[skip ci]`") fixed a *necessary* condition for this but not a *sufficient* one — the token-identity restriction operates independently of the `[skip ci]` commit-message convention and isn't mentioned by it at all.
- **fix**: Added a `workflow_run` trigger to `ci.yml` (`workflows: ['Refresh market data'], types: [completed]`) — `workflow_run` is exempt from the `GITHUB_TOKEN`-push restriction because it fires on completion of the *named workflow*, independent of what authored the commits inside it. Extended `validate`/`headless-tests`/`deploy` jobs to check out `github.event.workflow_run.head_sha` when triggered this way (falling back to `github.sha` otherwise), and to skip entirely if the triggering `refresh-data.yml` run itself failed (`github.event.workflow_run.conclusion != 'success'`) — no point validating/deploying on top of an incomplete refresh. `deploy`'s gate condition now accepts either a direct push to main or a successful `workflow_run` whose `head_branch` was main. No new secret/PAT required — this is the standard GitHub-documented workaround for the token restriction, not a bypass of it.
- **violated_rule**: none pre-existing — motivates R272.
- **prevention**: R272.
- **verification**: `python3 -c "import yaml; yaml.safe_load(open('ci.yml'))"` confirmed the new `on:`/`if:` blocks parse and resolve to the intended structure (job names, `if` expressions, `workflow_run` config, checkout `ref` on all three jobs) before pushing; live-confirmed the actual failure mode first via `gh api .../actions/runs?head_sha=...` returning zero runs for a known bot commit; after pushing this fix's containing commit, the immediately-following CI run (`validate`+`headless-tests`+`deploy`, triggered by the ordinary human push, not yet by `workflow_run`) succeeded and the live site was re-confirmed fresh. **Update same session**: manually dispatched `refresh-data.yml` shortly after (`gh workflow run refresh-data.yml`) specifically to test the new path end-to-end — confirmed live via `gh api .../actions/runs?event=workflow_run` that a `CI` run was auto-created on that data-refresh commit with zero human push involved, and its `validate`→`headless-tests`→`deploy` all completed successfully — the `workflow_run` path is now proven live, not just structurally argued.

## P592 · v51.96 · Full `/data-refresh` pass surfaced three independent, real drifts that a routine "update the numbers" pass would have shipped past unnoticed

- **symptom (three separate findings, one session)**:
  1. `DATA_SNAPSHOT._fallback` (js/aio-core.js) had drifted from the primary `DATA_SNAPSHOT` fields it's supposed to mirror — `breadth5`/`breadth200`/`breadth50` held stale values (61/57/52) against the primary's already-updated 32/38/48 (T686's exact finding, previously skip-listed as "known drift" rather than fixed), and after fixing those a *second*, previously-invisible drift appeared: primary `fg` (Fear & Greed) was `32` while `_fallback.fg` was being set to `31` — because primary `fg`/`fgLabel` lived on a line (`js/aio-core.js` ~18804) with a **stray mid-line carriage-return character (`\r`, not `\r\n`)** sitting between an unrelated `vvix_live` comment and the `fg:` field. Per the ECMAScript spec, a bare `\r` *does* terminate a `//` line comment (same as `\n`), so the file was syntactically valid — `node --check` passed — but the visual layout in every tool (this session's own `Read`, terminal `cat`, presumably the editor used when this field was last touched) rendered it as if `fg`/`fgLabel` were still inside the preceding comment, making the field easy to visually skip during a normal edit pass. This is almost certainly *why* `fg` was missed in earlier `/data-refresh` cycles despite `vvix`/`vix`/`dxy` right above it being kept current.
  2. `DATA_SNAPSHOT.vvix_live` (a *second*, separately-named copy of VVIX that four call sites read in preference to `DATA_SNAPSHOT.vvix`) was stuck at `85.50` while `vvix` itself had been correctly kept at a fresher value in prior cycles — same "two copies of the same number drift apart" pattern as finding 1, on a field that isn't even named similarly enough to `vvix` to be an obvious duplicate at a glance.
  3. Editing `AIO_TELEGRAM_WEEKLY_DIGEST.categories` (js/aio-data.js) down from 10 entries to 9 while rewriting this week's themes broke T831's `AIO_TELEGRAM_CATEGORY_REGISTRY.length >= 10` contract check — a structural invariant ("the digest must expose at least 10 categories for page-mapping/UI coverage") that exists *only* as a test assertion, nowhere documented near the data itself, so nothing about editing the array's contents would have surfaced it short of actually running the suite.
- **root_cause**: All three are the same underlying shape — a value or count that's semantically supposed to track another value/contract, kept only by human discipline during copy/edit, with the enforcement (if any) living somewhere the editor wasn't looking (a mirror object 250 lines away, a differently-named field four call sites down, a test assertion in a different file). Finding 1's stray `\r` compounds this by also being a *visual* trap, not just a discipline gap.
- **fix**: Resynced `_fallback.fg`/`breadth5`/`breadth200`/`breadth50` to their primary counterparts; removed the stray `\r` and cleanly re-split the `vvix_live`/`fg` line; updated `vvix_live` to the live-fetched value; restored a 10th telegram category (`memory-supercycle`, split back out from the merged `mlcc-surge` entry) with accurate content for the current week rather than reverting the theme rewrite. Also swept the other five `js/*.js` files for the same stray-mid-line-CR pattern (`indexOf('\r')` not at end-of-line) — zero found elsewhere, so this was a one-off, not systemic.
- **violated_rule**: R184 (mirror consistency) for findings 1-2; no pre-existing rule named the "test-only structural contract" gap in finding 3.
- **prevention**: R273 (below) generalizes the mirror/duplicate-field problem. Finding 3's prevention is process, not a new rule: this is exactly what running the full headless suite (Phase 2 B5) *before* committing a content edit is for — it caught its own regression in the same session it was introduced, which is the system working as intended rather than a gap.
- **verification**: `node scripts/ci-headless-tests.mjs` re-run three times across this fix sequence (894/921 baseline → 893/921 mid-edit, T686 issueCount 2→1 → 896/921 final, T686/T776/T831 all gone, zero unexpected failures); isolated `new Function()` evaluation of the `DATA_SNAPSHOT` and `AIO_TELEGRAM_WEEKLY_DIGEST` literals confirmed every primary/mirror pair now matches by value equality, not just visual inspection; `node -e` byte-level scan (`indexOf('\r')` not at segment end) across all six `js/*.js` files confirmed no other stray-CR instances.

## P593 · v51.97 · Phase 2 [B2] FRED series expansion; live macro fields silently swapped a different-methodology indicator under an existing label

- **symptom**: While researching FRED_SERIES expansion candidates (Fable's B2 roadmap item), found that `consConf` (rendered as "소비자심리 · Conf. Board" with 100=optimistic/80=recession-fear thresholds, index.html:7828-7830) is fed live University of Michigan Consumer Sentiment (UMCSENT) data by two independent code paths whenever a user has a personal FRED key configured: `applyFredToUI()` (js/aio-data.js, DOM sink write) and the AI-chat macro-context builder (`macroBlock.consConf`, index.html ~14596). Conference Board Consumer Confidence and University of Michigan Consumer Sentiment are different surveys from different organizations with different scales/methodology (Michigan has run in the 50s in this app's own prior narrative text, well below the Conf.-Board-calibrated "80=recession fear" threshold shown here) — this is the same class of bug as the RSI Cutler/Wilder divergence (R265), but at the data-source-selection layer rather than the formula layer. Already flagged, but left unresolved, in P456 (v49.95): "consConf 라벨은 'Michigan'인데 값(104.7→93.1)은 Conference Board 소스... 값/라벨 불일치."
- **root_cause**: FRED has no free Conference Board series (it's a proprietary, paid-license survey) — whoever originally wired the client's personal-key FRED bridge (v48.59) needed *some* consumer-sentiment series to demo the "cons-conf" sink and picked the one FRED actually offers (UMCSENT), without renaming the field/label or checking it against the field's existing Conference-Board-calibrated identity (thresholds, sub-index breakdown comments like "Present 116.4/Expectations 74.4" that only exist for Conference Board's methodology). P456 caught the symptom two versions ago but its prevention item (verify label/source parity) was never actioned.
- **fix**: Kept `consConf` = Conference Board (matches the richer, pre-existing manual content/sub-indices and the visible UI label/thresholds) and removed the incorrect UMCSENT write from both live paths. `applyFredToUI()` no longer writes UMCSENT into the `cons-conf` DOM sink (still fetches it into `window._fredData.UMCSENT` for any future dedicated Michigan Sentiment surface). The chat-injection `macroBlock.consConf` now falls back to `window.DATA_SNAPSHOT.consConf` (manual figure, `[스냅샷]`-tagged) instead of silently showing a Michigan number under a Conference-Board key — the same live-then-snapshot-fallback pattern its cpiYoY/pceYoY siblings already used. Did not add a new "Michigan Sentiment" field/card this session — deferred (see scope note) rather than inventing a seed value.
- **scope note (deliberate, not a gap)**: Also promoted three unambiguous, already-elsewhere-proven FRED series from the client-only personal-key bridge (aio-data.js `FRED_SERIES` table, v48.59) to the server's repo-secret-gated `FRED_SERIES` (scripts/fetch-data.mjs), so they auto-refresh for every visitor instead of only users with a personal key: `housingStarts` (HOUST, thousands→millions scale), `retailSales` (RSAFS, new `mom_pct` kind), `usWageGrowth` (CES0500000003, existing `yoy` kind). Did NOT add University of Michigan Sentiment as a new automated field this session (network access to fred.stlouisfed.org was blocked from this session's local sandbox — DNS resolved to a non-Fed IP with TLS renegotiation hangs on direct curl, and WebFetch got bot-blocked with a 403 — so no fresh external verification was possible; relied instead on the series already being proven-in-use elsewhere in this codebase). Did NOT add a Korean CPI FRED series (Fable suggested `KORCPIALLMINMEI`): couldn't verify it this session for the same network reason, and even if valid, FRED's OECD-relay series for non-US statistical offices are generically known to lag the origin agency's own release — this project already has a more authoritative direct path (`fetchAllKosisData` client bridge to KOSIS/통계청, plus the existing manual `/data-refresh` WebSearch process that already cites 통계청 directly) that a secondary relay could regress, not improve. Left as a documented, un-implemented candidate rather than forced through.
- **violated_rule**: R265 (named-methodology parity) in spirit, but at the source-selection layer, not the formula layer — motivates R274.
- **prevention**: R274 (below).
- **verification**: isolated `new Function()`-based unit test of the new `fetchFred()` branches (`level`+`scale`, new `mom_pct` kind) against hand-computed expected values (housingStarts 1470k→1.47M + delta, retailSales 700000→706300 = +0.9% MoM, usWageGrowth 37.43→38.78 YoY = +3.6%, plus a `fedRate` control case proving the pre-existing `level` kind is byte-for-byte unchanged when `scale` is omitted) — all passed without ever calling `fetch-data.mjs`'s `main()` or touching `public-data/*.json`. Full local validate suite (`node --check` on all `js/*.js` + `scripts/*.mjs`, `ci-version-check`, `ci-structural-check`, `ci-ux-default-path-check`, `ci-runtime-contract-check`, `ci-data-pipeline-contract-check`, `ci-semantic-review-check`, `ci-workflow-compaction-check`, `ci-skill-contract-check`, stray-file scan) all passed. `node scripts/ci-headless-tests.mjs`: 896/921 pass, remaining 25 failures all pre-existing skip-list entries (zero new regressions) — notably T685 (`consConf >= 85 && <= 100`) still passes at `consConf=91.2`, confirming the fix didn't disturb the still-manual Conference Board value.

## P594 · v51.98 · Phase 3 [A3]: moved the core trading-score algorithm out of index.html inline into js/aio-core.js — a load-bearing refactor of a live finance site's central scoring logic, executed as a pure relocation with byte-level behavior-invariance proof

- **symptom/motivation**: not a bug — this executes Fable's diagnosed structural item A3 (`_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §7): `computeTradingScore`/`getScoreAdvice`/`computeExecutionWindow`/`classifyMarketRegime` (the app's central scoring/regime/execution-timing logic) lived in an `index.html` inline `<script>` block rather than any of the six `js/*.js` modules, forcing five call sites across `aio-core.js`/`aio-data.js`/`aio-ui.js` to reverse-reference them via `typeof computeTradingScore === 'function'` defensive guards — a structural inversion (module code depending on inline HTML) that Fable flagged as both an architecture smell and a blocker for the separately-planned Phase 3 [A2] script-defer conversion (A2's own blocker is exactly "does any inline block reference a module symbol at parse time" — moving the reverse-dependency out simplifies that audit).
- **root_cause**: historical accretion — these functions predate the v48+ module split (`js/aio-core.js` etc.) and were never migrated when the rest of the codebase was.
- **fix**: cut the 273-line block (`index.html` old lines 22773-23045, including its leading section-comment banner) and pasted it into `js/aio-core.js` immediately after `_ldSafe`'s closing brace (its primary dependency, already resident in that file) with a new section banner. Zero caller-side changes anywhere (`index.html`/`js/aio-data.js`/`js/aio-ui.js`'s existing bare calls and `typeof` guards are unaffected — global function names resolve the same regardless of which script defines them, and `aio-core.js` loads *first* of the four synchronous modules, so those guards now resolve `true` earlier than before, never later). Full symbol-dependency audit before moving: `_ldSafe`/`_aioLog` already lived in the destination file; `_closingVal` (inline, index.html) and `computeNewsSentimentScore`/`computeNewsRiskSignals` (`js/aio-data.js`) are only referenced at *call* time, never at *parse* time, by any of the four moved functions or their five call sites (confirmed zero eager/top-level invocations anywhere, including in `aio-chat.js`/`aio-tests.js`/`aio-glossary.js`, which have zero references) — so both resolve correctly by the time any real call happens (well after all four modules + the inline HTML have finished executing top-to-bottom). One intentional non-relocation change: removed `computeTradingScore`'s dead 4th-tier HY-spread fallback (`document.getElementById('hy-spread-val').textContent` parsing, Fable's A5 finding) — confirmed unreachable, since its gating 2nd-tier condition (`DATA_SNAPSHOT.hySpread > 0`) is always true (a hardcoded seed of `275`, only ever overwritten by `fetchHYSpread`'s NaN-guarded positive measurement, never cleared anywhere) — same R266 "measurement beats DOM-parsed proxy" principle already established for this exact code path (P576).
- **verification**: (1) **Behavior-invariance snapshot diff** — before making any edit, loaded the app locally (offline/seed-fallback, external network aborted, same harness pattern as `scripts/ci-headless-tests.mjs`) and captured JSON output of `computeTradingScore()`/`computeTradingScore('day')`/`computeTradingScore('swing')`/`getScoreAdvice(25/50/75/90)`/`computeExecutionWindow()`/`classifyMarketRegime()`; repeated after the move; diffed both — **byte-identical** aside from expected wall-clock fields (`evidenceAudit.generatedAt`, `ageMin`). This is direct proof the relocation changed zero behavior, not an inference from "tests still pass." (2) Full local validate suite (`node --check` all `js/*.js`+`scripts/*.mjs`, all 9 `ci-*.mjs` gates, stray-file scan) — initially surfaced 4 real failures in `ci-runtime-contract-check.mjs`/`ci-semantic-review-check.mjs` because those scripts hardcoded searches against `html` (index.html's content) for these functions' source text; fixed by retargeting the searches at `core` (js/aio-core.js's content), and additionally *hardened* one check (`classifyMarketRegime` breadth-default assertion) that would have blindly matched an unrelated coincidental "breadth200...: 75)" pattern ~150 chars into an unrelated part of the now-larger `core` file (line ~2746) if pointed at the whole file rather than scoped to `classifyMarketRegime`'s own extracted body — all gates green after the fix. (3) `node scripts/ci-headless-tests.mjs`: 896/921, identical to the pre-move baseline, zero new regressions. (4) `_context/CODE-MAP.md` full resync: the ~287-line insertion shifted every subsequent `js/aio-core.js` line-number reference in the document (not just the four moved functions) — found and corrected all of them (evidence-first layer table, quick-reference table, the file's own inline-block line-map in §2, `_fmtNum`'s cross-reference, `index.html`'s own shifted `aio-chat.js`/`aio-glossary.js` script-tag lines) by cross-checking each against the actual current file rather than doing arithmetic by hand, after an initial arithmetic estimate (+286) was caught to be off by one against several independently-verified anchors (true shift: +287) — this matches CODE-MAP's own established "±500-line change needs a rescan" rule, applied proactively rather than left for the next session to discover stale.
- **process note (caught before it shipped)**: the first attempt at this relocation had a real bug — the script that spliced the block into `aio-core.js` located `_ldSafe`'s "closing brace" via "first bare `}` after the function signature," which actually matched the closing brace of `_ldSafe`'s own *nested* `if` block (line `_ldSafe`+7), not the function's true end (line `_ldSafe`+9, after the `return hardFallback ...;` line) — silently splicing the entire 273-line block *inside* `_ldSafe`'s body, before its real return statement. Caught immediately by inspecting the actual resulting file content (not just the script's own "success" log line) before running any further steps; reverted via `git checkout` (safe — the pre-splice state was simply the last commit, nothing else uncommitted was at risk) and re-ran with a proper brace-depth counter plus an explicit sanity assertion (the detected end line must be a bare `}` immediately preceded by a line matching `return hardFallback`) so the same class of mistake fails loudly instead of silently corrupting the file a second time.
- **violated_rule**: none pre-existing for the process-note bug specifically (a script correctness issue caught by manual inspection, not a codebase rule violation) — no new rule motivated, since the general prevention ("verify structural edits against actual resulting content, not just a script's self-reported success") is already the spirit of this project's existing verification-before-commit discipline rather than a new distinct failure class.
- **prevention**: none new (executes an already-diagnosed Fable A3 item; the mid-session splice bug was a tooling mistake in this session's own scratch script, caught and fixed within the same session before any commit).
- **verification-summary**: byte-identical behavior-invariance diff + full validate suite + 896/921 headless (zero new regressions) + full CODE-MAP.md line-reference resync, all before committing.

## P595 · v51.99 · Phase 3 [A2] step 1: guarded 22 eager module-symbol references + fixed a CHAT_CONTEXTS ownership hazard — prerequisite hardening before converting aio-core/data/ui/chat/glossary to `defer`

- **symptom/motivation**: not a bug in the sense of live user-facing breakage — this is the audit-and-fix half of Fable's Phase 3 [A2] roadmap item (script `defer` conversion), executed as its own commit before touching any `<script>` tag. Two `Explore` agents read all 8 of `index.html`'s inline `<script>` blocks (the blocks interspersed between the four synchronous module `<script src>` tags) end to end and cross-referenced every top-level (parse-time-executed, not inside a function/callback) statement against symbols defined in `js/aio-core.js`/`aio-data.js`/`aio-ui.js`/`aio-chat.js`. `defer` only applies to external scripts — inline blocks always run at their normal document position — so converting the four module tags to `defer` would push them to execute *after* all 8 inline blocks instead of before, as today. Anything in those blocks that touches a module symbol eagerly (not merely inside a `typeof`-guarded function that's called later) would start throwing.
- **findings** (full detail: this session's `Explore` agent reports, not reproduced verbatim here): 21 bare, unguarded `_aioPageBus.register(...)` calls (the internal `js/aio-core.js` call sites already guard this the same call with `if (window._aioPageBus && ...)`; the 21 external call sites in `index.html` never did) + 1 bare `_aioRegisterTimer(...)` call (`index.html`, global 30s price-alert/a11y timer) — all 22 would throw a `ReferenceError` under `defer`. Because an uncaught top-level exception in a classic `<script>` block aborts the *rest of that block* (not other `<script>` tags), several of these sat before dozens of other function/`CHAT_CONTEXTS`-entry definitions in the same block, meaning the blast radius of a single throw was much larger than "one broken feature" — e.g. the timer call sat directly before its own `beforeunload` cleanup-listener registration and a separate `DOMContentLoaded` block that initializes price alerts, accessibility indicators, the McClellan oscillator UI, and the BOK-meeting-date label; all of those would never have registered at all. Separately (root-cause, not just a symptom of `defer`): `js/aio-chat.js:1417` did `window.CHAT_CONTEXTS = CHAT_CONTEXTS` — a **plain overwrite**, unlike the `window.AIO = window.AIO || {}` merge pattern used consistently (~25 sites) everywhere else in this codebase. `index.html`'s own inline blocks correctly extend `CHAT_CONTEXTS` with page-specific entries (`home`/`market-news`/`options` exist *only* there; `technical`/`macro`/`themes`/etc. get page-specific overrides) via the safe `window.CHAT_CONTEXTS = window.CHAT_CONTEXTS || {}` + per-key-assignment pattern — today's load order (aio-chat.js before those inline blocks) just happened to make the one-sided overwrite harmless. Under `defer`, the inline blocks would run first and aio-chat.js would run last, discarding everything they built.
- **fix**: (1) `js/aio-chat.js:1417` changed to `window.CHAT_CONTEXTS = Object.assign({}, CHAT_CONTEXTS, window.CHAT_CONTEXTS || {})` — order-independent regardless of which side loads first (R275, new rule motivated by this). (2) All 22 eager call sites wrapped in `document.addEventListener('DOMContentLoaded', function(){ ... })`, the exact template already established by P556/R247 for the Chart.js CDN `defer` fix (`DOMContentLoaded` always fires after every `defer`red script has executed, regardless of how many are deferred). Two call sites that pass a named function reference instead of an inline closure (`renderGmoTable`, `_aioBridgeVolIndicesLive`) only had their `.register(...)` call wrapped — the adjacent `setTimeout(fn, 2000+ms)` calls right next to them were already safe as-is (long enough delay to run after `defer` regardless). This commit intentionally does **not** yet add `defer` to any script tag — it is pure defensive hardening that is a no-op under the *current* synchronous load order (every guard/merge in this commit is unconditionally true/safe today; `defer` conversion is a separate follow-up commit).
- **verification**: built a temporary 22-route-page crawler (Playwright, offline/seed-fallback + external network blocked, same harness pattern as `scripts/ci-headless-tests.mjs`) that navigates every `window.AIO_ALL_ROUTE_PAGE_IDS` entry via `showPage(id)` and snapshots per-page console errors, the full `window.CHAT_CONTEXTS` key set, and the full `_aioPageBus._getRegistry()` subscriber map. Captured before any edit, then again after this commit's changes — **identical** except for which of two pre-existing background API-retry-timeout console messages got attributed to which page (an artifact of the crawler's own navigation timing, not a functional difference — same 2 messages, same total count, both runs). `CHAT_CONTEXTS` key set (20 keys) and `_aioPageBus` registry (21 registrations) were byte-for-byte identical before/after.
- **process note — pre-existing test flakiness found and ruled out, not caused by this change**: while re-running `node scripts/ci-headless-tests.mjs` repeatedly for confidence, `T841` (`v5074_structural_fix`) intermittently failed (`band:false`) alongside the normal 896/921 baseline. Investigated by creating an isolated `git worktree` at the *pre-A2* commit (`15997d0`, before any of this postmortem's changes existed) and running the same suite there repeatedly — **T841 flaked identically on the unmodified baseline** (1 fail in 3 runs), proving this is a pre-existing, timing-sensitive issue in the test itself (`_aioDefaultDecision`'s live-computed score-band label set doesn't fully cover the possible `_band.label` values — e.g. `'선별 매수'` for scores 60-74 isn't in the test's `validBands841` set, so whenever `computeTradingScore()`'s output lands in that range at test-run time, the assertion fails) and not something introduced by this session's work. Left unfixed as out-of-scope for Phase 3 [A2] — noted here so a future session doesn't have to re-derive that it's pre-existing.
- **violated_rule**: none pre-existing for the CHAT_CONTEXTS ownership hazard — motivates R275. The 22 eager-reference sites are the same class R247 already covers (extended here to a different set of scripts/symbols, not a new rule).
- **prevention**: R275 (new). R247 (existing) continues to cover the DOMContentLoaded-wrap template itself.

## P596 · v51.99 · `scripts/bump-version.mjs` has been silently corrupting historical version references in `_context/CLAUDE.md` on every single version bump

- **symptom**: While writing this session's own version-bump documentation (for P595, the commit right before this one), noticed `_context/CLAUDE.md`'s table row for `GATE-BASELINE-2026-07-03.md` read "v51.91→v51.98 헤드리스 CI 테스트 실측 기준선" — but that document was written during the Phase 2 [B5] / full-`/data-refresh` work that shipped as **v51.96**, not v51.98. The "→v51.98" endpoint was wrong; it should have read "→v51.96".
- **root_cause**: `scripts/bump-version.mjs` step 6 (patching `_context/CLAUDE.md`) has always done an unconditional `replaceAll(fileContent, prevVersion, newVersion)` across the **entire file** — not scoped to the "현재 버전" line the way step 5 (root `CLAUDE.md`) is. Every version bump therefore also silently rewrites any OTHER literal occurrence of the previous version string anywhere else in the document — including historical table rows that correctly cite an old version number as part of a fact (e.g. "this baseline doc was written as of v51.96"). Each subsequent bump compounds the error: this session alone ran the script twice before this was caught (v51.96→v51.97, then v51.97→v51.98), so the GATE-BASELINE row's endpoint got incorrectly advanced twice in a row (v51.96 → wrongly "v51.97" → wrongly "v51.98"), and root `CLAUDE.md`'s own v51.97 changelog-summary bullet (itself titled "v51.97 Sonnet 5 Phase 2 [B2] ...") got wrongly relabeled "v51.98" in the same way, from the *other* file's analogous (though narrower, warning-gated) fallback path. This is a **pre-existing bug in the script's design**, not something introduced by any recent content change — it would have silently corrupted historical text on every prior bump too, wherever a coincidental old-version-string match happened to exist elsewhere in the file.
- **fix**: Rewrote step 6 to mirror step 5's approach — try a precise regex scoped to the `**현재 버전**: vX.Y` line first; only fall back to a whole-file replace (now with an explicit console warning to manually review the result) if that specific line isn't found. Manually corrected the two already-corrupted instances found this session (`_context/CLAUDE.md`'s GATE-BASELINE row back to "v51.91→v51.96"; root `CLAUDE.md`'s v51.97 Phase 2 [B2] bullet header back to "v51.97"). Did not attempt to audit `_context/CLAUDE.md`'s entire history for older instances of this same corruption pattern predating this session — out of scope, flagged here for awareness if a future session notices another mismatched version reference in that file.
- **verification**: `node --check scripts/bump-version.mjs`. The very next version bump in this same session (v51.98→v51.99, for this postmortem's own commit) exercises the fixed precise-line path live — confirmed by inspecting `_context/CLAUDE.md` afterward to ensure only the "현재 버전" line changed and the (now-corrected) GATE-BASELINE row was left untouched.
- **violated_rule**: none pre-existing — this is exactly the kind of drift R1 (version-sync single-source-of-truth) is meant to prevent, but R1 never anticipated the sync *script itself* over-matching within a file it patches. No new rule number motivated (a tooling bug fix, not a new class of authoring mistake); noting here is sufficient since the fix is already applied.
- **prevention**: the fix itself (scoped regex + warn-on-fallback) is the prevention.

## P597 · v52.0 · Phase 3 [A2] step 2: converted the four core module scripts + glossary to `defer`, completing the roadmap item

- **motivation**: Fable's A2 diagnosis (`_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §3 A2): `js/aio-core.js`/`aio-data.js`/`aio-ui.js`/`aio-chat.js` loaded as plain synchronous `<script src>` tags, blocking HTML parsing while they download+parse+execute, unlike the three CDN libraries (Chart.js/DOMPurify/lightweight-charts) which already use `defer`. P595 (previous commit, same session) completed the prerequisite audit-and-guard work; this commit executes the actual conversion.
- **change**: added `defer` to all 5 script tags — `js/aio-core.js`, `js/aio-data.js`, `js/aio-ui.js`, `js/aio-chat.js`, and `js/aio-glossary.js` (the roadmap's "5개 스크립트," confirmed safe: its only top-level symbol, `GLOSSARY`, is referenced exactly once elsewhere in `index.html`, inside `renderGlossaryItems()`'s function body — call-time only, not parse-time). `defer` preserves relative document order among deferred scripts, so the core→data→ui→chat load-and-execute order is unchanged; only the *timing* relative to the 8 inline `<script>` blocks changes (now after all of them, at the point the browser would otherwise fire `DOMContentLoaded`).
- **verification**: (1) Re-ran the 22-route-page headless crawler built for P595, this time comparing the *original pre-A2* baseline (captured before any P595/P597 change existed) directly against the final defer-enabled state — `CHAT_CONTEXTS` key set (20 keys) and `_aioPageBus._getRegistry()` snapshot (61 registrations) came back **byte-identical**, and the same 2 pre-existing background-retry console messages appeared with the same total count. (2) `node scripts/ci-headless-tests.mjs` run twice post-defer: 896/921 both times, identical skip-list-only failure set, zero unexpected regressions. (3) Full local validate suite (`node --check` all files, all 9 `ci-*.mjs` gates) green.
- **measured performance impact**: built a small Playwright timing harness (`performance.getEntriesByType('navigation')[0]`, 5 reloads each, offline/seed-fallback, first run excluded as a JIT/cache-warmup outlier) and compared an isolated `git worktree` at the pre-A2 commit against the final defer-enabled state. `DOMContentLoaded`: ~351ms → ~344ms (no meaningful change — expected, since `<head>` already has `<link rel="preload" as="script">` for all four modules, so `defer` was never going to change *download* timing, only *parse+execute* timing relative to the parser). `load` event: **~14421ms → ~8498ms, a ~41% reduction** — larger than initially expected going in (the pre-work framing in this session assumed "modest gains" precisely because of the preload point above). The `load`-specific improvement likely reflects the browser being able to prioritize/parallelize other subresource loads once the main thread isn't repeatedly blocked by synchronous script execution interleaved through the document, rather than the module scripts' own fetch time. Numbers are from a local static server with near-zero network latency — relative improvement, not absolute production timing.
- **violated_rule**: none — this is the intended, planned outcome of executing Fable's A2 roadmap item, not a bug fix.
- **prevention**: n/a (feature/perf work, not a defect).

