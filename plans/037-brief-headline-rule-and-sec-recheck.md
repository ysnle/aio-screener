# Plan 037: A brief headline that is not Korean never reaches the file; an issuer's first annual filing is retried

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The two parts are independent. Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- scripts/fetch-event-briefs.mjs src/domain/briefing/event-briefs.js scripts/fetch-sec-fundamentals.mjs`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P2
- **Effort**: S (A), M (B)
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (producer)
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

- **A.** A blocking preflight gate (`ci-headline-translation-check.mjs`) requires every headline in
  `public-data/event-briefs.json` to contain at least two Hangul syllables. The producer does not enforce that: the
  FOMC brief's headline is the model's text whenever its numbers verify, and the shared `briefHeadline` accepts a
  single Hangul character. If the model answers with an English headline, the brief is committed and **every later
  release fails preflight** for as long as the brief stays in the file — up to 10 days for an FOMC brief. The
  producer and the gate must apply the same rule, at the producer.
- **B.** `fetch-sec-fundamentals.mjs` records an issuer with no comparable annual facts (for example a recent IPO
  that has filed only 10-Qs) as terminally unsupported and never retries it unless the concept-set version changes.
  When that company files its first 10-K, its fundamentals stay missing indefinitely.

## Current state

**A.** `scripts/ci-headline-translation-check.mjs` ~lines 18 and 79–81 (the ≥ 2 Hangul rule over
`event-briefs.json` headlines). `scripts/fetch-event-briefs.mjs` ~lines 278–281 and ~380 (the FOMC headline path;
find `safeHeadline`/`headline` there). `src/domain/briefing/event-briefs.js` ~line 556 `briefHeadline` (accepts one
Hangul character). The rule the news producer already uses: `isCleanKoreanTitle` (≥ 2 Hangul syllables) — find it
with `git grep -n "isCleanKoreanTitle" -- scripts src` (it is used at `scripts/producer/market-narrative.mjs` ~279
and marks `titleKoFailed` in `scripts/fetch-data.mjs` ~196–200). Fixture gate: `scripts/ci-event-briefs-check.mjs`.

**B.** `scripts/fetch-sec-fundamentals.mjs`: ~lines 406–419 — `normalizeSecCompanyFacts` returning `null` is
recorded with a terminal reason (`required-us-gaap-annual-concepts-unavailable`, status `TERMINAL_UNSUPPORTED`);
~line 328 — a terminal row is skipped unless `SEC_RECHECK_UNSUPPORTED` is set or the concept set changed; ~line 313
— `newFiling` (a periodic filing newer than the stored data) is computed only for symbols that already have data
and is evaluated after the terminal filter (~330). The SEC ledger itself lives on the `data-store` branch (not in
your checkout); the selection logic is testable through exported helpers — find the gate:
`git grep -ln "fetch-sec-fundamentals" -- scripts/ci-*.mjs`.

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
| Brief gates | `node scripts/ci-event-briefs-check.mjs`; `node scripts/ci-headline-translation-check.mjs` | exit 0 |
| SEC gates | each gate from `git grep -ln "fetch-sec-fundamentals\|sec-ledger" -- scripts/ci-*.mjs` | exit 0 (some print a labelled SKIP without the ledger; that is expected) |

Never run a `fetch-*.mjs` producer as a script.

## Scope

**In scope**
- `scripts/fetch-event-briefs.mjs` (the headline acceptance), `src/domain/briefing/event-briefs.js` (`briefHeadline`)
- `scripts/fetch-sec-fundamentals.mjs` (the due/skip selection only)
- the fixture gates named above (`v59.97` cases)
- `_artifacts/pending-records/plan-037/` — one JSON per completed part

**Out of scope**
- `scripts/ci-headline-translation-check.mjs` (the gate's rule stays), `public-data/**`, the AI prompts, the SEC
  normaliser and concept sets.

## Steps

### Part A — one Korean-title rule, applied where the headline is accepted
1. Failing tests first (`v59.97`, in `ci-event-briefs-check.mjs`, calling the exported functions — read how the
   file builds an FOMC brief from a stubbed model answer): a model headline in English with verified numbers → the
   stored headline is the producer's own fallback headline (Korean), not the model's; a headline with one Hangul
   character → fallback; a proper Korean headline → kept. For `briefHeadline`: one Hangul character → the fallback
   branch.
2. `isCleanKoreanTitle` lives in `scripts/producer/market-narrative.mjs` (~279), which `src/` cannot import and
   which pulls ~30 modules. Apply the gate's own rule — at least two Hangul syllables — at both acceptance points:
   in `src/domain/briefing/event-briefs.js` `briefHeadline` with a small local test (or an existing `src/` helper —
   search `git grep -n "HANGUL\|가-힣].*가-힣" -- src/domain | head`), and in `scripts/fetch-event-briefs.mjs`
   `safeHeadline` with the same test (importing the shared helper from `src/` if you add one). `safeHeadline` is
   not exported: test the FOMC path by driving `buildEventBriefs` with `{ ...sources, ai: async () => … }` the way
   the fixture's `fixtureSources.ai` does.
3. Check what the fallback headline is for each brief kind and that it always passes the gate's rule; print one of
   each in your report.

**Verify**: both brief gates exit 0; the English-headline case fails on the old producer.

### Part B — a terminal "no annual concepts" row becomes due when a newer periodic filing exists
1. Read the selection code (~lines 297–345 of `refreshSecFundamentals`: the `dueTargets` map and filter are
   inline; the only exported selector is `selectSecBatch`, which takes prebuilt rows) and write down the order of
   the filters. Facts at the planned commit: `periodic.filers` is a map from CIK to the latest periodic filing
   **date** over the last 7 days, with no form type; `SEC_PERIODIC_FORMS` (~line 48) includes 10-Q/10-QT; the
   existing `newFiling` test compares with `>=` against a date-only attempt date; IFRS filers use a different
   terminal reason (`required-ifrs-…`).
   Decisions for this plan: (a) extract the due test into an exported pure function
   (e.g. `isSecTargetDue(row, { periodicDate, conceptSetChanged, recheckUnsupported, now })`) and call it from the
   inline filter — a mechanical extraction; (b) a terminal row of either "annual concepts unavailable" reason
   (US-GAAP or IFRS) becomes due when the issuer has a periodic filing dated **strictly after** the row's attempt
   date — any periodic form counts, because the map carries no form type: a 10-Q costs one extra fetch per quarter
   for such an issuer and is how the first annual facts are eventually found; (c) the retry goes through the normal
   path (no bypass of the existing 24-hour retry spacing), and a retry that again yields no annual concepts moves
   `attemptedAt` forward so the same filing date does not trigger again.
2. Failing test first (`v59.97`, in `scripts/ci-fiscal-quality-fixture.mjs`, next to its `selectSecBatch` cases
   ~133/218, calling the extracted function): a symbol recorded
   `TERMINAL_UNSUPPORTED` with reason `required-us-gaap-annual-concepts-unavailable` and `attemptedAt` = T, and a
   filing index showing a 10-K (or 20-F/40-F — use the same form list `newFiling` uses) filed after T → the symbol
   is due; the same row with no newer periodic filing → not due; a terminal row with a different reason → not due.
3. Implement: compute the newer-periodic-filing test for terminal rows of that one reason before the terminal
   filter, and treat a hit as due. Bound the retries: after a retry that again yields no annual concepts, the row's
   `attemptedAt` moves forward, so the same filing does not trigger again (assert this in the test).

**Verify**: the SEC gates exit 0 (or print their labelled ledger SKIP); the first test fails on the old source.

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records (defects, `p`).
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Per part above.

## Done criteria

- [ ] An English or one-character model headline is replaced by a Korean fallback in the stored brief
- [ ] A terminal no-annual-concepts row is due exactly when a newer periodic filing exists, once per filing
- [ ] Brief and SEC gates exit 0 with no edited expectation; `git status --short` shows only in-scope paths

## STOP conditions

- A: a fallback headline for some brief kind can itself be non-Korean (e.g. built from an English company name
  alone) — report the kind; the fix then needs a wording decision.
- B: extracting the due test changes which symbols are selected for a fixture that exists today (compare the
  selected set before and after on the gate's fixtures) — report the difference.

## Maintenance notes

- Reviewer: Part A makes the producer the owner of the rule the preflight gate checks, so a model answer can no
  longer freeze releases. Part B's effect appears in the next `refresh-screener` run after a first 10-K is filed.
