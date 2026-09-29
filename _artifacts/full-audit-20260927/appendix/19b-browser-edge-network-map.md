# 19b — Browser & Edge Network Call Map (sub-research of 19, read-only)

> Produced by a sub-agent of the lineage audit; saved verbatim-in-substance by Opus. Evidence level: [에이전트].

## Edge

- `cloudflare-worker-proxy.js`: `GET /health` (metadata only) · `POST /anthropic` (kill switch → key present → Origin allowlist → optional app token → per-IP 20/min → DO atomic daily cap (us jurisdiction, fail-closed) → body ≤200KB → haiku/sonnet only → max_tokens 1500 → SSE relay) · `GET /relay?provider=fred|bok|kosis` (hardcoded upstreams, regex-whitelisted params, DO cap 2000/provider/day, 10s timeout, 5MB cap, key redaction) · generic `?url=` CORS proxy (Origin allowlist → bot UA block → 300/min → private-IP block → ~35-host allowlist; cache 30min news/RSS, 1h FRED, 2min default). No per-user auth.
- `worker/data-plane.js`: Cron `*/5` fetches Yahoo chart for Tier-0 instruments → KV `quotes:current` (+heartbeat), publishes only on complete coverage & new revision; `GET /quotes`, `GET /health`, authenticated `POST /admin/run`. **No browser code calls `/quotes`** (not wired; `fastQuotes.enabled:false`).

## Browser proxy infrastructure

- `_PROXY_REGISTRY` (`js/aio-data.js:2104`): Tier0 cf-worker → Tier1 corsproxy.io → Tier2 allorigins raw/get, codetabs; circuit breaker (3 fails → exponential cooldown). `fetchViaProxy()` (`:2321`). Sensitive URLs (with keys) only via a user-owned Worker.
- `_aioRelayUrl/_aioRelayFetch` (`:2076–2094`) → Worker `/relay`.

## Browser live fetches

| Host | Purpose | Where | Trigger | Duplicates server artifact? |
|---|---|---|---|---|
| Yahoo query1/2 (v8 chart, v7 quote) | US/global quotes, VIX, sector history, crypto | `aio-data.js fetchLiveQuotes ~13594`, `:1886`, `aio-ui.js ~7251`, `aio-pages.js` sector, `aio-kr-data.js:2080`, `aio-chat.js:2795`, `autoUpdateMA :16148`, `fetchSentimentHistory :3736` | **Boot** (~2.5s) + on-demand | **Yes** (market-snapshot/history server-side; P715 strips per-symbol quotes from data.json) |
| Naver (m.stock, api.stock, polling, api.finance, fchart, finance) | KOSPI/KOSDAQ, VKOSPI, KR quotes/OHLC | `aio-kr-data.js:631,1033,1109,2219`, `aio-data.js:2779,13084–13320` | Boot (KR index) + on-demand | Partial (per-stock KR & VKOSPI browser-only) |
| CoinGecko | crypto prices, cross-check | `aio-data.js:13388,13450,14155` | Boot | Yes (cross-check by design) |
| stooq | CSV fallback | `aio-kr-data.js:2181`, `aio-pages.js:2561`, `aio-data.js:13882,14117` | fallback | Partial |
| open.er-api / exchangerate-api | FX | `aio-data.js:13526–13555,14185` | Boot | **Yes** |
| CNN dataviz (F&G) | Fear & Greed | `aio-data.js:16084 fetchFearGreed` | Boot (~3s) | **Yes** |
| cdn.cboe.com | put/call | `aio-data.js:16293` | Boot | **Yes** |
| FRED (via /relay or personal key) | curve, HY OAS, CPI/PCE, jobs | `fetchAllFredData ~3128`, `:16349` | Boot (~5s) **only if server macro not fresh** (`_aioServerMacroReady`) | Conditional — the only freshness-aware path (plus HY) |
| BOK ECOS / KOSIS (via /relay) | KR macro | `fetchBokEcos ~2979`, `fetchKosisStat ~3060` | On-demand | Intentionally browser-side |
| SEC efts/data.sec.gov | filings, companyfacts, insider, 13F search | `aio-kr-data.js:1884–1971`, `aio-core.js:11193–12912`, `aio-chat.js:3371` | On-demand | Different surface from server 13F |
| Finnhub (+WS) | insider, metrics, news, stream | `aio-core.js:11193,11228,11592`, `aio-data.js:2462,14134` | On-demand, personal key | No |
| FMP | profile, ratios, statements, targets, transcripts, earnings | `aio-chat.js 2466–7638`, `aio-core.js 11690–13903`, `aio-pages.js 1510,1708,1855` | On-demand, personal key | No |
| Alpha Vantage, Twelve Data | alt quote providers (config) | `aio-data.js:2001–2036` | unconfirmed | possibly |
| newsdata.io | alt news | `aio-data.js:3603` | on-demand | overlaps news |
| rss2json | RSS→JSON | `aio-data.js:12050–12081` | **Boot** (news) when no Worker | **Yes** |
| rsshub.app + 5 mirrors | Reuters/AP/Telegram RSS | `aio-data.js:7148–7231,12426–12544` | **Boot** | **Yes** |
| t.me/s | Telegram preview scrape fallback | `aio-data.js:1074,12261,12453` | fallback | Yes |
| translate.googleapis.com | headline translation (unofficial) | `aio-data.js:10005–10034` | deferred boot (~2.3s) | No |

## Server artifact loader

- `_aioLoadServerData()` (`js/aio-data.js:5485–5670+`): same-origin `data.json?t=<minute>` + `reconciliation-status.json`, validates schema (22 categories) and cross-checks `marketSnapshotRevision`; publishes `window._serverDataMeta`. On failure → `applyStaticFallbacks()` (`:14281`) → localStorage `aio_cached_quotes` (24h) → hardcoded `DATA_SNAPSHOT` (`aio-core.js:22604`). Polling every 30 min (`_aioStartServerDataPolling :6936`), `_aioLoadHistory()` hourly bust.

## Key redundancy finding

`initV20DataEngine()` (`js/aio-data.js:7021`) loads `data.json` first, then **unconditionally** fires live third-party calls on timers (quotes @2.5s, sentiment @3s, FRED/breadth/news @5s+) for Yahoo, CoinGecko, FX, CNN F&G, Cboe, RSS/Telegram — regardless of server artifact freshness. Only FRED and HY OAS check `_aioServerMacroReady`/`_aioServerHyReady` first.
