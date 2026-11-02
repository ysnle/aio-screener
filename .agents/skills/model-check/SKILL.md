---
name: model-check
description: Run and maintain AIO's bounded exhaustive model checks (formal verification) of the AI budget ledger, the history.json session lane, the AI market-reading lifecycle, the market-session classifier, the browser auto-refresh scheduler and the artifact cache. Use when a change touches cloudflare-worker-proxy.js AIOQuotaDurableObject, scripts/producer/history.mjs, the market-narrative producer, deriveMarketSession or the market calendar, src/app/refresh-scheduler.js or src/data/artifact-cache.js, or when one of these gates fails.
---

## AIO Skill Operating Contract

Follow `.claude/skills/_shared/operating-contract.md`; reuse it if already read. A model-check pass covers the model and its bound, never the deployed service; it does not replace `post-edit-qa` tiers.

## Reference Loading Map

- The model of each check is the header comment of its script (events, invariants, out of scope). Read the header of the one you touch, not all of them.
- Coverage record: `architecture/model-check-coverage.json` (covered functions, fingerprints, `syncedAt` commit). Shared tooling: `scripts/lib/model-check-kit.mjs` (`verifyCoverage`, `importVariant`, statechart).

## Coverage

| Gate (qa group) | Command | Covers | Promise in one sentence |
|---|---|---|---|
| `ai-ledger-model` (cloudflare) | `node scripts/ci-ai-ledger-model-check.mjs` (~25 s) | `cloudflare-worker-proxy.js` `AIOQuotaDurableObject.load/save/refundClientSpend/prune/mutateQuota` | The shared AI month ledger always equals what admitted requests still owe, never refunds a started call, never passes the hard cap and never bricks AI. |
| `history-session-model` (data) | `node scripts/ci-history-session-model-check.mjs` | `scripts/producer/history.mjs` `holdRepeatedSessions`, `mergeBackfillBars` | A settled close is never overwritten and each session has one owner row. |
| `narrative-lifecycle-model` (data) | `node scripts/ci-narrative-lifecycle-model-check.mjs` | `scripts/producer/market-narrative.mjs` `genMarketAnalysis`, `applyMarketAnalysis`; `scripts/lib/market-analysis-validate.mjs` reuse/retain/quarantine helpers | A published reading marked verified passed the gate, is fresh, and a blocked input set makes no repeat model call. |
| `market-session-model` (data) | `node scripts/ci-market-session-model-check.mjs` (~30 s) | `scripts/build-market-snapshot.mjs` `deriveMarketSession`, `scheduledSession`; `src/domain/market/market-calendar.js` `isLatestUsRegularClose`, `latestCompletedUsSession`, `latestCompletedKrSession` | Over holiday, half-day and moved-hours windows, a print inside the registered session reads as in session and the latest completed close reads as a completed close. `KNOWN` pins open findings by calendar scene. |
| `refresh-scheduler-model` (core) | `node scripts/ci-refresh-scheduler-model-check.mjs` (~5 s; `AIO_SCHEDULER_DEPTH`, default 6) | `src/app/refresh-scheduler.js` `installRefreshScheduler` (whole module, fingerprinted as one) | While the tab is visible the scheduler is not paused and every task keeps a timer or a run; a hidden tab fetches nothing on its own. |
| `artifact-cache-model` (core) | `node scripts/ci-artifact-cache-model-check.mjs` (~5 s; `AIO_ARTIFACT_DEPTH`, default 6) | `src/data/artifact-cache.js` `loadJsonArtifact`, `clearArtifactCache` | A read after a manual refresh never gets a pre-refresh copy, and a forced read skips held copies. |

Sync commits live only in the coverage record; the first three were confirmed against the code at 6d29b2e0 (maintenance pass 2026-11-02), `market-session-model`, `refresh-scheduler-model` and `artifact-cache-model` were created at the same commit. Their first run found four defects: three were fixed in v59.60 (SMH calendar, KRX delayed open and 수능 window, scheduler pause restore) and their `KNOWN` lists are empty; `artifact-cache-model` still pins one low-harm finding by scene, so an unrelated break still fails.

## Does my change touch it?

Compare `git diff --name-only` with the Covers column. Each gate also fingerprints its functions and fails with `covered code changed` when they differ from the record, so running it is the reliable answer. Harm when skipped: AI budget overspend or a silent block (ledger), a wrong past close in charts (history), a stale or unverified reading shown as verified (narrative), a blocked refresh or a wrong close compared in history (market session), auto refresh silently stopping (scheduler), a pre-refresh file after a manual refresh (artifact cache).

## Run

Run the gate's command. PASS prints one JSON line: `ok`, the explored `states`/`transitions` per mode, and `variants`, each listing the invariants a deliberately broken copy of the code broke. A variant that breaks nothing fails the gate: the model lost the power to fail.

`AIO_LEDGER_DEPTH=<n>` deepens the ledger search (default 7; 8 takes minutes). `--chart <dir>` writes a Mermaid statechart (`.mmd` + `.html`) for the owner: gray edges are current behavior, red edges are a broken variant, green edges are what the current code does on the same input.

## Read a failure

A violation line is `<invariant>:<kind> xN: {"trail":[...steps...], ...}`. The trail is the shortest event sequence in the code's terms (`A 예약`, `A 호출 시작`, `시간 +2시간`, `재시작`, `다음 저장 실패`). Replay it by hand against the code before deciding:

- **Real bug**: the trail is a sequence production can produce and the stored value breaks the one-sentence promise. Report it with the trail; do not weaken the invariant or change product code unless the user asks.
- **Modeling error**: the trail needs a step production cannot take, or the bookkeeping in the script disagrees with a documented rule (for example the ledger's 3-day idempotency window). Fix the model and say so in its header; never loosen a check just to pass.
- `covered code changed`: re-read the header model against the new code (events, retention rules, invariants), update model and variants, rerun, then `--sync`.
- `KNOWN finding no longer occurs` (market session, scheduler, artifact cache): the code was fixed; delete that `KNOWN` row so the gate guards the fix.
- `variant ... anchor missing`: a variant's find-text no longer matches the code. Rewrite the variant so it still removes the same guard.

## Intended behavior change

Change the model in the header and the bookkeeping together, keep or replace each variant so every invariant still has one that breaks it, run the gate, then run with `--sync`. Move a gate's `syncedAt` forward only after confirming the model describes the code at the new commit; `--sync` records the current HEAD, so commit the covered change first (on 11-02 two thread branches ran `--sync` before committing and recorded a base commit that lacked their change).

## Not covered

Ledger: per-connection spend share and retry waivers, saver variant, legacy-month migration, daily caps, the HTTP layer and the OpenAI call. Narrative: the earnings-reaction reuse key and the big-tech cash-flow context are pinned empty. Market session: FX/futures (weekday sweep in `ci-market-snapshot-contract-check`), ^VIX/^TNX/^IRX extended hours, Tokyo/Hong Kong, PRE/POST hints, `quoteQuality`. Scheduler: page on-enter refresh, jitter values, task timeouts. Artifact cache: integrity/byte budget, stall and timeout paths, eviction, consumer abort. All: bounded depth (a pass covers the bound), stubbed clock, network and model calls. Static evidence only; live claims need the `post-edit-qa` external tier.

## Upkeep

New formal targets follow the same pattern: real functions, a header model, `verifyCoverage`, at least one variant per invariant, a qa-pipeline gate and a row in Coverage above.
