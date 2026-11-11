# Plan 007: Legacy scripts drop functions and globals nothing calls

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- js/ scripts/ci-runtime-contract-check.mjs`
> If any changed, re-run the per-symbol greps in Step 1 before trusting the list; a symbol that gained a caller is
> simply dropped from the list (not a STOP).

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW–MED (classic scripts share one global scope; a missed dynamic caller is a runtime ReferenceError)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

`js/aio-core.js`, `js/aio-data.js`, `js/aio-ui.js` and `js/aio-chat.js` are the legacy classic scripts the project is
migrating out of (owner decision: "Merges move legacy js/ to src/, deleting replaced code"). The first three are
parsed on every page boot and count against the classic boot budget (target 1,000,000 raw bytes; currently above
it). They still carry functions whose only references are their own definition, a `window.X = X` export, and in some
cases an in-browser test that keeps the dead function alive. One such leftover call already caused a silent runtime
error (a call to a deleted function, fixed in v59.93). This plan deletes the confirmed-dead ones together with the
tests that only test them.

## Current state

Candidate list. "Refs" = every `git grep -n -w <name> -- js src index.html scripts` hit at the planned commit.

| # | Symbol | Definition | Other refs |
|---|---|---|---|
| 1 | `_wordHit` | `js/aio-core.js:1143` (`window._wordHit = function(text, kw)`, comment block from 1137) | `js/aio-tests.js:507-520` (T71, T72) |
| 2 | `_aioSetupCanvas` | `js/aio-core.js:1207` (comment from 1203) | `js/aio-tests.js:593-602` (T78) |
| 3 | `_fmtNum`, `_fmtPct` | `js/aio-core.js` near the end of the file (~14747 and ~14757; the two comment lines above `_fmtNum` belong to it); exports are the last two lines | `js/aio-tests.js:849-850` is only a comment (it heads the live T102 asserts at 851-852 — those stay) |
| 4 | `_aioValidateFetchResult` | `js/aio-chat.js:3178` (comment 3175), export 3197 | `js/aio-tests.js:3028-3040` (T634 **and T635**) |
| 5 | `_aioNextMonthlyOpex` | `js/aio-core.js:10650`, export 10664 | `js/aio-tests.js:8465-8473` (function `_testOpexCanonicalDate`) **and its registry row** `{ id:'G110', name:'_testOpexCanonicalDate', run:_testOpexCanonicalDate }` at ~8644 |
| 6 | `_aioMemoStaleInfo` | `js/aio-core.js:11033` | `js/aio-tests.js:831-846` (T101) |
| 7 | `_aioHistorySeries` — **KEEP, do not delete** | `js/aio-data.js:3259` | `scripts/ci-history-v2-browser-fixture.mjs:60` calls `window._aioHistorySeries(field, 2)` in the browser and compares the series; it is a live test seam |
| 8 | `renderDataQualityBadge` | `js/aio-ui.js:896`, export 936 | `js/aio-tests.js:989` |

Write-only globals (assigned once, read nowhere in `js/`, `src/`, `index.html`, `scripts/`):
`window._aioLastAiError` (`js/aio-core.js:227`), `window._aioLastAIContextBudgetAudit` (`js/aio-core.js:4572`),
`window._liveVIXCLS` (`js/aio-data.js:2641`), `window._aioSWCheckedAt` (`js/aio-data.js:2966`),
`window._newsBackstopApplied` (`js/aio-data.js:3182`), `window._btcDominanceTop4` (`js/aio-data.js:4850`),
`window._liveQuoteTimestamp` (`js/aio-data.js:6520`), `window._aioWebSearchCapped` (`js/aio-chat.js:3056`).

Deliberately NOT in this plan (do not touch): `_aioUppercaseInput`, `_aioChartAnalyze`,
`_aioTacticalTraderFrameworkContext` (each is named by an assertion in `scripts/ci-runtime-contract-check.mjs`);
`getApiKey` (two definitions, a test asserts it exists); the `window.__aio*` handles under `src/ui/components/`
(console debugging handles).

How things are wired:
- Classic scripts are plain `<script defer>` files sharing the global scope; `window[name]` dispatch exists for
  `data-action` / `data-on-enter` attributes (`js/aio-core.js` near line 1808) — attribute values are in `index.html`
  and in renderers under `src/ui/`.
- `js/aio-tests.js` is an in-browser test file loaded only on demand (`AIO.loadTests()`), run in CI by
  `scripts/ci-headless-tests.mjs` (report-only). Its tests are `_assert('Tnn name: …', condition)` blocks, usually
  wrapped in `if (typeof window.X === 'function') { … } else { _assert('… 미존재 (missing)', false); }`.
- The repo has reachability tooling: `node scripts/dead-code.mjs report` (read-only). Never run its `remove`
  subcommand (it edits files). Use the report as a second opinion; the per-symbol grep below is the authority.

## Commands you will need

## Repository rules (apply to every plan)

You are working in a git worktree of **AIO Screener** — a static GitHub Pages investment-research app: `index.html`
shell + legacy classic scripts `js/aio-*.js` + native ESM under `src/`, with Node ESM gate/producer scripts under
`scripts/` and registries under `architecture/`. UI text is Korean. Platform is Windows with Git Bash; Node is on PATH.

**Setup (first commands in the worktree):**
1. `git log --oneline -1` and `git merge-base --is-ancestor dec244452 HEAD && echo based-on-reviewed-main`. Your
   worktree may have been cut from `origin/main`, which lacks the reviewed local commits. If the second command does
   not print `based-on-reviewed-main`, run `git merge --no-edit dec244452` (expect a fast-forward or a clean merge;
   on a conflict, STOP). The plan's "Planned at `813371fc5`" commit is contained in `dec244452`; use `dec244452`
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
| Refs for one symbol | `git grep -n -w "<name>" -- js src index.html scripts` | only the definition, its `window.` export, comments, and the test refs listed above |
| Dynamic dispatch check | `git grep -n "<name>" -- index.html src` and `git grep -n "data-action=\|data-on-enter=" -- index.html src \| grep "<name>"` | no hits |
| Syntax | `node --check js/aio-core.js && node --check js/aio-data.js && node --check js/aio-ui.js && node --check js/aio-chat.js && node --check js/aio-tests.js` | exit 0 |
| Legacy contract gates | `node scripts/ci-runtime-contract-check.mjs` | exit 0 |
| Headless in-browser tests (browser gate, optional) | `node scripts/ci-headless-tests.mjs` | runs; no test newly reports "미존재 (missing)" |
| Classic boot bytes | `node scripts/ci-boot-bundle-budget-check.mjs` | exit 0 (bytes go down; do not edit the budget file) |

## Scope

**In scope**
- `js/aio-core.js`, `js/aio-data.js`, `js/aio-ui.js`, `js/aio-chat.js` — only the definitions/exports/assignments listed
- `js/aio-tests.js` — only the test blocks that exercise a deleted symbol
- `_artifacts/pending-records/plan-007/dead-legacy-functions.json` (create)

**Out of scope**
- `architecture/boot-budget.json` (budgets are the owner's; the reviewer lowers them).
- `scripts/ci-runtime-contract-check.mjs` and every symbol it names.
- Any refactor, rename or "while I'm here" cleanup. Any function not in the table.
- `src/**`.

## Steps

### Step 1: Re-verify every candidate
For each of the 8 rows and each write-only global, run the two search commands. Build a keep/delete table:
**delete** only if the hits are exactly: definition, `window.` export, comments, and `js/aio-tests.js` blocks (plus,
for row 7, the fixture). Anything else — a call in `src/`, an attribute value, a string that builds the name — means
**keep** and note why. For each write-only global, also read the 3 lines around the assignment: if the right-hand
side is a call with side effects, keep the call and drop only the `window.X =` part.

**Verify**: the table is in your report; every "delete" row lists its hits.

### Step 2: Delete the functions, one symbol per commit-sized edit
For each "delete" symbol: remove the definition, its explanatory comment block (only the comment that describes that
symbol), and its `window.` export. Then run the syntax command for that file. For row 3 the exports are the last
lines of `js/aio-core.js` — keep the file ending with a newline.

**Verify** after each file: `node --check <file>` → exit 0; `git grep -n -w "<name>" -- js src index.html scripts`
→ only `js/aio-tests.js` hits (handled next) or none.

### Step 3: Remove the tests that only test deleted symbols
In `js/aio-tests.js`, delete each whole test block (the comment line naming the test, the `if/else` wrapper and its
`_assert` calls) for T71, T72, T78, T101, T634, T635, the function at ~8465-8473 for `_aioNextMonthlyOpex` (plus its G110 row), and
`renderDataQualityBadge` (~989) — but only the part that needs the deleted symbol. If a block
also asserts something else that is still alive, keep that assertion and remove only the dead part. Read 30 lines
around each before cutting; test ids are sequential labels, do not renumber the others. Also delete the stale
comment at 849-850 about `_fmtNum`.
Row 7 (`_aioHistorySeries`) is KEEP: leave the function, its export and the T796 block at ~5511 untouched.
For row 5, delete the `G110` registry row together with the function it names — leaving the row would throw a
ReferenceError when the test bundle loads and kill every test. (`ci-qa-pipeline-contract-check` requires at least 100
`G###` ids; 110 remain.)

**Verify**: `node --check js/aio-tests.js`; `git grep -n -w` for every deleted name → no hits outside comments in
`_artifacts/` or ledgers.

### Step 4: Write-only globals
Delete the `window.X = …` statements that Step 1 marked delete (keep side-effecting right-hand sides as bare
statements, keep surrounding control flow valid — if the assignment is the only statement in an `if`, remove the
`if` as well only when its condition has no side effects).

**Verify**: syntax command for all five files → exit 0.

### Step 5: Gates
Run `node scripts/ci-runtime-contract-check.mjs`, `node scripts/ci-boot-bundle-budget-check.mjs`,
`node scripts/ci-syntax-check.mjs`, then `node scripts/qa-runner.mjs contracts --keep-going`. The `generated-state`
gate WILL fail for this plan (the byte/line counts of the `js/` files changed); that is expected — see the known
failures note above.
Run `node scripts/ci-headless-tests.mjs` once if a browser can launch; report the pass/fail counts before
(`git stash` → run → `git stash pop`) and after, or say it could not run.

**Verify**: no new failures; the classic boot byte total printed by the budget gate is lower than before (record
both numbers).

### Step 6: Pending record
Change-only entry (no `p`): list the symbols removed and the byte change. **Verify**:
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

No new tests (this removes code). Evidence: zero remaining references per symbol, syntax checks, the legacy contract
gate, and the headless test run not reporting any newly missing function.

## Done criteria

- [ ] For every deleted symbol, `git grep -n -w "<name>" -- js src index.html scripts` returns nothing
- [ ] All five `node --check` commands exit 0
- [ ] `node scripts/ci-runtime-contract-check.mjs` and `node scripts/ci-boot-bundle-budget-check.mjs` exit 0
- [ ] `git status --short` shows only in-scope paths
- [ ] The report has the keep/delete table and the before/after classic boot bytes

## STOP conditions

- A gate asserts that one of the listed symbols exists (other than the three already excluded) — keep that symbol,
  report the gate; STOP only if this affects more than three symbols.
- `node --check` fails and the cause is not obvious from the diff.
- You find yourself wanting to change a caller in `src/` — a symbol with a caller is "keep", not "fix the caller".

## Maintenance notes

- Reviewer: these files are boot-critical and have 50+ past defects recorded against `js/aio-core.js`. Read the full
  diff; it must contain deletions only (plus at most bare-statement rewrites in Step 4). Run the browser groups after
  integration — a missed dynamic caller shows as a console ReferenceError on some route.
- The classic boot budget in `architecture/boot-budget.json` can be lowered to the new measured value at integration.
