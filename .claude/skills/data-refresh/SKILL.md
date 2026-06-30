---
name: data-refresh
description: AIO Screener hardcoded and generated data refresh workflow. Use when checking or updating DATA_SNAPSHOT, sentiment, breadth, macro, news, ticker registries, public-data artifacts, and other stale data categories.
---

## AIO Skill Operating Contract v51.73

Read `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`, and `.claude/skills/_shared/operating-contract.md` before acting. Treat `.claude/skills` and `.claude/commands` as the active skill system.

Close every code/data/doc/skill change with evidence. For skill-facing edits run `node scripts/ci-skill-contract-check.mjs` and `node scripts/ci-workflow-compaction-check.mjs`. Keep R1 7 surfaces synchronized with `node scripts/bump-version.mjs <version>` when a version bump is required.

## Purpose

Find stale AIO data structurally, refresh the correct producer/artifact/consumer path, and leave a gate or explicit blocked state.

## Reference Loading Map

- Read `references/inventory.md` to classify the 22 data categories and build the staleness table.
- Read `references/workflow.md` for refresh order, non-negotiables, and verification commands.
- Read `_context/RULES.md` for R1, R14, R16, R17, R21, R22, R57, and any newer data rules relevant to the touched surface.
- Read `_context/QA-CHECKLIST.md` when adding or changing a data gate.

## Core Workflow

1. Build the staleness table before editing.
2. Prioritize CRITICAL stale categories.
3. Refresh through existing scripts or structured data producers.
4. Keep generated artifacts and consumers synchronized.
5. Mark unavailable live-source updates as BLOCKED, not OK.
6. Run data, runtime, version, workflow, and skill gates as applicable.

## Binary Self-Eval

| ID | Question |
|----|----------|
| DR1 | Does the staleness table cover all 22 categories? |
| DR2 | Were all CRITICAL categories updated or explicitly BLOCKED? |
| DR3 | Are producer, artifact, consumer, and gate synchronized? |
| DR4 | Are stale live-source failures visibly marked rather than hidden? |
| DR5 | Did R1 7-surface sync run when versioned files changed? |
| DR6 | Did the matching command wrapper remain synced? |
