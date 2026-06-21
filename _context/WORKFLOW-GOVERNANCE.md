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

## Skill Improvement Rule

When improving a skill:

1. Keep `SKILL.md` concise and task-facing.
2. Move long examples or domain detail into `references/` only when actually needed.
3. Add a binary self-eval section with yes/no checks.
4. Link the skill to this workflow document.
5. Validate frontmatter and referenced files.
6. Update `_context/INDEX.md` when adding or removing context docs.

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
