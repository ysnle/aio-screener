# 테마와 섹터

테마와 섹터 (page heading 테마 · 트렌드) ranks sectors by relative strength in RRG quadrant cards, lets the user switch scope, opens a sector or theme detail inline on the same screen, and links its constituents to the 종목 screen.

## Sub-features

- `themes-rotation` — 섹터 회전 판정 plus quadrant cards `#rrg-quadrant-cards` made of chips.
- `themes-scope` — pills `#rrg-view-tabs [data-action=setRRGView][data-arg=sectors|subsectors|all]` (11섹터 / 서브섹터 / 전체); the active pill has `.active` and the chip set changes.
- `themes-detail-inline` — a solid chip `[data-action=showThemeDetail][data-arg]` opens `#theme-detail-panel` on `page-themes` (leaders, sub-theme bars, constituents).
- `themes-summary-only` — dashed chips (`data-detail-availability="summary-only"`) open no detail; they scroll to the sub-theme ranking `#theme-strength-board`.
- `themes-back` — `← 선택한 목록으로` scrolls back to the chip; the panel stays open.
- `themes-ticker` — constituent/leader chips `#theme-detail-panel [data-action=showTicker][data-arg]` open the 종목 screen.

## How to get to it (user POV)

- Sidebar 시장 › 테마와 섹터.
- Related-theme chips on 종목 요약 route here (`page-theme-detail` when opened from another screen).
- Deep links `#themes`, `#theme-detail`.

## Driving it with verify-aio

Preconditions:

- Doctor OK; theme snapshot present.

- **Open.** Click sidebar `테마와 섹터`. `page-themes` active (single-tab hub, no tab bar).
- **Cards.** `#rrg-quadrant-cards` has children; ≥1 detail chip.
- **Scope.** Click `서브섹터` pill, then `11섹터`; each becomes `.active` and the chip set differs.
- **Detail.** Click the first detail chip. `#theme-detail-panel` visible, >100 chars; page stays `page-themes`.
- **Back.** Click `선택한 목록으로`; that chip is inside the viewport again.
- **To 종목.** Click the first `showTicker` chip in the panel. `page-ticker` active and `#ticker-hero-name` names that symbol.
- **S&P 500 map.** Step "S&P 500 지도" waits for >50 `#sector-map .sector-map-tile`, clicks the first tile and expects `.sector-map-detail` to start with its symbol (a second click opens the stock page).
- **Proof.** `drive themes` evidence folder.

## Gotchas

- From the list the detail is inline; asserting a switch to `page-theme-detail` fails falsely.
- Constituent rows show `시세 대기` locally (quotes are CORS-blocked on 127.0.0.1).
- "11 sectors" holds only for the default scope.
- Until the screener producer embeds `indexWeights`, the S&P 500 map sizes by shares × close and names the missing members in the lead — that is the honest fallback, not a failure. The 1일/1주 tabs stay disabled until `ret1d`/`ret5d` are published.
