# Plan 017: An official release stops being "upcoming" once its real release time has passed

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- src/domain/market/day/facts.js src/domain/briefing/schedule.js`
> If either changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (changes only when a scheduled fact stops being listed as upcoming)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

The 오늘 화면's "앞으로" list is built from the market-day ledger. Every official release (CPI, jobs, PCE, FOMC) is
given the fixed clock 13:30 UTC and stays "upcoming" until 12 hours after that. 13:30 UTC is 08:30 US Eastern only
in winter, and the FOMC decision is at 14:00 Eastern. Executed against the current code: with a FOMC decision dated
2026-12-09 (published 2026-12-10 04:00 KST), a ledger built at 09:30 KST that morning still lists it as upcoming;
with CPI on 2026-12-10 (22:30 KST), a build at 09:30 KST on 12-11 still lists it as upcoming. The morning read shows
last night's decision as a coming event. The exact release clock already exists in the codebase.

## Current state

`src/domain/market/day/facts.js`, function `scheduleFacts(macroCalendar, nowMs)` (~lines 167–186):

```js
  const alias = { 'us-fomc': 'us-fed-rate' };
  for (const [rawId, dates] of Object.entries(macroCalendar?.schedules || {})) {
    const id = alias[rawId] || rawId;
    for (const date of Array.isArray(dates) ? dates : []) {
      const at = Date.parse(`${date}T13:30:00Z`);
      if (!EVENT_NAMES[id] || !(at >= nowMs - 12 * HOUR && at <= nowMs + 10 * DAY)) continue;
      out.push({ id: `upcoming:${id}:${date}`, kind: 'upcoming', event: id, label: EVENT_NAMES[id], date, subjects: [],
        topics: …, weight: 2 });
    }
  }
  for (const event of SCHEDULED_EVENTS) {
    const at = Date.parse(event.atKst);
    if (!(at >= nowMs - 2 * DAY && at <= nowMs + 10 * DAY)) continue;
    out.push({ id: `event:${event.id}`, kind: at <= nowMs ? 'event' : 'upcoming', … });
  }
```

`src/domain/briefing/schedule.js` exports the real clock (~line 88):

```js
/** When a scheduled release becomes public (ms), or null for an id without a known release time. … */
export function releaseAtMs(id, date) {
  const profile = RELEASE_PROFILES[id === 'us-fed-rate' ? 'us-fomc' : id];
  if (!profile || !isIsoDay(String(date || ''))) return null;
  return profile.kst ? Date.parse(`${date}T…+09:00`) : etWallClockToMs(date, profile.et);
}
```

Consumers of `kind: 'upcoming'` facts: `src/domain/briefing/day-account.js` (~line 202, the `ahead` list — every
lead/major `upcoming` fact) and the ranking/materiality code in `src/domain/market/day/` (find with
`git grep -n "'upcoming'" -- src/domain src/ui scripts`). The ledger is built by the producer
`scripts/build-market-day.mjs` via `buildMarketDay({ … nowMs })`; tests import `buildMarketDay` (find with
`git grep -ln "buildMarketDay" -- scripts`).

Design constraint from the product rules: a past event is not shown as coming. Whether a just-released official
figure should appear as a *past* fact is already handled elsewhere (the macro release facts come from the published
data, not from the schedule), so this plan only stops listing it as upcoming.

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
| Gates that build the ledger | `git grep -ln "buildMarketDay" -- scripts/ci-*.mjs scripts/fixtures` then run each gate | exit 0 |
| Layering | `node scripts/qa-runner.mjs fast` | `fail=0` (`architecture` checks import direction) |

Do NOT run `node scripts/build-market-day.mjs` (a producer that writes `public-data/market-day.json`).

## Scope

**In scope**
- `src/domain/market/day/facts.js` — only `scheduleFacts` (and one import line)
- the gate/fixture file that already tests `buildMarketDay` (add a case)
- `_artifacts/pending-records/plan-017/upcoming-release-clock.json` (create)

**Out of scope**
- `src/domain/briefing/schedule.js` (reuse `releaseAtMs`; do not change it), `SCHEDULED_EVENTS`, the 10-day look-ahead,
  `public-data/market-day.json`.

## Steps

### Step 1: Failing test
In the existing `buildMarketDay` test file add a `v59.94` case: `macroCalendar: { schedules: { 'us-fomc': ['2026-12-09'], 'us-cpi': ['2026-12-10'] } }`.
- `nowMs = Date.parse('2026-12-10T00:30:00Z')` (09:30 KST, 5.5 h after the FOMC decision, 13 h before CPI): the
  facts must contain an upcoming `us-cpi` for 2026-12-10 and must NOT contain an upcoming fact for `us-fed-rate` 2026-12-09.
- `nowMs = Date.parse('2026-12-11T00:30:00Z')`: no upcoming `us-cpi` for 2026-12-10.
- `nowMs = Date.parse('2026-12-09T15:00:00Z')` (4 h before the decision): the FOMC fact IS upcoming.
Look at how the existing cases read the facts out of `buildMarketDay`'s return value and do the same.

**Verify**: the gate fails on the first two assertions with the current source.

### Step 2: Use the real clock
In `scheduleFacts`: compute `const at = releaseAtMs(id, date) ?? Date.parse(`${date}T13:30:00Z`);` (import
`releaseAtMs` from `../../briefing/schedule.js` — check the relative path from `src/domain/market/day/`), and keep a
release only while it has not happened: `at > nowMs && at <= nowMs + 10 * DAY`. Remove the 12-hour grace. Update or
add a one-line comment saying a release is listed until its release time.

Before importing, check for an import cycle: `git grep -n "market/day" -- src/domain/briefing/schedule.js` must
return nothing, and `node -e "import('./src/domain/market/day/facts.js').then(()=>console.log('ok'))"` prints `ok`.

**Verify**: the new case passes; every gate from the commands table exits 0; `node scripts/qa-runner.mjs fast` → `fail=0`.

### Step 3: Pending record and gates
`node scripts/qa-runner.mjs contracts --keep-going` → only the known failures. Defect entry (`p`).
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Step 1 (three time points). The assertions must fail with `facts.js` stashed back.

## Done criteria

- [ ] New assertions pass and fail on the old source
- [ ] `git grep -n "T13:30:00Z" -- src/domain/market/day/facts.js` shows it only as the fallback
- [ ] `git status --short` shows only in-scope paths; `git status --short public-data` is empty

## STOP conditions

- Importing `releaseAtMs` creates an import cycle or a layering-gate failure.
- An existing fixture expects a release to stay "upcoming" after its release time (report the fixture id; it may
  encode a deliberate grace period).
- `releaseAtMs` returns `null` for one of the ids in `EVENT_NAMES` that the schedule can contain (list them in the
  report; the fallback clock then still applies to those).

## Maintenance notes

- The fix shows on the site after the next data refresh rebuilds `market-day.json`.
- Reviewer: check the briefing's own "다음 발표" logic still agrees with the ledger for the same event at the same time.
