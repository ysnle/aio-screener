# AIO Skill Operating Contract v51.73

Use this contract for every active AIO skill in `.claude/skills` and every command wrapper in `.claude/commands`.

## Mandatory Preflight

1. Read the triggered `SKILL.md` completely.
2. Read `_context/WORKFLOW-GOVERNANCE.md` and `_context/INDEX.md` before changing code, data, workflow, or skill files.
3. Load only the reference files named by the skill router for the current task.
4. Treat `.claude/skills` and `.claude/commands` as the active skill system. Do not add parallel `.agents/skills` paths.

## Evidence Closeout

Close every change with evidence, not notes only.

- Code/data/doc changes require the relevant executable gate.
- Skill-facing edits require `node scripts/ci-skill-contract-check.mjs` and `node scripts/ci-workflow-compaction-check.mjs`.
- Versioned changes use `node scripts/bump-version.mjs <version>` and keep R1 as 7 synchronized surfaces.
- BUG/QA/RULES/CHANGELOG updates are required when the triggered skill says they are required.

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

