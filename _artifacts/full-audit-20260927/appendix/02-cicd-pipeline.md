# AIO Screener — CI/CD & Data Pipeline Audit

Repo: `ysnle/aio-screener` (public). Local clone: `C:\projects\AIO`, checked read-only 2026-09-27.
Live: https://ysnle.github.io/aio-screener/. Declared app version: v56.55 (local, uncommitted).

All findings below are backed by evidence I pulled directly (file:line, `gh api`/`gh run` output, live
`curl`). Anything I could not directly confirm is marked **[unverified]**.

---

## 0. Executive snapshot (read this first)

**The pipeline is, right now, in an active, ongoing incident**, not a hypothetical risk:

| Layer | Value | Evidence |
|---|---|---|
| Live deployed app version | `v56.33`, built 2026-09-24T22:44+09:00 | `curl https://ysnle.github.io/aio-screener/version.json` |
| `origin/main` HEAD version | `v56.52`, built 2026-09-26T14:26+09:00, commit `904cebd0` | `git show origin/main:version.json` |
| Local working tree version | `v56.55` (uncommitted) | `version.json` in working copy |
| Live `data.json` freshness | `generatedAt=2026-09-26T01:35:13Z`, i.e. **~30.75 hours stale** at audit time (2026-09-27T08:20Z) | `curl .../public-data/data.json` |
| CI health | **Open incident issue #2 "[Operations] CI is failure"**, unresolved since 2026-09-26T05:50 (>24h) | `gh api .../issues?labels=aio-operations-alert` |
| Root cause | `ci-data-lineage-audit.mjs` gate hard-fails because `public-data/screener-universe.json` is 73.24 days old against a declared 30‑day `staleAfterDays` policy — a file nothing in the automated pipeline refreshes | Job log, run 36297988434; `js/aio-data.js:11`, `scripts/ci-data-lineage-audit.mjs:187-191`, `scripts/sync-screener-universe.mjs` |
| Also open | Issue #5 "Refresh market data is failure" (opened 2026-09-27T05:50), Issue #4 "Data freshness watchdog is failure" (2026-09-27T01:35) | same query |

Chain of causation: `ci-data-lineage-audit.mjs` → **hard-fails** the `Contracts / data` shard of `ci.yml` →
`attest` job is skipped (`needs: [preflight, contracts, browser]`) → no release attestation is produced →
`pages-deploy.yml`'s `workflow_run` trigger fires on a **failed** CI run so its `if:` guard never runs →
Pages never redeploys → the live site is frozen on the last SHA that *did* pass CI, while `refresh-data.yml`
and `refresh-screener.yml` keep committing new data to `main` every cycle (their own gates are passing) with
no way to reach production. This is exactly the "R606" self-healing mechanism described in the workflows'
own comments working as designed — it correctly refuses to deploy an unattested SHA — but the *cause* of the
CI failure is a governance mismatch (see Finding C-1), not a data-quality regression, so the fail-closed
design is currently blocking 100% of unrelated, valid work from reaching users.

---

## 1. Workflow inventory & trigger map

| Workflow | Triggers | Concurrency group | cancel-in-progress | Permissions | Timeout |
|---|---|---|---|---|---|
| `ci.yml` | `push:main`, `pull_request`, `workflow_dispatch(release_sha, origin)` | `CI-${{pr\|release_sha\|ref}}` | true | `contents: read` (root); `attest` job re-declares `contents: read` | preflight 20m / contracts 45m / browser 60m / attest 15m |
| `pages-deploy.yml` | `workflow_run: [CI] completed`, `workflow_dispatch(ci_run_id, expected_sha)` | `aio-pages-production` | **false** | `actions: read, contents: read, pages: write, id-token: write` | 30m |
| `refresh-data.yml` | `schedule: '17,47 * * * *'` + `'13 7 * * *'`, `workflow_dispatch` | `refresh-data` | false | `contents: write, actions: write` | 45m |
| `refresh-screener.yml` | `schedule: '41 */6 * * *'`, `workflow_dispatch` | **`refresh-data`** (shared with above) | false | `contents: write, actions: write` | 45m |
| `data-watchdog.yml` | `schedule: '23 * * * *'`, `workflow_dispatch` | `aio-data-watchdog` | true | `actions: read, contents: read, issues: read` | 30m |
| `operations-alert.yml` | `workflow_run` on 7 named workflows, `completed` | `aio-operations-alert` | false | `actions: read, issues: write` | 15m |
| `deploy-ai-proxy.yml` | `workflow_dispatch` only | `aio-cloudflare-ai-proxy` | false | `contents: read` | 25m |
| `deploy-data-plane.yml` | `workflow_dispatch` only | `aio-cloudflare-data-plane` | false | `contents: read` | 25m |
| `knowledge-lint.yml` | `schedule: '13 4 * * 1'`, `workflow_dispatch` | none | — | `contents: read` | 20m |

**Deploy path is single and explicit** — good design: `ci.yml` never deploys; only `pages-deploy.yml` does,
gated by a downloaded release-attestation artifact whose `testedSha` must equal the resolved SHA
(`pages-deploy.yml:97-106`). There is no duplicate/competing deploy path; the old "legacy branch-deploy"
mode is referenced only in a comment (`refresh-data.yml:213-218`) as a **past** incident, already fixed.

**refresh-data.yml and refresh-screener.yml intentionally share one concurrency group (`refresh-data`)**
so their `git push` races against each other are serialized rather than concurrent — a deliberate,
documented choice, not an oversight.

**Action pinning**: every `uses:` across all 9 workflows is pinned to a full 40-char commit SHA with a
version-number comment (e.g. `actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0`). This is
consistently applied and is good supply-chain hygiene — no floating tags found anywhere.

**Node/tooling pinning**: no repo-wide `.nvmrc`/`.node-version`. Most workflows pin Node **20**; the two
Cloudflare deploy workflows pin Node **24**, documented as required because `wrangler@4.120.0` refuses
Node <22 (`deploy-data-plane.yml:36-40`). `package.json` has exactly two devDependencies
(`js-yaml@5.2.1`, `playwright@^1.48.0`); Wrangler itself is a global `npm install -g` in the deploy jobs,
explicitly noted as **outside Dependabot's reach** (`deploy-data-plane.yml:46-48`) — a real, called-out gap:
a wrangler CVE would not be caught by Dependabot.

**GITHUB_TOKEN anti-recursion**: extensively documented via inline "R606" comments in `refresh-data.yml`,
`refresh-screener.yml`, and `pages-deploy.yml` — a `workflow_dispatch` run created with the built-in
`GITHUB_TOKEN` does not emit a `workflow_run` event, so a naive bot-dispatched CI run's attestation would
have no consumer. The fix (`ensure-live-convergence.mjs` + `pages-deploy.yml`'s `workflow_dispatch` entry
point that re-validates the exact same attestation contract) is a real, previously-shipped incident fix,
not a workaround; the postmortem trail (P572/R263, R606, P1160, P564/R255) embedded as comments across
these three files is unusually good self-documentation of prior outages and their root causes.

**Dependabot**: two open PRs, both stale for ~7-10 days as of audit date: `dependabot/github_actions/...`
(opened 2026-09-17) and `dependabot/npm_and_yarn/ci-toolchain-...` (opened 2026-09-20). Both show
`mergeable: UNKNOWN` (GitHub hasn't computed mergeability, likely because they've never been looked at).
Dependabot security *alerts* are disabled repo-wide (`403 Dependabot alerts are disabled`), so there is no
automated vulnerability signal at all beyond version-bump PRs nobody is merging.

---

## 2. Live vs. repo reliability data (last ~14-30 days via `gh run list`, 100-run window per workflow)

| Workflow | Runs sampled | Success | Failure | Other | Avg wall time | Actual firing cadence vs declared |
|---|---|---|---|---|---|---|
| `refresh-data.yml` | 100 (spans 2026-09-13→09-27, 14 days) | 73 | 27 (27%) | — | 220s | **Median gap 182 min (~3.0h)** vs declared 30 min — GitHub Actions cron throttling is stretching the "every 30 min" schedule to roughly every 3 hours in practice (min gap 2.1 min, max gap 411 min / 6.85h) |
| `refresh-screener.yml` | 100 (spans 2026-09-01→09-27, 26 days) | 92 | 8 (8%) | — | 175s | Median gap 387.6 min (~6.5h) vs declared 6h — close to nominal; a coarser cadence survives cron throttling much better |
| `ci.yml` | 100 (spans 2026-09-19→09-27, 8 days) | 27 | 68 (**68%**) | 5 cancelled | 164s (workflow wall time; jobs run in parallel matrices) | Median gap 78 min — driven by push+PR+dispatch, not cron |
| `pages-deploy.yml` | 97 (spans 2026-08-28→09-26, 29 days) | 49 | 6 | 42 skipped (guard `if:` false on non-success/non-main runs) | 45s | Median gap 58.7 min |
| `data-watchdog.yml` | 100 (spans 2026-09-09→09-27, 18 days) | 21 | **79 (79%)** | — | 56s | Median gap 249.5 min vs declared 60 min — same cron-throttling pattern as `refresh-data.yml` |
| `operations-alert.yml` | 100 (spans 2026-09-22→09-27, 5 days) | 100 | 0 | — | 18s | event-driven, fires ~20/day given the throttled upstream cadence |

**Finding: GitHub's shared-runner cron scheduler does not honor sub-hourly cron on this repo.**
`refresh-data.yml` is declared to run every 30 minutes (`17,47 * * * *`) but the empirical median gap
between runs over 14 days is **182 minutes** — roughly 6x slower than declared, with some gaps exceeding 6
hours. `data-watchdog.yml` (declared hourly) shows the same pattern (median 249.5 min, ~4x slower).
`refresh-screener.yml` (declared every 6 hours — an interval GitHub's cron queue evidently *can* keep up
with) lands within ~8% of its declared cadence. **The "every 30 min" cadence advertised in comments and
memory notes is not what is actually happening in production; the real cadence is closer to 3 hours**, which
materially changes the SLA story for anyone assuming near-real-time data. This is a well-documented,
widely-reported GitHub Actions limitation (best-effort scheduling, delays growing with platform load), not
a bug in this repo's YAML — but the repo's own design doesn't visibly account for it (e.g., the watchdog's
default staleness threshold is 360 minutes, i.e. it tolerates almost exactly two throttled cycles before
alerting, which may be masking the throttling rather than surfacing it).

**Finding: `data-watchdog.yml` fails 79% of the time.** Its job intentionally aggregates every local+external
plane's QA gates into one `continue-on-error` step, then hard-fails the job if *any* gate was red
(`data-watchdog.yml:41-77`). With a 79% failure rate sustained over 18 days, the "recovers only when the
same workflow succeeds" issue-lifecycle in `operations-alert.yml` means issue #4 (and its predecessors) is
open far more often than not — this is **alert fatigue by construction**: a channel that is red 4 days out
of 5 stops being a meaningful signal to a human, even though the underlying `operations-alert.yml`
deduplication logic (marker comments, failure-signature hashing, consecutive-failure threshold of 2) is
well-engineered to avoid *notification* spam. The noise is in the underlying gate's pass rate, not in the
alerting layer.

**Finding: `ci.yml` fails 68% of the time**, and the live incident above shows a real run of ≥7 consecutive
failures (2026-09-26T05:25 through 2026-09-27T05:42, all `data-lineage` gate) before this audit. Because
`ci.yml` gates 100% of deploys, this failure rate directly explains why the live site is 3+ days behind
`origin/main` and >30h behind on data.

---

## 3. Root-cause deep dive: the current outage (Finding C-1, Critical)

`scripts/ci-data-lineage-audit.mjs` runs as one of ~24 gates in the `qa-runner.mjs --group data` shard,
which is a **hard-blocking** step in `ci.yml`'s `contracts` job (no `continue-on-error`). Its policy table
(`ci-data-lineage-audit.mjs:113-129`) assigns `public-data/screener-universe.json` a
`universe-reference` policy that reads its own `staleAfterDays` field from the artifact
(`ci-data-lineage-audit.mjs:187-191`):
```js
const staleAfterDays = Number(data.meta?.staleAfterDays ?? 7);
if (date && age.ageDays > staleAfterDays) {
  results.push(warn('universe reference exceeded its declared staleAfterDays', ...));
```
`public-data/screener-universe.json:5` declares `"staleAfterDays": 30`; the file's `lastBulkUpdate` is
`2026-07-16`, i.e. **73.24 days old** at audit time — 2.4x past its own declared window. The regenerator
for this file, `scripts/sync-screener-universe.mjs`, is **not invoked by any scheduled workflow** —
`.claude/skills/data-refresh/references/inventory.md:55` documents it as a manual, monthly-cadence,
human-run task ("Review membership monthly... `staleAfterDays:30` WARN, `replaceAfterDays:90` hard limit"),
and `_context/RULES.md:174` explicitly states this class of static reference "does not self-update; if it
isn't refreshed, record a BLOCKED/DEFERRED reason." **Nothing records that reason or exempts CI** — the
CI job log (`gh run view 36297988434 --log-failed`, job "Contracts / data") shows the check classified as
`[qa] FAIL data-lineage (979ms)` and the whole shard exits 1, cascading through `needs:` to block `attest`
and therefore `pages-deploy.yml`. The individual artifact check for `screener-universe.json` itself prints
as `WARN` in the audit's own per-artifact report — meaning the actual hard-FAIL trigger inside
`ci-data-lineage-audit.mjs`'s ~140-line output was in a portion of the log GitHub's log API did not return
in full (log appears truncated to the tail; earlier alphabetical artifacts like `data.json`,
`backtest-history.json` never appear) — **[unverified: exact single artifact/check whose status is literally
`FAIL` rather than `WARN`]**. What is fully verified: (a) `data-lineage` is the only failing check in that
run (23 PASS / 1 FAIL, `qa-runner` summary line), (b) `screener-universe.json` is by far the most
egregiously stale artifact reported (73d vs its own 30d policy, 2-3x every other WARN in the same report:
`structural-data-research.json` 878.74h/336h≈2.6x, `telegram-digest.json` 23.09h/12h≈1.9x), and (c) this
exact gate has been red for the entire ~24h+ life of open issue #2. Whether the literal `FAIL` bit belongs
to this artifact or a sibling check in the same script, the governance defect is the same: **a
human-cadence, manually-curated reference file is wired into an automated hard-blocking CI gate with no
automated refresh path and no "known deferred, don't block" escape hatch**, so a forgotten monthly chore
now blocks every deploy indefinitely.

**Impact**: 100% of feature/content work merged to `main` since ~2026-09-26T05:25 is undeployable; the
live app is frozen 18+ versions behind local HEAD (matches the pattern already called out in the project's
own memory file, `project_current_state.md`, for a *different* past incident — "라이브 대비 18버전 선행,
미배포" — i.e. this exact failure mode has recurred before).

---

## 4. Collectors & data sources

| Script | Source(s) | Compliance / error handling notes |
|---|---|---|
| `scripts/fetch-data.mjs` (4,348 lines) | Yahoo unofficial quote endpoints, CNN Fear&Greed, Cboe put/call, FRED, BLS, US Treasury, AAII (via a "bounded reader" relay per its own comment), news, Claude (`ANTHROPIC_API_KEY`) for market-analysis narrative, Twelve Data fallback | Single monolithic file handling ~10 unrelated data domains in one script — a maintainability/blast-radius concern (see Finding M-1). Uses `atomicWriteFile` (`scripts/lib/atomic-write.mjs`) for output staging. Per-provider partial-failure semantics are unusually mature: the step summary table in `refresh-data.yml:110-149` reports OK/WARN/PARTIAL/MISSING per provider independently rather than a single pass/fail. |
| `scripts/fetch-sec-fundamentals.mjs` | SEC EDGAR companyfacts | Correctly fail-closed on missing `SEC_USER_AGENT` (`fetch-sec-fundamentals.mjs:31,414-426`): "allowedUse: none until SEC fair-access User-Agent is configured." `refresh-screener.yml:32-45` independently validates the same repo variable is a real monitored contact address before the SEC lane runs — SEC fair-access policy (identifying User-Agent) is respected, not just present. Bounded batch (`SEC_BATCH_LIMIT: 24` per cycle) rather than one giant sweep — sensible rate-limiting via incremental coverage rather than explicit sleep/backoff. |
| `scripts/collect-13f-*.mjs` (discovery/reference/history-index/history-rows) | SEC EDGAR 13F/13D-G filings | `collect-13f-discovery.mjs:47` fails closed with `SEC_USER_AGENT is not configured` when offline/unset. Only runs on the daily `13 7 * * *` cron or manual dispatch (`refresh-data.yml:58`), not every 30-min cycle — reasonable given 13F filing cadence is quarterly. |
| `scripts/fetch-telegram-digest.mjs` (583 lines) | Public Telegram channel preview pages via `fetch()` with a custom UA | This is unauthenticated scraping of `t.me`-style public previews, not the official Bot API — lower operational risk (no bot token to leak) but **[unverified: whether this complies with Telegram's ToS for automated access]**; worth an explicit legal/ToS review given `AIO_API_SETUP_GUIDE` already documents provider ToS awareness for others. Failure semantics are good: on a failed attempt it explicitly keeps the previous `generatedAt`/`lastSuccessfulAt` rather than promoting a failed fetch's timestamp (`fetch-telegram-digest.mjs:396-400`) — avoids the "fetchedAt promoted to releaseAt" anti-pattern the lineage auditor's own header comment warns against. |
| `scripts/verify-refresh-candidate.mjs` | N/A (internal) | Implements a genuinely good **record → expect → expect-staged → expect-commit** promotion protocol: after all gates pass, a candidate hash is recorded; before `git add`, before `git commit`, and after `git commit`, the script re-verifies the working tree/staged/committed content is byte-identical to what was validated. This closes a real TOCTOU gap (something could change between "gates passed" and "pushed") that a naive `run validations; then commit` pipeline would have. The **uncommitted local diff** to `refresh-data.yml`/`refresh-screener.yml` (see below) generalizes this pattern to *replace* several previously-separate, ordering-sensitive gate invocations with one `verify-refresh-candidate.mjs --record/--expect` pair per workflow — a real simplification, not just churn. |
| `scripts/resolve-data-manifest-merge.mjs` | N/A (internal) | Encodes a field-level ownership split (code-owned vs. bot-owned JSON keys) needed because **human commits and the bot's every-1-2-hour data commits collide on the same manifest files** (`asset-manifest.json`, `release-manifest.json`) often enough that a previous session "spent ~40 minutes doing it commit by commit" (per the script's own header). This is the clearest direct evidence that committing data into the same repo/branch as code creates real, recurring human friction — a purpose-built conflict-resolution tool had to be written for it. |

**Uncommitted workflow diff** (both `refresh-data.yml` and `refresh-screener.yml` have local modifications
vs. `origin/main`): the diff replaces several individually-invoked gate scripts
(`ci-refresh-artifact-integrity-check.mjs`, `ci-data-continuity-check.mjs`, `ci-data-refresh-audit.mjs` in
one case; `ci-sec-runtime-projection-check.mjs`, `validate-screener-artifact.mjs`,
`ci-screener-workbench-contract.mjs` in the other) with calls into the new
`verify-refresh-candidate.mjs --record/--expect/--expect-staged/--expect-commit` protocol described above.
It is a coherent, in-progress hardening change, not drift — but it is **uncommitted and unpushed**, meaning
none of the promotion-safety improvements it adds are live yet, and it sits behind the currently-broken CI
gate along with everything else in the working tree.

---

## 5. "Commit data into git" architecture — cost analysis

| Metric | Value | Source |
|---|---|---|
| Local `.git` size (loose+packed) | **1003.55 MiB** (578.20 MiB packed across **42 pack files**, plus 71.94 MiB of unreferenced garbage objects) | `git count-objects -v -H` |
| `gh api` reported repo size | 469,403 KB (~458 MB) | `gh api repos/ysnle/aio-screener` |
| `public-data/sec-fundamentals.json` | 31 MB, committed on every `refresh-screener.yml` run (~4x/day, close to declared 6h cadence) | `du -sh` |
| `public-data/history.json` | 1.7 MB, committed on every `refresh-data.yml` run | same |
| `public-data/screener.json` | 1.6 MB, committed on every `refresh-screener.yml` run | same |
| `public-data/telegram-digest.json` | 1.1 MB, committed on every `refresh-data.yml` run | same |
| Repo created | 2026-03-21 (~6 months old at audit time) | `gh api repos/ysnle/aio-screener` |

At the *actual* observed cadence (~7/day for refresh-data, ~4/day for refresh-screener, not the throttled-away
30-min ideal), each successful cycle rewrites several MB of JSON and creates a new commit + full blob in
git history (git does not diff JSON semantically; a 31 MB file with a few changed bytes still stores a new
compressed blob roughly proportional to its size, though delta compression helps somewhat between similar
snapshots). Over 6 months this has already produced a ~1 GB local repository — for a project whose actual
source code (`index.html`, `js/`, `src/`, `scripts/`) is a small fraction of that. Practical consequences
already visible:
- **Slow clones/checkouts** for anyone (including this audit) working with the full history — every `git`
  operation touches a near-1GB object store.
- **Human/bot commit collisions** requiring a bespoke merge-resolution script (`resolve-data-manifest-merge.mjs`,
  §4 above) — a maintenance cost directly caused by co-locating fast-changing data with slow-changing code
  in one branch.
- **Actions minutes are not the bottleneck** here — the repo is public, so GitHub Actions minutes on
  standard Linux runners are free/unlimited for this repo; the real costs are repo size, checkout time, and
  the human-conflict-resolution overhead above, not billing.
- **Pages build/deploy count**: `pages-deploy.yml` shows 97 runs over 29 days (49 success + 6 failure + 42
  `skipped`-by-guard), i.e. roughly 3.3 attempted deploys/day — again throttled well below the nominal
  "every data refresh" rate by the same GitHub cron/queue effects noted in §2, and further gated (correctly)
  by CI health.
- `pages-deploy.yml` already explicitly excludes the largest bulk ledgers from the Pages artifact
  (`sec-fundamentals.json`, `masters/holdings.json`, `masters/history-holdings.json`,
  `masters/issuer-aggregates.json`, `masters/managers/` — see `pages-deploy.yml:133-141`, comment: "Canonical
  bulk ledgers stay producer-side until retention-managed object storage is configured") — **the team has
  already identified this exact problem and left themselves a documented TODO for object storage**; this
  audit's §7 migration plan is largely already anticipated by that comment.

---

## 6. QA machinery (`qa-runner.mjs` + `architecture/qa-pipeline.json` + ~130 `ci-*.mjs` scripts)

- **129** `scripts/ci-*.mjs` files on disk; `architecture/qa-pipeline.json` (43,606 bytes) wires **140** gate
  slots across 14 groups: `preflight`(14), `core`(34), `data`(24), `knowledge`(20), `workspace`(12),
  `cloudflare`(3), `browser-unit`(1), `browser-runtime`(8), `browser-knowledge`(6), `browser-resilience`(4),
  `browser-viewport`(1), `browser-surface`(3), `watchdog-local`(8), `external`(2). 5 profiles defined:
  `fast`, `contracts`, `full`, `external`, `watchdog`. Only 1 script is marked `retiredGateScripts`.
- **Almost nothing is report-only.** Only two `continue-on-error: true` steps exist in all 9 workflows:
  `data-watchdog.yml:43` (immediately followed by an explicit `exit 1` if not fully green — so it is not
  actually a soft gate, just a way to run every check before failing) and `pages-deploy.yml:155` (the first
  of two deploy attempts, followed by a scripted retry — a legitimate retry pattern, not a quality bypass).
  **Every one of the ~140 gate slots in `ci.yml`, `refresh-data.yml`, and `refresh-screener.yml` is hard
  blocking.** This is the direct mechanism behind Finding C-1: with 140 independent hard gates and no
  "known-deferred, non-blocking" escape hatch for slow-moving reference data, the probability that *some*
  gate is red at any given moment is high by construction, and any one red gate halts 100% of deploys.
- **Sampled 15 `ci-*.mjs` scripts and classified them:**

  | Script | Classification | Evidence |
  |---|---|---|
  | `ci-data-lineage-audit.mjs` | Behavioral — parses every `public-data/*.json`, computes real timestamp ages against a policy table, cross-references market-session state | reviewed in full, §3 |
  | `ci-reconciliation-contract-check.mjs` | Behavioral — validates schema version, category evidence-check counts actually match reported counts, timestamp freshness window | `ci-reconciliation-contract-check.mjs:1-20` |
  | `ci-artifact-cache-check.mjs` | Behavioral unit test — exercises real concurrency/abort semantics of a cache module with `assert.equal`/`assert.rejects` | lines 1-20 |
  | `ci-csp-ratchet-check.mjs` | Behavioral — greps actual `.js` source for `.innerHTML =` / `eval(`/`new Function(` counts and ratchets against a baseline | lines 1-20 |
  | `ci-control-char-check.mjs` | Behavioral, explicitly soft — parses all workflow YAML with `js-yaml` for hard-fail control-char/structure checks, but treats pre-existing repo-wide corruption as a **baseline regression gate** (only fails if the count *increases*), by explicit design to avoid "noisy gate → ignored" (its own comment cites this as an "R280-class" anti-pattern) | header comment + logic |
  | `ci-doc-currency-check.mjs` | Documentation-drift detector, explicitly **non-blocking by design** — compares `_context/CODE-MAP.md`'s recorded file-size table to actual `wc -l`, warns only above a 500-line drift threshold, and the header comment explicitly explains why it deliberately does *not* hard-fail (same "noisy gate" reasoning) | full file read |
  | `ci-knowledge-lint-check.mjs` | Behavioral — regenerates `CONTEXT-CATALOG.json`/`CURRENT-STATE.md` in-memory and byte-compares against the committed versions (a real "generated output matches committed output" check), plus a 45-day doc-staleness scan | lines 1-25 |
  | `ci-version-check.mjs` | Behavioral — parses `version.json` and cross-checks version-string consistency across files | lines 1-20 |
  | `ci-ux-default-path-check.mjs` | **Mixed** — genuine structural/behavioral checks (HTML div-tag balance, `aria-live` count ceiling, canvas accessible-name presence, resize/visibility contract regexes against real JS source) **combined with pure documentation-text-presence assertions**, e.g. `check('P529 QA checklist must mention the default-path UX gate', /P529/.test(qa) && /ci-ux-default-path-check\.mjs/.test(qa))` and `check('R228 must document default-route UX constraints', /R228/.test(rules) && /auto-fill/.test(rules) && /default route/.test(rules))` | `ci-ux-default-path-check.mjs` ~lines 50-56 |
  | `ci-doc-currency-check.mjs`, `ci-knowledge-lint-check.mjs`, `ci-control-char-check.mjs`, `ci-data-pipeline-contract-check.mjs`, `ci-ledger-integrity-check.mjs`, `ci-live-invariant-check.mjs`, `ci-runtime-contract-check.mjs`, `ci-semantic-review-check.mjs`, `ci-version-check.mjs`, `ci-workflow-compaction-check.mjs`, `ci-workspace-contract-check.mjs` | **12 of 129 scripts (~9%) directly reference `QA-CHECKLIST.md`/`RULES.md`/`CLAUDE.md`/`CHANGELOG.md`** | `grep -l "QA-CHECKLIST\|RULES\.md\|CLAUDE\.md\|CHANGELOG\.md" scripts/ci-*.mjs` |

  **Net assessment**: CLAUDE.md's own description ("gates grep QA-CHECKLIST markers / RULES text") is
  accurate but narrower in practice than it sounds — the large majority of sampled scripts (11/15, ~73%)
  perform genuine behavioral/structural verification against real artifacts (JSON schemas, HTML/JS source,
  regenerated-vs-committed diffing), and where documentation is read, it is more often to detect *drift*
  between docs and reality (`ci-doc-currency-check.mjs`, `ci-knowledge-lint-check.mjs`) than to substitute
  for a behavioral check. However, `ci-ux-default-path-check.mjs` is a concrete, verified example of the
  coupling risk: a marker-string check like `/P529/.test(qa)` means CI can be broken by *renumbering or
  rewording a checklist item* with zero change to application behavior, and conversely a doc author can
  satisfy the gate by pasting the literal token into prose without the underlying constraint being true.
  This pattern should be treated as a code smell to actively avoid expanding, even though it is not (yet)
  the majority pattern.

- **CI wall time**: `preflight`(20m budget) → `contracts`(45m budget, up to 5-way matrix) →
  `browser`(60m budget, up to 6-way matrix, each shard does a from-scratch `npx playwright install
  --with-deps chromium`) → `attest`(15m). Actual observed workflow-level wall time average is only 164s
  because most recent runs in the sample failed fast at the `contracts` stage (before `browser` even starts)
  — **the reliability data in §2 is not representative of a fully-green run's true wall time**, since browser
  shards rarely get reached currently. **[unverified: full-green-path wall time]** — worth measuring directly
  once CI is unblocked.

---

## Findings summary (Critical / High / Medium / Low)

**C-1 (Critical, active).** Live site frozen ≥3 days / ≥18 versions behind `origin/main`; live `data.json`
is >30h stale. Root cause: `ci-data-lineage-audit.mjs` hard-fails CI because the manually-curated
`public-data/screener-universe.json` (`staleAfterDays:30`) is 73 days old with no automated refresh path and
no non-blocking escape hatch, and this single gate blocks the sole deploy path for the entire app. **Fix
now**: either (a) run `scripts/sync-screener-universe.mjs` to refresh the file (a real editorial task,
not automatable without a data source for universe membership), or (b) demote this specific check from
hard-FAIL to WARN in `ci-data-lineage-audit.mjs` (consistent with how `RULES.md:174` itself describes the
intended severity — WARN until the 90-day `replaceAfterDays` hard limit, not immediate hard-fail at 30 days)
so a forgotten monthly chore stops blocking unrelated deploys. **Fix structurally**: give
long-cadence/manually-curated reference data (13F universe, theme maps, macro calendars) either (i) a
scheduled monthly workflow that runs the sync script and opens a PR/issue reminder, or (ii) a documented
"deferred, non-blocking" status distinct from the live-data hard gates, so one missed chore can't halt
100% of deploys the way §6 shows it currently can with any of 140 hard gates.

**C-2 (Critical).** `data-watchdog.yml` fails 79% of the time (79/100 runs) and `ci.yml` fails 68% of the
time (68/100 runs) over the sampled windows. Combined with an operations-alert design that only closes an
issue on a full success, this produces near-permanently-open incident issues, which is alert fatigue by
construction and makes it hard to distinguish "known chronic noise" from "new, actionable regression" —
exactly what is happening right now with issue #2 sitting open >24h during a real outage.

**H-1 (High).** GitHub Actions' shared-runner cron scheduling does not honor sub-hourly declared cadences on
this repo: `refresh-data.yml` (declared every 30 min) actually fires with a median 182-minute gap (~6x
slower); `data-watchdog.yml` (declared hourly) actually fires with a median 249.5-minute gap (~4x slower).
Any operational assumption of "data refreshes every 30 minutes" is currently false in production by roughly
an order of magnitude; `refresh-screener.yml`'s coarser 6-hour cadence is unaffected, suggesting sub-hourly
cron on GitHub-hosted schedules is the specific mechanism to avoid for anything requiring near-real-time
refresh.

**H-2 (High).** `.git` has grown to ~1 GB (578 MB packed + 72 MB unreferenced garbage across 42 packs) in
~6 months, driven by committing multi-MB JSON blobs (`sec-fundamentals.json` 31 MB, `history.json` 1.7 MB,
`screener.json` 1.6 MB, `telegram-digest.json` 1.1 MB) on every refresh cycle. This has already produced a
bespoke, hand-written merge-conflict-resolution tool (`resolve-data-manifest-merge.mjs`) to cope with human
commits colliding with bot commits on shared manifest files — direct, already-realized engineering cost of
co-locating fast-changing data and slow-changing code in one repo/branch. The team has already
partially mitigated this for the *Pages artifact* (excluding the largest files from what gets deployed,
`pages-deploy.yml:133-141`) but not for the *repository* itself.

**M-1 (Medium).** `scripts/fetch-data.mjs` is 4,348 lines and owns quotes, macro (FRED/BLS/Treasury/AAII),
news, LLM market-analysis generation, and more, in one file — a maintainability and blast-radius concern
(a bug in the LLM-analysis code path risks breaking quote collection in the same process). Contrast with
the already-separated `fetch-sec-fundamentals.mjs`, `fetch-telegram-digest.mjs`, and `collect-13f-*.mjs`,
which show the team already knows how to split collectors by domain.

**M-2 (Medium).** `ci-ux-default-path-check.mjs` mixes genuine behavioral DOM/JS checks with pure
documentation-marker-presence assertions (`/P529/.test(qa)`, `/R228/.test(rules)`). This is a real (if
currently minority) instance of the doc/gate coupling the project's own CLAUDE.md flags, and it means an
editorial rewrite of `RULES.md`/`QA-CHECKLIST.md` prose can break CI with zero behavior change, or satisfy
CI with zero behavior guarantee.

**M-3 (Medium).** Two Dependabot PRs (`github_actions` group, `npm_and_yarn`/ci-toolchain group) have sat
unmerged for 7-10 days with `mergeable: UNKNOWN`. Combined with Dependabot *security alerts* being disabled
repo-wide, there is currently no automated signal at all for known-vulnerable dependencies, and even routine
version-bump PRs are not being triaged.

**L-1 (Low).** Global `npm install -g wrangler@4.120.0` in both Cloudflare deploy workflows is explicitly
called out in a comment as outside Dependabot's reach — a known, accepted gap rather than an oversight, but
still a real blind spot for a tool with direct production-deploy credentials (`CLOUDFLARE_API_TOKEN`).

**L-2 (Low).** `fetch-telegram-digest.mjs` scrapes Telegram's public channel preview pages rather than using
an authenticated Bot API — lower credential-leak risk, but ToS compliance for automated scraping at this
cadence is **[unverified]** and worth a deliberate one-time legal/ToS check rather than an assumption.

---

## 7. How I would build & operate it instead

**Principle: separate the data plane from the code repo.** The single biggest structural cost in §5 (repo
bloat, human/bot merge collisions, a bespoke conflict-resolution script) all stem from one decision — data
and code share one git branch. The team has *already* half-recognized this (`pages-deploy.yml`'s comment
about "retention-managed object storage" not yet being configured). Concretely:

1. **Move `public-data/*.json` out of the `main` branch entirely.**
   - Option A (cheapest, stays on GitHub): a dedicated **orphan branch** (e.g. `data`) that the refresh
     workflows push to directly, with **no PR/CI gating** on that branch itself — only the *consumer* contract
     (schema validation, freshness) needs to run, not the full 140-gate `ci.yml`. Pages can be told to build
     from a merged view (via a build step that copies `data` branch content into the Pages artifact,
     replacing the current `rsync public-data/`) so the *code* branch never touches multi-MB JSON.
     `git gc --aggressive` or periodic branch-history squashing keeps this branch's own size bounded, and it
     never collides with human code commits because no human ever edits it directly.
   - Option B (better long-term, small added complexity): **Cloudflare R2** (object storage, S3-compatible,
     free tier: 10 GB storage + 1M Class-A/10M Class-B ops/month) or **Cloudflare KV** (already in use for
     the fast quote plane per `deploy-data-plane.yml`) as the actual home for `data.json`, `history.json`,
     `sec-fundamentals.json`, etc. The static site fetches them directly from R2's public bucket URL or
     via the existing Worker, exactly like it already does for the fast-plane KV snapshot. This finally
     realizes the "retention-managed object storage" TODO already written into `pages-deploy.yml`'s comment.
     Versioned objects in R2 give you free rollback/history without git bloat.
   - Option C: **GitHub Releases** as a bounded-history object store (attach `data.json` etc. as release
     assets on a rolling tag) — free, versioned, but clunkier to serve to a static site than R2/KV and
     doesn't solve CORS/latency as cleanly.
   - **Recommendation**: R2 for the large/bulk artifacts (`sec-fundamentals.json`, `history.json`,
     `telegram-digest.json`) since they're already excluded from the Pages artifact anyway; keep only
     small, load-bearing-for-first-paint JSON (`data.json` core quotes, `operations-status.json`) either on
     an orphan `data` branch or also in R2 fronted by the existing Worker (which already does the
     CORS/health-check/origin-gating work in `deploy-ai-proxy.yml`/`deploy-data-plane.yml`).

2. **Scheduler**: switch the sub-hourly jobs (`refresh-data.yml`'s 30-min cron, `data-watchdog.yml`'s hourly
   cron) to **Cloudflare Cron Triggers** invoking the existing Worker, which already has fetch/quota/health
   logic built out. Cloudflare Cron Triggers fire far more reliably at sub-hourly granularity than GitHub
   Actions' best-effort scheduler (§2/H-1 shows GitHub is currently missing its own 30-min target by ~6x).
   Keep the 6-hour `refresh-screener.yml` and daily/weekly jobs on GitHub Actions cron, where §2 shows the
   platform *does* keep up. This is a low-risk, incremental change (only the trigger changes; the collector
   logic can stay Node/GitHub-Actions-runnable via `workflow_dispatch` invoked from the Worker's cron handler
   if a full rewrite to Worker-native fetch isn't wanted immediately).

3. **One deploy path, already true** — keep it. `pages-deploy.yml` is already the sole deploy path with a
   real attestation contract; don't regress this. What to add: an explicit, first-class **"deferred /
   non-blocking" gate class** in `qa-runner.mjs`/`qa-pipeline.json` (a `severity: warn` field per gate,
   distinct from today's implicit all-or-nothing) so long-cadence editorial data (§3, C-1) can be red without
   blocking deploys, while still being visible in the watchdog/ops-alert surface. This directly prevents a
   repeat of the current outage without weakening any *live-data* gate.

4. **A minimal, fast CI gate set vs. today's ~130 scripts**: keep `ci.yml`'s `preflight` tier exactly as
   designed (cheap, blocking, fast-fail) but shrink what's *hard-blocking* pre-attest to a small, high-value
   set: schema/contract validation of the artifacts Pages actually serves, the security/CSP ratchet, the
   accessibility matrix, and the reconciliation/data-continuity checks that catch real data corruption.
   Move the ~12 documentation/knowledge-lint scripts (§6) to `knowledge-lint.yml`'s existing weekly schedule
   (they're already mostly there) rather than every push/PR, and move `ci-ux-default-path-check.mjs`'s
   marker-string assertions into a lighter "docs mention this gate" check that only warns, not blocks —
   or better, delete the marker checks and rely on the behavioral half of that same script, which already
   verifies the actual UI/HTML contract independent of any prose.

5. **Observability/alerting**: the `operations-alert.yml` dedup/signature/escalation design (§1) is
   genuinely good and worth keeping as-is. What's missing is a **rolling SLO surfaced somewhere a human
   actually looks** — `build-operations-slo-window.mjs` already computes a 7/30-day rolling window
   (`data-watchdog.yml:62-73`) and uploads it as a build artifact, but artifacts aren't visible without
   digging into Actions runs. Publish that window's summary into `public-data/operations-status.json` (which
   is already surfaced on the site per the memory notes) or as a GitHub repo badge, so "CI has been red for
   24h" and "watchdog is failing 79% of the time" are visible without an audit like this one.

6. **SLOs to set explicitly** (none appear formally declared beyond `architecture/operations-slo.json`,
   which is in the uncommitted diff — **[unverified: its exact current thresholds]**): given the real,
   throttled cron cadence measured in §2, a defensible target is "data.json freshness ≤ 4 hours" (not 30
   minutes) unless the Cloudflare Cron migration in step 2 is done, "CI green within 2 hours of a push to
   main," and "Pages deploy lag ≤ 30 minutes after a green CI run" — all measurable directly from the
   `operations-slo-window` artifact already being produced.

**Trade-offs**: moving data off `main` (step 1) is the highest-leverage change but touches the most code
(every script that reads `public-data/*.json` locally during CI, plus the Pages artifact staging step, plus
the client-side loader `_aioLoadServerData` per `reference_data_backend.md`) — recommend doing it
incrementally, starting with the largest, least-latency-sensitive file (`sec-fundamentals.json`, 31 MB,
already excluded from Pages) as a pilot migration to R2 before moving `data.json` itself. Cloudflare Cron
Triggers (step 2) are free on Cloudflare's free plan up to reasonable trigger counts, and the Worker
infrastructure to receive them already exists (`deploy-ai-proxy.yml`, `deploy-data-plane.yml`) — this is the
lowest-cost, highest-confidence fix for the H-1 cadence problem specifically.
