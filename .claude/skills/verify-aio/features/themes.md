# 테마와 섹터

테마와 섹터 (page heading 테마와 섹터) ranks sectors by relative strength in RRG quadrant cards, lets the user switch scope, opens a sector or theme detail inline on the same screen, and links its constituents to the 종목 screen.

## Sub-features

- `themes-rotation` — 섹터 회전 판정 plus quadrant cards `#rrg-quadrant-cards` made of chips.
- `themes-scope` — pills `#rrg-view-tabs [data-action=setRRGView][data-arg=sectors|subsectors|all]` (11섹터 / 세부 업종 / 전체) inside the sector card; one scope drives both the bars (등락, default) and the scatter (회전); the active pill has `.active` + `aria-pressed=true` and the chip set changes.
- `themes-evidence` — `#sector-perf-tabs` `근거` (11섹터 only, disabled without S&P 500 member records): one table of the 11 sectors (`table.thp-member-table`): rotation, 1개월 vs SPY, shares above the 20/50/200-day lines, 52-week near-low / near-high counts with a two-sided bar, 4-week estimate revisions, price × estimates; `#sector-perf-bars[data-metric=evidence]`.
- `themes-layer-per` — `#themes-ai-chain table.ai-chain__layers`: the AI card's layer table; its last column is each layer's median PER on last-four- and next-four-quarter consensus EPS (`N배 → M배`, dot pair on a shared log axis).
- `themes-ranking` — `#theme-strength-board`: 1일·1주·1개월·3개월 tabs over one ranked bar list (`.tsr-row`); a row opens its members; the multi-window table is the `기간별 표와 순위 변화` fold.
- `themes-detail-inline` — a solid chip `[data-action=showThemeDetail][data-arg]` opens `#theme-detail-panel` on `page-themes` (leaders, sub-theme bars, constituents).
- `themes-summary-only` — dashed chips (`data-detail-availability="summary-only"`) open no detail; they scroll to the sub-theme ranking `#theme-strength-board`.
- `themes-back` — `← 테마 목록으로` closes the detail panel and returns to the list.
- `themes-ticker` — constituent/leader chips `#theme-detail-panel [data-action=showTicker][data-arg]` open the 종목 screen.

## How to get to it (user POV)

- Sidebar 시장 › 테마와 섹터.
- Related-theme chips on 종목 요약 route here (`page-theme-detail` when opened from another screen).
- Deep links `#themes`, `#theme-detail`.

## Driving it with verify-aio

Preconditions:

- Doctor OK; theme snapshot present.

- **Open.** Click sidebar `테마와 섹터`. The `요약` view opens on `page-themes`. Use the page tabs for each section: `요약` for sector bars and rotation, `테마 순위` for the member comparison, `지도` for the S&P 500 map and `AI 공급망` for the price · orders · funding card and its layer table.
- **Cards.** `#rrg-quadrant-cards` has children; ≥1 detail chip.
- **Scope.** Click `세부 업종` pill, then `11섹터`; each becomes `.active` and the chip set differs.
- **Evidence and layer PER.** Click `근거` in `#sector-perf-tabs`; `#sector-perf-bars` carries `data-metric=evidence` and holds one sector table (≥6 rows, heads include `52주 저점·고점 근처` and `가격×추정`). `1주` returns to the period bars. Select `AI 공급망`; each row of `#themes-ai-chain table.ai-chain__layers` ends in `N배 → M배` or `—`.
- **Ranking.** The ranking, the sector bars (`#sector-perf-tabs`) and the hero `#rrg-rotation-read` open on `1주`. In `#theme-strength-board`, pick `1일`, click the first `.tsr-row`; it turns `aria-expanded=true` and `.tsr-member-table` lists the members.
- **Detail.** Switch the sector card to `회전` (`#themes-verdict-tabs [data-view=rrg]`; the card opens on `등락`), open `사분면별 섹터` (`#rrg-quadrant-fold > summary`), then click the first detail chip. `#theme-detail-panel` visible, >100 chars; page stays `page-themes`.
- **Back.** Click `← 테마 목록으로`; the detail closes and the selected chip is inside the viewport again.
- **To 종목.** Reopen that theme, then click its first visible `showTicker` chip. `page-ticker` active and `#ticker-hero-name` names that symbol.
- **S&P 500 map.** `#sector-map` is an open section (`#sector-map-fold` holds only the day's splits and is hidden without them); wait for >50 `#sector-map .sector-map-tile`, click the first tile and expect `.sector-map-detail` to start with its symbol (a second click opens the stock page).
- **Proof.** `drive themes` evidence folder.

## Gotchas

- The detail uses the same route but hides the list while open. The back button closes it and restores the list; asserting a switch to `page-theme-detail` fails falsely.
- Constituent rows show `시세 대기` locally (quotes are CORS-blocked on 127.0.0.1).
- "11 sectors" holds only for the default scope.
- Until the screener producer embeds `indexWeights`, the S&P 500 map sizes by shares × close and names the missing members in the lead — that is the honest fallback, not a failure. The 1일/1주 tabs stay disabled until `ret1d`/`ret5d` are published.
