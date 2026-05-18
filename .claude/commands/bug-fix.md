# /bug-fix — 버그 수정 자동 워크플로우

이 커맨드는 **`bug-fix` 스킬의 실행 진입점**이다. 실제 수정 절차와 상세는 `.claude/skills/bug-fix/SKILL.md`가 단일 진실의 원천이다.

---

## 트리거 조건
- 사용자가 `/bug-fix` 명시 호출
- 사용자가 버그/문제/오류를 보고했을 때

---

## 실행 지시

**반드시** `.claude/skills/bug-fix/SKILL.md`를 읽고 그 절차를 따른다. 이 파일에는:
- 근본 원인 분석 (BUG-POSTMORTEM 참조)
- 최소 범위 패치 원칙
- 사후 분석 기록 (R3)
- 예방 규칙 생성
- 바이너리 Self-Eval (B1~B6)

---

## 실행 전 필수 읽기
1. `_context/RULES.md` — 마스터 룰
2. `_context/BUG-POSTMORTEM.md` — 과거 유사 버그 확인
3. `_context/CODE-MAP.md` — 수정 대상 라인 범위 파악
4. `_context/QA-CHECKLIST.md` — 수정 후 점검 항목

---

## 수정 후 필수
- BUG-POSTMORTEM.md에 P번호 사후 분석 추가 (R3)
- violated_rule 태그 기록 (R25)
- 버전 6곳 동기화 확인 (R1)
- 3회 반복 패턴이면 RULES.md 승격 검토
