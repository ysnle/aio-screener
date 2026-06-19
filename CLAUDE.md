# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v50.85**
- **전체 버전 이력 → `CHANGELOG.md`** (상세 변경 이력의 단일 출처). 아래는 **최근 버전 요약만** 유지한다 (WO-12 문서 다이어트 — 루트 CLAUDE.md는 매 세션 로드되므로 슬림 유지. 이전 요약은 CHANGELOG.md에 더 상세히 보존됨).
- **v50.85 Phase 4: 10개 페이지 시각화 구조적 통합**: `.aio-vis-card` CSS를 cyan border-left+그라디언트 네이티브 스타일로 교체. vis-* 패널을 각 페이지 네이티브 섹션 내부로 이동 — HOME→배너, SIGNAL→대시보드 헤더, BREADTH→4-col KPI 병합, SENTIMENT/TECHNICAL→헤더 인라인, MACRO→스토리라인 카드, FXBOND→Cross-Asset 매트릭스, SCREENER→통합 검증 패널.
- **v50.83 Phase 3: AI 채팅 자동 시각화**: `window._aioChatAutoVis(q, response, tickers)` 추가. AI 응답 완료 후 질문·응답 텍스트 정규식 스캔 → 가장 관련 높은 다이어그램(score-breakdown/yield-curve/sentiment-gauge/economic-cycle/market-regime/factor-backtest/factor-radar/price-position) 1개 자동 주입. `aio-chat.js` 후속질문 블록 직후 훅, 전체 try/catch 격리.
- **v50.82 Phase 2: 10개 페이지 SVG 다이어그램 시각화 통합**: CSS `.aio-vis-panel` 그리드 + 10개 페이지에 `<div id="vis-{page}">` 플레이스홀더. `js/aio-ui.js`에 `_aioRenderPageDiagram(pid)` IIFE 추가 — `aio:pageShown` 훅으로 페이지 진입 시 자동 렌더. home(score+regime)·signal(score)·breadth(regime)·sentiment(gauge)·briefing(pipeline+cycle)·technical(price)·macro(cycle+yield)·fxbond(yield)·screener(backtest). fundamental은 `window._aioRenderFundamentalRadar(ticker,row)` 티커 검색 후 동적 렌더.
- **v50.81 _aioDiagram 10-type SVG 다이어그램 엔진 (Phase 1)**: `js/aio-ui.js` 끝에 `window._aioDiagram` IIFE 추가. 외부 라이브러리 없이 JS→SVG 문자열 생성, `render(type,el,data)` + `getSvg(type,data)` API. 10 타입: score-breakdown·market-regime·factor-radar·pipeline-status·economic-cycle·price-position·sector-bubble·yield-curve·sentiment-gauge·factor-backtest.
- **v50.80 자가 운영 구조 근본 보강**: 서버 FRED 미설정 시 클라이언트 `aio_fred_key` 자동 브릿지(`_aioLoadServerData` step 2-B). `fredHasKey`/`fredFetchOk` 세분화(키 미등록 vs API 실패 구분). `data-watchdog.yml`에 F&G/FRED/screener age 경보 추가. `refresh-data.yml` job summary(KST 시각·심볼·FRED·LLM 상태 테이블).
- **v50.79 공유 가능성 게이트 보강**: 런타임 계약 감사, 공유 준비도 감사, 자동운영 게이트, CI runtime contract check를 연결해 “기록만 남고 실제 회귀는 통과되는” 구조를 차단.
- **v50.75 홈 대시보드 구조 정리**: Codex 가짜 히트맵(`AIO_IMPORTED_RESEARCH`/`_aioPremiumBoardModel`/`_aioRenderImportedResearchBridge` 등 ~480줄) 전면 제거. 실데이터 `_aioRenderMarketHeatmap()` 신설(SPX/VIX/F&G/TNX × 1W/1M/3M/6M). "🧠 현재 시장 분석"·"Action Items" 카드 시각 숨김(중복 제거). T839/T840 재작성.
- **v50.74 Decision Header 구조 보강**: `_aioDefaultDecision`이 `computeTradingScore()` 기반 라이브 5밴드로 판단 문구를 동적 생성. FOMC 텍스트 9곳 하드코딩을 `AIO_EVENT_FRESHNESS_REGISTRY` 단일 경로로 전환. 무관 페이지(포트폴리오 등)의 FOMC footer 제거. `_aioRenderAllPageDecisionHeaders`가 `AIO_ALL_ROUTE_PAGE_IDS` 참조. T841 추가.
- **v50.73 premium research board + visual report**: 사용자 제공 X/이미지 자료를 `public-data/user-research-digest.json` 자동 보강 계약에 편입. 1~5번 스크리너 이미지의 heatmap/table/metric/cockpit 구조를 공통 premium board로 반영하고, AI 채팅/페이지에서 현재 결과를 PNG형 visual report card로 생성·다운로드 가능하게 보강. T840 추가.
- **v50.72 imported research bridge**: 사용자 제공 X 링크 6개와 UI/UX 참고 이미지 9개를 `REFERENCE` 자료 브리지로 구조화. home/macro/fxbond/technical/screener/ticker/fundamental/portfolio/themes/KR 페이지에 반영하고 AI 채팅 컨텍스트에도 주입하되, 라이브 가격/실적/뉴스처럼 확정 인용하지 않도록 sourceKind 계약을 유지. T839 추가.
- **v50.71 잔여 심층 점검 보강**: 자동 API 온보딩 모달을 opt-in으로 전환, guide decision header 누락 보강, screener/ticker 전용 AI persona 추가, FOMC 과거 이벤트 정적 문구 제거, 주요 빈 상태 문구를 간결하게 정리. T838 추가.
- **v50.70 페이지별 decision/sourceKind UX 개편**: 모든 주요 페이지 상단에 오늘 판단·근거 3개·오늘 행동·데이터 기준시각·sourceKind·신뢰도를 먼저 표시. FOMC 6/17은 upcoming이 아니라 결과 확인/시장 반응 구간으로 전환하고, screener/ticker 결과에서 바로 AI 질문 액션을 연결. 기업 분석 프레임워크는 17개 관점으로 통일. T837 추가.
- **v50.69 매크로·브리핑 의사결정형 UX 개편**: 로컬 8877 실화면 점검에서 매크로 장문/장(章)형 설명과 브리핑 뉴스목록 중심 UX가 확인되어, 매크로를 FOMC/금리·이란/유가·달러/유동성·시장 톤 결론 카드로 전환. 브리핑은 AI 키가 없어도 시장 상황 요약과 오늘 행동을 뉴스 목록보다 먼저 표시. T836 추가.
- **v50.68 데이터 최신화 + 라이브 UX 정리 배포본**: 2026-06-17 네트워크 허용 상태로 `fetch-data`와 `fetch-telegram-digest` 재실행. quotes 77/77, F&G 40, news 25, history 185d, screener 851/869, Telegram 7일 807건(3채널) 갱신. v50.67의 가이드/API 설정/브리핑/포트폴리오 문구 과밀도 정리 포함.
- **v50.63 Telegram digest 자동 최신화 루프 보강**: `refresh-data.yml` 깨진 `run:` 배선을 복구하고 정기 작업에 `scripts/fetch-telegram-digest.mjs --out public-data/telegram-digest.json`를 추가. 앱 부팅 시 동적 digest를 읽어 `AIO_TELEGRAM_WEEKLY_DIGEST`, category registry, page map, DATA_SNAPSHOT digest freshness, Telegram pipeline audit에 반영. T831 추가.
- **v50.62 Telegram 3채널 1주일 다이제스트 통합**: @aetherjapanresearch·@insidertracking·@bornlupin 공개 미러 796개 포스트를 수집해 HOME_WEEKLY_NEWS, `AIO_TELEGRAM_WEEKLY_DIGEST`, SCREENER_DB 메모 오버레이, MACRO/TECH 키워드, AI 채팅 컨텍스트에 반영. BOJ 1%·US-Iran/Hormuz·Anthropic Fable/Mythos export-control·NVDA EML/CW laser·CPO/NPO·800V HVDC/SOFC·MU/SK Hynix HBM4E·MLCC/WF6 테마 통합. `scripts/fetch-telegram-digest.mjs` 추가, T829 추가.
- **v50.62 data/theme refresh**: public-data fetch refreshed 77/77 quotes, F&G 41, news 25, history 184d, screener 851/869. Telegram digest now has category registry + page map across home/macro/fxbond/technical/themes/sentiment/signal/fundamental/breadth/screener/briefing/market-news. Snapshot freshness separates market-data date from news/theme digest date. T830 added.
- **v50.60 AI 채팅 통합 답변 파이프라인 보강**: `AIO_CHAT_PIPELINE_REGISTRY`와 `_buildAioIntegratedAnswerContext()` 추가. 채팅 답변이 일반 LLM처럼 고립된 문장 생성에 머물지 않고 현재 시장, 정량 지표, 정성 뉴스/공시, 퀀트 스크리너 후보, 관련 AIO 페이지를 함께 연결하도록 시스템 프롬프트 계약을 주입. T828 추가.
- **v50.59 AI 채팅 차트 분석 연결 보강**: 기존 OHLCV 기술분석 엔진이 종목 티커 질문에는 쓰였지만 무티커 시장 차트 질문에는 자동 주입되지 않던 갭을 수정. `_aioTechnicalSymbolsForChat()` 추가로 기술/차트 질문에 SPY·QQQ·SMH 등 시장 대표 차트 컨텍스트를 주입하고, `technicalOHLCV` 소스를 채팅 레지스트리/감사에 등록. T827 추가.
- **v50.58 AI 채팅 답변 정책 유연화**: 스크리너/데이터 가드가 답변을 억제하지 않도록 `_aioChatAnswerPolicy()` 추가. 일반·교육 질문, 스크리너 추천, 단순 종목 사실, 매매 판단을 분리해 Bull/Base/Bear·기관 리포트·추세 필수 규칙은 필요한 질문에만 적용. 스크리너 후보군은 3M·RSI·퀀트 랭크·시장 분산 근거로 활용 가능하게 명시하고 T826 추가.
- **v50.57 AI 채팅 추천 편향 완화**: 넓은 "종목 추천" 질문에서 고정 리서치 문단이 CEG·전력·AVGO 등 특정 테마로 과수렴하던 구조를 보강. `_aioRunScreenerQuery()`에 균형 추천 후보 모드를 추가해 SCREENER_DB를 섹터·시장·시총별로 분산 샘플링하고, 최근 대화 반복 티커는 감점. 채팅 프롬프트에 추천 다양성·반복 편향 방지 규칙을 주입하고 T825 회귀 테스트 추가.
- **v50.56 심층 감사 정확성·운영 게이트 보강**: 22페이지 계약과 배포 게이트 불일치, KST helper scope, KR 지수 원자 갱신, KR 카드/pill sink 소유권, 원화 가격 truth range, 공식 일정 자동 연장, ticker mapping, snapshot mirror를 시정. evidence/text block 0·22/22 route·899/899 PASS. T743/T823/T824와 CI 구조 검사 추가. Windows 실행정책과 `Path`/`PATH` 충돌을 피하는 `scripts/start-local.cmd` 제공.
- **v50.55 12페이지 실효성·정합성 감사 반영**: 외부 감사 보고서의 지적을 실제 DOM/렌더 경로와 대조해 오탐과 실결함을 분리. 스크리너 `screener.json` 미수신을 무한 로딩 대신 `unavailable`로 표시하고, FMP 미설정 밸류/퀄리티는 제외 팩터로 명시. 뉴스는 실제 등록 소스 수 동적 표시, 토픽 4종 보강, 48시간·점수 30·150건 상한 공개. 기술분석 고정 승률/출처 불명 통계 제거. AI 브리핑은 런타임 시장·향후 일정 컨텍스트로 전환하고 과거 정적 이벤트 제거. 공식 일정은 Fed/BEA 확인 기준 6/16-17 FOMC·6/25 PCE만 향후 항목으로 유지. Actions에 FMP/Anthropic 선택 시크릿 전달. T822 회귀.
- **v50.54 기관/퀀트급 업그레이드 Phase 3 — 알고리즘 백로그 완결(레짐 가중·6팩터·포트 리스크)**: 운영자 "물어본 것 모두 진행". **3A** `_aioFactorWeights(marketState)` 레짐 적응형 가중 — 위험회피(저변동·퀄리티↑·모멘텀↓)/위험선호(모멘텀·추세↑)/후기사이클(밸류↑) → `_aioComputeFactorRanks` present 팩터 정규화 + 스크리너 레짐 노트(검증: risk-off 시 방어주 JNJ 40→80). **3B/3C** FMP 밸류·퀄리티·어닝(6팩터): `fetch-data.mjs enrichFundamentals`(FMP_API_KEY 게이트 — ratios-ttm/financial-growth/earnings-surprises → PE/PB/EV-EBITDA·ROE/마진/성장·EPS서프라이즈) → screener.json. 클라 value(저밸류 역방향)·quality 팩터 + 스크리너 밸류/퀄리티 컬럼(정렬). 키 없으면 4팩터 폴백(무회귀). **3D** `_aioRenderPortfolioExposure` — 섹터 집중도·상위종목·평균상관·평균 퀀트랭크·한도 경고(검증: Tech 93% 집중 ⚠️). **3E** `_aioRenderPortfolioStress` — 2008/COVID/금리+100bp/유가+30% 섹터 베타 추정 손익. 검증: 6팩터 랭킹·컬럼·포트 패널·22페이지 회귀 0·테스트 878/896(클린로드 deepReview 0·T557은 테스트 잔류 아티팩트·신규 회귀 0)·콘솔 JS 0. 운영자(선택): `FMP_API_KEY` 유료 시 밸류/퀄리티 라이브. 보류: B1 KR(운영자 미선택). R1 7곳+캐시버스터 5곳.
- **v50.53 기관/퀀트급 업그레이드 Phase 2 — 전용 퀀트 스크리너 페이지 + 팩터 백테스트 + LLM 서버키 확장**: 운영자 "Phase 2 모두 진행 + 전용 페이지". Phase 1 랭킹 엔진이 채팅에서만 보이던 것을 시각화. **2A** 신규 `page-screener`(사이드바 nav '퀀트 스크리너') — 전 유니버스를 멀티팩터 퀀트 랭크(0~100)순 정렬 가능 테이블(순위·종목·섹터·모멘텀/추세/저변동·3M·RSI·시총·가격·시그널)·헤더 클릭 정렬(`_aioScreenerSort`)·동적 섹터/시총/검색 필터. `renderScreenerResults` 부활(rank/팩터 컬럼+폴백). **22페이지 계약**: ROUTE_PAGE_IDS+screener → `applyPageContractCompatibility` 자동 등록(profile/refresh/deep-audit/sequential), `expectedRoutePageCount` 22, PAGES/breadcrumbMap/AIO_PAGE_BRIEFS/nav + 테스트(T737/740/743/805) 22. **2B** 서버 횡단면 팩터 백테스트(`fetch-data.mjs backtestFactors` — 1년 closes로 6 리밸시점 Spearman IC·상하위 분위 스프레드·적중률 → `screener.json.backtest`) + 클라 검증 패널(`_aioRenderScreenerBacktest`). **2C** 보조 LLM 2사이트(`autoTranslateNews`·`_generateAIBriefing`) `_aioClaudeTarget` 서버키 라우팅(B5 완결). 검증: 스크리너 872행·랭크 NVDA100→INTC0·헤더정렬·섹터필터 186·백테스트 패널(IC 0.072)·22페이지 게이트 unclassified 0·테스트 879/896(신규 회귀 0, T490/T776 신규 페이지 대응)·콘솔 JS 0. 보류: 밸류/퀄리티 팩터(FMP 유료)·백테스트 실측(cron enrich 후). R1 7곳+캐시버스터 5곳.
- **v50.52 기관/퀀트급 업그레이드 Phase 1 — 데이터 품질 + 멀티팩터 랭킹 + 블록 해제(B4/B5/B6)**: 운영자 "아키텍처·알고리즘 기관/펀드/퀀트급 보강" + "블록은 내가 운영자니 물어봐". 3-에이전트 진단: 정적 `SCREENER_DB`(시총/RSI/시그널 하드코딩)·멀티팩터/백테스트 부재가 최대 갭. **B4(키스톤)** `fetch-data.mjs` `fetchHistory(range=6mo)`+`backfillHistory` → history.json 1회 백필(차트 시간대기 제거, 소비자 ≥60일 자동전환). **Track1** 서버 스크리너 팩터 enrichment(SCREENER_DB 심볼 런타임 추출→1년 OHLCV→모멘텀/저변동/추세/RSI→`screener.json` 일1회 자가스로틀) + 클라 `_aioApplyServerScreener` 병합(정적→라이브). **Track2** `_aioComputeFactorRanks`(섹터 상대 z-score·winsorize·가중합→0~100 percentile·quantSignal) → AI 채팅 스크리너(`_aioRunScreenerQuery` '퀀트 랭킹순'+프롬프트 랭크/팩터 노출). 표 UI는 v39.2 제거됨 → 라이브 서피스(채팅)에 surfacing. **B5** Worker `/anthropic` POST(env.ANTHROPIC_API_KEY·opus차단·max_tokens·KV 일일캡) + 클라 `_aioClaudeTarget`(서버키 모드·개인키 우선) → 사용자 키 없이 채팅(운영자 1회 설정). **B6** cron 활성 확인 문서. 검증: 랭킹 NVDA 100→INTC 0·채팅 랭크정렬·B4 소비자전환·테스트 879/896(신규 회귀 0)·콘솔 JS 0. **운영자 설정**: Cloudflare 시크릿/KV(B5)·Actions 활성(B6). 백테스트는 history 누적 후 다음 단계. R1 7곳+캐시버스터 5곳.
- **v50.51 DEFERRED-BLOCKS §3 Priority A 전체 + B 착수 — stale-day 단일화·breadth 차트 통합·marketState 구독 완결·문서 다이어트**: 사용자 "보고서대로 작업". **A1** `_aioStaleDays`/`_aioStaleDaysLabel`(aio-core) 단일 헬퍼(base·now 로컬-일 정규화로 UTC/로컬 off-by-one 제거) — 실제 충돌은 **data-snap-date writer 2개**(aio-core:17734 'N일 경과' UTC parse vs index.html:21092 'D+N일' local parse)가 같은 `#KEY-stale-days` span 경쟁 기재(보고서의 2086/2148은 시나리오 writer였음 — 정정). 양 핸들러+LIFECYCLE getStatus+시나리오 2곳 단일 카운터 라우팅 + KR 4카드(deposit/52w-high/52w-low/advance) stale span 추가. **A2** SECTION 5-B(`bh-*` 히스토리 4캔버스) 제거 — `bp-*`(SECTION 5)가 동일 5/20/50 시장폭+S&P·나스닥 듀얼라인을 일별 전체사이클+라이브 override로 표시(중복), `initBreadthCharts`/`_refreshBreadthHistoryCharts` retired, 8→4 캔버스, 제목/aria 정직화. **A3** `aio:marketStateUpdated` 리스너(aio-core:3002)에 `renderDynamicMarketNarratives`+`generateMacroStoryline` 추가(idempotent·선순환 전파 완결, 채팅 헤더는 on-demand라 불요). **WO-12** 루트 CLAUDE.md 227→~75줄(최근 5버전+포인터)·`_context/CLAUDE.md` 209→~95줄+버전 정정(CHANGELOG.md 단일 이력 출처, 중복 archive 미신설). **WO-14** 게이트 블록 분류 착수 — 45 evidence 블록=100% `kind:live`(환경의존, 운영서 해소)·트레이딩 0·텍스트 signal 3→0/fxbond 1→0(reference archive+staleDate 오탐 시정)/themes 0, `GATE-BASELINE §6` 기록("67블록"은 대부분 환경 live임을 실증). **WO-13** critical-10 4함수 dead 아님(별개 lens·반환 shape 상이·테스트 T724~736 핀·RULES 의무·`buildEvidenceStore` 엔진 공유)·진짜 중복은 v50.44 해소(`_deadV49112`)·추가 thin-wrapper 병합은 계약 파손 위험 대비 이득 미미 → 보류. 라이브 검증: A1 span 단일포맷·A2 bp 5인스턴스/bh 제거·A3 sink 동기화·콘솔 JS 0. R1 7곳+캐시버스터 5곳.
- **v50.50 UX 1단계 — home 매매 판단 라벨 정합 (라이브 검증 기반)**: 사용자 "라이브 화면 보며 단계별 UX 작업". **라이브 페이지 직접 점검 결과**: 에이전트 정적 감사(PAGE-UX-AUDIT)의 "빈 껍데기/고장" ★항목 **대부분이 거짓 양성** — macro 스토리라인(실데이터 렌더)·온도계(61)·kr-themes(28카드)·kr-macro/kr-technical 모두 정상, options nav 이미 제거됨, sentiment/breadth verdict 렌더러 보유. **유일하게 실증된 진짜 모순 시정**: home "지금 매매해도 될까?" 카드가 YES/CAUTION/NO(`>70/>50`)라 같은 62점이 결론바/범례 "선별매수"(60-75)와 **모순**('CAUTION') → 카드를 결론바·범례와 **동일 5밴드**(75 적극매수/60 매수우호/45 중립/30 주의/30↓위험)로 정렬(aio-data.js refreshHomeDashboard). 62→"매수 우호" 일관. 회귀 0. **정직**: 남은 UX는 버그 아닌 주관적 밀도(긴 페이지=충실 콘텐츠) — 사용자 지목 시 선별 진행. R1 7곳+캐시버스터 5곳.
- 메인 파일: `index.html` (집계는 `_context/CODE-MAP.md` 기준 유지, 인라인 onclick 0건) + `js/` 6개 모듈
- 스택: HTML5 + 인라인 CSS/JS · Chart.js(CDN) · AES-256 · GitHub Pages · 한국어 UI · 다크 테마 · WCAG AA

---

## 작업 유형별 읽을 파일

| 작업 | 읽을 파일 |
|------|----------|
| **index.html 수정** | `_context/CODE-MAP.md` → 해당 line 범위만 Read |
| **버그 수정** | `_context/RULES.md` → `BUG-POSTMORTEM.md` → `QA-CHECKLIST.md` |
| **새 기능** | `_context/RULES.md` → `_context/CODE-MAP.md` → `_context/WORKTREE-AUDIT.md`(워크트리/배포 영향 시) |
| **QA/점검** | `_context/RULES.md` → `BUG-POSTMORTEM.md` → `QA-CHECKLIST.md` |
| **자료 통합** | `/integrate` 스킬 (→ `CHANGELOG.md` + `_context/KNOWLEDGE-BASE.md` 환류) |
| **데이터 갱신** | `/data-refresh` 스킬 |
| **지식 린팅** | `/knowledge-lint` 스킬 |

상세 문서: `_context/CLAUDE.md` (파일 구조 · Hook · Commands↔Skills 매핑 · 복리 루프)

---

## 절대 규칙 (R1~R3만 — 나머지 R4~R53은 `_context/RULES.md`)

**R1. 버전 동기화 7곳**: title · badge · APP_VERSION · version.json · sw.js SW_VERSION · _context/CLAUDE.md · CHANGELOG.md
**R2. 버전 체계**: `v{major}.{patch}` 숫자 단조 증가 (예: v48.76 → v48.77). 최신 실제 체계는 두 자리 patch 허용.
**R3. 버그 수정 시 사후 분석**: `_context/BUG-POSTMORTEM.md`에 P번호 기록
**R27. Commands↔Skills 동기화**: 새 스킬 시 command wrapper 동시 생성

---

## 작업 규칙

- **자동 배포/커밋 금지** — `/deploy` 또는 "배포해줘" 명시 시에만
- **전체 재작성 금지** — CODE-MAP.md 기반 부분 패치만
- **코드 수정 시 자동 반영**: BUG-POSTMORTEM + QA-CHECKLIST + RULES + 버전 6곳 동기화

---

## 복리 루프 (Karpathy Second Brain)

```
작업 수행 → 산출물 → 위키(_context/) 환류 → 다음 작업이 더 정확
```

| 작업 | 환류 대상 |
|------|----------|
| 버그 수정 | BUG-POSTMORTEM → 3회 반복 시 RULES 승격 |
| /integrate | CHAT_CONTEXTS + SCREENER_DB + TECH_KW/MACRO_KW |
| /qa | QA-CHECKLIST 항목 추가 |
| 인사이트 | KNOWLEDGE-BASE (R26) |
| 리팩토링 ±500줄 | CODE-MAP 재스캔 |

에러 복리 방지: `/knowledge-lint` 주기적 실행 (주 1회+). 코드 확인 없이 추측 판단 금지.

---

## 토큰 효율성

- 인사/칭찬/마무리 멘트 금지 · 질문 되풀이 금지 — 바로 작업
- 요청 범위 외 제안/과잉 설계 금지
- index.html은 CODE-MAP 기반 부분 읽기 · 파일은 한 번만 읽기
- 모르면 솔직히 말하기 (경로/함수명 날조 금지)
