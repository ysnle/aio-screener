# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v50.51**
- **전체 버전 이력 → `CHANGELOG.md`** (상세 변경 이력의 단일 출처). 아래는 **최근 5개 버전 요약만** 유지한다 (WO-12 문서 다이어트 — 루트 CLAUDE.md는 매 세션 로드되므로 슬림 유지. 이전 요약은 CHANGELOG.md에 더 상세히 보존됨).
- **v50.51 DEFERRED-BLOCKS §3 Priority A 전체 + B 착수 — stale-day 단일화·breadth 차트 통합·marketState 구독 완결·문서 다이어트**: 사용자 "보고서대로 작업". **A1** `_aioStaleDays`/`_aioStaleDaysLabel`(aio-core) 단일 헬퍼(base·now 로컬-일 정규화로 UTC/로컬 off-by-one 제거) — 실제 충돌은 **data-snap-date writer 2개**(aio-core:17734 'N일 경과' UTC parse vs index.html:21092 'D+N일' local parse)가 같은 `#KEY-stale-days` span 경쟁 기재(보고서의 2086/2148은 시나리오 writer였음 — 정정). 양 핸들러+LIFECYCLE getStatus+시나리오 2곳 단일 카운터 라우팅 + KR 4카드(deposit/52w-high/52w-low/advance) stale span 추가. **A2** SECTION 5-B(`bh-*` 히스토리 4캔버스) 제거 — `bp-*`(SECTION 5)가 동일 5/20/50 시장폭+S&P·나스닥 듀얼라인을 일별 전체사이클+라이브 override로 표시(중복), `initBreadthCharts`/`_refreshBreadthHistoryCharts` retired, 8→4 캔버스, 제목/aria 정직화. **A3** `aio:marketStateUpdated` 리스너(aio-core:3002)에 `renderDynamicMarketNarratives`+`generateMacroStoryline` 추가(idempotent·선순환 전파 완결, 채팅 헤더는 on-demand라 불요). **WO-12** 루트 CLAUDE.md 227→~75줄(최근 5버전+포인터)·`_context/CLAUDE.md` 209→~95줄+버전 정정(CHANGELOG.md 단일 이력 출처, 중복 archive 미신설). **WO-14** 게이트 블록 분류 착수 — 45 evidence 블록=100% `kind:live`(환경의존, 운영서 해소)·트레이딩 0·텍스트 signal 3→0/fxbond 1→0(reference archive+staleDate 오탐 시정)/themes 0, `GATE-BASELINE §6` 기록("67블록"은 대부분 환경 live임을 실증). **WO-13** critical-10 4함수 dead 아님(별개 lens·반환 shape 상이·테스트 T724~736 핀·RULES 의무·`buildEvidenceStore` 엔진 공유)·진짜 중복은 v50.44 해소(`_deadV49112`)·추가 thin-wrapper 병합은 계약 파손 위험 대비 이득 미미 → 보류. 라이브 검증: A1 span 단일포맷·A2 bp 5인스턴스/bh 제거·A3 sink 동기화·콘솔 JS 0. R1 7곳+캐시버스터 5곳.
- **v50.50 UX 1단계 — home 매매 판단 라벨 정합 (라이브 검증 기반)**: 사용자 "라이브 화면 보며 단계별 UX 작업". **라이브 페이지 직접 점검 결과**: 에이전트 정적 감사(PAGE-UX-AUDIT)의 "빈 껍데기/고장" ★항목 **대부분이 거짓 양성** — macro 스토리라인(실데이터 렌더)·온도계(61)·kr-themes(28카드)·kr-macro/kr-technical 모두 정상, options nav 이미 제거됨, sentiment/breadth verdict 렌더러 보유. **유일하게 실증된 진짜 모순 시정**: home "지금 매매해도 될까?" 카드가 YES/CAUTION/NO(`>70/>50`)라 같은 62점이 결론바/범례 "선별매수"(60-75)와 **모순**('CAUTION') → 카드를 결론바·범례와 **동일 5밴드**(75 적극매수/60 매수우호/45 중립/30 주의/30↓위험)로 정렬(aio-data.js refreshHomeDashboard). 62→"매수 우호" 일관. 회귀 0. **정직**: 남은 UX는 버그 아닌 주관적 밀도(긴 페이지=충실 콘텐츠) — 사용자 지목 시 선별 진행. R1 7곳+캐시버스터 5곳.
- **v50.49 LLM 모델 정책 정렬(Opus 금지·Haiku 기본·필요시 Sonnet)**: 사용자 "Opus는 비싸니 금지, AI 채팅처럼 Haiku 기본+필요시 Sonnet. 남은 작업 후 UX 진행". `fetch-data.mjs genMarketAnalysis`: AI 채팅(`LLM_MODELS`)과 동일 철학 — **Haiku 4.5 기본, '필요할 때만' Sonnet 4.6 승격**(VIX≥25·지정학/위기 뉴스 헤드라인·`LLM_MARKET_ANALYSIS_MODEL=sonnet` 강제). **Opus 미사용**. 승격 사유 콘솔 로깅. 키 없으면 스킵(템플릿 폴백). **정직 보류**: (1) sink 확산 — breadth 랠리품질(`#rally-quality-verdict`)·sentiment 복합판단(`#sent-analysis-text`)은 **이미 도메인 렌더러 보유**(aio-ui.js:754·`_generateSentimentAnalysis`) → 일반 분석 sink가 덮어써 부적절, 추가 안 함. (2) KR stale 라벨 일반화 — 라이브 확인 결과 stale-days 경로가 **2개 공존**(aio-core.js:2086/2148 STATIC_CONTENT_LIFECYCLE 'N일 경과' vs index.html:21089 data-snap-date 'D+N일', 서로 다른 기준일) → 무리한 3번째 writer 대신 **두 경로 통합이 선결**(별도 정리). 회귀 0. **다음**: 페이지 UX 조사(`PAGE-UX-AUDIT-2026-06-13.md`) 시정. R1 7곳+캐시버스터 5곳.
- **v50.48 자율 운영 순환 Phase 4 (완결) — 서버 LLM 선택 강화 + 루프 5단계 audit**: 자율 루프 마스터플랜(Phase 1~4) 마무리. **(1) `scripts/fetch-data.mjs` `genMarketAnalysis(data)`** — 운영자 `ANTHROPIC_API_KEY` Secret 있을 때만 cron에서 **Claude Haiku 4.5**로 시장 분석문 생성(raw fetch·SDK 의존성 미추가·20s 타임아웃·best-effort) → `data.json.marketAnalysis` + `meta.marketAnalysisOk`. **키 없으면 스킵**(클라 템플릿 폴백·100% 동작). **(2)** `_aioLoadServerData`가 `data.marketAnalysis` → `window._serverMarketAnalysis` 로드 → `_aioRenderMarketAnalysisSinks`가 **서버 LLM 분석문을 템플릿보다 우선** 사용(소스 라벨 `server-llm`). **(3) `AIO.getAutonomousLoopAudit()`** 신규 — ingest(서버데이터/뉴스)→signal(`_aioComputeNewsSignal`)→brain(marketState 흡수+정규화)→text(`synthesizeMarketAnalysis`)→reflect(sink 채움) **5단계 연결 자동 검증**(끊긴 고리 감지) + `getAutoOpsReadiness` 통합(fail 시 issue). T821. 회귀 0. **자율 운영 순환 완성**: 데이터·뉴스 수집 → 신호 → 단일 두뇌 → 텍스트 합성 → 화면 반영 → (갱신 시 재순환). R1 7곳+캐시버스터 5곳.
- **v50.47 자율 운영 순환 Phase 3 — 텍스트 합성 엔진(빈 '현재 분석' 섹션 자동 채움)**: 페이지 UX 전수조사 **★★★ P1='수신/산출 대기 빈 껍데기 도처'**(home 결론·breadth·sentiment·macro·kr-* 등 영구 placeholder)의 근본 해결 + **자체 운영의 가시적 산출**. **`AIO.synthesizeMarketAnalysis()`** 신규 — 단일 두뇌(marketState)+newsSignal 수치를 사람이 읽는 한국어 분석 산문으로 변환(템플릿·무료·결정론적): ①레짐(변동성+심리) ②사이클+시장폭 ③종합 리스크 ④주도 뉴스/감성 ⑤대응 한 줄 + `oneLine` 요약. **`_aioRenderMarketAnalysisSinks()`**가 `[data-market-analysis-sink]` 요소(**계약**)를 자동 채움 — 페이지가 attr만 달면 채워짐(확장 가능). 서버 LLM 분석문(`window._serverMarketAnalysis`, Phase 4) 있으면 우선, 없으면 템플릿 폴백. home에 flagship **'🧠 현재 시장 분석'** 섹션(`data-market-analysis-sink="full"`, 결론바 직후) 추가 — 항상 채워짐. `aio:marketStateUpdated`/`serverDataLoaded`/`newsUpdated`/부팅 구독 자동 재생성. T820. **정직 보류(차기)**: Phase 4(서버 LLM 선택 강화 + `getAutonomousLoopAudit`)·다른 빈 섹션(breadth/sentiment/kr-*)에 sink attr 확산. R1 7곳+캐시버스터 5곳.
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
