# Plan 031: The portfolio trend chart never shows a return without its currency basis; gap words follow the rounded gap

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The parts are independent. Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- src/domain/portfolio src/ui/components/portfolio-value-trend.js src/domain/screener/screener-read.js`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (a return figure on the reader's own holdings)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

- **A.** On the 포트폴리오 screen, the "지금 구성 vs S&P 500" trend chart rebuilds the past value of today's book
  from each holding's return **in its own listing currency**, while the holding's value is in the account's base
  currency. For a KRW-base account holding US stocks the FX move is silently left out. Executed: one USD holding,
  3-month return +10%, USD/KRW +5% → the chart says +10.0% while the attribution sentence on the same page (which
  does include FX and says "환율 포함") says +15.5%. Two different returns for the same book and window, and nothing
  on the chart says FX is excluded. A figure about the reader's own money must name its basis.
- **B.** The same screen's relative sentence prints "0.0%p 뒤처집니다" with a 부담 tone for a gap of −0.02%p.
- **C.** The screener's trust sentence prints "평균 0.00%p 앞섰습니다" with a favourable tone and the headline
  "과거 상위 20%가 하위보다 앞섬" for a spread of +0.003%p.

## Current state

**A.** `src/domain/portfolio/benchmark-trend.js` (~lines 40–56):

```js
  // Value of today's book `h` sessions ago relative to now, and the index the same way.
  const bookThen = (key) => covered.reduce((sum, [symbol, value]) => sum + value / (1 + returnOf(symbol, key) / 100), 0) / coveredValue;
  const indexThen = (key) => 1 / (1 + indexReturnOf(key) / 100);
```

`value` is the row's value in the base currency; `returnOf(symbol, key)` is the screener's local-currency return
(`ret1m`/`ret3m`/…). `src/ui/components/portfolio-value-trend.js` builds the inputs (~lines 15–30: it holds the
chart only when the surface is `'mixed-without-conversion'`, passes `row.value` and
`readRowNumber(rowOf(symbol), key)`) and writes a note under the chart (~line 70) that does not mention FX.
The attribution path that does include FX: `src/domain/portfolio/portfolio-read.js` (~line 167, text
"환율 포함, 현금은 수익률 0%로 계산") — find where it gets the FX-inclusive return
(`git grep -n "환율 포함\|fxReturn\|usdkrw" -- src/domain/portfolio | head -20`) and what FX history it reads.
Currency rules of this module (`src/domain/portfolio/surface.js`, `fx.js`): an unknown currency suffix is `null`,
currency is never assumed, mixed holdings are not summed without conversion.

**B.** `src/domain/portfolio/portfolio-read.js` ~line 167:
``tone: gap >= 0 ? 'favorable' : 'burden'`` and
`` `… — ${Math.abs(gap).toFixed(1)}%p ${gap >= 0 ? '앞섭니다' : '뒤처집니다'}.` ``; ~line 215 the headline:
`Math.abs(book3 - bench3).toFixed(1)` with `book3 >= bench3 ? '앞섰습니다' : '뒤처졌습니다'`.

**C.** `src/domain/screener/screener-read.js` ~lines 92–100: `tone: spread != null && spread > 0 ? 'favorable' : 'burden'`,
text `평균 ${spread.toFixed(2)}%p 앞섰습니다` / `${Math.abs(spread).toFixed(2)}%p ${spread < 0 ? '뒤처졌고' : …}`;
~line 127 the headline `spreadValue > 0 ? '과거 상위 20%가 하위보다 앞섬' : …`.

Helpers: `signedText`, `directionOf(value, digits)` in `src/domain/shared/number.js` (`directionOf` is `null` when
the value rounds to zero at those digits).

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
| Portfolio gates | each gate from `git grep -ln "benchmark-trend\|portfolio-read\|portfolio-value-trend" -- scripts/ci-*.mjs` | exit 0 |
| Screener read gates | each gate from `git grep -ln "screener-read" -- scripts/ci-*.mjs` | exit 0 |

## Scope

**In scope**
- `src/domain/portfolio/benchmark-trend.js`, `src/ui/components/portfolio-value-trend.js`
- `src/domain/portfolio/portfolio-read.js` (the two expressions), `src/domain/screener/screener-read.js` (the trust
  point and headline)
- the gate files that already test these modules, or `scripts/ci-esm-core-unit-check.mjs` (`v59.97` assertions)
- `_artifacts/pending-records/plan-031/` — one JSON per completed part

**Out of scope**
- `surface.js`, `fx.js`, the attribution math, the screener ranking, CSS, `js/**`.

## Steps

### Part A — the chart's return has one currency basis
1. Read how the attribution path computes an FX-inclusive holding return and which FX series and windows it has
   (write the function names and the data source in your report).
2. Preferred fix: `buildBenchmarkTrend` accepts an **optional** `fxReturnOf(symbol, key)` (a percentage; when the
   argument is absent every row's FX return is 0, so existing callers such as
   `scripts/ci-portfolio-native-chart-check.mjs` ~65–72 keep working), and `bookThen` divides by
   `(1 + r_local/100) * (1 + r_fx/100)`. Facts at the planned commit: the attribution takes a single scalar,
   `indexReturns(history, 'usdkrw').ret3m` (`src/ui/components/portfolio-read.js` ~152), and `indexReturns`
   (`benchmarks.js`) only has 1/3/6-month returns, while the chart needs 12m, 6m, 3m, 1m, 5d and 1d. So the
   component must compute the FX return per window itself, e.g. with
   `closeChange(history, 'usdkrw', sessions, { through: asOf })` from `market-windows.js` (check the unit: helpers
   such as `fxReturnInto` return a fraction, 0.05, not a percentage). The row's listing currency is on the surface
   row as `row.convertedFrom` (`surface.js` ~356); the component passes only `{ symbol, value }` today. When a row
   needs an FX return and none is available for a window (no USD/KRW close for that span), that row is not covered
   for that window (the existing coverage rule then decides whether the chart is shown).
3. Fallback, only if the per-window FX returns cannot be computed from the history the component already has
   (`usdkrw` closes missing for most windows) or the currencies involved go beyond USD/KRW: when any covered
   row's listing currency differs from the base currency, do not draw the chart; return
   `{ available: false, reason: 'fx-basis' }` and let the component print one plain sentence in the chart's place
   saying the comparison needs exchange-rate history for this account (Korean, no developer wording — follow the
   existing unavailable message in that component for tone).
4. Either way the note under the chart must state the basis it uses ("환율 포함" when FX is applied; nothing when
   every holding is in the base currency). `scripts/ci-esm-core-unit-check.mjs` (~3666–3667) pins two strings of
   that note in the component's source — "지금 비중을 그대로 들고 있었다고 본 값이라 계좌 수익률과 다릅니다" and
   "수정 종가(배당 포함)": keep both exactly and append the FX wording.

Tests (`v59.97`): a KRW-base book with one USD row (local 3-month return +10%, FX +5%) → the 3-month book return
is +15.5% within 0.05 (step 2) or the model is unavailable with reason `fx-basis` (step 3); a USD-base book of USD
rows → unchanged numbers compared with the current function (compute them before your change and pin the values
in the test).

**Verify**: unit gate and portfolio gates exit 0; the FX assertion fails on the old source.

### Part B — "앞섭니다/뒤처집니다" from the rounded gap
At both places: `const direction = directionOf(gap, 1)`. `null` → tone `'neutral'` and the text
`… — 지수와 비슷합니다.` (headline: `S&P 500과 비슷했습니다.` in the tense that sentence uses — read the surrounding
template). Otherwise as today.

Tests: gap −0.02 → no `뒤처` word and neutral tone; gap −0.06 → `0.1%p 뒤처집니다`; gap +0.04 → neutral.

### Part C — the screener trust word from the rounded spread
Round to the printed two decimals first (`directionOf(spread, 2)`): `null` → tone `'neutral'`, text says the top
and bottom groups differed by `0.00%p` (no 앞섰/뒤처 word), headline `과거 상위 20%와 하위의 차이 없음`. Otherwise
as today. The `distinguishable === false` branch just above (~line 94) prints "평균 0.00%p 앞섰지만" for a zero
spread too — apply the same rule there.

Tests: spread 0.003 → neutral, no `앞섰`; spread 0.006 → `0.01%p 앞섰습니다`.

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records (defects, `p`).
`node scripts/apply-pending-records.mjs --dry-run` → 0. Say nothing was checked in a browser.

## Test plan

Per part; each new assertion must fail on the old source (copy-aside method).

## Done criteria

- [ ] The KRW-base/USD-holding case is either FX-inclusive or unavailable with a stated reason — never +10.0%
- [ ] No `뒤처`/`앞섰` word beside a gap or spread that prints as zero
- [ ] Unit, portfolio and screener-read gates exit 0 with no edited expectation
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- A: the attribution's FX source cannot be reached from the component and the fallback would hide the chart for
  every KRW-base account **and** an existing gate requires the chart for a converted surface — report both facts.
- B/C: a wording or text-budget gate rejects the neutral sentence.
- Any part: an existing expectation flips.

## Maintenance notes

- Reviewer: check the 포트폴리오 screen in a browser with a KRW-base test book (a US stock and a Korean stock): the
  chart's 3-month figure and the attribution sentence must agree to one decimal.
- If the fallback (step 3) was taken, a follow-up can pass FX history into the chart.
