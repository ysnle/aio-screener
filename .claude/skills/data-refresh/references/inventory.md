# Data Refresh Inventory

Use this reference to classify all AIO hardcoded or generated data surfaces before refreshing.

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

