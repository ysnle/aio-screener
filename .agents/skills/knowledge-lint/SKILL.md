---
name: knowledge-lint
description: Repair inconsistencies in AIO docs, skills, agents, hooks, and their executable contracts.
---

## AIO Skill Operating Contract

Follow `.claude/skills/_shared/operating-contract.md`; reuse it if already read. It owns common context loading, version sync, evidence closeout, and generated-mirror rules.

## Purpose

Detect and repair contradictions between `_context`, skills, commands, rules, postmortems, QA checklists, and executable gates.

## Reference Loading Map

Read only what the current task needs; this is not an all-files reading checklist.

- Read `references/workflow.md` for the eight lint passes, report contract, and closeout.
- Use `_context/CONTEXT-CATALOG.json` for exact document coverage.
- Search `_context/BUG-POSTMORTEM.md`, `_context/RULES.md`, `_context/QA-CHECKLIST.md`, and `_context/KNOWLEDGE-BASE.md` by matching ID/term even for full lint; do not inject the complete ledgers at once.
- Include root AGENTS/CLAUDE, `.claude/.codex` agents, hooks, workflows and generated-state producers in full workspace lint.

## Core Workflow

1. Select full or targeted lint scope.
2. Run the applicable lint passes; all eight are required for a full workspace lint.
3. Auto-fix clear stale paths and index drift.
4. Resolve contradictions using the user request and canonical ownership; ask only when a material ambiguity remains.
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
| KL7 | For full lint, was Pass 8 (prescriptive drift: reasoning-echo requests, instruction-without-eval) run over `.claude/skills` and `.claude/commands`? |
| KL8 | Is any local `.agents/skills` mirror byte-synchronized with the canonical skill tree? |
| KL9 | For full workspace lint, were AGENTS/CLAUDE, agents, hooks, workflows and generated current-state/catalog surfaces included? |
| KL10 | Did the report keep mechanical consistency separate from semantic/human certification? |
