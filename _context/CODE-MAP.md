---
verified_by: agent
last_verified: 2026-06-04
confidence: high
target_version: v50.5
target_file: index.html + js/*.js
target_lines: index.html 31056 + js modules ~49556
---

# AIO v50.5 CODE-MAP

> 목적: 현재 모듈화된 AIO 코드를 전체 재읽기 없이 부분 탐색하기 위한 line 범위 맵.
> 원칙: 작업 전 이 파일에서 담당 파일과 범위를 찾고, 실제 수정 전 `Select-String`/부분 Read로 한 번 더 확인한다.

---

## 1. 현재 파일 구조

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `index.html` | 31,056 | HTML shell, CSS, compact Page Focus Brief styles, explain summary styles, 21개 페이지 DOM, Institutional Technical Brief + Lockout/OPEX/Blow-off Top Control DOM, portfolio technical risk runtime, theme/trend no-static-current rendering, unified AI panel runtime, AI freshness preflight hook, 10-page stale live-like default cleanup, 일부 inline runtime, 외부 모듈 로드 |
| `js/aio-core.js` | 20,125 | 버전, 전역 상태, DATA_SNAPSHOT, 캐시, Page Focus Brief UX, static data governance/auto-ops readiness, freshness planner, critical-10 freshness audit, technical snapshot/sell pressure engine, Lockout/OPEX/Blow-off Top strategy engine, **v50.x evidence-first 레이어**: `AIO_PAGE_CONTRACTS`(21페이지 단일 계약)·`EvidenceStore`·`SourceAdapterRegistry`·`FormulaRegistry`·`AIO_TEXT_SURFACE_CONTRACTS`·DataTruthGate·cross-source 검증·trading decision evidence gate·`runEvidenceDeploymentGate`, data pipeline audit, 페이지 라우터 |
| `js/aio-data.js` | 13,721 | API fetcher, OHLCV + Yahoo fallback + quality bundle, OPEX/put-call/lockout bundle fetchers, live coverage guard, 뉴스 소스/스코어링/impact vector/렌더, HOME stale-event filter, Telegram/Aether pipeline audit, 키워드, 캘린더, 데이터 스케줄 + scheduler telemetry + force refresh + `ensureFreshDataForUse`, `recordCrossSourceQuote` 기록, requested-symbol quote batch refresh |
| `js/aio-ui.js` | 3,050 | 심리/시장폭 차트, Institutional Technical Brief + Lockout/OPEX/Blow-off Top renderers, data-quality/news-impact/portfolio-risk renderers, LLM quota UI, GitHub polling, feedback UI |
| `js/aio-chat.js` | 7,041 | CHAT_CONTEXTS, intent/memory/data-coverage prompt governance, AI freshness preflight hook, EvidenceStore 컨텍스트 주입 + 답변 후 numeric/date evidence 감사, Lockout/OPEX/Blow-off Top technical prompt, Claude/Perplexity, 기업 분석, fundamentalSearch |
| `js/aio-tests.js` | 5,315 | 브라우저 단위 테스트 T1~T762 (총 843 `_assert`), `AIO.runTests()` / `AIO.getTestResults()` |
| `js/aio-glossary.js` | 304 | 용어사전 검색/렌더 |

---

## 2. index.html 구조

| 범위 | 내용 |
|------|------|
| 1 ~ 38 | head meta, title, preload (aio-core/data/ui/chat preload at 29~32) |
| 39 ~ 3693 | 메인 CSS |
| 3694 ~ 12581 | body shell + 21개 page DOM (8504~8507 인라인 `<style>` 포함) |
| 12582 ~ 12584 | `aio-core/data/ui` 로드 (`?v=50.4`) |
| 12585 ~ 15653 | inline runtime block 1 |
| 15654 | `js/aio-chat.js` 로드 |
| 15655 ~ 28004 | inline runtime block 2 |
| 28005 | `js/aio-glossary.js` 로드 |
| 28007 | `js/aio-tests.js` 로드 |
| 28008 ~ 31056 | glossary/service worker/deep analysis/unified AI panel/update helpers + 후미 `<style>`(30429~30458) + closing HTML |

### 21개 페이지 DOM 시작점

| 페이지 | id | 시작 line |
|--------|----|----------:|
| 홈 대시보드 | `page-home` | 4122 |
| 매매 시그널 | `page-signal` | 4583 |
| 시장 폭 | `page-breadth` | 5434 |
| 투자 심리 | `page-sentiment` | 5830 |
| 데일리 브리핑 | `page-briefing` | 6113 |
| 차트·기술 | `page-technical` | 6412 |
| 거시경제 | `page-macro` | 6894 |
| 환율·채권 | `page-fxbond` | 7499 |
| 기업 분석 | `page-fundamental` | 8264 |
| 테마/섹터 | `page-themes` | 8616 |
| 테마 상세 | `page-theme-detail` | 8880 |
| 포트폴리오 | `page-portfolio` | 8987 |
| 티커 상세 | `page-ticker` | 9402 |
| 시장 뉴스 | `page-market-news` | 9689 |
| 옵션 분석 | `page-options` | 9830 |
| 한국 홈 | `page-kr-home` | 10598 |
| 한국 공급망 | `page-kr-supply` | 10939 |
| 한국 테마 | `page-kr-themes` | 11170 |
| 한국 거시 | `page-kr-macro` | 11267 |
| 한국 기술 | `page-kr-technical` | 11596 |
| 사용 설명서 | `page-guide` | 11843 |

---

## 3. 핵심 상수/함수 위치

### `js/aio-core.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `_aioMarkChartCanvases` | 306 | LightweightCharts 내부 canvas `aria-hidden` 처리 |
| `_aioRegisterTimer` | 442 | 타이머 레지스트리, 중복 등록 정리 |
| `_aioPageBus` | 474 | 페이지 이벤트 라우팅 허브 |
| `_aioOnce` / `_aioGlobalRegistry` | 740 / 754 | 멱등 초기화와 전역 상태 이전 레지스트리 |
| `_aioFiniteNum` / `_aioSafeDiv` | 779 / 785 | NaN/Infinity/분모 0 통합 방어 |
| `_aioLRU` | 797 | score/ticker regex 등 용량 제한 캐시 |
| `getPageUXAudit` | 2617 | Page Focus Brief UX 감사 |
| `getStaticDataGovernanceAudit` | 9413 | 정적 데이터 거버넌스 감사 |
| `getAutoOpsReadiness` | 9889 | 운영 준비도 통합(evidence matrix/news/truth 포함) |
| `getAutoFreshnessPlan` | 10772 | 페이지별 자동 freshness 계획 |
| `chartDataGate` | 11066 | 차트 NaN/null 방어 |
| `safeLS` / `safeLSGet` / `safeLSGetSync` | 11501 / 11514 / 11527 | 암호화 localStorage |
| `calcTechnicalSnapshot` / `calcSellPressure` | 13954 / 14206 | OHLCV 스냅샷, 매도압력 엔진 |
| `calcDataQuality` / `calcAIInfraHeat` / `calcPositionTechnicalRisk` | 14332 / 14385 / 14415 | 데이터품질·AI인프라열·포지션리스크 |
| `AIO_EVENT_RISK_CONTEXT` / `calcBlowoffTopChecklist` | 14129 / 14169 | event risk + blow-off top checklist |
| `APP_VERSION` | 14484 | R1 버전 단일 소스 (`v50.4`) |
| `getLiveCoverage` / `getDataFreshnessAudit` | 14922 / 14957 | core live quote coverage + freshness audit |
| `getDataPipelineAudit` | 15043 | source→transport→scheduler→store→analysis→render audit |
| `getOperationalHealth` | 15212 | 운영/SW/API/cache/freshness/pipeline 자체 진단 |
| `applyDataSnapshot` | 16332 | snapshot → DOM, 키별 오류 격리 |
| `_ldSafe` | 16778 | liveData + snapshot fallback |
| `destroyPageCharts` | 19220 | 페이지 이탈 차트 정리 |
| `showPage` | 19667 | SPA 페이지 전환 |
| `_calcPortfolioVaR` | 20000 | 보수적 historical VaR |
| **DATA_SNAPSHOT** | (window.DATA_SNAPSHOT) | 시장 데이터 SSOT — `grep "DATA_SNAPSHOT ="`로 확인 |

#### v50.x evidence-first 레이어 (`js/aio-core.js`)

| 항목 | line | 비고 |
|------|-----:|------|
| `recordCrossSourceQuote` | 16980 | source-family별 시세 기록(R196) |
| `getCrossSourceQuoteValidation` | 17018 | 교차 소스 불일치 검증 |
| `getDataTruthAudit` | 17242 | DataTruthGate 감사(R195) |
| `getMarketSituationReferenceSnapshot` | 17608 | 현재 시장 레짐 기준 스냅샷 |
| `collectCritical10MarketContentInventory` | 17633 | critical-10 가시 콘텐츠 전수 인벤토리 |
| `getCritical10ContentEvidenceMatrix` | 17839 / 18757 | 전 콘텐츠 pass/warn/block/needs_evidence(R199) |
| `_buildContracts` / `AIO_PAGE_CONTRACTS` | 18070 / 18092 | 21페이지 단일 계약(R v50.0) |
| `applyPageContractCompatibility` | 18105 | 계약→호환 맵 파생 |
| `AIO_SOURCE_ADAPTER_REGISTRY` / `getSourceAdapterRegistry` | 18191 / 18219 | 소스 어댑터 레지스트리 |
| `AIO_TEXT_SURFACE_CONTRACTS` / `applyTextSurfaceHygiene` / `getTextSurfaceAudit` | 18258 / 18377 / 18407 | 텍스트 표면 계약(R204) |
| `buildEvidenceStore` | 18528 | evidenceId 분류 스토어(R v50.0) |
| `getAllPageContentEvidenceMatrix` | 18741 | 21페이지 전체 증거 매트릭스 |
| `getTradingDecisionInputEvidence` / `getTradingDecisionLogicAudit` | 18841 / 18863 | 트레이딩 결정 증거 게이트(R201) |
| `runEvidenceDeploymentGate` | 18998 | **배포 게이트 — 7개 감사 통합 strict/warn 산출** |

> news surface 계약(`AIO_NEWS_SURFACE_CONTRACTS` / `buildNewsSurfaceModel` / `getNewsSurfaceAudit`)은 `js/aio-data.js`에 위치(아래 표).

### `js/aio-data.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `DATA_APIS` | 1609 | API registry |
| `fetchOHLCV` | 1964 | deep technical OHLCV |
| `fetchOHLCVWithFallback` | 2038 | Twelve Data → Yahoo chart fallback OHLCV normalizer |
| `fetchAllFredData` | 2389 | FRED 시계열 |
| `fetchBreadthData` | 2899 | breadth 근사(AV movers + RSP/SPY 비율). **MMFI/MMTW/MMFD %aboveMA는 선언만·실 fetch 미구현 — B계층 갭** |
| `fetchFinnhubEarningsCalendar` | 2810 | 어닝 일정 |
| `REFRESH_SCHEDULE` | 3052 | 자동 갱신 스케줄 |
| `_runScheduledTask` | 3131 | task promise timeout |
| `getRefreshSchedulerAudit` / `runScheduledRefresh` | 3477 / 3776 | 스케줄러 진단 + 수동 강제 갱신 |
| `ensureFreshDataForUse` | 3922 | page/chat selective freshness preflight |
| `AIO_NEWS_SOURCES` | 4400 | RSS/뉴스 소스 |
| `MACRO_KW` | 4545 | 매크로 키워드 |
| `TECH_KW` | 4920 | 기술/AI 키워드 |
| `KNOWN_TICKERS` | 5610 | 티커 Set |
| `scoreItem` | 6406 | 뉴스 중요도 점수 + LRU 캐시 |
| `classifyTopic` | 6765 | 뉴스 토픽 분류 |
| `AIO_NEWS_SURFACE_CONTRACTS` | 7645 | home/briefing/market-news 단일 계약(R203) |
| `buildNewsSurfaceModel` / `getNewsSurfaceAudit` | 7798 / 7893 | 뉴스 표면 모델/감사 |
| `renderFeed` | 8002 | 시장 뉴스 렌더 |
| `_aioGetCurrentHomeWeeklyNews` | 8220 | HOME 고정 뉴스 freshness filter |
| `renderHomeFeed` / `renderBriefingFeed` | 8232 / 8389 | 홈/브리핑 뉴스 렌더 |
| `fetchOneFeed` | 9017 | 단일 피드 fetch |
| `fetchAllNews` | 9349 | 뉴스 전체 수집 |
| `fetchLiveQuotes` | 10305 | live quote pipeline + core coverage guard + cross-source 기록 |
| `vixToPercentile` | 11379 | VIX percentile 로그 외삽 |
| `applyLiveQuotes` | 12102 | live quote store + DOM render sink |
| `toggleSignalMode` | 12880 | signal UI mode state |

### `js/aio-ui.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `_refreshSentimentChartData` | 14 | VIX/HYG 동적 차트 |
| `_SENT_COMMON` | 59 | sentiment chart data |
| `_initSentVixChart` | 164 | VIX chart |
| `_initSentNaaimChart` | 242 | NAAIM chart |
| `_initSentIIChart` | 321 | Investors Intelligence |
| `_initSentHYChart` | 382 | HY OAS chart |
| `initSentimentPage` | 443 | sentiment init |
| `initBreadthPage` | 777 | breadth init |
| `LLM_MODELS` | 1439 | Claude 모델 설정 |
| `LLM_BUDGET` | 1590 | 예산/쿼터 |
| `updateQuotaBadge` | 1667 | LLM UI 동기화 |
| `ghPollOnce` | 1863 | GitHub version polling |
| `globalRefresh` | 2163 | 전체 새로고침 |
| Institutional Technical Brief renderers | 2582 ~ 2761+ | 4-chart report, key levels, `renderSellPressurePanel`(2751), `renderExitPlanPanel`(2761), data quality/news impact/portfolio risk renderers |

### `js/aio-chat.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `CHAT_CONTEXTS` | 8 | AI persona/context |
| `_fetchDeepCompareData` | 2594 | 심층 기업 비교 데이터 |
| `_classifyChatIntent` | 3081 | 의도 분류(governance) |
| `_googleSearch` | 3441 | Google CSE fallback |
| `chatSend` | 4368 | 컨텍스트별 AI 전송 |
| AI freshness preflight + EvidenceStore rule | 4485 ~ 4602 | `ensureFreshDataForUse()` preflight + EvidenceStore-only 인용 강제 |
| `_fmtNum` | 5386 | NaN/Infinity → `—` 표시 방어 |
| `fundamentalSearch` | 5509 | 기업 분석 수집/렌더 |
| `_renderFundHeader` | 5785 | 기업 분석 헤더 |
| `_renderFundFinancials` | 5914 | 재무/애널리스트/SEC Frames, Infinity guard |
| `_renderFundEarnings` | 6577 | 어닝 일정/서프라이즈 |
| `_renderFundNews` | 6633 | Finnhub 기업 뉴스 |

---

## 4. 빠른 작업 참조

| 작업 | 우선 파일/범위 |
|------|----------------|
| R1 버전 동기화 | `index.html:10`(title), `index.html:4135`(badge), `js/aio-core.js:14484`(APP_VERSION), `version.json`, `sw.js:8`(SW_VERSION), `_context/CLAUDE.md`, `CHANGELOG.md` + `index.html:12582~12584`·`15654`·`28005`·`28007` 캐시버스터 `?v=` |
| 배포 게이트/evidence 감사 | `js/aio-core.js:18070~19060` (contracts→evidence→trading→deployment gate) |
| 데이터 진실성/교차소스 | `js/aio-core.js:16980~17500` |
| 텍스트/뉴스 표면 계약 | `js/aio-core.js:18258~18420`(텍스트), `js/aio-data.js:7645~7990`(뉴스) |
| DATA_SNAPSHOT 갱신 | `js/aio-core.js` `grep "DATA_SNAPSHOT ="`, freshness/pipeline audit 14922~15295, `js/aio-ui.js` chart arrays |
| 뉴스 선별/렌더 | `js/aio-data.js:6406~8500` |
| 뉴스 수집 안정성 | `js/aio-data.js:9017~9400` |
| 페이지 전환/init 가드 | `js/aio-core.js:19220~19800`(destroyPageCharts/showPage), 각 page init 함수 |
| sentiment/breadth 차트 | `js/aio-ui.js:14~900` |
| LLM 모델/쿼터 | `js/aio-ui.js:1439~1700` |
| Claude 채팅/웹검색/preflight | `js/aio-chat.js:3081~4602` |
| 기업 분석 UI | `index.html:8264~8615`, `js/aio-chat.js:5509~7041` |
| 포트폴리오 DOM | `index.html:8987~9401` |
| 옵션 분석 DOM | `index.html:9830~10597` |
| 한국 페이지 DOM | `index.html:10598~11842` |
| browser unit tests | `js/aio-tests.js`, `index.html:28007` |
| glossary | `js/aio-glossary.js`, `index.html:28005` |

---

## 5. 검증 메모

- **v50.4 재스캔 (2026-06-04)**: v48.13→v50.4 Codex evidence-first 통합 후 전 파일 line 재측정. aio-core.js 8,140→20,125(+147%), aio-tests.js 1,369→5,315(T1~T762, 843 `_assert`). 이전 CODE-MAP는 v49.21 기준이라 5+ 버전 stale 상태였음 → 본 갱신으로 R(리팩토링 ±500줄 → 재스캔) 준수 복원.
- **v50.x 핵심 축**: v49.108(DataTruthGate)→109(cross-source)→110~112(critical-10 surface/situation/matrix)→50.0(EvidenceStore+21페이지 계약)→50.1(trading gate)→50.2(news surface)→50.3(text surface)→50.4(정적 캘린더 분리). 모두 데이터 *신뢰성/증거 라벨링* 레이어. 배포 게이트는 `AIO.runEvidenceDeploymentGate({strict})` 단일 진입점.
- **알려진 데이터 획득 갭(미해결)**: B계층 breadth %aboveMA(`fetchBreadthData` MMFI/MMTW/MMFD 선언만, 실 fetch 미구현 — RSP/SPY 비율 프록시만 사용). C계층 CPI/PCE/NFP/AAII/NAAIM/SKEW/MOVE는 fetch 함수 0건·수동 갱신. evidence 레이어가 이들을 `reference-only`/`needs_evidence`로 정직하게 강등하나 취득은 안 함.
- HTML inline `onclick=` attribute는 0건. JS property assignment `.onclick =`는 modal/prompt overlay 내부에 소수 존재.
- `.claude/commands`와 `.claude/hooks`는 GitHub-tracked checkout에는 없음. Claude 로컬 운영 워크트리에만 존재할 수 있으므로 배포 검증과 운영 검증을 구분한다.
- 큰 구조 변경 뒤에는 이 파일의 line 번호를 반드시 재스캔한다.
