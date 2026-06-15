# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v50.54**
- **전체 버전 이력 → `CHANGELOG.md`** (상세 변경 이력의 단일 출처). 아래는 **최근 5개 버전 요약만** 유지한다 (WO-12 문서 다이어트 — 루트 CLAUDE.md는 매 세션 로드되므로 슬림 유지. 이전 요약은 CHANGELOG.md에 더 상세히 보존됨).
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
