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
| 021–024 | Audits — remaining domain, gates, producers, AI path | P2 | L | none | — | DONE (findings became 029–037) |
| 025 | UI remaining raw-sign sites and dead subscriptions | P2 | M | LOW | 011 finding | DONE (merged, v59.97) |
| 026 | Worker limit bindings and Actions AI client timeout | P2 | S | LOW–MED | 014 finding | DONE (merged, v59.97; deploys with the next green "Deploy AI proxy") |
| 027 | Boot accounting, service-worker precache, research digest with the AI panel | P3 | M | MED | — | DONE (merged, v59.97) |
| 028 | Gate hygiene: pin fetch in CI, gate name, unused schemas | P3 | M | LOW | 013 finding | DONE (merged, v59.97) |
| 029 | Credit latch hold reaches every reader | P1 | S | MED | 021 finding | DONE (merged, v59.97) |
| 030 | Market wording reads the printed series and shared bands | P2 | M | MED | 021 finding | DONE (merged, v59.97; part G finished by the reviewer with the shared name as text) |
| 031 | Portfolio FX in the benchmark trend; rounded gap words | P2 | M | MED | 021 finding | DONE (merged, v59.97) |
| 032 | A typed ticker stays itself; keyword edges | P2 | S | LOW | 021 finding | DONE (merged, v59.97) |
| 033 | AI chat keeps its policy tail, stop clears pending, sessions tolerate bad turns | P1 | M | MED | 024 finding | DONE (merged, v59.97; reviewer changed the unreadable-store rule to start over) |
| 034 | AI response gates normalise and widen | P1 | M | MED | 024 finding | DONE (merged, v59.97) |
| 035 | Publish gates refuse only real degradation | P1 | M | MED | 022 finding | DONE (merged, v59.97) |
| 036 | Calendar and count gates stop expiring into outages | P1 | M | MED | 022 finding | DONE (merged, v59.97; part A done by the reviewer as warnings, per P1542) |
| 037 | Brief headline rule at the producer; SEC recheck after a newer filing | P2 | M | MED | 023 finding | DONE (merged, v59.97) |

| 038 | Follow-ups: reader-facing defects (capital tickers in AI questions, one 10-year window, watchlist tidy, stored FOMC headline, keyword edges, three sign sites, shared VIX ladder) | P2 | M | LOW–MED | round 3 | DONE (merged, v59.98) |
| 039 | Follow-ups: operations and hygiene (dead precache entries, BLS comparator gap, alert-issue rule explained, README caps, two behavioural pins) | P2 | M | LOW–MED | round 3 | DONE (merged, v59.98; HPSP left: the repository cannot tell the two codes apart) |
| 040 | — | — | — | — | — | not written: the market-reading fixes were made by the reviewer from the experiment's rejected texts (v59.99) |
| 041 | Chat: the evidence filter keeps history and definitions; what it removes is counted | P1 | M | MED | AI audit | DONE (merged, v59.99; reviewer kept last year's company results bound to evidence) |
| 042 | Chat: one owner per instruction, no length cap, low effort for explanations, search not forced for concepts, more news | P1 | M–L | MED | AI audit | DONE (merged, v59.99) |
| 043 | Chat: earlier conversations about the same subject; things the reader said are remembered | P1 | L | MED | owner request | DONE parts B, C (v59.99); part A REJECTED — a profile already exists (src/ai/session/user-profile.js) |
| 044 | Judgement latitude; figures checked against evidence instead of deleted | P1 | L | MED–HIGH | owner decision 2026-11-12 | DONE (merged, v59.99; extended to the injected data blocks in v60.01) |

| 045 | Chat data tools: the model asks for the data it needs (10 tools, 2 rounds, 6 calls) | P1 | L | MED–HIGH | owner request | DONE (merged, v60.02; live model behaviour unproven) |
| 046 | Market reading: a blocked reading loses its bad lines, not the whole text; the home sentence may judge | P1 | M | MED | AI pass | DONE (merged, v60.02) |
| 047 | Chat: a figure is supported for the subject it was given for | P2 | M | MED | AI pass | DONE (merged, v60.02; tagging rule redesigned by the executor after measuring real prompts) |
| 048 | Universe review from repository listings; registry junk; stale names; BLS footnotes | P2 | M | MED | follow-ups | DONE (merged, v60.02; KVUE and ROKU removed, OKTA relabelled; FANUY left) |
| 049 | Chat: the model decides when to search; search and data tools in one answer (Worker admission) | P1 | M–L | MED–HIGH | owner request | DONE (merged, v60.02) |
| 050 | Chat: the waiting line shows stages and time; a reload keeps the question; a run survives leaving an AI screen | P1 | M | MED | owner request | DONE (merged, v60.02) |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

## Result (2026-11-10)

All sixteen implementation plans were executed by Opus 5.5 (medium) in worktrees, reviewed diff by diff, merged into local `main` and recorded as v59.94 (P2338) and v59.95 (P2339–P2353). `node scripts/qa-runner.mjs full --no-cache --keep-going` on the integrated tree: 200 pass, 0 fail. Nothing was pushed. Audits 011–014 produced 17 findings; the confirmed ones became plans 015–020.

## Result, round 3 (2026-11-11)

Plans 025–037 were executed the same way and recorded as v59.97 (P2355–P2380). Before the round, v59.96 (P2354) fixed
a false failure of the metric-consistency gate that had stopped data releases for about six hours.

## Result, AI quality pass and the 11/12 deploy block (2026-11-12)

- v59.98: plans 038–039. v59.99: plans 041–044, the market-reading validator's four false blocks, and the deploy
  block of 2026-11-12 (the screener-universe mirror held a clock-derived word; identity fields had a 30-day budget).
  v60.01: chat answers keep figures found in their injected data; the analysis lane uses low reasoning.
- Measured with `.github/workflows/ai-effort-experiment.yml` (three runs, 27 replayed inputs): reasoning effort was
  not what blocked the reading; after the validator fixes `none` passed 7 of 8 and `low` 8 of 8.
- The non-browser contracts suite was run with the clock 45 and 120 days ahead; only live-data freshness checks
  differ. Browser gates were not run with a moved clock.

## Result, autonomy pass (2026-11-13)

Plans 045–050 and three workflow edits (provider credit exhaustion passes the AI-proxy smoke as an operating block;
a verified deploy closes its alert on first success; BLS summary denominator) were recorded as v60.02 and v60.03.
Reviewer fixes on top: a review date ahead of the reader's clock no longer empties the screener; the no-tools retry
happens only for a refusal about the tools.

## Open follow-ups (not done)

- Prove on the live model: function calls in the stream shape the loop reads; a second-round request without
  reasoning items; search mixed with functions; what `max_tool_calls` counts. Until the new Worker is deployed the
  old one refuses the mix and the client falls back once.
- Ledger: a searched response whose input across turns exceeds 272k tokens keeps its whole reservation instead of
  settling; mixed requests reach that more often, so the month figure can overstate the bill (target mode: warnings
  only). Read `AIO.answerQualitySummary()` and the Worker ledger after a week and refine the settlement if needed.
- `js/aio-chat.js` decomposition baseline was raised for the tool loop; moving `callSharedAi`'s stream reader into
  `src/` would bring it back down.
- Chat answer format: the `[AI_ANSWER_PLAN]` JSON envelope still constrains writing; how often it breaks is now
  measurable (answer-quality log) but not yet measured. Chat reasoning effort is capped at medium.
- ROKU was removed on the listing directory's evidence (absent in four snapshots); confirm it is not a collection gap.
  ROKU and KVUE are still named in theme maps and alias lists. FANUY (OTC) cannot be judged from the listing file.
- Registry: '에이비엘바이오' on 347860.KQ and 298380.KQ; seven `_skip` placeholders block a no-duplicate-name gate.
- In hard budget mode the Worker's budget saver strips every tool from a mixed request (data tools included).
- The waiting line cannot tell an optional search in progress (it shows 생각하는 중); the pending-question card
  appears only once the chat module loads.
- OpenAI error bodies are relayed to the browser with keys masked (kept: the code says it is deliberate).
- Nothing in v60.02–v60.03 was checked by hand in a real browser beyond the automated browser gates.

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
