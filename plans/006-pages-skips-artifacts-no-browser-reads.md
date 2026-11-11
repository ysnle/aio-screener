# Plan 006: Pages stops shipping ~5 MB of artifacts that no browser code reads

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- scripts/lib/pages-bundle-config.mjs .github/workflows/pages-deploy.yml`
> If either changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S–M (most of it is proving nothing reads the files)
- **Risk**: MED (a wrongly excluded file is a 404 on the live site; a live gate that fetches one would go red)
- **Depends on**: none
- **Category**: perf (deploy weight)
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

The Pages deploy copies `public-data/` minus an exclude list. About 5.1 MB / ~560 files of knowledge-build and
13F-build inputs are still copied although no browser path requests them; one gate even asserts the browser must NOT
request three of them. They cost upload/storage on every deploy (deploys happen many times a day) and widen what is
public for no reader. Users see no difference; this only trims the deployed tree.

## Current state

- `scripts/lib/pages-bundle-config.mjs:13` — `export const PAGES_DATA_EXCLUDES = ['sec-fundamentals.json',
  'sec-fundamentals-extended.json', 'telegram-observed.json', 'screener-extended-universe.json',
  'score-backtest-history.json', 'score-backtest-longrun.json', 'operations-slo-window.json',
  'telegram-reference-window.json', 'masters/holdings.json', 'masters/history-holdings.json',
  'masters/issuer-aggregates.json', 'masters/managers/', 'masters/managers-store.json']` (entries ending in `/` are
  directories; paths are relative to `public-data/`).
- `.github/workflows/pages-deploy.yml` (~lines 160–174), step "Stage explicit public artifact allowlist": an
  `rsync -a` with one `--exclude '<entry>' \` line per entry, same order, ending
  `public-data/ "$RUNNER_TEMP/pages-dist/public-data/"`.
- `scripts/ci-boot-bundle-budget-check.mjs:64-67` fails when the workflow's excludes differ from
  `PAGES_DATA_EXCLUDES` as a set (it sorts both) — the two lists must change together; keep the same order for
  readability.
- Other readers of the list: `scripts/browser-data-fixture.mjs:44` (`isDeployed`) and `scripts/start-local-node.mjs:47`.
- Candidates (paths under `public-data/`, sizes at the planned commit):
  `knowledge/research-dossiers.json` (1,964,065 B), `knowledge/research-dossiers/` (455 files, 1,810,184 B),
  `knowledge/coverage-matrix.json` (410,485), `knowledge/integrated-market-ai-frameworks.json` (231,215),
  `masters/cusip-ticker-map.json` (219,390), `knowledge/domain-dossiers.json` (175,764),
  `knowledge/domain-dossiers/` (19 files, 158,905), `knowledge/learning-graph.json` (87,563),
  `knowledge/research-facts.json` (33,766), `knowledge/research-source-seeds.json` (26,968).
- `scripts/ci-three-page-artifact-budget-check.mjs` (~lines 107, 133) asserts the browser does not request
  `research-dossiers`, `coverage-matrix`, `domain-dossiers`.
- `sw.js` (~line 98) has a `REFERENCE_URL_PATTERNS` regex that still names some of these files for runtime caching.
  `sw.js` is out of scope: a pattern that never matches a request is harmless.
- NOT a candidate: `knowledge/claims.json` (the word "claims" appears in `src/ai`; unproven) and
  `masters/history/managers/*` (the service worker whitelists it).

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
| Reader search for one candidate (run per candidate, with its distinctive stem, e.g. `research-dossiers`, `coverage-matrix`, `integrated-market-ai-frameworks`, `cusip-ticker-map`, `domain-dossiers`, `learning-graph`, `research-facts`, `research-source-seeds`) | `git grep -n "<stem>" -- src js index.html sw.js cloudflare-worker-proxy.js worker` | only comments, the `sw.js` cache pattern, or nothing |
| Live/external gates that fetch it | `git grep -ln "<stem>" -- scripts .github architecture` then read each hit | producers, local-file gates and fixtures only — no script that fetches the URL from the deployed site |
| Lockstep gate | `node scripts/ci-boot-bundle-budget-check.mjs` | exit 0 |
| Three-page budget | `node scripts/ci-three-page-artifact-budget-check.mjs` | exit 0 (a browser gate; if it cannot launch a browser, say so) |

## Scope

**In scope**
- `scripts/lib/pages-bundle-config.mjs` — only the `PAGES_DATA_EXCLUDES` array
- `.github/workflows/pages-deploy.yml` — only the `--exclude` lines of that one `rsync`
- `_artifacts/pending-records/plan-006/pages-excludes.json` (create)

**Out of scope**
- `sw.js`, `public-artifact-manifest.json`, `architecture/browser-data-fixture.json` (the reviewer re-pins it after
  integration — the pin-drift gate may fail locally; that is expected and listed as a known failure).
- Deleting or changing any file under `public-data/`. Producers and CI keep reading them from the repository.

## Steps

### Step 1: Prove each candidate has no browser reader and no live fetch
For each of the ten candidates run both search commands. A candidate **qualifies** only if: (a) no hit in
`src/`, `js/`, `index.html`, `cloudflare-worker-proxy.js`, `worker/` other than comments, and in `sw.js` only the
cache-pattern regex; (b) no script under `scripts/` fetches it over HTTP from the deployed origin
(look for the stem next to `fetch(`, `https://`, `baseUrl`, `origin`, `liveUrl` in `ci-live-*`, `*watchdog*`,
`*external*`, `ensure-live-convergence`, `ci-*-live-*`); (c) it is not listed in `public-artifact-manifest.json` as a
published artifact (`git grep -n "<stem>" -- public-artifact-manifest.json`) — if it is listed there, it does NOT
qualify (the manifest is a publication contract); (d) URL composition: also search for the directory prefix being
joined dynamically, e.g. `git grep -n "knowledge/' *+\|knowledge/\${" -- src js` and read any hit.
Write a small table in your report: candidate → qualifies yes/no → evidence.

**Verify**: the table exists and every "yes" has the four checks recorded.

### Step 2: Add the qualifying entries to both lists
Append the qualifying entries (files as `knowledge/<name>.json`, directories with a trailing `/`) to
`PAGES_DATA_EXCLUDES` and add matching `--exclude '<entry>' \` lines to the workflow's `rsync`, in the same order as
the array. Extend the existing comment above the rsync with one line saying these are build inputs no browser path
reads.

**Verify**: `node --check scripts/lib/pages-bundle-config.mjs`; `node scripts/ci-boot-bundle-budget-check.mjs` → exit 0;
`node scripts/qa-runner.mjs fast` → `fail=0` (workflow YAML).

### Step 3: Browser evidence that nothing requests them
Run `node scripts/ci-three-page-artifact-budget-check.mjs`. If it launches, it must pass. (It serves the repository
as is, so it proves the browser does not *request* the files; it would not show a 404 for an excluded one.) Then check how
`scripts/start-local-node.mjs` uses the excludes (line ~47): if the local server hides excluded paths only for a
staged build, note that; do not change it.

**Verify**: gate exit 0, or a clear statement that the browser could not be launched here.

### Step 4: Pending record and gates
Change-only entry (no `p`). State the number of files/bytes removed from the deploy and that the repository copies
are unchanged. **Verify**: `node scripts/apply-pending-records.mjs --dry-run` → 0;
`node scripts/qa-runner.mjs contracts --keep-going` → only the known failures **plus one expected by this plan**:
`browser-data-fixture` (`scripts/ci-browser-data-fixture-check.mjs`) will fail with
`<path>: not a deployed public-data path` for every newly excluded file, because the pinned fixture
(`architecture/browser-data-fixture.json`, 1,051 files) still lists them. Do not STOP on it and do not edit the
fixture: say in NOTES that the reviewer re-pins at integration. `browser-data-pin-drift` may appear too.

## Test plan

No new test: the lockstep gate (`ci-boot-bundle-budget-check`) already fails when the two lists differ, and the
three-page gate already asserts the browser does not request the main candidates.

## Done criteria

- [ ] `node scripts/ci-boot-bundle-budget-check.mjs` exits 0
- [ ] Every added entry appears once in each list, same order
- [ ] The report's candidate table records the evidence for each entry added and each entry rejected
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- Any candidate you would add is fetched by a live/external gate or listed in `public-artifact-manifest.json` —
  leave that one out and report it; if that removes more than half the bytes, report before editing anything.
- `ci-boot-bundle-budget-check` fails for a reason other than the lists differing.
- You find a browser reader for something already in the exclude list (a pre-existing bug) — report it, do not fix.

## Maintenance notes

- Reviewer: this changes what the next Pages deploy publishes. After the push, open the deployed site's knowledge
  screens (리서치 라이브러리) once and confirm no 404 in the network panel; the watchdog will also show it.
- `architecture/browser-data-fixture.json` must be re-pinned at integration (`node scripts/browser-data-fixture.mjs pin`).
- When a new knowledge-build input is added under `public-data/knowledge/`, decide at that time whether the browser
  reads it; if not, add it here.
