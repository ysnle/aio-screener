# AIO Screener — Frontend Runtime Architecture Audit

Scope: `C:\projects\AIO` local working tree (v56.55, unreleased) vs. live site
https://ysnle.github.io/aio-screener/ (v56.33, observed 2026-09-27). All metrics below
are either static counts from the repo (reproducible with the node scripts described
inline) or live browser measurements taken with the built-in Browser tool against the
production URL. Anything not directly measured is marked **unverified**.

---

## 1. Boot path & payload

### 1.1 What the live site actually loads on first visit (measured)

Live URL loaded, `#home` route, cold `preview_start` navigation. Read via
`performance.getEntriesByType('resource'/'navigation')`.

| Metric | Value | Source |
|---|---|---|
| Total resource entries on initial load | 202 | Performance API |
| `<script>` resource entries | 138 | Performance API |
| `fetch()` resource entries | 88 | Performance API |
| Total decoded bytes (JS+JSON+CSS, all resources) | ~12.08 MB | `decodedBodySize` sum |
| Legacy `js/*.js` script requests | 5 (all deferred, all fetched) | network log |
| Legacy `js/*.js` decoded bytes | ~761 KB | Performance API |
| Native `src/**/*.js` ESM module requests on `#home` alone | **130 separate HTTP requests** | network log |
| Native `src/` decoded bytes | ~1.14 MB | Performance API |
| Third-party CDN scripts (Chart.js, DOMPurify, lightweight-charts) | 3 | network log |
| `public-data/*.json` fetched at boot | 11 files | network log (see 1.2) |
| `domContentLoaded` | ~449 ms | Navigation Timing (fast connection, warm DNS) |
| Console errors on boot | 422×3, 403×6, 401×1 (third-party proxy/API failures) | `read_console_messages` |

**Finding (Critical) — boot fires ~60+ third-party network calls unrelated to the requested route.**
On the `#home` route alone, the app fires, in addition to the 11 first-party
`public-data/*.json` files: CoinGecko (3 calls), 8+ RSS feeds each retried through
**up to 4 different CORS-proxy fallbacks in sequence** (`aio-proxy.zmfhd007.workers.dev`
→ `api.allorigins.win/raw` → `api.allorigins.win/get` → `api.codetabs.com/v1/proxy`),
Yahoo Finance quote/chart endpoints (9 symbols, proxied), stooq.com CSV endpoints,
open.er-api.com / exchangerate-api.com FX, and CNN Fear & Greed. Evidence: raw fetch
URL list captured live (see network log, 88 fetch entries, of which ~55 are third-party
proxy/data calls fired at boot). Several of these visibly fail (401/403/422 in console).
Root cause: the legacy home-page boot sequence (`js/aio-core.js`/`js/aio-data.js`)
kicks off every "live market color" widget's fetch unconditionally at page load rather
than on-demand or after a route/visibility gate, and each fetch has its own
independent proxy-fallback chain with no shared circuit breaker — a single flaky
CORS proxy multiplies into 3-4x the request volume per feed. Impact: wasted battery/
data on mobile, longer time-to-quiet-network, a visible burst of console errors on
every load, and quota pressure on the shared free-tier proxies for only ~5 users.

**Finding (High) — the "native ESM, no bundler" decision costs ~130 HTTP requests before a single business feature loads.**
`src/app/bootstrap.js` has 81 static `import` statements and only 20 dynamic
`import()` calls (one per lazy route, see §3). Because ES module static imports form
one transitively-resolved graph, everything reachable from those 81 top-level imports
downloads on every visit regardless of route — this includes the **entire AI-chat
orchestration subsystem** (`src/ai/orchestrator/*`, `src/ai/analysis/{company,sector,
technical,macro-fx,causal}.js`, `src/ai/research/*`, `src/ai/intent`, `src/ai/entity`,
`src/ai/response/*`, `src/ai/policy/*` — 20+ files) even for a user who never opens
AI chat. Only the 20 route **page UI** modules are behind `import()` (confirmed:
`grep -c "import("` in `bootstrap.js` = 20, matching `route-owners.json`'s
`lazyLoadedRoutes: 20`). So "lazy routes" in the architecture docs is true only for
the page-shell module, not for the domain/AI graph it depends on. HTTP/2 multiplexing
hides some of this cost on a fast connection (measured `domContentLoaded` ≈ 449ms here),
but on high-latency/mobile connections 130 round-trips (even small ones) is a real
tax, and it will only grow as `src/` grows — there is no bundling step to amortize it.

### 1.2 Data payload fetched at boot (measured, decoded bytes)

| File | Decoded size | Fetched at boot on `#home`? |
|---|---|---|
| `public-data/screener.json` | 1,596,605 B (1.6 MB) | Yes |
| `public-data/history.json` | 1,777,373 B (1.7 MB) | Yes |
| `public-data/telegram-digest.json` | 1,027,582 B (1.0 MB) | Yes |
| `public-data/sec-fundamentals-summary.json` | 915,029 B (0.9 MB) | Yes |
| `public-data/screener-universe.json` | 105,130 B | Yes |
| `public-data/data.json` | 111,520 B | Yes |
| `public-data/user-research-digest.json` | 78,407 B | Yes |
| `public-data/reconciliation-status.json` | 63,331 B | Yes |
| `public-data/market-snapshot.json` | 14,059 B | Yes |
| `public-data/operator-note.json` | 1,236 B | Yes |
| `public-data/model-validation-status.json` | 825 B | Yes |
| **Total confirmed at boot** | **~5.69 MB** | |
| `public-data/sec-fundamentals.json` (on disk, repo) | 32,084,196 B (32 MB!) | **Not observed in the boot fetch list** — appears to be fetched on-demand elsewhere (unverified which route), but its existence at 32 MB in the same directory as boot-fetched files is a latent risk if any code path pulls it eagerly. |

This confirms the task brief's suspicion exactly: `screener.json` (1.6 MB),
`history.json` (1.7 MB) and `telegram-digest.json` (1.0 MB) are all fetched
unconditionally on first paint of the home route, not lazily per the route that
actually needs them (e.g. `telegram-digest.json` is briefing/sentiment content,
`sec-fundamentals-summary.json` is fundamentals content — neither is home-route data).
**Finding (High)**: ~5.7 MB of JSON is pulled before the user has chosen a route,
on top of ~1.9 MB of JS. This is the dominant boot cost, larger than all JS combined.

### 1.3 Script loading order / blocking (index.html, local v56.55)

```
<link rel="preload" as="script" href="./js/aio-core.js">   (+ data/ui/chat, + 2 CDN libs)
<script src="./js/aio-workspace.js" defer></script>
<script src="./js/aio-macro-tech.js" defer></script>
<script src="./js/aio-kr-data.js" defer></script>
<script src="./js/aio-pages.js" defer></script>
... (13k lines of inline <script> and markup between) ...
<script id="aio-chart-cdn" src="chart.js@4.4.0" ... async></script>
<script src="dompurify@3.0.9" ... async></script>
<script src="lightweight-charts@4.2.0" ... async></script>
<script src="./js/aio-core.js" defer></script>
<script src="./js/aio-data.js" defer></script>
<script src="./js/aio-ui.js" defer></script>
<script src="./js/aio-chat.js" defer></script>
<script src="./js/aio-glossary.js" defer></script>
<script type="module" src="./src/app/bootstrap.js"></script>
```

All 9 legacy files use `defer` (correct — non-blocking, execution order preserved),
and the ESM entry uses the module default (also deferred). `runtime-script-order.json`
documents that this **exact order is load-bearing**: e.g. P1135 records a real incident
where an extracted file loaded after `aio-ui.js` referenced a global that didn't exist
yet, causing a silent `ReferenceError` that killed the rest of the file — caught only
by a real-browser check, not by 1,133 passing headless tests. This is strong evidence
that script order in a 9-file, `window`-global-sharing architecture is a standing
fragility, not a one-off bug.

**Finding (Medium) — preload/integrity mismatch, live-observed.** Console on the live
site: *"A preload for 'chart.js@4.4.0/...' is found, but is not used due to an
integrity mismatch"* — same for dompurify and lightweight-charts, on every load. The
`<link rel=preload>` tag's SRI hash and the actual `<script>` tag's SRI hash (or the
resolved CDN response) have drifted out of sync, so all three preloads are silently
wasted (browser fetches twice, or ignores the preload benefit entirely). Root cause:
version/hash pairs are hand-maintained in two places in `index.html` (`preload` block
near line 44-46 and `<script>` tags near line 13090-13094) with no single source of
truth or CI check tying them together.

### 1.4 Service worker (`sw.js`, 15,188 bytes, v56.55)

- Strategy: explicit **network-first** for shell + two tiers of data (`DATA_URL_PATTERNS`
  for third-party live quotes/proxies, `CORE_DATA_URL_PATTERNS` for the 6 core
  first-party JSON artifacts with separate TTL), falling back to cache on network
  failure. This is a reasonable strategy for a live-data screener (never serve stale
  quotes as if current) and the file's own comments show real incident-driven fixes
  (P1112, P1142, P1173 — removing cache-pattern entries nothing ever fetches, adding
  patterns for artifacts that had no offline fallback). This is evidence of iterative,
  reactive hardening rather than an upfront design — functional, but grown organically.
- `SW_VERSION`/`SW_BUILD` are hand-set constants (`'v56.55'`, ISO timestamp) that must be
  kept in sync with `version.json`/`APP_VERSION` by convention/CI, not by import — a
  manual-sync point flagged in the file's own comments as "R1 7th sync point".
- Precache list (`CRITICAL_SHELL_ASSETS`) is deliberately bounded to 10 entries
  (documented reasoning: keep atomic `cache.addAll` reliable, avoid a growing list as
  `src/` modules are extracted) — the ~130 `src/*.js` modules are NOT precached, only
  cached opportunistically after first request via a path-regex rule
  (`RUNTIME_SHELL_PATH_RE`). This means a first-time offline visit before any online
  visit has an incomplete module cache; documented as acceptable since "index.html
  requests every runtime script on every load" (i.e. relies on eager-loading behavior
  from §1.1 to warm the cache — the two designs are coupled).
- **Finding (Low) — inconsistent cache-busting query params.** Live network log shows
  `data.json?t=29841619`, `reconciliation-status.json?t=29841619`,
  `telegram-digest.json?t=497360`, `history.json?t=497360`,
  `operator-note.json?t=5968323`, `user-research-digest.json?v=v56.33`, while
  `screener.json`, `screener-universe.json`, `sec-fundamentals-summary.json`,
  `model-validation-status.json`, `market-snapshot.json` carry **no cache-buster at
  all** and rely purely on the SW's network-first fetch + `Cache-Control`. Three
  different cache-busting conventions (`?t=<epoch-ish>`, `?v=<version>`, none) are in
  use simultaneously for files in the same directory with the same freshness
  requirements — this is a correctness inconsistency (not necessarily a bug, since
  network-first fixes staleness anyway) but is a maintenance smell suggesting these
  fetch call sites were added independently over time without a shared data-loading
  helper.

---

## 2. Code organization

### 2.1 Global namespace pollution (measured across `index.html` + all `js/*.js` + all `src/**/*.js`)

| Metric | Count | Note |
|---|---|---|
| Distinct `window.X = ...` global names | **753** | regex `window\.[A-Za-z_$][\w$]*\s*=` across all files |
| Total `window.X = ` assignment sites | **1,026** | many names assigned from more than one file |
| `.innerHTML = ` / `+=` sites | **372** | DOM injection sinks |
| `addEventListener(` calls | 190 | |
| `removeEventListener(` calls | 41 | ratio 4.6:1 — most listeners are never explicitly removed |
| `setInterval(` calls | 2 | low, not a major leak vector by count |
| Inline `onclick="..."` HTML attributes | 5 | small, but still present |

Per-file breakdown (top contributors):

| File | Lines | `window.X=` | `.innerHTML` | `addEventListener` |
|---|---|---|---|---|
| `js/aio-core.js` | 28,170 | 404 | 97 | 41 |
| `js/aio-data.js` | 16,880 | 236 | 30 | 13 |
| `js/aio-tests.js` | 9,497 | 110 | 6 | 1 |
| `js/aio-chat.js` | 9,259 | 105 | 47 | 9 |
| `js/aio-ui.js` | 7,646 | 77 | 84 | 39 |
| `js/aio-workspace.js` | 3,033 | 28 | 32 | 15 |
| `js/aio-kr-data.js` | 3,235 | 18 | 23 | 4 |
| `js/aio-pages.js` | 3,393 | 16 | 36 | 6 |
| `js/aio-macro-tech.js` | 1,211 | 8 | 14 | 2 |
| `src/app/bootstrap.js` | 938 | 21 | 0 | 2 |
| `index.html` (inline) | 13,358 | 3 | 0 | 6 |

The repo's own `architecture/baseline.json` (scoped only to `index.html` + 4 of the 9
legacy files) separately records **1,097 explicit window writes, 409 HTML sinks, 187
direct storage calls, 42 direct fetches** as of v53.97 — a different regex/methodology
than the one used here but the same order of magnitude, and notably it does not even
cover `aio-pages.js`, `aio-workspace.js`, `aio-kr-data.js`, `aio-macro-tech.js`,
`aio-glossary.js`, or `src/` — i.e. the project's own structural-check gate is scoped
to less than half the runtime files that actually exist.

**Finding (Critical) — 753 distinct globals is the architecture, not an accident.**
`architecture/global-ownership-baseline.json` documents this explicitly: it defines a
CI rule (`ci-structural-check.mjs`) that fails only if a *function-valued* global gets
a second competing implementation, and separately **freezes a list of 10 "frozen state
owners"** (`_breadth5`, `_currentTickerId`, `_deepChartInstances`, etc.) that are
*known* to be written from multiple files (`aio-data.js`, `aio-ui.js`, `aio-core.js`,
`aio-chat.js` each write `window._currentTickerId` when their own surface changes
selection) — frozen "as visibility, not approval," with convergence tracked as a
backlog item (QA-EXHAUST-95) rather than fixed. The file also documents a real
incident (P1132): `aio-ui.js` declared `function _fetchYahooChartData` while
`aio-data.js` assigned `window._fetchYahooChartData` — which one won depended on
script load order, the loser was silently dead code, and reordering during an
extraction flipped which one ran, silently changing default arguments for every
caller; no static gate caught it, only a real-browser headless run did. This is a
first-hand account of the exact failure mode global-namespace sharing produces at
this scale.

### 2.2 Duplicated logic between legacy `js/` and `src/`

- `computeTradingScore(mode, opts)` — the core scoring algorithm — is defined **only**
  in `js/aio-core.js:23621`. `src/legacy/compatibility-facade.js:302`
  (`readTradingScoreInputs`) does not call it; instead it **independently re-derives**
  much of the same decision evidence (VIX/VVIX/SPX/DXY/WTI quotes with its own
  live-vs-snapshot fallback logic, its own moving-average freshness window, its own
  news-sentiment/news-risk aggregation) by reading `root._liveData`, `root.DATA_SNAPSHOT`,
  `root.AIO.getCanonicalMetric`, `root.computeNewsSentimentScore` off the legacy
  `window`. **Finding (High)**: this is not a clean read-only adapter — it is a second,
  parallel implementation of "assemble the inputs the trading score needs," coupled to
  legacy globals by name, that must be kept in sync with `computeTradingScore` by hand.
  If `aio-core.js`'s scoring inputs change, nothing forces `compatibility-facade.js` to
  be updated to match; a static grep found no back-reference from the facade to the
  actual scoring function.
- Similarly, `factorRank`-style logic exists in both `js/aio-data.js`/`js/aio-ui.js`
  and is *read* (not reimplemented from scratch) via `src/legacy/compatibility-facade.js`
  and `src/app/bootstrap.js` — same bridge pattern, same coupling risk.
- `SCREENER_DB` (`js/aio-data.js:16`–`~966`, ~950 lines) is a **hardcoded array of
  ticker/name/sector/index objects, some carrying multi-sentence dated investment
  "memo" text** (e.g. NVDA's memo is a full paragraph about GPU/hyperscaler capex
  dated `[2026-08-09 REFERENCE]`), committed directly into source code and versioned
  alongside `public-data/screener-universe.json` (105 KB), which is described in the
  file's own `SCREENER_DB_META.note` as the authoritative "static universe" while
  `screener.json` supplies runtime enrichment. **Finding (Medium)**: editorial content
  (analyst-style memos) living inside a 16,880-line JS file, rather than in the data
  pipeline/JSON artifacts the rest of the system already uses, means every memo edit
  requires a JS deploy, cannot be validated by the JSON-schema tooling that presumably
  covers `public-data/*.json`, and bloats a file already flagged by the project's own
  `decomposition-hotspots.json` ratchet.
- `DATA_SNAPSHOT` (`js/aio-core.js:22567`) is another large hardcoded fallback-data
  object (manual reference values, per-field timestamps) serving as the "last known
  good" seed when live fetches fail — appropriate as a resilience mechanism, but it
  is (by the project's own console warnings, observed live: *"한국 소비자물가 54일
  경과... DATA_SNAPSHOT._fieldTs.kr_cpi 업데이트 필요"*) **manually curated and already
  54 days stale on the field the live console is warning about**, at the moment of
  this audit. This is a live-observed data-freshness defect, not a hypothetical one.
- `CHAT_CONTEXTS` (`js/aio-chat.js:1483`) — another hardcoded content object merged
  onto `window.CHAT_CONTEXTS` — same "content embedded in code" pattern a third time.

**Root cause across all three**: there is no single "static reference content" data
layer with its own schema/validation/versioning; each subsystem (screener universe,
market snapshot fallback, chat context) invented its own hardcoded-JS-object
convention independently, at different times, at different file locations.

### 2.3 Monster functions / dead code / inline handlers

- `js/aio-core.js` (28,169 lines) is the single largest file and, per
  `decomposition-hotspots.json`, has had its line-count ceiling **raised twice**
  (most recently v56, 28,000→28,200, "the previous ceiling sat one line above the
  file") rather than the file being decomposed — the project's own tracking file
  states this pattern by name: a "ratchet" that was previously "a wall that blocked a
  one-line correctness fix instead of a ratchet" (P1151-1155). This is longitudinal,
  first-party evidence that the dominant response to file growth has been raising the
  cap, not splitting the file.
- 5 inline `onclick="..."` HTML attribute handlers remain (mostly in `aio-core.js`) —
  a small residual of an older DOM-authoring style, inconsistent with the
  `addEventListener`-based majority of the code.
- `js/aio-tests.js` (9,496 lines, 728 KB, 836 in-browser tests per its own header
  comment) is **not referenced anywhere in `index.html`** (confirmed: zero matches for
  `aio-tests` in `index.html`, only in the CI cache and the file itself) — **it does
  not ship to production users.** This is good: the task's concern ("check whether
  tests ship to production") is unfounded for this file; it is loaded only by the
  Playwright-driven headless harness (`scripts/ci-headless-tests.mjs`) during CI, which
  serves the repo locally and calls `AIO.loadTests()`/`AIO.runTests()` in a real
  browser context. This is however still a 9,500-line, 728 KB single test file with no
  test framework (custom assertions, custom runner) — see §6.

---

## 3. The strangler migration — is it converging?

`architecture/route-owners.json` (v56.55) reports, across the 20 registered routes:

| Surface | Native routes | Legacy routes |
|---|---|---|
| `lifecycleNative` | 20 / 20 | 0 |
| `rendererNative` | 20 / 20 | 0 |
| `dataNative` | 20 / 20 | 0 |
| `chartNative` | 8 / 20 | 12 (still legacy Chart.js/DOM chart code) |
| `narrativeNative` | 2 / 20 | 18 |
| **`fullNativeOwner`** (every surface native or N/A, legacy writer removed) | **5 / 20** (`sentiment`, `principles`, `masters`, `atlas`, `guide`) | **15 / 20** |

**Finding (High) — the headline "20/20 native" figures are for the shell surfaces
(lifecycle registration, renderer wiring, data-read wiring), not for actual ownership.**
Only 5 of 20 routes (25%) have their legacy writer fully removed
(`fullNativeOwner`). The other 15 routes have a native lifecycle/renderer/data
*registration* that still sits on top of, or beside, legacy code for charts and
narrative text — i.e. `src/` has added a parallel layer for most routes without yet
retiring the legacy implementation underneath. The project's own README
(`architecture/README.md`) states this directly: *"`fullNativeOwner` is therefore the
completion signal; lifecycle/renderer counts alone are not"* and *"`window.AIO_ARCH`
is still a transitional compatibility API, not a certified minimal read-only facade.
Native runtime readers also still adapt legacy globals."* This is an unusually honest
self-assessment in the repo itself — the audit's own conclusion (parallel layer, not
yet net deletion) matches what the project's maintainers already believe.

**Is legacy code shrinking?** `js/aio-core.js`'s line-count ceiling was *raised*, not
lowered, as recently as v56 (2026-09-20), one version-train before the current
HEAD. `src/legacy/compatibility-facade.js` (586 lines) and
`src/legacy/market-snapshot-bridge.js` (57 lines) exist specifically to let `src/`
read legacy globals rather than forcing legacy code to be deleted — their own
`facadePolicy` note in `decomposition-hotspots.json` states "bounded compatibility
facade only; no permanent duplicate primary writer," i.e. the project is aware of and
actively guarding against the facade becoming a second permanent implementation, but
that guard is a documentation contract enforced by a custom CI script
(`ci-decomp-hotspot-check.mjs`), not a structural impossibility.

Net assessment: **the migration is real (route lifecycle/data/render for all 20 routes
is genuinely native, `src/` is a real ~34K-line codebase with domain/data/state
separation and a working disposer-based lifecycle system — see §4), but by the
project's own completion metric it is 25% converged after apparently multiple
release-cycles of work, and the legacy side (`js/aio-core.js` in particular) is still
growing, not shrinking.** For a 5-user internal tool, carrying two parallel
implementations (legacy globals + native facade reading those same globals) for 75%
of routes is a maintenance cost with no user-facing benefit until routes actually
reach `fullNativeOwner` and the legacy writer is deleted.

### 3.1 Is native ESM (no bundler) the right call at this size? (ADR-0002)

`architecture/adr-0002-vite-typescript-and-state-access.md` is explicit that the
Vite/TypeScript decision is **deferred, not decided** — "do not treat the presence of
this file as that decision having been made." The only accepted content is a
state-store performance fix (avoid `structuredClone` on every dispatch). Given the
measured cost of the no-bundler decision (§1.1: 130 HTTP requests for `src/` alone on
a single route, no minification/tree-shaking, no way to lazy-load the AI subsystem
separately from page shells because there's no bundler to draw that boundary
automatically), and given `src/` has already grown to ~34,000 lines across ~130+
files, this audit's assessment is that **the no-bundler decision has passed its
useful window**: it made sense to prove the vertical-slice pattern with zero build
tooling risk early on, but it is now the direct cause of the request-count problem in
§1.1, and TypeScript would have caught the exact kind of "which window global wins"
bugs (`P1132`, `P1135`) that `global-ownership-baseline.json` and
`runtime-script-order.json` show the project has hit and had to build custom static
analysis (`ci-structural-check.mjs`) to catch after the fact.

---

## 4. State management

- `src/state/store.js` (53 lines): single store, `dispatch`/`getState`/`subscribe`.
  Per ADR-0002, `getState()` returns the **live state reference with no clone** (a
  2026-07-19 change made specifically for performance — the original
  clone-on-every-read/write design didn't scale to `bootstrap.js`'s `aio:liveQuotes`
  handler, which fans out to 6 independent `orchestrator.sync()` calls, each
  potentially dispatching). Mutation safety is enforced only by an opt-in `devMode`
  recursive `Object.freeze`, off by default in production — i.e. **in production,
  nothing prevents a subscriber from mutating live state in place**; the safety net
  is a dev-only tripwire, a documented, deliberate trade-off (ADR-0002 §Consequences)
  rather than an oversight.
- `src/app/lifecycle.js`: a proper disposer-registry (`createResourceBag`) — `add()`/
  `dispose()` with reverse-order teardown and per-disposer error isolation. This is a
  legitimate improvement over the legacy side, which has **no equivalent** disposal
  mechanism for its 190 `addEventListener` calls (only 41 `removeEventListener` calls
  exist across the whole legacy+native codebase, a 4.6:1 ratio) — legacy DOM listeners
  are added once per script load and never explicitly torn down, which is low-risk
  only because there is no legacy-side SPA-style remount (the legacy shell doesn't
  re-render whole sections repeatedly); it would become a real leak source if the
  legacy code were ever made to re-mount on route change.
- Event bus: 39 distinct `aio:*` custom event names found across the codebase (e.g.
  `aio:liveQuotes`), referenced from `_aioPageBus` call sites in **9 of 11** measured
  files (both legacy and native), i.e. the event bus is genuinely the shared
  cross-layer communication mechanism, not a native-only convenience — reasonable
  design for a strangler migration, but it means `window`-scoped custom events are a
  second global surface (alongside the 753 `window.X` properties) that both sides
  depend on and that has no discoverable, typed contract (`unverified`: whether any
  schema/TypeScript-like typing exists for event payloads — none was found in a
  `src/data/contracts/*` scan aside from data-shape contracts, not event contracts).
- localStorage: 144 direct `getItem`/`setItem` call sites scattered across 8 of the
  9 legacy files (no central storage module on the legacy side); the native side has
  a dedicated `src/storage/` directory (`repository.js`, `vault.js`,
  `screener-runs.js`, `migrations.js` — only 19 lines, i.e. minimal/early-stage) and
  `src/platform/storage.js` as a thin wrapper. **Finding (Medium)**: legacy
  localStorage access has no schema versioning visible in `js/*.js` (grep for
  "migration" in legacy files returned nothing) — if a stored shape ever needs to
  change, there is no evident mechanism to migrate a user's existing
  `localStorage` data, only the new `src/storage/migrations.js` (19 lines, presumably
  covering only native-side keys).
- Chart.js lifecycle: 21 `new Chart(` vs 24 `.destroy()` call sites (static count,
  not runtime-verified) — roughly balanced and slightly favors destroy-before-create,
  a reasonable static signal against leaks, though this does not prove runtime
  correctness (e.g. a destroy on the wrong instance, or a path that creates without a
  matching destroy under a specific condition, would not show up in a static count).

---

## 5. UX/perf/accessibility — structural observations

- 20 routes, hash-based routing (`#home`, `#signal`, etc., confirmed by the live tab
  title `.../aio-screener/#home`), single `index.html` shell — standard SPA pattern
  for a static host; reasonable given GitHub Pages has no server-side routing.
  `src/app/router.js`'s `createLazyPage` cleanly separates "route registered" from
  "module loaded" from "page mounted," with a documented contract ("a disposed route
  scope can never mount after its import settles") — this is solid, defensive code,
  better than typical hand-rolled routers.
- KR/US data mixing: confirmed present at the fetch layer (Yahoo Finance `^KS11`/
  `^KQ11`/`KRW=X` alongside `^GSPC`/`^VIX`/US tickers, all through the same proxy
  chain) — no separate loading path or lazy boundary between KR and US data observed;
  both fetch in the same boot burst (§1.1). `unverified`: whether the UI itself
  visually/logically separates KR and US sections well; that requires a rendered-page
  review beyond this audit's scope.
- i18n: the app is Korean-first and, from all files sampled, hardcodes Korean UI
  strings directly in template/JS code (no separate locale/string-table files found
  in `js/` or `src/` during this audit) — `unverified` as exhaustive, but no
  `i18n`/`locale`/`strings.json`-style structure was found in any directory listing.
  This is fine for a single-language 5-user tool but would block localization without
  a full string-extraction pass later.
- Accessibility: out of scope for deep review here; one structural signal — 5 inline
  `onclick` handlers and 372 `innerHTML` sinks are both accessibility/security-adjacent
  patterns (inline handlers bypass consistent keyboard/focus handling that a proper
  event-delegation layer would centralize; `innerHTML` at this volume needs consistent
  sanitization — DOMPurify is loaded globally via CDN, `unverified` whether all 372
  sink call sites route through it or only some do).

---

## 6. Test code

- **`js/aio-tests.js` does NOT ship to production** (confirmed, §2.3) — zero
  references in `index.html`. Good news relative to the task's stated concern.
- Testing is not built on a standard framework. There is no Vitest, no Jest; the only
  test-adjacent `devDependency` in `package.json` is `playwright` (^1.48.0), used
  exclusively as a **headless browser driver**, not as a test runner in the
  Playwright-test sense. The actual test *assertions* live in `js/aio-tests.js`
  (836 tests per its own header comment, custom `AIO.runTests()` API) and are executed
  by `scripts/ci-headless-tests.mjs`, which spins up a local static server, loads
  `index.html` in a real Chromium via Playwright, and calls into the page's own test
  runner — a legitimate way to get real-browser coverage for legacy global-dependent
  code that can't easily run in Node, but it means test failures/output are entirely
  custom-formatted, not integrated with any standard reporter/CI annotation tooling.
- `scripts/ci-esm-core-unit-check.mjs` (2,949 lines) is a **second, separate, custom
  Node-based unit-test harness** for the native `src/` ESM modules — also not a
  framework, hand-rolled.
- There are **198 separate `scripts/ci-*.mjs` files** in the repo (e.g.
  `ci-ai-chat-reliability-contract-check.mjs`, `ci-atlas-browser-check.mjs`,
  `ci-baseline-contract-check.mjs`, `ci-boot-interaction-check.mjs`, and 194 more) —
  each apparently a bespoke, single-purpose gate script rather than a shared test
  suite with tagged/grouped test cases. **Finding (Medium)**: this is a very large,
  bespoke CI-tooling surface (198 files) for a 5-user tool; every one of these is
  itself unversioned "test code" that must be maintained, and the project has already
  had to build meta-tooling (`decomposition-hotspots.json`'s ceiling/ratchet system,
  `global-ownership-baseline.json`'s frozen-owner list) specifically to keep its own
  custom gates honest — a sign that ad hoc gate-script proliferation has become its
  own maintenance burden, layered on top of (not replacing) the actual application
  code's complexity.
- Testing pyramid shape today: **0% conventional unit tests (Vitest/Jest), a large
  flat layer of ~836 custom in-browser assertions + 198 custom CI contract scripts +
  1 custom Node-based ESM unit harness, 0 identified conventional E2E test files**
  (Playwright is present only as a browser driver for the custom harness, not as
  Playwright Test specs) — inverted from a standard pyramid: heavy on custom
  integration-shaped checks, no fast unit layer, no true E2E layer.

---

## Findings summary (by severity)

| # | Severity | Area | Finding |
|---|---|---|---|
| 1 | Critical | Boot | Home route fires ~55+ third-party fetches at load, several through 3-4 stacked CORS-proxy fallbacks; live console shows 401/403/422 errors on every load |
| 2 | Critical | Globals | 753 distinct `window.*` globals across 11 runtime files (excluded from the project's own 5-file structural-check scope); documented dual-writer incidents (P1132, P1135) that static/headless gates missed |
| 3 | High | Boot | ~5.7 MB of JSON (screener/history/telegram-digest/sec-fundamentals-summary) fetched unconditionally on first paint regardless of route |
| 4 | High | Boot/Migration | Native ESM layer makes 130 HTTP requests on a single route; only page-shell modules are behind dynamic `import()` — the AI orchestration subsystem (20+ files) is statically bundled into every page load |
| 5 | High | Migration | Only 5/20 routes (25%) are `fullNativeOwner`; 15/20 still depend on legacy chart/narrative code under a native shell; `js/aio-core.js`'s size ceiling was raised, not reduced, at v56 |
| 6 | High | Duplication | `src/legacy/compatibility-facade.js:readTradingScoreInputs` re-derives trading-score inputs independently of `computeTradingScore()` in `js/aio-core.js`, with no enforced sync |
| 7 | Medium | Data-in-code | `SCREENER_DB` (~950 lines of tickers + dated analyst memos), `DATA_SNAPSHOT`, `CHAT_CONTEXTS` are hardcoded JS objects, each invented independently; `DATA_SNAPSHOT` observed live to be 54 days stale on a field the app itself warns about |
| 8 | Medium | Testing | 198 bespoke `ci-*.mjs` gate scripts + 2 custom test harnesses, 0 conventional unit/E2E framework usage |
| 9 | Medium | SW/caching | Preload `<link>` SRI hashes for 3 CDN libs mismatch the actual script tags, wasting all 3 preloads (live-observed console warning); inconsistent cache-busting query conventions across `public-data/*.json` |
| 10 | Low | Lifecycle | 190 `addEventListener` vs 41 `removeEventListener` (4.6:1) on the legacy side, no disposal contract (native side's `lifecycle.js` disposer pattern is not mirrored in legacy code) |
| 11 | Low | Storage | 144 legacy `localStorage` call sites, no schema/migration mechanism visible outside the 19-line native `src/storage/migrations.js` |

---

## How I would build it instead

### Target architecture

1. **Vite + TypeScript**, now — not deferred again. The project has already
   independently reinvented, by hand, several things a bundler+TS gives for free:
   a "which global wins" static checker (`ci-structural-check.mjs`) that TS's module
   system makes structurally impossible; a manual script-load-order contract
   (`runtime-script-order.json`) that ESM `import` resolution + a bundler's module
   graph replaces; and a line-count ratchet (`decomposition-hotspots.json`) to fight
   monolith growth that natural module boundaries + a bundler's per-chunk size budget
   would enforce automatically. Given `src/` is already ~34K lines of real ESM code
   with domain/data/state separation, migrating it into a Vite build is mechanical
   (Vite consumes native ESM directly) — the risk is almost entirely on the *legacy*
   9-file/`window`-global side, which is exactly the part that most needs the forcing
   function TS/bundling provides.
2. **Route-level code splitting via the bundler**, not a hand-rolled `createLazyPage`.
   Keep the good idea (page factories with disposer-based lifecycle) but let Vite's
   `import()`-based chunking actually cut the network graph — including splitting the
   AI orchestration subsystem into its own chunk loaded only when AI chat opens
   (closes finding #4).
3. **No heavy UI framework** — the domain here (data-dense financial dashboards with
   Chart.js, not deeply interactive widget trees) doesn't need React-scale
   reactivity. **Preact or Lit** for new/rewritten route UIs, incrementally, is enough:
   Preact's `htm`/JSX-less mode can even be introduced file-by-file without a full
   rewrite, and it's ~3 KB. Keep `src/state/store.js`'s existing plain
   dispatch/subscribe design (it's already reasonable, ADR-0002's live-reference
   decision is sound) rather than adopting Redux/MobX/etc.
4. **Typed data contracts shared with the pipeline.** `src/data/contracts/*.js`
   already exists conceptually; converting these to TypeScript interfaces/Zod schemas
   and having `scripts/fetch-data.mjs` (the GitHub Actions data pipeline) import the
   *same* schema package to validate what it writes to `public-data/*.json` would
   close the "content quietly drifts stale/wrong-shaped" class of bug this audit found
   live (`DATA_SNAPSHOT.kr_cpi` 54 days stale, self-reported by the app's own console).
5. **Data loaded lazily per route, always.** Move `telegram-digest.json`,
   `sec-fundamentals-summary.json`, `history.json` fetches out of the boot path and
   into the specific route modules (briefing/fundamentals/technical) that actually
   consume them, gated behind the route's `mount()`. Keep only truly home-page-relevant
   data (`market-snapshot.json`, `data.json`) in the initial fetch set. This alone
   removes ~4.7 MB from the mandatory boot payload.
6. **Consolidate the proxy-fallback logic into one shared, rate-limited fetch helper**
   with a single fallback chain (not independently re-implemented per feed), a shared
   circuit breaker (stop retrying a dead proxy for N minutes), and fetch these
   feeds only when the relevant panel is actually visible/mounted, not unconditionally
   at boot (closes finding #1).
7. **Chart.js can stay** (Chart.js 4.x is fine for this use case and is already
   integrated); no reason to switch libraries. `lightweight-charts` is also
   reasonably scoped for candlestick/OHLC views — keep both, just load them per-route
   instead of globally.
8. **Testing pyramid**: adopt **Vitest** for the ~34K lines of `src/` (fast, TS-native,
   replaces the 2,949-line hand-rolled `ci-esm-core-unit-check.mjs` with real
   `describe/it`, coverage reporting, watch mode) and **Playwright Test** (proper specs,
   not a custom driver script) for a small number of true E2E smoke tests per route
   (replacing the 836-test `aio-tests.js` incrementally — port the highest-value
   assertions, retire the rest as legacy code is deleted rather than migrating all 836
   1:1). Fold the 198 bespoke `ci-*.mjs` contract scripts into a much smaller number of
   parameterized checks where they test the same *shape* of thing (e.g. "route X has
   contract Y") rather than one bespoke file per route/feature.
9. **PWA/service-worker strategy**: keep network-first for data, but once route-level
   code splitting exists, precache per-route chunks opportunistically (already close
   to what `sw.js` does for `js`/`src` paths) — no fundamental change needed here,
   just fix the preload/SRI mismatch (#9) and standardize the cache-busting convention
   (#9) as part of the data-contract work in item 4.

### Incremental migration path for a solo owner driving AI agents

This explicitly does **not** propose a rewrite. Sequence, each step keeping the site
live and working on GitHub Pages throughout:

1. **Introduce Vite as a build step with zero behavior change first.** Point Vite at
   `src/app/bootstrap.js` as an entry, output to a `dist/` (or in-place) bundle, keep
   `index.html`'s 9 legacy `<script defer>` tags exactly as-is outside the Vite entry.
   Verify byte-for-byte behavior parity via the existing headless test suite before
   touching anything else. This alone should collapse the 130-request `src/` graph
   into a handful of chunks and is the highest-leverage, lowest-risk first step.
2. **Fix the two cheap, high-value, zero-risk items immediately, independent of the
   bundler work**: (a) the preload/SRI mismatch (§1.3) — just re-sync the two hash
   pairs, one-line-per-library fix; (b) move `telegram-digest.json` and
   `sec-fundamentals-summary.json` fetches out of the unconditional boot path into
   their consuming routes' `mount()` — this is a cut-and-paste move of existing fetch
   calls, not new logic, and removes ~2 MB from every page load immediately.
3. **Convert `src/` to TypeScript incrementally, file-by-file, leaf-first** (start
   with `src/platform/`, `src/data/contracts/`, `src/state/` — the modules with the
   fewest inbound dependencies), using `allowJs`/`checkJs` so partially-migrated trees
   still build. Each converted file is a small, reviewable, independently-shippable
   PR-sized unit an AI agent can execute end-to-end (convert, add types, run Vitest,
   confirm headless gate still passes) without needing to understand the whole system.
4. **Route-by-route: bring each of the 15 non-`fullNativeOwner` routes the rest of the
   way to `fullNativeOwner`, one route per work session, in order of chart/narrative
   complexity (simplest first)**, and *delete* the legacy renderer/chart code for that
   route the same session it's certified native — do not let `fullNativeOwner`-eligible
   legacy code linger "just in case." The project already has the tracking
   infrastructure (`route-owners.json`, `fullNativeOwner` flag) to make each of these a
   clean, verifiable, bounded unit of work — use it as the literal task queue.
5. **Only after `src/` is the majority of runtime code and most legacy chart/narrative
   code is deleted**, evaluate introducing Preact for the *remaining* highest-complexity
   route UIs (likely `screener`, `portfolio`, `ticker` — the routes with the most
   interactive state) rather than a blanket framework adoption; many of the already
   fully-native routes' UI code may not need a framework at all.
6. **Consolidate the 198 `ci-*.mjs` scripts opportunistically**, whenever touching a
   route that has 3+ of them, rather than as a dedicated project — merge same-shaped
   contract checks into a shared checker with per-route config.
7. **Retire `js/aio-tests.js` last**, only as the legacy code it tests is deleted route
   by route in step 4 — this avoids ever having a coverage gap, since each legacy
   assertion becomes obsolete at the exact moment its legacy code is deleted.

This ordering front-loads the two changes with the best risk/reward ratio (bundler
adoption, boot-payload trim) before any code deletion, keeps the site shippable after
every single step (the existing headless/CI gate infrastructure, despite its
proliferation problem, is well-suited to catching regressions during exactly this kind
of incremental migration), and turns the existing `route-owners.json` tracking file
from a progress *report* into the literal backlog.
