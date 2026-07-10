# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v52.50**
- **전체 버전 이력 → CHANGELOG.md** (상세 변경 이력의 단일 출처). 아래는 **최근 버전 요약만** 유지한다.
- **v52.7~v52.15 FABLE-LIVE-AUDIT-2026-07-04.md P2~P6 전체 완료(P604~P616)**: P0/P1(v52.5/52.6)에 이어 감사 백로그 마저 처리. **P5a**(P604/R279): 매크로 캘린더 auto-advance가 요일-고정 발표일(NFP)을 불가능한 요일로 미는 버그 — `_firstWeekdayOfMonth` 스냅 추가. **P5b**(P605/R280): VKOSPI 27.00 고정 표시의 진짜 원인은 시드 stale이 아니라 `fetchKrDynamicData`가 index.html/aio-data.js에 중복 선언돼 defer 로드 순서상 후자가 항상 이겨 VKOSPI 실시간 fetch가 영구 미실행이었던 것 — 최소 범위로 해당 fetch만 복구(다른 5개 orphan 함수는 미검증 상태로 범위 밖 유지). **P5c**(P606, R276 사례): themes 사이클 칩-본문 모순 — 동일 소스 구독 전환. **P5d**(P607, R261 사례): briefing/signal F&G phantom global(`_fearGreedValue`) → `_lastFG`. **P5e**(P608): briefing 헤더 단어 중간 잘림 — 단어경계+'…' 헬퍼. **P2**(P609): "30분마다" tooltip을 실제 cron 실발화(1~4h) 기준으로 정정. **P3**(P610, 사용자 명시 요청으로 재개): kr-technical TradingView KRX 하드 브레이크 — Naver 일봉+Chart.js 자체 캔들/거래량/MA20으로 완전 대체(신규 CDN 없음). **P6**(P611~616): PUBLIC STATUS 영문 로그 노출(R206 사례)·`:focus-visible` 오검출·AI 패널 공백+프롬프트 잔류·운영자 노트 경과일 배지·모바일 버튼 잘림 기계적 수정 5건 + 홈 경고 pill 11개 연속→1줄요약+펼치기(`<details>` 재사용, 사용자가 3안 중 확정) 1건. Telegram 페이지간 중복·FMP다운 컬럼 UX는 사용자가 현행 유지로 확정(코드 변경 없음). 전 항목 헤드리스 899/922(스킵리스트 T278/T422 해소로 제거) 확인, **단 Chrome 확장 미연결로 이번 세션 UI 변경 전체의 실브라우저 시각 확인은 QA-CHECKLIST 잔여 항목**.
- v52.6 이하 전체 버전 이력(P0/P1 뉴스번역·CI워크플로 수정, Phase 0~3 로드맵 진행 상세 포함) → `CHANGELOG.md`
- **v52.24~v52.26 FABLE-LIVE-AUDIT-2026-07-07.md Phase L0~L4 전체 실행(P634~P641)**: 감사 작성 직후 같은 세션에서 즉시 착수해 L0~L4 전 항목 완료. **C3**(P634/신규 R282): VIX 기간구조가 live VIX를 정체 시드 VIX9D(18.80)와 비교해 실제 콘탱고를 패닉 백워데이션으로 오판정 — live 소스일 때만 방향 판정하게 게이트. **C4**(P635): VKOSPI 폴백 시드에 단정 "(정상)" 라벨 — "(폴백·정상 추정)"으로 정직화. **C5**(P636): Yahoo `^KS11` 전일종가가 미국 휴장 인접 주간에 한 세션 어긋나던 문제 — Naver 파생값을 sticky 우선. **C2**(P637): 번역 실패 시 일반 템플릿 대신 `freeTranslateNews`(Google Translate) 경유로 실제 헤드라인 확보. **C1**(P638): 배포 워커가 리포의 `/anthropic` 라우트보다 구버전임을 확정 → **같은 날 운영자가 Worker 재배포+`ANTHROPIC_API_KEY` 시크릿 추가로 완전 해소**(curl+라이브 브리핑 실렌더로 확인; `DEFERRED-BLOCKS.md` B5도 해소 처리). **C6 분석**: TruthGate 코드 정독 결과 "동행 급변 예외" 신설 불필요로 결론(기존 로직 타당, 오탐 원인은 C5). **L3-1/L2-3 재확인**: R280 게이트+KR 고아 함수 5개 정리는 **이미 v52.19(P626)에서 완료**돼 있었음을 발견(감사 문서 §5 우선순위표가 그 시점엔 낡은 정보였음 — 자기 정정). **L3-2**(P639): 티커 "시장 74점" vs 시그널 "56" 라벨 모순 — 로직은 타당했고 라벨만 "시장 건강도"로 명확화. **F3**(P640): kr-technical 설명문 TradingView 잔여 문구 정정. **L4-2**(P641): VKOSPI 미니차트가 "공유 확장 헬퍼" 때문이라고 봤던 중간 추정을 정정 — 실제로는 v50.15부터 굳어있던 하드코딩 20포인트 배열이었고 서버 history.json엔 vkospi 필드 자체가 없었음. 서버 크론 대신 클라이언트 localStorage 누적으로 안전하게 수정, 로컬 정적서버로 배포 전 실브라우저 검증(캔버스 픽셀 직접 판독 포함) 완료. 검증: 로컬 8게이트+헤드리스 922/922(전 배치 공통). 상세: `_context/FABLE-LIVE-AUDIT-2026-07-07.md` §6.
- **2026-07-08 UI/UX 심층 라이브 감사 완료 (코드 무변경 — 감사+설계만)**: QA-CHECKLIST "(미확인)" 백로그 + P634~P641을 라이브 v52.26에서 일괄 검증(다수 ✅, P626/P605 라이브 ❌=프록시 차단, P629/390px ⛔) + 기존 감사의 미점검 표면 6곳 커버. **신규 발견 UX-01~13**: showThemeDetail 크래시(테마 2개 진입 사망, P0)·theme-detail 고아 라우트(이중 표면)·프록시 SPOF(KR 수급/VKOSPI/VIX9D 공통 원인)·AI 채팅만 클라 키 요구(백엔드 이원화)·briefing F&G 이중값(31vs45)·kr-technical y축 0기준 압축·aria-live 132개 과잉 등. 상세: `_context/FABLE-UIUX-DEEP-AUDIT-2026-07-08.md`.
- **v52.39 (2026-07-10, 로컬 완료·미배포)**: FABLE-EDU-OVERHAUL-DESIGN §6 구현 완료 — `AIO_PAGE_FUNDAMENTALS` 20페이지 교육 레이어(P654/R291/T869), 구현 중 초기 로드 순서 버그(initFromHash가 훅 등록보다 먼저 발화 → 첫 화면 교육 블록 누락) 발견·수정 포함. 게이트: 로컬 9종+viewport 88/88+헤드리스 932/932 green, 실브라우저 4페이지 확인.
- **v52.40~v52.43 (2026-07-10)**: `_context/FABLE-EFFICACY-AUDIT-2026-07-10.md` §5 Batch 1~4 전체 구현 완료(P655~658) — EF-01~19 대부분 해소(일부는 재검증 결과 원 진단과 다른 실제 원인이거나 미재현으로 판명, 상세는 각 P번호·CHANGELOG 참조). 부수 발견 EF-20(Worker `/anthropic` anycast 403)은 근본원인만 확정하고 완화책은 보류했었음(아래 v52.44 참조). 배포 완료(origin main, live version.json 확인).
- **v52.44 (2026-07-10, 로컬 완료·미배포)**: DEFERRED-BLOCKS B8 완화책 구현(P659/R292) — Worker `/anthropic` 간헐적 403(Cloudflare anycast가 홍콩 리전을 태우면 Anthropic이 정책상 거부, curl로 확정)에 대해 `_aioFetchClaudeWithRetry()` 공유 헬퍼 신설(서버키+403+forbidden 포맷일 때만 최대 2회 재시도) 후 채팅뿐 아니라 동일 근본원인에 노출된 번역·브리핑까지 3개 함수 4개 호출부 전체 적용. 근본원인(Cloudflare 리전 미고정) 자체는 여전히 코드로 해결 불가 — 완화이지 완전 해결 아님. 게이트: 로컬 9종 중 8종 PASS(`ci-knowledge-lint-check`는 무관한 기존 미커밋 상태로 실패, 범위 밖)+헤드리스 952/952 green.
- **v52.45 (2026-07-10, 로컬 완료·미배포)**: `_context/CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md` WO-0 구현(P660/R293) — `data-watchdog.yml` YAML 파손(U+0080 mojibake, PyYAML 파싱 실패로 워치독 자체가 죽어있던 상태) 복구 + 재발방지 게이트(`ci-control-char-check.mjs`) 신설. 같은 작업 중 저장소 전체를 스캔해 CHANGELOG.md·BUG-POSTMORTEM.md·eval-guide.md에 동일 계열의 대규모 기존 mojibake(9,639건)를 추가로 발견 — 사용자 확인 후 git 히스토리 diff로 안전 복구 가능한 7,486건(78%)을 복구, 나머지 2,153건(히스토리에 원본이 없어 diff 복구 불가)은 baseline으로 기록해 회귀만 차단.
- **v52.46 (2026-07-10, 로컬 완료·미배포)**: WO-1A 구현(P661/R294) — 포트폴리오 "PIN 설정 후 AES-256 암호화" UI 주장이 거짓이었던 것(순수 평문 localStorage+평문 PIN 비교)을 사용자 선택("실제 암호화 구현")에 따라 기존 API 키용 `_AioVault`로 통합. 부수 발견: 잠금 게이트 `checkPortfolioPin()`이 호출부 0건 고아 함수라 PIN 설정해도 잠금화면이 뜬 적이 없었음(암호화와 별개 버그). Playwright 실측 17/17 PASS.
- **v52.47 (2026-07-10, 로컬 완료·미배포)**: WO-1B 구현(P662/R295) — 공유 Anthropic 프록시(`/anthropic`)가 일반 프록시 방어(bot-UA·rate limit·도메인 allowlist)를 전부 우회하고 호출자 인증·Origin 강제도 없었으며 KV 미바인딩 시 일일 캡이 조용히 무제한이었음을 확인. 사용자 선택("계층형 경량 강화" + "Fail-closed")에 따라 kill switch·서버측 Origin 강제·선택적 앱 토큰·전용 레이트리밋(20/분)·KV fail-closed(503)·body 상한(200KB) 구현. Node에서 Worker 핸들러를 직접 호출하는 실동작 테스트 13/13 PASS(`scripts/ci-worker-anthropic-check.mjs` 신규 영구 게이트).
- **v52.48 (2026-07-10)**: WO-5 구현(P663/R296) — main 브랜치 무보호 확인 후 사용자 승인으로 `gh api`를 통해 **실제 GitHub 설정 변경**(force-push+삭제 차단만, PR/상태체크 요구 없음 — 봇 직접 push 워크플로 보존). `.codex/hooks.json`이 존재하지 않는 OneDrive 절대경로를 가리켜 6개 훅 전부가 조용히 무력화돼 있던 것을 발견·상대경로로 전환. 신규 `SessionStart` 훅으로 세션 시작 시점 git 상태를 스냅샷해 `auto-commit-on-stop.sh`가 세션과 무관한 사전 dirty 파일을 더 이상 쓸어담지 않게 재설계(이번 세션에서 실제로 재현된 문제였음). 버전 동기화 훅의 자릿수 고정 정규식 버그도 수정.
- **v52.49 (2026-07-10, 배포 완료)**: WO-6 핵심 슬라이스 구현(P664/R297) — `computeTradingScore()`가 계산해 반환하던 `evidenceAudit`(7개 입력 evidence 상태)를 repo 전체에서 아무도 읽지 않고 있었고, 등록된 7개 입력도 실제 사용 중인 13개 중 6개(VVIX/F&G/breadth200/PCR/HY스프레드/AAII)가 빠져 있었음을 발견. 6개 입력을 evidence 레지스트리에 추가(AAII는 실시간 경로가 없어 `decisionUse:'reference'`로 정직 표시), 화면에 실제 렌더링되는 별도 provenance 시스템(`_aioDefaultDecision`)이 스코어의 evidenceAudit을 결측 개수 기반으로 반영(제한적 병합: 0→무변화/1-2→DELAYED/3+→SNAPSHOT)하도록 연결해 "화면과 score가 다른 provenance"였던 구조를 통합. Codex 원문의 "모든 값" 전면 리트로핏은 단일 세션 범위 밖으로 판단해 `DEFERRED-BLOCKS.md` B9로 명시 이관(외부 블록 아닌 엔지니어링 규모 문제). 게이트: 로컬 7종 PASS+헤드리스 963/963 green.
- **v52.50 (2026-07-10, 배포 완료)**: WO-2 축소 검증(P665/R298) — WO-2 완료 게이트("최소 수년·다중 regime" 등)를 문자 그대로 만족하는 건 `history.json`이 약 7개월치뿐이라 불가능함을 확인 → 사용자 확인(AskUserQuestion) 후 "축소 검증"으로 진행: computeTradingScore의 13개 입력 중 자유 소스로 10년치를 구할 수 있는 7개(SPX/VIX/VVIX/TNX/DXY/WTI/HYG — vol+trend+macro, 가중치 55%)만 Yahoo Finance 공개 API로 실제 fetch해 신규 `scripts/backtest-trading-score-longrun.mjs`로 재구성·검증. **결과**: 21일 forward에서 rho=-0.165(95% CI [-0.203,-0.127], n=2492), 63일에서 rho=-0.255(CI [-0.291,-0.217]) — 통계적으로 유의미한 **음의** 상관, walk-forward(2016-23 vs 2023-26)로 나눠도 부호 일관. 유력 가설: `dxy>107`/`tnx>4.5` 같은 절대 임계값이 10년간의 금리 레짐 구조적 이동에 대응하지 못함(R298). **이 발견으로 라이브 스코어/조언 문구를 코드로 변경하지 않음** — 55%만 검증된 부분 결과라 "전체 스코어 반대 작동"이 아니며, 라벨 완화 여부는 별도 제품 결정 사항으로 남겨 사용자에게 보고. 게이트: 로컬 7종 PASS+헤드리스 963/963 green(신규 스크립트는 cron 미배선, 프로덕션 하네스 회귀 없음 diff로 확인).

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

## 절대 규칙 (R1~R3만 — 나머지 R4~R263+는 `_context/RULES.md`)

**R1. 버전 동기화**: title · badge · APP_VERSION · version.json · sw.js SW_VERSION · root/context docs · CHANGELOG.md · JS cachebusters — **반드시 `node scripts/bump-version.mjs <버전>`으로 일괄 패치** (v51.64~)
**R2. 버전 체계**: `v{major}.{patch}` 숫자 단조 증가 (예: v48.76 → v48.77). 최신 실제 체계는 두 자리 patch 허용.
**R3. 버그 수정 시 사후 분석**: `_context/BUG-POSTMORTEM.md`에 P번호 기록
**R27. Commands↔Skills 동기화**: 새 스킬 시 command wrapper 동시 생성

---

## 작업 규칙

- **자동 배포/커밋 금지** — `/deploy` 또는 "배포해줘" 명시 시에만
- **전체 재작성 금지** — CODE-MAP.md 기반 부분 패치만
- **코드 수정 시 자동 반영**: BUG-POSTMORTEM + QA-CHECKLIST + RULES + 버전 7곳 동기화

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
