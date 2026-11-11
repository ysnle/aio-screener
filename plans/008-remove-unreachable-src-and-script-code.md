# Plan 008: Remove a retired renderer, unused exports and an orphan script

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- src/ui/components/kr-index-trend.js src/ui/styles/v2-research.css scripts/lib scripts/ci-esm-core-unit-check.mjs scripts/ci-korea-participation-fixture.mjs scripts/fixtures/pipeline-semantics/market.mjs`
> If any changed, re-run the greps in "Current state" before trusting them.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (nothing in the product imports the removed code; three gate files lose the assertions that only
  tested it)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

The 한국 지수 추세 cards of the old 차트 tab were retired in v59.70 ("the technical route no longer draws them; the
시장 상태 한국 board carries 코스피·코스닥"), but their module stayed, kept alive only by tests that still assert
"the chart-tab KR card" wording. A reader of the tests believes that card ships. The same pass found a handful of
exports nothing imports and one script nothing references. Removing them shrinks what the next change has to read
and keep passing.

## Current state

**A. `src/ui/components/kr-index-trend.js`** (137 lines) exports `krIndexTrendFacts` (line 26),
`krIndexPositionText` (56), `krIndexReading` (63), `syncKrTechnicalFold` (108), `renderKrIndexTrends` (121).
`git grep -n "kr-index-trend\|renderKrIndexTrends\|syncKrTechnicalFold\|krIndexTrendFacts\|krIndexReading\|krIndexPositionText" -- src js index.html`
returns only the module's own lines and two CSS rules: no product importer. Other references:
- `scripts/ci-esm-core-unit-check.mjs` ~5512–5550: a block introduced by the comment
  `// v57.77: the 한국 차트·기술 분석 KOSPI/KOSDAQ cards printed …` that loads the module (line ~5521) and asserts
  `krIndexTrendFacts`, `krIndexPositionText`, `renderKrIndexTrends`.
- `scripts/ci-korea-participation-fixture.mjs` ~69–77: imports `krIndexTrendFacts, krIndexReading`; lines 74–77 assert
  `chartLine` ("v57.81 the chart-tab KR card shows the same record…") and `quietLine`. The lines before it (70–73)
  test `buildKoreaRegimeObservations` from `src/domain/market/regime/regime-scenarios.js` — the live 시장 상태 card;
  those stay.
- `scripts/fixtures/pipeline-semantics/market.mjs` ~290–292, inside the fixture `{ id: 'R1-05', … }`: after the
  `sectorMoves` assertion it loads `krIndexTrendFacts` and asserts `facts.d1Direction === null`.
- `scripts/ci-runtime-contract-check.mjs:991` asserts `src/ui/pages/analysis.js` does not contain
  `renderKrIndexTrends` — leave that file alone (it stays true).
- `src/ui/styles/v2-research.css:377-378`: `#kr-index-trends .trend-card-head {…}` and
  `#kr-index-trends .trend-card-value {…}`; the id `kr-index-trends` exists nowhere else. Line 376
  (`.trend-card .kr-index-move {…}`) — check whether the class `kr-index-move` is produced anywhere outside the
  module before touching it.

**B. Exports with no reference anywhere** (`git grep -n -w <name> -- src js scripts index.html` returns only the
declaration):
- `src/ui/components/data-state.js:133` `export function clearDataState(host)`
- `src/ui/components/freshness-badge.js:10` `export function isDegradedRecord(record)`
- `src/ui/components/section-frame.js:55` `export function frameMore(doc, label, ...children)`
- `src/ui/knowledge/knowledge-search.js:8` `export const KNOWLEDGE_INDEX_URL = artifactUrl('knowledge/search-index.json');`
- `scripts/lib/news-selection.mjs:475` `export function staleNewsFeeds(...)` (uses `NEWS_FEED_STALE_MS`, line 442, and
  `newsFeedQuietAllowanceMs` — check whether those still have other users after removal)
- `scripts/lib/schema-fingerprint.mjs:53` `export function schemaFingerprint(value, options)` (the file's other
  exports `schemaShape`, `schemaDrift`, `SCHEMA_DEPTH` are used; `createHash` import is used only by this function)
- `scripts/lib/telegram-signals.mjs:335` `export function isDataPost(signals)`
- `scripts/lib/sec-ledger.mjs:12` `export const SEC_LEDGER_SUMMARY_PATH = …`
- `scripts/lib/operations-alert-policy.mjs:14` `export const OPERATIONS_ALERT_STATUSES = …`

NOT in this plan: `scripts/lib/browser-gate.mjs` `withBrowserGate` (CODE-MAP advertises it as the shared helper to
import), `src/domain/ai/inference-efficiency.js` (test-only today but may be a planned consumer — report only),
`scripts/benchmark-screener-workbench.mjs` (a context doc cites it).

**C. `scripts/research-screen-text-snapshot.mjs`** (68 lines): referenced only by its own header and by
`_artifacts/wave2-e/SCREEN-TEXT-COMPARE.md` (frozen evidence).

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
| Refs for a name | `git grep -n -w "<name>" -- src js scripts index.html worker cloudflare-worker-proxy.js .github architecture` | declaration only (before), nothing (after) |
| Dynamic import check for a file | `git grep -n "<file basename without extension>" -- src js scripts .github architecture` | no importer |
| Unit + fixtures | `node scripts/ci-esm-core-unit-check.mjs`; `node scripts/ci-korea-participation-fixture.mjs`; the gate that runs `scripts/fixtures/pipeline-semantics/*` (find with `git grep -ln "pipeline-semantics" -- scripts/ci-*.mjs`) | all exit 0 |
| Pipeline registry | `node scripts/ci-qa-pipeline-contract-check.mjs` | exit 0 |

## Scope

**In scope**
- `src/ui/components/kr-index-trend.js` (delete), `src/ui/styles/v2-research.css` (lines 377–378, and 376 only if proven dead)
- `scripts/ci-esm-core-unit-check.mjs`, `scripts/ci-korea-participation-fixture.mjs`,
  `scripts/fixtures/pipeline-semantics/market.mjs` — only the assertions that load the deleted module
- The nine declarations in B, in their files
- `scripts/research-screen-text-snapshot.mjs` (delete)
- `architecture/adr-0003-layered-ownership.md` — only the mention of `ui/components/kr-index-trend.js` on ~line 18
  (remove that file name from the row; no gate reads the ADR)
- `src/ui/knowledge/knowledge-search.js` `artifactUrl` import, if removing `KNOWLEDGE_INDEX_URL` leaves it unused (see Step 3)
- Do NOT edit `_context/patch-comment-baseline.json` (it lists the deleted module; its ratchet only fails on growth)
- `_artifacts/pending-records/plan-008/unreachable-code.json` (create)

**Out of scope**
- `scripts/ci-runtime-contract-check.mjs`; `js/**`; `architecture/browser-data-fixture.json`; any ledger.
- `_artifacts/**` evidence that mentions the removed files.
- Anything not named in A–C, however dead it looks — report it instead.

## Steps

### Step 1: Re-verify A, B and C
Run the reference searches for every name and file. If any has a product importer or a workflow reference you did
not expect, mark it **keep** and continue with the rest.
**Verify**: your report lists each item with its hit count.

### Step 2: Remove the KR index trend module and its tests
1. In `scripts/ci-esm-core-unit-check.mjs`, delete the whole `{ … }` block that tests the module (from its
   introducing comment to the block's closing brace). At the planned commit the block is lines 5518–5547 (comment 5518–5519, `{` at 5520, `}` at 5547) and every
   local it uses is declared inside it; confirm the boundaries by reading before cutting.
2. In `scripts/ci-korea-participation-fixture.mjs`, remove `krIndexTrendFacts, krIndexReading` import and the
   `chartLine` / `quiet` / `quietLine` assertions that use them; keep the `buildKoreaRegimeObservations` assertions.
   (`quiet` is used only by those lines, so it goes too.) If the
   file's final `console.log('PASS …')` line still names the chart-tab KR card, trim that wording.
3. In `scripts/fixtures/pipeline-semantics/market.mjs` fixture `R1-05`, remove the three lines that load
   `krIndexTrendFacts` and assert `d1Direction`; keep the `sectorMoves` assertion and the fixture.
4. Delete `src/ui/components/kr-index-trend.js` (`git rm`). Delete CSS lines 377–378; for line 376 run
   `git grep -n "kr-index-move" -- src js index.html` — if the only hit is the CSS rule itself, delete it too.
5. Remove registry entries naming the file, if any.

**Verify**: the three gates in the commands table exit 0; `git grep -n "kr-index-trend\|krIndexTrendFacts\|kr-index-trends" -- src js scripts index.html architecture` → nothing.

### Step 3: Remove the unused exports
For each B item still unreferenced: delete the declaration (function body and its own comment). Then check what it
alone used: an import or constant that now has no user in that file is deleted too (`createHash` in
`schema-fingerprint.mjs`; `artifactUrl` in `knowledge-search.js`; `NEWS_FEED_STALE_MS` has no other user and goes;
`newsFeedQuietAllowanceMs` is used by `scripts/lib/operational-health.mjs` and stays — re-check each with
`git grep -n -w` before deleting). Do not remove anything that still has a user.

**Verify**: `node --check` each touched file; `node scripts/ci-esm-core-unit-check.mjs` exit 0;
`node scripts/qa-runner.mjs contracts --keep-going` → only the known failures.

### Step 4: Remove the orphan script
`git rm scripts/research-screen-text-snapshot.mjs`. Check `architecture/qa-pipeline.json` and
`_context/CODE-MAP.md` do not list it (they should not).

**Verify**: `node scripts/ci-qa-pipeline-contract-check.mjs` exit 0; `node scripts/qa-runner.mjs fast` → `fail=0`.

### Step 5: Pending record
Change-only entry (no `p`) listing what was removed. **Verify**: `node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

No new tests. Existing gates must pass with the dead assertions gone; the live 시장 상태 한국 card keeps its
assertions in `ci-korea-participation-fixture.mjs`.

## Done criteria

- [ ] `git ls-files src/ui/components/kr-index-trend.js scripts/research-screen-text-snapshot.mjs` prints nothing
- [ ] Each removed name greps to nothing in `src js scripts index.html`
- [ ] `ci-esm-core-unit-check`, `ci-korea-participation-fixture`, the pipeline-semantics gate, `ci-qa-pipeline-contract-check` exit 0
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- The `ci-esm-core-unit-check.mjs` block shares locals with code outside it and cannot be cut cleanly.
- A gate counts fixtures/assertions and fails because one was shortened (report the gate; do not edit its baseline).
- The live 시장 상태 한국 card turns out to import anything from the module.

## Maintenance notes

- Reviewer: confirm the 시장 상태 화면's 한국 board still renders (browser groups after integration) — it never
  imported this module, so it should be untouched.
- `src/domain/ai/inference-efficiency.js` is the other module reachable only from tests; the owner decides.
