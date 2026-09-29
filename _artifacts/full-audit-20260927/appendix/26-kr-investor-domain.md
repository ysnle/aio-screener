# AIO Screener — Korean Retail Investor Domain Gap Audit (Read-Only)

Date: 2026-09-28. Scope: `C:\projects\AIO`. Perspective: a Korean family member trading both US and KR stocks for real money, using AIO for decisions and learning.

**Framing note (important for interpreting severities below):** the `src/domain/portfolio/*` modules are built on an explicit "hold rather than fabricate" contract (see repeated `P1175/P1194/P1247/P1252` code comments) — when an input is ambiguous (mixed currency, missing FX leg, missing price) the code refuses to produce a number rather than guessing. This is unusually disciplined for a personal tool and most of the "hard rules" gaps below are not naive bugs — they are things nobody has told this careful system how to model yet (tax, lots, corporate actions, KR market microstructure). One genuine correctness bug was found (Section 1, T6/ZERO) and one real fail-open/fail-closed inconsistency was found (Section 3, holiday fallback).

---

## 1. Portfolio correctness

### What exists
- `src/domain/portfolio/surface.js` — `derivePortfolioSurface()`: per-holding market value, single blended `avgCost`, `totalCost`, `totalPnl` (value − cost), `totalPnlPct`. **Unrealized only** — no realized P&L concept anywhere in this module.
- `src/domain/portfolio/fx.js` — `convertWithDeclaredRates()`: converts using a user-declared `{from,to,rate,observedAt}` leg, refuses (returns `{ok:false,reason}`) if the leg is missing, observed after the valuation cut, or older than `FX_LEG_MAX_AGE_MS` (72h).
- `src/domain/portfolio/concentration.js` — per-position weight % and a concentration penalty ladder (10/15/25% bands); explicitly refuses to use `cost`/`avgCost` as a stand-in for market value.
- `src/domain/portfolio/backtest.js` — monthly backtest lab; requires `adjustedCloses` (rejects raw `close`), computes Sharpe/Sortino/MDD/VaR/CVaR with a bootstrap stability certification.
- `src/domain/portfolio/risk.js` — TWR/MWR account-performance calculator that requires a full transaction ledger with declared coverage flags; refuses without one.

### What does NOT exist (confirmed by reading every function in these 5 files + grep across `src/` and `js/`)
- **No FIFO / lot-level cost basis.** Only one `avgCost` number per symbol. There is no data structure anywhere (`src/domain/**`, `js/aio-workspace.js`, `js/aio-core.js`) for individual buy lots, so a partial sell cannot be attributed to a specific lot, and the model cannot distinguish "bought once at 150" from "bought 3 times at 100/150/200, sold 1 of 3." Averaging across the whole visible codebase — grep for `FIFO`/`averageCost`/`realizedPnl`/`realizedGain` across `src/` returned zero hits outside the files above, and even those only use `avgCost` as one field.
- **No realized-vs-unrealized separation.** `totalPnl` in `surface.js` is unrealized-only (current value − current cost of currently-held shares). There is no ledger of past sells, so "how much have I actually banked this year" (relevant for the 손익통산/양도세 question below) cannot be answered by the app at all.
- **No dividend modeling.** Grep for `dividend` in `src/domain/portfolio/*` returns only the word "dividends" inside a comment about `adjustedCloses` handling dividends *for the backtest lab's index-level return*, not for actual portfolio cash income. There is no dividend receipt tracking, no dividend yield contribution to P&L, no 원천징수 15%(US)/15.4%(KR) deduction anywhere in the portfolio holding record.
- **No stock split handling for live holdings.** `backtest.js` requires `adjustedCloses` for its *own* return calculation, but the live portfolio surface (`surface.js`) values holdings with `shares × price` where `shares` is whatever the user manually entered — if a user's KR/US holding splits 1:2, nothing in the app updates `shares` or `avgCost`; the user must manually edit both, and there is no split-event surface anywhere to prompt them.
- **No fees/commissions/환전 수수료 field** anywhere in the holding schema (`{ticker, qty/shares, price/currentPrice, value, avgCost, costCurrency, currency, sector, weightPct}` is the full set of fields consumed — confirmed by reading `resolvePositionValue()` in concentration.js and the row-mapper in `surface.js`).
- **FX P&L is not decomposed from price P&L.** `convertWithDeclaredRates()` uses **one** currently-declared FX leg to convert both `value` (today's market value) and `cost` (the original purchase-time cost) into the base currency. Because both axes are translated with the *same* today's rate, the "FX effect since purchase" cancels out inside `totalPnl` instead of being reported separately. See Test T4 below — the model has no way to show a Korean investor "내 미국 주식 수익 중 얼마가 주가 상승이고 얼마가 환율 때문인지," which is one of the most common questions this audience asks. This is a real design gap, not a refusal-to-fabricate — the code silently produces a number that looks precise but conflates two economically different sources of return.

### Synthetic test results (via `node`, importing `src/domain/portfolio/{surface,fx,concentration}.js` directly — no project files modified)

| # | Test | Input (key fields) | Output | Expected | Verdict |
|---|------|------|--------|----------|---------|
| T1 | Simple KR position, single lot | shares=10, avgCost=70000, value=750000 KRW | totalCost=700000, totalPnl=50000 (7.14%) | Same | **Pass** |
| T2 | "Blended avgCost" (proxy for multiple buys) | shares=15, avgCost=150, value=3000 USD | totalCost=2250, totalPnl=750 | Correct arithmetic, but confirms there is no lot journal underneath — a partial sell cannot be modeled by this module at all | **Gap, not bug** — FIFO/partial-sell tracking is architecturally absent |
| T3 | Mixed USD+KRW, no FX leg declared | AAPL(USD)+005930(KRW), no `fxLegs` | `totalAssets:null`, `currencyState:"mixed-without-conversion"` | Refuse to fabricate a total | **Pass** (correct refusal) |
| T4 | Mixed USD+KRW, FX leg declared | same + 1 KRW→USD leg | `totalAssets:3000`, `totalPnl:500` (single blended number) | A correctly-designed app would also expose `fxPnl` vs `pricePnl` | **Gap** — no FX/price P&L decomposition (see above) |
| T5 | FX leg 100h old (>72h max age) | leg observedAt 100h ago | `{ok:false, reason:"rate-stale"}` | Refuse stale rate | **Pass** |
| T6a | shares=0, value=0 (explicit legitimate zero) | `{shares:0, value:0}` | `value: null` (!) | `value: 0` — an explicitly-declared zero is a known fact, not missing data | **Bug (Medium severity)** — `firstPositive()` in `surface.js` (used for `explicitValue` at line ~138) treats `0` as absent because it requires `value > 0`. This means a fully-exited/worthless position recorded as `value:0` is silently indistinguishable from "no data," and would be treated as `valuationState:"unavailable"` for that row instead of a valid `$0` holding. `cash` handling in the same file (line ~226) correctly special-cases `cashValue === 0`; the holding-value path does not receive the same fix. Evidence: `src/domain/portfolio/surface.js:22-28` (`firstPositive`), `:132-161` (`holdingValue`). |
| T6b | shares=-5 (negative), value=-500 | `{shares:-5, value:-500}` | `shares:null, value:null` (held, not fabricated) | Refuse | **Pass** |
| T6c | shares=NaN | `{shares:NaN, avgCost:100, value:100}` | `shares:null`, `value:100`, `cost:null` | Refuse cost calc, keep explicit value | **Pass** |
| T6d | Very large numbers (1e12 shares × 1e6 avgCost) | value=1e18 | `cost:1e18, totalPnl:0` | No overflow/precision guard | **Minor gap** — no upper-bound validation on `shares`/`price`; values above `Number.MAX_SAFE_INTEGER` (~9.007e15) can lose integer precision silently. Unlikely in practice for a family portfolio but no defensive check exists. |
| T7 | Concentration: negative price / missing price / 66% concentrated position | 4 synthetic positions | negative-price and missing-price rows correctly excluded from denominator and flagged in `heldItems`; concentrated position correctly penalized (18 pts, ≥25% band) | Exclude and flag, don't zero-fill | **Pass** |

**Recommended v2 requirements (Section 1):**
1. Add a lot-level buy/sell journal (ticker, qty, price, fee, currency, fxRateAtTrade, timestamp) as the source of truth; derive `avgCost` and FIFO realized P&L from it instead of storing `avgCost` as a primitive.
2. Add a `realizedPnl` surface (by year, by symbol) — required before any tax-related feature (Section 2) is possible.
3. Decompose `totalPnl` into `localPricePnl` + `fxPnl` whenever `costCurrency !== baseCurrency`, using the FX rate *at each trade's timestamp* (requires #1) rather than one "current" leg for both cost and value.
4. Fix `firstPositive`-driven zero-swallowing for explicit `value`/`price` fields (use "declared vs missing" semantics like `cashValue` already does).
5. Add a dividend-receipt record and a corporate-action (split) surface that updates `shares`/`avgCost` on confirmed splits instead of relying on the user to manually fix both fields.

---

## 2. Korean tax & cost reality

### Current state of the app
- `js/aio-glossary.js:305,418` has exactly **one** tax-related glossary entry ("세금과 수수료"), which is generic and Korea-market-only: it cites 증권거래세법 시행령 제5조 (KOSPI 0.05%, 코넥스 0.10%, 코스닥 0.20%, dated 2026-01-02) and tells the user "세율은 법령 개정으로 바뀌므로 거래 전 최신 법령을 확인" — i.e. it explicitly punts on specifics for US-side tax. Good instinct (doesn't fabricate a rate), but it is educational copy, not a live calculator, and it is not linked from the portfolio page anywhere I could find (grep of `portfolio.js`/`aio-workspace.js` for the glossary term found no cross-reference).
- **No mention anywhere in the codebase** (grep across all `.js`/`.md` under the project root) of: 해외주식 양도소득세 22%/250만원 공제, 배당소득세 (15% US withholding / 15.4% KR), or 금융투자소득세 폐지 status. The absence of "금융투자소득세" text anywhere means the app cannot even tell a user the (correct, current) fact that 금투세 was repealed in Dec 2024 and will not apply in 2026 — a fact family members may still be confused about given the multi-year back-and-forth.
- Every P&L number shown anywhere in the portfolio surface (`totalPnl`, `totalPnlPct`, `dailyPct`, backtest CAGR/Sharpe) is **pre-tax and pre-fee**, and none of the domain code or (as far as grep can tell) UI copy labels it as such. There is no "세전" / "pre-tax" badge on the numbers.

### Verified current rules (web, 2026-09-28)
- 해외주식 양도소득세: 22% (20% 국세 + 2% 지방소득세) on gains above a **250만원/year** basic deduction, same-year 손익통산 (gains and losses across all foreign stock sales in the calendar year netted before the deduction applies). Filed May 1–31 of the following year. [foreign-stock tax guides, e.g. financecoffeechat.com/tax/foreign-stock-capital-gains-2026, valuetax.co.kr]
- 금융투자소득세 (금투세): repeal bill passed December 2024; **not in effect for 2026**. [peoplepower21.org, namu.wiki — both confirm repeal status as of the search date]
- 증권거래세: as already correctly captured in the glossary (KOSPI 0.05%/코스닥 0.20%/코넥스 0.10%, 2026-01-02 시행령 기준) — this part is accurate and current.
- Not independently re-verified in this pass but standard and unlikely to have changed: 배당소득세 15.4% (KR, 소득세+지방소득세) withheld at source; US dividend withholding 15% under the KR-US tax treaty for KR-resident individuals (both are withheld automatically by brokers, so the "gap" is informational, not a calculation the app needs to perform on money the user never receives gross).

**Recommended v2 requirements (Section 2):**
1. Label every P&L/return figure in the portfolio UI as "세전/수수료 제외" (pre-tax, before fees) at minimum — this is a one-line UI fix with outsized trust value for a family using real money.
2. Add a "해외주식 양도세 추정" reference calculator (not a filing tool): take realized 해외주식 gains for the calendar year (needs Section 1's realized-P&L ledger), subtract 250만원, apply 22%, clearly marked as an estimate and "최종 신고는 세무사/증권사 안내 확인." Do not attempt withholding-tax or KR-side capital gains (KR listed-stock gains are untaxed for most retail investors below the large-shareholder threshold — do not build logic that assumes otherwise).
3. Add one glossary/education entry stating plainly that 금투세 is repealed as of Dec 2024 and does not apply, since this is a frequently-confused, frequently-changing fact exactly the kind of thing an educational family tool should get right and keep current.

---

## 3. Korean market mechanics

### Trading hours / calendar
- `src/ai/time/market-session.js` (newer, ESM, disciplined): defines `MARKET_CALENDAR_ADAPTERS.KRX = {open:'09:00', close:'15:30', dstAware:false}` and `NYSE = {open:'09:30', close:'16:00', dstAware:true}`; `US_REGULAR_CALENDAR_2026` includes `halfDays: {'2026-11-27':'13:00','2026-12-24':'13:00'}`. Crucially, `resolveMarketCalendarSession()` returns `status:'unknown'` for any year without a registered calendar — **fails closed**. This module handles DST correctly for the US session by resolving through `America/New_York` via `Intl.DateTimeFormat`, so KST display of US market hours is DST-correct here.
- `js/aio-core.js` `DATE_ENGINE` (older, legacy, still the one wired into most of the UI per grep — `isKrTradingDay`/`isUsTradingDay`/`lastKrTradingDayEx` are called throughout `aio-core.js`/`aio-pages.js`): hardcodes `KR_HOLIDAYS_2026/2027` and `US_HOLIDAYS_2026/2027` arrays (`js/aio-core.js:22878-22925`), and **for any year not in the map, silently reuses `KR_HOLIDAYS_2026`/`US_HOLIDAYS_2026` as a fallback** (`js/aio-core.js:22939,22946`: `_KR_HOLIDAYS_MAP[d.getFullYear()] || KR_HOLIDAYS_2026`). This **fails open** with wrong data instead of failing closed like the newer module — a real inconsistency between two calendar implementations in the same codebase, and for 2028+ the legacy engine will silently misjudge KR/US trading days using stale 2026 dates rather than saying "unknown."
- **Verified gaps in the hardcoded 2026 KR holiday array itself** (web search against 2026 KRX holiday guides, e.g. glasswallet.com/blog/stock-market-holiday-2026-guide, tradinghours.com/markets/krx): 2026 KRX market holidays reportedly total 17 days and include at least three dates **missing** from `KR_HOLIDAYS_2026`:
  - **2026-05-01** (근로자의 날 / Labor Day) — KRX and Korean securities firms are closed on this date every year; it is not a "공휴일" for schools/government but *is* a market holiday. Not present in the array.
  - **2026-06-03** (제9회 전국동시지방선거, a legally mandated election-day market holiday) — not present.
  - **2026-07-17** (제헌절 — restored as a public holiday for 2026 after 18 years) — not present.
  - The Chuseok 대체공휴일 on 2026-09-28 (because 2026-09-26, the last day of Chuseok, falls on a Saturday) also appears absent (array stops at `2026-09-26`).
  If accurate, the app would show KRX as "open" on up to 4 actual holidays in 2026 — this directly matters for a live-trading family tool (e.g. "장 마감까지 X시간" countdowns, "오늘 거래 가능" checks). **Recommend the operator cross-check both arrays against the KRX's own official 매매거래정지일 공고 before the next redeploy** — this audit's web search is a secondary source, not the primary KRX notice.
- No half-day (조기폐장) modeling anywhere for the US "day after Thanksgiving"/"Christmas Eve" 1pm ET closes inside the legacy `DATE_ENGINE` (only the newer, less-wired `market-session.js` has `halfDays`) — a KST countdown built on the legacy engine would show the wrong closing time on those two days each year.

### KR-specific microstructure — not implemented at all (confirmed via grep across the whole repo, all zero-match)
- **NXT (넥스트레이드) 대체거래소**: zero references anywhere in the codebase. NXT launched 2025-03-04 and lets a subset of KOSPI/KOSDAQ names trade 08:00–20:00 (pre-market 08:00–08:50, main 09:00:30–15:20, after-market 15:30/effective 15:40–20:00; short selling banned outside the 09:00–15:25 regular window). AIO's KR session model only knows the single legacy 09:00–15:30 KRX window; any NXT-listed dual-quote pricing or after-hours KR movement is invisible.
- **동시호가 (call auction) open/close** mechanics, **가격제한폭 ±30%**, **VI (변동성완화장치)**, **호가단위 (tick size table)**, **관리종목/거래정지/투자경고** live status per holding, and **공매도** market-wide status: zero implementation. The only related hit is a KR-language *news search keyword list* in `js/aio-data.js:8426-8429` (`'상장폐지','거래정지','관리종목','불성실공시'` used to tag/search news articles) — this is a text-classification keyword, not a live per-symbol status flag on the portfolio surface. A Korean retail investor holding a 관리종목 stock gets **no in-app warning** of that fact.

**Recommended v2 requirements (Section 3):**
1. Retire the legacy `DATE_ENGINE` hardcoded arrays in favor of the `src/ai/time/market-session.js` fail-closed calendar model, or at minimum make the legacy fallback fail closed (`status:'unknown'`) instead of silently reusing a prior year's dates.
2. Before the next KR trading-day-dependent release, verify `KR_HOLIDAYS_2026`/`2027` against the official KRX 매매거래정지일 notice (not this audit's web search) — specifically check 근로자의 날, election-day closures, and 제헌절 for 2026.
3. Add US half-day (1pm ET) awareness to whichever engine actually drives the countdown/"장 마감까지" UI.
4. If any covered symbol has an NXT-listed alternate quote, at minimum disclose "정규장(09:00–15:30) 외 넥스트레이드 거래 가능 종목일 수 있음" rather than implying KRX 09:00–15:30 is the only price-forming window.
5. Add a per-holding 관리종목/거래정지/투자경고 status check (KRX or a licensed data vendor) — this is a real capital-preservation feature (family members should never be surprised their stock is halted), not just an information nicety.

---

## 4. Corporate actions (splits/dividends) and price-history basis

- `backtest.js` is disciplined here: it **requires** `series.backtestEligible === true`, `series.backtestPriceBasis === 'adjusted-close'`, and an `adjustedCloses` array (distinct from `closes`) before it will compute any return — see `_aioBtMonthEnds()` (only reads `series.adjustedCloses`, never `series.closes`) and the `missingAdjusted` guard (backtest.js ~line 616-635) that **refuses** the whole backtest run if any member lacks a proper adjusted series, rather than silently falling back to raw close. This correctly avoids the classic "52-week high broke because of a stock split" bug for the backtest lab specifically.
- However, this discipline is scoped to the backtest lab only. The **live portfolio surface** (`surface.js`) values current holdings using whatever live quote or manually-entered `price`/`value` is available — there is no adjusted-vs-raw distinction there because there's no historical series involved at all; correctness instead depends entirely on the *user* updating `shares`/`avgCost` by hand after a split (see Section 1's split gap). So: the analytical/backtest layer is split-aware, the actual money-tracking layer is not.
- Whether the **charting/quote layer** elsewhere in `js/aio-core.js`/`js/aio-data.js` (Yahoo-sourced 52-week-high, daily % change, etc., outside the portfolio domain) uses adjusted or raw close was not exhaustively re-verified in this pass beyond the backtest lab's own explicit contract — recommend a follow-up grep of `regularMarketPrice`/`fiftyTwoWeekHigh` consumers in `aio-core.js` (26 files matched a broad `adjclose|close` search; a full one-by-one review was out of scope for this audit's time budget) if precise 52w-high split-safety needs sign-off.

**Recommended v2 requirement:** extend the "adjusted close required, no silent fallback" discipline already proven in `backtest.js` to any other historical-price consumer (52w high/low, YTD return charts) that isn't part of the portfolio backtest lab.

---

## 5. KR data coverage

| Data type | Exists? | Source (as found) | Notes |
|---|---|---|---|
| KR live quotes | Yes | Yahoo Finance (via `krTickerToYahoo` mapping, `js/aio-core.js`) | Standard delayed/live quote path shared with US symbols |
| KR 외국인·기관 수급 (foreign/institutional flow) | Yes | Naver Finance, scraped via CORS proxy (`js/aio-kr-data.js:582-762`) | Explicitly labeled with fallback/failure states ("수급 미수신 · 값을 표시하거나 현재 판단에 사용하지 않습니다") when the proxy is blocked — good failure discipline, but fragile by design (scraping, not an API) |
| KR PER/PBR fundamentals | Not clearly located | — | No DART or dedicated KR-fundamentals source found in `js/aio-kr-data.js`; likely inherits whatever Yahoo Finance exposes for KRX tickers (frequently incomplete/stale for KR names) |
| DART 공시 (Open DART, free official API) | **Not used** | — | Grep for `DART`/`dart.fss`/`opendart` across the whole repo returns zero genuine matches (all matches were the SEC EDGAR "공시" comment text or unrelated files) — the free, official disclosure API for Korean companies is not integrated anywhere |
| 공매도 잔고 (short-interest balance) | **Not found** | — | No implementation |
| 관리종목/거래정지 status | **Not found** (see Section 3) | — | Only a news-keyword tag |
| KRX official data (index composition, halts, etc.) | **Not found** | — | No direct KRX API integration |

**Recommended v2 requirement:** Open DART (`opendart.fss.or.kr`) is free, official, and would upgrade KR fundamentals, disclosure alerts, and 관리종목 status simultaneously — this is the single highest-leverage free data addition for the KR side of the product, and it aligns with the project's existing "free public API" pattern already used for BOK/KOSIS/FRED (per project memory).

---

## 6. Currency display

- There is a `pf-base-currency-input` free-text field (`js/aio-workspace.js:277`) — the user types a 3-letter code (validated against `/^[A-Z]{3}$/` via `cleanCurrencyCode` in `fx.js`), not a KRW/USD toggle switch. There is also a separate FX-leg declaration UI implied by `readPortfolioAssumptionDeclarations()`/`appendFxLeg` for manually entering an observed rate + timestamp.
- The FX rate used for the one auto-fetched leg (`KRW=X` via Yahoo, `js/aio-workspace.js:1667-1670`) is fetched live when available; if unavailable, "엔진이 현지 통화 결과만 게시한다(추정하지 않음)" — i.e., it correctly refuses to guess, per the domain layer's contract in `fx.js`.
- No evidence of a one-click "Show everything in KRW / show everything in USD" toggle for the whole portfolio view — the base-currency conversion is an opt-in declaration (base currency + FX leg), not a default always-on display convenience. For a Korean family this is backwards from the expected default: most users would expect KRW totals by default with a USD toggle, not "declare your currencies and paste in an FX rate to see a combined total."
- As already covered in Section 1, cost-basis FX (the rate at purchase time) and current-valuation FX (today's rate) are conflated into one "current" leg, so the currency conversion, while honest about *when* it refuses to convert, is not honest about decomposing *why* the converted P&L moved.

**Recommended v2 requirement:** default the portfolio view to a KRW total (most natural for the target family), with a one-click USD toggle, and auto-populate the FX leg from the already-fetched `KRW=X` live quote instead of requiring a manual declaration — while preserving the existing "refuse if the auto-fetched leg is stale/missing" discipline.

---

## 7. Family onboarding & access

- **Storage is local-only.** `getPortfolioData()`/`savePortfolioData()` (`js/aio-workspace.js:226-260`) read/write `localStorage` (optionally through an in-page "vault" encryption layer, `_AioVault`), with 46 total `localStorage` references in that one file (watchlists, portfolio, FX/base-currency declarations, etc., are each their own key). There is **no server-side account or sync** — this matches the project's known intent (free, no accounts, family-only) but has real consequences:
  - **Switching devices loses everything** unless the user manually exports first. There is no auto-backup, no cloud sync, no QR/link-based transfer.
  - **Per-user isolation is by device/browser, not by identity** — if two family members share a computer/browser profile, they share one portfolio unless they know to use separate browser profiles. Nothing in the app itself warns about this.
- **Export/import is confirmed incomplete**, matching the task's suspicion: `exportPortfolio()` (`js/aio-workspace.js:1850-1858`) calls `getPortfolioData()` — which returns **only the raw positions array** (ticker/qty/cost/memo/note/etc., the `PF_STORAGE_KEY` value). It does **not** include:
  - Base currency / cash currency declarations, FX legs, cash-return assumption, risk-free-rate assumption (all stored under a separate key read by `readPortfolioAssumptionDeclarations()`, `js/aio-workspace.js:290`).
  - Watchlists (`WL_STORAGE_KEY = 'aio_watchlists'`, `js/aio-workspace.js:1895` — a completely separate key, never touched by export).
  - Any trade/transaction journal — moot today since none exists (Section 1), but will need to be included once one is built.
  - Cash balance itself, if tracked separately from `totals.cash` in the portfolio state object consumed by `surface.js`.
  - `importPortfolio()` (`js/aio-workspace.js:1859-1890`) correspondingly can only restore what was exported — so a full device switch today loses FX settings and watchlists silently, with no warning to the user that the restore is partial.
- **AI usage is a shared/operator-funded quota**, not BYOK per user (consistent with project memory: FMP free tier + shared Claude quota across ~5 concurrent family users) — so there is no per-user API key exposure risk, but there is also no per-user usage visibility/limit found in this pass; a single heavy user could exhaust the shared quota for everyone with no in-app signal.

**Recommended v2 requirements (Section 7):**
1. Make `exportPortfolio()`/`importPortfolio()` export **all** portfolio-related localStorage keys (positions, FX/currency declarations, watchlists, and any future trade journal) as one versioned JSON bundle, not just the positions array.
2. Add an explicit in-app warning when import only partially restores state (today it always does, silently).
3. Consider a lightweight "restore code" or single-file bundle download prompt on first use per device, since these are non-technical family members who will not think to export proactively before switching phones/laptops.

---

## 8. Behavioural-risk design

- **Risk warnings exist and are reasonably placed**: `index.html:12910` — "생활비, 비상금, 대출금은 절대 투자하지 마세요... 모든 투자에는 원금 손실 위험이 있습니다"; `index.html:13257` — "투자 유의: 정보 제공용이며 최종 판단은 본인 책임입니다." Present, plain-language, appropriately humble for a family tool.
- **Loss-aversion / discipline education is present and unusually well-hedged**: `js/aio-glossary.js` entries for 손절(Stop Loss), 익절(Take Profit), 포지션 사이징, and 손실 회피(Loss Aversion) explicitly frame specific numbers (ATR 1.5–2x, 1/3 partial take-profit, 1–2% max risk per trade) as "방법론 예시" (a methodology example), not a rule, and cite Kahneman/Tversky for the loss-aversion bias itself. This is better than most retail tools, which either state a fake-authoritative rule or omit the topic.
- **No interactive tool operationalizes this education inside the portfolio itself** — the stop-loss/position-sizing content lives only in the glossary, not as a calculator or alert wired to actual holdings (e.g., nothing computes "this position is already 28% of your account, above your own stated 25% comfort band" as a live nudge from `concentration.js`'s own `topWeightPct`/`concentrationPenalty` output, even though that data already exists and is computed). This is a missed opportunity rather than a hazard: the concentration model already flags the exact scenario a stop-loss/position-sizing feature would want to surface, but nothing surfaces it to the user proactively.
- **Overtrading incentive check**: `trading-score.js` (`computeTradingScoreModel`, `deriveSignalDecisionFromTradingScore`) produces a scored signal/decision model, but this audit did not have time to evaluate its live IC (predictive validity) or check whether its outputs are displayed with an "past signal accuracy" disclosure. Given the rest of the codebase's evidence-discipline pattern (P-numbered guardrails throughout `risk.js`/`backtest.js`/`surface.js` refusing unverified claims), it is plausible but not confirmed that the same discipline extends to the trading-score/signal surface — **recommend a follow-up pass specifically on `src/domain/signal/trading-score.js` and wherever it renders in the UI**, checking whether it discloses backtested hit-rate/IC or presents signals as more validated than they are; this could not be completed within this audit's scope.

**Recommended v2 requirements (Section 8):**
1. Wire the existing `concentration.js` output (`topWeightPct`, `concentrationPenalty`) into a visible, proactive nudge on the portfolio page itself, not just an internal risk-score input.
2. Follow up specifically on `trading-score.js`/signal UI for overtrading-incentive risk (out of scope for this pass — flagged, not resolved).
3. Keep the existing glossary's "example, not rule" framing — it is a genuine strength; do not let a future position-sizing calculator regress into presenting one fixed rule as correct.

---

## Summary of file:line evidence referenced
- `src/domain/portfolio/surface.js` (whole file read) — avgCost-only cost model, FX conversion, zero-value bug (~line 22-28, 132-161)
- `src/domain/portfolio/fx.js` (whole file read) — declared-FX-leg-or-refuse contract
- `src/domain/portfolio/concentration.js` (whole file read) — weight/penalty model, invalid/missing-price handling
- `src/domain/portfolio/backtest.js` (partial read, ~1-812 of 1126 lines) — adjusted-close discipline, currency-axis refusal logic
- `src/domain/portfolio/risk.js` (whole file read) — TWR/MWR ledger requirement
- `src/ai/time/market-session.js` (whole file read) — fail-closed calendar model, DST-correct US session resolution
- `js/aio-core.js:22878-22973` — legacy `DATE_ENGINE`, hardcoded 2026/2027 holiday arrays, fail-open fallback bug
- `js/aio-glossary.js:305,417-419` — sole tax-related content
- `js/aio-workspace.js:226-260, 277, 290, 1667-1670, 1850-1890, 1895` — storage, export/import, FX declarations, watchlists
- `js/aio-kr-data.js:4-762` — KR 수급 (Naver-scraped) implementation and failure-state handling
- `js/aio-data.js:8426-8429` — 관리종목/거래정지 as a news-keyword list only

## Web sources cited
- [2026 증시 휴장일 (glasswallet.com)](https://glasswallet.com/blog/stock-market-holiday-2026-guide/) — 17 KRX holidays incl. 근로자의날/지방선거/제헌절 for 2026
- [KRX Market Hours & Holidays 2026 (tradinghours.com)](https://www.tradinghours.com/markets/krx)
- [NYSE Group 2025/2026/2027 Holiday Calendar (ir.theice.com)](https://ir.theice.com/press/news-details/2024/NYSE-Group-Announces-2025-2026-and-2027-Holiday-and-Early-Closings-Calendar/default.aspx)
- [해외주식 양도소득세 2026 가이드 (financecoffeechat.com)](https://www.financecoffeechat.com/tax/foreign-stock-capital-gains-2026)
- [해외주식 양도세 계산 가이드 (valuetax.co.kr)](https://www.valuetax.co.kr/2026%eb%85%84-%ed%95%b4%ec%99%b8%ec%a3%bc%ec%8b%9d-%ec%96%91%eb%8f%84%ec%86%8c%eb%93%9d%ec%84%b8-%ec%8b%a0%ea%b3%a0%c2%b7%ea%b3%84%ec%82%b0%c2%b7%ec%a0%88%ec%84%b8-%ec%99%84%eb%b2%bd-%ea%b0%80/)
- [금융투자소득세 총정리 (namu.wiki)](https://namu.wiki/w/%EA%B8%88%EC%9C%B5%ED%88%AC%EC%9E%90%EC%86%8C%EB%93%9D%EC%84%B8) — repeal confirmed Dec 2024
- [넥스트레이드(NXT) 거래시간 안내 (mettafriend.com)](https://www.mettafriend.com/2026/09/korea-stock-trading-hours-2026.html) — 08:00-20:00 window, short-sale restriction to regular hours only
