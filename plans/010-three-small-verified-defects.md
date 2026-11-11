# Plan 010: Three small verified defects — stacked stale-warning listeners, FX bar rounding, unstage denied by the guard

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The three parts are independent: if one part hits a STOP condition, finish the others and report the stopped part.
> Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 813371fc5..HEAD -- src/ui/components/data-status-surface.js src/domain/screener/price-factors.js scripts/agent-hook.mjs scripts/ci-workspace-contract-check.mjs`
> If any changed, compare "Current state" with the live code; on a mismatch in a part, skip that part and report.

## Status

- **Priority**: P3
- **Effort**: S (each part)
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `813371fc5`, 2026-11-10

## Why this matters

Three defects found by reading, each small, each with a clean test:
- **A.** While market data is more than 24 h old, every snapshot apply adds two more event listeners and a 45 s
  timer for the same "hide the stale banner" job. They only clear when a live event fires, so a stalled producer
  makes them pile up for the whole session.
- **B.** Daily bars built from Yahoo chart data round `close` to the instrument's digits (4 for EURUSD, GBPUSD,
  CNY, AUDUSD) but always round `high`, `low` and `adjClose` to 2. A row can read close 1.1544, high 1.15 — a high
  below the close. No screen reads FX high/low today, so it is latent, but the row is wrong.
- **C.** The agent command guard denies `git restore --staged .` (it only unstages; nothing is lost), and allows a
  forced push whose refspec is quoted: `git push origin "+main"`, `'+main'`, `"+HEAD:main"` (the rule needs the `+`
  right after whitespace). Note: `git push origin HEAD:+main` is NOT a forced push (it creates a branch literally
  named `+main`); a force marker must lead the refspec. Do not deny it.

## Current state

**A. `src/ui/components/data-status-surface.js`**, function `_aioApplySnapshotStaleWarning(S)` (starts ~line 195),
called from `js/aio-core.js` inside `applyDataSnapshot`. When `age > 24h` it shows `#snapshot-stale-warning`, then:

```js
          var _onStaleLiveFire = function(ev) {
            if (ev && ev.detail && ev.detail.coreCoverageOk === false) return;
            try { …audit check… return; } catch(_audit) {}
            if (staleEl) staleEl.style.display = 'none';
            window.removeEventListener('aio:liveDataReceived', _onStaleLiveFire);
            window.removeEventListener('aio:liveQuotes', _onStaleLiveFire);
          };
          window.addEventListener('aio:liveDataReceived', _onStaleLiveFire, { once: true });
          window.addEventListener('aio:liveQuotes', _onStaleLiveFire, { once: true });
          // fallback: 45초 후 1회 확인 (이벤트 누락 대비)
          setTimeout(function() {
            var liveTs = window._quoteTimestamps || {};
            var hasRecent = Object.values(liveTs).some(function(t) { return Date.now() - t < 120000; });
            if (hasRecent) _onStaleLiveFire();
          }, 45000);
```

A new closure, two listeners and a timer per call. Note `{ once: true }` removes a listener after its first
dispatch even when the handler returned early (coverage not OK) — that early-return case then relies on the other
event or the timer.

**B. `src/domain/screener/price-factors.js`**, function `dailyRowsFromYahooChart` (rows built ~lines 338–357):

```js
       close: round(c, closeDigits),
      adjClose: (typeof a === 'number' && isFinite(a) && a > 0) ? round(a, 2) : null,
       high:   typeof h === 'number' && isFinite(h) ? round(h, 2)    : null,
       low:    typeof l === 'number' && isFinite(l) ? round(l, 2)    : null,
```

`closeDigits` defaults to 2; `scripts/producer/quotes.mjs` (~lines 471, 493) passes `closeDigits: 4` for the four FX
pairs. Rows for every other instrument are unaffected by using `closeDigits` for the other three fields.
`scripts/ci-esm-core-unit-check.mjs` has assertions on these rows (search `dailyRowsFromYahooChart`).

**C. `scripts/agent-hook.mjs`**, mode `guard-command`. Git rules are tested per command segment:

```js
  const segments = command.split(/[\n;&|]+/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const GIT = String.raw`\bgit(?:\s+(?:-[Cc]\s+\S+|--?[\w-]+(?:=\S+)?))*\s+`;
  const gitBlocked = [
    [new RegExp(`${GIT}reset\\b.*\\s--hard\\b`, 'i'), '…'],
    [new RegExp(`${GIT}(?:checkout|restore)\\b(?:\\s+-{1,2}[a-z-]+(?:=\\S+)?(?:\\s+\\S+)?)*\\s+(?:--\\s+)?\\.(?:\\s|$)`, 'i'), 'Discarding the whole working tree can destroy uncommitted work.'],
    …
    [new RegExp(`${GIT}push\\b.*\\s(?:--force(?:-with-lease|-if-includes)?(?:=\\S+)?|-[a-z]*f[a-z]*|\\+\\S+)(?:\\s|$)`, 'i'), 'Force push is forbidden; …']
  ];
  …
  const match = gitBlocked.find(([pattern]) => segments.some((segment) => pattern.test(segment))) || blocked.find(…);
```

Fixtures live in `scripts/ci-workspace-contract-check.mjs` (search `guard denies` / `guard allows`): arrays of
commands run through a `runHook('guard-command', { cwd: root, hook_event_name: 'PreToolUse', tool_input: { command } })`
helper, asserting the output does / does not contain `"permissionDecision":"deny"`.
You can run the hook by hand: `echo '{"tool_input":{"command":"git status"}}' | node scripts/agent-hook.mjs guard-command`
(prints a deny JSON or nothing). Beware: your own shell command is checked by the same hook, so a probe whose text
contains a denied spelling is itself denied — put probes in a temporary `.mjs` file outside the repo that builds the
command strings and spawns the hook, as the fixtures do.

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
| Unit gate | `node scripts/ci-esm-core-unit-check.mjs` | exit 0 |
| Hook fixtures | `node scripts/ci-workspace-contract-check.mjs` | `Workspace contract OK` |

## Scope

**In scope**
- `src/ui/components/data-status-surface.js` — only `_aioApplySnapshotStaleWarning` and one module-level variable
- `src/domain/screener/price-factors.js` — only the three rounding expressions
- `scripts/agent-hook.mjs` — only the checkout/restore rule and the push rule
- `scripts/ci-esm-core-unit-check.mjs` (tests for A and B), `scripts/ci-workspace-contract-check.mjs` (fixtures for C)
- `_artifacts/pending-records/plan-010/` — one JSON per part you completed (create)

**Out of scope**
- `js/aio-core.js`; the banner's wording; when the banner shows.
- `scripts/producer/quotes.mjs`; `public-data/**`.
- Any other guard rule; `.claude/settings.json`; `.codex/hooks.json`.

## Steps

### Part A — one pending listener set for the stale banner
1. Add a module-level `let stalePending = null;` (an object holding the handler and timer id, or `null`).
2. In the `age > 24h` branch: if `stalePending` is set, do nothing more (the banner text was already refreshed
   above); otherwise create the handler, register the two listeners **without** `{ once: true }`, start the 45 s
   timer, and store them. The handler, when it decides to hide the banner, removes both listeners, clears the timer
   and sets `stalePending = null`. When it returns early (coverage not OK) it stays registered.
3. In the `else` branch (data is fresh; banner hidden) also tear down a pending set.
4. Test (in `scripts/ci-esm-core-unit-check.mjs`, labelled `v59.94`; no gate imports this module today). The module
   exports `installDataStatusSurface(window, document)`, which installs `_aioApplySnapshotStaleWarning` on the given
   window (~line 254) and at install does `window.AIO.updateSnapshotStaleBanner = …`, so the fake window needs
   `AIO: {}`. The function calls the **global** `setTimeout` (not `window.setTimeout`): for the duration of the test
   replace `globalThis.setTimeout`/`clearTimeout` with counting stubs and restore them in a `finally` — otherwise a
   real 45 s timer keeps the gate process alive. Call the function three times with a fake `window`/`document` pair
   whose `addEventListener`/`removeEventListener` are counted and whose `#snapshot-stale-warning` is a stub element,
   using a snapshot dated 3 days ago → exactly 2 listeners registered in total and 1 timer; then dispatch
   the handler with a live event → banner hidden, listeners removed; call again with stale data → a new set of 2.
   If the function cannot be reached without a real DOM or the module reads globals at import in a way a fake cannot
   satisfy, skip the test, say so, and keep the code change only if it is ≤ 15 changed lines.

**Verify**: `node --check src/ui/components/data-status-surface.js`; unit gate exit 0; the new assertion fails with
the source change stashed.

### Part B — FX bars keep their digits
1. Replace `round(a, 2)`, `round(h, 2)`, `round(l, 2)` with `round(…, closeDigits)` in the three expressions.
2. Test (unit gate, `v59.94`): call `dailyRowsFromYahooChart` (see the existing assertions for the argument shape)
   with one bar `close 1.15444, high 1.15991, low 1.15012, adjclose 1.15444` and `closeDigits: 4` → `high 1.1599`,
   `low 1.1501`, `adjClose 1.1544`, and `high >= close >= low`; the same bar with the default digits → all four at 2
   decimals (unchanged behaviour).

**Verify**: unit gate exit 0; the 4-digit assertion fails with the source change stashed.

### Part C — guard: allow unstage, deny a `+` inside a refspec
1. Whole-tree discard rule: do not deny a `restore` segment that has `--staged` or `-S` and has neither
   `--worktree` nor `-W` (it only moves changes out of the index). `gitBlocked` is an array of `[regex, reason]`
   pairs tested with `.find`/`.some`; give the whole-tree rule an optional third element, a predicate
   `(segment) => boolean` meaning "exempt", and have the matcher skip a pair when its predicate returns true for that
   segment. The predicate:
   `(segment) => /\brestore\b/.test(segment) && /\s(?:--staged|-[A-Za-z]*S[A-Za-z]*)(?:\s|$)/.test(segment) && !/\s(?:--worktree|-[A-Za-z]*W[A-Za-z]*)(?:\s|$)/.test(segment)`
   (short flags can be clustered: `-SW .` restores both and must stay denied).
2. Push rule: also match a quoted leading `+` — extend the last alternative from `\+\S+` to `["']?\+\S+`.
3. Fixtures (label them `v59.94`): add to the deny list `git push origin "+main"`, `git push origin '+main'`,
   `git push origin "+HEAD:main"`, `git restore --staged --worktree .`, `git restore -SW .`; add to the allow list
   `git restore --staged .`, `git restore -S .`, `git restore --source=HEAD --staged .`, `git push origin a+b`,
   `git push origin HEAD:main`, `git push origin HEAD:+main`. Every existing fixture must keep its result.

**Verify**: `node --check scripts/agent-hook.mjs`; `node scripts/ci-workspace-contract-check.mjs` → OK. Then stash
the hook change only → the new fixtures fail → pop.

### Finish
One pending record per completed part (A and B and C are defects: `p` entries). `node scripts/apply-pending-records.mjs --dry-run` → 0.
`node scripts/qa-runner.mjs contracts --keep-going` → only the known failures.

## Test plan

Stated per part above. Each new assertion must fail on the old code (stash check) — report the result of each.

## Done criteria

- [ ] Unit gate and workspace contract gate exit 0
- [ ] Each completed part's assertion fails with that part's source change stashed
- [ ] `git status --short` shows only in-scope paths
- [ ] Report says, per part: completed / skipped (with reason)

## STOP conditions (per part)

- A: the module's structure differs from the excerpt (e.g. the function was moved), or the change needs `js/aio-core.js`.
- B: an existing assertion pins 2-decimal high/low for a 4-digit instrument (report it; do not change a pinned value).
- C: an existing allow/deny fixture flips after your change.

## Maintenance notes

- `scripts/agent-hook.mjs` is a risk path (agent permissions): the reviewer reads the regex diff and runs the hook
  on everyday commands before accepting.
- B changes FX rows in producer output on the next refresh (more digits in `high`/`low`/`adjClose` for four pairs);
  no consumer reads them today.
