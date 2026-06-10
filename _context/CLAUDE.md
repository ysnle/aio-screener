# AIO Screener — _context/ 프로젝트 컨텍스트

> 루트 `CLAUDE.md` = 절대 규칙 + 작업 규칙. 이 파일 = 파일 구조 + Hook + Skills + 복리 루프.

- **현재 버전**: v50.26
- **v50.26 P3/WO-11 초보자 태스크 중심 시작 패널 + ops(WO-7/WO-8)**: 홈 헤더 직후 `#aio-beginner-panel`(additive) 3대 질문: 오늘 시장(라이브 VIX 밴드+F&G 존 평이한 요약 `_aioRenderBeginnerSummary`+행동가이드)·종목 분석(`_aioBeginnerAnalyze`→기업분석 자동검색)·포트폴리오 동선. "간단히 접기"(localStorage). WO-5 `_aioRegimeNow` 재사용. T794~795. **ops**: WO-7 `history.json` 생산자(fetch-data.mjs 일별 upsert·420일 cap), WO-8 CI 게이트(ci.yml: JS 구문/버전동기화/stray + scripts/ci-version-check.mjs, CI green).
- **v50.25 P1/WO-5 정적 내러티브 레짐 드리프트 가드**: stale 내러티브 50버전 반복의 근본 차단. 정적 분석 텍스트(시나리오·스냅샷 prose·주간뉴스)는 Claude 세션 시점 시장 레짐 전제 → 시장 급변 시 급락일에 "사상최고 랠리" 표시. 작성 시점 레짐(`DATA_SNAPSHOT` SPX/VIX/F&G) vs 라이브를 `_aioRegimeDrift`로 비교(VIX 밴드·F&G 존·SPX %) → severe 시 `#main-content` 상단 전역 배너(`#aio-regime-drift-banner`) + `[data-static-narrative]` 강등 배지. `AIO.getNarrativeRegimeDriftAudit()`→`getAutoOpsReadiness`. 트리거 liveQuotes/serverDataLoaded/pageShown/부팅. R1 7곳+캐시버스터 6곳. T791~793.
- **v50.24 P0 구조 시정 (OPUS-HANDOFF 백로그 WO-1~4) + ops fetch-data.mjs Yahoo 호스트 폴백**: Fable 5 전수 감사(`_context/OPUS-HANDOFF-STRUCTURAL-AUDIT-2026-06-10.md`)의 P0 4건 시정. **WO-1 자율운영 cron 신뢰도**: refresh-data.yml cron이 등록 후 자동 발화 0회(수동 1회뿐) + 죽어도 감지 불가(CORS 프록시가 조용히 죽던 것과 동일 실패 클래스) → cron `*/30`→오프피크 `:17,:47`(정시 혼잡 회피) + fetch-data.mjs가 F&G/FRED 실패를 meta(`fearGreedOk`/`fredOk`/`macroKeyCount`)에 노출 + **독립 워치독 `data-watchdog.yml`(매시 :23)** 신설 — 커밋된 data.json이 3시간+ stale이면 워크플로 FAIL → GitHub 자동 실패 이메일(메인 cron 중단 surfacing). **WO-2 (P498) SPX ATH 레짐 버그**: 하드코딩 `7412.84`(stale)가 aio-data.js 두 곳 중복 → 한쪽(L13125)만 v50.16 시정되고 먼저 실행돼 `window._spxATH` 오염시키는 L12303 미시정 → SPX -2.9% 급락일에 레짐이 "Near ATH -0.4%" 오표시(라이브 실증). 단일 출처 헬퍼 `_aioSpxAthFloor()`(floor=max(_spxATH, DATA_SNAPSHOT.spxATH, 7585))로 두 호출점 통일 + topbar "Near ATH" 라벨 -2% 이내로 정직화(-2~-5% "소폭 하락"). **WO-3 (P499) 7페이지 refresh 매핑 오류**: theme-detail/portfolio/ticker/options/kr-themes/kr-macro on-enter refresh가 존재하지 않는 가상 계약 태스크(themeRanking/portfolioRisk/companyFundamentals/filings/optionsSnapshot/krMacro) 참조 → no-op + autoOps "unknown task" 7건 → `applyPageContractCompatibility`에 `CONTRACT_TASK_ALIAS` 치환(가상 파생 태스크→실제 fetch 의존 키, 유효 REFRESH_SCHEDULE 키만 채택). **WO-4 data.json 신선도 표면화**: topbar `#server-data-age` 배지(`_aioRenderServerDataAge`: 60분+ amber/180분+ red) + boot-only 갭 해소(`_aioStartServerDataPolling`: 30분 재로드 + 1분 나이 카운트업) + `aio:serverDataLoaded`→`refreshActivePageNarratives` 연결. R1 7곳 + 캐시버스터 6곳. T786~T790.
- **v50.23 데이터 백엔드 — 진짜 자율 운영 전환**: 정적사이트+CORS프록시+수동스냅샷 구조가 자율운영과 양립불가임을 진단, 구조 변경. `scripts/fetch-data.mjs`(서버측 Yahoo/FRED/CNN 수집→`public-data/data.json`) + `.github/workflows/refresh-data.yml`(30분 cron, 무료) + 사이트 로더 `_aioLoadServerData`(initV20DataEngine 시작 시 data.json→applyLiveQuotes/매크로/F&G, PRIMARY). 프록시 죽어도 서버데이터 백스톱. 검증: PowerShell 시드 23심볼(CORS 없이) 로더 적용 OK. 사용자 1회설정: Actions write권한 ON + FRED키 Secret(선택). 데이터확장=SYMBOLS 배열 추가. R1 7곳+캐시버스터 6곳.

## v50.22 note
- **잔여 로직 영역(sentiment·options·portfolio·briefing) 직접 trace 완료 + 전 21route undefined 스캔**. 사용자 "남은 영역 없어? QA 스킬 불신" → 코드 직접 정독. (1) 전 21 route 라이브 "undefined/[object Object]/NaN" 스캔 0건. (2) kr/ticker 3 render 직접 trace: analyzeKrIndex(유일 버그·시정) vs 29116·analyzeKrTickerDeep property 정확 + fundamental 실검색 undefined 0. (3) sentiment `_generateSentimentAnalysis`: F&G/VIX/PCR 임계값·항복적매도·클러스터 전부 역발상 일관·버그 없음. (4) options IV Rank(evidence 라벨)·VVIX 합리. (5) portfolio `_calcPortfolioVaR`/`_calcMaxDrawdown` 양수 반환→`'-'+fmtPct` 정확, null "-—"→`fmtLoss` "—" cosmetic 시정. (6) **콘솔 error 점검 → P497**: `fundamentalSearch`가 매 검색마다 없는 per-page 패널로 `chatSend('fundamental')` 자동전송 → "DOM input missing" 에러+쿼터 자동소진 시도 → 통합 입력창 프리필(opt-in)로 시정(검증: 에러 0). **결론**: 버그는 breadth/kr-technical/fundamental 특정 지점 집중, 핵심 로직 견고. 검증: badge v50.22·undefined 0·콘솔 JS 0(proxy 경고만). R1 7곳+캐시버스터 6곳+P496~497.

## v50.21 note
- **잔여 4페이지(technical/fxbond/fundamental/themes) 공식 trace 완료 + kr-technical 렌더 버그 클러스터 완전 시정**. (1) technical/kr-technical(analyzeKrIndex): v50.20 dipData에 더해 crossData(`_detectCrossSignals` {gc20_50} vs 표시 `.cross20_50==='golden'`)·divData(`_detectDivergence` {bearishDiv,bullishDiv} vs 표시 `.type`)도 property 불일치 → "undefined"+회색. 표시를 실제 반환 구조에 맞게 시정. 라이브: kr-technical undefined 0건. (2) 타당 확인: themes `classifyRRG`(25266) 표준 RRG 매핑 정확 · technical _detectStage/_detectTrendPosition/_assessEntryQuality 반환 정합 · fxbond DXY 밴드+곡선(v50.17) OK · fundamental FMP+차트(v49.72) 검증. **결론: 종합5+시장분석5+KR5=15페이지 이면 전수 완료**, 주요 버그 클래스 전부 커버. 검증: badge v50.21·undefined 0·콘솔 0. R1 7곳+캐시버스터 6곳.

## v50.20 note
- **나머지 8페이지 이면 전수 (시장분석+breadth+KR) — verdict 부호 + undefined 렌더 버그 시정**. (1) breadth `diagnoseBreadthConsensus`(aio-core.js:9884) 부호 버그: 양수 합의(0.1~0.4=약한 강세)를 "약세 우위"로 표시(결론 반대) → "강세 우위" 시정. (2) kr-technical `_classifyDip`: `{classification,score(0-100)}` 반환인데 표시(index.html:29844)는 `.label`(undefined)·`/5`(실제 0-100)·`.reasoning`(없음) → "undefined (점수: 53/5)" → 함수에 label/reasoning 추가 + `/5→/100`. (3) 타당 확인: macro 온도계(5가중+교차보정) 정교 · kr-macro=과거 금통위 로그+다음 7/10 정확 · kr-home 신용잔고 "정적·D+5일" 라벨 · kr-supply/themes 클린. 잔여: technical/fxbond/fundamental/themes 표준 지표 데이터 감사+spot만(전체 trace 미완). 검증: breadth 부호 정상·_classifyDip 정상·콘솔 0. R1 7곳+캐시버스터 6곳.

## v50.19 note
- **트레이딩 로직 이면(공식/가중치/임계값) + 실효성 보강 (signal·home)**. 사용자 "빠진 부분 없어? 실질적 의미·이면까지? 실제 매매 도움?" → stale 너머 로직 타당성·페이지간 정합·행동가능성 점검. signal `computeTradingScore` 이면 추적(5가중+교차보정 7종=정교) 후 **3약점 시정**: (1) 시장폭 입력 `window._breadth200` 미로딩 시 기본 75(낙관 편향)→`_breadth20`/snapshot 57 폴백(2곳) → breadthScore 88→72. (2) `exit-spx` 손절 SPX×0.9(기계적)인데 라벨 "기술적 지지선" → 200일선(추세 지지)→50일선→-10% 폴백 + basis 동적. (3) F&G cross-page 모순: signal momScore 극단 탐욕(≥75)=85 최대강세 vs home 역발상 "차익실현" → momScore 역U자(건강한 탐욕 피크 74·극단 탐욕 fade 66·극단 공포 25)로 정합 + 가중치 라벨 소스 명시. home Action Plan·sentiment VIX 기간구조 이면 타당 확인. 잔여: breadth/briefing/technical/macro정밀/fxbond/fundamental/themes 이면 + KR 5 순차. 검증: computeTradingScore 무오류·breadthScore 72·콘솔 0. R1 7곳+캐시버스터 6곳.

## v50.18 note
- **10페이지 분석/해석 텍스트 직접 정독 + stale 내러티브 근본 시정**. 사용자 "차트/지표 위주만 본 거 아냐? 분석/해석/섹션 설명 텍스트도 하나씩 직접" → v50.17(차트/데이터)이 못 본 산문 stale을 정독으로 시정. **(A) themes**: 동적 "Mid Cycle (Expansion)" vs 정적 "Late-cycle+스태그플레이션 최악" 모순 → 정적 블록 단정→조건부 교육+동적 위임. **(B) macro**: "이중 위험(고용 둔화↓)" 전제 오류(NFP 172K 견조와 정반대) → "견조한 고용+인플레·유가 리스크"로 정정. **(C) signal**: CP1/CP6 리스크보드가 DATA_SNAPSHOT.wti(97.2 stale) 읽어 "고점권" → getCP1Text/getCP6Text live CL=F/BZ=F 우선 + renderCPTexts가 applyDataSnapshot에서만 돌던 갭→aio:liveQuotes 핸들러에 추가 → "$89.52 안정화". **(D) breadth**: 50SMA 카드 52% vs 정적 readout "46% 미탈환"(결론 반대) → updateBreadthBars에 막대·readout 동적 갱신 → "52% 상회". home/sentiment/briefing/technical/fxbond/fundamental prose 정독+패턴 스캔 0건. 교훈: preview SW stale JS → unregister+caches.delete로 fresh 검증. R1 7곳+캐시버스터 6곳.

## v50.17 note
- **종합·시장분석 10페이지 이면 직접 점검 + stale 콘텐츠 근본 회귀 방지**. 사용자 "하나씩 직접 확인, 겉만 훑지 말고 이면까지" + "근본적 개선도 같이?" → 라이브 preview에서 데이터 이면까지 점검 후 실 시정 + 자동 감지 레이어 신설. **시정 5건**: (A) 전역 시장폭 칩 — `updateMarketPulse`가 v50.6 제거된 `window._breadth200`→`calcSectorBreadth`(섹터 당일 양봉 27%) 폴백 → 실제 breadth 52%와 불일치 "27% 약세" 전 페이지 표시 → `_breadth50`/`breadth50sma` 폴백 체인으로 "52% 주의" 정합. (B) sentiment NAAIM/II/HY 차트 빈 화면 — `_lazyInitChartPage` IntersectionObserver가 내부 스크롤 화면 밖 차트 미발화 → 1.4s 안전망 타이머 강제 init. (C) fxbond yield curve "수집 대기" 멈춤 — `initYieldCurveChart`가 macro만 호출+`koreaCurveChart||yieldCurveChart` 셀렉터가 항상 koreaCurveChart 선택+공유 `_ycChart` destroy 충돌 → `(targetId)` 파라미터화+per-canvas `_ycCharts{}`+fxbond init 호출+라벨 "한국→미 국채" 정직화. (D) signal `signalShortTerm`(5/31 9일 stale, 끝난 이벤트 미래 트리거화)·`AIO_EVENT_RISK_CONTEXT`(asOf 5/14 26일, 타임라인 전부 과거) → 6/9 전망(6/10 CPI·6/16-17 FOMC·6/25 PCE) 교체. (E) home SPX_ATH 폴백 7412.84→DATA_SNAPSHOT.spxATH·regime VIX 맥락·topbar 갱신. **근본 회귀 방지**: `getScenarioFreshnessAudit`가 `scenarios`만 보고 signalShortTerm 누락 → 두 블록 점검+`signalStaleDaysThreshold:7`. **신규 `getEventTimelineStalenessAudit()`** — 수동 createdAt 의존 없이 실제 timeline date/asOf로 "전부 과거"·"asOf 14일+" self-validating 감지. 둘 다 `getAutoOpsReadiness` 배선(scenario audit은 이전 orphan). **검증**: 시장폭 52%·sentiment 3차트·yield curve 정상·audit ok·콘솔 JS 0. LWC 내부 캔버스 33개 false positive 확인(조상 `tv-lightweight-charts`). T783~T785. R1 7곳+캐시버스터 6곳.

## v50.15 note
- **텔레그램 3채널 7일 시장 인텔리전스 전방위 통합 + 심화 기관 프레임워크**. @insidertracking·@aetherjapanresearch·@bornlupin을 **공개 `t.me/s/<채널>` 프리뷰**(로그인 불필요·Chrome 불요) + **`?before=<msgID>` 페이지네이션**(6/1~6/5 심층)으로 60+ 포스트·기관 리포트 15+건 포착. **1차 통합 5 surface**: (1) HOME_WEEKLY_NEWS 5대 뉴스 (2) DATA_SNAPSHOT 6/5 종가+6/8(SPX ~7,388·VIX 19.38·5월 NFP 172K·2Y 4.17%·WTI 97.2·원화 1,529·골드만 인하철회·currentTopic, 미러 R184, 지수레벨 텔레그램 % 환산·출처명시·라이브 우선) (3) AI채팅 `_getV48IntegratedContext` v50.15 블록 (4) KR_THEME_CATALYSTS (5) KNOWLEDGE-BASE PT-I~L. **2차 심화(기관 프레임워크)**: 채팅 2차 블록 — Mizuho ASIC 쓰나미(TPU 35M·수요-공급 갭=구조적 부족)·MS AVGO TP$502(beat-but-fell 정합)·JPM Computex+포지셔닝·Bernstein·Jefferies MSFT$575(모델→오케스트레이션)·한국 메모리 컨센(Daeshin 56만/340만·Meritz)·WSTS·BofA LNG·SemiAnalysis Dylan Patel "SOCAMM 셀오프=오독" 정정. KNOWLEDGE-BASE +2(PT-M ASIC 갭·PT-N 노이즈vs펀더멘털 진단). KR테마+LG(5대그룹)·shipbuilding(BofA LNG). **(B) 뉴스 파이프라인 전수 점검 + 근본 개선**: (1) **개별 기업 뉴스 연결(사용자 핵심 지적)** — `_fetchTickerDataForChat`이 Finnhub(키 필요)만 쓰고 60+ RSS/텔레그램 캐시를 종목별 미연결이 진짜 갭 → 신규 `_aioTickerNewsFromCache(ticker)`(심볼+한글명 별칭 필터·7일·score+신선도 Top6, API 키 불요) 주입. 라이브 NVDA 22건(Citi 반도체 리포트·NVIDIA-SK하이닉스 텔레그램 포함). (2) `scoreItem _PRIORITY_KW` +30 최신 키워드(ai factory/socamm/hbm4e/kyber/positioning unwind/호르무즈 등). (3) **정직 정정**: 직전 "t.me/s 폴백 배선" 권장은 틀림 — 이미 `fetchTelegramDirect`(t.me/s/+7프록시+DOMParser, step3 폴백)로 완전 구현, `isTelegramMsgRelevant`도 기관 리포트 통과. 텔레그램 파이프라인은 이미 견고. (4) **번역**: 외신 자동 한국어(Claude Haiku 배치)는 ① Claude 키 필요 ② fetch 후 배치라 시간 소요(키 없으면 영어 원문). 검증: 라이브 1·2차 블록+종목뉴스·콘솔 JS 0. R1 7곳+캐시버스터 6곳.

## v50.14 note
- **프론트엔드/UX 근본 보강: 회귀 방지 인프라 + 접근성**. v50.13이 가시 마커를 일일이 제거한 **증상 시정**에 그쳤다는 정직 평가 → 근본화. **(A) R206** `AIO.getVisibleDevMarkerAudit()` — 모든 `[id^="page-"]` 가시 textContent에서 개발자/버전 마커(§NN·vNN.NN·RNN·`*_REGISTRY`·`MACRO_CALENDAR`·`DATA_SNAPSHOT`·"Claude Mythos"·"Fallback Only"·"prominent") 검출. 앱버전배지·`[data-text-role="developer-note"]`·`[data-aio-archive]`·**외부 콘텐츠(라이브 RSS `.news-item-*`/LLM 채팅 `.acp-bubble`)** 제외 → 법률 `§10(b)` 같은 오탐 차단. `getAutoOpsReadiness()` 통합. **이 audit이 v50.13이 놓친 실제 동적 누출을 즉시 검출**: macro `generateMacroStoryline` 상태줄 "DATA_SNAPSHOT 즉시 폴백"→"정적 스냅샷", options PCR 위젯 소스 라벨 'DATA_SNAPSHOT'→'정적 스냅샷', home 가중치 tooltip "v49.28/R64 WEIGHT_REGISTRY" 제거. 결과: 가시 dev마커 0(clean + 전체 suite 실행 후 DOM 양쪽). **(B) R207** `AIO.getAccessibilityAudit()` — 활성 페이지 tap target(WCAG AA 24×24)·초소형 폰트(<10px)·접근 이름 누락 측정. home 온보딩 버튼(설정하러 가기/✕ 닫기) ≥24px 조정 → under24/noName/font<10 0, status ok. **(C)** R206/R207 RULES.md 추가 + T776~T781 회귀 가드. T777 routine 레지스트리 `AIO_PAGE_BRIEFS.breadth.steps` 정합. **(D) 사용자 "정말 하나씩 모두 점검?" 재검증 → 추가 갭 시정**: textContent 전용 audit이 놓친 **속성 dev마커 19건**(8페이지) 발견 — 표 a11y normalizer aria-label 'v50.14' 누출(heading clone에서 배지 제거), `_getDataFreshness` tooltip 'DATA_SNAPSHOT'→'정적 스냅샷'(13), home VIX표/breadth title 마커 제거. **audit을 속성(title/aria-label/placeholder/alt/data-tooltip)까지 확장**(surface 표기). **접근성**: 21페이지 라이브 진입 스위프 → <10px 폰트 7페이지 발견 → 사용자 결정으로 **앱 전역 폰트 ≥11px 일괄 상향**(인라인+동적 `(opts.fontSize||'9px')` 칩+DOM API). 교훈: SW 동일버전 캐시가 편집 JS 가림 → unregister+caches.delete+서버 fetch 대조. 최종 21페이지 스위프: dev마커(text+속성) 0·<10px 폰트 0·접근이름 누락 0·T776~781 통과·runTests 836/20(신규 회귀 0). R1 7곳 + 캐시버스터 6곳.

## v50.13 note
- **21페이지 라이브 프론트엔드/UX 세밀 점검 + 시정**(클러터·중복 / 초보자 직관성). 21 route를 `showPage`로 하나씩 진입해 섹션 단위로 실제 콘텐츠를 읽고 시정(직전 집계-only audit 보강). **가시 dev/버전 마커 제거**: §63/§58/§62/§55, "Claude Mythos"→"사이버보안"(정적+NARRATIVE_ENGINE 동적 양쪽), "v49.64에서 제거"·"v50.11 refreshed"·"v50.4 기준"·"Fallback Only/prominent". **전역 배지 한글화**: `renderStaticDataGovernanceBadges` STALE/STATIC/OK/REF→오래됨/정적/최신/참고. **홈 쿼터 중복 제거**(헤더배지 'AI·모델' + #llm-quota 단독). **breadth routine 200일선 제거**. **용어집 +7**(RRG/OAS/OPEX/소르티노/피오트로스키/ZBT/맥스페인, 260→267). 검증: 가시 dev마커 0·영문배지 0·콘솔 JS에러 0·회귀 0. 방법론 교훈: 스크린샷은 dpr로 폭 왜곡→측정+audit 우선. 보류: 4월-2026 내러티브 de-stale(별건). 리포트 `_context/FRONTEND-UX-AUDIT-2026-06-05.md`.

## v50.12 note
- **AI 채팅 기술적 분석 종목별 실측 데이터 주입**. 사용자 질의("fundamental 외 외환채권/기술/테마/매크로 채팅도 기관급 데이터?") → 조사 결과 4개 모두 방법론은 기관급 + live 헤더 최신이나 **technical만 종목별 실측 기술지표 미주입**. 엔진(`fetchOHLCVWithFallback`+`calcTechnicalSnapshot`+`calcExtensionHeat`, runInstitutionalTechnicalBrief가 사용)은 있는데 채팅 미사용 → `_fetchTechnicalDataForChat(tickers)` 신설(기존 엔진 재사용). technical/signal/ticker 컨텍스트에서 라이브 일봉 OHLCV(병렬·6s·최대3) fetch → RSI/MACD/볼린저/10·21·50·200 MA 정배열/trendState/Weinstein Stage/ATR 이격/RVOL/고저 레인지/확장도 블록 주입. 프롬프트가 Stage/피봇/손절/목표에 우선 인용 + 추측 금지. preview 실측 NVDA 251봉 RSI 43.8 계산 확인. 부수: stale 버전 테스트 4개(T657/672/674/679, `/^v49\./`로 v50 영구fail) semver-aware 시정. T775. **잔여 후속**: macro/fxbond/themes 4월-2026 동결 내러티브 de-stale + themes RRG 실측 주입.

## v50.11 note
- **전체 데이터 전수 최신화 (/data-refresh, 2026-06-05)**. Audit-first(getAutoOpsReadiness 등 + KR 캘린더 감사) → WebSearch(R183 band). **US 6/4 종가**: SPX 7,585 신고가·Nasdaq 26,831·VIX 15.40·WTI $93.03; **AVGO −12.6% AI 가이던스 실망**. **미러 drift 0**(vvix 85.75·breadth50 52·spxATH 7585). **캘린더 근본 보강**: `_aioRecomputeMacroCalendar`가 US+KR 둘 다 multi-cycle auto-advance(KR stale 4→0, R78/P255 재발 방지). **오늘의 브리핑**: 이벤트 레이어 AVGO 결과 반영(P61)·`STATIC_CONTENT_LIFECYCLE`에 현재 DOM(briefing-current-jun-3-25/jensen-computex-202606) 등록·시나리오 lastUpdated 6/4 AVGO 트리거 정정. **홈 핵심 뉴스** AVGO+SPX 신고가 재선별(NFP 오늘 발표·미발표 수치 생성 금지). data-snap 시드(cpi-yoy 등)·sink mismatch·지정학 리뷰(5건 6/4) 정합. **SKILL.md**에 U그룹(브리핑/MACRO_CALENDAR US+KR/current-topic) 신설 + HOME_WEEKLY_NEWS grep 경로 정정. 데이터 감사 seed/sink/mirror/KR/geo/scenario 0/ok, 콘솔 0. T681/T564/T759/T760 데이터 정합 업데이트.

## v50.10 note
- **AI 채팅 정성 데이터 커버리지 확장 (Claude web research)**. Claude native web_search(`web_search_20250305`)는 이미 callClaude 배선됐으나 트리거가 시점/뉴스/이벤트에만 켜지고 정성 7관점(공급망·TAM·경쟁·해자·13F·CEO전략·사업구조)엔 미발화. **(A)** `_shouldUseClaudeWebSearch` 정성 분기 추가(티커/정성ctx + 정성키워드, 순수시세 제외). **(B)** web search 활성 시 systemPrompt에 "정성 분석은 검색으로 출처·발행일 확인, 추측 금지" 지시. **(C)** 스트리밍 파서가 `web_search_tool_result`+`citations_delta` 수집→`_aioLastClaudeCitations`→`_searchCitationsHTML(engine:'claude')` 출처 푸터. **(D)** v50.9 저신뢰 배지→검색 발화 시 "🔍 웹검색 출처 기반". **(E)** `_QUOTA_LIMITS.claudeWebSearch`(daily 120) 비용 상한(공유 유료 키 보호). 신규 API·키 없음. T772~T774.

## v50.9 note
- **AI 채팅 고위험(저신뢰) 관점 confidence 통합 고지**. 17관점 감사(v50.8) 후속 — 정성 high-risk 7관점(CEO/경영진·Moat·TAM·공급망·플랫폼/생태계·경쟁·리스크)은 placeholder/정적테이블/휴리스틱/연차필링 기반. 함수가 이미 `dataConfidence`를 산발 라벨하나 AI가 놓칠 수 있어 통합. **사용자 선택**: ① 무료 대체 소스(13F/TAM/공급망)=보류(채팅 흐름 맞는 무료 자동 소스 구조적 부재), ② confidence 고지 강화=진행. **(A)** `_fetchTickerDataForChat`가 데이터 블록 상단 `⚠️ [저신뢰 자동데이터 관점] ...` 1줄 주입 — `AIO_ANALYSIS_FRAMEWORK_REGISTRY.highRiskFields(true)` label 동적 생성(하드코딩 X) + R116/R117 "단정 금지·외부확인 권장". **(B)** `chatSend`가 종목 답변에 amber confidence 배지 추가. 헬퍼 `window._aioLowConfPerspectives` 모듈 최상위 정의(캐시-hit 답변에도 적용). T771.

## v50.8 note
- **AI 채팅 데이터 출처 전수 감사 + 채팅의 v50.5 FRED 재사용**. 감사 결론: 채팅 견고(실시간 시세 강제 fetch·11소스 펀더멘털·`_liveSnap` 시장헤더·18컨텍스트 100% 동적·답변후 자동검증). agent false-alarm 2건 정정(`_getV48IntegratedContext` index.html:15539 정의됨 / web_search `_shouldUseClaudeWebSearch`→callClaude 배선됨). 진짜 갭 시정: macro 채팅 실제 컨텍스트는 index.html:17554 override(aio-chat.js:62는 死코드)인데 US CPI/PCE/Core 인플레가 누락 → `_liveSnap().macro`에 인플레 YoY 필드 추가(FRED live 우선+스냅샷 폴백) + 프롬프트 라인. `applyFredToUI`가 FRED를 `DATA_SNAPSHOT.cpi/pce/nfp` write-back. baseline: `CHAT-DATA-AUDIT-2026-06-04.md`. T770.

## v50.7 note
- **페이지별 "현재 시장 분석" 텍스트 라이브 동기화**: 분석 생성기는 이미 라이브 데이터를 읽었으나 `aio:pageShown`(진입 1회)에만 연결돼 페이지 체류 중 데이터 갱신에 텍스트가 안 따라옴. 7개 페이지 생성기(breadth 합의/themes 사이클/signal 시나리오·레짐/macro 시나리오/options 전략/briefing action/sentiment VIX)를 named 함수로 추출 + `AIO_PAGE_NARRATIVE_RENDERERS` 레지스트리. **`AIO.refreshActivePageNarratives()`**가 `aio:liveQuotes`+`aio:refresh:done` 시 보이는 페이지 분석만 재생성(숨은 페이지 스킵 + 8초 스로틀). `data-narrative-stamp`로 "🔄 자동 갱신 · HH:MM:SS" 표식. 생성기 재작성 없이 트리거만 확장 = 저위험. T769.

## v50.6 note
- **Breadth = 5/20/50일선만** (Part 1 완료): 200일선을 breadth participation에서 표시+로직 전면 제거(signal 정적진단·골드크로스 카드·breadth200sma 시드·alias·매핑·점수 라벨). 200일선은 추세 판별(가격 vs 200MA, Weinstein)에만 유지. **주의: `window._breadth200`은 레거시 변수명이며 실제 20일선 breadth(bpSPX20)** — rename 위험으로 유지하되 의미는 20일선. data source: TradingView 스크랩불가/Investing.com 취약 → 주간 WebSearch 수동. T768 가드.
- **초보자 친화 텍스트 개선** (Part 2 전 21페이지 핵심 완료): 3 Explore agent ~130건 audit 기반. 개발자/버전 마커 사용자 노출분 전면 제거(screener_pro/Citi §64/title 버전/함수명), 영어 약어 한글 병기(ATH·DXY·FOMC·IV·GEX·FCF·EV/EBITDA·RRG·Sharpe·VCP·NAAIM·PMI·PF 등), 전문용어 풀이(스큐·콘탱고·듀레이션·삼의법칙·점도표·숏스퀴즈 등), 인명 일반화(Weinstein/SEPA/VCP 기법명은 유지), watch→action·인과 보강, options intro 전면 재작성+초보경고. 21페이지 네비게이션 에러 0·콘솔 에러 0 검증. (잔여 7 dev-block은 S&P500/$SPX/CBOE/10-K 등 금융용어 audit 휴리스틱 오탐.)

## v50.5 note
- C계층 매크로 실데이터(FRED) 연결: PCE/Core PCE/Core CPI를 기존 FRED 파이프라인에 등록(`yoy:true`, 13-obs YoY 계산). macro 페이지에 인플레·고용 값 카드 행 신설(CPI/근원CPI/PCE/근원PCE YoY + NFP MoM). CPI 비교표 라벨-데이터 불일치(MoM under YoY label) 교정. `applyDataSnapshot` 매핑 + `DATA_SNAPSHOT.nfp` 폴백. FRED 키 설정 시 자동 YoY 오버라이드.
- SKEW/MOVE 자동 fetch: `^MOVE` LIVE_SYMBOLS 신규 + `_aioBridgeVolIndicesLive()`로 ^SKEW/^MOVE/^VVIX live값을 비-archive data-snap sink에 브릿지(Yahoo 응답 확인). 무료 소스 없는 sentiment/breadth(AAII/NAAIM/SKEW/MOVE/breadth%aboveMA)는 주간 WebSearch 갱신이 유일 경로 — AAII Bear 41.9/SKEW 136.86/MOVE 73.58/breadth 52·55로 갱신.
- T763~T767. 병행: CODE-MAP 재스캔, GATE-BASELINE 신설, text-surface 누출 정리.
- **데이터 계층 정리**: 무료 자동 fetch = 시세/뉴스/VIX·SKEW·MOVE·VVIX/글로벌지수/FRED(키)/KR(키). 무료 소스 없음(주간 WebSearch 수동) = AAII·NAAIM·breadth %aboveMA. breadth %aboveMA는 Yahoo 404/Stooq N/D 확인됨.

## v50.4 hotfix note
- Static market data/calendar surfaces were refreshed to 2026-06-03 KST. `AIO_MACRO_CALENDAR`, `DATA_SNAPSHOT` metadata, `HOME_WEEKLY_NEWS`, briefing event layer, risk pinned events, options/KR macro copy, and AI briefing prompt context now separate last-published official values from future releases. Computex/GTC Taipei is a verified current-topic layer; SpaceX IPO is a source-dependent watch item; CPI/NFP/PCE future values must not be invented before official releases. T759~T762 added.

## v50.3 hotfix note
- Text surfaces now have a 21-route governance contract. `AIO_TEXT_SURFACE_CONTRACTS`, `AIO.getTextSurfaceAudit()`, and `AIO.applyTextSurfaceHygiene()` classify visible/tooltip copy and gate developer markers, stale fixed-date market claims, long explainers, and unsupported current-market claims. The audit is included in `AIO_AUDIT_REGISTRY` and `AIO.runEvidenceDeploymentGate()`. T755~T758 added.

## v50.2 hotfix note
- News surfaces now share AIO_NEWS_SURFACE_CONTRACTS and AIO.buildNewsSurfaceModel(). Home core news is top-3 verified/current market-impact news; briefing is the 08:00 KST 24h decision window with AI input limited to verified/current items; market-news remains 48h exploration with filters and empty reasons. AIO.getNewsSurfaceAudit() is wired into AutoOps readiness and AIO.runEvidenceDeploymentGate().

## v50.1 hotfix note
- Trading/decision-use outputs now have a dedicated evidence gate. Use `AIO.getTradingDecisionInputEvidence()` for SPX/SPY/VIX/10Y/HYG/DXY/WTI input currentness and `AIO.getTradingDecisionLogicAudit()` for stale fallback/proxy logic review before trusting market score, regime, execution window, Weinstein stage, ticker entry checklist, or options IV Rank.

## v50.0 hotfix note

- Added the evidence-first 21-page contract foundation. `AIO_PAGE_CONTRACTS` is now the single runtime contract for all route pages, compatibility maps are derived from it, `EvidenceStore` classifies every live/snapshot/chart/table/form/numeric/narrative item with an evidenceId, and `AIO.runEvidenceDeploymentGate()` replaces representative critical-10 checks as the deployment-facing gate. AI chat receives EvidenceStore context and post-answer numeric/date evidence reference auditing.

## v49.112 hotfix note

- Added a full critical-10 content evidence matrix. Every live cell, snapshot cell, snap date, chart-like element, static numeric text, and market narrative across the 10 US pages is classified as pass/warn/block/needs_evidence. External references can be passed in to compare actual observed market values against visible page prices, so checks are not limited to representative samples or internal self-audits.

## v49.111 hotfix note

- Added critical-10 market situation deep auditing. The app now inventories live cells, snapshot cells, snap dates, chart-like elements, static numeric text, and market narrative text across the 10 US pages, then compares visible values and narratives against the current quote/truth/cross-source reference snapshot and derived market regime. `refreshCritical10MarketSituationAudit()` can fetch, cross-check, rebind, and re-audit in one pass.

## v49.110 hotfix note

- Added critical-10 market surface auditing. Comprehensive page freshness and ops readiness now inspect the actual visible market cells across the comprehensive 5 plus market-analysis 5 pages, warning on missing live sources, missing DOM bindings, truth-blocked/reference-only values, stale refresh tasks, and stale snap dates before any page can report OK.

## v49.109 hotfix note

- Added multi-source quote cross-validation. Quote values are recorded by source family and compared across Yahoo/Naver/Stooq/Finnhub/FMP/CoinGecko/FX where available. Independent live-source mismatches block trading-use data, delayed/EOD mismatches warn, and AI chat preflight receives `cross=<status>/<count>` for detected stock tickers.

## v49.108 hotfix note

- Added DataTruthGate for trading-safety data validation. Live quote data must pass source allow-list, timestamp/age, sanity range, and price-vs-previous-close percent-change coherence checks before it can remain decision-usable. DOM sinks receive `data-truth-*` attrs, truth-blocked values are forced to `reference-only`, and AI chat preflight receives truth status/issues.

## v49.107 hotfix note

- Critical-10 freshness is now the operating unit for the US market pages: comprehensive 5 plus market-analysis 5. Manual refresh, page-enter refresh, and AI freshness preflight use that symbol universe, then explicitly apply and verify every `data-live-price/chg/pct/field` DOM sink so a successful fetch is not treated as a successful visible update until the screen binding audit passes.

## v49.106 hotfix note

- AI chat now injects an answer coverage/current-data contract. It expands response modes across decision, comparison, valuation, earnings, technical, portfolio-risk, macro, catalyst, data-validation, and beginner explanation intents, and forbids current numeric claims from Claude/model memory unless an injected prompt data block supplies them.

## v49.105 hotfix note

- AI stock-answer freshness now treats `forceFresh` as strict: bypass `_chatTickerCache`, bypass `_liveData` immediate cache returns, bypass `ensureFreshDataForUse` minGap throttle, and re-attempt per-ticker quote lookup before prompt assembly.

## _context/ 문서 (16개 Git-tracked 활성)

| 문서 | 역할 | 갱신 트리거 |
|------|------|-----------|
| CLAUDE.md | 이 파일: 구조, hooks, skills, 복리 루프 | 구조 또는 워크플로 변경 시 |
| RULES.md | 마스터 룰 R1~R205 | 새 규칙/패턴 발견 시 |
| BUG-POSTMORTEM.md | 버그 사후 분석 P1~P463 (R25 역참조) | 버그 수정 후 |
| QA-CHECKLIST.md | QA 14티어 체크리스트 v3.7 | /qa 발견 시 |
| KNOWLEDGE-BASE.md | 기술 인사이트 축적 (R26) | 인사이트 발견 시 |
| CODE-MAP.md | index.html + js 모듈 line 범위 맵 | 리팩토링 ±500줄 |
| INDEX.md | 지식 베이스 인덱스 + 백링크 (R24) | /knowledge-lint L6 |
| WORKTREE-AUDIT.md | GitHub/live/worktree 라우팅 + 미배포 작업 인벤토리 | 워크트리 병합/배포/감사 |
| DEEP-QA-2026-05-05.md | UI/API/페이지 로직 심층 QA 결과 | 심층 QA 또는 live/local parity 변경 |
| OPERATIONS-AUDIT-2026-05-06.md | 운영 지속성/자체 진단/캐시 회전 점검 | 런타임 또는 배포 운영성 변경 |
| DATA-PIPELINE-AUDIT-2026-05-06.md | API/소스부터 렌더 sink까지 데이터 파이프라인 레이어 맵 | API/분석/렌더 파이프라인 변경 |
| ARCHITECTURE-AUDIT-2026-05-10.md | v49.3 전수감사 보고서 기반 아키텍처 보강 요약 | 데이터/함수/리스크 레이어 변경 |
| DATA-FRESHNESS-AUDIT-2026-05-10.md | v49.4 데이터 최신성/자동 갱신 보강 요약 | freshness policy/source/stale 기준 변경 |
| GATE-BASELINE-2026-06-04.md | v50.4 evidence 게이트/단위테스트 실측 기준선 | 게이트/테스트 재측정 시 |
| CHAT-DATA-AUDIT-2026-06-04.md | v50.8 AI 채팅 데이터 출처 전수 감사 baseline | 채팅 데이터 경로/컨텍스트 변경 시 |
| FRONTEND-UX-AUDIT-2026-06-05.md | v50.12 21페이지 라이브 프론트엔드/UX audit (클러터·중복/직관성·위계) + P0/P1/P2 백로그 | UI/UX 시정·페이지 구조 변경 시 |
| OPUS-HANDOFF-STRUCTURAL-AUDIT-2026-06-10.md | v50.23 구조 전수 감사 실측 + Opus 작업 백로그 WO-1~14 (cron 미발화·ATH 레짐 버그·stale 내러티브 구조 등 P0 5건) | WO 항목 완료/구조 변경 시 |

## 파일 구조

```
AIO/
├── index.html · version.json · manifest.json · sw.js
├── js/
│   ├── aio-core.js · aio-data.js · aio-ui.js · aio-chat.js · aio-tests.js · aio-glossary.js
├── CHANGELOG.md · CLAUDE.md · api_setup_guide.html · cloudflare-worker-proxy.js
├── _context/           ← Git-tracked 위키 (위 11개 문서)
├── .claude/
│   └── skills/         ← Git-tracked 3개: bug-fix · data-refresh · integrate
```

> 참고: 일부 Claude 로컬 워크트리는 `.claude/commands`, `.claude/hooks`, 추가 skills/agents를 별도 운영 파일로 보유할 수 있다. GitHub 배포 기준 점검은 Git-tracked 파일을 우선한다.

## Commands ↔ Skills (R27: 새 스킬 시 wrapper 동시 생성)

| `/command` | skill | eval |
|------------|-------|------|
| `/deploy` | 인라인 | — |
| `/qa` | post-edit-qa | T1~T14, Q1~Q7 |
| `/bug-fix` | bug-fix | B1~B6 |
| `/integrate` | integrate | E1~E9 |
| `/data-refresh` | data-refresh | D1~D8 |
| `/session-save` | 인라인 | S1~S6 |
| `/knowledge-lint` | knowledge-lint | L1~L7 |
| `/version-up` | 인라인 | — |
| `/autoresearch` | autoresearch | — |

## Hook 시스템

GitHub-tracked v49.1 통합본에는 hooks가 포함되어 있지 않다. Claude 로컬 운영 워크트리에 hooks가 있을 때만 아래 레이어를 적용한다.

| Hook | 타이밍 | 역할 |
|------|--------|------|
| `protect-files.sh` | PreToolUse | 백업/아카이브 덮어쓰기 차단 |
| `block-dangerous.sh` | PreToolUse | rm -rf, force push 차단 |
| `validate-edit.sh` | PostToolUse | div 열림/닫힘 균형 검증 |
| `check-antipatterns.sh` | PostToolUse | alert()/confirm(), d.pct\|\|0, 극소 폰트 감지 |
| `check-version-sync.sh` | PostToolUse | R1 버전 6곳 동기화 자동 검증 (index.html·APP_VERSION·version.json·CLAUDE.md) |
| `auto-commit-on-stop.sh` | Stop | 세션 종료 시 미커밋 변경사항 WIP 자동 저장 |

## 복리 루프 (Karpathy Second Brain)

```
원본 투입 → 작업 → 산출물 → _context/ 환류 → 다음 작업 정확도↑
```

| 작업 | 환류 대상 |
|------|----------|
| 버그 수정 | POSTMORTEM → 3회 반복 시 RULES 승격 |
| /integrate | CHAT_CONTEXTS + SCREENER_DB + KW + KNOWLEDGE-BASE(E9) |
| /qa | QA-CHECKLIST 항목 추가 |
| /data-refresh | DATA_SNAPSHOT + 텍스트 정합성 |
| 인사이트 | KNOWLEDGE-BASE (R26) |
| /knowledge-lint | INDEX.md + violated_rule 빈도 |

**에러 복리 방지**: 추측 판단 금지(P68) + /knowledge-lint 주 1회+ + verified_by agent/human 구분
