# Domain Audit — Portfolio / KR Market / News & Sentiment / Macro & FX-Bond / Options
Scope per prompt items (1)-(5). Read-only static analysis + node ESM harness tests on `src/domain/**`.
All severities: Critical / High / Medium / Low. Unverified items explicitly marked.

---

## 1. PORTFOLIO (`src/domain/portfolio/*`, `src/data/portfolio-*`, `src/storage/*`, `js/aio-workspace.js`)

### Overall assessment
This is the most defensively engineered subsystem in the repo. Nearly every one of the audit's
target failure modes (cost-basis-as-market-value fallback, silent zero for missing quotes,
FX triangulation, unlabeled TWR/MWR, concentration renormalization after exclusion) has an
explicit guard with a P-numbered comment explaining the historical bug it closes. Verified by
reading `risk.js`, `backtest.js`, `concentration.js`, `fx.js`, `surface.js`,
`portfolio-ledger.js`, `portfolio-assumptions.js`, `portfolio-declarations-store.js`, and the
storage layer (`vault.js`, `migrations.js`, `repository.js`, `screener-runs.js`).

**Keep-list (working correctly, do not touch):**
- `fx.js` `convertWithDeclaredRates`/`resolveFxRate`: no triangulation, no implicit rate=1,
  refuses on missing/stale (>72h)/future-observed legs; `value-missing` guarded against
  `Number(null)===0` coercion (fx.js:99).
- `surface.js` `holdingValue`/`derivePortfolioSurface`: missing quote → `value:null,
  sourceKind:'unavailable'`, never 0; mixed-currency totals refuse to sum without a declared
  leg (P1175/P1194); cost-currency ≠ price-currency P&L is refused unless converted (P1181/P1196).
- `concentration.js` `resolvePositionValue`: cost/avgCost is explicitly barred from standing in
  for market value (CON-01) — position becomes `data-insufficient`, held out of both numerator
  and denominator (no silent renormalization of remaining holdings).
- `risk.js` `assessAccountPerformance`: TWR via linked sub-period chain (`actual-365` day count,
  declared `flowTiming` start/end-of-period), MWR via bisected IRR; every missing ledger input
  (`trades, deposits-withdrawals, dividends-splits, fees-taxes, fx, valuation-cuts`) blocks the
  calc individually rather than silently defaulting.
- `backtest.js`: requires `adjustedCloses` + `backtestEligible==='adjusted-close'` (dividends/
  splits via total-return series, never raw close); VaR/CVaR carry a bootstrap-based
  "certification" gate (`deriveVarStability`) with declared minimum sample/tail-size thresholds
  — a thin sample is held, not published with false confidence (this is the *opposite* pattern
  of the News-domain gap found below).
- `storage/migrations.js` + `repository.js`: real `STORAGE_SCHEMA_VERSION` (=2) with a
  migration-step registry and read-side `validate()` gate — not a placeholder.
- Vault write ack correctly separates `memoryApplied` (this-turn visibility) from durable
  persistence (`ok`), so a rejected write cannot be reported as "저장 완료" — verified in
  `portfolio-declarations-store.js:61-84` and mirrored in `js/aio-workspace.js:savePortfolioData`.

### Findings

**[High] Export is silently partial — ledger, FX legs, and all portfolio assumptions are not
included in "내보내기" (backup).**
`js/aio-workspace.js:1850-1858` `exportPortfolio()` only serializes `getPortfolioData()`
(the flat positions array: ticker/qty/cost/memo/sector/targetWeight/currency). It does **not**
include:
- `PF_LEDGER_KEY` (`aio_portfolio_ledger`) — deposits/withdrawals, valuation marks, coverage
  declarations that `assessAccountPerformance` requires for TWR/MWR (js/aio-workspace.js:321,
  355-360).
- `PF_FX_KEY` (`aio_portfolio_fx_legs`) — declared FX legs (js/aio-workspace.js:323, 361-362).
- Portfolio assumptions (`aio_portfolio_base_currency`, `_cash_currency`, `_cash_return`,
  `_rf`, `_risk_path`, `_rebalance_policy` — `src/data/portfolio-assumptions.js:13-20`).
The export button gives no indication this is a partial backup. A user who exports, clears
browser storage (or switches device — this is a localStorage-only app per the memory note),
and re-imports will silently lose every ledger entry, FX declaration, and risk/currency
assumption with no warning at either export or import time. Given how much of this module's
engineering effort (§ above) exists specifically to make these declared inputs load-bearing for
TWR/MWR/risk, losing them on backup undermines the feature.
Fix: either (a) export a single JSON envelope `{ positions, ledger, fxLegs, assumptions,
schemaVersion }` and update `importPortfolio` to restore all four, or (b) if scope is
intentionally position-only, rename the button/toast to say so explicitly.

**[Low] Import sanitizes specific fields only; unlisted fields pass through unsanitized but are
escaped at render.** `importPortfolio` (js/aio-workspace.js:1859-1890) validates `ticker` via
regex, truncates `memo`/`note` to 200 chars, coerces `qty`/`cost` to `Number(...)||0`. Other
fields (`sector`, `targetWeight`, `currency`, `costCurrency`) pass through unchecked from
attacker-controlled JSON. Verified this is not an XSS vector in practice: the one render path
found (`js/aio-workspace.js:914`) uses `escHtml(p.memo)`. No `innerHTML` sink was found for
`sector`/`note`/other free-text fields feeding directly from import — but this was verified only
for `aio-workspace.js`; not exhaustively swept across `aio-core.js`/`aio-ui.js` consumers of
portfolio rows. Recommend explicit type/length caps on `sector`/`targetWeight`/currency codes at
import time rather than relying solely on downstream escaping. **Unverified**: whether any other
render path treats `p.sector` or `p.note` as trusted HTML.

**[Info/keep] Missing-quote handling is correct.** Confirmed via `derivePortfolioSurface`/
`resolvePositionValue`: absent price → `null`/`data-insufficient`, never coerced to 0, and never
allowed to silently renormalize peer weights. This directly answers the prompt's "unknown vs
zero" question — the answer is "correctly unknown."

**[Info] TWR vs MWR:** both are computed, both gated on declared ledger coverage, and both are
correctly built on the account ledger (not the holdings snapshot) — this satisfies "실제 원장
없으면 account TWR/MWR 보류" per the E4 acceptance criterion in the code's own comments.

---

## 2. KR MARKET (`js/aio-kr-data.js`, +helpers in `aio-core.js`/`aio-ui.js`/`aio-data.js`)

### Data sources (confirmed by grep, not by live network capture — **provenance is
self-reported in comments/source-registry, not independently verified against Naver's actual
ToS text**)
- Index/investor-flow data ("수급"): `m.stock.naver.com/api/index/{KOSPI,KOSDAQ,VKOSPI}/*`
  (undocumented Naver **mobile web** API), fetched via `fetchViaProxy` (CORS proxy chain), with
  direct-fetch-then-proxy-fallback (js/aio-kr-data.js:631-678, 1030-1056).
- Price series for `.KS`/`.KQ` tickers: Yahoo Finance chart endpoints (confirmed via
  `_getPriceRule`/`_validatePrice` in `js/aio-data.js:13684-13749`, which special-cases
  `symbol.endsWith('.KS')||.endsWith('.KQ')` with a ±30% jump threshold).
- `src/data/contracts/source-registry.js:68-69,132-134` **already documents** this as a known
  structural limit: `structuralLimit: { kind: 'krx-rights', reason: 'Approved KRX/Koscom
  redistribution is not configured', remediation: '...do not promote Naver/web values as
  official exchange data.' }` — i.e., the team is aware this is unofficial/unlicensed and has
  explicitly fenced it off from being labeled "official." This is good practice, but it is a
  **disclosure, not a remediation** — the operational/legal exposure (scraping an undocumented
  mobile API through a CORS proxy) is unchanged. **[Medium]** — known-and-documented but
  unresolved; no attribution shown to end users, no fallback if Naver blocks the proxy chain
  beyond a "수급 원천 미수신" (source not received) state, which is itself handled gracefully
  (`_showKrSupplyFailureState`).

**[Medium] No KRX holiday calendar — `_getKrxSession()` only checks weekday + time-of-day.**
`js/aio-core.js:19230-19242`: returns `'open'` for 09:00-15:30 KST on any Mon-Fri, with **no**
Korean public holiday table (Lunar New Year, Chuseok, 삼일절, 광복절, etc. — roughly 15
non-weekend closures/year). The same gap exists for the US session helper `_getUsSession()`
(js/aio-core.js:19250-19274 — weekday+time only, no Thanksgiving/Christmas/etc.). Consequence:
on a KRX holiday the app will report the market as "open" during 09:00-15:30 KST, which feeds
staleness/freshness logic (`kr-supply` state, "장중" labeling) and could present a holiday's
stale end-of-day Naver snapshot as if it were live intraday data. **Not independently verified**
whether any downstream consumer actually branches on `_getKrxSession()==='open'` to suppress a
staleness warning — confirmed only that the session function itself has no holiday awareness.

**[Resolved / keep-list] VKOSPI "previously static" bug is fixed.** The comment at
`js/aio-kr-data.js:981-986` (`FABLE-LIVE-AUDIT-2026-07-07 F3/L4`) documents the original bug (a
hardcoded 2026-05-08~06-05 20-session array in `initKrVkospiChart`, never refreshed). Current
`js/aio-ui.js:6028-6057` `initKrVkospiChart()` now requires ≥3 real accumulated observations via
`_aioGetVkospiHistorySeries` (client-side localStorage upsert on every successful fetch,
`js/aio-kr-data.js:989-1000`) and explicitly renders "결측" (missing/blocked) with
`data-operational-use="blocked"` when fewer than 3 real points exist, rather than falling back to
the stale hardcoded array. Live VKOSPI value fetch also has a 3-failure threshold before
surfacing an explicit failure state (`_vkospiIsFailedState`, threshold=3) and clears the
`_vkospiLiveOk` flag on failure so stale values can't be quoted as current (P1142). **This
finding from the "previous audit" referenced in the prompt is no longer present in the code.**

**[Low] KRX ±30% price-limit check is a data-sanity heuristic, not a market-microstructure
model** (js/aio-data.js:13684-13749) — this is appropriate for the stated purpose (rejecting
provider glitches), not a gap, but worth noting it does not model actual 상한가/하한가 halts,
VI (vari able interval) triggers, or partial-fill behavior; the app makes no such claim either
(confirmed no "실시간 호가/체결" claims in KR pages).

**[Low/dead-code] `_enrichMarketCap`'s fallback symbol guess always assumes `.KS`.**
`js/aio-kr-data.js:1307`: `var sym = code + (code.length === 6 ? '.KS' : '')` — does not
consult the KOSDAQ set (unlike the correct pattern at line 1845: `code + (kosdaq[code] ?
'.KQ' : '.KS')`). In practice this is a secondary fallback matcher behind a primary
`KR_STOCK_DB[i].code === code` match, so it appears inert for KOSDAQ names rather than
producing wrong output — flagged as dead/misleading code, not a live correctness bug.
**Unverified**: whether `KR_STOCK_DB[i].code` is always populated (if any entries rely solely on
`.sym` matching, KOSDAQ market-cap enrichment would silently fail to update).

**[Info] 외국인/기관 수급 provenance**: confirmed sourced from Naver's investor-trend endpoint
only (`window._krCurrentSupplyEvidence = {..., source: 'Naver investor trend'}`,
js/aio-kr-data.js:795) — single-source, no KRX-official cross-check, consistent with the
`structuralLimit` disclosure above. Evidence includes an explicit age/validity gate
(`_krSupplyEvidenceStatus`, ageMs<24h) before being trusted (js/aio-kr-data.js:1280-1295) — good
practice.

**KRW formatting / 종목코드**: spot-checked; no numeric-formatting defects found (uses
`toLocaleString('ko-KR', ...)` consistently for dates; currency amounts use `formatAmt`/Math.round
helpers). Not exhaustively swept given file size (3234 lines, grep-only per instructions).

---

## 3. NEWS & SENTIMENT (`src/domain/news/scoring.js` — **working tree has uncommitted changes**,
`js/aio-data.js` news pipeline, `js/aio-core.js` trading-score integration)

### Diff under review (uncommitted, `git diff -- src/domain/news/scoring.js`)
Adds: `isNewsHeadlineOnly`, `isNewsAnalysisEligible` (requires body/summary ≥40 chars AND
verificationStatus not in `unverified|secondary-only|stale`), `isNewsTopicReviewRequired`
(feed-query topics excluded from topic-keyed risk signals), a declared `windowStart/windowEnd`
override path (`filterByWindow`/`filterByEvidenceWindow`), and a new unused-so-far export
`deriveNewsSummary` (not called from anywhere in `js/` or `src/` — confirmed via repo-wide grep;
this part of the diff is inert/WIP, not yet wired to any surface).

This is philosophically the right direction — it operationalizes the prompt's own ask
("headline-only claims labeling") by refusing to let a bare headline count as sentiment/risk
*evidence*. However, testing it against representative inputs surfaced a real interaction gap:

**[High] `computeNewsSentimentScore`/`computeNewsRiskSignals` have no minimum-sample gate, and
the new evidence-eligibility filter (body ≥40 chars) shrinks the real-world eligible sample —
so a single qualifying headline can now swing the published score to an extreme, and that score
feeds directly into the overall trading-score model with no visibility into `total`.**
Verified with a node ESM harness against `src/domain/news/scoring.js` (synthetic 4-item feed:
1 long-bullish item [153-char desc], 1 short-bearish item [29-char desc, real content but under
the new 40-char floor], 1 empty-desc KR "backstop" item [see below], 1 stale item outside the
24h window):
```
sentiment: { score: 100, label: '강한 낙관', bullCount: 1, bearCount: 0, total: 1, ... }
```
The bearish item was excluded *solely* by the new body-length gate (not by staleness or
unreliability), leaving `total: 1` — one headline — and the score swung to the maximum bullish
reading (100/"강한 낙관") despite a countervailing signal existing in the same batch. This
matters because:
1. `js/aio-data.js` deliberately injects **empty-description** items into `newsCache` as a KR
   coverage backstop: `js/aio-data.js:12658-2673` pushes `desc: '', summary: ''` rows
   ("v51.22: KR 뉴스 슬롯 보완") specifically because "클라이언트 RSS 파이프라인에 Korea 피드
   없음." These are now unconditionally excluded from both sentiment and risk-signal scoring by
   the new `isNewsAnalysisEligible` gate — likely intended, but it further thins the eligible
   sample on days when KR coverage leans on this backstop.
2. `computeNewsSentimentScore().score` is consumed directly by the decision-facing trading-score
   model with **no sample-size context**: `js/aio-core.js:23680`
   `newsSentimentScore = computeNewsSentimentScore().score;` — only `.score` is read, `.total`
   is discarded, so the composite score cannot distinguish "100 from 40 corroborating articles"
   from "100 from 1 thin article."
3. This is inconsistent with this codebase's own established discipline elsewhere: the
   portfolio VaR path (`backtest.js` `deriveVarStability`) explicitly holds certification when
   `sampleN < minSampleN` (default 36) or `tailN < minTailN` (default 3) rather than publishing
   a confident number from a thin sample. News sentiment/risk has no analogous
   `total < N → 'label: 데이터 부족'` gate — it already returns "데이터 부족" only when
   `total === 0`, never for "technically nonzero but tiny."
Recommendation: (a) add a minimum-total threshold (e.g., total < 5 → hold/label as
"표본 부족", mirroring the VaR gate's philosophy) before `computeNewsSentimentScore`/
`RiskSignals` publish a non-neutral score, and (b) have `js/aio-core.js:23680` read `.total`
alongside `.score` so a thin-sample condition can suppress or discount the trading-score
contribution. This should be fixed **before** this WIP diff is committed, since committing it
as-is measurably increases exposure to the thin-sample case (by filtering out more items than
the previous 24h-only gate did).

**[Medium/verify-before-ship] The new `isNewsAnalysisEligible` 40-char threshold has not been
validated against real RSS feed output.** Whether this materially changes production behavior
depends on how many live feed items have `desc`/`summary` under 40 chars. Confirmed multiple RSS
ingestion sites in `js/aio-data.js` do populate `desc` from `item.description`/`content` sliced
to 280 chars (lines 12070, 12295, 12470) — these are likely long enough in the common case — but
Google-News-style aggregator feeds are known to sometimes return short/boilerplate description
HTML (source name only) after tag-stripping. **Unverified without live network capture**: actual
distribution of `desc` lengths from the production RSS/proxy pipeline. Recommend instrumenting
`total` before/after this filter in production for one news cycle before merging.

**[Resolved / keep-list] "[번역 대기] permanently stuck" bug appears fixed.** No literal
`[번역 대기]` placeholder string exists in current `js/`. Comments at `js/aio-core.js:3829,4212`
and `js/aio-data.js:11732` describe the historical bug (translation-pending placeholder never
resolving because certain surfaces — Top3 digest / lazy-load-observer-missed cards — weren't in
the initial batch-translate or lazy-translate queue) and the fix (proactive
`autoTranslateNews(...)` call for any item not already in `_translationCache`, e.g.
`js/aio-core.js:3830-3833`). **Not independently verified against a live translation API call**
(no network access) — verified only that the described dead-end code path no longer exists.

**KST 08:00 cycle window**: `briefingWindowKST` (scoring.js:84-94) correctly anchors to the most
recently *completed* 24h window ending at 08:00 KST (rolls back a day if `now` precedes today's
08:00 cut) — logic reviewed and is correct via manual trace + the node harness
(`briefingWindow: { start: ..., end: ... }` spans exactly 24h ending at the KST 08:00 boundary
before `now`).

**Dedup**: not covered in `scoring.js` itself (dedup lives in `NewsStore.filter`/
`_aioNewsIsBlacklisted`/word-bag-key logic in `js/aio-data.js:12261-12651`, outside this file's
scope) — **not audited in depth**; flagging as **unverified** whether the word-bag dedup key
(first-15-chars-of-sorted-title-words) can collide across genuinely distinct articles or fail to
catch near-duplicate retitled wire-service pickups.

**Headline-only labeling**: confirmed correctly implemented and now cross-wired into
`scoring.js` via this diff — `verificationStatus==='headline-only'` and `contentDepth` are set
upstream in `_aioNewsVerificationStatus`/`_aioNormalizeNewsItem` (js/aio-data.js:11277-11390) and
now also gate the sentiment/risk aggregation, not just the AI-eligibility flag
(`eligibleForAi`) they originally gated. This closes the exact gap the prompt's "headline-only
claims labeling" item asks about — modulo the sample-size interaction above.

---

## 4. MACRO & FX/BOND (`src/domain/macro/{transmission,treasury-curve}.js`, `js/aio-macro-tech.js`)

### Keep-list
- `treasury-curve.js` `buildTreasuryCurveSpread`: refuses to compute 2s10s from legs observed on
  different `cutId`/dates (`explicitConflict`/`comparable` logic, lines 58-67); an "official"
  FRED-sourced spread is only trusted when its `cutId`/date matches the leg dates, else it's
  published as `mode:'official-unverified-cut'` with `spread:null` — no silent same-day
  assumption.
- `transmission.js`: explicitly modeled as an evidence-state lens, not a synthetic risk score
  (module-level comment, line 1); each transmission-chain node (`funding-supply`, `term-premium`,
  `credit-capex`, `breadth-vol`, `hedges`) is marked `observed`/`blocked` per actual input
  presence, and `MACRO_TRANSMISSION_GAPS` explicitly documents what is *not* modeled (term
  premium, issuance, dealer gamma, China credit) with a stated remediation path rather than
  silently omitting them.
- **HY OAS / FRED BAMLH0A0HYM2 redistribution concern — already flagged internally.**
  `src/data/contracts/source-registry.js:80-87`:
  `structuralLimit: { kind: 'independent-reconciliation', reason: 'No independent spread-level
  cross-check is configured.', remediation: 'Add a redistribution-approved ICE/Bloomberg/LSEG or
  equivalent source.' }`. The team has already identified that BAML/ICE-sourced FRED series carry
  redistribution restrictions and labeled this a structural limit. **[Medium — known, not yet
  remediated]**: this is a disclosure, not a fix. The app still fetches BAMLH0A0HYM2 via FRED and
  serves *derived* values (HY OAS bp, credit-stress scoring inputs) to its ~5 users; per FRED's
  own published notice for ICE BofA series, the underlying data "may not be redistributed."
  Whether serving a *derived score* (rather than the raw series) to a small private user base
  constitutes "redistribution" under ICE's terms is a legal question this audit cannot resolve —
  flagging as **unverified/needs-legal-review**, but noting the team's own source registry
  already treats it as an open structural risk, so this is not a new finding, just an
  unresolved one worth prioritizing given it's already self-identified.
  `js/aio-macro-tech.js:556-562,847-935` confirms the app correctly stopped using HYG ETF price
  as an OAS proxy (explicit comment: "HYG는... 신용스프레드(OAS) 자체가 아니다") and now sources
  the real FRED OAS series — a genuine prior-bug fix, independent of the redistribution question.
- BOK/KOSIS usage: `source-registry.js:132-134` shows `bok-ecos`/`kosis` as declared T1_OFFICIAL
  origins for KR macro data, with the same `structuralLimit` correctly scoping KRX/Koscom (not
  BOK/KOSIS) as the unresolved-rights piece — BOK ECOS and KOSIS Open API are public,
  non-restricted government statistical APIs, so no equivalent concern applies to them.
  **Not independently verified**: whether `scripts/fetch-data.mjs`'s actual BOK/KOSIS calls stay
  within each API's published rate limits (out of scope — that script is excluded from this
  read-only audit per the "never call live APIs" constraint, and static review of call sites
  was not performed here).

### Findings
No FRED unit/vintage/revision-handling defects were found in `treasury-curve.js` or
`transmission.js` themselves — both modules treat every input as an opaque `{value, observedAt,
source}` observation and refuse to compare across mismatched cuts. **Revision/vintage handling
specifically (ALFRED-style "as it was known then" vs. latest-revised value) was not verified** —
these modules take whatever `fred.dgs10` etc. object they're handed; whether the *producer*
(`scripts/fetch-data.mjs`, out of scope for read-only live-API constraint) requests
vintage-aware or always-latest-revision data from FRED was not checked. This is worth a
follow-up: for the treasury/CPI/PCE series consumed by `macro`/`briefing`, latest-revised values
are generally fine (no revision issue for constant-maturity yields), but if any BLS/BEA employment
or inflation series is pulled without `realtime_start`/`realtime_end` pinning, a later run could
silently pick up a revised historical value under the same nominal date — **unverified, flagged
for follow-up, not confirmed as a bug**.

---

## 5. OPTIONS PAGE

**[Resolved / keep-list] Options page does not overclaim.** `index.html:12645` explicitly states
scope limits to the user: "범위: 실시간 옵션 체인·Greeks·GEX·개별 종목 IV Rank는 미제공. VIX
이력 통계는 별도로 구분합니다." (real-time option chain/Greeks/GEX/single-name IV Rank not
provided; VIX historical stats are separately distinguished). This is reinforced in code:
`js/aio-core.js:5215` sets `maxSourceKind:'REFERENCE'` with an explicit caveat string for the
`options` page, and the self-audit lint rule at `js/aio-core.js:26414-26418`
(`options-ivrank-static-vix-range`) exists specifically to **block** a regression back to a
hardcoded `_vixLow52=12, _vixHigh52=82` range — confirmed that hardcoded pattern no longer
exists anywhere in `js/` (grep-verified), and the live implementation
(`js/aio-ui.js:4462-4475`) computes IV Rank from the actual received VIX sample range, gated on
`_vixWindowReady`, and labels the UI tooltip "수신 VIX 표본의 고저 범위 내 위치 · 1년 IV Rank
아님" (this is the position within the *received* sample's range, explicitly **not** a true
1-year IV Rank). This is honest, correctly caveated, and matches what data actually exists
(VIX/VVIX/PCR-derived reference signals only — no real option chain/Greeks feed integrated).

---

## Summary of severities
- **High (2):** Portfolio export omits ledger/FX-legs/assumptions with no warning (§1); News
  sentiment/risk score has no minimum-sample gate and the new uncommitted eligibility filter
  measurably increases small-sample exposure while feeding an un-caveated score into the
  trading-score composite (§3).
- **Medium (4):** KR/US market-session helpers lack a holiday calendar (§2); Naver/KRX scraping
  legality is self-documented as an open structural limit but not remediated (§2, §4 for the
  parallel KRX-breadth case); HY OAS (BAMLH0A0HYM2) redistribution-rights question is
  self-flagged but unresolved (§4); the new 40-char news-eligibility threshold's real-world
  effect on sample size is unverified against live feed data (§3).
- **Low (2):** import doesn't type/length-cap all portfolio fields (mitigated by render-time
  escaping, §1); dead/ineffective `.KS`-only fallback symbol guess in KR market-cap enrichment
  (§2).
- **Resolved, listed for confirmation only:** VKOSPI static-chart bug (§2), "[번역 대기]" stuck
  translation (§3), HYG-as-OAS-proxy (§4), options-page IV Rank static-range regression guard
  (§5) — all verified fixed in current code, kept in this report because the prompt named them
  explicitly as prior findings to check.

## "How I would build it" vs current / migration notes
- Portfolio: the domain-layer contracts (fx.js/surface.js/risk.js/backtest.js) are close to how
  I would design this from scratch — explicit refusal states over inferred defaults, immutable
  content-hashed snapshots, and a single declaration-store shape for Vault-backed lists. The one
  structural gap is export/import scope: I would define one `PortfolioBackupEnvelopeV1` schema
  covering positions+ledger+fxLegs+assumptions+schemaVersion, with `exportPortfolio` serializing
  it and `importPortfolio` doing a schema-versioned restore (reusing `createMigrationRegistry`
  from `storage/migrations.js`, which already exists but isn't applied to this JSON-file import
  path — only to the internal repository read path).
- News: I would give `computeNewsSentimentScore`/`computeNewsRiskSignals` the same
  "certification" shape `deriveVarStability` already uses elsewhere in this codebase — a
  declared `minSampleN`, and a `status:'held'` result with a reason when the eligible sample is
  below it, instead of a bare `score`. Migration: land the current isNewsAnalysisEligible diff
  together with a `total`-aware gate in the same commit, and change
  `js/aio-core.js:23680` to consume `{score, total}` rather than `.score` alone.
- KR sessions: add a small static KRX/US holiday-date table (annually maintained, similar cost to
  the existing DST calculation in `_getUsSession`) consulted by both `_getKrxSession` and
  `_getUsSession` before returning `'open'`.
