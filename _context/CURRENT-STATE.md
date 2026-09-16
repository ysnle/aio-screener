---
generated_by: scripts/generate-workspace-state.mjs
generated_from_build: 2026-09-15T10:49:00+09:00
auto_refresh: true
last_verified: 2026-09-15
---

# AIO Current State

이 문서는 저장소에서 생성되는 현재 작업 기준선이다. 직접 편집하지 말고 `node scripts/generate-workspace-state.mjs --write`를 실행한다. Git HEAD·dirty 상태·live 배포 상태는 세션마다 달라지므로 이 파일에 고정하지 않는다.

## Application

- Version: `v54.97`
- Architecture: `hybrid-static-shell-native-esm`
- Active routes: 20 (source: `architecture/route-owners.json`)
- App shell: 28,563 lines / 1,906,342 bytes

| Source | Lines | Bytes |
|---|---:|---:|
| `index.html` | 28,563 | 1,906,342 |
| `js/aio-core.js` | 27,972 | 1,683,590 |
| `js/aio-data.js` | 16,646 | 1,015,000 |
| `js/aio-ui.js` | 4,378 | 273,894 |
| `js/aio-chat.js` | 8,153 | 581,749 |
| `js/aio-tests.js` | 9,315 | 712,493 |
| `js/aio-glossary.js` | 322 | 60,537 |

## Workspace

- Context documents: 69; preflight reads current state once; governance and INDEX are targeted references.
- Skills: 6; command wrappers: 9; agent profiles: 4.
- Workflows: 9; CI scripts: 122.
- Ledgers: latest rule R595; latest postmortem P1073; open QA 146 unique IDs (150 rows, 4 explicitly superseded).
- Canonical skills: `.claude/skills`; Codex mirror: `.agents/skills`.

## Knowledge Boundary

- Runtime status: `REFERENCE_PROGRESS_ONLY`.
- 455 units: 313 researched, 4 in progress, 138 research required; 160 articles.
- Human review complete: `false`; publication ready: `false`.
- These counts are structural/runtime evidence, not semantic or investment certification.

## Operations Boundary

- Repository operations artifact: `OPERATOR_REQUIRED` at `2026-09-16T00:28:05.815Z`.
- Public stage: `RESEARCH_BETA_CONDITIONAL`; promotion decision: `BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE`.
- Live deployment, provider health, and edge headers must be measured by live gates. Never infer them from this file.

## Read Policy

1. Read this file once at task start; consult `WORKFLOW-GOVERNANCE.md` and `INDEX.md` when relevant, and reuse unchanged context.
2. Search `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, and `KNOWLEDGE-BASE.md` for matching IDs/terms; do not load the full ledgers by default.
3. Use `CONTEXT-CATALOG.json` to locate current handoffs and historical snapshots.
4. Re-run `node scripts/ci-workspace-contract-check.mjs` whenever docs, skills, agents, hooks, or workflows change.
