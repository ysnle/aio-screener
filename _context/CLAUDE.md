# AIO Screener — _context/ 프로젝트 컨텍스트

> 루트 `CLAUDE.md` = 얇은 절대 규칙 + 작업 규칙. 이 문서 = 파일 구조 + Hook + Skills 매핑 + 복리 루프.
> 2026-07-02: 디스크 인코딩 손상(이중 인코딩 mojibake)으로 전면 재작성. 아래 hooks/commands/agents 추적 상태는
> `git ls-files` 실측 기반(이전 버전의 "GitHub-tracked에는 hooks 없음" 서술은 2026-05-18 이후로는 틀린 정보였음).

- **현재 버전**: v52.51
- **전체 버전 이력 → CHANGELOG.md** (상세 변경 내역의 단일 출처). 이 문서는 구조·Hook·Skills·복리 루프만 유지하고 버전별 변경 내역은 담지 않는다.

## _context/ 문서 (30개 활성, 2026-07-10 갱신)

| 문서 | 역할 | 갱신 트리거 |
|------|------|-----------|
| CLAUDE.md | 이 파일: 구조, hooks, skills, 복리 루프 | 구조 또는 워크플로 변경 시 |
| WORKFLOW-GOVERNANCE.md | Agent preflight, postmortem-to-gate, skill/self-operation closure contract | Workflow/skill/CI 게이트 변경 시 |
| RULES.md | 마스터 룰 R1~R268 | 새 규칙/패턴 발견 시 |
| BUG-POSTMORTEM.md | 버그 사후 분석 P1~P581 (R25 재발 추적) | 버그 수정 시 |
| QA-CHECKLIST.md | QA 14단계 체크리스트 | /qa 발견 시 |
| KNOWLEDGE-BASE.md | 기술 인사이트 축적 (R26) | 인사이트 발견 시 |
| CODE-MAP.md | index.html + js 모듈 line 범위 맵 | 리팩토링 ±500줄 |
| INDEX.md | 지식 베이스 인덱스 + 배포 baseline (R24) | /knowledge-lint L6, _context 문서 추가/제거 시 |
| WORKTREE-AUDIT.md | GitHub/live/worktree 라우팅 + 미배포 작업 인벤토리 | 워크트리 병합/배포/감사 시 |
| DEEP-QA-2026-05-05.md | UI/API/페이지 로직 심층 QA 결과 | 심층 QA 또는 live/local parity 변경 시 |
| OPERATIONS-AUDIT-2026-05-06.md | 운영 지속성/자체 진단/캐시 SW 감사 | 운영/배포 하드닝 변경 시 |
| DATA-PIPELINE-AUDIT-2026-05-06.md | API/전송/저장/분석/렌더 sink까지 데이터 파이프라인 맵 | API/분석/렌더 파이프라인 변경 시 |
| ARCHITECTURE-AUDIT-2026-05-10.md | v49.3 아키텍처 보강 요약 | 데이터 함수/리스크 레이어 변경 시 |
| DATA-FRESHNESS-AUDIT-2026-05-10.md | v49.4 데이터 최신화 자동 갱신 보강 요약 | freshness policy/source/stale 기준 변경 시 |
| GATE-BASELINE-2026-06-04.md | v50.4 evidence 게이트 단위테스트 실측 기준선 | 게이트/테스트 재측정 시 |
| GATE-BASELINE-2026-07-03.md | v51.91→v51.96 헤드리스 CI 테스트 실측 기준선(894/921→896/921 pass, T776/T686 해소) — Phase 2 [B5] + 전체 /data-refresh | skip-list 갱신, 헤드리스 재측정 시 |
| CHAT-DATA-AUDIT-2026-06-04.md | v50.8 AI 채팅 데이터 출처 전수 감사 baseline | 채팅 데이터 경로/컨텍스트 변경 시 |
| FRONTEND-UX-AUDIT-2026-06-05.md | v50.12 21페이지 라이브 프론트엔드/UX audit + P0/P1/P2 백로그 | UI/UX 시정·페이지 구조 변경 시 |
| OPUS-HANDOFF-STRUCTURAL-AUDIT-2026-06-10.md | v50.23 구조 전수 감사 + Opus 작업 백로그 WO-1~14 (P0 5건 전부 해소됨) | WO 항목 완료/구조 변경 시 |
| PAGE-UX-AUDIT-2026-06-13.md | 페이지별 UX 감사 (일부 항목은 이후 라이브 검증에서 거짓양성 판정 — DEFERRED-BLOCKS §3 참조) | UI/UX 재점검 시 |
| DEFERRED-BLOCKS.md | 미뤄둔 작업 / 진짜 블록 현황 (데이터·시간·운영자 결정 구분) | 블록 해제/작업 착수 시 |
| FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md | v52.2 시스템 뼈대 진단(아키텍처/자동화/알고리즘) + Sonnet 5 작업 로드맵 Phase 0~3 | 로드맵 항목 완료/구조 변경 시 |
| FABLE-LIVE-AUDIT-2026-07-04.md | v52.4 라이브 전수 감사 P0~P6 백로그 (v52.5~v52.18 전체 완료) | 재감사/항목 완료 시 |
| FABLE-ARCH-DIAGNOSIS-2026-07-06.md | v52.18 전수 아키텍처 진단(7축) + Sonnet 5 인수인계 로드맵 Phase 0~4 | 로드맵 항목 완료/구조 변경 시 |
| FABLE-LIVE-AUDIT-2026-07-07.md | KOSPI -8% 폭락일 라이브 실측 감사(C/L/F/U/X 발견 대장) + 구조 개선 Phase L0~L5. L0~L4 전체(P634-P641, v52.24~26) 같은 세션 실행 완료(§6, L0-1은 운영자 조치까지 완료) | 로드맵 항목 완료/재감사 시 |
| FABLE-UIUX-DEEP-AUDIT-2026-07-08.md | UI/UX 심층 라이브(v52.26) 감사 — QA 미확인 백로그+P634~P641 검증 원장 + 신규 발견 UX-01~13(showThemeDetail P0 크래시·프록시 SPOF·AI 백엔드 이원화 등) + 구조 개선 Phase V0~V4·운영자 결정 카드 | 로드맵 항목 완료/재감사 시 |
| FABLE-EDU-OVERHAUL-DESIGN-2026-07-09.md | 22페이지 교육 레이어 전수 감사(E1~E5 매트릭스) + `AIO_PAGE_FUNDAMENTALS` 컴포넌트 설계 + 페이지별 콘텐츠 원고 + 게이트 계획 — **v52.39에서 구현 완료**(P654/R291/T869, 로컬 미배포) | 재감사 시 |
| FABLE-EFFICACY-AUDIT-2026-07-10.md | 라이브(v52.34) 페이지별 시장데이터 완비·사용성·실효성 실측 진단(§1 매트릭스, 17.5/22페이지) + 발견 EF-01~18 + 보강 설계 Batch 1~4 — **차기 구현 진입점(§5, Sonnet 5 체크리스트)**, 미점검 잔여 §4 명시 | 구현 완료/재감사 시 |
| CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md | v52.43 저장소·라이브·GitHub/Pages/Actions·보안·데이터·아키텍처·알고리즘 종합 진단 + 후속 에이전트 작업 패킷 WO-0~8 | 각 WO 완료/전수 재감사 시 |
| CODEX-SECOND-PASS-HANDOFF-2026-07-10.md | 1차 종합 진단과 22페이지 프론트엔드 추가 진단을 통합한 2차 실행 원장. 기존 WO local/live 재분류, H2-00~16 설계, 외부 공개 BETA/PUBLIC/CLAIMS 게이트, Luna용 작업 계약 | H2 항목 완료·라이브 parity·Tier 13 재감사 시 |

> 루트 밖 `EVIDENCE-DEBT.md`(repo root)가 evidence 게이트의 SSOT로 별도 존재.
> `_context/archive-reports/`, `working-rules.md`, `voice-and-style.md`는 `.gitignore`로 로컬 전용(레거시, RULES/QA로 대체됨).

## 파일 구조

```
AIO/
├── index.html · version.json · sw.js (manifest.json은 P310에서 삭제됨)
├── js/
│   ├── aio-core.js · aio-data.js · aio-ui.js · aio-chat.js · aio-tests.js · aio-glossary.js
├── scripts/            ← fetch-data.mjs · fetch-telegram-digest.mjs · ci-*.mjs 12종(R290 신규 2종 포함) · bump-version.mjs
├── CHANGELOG.md · CLAUDE.md · cloudflare-worker-proxy.js
├── _context/           ← Git-tracked 위키 (위 표 참조)
├── .github/workflows/  ← ci.yml · refresh-data.yml · data-watchdog.yml · knowledge-lint.yml(R290 신규)
└── .claude/             ← 전부 Git-tracked (2026-05-18~, 09d2200 이후)
    ├── agents/          ← 4개: accessibility-auditor · code-reviewer · performance-analyzer · qa-auditor
    ├── commands/         ← 9개 wrapper (아래 표)
    ├── hooks/            ← 7개(아래 표), settings.local.json에 배선
    ├── skills/           ← 7개: _shared · autoresearch · bug-fix · data-refresh · integrate · knowledge-lint · post-edit-qa
    └── settings.local.json ← hooks 배선 + 권한 설정. **Git-tracked 아님**(gitignore) — 2026-07-04 감사 때
        `git rm --cached`로 재추적 방지 처리됨(머신별 개인 설정이라 팀 공유 대상 아님).
        `_context/CLAUDE.md`(이 문서) 구버전이 "Git-tracked"라고 잘못 적어뒀던 것을 v52.47 WO-5에서 정정.
```

> 이전 버전 문서(및 `_context/CODE-MAP.md` 하단 메모)의 "`.claude/commands`와 `.claude/hooks`는
> GitHub-tracked checkout에 없다"는 서술은 **2026-05-18(커밋 09d2200) 이후로는 사실이 아니다** — 실측 정정.
> `.agents/`(리포 루트, 빈 플레이스홀더)와 `.claude/agents/`(4개 서브에이전트 정의)는 별개 경로다.

## Commands ↔ Skills (R27: 새 스킬 시 wrapper 동시 생성)

| `/command` | skill | eval |
|------------|-------|------|
| `/deploy` | 인라인 | — |
| `/qa` | post-edit-qa | T1~T14, Q1~Q7 |
| `/bug-fix` | bug-fix | B1~B6 |
| `/integrate` | integrate | E1~E9 |
| `/data-refresh` | data-refresh | D1~D8 |
| `/session-save` | 인라인 | S1~S6 |
| `/knowledge-lint` | knowledge-lint | L1~L7 |
| `/version-up` | 인라인 | — |
| `/autoresearch` | autoresearch | — |

## Hook 시스템 (`.claude/hooks/`, Git-tracked, `settings.local.json`(개인 설정·비-Git)에 배선됨)

| Hook | 트리거 | 역할 |
|------|--------|------|
| `protect-files.sh` | PreToolUse | 백업/아카이브 덮어쓰기 차단 |
| `block-dangerous.sh` | PreToolUse | rm -rf, force push 차단 |
| `validate-edit.sh` | PostToolUse | div 닫힘/괄호 균형 검증 |
| `check-antipatterns.sh` | PostToolUse | alert()/confirm(), `d.pct\|\|0`, 금지 핫코드 감지 |
| `check-version-sync.sh` | PostToolUse | R1 버전 동기화 자동 검증(index.html·APP_VERSION·version.json·CLAUDE.md). v52.47: 소수점 뒤 1자리 고정 정규식 버그 수정(두 자리 patch 오인식 가능성 해소) |
| `session-start-snapshot.sh` | SessionStart | 세션 시작 시점 `git status --porcelain` 스냅샷 기록(v52.47 WO-5 신규) |
| `auto-commit-on-stop.sh` | Stop | 세션 종료 시 미푸시 변경사항 WIP 자동 커밋. v52.47: 스냅샷과 대조해 "이번 세션에 새로 dirty해진 경로"만 스테이징 — 세션 시작 전부터 있던 무관한 파일을 더 이상 쓸어담지 않음(`.codex/`도 동일 로직으로 미러링) |

## 복리 루프 (Karpathy Second Brain)

```
작업 수행 → 산출물 → _context/ 환류 → 실행 게이트/CI 연결 → 다음 작업이 더 정확
```

| 작업 | 환류 대상 |
|------|----------|
| 버그 수정 | BUG-POSTMORTEM → 3회 반복 시 RULES 승격 |
| /integrate | CHAT_CONTEXTS + SCREENER_DB + TECH_KW/MACRO_KW + KNOWLEDGE-BASE |
| /qa | QA-CHECKLIST 항목 추가 |
| /data-refresh | DATA_SNAPSHOT + 텍스트 정합성 + staleness table |
| 인사이트 | KNOWLEDGE-BASE (R26) |
| /knowledge-lint | INDEX.md + violated_rule 빈도 |

**에러 복리 방지**: 추측 판단 금지(코드 확인 없이 단정 금지) + `/knowledge-lint` 주 1회+ 실행 + `verified_by: agent/human` 구분 표기.
