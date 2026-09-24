---
generated_by: scripts/generate-workspace-state.mjs
generated_from_build: 2026-09-24T11:38:00+09:00
auto_refresh: true
last_verified: 2026-09-24
---

# AIO Current State

이 문서는 저장소에서 생성되는 현재 작업 기준선이다. 직접 편집하지 말고 `node scripts/generate-workspace-state.mjs --write`를 실행한다. Git HEAD·dirty 상태·live 배포 상태는 세션마다 달라지므로 이 파일에 고정하지 않는다.

## Application

- Version: `v56.32`
- Architecture: `hybrid-static-shell-native-esm`
- Active routes: 20 (source: `architecture/route-owners.json`)
- App shell: 13,416 lines / 998,084 bytes

| Source | Lines | Bytes |
|---|---:|---:|
| `index.html` | 13,416 | 998,084 |
| `js/aio-core.js` | 28,085 | 1,693,831 |
| `js/aio-data.js` | 16,789 | 1,025,388 |
| `js/aio-ui.js` | 7,691 | 459,692 |
| `js/aio-chat.js` | 9,190 | 652,188 |
| `js/aio-tests.js` | 9,394 | 720,239 |
| `js/aio-glossary.js` | 322 | 60,537 |

## Workspace

- Context documents: 74; preflight reads current state once; governance and INDEX are targeted references.
- Skills: 6; command wrappers: 9; agent profiles: 4.
- Workflows: 9; CI scripts: 129.
- Ledgers: latest rule R632; latest postmortem P1203; open QA 195 unique IDs (199 rows, 4 explicitly superseded).
- Canonical skills: `.claude/skills`; Codex mirror: `.agents/skills`.

## Knowledge Boundary

- Runtime status: `REFERENCE_PROGRESS_ONLY`.
- 455 units: 313 researched, 4 in progress, 138 research required; 160 articles.
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
