---
verified_by: generated-workspace-contract + P1313/R659 ledger routing
last_verified: 2026-11-02
confidence: high
auto_refresh: true
target_version: version.json
---

# AIO Context Index

이 파일은 읽기 라우터다. 전체 문서의 존재·분류·크기는 생성된 `_context/CONTEXT-CATALOG.json`이 단일 목록으로 관리한다. 현재 버전·라우트·코드 크기·지식 진행률은 `_context/CURRENT-STATE.md`가 담당한다.

## Default working set

| Document | Purpose | Read rule |
|---|---|---|
| `CURRENT-STATE.md` | 저장소에서 파생한 현재 기준선과 지식/운영 경계 | 작업 시작에 한 번 |
| `WORKFLOW-GOVERNANCE.md` | preflight, evidence level, postmortem-to-gate, 권한 경계 | QA·권한·워크플로 상세 필요 시 |
| `INDEX.md` | 이 라우터 | 문서 위치 탐색 시 |
| `CODE-MAP.md` | 대형 셸/호환 모듈의 부분 탐색 지도 | 해당 코드 수정 시 |
| `QA-PIPELINE-ARCHITECTURE.md` | 영향 기반 로컬 QA, CI DAG, Pages/Cloudflare 운영 경계 | QA·CI·배포·watchdog 수정 시 |
| `OWNER-DECISIONS.md` | 소유자 결정·상시 규칙의 날짜순 등록부와 정본과의 어긋남 | 결정 이력·대체 관계를 찾을 때 |
| `AIO-CURRENT-PRODUCT-ARCHITECTURE-CHARTER.md` | 최초 설계 의도에 대한 객관적 판정, 제품 경계, 목표 구조와 단계별 개편 | 제품 방향·범위·아키텍처·신뢰 모델 변경 시 |

## Search-only ledgers

다음 파일은 기록 보존용 대형 원장이다. 전체를 기본 컨텍스트에 넣지 않는다.

| Ledger | Search key | Update trigger |
|---|---|---|
| `RULES.md` | 맨 위 수신함 다음의 원칙 색인(C1~C18: 불변식·게이트) → 해당 원칙의 R번호·함수 | 새 결함을 어긴 원칙에 넣거나 규칙/게이트로 승격할 때 |
| `BUG-POSTMORTEM.md` | 관련 P번호, 증상, producer/consumer; 맨 위 원칙별 반복 결함 표(`scripts/ledger-class-report.mjs --write`) | 버그 수정 시 |
| `QA-CHECKLIST.md` | QA ID, 페이지, 게이트 | 새 회귀·미검증 경계 발생 시 |
| `KNOWLEDGE-BASE.md` | 도메인 용어, source/evidence 상태 | 재사용 가능한 지식 또는 경계 변경 시 |

## Task routing

Handoff lineage (최신이 위, 열린 항목은 가장 위 문서가 소유한다; 아래 문서는 이력):

| 날짜 | 문서 | 역할 |
|---|---|---|
| 2026-10-22 | [`architecture-quality-audit/HANDOFF.md`](../_artifacts/architecture-quality-audit/HANDOFF.md) + [`FINDINGS-HISTORY.md`](../_artifacts/architecture-quality-audit/FINDINGS-HISTORY.md), [`REVIEW-CORRECTIONS.md`](../_artifacts/architecture-quality-audit/REVIEW-CORRECTIONS.md) | 감사 단일 진입점. 전체 의미 감사·릴리스 인증은 아니다 |
| 2026-10-15 | [`codex-reform-audit-20261015/HANDOFF.md`](../_artifacts/codex-reform-audit-20261015/HANDOFF.md) | 이전 개편 검토 |
| 2026-10-01 | [`NEXT-SESSION-20261001.md`](../_artifacts/codex-semantic-audit-20260930/NEXT-SESSION-20261001.md), [`REPORT.md`](../_artifacts/codex-semantic-audit-20260930/REPORT.md) | 의미 감사 이어받기 |
| 2026-09-27 | [`full-audit-20260927/HANDOFF.md`](../_artifacts/full-audit-20260927/HANDOFF.md), [`EXECUTION-STATUS.md`](../_artifacts/full-audit-20260927/EXECUTION-STATUS.md), `FOUNDATION-DESIGN.md`, `V2-BLUEPRINT.md` | 기초 감사. 8월 핸드오프(`superseded_by:` 표기)를 대체 |
| 2026-09-18 | [`data-semantic-consistency-20260918/REPORT.md`](../_artifacts/data-semantic-consistency-20260918/REPORT.md) | 데이터 의미·정합성 전수 감사(P1096~P1114, R614~R615) |
| 2026-08-31 | [`exhaustive-audit-20260831/REPORT.md`](../_artifacts/exhaustive-audit-20260831/REPORT.md) | 전 행 이력 감사(이력) |
| 2026-08-30 | [`user-flow-remediation-20260830.md`](../_artifacts/user-flow-remediation-20260830.md) | 데스크톱 이동 흐름 증거(P1010/R572, 의미·배포 인증 아님) |

인벤토리 범위, 의미 검토, 로컬 브라우저 확인, 배포 인증은 서로 다른 증거 수준이다. 세션별 이어받기 문서(`_artifacts/**/HANDOFF*.md`)는 SessionStart 훅이 최신을 보여 준다.

정식 스킬 원본은 `.claude/skills/<name>/`, Codex 런타임 미러는 `.agents/skills/<name>/`다. 원본을 고친 뒤 동기화 게이트로 두 표면의 동일성을 검증한다.

**스킬은 참조 문서이지 트리거 체인이 아니다(R618).** 아래 표가 라우팅의 단일 트리거다. 스킬이 발동되거나 발동되지 않는 것은 작업 범위를 정하지 않는다 — 범위는 사용자 요청과 아래 표의 "Next read"로 정하고, 강제는 게이트 실행과 보고 형식(검증/차단/미검증 분리)에만 둔다. `.claude/agents/*.md`도 게이트가 동기화·검증하는 거버넌스 산출물이며 런타임이 자동 호출하지 않는다.

| Task | Next read |
|---|---|
| Bug/failing gate | `bug-fix` skill → matching P/R/QA excerpts |
| QA/release evidence | `post-edit-qa` skill → `QA-PIPELINE-ARCHITECTURE.md` → tier/scope/report references |
| Data freshness | `data-refresh` skill → inventory/source policy |
| Supplied research | `integrate` skill → extraction/source boundary |
| Docs/skills/hooks/agents | `knowledge-lint` skill → eight passes |
| Skill optimization | `autoresearch` skill → eval guide and experiment log |
| Product scope or architecture | `AGENTS.md` "Product decisions (fixed)" → `AIO-CURRENT-PRODUCT-ARCHITECTURE-CHARTER.md` → relevant architecture contracts |
| When/why the owner decided something, or what replaced it | `OWNER-DECISIONS.md` (dated register; AGENTS.md stays canonical) |
| Recording a fix, delegating, post-PR trim | `record-fix.mjs` (`/version-up`), `.claude/skills/_shared/agent-prompt-anatomy.md`, `/restate` `/assumptions` `/trim-pr` `/retro` |
| Merging main into a version branch | `node scripts/resolve-generated-conflicts.mjs` — R626 field-level merge (delegates to `resolve-data-manifest-merge.mjs`), then runs the release parity gates |

## Context lifecycle

- `preflight`: consult once at task start; reuse unchanged context. Governance and INDEX are targeted references.
- `ledger`: append/compact history; targeted search only.
- `current-handoff` or `research-record`: read when its domain is touched. A handoff whose frontmatter declares `superseded_by:` is catalogued as `historical-snapshot`.
- `machine-contract`: consumed by scripts/gates; inspect when changing its producer or consumer.
- `historical-snapshot`: explicit audit/history request only; never a current baseline.
- `generated`: change the producer and regenerate, never edit by hand.
- catalog `readPolicy: explicit-only`: 현재 작업과 직접 관련된 경우에만 읽는다.

## Document map

| 묶음 | 파일 | 읽는 때 |
|---|---|---|
| 현재 기준 | `CURRENT-STATE.md`(생성), `AGENTS.md`(루트), `OWNER-DECISIONS.md`, `AIO-CURRENT-PRODUCT-ARCHITECTURE-CHARTER.md` | 시작·제품 판단 |
| 작업 방법 | `WORKFLOW-GOVERNANCE.md`, `QA-PIPELINE-ARCHITECTURE.md`, `OPERATOR-RUNBOOK.md`, `CODE-MAP.md`, `../REVIEW.md` | 해당 작업을 할 때 |
| 원장(검색 전용) | `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, `KNOWLEDGE-BASE.md`, `../CHANGELOG.md` | ID·키워드 검색 |
| 열린 작업·결정 대기 | `ROADMAP.md`(배치마다 확인한 열린 항목), `QA-CHECKLIST.md`의 `- [ ]` 행 | 다음 작업을 고를 때 |
| 기계 계약 | `*.json`(베이스라인·매니페스트) | 그 생산자·게이트를 고칠 때 |
| 자료 통합 기록 | `RESEARCH-INTEGRATION-*.md` | 같은 자료 영역을 다룰 때 |
| 과거 감사·핸드오프 | 날짜가 붙은 나머지 `*-2026-MM-DD.md`, `DEFERRED-BLOCKS.md`(v50), `WORKTREE-AUDIT.md`(v48), `../EVIDENCE-DEBT.md`(v50.1) — 카탈로그 `historical-snapshot` | 이력을 명시적으로 물을 때만 |

The exact classification for every `_context/*.md|json` file is in `CONTEXT-CATALOG.json`. `ci-knowledge-lint-check.mjs` verifies both filesystem-to-catalog and catalog-to-filesystem parity, frontmatter, references and currentness.

## Current and live state

- Repository current state: `CURRENT-STATE.md`.
- Runtime knowledge state: `public-data/knowledge/status-summary.json`.
- Release/readiness state: `architecture/public-readiness.json`, `public-data/operations-status.json`.
- Live site and providers: measure with `ci-live-invariant-check.mjs` and watchdog workflows. Do not keep a copied commit/version card here.
- Root/worktree/remote state: derive it per session with `git status --short`, `git worktree list`, the release manifest and external gates. `WORKTREE-AUDIT.md` is a frozen v48 historical snapshot and must never be used as a current deploy baseline.

## Maintenance

After any context, skill, agent, hook or workflow change:

```text
node scripts/generate-workspace-state.mjs --write
node scripts/ci-workspace-contract-check.mjs
node scripts/ci-knowledge-lint-check.mjs
node scripts/ci-skill-contract-check.mjs
node scripts/ci-ledger-integrity-check.mjs
node scripts/ci-assertion-trace-check.mjs
node scripts/sync-agent-profiles.mjs --check
node scripts/sync-agent-skills.mjs --check
```

`ci-ledger-integrity-check.mjs`·`ci-assertion-trace-check.mjs`와 확장된 `ci-knowledge-lint-check.mjs`는 원장 루프 게이트이며, 동결 대상·베이스라인·부채 수치·`--write` 규칙은 [`QA-PIPELINE-ARCHITECTURE.md`](./QA-PIPELINE-ARCHITECTURE.md)의 "Ledger Loop Gates"가 단일 원천이다.

Automatic commit, push and deployment are forbidden; those actions require explicit user authorization.
