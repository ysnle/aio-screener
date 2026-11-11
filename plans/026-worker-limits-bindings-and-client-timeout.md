# Plan 026: Feedback and Workers-AI rate limits hold across isolates; the Actions AI client outwaits the Worker deadline

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise.
> The two parts are independent. Do not update `plans/README.md`; the reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 40d470fb3..HEAD -- worker/wrangler.proxy.toml cloudflare-worker-proxy.js scripts/lib/ai-shared-analysis.mjs scripts/ci-worker-relay-check.mjs`
> If a file changed, compare "Current state" with the live code; on a mismatch in a part, skip that part.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED for Part A (a wrong Wrangler config fails the Worker deploy; the deploy workflow verifies health and
  rolls nothing out on failure), LOW for Part B
- **Depends on**: none
- **Category**: security hardening / bug
- **Planned at**: commit `40d470fb3`, 2026-11-11

## Why this matters

**A.** The AI proxy Worker rate-limits five routes through `enforceRateLimit(env, '<BINDING>', fallbackMap, limit, key)`.
When the named Cloudflare rate-limit binding is absent it falls back to a `Map` that lives in one isolate, so the
limit is per isolate, not global. `worker/wrangler.proxy.toml` declares three bindings (`RATE_LIMIT_PROXY`,
`RATE_LIMIT_OPENAI`, `RATE_LIMIT_RELAY`); the code also asks for `RATE_LIMIT_FEEDBACK` (the `/feedback` route, which
any origin can reach and which writes into the Durable Object's 300-note buffer) and `RATE_LIMIT_WORKERS_AI` (the
free translation binding, 30/min). Those two are per-isolate today. (`RATE_LIMIT_HEALTH` is also unbound, by a
recorded decision — the answer is memoized; leave it.)

**B.** `scripts/lib/ai-shared-analysis.mjs` gives the GitHub Actions producers a 30 s timeout for a non-search AI
call, while the Worker allows that same request 60 s. A call that needs 30–60 s is aborted by the client; by policy
the Worker keeps the full budget reservation for a response OpenAI may still complete and bill, and the producer
loses the answer. The search timeout already follows the right rule (125 s client, 120 s Worker: the Worker answers
first).

## Current state

**A.** `worker/wrangler.proxy.toml` (~lines 66–92):

```toml
# `namespace_id` must be a positive integer, unique per Cloudflare account; bindings that …
[[ratelimits]]
name = "RATE_LIMIT_PROXY"
namespace_id = "1001"
[ratelimits.simple]
limit = 300
period = 60

[[ratelimits]]
name = "RATE_LIMIT_OPENAI"
namespace_id = "1002"
[ratelimits.simple]
limit = 20
period = 60

[[ratelimits]]
name = "RATE_LIMIT_RELAY"
namespace_id = "1003"
[ratelimits.simple]
limit = 60
period = 60
```

No other `worker/*.toml` uses a `namespace_id`. Code constants in `cloudflare-worker-proxy.js`:
`FEEDBACK_RATE_LIMIT = 5` (~line 568, used at ~577 with key `clientIp`),
`export const WORKERS_AI_TRANSLATE_PER_MINUTE = 30` (~1517, used at ~1524 with the constant key `'automation'`).
`enforceRateLimit` (~line 296) uses `binding.limit({ key })` and falls back to the map when the binding is missing
or throws. `scripts/ci-worker-relay-check.mjs` (~lines 196–203) checks the toml: each of the three names is
declared, every `period` is 10 or 60, namespace ids are unique positive integers. Other gates that read the toml:
`scripts/ci-cloudflare-deployment-contract-check.mjs`, `scripts/ci-operations-contract-check.mjs`,
`scripts/ci-version-check.mjs`, `scripts/worker-deploy-impact.mjs` (decides whether a change redeploys the Worker).
The toml also carries a version/revision line that `bump-version.mjs` owns — do not touch it.

**B.** `scripts/lib/ai-shared-analysis.mjs`:

```js
// The Worker's hosted-search deadline is 120 s (cloudflare-worker-proxy.js openAiDeadlineMs); search callers wait 125 s, just
// past that bound, so the Worker deadline answers first and the client receives its response.
export const SHARED_AI_TIMEOUT_MS = Object.freeze({ analysis: 30000, search: 125000 });
```

`postSharedAi`, `requestSharedJson` (default `body?.tools ? search : analysis`) and `requestSharedAnalysis` default to
`analysis`. The Worker side (`cloudflare-worker-proxy.js` ~770–780):

```js
const OPENAI_DEADLINE_MS = 60000;
const OPENAI_LONG_DEADLINE_MS = 120000;
const OPENAI_DEEP_DEADLINE_MS = 180000;
function openAiDeadlineMs(budget) {
  if (budget?.body?.reasoning?.effort === 'medium' || Number(budget?.body?.max_output_tokens) > 8192) return OPENAI_DEEP_DEADLINE_MS;
  return (budget?.searchReserveMicroUsd > 0 || Number(budget?.body?.max_output_tokens) > 4000) ? OPENAI_LONG_DEADLINE_MS : OPENAI_DEADLINE_MS;
}
```

The Actions profiles (`SHARED_AI_PROFILES`): `analysis` 1500 output tokens / effort none, `structured` 2500 / low,
`search` 1200 / low with one tool call — so a non-search Actions call always gets the 60 s Worker deadline.
Callers that pass their own `timeoutMs`: `scripts/fetch-event-briefs.mjs` (~197, uses `.search`). Tests of this
module: find with `git grep -ln "ai-shared-analysis" -- scripts/ci-*.mjs worker`.

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
| Worker config + relay gate | `node scripts/ci-worker-relay-check.mjs` | exit 0 |
| Cloudflare group | `node scripts/ci-cloudflare-deployment-contract-check.mjs`; `node scripts/ci-operations-contract-check.mjs` | exit 0 |
| Shared-AI tests | each gate from `git grep -ln "ai-shared-analysis" -- scripts/ci-*.mjs` | exit 0 |

Never run `wrangler`, never call the live Worker.

## Scope

**In scope**
- `worker/wrangler.proxy.toml` — two new `[[ratelimits]]` blocks and the comment above the bindings; `worker/README.md` — the binding list only
- `scripts/ci-worker-relay-check.mjs` — the list of declared binding names (and a `v59.97` check for the two new ones)
- `scripts/lib/ai-shared-analysis.mjs` — the `analysis` timeout and its comment
- one gate that already tests `ai-shared-analysis` (a `v59.97` assertion)
- `_artifacts/pending-records/plan-026/` — one JSON per completed part

**Out of scope**
- `cloudflare-worker-proxy.js` (no code change is needed: it already asks for the bindings by name).
- `RATE_LIMIT_HEALTH` (recorded decision), the three existing blocks, the deploy workflows, the limits' values.

## Steps

### Part A — two bindings
1. Append after the `RATE_LIMIT_RELAY` block:

```toml
[[ratelimits]]
name = "RATE_LIMIT_FEEDBACK"
namespace_id = "1004"
[ratelimits.simple]
limit = 5
period = 60

[[ratelimits]]
name = "RATE_LIMIT_WORKERS_AI"
namespace_id = "1005"
[ratelimits.simple]
limit = 30
period = 60
```

   The limits must equal the code constants (`FEEDBACK_RATE_LIMIT`, `WORKERS_AI_TRANSLATE_PER_MINUTE`) — re-read
   both values before writing. Add one comment line above the two blocks saying what they bound.
2. In `scripts/ci-worker-relay-check.mjs`: add the two names to the declared-binding loop; the namespace-id check
   at ~line 205 hard-codes `ids.length === 3` — change it to `ids.length >= 3` (the intent is unique positive
   integers, not a count; this is in scope and is not a STOP); and add a `v59.97`
   check that each declared limit equals its code constant: read the constants by importing
   `WORKERS_AI_TRANSLATE_PER_MINUTE` from `../cloudflare-worker-proxy.js` (it is exported) and, for the feedback
   limit, by exercising the `/feedback` path through the gate's existing harness if it has one — if the feedback
   constant is not reachable without matching source text, check only the Workers-AI value and say so.
3. The Workers-AI refusal case already exists (~line 323: `RATE_LIMIT_WORKERS_AI` answering `success: false`) — do
   not duplicate it. Add the analogous `v59.97` case for `/feedback` (a binding answering `success: false` → 429)
   if the harness can reach the route; the only existing feedback binding test is a success case in
   `worker/openai-contract.test.mjs` (~line 132, out of scope). Otherwise say it could not be reached.
4. Two texts go stale with the new blocks; update both (they are in scope): the toml comment above the bindings that
   says not to reuse "these three" ids, and `worker/README.md` (~line 59) which lists the three bindings and limits.

**Verify**: `node scripts/ci-worker-relay-check.mjs` exit 0; the Cloudflare group gates exit 0;
`node scripts/worker-deploy-impact.mjs --help` or a read of the script to confirm a toml change is classified as
"deploy the AI proxy" (report what it says).

### Part B — the client outwaits the Worker
1. Set `analysis: 65000` and rewrite the comment above `SHARED_AI_TIMEOUT_MS` to state the rule for both keys: the
   client waits a few seconds past the Worker's deadline for that kind of request (60 s non-search, 120 s search),
   so the Worker answers first and a slow answer is not abandoned with its reservation held.
2. Test (`v59.97`): in a gate that already imports this module, assert `SHARED_AI_TIMEOUT_MS.analysis > 60000` and
   `SHARED_AI_TIMEOUT_MS.search > 120000`, and — if the Worker's deadline constants can be read without a source
   text match (they are not exported today; do not export them just for this) — skip the cross-file comparison and
   say so. This assertion is on a constant by necessity; label it as the invariant it encodes.
3. Check callers for an assumption of 30 s: `git grep -n "30000\|30_000\|timeoutMs" -- scripts/fetch-*.mjs scripts/producer scripts/build-*.mjs | grep -i "ai\|shared"`
   and the `timeout-minutes` of the job that runs them. Facts at the planned commit: `fetch-event-briefs.mjs` passes
   the search timeout to every call, so `event-briefs.yml` is unaffected; the callers that use the `analysis`
   timeout are `scripts/producer/ai-usage.mjs` (~29), `scripts/producer/market-narrative.mjs` (~415,
   `requestSharedAnalysis`) and the slot-summary/market-timeline path, all inside the `refresh` job of
   `refresh-data.yml` (`timeout-minutes: 45`). Count the maximum number of such calls in one run (read the loops
   and retry counts) and report the worst-case added wait (calls × 35 s) against 45 minutes and the job's usual
   duration (about 4–7 minutes). If a job could
   exceed its `timeout-minutes` in the worst case because of this change, STOP Part B.

**Verify**: the shared-AI gates exit 0; `node --check scripts/lib/ai-shared-analysis.mjs`.

### Finish
`node scripts/qa-runner.mjs contracts --keep-going` → only the expected failures. Pending records: A is change-only
(hardening), B is a defect (`p`). `node scripts/apply-pending-records.mjs --dry-run` → 0.

## Test plan

Per part above.

## Done criteria

- [ ] `grep -c "ratelimits\]\]" worker/wrangler.proxy.toml` → 5; namespace ids 1001–1005, all unique
- [ ] `node scripts/ci-worker-relay-check.mjs` exits 0 with the two new names checked
- [ ] `SHARED_AI_TIMEOUT_MS.analysis` is 65000 and its gate assertion exists
- [ ] `git status --short` shows only in-scope paths

## STOP conditions

- A gate forbids more than three rate-limit bindings or pins the toml's block count.
- The `/feedback` limiter turns out to be called with a constant key (a single shared bucket for all readers) —
  report instead of binding it. (The Workers-AI limiter's constant key `'automation'` is expected: it is an
  automation-token route, not a reader route, and does not trigger this STOP.)
- Part B step 3 shows a job could exceed its timeout.

## Maintenance notes

- Reviewer: `worker/` is a deploy path. After push, "Deploy AI proxy" must go green (its health/readiness/CORS
  verification step); if Cloudflare rejects the config, revert this toml change — the code falls back to the
  per-isolate map exactly as before.
- Namespace ids are per account: 1004/1005 must not be used by another Worker of this account (none in this repo).
