---
name: post-edit-qa
description: AIO Screener deep post-edit QA workflow. Use after code, data, UI, workflow, or skill edits to verify structural integrity, pages, pipelines, layout, security, accessibility, performance, dead DOM, and reportable gates.
---

## AIO Skill Operating Contract

Read `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`, and `.claude/skills/_shared/operating-contract.md` before acting. Treat `.claude/skills` as canonical and `.agents/skills` as a generated local mirror.

Close every code/data/doc/skill change with evidence. For skill-facing edits run `node scripts/ci-skill-contract-check.mjs` and `node scripts/ci-workflow-compaction-check.mjs`. Keep R1 7 surfaces synchronized with `node scripts/bump-version.mjs <version>` when a version bump is required.

## Purpose

Run the minimum sufficient QA depth after edits, while preserving the option for full deep QA when shared surfaces or user-facing workflows changed.

## Reference Loading Map

- Read `references/tiers.md` to choose and execute QA tiers.
- Read `references/scope-matrix.md` to map touched surfaces and risk to the minimum sufficient tier set.
- Read `references/report-contract.md` before writing the final QA report.
- Read `_context/QA-CHECKLIST.md` before updating checklist coverage.
- Read `_context/RULES.md` for any rule named by the changed files.

## Core Workflow

1. Identify touched surfaces and likely blast radius.
2. Select QA tiers from `references/tiers.md`.
3. Run executable gates before manual claims.
4. Fix FAIL items within scope when possible.
5. Update QA/RULES/BUG docs when the result creates a recurring check.
6. Report PASS/WARN/FAIL with commands and blocked checks.

## Binary Self-Eval

| ID | Question |
|----|----------|
| QA1 | Was Tier 1 structural integrity checked? |
| QA2 | Were touched pages or consumers checked at the right depth? |
| QA3 | Were data producers and generated artifacts checked together? |
| QA4 | Were security/accessibility/performance risks considered when relevant? |
| QA5 | Are blocked checks separate from passing checks? |
| QA6 | Did the matching command wrapper remain synced? |
| QA7 | For UI/UX-visible changes, did the report state whether Tier 13 (live browser, `references/tiers.md`) ran or was explicitly skipped? |
