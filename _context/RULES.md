---
verified_by: agent
last_verified: 2026-04-18
confidence: high
target_version: v48.14
---

# AIO Screener — 마스터 룰 (RULES.md)
# 모든 작업 전 이 파일을 먼저 읽고 시작할 것

> **목적**: 반복되는 실수를 방지하고, 점검·QA·수정 작업의 품질을 보장하기 위한 최상위 규칙
> **최종 수정**: v48.14 (2026-04-18) — knowledge-lint 자동 갱신

---

## 📋 작업 전 필수 체크

### 1. 이 폴더 구조 확인 (v45.6+ Vault 정리 후)
```
_context/                              ← 지식 베이스 (유일한 진실의 원천)
├── RULES.md                           ← 지금 이 파일 (마스터 룰, 가장 먼저 읽기)
├── BUG-POSTMORTEM.md                  ← 버그 사후 분석 누적 로그 (매 수정 후 기록)
├── QA-CHECKLIST.md                    ← 실행 가능한 QA 체크리스트 v3.3
├── KNOWLEDGE-BASE.md                  ← 기술 인사이트 축적 (R26)
├── CODE-MAP.md                        ← index.html 38,251줄 line 범위 맵 (부분 읽기 가이드)
├── INDEX.md                           ← 지식 베이스 자동 인덱스 (R24)
├── CLAUDE.md                          ← _context/ 컨텍스트 + Hook + 파일 구조
├── working-rules.md                   ← 작업 규칙 (백업, 자료 분류, 버전)
├── voice-and-style.md                 ← 톤 & 스타일 가이드
└── archive-reports/                   ← 과거 버전별 리포트 아카이브 (참조 전용)
    ├── AUDIT_REPORT_v27.*, AUDIT_INDEX.md, AUDIT_QUICK_REFERENCE.md
    ├── CRITICAL_FIXES_CHECKLIST.md, COMPLETE_IMPLEMENTATION_VERIFICATION_LIST.md
    ├── QA-CHECKLIST-v2-archive.md, QA-FAILURE-ANALYSIS-v30.13d.md
    ├── BROWSER-QA-REPORT-v30.13*.md, UX-AUDIT-v34.4.md
    ├── CHAT_WORK_ANALYSIS.md, REPEAT-REQUEST-ANALYSIS.md
    ├── 파이프라인/보안/성능/접근성 설계 문서
    └── AIO_콘텐츠/매크로/UI 레퍼런스 (/integrate 원천)

루트/
├── CLAUDE.md                          ← 프로젝트 가이드 (슬림 버전, v45.6+)
├── CHANGELOG.md                       ← 버전별 변경 이력
└── index.html + version.json          ← 실제 코드 + 버전 메타
```

### 2. 작업 유형별 반드시 읽을 파일

| 작업 유형 | 읽을 파일 |
|-----------|-----------|
| **index.html 수정** | **CODE-MAP.md → 해당 line 범위만 Read** |
| 버그 수정 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md → QA-CHECKLIST.md |
| 새 기능 추가 | RULES.md → working-rules.md → CODE-MAP.md |
| QA/점검 요청 | RULES.md → BUG-POSTMORTEM.md → QA-CHECKLIST.md |
| 리팩토링/개편 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md |
| 버전 릴리스 | RULES.md(R1~R2) → working-rules.md |
| 지식 린팅 | RULES.md(R19~R20) → `/knowledge-lint` |

---

## 🔴 절대 규칙 (위반 시 무조건 재작업)

### R1. 버전 동기화 (6곳 필수)
버전 변경 시 반드시 **6곳 모두** 동일한 버전 문자열인지 확인:
1. `<title>` 태그 — `AIO Screener v{버전} — 올인원 투자 터미널`
2. `#app-version-badge` — HTML 내 인라인 텍스트
3. `version.json` → `version` 필드
4. `_context/CLAUDE.md` → `현재 버전:` 행
5. `CHANGELOG.md` → 최상단 항목의 버전 번호
6. **`const APP_VERSION`** — JS 상수 (이 값이 title과 badge를 JS에서 덮어씀. 놓치면 HTML은 v38.4인데 화면에 v38.3 표시)

> ⚠️ **v38.4 사고**: APP_VERSION 상수를 놓쳐서 SW 캐시 문제로 오진, 수시간 낭비. 6번째 동기화 포인트는 절대 빠뜨리지 말 것.

확인 명령:
```bash
grep '<title>' index.html | head -1
grep 'app-version-badge' index.html | grep -o '>v[^<]*<'
grep 'APP_VERSION' index.html | head -1
cat version.json | grep version
grep '현재 버전' _context/CLAUDE.md
head -20 CHANGELOG.md | grep '## v'
```

### R1-A. GitHub 배포 후 브라우저 버전 확인 (필수)
코드를 GitHub에 업로드한 뒤, **반드시 라이브 사이트에서 브라우저 캐시 무시 새로고침** 후 확인:
1. 브라우저 탭 제목(`<title>`)에 올바른 버전이 표시되는가
2. 페이지 상단 `#app-version-badge`에 올바른 버전이 표시되는가
3. `version.json` 직접 접속(`/version.json`)으로 올바른 버전이 반환되는가

> **파일 버전 ≠ 브라우저 버전** 불일치의 흔한 원인:
> - GitHub Pages 캐시 (배포 후 1~5분 지연)
> - 브라우저 캐시 (Ctrl+Shift+R 또는 DevTools > Network > Disable cache)
> - 업로드 누락 (index.html만 올리고 version.json 미업로드, 또는 그 반대)
> - JS에서 `updateQuotaBadge()` 등이 badge 텍스트를 런타임에 덮어쓰는 경우

### R2. 버전 체계
- 소수점 아래 1자리만: 31.1, 31.2, ..., 31.9, 32, 32.1, ...
- 절대 31.10, 31.11 같은 2자리 금지

### R3. 버그 수정 시 사후 분석 필수
모든 버그 수정 후 `BUG-POSTMORTEM.md`에 아래 형식으로 추가:
```
## [날짜] v{버전} — {버그 제목}
- **증상**: 사용자가 본 문제
- **근본 원인**: 왜 발생했나
- **놓친 이유**: 왜 기존 점검에서 못 잡았나
- **수정 내용**: 무엇을 바꿨나
- **예방 규칙**: 다음에 같은 유형 방지하려면
- **QA 체크리스트 추가 항목**: (있으면)
```

### R4. 동적 DOM 삽입 주의
JS에서 `element.after()`, `element.insertBefore()`, `element.appendChild()` 등으로
동적 DOM 삽입 시, **삽입 대상의 부모가 flex/grid 컨테이너인지 반드시 확인**.
→ grid/flex 내부에 예상치 못한 자식이 들어가면 레이아웃이 깨진다.

### R5. CSS overflow 3중 방어
스크롤 가능한 컨테이너(채팅, 뉴스, 리스트)는 반드시:
1. `overflow-y: auto` (세로 스크롤)
2. `overflow-x: hidden` (가로 넘침 방지)
3. `padding-bottom: 16px+` (하단 여백으로 콘텐츠 잘림 방지)

### R6. LLM 응답 렌더링 안전장치
- 테이블 5컬럼 초과 → 자동 리스트 변환
- 모든 셀에 `word-break: break-word; max-width: 200px`
- 시스템 프롬프트에 테이블 금지 + 대체 포맷 명시

### R7. 한국어 텍스트 레이아웃 검증 (v31.9 추가)
- 고정폭 CSS grid 컬럼은 **한국어 최대 텍스트 폭** 기준으로 설계 (한글 1자 ≈ 14px, 라틴 1자 ≈ 8px)
- 모든 고정폭 셀에 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` 필수
- flex 자식에 `min-width: 0` 없으면 `text-overflow: ellipsis` 작동 안 함
- 반응형 브레이크포인트(768px, 480px)에서 grid 컬럼 축소 규칙 별도 정의 필수

### R8. 차트 카드 텍스트 폴백 필수 (v31.9 추가)
- 차트(Chart.js)에 의존하는 미니 카드는 반드시 **텍스트 폴백** 포함
- CDN 지연/실패 시 차트가 렌더되지 않아도 핵심 수치가 텍스트로 표시되어야 함
- Chart.js 로드 실패 시 2초 후 재시도 메커니즘 권장

### R10. 종목코드 입력 시 3중 검증 필수 (v35.6 추가)
신규 종목 추가 시 반드시 아래 3단계 모두 통과해야 DB에 코드 입력 가능:
1. **Yahoo Finance quote 페이지에서 공식 회사명 확인** — DB 등록명과 일치해야 함 (269620="Syswork" ≠ "레인보우로보틱스" 사례)
2. **가격/시총 범위 합리성 확인** — 해당 기업 규모와 가격대가 맞는지 (코스맥스 ODM 1위인데 9,520원 소형주 → 자회사 오매핑)
3. **비상장 여부 확인** — 네이버증권/KRX에서 "비상장"/"장외" 표기 시 코드 할당 금지 (두나무=비상장 사례)

### R11. 비상장 기업 코드 할당 금지 (v35.6 추가)
Yahoo Finance가 가격을 반환해도 해당 기업이 실제 상장사인지 확인해야 함. 비상장 기업의 이름을 상장 코드에 매핑하면 **전혀 다른 회사의 데이터**가 해당 이름으로 표시됨 (P18 Ghost Stock).

### R12. 유사 이름 모자회사 구분 (v35.6 추가)
검색 시 동일/유사 이름이 복수 나오면(예: 코스맥스/코스맥스BTI), 각각의 정식 종목명·코드·시총·사업내용을 대조하여 본사/자회사 구분 후 올바른 코드 선택 (P19 Parent-Sub Confusion).

### R13. CHAT_CONTEXTS 이원화 필수 (v37.5 추가)
새로운 CHAT_CONTEXT를 추가하거나 기존 컨텍스트를 수정할 때:
1. `const c = _closeSnap();` — 반드시 `_liveSnap()`과 함께 선언
2. 주가·지수 분석 → `c.spx`, `c.nasdaq`, `c.dow` (종가 기준)
3. 시장환경(VIX/DXY/TNX/WTI/Gold) → `s.vix`, `s.dxy` 등 (실시간)
4. `[실시간]` 태그를 시장환경 데이터에 부착
5. `⚠ 주가·지수 분석 시 위 종가 기준. VIX·DXY 등 시장환경은 실시간 값 사용.` 지시문 포함
6. 지정학 영향 받는 컨텍스트(briefing/sentiment/portfolio 등)에 지정학 블록 포함

> ⚠️ v37.2에서 이원화 원칙을 선언했으나 12개 기본 컨텍스트에 미적용 → v37.5에서 전면 적용. **새 컨텍스트 추가 시 반드시 이 패턴 따를 것.**

### R14. 뉴스 키워드 현행화 (v37.6 추가)
분기 1회 이상, 시장 핵심 키워드(TECH_KW/MED_KW/MACRO_KW/TOPIC_KEYWORDS)를 점검:
- 새로운 기술 트렌드(CPO, 유리기판, Agentic AI 등) 반영 여부
- 새로운 지정학 이벤트(골든돔, 관세 정책 등) 반영 여부
- 한국어 키워드 동기화 여부
- TOPIC_KEYWORDS 분류 정확도 검증

### R9. Dead Page 방지 — 페이지 3종 세트 + init 가드 리셋 필수 (v31.10 추가, v42.1 강화)
- 새 페이지(`page-xxx`) 추가 시 반드시 **3종 세트** 구현:
  1. **init 함수** (`initXxxPage()`) — 데이터 로드 + DOM 업데이트
  2. **`aio:pageShown` 리스너** — 페이지 진입 시 init 호출
  3. **`aio:liveQuotes` 리스너** — 실시간 데이터 갱신 시 활성 페이지면 업데이트
- HTML만 있고 JS init이 없으면 하드코딩 데이터가 영구적으로 표시되는 Dead Page가 됨
- 정적 페이지(guide)는 예외이나, 동적 데이터가 하나라도 있으면 반드시 적용
- **[3회 위반 강화]** init 가드(`if (xxxInitialized) return;`) 사용 시 `destroyPageCharts()`에 반드시 `xxxInitialized = false` 리셋 추가. 누락 시 페이지 재진입 불가 (P28)
- **[3회 위반 강화]** `setInterval` 추가 시 반드시 `destroyPageCharts()`에 대응 `clearInterval` 추가 (P27). 타이머 미해제 = 좀비 프로세스

### R15. 데이터 미수신 vs 진짜 0% 구분 필수 (v38.3 추가, P25, v42.1 강화)
- `d.pct || 0` 패턴은 **데이터 없음**과 **진짜 0% 변동**을 구분할 수 없으므로 금지
- 반드시 `d && d.price != null && d.pct != null` 명시적 null 체크 후, 미수신 시 "—" 표시
- **[3회 위반 강화]** 코드 수정 후 `grep '|| 0' index.html | grep -i 'pct\|change\|percent'` 실행하여 잔존 패턴 스캔 필수
- **[3회 위반 강화]** `|| 숫자` 폴백은 0이 유효값인 모든 필드(pct, change, breadth %)에서 사용 금지. `!= null ? val : fallback` 패턴 사용
- 새 UI 섹션(카드, 그리드, 테이블) 추가 시 반드시 점검:
  1. 클릭/인터랙션 핸들러 구현 여부
  2. `aio:liveQuotes` 자동 갱신 연결 여부
  3. 상세 패널(detail panel)이 열려있을 때 자동 갱신 포함 여부

### R16. 뉴스 티커 표시 규칙 (v39.0 추가, P30)
- 매크로/지정학/정책/금리/무역 토픽(`macro`,`geopolitics`,`policy`,`fed`,`rates`,`trade`) 뉴스에는 **티커 숨김**
- 기업/실적/섹터/일반 토픽 뉴스에만 관련 종목 티커 표시
- `isCompanyNews()`를 티커 표시 판단에 쓰지 말 것 (토픽 분류가 부정확할 수 있음 — general로 분류된 매크로 뉴스에 ETF 티커 붙는 문제)
- 홈 핵심뉴스, 시장 뉴스(renderFeed), 데일리 브리핑(renderBriefingFeed) 3곳 모두 동일 기준 적용

### R17. 뉴스 키워드 추가 시 길이 제한 (v39.0 추가, P28, v42.1 강화, v42.5 재정의)
- **영어 키워드**: 3글자 미만 단독 키워드 추가 금지 (오탐 원인 — `'S'` 한 글자로 모든 텍스트 매칭 사고 발생)
- **한국어 키워드**: 2글자 도메인 특화 용어(`'금리'`, `'물가'`, `'고용'` 등)는 허용 — 한국어 금융 도메인에서 오탐 위험보다 누락 위험이 큼. 단, **1글자 한국어 단독 키워드는 금지** (예: `'팹'`)
- 티커 매칭은 `extractTickers()`에서 word boundary(`\b`)로 처리해야 함
- 키워드 추가 후 반드시 비금융 텍스트("약물 운전 STOP" 등)로 오탐 테스트
- **[4회 위반 강화]** 약어(QE, AI, EV 등)는 full form이 이미 존재하면 추가 금지. 약어가 반드시 필요한 경우 복합 패턴으로 구체화
- **[v42.5 교훈]** 키워드 제거는 누락 위험이 큼 — 선별 로직 강화가 우선, 키워드 제거는 최후 수단

### R18. 텔레그램 채널 관리 (v39.0 추가, P29)
- 채널 추가 시 `t.me/s/{slug}`로 공개 미리보기 확인 필수
- 메시지 DOM(`.tgme_widget_message_wrap`)이 없으면 `_TG_UNAVAILABLE`에 등록
- rsshub에서 403 차단된 채널은 `_TG_DIRECT_ONLY`에 등록 (CF Worker 직접 스크래핑)

### R19. _context/ 지식 정합성 린팅 (v40.4 추가)
- 대규모 수정 또는 분기 1회 `/knowledge-lint` 실행하여 _context/ 문서 간 정합성 점검
- 점검 5항목: (L1) 포스트모템 P→규칙 R 매핑, (L2) 규칙 R→QA 체크리스트 매핑, (L3) 코드 참조 실재성, (L4) 버전/날짜 최신성, (L5) 중복/모순 규칙
- 린팅 결과에서 오류 항목은 즉시 수정, 경고 항목은 다음 작업 시 검토

### R20. 에이전트 산출물 검증 상태 관리 (v40.4 추가)
- _context/ 핵심 문서(RULES.md, BUG-POSTMORTEM.md, QA-CHECKLIST.md)에 프론트매터로 검증 상태 표기:
  - `verified_by`: agent(에이전트 자동 생성) | human(사용자 검증 완료)
  - `last_verified`: 마지막 검증 날짜
  - `confidence`: high(코드 기반 검증) | medium(추론 기반) | low(미검증)
- 에이전트가 규칙/체크리스트를 추가할 때 기본값은 `verified_by: agent, confidence: medium`
- 사용자가 확인하면 `verified_by: human, confidence: high`로 승격
- 린팅 시 `confidence: low` 항목 우선 검토

### R21. 하드코딩 차트 데이터 경과일 관리 (v40.4 추가, P31)
- 차트 데이터(VIX/NAAIM/AAII/브레드쓰 등)는 `DATA_SNAPSHOT._updated`와 함께 관리
- 3일+ 경과 시 `renderStaleWarning()` 경고 배지 자동 표시
- 동적 전환 가능한 데이터(VIX/HYG/SPY/QQQ)는 Yahoo Finance API로 자동 교체, 하드코딩은 폴백으로만

### R22. 뉴스 3곳 계층적 선별 체계 (v40.4 추가, P32)
- **홈 핵심**: 정적 큐레이션 (`HOME_WEEKLY_NEWS`), 시장 전체 핵심 2~3건
- **브리핑**: score 45+, 5~20건, 20건 초과 시 score 우선 선별 → 시간순 재정렬
- **시장 뉴스**: score 30+, 150건 상한, 48h, 시간순 (광범위)
- scoreItem()에 5대 토픽 부스트(매크로/지정학/주식/외환/채권) + 비시장 정치 감점(-25) 필수

### R23. 외국 기업(ADR) 재무 파싱 (v40.4 추가, P33)
- SEC XBRL 파싱 시 `10-K` + `20-F`(외국발행인) + `20-F/A` 모두 포함
- `us-gaap` 없으면 `ifrs-full` 폴백

### R24. _context/ 인덱스 자동 관리 (v41.6 추가)
- `_context/INDEX.md`는 지식 베이스 전체 문서의 역할, 상태, 연결 관계를 기록하는 자동 인덱스
- `/knowledge-lint` 실행 시 L6 단계에서 자동 갱신 (신규 파일 추가, 삭제된 파일 제거, 갱신일/신뢰도 동기화)
- 현재 버전 대비 10+ 버전 차이 문서는 "정리 대상 후보"로 자동 식별

### R25. 버그 역참조 체계 (v41.6 추가)
- BUG-POSTMORTEM.md 각 버그 항목에 `violated_rule: R{N}` 태그 필수 기록
- 신규 규칙 위반이면 `violated_rule: 신규 ({카테고리})` 형식
- `/knowledge-lint` L7 단계에서 규칙별 위반 빈도 자동 집계 -- 3회 이상 위반 시 "규칙 강화 필요" 플래그
- 태그 누락 항목도 린팅에서 경고 보고

### R26. 기술 인사이트 환류 (v41.6 추가)
- 대화/작업 중 발견한 기술적 인사이트(API 동작, 브라우저 quirks, 라이브러리 패턴)는 `_context/KNOWLEDGE-BASE.md`에 축적
- BUG-POSTMORTEM이 "무엇이 고장났나"를 기록한다면, KNOWLEDGE-BASE는 "어떻게 동작하는가"를 기록
- 동일 인사이트 3회 이상 재발견 시 RULES.md 규칙 승격 검토
- 카테고리: API, 브라우저, Chart.js, DOM/CSS, JS 패턴, 데이터

### R27. Commands ↔ Skills 동기화 (v46.2 추가, P69 교훈)
- 새 스킬(`skills/xxx/SKILL.md`) 추가 시 **반드시** `commands/xxx.md` wrapper도 동시 생성
- wrapper 없으면 `/xxx` 자동완성에 안 나옴 → 사용자가 스킬 존재 자체를 모름 (silent omission)
- CHAT_CONTEXTS에 새 페이지 컨텍스트 추가 시 **반드시** `_aiCtxMap` + `_aiDefaultChips`에도 동시 매핑
- 매핑 없으면 통합 AI 패널에서 해당 페이지 진입 시 컨텍스트 자동 전환 안 됨 → silent failure
- 검증: `ls .claude/commands/*.md | wc -l` == skills 폴더 수 + 인라인 commands 수

### R28. 실제 클릭 테스트 필수 (v46.5 추가, P82 교훈)
- 코드 수정 후 `typeof xxx === 'function'` 검증만으로 완료 선언 **금지**
- **반드시 실제 브라우저에서 버튼 클릭 + 입력 필드 입력 + 결과 확인**
- Set/Array 변환, 함수 내부 TypeError, placeholder≠value 같은 버그는 코드 레벨 검증으로 발견 불가
- 검증 우선순위: B1(브라우저 실측) > B3(포스트모템) > B4(호출부) > B6(규칙)
- 포트폴리오 추가, 기업 분석 검색, 뉴스 필터 등 사용자 인터랙션이 있는 기능은 반드시 실제 클릭 테스트
- `grep -n "\.indexOf\|\.push\|\.splice" index.html | grep "Set\|KNOWN_TICKERS"` — Set에 Array 메서드 사용 탐지

### R29. AI 채팅 데이터 검증 태그 (v46.5 추가)
- AI 응답의 할루시네이션 방지를 위해 systemPrompt 끝에 **데이터 검증 상태** 블록 주입
- ✗ 표시된 데이터 소스(재무/뉴스/웹검색/정적데이터)에 대해 AI가 추측하지 못하도록 강제
- chatSend() + chatSendUnified() **양쪽** 모두 적용해야 함 (한쪽만 적용하면 AI 패널에서 할루시네이션)
- messages 배열 60,000자 초과 시 오래된 메시지 자동 trim (토큰 폭발 방지)
- API 실패 시 모델 폴백: sonnet-thinking → sonnet → haiku (자동 재시도 2회)

### R30. 지표 라벨/임계값 전역 통일 (v46.8 추가, P83~P104 교훈)
- **VIX 5단계**: <15 안정, 15~20 주의, 20~25 경계, 25~30 공포, 30+ 극단공포
- **F&G (CNN 표준)**: <=25 극단공포, <=45 공포, <=55 중립, <=75 탐욕, >75 극단탐욕 (반드시 `<=` 연산자)
- **VKOSPI 4단계**: <15 안정, 15~25 경계, 25~35 공포, 35+ 극단공포
- 새 함수에서 VIX/F&G/VKOSPI 라벨을 사용할 때 반드시 위 기준 참조. 독자 기준 사용 금지
- 검증: `grep -n "vix.*안정\|vix.*주의\|vix.*경계\|fgScore.*<\|fgVal.*<\|vkospi.*안정" index.html`로 전수 확인

### R31. innerHTML XSS 전수 점검 (v46.8 추가, P100 교훈)
- 사용자 입력 가능 필드(ticker, memo, note, name)는 innerHTML 삽입 전 **반드시** `escHtml()` 적용
- 파일 임포트(importPortfolio 등) 후 스키마 검증 필수 (티커 정규식, 문자열 길이 제한)
- onclick 인라인 핸들러에 사용자 데이터 삽입 시 escHtml 또는 data-* 속성 패턴 사용
- 검증: `grep -n "innerHTML\|onclick.*'" index.html | grep "\${p\.\|'+t\.\|'+p\." | grep -v "escHtml"`

### R33. 데이터 Freshness 추적 의무화 — DATE_ENGINE + _markFetch + _aioFeedHealth (v48.39 추가, P133 교훈)
- **원칙**: 모든 fetch 함수는 성공 시 `window._markFetch('apiName')` 호출 의무. 모든 날짜/시간은 `DATE_ENGINE` 경유. 모든 피드(RSS/API)는 `_aioFeedHealth.reportOk/reportFail` 통합.
- **이유**:
  - 사용자가 현재 보는 데이터가 실시간인지 폴백인지 즉시 판단 가능
  - 애널리스트 리포트(`[Citi 04/17]`)는 시간 경과 시 UI가 stale 경고 자동 표시 → 투자 판단 오류 방지
  - 죽은 RSS 피드 자동 비활성화로 불필요한 트래픽/지연 제거
  - localStorage 캐시 용량 자동 관리 (QuotaExceededError 대응)
- **새 fetch 함수 작성 규칙**:
  ```javascript
  async function fetchXxx() {
    try {
      const data = await fetchWithTimeout(url, {}, 8000);
      applyData(data);
      window._markFetch('xxx');         // 필수
      if (DATA_SNAPSHOT) DATA_SNAPSHOT._isFallback = false;
      return data;
    } catch(e) {
      // 폴백 체인
    }
  }
  ```
- **새 피드(RSS/API) 추가 규칙**:
  - 고유 id 부여 (예: `'rss:' + source.name`)
  - `_aioFeedHealth.isDisabled(id)` 체크 후 스킵 판단
  - 성공 시 `.reportOk(id)` · 실패 시 `.reportFail(id)` 호출
- **새 localStorage 캐시 규칙**:
  - `localStorage.setItem` 직접 사용 금지
  - 반드시 `window.AIO_Cache.set(key, value, ttlMs)` 경유
  - 읽기: `AIO_Cache.get(key)` (만료 자동 판정 후 null 반환)
- **새 날짜 포맷 규칙**:
  - 하드코딩 `"2026-04-19"` 등 절대 날짜 문자열 금지 → `DATE_ENGINE.isoNow()` 또는 동적 계산
  - UI 상대 시간: `DATE_ENGINE.formatRelative(ts)` ("3분 전")
  - UI 절대 시간: `DATE_ENGINE.formatAbsolute(ts)` ("2026-04-19 13:45")
  - Stale 판정: `DATE_ENGINE.isStale(ts, category)` — 카테고리는 STALE_THRESHOLDS 참조
  - UI 배지: `DATE_ENGINE.staleBadge(ts, category)` — HTML 반환
- **SCREENER_DB memo 규칙** (v48.37):
  - 애널리스트 리포트 표기: `[Citi 04/17]`, `[JPM 04/15 Buy]` 등 — `_aioMemoStaleInfo` 파서 호환
  - 복합 날짜 표기: `[2026-04-15]` 또는 `[2026.04]`
  - 가급적 `_asOf: '2026-04-17'` 필드 사용 (파서보다 정확)
- **검증**:
  ```bash
  # 하드코딩 날짜 문자열 감지 (주석 제외)
  grep -n "'\"[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}'\"" js/*.js | grep -v '^.*//'
  # _markFetch 누락된 fetch 함수 감지
  grep -l 'async function fetch' js/*.js | xargs grep -L '_markFetch'
  ```
  가이드 페이지 → 디버그 섹션 → 신선도 패널 → 모든 API에 🟢 배지 확인

---

### R32. Event Delegation 의무화 — onclick 인라인 핸들러 금지 (v48.35 추가, P132 교훈)
- **원칙**: HTML 및 JS 템플릿 리터럴 안에 `onclick=` / `onsubmit=` / `onchange=` / `onkeyup=` 등 인라인 이벤트 속성 **전면 금지**.
- **이유**:
  - `Content-Security-Policy: script-src 'self'` 헤더 도입 시 인라인 핸들러 전부 차단 → UI 마비 위험
  - ESM (`<script type="module">`) 전환 시 전역 함수 접근 불가
  - HTML 속성 문자열 이스케이프 지옥 (3중 백슬래시 패턴)
  - linter/IDE가 HTML 속성 안의 JS를 인식 못해 리팩토링 시 레퍼런스 추적 누락
- **신규 요소 작성 규칙**:
  - 정적 함수 호출: `<button data-action="fnName" data-arg="value">` (인자 3개까지 arg/arg2/arg3 지원)
  - 엘리먼트 참조 필요: `data-pass-el="1"` (함수의 마지막 인자로 element 전달)
  - 이벤트 참조 필요: `data-pass-event="1"` (마지막 인자로 MouseEvent 전달)
  - 백드롭 클릭 닫기: `data-close-on-outside="closeFnName"` (event.target === el 자동 체크)
  - 외부 링크 새탭: `data-open-url="https://..."` (`window.open` 대체, rel=noopener,noreferrer 자동)
  - stopPropagation: `data-stop="1"`
  - preventDefault: `data-prevent="1"`
- **2-statement 패턴**: `onclick="a();b()"` 같은 복합 동작은 **단일 헬퍼 함수**로 이식 (`_aio*` 네임스페이스).
  - 예: `onclick="prevPage='portfolio';showTicker(sym)"` → `_aioPortfolioTicker(sym)` 헬퍼 + `data-action="_aioPortfolioTicker" data-arg="sym"`
- **A11y**: `role="button"` 또는 `tabindex="0"` 요소는 자동으로 Enter/Space 키보드 활성화 지원 (디스패처 내장).
- **JS render 템플릿**: 템플릿 리터럴 안에도 `data-action` 패턴 적용 (escHtml로 arg wrapping).
- **검증**:
  ```bash
  grep -c 'onclick=\|onsubmit=\|onchange=' index.html js/*.js  # 0 반환 기대
  ```
  브라우저 DOM: `document.querySelectorAll('[onclick]').length === 0`
- **기존 코드 위반 발견 시**: 즉시 data-action 패턴으로 이식 (Perl 스크립트 `_context/scripts/migrate_onclick*.pl` 재활용 가능).

---

## 🟡 점검 시 주의사항 (과거 실수에서 배운 것)

### CSS/레이아웃 패턴
1. **grid 내부에 동적 요소 삽입** → 레이아웃 파괴 (v31.2 시그널 배너 사건)
2. **overflow:hidden on parent** → 자식 콘텐츠 잘림 (v31.1 채팅 가로 텍스트)
3. **max-height 컨테이너** → 하단 여백 없으면 콘텐츠가 입력창에 가려짐
4. **white-space:nowrap 전파** → 부모의 nowrap이 자식까지 영향

### JS/데이터 패턴
5. **_ldSafe 미사용** → null/undefined에서 .toFixed() 등 호출 시 크래시
5b. **getElementById → stale DOM 참조** → HTML에 없는 ID를 JS에서 참조하면 항상 null → 기능 무동작 (P43). DOM ID 참조 추가 시 `grep 'id="해당ID"' index.html` 필수
6. **async 에러 미처리** → try-catch 누락 시 무한 로딩 상태
7. **타이머 중복** → setInterval 중복 등록 시 메모리 누수 + 성능 저하
8. **popstate 핸들러 누락** → 뒤로가기 시 차트/데이터 미갱신

### LLM/AI 패턴
9. **시스템 프롬프트 규칙 무시** → Claude가 테이블 생성 → 렌더링 깨짐
10. **스트리밍 중 DOM 조작** → innerHTML 반복 교체 시 깜빡임/메모리 누수

### 레이아웃/텍스트 패턴 (v31.9 추가)
11. **고정폭 grid 컬럼 + 한국어 텍스트** → 라틴 기준 설계된 셀에서 한국어 텍스트 오버플로우 (P7)
12. **CDN 지연 시 차트 미렌더링** → 텍스트 폴백 없으면 빈 카드 표시 (P8)
13. **반응형 미대응** → 768px/480px에서 grid 컬럼 축소 없으면 텍스트 겹침/잘림
14. **Dead Page** → HTML만 있고 init 함수/이벤트 리스너 없음 → 하드코딩 데이터 영구 표시 (P9)

### 기술 분석 엔진 패턴 (v32 추가)
15. **analyzeTickerDeep/analyzeKrTickerDeep DOM target** → 결과를 렌더할 target element ID가 실제 HTML div ID와 일치해야 함 (US: `#ticker-analysis-result`, KR: `#kr-ticker-analysis-result`)
16. **CF Worker 프록시 의존** → Yahoo Finance 차트 데이터는 CF Worker(aio-yahoo-proxy)를 통해 fetch. rate limit(기본 100 req/min) 초과 시 429 에러. 동시 분석 요청 수 제한 필요.
17. **지수 분석 자동 트리거** → `initKoreaTechnical()`은 pageShown 시 KOSPI/KOSDAQ 동시 fetch → 2개 동시 API 호출. 이미 분석 결과가 있으면 재호출 방지 (innerHTML 체크).

### 종목 데이터 무결성 패턴 (v35.6 추가)
18. **Phantom Ticker (P17)** → 종목코드 미검증 입력 시 Yahoo Finance가 **다른 회사의 정상 가격**을 반환 → 에러 없이 잘못된 데이터 유입 (269620 사례)
19. **Ghost Stock (P18)** → 비상장 기업 이름을 상장 코드에 매핑 → 전혀 다른 회사의 데이터가 해당 이름으로 표시 (294870 두나무 사례)
20. **Parent-Sub Confusion (P19)** → 유사 이름 모자회사 혼동 → 자회사 코드에 본사 이름 매핑 (044820 코스맥스BTI 사례)

---

## 📌 QA 요청 시 워크플로우

```
1. RULES.md 읽기
2. BUG-POSTMORTEM.md 읽기 (기존 패턴 파악)
3. QA-CHECKLIST.md 기반으로 점검 수행
4. 발견된 문제 수정
5. 수정한 문제마다 BUG-POSTMORTEM.md에 사후 분석 추가
6. 필요 시 QA-CHECKLIST.md에 새 항목 추가
7. 버전 동기화 확인 (R1)
```

---

## 세션 2026-04-04 신규 규칙 (P31~P38)

### P31. 데이터-UI 단일 진실 원천 (Single Source of Truth)
데이터(JS)와 UI(HTML)가 2곳에서 관리되면 반드시 한쪽을 제거. JS에서 동적 생성하여 불일치 근본 방지.

### P32. 종목 추가 시 상장 여부 확인 필수
KOSPI(.KS) / KOSDAQ(.KQ) 상장 확인. 비상장·장외 주식 추가 금지. 두나무(업비트) 같은 비상장 실수 반복 방지.

### P33. 테마 간 동일 종목 중복 배치 금지
자회사는 모회사 테마에서 커버. 예: 보스턴다이내믹스(현대차 자회사) → auto에서 커버, robot에 현대차 별도 배치 금지.

### P34. 테마 종목 비중 체계적 설정
(1) 시총 비례 (2) 독과점 구조 반영 (3) 대장주 비중 상향 (4) ETF 구성 크로스체크. 임의 감 배분 금지.

### P35. 데모/모의 데이터 라벨링 또는 제거
정적 모의 데이터는 `[DEMO]` 라벨 필수. 실제 데이터 연결 완료 시 즉시 제거. 사용자 오인 방지.

### P36. UI 텍스트 핵심/상세 분리
접힌 상태에서 핵심 한 줄 완전히 읽혀야 함. 상세 설명은 토글/AI 채팅으로 분리.

### P37. 인라인 font-size 11px 미만 사용 금지
CSS override가 자동 보정(7-8→11px)하지만, 신규 코드에서 극소 글자 사용 자체를 금지.

### P38. 전역 기능은 글로벌 컴포넌트로
AI 채팅, 알림 등 전역적 기능은 페이지별 복제가 아닌 글로벌 컴포넌트(사이드바 등)로 구현.

### P56. init 함수 내 cleanup 루프 중복 금지
차트/DOM 생성 후 즉시 destroy하는 "생성 → destroy" 패턴은 코드 리뷰에서 반드시 검출. 하나의 init 함수에 cleanup 루프가 두 개 이상 존재하면 두 번째 루프가 방금 만든 객체를 날릴 위험.

### P57. 고정 repeat(N,1fr) 그리드 모바일 검증 필수
`repeat(N,1fr)` (N≥5)은 모바일 375px에서 N×최소셀너비 > 컨테이너 width 여부 확인 필수. 6열 이상 그리드는 `repeat(auto-fit,minmax(Xpx,1fr))`으로 교체 검토.

### P58. applyDataSnapshot map과 HTML data-snap 속성 동기화 필수
`applyDataSnapshot()` map에 키를 추가/제거할 때 반드시 HTML `data-snap="key"` 속성 존재 여부를 grep으로 확인. 키가 있는데 HTML 없으면 dead code, HTML에 있는데 map에 없으면 hardcoded 고정값 버그.

### P59. _lastFG 초기값은 DATA_SNAPSHOT.fg에서 가져올 것
`fetchFearGreed()` 비동기 응답 전에 `_lastFG`가 필요한 컨텍스트(AI 채팅 스냅, 트레이딩 스코어 등)에서 기본값 18로 폴백되는 문제. `applyDataSnapshot()` 직후 `window._lastFG = DATA_SNAPSHOT.fg || 18`로 초기화할 것.

### P60. signal 페이지 브레드쓰 바는 liveQuotes + pageShown 양쪽에서 갱신
`updateBreadthBars()`가 breadth 페이지 init에서만 호출되면 signal 페이지 브레드쓰 섹션은 breadth 페이지를 방문하기 전까지 하드코딩 고정값. signal 페이지의 `aio:liveQuotes` 리스너에서도 `updateBreadthBars()` 호출 필수.

---

## 🟡 재발 방지 규칙 (v48.54 신설 — 레이어/파이프라인/함수 단위)

### R34. CSS 색상 토큰 우선 — rgba 하드코딩 금지 (v48.54 추가)
**원칙**: 투명 화이트 오버레이 `rgba(255,255,255,0.0X)` 패턴은 CSS 변수(`--surface-1~5`)로만 사용.

**금지 패턴**:
```html
<!-- BAD -->
<div style="background:rgba(255,255,255,0.02)">
```

**권장 패턴**:
```html
<!-- GOOD -->
<div style="background:var(--surface-1)">
```

**표준 매핑** (v48.48 정의):
| 값 | 변수 |
|-----|------|
| `rgba(255,255,255,0.02)` | `var(--surface-1)` |
| `rgba(255,255,255,0.03)` | `var(--surface-2)` |
| `rgba(255,255,255,0.04)` | `var(--surface-3)` |
| `rgba(255,255,255,0.05)` | `var(--surface-4)` |
| `rgba(255,255,255,0.08)` | `var(--surface-5)` |

**⚠ Canvas ctx 예외**: HTML5 Canvas의 `ctx.strokeStyle` / `ctx.fillStyle` / `ctx.font`는 CSS var를 **해석 못함**. Canvas 렌더러 내부에서는 직접 hex/rgba 값 사용:
```js
// BAD
ctx.strokeStyle = 'var(--surface-5)';  // 작동 안 함
// GOOD
ctx.strokeStyle = 'rgba(255,255,255,0.08)';  // 또는 '#8888884A'
```

> SVG `fill="var(...)"` 및 HTML `style="..."` 속성은 OK (CSS 해석).

### R35. 신규 페이지 → CHAT_CONTEXTS 동시 생성 (v48.54 추가, P106 교훈)
**원칙**: 새 페이지(`<div class="page" id="page-XXX">`)를 만들 때 반드시 `CHAT_CONTEXTS['XXX']` 도 동시 정의.

**체크**:
```bash
# 페이지 ID ↔ CHAT_CONTEXTS 매칭 검증
grep -oE 'id="page-[a-z-]+"' index.html | sed 's/id="page-//;s/"//' | sort -u > /tmp/pages.txt
grep -oE "CHAT_CONTEXTS\['[a-z-]+'\]" index.html | sed "s/CHAT_CONTEXTS\['//;s/'\]//" | sort -u > /tmp/contexts.txt
diff /tmp/pages.txt /tmp/contexts.txt  # 차이 없어야 함 (home/kr-home/guide 등 AI 채팅 불필요 페이지 제외)
```

> **v48.53 교훈**: `page-themes` + `page-theme-detail` 존재하나 `CHAT_CONTEXTS['themes']` 부재 → AI가 테마 종목 인식 못함. 필수 페이지 ↔ 컨텍스트 매핑.

### R36. Themes 페이지 종목 추가 → LIVE_SYMBOLS 동시 등록 (v48.54 추가)
**원칙**: `SUB_THEMES` / `THEME_MAP` / `ALL_RRG_ETFS`에 종목(ticker/leader/etf)을 추가하면 **반드시** `LIVE_SYMBOLS` (js/aio-data.js)에도 추가.

**체크**:
```bash
# SUB_THEMES tickers 전수 추출 → LIVE_SYMBOLS 교차 확인
awk '/var SUB_THEMES = \[/,/^\];/' index.html | grep -oE "'[A-Z0-9.=^-]{2,}'" | sort -u > /tmp/themes_syms.txt
awk '/const LIVE_SYMBOLS/,/^\];/' js/aio-data.js | grep -oE "'[A-Z0-9.=^-]{2,}'" | sort -u > /tmp/live_syms.txt
comm -23 /tmp/themes_syms.txt /tmp/live_syms.txt  # 출력 없어야 함
```

> **v48.53 교훈**: ROBO/WCLD/BUG/VIG/DGRO/SCHD 6종 ETF가 `SUB_THEMES.etf`에 있으나 `LIVE_SYMBOLS` 누락 → fetch 안 되어 renderAllEtfGrid에 "—" 표시.

### R37. data-snap 신규 추가 → 자동 렌더러 참여 (v48.54 추가, P108 교훈)
**원칙**: `data-snap="키"` HTML 속성을 추가하면 반드시 `updateSnapValues()` 또는 유사 자동 렌더러(Phase E 확장)에 키 등록. 정적 하드코딩 금지.

**순서**:
1. DATA_SNAPSHOT에 기본값 정의
2. HTML `<span data-snap="키">값</span>` 배치
3. **fetchLiveQuotes 후 updater에 등록** (index.html 20820+ 업데이트 함수):
```js
var newVal = ld['YAHOO_TICKER'] ? ld['YAHOO_TICKER'].price : null;
if (newVal != null) document.querySelectorAll('[data-snap="키"]').forEach(function(el){ el.textContent = newVal.toFixed(2); });
```
4. 배포 전 브라우저에서 값이 동적으로 갱신되는지 실측

> **v48.53 교훈**: data-snap 50종 중 자동화 7종(14%)만 되어 있었음 → D+6 stale. 16종까지 확장 (32%), 나머지 34종은 FRED/통계청 API 필요로 다음 세션.

### R38. `on*` 인라인 이벤트 핸들러 금지 — 전체 확장 (R32 확장, v48.54 추가)
R32에서 `onclick` 금지 규칙을 **모든 on* 인라인 이벤트로 확장**:
- `onclick` · `onchange` · `oninput` · `onkeydown` · `onkeyup` · `onsubmit`
- `onmouseover` · `onmouseout` · `onmouseenter` · `onmouseleave`
- `onblur` · `onfocus` · `onsubmit`

**대안**:
- 클릭/키보드: `data-action="fn"` (Event Delegation)
- 엔터 입력: `data-on-enter="fn[:arg]"` (v48.47+)
- Hover/Focus 스타일: CSS `:hover` / `:focus` 클래스 (aio-hover-*, aio-focus-* 유틸)

> **v48.54 교훈**: onkeydown만 처리했던 v48.47 이후 onmouseover 6건 · onmouseout 6건 · onblur/focus 2건 잔존 발견. 전체 on* 전수 점검.

---

## 🔧 Hook 자동화 (v48.54 확장)

### validate-edit.sh 확장 사항
1. div 균형 체크 (기존)
2. **신규 `rgba(255,255,255,0.0[2-8])` 추가 시 경고** — R34 위반 감지
3. **신규 `on(mouseover|mouseout|blur|focus|click|change|input)=` 추가 시 경고** — R38 위반 감지
4. **신규 `ctx.(stroke|fill)Style = 'var(--` 추가 시 에러** — Canvas CSS var 버그 방지
