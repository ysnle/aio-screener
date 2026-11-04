# 스크리너

스크리너 ranks the research universe from the latest screener snapshot for one listing market. One bar sets it up: `[표에서 찾기] [시장 ▾] [섹터 ▾] [+ 조건] [보기 ▾]`. Applied conditions show as chips, rows come 12 per page, each row has a Why drawer, and there is a path into the 종목 screen. The view tabs are `순위` and `사후 검증`.

## Sub-features

- `screener-market` — `#scr-listing-market` is a `<select>` (미국 default / 한국); changing it resets selection, compare and the page limit.
- `screener-rows` — ranked rows `#screener-results-body tr[data-aio-screener-ticker]`, 12 per page; `N개 더 보기` adds 12. `#scr-table-status` gives the one-line summary `조건 통과 N종목 · 자료 부족 N`.
- `screener-conditions` — `+ 조건` (`#scr-add-condition`) opens `#scr-condition-panel`: 조건 화면 presets, market/cap/setup, 백분위 하한, RSI, 모멘텀, 관심 종목만, 조건 통과만, and the custom condition chips. Each applied condition becomes one chip in `#scr-active-filter-chips`; its `×` (`[data-aio-screener-action=clear-filter]`) clears the same control.
- `screener-view` — `보기` (`#scr-view-button`, label `#scr-view-label`) opens `#scr-view-panel`: the five weight views (균형·모멘텀·스윙·가치·저리스크) each set the ranking weights and the table's columns together, plus 정렬 `#scr-order` and 종목 범위 `#scr-universe-scope`.
- `screener-search` — `#scr-text-search` (`/` focuses it) narrows rows; clearing restores them.
- `screener-why` — clicking a row opens `#scr-why-drawer` (`#scr-why-title` starts with the ticker); its `[data-aio-screener-action=open-ticker]` opens 종목.
- `screener-developer` — `#scr-developer-drawer` (ScreenDefinition JSON, funnel `#scr-funnel-*`, run history) renders only with `body.aio-dev-mode`.

## How to get to it (user POV)

- Sidebar 내 투자 › 스크리너.
- Deep link `#screener`.

## Driving it with verify-aio

Preconditions:

- Doctor OK; screener snapshot in `public-data/`.

- **Open.** Click sidebar `스크리너`. `page-screener` active.
- **Market + rows.** Select `US` in `#scr-listing-market`; ≥1 ranked row.
- **Condition chip.** Click `+ 조건`, set `#scr-rsi-min` to 50, press Escape: the panel closes, focus returns to `+ 조건`, one RSI chip shows, and the passing count does not grow. Click the chip's `×`: the chip goes and the original row set comes back.
- **보기.** Click `보기`, choose `모멘텀`: `#scr-view-label` reads 모멘텀 and the table header changes. Choose `균형` again to restore.
- **Search.** Press `/` (focus lands in 표에서 찾기), type the first row's ticker: rows shrink and keep it; clearing restores the exact count.
- **More.** If `더 보기` is visible, clicking it adds rows; otherwise the step records `skipped` with the row count.
- **Why → 종목.** Click the first row's cell: drawer opens titled with the ticker. Click `open-ticker`: `page-ticker` names it.
- **Proof.** `drive screener` evidence folder.

## Gotchas

- The loading row is the shared skeleton (`.aio-state.is-loading`); wait for `data-aio-screener-ticker` rows.
- Producers run only in GitHub Actions. Once a newer US session has closed, a local `public-data/screener.json` marks every US row STALE and the table shows `… 최신 거래일 기준이 아니어서 순위 판정을 보류했습니다` (P1673). This is an environment state, not a regression: refresh public-data from origin's data commits before treating it as a failure.
- The funnel and the JSON editor are in the developer drawer, which only 개발자 모드 shows. A user-path drive does not read them.
- 12 rows is the page size, not the snapshot size.
- The bar is the same at every width; the panels open under it, and Escape or a click outside closes them.
- A row click opens the drawer, not 종목; the drawer button does that.
