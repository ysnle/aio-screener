---
verified_by: agent
last_verified: 2026-04-11
confidence: high
target_version: v46.5
target_file: index.html
target_lines: 39513
---

# index.html CODE-MAP

> **목적**: `index.html` 38,251줄을 Claude가 전체 읽지 않고 Read `offset`/`limit`로 **부분 읽기** 위한 line 범위 맵.
> **사용법**: 작업 전에 이 파일을 읽어 기능에 해당하는 line 범위만 Read. 전체 파일 읽기 금지.
> **갱신 주기**: 큰 리팩토링(±500줄 이상) 시 `/knowledge-lint` 또는 수동 재스캔.

---

## 1. 전체 파일 구조 (38,251줄)

| 범위 | 내용 |
|------|------|
| 1 ~ 28 | `<!DOCTYPE>` / `<head>` / meta / preload |
| 28 ~ 1961 | **인라인 CSS** (`<style>`) — 디자인 토큰, 레이아웃, 컴포넌트, 애니메이션 |
| 1962 ~ 8635 | **HTML DOM** (`<body>` + 사이드바 + 21개 페이지 div) |
| 8636 | Chart.js CDN `<script src>` |
| 8637 ~ 8644 | 짧은 초기화 inline script |
| **8646 ~ 38248** | **메인 JS 엔진** (다수의 연속 `<script>` 블록) |
| 38249 ~ 38251 | `</body></html>` |

### JS 블록 경계 (주요)
| Script 범위 | 역할 추정 |
|------------|----------|
| 8646 ~ 21132 | 상수·데이터·API·유틸·차트 엔진 (가장 큰 블록, ~12,500줄) |
| 21134 ~ 21476 | showConfirmModal 등 UI 유틸 |
| 21478 ~ 26030 | LLM 엔진 + CHAT_CONTEXTS + callClaude |
| 26032 ~ 27884 | 국가/섹터 특화 로직 |
| 27886 ~ 31754 | 한국 시장 페이지 초기화 |
| 31755 ~ 35438 | 대시보드 + 차트 렌더링 |
| 35481 ~ 35659 | glossary draggable button |
| 35668 ~ 37790 | Yahoo 차트 fetch + 한국 기술 차트 |
| 37812 ~ 38011 | 보조 유틸 |
| 38062 ~ 38248 | AI 패널(chatSendUnified) + 이벤트 리스너 |

---

## 2. 21개 페이지 DOM 위치

| 페이지 | id | 시작 line |
|--------|----|----------| 
| 홈 대시보드 | `page-home` | 2234 |
| 매매 시그널 | `page-signal` | 2410 |
| 시장 폭 | `page-breadth` | 3138 |
| 투자 심리 | `page-sentiment` | 3460 |
| 데일리 브리핑 | `page-briefing` | 3611 |
| 차트·기술 | `page-technical` | 3799 |
| 거시경제 | `page-macro` | 4258 |
| 환율·채권 | `page-fxbond` | 4758 |
| 기업 분석 | `page-fundamental` | 5422 |
| 테마/섹터 | `page-themes` | 5550 |
| 테마 상세 | `page-theme-detail` | 5700 |
| 포트폴리오 | `page-portfolio` | 5807 |
| 티커 상세 | `page-ticker` | 6013 |
| 시장 뉴스 | `page-market-news` | 6143 |
| 옵션 분석 | `page-options` | 6247 |
| 한국 홈 | `page-kr-home` | 6979 |
| 한국 공급망 | `page-kr-supply` | 7268 |
| 한국 테마 | `page-kr-themes` | 7463 |
| 한국 거시 | `page-kr-macro` | 7528 |
| 한국 기술 | `page-kr-technical` | 7811 |
| 사용 설명서 | `page-guide` | 8031 |

---

## 3. 주요 상수 정의 (검증됨)

| 상수 | Line | 설명 |
|------|------|------|
| `APP_VERSION` | **9574** | 버전 문자열 (R1 6곳 중 1곳) |
| `DATA_SNAPSHOT` | **9604** | 시장 데이터 SSOT |
| `SCREENER_DB` | **10476** | 스크리너 종목 DB (760+) |
| `MACRO_KW` | **13284** | 거시 뉴스 키워드 (~480개) |
| `TECH_KW` | **13517** | 기술/반도체 뉴스 키워드 (~345개) |
| `KNOWN_TICKERS` | **13979** | 알려진 티커 Set (905+) |
| `LLM_MODELS` | **20936** | Claude 모델 설정 |
| `CHAT_CONTEXTS` | **23641** | 챗 컨텍스트 (§1~§68) |

> 미확인: `FALLBACK_QUOTES`, `LIVE_SYMBOLS`, `LLM_BUDGET` — 필요 시 grep으로 확인.

---

## 4. 주요 함수 위치 (검증됨)

### 데이터/API/유틸
| 함수 | Line | 비고 |
|------|------|------|
| `chartDataGate` | 8728 | 차트 렌더 게이트 (NaN/null 방어) |
| `safeLS` | 9104 | 암호화 localStorage 쓰기 |
| `safeLSGet` | 9115 | 암호화 localStorage 읽기 |
| `safeLSGetSync` | 9126 | 동기 읽기 |
| `drawSparkline` | 11862 | 미니 차트 |
| `fetchWithTimeout` | 12041 | 타임아웃 fetch |
| `fetchViaProxy` | 12099 | CORS 프록시 체인 |
| `fetchChartData` | 12236 | 차트 데이터 |
| `fetchFundamentals` | 12261 | SEC/FMP 재무 |
| `fetchFredSeries` | 12369 | FRED 지표 |
| `escHtml` | 13176 | XSS escape |

### 뉴스 시스템
| 함수 | Line | 비고 |
|------|------|------|
| `scoreItem` | 14657 | 뉴스 중요도 점수 (CJK 가중치 v46.5) |
| `classifyTopic` | 14977 | 주제 분류 (healthcare/space/quantum 포함) |
| `googleTranslateFree` | 15197 | 번역 (단건) |
| `freeTranslateNews` | 15270 | 번역 (배치, 분리자 폴백 v46.5) |
| `autoTranslateNews` | 15400 | 자동 번역 |
| `localEnrichNews` | 15531 | 로컬 enrich |
| `extractTickers` | 15666 | 텍스트→티커 (모호 필터 확장 v46.5) |
| `renderFeed` | 15875 | 시장 뉴스 렌더 |
| `renderHomeFeed` | 16047 | 홈 뉴스 렌더 |
| `renderBriefingFeed` | 16162 | 브리핑 뉴스 렌더 |
| `_markdownToHtml` | 16408 | 마크다운→카드 UI 변환 (v46.5 재설계) |
| `_generateAIBriefing` | 16266 | AI 브리핑 생성 (기관급 프롬프트 v46.5) |
| `fetchAllNews` | 17007 | 80+ 소스 일괄 수집 (점진적 렌더링 v46.5) |

### 실시간 데이터 적용
| 함수 | Line | 비고 |
|------|------|------|
| `applyStaticFallbacks` | 18438 | 정적 폴백 즉시 적용 |
| `applyLiveQuotes` | 18832 | 실시간 시세 주입 |

### 페이지 초기화
| 함수 | Line | 비고 |
|------|------|------|
| `destroyPageCharts` | 10133 | Chart 인스턴스 정리 |
| `showPage` | 10216 | SPA 페이지 전환 |
| `initSentimentPage` | 19446 | |
| `initSentimentCharts` | 19624 | |
| `initBreadthPage` | 19833 | |
| `initBreadthCharts` | 20127 | |
| `showConfirmModal` | 22348 | 커스텀 확인 모달 (R6) |
| `initKoreaHome` | 28185 | |
| `initKoreaSupply` | 28349 | |
| `initKoreaThemes` | 28402 | |
| `initKoreaMacro` | 30386 | |
| `drawScoreGauge` | 33125 | |
| `initSignalDashboard` | 33865 | |
| `updateMarketPulse` | 33969 | 마켓 펄스 바 (v42.1+) |
| `initYieldCurveChart` | 33173 | |
| `drawRRG` | 35277 | 섹터 RRG 차트 |
| `renderSectorPerfBars` | 35556 | 섹터 1일/1주 토글 (v45.5) |
| `initOptionsPage` | 35526 | |
| `_fetchYahooChartData` | 36812 | Yahoo 1년 차트 |
| `initKoreaTechnical` | 38381 | |

### LLM 엔진
| 함수 | Line | 비고 |
|------|------|------|
| `callClaude` | 24548 | 스트리밍 API (30s/60s 타임아웃) |
| `chatSend` | 25150 | 컨텍스트별 전송 |
| `_extractTickers` | 24332 | |
| `_fetchTickerDataForChat` | 24353 | |
| `_fetchDeepCompareData` | 24476 | 3종목 심층 비교 |
| `chatSendUnified` | 38180 | AI 패널 전송 |

---

## 5. 빠른 참조: "기능 → Read 범위"

index.html 수정 전 아래 표에서 line 범위를 찾아 Read offset/limit로만 읽는다.

| 작업 | Read 범위 |
|------|-----------|
| **R1 버전 6곳 동기화** | 9540 (APP_VERSION) + grep `<title>` + grep `app-version-badge` |
| **DATA_SNAPSHOT/폴백 수정** | 9570~9780, 17881~18500 |
| **페이지 전환 / init 가드** | 10077~10300 |
| **스크리너 DB 갱신** | 10442~11400 |
| **API 프록시 체인** | 12041~12400 |
| **뉴스 키워드 (MACRO/TECH)** | 13190~13800 |
| **뉴스 스코어링** | 14459~14800 |
| **뉴스 번역** | 14933~15300 |
| **뉴스 렌더링** | 15627~16100 |
| **뉴스 소스 목록** | 16641~17100 |
| **실시간 시세 적용** | 17881~18500 |
| **심리 페이지 차트** | 19446~19800 |
| **시장 폭 페이지 차트** | 19833~20400 |
| **LLM 모델/예산** | 20355~20700 |
| **모달/confirm** | 21700~21900 |
| **CHAT_CONTEXTS (§1~§64)** | 22980~23700 |
| **callClaude 엔진** | 23879~24100 |
| **chatSend + 티커 감지** | 25150~25700 |
| **한국 페이지** | 28185~32000 |
| **포트폴리오 차트** | 32000~32200 |
| **매매 시그널 대시보드** | 32768~33100 |
| **마켓 펄스 바** | 32872~33000 |
| **RRG 차트** | 34178~34500 |
| **섹터 1주 토글** | 34424~34700 |
| **옵션 분석** | 6247~8030 (DOM) + 35526~36000 (JS) |
| **한국 기술 차트** | 37212~37600 |
| **AI 패널 전송** | 38180~38248 |
| **CSS 변수/레이아웃** | 28~1961 |

---

## 6. 아키텍처 특징 (요약)

1. **단일 파일 아키텍처**: HTML + CSS + JS 모두 `index.html`
2. **절대 전체 재작성 금지**: 38,251줄 — 필요한 부분만 패치
3. **정적 폴백 우선**: `applyStaticFallbacks()` 즉시 렌더 → `applyLiveQuotes()`로 교체
4. **CORS 프록시 체인**: rss2json → 다수 무료 프록시 → Cloudflare Worker
5. **SPA 전환**: `showPage(id)` → `destroyPageCharts(old)` → `initXxxPage()` → `initXxxCharts()`
6. **다크 테마 전용**: `#0a0e14`, CSS 변수 일관성
7. **한국어 UI**: 사용자 대면 텍스트 전량 한국어
8. **WCAG AA**: 대비비 4.5:1

## 7. 상태 라이프사이클 버그 패턴 (반복 발생)

- **init 가드 미리셋**: `if (initialized) return;`을 destroy 시 false로 리셋 안 함 → 재진입 실패 (R9, 3회+ 위반)
- **캔버스 ID 불일치**: 함수가 그리는 canvas id ≠ 실제 DOM id
- **popstate 경로 불일치**: `showPage()`와 popstate 핸들러 불일치
- **Yahoo API 구조 가정**: `meta.regularMarketChangePercent` 없음 → 수동 계산
- **stale DOM 참조** (P43): 리팩토링 후 `getElementById('삭제된-id')` 무음 실패
- **0 falsy 함정**: `if (val)` 에서 0이 false → `_ldSafe()` 또는 `val != null`

---

## 8. 핵심 함수/패턴 (글로벌 유틸)

- `applyStaticFallbacks()` (17881) — 정적 시세 즉시 적용
- `applyLiveQuotes()` (18275) — 실시간 시세 주입
- `chartDataGate()` (8728) — NaN/null 방어
- `_ldSafe(ticker, field)` — `_liveData` 안전 접근 + `_SNAP_FALLBACK` 폴백 (grep으로 위치 확인)
- `showPage(id)` (10160) — SPA 전환
- `destroyPageCharts(pageId)` (10077) — Chart 인스턴스 정리
- `showConfirmModal()` (21725) — native confirm() 대체 (R6)
- `safeLS()` / `safeLSGet()` (9104/9115) — 암호화 localStorage
- `updateMarketPulse()` (32872) — 마켓 펄스 바 (v42.1+)

---

## 9. 주의사항

1. **상수 의존성**: 9540~14400 범위의 상수(DATA_SNAPSHOT, SCREENER_DB, TECH_KW 등)는 수십 군데에서 참조. 함수 수정 시 관련 상수도 함께 Read 권장.
2. **캐시/암호화 로직**: localStorage(`_AioVault`), 뉴스 캐시(10분), 번역 캐시가 있음. 수정 시 캐시 무효화 필요할 수 있음.
3. **단일 파일 유지**: 절대 전체 재작성 금지. line 범위로 부분 패치만.
4. **line 번호 드리프트**: 대규모 편집 후 이 맵의 line 번호가 오프셋될 수 있음. `/knowledge-lint` 실행으로 재검증하거나 수동 grep으로 재확인.
5. **미검증 함수**: 일부 함수(특히 "Explore 추정" 표시된 것)는 실제 grep으로 라인 번호 재확인 권장.
