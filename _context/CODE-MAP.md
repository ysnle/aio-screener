---
verified_by: agent
last_verified: 2026-05-09
confidence: high
target_version: v49.1
target_file: index.html + js/*.js
target_lines: index.html 29621 + js modules 25663
---

# AIO v49.1 CODE-MAP

> 목적: 현재 모듈화된 AIO 코드를 전체 재읽기 없이 부분 탐색하기 위한 line 범위 맵.
> 원칙: 작업 전 이 파일에서 담당 파일과 범위를 찾고, 실제 수정 전 `Select-String`/부분 Read로 한 번 더 확인한다.

---

## 1. 현재 파일 구조

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `index.html` | 29,621 | HTML shell, CSS, 21개 페이지 DOM, 일부 inline runtime, 외부 모듈 로드 |
| `js/aio-core.js` | 6,369 | 버전, 전역 상태, DATA_SNAPSHOT, 캐시, data freshness/pipeline audit, 페이지 라우터, LWC/Deep Chart 공통 유틸 |
| `js/aio-data.js` | 11,157 | API fetcher, OHLCV, live coverage guard, 뉴스 소스/스코어링/렌더, 키워드, 캘린더, 데이터 스케줄 |
| `js/aio-ui.js` | 2,286 | 심리/시장폭 차트, LLM quota UI, GitHub polling, feedback UI |
| `js/aio-chat.js` | 4,577 | CHAT_CONTEXTS, Claude/Perplexity, 기업 분석, fundamentalSearch |
| `js/aio-tests.js` | 970 | 브라우저 단위 테스트 T1~T102, `AIO.runTests()` / `AIO.getTestResults()` |
| `js/aio-glossary.js` | 304 | 용어사전 검색/렌더 |

---

## 2. index.html 구조

| 범위 | 내용 |
|------|------|
| 1 ~ 38 | head meta, title, preload |
| 39 ~ 3472 | 메인 CSS |
| 3473 ~ 11964 | body shell + 21개 page DOM |
| 11965 ~ 11983 | CDN + `aio-core/data/ui` 로드 |
| 11985 ~ 14724 | inline runtime block 1 |
| 14725 | `js/aio-chat.js` 로드 |
| 14727 ~ 26658 | inline runtime block 2 |
| 26664 | `js/aio-tests.js` 로드 |
| 26670 | `js/aio-glossary.js` 로드 |
| 26671 ~ 29621 | glossary/service worker/deep analysis/update helpers + closing HTML |

### 21개 페이지 DOM 시작점

| 페이지 | id | 시작 line |
|--------|----|----------:|
| 홈 대시보드 | `page-home` | 3767 |
| 매매 시그널 | `page-signal` | 4187 |
| 시장 폭 | `page-breadth` | 5008 |
| 투자 심리 | `page-sentiment` | 5403 |
| 데일리 브리핑 | `page-briefing` | 5686 |
| 차트·기술 | `page-technical` | 6054 |
| 거시경제 | `page-macro` | 6496 |
| 환율·채권 | `page-fxbond` | 7090 |
| 기업 분석 | `page-fundamental` | 7852 |
| 테마/섹터 | `page-themes` | 8102 |
| 테마 상세 | `page-theme-detail` | 8360 |
| 포트폴리오 | `page-portfolio` | 8467 |
| 티커 상세 | `page-ticker` | 8839 |
| 시장 뉴스 | `page-market-news` | 9126 |
| 옵션 분석 | `page-options` | 9267 |
| 한국 홈 | `page-kr-home` | 10083 |
| 한국 공급망 | `page-kr-supply` | 10424 |
| 한국 테마 | `page-kr-themes` | 10656 |
| 한국 거시 | `page-kr-macro` | 10753 |
| 한국 기술 | `page-kr-technical` | 11082 |
| 사용 설명서 | `page-guide` | 11329 |

---

## 3. 핵심 상수/함수 위치

### `js/aio-core.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `_aioRegisterTimer` | 437 | 타이머 레지스트리, 중복 등록 정리 |
| `_aioPageBus` | 461 | 페이지 이벤트 라우팅 허브 |
| `_aioOnce` / `_aioGlobalRegistry` | 549 | 멱등 초기화와 전역 상태 이전 레지스트리 |
| `_aioFiniteNum` / `_aioSafeDiv` | 590 | NaN/Infinity/분모 0 통합 방어 |
| `_aioLRU` | 609 | score/ticker regex 등 용량 제한 캐시 |
| `_aioMarkChartCanvases` | 306 | LightweightCharts 내부 canvas `aria-hidden` 처리 |
| `chartDataGate` | 1865 | 차트 NaN/null 방어 |
| `safeLS` / `safeLSGet` / `safeLSGetSync` | 2296 / 2309 / 2322 | 암호화 localStorage |
| `APP_VERSION` | 3286 | R1 버전 단일 소스 |
| `AIO.getLiveCoverage` / `getDataFreshnessAudit` | 3724 / 3754 | core live quote coverage + freshness audit |
| `AIO.getDataPipelineAudit` | 3785 | source/API → transport/cache → scheduler → store → analysis → render audit |
| `AIO.getOperationalHealth` | 3954 | 운영/SW/API/cache/data freshness/data pipeline 자체 진단 |
| `DATA_SNAPSHOT` | 4134 | 시장 데이터 SSOT (`window.DATA_SNAPSHOT` exposed at 3684) |
| `applyDataSnapshot` | 5039 | snapshot → DOM, 키별 오류 격리 |
| `_ldSafe` | 5418 | liveData + snapshot fallback |
| `destroyPageCharts` | 5492 | 페이지 이탈 차트 정리 |
| `showPage` | 5936 | SPA 페이지 전환 |
| `_calcPortfolioVaR` | 6244 | 보수적 historical VaR |

### `js/aio-data.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `DATA_APIS` | 1593 | API registry |
| `fetchOHLCV` | 1944 | v48.78 deep technical OHLCV |
| `fetchFinnhubEarningsCalendar` | 2614 | 어닝 일정 |
| `REFRESH_SCHEDULE` | 2856 | 자동 갱신 스케줄 |
| `AIO_NEWS_SOURCES` | 3262 | RSS/뉴스 소스 |
| `MACRO_KW` | 3405 | 매크로 키워드 |
| `TECH_KW` | 3760 | 기술/AI 키워드 |
| `KNOWN_TICKERS` | 4427 | 티커 Set |
| `scoreItem` | 5174 | 뉴스 중요도 점수 + LRU 캐시 |
| `classifyTopic` | 5532 | 뉴스 토픽 분류 |
| `renderFeed` | 6480 | 시장 뉴스 렌더 |
| `renderHomeFeed` | 6667 | 홈 뉴스 렌더 |
| `renderBriefingFeed` | 6781 | 브리핑 뉴스 렌더 |
| `fetchOneFeed` | 7324 | 단일 피드 fetch |
| `fetchAllNews` | 7654 | 뉴스 전체 수집 |
| `fetchLiveQuotes` | 8568 | live quote pipeline + core coverage guard |
| `vixToPercentile` | 9385 | VIX percentile 로그 외삽 |
| `applyLiveQuotes` | 9846 | live quote store + DOM render sink |
| `toggleSignalMode` | 10511 | signal UI mode state |

### `js/aio-ui.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `_refreshSentimentChartData` | 14 | VIX/HYG 동적 차트 |
| `_SENT_COMMON` | 59 | sentiment chart data |
| `_initSentVixChart` | 73 | VIX chart |
| `_initSentNaaimChart` | 151 | NAAIM chart |
| `_initSentIIChart` | 230 | Investors Intelligence |
| `_initSentHYChart` | 291 | HY OAS chart |
| `initSentimentPage` | 352 | sentiment init |
| `initBreadthPage` | 638 | breadth init |
| `LLM_MODELS` | 1293 | Claude 모델 설정 |
| `LLM_BUDGET` | 1444 | 예산/쿼터 |
| `updateQuotaBadge` | 1521 | LLM UI 동기화 |
| `ghPollOnce` | 1717 | GitHub version polling |
| `globalRefresh` | 1897 | 전체 새로고침 |
| feedback UI | 1949 ~ 2038 | 피드백 패널 |

### `js/aio-chat.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `CHAT_CONTEXTS` | 8 | AI persona/context |
| `_fetchDeepCompareData` | 1904 | 심층 기업 비교 데이터 |
| `_googleSearch` | 2570 | Google CSE fallback |
| `chatSend` | 2695 | 컨텍스트별 AI 전송 |
| `_fmtNum` | 3235 | NaN/Infinity → `—` 표시 방어 |
| `fundamentalSearch` | 3350 | 기업 분석 수집/렌더 |
| `_renderFundHeader` | 3598 | 기업 분석 헤더 |
| `_renderFundFinancials` | 3727 | 재무/애널리스트/SEC Frames, Infinity guard |
| `_renderFundEarnings` | 4113 | 어닝 일정/서프라이즈 |
| `_renderFundNews` | 4169 | Finnhub 기업 뉴스 |

---

## 4. 빠른 작업 참조

| 작업 | 우선 파일/범위 |
|------|----------------|
| R1 버전 동기화 | `index.html:10`, `index.html:3780`, `js/aio-core.js:3286`, `version.json`, `sw.js:8`, `_context/CLAUDE.md`, `CHANGELOG.md` |
| DATA_SNAPSHOT 갱신 | `js/aio-core.js:4134~5039`, `js/aio-core.js:3724~3954` freshness/pipeline audit, `js/aio-ui.js` chart arrays |
| 뉴스 소스/키워드 | `js/aio-data.js:3262~4427` |
| 뉴스 선별/렌더 | `js/aio-data.js:5174~6781` |
| 뉴스 수집 안정성 | `js/aio-data.js:7324~8080` |
| 페이지 전환/init 가드 | `js/aio-core.js:5418~5936`, 각 page init 함수 |
| sentiment/breadth 차트 | `js/aio-ui.js:1~1050` |
| LLM 모델/쿼터 | `js/aio-ui.js:1293~1585` |
| Claude 채팅/웹검색 | `js/aio-chat.js:1~3349` |
| 기업 분석 UI | `index.html:7852~8101`, `js/aio-chat.js:3350~4577` |
| 포트폴리오 DOM | `index.html:8467~8838` |
| 포트폴리오 benchmark chart | `index.html:28663~28827` |
| 옵션 분석 DOM | `index.html:9267~10082` |
| 한국 페이지 DOM | `index.html:10083~11328` |
| browser unit tests | `js/aio-tests.js:1~970`, `index.html:26664` |
| glossary | `js/aio-glossary.js`, `index.html:26670~29260` |

---

## 5. 검증 메모

- v49.1 Claude 작업본(`brave-curie-5c8b22`) 통합 기준. v48.85 데이터 파이프라인 보강은 incoming에 포함됨.
- HTML inline `onclick=` attribute는 0건. JS property assignment `.onclick =`는 modal/prompt overlay 내부에서 4건 존재.
- `.claude/commands`와 `.claude/hooks`는 GitHub-tracked checkout에는 없음. Claude 로컬 운영 워크트리에만 존재할 수 있으므로 배포 검증과 운영 검증을 구분한다.
- 큰 구조 변경 뒤에는 이 파일의 line 번호를 반드시 재스캔한다.
