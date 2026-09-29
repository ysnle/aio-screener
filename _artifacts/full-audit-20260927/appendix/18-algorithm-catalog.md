# AIO Screener — Algorithm / Score / Signal / Threshold Catalog

Read-only audit. Repo: C:\projects\AIO. Compiled from direct source reading (js/aio-core.js,
index.html, src/domain/**) plus three parallel research passes over js/aio-data.js +
js/aio-kr-data.js + js/aio-macro-tech.js, scripts/fetch-data.mjs + backtest scripts +
public-data/*validation*/*backtest* JSONs.

Legend for verdict: KEEP (sound as-is) / FIX (specify) / RENAME (misleading name) /
DEMOTE (show as reference-only, strip decision framing) / CUT.

---

## PART 0 — Headline finding (read this first)

**The codebase's own backtests already show the flagship "Trading Score" / environment score
has a statistically significant *negative* correlation with forward SPX returns at every
horizon tested (1d/5d/21d/63d), in both a 10-year walk-forward split and a live rolling
7-month reconstruction current as of 2026-09-26.** This is not an inferred concern — it is
computed and stored in `public-data/score-backtest-longrun.json` and
`public-data/score-backtest-history.json`, and the code's own gate files
(`public-data/model-validation-status.json`, `public-data/screener-validation-gate.json`)
already carry `status: "BLOCKED"` and `allowedUse: "research-relative-ranking-only"` /
`tradingSignal: false`. The team has done real, disciplined validation work and *correctly
labeled the result as failing* — the open problem is that the **user-facing UI does not
carry this verdict through**: the home page still renders a 0–100 "환경 점수" with green/amber/red
bands and a "매수 우호" style headline (`getScoreAdvice`, aio-core.js:23786), which reads as
actionable guidance despite one in-code comment (line 23787) explicitly saying the recent IC
is negative and the sample doesn't meet statistical criteria.

Numbers, for the record (source: score-backtest-longrun.json, 2016-08-15→2026-08-14, 2514
trading days; corroborated by score-backtest-history.json, live rolling, n=287-303,
as of 2026-09-26):
- fwd1d rho = -0.042 (CI [-0.081, -0.003])
- fwd5d rho = -0.095 (CI [-0.134, -0.056]); live rolling corr5d = -0.147 (n=303)
- fwd21d rho = -0.168 (CI [-0.206, -0.129]); live rolling corr21d = -0.28 (n=287)
- fwd63d rho = -0.263 (CI [-0.300, -0.226])
- Holdout period (2023-2026) corr21d = -0.175 — negative in both halves, not a one-regime artifact.
- A "relative-v1" percentile-threshold variant built specifically to rule out "absolute
  thresholds decaying across rate regimes" as the explanation still comes out negative and
  significant in most cuts.

Separately, `public-data/factor-backtest-longrun.json` (10y, top-120-mcap, 117 rebalances)
shows the composite screener factor score has **~zero IC at 21d/63d** (fwd21d IC = 0.000,
fwd63d IC = -0.013 — CIs straddle zero), and its `lowvol` sub-factor has a **significant
negative IC** at every horizon tested (i.e. "low realized volatility" as implemented predicts
the *opposite* of what a low-vol factor is supposed to predict in this sample).

This should reframe every entry below: several scores/labels are computed carefully and
displayed responsibly (fail-closed on missing data, no synthetic neutral fills, explicit
"reference-only" tags); but a handful of the most prominent ones are shown with directive
color-coded framing while the project's own evidence says they don't currently work as
predictive signals.

---

## PART 1 — Catalog

### 1. Trading Score / "환경 점수" (지금 매매해도 될까?)
- **Shown as**: home page primary card "지금 매매해도 될까?" (0-100ish composite, color-coded), signal page.
- **Computed**: `computeTradingScore()` wrapper, js/aio-core.js:23658-23783, delegates to
  `window.AIO_ARCH.computeTradingScoreModel` = **src/domain/signal/trading-score.js**
  (single implementation per RM-03 comment at aio-core.js:23721-23723 — this used to be
  duplicated and was consolidated).
- **Inputs**: VIX, VVIX, DXY, TNX(10Y yield), WTI oil, Fear&Greed, SPX price vs 50/200MA,
  breadth (% above 20SMA, mislabeled internally as "_breadth200"), put/call ratio, HY spread bp,
  news sentiment score, news risk flags. Each input passes through an evidence-gate
  (`getTradingDecisionInputEvidence`) that only allows `verified_current`/live values to affect
  the score — stale/snapshot data is excluded rather than backfilled. This fail-closed design is sound.
- **Formula**: componentized (vol/momentum/trend/breadth/macro sub-scores) inside
  trading-score.js; combined into `total`/`score` with `componentCoveragePct` and
  `decisionBlocked` when coverage < 80%. (See domain-catalog section below for exact weights,
  supplied by the src/domain research pass.)
- **Advice mapping** (`getScoreAdvice`, aio-core.js:23786-23795): ≥75 "환경 우호" (green) /
  ≥60 "환경 양호" / ≥45 "관망·보유" (neutral) / ≥30 "환경 불리" (amber) / else "환경 극단" (red).
  Tested boundaries: exact 30/45/60/75 land in the *upper* band each time (`score===30` →
  "환경 불리" not "환경 극단"); `score>100` or negative still resolves to a band with no
  range validation.
- **Origin of thresholds**: not stated; round numbers, no cited backtest optimization for the
  75/60/45/30 cut points themselves.
- **Validation evidence**: see Part 0 — negative IC at all horizons, both 10y walk-forward and
  live rolling backtest, current as of 2026-09-26.
- **Known correctness issue (self-documented)**: aio-core.js:23787-23788 comment: *"누적
  표본이 통계 기준에 못 미치고 최근 IC도 음수다. 이 점수는 예측/매수 신호가 아니라 현재
  시장 환경을 요약하는 설명형 상태 지표로만 안내한다."* (cumulative sample doesn't meet the
  statistical bar and recent IC is negative; this score is not a predictive/buy signal, only a
  descriptive state indicator) — this disclaimer is a code comment, **not shown to the user**
  next to the score itself; the visible copy ("환경 우호", green color, "매수 우호" framing in
  AIO_SCORE_SCALES) still reads as directive.
- **Displayed**: home (`#home-trading-signal`), signal page.
- **Conflicts**: see entries 2-4 below — at least three other "regime"/"score" concepts exist
  side-by-side with different formulas and label sets.
- **Verdict: FIX.** Keep the underlying evidence-gated computation (it's well engineered), but
  (a) surface the negative-IC finding in the UI itself, not just in a code comment, (b) drop the
  green/red directive coloring in favor of neutral framing, (c) consider renaming away from
  "환경 우호/불리" toward something that can't be read as "buy/sell now."

### 2. `getExecutionWindow` (Breakout Hold / Pullback Buy / Follow-Through / Leader Hold)
- **Computed**: `computeExecutionWindow()`, aio-core.js:23798-23876.
- **Inputs**: VIX, F&G, breadth (20/200SMA %), put/call ratio — same upstream metrics as
  Trading Score, but recombined with **independent, hand-picked linear adjustments** (not
  delegated to any src/domain model).
- **Formula** (all `[0,100]` clamped, four independent sub-scores averaged into `total`):
  - `breakoutHold`: base 65; `-25` if breadth<30; `-15` if VIX>25; `+10` if breadth>60 & VIX<20.
  - `pullbackBuy`: base 60; `-20` if F&G<20; `-15` if VIX>30; `+10` if F&G>45 & VIX<20.
  - `followThru`: base 55; `-20` if breadth<35; `-10` if VIX>22; `+10` if breadth>55 & VIX<22.
  - `leaderHold`: base 65; `-15` if breadth<40; `-10` if PCR>1.2.
  - `total = round(mean of the four)`; label via `NONE<30≤LOW<50≤WEAK<65≤MOD<80≤HIGH`.
- **Origin of thresholds**: none cited. A v46.9 comment (line 23829) says the baseline was
  deliberately raised "so a neutral market resolves to MOD(65)" — **tested and this doesn't
  hold**: synthetic "textbook neutral" inputs (VIX 18, F&G 50, breadth 45, PCR 1.0) produce
  `total=64`, one point short of the intended MOD(65) cutoff, landing in WEAK instead. Minor,
  but shows the calibration comment doesn't match current behavior.
- **Threshold-cliff issue (tested)**: `breadth200` crossing 30 flips `breakoutHold` by a full 25
  points in one step (65→40) with no interpolation — e.g. breadth=30 gives 65, breadth=29.999
  gives 40. Same all-or-nothing step pattern on every sub-formula's cut points.
- **Validation evidence**: none found — no backtest script or JSON references
  `computeExecutionWindow`, `breakoutHold`, `pullbackBuy`, etc. This looks like a pure
  hand-authored heuristic never checked against outcomes.
- **Displayed**: `#ew-breakout`, `#ew-pullback`, `#ew-followthru`, `#ew-leaders` (signal/home
  execution-window widget).
- **Verdict: DEMOTE or CUT.** No validation evidence exists for this score at all (unlike
  Trading Score, which was at least tested and found negative). Recommend either removing it or
  clearly labeling it "unvalidated heuristic, not derived from the same evidence pipeline as
  other scores," and smoothing the hard cliffs into continuous functions.

### 3. `classifyMarketRegime()` — home "시장 국면 (Regime)" card
- **Computed**: aio-core.js:23879-23923.
- **Inputs**: SPX close-basis price, 50MA, 200MA (only used if refreshed within 96h), breadth
  (20SMA-above %, only if `verified_current`).
- **Formula**: a 4-branch boolean decision tree, evaluated in order:
  1. any required input missing/stale → `DATA_CHECK` / "근거 확인 필요"
  2. `spx>50ma AND breadth>55` → `UPTREND` "상승 추세"
  3. `spx<200ma AND breadth<30` → `DOWNTREND` "하락 추세"
  4. `spx<50ma AND spx>200ma` → `CORRECTION` "세속 상승장 내 순환적 조정"
  5. else → `CHOP` "횡보·혼조"
- **Tested boundary**: with SPX above both MAs, breadth=56 → UPTREND; breadth=54 (2 points
  lower) → CHOP. A 2-point breadth wobble around 55 flips the headline regime label with no
  hysteresis/smoothing — this will visibly "flap" on ordinary daily breadth noise.
- **Conflict — same-named concept, different formula, same page**: the home page markup's own
  tooltip for this exact card (index.html:6521) reads *"Market Regime (4단계) = 200일선
  기울기 30점 + 가격 vs 200일선 25점 + Breadth 25점 + VIX 20점"* — a weighted 0-100 score
  with bands `UPTREND≥75 / NEUTRAL≥50 / CAUTION≥25 / BEAR<25` (this is
  `AIO_WEIGHT_REGISTRY.MARKET_REGIME`, aio-core.js:14435-14450). **The actual function backing
  the card ignores VIX entirely, never computes a "200MA slope," and uses different regime
  codes/labels (UPTREND/DOWNTREND/CORRECTION/CHOP vs. the tooltip's UPTREND/NEUTRAL/CAUTION/
  BEAR).** The tooltip a user hovers to understand the badge describes a formula the code does
  not run.
- **Second, unrelated regime classifier on the same page bus**: `window.AIO.getCurrentMarketRegime`
  (aio-core.js:23941-23980) computes yet a *third* definition — `riskScore = 50 + spxPct*8 +
  nasPct*4 - max(0,vix-18)*2.2 + hygPct*5`, `rateStress = max(0,tnx-4.25)*30 + max(0,dxy-102)*2 +
  max(0,krw-1450)/8`, output `risk-on` / `risk-off` / `mixed` — entirely different inputs
  (uses %-change not levels), entirely different label vocabulary, entirely hand-picked
  coefficients (8, 4, 2.2, 5, 30, 2, 1/8) with no stated origin. A fourth,
  KR-market-specific version, `window.AIO.getKrMarketTemperature` (aio-core.js:23982+), repeats
  the same pattern with its own arbitrary constants (kospiPct*8, kosdaqPct*3, vkospi penalty
  ×1.5, deposit/credit retail-sentiment formula).
- **Origin of thresholds**: none cited for any of the four variants; all hand-picked round
  numbers.
- **Validation evidence**: none found for any of the four "regime" formulas.
- **Displayed**: home `#regime-badge`/`#regime-label`/`#regime-sub` (classifyMarketRegime);
  `getCurrentMarketRegime`/`getKrMarketTemperature` appear to feed AI-chat market-state context
  rather than a visible card, but were not confirmed as UI-invisible in this pass — worth a
  follow-up grep for their call sites.
- **Verdict: FIX (RENAME).** Pick exactly one "Market Regime" definition, delete or clearly
  differentiate the others (e.g. rename `getCurrentMarketRegime`'s output to something like
  "Risk-On/Off Pulse" so it's not confused with the home-page Regime badge), and correct the
  tooltip to match whichever implementation is kept. This is the single clearest "same concept,
  computed 2+ inconsistent ways" finding in the whole catalog.

### 4. AIO_THRESHOLD_REGISTRY (single-indicator label bands: VIX / F&G / HY spread / AAII / SKEW / Breadth / RSI / DXY / 10Y yield)
- **Computed**: aio-core.js:14024-14181, `window.AIO_THRESHOLD_REGISTRY`, version tag 'v49.24'.
  This is a **good pattern**: one canonical band table per metric with a shared `getLabel()`,
  explicitly built (per its header comment, v49.25 L2/L8) to stop breadth/RSI thresholds from
  being redefined inconsistently across pages.
- **Exact bands** (all tested for boundary behavior — `v < band.max` semantics, so the
  printed "<X" comment values are honored exactly):
  - VIX: <12 극단안정 / <20 정상Risk-On / <25 주의 / <30 경계 / <40 공포 / ≥40 극단공포
  - Fear&Greed: <25 극단공포(매수기회 framing) / <45 공포 / <55 중립 / <75 탐욕 / <101 극단탐욕(매도기회 framing)
  - HY spread(bp): <300 Tight→Complacent / <450 Normal / <600 Wide→Caution / ≥600 Stress
  - AAII bull-bear spread(%): <-20 극단비관 / <-5 중정도비관 / <5 중립 / <20 중정도낙관 / ≥20 극단낙관
  - SKEW: <3 약함 / <5 보통 / <8 강함 / ≥8 극단
  - Breadth(% above 50MA): <15 역사적바닥 / <30 위험 / <50 혼조 / <70 양호 / ≥70 과열
  - RSI(14): <30 과매도 / <40 약세 / <60 중립 / <70 강세 / <80 과매수 / ≥80 극단과매수
  - DXY: <95 약세-RiskOn / <100 중립 / <105 강세 / <110 Risk역풍 / ≥110 극단강세
  - 10Y yield: <3 경기둔화 / <4 정상 / <4.5 밸류에이션부담 / <5 위험 / ≥5 시스템압력
- **Origin of thresholds**: none of these cite a source (no "per CBOE," no backtest reference,
  no literature). They read as reasonable market-convention round numbers (VIX 20/30 and RSI
  30/70 are genuinely standard conventions; HY spread/DXY/10Y/AAII bands look hand-picked by
  the team specifically for this app — the AAII band comment even documents the team narrowing
  -10/+10 to -5/+5 "to catch weaker pessimism signals" (v49.58 P196/P219), i.e. a judgment call, not a fit).
- **Validation evidence**: none — no backtest ties these exact cut points to forward returns.
- **Known bug class (tested)**: no negative-value guards. `VIX=-5` (physically impossible but
  possible from a bad feed/parse) silently resolves to "극단 안정" (safest label) rather than
  an error/unknown state — a bad or corrupted VIX read would show the *most reassuring* label,
  not a warning.
- **Displayed**: sentiment, breadth, macro, fxbond, technical pages (RSI card), home tooltips.
- **Verdict: KEEP the pattern** (single source of truth is the right architecture), **FIX** the
  missing input-sanity guard (reject clearly-impossible values like negative VIX/RSI outside
  0-100/DXY outside a sane range instead of silently banding them), and consider explicitly
  labeling which bands are literature-standard (VIX, RSI) vs. team judgment calls (AAII, HY,
  DXY, 10Y) so users can weight their trust accordingly.

### 5. AIO_ACTION_RULES (position sizing % by VIX / sentiment action by F&G)
- **Computed**: aio-core.js:14188-14252, version 'v53.1'.
- **This entry is the strongest self-correction found in the codebase.** A large comment block
  (lines 14190-14194) states explicitly: up through v49.27 this object rendered directive
  language ("reduce position to X%", "hedge with puts required", "contrarian buy") as if it
  were a system instruction; the team found the underlying inputs' (VIX/F&G absolute bands)
  predictive power **"has never been validated (and WO-2 shows negative correlation in a
  similar input family)"**, and rewrote every string into descriptive/historical framing
  ("frameworks have historically discussed...", never an imperative). `sizePct` values (100/
  80/50/30/15 by VIX band) are kept only as reference data, explicitly **not used to drive any
  directive rendering** anymore.
- **Verdict: KEEP as reformed.** This is exactly the pattern the rest of the catalog should
  move toward — the team already knows how to do this correctly here.

### 6. AIO_WEIGHT_REGISTRY (documented weights for Trading Score / Quality Score / Market Regime)
- **Computed**: aio-core.js:14411-14457, version 'v49.26', built explicitly (per header comment)
  to stop "0-100 range shown but component weights undocumented" complaints.
- **TRADING_SCORE (20pt)**: Trend Template 8 + Relative Strength(IBD RS 1-99) 4 + Volume
  Profile 3 + Volatility 3 + Breakout 2. **This does not match the component set actually
  computed by `computeTradingScoreModel`** (vol/momentum/trend/breadth/macro, per
  computeTradingScore's `modelResult` fields at aio-core.js:23771-23772) — different component
  names and a different point scale (20pt here vs. the 0-100 scale actually rendered via
  `getScoreAdvice`). This registry entry looks like a stale description of an older
  scoring formula that trading-score.js has since replaced. Needs the domain-catalog
  cross-check below to confirm exactly how stale.
- **QUALITY_SCORE (100pt)**: 50일선위비율 25 + A/D Line 20 + NHNL 20 + McClellan 20 + RSP/SPY
  15. **Confirmed broken in production**: the McClellan component (20/100 = a fifth of the
  score) is displayed elsewhere on the same breadth page as *"공식 McClellan은 현재
  미제공"* / *"A/D 시계열 원천 미수신"* (official McClellan currently not provided / A/D
  time-series source not received — index.html:12561, 12781, 7513-7521). The home page's
  actual Quality Score renderer (`renderHomeQuality`, src/ui/pages/analysis.js:180-209) does
  fail closed correctly (shows "—" / "판정 보류" when `quality.score` is null rather than
  faking a value), so this isn't silently biasing a shown number — but the **documented
  formula in the tooltip claims a component that the live system cannot currently supply**,
  which is misleading documentation even though the runtime behavior is safe.
- **MARKET_REGIME (100pt, weighted)**: see entry 3 above — does not match the regime badge's
  actual decision-tree implementation.
- **Origin of thresholds/weights**: unstated for all three; round numbers.
- **Verdict: FIX.** Good intent (single documented source), but at least 2 of 3 entries
  (TRADING_SCORE, MARKET_REGIME) appear to describe formulas the current runtime doesn't
  actually run, and QUALITY_SCORE documents a component (McClellan) currently unavailable.
  This registry needs to be regenerated from the actual current implementations, or the
  implementations need to be reconciled to it — right now it's decorative documentation that
  has drifted from the code it claims to describe.

### 7. `window.AIO.diagnoseBreadthConsensus` — Breadth 종합 진단 (5SMA/20SMA/50SMA/McClellan/Weinstein/GoldenCross)
- **Computed**: aio-core.js:14949-14994.
- **Formula**: weighted average of per-signal scores in {-1,-0.5,0,0.5,1}, weights
  `{sma5:.10, sma20:.20, sma50:.30, mcclellan:.20, weinstein:.10, goldenCross:.10}`; **missing
  signals are correctly excluded from both numerator and denominator** (renormalized, not
  zero-filled) — good defensive design, unlike the static QUALITY_SCORE registry above.
  Verdict bands: >0.4 강세합의 / >0.1 강세우위 / >-0.1 혼조(모순신호존재) / >-0.4 약세우위 /
  else 약세합의. Also separately flags "conflict" whenever both positive- and negative-scoring
  signals are present simultaneously.
- **Self-documented bug history**: comment at v50.20 (line 14984) notes a **prior sign-flip
  bug** — the 0.1-0.4 "consensus" band used to be mislabeled "약세 우위" (bearish-leaning)
  when it should read "강세 우위" (bullish-leaning); this shipped backwards for some period
  before being caught and fixed.
- **Validation evidence**: none — this is an internal-consistency aggregator over other labels,
  not itself back-tested against returns.
- **Verdict: KEEP** (sound weighting/renormalization design, self-corrected known bug), but
  note in the audit that its weighted average of five *also-unvalidated* single-indicator
  labels doesn't inherit any predictive validity just because the aggregation math is careful.

### 8. Piotroski F-Score checklist (fundamental page)
- **Computed**: `window.AIO_PIOTROSKI_CHECKLIST`, aio-core.js:14529-14568, version 'v49.25'.
  Standard 9-item Piotroski F-Score (profitability 4 + leverage 3 + efficiency 2 = 9), each a
  boolean YoY check (positive NI, positive ROA, positive CFO, CFO>NI, declining LT debt,
  rising current ratio, no share dilution, rising gross margin, rising asset turnover).
- **Origin**: this *is* the standard academic Piotroski (2000) F-Score methodology — literature
  standard, correctly implemented as boolean checks.
- **Verdict mapping (AIO's own addition, not part of the original paper)**: ≥8 우수(excellent) /
  ≥5 양호(good) / ≥3 주의(caution) / else 위험(danger). The original Piotroski paper's own
  empirical cutoffs were 8-9 (strong) vs 0-2 (weak); AIO's 3-tier-plus-danger banding in the
  middle (3-4 = "주의", 5-7 = "양호") is an AIO-specific interpretive choice layered on top of
  a legitimate score, not itself literature-sourced.
- **Verdict: KEEP** the F-Score computation (correct, standard); **DEMOTE/rename** the verdict
  labels slightly, or add a one-line note that the pass/caution/danger banding is AIO's own
  interpretation of the raw 0-9 score, not part of the original methodology.

### 9. Technical indicators — RSI(14) / MACD(12,26,9) / Bollinger Bands(20,2) / ATR(14) / VCP
- **Computed**: aio-core.js:20381-20630 (`_calcATR`, `_calcRSILast`, `_calcMACD`, `_calcBB`,
  `_calcVCP`, `_calcRSISeries`, `_calcRSIDivergence`).
- **RSI**: standard Wilder's smoothing, matches TA-Lib/TradingView convention. **Tested edge
  case**: a perfectly flat price series (no movement at all, e.g. a halted/illiquid stock)
  returns RSI=100 ("avgLoss===0" branch) — mathematically correct per the formula, but this
  means a stock with *zero* price movement gets labeled "극단 과매수" (extreme overbought) by
  THRESHOLD_REGISTRY.RSI, which is a misleading read for a user glancing at the label. Not a
  bug, but a known quirk worth a UI guard (e.g. suppress the band label when volume/range is
  also ~0).
- **MACD**: standard 12/26/9 EMA construction; tested boundary (exactly `slow+signal` bars
  short) correctly returns `null` rather than a degenerate partial value.
- **Bollinger Bands**: **explicitly documents a prior methodology bug and its fix** —
  aio-core.js:20457-20460 comment: v51.47 had "corrected" the variance denominator to `n-1`
  (sample variance), but this was reverted in v51.88/R265 back to `n` (population variance),
  because that's the actual John Bollinger / TA-Lib / TradingView standard, and the `n-1`
  "correction" had silently widened bands by ~+2.6% and skewed %B/touch signals versus the
  named methodology. Tested: flat-price input correctly defaults `pctB` to 0.5 rather than
  dividing by zero.
- **ATR**: standard Wilder ATR. **Tested edge case with real consequence**: an all-flat OHLC
  series (identical high/low/close, e.g. a halted stock or bad feed) returns `ATR=0`. This
  value feeds `AIO_ATR_PRESETS.getStop()` (aio-core.js:14509-14523,
  `stop = high - atr*multiplier`), which with ATR=0 returns **`stop = high` — a stop-loss
  suggestion sitting exactly at the day's high**, i.e. immediately triggered / meaningless.
  There is no floor/guard against ATR=0 or near-0 anywhere in `getStop()`.
- **VCP (Volatility Contraction Pattern)**: Mark Minervini methodology (named in a v51.68
  comment), reasonable implementation of Stage-2 filter + swing-pivot contraction detection +
  volume-dry-up + pivot breakout, scored 25+20+15+10+10=100 (weights hand-picked, no cited
  optimization). **Tested with a synthetic 220-bar stage-2-uptrend-with-late-contraction
  series**: `stage2` correctly detected true, but `contractionCount` came back 0 and
  `isShrinking` false despite the series being deliberately built to contract — the swing-pivot
  detector (strict N=4-bar local extremum) appears brittle to anything short of very clean,
  low-noise price action; this needs testing against real historical VCP setups (e.g. known
  past NVDA/AAPL base examples) before it can be trusted as a pattern detector, not just as a
  Stage-2 filter.
- **Verdict: KEEP** RSI/MACD/BB/ATR core math (standard, well-tested, BB even has a documented
  self-correction story). **FIX** `AIO_ATR_PRESETS.getStop()` to guard against ATR≈0. **FIX/
  DEMOTE** VCP's `vcpScore`/`contractionCount` — plausible methodology, unvalidated weights,
  and swing-detection that may be too strict for real noisy data; needs backtesting against
  known setups before being shown as anything more than "Stage 2: yes/no."

### 10. McClellan Oscillator / Summation Index — label semantics
- **Computed**: weight registry entry only (aio-core.js:14430); **no live calculation function
  was found in aio-core.js, aio-data.js, or index.html** — every user-facing reference
  (index.html:7065, 7484-7521, 12561, 12781) currently reads "McClellan(원천 대기)" /
  "McClellan Summation … A/D 시계열 원천 미수신" (source pending / not received). This is a
  **displayed-but-not-computed** indicator: the UI has cards and copy for it, `QUALITY_SCORE`
  weights 20/100 points to it, `diagnoseBreadthConsensus` has a 20% weight slot for it — but
  the underlying A-D EMA(19)/EMA(39) time series is not currently sourced anywhere in this
  codebase (no free real-time A-D line feed).
- **Self-documented past bug**: v49.41/P300 finding (aio-core.js:10002 area, and mirrored in
  index.html:7513) explicitly records that the card used to mix the **Summation Index**
  (long-run cumulative sum, unbounded) definition with the **Oscillator** (short-run ±100
  bounded) definition in the same label/explanation text ("0 위/아래 = 매수/하락 에너지"),
  which the team correctly identified as a "사용자 해석 오류 위험" (user misinterpretation
  risk) and fixed by separating the two names and adding an explicit distinguishing note.
- **Verdict: CUT the weight allocations that reference it** (in QUALITY_SCORE and
  diagnoseBreadthConsensus) until a real A-D time-series source is wired up, or **DEMOTE** the
  card to an explicit "not yet available" placeholder that doesn't carry a phantom 20-point
  weight in any documented formula. Right now a user reading the Quality Score tooltip is told
  a fifth of the score comes from an indicator that cannot currently be computed at all.

---

## PART 2 — Findings from parallel research passes (src/domain/**, js/aio-data.js /
js/aio-kr-data.js / js/aio-macro-tech.js, scripts/fetch-data.mjs + validation JSONs)

Three sub-agents independently read every file in scope (src/domain/** in full except a few
grep-only infra files; the three legacy files in full). Full per-entry tables below,
condensed from their reports; file:line citations preserved throughout.

### 2a. scripts/fetch-data.mjs — server-side factor model (COMP_W, Kalman, momentum/trend/lowvol)
- `_kalmanTrend` (fetch-data.mjs:2086-2119): 2-state (level, velocity) Kalman filter over the
  last 90 log-closes; process noise `Q_level=1e-4, Q_vel=1e-5` are **hand-set magic numbers**,
  no cited derivation; observation noise `R` is derived from the asset's own trailing 60d
  volatility (reasonable design choice).
- `COMP_W = {mom:0.370, trend:0.274, lowvol:0.219, kalman:0.137}` (fetch-data.mjs:2245): **not
  independently fit** — the code comment (~L2241-2244) states this is a proportional rescale of
  the *live client-side* "NEUTRAL" default weight subset (`momentum:.27, trend:.20, lowvol:.16,
  kalman:.10`, confirmed at js/aio-data.js:15481) divided by 0.73 (the subset's share of the
  full 7-factor weight set, which also includes size/value/quality at 0.08/0.10/0.09 — excluded
  here only because point-in-time historical fundamentals aren't available for backtesting, per
  an explicit look-ahead-bias comment at fetch-data.mjs L2246). **The live NEUTRAL weights
  themselves have no stated origin either** — they are the actual root of both the live score
  and the backtest weighting, and neither is shown to be literature- or optimization-derived.
- The composite factor score's own payload **already ships a self-declared non-endorsement**:
  `rankingContract` (fetch-data.mjs:3156-3168) sets `allowedUse: 'research-relative-ranking-
  only'`, `tradingSignal: false`, `predictiveValidation: 'not-established'`, with a `reason`
  field stating the long-run composite IC "is not positive/stable." This is written into the
  live `screener.json` artifact the site actually serves.
- `size`/`value`/`quality` factors are named in an `EXCLUDED_FACTORS` list and are **not
  backtested at all** (fetch-data.mjs:2246) — zero backtest evidence behind that exposure, by
  the code's own admission.

### 2b. Backtest scripts & validation JSONs (full numbers in Part 0 above)
- `scripts/backtest-factors-longrun.mjs`, `backtest-trading-score.mjs`,
  `backtest-trading-score-longrun.mjs` — real, methodologically disciplined (walk-forward
  splits, regime buckets, explicit survivorship/look-ahead caveats in comments). Two of the
  three longrun scripts are **manual/research-only, not on the 30-min cron**
  (factor-backtest-longrun stale ~2.5 months as of this audit; score-backtest-longrun stale
  ~6 weeks); the two rolling "-history" companions **are** on a live cadence and, as of
  2026-09-26, corroborate rather than contradict the stale longrun findings.
- `model-validation-status.json` / `screener-validation-gate.json`: real structured gates,
  `status:"BLOCKED"`, both static/hand-authored as of 2026-08-13 — not confirmed to be
  automatically re-derived by any script, so they could silently drift out of sync with the
  backtest artifacts they summarize if nobody revisits them.

### 2c. src/domain/** — canonical (ESM) implementations
Confirmed: `signal/trading-score.js`, `technical/stage.js`, `themes/rrg.js`,
`portfolio/concentration.js`, `news/scoring.js`, and `screener/factor-ranks.js` are explicit,
comment-documented **pure-function extractions ("code motion, not a new model")** of legacy
formulas from js/aio-core.js / js/aio-data.js / index.html, done under an internal rule cited
as "R352/F-03: legacy and native must not diverge into two different formulas." Where this
consolidation is complete, aio-core.js/aio-data.js now call the ESM version rather than keeping
a second formula (confirmed directly for Trading Score — see Part 1 §1). `factor-ranks.js` is a
partial exception: js/aio-data.js "still owns profile/storage lookup and projects the result
onto SCREENER_DB," i.e. a live compatibility wrapper persists alongside the ESM module.

Key entries (abbreviated from the full sub-agent table — every formula below has an exact
file:line citation in the sub-agent transcripts):

| Name | Location | Formula highlights | Validation / gating |
|---|---|---|---|
| Trading Score (`computeTradingScoreModel`) | signal/trading-score.js:76-284 | 5 weighted components (vol 25%/mom 25%/trend 20%/breadth 20%/macro 10%) each binned into hand-picked step functions (e.g. VIX<15→90,<18→78,<22→62,<27→42,<35→22,else 8), plus additive post-adjustments for credit stress, oil, news sentiment (±8) and news risk (clamped ±30), floor 5/ceiling 100 | `predictiveValidation:'not-established'` hardcoded; `decisionEligible` forced false; comment: "long-run validation artifact is explicitly non-significant" |
| WATCH/WAIT/REDUCE decision (`deriveSignalDecisionFromTradingScore`) | signal/trading-score.js:291-327 | Bands total into 5 Korean tiers (favorable/constructive/neutral/caution/defensive) *and separately* a coarse WATCH/WAIT/REDUCE action — kept deliberately distinct per comment, to avoid a second implicit scoring model | Action only emitted if `decisionEligible` — which is always false today, so action defaults to NO_ACTION in production |
| Factor Ranks (7-factor: momentum/trend/lowvol/size/value/quality/kalman) | screener/factor-ranks.js:359-732 | Sector-relative z-scores (MAD-winsorized at z>6), default weights `mom .32/trend .23/lowvol .18/size .18/value 0/quality 0/kalman .09`; two *different* 0-100 scales explicitly kept apart by design: `factorScores` (z→`round(50+16.67z)`) vs. composite `rank` (tie-aware midrank percentile) — comment: "the two concepts must never be presented under one name" | `decisionEligible:false`, `tradingSignal:false`, `autoWeightPromotion:false` always; `allowedUse:'research-relative-ranking-only'` |
| Factor weight regime blend | screener/factor-weights.js:28-94 | Lerps NEUTRAL↔RISK_OFF↔RISK_ON weight vectors by a riskScore-derived blend factor + regex override on F&G/VIX text | Adaptive blend is **computed but never applied** — requires a promotion record with `liveBacktestParity===true && reviewApproved===true` that the comment says doesn't exist; production always runs NEUTRAL weights, though a "중립 고정 · 미검증 후보" labeled proposal is still shown |
| Regime state (RISK_ON/NEUTRAL/RISK_OFF) | screener/regime.js:14-58 | Normalizes 5 inputs to [-1,1], hysteresis enter/exit (±0.35 enter, ±0.10 exit) + 2-day min-hold | `allowedUse:'reference-only'` always |
| Conditional evidence (gap-fill / opening-range / seasonality stats) | screener/conditional-evidence.js:176-259 | Wilson 95% CI (z=1.96, a real statistical method) on historical success rate; REFUSE if n<10, WARN if n<30 | `decisionEligible:false`; UI copy states outright "과거 조건부 빈도이며 예측이나 투자조언이 아닙니다" (past conditional frequency, not prediction/advice) |
| MA-stack Stage classification (Weinstein-style) | technical/stage.js:39-173 | Structural MA-ordering score (max 83) → STAGE_1..4 | Structural, not tuned-numeric; explicitly retired a prior "toy" `deriveTechnicalModel` described in its own removal note as "independently invented, no legacy formula behind it at all" |
| RRG quadrant (Leading/Improving/Weakening/Lagging) | themes/rrg.js:12-61 | Classic JdK-style RS-Ratio/RS-Momentum (100-centered), needs ≥20 history points else 'unknown' | Matches standard RRG methodology; no predictive claim made |
| Market Health grade (A+ to F) | market/health.js:74-207 | Base 50 + per-component additive score (SPY/QQQ/VIX/M7-leadership/SPX-trend/sector-breadth), **each component individually gated behind its own 80% coverage requirement** — a missing dimension is left `null`, never defaulted to a fabricated neutral 50 (explicit anti-pattern fix documented in a comment) | Grade bands ≥80 A+/≥65 A/≥50 B/≥35 C/≥20 D/else F, hand-picked, no citation |
| Breadth participation (broad/neutral/narrow) | market/breadth.js:59-79 | sma20/sma50 %-above-universe level+direction | Explicit disclaimer in the code: "still not official exchange A/D data and must not be called McClellan or an exchange-wide breadth stage" |
| Portfolio backtest lab (Sharpe/Sortino/Alpha/Beta/VaR/CVaR/MDD) | portfolio/backtest.js:79-1114 | Standard formulas; VaR/CVaR use a **bootstrap self-certification** (400 iterations, deterministic seed, requires n≥36, tail-n≥3, relative band ≤0.75, sensitivity ≤0.5 before being shown as "certified" rather than merely "held") | `allowedUse:'reference-only'`, `decisionEligible:false`; refuses outright (rather than estimating) on <14 common months, missing FX legs, undeclared currency, gaps in the monthly grid |
| Concentration penalty (portfolio) | portfolio/concentration.js:39-43 | Tiered: weight≥25%→18pt penalty, ≥15%→10, ≥10%→5, else 0 | Confirmed as the **real legacy tiers** (10/15/25%) from js/aio-core.js — explicitly contrasted against a separately-discovered, now-retired "toy" implementation that had invented an unrelated 20/40% band with zero real callers |
| News sentiment / risk signals | news/scoring.js:122-196 | Keyword bull/bear counting → `score=round(50+((bull-bear)/total)*50)`; min sample gate `MIN_NEWS_ANALYSIS_SAMPLE=5` | Feeds directly into Trading Score's post-composite adjustment (±8 sentiment, ±30 risk, clamped) — **an uncited keyword-count heuristic can move the headline score by up to 30+ points**, though gated behind the same decisionEligible=false |

**Confirmed, dated historical bug** (portfolio/backtest.js:294-300): the Sortino ratio's
denominator used to divide by (downside-observation-count − 1) instead of total sample size N;
comment states this **understated Sortino by ~46%** in a measured 24-month test (0.83 vs.
correct 1.54). Fixed 2026 (v51.86/P574/R265) to match the cited "Sortino & Price (1994) /
Portfolio Visualizer" convention. Any saved/screenshotted Sortino figures from before that fix
are stale and understated.

**Good-governance pattern worth preserving and extending**: `window.AIO.getQuantReadinessAudit()`
(js/aio-data.js:15529-15566) explicitly gates factor-rank output into
`trading_ready`/`research_only`/`blocked` states, refusing the `trading_ready` label unless
`tradingSignal===true`, `liveModelParity===true`, and `predictiveValidation==='established'`
are *all* true — none are, today. Similarly `_scrSignalLabel` (aio-data.js:2099-2101)
deliberately renames an internal BUY/SELL enum to descriptive "강세 구조/약세 구조" (bullish/
bearish structure) specifically per a documented policy against "시스템 발화형 매매 지시
금지" (no imperative system-issued trading instructions) — the same spirit as the
AIO_ACTION_RULES rewrite in Part 1 §5. These three examples (AIO_ACTION_RULES,
getQuantReadinessAudit, _scrSignalLabel) show the team already knows the right pattern; it just
isn't applied uniformly yet (Execution Window, updatePatternSignals, computeEconomicTemperature,
updateMacroRegimePill, and the home-page Trading Score's visible copy are the main
counter-examples).

### 2d. js/aio-data.js / js/aio-kr-data.js / js/aio-macro-tech.js — legacy layer still holding
independent formulas

Unlike the fully-consolidated items above, several scores in this layer are **not** delegated
to src/domain and remain independent, hand-tuned implementations:

| Name | Location | Formula highlights | Issues |
|---|---|---|---|
| News importance score (`scoreItem`) | aio-data.js:9369-9753 | Log-scaled keyword-hit bonuses (macro/tech/med/analyst), source-tier bonus, country/tier boosts, mega/large-cap ticker boosts, freshness decay, urgent-keyword/key-figure/priority-topic bonuses, politics-only and clickbait penalties — dozens of hand-tuned magic numbers accumulated over ~10 point releases (v30.12→v48.95) | No calibration method stated anywhere; determines which news users are shown/told is "important" |
| News topic classification | aio-data.js:9756-9782 | argmax of keyword-hit counts | Simple bag-of-words, low risk |
| News sentiment from text (legacy) | aio-data.js:9785-9801 | ~10-word bull/bear keyword lists, requires >1-count margin to call bull/bear | Small hand-picked lists, asymmetric margin undocumented |
| News "impact vector" / urgency score | aio-data.js:9327-9367 | Regex factor classification + base urgency 20 + factor bonus 14-25 + sentiment/tier adjustment | No validation; feeds AI chat context as if a structured measurement |
| "다각화 추천" (diversified recommendation) ranking | aio-data.js:16635-16706 | `score = rank + signalScore(BUY:18/WATCH:8/HOLD:2) + rsiScore + capScore + liveScore − repeatPenalty(25)`, then per-sector/per-market caps | Unvalidated ad hoc re-ranking, surfaced to users via AI chat "추천해줘" queries as if it were a deliberate diversified pick list |
| NL screener query parser RSI bucket | aio-data.js:16708-16814 | 과매도(oversold) ≤35, 과매수(overbought) ≥65 | **Inconsistent with the 30/70 convention used elsewhere in the same app** (e.g. aio-macro-tech.js:176 uses RSI>70/<30) — same indicator, two different "overbought" definitions depending on which feature answers the query |
| `vixRegime()` | aio-data.js:14245-14253 | <12 Subdued/<16 Low/<20 Normal/<25 Elevated/<30 Stressed/<40 Crisis/else Extreme | **One of at least 4 different VIX bucket sets** in the app — see cross-cutting finding below |
| Home-dashboard inline VIX status | aio-data.js:15815 | <15 안정/<20 주의/<25 경계/<30 공포/else 극단공포 | Different cut points than `vixRegime()`, `AIO_THRESHOLD_REGISTRY.VIX` (Part 1 §4), and the macro-tech pattern engine — 4 sets total for the same metric |
| 엔캐리 청산 리스크 ("carry unwind risk") | aio-data.js:16466-16525 | Additive band score from USD/JPY, VIX, US10Y-BOK diff, HY OAS, capped at 100 | Coefficients uncited, but output text explicitly self-labels "단순 규칙값"/"관측 프록시" (simple rule-based value / observation proxy) — good disclaimer discipline despite uncited constants |
| Economic Temperature | aio-macro-tech.js:834-949 | Weighted VIX 30%/Curve 25%/Oil 20%/DXY 15%/Credit 10% + ad hoc cross-term penalties ("triple hawk" combo, etc.) → 과열/뜨거움/정상/차가움/극도로 차가움 | No citation for weights or cross-terms, but narrative explicitly self-disclaims: "이 점수는 과거 패턴이나 미래 조정을 보장하지 않으며... 신호가 아닙니다" |
| Macro Regime Pill | aio-macro-tech.js:952-996 | `score=50+(20-VIX)*2+curve/oil/DXY/SPY adjustments`, unbounded (no explicit clamp found), bands Risk-On>75/Mixed>50/Cautious>25/else Risk-Off | **A third independent regime score**, different inputs/weights from both Economic Temperature (same file) and classifyMarketRegime/getCurrentMarketRegime (aio-core.js) — not funneled through the AIO_ARCH single-implementation pattern used elsewhere |
| Pattern Signal Engine | aio-macro-tech.js:379-612 | ~15 independent rule blocks (VIX panic/fear/warning/complacency tiers, gap-size tiers, sector-rotation diffs, XLF leadership, Gold+DXY co-move, Brent-WTI spread, HYG crisis levels) | **Highest-risk item found in this pass**: narrates outputs with specific, uncited historical-frequency and analog claims — "2007년 하반기, 2019년 하반기에 유사 패턴," "2008, 2020년 위기 때와 유사한 수준," "연간 3~5회 정도만 발생하는 희소한 이벤트" — with no dataset or backtest anywhere backing those specific numbers. Reads as validated pattern-recognition; is actually an uncited if/else chain. |
| KR theme strength bands | aio-kr-data.js:379-484 | avg %chg bands (≥3 매우강세…else 급락) + up/down-ratio "건강도" bands + spread bands | Auto-generates confident causal narrative ("외국인·기관 동반 매수가 집중될 수 있으나...") from pure arithmetic, no flow/positioning data behind the claim |
| VKOSPI fear bands | aio-kr-data.js:1043-1046 | ≥35 극단공포/≥25 공포/≥20 경계/else 정상 | Comment states this was deliberately standardized to match `calcKrHealth` elsewhere (intra-KR consistency effort) — better governed than the 4-way US VIX split, but still no external citation for the specific cut points |

### 2e. Cross-cutting pattern confirmed by every research pass
**"Market regime / health / temperature" is independently reinvented at least 6 times across
the codebase**, each with different inputs, weights, and label vocabularies, with only partial
consolidation:
1. `classifyMarketRegime()` (aio-core.js) — boolean tree, UPTREND/DOWNTREND/CORRECTION/CHOP (Part 1 §3)
2. `AIO_WEIGHT_REGISTRY.MARKET_REGIME` (aio-core.js) — documented-but-not-actually-running weighted score (Part 1 §3)
3. `window.AIO.getCurrentMarketRegime` (aio-core.js) — risk-on/risk-off/mixed, %-change based (Part 1 §3)
4. `window.AIO.getKrMarketTemperature` (aio-core.js) — KR analogue of #3
5. `computeEconomicTemperature` (aio-macro-tech.js) — 과열/뜨거움/정상/차가움/극도로 차가움
6. `updateMacroRegimePill` (aio-macro-tech.js) — Risk-On/Mixed/Cautious/Risk-Off

Only `computeMarketHealth` (src/domain/market/health.js, A+-F grade) is properly centralized
behind the single-implementation `AIO_ARCH` pattern and even cross-checks itself against
Trading Score to flag "충돌" (conflict) when they disagree — this is the one example of the
right architecture being applied to this exact problem, and the other five should be
consolidated toward it or explicitly relabeled as distinct, non-competing concepts.

**VIX-based fear labels use at least 4 different bucket sets** for the same metric:
`AIO_THRESHOLD_REGISTRY.VIX` (12/20/25/30/40, Part 1 §4), `vixRegime()` (12/16/20/25/30/40),
home-dashboard inline status (15/20/25/30), and the macro-tech pattern engine (13/25/30/35,
different semantics per band) — plus a separate VKOSPI scale for KR (20/25/35). None cite an
external source.

**RSI overbought/oversold bucket also disagrees internally**: 30/70 (THRESHOLD_REGISTRY, the
macro-tech renderer) vs. 35/65 (the natural-language screener query parser) — same indicator,
same app, two different definitions depending on entry point.

---

## PART 3 — Synthesis

### (1) Concepts computed in 2+ inconsistent ways
1. **"Market Regime / Health / Temperature" — reinvented independently at least 6 times**
   (full list in Part 2e): `classifyMarketRegime()` (boolean tree, UPTREND/DOWNTREND/
   CORRECTION/CHOP), `AIO_WEIGHT_REGISTRY.MARKET_REGIME` (weighted score, UPTREND/NEUTRAL/
   CAUTION/BEAR — documented in the tooltip but not what actually runs), `getCurrentMarketRegime`
   (risk-on/risk-off/mixed, %-change based), `getKrMarketTemperature` (KR analogue),
   `computeEconomicTemperature` (과열/뜨거움/정상/차가움/극도로차가움), and
   `updateMacroRegimePill` (Risk-On/Mixed/Cautious/Risk-Off). Only `computeMarketHealth`
   (src/domain/market/health.js, A+-F) is properly centralized via the single-implementation
   `AIO_ARCH` pattern — and it even self-checks against Trading Score for "충돌"(conflict),
   showing the team already has the right pattern; it just wasn't applied to the other five.
2. **VIX fear-label bucket boundaries — at least 4 different sets** for the identical metric:
   `AIO_THRESHOLD_REGISTRY.VIX` (12/20/25/30/40), `vixRegime()` (12/16/20/25/30/40),
   home-dashboard inline VIX status (15/20/25/30), and the macro-tech pattern-signal engine
   (13/25/30/35, different semantics per band) — plus a separate VKOSPI scale for KR (20/25/35).
3. **RSI overbought/oversold — two different bucket pairs**: 30/70 (THRESHOLD_REGISTRY, the
   macro-tech renderer) vs. 35/65 (the natural-language screener query parser) for the exact
   same indicator in the same app.
4. **"Quality/Trading Score" component weights** — `AIO_WEIGHT_REGISTRY.TRADING_SCORE`
   (20pt, Trend/RS/Volume/Volatility/Breakout) documents a formula that doesn't match the
   component set actually returned by `computeTradingScoreModel` (vol/momentum/trend/breadth/
   macro, 0-100 scale). The registry appears to describe a pre-consolidation version of the score.
5. **McClellan Oscillator vs. Summation Index** — self-documented historical confusion (fixed
   in v49.41) between a bounded short-term oscillator and an unbounded cumulative sum, still
   only half-resolved by the fact that the underlying data source doesn't exist yet.
6. **Breadth "200" naming** — `window._breadth200` / `breadth200-participation` actually holds
   the % of stocks above the **20-day** SMA (aio-core.js:23696-23698 comment admits this is
   "레거시" legacy naming), not a 200-day measure — a landmine for anyone reading the code or
   extending it without knowing this.
7. **Factor-rank "score" vs. "rank"** — src/domain/screener/factor-ranks.js deliberately keeps
   two different 0-100 numbers (a z-score-derived `factorScores` value and a percentile-derived
   composite `rank`) that look identical to a user but mean different things; the domain module
   guards against conflating them internally, but whether the UI layer preserves that
   distinction at render time was not independently confirmed in this pass.

### (2) User-facing signals with no validation, presented as guidance
- **Execution Window** (Breakout Hold/Pullback Buy/Follow-Through/Leader Hold): no backtest
  reference found anywhere; shown with directive-sounding labels (HIGH/MOD/WEAK/LOW/NONE) and
  color.
- **`classifyMarketRegime` / `getCurrentMarketRegime` / `getKrMarketTemperature` /
  `computeEconomicTemperature` / `updateMacroRegimePill`**: none of these five regime/
  temperature formulas have any backtest tying their thresholds to subsequent market behavior;
  `computeEconomicTemperature`'s narrative text does self-disclaim ("신호가 아닙니다"), but the
  other four render with no such caveat in the UI.
- **Pattern Signal Engine** (aio-macro-tech.js `updatePatternSignals`): the single highest-risk
  item found across all research passes — narrates uncited if/else rule output with specific,
  confidence-implying historical-frequency and analog claims ("2007년 하반기 유사 패턴,"
  "연간 3~5회 정도만 발생하는 희소한 이벤트") with zero dataset or backtest behind those
  specific numbers anywhere in the file.
- **News-derived scores** (`scoreItem` news importance, keyword-based sentiment/risk signals):
  entirely hand-tuned keyword lists and point bonuses accumulated over ~10 releases with no
  stated calibration, yet the sentiment/risk output feeds directly into the Trading Score's
  post-composite adjustment (up to ±30 points) — an uncited heuristic influencing a headline
  number, mitigated only by the same blanket `decisionEligible:false` gate as everything else.
- **VCP score / contraction detection**: methodology borrowed from a named, credible source
  (Minervini) but AIO's own point-weighting and swing-pivot sensitivity are untested against
  historical examples (and this pass's own synthetic test found the swing-pivot detector may be
  too strict for realistically noisy price action — see Part 1 §9).
- **AIO_THRESHOLD_REGISTRY bands for AAII/HY/DXY/10Y/SKEW**, the "다각화 추천" re-ranking
  score, and the "엔캐리 청산 리스크" score (as opposed to VIX/RSI's core cutoffs, which at
  least echo genuine market convention): all hand-picked, no backtest.
- By contrast, **Trading Score and the factor composite score *were* rigorously tested** — and
  the result (near-zero to negative IC) is exactly the kind of finding that should stop a score
  from being shown with green/red directive framing, yet the UI still does.
- **Governance is uneven, not absent**: `AIO_ACTION_RULES` (Part 1 §5), `getQuantReadinessAudit`
  (js/aio-data.js:15529), and `_scrSignalLabel`'s ban on imperative BUY/SELL language (Part 2c)
  show the team has already solved this problem correctly in three places — the fix is
  extending that same discipline to the items in this list, not inventing a new approach.

### (3) Proposed minimal, coherent "signal set" for a family trader + learner
Keep the site useful without pretending unvalidated heuristics are trading signals:

- **Tier A — descriptive market-state readouts, no directive framing** (rename away from
  "score"/"signal" language, drop green/red bands in favor of neutral, numeric+text display):
  Trading Score → rename to something like "시장 환경 요약" (Market Condition Summary),
  keep the fail-closed evidence-gating (it's good), but strip the advice-style copy and the
  75/60/45/30 color bands; show the raw component readings (VIX/breadth/etc. each with their
  own THRESHOLD_REGISTRY band) instead of collapsing to one number that back-tests negative.
- **Tier B — literature-standard technicals, keep as-is**: RSI/MACD/Bollinger/ATR/VIX & RSI
  threshold bands, Piotroski F-Score raw 0-9 (with AIO's verdict banding marked as AIO's own
  interpretation). These are well-implemented and don't claim predictive validity beyond their
  standard definitions.
- **Tier C — collapse to one Market Regime** (pick classifyMarketRegime's simpler, currently-
  running formula or the documented weighted one — not both), correct the tooltip to match,
  and add hysteresis (e.g. require the breadth/price condition to hold 2+ consecutive days
  before flipping the label) to stop cliff-edge flapping.
- **Cut or clearly gate behind "experimental, unvalidated" labeling**: Execution Window,
  getCurrentMarketRegime, getKrMarketTemperature, computeEconomicTemperature,
  updateMacroRegimePill, the Pattern Signal Engine's historical-analogy narration (keep the
  raw rule triggers if useful, drop the "similar to 2008/2020"-style uncited claims), the
  "다각화 추천" ranking, VCP numeric score (keep VCP's Stage-2 boolean filter, drop the
  composite score until backtested), McClellan-dependent weight slots until a real A-D source
  exists. Also reconcile the RSI 30/70 vs. 35/65 and the 4-way VIX bucket split down to one
  canonical definition each (AIO_THRESHOLD_REGISTRY already exists for this — route every
  caller through it instead of leaving parallel inline copies).
- **Portfolio backtest lab** (Sharpe/Sortino/Alpha/Beta/VaR/CVaR/MDD) is the best-engineered
  part of the codebase for this audience — standard formulas, a real fixed Sortino bug
  (documented in Part 2c, ~46% historical understatement, corrected 2026), bootstrap
  self-certification for VaR/CVaR, and pervasive fail-closed refusal rather than estimation —
  keep as Tier B alongside the standard technicals, just make sure the UI still shows the
  refusal reason (not a blank state) when it declines to compute something.
- **Publish the existing validation results in-product.** The team already computed the
  negative-IC finding; put a one-line, plain-Korean version of it next to the Trading Score
  itself ("이 점수는 과거 데이터에서 이후 수익률과 유의미한 상관관계를 보이지 않았습니다"),
  not just in a code comment and a JSON file nobody but the codebase itself reads.

### (4) Governance rule for adding a new indicator — proposed "model card" fields
Before any new score/signal/threshold is added to a user-facing page, require a short model
card (could live as a comment block next to the implementation, mirroring the good examples
already in this codebase — AIO_ACTION_RULES's rewrite comment, the BB variance-denominator
comment, the McClellan Summation-vs-Oscillator fix comment):
1. **Name** (Korean + internal) and **exactly one** canonical implementation location — if a
   second implementation of the same concept is ever added, the model card must say which one
   is canonical and mark the other deprecated in the same commit.
2. **Inputs & source** — each input's provider, refresh cadence, and what happens when it's
   stale/missing (must fail closed, per the pattern already used in
   `getTradingDecisionInputEvidence` — do not silently substitute a neutral/zero value).
3. **Formula**, with every constant's origin tagged as one of: `literature` (cite it),
   `backtested` (link the artifact + date), or `heuristic` (explicitly say so — heuristic is
   fine, but must say so where the user can see it, not just in a comment).
4. **Threshold origin**, same three-way tag, per band.
5. **Validation status**: `untested` / `tested-positive` / `tested-negative` /
   `tested-inconclusive`, with a link to the backtest artifact and its last-run date. A score
   marked `tested-negative` (like today's Trading Score) may not use green/red directive
   coloring or action-style copy ("매수 우호" etc.) — only `tested-positive` scores may.
6. **Display policy**: decision-grade (only for `tested-positive`, sample ≥ some stated n, and
   currently fresh) vs. reference-only (everything else, including all current `heuristic` and
   `untested` entries) — reference-only entries get muted styling, not the same green/amber/red
   treatment as decision-grade ones.
7. **Re-review trigger**: a date or version after which the card must be re-validated (stops
   the "stale 2.5-month-old backtest, still cited as current evidence" pattern seen in
   `factor-backtest-longrun.json`).
