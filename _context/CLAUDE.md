# AIO Screener — _context/ 프로젝트 컨텍스트

> 프로젝트 전체 가이드는 **루트 `CLAUDE.md`** 참조. 이 파일은 _context/ 고유 정보만 담는다.

- **현재 버전**: v42.7

## 새 대화 시작 시 필수 읽기 순서

1. 루트 `CLAUDE.md` -- 프로젝트 개요 + 절대 규칙 + 작업 규칙
2. `_context/RULES.md` -- 마스터 룰 R1~R26
3. `_context/BUG-POSTMORTEM.md` -- 과거 버그 사후 분석 (같은 실수 반복 방지)
4. `CHANGELOG.md` (최근 5개 항목) -- 현재 버전, 최근 변경 내역
5. `_context/QA-CHECKLIST.md` -- 수정 후 점검 절차

## _context/ 문서 역할

| 문서 | 역할 |
|------|------|
| RULES.md | 마스터 룰 R1~R26 -- 모든 작업의 최상위 규칙 |
| BUG-POSTMORTEM.md | 버그 사후 분석 + violated_rule 역참조 (R25) |
| QA-CHECKLIST.md | 실행 가능한 QA 체크리스트 v3 |
| KNOWLEDGE-BASE.md | 기술 인사이트 축적 (R26) -- API quirks, 패턴, 교훈 |
| INDEX.md | 지식 베이스 자동 인덱스 + 연결 관계 맵 (R24) |
| working-rules.md | 작업 규칙 (백업, 변경기록, 버전 관리) |
| voice-and-style.md | 코딩 스타일 가이드 (네이밍, 포맷) |
| archive-reports/ | 과거 버전별 리포트 아카이브 (35건) |

## 지식 관리 시스템 (Knowledge Management)

카파시 LLM Wiki 패턴 기반. _context/ 문서의 건강 상태 + 지식 축적 + 역참조를 관리.

- `/knowledge-lint` 실행 -> 7단계 교차 점검 (L1~L7)
  - L1~L5: 규칙-포스트모템-QA 교차 참조, 코드 실재성, 버전/날짜, 중복/모순
  - **L6**: INDEX.md 자동 갱신 (R24)
  - **L7**: violated_rule 빈도 분석 -- 3회 이상 위반 규칙 자동 플래그 (R25)
- `KNOWLEDGE-BASE.md`: 기술 인사이트 축적 파일 (R26) -- API 동작, 브라우저 quirks, 패턴
- `INDEX.md`: _context/ 전체 문서 자동 인덱스 + 연결 관계 맵 (R24)
- 핵심 문서 프론트매터에 `verified_by` / `last_verified` / `confidence` 표기 (R20)
- 에이전트 산출물(agent)과 사용자 검증(human) 구분 -> 신뢰도 관리

## QA 시스템

- 코드 수정 후 -> `QA-CHECKLIST.md` 따라 런타임 검증
- 버그 수정 후 -> `BUG-POSTMORTEM.md`에 사후 분석 기록 (R3)
- 모든 작업 후 -> `CHANGELOG.md`에 변경 이력 기록
- 상세 규칙 -> `RULES.md` 참조

## Hook/Skill 시스템

```
.claude/
├── hooks/
│   ├── protect-files.sh     ← PreToolUse: 백업/아카이브 파일 덮어쓰기 차단
│   ├── block-dangerous.sh   ← PreToolUse: rm -rf, force push 등 위험 명령 차단
│   └── validate-edit.sh     ← PostToolUse: index.html div 균형 자동 체크
└── skills/
    ├── bug-fix/             ← /bug-fix: 버그 수정 워크플로우
    ├── post-edit-qa/        ← /qa: 수정 후 QA
    ├── integrate/           ← /integrate: 자료 통합
    └── knowledge-lint/      ← /knowledge-lint: 지식 베이스 린팅
```
