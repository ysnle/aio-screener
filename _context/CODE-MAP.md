---
verified_by: agent (Sonnet 5, grep 실측 — Fable 5 v51.90 진단 Phase 0 A6b 후속)
last_verified: 2026-07-02
confidence: high
target_version: v51.90
target_file: index.html + js/*.js
target_lines: index.html 32065 + js modules 60777
---

# AIO v51.90 CODE-MAP

> 목적: 현재 모듈화된 AIO 코드를 전체 재읽기 없이 부분 탐색하기 위한 line 범위 맵.
> 원칙: 작업 전 이 파일에서 담당 파일과 범위를 찾고, 실제 수정 전 `grep -n`/부분 Read로 한 번 더 확인한다.
> 2026-07-02: v50.60(2026-06-16) 이후 60버전 미재스캔 상태였음 — 전면 재측정. 이전 버전의 line 번호는
> 신뢰하지 말 것(예: page-home이 4044→5227로 이동, CSS가 3693→4888줄로 성장).

---

## 1. 현재 파일 구조

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `index.html` | 31,795 | HTML shell, CSS, 22개 route page DOM, inline runtime(8블록), 외부 모듈 로드. v51.98: 매매 알고리즘 4함수 aio-core.js로 이관(-273줄, Phase 3 A3) |
| `js/aio-core.js` | 24,117 | 버전, 상태/감사/계약/증거 레이어, DATA_SNAPSHOT, 페이지 라우터, **매매 알고리즘 핵심(v51.98 이관, §3)**. `AIO_PAGE_CONTRACTS`는 22개 route 계약 |
| `js/aio-data.js` | 17,535 | API/서버 데이터, quote·previous-close 파이프라인, 뉴스, 스케줄러, 스크리너 |
| `js/aio-ui.js` | 5,239 | 차트/렌더러, sentiment/breadth init, LLM quota UI, 기업분석 렌더러 |
| `js/aio-chat.js` | 6,877 | CHAT_CONTEXTS, 데이터 preflight/evidence, Claude/Perplexity, 추천 분산 후보, 의도별 답변 정책, AIO 통합 답변 파이프라인 |
| `js/aio-tests.js` | 6,982 | 브라우저 회귀 테스트 T1~T845+, `AIO.runTests()` / `AIO.getTestResults()`. **CI 미실행 — 브라우저 콘솔 수동 전용**(§5 참고) |
| `js/aio-glossary.js` | 314 | 용어사전 검색/렌더 |

---

## 2. index.html 구조

| 범위 | 내용 |
|------|------|
| 1 ~ 38 | head meta, title, preload (aio-core/data/ui/chat preload at 29~32) |
| 39 ~ 4888 | 메인 CSS (`<style>`~`</style>`) |
| 4890 ~ 12461 | body shell + 22개 route page DOM 시작 |
| 8998 ~ 9001 | 페이지 내 보조 `<style>` 블록(1건, screener 근방) |
| 12461 ~ 12468 | `aio-core/data/ui` 로드 (`?v=52.0`, **v52.0/Phase3[A2] 2단계: defer 적용됨** — 이제 8개 인라인 블록 전부보다 나중에 실행) |
| 12470 ~ 12812 | inline 블록 1 |
| 12814 ~ 15954 | inline 블록 2 |
| 15955 | `js/aio-chat.js` 로드 (`?v=52.0`, **defer 적용됨**) |
| 15957 ~ 18401 | inline 블록 3 |
| 18403 ~ 22742 | inline 블록 4 |
| 22744 ~ 28119 | inline 블록 5 — **v51.98: computeTradingScore 등 핵심 매매 알고리즘이 여기 있었으나 Phase 3 A3로 `js/aio-core.js`(§3)로 이관됨. 이 블록은 이제 그 알고리즘을 소비만 함(호출부·UI 렌더)** |
| 28121 ~ 28327 | inline 블록 6 |
| 28330 | `js/aio-glossary.js` 로드 (`?v=52.0`, **defer 적용됨**) |
| 28333 ~ 31141 | inline 블록 7 (SW 등록 대역 포함) |
| 31143 ~ 31172 | 보조 `<style>` 블록(2건째) |
| 31177 ~ 31853 | inline 블록 8 + closing HTML |

> **v50.60 대비 변화**: 구 CODE-MAP은 inline runtime을 "블록 1/블록 2" 2개로 단순화했으나 실측하면 **8개 분리 블록**이다
> (스크립트 태그 사이사이 재개). CSS도 3693→4888줄(+1195)로 성장했었고, v51.98에서 블록 5가 -273줄(A3 이관)로
> 축소됐다. **v52.0/Phase3[A2] 완료**: 5개 스크립트(core/data/ui/chat/glossary) 전부 `defer` 적용 —
> §4 진단(FABLE A2)의 "동기 로딩이 HTML 파서를 막는다" 문제 해소. 인라인 블록의 최상위 모듈 심볼
> 참조 22곳은 A2 1단계(P595/R275)에서 DOMContentLoaded 래핑/CHAT_CONTEXTS 병합으로 이미 방어됨.
> 실측: DOMContentLoaded 체감차 거의 없음(이미 `<head>` preload로 다운로드 병렬화돼 있었음, ~350ms
> 동일) vs `load` 이벤트 평균 41% 단축(워밍업 제외 4회 평균 ~14.4s→~8.5s, 로컬 오프라인 측정).
> 정확한 재탐색은 `grep -n "<script"` 우선 실행 권장.

### 22개 route 페이지 DOM 시작점

| 페이지 | id | 시작 line |
|--------|----|----------:|
| 홈 대시보드 | `page-home` | 5227 |
| 매매 시그널 | `page-signal` | 5457 |
| 시장 폭 | `page-breadth` | 6239 |
| 투자 심리 | `page-sentiment` | 6562 |
| 데일리 브리핑 | `page-briefing` | 6773 |
| 차트·기술 | `page-technical` | 7039 |
| 거시경제 | `page-macro` | 7472 |
| 환율·채권 | `page-fxbond` | 8062 |
| 기업 분석 | `page-fundamental` | 8816 |
| 테마/섹터 | `page-themes` | 9118 |
| 테마 상세 | `page-theme-detail` | 9356 |
| 포트폴리오 | `page-portfolio` | 9476 |
| 티커 상세 | `page-ticker` | 9931 |
| 시장 뉴스 | `page-market-news` | 10186 |
| 옵션 분석(폐기 안내 shell) | `page-options` | 10333 |
| 퀀트 스크리너 | `page-screener` | 10343 |
| 한국 홈 | `page-kr-home` | 10526 |
| 한국 수급 | `page-kr-supply` | 10851 |
| 한국 테마 | `page-kr-themes` | 11068 |
| 한국 거시 | `page-kr-macro` | 11139 |
| 한국 기술 | `page-kr-technical` | 11471 |
| 사용 설명서 | `page-guide` | 11699 |

---

## 3. 핵심 상수/함수 위치

### `js/aio-core.js` — 매매 알고리즘 핵심 (v51.98 Phase 3 A3로 index.html 인라인에서 이관됨)

> **2026-07-02 진단 A3 해소(v51.98)**: 이 앱의 중심 알고리즘이 모듈이 아닌 index.html 인라인에 있어
> `js/*.js` 쪽 5곳이 `typeof computeTradingScore === 'function'` 방어 호출로 역참조하던 구조적 역전을
> 정리 — 4개 함수를 `_ldSafe`(이미 이 파일에 있던 주 의존성) 바로 뒤로 이관했다. 기존 `typeof` 방어
> 호출(aio-core.js/aio-data.js/aio-ui.js)은 전역 함수명이라 그대로 유효(오히려 aio-core.js가 제일
> 먼저 로드되므로 더 일찍 true가 됨). 순수 재배치 + 확정 죽은 코드 1건 삭제(computeTradingScore의
> HY스프레드 4순위 DOM 텍스트 파싱 폴백, A5 발견) — 알고리즘 로직/가중치 자체는 무변경. 이관 전/후
> 스냅샷 diff(다양한 mode 인자)로 동작 불변성 실측 확인. `_context/BUG-POSTMORTEM.md` P594,
> `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §7 Phase 3 A3 참조.

| 항목 | line | 비고 |
|------|-----:|------|
| `computeTradingScore` | 20068 | 매매점수(5서브스코어+7보정, 캐시 TTL 20s). 검증 하네스 없음(진단 C3, Phase 3 미착수) |
| `getScoreAdvice` | 20236 | 점수→행동 문구 매핑 |
| `computeExecutionWindow` | 20245 | 실행 타이밍 점수(breakout/pullback/followthru/leader) |
| `classifyMarketRegime` | 20307 | 시장 레짐 분류(UPTREND/DOWNTREND/CHOP) |
| `_aioMarkChartCanvases` | 313 | LightweightCharts 내부 canvas `aria-hidden` 처리 |
| `_aioRegisterTimer` | 449 | 타이머 레지스트리, 중복 등록 정리 |
| `_aioPageBus` | 481 | 페이지 이벤트 라우팅 허브 |
| `_aioOnce` / `_aioGlobalRegistry` | 756 / 770 | 멱등 초기화와 전역 상태 이전 레지스트리 |
| `_aioFiniteNum` / `_aioSafeDiv` | 795 / 801 | NaN/Infinity/분모 0 통합 방어 |
| `_aioLRU` | 813 | score/ticker regex 등 용량 제한 캐시 |
| `getPageUXAudit` | 4836 | Page Focus Brief UX 감사 |
| `getStaticDataGovernanceAudit` | 11889 | 정적 데이터 거버넌스 감사 |
| `getAutoOpsReadiness` | 12467 | 운영 준비도 통합(evidence matrix/news/truth 포함) |
| `getAutoFreshnessPlan` | 13501 | 페이지별 자동 freshness 계획 |
| `chartDataGate` | 13789 | 차트 NaN/null 방어 |
| `safeLS` / `safeLSGet` / `safeLSGetSync` | 14224 / 14237 / 14250 | 암호화 localStorage |
| `calcTechnicalSnapshot` | 16987 | OHLCV 스냅샷 엔진 |
| `_calcRSILast`(Wilder) / `_calcRSISeries` / `_calcRSIDivergence` | 16586 / 16798 / 16822 | **Wilder식 RSI** — 서버 `_rsi14`(Cutler식, fetch-data.mjs:625)와 공식 상이(진단 C1, 미해결) |
| `_calcVCP` | 16716 | 클라이언트 VCP — 서버 `_calcVCPServer`(fetch-data.mjs:847)와 병렬 구현 |
| `AIO_EVENT_RISK_CONTEXT` / `calcBlowoffTopChecklist` | 17193 / 17350 | event risk + blow-off top checklist |
| `calcSellPressure` / `calcDataQuality` / `calcAIInfraHeat` / `calcPositionTechnicalRisk` | 17387 / 17513 / 17566 / 17596 | 매도압력·데이터품질·AI인프라열·포지션리스크 |
| `APP_VERSION` | 17670 | R1 버전 단일 소스 (`v51.90`) |
| `getDataPipelineAudit` | 18237 | source→transport→scheduler→store→analysis→render audit |
| `getOperationalHealth` | 18440 | 운영/SW/API/cache/freshness/pipeline 자체 진단 |
| **DATA_SNAPSHOT** | 18620 ~ 18898 | 시장 데이터 SSOT 리터럴. `/data-refresh` 수동 카테고리(ISM·AAII·KR 지표 등)의 저장소이기도 함 |
| `applyDataSnapshot` | 19600 | snapshot → DOM, 키별 오류 격리 |
| `_ldSafe` | 20047 | liveData + snapshot fallback |
| `getLiveCoverage` | 18108 | core live quote coverage |
| `destroyPageCharts` | 22841 | 페이지 이탈 차트 정리 |
| `showPage` | 23313 | SPA 페이지 전환 |
| `_calcPortfolioVaR` | 23704 | 보수적 historical VaR |

#### evidence-first 레이어 (`js/aio-core.js`, 21387~22687대 밀집)

| 항목 | line | 비고 |
|------|-----:|------|
| `recordCrossSourceQuote` | 20535 | source-family별 시세 기록(R196) |
| `getCrossSourceQuoteValidation` | 20573 | 교차 소스 불일치 검증 |
| `getDataTruthAudit` | 20798 | DataTruthGate 감사(R195) |
| `getMarketSituationReferenceSnapshot` | 21164 | 현재 시장 레짐 기준 스냅샷 |
| `collectCritical10MarketContentInventory` | 21189 | critical-10 가시 콘텐츠 전수 인벤토리 |
| ~~`getCritical10ContentEvidenceMatrix`~~ | 21398 | **`_deadV49112_getCritical10ContentEvidenceMatrix`로 개명 — v50.44 폐기, `getAllPageContentEvidenceMatrix`가 후속** |
| `_buildContracts` | 21630 | 22페이지 계약 빌더 |
| `AIO_PAGE_CONTRACTS` | 21652 | window 노출(빌더 결과 캐시) |
| `applyPageContractCompatibility` | 21665 | 계약→호환 맵 파생 |
| `AIO_SOURCE_ADAPTER_REGISTRY` | 21778 | 소스 어댑터 레지스트리 |
| `AIO_TEXT_SURFACE_CONTRACTS` | 21845 | 텍스트 표면 계약(R204) |
| `applyTextSurfaceHygiene` / `getTextSurfaceAudit` | 21982 / 22012 | 텍스트 표면 위생 적용/감사 |
| `buildEvidenceStore` | 22133 | evidenceId 분류 스토어 |
| `getAllPageContentEvidenceMatrix` | 22352 | 22페이지 전체 증거 매트릭스(현행 단일 소스) |
| `getTradingDecisionInputEvidence` | 22452 | 트레이딩 결정 증거 게이트(R201) |
| `getTradingDecisionLogicAudit` | 22474 | 트레이딩 로직 감사 |
| `runEvidenceDeploymentGate` | 22609 | **배포 게이트 — 계약 기대값 기반 strict/warn 산출** |

> news surface 계약(`AIO_NEWS_SURFACE_CONTRACTS` / `buildNewsSurfaceModel` / `getNewsSurfaceAudit`)은 `js/aio-data.js`에 위치(아래 표).

### `js/aio-data.js`

| 항목 | line | 비고 |
|------|-----:|------|
| **SCREENER_DB_META** / **SCREENER_DB** | 10 / 19 | 정적 스크리너 시드(881 심볼). 서버 `getScreenerSymbols()`가 이 파일을 정규식 파싱(진단 B6, 취약) |
| `DATA_APIS` | 2510 | API registry |
| `fetchOHLCV` | 2869 | deep technical OHLCV |
| `fetchOHLCVWithFallback` | 2943 | Twelve Data → Yahoo chart fallback OHLCV normalizer |
| `fetchFinnhubEarningsCalendar` | 3771 | 어닝 일정 |
| `fetchBreadthData` | 3860 | breadth 근사(AV movers + RSP/SPY 비율). MMFI/MMTW/MMFD %aboveMA는 선언만·실 fetch 미구현 |
| `REFRESH_SCHEDULE` | 4017 | 자동 갱신 스케줄 |
| `_runScheduledTask` | 4107 | task promise timeout |
| `getRefreshSchedulerAudit` | 4461 | 스케줄러 진단 |
| `runScheduledRefresh` | 4760 | 수동 강제 갱신 |
| `ensureFreshDataForUse` | 4906 | page/chat selective freshness preflight |
| `AIO_NEWS_SOURCES` | 6293 | RSS/뉴스 소스 |
| `MACRO_KW` | 6445 | 매크로 키워드 |
| `TECH_KW` | 6856 | 기술/AI 키워드 |
| `KNOWN_TICKERS` | 7577 | 티커 Set |
| `scoreItem` | 8404 | 뉴스 중요도 점수 + LRU 캐시 |
| `classifyTopic` | 8791 | 뉴스 토픽 분류 |
| `renderFeed` | 10594 | 시장 뉴스 렌더 |
| `AIO_NEWS_SURFACE_CONTRACTS` | 10128 | home/briefing/market-news 단일 계약(R203) |
| `buildNewsSurfaceModel` / `getNewsSurfaceAudit` | 10376 / 10475 | 뉴스 표면 모델/감사 |
| `_aioGetCurrentHomeWeeklyNews` | 10825 | HOME 고정 뉴스 freshness filter |
| `renderHomeFeed` | 10837 | 홈 뉴스 렌더 |
| `computeNewsSentimentScore` / `computeNewsRiskSignals` | 11702 / 11736 | 뉴스 감성/리스크 — js/aio-core.js의 computeTradingScore가 소비(v51.98 Phase 3 A3로 이관, §3) |
| `fetchOneFeed` | 11859 | 단일 피드 fetch |
| `fetchAllNews` | 12191 | 뉴스 전체 수집 |
| `fetchLiveQuotes` | 13212 | live quote pipeline + core coverage guard + cross-source 기록 |
| `applyLiveQuotes` | 15029 | live quote store + DOM render sink |
| `renderBriefingFeed` | 11101 | 브리핑 뉴스 렌더 |
| `vixToPercentile` | 14286 | VIX percentile 로그 외삽 |
| `toggleSignalMode` | 16184 | signal UI mode state |
| `_aioFactorWeights` | 15829 | 레짐 적응 팩터 가중(7팩터 NEUTRAL/RISK_OFF/RISK_ON lerp) |
| `_aioComputeFactorRanks` | 15905 (export: 16029) | 멀티팩터 랭킹(7팩터). 서버 `backtestFactors`(fetch-data.mjs:703, 4팩터)와 불일치(진단 C2) |
| `_aioBuildDiversifiedRecommendationRows` | 17286 | 넓은 종목 추천용 분산 후보군(R211) |
| `_aioRunScreenerQuery` | 17352 | 자연어 스크리너/추천 후보 생성 |
| `_formatScreenerResultPrompt` | 17486 | 스크리너/균형 추천 후보 프롬프트 |

> `_aioFactorWeights`/`_aioComputeFactorRanks`는 v50.60 CODE-MAP 좌표(15829/15905)를 그대로 이관했으나 이번
> 재스캔에서 정밀 재확인을 못 했다 — **작업 전 반드시 `grep -n "_aioComputeFactorRanks\s*=" js/aio-data.js`로 확정**.

### `js/aio-ui.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `_refreshSentimentChartData` | 14 | VIX/HYG 동적 차트 |
| `_SENT_COMMON` | 59 | sentiment chart data |
| `_initSentVixChart` | 184 | VIX chart |
| `_initSentNaaimChart` | 262 | NAAIM chart |
| `_initSentIIChart` | 342 | Investors Intelligence |
| `_initSentHYChart` | 403 | HY OAS chart |
| `initSentimentPage` | 464 | sentiment init |
| `initBreadthPage` | 847 | breadth init |
| `LLM_MODELS` | 1551 | Claude 모델 설정(haiku-4-5/sonnet-4-6, 2026-07 기준 유효) |
| `LLM_BUDGET` | 1702 | 예산/쿼터 |
| `updateQuotaBadge` | 1779 | LLM UI 동기화 |
| `ghPollOnce` | 1973 | GitHub version polling |
| `globalRefresh` | 2274 | 전체 새로고침 |
| `renderSellPressurePanel` / `renderExitPlanPanel` | 2857 / 2867 | Institutional Technical Brief 렌더러 |
| `_renderFundHeader` | 3948 | 기업 분석 헤더 렌더(aio-chat.js가 로드순서로 역참조) |
| `_renderFundFinancials` | 4077 | 재무/애널리스트/SEC Frames |
| `_renderFundEarnings` | 4745 | 어닝 일정/서프라이즈 |
| `_renderFundNews` | 4801 | Finnhub 기업 뉴스 |

### `js/aio-chat.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `CHAT_CONTEXTS` | 64 | AI persona/context |
| `_fetchTechnicalDataForChat` / `_aioTechnicalSymbolsForChat` | 2322 / 2400 | OHLCV 기술지표 주입 + 무티커 기술 질문 시장 대표 프록시 라우팅(R213) |
| `AIO_CHAT_SOURCE_REGISTRY` | 2479 | 채팅 데이터 출처 레지스트리 |
| `AIO_CHAT_PIPELINE_REGISTRY` | 2513 | AIO 전용 통합 답변 파이프라인 레지스트리 |
| `_fetchDeepCompareData` | 3081 | 심층 기업 비교 데이터 |
| `_classifyChatIntent` | 3672 | 의도 분류 |
| `_aioChatAnswerPolicy` | 3700 | 일반/스크리너/단순 종목/매매 판단 답변 정책 분리(R212) |
| `_buildAioIntegratedAnswerContext` | 3777 | 현재 시장+정량+정성+페이지 연결 계약(R214) |
| `_googleSearch` | 4208 | Google CSE fallback |
| `chatSend` | 5160 | 컨텍스트별 AI 전송 |
| `fundamentalSearch` | 6559 | 기업 분석 수집/렌더 |
| `_aioBuildDiversifiedRecommendationRows` / `_aioRunScreenerQuery` / `_formatScreenerResultPrompt` | 1890~1892 (alias) | **실제 정의는 aio-data.js**(17286/17352/17486) — 로드순서 의존 alias |
| `_fmtNum` | 6443 (alias) | **실제 정의는 aio-core.js:24102** |
| `_renderFundHeader`/`_renderFundFinancials`/`_renderFundEarnings`/`_renderFundNews` | 6866~6874 (alias) | **실제 정의는 aio-ui.js**(§ 위 표) — 4개 모두 로드순서 의존 alias |

---

## 4. 빠른 작업 참조

| 작업 | 우선 파일/범위 |
|------|----------------|
| R1 버전 동기화 | `index.html:10`(title), `index.html:5237`(badge), `js/aio-core.js:17670`(APP_VERSION), `version.json`, `sw.js:8`(SW_VERSION), `CLAUDE.md`, `_context/CLAUDE.md`, `CHANGELOG.md` + `index.html:12461~12463`·`15941`·`28287` 캐시버스터 `?v=` (반드시 `node scripts/bump-version.mjs <버전>`) |
| 매매 알고리즘 수정 | `js/aio-core.js:20068~20335`(computeTradingScore/getScoreAdvice/computeExecutionWindow/classifyMarketRegime) — **v51.98 Phase 3 A3로 모듈화됨**(§3 참조), `_ldSafe` 바로 뒤 |
| 배포 게이트/evidence 감사 | `js/aio-core.js:20527~22687`(contracts→evidence→trading→deployment gate) |
| 데이터 진실성/교차소스 | `js/aio-core.js:20535~20807` |
| DATA_SNAPSHOT 갱신 | `js/aio-core.js:18620~18898`, freshness/pipeline audit 18108~18440 |
| 뉴스 선별/렌더 | `js/aio-data.js:8404~10900` |
| RSI/기술지표 (서버·클라 이중 구현 — 진단 C1) | 서버 `scripts/fetch-data.mjs:625`(Cutler) vs 클라 `js/aio-core.js:16586`(Wilder) |
| 팩터 랭킹/백테스트 (라이브·서버 모델 불일치 — 진단 C2) | 라이브 `js/aio-data.js` `_aioComputeFactorRanks`(재확인 필요) vs 서버 `scripts/fetch-data.mjs:703` `backtestFactors` |
| 페이지 전환/init 가드 | `js/aio-core.js:22841~23313`(destroyPageCharts/showPage), 각 page init 함수 |
| sentiment/breadth 차트 | `js/aio-ui.js:14~900` |
| LLM 모델/쿼터 | `js/aio-ui.js:1551~1780` |
| Claude 채팅/웹검색/preflight | `js/aio-chat.js:2320~5160` |
| 기업 분석 UI | `index.html:8816~9118`, `js/aio-ui.js:3948~4900`, `js/aio-chat.js:6559~6877` |
| 포트폴리오 DOM | `index.html:9476~9931` |
| 옵션 분석 DOM(폐기 shell) | `index.html:10333~10343` |
| 한국 페이지 DOM | `index.html:10526~11699` |
| browser unit tests (CI 헤드리스 상설화됨, Phase 2 B5 — `.github/workflows/ci.yml` `headless-tests` job, report-only) | `js/aio-tests.js`, 로더는 `js/aio-core.js` 내(`AIO.loadTests()`), CI 러너는 `scripts/ci-headless-tests.mjs` |
| glossary | `js/aio-glossary.js`, `index.html:28287` |
| 데이터 파이프라인(서버) | `scripts/fetch-data.mjs` — Yahoo 1차 + 핵심 ETF 20종 한정 Twelve Data 2차 폴백(Phase 2 B1, `TWELVE_DATA_API_KEY` 필요, 지수/선물/FX/KR 확장은 미검증 스코프 제외), `getScreenerSymbols()`는 이제 `public-data/screener-universe.json`을 직접 읽음(Phase 2 B6, `scripts/sync-screener-universe.mjs`가 `js/aio-data.js`의 `SCREENER_DB`에서 생성·CI가 drift 검증 — 정규식 파싱 제거 완료. 클라 비동기 부팅 로드는 Phase 3 A2로 보류) |
| FRED_SERIES(서버) | `scripts/fetch-data.mjs:44` — Phase 2 B2(v51.97)로 `housingStarts`(HOUST)/`retailSales`(RSAFS)/`usWageGrowth`(CES0500000003) 추가, `fetchFred()`에 `scale`(단위 변환)·`mom_pct`(전월비%) kind 신설. `consConf`(Conf. Board)는 의도적 제외 — FRED 무료 시리즈 없음, UMCSENT(미시간대)와 혼동 금지(R274/P593). 한국 CPI(FRED 릴레이)는 보류(신선도 미검증 + KOSIS 직접경로 우위) |
| 매매점수 검증 하네스(Phase 3 C3, v52.2) | `scripts/backtest-trading-score.mjs`(신규) — `computeTradingScore`(`js/aio-core.js:20068`) 5개 서브스코어 계단함수를 순수 함수로 재구현, `public-data/history.json`으로 매일 재구성 점수 vs forward 5/21일 SPX 수익률 계산, `public-data/score-backtest-history.json`에 날짜별 upsert 누적(`updateBacktestHistory` P586과 동일 패턴). `fetch-data.mjs` `main()`의 `updateHistory()` 직후에서 호출. **현재 표본 극히 작음**(fg 데이터 24/201일뿐이라 5일forward n=19·21일forward n=3, `statisticallyMeaningful: false`) — 재튜닝 근거 아님, 인프라만(P599 참조). |

---

## 5. 검증 메모

- **v51.90 재스캔 (2026-07-02, Sonnet 5 — Fable 5 진단 Phase 0 A6b)**: v50.60(2026-06-16) 이후 **60버전 미재스캔** 상태였음(자체 규칙 "±500줄 리팩토링 시 재스캔" 위반 확정 — 진단 A6b). 전체 grep 재실측. 22페이지 시작점 전부 이동(page-home 4044→5227, CSS 3693→4888줄 +1195). `getCritical10ContentEvidenceMatrix`가 `_deadV49112_`로 개명된 사실 반영. inline runtime을 8블록으로 정정(구 CODE-MAP은 2블록으로 과단순화).
- **v50.4 핵심 축(과거 이력, 유지)**: v49.108(DataTruthGate)→109(cross-source)→110~112(critical-10 surface/situation/matrix)→50.0(EvidenceStore+21페이지 계약)→50.1(trading gate)→50.2(news surface)→50.3(text surface)→50.4(정적 캘린더 분리). 배포 게이트는 `AIO.runEvidenceDeploymentGate({strict})` 단일 진입점.
- **알려진 데이터 획득 갭(미해결)**: B계층 breadth %aboveMA(`fetchBreadthData` MMFI/MMTW/MMFD 선언만·실 fetch 미구현). C계층 CPI/PCE/NFP/AAII/NAAIM/SKEW/MOVE는 fetch 함수 0건·`/data-refresh` 스킬(WebSearch) 수동 갱신 — `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §4 B2 참조.
- **구조적 이슈(2026-07-02 진단 신규 반영)**: (1) index.html 인라인 알고리즘↔모듈 역참조(§3 경고, 진단 A3). (2) 서버·클라 RSI 공식 상이(§3 RSI 항목, 진단 C1). (3) 백테스트(4팩터)≠라이브 랭킹(7팩터+레짐 가중)(진단 C2). (4) js/aio-tests.js 900+ 테스트가 CI 미실행(진단 B5). 상세는 `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` 전문 참조.
- `.claude/commands`와 `.claude/hooks`는 **2026-05-18(커밋 09d2200) 이후로 GitHub-tracked** — 구버전 CODE-MAP의 "GitHub-tracked checkout에는 없다" 서술은 stale였음(정정 — `_context/CLAUDE.md` 2026-07-02 재작성판 참조).
- 큰 구조 변경 뒤에는 이 파일의 line 번호를 반드시 재스캔한다. **다음 재스캔 트리거**: index.html 또는 js 모듈 어느 한 파일이라도 ±500줄 변경 시, 또는 3개월 경과 시(자동 staleness 방지).
