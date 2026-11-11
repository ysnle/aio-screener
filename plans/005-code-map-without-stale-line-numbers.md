# Plan 005: CODE-MAP points at symbols that exist, not at line numbers that moved

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- _context/CODE-MAP.md architecture/route-owners.json _context/CLAUDE.md`
> If any changed, re-read the sections named below before editing; on a structural mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (docs and one registry note; gates parse parts of these files)
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

The project instructions route every `index.html` edit and most legacy edits through `_context/CODE-MAP.md`
("find the range in CODE-MAP, read only that range"). Its hand-measured line numbers are wrong by hundreds to tens of
thousands of lines, and several rows name functions that no longer exist in the named file. An agent that follows
them reads the wrong region or past the end of the file. Hand re-measuring decays again on the next release, so this
plan removes line numbers and names stable anchors (symbols, ids, and the `grep` that finds them).

## Current state

Facts measured at the planned commit (`wc -l`): `index.html` 5,590 lines; `js/aio-core.js` 14,763;
`js/aio-chat.js` 4,490; `js/aio-ui.js` 1,251.

`_context/CODE-MAP.md`:
- Section `## v59.69 rescan (2026-11-04, origin/main 432ac3eb)` (around line 174) says index.html has 6,239 lines
  and holds three tables:
  - `### Shell/script boundaries` — line ranges such as `39~3446 | main CSS`, `6236 | src/app/bootstrap.js`.
  - `### Active route DOM starts (20)` — e.g. `page-home | 3766`, `page-portfolio | 4691`, `page-screener | 5397`.
    Actual today: `page-home` 3426, `page-portfolio` 4135, `page-screener` 4814.
  - `### Current high-value runtime anchors` — e.g. `DATA_SNAPSHOT | js/aio-core.js:12919 / 12959` (actual: 11116),
    `destroyPageCharts / showPage | js/aio-core.js:16237 / 16462` (actual: 14302 / 14527).
- Section `## 4. 빠른 작업 참조` (around line 502) — a table "작업 | 우선 파일/범위" whose rows cite e.g.
  `index.html:10`(title — actual line 13), `index.html:5237`(badge), `js/aio-core.js:17670`(APP_VERSION — actual line 2),
  `index.html:12461~12463`, `js/aio-core.js:20068~20335`(computeTradingScore… — not defined in `js/aio-core.js` any
  more; the anchors table above already says `src/app/score-entry-points.js`), `js/aio-core.js:22841~23313`,
  `js/aio-ui.js:113~360`, `js/aio-chat.js:2320~5160`, `index.html:9476~9931`, `index.html:10526~11699`,
  `index.html:28287`, `scripts/fetch-data.mjs:1082`(`_rsi14`) and `:1173`(`backtestFactors` — now in
  `scripts/lib/factors.mjs`; `scripts/fetch-data.mjs` has 346 lines).
- Rows elsewhere in the file that are explicitly marked retired / "파일 없음" are tombstones — leave them.

`architecture/route-owners.json` has a string field `rm01Note` labelled "CURRENT (A06, 2026-10-12)" that says
"19 active routes … chartOwner native on 8, legacy on 7", while the same file's `counts` object says
`totalRoutes: 20`, `chartNative: 15`.

`_context/CLAUDE.md` has a "Commands and skills" table with 9 rows; `.claude/commands/` holds 21 command files.

Gates that read these files (run them after editing): `scripts/ci-doc-currency-check.mjs`,
`scripts/ci-knowledge-lint-check.mjs`, `scripts/ci-workspace-contract-check.mjs`,
`scripts/ci-decomp-hotspot-check.mjs` (it requires every file in `architecture/decomposition-hotspots.json`
`measuredFiles` to be named somewhere in CODE-MAP.md — never remove the last mention of `index.html` or of a
`js/aio-*.js` file name). About a dozen gates read `architecture/route-owners.json`; `qa-runner fast` and
`qa-runner contracts` cover them.
`architecture/governance-markers.json` may list marker strings that must stay in docs — check it before deleting any
sentence that contains an `R<number>`/`P<number>` id.

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
| Where a symbol lives now | `git grep -n "<symbol>" -- js src scripts index.html` | file:line of the definition |
| Route DOM ids | `grep -n 'id="page-' index.html` | 20 lines |
| Docs gates | `node scripts/ci-doc-currency-check.mjs && node scripts/ci-knowledge-lint-check.mjs && node scripts/ci-workspace-contract-check.mjs && node scripts/ci-decomp-hotspot-check.mjs` | all exit 0 (the knowledge lint prints 4 warnings today; that is fine) |
| Generated state unaffected | `node scripts/qa-runner.mjs fast` | `fail=0` |

## Scope

**In scope**
- `_context/CODE-MAP.md` — only the `## v59.69 rescan …` section (its three tables and intro paragraph) and the
  `## 4. 빠른 작업 참조` table
- `architecture/route-owners.json` — only the `rm01Note` string
- `_context/CLAUDE.md` — only the "Commands and skills" table (it is a tracked hand-written file, not generated)
- `_artifacts/pending-records/plan-005/code-map-anchors.json` (create)

**Out of scope**
- The front matter of any of these files, the size table that `generate-workspace-state` owns, and every other
  CODE-MAP section (older snapshots are labelled as history — leave them).
- `CLAUDE.md` (root), `AGENTS.md`, `_context/INDEX.md`, the generated `CURRENT-STATE.md` / `CONTEXT-CATALOG.json`.
- Any code file.

## Steps

### Step 1: Rescan section → anchors
Keep the heading `## v59.69 rescan (2026-11-04, origin/main 432ac3eb)` and the three `###` sub-headings exactly as
they are: a paragraph near line 325 refers to them by name (`위 "v59.69 rescan" 절의 "Active route DOM starts (20)" 표`)
and is out of scope. Replace only the intro paragraph under the heading with two sentences: line numbers are not
recorded because they move every release; each row names an id or symbol and the command that finds it.
- **Shell/script boundaries**: keep the *content* column, replace each range with the anchor that finds it
  (e.g. `grep -n '<style' index.html`, `grep -n 'aio-core.js?v=' index.html`, `grep -n 'src/app/bootstrap.js' index.html`).
  Drop a row whose content no longer exists in `index.html` (verify with grep; e.g. the comment at the planned commit
  says `js/aio-glossary.js` now loads after boot from `src/app/classic-loader.js`, not from a defer tag).
- **Active route DOM starts**: replace the line column with nothing — keep one line: the 20 ids are found with
  `grep -n 'id="page-' index.html`, and list the ids in route order on one or two lines. Keep the sentence about
  `page-options` having no DOM.
- **Runtime anchors**: for each symbol, run `git grep -n` and write `file` + the search string, no line number. If a
  symbol no longer exists anywhere under `js/` or `src/`, remove its row.

**Verify**: for every symbol/id left in the three tables, the grep you wrote returns at least one hit (paste the
count per row in your report). `grep -c '~[0-9]\{3,\}' <that section>` → 0.

### Step 2: `## 4. 빠른 작업 참조` → files and symbols
For each row keep the task label; in the right column keep file names and symbol names and delete every `:<number>`
and `<number>~<number>` range. Where the named symbol is not in the named file any more, find it with `git grep -n`
and name the file it is in now; if it exists nowhere, delete that part of the row (or the whole row if nothing is
left) — do not guess. `_rsi14` is believed to exist nowhere as a definition any more (only gate text mentions it): confirm and drop it. Known moves to confirm, not assume: `computeTradingScore` → `src/app/score-entry-points.js`;
`backtestFactors` → `scripts/lib/factors.mjs`; `APP_VERSION` is line 2 of `js/aio-core.js` (name it, no number).
The R1 row must keep its instruction to use `node scripts/bump-version.mjs <버전>`.

**Verify**: every `` `path` `` in the table exists (`git ls-files <path>` non-empty) and every named symbol greps in
the named file. Report the rows you deleted and why.

### Step 3: `rm01Note` and the commands table
- `architecture/route-owners.json`: first check whether any gate or `architecture/governance-markers.json` matches
  the note's text (`git grep -n "rm01Note" -- scripts architecture`). If nothing pins its wording, rewrite the
  CURRENT sentence (not only its numbers) from the file's own data: count the `routes` entries and their
  `rendererOwner` / `chartOwner` values with a `node -e` one-liner and state exactly what it prints (at the planned
  commit: 20 active routes, every one `rendererOwner` native; `chartOwner` native on 15 and not-applicable on 5 —
  market-news, principles, masters, atlas, guide; no legacy chart owner; the old list of seven "legacy" routes is
  wrong). Re-date the label to 2026-11-10 and keep any HISTORICAL part of the note verbatim. If something pins the
  wording, leave the note and report it.
- `_context/CLAUDE.md`: under the table add one line saying the table lists the core routes and the full set of
  commands is the files in `.claude/commands/`. Do not add 12 rows.

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('architecture/route-owners.json','utf8'))"` → no error;
the docs gates command → all exit 0; `node scripts/qa-runner.mjs fast` → `fail=0`.

### Step 4: Pending record
Change-only entry (no `p`): documentation anchors. **Verify**: `node scripts/apply-pending-records.mjs --dry-run` → 0;
`node scripts/qa-runner.mjs contracts --keep-going` → only the known failures.

## Test plan

No code. The evidence is the per-row grep results and the docs gates.

## Done criteria

- [ ] In the two edited CODE-MAP sections, `grep -nE '(html|js|mjs):[0-9]+|[0-9]{3,}~[0-9]{3,}'` returns nothing
- [ ] Every path named in those sections is tracked; every symbol greps in its named file
- [ ] Docs gates and `qa-runner fast` pass
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- A gate parses line numbers out of either CODE-MAP section (it fails after the edit) — report which gate.
- `ci-doc-currency-check` or the knowledge lint requires a marker string you removed and you cannot tell where it
  must stay.
- More than a third of the `## 4.` rows name symbols you cannot locate — the section needs an owner decision, not a
  mechanical rewrite.

## Maintenance notes

- Root `CLAUDE.md` tells agents "CODE-MAP → 해당 line 범위만 Read". After this plan that sentence is slightly off
  (anchors, not line ranges); changing `CLAUDE.md` is out of scope here — the reviewer decides.
- A later, optional step is a generator for the anchors table; not needed while it holds no numbers.
