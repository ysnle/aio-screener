# 기술적 분석

The 기술적 분석 screen reads the market indexes and representative stocks on completed daily closes. It is one page: a stock search, two views of the same chart cards (시장 지수 · 대표 종목) and one analysis slot under them (the stock-chart component). A search pick or a card's `분석 열기` opens that symbol in the slot on the same page (owner 2026-11-19).

## Sub-features

- `charts-basis` — `#charts-basis` names the close date (`11/3 종가 · 일봉`); before history.json it is the shared wait line, after a failed load `종가 기록을 받지 못했습니다.`.
- `charts-search` — `#charts-search-open` (`.aio-cmd-field`) opens the command search's 종목 scope; the pick opens in the slot, the address becomes `#charts?sym=<SYM>`.
- `charts-indexes` — 시장 지수 view: `#charts-conclusion` one line, `#charts-index-grid [data-index]` cards (나스닥100, S&P 500, 반도체, 러셀2000 on their ETF daily candles; 코스피, 코스닥 as close lines), each with a trend word `.charts-trend` from the same classifier as the slot (`src/domain/technical/trend-state.js`), a facts line, a 거래량 line, a chart and a `이 카드의 수치` raw-table fold. US cards have `<ETF> 분석 열기`.
- `charts-stocks` — 대표 종목 view: the same cards as 시장 지수, one per stock, in `#charts-weight-grid` (S&P 500 비중 상위) and `#charts-mover-grid` (오늘 크게 움직인 종목, hidden when empty). A card loads its daily bars once it comes into view (at most four requests at once); without bars it shows `11/18 종가 기준 일봉 값 없음` and verdict `값 없음`, no chart. The screener's fields are the `#charts-stock-raw` raw-table fold (`#charts-stock-table`). Skeleton in the first grid while screener rows load, `종목 지표를 받지 못했습니다` when they failed.
- `charts-slot` — `#stock-chart-section`, title `#stock-chart-title` = `<SYM> 일봉`; SPY by default. Its method and evidence folds are `data-fold-kind` method / raw-table.

## How to get to it (user POV)

- Sidebar 시장 › 기술적 분석.
- Deep links `#charts`, `#charts?sym=NVDA`; the old `#technical`, `#technical/NVDA`, `#technical?sym=NVDA` open the same page with that symbol in the slot.
- 종목 hub line `기술적 분석에서 보기`, the 오늘 index strip and the screener inspector's chart-levels action (`open-chart-levels`) open the slot here.
- One screen with no hub tabs (ROUTE_HUBS `charts`).

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `기술적 분석`. `page-charts` active.
- **Basis.** `#charts-basis` leaves loading and matches `/종가 · 일봉/`.
- **Index cards.** The first view is 시장 지수: at least 4 `#charts-index-grid [data-index]`, each with `.charts-trend` and an `svg` or `canvas` chart; `#charts-conclusion` real text.
- **Fold.** Open the first card's `이 카드의 수치` fold; its body has text.
- **Slot default.** `#stock-chart-title` starts with `SPY`.
- **Search.** Click `#charts-search-open`, fill `NVDA`, Enter. Still `page-charts`; slot title starts with `NVDA`; address `sym=NVDA`.
- **Stocks.** Click the `대표 종목` view. The first card in `#charts-weight-grid` settles (`data-source` bars or missing); click its `분석 열기`. The slot title starts with that card's `data-symbol`.
- **Proof.** `drive charts` evidence folder. Loading, empty and error states are proved by `scripts/ci-sa-02-outage-browser-fixture.mjs` (core-file failure/empty) and the ui-states screenshot matrix; candle geometry (last bar clear of the volume profile, price tags clear of each other) by `scripts/ci-chart-scale-browser-check.mjs`.

## Gotchas

- The cards draw completed closes only; an intraday move appears after the next close.
- Yahoo daily bars are CORS-blocked on 127.0.0.1, so locally the US index cards fall back to close lines, the stock cards show the no-value line, and the slot shows its 시세를 받아오지 못했습니다 card; the title still names the symbol. Candles are verified through the fixture gate or on the Pages origin.
