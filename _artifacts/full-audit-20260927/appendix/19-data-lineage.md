# AIO Screener — Data Lineage Map (PARTIAL / IN PROGRESS)

Status: This document was force-terminated mid-research. Sections 1-2 below are
directly verified (workflow files read in full, public-data JSON read on disk,
scripts/ci-data-lineage-audit.mjs read in full — it is a pre-existing lineage/
freshness registry already built into the repo). Sections 3-5 (browser live
fetches, edge worker detail, hardcoded constants, per-route consumer mapping)
were delegated to three background research agents that had NOT returned
results when this run was cut off. Their raw findings are not included here —
do not fabricate them. Re-run those three research passes to complete this
document; do not hand-wave the missing sections as "low risk."

## 1. Server pipeline — three workflows, ground-truthed from
   .github/workflows/{refresh-data,refresh-screener,data-watchdog}.yml

### refresh-data.yml
- Schedule: `17,47 * * * *` (every 30 min, offset from :00) + daily `13 7 * * *` (adds the 13F/masters lane) + workflow_dispatch.
- Steps in order: `fetch-data.mjs` (main market/macro/news fetch) → `ci-data-refresh-audit.mjs --write-snapshot-diagnostic` (always, captures redacted diagnostics on failure) → `fetch-telegram-digest.mjs --days=14 --out=public-data/telegram-digest.json` (independent lane, runs even if fetch-data failed, per P1085 comment) → 13F/masters lane (only on daily cron or manual dispatch): `collect-13f-discovery.mjs` → `collect-13f-reference.mjs` → `collect-13f-history-index.mjs` → `collect-13f-history-rows.mjs` → `build-13f-issuer-aggregates.mjs` → `build-masters-runtime-artifacts.mjs` → `build-13f-reference-ticker-index.mjs` → `ci-13f-currentness-check.mjs` → `ci-masters-contract-check.mjs` → `sync-data-release-manifests.mjs` → `ci-refresh-artifact-integrity-check.mjs` → `ci-data-continuity-check.mjs` → reconciliation gate (`ci-reconciliation-contract-check.mjs`, `ci-source-registry-contract-check.mjs`, `ci-professional-data-gap-check.mjs`, `ci-static-data-contract-check.mjs`, `ci-web-research-contract-check.mjs`, `ci-data-refresh-audit.mjs`, `verify-refresh-candidate.mjs --record`) → fail-closed promotion gate (`verify-refresh-candidate.mjs --expect`) → commit (only if ALL prior gate steps succeeded — this is enforced by an explicit `if:` condition after a documented 2026-09-20 incident, P1160, where the bot pushed despite failed gates) → dispatch CI on exact SHA → `ensure-live-convergence.mjs` waits for Pages to deploy that SHA.
- Secrets/env used: `FRED_API_KEY`, `ANTHROPIC_API_KEY` (for LLM market analysis), `TWELVE_DATA_API_KEY` (quote fallback), `SEC_USER_AGENT` (13F lane).
- Commits (if changed): data.json, history.json, market-snapshot.json, market-snapshot-status.json, operations-status.json, public-config.json, reconciliation-status.json, screener.json, telegram-digest.json, atlas/index.json, backtest-history.json, score-backtest-history.json, structural-data-research.json, masters/* (filing-discovery, filings, manager-catalog, index, holdings, holdings-summary, history-index, history-holdings, issuer-aggregates, ticker-index-reference, managers/, objects/masters, history/managers), architecture/{asset-manifest,release-manifest,public-readiness}.json.

### refresh-screener.yml
- Schedule: `41 */6 * * *` (every 6h, offset to avoid colliding with data-watchdog's `:23` and refresh-data's `:17/:47`) + workflow_dispatch.
- Guards on `SEC_USER_AGENT` being a real contact address before running (fails closed rather than silently collecting nothing).
- Steps: `fetch-sec-fundamentals.mjs` (SEC_BATCH_LIMIT=24) → `fetch-earnings-calendar.mjs` (Finnhub free tier; warns but doesn't fail if `FINNHUB_API_KEY` missing, keeps previous file) → `build-sec-runtime-projection.mjs` + check → `fetch-data.mjs` run with `SCREENER_ONLY=1 SCREENER_ENRICH=1` (same script as refresh-data.yml, different mode — screener-only path) → `validate-screener-artifact.mjs public-data/screener.json` → `ci-screener-workbench-contract.mjs` + `ci-page-data-timeline-contract-check.mjs` → `build-reconciliation-status.mjs` + `build-operations-status.mjs` + reconciliation/source-registry/professional-gap/static-data/operations-status checks → `verify-refresh-candidate.mjs --record` → fail-closed gate → commit (screener.json, sec-fundamentals.json, sec-fundamentals-summary.json + manifest, screener-validation-gate.json, reconciliation-status.json, operations-status.json, history.json, public-config.json, architecture/public-readiness.json, conditionally earnings-calendar.json and backtest-history.json) → dispatch CI → `ensure-live-convergence.mjs`.
- Note: `fetch-data.mjs` is a SHARED script between refresh-data.yml (full mode) and refresh-screener.yml (`SCREENER_ONLY=1` mode) — same collector, two different trigger schedules/purposes. Any lineage table must treat it as one producer with two invocation modes, not two producers.

### data-watchdog.yml
- Schedule: `23 * * * *` (hourly) + workflow_dispatch (configurable `max_age_minutes`, default 360).
- `permissions: contents: read` — **this workflow never writes to public-data/**. It is monitoring-only: runs `qa-runner.mjs watchdog --no-cache --jobs 2` (checks "every local and external plane" per its own comment — local artifacts, Pages, proxy, fast plane, live invariants), `report-qa-failures.mjs` on failure, and uploads a rolling `operations-slo-window.json` as a **workflow artifact** (not a public-data file — don't confuse with `public-data/operations-slo-window.json`, which is a different thing built by `build-operations-slo-window.mjs` elsewhere). Fails the job (exit 1) if any gate is red, purely for alerting.

## 2. Existing freshness/lineage registry already in the codebase

**scripts/ci-data-lineage-audit.mjs already exists and is essentially a
machine-readable version of the freshness half of this task.** It defines a
`POLICIES` table (name -> {kind, timestamp field path(s) or custom extractor,
maxAgeHours}) for every top-level public-data/*.json artifact, plus a
`NESTED_POLICIES` table for public-data/{knowledge,atlas,principles,masters}/*
top-level members (severity WARN-only, since those are unbounded families).
This script should be treated as authoritative ground truth for the freshness
column of the final lineage table rather than re-derived from scratch. Key
policies (name: kind, maxAgeHours):

- data.json: live-core, maxAgeHours=12 (FAIL if breached)
- market-snapshot.json: live-core, maxAgeHours=24
- market-snapshot-status.json: operational-status, maxAgeHours=24
- telegram-digest.json: reference-digest, maxAgeHours=12
- screener.json: research-screener, maxAgeHours=48 (timestamp: asOf)
- sec-fundamentals.json / summary / manifest: incremental-official-reference / bounded-runtime-projection, maxAgeHours=48; sec-fundamentals.json additionally gated at 80% coverage (stored/eligible)
- earnings-calendar.json: weekly-calendar-reference, maxAgeHours=192 (8d), custom window-open/closed check (weekStart/weekEnd)
- history.json: daily-history, maxAgeHours=72, custom last-row-date extractor
- backtest-history.json: research-history, maxAgeHours=336 (14d), custom last-row asOf
- score-backtest-history.json: research-history, maxAgeHours=336
- factor-backtest-longrun.json / score-backtest-longrun.json: research-horizon, NO maxAgeHours (unbounded — these are historical backtests, not live data)
- screener-universe.json: universe-reference, custom staleAfterDays (default 7, read from its own meta.staleAfterDays)
- screener-validation-gate.json: research-validation-gate, maxAgeHours=2160 (90d)
- operator-note.json: editorial-reference, maxAgeHours=720 (30d) — **manually maintained, not producer-refreshed**
- operations-status.json / reconciliation-status.json / operations-slo-window.json: operational-status, maxAgeHours=24
- telegram-reference-window.json / user-research-digest.json / model-validation-status.json / structural-data-research.json: research-reference, maxAgeHours=2160 or 336 (see script)

Run policy: `node scripts/ci-data-lineage-audit.mjs [--json]` (read-only; safe to
run — it only reads public-data/*.json and `git log`, never fetches). **This
was NOT executed in this session** (out of caution re: "never run ... anything
that writes or calls live APIs" — though this script appears to be pure-read;
a follow-up session could safely run it to get the live PASS/WARN/FAIL table
rather than hand-deriving ages).

## 3. Directly observed current staleness (read from disk, 2026-09-27 ~this session)

| artifact | generatedAt/asOf | age (h) | policy maxAgeHours | verdict |
|---|---|---|---|---|
| data.json | 2026-09-26T01:35:13Z | 35.9h | 12 | **FAIL — pipeline appears stalled** (schedule is every 30 min) |
| market-snapshot.json | 2026-09-26T01:35:13Z | 35.9h | 24 | FAIL |
| telegram-digest.json | 2026-09-26T01:35:43Z | 35.9h | 12 | FAIL |
| screener.json | 2026-09-26T05:25:47Z | 32.0h | 48 | within window but refresh-screener.yml (6h cadence) also appears stalled |
| earnings-calendar.json | 2026-09-26T05:25:05Z | 32.0h | 192 | OK |
| sec-fundamentals.json | 2026-09-26T05:25:05Z | 32.0h | 48 | OK (borderline) |
| operations-status.json | 2026-09-26T05:57:16Z | 31.5h | 24 | FAIL |
| reconciliation-status.json | 2026-09-26T09:20:29Z | 28.1h | 24 | FAIL |
| masters/index.json | 2026-09-25T12:45:59Z | 48.7h | (nested, 45d) | OK but only refreshes daily (07:13 UTC cron) |
| screener-universe.json | meta.lastBulkUpdate 2026-07-16 | ~1765h (73.5d) | staleAfterDays=7 | WARN — far outside declared window; this is a manually-curated universe list, not auto-refreshed per cycle |
| operator-note.json | updated 2026-06-30 | ~2149h (89.6d) | 720h (30d) | WARN by policy, but this artifact is explicitly editorial/manual (operator edits via GitHub web UI per refresh-data.yml comments) — expected to be stale relative to a 30d policy that may itself be miscalibrated for an editorial artifact |

**Everything with a ~28-36h age and an hourly/half-hourly declared schedule
points to the automated pipeline being currently stalled or not running on
schedule** — this matches the user's own memory note that the local repo is
18 versions ahead of the live deployed version and "미배포" (not yet
deployed). This is the single most important finding for section (c) of the
requested synthesis and should be foregrounded, not buried.

## 4. Critical architectural finding: P715 quote-publication contract

`scripts/fetch-data.mjs` internally fetches and verifies per-symbol quotes
(meta.symbolsOk=78, verifyStats, tdFallback fields all present in
public-data/data.json) — **but deliberately strips `data.quotes` down to `[]`
before publishing**, per a documented operator decision "P715" (Korean
comment: "사용자 결정 '클라이언트 직접 fetch 전환'" = "user decision: switch
to client-direct fetch"). The published artifact carries
`meta.quotesPublished: false` and `meta.quotePolicy:
'client-direct-fetch-only(P715)'`. This is enforced by a read-back
self-check right before commit (search `P715_QUOTE_CONTRACT_VIOLATION` in
scripts/fetch-data.mjs, ~line 4295-4300): if the published file on disk ever
has a non-empty `quotes` array or `quotesPublished !== false`, the workflow
throws and blocks the commit. Relevant line numbers: comments at
scripts/fetch-data.mjs:3112, :3199, :4211-4220, :4295-4300.

**Implication for the browser-fetch section of this audit (not yet
completed):** any live per-symbol quote fetch the browser performs
(Yahoo/Naver/etc., likely via a proxy fallback chain) is NOT a redundant/
accidental duplicate of a server-side artifact — it is the intended single
path for that data item, by explicit operator decision, most likely for
data-redistribution/licensing reasons (SEC/quote-provider ToS concerns with
republishing real-time third-party quotes from a GitHub Pages static site).
Any recommendation in section (e) of the synthesis to "move quotes to the
server pipeline" must engage with P715 rather than silently recommending
against it.

## 5. Directory structure ground-truthed (not yet mapped to lineage rows)

- `js/*.js`: 10 large legacy/bundle-style files (aio-core.js 1.7MB, aio-data.js
  1.0MB, aio-ui.js 468KB, aio-chat.js 667KB, aio-tests.js 744KB,
  aio-workspace.js 189KB, aio-pages.js 213KB, aio-kr-data.js 206KB,
  aio-macro-tech.js 78KB, aio-glossary.js 83KB) — likely where most browser
  live-fetch logic and hardcoded constants (DATA_SNAPSHOT, SCREENER_DB,
  AIO_MACRO_CALENDAR, etc.) actually live.
- `src/**`: a much more modular ES-module tree (ai/, app/, data/, domain/,
  legacy/, platform/, state/, storage/, ui/) — includes
  `src/data/market-snapshot-loader.js`, `src/data/runtime-readers.js`,
  `src/data/artifact-cache.js`, `src/legacy/market-snapshot-bridge.js`,
  `src/data/providers/*.js`, `src/data/orchestrators/*.js` — these names
  strongly suggest this is where the actual public-data/*.json loaders and
  per-route consumers live, separate from the legacy js/*.js bundle. Both
  trees need to be searched for the browser-fetch and consumer-mapping
  sections.
- `cloudflare-worker-proxy.js` (49KB, root) and `worker/data-plane.js` — read
  by file listing only; NOT yet analyzed for their /relay routes, allowlists,
  or KV quote-caching behavior. This was delegated to a background agent
  whose results did not return before this session was force-terminated.

## 6. NOT COMPLETED — must be redone

- Full external-domain inventory from the browser (Yahoo/Naver/CoinGecko/
  stooq/er-api/CNN/RSS/rss2json/Finnhub/FMP/AlphaVantage/TwelveData/BOK/KOSIS/
  FRED-via-relay) with file:function, proxy chain, and boot-vs-on-demand
  trigger — delegated, not returned.
- cloudflare-worker-proxy.js and worker/data-plane.js route-by-route detail
  (allowlist, auth, caching, KV population source) — delegated, not returned.
- Hardcoded constants inventory (DATA_SNAPSHOT, SCREENER_DB,
  AIO_MACRO_CALENDAR, AIO_EVENT_FRESHNESS_REGISTRY, holiday lists, theme
  maps, CHAT_CONTEXTS, weekly news constants) with size/last-update/owner —
  delegated, not returned.
- Per-artifact consumer mapping (loader file:function -> route/element,
  eager-vs-lazy, failure-mode-on-load) for every public-data/*.json —
  delegated, not returned.
- ASCII flow diagram — not drafted.
- Full synthesis (a)-(e) as specified by the user — only partially possible
  from sections above; (a) redundant paths and (b) browser-items-server-
  already-has cannot be answered without section 6's browser inventory.

## Recommendation (superseded — see below)

~~Re-run this task...~~ Superseded: browser/edge network map completed in
`19b-browser-edge-network-map.md` and server-pipeline/provider lineage
completed in `19c-server-pipeline-lineage.md` (both read and treated as
ground truth below). Sections 7-10 below (hardcoded-data inventory,
consumer mapping, flow diagram, synthesis) were completed directly in this
pass with grep + targeted Read, no sub-agents, read-only.

---

# PART 2 — Hardcoded data, consumer mapping, flow, synthesis
(Continuation session, 2026-09-27. Ground-truthed by direct grep/Read of
js/aio-*.js, src/**, sw.js, CHANGELOG.md. References `19b-browser-edge-
network-map.md` for browser/edge routes and `19c-server-pipeline-
lineage.md` for provider→artifact collection — not re-derived here.)

## 7. Hardcoded / static data inventory

| Name | File:lines | Size | Newest date inside | Consumes/feeds | Updated by |
|---|---|---|---|---|---|
| `AIO_MANUAL_REFERENCE` (fedPolicy/bokPolicy/krInflation/usCpiCalendar) | `js/aio-core.js:22564-22590` | 27 lines | fedPolicy.asOf `2026-09-16` | Seeds a handful of `DATA_SNAPSHOT` display fields (fedRate, bokRate, krCpi, cpiNext) | **Manual** — comment explicitly bans auto-editing ("수동 편집 금지"); operator/agent updates on each policy decision |
| `DATA_SNAPSHOT` object literal | `js/aio-core.js:22604-22665` | ~61 lines | n/a | Global namespace for all runtime volatile fields | **Not actually hardcoded data** — every field is `null` except the `AIO_MANUAL_REFERENCE` passthroughs above; it's a typed placeholder object populated at runtime by `_aioLoadServerData()` |
| `applyStaticFallbacks()` hardcoded-quote path | `js/aio-data.js:14281-14330` | — | — | Was a last-resort quote-value table | **Removed (v49.51)** — function body now actively *blocks* any hardcoded price fallback and stamps `window.AIO._lastStaticQuoteFallbackBlocked`; `window.AIO.getHardcodedQuoteFallbackAudit()` (`:14333+`) self-checks that no `FALLBACK_QUOTES` table has crept back in |
| `SCREENER_DB` (+`SCREENER_DB_META`) | `js/aio-data.js:10-970` | 880 symbols, ~960 lines | meta `lastBulkUpdate: 2026-07-16`; newest per-symbol `memo:` annotation `2026-08-13` | Static identity universe (symbol/name/sector/index only); `public-data/screener.json` merges in volatile factors at runtime. **Per 19c: `public-data/screener-universe.json` is derived FROM this array by a manual-only script (`sync-screener-universe.mjs`)** — this is the root cause of the screener-universe staleness (73.5d, WARN) already logged in section 3 above | **Manual/agent-curated** — symbol list bulk-updated 2026-07-16; individual `memo:` research annotations added piecemeal (dated REFERENCE/TG-REFERENCE tags) |
| `KR_STOCK_DB` | `js/aio-kr-data.js:1324-1546` | ~222 lines | — (identifiers only) | KR stock static identifiers, keyed by code | Manual |
| `KR_THEME_MAP` | `js/aio-kr-data.js:1551-1806` | ~255 lines | — | Static code→theme membership. Comment (R604) explicitly says timestamped market-cap descriptions were **deliberately removed** from this table to stop them being misread as current values — same instinct as P715 | Manual |
| `THEME_MAP` (US) | `js/aio-pages.js:1986-2199` | ~213 lines | — | Sector/theme → ETF + leader-ticker mapping | Manual |
| `KR_THEME_CATALYSTS` / `KR_THEME_NARRATIVES` | `js/aio-kr-data.js:34-35`, `js/aio-pages.js:3248` | 1-2 lines each | — | Both are now `Object.freeze({})` — **emptied deliberately** ("정적 카탈리스트 제거 — 최신 뉴스 증거만 허용" = "static catalysts removed — only current news evidence allowed") | N/A — decommissioned static content, same pattern as P715 |
| `KR_THEME_INSIGHTS` | referenced defensively (`typeof KR_THEME_INSIGHTS !== 'undefined'`) in `js/aio-kr-data.js:514`, `js/aio-core.js:9332`, `js/aio-workspace.js:2925` | 0 | — | **Never defined anywhere in the repo** — effectively dead, all call sites guard against its absence | N/A |
| `AIO_MACRO_CALENDAR` + `AIO_MACRO_OFFICIAL_SCHEDULES` | `js/aio-core.js:13581-13615` | ~34 lines | `nextRelease: '2026-11-30'` (GTC DC); most recent `lastRelease: '2026-09-16'` (FOMC/Fed rate) | Macro release calendar shown on macro/home pages; gated by `_aioMacroIsoDate`/expiry logic so an expired date degrades to `nextRelease: null` rather than showing a stale date | **Manual, per-cycle** — updated by operator/agent after each official release (comments cite P657, P1002, P1081, v52.42) |
| `AIO_EVENT_FRESHNESS_REGISTRY` | `js/aio-core.js:5027-5030` | 1 entry (`fomc`) | eventDate `2026-09-16` | Feeds `window.AIO.getEventClaimState()` — self-decaying claim-age check (`maxClaimAgeDays:42`, auto-flips CURRENT→AGING→EXPIRED) | Manual, but **self-expiring by design** — a genuinely good pattern: stale entries auto-downgrade rather than silently reading as current |
| `KR_HOLIDAYS_2026/2027`, `US_HOLIDAYS_2026/2027` | `js/aio-core.js:22875-22944` | ~70 lines | covers through `2027-12-25` | `isKrTradingDay()`/`isUsTradingDay()` — used for freshness/staleness judgments (e.g. "is today a trading day") | Manual. **Bug risk flagged**: `_KR_HOLIDAYS_MAP[year] \|\| KR_HOLIDAYS_2026` (line 22936) and the US equivalent (22943) silently fall back to the **2026 calendar** for any unregistered year — from 2028 onward this will silently misclassify holidays as trading days (or vice versa) with no error surfaced |
| `GLOSSARY` | `js/aio-glossary.js` (whole file) | 422 lines, 83KB | n/a (evergreen definitions, not dated facts) | Glossary/education page term lookup | Manual, low staleness risk by nature of content |
| `CHAT_CONTEXTS` | `js/aio-chat.js:1483-1508` + per-page overrides merged in `index.html` inline blocks | ~26 base entries | n/a | AI chat persona/prompt config per page, not market data | Manual — structural config, not a data-lineage staleness risk |
| `HOME_WEEKLY_NEWS` / `AIO_TELEGRAM_WEEKLY_DIGEST` | `js/aio-data.js:1016-1017,11578-11579` | empty init (`[]` / stub object) | n/a | **Correction to task framing**: these look like hardcoded constants but are actually typed empty containers populated entirely at runtime from `public-data/telegram-digest.json` (loaded eagerly, see §8) — not static data at all |

## 8. Per-artifact consumer mapping

| Artifact | Loader (file:line) | Eager/Lazy | Consumed by (route/element) | On load failure |
|---|---|---|---|---|
| `data.json` | `_aioLoadServerData()` `js/aio-data.js:5485-5670+`, awaited **first thing** inside `initV20DataEngine()` (`:7032`) before first paint | **Eager, boot-blocking** (first of all data calls) | All routes — populates `DATA_SNAPSHOT`, `window._serverDataMeta`; 22-category schema validated against `reconciliation-status.json` in the same call | `applyStaticFallbacks()` (`:14281`) → tries `localStorage.aio_cached_quotes` (24h TTL) → if none, hardcoded quote fallback is **actively blocked** (v49.51 guard) and UI shows "실시간 시세 대기 중 · 오래된 하드코딩 가격 fallback 차단됨" |
| `reconciliation-status.json` | fetched inline inside `_aioLoadServerData()` (`js/aio-data.js:5504-5508`) | Eager, same call as `data.json` | Not an independently-rendered artifact — used to cross-validate `data.json`'s own 22-category claim | Silent (`try/catch`), no UI element depends on it directly |
| `telegram-digest.json` | `_aioLoadServerTelegramDigest()` `js/aio-data.js:1232-1246`, called+**awaited** inside `_aioLoadServerData()` (`:5981`) | **Eager, boot-blocking** (chained after `data.json`, before Phase 1 fallbacks) | Home/briefing/market-news weekly-digest feeds via `_aioInjectAllTelegramFeeds()`; sets `window._aioTelegramDigestMeta` | `window._aioTelegramDigestMeta = {status:'unavailable', detail:...}`; feed sections render empty/hidden, no hard error |
| `market-snapshot.json` | `createMarketSnapshotLoader()` (`src/data/market-snapshot-loader.js`), invoked in `src/app/bootstrap.js:741` right after `router.start()` | **Eager, boot** (not route-gated — fires regardless of which page is active) | `store.dispatch({type:'market/snapshot'})` + `applyMarketSnapshotToLegacy()` → feeds legacy DOM broadly (home/fxbond/briefing/technical per `src/data/contracts/source-registry.js`) | Loader returns `{ok:false, snapshot:{status:'unavailable', errors:['snapshot_fetch_failed']}}`; `store` still gets a well-formed "unavailable" snapshot object rather than null — downstream renderers must branch on `status` |
| data-plane `/quotes` fast-plane | same loader, tried **before** `market-snapshot.json` only if `fastQuotesProvider()` returns `{enabled:true}` | Conditional-eager | Same consumers as market-snapshot.json (transparent upgrade) | Falls through to `market-snapshot.json` (durable snapshot) — by design, "can only add freshness, never remove it" |
| `public-config.json` (carries `marketData.fastQuotes.enabled`) | `window.AIO.loadPublicConfig()` `js/aio-core.js:17386-17409` | **Lazy — and only from ONE call site in the entire repo**: `js/aio-chat.js:1986`, inside `_aioEnsureClaudeRoute()` (the AI-chat send path) | AI chat routing only | Falls back to the **hardcoded default object** set at `js/aio-core.js:17377-17385` (`workerUrl: 'https://aio-proxy.zmfhd007.workers.dev'`, no `marketData.fastQuotes` key at all) |
| `screener.json` | `src/data/providers/screener.js` → `createScreenerOrchestrator().sync()` (`src/data/orchestrators/screener.js:28`), wired to route event at `src/app/bootstrap.js:693` (`legacy.on('aio:pageShown', ...new Set(['screener'])...)`) | **Lazy, route-scoped** — only fetched on navigating to the `screener` route (screener workbench) | Screener workbench route only; `source-registry.js` separately lists `breadth`/`signal`/`briefing` as consumers of the underlying artifact via other read paths | Orchestrator swallows abort/generation-mismatch errors; a genuine fetch failure propagates as a thrown error the orchestrator lets bubble (not silently masked like most other loaders) |
| `sec-fundamentals-summary.json` | `createEntityProvider()` (`src/data/providers/entity.js:19`, default `fundamentalsUrl`), 30-min cache TTL, wired via `createEntityOrchestrator` at `src/app/bootstrap.js:434`, triggered on `aio:pageShown` for `ticker`/`fundamental`/`options` routes (`:686`) | **Lazy, route-scoped** (3 routes) | Ticker detail, fundamental, and options pages | `src/ui/pages/entity.js:314-475` sets `data-source-label` to the artifact filename itself (e.g. `'sec-fundamentals-summary.json'`) as a visible fallback label instead of a fabricated number |
| `earnings-calendar.json` | `_fetchEarningsCalendarSnapshot()` `js/aio-pages.js:1567-1580`, called from `loadEarningsCalendar()` | Lazy, on-demand (screener/earnings UI) | Earnings calendar widget; explicitly documented (comment, P1102) as previously having **no consumer at all** despite the UI claiming a "무키 시 스냅샷"(keyless-snapshot) fallback existed — now fixed to actually read the file | Returns `null`, caller shows no earnings data for the week rather than erroring |
| `operator-note.json` | `_aioLoadOperatorNote()` `js/aio-data.js:6383-6398`, fire-and-forget (not awaited) inside `initV20DataEngine()` (`:7037`) | Eager, boot, non-blocking | `#home-operator-note` DOM element, home route only | Silent catch; note element hidden (`display:none`) if missing/placeholder — no error shown |
| `history.json` | `_aioLoadHistory()` `js/aio-data.js:6954+`, fire-and-forget inside `initV20DataEngine()` (`:7036`) | Eager, boot, non-blocking | Chart data-source labels (`js/aio-ui.js:217` `data-source-label="public-data/history.json:spx"`), used as seed once "sufficiently accumulated" per the v50.27 comment | Charts presumably keep using live/other sources; no explicit error path inspected |
| `masters/ticker-index-reference.json` | `js/aio-core.js:11259-11266` | Lazy, on-demand (13F-related UI) | 13F/ownership lookups | `.then()`/`.catch` fallback chain to a second fetch attempt |
| `market-snapshot-status.json`, `operations-status.json` | **No browser loader exists.** Confirmed by the repo's own audit: `CHANGELOG.md` P1111/P1112 (R615) — these were listed in `sw.js`'s cache-routing table but "클라이언트가 한 번도 fetch하지 않는다" (the client never fetches them); the entries were **removed from `sw.js`** (`sw.js:41-43` comment) because "소비자가 없는 항목은 캐시 구성을 거짓으로 설명" (an unconsumed entry misrepresents the cache config as if consumption existed) | N/A — produced, never consumed | none | N/A |

## 9. ASCII flow diagram

```
PROVIDERS (external)                    COLLECTOR (GitHub Actions, server)
─────────────────────                   ──────────────────────────────────
Yahoo chart/quote (keyless)  ─┐
Twelve Data (ETF fallback)    │
FRED / BLS / BEA / Treasury   ├─► scripts/fetch-data.mjs ──► public-data/data.json
CNN F&G (unofficial) / Cboe   │        │  (quotes STRIPPED before publish: P715,
AAII (+r.jina.ai relay)       │        │   data.quotes=[], quotesPublished:false)
Google News RSS / CoinGecko   │        ├─► public-data/history.json
Anthropic (haiku/sonnet)      ┘        ├─► public-data/telegram-digest.json  (fetch-telegram-digest.mjs, isolated lane)
                                        ├─► build-market-snapshot.mjs (in-process)
t.me/s (4 channels) ───────────────────┘        └─► public-data/market-snapshot.json (+status, UNCONSUMED)
                                        ├─► public-data/reconciliation-status.json (6h lane)
SEC EDGAR (companyfacts) ──► fetch-sec-fundamentals.mjs ──► public-data/sec-fundamentals.json
                                        └─► build-sec-runtime-projection.mjs ──► sec-fundamentals-summary(+manifest).json
Finnhub (free) ──► fetch-earnings-calendar.mjs ──► public-data/earnings-calendar.json
Yahoo (screener enrich) + sec-fundamentals + SCREENER_DB(js, manual)
   └─► fetch-data.mjs SCREENER_ONLY=1 ──► public-data/screener.json
js/aio-data.js SCREENER_DB (hardcoded) ──[sync-screener-universe.mjs, MANUAL ONLY]──► public-data/screener-universe.json
SEC 13F XML ──► collect-13f-*.mjs (daily only) ──► public-data/masters/*.json
                                        build-operations-status.mjs ──► public-data/operations-status.json (UNCONSUMED)

                                  ▼ commit to git, gate gauntlet, deploy to GitHub Pages ▼

STORAGE (static files, same-origin)      LOADER (browser, js/aio-data.js + src/app/bootstrap.js)
────────────────────────────────────     ─────────────────────────────────────────────────────
public-data/data.json           ───────► _aioLoadServerData()      [EAGER, boot-blocking, 1st]
public-data/reconciliation-status.json ─► (inline, same call)      [EAGER, validates data.json]
public-data/telegram-digest.json ──────► _aioLoadServerTelegramDigest() [EAGER, awaited inside data.json load]
public-data/market-snapshot.json ──────► createMarketSnapshotLoader()   [EAGER, boot, route-independent]
   (data-plane /quotes KV, cron */5 ─────┘ tried FIRST only if public-config.json,
    Yahoo Tier-0, NEVER reached in          already loaded, says fastQuotes.enabled=true —
    normal boot — see §8)                   which in practice never happens at boot, only
                                             after AI chat is opened)
public-config.json ─────────────────────► window.AIO.loadPublicConfig()  [LAZY — only call site
                                             is the AI-chat send path, js/aio-chat.js:1986]
public-data/operator-note.json  ───────► _aioLoadOperatorNote()    [EAGER, boot, non-blocking]
public-data/history.json ──────────────► _aioLoadHistory()         [EAGER, boot, non-blocking]
public-data/screener.json ─────────────► createScreenerOrchestrator().sync() [LAZY, route='screener']
public-data/sec-fundamentals-summary.json ► createEntityProvider() [LAZY, routes=ticker/fundamental/options]
public-data/earnings-calendar.json ────► loadEarningsCalendar()    [LAZY, on-demand]
public-data/masters/ticker-index-reference.json ► (inline fetch)  [LAZY, 13F UI]
public-data/market-snapshot-status.json ► (none — dead)
public-data/operations-status.json ────► (none — dead)

                                  ▼ in parallel with the above, boot ALSO fires: ▼

BROWSER DIRECT PROVIDER CALLS (see 19b for full table) — timers inside initV20DataEngine(),
UNCONDITIONAL regardless of data.json/market-snapshot.json freshness (only FRED/HY OAS check
_aioServerMacroReady first):
  t+2.5s  fetchLiveQuotes()   → Yahoo query1/2, Naver, CoinGecko, FX (open.er-api/exchangerate-api)
  t+3-8s  fetchFearGreed(), fetchPutCall() → CNN dataviz, cdn.cboe.com
  boot    RSS/news            → rss2json / rsshub.app mirrors / t.me scrape (if no CF Worker)
  ROUTE                        route-scoped: FMP/Finnhub/AlphaVantage/TwelveData (personal-key gated)
```

## 10. Synthesis

### (a) Independent paths per core item — conflicts and precedence

| Item | Server path (authoritative, published) | Browser path (independent, boot-fired) | Precedence in practice |
|---|---|---|---|
| US quotes | `data.json` — collected but **stripped before publish** (P715) | Yahoo query1/query2 @ t+2.5s, unconditional | Browser path is the **only** one that ever reaches the screen for live per-symbol price; server path exists only for macro/breadth-derived fields |
| KR quotes | not separately collected server-side for per-stock KR | Naver m.stock/api.stock, boot + on-demand | Browser-only, no conflict, but also no server fallback if Naver is blocked |
| Indices (SPX/KOSPI/etc.) | `market-snapshot.json` (Tier-0, boot-eager) | Yahoo direct, same timers | **Two independent live paths for the same numbers** — market-snapshot.json loads first (router.start() then snapshotLoader.load()), then fetchLiveQuotes() at t+2.5s can overwrite/reconcile; no explicit precedence rule found in this pass — worth a follow-up read of `applyMarketSnapshotToLegacy` vs `fetchLiveQuotes`'s DOM writes to confirm which wins on conflicting values |
| FX | server-side FX inside `data.json` (stripped, same as quotes) | open.er-api → exchangerate-api fallback, boot | Browser-only reaches screen, same P715 pattern as quotes |
| Rates/curve (FRED) | `data.json` FRED fields | Browser FRED via `/relay` or personal key, **gated by `_aioServerMacroReady`** | **This is the one item with a real freshness-aware precedence rule** — browser only calls FRED if server macro is stale. Everything else fires unconditionally |
| VIX | Both `data.json`/`market-snapshot.json` and direct Yahoo `^VIX` chart calls (`js/aio-data.js:3736`, `:16148`) | same unconditional-timer pattern as indices | Same ambiguity as indices |
| Macro calendar | `AIO_MACRO_CALENDAR` (hardcoded, manually updated) + `data.json` macro fields | n/a | Calendar dates are static/manual; the *values* (CPI, NFP, etc.) come from `data.json` |
| F&G | `data.json` (CNN, unofficial) | Browser CNN dataviz direct, boot | Duplicate, same host, P715-equivalent situation but not covered by the P715 comment itself (P715 explicitly names quotes) |
| News | `data.json` news backstop (applied only if browser news array is empty) | rss2json/rsshub/t.me, boot | Here the precedence IS explicit and correct: server is backstop-only, browser is primary — the one case where "browser primary, server fallback" is intentional and documented (`_aioApplyNewsBackstop`) |

### (b) Browser fetches that duplicate server-produced data
US/KR/index quotes, FX, F&G, put/call (partially — Cboe put/call actually has explicit server-first framing per comment at `aio-data.js:5961-5963`, unlike F&G), and RSS/news-as-primary. Per P715 the quote/FX/F&G duplication for **quotes specifically** is a stated operator decision (redistribution-risk avoidance), not an oversight — but F&G, put/call, and VIX duplication do not carry an equivalent documented rationale in the code comments found in this pass; they read as leftover pre-P715 architecture rather than deliberate per-item decisions.

### (c) Manual/hardcoded items and current staleness
See §7 table. Highest-risk items today: `screener-universe.json` (73.5d, WARN, root cause = `SCREENER_DB` manual-sync script per 19c) and the holiday-calendar 2028+ silent-fallback bug. Lowest-risk: `AIO_EVENT_FRESHNESS_REGISTRY` (self-expiring by design) and `GLOSSARY` (evergreen content). `AIO_MANUAL_REFERENCE` and `AIO_MACRO_CALENDAR` are both current as of this session (fedPolicy/FOMC asOf 2026-09-16) but require operator/agent action every FOMC/BOK cycle — no automated freshness alarm was found wired to these two specifically (unlike the artifact-level `ci-data-lineage-audit.mjs` registry).

### (d) Produced-but-unconsumed vs consumed-but-unproduced
- **Produced, never consumed**: `market-snapshot-status.json`, `operations-status.json` — confirmed dead by the project's own P1111/P1112 changelog entry and the resulting `sw.js` cache-table cleanup. `factor-backtest-longrun.json`/`score-backtest-longrun.json` are produced by manual research scripts with "cron 미배선" (no cron wiring) per 19c — effectively orphaned artifacts refreshed only by hand.
- **Consumed but structurally unreachable**: data-plane `/quotes` fast-plane. It is coded and wired (`market-snapshot-loader.js` tries it first), but the flag it depends on (`public-config.json`'s `marketData.fastQuotes.enabled`) is fetched from exactly one call site in the whole repo — the AI-chat send path — which runs strictly *after* the market-snapshot loader has already committed to the durable-snapshot path at boot. Functionally the fast-plane can only ever activate for a session that opened AI chat before its first market-snapshot load race, which does not happen in the normal boot order. This is worth flagging to the user as a likely-unintentional gap, not just "disabled by flag."

### (e) Target lineage for a free, automatic, family-only system

The system already has the right instincts in several places — the P715 quote-stripping decision, the KR_THEME_MAP timestamp removal (R604), the KR_THEME_CATALYSTS/NARRATIVES emptying, the hardcoded-quote-fallback block (v49.51) with a self-auditing guard, and the self-expiring event registry — all point toward "don't let stale/redistributable numbers sit in code or in a static file pretending to be current." A target design should extend that instinct rather than reverse it:

1. **P715 re-examination is legitimate given the stated usage.** The memory index describes this as family use (5 users, 2-4 concurrent), not public redistribution. If the deployment is (or becomes) gated behind Cloudflare Access / IP allowlist so only the family can reach the site, the "redistributing a third-party quote feed to the public" concern that (per the Korean comment) motivated P715 weakens substantially — the recipients are the same household, not the public internet. **Trade-off, not a legal verdict**: server-side collection + per-family delivery would (i) cut ~6 duplicate unconditional browser fetch paths (Yahoo/Naver/CoinGecko/FX/F&G/Cboe) down to one collection point, improving consistency and reducing the corsproxy/allorigins/codetabs dependency entirely; but (ii) each provider's own terms of service (Yahoo, Naver, CoinGecko, Cboe) may still restrict *any* redistribution regardless of audience size or access gating — that is a ToS/legal question the codebase cannot answer for itself, and the current code comments do not indicate this was checked provider-by-provider. The safer middle ground already half-exists: the `worker/data-plane.js` KV-cached `/quotes` fast-plane is architecturally exactly this (server pulls once, browsers read the cache) but is currently unreachable per (d) above — **wiring it up correctly (fixing the public-config.json load-order gap) is the lowest-risk way to test this direction** before deciding whether to also move FX/F&G/VIX/put-call the same way.
2. **Fix the structural gap, not just the flag.** `public-config.json` should be fetched eagerly at boot (or inlined into `data.json`/a boot-critical artifact) so `fastQuotesProvider()` can actually see `fastQuotes.enabled` before the market-snapshot loader commits to its source — otherwise turning the flag on server-side will silently do nothing.
3. **Automate `SCREENER_DB` → `screener-universe.json` sync** (currently `sync-screener-universe.mjs`, manual-only per 19c) into the refresh-data.yml cron; this single change resolves the largest staleness number in the whole audit (73.5 days).
4. **Fix the 2028 holiday-calendar cliff** (`js/aio-core.js:22936,22943`) before it silently misjudges trading days — either extend the table annually via the same cron that already runs monthly, or fail loudly instead of falling back to 2026.
5. **Decide, and document in one place, whether F&G/put-call/VIX duplication is intentional** (like news, "browser primary server backstop") or accidental leftover architecture — right now the code doesn't say either way for those three, unlike quotes (P715) and news (`_aioApplyNewsBackstop`, explicitly commented).
