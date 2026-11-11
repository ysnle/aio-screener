# Plan 018: The AI numeric-evidence check recognises observed prices written without a unit

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- src/ai/response/publication.js`
> If it changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: MED (a wider detector removes more sentences from answers that have no bound evidence; false positives
  make answers thinner)
- **Depends on**: none
- **Category**: bug (data-honesty rule)
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

Product rule: the AI must not state a current market number that is not bound to evidence (no invented numbers).
When an answer is "current-sensitive" and has no bound evidence, sentences with current numbers are removed and a
"최신 수치 확인 안 됨" notice is added. The detector only sees a number that has a unit (%/bp/원/달러/배/포인트/지수),
follows a listed metric word, or follows 현재/최신/지금/오늘. Executed against the current code, these pass through
unchanged: `엔비디아는 어제 182.3에 마감했다.`, `10년물은 4.15에 마감했다.`, `원/달러는 1,385.2에 마감했다.`,
`달러인덱스(DXY)는 104.2입니다.`, `WTI는 배럴당 71.4입니다.` — while `S&P 500은 6,850선에서 마감했다` and a `310bp`
sentence are removed. Prices, yields and FX levels are exactly the numbers a model is most likely to recall wrongly.

## Current state

`src/ai/response/publication.js`:

- `export function hasCurrentNumericContent(value)` (~line 47) — one long regex alternation: currency-symbol
  numbers; numbers followed by `%|bp|bps|원|달러|USD|배|포인트|pt|지수`; a metric word
  (`VIX|PER|PBR|PSR|PEG|ROE|RSI|주가|시세|환율|금리|시가총액|매출|영업이익`) + optional particle + number, with a negative
  look-ahead that excludes periods (`개월|개년|년|분기|주|일|거래일|세션`); index names (코스피/KOSPI, …) + number; counts
  and Korean magnitudes; and numbers after 현재/최신/지금/오늘. The comment block above it records each earlier
  widening (P1525, briefing audit 2026-10-17, v58.77).
- `var OBSERVATION_MARKER = /(?:현재|지금|오늘|금일|현시점|방금|최근|어제|전일|전날|지난\s*(?:주|달|분기|해)|이번\s*(?:주|달|분기)|마감|종가|기록(?:했|한|하)|나타냈|보였|올랐|내렸|떨어졌|하락했|상승했|급등|급락|발표된|발표했|as of|…)/` (~line 80) — used only by
  `isConditionalNumericSentence` (a conditional/threshold sentence is exempt unless it also carries an observation marker).
- `stripUnverifiedCurrentNumericSentences` (~line 86–103) keeps a sentence when
  `!hasCurrentNumericContent(bare) || isConditionalNumericSentence(bare)` (URLs are blanked first).
- `src/ai/response/request-pipeline.js` (~line 398) uses the same detector for the `current-numeric-claim-unverified`
  limitation.

Sentences that must stay untouched (not current market figures): `PER이 낮을수록 …` (no number),
`3개월 동안 2번 올랐다.`, `2026년 11월 10일 기준 자료입니다.`, `1970년대에는 물가가 두 자릿수였다.`,
`조건 5개 중 3개가 충족됐습니다.` — wait: counts ARE covered today (P1525) and are removed; do not use that one.
Use instead: `1분기와 2분기 모두 발표가 있었습니다.`, `10년 평균을 웃돌았다.`, `S&P 500 구성 종목 500개 중 일부입니다`
is also a count — skip. Keep the "must stay" list to period/date/ordinal sentences without a market level.

Tests: `git grep -n "stripUnverifiedCurrentNumericSentences\|hasCurrentNumericContent" -- scripts` (candidates:
`scripts/ci-ai-chat-reliability-contract-check.mjs`, `scripts/ci-ai-intelligence-contract-check.mjs`,
`scripts/fixtures/pipeline-semantics/ai.mjs`).

## Commands you will need

## Repository rules (apply to every plan)

You are working in a git worktree of **AIO Screener** — a static GitHub Pages investment-research app: `index.html`
shell + legacy classic scripts `js/aio-*.js` + native ESM under `src/`, with Node ESM gate/producer scripts under
`scripts/` and registries under `architecture/`. UI text is Korean. Platform is Windows with Git Bash; Node is on PATH.

**Setup (first commands in the worktree):**
1. `git log --oneline -1` and `git merge-base --is-ancestor f739db3d5 HEAD && echo based-on-reviewed-main`. Your
   worktree may have been cut from `origin/main`, which lacks the reviewed local commits. If the second command does
   not print `based-on-reviewed-main`, move your (still unchanged) branch onto the reviewed base with `git reset --keep f739db3d5` — do NOT merge:
   origin/main carries newer data commits whose generated files conflict. Then `git log --oneline -1` must show `f739db3d5`;
   if the reset is refused, STOP. The plan's "Planned at `813371fc5`" commit is contained in `f739db3d5`; use `f739db3d5`
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
| Call the detector directly | a temp `.mjs` outside the repo: `import { hasCurrentNumericContent, stripUnverifiedCurrentNumericSentences } from '<abs path>/src/ai/response/publication.js'` | prints true/false per sentence |
| AI gates | `node scripts/ci-ai-chat-reliability-contract-check.mjs`; `node scripts/ci-ai-intelligence-contract-check.mjs`; the pipeline-semantics gate | exit 0 |
| Boot bytes | `node scripts/ci-boot-bundle-budget-check.mjs` | exit 0 |

## Scope

**In scope**
- `src/ai/response/publication.js` — only `hasCurrentNumericContent` (and reuse of `OBSERVATION_MARKER`)
- the existing gate file that tests the detector (add cases)
- `_artifacts/pending-records/plan-018/unitless-observed-prices.json` (create)

**Out of scope**
- `isConditionalNumericSentence`, `stripUnverifiedCurrentNumericSentences`'s structure, the notice text,
  `request-pipeline.js`, the action gate (another plan).

## Steps

### Step 1: Failing tests
Add `v59.94` assertions next to the existing detector cases:
- **detected** (`hasCurrentNumericContent` true; stripped to empty by `stripUnverifiedCurrentNumericSentences`): the
  five sentences in "Why this matters".
- **not detected**: `3개월 동안 두 차례 올랐다.`, `2026년 11월 10일 기준 자료입니다.`, `1970년대에는 물가가 두 자릿수였다.`,
  `1분기와 2분기 모두 발표가 있었습니다.`, `10년 평균을 웃돌았다.`, `어제 발표된 자료는 3쪽 분량입니다.`
- a **conditional** stays exempt: `10년물이 4.5를 넘으면 부담이 커집니다.` → not stripped.
Before writing them, run each "not detected" sentence through the current detector with the temp script; drop any
that is already detected today (do not fix that here) and say which.

**Verify**: the five "detected" assertions fail on the current source; the rest pass.

### Step 2: Two narrow additions
Add to `hasCurrentNumericContent`, without loosening anything that exists:
1. **Market-level nouns**: extend the metric-word alternative with instruments whose level is quoted without a unit:
   `10년물|2년물|30년물|국채\s*금리|원\/달러|달러\/원|달러인덱스|DXY|WTI|브렌트|유가|금\s*가격|금값|비트코인` (same optional
   particle, same period look-ahead), allowing an optional parenthesised alias and `배럴당|온스당` between the word and
   the number.
2. **Observed decimal or comma number**: a sentence that contains an `OBSERVATION_MARKER` word AND a bare decimal
   (`\d+\.\d+`) or a comma-grouped number (`\d{1,3}(?:,\d{3})+(?:\.\d+)?`) that is not followed by a period/date
   unit (`년|월|일|개월|분기|주|쪽|번|차례|회|명|개|곳|건`). `OBSERVATION_MARKER` is declared with `var` further down the
   file; if hoisting makes it `undefined` when the function is first called at module load, move the regex above the
   function (same text) rather than duplicating it.
Keep the result one readable expression per addition (two small regexes combined with `||`), each with a comment
that says what it covers and gives one example sentence.

**Verify**: all Step 1 assertions pass; `node --check src/ai/response/publication.js`.

### Step 3: Regression sweep
Run the AI gates and the pipeline-semantics gate. For any existing case that flips, read it: if a sentence that
used to be published is now removed and it does state an unverified current level, the new behaviour is correct —
but do not edit an existing expectation; STOP and report it with the sentence. Then
`node scripts/ci-boot-bundle-budget-check.mjs` and `node scripts/qa-runner.mjs contracts --keep-going`.

### Step 4: Pending record
Defect entry (`p`), `violated_rule`: no unverified current number in an AI answer.
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Step 1 (12 sentences). The five must fail with `publication.js` stashed back.

## Done criteria

- [ ] The five observed-price sentences are detected and stripped; the period/date sentences and the conditional are not
- [ ] No existing AI gate expectation was edited
- [ ] AI gates, pipeline-semantics gate and boot budget gate exit 0
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- An existing gate case flips (see Step 3).
- The second addition cannot tell "182.3에 마감" from an ordinary dated sentence in the gate's existing clean cases
  without a third rule — report what collides instead of adding more rules.
- Boot bundle budget exceeded.

## Maintenance notes

- Each widening here trades thinner answers for fewer unverified numbers; the owner's rule puts honesty first.
- Reviewer: after integration, ask the AI panel a current-price question with evidence available and confirm the
  evidence-bound sentence is still shown (the strip only applies when no evidence is bound).
