# AIO Screener — 프로젝트 가이드

## ⚠️ 새 대화창 진입 시 필수 (이전 대화 내용은 기억하지 못함)

**이 프로젝트 작업을 시작하기 전에 반드시 아래 파일들을 순서대로 읽을 것:**

1. `_context/RULES.md` — 마스터 룰 (절대 규칙, 작업 유형별 참조 파일)
2. `_context/BUG-POSTMORTEM.md` — 과거 버그 사후 분석 (같은 실수 반복 방지)
3. `CHANGELOG.md` (최근 5개 항목) — 현재 버전, 최근 변경 내역
4. `_context/QA-CHECKLIST.md` — 수정 후 점검 절차

**버전 규칙**: 소수점 1자리만 (31.1→31.2→...→31.9→32). 버전 변경 시 **5곳 동기화 필수**: title, badge, version.json, CLAUDE.md, CHANGELOG.md. 배포 후 라이브 사이트에서 브라우저 버전 일치 확인 필수 (R1-A 참조).

## 프로젝트 개요

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다.
실시간 시장 데이터, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed 지수, 포트폴리오 관리 기능을 하나의 HTML 파일에 담고 있다.

- **배포 URL**: `https://ysnle.github.io/aio-screener/`
- **현재 버전**: v40.0
- **메인 파일**: `index.html` (~33,000줄, ~2.1MB)

## 기술 스택

| 구분 | 상세 |
|------|------|
| 언어 | HTML5, CSS3 (인라인), Vanilla JavaScript (ES5/ES6 혼용) |
| 프레임워크 | 없음 — 프레임워크 미사용, 순수 바닐라 |
| 차트 | Chart.js (CDN) |
| 폰트 | Inter (본문), JetBrains Mono (수치/코드) — Google Fonts |
| 아이콘 | 이모지 기반 (별도 아이콘 라이브러리 없음) |
| API | Yahoo Finance, rss2json, 다수 CORS 프록시 체인 |
| 프록시 | Cloudflare Workers (`cloudflare-worker-proxy.js`) |
| 배포 | GitHub Pages (정적 호스팅) |
| 암호화 | AES-256 (API 키 클라이언트 사이드 암호화) |
| 스타일 | CSS Custom Properties (`:root` 변수), 다크 테마 기본 |

## 파일 구조

```
AIO/
├── index.html                      ← 메인 (= 최신 버전 복사본)
├── aio_ui_prototype_v{N}.html      ← 버전별 스냅샷
├── version.json                    ← 현재 버전 메타데이터
├── CHANGELOG.md                    ← 전체 변경 이력 (매 버전 필수 기록)
├── aio_loader.html                 ← 로더 페이지
├── api_setup_guide.html            ← API 설정 가이드
├── cloudflare-worker-proxy.js      ← CORS 프록시 워커
├── _backup/                        ← 수정 전 백업본
├── _archive/                       ← 이전 버전 보관
├── _context/                       ← ★ QA/점검/규칙 통합 폴더 (유일한 진실의 원천)
│   ├── RULES.md                    ← 마스터 룰 (가장 먼저 읽기)
│   ├── BUG-POSTMORTEM.md           ← 버그 사후 분석 누적 로그
│   ├── QA-CHECKLIST.md             ← 실행 가능한 QA 체크리스트 v2
│   ├── CLAUDE.md                   ← 이 파일 (프로젝트 컨텍스트)
│   ├── working-rules.md            ← 작업 규칙
│   ├── voice-and-style.md          ← 톤 & 스타일 가이드
│   ├── AUDIT_INDEX.md 등           ← 감사/점검 참조 문서
│   └── archive-reports/            ← 과거 버전별 리포트 아카이브 (20건)
└── outputs/                        ← 생성 결과물
```

## 아키텍처 특징

1. **단일 파일 아키텍처**: 모든 HTML, CSS, JS가 `index.html` 하나에 존재
2. **버전 관리**: 파일명에 버전 번호 포함 (`_v30_12`), 이전 버전은 그대로 보존
3. **정적 폴백**: API 실패 시 하드코딩된 시세 데이터로 즉시 렌더링
4. **CORS 프록시 체인**: rss2json → 다수 무료 프록시 → Cloudflare Worker 순서로 폴백
5. **페이지 시스템**: `showPage(id)` 함수로 SPA식 탭 전환 (실제 라우팅 아님)
6. **다크 테마 전용**: `#0a0e14` 배경, CSS 변수로 일관된 색상 체계

## 핵심 함수/패턴

- `applyStaticFallbacks()` — 정적 시세 데이터 즉시 적용
- `fetchLiveQuotes()` — 실시간 시세 API 호출
- `chartDataGate()` — 차트 데이터 검증 게이트 (NaN/null 방어)
- `showDataError()` — 통합 에러 표시 시스템
- `_sanitizeChartData()` — 차트 데이터 정제 유틸
- `safeLS()` / `safeLSGet()` — 암호화된 localStorage 래퍼
- `_ldSafe(ticker, field)` — `_liveData` 안전 접근 + `_SNAP_FALLBACK` 폴백 보장
- `showPage(id)` — SPA 페이지 전환 (사이드바 클릭)
- `destroyPageCharts(pageId)` — 페이지 이탈 시 Chart.js 인스턴스 정리
- `showConfirmModal(title,msg,callback,icon)` — 커스텀 확인 모달 (v34.1+, native confirm() 대체)
- `renderSparklines(filtered)` / `fetchSparkData(ticker)` / `drawSparkline(canvas,data,ticker)` — 스크리너 5일 미니차트 (v34.1+)
- `getWatchlists()` / `saveWatchlists()` / `createWatchlist()` / `addToWatchlistFromScreener(ticker)` — 다중 워치리스트 CRUD (v34.1+, localStorage `aio_watchlists`)

## 상태 라이프사이클 (주의 필수)

이 프로젝트는 SPA 방식으로 페이지를 전환하므로, 차트/데이터의 init → destroy → re-init 사이클이 핵심이다.

**페이지 전환 흐름:**
`showPage(newPage)` → `destroyPageCharts(oldPage)` → 새 페이지 `initXxxPage()` → `initXxxCharts()`

**반복 발생 버그 패턴:**
1. `sentChartsInitialized` 같은 init 가드가 destroy 시 리셋되지 않아 재진입 실패
2. `initYieldCurveChart()`가 `yieldCurveChart`(macro)에 그리지만 fxbond의 `koreaCurveChart`는 방치
3. `popstate` 핸들러가 `showPage()` 내부 로직과 불일치 (signal 페이지 DOM 미갱신)
4. Yahoo Finance API `meta` 객체에 `regularMarketChangePercent` 필드 없음 → 수동 계산 필요

**수정 시 반드시 확인:**
- init 가드 변수가 destroy 시 false로 리셋되는가?
- 함수가 그리는 캔버스 ID가 실제 해당 페이지 DOM과 일치하는가?
- popstate와 showPage 양쪽에서 동일한 초기화 함수를 호출하는가?
- `_ldSafe()` 대신 raw `ld['XXX']` 접근 시 null 핸들링이 있는가?

## QA 시스템

- 코드 수정 후 → `_context/QA-CHECKLIST.md` 따라 런타임 검증
- 버그 수정 후 → `_context/BUG-POSTMORTEM.md`에 사후 분석 기록
- 모든 작업 후 → `CHANGELOG.md`에 변경 이력 기록
- 상세 규칙 → `_context/RULES.md` 참조

## 주의사항

- **절대 전체 재작성 금지**: 23,000줄 파일이므로 필요한 부분만 패치
- **파일 삭제 금지**: 이전 버전 파일은 기록 보존 목적으로 유지
- **버전 동기화 필수**: title, badge, version.json, 파일명 4곳 일치 확인 (RULES.md R1)
- **버전 체계**: 소수점 1자리만 (31.1→31.9→32). 절대 31.10 금지 (RULES.md R2)
- **CORS 민감**: 외부 API 호출 시 프록시 체인 구조 존중
- **div 균형 확인**: 수정 후 열림/닫힘 태그 쌍 반드시 검증
- **한국어 UI**: 모든 사용자 대면 텍스트는 한국어
- **WCAG 접근성**: 최소 대비비 4.5:1 (AA) 준수, 밝은 환경 가독성 고려
- **CDN 의존성**: Chart.js, Google Fonts 등 외부 CDN 장애 시 그레이스풀 디그레이드
- **성능**: 폰트 preload, 비동기 로드 등 렌더 차단 최소화 패턴 유지
