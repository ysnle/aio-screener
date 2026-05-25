# AIO Screener — _context/ 프로젝트 컨텍스트

> 루트 `CLAUDE.md` = 절대 규칙 + 작업 규칙. 이 파일 = 파일 구조 + Hook + Skills + 복리 루프.

- **현재 버전**: v49.70

## _context/ 문서 (13개 Git-tracked 활성)

| 문서 | 역할 | 갱신 트리거 |
|------|------|-----------|
| CLAUDE.md | 이 파일: 구조, hooks, skills, 복리 루프 | 구조 또는 워크플로 변경 시 |
| RULES.md | 마스터 룰 R1~R29 | 새 규칙/패턴 발견 시 |
| BUG-POSTMORTEM.md | 버그 사후 분석 P1~P293 (R25 역참조) | 버그 수정 후 |
| QA-CHECKLIST.md | QA 14티어 체크리스트 v3.3 | /qa 발견 시 |
| KNOWLEDGE-BASE.md | 기술 인사이트 축적 (R26) | 인사이트 발견 시 |
| CODE-MAP.md | index.html + js 모듈 line 범위 맵 | 리팩토링 ±500줄 |
| INDEX.md | 지식 베이스 인덱스 + 백링크 (R24) | /knowledge-lint L6 |
| WORKTREE-AUDIT.md | GitHub/live/worktree 라우팅 + 미배포 작업 인벤토리 | 워크트리 병합/배포/감사 |
| DEEP-QA-2026-05-05.md | UI/API/페이지 로직 심층 QA 결과 | 심층 QA 또는 live/local parity 변경 |
| OPERATIONS-AUDIT-2026-05-06.md | 운영 지속성/자체 진단/캐시 회전 점검 | 런타임 또는 배포 운영성 변경 |
| DATA-PIPELINE-AUDIT-2026-05-06.md | API/소스부터 렌더 sink까지 데이터 파이프라인 레이어 맵 | API/분석/렌더 파이프라인 변경 |
| ARCHITECTURE-AUDIT-2026-05-10.md | v49.3 전수감사 보고서 기반 아키텍처 보강 요약 | 데이터/함수/리스크 레이어 변경 |
| DATA-FRESHNESS-AUDIT-2026-05-10.md | v49.4 데이터 최신성/자동 갱신 보강 요약 | freshness policy/source/stale 기준 변경 |

## 파일 구조

```
AIO/
├── index.html · version.json · manifest.json · sw.js
├── js/
│   ├── aio-core.js · aio-data.js · aio-ui.js · aio-chat.js · aio-tests.js · aio-glossary.js
├── CHANGELOG.md · CLAUDE.md · api_setup_guide.html · cloudflare-worker-proxy.js
├── _context/           ← Git-tracked 위키 (위 11개 문서)
├── .claude/
│   └── skills/         ← Git-tracked 3개: bug-fix · data-refresh · integrate
```

> 참고: 일부 Claude 로컬 워크트리는 `.claude/commands`, `.claude/hooks`, 추가 skills/agents를 별도 운영 파일로 보유할 수 있다. GitHub 배포 기준 점검은 Git-tracked 파일을 우선한다.

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

## Hook 시스템

GitHub-tracked v49.1 통합본에는 hooks가 포함되어 있지 않다. Claude 로컬 운영 워크트리에 hooks가 있을 때만 아래 레이어를 적용한다.

| Hook | 타이밍 | 역할 |
|------|--------|------|
| `protect-files.sh` | PreToolUse | 백업/아카이브 덮어쓰기 차단 |
| `block-dangerous.sh` | PreToolUse | rm -rf, force push 차단 |
| `validate-edit.sh` | PostToolUse | div 열림/닫힘 균형 검증 |
| `check-antipatterns.sh` | PostToolUse | alert()/confirm(), d.pct\|\|0, 극소 폰트 감지 |
| `check-version-sync.sh` | PostToolUse | R1 버전 6곳 동기화 자동 검증 (index.html·APP_VERSION·version.json·CLAUDE.md) |
| `auto-commit-on-stop.sh` | Stop | 세션 종료 시 미커밋 변경사항 WIP 자동 저장 |

## 복리 루프 (Karpathy Second Brain)

```
원본 투입 → 작업 → 산출물 → _context/ 환류 → 다음 작업 정확도↑
```

| 작업 | 환류 대상 |
|------|----------|
| 버그 수정 | POSTMORTEM → 3회 반복 시 RULES 승격 |
| /integrate | CHAT_CONTEXTS + SCREENER_DB + KW + KNOWLEDGE-BASE(E9) |
| /qa | QA-CHECKLIST 항목 추가 |
| /data-refresh | DATA_SNAPSHOT + 텍스트 정합성 |
| 인사이트 | KNOWLEDGE-BASE (R26) |
| /knowledge-lint | INDEX.md + violated_rule 빈도 |

**에러 복리 방지**: 추측 판단 금지(P68) + /knowledge-lint 주 1회+ + verified_by agent/human 구분
