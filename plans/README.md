# Implementation Plans

Written 2026-11-10 against commit `813371fc5` (v59.93, local `main`) with the shadcn/improve method: audit → vet →
plan → hand to an executor → review the diff. Executors: Claude Opus 5.5 at medium effort (owner's choice), each
implementation plan in its own git worktree; the audits are read-only. The reviewer (the session that wrote these)
maintains this index, re-runs each plan's done criteria, and integrates.

`_executor-rules.md` and `_audit-common.md` are the shared blocks that were inlined into every plan (each plan file
is self-contained; edit the plan, not only the shared block).

## Execution order & status

| Plan | Title | Priority | Effort | Risk | Depends on | Status |
|------|-------|----------|--------|------|------------|--------|
| 001 | Refresh degradation gate compares against the last published data.json | P1 | S | MED | — | DONE (merged, v59.94–v59.95) |
| 002 | publish-data-commit gate passes on Windows | P1 | S | LOW–MED | — | DONE (merged, v59.94–v59.95) |
| 003 | Earnings calendar records its failed queries | P2 | S | LOW | — | DONE (merged, v59.94–v59.95) |
| 004 | CI dispatch concurrency and input handling | P2 | S | MED | — | DONE (merged, v59.94–v59.95) |
| 005 | CODE-MAP anchors instead of stale line numbers | P2 | M | LOW | — | DONE (merged, v59.94–v59.95) |
| 006 | Pages skips artifacts no browser reads | P3 | S–M | MED | — | DONE (merged, v59.94–v59.95) |
| 007 | Remove dead legacy functions and write-only globals | P3 | M | LOW–MED | — | DONE (merged, v59.94–v59.95) |
| 008 | Remove unreachable src/script code | P3 | M | LOW | — | DONE (merged, v59.94–v59.95) |
| 009 | One cached reader for earnings-calendar.json | P3 | M | MED | — | DONE (merged, v59.94–v59.95) |
| 010 | Three small verified defects (listeners, FX rounding, guard) | P3 | S | LOW | — | DONE (merged, v59.94–v59.95) |
| 011 | Audit — UI pages and components | P2 | M | none | — | DONE (merged, v59.94–v59.95) |
| 012 | Audit — domain, AI context, app shell | P2 | M–L | none | — | DONE (merged, v59.94–v59.95) |
| 013 | Audit — gates and producers | P2 | L | none | — | DONE (merged, v59.94–v59.95) |
| 014 | Audit — Worker ledger and data plane | P2 | M | none | — | DONE (merged, v59.94–v59.95) |
| 015 | The :50 market-data refresh is dispatched again | P1 | S | LOW–MED | 014 finding | DONE (merged, v59.95) |
| 016 | AI action gate catches comma, unit and range prices | P1 | S | LOW–MED | 012 finding | DONE (merged, v59.95) |
| 017 | A released event leaves the upcoming list | P2 | S | LOW | 012 finding | DONE (merged, v59.95) |
| 018 | Numeric-evidence check sees unit-less prices | P2 | S–M | MED | 012 finding | DONE (merged, v59.95) |
| 019 | UI direction follows the printed value; refresh repaints; weights hover | P2 | M | LOW | 011 finding | DONE (merged, v59.95) |
| 020 | Producers keep or flag missing inputs (TW revenue, KR weights) | P2 | S | LOW | 013 finding | DONE (merged, v59.95) |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

## Result (2026-11-10)

All sixteen implementation plans were executed by Opus 5.5 (medium) in worktrees, reviewed diff by diff, merged into local `main` and recorded as v59.94 (P2338) and v59.95 (P2339–P2353). `node scripts/qa-runner.mjs full --no-cache --keep-going` on the integrated tree: 200 pass, 0 fail. Nothing was pushed. Audits 011–014 produced 17 findings; the confirmed ones became plans 015–020.

## Open follow-ups (not done)

- Same raw-sign pattern left at: `market-story.js` (bars value text), `korea-participation.js` `pc()` and the flow column class, `screener/validation-tab.js` (two sites), `theme-playbook-view.js`, `portfolio-backtest-lab.js`, `themes/sectors.js` (thp-perf-bar), the inspector's `scr-why-move` class.
- `src/app/bootstrap.js` and two pages subscribe to `aio:macroUpdated` / `aio:themesHistoryLoaded`, which nothing dispatches.
- The pinned browser-data tree and ancestry check does not run in CI's depth-1 workspace job (`scripts/browser-data-fixture.mjs` skips when the pin commit is absent).
- OpenAI error bodies are relayed to the browser (keys masked); the code comment says this is deliberate — owner decision against the "error detail never reaches the client" policy.
- The Actions non-search AI client times out at 30 s while the Worker allows 60 s.
- `scripts/producer/screener.mjs`: two catch blocks around `fetchHistory` can never run, so a failed index read leaves no log line.
- Source-text pins that cannot detect the regression they cite (four named in the 013 audit).
- Silent catches around cross-module render calls (011 audit UI-05).
- Not audited: most of `src/domain` beyond the files named in the 012 report, about 180 of the 200 gate scripts, several producers.

## Dependency and overlap notes

- No plan needs another plan's result. Two files are touched by more than one plan, in different places:
  `scripts/ci-esm-core-unit-check.mjs` (008 deletes a block, 009 and 010 add assertions) and
  `scripts/agent-hook.mjs`/`scripts/ci-workspace-contract-check.mjs` (010 only). The reviewer merges the branches
  one at a time and resolves overlaps.
- Records: executors write `_artifacts/pending-records/plan-NNN/*.json`; the reviewer applies them once at
  integration (`node scripts/apply-pending-records.mjs --dry-run`, then `--apply`) as v59.94.
- After 006 is merged, re-pin the browser data fixture (`node scripts/browser-data-fixture.mjs pin`).
- Audits 011–014 produce findings only. Confirmed findings become a second round of plans (015+).
- Browser groups run once after integration (`node scripts/qa-runner.mjs affected --keep-going`), not per plan.

## Findings considered and rejected (not planned)

- **Classic boot budget counts the lazy `js/aio-glossary.js`**: accounting only, no user effect; moving it would put
  ~107 KB into the post-boot lazy budget (265 KB ceiling) and needs a new bucket in `ci-boot-interaction-check` —
  an owner decision about budgets, not a defect.
- **Service worker precaches `aio-chat.js` and `aio-glossary.js`**: may be a deliberate offline warm-up; `sw.js` is a
  cache-boundary risk path. Owner decision.
- **`user-research-digest.json` fetched at boot**: three readers in `js/aio-core.js` besides the AI panel were not
  traced; needs that trace before a plan.
- **`_artifacts` bulk (~30 MB of copies and snapshots) and `schemas/knowledge/*.schema.json`**: `_artifacts` is
  point-in-time evidence by policy and deleting it saves checkout size only (history keeps it);
  `architecture/adr-0003-layered-ownership.md` names `schemas/` as the shape canon, so wiring them into a gate is a
  direction item, not a cleanup.
- **Rate-limit bindings for `/health`, `/feedback`, Workers AI**: needs new Cloudflare namespace ids and a Worker
  deploy; low severity at family scale. Owner/operator action.
- **`ci-worker-anthropic-check.mjs` is a misnamed shim**: renaming a registry key for no behaviour change — not worth it.
- **`hour12: false` could print "24:05"**: not reproducible on current V8 for `ko-KR`; no change.
- **Unused `scripts/lib/browser-gate.mjs` `withBrowserGate`**: CODE-MAP advertises it as the shared helper; kept.
- **`getApiKey` defined twice; `_aioUppercaseInput`, `_aioChartAnalyze`, `_aioTacticalTraderFrameworkContext`**:
  each is named by a test or contract assertion; removing them means changing what those gates assert. Left.
- **Dated `_context/*-2026-0[5-7]-*.md` audit docs with no inbound link, `EVIDENCE-DEBT.md`**: catalogued history;
  moving them changes the generated catalog and doc counts for no reader benefit.
- **"대형주 몇 곳에 몰렸고" in the briefing opening**: an inferred cause stated from equal-weight vs index alone —
  product wording, owner's call.
- **Local ignored directories** (`_archive/` 54 MB, `.cache/` 253 MB, `_backup/`, `_codex-qa-cache/`, `outputs/`,
  `autoresearch-*`): not in git, so deleting them is not reversible; the owner deletes them.
- **Event-briefs / browser watchdog schedules running on closed-market days**: runner churn only on a public repo;
  events can land on weekends. Not worth the risk.
