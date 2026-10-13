# AIO verification map

This directory is the maintained source for verifying what an AIO Screener user can see and do. Read this index before driving, then use the matching feature file as the recipe. `drive <id>` in `scripts/verify-aio.mjs` implements each file's `Driving` section; when they disagree, the map is the spec and the script is the drift to fix.

## Baseline preconditions

- Instance launched by this skill: `node .claude/skills/verify-aio/scripts/verify-aio.mjs launch` (default `http://127.0.0.1:8791/`).
- `doctor` reports PASS for state, pid, port owner, served version = checkout `version.json`, and the versioned shell title.
- Data is the checkout's `public-data/` snapshot (US close basis); nothing is seeded or mutated except the portfolio drive's own browser storage.
- Every drive opens a fresh browser context, so there is no carry-over between features.
- `check` passes (map <-> driver parity) before any live pass.

## Driving conventions

- Navigate as a user: sidebar item by its visible label, then hub tab by its visible label. Deep links (`#<route>`) are a secondary entry point only.
- Prefer ids, `aria-label`, `data-action` and visible text over DOM position or coordinates.
- Wait for an observable state (active page id, filled text, row count), never a fixed sleep.
- Desktop viewport is 1440x1000; `--viewport phone` is 390x844 and opens the sidebar via the hamburger before each nav click.

## Proof and skip reporting

- Every step records the action and the resulting state in `report.json`, with a screenshot per step.
- Mutation proof (portfolio) re-reads the stored value from a second view and after a reload.
- `—` in a numeric slot is the app's honest missing state; report it as missing, not as a verified value.
- Report an unreachable sub-feature with the attempted command and the unmet prerequisite (usually the Pages origin for Worker/provider calls).
- Do not report a feature as verified through a different entry point than the one named.

## Feature entry contract

Each feature file has an H1, one paragraph of user-visible behavior, then exactly: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-aio`, `Gotchas`.

## Features

- [오늘](./today.md) — dashboard verdict, briefing and news tabs.
- [시장 상태](./market.md) — regime verdict, six-axis board, breadth and sentiment tabs.
- [거시 · 금리](./macro.md) — macro regime and rates/FX tabs.
- [테마 · 섹터](./themes.md) — sector rotation list and inline theme detail.
- [종목](./stock.md) — ticker search and the same company across 요약/차트/재무 공시.
- [스크리너](./screener.md) — ranked rows and text search.
- [포트폴리오](./portfolio.md) — add a holding and keep it across reload.
- [리서치 라이브러리](./learn.md) — 개념·분석 프레임, 산업·밸류체인, 운용사·13F.
- [용어 사전](./glossary.md) — open, search, close.
- [AI 도우미 패널](./ai-panel.md) — open, chips, Enter send (degraded path locally), Esc close.
- [공통 셸](./shell.md) — 도움말 guide, dark/light switch kept across reload, deep links.
