# Plan 001: The refresh degradation gate compares against the last published data.json

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- scripts/ci-refresh-artifact-integrity-check.mjs scripts/ci-data-pipeline-contract-check.mjs .github/workflows/refresh-data.yml`
> If any of these changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (a gate that never fired will be able to refuse a refresh)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

`refresh-data.yml` runs "Reject silent artifact degradation" before it commits a refresh. The gate is meant to refuse
a refresh whose FRED fetch regressed from success to failure (without an explicit last-known-good marker) or whose
quote coverage fell from 70+ symbols to under 70. It reads the previous artifact from `HEAD^`. The workflow checks
out with depth 1, so `HEAD^` does not exist, the `catch` treats that as "no prior claim", and the gate always prints
`ok`. Even with history, `HEAD^` is the wrong baseline before the commit: `HEAD` is the last published refresh.
After this plan the gate compares the working-tree `data.json` with the last published one in both contexts.

## Current state

- `scripts/ci-refresh-artifact-integrity-check.mjs` (33 lines) — the gate. Lines 4–12:

```js
const readCurrent = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const current = readCurrent('public-data/data.json');
let previous = null;
try {
  previous = JSON.parse(execFileSync('git', ['show', 'HEAD^:public-data/data.json'], { encoding: 'utf8' }));
} catch (_) {
  // Initial history or a shallow checkout has no parent artifact; there is no
  // prior quality claim to compare against.
}
```

  Then it derives `degradedFred` (`previousMeta.fredFetchOk === true && currentMeta.fredFetchOk !== true &&
  !explicitFredLkgBoundary`) and `degradedQuote` (`Number(previousMeta.symbolsOk) >= 70 &&
  Number(currentMeta.symbolsOk) < 70`), exits 1 with a message on either, else prints one JSON line with `ok: true`.
- It runs in two contexts:
  1. `.github/workflows/refresh-data.yml` step `Reject silent artifact degradation` (id `degradation-gate`), **before**
     the commit: working tree = new data, `HEAD` = last published refresh. The job's checkout
     (`actions/checkout`, no `fetch-depth`) is depth 1.
  2. `architecture/qa-pipeline.json` data group (`"script": "scripts/ci-refresh-artifact-integrity-check.mjs"`),
     **after** a commit or locally: working tree `data.json` is identical to `HEAD`'s, so the previous refresh is
     `HEAD^` (absent in a shallow clone — both local and cloud clones here are shallow).
- `scripts/ci-qa-pipeline-contract-check.mjs:728-730` requires the script to be in the data group and invoked **at
  most once** in the pipeline. Do not register a second invocation.
- All paths in the script are relative to the current working directory, so it can be spawned with `cwd` set to a
  temporary git repository.

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
| Run the gate here | `node scripts/ci-refresh-artifact-integrity-check.mjs` | one JSON line, `"ok":true` |
| Fields exist today | `node -e "const m=require('./public-data/data.json').meta;console.log(m.fredFetchOk,m.symbolsOk)"` | two defined values (not `undefined undefined`) |

## Scope

**In scope**
- `scripts/ci-refresh-artifact-integrity-check.mjs`
- `scripts/ci-data-pipeline-contract-check.mjs` (add the behaviour test here; it is already a registered data-group gate)
- `_artifacts/pending-records/plan-001/refresh-degradation-baseline.json` (create)

**Out of scope**
- `.github/workflows/refresh-data.yml` — depth 1 is enough once the baseline is `HEAD`; do not add `fetch-depth`.
- `architecture/qa-pipeline.json` — no new invocation (the contract allows at most one).
- The thresholds (70 symbols) and the FRED last-known-good rule — unchanged.

## Steps

### Step 1: Confirm the fields the gate reads still exist
Run the "Fields exist today" command.
**Verify**: both values are defined. If either prints `undefined`, STOP (the meta shape changed).

### Step 2: Choose the baseline by context
In `scripts/ci-refresh-artifact-integrity-check.mjs`, replace the `previous` block so that:
- it reads the working-tree text of `public-data/data.json` once;
- it reads `git show HEAD:public-data/data.json` (use `maxBuffer: 256 * 1024 * 1024`);
- if `HEAD`'s text exists and differs from the working-tree text → baseline is `HEAD` (pre-commit context);
- compare the two texts after normalising line endings (`.replace(/\r\n/g, '\n')`): this machine has
  `core.autocrlf=true`, and a CRLF-only difference must not count as "differs";
- otherwise → baseline is `git show HEAD^:public-data/data.json`, and when that fails `previous` stays `null`
  (shallow clone or first commit: nothing to compare — keep this case quiet and passing, as today).
Add the chosen baseline to the printed JSON line as `baseline: 'HEAD' | 'HEAD^' | 'none'`. Keep the rest of the
logic and messages as they are. Update the comment to say what the code now does.

**Verify**: `node --check scripts/ci-refresh-artifact-integrity-check.mjs` → exit 0;
`node scripts/ci-refresh-artifact-integrity-check.mjs` → `"ok":true` and a `baseline` field.

### Step 3: Behaviour test in a temporary repository
In `scripts/ci-data-pipeline-contract-check.mjs`, add a block above the final `if (errors.length)` (near the end of
the file). That file reports through `check(label, condition, detail)`, which pushes to `errors` (lines ~25–28); it
has no `fail()`. It imports only `existsSync, readFileSync` from `node:fs`, `dirname, join` from `node:path` and
`spawnSync`. Follow its existing temp-dir precedent at ~lines 3053–3057, which lazy-imports what it needs
(`const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = await import('node:fs'); const { tmpdir } = await import('node:os');`).
The block:
1. creates a temp dir (`mkdtempSync(join(tmpdir(), 'aio-degrade-'))`), runs `git init -q`, sets
   `user.name`/`user.email` with `git -c` or `git config` inside that repo only;
2. writes `public-data/data.json` = `{"meta":{"fredFetchOk":true,"symbolsOk":90}}`, commits it;
3. **pre-commit, degraded quotes**: overwrites the file with `symbolsOk: 40` (uncommitted), spawns the gate with
   `cwd` = temp repo → expects exit 1 and stderr containing `quote coverage regressed 90 -> 40`;
4. **pre-commit, FRED regressed**: working tree `{"meta":{"fredFetchOk":false,"symbolsOk":90}}` → exit 1;
5. **pre-commit, explicit LKG boundary**: `{"meta":{"fredFetchOk":false,"fredHasKey":false,"fredLkgUsed":true,"fredLkgSource":"x","symbolsOk":90}}` → exit 0;
6. **healthy refresh**: `symbolsOk: 95`, `fredFetchOk: true` → exit 0 with `"baseline":"HEAD"`;
7. **post-commit, single commit** (`git checkout -- .` is denied by a hook in this repo — instead re-write the
   committed content into the file so tree == HEAD) → exit 0 with `"baseline":"none"`;
8. removes the temp dir in a `finally`.
Label every assertion with `v59.94`. Use `spawnSync(process.execPath, [<abs path to the gate>], { cwd, encoding: 'utf8' })`.

**Verify**: `node scripts/ci-data-pipeline-contract-check.mjs` → passes.
Then prove the test bites: `git stash push scripts/ci-refresh-artifact-integrity-check.mjs`, run the same command →
it must FAIL on cases 3/4; `git stash pop`. (If the stash command is denied by the command hook, copy your changed
gate file to a temp folder outside the repo, write the original content back over it — take it from
`git show HEAD:scripts/ci-refresh-artifact-integrity-check.mjs` — run the proof, then copy your version back.)

### Step 4: Pending record and gates
Write the pending record (a defect entry: the gate never compared anything in the workflow). In `fix`/`changelog`,
state plainly that refreshes with a FRED regression or quote coverage under 70 will now be refused before commit, as
the workflow's own comments describe.

**Verify**: `node scripts/apply-pending-records.mjs --dry-run` → exit 0; `node scripts/qa-runner.mjs contracts --keep-going` → only the known failures.

## Test plan

Covered by Step 3 (six cases, including the regression this plan fixes: a degraded working tree against a healthy
`HEAD` on a depth-1 history). Pattern: any existing temp-dir block in `scripts/ci-publish-data-commit-check.mjs`
(`mkdtempSync` + `spawnSync('git', ...)`).

## Done criteria

- [ ] `node scripts/ci-data-pipeline-contract-check.mjs` exits 0 and fails when the gate change is stashed
- [ ] `node scripts/ci-refresh-artifact-integrity-check.mjs` prints `"ok":true` with a `baseline` field
- [ ] `node scripts/ci-qa-pipeline-contract-check.mjs` exits 0
- [ ] `git status --short` shows only the three in-scope paths
- [ ] `node scripts/apply-pending-records.mjs --dry-run` exits 0

## STOP conditions

- `meta.fredFetchOk` or `meta.symbolsOk` is absent from the current `public-data/data.json`.
- `ci-data-pipeline-contract-check.mjs` cannot host the test without restructuring it (more than ~60 added lines).
- A gate other than the two known local failures fails after your change and you cannot fix it within scope.
- The fix seems to need a workflow change.

## Maintenance notes

- After this lands and is pushed, watch the next few `Refresh market data` runs: a refusal at
  "Reject silent artifact degradation" is now a real signal (FRED regressed without an LKG marker, or quotes < 70).
- If the refresh ever commits in several steps, the "tree differs from HEAD" rule must be revisited.
