# 19d — Hardcoded Data & Artifact Consumers (sub-research of 19) · evidence [에이전트]

## Hardcoded data in source
| Identifier | Location | Size | Content | Maintained by |
|---|---|---|---|---|
| SCREENER_DB (+SCREENER_DB_META lastBulkUpdate 2026-07-16) | js/aio-data.js:10–970 | ~954 lines, 873 tickers | symbol/name/sector/index + hand-written dated `memo` prose | manual; source of screener-universe.json via manual sync |
| AIO_MANUAL_REFERENCE | js/aio-core.js:22564–22589 | 26 lines | Fed/BOK rates, KR CPI, CPI next date (+sourceUrl/asOf) | manual |
| DATA_SNAPSHOT | js/aio-core.js:22604–22669 | 66 lines | ~90-field schema, mostly null; non-null only from AIO_MANUAL_REFERENCE | scaffold |
| AIO_MACRO_CALENDAR | js/aio-core.js:13581–13604 | 24 lines | NFP/CPI/PCE/ISM/FOMC/BOK last/next release | manual (deploy-blocking when a date passes — F-33) |
| AIO_EVENT_FRESHNESS_REGISTRY | js/aio-core.js:5027–5030 | 1 entry | FOMC 9/16 outcome, maxClaimAgeDays 42 | manual |
| KR/US holidays 2026–2027 | js/aio-core.js:22875–22922 | 48 lines | holiday arrays; ≥2028 silently falls back to 2026 (:22936,22943) | manual, yearly |
| US_REGULAR_CALENDAR_2026 | src/ai/time/market-session.js:8–11 | 4 lines | US holidays/half-days (verified 2026-09-08) | manual; independent of the above |
| KR_THEME_MAP | js/aio-kr-data.js:1551–1806 | 255 lines | KR theme → stock codes | manual editorial |
| _KR_SECTOR_MAP | js/aio-kr-data.js:70–75 | 6 lines | theme → 4 sector tabs | manual |
| THEME_MAP (US) | js/aio-pages.js:1986–2199 | 213 lines | theme → ETF → leaders | manual editorial, `allowedUse:'reference'` |
| KR_THEME_CATALYSTS/NARRATIVES | — | frozen `{}` | deliberately emptied | — |
| KR_THEME_INSIGHTS | — | referenced, never defined | dead | — |
| CHAT_CONTEXTS | js/aio-chat.js:1483–1508 (+ `_aioCreateEvidenceContext` 1218–1259) | thin | per-page AI context generators | manual |
| AIO_SUPPLIED_MATERIALS_2026-08-30 / 09-05 / 09-11 | js/aio-chat.js:1129–1216 | ~90 lines | developer-written digests of X posts/articles injected into every chat prompt | manual, append-only, no expiry |
| HOME_WEEKLY_NEWS | js/aio-data.js:11578 | `[]` | runtime-populated | — |

## Artifact consumers (browser)
| Artifact | Loader | Eager/Lazy | Failure |
|---|---|---|---|
| data.json + reconciliation-status.json | js/aio-data.js:5485 `_aioLoadServerData` | eager + 30-min polling | explicit unavailable state |
| market-snapshot.json | src/data/market-snapshot-loader.js via bootstrap.js:741 | eager | unavailable snapshot object |
| screener.json | src/data/providers/screener.js:185 | **lazy** (screener route shown, bootstrap.js:693) | provider-level |
| earnings-calendar.json | js/aio-pages.js:1571 | conditional (keyless fallback) | 6s timeout |
| telegram-digest.json | js/aio-data.js:1234 | eager | message fallback |
| operator-note.json | js/aio-data.js:6385 | 5-min cycle | stale/provenance banners |
| sec-fundamentals-summary.json | src/data/providers/entity.js:19 | lazy (entity page) | label fallback |
| public-config.json | **only js/aio-chat.js:1986 (AI send path)** | late | → fast data-plane structurally unreachable at boot |
| ai-retrieval-index.json | src/ai/retrieval/knowledge.js:293 | lazy on first chat question | 7s timeout → UNAVAILABLE |
| masters/ticker-index-reference.json | js/aio-core.js:11259 | on-demand | timeout+retry |
| operations-status.json, market-snapshot-status.json, backtest-history.json, score-backtest-*.json | none (producer/CI only) | — | — |

Note (contradiction to resolve): the frontend audit (04) measured screener.json, history.json, telegram-digest.json and sec-fundamentals-summary.json being fetched at boot on #home; this map says screener.json and sec-fundamentals-summary are lazy in the native path. Likely explanation: legacy js/ code fetches them eagerly in parallel with the native lazy providers (two loading architectures). Treat "fetched at boot" as the observed live behavior.
