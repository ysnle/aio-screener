---
name: integrate
description: Integrate supplied investment research into AIO knowledge and consumers. Use for market material, not agent setup guides.
---

## AIO Skill Operating Contract

Follow `.claude/skills/_shared/operating-contract.md`; reuse it if already read. It owns common context loading, version sync, evidence closeout, and generated-mirror rules.

## Purpose

Convert user-provided material into durable AIO framework changes without copying transient prose or unsupported claims into runtime surfaces.

## Reference Loading Map

Read only what the current task needs; this is not an all-files reading checklist.

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
