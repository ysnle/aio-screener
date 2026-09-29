# AIO Screener — AS-IS Architecture (evidence-based), 2026-09-27, v56.58

Scope note: read-only audit of the working tree at C:\projects\AIO. All line numbers
verified with `wc -l` / `grep -n` against the actual files on 2026-09-27, not copied
from `_context/CODE-MAP.md`, which is itself internally stale in several sections
(its own frontmatter says line ranges below v53.8 are unverified). Where a claim
below comes from a generated/CI-enforced architecture/*.json artifact, it is marked
"(generated, CI-checked)"; where it comes from direct grep/read in this session, no
tag is needed; where it is asserted only by prose docs with no CI enforcement, it is
marked "(doc claim, unverified)".

Current ground-truth file sizes (`wc -l`, 2026-09-27), matching
`architecture/decomposition-hotspots.json.recordedLines` almost exactly (off by 1,
consistent with the ratchet being recorded slightly before this snapshot):

| File | Lines |
|---|---|
| index.html | 13,357 |
| js/aio-core.js | 28,206 |
| js/aio-data.js | 16,895 |
| js/aio-ui.js | 7,645 |
| js/aio-chat.js | 9,258 |
| js/aio-tests.js | 9,556 (CI/browser test bundle — excluded from deploy, see §1) |
| js/aio-pages.js | 3,392 |
| js/aio-kr-data.js | 3,234 |
| js/aio-macro-tech.js | 1,210 |
| js/aio-workspace.js | 3,032 |
| js/aio-glossary.js | 422 |
| src/** (34 dirs, ~34,331 lines total) | see §2 |
| scripts/fetch-data.mjs | 4,348 |
| scripts/ (rest, ~200 files) | ~35,886 |
| sw.js | 318 |
| cloudflare-worker-proxy.js | 951 |
| worker/data-plane.js | 238 |

---

## 1. Boot sequence (verified against index.html + js/*.js directly)

index.html today is 13,357 lines — **not** the ~28,600 lines the historical table in
`_context/CODE-MAP.md` (dated 2026-08-23, "v54.57") still shows. Between that
snapshot and now, P1133-P1136 extracted ~15,000 lines of what used to be inline
`<script>` blocks (A-D) into four new external classic files
(`js/aio-pages.js`, `js/aio-workspace.js`, `js/aio-kr-data.js`,
`js/aio-macro-tech.js`). This is a real, large, already-completed refactor — the
CODE-MAP historical table is simply the wrong document to read for current line
numbers (it says so itself: "verified_by: historical navigation map").

### 1.1 Exact `<script>`/`<style>` inventory (`grep -n '<script\|</script\|<style\|</style>' index.html`)

| Line | Element | Mode | Content |
|---:|---|---|---|
| 35-38 | 4× `<script src="./js/{aio-workspace,aio-macro-tech,aio-kr-data,aio-pages}.js?v=56.58" defer>` | classic, deferred | in `<head>`, **before** the main CSS block |
| 51-5996 | `<style>` | — | main CSS, 5,946 lines (see §6) |
| 6007-6039 | inline `<script>` | parse-time (blocking) | boot-loader controller — defines `window.AIO_BOOT` |
| 7839-7860 | inline `<script>` | parse-time | small page-local inline snippet inside body markup |
| 10393-10395, 10483-10486 | `<style>` | — | 2 orphan micro-style blocks embedded in body markup |
| 13090-13094 | 3× `<script async src="https://cdn...">` | async, unordered | Chart.js 4.4.0, DOMPurify 3.0.9, Lightweight-Charts 4.2.0 (all SRI-pinned) |
| 13095-13186 | inline `<script>` | parse-time | CDN-failure fallback + `window.Chart` offline stub + 5s retry timer |
| 13193-13195 | 3× `<script src="./js/{aio-core,aio-data,aio-ui}.js?v=56.58" defer>` | classic, deferred | |
| 13201 | `<script src="./js/aio-chat.js?v=56.58" defer>` | classic, deferred | |
| 13263 | `<script src="./js/aio-glossary.js?v=56.58" defer>` | classic, deferred | |
| 13305-13344 | `<style>` | — | AI side-panel CSS, physically 7,254 lines away from the main `<style>` block (§6 duplication) |
| 13354 | `<script type="module" src="./src/app/bootstrap.js">` | ES module, auto-deferred | native ESM entry point |

### 1.2 Actual execution order

Per the HTML spec, classic `defer` scripts and non-`async` `type="module"` scripts
both execute after DOM parsing completes, **in their relative document order,
interleaved with each other** — this is exactly what
`architecture/runtime-script-order.json` (generated, CI-checked by
`scripts/ci-structural-check.mjs`, rule R622) encodes and what this session
independently re-derived from the raw tag positions above:

1. Parse-time (synchronous, in document order, before anything deferred):
   inline block at 6007-6039 (`window.AIO_BOOT` loader), inline snippet at
   7839-7860, inline CDN-fallback block at 13095-13186.
2. Deferred classic scripts, in document order:
   `aio-workspace.js` → `aio-macro-tech.js` → `aio-kr-data.js` → `aio-pages.js` →
   `aio-core.js` → `aio-data.js` → `aio-ui.js` → `aio-chat.js` → `aio-glossary.js`.
3. Deferred ES module: `src/app/bootstrap.js` — runs **last**, after every classic
   defer script, because it is positioned after them in the document and modules
   defer by default.
4. `async` CDN scripts (Chart.js/DOMPurify/Lightweight-Charts) execute **whenever
   the network delivers them**, with no ordering guarantee relative to the defer
   chain — the 92-line inline fallback at 13095-13186 exists specifically to cope
   with this (offline `window.Chart` stub + a 5s second-chance CDN timer).
5. `DOMContentLoaded` fires once, after step 2/3's synchronous script bodies have
   run (not after their async internals) — at least 14 separate
   `document.addEventListener('DOMContentLoaded', …)` handlers are registered
   across `index.html` (2 sites) and `js/aio-core.js` (10 sites),
   `js/aio-chat.js` (3), `js/aio-kr-data.js` (1), `js/aio-macro-tech.js` (2),
   `js/aio-pages.js` (2) — all queued independently and fired in registration
   order with no coordinating barrier between them.
6. `window`'s `load` event (fires after all sub-resources, including the async
   CDN scripts and images, finish) is the **only** trigger for Service-Worker
   registration: `js/aio-ui.js:7498-7523` —
   `if ('serviceWorker' in navigator && …) window.addEventListener('load', function(){ … navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}) … })`.
   SW registration is therefore always one of the *last* things to happen in the
   page lifecycle, not part of "boot."

### 1.3 Boot-loader UI is decoupled from real data readiness

`index.html:6007-6039` (full text captured this session):
```
window.AIO_BOOT = { ready: closeBootLoader, progress: function(pct, message){...} };
document.addEventListener('DOMContentLoaded', function() {
  ...
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ closeBootLoader('화면 준비 완료'); }); });
}, { once:true });
window.addEventListener('aio:liveDataReceived', function() { closeBootLoader('화면 준비 완료'); }, { once:true });
setTimeout(function() { closeBootLoader('화면 준비 완료'); }, 3000);
```
The loading spinner closes on **whichever of three independent triggers fires
first**: (a) two RAF ticks after `DOMContentLoaded`, (b) a one-time
`aio:liveDataReceived` custom event, or (c) a hard 3000ms timeout regardless of
data state. In practice (a) — two RAFs after DOMContentLoaded — fires almost
immediately after parse, typically well before any live quote fetch resolves, so
the boot loader in practice closes on DOM-readiness, not data-readiness; the data
event and the 3s timeout are backstops that rarely get to fire first.

### 1.4 What "boot" actually initializes, layer by layer

1. **Style** — 5,946-line inline `<style>` parses synchronously before any script
   runs (classic CSSOM/DOM blocking behavior).
2. **Boot-loader IIFE** (6007-6039) wires its 3-trigger close logic (above).
3. **CDN async scripts** race the network; a synchronous fallback block
   (13095-13186) installs an offline `Chart` stub so later code that calls `new
   Chart(...)` doesn't throw even if the CDN never arrives.
4. **Classic defer chain** (9 files, order in §1.2) runs top-to-bottom. Because
   defer scripts share one global scope and one execution queue, later files
   freely read functions/globals the earlier files defined at *their own*
   module-evaluation time — this is a real, intentional, load-order-dependent
   coupling, not an accident (see §4.1 for a concrete decorator example and a
   documented past incident).
5. **DOMContentLoaded** fires; the ~14 independent listeners registered above run
   in registration order (workspace/macro-tech/kr-data/pages register theirs
   during their own defer-time execution, i.e. *before* core/data/ui/chat's
   listeners even exist yet, but all of them only actually *fire* after
   `DOMContentLoaded`).
6. **`src/app/bootstrap.js`** (native ESM entry, 939 lines) runs last of all
   deferred code. It reads legacy globals (`window.AIO`, `window.AIO_ARCH`
   producer-side, `root.AIO_PUBLIC_CONFIG`, etc.), builds the native route
   registry/store, and progressively "enhances" 20 routes on top of the legacy
   DOM shell that already exists (see §2 for its internal sequencing — native
   agent's report covers this in the next iteration of this document).
7. **`window.load`** fires last; only then does SW registration happen
   (js/aio-ui.js:7498-7523), meaning the app is fully interactive and rendered
   *before* any offline/cache layer is even requested — SW is pure "next visit"
   optimization, never a critical-path boot dependency.

### 1.5 What actually ships to production (from `.github/workflows/pages-deploy.yml:120-136`)

The Pages deploy job copies an **explicit allowlist**, not the whole repo:
`index.html, sw.js, version.json, og-image.svg, robots.txt, sitemap.xml,
public-artifact-manifest.json, public-config.json, _headers`, then
`js/aio-core.js js/aio-data.js js/aio-ui.js js/aio-chat.js js/aio-glossary.js
js/aio-pages.js js/aio-kr-data.js js/aio-macro-tech.js js/aio-workspace.js`
(9 files — **`js/aio-tests.js` is conspicuously absent**, confirming
CODE-MAP's claim that the 9,556-line test bundle never reaches production), then
`rsync -a src/` (the whole native tree) and a filtered `rsync` of `public-data/`
(excluding the 32MB `sec-fundamentals.json` and the 314MB `masters/` bulk ledgers).
Deploy is gated behind a SHA-attested CI run (`workflow_run`/`workflow_dispatch`
with `release_sha`), not a plain push-triggered publish — and per `CHANGELOG.md`'s
own entries through v56.58, the working tree is routinely far ahead of what is
actually deployed (repeated "이 로컬 변경은 커밋·푸시·배포하지 않았다" notes), consistent
with the user's own memory record ("v48.97 완료 ... 라이브 v48.79 대비 18버전 선행. 미배포").

---

## 2. Legacy classic-script layer (`js/*.js`, 9 files, 73,294 lines) — sub-agent full audit

*(All line numbers below were grepped directly against the working tree by the
delegated sub-agent; the sub-agent explicitly flagged and corrected several
false size estimates from a naive "distance to next declaration" heuristic —
noted inline where relevant, since it is itself evidence about how misleading
superficial line-counting is on this codebase.)*

### 2.1 Per-concern implementation sites (condensed; full detail in the sub-agent transcript folded in below)

- **US quotes**: `fetchLiveQuotes()` `aio-data.js:13371-14032` (663 ln) is canonical; `aio-ui.js:304-316` reassigns the global (`fetchLiveQuotes = async function(){...}` wrapping the original) after `aio-data.js` has already defined it — a load-order-dependent runtime wrapper, not a duplicate implementation. `applyLiveQuotes()` `aio-data.js:14730-15287` (558 ln) writes `_liveData`/`_quoteTimestamps`/`_previousPrices`/`_dataSource` and a `_LIVE_SNAP_MAP` translating Yahoo symbols to `DATA_SNAPSHOT` keys.
- **KR market data**: `js/aio-kr-data.js` (3,234 ln) owns KR themes (`initKoreaThemes:122`), KR supply/demand (`fetchKrSupplyData:618` + a 3-function failure cascade at 690/697/757), VKOSPI history+live (`_aioAppendVkospiHistory:989`, `fetchVkospiDynamic:1031`), investor top-10 flows (`fetchKrInvestorTop10:1065`), SEC filings/financials/XBRL frames (`fetchSECFilings:1879`, `fetchSECFinancials:1923`, `fetchSECFrame:1964`), and ticker resolution (`krTickerToYahoo:1830`, 20 refs; `dynamicTickerLookup:2056`, 37 refs). `KR_THEME_CATALYSTS` (line 34) is frozen to `{}` and its accessor `_krCatalystReferenceText()` (line 36) unconditionally returns `''` — a **deliberate, permanent no-op** ("정적 카탈리스트 제거 — 최신 뉴스 증거만 허용"), not literally-uncalled dead code.
- **Macro**: `js/aio-macro-tech.js` (1,210 ln): `computeMarketHealth:124` (base, decorated by `aio-ui.js:5091-5094`, and duplicated a third time natively — §6.3), `computeEconomicTemperature:834` (a **fourth**, separate composite macro-temperature score), `updateMacroRegimePill:952` (paints a DOM pill, does not itself classify), `renderYieldCurve:722`, `renderEconCalendar:615`, `generateMacroStoryline:648`.
- **Market regime**: canonical `classifyMarketRegime()` `aio-core.js:23879-23923` (45 ln, UPTREND/DOWNTREND/CORRECTION/CHOP/DATA_CHECK). No duplicate of the same name, but 3 architecturally-adjacent scoring surfaces exist in `aio-macro-tech.js` that never call it (`computeMarketHealth`, `computeEconomicTemperature`, `updateMacroRegimePill`) — 4 independent "what's the market doing" signals with no shared computation.
- **Trading score**: canonical `computeTradingScore(mode, opts)` `aio-core.js:23658-23783` (126 ln), 20s per-mode TTL cache (`window._aioScoreCache`), explicitly documented in its own preceding comment as having been relocated out of an inline `<script>` in `index.html` specifically because 5 defensive `typeof computeTradingScore === 'function'` call sites had accreted around the wrong ownership (a self-documented historical structural bug, P553/R244-adjacent). **10 external defensive call sites remain today** across 6 files — no second implementation exists; all delegate to the one function.
- **Factor ranking**: `_aioComputeFactorRanks()` `aio-data.js:15468-15525` (58 ln) is the legacy engine — see §4/§6 for its managed-fallback relationship with the native `computeFactorRanks` in `src/domain/screener/factor-ranks.js`.
- **News scoring**: `scoreItem()` `aio-data.js:9369-9753` (385 ln, LRU-cached), `classifyTopic()` `aio-data.js:9756-9782` (with an explicit anti-trust rule refusing to accept a source-provided `item.topics[0]` unless it's in the local `TOPIC_KEYWORDS` table), `fetchAllNews()` `aio-data.js:12320-12808` (489 ln) is the top-level fetch/merge/dedupe/score pipeline.
- **Freshness**: `window.AIO.ensureFreshDataForUse()` `aio-data.js:4772-4848`, backed by `REFRESH_SCHEDULE` (`aio-data.js:3792`, re-exported to `window` **3 separate times** at lines 3807/4015/4055 — same object, redundant re-assignment) and a **second, apparently-unmerged** policy table `FRESHNESS_POLICY` at `aio-core.js:21336` — the sub-agent flags this split (scheduler in `aio-data.js`, "policy" in `aio-core.js`) as a plausible second source of truth, not confirmed merged.
- **Market session/holidays**: all inside one `DATE_ENGINE` IIFE, `aio-core.js:22864` — `isKrTradingDay`, `isUsTradingDay`, `lastKrTradingDayEx` (encodes a 15:30-16:00 KST "EOD not yet confirmed" grace window), `lastUsTradingDay`, backed by static `KR_HOLIDAYS_2026/2027`/`US_HOLIDAYS_2026/2027` arrays. A second, single-year (`2026`-only) calendar exists independently in the native layer (`src/ai/time/market-session.js:8`, §6.5).
- **Number formatting**: no enforced canonical formatter. `_fmtNum`/`_fmtPct` (`aio-core.js:28191-28205`) are the closest thing to "canonical" — their own preceding comment documents they were *already* consolidated once ("원소유: aio-chat.js → aio-core.js 승격 v51.16") — yet at least 12 more independently-scoped formatters exist in `aio-ui.js` (`_fmt`, `fmtB`, `fmtP`, `fmtChg`, `_fmtTechPrice`, `_fmtTechPct`, `fmtBp`, `_fmtRet`), `aio-workspace.js` (`fmtLoss`, `fmtN`, and a **second, differently-signatured `_fmt(v,dec)`** distinct from `aio-ui.js`'s `_fmt(n)`), and `aio-kr-data.js` (`_fmtKrAmt`, `_fmtKrQuant`) — i.e. the one documented consolidation effort did not propagate past the file it happened in.
- **Charts**: 19 separate `new Chart(...)` instantiation sites (13 of them in `aio-ui.js` alone) plus 6 `LightweightCharts.createChart` sites; centralized destroy via `destroyPageCharts()` `aio-core.js:26804-26918` (115 ln, explicitly written to stop duplicate-instance memory leaks from ad hoc per-page cleanup), but chart-instance bookkeeping itself uses at least 4 different patterns side by side (object maps, single `window.*` globals, array-indexed registries, per-symbol keyed maps).
- **Route switching**: `showPage()` `aio-core.js:27763-27870` (108 ln — a naive heuristic first misjudged this as 1,300+ lines; brace-verified at 108) calls `destroyPageCharts()` on every transition. Its supporting route registry lives inside a **single 1,527-line anonymous IIFE** (`aio-core.js:25072-26598`) that also builds the evidence store and the deployment gate — three distinct responsibilities (routing config, evidence auditing, deploy gating) sharing one closure. The registry's own runtime self-check, `AIO_ROUTE_REGISTRY.registrySources` (`aio-core.js:27084`), **lists 7 separate places route identity is tracked** (`AIO_PAGE_CONTRACTS.routePageIds`, `AIO_ALL_ROUTE_PAGE_IDS`, `PAGES`, `showPage`, `history.state.page`, `location.hash`, "guide TOC") — a self-admitted-in-code architectural smell, not an inference by this audit.
- **Persistence**: a vault-aware wrapper family exists and is well-designed (`safeLS`/`safeLSGet`/`safeLSGetSync`/`safeLSGetJSON`, `aio-core.js:17463-17561`, schema-validated via `LS_SCHEMAS`) — but dozens of raw `localStorage.getItem/setItem` call sites bypass it **within the very same file that defines it** (onboarding flags, full-view toggle, chat-history-enabled, web-search opt-out, audit-mode, vault salt).
- **Error handling**: a well-built central logger `window._aioLog` (`aio-core.js`, ~line 38-93, 500-entry ring buffer, 50-events/min rate-threshold UI banner) coexists with **506 silent `catch{}`/`catch(_){}` blocks** across the 8 non-glossary files — most catches do not call the logger that exists specifically to catch them.
- **AI chat dispatch**: **two large, largely-parallel send pipelines** — `chatSend()` `aio-chat.js:6181-7492` (1,312 ln) and `chatSendUnified()` `aio-chat.js:8445-9247` (802 ln), together 2,114 lines, both independently call `window.AIO.ensureFreshDataForUse(...)` and read chat-context state slightly differently (an explicit `ctxId` parameter vs. a module-level `_aiCurrentCtx` variable). `CHAT_CONTEXTS` (`aio-chat.js:1483`) is deliberately merged so that **`index.html`'s own inline `CHAT_CONTEXTS` entries win** over this file's base definitions (comment at 1514-1519, cross-confirmed by `aio-tests.js:2010`) — a second, load-order-critical split source of chat-persona truth.

### 2.2 `window.AIO` / `window.AIO_ARCH` from the legacy side

`window.AIO = window.AIO || {}` appears at **43 sites** across 6 of the 9 files (27× in `aio-core.js` alone). Actual property writes (`window.AIO.<name> =`) total **≈387**, 87% of them (336) in `aio-core.js`. **`window.AIO_ARCH` has zero write sites in any of the 9 legacy files** — every one of its ~15 reference sites in `js/aio-chat.js`/`aio-core.js` is a defensively-guarded read (`window.AIO_ARCH && typeof window.AIO_ARCH.X === 'function'`), confirming from the legacy side what the native-layer audit found from the other side: `AIO_ARCH` is defined exactly once, at `src/legacy/compatibility-facade.js:517`, and the legacy layer already treats it as an optional foreign dependency rather than something it owns.

### 2.3 20 largest legacy functions (brace-span verified — see the size-heuristic warning below)

| # | Function | file:line | Lines | Purpose |
|---|---|---|---:|---|
| 1 | *(anonymous IIFE, not a named function)* — route/evidence/deploy-gate builder | `aio-core.js:25072` | **1,527** | `AIO_PAGE_CONTRACTS`, `buildEvidenceStore`, `getAllPageContentEvidenceMatrix`, `runEvidenceDeploymentGate`, route-id groupings |
| 2 | `chatSend` | `aio-chat.js:6181` | **1,312** | Primary per-persona chat dispatch |
| 3 | `chatSendUnified` | `aio-chat.js:8445` | **802** | Second, parallel unified chat dispatch |
| 4 | `fetchLiveQuotes` | `aio-data.js:13371` | **663** | US/crypto live quote fetch |
| 5 | `_aioLoadServerData` | `aio-data.js:5485` | **604** | GitHub Actions data-snapshot loader |
| 6 | `_fetchTickerDataForChat` | `aio-chat.js:3120` | **570** | Ticker evidence gathering for chat |
| 7 | `applyLiveQuotes` | `aio-data.js:14730` | **558** | Live-quote state writer |
| 8 | `fetchAllNews` | `aio-data.js:12320` | **489** | News fetch/merge/dedupe pipeline |
| 9 | `_enrichMarketCap` | `aio-kr-data.js:1299` | ~509* | KR market-cap enrichment (*not individually brace-re-verified*) |
| 10 | `window.AIO.buildEvidenceStore` | `aio-core.js:25884` | **201** | Evidence-matrix builder |
| 11 | `scoreItem` | `aio-data.js:9369` | **385** | News scoring |
| 13 | `window._aioRefreshAuditWidget` | `aio-core.js:18560` | ~423* | Refresh-audit widget renderer (*next-decl distance, not brace-verified*) |
| 15 | `fundamentalSearch` | `aio-chat.js:7882` | **345** | Fundamentals search/answer flow |
| 16 | `callClaude` | `aio-chat.js:2090` | **351** | Claude API streaming wrapper |
| 18 | `analyzeTickerDeep` | `aio-ui.js:5681` | **324** | Deep per-ticker technical analysis |
| 19 | `_generatePortfolioAnalysis` | `aio-kr-data.js:2701` | **293** | Portfolio narrative generator |
| 20 | `getAutoOpsReadiness` | `aio-core.js:15276` | **275** | Ops-readiness audit |

**Methodology warning worth preserving**: a naive "distance to next top-level
declaration" heuristic, tried first, was fooled by large `const` keyword/data-
literal tables sitting between function declarations, producing wrong estimates
by 5-20×: `escUrl` (actually 6 lines) was misjudged at ~1,982; `showPage`
(actually 108) at ~1,300+; `runInstitutionalTechnicalBrief` (actually 103) at
~962; `getChatHallucinationAudit` (actually 80) at ~613. Any future automated
size analysis on this repository must brace-match, not estimate from the next
declaration.

### 2.4 Dead-code spot check (10 candidates)

None of the 10 spot-checked candidates was true zero-call-site dead code. The
one real anomaly: `_aioTechSymSwitch` (`aio-macro-tech.js:375`, exported to
`window` at line 376) has no caller in any of the 9 audited files — it is
presumably invoked from an inline `onclick=` in `index.html`, which was outside
this sub-agent's file scope, so it could not be confirmed dead. This session's
own read of `index.html` (§1) did not encounter it either, but `index.html`'s
body markup (routes DOM) was not exhaustively grepped for `onclick` handlers —
flagged as an open item rather than a confirmed finding.

---

## 3. Data pipeline / edge / storage layer (delegated sub-agent findings, verified plausible against this session's independent public-config.json read)

*(Full evidence table from the sub-agent is authoritative for this section; key
facts cross-checked directly in this session: `public-config.json` confirms
`marketData.fastQuotes.enabled: false` with `soakObservedDays: 0` — i.e. the
Cloudflare "fast plane" quotes worker is deployed and wired client-side but
feature-flagged off pending a 7-day soak; `js/aio-ui.js:7510` and
`.github/workflows/pages-deploy.yml` were independently confirmed in this
session as described.)*

### 2.1 GitHub Actions pipeline (9 workflows)

- **refresh-data.yml** — cron `17,47 * * * *` (every ~30min) + daily `13 7 * * *`
  (gates 13F ingestion) → `fetch-data.mjs` → `ci-data-refresh-audit.mjs` →
  `fetch-telegram-digest.mjs` → (07:13 only) a 9-step 13F/masters chain → manifest
  sync → 7 more contract/reconciliation gates → `verify-refresh-candidate.mjs`.
  Writes `public-data/{data,history,market-snapshot*,operations-status,
  public-config,reconciliation-status,screener,telegram-digest}.json`,
  `atlas/index.json`, `backtest-history.json`, `masters/*`, `objects/masters/*`.
  Publication is explicitly **fail-closed**: the commit step's condition ANDs
  every gate's outcome (retrofitted after incident P1160 where a gate could fail
  and the bot still pushed); commits rebase-retry up to 5× against concurrent
  writers to `main`.
- **refresh-screener.yml** — cron every 6h → SEC fundamentals + earnings calendar
  → `fetch-data.mjs --SCREENER_ONLY` → validation/reconciliation → writes
  `screener.json`, `sec-fundamentals*.json`, `earnings-calendar.json`.
- **pages-deploy.yml** — SHA-attestation-gated static deploy (§1.5).
- **deploy-data-plane.yml** / **deploy-ai-proxy.yml** — manual-only
  (`workflow_dispatch`) Cloudflare Worker deploys via `wrangler`.
- **data-watchdog.yml** — hourly read-only monitor, opens/closes a dedup'd GitHub
  Issue on ≥2 consecutive failures (**operations-alert.yml**).
- **knowledge-lint.yml** — weekly check-only gate over the knowledge/skill
  artifacts.
- **ci.yml** — push/PR: preflight → contract matrix (core/data/knowledge/
  workspace/cloudflare) → Playwright browser matrix → release-attestation build.

### 2.2 `scripts/fetch-data.mjs` (4,348 lines) — external sources & duplication

External APIs called: Yahoo Finance (primary quotes), Twelve Data (fallback
quotes), FRED, BLS, US Treasury, AAII (via a `r.jina.ai` reader relay), BEA, CNN
Fear & Greed, Cboe put/call, Google News RSS, CoinGecko (cross-check), FMP
(fundamentals), Anthropic (LLM-generated market commentary, 2 call sites).

**Confirmed real, intentional server/client duplication**, not just raw-quote
relay:
- `_rsi14()` (fetch-data.mjs:2063) reimplements Wilder's RSI to match
  `js/aio-core.js:_calcRSILast` bit-for-bit, cross-checked by a dedicated CI
  parity test (`ci-data-pipeline-contract-check.mjs`) that runs both
  implementations against identical synthetic input.
- `_calcVCPServer()` (fetch-data.mjs:2705) reimplements the client's `_calcVCP`
  (js/aio-core.js:20528) VCP pattern detector, same "keep in lockstep via a CI
  test" pattern.
- `computeTradingScore` itself was **not** found duplicated server-side — no
  server-side trading-score recompute exists; `backtest-trading-score.mjs` tests
  historical data against a *separate* backtest harness, not a live mirror.
- Server-only analytics with no client equivalent: `_kalmanTrend`,
  `closesToFactors` (cross-sectional IC factor backtest).

### 2.3 Edge (Cloudflare Workers) — LIVE vs DISABLED

Two independent Workers exist, both deployed, with materially different live
status:
- **`aio-proxy`** (`cloudflare-worker-proxy.js`, 951 lines, root of repo) — **LIVE**.
  `js/aio-core.js` hardcodes its URL for both AI chat and macro-provider relay;
  `public-config.json.ai.routeStatus = "PUBLISHED"` with a recent observed health
  check. Backed by a Durable Object (`AIOQuotaDurableObject`, SQLite-backed) that
  enforces daily quota caps and fails the whole proxy closed if unbound. No KV, no
  D1.
- **`aio-screener-data-plane`** (`worker/data-plane.js`, 238 lines) — **built,
  fully wired client-side, but feature-flagged OFF.** Client code
  (`src/data/market-snapshot-loader.js`, `src/app/bootstrap.js:340-346`) already
  knows how to prefer this "fast plane" over the durable GitHub-Actions snapshot,
  but `public-config.json.marketData.fastQuotes.enabled = false` and its
  certification gate (`soakRequiredDays: 7, soakObservedDays: 0, rightsReviewed:
  false`) has never been cleared — so at runtime the client only ever reads the
  30-minute-cron `public-data/market-snapshot.json`, never the Cloudflare-KV
  ("quotes:current") snapshot this worker maintains via its own 5-minute
  `scheduled()` cron and independent Yahoo-fetch implementation (not shared code
  with `fetch-data.mjs`).

### 2.4 Client-side persistence — fragmented across two generations

~153 `localStorage` call sites, 37 distinct key literals (theme, chat history,
watchlist, portfolio cash, price alerts, API-quota counters, vault encryption
salt, onboarding flags, …) with **no** central persistence module — every
feature owns its own key string and read/write pair. Two *independent* IndexedDB
databases coexist: the legacy `js/aio-data.js:5173` opener (`_AIO_IDB_NAME`,
with its own migration-from-legacy-DB path at line 5209) and a newer, unrelated
`src/storage/screener-runs.js:10` (`'aio-screener-runs'`) — the native rewrite
did not migrate or wrap the legacy store, it just opened a second one.

### 2.5 `public-data/` publication surface

Root JSON: `data.json` (115KB, quotes/macro/news/marketAnalysis),
`screener.json` (1.63MB), `history.json` (1.78MB), `operations-status.json`,
`market-snapshot.json`, `reconciliation-status.json`, `telegram-digest.json`
(1.07MB), plus subtrees `atlas/` (552KB), `knowledge/` (652 files, 11MB),
`principles/` (400KB), and two **bulk producer-only** trees excluded from Pages:
`masters/` (314MB, 13F ledgers) and the 32MB `sec-fundamentals.json` — the client
instead consumes bounded projections (`build-masters-runtime-artifacts.mjs` →
content-addressed `public-data/objects/masters/<sha>.json`,
`build-sec-runtime-projection.mjs` → `sec-fundamentals-summary.json`).
Client fetch call sites use three different cache-busting conventions in
parallel: minute-bucket (`data.json`, `reconciliation-status.json`), hour-bucket
(`telegram-digest.json`, `history.json`), 5-minute-bucket
(`operator-note.json`), and raw-`Date.now()` + `cache:'no-cache'`
(`earnings-calendar.json`) — four distinct freshness conventions, not one shared
helper.

---

## 4. Native ESM layer (`src/**`, 193 files) + ADR-0001 compliance audit

*(Sub-agent full-read/grep evidence; sw.js findings cross-checked by this session
— `js/aio-ui.js:7510` SW-registration call site and index.html's zero SW
references were independently confirmed in §1.2/§1.4 above before this agent's
report arrived.)*

### 3.1 ADR-0001 contract-by-contract verdict

| Rule | Verdict | Evidence |
|---|---|---|
| 1. `src/domain/**` pure | **VIOLATED — 9 files** | `src/domain/screener/{factor-ranks,outcome-ledger,pit-validation,provider-capability,refresh-planner,regime,saved-screens,screen-engine}.js` all `import` from `src/data/contracts/*.js`. Zero `fetch`/`document.`/`window.`/`localStorage`/`indexedDB` hits anywhere in `src/domain/**` — so the violation is a layering/import-boundary breach, not a purity-of-computation breach (the imported contract files are themselves side-effect-free schema/value helpers). |
| 2. `src/data/**` validates before ingest | **PARTIAL** | Strong, multi-guard validation in `providers/{screener,themes,portfolio,publication-set}.js` and the fetched-artifact path of `providers/entity.js`. `providers/analysis.js` (3 lines) and `providers/sentiment.js` (11 lines) are **pure `{...spread}` pass-through with zero field validation**; `providers/market.js` and `providers/news.js` do only a shallow `typeof`/`Array.isArray` check, no per-field validation at that layer. |
| 3. `src/app/**` owns route lifecycle/disposal | **HELD** | `router.js`'s `transition()`/`disposeActive()`/per-scope `AbortController`, and `bootstrap.js`'s `stop()` closure (753-799) unwind every listener/interval/deferred task/evidence store on teardown. |
| 4. `src/ui/**` doesn't fetch/read storage | **MOSTLY HELD, named exceptions** | Zero direct `fetch`/`localStorage`/`sessionStorage`/`indexedDB` in `src/ui/**`. But `src/ui/pages/{screener,entity,market}.js` read `root.AIO`/`root.AIO_ARCH` (legacy globals) directly (7 call sites), bypassing the store/selector path; `atlas.js`, `masters.js`, `principles.js`, `screener.js` import data-layer modules (`data/artifact-cache.js:loadJsonArtifact`, `data/contracts/screener.js`) directly into the page module rather than only consuming `src/state/selectors/*`. |
| 5. `src/ai/**` shares the evidence envelope | Not exhaustively audited; wiring point confirmed at `bootstrap.js:841` (`buildEvidenceContext({evidenceStore, metrics, retriever: aiRetriever})`). |
| 6. `src/legacy/**` is the only compatibility boundary | **HELD at the directory level, but the ADR's own sub-claim is wrong** — see §3.3. |
| 7. no new global writers / no direct fetch / no direct Web Storage | **VIOLATED by `src/app/bootstrap.js` itself** | 8+ `window.*`/`root.AIO.*` writes at bare module-eval time (lines 83-124, run merely by *importing* the file, before `createAIOArchitecture()` is even called) plus 6 more post-composition (915-922); `getSignalScoreMode`/`setSignalScoreMode` (326-338) call `root.localStorage.getItem/setItem` directly, **bypassing `src/platform/storage.js`**, which exists specifically to be that indirection. |

### 3.2 `src/app/bootstrap.js` (939 lines, full read) — native boot sequence

1. **Import-time side effects** (lines 82-125): merely `import`-ing bootstrap.js
   executes `window.AIO = window.AIO || {}` plus 7 more `window.*`/`window.AIO.*`
   writes (`_statMean`, `buildPortfolioBacktestLab`, `_pfCreateCompositionSnapshot`,
   `_pfPortfolioLedger`, `_pfPortfolioFx`, `_pfDeclarationsStore`,
   `_pfDeclarationPanels`) — before any of the rest of the module even finishes
   evaluating, deliberately exploiting ESM import-hoisting (own comment at 80-81:
   "Classic-shell compatibility belongs at the app boundary").
2. `resolveInitialRoute()` reads **and writes** `root._aioOpenThemeDetailOnThemes`.
3. `createAIOArchitecture({root, documentRef, now, fetchImpl})` (309-924, 616
   lines — the single largest function in `src/**`) builds: `clock`,
   `evidenceStore`, `store` (initial shape in §3.4), `legacy =
   createLegacyFacade(root, eventTarget)`, `httpClient`, `runtimeReaders`; wires
   8 provider+orchestrator pairs (sentiment/news/market/themes/entity/
   portfolio/screener/analysis), most reading from `runtimeReaders.*` but
   `themes`/`screener` reading legacy globals via inline closures
   (`root?._liveData`, `root?._priceHistory`, `root?.RRG_SECTORS`,
   `root?.THEME_MAP`, etc. — lines 415-426, 466); builds 17
   `createLazyPage({route, loader: () => import('../ui/pages/X.js'), factory})`
   entries and the `router`.
4. `start()` (587-800, 214 lines): synchronous critical-path syncs
   (`sentiment`, `market`, `analysis` only — comment at 599-603: "the legacy
   snapshot/DOM shell already provides the first paint. Keep only the small
   decision-state projections on the critical path"); **all other route syncs
   (news/themes/entity/portfolio/screener) are deferred by a hard-coded 2300ms
   initial timeout**, then self-reschedule at 0ms per subsequent task; subscribes
   to ~19 legacy-dispatched `aio:*` events (catalog in §3.5); installs a 5-minute
   `setInterval` freshness watchdog plus a `visibilitychange` listener, both able
   to call back into legacy (`root._aioRefreshPageData`); starts the router and
   performs the initial `router.transition(initialRoute, {source:'initial-load'})`;
   **monkey-patches `window.showPage`** via `legacy.installNavigation(router)`
   (with a `queueMicrotask` + one deferred retry in case `window.showPage` isn't
   defined yet — a load-order race guard against the classic-defer chain not
   having finished); asynchronously loads the market snapshot and, on success,
   pushes it into the legacy `_liveData` global via
   `applyMarketSnapshotToLegacy()` (native → legacy write, §3.3).
5. Page-load trigger (926-939): idempotency-guarded by
   `window.__AIO_ARCH_RUNTIME__`, wired to `DOMContentLoaded` or run immediately
   if the document is already past `loading` — invoked from `index.html:13354`,
   the **last** script tag in the document (`type="module"`, auto-deferred),
   guaranteeing every classic `js/aio-*.js` global exists (though not
   necessarily populated) by the time this module body runs.

### 3.3 `src/legacy/compatibility-facade.js` (588 lines) — the ADR's "read-only" claim is incomplete

8 of 9 `createLegacyFacade()` read-family exports (`readSentiment`, `readMarket`,
`readThemes`, `readEntity`, `readPortfolio`, `readScreener`, `readAnalysis`,
`readRoute`, `readVersion`) are strictly read-only against legacy globals
(`root._liveData`, `root.DATA_SNAPSHOT`, `root._currentTickerId`, `root.THEME_MAP`,
etc.). But ADR-0001's rollback section states the facade is "read-only except the
approved sentiment ingest gateway" — direct grep for legacy-global assignment
inside the file (`root\.[A-Za-z_$][\w$.]*\s*=[^=]`) finds exactly **two matches,
neither of which is the sentiment gateway**: `installNavigation()` at lines 449
and 466 assigns `root.showPage = <wrapper>` (installing the native router) and
`root.showPage = originalShowPage` (restoring it on teardown) — a genuine,
undisclosed second mutation of legacy state. A **third** mutation exists one file
over in the same `src/legacy/` directory (so it satisfies rule 6's directory
scope, but not the ADR's specific "one named exception" framing):
`src/legacy/market-snapshot-bridge.js` (57 lines, full read) calls
`root._aioSetLiveData(...)` once per quote to push the native market snapshot
into the legacy `_liveData` store, self-documented as "the only bridge allowed to
project the new canonical snapshot into the legacy renderer" — a claim of
exclusivity this audit found no lint/test enforcing. Net: the facade boundary has
**3 distinct legacy-mutation mechanisms** (navigation monkey-patch,
`AIO_ARCH` property definition, snapshot-bridge push), not the 1 the ADR names.

### 3.4 State shape and event bus

Runtime store (from the sole `createStore()` call site, `bootstrap.js:313`):
`{ sentiment, news, market, themes, entity, portfolio, screener: {...,
savedScreens}, analysis, route: null, marketSnapshot: null }` — 8 named domain
slices (`src/state/slices/*.js`) plus 2 top-level scalars owned directly by
`bootstrap.js`'s own `reducer()`, not by any slice module.
`src/state/store.js` (52 lines): no defensive cloning (trusts reducers'
structural sharing), optional `devMode` recursive `Object.freeze` after commit,
listener errors collected into `AggregateError('STORE_LISTENER_FAILED')` rather
than aborting the notification pass (matches ADR-0002's RM-02 appendix exactly).

**24 distinct `aio:*` custom-event names** cross the legacy/native boundary.
`src/**` itself only *dispatches* 5 of them (`router.js` ×2, `bootstrap.js` ×2,
`market-snapshot-bridge.js` ×1 dual-target dispatch); the other ~19
(`aio:liveQuotes`, `aio:refresh:done`, `aio:historyLoaded`, `aio:sentimentUpdated`,
`aio:newsUpdated`, `aio:marketSnapshot`, `aio:serverDataLoaded`,
`aio:macroUpdated`, `aio:themesHistoryLoaded`, `aio:portfolioChanged`,
`aio:pageShown`, etc.) are dispatched from legacy `js/aio-*.js` and consumed by
`bootstrap.js`'s ~19-subscription event-wiring block — `aio:refresh:done` alone
fans out to 7 separate `sync*` calls. This event bus is the dominant
legacy→native data-arrival channel, running in parallel with the direct
function-call channel (monkey-patched `showPage`) used for navigation.

### 3.5 Legacy↔native call direction is bidirectional, by two independent mechanisms

1. **Legacy→native by direct call**: `installNavigation()` replaces
   `window.showPage`; the wrapper calls the original `showPage` first, then
   `router.transition(canonicalRoute, {source:'architecture-navigation', ...})`
   directly. This is the dominant path once boot completes (confirmed by
   `claimNavigationAuthority()` suppressing the redundant event path below).
2. **Legacy→native by event**: `js/aio-core.js:27759` (`_firePageShown`, called
   from `showPage()` at :27763) dispatches `aio:pageShown` on `document`;
   `router.js:338` listens — but **no-ops once `navigationAuthority ===
   'external'`** (i.e. after mechanism 1 has taken over), so this is a fallback
   path for pre-boot or non-writable-`showPage` hosts, not the steady-state path.
3. **`window.AIO_ARCH.*` call-site density** (legacy reading the frozen native
   surface): `js/aio-core.js` 29, `js/aio-chat.js` 20, `js/aio-data.js` 25,
   `js/aio-pages.js` 8, `js/aio-macro-tech.js` 4, `js/aio-ui.js` 2 — **~88 total**.
   The broader mutable `window.AIO.*` namespace (not the frozen `AIO_ARCH`) is
   referenced **1,087 times in `js/aio-core.js` alone**, plus hundreds more
   across the other 8 classic files.
4. **Native→legacy**: `bootstrap.js` reads dozens of legacy globals at
   composition time and calls legacy functions directly
   (`root._aioWatchlistGet()`, `root.showTicker()`, `root._aioWLToggle()`,
   `root._aioRefreshPageData()`), and `market-snapshot-bridge.js` pushes into
   `_liveData` via `root._aioSetLiveData(...)`.
5. **`index.html` itself is inert** with respect to this boundary — 0 grep hits
   for `AIO_ARCH`, `router`, `compatibility-facade`, or `aio:pageShown` inside
   `index.html`; every cross-boundary call site lives inside the `.js` files.

### 3.6 15 largest functions in `src/**` (brace-matched span, `function`/`async function` only)

| Lines | Location | Name |
|---:|---|---|
| 721 | `src/ui/pages/screener.js:1055` | `createScreenerPage` |
| 672 | `src/domain/portfolio/backtest.js:443` | `buildPortfolioBacktestLab` |
| 616 | `src/app/bootstrap.js:309` | `createAIOArchitecture` |
| 469 | `src/ui/pages/principles.js:1036` | `createPrinciplesPage` |
| 439 | `src/data/providers/screener.js:183` | `createScreenerProvider` |
| 374 | `src/domain/screener/factor-ranks.js:359` | `computeFactorRanks` |
| 358 | `src/ui/pages/atlas.js:1350` | `createAtlasPage` |
| 311 | `src/ui/pages/masters.js:1004` | `createMastersPage` |
| 234 | `src/domain/portfolio/surface.js:174` | `derivePortfolioSurface` |
| 227 | `src/ui/pages/themes.js:771` | `renderAiInfrastructureLens` |
| 222 | `src/domain/portfolio/risk.js:235` | `deriveRiskEstimate` |
| 214 | `src/app/bootstrap.js:587` | `start` |
| 209 | `src/domain/signal/trading-score.js:76` | `computeTradingScoreModel` |
| 192 | `src/app/router.js:164` | `createLifecycleRouter` |
| 181 | `src/ui/pages/entity.js:567` | `createEntityPage` |

Pattern: the largest native functions are almost all `create*Page` route-factory
closures containing an entire route's mount/render/dispose logic as one function
body — a structural consequence of the "one factory function per route"
convention in `src/ui/pages/*.js`, not necessarily deep cyclomatic nesting.

### 3.7 `sw.js` (318 lines, full read) — service worker cache strategy

Two cache namespaces, both versioned by `SW_VERSION = 'v56.58'` (matches
`index.html`'s `?v=56.58` cache-busting query and `version.json`):
`aio-shell-v56.58`, `aio-data-v56.58`.

- **Precache** (install): exactly 10 assets — `./`, `./index.html`,
  `version.json`, `public-config.json`, `js/aio-{core,data,ui,chat,glossary}.js`,
  `src/app/bootstrap.js`. **Not precached**: `js/aio-macro-tech.js`,
  `js/aio-kr-data.js`, `js/aio-pages.js`, `js/aio-workspace.js`, and all 192
  other `src/**` files — these fall through to the runtime-shell path on first
  request instead. `cache.addAll` is atomic; one failed asset fails the whole
  install.
- **Runtime shell** (`/\/(?:js|src)\//` path match): Network-First,
  `cache:'no-store'` fetch, cache the response, fall back to cache-or-503 on
  network failure.
- **Data/API caching**: 4 independent pattern-list/TTL pairs — quotes/general
  data (15 min), news (30 min), core snapshot-ish JSON (`data.json`,
  `history.json`, `screener.json`, 1 hr — deliberately longer than quotes
  because "model inputs mixed in"), reference/knowledge artifacts (24 hr).
  Sensitive-query URLs (`apikey|token|access_token|client_secret` params) are
  never cached. A read-time staleness gate rejects even a cache *hit* as a 503 if
  its age exceeds 4× its TTL (or 7 days for reference artifacts), rather than
  silently serving arbitrarily old data as fresh. `DATA_CACHE` is capped at 500
  entries (FIFO eviction).
- **Invalidation**: bumping `SW_VERSION` is the sole invalidation mechanism —
  `activate` deletes every cache whose name isn't the current version's;
  `skipWaiting()`/`clients.claim()` force immediate takeover.
- **Registration**: confirmed (independently, by this session and the sub-agent)
  to be **absent from `index.html`** and to live at `js/aio-ui.js:7498-7523`,
  gated on HTTPS-or-localhost and a `localStorage.aio_sw_disabled` opt-out, fired
  only on `window`'s `load` event (§1.2) — i.e. never part of the critical
  render path.

---

## 5. Responsibility matrix

Legend: **LIVE** = the implementation actually exercised at runtime for that
concern today; **DUP** = a competing/parallel implementation of the same
concern that also runs (or can run) at runtime; **MANAGED-DUP** = a duplicate
with an explicit, code-enforced precedence rule (not a race); **DEAD/STUB** =
present in source but a permanent no-op or unreachable; **SERVER** = runs only
in the GitHub Actions pipeline, never in the browser.

| Concern | Legacy (js/*.js) | Native (src/**) | Pipeline (scripts/*.mjs) | Worker (Cloudflare) | Notes |
|---|---|---|---|---|---|
| Get US quotes | fetchLiveQuotes() aio-data.js:13371 (663 ln) -- LIVE; wrapped by aio-ui.js:304-316 (load-order decorator, not a dup) | src/data/providers/market.js reads via runtimeReaders.readMarket -- thin re-read of legacy, not an independent fetch | fetch-data.mjs -- Yahoo primary + Twelve Data fallback -- SERVER, writes data.json/market-snapshot.json | worker/data-plane.js -- independent Yahoo-fetch implementation, 5-min cron, KV-cached -- built, DISABLED (fastQuotes.enabled:false) | 3 independent fetch implementations plus a 4th read-path |
| Get KR quotes/data | js/aio-kr-data.js (whole file) -- LIVE, sole owner | none found | none found | none | Single-owner concern -- one of the few with no duplication |
| Macro indicators | js/aio-macro-tech.js (whole file) -- LIVE | src/domain/macro/treasury-curve.js (pure model), src/ui/pages/market.js (native chart/renderer on macro/fxbond routes) -- LIVE for chart/renderer; narrative still legacy | fetch-data.mjs -- FRED/BLS/Treasury/AAII/BEA fetch + LKG merge -- SERVER | cloudflare-worker-proxy.js /relay -- FRED/BOK/KOSIS key relay -- LIVE | Real 3-tier split -- one of the better-factored concerns |
| Market regime | classifyMarketRegime() aio-core.js:23879 -- LIVE, canonical | src/domain/screener/regime.js (deriveRegimeState, riskOn/riskOff hysteresis) -- related but not the same model, runtime wiring not confirmed live | none | none | Adjacent-but-different concept, flagged not asserted as DUP |
| Market health (composite) | aio-macro-tech.js:124 base + aio-ui.js:5091-5094 decorator -- LIVE (composed) | src/domain/market/health.js:74 computeMarketHealth v2, own copy of M7/sector-ETF lists -- exists but src/data/runtime-readers.js:647 prefers the legacy global over this sibling module | none | none | DUP x3 -- see Sec 6.3 |
| Trading score | computeTradingScore() aio-core.js:23658 -- LIVE, single legacy implementation, 10 defensive call sites | src/domain/signal/trading-score.js:76 computeTradingScoreModel (209 ln) -- pure native model | none (backtest-trading-score.mjs tests historical data separately, not a live mirror) | none | Bootstrap comments describe native as the intended replacement; both exist in source today, runtime precedence not independently confirmed |
| Factor ranking | _aioComputeFactorRanks() aio-data.js:15468 -- MANAGED-DUP, only runs if native hasn't already populated ranks | src/domain/screener/factor-ranks.js:359 computeFactorRanks (v6, 374 ln) -- LIVE, primary | fetch-data.mjs computes RSI(14)/VCP/Kalman-trend/cross-sectional factors server-side, CI-parity-tested against the client RSI/VCP -- SERVER, intentional duplication held in lockstep by a test | none | Best-documented duplication in the codebase -- explicit precedence + explicit CI parity test |
| News scoring | scoreItem()/classifyTopic() aio-data.js:9369/9756 -- LIVE | none found | fetch-data.mjs owns fetch/KST-cycle logic, distinct concern from the scoring math itself | none | Single-owner on the scoring math |
| Freshness judgment | ensureFreshDataForUse() aio-data.js:4772 + REFRESH_SCHEDULE (aio-data.js:3792, re-exported 3x) + a separate FRESHNESS_POLICY (aio-core.js:21336) -- LIVE, 2 tables not confirmed merged | none (native reads legacy freshness state via runtime readers) | ci-data-refresh-audit.mjs, ci-data-lineage-audit.mjs, strict wall-clock lineage gates -- SERVER-side publish-time SLA, a third independent freshness concept | worker/data-plane.js quote-quality classification (CURRENT/CLOSED_CURRENT/DELAYED/STALE/UNAVAILABLE) -- a fourth taxonomy, only live if fast-plane is enabled (it is not) | 3-4 independently-defined "is this fresh" concepts, none unified |
| Market session/holidays | DATE_ENGINE IIFE aio-core.js:22864, US_HOLIDAYS_2026/2027 -- LIVE | src/ai/time/market-session.js:8 US_REGULAR_CALENDAR_2026 (2026-only) -- separate, unmerged | none | none | DUP, both hand-maintained per-year, no shared source |
| Number formatting | _fmtNum/_fmtPct aio-core.js:28191 (documented-as-canonical) + 12+ other independently-scoped formatters across aio-ui.js/aio-workspace.js/aio-kr-data.js -- DUP, heaviest in the codebase | no shared formatter found in native page modules either | n/a | n/a | Zero Intl.NumberFormat usage anywhere in the app |
| Chart creation | 19x new Chart() + 6x LightweightCharts.createChart across aio-ui.js/aio-macro-tech.js/aio-pages.js/aio-data.js; centralized destroy destroyPageCharts() aio-core.js:26804 -- LIVE for 12/20 routes' charts | src/ui/pages/analysis.js:336,341 (new ChartConstructor) and other page modules own 8/20 routes' charts -- LIVE for those | none | none | Route-level split confirmed by architecture/route-owners.json, spot-checked directly |
| Route switching | showPage() aio-core.js:27763 (108 ln) -- still what window.showPage resolves to before native installs its wrapper; supporting registry has 7 documented sources of route-identity truth | src/app/router.js createLifecycleRouter -- owns lifecycle/mount/dispose for all 20 routes once installNavigation() monkey-patches window.showPage -- LIVE, dominant path post-boot | n/a | n/a | Bidirectional: legacy showPage runs first inside the monkey-patched wrapper, then delegates to native router.transition() |
| Persistence | safeLS/safeLSGetJSON family (aio-core.js:17463-17561, schema-validated) -- canonical but bypassed by dozens of raw localStorage calls in the same file; 37 distinct key literals app-wide, 2 independent IndexedDB openers (aio-data.js:5173 legacy, src/storage/screener-runs.js:10 native) | src/app/bootstrap.js:329,336 (getSignalScoreMode/setSignalScoreMode) calls root.localStorage directly, bypassing src/platform/storage.js, which exists for exactly this indirection | n/a | Cloudflare KV (worker/data-plane.js, quotes cache only), Durable Object (cloudflare-worker-proxy.js, quota only) -- neither is app persistence | No unified persistence layer anywhere in the codebase |
| Error handling/logging | window._aioLog aio-core.js:~38-93 (ring buffer + rate-threshold banner) -- well-built, canonical -- but 506 silent catch{} blocks across 8 files do not call it | not audited for a parallel logger; native code relies on thrown errors + AggregateError('STORE_LISTENER_FAILED') from src/state/store.js | CI scripts capture stdout/stderr per-run with secret masking (CHANGELOG P1286/R636) -- a third, CI-only error-capture mechanism | n/a | Logger exists and is good; adoption is the gap, not design |
| AI context assembly | CHAT_CONTEXTS aio-chat.js:1483 (10 personas), overridden per-key by index.html's own inline CHAT_CONTEXTS entries (deliberate, load-order-critical merge) -- LIVE; chatSend() (1,312 ln) and chatSendUnified() (802 ln) are two parallel dispatch pipelines, both live, both independently call ensureFreshDataForUse | src/ai/context-builder.js / src/ai/retrieval/{evidence,knowledge}.js wired into bootstrap.js:841 (buildEvidenceContext) -- exists, not confirmed to be what chatSend/chatSendUnified actually consume | n/a | cloudflare-worker-proxy.js /anthropic -- the actual LLM call proxy, DO-quota-gated -- LIVE | Biggest concentration of legacy logic in the app (2,114 lines across 2 pipelines) with an unconfirmed relationship to the newer native AI evidence layer |

## 6. Dependency / coupling analysis — god objects, god functions, load-order fragility

*(This section consolidates direct evidence gathered by the lead session, cross-checked against both sub-agent reports in §2 and §4.)*

### A.1 `window.AIO` — the de facto shared global namespace

`window.AIO = window.AIO || {}` (idempotent-merge form) appears **47 times**
across `js/aio-chat.js`, `js/aio-core.js`, `js/aio-data.js` and others — i.e.
nearly every legacy file re-touches the same object at its own module-eval time
rather than one file owning it. Distinct `window.AIO.<name> = ` property
assignments found by grep: **391** — this is a single, unbounded, accretive god
object that both legacy code (all 9 classic files) and native code
(`src/legacy/compatibility-facade.js`, `src/data/runtime-readers.js`,
`src/data/screener-row-policy.js` all read `root.AIO_ARCH.*` back through
`window`) route through. ADR-0001 rule 6 ("`src/legacy/**` is the only
compatibility boundary for legacy globals") is procedurally true at the
*definition* site — `window.AIO_ARCH` has exactly one definition site,
`src/legacy/compatibility-facade.js:517`
(`Object.defineProperty(root, 'AIO_ARCH', {...})`) — but native **consumers**
other than the facade itself (`runtime-readers.js:288,504`,
`screener-row-policy.js:27-28`) read it back out through `window`/`root` rather
than importing the facade module directly, so the "boundary" is bidirectional in
practice: legacy reads native surface via `window.AIO_ARCH`, and native reads its
own surface back via the same global instead of a module import.

### A.2 A concrete, non-hypothetical load-order-sensitive coupling

`js/aio-macro-tech.js:124` declares `function computeMarketHealth(options) {...}`
(hoisted, defer-order position 2 of 9). `js/aio-ui.js:5091-5094` (defer-order
position 7) then runs:
```js
(function() {
  var originalComputeMarketHealth = computeMarketHealth;
  computeMarketHealth = function() {
    var result = originalComputeMarketHealth.call(this);
    ... // adds Magnificent-7 + sector-breadth data to the result
  };
})();
```
This is a deliberate decorator, not a bug — but it only works because
`runtime-script-order.json` (rule R622) guarantees aio-macro-tech loads before
aio-ui. The same file documents a *real* past incident of this exact shape:
"P1135: a block extracted into a file that loaded after js/aio-ui.js made
aio-ui.js call a global that did not exist yet at its own evaluation time...
headless passed 1,133/1,133 and every static gate passed; only the real-browser
check caught it." I.e. this class of coupling has already caused one silent
production-shaped failure that only manual real-browser QA caught, not the
automated gate suite.

### A.3 Documented duplicate-global incident (from `architecture/global-ownership-baseline.json`, generated + CI-enforced by `scripts/ci-structural-check.mjs`)

"P1132: js/aio-ui.js declared `function _fetchYahooChartData` while
js/aio-data.js assigned `window._fetchYahooChartData`. Which one ran depended
only on script order, and the loser was silently dead — until an extraction
flipped the order and the dead wrapper became live, silently applying its own
default arguments to every caller." This governance file now tracks 295 excluded
namespace-boilerplate names plus a small `documentedFunctionPairs` allowlist
(currently only `getApiKey`/`setApiKey`, intentionally dual-order-safe per a
comment at js/aio-core.js:1420-1441) — i.e. duplicate global ownership is a
recognized, CI-ratcheted class of defect in this codebase, with at least one
confirmed historical production-shaped incident.

### A.4 Number formatting — confirmed heavy duplication, responsibility-matrix evidence

At least 15 independently-implemented, file-local number/percent formatters, zero
shared helper, zero `Intl.NumberFormat` usage anywhere in `js/*.js` or `src/**`:
`js/aio-core.js:28191 _fmtNum`, `:28201 _fmtPct`; `js/aio-kr-data.js:1177
_fmtKrAmt`, `:1186 _fmtKrQuant`; `js/aio-ui.js:3172 _fmt` (closure-local),
`:3707 fmtB`, `:3714 fmtP`, `:3913 fmtChg`, `:5430 _fmtTechPrice`, `:5434
_fmtTechPct`, `:6504 fmtBp`, `:7089 _fmtRet`; `js/aio-workspace.js:1403 fmtLoss`,
`:1404 fmtN`, `:2405 _fmt` (a *second*, differently-scoped `_fmt`).

### A.4b Route registry direction of truth — resolves a CODE-MAP staleness claim

`_context/CODE-MAP.md` (v54.57 snapshot) claims `src/app/routes.js`'s
`ROUTE_IDS` and `js/aio-core.js`'s `ROUTE_PAGE_IDS` are "두 개의 서로 다른 순서를 가진
중복" (two duplicated lists in different order, flagged as a future
single-sourcing target). Direct read of the current file shows this is now
**resolved, in the legacy-wins direction**: `src/app/routes.js:1-4` is a header-
stamped generated file — `"GENERATED FILE — do not edit by hand (P1137/R623).
Source of truth: var ROUTE_PAGE_IDS in js/aio-core.js. Regenerate: node
scripts/generate-route-registry.mjs --write"`. I.e. the *native* ESM route list
is mechanically derived from the *legacy* classic-script global, not the reverse
— during this migration, legacy remains the canonical route source even though
`src/app/router.js` is what actually drives navigation for all 20 routes. This
is a second concrete example (after §A.2's decorator and §A.3's dead-wrapper
incident) of `_context/CODE-MAP.md` being stale in a specific, checkable way; not
every doc claim in the repo is wrong, but none should be trusted without a fresh
`grep -n`, exactly as the file's own frontmatter warns.

### A.4c Three independent `computeMarketHealth` implementations (responsibility-matrix DUP)

1. `js/aio-macro-tech.js:124` — legacy base implementation (defer-order position 2).
2. `js/aio-ui.js:5091-5094` — legacy decorator that wraps #1 at its own module-eval
   time and adds Magnificent-7/sector-breadth fields (see §A.2).
3. `src/domain/market/health.js:74 export function computeMarketHealth({quotes,
   spxMA, spxATH})` — a **third**, independent, pure-domain native implementation
   (`MARKET_HEALTH_MODEL_VERSION = 'market-health.v2'`), with its own copies of
   the Magnificent-7 (`MARKET_HEALTH_LEADERS`) and sector-ETF
   (`MARKET_HEALTH_SECTORS`) constant lists — the same symbol lists #2 hand-rolls
   inline, now declared a second time as frozen exports.
`src/data/runtime-readers.js:647` calls `root?.computeMarketHealth?.(...)` (the
*legacy* global, i.e. #1+#2 composed) as its own fallback before falling back to
a passed-in `health` value — so even native's own runtime-reader layer prefers
reading the legacy composed function over importing its sibling
`src/domain/market/health.js` directly. Three implementations, one of which is
architecturally "correct" (pure domain module) and is the least-used at runtime.

### A.4d Factor ranking — native-first with a live legacy fallback (managed DUP, not blind duplication)

`src/domain/screener/factor-ranks.js:359 export function computeFactorRanks(...)`
(`FACTOR_RANKS_MODEL_VERSION = 'factor-ranks.v6'`) is the native pure model.
`js/aio-data.js:15468 function _aioComputeFactorRanks()` is a **separate legacy
implementation** still live in the codebase — but its three call sites
(js/aio-data.js:1858, 15999, 16759) all guard it, e.g. line 16759:
`if (typeof _aioComputeFactorRanks === 'function' && !db.some(s => s.rank !=
null)) { ... }` — i.e. legacy only runs when native hasn't already populated
ranks. This is a *managed* duplicate (explicit precedence, not a race), unlike
§A.2/§A.3's accidental-shadowing patterns, but it is still two independently
maintained ranking engines rather than one.

### A.4e Market session / trading-calendar — two independent, single-year-hardcoded calendars

`js/aio-core.js:22888-22926` hardcodes `US_HOLIDAYS_2026` and `US_HOLIDAYS_2027`
arrays with a `_US_HOLIDAYS_MAP` keyed by year that falls back to the 2026 list
for any other year (`js/aio-core.js:22943`). Independently,
`src/ai/time/market-session.js:8 export const US_REGULAR_CALENDAR_2026 =
Object.freeze({...})` hardcodes only 2026. Neither file imports the other's
calendar; both will silently go stale for 2028+ unless hand-updated in two
places, and the legacy fallback-to-2026 behavior means a 2028 run wouldn't even
fail loudly — it would just quietly apply the wrong year's holiday dates.

### A.5 Route-ownership ground truth (`architecture/route-owners.json`, generated + CI-measured, spot-checked in this session)

20 routes total. **lifecycleOwner = native and rendererOwner = native for all
20** (0 legacy renderer routes) — but this only means the DOM *mount points* are
native; it says nothing about chart or narrative ownership, which are tracked as
separate columns: **chartOwner = native for only 8/20** routes (breadth,
sentiment, technical, macro, fxbond, themes, portfolio, ticker — the rest are
still legacy chart producers or not-applicable), **narrativeOwner = native for
only 2/20** (sentiment, theme-detail). Only **5/20 routes are `fullNativeOwner`**
(sentiment, principles, masters, atlas, guide) — i.e. 15 of the 20 "native"
routes still have at least one legacy-owned surface (chart and/or narrative)
feeding into what looks, at the renderer level, like a fully native page. Spot
check: `src/ui/pages/analysis.js:336,341` does instantiate
`new ChartConstructor(...)` for the `technical` route (consistent with its
chart:native status); no equivalent chart-construction call was found for `home`
in `src/ui/pages/analysis.js` (consistent with its chart:legacy status).
