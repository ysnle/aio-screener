---
verified_by: agent (Sonnet 5, git/grep 실측 — Fable 5 v51.90 진단 Phase 0 A6b 후속)
last_verified: 2026-07-02
confidence: high
auto_refresh: true
target_version: version.json
---

# _context Index

This folder is the active project knowledge base for AIO. It should describe the current GitHub-deployed structure first, then local Claude worktree exceptions only when they affect routing.

## Active Documents

| Document | Role | Refresh trigger |
|---|---|---|
| `CLAUDE.md` | Project structure, Git-tracked skills, hook caveats, context loop | Structure or workflow changes |
| `WORKFLOW-GOVERNANCE.md` | Agent preflight, postmortem-to-gate rule, skill/self-operation closure contract | Workflow, skill, or CI gate changes |
| `RULES.md` | Master rules for versioning, edits, QA, safety, deployment | New recurring failure or process rule |
| `BUG-POSTMORTEM.md` | Bug history and P-number recurrence tracking | Bug fix |
| `QA-CHECKLIST.md` | Manual/automated QA checklist | QA finding or new risky surface |
| `KNOWLEDGE-BASE.md` | Research, market frameworks, integration memory | `/integrate` or insight capture |
| `CODE-MAP.md` | Current `index.html` and `js/*.js` line map | Large edit or module movement |
| `WORKTREE-AUDIT.md` | GitHub/live/worktree routing and unpublished work inventory | Worktree merge, deploy, or audit |
| `DEEP-QA-2026-05-05.md` | Three-area deep QA: UI/rendering, API pipeline, page-level logic | Deep QA run or live/local parity change |
| `OPERATIONS-AUDIT-2026-05-06.md` | Operational sustainability audit: version/cache/SW/API health | Runtime or deployment hardening |
| `DATA-PIPELINE-AUDIT-2026-05-06.md` | End-to-end data pipeline map: source, transport, store, analysis, render | API/source, analysis, or render pipeline changes |
| `ARCHITECTURE-AUDIT-2026-05-10.md` | v49.3 architecture-audit reinforcement summary | Data/function/risk layer changes |
| `DATA-FRESHNESS-AUDIT-2026-05-10.md` | v49.4 freshness policy / auto-refresh reinforcement summary | Freshness policy/source/stale criteria changes |
| `GATE-BASELINE-2026-06-04.md` | v50.4 evidence deployment gate + unit-test 실측 기준선 (env-dependent vs code-internal 분리) | 게이트/테스트 재측정, 운영 baseline 추가 시 |
| `GATE-BASELINE-2026-07-03.md` | v51.91→v51.96 헤드리스 CI 테스트(`ci-headless-tests.mjs`) 실측 (894/921→896/921 pass, T776/T686 실제 해소로 27→25건 skip-list) — Phase 2 [B5] + 전체 /data-refresh 산출물 | skip-list 갱신, 헤드리스 테스트 재측정 시 |
| `CHAT-DATA-AUDIT-2026-06-04.md` | v50.8 AI 채팅 데이터 출처 전수 감사 baseline (fetch 파이프라인·시장맥락 주입·재사용·dead code 실측) | 채팅 데이터 경로/컨텍스트 변경 시 |
| `FRONTEND-UX-AUDIT-2026-06-05.md` | v50.12 21페이지 라이브 프론트엔드/UX audit (클러터·중복 / 초보자 직관성·위계). 측정+audit 근거, P0/P1/P2 백로그 | UI/UX 시정·페이지 구조 변경 시 |
| `OPUS-HANDOFF-STRUCTURAL-AUDIT-2026-06-10.md` | v50.23 구조 전수 감사 (백엔드/프론트/데이터/UX/자동운영 실측) + Opus 작업 백로그 WO-1~14. cron 미발화·ATH 레짐 버그(aio-data.js:12303)·stale 내러티브 구조 등 P0 5건 (전부 해소됨, FABLE-SYSTEM-DIAGNOSIS §2 참조) | WO 항목 완료/구조 변경 시 |
| `PAGE-UX-AUDIT-2026-06-13.md` | 페이지별 UX 감사. 일부 "빈 껍데기/고장" 항목은 이후 라이브 검증에서 거짓양성 판정됨(`DEFERRED-BLOCKS.md` §3 참조) | UI/UX 재점검 시 |
| `DEFERRED-BLOCKS.md` | 미뤄둔 작업 / 진짜 블록 현황 — 데이터 없음(B1-3)·시간 필요(B4/B6)·운영자 결정(B5)으로 구분, "별도 세션 필요"의 실체 정리 | 블록 해제/작업 착수 시 |
| `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` | v51.90 시스템 뼈대 진단 (아키텍처/자동화·최신화/알고리즘). P0: 로컬 git 병듦(OneDrive, 2026-07-02 해소됨)·_context/CLAUDE.md 인코딩 파손(해소됨). RSI 서버↔클라 공식 상이, 백테스트≠라이브 모델, CI 헤드리스 갭 등 + Sonnet 5 로드맵 Phase 0~3 | 로드맵 항목 완료/구조 변경 시 |
| `FABLE-LIVE-AUDIT-2026-07-04.md` | v52.4 라이브 전수 감사 P0~P6 백로그 — P0/P1은 v52.5/52.6, P2~P6은 v52.7~v52.18에서 전체 완료(CHANGELOG 참조) | 재감사/항목 완료 시 |
| `FABLE-ARCH-DIAGNOSIS-2026-07-06.md` | v52.18 전수 아키텍처 진단(7축 스코어카드, 커버리지 정직표, 07-02 진단 해소 8건 코드 대조) + Sonnet 5 인수인계 로드맵 Phase 0~4. P1: `fetchKrDynamicData` 그림자 선언 + R280 기계 게이트 부재. 헤드리스 899/922 재현 실측 | 로드맵 항목 완료/구조 변경 시 |
| `INDEX.md` | This index | Any `_context` document add/remove |

> 23개 Git-tracked + `FABLE-ARCH-DIAGNOSIS-2026-07-06.md`(디스크상 존재, 커밋 전) = 24개 `_context/*.md` 활성(2026-07-06 `git ls-files` 실측). 추가로 루트에 `EVIDENCE-DEBT.md`(v50.x evidence-first 부채 대장)가 있으며 `_context` 밖이지만 evidence 게이트의 SSOT다. `_context/archive-reports/`, `working-rules.md`, `voice-and-style.md`는 `.gitignore` 대상(로컬 전용 레거시).

## Current Deployment Baseline

- **GitHub baseline (source of truth)**: `origin/main` at `5d54f39` (`v52.18`, 2026-07-05) — `git log --oneline -1` 실측(2026-07-06). 이전 기재값(`d6902a1`/v51.90/2026-07-02)은 28버전 stale이었음(정정 — 이 항목은 버전업마다 낡으므로 절대 신뢰 금지, 항상 `git log` 재실측).
- **로컬 워크트리**: `git worktree list` 실측 결과 **별도 워크트리 없음** — 작업 디렉터리 자체가 `main` 브랜치(clean, origin/main과 동기). 이전 기재된 `claude/hungry-euler-8d3b20`, `.codex/worktrees/540d/AIO`는 더 이상 존재하지 않음(디렉터리 없음 확인) — 삭제.
- **Live site**: `https://ysnle.github.io/aio-screener/`
- **게이트 실측 baseline**: `GATE-BASELINE-2026-06-04.md`(v50.4, 673/692 pass, 1회성 수동측정)는 `GATE-BASELINE-2026-07-03.md`(v51.96, 896/921 pass)로 후속됨 — Phase 2 [B5] 완료로 `.github/workflows/ci.yml`의 `headless-tests` job이 매 push/PR마다 `scripts/ci-headless-tests.mjs`(Playwright)를 자동 실행해 **상설화됨**(report-only, `continue-on-error: true`, 아직 deploy 게이트 미편입). **2026-07-06 재실측(v52.19)**: 899/922 pass, `_context/gate-baseline-skip-list.json` 23건(문서 기재 25건에서 두 건 추가 해소 — 단 이 skip-list JSON 자체가 이제 GATE-BASELINE-2026-07-03.md 서술보다 최신임. 문서 갱신은 새 GATE-BASELINE 파일 작성 없이 skip-list JSON만 직접 수정된 상태 — `_context/FABLE-ARCH-DIAGNOSIS-2026-07-06.md` Phase 2-6이 이 23건 자체의 triage를 다룸).
- **저장소 상태(2026-07-06 갱신)**: 2026-07-02에 로컬 `.git`이 OneDrive 동기화 폴더 안에서 loose object 2.4GiB+gc 실패 잔해로 병들어 있던 상태를 `git gc --aggressive --prune=now`로 복구(→ 12.21MiB) 후 리포를 OneDrive 밖(`C:\Projects\AIO`)으로 이전 완료(운영자 결정 완료, 재발 구조적으로 차단됨). **2026-07-06 재실측**: 정상 운영 중 자연 누적된 loose object 663개/78.5MB를 `git gc`로 재정리(→ pack 12.61MiB, `git fsck --full` clean) — OneDrive 문제가 아니라 30분 주기 데이터 커밋의 정상적 누적이었음, 주기적 gc가 유지보수 항목으로 남음.
- **Primary source of truth**: GitHub `origin/main` plus live asset parity.

## Current File Structure

```text
AIO/
├── index.html · version.json · sw.js (manifest.json은 P310/v49.43에서 삭제됨 — 실존 안 함)
├── js/
│   ├── aio-core.js · aio-data.js · aio-ui.js · aio-chat.js · aio-tests.js · aio-glossary.js
├── scripts/              ← fetch-data.mjs · fetch-telegram-digest.mjs · ci-*.mjs(9종) · bump-version.mjs
├── .github/workflows/    ← ci.yml · refresh-data.yml · data-watchdog.yml
├── public-data/          ← data.json · history.json · screener.json · telegram-digest.json · operator-note.json
├── CHANGELOG.md · CLAUDE.md · api_setup_guide.html · cloudflare-worker-proxy.js
├── _context/             ← Git-tracked 위키 (위 표 참조, 21개)
└── .claude/               ← 전부 Git-tracked (2026-05-18~)
    ├── agents/            ← 4개 서브에이전트 (accessibility-auditor · code-reviewer · performance-analyzer · qa-auditor)
    ├── commands/           ← 9개 wrapper
    ├── hooks/              ← 6개 (PreToolUse/PostToolUse/Stop)
    └── skills/             ← 7개: _shared · autoresearch · bug-fix · data-refresh · integrate · knowledge-lint · post-edit-qa
```

> 상세 hooks/commands 매핑은 `_context/CLAUDE.md` 참조(2026-07-02 인코딩 파손 복구 + 실측 재작성됨).

## Backlink Map

- `RULES.md` links recurring failures to enforceable rules.
- `WORKFLOW-GOVERNANCE.md` turns lessons into runnable gates and defines the required preflight for agents/skills.
- `BUG-POSTMORTEM.md` records bug causes and promotes repeated patterns into rules.
- `QA-CHECKLIST.md` turns rules and bugs into runnable checks.
- `CODE-MAP.md` prevents partial patches from targeting stale line ranges.
- `WORKTREE-AUDIT.md` prevents confusing unpublished Claude worktree changes with deployed GitHub state.
- `DEEP-QA-2026-05-05.md` records the latest local-vs-live deep QA matrix.
- `OPERATIONS-AUDIT-2026-05-06.md` records runtime/cache/API self-operation checks for deployed operations.
- `DATA-PIPELINE-AUDIT-2026-05-06.md` records source-to-render data lineage and release QA commands.
- `ARCHITECTURE-AUDIT-2026-05-10.md` / `DATA-FRESHNESS-AUDIT-2026-05-10.md` record the v49.3/v49.4 reinforcement summaries that the v50.x evidence layer builds on.

## Maintenance Rule

When a new `_context` document is added or removed, update this file and `_context/CLAUDE.md` in the same change.

## Workflow Compaction

- Current active gates: R219 semantic review and R220 workflow compaction.
- Run `node scripts/ci-semantic-review-check.mjs` when audit/readiness/page/AI/data/trading gates change.
- Run `node scripts/ci-workflow-compaction-check.mjs` when `_context`, `CLAUDE.md`, QA, postmortem, or skill guidance changes.
- Treat `BUG-POSTMORTEM.md`, `RULES.md`, and `QA-CHECKLIST.md` as archives plus active gates. Do not expand them without checking whether older guidance can be removed, merged, compressed, or moved into a reference.
- Root `.claude/skills/*/SKILL.md` files are router files. Keep recurring obligations in `.claude/skills/_shared/operating-contract.md`, move long skill detail into directly linked `references/`, and let `scripts/ci-skill-contract-check.mjs` enforce router size/reference existence.
