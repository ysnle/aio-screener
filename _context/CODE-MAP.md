---
verified_by: agent
last_verified: 2026-05-05
confidence: high
target_version: v48.79
target_file: index.html + js/*.js
target_lines: index.html 29308 + js modules 22932
---

# AIO v48.79 CODE-MAP

> 목적: 현재 모듈화된 AIO 코드를 전체 재읽기 없이 부분 탐색하기 위한 line 범위 맵.
> 원칙: 작업 전 이 파일에서 담당 파일과 범위를 찾고, 실제 수정 전 `Select-String`/부분 Read로 한 번 더 확인한다.

---

## 1. 현재 파일 구조

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `index.html` | 29,308 | HTML shell, CSS, 21개 페이지 DOM, 일부 inline runtime, 외부 모듈 로드 |
| `js/aio-core.js` | 5,210 | 버전, 전역 상태, DATA_SNAPSHOT, 캐시, 페이지 라우터, LWC/Deep Chart 공통 유틸 |
| `js/aio-data.js` | 10,983 | API fetcher, OHLCV, 뉴스 소스/스코어링/렌더, 키워드, 캘린더, 데이터 스케줄 |
| `js/aio-ui.js` | 2,252 | 심리/시장폭 차트, LLM quota UI, GitHub polling, feedback UI |
| `js/aio-chat.js` | 4,183 | CHAT_CONTEXTS, Claude/Perplexity, 기업 분석, fundamentalSearch |
| `js/aio-glossary.js` | 304 | 용어사전 검색/렌더 |

---

## 2. index.html 구조

| 범위 | 내용 |
|------|------|
| 1 ~ 38 | head meta, title, preload |
| 39 ~ 3408 | 메인 CSS |
| 3409 ~ 11897 | body shell + 21개 page DOM |
| 11898 ~ 11914 | CDN + `aio-core/data/ui` 로드 |
| 11916 ~ 14646 | inline runtime block 1 |
| 14647 | `js/aio-chat.js` 로드 |
| 14649 ~ 26356 | inline runtime block 2 |
| 26357 | `js/aio-glossary.js` 로드 |
| 26358 ~ 29308 | glossary/service worker/deep analysis/update helpers + closing HTML |

### 21개 페이지 DOM 시작점

| 페이지 | id | 시작 line |
|--------|----|----------:|
| 홈 대시보드 | `page-home` | 3702 |
| 매매 시그널 | `page-signal` | 4121 |
| 시장 폭 | `page-breadth` | 4942 |
| 투자 심리 | `page-sentiment` | 5337 |
| 데일리 브리핑 | `page-briefing` | 5620 |
| 차트·기술 | `page-technical` | 5984 |
| 거시경제 | `page-macro` | 6426 |
| 환율·채권 | `page-fxbond` | 7020 |
| 기업 분석 | `page-fundamental` | 7782 |
| 테마/섹터 | `page-themes` | 8006 |
| 테마 상세 | `page-theme-detail` | 8264 |
| 포트폴리오 | `page-portfolio` | 8371 |
| 티커 상세 | `page-ticker` | 8730 |
| 시장 뉴스 | `page-market-news` | 9017 |
| 옵션 분석 | `page-options` | 9158 |
| 한국 홈 | `page-kr-home` | 9974 |
| 한국 공급망 | `page-kr-supply` | 10315 |
| 한국 테마 | `page-kr-themes` | 10547 |
| 한국 거시 | `page-kr-macro` | 10644 |
| 한국 기술 | `page-kr-technical` | 10973 |
| 사용 설명서 | `page-guide` | 11220 |

---

## 3. 핵심 상수/함수 위치

### `js/aio-core.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `chartDataGate` | 1361 | 차트 NaN/null 방어 |
| `safeLS` / `safeLSGet` / `safeLSGetSync` | 1789 / 1802 / 1815 | 암호화 localStorage |
| `APP_VERSION` | 2760 | R1 버전 단일 소스 |
| `DATA_SNAPSHOT` | 3264 | 시장 데이터 SSOT |
| `applyDataSnapshot` | 4121 | snapshot → DOM |
| `_ldSafe` | 4483 | liveData + snapshot fallback |
| `destroyPageCharts` | 4526 | 페이지 이탈 차트 정리 |
| `showPage` | 4962 | SPA 페이지 전환 |

### `js/aio-data.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `DATA_APIS` | 1588 | API registry |
| `fetchOHLCV` | 1934 | v48.78 deep technical OHLCV |
| `fetchFinnhubEarningsCalendar` | 2585 | 어닝 일정 |
| `REFRESH_SCHEDULE` | 2827 | 자동 갱신 스케줄 |
| `AIO_NEWS_SOURCES` | 3202 | RSS/뉴스 소스 |
| `MACRO_KW` | 3345 | 매크로 키워드 |
| `TECH_KW` | 3686 | 기술/AI 키워드 |
| `KNOWN_TICKERS` | 4331 | 티커 Set |
| `scoreItem` | 5055 | 뉴스 중요도 점수 |
| `classifyTopic` | 5396 | 뉴스 토픽 분류 |
| `renderFeed` | 6338 | 시장 뉴스 렌더 |
| `renderHomeFeed` | 6525 | 홈 뉴스 렌더 |
| `renderBriefingFeed` | 6639 | 브리핑 뉴스 렌더 |
| `fetchOneFeed` | 7182 | 단일 피드 fetch |
| `fetchAllNews` | 7512 | 뉴스 전체 수집 |
| `fetchLiveQuotes` | 8426 | live quote pipeline |
| `toggleSignalMode` | 10341 | signal UI mode state |

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
| feedback UI | 1951 ~ 2040 | 피드백 패널 |

### `js/aio-chat.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `CHAT_CONTEXTS` | 8 | AI persona/context |
| `_fetchDeepCompareData` | 1904 | 심층 기업 비교 데이터 |
| `_googleSearch` | 2569 | Google CSE fallback |
| `chatSend` | 2694 | 컨텍스트별 AI 전송 |
| `fundamentalSearch` | 3335 | 기업 분석 수집/렌더 |
| `_renderFundHeader` | 3581 | 기업 분석 헤더 |
| `_renderFundFinancials` | 3707 | 재무/애널리스트/SEC Frames |
| `_renderFundEarnings` | 4086 | 어닝 일정/서프라이즈 |
| `_renderFundNews` | 4142 | Finnhub 기업 뉴스 |

---

## 4. 빠른 작업 참조

| 작업 | 우선 파일/범위 |
|------|----------------|
| R1 버전 동기화 | `index.html:10`, `index.html:3715`, `js/aio-core.js:2760`, `version.json`, `_context/CLAUDE.md`, `CHANGELOG.md` |
| DATA_SNAPSHOT 갱신 | `js/aio-core.js:3264~4121`, `js/aio-ui.js` chart arrays |
| 뉴스 소스/키워드 | `js/aio-data.js:3202~4331` |
| 뉴스 선별/렌더 | `js/aio-data.js:5055~6639` |
| 뉴스 수집 안정성 | `js/aio-data.js:7182~7931` |
| 페이지 전환/init 가드 | `js/aio-core.js:4526~5002`, 각 page init 함수 |
| sentiment/breadth 차트 | `js/aio-ui.js:1~1050` |
| LLM 모델/쿼터 | `js/aio-ui.js:1293~1585` |
| Claude 채팅/웹검색 | `js/aio-chat.js:1~3334` |
| 기업 분석 UI | `index.html:7711~7934`, `js/aio-chat.js:3335~4183` |
| 포트폴리오 DOM | `index.html:8300~8658` |
| 포트폴리오 benchmark chart | `index.html:28022~28190` |
| 옵션 분석 DOM | `index.html:9087~9902` |
| 한국 페이지 DOM | `index.html:9903~11148` |
| glossary | `js/aio-glossary.js`, `index.html:26238~28957` |

---

## 5. 검증 메모

- v48.77 live site와 GitHub main은 CRLF/LF 정규화 후 `index.html`, `version.json`, `manifest.json`, `sw.js`, `js/*.js` 모두 일치.
- HTML inline `onclick=` attribute는 0건. JS property assignment `.onclick =`는 modal/prompt overlay 내부에서 4건 존재.
- `.claude/commands`와 `.claude/hooks`는 GitHub-tracked checkout에는 없음. Claude 로컬 운영 워크트리에만 존재할 수 있으므로 배포 검증과 운영 검증을 구분한다.
- 큰 구조 변경 뒤에는 이 파일의 line 번호를 반드시 재스캔한다.
