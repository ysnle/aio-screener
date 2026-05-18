# /integrate — 자료 통합 워크플로우

이 커맨드는 **`integrate` 스킬의 실행 진입점**이다. 실제 통합 절차와 상세는 `.claude/skills/integrate/SKILL.md`가 단일 진실의 원천이다.

---

## 트리거 조건
- 사용자가 `/integrate` 명시 호출
- 사용자가 분석글/칼럼/리포트/인터뷰 내용을 보내며 통합 요청

---

## 실행 지시

**반드시** `.claude/skills/integrate/SKILL.md`를 읽고 그 절차를 따른다. 이 파일에는:
- 자료 유형 분류 + 핵심 티커 추출
- 프레임워크/사고 구조 추출 (등급/목표주가가 아닌 논리 체계)
- CHAT_CONTEXTS / SCREENER_DB / KW / KNOWLEDGE-BASE 환류 (E1~E9)
- working-rules.md 자료 분류 기준

---

## 실행 전 필수 읽기
1. `_context/RULES.md` — R13(CHAT_CONTEXTS 이원화), R14(뉴스 키워드), R17(키워드 길이)
2. `_context/working-rules.md` — 자료 분류 기준
3. `_context/CODE-MAP.md` — 수정 대상 라인 범위 파악

---

## 핵심 원칙
> 등급/목표주가는 결과물이다. 반영해야 할 것은 그 결론을 만든 **사고 구조**와 **논리 체계**다.
