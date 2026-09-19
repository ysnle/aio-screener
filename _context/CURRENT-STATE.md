---
generated_by: scripts/generate-workspace-state.mjs
generated_from_build: 2026-09-19T22:44:00+09:00
auto_refresh: true
last_verified: 2026-09-19
---

# AIO Current State

이 문서는 저장소에서 생성되는 현재 작업 기준선이다. 직접 편집하지 말고 `node scripts/generate-workspace-state.mjs --write`를 실행한다. Git HEAD·dirty 상태·live 배포 상태는 세션마다 달라지므로 이 파일에 고정하지 않는다.

## Application

- Version: `v55.22`
- Architecture: `hybrid-static-shell-native-esm`
- Active routes: 20 (source: `architecture/route-owners.json`)
- App shell: 13,280 lines / 982,029 bytes

| Source | Lines | Bytes |
|---|---:|---:|
| `index.html` | 13,280 | 982,029 |
| `js/aio-core.js` | 27,998 | 1,687,468 |
| `js/aio-data.js` | 16,674 | 1,017,918 |
| `js/aio-ui.js` | 7,687 | 459,221 |
| `js/aio-chat.js` | 9,183 | 651,218 |
| `js/aio-tests.js` | 9,338 | 715,422 |
| `js/aio-glossary.js` | 322 | 60,537 |

## Workspace

- Context documents: 74; preflight reads current state once; governance and INDEX are targeted references.
- Skills: 6; command wrappers: 9; agent profiles: 4.
- Workflows: 9; CI scripts: 127.
- Ledgers: latest rule R626; latest postmortem P1144; open QA 174 unique IDs (178 rows, 4 explicitly superseded).
- Canonical skills: `.claude/skills`; Codex mirror: `.agents/skills`.

## Knowledge Boundary

- Runtime status: `REFERENCE_PROGRESS_ONLY`.
- 455 units: 313 researched, 4 in progress, 138 research required; 160 articles.
- Human review complete: `false`; publication ready: `false`.
- These counts are structural/runtime evidence, not semantic or investment certification.

## Operations Boundary

- Repository operations artifact status: `BLOCKED` (refresh timestamp and data revision are data-refresh-scoped; not pinned — R603).
- Public stage: `RESEARCH_BETA_CONDITIONAL`; promotion decision: `BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE`.
- Live deployment, provider health, and edge headers must be measured by live gates. Never infer them from this file.

## Read Policy

1. Read this file once at task start; consult `WORKFLOW-GOVERNANCE.md` and `INDEX.md` when relevant, and reuse unchanged context.
2. Search `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, and `KNOWLEDGE-BASE.md` for matching IDs/terms; do not load the full ledgers by default.
3. Use `CONTEXT-CATALOG.json` to locate current handoffs and historical snapshots.
4. Re-run `node scripts/ci-workspace-contract-check.mjs` whenever docs, skills, agents, hooks, or workflows change.
