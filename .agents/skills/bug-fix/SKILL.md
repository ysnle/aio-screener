---
name: bug-fix
description: Fix AIO defects and regressions with root-cause tracing and prevention gates.
---

## AIO Skill Operating Contract

Follow `.claude/skills/_shared/operating-contract.md`; reuse it if already read. It owns common context loading, version sync, evidence closeout, and generated-mirror rules.

## Purpose

Fix the root cause, wire the prevention gate, and record the postmortem so the same bug class gets harder to repeat.

## Reference Loading Map

Read only what the current task needs; this is not an all-files reading checklist.

- Read `references/workflow.md` for the root-cause sequence, postmortem fields, and structural fix test.
- Read `_context/BUG-POSTMORTEM.md` before assigning a new P-number.
- Read `_context/QA-CHECKLIST.md` before adding or updating QA coverage.
- Read `_context/RULES.md` when a repeated pattern needs rule promotion.

## Core Workflow

1. Reproduce or localize the symptom.
2. Identify producer, transformer, consumer, and gate.
3. Patch the lowest shared cause.
4. Add or update a regression gate.
5. Record P-number, rule/checklist updates, CHANGELOG, and version sync when required.
6. Run the relevant gates and report verified/blocked/unverified items separately.

## Binary Self-Eval

| ID | Question |
|----|----------|
| BF1 | Is the root cause named, not only the symptom? |
| BF2 | Does the fix cover sibling consumers or explain why none exist? |
| BF3 | Would a gate or checklist catch the pre-fix state? |
| BF4 | Is `_context/BUG-POSTMORTEM.md` updated when this is a bug fix? |
| BF5 | Did R1 7-surface sync run if versioned files changed? |
| BF6 | Did the matching command wrapper remain synced? |
