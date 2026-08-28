---
verified_by: generated-workspace-contract
last_verified: 2026-08-23
confidence: high
auto_refresh: true
target_version: version.json
---

# AIO Agent Workspace

> Claude/Codex 공용 작업환경의 얇은 구조 설명이다. 변동 숫자는 `_context/CURRENT-STATE.md`, 전체 문서 목록은 `_context/CONTEXT-CATALOG.json`에서 생성된다.

- **현재 버전**: v54.63
- 공통 preflight: `CURRENT-STATE.md` → `WORKFLOW-GOVERNANCE.md` → `INDEX.md` → 선택된 스킬
- 대형 원장: `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, `KNOWLEDGE-BASE.md`는 관련 용어/ID 범위만 읽는다.

## Canonical surfaces

| Surface | Source of truth | Generated/consumer surface | Gate |
|---|---|---|---|
| Current facts | `scripts/workspace-state-lib.mjs` + repository registries | `CURRENT-STATE.md`, `CONTEXT-CATALOG.json` | `ci-workspace-contract-check.mjs` |
| Skills | `.claude/skills` | `.agents/skills` | `ci-skill-contract-check.mjs`, `sync-agent-skills.mjs --check` |
| Agent profiles | `architecture/agent-profiles.json` | `.claude/agents`, `.codex/agents` | `sync-agent-profiles.mjs --check` |
| Skill eval fixtures | `architecture/skill-eval-cases.json` | behavioral-run input | `ci-skill-eval-fixture-check.mjs` |
| Hooks | `scripts/agent-hook.mjs` | `.codex/hooks.json`, `.claude/settings.json` | `ci-workspace-contract-check.mjs` + hook fixtures |
| Knowledge inventory | runtime knowledge artifacts | `public-data/knowledge/status-summary.json` | knowledge contract family |

## Commands and skills

| Command | Route |
|---|---|
| `/bug-fix` | `bug-fix` |
| `/qa` | `post-edit-qa` |
| `/data-refresh` | `data-refresh` |
| `/integrate` | `integrate` |
| `/knowledge-lint` | `knowledge-lint` |
| `/autoresearch` | `autoresearch` |
| `/version-up` | `scripts/bump-version.mjs` |
| `/deploy` | explicit-authority release workflow |
| `/session-save` | explicit personal-memory request only; project state remains in repository artifacts |

## Hook policy

- Hooks may deny destructive commands, protect archived evidence, inject generated preflight context, or emit advisory gate warnings.
- Hooks never stage, commit, push, deploy, rewrite, or delete working-tree content.
- Codex hooks consume one JSON object from stdin and provide `commandWindows`; project commands resolve from the Git root.
- Intermediate edit failures are advisory. Release gates remain authoritative at closeout.

## Change policy

1. Change canonical sources, then regenerate consumers.
2. Never hand-edit generated current-state, catalog, skill mirror, or agent profiles.
3. Add a P entry for defects, R/QA promotion for recurring classes, and an executable negative control.
4. Do not copy live/deployed state into durable prose; measure it with live gates at observation time.
5. Automatic commit and deployment are forbidden without explicit user authorization.
