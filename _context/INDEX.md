---
verified_by: Codex (repository/gates/Chrome live/GitHub Actions 실측)
last_verified: 2026-07-19
confidence: high
auto_refresh: true
target_version: version.json
---

> **Current correction (2026-07-06 v52.22/P632)**: headless CI is no longer report-only. After P630 cleared the skip-list to `[]` and measured `922/922 PASS`, P632 removed `continue-on-error` from `.github/workflows/ci.yml`'s `headless-tests` job and made `deploy` depend on both `validate` and `headless-tests`. Older `899/922`, non-empty skip-list, report-only, or deploy-not-gated lines in this index and `GATE-BASELINE-2026-07-03.md` are historical/superseded.

> **Current correction (2026-07-10 v52.43)**: local headless is `948/948 PASS`, viewport matrix is `88/88 PASS`, and direct live invariant passes. However `.github/workflows/data-watchdog.yml` currently contains five U+0080 control characters and GitHub run `29059996134` fails before creating jobs. The watchdog and its R290 live check are therefore not operational. See `CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md`.

> **Current correction (2026-07-10 v52.48 local, second pass)**: WO-0/WO-1A/WO-1B/WO-5 are implemented locally and headless is `958/958 PASS`, but they are not all live-verified; the inspected live site remained v52.43 and the Worker requires a separate operator deployment. A `FULL_INIT=true` viewport run found four failing `technical` route/viewports from `_pricePosition()` SVG label overlap. The default viewport job remains report-only and has `theme-detail`/zero-canvas/async-settle blind spots. Use `CODEX-SECOND-PASS-HANDOFF-2026-07-10.md` as the current external-readiness execution entrypoint.

> **Current correction (2026-07-13 v52.67 local)**: `AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md` and `INSTITUTIONAL-DATA-READINESS-HANDOFF-2026-07-12.md` are now a paired execution handoff. They define a shared Evidence/Calculation/Page/AI Response/Release architecture, explicit `DESIGNED -> IMPLEMENTED_LOCAL -> VERIFIED_LOCAL -> VERIFIED_LIVE` status, AI-X01~10, WP-AI11~20, RG/G-AI extended gates, and a single dependency map. The documents are designs and acceptance contracts, not implementation-complete reports. v52.67 local route re-audit still finds `briefing` context missing, themes/theme-detail prompts identical, and screener/portfolio/options evidence gaps; PUBLIC remains NO-GO.

> **Current correction (2026-07-13 v52.75 local)**: WP-AI0 + 데이터 WP-0 is `IMPLEMENTED_LOCAL`: both AI chat surfaces identify as beta education/research assistance, concrete trade instructions are blocked at streaming/final/retry render boundaries, and unverified server market prose falls back to deterministic synthesis. Local syntax/runtime/Chromium headless gates pass (`997/997`), but live Pages/Worker/model-response certification and WP-AI1 single-path integration remain open; PUBLIC remains NO-GO.

> **Current correction (2026-07-13 v52.76 local)**: WP-AI1 is `VERIFIED_LOCAL`: per-page/unified/retry/translation/briefing share one request envelope and response pipeline with recorded pipeline/validator/block-policy versions; retry reuses the same completion contract; `CHAT_CONTEXTS.briefing` is defined. Final local gates pass: headless `1001/1001`, critical10 `10/10`, accessibility `22/22`, portfolio vault `8/8`, viewport `88/88`, boot interaction within budget. Live Pages/Worker/model certification and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-13 v52.77 local)**: WP-AI2 is `VERIFIED_LOCAL`: `wp-ai2.claim.v1` typed claims and the common response pipeline now validate metric/unit/scale/direction/asOf/source/evidenceId, with fail-closed counterexamples for F&G/VIX, NFP 10x, bp/%, sign, FX inversion, and missing Evidence. Local syntax/runtime/version checks and Chromium headless `1010/1010 PASS` pass. Live Pages/Worker/model certification and post-deploy live verification remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.78 local)**: WP-AI3 is `VERIFIED_LOCAL`: the shared AI context path now classifies query intent, retrieves imported research with deterministic top-k ranking, keeps it `REFERENCE`/`asOf` separated from current Evidence, and compacts it within a declared 2K–6K token budget. P95 input-token audit and ±10% chars/4 measurement metadata are recorded. Local syntax/runtime/headless gates pass (`1018/1018 PASS`); live retrieval/model quality and public certification remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.79 local)**: WP-AI4/5 is `VERIFIED_LOCAL`: external news/Telegram/web-search/translation inputs use an explicit `UNTRUSTED DATA` boundary and injection audit; portfolio AI uses redacted allowlisted fields with session opt-in; chat history has 30-day/50-entry retention and off mode; and the shared response pipeline blocks prohibited conduct, unsuitable/stale/REFERENCE personalized actions, and uncalibrated probability claims. Local syntax/runtime/headless gates pass (`1027/1027 PASS`); live model/red-team, live Pages/Worker certification, and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.80 local)**: WP-AI6/7 is `VERIFIED_LOCAL`: automated translation/briefing/market-analysis publish gates now validate structured claims, preserve deterministic evidence-summary/template fallbacks, and expose source labels; the existing `AIO_PAGE_CONTRACTS` registry projects required/optional/forbidden AI context and beginner/expert modes across all 22 routes with explicit disabled states and `kr-technical`/`kr-tech` alias coverage. Local syntax/runtime/headless gates pass (`1032/1032 PASS`); live model/content quality, live Pages/Worker certification, and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.81 local)**: WP-AI8/9/10 is `VERIFIED_LOCAL`: AI usage records bounded latency/token/failure SLO samples and quota acquisition guards; a 12-case golden corpus and no-regression/P0 A-B release gate are available; and thumbs feedback links request/model/prompt/evidence/validator metadata. Local syntax/runtime/headless gates pass (`1037/1037 PASS`); live provider SLO, live model A/B quality, live Pages/Worker certification, and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.82 local)**: WP-AI11/12 is `VERIFIED_LOCAL`: request envelopes carry explicit session/turn/route/entity ownership and late-response/trim audits; approved deterministic calculators emit validated `CalculationEvidence`, while model decision-use and invariant mismatch are blocked. Local syntax/runtime/headless gates pass (`1043/1043 PASS`); live multi-user race/model arithmetic certification, live Pages/Worker certification, and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.83 local)**: WP-AI13/14 is `VERIFIED_LOCAL`: retrieval indexes document/chunk/version/time/source-tier metadata, quarantines poisoned/retracted/superseded material, measures recall/precision/source-tier/temporal quality, and blocks poisoned current-action use; the shared conduct boundary classifies P0 prohibited, legal-review-required, and educational states. Local syntax/runtime/version/headless gates pass (`1051/1051 PASS`); live retrieval/model/red-team/legal certification, live Pages/Worker certification, and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.84 local)**: WP-AI15/16 is `VERIFIED_LOCAL`: replay manifests retain model/prompt/retriever/validator/evidence/output provenance with approval/canary/rollback gates; tenant-safe isolation keys, idempotency, and partial/complete/aborted stream audits are carried by the existing request/response path. Local syntax/runtime/version/headless gates pass (`1059/1059 PASS`); live provider replay/canary/red-team, multi-user isolation, live Pages/Worker certification, and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.85 local)**: WP-AI17/18 is `VERIFIED_LOCAL`: coverage/exposure reports measure region/sector/cap/liquidity/source coverage and keep missingness neutral; signed human-chat evidence covers screen-reader/keyboard/mobile/novice/expert/task dimensions with explicit incomplete/blocked states. Local syntax/runtime/version/headless gates pass (`1067/1067 PASS`); live population/model bias, assistive-tech/user certification, live Pages/Worker certification, and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.86 local)**: WP-AI19/20 is `VERIFIED_LOCAL`: registered read-only tool capabilities deny unknown/mutation operations, and provider/data/output rights, retention, training, redistribution, and region metadata are explicit with review-required live entries. Local syntax/runtime/version/headless gates pass (`1075/1075 PASS`); live provider/data/output rights, legal/operator configuration, multi-user tool isolation, live Pages/Worker certification, and deployment remain unverified; PUBLIC remains NO-GO.

> **Current correction (2026-07-14 v52.92 local)**: the screener-only producer generated 847/870 histories and timestamped US/KR universe breadth without overwriting core data. Core quote coverage now fails before writing `data.json`; external dependencies are split into 15 implementation/rights/cadence states. Quant ranking remains research-only because predictive validation and live/backtest parity are not established. Browser plugin execution aborted and was not counted as browser verification; deployment remains unverified.

> **Current correction (2026-07-15 v52.93 local)**: `INSTITUTIONAL-HANDOFF-RECONCILIATION-2026-07-15.md` is the current gap/overlap ledger and executable handoff contract. It now fixes the dirty-checkout/artifact baseline, operator configuration boundary, Batch 0~6 order, WP-0~14 file-level task cards, 22-route data-completeness targets, cross-page metric identity, BLS keyless design, verification evidence levels, and commit/Actions/live/rollback procedure. The screener's independent 6-hour workflow is still local-only until commit/push; SEC collection and quote artifact lineage remain live-unverified. PUBLIC remains NO-GO.

> **Current correction (2026-07-18 v53.11)**: AR-00~06 ESM foundations, sentiment vertical slice, WebSearch inferred-claim gate, typed navigation facade, AR-07 canonical 16/16 snapshot/LKG contract, Worker preflight, operations status, and 22-category reconciliation are implemented locally. Cloudflare credentials/resource IDs, rights, 7-day fast-plane SLO, full route renderer cutover, live certification, and final commit/Pages deployment remain explicit gates.

> **Current correction (2026-07-19 v53.15)**: `ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md` is the active cross-session execution ledger beneath the architecture handoff. It separates 14 layers and five owner dimensions per route, defines ARX-00~16 dependency waves, requires a pre-edit DELETE-LEDGER and monotonic burn-down, and fixes the next packet to sentiment renderer ownership. Current truth remains native lifecycle 1/17, native renderer 0/17, legacy renderer 17/17; full rebuild is not complete.

# _context Index

This folder is the active project knowledge base for AIO. It should describe the current GitHub-deployed structure first, then local Claude worktree exceptions only when they affect routing.

## Active Documents

| Document | Role | Refresh trigger |
|---|---|---|
| `CLAUDE.md` | Project structure, Git-tracked skills, hook caveats, context loop | Structure or workflow changes |
| `WORKFLOW-GOVERNANCE.md` | Agent preflight, postmortem-to-gate rule, skill/self-operation closure contract | Workflow, skill, or CI gate changes |
| `RULES.md` | Master rules for versioning, edits, QA, safety, deployment | New recurring failure or process rule |
| `BUG-POSTMORTEM.md` | Bug history and P-number recurrence tracking | Bug fix |
| `QA-CHECKLIST.md` | Manual/automated QA checklist | QA finding or new risky surface |
| `KNOWLEDGE-BASE.md` | Research, market frameworks, integration memory | `/integrate` or insight capture |
| `CODE-MAP.md` | Current `index.html` and `js/*.js` line map | Large edit or module movement |
| `WORKTREE-AUDIT.md` | GitHub/live/worktree routing and unpublished work inventory | Worktree merge, deploy, or audit |
| `DEEP-QA-2026-05-05.md` | Three-area deep QA: UI/rendering, API pipeline, page-level logic | Deep QA run or live/local parity change |
| `OPERATIONS-AUDIT-2026-05-06.md` | Operational sustainability audit: version/cache/SW/API health | Runtime or deployment hardening |
| `DATA-PIPELINE-AUDIT-2026-05-06.md` | End-to-end data pipeline map: source, transport, store, analysis, render | API/source, analysis, or render pipeline changes |
| `ARCHITECTURE-AUDIT-2026-05-10.md` | v49.3 architecture-audit reinforcement summary | Data/function/risk layer changes |
| `DATA-FRESHNESS-AUDIT-2026-05-10.md` | v49.4 freshness policy / auto-refresh reinforcement summary | Freshness policy/source/stale criteria changes |
| `DATA-SOURCE-REPLACEMENT-PLAN-2026-07-14.md` | 15개 외부 데이터 카테고리별 현재 경로·대체 API·권리·자동화 가능성 및 목표 수집 아키텍처 | 공급자, API, 라이선스, cadence, 자동화 상태 변경 시 |
| `INSTITUTIONAL-HANDOFF-RECONCILIATION-2026-07-15.md` | 기관급 데이터 핸드오프 WP-0~14의 구현·중복·누락 대조 원장 + 다른 모델용 파일/Batch/페이지/게이트/배포·롤백 실행 계약 | WP 상태, 실행 순서, 무료 공급자 연결, 페이지 데이터 계약, 잔여 외부 의존성 또는 공개 판정 변경 시 |
| `AUTOMATED-DATA-RELIABILITY-HANDOFF-2026-07-18.md` | 2026-07-18 실측 공백 기준 중요 시세 자동화 보장 계층, 22개 영역별 직접·WebSearch·뉴스 우회안, QG/AR 실행 게이트 | quote 공급자·스케줄러·freshness SLO·추론 정책·22개 영역 상태 변경 시 |
| `ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md` | 전체 12개 구조면 진단, 유지/교체/폐기 경계, TypeScript+ESM 기반 목표 구조, AR-00~09 점진 재구축·legacy 종료 원장 | 아키텍처 ADR·계층 경계·AR 패킷·legacy burn-down 변경 시 |
| `ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md` | 다른 세션용 전체 재구축 실행 원장: 14계층·17 route·ARX-00~16·DELETE-LEDGER·owner/burn-down/최종 인수 기준 | 계층/route owner, 실행 wave, 삭제 대상, gate 또는 재구축 상태 변경 시 |
| `GATE-BASELINE-2026-06-04.md` | v50.4 evidence deployment gate + unit-test 실측 기준선 (env-dependent vs code-internal 분리) | 게이트/테스트 재측정, 운영 baseline 추가 시 |
| `GATE-BASELINE-2026-07-03.md` | v51.91→v51.96 헤드리스 CI 테스트(`ci-headless-tests.mjs`) 실측 (894/921→896/921 pass, T776/T686 실제 해소로 27→25건 skip-list) — Phase 2 [B5] + 전체 /data-refresh 산출물 | skip-list 갱신, 헤드리스 테스트 재측정 시 |
| `CHAT-DATA-AUDIT-2026-06-04.md` | v50.8 AI 채팅 데이터 출처 전수 감사 baseline (fetch 파이프라인·시장맥락 주입·재사용·dead code 실측) | 채팅 데이터 경로/컨텍스트 변경 시 |
| `AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md` | v52.63 AI 채팅·자동 브리핑·번역·서버 분석 기관급 전수 진단. 20개 컨텍스트/22 route, 의미 검증 반례, 경로 분열, prompt injection·개인정보·비용·SLO, WP-AI0~10과 A/B release gate | AI prompt/data/validator/model/Worker/privacy/public claim 변경 시 |
| `FRONTEND-UX-AUDIT-2026-06-05.md` | v50.12 21페이지 라이브 프론트엔드/UX audit (클러터·중복 / 초보자 직관성·위계). 측정+audit 근거, P0/P1/P2 백로그 | UI/UX 시정·페이지 구조 변경 시 |
| `OPUS-HANDOFF-STRUCTURAL-AUDIT-2026-06-10.md` | v50.23 구조 전수 감사 (백엔드/프론트/데이터/UX/자동운영 실측) + Opus 작업 백로그 WO-1~14. cron 미발화·ATH 레짐 버그(aio-data.js:12303)·stale 내러티브 구조 등 P0 5건 (전부 해소됨, FABLE-SYSTEM-DIAGNOSIS §2 참조) | WO 항목 완료/구조 변경 시 |
| `PAGE-UX-AUDIT-2026-06-13.md` | 페이지별 UX 감사. 일부 "빈 껍데기/고장" 항목은 이후 라이브 검증에서 거짓양성 판정됨(`DEFERRED-BLOCKS.md` §3 참조) | UI/UX 재점검 시 |
| `DEFERRED-BLOCKS.md` | 미뤄둔 작업 / 진짜 블록 현황 — 데이터 없음(B1-3)·시간 필요(B4/B6)·운영자 결정(B5)으로 구분, "별도 세션 필요"의 실체 정리 | 블록 해제/작업 착수 시 |
| `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` | v51.90 시스템 뼈대 진단 (아키텍처/자동화·최신화/알고리즘). P0: 로컬 git 병듦(OneDrive, 2026-07-02 해소됨)·_context/CLAUDE.md 인코딩 파손(해소됨). RSI 서버↔클라 공식 상이, 백테스트≠라이브 모델, CI 헤드리스 갭 등 + Sonnet 5 로드맵 Phase 0~3 | 로드맵 항목 완료/구조 변경 시 |
| `FABLE-LIVE-AUDIT-2026-07-04.md` | v52.4 라이브 전수 감사 P0~P6 백로그 — P0/P1은 v52.5/52.6, P2~P6은 v52.7~v52.18에서 전체 완료(CHANGELOG 참조) | 재감사/항목 완료 시 |
| `FABLE-ARCH-DIAGNOSIS-2026-07-06.md` | v52.18 전수 아키텍처 진단(7축 스코어카드, 커버리지 정직표, 07-02 진단 해소 8건 코드 대조) + Sonnet 5 인수인계 로드맵 Phase 0~4. P1: `fetchKrDynamicData` 그림자 선언 + R280 기계 게이트 부재. 헤드리스 899/922 재현 실측 | 로드맵 항목 완료/구조 변경 시 |
| `FABLE-LIVE-AUDIT-2026-07-07.md` | KOSPI -8% 실폭락일 라이브(v52.21) 실브라우저+외부 실측 감사 — 발견 전수 대장(C1~C7·L1~L10·F1~F9·U1~U11·X1~X3) + 근본원인 6뿌리 + 구조 개선 Phase L0~L5 + ARCH 로드맵 통합 우선순위 (L0~L4 실행 완료) | 로드맵 항목 완료/재감사 시 |
| `FABLE-UIUX-DEEP-AUDIT-2026-07-08.md` | UI/UX 심층 라이브(v52.26) 감사 — QA 미확인 백로그+P634~P641 일괄 검증 원장(§1), 신규 발견 UX-01~13(showThemeDetail P0 크래시·theme-detail 고아 라우트·프록시 SPOF·AI 백엔드 이원화·aria-live 132 등), 구조 개선 Phase V0~V4 + 운영자 결정 카드 | 로드맵 항목 완료/재감사 시 |
| `FABLE-EDU-OVERHAUL-DESIGN-2026-07-09.md` | 22페이지 교육 레이어(개념·원리·시장연결·실전) 전수 감사 매트릭스 + `AIO_PAGE_FUNDAMENTALS` 컴포넌트 설계 + 페이지별 콘텐츠 원고 + 게이트 계획 — **v52.39에서 구현 완료**(P654/R291/T869, 로컬 미배포) | 구현 완료(2026-07-10)/재감사 시 |
| `FABLE-EFFICACY-AUDIT-2026-07-10.md` | 라이브(v52.34) 페이지별 시장데이터 완비·사용성·실효성 실측 진단(17.5/22페이지, §1 매트릭스) + 발견 대장 EF-01~18(technical S&P 0.5% stale·breadth 4중 모순·매크로 지표 1~2개월 stale·엔캐리 게이지 상시 사망·ticker 재무 침묵 숨김·어닝 캘린더 빈 화면 등) + 보강 설계 Batch 1~4. **차기 구현 진입점(§5, Sonnet 5 체크리스트)** · 미점검 잔여는 §4 명시 | 구현 완료/재감사 시 |
| `CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md` | v52.43 저장소·이력·라이브 브라우저·GitHub/Pages/Actions·보안·데이터·시스템 레이어·Trading Score/Factor를 함께 본 종합 진단과 후속 에이전트 작업 패킷 WO-0~8. P0: 무효 watchdog YAML, 포트폴리오 암호화 표기 불일치, Anthropic 공유 프록시 비용 경계 | 각 WO 완료/전수 재감사 시 |
| `CODEX-SECOND-PASS-HANDOFF-2026-07-10.md` | 1차 종합 진단과 22페이지 프론트엔드 추가 진단을 통합한 2차 실행 원장. 기존 WO local/live 상태 재분류, H2-00~16 개선·보강 설계, 외부 공개 BETA/PUBLIC/CLAIMS 게이트, Luna/후속 모델 실행 계약 | H2 항목 완료·라이브 parity·Tier 13 재감사 시 |
| `REMAINING-WORK-2026-07-12.md` | v52.60 배포 후 남은 비차단 작업, 사용자 판단 필요 항목, 재개 규칙의 단일 요약 | 남은 H2 항목 상태·담당·공개 게이트 변경 시 |
| `INSTITUTIONAL-DATA-READINESS-HANDOFF-2026-07-12.md` | v52.62 로컬/v52.61 라이브 기준 기관급 공개 진단·실행 원장. 18,064 leaf·77 quotes·846 screener·10 FRED·38 news 원천 대사, 22페이지 사용자 시각/의미 감사, F&G 49/31·870/846/873 분열, 운영 SLO·누락 영역, WP-0~14 게이트 | 각 WP 완료, 원천·라이선스·페이지 필수 데이터·공개 판정 변경 시 |
| `WO7-GLOBAL-INVENTORY-2026-07-10.md` | CODEX-COMPREHENSIVE-DIAGNOSIS WO-7("점진적 구조 격리") Packet 1 — 전역 read/write baseline 실측(innerHTML 395·전역쓰기 1,318·localStorage direct 146 vs safeLS 8) + timer/chart/page-lifecycle 어댑터 기존재 확인(진짜 갭은 채택률) + snapshot/storage adapter 전면화 등 다음 패킷 우선순위 | 다음 WO-7 패킷 착수 시 |
| `INDEX.md` | This index | Any `_context` document add/remove |

> 39개 versioned/new `_context/*.md` 활성(2026-07-19 갱신). 추가로 루트에 `EVIDENCE-DEBT.md`(v50.x evidence-first 부채 대장)가 있으며 `_context` 밖이지만 evidence 게이트의 SSOT다. `_context/archive-reports/`, `working-rules.md`, `voice-and-style.md`는 `.gitignore` 대상(로컬 전용 레거시).

## Current Deployment Baseline

- **GitHub baseline (source of truth)**: 감사 시 `origin/main` at `9353df7` (`v52.43`). 이 항목은 버전업마다 낡으므로 항상 `git log`와 live asset parity를 재실측한다.
- **로컬 워크트리**: 별도 worktree 없음. 감사 시작 시 `main` `40a922b`, origin 대비 문서 전용 WIP commit 1개 ahead였고 애플리케이션 코드는 clean이었다. 이번 감사의 미커밋 변경은 종합 진단 문서와 이 INDEX뿐이다.
- **Live site**: `https://ysnle.github.io/aio-screener/`
- **게이트 실측 baseline (2026-07-10 v52.43)**: 9개 정적 게이트 PASS, headless `948/948 PASS`, viewport `22×4=88/88 PASS`와 overflow 0px, direct live invariant PASS. 단 headless는 외부 네트워크 abort, viewport 기본은 `FULL_INIT=false`이며 watchdog workflow 자체는 YAML parse FAIL이다.
- **저장소 상태(2026-07-10 갱신)**: `C:\Projects\AIO`에서 운영. loose object 2,134개/154.02MiB, pack 12.61MiB, garbage 0. 최근 자동 데이터/WIP 커밋 밀도가 높아 주기적 gc와 변경 단위 통제가 남아 있다.
- **Primary source of truth**: GitHub `origin/main` plus live asset parity.

## Current File Structure

```text
AIO/
├── index.html · version.json · sw.js (manifest.json은 P310/v49.43에서 삭제됨 — 실존 안 함)
├── js/
│   ├── aio-core.js · aio-data.js · aio-ui.js · aio-chat.js · aio-tests.js · aio-glossary.js
├── scripts/              ← fetch-data.mjs · fetch-telegram-digest.mjs · ci-*.mjs(12종, R290 신규 2종 포함) · bump-version.mjs
├── .github/workflows/    ← ci.yml · refresh-data.yml · data-watchdog.yml · knowledge-lint.yml(R290 신규)
├── public-data/          ← data.json · history.json · screener.json · telegram-digest.json · operator-note.json
├── CHANGELOG.md · CLAUDE.md · api_setup_guide.html · cloudflare-worker-proxy.js
├── _context/             ← Git-tracked 위키 (위 표 참조, 21개)
└── .claude/               ← 전부 Git-tracked (2026-05-18~)
    ├── agents/            ← 4개 서브에이전트 (accessibility-auditor · code-reviewer · performance-analyzer · qa-auditor)
    ├── commands/           ← 9개 wrapper
    ├── hooks/              ← 6개 (PreToolUse/PostToolUse/Stop)
    └── skills/             ← 7개: _shared · autoresearch · bug-fix · data-refresh · integrate · knowledge-lint · post-edit-qa
```

> 상세 hooks/commands 매핑은 `_context/CLAUDE.md` 참조(2026-07-02 인코딩 파손 복구 + 실측 재작성됨).

## Backlink Map

- `RULES.md` links recurring failures to enforceable rules.
- `WORKFLOW-GOVERNANCE.md` turns lessons into runnable gates and defines the required preflight for agents/skills.
- `BUG-POSTMORTEM.md` records bug causes and promotes repeated patterns into rules.
- `QA-CHECKLIST.md` turns rules and bugs into runnable checks.
- `CODE-MAP.md` prevents partial patches from targeting stale line ranges.
- `WORKTREE-AUDIT.md` prevents confusing unpublished Claude worktree changes with deployed GitHub state.
- `DEEP-QA-2026-05-05.md` records the latest local-vs-live deep QA matrix.
- `OPERATIONS-AUDIT-2026-05-06.md` records runtime/cache/API self-operation checks for deployed operations.
- `DATA-PIPELINE-AUDIT-2026-05-06.md` records source-to-render data lineage and release QA commands.
- `ARCHITECTURE-AUDIT-2026-05-10.md` / `DATA-FRESHNESS-AUDIT-2026-05-10.md` record the v49.3/v49.4 reinforcement summaries that the v50.x evidence layer builds on.

## Maintenance Rule

When a new `_context` document is added or removed, update this file and `_context/CLAUDE.md` in the same change.

## Workflow Compaction

- Current active gates: R219 semantic review and R220 workflow compaction.
- Run `node scripts/ci-semantic-review-check.mjs` when audit/readiness/page/AI/data/trading gates change.
- Run `node scripts/ci-workflow-compaction-check.mjs` when `_context`, `CLAUDE.md`, QA, postmortem, or skill guidance changes.
- Treat `BUG-POSTMORTEM.md`, `RULES.md`, and `QA-CHECKLIST.md` as archives plus active gates. Do not expand them without checking whether older guidance can be removed, merged, compressed, or moved into a reference.
- Root `.claude/skills/*/SKILL.md` files are router files. Keep recurring obligations in `.claude/skills/_shared/operating-contract.md`, move long skill detail into directly linked `references/`, and let `scripts/ci-skill-contract-check.mjs` enforce router size/reference existence.
