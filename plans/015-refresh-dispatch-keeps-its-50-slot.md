# Plan 015: The :50 market-data refresh is dispatched again (30-minute cadence, not hourly)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- worker/data-plane.js scripts/ci-data-plane-contract-check.mjs`
> If either changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW–MED (`worker/` is a deploy path; the change makes one more workflow run per hour on weekdays, which is the designed cadence)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

Market data is designed to refresh every 30 minutes: the data-plane Worker dispatches `refresh-data.yml` at :20 and
:50 (P1377), and the GitHub cron (:17/:47) is only a fallback that stands down when a dispatched run started in the
last 30 minutes. In practice the site refreshes once an hour. Measured on 2026-11-10 (`gh run list`): dispatched runs
started at 01:20, 02:20, 03:20 … 10:20 and each finished at :26–:29; data commits landed at :23–:24 each hour, with no
:50 run. Cause: the dispatcher skips a slot when the newest non-cron run *completed* less than 25 minutes ago. A :20
run that completes at :27 is 23 minutes old at :50, so the :50 slot is skipped as a "recent success" — and the :47
cron already stood down because of that same :20 run. Nothing covers the slot.

## Current state

`worker/data-plane.js`:

```js
export const REFRESH_DISPATCH_POLICY = Object.freeze({ workflow: 'refresh-data.yml', ref: 'main', slotMinutes: [20, 50], trigger: 'scheduler' });
…
const REFRESH_DATA_DISPATCH = Object.freeze({
  workflow: REFRESH_DISPATCH_POLICY.workflow, ref: REFRESH_DISPATCH_POLICY.ref, kvKey: 'scheduler:dispatch', recentSuccessMs: 25 * 60000, cronIsFallback: true,
  isSlot: at => REFRESH_DISPATCH_POLICY.slotMinutes.includes(at.getUTCMinutes()),
  body: () => ({ ref: REFRESH_DISPATCH_POLICY.ref, inputs: { trigger: REFRESH_DISPATCH_POLICY.trigger } })
});
```

and in the shared dispatch function (~lines 104–113):

```js
    const active = runs.find(run => ['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(run.status));
    if (active) return finish({ dispatched: false, reason: 'workflow-active', runId: active.id });
    // Where the GitHub cron is only this dispatcher's fallback (scripts/cron-fallback-guard.mjs), a cron run that stood down
    // still ends 'success' without producing anything, so it must not count as the recent success that skips this slot.
    // A fallback cron that did produce is ignored too; the cost is at most one extra cycle after a missed slot.
    const latest = policy.cronIsFallback ? runs.find(run => run.event !== 'schedule') : runs[0];
    const completedAge = at.getTime() - Date.parse(latest?.updated_at || '');
    if (latest?.conclusion === 'success' && completedAge >= 0 && completedAge < policy.recentSuccessMs) {
      return finish({ dispatched: false, reason: 'recent-success', runId: latest.id });
    }
```

The same function serves three policies: refresh-data (slots 30 min apart, window 25 min), event-briefs
(`EVENT_BRIEFS_DISPATCH`, slots :05/:25/:45 — 20 min apart, window 15 min, `cronIsFallback: true`) and the screener
backup (`SCREENER_DISPATCH_POLICY`, two slots a day, window 30 min, uses `runs[0]`). Event briefs kept its cadence in
the same period (runs finish in under 5 minutes), and the screener backup's purpose is "do not repeat an on-time cron
run" — both must keep working as they do.

The purpose of the recent-success check is to avoid repeating a run that just happened *for this slot*. A run that
belongs to the previous slot is, by definition, older than the slot spacing when measured from its start.

Tests: `scripts/ci-data-plane-contract-check.mjs` imports the dispatch function(s) from `worker/data-plane.js` and
drives them with a fake `fetch` (find the existing recent-success cases with
`grep -n "recent-success" scripts/ci-data-plane-contract-check.mjs`).

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
| Data-plane gate | `node scripts/ci-data-plane-contract-check.mjs` | exit 0 |
| Cloudflare group gates that read this file | `git grep -ln "data-plane.js" -- scripts/ci-*.mjs` then run each | each exits 0 |

## Scope

**In scope**
- `worker/data-plane.js` — only the age computation in the shared dispatch function (and its comment)
- `scripts/ci-data-plane-contract-check.mjs` — new cases
- `_artifacts/pending-records/plan-015/refresh-dispatch-slot.json` (create)

**Out of scope**
- The slot minutes, the windows (`recentSuccessMs` values), the KV receipt logic, `worker/*.toml`, the workflows,
  `scripts/cron-fallback-guard.mjs`.
- Deploying the Worker (it deploys from CI after a push; you never run `wrangler`).

## Steps

### Step 1: Reproduce in the gate's harness
Read the existing recent-success test(s). Add a `v59.94` case for refresh-data: one `workflow_dispatch` run with
`run_started_at`/`created_at` = 09:20:00Z, `updated_at` = 09:27:00Z, `conclusion: 'success'`, `status: 'completed'`,
plus (as the newest row) a `schedule` run that stood down; dispatch time 09:50:00Z. Expect `dispatched: true`
(reason `accepted`).

**Verify**: `node scripts/ci-data-plane-contract-check.mjs` → FAILS on the new case (it returns `recent-success`).
If it passes before any source change, STOP — the defect is not where this plan says.

### Step 2: Measure the age from the run's start
In the dispatch function, compute the age from when the run started:
`Date.parse(latest?.run_started_at || latest?.created_at || latest?.updated_at || '')`, and rename `completedAge`
accordingly. Rewrite the comment to say what the code does: a run counts as this slot's recent success only when it
*started* inside the window; a run from the previous slot started a full slot spacing earlier and never suppresses
the next slot.

Check the other two policies against this rule and write the reasoning in your report:
- event-briefs: slots 20 min apart, window 15 min, measured from start → the previous slot's run (started 20 min
  ago) does not suppress; a run started < 15 min ago (e.g. an extra manual dispatch) does. Same behaviour as intended.
- screener backup: window 30 min, backup slot is 32 min after the cron time; an on-time cron run started at :53
  is 32 min old at :25 → by start time it would no longer suppress the backup. **This changes that policy.** So keep
  the completion-based age for policies that are not `cronIsFallback` (the screener), and use the start-based age
  only when `policy.cronIsFallback` is true. Implement exactly that split.

**Verify**: `node --check worker/data-plane.js`; the gate passes including the Step 1 case.

### Step 3: More cases
Add `v59.94` cases: (a) refresh-data, a dispatched run started 5 minutes before the slot and already successful →
`recent-success` (no duplicate); (b) refresh-data, a run still `in_progress` → `workflow-active` (unchanged);
(c) screener backup, an on-time cron run that completed 20 minutes before the backup slot → `recent-success`
(unchanged behaviour); (d) event-briefs, previous slot's run started 20 minutes ago and completed 17 minutes ago →
dispatched (unchanged).

**Verify**: gate exit 0; with the `worker/data-plane.js` change stashed, only the Step 1 case fails.

### Step 4: Gates and pending record
Run every gate from the "Cloudflare group gates" list and `node scripts/qa-runner.mjs contracts --keep-going`.
Defect entry (`p`): include the measured evidence (hourly commits at :23, dispatched runs 10:20→10:26 etc.) and
state that the fix takes effect when the data-plane Worker is redeployed.
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Steps 1 and 3. Pattern: the existing recent-success cases in the same gate.

## Done criteria

- [ ] The new refresh-data case fails on the old source and passes on the new
- [ ] `node scripts/ci-data-plane-contract-check.mjs` exits 0
- [ ] `git status --short` shows only in-scope paths
- [ ] The report states the behaviour of all three policies after the change

## STOP conditions

- The gate cannot drive the refresh-data dispatcher with a fake fetch (no exported seam).
- A model-check or contract gate pins the completion-based rule for `cronIsFallback` policies and fails.
- The Step 1 case passes before the fix.

## Maintenance notes

- Reviewer: `worker/` is a risk path. After push, "Deploy fast data plane" must run; then confirm on the next two
  hours that `gh run list --workflow refresh-data.yml` shows dispatched runs at both :20 and :50 and data commits
  about every 30 minutes on a weekday.
- More runs mean more `data:` commits and reduced-scope CI runs per hour — the designed load (P1377), not new load.
