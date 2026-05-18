# /knowledge-lint — 지식 베이스 정합성 린팅

이 커맨드는 **`knowledge-lint` 스킬의 실행 진입점**이다. 실제 린팅 절차와 7단계 상세는 `.claude/skills/knowledge-lint/SKILL.md`가 단일 진실의 원천이다.

---

## 트리거 조건
- 사용자가 `/knowledge-lint` 명시 호출
- 대규모 수정 후 _context/ 정합성 확인 필요 시
- 분기 1회 이상 주기적 실행 (R19)

---

## 실행 지시

**반드시** `.claude/skills/knowledge-lint/SKILL.md`를 읽고 그 절차를 따른다. 이 파일에는:
- L1: 규칙-포스트모템 교차 참조 (P→R 매핑)
- L2: 규칙-QA체크리스트 교차 참조
- L3: 코드 참조 실재성 검증
- L4: 버전/날짜 최신성
- L5: 중복/모순 규칙 탐지
- L6: INDEX.md 자동 갱신 (R24)
- L7: violated_rule 빈도 집계 (R25)

---

## 실행 전 필수 읽기
1. `_context/RULES.md` — R19(린팅 규칙), R20(검증 상태), R24(인덱스), R25(역참조)
2. `_context/INDEX.md` — 현재 인덱스 상태
