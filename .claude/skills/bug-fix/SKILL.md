---
name: bug-fix
description: 버그 수정 시 자동으로 근본 원인 분석 + 사후 분석 기록 + 예방 규칙 생성
---

# 버그 수정 자동 워크플로우

## 트리거 조건
사용자가 버그/문제/오류를 보고하면 자동 실행.

## 실행 워크플로우

### 1단계: 근본 원인 분석
1. `_context/BUG-POSTMORTEM.md` 읽기 — 과거 유사 버그 확인
2. 영향 범위 파악:
   - 수정 함수명
   - 호출하는 곳 (grep)
   - 접근하는 전역 변수
   - 영향받는 페이지/DOM 요소
   - 의존하는 데이터 소스
3. **이벤트-드리븐 정합성 체크**: 최근 시장 이벤트(전쟁·휴전·FOMC·쇼크) 이후 발생한 버그인지 확인
   - CHANGELOG.md 최근 5개 항목에서 시장 이벤트 갱신 내역 확인
   - DATA_SNAPSHOT._note로 마지막 갱신 컨텍스트 파악
   - **하드코딩 텍스트 퇴행** 여부 점검: 이벤트 이전에 작성된 static 서술이 역방향이 됐는지

### 2단계: 수정
- 최소 범위 패치 (과잉 수정 금지)
- **"구조적 한계"는 수용 불가** — 함수·컴포넌트가 필요한 컨텍스트를 표현 못 하면, 거절하지 말고 구조를 확장하라
  - 예: 스토리라인 함수가 지정학 맥락 없음 → 지정학 챕터 신설 (v44.6 패턴)
  - 예: 타이머가 추적 불가 → window 변수 등록으로 구조 개선 (v44.6 패턴)
- div 균형 확인 (수정 전후)
- 브라우저에서 직접 확인

### 3단계: 사후 분석 기록 (자동)
`_context/BUG-POSTMORTEM.md`에 추가한다. **1단계에서 이미 읽었으므로 재읽기 금지** — 머릿속 상태를 기반으로 append.

**포스트모템 항목 형식 (P번호 순차 부여):**

```markdown
## P{N}. {버그 제목 — 한 줄 요약}

**발견 버전:** v{X.Y}
**증상:** {사용자가 본 것 — "홈 페이지 시세 카드가 '—'로 표시됨"}
**재현 경로:** {어떤 조작 시 발생 — "페이지 로드 → 3초 후"}

**근본 원인:**
{왜 발생했는지 — 표면 증상이 아니라 진짜 원인}
{예: "fetchLiveQuotes가 _liveData를 갱신하기 전에 renderHome이 실행되어 ld['SPY']가 undefined. race condition."}

**수정:**
- `{파일}:{라인}` — {한 줄 설명}
- {함수명()} 호출 순서 변경
- {추가 가드/null 체크}

**violated_rule:** R{N}
**감지 방법 (재발 방지 grep):**
```bash
grep -n "{반복 패턴}" index.html
```

**예방 규칙:** {한 문장 — 어떻게 하면 이 버그가 다시 안 생기는가}
```

### 4단계: 규칙 반영 (자동)
- `_context/RULES.md` — 새 규칙 추가 (해당 시, R번호 순차)
- `_context/QA-CHECKLIST.md` — 검증 항목 추가
- `CHANGELOG.md` — 수정 이력 기록

### 5단계: 바이너리 Self-Eval (수정 완료 판정)

아래 6개 항목에 **명시적으로 yes/no** 답변. 하나라도 no면 해당 항목 수정 후 재체크.

| # | 평가 항목 | 기준 |
|---|-----------|------|
| **B1** | 브라우저 실측 확인 | 코드 수정 후 preview_console_logs/preview_snapshot으로 증상 재현 안 됨 확인. 코드만 보고 판단 금지. |
| **B2** | div 균형 유지 | `grep -o '<div' index.html \| wc -l` == `grep -o '</div' index.html \| wc -l` |
| **B3** | 포스트모템 기록 | BUG-POSTMORTEM.md에 P{N} 항목 추가 + 위 형식 준수 + violated_rule 태그 포함 |
| **B4** | 회귀 체크 (호출부) | 수정한 함수를 호출하는 모든 지점 grep 확인 (부작용 없는지) |
| **B5** | 재발 방지 grep 패턴 | 포스트모템에 기록한 grep 패턴이 실제로 해당 버그 패턴만 잡는지 (false positive 확인) |
| **B6** | 규칙 반영 완료 | RULES.md/QA-CHECKLIST.md/CHANGELOG.md 중 해당되는 파일 모두 갱신 |

### 판정 규칙
- 전부 yes → 수정 완료 ✓
- **B1 no** → **최우선 재수정** (사용자가 볼 것은 코드가 아니라 동작)
- B2 no → div 균형 복구 (구조 파손 상태로 절대 종료 금지)
- B3 no → 포스트모템 작성 (이게 없으면 다음 대화에서 재발 보장)
- B4 no → 호출부 확인 + 부작용 발견 시 추가 수정
- B5 no → grep 패턴 개선
- B6 no → 누락 파일 갱신

---

## Gotchas (BUG-POSTMORTEM에서 반복 발생한 실수)

1. **"코드 고쳤다" != "동작한다"** — 수정 후 반드시 브라우저에서 확인. 코드 레벨 검증만으로 완료 선언 금지.
2. **init 가드 미리셋** — `if (initialized) return;` 패턴에서 destroy 시 플래그를 false로 리셋 안 하면 페이지 재진입 시 차트 재생성 불가.
3. **APP_VERSION 누락** — v38.4 사고: HTML title/badge만 수정하고 `const APP_VERSION` JS 상수를 놓침 → SW 캐시 문제로 오진.
4. **`d.pct || 0` 패턴 금지** — 미수신 데이터(null)와 진짜 0% 변동을 구분 불가. 명시적 null 체크 필수.
5. **Yahoo Finance meta에 변동률 없음** — `regularMarketChangePercent` 필드가 meta에 없음 → 수동 계산 필요. API 응답 구조 가정 금지.
6. **동적 DOM 삽입 + flex/grid** — grid 컨테이너 내부에 예상치 못한 자식 삽입 → 레이아웃 파괴 (v31.2 시그널 배너).
7. **하드코딩 텍스트 퇴행** — 전쟁→휴전, 인상→인하 같은 시장 이벤트 이후 static HTML 서술이 역방향이 되는 패턴 (v44.6 사고). 수정 대상: `이란전쟁發 유가급등`, 수요파괴 현황 제목, JPM 6옵션 상태, 시나리오 조건 설명 등. 이벤트 후 데이터(DATA_SNAPSHOT) 갱신 시 텍스트 서술도 함께 점검 필수.
8. **"구조적 한계" 수용 금지** — "이 함수는 지정학 컨텍스트를 표현할 수 없다"는 판단은 틀렸다. 챕터를 추가하고, 변수를 등록하고, 분기를 넣어서 해결하라. 구조 한계를 WARN으로 방치하면 다음 대화에서도 같은 문제가 반복된다 (v44.6 교훈).
9. **전역 타이머 추적 불가** — `setInterval(...)` 반환값을 변수에 저장하지 않으면 콘솔에서 clearInterval 불가, 디버깅 불투명. 전역 타이머는 반드시 `window._xxxInterval = setInterval(...)` 형태로 등록 (v44.6 수정). grep 수: `setInterval == clearInterval` 이 목표.

---

## 이벤트-드리븐 시장 버그 특수 체크리스트 (v44.6 신설)

시장 이벤트(전쟁, 휴전, 금리 결정, 대형 실적) 이후 데이터 갱신 시 반드시 점검:

```
[ ] DATA_SNAPSHOT 수치 갱신 완료 (wti, brent, gold, fg 등)
[ ] HOME_WEEKLY_NEWS[0] 교체 — 이전 이벤트 뉴스 제거
[ ] 매크로 페이지 수요파괴 현황 / 시나리오 조건 텍스트 일치 확인
[ ] JPM/IB 대응 옵션 상태 (○/◐/✓) 현실 반영
[ ] 한국 매크로 페이지 코멘트 텍스트 역방향 여부
[ ] signal 페이지 CP 카드 CRITICAL/HIGH/MEDIUM 스코어 + 미터바 정합성
[ ] generateMacroStoryline() 지정학 챕터 트리거 여부 확인
  → WTI pct 절대값 8%+ OR VIX 25+ && WTI 85+ 시 자동 삽입됨 (v44.6)
```

### grep 패턴 — 하드코딩 텍스트 퇴행 탐지
```bash
# 시장 이벤트 이전 서술이 남아있는지 탐지
grep -n "이란전쟁\|전쟁 발발\|급등이.*리스크\|급증.*이란\|수요가 무너지고" index.html | grep -v "//\|MACRO_KW\|keyword"

# 전역 타이머 추적 가능 여부
echo "setInterval: $(grep -c 'setInterval' index.html)" && echo "clearInterval: $(grep -c 'clearInterval' index.html)"
# 목표: 두 수가 같아야 함

# 진짜 null-unsafe raw ld[] 접근 탐지 (false positive 방지: 가드된 패턴 제외)
grep -n "ld\['" index.html | grep "\.price\b\|\.pct\b" | grep -v "? ld\['\|&& ld\['\|if (ld\['\|// " | head -20
# 결과 0건이 목표

# v46.4: 폴백값 하드코딩 잔존 탐지 (DATA_SNAPSHOT._fallback으로 통일해야 함)
grep -n "|| 18;\||| 27\.1\||| 1\.21\||| 61\.9" index.html | grep -v "//"
# 결과 0건이 목표 — 모든 폴백은 _fallback에서 읽어야 함

# v46.4: isFinite 누락 탐지 (NaN 전파 방지)
grep -n "\.pct\b" index.html | grep -v "isFinite\|!= null\|!== null\|// \|_ldSafe\|escHtml\|_fmtPct\|_fmt(" | head -10

# v46.4: 요일/날짜 일관성 체크 (토/일에 경제지표 발표 배정 방지)
grep -n "토.*CPI\|토.*PPI\|토.*FOMC\|일.*CPI\|일.*PPI\|일.*FOMC" index.html | head -5
```

---

## v46.4 추가 Gotchas

10. **폴백값 하드코딩 금지 (P72)**: 각 함수에 `|| 18`, `|| 27.1` 같은 폴백값을 하드코딩하지 말 것. `DATA_SNAPSHOT._fallback`에서 읽도록 통일. /data-refresh가 _fallback도 함께 갱신 → 자동 동기화.

11. **CSS overflow-x/y 자동 변환 (P74)**: `overflow-x: hidden`만 설정하면 `overflow-y`가 auto로 자동 변환됨 → 의도하지 않은 스크롤 컨테이너 생성. `.content`가 이미 overflow 처리하므로 `.page`에는 overflow 설정 금지.

12. **요일/날짜 검증 (P73)**: 경제 캘린더에 날짜를 하드코딩할 때 반드시 실제 요일 확인. 토/일에 CPI/PPI/FOMC 배정은 100% 오류. April 2026: 1일=수요일 기준으로 계산.

13. **FOMC 일정 검증 (P75)**: DATA_SNAPSHOT.fomc 변경 시 eventDates 배열 + 한국거시 캘린더 + 시스템 프롬프트 + CP 카드 전부 동시 수정. grep "fomc\|FOMC\|4/28\|워시" 패턴으로 전수 확인.

14. **검증 레이어 3단계 원칙**: L1 입력(PriceStore+_validateFMPData) → L2 가공(_clamp+isFinite) → L3 출력(escHtml). 새 데이터 파이프라인 추가 시 반드시 3단계 적용.
