# Plan 034: The two AI response gates read normalised text and catch the instruction and number spellings found by audit

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The two parts are independent. Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- src/ai/response/request-pipeline.js src/ai/response/publication.js`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (wider patterns can remove legitimate analysis sentences; every addition needs negative cases)
- **Depends on**: none
- **Category**: bug (user-protection rules)
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

Two product rules are enforced on every AI answer by pattern gates: (1) the app never tells the reader to buy or
sell, at what price or size; (2) a current number that is not bound to evidence is not published. v59.95 closed
the comma/unit/range price spellings and unit-less observed prices. A second audit ran more spellings through the
real functions. These still pass unchanged:

- Action gate: `NVDA를 매수하는 것을 추천합니다.` · `NVDA를 매수하시길 권합니다.` · `NVDA를 매수할 것을 권합니다.` ·
  `NVDA 비중을 30%로 늘리세요.` · `NVDA 비중을 20%까지 확대하세요.` · `포트폴리오의 30%를 NVDA에 배분하세요.` ·
  `NVDA **매수**를 추천합니다.` · `**NVDA 매수**를 추천합니다.` · `NVDA를 지금 사두세요.` ·
  `보유 물량을 모두 처분하세요.` · `NVDA를 손절하는 게 맞습니다.` ·
  `손절가는 1,050달러입니다. 그 가격에서 정리하세요.` · a line break inside `NVDA를 매수\n하세요.` ·
  `손절은 천오십 달러에서 하세요.` · `Consider buying NVDA now.`
  (for comparison `NVDA를 지금 매수하세요.` and `NVDA 비중을 확대하세요.` are replaced).
- Numeric-evidence check: `VIX 지수는 15.2입니다.` · `**VIX** 15.2입니다.` · `**코스피**는 2,450입니다.` ·
  `실업률은 4.1 퍼센트입니다.` · `실업률은 4.1％입니다.` · `삼성전자는 72,000 KRW입니다.` ·
  `삼성전자 주가는 KRW 72,000입니다.` · `엔비디아는 USD 182.3에 거래됩니다.` ·
  `엔비디아 주가는 １８２.３달러입니다.` (full-width digits) · `Nvidia trades at 182.3 dollars.` ·
  `The 10-year yield is 4.15 percent.`

A pattern gate will always have another spelling it misses; the point of this plan is the cheap general step
(normalise the text first) plus the specific families above, each with negative cases.

## Current state

**A.** `src/ai/response/request-pipeline.js`, `_aioApplyAIActionGate(text, meta)` (starts ~line 558). The patterns:

```js
    var action = '(?:매수|매도|추가\\s*매수|분할\\s*매수|손절|익절|청산|(?:신규|매수)\\s*진입|포지션\\s*정리)';
    var recommend = new RegExp(action + '\\s*(?:을|를)?\\s*(?:추천|권고|권장|제안)(?!\\s*(?:하지|드리지|이\\s*아|은\\s*아))');
    var imperative = new RegExp(action + '\\s*(?:하세요|하십시오|하라|하시기\\s*바랍니다|해야\\s*(?:합니다|한다|해요))');
    var colloquial = /(?:사세요|파세요|담으세요|사야\s*(?:합니다|한다)|팔아야\s*(?:합니다|한다))/;
    var tickerAction = /(?:^|[\s:：(])[A-Z]{1,5}\s*(?:비중\s*)?\$?\d[\d,.]*\s*(?:달러|원|%)?\s*(?:매수|매도|확대|축소)\s*[.!)]?\s*$/;
    var weight = /비중\s*(?:을|를)?\s*(?:(?:늘리|줄이|확대하|축소하|높이|낮추)(?:세요|십시오|시기\s*바랍니다)|(?:늘려|줄여|확대해|축소해|높여|낮춰)(?:야\s*(?:합니다|한다)|라))/;
    var opportunity = …; var indirect = …; var negated = …; var english = …; var englishIndirect = …;
    var pricedImperative = …;   // widened in v59.95 for ranges and 천/만/억
    var patterns = [recommend, imperative, colloquial, weight, opportunity, tickerAction, english, pricedImperative];
```

Sentences are split with `raw.match(/(?:[^.!?。\n]|\.(?=\d))+(?:[.!?。]+|\n|$)\s*/g)` and each sentence into clauses
(commas outside numbers, 그러나/하지만/…/and/but/then). A match is ignored when `bound(clause, m)` finds a negation
tied to it or `quoted(clause, m)` finds an attribution ("…해야 한다고 봤습니다", "the rule is …"). The replaced
sentence becomes the notice `[개별 매매 지시는 제공하지 않습니다. 조건과 근거를 확인해 직접 판단하세요.]`.
Existing tests: `scripts/ci-ai-intelligence-contract-check.mjs` (search `directive gate`; the `v59.94` block lists
kept and replaced sentences — add to it in the same style), plus `scripts/fixtures/pipeline-semantics/ai.mjs`.
Sentences that must keep passing unchanged (education and analysis): an attributed rule
(`오닐은 7~8% 손실에서 손절해야 한다고 봤습니다.`), a negation (`매수를 추천하지 않습니다.`,
`1,050달러에서 손절하라는 뜻은 아닙니다.`), a level as a fact (`50일선은 1,050달러 부근입니다.`), a conditional
description (`1,050달러를 이탈하면 추세가 약해집니다.`), general choices described without an addressee
(`분할 매수는 평균 단가를 낮추지만 하락이 이어지면 손실이 커집니다.`), and weights as facts
(`NVDA 비중이 30%로 늘었습니다.`, `지수에서 NVDA 비중은 7%입니다.`).

**B.** `src/ai/response/publication.js`, `hasCurrentNumericContent(value)` (~line 47): one long alternation plus the
two rules added in v59.95 (`UNITLESS_MARKET_LEVEL`, `OBSERVATION_MARKER` + `OBSERVED_PLAIN_NUMBER`). Units listed:
`%|bp|bps|원|달러|USD|배|포인트|pt|지수`; metric words include `VIX|PER|PBR|PSR|PEG|ROE|RSI|주가|시세|환율|금리|시가총액|매출|영업이익`
followed by an optional particle and a digit; index names (코스피/KOSPI …) allow an optional `지수`.
`splitAnswerSentences` (~lines 62–76) splits on `.`/`?` unless glued to an ASCII token.
`stripUnverifiedCurrentNumericSentences` keeps a sentence when it has no current numeric content or is conditional.
Existing tests: the `v59.94` block in `scripts/ci-ai-intelligence-contract-check.mjs` (search `observed price`).
A regex-term ratchet (`scripts/ci-regex-term-ratchet-check.mjs`) counts unbounded keyword terms in this file: a new
Latin term needs word boundaries (`\b(?:KRW|USD)\b`), a new Korean term that is a substring of common words needs a
look-around.

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
| AI gates | `node scripts/ci-ai-intelligence-contract-check.mjs`; `node scripts/ci-ai-chat-reliability-contract-check.mjs`; `node scripts/ci-pipeline-semantics-check.mjs` | exit 0 |
| Ratchets | `node scripts/ci-regex-term-ratchet-check.mjs`; `node scripts/ci-text-pin-ratchet-check.mjs` | exit 0 |
| Boot bytes | `node scripts/ci-boot-bundle-budget-check.mjs` | exit 0 |
| Run a sentence through a gate | a temp `.mjs` outside the repo importing `installAIRequestPipeline` / `publication.js` the way the gate file does | prints kept / replaced |

## Scope

**In scope**
- `src/ai/response/request-pipeline.js` — only inside `_aioApplyAIActionGate`
- `src/ai/response/publication.js` — only `hasCurrentNumericContent` and constants it uses (and
  `splitAnswerSentences` only for the full-width digit case, if normalising before the split is the fix)
- `scripts/ci-ai-intelligence-contract-check.mjs` — new `v59.97` cases
- `_artifacts/pending-records/plan-034/` — one JSON per completed part

**Out of scope**
- The notice text, `bound`/`quoted` semantics (extend their inputs only if a new pattern needs it — say so),
  `js/aio-chat.js` (plan 033), the answer-plan contract, any UI.

## Steps

### Part A — action gate
1. Failing tests first: add the fifteen sentences as "must be replaced" and the kept list above as "must stay
   unchanged" (`v59.97`, same helper style as the `v59.94` block). Run the gate: record which of the fifteen fail.
   Any kept sentence that is already replaced today is removed from the test and reported (do not fix it here).
2. Normalise a copy of each sentence for **matching only** (the published text is untouched unless replaced):
   Unicode NFKC; remove markdown emphasis markers (`**`, `__`, `*`, backticks) so `**매수**를 추천` reads `매수를
   추천`; join a soft line break that falls inside a sentence (a newline not preceded by sentence punctuation
   becomes a space) before the sentence split.
3. Add the pattern families, each as its own named regex with a one-line comment and example:
   - nominalised recommendation: action stem + `(?:하는|할)\s*것을\s*(?:추천|권(?:합니다|해|고|장))` and
     `하시길\s*권` ; also `매수|매도|손절|익절|청산` + `하는\s*(?:게|것이)\s*(?:맞|좋|낫)`;
   - sized weight imperative: `비중\s*(?:을|를)?\s*\d[\d.]*\s*%\s*(?:로|까지|만큼)?\s*` followed by the existing
     weight verbs/imperatives; and allocation: `\d[\d.]*\s*%\s*(?:를|을)\s*[A-Za-z가-힣0-9]+에\s*(?:배분|투자|편입)하(?:세요|십시오)`;
   - colloquial imperatives: `사\s*두세요|사\s*놓으세요|처분하세요|정리하세요|던지세요|갈아타세요` — `정리하세요`
     and `처분하세요` are instructions only with a position object (`보유|물량|주식|포지션|종목|비중` in the same
     sentence) or directly after a price sentence (next item); without one they are ordinary words
     (`근거를 정리하세요` must stay);
   - two-sentence instruction: a sentence that states a price for a price noun
     (`손절가|목표가|매수가|매도가|진입가|익절가` + a number) followed by a sentence that is a bare imperative
     referring back (`그 가격|그 수준|해당 가격|거기`) with `하세요|하십시오|정리하세요|처분하세요|매수하세요|매도하세요`
     → both sentences are replaced by one notice;
   - a price written in Korean number words before the existing priced imperative: allow `[일이삼사오육칠팔구십백천만억]+`
     as the number in `pricedImperative`;
   - English soft imperative: `\b(?:consider|think about)\s+(?:buying|selling|shorting|adding to|trimming)\b`.
4. After each family: run the gate; all "must stay unchanged" sentences must still pass. Add at least one negative
   sentence per family that is close to it but is analysis (e.g. `분석가들은 NVDA를 매수하는 것을 추천했습니다.` is an
   attribution — decide by the existing `quoted` rule and state the outcome; `지수 편입 비중을 30%로 늘렸습니다.` is a
   fact).
5. Timing: run a 3,000-character answer made of repeated near-miss sentences through the gate; it must finish in
   under 50 ms (report the time). No nested unbounded quantifiers over the same characters.

**Verify**: the fifteen are replaced, the kept list is unchanged, AI gates and ratchets exit 0, boot budget exit 0.

### Part B — numeric-evidence check
1. Failing tests first: the eleven sentences as "detected"; as "not detected": `VIX 지수 산출 방식은 1993년에 바뀌었습니다.`,
   `**코스피** 구성 종목은 시가총액 순입니다.`, `퍼센트와 퍼센트포인트는 다릅니다.`,
   `KRW 표시 자산과 USD 표시 자산을 나눠 봅니다.`, `The 10-year note matures in 2036.` Run and record which fail.
2. Normalise first, for detection only: NFKC (full-width digits and `％` become ASCII), strip markdown emphasis and
   backticks. If the full-width case fails because `splitAnswerSentences` splits before detection, normalise before
   the split in `stripUnverifiedCurrentNumericSentences` and keep the returned text as the original sentences
   (map kept sentences back by index) — if that mapping is not straightforward, publish the normalised text for the
   kept sentences and say so.
3. Extend the patterns narrowly: optional `\s*지수` after `VIX`; units `퍼센트`, `\b(?:KRW|USD)\b` after a number,
   `\bdollars?\b`, `\bpercent\b`; a currency-code prefix `\b(?:USD|KRW|US\$)\s*\d`. Keep the period look-ahead the
   metric rules use. Mind the regex-term ratchet (boundaries on every Latin term).

**Verify**: the eleven are detected and stripped; the five are not; AI gates and both ratchets exit 0.

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records (defects, `p`,
`violated_rule`: the no-trade-instruction rule for A, the no-unverified-current-number rule for B).
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Steps A1 and B1 (31 sentences plus negatives). Each "must be replaced/detected" assertion must fail on the old
source (copy-aside method, not the shared stash).

## Done criteria

- [ ] 15 instruction sentences replaced; the kept list unchanged; 11 number sentences detected; 5 not detected
- [ ] No existing gate expectation edited; ratchets and boot budget pass
- [ ] The report gives the gate's timing on the 3,000-character input
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- An existing kept sentence in any gate becomes replaced, or an existing replaced sentence becomes kept, and you
  cannot satisfy both the old case and the new ones — report the pair.
- A family cannot be added without also replacing one of this plan's own "must stay unchanged" sentences — skip
  that family and report it.
- The boot bundle budget is exceeded (these files are in the boot set): report the byte delta.

## Maintenance notes

- These gates are a backstop behind the system-prompt policy (plan 033 keeps that policy in long sessions). Each
  miss found later gets a sentence in the test list first.
- Reviewer: read every new regex for backtracking and for Korean substrings that occur in ordinary analysis.
