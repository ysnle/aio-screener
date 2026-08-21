# Daily briefing comparison and integration — 2026-08-12

## Scope

This packet integrates the supplied DeepDive Korea close, DeepDive US close, Amit recap, and Ariel screenshot into the AIO Screener daily briefing first. It is a structural/editorial integration, not a promotion of social-post figures into live market data.

The briefing now keeps four layers separate:

1. **Current canonical observation** — live quote or server-authored snapshot, with source kind and cut timestamp.
2. **Reference observation** — supplied report/screenshot observation, with event date, post timestamp, and evidence status.
3. **Interpretation** — causal link between rates/oil/FX, AI supply/capital, earnings reaction, breadth, and relative strength.
4. **Next check** — the official release, price response, flow, breadth, filing, or volume evidence required to update the view.

## Compare / contrast

| Dimension | Existing briefing behavior | Supplied materials | Integrated behavior |
|---|---|---|---|
| Time | One current-looking summary | US close, Korea close, recap/post time, and next CPI window are mixed | `eventDate`, `asOf`, `publishedAt`, session, and server cut are preserved separately |
| Market summary | SPX/QQQ/VIX/F&G/breadth cards | Oil, 10Y, USD/KRW, SOX, KOSPI flows, memory, financing, earnings reactions | Canonical current panel plus dated reference panel |
| Causality | Top news and generic action text | Rates/oil/FX → duration/flow; AI demand → memory/compute/power; earnings → breadth | Three narrative arcs and a dynamic comparison interpretation |
| Evidence | Current quote layer and news score | Secondary reports, attributed claims, and screenshot observations | `LIVE`/`SNAPSHOT` never overwritten by `REFERENCE`; pending-primary and screenshot labels remain visible |
| Market internals | Breadth and RSP/SPY are present but not tied to the report | Rotation below calm indices, memory two-way risk, oil/gas leadership, 200SMA reclaim | Reference checklist is routed to breadth, relative strength, volume, SMA, and earnings confirmation |
| Other consumers | Briefing was the main visible consumer | Concepts apply to macro, FX/bond, technical, themes, ticker, options, Korea, and AI context | Digest page targets, structured retrieval fields, ticker maps, and MACRO/TECH keywords fan the same framework out |

## Time-series ledger

- **2026-08-10 US close → 2026-08-11 06:00 KST:** DeepDive US report window.
- **2026-08-11 Asia/KRX close → 2026-08-11 16:10 KST:** DeepDive Korea close report window.
- **2026-08-11 11:36 KST:** Amit recap publication/observation window.
- **2026-08-11 US session → 2026-08-12 08:58 KST:** Ariel screenshot describes internal rotation; session date and post time remain separate.
- **2026-08-12 21:30 KST:** BLS July CPI release window used as the next event checkpoint; the report’s forecast is not treated as the actual.

## Promotion boundary

Quoted index, rate, oil, FX, flow, financing, dilution, shipment, backlog, options, and earnings figures remain reference-only until the exact primary source or canonical provider row is reconciled. The screenshot contributes qualitative rotation hypotheses only; no OCR level, price, volume, or signal is promoted. The briefing must say “current source missing” instead of substituting a report number.

## Runtime integration

- `public-data/user-research-digest.json`: four dated daily-report records, observations, reference time series, ticker maps, source audits, and page targets.
- `js/aio-core.js`: briefing research model, canonical observation model, comparison renderer, time/session retrieval fields, and AI context bridge.
- `js/aio-data.js`: dated macro/technology vocabulary for CPI risk, AI financing, forced liquidation, earnings breadth, memory two-way risk, and oil/software rotation.
- `index.html`: daily briefing comparison panel, causal arcs, next checks, and reference timeline.

 No quiz, practice problem, or gamified learning surface is part of this integration.
