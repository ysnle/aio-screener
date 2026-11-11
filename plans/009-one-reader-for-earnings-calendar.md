# Plan 009: One cached reader for earnings-calendar.json

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- src/data/earnings-calendar-snapshot.js src/data/providers/earnings.js src/data/shared-artifacts.js src/data/artifact-registry.js`
> If any changed, compare "Current state" with the live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (three screens read the snapshot shape; a wrong state mapping shows "no schedule" where there is one)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

`public-data/earnings-calendar.json` is 409 KB. Three independent readers download it with three cache policies, so
one session can fetch it three times, and one of them uses a `?v=<Date.now()>` URL that defeats HTTP and
service-worker revalidation entirely. The project already has one registered descriptor for this artifact with a
6-hour max age and a size bound. After this plan the other two readers reuse that one cached copy. Screens show the
same content; phones on mobile data stop paying for the file up to three times.

## Current state

1. **Shared descriptor** — `src/data/artifact-registry.js:45`:
   `export const EARNINGS_CALENDAR = shared('earnings-calendar.json', '_aioEarningsCalendarArtifact', 6 * HOUR, 512 * KB);`
   Read through `refreshSharedArtifact(root, EARNINGS_CALENDAR)` from `src/data/shared-artifacts.js:29`
   (`export function refreshSharedArtifact(root, { key, url, schemas, maxAgeMs, maxBytes, now } = {})`), which stores
   the parsed artifact at `root[EARNINGS_CALENDAR.key]`. Existing callers to copy from:
   `src/ui/components/portfolio-checklist.js:109,126,161`
   (`refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed }) => { if (changed) again(); })`),
   `src/ui/components/stock-chart-coach.js:128`, `src/ui/components/fiscal-read.js:461`,
   `src/ui/components/market-story.js:120`. The same file exports `sharedArtifactState(root, key)` and
   `sharedArtifactIsStale(root, key, …)`.
2. **Snapshot reader** — `src/data/earnings-calendar-snapshot.js` (whole file is one function):

```js
export async function fetchEarningsCalendarSnapshot({ root = globalThis } = {}) {
  try {
    const res = typeof root.fetchWithTimeout === 'function'
      ? await root.fetchWithTimeout(`public-data/earnings-calendar.json?v=${Date.now()}`, { cache: 'no-cache' }, 6000)
      : null;
    if (!res || !res.ok) return null;
    const d = await res.json();
    if (!d || !Array.isArray(d.earnings)) return null;
    return {
      earnings: d.earnings,
      ipos: Array.isArray(d.ipos) ? d.ipos : [],
      weekStart: d.weekStart || null, weekEnd: d.weekEnd || null, generatedAt: d.generatedAt || null,
      source: d.source || null, sourceUrl: d.sourceUrl || null,
      unconfirmed: d.largeCapCoverage && Array.isArray(d.largeCapCoverage.unconfirmed) ? d.largeCapCoverage.unconfirmed : []
    };
  } catch (e) { …log…; return null; }
}
```

   Installed as `root._fetchEarningsCalendarSnapshot` by `src/app/compatibility-globals.js:6`. Callers:
   `src/ui/components/briefing-read.js:259-266` (stores the result in `root._aioEarningsSnapshot`),
   `src/ui/pages/news.js:775-779`, `src/ui/components/earnings-calendar.js:9` (direct import).
3. **Provider reader** — `src/data/providers/earnings.js`: `createPublicEarningsReader(httpClient, now)` fetches
   `artifactUrl('earnings-calendar.json')` with `{ cache: 'no-store' }` through an injected `httpClient.requestJson`,
   caches for 120 s, and feeds `selectPublicEarnings(cached, symbol, from, to)` (which requires
   `data.status === 'current-reference'`). Wired in `src/app/bootstrap.js` (~line 466).
4. The producer rewrites the artifact from the `refresh-screener` workflow (every 6 hours); the artifact is not
   intraday data.

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
| Who tests these modules | `git grep -ln "earnings-calendar-snapshot\|providers/earnings\|createPublicEarningsReader\|fetchEarningsCalendarSnapshot" -- scripts` | the gate files to run and extend |
| Unit gate | `node scripts/ci-esm-core-unit-check.mjs` | exit 0 |
| Boot bundle budget | `node scripts/ci-boot-bundle-budget-check.mjs` | exit 0 (if importing the registry into a boot module pushes it over, STOP) |
| Architecture/layering | `node scripts/qa-runner.mjs fast` | `fail=0` (includes `architecture`) |

## Scope

**In scope**
- `src/data/earnings-calendar-snapshot.js`
- `scripts/ci-data-pipeline-contract-check.mjs` — only the one clause at ~line 2290 (see Step 2)
- `scripts/ci-esm-core-unit-check.mjs` — the new assertions (Step 4)
- `src/data/providers/earnings.js` and its one wiring site in `src/app/bootstrap.js` — **only if Step 3's condition holds**
- `_artifacts/pending-records/plan-009/earnings-calendar-reader.json` (create)

**Out of scope**
- The callers (`briefing-read.js`, `news.js`, `earnings-calendar.js`, `compatibility-globals.js`): the snapshot
  function keeps its name, signature and return shape, so they do not change.
- `src/data/shared-artifacts.js`, `src/data/artifact-registry.js` (reuse, do not modify), `sw.js`, the producer.
- `js/aio-core.js`'s `user-research-digest.json` boot fetch (a separate question; not this plan).

## Steps

### Step 1: Read the shared loader's contract
Read `src/data/shared-artifacts.js` fully (it is short) and one caller (`portfolio-checklist.js:100-165`). Write
down in your report: what the returned promise resolves to, what is stored at `root[key]` on success, what happens on
HTTP failure / oversized body / schema mismatch (is the previous value kept? is the promise rejected?), and how
repeated calls inside `maxAgeMs` behave (no network?).
**Verify**: the four answers are in your report with `file:line` for each.

### Step 2: Snapshot reader reads the shared copy
Facts about the shared loader (`src/data/shared-artifacts.js:29-50`), verified at the planned commit — confirm them
in Step 1: it never rejects; it resolves `{ payload, changed }`; on success it stores the payload at `root[key]`; on a
failed fetch, a schema mismatch or an oversized body it keeps the previous `root[key]`, records `failedAt` and
retries only after 60 s; inside `maxAgeMs` a repeat call makes no request. It fetches through `root.fetch` (not
`root.fetchWithTimeout`) and accepts only `schemaVersion: 'earnings-calendar.v1'`.

Rewrite `fetchEarningsCalendarSnapshot` so that it awaits `refreshSharedArtifact(root, EARNINGS_CALENDAR)` (keep a
try/catch for safety, logging through `_aioLog`), then reads `const d = root[EARNINGS_CALENDAR.key]` and returns the same object
shape as today, or `null` when `d` is missing or `d.earnings` is not an array. Keep the `_aioLog` warning on error.
Remove the `?v=${Date.now()}` URL and the direct `fetchWithTimeout` call. Update the file's header comment to say
the reader shares the registry's cached copy.

One existing gate pins this file's text: `scripts/ci-data-pipeline-contract-check.mjs` ~line 2290, inside the check
'earnings calendar keeps producer, consumer and lineage policy aligned', has the clause
`/public-data\/earnings-calendar\.json/.test(read('src/data/earnings-calendar-snapshot.js'))`. After the rewrite the
literal lives in the registry, so change only that clause to
`/'earnings-calendar\.json'/.test(read('src/data/artifact-registry.js')) && /EARNINGS_CALENDAR/.test(read('src/data/earnings-calendar-snapshot.js'))`
(it re-points an existing pin at the new owner; it is not a new pin). Leave the rest of that check as is.

**Verify**: `node --check src/data/earnings-calendar-snapshot.js`; unit gate exit 0;
`node scripts/ci-data-pipeline-contract-check.mjs` exit 0.

### Step 3: Provider reader — only if it is safe
No gate calls `createPublicEarningsReader` or `fetchEarningsCalendarSnapshot` today (only `selectPublicEarnings` is
imported, by `scripts/ci-ai-evidence-contract-check.mjs`), so there is no test protecting the provider reader. Converting
it is therefore **optional**: do it only if you also add an assertion for it in Step 4, and **only if** `createPublicEarningsReader` has exactly one production wiring site and that site has `root` available:
then let it call `refreshSharedArtifact(root, EARNINGS_CALENDAR)` and pass `root[EARNINGS_CALENDAR.key]` to
`selectPublicEarnings`, dropping its own 120 s cache. If the injected client is part of a provider contract that
tests rely on (e.g. a gate constructs it with a fake `httpClient` and asserts the URL or the `no-store` option),
leave the provider reader unchanged and say so in NOTES — one duplicate fetch remains, which is acceptable.

**Verify**: unit gate and every gate from the "Who tests these modules" list exit 0.

### Step 4: Tests
In `scripts/ci-esm-core-unit-check.mjs` add `v59.94` assertions using a fake `root` whose `fetch` you control, the
same way existing shared-artifact tests do (find one with `git grep -n "refreshSharedArtifact" -- scripts`). The fake
`fetch` must return a response with `ok: true` and a `.text()` that yields JSON containing
`schemaVersion: 'earnings-calendar.v1'` (the loader reads `response.text()` for its size bound and rejects any other
schema), otherwise the load fails and the reader returns `null`:
- two consecutive `fetchEarningsCalendarSnapshot({ root })` calls cause one network request;
- the returned shape has `earnings`, `ipos`, `weekStart`, `weekEnd`, `generatedAt`, `source`, `sourceUrl`,
  `unconfirmed` with the same values as before for a sample artifact;
- a failed first load (fetch returns `ok: false`) returns `null` (not an empty-but-truthy object);
- a failed refresh after a good load still returns the previous snapshot (the loader keeps the last good copy).

**Verify**: the gate passes, and fails on the two-requests assertion when `src/data/earnings-calendar-snapshot.js`
is stashed back.

### Step 5: Gates and pending record
`node scripts/ci-boot-bundle-budget-check.mjs` → exit 0; `node scripts/qa-runner.mjs contracts --keep-going` → only
the known failures. Change-only pending record (no `p`). `node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Step 4. Pattern: the existing shared-artifact assertions in `scripts/ci-esm-core-unit-check.mjs`.

## Done criteria

- [ ] `git grep -n "earnings-calendar.json?v=" -- src js` returns nothing
- [ ] The new assertions exist, pass, and fail with the reader change stashed
- [ ] `ci-boot-bundle-budget-check` exits 0
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- Step 1 shows the shared loader behaves differently from the facts stated in Step 2 (for example it clears
  `root[key]` on a failed refresh) — report the behaviour instead of papering over it.
- Importing `artifact-registry.js`/`shared-artifacts.js` from `earnings-calendar-snapshot.js` breaks a layering gate
  (`architecture` in `qa-runner fast`) or pushes the boot bundle over budget.
- The 512 KB `maxBytes` of the descriptor is below the current artifact size (check
  `node -e "console.log(require('fs').statSync('public-data/earnings-calendar.json').size)"`; if ≥ 512*1024, STOP).

## Maintenance notes

- Freshness: readers now see the artifact at most 6 hours old in a long-lived tab (the registry's max age) instead
  of re-downloading each visit; the producer writes it every 6 hours, so nothing newer exists in between. The old
  reader also forced revalidation on every call (`no-cache` plus a unique URL); the shared loader uses the default
  fetch cache mode, so a refresh may be answered from the HTTP cache for the host's max-age.
- Reviewer: open 브리핑, 오늘 and 뉴스 in the browser after integration and confirm the earnings rows appear and the
  network panel shows one `earnings-calendar.json` request.
