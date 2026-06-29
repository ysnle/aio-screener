# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v51.70**
- **전체 버전 이력 → `CHANGELOG.md`** (상세 변경 이력의 단일 출처). 아래는 **최근 버전 요약만** 유지한다 (WO-12 문서 다이어트 — 루트 CLAUDE.md는 매 세션 로드되므로 슬림 유지. 이전 요약은 CHANGELOG.md에 더 상세히 보존됨).
- **v51.70 RSI 다이버전스 UI 상세화 + 주봉 컨텍스트 패널**: `analyzeTickerDeep`에서 `calcTechnicalSnapshot()` 호출 → `snap.rsiDiv`로 4타입(강세/약세/히든강세/히든약세) 다이버전스 + 구체 설명 렌더. `snap.weeklyCtx`로 주봉 SMA20/SMA50/RSI14/추세 4-그리드 패널 추가. 캐시버스터 v51.67→v51.70 동기화(이전 세션 누락 수정). R1 7곳 v51.70.
- **v51.69 피보나치/매물대/RSI 다이버전스/주봉 — `calcTechnicalSnapshot()` 통합**: `_calcFib(bars)` 최근 160봉 스윙고저→0.236/0.382/0.5/0.618/0.786 되돌림 + 1.0/1.272/1.618/2.618 확장, 현재가 최근접 레벨. `_calcVolProfile(bars)` 160봉 24구간 Volume Profile — POC(거래량 최다 가격)/Value Area(±70%)/최근접 지지·저항 매물대. `_calcRSIDivergence(bars)` RSI 시리즈 계산 → 불리시(가격LL+RSIHL)/베어리시(가격HH+RSILH)/히든 불리시·베어리시 감지. `_calcWeeklyContext(bars)` 일봉 5봉 묶음→주봉 OHLCV 시뮬레이션→주봉 SMA20/SMA50/RSI/추세. R1 7곳 v51.69.
- **v51.68 VCP 자동 감지**: `_calcVCP(bars, indicators)` — Minervini 방법론. Stage 2(SMA150>SMA200, 가격>SMA50, 52주고점-30%이내) + 스윙고저 수축패턴(N=4봉) + 거래량 고갈(후반<전반×0.85) + 피벗 돌파 감지 + VCP 점수(0~100). 서버사이드 `_calcVCPServer()` → `screener.json` `vcpScore/vcpStage/vcpPivot` 필드. 스크리너 테이블 VCP 컬럼(정렬 지원). `calcTechnicalSnapshot()` 반환에 `vcp/vcpScore/vcpStage/vcpPivot` 추가. R1 7곳 v51.68.
- **v51.67 변화율(delta) 표시 시스템**: FRED MoM delta 서버계산 + CNN F&G 전일 delta + 트레이딩스코어/시장폭 localStorage 일별 비교 + `_AIO_DELTA_POLARITY` 맥락 인식 색상(CPI하락=녹색, VIX하락=녹색, NFP상승=녹색). `_aioRenderDeltas()` 통합 렌더러. R1 7곳 v51.67.
- **v51.66 구조적 개편 3 — _fieldTs 타임스탬프 추적 + 전 페이지 신선도 UI + staleness 경고**: `DATA_SNAPSHOT._fieldTs` 카테고리별 갱신 시각 기록(prices/fearGreed/macro_fred/screener/serverData). `_aioGetFieldTs(category)` KST 포맷 유틸. `_aioRenderDataFreshness()` 통합 렌더러 — 스크리너 "팩터 HH:MM | 가격 HH:MM KST", 매크로 `#macro-fred-ts`. `_aioCheckManualFieldStaleness()` — 9개 정책 날짜 7일 초과 시 amber pill 경고. P547.
- **v51.65 구조적 개편 2 — FMP API 진단 강화 + Screener 6h 갱신 + 파이프라인 상태 UI**: FMP `enrichFundamentals()`에 플랜오류(HTTP 403/401) 감지 + `fmpHasKey/fmpOk/fmpCount/fmpPlanError` meta 추적. Screener 자가스로틀 20h→6h. 서버데이터 나이 배지를 "06-29 14:00 KST" KST 절대시각 포맷으로 개선. `#aio-pipeline-status-bar` 파이프라인 상태 배너(AI미등록/FMP플랜오류/FRED미등록 경우에만 표시). 스크리너 페이지 FMP 상태 인라인 노트. `_aioRenderPipelineStatus()` 신설.
- **v51.64 구조적 개편 1 — fetchQuote OHLCV 기반 일간 Pct + DATA_SNAPSHOT 자동파생 원칙**: `fetchQuote()`가 `chartPreviousClose`(주말 수집 시 전주 종가 반환 문제) 대신 `range=5d` OHLCV 배열 `closes[-2]`로 일간 변동률 계산. `_pctSource: 'ohlcv-daily'|'chart-meta-fallback'` 감사 필드 추가. DATA_SNAPSHOT 리터럴에 "가격/변동률 필드 수동 편집 금지 + data.json 자동 파생 원칙" 명문화. P545. R1 7곳 v51.64.
- **v51.63 DATA_SNAPSHOT 구조 수정 + Pct 정정**: `nasdaq`/`dow`/`rut`/`vix`/`kosdaq`/`brent`/`gold`/`dxy` 등 8개 속성이 `//` 주석 내에 묻혀 실제 JS 프로퍼티로 미정의되던 버그 수정. `spxPct` -1.95→-0.05(당일), `nasdaqPct` -4.60→-0.24(당일), `dowPct` +0.60→-0.09(당일), `vixPct` +6.54→-2.54(당일), `kospiPct` -7.08→-5.81(당일), `kosdaqPct` -11.92→-4.10(당일). Apple CXMT 서사 수정(AAPL 실제 +3.1%). 2026-06-26 종가 기준. R1 7곳 v51.63.
- **v51.62 구조적 데이터 동기화 브릿지**: `applyLiveQuotes()`에 `_LIVE_SNAP_MAP`(19개 심볼) 추가 — 라이브 시세 수신 시 `DATA_SNAPSHOT` 자동 갱신 후 `applyDataSnapshot()` 재호출. `data-live-price`와 `data-snap` 요소가 항상 동일 시각 데이터를 표시. R1 7곳 v51.62.
- **v51.61 DATA_SNAPSHOT 전면 갱신**: 2026-06-26 종가(금요일) 반영. SPX 7354, NASDAQ 25298, KOSPI 8411, KOSDAQ 851, F&G 25 극단공포, VIX 18.41, WTI $69.85, TNX 4.37%, DXY 101.38. (v51.63에서 Pct값 오류 정정됨.) R1 7곳 v51.61.
- **v51.60 UI 잡음 추가 제거**: 홈 매매신호 카드 `가중치:` 공식 3줄 HTML 제거. briefing 페이지 `지난 24시간 핵심 뉴스를 테마별로 정리합니다.` 설명 박스 제거. `#breadth-5sma-note`, `#breadth-20sma-note` CSS 숨김. R1 7곳 v51.60.
- **v51.59 전 페이지 잡음 제거**: dual-verdict 4페이지(`home`/`signal`/`sentiment`/`macro`) 구 conclusion-bar CSS 숨김. `.aio-why` 설명 블록 전 페이지 CSS 숨김. `.tg-feed-more`("전체 채널 피드 →") CSS 숨김. cross-link 내비행 8곳 HTML 제거(`signal`/`breadth`/`briefing`/`technical`/`macro`/`fxbond`/`fundamental`/`screener`). `fxbond`/`guide` insight-box overriding rule 수정. R1 7곳 v51.59.
- **v51.58 전 페이지 구조 간소화**: CSS `.insight-box { display:none }` 전 페이지 페이지 설명 카드 숨김(18개). 홈 `aio-legend`(스코어 범례) + 빠른이동 pill-chip 행 제거. market-news `aio-why` 설명문 + cross-link 네비행 제거. kr-technical `aio-why` 설명문 제거. R1 7곳 v51.58.
- **v51.57 전 페이지 UI 간소화**: Action Hub(뉴스 인텔리전스/시장 Cockpit 3카드 설명 섹션) 전 페이지 제거. Decision Header에서 왜/오늘 행동/데이터 기준시각 3카드 그리드 제거 → 상단 판단 1줄+AI 버튼만 유지. 뉴스 아이템 desc/explain/action 제거 + template summary 필터("헤드라인 기준 톤은" 패턴 숨김) + 메타 행 T{tier}/verificationStatus/ageHours 제거. R1 7곳 v51.57.
- **v51.56 텔레그램 피드 구조 개선**: 홈/브리핑/시그널 등 전 페이지 tg-feed에서 다이제스트형 포스트(━━━━ 포함 또는 600자 초과) 필터링. 새 _aioRenderTgDigestBrief() + _aioParseTgDigestSections()로 Weekend Summary/Market Summary를 카테고리별 한국어 불릿으로 파싱 → market-news #news-korean-rewrite-brief + briefing #briefing-tg-digest 구조화 표시. KR_TICKER_MAP에서 'google'/'alphabet'/'facebook' 영어 단어 제거(소스명 오탐 방지). R1 7곳 v51.56.
- **v51.55 트레이딩 방법론 통합**: Qullamaggie 3셋업(돌파/EP/파라볼릭숏)·Minervini Triple Barrel·LLY 사례 SCREENER_DB 메모 추가. `AIO_EVENT_FRESHNESS_REGISTRY.appleCXMT` 신설(Apple CXMT 단기노이즈 판단 + 이중공급망 분기 구조 분석). guide-strategies 섹션 신설(index.html). `technical` CHAT_CONTEXT Qullamaggie EP+ORH+Triple Barrel 보강. `_context/KNOWLEDGE-BASE.md` TM-I/II/III 추가. R1 7곳 v51.55.
- **v51.54 한국 시장 3개 페이지 텔레그램 피드 추가**: `kr-home`(한국 시장 최신 소식·4건·date정렬·compact), `kr-supply`(수급·외국인 동향·3건·score정렬·compact), `kr-macro`(한국 매크로·반도체 소식·4건·score정렬·본문표시). `_TG_PAGE_TAGS`에 각 페이지 카테고리 등록, `_TG_PAGE_CFG` 레이블/설정 등록, index.html 3개 `tg-feed-kr-*` 컨테이너 신설. R1 7곳 v51.54.
- **v51.53 스크리너 7일 신선도 정책**: `SCREENER_DB_META.staleAfterDays` 30→7, `replaceAfterDays` 60→14. `_aioApplyServerScreener()` 7일 freshness gate 추가(7일 초과 screener.json은 적용 건너뜀) + `screener.json.asOf`로 `lastBulkUpdate` 자동 갱신. per-entry `newsTs` 체크로 7일 초과 뉴스 메모 자동 제거. R1 7곳 v51.53.
- **v51.52 콘텐츠 정합성 보강**: 운영자 노트 placeholder 태그("예시태그1/2") → 실제 태그("애플/메모리반도체/7월조정"). `_isPlaceholderTag` 필터에 "예시|작성|샘플" 패턴 추가(미래 예시 태그 자동 차단). `AIO_EVENT_FRESHNESS_REGISTRY.iranHormuzOil` 6/28 유조선 호르무즈 통과·유가 급락 반영. R1 7곳 v51.52.
- **v51.51 UI/UX 타이포그래피·간격 정규화 시스템**: `.aio-subhd`/`.aio-body`/`.aio-note`/`.aio-key`/`.aio-info-box`(+is-warn/danger/success)/`.aio-divider`/`.aio-row` CSS 유틸리티 클래스 신설. `.aio-section-label` 11px→`var(--fs-xs)`. `.insight-box` 배경 `var(--surface-1)` 통일. 스크리너·시그널·시장폭·기술분석 페이지 16곳 서브헤딩/경고박스 `.aio-subhd`/`.aio-info-box.is-warn` 전환. R1 7곳 v51.51.
- **v51.50 UI/UX 전 페이지 세밀 섹션 리듬 개편**: 매크로·기술분석 수준 품질로 20개 전 페이지를 개별 분석해 논리적 섹션 경계 파악 후 aio-section 전환. 347개 aio-section 참조로 터미널 전 페이지 통합. guide 9섹션·kr-macro 7섹션·kr-home 6섹션·kr-supply 2섹션·market-news 2섹션·screener·ticker·portfolio·fundamental·theme-detail 신규 섹션 추가. R1 7곳 v51.50.
- **v51.49 UI/UX 전체 페이지 섹션 리듬 개편 완결**: v51.48 매크로·기술분석에 이어 나머지 18개 페이지(signal·breadth·sentiment·briefing·fxbond·fundamental·themes·portfolio·ticker·market-news·screener·kr-pages·guide) 전 섹션 불투명 박스 → `.aio-section` 오픈 구조로 교체 완결. 전 페이지 `rgba(X,Y,Z,0.04)` 배경 → `var(--surface-1)` + 컬러 보더 통일. R1 7곳 v51.49.
- **v51.48 UI/UX 매크로·기술분석 섹션 리듬 개편**: 두 페이지 전 섹션의 `background:var(--bg-card);border:1px solid var(--border)` 불투명 박스를 `.aio-section` 오픈 구조로 교체. 섹션 카드 배경 `rgba(X,Y,Z,0.04)` → `var(--surface-1)` + 컬러 보더로 통일. tg-live-feed·aio-vis-card 청록 그라디언트 제거. R1 7곳 v51.48.
- **v51.47 구조적 개선 4건**: `calcTechnicalSnapshot()`에 `sma50_5d`·`sma50Rising` 추가로 stageEstimate가 SMA50 기울기 기반 STAGE_3_TOPPING을 표면화. `_calcBB()` 분산을 `/period`→`/(period-1)` 표본 분산으로 교정. `_kalmanTrend()` R 파라미터를 `(vol/100/√252)²` 동적화. watchdog 48h 초과 시 `process.exit(1)` 게이트 추가. R1 7곳 v51.47.
- **v51.46 버그 수정 2건**: `calcTechnicalSnapshot()` 반환값에 `failedRetest` 필드 누락으로 FAILED_RETEST 시그널(score 58)이 절대 발동하지 않던 문제 수정(P537). 백테스트 `COMP_W.size: 0.16` 데드 키 제거 후 4팩터 합계=1.00 재정규화(P538). R1 7곳 v51.46.
- **v51.45 기관급 기술분석 엔진 보강**: 종목 심층분석에 미너비니 기반 5/10/20 단기 배열, 50/100/200 장기 배열, 전체 5/10/20/50/100/200 정·역배열 점수, 확장 이동평균 크로스, 수평 매물대 Volume Profile(POC·Value Area·상단 매물벽·하단 방어선), VCP 수축/거래량 위축, 피보나치-매물대 중첩을 추가. `calcTechnicalSnapshot()`과 AI 채팅 입력도 동일 배열 체계로 동기화. R1 7곳 v51.45.
- **v51.44 트레이딩 로직/백테스트 감사 보강**: 스크리너 백테스트 Kalman 팩터를 raw 가격 속도에서 로그 가격 기반 일간 % 속도로 전환하고 `kalmanScale: "log_pct_day"` 표식이 있는 값만 런타임 병합. 75+ 점수 해석의 "적극 매수" 문구를 "매수 우호/선별/분할/무효화 우선"으로 정리. 데이터/런타임 CI 게이트 추가. R1 7곳 v51.44.
- **v51.43 시각 위계/구조 개편**: v51.42의 기능 구조는 유지하면서 Bloomberg-terminal 고정감을 줄이는 전역 디자인 레이어를 추가. 운영자 노트는 최상단 유지 + 짧은 lead/전체 메모 펼침 구조로 전환, KR 기술 페이지 레거시 인트로 숨김, fundamental 카드 그리드 폭 누수 방지, UX CI에 R231/P534 게이트 추가. R1 7곳 v51.43.
- **v51.40 운영자 노트 최상단 승격 + 기본 경로 회귀 방지**: Claude v51.39 트레이더 도구 작업본을 기준으로 홈 운영자 노트를 세션 시작 전 확인 카드로 최상단 이동, 제목/본문 크기 확대, 예시 태그 필터링, Signal 숨김 레거시 `#signal-lockout-control`이 접힘 UI로 재노출되지 않도록 런타임/CI 게이트 보강. R1 7곳 v51.40.
- **v51.39 실거래 활용 구조 개선**: 트레이더 프로파일(5종), 고급 필터 빌더, 포지션 사이저, 진입 타이밍 신호, 개인 워치리스트.
- **v51.38 스크리너 기관급 분석 로직 개선**: Kalman 초기 속도 시드(s1=0→5일 기울기, 수렴 지연 제거), 레짐 가중 이진→점진 블렌드(riskScore 35~65 선형 보간), 가중 합=1 명시 정규화 보장, 모멘텀 1M(40%)+3M(40%)+6M(20%) 가중(6M·trend 중복 감소), 추세 SMA50(60%)+SMA200(40%), 퀄리티 ROE·마진·성장률 개별 클램핑 후 동일 스케일 평균, 섹터 소표본(2~5개) 완전 폴백→섹터·유니버스 블렌드, 백테스트에 kalman IC 추가·라이브 가중 동기화. R1 7곳 v51.38.
- **v51.37 텔레그램 분석 카드 렌더러**: `_aioProcessTelegramItem()` 헬퍼 신설 — 감성 판단(bullKw/bearKw + score 보정), 카테고리→한국어 라벨+CSS 클래스, 헤드라인 추출(첫 문장 ≤220자), 수치 하이라이트(`<span class="tg-num">` 앰버색), 티커 방향 컬러링. `_aioRenderTelegramFeedHtml()` 전면 교체 — `.tg-card` 분석 카드 포맷(카테고리 pill·감성 인디케이터·헤드라인·본문 요약·티커). R1 7곳 v51.37.
- **v51.36 텔레그램 자동최신화 루프 전면 연결**: broadItems 임계값 score≥50(309개), 14일·50페이지 수집 확장. CSS `.tg-live-feed` + HTML `tg-feed-*` 컨테이너 9곳(home·signal·breadth·sentiment·briefing·technical·macro·fxbond·market-news) + `_aioRenderTelegramFeedHtml()`·`_aioInjectAllTelegramFeeds()` 렌더러. `_aioApplyTelegramDigestPayload()` 완료 시 전체 갱신 + `aio:pageShown` 훅 per-page 재렌더. R1 7곳 v51.36.
- **v51.35 broadItems(개별 뉴스피드) 구조 추가**: `public-data/telegram-digest.json`에 `broadItems` 필드 신설 — score≥57 재채점, 최대 200개, datetime 내림차순(뉴스피드). `_aioNormalizeTelegramDigestPayload()`→`rawBroadItems`, `_aioBuildTelegramMemoOverlay()` broadItems 우선 적용(더 많은 티커 커버), `window.AIO_TELEGRAM_BROAD_ITEMS` 노출. `_buildAioIntegratedAnswerContext()`: 쿼리 관련도 기반 상위 25개 개별 항목 AI채팅 컨텍스트 주입(날짜/채널/티커/텍스트 미리보기). `scripts/fetch-telegram-digest.mjs`에 broadItems 생성 로직 추가. R1 7곳 v51.35.
- **v51.34 텔레그램 digest 갱신 + 선별 로직 개선**: `public-data/telegram-digest.json` 2026-06-19~06-26 KST 범위로 갱신(809개 포스트, topItems 45개). 신규 5건 반영: KOSPI -5% 매도사이드카, 삼성전기 나홀로 +7%(MLCC ETF), MLCC '금값' AI서버 50~60% 급등, 김용범 메가프로젝트 6/29 예고, 연준 윌리엄스/굴스비 발언+OpenAI IPO 연기 검토. `scripts/fetch-telegram-digest.mjs`: 분류 정확도 향상(kr-market 태그/사이드카 보너스/저신호 포스트 패널티), 스코어 base 40→35, topItems 기준 score≥65. 정적 `AIO_TELEGRAM_WEEKLY_DIGEST` 동기화. R1 7곳 v51.34.
- **v51.33 칼만 정밀화 + 스크리너 UX 심화**: `_kalmanTrend()` → `innovZ`(이노베이션 z-score `e/√S`) + `velConf`(신뢰도가중 속도 `vel/(1+√pt)`) 추가 출력. `screener.json`에 `kalmanInnovZ`/`kalmanVelConf` 필드 추가. `kalmanRaw`가 `velConf` 우선 사용. 스크리너 테이블: 그룹 헤더 행(기본 정보/팩터 점수 0~100/시장 데이터/시그널/뉴스) + 그룹 경계 구분선. 팩터·레짐 탭: 2-컬럼 Ops Console — 팩터 가중 막대차트(좌) + 레짐 설명·커버리지(우). `_aioRenderFactorTab()` 신설. R1 7곳 v51.33.
- **v51.32 칼만 추세 팩터 + Ops Console UI**: `_kalmanTrend(closes)` 상태공간 모델(90일, level+velocity) → `kalmanVel`/`kalmanPt`를 `screener.json` 팩터로 추가. `_aioComputeFactorRanks()`에 7번째 팩터(kalman, 10%) 동적 등록 + 레짐 적응형 가중. 스크리너 페이지: 4-KPI 상단 바(총 종목/강세 시그널/랭크≥80/활성 팩터), 3-서브탭(랭킹|팩터·레짐|백테스트 IC), K-vel 16번째 컬럼, `.is-compact` 셀 패딩 4px 압축. R1 7곳 v51.32.
- **v50.98 Market-impact news selection**: Actions 뉴스 백스톱을 매크로/AI·반도체/지정학·에너지/FX·채권/애널리스트·한국시장 6축으로 확장. 서버 뉴스에도 `score`/`selectionReason`/`serverNewsScored`를 부여하고 `AIO.getNewsSelectionAudit()`로 선별 기준을 감사.
- **v50.96 multi-agent QA version sync**: ticker 페이지 직접 검색 진입, KR 수급 폴백 경고, 뉴스 stale 배너/데이터 신선도 표시, v50.95 한국어 뉴스 insight 보강을 R1 버전 표면까지 최종 동기화.
- **v50.95 Korean news insight fallback**: Claude/Google 번역이 없거나 약해도 `_aioBuildNewsLocalKoreanInsight()`가 모든 뉴스에 한국어 요약·해석·영향·확인 액션을 생성하고, market-news/home/chat 컨텍스트가 이를 소비. `getNewsTranslationQualityAudit()`와 data-pipeline contract gate가 회귀를 감시.
- **v50.94 data pipeline contract gate**: refresh-data/data-watchdog/scripts/app 소비 경로를 `ci-data-pipeline-contract-check.mjs`로 묶고, `AIO.getDataPipelineAudit()`가 public-data/FRED/LLM/Telegram/screener 운영 상태를 드러냄.
- **v50.93 Telegram digest memo + CI gate wiring**: Actions가 생성한 `public-data/telegram-digest.json`이 `SCREENER_DB.memo` 동적 `[TG YYYY-MM-DD · auto]` overlay까지 반영되도록 연결. `getTelegramPipelineAudit()`/T831/runtime contract gate가 memo 주입을 검증하고, CI가 runtime/semantic/workflow gates를 모두 실행.
- **v50.89 semantic review + workflow compaction gate**: 감사 함수/shape/coverage/DOM 존재 확인이 실제 의미 검토를 대체하지 못하도록 R219/P513 + `ci-semantic-review-check.mjs` 추가. `_context`/CLAUDE/skills가 append-only로 비대해지는 문제를 R220/P514 + `ci-workflow-compaction-check.mjs`로 관리.
- **v50.87 코드리뷰 버그수정**: `aio:marketStateUpdated` `window`/`document` 불일치 + `.page-active`→`.page.active` 이중 버그(다이어그램 재렌더 완전 불동작 수정). AI 채팅 SVG를 DOMPurify.sanitize(SVG profile)로 XSS 방어. `CHAT_CONTEXTS['kr-home']` 신설(v50.85 약속 이행). M7 카운트 `d.pct||0` R15 위반 수정. CHANGELOG 순서 정렬(v50.87→v50.86→v50.85→v50.84→v50.83). R3 BUG-POSTMORTEM P510/P511 추가.
- **v50.86 구조 통합 보강**: `_aioFoldDensePageControls` screener 결함 수정(vis-screener 다이어그램 접기 버그 제거, 텍스트 IC만 접기). market-news textContent 매칭 → `#news-source-guide` ID 기반 전환. `_buildSectors()` 추가 — portfolio × SCREENER_DB × liveData 섹터 비중 계산. vis-portfolio 플레이스홀더 + VIS_PAGES 확장으로 portfolio 섹터 버블 자동 렌더.
- **v50.85 Phase 4+5: vis 위치 통합 + Action Hub**: `.aio-vis-card` CSS를 cyan border-left+그라디언트 네이티브 스타일로 교체. vis-* 패널을 각 페이지 네이티브 섹션 내부로 이동 — HOME→배너, SIGNAL→대시보드 헤더, BREADTH→4-col KPI 병합, SENTIMENT/TECHNICAL→헤더 인라인, MACRO→스토리라인 카드, FXBOND→Cross-Asset 매트릭스, SCREENER→통합 검증 패널.
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

**R1. 버전 동기화**: title · badge · APP_VERSION · version.json · sw.js SW_VERSION · root/context docs · CHANGELOG.md · JS cachebusters — **반드시 `node scripts/bump-version.mjs <버전>`으로 일괄 패치** (v51.64~)
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
