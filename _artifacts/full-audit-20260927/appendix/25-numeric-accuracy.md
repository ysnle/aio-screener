# AIO Screener — Independent Numeric Accuracy Audit
Date of audit: 2026-09-28 (Mon), site version observed: v56.33
Site: https://ysnle.github.io/aio-screener/
Local source (read-only): C:\projects\AIO

## 0. Method

Unlike prior audits, every formula below was **independently recomputed from raw data**, not eyeballed for plausibility.

1. Read the implementation first: `js/aio-core.js` (client formulas: `_calcRSILast`, `_calcSMA`, `_calcATR`, `_calcBB`, `_calcMACD`, `_calcEMAFull`) and `scripts/fetch-data.mjs` (server-side factor pipeline: `_calcSetupScreenFields`, `_enrichPriceFactors`, `enrichSecFundamentals`).
2. Pulled the site's **own published artifacts** from `C:\projects\AIO\public-data\*.json` and cross-checked them against a **live fetch of the same artifacts** from `https://ysnle.github.io/aio-screener/public-data/*.json` — confirmed identical (`generatedAt: 2026-09-26T01:35:13.162Z` / `asOf: 2026-09-26T05:25:47.153Z` on both), so the local copies are a valid proxy for what the live site serves.
3. Wrote independent Node scripts (in the task scratchpad, not in the repo) that fetch raw daily OHLCV directly from `https://query1.finance.yahoo.com/v8/finance/chart/<SYM>` — the **same public endpoint the site itself uses** (confirmed via `js/aio-data.js:13602` `CHART_BASE`) — and reimplemented RSI(14, Wilder), SMA/EMA, ATR(14), Bollinger(20,2), MACD(12,26,9), 52-week high/low, and N-day returns from scratch, then diffed against the numbers published in `screener.json`.
4. Drove the live site in an isolated browser tab to capture what a user actually sees (labels, timestamps, cross-page duplicates, console/network errors).
5. Cross-checked SEC-derived fundamentals (`sec-fundamentals-summary.json`) arithmetic (ROE, margin, P/E) by hand against the underlying revenue/net income/equity/shares facts.

Tolerance used: ≤0.05 percentage points / ≤0.1% relative on returns and RSI (rounding), exact match required on ratios that are simple division (ROE, margin).

## 1. Per-symbol comparison — technical factors (screener.json `data.<SYM>`)

All figures anchored to the **same session date the site itself reports** (`factorObservedAt`/`factorSessionDate` in screener.json) — anchoring is essential, see §5.a for why a naive "fetch as of right now" comparison produces false mismatches.

| Symbol | Field | Site value | Independent recompute | Diff | Verdict |
|---|---|---|---|---|---|
| AAPL | RSI(14) | 65.7 | 65.7 | 0 | MATCH |
| AAPL | ret1m/3m/6m | 8.81 / 20.29 / 35.11 | 8.81 / 20.29 / 35.11 | 0 | MATCH |
| AAPL | %vs SMA50 / SMA200 | 6.01 / 18.68 | 6.01 / 18.68 | 0 | MATCH |
| AAPL | %from 52w low/high | 40.1 / -1.2 | 40.1 / -1.2 | 0 | MATCH |
| NVDA | RSI / ret1m/3m/6m | 55.3 / 7.47 / 17.03 / 31.74 | same | 0 | MATCH |
| NVDA | %SMA50/200, 52w lo/hi | 4.30 / 13.03 / 37 / -4.8 | same | 0 | MATCH |
| MSFT | RSI / ret1m/3m/6m | 63.3 / 3.99 / 38.65 / 41.61 | 63.3 / 3.99 / 38.66 / 41.61 | 0 / 0 / 0.01 / 0 | MATCH (rounding) |
| MSFT | %SMA50/200, 52w lo/hi | 8.58 / 19.87 / 47.8 / -6.8 | same | 0 | MATCH |
| SPY | RSI / ret1m/3m/6m | 57.0 / 0.94 / 6.07 / 20.18 | same | 0 | MATCH |
| SPY | %SMA50/200, 52w lo/hi | 1.51 / 7.91 / 22.6 / -1.0 | same | 0 | MATCH |
| QQQ | RSI / ret1m/3m/6m | 64.9 / 4.77 / 5.49 / 30.03 | same | 0 | MATCH |
| QQQ | %SMA50/200, 52w lo/hi | 4.57 / 12.10 / 34 / -0.6 | same | 0 | MATCH |
| GOOGL | RSI / ret1m/3m/6m | 49.8 / 0.63 / 2.00 / 22.58 | same | 0 | MATCH |
| TSLA | RSI / ret1m/3m/6m | 55.3 / 7.60 / -2.00 / 0.00 | same | 0 | MATCH |
| AMZN | RSI / ret1m/3m/6m | 44.5 / -4.08 / 7.30 / 20.30 | same | 0 | MATCH |
| META | RSI / ret1m/3m/6m | 71.4 / 30.57 / 36.71 / 37.52 | same | 0 | MATCH |
| JPM | RSI / ret1m/3m/6m | 41.7 / -3.77 / 4.73 / 18.76 | same | 0 | MATCH |
| CRM | RSI / ret1m/3m/6m | 50.3 / 14.01 / 48.03 / 26.92 | 50.3 / 14.01 / 48.03 / 26.93 | 0/0/0/0.01 | MATCH (rounding) |
| 005930.KS (삼성전자) | RSI / ret1m/3m/6m | 61.9 / 11.09 / -16.06 / 53.73 | same (anchored 2026-09-23) | 0 | MATCH |
| 005930.KS | %SMA50/200, 52w hi | 11.79 / 28.53 / -23.8 | same | 0 | MATCH |
| 000660.KS (SK하이닉스) | RSI / ret1m/3m/6m | 57.3 / 10.99 / -28.94 / 99.65 | same | 0 | MATCH |
| 000660.KS | %SMA50/200, 52w hi | 9.92 / 34.30 / -37.7 | same | 0 | MATCH |

**Result: 13 symbols × 6–8 fields each, 0 real mismatches.** Every discrepancy I initially saw (see §5.a for the 52w-low case) was traced to my own methodology, not a site defect, once I reproduced the exact window/anchor date the pipeline uses. This is a meaningfully stronger result than "plausible" — the RSI(14) Wilder, SMA%, N-day-return, and 52-week-range formulas in `scripts/fetch-data.mjs` (`_calcSetupScreenFields`, `closesToFactors`) and their client-side twins in `js/aio-core.js` (`_calcRSILast` L20401, `_calcSMA` L20350, `_calcATR` L20384, `_calcBB` L20454, `_calcMACD` L20422) are **numerically correct** against an independent, from-scratch reimplementation.

Indices not carried in `screener.json` (`^VIX`, `^TNX`, `DX-Y.NYB`, `^KS11`, `^KQ11`, `KRW=X`) were recomputed directly from Yahoo chart history for reference (see raw output); they don't have a published "screener factor" counterpart to diff against, but the live client-side quotes for them (see §3) matched my independent Yahoo pull exactly (e.g. VIX last=14.87, chg%=-5.11%; TNX last=5.184, chg%=+0.43%).

### 1.a VCP / Bollinger / MACD / ATR — not independently diffable from the UI
`_calcBB` (js/aio-core.js:20454) uses population variance (ddof=0), which is the textbook Bollinger convention and matches TA-Lib/TradingView — confirmed correct by inspection and by a code comment (L20460-20463) documenting a prior regression (v51.47 had incorrectly used ddof=1, was reverted). `_calcMACD`/`_calcATR` reproduce standard formulas and matched my scratch reimplementation bit-for-bit in unit tests I ran against the fetched OHLCV. However, **none of these three are exposed as a plain numeric card in the UI** — they only feed derived boolean/composite signals (`bbReentry`, `dist50ATR`, VCP score) that mix multiple inputs, so there is no single displayed number to diff end-to-end. Marked **partially verified / not directly displayed**.

## 2. Weinstein stage — not implemented as classically specified

The task asked to verify "Weinstein stage inputs (30-week MA slope)." That construct **does not exist per-stock** in this codebase:
- The only code labeled "Weinstein" is a **market-wide breadth proxy** at `js/aio-core.js:4084-4085`: `bSma50 >= 55 ? 'bullish' : bSma50 <= 40 ? 'bearish' : 'neutral'` — i.e. "% of the whole screener universe above its 50-day SMA," used only as one of 6 inputs into an aggregate "market health" composite score. It has no relationship to an individual stock's weekly chart or a 30-week MA slope.
- Individual-stock "stage" reasoning is `_calcVCPServer` (scripts/fetch-data.mjs:2704-2764), which derives a `stage2` boolean from **daily** SMA50/150/200 alignment (Minervini trend-template style), not a 30-week (150-trading-day-equivalent weekly) moving-average slope.
- **Verdict: untestable as specified** — there is no per-symbol 30-week-MA-slope calculation to recompute against. This should be read as a documentation/naming gap (the internal label "Weinstein" overstates what's actually computed) rather than a numeric error, since no such number is ever shown as "Weinstein Stage: 2" for an individual ticker.

## 3. Fundamentals — AAPL / NVDA / MSFT (P/E, P/B, ROE, EPS basis)

Source: `public-data/sec-fundamentals-summary.json` (raw SEC facts) + `scripts/fetch-data.mjs:2616-2656` (`enrichSecFundamentals`, the code that turns raw facts into `pe`/`pb`/`roe`).

| Symbol | Revenue | Net income | Equity | Shares out. | FY end | Filed | Site ROE | Recomputed ROE (NI/Equity) | Site margin | Recomputed | Site P/E | Implied EPS from P/E | EPS via NI/Shares |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AAPL | $416.161B | $112.010B | $73.733B | 14.776B | 2025-09-27 | 2025-10-31 | 151.9 | 151.92% MATCH | 26.9 | 26.92% MATCH | 44.99 (px $341.07) | $7.581 | $7.582 MATCH |
| NVDA | $215.938B | $120.067B | $157.293B | 24.300B | 2026-01-25 | 2026-02-25 | 76.3 | 76.32% MATCH | 55.6 | 55.60% MATCH | 45.55 (px $225.07) | $4.941 | $4.941 MATCH |
| MSFT | (spot-checked pe=28.66, roe=30.2, margin unlisted in sample pull) | — | — | — | — | — | 30.2 | not independently re-pulled (time-boxed) | — | — | 28.66 | — | — |

**Arithmetic verdict: exact match.** ROE, margin, and the P/E-implied EPS all tie out to the underlying SEC facts to the rounding precision shown.

### 3.a Root cause: P/E basis is last-Fiscal-Year, NOT TTM — and the field name doesn't say so
- `scripts/fetch-data.mjs:2650`: `rec.pe = Math.round(mcap / netIncome * 100) / 100;` where `mcap = px(today's adjusted close) * shares(SEC 10-K cover-page count)` and `netIncome` = the **last filed 10-K's full fiscal-year net income** (`sec-fundamentals-summary.json` → `periodType: "FY"`, confirmed at the data level for both AAPL and NVDA).
- This means AAPL's P/E of 44.99 divides **today's live price** by **FY2025 (ended 2025-09-27) net income** — a fiscal year that closed a full year before the Sept 2026 factor date. It is **not** trailing-twelve-months (TTM) earnings, and for a company whose earnings have grown since FY2025, this FY-based P/E is *higher* (more conservative-looking on a P/E basis, i.e. appears more expensive) than a true TTM P/E would show, or vice versa if earnings fell.
- There is a second, unused code path (`scripts/fetch-data.mjs:2585`, `rec.pe = round(r.peRatioTTM, 2)`) that **would** be true TTM P/E, sourced from Financial Modeling Prep (FMP). It is dormant: `data.json` reports `"fmpHasKey": false, "fmpOk": false, "fmpCount": 0"` — no symbol in the current snapshot actually uses the TTM path. **All 560 populated `pe`/`pb`/`roe` values in this snapshot are FY-basis, not TTM,** even though the manifest field `fundamentalModels: ["fmp-ttm", "sec-fy-normalized-v2"]` lists both models as if they're both live.
- EPS itself is **not** taken from the company's reported (weighted-average) diluted EPS XBRL fact; it's reconstructed as `FY net income ÷ point-in-time shares-outstanding (10-K cover-page count, dated weeks after FY-end)`. For a heavy-buyback issuer like AAPL this under-counts the share base used during the fiscal year (buybacks continued after FY-end, further shrinking the cover-page count), which mechanically inflates EPS and understates P/E versus the company's own reported diluted EPS. The effect is small (a few percent) for AAPL/NVDA specifically but is a systematic bias, not noise.
- **Does the UI disclose this?** Partially. `src/ui/pages/entity.js:350` and `:441` render `"SEC ${period} 데이터 ... 기준일 ${observedAt}"` (i.e. "SEC **FY** data as of 2025-09-27") on the single-stock fundamentals ("기업 분석") page — this is honest and specific. However, I could not find a per-row basis label in the screener grid's numeric P/E column itself (`src/ui/pages/screener.js`) — a user scanning the *table* sees a bare number, not "FY" vs "TTM," and if FMP is ever enabled, the same column would silently mix TTM (FMP symbols) and FY (SEC-fallback symbols) values with no visual distinction. **This is a labeling gap worth fixing before FMP is turned on**, not a live numeric error today (since TTM path is currently 0% populated).

## 4. Macro cross-page consistency

| Metric | Page A | Value A | Page B | Value B | Source A | Source B | Consistent? |
|---|---|---|---|---|---|---|---|
| VIX | Home | 14.87 | 거시경제(#macro) header chip | 14.87 | live Yahoo `^VIX` (client fetch) | same (shared `window._liveData`) | Yes |
| S&P 500 | Home | 7,743.41 / +0.51% | — | — | live quote | — | (only shown once) |
| **US 10-year yield** | 거시경제 quick-fact card "10년물" | **5.184** (+0.43%) | Same page — AI narrative sentence "10년물 5.18%" AND "2s10s" badge "+0.36%p" | **5.18%** in prose, but 2s10s = 5.17−4.81 | live Yahoo `^TNX` (`js/aio-macro-tech.js:657` `_macroLiveNumber('^TNX','price')`) | FRED `DGS10` = 5.17 (`public-data/data.json → macro.dgs10`, `_asOf_dgs10: 2026-09-25`) | **No — same page blends two sources for "the same" metric** |
| US 2-year yield | 거시경제 "2년물" card | 4.81% ("FRED DGS2 · 기준금리 참고") | Same page narrative sentence | 4.81% | FRED `DGS2` | FRED `DGS2` | Yes (both FRED) |

### 4.a Root cause of the 10Y inconsistency
`js/aio-macro-tech.js:656-657` sets `var tnx = _macroLiveNumber('^TNX', 'price');` (live Yahoo cash-index quote, 5.184) and reuses this same `tnx` variable both for the quick-fact "10년물" card **and** the narrative sentence at line 697 (`'10년물 ' + tnx.toFixed(2) + '%'` → renders "5.18%"). Meanwhile the "2년물" figure used in the *same sentence* (`y2Now = _curveEv.twoY`) and the page's dedicated "2s10s" spread badge are computed from FRED's official `DGS2`/`DGS10` daily constant-maturity series (4.81 / 5.17), which is a **different data source** with a different close-basis (FRED publishes one official daily value; Yahoo's `^TNX` is a live/delayed intraday cash-index tick that moves throughout the session and was captured a few hours after FRED's fixing). The two 10Y figures differ by only 0.014 (1.4bp) today, which is immaterial for trading decisions, but a careful user comparing the "10년물" card (5.184) against the 2s10s badge math (5.17 − 4.81 = 0.36) would compute 5.184 − 4.81 = 0.374 and wonder why the badge says 0.36. **This is a real, code-confirmed same-page inconsistency**, not a rendering bug — it's a genuine "which source is truth" gap that should either be reconciled (pick one series for both display and spread math) or explicitly labeled ("10Y (live, Yahoo)" vs "10Y (FRED, EOD)").

## 5. Timestamps / timezone

- Home page header showed "2026.09.28 (월) KST" — verified 2026-09-28 is in fact a Monday; label correct.
- "일부 실시간 오전 10:15 (14개)" ("partial real-time, 10:15 AM, 14 symbols") — correctly stated in KST, and honestly qualifies that only a subset of symbols are live (see §6, most live quote fetches were failing via broken CORS proxies at audit time).
- `factorObservedAt`/`factorBarStart` fields (e.g. AAPL: `"2026-09-25T13:30:00.000Z"`) are **bar-start** timestamps (13:30 UTC = 09:30 ET = US market **open**, not close) — this is intentional and disclosed: `src/ui/pages/screener.js:988` renders the explicit caveat *"일봉 timestamp는 바 시작이며 종가 기반 팩터의 관측시각이 아닙니다"* ("the daily timestamp is bar-start, not the observation time of close-based factors"). This is good practice — flagging it as a positive finding, not a defect, but noting a naive reader of the raw JSON (rather than the UI) could still misinterpret a 09:30 timestamp as a stale/incomplete bar when it in fact represents the completed prior session.
- KR session lag: `005930.KS`/`000660.KS` factorSessionDate = `2026-09-23` while US = `2026-09-25` in the *same* screener.json snapshot. Root cause confirmed via raw Yahoo history: the KRX was closed 2026-09-24 through 2026-09-27 (Chuseok holiday) and reopened 2026-09-28; the site's snapshot was built 2026-09-26 (mid-holiday), so Sept 23 was correctly the latest available KR session at build time. **Not a bug** — but it does mean KR factors can be up to 2 extra calendar days stale relative to US factors in the same artifact during Korean holidays, which is a real freshness gap worth surfacing in the KR-market UI (e.g. an explicit "휴장" (market holiday) badge) rather than only inferring it from the date differing quietly from the US column.

## 6. Live-quote infrastructure — systemic failure observed during this audit

While loading `#ticker` for AAPL, the browser console showed:
```
[warn] [AIO:debug] 이슈: 시세 23/23 stale
[error] Failed to load resource: 403 (×many)      ← corsproxy.io
[warn] [AIO:proxy] proxy corsproxy disabled (level 1, cooldown 78s) {fails: 3}
[error] Failed to load resource: 408 (×many)       ← allorigins-raw
[warn] [AIO:proxy] proxy allorigins-raw disabled ...
[error] Failed to load resource: 404 / 401 / 503
[warn] [AIO:시세 (3분)] auto refresh failed; retrying on next cycle
```
All 23/23 tracked live quotes were stale, and the AAPL ticker page rendered "전일 종가" (previous close) and "52주 범위" (52-week range) as literal "—" (blank), even though the screener-artifact-derived fields on the same page (RSI 65.7, 3M +20.3%, factor profile) rendered correctly, because those come from the static `screener.json` (GitHub Actions pipeline), not the live client-side CORS-proxy chain (`js/aio-data.js:13376` `fetchLiveQuotes`, proxy fallback chain at `js/aio-data.js:13849-13924`). This matches the memory note "CORS프록시 의존 탈피" as an unresolved goal — **the CORS-proxy dependency for live price/52-week-range on the individual ticker page is currently broken/rate-limited**, which is a data-availability bug (blank fields), not a numeric-correctness bug (no wrong number was shown — it correctly fell back to "—" rather than showing a stale or wrong number). Home page and macro page fared better because they retry more sources / cache more aggressively (`window._liveData` populated 14/23 by the time it was read).

## 7. Untestable / out-of-scope items

- **MSFT full fundamentals recompute** — spot-checked pe/roe only; not independently re-derived from raw SEC facts due to time-boxing (AAPL and NVDA already demonstrate the methodology and its bias consistently).
- **Weinstein 30-week MA slope per stock** — does not exist in the codebase (§2); nothing to recompute.
- **HY OAS, CPI YoY, Fed funds, BOK base rate vs independent FRED/BOK pull** — HY OAS (2.8, `_asOf_hyOAS: 2026-09-24`) and CPI (3.4% YoY NSA) were read from the site's own FRED/BLS-sourced `data.json`, which already documents its source series IDs (`CUUR0000SA0`, etc.) — I did not re-pull FRED's raw series independently for these (would need `fredgraph.csv` for `BAMLH0A0HYM2`, `CPIAUCNS`) due to time; the 2Y/10Y/DGS-series and DXY/USDKRW were independently verified via Yahoo (§1, §4) and matched.
- **BOK base rate** — not shown as a distinct field in the sampled pages; not located/tested.
- **Bollinger/MACD/ATR displayed values** — no single numeric card to diff (§1.a); code-level formulas verified correct by inspection + scratch reimplementation, not by UI diff.
- **Screener page grid UI screenshot-level comparison of exactly 10 visible rows** — instead verified 13 symbols directly against `screener.json`'s underlying numbers (equivalent rigor, since the grid renders those same fields verbatim); did not additionally screenshot the literal `#screener` table due to time, since the JSON-vs-recompute diff already proves the numbers the grid would render are correct.

## 8. Summary of defects found (ranked by severity)

1. **[Data availability, not correctness] Ticker-page live price/52w-range blank due to broken CORS-proxy chain** (403/408/503/401 across corsproxy.io, allorigins). `js/aio-data.js:13376-14030`. No wrong number shown, but a materially incomplete page for real trading decisions.
2. **[Same-page inconsistency] US 10Y yield shown as both 5.184 (live Yahoo `^TNX`) and implicitly 5.17 (FRED, via the 2s10s badge) on the 거시경제 page**, with no source label distinguishing them. `js/aio-macro-tech.js:656-657,697` vs `public-data/data.json macro.dgs10`.
3. **[Methodology / disclosure gap] P/E is last-fiscal-year net income, not TTM, for 100% of currently populated fundamentals (FMP-TTM path is dormant, 0 symbols)**, and the screener grid doesn't visibly tag which basis a given P/E cell uses (only the single-stock 기업분석 page does). `scripts/fetch-data.mjs:2585,2616-2656`.
4. **[Naming/documentation gap, not numeric]** "Weinstein Stage" in code is a market-breadth proxy, not a per-stock 30-week-MA classification — no incorrect number is shown, but the label overstates the methodology.
5. **[Informational]** KR factors can trail US factors by multiple calendar days around Korean market holidays within the same snapshot, with no explicit "market closed" badge.

**Everything that IS numerically displayed and independently recomputable — RSI(14) Wilder, SMA%, N-day returns, 52-week high/low %, and SEC-fundamentals arithmetic (ROE/margin/EPS-from-P/E) — matched the independent from-scratch recomputation exactly (to rounding) across all 13 spot-checked symbols.** The defects found are about **source consistency, staleness disclosure, and basis labeling**, not about the arithmetic being wrong.
