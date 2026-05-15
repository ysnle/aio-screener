---
verified_by: agent
last_verified: 2026-05-15
confidence: high
target_version: v49.16
target_file: index.html + js/*.js
target_lines: index.html 28156 + js modules 27128
---

# AIO v49.16 CODE-MAP

> 목적: 현재 모듈화된 AIO 코드를 전체 재읽기 없이 부분 탐색하기 위한 line 범위 맵.
> 원칙: 작업 전 이 파일에서 담당 파일과 범위를 찾고, 실제 수정 전 `Select-String`/부분 Read로 한 번 더 확인한다.

---

## 1. 현재 파일 구조

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `index.html` | 28,156 | HTML shell, CSS, compact Page Focus Brief styles, explain summary styles, 21개 페이지 DOM, Institutional Technical Brief + Lockout/OPEX/Blow-off Top Control DOM, portfolio technical risk runtime, theme/trend no-static-current rendering, unified AI panel runtime, AI freshness preflight hook, 일부 inline runtime, 외부 모듈 로드 |
| `js/aio-core.js` | 7,679 | 버전, 전역 상태, DATA_SNAPSHOT, 캐시, Page Focus Brief UX, compact content simplification, beginner explain summaries, static data governance/auto-ops readiness, automatic freshness planner/continuity audit, dynamic page symbol collection, technical snapshot/sell pressure engine, Lockout/OPEX/Blow-off Top strategy engine, DataQuality/AIInfraHeat/PortfolioTechnicalRisk, freshness policy/SnapshotStore/auditAllFreshness, data pipeline audit, 페이지 라우터 |
| `js/aio-data.js` | 10,995 | API fetcher, OHLCV + Yahoo fallback + quality bundle, OPEX/put-call/lockout bundle fetchers, live coverage guard, 뉴스 소스/스코어링/impact vector/렌더, HOME stale-event filter, Telegram/Aether pipeline audit, 키워드, 캘린더, 데이터 스케줄 + scheduler telemetry + force refresh + `ensureFreshDataForUse`, requested-symbol quote batch refresh |
| `js/aio-ui.js` | 2,556 | 심리/시장폭 차트, Institutional Technical Brief + Lockout/OPEX/Blow-off Top renderers, data-quality/news-impact/portfolio-risk renderers, LLM quota UI, GitHub polling, feedback UI |
| `js/aio-chat.js` | 4,330 | CHAT_CONTEXTS, intent/memory/data-coverage prompt governance, AI freshness preflight hook, Lockout/OPEX/Blow-off Top technical prompt, Claude/Perplexity, 기업 분석, fundamentalSearch |
| `js/aio-tests.js` | 1,164 | 브라우저 단위 테스트 T1~T169, `AIO.runTests()` / `AIO.getTestResults()` |
| `js/aio-glossary.js` | 304 | 용어사전 검색/렌더 |

---

## 2. index.html 구조

| 범위 | 내용 |
|------|------|
| 1 ~ 38 | head meta, title, preload |
| 39 ~ 3472 | 메인 CSS |
| 3473 ~ 12280 | body shell + 21개 page DOM |
| 12281 ~ 12299 | CDN + `aio-core/data/ui` 로드 |
| 12301 ~ 15242 | inline runtime block 1 |
| 15243 | `js/aio-chat.js` 로드 |
| 15245 ~ 26985 | inline runtime block 2 |
| 26993 | `js/aio-glossary.js` 로드 |
| 26995 | `js/aio-tests.js` 로드 |
| 26996 ~ 29978 | glossary/service worker/deep analysis/unified AI panel/update helpers + closing HTML |

### 21개 페이지 DOM 시작점

| 페이지 | id | 시작 line |
|--------|----|----------:|
| 홈 대시보드 | `page-home` | 3948 |
| 매매 시그널 | `page-signal` | 4368 |
| 시장 폭 | `page-breadth` | 5204 |
| 투자 심리 | `page-sentiment` | 5599 |
| 데일리 브리핑 | `page-briefing` | 5882 |
| 차트·기술 | `page-technical` | 6250 |
| 거시경제 | `page-macro` | 6730 |
| 환율·채권 | `page-fxbond` | 7324 |
| 기업 분석 | `page-fundamental` | 8086 |
| 테마/섹터 | `page-themes` | 8336 |
| 테마 상세 | `page-theme-detail` | 8594 |
| 포트폴리오 | `page-portfolio` | 8701 |
| 티커 상세 | `page-ticker` | 9085 |
| 시장 뉴스 | `page-market-news` | 9372 |
| 옵션 분석 | `page-options` | 9513 |
| 한국 홈 | `page-kr-home` | 10322 |
| 한국 공급망 | `page-kr-supply` | 10663 |
| 한국 테마 | `page-kr-themes` | 10895 |
| 한국 거시 | `page-kr-macro` | 10992 |
| 한국 기술 | `page-kr-technical` | 11321 |
| 사용 설명서 | `page-guide` | 11568 |

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
| Page Focus Brief UX + Compact Simplification + Static Governance + Auto Freshness Planner | 1660 ~ 2417 | 페이지별 목적/3단계 루틴/관련 페이지 동선, 핵심 보기 토글, 상세/참고/아카이브 접기, `AIO.getPageUXAudit()`, `AIO.getStaticDataGovernanceAudit()`, `AIO.getAutoOpsReadiness()`, `AIO.getAutoFreshnessPlan()` |
| Institutional technical engine | 4140 ~ 4851 | OHLCV snapshot, sell pressure, semiconductor heat, lockout/OPEX, exit plan |
| `AIO_EVENT_RISK_CONTEXT` / `calcBlowoffTopChecklist` | 4507 / 4547 | CPI-confirmed event risk + blow-off top checklist |
| `APP_VERSION` | 4862 | R1 버전 단일 소스 |
| `AIO.getLiveCoverage` / `getDataFreshnessAudit` | 5300 / 5332 | core live quote coverage + freshness audit |
| `AIO.getDataPipelineAudit` | 5418 | source/API → transport/cache → scheduler → store → analysis → render audit |
| `AIO.getOperationalHealth` | 5587 | 운영/SW/API/cache/data freshness/data pipeline 자체 진단 |
| `DATA_SNAPSHOT` | 5767 | 시장 데이터 SSOT (`window.DATA_SNAPSHOT` exposed below block) |
| `applyDataSnapshot` | 6677 | snapshot → DOM, 키별 오류 격리 |
| `_ldSafe` | 7063 | liveData + snapshot fallback |
| `destroyPageCharts` | 7137 | 페이지 이탈 차트 정리 |
| `showPage` | 7584 | SPA 페이지 전환 |
| `_calcPortfolioVaR` | 7899 | 보수적 historical VaR |

### `js/aio-data.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `DATA_APIS` | 1593 | API registry |
| `fetchOHLCV` | 1944 | v48.78 deep technical OHLCV |
| `fetchOHLCVWithFallback` | 2008 | Twelve Data → Yahoo chart fallback OHLCV normalizer |
| `fetchFinnhubEarningsCalendar` | 2746 | 어닝 일정 |
| `REFRESH_SCHEDULE` | 2988 | 자동 갱신 스케줄 |
| `_runScheduledTask` / `ensureFreshDataForUse` | 3023 / 3258 | task promise timeout + page/chat selective freshness preflight |
| `AIO.getRefreshSchedulerAudit` / `runScheduledRefresh` | 3169 / 3212 | 자동 갱신 스케줄러 진단 + 수동 강제 갱신 |
| `AIO_NEWS_SOURCES` | 3572 | RSS/뉴스 소스 |
| `MACRO_KW` | 3716 | 매크로 키워드 |
| `TECH_KW` | 4071 | 기술/AI 키워드 |
| `KNOWN_TICKERS` | 4738 | 티커 Set |
| `scoreItem` | 5531 | 뉴스 중요도 점수 + LRU 캐시 |
| `classifyTopic` | 5890 | 뉴스 토픽 분류 |
| `renderFeed` | 6838 | 시장 뉴스 렌더 |
| `_aioGetCurrentHomeWeeklyNews` | 7037 | HOME 고정 뉴스 72시간 freshness filter |
| `renderHomeFeed` | 7049 | 홈 뉴스 렌더 |
| `renderBriefingFeed` | 7167 | 브리핑 뉴스 렌더 |
| `fetchOneFeed` | 7730 | 단일 피드 fetch |
| `fetchAllNews` | 8062 | 뉴스 전체 수집 |
| `fetchLiveQuotes` | 8978 | live quote pipeline + core coverage guard |
| `vixToPercentile` | 9795 | VIX percentile 로그 외삽 |
| `applyLiveQuotes` | 10256 | live quote store + DOM render sink |
| `toggleSignalMode` | 10921 | signal UI mode state |

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
| `_fetchDeepCompareData` | 1919 | 심층 기업 비교 데이터 |
| chat intent/memory/data coverage governance | 2406 ~ 2483 | 의도 분류, 최근 대화 중복 방지 메모, 데이터 커버리지 라벨, 단일 종목 심층 트리거 |
| AI freshness preflight | 2839 ~ 2846 | `AIO.ensureFreshDataForUse()` bounded preflight before ticker/deep/news prompt assembly |
| `_googleSearch` | 2673 | Google CSE fallback |
| `chatSend` | 2798 | 컨텍스트별 AI 전송 |
| `_fmtNum` | 3347 | NaN/Infinity → `—` 표시 방어 |
| `fundamentalSearch` | 3462 | 기업 분석 수집/렌더 |
| `_renderFundHeader` | 3710 | 기업 분석 헤더 |
| `_renderFundFinancials` | 3839 | 재무/애널리스트/SEC Frames, Infinity guard |
| `_renderFundEarnings` | 4225 | 어닝 일정/서프라이즈 |
| `_renderFundNews` | 4281 | Finnhub 기업 뉴스 |

---

## 4. 빠른 작업 참조

| 작업 | 우선 파일/범위 |
|------|----------------|
| R1 버전 동기화 | `index.html:10`, `index.html:3961`, `js/aio-core.js:4688`, `version.json`, `sw.js:8`, `_context/CLAUDE.md`, `CHANGELOG.md` |
| 페이지 핵심화/간소화 | `index.html:780~915`, `js/aio-core.js:1660~1932` |
| DATA_SNAPSHOT 갱신 | `js/aio-core.js:5593~5806`, `js/aio-core.js:5159~5414` freshness/pipeline audit, `js/aio-ui.js` chart arrays |
| 뉴스 소스/키워드/Telegram audit | `js/aio-data.js:3429~3557`, `js/aio-data.js:7519~7540` |
| 뉴스 선별/렌더 | `js/aio-data.js:5174~6781` |
| 뉴스 수집 안정성 | `js/aio-data.js:7324~8080` |
| 페이지 전환/init 가드 | `js/aio-core.js:5418~5936`, 각 page init 함수 |
| sentiment/breadth 차트 | `js/aio-ui.js:1~1050` |
| LLM 모델/쿼터 | `js/aio-ui.js:1293~1585` |
| Claude 채팅/웹검색/중복 방지 | `js/aio-chat.js:1~3470`, `index.html:29586~29967` |
| 기업 분석 UI | `index.html:8086~8335`, `js/aio-chat.js:3471~4697` |
| 포트폴리오 DOM | `index.html:8467~8838` |
| 포트폴리오 benchmark chart | `index.html:28663~28827` |
| 옵션 분석 DOM | `index.html:9267~10082` |
| 한국 페이지 DOM | `index.html:10083~11328` |
| browser unit tests | `js/aio-tests.js:1~1322`, `index.html:26995` |
| glossary | `js/aio-glossary.js`, `index.html:26670~29260` |

---

## 5. 검증 메모

- v49.8은 실제 사이트 최신성 감사 기준으로 HOME 핵심 뉴스 stale-event filter, 2026-05-13 fallback snapshot, T141~T142 재발 방지 테스트를 추가한 기준.
- v49.7은 페이지별 Page Focus Brief로 초보자용 3단계 루틴과 관련 페이지 동선을 표준화한 기준.
- v49.6은 v49.5 Lockout Rally/OPEX 엔진 위에 2026-05-12 WebSearch/public-source 기준 정적 fallback seed를 최신화한 기준.
- v49.5는 v49.4 데이터 최신성 거버넌스 위에 Lockout Rally/OPEX 전략 엔진, terminal candle, breadth rotation, action ladder UI/tests를 추가한 기준.
- v49.4는 v49.3 아키텍처 보강 위에 freshness policy, SnapshotStore, scheduler telemetry, auditAllFreshness, WebSearch fallback refresh를 추가한 기준.
- HTML inline `onclick=` attribute는 0건. JS property assignment `.onclick =`는 modal/prompt overlay 내부에서 4건 존재.
- `.claude/commands`와 `.claude/hooks`는 GitHub-tracked checkout에는 없음. Claude 로컬 운영 워크트리에만 존재할 수 있으므로 배포 검증과 운영 검증을 구분한다.
- 큰 구조 변경 뒤에는 이 파일의 line 번호를 반드시 재스캔한다.
