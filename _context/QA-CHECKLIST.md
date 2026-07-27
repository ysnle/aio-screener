---
verified_by: agent (Fable 5) + Codex P761-P843 + post-deploy verification
last_verified: 2026-07-27
confidence: high

## Current architecture checkpoint (2026-07-27, v53.51)

Native lifecycle ownership is wired for 17/17 routes; native renderer ownership is
  home/signal/guide/sentiment/screener/market-news/briefing/technical/macro/fxbond/breadth/themes/ticker/fundamental/options/portfolio (17/17), and native data ownership is breadth/themes/theme-detail/screener (4/17).
RM-03 P755~P763 extracted/retired the documented toy domains, replaced the signal
toy with the Trading Score envelope, and made factor weights pure. ARX-10 gives
screener sole native DOM/state ownership; ARX-16 migrates non-route consumers through
the canonical read boundary and removes the duplicate runtime fetch/factor projection. Static
identity/memo and pipeline compatibility producers remain separately tracked. Live certification/soak remains open.
version: v4.2
checklist_version: v53.51
latest_P_covered: P843
current_P839_checkpoint: W2 route/entity scope, chart lifecycle, and plaintext IndexedDB key-backup retirement are implemented; P842 Wave 4 and P843 Wave 5 gates pass, live v53.51 and SA-04 are verified, and only external operator criteria remain

## P843 Wave 5 route soak, operations, and public-readiness boundary (2026-07-27, v53.51)

- [x] `architecture/visual-state-matrix.json` covers all 17 routes and loaded/reference/blocked/stale-reference/empty states with required surfaces.
- [x] `architecture/operations-slo.json` declares bounded settle, error, chart-growth, canvas, cross-page, and failure-alert targets; public readiness remains conservative and operator-gated.
- [x] All GitHub Actions refs are full commit SHA pinned; CI uses `npm ci`; Wrangler is exact-versioned; `_headers` is allowlisted and staged for compatible static hosts.
- [x] Three-lap route soak passes all 17 routes with one visible page, stable 42-canvas maximum, zero non-expected browser errors, and AAPL→MSFT→AAPL entity re-entry.
- [x] Final all-work browser boundary passes headless `1102/1102`, boot, architecture/browser `17/17`, vertical slices `10/10`, SA-02/SA-03, viewport `68/68`, Critical-10, Vault PFE2-01~09, and accessibility `17/17`.
- [x] Live deployed revision v53.51 is served by the public URL and `ci-live-invariant-check.mjs` passes after commit `65f6912`.
- [x] SA-04 boot-network-budget passes in GitHub Actions run `30260095694` with `fredHasKey:true`, `fredFetchOk:true`, and `fredOk:true`.
- [ ] Edge header enforcement, 30-day automation SLO, and provider rights remain operator-required.

## P842 Wave 4 capability/content boundary (2026-07-27, v53.51)

- [x] `wave4.capability.v1` manifest covers nine capabilities with status, evidence, allowed wording, and forbidden claims.
- [x] Guide has nine executable capability markers and the browser audit reports `pass`.
- [x] Guide/metadata copy no longer overclaims real-time, automatic translation, AI-backed behavior, RRG/Stage certainty, one-way macro causality, or direct trading instructions.
- [x] Capability static fixtures reject forbidden wording and architecture/browser Guide assertions pass.

## P841 Wave 3 vertical slice boundary (2026-07-27, v53.50)

- [x] Ten ordered slice contracts cover all 17 routes without duplicate or missing route membership.
- [x] Router scopes expose slice id/order/routes/required data, and active page nodes expose slice marker plus live completeness state.
- [x] Static contract verifies native lifecycle ownership, canonical page completeness, and CI wiring.
- [x] Chromium gate covers direct route surface, required producer mapping, blocked external network, mobile controls, and leave/re-entry for 10/10 slices.
- [x] Wave 3 boundary suite passes: static workflow, headless `1102/1102`, boot interaction, architecture/browser 17-route, vertical-slice browser `10/10`, SA-02, SA-03, viewport `68/68`, Critical-10, Vault PFE2-01~09, and accessibility `17/17`.
- [ ] SA-04 boot-network-budget remains operator-required while the public snapshot has `fredHasKey:false` / `fredFetchOk:false`; the FRED/HY success branch was not locally executable.

## P840 W1-04/W1-05/W2-05 freshness, narrative, and KDF remediation (2026-07-27, v53.49)

- [x] `sec-report.v2` classifies SEC observations as current, aged, historical, or unknown and blocks decision eligibility for stale/reference-only facts.
- [x] Ticker decision narratives fail closed when the entity, finite quote, or market-health evidence is missing.
- [x] Vault writes use the versioned v2 envelope/KDF; legacy v1 ciphertext decrypts with the legacy KDF and is re-encrypted through `safeLS`.
- [x] Targeted syntax, ESM, runtime-contract, architecture-contract, and Vault Chromium PFE2-09 checks pass.
- [x] Wave 1·2 full gates pass: headless 1102/1102, architecture/browser 17-route with browserErrors 0, FULL_INIT 68/68, Critical-10, Vault PFE2-01~09, accessibility, and SA-02/SA-03.
- [ ] SA-04 remains operator-required while the public snapshot has `fredHasKey:false` / `fredFetchOk:false`; this is an external precondition, not a Wave 1·2 code failure.

## P839 W2 Scope/chart/key-resource remediation (2026-07-27, v53.48)

- [x] Route scope exposes `mountId`, normalized `entityId`, abort signal, `isCurrent`, and disposal; changed tickers remount and identical route/entity transitions no-op.
- [x] Entity and screener async providers/orchestrators pass abort signals and reject late scope results.
- [x] Native Chart.js pages use a replaceable route registry with disposal and 480px canvas max-height ownership.
- [x] Automatic plaintext API-key IndexedDB mirror/open/read/recovery is retired; legacy database deletion and explicit export/import policy are wired.
- [x] Targeted ESM, runtime-contract, storage, syntax, and diff checks pass.
- [x] Wave 2 static/runtime, headless 1102/1102, architecture/browser 17-route, FULL_INIT viewport 68/68, Critical-10, Vault PFE2-01~08, accessibility 17/17, and SA-02/SA-03 verification.
- [ ] SA-04 boot-network-budget: operator-required until a snapshot with `fredFetchOk:true` and `hyOAS` is available; current public snapshot remains `fredHasKey:false` / `fredFetchOk:false`.

## P838 W1 Decision-evidence boundary (2026-07-27, v53.47)

- [x] `allowedUse` aliases normalize fail-closed to `decision`, `reference`, or `none`.
- [x] Display and last-known selectors can retain research context without exposing it to decision consumers.
- [x] Trading Score blocks reference-only or insufficient-coverage inputs and preserves component-level missing evidence.
- [x] ESM selector/model fixtures and module syntax checks pass.
- [x] Wave 1 static/runtime, headless 1102/1102, architecture/browser 17-route, FULL_INIT viewport 68/68, Critical-10, Vault PFE2-01~08, accessibility 17/17, and SA-02/SA-03 verification.
- [ ] SA-04 boot-network-budget: operator-required until a snapshot with `fredFetchOk:true` and `hyOAS` is available; current public snapshot is explicitly `fredHasKey:false` / `fredFetchOk:false`.

## P837 Fast-plane deploy smoke bootstrap (2026-07-27, v53.46)

- [x] Smoke retries transient 404 propagation before evaluating `/health`.
- [x] Complete current coverage passes; explicit empty-KV bootstrap is accepted only as `operator_required`.
- [x] Non-bootstrap 503, malformed payload, partial coverage, and unreachable endpoint remain blocking.
- [ ] First scheduled KV publish and 7-day soak remain operator-side; full browser/accessibility/performance suite intentionally not rerun.

## P836 Full data refresh (2026-07-27, v53.45)

- [x] Market refresh completed: 78/78 symbols, 42 macro keys, F&G 39, news 40, 377-day history update.
- [x] Public Telegram digest refreshed for 3 channels over the requested 14-day window.
- [x] SEC fundamentals and 845-symbol screener artifacts regenerated; source coverage is 539/655 (82.3%) and screener display coverage is 539/725 (74.3%).
- [ ] Full browser, accessibility, performance, and end-to-end verification intentionally not rerun per operator request.

## P835 Reference analysis protocol completion (2026-07-27, v53.44)

- [x] Chart-reading protocol separates context, trend, structure, retest, participation, momentum, and invalidation.
- [x] Wait/probe/hold/protect behavior playbook and verdict/evidence/missing-data communication contract are attached to the source-labelled AI infrastructure framework.
- [x] No supplied number, chart level, X claim, or Worker claim is promoted to live decision evidence; automatic order/sizing behavior remains blocked.

## P834 AI infrastructure cycle reference integration (2026-07-27, v53.43)

- [x] `AIO_AI_INFRA_CYCLE_REFERENCE` is `sourceKind=REFERENCE`, includes Q1-Q5, and separates capex-lag/reinvestment-trap from memory P and neocloud Q/capital lenses.
- [x] `CHAT_CONTEXTS` injects the framework without promoting supplied figures, chart levels, or X/Worker claims to live evidence; runtime macro/breadth comparison is source-aware and fail-closed.
- [x] GOOGL/MU/AMD/CRWV/NBIS/IREN/SNDK carry dated reference memos; MACRO/TECH keyword additions are >=3 characters and the research digest records the supplied time series plus eight visual observations.
- [x] JSON/JS syntax, runtime contract, knowledge integration, and diff checks pass; final local QA passes headless 1102/1102, architecture 17-route/browserErrors 0, viewport 68/68, accessibility 17/17, critical10 10/10, Vault PFE2-01~08, boot, and SA-02~04.

## P833 KV-only fast quote plane (2026-07-27, v53.42)

- [x] R2 subscription, R2 bucket binding, and `AIO_QUOTES_R2_BUCKET` are removed from the deploy path; only Cloudflare token, account ID, and KV namespace ID are required.
- [x] Worker reads/writes `quotes:current` and `quotes:heartbeat` through KV only; missing KV remains fail-closed and retains the last-known-good KV state.
- [x] `AIO_FAST_QUOTES_URL` remains a public repository variable containing only the deployed fast quote Worker base URL; deploy smoke checks `/health` and requires Tier0 16/16.
- [x] KV-only data-plane contract (including KV `/health` fixture), workflow YAML, syntax, and full local browser/viewport/accessibility/critical10/Vault smoke verification pass; live Worker smoke and seven-day soak remain operator-required.

## P827~P830 current secondary-surface closure (2026-07-27, v53.39)

- [x] Breadth participation and McClellan status are native, fail-closed, and fenced from legacy writers; all five breadth charts have native lifecycle markers and unavailable-history handling.
- [x] FX-bond TNX/JPY trend and current Treasury curve charts are native, source-labelled, and fail closed when history/current tenor evidence is missing.
- [x] Ticker extended-session and portfolio P&L/value surfaces are native; no holding, missing quote, and hidden extended-session states are explicit.
- [x] Portfolio holdings table is native DOM-safe rendering from the normalized Vault-backed state, with nine columns, textContent values, and delegated CRUD/chart actions.
- [x] Architecture contract/browser and Vault E2E PFE2-01~08 pass; current browser evidence is 17 routes, 42 canvases, 12 timers, and browserErrors 0.
- [ ] Data lineage full-green remains blocked by `data.json` freshness (14.1h > 12h); the refresh attempt failed closed at `CORE_QUOTE_COVERAGE_FAILED:0/78` and preserved the last-known-good artifact.
- [ ] Cloudflare credentials/7-day soak, provider rights, and SEC `SEC_USER_AGENT`/coverage expansion remain operator-required; no live certification is inferred.

## P831 portfolio deterministic summary surface (2026-07-27, v53.40)

- [x] `portfolio-surface.v1` derives holding count, P/L/day, cash, VIX exposure, and sector allocation from normalized state plus quote evidence with finite-safe unavailable states.
- [x] `portfolio.js` owns the declared summary/allocation/exposure ids with DOM-safe rendering and provenance markers; risk cards, charts, AI workbench, and narrative remain separate legacy boundaries.
- [x] Legacy `updatePortfolioSummary()` and both sector writers consult the native surface fence before writing transferred ids.
- [ ] Architecture contract/browser, full headless/viewport/accessibility/critical-10, and release manifest revalidation remain pending after the complete code sequence.

## P832 fundamental SEC core report surface (2026-07-27, v53.41)

- [x] `sec-report.v2` projects official SEC annual-fact filing identity, period/submission metadata, coverage, finite observed metrics, and freshness state.
- [x] `entity.js` owns the native `fund-native-sec-report` child with source/provenance markers and unavailable states for missing facts.
- [x] Multi-source legacy report sections (peer/news/external, charts, and AI narrative) remain explicitly separate and are not presented as official SEC evidence.
- [ ] Architecture browser/full release QA and SEC coverage expansion remain pending.
# 2026-07-18 통합/압축: 검증 완료된 버전별 원장(v34.x~v53.4)을 §6 압축 원장으로 축약, 퇴역 표면(KR 독립 5페이지 등) 항목 제거.
# 각 버전 원장의 원문 전체 체크박스는 git 히스토리(이 파일의 2026-07-18 이전 리비전) 참조.
---

# AIO Screener — QA 체크리스트 v4.0

> **핵심 원칙**: 코드 수정 → "고쳤다" 선언 금지. **게이트/브라우저에서 직접 확인한 증거**가 있어야 완료.
> 반복 요청 분석 최다 빈도 #1: "코드 고쳤다면서 브라우저에서 안 되잖아" — 이 체크리스트의 존재 이유.
> 테스트 그린만으로 안심 금지 — assert되지 않는 경로의 버그(P678 클래스)는 스위트가 못 잡는다.

## P781~P783 중간점검 회귀 체크

- [ ] `route-owners.json.routes`에서 재계산한 5차원 owner counts/native/legacy/full-native가 파일 요약과 정확히 일치한다.
- [ ] old SW controller 응답 후 `controllerchange`가 발생하면 화면의 SW 버전과 mismatch 경고가 새 controller 응답으로 갱신된다.
- [ ] 외부 quote 네트워크 차단 + published snapshot 16/16에서 topbar가 `기준 시세`, `fb-static`, 실제 observed-at/count를 표시하며 live로 승격하지 않는다.
- [ ] proxy circuit open + snapshot 가용 시 Stooq/Yahoo rescue가 재호출되지 않고 `fetchLiveQuotes` 내부 self-retry가 등록되지 않는다.
- [ ] 일부 `live:` quote만 수신하고 core coverage가 부족하면 `일부 실시간`으로 표시한다.
- [ ] 서버 FRED/HY artifact 성공 상태에서는 부팅 중 브라우저 FRED/HY proxy fallback을 호출하지 않는다.

## P784 SA bounded packet 회귀 체크

- [x] SA-01: Yahoo chart caller uses `fetchViaProxy`/`_PROXY_REGISTRY`; direct chart proxy array is absent and invalid payloads count as failures.
- [x] SA-01: deterministic three-failure cooldown and later success restoration pass in headless `T1041`; headless result `1102/1102 PASS`.
- [x] SA-02: external quote hosts blocked twice; same-origin snapshot applies 16 reference sources and topbar remains `기준 시세` + `fb-static`; `fetchLiveQuotes._failCount` does not self-retry.
- [x] SA-03: old controller → one `controllerchange` → current version re-query; exactly two version queries, one change, no navigation loop.
- [x] SA-04: server FRED/HY success produces zero browser FRED/HY requests; quote request count `83` stays below the documented ceiling `100`.
- [x] SA-05: current generated preflight matches HEAD/version and all historical checkout/deployment claims are explicitly labeled.

## P785 ARX-11 bounded technical health 회귀 체크

- [x] 순수 `market-health.v1` 모델이 SPY/QQQ/VIX 필수 입력 결측을 `score:null`·`판정 보류`로 fail-closed 처리한다.
- [x] bullish/defensive/neutral threshold fixture가 score/grade/regime/bar 결과를 고정한다.
- [x] `technical` native renderer가 health primary sink 11/11을 렌더하고 `data-aio-technical-renderer="native"`를 기록한다.
- [x] legacy `computeMarketHealth()` 및 `_initTechnicalPage()` 직접 호출이 native health surface를 덮어쓰지 않는다(`NATIVE-FENCE`).
- [x] 촛대·RSI/MACD·Weinstein/MTF·내러티브는 legacy secondary boundary로 원장에 남아 있다.

## P786 ARX-11 bounded signal hero 회귀 체크

- [x] `signal-presentation.v1`가 canonical `trading-score.v1`에서 5-tier 한국어 판정문을 파생하고 machine action envelope와 분리한다.
- [x] 필수 입력 결측/부분 입력은 `판정 보류`와 `—`/`*` 표시로 fail-closed 처리한다.
- [x] `signal` native renderer가 `score-gauge-val`, `score-decision-badge`, `score-decision-sub` 3/3을 렌더하고 native marker를 기록한다.
- [x] legacy `refreshSignalDashboard()`가 native signal marker 아래 3개 primary sink를 덮어쓰지 않는다(`NATIVE-FENCE`).
- [x] signal canvas/factor bars/execution-window/risk-monitor/timestamp/narrative 및 home summary는 별도 legacy secondary 경계로 유지된다.

## P787 ARX-11 bounded home aggregate 회귀 체크

- [x] `home` native renderer가 canonical `signal-presentation.v1`에서 `home-hero-total`, `home-hero-headline`, `home-hero-desc`, `home-trading-signal` 4/4를 렌더링한다.
- [x] missing/partial score는 홈 summary에서 `—`/`*`와 판정 보류 문구로 fail-closed 표시된다.
- [x] `data-aio-home-renderer="native"` marker가 route mount/dispose와 함께 설정·해제된다.
- [x] legacy `_aioRenderHomeHero()` 및 `refreshHomeDashboard()`가 native marker 아래 네 primary sink를 덮어쓰지 않는다(`NATIVE-FENCE`).
- [x] quality meter, Fear & Greed, regime, factor detail, chart, narrative는 P787 범위 밖의 legacy secondary boundary로 유지된다.

## P788 derived theme-detail summary 회귀 체크

- [x] `theme-detail` canonical redirect remains an inline panel on `themes`; no separate static route renderer is reintroduced.
- [x] `#theme-detail-native-summary` renders selected label, performance/source status, and representative leaders through `themes.js` with textContent/DOM APIs.
- [x] `showThemeDetail()` writes only `#theme-detail-legacy-content`; subtheme, breadth, deep-analysis, chart, and narrative surfaces remain explicitly legacy-owned.
- [x] Chromium asserts native summary visible + legacy body populated, 17-route two-lap resources `42` canvases / `12` timers, and browserErrors `0`.

## P789 theme-detail composition/breadth regression check

- [x] `#theme-detail-native-composition` renders subtheme composition, constituent chips, and breadth from the explicit selection payload using safe DOM APIs.
- [x] quote evidence and breadth are fail-closed to `시세 대기` when sufficient constituent price coverage is unavailable; no unavailable live value is promoted.
- [x] `showThemeDetail()` no longer emits the legacy subtheme/breadth DOM; detailed leader cards and deep-analysis narrative remain the declared legacy boundary.
- [x] Architecture contract and Chromium assert native summary/composition visibility, populated legacy body, `42` canvases / `12` timers, and browserErrors `0`.

## P790 theme-detail detailed leaders regression check

- [x] `#theme-detail-native-leaders` renders the detailed leader-card grid, price, and change values from normalized quote evidence using safe DOM APIs.
- [x] Missing leader quote values remain `가격 대기`/`등락률 대기`; the native surface does not infer unavailable prices.
- [x] `showThemeDetail()` no longer emits the legacy leader-card block; deep-analysis narrative remains the declared legacy boundary.
- [x] Architecture contract and Chromium assert native summary/composition/leaders visibility, populated legacy body, `42` canvases / `12` timers, and browserErrors `0`.

## P791 theme-detail temperature narrative regression check

- [x] `#theme-detail-native-temperature` renders the canonical theme-temperature diagnosis from the normalized selected performance.
- [x] Missing performance remains `시세 대기`; the native narrative does not manufacture a temperature class.
- [x] The legacy deep-analysis temperature section is fenced while spread, breadth-health, benchmark, and remaining narrative sections stay separately declared.
- [x] Architecture contract and Chromium assert native summary/composition/leaders/temperature visibility, populated legacy body, `42` canvases / `12` timers, and browserErrors `0`.

## P792 theme-detail performance-spread narrative regression check

- [x] `#theme-detail-native-spread` renders leader performance spread and strongest/weakest constituent readout from normalized quote evidence.
- [x] Fewer than two quote changes remain `시세 대기`; no spread or ranking is inferred from missing values.
- [x] The legacy performance-spread section is fenced while breadth-health, subtheme gap, benchmark, and remaining narrative sections stay separately declared.
- [x] Architecture contract and Chromium assert native summary/composition/leaders/temperature/spread visibility, populated legacy body, `42` canvases / `12` timers, and browserErrors `0`.

## P793 theme-detail breadth-health narrative regression check

- [x] `#theme-detail-native-breadth-health` renders the breadth-based theme health interpretation from normalized detail evidence.
- [x] Missing breadth/quote coverage remains `시세 대기`; no health classification is inferred from unavailable values.
- [x] The legacy breadth-health section is fenced while subtheme gap, benchmark, and remaining narrative sections stay separately declared.
- [x] Architecture contract and Chromium assert native summary/composition/leaders/temperature/spread/breadth-health visibility, populated legacy body, `42` canvases / `12` timers, and browserErrors `0`.

## P794 theme-detail subtheme-gap narrative regression check

- [x] `#theme-detail-native-subtheme-gap` renders strongest/weakest subtheme performance and the gap from normalized subtheme quote evidence.
- [x] Fewer than two observed subtheme performances remain `시세 대기`; no gap or ranking is inferred from missing values.
- [x] The legacy subtheme-gap section is fenced while benchmark and remaining narrative sections stay separately declared.
- [x] Architecture contract and Chromium assert native summary/composition/leaders/temperature/spread/breadth-health/subtheme-gap visibility, populated legacy body, `42` canvases / `12` timers, and browserErrors `0`.

## P795 theme-detail benchmark narrative regression check

- [x] `#theme-detail-native-benchmark` renders selected-theme versus ETF/composite-base performance from normalized theme and benchmark quote evidence.
- [x] Missing theme/benchmark performance remains `시세 대기`; no relative comparison is inferred from unavailable values.
- [x] The legacy benchmark section is fenced while theme insights, chart, and data sections stay separately declared.
- [x] Architecture contract and Chromium assert native summary/composition/leaders/temperature/spread/breadth-health/subtheme-gap/benchmark visibility, populated legacy body, `42` canvases / `12` timers, and browserErrors `0`.

---

## §0. QA 게이트 실행 절차 (현행 — 2026-07-18 기준, 라우트 17개 체제)

수정 후 아래를 순서대로 실행한다. **전부 PASS**여야 배포 가능(사용자 명시 승인 시).

### 정적 게이트 (15종, `node scripts/<이름>.mjs`)

```
ci-control-char-check      ci-worker-anthropic-check   ci-version-check
ci-release-revision-check  ci-data-lineage-audit       ci-static-data-contract-check
ci-history-field-time-contract-check
ci-structural-check        ci-ux-default-path-check    ci-runtime-contract-check
ci-data-pipeline-contract-check  ci-semantic-review-check  ci-workflow-compaction-check
ci-skill-contract-check    ci-doc-currency-check       ci-knowledge-lint-check
```

- JS 문법: `node --check js/aio-{core,data,ui,chat,tests,glossary}.js` + 변경된 `scripts/*.mjs`
- **Windows 로컬 함정 (2026-07-18 실측)**: `ci-data-lineage-audit`의 data.json 신선도 FAIL은 로컬 체크아웃이 낡은 것일 수 있음 — 원격 크론 확인(`gh run list --workflow=refresh-data.yml`) 후 `git pull` 먼저. `ci-data-pipeline-contract-check`의 screener-universe drift는 CRLF 아티팩트일 수 있음 — `node scripts/sync-screener-universe.mjs` 재생성 후 diff 0이면 내용 드리프트 아님.

### 브라우저 게이트 (6종, Playwright/Chromium)

| 게이트 | 명령 | 기준 |
|--------|------|------|
| 헤드리스 전체 테스트 | `node scripts/ci-headless-tests.mjs` | 1101/1101 PASS (skip-list 밖 실패 0) |
| 부팅 성능 | `node scripts/ci-boot-interaction-check.mjs` | FCP ≤2.5s · 첫 라우트 ≤2s · long task ≤2.5s |
| viewport 매트릭스 | `AIO_VIEWPORT_FULL_INIT=1 node scripts/ci-viewport-matrix-check.mjs` | 17라우트×4뷰포트=68/68 · overflow 0px · tinyText 0 · jsErrors 0 |
| critical-10 표면 | `node scripts/ci-critical10-human-surface-check.mjs` | 10 routes pass · consoleErrors 0 |
| 포트폴리오 Vault E2E | `node scripts/ci-portfolio-vault-e2e.mjs` | PFE2-01~08 PASS |
| 접근성 매트릭스 | `node scripts/ci-accessibility-matrix-check.mjs` | 17 routes pass · consoleErrors 0 |

## 2026-07-19 v53.13 최종 릴리스 증거 (P734)

- [x] Local Portfolio Vault E2E 8/8, including `reload_requires_unlock`
- [x] RSS retry/backstop data-pipeline contract and `fetch-data.mjs` syntax
- [x] Refresh run `29670719055`: `news 31`, public-data commit `313b7db`
- [x] Downstream CI `29670732380`: validate, headless, route accessibility, viewport 68/68, Critical-10, Vault, Pages deploy
- [x] Live invariant: `v53.13`, `symbolsOk=78`, `newsCount=31`

## 2026-07-19 v53.14 data-reliability execution evidence (P735)

- [x] `ci-history-field-time-contract.mjs`: 369 rows, 3,535/3,535 numeric fields with field-level evidence; NFP 10x fixture PASS
- [x] `ci-static-data-contract.mjs`: 22/22 PASS; canonical Tier-0 market snapshot 16/16 PASS
- [x] FRED LKG merge, durable HY OAS server-data projection, and AI semantic publish gate wired
- [x] Operations/reconciliation remain explicit: `OPERATOR_REQUIRED`; counts `MATCH 3 / PARTIAL 14 / BLOCKED 5`
- [ ] Cloudflare fast-plane credentials/resource IDs and 7-day 99% soak; provider rights and SEC 80% coverage remain external blockers

## 2026-07-19 v53.15 architecture ownership cutover evidence (P736/R352)

- [x] Sentiment lifecycle, native renderer, and fail-closed badge are ESM-owned; producer input remains explicitly behind the read-only compatibility adapter
- [x] Retired legacy `PAGES.sentiment.init`, duplicate sentiment badge writer, and `aio-data.js` `window.showPage` monkeypatch
- [x] Legacy coupling burn-down: prior lifecycle batch 1110→1109 plus ARX-01 renderer batch 1109→1100; ARX-02/03 cleanup reduces explicit global writes 1100→1097 and HTML sinks 420→418; direct fetch 42 and storage 189 remain
- [x] Follow-up checkpoint: current static counters are explicit global writes 1094, direct fetch 42, direct storage 189, and HTML sinks 416; full regression remains deferred until all architecture packets complete
- [x] Architecture gate blocks burn-down regression, retired-pattern return, and release-manifest/version drift
- [x] Operations ownership records native lifecycle/renderer owners `['briefing','guide','market-news','sentiment']`; `legacyOwner=13` and `nativeOwner=[]` remain explicit while data/narrative ownership is still legacy
- [x] Cross-session execution contract covers 14 layers, all 17 routes, ARX-00~16 dependency waves, pre-edit DELETE-LEDGER, five owner dimensions, and AC-01~15 final acceptance
- [x] `ci-architecture-contract-check.mjs` blocks removal/drift of the execution plan's layer, route, session-card, deletion-ledger, ownership, and final-acceptance structure
- [x] Regression: static/data/security contracts 22종, headless 1101/1101, Critical-10 10/10, a11y 17/17, viewport 68/68, Vault 8/8 PASS
- [x] Boot budget: FCP 952ms, first route 552ms, max long task 421ms (single local run; 성능 인과 주장에는 미사용)
- [ ] AR-09 full renderer/data-writer cutover remains open; do not report architecture rebuild complete

## 2026-07-19 ARX-01 sentiment renderer cutover

## 2026-07-19 ARX-09~16 local cutover

- [x] Entity, portfolio, screener, and analysis slices use native command/provider/selector boundaries.
- [x] Pure domain model versions and live/backtest parity fixture added.
- [x] AI context/retrieval/provider/web-search/response envelopes added with evidence traceability gates.
- [x] Versioned repository, privacy vault, migration/rollback fixture, release asset manifest, and retirement contract added.
- [ ] Full §8.1 browser/runtime/accessibility/regression gates are intentionally run only after every packet is applied.
- [x] P738 runtime contract gate accepts native theme/sentiment ownership, tests the native VIX blocked state, and protects live CNN F&G delta precedence over snapshot repaint.
- [x] P739 deferred browser gates: hidden F&G/VIX projections stay synchronized, explicit sentiment patches beat snapshot evidence, native narrative registry includes sentiment, and `theme-detail` opens its canonical inline panel.

- [x] `src/ui/pages/sentiment.js` owns sentiment cards, blocked/observed state, F&G/VIX/PutCall/HY/AAII projection rendering, VIX charts, and resource-bag disposal.
- [x] Removed `initSentimentPage`, sentiment chart registry/helpers, data chart back-reference, facade sentiment mount map, and tests that asserted retired symbols.
- [x] Native renderer reads store/evidence state only; producer input remains explicitly legacy/read-only until ARX-02.
- [x] Operations ownership now separates `nativeRendererOwner=['sentiment']` from `legacyOwner=16`; `nativeOwner=[]` remains correct while data owner is legacy.
- [x] Static/module syntax and retired-symbol scan completed; full §8.1 regression and browser gates deferred until all architecture packets are complete per execution instruction.

### 최근 실측 기준선 (2026-07-19, v53.13, AR-07 data plane + AR-06 inference + typed navigation facade)

정적 15종 전부 PASS(data-lineage WARN 1: SEC 93/655=14.2%) · 헤드리스 1101/1101 · boot FCP 1556ms/route 1162ms/max long task 611ms · critical10 10/10(consoleErrors 0) · a11y 17/17(consoleErrors 0) · FULL_INIT viewport 68/68(4개 viewport shard, overflow 0px, tinyText 0, jsErrors 0) · vault E2E 8/8 PASS. 부팅 수치는 단일 로컬 실행의 변동값이므로 P728의 인과 성능 향상 근거로 사용하지 않는다. 로컬 Chromium은 외부망 차단 상태로 실행했으며 live Pages/Worker/provider 응답은 이 기준선에 포함하지 않는다.

추가 AR gate(v53.15): `ci-architecture-contract-check.mjs`는 17 routes, explicit global writes ≤1109, 퇴역 legacy 패턴, release revision parity를 차단한다. `ci-architecture-browser-check.mjs`는 ESM boot, blocked sentiment, router/store route 일치, ESM badge writer, sentiment→home→sentiment dispose/mount, unexpected browser errors 0을 검증한다.

AR-07/06 추가 로컬 계약: Tier 0 market snapshot 16/16 published fixture PASS · Worker Cron/KV/R2 contract PASS · operations status `OPERATOR_REQUIRED`/durable `CURRENT` 명시 · 22-category reconciliation `MATCH 3 / PARTIAL 13 / BLOCKED 6` · WebSearch inferred claim high-confidence two-source gate PASS · typed `showPage`/`AIO_ARCH.navigate` facade Chromium PASS. Cloudflare credentials/resource IDs와 7-day soak은 외부 운영자 대기 상태다.
Standalone worker security gate also exits deterministically after PASS (`ci-worker-anthropic-check.mjs`, exit code 0).

## 2026-07-22 RM-03 P755~P759 domain extraction evidence

- [x] Retired the unreferenced `deriveNewsClaim` toy and replaced the live `deriveTechnicalModel` caller with `deriveTechnicalStageFromOhlcv`.
- [x] Extracted treasury-curve, portfolio-concentration, and screener factor-ranks pure models; legacy wrappers retain input/projection compatibility only.
- [x] Screener factor-ranks parity: 5 golden fixtures (4 synthetic edge-case universes + real 873-row SCREENER_DB capture); ESM unit coverage includes NaN, missing eligibility, inactive factors, and stable ties.
- [x] Re-registered every new domain bridge in `bootstrap.js` and `compatibility-facade.js`; added `factor-ranks.js` to service-worker shell assets.
- [x] Local gates: domain parity, ESM unit, architecture/retirement/runtime/release/version/static-data/knowledge-lint, headless, and 17-route Chromium round-trip all PASS; live certification and native screener cutover remain open.

## 2026-07-22 ARX-10/P760 native screener cutover evidence

- [x] Native screener provider joins the published factor artifact with the identity universe, preserves observation/use metadata, and enriches optional live price/market-cap fields.
- [x] Native screener state is ranked through `computeFactorRanks`; native renderer owns the 22-column table, filters, tabs, factor panel, backtest panel, profile controls, watchlist, and position sizing.
- [x] Legacy screener DOM writers and obsolete backtest/action helpers were removed; profile/watchlist storage and the native metadata/breadth bridge remain explicit compatibility boundaries.
- [x] Architecture/retirement/runtime, domain parity, ESM unit, release/version/static-data/knowledge-lint, 17-route browser round-trip, and final headless suite were rerun; live provider/soak certification remains operator-required.

## 2026-07-22 P761-P764 continuation evidence

- [x] Removed uncalled market/screener smoke-only domain modules and their service-worker/parity references.
- [x] Replaced the signal decision toy with the `signal-from-trading-score.v1` mapping and threaded `tradingScoreInputs` through the analysis compatibility boundary.
- [x] Extracted `factor-weights.v1` as the pure regime/profile resolver; legacy `_aioFactorWeights` retains no deterministic formula.
- [x] Exposed `AIO_ARCH.getScreenerRows()` and migrated portfolio, ticker, fundamental, chat, watchlist, UI audit, and ticker overview reads to `_aioGetCanonicalScreenerRows()`.
- [x] Re-ran syntax, ESM unit, runtime/architecture counters (1069/42/186/399), browser route round-trip with browserErrors 0, and headless 1098/1098 PASS.
- [x] Retired the duplicate legacy screener fetch/projection; remaining open work is identity/memo producer retirement, route-owner burn-down, and operator-required live rights/deployment/soak.

## 2026-07-22 P768 native screener single-fetch compatibility bridge evidence

- [x] Native bootstrap exposes `getScreenerState()` and emits `aio:nativeScreenerReady`; legacy data code consumes only state metadata/breadth through `_aioApplyNativeScreenerState()`.
- [x] Removed the legacy runtime `screener.json` fetch and `_aioApplyServerScreener` bulk factor projection; identity/memo and Telegram overlays remain separately documented compatibility boundaries.
- [x] Native provider carries published breadth/backtest metadata, and runtime/data-pipeline contracts enforce the single-fetch/versioned-Kalman boundary.
- [x] Architecture counters are `1068/41/186/399`; syntax, ESM, runtime, data-pipeline, domain, architecture, browser (`browserErrors:0`), and headless (`1098/1098`) gates pass.

## 2026-07-22 P769 market-news primary feed renderer evidence

- [x] Native `src/ui/pages/news.js` owns `live-news-feed`, count, progressive reveal summary, empty state, and category cards from canonical news state.
- [x] Removed legacy `renderFeed()` and direct legacy feed loading/error/count/progressive writers; filter, sort, type, and translation paths dispatch `aio:newsSurfaceInvalidated` or update explicit input state only.
- [x] `route-owners.json`, `retirement-manifest.json`, and `operations-status.json` reconcile to renderer-native market-news with 13 remaining legacy renderer routes; briefing remains the next content cutover.
- [x] Syntax, architecture, data-pipeline, runtime, ESM, domain, retirement, operations, Chromium 17-route round-trip (`browserErrors:0`), and headless (`1098/1098`) gates pass.

## 2026-07-22 P770 briefing primary feed renderer evidence

- [x] Native `src/ui/pages/news.js` owns `briefing-live-news-list`, `briefing-24h-count`, `briefing-24h-ts`, and `briefing-news-more` from the canonical news store and the completed 08:00 KST model.
- [x] Removed legacy briefing primary-feed loading/timeout/empty/error/count/timestamp/reveal writers; `renderBriefingFeed`, AI generation, and cap/toggle surfaces remain compatibility adapters without primary DOM writes.
- [x] Route, retirement, and operations ledgers reconcile to renderer-native briefing (5/17 native renderer, 12 legacy renderer); secondary `briefing-digest` narrative remains explicitly legacy-owned.
- [x] Syntax, runtime, architecture, data-pipeline, retirement, operations, Chromium (`briefingRenderer:native`, `briefingFeedRenderer:native`, `browserErrors:0`), and headless (`1098/1098`) gates pass.

## 2026-07-22 P771 macro primary metric renderer evidence

- [x] Native `src/ui/pages/market.js` owns the macro primary `[data-live-price]`, `[data-live-chg]`, and FRED-backed `[data-snap]` metric surface.
- [x] Legacy `applyLiveDataToDom`, `applyLiveQuotes`, `applyDataSnapshot`, FRED, BOK, and KOSIS DOM passes fence native macro elements; curve/chart/event-freshness/narrative ids remain explicit secondary legacy boundaries.
- [x] Route, retirement, and operations ledgers reconcile to renderer-native macro (6/17 native renderer, 11 legacy renderer); data ownership remains legacy by design.
- [x] Syntax, runtime, architecture, data-pipeline, retirement, operations, Chromium (`macroRenderer:native`, `macroPrimaryRenderer:native`, 41 live/46 snapshot sinks, `browserErrors:0`), and headless gates pass.

## 2026-07-22 P772 fxbond primary metric renderer evidence

- [x] Native `src/ui/pages/market.js` owns all fxbond primary `[data-live-price]`, `[data-live-chg]`, and `[data-snap="move"]` sinks.
- [x] Legacy live quote/snapshot passes fence `#page-fxbond[data-aio-architecture-renderer="native"]`; risk pill, spread/carry narrative, and trend/yield-curve charts remain documented secondary legacy boundaries.
- [x] Route, retirement, and operations ledgers reconcile to renderer-native fxbond (7/17 native renderer, 10 legacy renderer); data/chart/narrative ownership remains legacy by design.
- [x] Syntax, architecture, data-pipeline, retirement, operations, Chromium (`fxbondRenderer:native`, native live/MOVE sinks), and headless (`1098/1098`) gates pass.

## 2026-07-22 P773 breadth primary current-metric renderer evidence

- [x] Native `src/ui/pages/market.js` owns the current timestamped screener-artifact 5/20/50SMA cards, their bars/freshness, and the canonical advance-ratio sink.
- [x] Native breadth prefers `AIO_ARCH.getScreenerState().metadata.breadth.segments.us`; the legacy `AIO.getCurrentBreadthEvidence()` path remains only as an explicit compatibility fallback.
- [x] Legacy `applyDataSnapshot`, `_aioSyncBreadth50Readout`, `updateBreadthBars`, `initBreadthPage`, and `updateBreadthUI` fence native breadth primary elements. Stage/diagnostic/McClellan/RSP-SPY narrative and historical chart ids remain documented secondary boundaries.
- [x] Route, retirement, and operations ledgers reconcile to renderer-native breadth (8/17 native renderer, 9 legacy renderer) and data-native breadth (2/17).
- [x] Syntax, architecture, data-pipeline, retirement, operations, Chromium (`breadthRenderer:native`, 4/4 native primary sinks, values `35%/47%/55%/34.8%`, `browserErrors:0`), 17-route round trip, and headless (`1098/1098`) gates pass.

## 2026-07-22 P777 bounded ticker hero native surface evidence

- [x] `src/ui/pages/entity.js` owns the bounded ticker hero primary sinks `ticker-hero-name`, `ticker-hero-fullname`, `ticker-hero-price`, and `ticker-hero-chg` from normalized entity state; fundamentals/options and ticker secondary overview/candle/entry surfaces remain legacy boundaries.
- [x] `showTicker()` no longer writes the four primary hero sinks; the shared accessibility initializer preserves explicit `.page-title` IDs and only generates `page-*-label` when a title has no ID.
- [x] Route/retirement/operations ledgers reconcile to renderer-native ticker (10/17 native renderer, 7 legacy renderer). Chromium reports ticker primary sinks `4/4`, values `AAPL / Apple Inc. / — / —`, `browserErrors:0`, and 17-route two-lap `canvases:42→42`, `timers:12→12`.
- [x] Syntax, architecture (`1081/40/186/377`), retirement, operations, runtime, data-pipeline, structural, control-character, version, doc-currency, browser, and headless (`1098/1098`) gates pass.
- [ ] `ci-live-invariant-check.mjs`, provider rights, Cloudflare credentials/7-day soak, deployment, and live certification remain operator-required.

## 2026-07-22 P780 bounded portfolio readiness/status native surface evidence

- [x] `src/ui/pages/portfolio.js` owns only `#page-portfolio #pf-analysis-status` from the native portfolio slice; encrypted Vault consent, CRUD, holdings table, totals/prices, risk metrics, AI workbench, and charts remain legacy boundaries.
- [x] No competing legacy writer for `pf-analysis-status` was found. Native rendering emits fail-closed empty/unavailable state or position-count readiness text with `data-source-kind`, `data-source-label`, `data-operational-use="reference-only"`, and `data-observed-at`.
- [x] Route/retirement/operations ledgers reconcile to renderer-native portfolio (13/17 native renderer, 4 legacy renderer). Chromium asserts portfolio status sink `1/1`, browserErrors `0`, and 17-route resources remain `42→42` canvases / `12→12` timers.
- [x] Syntax, architecture (`1081/40/186/377`), retirement, operations, runtime, data-pipeline, structural, control-character, version, doc-currency, browser, and headless (`1098/1098`) gates pass.
- [ ] Full portfolio Vault/CRUD/table/risk/chart ownership, `ci-live-invariant-check.mjs`, provider rights, Cloudflare credentials/7-day soak, deployment, and live certification remain operator-required or separately scoped.

## 2026-07-22 P779 bounded fundamental SEC status native surface evidence

- [x] `src/ui/pages/entity.js` owns only `#page-fundamental #fund-data-status` from normalized `sec-fundamentals.json` evidence; the full SEC/FMP/Yahoo/Finnhub report, charts, and AI narrative remain legacy boundaries.
- [x] No competing legacy writer for `fund-data-status` was found. Native rendering emits fail-closed unavailable state plus `data-source-kind`, `data-source-label`, `data-operational-use="reference-only"`, and `data-observed-at` when available.
- [x] Route/retirement/operations ledgers reconcile to renderer-native fundamental (12/17 native renderer, 5 legacy renderer). Chromium asserts fundamental status sink `1/1`, value `● SEC 연간 데이터`, and `official-regulator` lineage for AAPL; browserErrors `0`.
- [x] Syntax, architecture (`1081/40/186/377`), retirement, operations, runtime, data-pipeline, structural, control-character, version, doc-currency, browser, and headless (`1098/1098`) gates pass.
- [ ] Full fundamental report ownership, SEC coverage expansion, `ci-live-invariant-check.mjs`, provider rights, Cloudflare credentials/7-day soak, deployment, and live certification remain operator-required or separately scoped.

## 2026-07-22 P778 bounded options replacement-metric native surface evidence

- [x] `src/ui/pages/entity.js` owns only `opt-vix-val-secondary`, `opt-pcr-val-secondary`, and `opt-skew-val-secondary` from normalized entity options evidence; the page remains an explicit no-options-chain/reference-only surface.
- [x] Legacy generic quote/snapshot/PCR paths fence the native `#page-options` subtree, and the old direct PCR ID writer was removed so AG-DOM-WRITER has no native/legacy content race.
- [x] Route/retirement/operations ledgers reconcile to renderer-native options (11/17 native renderer, 6 legacy renderer). Chromium asserts options `native` and primary sinks `3/3`; 17-route two-lap resources remain `42→42` canvases and `12→12` timers with `browserErrors:0`.
- [x] Syntax, architecture (`1081/40/186/377`), retirement, operations, runtime, data-pipeline, structural, control-character, version, doc-currency, browser, and headless (`1098/1098`) gates pass.
- [ ] Options-chain/Greeks provider rights, `ci-live-invariant-check.mjs`, Cloudflare credentials/7-day soak, deployment, and live certification remain operator-required.

## 2026-07-22 P776 theme-detail derived-route retirement evidence

- [x] Reconfirmed `showPage('theme-detail')` canonicalizes to `themes` and opens the live legacy inline `#theme-detail-panel`; it is not an independent user route with a native data payload.
- [x] Removed the standalone static-page `renderPageThemeDetail()` declaration and its inline-panel call; updated route-owner evidence to distinguish the live inline panel from the retired `theme-detail-title` writer.
- [x] Added `retiredLegacySymbolsMustBeAbsent` coverage to architecture and retirement contracts; syntax, architecture, retirement, operations, doc-currency, and headless `1098/1098` pass after the P776 patch.
- [ ] The inline detail panel, its HTML composition, ticker quotes, and AI/deep-analysis narrative remain legacy-owned and require a separate data/render packet; no native theme-detail renderer claim is made.

## 2026-07-22 P775 themes bounded native surface evidence

- [x] `src/ui/pages/themes.js` owns `#rrg-quadrant-cards` and `#rrg-rotation-read` from normalized theme state; the view selector re-renders through `aio:themesViewChanged` without restoring the removed legacy `renderRRGQuadrantCards()` function.
- [x] `rrg-chart-status`/`rrg-canvas` remain explicit secondary chart boundaries, and `theme-detail` remains separately legacy-owned; no static RRG seed was promoted to the native primary renderer.
- [x] `ci-architecture-contract-check.mjs`, `ci-retirement-contract.mjs`, `ci-operations-status-check.mjs`, Chromium 17-route two-lap round trip, and headless `1098/1098` pass; Chromium reports themes native primary sinks `2/2`, `quadrantCount:0` under unavailable live-history state, and `browserErrors:0`.
- [ ] `ci-live-invariant-check.mjs` remains unverified because the deployed GitHub Pages site could not be fetched; provider rights, Cloudflare credentials/soak, deployment, and SEC coverage remain operator-required.

## 2026-07-22 P774 declaration-only legacy cleanup evidence

- [x] Removed declaration-only legacy news/briefing/screener functions and only-dependent sparkline helpers after the P769/P770 primary-feed transfers; no new parallel renderer was introduced.
- [x] Updated T890/T940 to encode the retired native briefing owner: `_generateAIBriefing` is expected to be absent and the native response pipeline is the valid remaining contract.
- [x] `ci-structural-check.mjs`, `ci-control-char-check.mjs`, architecture/data-pipeline/retirement/runtime contracts, doc currency, Chromium 17-route two-lap round trip, and headless `1098/1098` pass.
- [ ] `ci-live-invariant-check.mjs` remains unverified in this environment because the deployed GitHub Pages site could not be fetched; Cloudflare/provider rights and soak remain operator-required.

## 2026-07-22 P767 native screener data-pipeline contract evidence

- [x] Native screener backtest panel discloses excluded factors, fixed weight regime, and that the adaptive composite rank is not validated.
- [x] Quant readiness audit exposes explicit fail-closed disclosure (`연구용 상대 랭킹이며 매매 신호 아님`) while `liveModelParity`/`predictiveValidation` are not established.
- [x] `ci-data-pipeline-contract-check.mjs` now checks the native renderer/audit owner and passes.

## 2026-07-22 P766 canonical screener helper migration evidence

- [x] `_aioExtractRecentRecommendationTickers`, `_detectSectorQuery`, `_aioRunScreenerQuery`, and `_aioMakerCheckerVerify` now obtain rows through `_aioGetCanonicalScreenerRows()`.
- [x] `src/legacy/compatibility-facade.js:readScreener` prefers `AIO_ARCH.getScreenerRows()` and retains the legacy DB only as fallback/enrichment compatibility.
- [x] Runtime contract scopes all four helper bodies and rejects direct `SCREENER_DB` reads; syntax, runtime, and ESM unit checks pass.
- [ ] Legacy screener fetch/projection retirement remains open until identity/memo and data-pipeline producers are migrated; live rights, deployment, and seven-day soak remain operator-required.

## 2026-07-22 P765 native screener DOM ownership regression evidence

- [x] AG-DOM-WRITER caught the missed `screener-readiness-note` writer when the measured native renderer count was corrected to 3.
- [x] Removed the legacy `_aioRenderQuantReadiness` function and deferred invocation; native `src/ui/pages/screener.js` is now the sole readiness-node writer.
- [x] Added `_aioRenderQuantReadiness` to `screener.legacySymbolsMustBeAbsent` so the deleted writer cannot return silently.
- [x] Architecture contract passed with counters 1069/42/186/399 and screener dispatch p95 0.069ms; 17-route browser round-trip passed with browserErrors 0 and headless passed 1098/1098.

---

## §1. 열린 항목 (Open Backlog)

- [x] **HYG 달러 가격 임계 신용 판정** — 2026-07-18 P726에서 5개 표면 전부 FRED HY OAS(`window._hySpreadBp`)로 일원화 완료(`_tempLive`/`updateRiskMonitor`/`generateFxBondCommentary`/`_aioRenderCarryUnwindRisk`/AI 채팅 fxbond 컨텍스트). Playwright 실측(missing+populated 양쪽 상태)으로 검증. **부수 발견(미해결)**: `generateFxBondCommentary()`의 대상 DOM(`#bond-dc-credit` 등 `bond-dc-*`/`fx-dc-*` 9개 id)이 v52.71 컴프 리디자인 이후 HTML에서 전부 제거된 고아 코드 — 로직은 고쳤지만 현재 화면에 렌더되지 않음(R341 대상, 아래 신규 항목 참조).
- [x] **`Number.isFinite(Number(...))` null→0 통과 가능성** — 2026-07-18 P726에서 18곳 전수 개별 판정, 14곳 실버그로 확인·수정(가장 심각: `calcKrHealthScore`가 자신의 R340 준수 주석과 모순, `updateWSAnalysis`가 결측 시 가짜 Stage 4 발화, 2s10s 브릿지가 10Y값을 스프레드로 오기록). 4곳은 이미 안전(`valid()` 헬퍼, T683/T241/T187)해 미수정.
- [x] **R309 양쪽-빈 삼항 잔재** — js/aio-data.js:3503 FRED YoY "+" 부호 복원. T765 하드코딩 기대값도 함께 수정(자기 자신이 버그를 정답으로 단언하던 사례).
- [x] **`updateFxDynamicComments()`/`generateFxBondCommentary()` 고아 코드** — 2026-07-18 P727에서 구 함수·sink·호출·wrapper를 제거했다. 현재 DOM에 남은 `fxbond-risk-pill`/`yc-inversion-badge`/Cross-Asset Matrix는 `updateFxBondPage()` 단일 경로에 통합했고 runtime contract가 회귀를 차단한다. pageShown당 무효 DOM 조회 24회, quote 갱신당 16회 제거.
- [x] **quote batch 전역 DOM 중복·퇴역 KR investor fanout** — 2026-07-18 P728에서 종목별 전역 lineage scan을 batch 마지막 1회로 defer하고, 전체 price/chg 중복 rewrite를 제거했다. 단건 갱신은 symbol-target annotation을 사용한다. 삭제된 KR 투자자 TOP10 표용 최대 24개 요청은 공유 로더에서 제거했고, runtime audit은 canonical 수급 evidence를 검사한다.
- [x] **AR-01~06 ESM sentiment lifecycle cutover** — P729 scaffold 이후 P736에서 sentiment lifecycle·badge writer를 ESM 소유로 이전하고 legacy init/badge writer/data `showPage` monkeypatch를 제거했다. renderer는 compatibility facade 뒤 legacy이므로 native renderer 0/17, 전체 AR-09는 `MIGRATION_IN_PROGRESS`다.
- [ ] SEC fundamentals 누적 커버리지 80% 도달(현재 91/655=13.9%)과 screener universe 갱신 — 외부 Actions 실행/시간 필요 (P708/P710 계열).
- [ ] AI 채팅 라이브 실문답 재검증 (P629/P645) — Worker 서버키 또는 개인키 필요. "분산 설계 안내문"의 억제 개수가 0이 아닌 실값 표시 확인.
- [ ] GitHub Pages/Worker 라이브 AI 응답·실제 모델 출력 품질·live provider 데이터 권리/legal 승인·multi-user 검증 — WP-AI 시리즈(P690~P701) 공통 미검증 잔여.
- [ ] 키보드/스크린리더 실사(자동화 불가), 장시간 리소스 누수 계측 — DEFERRED-BLOCKS B9.
- [ ] technical 페이지 통합 KR 캔들(구 kr-technical): 존재하지 않는 종목코드 입력 시 `Naver 시세 수신 실패` 폴백 문구 실브라우저 확인 — 코드 경로는 존재(index.html:27046), 실조작 미확인.
- [x] **technical 페이지 `mtf-verdict-text` 영구 플레이스홀더** (P746 → 2026-07-21 후속으로 해소) — 사용자가 "같은 라이브 데이터로 배선"을 선택. `updateMTF()`(index.html) 안에서 이미 계산 중인 `deriveMultiTimeframeView` 결과(daily/weekly/medium)로 한줄 요약을 생성하도록 배선(신규 데이터 소스 없음). `medium`이 200거래일 미만이면 항상 'pending'이라는 점을 이용해 바로 위 Weinstein Stage 위젯과 같은 200거래일 문턱으로 fail-closed 정렬(요구 없이 "정렬" 문구를 내보내지 않도록). 4개 실브라우저 시나리오(상승/하락/혼조/데이터부족)로 검증 완료.
- [x] **breadth 페이지 `breadth-stage-summary` 영구 플레이스홀더** (P746 → 2026-07-21 Fable 2차 자문으로 해소, P752) — 사용자가 "breadth 고유의 시장폭 기반 판정으로 재설계"를 선택(SPY 기준 재사용 아님). Fable이 "Stage" 라벨 자체가 부정직하다고 판정(다일 breadth 이력이 `history.json`에 전혀 없음 — `reconciliation-status.json`도 `breadth-history` 카테고리를 이미 `BLOCKED`로 기록 중이라 추세국면 판정은 지금 데이터로 불가능)해, `src/domain/market/breadth.js`(`classifyBreadthParticipation`)를 신설해 레벨(broad/neutral/narrow)×방향(rising/falling/flat, 1스텝 delta 있을 때만) 2축 분류로 대체하고 UI 라벨도 "Weinstein Stage"→"시장 참여도"로 변경했다. 4개 실브라우저 시나리오로 검증 완료. **후속 과제(제품 결정 아님, 데이터 파이프라인 과제)**: 진짜 추세인지형 breadth stage를 원한다면 `history.json`에 일별 breadth를 영속화하는 `/data-refresh` 성격의 별도 작업이 선행돼야 한다(이번 배치 범위 밖, Fable이 명시적으로 "지금 만들지 말라"고 권고).
- [x] **`_getBriefingWindowKST`(js/aio-data.js:11436~) `return` 문 뒤 도달 불가능한 사문 코드** (P749 발견 → 2026-07-21 삭제) — 11452행부터의 옛 구현(13줄)을 삭제. `node --check` 통과, 동작 변화 없음(순수 burn-down, explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 카운터 모두 이 삭제로 인한 변화 없음 — window write/fetch/storage/HTML sink가 애초에 없던 코드).
- [ ] **미추적 중복 문서 파일 정리 필요** (2026-07-21 발견) — `_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19 - 복사본.md`(git 미추적, 세션 시작 전부터 존재)가 `_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md`와 byte-for-byte 동일한 내용임을 확인. 이 파일이 `ci-knowledge-lint-check.mjs`의 Pass A(INDEX.md 문서 표 대조)를 실패시킨다(문서 표에 없는 미추적 파일). 사용자 소유 파일이라 이번 세션에서 임의 삭제하지 않음 — 삭제/이름변경/`.gitignore` 추가 중 사용자 결정 대기.

---

## §2. 최상위 바이너리 판정 (QC1~QC10)

수정 후 `/qa` 또는 `/post-edit-qa` 실행 시 **반드시** 명시적 yes/no 답변.

| # | 게이트 | 기준 |
|---|--------|------|
| **QC1** | 구조 무결성 | div 열림/닫힘 일치 AND 버전 7곳 동기화(R1) AND 콘솔 ERROR 0건 |
| **QC2** | Dead Page 없음 | **17개 라우트** 전부 3초 이내 콘텐츠 렌더 + 차트 canvas에 픽셀 존재 |
| **QC3** | 데이터 정합성 (R15) | `d.pct \|\| 0` 패턴 0건 AND 결측은 명시적 null/`—` (R342) |
| **QC4** | 네비게이션 사이클 | A→B→A / popstate / 해시 직접 접근 모두 정상 재렌더 |
| **QC5** | 뉴스 필터 규칙 (R16/R17/R22) | 매크로 뉴스 ETF 티커 0 + 3글자 미만 단독 키워드 0 + score 임계값 준수 |
| **QC6** | Dead Static HTML (P46/P58) | applyDataSnapshot map ↔ HTML `data-snap` 양방향 1:1 매칭 |
| **QC7** | 과거 버그 재발 없음 | BUG-POSTMORTEM "반복 버그 클래스" 표 grep 재발 0건 |
| **QC8** | 이벤트 정합성 (P61) | 대형 시장 이벤트 후 하드코딩 서술 텍스트가 현재 상황과 일치 |
| **QC9** | CDN SRI 완결성 (R34/P140) | `grep -c 'integrity=' index.html` ≥ 3 AND crossorigin 동반 |
| **QC10** | setInterval ID 저장 (R9/P141) | raw setInterval 없이 타이머 레지스트리/clearInterval 짝 확인 |

**판정 규칙**: 전부 yes → PASS. 1~2개 no → 해당 단계만 재실행 후 재판정(최대 2회). 3개+ no → 작업 중단·사용자 에스컬레이션.
**바이너리 원칙**: "대체로 통과" 금지 · WARN은 실패로 승격 · "미확인"은 no로 간주.

---

## §3. 핵심 절차 (수정 유형별)

### 3-0. 수정 전 스코프 매핑
수정 함수명 / 호출처(grep) / 접근 전역 변수 / 영향 페이지·DOM ID / 데이터 소스를 먼저 기록.
코드 경로 4종 확인: showPage() init · popstate · 타이머/자동갱신 · DOMContentLoaded.

### 3-1. 브라우저 런타임 (스킵 시 완료 선언 불가)
- 영향 페이지 각각: 3초 내 렌더 · 차트 픽셀 존재·비율 정상 · 수치 실값(0.00%/`—`/NaN=FAIL) · 변화율 현실적
- 네비게이션: 사이드바 A→B→A · 뒤로가기(popstate) · 해시 직접 접근 · F5 유지
- 시간 경과: 30~45초 대기 → 자동 갱신 후 차트 유지, "—"→실값 전환
- 콘솔 ERROR 0건 ("is not defined" / "Cannot read properties of null" / "Chart already initialized" 즉시 FAIL)
- API 파싱 수정 시: Network 탭에서 실제 응답 필드 존재 확인(가정 금지) — 없으면 수동 계산/폴백 필수

### 3-2. 정적 분석 (수정 유형별 필수 체크)
- **차트**: getElementById의 캔버스 ID가 올바른 page-* div 안에 존재하는지 grep
- **init 가드**: `if (xxxInitialized) return` → destroy에서 리셋 존재. init 함수 내 cleanup 루프 2회 이상 금지(P56)
- **데이터 폴백**: `_ldSafe()` 사용 · `if (val)`에서 0이 버려지지 않는지 · null 가드는 `typeof v === 'number' && isFinite(v)` (P715 — `Number.isFinite(Number(v))`는 null 통과)
- **applyDataSnapshot**: map 키 추가/제거 시 HTML `data-snap` 요소 양방향 동시 반영(P58)
- **이벤트 핸들러**: showPage/popstate/aio:liveQuotes 세 경로 모두 배선. 크로스페이지 공유 함수는 각 페이지 리스너에 연결(P60)
- **전역 변수**: API 콜백에서만 set되는 전역은 초기 read 시점 가드(P59)
- **종목 데이터**: SCREENER_DB 신규 sym → KNOWN_TICKERS 동시 등록(P64) · 회사명/상장 여부/모자회사 3중 검증(R10~R12) · 테마 가중치 합=100 · 중복 코드 0
- **일괄 치환/스윕 후 (R309)**: ① `aria-label` 없는 빈 `<button></button>` 전수 검색 ② `? '' : ''` 양쪽-빈 삼항 전수 검색 ③ JS 문자열 리터럴 내 마커 파괴 여부
- **`:root` 토큰 작업 시**: `grep -n "^:root"` 로 중복 오버라이드 블록(소스 후순위가 이김) 먼저 확인 — v52.62 함정

### 3-3. 시각/레이아웃
- 캔버스 width/height vs CSS 비율 일치 · 축 라벨 잘림 없음 · 주요 수치 3개 외부 소스 교차검증
- 390px/768px: 고정 `repeat(N,1fr)` N≥6 그리드 overflow 확인 · 스크롤 컨테이너 padding-bottom 16px+
- `document.querySelectorAll('[style*="repeat("]')` overflow 자동 탐지 스니펫 활용
- 페이지·문서 가로 overflow 0px (viewport 게이트가 상시 차단)

### 3-4. AI 채팅 (per-page + unified 공통)
- 입력→전송→스트리밍 표시→후속질문 칩 생성·클릭 동작 · API 키 없으면 안내(무한 로딩 금지)
- 페이지 컨텍스트 정합: 각 페이지 질문 시 해당 페이지 실데이터 인용(학습 데이터 가격 인용 금지)
- 응답 완료 후 DOM 구조: `.acp-msg.ai` 안에 `.acp-bubble` 존재 · 직접 자식 ≤5 · scrollWidth ≤ offsetWidth (v34.1 가로 렌더링 클래스)
- 매매 지시 문형 금지(P714): `grep -nE "매수하세요|매도하세요|진입하세요|헤지 필수" index.html js/*.js` → 안전 픽스처 외 0건
- 공통 응답 pipeline 경유(P691) · action gate 차단 전 원문이 history/chips에 저장되지 않음(P690)

### 3-5. 뉴스 엔진
- 연예/스포츠/부동산 뉴스 0 · 토픽/국가/TG 필터 동작 · 한국어 번역 제목(getDisplayTitle)
- 매크로/지정학 뉴스에 ETF 티커 배지 금지 · 크로스채널 중복(word-bag) 게이트 유지
- 뉴스 사이클 라벨 "08:00 KST 완료 24h" (rolling 48h 금지, R238)

### 3-6. 포트폴리오/워치리스트
- CRUD + localStorage 유지(새로고침 후) · 손익 계산식 정확 · Vault 암호화 경유(P661) — vault E2E 게이트가 상시 검증
- 삭제류는 커스텀 모달(native confirm 금지) · 포트폴리오→AI 프롬프트에 실보유 반영(명시 opt-in 필드 경계, P694)

### 3-7. 기업 분석(fundamental)
- 티커 검색 → 8초 총 예산 내 부분 성공/명시적 실패 종료(P705) · FMP 키 없어도 SEC+Yahoo 동작
- TTM/Annual 뱃지 구분 · Gross Margin >100% 금지 · Market Cap N/A 금지(라이브 가격 존재 시)

### 3-8. 접근성/보안/타이머
- canvas role="img"+aria-label · 최소 font-size 9px(8px 이하 FAIL) · 대비 4.5:1 · 색각 보조 클래스
- innerHTML에 외부 데이터 삽입 시 escHtml()/safeHtml() · alert()/confirm() 금지 · 민감 localStorage는 Vault/safeLS
- setInterval은 `_aioTimerRegistry` 경유 · destroy에 clearInterval 짝

### 3-9. 이벤트-드리븐 시장 정합성 (대형 이벤트/DATA_SNAPSHOT 갱신 직후)
- 유가·지정학·금리 서술 텍스트가 현재 방향과 일치(역방향 잔존 grep: `grep -n "이란전쟁\|전쟁 발발\|수요가 무너지고" index.html`)
- 값이 바뀌면 소비 표면 전체 grep 갱신(P713 BOK 사례) · 미래 특정일 등호 단언 금지(`grep "=== '20" js/aio-tests.js`)

---

## §4. 부록: 반복 실패 방지 특별 체크 (2회+ 반복 패턴)

| 패턴 | 확인법 |
|------|--------|
| 함수 존재하지만 호출 안 됨 | grep 호출 지점 + 브라우저 breakpoint. 읽기 코드 존재≠필드 존재 — 쓰기 지점 grep 실증(P724) |
| 이중 표면/그림자 구현 | 동일 지표 소비 표면 grep 전수(`abv50`, `hyg`, `DATA_SNAPSHOT.vkospi` 등) — 함수 단위 수정 금지(P713) |
| 동일 산출물 이중 write | 출력 경로 write 사이트 전수 grep + write 헬퍼·read-back 단언(P719) |
| init 가드 미리셋 / 이중 cleanup | destroy flag=false · init 내 destroy 루프 1회만(P56) |
| API 필드 가정 | Network 탭 실제 응답 확인 |
| popstate/showPage 한 경로만 수정 | 두 경로 모두 테스트 |
| 채팅 가로 렌더링 | `.acp-msg.ai` 내 `.acp-bubble` 존재 + 자식 수 DOM 검사 |
| `.pct \|\| 0` 재도입 (P25/R15) | `grep -n '\.pct ||' ` → 신규 0건, `!= null ?` 사용 |
| div 균형 오판 | `grep -o '<div' \| wc -l` (grep -c는 줄당 1 카운트) |
| data-live-price 벌크 자식 파괴 (P24) | `el.children.length > 0` 체크 유지 |
| 시점 관측값 리터럴 단언 (R279) | 날짜/시장값/데이터 상태를 영구 등호로 고정 금지 — 구조 속성으로 재작성(P627/P715/P720/P722) |
| 테스트가 artifact 내용 의존 | push 전 "현재 origin artifact"와 "차기 producer 산출물" 양쪽 실행(P722) |
| 스윕/일괄 치환 부작용 (R309) | 빈 버튼·양쪽-빈 삼항·문자열 마커 전수 검색(P678/P680) |
| "이미 됐다" 자기평가 | 과거 확인 기록을 재검증 없이 신뢰 금지(P631/P687/P688) |
| var/const hoist 충돌 | 모듈 전체 parse 실패 유발(P311/P525) — `node --check` 필수 |
| 고정 열 그리드 모바일 overflow (P57) | `repeat(N,1fr)` N≥6 → auto-fit/minmax |
| Dead Page | page-* div마다 init·pageShown·liveQuotes 3종 확인 |

---

## §5. 페이지별 핵심 검증 매트릭스 (17 라우트 체제, v53.7)

| 라우트 | 필수 확인 | FAIL 조건 |
|--------|----------|-----------|
| home | 시세카드 변화율, 스프레드, 뉴스, 결론 헤더=게이지 점수 | 변화율 0.00%, 스프레드 `—`, 점수 불일치(P553) |
| signal | 점수 게이지, 서브 바, 시나리오 | 게이지 `—`, 바 0 |
| breadth | SMA 바 3개, 차트, McClellan | 바 0, 빈 차트, 큰 숫자↔문장 모순(P562) |
| sentiment | F&G 게이지(단일값), AAII, P/C | 같은 카드 F&G 2값(P570), 빈 차트 |
| briefing | 다이제스트, 일정, F&G=타 페이지 동일값 | 영구 [번역 대기](P554), F&G 이중값 |
| technical | 지표, 지지/저항, **KR 통합 섹션(kr-integrated-*) 캔들** | 지표 `—`, KRX 오류 모달, y축 압축 |
| macro | yieldCurve, 온도, 일정(미래만), **KR 통합 섹션** | 빈 차트, 과거 일정 "발표 전" 잔존 |
| fxbond | 커브 차트, 스프레드, 캐리 배지 | 빈 차트, HY 이중값(P625) |
| themes | RRG(일봉 수화, P721), 사이클 칩=본문, **KR 통합 섹션** | RRG 영구 보류, 칩↔본문 모순(P606) |
| fundamental | 검색→부분성공/명시실패, TTM 뱃지 | 8초+ 무한 로딩, GM>100% |
| screener | 12행 점진 공개, 실가격, 관측형 라벨 | 첫 진입 빈 테이블(P522), BUY/SELL raw enum |
| ticker | 종목 개요(52주/수익률, P723/P724), 미보유 시 P&L 미표시 | 가짜 데모 P&L(P620), 52주 영구 결측 |
| portfolio | 보유→리스크→배분 순서, 빈 상태 CTA | 첫 진입 빈 화면, 평문 저장(P661) |
| market-news | 12개 점진 공개, 중복 없음 | 크로스채널 중복(P621) |
| options | VIX/VVIX 실값 + reference-only 고지 | 하드코딩 잔존, 고지 부재 |
| guide / theme-detail | 검색+아코디언 / 실제 테마명 브레드크럼 | 브레드크럼 `—`(P622) |

※ KR 독립 5페이지(kr-home/kr-supply/kr-themes/kr-macro/kr-technical)는 **v53.7에서 퇴역** — kr-themes/macro/technical은 themes/macro/technical 내 접힌 "한국 시장" 섹션(`kr-integrated-*`)으로 이관, kr-home/kr-supply 삭제. 구 KR 페이지 대상 체크 항목은 무효.

---

## §6. 버전별 검증 원장 (압축 — 원문 체크리스트는 git 히스토리)

| 버전 | 검증 주제 (P) | 상태 |
|------|--------------|------|
| v53.6~53.7 | ticker 종목 개요 + 52주 필드 보존(P723/P724) · KR 5페이지 통합(P725) — 헤드리스 1101 + viewport 68/68 + 리다이렉트 실브라우저 | ✅ |
| v53.5 | P719~P722: 발행 계약 read-back·감사 토큰·RRG 일봉 수화·테스트 양방향 불변식 | ✅ |
| v53.4 | 정적·하드코딩 22카테고리 계약(P717) + 퇴역 소비자 null 포맷(P718) — 실Chromium 무외부망 console 0 | ✅ |
| v53.3 | 퇴역 수직 제거 + 공개 artifact 5-script allowlist(P716) | ✅ |
| v53.2 | 소수 공유 배치: TG summary-only·quotes 미발행·null 코어전·관측형 라벨(P715) | ✅ |
| v53.1 | 시스템 발화 지시 제거·면책 도달·연구 라벨(P714) | ✅ (단 HYG 잔존 3함수 §1 참조) |
| v53.0 | fail-closed 이중 표면·날짜핀 부패·BOK 정합(P713) | ✅ |
| v52.99 | 22페이지 현재시장·파생결론 무결성 — 합성 금지·판정 보류(P712/R340) | ✅ |
| v52.94~52.97 | BLS 공식 evidence·22-route 계약·lineage/freshness 감사·TG 전수 커버리지(P708~P711) | ✅ 로컬 (SEC 80%는 §1 open) |
| v52.87~52.90 | 시안 기본 경로 재구축·상태 여정(P702~P705) — 40/40면 + 14 상태 계약 | ✅ |
| v52.74~52.86 | 부팅 성능 게이트(P689) + WP-AI1~20 계약(P690~P701) | ✅ 로컬 (라이브 모델/권리 검증은 §1 open) |
| v52.68~52.73 | 13개 시안 화면 전체 구조 재구축(P681~P688) | ✅ |
| v52.62~52.67 | 아이보리 리디자인 P1~P2 + R309 신설(P678~P680) | ✅ |
| v52.27~52.61 | FABLE UI/UX V0~V4·EF Batch·WO-0~8·H2 (P642~P677) | ✅ (WO-2/3 음의 상관은 제품 결정 보류) |
| v52.5~52.26 | FABLE 라이브 감사 P0~P6 전체 + 2026-07-08 라이브 일괄 검증 원장 | ✅ (당시 ❌였던 프록시 SPOF/VKOSPI는 P643/P658/P713에서 해소·게이트화) |
| v51.83 이하 | XSS·score parity·데이터 파이프라인·근본수정 registry·유니버스 감사 등 | ✅ 완료 — 원문은 git 히스토리, 재발은 QC7+반복 클래스 grep으로 차단 |

---

## §7. 게이트↔문서 계약 마커 (CI 게이트가 이 문서에서 직접 grep하는 항목 — 삭제 금지)

- **P513-Q1**: audit/게이트 그린만으로 완료 선언 금지 — `ci-semantic-review-check.mjs`가 의미 검토(semantic review)를 별도 강제. shape/coverage audit은 의미 검증의 대체물이 아니다 (R219).
- **P514-Q1**: workflow/skill 문서 append-only 비대화 방지 — `ci-workflow-compaction-check.mjs`가 governed ledger(RULES/QA-CHECKLIST/BUG-POSTMORTEM) 외 대형 컨텍스트 파일을 경고 (R220).
- **P517**: 데이터 파이프라인 source→consumer 전체 계약 — `ci-data-pipeline-contract-check.mjs` (R222).
- **P529**: 기본 경로 UX 노이즈/빈 트랙 차단 — `ci-ux-default-path-check.mjs` (R228).
- **P531**: 뉴스 셀프-주입 소스 품질·신선도 게이트 (R230).
- **P532**: operator note 첫 화면 우선 배치 + Signal 접힘(fold) 회귀 게이트 (R228).
- **P534**: visual hierarchy refresh 계층 게이트 (R231).
- **P535**: 스크리너 Kalman log-scale 생성·버전 병합 + 매매 문구 완화 게이트 (R232).
