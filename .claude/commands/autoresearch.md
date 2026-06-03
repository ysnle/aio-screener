# /autoresearch — 스킬 자율 최적화 루프

이 커맨드는 **`autoresearch` 스킬의 실행 진입점**이다. 실제 최적화 절차와 상세는 `.claude/skills/autoresearch/SKILL.md`가 단일 진실의 원천이다.

---

## 트리거 조건
- 사용자가 `/autoresearch` 명시 호출
- 스킬 품질 개선, 성능 벤치마크, 자동 최적화 필요 시

---

## 실행 지시

**반드시** `.claude/skills/autoresearch/SKILL.md`를 읽고 그 절차를 따른다. 이 파일에는:
- Karpathy autoresearch 방법론 적용
- 바이너리 yes/no 평가 기준 정의
- 자율 루프: 생성 → 채점 → 단일 변수 변경 → 유지/롤백
- 출력: 개선된 SKILL.md + results.tsv + changelog.md + HTML 대시보드

---

## 사용법
```
/autoresearch {스킬명}           — 기본 실행
/autoresearch {스킬명} --runs=20 — 반복 횟수 지정
```
