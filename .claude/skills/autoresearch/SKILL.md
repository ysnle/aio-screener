---
name: autoresearch
description: Benchmark and refine AIO skills through controlled prompt experiments. Use when experiments are requested.
---

## AIO Skill Operating Contract

Follow `.claude/skills/_shared/operating-contract.md`; reuse it if already read. It owns common context loading, version sync, evidence closeout, and generated-mirror rules.

## Purpose

Improve an AIO skill by repeatedly running the same task prompts, scoring with binary evals, changing exactly one variable, and keeping only score-improving changes.

## Reference Loading Map

Read only what the current task needs; this is not an all-files reading checklist.

- Read `references/workflow.md` for the experiment loop, outputs, dashboard, and stop conditions.
- Read `references/eval-guide.md` when writing or revising evals.
- Use `architecture/skill-eval-cases.json` as the stable representative-prompt input for AIO skill-system experiments.
- Read only the target skill and target skill references needed for the experiment.

## Core Workflow

1. Confirm target skill, task prompts, evals, experiment count, and stop condition.
2. Build a baseline score before changing the skill.
3. Run one-variable experiments.
4. Keep only improved versions.
5. Write `results.tsv`, `results.json`, and `changelog.md`.
6. Return the improved skill path and evidence.

## Binary Self-Eval

| ID | Question |
|----|----------|
| AR1 | Are all evals yes/no and independently observable? |
| AR2 | Was the baseline measured before any change? |
| AR3 | Did each experiment change exactly one variable? |
| AR4 | Were equal or worse experiments rejected? |
| AR5 | Are results and changelog written? |
| AR6 | Did the matching command wrapper remain synced? |
| AR7 | Are deterministic fixture results and independent behavioral-run results reported separately? |
