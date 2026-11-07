# 커버리지 감사 — 2026-11-04 (읽기 전용)

대상: main `1da80799`(v59.69). 네 세션(actions-reliability · data-refactor · theme-sector · ui-states)의 배정 범위(오케스트레이터 브리프)와 각 worktree의 실제 변경 파일(`git diff main...<branch>`, `git -C <worktree> status`, 11/04 10:2x KST)을 대조했다.
표기: **[확인]** 파일·명령으로 직접 본 것, **[추정]** 정황 판단. 우선순위는 소유자 원칙(단순함, 원천 없는 위젯·근거 없는 등급 제거, 화면 문구 최소, 섹션마다 시각 하나와 짧은 해석, 미국 중심) 기준.

## 0. 먼저 알아둘 어긋남

- **화면 수**: `src/ui/navigation/route-hubs.js:1,4-17`은 허브 **9개**(오늘 · 시장 상태 · 매크로 · 기술적 분석 · 테마와 섹터 · 스크리너 · 종목 · 포트폴리오 · 리서치 라이브러리)다. v59.64에 기술적 분석이 화면으로 분리됐다. `CLAUDE.md`, 오케스트레이터 브리프, `verify-aio` 스킬 설명은 아직 "8화면"이라고 쓴다 [확인]. 라우트는 20개(`architecture/route-owners.json` counts) [확인].
- **한국 화면**: kr-* 라우트는 퇴역했다. 한국 내용은 시장 상태의 한국 보드(`korea-participation`), `kr-index-trend`, `kr-theme-progressive`, `krw-read`, 그리고 부팅 때 늘 받는 `js/aio-kr-data.js`(95 KB) 안에 흩어져 있다 [확인].

## 1. 영역 표

담당: AR = actions-reliability, DR = data-refactor, TS = theme-sector, UI = ui-states. "부분"은 범위의 일부만 맡았다는 뜻.

### 1-1. 화면 (9 허브 · 20 라우트)

| # | 영역 | 담당 | 개편 필요 근거 | 우선 |
|---|---|---|---|---|
| S1 | 오늘 › 요약(home): 판정 히어로, 지수 줄, VIX, KPI 추세, 첫 페인트 판정 | 부분(DR 판정 표 행, UI 상태) | narrativeOwner가 여전히 legacy(route-owners home) [확인]. 첫 페인트 인라인 스크립트(index.html:3874)와 native가 같은 칸을 씀 — 현재 문제 없음 | 하 |
| S2 | 오늘 › 브리핑(briefing): 24시간 이야기, 반응 읽기, 실적 띠 | 부분(UI 상태) | reaction-read.js 제어문자 결함은 세 브랜치가 모두 고침(§3). 브리핑 본문 구조 개편은 담당 없음. 검증 대기 QA-DATA-65A(11/05) [확인] | 하 |
| S3 | 오늘 › 뉴스(market-news): 필터, 주제 표시, 진행 막대 | 없음 | news.js 59 KB에 섹션 프레임 0, 시각 0(정규식 집계) [확인]. 같은 사건 중복은 P1601 정책상 유지 | 하 |
| S4 | 시장 상태 › 개요(signal): 국면 판정, 레이더, 판정 표 | DR(R8 입력 빌더, 판정 표 심리·AI 행) | DR이 진행 중 | — |
| S5 | 시장 상태 › 시장 폭(breadth) | DR(R9 breadthCounts) · UI(breadth-board 상태) | 두 세션이 같은 화면을 다른 층에서 고침 → §3 | — |
| S6 | 시장 상태 › 투자 심리(sentiment): 풋/콜, AAII, VIX | AR(putCall Cboe) · DR(R12 MOVE/SKEW/VIX9D) | 진행 중 | — |
| S7 | 시장 상태 › 한국 보드 | 부분(DR R6 투자자 매매동향) | **한국 금리·CD91·국고채·PMI·GDP·PPI·실업이 null 자리만 있음**(aio-core.js:13017-13022, 데이터 감사 §3) [확인-감사 인용]. 한국 CPI 수기 2.9, VKOSPI 없음. R6 밖이라 담당 없음 | 중 |
| S8 | 매크로 › 개요(macro): 여섯 장, 교차로, 다음 발표 | 부분(DR R7 수기 기준값) · UI(macro-board 상태) | `macro-crossroads.js:208` 접기 제목 "만기별 최근 입찰 결과와 읽는 법" — 소유자 11/04 '읽는 법' 제목 금지 위반 [확인] | 중 |
| S9 | 매크로 › 금리와 환율(fxbond) | 부분(DR) | 휴대폰 국채 곡선 10년 라벨이 실선과 가까움(HANDOFF-2 남은 것) [확인-핸드오프] | 하 |
| S10 | 기술적 분석(charts): 시총 상위 10, 그날 움직인 종목 | 없음(UI가 charts.js 상태만) | 신설 화면인데 **AI 패널 문맥 없음**(S20), **verify-aio feature 없음**(`.claude/skills/verify-aio/features/`에 charts.md 없음) [확인]. QA-DATA-64A 대기 | 중 |
| S11 | 테마와 섹터 · 테마 상세 | TS | 진행 중 | — |
| S12 | 스크리너: 필터, 정렬, 워크벤치, 순위 밖 접기, 검증 패널 | 부분(DR R10 검증 게이트) · UI(상태 문구) | screener.js 296 KB·import 43 — 단일 파일 최대 [확인]. 필터·정렬 UX와 화면 구성은 담당 없음. '순서' 열 결정은 유지로 닫힘(HANDOFF-2 배치 4) | 중 |
| S13 | 종목 › 개요(ticker): 히어로, 렌즈 카드, 기업 이야기 | 부분(UI stock-read 상태) | narrativeOwner legacy [확인]. `stock-lens-cards.js:217` 카드 제목 '읽는 법' [확인] | 중 |
| S14 | 종목 › 차트(technical): lightweight-charts, 그리기, 전략, 비교 | 없음 | stock-chart.js 오류 안내에 '확인하세요' 문구(:343) — UI 범위로 흡수 가능 [확인] | 하 |
| S15 | 종목 › 재무 공시(fundamental): SEC, DuPont·역 DCF 접기 | 없음 | `fiscal-read.js:178` 제목 '금융사 읽는 법' [확인]. narrativeOwner legacy | 중 |
| S16 | 포트폴리오: Vault(AES), 거래 일지, 스트레스, 노출, 백테스트 | 없음 | **chartOwner가 유일하게 legacy**(route-owners counts: chartNative 14 중 portfolio 없음) [확인]. 패널 7개(portfolio-*.js 합 약 46 KB) | 중 |
| S17 | 리서치 › 개념·분석(principles) | 없음 | principles.js 94 KB, 긴 한글 리터럴 41개 [확인]. 지식 상태 `REFERENCE_PROGRESS_ONLY`, 176 단위 연구 필요(CURRENT-STATE) [확인] | 중 |
| S18 | 리서치 › 산업 지도(atlas) | 부분(UI 문구 1줄) | atlas.js 113 KB, 긴 한글 리터럴 128개 — 페이지 코드 안 산문 최다 [확인]. `atlas.js:464` 'AI 산업 지도 읽는 법' 제목 [확인] | 중 |
| S19 | 리서치 › 대가 보유 종목(masters) | 없음 | `masters.js:288` "먼저 … 보고, 다음으로 … 비교하세요" 교과서 문단(소유자 11/04 금지) [확인] | 중 |
| S20 | **AI 패널**(js/aio-chat.js 361 KB + ask-panel + chat-loader) | 없음(UI는 전송 버튼 aria-busy만) | ① 문맥 표(aio-chat.js:817-833)와 페이지 맵(:14-19)에 **`charts` 없음** — 기술적 분석 화면에서 맞는 분석가 문맥이 없다 [확인]. ② 질문 의도 라우팅(:3547)이 '차트'를 종목 차트(technical)로 보낸다. ③ 이동 라벨이 낡음: '거시와 금리 › 금리와 환율'(:3107, :3552), '거시와 금리(한국 섹션)'(:3557), '매매 시그널'(:3548), '퀀트 스크리너'(:3104) — 소유자가 ~10번 바로잡은 '매크로' 명칭과 화면 이름 불일치 [확인]. ④ 퇴역 라우트 키 `'kr-market'`(:19) [확인] | **상** |
| S21 | 용어집(aio-glossary.js 115 KB, term-marks, term-tooltip) | 없음 | 부팅 때 defer로 늘 받음(index.html:6137) [확인]. 결함은 못 찾음 | 하 |
| S22 | 도움말(guide) | UI(도움말 문구) | 진행 중 | — |
| S23 | 셸: 헤더, 사이드바, 허브 탭, 휴대폰 탭 막대, 단축키, 면책 배너 | UI(route-hubs, 토큰) | **전역 검색이 없다**: 검색창이 종목(index.html:5252)·스크리너(:5525)·도움말(:5796)·용어집(:6124) 네 개로 흩어짐 [확인]. 하나의 검색(종목·화면·용어)으로 모으면 Linear 수준 단순함에 맞는다 [추정·제안] | 중 |
| S24 | 모달·팝오버·접기 공통(shell-overlays, popover, deep-dive, section-frame) | UI(트랜지션·상태) | section-frame 사용이 charts·themes 두 페이지뿐(정규식 집계) — "섹션마다 시각 하나+짧은 해석" 틀이 공용 컴포넌트로 강제되지 않음 [확인-집계, 영향은 추정] | 하 |

### 1-2. 인프라

| # | 영역 | 담당 | 개편 필요 근거 | 우선 |
|---|---|---|---|---|
| I1 | Worker AI 경로·비용 상한(`cloudflare-worker-proxy.js`, `worker/openai-budget.mjs`) | 없음 | $20 상한·target 모드·예약/정산 모델 체크 갖춤(QA-FRICTION-02, QA-EDGE-03/08) [확인]. 7일 실패는 만료 키 1건(외부) | 하 |
| I2 | 서비스 워커(sw.js) · artifact-cache · refresh-scheduler | AR | 진행 중. DR R4 배포 제외와 프리캐시 목록 충돌 가능 → §3 | — |
| I3 | **성능: 첫 페인트·JS 바이트·DOM** | 없음 | `_artifacts/boot-interaction-report.json`(11/03 21:36Z, v59.69): **targetStatus TARGET_MISS** — decoded same-origin JS **3.85 MB > 1.5 MB**, active DOM 2,674 > 2,500, same-origin 스크립트 213개, long task 합 907 ms [확인]. `architecture/boot-budget.json`은 ESM 부팅 모듈만 잰다 — 부팅 때 받는 클래식 스크립트(aio-core 1.02 MB · aio-data 516 KB · aio-workspace 121 KB · aio-glossary 115 KB · aio-kr-data 95 KB · aio-pages 79 KB · aio-ui 85 KB, 합 약 2.0 MB raw)는 바이트 예산 밖 [확인]. SA-04는 요청 수만 셈 [확인] | **상** |
| I4 | 데이터 바이트(data.json·history.json) | 부분(TS R11 rotationHistory, DR R2/R4) | 진행 중 | — |
| I5 | 접근성(WCAG AA) | 없음 | `_artifacts/accessibility-matrix-audit.json` status pass [확인]. 결함 못 찾음 | 하 |
| I6 | 반응형(휴대폰·아이패드) | 부분(UI responsive.css) | 게이트 `ci-responsive-browser-check.mjs` 있음. 남은 것: 국채 곡선 10년 라벨(S9) | 하 |
| I7 | **레거시 `js/` 전역 ↔ native ESM 경계** | 부분(DR R9이 calcSectorBreadth·getBreadthRegime·getFGRegime 정리) | route-owners: **narrativeOwner legacy 15/20 라우트**, chartOwner legacy(portfolio) [확인]. window 전역 대입 aio-core 343 · aio-data 168 · aio-chat 84 · aio-ui 15곳(정규식) [확인]. I3 바이트의 주원인 [추정] | **상** |
| I8 | **CI 묶음: 데이터 커밋 CI가 라이브 데이터 내용을 단언** | 없음(AR이 원인 분류만 하고 후속으로 남김) | AR 원장 클래스 B: 봇 데이터 커밋의 CI가 red → UNATTESTED, refresh 17 + screener 11 실행. esm-core 뉴스 "current>0", runtime LIVE3-03 20SMA, scenario-guidance "staged theme", data-lineage SLA가 라이브 public-data를 읽음. **"Fixed here: NO (follow-up)", "still need an inventory"** [확인-형제 노트] | **상** |
| I9 | 데이터 감사 **R3**(시각만 바뀐 산출물 커밋 생략, FRED due) | 부분(AR "refresh-data 커밋 비교"가 겹칠 수 있음) | 배정 목록에 R3 자체가 없다 [확인]. FRED 하루 ~2,500회 [추정, 감사 인용]. INTEGRATION.md 열린 질문 "checkedAt이 매 실행 커밋·재배포를 부르는지(R3와 충돌)" [확인] | 상 |
| I10 | 데이터 감사 §3 나머지(펀드 플로 ICI, VKOSPI, 한국 금리 ECOS, 한국 CPI) | 없음 | 감사 §3 표 [확인-감사 인용]. 미국 중심 원칙상 ICI 펀드 플로가 한국 항목보다 앞 | 중(ICI)·하(한국) |
| I11 | 문서·지식 원장(CLAUDE.md, CODE-MAP, KNOWLEDGE-BASE) | 없음 | "8화면" 표기 낡음(§0). CODE-MAP 46일 묵음(AR 원장: knowledge-lint 실패 원인) [확인-형제 노트]. EVIDENCE-DEBT.md는 v50.1 이력 문서 | 중 |
| I12 | 스킬·에이전트 프로필 | 없음 | verify-aio에 charts feature 없음, 설명 "8 screens" [확인]. 에이전트 4개 프로필은 생성물 | 중 |
| I13 | 워크플로 16개 실패 클래스 | AR | 진행 중 | — |
| I14 | 보안 싱크·DOMPurify·Vault 암호 | 없음 | 기준선 `security-sink-baseline.json` 있음. 결함 못 찾음 | 하 |
| I15 | 퇴역 코드(js/aio-tests.js 712 KB, aio-qa-audits.js 325 KB) | 없음 | 부팅 스크립트가 아님(지연 로드) [확인]. 저장소 무게만 | 하 |

## 2. 담당 없음 목록 (우선순위 순)

**상**
1. **I8 데이터 커밋 CI의 라이브 데이터 단언** — 데이터 판단은 맞는데 CI가 매번 red가 되어 attestation이 막힘. 단위 테스트를 고정 fixture로 옮기고 라이브 검사는 watchdog으로 분리하는 전수 목록이 필요. AR에 후속으로 이어 붙이는 게 맥락상 가장 싸다.
2. **S20 AI 패널 화면 지도** — charts 문맥 부재, 의도 라우팅 오배정, '거시와 금리'·'퀀트 스크리너'·'매매 시그널' 라벨, kr-market 키. 결함 위치가 aio-chat.js 한 파일에 몰려 있다(단 UI가 같은 파일을 수정 중 → §3).
3. **I3 성능 TARGET_MISS** — JS 3.85 MB(목표 1.5 MB), DOM 2,674. 클래식 스크립트가 바이트 예산 밖.
4. **I7 레거시 서술 경계** — narrative legacy 15 라우트. I3과 한 작업으로 묶어야 효과가 남(서술 writer를 native로 옮기면 aio-core가 줄어듦) [추정].
5. **I9 R3 커밋 생략·FRED due** — AR의 freshness `checkedAt`과 정면으로 맞물리므로 AR에 배정하는 게 안전.

**중**
6. **문구 잔재('읽는 법'·교과서 문단)** — masters.js:288, atlas.js:464, macro-crossroads.js:208, fiscal-read.js:178, stock-lens-cards.js:217 [확인]. UI는 태그라인·도움말만 맡음. UI 범위를 본문 제목까지 넓히면 됨.
7. **S10 기술적 분석 화면 정리** — verify-aio feature, AI 문맥(S20과 함께), QA-DATA-64A 확인.
8. **S23 전역 검색 통합** — 검색창 네 개 [확인], 통합안은 제안 [추정].
9. **S16 포트폴리오 차트 native 전환** — chartOwner 유일한 legacy.
10. **S12 스크리너 필터·정렬 구성**, **S13·S15 종목 개요·재무 서술** — 296 KB 단일 파일, narrative legacy.
11. **S17~S19 리서치 라이브러리** — 페이지 코드 안 산문(atlas 128 리터럴). 산문을 콘텐츠 산출물로 빼고 화면은 짧은 해석만 [추정·제안].
12. **S7 한국 보드 null 칸 / I10 ICI 펀드 플로** — null 칸은 '원천 없는 위젯' 원칙상 숨기거나 ECOS로 채우거나 둘 중 하나.
13. **I11·I12 문서·스킬** — "8화면"→9, verify-aio charts, CODE-MAP 재스캔. 배치 통합 때 한 번에.

**하**: S1~S3, S9, S14, S21, S24, I1, I5, I6, I14, I15.

## 3. 겹침 위험

### 3-1. 같은 파일을 둘 이상이 수정 중 [확인: worktree status/diff]

| 파일 | 세션 | 위험 |
|---|---|---|
| `scripts/ci-runtime-contract-check.mjs` | AR(커밋) · DR · TS | 3자 병합. 단언 추가 위치가 겹치면 충돌 |
| `src/domain/briefing/reaction-read.js` | AR · TS · UI (같은 0x08 수정) | INTEGRATION.md 1번대로 한 번만. 세 커밋의 바이트가 같은지 확인 |
| `js/aio-pages.js` | DR · TS | 레거시 전역 정리(R9)와 테마 쪽 수정 |
| `index.html` | TS · UI | UI의 `:root` 모션 토큰과 TS 마크업 |
| `src/app/bootstrap.js` | TS · UI | import 순서·부팅 훅 |
| `src/data/selectors/market-inputs.js` | DR(R8) · UI | 입력 빌더 이전과 상태 렌더 연결 |
| `korea-participation` (domain=DR, component=UI) | DR · UI | 데이터 형태가 바뀌면 UI 상태 분기 무효 |
| `_context/CURRENT-STATE.md` | TS · UI | 생성물 — 둘 다 버리고 통합 때 재생성 |
| `js/aio-chat.js` | UI | 이 감사의 S20을 누가 맡든 UI와 같은 파일 |
| `src/ui/pages/atlas.js`·`screener.js`·`charts.js` | UI | 문구 잔재(§2-6) 작업과 같은 파일 |

### 3-2. 계약·의미가 겹침 [확인: 브리프·INTEGRATION.md / 영향은 추정]

- **신선도 모델 둘**: AR `aio-freshness.v1`(staleAfterMinutes)과 DR R5 `allowedUse: reference-only` 강등이 '낡음'을 각자 판정한다. 기준이 다르면 같은 원천이 배지는 정상, 레코드는 reference-only가 될 수 있다. 하나가 다른 하나를 읽게 정할 것.
- **신선도 배지 대체 구현**: UI `freshness-fallback.js`, TS `session-lag.js`(신규), AR `src/data/freshness.js`. INTEGRATION 2~4번이 다루지만 TS의 session-lag는 목록에 없음.
- **R1(TS) ↔ refresh-scheduler·artifact-cache(AR) ↔ R8(DR)**: 장 마감 직후 공백 정책을 TS가 화면에서 정하는데, 스케줄러 재시도와 시장 상태 입력도 같은 '기대 세션'을 계산한다. 기대 세션 함수가 하나인지 확인.
- **R9 분할**: breadthCounts(DR)와 themeMedians(TS, `theme-medians.js` 신규)가 같은 레거시 계산 지점(aio-core D3/D4)을 각자 건드림.
- **`pages-deploy.yml`(DR R4) ↔ AR C1 release verify ↔ `sw.js` 프리캐시(AR)**: 배포에서 뺀 파일을 SW가 프리캐시하거나 release verify가 찾으면 배포 실패.
- **`refresh-data.yml`(AR 수정 중) ↔ R3(미배정) ↔ R11 trail 파일(TS) ↔ R12 심볼 추가(DR)**: 커밋 단계와 산출물 목록을 셋이 바꾼다.
- **`architecture/qa-pipeline.json`**: AR이 바꿨고(impactRules[12]), 다른 세션이 게이트를 추가하면 같은 파일.
- **pending-records 번호**: 네 세션 모두 v59.70을 인용 — `apply-pending-records --dry-run`에서 P 번호 순서 확인.
- **UI 전역 버튼·`.page button:disabled` 규칙 ↔ TS 테마 CSS**: UI-API가 "theme CSS에서 .aio-state 재정의 금지"를 명시. TS `themes-page.css` 변경분 확인 필요.

## 4. 확인하지 못한 것

- 화면은 브라우저로 열지 않았다. 문구·구성 판단은 코드 문자열과 집계(정규식) 기준이다.
- DR worktree는 커밋이 없어(`main...data-refactor` 빈 diff) dirty 파일 목록으로만 범위를 봤다. 브랜치 이름은 `data-refactor`다(INTEGRATION.md의 "이름 확인 필요"에 대한 답).
- I3 수치는 11/03 21:36Z 측정 한 번이다.
