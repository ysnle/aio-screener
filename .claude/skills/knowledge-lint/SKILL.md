---
name: knowledge-lint
description: AIO Screener knowledge-base consistency lint. Use when checking _context docs, rules, postmortems, QA, commands, and skills for contradictions, stale paths, missing gates, INDEX drift, or repeated failure patterns.
---

## AIO Skill Operating Contract v51.73

Read `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`, and `.claude/skills/_shared/operating-contract.md` before acting. Treat `.claude/skills` and `.claude/commands` as the active skill system.

Close every code/data/doc/skill change with evidence. For skill-facing edits run `node scripts/ci-skill-contract-check.mjs` and `node scripts/ci-workflow-compaction-check.mjs`. Keep R1 7 surfaces synchronized with `node scripts/bump-version.mjs <version>` when a version bump is required.

## Purpose

Detect and repair contradictions between `_context`, skills, commands, rules, postmortems, QA checklists, and executable gates.

## Reference Loading Map

- Read `references/workflow.md` for the eight lint passes, report contract, and closeout.
- Read `_context/BUG-POSTMORTEM.md`, `_context/RULES.md`, `_context/QA-CHECKLIST.md`, and `_context/INDEX.md` for full lint runs.
- Read only affected docs for a targeted lint.

## Core Workflow

1. Select full or targeted lint scope.
2. Run the seven lint passes.
3. Auto-fix clear stale paths and index drift.
4. Escalate contradictory rules or ambiguous ownership.
5. Add or update gates when repeated failures are found.
6. Report PASS/WARN/FAIL with verified, blocked, and unverified sections.

## Binary Self-Eval

| ID | Question |
|----|----------|
| KL1 | Are postmortems, rules, QA, and gates connected where required? |
| KL2 | Did the lint find stale paths such as legacy skill roots? |
| KL3 | Is `_context/INDEX.md` current for changed docs? |
| KL4 | Are duplicate or contradictory rules resolved or flagged? |
| KL5 | Were executable gates run for doc/skill changes? |
| KL6 | Did the matching command wrapper remain synced? |
| KL7 | Was Pass 8 (prescriptive drift: reasoning-echo requests, instruction-without-eval) run over `.claude/skills` and `.claude/commands`? |
