# AIO v49.4 Data Freshness Audit

## Scope
- Source reports: `AIO_Screener_v49_데이터최신성_전수감사_보고서` and prior full architecture audit.
- User scope: all visible/default values plus hidden click/input-driven values, hardcoded/static seeds, API fallback, cache, stale, and auto-refresh behavior.
- Release target: v49.4.

## Findings Applied
- Added `FRESHNESS_POLICY` as the single stale/confidence policy for quotes, after-hours quotes, macro, news, technicals, breadth, KR supply, static snapshots, manual values, and estimates.
- Added `makeMetric()` and `evaluateMetric()` so data can travel with `{ value, source, ts, policyKey, freshness, confidence, stale }` instead of bare numbers.
- Added `SnapshotStore` so `DATA_SNAPSHOT` fallback seeds are explicitly tracked as static snapshot data, not mistaken for live data.
- Routed snapshot/Yahoo-chart/Stooq/Naver fallback writes through `_aioSetLiveData()` with explicit source and policy metadata.
- Extended scheduler entries with `nextDue`, `lastRunStart`, `lastRunEnd`, `lastDurationMs`, `retryCount`, `priority`, `timeoutMs`, and `policyKey`.
- Added `AIO.auditAllFreshness(pageId)` for page-level coverage, stale metric, pct-missing, and scheduler audit.
- Refreshed `DATA_SNAPSHOT` static fallback market seeds to public 2026-05-08 values. These remain fallback-only and live stores override them.

## Web Refresh References
- US indexes: AP 2026-05-08 close values for S&P 500, Nasdaq, Dow, Russell 2000.
- VIX: Cboe 2026-05-08 VIX spot/front futures.
- Fear & Greed: Finhacker/CNN value 68 as of 2026-05-07.
- Korea indexes: Finhacker 2026-05-08 KOSPI/KOSDAQ close values.
- USD/KRW and AAII: MarketWatch latest public snippets.
- Commodities/crypto: Yahoo Finance delayed snapshot snippets.

## Acceptance Tests Added
- T116 policy keys exist.
- T117 live quote metric classifies as high confidence.
- T118 old quote becomes hard stale.
- T119 static snapshot is not live.
- T120 `calcDataQuality()` normalizes metric envelopes.
- T121 `SnapshotStore` set/get/health works.
- T122 `_aioSetLiveData()` preserves snapshot metadata.
- T123 `AIO.auditAllFreshness('technical')` returns page audit shape.
- T124 `REFRESH_SCHEDULE.quotes` exposes operational metadata.

## Residual Limits
- Scheduler still runs only while a browser tab is open. True background refresh requires a server-side cron/worker.
- Static fallback values are refreshed, but they are intentionally labeled as fallback/static and must not be treated as real-time.
