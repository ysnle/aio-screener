---
name: knowledge-lint
description: _context/ 지식 베이스 정합성 린팅 — 문서 간 불일치, 폐기된 규칙, 누락된 연결고리 탐지
---

# 지식 베이스 린팅 (/knowledge-lint)

## 목적
카파시 지식 베이스 패턴의 "린팅" 단계.
_context/ 문서들을 교차 점검하여 지식의 정합성, 최신성, 연결성을 검증한다.
코드 QA(/qa)가 런타임 동작을 점검한다면, 이 스킬은 _context/ 자체의 건강 상태를 점검한다.

## 트리거 조건
- 사용자가 `/knowledge-lint` 실행
- 대규모 수정 후 _context/ 문서 정합성 확인이 필요할 때

## 린팅 7단계

### L1. 규칙-포스트모템 교차 참조
BUG-POSTMORTEM.md의 각 "예방 규칙 P{N}"이 RULES.md에 대응 규칙(R{N})으로 존재하는지 확인.
```
검증 방법:
1. BUG-POSTMORTEM.md에서 모든 P번호 추출 (grep '예방 규칙 P')
2. RULES.md에서 해당 패턴이 규칙으로 반영되어 있는지 확인
3. 누락된 P→R 매핑 보고
```

### L2. 규칙-QA체크리스트 교차 참조
RULES.md의 각 R규칙에 대응하는 QA-CHECKLIST.md 검증 항목이 있는지 확인.
```
검증 방법:
1. RULES.md에서 모든 R번호와 핵심 키워드 추출
2. QA-CHECKLIST.md에서 해당 규칙을 검증하는 항목 존재 여부 확인
3. 규칙은 있으나 QA 검증 항목이 없는 것 보고
```

### L3. 코드 실재성 검증
RULES.md와 QA-CHECKLIST.md에서 언급하는 함수명/변수명/DOM ID가 실제 index.html에 존재하는지 확인.
```
검증 방법:
1. 문서에서 백틱(`)으로 감싼 코드 참조 추출
2. 함수명은 index.html에서 grep으로 존재 확인
3. DOM ID는 index.html에서 id= 검색
4. 삭제/리네임된 참조 보고 (폐기된 규칙 후보)
```

### L4. 버전/날짜 최신성 검증
각 문서의 "최종 수정" 날짜, 버전 참조가 현재 버전과 일치하는지 확인.
```
검증 방법:
1. version.json에서 현재 버전 확인
2. RULES.md, QA-CHECKLIST.md 등의 버전 참조가 현행인지
3. BUG-POSTMORTEM.md 최신 항목의 날짜가 합리적인지 (3개월+ 미갱신이면 경고)
4. 문서 간 버전 불일치 보고
```

### L5. 중복/모순 규칙 탐지
RULES.md 내 규칙 간, 또는 RULES.md와 working-rules.md/CLAUDE.md 간 모순되는 내용 탐지.
```
검증 방법:
1. 동일 주제를 다루는 규칙이 여러 문서에 있으면 내용 대조
2. 숫자/임계값/기준이 문서마다 다르면 보고
3. 폐기되었으나 삭제 안 된 규칙 식별
```

### L6. INDEX.md 자동 갱신
_context/ 폴더의 현재 상태를 반영하여 INDEX.md를 자동 업데이트.
```
검증 방법:
1. _context/ 내 모든 .md 파일 목록과 INDEX.md 목록 대조
2. INDEX.md에 없는 새 파일 추가
3. INDEX.md에 있으나 삭제된 파일 제거
4. 각 문서의 프론트매터에서 last_verified, confidence 읽어 INDEX.md 갱신일/신뢰도 업데이트
5. 정리 대상 후보(현재 버전 대비 10+ 버전 차이) 자동 식별
```

### L7. violated_rule 역참조 빈도 분석
BUG-POSTMORTEM.md의 `violated_rule` 태그를 집계하여 자주 위반되는 규칙을 식별.
```
검증 방법:
1. BUG-POSTMORTEM.md에서 모든 `violated_rule:` 태그 추출
2. 규칙별 위반 횟수 집계 (예: R15 → 4회, R9 → 3회)
3. 3회 이상 위반된 규칙 → "규칙 강화 필요" 플래그
4. KNOWLEDGE-BASE.md에서 동일 주제 인사이트가 있는지 교차 확인
5. violated_rule 태그가 누락된 버그 항목 보고
```

## 출력 형식

린팅 결과를 아래 형식으로 보고:

```markdown
# Knowledge Lint Report — {날짜}

## 요약
- 검사 항목: {N}개
- 정상: {N}개
- 경고: {N}개
- 오류: {N}개

## L1. 규칙-포스트모템 교차 참조
| P번호 | 포스트모템 설명 | RULES.md 대응 | 상태 |
|--------|----------------|---------------|------|
| P25    | 0% vs 미수신 구분 | R15 | OK |
| P30    | 뉴스 티커 표시 | R16 | OK |

## L2. 규칙-QA체크리스트 교차 참조
...

## L3. 코드 실재성 검증
...

## L4. 버전/날짜 최신성
...

## L5. 중복/모순 규칙
...

## L6. INDEX.md 갱신
| 변경 유형 | 파일 | 조치 |
|----------|------|------|
| 신규 발견 | KNOWLEDGE-BASE.md | INDEX.md에 추가 |

## L7. violated_rule 빈도 분석
| 규칙 | 위반 횟수 | 상태 |
|------|----------|------|
| R15  | 4회      | 규칙 강화 필요 |
| R9   | 3회      | 규칙 강화 필요 |

## 권장 조치
1. {구체적 조치 항목}
2. ...
```

## 린팅 결과 처리
- 오류(빨간색): 즉시 수정 필요 (누락된 규칙, 존재하지 않는 함수 참조 등)
- 경고(노란색): 검토 필요 (3개월+ 미갱신, 약한 연결 등)
- 정상(초록색): 확인 완료

## 수정 시 프론트매터 업데이트
린팅 후 문서를 수정하면, 해당 문서의 프론트매터에서:
- `last_verified` 날짜 갱신
- `verified_by` 를 agent 또는 human으로 표기
- 린팅에서 검증 통과한 항목은 confidence: high 유지

---

## 바이너리 Self-Eval (린팅 완료 판정)

L1~L7 실행 후 아래에 **명시적으로 yes/no** 답변. 하나라도 no면 해당 레이어 재실행 후 재체크.

| # | 평가 항목 | 기준 |
|---|-----------|------|
| **KL1** | P → R 매핑 완전성 | BUG-POSTMORTEM의 모든 P번호가 RULES.md 내 대응 R번호와 명시적으로 연결됨 (violated_rule 태그 또는 본문 언급) |
| **KL2** | R → QA 매핑 완전성 | RULES.md 모든 R번호가 QA-CHECKLIST.md에 검증 항목으로 존재 (R번호 직접 언급 또는 기능 대응) |
| **KL3** | 코드 실재성 | RULES/QA-CHECKLIST에 언급된 모든 함수명/DOM ID/변수명이 index.html에서 grep 성공 |
| **KL4** | 버전 최신성 | 모든 _context/ 문서의 버전 참조가 version.json 현재 버전의 ±5 버전 이내 |
| **KL5** | 문서 간 모순 없음 | 동일 주제(예: 티커 매칭 규칙)가 여러 문서에 있을 때 임계값/숫자/기준 모두 일치 |
| **KL6** | INDEX.md 정합성 | _context/ 실제 .md 파일 목록과 INDEX.md 항목 집합이 완전 일치 (누락 0, 유령 항목 0) |
| **KL7** | violated_rule 태그 완전성 | BUG-POSTMORTEM의 모든 P항목이 violated_rule 태그를 보유 (없으면 N/A 명시) |

### 판정 규칙
- 전부 yes → 린팅 통과 ✓, 각 문서 프론트매터에 `last_verified` 오늘 날짜로 갱신
- KL1/KL2/KL6/KL7 중 하나라도 no → **자동 수정** (누락 매핑 추가, INDEX.md 동기화)
- KL3 no → **오류** (폐기된 참조 → 규칙 삭제 또는 참조 수정)
- KL4/KL5 no → **경고** (사용자 확인 후 수정)

---

## Gotchas (린팅 실행 시 반복 발견되는 패턴)

1. **P번호 비순차 건너뜀** — BUG-POSTMORTEM에서 P17 → P25 식으로 번호가 점프하면 L1에서 "누락 P18~P24" 경고 발생. 실제로는 의도된 갭(R-only 규칙 등). 해결: 건너뛴 번호는 whitelist에 등록하거나 본문에 "{범위} skipped: {이유}" 명시.

2. **RULES.md와 KNOWLEDGE-BASE.md 용어 불일치** — 동일 개념을 "이원화" vs "dual lookup" vs "close/live 분리" 식으로 다르게 기술. L5에서 모순으로 잡히면 **용어 사전**을 KNOWLEDGE-BASE.md에 추가하고 나머지 문서에서 이 용어를 참조.

3. **코드 리네임 후 규칙 미갱신** — `_ldSafe()`를 `getLiveData()`로 리네임했는데 RULES.md는 그대로. L3 grep 실패로 드러남. 리네임 시 `_context/` 전체를 sed로 일괄 치환하는 워크플로우 필요.

4. **QA-CHECKLIST 항목이 규칙이 아닌 실행 명령** — "div 균형 확인하라"처럼 액션만 있고 어떤 규칙(R?)을 검증하는지 불명확. L2 실패. 해결: 모든 QA 항목에 `(R{N})` 태그 붙이기.

5. **INDEX.md 수동 편집 후 자동화 충돌** — 사람이 수동으로 INDEX.md에 주석/순서 변경했는데 L6이 자동 재생성하면서 덮어씀. 해결: INDEX.md 상단에 `<!-- AUTO-GENERATED below this line -->` 마커를 두고 그 아래만 자동화.

6. **violated_rule 태그 누락을 "해당 없음"으로 방치** — "이 버그는 특정 규칙 위반이 아니라서"라고 넘김. 하지만 규칙 위반이 아니면 **새 규칙 생성 후보**다. 모든 P항목에 반드시 `violated_rule: R{N}` 또는 `violated_rule: NEW (proposed: R{N+1})` 표기.

7. **문서 간 날짜 형식 불일치** — "2026-04-09", "26.4.9", "Apr 9, 2026" 혼재. L4에서 파싱 실패. 전 문서 `YYYY-MM-DD` 강제.

8. **확장자 없는 링크** — RULES.md에서 `BUG-POSTMORTEM` 으로 참조(확장자 없음) → grep 실패 또는 에디터 링크 깨짐. 항상 `BUG-POSTMORTEM.md` 풀 경로.

---

## 예시: 좋은 린팅 판정 (v44.9 기준)

```
# Knowledge Lint Report — 2026-04-09

## 바이너리 판정
| KL# | 항목 | 결과 |
|-----|------|------|
| KL1 | P→R 매핑 | ✓ (P17~P43 → R9,R15,R16,R17 모두 매핑) |
| KL2 | R→QA 매핑 | ✗ (R24 대응 QA 항목 누락) |
| KL3 | 코드 실재성 | ✓ (42개 함수 참조 전부 grep 성공) |
| KL4 | 버전 최신성 | ✓ (모든 문서 v44.x 범위) |
| KL5 | 문서 간 모순 | ⚠ (TECH_KW 3글자 vs 4글자 — 용어 정리 필요) |
| KL6 | INDEX.md 정합성 | ✓ |
| KL7 | violated_rule 태그 | ✓ (모든 P항목 태그 보유) |

## 판정: WARN — KL2/KL5 수정 후 재린팅 필요

## 자동 수정 완료
- QA-CHECKLIST.md: R24 대응 항목 "INDEX.md 정합성 확인" 추가

## 사용자 확인 필요
- KL5: RULES.md R17은 "3글자"로 단일 진실 원천. (v45.6+ `.claude/rules/` 삭제 후)
```
