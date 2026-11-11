# Plan 003: The earnings calendar artifact says which of its own queries failed

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- scripts/fetch-earnings-calendar.mjs`
> If it changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (additive fields in a producer; no consumer change)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

`scripts/fetch-earnings-calendar.mjs` writes `public-data/earnings-calendar.json`. The weekly Finnhub query is known
to come back capped (a 2026-10-19 audit found 526 rows without INTC, KO, NOW…), so the script adds one query per day
and merges. A failed day query and a failed IPO query are both turned into `[]` and the artifact is still stamped
`status: 'current-reference'` with nothing recording the failure: a failed IPO call reads as "no IPOs this week", and
a failed day falls back to the capped week silently. The later "upcoming" loop already records its failures in
`upcomingGaps`. This plan records the other two the same way. It does not change what is fetched or shown.

## Current state

`scripts/fetch-earnings-calendar.mjs`, inside the main function (around lines 198–250):

```js
  const [weekRows, ipos] = await Promise.all([
    fetchJSON(`${FINNHUB_BASE}/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`).then((d) => (Array.isArray(d?.earningsCalendar) ? d.earningsCalendar : [])),
    // v58.71 (pipeline audit): a failed IPO call no longer throws away the earnings week with it.
    fetchJSON(`${FINNHUB_BASE}/calendar/ipo?from=${from}&to=${to}&token=${FINNHUB_KEY}`).then((d) => (Array.isArray(d?.ipoCalendar) ? d.ipoCalendar : [])).catch(() => [])
  ]);
  ...
  const dayRows = [];
  for (const day of earningsCalendarDays(from, to)) {
    const rows = await fetchJSON(`${FINNHUB_BASE}/calendar/earnings?from=${day}&to=${day}&token=${FINNHUB_KEY}`)
      .then((d) => (Array.isArray(d?.earningsCalendar) ? d.earningsCalendar : [])).catch(() => []);
    dayRows.push(...rows);
  }
```

and the pattern to copy, a few lines below:

```js
  const upcomingGaps = [];
  for (const day of upcomingDays) {
    ...
      .then((d) => (Array.isArray(d?.earningsCalendar) ? d.earningsCalendar : null)).catch(() => null);
    if (rows) upcomingRows.push(...rows); else upcomingGaps.push(day);
  }
```

The payload object lists `upcomingGaps,` between `upcomingWindow` and `upcoming`, then `earnings` and `ipos`.
`upcomingGaps` has one reader: `src/domain/fundamental/analysis-read.js:275`. Keeping a failed day's week rows is a
recorded decision ("a failed day keeps what the week query returned") — keep it. The `largeCapCoverage` field already
reports large caps missing from the merged rows — keep it.

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
| Find the gate(s) that load this script | `git grep -n "fetch-earnings-calendar" -- scripts architecture` | at least one `scripts/ci-*.mjs` that imports from it or tests its exports |
| Syntax | `node --check scripts/fetch-earnings-calendar.mjs` | exit 0 |

Do NOT run `node scripts/fetch-earnings-calendar.mjs` (a producer; it calls the network and writes `public-data/`).

## Scope

**In scope**
- `scripts/fetch-earnings-calendar.mjs`
- `scripts/ci-event-briefs-check.mjs` — add the test there (it already imports this script's exports)
- `_artifacts/pending-records/plan-003/earnings-calendar-gaps.json` (create)

**Out of scope**
- `public-data/earnings-calendar.json` (the next Actions run rewrites it).
- Every reader in `src/` — the new fields are additive; no screen changes in this plan.
- The `status` value: leave `'current-reference'`.

## Steps

### Step 1: Record failed day queries and a failed IPO query
- Day loop: resolve to `null` on a non-array or a rejected fetch (like the upcoming loop), push the day into a new
  `const earningsDayGaps = []` when `null`, otherwise push the rows.
- IPO query: resolve to `null` on failure; keep `ipos` as `[]` for the payload but set `const iposAvailable = <not null>`.
- Payload: add `earningsDayGaps` (array of `YYYY-MM-DD`) next to `upcomingGaps`, and `iposAvailable` (boolean)
  next to `ipos`. Extend the existing `console.log` for the week/day merge to print the count of failed days.
- Extract the bookkeeping into an **exported pure helper** (required: it is the only test seam — `fetchJSON` is a
  private module constant and `main()` is not exported). Suggested shape:
  `earningsQueryGaps({ days, dayResults, ipoResult })`, where `dayResults[i]` is the row array for `days[i]` or
  `null` when that query failed, and `ipoResult` is an array or `null`; it returns
  `{ dayRows, earningsDayGaps, ipos, iposAvailable }`. `main()` calls it. The file already exports pure helpers the
  same way (`mergeEarningsRows`, `earningsCalendarDays`, `upcomingEarningsMap`).
- The week query (`weekRows`) is out of scope: leave it as it is.

**Verify**: `node --check scripts/fetch-earnings-calendar.mjs` → exit 0. The module has a main-guard at its bottom (`resolve(process.argv[1]) === fileURLToPath(import.meta.url)`), so
importing it does not run the producer. Confirm the guard is still there by reading the last 10 lines; if it is
gone, STOP. `git status --short public-data` → empty.

### Step 2: Test
Host gate: `scripts/ci-event-briefs-check.mjs`. It already does `await import('./fetch-earnings-calendar.mjs')`
(~lines 138 and 151) and writes checks as `check('label', () => { … })` with `eq`/`same`/`like` helpers. Put the
new check next to the existing `stampEstimateSeen` one and follow that style. Add `v59.94` assertions that call only
the exported helper from Step 1: a failed day is listed in
`earningsDayGaps` and its week rows survive; a failed IPO query yields `iposAvailable === false` and `ipos` = `[]`;
all-success yields `[]` and `true`.

**Verify**: run that gate → passes; stash the producer change → the new assertions fail; pop the stash.

### Step 3: Pending record and gates
Defect entry (`p`): a failed query was published as an empty, current result.
**Verify**: `node scripts/apply-pending-records.mjs --dry-run` → exit 0;
`node scripts/qa-runner.mjs contracts --keep-going` → only the known failures.

## Test plan

See Step 2. If no existing gate imports this script and there is no way to exercise the logic without the network,
STOP and report instead of adding a text pin.

## Done criteria

- [ ] `git grep -n "earningsDayGaps\|iposAvailable" -- scripts` shows the producer and a gate
- [ ] the gate passes and fails with the producer change stashed
- [ ] `git status --short public-data` is empty
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- Importing the script runs the producer (network/write) — it cannot be unit-tested safely as is.
- A schema/shape gate rejects the two new top-level fields (report the gate and its message; do not edit a schema
  baseline or `architecture/browser-data-fixture.json`).
- `scripts/ci-event-briefs-check.mjs` no longer imports this script, or its check style cannot host the test.

## Maintenance notes

- A follow-up (not in this plan) can let the briefing/news screens say "IPO 일정 없음 (조회 실패)" from
  `iposAvailable === false`; today they will keep showing an empty list.
- Reviewer: check that `earnings` rows are identical for an all-success run.
- After the first Actions refresh that writes the two new fields, the `browser-data-pin-drift` gate will fail until
  the fixture is re-pinned (`node scripts/browser-data-fixture.mjs pin`). The executor cannot see this and must not
  edit `architecture/browser-data-fixture.json`.
