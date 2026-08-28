---
name: autoresearch
description: AIO Screener skill optimization loop. Use when improving skill quality, benchmarking prompts, defining binary evals, running one-variable experiments, or producing results.tsv/changelog.md for autonomous skill refinement.
---

## AIO Skill Operating Contract

Read `_context/CURRENT-STATE.md`, `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`, and `.claude/skills/_shared/operating-contract.md` before acting. Treat `.claude/skills` as canonical and `.agents/skills` as a generated local mirror.

Close every code/data/doc/skill change with evidence. For skill-facing edits run `node scripts/ci-skill-contract-check.mjs` and `node scripts/ci-workflow-compaction-check.mjs`. Keep R1 7 surfaces synchronized with `node scripts/bump-version.mjs <version>` when a version bump is required.

## Purpose

Improve an AIO skill by repeatedly running the same task prompts, scoring with binary evals, changing exactly one variable, and keeping only score-improving changes.

## Reference Loading Map

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
