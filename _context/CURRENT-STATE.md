---
generated_by: scripts/generate-workspace-state.mjs
generated_from_build: 2026-10-15T16:18:00+09:00
auto_refresh: true
last_verified: 2026-10-15
---

# AIO Current State

이 문서는 저장소에서 생성되는 현재 작업 기준선이다. 직접 편집하지 말고 `node scripts/generate-workspace-state.mjs --write`를 실행한다. Git HEAD·dirty 상태·live 배포 상태는 세션마다 달라지므로 이 파일에 고정하지 않는다.

## Application

- Version: `v57.80`
- Architecture: `hybrid-static-shell-native-esm`
- Active routes: 19 (source: `architecture/route-owners.json`)
- App shell: 7,086 lines / 549,036 bytes

| Source | Lines | Bytes |
|---|---:|---:|
| `index.html` | 7,086 | 549,036 |
| `js/aio-core.js` | 19,244 | 1,146,974 |
| `js/aio-data.js` | 15,106 | 953,075 |
| `js/aio-ui.js` | 4,467 | 263,002 |
| `js/aio-chat.js` | 6,284 | 458,911 |
| `js/aio-tests.js` | 9,271 | 737,685 |
| `js/aio-glossary.js` | 409 | 111,312 |

## Workspace

- Context documents: 76; preflight reads current state once; governance and INDEX are targeted references.
- Skills: 9; command wrappers: 16; agent profiles: 4.
- Workflows: 13; CI scripts: 166.
- Ledgers: latest rule R706; latest postmortem P1828; open QA 175 unique IDs (175 rows, 1 explicitly superseded).
- Canonical skills: `.claude/skills`; Codex mirror: `.agents/skills`.

## Knowledge Boundary

- Runtime status: `REFERENCE_PROGRESS_ONLY`.
- 455 units: 274 researched, 14 in progress, 167 research required; 160 articles.
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
