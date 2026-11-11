# Plan 019: Arrows, colours and comparison words follow the printed number; refresh repaints reach the pages

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The three parts are independent: if one part hits a STOP condition, finish the others and report the stopped part.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- src/ui/pages src/ui/components src/domain/shared/number.js`
> If a file named below changed, compare its excerpt with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (display text and classes; one event-target change that only adds repaints)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

The project's own rule (v58.80, `src/domain/shared/number.js`): the sign, arrow and colour of a change follow the
*printed* value — a change that rounds to zero is flat, not rising or falling. Several renderers still decide from
the raw value. Executed: the ticker hero prints `▲ +0.00%` in the rising colour for an unchanged quote and
`▼ 0.00%` in the falling colour for −0.001; the screener inspector prints `S&P 500보다 0.0%p 낮습니다`. Separately,
seven pages listen for the refresh-finished event on `document` while it is only ever dispatched on `window`, so that
repaint path is dead; and the screener's ranking-weights hover is overwritten by a second assignment a few lines later.

## Current state

**Helpers** — `src/domain/shared/number.js`:

```js
export function signedText(value, digits = 1, unit = '', { plus = true } = {}) { … `${Number(text) === 0 ? '' : number > 0 ? (plus ? '+' : '') : '-'}${text}${unit}` }
export function directionOf(value, digits = 1) { … returns null when the value is missing or rounds to zero, else 'up' | 'down' }
```

**Part A — sign/arrow/colour sites** (each decides from the raw value):
- `src/ui/pages/entity.js:192-194` (ticker hero):
  `` `${pct >= 0 ? '▲ +' : '▼ '}${Math.abs(pct).toFixed(2)}%` `` and
  `` change.className = `ticker-chg-big ${pct == null || closeLabel ? '' : pct >= 0 ? 'up' : 'down'}` ``
- `src/ui/pages/market.js:143-144` (`pos`/`neg` from `value.pct >= 0` / `< 0` beside a 2-decimal signed text)
- `src/ui/components/daily-loop.js:58` (`model.pct >= 0 ? 'pos' : 'neg'`)
- `src/ui/components/home-day.js:97` (`stock.change >= 0 ? 'is-up' : …` beside `signedText(stock.change, 1)`)
- `src/ui/components/market-candles.js:70-71` (`change >= 0 ? '+'` → "+0.00%" and is-up)
- `src/ui/components/market-story.js:104` (hand-made `toFixed(1)` that can print "-0.0%")
- `src/ui/pages/themes/sectors.js:81`

**Part B — comparison sentences**:
- `src/ui/pages/screener/inspector.js:212`:
  `` `3개월 수익률(…)은 S&P 500보다 ${Math.abs(excess3m).toFixed(1)}%p ${excess3m >= 0 ? '높습니다' : '낮습니다'}.` ``
- `src/ui/pages/themes/detail.js:114` (`word()` prints "0.0% 강했고" for a zero difference)
- `src/ui/pages/themes/sectors.js:393-400`, `writeSectorHero`: runs with as few as 6 sectors
  (`if (list.length < 6) …return`) but says `11개 섹터가 대부분 올랐고 …` / `내렸고`; splits strong/weak by raw
  `row.pct > 0` while printing one decimal (a sector at +0.02% is listed as "+0.0%" among the strong ones).
- `src/ui/components/korea-participation.js:41-42` ("반전" claimed when `Math.sign(ret3m)` is 0 or the 1-month
  figure prints "+0.0%")

**Part C — events and hover**:
- `src/app/refresh-scheduler.js:56` dispatches `aio:refresh:<type>` on `window` only. `aio:liveDataReceived` is
  also dispatched on `window` only. Listeners on `document` only: `src/ui/pages/market.js:356-359`
  (`eventTarget = documentRef || root`), `src/ui/pages/charts.js:151`, `src/ui/pages/analysis.js:151`,
  `src/ui/pages/screener/page.js:177-179`, `src/ui/pages/entity.js:933`, `src/ui/pages/news.js:871-873`,
  `src/ui/pages/themes.js:172-173`. The working form is `src/ui/pages/sentiment.js:61-62` (listens on both).
  `market.js` also listens for `aio:macroUpdated` and `themes.js:173` for `aio:themesHistoryLoaded`; no code
  dispatches either (verify with `git grep -n "aio:macroUpdated\|aio:themesHistoryLoaded" -- src js`).
- `src/ui/pages/screener/table.js:930` sets `diagnostics.title` to the order and factor weights; line ~951 sets
  `diagnostics.title` again, unconditionally, to a fixed sentence — the weights never show.

Each page module has a mount function that registers listeners and returns/records a teardown; follow the
teardown pattern already in that file (every `addEventListener` you add needs its `removeEventListener` in the same
dispose path).

## Commands you will need

## Repository rules (apply to every plan)

You are working in a git worktree of **AIO Screener** — a static GitHub Pages investment-research app: `index.html`
shell + legacy classic scripts `js/aio-*.js` + native ESM under `src/`, with Node ESM gate/producer scripts under
`scripts/` and registries under `architecture/`. UI text is Korean. Platform is Windows with Git Bash; Node is on PATH.

**Setup (first commands in the worktree):**
1. `git log --oneline -1` and `git merge-base --is-ancestor f739db3d5 HEAD && echo based-on-reviewed-main`. Your
   worktree may have been cut from `origin/main`, which lacks the reviewed local commits. If the second command does
   not print `based-on-reviewed-main`, move your (still unchanged) branch onto the reviewed base with `git reset --keep f739db3d5` — do NOT merge:
   origin/main carries newer data commits whose generated files conflict. Then `git log --oneline -1` must show `f739db3d5`;
   if the reset is refused, STOP. The plan's "Planned at `813371fc5`" commit is contained in `f739db3d5`; use `f739db3d5`
   wherever the plan's drift check or done criteria say `813371fc5`.
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
- A new assertion in a gate script cites the next release as `v59.94` in its label (e.g. `check('v59.94 ...', ...)`
  or `fail('v59.94: ...')`).
- Do not add a new check that matches product *source text* with a regex/`includes` (text pin). Test behaviour:
  import the module and call it, or spawn the script and read its output.

**Recording your change (instead of the ledgers):** write one JSON file at
`_artifacts/pending-records/plan-NNN/<slug>.json` (NNN = this plan's number). Shape:

```json
{
  "version": "v59.94",
  "date": "2026-11-10",
  "p": { "title": "v59.94 <one line>", "symptom": "...", "root_cause": "...", "fix": "...",
         "violated_rule": "...", "prevention": "...", "verification": "...", "files": ["repo/relative/path"] },
  "r": null,
  "changelog": ["**Lead ({P}):** what changed and why, one or two sentences."],
  "note": "v59.94: <short>"
}
```

`p` is for a defect. For a cleanup/feature that is not a defect, omit `p` and `r` entirely and write the changelog
lead as `**Lead (v59.94):** ...` (no `{P}`). Validate it with
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
`generate-workspace-state.mjs --write` yourself: every branch doing so would conflict). Also expected until integration: `assertion-trace` when you added `v59.94` assertion labels (the `## v59.94` CHANGELOG heading does not exist yet; the reviewer creates it when the pending records are applied), and the `knowledge-lint` "generated context catalog matches the filesystem" check when you edited a file under `_context/` (the catalog is regenerated at integration). `apply-pending-records --dry-run` may print v59.93 as the target release; that is fine. Any *other* failing gate is
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
| Text/visual contracts | `node scripts/qa-runner.mjs contracts --keep-going` | only the known failures |
| Find tests of a renderer | `git grep -n "<function or file name>" -- scripts` | where to add an assertion |

## Scope

**In scope**
- The files and lines named in Parts A, B and C
- `scripts/ci-esm-core-unit-check.mjs` (new assertions)
- `_artifacts/pending-records/plan-019/` — one JSON per completed part (create)

**Out of scope**
- `src/domain/shared/number.js` (use it; do not change it). CSS. `js/**`. `src/app/refresh-scheduler.js`.
- Any other wording on these screens. Any site not listed, even if it has the same pattern — list it in NOTES.

## Steps

### Part A — printed-value direction
For each site: derive the direction once with `directionOf(value, digits)` using the same digits the text prints,
and build the text with `signedText(value, digits, unit)`. Flat (null direction) gets no arrow and no up/down class
(use whatever neutral class or empty class the file already uses for a missing value). Keep arrows where the
design has them: `up` → `▲ ` + signed text, `down` → `▼ ` + the absolute text as today, flat → plain `0.00%`.
Import the helpers from `src/domain/shared/number.js` (check each file's existing import of that module first).

Test (`v59.94`, unit gate): for at least the ticker hero and one component, render with a fake document the way the
nearest existing test of that module does, with `pct = 0`, `-0.001`, `0.004`, `1.234`, `-1.234`; assert no arrow and
no `up`/`down` class for the first three and the right arrow/class/text for the last two. If a site has no reachable
test seam, change it anyway (the change is mechanical) and say which sites are untested.

**Verify**: unit gate exit 0; assertions fail with the page file stashed back.

### Part B — comparison words
- Inspector: when `directionOf(excess3m, 1)` is null print `S&P 500과 비슷합니다`; otherwise as today.
- `detail.js` `word()`: a difference that rounds to zero reads `비슷했고` (match the sentence's grammar — read the
  surrounding template).
- `writeSectorHero`: replace the literal `11개 섹터` with `${list.length}개 섹터`; choose strong/weak with
  `directionOf(row.pct, 1) === 'up'` / `'down'` so a sector printing `0.0%` is in neither list.
- `korea-participation.js`: claim "반전" only when both printed directions are non-null and opposite.

Test (`v59.94`): `writeSectorHero` with 7 rows → the sentence says `7개 섹터`; inspector sentence with
`excess3m = -0.04` → contains `비슷합니다` and not `낮습니다`.

**Verify**: unit gate exit 0; contracts run shows no new text-budget or wording failure (a wording ratchet that
fails on your new sentence is a STOP for this part — report its message).

### Part C — refresh events and the hover
- In each of the seven page modules, register the `aio:refresh:done` and `aio:liveDataReceived` listeners on the
  window object the module already has (`root`), the way `sentiment.js` does, and remove them in the same teardown.
  Do not keep a second registration on `document` for those two events. Remove the `aio:macroUpdated` and
  `aio:themesHistoryLoaded` subscriptions only if the grep confirms nothing dispatches them.
- `table.js`: keep the weights hover — join the two strings into one `title` (weights sentence first, then the fixed
  sentence), assigned once.

Test (`v59.94`): for one page module with an existing mount test, dispatch `aio:refresh:done` on the fake window and
assert the repaint ran once; assert the screener diagnostics `title` contains a factor label.

**Verify**: unit gate exit 0; `node scripts/qa-runner.mjs contracts --keep-going` → only the known failures.

### Finish
One pending record per completed part (defects: `p` entries). `node scripts/apply-pending-records.mjs --dry-run` → 0.
Say plainly in NOTES that none of this was checked in a browser.

## Test plan

Per part above; each new assertion must fail on the old code (stash check).

## Done criteria

- [ ] `git grep -n ">= 0 ? '▲\|>= 0 ? 'up'\|>= 0 ? 'pos'\|>= 0 ? 'is-up'" -- src/ui/pages/entity.js src/ui/pages/market.js src/ui/components/daily-loop.js src/ui/components/home-day.js` returns nothing
- [ ] `git grep -n "11개 섹터" -- src/ui/pages/themes/sectors.js` returns nothing
- [ ] Unit gate exits 0 with the new assertions; contracts show only the known failures
- [ ] `git status --short` shows only in-scope paths; report lists per part: completed / skipped, tested / untested sites

## STOP conditions (per part)

- A: a site's code differs from the description, or the file has no neutral class and one would need new CSS.
- B: a text-budget or vocabulary gate rejects the new wording.
- C: a page has no teardown path to put the removal in, or adding the window listener makes a repaint run twice per
  refresh in a test (it then needs the dedupe the compatibility adapter has — report instead of adding one).

## Maintenance notes

- Reviewer: run the browser groups after integration; look at 종목 (hero), 오늘, 시장 상태, 테마 · 섹터, 스크리너.
- Other sites with the raw-sign pattern that this plan did not list go into a follow-up, from the executor's NOTES.
