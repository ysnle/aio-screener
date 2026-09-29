# AIO Screener — Quantitative/Financial Domain Audit

Scope: home trading score, factor screener, technical indicators, macro, sentiment,
portfolio risk/backtest/FX, news scoring, SEC fundamentals, 13F masters. Read-only;
no fetch/build/backtest entrypoints executed. Numeric checks done by copying pure
functions into scratchpad node scripts.

## 0. Overall posture (context for all findings below)

This codebase is unusually self-auditing for a solo/small-team project. Nearly every
domain module carries inline provenance comments referencing prior bug IDs (P-numbers,
R-rules) and many quant modules already **fail closed and self-disclose** rather than
fabricate: `model-validation-status.json` and `screener-validation-gate.json` are both
`status: "BLOCKED"` with explicit `predictiveValidation: "not-established"`,
`pointInTimeUniverse: false`, `liveBacktestParity: false`; `score-backtest-history.json`
ships a `note` stating outright that "statistical significance is UNKNOWN" and
`statisticallyMeaningful: false`; `trading-score.js` threads a `predictiveValidation`
flag through to the UI and blocks WATCH/REDUCE action language until it is
`'established'` (never true today). The home page hero text itself says "예측/매수
신호 아님" (not a predictive/buy signal) inline, not just in a buried disclaimer.
`ci-domain-parity-check.mjs` performs **real** golden-fixture parity checks (extracted
vs. legacy dumped output) for trading-score, RRG, Weinstein/MTF, news-scoring,
macro-curve and portfolio-concentration — not just import-smoke tests — and its own
comments record which toy/duplicate models were found to have zero callers and were
deleted (P755–P761). This materially lowers the risk profile assumed by the task
brief for items 2 (legacy/native duplication) and 5 (deterministic advice to
beginners) — but see 5.1 below for one live counter-example.

The findings below are the genuine remaining gaps found despite that posture.

## 1. Formula correctness

### 1.1 [Low, verified] Core technical indicators are textbook-correct
`js/aio-core.js`:
- `_calcRSILast`/`_calcRSISeries` (20361, 20573): correct Wilder smoothing —
  seed = simple average of first `period` gains/losses, then
  `avgGain = (avgGain*(period-1) + gain)/period`. Verified with a scratch harness
  (`scratchpad/rsi_test.mjs`): monotonic all-up series → 100, all-down → 0 (both
  correct boundary cases); a 20-point reference close series produced RSI(14) =
  57.915 via the standard recursive algorithm shape. I did not cross-check the exact
  numeric output against an independent TA-Lib/pandas-ta run (no such library
  available in this read-only environment) — **the algorithm's structure is verified
  correct, the exact decimal is unverified against a second implementation.**
- `_calcATR` (20344): correct Wilder ATR (`atr = ((atr*(period-1))+tr)/period` after
  a simple-average seed).
- `_calcBB` (20414): population variance (`/period`, ddof=0) — matches Bollinger's own
  definition and TA-Lib/TradingView default. Notably, the code comment at 20420-20423
  documents that v51.47 had *regressed* this to sample variance (ddof=1, `/period-1`,
  widening bands ~+2.6%) and v51.88/R265 reverted it — i.e. a real methodology bug
  that was caught and fixed. Confirms the team is actively chasing this class of bug,
  but also confirms it has actually shipped wrong at least once.
- `_calcMACD` (20382): standard 12/26/9 EMA-of-EMA-difference; includes a documented
  fix (v51.88/P579) for `isFinite(null)===true` polluting the warm-up histogram.
- Sharpe (`src/domain/portfolio/backtest.js:174`): daily excess return over
  `(1+rf)^(1/252)-1`, annualized by `sqrt(252)` — correct.
- Sortino (`_aioBtSortino`, line 287): downside deviation denominator is documented
  (P574/R265) to have been corrected from `n_downside-1` to full-sample `N`
  (Sortino & Price 1994 / Portfolio Visualizer convention) — comment states the old
  formula understated Sortino by ~46% on a real 24-month series (0.83 vs 1.54 measured).
  Another real, caught-and-fixed methodology bug.
- Max drawdown (`_calcMaxDrawdown`, 191): correct peak-to-trough on compounded NAV.
- Kalman trend filter (`scripts/fetch-data.mjs:2086`, `_kalmanTrend`): this is a
  genuine 2-state (level, velocity) constant-velocity Kalman filter on log-prices —
  F=[[1,1],[0,1]], H=[1,0], diagonal process noise, observation noise `R` scaled from
  the asset's own realized daily vol. Standard predict/update recursion, correctly
  implemented. (Contrast with 1.3 below — "Kalman" in this codebase is a real filter,
  not just a name borrowed for something else.)
- Money-weighted return (`_pfIrr`, `src/domain/portfolio/risk.js:464`): bisection on
  NPV(r)=0 with a sign-change bracket check before iterating, refuses (`null`) rather
  than guessing when cashflows don't bracket a root — correct and safe.

### 1.2 [Medium] RRG "RS-Ratio"/"RS-Momentum" is not the JdK RRG methodology it's named after
`src/domain/themes/rrg.js:30-61` (`computeRelativeRotation`). The real Julius de
Kempenaer RRG normalizes RS and RS-momentum as **rolling z-scores** (mean 0, std 1,
then rescaled to center 100) of a smoothed relative-strength ratio, typically with a
~252-day RS series and a shorter normalization window, producing values that are
genuinely comparable across symbols and stable in interpretation ("100" is a
statistical center, not a raw ratio-of-ratios).

This implementation instead computes, over whatever history is available (>20 bars):
```
rsRatio = 100 * rsVals[last] / mean(rsVals)              // ratio to its own history's mean
rsMidRatio = 100 * rsVals[mid] / mean(rsVals[0..mid])    // same ratio evaluated at the midpoint
rsMom = 100 * rsRatio / rsMidRatio
```
i.e. "how far is today's RS above/below its own trailing average" and "how has that
same quantity changed since the halfway point of whatever window happened to be
passed in." This is a **defensible custom heuristic** but:
- it has no fixed lookback — `rsMom`'s effective horizon changes with however much
  history the caller passes (`n`), so two calls with different history lengths are
  not comparable to each other even for the same symbol/day;
- it is not a z-score, so "100" only means "equal to its own historical mean," not
  "average across the universe" — cross-sectional comparisons between symbols
  (the entire point of an RRG rotation chart: comparing many tickers' quadrants at
  once) are not statistically normalized;
- calling it "RS-Ratio"/"RS-Momentum" and quadrant-classifying it exactly like a
  textbook RRG (Leading/Improving/Weakening/Lagging at the 100/100 crossing,
  `classifyRRG` line 12-21) borrows the visual/interpretive authority of the named
  methodology without matching its normalization.

The code comment (lines 1-4) is explicit that this is "code motion, not a new model"
transcribed from the legacy `calcLiveRS`/`classifyRRG` — so this is not a regression
introduced by the src/ extraction, it is a pre-existing methodology gap that
extraction faithfully preserved (and `ci-domain-parity-check.mjs` golden-fixture-
verifies the extraction matches the legacy output, which is the right check for *that*
concern but does not touch whether the underlying formula matches the named
methodology).
**Impact**: users familiar with real RRG charts (StockCharts/Optuma) will read
quadrant positions as if they were JdK-normalized and may draw wrong
cross-symbol conclusions; low financial risk (presented as thematic/rotation
research context, not a decision input to trading-score) but a real
methodology/labeling mismatch.

### 1.3 [Medium] "Weinstein stage" classification uses daily 50/100/200-day MA stacking, not Weinstein's 30-week MA
`src/domain/technical/stage.js:39-59` (`classifyMovingAverageStructure`) and its
caller `deriveTechnicalStageFromOhlcv` (line 128) label output as
`STAGE_1_OR_3_TRANSITION` / `STAGE_2_ADVANCE` / `STAGE_3_TOPPING` /
`STAGE_4_DECLINE`/`STAGE_4_OR_BASE_REPAIR` — Stan Weinstein's own stage-analysis
definition (*Secrets for Profiting in Bull and Bear Markets*) is built on **weekly**
closes and the **30-week moving average** (its slope and the price's position
relative to it), not a daily 50/100/200-day SMA stack. This module computes
everything from a single daily-bar `ohlcv` array (`sma(closes, 50/100/200)`, line 150)
and has no weekly resampling step at all.
Similarly `_calcVCP`'s `stage2` gate (`js/aio-core.js:20508`,
`price > sma150 && sma150 > sma200 && price > sma50 && pct52 >= -30`) implements only
4 of the 8 canonical Minervini Trend Template criteria (missing: 200-day MA rising for
≥1 month, 50-day MA above both 150- and 200-day MAs, price ≥25-30% above the 52-week
low, and RS-rank ≥ 70 vs. the universe) while the surrounding comment (20489-20490)
labels the whole function "Mark Minervini 방법론" (Minervini methodology).
**Impact**: not a code bug — the daily MA-stack heuristic is internally consistent and
reasonable as its own indicator — but naming it after Weinstein/Minervini specifically
implies the named, weekly/RS-rank-based methodology, which is not what is computed.
A user who has read either book and expects "Stage 2" to mean what Weinstein means by
it will be misled about how the label was derived.

### 1.4 [Low] Trading-score/Execution-Window thresholds are hand-tuned, not fit or validated
`src/domain/signal/trading-score.js:120-235` and `js/aio-core.js:23761`
(`computeExecutionWindow`) both use hard-coded step-function thresholds (e.g. VIX<15
→90, <18→78, <22→62 …; `breakoutHold` base 65 with ±25/±15/+10 nudges) with no
stated derivation (no backtest, no cross-validation, no citation). This is openly
disclosed for the trading score (`predictiveValidation: 'not-established'`,
`researchBoundary: 'market-condition-index-reference-only'`), which is the correct
posture given the negative-IC backtest evidence (2.1 below) — but
`computeExecutionWindow`'s four sub-scores (breakout-hold, pullback-buy,
follow-through, leader-hold) carry **no equivalent disclaimer field** in the function
itself; whether the UI wraps it in the same "reference only" language depends on the
call site (`index.html:8355`'s "단독 매수 신호가 아니며" text appears to cover a
related score, not confirmed to cover this one specifically — see 5.1).

## 2. Methodology validity / statistical significance

### 2.1 [High, self-disclosed but worth escalating] Trading score has *negative* measured correlation with forward returns
`public-data/score-backtest-history.json`: `n5d: 303, corr5d: -0.147, n21d: 287,
corr21d: -0.28`, with `significanceStatus: "UNKNOWN"` and `statisticallyMeaningful:
false` (the file's own `note` states the harness "does not calculate CI/p-values" and
fails closed on significance). A correlation of **-0.28 at n=287** is actually large
enough that, treated naively as a Pearson correlation, it would clear the usual
n>30 threshold for statistical significance at the 0.05 level (a null-hypothesis test
would reject r=0 comfortably) — the negative sign means **higher trading-score readings
have historically been followed by lower, not higher, 21-day forward market returns**.
The code's own comment in `getScoreAdvice` (`js/aio-core.js:23750`) already
acknowledges this ("최근 IC도 음수다") and is the reason the function only emits
descriptive "환경" (environment) language rather than buy/sell guidance. That is the
right mitigation given the evidence, but it means the underlying score construction
(VIX/FG/trend/breadth/macro weighted 25/25/20/20/10) is not just "unvalidated" — it is
measured to point the *wrong way* on this sample, which is a stronger finding than
"arbitrary weights." Two things are unverified here and matter for how much weight to
put on this: (a) whether n≈300 is drawn from overlapping/autocorrelated 5- and 21-day
windows (which would inflate the effective significance the naive threshold suggests —
the file doesn't report an effective sample size correction), and (b) whether the sign
convention in the harness matches the sign convention presented to users. Given the
scale of the effect and its direct bearing on whether the flagship home-page number
should be shown as encouraging ("환경 우호") at all during high readings, this is worth
a dedicated look before the next `getScoreAdvice`/hero-copy revision, even though the
current mitigations (fail-closed significance, `researchBoundary` field,
no WATCH/REDUCE unless `predictiveValidation==='established'`) are already better than
most retail tools ship.

### 2.2 [Medium, self-disclosed] Screener validation and universe are both explicitly non-PIT / present-day
`public-data/screener-validation-gate.json` and `public-data/model-validation-status.json`
both report `status: "BLOCKED"`, `pointInTimeUniverse: false`,
`delistingAndCorporateAction: false`, `liveBacktestParity: false`, and state directly:
"Current screener artifacts are present-day relative-ranking inputs... PIT universe,
delisting/corporate-action handling, filing availability, turnover, cost, liquidity
capacity, and live/backtest definition parity evidence are not established."
`public-data/screener-universe.json` meta confirms a single **fixed, present-day
873-symbol universe** (`recordCount: 873`, `currentness: "STALE"`, `lastBulkUpdate:
2026-07-16`, `staleAfterDays: 30`) used for both live screening and (per
`backtest-factors-longrun.mjs`) longrun IC backtests — i.e. **survivorship bias is
real and architecturally unavoidable under the current design**: any name that was
delisted, merged, or otherwise dropped before this snapshot never enters the
backtest sample, so historical IC/hit-rate numbers computed over this universe are
biased toward the "still around, still worth including in a curated list" subset.
This is already correctly reflected in the `pointInTimeUniverse: false` /
`BLOCKED` gate status, and `pit-validation.js` (`src/domain/screener/pit-validation.js`)
is a real, unusually rigorous PIT contract-checker (checks `delistedAt >= asOf`,
future-dated `availableAt`/`filedAt`, `currentUniverse` flag forces a failure) — but
it currently has **no production caller supplying a genuinely point-in-time universe**
for it to validate; it is validation machinery built ahead of the data it needs.
The gate correctly blocks "promotion" (`promotionDecision`,
`src/domain/screener/pit-validation.js:90`) from ever auto-applying regime weights,
which is the right circuit breaker given this gap.

### 2.3 [Low] Factor weights are a mix of hand-set defaults and a longrun backtest, but the backtest's own scope note limits what it proves
`src/domain/screener/factor-ranks.js:45`:
`DEFAULT_WEIGHTS = { momentum: 0.32, trend: 0.23, lowvol: 0.18, size: 0.18, value: 0,
quality: 0, kalman: 0.09 }` vs. `scripts/fetch-data.mjs:2245`
`COMP_W = { mom: 0.370, trend: 0.274, lowvol: 0.219, kalman: 0.137 }` — two different
weight vectors for what reads as the same four core factors (value/quality/size
excluded from the second). `backtest-factors-longrun.mjs`'s own scope comment (line
181) is careful to call this "Reduced-scope validation... using top {topN} tickers by
market cap (of {universe.length} in the full SCREENER_DB universe)" — i.e. the
validated subset is smaller and higher-cap than the live screening universe, which the
comment itself flags rather than hides. This is a reasonable, disclosed limitation,
not a hidden one; flagging only because "backtest validates weights" claims elsewhere
in the app (if any exist in UI copy — not confirmed either way in this pass) should be
scoped to "reduced-scope, large-cap subset, not the full 873-name universe."

## 3. Legacy (js/) vs native (src/) duplication

`scripts/ci-domain-parity-check.mjs` is a genuine golden-fixture harness (not a smoke
test) for: trading-score (`architecture/fixtures/trading-score-golden.json`), RRG
(`rrg-golden.json`), Weinstein/MTF MA-stack (`weinstein-mtf-golden.json`), news
scoring/risk-signals, treasury curve, and portfolio concentration — each dumped from
the **unmodified legacy function** via a corresponding `scripts/dump-*-fixtures.mjs`
before the src/ extraction happened, then diffed field-by-field against the extracted
pure function's output. The file's own inline history (P755-P761) documents three
formerly-parallel "toy" models (`deriveNewsClaim`, `deriveTechnicalModel`,
`deriveMacroModel`, `derivePortfolioRisk`) that were found via grep to have **zero real
callers** and were deleted rather than left to drift — this is the right way to handle
R352 ("legacy and native must not diverge into two different formulas"). I did not find
any quant indicator with two independently-live implementations computing different
answers for the same metric today (VCP, McClellan, ATR/RSI/MACD/Bollinger exist only in
`js/aio-core.js`; RRG/trading-score/Weinstein-MTF/news-scoring/treasury-curve/portfolio-
concentration/factor-ranks exist in `src/domain/**` with the legacy call sites now thin
wrappers, gated by the above parity check). **This is the one area of the audit where
I could not find a genuine open finding** — the architecture and its test appear to be
doing what they claim.

## 4. Data integrity

### 4.1 [Medium] Fixed 873-symbol universe is explicitly stale by the project's own policy
Already covered under 2.2; repeating here for the "data integrity" framing:
`screener-universe.json` meta's own fields (`currentness: "STALE"`,
`lastBulkUpdate: "2026-07-16"`, `staleAfterDays: 30`, `replaceAfterDays: 90`) show the
project has a defined staleness policy and the artifact is *currently past the
30-day `staleAfterDays` threshold* relative to whatever date this snapshot represents
in the live deployment (unverified: I could not confirm today's actual served
artifact's age against 2026-09-27 without running the fetch pipeline, which is
out-of-scope here per the read-only constraint — flagging the mechanism as sound and
the staleness as self-reported, not independently re-verified).

### 4.2 [Unverified] 13F filing lag / masters staleness constant not located
I could not find an explicit "45-day 13F filing lag" constant or comment anywhere in
`src/domain/**`, `js/aio-core.js`, or `src/ui/pages/masters.js` (only a generic
`freshnessStatus === 'STALE_REFERENCE'` UI branch at `src/ui/pages/masters.js:152`).
`public-data/masters/filing-discovery.json` does carry real `periodOfReport` dates
(e.g. `2026-06-30`, `2026-03-31`), which is the right raw material for a lag
calculation, but I did not find where (or whether) the app computes "how stale is this
13F relative to today" using the SEC's actual 45-calendar-day filing deadline versus
just using whatever `periodOfReport`/`filedAt` the discovery feed already carries. This
should be treated as **unverified rather than absent** — it may be computed in
`scripts/` code outside the domain/ directories I was able to review in the time
available, or entirely inside the data producer (out of scope to run). Recommend a
follow-up grep specifically for `filedAt`/`acceptedAt` arithmetic in the masters
pipeline before concluding this is missing.

### 4.3 [Low] Point-in-time SEC fundamentals plumbing exists but its filing-vs-period-end distinction wasn't stress-tested here
`src/domain/fundamental/sec-report.js:50` prefers `acceptedAt || effectiveAt || filedAt`
over period-end dates when resolving "when was this observable" — the right instinct
for PIT correctness (a 10-Q for Q1 isn't knowable until its filing date, which can lag
the period end by 30-45+ days). I read this in isolation and did not trace an
end-to-end case (e.g., confirm no downstream caller substitutes `periodOfReport` for
`filedAt` when computing screener PIT observations) given time constraints — flagging
as **spot-checked, not exhaustively traced**.

## 5. Presentation risk (deterministic advice to beginners)

### 5.1 [Low-Medium] Disclaimer coverage looks strong at the home hero but is not verified everywhere the score-derived numbers surface
Positive evidence: `index.html:6654` ("...예측/매수 신호 아님"), `:8355` ("단독 매수
신호가 아니며..."), `:12551`/`:12881` all carry explicit "this is not a buy signal /
individual judgment required" language directly in the visible copy, not just in a
tooltip or footnote — and `trading-score.js`'s presentation layer
(`deriveTradingScoreDecisionPresentation`) structurally cannot emit "WATCH"/"REDUCE"
language unless `predictiveValidation === 'established'` (which is hard-coded to never
be true today, see line 17-18/278). This is a genuinely good pattern versus most
retail screener tools. However: `computeExecutionWindow` (`js/aio-core.js:23761`) and
its four labeled sub-scores (breakout-hold/pullback-buy/follow-through/leader-hold,
rendered to DOM ids `ew-breakout`/`ew-pullback`/`ew-followthru`/`ew-leaders`) render
categorical labels (LOW/WEAK/NONE/MIXED per the current index.html defaults at
6777-6789) computed from the same kind of hand-tuned VIX/breadth/PCR thresholds as the
trading score, but I did not confirm this widget carries the same
"not a signal" language at its actual render call site (only found a *different*
score's disclaimer nearby at :8355, not confirmed to cover this widget) — worth a
direct visual/DOM check in a live QA pass rather than static grep, since Korean
beginner users are the stated target audience and a bare "LOW"/"NONE" label with no
adjacent caveat reads as more deterministic than the trading-score hero does.

### 5.2 [Informational] 유사투자자문 (investment-advisory) framing
Not independently assessed against Korean financial-advisory regulation (outside this
audit's technical competence) — noting only that the app's own internal language
consistently uses descriptive/observational framing ("환경 우호 관찰", "역사적으로...
서술됩니다") rather than imperative recommendations ("사세요"/"파세요"), which is the
right direction for that regulatory risk, but a legal read was not performed.

---

## How I would build the analytics core instead

**Where the current approach already matches what I'd design:** the fail-closed
evidence-gating pattern (`decisionEvidence`/`allowedUse==='decision'`/status
whitelisting in `trading-score.js`), the PIT-observation contract shape in
`pit-validation.js` (availableAt/validFrom/validTo/delistedAt with future-dated
rejection), the declared-FX-leg-or-refuse model in `fx.js` (no triangulation, no
silent 1:1 fallback), and the composition-snapshot/exposure-history-mode contract in
`risk.js` (refuses to compute an "actual account history" TWR without a real ledger)
are all patterns a from-scratch design would also converge on. I would not rip these
out; I'd generalize them.

1. **One typed, pure indicator/scoring library, single source of truth, server-side
   canonical.** Currently there are two runtimes (`js/aio-core.js` legacy, `src/domain/**`
   native) reconciled by golden-fixture parity tests. That's a reasonable transitional
   scaffold, but the end state should be: indicators and scoring live in one package,
   computed once in the data pipeline (`scripts/fetch-data.mjs` already computes
   `kalmanVel`/RSI/etc. server-side), and the browser only ever *renders* pre-computed,
   versioned outputs — never re-derives a score from raw closes client-side. This
   removes the entire class of "did the client and pipeline definitions drift" bugs the
   parity checker exists to catch, by making drift structurally impossible rather than
   continuously tested-for.

2. **Golden-value test vectors from an independent reference library.** The RSI/ATR/
   Bollinger/MACD/Sharpe/Sortino formulas here are algorithmically correct by
   inspection and carry good in-repo regression tests (`ci-esm-core-unit-check.mjs`,
   `dump-*-fixtures.mjs`), but none of the numeric assertions I found are checked
   against TA-Lib, pandas-ta, or a published worked example with known output. I'd add
   a small fixture set (a handful of tickers × known date ranges) with TA-Lib/pandas-ta
   computed reference values checked into the repo, and assert exact/near-exact match
   in CI — this is a stronger correctness guarantee than "the two in-repo
   implementations agree with each other," which only proves internal consistency, not
   correctness against the field's actual standard (this is exactly how the Bollinger
   ddof and Sortino-denominator bugs slipped through and were only caught by manual
   review, not by CI, per the R265 comments).

3. **A real point-in-time data model with a caller, not just a validator.**
   `pit-validation.js` is unusually well-designed but currently validates nothing in
   production (2.2). I'd build the PIT observation store first (versioned
   fundamentals/universe membership keyed by `availableAt`, not `periodOf­Report`) and
   then make `validatePITRun` a mandatory gate in the actual backtest entrypoint,
   rather than a contract that exists ahead of its data.

4. **Walk-forward validation with an honestly-computed effective sample size**, given
   the finding in 2.1: the existing `score-backtest-history.json`/
   `factor-backtest-longrun.mjs` already do rolling-window IC (good instinct), but do
   not report autocorrelation-adjusted significance for overlapping 5d/21d windows.
   I'd add a Newey-West or block-bootstrap corrected p-value/CI to every published IC,
   and route the -0.28 finding in 2.1 into an explicit "score has historically been
   anti-correlated with 21-day forward returns at this sample size" banner rather than
   leaving it implicit in `getScoreAdvice`'s Korean-only code comment.

5. **Versioned model cards, one per published score/indicator**, extending the existing
   `modelVersion` string fields (`trading-score.v3`, `rrg.v2`, `stage.v2`, etc.) into an
   actual artifact: methodology, known deviations from the named standard (e.g. "this
   is NOT the JdK-normalized RRG," "this Stage classification is a daily MA-stack
   proxy, not Weinstein's 30-week-MA method"), last-validated date, and current
   significance status. The `researchBoundary`/`predictiveValidation` fields in
   `trading-score.js` are exactly the right primitive; I'd promote that pattern to
   every named-after-a-famous-method indicator (RRG, VCP/Minervini, Weinstein stage) so
   the labeling gap in 1.2/1.3 is disclosed the same way the trading-score's predictive
   gap already is.

6. **Migration steps, concretely:**
   a. Freeze `js/aio-core.js` quant functions as read-only reference; no new logic
      lands there.
   b. For each remaining un-extracted indicator (VCP, McClellan, ATR/RSI/MACD/BB,
      volume profile) repeat the RM-03 pattern already used for trading-score/RRG/
      Weinstein-MTF: dump a legacy golden fixture, extract to `src/domain/technical/`,
      parity-check, then delete the legacy body in favor of the thin wrapper.
   c. Once extracted, move the *evaluation* (not just the computation) entirely into
      `scripts/fetch-data.mjs`'s pipeline so the browser never computes scores from raw
      closes — only formats server-supplied, versioned outputs.
   d. Add the TA-Lib/pandas-ta golden vectors (item 2) as a new CI check alongside
      the existing legacy-parity check, so "matches legacy" and "matches the field
      standard" are both continuously verified and visibly distinct claims.
   e. Add the RRG/Weinstein/Minervini model-card disclosures (item 5) as a
      documentation-only change with no formula risk, shippable independently and
      immediately.
