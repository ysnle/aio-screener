# 시장 상태

시장 상태 tells the user which regime the US market is in (우호/중립/부담 per axis), why, and how it changed versus 5 and 20 trading days ago, with a Korea reference board and the breadth and sentiment detail on sibling tabs.

## Sub-features

- `market-verdict` — `#regime-overall` (`판정 대기` while loading, then the regime word; also `data-overall`), `#regime-counts`, `#regime-basis` (`… 미국 종가 기준 …`).
- `market-counter` — v60.31 (안 A): `#regime-counter` (반대 근거: the axes on the other side of the count, or the nearest neutral one; hidden when the count is even) and conflict names `#regime-conflicts li` (their numbers in the raw-table fold `#regime-conflicts-raw`). The hero sentence `#regime-headline` and its 판정 근거 fold were removed; the AI reading `#signal-screen-reading` sits under the hero.
- `market-board` — six US axes `#regime-board .ind-row` (`article.ind-row`, never folded: title, state chip, value · 기준까지, then two lines `.ind-row__line.is-reason` / `.is-flip`), two reference rows `#regime-board-watch`, every observation in the raw-table fold `#regime-raw` (one `[data-raw-axis]` group per axis, with 5거래일 전 and 5일 변화), the dated charts in `#regime-history` (axis picker → series picker); Korea reference `#regime-board-kr` (한국 view, not counted in the six-axis tally).
- `market-folds` — v60.31: on 시장 상태 a `<details>` carries `data-fold-kind` = `raw-table` | `method` | `sources`; the method fold `#regime-method` and `details.page-sources` sit at the page foot in every view. Views: 지금 / 이야기와 전망 / 한국 (지표 merged into 지금).
- `market-breadth` — v60.31 (안 A): `#breadth-state` pill (not `판정 대기`, not `.is-unknown`), `#breadth-read` (판정 사유), `#breadth-counter` (반대 근거, facts; hidden when none), `#breadth-flip` (판정이 바뀌는 조건 with its distance), the AI reading `#breadth-screen-reading`, then per group (`.bb-group`) nine unfolded rows `.bb-rows > .ind-row` and nine charts `.trend-card` (the 종목 lists are raw-table folds `details.breadth-drill`); axis observations `#breadth-raw`, definitions and the link to the library's breadth note (`[data-aio-principle]`) in `#breadth-method`.
- `market-sentiment` — v60.31 (안 A): `#sentiment-state` (the shared 심리 verdict) and `#sentiment-read` (판정 사유), `#sentiment-synthesis` (the tally of state words, no sentence), `#sentiment-counter`, `#sentiment-gauge`, `#sentiment-screen-reading`, four rows `#sentiment-card-grid > .ind-row`, charts `#sentiment-chart-grid`, the price temperature `#sentiment-temperature` (tiles, bars and chart on the face; its outcomes a raw-table fold); `#sentiment-raw`, `#sentiment-method` (definitions, rules, each card's link to its library note `[data-aio-principle]`, the temperature's method). `#sentiment-bridge` and `#sentiment-mini-grid` were removed.

## How to get to it (user POV)

- Sidebar 시장 › 시장 상태.
- Hub tabs 개요 / 시장 폭 / 투자 심리 (`src/ui/navigation/route-hubs.js`).
- Deep links `#signal`, `#breadth`, `#sentiment`.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `시장 상태`. `page-signal` active; tabs exactly `개요,시장 폭,투자 심리`.
- **Verdict.** `#regime-overall` real text; `#regime-basis` matches `/종가 기준/`.
- **Reason.** ≥1 `#regime-conflicts li`; `#regime-counter` text recorded (may be hidden on an even count).
- **Boards.** ≥6 `#regime-board .ind-row` and 6 `.ind-row__line.is-flip`; no `<details>` inside the rows; `#regime-board-kr` has children.
- **Fold census.** Visible `<details>` per view by `data-fold-kind`; any unmarked fold in 지금 fails (이야기와 전망 still holds shared renderers' folds — crossroads, guide, story, narratives — reported as `unmarked:<class>`).
- **Breadth.** Tab `시장 폭` → `page-breadth`; `#breadth-state` settled, `#breadth-read` ≥4 chars (the fixed-vocabulary 판정 사유, e.g. `참여 비율 중간`), `#breadth-flip` names 판정이 바뀌는 조건, ≥9 rows and ≥9 trend cards, no `<details>` inside the rows; fold census of `page-breadth` (any unmarked fold fails).
- **Sentiment.** Tab `투자 심리` → `page-sentiment`; `#sentiment-basis` and `#sentiment-state` real text, `#sentiment-synthesis` ≥10 chars, ≥4 rows in `#sentiment-card-grid`, ≥1 chart card, no `<details>` inside the rows; fold census of `page-sentiment`.
- **Proof.** `drive market` evidence folder.

## Gotchas

- The 0~100 score gauge (`#score-gauge-val`, `#score-decision-*`, `#score-adjustments-container`) was removed by P1392 (six-axis board). `architecture/route-owners.json` still declared it until this audit; `registry` catches that class of drift.
- `판정 대기` is the loading placeholder; its change is the readiness signal.
