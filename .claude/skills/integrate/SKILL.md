---
name: integrate
description: AIO Screener research integration workflow. Use when the user provides analysis, reports, interviews, news, market commentary, or frameworks that should be extracted and integrated into screener data, keywords, chat contexts, rules, or knowledge docs.
---

## AIO Skill Operating Contract

Read `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`, and `.claude/skills/_shared/operating-contract.md` before acting. Treat `.claude/skills` as canonical and `.agents/skills` as a generated local mirror.

Close every code/data/doc/skill change with evidence. For skill-facing edits run `node scripts/ci-skill-contract-check.mjs` and `node scripts/ci-workflow-compaction-check.mjs`. Keep R1 7 surfaces synchronized with `node scripts/bump-version.mjs <version>` when a version bump is required.

## Purpose

Convert user-provided material into durable AIO framework changes without copying transient prose or unsupported claims into runtime surfaces.

## Reference Loading Map

- Read `references/workflow.md` for classification, extraction, integration targets, and self-eval.
- Read `references/framework-extraction.md` for Q1-Q5 framework extraction, multi-source reconciliation, and invalidation boundaries.
- Read `_context/RULES.md` for R13, R16, R17, R24, R26, and any affected runtime rule.
- Read `CODE-MAP.md` before patching large app files.
- Use `data-refresh` instead when the material primarily asks for dated market value updates.

## Core Workflow

1. Classify the source material.
2. Extract durable concepts, keywords, mappings, and rules.
3. Choose the smallest correct integration target.
4. Patch producer and consumer together.
5. Update CHANGELOG, docs, and version surfaces when behavior changes.
6. Run the relevant gates and separate verified from unverified claims.

## Binary Self-Eval

| ID | Question |
|----|----------|
| IN1 | Was the reusable framework extracted instead of copied wholesale? |
| IN2 | Are all added keywords R17-compliant? |
| IN3 | Are chat/screener/theme consumers connected to real producers? |
| IN4 | Were transient claims excluded or routed to data-refresh? |
| IN5 | Did R1 7-surface sync run when behavior changed? |
| IN6 | Did the matching command wrapper remain synced? |
| IN7 | Were credential-shaped strings masked or dropped before writing to any git-tracked doc (Sensitive Data Guard)? |
