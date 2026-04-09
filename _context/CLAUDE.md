# AIO Screener — _context/ 프로젝트 컨텍스트

> 프로젝트 전체 가이드는 **루트 `CLAUDE.md`** 참조. 이 파일은 _context/ 고유 정보 + 파일 구조 + Hook 시스템을 담는다.

- **현재 버전**: v45.5

## _context/ 문서 역할

| 문서 | 역할 |
|------|------|
| RULES.md | 마스터 룰 R1~R26 — 모든 작업의 최상위 규칙 |
| BUG-POSTMORTEM.md | 버그 사후 분석 + violated_rule 역참조 (R25) |
| QA-CHECKLIST.md | 실행 가능한 QA 체크리스트 v3.3 |
| KNOWLEDGE-BASE.md | 기술 인사이트 축적 (R26) — API quirks, 패턴, 교훈 |
| **CODE-MAP.md** | **index.html 38,250줄 line 범위 맵 — 부분 읽기 가이드** |
| INDEX.md | 지식 베이스 자동 인덱스 + 연결 관계 맵 (R24) |
| working-rules.md | 작업 규칙 (백업, 변경기록, 자료 분류, 버전 관리) |
| voice-and-style.md | 코딩 스타일 가이드 (네이밍, 포맷) |
| archive-reports/ | 과거 버전별 리포트 아카이브 |

## 프로젝트 파일 구조

```
AIO/
├── index.html                      ← 메인 (= 최신 버전, ~38,250줄)
├── aio_ui_prototype_v{N}.html      ← 버전별 스냅샷 (덮어쓰기 금지)
├── version.json                    ← 현재 버전 메타데이터
├── CHANGELOG.md                    ← 전체 변경 이력
├── cloudflare-worker-proxy.js      ← CORS 프록시 워커
├── _backup/                        ← 수정 전 백업본
├── _archive/                       ← 이전 버전 보관
├── _context/                       ← 지식 베이스 (유일한 진실의 원천)
│   ├── RULES.md / BUG-POSTMORTEM.md / QA-CHECKLIST.md
│   ├── KNOWLEDGE-BASE.md / CODE-MAP.md / INDEX.md
│   ├── working-rules.md / voice-and-style.md
│   └── archive-reports/            ← 과거 버전별 리포트 (stale 문서 이동처)
├── .claude/
│   ├── hooks/                      ← 자동 실행 Hook
│   ├── commands/                   ← 슬래시 커맨드 wrapper
│   └── skills/                     ← 스킬 (진짜 스펙)
└── outputs/                        ← 생성 결과물
```

## Hook 시스템 (자동 방어)

CLAUDE.md 규칙을 "제안"이 아닌 "강제"로 만드는 자동 Hook. `.claude/settings.local.json`에서 관리.

| Hook | 타이밍 | 역할 |
|------|--------|------|
| `protect-files.sh` | PreToolUse (Edit/Write) | 백업 파일(v*.html), _backup/, _archive/ 덮어쓰기 차단 |
| `block-dangerous.sh` | PreToolUse (Bash) | rm -rf, git reset --hard, force push 차단 |
| `validate-edit.sh` | PostToolUse (Edit/Write) | index.html 수정 시 div 열림/닫힘 균형 자동 검증 |

exit 2 = 차단 + 사유 전달, exit 0 = 통과.

## 지식 관리 시스템

카파시 LLM Wiki 패턴 기반. _context/ 문서의 건강 상태 + 지식 축적 + 역참조를 관리.

- `/knowledge-lint` 실행 → 7단계 교차 점검 (L1~L7)
  - L1~L5: 규칙-포스트모템-QA 교차 참조, 코드 실재성, 버전/날짜, 중복/모순
  - **L6**: INDEX.md 자동 갱신 (R24)
  - **L7**: violated_rule 빈도 분석 — 3회 이상 위반 규칙 자동 플래그 (R25)
- `KNOWLEDGE-BASE.md`: 기술 인사이트 축적 (R26) — API 동작, 브라우저 quirks, 패턴
- `INDEX.md`: _context/ 전체 문서 자동 인덱스 + 연결 관계 맵 (R24)
- 핵심 문서 프론트매터에 `verified_by` / `last_verified` / `confidence` 표기 (R20)
- 에이전트 산출물(agent)과 사용자 검증(human) 구분 → 신뢰도 관리

## QA 워크플로우

- 코드 수정 후 → `QA-CHECKLIST.md` 따라 런타임 검증
- 버그 수정 후 → `BUG-POSTMORTEM.md`에 사후 분석 기록 (R3)
- 모든 작업 후 → `CHANGELOG.md`에 변경 이력 기록
- 상세 규칙 → `RULES.md` 참조
