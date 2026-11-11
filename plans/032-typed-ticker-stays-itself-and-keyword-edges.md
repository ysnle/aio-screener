# Plan 032: A typed ticker is never rewritten to another company; '위기' no longer matches inside '분위기'

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The two parts are independent. Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- src/domain/instruments/resolve-name.js src/domain/news/keyword-match.js src/domain/news/scoring.js`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW–MED (Part A changes what the 종목 search opens for short all-capital inputs)
- **Depends on**: none
- **Category**: bug (product rule: no ticker guessing)
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

- **A.** Product rule (fixed): "names resolve only by exact registry match; a ticker-shaped input is never rewritten
  to another issuer." `resolveRegisteredName` already refuses registry *aliases* for ticker-shaped input, but it
  still matches the registry's English/Korean **display names**. Executed: typing `FORD` — the real ticker of
  Forward Industries, which is not in this app's universe — opens Ford Motor (`F`); `BLOCK` opens `SQ`. One issuer's
  symbol is silently rewritten to another's.
- **B.** The news tone score counts a headline as a warning when it contains the bear keyword `위기` (crisis).
  Korean keywords match as plain substrings, so `분위기` (mood) matches: "연말 랠리 분위기, 코스피 강세" is
  classified `warn` and pulls the day's news tone toward bearish.

## Current state

**A.** `src/domain/instruments/resolve-name.js`:

```js
export function resolveRegisteredName(raw, entries = {}) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (entries[text.toUpperCase()]) return text.toUpperCase();
  const tickerShaped = /^[a-z0-9.^=-]{1,5}$/i.test(text);
  const lower = text.toLowerCase();
  return Object.keys(entries).find((symbol) => [entries[symbol].en, entries[symbol].kr, ...(tickerShaped ? [] : entries[symbol].alt || [])]
    .some((name) => name && String(name).toLowerCase() === lower)) || null;
}
```

Callers: `src/app/compatibility-globals.js` (~lines 240–246, the 종목 route: `resolveRegisteredName(raw, entries) || normalized`),
`src/ai/entity/resolver.js` (~line 123), and `resolveHoldingInput` in the same file (it already skips name
resolution for ticker-shaped input: `const named = tickerShaped ? null : resolveRegisteredName(text, entries)`).
The same file has `searchCandidates(raw, …)` — when nothing resolves, the 종목 search shows a list of candidates for
the reader to pick (names or symbols containing the query), never opened automatically.
Registry shape (`js/aio-core.js`, e.g. `'F': { en: 'Ford', kr: '포드', alt: ['ford'] }`).
Tests: `git grep -n "resolveRegisteredName" -- scripts` (existing cases cover GOOG / HR / SQ not being rewritten).

**B.** `src/domain/news/scoring.js` ~line 24: `BEAR_KEYWORDS` includes `'위기'`; ~line 149
`computeNewsSentimentScore` counts a `warn` stance as bear. `src/domain/news/keyword-match.js` builds a matcher per
keyword (`PATTERNS` cache): Latin keywords get word-edge regexes; a single-character keyword gets a
Unicode-letter boundary regex; any other (multi-character Korean) keyword is `{ needle: raw }` — a plain substring.
Tests: `git grep -n "keywordHit\|classifyNewsTextStance" -- scripts`.

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
| Resolver / entity gates | each gate from `git grep -ln "resolveRegisteredName\|resolve-name\|entity/resolver" -- scripts/ci-*.mjs` | exit 0 |
| News gates | each gate from `git grep -ln "keyword-match\|news/scoring\|news/selection" -- scripts/ci-*.mjs` | exit 0 |

## Scope

**In scope**
- `src/domain/instruments/resolve-name.js` — `resolveRegisteredName` only
- `src/domain/news/keyword-match.js` (an exclusion mechanism), `src/domain/news/scoring.js` only if the exclusion
  is declared beside the keyword list
- the gate files that already test these functions (`v59.97` assertions)
- `_artifacts/pending-records/plan-032/` — one JSON per completed part

**Out of scope**
- The registry data in `js/aio-core.js`, `searchCandidates`, the callers, the keyword lists' contents other than the
  exclusion, the selection keywords in `selection-keywords.js`.

## Steps

### Part A — a typed ticker stays what was typed
1. Failing tests first (`v59.97`), next to the existing GOOG/HR/SQ cases, with
   `entries = { F: { en: 'Ford', kr: '포드', alt: ['ford'] }, SQ: { en: 'Block', kr: '블록' }, AAPL: { en: 'Apple', kr: '애플' } }`:
   - `resolveRegisteredName('FORD', entries)` → `null`; `('BLOCK', entries)` → `null` (all-capital, ticker-shaped,
     and not the registry's own spelling of a name);
   - with `entries.TSM = { en: 'TSMC', kr: '대만반도체' }` and `entries['035420.KS'] = { en: 'NAVER', kr: '네이버' }`:
     `('TSMC', entries)` → `'TSM'`; `('NAVER', entries)` → `'035420.KS'` (an all-capital registry name still resolves);
   - `('F', entries)` → `'F'`; `('aapl', entries)` → `'AAPL'` (an exact symbol in any case still resolves);
   - `('Ford', entries)` → `'F'`; `('apple', entries)` → `'AAPL'`; `('포드', entries)` → `'F'` (a name typed as a
     name still resolves);
   - `('ford', entries)` → `'F'` (lower-case input is a name here; the alias rule for ticker-shaped input is
     unchanged: it resolves through `en`, not through `alt`).
2. Change the rule: when the input is ticker-shaped **and** entirely upper-case (`text === text.toUpperCase()`
   and it contains at least one letter), a display name (`en`/`kr`) matches only if it equals the typed text
   **exactly, case included**. About forty registry names are themselves all-capital (TSMC→TSM, NAVER, HYBE, LVMH,
   IDEXX, ONEOK, KLA, MKS, HMM, 3M, SK, LG, KAI …) and must keep resolving: `TSMC` equals the name "TSMC" → `TSM`;
   `FORD` does not equal "Ford" → `null`. Mixed- or lower-case input keeps today's case-insensitive name match.
   Update the comment above the function to state the rule.
3. Check the two callers' behaviour for `FORD`: the 종목 route falls back to the typed symbol (an unknown symbol —
   read what the route shows for an unknown symbol; it should be the existing "not in the universe" state plus
   candidates, not an error) and the AI entity resolver treats it as an unresolved typed symbol. Report what each
   does. Do not change the callers.

**Verify**: the resolver gates exit 0; the two `null` assertions fail on the old source.

### Part B — a Korean keyword can name what it must not sit inside
1. Failing tests first (`v59.97`): `keywordHit('투자 분위기 살아나', '위기')` → `false`;
   `keywordHit('금융 위기 우려', '위기')` → `true`; `keywordHit('위기감 확산', '위기')` → `true`;
   `classifyNewsTextStance('연말 랠리 분위기, 코스피 강세')` is not `'warn'` (use the real exported names — check
   the module's exports first).
Notes before editing: `keywordHit` is shared with article selection, topics, Telegram and AI cues, but `'위기'`
   is a keyword only in `scoring.js` (~24), so an exclusion keyed on it changes stance scoring only (selection calls
   `classifyNewsTextStance`, so a few stances can change — intended). Put the new test cases in
   `scripts/ci-esm-core-unit-check.mjs` next to the existing `keywordHit` cases (~5081), **not** in
   `scripts/fixtures/expect/news-selection.cases.mjs` (that would force an `*.expect.md` regeneration). Do not bump
   `NEWS_SCORING_MODEL_VERSION`: the rule fixes a false match, it does not change the model.
2. In `keyword-match.js`, add a small exclusion table for substring keywords — a map from keyword to the longer
   words it must not match inside, starting with `{ '위기': ['분위기'] }` — and apply it in the substring branch:
   a hit counts only if it is not part of an excluded word at that position. Keep the `PATTERNS` cache working
   (compile once per keyword). Put the table next to the matcher with a one-line comment giving the example.
3. Scan for the same trap in the existing lists, read-only, and report (do not add more exclusions without
   evidence): for each multi-character Korean keyword in `BEAR_KEYWORDS`/`BULL_KEYWORDS` and the stance lists, list
   common Korean words that contain it with an unrelated meaning if you can name one with confidence (examples to
   check: `하락` in `하락세` is fine; `부진` inside `부진정`; `우려` inside `우려먹`; `급등` / `급락` are fine).

**Verify**: the news gates exit 0; the first assertion fails on the old source.

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records (defects, `p`).
`node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Per part above.

## Done criteria

- [ ] `FORD` and `BLOCK` resolve to `null`; `Ford`, `apple`, `포드`, `F`, `aapl` resolve as listed
- [ ] `분위기` no longer triggers the `위기` keyword; `위기` alone still does
- [ ] Resolver, entity and news gates exit 0 with no edited expectation
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- A: an existing test requires an all-capital spelling of a mixed-case name (e.g. `APPLE` for "Apple") to resolve
  to its ticker — report the case (it is the behaviour this plan removes; the reviewer decides). Before finishing,
  list every registry entry whose `en` or `kr` name is all-capital and ticker-shaped (extract from
  `AIO_TICKER_NAME_REGISTRY` in `js/aio-core.js` with a temp script) and confirm each still resolves.
- A: the 종목 route shows an error (not the unknown-symbol state) for an unresolved typed symbol.
- B: the matcher is shared with selection keywords in a way that the exclusion changes article selection — report
  how many of the fixture headlines change selection.

## Maintenance notes

- A reader who types `FORD` now sees the unknown-symbol state with Ford Motor among the candidates to pick; typing
  `Ford`, `ford`, `포드` or `F` opens Ford Motor directly.
- Each new substring trap found later gets one line in the exclusion table and one test sentence.
