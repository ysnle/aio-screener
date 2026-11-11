# Plan 020: Two producers stop turning a missing input into a silent loss or a zero

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The two parts are independent: if one hits a STOP condition, finish the other and report the stopped part.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- scripts/fetch-tw-monthly-revenue.mjs scripts/fetch-kr-index-weights.mjs scripts/producer/screener.mjs`
> If a file changed, compare its excerpt with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (producer-side; pure functions with fixture gates)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

Product rule: a missing value stays missing and a value that exists is not thrown away.
- **A. Taiwan monthly revenue** (`public-data/tw-monthly-revenue.json`, the AI 공급망 block): if a run's source rows
  omit some of the 16 company codes, the artifact is still published as `status: 'ok'` with only the companies that
  were present. The omitted companies' records and their accumulated monthly history (up to 24 months) are erased;
  when a code returns, its history restarts from 3 months. Executed: rows for 2330 only + a previous artifact with
  12-month histories for 2330 and 2454 → `status ok`, 2454 gone.
- **B. Korean index weights** (`public-data/kr-index-weights.json`): the local `num()` helper turns a blank
  `fluctuationsRatio` into `0`, so a stock with no reported change is published with `ret1dPct: 0` and its weight is
  computed on the unadjusted cap. Executed: `fluctuationsRatio: ''` → `ret1dPct: 0`.

## Current state

**A.** `scripts/fetch-tw-monthly-revenue.mjs`, `export function buildTwMonthlyRevenue({ rows = [], previous = null, generatedAt } = {})`:

```js
  const byCode = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row?.['公司代號'] || '').trim(), row]));
  const prevByCode = new Map((previous?.companies || []).map((c) => [c.code, c]));
  const companies = []; const missing = []; const renamed = [];
  for (const group of TW_AI_CHAIN) {
    for (const [code, expect, nameKo] of group.members) {
      const record = byCode.has(code) ? parseRevenueRow(byCode.get(code)) : null;
      if (!record) { missing.push(code); continue; }
      if (!record.sourceName.startsWith(expect)) renamed.push(`${code}:${record.sourceName}`);
      companies.push({ ...record, nameKo, group: group.id, history: mergeHistory(prevByCode.get(code)?.history, record) });
    }
  }
  const months = companies.map((c) => c.month).sort();
  return { schemaVersion: TW_REVENUE_SCHEMA, generatedAt, status: companies.length ? 'ok' : 'no-companies', …,
    latestMonth: months.at(-1) || null, … };
```

`main()` passes `previous` only when `previous?.status === 'ok'`, returns without writing when `payload.status !== 'ok'`,
and skips the write when `sameRevenueData(payload, previous)`. Each company record carries its own `month`. The
payload has a `missing` array. Fixture gate: `scripts/ci-tw-monthly-revenue-fixture.mjs`. Browser reader:
`src/domain/briefing/tw-monthly-revenue.js` (`buildTwRevenueView`; it requires
`schemaVersion === 'tw-monthly-revenue.v1'`) used by `src/ui/components/ai-chain-flow.js`. A precedent for marking a
kept row: `scripts/fetch-bigtech-cashflow.mjs` (~lines 23–26, 59–62) carries previous rows with `carried: true`.

**B.** `scripts/fetch-kr-index-weights.mjs`:

```js
const num = (value) => { const n = Number(String(value ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
…
export function marketWeights(stocks, top) {
  const common = stocks.filter((row) => row?.stockEndType === 'stock' && /^\d{5}0$/.test(String(row.itemCode || '')))
    .map((row) => {
      const cap = num(row.marketValueRaw);
      const ret = num(row.fluctuationsRatio);
      return cap > 0 && ret != null && ret > -100 ? { code: row.itemCode, name: …, cap, prevCap: cap / (1 + ret / 100), ret, tradedAt: row.localTradedAt } : null;
    }).filter(Boolean);
```

`Number('')` is `0`, so a blank ratio passes `ret != null`. The shared helper that fixes this class is
`readNumber` in `src/domain/shared/number.js` (returns `null` for `''`, `' '`, `null`; it does not strip commas).
Only `weightPct` has a reader (`src/domain/market/regime/move-attribution.js`); `ret1dPct` has none. Tests that
import `marketWeights`: `scripts/ci-event-briefs-check.mjs` and `scripts/fixtures/pipeline-semantics/market.mjs`.

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
| TW fixture gate | `node scripts/ci-tw-monthly-revenue-fixture.mjs` | exit 0 |
| KR weights tests | `node scripts/ci-event-briefs-check.mjs`; the pipeline-semantics gate (`git grep -ln "pipeline-semantics" -- scripts/ci-*.mjs`) | exit 0 |
| Reader behaviour | read `src/domain/briefing/tw-monthly-revenue.js` fully (short) | know how it treats `month`, `missing` and unknown fields |

Never run `node scripts/fetch-tw-monthly-revenue.mjs` or `node scripts/fetch-kr-index-weights.mjs` as scripts.

## Scope

**In scope**
- `scripts/fetch-tw-monthly-revenue.mjs` — only `buildTwMonthlyRevenue` (and `sameRevenueData` if it must ignore/compare the new flag)
- `scripts/ci-tw-monthly-revenue-fixture.mjs` — new cases
- `scripts/fetch-kr-index-weights.mjs` — only `num` and its use in `marketWeights`
- the existing test file for `marketWeights` — new case
- `_artifacts/pending-records/plan-020/` — one JSON per completed part (create)

**Out of scope**
- `public-data/**`, the browser reader and renderer (Part A must be additive for them), `scripts/producer/screener.mjs`.
- The schema version string (stays `tw-monthly-revenue.v1`).

## Steps

### Part A — keep a company the source left out
1. Failing fixture first (`v59.94`): `previous` with companies 2330 and 2454, each with a 12-month `history`;
   `rows` containing only 2330's row for a newer month. Expect: both companies present; 2454 equal to its previous
   record (same `month`, same `history`) plus `carried: true`; `missing` contains `'2454'`; 2330 has 13 months of
   history; `latestMonth` is 2330's new month.
2. In the loop, when `record` is null and `prevByCode.has(code)`: push `{ ...prevByCode.get(code), carried: true }`
   and still add the code to `missing`. A company present in `rows` must not carry the flag (drop a stale
   `carried` from the merged record). When there is no previous record, behaviour is unchanged (skip).
3. `status`: keep `'ok'` when at least one company was parsed **from this run's rows**; if every company is carried
   (no row parsed), return `'no-companies'` as today so `main()` leaves the artifact unchanged.
4. Read `sameRevenueData`: a run that only re-carries the same records must still compare as unchanged (no rewrite).
   Add a fixture for that. Read `buildTwRevenueView`: confirm an extra `carried` field on a company does not break it
   and that a carried company still shows with its own (older) month; if the view would present the old month as the
   latest, STOP and report.

**Verify**: `node scripts/ci-tw-monthly-revenue-fixture.mjs` exit 0; the Step 1 fixture fails with the producer
change stashed.

### Part B — a blank ratio is missing, not zero
1. Failing test first (`v59.94`), next to the existing `marketWeights` test: three stocks, one with
   `fluctuationsRatio: ''` and one with `null` → those two are excluded from the weights (as rows with an unusable
   ratio already are), the remaining one has `weightPct` 100; a stock with `'0.00'` stays included with `ret1dPct: 0`.
2. Make `num` return `null` for a blank/whitespace/`null`/`undefined` input before converting (keep the comma
   stripping for real numbers).

**Verify**: both test gates exit 0; the new case fails with the producer change stashed.

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the known failures. One pending record per completed part
(defects: `p` entries). `node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Per part above.

## Done criteria

- [ ] The carried-company fixture and the blank-ratio case exist, pass, and fail on the old source
- [ ] `git status --short public-data` is empty; `git status --short` shows only in-scope paths
- [ ] The report states how `buildTwRevenueView` treats a carried company

## STOP conditions

- A: the browser view would show a carried company's old month as current, or a schema/shape gate rejects `carried`.
- B: excluding blank-ratio stocks drops a market below the existing "total > 0" guard in an existing fixture.

## Maintenance notes

- Related, not in this plan: `scripts/producer/screener.mjs` (~lines 678–687) wraps `fetchHistory` in `catch` blocks
  that can never run (`fetchHistory` returns `[]` instead of throwing), so a failed ^GSPC/^IXIC read leaves no log
  line. A follow-up can warn on an empty series.
- After the next Actions run, the browser-data fixture may need a re-pin if `carried` appears in the artifact.
