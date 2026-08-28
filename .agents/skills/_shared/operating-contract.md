# AIO Skill Operating Contract

Use this contract for every canonical AIO skill in `.claude/skills`, every command wrapper in `.claude/commands`, and the tracked generated Codex mirror in `.agents/skills`.

## Canonical Surface

- Treat `.claude/skills` as the tracked single source of truth.
- Treat `.agents/skills` as a tracked generated discovery mirror only. Never edit mirror content independently.
- Materialize or refresh the mirror with `node scripts/sync-agent-skills.mjs`.
- Run `node scripts/sync-agent-skills.mjs --check` before closeout; absence or drift is a failure.
- Keep command wrappers thin; route detail through the canonical `SKILL.md` and its directly linked references.

## Mandatory Preflight

1. Read the triggered `SKILL.md` completely.
2. Read `_context/CURRENT-STATE.md`, `_context/WORKFLOW-GOVERNANCE.md`, and `_context/INDEX.md` before changing code, data, workflow, or skill files.
3. Load only the reference files named by the skill router for the current task.
4. Define the task scope, completion condition, and required evidence before editing.
5. Route dated market-value updates to `data-refresh`, supplied research to `integrate`, defects to `bug-fix`, and verification to `post-edit-qa` rather than blending their contracts.
6. Search large ledgers by relevant term/ID; never load RULES, BUG, QA, or KNOWLEDGE in full by default.

## Evidence Closeout

Close every change with evidence, not notes only.

- Code/data/doc changes require the relevant executable gate.
- Skill-facing edits require `node scripts/ci-skill-contract-check.mjs` and `node scripts/ci-workflow-compaction-check.mjs`.
- Skill prompt/eval changes require `node scripts/ci-skill-eval-fixture-check.mjs`; fixture PASS does not count as an independent behavioral run.
- Codex mirror changes require `node scripts/sync-agent-skills.mjs --check`.
- Agent/hook/workspace changes require `node scripts/ci-workspace-contract-check.mjs` and `node scripts/sync-agent-profiles.mjs --check` when profiles changed.
- Versioned changes use `node scripts/bump-version.mjs <version>` and keep R1 as 7 synchronized surfaces.
- BUG/QA/RULES/CHANGELOG updates are required when the triggered skill says they are required.

Use the strongest evidence actually available: static checks, runtime/headless checks, browser interaction, and external/live checks are distinct levels. Never promote one level to another in the final report.

## Binary Self-Eval

Before final response, answer these checks:

| ID | Question |
|----|----------|
| SG1 | Are the next files to read explicit and minimal? |
| SG2 | Does every repeated failure map to a binary eval or executable gate? |
| SG3 | Did the change avoid adding stale parallel paths? |
| SG4 | Are verified, blocked, and unverified surfaces separated? |
| SG5 | Was `_context/INDEX.md` updated if context docs changed? |
| SG6 | Does the command wrapper still point to the matching skill? |
| SG7 | Is the tracked `.agents` mirror present and synchronized? |
| SG8 | Are current facts loaded from generated state instead of copied historical constants? |
| SG9 | If behavior quality is claimed, did independent task-prompt execution actually run? |
