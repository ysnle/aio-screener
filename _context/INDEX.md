---
verified_by: generated-workspace-contract
last_verified: 2026-09-17
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
| `AIO-CURRENT-PRODUCT-ARCHITECTURE-CHARTER.md` | 최초 설계 의도에 대한 객관적 판정, 제품 경계, 목표 구조와 단계별 개편 | 제품 방향·범위·아키텍처·신뢰 모델 변경 시 |

## Search-only ledgers

다음 파일은 기록 보존용 대형 원장이다. 전체를 기본 컨텍스트에 넣지 않는다.

| Ledger | Search key | Update trigger |
|---|---|---|
| `RULES.md` | 관련 R번호, 함수, 실패 클래스 | 반복 패턴을 규칙/게이트로 승격할 때 |
| `BUG-POSTMORTEM.md` | 관련 P번호, 증상, producer/consumer | 버그 수정 시 |
| `QA-CHECKLIST.md` | QA ID, 페이지, 게이트 | 새 회귀·미검증 경계 발생 시 |
| `KNOWLEDGE-BASE.md` | 도메인 용어, source/evidence 상태 | 재사용 가능한 지식 또는 경계 변경 시 |

## Task routing

Independent code/history audit and remaining reconstruction work: [`REPORT.md`](../_artifacts/deep-audit-20260831/REPORT.md). Inventory coverage, semantic review, local browser checks and deployed certification are explicitly separate.

Latest desktop journey evidence and open boundaries: [`user-flow-remediation-20260830.md`](../_artifacts/user-flow-remediation-20260830.md). The route walkthrough is not whole-content semantic or deployment certification (P1010/R572).

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
| Product scope or architecture | `AIO-CURRENT-PRODUCT-ARCHITECTURE-CHARTER.md` → machine charter → relevant architecture contracts |

## Context lifecycle

- `preflight`: consult once at task start; reuse unchanged context. Governance and INDEX are targeted references.
- `ledger`: append/compact history; targeted search only.
- `current-handoff` or `research-record`: read when its domain is touched.
- `machine-contract`: consumed by scripts/gates; inspect when changing its producer or consumer.
- `historical-snapshot`: explicit audit/history request only; never a current baseline.
- `generated`: change the producer and regenerate, never edit by hand.
- catalog `readPolicy: explicit-only`: 현재 작업과 직접 관련된 경우에만 읽는다.

The exact classification for every `_context/*.md|json` file is in `CONTEXT-CATALOG.json`. `ci-knowledge-lint-check.mjs` verifies both filesystem-to-catalog and catalog-to-filesystem parity, frontmatter, references and currentness.

## Current and live state

- Ongoing all-line/history audit: `../_artifacts/exhaustive-audit-20260831/REPORT.md` and `coverage-summary.json`. Inventory/parse coverage is separate from semantic completion; unresolved work is not closed by a passing gate.

- **Agent handoff (current): `../_artifacts/full-review-20260916/HANDOFF.md`** — 마지막 작업, 열린 항목과 우선순위, 다음 행동, 반복 금지. 같은 디렉터리에 `REPORT.md`(구조·CI·6개 영역), `SEMANTIC-REVIEW.md`(R219 의미 검토), `FIX-REPORT.md`(v54.98 수정·검증), `evidence.json`(기계 판독). v54.98은 `0733dbc4`로 커밋·배포됐고(라이브 `deployment.json` exact-SHA 수렴), 이 핸드오프의 §2에 미수정 백로그가 남아 있다.

- **데이터 의미·정합성 전수 감사 (2026-09-18): `../_artifacts/data-semantic-consistency-20260918/REPORT.md`** — 상위 23개 산출물(§1~§9, P1096~P1108/R614)에 이어 **중첩 산출물까지 전부** 검사했다(§10, P1109~P1114/R615): 8,908개 참조·37개 매니저 농도 재계산·629 객체 해시·퇴역 범위 정리·중첩 신선도 측정면 신설·미사용 sw 등록부 삭제. 전환 면제 만료는 **2026-10-18**. 남은 OPEN: 날짜 없는 중첩 산출물 12건, `objects/**` 592/629 미참조 blob 보존 정책, 실제 소비 산출물의 캐시 라우팅 누락, `factorObservedAt` 계층별 이름 분리.

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
node scripts/ci-skill-eval-fixture-check.mjs
node scripts/ci-ledger-integrity-check.mjs
node scripts/ci-assertion-trace-check.mjs
node scripts/sync-agent-profiles.mjs --check
node scripts/sync-agent-skills.mjs --check
```

`ci-ledger-integrity-check.mjs`·`ci-assertion-trace-check.mjs`와 확장된 `ci-knowledge-lint-check.mjs`는 원장 루프 게이트이며, 동결 대상·베이스라인·부채 수치·`--write` 규칙은 [`QA-PIPELINE-ARCHITECTURE.md`](./QA-PIPELINE-ARCHITECTURE.md)의 "Ledger Loop Gates"가 단일 원천이다.

Automatic commit, push and deployment are forbidden; those actions require explicit user authorization.
