# Plan 002: The publish-data-commit gate passes on Windows, so local QA reaches the browser groups

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- scripts/publish-data-commit.mjs scripts/ci-publish-data-commit-check.mjs`
> If either changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW–MED (touches the shared data publisher's `gh` invocation; behaviour on Linux must not change)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

On the owner's Windows machine `node scripts/ci-publish-data-commit-check.mjs` always fails five checks. The gate is
in the QA pipeline's data group, and a failure there makes `qa-runner` skip every later browser group (55 checks)
unless `--keep-going` is passed. So local QA silently loses its browser evidence. CI (Linux) passes. The cause is the
test's fake `gh`: a bash-shebang script made executable with `chmod`, which Windows cannot spawn.

## Current state

- `scripts/publish-data-commit.mjs:62-66` — the publisher's `gh` call:

```js
function gh(args) {
  const bin = process.env.AIO_PUBLISH_GH;
  const result = bin ? spawnSync(bin, args, { stdio: 'inherit' }) : spawnSync('gh', args, { stdio: 'inherit' });
  return result.status === 0;
}
```

  Header comment line 16: `//   AIO_PUBLISH_GH       command used instead of `gh` (receives the same arguments)`.
  The only users of `AIO_PUBLISH_GH` are this function and the check below.
- `scripts/ci-publish-data-commit-check.mjs:27-31` — the stub:

```js
const ghLog = join(tmp, 'gh.log');
const ghBin = join(tmp, 'gh');
writeFileSync(ghBin, `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(ghLog)}\n`);
chmodSync(ghBin, 0o755);
```

  and lines 106-109, the failing stub: `writeFileSync(failing, '#!/usr/bin/env bash\nexit 1\n'); chmodSync(failing, 0o755);`
  The checks read the log through a `ghCalls()` helper and compare e.g.
  `workflow run ci.yml --ref main -f release_sha=${sha} -f origin=fixture` (arguments joined by single spaces).
- On Windows the gate's stdout shows `pushed <sha> but the exact-SHA CI dispatch failed` and stderr
  `the collision re-run could not be dispatched`; the failing checks are:
  `a change is pushed with the minute in the message`, `the push dispatches CI for the exact SHA`,
  `the runner keeps its unrelated worktree edit through the rebase`,
  `a rebase conflict dispatches one collision re-run and ends green`,
  `a rebased tree that fails verifyCommit is not pushed (collision path)`.
- The publisher also runs hook commands through `spawnSync('bash', ['-c', command], ...)` (line 50). Git Bash provides
  `bash` on this machine; leave that as is.

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
| The gate | `node scripts/ci-publish-data-commit-check.mjs` | before: `Publish data commit check failed:` + 5 lines; after: passes (exit 0) |

## Scope

**In scope**
- `scripts/publish-data-commit.mjs` — only the `gh()` function and the header comment line for `AIO_PUBLISH_GH`
- `scripts/ci-publish-data-commit-check.mjs` — only the two stub definitions
- `_artifacts/pending-records/plan-002/publish-gate-windows.json` (create)

**Out of scope**
- Any other part of the publisher (staging, rebase, retry, dispatch decisions).
- `scripts/lib/data-publish-sets.mjs`, the workflows.

## Steps

### Step 1: Reproduce
Run the gate, capturing both streams (`node scripts/ci-publish-data-commit-check.mjs > out.txt 2>&1` in a temp
folder outside the repo, then read the file). **Verify**: it exits 1 with `Publish data commit check failed:` and the
failing list includes `the push dispatches CI for the exact SHA`. The exact set of failing checks varies by checkout
(a failing fake `gh` changes which later cases are reached) — five or six failures are both fine. If it passes, STOP.

### Step 2: Let `AIO_PUBLISH_GH` name a Node script
In `gh()`, when `bin` ends in `.mjs`, `.cjs` or `.js`, run it with the current Node:
`spawnSync(process.execPath, [bin, ...args], { stdio: 'inherit' })`; otherwise keep the existing two branches
unchanged. Update the header comment: the variable is a command, or a `.js/.mjs` script run with Node.

**Verify**: `node --check scripts/publish-data-commit.mjs` → exit 0.

### Step 3: Make both stubs Node scripts
In the check, write the stubs as `gh.mjs` and `gh-fail.mjs`:
- `gh.mjs`: appends `process.argv.slice(2).join(' ') + '\n'` to the log file (embed the path with `JSON.stringify`),
  exits 0;
- `gh-fail.mjs`: `process.exit(1)`.
Remove the `chmodSync` calls for them (and the `chmodSync` import if nothing else uses it). The log format must stay
one line per call with arguments joined by single spaces, so `ghCalls()` keeps working unchanged.

**Verify**: `node scripts/ci-publish-data-commit-check.mjs` → exit 0, no `check failed` text.

### Step 4: Pending record and gates
Write the pending record (change-only is wrong here: it is a defect — a gate that fails on one platform and hides the
browser groups; use a `p` entry). **Verify**: `node scripts/apply-pending-records.mjs --dry-run` → exit 0;
`node scripts/qa-runner.mjs contracts --keep-going` → `publish-data-commit` now passes; no new failures.

## Test plan

The gate is its own test: it must pass on Windows after the change. No new cases.

## Done criteria

- [ ] `node scripts/ci-publish-data-commit-check.mjs` exits 0
- [ ] `git diff 813371fc5 -- scripts/publish-data-commit.mjs` touches only `gh()` and the one comment line
- [ ] `node scripts/qa-runner.mjs contracts --keep-going` SUMMARY has no `publish-data-commit` failure
- [ ] `git status --short` shows only the three in-scope paths

## STOP conditions

- After Step 3 any check still fails: do not touch the rebase/autostash/push logic; report each remaining check name
  with the stderr lines around it and your reading of the cause.
- The fix seems to need a change to how the publisher pushes, rebases or dispatches.

## Maintenance notes

- CI on Linux is the release gate for this file; the reviewer should confirm the Linux path (`spawnSync('gh', ...)`
  and a non-script `AIO_PUBLISH_GH`) is byte-for-byte the previous behaviour.
- After this lands, local `qa-runner affected` no longer needs `--keep-going` to reach the browser groups.
