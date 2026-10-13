# 시장 상태

시장 상태 tells the user which regime the US market is in (우호/중립/부담 per axis), why, and how it changed versus 5 and 20 trading days ago, with a Korea reference board and the breadth and sentiment detail on sibling tabs.

## Sub-features

- `market-verdict` — `#regime-overall` (`판정 대기` while loading, then the regime word; also `data-overall`), `#regime-counts`, `#regime-basis` (`… 미국 종가 기준 …`).
- `market-headline` — `#regime-headline` and conflict bullets `#regime-conflicts li`.
- `market-board` — six US axes `#regime-board .regime-axis` with 5/20-day deltas; Korea reference `#regime-board-kr` (not counted in the six-axis tally).
- `market-breadth` — `#breadth-state` pill (not `판정 대기`, not `.is-unknown`), `#breadth-read`, `#breadth-flip`, trend cards `#breadth-chart-grid .trend-card`.
- `market-sentiment` — `#sentiment-basis`, `#sentiment-synthesis`, `#sentiment-bridge`, `#sentiment-card-grid`.

## How to get to it (user POV)

- Sidebar 시장 › 시장 상태.
- Hub tabs 국면 판정 / 시장 폭 / 투자 심리.
- Deep links `#signal`, `#breadth`, `#sentiment`.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `시장 상태`. `page-signal` active; tabs exactly `국면 판정,시장 폭,투자 심리`.
- **Verdict.** `#regime-overall` real text; `#regime-basis` matches `/종가 기준/`.
- **Reason.** `#regime-headline` ≥20 chars; ≥1 `#regime-conflicts li`.
- **Boards.** ≥6 `#regime-board .regime-axis`; `#regime-board-kr` has children.
- **Breadth.** Tab `시장 폭` → `page-breadth`; `#breadth-state` settled, `#breadth-read` ≥10 chars, ≥1 trend card.
- **Sentiment.** Tab `투자 심리` → `page-sentiment`; `#sentiment-basis` real text, `#sentiment-synthesis` ≥10 chars, `#sentiment-card-grid` has children.
- **Proof.** `drive market` evidence folder.

## Gotchas

- The 0~100 score gauge (`#score-gauge-val`, `#score-decision-*`, `#score-adjustments-container`) was removed by P1392 (six-axis board). `architecture/route-owners.json` still declared it until this audit; `registry` catches that class of drift.
- `판정 대기` is the loading placeholder; its change is the readiness signal.
