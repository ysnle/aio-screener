# /first-users

Send five first-time users through the app, one read-only subagent each, find every place they get confused, stuck or
misled, fix the causes, then prove the fixes with a fresh run judged by an agent that did no fixing. Adapted from the
LimestoneHQ launch-QA prompt (2026-10-25) for AIO's audience: family and friends, mostly not investment professionals.

## Settle before spawning (subagents cannot ask)
- **First success** per persona, from the 8 screens. Default: read today's one-line market conclusion and open its chart
  (오늘 → 시장 상태); search one US stock and read its chart and fundamentals (종목); add one holding (포트폴리오, local
  storage only); ask the AI panel one question. Change these only with the owner's OK.
- Surface: `node .claude/skills/verify-aio/scripts/verify-aio.mjs launch` (127.0.0.1:8791, committed `public-data/`).
  Quotes and AI answers are in their degraded local state there (CORS); a persona records that as "not tested", never as a
  pass. AI questions spend the shared budget only on the deployed origin, so locally they test the degraded path.

## Personas (one subagent each, in parallel, read-only, low/medium effort)
Each gets only the URL, its persona, its first success, its folder `_artifacts/first-users/run-N/<id>/` and the walkthrough
rules — no code, docs or hints.
- `impatient` — skims, clicks the first thing that looks like progress, gives each screen 10 seconds, quits at the first
  error, endless loading text (`…불러오는 중입니다`) or unclear field.
- `skeptic` — asks of every number "언제 값인가, 최신인가": looks for the date chip, the stale/없음 state, where the data
  came from (the folded 데이터 출처), whether a judgement says what it rests on, and whether anything reads as a buy/sell
  instruction or an unexplained grade.
- `phone` — 390px touch, slow 3G, CPU 4x: blank loads, layout jumps, sideways scroll, tap targets under 44px, sticky bars
  over the main control, folds or sheets that will not close, inputs that zoom (under 16px).
- `newcomer` — Korean speaker with no investing background who follows only what the screen literally says: flags jargon
  without a glossary mark, English or abbreviations (RRG, OAS, VIX) left unexplained, unlabelled icons, placeholder-only
  labels, errors that do not say what to do.
- `breaker` — pastes junk into the ticker search, portfolio inputs and the AI box (empty, 5,000 characters, emoji, Arabic,
  `O'Brien`, `<script>`, a SQL string, a lowercase or wrong ticker), double-clicks, goes back and refreshes mid-action, uses
  two tabs. Flags crashes, duplicates, lost input, unescaped output and any ticker the app rewrites to another issuer.

## Walkthrough rules
- From the first screen to first success, thinking aloud: what you expect before each action, what happened after.
- Screenshot every screen as `NN-slug.png`. At each friction point log a one-line quote, the route, console errors,
  failed requests and a severity: 4 blocker (cannot finish), 3 major, 2 minor, 1 cosmetic.
- Stuck: try twice like a real person, then give up and record where. Stop at first success or 60 actions.
- Never send messages, export files or touch anything outside the app. Write only in your folder.
- End with: reached first success (yes/no), actions taken.

## Fix
Merge the reports into one list, one item per root cause: blockers first, then by how many personas hit it, then severity.
Give each its likely cause (file:line, via CODE-MAP and route owners). Fix causes, not symptoms, in one batch on `main`;
change nothing unlisted. Wording that touches a product decision (disclaimer, scores, no-instruction policy) goes on a
"needs the owner" list with a suggested rewrite. Run `qa-runner affected`, then record per AGENTS.

## Verify
Rerun all five as fresh subagents into `run-2/`. A judge subagent that did no fixing compares the run-1 list with both
runs' screenshots and marks each item fixed, not fixed, not reached or new. Fixed means a run-2 screenshot shows the
persona getting past it — screenshots beat notes. Anything still open: one more fix pass and `run-3`, then stop and list
what is left for the owner.

## Output
`_artifacts/first-users/report.md`: what could not be tested (and why), a run-1 vs final scoreboard per persona, and the
ranked list with status, screenshots and files changed. No commit or push without the owner's request.
