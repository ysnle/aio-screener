# Data continuity remediation — 2026-08-30 — SUPERSEDED AGENT DRAFT

**Not final evidence.** Main review corrected the atomic writer's URL support and replaced the replica FRED test with the actual producer function. Public config was subsequently regenerated. The timestamp summaries below mixed shared-artifact categories and calendar events, so they must not be used as category freshness evidence. The final gate labels these only as artifact timestamp candidates. No current market data was refreshed. Final report: [complete-remediation-20260830.md](./complete-remediation-20260830.md).

Status: CONTRACT PATCHED / LIVE REFRESH BLOCKED.  The repository contains no
newly fetched market value in this report.  `public-data/*` observations remain
dated evidence, while `generatedAt`/`attemptedAt`/`lastSuccessfulAt` are kept as
separate collection fields.  The nine rows marked `DEFERRED` are intentionally
not re-certified by this pass.  Paid or redistribution-restricted coverage is
not enabled or extrapolated.

## Remediation delivered

- `scripts/fetch-data.mjs` now isolates source planes with `Promise.allSettled`,
  requires a complete finite FRED series set before setting `fredFetchOk`,
  retains the previous successful FRED timestamp on partial/unavailable runs,
  keeps missing OHLCV as `null`, and writes data/history/screener artifacts
  atomically.
- `scripts/build-market-snapshot.mjs` writes the status sidecar and published
  snapshot atomically; a failed Tier-0 attempt cannot replace the last good
  snapshot.
- `scripts/build-operations-status.mjs` emits `marketData` independently of
  AI entitlement/health (`public-reference`, per-request verification).  AI
  health failure therefore does not erase a configured quote relay, and relay
  configuration is not asserted to be healthy.
- `scripts/ci-data-continuity-check.mjs` is a network-free executable
  regression/continuity gate.  It checks the 22-category registry, source →
  producer → artifact → consumer contracts, failure semantics, atomic output,
  and the AI/market-data separation.  The refresh workflow invokes it before
  reconciliation and commit.

## 22-category source audit

`Observed` is the source observation period/time retained by the artifact;
`collected` is the fetch/attempt or artifact-generation time.  A missing live
observation is recorded as `BLOCKED`, never as zero, neutral, or “now”.  Dates
below are from the existing local artifacts at this audit; they are not a
claim that a fresh provider request succeeded on 2026-08-30.

| # / category | Free source → producer | Artifact → consumers | Gate | Observed vs collected | State / limitation |
|---|---|---|---|---|---|
| 1 market-quotes | Yahoo public chart → `fetch-data.mjs` | `market-snapshot.json`, `history.json` → home/signal/technical/ticker/portfolio/screener | continuity + snapshot integrity | quote bars ~2026-08-29 03:22:55Z / artifact 03:23:05Z | CONTRACT PATCHED; live refresh not re-run; public-information rights review remains |
| 2 DATA_SNAPSHOT | checked-in static source → static registry | `js/aio-data.js` → browser data consumers | static-data contract | source observation not re-fetched / v54.68 workspace | DEFERRED (1/9); no headline value or timestamp-only refresh |
| 3 sentiment | CNN F&G, Cboe delayed ratio, AAII public reference → `fetch-data.mjs` | `data.json`, `history.json`, `structural-data-research.json` → home/sentiment/options/briefing | continuity + reconciliation | F&G/put-call/AAII dated rows through 2026-08-28 / collection 2026-08-29 | DEFERRED (2/9) for live recertification; AAII reference-only, no subscriber survey synthesis |
| 4 breadth | AIO-universe Yahoo history → `enrichScreener`/`updateScreenerBreadthHistory` | `screener.json`, `history.json` → breadth/signal/briefing/technical | continuity + source registry | factor as-of 2026-08-28/29 / collection 2026-08-29 | DEFERRED (3/9); not official NYSE/Nasdaq/KRX breadth |
| 5 macro/VIX | FRED/BLS/BEA/Treasury public paths + Yahoo VIX → `fetch-data.mjs` | `data.json`, `market-snapshot.json`, `history.json` → macro/fxbond/sentiment/signal | continuity + refresh integrity | macro release/quote dates retained per field, latest local collection 2026-08-29 | CONTRACT PATCHED; FRED complete-success branch requires all configured finite series; live key/source unavailable here |
| 6 sector/rotation | derived relative ETF/universe observations → screener/data consumers | `screener.json`, `history.json` → signal/briefing/themes | continuity + screener contract | local factor as-of 2026-08-28/29 / collection 2026-08-29 | CONTRACT PATCHED; descriptive comparison only |
| 7 index/ETF quotes | Yahoo public chart; optional Twelve Data key → `fetch-data.mjs` | market snapshot/history → home/signal/technical/ticker | snapshot integrity + continuity | quote observations ~2026-08-29 / collection 2026-08-29 | DEFERRED (4/9); no raw quote republication, no paid fallback enabled |
| 8 Korea macro/index | BOK/KOSIS/approved KRX paths → operator adapters | reconciliation status → macro/briefing/themes | source registry + reconciliation | no fresh approved KRX observation / derived status 2026-08-30 | DEFERRED (5/9); rights/API access unresolved, no Naver value promoted as official |
| 9 news sources/keywords | Google News RSS/publisher headlines → `fetchNews` | `data.json`, `telegram-digest.json` → home/briefing/market-news/ticker/screener | continuity + web-research contract | headline publication times retained; data collection 2026-08-29 03:23Z, Telegram 03:23:14Z | DEFERRED (6/9) for source recertification; headline-only/untrusted limits remain |
| 10 Telegram allowlists | public Telegram pages → `fetch-telegram-digest.mjs` | `telegram-digest.json` → news/briefing only | continuity + digest contract | channel post dates retained / collected 2026-08-29 03:23:14Z | CONTRACT PATCHED; allowlist and reference-only boundary unchanged |
| 11 ticker/aliases | checked-in universe + public quote identity → sync/enrichment producers | `screener-universe.json`, `screener.json` → screener/ticker | screener/source registry | ticker factor as-of 2026-08-28/29 / collection 2026-08-29 | CONTRACT PATCHED; no invented aliases or rows |
| 12 themes | dated screener/news observations → native theme derivation | `screener.json`, `structural-data-research.json` → themes/briefing | reconciliation + continuity | source dates retained / collection 2026-08-29–30 | CONTRACT PATCHED; missing RRG/source remains unavailable |
| 13 ETF/cross-asset | Yahoo public cross-asset + optional CoinGecko/Twelve Data → `fetch-data.mjs` | market snapshot/history/data → home/fxbond/briefing | snapshot integrity + continuity | cross-asset bars ~2026-08-29 / collection 2026-08-29 | DEFERRED (7/9); basis/session and rights limits remain, no paid coverage |
| 14 fundamentals | SEC Company Facts/submissions (free) → SEC/13F builders | `sec-fundamentals.json`, masters artifacts → screener/portfolio/themes | SEC currentness + masters contracts | filing dates/accepted times retained; local SEC artifact 2026-08-28 | CONTRACT PATCHED; bounded SEC coverage only; FMP/estimates are intentionally excluded |
| 15 screener | Yahoo 1y adjusted-close history + SEC facts → `enrichScreener` | `screener.json` → screener/search/signal/briefing | continuity + screener contracts | factor as-of 2026-08-28T22:30:36Z / collection 2026-08-29 | CONTRACT PATCHED; predictive validity not claimed and missing factors stay null |
| 16 chat numeric context | existing dated artifacts only → chat context builder | no new public artifact → chat | continuity + no-fabrication checks | no fresh numerical context collected / prior artifact dates retained | DEFERRED (8/9); no fresh AI numeric claims or timestamp promotion |
| 17 technical | Yahoo OHLCV public chart → history/factor producers | `history.json`, `screener.json` → technical/screener | continuity + technical contracts | OHLCV observations through ~2026-08-29 / collection 2026-08-29 | CONTRACT PATCHED; missing OHLCV is null, not close/zero substitute |
| 18 options | Cboe delayed put/call + Yahoo VIX → `fetch-data.mjs` | `data.json`, market snapshot/history → options/sentiment/signal | continuity + reconciliation | Cboe selected date retained; local collection 2026-08-29 | CONTRACT PATCHED; no IV surface/flow/OPRA claims, specialized paid feeds excluded |
| 19 portfolio presets | checked-in user presets + dated market history → browser/native consumers | local state/history → portfolio | continuity/static contracts | no fresh portfolio source observation / existing user state preserved | DEFERRED (9/9); no user data mutation or risk claim |
| 20 UI dates/values | artifact field lineage → native renderers | data/history/reconciliation → all visible routes | continuity + post-edit QA | rendered values retain source observation dates; artifacts collected 2026-08-29/30 | CONTRACT PATCHED; browser/live replay not re-certified in this pass |
| 21 public generated data | all free producers + reconciliation → release/status builders | `data.json`, snapshot/status, operations, public config → static shell/native consumers | continuity + artifact integrity + reconciliation | data 2026-08-29 03:23:05Z; reconciliation 2026-08-30 03:50:39Z; public config pending producer regeneration | CONTRACT PATCHED; derived status is not source freshness; public config must be generated by producer |
| 22 workflow/current docs | scheduled Actions + source registry → `refresh-data.yml` and generated state | workflow/artifact manifests → CI/release operators | continuity + source-registry/reconciliation gates | workflow attempt/commit times are separate from source observations | CONTRACT PATCHED; no commit/push/deployment performed |

## Blocked and intentionally excluded coverage

- Live provider refresh was not claimed from this local run.  Browser URL policy
  and unavailable/rights-restricted endpoints remain blocked; no alternate
  proxy or indirect browser route was used.
- Subscriber Investors Intelligence, FMP estimates, OPRA/options surfaces,
  approved KRX/NYSE/Nasdaq breadth, redistribution-approved quote feeds, and
  other paid/licensed coverage remain `intentionally excluded`, not “zero”,
  “neutral”, or complete.
- `public-config.json` is not hand-edited.  Its `marketData` block is generated
  by `scripts/build-operations-status.mjs`; the next producer run must refresh
  the working artifact before the continuity artifact check can certify the
  generated file.

## Verification

- `node --check scripts/fetch-data.mjs`
- `node --check scripts/build-market-snapshot.mjs`
- `node --check scripts/build-operations-status.mjs`
- `node --check scripts/ci-data-continuity-check.mjs`
- `node scripts/ci-data-continuity-check.mjs --json` executed the focused
  regressions and 22-category inventory.  Static producer checks passed; the
  local result is blocked only because the dirty `public-config.json` has not
  yet been regenerated by its producer after the `marketData` contract change.
- Shared `qa-runner`, full release gates, external/live checks, commit, push,
  and deployment were not run or performed.
