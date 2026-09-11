---
name: data-refresh
description: Refresh stale AIO market data through its producer. Use for freshness tasks, not ordinary renderer edits.
---

## AIO Skill Operating Contract

Follow `.claude/skills/_shared/operating-contract.md`; reuse it if already read. It owns common context loading, version sync, evidence closeout, and generated-mirror rules.

## Purpose

Find stale AIO data structurally, refresh the correct producer/artifact/consumer path, and leave a gate or explicit blocked state.

## Reference Loading Map

Read only what the current task needs; this is not an all-files reading checklist.

- Read `references/inventory.md` to identify affected categories; cover all 22 only for a complete freshness audit.
- Read `references/workflow.md` for refresh order, non-negotiables, and verification commands.
- Read `references/source-policy.md` before collecting or promoting external values.
- Read `_context/RULES.md` for R1, R14, R16, R17, R21, R22, R57, and any newer data rules relevant to the touched surface.
- Read `_context/QA-CHECKLIST.md` when adding or changing a data gate.

## Core Workflow

1. Identify freshness and source lineage for the requested categories.
2. Prioritize CRITICAL stale categories.
3. Refresh through existing scripts or structured data producers.
4. Keep generated artifacts and consumers synchronized.
5. Mark unavailable live-source updates as BLOCKED, not OK.
6. Run data, runtime, version, workflow, and skill gates as applicable.

## Binary Self-Eval

| ID | Question |
|----|----------|
| DR1 | Does coverage match the request, including all 22 categories for a full audit? |
| DR2 | Were all CRITICAL categories updated or explicitly BLOCKED? |
| DR3 | Are producer, artifact, consumer, and gate synchronized? |
| DR4 | Are stale live-source failures visibly marked rather than hidden? |
| DR5 | Did R1 7-surface sync run when versioned files changed? |
| DR6 | Did the matching command wrapper remain synced? |
