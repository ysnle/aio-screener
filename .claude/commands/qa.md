# /qa — AIO Screener 전수 QA 점검

이 커맨드는 **`post-edit-qa` 스킬의 실행 진입점**이다. 실제 점검 절차와 13개 티어 상세는 `.claude/skills/post-edit-qa/SKILL.md`가 단일 진실의 원천이다.

---

## 트리거 조건
- 사용자가 `/qa` 명시 호출
- 코드 수정 직후 자체 검증 필요 시 (PostToolUse 이후)
- 배포 요청 전 최종 게이트 (`/deploy` 직전)

---

## 실행 지시

**반드시** `.claude/skills/post-edit-qa/SKILL.md`를 읽고 그 절차를 따른다. 이 파일에는:
- T1~T13 13개 검증 티어
- 각 티어별 구체 bash/grep 명령
- 각 페이지별 DOM 확인 체크리스트
- Gotchas 12개 (과거 반복 실수)

`/qa`를 단순 "구조 확인"으로 축약하지 않는다 — 전수 13티어가 기본이다.

---

## 실행 전 필수 읽기 (post-edit-qa 보조)
1. `_context/RULES.md` — R1~R26 + P31~P41
2. `_context/BUG-POSTMORTEM.md` — 최근 10건 (반복 패턴 재발 확인)
3. `CHANGELOG.md` — 최근 5개 항목 (수정 영역 파악)

---

## 실행 모드 (범위 선택)

사용자가 인자 없이 `/qa`만 호출하면 **표준 모드**. 인자가 있으면 해당 모드로:

| 모드 | 호출 | 범위 | 소요 |
|------|------|------|------|
| **빠른 게이트** | `/qa quick` | T1(구조) + T11(Dead Page) + T13(applyDataSnapshot) | 빠름, 배포 직전 최종 체크 |
| **표준** (기본) | `/qa` | T1~T5 + T8 + T11 + T13 (핵심 8티어) | 수정 후 자체 검증 |
| **전수** | `/qa full` | T1~T13 전체 13티어 | 릴리스 전 전수 감사 |
| **포커스** | `/qa focus:{page}` | T2에서 지정 페이지 단일 심층 | 특정 페이지 수정 후 |

---

## 바이너리 Self-Eval (최종 판정)

post-edit-qa 실행 후 아래 6개에 **명시적으로 yes/no** 답변. 하나라도 no면 **FAIL → 수정 후 재실행**.

| # | 평가 항목 | 기준 |
|---|-----------|------|
| **Q1** | 구조 무결성 (T1) | div 열림/닫힘 일치 **AND** 버전 6곳 동기화 **AND** 콘솔 에러 0건 |
| **Q2** | Dead Page 없음 (T11) | 22개 페이지 모두 DOM 콘텐츠 비어있지 않음 ("—", "null" 없음) |
| **Q3** | 데이터 정합성 (T3/T8) | `_SNAP_FALLBACK` ≥50 심볼 **AND** `d.pct \|\| 0` 패턴 0건 (R15) |
| **Q4** | Dead Static HTML (T13) | applyDataSnapshot map에 모든 data-snap 키 매핑 **AND** Dead DOM 0건 |
| **Q5** | 과거 버그 재발 없음 | BUG-POSTMORTEM P17~P43 패턴 grep 재발 0건 |
| **Q6** | 뉴스 필터 규칙 (T9) | 매크로 뉴스에 ETF 티커 0 **AND** 3글자 미만 단독 키워드 0 (R16/R17) |
| **Q7** | 동적 텍스트 정합성 (T14) | 홈 브리핑 동적화 확인 **AND** macro Pro 시나리오 현실 반영 **AND** CHAT_CONTEXTS 미정의 0건 (v45.6+) |

### 판정 규칙
- **전부 yes** → PASS ✓, 사용자에게 그린라이트 보고
- **1~2개 no** → FAIL, 수정 후 해당 티어 재실행 (전체 재실행 아님, 해당 티어만)
- **3개 이상 no** → CRITICAL FAIL, 릴리스 중단 + 사용자 에스컬레이션

### 재시도 규칙
- 동일 티어 재실행 **최대 2회**
- 2회 후에도 FAIL → "수동 개입 필요" 보고 + 어떤 티어의 어떤 항목이 왜 실패했는지 구체 원인 제시

---

## 출력 리포트 형식

```
# AIO Screener QA Report v{버전}

실행일: {YYYY-MM-DD}
모드: {quick | 표준 | full | focus:{page}}
실행 티어: {T1, T2, ...}

## 바이너리 판정
| # | 항목 | 결과 |
|---|------|------|
| Q1 | 구조 무결성 | ✓ / ✗ |
| Q2 | Dead Page 없음 | ✓ / ✗ |
| Q3 | 데이터 정합성 | ✓ / ✗ |
| Q4 | Dead Static HTML | ✓ / ✗ |
| Q5 | 과거 버그 재발 없음 | ✓ / ✗ |
| Q6 | 뉴스 필터 규칙 | ✓ / ✗ |

## 판정: {PASS ✓ | FAIL ✗ | CRITICAL FAIL}

## 티어별 상세
{post-edit-qa의 최종 리포트 형식 — 표 + FAIL/WARN 항목 나열}

## 수정 권장
{FAIL 항목 기준, 파일 경로와 수정 방향 제시}
```

---

## Gotchas (QA 실행 시 반복 실수)

1. **13개 티어를 5개로 축약** — 과거 /qa 버전(v43 이전)은 5개 항목만 점검했고, 실제 배포된 코드에서 Dead DOM/CSS 회귀 누락. 반드시 post-edit-qa 13티어로 위임.

2. **"코드 본 것 = 동작 확인" 착각** — bash grep만 돌리고 PASS 선언. 브라우저 실측(preview_console_logs, preview_snapshot) 병행 필수.

3. **바이너리 판정 생략** — Q1~Q6 skip → "대체로 괜찮아 보임" 식 정성 보고. 반드시 각 항목에 명시적 yes/no.

4. **FAIL을 WARN으로 격하** — 애매한 항목을 WARN으로 분류해서 PASS 처리. 규칙: 규칙 위반은 FAIL, 데이터 경과 경고는 WARN.

5. **재실행 루프** — 2회 초과 재시도 → 무한 루프 위험. 2회 FAIL 시 사용자 개입.

6. **BUG-POSTMORTEM 참조 누락** — Q5 점검 시 P번호 목록 안 보고 grep. 반드시 최신 BUG-POSTMORTEM을 읽고 grep 패턴 추출.
