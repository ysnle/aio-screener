# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v49.11**
- 메인 파일: `index.html` (29,926줄, 인라인 onclick 0건) + `js/` 6개 모듈 (aio-core 7,806 · aio-data 11,525 · aio-ui 2,751 · aio-chat 4,592 · aio-tests 1,246 · aio-glossary 304 ≈ 28,224줄)
- **v48.32~35 마일스톤**: onclick 인라인 핸들러 253건 → 0건 (Event Delegation + data-action)
- **v48.36~39 마일스톤**: 구조적 동적 전환 — DATE_ENGINE · _lastFetch · _aioFeedHealth · AIO_Cache 통일 · SCREENER_DB memo staleness 파서 · 신선도 UI 패널
- **v48.47~v48.60 마일스톤**: DOM 재분배 · LIVE_SYMBOLS +13 · CHAT_CONTEXTS themes/theme-detail · AI 채팅 FMP 심층 · 5중 소스 체인 · 어닝 EH 스타일 · 리스크 레이더 · Phase 감사 + 수정
- **v48.61 마일스톤**: 근본 수정 15 Phase — CSS surface 자기순환 해소 · Canvas var 10건 → hex · P125 7번째 재발 해소 · JS 인라인 폰트/rgba/on* 전수 정리 · R39~R48 10개 규칙 실체화 · Hook 9 Layer 실체화 · /integrate 20자료 · /data-refresh GPU/DRAM/NAND 최신화
- **v48.82 마일스톤**: `AIO.getDataPipelineAudit()` 추가 — API/소스, proxy/cache, scheduler, Price/Macro/News/DataHealth, 분석 함수, DOM/차트 렌더 sink를 한 번에 점검
- **v48.83 마일스톤**: 사용자 제공 4개 시장 자료 통합 — melt-up 강세장 조건, 생산성-인플레 트리거, Fed 반응 함수, Nebius/Eigen AI 추론 최적화 레이어, 관세/Fed 대차대조표 논쟁을 전체 AI 채팅 공통 컨텍스트에 주입
- **v48.85 마일스톤**: 함수·데이터 정합성 심층 QA 보강 — PriceStore/Yahoo/Naver/Stooq/FX/동적조회/포트폴리오 경로의 등락률 결측을 `null + pctMissing`으로 통일, KR health와 benchmark/sector chart 기준가 guard 보강, render sink 비대칭 감사 추가
- **v48.88~90 마일스톤**: finance·data 플러그인 — 포트폴리오 리스크(VaR/Sharpe/MDD/상관계수) · 다기간 재무표 · 실적 분산 분석(EPS Beat·Chart.js)
- **v48.91 마일스톤**: Engineering 1차 — `_safeSetHTML` DOMPurify 게이트웨이 · `_aioRegisterTimer` 타이머 레지스트리 · setInterval 13건 마이그레이션 · XSS 수정 4건(citations URL·fund desc·SEC 데이터). engineering:code-review+tech-debt 방법론
- **v48.92 마일스톤**: Design 1차 — `--text-muted` WCAG AA 수정(3.1:1→4.6:1) · 폰트 스케일 +1px(xs:10→12, sm:11→13, base:12→14, md:13→15) · lh-tight 1.15→1.4 · Fund Analysis 3탭(개요/재무상세/외부정보) · `AIO.getColorContrastAudit()` · 모바일 브레이크포인트. frontend-design 방법론
- **v48.93 마일스톤**: Engineering 2차 — `js/aio-tests.js` 신규(60건 단위 테스트) · `AIO.runTests()` / `AIO.getTestResults()` · 통계 함수 8개 × 9그룹 커버리지 · 엣지케이스 16건. engineering:testing-strategy 방법론
- **v48.94 마일스톤**: Security & Resilience — `_aioSafeMD` DOMPurify 2차 게이트(P158) · `_fundDepth` 재귀 가드(P160) · Naver `Promise.allSettled`(P159) · `_aioSafeParseJSON` · `_aioRenderNum` NaN→'—'(P161) · 테스트 T61~T66(66건)
- **v48.95 마일스톤**: Numerical Accuracy — VaR `_quantileR7` R7 선형보간(P162) · Pearson EPS 1e-12(P163) · Sharpe near-zero(P164) · `_wordHit` 한국어 단어경계(P165) · 2027 휴장일 · EOD grace `lastKrTradingDayEx`(P166) · 테스트 T67~T74(74건)
- **v48.96 마일스톤**: Chart Robustness — `_aioChartRegistry` 중앙 관리(P167) · `_aioSetupCanvas` DPR(P168) · Fund탭 resize(P169) · `_aioModalTrap` ESC/Tab(P170) · 포트폴리오 테이블 th/td headers · print canvas 배경 · 한글 폰트 fallback · 테스트 T75~T79(79건)
- **v48.97 마일스톤**: Infrastructure — `_aioProxyChain` CB+폴백(P171) · `_aioRetry` 지수백오프(P172) · `_aioRedactPII` IDB PII 마스킹(P173) · `_aioMaskKey/getApiKey/setApiKey`(P174) · `AIO.diag.proxyHealth/retryStats/lastNaverHealth` · 테스트 T80~T83(83건)
- **v48.98 마일스톤**: Function Audit Infrastructure — `_aioPageBus` 단일 라우팅 허브(P175) · `_aioOnce`+`_aioGlobalRegistry` 멱등 가드(P176) · `_aioFiniteNum`+`_aioSafeDiv`(P177) · 테스트 T84~T88(88건)
- **v48.99 마일스톤**: Listener Hygiene — `aio:pageShown` 17건+`aio:liveQuotes` 18건 `_aioPageBus` 마이그(P178~P180) · aio-core 9건+aio-data 4건+index.html 22건 · 테스트 T89~T92(92건)
- **v49.0 마일스톤**: Critical Function Fortification — `applyDataSnapshot` 키별 try-catch(P181) · `_aioLRU`+scoreItem/tickerRegex 캐시 cap(P182) · Fund Valuation Infinity 가드(P183) · 테스트 T93~T97(97건)
- **v49.3 마일스톤**: Architecture Reinforcement — DataQuality · NewsImpactVector · AIInfraHeat · PortfolioTechnicalRisk(P190) · OHLCV quality bundle · technical brief data confidence · T108~T115 tests
- **v49.11 마일스톤**: Auto-Ops Static Data Governance — `AIO.getStaticDataGovernanceAudit()` · `AIO.getAutoOpsReadiness()` · `AIO.forceRefreshAllData()` · T146~T151 tests(P200)
- **v49.10 마일스톤**: Blow-off Top / Event Exhaustion integration — CPI-confirmed context · H2 liquidity regime guardrail · Aether Telegram pipeline audit · T144~T145 tests(P199)
- **v49.9 마일스톤**: Live Site QA Cleanup — mobile watchlist control fit · ticker navigation event delegation · T143 runtime onclick regression test(P198)
- **v49.8 마일스톤**: Live Site Freshness Guardrail — HOME stale-event filter · 2026-05-13 fallback snapshot · T141~T142 freshness tests(P197)
- **v49.7 마일스톤**: Page Focus Brief UX — 페이지별 목적 · 3단계 활용 루틴 · 관련 페이지 동선 · 상세 해설 라벨 간소화(P194)
- **v49.6 마일스톤**: Full Static Fallback Data Refresh — US/KR 지수 · FX/DXY · oil · Cboe put-call · CNN/AAII sentiment fallback seed 최신화(P193)
- **v49.5 마일스톤**: Lockout Rally / OPEX Strategy Engine — 20MA ATR/ADR extension · terminal candle risk · OPEX gamma decay · IWM/RSP/KRE/XBI breadth rotation · final action ladder(P192) · T125~T132 tests
- **v49.4 마일스톤**: Data Freshness Governance — FRESHNESS_POLICY · SnapshotStore · auditAllFreshness(P191) · scheduler telemetry · static fallback WebSearch refresh · T116~T124 tests
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
