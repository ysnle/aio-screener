# 19c — Server-side Data Lineage (sub-research of 19, read-only) · evidence [에이전트]

## Workflows
| Workflow | Cron | Concurrency | Purpose |
|---|---|---|---|
| refresh-data.yml | `17,47 * * * *` + `13 7 * * *` | `refresh-data` (shared) | quotes(internal), macro, news, F&G, put/call, AI narrative, history, market-snapshot, telegram digest; 13F only on daily cron/dispatch |
| refresh-screener.yml | `41 */6 * * *` | `refresh-data` (serialized) | SEC fundamentals, earnings calendar, screener.json, reconciliation, operations status |
| data-watchdog.yml | `23 * * * *` | own | read-only health; writes nothing to public-data |

## Provider → artifact
| Artifact | Providers | Collector | Schedule | Notes / failure mode |
|---|---|---|---|---|
| data.json | Yahoo chart (keyless, primary); Twelve Data (ETF subset fallback); FRED; CNN F&G (unofficial); Cboe; BLS; BEA (HTML scrape); Treasury XML; AAII (+ r.jina.ai relay fallback); Google News RSS; CoinGecko (cross-check); Anthropic (haiku-4-5 → sonnet-4-6 on VIX≥25/crisis) | `fetch-data.mjs:main()` | hourly ×2 (actual ~3h) | `toPublicPayload()` strips `quotes` (P715). Fail-closed if quotes <50% → previous file kept. Sub-providers degrade to LKG |
| history.json | derived | `updateHistory()` | same | daily upsert |
| market-snapshot.json (+status) | derived from Yahoo quotes | `build-market-snapshot.mjs` called in-process | same | Tier-0 gate; failure retains previous snapshot + records failed attempt; 3-day closed-venue tolerance |
| telegram-digest.json (+ side-write atlas/index.json) | t.me/s mirror of 4 channels | `fetch-telegram-digest.mjs` | each refresh-data cycle | isolated lane (P1085) |
| masters/{filing-discovery,filings,manager-catalog} | SEC submissions (UA required) | `collect-13f-discovery.mjs` | daily cron/dispatch only | |
| masters/{holdings,holdings-summary} | SEC 13F XML | `collect-13f-reference.mjs` | daily | |
| masters/history-index | SEC (7 history managers) | `collect-13f-history-index.mjs` | daily | |
| masters/history-holdings | SEC archive XML | `collect-13f-history-rows.mjs` | daily | |
| masters/{issuer-aggregates,index} | derived | `build-13f-issuer-aggregates.mjs` | daily | `MASTERS_REVIEW_DATE` defaults to hardcoded `2026-08-18` (no workflow sets it) |
| masters runtime projections | derived | `build-masters-runtime-artifacts.mjs` | daily | 200-row/512KB caps |
| masters/ticker-index-reference | derived from static security-master-reference | `build-13f-reference-ticker-index.mjs` | daily | |
| masters/security-master(-reference) | **no producer** — static, manually curated | — | — | static data inside automated dir |
| screener.json | Yahoo + sec-fundamentals + screener-universe | `fetch-data.mjs:enrichScreener()` (SCREENER_ONLY=1) | 6h | refresh-data stages it but never regenerates; self-throttle <20h |
| screener-universe.json | **derived from `js/aio-data.js` SCREENER_DB (hardcoded JS array)** | `sync-screener-universe.mjs` — **manual only**, CI checks drift | none | root cause of the "monthly manual universe" chore & 10/14 hard expiry |
| sec-fundamentals.json | SEC companyfacts | `fetch-sec-fundamentals.mjs` | 6h, batch 24 | incremental; refresh stale after 28d |
| sec-fundamentals-summary(+manifest) | derived | `build-sec-runtime-projection.mjs` | 6h | |
| earnings-calendar.json | Finnhub free | `fetch-earnings-calendar.mjs` | 6h | keeps previous file if key missing |
| reconciliation-status.json | derived | `build-reconciliation-status.mjs` | 6h only | |
| operations-status.json (+public-config, public-readiness partial) | derived | `build-operations-status.mjs` | 6h | reads stale operations-slo-window.json |
| backtest-history.json | derived | `updateBacktestHistory()` | each refresh-data | non-fatal |
| score-backtest-history.json | derived | `backtest-trading-score.mjs:runBacktest()` in-process | each refresh-data | non-fatal |
| factor-backtest-longrun / score-backtest-longrun | Yahoo 10y | manual research scripts ("cron 미배선") | none | CI only checks fields |

## Orphans / dead
1. `public-data/operations-slo-window.json` — stale placeholder (NOT_CERTIFIED, SOURCE_TEMPLATE_ONLY, 2026-08-24); watchdog writes its SLO window only to a CI artifact, never to public-data; yet build-operations-status reads it.
2. `scripts/reconcile-masters-coverage.mjs` — writes manager-catalog.json, never invoked by any workflow.
3. FMP path in `enrichFundamentals()` — no workflow passes FMP_API_KEY → dead in production.
4. security-master(-reference).json — static inputs, no producer.
5. `MASTERS_REVIEW_DATE` hardcoded default `2026-08-18`.
