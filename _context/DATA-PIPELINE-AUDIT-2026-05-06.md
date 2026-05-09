---
verified_by: codex
last_verified: 2026-05-09
confidence: high
target_version: v49.1
---

# Data Pipeline Audit - 2026-05-06

## Scope

This audit maps the full AIO data workflow from external source connection to final UI rendering:

1. Source/API registry
2. Transport, proxy, timeout, and cache
3. Scheduler and refresh orchestration
4. Validation stores and runtime state
5. Analysis/transformation functions
6. DOM, chart, and event rendering sinks

## Layer Map

| Layer | Primary code | Output / contract |
|---|---|---|
| Source/API | `DATA_APIS`, `AIO_NEWS_SOURCES`, `DATA_SNAPSHOT`, portfolio localStorage | Declares source URLs, optional keys, static fallback values, and user-owned data |
| Transport | `fetchWithTimeout`, `_PROXY_REGISTRY`, `fetchViaProxy`, `AIO_Cache`, `_aioFeedHealth` | Fetches with timeout, proxy fallback, stale cache fallback, and feed backoff |
| Scheduler | `initV20DataEngine`, `REFRESH_SCHEDULE`, `_markFetch`, `_aioRegisterTimer` | Runs phase bootstraps and periodic quote/news/macro/chart refresh with in-flight guards and timer registry visibility |
| Validation/store | `PriceStore`, `MacroStore`, `NewsStore`, `DataHealth`, `_dataSource`, `_quoteTimestamps` | Rejects invalid values, tracks freshness/source metadata, dedupes news, reports health |
| Analysis | `fetchLiveQuotes`, `applyLiveQuotes`, `applyDataSnapshot`, news scoring/classification, risk/portfolio/signal functions, `_aioSafeDiv`, `_aioFiniteNum`, `_aioLRU` | Normalizes upstream values into live data, snapshot fallbacks, scores, indicators, page models, bounded caches, and safe ratios |
| Render | `data-live-price`, `data-live-chg`, `data-snap`, `data-snap-date`, Chart.js/LWC canvases, `aio:liveQuotes` listeners | Pushes normalized values into text, badges, charts, portfolio tables, AI context, and page widgets |

## Runtime Audit API

v48.82 adds the audit API; v48.85 expands render/store semantics for missing percent values; v49.1 adds browser unit-test coverage for state hygiene, timer registry, VIX percentile, DST grace, and Infinity guards:

```js
AIO.getDataPipelineAudit()
AIO.runTests()
```

The returned object includes:

- `layers.sources`: API registry key availability, news source count, live source distribution.
- `layers.transport`: proxy registry, cache stats, RSS/feed health.
- `layers.scheduler`: refresh interval, in-flight status, last ok/error per scheduled task.
- `layers.validationStores`: Price/Macro/News/DataHealth health summaries.
- `layers.state`: `_liveData`, `_dataSource`, `_quoteTimestamps`, `_lastFetch`, and snapshot state.
- `layers.analysis`: required pipeline function presence and freshness audit.
- `layers.render`: active page, page/canvas count, live/snapshot DOM sink counts, missing live binding sample, price/change sink asymmetry samples, chart canvas accessibility gaps, and AIOBus listener counts.

Related console checks:

```js
AIO.getOperationalHealth()
AIO.getDataFreshnessAudit()
AIO.getDataPipelineAudit()
DataHealth.report()
```

## Findings And Guards

| Risk | Status | Guard |
|---|---|---|
| Partial live quote success hides stale fallback | fixed in v48.81 | `AIO.getLiveCoverage().coreOk` gates fallback clearing |
| FRED missing key is reported as success | fixed in v48.81 | Empty/missing FRED responses report warn/error and keep fallback |
| Service worker cache drift | fixed in v48.80 | `SW_VERSION` is synchronized with app version and exposed through SW health |
| Source-to-render lineage is hard to inspect | fixed in v48.82 | `AIO.getDataPipelineAudit()` exposes all major layers in one snapshot |
| Missing percent is normalized as 0% in side quote paths | fixed in v48.85 | `PriceStore`, Yahoo/Naver/Stooq/FX constructors, and render audit preserve `pctMissing` |
| Page listeners/timers accumulate across navigation | fixed in v48.98~v49.1 | `_aioPageBus`, `_aioOnce`, and `_aioRegisterTimer` centralize lifecycle registration |
| Unsafe numerical edge cases reach UI strings | fixed in v48.98~v49.1 | `_aioSafeDiv`, `_aioFiniteNum`, VIX log extrapolation, and fund formatter guards |
| Public RSS/CORS/rate-limit degradation | expected external risk | Proxy registry, stale cache, feed health, and audit warnings make degradation visible |

## Release QA Checklist

Before deploy or GitHub parity review:

1. Run static syntax checks for `js/aio-core.js`, `js/aio-data.js`, `js/aio-ui.js`, `js/aio-chat.js`, `js/aio-tests.js`, and `sw.js`.
2. Confirm R1 version sync: title, badge, `APP_VERSION`, `version.json`, `sw.js`, `_context/CLAUDE.md`, `CHANGELOG.md`.
3. Load the local or deployed app and run `AIO.getDataPipelineAudit()` and `AIO.runTests()`.
4. Confirm `layers.render.livePriceSinkCount > 0`, `layers.render.snapSinkCount > 0`, and `layers.state.liveDataCount > 0` after quote refresh.
5. Treat `status: warn` as acceptable only when the issue list points to known public API/RSS degradation, not missing functions or rejected core prices.
