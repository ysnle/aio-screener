# Plan 028: Four small gate and tooling repairs — pin check runs in CI, a failed index read is logged, a misnamed gate, unused schemas

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The four parts are independent: if one hits a STOP condition, finish the others and report the stopped part.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- .github/workflows/ci.yml scripts/browser-data-fixture.mjs scripts/producer/screener.mjs scripts/ci-worker-anthropic-check.mjs architecture/qa-pipeline.json schemas architecture/adr-0003-layered-ownership.md`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED for Part A (`ci.yml` is the release gate), LOW for the rest
- **Depends on**: none
- **Category**: tests / dx / tech-debt
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

- **A.** The browser gates run against a pinned snapshot of `public-data` (`architecture/browser-data-fixture.json`).
  `scripts/browser-data-fixture.mjs` verifies that the pinned commit's deployed tree matches the manifest and that
  the pin is an ancestor of `main` — but only when the pinned commit exists locally. The CI job that runs this gate
  (the `workspace` contracts shard) checks out at depth 1 and never fetches the pin, so on every CI run those two
  checks are skipped without a word. A pin taken on a commit outside main's history, or a manifest missing a
  deployed file, passes CI.
- **B.** `scripts/producer/screener.mjs` wraps two index-history reads (^GSPC, ^IXIC) in `try/catch` blocks whose
  warnings can never print: `fetchHistory` returns `[]` when both hosts fail instead of throwing. A failed read
  silently writes no distribution-day or rally value for the new date, and the operator log does not say why.
- **C.** `scripts/ci-worker-anthropic-check.mjs` is a two-line shim that only imports
  `../worker/openai-contract.test.mjs` ("historical gate name retained"). The Worker has used OpenAI for months; a
  failing "anthropic" gate sends whoever triages it to the wrong place.
- **D.** `schemas/knowledge/*.schema.json` (five files) are read by nothing: no validator, no gate, no producer.
  They imply a validation that does not happen and have drifted from the one doc that describes them.

## Current state

**A.** `scripts/browser-data-fixture.mjs` (~lines 140–160): the tree-vs-manifest comparison and
`merge-base --is-ancestor` run only when `git cat-file -e <pin>^{commit}` succeeds; otherwise it reports the commit
as absent and returns without those checks (read the function `checkPinIntegrity` and the comment near line 149
that acknowledges the shallow case). The gate entry is `scripts/ci-browser-data-fixture-check.mjs` (group
`workspace` in `architecture/qa-pipeline.json`). In `.github/workflows/ci.yml` the contracts job checks out with the
default depth (~lines 117–124); the browser job fetches the pin explicitly (search `ci.yml` for the fetch near
"browser data" — it shows the exact command the repo already uses to fetch one commit). An in-repo exemplar of a
gate that fetches its own pinned commit when shallow: `scripts/ci-secondary-text-budget-check.mjs` ~lines 55–57
(`git fetch --depth=1 --filter=blob:none origin <sha>` and exit 1 if unavailable).

**B.** `scripts/producer/screener.mjs` ~lines 676–688: two blocks of the form
`try { spxBars = await fetchHistory('^GSPC', …); } catch (error) { console.warn(…); }` (read them). `fetchHistory`
is in `scripts/producer/quotes.mjs` (~lines 470–496) and returns `[]` after both hosts fail.

**C.** `scripts/ci-worker-anthropic-check.mjs` (whole file):
a comment "historical gate name retained" and `import '../worker/openai-contract.test.mjs';`.
Referenced at `architecture/qa-pipeline.json` (three places: a gate definition with an `id` and `script`, and lists
that name the id — find with `grep -n "worker-anthropic" architecture/qa-pipeline.json`), a comment at
`scripts/ci-runtime-contract-check.mjs` (~line 1053), and possibly docs (`git grep -n "worker-anthropic" -- . ':(exclude)_artifacts'`
— if that pathspec form is rejected by this git, use `git grep -n "worker-anthropic" | grep -v "^_artifacts/"`).
`scripts/ci-qa-pipeline-contract-check.mjs` validates the registry (retired gate names are listed under
`retiredGateScripts` in the pipeline JSON — read how a rename was recorded before).

**D.** `schemas/knowledge/`: `article.schema.json`, `concept.schema.json`, `coverage-matrix.schema.json`,
`domain-dossier.schema.json`, `research-dossier.schema.json`. `git grep -n "schemas/\|\.schema\.json" -- scripts src js .github architecture worker`
returns one line: `architecture/adr-0003-layered-ownership.md:34` — a diagram line
`scripts/ (producer, Actions 전용) ──▶ public-data/*.json ◀── schemas/ (형태 정본)`. The mechanism that actually
pins artifact shapes today is the structure ids in `architecture/browser-data-fixture.json` (checked by
`scripts/ci-browser-data-pin-drift-check.mjs`) plus the per-artifact contract gates. One dated context doc
(`_context/MARKET-PRINCIPLES-ATLAS-STRUCTURAL-AUDIT-HANDOFF-2026-08-10.md`) mentions `schemas/knowledge/` as history.

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
| Fixture gate | `node scripts/ci-browser-data-fixture-check.mjs` | exit 0 |
| Workflow YAML + preflight | `node scripts/qa-runner.mjs fast` | `fail=0` |
| Pipeline registry | `node scripts/ci-qa-pipeline-contract-check.mjs` | exit 0 |
| Worker contract test under its new name | `node scripts/<new name>.mjs` | exit 0 |

## Scope

**In scope**
- A: `scripts/browser-data-fixture.mjs` (the absent-commit branch of the integrity check only),
  `scripts/ci-browser-data-fixture-check.mjs` (a `v59.97` case)
- B: `scripts/producer/screener.mjs` (the two blocks only)
- C: the shim file (rename), `architecture/qa-pipeline.json` (the entries naming it),
  `scripts/ci-runtime-contract-check.mjs` (the one comment), `.github/workflows/*.yml` only if a workflow names the
  script directly
- D: `schemas/knowledge/*` (delete), `architecture/adr-0003-layered-ownership.md` (the one diagram line)
- `_artifacts/pending-records/plan-028/` — one JSON per completed part

**Out of scope**
- `.github/workflows/ci.yml` — Part A is done inside the script, not the workflow (see Step A1).
- `architecture/browser-data-fixture.json`, the pin itself, `worker/**`, dated `_context/*` docs.

## Steps

### Part A — the gate fetches its pin instead of skipping
0. `checkPinIntegrity(manifest, { head })` runs git through a module-level `root` (`cwd: root`), and the gate's
   existing replays only edit manifests against the real repository — there is no temp-repository harness. Add an
   optional `repo` option (default: the repository root) to `checkPinIntegrity` and to the module's `git()` helper so
   the check can run against another working copy. `checkPinIntegrity` is exported and called only by
   `scripts/ci-browser-data-fixture-check.mjs` (the `pin` command is separate).
1. In the absent-commit branch of the integrity check: try once to fetch the pinned commit with
   `git fetch --no-tags --depth=1 origin <sha>` (the form `.github/workflows/ci.yml` already uses; do **not** pass
   `--filter=blob:none` — it writes `remote.origin.promisor=true` into the developer's git config), with
   `spawnSync('git', [...])` — never a shell string. If the commit is then present, run the tree-vs-manifest
   comparison. The ancestry check needs history: when the repository is shallow
   (`git rev-parse --is-shallow-repository` prints `true`) and the pin is not an ancestor by the available history,
   print one labelled line (`[browser-data-fixture] SKIP ancestry: shallow history (pin <sha12>)`) instead of
   passing silently. If the fetch fails (offline, or the commit is not on the remote), fail the integrity check
   with a message naming the pin — a pin that cannot be fetched is the defect this check exists for — **except**
   when there is no `origin` remote at all (a local fixture repository in tests): then keep today's quiet skip.
2. Test (`v59.97`) in `scripts/ci-browser-data-fixture-check.mjs`: build a temporary remote
   (`git init`, two commits with a small `public-data/` tree), clone it with `git clone --depth=1 file://<path>`, and
   call `checkPinIntegrity(manifest, { repo: <clone> })` with a manifest for the first commit (git's own settings via
   `-c user.name=… -c user.email=… -c core.autocrlf=false`; remove the temp dirs in a `finally`):
   (a) the pin is one commit behind the tip and absent in the clone → the integrity check fetches it and the
   tree-vs-manifest comparison passes; (b) the manifest lists a file the pinned tree
   does not have → fails; (c) a pin sha that does not exist on the remote → fails with the pin named.
3. Run the real gate here: it must pass. In your worktree the pin is normally already present, so the fetch path is
   exercised only by the temp-repository cases. If the pin is absent and you are offline, that is a STOP report, not a
   defect.
4. In the pending record, state the limit: after a depth-1 fetch the tree-vs-manifest check runs in CI, but the
   ancestry check still cannot (shallow history) and prints the labelled SKIP line instead of passing silently.

**Verify**: `node scripts/ci-browser-data-fixture-check.mjs` exit 0; the new cases fail with the script change
restored to HEAD (copy-aside method, not the shared stash).

### Part B — say when an index read came back empty
Replace the unreachable `catch` warnings with a check on the result: after each `fetchHistory` call, if the array is
empty, `console.warn` one line naming the symbol and what will be missing for this run (distribution days / rally
count), and keep going as today. Keep a `try/catch` only if the awaited code can throw for another reason (read
`fetchHistory` to decide; say which you chose). If this file has a fixture gate that can inject `fetchHistory`
(`git grep -n "producer/screener" -- scripts/ci-*.mjs`), add a `v59.97` case; otherwise no test.

**Verify**: `node --check scripts/producer/screener.mjs`; the gates that import this module exit 0.

### Part C — name the gate after what it tests
1. `git mv scripts/ci-worker-anthropic-check.mjs scripts/ci-worker-openai-contract-check.mjs`; update its comment
   (drop "historical gate name retained").
2. In `architecture/qa-pipeline.json` (three places at the planned commit: ~line 1982 and ~2074 are input lists
   that name the script path; ~2000–2001 is the gate, `"id": "worker-anthropic"` with its `"script"`, in group
   `cloudflare`): change the script path in all three and the gate `id` to `worker-openai-contract`. Do **not** add
   a `retiredGateScripts` entry: `ci-qa-pipeline-contract-check.mjs` (~line 519) requires every retired entry's
   script to exist, and a renamed script needs no entry.
3. Update the comment in `scripts/ci-runtime-contract-check.mjs` (~line 1053) and any workflow line that names the
   old script (none at the planned commit). Ledgers keep their history and are not edited: `_context/RULES.md`
   (~1723, 1759, 1762, 1771, 2145) and `_context/QA-CHECKLIST.md` (~913, 935, 2581, 2658) still name
   `ci-worker-anthropic-check`, two of them in a `verify_by` field — no gate resolves those names; list them in NOTES
   so the reviewer can update the two `verify_by` lines through the ledger tooling.

**Verify**: `node scripts/ci-worker-openai-contract-check.mjs` exit 0; `node scripts/ci-qa-pipeline-contract-check.mjs`
exit 0; `node scripts/qa-runner.mjs fast` → `fail=0`; `git grep -n "worker-anthropic" -- scripts architecture .github`
→ nothing.

### Part D — remove schemas nothing reads
1. Re-run the reference search (including string-built paths: `git grep -n "'schemas'\|\"schemas\"" -- scripts src`).
   If anything reads the directory, STOP Part D.
2. `git rm -r schemas/knowledge` (and the now-empty `schemas/` directory disappears with it).
3. In `architecture/adr-0003-layered-ownership.md` line ~34, replace `◀── schemas/ (형태 정본)` with
   `◀── architecture/browser-data-fixture.json (형태 고정: 구조 id)` so the diagram names the mechanism that exists.
   Change nothing else in the ADR.

**Verify**: `git ls-files schemas` → nothing; `node scripts/qa-runner.mjs fast` → `fail=0`;
`node scripts/ci-knowledge-lint-check.mjs` exit 0 (the context catalog check is an expected failure only if a
`_context/` file changed — none does here).

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records: A is a defect
(`p`: a check that never ran where it mattered), B is a defect (`p`), C and D are change-only.
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Part A step 2 (three cases). Parts B–D rely on existing gates.

## Done criteria

- [ ] The fixture gate exits 0 here and its three new cases pass and fail on the old script
- [ ] `scripts/ci-worker-anthropic-check.mjs` no longer exists; the renamed gate runs; the registry gate exits 0
- [ ] `git ls-files schemas` prints nothing
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- A: `git clone --depth=1 file://…` or the single-commit fetch does not work in the temp repositories on this
  machine (report git's message).
- C: a gate or workflow matches the old id by a pattern you cannot update safely (e.g. cached QA results keyed by id
  that the runner refuses to drop) — report it.
- D: any reader of `schemas/` exists.

## Maintenance notes

- Reviewer: Part A makes the CI `workspace` shard do one small `git fetch`; confirm on the first push that the shard
  stays green and prints either the integrity result or the labelled ancestry skip.
- The four source-text pins named in the 2026-11-10 gate audit (`ci-runtime-contract-check.mjs` T869 label,
  `ci-data-pipeline-contract-check.mjs` SEC concept-set lines, `ci-knowledge-corpus-check.mjs` atomic-write import,
  `ci-ai-intelligence-contract-check.mjs` request-id wiring) stay as known debt under the text-pin ratchet.
