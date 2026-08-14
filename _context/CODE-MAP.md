> **v53.55 (P761~P849 현행)**: v53.7 KR 5페이지 통합 이후의 ESM architecture/data-plane 경계, P755~P780 domain/route work, P781 derived ownership gate, P782 active SW controller diagnostics, P783 snapshot-first degraded quote operation, P785 technical health, P786 signal hero, P787 home aggregate, P788~P795 theme-detail bounded native ownership, P821 home quality, P822 technical candle metadata, P823 validation hardening, P824 native currentness guard, P825 live-region reduction, P826 derived-route compatibility canonicalization, P827~P830 secondary surface closure, P831 portfolio summary, P832 SEC report, P833 KV-only fast quote deployment, P834 AI infrastructure reference integration, P835 chart/behavior/communication protocols, P836 data refresh pipeline correction, P837 fast-plane smoke bootstrap handling, P838~P841 evidence/lifecycle/freshness/slice contracts, P842 capability claim boundary, P843 operations/soak/readiness boundary, P846 credential compatibility, P847 typed data evidence, P848 AI QuestionPlan/ClaimLedger/causal boundaries, P849 domain/evaluation/operations contracts까지 반영했다. 아래 historical 표는 감사 문맥이며 수정 전에는 상단 current 표와 `rg -n` 결과를 우선한다.

---
verified_by: Codex (`ReadAllLines` + `rg -n` full structural remeasurement) + P761-P855 update
current_override: P892 hierarchical Principles/Atlas learning UX and Masters adjacent-quarter/runtime closure on top of P891 learner-first content flow and P890 Scion availability evidence; live edge enforcement, provider rights, model benchmark, fast-plane soak, and AI proxy health remain explicit operator gates
  last_verified: 2026-08-13
confidence: high
target_version: v54.19
target_file: index.html + js/*.js + src/**/*.js + worker/*.js
target_lines: refreshed after P892 gate
  current_checkpoint: P892 adds broad-to-narrow Atlas workspaces, deep AI taxonomy, Principles relation/detail fixes, and Masters finite/adjacent-quarter contracts; official currentness/security-master and live model/Worker/provider certification remain operator-required
---

## Current machine-verified file-size table (v54.19, 2026-08-13)

| File | Lines | Verification |
|------|------:|--------------|
| `index.html` | 28,213 | `Get-Content.Count` + `ci-doc-currency-check.mjs` |
| `js/aio-core.js` | 27,406 | `ReadAllLines` + `ci-doc-currency-check.mjs` |
| `js/aio-data.js` | 16,318 | `ReadAllLines` + `ci-doc-currency-check.mjs` |
| `js/aio-ui.js` | 4,303 | `ReadAllLines` + `ci-doc-currency-check.mjs` |
| `js/aio-chat.js` | 6,805 | `ReadAllLines` + `ci-doc-currency-check.mjs` |
| `js/aio-tests.js` | 9,096 | `ReadAllLines` + `ci-doc-currency-check.mjs` |
| `src/ui/pages/guide.js` | 130 | native guide search/jump/capability lifecycle module |
| `src/ui/pages/screener.js` | 525 | native screener table/filter/profile/watchlist/position renderer + research setup labels |
| `src/data/providers/screener.js` | 146 | screener artifact + identity-universe provider + reference memo/RVOL fields |
| `src/data/normalize/screener.js` | 67 | screener row/metadata/setup-profile normalization |
| `src/data/orchestrators/screener.js` | 60 | screener state orchestration + factor-rank/setup-profile wiring |
| `src/domain/screener/setup-profile.js` | 81 | reference-only relative-strength pullback, support/200SMA stretch, volume-evidence, and climax setup labels |
| `src/ui/pages/news.js` | 285 | native market-news and briefing primary feed renderers; legacy AI digest boundary |
| `src/ui/pages/market.js` | 801 | native macro/fxbond/breadth primary metric renderers, curve/chart lifecycles, and native screener-metadata breadth fallback |
| `src/ui/pages/themes.js` | 861 | native bounded RRG quadrant/rotation-read renderer plus theme-detail summary/composition/leaders/temperature/spread/breadth-health/subtheme-gap/benchmark/insights and RRG chart lifecycle; deeper legacy-only surfaces remain bounded |
| `src/ui/pages/analysis.js` | 369 | native home/signal/technical decision surfaces and technical OHLCV/volume chart lifecycles with fail-closed input states |
| `src/ui/pages/entity.js` | 387 | native ticker hero/activity, options metrics, fundamental SEC status/summary, `sec-report.v2` core report renderer, and native ticker chart lifecycle with explicit unavailable history state |
| `src/ui/pages/portfolio.js` | 372 | native portfolio state, holdings/summary/allocation surfaces, and position-allocation chart lifecycle with explicit unavailable state |
| `src/data/runtime-readers.js` | 353 | canonical read-only runtime boundary plus 16-route field observation catalog |
| `js/aio-glossary.js` | 314 | `scripts/ci-doc-currency-check.mjs` |

| `src/ai/intent/taxonomy.js` | 83 | AIQ-1 typed intent taxonomy/routing |
| `src/ai/entity/resolver.js` | 51 | AIQ-1 entity alias/ticker resolution |
| `src/ai/time/market-session.js` | 47 | AIQ-1 current-question market session evidence |
| `src/ai/evidence/graph.js` | 28 | AIQ-2 evidence graph/completeness boundary |
| `src/ai/analysis/causal.js` | 24 | AIQ-4 temporal/cross-asset causal attribution primitive |
| `src/ai/policy/suitability.js` | 10 | AIQ-2 action/suitability permission boundary |
| `src/ai/orchestrator/question-planner.js` | 72 | AIQ-1 typed intent/entity/time/evidence plan |
| `src/ai/orchestrator/answer-orchestrator.js` | 39 | AIQ-0 single chat dispatch boundary |
| `src/ai/orchestrator/capability-planner.js` | 22 | AIQ-2 read-only capability selection |
| `src/ai/response/claim-ledger.js` | 81 | AIQ-3 AnswerPlan/ClaimLedger validation |
| `src/ai/response/renderer.js` | 21 | AIQ-3 deterministic response projection |
| `src/ai/analysis/sector.js` | 33 | AIQ-4 sector decomposition/breadth engine |
| `src/ai/analysis/company.js` | 30 | AIQ-4 company quality/valuation engine |
| `src/ai/analysis/technical.js` | 27 | AIQ-4 technical condition engine |
| `src/ai/analysis/macro-fx.js` | 22 | AIQ-4 macro/FX transmission engine |
| `src/ai/analysis/registry.js` | 20 | AIQ-4 intent-to-domain analysis registry |
| `src/ai/eval/benchmark.js` | 33 | AIQ-5 pinned benchmark manifest/corpus contract |
| `src/ai/operations/control-plane.js` | 20 | AIQ-6 canary/feedback/drift/rollback contract |

> The historical v52.66 table below is retained for audit context. Use this current
> file-size table first, then confirm any detailed line anchor with `rg -n` before editing.

# AIO v53.11 CODE-MAP

### ARX-09~16 native boundary additions (2026-07-19)

`src/state/{slices,selectors}` contains entity, portfolio, screener, and
analysis slices. Their commands/providers/normalizers/orchestrators live under
`src/app/commands` and `src/data/{providers,normalize,orchestrators}`.
Pure models are under `src/domain/{market,macro,technical,portfolio,screener,news,signal,home}`;
AI contracts are under `src/ai/{context,retrieval,provider,websearch,response}`;
privacy/release/retirement contracts are `src/storage/*` and
`architecture/{asset-manifest,retirement-manifest}.json`.

### RM-03 P755~P759 domain owners (2026-07-22)

`src/domain/macro/treasury-curve.js`, `src/domain/portfolio/concentration.js`,
`src/domain/screener/factor-ranks.js`, and `src/domain/technical/stage.js` own
the extracted pure formulas. Their legacy callers retain only explicit input
resolution and compatibility projection; `src/domain/{macro/model,news/claims,portfolio/risk,technical/indicators}.js`
are retired. `ci-domain-parity-check.mjs` covers five factor-ranks fixtures,
including a real 873-row screener capture.

### ARX-10 P760 native screener cutover (2026-07-22)

`src/data/providers/screener.js` now joins `public-data/screener.json` with
`public-data/screener-universe.json`; normalization and orchestration feed the
canonical `computeFactorRanks` model into `data/screener` state. The native
`src/ui/pages/screener.js` owns the 22-column table, readiness/KPIs, filters,
tabs, factor/backtest panels, profile, watchlist, and position controls.
`js/aio-data.js` and `js/aio-core.js` retain only documented compatibility
storage/projection boundaries for non-cut-over consumers. Route ownership is
now lifecycle/renderer/data native for screener; chart/narrative remain legacy
or not applicable. Use `rg -n` before further edits because ARX-10 retired
legacy screener helpers and shifted all downstream anchors.

### v53.91 reference setup and evidence overlay (2026-08-09)

`src/domain/screener/setup-profile.js` is a pure, fail-closed research overlay.
It does not replace `computeFactorRanks` or create a trading decision: it consumes
native screener row evidence and labels relative-strength pullbacks, 200SMA
support proximity, 200SMA extension/climax risk, and volume-data availability.
It also exposes the TradingView winner-screen evidence contract (ADR, 52-week-low
distance, dollar liquidity, and EMA relationships) as nullable fields; missing
fields yield `winnerFilter: unavailable` rather than a pass.
`src/data/providers/screener.js` preserves memo/RVOL/benchmark fields, the
orchestrator attaches the profile, and `src/ui/pages/screener.js` renders the
labels/search terms with an explicit research-only tooltip. Missing RVOL or
benchmark-relative-strength remains visible as missing evidence.

### P761-P780 continuation (2026-07-22)

- `src/domain/signal/trading-score.js` owns the `signal-from-trading-score.v1` decision envelope; `src/domain/signal/decision.js`, `src/domain/market/model.js`, and `src/domain/screener/ranking.js` are retired.
- `src/domain/screener/factor-weights.js` owns neutral/risk-on/risk-off/profile weight resolution. `js/aio-data.js:_aioFactorWeights` is a storage/profile bridge only.
- `src/app/bootstrap.js:getScreenerRows` is the native screener read API. `_aioGetCanonicalScreenerRows()` is the legacy compatibility adapter used by portfolio, ticker, fundamental, chat, watchlist, and audit consumers.
- `SCREENER_DB` remains the curated identity/memo and legacy data-pipeline compatibility boundary. Its direct non-route reads and runtime factor projection were retired; remaining work is to migrate the identity/memo producers and remove the remaining compatibility surface when their consumers are cut over.
- P765 removed the missed legacy `_aioRenderQuantReadiness` DOM writer/call and registered the retired symbol in `screener.legacySymbolsMustBeAbsent`; native screener now owns `screener-readiness-note` without an AG-DOM-WRITER exception.
- P766 moved the remaining non-route screener helper readers and the compatibility facade to the canonical native row API; `SCREENER_DB` is now a fallback/enrichment boundary for the still-open data pipeline only.
- P767 synchronized the data-pipeline contract with the native backtest disclosure and fail-closed quant-readiness audit after the retired legacy readiness renderer was removed.
- P768 made the native provider/orchestrator the sole runtime `screener.json` fetch owner, added `getScreenerState()`/`aio:nativeScreenerReady`, preserved breadth in native metadata, and removed `_aioApplyServerScreener` bulk factor projection. The legacy bridge now updates metadata/breadth only; identity/memo and Telegram overlays remain explicit compatibility producers.
- P769 made the native `news.js` module the sole primary `market-news` feed DOM owner, removed legacy `renderFeed()` plus direct feed loading/error/count/progressive writers, and retained filter/translation handlers only as explicit invalidation/input compatibility boundaries. Briefing and its secondary rewrite surface remain open.
- P770 made the same native module the sole primary `briefing` feed DOM owner for `briefing-live-news-list`, count, completed 08:00 KST timestamp, and reveal control. P771 transferred the bounded `macro` primary quote/FRED metric surface to `market.js`; P772 transferred the `fxbond` primary live quote/MOVE snapshot surface; P773 transferred the bounded `breadth` current 5/20/50SMA cards and advance-ratio surface using native screener metadata first, with explicit legacy fallback fences. Secondary curve/chart/risk/narrative ids remain explicit legacy boundaries. Route renderer ownership is 8/17.
- P774 removed declaration-only legacy news/briefing/screener functions and only-dependent sparkline helpers after the primary-feed cutovers; P775 transferred only the themes RRG quadrant cards and rotation-read surface to native `themes.js`. RRG chart/status and `theme-detail` remain explicitly legacy-owned secondary boundaries. Route renderer ownership is 9/17.
- P776 confirmed `theme-detail` is a canonical derived inline view: `showPage('theme-detail')` redirects to `themes` and `showThemeDetail()` owns the live inline panel. The unreferenced static-page `renderPageThemeDetail()` declaration was removed and its absence is asserted by the derived-route retirement contract.
- P777 transferred only the ticker hero primary surface to `entity.js` and removed the four primary writes from `showTicker()`; fundamentals/options and ticker overview/candle/entry surfaces remain explicit legacy boundaries. The shared accessibility initializer now preserves explicit title IDs, preventing `ticker-hero-name` from being rewritten as `page-ticker-label`.
- P778 transferred only the options replacement-metric values (VIX/PCR/SKEW) to `entity.js` from normalized evidence, fenced shared quote/snapshot/PCR writers, and removed the direct legacy PCR ID writer. The options page remains explicitly reference-only without an options-chain/Greeks provider; native renderer ownership is now 11/17 and legacy renderer ownership 6/17.
- P779 transferred only the fundamental SEC annual-data availability/source badge (`fund-data-status`) to `entity.js` from normalized `sec-fundamentals.json` evidence. The full SEC/FMP/Yahoo/Finnhub report, charts, and AI narrative remain legacy-owned; native renderer ownership is now 12/17 and legacy renderer ownership 5/17.
- P780 transferred only the portfolio readiness/status text (`pf-analysis-status`) to `portfolio.js` from the native portfolio slice. The encrypted Vault/CRUD/table/totals/prices/risk/chart surfaces remain legacy-owned; native renderer ownership is now 13/17 and legacy renderer ownership 4/17.
- P786 transferred only the signal score/decision hero (`score-gauge-val`, `score-decision-badge`, `score-decision-sub`) to `analysis.js` from `signal-presentation.v1`; the legacy signal canvas/factor/execution/risk/timestamp/narrative widgets and home summary remain explicit secondary boundaries. Native renderer ownership is now 15/17 and legacy renderer ownership 2/17.
- P787 transferred only the home score/decision aggregate (`home-hero-total`, `home-hero-headline`, `home-hero-desc`, `home-trading-signal`) to `analysis.js` from the same `signal-presentation.v1`; quality meter, Fear & Greed, regime, factor detail, chart, and narrative remain explicit legacy secondary boundaries. Native renderer ownership is now 16/17 and legacy renderer ownership 1/17.
- P788 added a bounded native theme-detail summary (`#theme-detail-native-summary`) fed by the explicit selection event, while `showThemeDetail()` writes the legacy body only to `#theme-detail-legacy-content`. Full detail composition, breadth, deep-analysis narrative, chart, and data ownership remain explicitly open; renderer ownership remains 16/17 native and 1/17 legacy.
- P789 moved theme-detail subtheme composition, constituent chips, and fail-closed breadth into `#theme-detail-native-composition` with normalized quote evidence; the legacy subtheme/breadth DOM writer is fenced while detailed leader cards and deep-analysis narrative remain explicit legacy boundaries.
- P790 moved theme-detail detailed leader cards, price, and change into `#theme-detail-native-leaders`; the legacy leader-card writer is fenced while deep-analysis narrative and chart/data surfaces remain explicit secondary boundaries.
- P791 moved the first dynamic theme-temperature diagnosis into `#theme-detail-native-temperature`; performance-spread, breadth-health, benchmark, deep narrative, chart, and data sections remain separate legacy boundaries.
- P792 moved leader performance spread and strongest/weakest constituent readout into `#theme-detail-native-spread`; breadth-health, subtheme gap, benchmark, deep narrative, chart, and data sections remain separate legacy boundaries.
- P793 moved the breadth-health interpretation into `#theme-detail-native-breadth-health`; subtheme gap, benchmark, deep narrative, chart, and data sections remain separate legacy boundaries.
- P794 moved the subtheme performance gap into `#theme-detail-native-subtheme-gap`; benchmark, deep narrative, chart, and data sections remain separate legacy boundaries.
- P795 moved the selected-theme versus ETF/composite-base comparison into `#theme-detail-native-benchmark`; theme insights, chart, and data sections remain separate legacy boundaries.

### P831~P832 bounded secondary ownership (2026-07-27)

- `src/domain/portfolio/surface.js` owns the finite-safe portfolio summary/allocation/exposure derivation; `src/ui/pages/portfolio.js` owns its DOM sinks and `sw.js` publishes the module. Portfolio risk cards, history charts, AI workbench, and narrative remain separate.
- `src/domain/fundamental/sec-report.js` owns the official SEC annual-fact projection and freshness classification; `src/ui/pages/entity.js` owns the filing metadata/coverage/metric child surface. Mixed-source fundamental report sections, charts, and AI narrative remain separate.

## Native ESM and data-plane additions (v53.11)

| ARX-06 news state/writer | `src/state/slices/news.js`, `src/state/selectors/news.js`, `src/app/commands/news.js`, `src/data/providers/news.js`, `src/data/normalize/news.js`, `src/data/orchestrators/news.js` | producer cache -> normalized `data/news` state -> native market-news/briefing renderer |
| ARX-07 market slice | `src/state/slices/market.js`, `src/state/selectors/market.js`, `src/data/providers/market.js`, `src/data/normalize/market.js`, `src/data/orchestrators/market.js`, `src/ui/pages/market.js` | legacy quote/snapshot read model -> normalized market state -> macro/fxbond/breadth slice renderer |
| ARX-08 themes slice | `src/state/slices/themes.js`, `src/state/selectors/themes.js`, `src/data/providers/themes.js`, `src/data/normalize/themes.js`, `src/data/orchestrators/themes.js`, `src/ui/pages/themes.js` | RRG/theme read model -> normalized theme state -> bounded native quadrant/rotation-read surface; chart/status and detail remain legacy |

| Area | Files | Contract |
|---|---|---|
| AR-06 inference | `src/ai/inference.js`, `src/ai/policy.js` | direction/range/confidence/sourceCount/sourceUrls/observedWindow; exact current numeric search values blocked |
| AR-07 canonical data | `src/data/contracts/market-snapshot.js`, `src/data/market-snapshot-loader.js`, `src/data/contracts/operations.js`, `src/data/contracts/reconciliation.js`, `src/data/contracts/source-registry.js` | Tier 0/LKG/operations/22-category reconciliation/source-capability registry |
| AR-07 producer | `scripts/build-market-snapshot.mjs`, `scripts/build-operations-status.mjs`, `scripts/build-reconciliation-status.mjs`, `worker/data-plane.js` | durable publish + independent fast-plane preflight |
| ARX-03 state boundary | `src/state/slices/sentiment.js`, `src/state/selectors/sentiment.js`, `src/app/commands/sentiment.js` | typed `data/sentiment` reducer, selector-only UI reads, command-owned dispatch |
| ARX-02 data writer | `src/data/providers/sentiment.js`, `src/data/normalize/sentiment.js`, `src/data/orchestrators/sentiment.js` | provider → normalize → freshness/evidence → state command |
| AR-09 boundary | `src/legacy/compatibility-facade.js`, `src/app/bootstrap.js`, `scripts/ci-architecture-browser-check.mjs` | typed navigation facade and lifecycle ownership during migration |

## v53.8 authoritative rescan (2026-07-18)

The tables in this subsection supersede older detailed line snapshots retained below for audit history.

### Shell/script boundaries

| Range | Content |
|------:|---------|
| 46~5261 | main CSS |
| 5262~12128 | body shell + 17 route DOM (inline islands 5272~5304, 7071~7092, 8098~8104) |
| 12129~12133 | Chart.js, DOMPurify, Lightweight Charts CDN |
| 12134~12204 | CDN failure fallback |
| 12211~12213 | `aio-core/data/ui` defer loaders (`?v=53.8`) |
| 12216~14717 | inline runtime |
| 14719 | `js/aio-chat.js?v=53.8` defer loader |
| 14721~16345, 16347~20041, 20042~24269, 24312~24510 | inline runtime blocks |
| 24521 | `js/aio-glossary.js?v=53.8` defer loader |
| 24524~27574 | inline runtime/SW registration |
| 27612~27643 | footer support CSS |
| 27648~28366 | final inline runtime |

### Active route DOM starts (17)

| id | line |
|----|-----:|
| `page-home` | 5635 |
| `page-signal` | 5890 |
| `page-breadth` | 6609 |
| `page-sentiment` | 6873 |
| `page-briefing` | 7057 |
| `page-technical` | 7371 |
| `page-macro` | 8028 |
| `page-fxbond` | 8785 |
| `page-fundamental` | 9478 |
| `page-themes` | 9810 |
| `page-theme-detail` | 10155 |
| `page-portfolio` | 10283 |
| `page-ticker` | 10746 |
| `page-market-news` | 11046 |
| `page-options` | 11183 |
| `page-screener` | 11221 |
| `page-guide` | 11423 |

### Current high-value runtime anchors

| Symbol | Location |
|--------|----------|
| `updateFxBondPage` | `index.html:20942` |
| `APP_VERSION` | `js/aio-core.js:2` |
| `AIO_MANUAL_REFERENCE` / `DATA_SNAPSHOT` | `js/aio-core.js:20784` / `20813` |
| `applyDataSnapshot` | `js/aio-core.js:21329` |
| `computeTradingScore` | `js/aio-core.js:21824` |
| `AIO_PAGE_CONTRACTS` materialization | `js/aio-core.js:23547` |
| `destroyPageCharts` / `showPage` | `js/aio-core.js:24983` / `25758` |
| `fetchLiveQuotes` / `applyLiveQuotes` | `js/aio-data.js:13732` / `15186` |
| `_aioApplyNativeScreenerState` / `_aioComputeFactorRanks` | `js/aio-data.js:4864` / `15357` |
| `initBreadthPage` / native sentiment page | `js/aio-ui.js:172` / `src/ui/pages/sentiment.js:243` |
| `CHAT_CONTEXTS` / `chatSend` | `js/aio-chat.js:549` / `4576` |

> 목적: 현재 모듈화된 AIO 코드를 전체 재읽기 없이 부분 탐색하기 위한 line 범위 맵.
> 원칙: 작업 전 이 파일에서 담당 파일과 범위를 찾고, 실제 수정 전 `grep -n`/부분 Read로 한 번 더 확인한다.
> 2026-07-02: v50.60(2026-06-16) 이후 60버전 미재스캔 상태였음 — 전면 재측정. 이전 버전의 line 번호는
> 신뢰하지 말 것(예: page-home이 4044→5227로 이동, CSS가 3693→4888줄로 성장).
> **2026-07-10(WO-8/P669)**: v51.90 이후 §1 파일 크기 표와 frontmatter만 `wc -l` 실측으로 갱신(신규
> `scripts/ci-doc-currency-check.mjs`가 이 표를 앞으로 자동 감시). **§2 이하 개별 함수·섹션의 line
> 범위는 이번에 재검증하지 않음** — v51.90 이후 여러 버전에 걸쳐 늘어난 변경(WO-6 evidence 시스템,
> WO-4 viewport 계측 등)으로 세부 범위가 부정확할 수 있음. 특정 함수를 찾을 때는 이 문서의 line
> 번호를 최종 확인 없이 신뢰하지 말고 `grep -n`으로 먼저 재확인할 것(confidence: medium으로 하향
> 표시한 이유).
> **2026-07-13(v52.66)**: `ci-doc-currency-check.mjs`가 `js/aio-core.js` 드리프트 +519줄(≥500 임계)을
> 보고해 §1 파일 크기 표만 재실측 갱신(아이보리 리디자인 signal/briefing 페이지 재구축, P681/P682).
> §2 이하는 이번에도 재검증하지 않음 — 위 P669 메모와 동일 제약 유지.
> **2026-07-16(v53.3/P716)**: 퇴역 feedback·breadth·macro·technical 경로 1,400여 줄을 제거한 뒤
> §1 파일 크기와 §2의 모든 script/style/22-route 시작점을 전면 재측정했다. §3 이하의 함수별 line은
>
> **2026-07-16(v53.4/P717~P718)**: 정적 스냅샷·기계식 일정·합성 시세·퇴역 시나리오 소비자를 제거한 뒤
> §1 파일 크기, §2 script/style/22-route, 현재 데이터 계약 앵커를 다시 전면 재측정했다.
> 변경이 누적될 수 있으므로 함수명 검색을 최종 근거로 사용한다.

---

## 1. 현재 파일 구조

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `index.html` | 29,095 | HTML shell, CSS, 22개 route DOM, 초기화용 inline 블록, 외부 모듈 로드 |
| `js/aio-core.js` | 26,563 | 버전, 상태/감사/계약/증거 레이어, DATA_SNAPSHOT, 페이지 라우터, 매매 알고리즘 핵심 |
| `js/aio-data.js` | 17,805 | API/서버 데이터, quote·previous-close 파이프라인, 뉴스, 스케줄러, identity-only 스크리너 |
| `js/aio-ui.js` | 4,257 | 활성 차트/렌더러, breadth UI, LLM quota UI, 교육 레이어 (sentiment renderer는 `src/ui/pages/sentiment.js`) |
| `js/aio-chat.js` | 6,084 | evidence-first CHAT_CONTEXTS, data preflight, Claude/Perplexity, 응답 파이프라인 |
| `js/aio-tests.js` | 8,840 | CI/로컬 브라우저 회귀 테스트 전용. Pages·service worker 배포 대상에서 제외 |
| `js/aio-glossary.js` | 314 | 용어사전 검색/렌더 |

---

## 2. index.html 구조

| 범위 | 내용 |
|------|------|
| 1 ~ 5270 | head meta/preload + 메인 CSS (`<style>` 46~5270) |
| 5271 ~ 12618 | body shell + 22개 route DOM; 페이지 내부 inline 3개(5281~5313, 7086~7107, 7871~7877) |
| 12619 ~ 12623 | Chart.js·DOMPurify·Lightweight Charts CDN |
| 12624 ~ 12694 | CDN 지연 폴백 초기화 |
| 12701 ~ 12703 | `aio-core/data/ui` defer 로드 (`?v=53.4`) |
| 12706 ~ 15244 | inline runtime 블록 |
| 15246 | `js/aio-chat.js` defer 로드 (`?v=53.4`) |
| 15248 ~ 16868 | inline runtime 블록 |
| 16870 ~ 20798 | inline runtime 블록 |
| 20799 ~ 25185 | inline runtime 블록 |
| 25228 ~ 25426 | inline runtime 블록 |
| 25437 | `js/aio-glossary.js` defer 로드 (`?v=53.4`) |
| 25440 ~ 28295 | inline runtime/SW 등록 블록 |
| 28333 ~ 28364 | 하단 보조 CSS |
| 28369 ~ 29089 | 최종 inline runtime 블록 |

> 현재 `<script>`는 외부 8개(CDN 3 + runtime 5), inline 11개(페이지 내부 3 + CDN 폴백 1 + runtime 7)다.
> runtime 5개는 모두 `defer`이며, 테스트 번들은 HTML·Pages artifact·service worker에 포함하지 않는다.
> 정확한 재탐색은 `rg -n "<script|</script>|<style|</style>" index.html`을 사용한다.

### 22개 route 페이지 DOM 시작점

| 페이지 | id | 시작 line |
|--------|----|----------:|
| 홈 대시보드 | `page-home` | 5655 |
| 매매 시그널 | `page-signal` | 5907 |
| 시장 폭 | `page-breadth` | 6624 |
| 투자 심리 | `page-sentiment` | 6888 |
| 데일리 브리핑 | `page-briefing` | 7072 |
| 차트·기술 | `page-technical` | 7386 |
| 거시경제 | `page-macro` | 7801 |
| 환율·채권 | `page-fxbond` | 8252 |
| 기업 분석 | `page-fundamental` | 8945 |
| 테마/섹터 | `page-themes` | 9277 |
| 테마 상세 | `page-theme-detail` | 9552 |
| 포트폴리오 | `page-portfolio` | 9680 |
| 티커 상세 | `page-ticker` | 10143 |
| 시장 뉴스 | `page-market-news` | 10401 |
| 옵션 분석(폐기 안내 shell) | `page-options` | 10538 |
| 퀀트 스크리너 | `page-screener` | 10576 |
| 한국 홈 | `page-kr-home` | 10776 |
| 한국 수급 | `page-kr-supply` | 11111 |
| 한국 테마 | `page-kr-themes` | 11322 |
| 한국 거시 | `page-kr-macro` | 11393 |
| 한국 기술 | `page-kr-technical` | 11669 |
| 사용 설명서 | `page-guide` | 11913 |

### v53.4 현재 데이터 계약 핵심 앵커

| 대상 | 위치 |
|------|------|
| `SCREENER_DB_META` / identity-only `SCREENER_DB` | `js/aio-data.js:10`, `js/aio-data.js:16` |
| native screener metadata/breadth bridge | `js/aio-data.js:4864` (`_aioApplyNativeScreenerState`) |
| static seed orphan 감사 | `js/aio-core.js:9789` (`getStaticSeedFallbackAudit`) |
| cell-level data lineage 감사 | `js/aio-core.js:16665` (`getDataLineageAudit`) |
| `APP_VERSION` | `js/aio-core.js:19929` |
| 공식 수동 reference 레지스트리 | `js/aio-core.js:20880` (`AIO_MANUAL_REFERENCE`) |
| explicit-null `DATA_SNAPSHOT` | `js/aio-core.js:20908` |
| 정적 데이터 정책 | `js/aio-core.js:20978` (`AIO_STATIC_DATA_POLICY`) |
| live-only narrative engine | `js/aio-core.js:21045` (`NARRATIVE_ENGINE`) |
| 매매점수 런타임 입력 | `js/aio-core.js:21919` (`computeTradingScore`) |
| 22-route page contract | `js/aio-core.js:23653` (`AIO_PAGE_CONTRACTS`) |
| 페이지 전환 | `js/aio-core.js:25874` (`showPage`) |
| synthetic breadth 차단/히스토리 artifact | `js/aio-ui.js:475` (`initBreadthPage`) |
| evidence-first 채팅 context factory/map | `js/aio-chat.js:385`, `js/aio-chat.js:418` |
| 22-category CI 계약 | `scripts/ci-static-data-contract-check.mjs` |

---

## 3. 핵심 상수/함수 위치

### `js/aio-core.js` — 매매 알고리즘 핵심 (v51.98 Phase 3 A3로 index.html 인라인에서 이관됨)

> **2026-07-02 진단 A3 해소(v51.98)**: 이 앱의 중심 알고리즘이 모듈이 아닌 index.html 인라인에 있어
> `js/*.js` 쪽 5곳이 `typeof computeTradingScore === 'function'` 방어 호출로 역참조하던 구조적 역전을
> 정리 — 4개 함수를 `_ldSafe`(이미 이 파일에 있던 주 의존성) 바로 뒤로 이관했다. 기존 `typeof` 방어
> 호출(aio-core.js/aio-data.js/aio-ui.js)은 전역 함수명이라 그대로 유효(오히려 aio-core.js가 제일
> 먼저 로드되므로 더 일찍 true가 됨). 순수 재배치 + 확정 죽은 코드 1건 삭제(computeTradingScore의
> HY스프레드 4순위 DOM 텍스트 파싱 폴백, A5 발견) — 알고리즘 로직/가중치 자체는 무변경. 이관 전/후
> 스냅샷 diff(다양한 mode 인자)로 동작 불변성 실측 확인. `_context/BUG-POSTMORTEM.md` P594,
> `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §7 Phase 3 A3 참조.

| 항목 | line | 비고 |
|------|-----:|------|
| `computeTradingScore` | 20068 | 매매점수(5서브스코어+7보정, 캐시 TTL 20s). 검증 하네스는 `scripts/backtest-trading-score.mjs`(v52.2)로 존재하나 표본 극히 작음(`statisticallyMeaningful: false`) — 재튜닝 근거 아님, §4 표 참조 |
| `getScoreAdvice` | 20236 | 점수→행동 문구 매핑 |
| `computeExecutionWindow` | 20245 | 실행 타이밍 점수(breakout/pullback/followthru/leader) |
| `classifyMarketRegime` | 20307 | 시장 레짐 분류(UPTREND/DOWNTREND/CHOP) |
| `_aioMarkChartCanvases` | 313 | LightweightCharts 내부 canvas `aria-hidden` 처리 |
| `_aioRegisterTimer` | 449 | 타이머 레지스트리, 중복 등록 정리 |
| `_aioPageBus` | 481 | 페이지 이벤트 라우팅 허브 |
| `_aioOnce` / `_aioGlobalRegistry` | 756 / 770 | 멱등 초기화와 전역 상태 이전 레지스트리 |
| `_aioFiniteNum` / `_aioSafeDiv` | 795 / 801 | NaN/Infinity/분모 0 통합 방어 |
| `_aioLRU` | 813 | score/ticker regex 등 용량 제한 캐시 |
| `getPageUXAudit` | 4836 | Page Focus Brief UX 감사 |
| `getStaticDataGovernanceAudit` | 11889 | 정적 데이터 거버넌스 감사 |
| `getAutoOpsReadiness` | 12467 | 운영 준비도 통합(evidence matrix/news/truth 포함) |
| `getAutoFreshnessPlan` | 13501 | 페이지별 자동 freshness 계획 |
| `chartDataGate` | 13789 | 차트 NaN/null 방어 |
| `safeLS` / `safeLSGet` / `safeLSGetSync` | 14224 / 14237 / 14250 | 암호화 localStorage |
| `calcTechnicalSnapshot` | 16987 | OHLCV 스냅샷 엔진 |
| `_calcRSILast`(Wilder) / `_calcRSISeries` / `_calcRSIDivergence` | 16586 / 16798 / 16822 | **Wilder식 RSI** — v51.91(P584/R265)에서 서버 `_rsi14`(fetch-data.mjs:695)도 Cutler식→Wilder식으로 단일화 완료(진단 C1 해소, 2026-07-06 재확인) |
| `_calcVCP` | 16716 | 클라이언트 VCP — 서버 `_calcVCPServer`(fetch-data.mjs:847)와 병렬 구현 |
| `AIO_EVENT_RISK_CONTEXT` / `calcBlowoffTopChecklist` | 17193 / 17350 | event risk + blow-off top checklist |
| `calcSellPressure` / `calcDataQuality` / `calcAIInfraHeat` / `calcPositionTechnicalRisk` | 17387 / 17513 / 17566 / 17596 | 매도압력·데이터품질·AI인프라열·포지션리스크 |
| `APP_VERSION` | 17670 | R1 버전 단일 소스 (`v51.90`) |
| `getDataPipelineAudit` | 18237 | source→transport→scheduler→store→analysis→render audit |
| `getOperationalHealth` | 18440 | 운영/SW/API/cache/freshness/pipeline 자체 진단 |
| **DATA_SNAPSHOT** | 18620 ~ 18898 | 시장 데이터 SSOT 리터럴. `/data-refresh` 수동 카테고리(ISM·AAII·KR 지표 등)의 저장소이기도 함 |
| `applyDataSnapshot` | 19600 | snapshot → DOM, 키별 오류 격리 |
| `_ldSafe` | 20047 | liveData + snapshot fallback |
| `getLiveCoverage` | 18108 | core live quote coverage |
| `destroyPageCharts` | 22841 | 페이지 이탈 차트 정리 |
| `showPage` | 23313 | SPA 페이지 전환 |
| `_calcPortfolioVaR` | 23704 | 보수적 historical VaR |

#### evidence-first 레이어 (`js/aio-core.js`, 21387~22687대 밀집)

| 항목 | line | 비고 |
|------|-----:|------|
| `recordCrossSourceQuote` | 20535 | source-family별 시세 기록(R196) |
| `getCrossSourceQuoteValidation` | 20573 | 교차 소스 불일치 검증 |
| `getDataTruthAudit` | 20798 | DataTruthGate 감사(R195) |
| `getMarketSituationReferenceSnapshot` | 21164 | 현재 시장 레짐 기준 스냅샷 |
| `collectCritical10MarketContentInventory` | 21189 | critical-10 가시 콘텐츠 전수 인벤토리 |
| ~~`getCritical10ContentEvidenceMatrix`~~ | 21398 | **`_deadV49112_getCritical10ContentEvidenceMatrix`로 개명 — v50.44 폐기, `getAllPageContentEvidenceMatrix`가 후속** |
| `_buildContracts` | 21630 | 22페이지 계약 빌더 |
| `AIO_PAGE_CONTRACTS` | 21652 | window 노출(빌더 결과 캐시) |
| `applyPageContractCompatibility` | 21665 | 계약→호환 맵 파생 |
| `AIO_SOURCE_ADAPTER_REGISTRY` | 21778 | 소스 어댑터 레지스트리 |
| `AIO_TEXT_SURFACE_CONTRACTS` | 21845 | 텍스트 표면 계약(R204) |
| `applyTextSurfaceHygiene` / `getTextSurfaceAudit` | 21982 / 22012 | 텍스트 표면 위생 적용/감사 |
| `buildEvidenceStore` | 22133 | evidenceId 분류 스토어 |
| `getAllPageContentEvidenceMatrix` | 22352 | 22페이지 전체 증거 매트릭스(현행 단일 소스) |
| `getTradingDecisionInputEvidence` | 22452 | 트레이딩 결정 증거 게이트(R201) |
| `getTradingDecisionLogicAudit` | 22474 | 트레이딩 로직 감사 |
| `runEvidenceDeploymentGate` | 22609 | **배포 게이트 — 계약 기대값 기반 strict/warn 산출** |

> news surface 계약(`AIO_NEWS_SURFACE_CONTRACTS` / `buildNewsSurfaceModel` / `getNewsSurfaceAudit`)은 `js/aio-data.js`에 위치(아래 표).

### `js/aio-data.js`

| 항목 | line | 비고 |
|------|-----:|------|
| **SCREENER_DB_META** / **SCREENER_DB** | 10 / 19 | 정적 스크리너 시드(881 심볼). 서버 `getScreenerSymbols()`가 이 파일을 정규식 파싱(진단 B6, 취약) |
| `DATA_APIS` | 2510 | API registry |
| `fetchOHLCV` | 2869 | deep technical OHLCV |
| `fetchOHLCVWithFallback` | 2943 | Twelve Data → Yahoo chart fallback OHLCV normalizer |
| `fetchFinnhubEarningsCalendar` | 3771 | 어닝 일정 |
| `fetchBreadthData` | 3860 | breadth 근사(AV movers + RSP/SPY 비율). MMFI/MMTW/MMFD %aboveMA는 선언만·실 fetch 미구현 |
| `REFRESH_SCHEDULE` | 4017 | 자동 갱신 스케줄 |
| `_runScheduledTask` | 4107 | task promise timeout |
| `getRefreshSchedulerAudit` | 4461 | 스케줄러 진단 |
| `runScheduledRefresh` | 4760 | 수동 강제 갱신 |
| `ensureFreshDataForUse` | 4906 | page/chat selective freshness preflight |
| `AIO_NEWS_SOURCES` | 6293 | RSS/뉴스 소스 |
| `MACRO_KW` | 6445 | 매크로 키워드 |
| `TECH_KW` | 6856 | 기술/AI 키워드 |
| `KNOWN_TICKERS` | 7577 | 티커 Set |
| `scoreItem` | 8404 | 뉴스 중요도 점수 + LRU 캐시 |
| `classifyTopic` | 8791 | 뉴스 토픽 분류 |
| `renderFeed` | 10594 | 시장 뉴스 렌더 |
| `AIO_NEWS_SURFACE_CONTRACTS` | 10128 | home/briefing/market-news 단일 계약(R203) |
| `buildNewsSurfaceModel` / `getNewsSurfaceAudit` | 10376 / 10475 | 뉴스 표면 모델/감사 |
| `_aioGetCurrentHomeWeeklyNews` | 10825 | HOME 고정 뉴스 freshness filter |
| `renderHomeFeed` | 10837 | 홈 뉴스 렌더 |
| `computeNewsSentimentScore` / `computeNewsRiskSignals` | 11702 / 11736 | 뉴스 감성/리스크 — js/aio-core.js의 computeTradingScore가 소비(v51.98 Phase 3 A3로 이관, §3) |
| `fetchOneFeed` | 11859 | 단일 피드 fetch |
| `fetchAllNews` | 12191 | 뉴스 전체 수집 |
| `fetchLiveQuotes` | 13212 | live quote pipeline + core coverage guard + cross-source 기록 |
| `applyLiveQuotes` | 15029 | live quote store + DOM render sink |
| `renderBriefingFeed` | 11101 | 브리핑 뉴스 렌더 |
| `vixToPercentile` | 14286 | VIX percentile 로그 외삽 |
| `toggleSignalMode` | 16184 | signal UI mode state |
| `_aioFactorWeights` | 15342 | storage/profile 입력을 pure `factor-weights.v1`에 연결하는 호환 브릿지 |
| `_aioComputeFactorRanks` | 15357 (wrapper; export: 15397) | legacy 호출용 hidden input/weight 해석과 SCREENER_DB 호환 projection만 수행. 계산 owner는 `src/domain/screener/factor-ranks.js:105`; native route는 state에 직접 rank를 보유 |
> P763 correction: deterministic factor-weight math moved to `src/domain/screener/factor-weights.js`; `_aioFactorWeights` now resolves compatibility inputs and bridges the pure result only.
| `computeFactorRanks` | `src/domain/screener/factor-ranks.js:105` | 순수 7팩터 랭킹: 섹터 z-score·winsorize·활성 factor·percentile rank. global/DOM/storage 접근 없음 |
| `_aioBuildDiversifiedRecommendationRows` | 16558 | 넓은 종목 추천용 분산 후보군(R211) |
| `_aioRunScreenerQuery` | 16631 | 자연어 스크리너/추천 후보 생성 |
| `_formatScreenerResultPrompt` | 16767 | 스크리너/균형 추천 후보 프롬프트 |

> 2026-07-21 재확인(직접 grep, ARX 재진입 세션): `_aioFactorWeights`/`_aioComputeFactorRanks` 좌표를 15871/15947(export
> 16082)으로 정정했다 — 이전 좌표(15829/15905, v50.60 이관)는 여러 세대에 걸쳐 재확인 없이 그대로 옮겨 다녀 자기모순
> 상태로 방치돼 있었다(`_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md` RM-06 §0.1이 지목). **진단 C2 재평가(같은 날, Fable
> 어드바이저 교차검증)**: "라이브·서버 모델 불일치"라는 기존 서술 자체가 부정확했다 — fetch-data.mjs의 4팩터 서브셋 검증은
> v51.91/P586에서 이미 의도적으로 결정된 것이고(docstring에 사유 명시), 그 4개 가중치가 라이브 NEUTRAL 서브셋 재정규화값과
> 여전히 일치함을 직접 계산으로 확인했다 — 즉 "어느 산식이 정본인가"는 이미 답이 나와 있는 질문이며 새 제품 결정이 필요 없다.
> P759에서 `_aioComputeFactorRanks` 7팩터 계산 자체는 `src/domain/screener/factor-ranks.js`로 추출됐고 legacy wrapper는 projection만 남겼다. P760/ARX-10에서 native provider가 screener artifact와 identity universe를 결합하고 native orchestrator가 `computeFactorRanks`를 호출하도록 승격했으므로 native screener state의 rank는 더 이상 구조적으로 null이 아니다. `_aioFactorWeights` browser profile/regime dependency와 non-cut-over compatibility projection은 후속 retirement 범위로 남겼다.
> (Fable이 최초 커밋 전 상태로 계산했던 1차 정정을 다시 잡아냄 — 좌표 정정 작업은 코드 삭제 순서 이후에 마지막으로 재확인할 것).

### `js/aio-ui.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `initBreadthPage` | 172 | breadth init |
| `LLM_MODELS` | 351 | Claude 모델 설정(haiku-4-5/sonnet-4-6, 2026-07 기준 유효) |
| `LLM_BUDGET` | 483 | 예산/쿼터 |
| `updateQuotaBadge` | 540 | LLM UI 동기화 |
| `ghPollOnce` | 751 | GitHub version polling |
| `globalRefresh` | 1036 | 전체 새로고침 |
| `renderSellPressurePanel` / `renderExitPlanPanel` | 1493 / 1503 | Institutional Technical Brief 렌더러 |
| `_renderFundHeader` | 2625 | 기업 분석 헤더 렌더(aio-chat.js가 로드순서로 역참조) |
| `_renderFundFinancials` | 2770 | 재무/애널리스트/SEC Frames |
| `_renderFundEarnings` | 3438 | 어닝 일정/서프라이즈 |
| `_renderFundNews` | 3494 | Finnhub 기업 뉴스 |
| `AIO_PAGE_FUNDAMENTALS` | 3933 | v52.39 P654: 페이지별 기초 교육 레이어 콘텐츠 |

> v52.39: 이 파일이 5,259→5,723줄로 성장(P654, +464줄) — 다음 ±500줄 트리거 근접. 대규모 신규 추가 전 재스캔 검토.

`src/ui/pages/sentiment.js`가 sentiment 카드·상태·차트와 resource bag lifecycle을 소유한다. `js/aio-ui.js`에는 sentiment legacy renderer/init/chart registry를 두지 않는다.

### `js/aio-chat.js`

| 항목 | line | 비고 |
|------|-----:|------|
| `CHAT_CONTEXTS` | 64 | AI persona/context |
| `_fetchTechnicalDataForChat` / `_aioTechnicalSymbolsForChat` | 2322 / 2400 | OHLCV 기술지표 주입 + 무티커 기술 질문 시장 대표 프록시 라우팅(R213) |
| `AIO_CHAT_SOURCE_REGISTRY` | 2479 | 채팅 데이터 출처 레지스트리 |
| `AIO_CHAT_PIPELINE_REGISTRY` | 2513 | AIO 전용 통합 답변 파이프라인 레지스트리 |
| `_fetchDeepCompareData` | 3081 | 심층 기업 비교 데이터 |
| `_classifyChatIntent` | 3672 | 의도 분류 |
| `_aioChatAnswerPolicy` | 3700 | 일반/스크리너/단순 종목/매매 판단 답변 정책 분리(R212) |
| `_buildAioIntegratedAnswerContext` | 3777 | 현재 시장+정량+정성+페이지 연결 계약(R214) |
| `_googleSearch` | 4208 | Google CSE fallback |
| `chatSend` | 5160 | 컨텍스트별 AI 전송 |
| `fundamentalSearch` | 6559 | 기업 분석 수집/렌더 |
| `_aioBuildDiversifiedRecommendationRows` / `_aioRunScreenerQuery` / `_formatScreenerResultPrompt` | 1890~1892 (alias) | **실제 정의는 aio-data.js**(17286/17352/17486) — 로드순서 의존 alias |
| `_fmtNum` | 6443 (alias) | **실제 정의는 aio-core.js:24102** |
| `_renderFundHeader`/`_renderFundFinancials`/`_renderFundEarnings`/`_renderFundNews` | 6866~6874 (alias) | **실제 정의는 aio-ui.js**(§ 위 표) — 4개 모두 로드순서 의존 alias |

---

## 4. 빠른 작업 참조

| 작업 | 우선 파일/범위 |
|------|----------------|
| R1 버전 동기화 | `index.html:10`(title), `index.html:5237`(badge), `js/aio-core.js:17670`(APP_VERSION), `version.json`, `sw.js:8`(SW_VERSION), `CLAUDE.md`, `_context/CLAUDE.md`, `CHANGELOG.md` + `index.html:12461~12463`·`15941`·`28287` 캐시버스터 `?v=` (반드시 `node scripts/bump-version.mjs <버전>`) |
| 매매 알고리즘 수정 | `js/aio-core.js:20068~20335`(computeTradingScore/getScoreAdvice/computeExecutionWindow/classifyMarketRegime) — **v51.98 Phase 3 A3로 모듈화됨**(§3 참조), `_ldSafe` 바로 뒤 |
| 배포 게이트/evidence 감사 | `js/aio-core.js:20527~22687`(contracts→evidence→trading→deployment gate) |
| 데이터 진실성/교차소스 | `js/aio-core.js:20535~20807` |
| DATA_SNAPSHOT 갱신 | `js/aio-core.js:18620~18898`, freshness/pipeline audit 18108~18440 |
| 뉴스 선별/렌더 | `js/aio-data.js:8404~10900` |
| RSI/기술지표 (서버·클라 이중 구현, 공식은 v51.91에 단일화됨 — 진단 C1 해소) | 서버 `scripts/fetch-data.mjs:1082`(`_rsi14`, Wilder) = 클라 `js/aio-core.js:18612`(`_calcRSILast`, Wilder) — 파라미터 드리프트만 잔여 감시 대상 (좌표 2026-07-21 재확인) |
| 팩터 랭킹/백테스트 (진단 C2 — 의도적 live 7팩터 vs server 4팩터 서브셋, P759 domain 추출 완료) | `src/domain/screener/factor-ranks.js:105` `computeFactorRanks` → legacy `js/aio-data.js:15947` projection; 서버 `scripts/fetch-data.mjs:1173` `backtestFactors`는 look-ahead/data-coverage 사유로 모멘텀/추세/저변동/kalman 4팩터만 사용 |
| 페이지 전환/init 가드 | `js/aio-core.js:22841~23313`(destroyPageCharts/showPage), 각 page init 함수 |
| sentiment/breadth 차트 | `js/aio-ui.js:14~900` |
| LLM 모델/쿼터 | `js/aio-ui.js:1551~1780` |
| Claude 채팅/웹검색/preflight | `js/aio-chat.js:2320~5160` |
| 기업 분석 UI | `index.html:8816~9118`, `js/aio-ui.js:3948~4900`, `js/aio-chat.js:6559~6877` |
| 포트폴리오 DOM | `index.html:9476~9931` |
| 옵션 분석 DOM(폐기 shell) | `index.html:10333~10343` |
| 한국 페이지 DOM | `index.html:10526~11699` |
| browser unit tests (CI 헤드리스 상설화됨, Phase 2 B5 — `.github/workflows/ci.yml` `headless-tests` job, report-only) | `js/aio-tests.js`, 로더는 `js/aio-core.js` 내(`AIO.loadTests()`), CI 러너는 `scripts/ci-headless-tests.mjs` |
| glossary | `js/aio-glossary.js`, `index.html:28287` |
| 데이터 파이프라인(서버) | `scripts/fetch-data.mjs` — Yahoo 1차 + 핵심 ETF 20종 한정 Twelve Data 2차 폴백(Phase 2 B1, `TWELVE_DATA_API_KEY` 필요, 지수/선물/FX/KR 확장은 미검증 스코프 제외), `getScreenerSymbols()`는 이제 `public-data/screener-universe.json`을 직접 읽음(Phase 2 B6, `scripts/sync-screener-universe.mjs`가 `js/aio-data.js`의 `SCREENER_DB`에서 생성·CI가 drift 검증 — 정규식 파싱 제거 완료. 클라 비동기 부팅 로드는 Phase 3 A2로 보류) |
| FRED_SERIES(서버) | `scripts/fetch-data.mjs:44` — Phase 2 B2(v51.97)로 `housingStarts`(HOUST)/`retailSales`(RSAFS)/`usWageGrowth`(CES0500000003) 추가, `fetchFred()`에 `scale`(단위 변환)·`mom_pct`(전월비%) kind 신설. `consConf`(Conf. Board)는 의도적 제외 — FRED 무료 시리즈 없음, UMCSENT(미시간대)와 혼동 금지(R274/P593). 한국 CPI(FRED 릴레이)는 보류(신선도 미검증 + KOSIS 직접경로 우위) |
| 매매점수 검증 하네스(Phase 3 C3, v52.2) | `scripts/backtest-trading-score.mjs`(신규) — `computeTradingScore`(`js/aio-core.js:20068`) 5개 서브스코어 계단함수를 순수 함수로 재구현, `public-data/history.json`으로 매일 재구성 점수 vs forward 5/21일 SPX 수익률 계산, `public-data/score-backtest-history.json`에 날짜별 upsert 누적(`updateBacktestHistory` P586과 동일 패턴). `fetch-data.mjs` `main()`의 `updateHistory()` 직후에서 호출. **현재 표본 극히 작음**(fg 데이터 24/201일뿐이라 5일forward n=19·21일forward n=3, `statisticallyMeaningful: false`) — 재튜닝 근거 아님, 인프라만(P599 참조). |

---

## 5. 검증 메모

- **v51.90 재스캔 (2026-07-02, Sonnet 5 — Fable 5 진단 Phase 0 A6b)**: v50.60(2026-06-16) 이후 **60버전 미재스캔** 상태였음(자체 규칙 "±500줄 리팩토링 시 재스캔" 위반 확정 — 진단 A6b). 전체 grep 재실측. 22페이지 시작점 전부 이동(page-home 4044→5227, CSS 3693→4888줄 +1195). `getCritical10ContentEvidenceMatrix`가 `_deadV49112_`로 개명된 사실 반영. inline runtime을 8블록으로 정정(구 CODE-MAP은 2블록으로 과단순화).
- **v50.4 핵심 축(과거 이력, 유지)**: v49.108(DataTruthGate)→109(cross-source)→110~112(critical-10 surface/situation/matrix)→50.0(EvidenceStore+21페이지 계약)→50.1(trading gate)→50.2(news surface)→50.3(text surface)→50.4(정적 캘린더 분리). 배포 게이트는 `AIO.runEvidenceDeploymentGate({strict})` 단일 진입점.
- **알려진 데이터 획득 갭(미해결)**: B계층 breadth %aboveMA(`fetchBreadthData` MMFI/MMTW/MMFD 선언만·실 fetch 미구현). C계층 CPI/PCE/NFP/AAII/NAAIM/SKEW/MOVE는 fetch 함수 0건·`/data-refresh` 스킬(WebSearch) 수동 갱신 — `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §4 B2 참조.
- **구조적 이슈 현황(2026-07-06 FABLE-ARCH-DIAGNOSIS 재확인, 진단 문서 자체가 스캔 시점 스냅샷임에 주의)**: (1) index.html 인라인 알고리즘↔모듈 역참조 — ✅ 해소(v51.98 Phase 3 A3, computeTradingScore 등 aio-core.js로 이관, §3 참조). (2) 서버·클라 RSI 공식 상이 — ✅ 해소(v51.91, 위 표 참조). (3) 백테스트(4팩터)≠라이브 랭킹(7팩터+레짐 가중) — ⬜ 미해소(진단 C2, 잔존). (4) js/aio-tests.js 900+ 테스트가 CI 미실행 — ⚠️ 부분 해소(`ci.yml`의 `headless-tests` job이 매 push 실행하나 `continue-on-error: true`로 report-only, deploy 게이트 미편입 — 진단 B5/E-1). 상세는 `_context/FABLE-ARCH-DIAGNOSIS-2026-07-06.md`(현행) 및 `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md`(이전) 참조.
- `.claude/commands`와 `.claude/hooks`는 **2026-05-18(커밋 09d2200) 이후로 GitHub-tracked** — 구버전 CODE-MAP의 "GitHub-tracked checkout에는 없다" 서술은 stale였음(정정 — `_context/CLAUDE.md` 2026-07-02 재작성판 참조).
- 큰 구조 변경 뒤에는 이 파일의 line 번호를 반드시 재스캔한다. **다음 재스캔 트리거**: index.html 또는 js 모듈 어느 한 파일이라도 ±500줄 변경 시, 또는 3개월 경과 시(자동 staleness 방지).
- **2026-07-06 targeted correction (P626, `_context/FABLE-ARCH-DIAGNOSIS-2026-07-06.md` Phase 0-4)**: 이 파일 자체가 v51.90 스캔 기준으로 "미해결"이라 적어둔 진단 C1(RSI)이 실제로는 v51.91에 이미 해소됐음을 실측 확인(§3 표 2곳 + §5 구조적 이슈 목록 정정) — 진단 문서의 "미해결" 표기는 스캔 시점 스냅샷이며, 해소 커밋이 그 표기를 갱신하지 않으면 이렇게 낡는다는 실사례. **주의**: 이번 정정은 C1/C3 문구 3곳 + `fetchKrDynamicData`/orphan 5함수 삭제(index.html -296줄, §2/§3의 관련 line 번호는 미재확인) 타깃 수정만이며, 전체 재스캔이 아니다. 헤더의 `target_version: v51.90`은 실제 v52.19 대비 29버전 stale — ±500줄 트리거는 이번 삭제(-296줄) 단독으론 미충족하나 다음 대규모 변경 전 전체 재스캔 권장.
> **v53.8 (P727) 재스캔 완료**: v53.7의 KR 5페이지 통합과 v53.8의 fxbond 고아 렌더 경로 제거를 반영해 파일 크기, script/style 경계, 17-route DOM 시작점, 핵심 runtime anchor를 다시 측정했다. 세부 함수 line은 편집 전 `rg -n`으로 최종 확인한다.
> **v53.46 (P837 current packet)**: reference analysis protocols remain source-labelled as REFERENCE, SEC refresh rotates untried candidates before cooled-down retries, and fast-plane smoke distinguishes propagation/bootstrap from a real failure.
