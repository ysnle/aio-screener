# 기술적 분석

The 기술적 분석 screen shows the index charts (나스닥100, S&P 500, 반도체, 러셀2000 and the rest) on their completed daily closes with the 50-day line, one sentence per index and a table of representative stocks; each index card opens its full chart.

## Sub-features

- `charts-basis` — `#charts-basis` names the close date (`11/3 종가 · 일봉`); before history.json it is the shared wait line, after a failed load `종가 기록을 받지 못했습니다.`.
- `charts-indexes` — `#charts-conclusion` one line, `#charts-index-grid [data-index]` cards with a trend word and an SVG chart; while history is missing the grid shows the shared skeleton (`.aio-state.is-loading`) or error with 다시 시도.
- `charts-stocks` — `#charts-stock-table` representative stocks; skeleton while screener rows load, `종목 지표를 받지 못했습니다` when they failed.

## How to get to it (user POV)

- Sidebar 시장 › 기술적 분석.
- Deep link `#charts`.
- It is one screen with no hub tabs (ROUTE_HUBS `charts`).

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `기술적 분석`. `page-charts` active.
- **Basis.** `#charts-basis` leaves loading and matches `/종가 · 일봉/`.
- **Index cards.** At least 4 `#charts-index-grid [data-index]`, each with an `svg`; `#charts-conclusion` real text.
- **Fold.** Open the first card's `차트 읽기` fold; its body has text.
- **Stocks.** `#charts-stock-table` has a table row.
- **Proof.** `drive charts` evidence folder. Loading, empty and error states are proved by `scripts/ci-sa-02-outage-browser-fixture.mjs` (core-file failure/empty) and the ui-states screenshot matrix.

## Gotchas

- The cards draw completed closes only; an intraday move appears after the next close.
- `종목 › 차트` (`#technical`) is a different screen: one company's chart. The AI panel sends '차트' to that tab when the question names a stock and to this screen otherwise.
