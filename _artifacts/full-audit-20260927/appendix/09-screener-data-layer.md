# AIO Screener + Data Layer Audit (2026-09-27)

Scope: screener pipeline (producer → domain → UI) and data layer (evidence/contracts/providers/orchestrators),
plus SEC fundamentals. Read-only static analysis; no scripts executed, no live fetches performed. All line
numbers are as of the working tree at audit time.

Already covered by a prior audit (not repeated here): factor weight vectors differ (factor-ranks.js
DEFAULT_WEIGHTS vs fetch-data.mjs COMP_W), fixed 873 universe survivorship, pit-validation.js has no caller,
RRG/Weinstein/Minervini naming, trading score negative IC.

---

## 1. Data-flow map (as-observed, not as-documented)

```
PRODUCER (GitHub Actions, node, no browser)
  scripts/fetch-data.mjs ─┬─> public-data/data.json            (macro/news/quotes/meta)
                          ├─> public-data/screener.json          (factor artifact, COMP_W/kalman)
                          ├─> public-data/screener-universe.json (static 873-symbol universe)
                          ├─> public-data/market-snapshot.json   (durable quote snapshot)
                          └─> public-data/reconciliation-status.json
  scripts/fetch-sec-fundamentals.mjs -> public-data/sec-fundamentals.json (independent cadence, 28-day refresh)
  scripts/validate-screener-artifact.mjs -> CI gate on screener.json only (not universe/sec-fundamentals)

BROWSER — TWO PARALLEL, NON-COMMUNICATING RUNTIMES
  (A) Legacy imperative runtime (js/aio-data.js, js/aio-core.js, js/aio-ui.js)
      _aioLoadServerData() --fetch--> data.json --applyLiveQuotes--> PriceStore.set()
         --> window._liveData[sym], window._dataSource[sym], window.DATA_SNAPSHOT
      fetchLiveQuotes() --browser fetch--> Yahoo / CoinGecko (+CF-Worker proxy fallback) /
         open.er-api.com+fallback FX APIs / Naver (KR indices) --> same PriceStore.set() sink
      No import of src/data/contracts/evidence.js anywhere in js/*.js (grep: 0 hits).

  (B) "Native" typed runtime (src/app/bootstrap.js -> createAIOArchitecture)
      createMarketSnapshotLoader() --fetch--> fast-plane KV (if AIO_PUBLIC_CONFIG.marketData.fastQuotes
         enabled) else public-data/market-snapshot.json --> createEvidence() --> evidenceStore (Map)
         --> consumed ONLY by the AI answer/evidence retriever (createEvidenceRetriever), never
         merged into window._liveData and never read by runtime-readers.js.
      createScreenerProvider() / createRuntimeReaders() both read live overlay via
         `readLiveData: () => root._liveData` -- i.e. they read runtime (A)'s output, not (B)'s.

  SCREENER SPECIFIC
      src/data/providers/screener.js: fetch screener.json + screener-universe.json +
        model-validation-status.json (Promise.all, 3 independent files) -> per-row liveEnrichment()
        reads root._liveData[sym] -> merged with factor artifact via useLivePrice/useArtifactPrice
        gate -> src/data/normalize/screener.js whitelist -> src/data/orchestrators/screener.js
        (runs computeFactorRanks + runScreen) -> src/ui/pages/screener.js render.
      Legacy compatibility: src/legacy/compatibility-facade.js readScreener() ->
        src/data/screener-row-policy.js resolveScreenerRows() -> root.AIO_ARCH.getScreenerRows()
        (same native store) with a documented pre-publication-only fallback to legacy SCREENER_DB.
```

### NVDA trace (US large-cap, representative)
1. Nightly: fetch-data.mjs pulls 1y daily closes for NVDA from its price source, computes
   ret1m/3m/6m, RSI14 (Wilder's, matches aio-core's `_calcRSILast`), pctSma50/200, Kalman
   velocity/confidence, rvol20 — all price-derived; writes factor row to screener.json with
   `observedAt`/`factorObservedAt` (bar-start semantics, UTC-derived from the price feed's session,
   not KST/ET wall-clock — see `factorTimeBasis`/`factorSessionDate` fields threaded through
   normalize/screener.js:100-108).
2. fetch-sec-fundamentals.mjs (independent 28-day cadence) pulls NVDA's SEC EDGAR companyfacts,
   picks latest 10-K FY revenue/net-income/equity/shares, computes `pe`/`pb`/`roe`/`margin`/
   `revGrowth` from that single annual filing (fetch-sec-fundamentals.mjs:356-360) — not a
   TTM series built from 10-Qs.
3. Browser loads screener.json+universe+model-validation (providers/screener.js). It looks up
   `root._liveData.NVDA` for an intraday price/mcap override. Because of Finding 1 below, this
   override structurally never satisfies `liveEvidenceEligible`, so the row's displayed price is
   always the nightly artifact price (`factor.price`), not an intraday quote, regardless of how
   `fetchLiveQuotes()` scores NVDA's freshness.
4. normalizeScreener() whitelists ~90 fields (screen and hidden lineage fields) into a row object.
5. computeFactorRanks() cross-sectionally z-scores NVDA against sector peers (sector-relative with
   universe-shrinkage for buckets <6), composites momentum/trend/lowvol/size/(value/quality if
   fresh)/kalman with `factor-weights.js NEUTRAL` weights (see Finding 6), produces a 0–100
   tie-aware midrank `rank` (not a percentile of returns) and a separate 0–100 "sector-normalized
   z-to-100" `factorScores.*` (explicitly documented as two different scales, factor-ranks.js:155–159).
6. runScreen() applies the active preset's filtersAST/hardGates with 3-valued logic
   (pass/fail/unknown) and computes `screenRank`/`screenStatus` independently of `rank`.
7. UI (src/ui/pages/screener.js) renders `rank`/`factorScores`/`screenStatus`; KR tickers get the
   same pipeline with `market='KR'` inferred from `.KS`/`.KQ` suffix (providers/screener.js:294),
   currency-gated by `evaluateQuoteContract` so a KRW quote cannot silently become a USD price.

---

## 2. Findings

### [Critical] F1 — The screener's "use live price if fresher" logic can never fire; every row silently uses last night's batch price
**Root cause / evidence:**
- `src/data/providers/screener.js:132-181` (`liveEnrichment`) and `:315-323` require, to accept a
  live quote over the artifact price: `priceAllowedUseCeiling === 'decision'`,
  `isValidRightsId(priceRightsId)`, and `priceEnvelopeComplete` (which itself requires a truthy
  `allowedUseCeiling`, `revisionId`, `quality`, etc.).
- `js/aio-data.js:14782-14798` (`applyLiveQuotes`) computes and threads exactly these fields
  (`allowedUseCeiling`, `rightsId`, `revisionId`, `quality`, `qualityStatus`) into
  `PriceStore.set(sym, price, pct, source, opts)`.
- `js/aio-core.js:19310-19417` (`PriceStore.set`) **never copies `opts.allowedUseCeiling` or
  `opts.rightsId`** into `window._liveData[sym]`, `this._data[sym]`, or `window._dataSource[sym]`
  (compare the field list written at 19364-19412 against the opts read in `applyLiveQuotes`).
- `src/data/contracts/evidence.js:72-75` (`isValidRightsId`) treats `null`/`''` as invalid, and
  `providers/screener.js` has no `quoteEnvelope` fallback that would supply these fields any other
  way (`hasEnvelope` is false because `window._liveData[sym].quoteEnvelope` is never set anywhere
  in js/*.js — grep confirms zero writers of `.quoteEnvelope`).
- Net effect: `live.priceAllowedUseCeiling` and `live.priceRightsId` are structurally `null` for
  every symbol from every quote source (Yahoo, CoinGecko, FX, Naver) that flows through
  `PriceStore.set`. `liveEvidenceEligible` in providers/screener.js:315-321 is therefore always
  `false`, `useLivePrice` is always `false`, and every screener row's price/mcap is always the
  nightly artifact value (`useArtifactPrice` branch), even mid-session on a day when the browser
  has a perfectly good live NVDA quote.
- This is a regression relative to the code's own intent: `livePriceRejectedReason` (row field,
  providers/screener.js:378) is designed to report exactly this and would read
  `'decision-evidence-ineligible'` for 100% of rows if inspected — a directly falsifiable, cheap
  browser check (`row.livePriceRejectedReason` on any live screener row) would confirm this without
  running any producer script.
**Impact:** the "live price overlay" is dead weight — extra fetches, extra code paths, extra
per-row diagnostic fields — that can never change what the user sees. Screener price/valuation
fields (mcap, and anything gated the same way) are always as stale as the last GitHub Actions run
(30 min cron per memory notes), not as fresh as the browser's own quote fetch.
**Fix:** either (a) have `PriceStore.set` persist the full opts bag (`allowedUseCeiling`, `rightsId`,
`revisionId` at minimum) into `window._liveData[sym]`, or (b) have `applyLiveQuotes` attach a real
`quoteEnvelope` object to each entry so `liveEnrichment`'s `hasEnvelope` branch is used. Either way,
add a unit test asserting `providers/screener.js` can produce `useLivePrice === true` for a
synthetic fresh, fully-labeled `_liveData` row (this test would have caught the regression).

### [High] F2 — No single canonical evidence envelope; at least three independently-typed "evidence" shapes coexist with no converter between them
**Root cause / evidence:**
1. `src/data/contracts/evidence.js` — `createEvidence`/`validateEvidence`/`evaluateEvidence`.
   7-value `EVIDENCE_STATUS`, 3-value `EVIDENCE_ALLOWED_USE` (`decision|reference|none`). Used by
   ~15 files (grep): bootstrap.js, ai/*, data/selectors/evidence.js, data/quality/freshness.js,
   data/evidence-store.js, domain/knowledge/evidence.js, domain/fundamental/sec-report.js,
   data/orchestrators/sentiment.js, ui/pages/atlas.js, ui/pages/principles.js.
2. `src/data/contracts/screener.js` — a **separate, independently designed** contract:
   `createObservationEnvelope`/`validateObservationEnvelope` (screener.js:268-298), 9-value
   `FIELD_STATUS` (`CURRENT|DELAYED|STALE|MISSING|UNSUPPORTED|BLOCKED_RIGHTS|CONFLICT|INFERRED|
   LAST_GOOD`), and a free-text `allowedUse` (e.g. `'research-relative-ranking-only'`,
   `'reference-only'`) that is not a member of `EVIDENCE_ALLOWED_USE` at all. `ObservationEnvelope`/
   `observationId` never appears outside `contracts/screener.js` and
   `domain/screener/provider-capability.js` (grep) — no function anywhere converts one shape into
   the other.
3. Legacy ad hoc lineage: `js/aio-data.js`/`js/aio-core.js` build plain objects with
   `sourceKind`/`allowedUse`/`qualityStatus` string fields (e.g. fetchLiveQuotes literals at
   js/aio-data.js:13405,13501: `sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-only'`)
   that are never passed through `createEvidence`/`validateEvidence` — no validation, no shared
   enum membership check, and (per F1) some of the same fields are dropped downstream anyway.
4. A fourth micro-shape: `src/legacy/compatibility-facade.js:267-282` (`runtimeEvidence`) hand-builds
   an object with the *same field names* as `contracts/evidence.js`'s `Evidence` (`evidenceId`,
   `status`, `allowedUse`) for trading-score inputs, but constructs it directly instead of calling
   `createEvidence`, so it never runs through `validateEvidence`'s decision-quality/freshness-SLA
   checks — it *looks* like canonical evidence to any consumer that duck-types it, but carries none
   of the contract's guarantees.
**Impact:** "is there one canonical evidence envelope actually enforced end-to-end" — no. A
consumer that trusts a screener field's `allowedUse: 'research-relative-ranking-only'` string as
equivalent to the general contract's `'reference'` will silently mis-handle it (they are different
enums with different validators), and nothing in the type system or CI catches a producer that
emits the wrong shape for the wrong consumer.
**Fix:** pick contracts/evidence.js's `Evidence` as the one shape; have
`createObservationEnvelope`/`buildFieldReadiness` construct/wrap an `Evidence` internally (map
`FIELD_STATUS` → `EVIDENCE_STATUS`, `allowedUse` free text → `EVIDENCE_ALLOWED_USE` at the single
point fields are declared, not at every consumer); delete `runtimeEvidence`'s hand construction in
favor of `createEvidence`.

### [High] F3 — The "fast data-plane KV" / native evidence store is wired but inert for anything the user actually sees; screener/sentiment/market/portfolio all read the legacy quote sink instead
**Root cause / evidence:**
- `src/app/bootstrap.js:343-347,741-744`: `createMarketSnapshotLoader` (src/data/market-snapshot-loader.js)
  fetches the fast-plane KV (if `AIO_PUBLIC_CONFIG.marketData.fastQuotes.enabled`) or
  `public-data/market-snapshot.json`, and its result is ingested via `ingestSnapshotEvidence` into a
  **separate** `evidenceStore`/`snapshotEvidence` Map (bootstrap.js:349,361-394) exposed only as
  `AIO_ARCH.getMarketSnapshot()`/consumed by `createEvidenceRetriever` (AI chat path).
- `src/data/runtime-readers.js:509,513,561` (readSentiment/readMarket) and
  `src/data/providers/screener.js` (via `readLiveData: () => root._liveData`, bootstrap.js:415,466,533)
  all read `root._liveData` — the object populated exclusively by the legacy
  `js/aio-data.js`/`PriceStore` pipeline (browser Yahoo/CoinGecko/FX/Naver fetches +
  `data.json` quote overlay).
- No code path copies `marketSnapshot`/`snapshotEvidence` into `window._liveData`, and no code path
  feeds `window._liveData` into `evidenceStore`. The two quote sinks are permanently disjoint.
**Impact:** the durable/fast-plane snapshot architecture described in project memory
(`reference_data_backend.md`, "74심볼+F&G 자율, CORS프록시 의존 탈피") only feeds the AI answer
retriever's evidence store; the screener, market page, sentiment page and portfolio-facing
`_liveData` consumers never see it and remain dependent on browser-side CORS-fragile fetches
(Yahoo/CoinGecko direct + CF Worker proxy fallback, `js/aio-data.js:13372-13390`) for anything
beyond the once-per-cron `data.json`. This directly contradicts the intended migration ("탈피") for
every surface except AI chat answers.
**Fix:** either merge `ingestSnapshotEvidence`'s quotes into `window._liveData` (bridging point:
right after `snapshotLoader.load()` resolves in bootstrap.js:741-744), or migrate
`runtime-readers.js`/`providers/screener.js` to read the native `evidenceStore` instead of
`root._liveData`. Doing both independently (current state) guarantees drift.

### [Medium] F4 — Five domain/screener modules are fully built, documented and self-consistent, but have zero runtime callers — same defect class as the already-flagged pit-validation.js, confirmed independently in four more modules
**Root cause / evidence (grep-verified, no importer in `src/` outside the file itself):**
- `src/domain/screener/refresh-planner.js` (`createRefreshPlanner`) — imported only by
  `scripts/ci-screener-workbench-contract.mjs` and old `_artifacts/*/probes.mjs`.
- `src/domain/screener/return-contract.js` (`createReturnObservation`, `assertComparableReturns`,
  `convertReturnToBaseCurrency`, `economicReturnWithSplit`, `holdingReturn`) — imported only by the
  same CI contract-shape script; `factor-ranks.js` only echoes its *vocabulary* in a comment/string
  literal (`adjustedCloseStatus`, "mixed-adjustment-scope-in-one-comparison") without calling any of
  its functions. The actual `ret1m/ret3m/ret6m` numbers in fetch-data.mjs (`_retPct`, line ~1994) are
  computed as plain price ratios with no currency/adjustment/FX declaration ever validated against
  this contract.
- `src/domain/screener/regime.js` (`deriveRegimeState`, hysteresis RISK_ON/NEUTRAL/RISK_OFF/
  LOW_CONFIDENCE state machine) — zero importers outside itself. The regime label actually used by
  the orchestrator (`bootstrap.js:472-478`) comes from a **different, simpler** implementation in
  `factor-weights.js` (`deriveFactorWeights`), which has no hysteresis and no `LOW_CONFIDENCE` state.
  Two conceptually competing "regime" models exist; only the simpler one is live.
- `src/domain/screener/provider-capability.js` (`DEFAULT_SCREENER_CAPABILITY_CATALOG`,
  `selectProviderForField`, `reconcileFieldObservations`) — zero importers outside itself. The actual
  provider precedence used at runtime is the ad hoc `useLivePrice`/`useArtifactPrice` boolean in
  `providers/screener.js`, not this catalog's declared `fallbackProviderIds`/tiering.
**Impact:** these modules read as strong architecture (typed contracts, hysteresis, reconciliation
policy) in a code review or grep-based audit, but none of their guarantees apply to the shipped
product — reviewing them without checking callers overstates the system's actual rigor. This is a
systemic pattern (5 confirmed instances including the previously-flagged pit-validation.js), not an
isolated oversight.
**Fix:** either wire each module into its obvious call site (regime.js into the orchestrator instead
of factor-weights.js, or vice versa — pick one; provider-capability.js into providers/screener.js's
price-selection branch; refresh-planner.js into whatever throttles producer refresh scheduling;
return-contract.js's `assertComparableReturns` into factor-ranks.js's momentum/value factor
construction) or delete them. A CI rule that fails when a `src/domain/**` export has zero importers
under `src/` (excluding its own file and `scripts/ci-*`) would prevent recurrence.

### [Medium] F5 — SEC-derived P/E and P/B use last-fiscal-year net income/equity, not TTM, and the "current" quality gate tolerates data up to ~18 months old; this nuance never reaches the row-level UI label
**Root cause / evidence:**
- `scripts/fetch-sec-fundamentals.mjs:266,356-360`: `incomes = annualDurationRows(..., ['NetIncomeLoss','ProfitLoss'])`
  filtered to `row.fp === 'FY'` and 300–400 day durations only — strictly the latest annual filing,
  never a sum of trailing quarters. `record.pe = marketCap / netIncome` uses **today's/hinted price**
  against that annual net income.
- `REPORT_RECENCY_MAX_DAYS = 550` (line 121) — a fiscal year is still labelled `reportRecency:
  'recent-fy'` and `qualityStatus: 'CURRENT'` up to 550 days (~18 months) after fiscal year end,
  provided the filing's own acceptance timestamp exists (`revenueAcceptedAt`).
- Shares outstanding source (`dei:EntityCommonStockSharesOutstanding`, instantRows filtered to
  10-K/20-F/40-F only, line 202-203,276-278) is the 10-K cover-page count as of the filing date, not
  the fiscal-year-end date used for revenue/net income — a second, smaller basis mismatch compounding
  the P/E's staleness.
- This limitation **is** disclosed at the artifact level (`allowedUse: 'research/reference;
  normalized annual filing facts, not analyst estimates or live TTM'`, line 524), so producer-side
  intent is honest. It is **not** disclosed at the row/UI level:
  `src/ui/pages/screener.js:25` labels the value column simply `'밸류'` / `'저PER/PBR/EV-EBITDA'`
  with no "FY-basis, not TTM" caveat visible to the end user comparing PER across rows with different
  fiscal-year-end dates (calendar vs non-calendar FY companies are directly non-comparable this way).
**Impact:** Low correctness risk (methodology is defensible and disclosed in the JSON), Medium UX/
comparability risk: two rows in the same screen can show "PER" computed from fiscal years up to 18
months apart in vintage, with no visual distinction, which is exactly the kind of silent
apples-to-oranges comparison the codebase's own `return-contract.js` (F4) was built to prevent for
returns but was never extended to valuation multiples.
**Fix:** surface `reportRecency`/`fiscalPeriodEnd` age as a per-row badge or tooltip next to PER/PBR
(the data already exists in `sec-fundamentals.json`; `_fundamentalPeriodEnd`/`_fundamentalObservedAt`
already flow through `normalize/screener.js:80-82` — this is a UI wiring gap, not a data gap).

### [Low] F6 — Three (not two) distinct "default" factor-weight vectors exist; the one actually live in production matches neither of the two previously compared
**Root cause / evidence:** the prior audit compared `factor-ranks.js DEFAULT_WEIGHTS` (momentum
0.32/trend 0.23/lowvol 0.18/size 0.18/kalman 0.09) against `fetch-data.mjs COMP_W`. Tracing the
actual browser call path (`bootstrap.js:472-478` → `deriveFactorWeights` →
`src/domain/screener/factor-weights.js:6`) shows the weights object passed into
`computeFactorRanks` for the non-explicit-profile (default) case is always `NEUTRAL = {momentum:
0.27, trend: 0.20, lowvol: 0.16, size: 0.08, value: 0.10, quality: 0.09, kalman: 0.10}` — a third
vector — because `adaptiveApplied` in `deriveFactorWeights` is hard-coded to require a `promotion`
record with `status === 'PROMOTED'` that "the current repository intentionally has no such promoted
record" of (factor-weights.js:78-81). `factor-ranks.js`'s own `DEFAULT_WEIGHTS` is therefore dead
in the wired production path — it only fires for direct/test callers of `computeFactorRanks` that
pass `weights: null`.
**Impact:** low (this doesn't change correctness, just clarifies which of the already-flagged
mismatched vectors is the one real users' rankings are computed with). Worth folding into whatever
remediation addresses the previously-flagged weight-vector drift.

### [Low] F7 — KR quote conflict resolution and identity/rights-review labels are heuristic string matching, not structural
**Root cause / evidence:** `js/aio-data.js:14768-14779` resolves Naver-vs-Yahoo KR index conflicts
by a hardcoded 0.75% diff threshold and a "Naver wins once it's spoken" sticky rule — reasonable in
intent, but it lives entirely in the legacy file with no test coverage found (`ci-*` scripts grep
found none referencing `_aioKrQuoteConflicts`). `providers/screener.js:85-116`
(`isOfficialFilingSource`) grants `rights: 'VERIFIED'` based on a regex over the source string
(`/sec\s+edgar|dart|official/i`) rather than a structural provider-id match — a source string typo
or a new provider named e.g. "Official Newswire" would be silently misclassified as filing-grade.
**Impact:** low probability, but a silent rights-misclassification is exactly the failure mode the
rest of the evidence system is designed to prevent structurally elsewhere.

---

## 3. Keep-list (deliberately well-built, do not disturb while fixing the above)

- `src/data/contracts/evidence.js` — the `createEvidence`/`validateEvidence`/`evaluateEvidence`
  fail-closed design (freshness never promotes allowedUse; `restrictAllowedUse` takes the minimum of
  the chain) is exactly the right primitive. Should become the *only* one (see F2).
- `src/domain/screener/factor-ranks.js` — careful three-tier coverage gating (cross-section 80%,
  row-level 80% weighted coverage, sector min-6-with-shrinkage), MAD-triggered winsorization with
  diagnostics, explicit z-score-vs-percentile scale separation (factor-ranks.js:155-159), tie-aware
  midrank. This is genuinely good quant engineering.
- `src/domain/screener/screen-engine.js` — 3-valued (pass/fail/unknown) filter logic, explicit
  separation of filter admission from ranking eligibility (`screenFilterState` vs
  `screenRankingState`), content-addressed `calculationInputId`/`resultHash` for replay
  verification (`replayScreenRun`).
- `scripts/fetch-sec-fundamentals.mjs` — `classifyIssuerCapability` correctly excludes IFRS-only
  filers and foreign issuers without US-GAAP taxonomy from ever occupying a retry slot; PIT
  (`acceptedAt`/`filedAt`) tracking via `pitAvailability`/`buildPointInTimeFacts` is a genuinely
  rigorous point-in-time discipline, rare in a project this size.
- `src/data/artifact-cache.js` — correct in-flight de-duplication, abort propagation, integrity
  (SHA-256) and byte-budget enforcement for artifact fetches.

---

## 4. How I would build this vs. current, and migration steps

**Target design:**
1. One evidence schema (`contracts/evidence.js`'s `Evidence`) used everywhere a value needs
   source/freshness/rights metadata — screener field readiness, quote overlays, macro data, AI
   retrieval. `FIELD_STATUS` becomes a screener-specific *display* refinement computed **from** an
   `Evidence.status` + a field-level freshness budget, not a parallel status enum.
2. One quote sink (`window._liveData` or its native replacement) fed by exactly one ingestion
   function per source (Yahoo/CoinGecko/FX/Naver/fast-plane-KV/durable-snapshot), each producing a
   real `Evidence` via `createEvidence`, with `PriceStore.set`/its replacement persisting the
   *entire* evidence object rather than a hand-picked field subset (F1's root cause was exactly a
   partial field copy).
3. A schema registry (could literally be `SCREENER_FIELD_REGISTRY` generalized) shared by
   producer (fetch-data.mjs) and consumer (providers/screener.js, factor-ranks.js) so a field
   rename/add on one side fails CI immediately instead of silently producing `MISSING`/`null`.
4. A "no orphan module" CI rule (F4) so a `src/domain/**` or `src/data/**` export with zero
   importers under `src/` fails the same way an unused-export linter would, forcing every future
   "let's build it properly" module to either get wired in the same PR or be explicitly marked
   experimental/deferred.

**Migration steps (incremental, lowest-risk first):**
1. Fix F1 first — it's a one-file, mechanical change (`PriceStore.set` persists the full opts bag)
   with no architecture decision required, and it's the highest-impact bug (screener prices are
   silently always stale-by-one-cron-cycle).
2. Add the CI "no orphan module" check (F4) before deciding what to do with the five orphaned
   modules — this forces an explicit decision (wire vs. delete) per module rather than leaving them
   to rot further.
3. Pick regime.js OR factor-weights.js as canonical (F4); delete the other; same for
   provider-capability.js vs. the ad hoc price-selection logic in providers/screener.js.
4. Converge F2's three evidence shapes by adding a thin `observationEnvelopeFromEvidence`/
   `evidenceFromObservationEnvelope` pair first (non-breaking), then migrate `buildFieldReadiness` to
   build real `Evidence` objects internally, then delete the parallel `FIELD_STATUS`/`allowedUse`
   string enum once all consumers read `Evidence.status`/`Evidence.allowedUse`.
5. Only after 1–4 are stable, decide whether to merge the native `evidenceStore`/marketSnapshot (F3)
   into `window._liveData` or migrate `runtime-readers.js`/`providers/screener.js` onto the native
   store — doing this before F1/F2 are fixed would just create a fourth quote sink to reconcile.
6. Surface F5's fiscal-vintage disclosure in the UI as a small, additive change (badge/tooltip) —
   independent of the above, safe to do anytime.

---

## Unverified / not checked in this pass

- Whether `fetch-data.mjs`'s COMP_W (previously flagged) or `factor-weights.js`'s `NEUTRAL` (F6) is
  actually the one baked into the *published* `screener.json`'s own display fields (`quantSignal`
  etc. computed server-side) vs. the browser's `computeFactorRanks` recomputation — I traced the
  browser path only; did not re-derive the producer's own COMP_W-driven ranking output field-by-field.
- Whether the fast-plane KV (F3) is actually enabled in the current `AIO_PUBLIC_CONFIG` (I read the
  gating code, not a live/observed config value — reading `public-config.json` would confirm but
  that's runtime state, not something to assert from source alone).
- `js/aio-ui.js` (7645 lines) was not read in full; only cross-referenced via grep for
  `_aioLoadServerData`/`applyLiveQuotes`/`fetchLiveQuotes` call sites (none found — those are
  aio-data.js/aio-core.js only). Screener column sort/tie-break rendering in `src/ui/pages/screener.js`
  was read only around the label/legend section (~line 25); the full sort/filter DOM interaction code
  (1775 lines) was not exhaustively traced for UI-level drift from `screen-engine.js`'s tie/eligibility
  semantics.
- KST vs UTC timestamp handling: confirmed the producer threads explicit `factorSessionTimezone`/
  `factorTimeBasis` fields end-to-end (normalize/screener.js:105-106) rather than assuming a zone,
  but did not verify what value fetch-data.mjs actually writes into those fields for KR-market rows
  (i.e., whether it's genuinely KST-labeled or defaults to a US-session assumption for `.KS`/`.KQ`
  symbols) — would require reading fetch-data.mjs's KR-specific session-date derivation, not reached
  in this pass.
