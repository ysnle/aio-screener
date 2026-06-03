# /data-refresh — 전체 하드코딩 데이터 최신화

이 커맨드는 **`data-refresh` 스킬의 실행 진입점**이다. 실제 점검 절차와 22개 카테고리 상세는 `.claude/skills/data-refresh/SKILL.md`가 단일 진실의 원천이다.

---

## 트리거 조건
- 사용자가 `/data-refresh` 명시 호출
- 매일 일간 데이터 갱신
- 주요 발표(FOMC/CPI/NFP/ISM/OPEC) 직후
- 지정학적 충격 발생 후 24h 이내
- DATA_SNAPSHOT._updated 경과일 1일+ 시

---

## 실행 지시

**반드시** `.claude/skills/data-refresh/SKILL.md`를 읽고 그 절차를 따른다. 이 파일에는:
- 22개 데이터 카테고리 전수 경과일 스캔
- 카테고리별 갱신 소스 + bash 명령
- 바이너리 Self-Eval (D1~D8)

---

## 실행 전 필수 읽기
1. `_context/RULES.md` — R15(데이터 미수신 vs 0%), R21(데이터 경과일 관리)
2. `_context/BUG-POSTMORTEM.md` — P10~P11, P48, P49, P61
3. `CHANGELOG.md` 최신 5개 — 중복 갱신 방지
