# AIO Screener — Claude Code 프로젝트 가이드

## 새 대화 시작 시 필수 읽기 순서

1. 이 파일 (CLAUDE.md) — 프로젝트 개요 + 절대 규칙 + 작업 규칙
2. `_context/BUG-POSTMORTEM.md` — 과거 버그 사후 분석 (같은 실수 반복 방지)
3. `CHANGELOG.md` (최근 5개 항목) — 현재 버전, 최근 변경 내역
4. `_context/QA-CHECKLIST.md` — 수정 후 점검 절차

## 프로젝트 개요

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다.
실시간 시장 데이터, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed 지수, 포트폴리오 관리 기능을 하나의 HTML 파일에 담고 있다.

- **배포 URL**: `https://ysnle.github.io/aio-screener/`
- **현재 버전**: v39.8
- **메인 파일**: `index.html` (~33,000줄, ~2.1MB)

## 기술 스택

- HTML5, CSS3 (인라인), Vanilla JavaScript (ES5/ES6 혼용) — 프레임워크 없음
- Chart.js (CDN), Inter + JetBrains Mono (Google Fonts), 이모지 아이콘
- API: Yahoo Finance, rss2json, 다수 CORS 프록시 체인
- 프록시: Cloudflare Workers (`cloudflare-worker-proxy.js`)
- 배포: GitHub Pages (정적 호스팅)
- AES-256 (API 키 클라이언트 사이드 암호화), 다크 테마 전용

## 파일 구조

```
AIO/
├── index.html                      ← 메인 (= 최신 버전)
├── aio_ui_prototype_v{N}.html      ← 버전별 스냅샷
├── version.json                    ← 현재 버전 메타데이터
├── CHANGELOG.md                    ← 전체 변경 이력
├── cloudflare-worker-proxy.js      ← CORS 프록시 워커
├── _backup/                        ← 수정 전 백업본
├── _archive/                       ← 이전 버전 보관
├── _context/                       ← QA/점검/규칙 통합 폴더 (유일한 진실의 원천)
│   ├── RULES.md                    ← 마스터 룰 (상세 규칙)
│   ├── BUG-POSTMORTEM.md           ← 버그 사후 분석 누적 로그
│   ├── QA-CHECKLIST.md             ← 실행 가능한 QA 체크리스트
│   ├── working-rules.md            ← 작업 규칙
│   ├── voice-and-style.md          ← 톤 & 스타일 가이드
│   └── archive-reports/            ← 과거 버전별 리포트 아카이브
└── outputs/                        ← 생성 결과물
```

---

## 절대 규칙

### R1. 버전 동기화 (6곳 필수)
버전 변경 시 반드시 6곳 모두 동일한 버전 문자열인지 확인:
1. `<title>` 태그
2. `#app-version-badge` 인라인 텍스트
3. `const APP_VERSION` — JS 상수 (title과 badge를 JS에서 덮어씀)
4. `version.json` → `version` 필드
5. `_context/CLAUDE.md` → `현재 버전:` 행
6. `CHANGELOG.md` → 최상단 항목의 버전 번호

확인 명령:
```bash
grep '<title>' index.html | head -1
grep 'app-version-badge' index.html | grep -o '>v[^<]*<'
cat version.json | grep version
grep '현재 버전' _context/CLAUDE.md
head -20 CHANGELOG.md | grep '## v'
```

### R2. 버전 체계
소수점 아래 1자리만: 31.1, 31.2, ..., 31.9, 32. 절대 31.10 금지.

### R3. 버그 수정 시 사후 분석 필수
모든 버그 수정 후 `_context/BUG-POSTMORTEM.md`에 기록 (형식은 RULES.md 참조).

### R4~R18 — 상세 규칙은 `_context/RULES.md` 참조
주요 항목: 동적 DOM 삽입 주의(R4), CSS overflow 3중 방어(R5), LLM 응답 안전장치(R6), 한국어 텍스트 레이아웃(R7), 차트 텍스트 폴백(R8), Dead Page 방지(R9), 종목코드 3중 검증(R10~R12), CHAT_CONTEXTS 이원화(R13), 뉴스 키워드 현행화(R14), 데이터 미수신 vs 0% 구분(R15), 뉴스 티커 토픽 기반 표시(R16), 키워드 길이 제한(R17), 텔레그램 채널 관리(R18).

---

## 토큰 효율성 규칙

### 응답 스타일
- 인사/칭찬/마무리 멘트 금지 ("Sure!", "Great question!", "I hope this helps!" 등)
- 사용자 질문 되풀이 금지 — 바로 답변/작업 시작
- 불필요한 면책/경고/주의사항 금지 — 코드 작성에 집중
- 요청 범위 외 제안 금지 — 시킨 것만 정확히 수행
- 과잉 설계 금지 — 단순하고 직접적인 해법 우선

### 작업 효율
- 파일은 한 번만 읽기 — 이미 읽은 파일 재읽기 금지 (변경 의심 시 제외)
- 한 번의 집중된 코딩 패스 — write-delete-rewrite 사이클 회피
- 테스트 1회, 수정 필요 시 수정 후 확인 1회 — 불필요한 반복 금지
- ASCII 우선 — em dash(—), smart quotes("") 대신 표준 문자 사용
- 모르면 솔직히 말하기 — 파일 경로나 함수명을 추측/날조 금지

---

## 작업 규칙 (Cowork 메모리에서 이전)

### 버전 백업 파일 관리
- 이전 버전 백업 파일(aio_ui_prototype_vXX.html)에 새 버전 내용을 **절대 덮어쓰지 말 것**
- 새 버전은 항상 새 파일명으로 별도 생성
- 사소한 수정은 현재 버전에 누적, 큰 변경은 버전 번호를 올림

### 항상 최신 버전에서 작업
- 사용자가 버전 번호를 잘못 적더라도 항상 최신 버전 파일을 찾아서 작업
- 작업 시작 전 `ls | sort -V | tail`로 최신 파일 확인

### 코드 수정 시 QA/점검 시스템 자동 반영 필수
코드 수정 완료 시 **사용자가 따로 요청하지 않아도** 아래를 같이 업데이트:
1. `_context/BUG-POSTMORTEM.md` — 버그 원인/수정/예방 기록
2. `_context/QA-CHECKLIST.md` — 새 검증 항목 추가
3. `_context/RULES.md` — 새 규칙/패턴 추가
4. 버전 5포인트 동기화

### 자료 자동 분류 처리
사용자가 자료만 보내면 별도 지시 없이도 자동 처리:
- 분석글/칼럼 → `AIO_콘텐츠_업그레이드_레퍼런스.md`에 기법 추출 병합
- 매크로/시장 시그널 글 → `AIO_매크로_시그널_레퍼런스.md`에 시그널 추출 병합
- UI/대시보드 이미지 → `AIO_UI_디자인_레퍼런스.md`에 패턴 추출 병합
- 기타 → 유형 판단 애매하면 사용자에게 확인

---

## 아키텍처 특징

1. **단일 파일 아키텍처**: 모든 HTML, CSS, JS가 `index.html` 하나에 존재
2. **절대 전체 재작성 금지**: 33,000줄 파일이므로 필요한 부분만 패치
3. **파일 삭제 금지**: 이전 버전 파일은 기록 보존 목적으로 유지
4. **정적 폴백**: API 실패 시 하드코딩된 시세 데이터로 즉시 렌더링
5. **CORS 프록시 체인**: rss2json → 다수 무료 프록시 → Cloudflare Worker 순서로 폴백
6. **페이지 시스템**: `showPage(id)` 함수로 SPA식 탭 전환 (실제 라우팅 아님)
7. **다크 테마 전용**: `#0a0e14` 배경, CSS 변수로 일관된 색상 체계
8. **한국어 UI**: 모든 사용자 대면 텍스트는 한국어
9. **WCAG 접근성**: 최소 대비비 4.5:1 (AA) 준수

## 핵심 함수/패턴

- `applyStaticFallbacks()` — 정적 시세 데이터 즉시 적용
- `fetchLiveQuotes()` — 실시간 시세 API 호출
- `chartDataGate()` — 차트 데이터 검증 게이트 (NaN/null 방어)
- `_ldSafe(ticker, field)` — `_liveData` 안전 접근 + `_SNAP_FALLBACK` 폴백
- `showPage(id)` — SPA 페이지 전환
- `destroyPageCharts(pageId)` — 페이지 이탈 시 Chart.js 인스턴스 정리
- `showConfirmModal()` — 커스텀 확인 모달 (native confirm() 대체)
- `safeLS()` / `safeLSGet()` — 암호화된 localStorage 래퍼

## 상태 라이프사이클

페이지 전환 흐름: `showPage(newPage)` → `destroyPageCharts(oldPage)` → `initXxxPage()` → `initXxxCharts()`

반복 발생 버그 패턴:
- init 가드가 destroy 시 리셋되지 않아 재진입 실패
- 캔버스 ID가 실제 해당 페이지 DOM과 불일치
- popstate와 showPage 양쪽에서 초기화 함수 불일치
- Yahoo Finance API `meta`에 `regularMarketChangePercent` 없음 → 수동 계산 필요

## 작업 유형별 읽을 파일

| 작업 유형 | 읽을 파일 |
|-----------|-----------|
| 버그 수정 | RULES.md → BUG-POSTMORTEM.md → QA-CHECKLIST.md |
| 새 기능 추가 | RULES.md → working-rules.md → QA-CHECKLIST.md |
| QA/점검 요청 | RULES.md → BUG-POSTMORTEM.md → QA-CHECKLIST.md |
| 리팩토링/개편 | RULES.md → BUG-POSTMORTEM.md → CLAUDE.md |
| 버전 릴리스 | RULES.md → working-rules.md (버전 동기화 규칙) |
