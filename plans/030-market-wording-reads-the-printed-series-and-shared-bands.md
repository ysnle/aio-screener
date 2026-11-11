# Plan 030: Market sentences read the series they print and the bands they share

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The parts are independent: if one hits a STOP condition, finish the others and report the stopped part.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- src/domain/market src/domain/macro src/domain/briefing/market-read.js`
> If a file named below changed, compare its excerpt with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW–MED (wording and band names on 시장 상태 / 매크로 / 시장 이야기; thresholds unchanged)
- **Depends on**: none (plan 029 edits other lines of `market-read.js`; the reviewer merges)
- **Category**: bug (text contradicting its number; one band, two names)
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

Seven places where a sentence is decided from a different source or threshold than the number beside it. Each was
confirmed by running the real function:
- **A. Rates direction** — 시장 이야기 and the 매크로 금리 장 print the market 10-year (^TNX) change but choose the
  direction word from the FRED DGS10 change. On 2026-10-23 the screen read "10년 5.10 → 4.99% (-11bp) … 큰 변화가
  없습니다"; on 2026-09-08 "+11bp … 20거래일 동안 큰 변화가 없습니다". Six mismatches in the last 100 sessions for
  the first, two in 120 for the second.
- **B. Leadership hold text** names 나스닥 100 although the leadership proxy has been SOXX since v59.70.
- **C. Breadth cross-reading** says the reading changes "50% 아래로 내려가면" while the rule flips at 45%.
- **D. Fear & Greed** — the gauge calls 25 "공포" (extreme fear is strictly below 25) while the cross-reading calls
  25 "극단 공포 쪽".
- **E. Sector counts** in market-flow count a sector that prints "+0.0%" as risen.
- **F. Distribution-day rank** — page-flow says "많은 편" from the 50th percentile; the axis says "중간쯤" between
  the 40th and 60th. Same record, two words.
- **G. VIX 18–25** is "통상 범위" on 매크로 and "주의 구간" on 시장 상태.

## Current state

**A.** `src/domain/market/story/market-story.js` `ratesOf` (~lines 109–127):

```js
  const fred = macroSpan(macroHistory, 'dgs10', from, to);
  const market = span(history, 'tnx', from, to);
  const ten = market ? { ...market, bp: (market.to - market.from) * 100 } : fred;
  …
  const d = fred.bp;
  let kind = 'flat';
  if (Math.abs(d) >= 10) {
    const realShare = real.bp / d; const beShare = be.bp / d;
    if (d < 0) kind = realShare >= 0.6 ? 'growth-fear' : beShare >= 0.6 ? 'inflation-relief' : 'mixed';
    else kind = realShare >= 0.6 ? 'real-up' : beShare >= 0.6 ? 'inflation-fear' : 'mixed';
  }
  return { ten, real, be, kind };
```

`ten` (printed) is the market span; `d` (deciding flat vs moved and the direction) is FRED. The real/breakeven
shares are FRED legs and are only meaningful against the FRED total.
`src/domain/macro/macro-chapters.js` rates chapter (~lines 165–195): `kind = Math.abs(ten.bp) < 10 ? 'flat' : …`
where `ten` is the FRED span, while the bar and "now" text print `market.bp` (the ^TNX `closeChange`).

**B.** `src/domain/briefing/market-read.js` ~line 1670: the string `'(나스닥 100 약세가 풀릴 때까지 판정 유지)'`.
The leadership verdict lives in `src/domain/market/regime/leadership-verdict.js` (find the proxy's label there or in
the leadership axis: `git grep -n "SOXX\|반도체" -- src/domain/market/regime/leadership-verdict.js src/domain/briefing/market-read.js | head`).

**C.** `src/domain/market/regime/cross-readings.js` ~lines 44–48: `if (below && b >= 55) text = … 이 비율이 50% 아래로 내려가면 약세가 넓게 퍼진 것으로 바뀝니다 …`
`else if (below && b < 45) …` `else if (!below && b < 45) …`. Between 45 and 55 a "중간" sentence is printed.

**D.** same file ~line 71: `const fearful = fg !== null && fg <= 25;`. The gauge's band:
`fearGreedBand(score)` (find with `git grep -n "export function fearGreedBand" -- src`) and
`RULES.fearGreed.extremeFearBelow` (25, strict) in `src/domain/rules/thresholds.js`.

**E.** `src/domain/market/regime/market-flow.js` ~lines 44 and 52: counts and the `rose` list use `row.daily > 0`
/ `< 0`; values print with one decimal; the same file already uses `directionOf` at ~line 129.

**F.** `src/domain/market/story/page-flow.js` ~line 105: `ddRecord.pct >= 50` → "상위 …% 많은 편" else "하위 … 적은 편".
`src/domain/briefing/market-read.js` ~line 648: ≥ 60 "많은 편", ≤ 40 "적은 편", else "중간쯤", with a comment that
it is "the same plain wording as the page-flow line".

**G.** `src/domain/macro/volatility.js` ~line 52 (18–25 → "통상 범위"; comment at ~50 says the bands are
harmonised) and `src/domain/briefing/market-read.js` ~line 1334 (18–25 → "주의 구간"). Read both band ladders fully
before choosing.

Shared helpers: `signedText`, `directionOf` in `src/domain/shared/number.js`; thresholds in
`src/domain/rules/thresholds.js` (`RULES`).

## Commands you will need

## Repository rules (apply to every plan)

You are working in a git worktree of **AIO Screener** — a static GitHub Pages investment-research app: `index.html`
shell + legacy classic scripts `js/aio-*.js` + native ESM under `src/`, with Node ESM gate/producer scripts under
`scripts/` and registries under `architecture/`. UI text is Korean. Platform is Windows with Git Bash; Node is on PATH.

**Setup (first commands in the worktree):**
1. `git log --oneline -1` and `git merge-base --is-ancestor 40d470fb3 HEAD && echo based-on-reviewed-main`. Your
   worktree may have been cut from `origin/main`, which can be behind or ahead of the reviewed base. If the second
   command does not print `based-on-reviewed-main`, move your (still unchanged) branch onto it with
   `git reset --keep 40d470fb3` — do NOT merge (newer data commits conflict on generated files). Then
   `git log --oneline -1` must show `40d470fb3`; if the reset is refused, STOP. Use `40d470fb3` wherever the plan's drift check
   or done criteria name a commit.
2. `npm ci --no-audit --no-fund` (the worktree has no `node_modules`).

**Never do these** (each is a STOP condition if a step seems to need it):
- `git push`, opening a PR, merging, or touching any branch other than the one you are on.
- `node scripts/bump-version.mjs`, `node scripts/record-fix.mjs`, `node scripts/apply-pending-records.mjs --apply`.
- Running producers: `scripts/fetch-*.mjs`, the data `scripts/build-*.mjs` / `scripts/refresh-*.mjs`,
  `sync-screener-universe`, `sync-data-release-manifests`. They run only in GitHub Actions.
- Editing `public-data/**` (producer output), `CHANGELOG.md`, `version.json`, `_context/BUG-POSTMORTEM.md`,
  `_context/RULES.md`, `_context/QA-CHECKLIST.md`, `AGENTS.md`, `CLAUDE.md`, or generated files
  (`_context/CURRENT-STATE.md`, `_context/CONTEXT-CATALOG.json`, `.agents/**`, `.claude/agents/**`, `.codex/agents/**`,
  `architecture/browser-data-fixture.json`) — unless the plan's Scope lists the file.
- Editing anything under `_archive/` or `_backup/` (a hook denies it).

**How to edit:** use your file-edit tool, never `sed`/heredoc on JS (backslashes get eaten on this platform). Run
`node --check <file>` on every `.js`/`.mjs` you touch. Line endings are LF. Match the surrounding style; change only
the lines the plan needs.

**Comments and tests (two ratchets will fail otherwise):**
- A comment in product source (`src/`, `js/`, `index.html`, `sw.js`) says what the code does. Do not put release
  numbers or `P1234` ids in new product-source comments.
- A new assertion in a gate script cites the next release as `v59.97` in its label (e.g. `check('v59.97 ...', ...)`
  or `fail('v59.97: ...')`).
- Do not add a new check that matches product *source text* with a regex/`includes` (text pin). Test behaviour:
  import the module and call it, or spawn the script and read its output.

**Recording your change (instead of the ledgers):** write one JSON file at
`_artifacts/pending-records/plan-NNN/<slug>.json` (NNN = this plan's number). Shape:

```json
{
  "version": "v59.97",
  "date": "2026-11-10",
  "p": { "title": "v59.97 <one line>", "symptom": "...", "root_cause": "...", "fix": "...",
         "violated_rule": "...", "prevention": "...", "verification": "...", "files": ["repo/relative/path"] },
  "r": null,
  "changelog": ["**Lead ({P}):** what changed and why, one or two sentences."],
  "note": "v59.97: <short>"
}
```

`p` is for a defect. For a cleanup/feature that is not a defect, omit `p` and `r` entirely and write the changelog
lead as `**Lead (v59.97):** ...` (no `{P}`). Validate it with
`node scripts/apply-pending-records.mjs --dry-run` → exits 0.

**Verification commands**
| Purpose | Command | Expected |
|---|---|---|
| Syntax of one file | `node --check <file>` | exit 0 |
| Cheap preflight (≈45 s) | `node scripts/qa-runner.mjs fast` | `fail=0` in the SUMMARY line |
| All non-browser gates (≈2–4 min) | `node scripts/qa-runner.mjs contracts --keep-going` | SUMMARY shows only the known failure below |
| Whitespace | `git diff --check` | no output |

**Known local failures to ignore** (unrelated to your change — unless your plan is the one fixing it):
`publish-data-commit` (its test stub cannot be spawned on Windows); `browser-data-pin-drift` (appears when a data
commit landed after the last pin); and `generated-state` **only if** your plan edits `index.html`, a `js/aio-*.js`
file, or adds/removes a file under `_context/`, `.claude/` or `scripts/ci-*.mjs` — `_context/CURRENT-STATE.md` records
their line/byte counts and totals, and the reviewer regenerates it once at integration (do not run
`generate-workspace-state.mjs --write` yourself: every branch doing so would conflict). Also expected until integration: `assertion-trace` when you added `v59.97` assertion labels (the `## v59.97` CHANGELOG heading does not exist yet; the reviewer creates it when the pending records are applied), and the `knowledge-lint` "generated context catalog matches the filesystem" check when you edited a file under `_context/` (the catalog is regenerated at integration). `apply-pending-records --dry-run` may print v59.93 as the target release; that is fine. Any *other* failing gate is
yours to fix or a STOP condition. Do **not** run the browser groups (`qa-runner full`, `affected` without `--files`); the
reviewer runs them once after integration. A single browser gate named in your plan is fine.

**Git workflow:** you are on a worktree branch created for you. Commit your work there (one commit per logical
step is fine). Message style from this repo's history: `fix(portfolio): a refused cash amount stays in its box`,
`design: prune dead rules from the legacy important debt files`, `chore: regenerate context catalog`. End the message
with a blank line and `Co-Authored-By: Claude <noreply@anthropic.com>`. Never push.

**Product rules that bind any text or behaviour you add:** no invented numbers; a missing value stays missing (never
0 or a guess); a stale value shows its date; no ticker guessing; no trade instructions (entry/stop/target/size); no
emoji; no developer wording on user-facing surfaces.

**Report format (your final message, exactly):**
```
STATUS: COMPLETE | STOPPED
STEPS: per step — done/skipped + the verification command and its result
STOPPED BECAUSE: (only if STOPPED) which STOP condition, what you observed
FILES CHANGED: list
NOTES: deviations, surprises, judgment calls, anything the reviewer must check
```
Before reporting, check every claim against an actual tool result from this session. If a verification failed or was
skipped, say so plainly.

Plan-specific:
| Purpose | Command | Expected |
|---|---|---|
| Unit gate | `node scripts/ci-esm-core-unit-check.mjs` | exit 0 |
| Readers agree | `node scripts/ci-metric-consistency-check.mjs` | exit 0 |
| Replay and wording fixtures | `node scripts/ci-crash-replay-check.mjs`; `node scripts/ci-scenario-guidance-fixture.mjs`; `node scripts/ci-pipeline-semantics-check.mjs` | exit 0 |
| Find tests of a function | `git grep -n "<function name>" -- scripts` | where to add assertions |

## Scope

**In scope**
- The lines named in Parts A–G in: `market-story.js`, `macro-chapters.js`, `market-read.js` (only ~648, ~1334,
  ~1670), `cross-readings.js`, `market-flow.js`, `page-flow.js`, `volatility.js`
- `src/domain/rules/thresholds.js` — only to add named band constants a part needs (C, F, G)
- `scripts/ci-esm-core-unit-check.mjs` — new `v59.97` assertions
- `_artifacts/pending-records/plan-030/` — one JSON per completed part (you may group B–G into one record
  "shared bands and proxy names" and keep A separate)

**Out of scope**
- The credit axis and `creditJudgement` (plan 029). Threshold values. UI files. `js/**`.

## Steps

### Part A — the direction word follows the printed 10-year
- `ratesOf`: decide `flat` vs moved and the direction from `ten.bp` (the printed span). Keep the real/breakeven
  shares against the FRED total `d` (they decompose the FRED move): when the printed move is ≥ 10bp in absolute
  terms but the FRED total is under 10bp or has the opposite sign, the decomposition is not usable. `RATE_READ.mixed`
  (~line 152) and the 매크로 `mixed` text both say "실질금리와 기대인플레가 함께 움직여 한쪽으로 읽기 어렵습니다" — a
  real/breakeven claim that would be false here — so add one new kind for this case (e.g. `'undivided'`) with a
  neutral reading in each file: `10년 금리가 움직였지만 실질금리·기대인플레로 나눠 읽을 수 없습니다` (keep the
  sentence style of the neighbouring readings). When the market span is missing, `ten` is the FRED span and nothing
  changes.
- Neither `ratesOf` nor the 매크로 rates function is exported: tests and the replay go through `buildMarketStory`
  and `buildMacroChapters`.
- `macro-chapters.js` rates chapter: same rule — `flat` and direction from the span that is printed in the bar.
  Read how `ten`, `market`, `real`, `be` are used below (growth-scare logic etc.) and keep every other use.

Tests (`v59.97`): a history where ^TNX moved +11bp and FRED +8bp over the window → the 시장 이야기 rates
confirmation is not the flat reading and its direction matches the printed sign; the reverse (^TNX +8, FRED +11) →
flat reading; both +12 with real-yield share ≥ 0.6 → the existing `real-up` reading. Same two boundary cases for the
매크로 rates chapter. Then replay the published files: with a temp script outside the repo, run both functions over
the last 120 sessions of `public-data/history.json` / `macro-history.json` and count days where the printed bp is
≥ 10 in absolute value and the reading is the flat one (must be 0), and the reverse (must be 0). Report the counts
before and after.

### Part B — name the proxy that is checked
Replace 나스닥 100 in that hold text with the leadership proxy's own label (import or reuse the constant the
leadership axis prints; if there is none, use `반도체(SOXX)`). Test: assert the conflict text contains the proxy
label and not `나스닥 100` (find how the unit gate reaches this branch; if it cannot, change without a test).

### Part C — the sentence states its own threshold
Add `breadthCross: { broadAbovePct: 55, narrowBelowPct: 45 }` (or the naming style `RULES` already uses) to
`thresholds.js`, use the two constants in the three conditions, and build the flip sentence from
`narrowBelowPct` ("이 비율이 45% 아래로 내려가면 …"). Test: breadth 48 with the index below its 50-day → the middle
sentence; 44 → the broad-weakness sentence; the ≥ 55 sentence contains `45%`.

### Part D — one definition of extreme fear
`fearful` uses the gauge's band: `fearGreedBand(fg).label === '극단 공포'` (the band rounds first — 24.6 reads
공포 — so a raw `fg < 25` comparison is not equivalent; use the band function). Test: at 25 and at 24.6 the
cross-reading does not say 극단 공포; at 24 it does.

### Part E — counts from the printed value
Use `directionOf(row.daily, 1)` for the up/down counts and the risen/fallen lists. Note `up`/`down` also feed
`kind` (the broad-sector count), so the kind can change on a day with near-zero sectors — that is intended. Test: a
sector at +0.04 is in neither list and neither count.

### Part F — one rank wording
Export one helper from `market-read.js` (`page-flow.js` already imports from it; `market-read.js` never imports
`page-flow.js`, so there is no cycle) that returns the whole rank phrase for a percentile with the 60/40 bands (both
templates embed a phrase such as "상위 N%에 드는 많은 편" / "중간쯤", not a single word — read both templates and
return what they need), and call it from both places. Test the helper directly: percentile 55 → the 중간쯤 phrase;
65 → 많은 편; 35 → 적은 편; and one `page-flow` output at 55. (The `market-read.js` site only fires at six or more
distribution days; if it cannot be reached in a unit case, test the helper and say so.)

### Part G — one VIX band ladder
The shared name for VIX 18–25 is **"통상 범위"**: `src/domain/macro/volatility.js`, `narrative.js` and the
position-sizing labels use it, and `scripts/ci-domain-parity-check.mjs` (~lines 330, 354, 377) pins the ladder
저변동 / 통상 범위 / 변동성 경계 / 고변동; the edges already live in `RULES.volatility` (calmBelow 18, stressAt 25,
highAt 32). Only `market-read.js` ~1334 says "주의 구간". Change that one site to read the band name from the same
function the 매크로 file uses (`vixBand` — find its export) instead of its own string. Do not add a second ladder.
Test: VIX 21 gets "통상 범위" from the 시장 상태 volatility read; `node scripts/ci-domain-parity-check.mjs` exit 0.

### Finish
All gates in the commands table, then `node scripts/qa-runner.mjs contracts --keep-going`. Do not edit an existing
expectation: list any case that flips and STOP that part. Pending records (defects, `p`).
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Per part. Each new assertion must fail on the old source (copy-aside method).

## Done criteria

- [ ] Part A replay: 0 days where a ≥ 10bp printed move reads flat, in both functions
- [ ] `git grep -n "나스닥 100 약세가 풀릴" -- src` → nothing; `git grep -n "50% 아래로 내려가면" -- src/domain/market/regime/cross-readings.js` → nothing
- [ ] Unit, metric-consistency, crash-replay and fixture gates exit 0 with no edited expectation
- [ ] `git status --short` shows only in-scope paths; the report lists per part: completed / skipped, tested / untested

## STOP conditions (per part)

- A: a wording or text-budget gate rejects the new neutral reading — report its message.
- F: the two files cannot share a helper without an import cycle or a layering-gate failure.
- G: the 시장 상태 volatility sentence cannot take the shared band name without changing its meaning (e.g. it says "주의" as a judgement, not a band name) — report the sentence.
- Any part: an existing expectation flips.

## Maintenance notes

- Reviewer: browser groups after integration; read 시장 상태 (금리 축, 변동성, 교차 해석), 매크로 금리 장, 오늘의
  시장 이야기 on real data.
- The class behind all seven: a sentence owns a private copy of a threshold or a source. New judgement text should
  take both from the module that prints the number.
