---
verified_by: agent
last_verified: 2026-05-12
confidence: high
target_version: v49.5
target_file: index.html + js/*.js
target_lines: index.html 29758 + js modules 26916
---

# AIO v49.5 CODE-MAP

> 목적: 현재 모듈화된 AIO 코드를 전체 재읽기 없이 부분 탐색하기 위한 line 범위 맵.
> 원칙: 작업 전 이 파일에서 담당 파일과 범위를 찾고, 실제 수정 전 `Select-String`/부분 Read로 한 번 더 확인한다.

---

## 1. 현재 파일 구조

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `index.html` | 29,758 | HTML shell, CSS, 21개 페이지 DOM, Institutional Technical Brief + Lockout/OPEX Control DOM, portfolio technical risk runtime, 일부 inline runtime, 외부 모듈 로드 |
| `js/aio-core.js` | 7,158 | 버전, 전역 상태, DATA_SNAPSHOT, 캐시, technical snapshot/sell pressure engine, Lockout/OPEX strategy engine, DataQuality/AIInfraHeat/PortfolioTechnicalRisk, freshness policy/SnapshotStore/auditAllFreshness, data pipeline audit, 페이지 라우터 |
| `js/aio-data.js` | 11,374 | API fetcher, OHLCV + Yahoo fallback + quality bundle, OPEX/put-call/lockout bundle fetchers, live coverage guard, 뉴스 소스/스코어링/impact vector/렌더, 키워드, 캘린더, 데이터 스케줄 + scheduler telemetry |
| `js/aio-ui.js` | 2,688 | 심리/시장폭 차트, Institutional Technical Brief + Lockout/OPEX renderers, data-quality/news-impact/portfolio-risk renderers, LLM quota UI, GitHub polling, feedback UI |
| `js/aio-chat.js` | 4,584 | CHAT_CONTEXTS, Lockout/OPEX technical prompt, Claude/Perplexity, 기업 분석, fundamentalSearch |
| `js/aio-tests.js` | 1,112 | 브라우저 단위 테스트 T1~T132, `AIO.runTests()` / `AIO.getTestResults()` |
| `js/aio-glossary.js` | 304 | 용어사전 검색/렌더 |

---

## 2. index.html 구조

| 범위 | 내용 |
|------|------|
| 1 ~ 38 | head meta, title, preload |
| 39 ~ 3472 | 메인 CSS |
| 3473 ~ 12084 | body shell + 21개 page DOM |
| 12085 ~ 12103 | CDN + `aio-core/data/ui` 로드 |
| 12105 ~ 15047 | inline runtime block 1 |
| 15048 | `js/aio-chat.js` 로드 |
| 15050 ~ 26790 | inline runtime block 2 |
| 26798 | `js/aio-glossary.js` 로드 |
| 26800 | `js/aio-tests.js` 로드 |
| 26801 ~ 29758 | glossary/service worker/deep analysis/update helpers + closing HTML |

### 21개 페이지 DOM 시작점

| 페이지 | id | 시작 line |
|--------|----|----------:|
| 홈 대시보드 | `page-home` | 3767 |
| 매매 시그널 | `page-signal` | 4187 |
| 시장 폭 | `page-breadth` | 5023 |
| 투자 심리 | `page-sentiment` | 5418 |
| 데일리 브리핑 | `page-briefing` | 5701 |
| 차트·기술 | `page-technical` | 6069 |
| 거시경제 | `page-macro` | 6525 |
| 환율·채권 | `page-fxbond` | 7119 |
| 기업 분석 | `page-fundamental` | 7881 |
| 테마/섹터 | `page-themes` | 8131 |
| 테마 상세 | `page-theme-detail` | 8389 |
| 포트폴리오 | `page-portfolio` | 8496 |
| 티커 상세 | `page-ticker` | 8868 |
| 시장 뉴스 | `page-market-news` | 9155 |
| 옵션 분석 | `page-options` | 9296 |
| 한국 홈 | `page-kr-home` | 10112 |
| 한국 공급망 | `page-kr-supply` | 10453 |
| 한국 테마 | `page-kr-themes` | 10685 |
| 한국 거시 | `page-kr-macro` | 10782 |
| 한국 기술 | `page-kr-technical` | 11111 |
| 사용 설명서 | `page-guide` | 11358 |

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
| Institutional technical engine | 3286 ~ 3560 | OHLCV snapshot, sell pressure, semiconductor heat, exit plan |
| `APP_VERSION` | 3562 | R1 버전 단일 소스 |
| `AIO.getLiveCoverage` / `getDataFreshnessAudit` | 4000 / 4030 | core live quote coverage + freshness audit |
| `AIO.getDataPipelineAudit` | 4061 | source/API → transport/cache → scheduler → store → analysis → render audit |
| `AIO.getOperationalHealth` | 4230 | 운영/SW/API/cache/data freshness/data pipeline 자체 진단 |
| `DATA_SNAPSHOT` | 4410 | 시장 데이터 SSOT (`window.DATA_SNAPSHOT` exposed at 4618) |
| `applyDataSnapshot` | 5315 | snapshot → DOM, 키별 오류 격리 |
| `_ldSafe` | 5694 | liveData + snapshot fallback |
| `destroyPageCharts` | 5768 | 페이지 이탈 차트 정리 |
| `showPage` | 6215 | SPA 페이지 전환 |
| `_calcPortfolioVaR` | 6523 | 보수적 historical VaR |

### `js/aio-data.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `DATA_APIS` | 1593 | API registry |
| `fetchOHLCV` | 1944 | v48.78 deep technical OHLCV |
| `fetchOHLCVWithFallback` | 2008 | Twelve Data → Yahoo chart fallback OHLCV normalizer |
| `fetchFinnhubEarningsCalendar` | 2666 | 어닝 일정 |
| `REFRESH_SCHEDULE` | 2908 | 자동 갱신 스케줄 |
| `AIO_NEWS_SOURCES` | 3314 | RSS/뉴스 소스 |
| `MACRO_KW` | 3457 | 매크로 키워드 |
| `TECH_KW` | 3812 | 기술/AI 키워드 |
| `KNOWN_TICKERS` | 4479 | 티커 Set |
| `scoreItem` | 5226 | 뉴스 중요도 점수 + LRU 캐시 |
| `classifyTopic` | 5584 | 뉴스 토픽 분류 |
| `renderFeed` | 6532 | 시장 뉴스 렌더 |
| `renderHomeFeed` | 6719 | 홈 뉴스 렌더 |
| `renderBriefingFeed` | 6833 | 브리핑 뉴스 렌더 |
| `fetchOneFeed` | 7376 | 단일 피드 fetch |
| `fetchAllNews` | 7706 | 뉴스 전체 수집 |
| `fetchLiveQuotes` | 8620 | live quote pipeline + core coverage guard |
| `vixToPercentile` | 9437 | VIX percentile 로그 외삽 |
| `applyLiveQuotes` | 9898 | live quote store + DOM render sink |
| `toggleSignalMode` | 10563 | signal UI mode state |

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
| Institutional Technical Brief renderers | 2288 ~ 2555 | 4-chart report, key levels, sell pressure, exit plan, data quality/news impact/portfolio risk renderers, beginner explanation |

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
| R1 버전 동기화 | `index.html:10`, `index.html:3780`, `js/aio-core.js:3562`, `version.json`, `sw.js:8`, `_context/CLAUDE.md`, `CHANGELOG.md` |
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
| browser unit tests | `js/aio-tests.js:1~1021`, `index.html:26693` |
| glossary | `js/aio-glossary.js`, `index.html:26670~29260` |

---

## 5. 검증 메모

- v49.5는 v49.4 데이터 최신성 거버넌스 위에 Lockout Rally/OPEX 전략 엔진, terminal candle, breadth rotation, action ladder UI/tests를 추가한 기준.
- v49.4는 v49.3 아키텍처 보강 위에 freshness policy, SnapshotStore, scheduler telemetry, auditAllFreshness, WebSearch fallback refresh를 추가한 기준.
- HTML inline `onclick=` attribute는 0건. JS property assignment `.onclick =`는 modal/prompt overlay 내부에서 4건 존재.
- `.claude/commands`와 `.claude/hooks`는 GitHub-tracked checkout에는 없음. Claude 로컬 운영 워크트리에만 존재할 수 있으므로 배포 검증과 운영 검증을 구분한다.
- 큰 구조 변경 뒤에는 이 파일의 line 번호를 반드시 재스캔한다.
