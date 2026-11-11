# Plan 036: Three gates stop turning the calendar into an outage — schedule expiry, 13F counts, replay window

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The three parts are independent. Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- scripts/ci-static-db-expiry-check.mjs scripts/ci-six-doc-coverage-check.mjs scripts/ci-crash-replay-check.mjs`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P1 (Part A has a date: 2026-12-01; Part B about 2026-11-16)
- **Effort**: M
- **Risk**: LOW–MED (gates on the publish path)
- **Depends on**: none
- **Category**: bug (gates that will fail on a correct product on a known date)
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

Each of these was confirmed by replaying the unmodified gate with a pinned clock or an edited input:

- **A. From 2026-12-01 00:00 UTC every data publish is refused.** `ci-static-db-expiry-check.mjs` fails when a
  hand-typed macro-calendar row's `nextRelease` is in the past and its official schedule is exhausted for more than
  14 days. A row with **no** schedule line gets no grace at all: `'conf-gtc-dc'` has `nextRelease: '2026-11-30'`
  and no schedule row, so the gate fails the day after. More rows follow (kr-bok 12-11, us-ism-mfg 12-16,
  us-ism-svc 12-18, us-nfp 12-19, us-cpi 12-25, the 90-day universe limit 2027-01-11) — the ISM rows although the
  produced `public-data/macro-calendar.json` already lists ISM dates through 2027-12 and the screens use those.
  The gate is in the `data` group, which `refresh-data.yml` runs before committing, and it blocks the CI
  attestation too. Replay: 2026-11-30T12:00Z → exit 0; 2026-12-01T00:30Z → exit 1
  `schedule exhausted for more than 14 days: conf-gtc-dc=2026-11-30`. The sibling gate over the same calendars
  (`ci-manual-reference-expiry-check.mjs`) only warns on expiry, citing the owner's rule that a data problem is
  shown honestly on screen and must not stop shipping (P1542).
- **B. The next 13F quarter breaks every data release.** `ci-six-doc-coverage-check.mjs` pins live 13F counts
  (`allHoldings.length === 1290`, `comparisons.length === 1387`, `rawUniqueCusips === 1130`,
  `rawUniqueIssuerNames === 1161`, `periodsImported === 70`, `totalPeriods === 84`). Those files are rewritten by
  the refresh when managers file; the Q3 deadline is around 11-16. Replay with one more holdings row → exit 1.
  A commit on 11-07 already had to patch this gate when the period moved.
- **C. In May 2027 the crash-replay gate fails on every release**, when its first fixed date (2026-03-27) leaves
  the 420-row published history. Replay with history starting 2026-03-28 → `FAIL … history.json has no close`.

## Current state

**A.** `scripts/ci-static-db-expiry-check.mjs` (read it whole; ~110 lines). It reads `js/aio-core.js` text: the
calendar block (`calBlock`, rows `'key': { … nextRelease: 'YYYY-MM-DD' … }`) and the hand-typed official schedule
block (`scheduleBlock`, one line per key with dates). Key lines:

```js
const SCHEDULE_LEAD_WARN_DAYS = 21;
const SCHEDULE_GRACE_DAYS = 14;
const staleNext = calendarRows
  .filter(([, key, date]) => date < todayIso && !officialNext(key))
  .filter(([, key]) => { const last = lastScheduled(key); return !last || dayDiff(todayIso, last) > SCHEDULE_GRACE_DAYS; })
  .map(([full, key, date]) => `${key}=${date}`);
check('static-db:calendar-no-past-nextRelease', staleNext.length === 0, …);
```

It uses `Date.now()` (~line 19) and never reads `public-data/macro-calendar.json`. The sibling
`scripts/ci-manual-reference-expiry-check.mjs` merges the produced calendar (search `mergeProducedMacroCalendar`,
~line 64) and warns. The shared policy helper for wall-clock judgements is `scripts/lib/qa-live-data.mjs`
(`clockJudgementBlocks()` — used as `(clockJudgementBlocks() ? check : warn)(…)` in
`scripts/ci-knowledge-lint-check.mjs:81`; `scripts/ci-refresh-origin-live-data-check.mjs:43` asserts "a wall-clock
date judgement blocks everywhere except a CI contract shard" — read both to learn exactly when it returns true).
Runtime behaviour when a schedule runs out: the screen shows 'unavailable-expired' and infers nothing (the gate's
own comment).

**B.** `scripts/ci-six-doc-coverage-check.mjs` ~lines 84–92 (the checks named above). The masters lane's own gates
(`ci-masters-contract-check.mjs`, `ci-13f-currentness-check.mjs`) pin none of these numbers. Inputs:
`public-data/masters/*.json` (`holdings-summary.json`, `filings.json`, the security master, the history index).

**C.** `scripts/ci-crash-replay-check.mjs`: `need()` (~line 222) pushes `history.json has no close` for a missing
date; fixed dates from 2026-03-27 to 2026-10-15 (~lines 244–293). `scripts/producer/history.mjs` keeps 420 rows.
The gate already carries some pinned closes in a fixture (search `fixtures` in the file — SOXX closes).

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
| The three gates today | `node scripts/ci-static-db-expiry-check.mjs`; `node scripts/ci-six-doc-coverage-check.mjs`; `node scripts/ci-crash-replay-check.mjs` | exit 0 |
| Pin the clock for a replay | a preload outside the repo: `node --import <abs path>/clock.mjs scripts/ci-static-db-expiry-check.mjs` where `clock.mjs` replaces `Date.now` and the zero-argument `Date` constructor with a fixed instant | the gate's verdict at that instant |
| Replay with an edited input | a preload that wraps `fs.readFileSync` for one path, or a temp copy of the repo subset the gate reads if it accepts a root | the gate's verdict |

## Scope

**In scope**
- `scripts/ci-static-db-expiry-check.mjs`, `scripts/ci-six-doc-coverage-check.mjs`, `scripts/ci-crash-replay-check.mjs`
- a fixture file for Part C under the directory the gate's existing pinned fixture lives in
- a gate that already tests these gates' behaviour, if one exists (`git grep -ln "static-db-expiry\|six-doc-coverage\|crash-replay" -- scripts/ci-*.mjs`), for `v59.97` replay cases; otherwise a `--self-test` style block inside the gate itself following an existing example (`git grep -n "self-test" -- scripts/ci-*.mjs | head`)
- `_artifacts/pending-records/plan-036/` — one JSON per completed part

**Out of scope**
- `js/aio-core.js` (advancing the hand-typed calendar is a data task, not this plan), `public-data/**`, the masters
  producer, the workflows, `scripts/lib/qa-live-data.mjs`.

## Steps

### Part A — an expired schedule warns; it does not stop publishing
1. Reproduce with the pinned clock at 2026-12-01T00:30:00Z (exit 1 expected) and list, day by day through
   2027-01-15, which rows would fail.
2. Apply the owner's rule the sibling gate already follows:
   - merge the produced calendar the way `ci-manual-reference-expiry-check.mjs` does, so a key whose dates exist in
     `public-data/macro-calendar.json` is not "exhausted";
   - a row with no schedule line starts its 14-day grace at its own `nextRelease`;
   - the calendar-expiry and universe-age judgements are wall-clock judgements: report them through
     `clockJudgementBlocks()` exactly as `ci-knowledge-lint-check.mjs` does (a failure where that helper says clock
     judgements block, a printed warning elsewhere — including the publish step and the CI data shard). Every
     structural check in the gate stays a hard failure.
3. Replay cases (`v59.97`): clock 2026-12-01 → exit 0 with a warning naming `conf-gtc-dc`; clock 2026-12-20 → exit 0
   with warnings for the rows then expired; today → exit 0 with the same lead-time warnings as before; a structural
   defect you inject in a temp copy (e.g. a malformed date) → exit 1.

**Verify**: the gate passes today; the 2026-12-01 replay fails on the old gate and passes on the new one with the
warning printed.

### Part B — consistency instead of counts
Replace each exact-count pin with a check that holds for any quarter: published row counts equal the lengths of the
arrays they describe (e.g. a `holdingRowsPublished`/summary count field equals `allHoldings.length` — read the
artifact for the fields that exist); unique CUSIP/issuer counts in the coverage block equal what you count from the
rows; `totalPeriods === connectedManagers × historyDepthTarget` and `periodsImported <= totalPeriods`; counts are
positive. Keep every non-count part of those checks (statuses, flags). Rename the check labels so they no longer
state a number.

Replay (`v59.97`): one extra holdings row with its summary count updated consistently → pass; one extra row with
the summary count left stale → fail.

**Verify**: the gate passes today; the first replay fails on the old gate.

### Part C — replay windows come from a fixture
Move the closes the fixed-date windows need into the gate's pinned fixture (generate them once from today's
`public-data/history.json` with a temp script; the fixture holds only the fields and dates the replay reads) and
read them from the fixture, so the windows no longer depend on the published history's length. Where a check
deliberately runs on the live history (the most recent weeks), keep it live and print a labelled SKIP if the
window is absent instead of failing.

Replay (`v59.97`): history cut to start after 2026-03-27 → exit 0 with every fixed window still evaluated from the
fixture.

**Verify**: the gate passes today with the same number of evaluated windows as before (print the count before and
after); the cut-history replay fails on the old gate.

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records (defects, `p`;
Part A's entry must state the date the outage would have started). `node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

The replays in each part. Each must fail on the old gate (copy-aside method).

## Done criteria

- [ ] Pinned-clock replays at 2026-12-01 and 2026-12-20 exit 0 with warnings; a structural defect still exits 1
- [ ] No exact live 13F count remains in `ci-six-doc-coverage-check.mjs` (`grep -nE "=== (1290|1387|1130|1161|70|84)\b"` → nothing)
- [ ] Crash-replay evaluates the same windows from the fixture with history cut after 2026-03-27
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- A: `clockJudgementBlocks()` would still return true in the `refresh-data.yml` publish step or the CI data shard
  (read how it decides — environment variables, origin); then the helper, which is out of scope, is the thing to
  change — report what it reads.
- B: the artifacts carry no summary fields to check the arrays against (then only positivity and the periods
  product can be checked — do that and say so).
- C: the fixture would exceed ~200 KB or needs fields that change when the producer repairs history.

## Maintenance notes

- Part A removes the outage, not the staleness: the hand-typed rows in `js/aio-core.js` (`conf-gtc-dc`, `kr-bok`,
  ISM, NFP, CPI) still need their 2027 dates, and the warning will say so on every run. That is a data task for the
  macro-calendar review workflow.
- Reviewer: after push, confirm the next refresh run prints the lead-time warnings and commits.
