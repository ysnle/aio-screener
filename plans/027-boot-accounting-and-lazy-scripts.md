# Plan 027: Boot budgets count what boots; the service worker stops precaching scripts that load on demand

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The three parts are independent: if one hits a STOP condition, finish the others and report the stopped part.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- scripts/lib/pages-bundle-config.mjs architecture/boot-budget.json sw.js scripts/ci-boot-bundle-budget-check.mjs scripts/ci-boot-interaction-check.mjs js/aio-core.js src/app/chat-loader.js src/app/classic-loader.js`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (`sw.js` is the cache boundary of the deployed site; budgets gate every release)
- **Depends on**: none
- **Category**: perf / honesty of a gate
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

Three places still treat scripts as boot-time work although they left boot:
- **A.** The classic boot byte budget (`architecture/boot-budget.json` `classicBootBudget`) is measured over
  `CLASSIC_BOOT_SCRIPTS`, which still includes `js/aio-glossary.js` (~107 KB minified). `index.html` has not loaded
  the glossary at boot since v59.70 (`src/app/classic-loader.js` loads it when the page is idle or on first use).
  The budget's own target is 1,000,000 raw bytes; the reported 1,113,934 overstates real classic boot by the
  glossary's size, so the number the owner steers by is wrong.
- **B.** `sw.js` precaches `./js/aio-chat.js` (339 KB source) and `./js/aio-glossary.js` (114 KB) in
  `CRITICAL_SHELL_ASSETS` on every install, although its own comment says the list is "the files EVERY route needs
  to boot" and both now load on demand. Every new deploy makes each device download both before the new service
  worker activates, whether or not the AI panel or the glossary is ever opened. The runtime shell cache already
  caches any `/js/` or `/src/` file on first request.
- **C.** `js/aio-core.js` fetches `public-data/user-research-digest.json` (~90 KB) 1.8 s after every boot with
  `cache: 'no-store'`. Its content (`AIO_USER_RESEARCH_PAGE_MODULES`) appears to be read only by the AI panel path.

## Current state

**A.** `scripts/lib/pages-bundle-config.mjs`:

```js
export const GLOBAL_SCRIPTS = ['aio-workspace', 'aio-kr-data', 'aio-pages', 'aio-core', 'aio-data', 'aio-ui', 'aio-chat', 'aio-glossary'].map((name) => `js/${name}.js`);
// v59.70 (2nd batch A, P0): the classic scripts index.html runs at boot. js/aio-chat.js loads with the AI panel
// (src/app/chat-loader.js), so it ships but is not part of the boot budget.
export const CLASSIC_BOOT_SCRIPTS = GLOBAL_SCRIPTS.filter((file) => file !== 'js/aio-chat.js');
```

`index.html` loads six classic scripts with `defer` (`aio-workspace`, `aio-kr-data`, `aio-pages`, `aio-core`,
`aio-data`, `aio-ui`) — check with `grep -n 'defer></script>' index.html`.
`scripts/ci-boot-bundle-budget-check.mjs` sums the minified `CLASSIC_BOOT_SCRIPTS` against `classicBootBudget`
(now `rawBytes: 1114000`, `gzipBytes: 368200`, measured 1,113,934 / 368,113).
`scripts/ci-boot-interaction-check.mjs` (a browser gate) classifies every same-origin script fetched in a 6.5 s
window after load: ESM boot set, `classicSet = new Set(CLASSIC_BOOT_SCRIPTS)`, AI panel files, and everything else
= `postBootLazy`, which must stay under `postBootLazyBudget.rawBytes` (265,000). `classic-loader.js` says the
glossary loads "once the page is idle after boot, on the first glossary open, or right away for automated browsers"
— so in that gate the glossary is fetched inside the window and, once it leaves `classicSet`, it lands in
`postBootLazy`.

**B.** `sw.js`:

```js
// P1134/R621: critical precache = the files EVERY route needs to boot (3 shell documents + the
// 5 classic runtime scripts + bootstrap). …
const CRITICAL_SHELL_ASSETS = [
  './', './index.html', './version.json', './public-config.json',
  './js/aio-core.js', './js/aio-data.js', './js/aio-ui.js', './js/aio-chat.js', './js/aio-glossary.js',
  './src/app/bootstrap.js'
];
const RUNTIME_SHELL_PATH_RE = /\/(?:js|src)\//;
```

`scripts/ci-service-worker-cache-policy-check.mjs` parses that array (line ~14) and asserts things about it (read
the whole gate before editing — it may assert a count bound of 12 and specific members). Other gates that read
`sw.js`: `git grep -ln "sw.js" -- scripts/ci-*.mjs`. Note the list does not contain `aio-workspace`, `aio-kr-data`
or `aio-pages` although index.html loads them at boot — do not add them in this plan; report it.

**C.** `js/aio-core.js`: `window.AIO.loadUserResearchDigest` (search for it) fetches
`c.digestPath + '?v=' + version` with `{ cache: 'no-store' }`, then `applyUserResearchDigestPayload` sets
`window.AIO_USER_RESEARCH_PAGE_MODULES`; a `setTimeout(..., 1800)` calls it at boot; `requireAioFn('loadUserResearchDigest', …)`
appears in a self-check list. Readers of `AIO_USER_RESEARCH_PAGE_MODULES`: `js/aio-chat.js` (~line 21) and three
functions in `js/aio-core.js` (find them all with `git grep -n "AIO_USER_RESEARCH_PAGE_MODULES" -- js src`). The AI
panel's loader is `src/app/chat-loader.js`.

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
| Classic/ESM boot bytes | `node scripts/ci-boot-bundle-budget-check.mjs` | exit 0; prints measured bytes |
| Post-boot lazy bytes (browser gate; allowed for this plan) | `node scripts/ci-boot-interaction-check.mjs` | exit 0; prints `jsByKind` |
| Service worker policy | `node scripts/ci-service-worker-cache-policy-check.mjs` | exit 0 |
| Gates reading sw.js | `git grep -ln "sw.js" -- scripts/ci-*.mjs` then run the offline ones | exit 0 |

## Scope

**In scope**
- `scripts/lib/pages-bundle-config.mjs` (`CLASSIC_BOOT_SCRIPTS` and its comment), `architecture/boot-budget.json`
  (`classicBootBudget` and `postBootLazyBudget` numbers and notes)
- `sw.js` — only the `CRITICAL_SHELL_ASSETS` array and the comment above it
- `scripts/ci-service-worker-cache-policy-check.mjs` — only assertions that name the two removed entries or the
  "5 classic runtime scripts" wording
- `js/aio-core.js` — only the boot `setTimeout` for the digest; `src/app/chat-loader.js` — only a call that loads
  the digest (Part C); `scripts/fixtures/pipeline-semantics/ai.mjs` — a `v59.97` case (it is the only unit test of
  `chat-loader.js`, see its v59.52 case ~line 70)
- `_artifacts/pending-records/plan-027/` — one JSON per completed part

**Out of scope**
- `scripts/ci-boot-interaction-check.mjs` and `scripts/ci-boot-bundle-budget-check.mjs` logic; `index.html`;
  `src/app/classic-loader.js`; the ESM `bootModuleBudget`/`bootModuleCeiling`; `SW_VERSION` and cache names.

## Steps

### Part A — the classic boot set is what index.html runs
1. Record the current measurements: run both budget gates and note classic raw/gzip and `postBootLazy`.
2. Change `CLASSIC_BOOT_SCRIPTS` to exclude `js/aio-glossary.js` as well, and update the comment (the glossary
   loads after boot through `src/app/classic-loader.js`).
3. Run `ci-boot-bundle-budget-check`: note the new classic total (expected about 1,007,190 raw / 329,135 gzip —
   the glossary is 106,744 / 38,978). Set
   `classicBootBudget.rawBytes`/`gzipBytes` to the new measured values rounded up to the next 1,000 / 100, and
   prepend a dated sentence to its `note` in the style of the existing notes (what changed and why; today is
   2026-11-11, release v59.97).
4. Run `ci-boot-interaction-check`: the glossary now counts as post-boot lazy. If `postBootLazy` exceeds 265,000,
   raise `postBootLazyBudget.rawBytes` to the new measured value rounded up to the next 1,000 and prepend a dated
   sentence to its `note` saying the glossary's bytes moved here from the classic budget (same bytes, counted in the
   right bucket) — the sum of the two budgets must not go up by more than rounding.

**Verify**: both gates exit 0; in your report give before/after for classic, lazy and their sum.

### Part B — precache only what boot needs
1. Read `scripts/ci-service-worker-cache-policy-check.mjs` fully and list every assertion about
   `CRITICAL_SHELL_ASSETS`.
2. Remove `'./js/aio-chat.js'` and `'./js/aio-glossary.js'` from the array. Update the comment above it: the three
   shell documents, the three classic runtime scripts listed, and bootstrap; on-demand scripts are cached by the
   runtime shell cache on first use.
3. At the planned commit the gate has no assertion naming the two scripts: it requires 1–12 entries (10 today, 8
   after), the members `./`, `./index.html`, `./version.json`, `./src/app/bootstrap.js`, and
   `cache.addAll(CRITICAL_SHELL_ASSETS)`. So the gate should pass unchanged; edit it only if it fails, and then only
   the assertion that failed (label it `v59.97`).
4. Confirm the runtime path covers both files: `RUNTIME_SHELL_PATH_RE` matches `/js/aio-chat.js` and
   `/js/aio-glossary.js`, and the fetch handler stores a successful response for a runtime-shell request (read the
   handler; quote the lines in your report).

**Verify**: `node --check sw.js`; the service-worker gate and every offline gate that reads `sw.js` exit 0.

### Part C — the research digest loads with the AI panel
1. List every reader of `AIO_USER_RESEARCH_PAGE_MODULES` and of `_aioUserResearchDigestMeta`, and for each say when
   it runs: at boot, on a route render, or only inside the AI question path. Put the table in your report.
2. **Only if every reader runs inside the AI panel/question path** (or tolerates the digest being absent by design —
   quote the guard): remove the boot `setTimeout` in `js/aio-core.js` and load the digest with the panel. The readers
   use the digest at question time, so the first question must wait for it: `src/app/chat-loader.js` `load()` builds
   `const cuesReady = Promise.all([loadCues(), loadChatGlobals(), Promise.resolve().then(alongside)…])` and the
   question replay waits for it — add
   `Promise.resolve().then(() => root.AIO.loadUserResearchDigest?.()).catch(() => {})` to that array. The optional
   call is required: the existing fixture builds `root = { navigator: {}, AIO: {} }`. Keep `cache: 'no-store'` as is.
3. If any reader runs on a route render outside the AI path, STOP Part C and report the reader.

**Verify**: `node --check js/aio-core.js`; `node scripts/ci-runtime-contract-check.mjs` exit 0;
`node scripts/ci-boot-interaction-check.mjs` exit 0 and its request list no longer contains
`user-research-digest.json` before the AI panel is used (if the gate reports data requests; otherwise say it does not).

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records: A and B and C are
change-only. `node scripts/apply-pending-records.mjs --dry-run` → 0. Say what was and was not checked in a browser.

## Test plan

The budget gates and the service-worker gate are the tests; Part C adds no new assertion unless the chat-loader has
a unit test (`git grep -n "chat-loader" -- scripts`) — then add a `v59.97` case that the loader triggers the digest
load once.

## Done criteria

- [ ] `CLASSIC_BOOT_SCRIPTS` has six entries, matching the six `defer` scripts in `index.html`
- [ ] Both budget gates exit 0 with budgets set to measured values; the report shows the before/after table
- [ ] `sw.js` critical list has no on-demand script; its gate exits 0
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- A: a gate other than the two budget gates derives something else from `CLASSIC_BOOT_SCRIPTS` and fails
  (`git grep -n "CLASSIC_BOOT_SCRIPTS" -- scripts` — read each use first).
- B: the gate (or a live-invariant gate) requires `aio-chat.js`/`aio-glossary.js` to be precached for a reason it
  states (offline AI panel, first-open latency) — report the stated reason instead of removing.
- C: see step 3.

## Maintenance notes

- Reviewer: after deploy, a device with the old service worker updates on its next visit; confirm in a browser that
  opening the AI panel and the glossary still works online, and that the glossary opens offline after it has been
  opened once (runtime cache).
- `targetRawBytes: 1000000` for classic boot becomes meaningful again once the glossary is out of the count.
