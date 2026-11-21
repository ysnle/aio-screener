---
generated_by: scripts/generate-workspace-state.mjs
generated_from_build: 2026-11-21T14:02:00+09:00
auto_refresh: true
last_verified: 2026-11-21
---

# AIO Current State

이 문서는 저장소에서 생성되는 현재 작업 기준선이다. 직접 편집하지 말고 `node scripts/generate-workspace-state.mjs --write`를 실행한다. Git HEAD·dirty 상태·live 배포 상태는 세션마다 달라지므로 이 파일에 고정하지 않는다.

## Application

- Version: `v60.39`
- Architecture: `hybrid-static-shell-native-esm`
- Active routes: 20 (source: `architecture/route-owners.json`)
- App shell: 5,293 lines / 401,974 bytes

| Source | Lines | Bytes |
|---|---:|---:|
| `index.html` | 5,293 | 401,974 |
| `js/aio-core.js` | 14,478 | 892,984 |
| `js/aio-data.js` | 6,805 | 443,310 |
| `js/aio-ui.js` | 1,217 | 71,458 |
| `js/aio-chat.js` | 4,473 | 339,573 |
| `js/aio-tests.js` | 8,674 | 697,329 |
| `js/aio-glossary.js` | 430 | 123,964 |

## Workspace

- Context documents: 84; preflight reads current state once; governance and INDEX are targeted references.
- Skills: 11; command wrappers: 21; agent profiles: 4.
- Workflows: 20; CI scripts: 217.
- Ledgers: latest rule R753; latest postmortem P2694; open QA 99 unique IDs (99 rows, 0 explicitly superseded).
- Canonical skills: `.claude/skills`; Codex mirror: `.agents/skills`.

## Knowledge Boundary

- Runtime status: `REFERENCE_PROGRESS_ONLY`.
- 455 units: 222 researched, 57 in progress, 176 research required; 160 articles.
- Human review complete: `false`; publication ready: `false`.
- These counts are structural/runtime evidence, not semantic or investment certification.

## Operations Boundary

- Repository operations artifact status is **not pinned here**: `overall` is derived from the latest refresh's freshness and changes on every data commit, so pinning it turned every scheduled refresh into a preflight failure (P1160). Read `public-data/operations-status.json` — its refresh timestamp, data revision and this status are all data-refresh-scoped (R603).
- Public stage: `RESEARCH_BETA_CONDITIONAL`; promotion decision: `BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE`.
- Live deployment, provider health, and edge headers must be measured by live gates. Never infer them from this file.

## Read Policy

1. Read this file once at task start; consult `WORKFLOW-GOVERNANCE.md` and `INDEX.md` when relevant, and reuse unchanged context.
2. Search `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, and `KNOWLEDGE-BASE.md` for matching IDs/terms; do not load the full ledgers by default.
3. Use `CONTEXT-CATALOG.json` to locate current handoffs and historical snapshots.
4. Re-run `node scripts/ci-workspace-contract-check.mjs` whenever docs, skills, agents, hooks, or workflows change.
