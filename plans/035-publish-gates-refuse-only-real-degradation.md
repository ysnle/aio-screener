# Plan 035: The publish and consistency gates refuse a release only for a real degradation, in every state the data can reach

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The two parts are independent. Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- scripts/ci-refresh-artifact-integrity-check.mjs scripts/ci-data-pipeline-contract-check.mjs scripts/ci-metric-consistency-check.mjs`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (these gates decide whether data is published; a looser rule must still refuse a true regression)
- **Depends on**: none
- **Category**: bug (gates that fail on a correct product)
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

On 2026-11-10 a consistency gate refused every data release for six hours although the product was right: it had
only ever run in the states the market was in on the day it was written (fixed in v59.96 for that one state). An
audit then replayed the release-blocking gates against synthetic states and found two more of the same kind:

- **A. One failed FRED series stops all publishing.** `ci-refresh-artifact-integrity-check.mjs` refuses a refresh
  when `fredFetchOk` goes from true to not-true, unless an "explicit last-known-good boundary" holds — and that
  boundary requires the FRED **key to be absent**. With the key present (the normal case), `fredFetchOk` is true
  only when *every* expected series succeeded. So when one series fails both attempts, the producer correctly
  labels the cycle as using the last-known-good values (`fredLkgUsed: true`, `fredLkgSource:
  'previous-public-data-macro'`), and the gate refuses the whole cycle — quotes, news, history included. HEAD keeps
  saying `fredFetchOk: true`, so every later cycle is refused the same way until all series succeed in one run.
  This gate only started comparing anything on 2026-11-10 (v59.94 made it read the last published file), so the
  trap is new. Executed: 22 good series + one failed, key present → `degradedFred=true → refresh artifact integrity
  failed`. A recorded decision (P1189) says a partial-failure cycle is meant to publish.
- **B. The consistency gate fails when the product correctly withholds a stale input.** The 시장 상태 credit axis
  takes the HY spread only while it is at most 2 US sessions behind the S&P close; beyond that the axis is
  `unknown` (보류), while `creditJudgement` (used by the 매크로 chapter) has no such alignment and still returns the
  last dated state. The gate compares the two with no `unknown` guard. Executed with the real files and the last
  two HY observations removed: `axis=unknown judgement=burden chapter=burden → FAIL`. The same happens to the
  10-year assertion when `^TNX` is 3+ sessions stale. FRED skipping two days (a bond holiday plus a late
  publication) is ordinary. And the gate's only fixed-date replay (2026-11-06) silently stops running when that
  close leaves the published window, while it asserts exact values on live rows the producer may still repair.

## Current state

**A.** `scripts/ci-refresh-artifact-integrity-check.mjs` (after v59.94):

```js
const currentMeta = current.meta || {};
const previousMeta = previous?.meta || {};
const explicitFredLkgBoundary = currentMeta.fredHasKey !== true
  && currentMeta.fredFetchOk !== true
  && currentMeta.fredLkgUsed === true
  && typeof currentMeta.fredLkgSource === 'string'
  && currentMeta.fredLkgSource.length > 0;
const degradedFred = previousMeta.fredFetchOk === true
  && currentMeta.fredFetchOk !== true
  && !explicitFredLkgBoundary;
const degradedQuote = Number(previousMeta.symbolsOk) >= 70 && Number(currentMeta.symbolsOk) < 70;
```

The meta fields the producer writes (`scripts/producer/run-meta.mjs` ~lines 36–46, from
`scripts/lib/refresh-continuity.mjs`): `fredHasKey`, `fredFetchOk`, `fredLkgUsed`, `fredLkgSource`
(`'previous-public-data-macro'` when LKG is used), `fredExpectedSeriesCount` (23 today), `fredSuccessfulSeries`
(array), `fredFetchedKeyCount`, `fredStatus`, and a failed-series list (find its exact name:
`node -e "console.log(Object.keys(require('./public-data/data.json').meta).filter(k=>/fred/i.test(k)))"`).
The gate's behaviour test is the `v59.94` block near the end of `scripts/ci-data-pipeline-contract-check.mjs`
(a temp git repository; cases: quote 90→40 refused, FRED regression refused, key-absent LKG passes, healthy passes,
single commit passes).

**B.** `scripts/ci-metric-consistency-check.mjs`:
- ~lines 40–43: `tenRow` is read from the rates axis evidence and the 5/20-session numbers are required.
- section 8 (~lines 180–232): `for (const day of ['2026-11-06', null])` — builds the regime for the fixture close
  and for today's files; `if (day && !at.some((row) => row.date === day)) continue;` (silent skip);
  `check(\`v59.84 [${tag}] the credit judgement every reader uses is the 시장 상태 credit axis state\`, judgement.state === axis('credit').state, …)`;
  the same comparison for the 매크로 chapter; ~line 217 a rates/credit node check that already guards `unknown`;
  ~lines 229–230 exact values (`breadthPp === 26.8`, `equalLeadPp === 7`) asserted on live history rows.
- The axis withholds a stale input in `src/domain/briefing/market-read.js` `alignMarketInputs` (~lines 470–500:
  `alignments.hy = alignInput(credit.hyAsOf, basis)`, `take(value, alignment)` returns `null` unless
  `isUsable(alignment)`), and each axis object carries its alignment (read how `axis(...)` stores it).
- The module that owns "is this gate judging live data / may a clock judgement block":
  `scripts/lib/qa-live-data.mjs` (`clockJudgementBlocks`, `failureBlocks`, `qaOrigin`) — used by
  `ci-knowledge-lint-check.mjs` and `ci-reconciliation-contract-check.mjs`; read it before Part B.

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
| Integrity gate behaviour | `node scripts/ci-data-pipeline-contract-check.mjs` | exit 0 |
| The gate on today's files | `node scripts/ci-refresh-artifact-integrity-check.mjs` | `"ok":true` |
| Consistency gate | `node scripts/ci-metric-consistency-check.mjs` | exit 0 |
| Replay a synthetic state | a temp `.mjs` outside the repo that imports the same modules the gate imports, or copies of `public-data/history.json` / `macro-history.json` edited in a temp folder with the gate pointed at them if it supports a root (read its top) | prints the gate's verdict |

## Scope

**In scope**
- `scripts/ci-refresh-artifact-integrity-check.mjs`; the `v59.94` test block in
  `scripts/ci-data-pipeline-contract-check.mjs` (extend with `v59.97` cases)
- `scripts/ci-metric-consistency-check.mjs` (section 8 and the 10-year assertion), plus a pinned fixture file under
  `scripts/fixtures/` or `architecture/fixtures/` for the 2026-11-06 rows (follow where existing pinned fixtures of
  market rows live: `git ls-files | grep -i "fixtures/" | head -20`)
- `_artifacts/pending-records/plan-035/` — one JSON per completed part

**Out of scope**
- The producer (`scripts/producer/**`, `scripts/lib/refresh-continuity.mjs`), `src/**`, the workflows, the 70-symbol
  quote rule.

## Steps

### Part A — a labelled partial FRED cycle publishes; a silent loss does not
1. Failing tests first, in the temp-repository block (`v59.97`), with the previous commit's meta
   `{ fredHasKey: true, fredFetchOk: true, symbolsOk: 90 }`:
   - **partial, labelled** — current `{ fredHasKey: true, fredFetchOk: false, fredLkgUsed: true, fredLkgSource: 'previous-public-data-macro', fredExpectedSeriesCount: 23, <failed list>: ['cpi'], <successful list>: [22 names], symbolsOk: 90 }` → exit 0;
   - **total loss, labelled** — every series failed with LKG labelled → exit 0 **only if** the recorded decision
     covers it: read P1189 in `_context/BUG-POSTMORTEM.md` (`grep -n "P1189" -A12 _context/BUG-POSTMORTEM.md`) and
     apply what it says; if it does not say, refuse (exit 1) and note it;
   - **regression without a label** — current `{ fredHasKey: true, fredFetchOk: false, fredLkgUsed: false, symbolsOk: 90 }` → exit 1;
   - **regression with a label but no source** — `fredLkgUsed: true, fredLkgSource: null` → exit 1;
   - the existing key-absent LKG case still passes.
   Use the real field names found with the command in "Current state".
2. Change the boundary: an LKG cycle is explicit when `fredFetchOk !== true && fredLkgUsed === true` and
   `fredLkgSource` is a non-empty string — with or without the key. Keep the refusal for a regression that carries no
   LKG label. If the meta lists failed and expected series, add the count to the gate's printed JSON
   (`fred.failed: n, fred.expected: n`) so the operator log shows a partial cycle.
3. Read the workflow step that follows a degraded-but-published cycle (`refresh-data.yml`, the steps after
   `degradation-gate`) and say in your report whether anything else refuses the cycle (do not change it).

**Verify**: `node scripts/ci-data-pipeline-contract-check.mjs` exit 0; the "partial, labelled" case fails on the old
gate (copy-aside method); `node scripts/ci-refresh-artifact-integrity-check.mjs` → `"ok":true`.

### Part B — compare only what the product shows; fixtures for each state
1. Reproduce both false failures with temp copies of the published files: (i) drop the last two `hyOas`
   observations; (ii) remove `tnx` from the last three history rows. Record the gate's messages.
2. Guards: where the gate compares a reader's state with an axis state, skip the comparison — with one printed line
   `[metric-consistency] SKIP <what>: <axis> withheld (input <n> sessions behind <basis>)` — when the axis state is
   `'unknown'` or its alignment is not usable. Where it requires the 10-year 5/20-session text, skip with the same
   kind of line when the rates axis withholds the 10-year. A skip is never silent.
3. A state table instead of "today only": add a small table-driven block that builds synthetic histories (a flat
   S&P series and an `hyOas` series you construct) for each credit state the rule has — favourable (level under
   350bp, 5-day ≤ +5bp, 20-day under +25bp), neutral by 20-day widening (+25bp or more, under the stress line),
   부담 by level (≥ 450bp), 부담 by 5-day speed (≥ +25bp), 부담 by the 20-session record, and stale (HY three
   sessions behind) — and asserts, for each, that `creditJudgement`, the 시장 상태 axis and the 매크로 credit chapter
   agree (or that the comparison is skipped for the stale case). Feed the regime the same inputs the product passes
   (level, five-session change, as-of date — see `src/data/selectors/market-inputs.js`). Read the thresholds from
   `RULES.credit`; do not copy numbers.
4. The 2026-11-06 replay: move the rows it needs into a pinned fixture file and assert on the fixture, so the check
   neither disappears when the close leaves the published window nor fails when the producer repairs an old row.
   Keep the "[today]" pass over the live files for the comparisons only (no exact-value assertions on live rows).
5. Labels: new assertions `v59.97`; existing labels stay.

**Verify**: `node scripts/ci-metric-consistency-check.mjs` exit 0 on the real files; with the two temp-copy states
from step 1 it exits 0 and prints the SKIP lines; the state table fails on the gate as it was before v59.96 for the
favourable state (prove it by temporarily removing `hyDelta5Bp` from the regime inputs in your working copy, then
restoring it).

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records (defects, `p`).
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Part A step 1 (five cases); Part B steps 1 and 3 (two replays, six states).

## Done criteria

- [ ] A key-present, labelled partial FRED cycle passes the integrity gate; an unlabelled regression is refused
- [ ] The consistency gate passes in the two stale replays with printed SKIP lines, and has a table of six credit states
- [ ] The 11/06 replay reads a pinned fixture; no exact-value assertion remains on live rows
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- A: the meta has no failed-series or LKG-source field to tell a labelled partial cycle from a silent loss.
- A: P1189 (or another ledger entry you find) records that a FRED regression with the key present must block.
- B: the axis object does not expose its state/alignment in a way the gate can read without re-deriving it.
- Either: an existing assertion of these gates would have to be weakened beyond a skip-with-a-line.

## Maintenance notes

- Reviewer: these two gates sit on the publish path (`refresh-data.yml`) and in preflight for every release. After
  push, watch the next few refresh runs for the new printed fields and for any SKIP line.
- The rule this plan applies: a gate that evaluates today's data needs (1) the same inputs the product passes,
  (2) a fixture for each state of the fact, (3) a printed skip when the product itself withholds the input.
