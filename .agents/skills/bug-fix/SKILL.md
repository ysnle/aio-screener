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

## Core Workflow (phases with exit criteria)

Work in phases; do not start a phase until the previous exit criterion holds. The lead session owns every phase; a subagent may run Phase 1 or Phase 4 in a fresh context, but it reports back and never edits.

1. **Investigate (read-only).** Reproduce or localize the symptom on the surface the user sees (live page or artifact first, then code). Before reading code for a theory, get one command you have already run that goes red on *this* symptom (a fixture gate, a node one-liner over the artifact, a verify-aio drive) and cut its input to what still fails; then list 3–5 ranked hypotheses before testing any. After two failed fixes, write down the premise they shared and test it first (2026-10-25, mattpocock diagnosing-bugs, pstack attack-the-premise). Exit: the producer, transformer, consumer and gate are named, and the root cause is stated in one sentence that the evidence supports.
2. **Fix.** Patch the lowest shared cause, including sibling consumers. Exit: `node --check` passes for every touched JS file and no second source of truth was added.
3. **Guard.** Add or update a regression gate that fails on the pre-fix state. Exit: the gate passes now and you can name the pre-fix input it would reject.
4. **Verify.** Run `qa-runner affected`, fix the whole failing batch, then `rerun-failed`. For a visible defect, check the page at desktop and phone width. Exit: verified, blocked and unverified items are listed separately.
5. **Record.** P-number, rule/checklist updates, CHANGELOG and version sync through `bump-version` and `record-fix`.

## Binary Self-Eval

| ID | Question |
|----|----------|
| BF1 | Is the root cause named, not only the symptom? |
| BF2 | Does the fix cover sibling consumers or explain why none exist? |
| BF3 | Would a gate or checklist catch the pre-fix state? |
| BF4 | Is `_context/BUG-POSTMORTEM.md` updated when this is a bug fix? |
| BF5 | Did R1 7-surface sync run if versioned files changed? |
| BF6 | Did the matching command wrapper remain synced? |
