# Plan 029: The HY 20-session latch keeps the credit state at 부담 until both release legs clear, in every reader

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- src/domain/briefing/market-read.js src/domain/briefing/credit-reading.js`
> If either changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (changes the 시장 상태 credit axis on days inside the latch's hold window; the axis feeds the overall label)
- **Depends on**: none
- **Category**: bug (one fact, two rules)
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

The credit axis has a latch (P2287): once the 20-session high-yield widening enters stress, the 부담 verdict is
released only when **both** legs clear — the 20-session change is back under +25bp **and** the 5-session change is
under +15bp ("a spiked base is not an easing"). The latch itself implements this. But the three places that turn
the latch into a state all add a precondition, "the 20-session change is still at or above +25bp", in front of it.
So in exactly the window the latch exists for — 20-session change back under +25bp while the last five sessions
still widen by +15bp or more — the latch says stress and every reader says 중립. Executed on the project's own
P2287 fixture: latch `{"value":4,"stress":true,"since":"2026-09-15"}`, credit judgement `neutral`, 시장 상태 axis
"neutral … 스프레드 수준·방향이 경계선입니다(하이일드 344bp, 5일 +16bp, 20거래일 +4bp)". The release text shown to
the reader promises both legs; the verdict releases on one.

## Current state

`src/domain/briefing/market-read.js`:

- `hyWidening20Record` (~lines 280–310) — the latch:

```js
  // P2287: released only when the five-session change is also under widenWatch5dBp (a spiked base is not an easing).
  const latch = latchedState(changes.slice(from).map((point, i) => ({ ...point, enter: enterAt(from + i + 1) })), (point) => point.value >= point.enter,
    (point) => point.value < rule.widen20dBp && !(point.d5 != null && point.d5 >= rule.widenWatch5dBp));
  …
  return { value: last.value, date: last.date, enterBp, pct: rank.pct, n: rank.n, highest: rank.highest, stress: latch.on, since: latch.since };
```

- `alignMarketInputs` (~lines 503–507) — reader 1:

```js
  // v57.81: 20-session stress needs the current change at the widen20dBp line and either the latched record state or,
  // without a record, a change of stress20dMultiple x widen20dBp.
  c.hy20Stress = c.hy20 != null && c.hy20 >= RULES.credit.widen20dBp
    && (c.hy20Record ? c.hy20Record.stress : c.hy20 >= RULES.credit.stress20dMultiple * RULES.credit.widen20dBp);
```

- the credit axis block (~lines 1436–1446) — reader 2, the hypothetical-spread search used for "판단이 바뀌는 조건":

```js
    const stressAt = (change) => change != null && change >= C.widen20dBp
      && (c.hy20Record ? (c.hy20Record.stress || change >= c.hy20Record.enterBp) : change >= C.stress20dMultiple * C.widen20dBp);
```

`src/domain/briefing/credit-reading.js` `creditJudgement` (~line 16) — reader 3 (매크로 신용 장, 시장 이야기):

```js
  const hy20Stress = hy20Bp != null && hy20Bp >= RULES.credit.widen20dBp && (record ? !!record.stress : hy20Bp >= RULES.credit.stress20dMultiple * RULES.credit.widen20dBp);
```

`RULES.credit` (`src/domain/rules/thresholds.js`): `widen20dBp: 25`, `widenWatch5dBp: 15`, `widen5dBp: 25`,
`stress20dMultiple: 2`, `stressAtBp: 450`, `tightBelowBp: 350`.

Sentences that already describe a held latch: `creditReading` in `credit-reading.js` has a branch for
`rec && j.hy20 < rec.enterBp` ("…진입선 아래로 내려왔지만 … 확대 부담 판정이 유지…"), and the axis read at
`market-read.js` ~1482 has the same idea. `creditReleaseText({ hyBp, hy5, hy20, latched })` (~line 410) lists the
legs still open.

Tests: the P2287 block in `scripts/ci-esm-core-unit-check.mjs` (search `P2287`; ~lines 7420–7435 before this plan)
builds a macro history where `days[330]` is the hold window (HY 344bp, 5-day +16bp, 20-session +4bp).
`scripts/ci-metric-consistency-check.mjs` section 8 compares every reader of the credit state on a fixture close and
on today's files; `scripts/ci-crash-replay-check.mjs` replays past weeks through the regime.

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
| Unit gate | `node scripts/ci-esm-core-unit-check.mjs` | exit 0 |
| One fact, one state | `node scripts/ci-metric-consistency-check.mjs` | exit 0 |
| Past weeks | `node scripts/ci-crash-replay-check.mjs` | exit 0 |
| Other regime fixtures | `node scripts/ci-scenario-guidance-fixture.mjs`; `node scripts/ci-regime-scenarios-fixture.mjs`; `node scripts/ci-lookahead-check.mjs` | exit 0 |

## Scope

**In scope**
- `src/domain/briefing/market-read.js` — only the two expressions quoted (`c.hy20Stress`, `stressAt`) and their comments
- `src/domain/briefing/credit-reading.js` — only the `hy20Stress` expression in `creditJudgement`
- `scripts/ci-esm-core-unit-check.mjs` — new `v59.97` assertions in/after the P2287 block
- `_artifacts/pending-records/plan-029/credit-latch-hold.json` (create)

**Out of scope**
- `hyWidening20Record` and `latchedState` (the latch is right), `RULES`, `creditState`, the sentences.
- Any gate expectation other than the new assertions (see STOP conditions).

## Steps

### Step 1: Failing assertions first
In the P2287 block, at the hold-window day the fixture already uses (`days[330]`; read the block to see how it cuts
the history and what it already asserts), add `v59.97` assertions:
- `creditJudgement(macroHistory, <that day>).state === 'burden'` and its `cause.wide20 === true`;
- the 시장 상태 credit axis from `buildMarketRegime` (or `buildMarketRead` — use whichever the block already calls)
  with the same macro history and `credit: { hyBp, hyDelta5Bp, hyAsOf }` for that day is `'burden'`;
- on a later fixture day where both legs have cleared (the block already has the release day — find it), both are
  not `'burden'`.

**Verify**: the unit gate fails on the first two assertions with the current source. If they pass before any source
change, STOP (the finding does not reproduce).

### Step 2: Let the record decide when there is a record
Change the three expressions so that a record's latched state is used as is, and the `>= widen20dBp` precondition
applies only to the no-record fallback:
- `c.hy20Stress = c.hy20Record ? c.hy20Record.stress === true : (c.hy20 != null && c.hy20 >= RULES.credit.widen20dBp && c.hy20 >= RULES.credit.stress20dMultiple * RULES.credit.widen20dBp);`
- `stressAt(change)`: with a record → `c.hy20Record.stress || (change != null && change >= c.hy20Record.enterBp)`
  — keep the hypothetical semantics: this function answers "would it be stress at this hypothetical 20-session
  change?"; a currently latched record stays latched for a hypothetical change that is still at or above
  `widen20dBp`, and for a lower hypothetical change it is latched only if the 5-session leg (the hypothetical `d5`
  the caller computes) is still at or above `widenWatch5dBp`. Read the caller `creditAt(level)` (it computes `d5` and
  `d20` for the hypothetical level) and pass what `stressAt` needs so the flip search reports the release point the
  latch would actually use. If that needs more than a few lines, keep `stressAt` semantically equal to the latch's
  release rule and say exactly what you did.
- `creditJudgement`: `const hy20Stress = record ? !!record.stress : (hy20Bp != null && hy20Bp >= RULES.credit.widen20dBp && hy20Bp >= RULES.credit.stress20dMultiple * RULES.credit.widen20dBp);`
Rewrite the `v57.81` comment above `c.hy20Stress` to say what the code does now (the record's latch decides; the
multiple applies only without a record) — no new version tag in the comment.

**Verify**: `node --check` both files; the unit gate passes including Step 1's assertions.

### Step 3: The readers' sentences in the hold window
With the state now 부담 in the hold window, check what each reader prints there (use the Step 1 fixture day):
`creditReading(judgement)`, the axis `read`, the axis `flip` and `creditFlip(judgement)`. Each must describe a held
latch (20-session change back under the entry line, verdict held since the latch date) and name the leg still open
(the 5-session change). Print the four strings in your report. If one of them reads as a contradiction (for example
"20거래일 +4bp 벌어져 자체 기록에서 빠른 확대"), fix only that branch condition so the held-latch wording is chosen,
and add a `v59.97` assertion for it.

**Verify**: unit gate exit 0.

### Step 4: All regime gates
Run every gate in the commands table and `node scripts/qa-runner.mjs contracts --keep-going`. A replay or fixture
expectation that flips from 중립 to 부담 on a day inside a latch hold window is this plan's intended effect — but do
not edit an existing expectation: list each flipped case (gate, case id, date, old → new) and STOP if there is any.

### Step 5: Pending record
Defect entry (`p`). `node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Steps 1 and 3. The assertions must fail on the old source (copy-aside method, not the shared stash).

## Done criteria

- [ ] At the fixture's hold-window day: latch stress, judgement, and axis all say 부담; after release none does
- [ ] `ci-metric-consistency-check`, `ci-crash-replay-check` and the regime fixtures exit 0 with no edited expectation
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- Step 1's assertions pass before the change.
- An existing gate expectation flips (Step 4).
- The flip search (`stressAt`/`creditAt`) cannot express the two-leg release without restructuring the axis block.

## Maintenance notes

- On today's data the latch is off (`since: null`), so nothing changes on screen at release time; the change shows
  the next time a 20-session widening enters stress and then eases unevenly.
- Reviewer: this is the same class as the v59.96 incident (one fact, readers with different preconditions) — check
  that no fourth reader re-derives 20-session stress (`git grep -n "widen20dBp" -- src`).
