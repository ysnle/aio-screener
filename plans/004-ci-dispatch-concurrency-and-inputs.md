# Plan 004: A manual CI dispatch cannot cancel main's push CI, and the dispatch input never reaches a shell as text

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- .github/workflows/ci.yml`
> If it changed, compare "Current state" with the live file; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (`ci.yml` is the release gate; a YAML or expression mistake blocks every deploy)
- **Depends on**: none
- **Category**: bug / security hardening
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

Two small defects in `.github/workflows/ci.yml`:
1. The concurrency group is `CI-<PR number || inputs.release_sha || github.ref>` with `cancel-in-progress: true`. A
   `workflow_dispatch` started by hand with no `release_sha` falls through to `github.ref`, the same group as the
   push-triggered run on `main`, and cancels it. That push CI's SHA then never gets its attestation, and Pages/Worker
   deploys wait for one that will not come until another push. (The bots always pass `release_sha`.)
2. The free-form dispatch input `release_sha` is interpolated straight into `run:` lines
   (`--sha "${{ inputs.release_sha || github.sha }}"`). Only someone with write access can set it, so this is not a
   privilege escalation, but it is the standard injection-in-`run:` pattern, CodeQL flags it, and a malformed value
   breaks the step opaquely. Other steps in the same file already pass such values through `env:`.

## Current state

`.github/workflows/ci.yml`:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      release_sha:
        description: Exact bot-produced commit to validate and attest
        required: false
        type: string
      origin:
        ...
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || inputs.release_sha || github.ref }}
  cancel-in-progress: true
```

Three `run:` lines interpolate the input (line numbers at the planned commit):
- ~83: `run: node scripts/resolve-release-source.mjs --sha "${{ inputs.release_sha || github.sha }}" --wait-min 15 --github-output`
  (this step already has an `env:` block with `GH_TOKEN`)
- ~91 and ~127: `node "$RUNNER_TEMP/build-data-overlay.mjs" --code-sha "${{ steps.release-source.outputs.code_sha }}" --data-sha "${{ inputs.release_sha || github.sha }}"`
  (the second uses `needs.preflight.outputs.code_sha`)

The existing in-file exemplar of the safe form (around line 265):

```yaml
        env:
          EXPECTED_SHA: ${{ inputs.release_sha || github.sha }}
          CODE_SHA: ${{ needs.preflight.outputs.code_sha }}
          GH_TOKEN: ${{ github.token }}
        run: node scripts/resolve-release-source.mjs --sha "$EXPECTED_SHA" --verify-code-sha "$CODE_SHA"
```

All third-party actions are SHA-pinned; keep every `uses:` line untouched.

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
| Find every interpolation | `grep -n 'inputs.release_sha' .github/workflows/ci.yml` | the group line, the three `run:` lines, existing `env:` lines, and four `with: ref:` lines of `actions/checkout` (leave those) |
| YAML + workflow contracts | `node scripts/qa-runner.mjs fast` | `fail=0` (includes `workflow-yaml`) |
| Gates that read ci.yml text | `git grep -ln "ci.yml" -- scripts/ci-*.mjs` | a list; run each of those after the edit |

## Scope

**In scope**
- `.github/workflows/ci.yml` — the `concurrency.group` line, the three steps named above, and the first step of the
  `preflight` job, "Resolve validation scope" (id `scope`), for the guard in Step 3
- `scripts/ci-release-source-check.mjs` — only the one assertion at ~line 89 (see Step 2)
- `_artifacts/pending-records/plan-004/ci-dispatch.json` (create)

**Out of scope**
- Every other workflow. Every `uses:` line. Job structure, `needs`, `if:` conditions, permissions.
- `scripts/resolve-release-source.mjs`, `scripts/build-data-overlay.mjs` (their CLI stays the same).

## Steps

### Step 1: Give a manual dispatch without a SHA its own group
Change the group expression so the fallthrough for a dispatch is unique per run:

```yaml
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || inputs.release_sha || (github.event_name == 'workflow_dispatch' && format('manual-{0}', github.run_id)) || github.ref }}
```

Push and PR runs keep their current groups (PR number, or `github.ref`); a bot dispatch keeps `release_sha`.

**Verify**: `node scripts/qa-runner.mjs fast` → `fail=0`.

### Step 2: Pass the SHA through `env:` in the three steps
For each of the three steps add (or extend) `env:` with `RELEASE_SHA: ${{ inputs.release_sha || github.sha }}` and,
where a step output is interpolated, `CODE_SHA: ${{ ... }}` with the same expression it uses today; then reference
`"$RELEASE_SHA"` / `"$CODE_SHA"` in the `run:` text. Keep `set -euo pipefail` and everything else as is. Do not
rename or reorder steps: `scripts/ci-release-source-check.mjs` slices the `preflight` job by name and order.

That gate pins the old command text at ~line 89:
`assert.match(ci, /resolve-release-source\.mjs --sha "\$\{\{ inputs\.release_sha \|\| github\.sha \}\}" --wait-min 15 --github-output/, 'v59.78 release-source contract')`.
Update that one regex to the new spelling (`--sha "\$RELEASE_SHA" --wait-min 15 --github-output`) and relabel it
`'v59.94 release-source contract (SHA passed through env)'`. This re-pins the same contract to the new spelling;
every other assertion in that file stays untouched (line 90 already expects `"$EXPECTED_SHA" --verify-code-sha "$CODE_SHA"`).
Run `node scripts/ci-release-source-check.mjs` → exit 0.

**Verify**: `grep -n 'run:.*\${{ *inputs\.' .github/workflows/ci.yml` and a manual read of each multi-line `run: |`
block show no `${{ inputs.` inside any shell text; `node scripts/qa-runner.mjs fast` → `fail=0`.

### Step 3: Reject a malformed SHA early
The first `actions/checkout` (`with: ref: ${{ inputs.release_sha || github.sha }}`) runs before any step that uses
the SHA in a shell, so the guard goes in the very first step of the `preflight` job, "Resolve validation scope"
(id `scope`, ~lines 46–62). It already has an `env:` block (`ORIGIN`). Add `RELEASE_SHA_INPUT` there and put this
guard before its `case`:

```bash
if [ -n "${RELEASE_SHA_INPUT:-}" ] && ! printf '%s' "$RELEASE_SHA_INPUT" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "::error::release_sha must be a full 40-character commit SHA"; exit 1
fi
```

with `RELEASE_SHA_INPUT: ${{ inputs.release_sha }}` in that step's `env:`. If the scope step is not where this plan
says (not the first step, or it has no `env:` block), STOP.

**Verify**: `node scripts/qa-runner.mjs fast` → `fail=0`; run every gate from the "Gates that read ci.yml text" list
→ each exits 0 (or is one of the two known local failures).

### Step 4: Pending record
Defect entry (`p`) covering both parts. **Verify**: `node scripts/apply-pending-records.mjs --dry-run` → exit 0;
`node scripts/qa-runner.mjs contracts --keep-going` → only the known failures.

## Test plan

There is no way to run GitHub Actions locally. The evidence is: YAML parses (`workflow-yaml` gate), every gate that
reads `ci.yml` passes, and the diff is limited to the lines above. Say in NOTES that the workflow itself is unverified
until the next push.

## Done criteria

- [ ] `grep -n 'inputs.release_sha' .github/workflows/ci.yml` — every remaining occurrence is on the `group:` line, an
      `env:` value, or a `with: ref:` value of `actions/checkout` (four such `ref:` lines exist; they are not shell
      text and stay); none is inside `run:` text (list them in the report)
- [ ] `node scripts/ci-release-source-check.mjs` exits 0
- [ ] `node scripts/qa-runner.mjs contracts --keep-going` — no new failures
- [ ] `git diff --stat 813371fc5 -- .github scripts` shows only `ci.yml` and `scripts/ci-release-source-check.mjs`

## STOP conditions

- A gate **other than** the one assertion in `scripts/ci-release-source-check.mjs` named in Step 2 pins the text of
  the concurrency group or of a `run:` line and fails (report the gate and line; do not weaken it).
- The three interpolations are not where "Current state" says, or there are more than three in `run:` text.
- Any change would be needed outside the four places named.

## Maintenance notes

- Reviewer: `ci.yml` is a risk path (deploys depend on its attestation). Read the whole diff; confirm the bot
  dispatch path (`release_sha` set) produces the same group string and the same command lines as before.
- The first push after this lands is the real test: confirm CI, then the refresh-dispatched reduced-scope CI, go green.
