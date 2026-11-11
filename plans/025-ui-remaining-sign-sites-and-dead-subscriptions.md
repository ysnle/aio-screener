# Plan 025: The remaining raw-sign sites follow the printed value; dead subscriptions and one over-claim go

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The parts are independent: if one hits a STOP condition, finish the others and report the stopped part.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- src/ui src/app/bootstrap.js src/domain/briefing/day-account.js`
> If a file named below changed, compare its excerpt with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (display text and classes; removal of subscriptions nothing fires)
- **Depends on**: none
- **Category**: bug / tech-debt
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

v59.95 made the ticker hero, the 코스피 chip, the sector hero and the screener inspector follow the project's rule
(`src/domain/shared/number.js`, v58.80): the sign, colour and direction word of a change follow the *printed* value,
so a change that rounds to zero is flat. The executor of that change listed the same pattern at seven more sites it
was not allowed to touch. They print things like `-0.0%`, colour an unchanged value as rising, or colour a `0.0%`
row as falling. This plan finishes the class, removes two event subscriptions that nothing has dispatched for a
long time, and rewrites one sentence that states a cause the data does not show.

## Current state

**Helpers** (`src/domain/shared/number.js`): `signedText(value, digits = 1, unit = '', { plus = true } = {})` — the
sign is chosen after rounding, a value that rounds to zero is unsigned; `directionOf(value, digits = 1)` — `null`
when missing or rounding to zero, else `'up'` | `'down'`.

**Part A — raw-sign sites** (line numbers at the planned commit; locate by the quoted text):
1. `src/ui/components/market-story.js` ~29:
   ``el(doc, 'span', `${row.pct > 0 ? '+' : ''}${row.pct.toFixed(1)}%`, 'briefing-move-value')`` — prints `-0.0%`.
2. `src/ui/components/korea-participation.js`: the local `pc()` formatter (find its definition with
   `grep -n "const pc\|function pc" src/ui/components/korea-participation.js`; it prints `+0.0%`/`-0.0%`) and ~87:
   ``el(doc, 'span', null, `kr-flow-col ${point.value >= 0 ? 'is-up' : 'is-down'}`)`` (a net-buy amount in 억원;
   zero is neither).
3. `src/ui/pages/screener/validation-tab.js` ~199–200 and ~259–261:
   ``scr-ic-fill ${value == null ? '' : value >= 0 ? 'is-up' : 'is-down'}`` with the fill anchored left/right of 50%.
4. `src/ui/components/theme-playbook-view.js` ~451 (`row.ret1m >= 0 ? 'is-up' : 'is-down'`) and ~635
   (``is-num${value == null ? '' : value >= 0 ? ' is-up' : ' is-down'}``), both beside a `pct(...)` text.
5. `src/ui/components/portfolio-backtest-lab.js` ~116: `(p.activeReturn >= 0 ? 'is-up' : 'is-loss')` beside
   `fmtPct(p.activeReturn)` (HTML built by string concatenation).
6. `src/ui/pages/themes/sectors.js` ~286:
   ``bar.className = `thp-perf-bar ${row.pct >= 0 ? 'thp-perf-bar--up' : 'thp-perf-bar--down'}` ``.
7. `src/ui/pages/screener/inspector.js` ~145:
   ``moveNode.className = `scr-why-move ${whyRet1m == null ? '' : whyRet1m >= 0 ? 'sx-up' : 'sx-down'}` ``.

The direction must use the same decimals the neighbouring text prints. Measured at the planned commit (confirm each):
- market-story (~30): 1 decimal; the file already imports `signedText, directionOf`.
- korea-participation: `pc()` at ~line 42 prints 1 decimal; the `kr-flow-col` class is at ~88; the file imports
  `directionOf` only.
- validation-tab first block (~199): the text is `value.toFixed(3)` (a tiny negative prints `-0.000`) → use 3 digits;
  second block (~259): `signedText(value, 2)` → 2 digits. The file imports `signedText` and `finite`; add `directionOf`.
- theme-playbook-view (~451 and ~635): 1 decimal; note line ~635 has a leading space inside the class string
  (`' is-up'`). The file imports `signedText`; add `directionOf`.
- portfolio-backtest-lab (~116): `fmtPct` is `signedText(v * 100, d ?? 2, '%')`, so the direction is
  `directionOf(p.activeReturn * 100, 2)`; the neutral class already in use is `is-plain`, the down class is
  `is-loss`. The file imports `signedText`; add `directionOf`.
- themes/sectors (~286): digits are 2 when `mode` is `'1d'` or `'1w'`, otherwise 1 (see ~292–294); the file has a
  helper `dirColor(value, digits)` — reuse its digits rule.
- screener/inspector (~145): 1 decimal; the file imports `signedText, directionOf, finite`.

**Part B — subscriptions nothing dispatches.** `git grep -n "aio:macroUpdated\|aio:themesHistoryLoaded" -- src js`
returns only listeners: `src/app/bootstrap.js` ~823 (`legacy.on('aio:macroUpdated', syncMarket.sync)`) and ~825
(`legacy.on('aio:themesHistoryLoaded', syncThemes.sync)`), `src/ui/pages/market.js` ~358 (in a list of event names)
and `src/ui/pages/themes.js` ~173 (in a list of event names). No `dispatchEvent`, `emit` or string-built name
produces either event (verify — also search `scripts/` gates for tests that fire them:
`git grep -n "macroUpdated\|themesHistoryLoaded" -- scripts`).

**Part C — an over-claim in the briefing opening.** `src/domain/briefing/day-account.js`, function `indexLine`:

```js
    const rest = spx.change >= 0 ? '지수보다 나머지 종목이 더 강했습니다'
      : rsp.change > 0 ? '지수 하락은 대형주 몇 곳에 몰렸고 나머지 종목은 오히려 올랐습니다'
        : '지수 하락은 대형주 몇 곳에 몰렸고 나머지 종목은 덜 내렸습니다';
```

The only inputs are the cap-weighted S&P 500 and its equal-weight twin. Equal weight beating cap weight shows that
larger-cap names fell more than the average name; it does not show that the fall sat in "a few" (몇 곳) stocks.
Tests: `scripts/ci-esm-core-unit-check.mjs` has a `v59.93` block asserting `/지수 하락.*오히려 올랐습니다/` and
`/지수 하락.*덜 내렸습니다/` (those two regexes still match the new wording below; do not change the test).

**Part D — one silent catch that hides a second render.** `src/ui/pages/themes.js` ~line 199 (the grep
`grep -n "renderThemeDetailPlaybook" src/ui/pages/themes.js` also returns the import and a different block at ~124 —
this part is the one at ~199; list the ~124 block in NOTES, do not change it):
`try { renderThemeDetailPlaybook({ documentRef, root }); renderThemeDetailTeach({ documentRef, root, store }); } catch (_) {}`
— a throw in the first skips the second, with no trace. The project logs through `root._aioLog?.('warn', scope, message)`.

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
| Continuity gate (mounts pages) | `node scripts/ci-desktop-continuity-check.mjs` | exit 0 |
| Find a test seam for a renderer | `git grep -n "<exported function name>" -- scripts` | where to add an assertion |

## Scope

**In scope**
- The files and lines named in Parts A–D
- `scripts/ci-esm-core-unit-check.mjs` (new `v59.97` assertions)
- `_artifacts/pending-records/plan-025/` — one JSON per completed part (create)

**Out of scope**
- `src/domain/shared/number.js`, CSS files, `js/**`, every other wording on these screens.
- Any other site with the pattern — list it in NOTES.

## Steps

### Part A — seven sites
For each: compute the direction once with `directionOf(value, digits)` and print with `signedText(value, digits, unit)`
(or keep the file's formatter when it already rounds the same way and only the class is wrong). Flat gets no
up/down class (use the empty string or the neutral class the file already uses for a missing value). For the two
`scr-ic-fill` bars, a flat value draws no fill (width 0) — keep the anchoring logic for non-flat values. For the
`kr-flow-col` bars (amounts, not percentages) treat exactly 0 as flat: no `is-up`/`is-down`.
Import the helpers from `src/domain/shared/number.js` using the file's existing import of that module if it has one.

Tests (`v59.97`): for at least three sites that export a renderer or a pure helper (check each with the grep
above), call it with a fake document the way the nearest existing test does, with values `0`, `-0.04`, `0.04`,
`1.26`, `-1.26`, and assert: no up/down class and no leading sign for the first three, correct class and sign for
the last two. Sites with no reachable seam are changed without a test — list them.

**Verify**: unit gate exit 0; each new assertion fails with its source file restored to HEAD (copy your version
aside to a temp folder outside the repo, restore, run, copy back — do not use the shared stash).

### Part B — remove the dead subscriptions
Only if the grep still shows no dispatcher and no gate fires the events: in `bootstrap.js` remove the two
`legacy.on(...)` registrations **and** every use of their returned stop functions (`stopMacroUpdated`,
`stopThemesHistory`) in the teardown; in `market.js` and `themes.js` remove the two names from the event-name lists.
If a gate dispatches either event to exercise a repaint, leave that subscription and report it.

**Verify**: `git grep -n "aio:macroUpdated\|aio:themesHistoryLoaded" -- src js` → nothing;
`node --check` on the three files; unit gate and continuity gate exit 0.

### Part C — say what the two figures show
Replace `대형주 몇 곳에 몰렸고` with `시가총액이 큰 종목에 더 실렸고` in both strings (nothing else in the sentence
changes).

**Verify**: unit gate exit 0 (the `v59.93` block still passes); `git grep -n "대형주 몇 곳" -- src` → nothing.

### Part D — two renders, two guards
Split the `try` into one per render call and log each failure:
`catch (error) { root._aioLog?.('warn', 'themes', `테마 상세 플레이북 렌더 실패: ${error?.message || error}`); }` (and the
same shape for the teach list). The window object in that scope is `root` (other code guards with `typeof root._aioLog === 'function'`).

Test (`v59.97`): if the themes page has a mount test that can stub `renderThemeDetailPlaybook` to throw, assert the
teach render still ran; otherwise no test — say so.

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. One pending record per completed
part (A and C and D are defects — `p` entries; B is change-only). `node scripts/apply-pending-records.mjs --dry-run` → 0.
Say in NOTES that nothing was checked in a browser.

## Test plan

Per part above.

## Done criteria

- [ ] `git grep -nE ">= 0 \? '? ?(is-up|sx-up|thp-perf-bar--up)" -- src/ui/pages/screener/validation-tab.js src/ui/components/theme-playbook-view.js src/ui/components/portfolio-backtest-lab.js src/ui/pages/themes/sectors.js src/ui/pages/screener/inspector.js src/ui/components/korea-participation.js` returns nothing
- [ ] No listener for the two dead events remains (or the report says which gate needs it)
- [ ] Unit gate and continuity gate exit 0; contracts show only the expected failures
- [ ] `git status --short` shows only in-scope paths; the report lists tested and untested sites

## STOP conditions (per part)

- A: a site has no neutral state and would need new CSS; or a wording/text-budget gate rejects a changed string.
- B: something dispatches the event after all, or the stop functions are passed to code you cannot follow.
- C: an existing assertion pins the exact old wording (report it; do not edit an existing expectation).
- D: the two calls share state such that running the second after the first failed would itself throw.

## Maintenance notes

- Reviewer: browser groups after integration; look at 오늘(브리핑 움직임 막대), 한국 참여 블록, 스크리너 검증 탭,
  테마 플레이북, 포트폴리오 백테스트, 테마 · 섹터 성과 막대.
- After this plan, a gate that fails on any new `>= 0 ? '…up'` beside a rounded text would stop the class from
  coming back; that is a separate decision.
