# Data coverage audit for the AI paths (2026-11-25)

Scope: what the screens and the AI need to answer "what happened, why, what next, what to do", checked against the code and the published files in `public-data/` (snapshot of 2026-11-24, merged main). Counts were read from the files with node; they are not inferred from file names. No Telegram post text and no bookmark content appear here.

## Cadence key

| Key | Workflow | Schedule |
|---|---|---|
| RD | `.github/workflows/refresh-data.yml` | Every 30 min (`17,47 * * * *`), plus a daily 07:33 UTC lane for 13F and outcomes. |
| RS | `refresh-screener.yml` | Every 6 h (`53 */6 * * *`), plus 21:53 UTC after the US close. |
| EB | `event-briefs.yml` | Hourly at :27. |

## AI path key

| Key | AI path | Where it lives |
|---|---|---|
| SR | Per-screen readings | `scripts/lib/screen-reading.mjs` `buildScreenPacket`. Only 4 screens: signal, breadth, macro, sentiment. |
| INV | Market investigation | `scripts/lib/investigation-tools.mjs` over the ledger. |
| LEDGER | Market-day ledger | `src/domain/market/day/facts.js` via `scripts/build-market-day.mjs` `marketDayInputs`. |
| TOOLS | Chat tools | `src/ai/tools/*`. |
| CTX | Chat context | `src/ai/context/*`. |
| NARR | `marketAnalysis` producer | `market-narrative.mjs` + `narrative-context.mjs`. |

## Table

| Domain | Artifact / field | Producer | Cadence | Coverage now | Screens | AI before this change | Gap |
|---|---|---|---|---|---|---|---|
| Index / ETF prices | `history.json` rows; `market-snapshot.json` | `fetch-data.mjs`, `producer/history.mjs` | RD 30 min | <ul><li>420 rows, 2025-10-01 to 2026-11-24.</li><li>Main indices 333 sessions.</li><li>SMH / SOX etc. 269 sessions.</li></ul> | all | SR, LEDGER (17 assets), NARR, TOOLS, CTX | ok. About 13 months deep; the long run is in `index-longrun.json` (weekly). |
| Sectors / themes | `rotation-detail.json`; `theme-stage-history.json`; `scenario-state.json` playbook | `rotation-history.mjs`, `theme-stage-backfill.mjs`, `build-scenario-state.mjs` | RD (rotation once per session), RS | <ul><li>42 ETFs.</li><li>44 themes x 120 sessions.</li></ul> | 테마, screener | NARR, TOOLS `money_flow`; LEDGER only through theme maps | not-given-to-AI (INV, SR): no theme-stage reader in the investigation. |
| Breadth | `history.json` breadth20/50/200, A/D, highs/lows, distribution days; `breadth-contributors.json` | `screener-breadth.mjs` | RS | <ul><li>264 sessions.</li><li>Distribution days only from 2026-05-11.</li></ul> | 시장 상태 (breadth) | SR, INV (`screen_facts` breadth), CTX | US-only. S&P 500 member count, not exchange breadth; no up/down volume. |
| Volatility | `history.json` vix, vix3m, vix9d, vvix, skew, move | `fetch-data.mjs` | RD | 267 to 334 obs | 심리 | SR, TOOLS, LEDGER (vix), NARR | ok |
| Rates / credit / dollar / commodities | <ul><li>`history.json` tnx, dxy, fx, wti, gold, btc.</li><li>`macro-history.json`: curve, OAS, liquidity.</li></ul> | `fetch-data.mjs`, `macro-history.mjs` | RD | <ul><li>dgs2/10: 268 obs.</li><li>Other tenors: 48 obs (from 2026-09-14).</li><li>OAS: 784 obs.</li><li>Copper is monthly, to 2026-09.</li></ul> | 매크로 | CTX, TOOLS `macro`, LEDGER (6 macro series), SR | ok. Copper lags by 2 months. |
| Macro releases | `macro-history.json` series (57) | `macro-history.mjs` | RD | about 40 monthly obs; long series from 1990 | 매크로 | SR macro, CTX, LEDGER, NARR | US-only: no Korean employment, CPI or exports. |
| Macro calendar | `macro-calendar.json` schedules | `fetch-data.mjs` `writeMacroCalendar` | RD | <ul><li>8 schedules, 46 events.</li><li>Covers CPI, retail, PCE, NFP, FOMC, ISM.</li></ul> | 매크로, 브리핑 | LEDGER `scheduleFacts`, NARR | Partial: no PPI, GDP, claims, JOLTS, or BOK / KR dates. |
| Macro consensus (expected) | none first-party; only Telegram `signals` kind=macro | `fetch-telegram-digest.mjs` | RD | 3 relayed releases, latest 11-19 | none | CTX `channel-signals`; LEDGER `signalFacts`, which the investigation dropped (fixed) | missing: no surprise-vs-expected for releases. |
| Policy (Fed) | <ul><li>`data.json` policyRates.</li><li>`event-briefs` kind=fomc.</li><li>`macro-history` SEP / fedTarget.</li></ul> | `fetch-data.mjs`, `fetch-event-briefs.mjs` | RD, EB | 1 FOMC brief; 0 Fed speeches | 브리핑, 매크로 | CTX, LEDGER, NARR | missing: Fed speakers, minutes, Beige Book. |
| Earnings calendar / results | `earnings-calendar.json` earnings, upcoming | `fetch-earnings-calendar.mjs` | RS | <ul><li>237 rows this week (28 with actuals).</li><li>67 upcoming symbols.</li></ul> | 종목, 테마, 포트폴리오 | LEDGER, NARR, TOOLS `consensus` (date) | US-only. Now also given to INV via `company` (next date). |
| Guidance | `event-briefs.json` briefs[].guidance | `fetch-event-briefs.mjs` | EB hourly | 99 of 130 briefs carry guidance | 종목, 브리핑 | LEDGER (title only), NARR | not-given-to-AI (chat, INV). Now given to INV via `company`. |
| Consensus and revisions | `consensus-estimates.json` rows: fwd eps hi/lo, up4w/down4w, hist | `fetch-consensus-estimates.mjs` | RS (rotating batch) | <ul><li>914 US rows, 805 covered.</li><li>4-quarter history.</li><li>No revenue consensus.</li></ul> | screener, 종목 | TOOLS `consensus`, NARR | headline-only (EPS only) / US-only. Now given to INV via `company`. |
| Company fundamentals (SEC) | `sec-fundamentals-summary.json`; `sec-fiscal-history.json` | `fetch-sec-fundamentals.mjs`, `build-sec-runtime-projection.mjs` | RS | <ul><li>846 summaries.</li><li>795 x 6 fiscal years.</li><li>758 x 8 quarters.</li></ul> | 종목, screener | TOOLS `fundamentals` (annual summary only) | US-only. `kr-fundamentals.json` is registered but absent: no DART key, so 239 KR rows have no fundamentals. |
| Interest expense / debt maturities | only `longTermDebt` (+ debtBasis / debtCurrent maps) | — | — | interest expense 0; maturity ladder 0 | 종목 (debt label) | none. The chat `fundamentals` description promises 현금·부채 but its records carry neither. | missing |
| Ownership 13F | `masters/*` | `collect-13f-*` | RD daily | <ul><li>38 managers.</li><li>Period 2026-09-30.</li><li>2,641 issuer aggregates.</li></ul> | 대가 | CTX on the masters page only | not-given-to-AI for stock and market reads. |
| Korean investor flows | `kr-investor-flows.json` | `fetch-kr-investor-flows.mjs` | RS | <ul><li>2 markets x 3 investor types x 45 sessions.</li><li>2026-09-17 to 11-24.</li></ul> | 분석 (korea participation) | none | not-given-to-AI. Now given to INV via `market_data`. |
| Korean margin balance (신용잔고·미수) | none | — | — | 0 | none | none | missing |
| ETF flows | none (`money_flow` is price-based) | — | — | 0 | none | none | missing |
| Up / down volume | none (issue counts only) | — | — | 0 | none | none | missing |
| News, general | `data.json` news, newsIntraday | `fetch-data.mjs` | RD | 40 + 12 titles, no body | 뉴스, 오늘 | LEDGER `headlineFacts`, NARR, TOOLS `news` | headline-only |
| News, per company | `screener.json` newsMemo | `producer/screener.mjs` | RS | <ul><li>225 of 1,156 rows, 2 titles at most.</li><li>KR rows: 0 of 239.</li></ul> | screener | LEDGER (36 h), NARR | headline-only / US-only |
| News, Korea | `data.json` news topic kr | `fetch-data.mjs` | RD | 5 + 4 titles | 뉴스 | as news | headline-only, thin |
| Telegram | `telegram-digest.json`: signals, sourceCatalog, topItems | `fetch-telegram-digest.mjs` | RD | <ul><li>3 of 3 active channels.</li><li>33 signals (pt 20, earnings 10, macro 3), 11-11 to 11-24.</li></ul> | 뉴스 (channel data), 브리핑 move lines | CTX `channel-signals`, NARR, LEDGER `signalFacts` | not-given-to-AI in INV. Three problems: the deal, release and positioning lines were silently dropped (`factLine` returned ''); the analyst counts were printed as plain fact; channel earnings signals were never read. Fixed for INV (see below); SR still has none. |
| Telegram reference window | `telegram-reference-window.json` | (research artifact) | — | generated 2026-08-02 | none | none | stale and read by nobody |
| Event briefs | `event-briefs.json` | `fetch-event-briefs.mjs` | EB | <ul><li>130 briefs, 10-28 to 11-24.</li><li>Only 1 KR.</li></ul> | 종목, 브리핑 | LEDGER (title), NARR; chat uses them for staleness only | not-given-to-AI (chat). INV now reads headline, guidance and reaction via `company`. |
| Treasury auctions | `treasury-auctions.json` | `fetch-treasury-auctions.mjs` | RS | 93 auctions, 2025-10-22 to 2026-11-23 | 매크로 rate hub | none | not-given-to-AI. Now given to INV via `market_data`. |
| Scenario state | `scenario-state.json` | `build-scenario-state.mjs` | RD | <ul><li>44 themes.</li><li>60 transitions.</li><li>11 event outcomes.</li></ul> | 분석, 테마 | NARR, CTX; SR through the interpretation | ok for SR; INV reads its rule words only through `screen_facts` signal. |
| Research / knowledge | `knowledge/*`, `user-research-digest.json`, `src/domain/research` packets | `build-knowledge-*` | weekly / manual | dossiers 2026-08-18; digest 2026-10-12 | atlas | TOOLS `reference`, NARR | stale (about 3 months) |
| Options OI | retired by owner decision | — | — | 0 | retired | none | not rebuilt |

## What changed for the AI in this batch (v60.54)

The investigation now has two new tools:

- `company`: consensus, the filing summary with company guidance, the reaction, the next report date, and the channel claims on the name.
- `market_data`: three sets, `treasury-auctions`, `korea-flows` and `channel-releases`.

Each one goes through the domain reader its own screen uses:

| Data | Domain reader |
|---|---|
| Consensus | `consensus-read.js` `buildConsensusPoint` |
| Treasury auctions | `treasury-auctions.js` `auctionLine` / `latestByTenor` |
| Korean investor flows | `kr-investor-flows.js` `buildKrInvestorFlowView` / `formatEok` |
| Reaction after a report | `event-briefs.js` `reactionPct` |
| Channel facts | `channel-lines.js` `signalLine` |

Every channel-derived ledger fact carries `src.channel`, the role from the digest's `sourceCatalog`. It is printed behind `[채널 주장 · 미확인 · <채널 종류> · M/D]`.

A cause filed as `price` cannot stand on figures that only appear in a channel-claim line.

## Not done here

- **Screen readings.** They do not read channel claims yet. The pure helper `channelClaimLines` (`src/domain/news/channel-claims.js`) is ready to be called from `buildScreenPacket` for the macro packet (`market: true`) and from the per-stock reads (`subjects: [sym]`).
- **Theme-stage history.** It has no investigation reader. `money_flow`'s readers are browser-root bound; a pure theme-stage reader would be the next step.
- **Chat guidance.** The chat still cannot read guidance; the `company` lines builder is pure and could back a chat tool.
