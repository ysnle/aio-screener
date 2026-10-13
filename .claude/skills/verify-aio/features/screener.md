# 스크리너

스크리너 ranks the research universe from the latest screener snapshot for one listing market, with a funnel, a condition builder, a text search, 12-row pages, a Why drawer per row, and a path into the 종목 screen.

## Sub-features

- `screener-market` — `#scr-listing-market` is a `<select>` (US default / KR); changing it resets selection, compare and the page limit.
- `screener-rows` — ranked rows `#screener-results-body tr[data-aio-screener-ticker]`, 12 per page; `N개 더 보기` adds 12.
- `screener-funnel` — `#scr-funnel-universe`, `-ready`, `-passed`, `-unavailable`, `-filtered`, `-runid`, `-scope-note`.
- `screener-search` — `#scr-text-search` narrows rows; clearing restores them.
- `screener-why` — clicking a row opens `#scr-why-drawer` (`#scr-why-title` starts with the ticker); its `[data-aio-screener-action=open-ticker]` opens 종목.
- `screener-builder` / `screener-compare` — `#scr-builder-field` + `#scr-builder-value` → `#scr-builder-condition-list`; compare tray `#scr-compare-tray` (≤5).

## How to get to it (user POV)

- Sidebar 내 투자 › 스크리너.
- Deep link `#screener`.

## Driving it with verify-aio

Preconditions:

- Doctor OK; screener snapshot in `public-data/`.

- **Open.** Click sidebar `스크리너`. `page-screener` active.
- **Market + rows.** Select `US` in `#scr-listing-market`; ≥1 ranked row.
- **Funnel.** Open the fold `조건 직접 조합 · 결과 범위 · 실행 기록` (its `<summary>`); `#scr-funnel-universe` and `#scr-funnel-passed` show digits.
- **Search.** Fill the first row's ticker: rows shrink and keep it; clearing restores the exact count.
- **More.** If `더 보기` is visible, clicking it adds rows; otherwise the step records `skipped` with the row count.
- **Why → 종목.** Click the first row's cell: drawer opens titled with the ticker. Click `open-ticker`: `page-ticker` names it.
- **Proof.** `drive screener` evidence folder.

## Gotchas

- `순위 자료를 불러오는 중입니다.` is the loading row; wait for `data-aio-screener-ticker` rows.
- Producers run only in GitHub Actions. Once a newer US session has closed, a local `public-data/screener.json` marks every US row STALE and the table shows `… 최신 거래일 기준이 아니어서 순위 판정을 보류했습니다` (P1673) — an environment state, not a regression; refresh public-data from origin's data commits before treating it as a failure.
- The funnel lives in a closed `<details>`; its numbers are in the DOM but not rendered until the user opens the fold.
- 12 rows is the page size, not the snapshot size.
- A row click opens the drawer, not 종목; the drawer button does that.
