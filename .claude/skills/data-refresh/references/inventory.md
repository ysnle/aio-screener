# Data Refresh Inventory

Use this reference to locate the requested AIO data surfaces; all categories are required only for a full freshness audit.

## Critical Categories

1. Versioned app data in `version.json`, `sw.js`, cachebusters, and app badges.
2. `DATA_SNAPSHOT` headline market state.
3. Fear & Greed and sentiment values.
4. Breadth arrays and market breadth caches.
5. VIX, HY spread, dollar, rates, and macro time series.
6. Sector and ETF rotation data.
7. Major index and ETF quote fallbacks.
8. Korean market macro and index fallbacks.
9. News source lists and news keyword filters.
10. Telegram/news channel allowlists.
11. Ticker registries, aliases, and known ticker maps.
12. Theme and sub-theme ticker tables.
13. ETF and cross-asset data tables.
14. Fundamental fallback data.
15. Screener rows and public-data artifacts.
16. Chat context numeric snapshots.
17. Technical-analysis constants and preset thresholds.
18. Options and put/call fallback data.
19. Portfolio sample or preset data.
20. Static UI labels that include dates, versions, or market values.
21. Generated files under `public-data/`.
22. Workflow docs that describe current data surfaces.

## Staleness Table

Every refresh must produce or internally maintain a table with:

| Field | Meaning |
|-------|---------|
| category | One of the 22 categories above |
| file/surface | Specific file, object, function, or generated artifact |
| current value/date | Value before refresh |
| target value/date | Value after refresh or reason unchanged |
| source | Source used, or local artifact when offline |
| status | OK, UPDATED, BLOCKED, or DEFERRED |

Mark a category CRITICAL when stale data is user-visible, changes model behavior, or affects a headline signal.

## Static Databases (hand-curated, refresh on cadence — P1081/R605)

These are configuration, not observations: symbol/name/sector membership, theme
constituents, official calendars, and manual policy references. They do not
refresh themselves — the daily data-refresh run must check each item below and
update it or record an explicit BLOCKED/DEFERRED reason. Volatile values
(prices, yields, quotes) must never be committed here, not even in comments.

| # | Database | File/surface | Sync command / gate | Cadence |
|---|---|---|---|---|
| S1 | `SCREENER_DB` identity universe (sym/name/sector/index/memo) | `js/aio-data.js` → mirror `public-data/screener-universe.json` | `node scripts/sync-screener-universe.mjs` + `--check` in `ci-data-pipeline-contract-check.mjs` (R271) | Review membership monthly; `staleAfterDays:30` WARN, `replaceAfterDays:90` hard limit |
| S2 | `KR_STOCK_DB` KR code→name/sector/themes | `index.html` (`var KR_STOCK_DB`) | `ci-static-data-contract-check.mjs` (no static price/mcap rows) | Review constituents monthly; delistings/new listings |
| S3 | `KR_THEME_MAP` theme→codes | `index.html` (`var KR_THEME_MAP`) | `ci-static-data-contract-check.mjs` (no `시총 ~N조` annotations, no static `w:` weights — R604) | Review constituents monthly; remove point-in-time figures |
| S4 | `AIO_MACRO_CALENDAR` release schedule | `js/aio-core.js` (`window.AIO_MACRO_CALENDAR` + `AIO_MACRO_OFFICIAL_SCHEDULES`) | `ci-data-refresh-audit.mjs` E3/E4 + T759/T884 (no past `nextRelease`) | Check official BLS/BEA/ISM/Census/Fed/BOK calendars after every release; expired `nextRelease` auto-nulls but `lastRelease` promotion is manual |
| S5 | `AIO_MANUAL_REFERENCE` policy refs (Fed/BOK/KR-CPI) | `js/aio-core.js` (`AIO_MANUAL_REFERENCE`) | `ci-static-data-contract-check.mjs` (value+definition+observation+publishedAt+sourceUrl coupled) | Update on every policy decision or CPI release; never carry a past meeting as next |
| S6 | Telegram/news channel allowlists | `scripts/fetch-telegram-digest.mjs` `CHANNEL_CATALOG` | `ci-data-refresh-audit.mjs` F1 | Review channels when a feed dies or a better source appears |
