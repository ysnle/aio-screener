---
verified_by: agent
last_verified: 2026-06-19
confidence: high
auto_refresh: true
target_version: version.json
---

# Workflow Governance

This document is the shared operating contract for AIO agents and skills. Its job is to turn past experience into better future work, not just longer notes.

## Why This Exists

Repeated failures had the same shape:

- A postmortem or rule was written, but no CI/runtime gate enforced it.
- A feature was added beside the old structure instead of replacing or retiring the bad path.
- A local/worktree version, deployed version, and helper docs disagreed.
- Browser/live verification was claimed when only static code was checked.
- Skill instructions grew, but did not force the next agent to read the right memory first.

The fix is a closed loop:

```text
observe failure -> identify pattern -> change code or workflow -> add binary gate -> run gate -> record result -> next agent starts from that record
```

## Mandatory Preflight

Before changing code, data, docs, or skills:

1. Identify the active workspace or worktree with `git status --short` and read `version.json`.
2. Read `AGENTS.md`, `_context/INDEX.md`, and this document.
3. Read the relevant skill `SKILL.md` completely when a task matches a skill.
4. Read the latest relevant entries:
   - bugs: `_context/BUG-POSTMORTEM.md` recent matching P entries
   - process/rules: `_context/RULES.md`
   - QA: `_context/QA-CHECKLIST.md`
   - recent product changes: `CHANGELOG.md` latest 5 entries
5. State the current assumption when the root checkout and active worktree differ.

## Work Quality Gate

Do not finish by saying "done" unless the work has one of these outcomes:

- **Validated**: relevant checks passed and the final answer lists them.
- **Blocked**: the exact blocked surface is named, including the command/tool/policy that blocked it.
- **Scoped partial**: the completed subset and remaining blockers are explicit.

For code-facing changes, prefer these checks when available:

```bash
node --check js/aio-core.js
node --check js/aio-data.js
node --check js/aio-ui.js
node --check js/aio-chat.js
node --check js/aio-tests.js
node scripts/ci-version-check.mjs
node scripts/ci-structural-check.mjs
node scripts/ci-runtime-contract-check.mjs
git diff --check
```

Two additional gates are not part of the local-only set above because they check state outside the working tree; run them when the task touches what they cover:

```bash
node scripts/ci-knowledge-lint-check.mjs    # offline; _context/INDEX.md and doc-table drift, staleness
node scripts/ci-live-invariant-check.mjs    # network-dependent; fetches the LIVE deployed site
```

For local server validation, check the actual served asset, not only the file on disk:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:PORT/'
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:PORT/js/aio-core.js?v=VERSION'
```

If browser automation is blocked by policy, say so. Do not relabel HTTP checks as browser checks.

## Postmortem-To-Gate Rule

Every recurring failure must end in at least one enforceable mechanism:

- a runtime audit exposed on `window.AIO`
- a CI script in `scripts/`
- a regression test in `js/aio-tests.js`
- a checklist item in `_context/QA-CHECKLIST.md`
- a rule in `_context/RULES.md`

Notes alone do not count as prevention.

## Declaration-And-Gate-Adjustment Rule (added 2026-07-19, RM-04)

A batch that both (a) declares a migration/route/feature complete and (b) edits the gate that checks that same completion is the highest-risk combination in this repo: the gate can be quietly loosened to match the declaration instead of the declaration being held to the gate. This exact pattern produced P736 and recurred one batch later as P740 (`_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md`, R352).

When a change set does both in the same batch:

1. Before requesting or acting on a commit/push/deploy, re-derive the declared counts/lists from source independently of the gate just edited (grep/read the actual files — do not treat the gate's own PASS output as the only evidence).
2. State explicitly in the final answer which specific counts were re-derived and how, not just "gate passed."
3. If the re-derivation disagrees with the declaration, fix the declaration — never loosen the gate further to make the disagreement go away.

This does not change who authorizes a push (still the user, per session, as always) — it changes what evidence the agent must already hold before treating a declaration as ready for that decision.

## Standing Invariant Rule

The postmortem-to-gate mechanisms above (`ci-*-contract-check.mjs`, `js/aio-tests.js`) all read the local working tree. They prove the *repository* is correct at commit time. They cannot prove the *deployed* site is still serving that same correct state a week later with zero commits in between — GitHub Pages/CDN caching, a partial deploy, or operator-side config (e.g. a Cloudflare Worker revision) can all drift independently of source. P638/C1 (deployed Worker route older than the repo's) and P572/R263 (data commits landing while `[skip ci]` silently stopped the Pages deploy from ever publishing them) are both cases where every source gate was green while the live site was wrong — nothing in the files those gates read had changed, so nothing could have failed.

When a postmortem's root cause is only reproducible against the live/deployed site — not by re-running local gates against the checked-out source — close it two ways:

1. The normal source-level contract in `ci-runtime-contract-check.mjs`/`ci-structural-check.mjs`, as usual.
2. A predicate in `scripts/ci-live-invariant-check.mjs`, run by `.github/workflows/data-watchdog.yml` on its existing schedule (independent of the next commit/PR).

Keep list 2 small. Add to it only when a local gate structurally cannot see the failure class (deploy/CDN/cache/operator-config drift, not a source bug). Do not duplicate a check that already exists in list 1 — two lists asserting the same fact will drift apart from each other, which is the exact failure mode this rule exists to prevent.

## Skill Improvement Rule

When improving a skill:

0. Treat `.claude/skills/*/SKILL.md` and `.claude/commands/*.md` as the tracked canonical surfaces. Treat ignored local `.agents/skills` as a generated Codex mirror, never an independent source.
1. Keep `SKILL.md` concise and task-facing: contract, purpose, reference loading map, core workflow, binary self-eval.
2. Move long examples, category lists, QA tiers, report templates, and domain detail into directly linked `references/`.
3. Keep shared obligations in `.claude/skills/_shared/operating-contract.md`.
4. Add a binary self-eval section with yes/no checks.
5. Link the skill to this workflow document.
6. Materialize or refresh the Codex mirror with `node scripts/sync-agent-skills.mjs`, then validate frontmatter, router size, references, wrappers, encoding sentinels, and mirror parity with `node scripts/ci-skill-contract-check.mjs`.
7. Run `node scripts/sync-agent-skills.mjs --check` when `.agents/skills` exists.
8. Update `_context/INDEX.md` when adding or removing context docs.

Do not create a new skill when an existing skill can be hardened. New skills require command-wrapper synchronization under R27.

## AIO Skill Matrix

| Skill | Must close with |
|---|---|
| `bug-fix` | BUG-POSTMORTEM P entry, RULES/QA update when recurring, regression test or CI/runtime audit |
| `post-edit-qa` | explicit pass/fail report, route/page coverage, command results, follow-up blockers |
| `data-refresh` | sourceKind/freshness labeling, stale artifact consumed or retired, version/data timestamp evidence |
| `integrate` | framework extracted, target page/chat mapping, sourceKind not promoted to LIVE, changelog/context memory |
| `knowledge-lint` | broken doc links resolved, INDEX current, stale/missing rule-to-QA mappings reported |
| `autoresearch` | binary evals, baseline result, one-variable change log, accepted/rejected result |

Minimum self-eval for any skill change:

| Eval | Yes condition |
|---|---|
| SG1 | Skill or governance doc tells the next agent what to read first |
| SG2 | A repeated failure maps to a binary eval or executable gate |
| SG3 | The change avoids adding a parallel stale path |
| SG4 | Final answer must distinguish verified, blocked, and unverified surfaces |
| SG5 | `_context/INDEX.md` is updated when context docs change |
| SG6 | Command wrapper and shared contract links still point to the canonical skill, and any local Codex mirror is synchronized |

## Loop Vocabulary

When new recurring or long-running work comes up, name which primitive it needs before building anything. Reaching for the wrong one is how a five-minute fix grows into unnecessary infrastructure.

| Type | Triggered by | Stops when | AIO example |
|---|---|---|---|
| Turn-based | A prompt in this session | The agent judges the task done or blocked | Most `/bug-fix`, `/integrate`, `/qa` work |
| Goal-based | A prompt with an explicit done-condition | The condition passes or a turn cap is hit | "fix headless tests until `ci-headless-tests.mjs` is 0 fail, stop after 5 tries" |
| Time-based | A schedule | Cancelled, or the work itself completes | `refresh-data.yml` (`'17,47 * * * *'`), `data-watchdog.yml` (`'23 * * * *'`) |
| Proactive | An event/schedule with no human watching in real time | Each run's goal is met; the schedule itself runs until turned off | `ci.yml` on push/PR gating `deploy`; the R290 live-invariant job |

Pick time-based/proactive only for work that must happen without a human present — this repo already pays for that with three GitHub Actions workflows, so a new recurring need should extend one of those (add a step/predicate) before inventing a new schedule. Reserve turn-based/goal-based for work that benefits from a human or agent actively reasoning about the specific instance. Verification should be encoded as a skill (`post-edit-qa`, `references/tiers.md`) so a turn-based check can approach self-verifying instead of relying on the operator's manual read.

## Karpathy Loop For AIO

Use the autoresearch idea as a practical loop, not a ceremony:

1. Define 3 to 6 binary evals.
2. Run the current skill or workflow as baseline.
3. Change exactly one variable.
4. Re-run the same evals.
5. Keep only changes that improve or preserve score while reducing failure risk.
6. Promote repeated failures into gates.

Anti-patterns:

- adding ten new instructions at once
- making the skill longer without a new eval
- optimizing for a narrow test while real user flow remains broken
- recording a lesson without a gate

## Final Answer Contract

A final answer after implementation must include:

- what changed
- what was verified
- what was not verified and why
- whether commit/deploy was performed

For AIO, "external-share ready" requires at minimum: version sync, runtime contract, structural check, no stale cachebuster, no fake-live source labeling, and no visible developer-only guidance on the default user path.
