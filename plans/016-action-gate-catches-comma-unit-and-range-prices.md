# Plan 016: The AI trade-instruction gate catches prices written with thousands separators, 만/억 units and ranges

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- src/ai/response/request-pipeline.js`
> If it changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW–MED (a wider pattern can replace a legitimate analytical sentence; the tests below guard that)
- **Depends on**: none
- **Category**: bug (user-protection rule)
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

A fixed product rule: the app never tells the reader what to buy or sell, at what price, size or time. The AI answer
passes through an "action gate" that replaces a sentence carrying such an instruction with a notice. The gate misses
the most common ways a price is written in Korean. Executed against the current code:
`손절은 1050달러에서 하세요.` is replaced, but `손절은 1,050달러에서 하세요.`, `삼성전자 손절은 65,000원에서 하세요.`,
`NVDA 1,000달러 매수.`, `목표가는 1,200달러로 잡으세요.`, `손절은 7만 원에서 하세요.`, `손절가는 7만원으로 잡으세요.`,
`손절은 175~178달러에서 하세요.` and `손절은 175-178달러 부근에서 하세요.` are all shown unchanged. An earlier fix
(P2114) closed the same hole for the decimal point only.

## Current state

`src/ai/response/request-pipeline.js`, function `_aioApplyAIActionGate(text, meta)` (starts ~line 558):

```js
    var tickerAction = /(?:^|[\s:：(])[A-Z]{1,5}\s*(?:비중\s*)?\$?\d[\d,.]*\s*(?:달러|원|%)?\s*(?:매수|매도|확대|축소)\s*[.!)]?\s*$/;
    …
    var pricedImperative = new RegExp('(?:' + action + '|손절가|목표가|매수가|매도가|진입가|익절가)\\s*(?:은|는|을|를)?\\s*\\$?\\d[\\d,.]*\\s*(?:달러|원)?\\s*(?:에서|에|으로|로|부근에서|근처에서)\\s*(?:하세요|하십시오|하라|두세요|잡으세요|거세요|설정하세요|정하세요…
    var patterns = [recommend, imperative, colloquial, weight, opportunity, tickerAction, english, pricedImperative];
    …
    // P2114: a decimal point ("177.50달러") does not end a sentence; splitting there let a priced imperative with cents through.
    var sentences = raw.match(/(?:[^.!?。\n]|\.(?=\d))+(?:[.!?。]+|\n|$)\s*/g) || [raw];
    var replaced = 0;
    var out = sentences.map(function(sentence) {
      // A negation counts only inside the clause that carries the directive ("지금 매수하세요, 이것은 지시가 아닙니다" is replaced).
      var directive = sentence.trim().split(/[,，;；]+|\s(?:그러나|하지만|다만|그리고|또한|그러면서|그다음|그\s*후)\s|\s(?:and|but|then)\s/i).some(function(clause) {
        clause = clause.trim();
        return !!clause && patterns.some(function(re) { return matchesOf(clause, re).some(function(m) { return !bound(clause, m) && !quoted(clause, m); }); });
      });
```

Two causes:
1. **Clause split on every comma** — `1,050` is cut into `…손절은 1` and `050달러에서 하세요`, so no pattern sees the
   action word and the number together.
2. **`pricedImperative` number shape** — it accepts `\$?\d[\d,.]*\s*(?:달러|원)?` then the particle. A magnitude
   (`7만 원`, `7만원`, `1억`) or a range (`175~178달러`, `175-178달러`) between the number and the particle stops it.

The module is installed with `installAIRequestPipeline(root, …)` and exposes `_aioApplyAIActionGate` on the root
object. Existing tests of the gate: find with
`git grep -n "_aioApplyAIActionGate\|177.50" -- scripts` (the P2114 decimal case is the pattern to sit next to;
candidate files: `scripts/ci-ai-chat-reliability-contract-check.mjs`, `scripts/ci-ai-intelligence-contract-check.mjs`,
`scripts/fixtures/pipeline-semantics/ai.mjs`).

Sentences that must stay untouched (analysis, not instruction) — the gate's own comments name these classes:
a level stated as a fact (`50일선은 1,050달러 부근입니다.`), a conditional description
(`1,050달러를 이탈하면 추세가 약해집니다.`), a negated instruction (`1,050달러에서 손절하라는 뜻은 아닙니다.`), an
attributed rule (`오닐은 7~8% 손실에서 손절해야 한다고 봤습니다.`), and a list with commas
(`매출, 영업이익, 순이익이 모두 늘었습니다.`).

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
| Find the gate's tests | `git grep -n "_aioApplyAIActionGate" -- scripts` | the file(s) to extend |
| AI gates | `node scripts/ci-ai-chat-reliability-contract-check.mjs`; `node scripts/ci-ai-intelligence-contract-check.mjs` | exit 0 |
| Replay fixtures | the gate that runs `scripts/fixtures/pipeline-semantics/*` (`git grep -ln "pipeline-semantics" -- scripts/ci-*.mjs`) | exit 0 |
| Boot bytes unchanged enough | `node scripts/ci-boot-bundle-budget-check.mjs` | exit 0 |

## Scope

**In scope**
- `src/ai/response/request-pipeline.js` — only inside `_aioApplyAIActionGate`: the clause split expression,
  `pricedImperative`, and `tickerAction`'s number part if needed
- the existing gate file that already tests the action gate (add cases)
- `_artifacts/pending-records/plan-016/action-gate-prices.json` (create)

**Out of scope**
- Every other pattern (`recommend`, `imperative`, `colloquial`, `weight`, `opportunity`, `english`), `bound`, `quoted`.
- `src/ai/response/publication.js` (the numeric-evidence check is another plan).
- The notice text.

## Steps

### Step 1: Failing tests first
In the gate file that holds the P2114 decimal case, add `v59.94` assertions through the same harness that file uses
to reach `_aioApplyAIActionGate`:
- **must be replaced** (the output contains the directive notice and not the price): the eight sentences listed in
  "Why this matters".
- **must stay unchanged**: the five analysis sentences listed at the end of "Current state", plus
  `손절은 1050달러에서 하세요.` staying replaced (regression guard for the existing behaviour).

**Verify**: run that gate → the eight "must be replaced" assertions fail, the others pass. If any "must stay
unchanged" sentence is already replaced today, note it and remove that sentence from the test (do not fix it here).

### Step 2: Do not split a clause inside a number
Change only the clause separator so that a comma (or full-width comma) between a digit and exactly three digits is
not a separator. One way: split on `(?<!\d)[,，;；]+|[,，;；]+(?!\d{3}(?:\D|$))` … if look-behind is awkward, mask
`(\d),(?=\d{3}(?:\D|$))` to a placeholder before splitting and unmask each clause after. Choose the simpler one that
passes the tests; keep the other separators (그러나/하지만/…/and/but/then) exactly as they are.

**Verify**: the four comma cases now pass; the comma-list analysis sentence stays unchanged.

### Step 3: Let `pricedImperative` read units and ranges
Extend only the number part of `pricedImperative` to: a number, an optional range tail
(`\s*[~\-–]\s*\$?\d[\d,.]*`), an optional magnitude (`\s*(?:천|만|억)`), then the optional currency word
(`\s*(?:달러|원)?`). Everything before (the action/price nouns) and after (particles, imperative endings) stays.
If `NVDA 1,000달러 매수.` still passes after Step 2, check `tickerAction` — its number part `\d[\d,.]*` already
allows commas, so Step 2 should have fixed it; only touch it if the test still fails.

**Verify**: all eight "must be replaced" assertions pass and every "must stay unchanged" assertion passes;
`node --check src/ai/response/request-pipeline.js`.

### Step 4: Gates and pending record
Run the AI gates, the replay-fixture gate, the boot budget gate and
`node scripts/qa-runner.mjs contracts --keep-going`. Defect entry (`p`), `violated_rule`: the no-trade-instruction
product rule. `node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Step 1 (13+ sentences). Prove the tests bite: with the source change stashed, the eight fail.

## Done criteria

- [ ] The eight instruction sentences are replaced; the analysis sentences are unchanged (assertions exist and pass)
- [ ] Those assertions fail with `src/ai/response/request-pipeline.js` stashed back
- [ ] AI gates, replay fixtures and boot budget gate exit 0
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- An existing gate case flips (a sentence that was allowed is now replaced, or the reverse) and you cannot keep both
  the old case and the new ones — report the sentence.
- The fix seems to need a change to `bound`, `quoted` or another pattern.
- The boot bundle budget is exceeded by the change.

## Maintenance notes

- This gate is pattern-based; it will always have another spelling it misses. Each miss found later gets a sentence
  in this test list first.
- Reviewer: read the two regex changes for catastrophic backtracking (nested quantifiers over `[\d,.]`), and try a
  long answer (2,000 characters) through the gate for timing.
