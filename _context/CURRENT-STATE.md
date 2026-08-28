---
generated_by: scripts/generate-workspace-state.mjs
generated_from_build: 2026-08-27T09:23:00+09:00
auto_refresh: true
last_verified: 2026-08-27
---

# AIO Current State

이 문서는 저장소에서 생성되는 현재 작업 기준선이다. 직접 편집하지 말고 `node scripts/generate-workspace-state.mjs --write`를 실행한다. Git HEAD·dirty 상태·live 배포 상태는 세션마다 달라지므로 이 파일에 고정하지 않는다.

## Application

- Version: `v54.63`
- Architecture: `hybrid-static-shell-native-esm`
- Active routes: 20 (source: `architecture/route-owners.json`)
- App shell: 28,550 lines / 1,934,746 bytes

| Source | Lines | Bytes |
|---|---:|---:|
| `index.html` | 28,550 | 1,934,746 |
| `js/aio-core.js` | 27,657 | 1,677,218 |
| `js/aio-data.js` | 16,725 | 1,029,381 |
| `js/aio-ui.js` | 4,354 | 276,645 |
| `js/aio-chat.js` | 7,098 | 508,089 |
| `js/aio-tests.js` | 9,196 | 708,999 |
| `js/aio-glossary.js` | 322 | 60,756 |

## Workspace

- Context documents: 67; preflight loads only this file, `WORKFLOW-GOVERNANCE.md`, and `INDEX.md`.
- Skills: 6; command wrappers: 9; agent profiles: 4.
- Workflows: 9; CI scripts: 109.
- Ledgers: latest rule R563; latest postmortem P997; open QA 125 unique IDs (132 rows, 4 explicitly superseded).
- Canonical skills: `.claude/skills`; Codex mirror: `.agents/skills`.

## Knowledge Boundary

- Runtime status: `REFERENCE_PROGRESS_ONLY`.
- 427 units: 298 researched, 4 in progress, 125 research required; 160 articles.
- Human review complete: `false`; publication ready: `false`.
- These counts are structural/runtime evidence, not semantic or investment certification.

## Operations Boundary

- Repository operations artifact: `OPERATOR_REQUIRED` at `2026-08-28T04:16:26.487Z`.
- Public stage: `RESEARCH_BETA_CONDITIONAL`; promotion decision: `BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE`.
- Live deployment, provider health, and edge headers must be measured by live gates. Never infer them from this file.

## Read Policy

1. Read this file, `WORKFLOW-GOVERNANCE.md`, and `INDEX.md` for every task.
2. Search `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, and `KNOWLEDGE-BASE.md` for matching IDs/terms; do not load the full ledgers by default.
3. Use `CONTEXT-CATALOG.json` to locate current handoffs and historical snapshots.
4. Re-run `node scripts/ci-workspace-contract-check.mjs` whenever docs, skills, agents, hooks, or workflows change.
