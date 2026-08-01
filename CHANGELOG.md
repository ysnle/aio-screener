## v53.69 (2026-08-01)
- **P875 / unified 24-hour evidence and lifecycle ownership**: public Telegram feeds now show the completed 24-hour lane while diagnostics stay collapsed; macro calendar replay merges the full official registry after the shared cut; the native yield-curve renderer is the sole owner with legacy Chart.js fencing/cleanup; quote `changeBasis`/`valueBasis` survives snapshot → bridge → PriceStore → native chart sinks; service-worker controller rotation is guarded and one-shot.
- **Verification**: runtime/data-plane/lineage/reconciliation/refresh/architecture/headless gates are run as one final batch; live deployment checks Telegram visibility, calendar population, chart reuse errors, SW/app version parity, and basis labels.
- R1 7곳 v53.69

## v53.68 (2026-08-01)
- **P872 / schedule-aware completed-close classification**: provider `REGULAR` hints now reconcile with venue calendars, keeping weekend/after-close Tier-0 rows typed as `MARKET_CLOSED` or `PREVIOUS_CLOSE_EXPECTED`.
- **P873 / atomic data-release promotion**: each refresh promotes market snapshot revision, cycle ID, and data timestamp into both release manifests; silent FRED or quote-coverage degradation is rejected.
- **P874 / operations truth parity**: scheduled AI readiness derives from `data.meta.marketAnalysisOk`, FRED attempt/success timestamps remain explicit, and durable snapshot publication cannot masquerade as semantic analysis success.
- **Verification**: market snapshot, manifest, integrity, and operations contracts are included in the final validation batch.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.68

## v53.66 (2026-08-01)
## v53.67 (2026-08-01)

- **P871 / explicit decision-header mounting**: every route now emits a balanced, discoverable `.aio-decision-header` wrapper with page/source/as-of metadata and visible shared-cut boundaries; startup mounts headers immediately when the document is already ready.
- **Verification**: headless `1107/1107`, critical-10 human-surface pass, architecture-browser pass, vertical slices, route soak, viewport `68/68`, accessibility `17/17`, and boot interaction pass.

## v53.66 (2026-08-01)

- **P870 / Telegram lane separation**: the digest now publishes a completed KST 08:00 24-hour lane with per-channel/text coverage alongside an explicitly labeled 14-day research window. Current-facing feed rendering refuses the rolling payload and stale cycles.
- **Shared cycle manifest**: server data now exposes cycle ID/status, 12-hour freshness SLA, component revisions, and a manifest revision; all route headers and news summary counters consume the same normalized freshness boundary.
- **Route SSOT and visible summary projection**: Telegram page requirements derive from `architecture/route-owners.json`, and the market-news/briefing header counters, source count, risk count, sentiment score, and fetch state project from the native model.
- **Refresh verification**: all three Telegram channels collected successfully (`163` completed-window posts, `157` text-eligible); market refresh completed with `78/78` quotes and a published cycle manifest.

## v53.65 (2026-07-31)
- **P867 / FRED saved-key blank state**: last-known-good macro values no longer suppress the personal FRED bridge or receive a false current FRED timestamp; storage, authentication, and connection states are separated, and cold-start macro projection is retried with a bounded full-loader replay.
- **P868 / completed-close time series**: daily history now retains completed closes only, with original session, value basis, observation time, shared cycle, and market-snapshot revision; Yahoo daily bar-open timestamps are converted to the prior-close boundary. The pre-boundary 381-day/3,691-field value audit passed; post-boundary artifact regeneration is pending.
- **P869 / one shared 24-hour market cut**: all 17 routes preserve and display the server KST 08:00 completed cycle; BEA official PCE 3.7%/core 3.3% and FOMC/PCE schedules are current.
- Refreshed market, macro, news, history, Telegram, reconciliation, operations, and score-backtest artifacts. No commit or deployment.

## v53.64 (2026-07-30)
- **P859 / themes performance bars**: native themes now owns the daily/weekly sector-performance bars from normalized evidence, with explicit pending states, route-scoped invalidation, and a fenced legacy writer.
- **P860-P862 / fail-closed decision surfaces**: snapshot/reference values cannot enter current Trading Score inputs; undated/future news cannot satisfy freshness windows; partial portfolio holdings no longer collapse unknown values into zero totals.
- **P863 / Worker endpoint evidence**: recorded the existing `aio-screener-data-plane` and `aio-proxy` roles, verified fast-plane `/health` + `/quotes` at 16/16 coverage, and connected the endpoint to operations/watchdog smoke contracts. Secret binding, provider rights, seven-day soak, AI proxy health/deploy, and edge headers remain explicit operator gates.
- R1 7곳 v53.64
- **P864 / release manifest synchronization**: architecture release/operations/readiness manifests now match v53.64 and `sw:v53.64`, closing the post-bump contract drift.
- **P865 / official FOMC rollover**: completed 2026-07-29 FOMC data is now retained as last release and the official 2026-09-16 decision is surfaced as next release.
- **P866 / post-refresh revision coherence**: asset/release manifests now promote the newest durable market-snapshot revision so refresh commits cannot leave a mixed release tuple.

## v53.62 (2026-07-29)

- **P833 / native data boundary**: all 17 route providers now consume the explicit `src/data/runtime-readers.js` boundary with preserved observation/source lineage and fail-closed missing values.
- **P834-P835 / native chart lifecycle**: ticker price and portfolio position-allocation charts now use route-scoped Chart.js registries, explicit unavailable states, and fenced legacy canvas entrypoints. Route ownership is 17/17 lifecycle+renderer+data, 8/17 chart, and 1/17 narrative; remaining dimensions stay explicitly open.
- **Reconciliation/operations closure**: all 22 categories now expose observed/required evidence, rights, gate, revision, and unresolved closure arrays; operator-required provider rights, fast-plane credentials/soak, and live edge headers remain blocked rather than promoted.

## v53.63 (2026-07-29)
- P833-P835 native runtime data and ticker/portfolio chart ownership packets; structural/browser gates record the new markers and legacy fences.
- Public deployment remains operator-gated for external rights, fast-plane authentication/soak, and GitHub Pages edge header enforcement.

- **P858 / boot critical path**: deferred translation/news enrichment and duplicate market-state/narrative work beyond the 2s interactive budget; provider quote fan-out remains owned by the central phase coordinator; route transitions avoid broad page invalidation.
- **Boot SLO verification**: three sequential Chromium runs pass initial external requests `12/25`, initial quote requests `0/16`, max long task `103-113ms/200ms`, total long task `542-558ms/1000ms`, active-route DOM `724/2500`.
- **Release posture**: local boot/route/data gates are target-compliant; live edge headers, Fast-plane credentials/soak, provider rights, and public beta remain operator-gated.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.62

## v53.61 (2026-07-29)
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.61

## v53.60 (2026-07-29)
- **P857 / readiness/SLO parity**: public readiness now mirrors the measured boot-performance decision, and the operations contract blocks release when max/total long-task targets are not met.
- **Release gate status**: local route, accessibility, security-contract, and data-contract gates pass; commit/deploy remains held on the measured boot SLO and live edge headers.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.60

## v53.59 (2026-07-29)
- **P853 / atomic quote envelope**: cumulative multi-provider quote refreshes now select one normalized producer revision per symbol before PriceStore, snapshot, _liveData, or DOM writes. KRX Naver price/change/previous-close fields cannot be mixed with Yahoo revisions, and incomplete index changes fail closed.
- **P854 / Signal degraded UI**: null/undefined scores no longer leak into secondary metric strips; the user sees `—` and `입력 대기` consistently with the primary pending verdict.
- **P855 / AI route-aware quota**: quota and ON state now require a personal key or a healthy shared Worker route; `NO_ROUTE` and Worker-not-ready states are displayed as unavailable.
- **P856 / release data parity**: asset/release/operations manifests are synchronized to the published market snapshot revision, with exact parity contracts and CSP added to the compatible edge header manifest.
- **Release gate status**: local surface gates pass, but public release remains blocked while the latest boot request/long-task SLO (91/25 initial external, 57/16 quote, 384ms max, 2,538ms total) and live edge security headers are not compliant/observed.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.59

## v53.58 (2026-07-29)
- **P852 / unified AI research boundary**: unified and per-page chat now share one ResearchPlan/evidence-floor gate, with explicit request-bound QuestionPlan envelopes and fail-closed current/causal output when primary/independent/snippet-free evidence is missing.
- **P852 / market/data provenance**: KR aliases/indices resolve to the correct market session; unknown/unverified sessions fail closed; snapshot/legacy quote storage preserves observation/fetch/session/venue/previous-close lineage; missing sentiment observation time is no longer stamped with `now`.
- **P852 / reliability and accessibility**: partial Research results retain sub-query identity after failures, FRED `.org` is official, Google snippet depth is per document, and mobile accessibility target warnings are release-blocking with a 26px control minimum.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.58

## v53.57 (2026-07-28)
- **P851 / AI chat typed-evidence false blocking**: normalized chat freshness quote rows into the shared typed `value`/`unit`/`scale`/`asOf`/`source`/`evidenceId` contract before claim validation, so valid current quote claims are no longer rejected because the adapter only exposed `price`.
- Added one evidence registry prompt for per-page and unified chat. Current numeric claims must still bind to one matching evidence row; general education, concepts, and framework explanations remain available without this restriction.
- Blocked/stale/mismatched chat evidence remains fail-closed, with T950-T952 regression coverage.
- R1 7-way v53.57

## v53.56 (2026-07-28)
- **P850 / Web Research decision and capability boundary**: added key-independent `ResearchDecision`/`ResearchPlan`, typed `EvidenceDocument`/`EvidenceChunk`, separate `ResearchCapability`, source floors, snippet-only restrictions, and fail-closed current/causal claims.
- **P850 / chat and provider path**: wired multi-query Research Plan execution, preserved sub-query/source metadata, promoted native HTTP 200 tool errors, separated Chat/Research readiness, bounded search cache by date/plan/session, and removed fixed-year deep-search queries.
- **P850 / data plane**: derived explicit market session states, removed published `UNKNOWN` Tier 0 sessions, added the 22-category data refresh audit, and wired structural data/session gates into CI.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.56

## v53.55 (2026-07-28)
- **AIQ-0/AIQ-1 intelligence rebuild — local implementation**: added the ESM QuestionPlan/intent/entity/market-session orchestrator and routed both per-page and unified chat through it as guarded legacy UI/provider adapters.
- **AIQ-2/AIQ-3 safety boundary**: added capability planning, EvidenceGraph/causal attribution, strict AnswerPlan/ClaimLedger parsing/validation, deterministic rendering, and fail-closed current-sensitive numeric output when MarketSessionEvidence or the structured answer contract is missing.
- Removed the misleading screener `CONFIRMED` verdict; ranking output now remains `RESEARCH_CANDIDATE` with `research-relative-ranking-only` and producer observation time. Blocked AI responses no longer receive recommendation/chart post-processing cards.
- Added `scripts/ci-ai-intelligence-contract-check.mjs` and wired representative routing, session, probability, causal, source-time, and single-orchestrator checks into CI.
- Added AIQ-4 deterministic domain engines for sector decomposition, company quality/valuation, technical conditions, and macro/FX transmission; AIQ-5 benchmark manifest/corpus scoring and AIQ-6 canary/feedback/drift/rollback control-plane contracts remain operator-gated for real model/Worker certification.
- R1 7곳 v53.55

## v53.54 (2026-07-27)
- **P846 / deployed API-key save and chat route regression**: fixed the `defer`-order global collision where `js/aio-core.js` overwrote the inline Claude `getApiKey()`/`setApiKey()` functions. The compatibility exports now support both provider-key calls and Claude no-argument/one-argument calls, return the credential readback result, and keep the runtime key available to chat.
- Reproduced with the local static server and Chromium: before the fix the browser wrote the key but `saveSidebarApiKey()` received no result and `getApiKey()` returned an empty value; after the fix the result is `READY_PLAINTEXT`, storage/readback, no-argument key lookup, explicit lookup, masking, and personal Claude routing all pass. Added the regression assertions to the AI reliability contract.
- API/source/pipeline audit baseline: data-pipeline, data-plane, lineage, market-snapshot, reconciliation, operations, semantic, static-data, inference, history-field, release-revision, and version contracts pass; lineage reports one explicit SEC fundamentals warning (16 non-comparable annual-fact candidates) and remains fail-closed without synthetic values. Live provider/Worker credentials and external-rights certification remain operator-gated.
- **P847 / API/source/pipeline hardening**: server market analysis now carries typed metric evidence and fails closed on VIX/Fear&Greed identity conflation, numeric/scale mismatches, and unsupported causal claims; the client no longer trusts `semanticStatus` alone. Existing prose without evidence is marked blocked-unverified.
- **P847 / source lineage**: news artifacts now retain source-tier label, headline-only depth, published event time, and independence key; screener validation reports mixed revisions and field-level fundamental coverage while requiring fundamental source/model/observation lineage. The LLM prompt now receives actual quote values (`regularMarketPrice`) rather than the stale `price` field.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.54

## v53.53 (2026-07-27)
- **P845 / early route initialization race**: made legacy `showPage()`/`showTicker()` safe when the native compatibility facade invokes them before the lexical `prevPage` shim is initialized; route state still flows through the existing `AIO.state`/window compatibility contract.
- Remote CI had exposed the TDZ through Critical-10, Portfolio Vault, and accessibility browser jobs. Local deterministic verification passes static `30/30`, headless `1102/1102`, viewport `68/68`, accessibility `17/17`, Critical-10, Portfolio Vault, boot, architecture/vertical-slice/route-soak, and SA-02/03/04; remote CI `30266668940` passed all gates and deployed Pages with public `v53.53` revision.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.53

## v53.52 (2026-07-27)
- **P844 / API-AI chat reliability**: unified provider credential persistence with format validation and write/readback results, added BOK/KOSIS coverage, separated storage/auth/connection status, and removed optimistic/plaintext fallback behavior.
- **P844 / AI route and Worker contract**: added explicit personal-key/Worker routing, public non-secret config, `NO_ROUTE`/`VAULT_LOCKED`/`WORKER_NOT_READY` states, Worker `/health`, effective token-cap reporting, and quota rollback on failed upstream requests.
- **P844 / operations boundary**: separated scheduled analysis from public chat and added five readiness dimensions plus measured boot/performance targets. Local browser, provider, live Worker, golden-accuracy, and low-spec performance verification were intentionally not run per urgent instruction.
- R1 7곳 v53.52

## v53.51 (2026-07-27)
- **P842 / Wave 4 content and education boundary**: added a versioned capability manifest and executable Guide claim audit, rewrote stale real-time/AI/translation/RRG/Stage/sentiment/macro/action wording into source-aware observation and checklist language, and added strict referrer metadata.
- **P843 / Wave 5 operations and public-readiness boundary**: added the 17-route visual-state matrix, operations SLO/readiness manifests, blocking three-lap route soak with entity round-trip and canvas-growth evidence, SHA-pinned Actions with lockfile installs, compatible security headers, and conservative operator-gated public-beta criteria. GitHub Actions run `30260095694` passed all gates including SA-04; commit `65f6912` is deployed and live v53.51 revision coherence is verified. Edge headers, 30-day SLO, and provider-rights review remain operator-required.
- R1 7곳 v53.51

## v53.50 (2026-07-27)
- **P841 / Wave 3 vertical slice boundary**: added an executable 10-slice registry for the planned route pairs, mounted route-scoped slice markers and live completeness state, exposed the contract through `AIO_ARCH`, and added CI/browser gates for direct surface, required-producer mapping, blocked-network states, mobile controls, and leave/re-entry. Boundary verification passes all local gates; SA-04 remains operator-required until a public snapshot with FRED/HY success is available.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.50

## v53.49 (2026-07-27)
- **P840 / W1-04, W1-05, W2-05 completion**: added SEC current/aged/historical freshness with fail-closed decision eligibility, blocked ticker action narratives when ticker/quote/market-health evidence is missing, and introduced a versioned Vault KDF envelope with legacy decrypt/re-encrypt migration. Targeted gates and PFE2-09 pass.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.49

## v53.48 (2026-07-27)
- **P839 / W2 route, chart, and key-resource remediation**: added abortable route/entity scopes and late-result guards, centralized native Chart.js replacement/disposal with a 480px canvas cap, and retired automatic plaintext API-key IndexedDB backup/recovery while preserving explicit JSON export/import.
- Added executable scope/chart lifecycle contracts and a static runtime contract that rejects the legacy `aio-keys-backup` open/read/write UI path. Wave 2 local verification passed all available gates; SA-04 remains operator-required because the public snapshot has no FRED key.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.48

## v53.47 (2026-07-27)
- **P838 / W1 decision-evidence boundary**: normalized `allowedUse` to `decision` / `reference` / `none`, added purpose-specific evidence selectors and completeness reporting, and made Trading Score consume only fresh, numeric decision evidence with fail-closed coverage blocking.
- Added executable ESM contracts for alias normalization, display/decision separation, last-known-value access, completeness, and reference-only Trading Score blocking. Wave 1 local verification passed all available gates; SA-04 remains operator-required because the public snapshot has no FRED key.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.47

## v53.46 (2026-07-27)
- **P837 / fast-plane deployment smoke bootstrap handling**: added propagation retries and an explicit initial-empty-KV acceptance state so a freshly deployed Worker is not misreported as failed before its first scheduled snapshot; malformed, partial, or unreachable responses still fail the smoke step.
- The Worker remains operationally pending until the first scheduled publish and the required 7-day soak complete.
- R1 7곳 v53.46

## v53.45 (2026-07-27)
- **P836 / full data refresh and SEC candidate-rotation fix**: refreshed 78/78 market symbols, macro/F&G/news/history artifacts, and the 14-day Telegram digest; regenerated the 845-symbol screener artifact from the current SEC file.
- SEC fundamentals now store 539/655 eligible symbols (82.3% source coverage), with 539/725 screener-eligible rows (74.3% display coverage). Missing filings remain unavailable; no synthetic values were inserted.
- Fixed SEC refresh starvation by prioritizing never-failed candidates and applying a failure cooldown; `SEC_RETRY_FAILED=1` remains available for deliberate manual retries.
- R1 7곳 v53.45

## v53.44 (2026-07-27)
- **P835 / reference analysis protocol completion**: added reusable chart-reading sequence, wait/probe/hold/protect behavior playbook, and verdict-to-invalidation communication contract to the AI infrastructure reference framework and research digest.
- Kept all supplied figures, chart levels, X material, and Worker claims source-labelled as `REFERENCE`; no automatic order or live decision promotion was added.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.44

## v53.43 (2026-07-27)
- **P834 / AI infrastructure cycle reference integration**: added a source-labelled Q1-Q5 framework covering capex-lag versus reinvestment-trap, memory P/ASP/multiple versus neocloud Q/spread/capital, and breadth/rates/credit/oil confirmation. The framework is injected into `CHAT_CONTEXTS` as REFERENCE-only and dynamically cross-checked against available runtime evidence.
- Added `[2026-07-20 REFERENCE]` memos for GOOGL, MU, AMD, CRWV, NBIS, IREN, and SNDK; added related MACRO/TECH keywords; and recorded the supplied time series plus all eight visual observations in `public-data/user-research-digest.json` without promoting them to live decision inputs.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.43

## v53.42 (2026-07-27)
- **P833 / KV-only fast quote plane**: removed the R2 bucket binding, R2 secret requirement, and R2 writes from the Cloudflare fast data plane. The Worker now stores the current snapshot and heartbeat in KV only; the deploy contract requires only Cloudflare token, account ID, and KV namespace ID.
- R2 remains an optional future durability extension; no card registration or R2 subscription is required for this deployment path.
- R1 7곳 v53.42

## v53.41 (2026-07-27)
- **P832 / fundamental SEC core report**: native fundamental now renders official SEC annual-fact filing identity, metadata, coverage, and finite observed metrics through `sec-report.v1`.
- Mixed-source peer/news/external sections, charts, and AI narrative remain explicitly separate from the official SEC evidence surface.

## v53.40 (2026-07-27)
- **P831 / portfolio deterministic summary cutover**: native portfolio now owns holding count, P/L/day, cash, VIX exposure, and sector allocation from `portfolio-surface.v1`, with finite-safe unavailable states and provenance markers.
- Legacy portfolio summary and sector writers are fenced for the transferred ids; risk cards, charts, AI workbench, and narrative remain explicitly separate.

## v53.39 (2026-07-27)
- **P827 / breadth secondary cutover**: native breadth now owns participation/McClellan status and all five chart lifecycles; missing multi-day history remains explicitly unavailable and no synthetic series is rendered.
- **P828 / FX-bond chart cutover**: native FX-bond owns TNX/JPY history and the current Treasury curve with source-labelled blocked states when evidence is incomplete.
- **P829 / ticker activity cutover**: native ticker owns portfolio P&L and extended-session activity with no-position/unavailable fail-closed states.
- **P830 / portfolio Vault/table cutover**: native portfolio owns the safe DOM-built nine-column Vault-backed holdings table; legacy CRUD actions remain delegated through fenced compatibility buttons.
- Full local verification: architecture contract/browser, Vault E2E 8/8, headless, viewport 68/68, accessibility, critical-10, boot, SA-02~04, and static/runtime/data contracts pass. Data lineage remains blocked by stale `data.json` and warns on SEC 102/655 (15.6%) coverage.
- External operations remain open: Cloudflare fast-plane credentials/7-day soak, provider-rights review, and SEC `SEC_USER_AGENT` configuration/coverage expansion.

## v53.38 (2026-07-26)
- **P826 / derived-route navigation canonicalization**: the architecture compatibility facade now replays `theme-detail` through its canonical `themes` route, preserving the native inline detail mount during FULL_INIT viewport traversal.
- R1 7곳 v53.38

## v53.37 (2026-07-26)
- **P825 / accessibility live-region reduction**: theme-detail keeps one summary `aria-live` region and removes redundant live announcements from eight subordinate native panels; UX, accessibility, and viewport gates pass.
- **P825 / accessibility live-region reduction**: theme-detail keeps one summary `aria-live` region and removes redundant live announcements from eight subordinate native panels; UX, accessibility, and viewport gates pass.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.37

## v53.36 (2026-07-26)
- **P824 / native currentness guard**: the shared narrative sanitizer now leaves native renderer-owned text untouched, and no-live theme/carry regression tests accept the current Korean fail-closed states without permitting fabricated scores.
- **P824 / native currentness guard**: the shared narrative sanitizer now leaves native renderer-owned text untouched, and no-live theme/carry regression tests accept the current Korean fail-closed states without permitting fabricated scores.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.36

## v53.35 (2026-07-26)
- **P823 / validation hardening**: theme-detail deep analysis now filters non-finite constituent percentages before comparison/formatting, and the retirement manifest records all 17 native renderer routes with no legacy route owner.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.35

## v53.34 (2026-07-26)
- **P821 / home quality fail-closed cutover**: native analysis now owns the complete home quality meter and removes the misleading legacy reuse of Trading Score under the Quality title; missing canonical five-input evidence stays `— / 판정 보류`.
- **P822 / technical candle metadata cutover**: native analysis now owns the technical candle title/meta from normalized input; legacy chart code retains canvas/indicator lifecycle without overwriting those text sinks.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.34

## v53.33 (2026-07-26)
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.33

## v53.32 (2026-07-26)
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.32

## v53.31 (2026-07-26)
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.31

## v53.30 (2026-07-26)
- **P795 / bounded theme-detail benchmark narrative**: moved selected-theme versus ETF/composite-base comparison into `#theme-detail-native-benchmark` from normalized theme and benchmark quote evidence, with fail-closed missing coverage.
- Removed the corresponding legacy benchmark writer; theme insights, chart, and data surfaces remain separately bounded.
- R1 7곳 v53.30

## v53.29 (2026-07-26)
- **P794 / bounded theme-detail subtheme-gap narrative**: moved the strongest/weakest subtheme performance comparison into `#theme-detail-native-subtheme-gap` from normalized subtheme quote evidence, with fail-closed insufficient coverage.
- Removed the corresponding legacy subtheme-gap writer; benchmark comparison and remaining deep narrative stay separately bounded.
- R1 7곳 v53.29

## v53.28 (2026-07-26)
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.28

## v53.27 (2026-07-26)
- **P792 / bounded theme-detail performance spread**: moved the leader performance-gap narrative plus strongest/weakest constituent readout into `#theme-detail-native-spread`, with fail-closed behavior until at least two quote changes are available.
- Removed the corresponding legacy spread writer; breadth-health, subtheme gap, benchmark comparison, and remaining deep narrative stay separately bounded.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.27

## v53.26 (2026-07-26)
- **P791 / bounded theme-detail temperature narrative**: moved the canonical selected-theme temperature diagnosis into `#theme-detail-native-temperature`, with explicit `시세 대기` behavior when performance is unavailable.
- Fenced the first dynamic deep-analysis section from the legacy writer while preserving performance-spread, breadth-health, benchmark, narrative, chart, and data sections as separately declared boundaries.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.26

## v53.25 (2026-07-26)
- **P790 / bounded theme-detail leaders**: moved the detailed leader-card grid, price, and change surfaces into the native `themes.js` child `#theme-detail-native-leaders`, using the normalized selection quote payload and safe DOM APIs.
- Fenced the legacy leader-card writer while preserving deep-analysis narrative as the remaining explicit legacy body; architecture contract and Chromium now assert summary/composition/leaders plus legacy-body coexistence.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.25

## v53.24 (2026-07-26)
- **P789 / bounded theme-detail composition**: moved subtheme composition, constituent chips, and the fail-closed breadth readout into the native `themes.js` child `#theme-detail-native-composition`, fed by normalized quote evidence from the explicit selection event.
- Fenced the legacy subtheme/breadth DOM writer while retaining detailed leader cards and deep-analysis narrative in `#theme-detail-legacy-content`; architecture contract and Chromium now assert the native summary/composition plus legacy-body boundary.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.24

## v53.23 (2026-07-26)
- **P788 / bounded theme-detail summary**: added a native `themes.js` summary surface for the derived inline theme-detail panel (`#theme-detail-native-summary`) covering selected label, performance/source status, and representative leaders. The legacy detail body remains in `#theme-detail-legacy-content` with subtheme, breadth, narrative, chart, and data ownership explicitly bounded.
- Added the `aio:themeDetailShown`/`aio:themeDetailClosed` boundary and Chromium coverage proving the native summary and legacy body coexist without a competing writer. Renderer accounting remains 16/17 native and 1/17 legacy; local v53.23 remains uncommitted and undeployed.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.23

## v53.22 (2026-07-26)
- **P787 / ARX-11 bounded home aggregate**: transferred the home score/decision summary (`home-hero-total`, `home-hero-headline`, `home-hero-desc`, `home-trading-signal`) to the native analysis renderer using the canonical `signal-presentation.v1` envelope. The quality meter, Fear & Greed, regime, factor detail, chart, and narrative remain explicit legacy boundaries.
- Added a home native marker and legacy writer fence, plus architecture-contract and Chromium `4/4` native-sink / `NATIVE-FENCE` assertions. Renderer ownership is now 16/17 native and 1/17 legacy; commit and deployment were not performed.
- R1 7곳 v53.22

## v53.21 (2026-07-25)
- **P786 / ARX-11 bounded signal hero**: added the pure `signal-presentation.v1` mapping on top of the canonical Trading Score, preserving the existing five-tier Korean decision wording while keeping the machine action envelope (`WATCH`/`WAIT`/`REDUCE`) separate. `analysis.js` now owns `score-gauge-val`, `score-decision-badge`, and `score-decision-sub` with fail-closed partial/missing-input states.
- Fenced `refreshSignalDashboard()` from those three native sinks while retaining its canvas, factor bars, execution-window, risk-monitor, timestamp, and narrative secondary boundaries. Added architecture-contract and Chromium `3/3` native-sink plus `NATIVE-FENCE` assertions. Renderer ownership is now 15/17 native and 2/17 legacy.
- R1 7곳 v53.21

## v53.20 (2026-07-25)
- **P785 / ARX-11 bounded technical surface**: extracted the single `market-health.v1` domain model and transferred the technical page's health score/grade/regime, three health bars, three indicator strips, status pill, and interpretation to the native analysis renderer. Legacy compatibility writers remain available only behind the native technical fence; candlestick, RSI/MACD, Weinstein/MTF, and narrative surfaces remain explicit secondary boundaries.
- Added unit, architecture-contract, and Chromium assertions for fail-closed missing inputs, model thresholds, native sink ownership, and legacy writer fencing. Renderer ownership is now 14/17 native and 3/17 legacy.
- R1 7곳 v53.20

## v53.19 (2026-07-25)
- **P784 / SA-01~SA-04**: Yahoo chart requests now use the shared proxy health registry with three-failure cooldown, invalid-payload failure accounting, and success recovery. Added deterministic SA-01 headless coverage, the twice-run external-outage snapshot fixture (16/16 reference values and stable retry state), the controllerchange/version re-query fixture, and the boot network budget fixture (server FRED/HY fallback calls `0`, quote request ceiling `100`, observed `83`).
- **SA-05 handoff currency**: historical HEAD/version/deployment claims are explicitly labeled as historical evidence, while current preflight state is recorded in a generated current block. Runtime, browser, headless, document-currency, and knowledge-lint gates remain required before commit/deploy.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.19

## v53.18 (2026-07-25)
- **P781 / ownership accounting**: synchronized route-owner summary counts/lists with all 17 per-route declarations and made the architecture contract independently derive every lifecycle/renderer/data/chart/narrative and full-native summary. Renderer ownership remains honestly 13/17 native, 4/17 legacy.
- **P782 / service worker diagnostics**: active SW version now follows `controllerchange`, registration checks the worker script without HTTP cache reuse, and the update log matches the existing `skipWaiting()`/`clients.claim()` transition instead of requiring a fictitious extra refresh.
- **P783 / snapshot-first degraded operation**: published same-origin market snapshot metadata now drives an explicit reference-only topbar with observed time/count. Live badges count only `live:` provenance and disclose partial core coverage. Boot waits for architecture snapshot readiness, removes the duplicate UI-owned initial quote/sentiment/HY calls, opens a quote proxy circuit after bounded failures, skips repeated Stooq/Yahoo rescue when a snapshot is available, leaves retries to the central 3-minute scheduler, and suppresses browser FRED/HY fallback when the server artifact already succeeded.
- Added runtime/architecture regression gates and updated handoff packets; operator fast-plane credentials, provider rights, deployment, and seven-day soak remain intentionally pending.
- R1 7곳 v53.18

## v53.17 (2026-07-22)
- **P780 / ARX-09**: transferred only the portfolio readiness/status sink (`pf-analysis-status`) to native `portfolio.js` from the canonical portfolio slice. Chromium confirms native sink `1/1` and the empty-state message; Vault consent, CRUD, holdings table, totals/prices, risk metrics, AI workbench, and charts remain explicit legacy boundaries. Renderer ownership is now 13/17 native and 4/17 legacy; headless remains `1098/1098 PASS`.
- **P779 / ARX-04**: transferred only the fundamental SEC annual-data availability/source badge (`fund-data-status`) to native `entity.js` from normalized `sec-fundamentals.json` evidence. Chromium confirms a native 1/1 sink with `official-regulator` lineage for AAPL; the full SEC/FMP/Yahoo/Finnhub report, charts, AI narrative, and low-coverage expansion remain explicit legacy/operator boundaries. Renderer ownership is now 12/17 native and 5/17 legacy; headless remains `1098/1098 PASS`.
- **P778 / ARX-04**: transferred the options replacement-metric primary surface (`opt-vix-val-secondary`, `opt-pcr-val-secondary`, `opt-skew-val-secondary`) to native `entity.js` from normalized VIX/PCR/SKEW evidence. Generic quote/snapshot/PCR writers now fence the native subtree; options-chain, chart, and narrative scaffolding remain explicit reference-only legacy boundaries. Chromium options marker and primary sink assertions pass, as do 17-route round trip and headless `1098/1098 PASS`.
- **P777 / ARX-04**: transferred the bounded ticker hero surface (`ticker-hero-name`, `ticker-hero-fullname`, `ticker-hero-price`, `ticker-hero-chg`) to native `entity.js`; fundamentals/options and secondary ticker overview/candle/entry surfaces remain explicit legacy boundaries. Preserved explicit page-title IDs in the shared accessibility initializer so native sink IDs cannot be rewritten to `page-*-label`. Chromium ticker primary sinks are 4/4 with `AAPL / Apple Inc. / — / —`, browserErrors 0, and headless remains `1098/1098 PASS`.
- **P776**: canonical `theme-detail` redirect를 재측정해 실제 소유 경계를 정리했다. standalone 정적 `renderPageThemeDetail()` 선언과 그 inline 호출을 제거하고, live inline `showThemeDetail()` 패널은 legacy derived-view로 유지했다. 이를 재발 방지하는 derived-route retirement contract를 추가했다.
- **P775**: `themes` 경로의 RRG 사분면 카드·로테이션 해석(primary read surface)을 `src/ui/pages/themes.js` 네이티브 렌더러로 제한 전환했다. `rrg-chart-status`/캔버스와 `theme-detail`은 별도 legacy secondary 경계로 유지하고, 17-route Chromium 왕복에서 native primary sink 2/2·browserErrors 0을 확인했다.
- **P774**: removed declaration-only legacy news/briefing/screener functions and only-dependent sparkline helpers left after the P769/P770 primary-feed cutovers; updated the native briefing retirement-test contract. Structural, control-character, architecture, and headless gates pass (`1098/1098`).
- **P773 / ARX-07**: transferred the breadth primary current-metric surface to native `market.js`: timestamped screener-artifact 5/20/50SMA cards, bars/freshness, and advance ratio. Legacy snapshot/init/bar/advance writers now fence the native subtree; stage/diagnostic/McClellan/RSP-SPY narrative and historical charts remain explicit secondary boundaries. Renderer ownership is now 8/17 native and 9/17 legacy; breadth reads native screener metadata first with a compatibility fallback.
- **P772 / ARX-07**: transferred the `fxbond` primary live quote and MOVE snapshot surfaces to native `market.js`; legacy quote/snapshot passes now fence native fxbond elements. Risk, spread/carry narrative, and chart surfaces remain explicit legacy secondary boundaries. Renderer ownership is now 7/17 native and 10/17 legacy.
- **P771 / ARX-07**: transferred the bounded `macro` primary quote/FRED metric surface to native `market.js`; legacy quote/snapshot/FRED/BOK/KOSIS passes now skip native macro elements. Curve/chart/event-freshness/narrative surfaces remain explicit legacy secondary boundaries. Renderer ownership is now 6/17 native and 11/17 legacy.
- **P770 / ARX-06**: transferred the `briefing` primary feed to native `news.js`, including completed 08:00 KST filtering, count/timestamp, safe category cards, and reveal control. Legacy briefing/AI/cap paths no longer write the primary container; the secondary digest remains a documented narrative boundary.
- **P769 / ARX-06**: transferred the `market-news` primary feed to the native `news.js` renderer, removed legacy `renderFeed()` and direct feed loading/error/count/progressive writers, and retained filter/translation paths as explicit invalidation/input compatibility boundaries. P770 completes the same primary-feed transfer for briefing.
- **P768 / ARX-16**: retired the duplicate legacy `screener.json` runtime fetch and `SCREENER_DB` factor-row projection. The legacy loader now consumes native screener state metadata/breadth through an explicit event/API bridge; identity/memo overlays remain documented compatibility boundaries. Added single-fetch runtime and updated data-pipeline contracts.
- **P765**: corrected the measured native renderer count to activate AG-DOM-WRITER for screener, removed the missed legacy readiness DOM writer/call, and added a retirement ratchet for `_aioRenderQuantReadiness`.
- **RM-00~06 아키텍처 회계·게이트 무결성 복구 + ARX 재진입(2026-07-19~21, P740~P752)** — v53.16으로 로컬에 누적됐던 이 작업 전체가 이번 배포로 처음 라이브에 반영된다(v53.16 자체는 P739만 담아 이미 배포됐던 버전이라, 그 이후 누적분을 여기로 옮겨 기록한다). 요약:
- **정정 (RM-00, 2026-07-19)**: 위 배치가 `build-operations-status.mjs`의 route 소유권을 하드코딩 배열로 선언(`nativeOwner` 17/17, `legacyOwner: 0`)했고 대응 게이트(`ci-retirement-contract.mjs`, `ci-operations-status-check.mjs`)가 그 선언을 검증 없이 강제했다. 실측(RM-00, `architecture/route-owners.json` 신설)은 renderer native 2(guide/sentiment)뿐이며 나머지 15개 route는 legacy renderer가 살아있는 채로 thin native 모듈이 동일 DOM(`home-trading-signal`/`score-gauge-val`/`screener-results-body`/`pf-positions-tbody`/`live-news-feed`/`briefing-live-news-list` 등)에 경합 기록 중이었다(F-01~F-03). `architecture/retirement-manifest.json`·`public-data/operations-status.json`을 실측값으로 정정하고 4개 게이트를 선언 강제에서 실측 검증으로 재작성했다. 상세: `_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md`(RM-00~06), `_context/BUG-POSTMORTEM.md` P740+.
- **RM-01 (같은 날 3차 배치, P741)**: RM-00이 지목한 이중 DOM writer를 실제로 제거했다. `src/ui/pages/{analysis,entity,market,themes,portfolio,screener,news}.js` 7개 native 모듈에서 legacy와 경합하던 모든 content 쓰기(analysis 12개 id·entity 13개 id·themes 3개 id·portfolio 10개 id·screener 5개 id·market의 quote/breadth id·news의 컨테이너 2종+카운트 4개)를 삭제하고 route dataset 스탬프만 남겼다. news.js가 `stopPropagation()`으로 legacy의 `data-action` 클릭 위임(필터·정렬·새로고침)을 막고 있던 숨은 회귀도 함께 제거했다. sentiment.js도 재검증해 `home-fg-score`·`sent-analysis-text` 2개 id가 추가로 legacy와 경합 중임을 확인하고(후자는 legacy의 활성 캐피출레이션/디커플링 분석 함수가 `setTimeout` 간접 호출이라 이전 검증에서 누락됨) native 쓰기를 삭제했다. `architecture/route-owners.json`에 `domWriterIntersectionAllowlist`(legacy가 읽기 전용으로 의존하는 id) 신설, `ci-architecture-contract-check.mjs`에 `AG-DOM-WRITER`(native/legacy id 교집합 0) 상시 게이트 추가, `ci-architecture-browser-check.mjs`에 home 정수 점수·한국어 라벨·market-news/briefing non-native 검증 추가. 실제 legacy 코드 삭제(진짜 ARX cutover)는 아직 남은 별도 작업. 상세: `_context/BUG-POSTMORTEM.md` P741.
- **RM-02 (같은 날 4차 배치, P742)**: `src/state/store.js`가 dispatch마다 clone 2회 + 구독자당 1회를 호출하던 설계를 제거했다(1000행 screener fixture 벤치: 구 설계 p95 7.49ms → 신 설계 p95 0.044~0.111ms). reducer가 이미 스프레드 기반이라는 계약을 신뢰해 clone을 없애고, `devMode`(기본 false) 옵션에서만 deep-freeze로 불변을 강제하도록 재작성(ADR-0002 부록에 결정 기록, `architecture/adr-0002-vite-typescript-and-state-access.md` 신설 — Vite/TS 본 결정 자체는 여전히 보류). `src/state/memoize.js` 신설(`createSelector`, `subscribeToSlice`) 후 sentiment.js에 배선해 무관한 dispatch로 인한 불필요 차트 재그리기를 제거했다. `bootstrap.js`의 `aio:liveQuotes` 6개 개별 리스너를 마이크로태스크 coalescing 단일 리스너로 교체. `ci-architecture-contract-check.mjs`에 1000행 screener dispatch+notify p95 ≤ 5ms 성능 게이트 추가(구 clone 설계 회귀 시 확실히 실패함을 확인). 상세: `_context/BUG-POSTMORTEM.md` P742.
- **RM-03 (같은 날 5차 배치, P743)**: F-11이 지목한 Trading Score 3중 구현(라이브/백테스트 사본/toy 도메인)을 단일 구현으로 수렴했다. `js/aio-core.js`의 `computeTradingScore`(5서브스코어+7보정, TTL 20s 캐시)를 `src/domain/signal/trading-score.js`(`computeTradingScoreModel`, 순수 함수)로 이관하고, 레거시 함수는 입력 수집 후 이 모델을 호출하는 얇은 래퍼가 됐다. 헤드리스로 7개 시나리오(강세/약세/데이터없음/부분결측/day모드/다이버전스 2종) 골든 fixture를 legacy에서 직접 덤프해(`architecture/fixtures/trading-score-golden.json`) 추출본과 완전 일치를 확인했다. **배선 버그 발견·수정**: `src/legacy/compatibility-facade.js`의 `exposeArchitecture()`가 `window.AIO_ARCH`에 노출할 필드를 하드코딩 allowlist로 cherry-pick하는 구조를 놓쳐, 새 브릿지 함수가 실브라우저에서 조용히 빠져 있었다(골든 fixture 대조만으로는 못 잡음 — `ci-architecture-browser-check.mjs`의 home 화면 검증에서 점수가 `"null*"`로 나타나 발견). `scripts/backtest-trading-score.mjs`의 5개 서브스코어 사본도 삭제하고 같은 모델을 호출하도록 수렴 — 그 과정에서 사본이 이미 3가지로 라이브와 드리프트돼 있었음을 확인(trend 결측 폴백 50 vs null, 라이브가 제거한 HYG 달러가격 임계 잔존·이중 계상, 존재하지 않는 aaiiBear 보정). `backtest-trading-score-longrun.mjs`는 `reconstructScore`를 import만 하므로 자동 수렴. `ci-domain-parity-check.mjs`(구 `ci-domain-module-smoke-check.mjs`)에 골든 fixture 대조 실 parity를 추가하고 이름을 원복(market/macro/portfolio/screener/news/technical 5종은 여전히 smoke-only, RM-03 item 2 후속 과제). `signal/decision.js`의 3입력 toy 모델 삭제는 `normalizeAnalysis`가 여전히 그 출력의 `.status`를 소비 중이라 이번 배치 스코프에서 의도적으로 보류(별도 설계 결정 필요 — 아래 미해결 항목 참조). 상세: `_context/BUG-POSTMORTEM.md` P743.
- **RM-05 (같은 날 6차 배치, P744)**: 게이트 실효성을 보강했다. `ci-architecture-browser-check.mjs`에 17-route 전체를 2랩 왕복하며 canvas 수·legacy 타이머 레지스트리 크기가 랩1↔랩2 사이 불변인지 확인하는 리소스 누수 검증을 추가하는 과정에서, entity.js/market.js/themes.js 3개 native 모듈이 RM-01에서 `aioArchitectureRoute` lifecycle 마커를 빠뜨렸던 잔여 결함을 발견·수정했다(9개 route가 30초 타임아웃 — 기존 게이트는 5개 route만 왕복해 못 잡았음). `scripts/ci-esm-core-unit-check.mjs` 신설 — store/router/lifecycle/evidence-store/facade 5개 ESM 코어 모듈을 route 배선과 독립적으로 격리 검증(ci.yml 배선 완료). `architecture/route-owners.json`에 AG-DOM-WRITER 허용목록 이관 절차를 명시(RM-01에서 이미 게이트 자체는 상시화됨). `ci-operations-status-check`/`ci-retirement-contract`의 route-owners.json 불일치 실패는 RM-00에서 이미 구현돼 재확인만 했다. 상세: `_context/BUG-POSTMORTEM.md` P744.
- **RM-03 item 2 (다음 세션, 2026-07-20, P745)**: F&G 합성·RRG·Weinstein/MTF 도메인 추출을 재실측 기반으로 완료했다. F&G는 로컬 합성 로직이 애초에 존재하지 않음을 확인(CNN이 계산한 값을 fetch만 함) — 추출 대상 없음으로 결론. RRG의 RS-Ratio/RS-Momentum 계산과 사분면 분류를 `src/domain/themes/rrg.js`(`computeRelativeRotation`)로, Weinstein의 MA-스택/스테이지 분류와 MTF의 추세 분류를 `src/domain/technical/stage.js`(`classifyMovingAverageStructure`/`deriveMultiTimeframeView`)로 이관하고 legacy `calcLiveRS`/`calcTechnicalSnapshot`/`updateMTF`는 `window.AIO_ARCH` 호출로 축소(P743과 동일하게 bootstrap.js api 객체·compatibility-facade.js exposeArchitecture() 양쪽에 함께 등록해 배선 누락 재발 방지). **부수 발견**: index.html에 Weinstein/MTF 복합점수 구현이 각각 두 벌 존재했고, sloppy-mode 이름 재대입으로 구버전(총 376줄)이 어떤 경로로도 도달 불가능한 완전 사문이었음을 확인해 삭제(burn-down: explicitWindowWrites 1094→1088, directStorage 189→187, htmlSinks 416→410). breadth 페이지의 `updateWSAnalysis()`도 자기 페이지가 아닌 technical 페이지 DOM에 쓰고 있던 고아 함수라 삭제. `breadth-stage-summary`/`mtf-verdict-text` 두 표면은 그 사문 코드가 삭제되기 전부터 이미 라이브로 갱신되지 않던 영구 플레이스홀더였음을 확인(제품 결정 필요, 이번 배치 미해결로 명시 이월). RRG/Weinstein/MTF 모두 legacy 코드에서 직접 덤프한 골든 fixture(`architecture/fixtures/rrg-golden.json`, `weinstein-mtf-golden.json`) 대조 실 parity를 `ci-domain-parity-check.mjs`에 추가. item 3(`signal/decision.js` toy 모델 삭제)은 소비처 분석 결과 `.status` 외 실 소비처가 0곳임을 확인했으나, 올바른 대체(`computeTradingScoreModel` 결과를 signal 슬라이스에 매핑)는 `normalizeAnalysis`에 vix/vvix/dxy/tnx/oil/pcr/hyBp/news 입력을 새로 threading해야 하는 ARX-11(W4/W5/W7 선행) 스코프이므로 조기 부분 구현 없이 명시 이월. 상세: `_context/BUG-POSTMORTEM.md` P745/P746, `_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md`.
- **ARX-03 재검증 + ARX-04 첫 실착수 (같은 날, 사용자 지시로 RM-06 재진입, P747)**: ARX-03(state/command 경계)을 8개 domain 전수 재측정 — UI dispatch 0건, reducer SET/CLEAR 쌍 일관, derived-state 중복 0을 실측 확인(단 legacy가 여전히 렌더를 소유해 층 전체 승격은 아님). ARX-04는 실행 계획이 "closed"로 선언했던 것과 달리 8개 domain provider 중 실제 fetch를 쓰는 곳이 0개였음을 확인(전부 legacy global projection) — screener provider를 AR-07의 market-snapshot.json 로더와 동일한 패턴으로 `public-data/screener.json`을 `platform/http.js`로 직접 fetch하도록 재작성(846행 실수신 확인, legacy fetch·SCREENER_DB 병합은 additive로 유지·삭제 없음). 이 과정에서 `src/data/normalize/screener.js`의 `rank` 필드가 `Number(null)===0` 함정(P715 재발)으로 null→0 오염되는 것을 실브라우저 상태 덤프에서 발견해 수정. 상세: `_context/BUG-POSTMORTEM.md` P747, `_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md` 세션 카드.
- **ARX-04 두 번째 슬라이스: entity(ticker) 펀더멘털 실 fetch (같은 날, 사용자 지시, P748)**: sentiment를 다음 ARX-04 대상으로 검토하다가, screener/entity/themes와 달리 sentiment는 ARX-01로 이미 실제 라이브 렌더링 중이라 데이터 소스 교체가 사용자 가시 회귀 위험이 있음을 발견 — 사용자 확인 후 더 안전한 entity로 전환했다. `src/data/providers/entity.js`가 `public-data/sec-fundamentals.json`을 `platform/http.js`로 직접 fetch(provider 수명 동안 캐시, 동시 호출 시 in-flight Promise 공유)하도록 재작성 — `root._fundAnalysisData`(legacy 소스)는 실제로는 AI 채팅 티커분석 경로에서만 채워지고 일반 탐색에서는 항상 null이었음을 grep으로 확인해, 실 fetch 교체가 순수 개선임을 검증했다. id/quote/options는 이번 슬라이스 범위 밖(legacy projection 유지). 실 Chromium에서 심볼 "A"(SEC 데이터셋 존재) 실측·미존재 심볼 fail-closed 양쪽 확인. 상세: `_context/BUG-POSTMORTEM.md` P748.
- **RM-03 계속: news 감성점수·리스크신호 실 parity 추출 (같은 날, Fable 어드바이저 검토 후 사용자 승인, P749)**: 사용자 요청으로 `model: fable` 에이전트를 read-only 어드바이저로 소환해 남은 위험/복잡 작업을 검토받았다 — sentiment ARX-04는 `market-snapshot.json`의 VIX 존재를 세션이 놓쳤던 것을 지적받았으나 VIX9D/VIX6M 결측·신선도 강등 때문에 보류 결론은 유지, RM-03 잔여 7개 smoke-only 도메인 중 news가 가장 쉽고 가치 높다는 추천을 승인해 착수했다. `computeNewsSentimentScore`/`computeNewsRiskSignals`(`js/aio-data.js:12184`/`12219`)와 하위 헬퍼를 `src/domain/news/scoring.js`로 순수 함수 추출(`now`를 명시 매개변수화). 골든 fixture 첫 덤프에서 KST 08:00 앵커 창 경계를 잘못 가정해 리스크 시나리오가 전부 빈 배열로만 덤프되는 자체 설계 결함을 발견·수정(타임스탬프를 창 안으로 재조정 후 geo/energy/credit/earnings 신호 실트리거 확인). `ci-domain-parity-check.mjs`에 실 parity 블록 추가(8 fixture 전부 일치). 상세: `_context/BUG-POSTMORTEM.md` P749.
- **ARX-04/RM-06 재진입 계속 + Fable 자문 2건 + 문서 정정 (2026-07-21, P750/P751)**: 사용자 요청으로 Fable 어드바이저(1차)에게 news ARX-04 설계와 P747/P748이 남긴 "dispose 시 fetch 취소 없음" 블로커를 재검토받았다. news는 `public-data/data.json.news`가 클라이언트 라이브 다중소스 RSS가 비었을 때만 병합되는 **서버 백스톱**(정본 아님)임을 근거로 실 fetch 전환을 하지 않기로 결정(N/A로 명시, deferred TODO 아님). 진짜 문제는 route dispose가 아니라 `screener.js`/`entity.js` provider가 **모든 route 진입**(`aio:pageShown`)마다 캐시 없이 재호출되는 구조에서 오래된 fetch가 새 fetch보다 늦게 도착하면 최신 상태를 덮어쓸 수 있다는 것 — `src/data/orchestrators/{screener,entity}.js`에 세대 카운터(generation counter) 가드와 `dispose()`를 추가하고 `bootstrap.js`의 `stop()`에 배선, `ci-esm-core-unit-check.mjs`에 겹치는 호출/dispose 시나리오 유닛 테스트 추가. **C2 재평가**: CODE-MAP.md가 오랫동안 "라이브·서버 모델 불일치"로 서술해온 screener 랭킹 진단이 실은 `fetch-data.mjs:1173~1197` docstring에 이미 문서화된 v51.91/P586의 **의도적** 4팩터 서브셋 검증이었음을 재확인(제품 결정 불필요 — CODE-MAP 서술을 정정하고 `_aioFactorWeights`/`_aioComputeFactorRanks` 좌표도 재확인). **부수 발견**: `ci-knowledge-lint-check.mjs`가 세션 시작 전부터 있던 미추적 한글 파일명(`ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19 - 복사본.md`, 기존 문서와 byte-identical)에서 git의 quoted-path 출력을 잘못 처리해 크래시하던 것을 `git ls-files -z`로 수정(경로 처리 버그, 이 게이트가 이 실패 모드에 걸린 첫 사례). **P746 완전 해소**: 사용자가 "같은 라이브 데이터로 배선"을 선택한 `mtf-verdict-text`를 `updateMTF()`의 기존 `deriveMultiTimeframeView` 결과에서 한줄 요약하도록 구현(신규 데이터 없음, 200거래일 미만이면 Weinstein Stage 위젯과 동일 기준으로 fail-closed). `breadth-stage-summary`는 사용자가 "시장폭 기반 신규 설계"(SPY 재사용 아님)를 선택 — Fable 2차 자문이 "Stage" 라벨 자체가 부정직하다고 판정했다(다일 breadth 이력이 `history.json`에 전혀 없고 `reconciliation-status.json`도 `breadth-history`를 이미 `BLOCKED`로 기록 중). `src/domain/market/breadth.js`(`classifyBreadthParticipation`, level broad/neutral/narrow × direction rising/falling/flat)를 신설하고 UI 라벨을 "Weinstein Stage"→"시장 참여도"로 변경(진짜 추세인지형 stage는 `history.json` breadth 영속화가 선행돼야 하는 별도 `/data-refresh` 과제로 명시 이월). 마지막으로 이 배포 자체를 위해 `node scripts/bump-version.mjs v53.17` 실행(R1 7곳 동기화), 미추적 중복 문서 파일(`...- 복사본.md`) 삭제, origin/main의 자동 데이터 갱신 29커밋 병합(충돌 2건은 둘 다 재생성 아티팩트라 재생성/버전 갱신으로 해소). 병합 직후 `ci-architecture-browser-check.mjs`가 3회 연속 재현되는 실패를 처음 보여 원인을 추적한 결과, 라우트와 무관한 부팅 15초 지연 타이머(`js/aio-data.js:6630` `setTimeout(startDataScheduler, 15000)`)가 왕복 시간의 자연스러운 변동으로 lap1/lap2 경계에 걸쳐 "신규 타이머"로 오탐되는 게이트 자체의 레이스 컨디션이었음을 확인·수정(P753) — 라우트 왕복 시작 전 그 타이머의 존재를 명시적으로 기다리도록 게이트를 고쳤다(카운터 비교 로직 자체는 변경 없음). 상세: `_context/BUG-POSTMORTEM.md` P750/P751/P752/P753, `_context/QA-CHECKLIST.md` §1.
- **배포 후속: watchdog 게이트 수정 + RM-03 잔여 smoke-only 토이 정리 (2026-07-21, P754~P758)**: 사용자가 "Data freshness watchdog" 실패 원인을 재확인 요청 — 표면 원인(Cloudflare `AIO_FAST_QUOTES_URL` 미설정, 기존에 알려진 운영자 결정 대기 항목)은 맞았지만, GHA 기본 skip 동작 때문에 그 뒤의 "Check LIVE standing invariants (R290)" 스텝이 무관한데도 매 스케줄마다 조용히 안 돌고 있었던 것을 스텝별 분해로 발견해 `if: !cancelled()`로 수정(P754). 이어서 Explore 에이전트로 `ci-domain-parity-check.mjs`의 남은 smoke-only 토이 5종(market/macro/portfolio/technical/news-claim) 전수 조사 — `deriveNewsClaim`은 대응 legacy 산식도 실 호출처도 없어 퇴역(P755), `deriveTechnicalModel`은 legacy 산식 없이 발명된 토이였지만 유일하게 `src/data/normalize/analysis.js`에 실배선돼 있어 `classifyMovingAverageStructure`(이미 실 parity 검증됨)를 SMA 스택 계산과 합성한 `deriveTechnicalStageFromOhlcv`로 교체·재배선(P756), `deriveMacroModel`은 실 호출처 없이 발명된 토이였는데 `getUsTreasuryCurveEvidence`(2s10s 수익률곡선, 다중소스 폴백)라는 진짜 산식이 있어 골든 fixture 8개로 실 parity 추출(P757), `derivePortfolioRisk`도 실 호출처 없이 발명된 20%/40% 밴드였는데 `calcPortfolioTechnicalRisk`의 진짜 10%/15%/25% concentrationPenalty 티어가 있어 concentration 슬라이스만(sellPressure/heatScore 전체는 범위 밖) 골든 fixture 8개로 실 parity 추출(P758). 4건 모두 `bootstrap.js`·`compatibility-facade.js` 양쪽 동시 등록 절차 준수, 재작성된 legacy 래퍼는 재작성 전/후 실 브라우저 덤프 100% 일치로 검증. `ci-domain-parity-check.mjs`의 원래 7개 smoke-only 모델 중 이제 market/screener/signal 3개만 남음(technical/macro/portfolio는 실 parity로 전환). 상세: `_context/BUG-POSTMORTEM.md` P754~P758.
- **RM-03 계속: screener factor-ranks 실 추출·legacy projection 단일화 (2026-07-22, P759)**: `js/aio-data.js`의 `_aioComputeFactorRanks` 7팩터 계산 본문을 `src/domain/screener/factor-ranks.js` 순수 함수로 이관하고, legacy wrapper는 기존 `_aioFactorWeights`/fundamental metadata를 해석한 뒤 `SCREENER_DB`와 `_aioActiveFactor*` 호환 projection만 수행하도록 축소했다. `bootstrap.js`·`compatibility-facade.js`·`sw.js`에 동시 배선했고, 4개 synthetic + 실제 873행 SCREENER_DB fixture parity, NaN/missing/inactive-factor/stable-tie unit edge cases, 17-route Chromium 왕복을 PASS했다. native screener route cutover와 legacy fetch/SCREENER_DB 삭제는 ARX-10 범위로 유지한다. 상세: `_context/BUG-POSTMORTEM.md` P759.
- **P760 / ARX-10**: promoted screener renderer/data ownership to native. The provider now joins screener artifact + identity universe and the canonical ranker feeds a native 22-column renderer; retired legacy screener DOM/action/backtest writers and refreshed T822/runtime contracts. Legacy SCREENER_DB/profile/watchlist compatibility remains for non-cut-over consumers; no commit/deploy performed.
- **P761**: retired the uncalled market/screener smoke-only domain modules and removed their service-worker/parity references.
- **P762 / ARX-11**: replaced the three-input signal toy with a Trading Score-derived signal envelope and threaded canonical inputs through analysis normalization.
- **P763**: extracted regime/profile factor-weight math into the pure `factor-weights.v1` domain owner; the legacy wrapper now only bridges inputs.
- **P764 / ARX-16**: migrated non-route screener readers to the canonical native read boundary. Legacy SCREENER_DB remains only for identity/memo enrichment and the legacy data pipeline until its remaining consumers can be retired safely.
- **P766 / ARX-16**: migrated the remaining non-route screener query, Maker/Checker, sector, recent-recommendation, and compatibility-facade readers to the canonical native row boundary; added a scoped runtime ratchet against direct `SCREENER_DB` reads.
- **P767**: synchronized the data-pipeline gate with the native screener backtest disclosure and fail-closed quant-readiness audit after the retired readiness renderer was removed.
- R1 7곳 v53.17

## v53.16 (2026-07-19)
- P739: fixed deferred deployment-gate regressions by synchronizing hidden sentiment projections, preserving explicit live sentiment patches over snapshot evidence, registering the native sentiment narrative boundary, and opening the canonical inline theme-detail panel on derived-route navigation.
- R1 7곳 v53.16

## v53.15 (2026-07-19)
- ARX-09~16 local cutover: entity, portfolio, screener, analysis, pure domain, AI envelope, privacy vault, release manifest, and 17-route retirement contracts are now wired through native ESM boundaries.
- P738: aligned the runtime contract gate with native theme/sentiment ownership and preserved live CNN Fear & Greed previous-day deltas so Pages deployment is not blocked by retired legacy markers.
- Added domain parity, storage migration, release-manifest, and compatibility-retirement CI contracts; live provider rights and fast-plane soak remain operator-required.
- P736/R352: architecture migration을 scaffold 존재가 아니라 실행 소유권 이전과 legacy burn-down으로 판정하도록 바꿨다.
- Sentiment lifecycle·fail-closed badge writer를 ESM route로 이전하고 legacy init hook·중복 badge writer를 삭제했다. legacy renderer는 compatibility facade 뒤에 명시적으로 남겼다.
- ARX-01: `src/ui/pages/sentiment.js`가 sentiment 카드·상태·VIX/기간구조 차트·복합 판단과 resource bag lifecycle을 실제 소유하도록 cutover했다. legacy chart registry/init·facade mount·data chart back-reference를 삭제했고 explicit global writes를 1109→1100으로 줄였다. 데이터 producer는 ARX-02까지 read-only adapter로 남긴다.
- ARX-02 진행: sentiment provider/normalize/orchestrator와 `data/sentiment` evidence/state dispatch를 연결하고, VIX legacy narrative/chart·F&G/HY sentiment-page 직접 sink 및 dead F&G/crypto HTML renderer를 삭제해 explicit global writes 1100→1098, HTML sink 420→418로 줄였다. 전체 producer gateway 전환 전까지 data owner는 legacy로 유지한다.
- ARX-03 진행: sentiment state slice·selector·application command를 추가해 reducer가 `data/sentiment`를 명시적으로 소비하도록 하고, native renderer·AI summary가 DOM 대신 canonical state selector를 읽도록 연결했다. 중복 server F&G global projection도 제거했다.
- ARX-02/guide follow-up: legacy F&G/Put-Call/HY producers now notify the canonical `AIO_ARCH.ingestSentiment` gateway; guide search/jump is wired through `src/ui/pages/guide.js`. The current static counters are explicit global writes 1094 and HTML sinks 416; ARX-02 is locally closed while ARX-04 and ARX-05 remain pending packet-wide verification.
- ARX-05/06 implementation: guide, market-news, and briefing routes now have native ESM lifecycle/render modules with DOM-safe text-node rendering, local news filters, refresh handling, and producer refresh events. Operations ownership records four native renderer routes while data/narrative ownership remains migration-in-progress.
- ARX-07 preparation: macro/fxbond/breadth now share a normalized `data/market` quote/metric state slice and selector-backed key-card updates, with the market snapshot bridge emitting a sync event. Full chart/domain route ownership remains pending.
- ARX-08 preparation: RRG/theme sources now flow through a normalized `data/themes` state slice and selector-backed quadrant/theme-detail cards. Full RRG chart ownership and theme-domain parity remain pending.
- `aio-data.js`의 `window.showPage` monkeypatch를 page bus 등록으로 교체해 explicit global writes를 1110→1109로 줄였다. Store가 `route/changed`를 소비하도록 연결했다.
- Architecture gate에 burn-down 상한·퇴역 패턴·release revision parity를, Chromium gate에 router/store route 및 ESM badge 결과를 추가했다. 운영 상태는 lifecycle owner와 renderer owner를 분리한다.
- 전체 재구축을 다른 세션에서 배치별로 실행할 수 있도록 14계층·17 route·ARX-00~16 dependency wave·DELETE-LEDGER·최종 AC-01~15 인수 기준을 갖춘 실행 핸드오프를 추가하고 architecture gate에 필수 구조를 연결했다.
- R1 7곳 v53.15

## v53.14 (2026-07-19)
- P735 / AR-07 Batch 0: `history.json` 369행의 3,535개 numeric field에 `observedAt/fetchedAt/source/allowedUse` provenance를 보존하고, 1년 백필·휴장일 explicit carry-forward와 blocking field-time contract를 추가했다.
- AR-07 Batch 0/2: FRED macro last-known-good merge를 추가해 키/series 실패가 공식 관측값을 삭제하지 않게 했고, durable FRED HY OAS를 server-data UI success path에 연결했다.
- AR-07 Batch 3: 서버 marketAnalysis는 NFP 천명 단위 semantic gate를 통과한 결과만 publish하며, NFP 10배 오류 fixture를 CI에 고정했다. 현재 로컬에서는 `marketAnalysisSemanticOk=false`로 안전한 template fallback을 사용한다.
- `ci-history-field-time-contract.mjs`를 CI blocking gate로 등록. 7-day Cloudflare fast-plane soak/provider rights/SEC coverage는 여전히 `OPERATOR_REQUIRED/PARTIAL`이다.
- R1 7곳 v53.14

## v53.13 (2026-07-19)
- P734: fixed the encrypted Portfolio Vault reload gate so a hard reload visibly returns to the lock screen.
- Added RSS retry plus a 7-day provider backstop that still filters every article through the canonical completed 08:00 KST cycle.
- The contract check now protects the news retry/backstop path; CI and Pages evidence follows the next deployment.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.13

## v53.12 (2026-07-19)
- P733: fixed the refresh-data ESM summary runtime failure (`require('fs')` to `import fs from 'node:fs'`) and added a module-heredoc regression contract.
- Refresh recovery and live deployment evidence are tracked in the architecture handoff.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v53.12

## v53.11 (2026-07-18)
- <!-- 변경 내용을 이곳에 기록하세요 -->
- AR-07 Batch 0: Tier 0 16종 canonical market snapshot/status artifact와 fail-closed LKG publish contract 추가.
- AR-07 Batch 1/4: Cloudflare Cron/KV/R2 Worker preflight, operations status, 22-category source reconciliation artifact와 watchdog/CI 계약 추가. 미설정 Cloudflare/권리/soak은 `OPERATOR_REQUIRED`로 유지.
- AR-06: WebSearch inferred claim을 방향·범위·신뢰도·출처·관측창으로 분리하고 exact current numeric sink를 차단.
- AR-09 진행: typed lifecycle router가 호환 `showPage` facade와 `AIO_ARCH.navigate`를 통해 전체 route 진입을 소유하고, 레거시 렌더러는 명시적 migration owner로 남김.
- P731/P732: inferred-claim null/camelCase sink 검증과 ESM workflow heredoc parser를 수정하고 각각 blocking contract fixture로 고정.
- R1 7개 v53.11

## v53.10 (2026-07-18)
- **AR-00~06 ESM architecture foundation**: added native `src/` contracts for platform gateways, command store, typed evidence/freshness/lineage, pure sentiment calculations, route lifecycle/dispose, AI evidence policy, and the single legacy compatibility facade. The first sentiment vertical slice is exposed as a read-only `window.AIO_ARCH` migration projection without replacing the legacy shell.
- **AR-07/08 safety contracts**: added fail-closed market snapshot validation (incomplete published coverage is rejected), inferred numeric claim blocking, app/data/evidence revision manifest, Pages allowlist + service-worker ESM parity, and blocking architecture contract/browser lifecycle gates.
- **P729/R346**: fixed the ESM observer's legacy event boundary by listening on `document` and normalizing string/object `aio:pageShown` details. Chromium regression coverage verifies offline blocked sentiment and sentiment→home→sentiment mount/dispose with zero unexpected browser errors.
- **P730**: made the Worker security contract gate terminate deterministically after all awaited assertions pass, preventing a successful CI step from hanging on residual mock-provider handles.
- R1 7곳 v53.10

## v53.9 (2026-07-18)
- P728/R345 2차 성능·품질 리팩터링: `applyLiveQuotes()`가 quote마다 실행하던 전역 lineage scan을 batch 마지막 canonical DOM bind 1회로 축소하고, 같은 `data-live-price`/`data-live-chg` 전체를 다시 쓰던 중복 pass를 제거했다. 단건 Store 갱신은 symbol-target selector만 사용하며 `data-live-field` lineage도 포함한다.
- v53.7에서 KR 전용 페이지가 퇴역했는데도 공유 KR 로더가 삭제된 투자자 TOP10 표를 위해 최대 24개 Naver 종목 요청을 실행하던 경로를 스케줄에서 제거했다. KR 수급 runtime audit은 삭제된 DOM 존재 여부 대신 canonical `_krCurrentSupplyEvidence`의 가용성·나이를 검사한다.
- runtime contract와 headless T383/T863을 새 batch·KR evidence 계약으로 갱신했다. viewport runner는 `AIO_VIEWPORT_NAMES`로 메모리 제약 환경에서 동일 68조합을 shard 검증할 수 있게 했다.
- R1 7곳 v53.9

## v53.8 (2026-07-18)
- P727/R344: v52.71 fxbond 리디자인 뒤 남아 있던 `updateFxDynamicComments()`/`generateFxBondCommentary()`와 `fx-dc-*`/`bond-dc-*` 고아 sink를 제거했다. 살아 있는 `fxbond-risk-pill`/`yc-inversion-badge`/Cross-Asset Matrix 갱신은 `updateFxBondPage()` 단일 경로로 통합해 페이지 진입당 24회, quote 갱신당 16회의 무효 DOM 조회를 없앴다.
- 알림 폴링은 `_aioRegisterTimer('alerts-check', ...)`만 사용하도록 정리해 레지스트리 밖 raw `setInterval` 폴백을 제거했다. runtime contract에 고아 함수·sink·중복 경로 부재와 timer registry 사용을 이진 게이트로 추가했다.
- R1 7곳 v53.8

## v53.7 (2026-07-17)
- **P725 한국장 5페이지 → 기존 분석 페이지 통합 (사용자 지시)**: 사용 빈도가 낮고 용량·코드만 차지하던 KR 전용 5페이지를 정리 — ① kr-home·kr-supply **완전 삭제**(수급 데이터는 B1 블록으로 원래 자동수집 불가), ② kr-themes→themes, kr-macro→macro, kr-technical→technical에 **접힌 "한국 시장" 통합 섹션**(`kr-integrated-*` details, 기존 `aio-page-advanced-toggle` 패턴)으로 요소 id 보존 이관. DOM 약 950줄 순삭감(index.html 총 -846줄).
- 라우팅: NAV_ROUTE 19→14, ROUTE_REGISTRY.REMOVED에 5라우트 등록+canonical 리다이렉트, `_hashAlias`로 구 해시(#kr-home 등)를 대상 페이지로 리다이렉트(실브라우저 확인). `expectedRoutePageCount` 22→17. getRouteIAAudit은 REMOVED를 "canonical 있음+DOM 없음"으로 검사하게 확장.
- 데이터 배선: KR 태스크/심볼(krDynamic·krSupply, ^KS11/^KQ11/KRW=X)을 themes/macro/technical 프로파일·refresh map·완비성 계약(optional)에 병합, `_aioEnsureKrDataLoaded()` 1회 로더 신설, pageShown/liveQuotes 훅을 통합 페이지로 재배선. KR 테마 심볼 수집은 themes 라우트로 이동(limit 900). BOK/KOSIS fetch 트리거 macro로 이관. macro 통합 섹션 상단에 구 kr-home 핵심 지수 카드(KOSPI/KOSDAQ/KRW/VKOSPI) 복원 — P636/P721 전일종가·변화폭 계약 sink 보존.
- 코드 정리: initKoreaHome/initKoreaSupply/renderKrIssues/krSupplyTab/markFeed 퇴역, KR 5페이지 교육 블록·결론/허브/가이드 레지스트리 항목 제거, CSS `#page-kr-*` 셀렉터를 `#kr-integrated-*`로 재타깃(캔들 반응형·테마 progressive·모바일 규칙 보존), 사이드바 "한국 시장" 그룹 제거, 키보드 '8'→themes.
- 게이트 정합: structural(17 routes)·runtime-contract·viewport(17×4=68)·a11y(17)·headless 29개 라우트-수 의존 테스트 갱신(T188/T192/T375/T880은 퇴역 검증으로 전환, T644는 runtime `_weightSource` 가중 허용, T824는 kr-screen-card 존재 조건부 패턴 계약으로). 게이트: 전 정적 게이트 PASS + 헤드리스 1101/1101 + viewport 68/68(FULL_INIT=1) + a11y 17 + critical10 PASS. 실브라우저: 리다이렉트 3종·테마 카드 28개·KOSPI/전일종가/BOK/CPI 배지·캔들 캔버스 확인(Naver 프록시 차단 환경에선 정직한 실패 문구), pageerror 0.
- 참고: `public-data/screener-universe.json` drift는 Windows CRLF 체크아웃 아티팩트(내용 동일)로 확인, 재생성만 수행.
- R1 7곳 v53.7

## v53.6 (2026-07-17)
- **P723 ticker 종목 개요 신설 (밸리AI 참조 레이아웃)**: 사용자 제공 밸리AI 종목 상세 화면을 분석해 데이터 원천이 실재하는 요소만 선별 반영 — ① 좌 요약 레일+우 대형 차트 2열 그리드(`.ticker-ov-grid`, 900px 이하 1열), ② TradingView 대형 차트(기존 `loadTVChart` iframe 빌더에 'ticker' 분기 추가, 동일 심볼 재로드 방지 `dataset.tvSym` 가드, KR 종목은 P610 KRX 하드브레이크 전례로 미지원 명시+자체 차트 안내), ③ 가격 정보 카드(전일 종가·52주 범위+현재가 위치 바·1/3/6개월 수익률 — 시세는 `_liveData`, 수익률은 SCREENER_DB 동일 원천 재사용, R276 새 병렬 계산 경로 없음, 결측은 정직한 '—'+사유 title), ④ 관련 테마 칩(THEME_MAP leaders/subThemes 역조회 → theme-detail 이동), ⑤ 팩터 프로파일 레이더+텍스트 행(SCREENER_DB `factorScores` 유니버스 상대 백분위 — "서술이며 수익률 예측 지표 아님(v52.51 백테스트)" 명시 캡션, Chart.js 미로드/3팩터 미만 시 텍스트만). `aio:liveQuotes` pageBus 재렌더(레이더는 시그니처 가드로 불필요 재생성 방지). 미반영 결정: 애널리스트 12개월 목표주가 팬차트(무료 컨센서스 원천 부재 — 합성 금지), 재무제표 점수 카드(미검증 합성 지표 신설 금지).
- **P724 잠재 버그 발견·수정**: P723의 52주 범위 소스를 배선하기 전 쓰기 지점을 전수 추적한 결과, Yahoo v7 quote의 52주/거래량 확장 필드를 `_liveData`에 쓰는 코드가 저장소에 0곳이었음(v48.6부터 fundamental 가격 포지션 카드의 "1순위 _liveData" 읽기가 영구 미스 → 항상 Finnhub 폴백). `applyLiveQuotes()`에 기존 prevClose 보존 패턴과 동일하게 7개 필드 수신 시 복사 추가. 상세: BUG-POSTMORTEM P724.
- 게이트: version/structural/runtime/control-char/static-data PASS + 헤드리스 1101/1101 + viewport 88/88(FULL_INIT=1) + a11y 22 routes + critical10 10 routes PASS. 로컬 실브라우저(Playwright) NVDA 실렌더 검증(수익률·테마 칩·팩터 레이더·TV iframe 로드 확인, 52주 범위는 라이브 quote 수신 환경에서만 표시).
- R1 7곳 v53.6

## v53.5 (2026-07-17)
- REMAINING-WORK "2026-07-16 배치 이후" 섹션 A1/A2/B3 실행 배치.
- **B3 크론 산출물 검증 → P719 발견·수정**: v53.2 배포 후 라이브 아티팩트를 curl로 대사 — telegram-digest(topItems 45/broadItems 360 전부 summary-only ✅)·screener.json(845행 price 필드 0건 ✅)은 계약 준수였으나 **data.json은 quotes 77건이 그대로 재발행**되고 있었음. 원인: `fetch-data.mjs`가 P715 스트립을 적용한 첫 발행(1761행) 뒤 scrInfo meta 후기록 재기록(1809행)에서 스트립 안 된 원본 `data`를 그대로 써서 계약을 덮어씀. 발행 페이로드 생성을 `toPublicPayload()` 헬퍼로 일원화하고, 마지막 발행본을 디스크에서 다시 읽어 quotes=[]·quotesPublished:false를 단언하는 read-back 계약 검증 추가(위반 시 커밋 전 워크플로 fail).
- **A1 전술 스코어 percentile/레짐 상대화 재설계(relative-v1) + 재백테스트 — 통과 실패, 확정 정책 유지**: 절대 임계값(vix 5밴드, dxy>107/110, tnx>4.5, vvix>110, oil>90/100, crossRisk)을 trailing 롤링 percentile(≤2520d, warm-up ≥252d, look-ahead 없음)로 치환한 변형을 `backtest-trading-score-longrun.mjs`에 추가, 동일 10y 데이터(2016-07-18~2026-07-16, 2513거래일)로 baseline과 병렬 재백테스트. **결과: 음의 상관 크기는 크게 감소(63일 rho −0.257→−0.078, 21일 −0.166→−0.078)해 R298 가설(절대 임계값의 레짐 드리프트)이 원인의 상당 부분이었음을 확인했으나, 여전히 유의한 음(−)(CI 0 미포함)이고 holdout 63일은 −0.306** — 통과 기준(유의한 양의 IC) 미달. 확정 정책대로 라이브 스코어/라벨 무변경("환경 설명값" 유지), 산출물 `public-data/score-backtest-longrun.json` 갱신.
- **A2 IA 잔여 실행**: ①home/signal 스코어 히어로 게이지 강등 — 숫자 52px/60px→22px·색 secondary로 낮추고 라벨 "종합 거래 점수"→"시장 환경 점수 · 참고값"+"환경 설명값 — 매매 판단 지표 아님" 캡션(P714 공시와 시각 위계 일치, 판단문이 리드). ②첫 방문 온보딩 — home 상단 비차단 인라인 카드로 브리핑/시장 환경/학습 가이드 3버튼 1회 표시(v50.71 "첫 화면 모달 차단 금지" 결정 존중, P714 면책 바와 동일한 localStorage 1회 패턴, `aio_onboarding_nav_v1`).
- **P720 간헐 CI RED 수리**: 사용자 보고("run failed 이메일 종종")의 원인을 e603a583 데이터 재현으로 실증 — critical10 감사 `staleTokenRe`의 맨몸 `5/4|5/5|5/8|5/9` 토큰이 signal 실행 체크리스트 "5/5 (충족)" 정상 렌더와 충돌(시장 상태 좋은 날만 T173 실패). 맨몸 날짜 토큰 제거(잔재 감지는 v53.4 정적 계약이 전담), 같은 체크리스트의 "진입 검토 가능/진입 자제" 시스템 발화 라벨 2곳을 관측형("조건 대부분/일부 충족·미충족 다수")으로 전환.
- **P721 RRG 영구 공백 수리 (22페이지 렌더 전수 감사 발견)**: 라이브 themes RRG가 "근거 0/11 판정 보류"로 전 방문자 공백 — calcLiveRS가 세션 내 30초 틱 누적(>20샘플, 리로드 시 소멸)에 의존하던 v27.2 잔재가 v52.98 시드 제거 후 대체 경로 없이 남은 것. `hydrateRRGDailyHistory()` 신설(fetchViaProxy+_parseYFChartResponse 기존 패턴, SPY+11섹터 6개월 실제 일봉, 배치3 동시·점진 재렌더), `_priceHistoryDaily` 마커로 틱 오염 차단, calcLiveRS/사분면 카드의 라이브 틱 선행 게이트를 일봉 우선으로 완화. 시세 차단 로컬 실브라우저에서 근거 11/11·실분류 렌더 검증. 부수: kr-home KOSPI/KOSDAQ 변화폭 HTML 정적 리터럴(▲200.86/▼28.05, 카테고리 20 위반 잔존) 제거 + `data-live-kr-change` 숫자 리터럴 금지 게이트 추가.
- **P722 push 전 CI RED 사전 차단**: 리베이스 후 봇 artifact(quotes 77)로 헤드리스를 재검증해 v53.3/53.4 신규 테스트 3건(T324/T376/T786)이 "데이터 없음"(quotes=[] 로컬 상태)을 영구 불변식으로 단언하고 있음을 발견 — 형태 불변식(스키마+null-or-valid, fail-closed 양방향 계약, 상수 floor 부재)으로 재작성. 양쪽 artifact 형태에서 1101/1101 확인.
- **데이터 공백 staleness 22카테고리 전수 분류(/data-refresh)**: 채울 수 있는 것은 검증·갱신(Fed 3.50-3.75 동결·FOMC 7/28-29·KR CPI 3.2%/2.5% 공식 대조 일치, krInflation publishedAt을 실제 발표일 7/2로 정직화), 소스 없는 공백은 BLOCKED 명시 유지(B1 KR 수급/breadth, AAII/NAAIM/II, SEC 80% 게이트 누적 중). quotes=[] 형태 data.json(P719 수정 후 크론 발행 형태)으로 헤드리스 1101/1101 사전 검증 완료.
- R1 7곳 v53.5

## v53.4 (2026-07-16)
- P718/R341/R342: 정적 시나리오 공급자 퇴역 뒤 남아 있던 `updateDynamicScenarios()`·호출·빈 DOM sink를 수직 제거했다. provider-required/unavailable 상태만 노출하며 결측 확률을 숫자로 포맷하지 않는다.
- 거시 캘린더 기계식 날짜 생성, 고정 주간 뉴스·한국 수급/부동산/선행지수 스냅샷, 합성 SPY/QQQ/GLD 시세, 중립 점수·거시 storyline·AI 비용의 숫자 fallback을 제거했다. 데이터가 부족한 계산은 가용 입력 재가중 또는 명시적 산출 보류로 닫는다.
- 강화된 검증은 정적 데이터 계약 22/22, runtime/structural/semantic, Chromium headless 1101/1101, 실제 Chromium critical-10 10/10·접근성 22/22(consoleErrors 0)를 통과했다.
- P717/R342: 스크리너 전역의 정적 수치·현재형 텍스트를 22개 데이터 카테고리로 전수 분류하고, 변동 데이터는 runtime-only·미수신은 explicit null/`—`로 통일했다.
- quote/FRED/RRG/sentiment/합성 차트/시나리오 확률/이벤트·지정학 narrative/LLM 가격·환율 폴백과 중복 CHAT_CONTEXTS를 제거했다. 공식 Fed·BOK·CPI 일정/정책만 provenance가 있는 `AIO_MANUAL_REFERENCE`에 reference-only로 남겼다.
- SCREENER_DB 873행을 identity-only로 압축하고 스크리너 유니버스를 재생성했다. 동적 memo는 Telegram provenance가 있을 때만 허용한다.
- `ci-static-data-contract-check.mjs`를 CI에 추가했다. 정적 데이터 계약 22/22, runtime/structural/data-lineage, Chromium headless 1100/1100을 통과했다. SEC 저커버리지는 합성값 없이 reference 경고로 유지한다.
- R1 7곳 v53.4 동기화. 커밋·배포 미수행.

## v53.3 (2026-07-16)
- P716: feedback board, 구형 macro narrative, breadth history chart, legacy indicator 및 declaration-only wrapper를 DOM·CSS·상태·호출·테스트까지 수직 제거해 전체 diff를 순감소 1,300줄 이상으로 정리했다.
- 퇴역 기능을 inert stub로 남기는 회귀를 차단하도록 runtime named-function declaration-only structural gate를 추가하고 테마·기업분석 테스트를 활성 계약/완전 부재 계약으로 전환했다.
- Pages 배포를 5개 runtime script 명시 허용목록으로 전환하고 CI 전용 `aio-tests.js`(약 680KB)를 Pages artifact와 service worker shell cache에서 제외했다. manifest·CI workflow·SW 정합은 release revision gate가 검사한다.
- JS/MJS 38개 문법 검사, 정적 계약 14개, Chromium 1100/1100, boot, critical-10, vault 8/8, 접근성 22/22, FULL_INIT viewport 88/88 통과. CODE-MAP의 파일 크기·script/style·22-route anchor를 v53.3 기준 전면 재측정했다.
- R1 7곳 v53.3

## v53.2 (2026-07-16)
- P715: "지인 소수 공유 준비" 사용자 결정 배치(AskUserQuestion 8건 확정). **WP-1 Telegram digest 요약화** — producer가 topItems/broadItems에 원문 전문 대신 120자 summary만 발행(권리 정직화), 기존 아티팩트 즉시 변환(1.32MB→193KB, 85%↓), 클라이언트 소비처 5곳 text||summary 호환, 증분 병합은 summary를 내부 text-등가로 처리.
- **WP-2 KR 정지 위젯 정리** — kr-home "한국 시장 대시보드"의 2026-05 정지 스냅샷·영구 '—' 카드 9칸을 데이터 공백 상태 카드 1장 + 접힌 참고 스냅샷으로 재구성(data-snap/id 전부 보존, 소스 확보 시 복원 가능).
- **WP-3 스크리너** — ①signal enum(BUY 173/HOLD 588/WATCH 108/SELL 4)은 내부 키로 유지하고 표시 레이어를 `_scrSignalLabel`(강세 구조/중립/관찰/약세 구조)로 전면 매핑(테이블 셀·워치리스트 배지·필터 옵션·KPI·판정문 5곳), "신규 진입 보류 권장" 지시형 제거. ②screener.json 종목별 원시 price 발행 중단(파생 지표만) — producer 발행 시점 스트립+아티팩트 846행 변환+validator를 price-금지 계약으로 반전(내부 계산·백테스트는 무영향, 현재가 컬럼은 data-live-price 라이브 경로만).
- **WP-4 data.json 시세 재배포 제거** — 공개 아티팩트에서 77종목 quotes를 빈 배열로 발행(내부 수집은 히스토리 append·분석 프롬프트·건강도 카운트용으로 유지, meta.quotesPublished:false/quotePolicy 명시). 서버 백스톱 제거가 드러낸 실버그 연쇄 수정: `computeMarketHealth` fail-closed null score가 signal 체크리스트(ec-val)와 바닥 체크리스트에 "null점"으로 노출 — **`Number(null)===0` 코어전 함정**으로 1차 가드가 무력했던 것까지 실측 재현으로 확정, `typeof === 'number'` 가드 3곳 적용. critical10 감사 staleTokenRe의 '1,508' 리터럴이 라이브 USD/KRW 실값과 충돌하는 오탐 구조 제거(T175가 타깃 가드 전담). T458을 팔레트 hue 결합에서 과열 override 경계(≥70) 검증으로 정정(US above20=52.5 실측 오검출).
- **WP-5 IA 재편** — 사이드바 5그룹 20항목 → 데일리(브리핑/대시보드/뉴스)·시장 분석(7)·내 투자·도구(3)·학습(2) + 한국 시장 접힘(B1 공백 동안). 라우트·기본 페이지 무변경. "매매 시그널" 메뉴명 → "시장 환경"(P714 정합).
- 판정 변경 2건 정직 기록: 공용 프록시→자체 Worker 전환은 기존 완비(Tier-0+재초기화 훅) 확인으로 툴팁만, TG 부팅 지연로드는 ETag 304 구조로 no-op.
- R1 7곳 v53.2

## v53.1 (2026-07-16)
- P714: 전체 시스템 기관 관점 전수 진단에서 발견된 이슈의 코드 실행분. **시스템 발화형 매매·배분 지시 전면 제거(컴플라이언스 1순위)** — `AIO_ACTION_RULES`의 "포지션 100/80/50/30/15%"·"역발상 매수/차익실현"·"풋옵션 헤지 필수"를 프레임워크 귀속 관측형으로 재작성(sizePct는 데이터 필드로만 유지, 렌더 금지), 옵션 "권장 전략"→IV 레짐 서술, home/signal 결론 바의 "선별매수/분할 진입 검토" 잔존 라벨(공시 정정과 정면 모순이던 것) 교체, 시그널 점수 범례 "0~40=현금 확보"→환경 설명값+음(−) 상관 명시, MTF "행동 가이드"·VIX 행동 가이드·breadth 리테스트 "매수 시작"·티커 목표가 "분할 매도"·KR 테마 "매수 자제"·시나리오/교육 문구 등 총 20여 곳 관측형 전환. 출처 귀속 교육 서술(BofA FMS 등)과 안전 테스트 픽스처는 유지. T221을 관측형 라벨 기준으로 재작성.
- `computeTradingScore` macro 축의 `hyg < 76` 달러 가격 고정 임계 제거 — 바로 아래 v51.88 주석이 스스로 설명하던 듀레이션 오염 경로였고, 신용 스트레스는 기존 FRED HY OAS(bp) 실측 전용 감점 블록으로 일원화(이중 계상 겸 오염 제거).
- 스크리너 "추세신뢰도" 컬럼에 (연구) 라벨+예측 미확립 툴팁 명시(헤더·범례·셀 툴팁 3곳). VCP 헤더는 기존 정합 확인.
- 첫 방문 투자 면책 고지 승격 — guide `<details>`에 접혀 도달률 0에 가깝던 면책을 최초 방문 시 비차단 하단 바(role=region, 확인 버튼, localStorage 1회)로 표시. 내부 점수의 음(−) 상관 관측 사실 포함.
- AI typed-claim 옵트인 공백 완화 — envelope 미제출(not-structured) 응답이 현재성 표현+숫자를 포함하면 차단 대신 "자동 검증 미통과" 고지를 본문에 비차단 부가(`_aioRunAIResponsePipeline`).
- CF Worker URL 설정 입력의 가치 설명 툴팁 보강(Tier-0 프록시 승격·저장 즉시 적용 — 레지스트리/재초기화 훅은 기존 완비 확인). 진단 항목 중 Telegram digest 부팅 지연 로드는 재조사 결과 ETag 304+시간 버킷으로 이미 효율적이라 no-op 판정, index.html 원시 setInterval은 0건으로 비이슈 판정.
- R1 7곳 v53.1

## v53.0 (2026-07-16)
- P713: 금융 전문가 관점 전수 리뷰(v52.73~v52.99 Codex 작업분)에서 발견된 fail-closed 정책 누락 표면 정리. `updateWeinsteinStage()`/`updateMTF()`가 시장폭 미수신 시 임의 폴백(abv50=28, 20SMA=57)과 정적 시드로 Stage/추세를 판정하던 것을 evidence-gate로 교체 — 50SMA 폭 미수신이면 Weinstein은 판정 자체를 보류하고, MTF는 해당 축을 제외한다.
- 두 함수의 HYG 달러 고정 가격밴드($80/76/72, $80/75) 신용 판정을 FRED HY OAS(`_hySpreadBp`) 관측값 밴드(350/450/550bp)로 교체. OAS 미수신이면 신용 축을 제외하고 가중 평균이 재정규화된다(HYG 가격 '방향'만 단기 보조 신호로 유지).
- Weinstein 단계별 전략 문구를 명령형("매수 금지! 현금이 최고의 포지션", "추세를 따라가세요")에서 프레임워크 귀속형("원 프레임워크의 교과서적 대응")으로 전환하고, disclaimer에 조합 점수의 예측력 미검증을 명시.
- VKOSPI 시드(16.00)가 라이브 fetch 실패 시 kr-supply 배너와 AI 채팅 컨텍스트 5곳에 라벨 없이 현재값처럼 노출되던 누출 차단 — `window._vkospiLiveOk` 플래그를 fetch 성공 시에만 세우고 소비처 전부를 게이트("—(미수신)" 폴백).
- 전술 스코어 공시 격상: "통계적 예측력은 아직 검증되지 않았습니다"가 실측(WO-2 부분 백테스트: 21/63일 선행수익률과 유의한 음의 상관)을 과소 공시하던 것을 정직화. 45~60 밴드의 "50% 현금 유지" 배분 지시도 관측형으로 교체.
- 잔여 매매 권유 문구 스윕: "성장테마 선별 매수 구간"(kr-sentiment 크로스), "리테스트 대기하며 선별 매수 가능"/"분할 진입 검토"(breadth 판정), "반등 가능"(채팅 컨텍스트) → 과거 관측 서술로 전환.
- T884 CI 부패 수리: '2026-07-16' 하드코딩 단언이 금통위 당일 auto-advance(→8/30 추정)와 충돌해 main CI를 RED로 만들던 것을 rot-proof 정합성 검증(유효 날짜+캘린더 일치)으로 재설계. BOK 공식 2026 일정 반영(7/16 종료→차기 8/27, 주기 추정 8/30 아님). 동일 클래스인 runtime contract의 BOK/FOMC 날짜 핀 2건도 구조 검증으로 교체(FOMC 핀은 7/29에 같은 방식으로 부패 예정이었음).
- debug.log git 추적 해제(.gitignore 추가).
- BOK 기준금리 실제 결과 반영(2026-07-16 공식 확인, 복수 언론 교차검증): 금통위 7인 만장일치로 2.50%→2.75% 0.25%p 인상(2023.1 이후 3년6개월 만의 인상, 14개월 동결 종료). DATA_SNAPSHOT 시드·currentTopic·정적 HTML placeholder 3곳(bok-rate/bok-next/bok-status)·금리 히스토리 표 신규 행·오늘의 이슈 카드·채팅 폴백 리터럴 3곳·KR 건강점수 폴백을 전부 2.75%/인상으로 동기화.
- R1 7곳 v53.0

## v52.99 (2026-07-15)
- P712 전수 렌더 후속 점검에서 엔캐리 프록시의 하드코딩 입력·개입/청산 단정, 시각 없는 이동평균 레짐, OHLCV 없는 라운드 지지·저항, RSP/SPY 가격비율의 시장폭 해석, 출처 없는 한국 공매도 시드를 제거했다.
- 결측이면 프록시 점수·레짐·지지저항을 보류하고, 환율·거시·크로스에셋 문구는 관측 수준과 확인할 추가 근거를 분리해 표시한다.
- R340/P712·QA 체크리스트·runtime contract·T874를 새 fail-closed 정책으로 갱신했다. 22-route semantic render와 로컬 QA를 재실행했으며 배포·커밋은 수행하지 않았다.
- R1 7곳 v52.99

## v52.98 (2026-07-15)
- Telegram 3채널 digest 주입 확인을 22개 페이지의 가시 텍스트·숫자·차트·판정 문구 전수 대조로 확장했다. BLS/BEA/Fed/FRED/BOK/Cboe/NAAIM 공식값과 최신 `public-data`를 기준으로 일정·물가·금리·심리·한국 시장 입력을 재검증했다.
- `^TNX` 10년물의 2년물 슬롯 오염과 5년물 기반 합성 2년물을 제거하고 명시적 만기별 curve evidence 및 관측 2s10s만 사용한다.
- OHLCV 실패 시 RSI/MACD/Stage 추정, ticker·breadth 난수 차트, 과거 시드 RRG, 50MA 상회율 역산 McClellan, HYG→HY OAS 임의 변환을 제거했다. 필수 관측값·시계열이 없으면 값·등급·행동 문구를 함께 판정 보류한다.
- 공식 미래 일정은 동적 생성하고, AAII/NAAIM·한국 촉매·수출 자료를 기준일·reference-only로 분리했다. 한국 테마·시장건강도는 quote coverage와 현재 수급/VKOSPI가 부족하면 fail-closed한다.
- P712/R340, T1024~T1027, runtime contract 및 22-route semantic audit을 추가했다. Chromium headless 1088/1088 PASS. 배포·커밋은 수행하지 않았다.
- R1 7곳 v52.98

## v52.97 (2026-07-15)
- Telegram Web 3채널의 최근 5일 546건을 전수 대조해 기존 digest가 254건의 selected raw만 보존하고도 전체 count처럼 보이며, 동적 원문 로드 뒤에도 2026-07-03 static narrative/page map을 유지하던 결함을 확인했다.
- 전체 기간 경량 `observedItems` lineage와 capped full-text payload를 분리하고 fresh/text-eligible/high-signal/selected coverage를 명시했다. producer와 runtime fallback이 현재 원문에서 themes/catalysts/categories와 22-page map을 재생성한다.
- insider/earnings/flows/healthcare/japan 태그, SCREENER_DB 기반 ticker alias, `getTelegramPageCoverageAudit()`를 추가했다. 전 채널 공개 미러 실패 시 마지막 정상 digest와 성공시각을 보존한다.
- P711/R339, T830~T831, data/runtime contract, `_artifacts/telegram-5d-coverage-audit-2026-07-15.md`에 감사·예방 근거를 기록했다. 배포/커밋은 수행하지 않았다.
- R1 7곳 v52.97

## v52.96 (2026-07-15)
- Added `scripts/ci-data-lineage-audit.mjs`, a policy-aware audit for all 12 tracked `public-data/*.json` artifacts. It reports the selected timestamp, age, source, producer failures, and last Git commit without promoting one timestamp type into another.
- Added the lineage/freshness CI gate and R338/QA coverage. Live-core failures fail closed; reference/research staleness and SEC coverage below the 80% decision-use gate remain explicit warnings.
- Local evidence: PASS 10, WARN 2, FAIL 0. Warnings are the stale declared universe reference and SEC 24/655 (3.7%) coverage; no provider rights, factual truth, live deployment, or human/legal approval is inferred.
- R1 7 surfaces v52.96.

## v52.95 (2026-07-15)
- WP-8 local release revision contract added: CI derives one deterministic revision from app version, SW build, data/screener hashes, Worker source hash, and the Pages artifact allowlist. It does not certify live deployment, provider rights, or human/legal approval.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v52.95

## v52.94 (2026-07-15)
- post-refresh CI regression fixed: T686 now distinguishes dated reference-only fallback drift from live parity, and T1022 load-state fixtures override direct artifact metadata; runtime contract, postmortem P709, and R337 record the prevention gate.
- BLS Public Data API keyless adapter를 추가해 CPI, core CPI, 실업률, 노동참가율, 비농업고용, 시간당 임금을 typed official evidence로 수집한다. 12시간 성공 캐시, M13/연간 혼입 차단, insufficient history, releaseAt null, last-known-good 보존을 계약화했다.
- 22개 route page contract에 required/optional producer, coverage, age, failure state, forbidden claims를 연결하고 `AIO.getPageDataCompleteness()`/`auditPageDataCompleteness()`로 loaded/partial/empty/blocked/stale-reference를 판정한다.
- 스케줄러에 attemptedAt/lastSuccessfulAt/status/coverage/evidenceIds/failureReason을 기록하고 BLS·페이지 완결성 fixture 및 runtime contract gate를 추가했다.
- 대규모 로컬 검증: data/runtime/structural/version/semantic/knowledge 게이트 PASS, Chromium headless 1084/1084 PASS, 22-route accessibility PASS, viewport 88/88 PASS, portfolio E2E 8/8 PASS.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v52.94

## v52.93 (2026-07-15) — 무료 공식 소스·독립 스크리너 publish 완결

- 기관급 데이터 핸드오프와 v52.92 실제 구현을 전수 대조해 중복·부분 구현·미구현을 `INSTITUTIONAL-HANDOFF-RECONCILIATION-2026-07-15.md`에 구분하고, 다른 모델이 바로 실행할 수 있도록 기준선·Batch 0~6·WP 파일 카드·22-route 데이터 계약·BLS 설계·게이트·배포/롤백 절차까지 단일 실행 계약으로 확장했다.
- `SCREENER_ONLY`를 6시간 독립 GitHub Actions workflow로 연결하고, 846/870 재생성 row마다 실제 `observedAt/sourceKind/allowedUse`를 저장한다. publish 전 커버리지·행 수·시장폭·research-only 계약을 검증한다.
- 무료 SEC companyfacts를 24종목 bounded batch로 누적하는 annual 정규화 adapter와 atomic artifact를 추가했다. 미국 유니버스 재무 커버리지 80% 전에는 value/quality를 활성화하지 않으며 운영 연락 User-Agent가 없으면 fail-closed다.
- 403인 Cboe CDN/공용 proxy 대신 공식 Daily Market Statistics에서 total/equity/index Put/Call과 거래일을 server ingest하고 delayed로만 사용한다. client 실패가 공식 서버값을 snapshot으로 되돌리지 못하게 했다.
- quote producer에 `observedAt/fetchedAt/delayedByMs/session/venue/allowedUse`를 명시하고, direct-run guard 5곳의 빈 `process.argv[1]` import 충돌을 수정했다. knowledge lint는 미스테이징 신규 문서도 검사한다. P708/R334, LIVE3-17~23과 runtime/data-pipeline/knowledge 계약을 추가했다.
- R1 7곳 v52.93

## v52.92 (2026-07-14) — 스크리너 자동 브레드쓰·외부 의존 대체 구조

- 870종목 스크리너를 핵심 데이터 파이프라인과 분리해 갱신하는 `SCREENER_ONLY` 경로를 추가하고 실제 847개 일봉 이력을 재생성했다.
- 전체/미국/한국 유니버스별 5·20·50·200일선 상회 비율, 상승/하락, 커버리지와 실제 관측시각을 산출한다. 미국 707/725(97.5%), 한국 140/145(96.6%)이며 공식 거래소 폭이 아닌 AIO 유니버스 내부 집계로 제한한다.
- 핵심 시세가 50% 미만이면 첫 `data.json` 쓰기 전에 실패하도록 바꿔 외부 장애가 마지막 정상 산출물을 빈 파일로 덮어쓰지 못하게 했다.
- 퀀트 팩터는 상대 랭킹·연구 전용으로 고정하고 예측 검증 미확립·라이브/백테스트 불일치를 공개 계약과 화면에 반영했다.
- 외부 의존 15개 범주의 현재 경로·대체 API·권리·cadence·구현 상태를 `AIO.getExternalDependencyAudit()`와 `DATA-SOURCE-REPLACEMENT-PLAN-2026-07-14.md`에 기록했다.
- P707/R333, LIVE3-11~16과 data/runtime 계약을 추가했다. Browser 플러그인 호출 중단은 브라우저 검증으로 계산하지 않았고 배포·커밋은 수행하지 않았다.
- R1 7곳 v52.92

## v52.91 (2026-07-14) — 3차 라이브 데이터·시장 정합성 전수 진단

- 배포 데이터와 실브라우저 20개 사용자 표면을 현재 시장과 대조했다. 77/77 시세, F&G, FRED 19개, 뉴스 40개는 최신 수집됐지만 시장폭·Put/Call·AAII·한국 수급·Telegram·FMP는 정적·지연·차단·무응답 상태임을 확인해 “전체 자동 최신화”로 보고하지 않는다.
- 시세 파일 생성 시각과 거래소 실제 관측 시각을 분리 보존하고, 정책금리처럼 정상적으로 오래 유지되는 값에는 지표별 freshness budget을 적용했다. 오래된 시장폭·Put/Call·AAII는 점수·레짐·실행 판단에서 중립화하거나 차단했다. client F&G 재수집 실패가 최신 서버값을 정적 seed로 되돌리던 우선순위도 수정했다.
- 브리핑의 SPY/S&P 혼용과 잘못된 등락 필드, 한국 수급의 누락값→0 변환·잔존 매수/매도 막대, 상충하는 한국 지수 소스 덮어쓰기, Telegram 실패 시각을 성공 시각처럼 갱신하던 문제를 수정했다.
- 전술 점수는 통계적 예측력이 확인되지 않은 환경 설명값으로 명시하고 `Buy Ready`/`선별 매수` 밴드를 `환경 우호`/`환경 양호`로 변경했다. 용어사전 기대값 계산을 +0.4R로 바로잡고, API 비밀키는 입력 DOM에 실값을 복원하지 않는다.
- LIVE3-01~10 계약과 22개 데이터 범주 평가표를 추가했다. 실브라우저 재검증·정적/헤드리스/뷰포트/접근성 게이트 결과는 `_artifacts/data-currentness-v5291/ASSESSMENT.md`에 기록했다. 배포·커밋은 수행하지 않았다.
- R1 7곳 v52.91

## v52.90 (2026-07-14) — 상태 기반 사용자 여정 2차 보강

- 기업 분석의 외부 공급자 대기를 8초 총 예산 안에서 병렬·부분 성공으로 종료해 무한 로딩을 없앴다. 뉴스는 서버 캐시·기기 캐시·직접 수집 모두 같은 항목으로 감성·24시간·리스크·수신 상태를 갱신하고, `12개 더 보기`를 실제 시장 뉴스 피드로 이동했다.
- 닫힌 AI 패널을 `inert` 처리하고 트리거의 `aria-expanded` 및 닫기 후 포커스 복귀를 동기화했다. 포트폴리오 빈 상태에서는 계산 불가능한 리스크/배분/벤치마크를 숨기고 첫 종목 추가 흐름만 남겼다.
- 국내 테마는 카드당 기본 5종목·260자 메모로 제한하고 시세 갱신 뒤에도 전체 메모가 되살아나지 않게 했다. 한국 수급 종목 요청은 24개 직접 요청으로 제한하고 종목별 공용 프록시 재순회, 동시 중복 실행, 중복 실패 경고를 제거했다.
- 브리핑 외신 제목은 실패한 번역 캐시와 상단 시장 동인 렌더러 모두 원문 영어를 성공으로 보지 않고 한국어 상태 문장과 2줄 레이아웃으로 표시한다. 기업 분석 0개 소스는 완료로 표시하지 않으며 모바일 상단바·기업 검색·필터/탭·국내 테마 헤더도 보강했다.
- P705/R331과 T1015~T1020, runtime contract G2를 추가해 loaded/empty/degraded/closed 최종 렌더 상태를 재발 방지 계약으로 고정했다.
- 최종 검증: headless 1081/1081, 내부 22라우트×4뷰포트 88/88, 접근성 22라우트, 핵심 10면, 포트폴리오 8/8, 20개 사용자 표면 40렌더+14개 상태 여정 PASS, pageerror 0.
- R1 7곳 v52.90

## v52.89 (2026-07-14) — 남은 7면 시안 확장과 20개 사용자 표면 정리

- 사용설명서·용어사전·한국장 홈·수급·국내 테마·한국 매크로·한국 기술까지 13면 시안의 아이보리 타이포그래피, 헤어라인 구획, 낮은 시각 소음을 확장했다.
- 사용설명서는 검색 가능한 8개 장, 용어사전은 267개 의미 단위 행, 국내 테마는 3개 우선 노출+더보기로 재구성했다. 한국 홈·매크로는 핵심과 추가 탐색을 분리하고 중복 뉴스/용어 블록은 공용 표면으로 통합했다.
- 제품 수를 19개 메뉴 페이지 + 용어사전 오버레이 = 20개 사용자 표면으로 명확히 했다. 자동 QA의 22개는 여기에 파생 뷰 2개(`ticker`, `theme-detail`)와 폐기 호환 reference 1개(`options`)가 포함된 내부 라우트 수다.
- T869와 runtime contract에 이 분류와 7면 점진 공개 계약을 추가했다. headless 1075/1075, 내부 22라우트×4뷰포트 88/88, 접근성, 핵심 10면, 포트폴리오 vault E2E 8/8을 통과했다.

## v52.88 (2026-07-14) — 13면 시안 최종 렌더 고정과 정보 밀도 보정

- 페이지 진입 뒤 자동 삽입되던 판단 헤더·관련 뉴스, 중복 Telegram 피드, 운영 배지와 시안 밖 details를 일반 사용자 경로에서 제거해 초기 HTML과 실제 화면을 일치시켰다.
- 시장 뉴스와 퀀트 스크리너는 각각 12개씩 점진 공개하고, 브리핑 뉴스는 820px에서 명시적으로 확장하도록 바꿔 데이터량이 늘어도 첫 화면 밀도가 유지된다.
- 포트폴리오 상단을 총손익·현금·노출 규칙 3열로 정리하고, 기업 분석은 기존 데이터 파이프라인으로 NVDA 기본 보고서를 자동 채운다. 홈·투자 심리·거시경제의 기존 재배치/운영 블록도 시안 순서에 맞췄다.
- T869와 runtime contract를 최종 렌더 계약으로 강화했다. 로컬 Chromium 13면×데스크톱/모바일 26면 캡처에서 pageerror 0, 자동 판단 헤더 0, 노출 details 0을 확인했고, headless 1075/1075·22라우트×4뷰포트 88/88·접근성 22라우트·핵심 10면·포트폴리오 vault E2E 8/8을 통과했다. 배포·커밋은 수행하지 않았다.

## v52.87 (2026-07-14) — 13면 시안 중심 기본 정보구조 재구축
- 13개 핵심 화면에서 동적 기초 가이드, 접힌 레거시/고급 패널, 파이프라인 경고를 일반 사용자 경로에서 제거하고 개발자 모드에서만 확인하도록 분리했다.
- 홈 `Public Status` 운영 진단은 일반 화면에서 렌더하지 않으며 개발자 모드에서만 기존 감사 API를 통해 표시된다.
- 포트폴리오는 보유 종목 → 리스크 → 비중/섹터 → 벤치마크 → 보유 종목 분석 순으로 재배치했고 종목 입력 폼은 상단 `종목 추가` CTA로 열도록 바꿨다.
- 스크리너 기본 표를 시안의 9개 열(종목, 현재가, 1M, 3M, 6M, RSI, vs 50MA, 추세신뢰도, VCP)로 맞추고 나머지는 `전체 컬럼 보기`에 유지했다.
- T869와 runtime contract를 시안 기본 경로 회귀 게이트로 교체했다. Chromium headless `1075/1075`, 22라우트×4뷰포트 88조합, 접근성 22라우트, 핵심 10면 검사를 통과했으며 배포·커밋은 수행하지 않았다.

## v52.86 (2026-07-14)
- WP-AI19/20 is `VERIFIED_LOCAL`: tool capabilities are read-only by default with unknown/mutation deny; provider/data/output rights, retention, training, redistribution, and region fields now live in an explicit registry with review-required states for unverified live entries.
- Added `AIO.getAIToolCapabilityRegistry`, `AIO.evaluateAIToolPermission`, `AIO.auditAIToolCapabilities`, `AIO.getAIRightsRegistry`, `AIO.evaluateAIDataRights`, and `AIO.auditAIRightsRegistry`; the shared pipeline carries `toolAudit`/`rightsAudit` and blocks mutation intent.
- Added T1007~T1014 and WP-AI19/20 runtime-contract checks. Verification: changed-module syntax, runtime contract, version contract, and Chromium offline headless `1075/1075 PASS`; an operator-provided authenticated Worker smoke reached Anthropic with `HTTP 200`, while provider/data/output rights, legal/operator policy approval, multi-user tool isolation, and PUBLIC readiness remain unverified.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v52.86

## v52.85 (2026-07-14)
- WP-AI17/18 is `VERIFIED_LOCAL`: coverage/exposure reports now measure region/sector/cap/liquidity/source coverage and block missingness promotion; human-chat certification records signed SR/keyboard/mobile/novice/expert/task evidence with explicit incomplete states.
- Added `AIO.buildAICoverageExposureReport`, `AIO.evaluateAICoverageBias`, `AIO.getHumanChatCertificationMatrix`, `AIO.createHumanChatCertification`, and `AIO.evaluateHumanChatCertification`; missing data remains neutral and unsigned/incomplete human evidence fails closed.
- Added T999~T1006 and WP-AI17/18 runtime-contract checks. Verification: changed-module syntax, runtime contract, version contract, and Chromium offline headless `1067/1067 PASS`; live population/model bias, assistive-tech/user certification, deployment, and PUBLIC readiness remain unverified.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v52.85

## v52.84 (2026-07-14)
- WP-AI15/16 is `VERIFIED_LOCAL`: response manifests now retain replay provenance and output/evidence hashes with approval/canary/rollback release gates; request envelopes carry tenant-safe isolation keys and idempotency state, while stream partial/complete/aborted finalization is auditable.
- Added `AIO.createAIReplayManifest`, `AIO.recordAIReplayManifest`, `AIO.replayAIResponseSample`, `AIO.evaluateAIModelRelease`, `AIO.buildAIIsolationCacheKey`, `AIO.beginAIIdempotentRequest`, `AIO.finalizeAIIdempotentRequest`, and `AIO.finalizeAIStream`; the existing shared pipeline records replay and stream audits.
- Added T991~T998 and WP-AI15/16 runtime-contract checks. Verification: changed-module syntax, runtime contract, version contract, and Chromium offline headless `1059/1059 PASS`; live model replay/provider canary/red-team, multi-user isolation, deployment, and PUBLIC readiness remain unverified.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v52.84

## v52.83 (2026-07-14)
- WP-AI13/14 is `VERIFIED_LOCAL`: retrieval now indexes document/chunk/version/time metadata, quarantines poisoned/retracted/superseded material, measures recall/precision/source-tier/temporal quality, and blocks poisoned current-action use; the shared conduct boundary now exposes P0/legal-review/educational states.
- Added `AIO.indexAIRetrievalDocuments`, `AIO.evaluateAIRetrievalQuality`, `AIO.quarantineAIRetrievalDocument`, `AIO.getFinancialConductPolicy`, and `AIO.classifyFinancialConduct`; retrieval top-k excludes quarantined cards and actionable jurisdictional advice fails closed to legal review.
- Added T983~T990 and WP-AI13/14 runtime-contract checks. Verification: changed-module syntax, runtime contract, version contract, and Chromium offline headless `1051/1051 PASS`; live retrieval/model/red-team/legal certification, deployment, and PUBLIC readiness remain unverified.
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v52.83

## v52.82 (2026-07-14) — WP-AI11/12 conversation lifecycle and CalculationEvidence

WP-AI11/12 is `VERIFIED_LOCAL`: request envelopes now carry session/turn/route/entity ownership with explicit trim and stale-response audits; financial arithmetic is isolated in approved deterministic calculators that emit validated `CalculationEvidence` and never authorize model decision use.

- Added `AIO.createAIConversationState`, `AIO.beginAIConversationTurn`, `AIO.transitionAIConversationState`, `AIO.isCurrentAIResponse`, and `AIO.trimAIConversationContext`.
- Extended `_aioCreateAIRequestObject` and the shared response envelope with conversation ID, turn ID, route, entity, and conversation audit metadata.
- Added `AIO.registerApprovedCalculator`, `AIO.runApprovedCalculation`, `AIO.createCalculationEvidence`, `AIO.validateCalculationEvidence`, and `AIO.checkCalculationInvariant` with percent-change and portfolio-weight calculators.
- Added T977–T982 and WP-AI11/12 runtime-contract checks. Verification: changed-module syntax, runtime contract, and Chromium offline headless `1043/1043 PASS`; live multi-user race/model arithmetic certification and deployment remain unverified.

## v52.81 (2026-07-14) — WP-AI8/9/10 operations, benchmark, and feedback loop

WP-AI8/9/10 is `VERIFIED_LOCAL`: AI usage now exposes bounded latency/token/failure SLO samples and quota acquisition guards; a deterministic 12-case golden corpus plus A/B release gate prevents unsupported regressions/P0 release; and feedback samples retain request/model/prompt/evidence/validator metadata.

- Added `AIO.recordAISLOSample`, `AIO.getAISLOReport`, and `AIO.tryAcquireAIQuota`; live Claude usage records latency/tokens while existing API cost accounting remains available.
- Added `AIO.getAIGoldenCorpus`, `AIO.runAIGoldenBenchmark`, and `AIO.evaluateAIGoldenABGate` for deterministic safety/grounding release checks without claiming live model quality.
- Linked `AIO.createAIFeedbackSample` to stored thumbs-up/down feedback so triage retains the response manifest context.
- Added T972–T976 and WP-AI8/9/10 runtime-contract checks. Verification: changed-module syntax, runtime contract, and Chromium offline headless `1037/1037 PASS`; live provider SLO, model A/B quality, and deployment remain unverified.

## v52.80 (2026-07-14) — WP-AI6/7 automated publish and page context contracts

WP-AI6/7 is `VERIFIED_LOCAL`: translation, briefing, and server market-analysis outputs now expose a structured publish audit with deterministic evidence-summary fallback/source labels; the existing `AIO_PAGE_CONTRACTS` registry now projects required/optional/forbidden AI context contracts and beginner/expert modes across all 22 routes, including the `kr-technical` → `kr-tech` context alias.

- Added `AIO.validateAIAutomatedPublish`, `AIO.buildDeterministicEvidenceSummary`, and `AIO.getAIOutputSourceLabel`; automated outputs carry `publishAudit` through the common response envelope.
- Briefing requests include the typed claim contract and fail closed to deterministic fallback when the required structured envelope is missing; market-analysis metadata records its publish gate and `AIO.synthesizeMarketAnalysis` fallback.
- Added `AIO.getPageAIContract` and `AIO.auditPageAIContracts` as a projection of `AIO_PAGE_CONTRACTS`, with explicit route data requirements, optional axes, forbidden states, answer modes, and disabled-state disclosure.
- Added T967–T971 and WP-AI6/7 runtime-contract checks. Verification: changed-module syntax, runtime contract, and Chromium offline headless `1032/1032 PASS`; live model/content quality, live Pages/Worker certification, and deployment remain unverified.

## v52.79 (2026-07-14) — WP-AI4/5 external-data safety and financial action boundary

WP-AI4/5 is `VERIFIED_LOCAL`: external news/search/Telegram/translation inputs now use an explicit `UNTRUSTED DATA` boundary with hidden-Unicode/injection audit; portfolio AI uses a field allowlist, redacted preview, and session-only opt-in; chat history exposes 30-day/50-entry retention and off mode; and conduct, suitability, evidence/sourceKind, and probability checks run in the shared response pipeline.

- Added `AIO.sanitizeAIUntrustedText`, `AIO.buildAIUntrustedBlock`, `AIO.redactPortfolioForAI`, `AIO.getPortfolioAIPrivacyPreview`, and chat-history policy helpers.
- Wrapped per-page/unified news and web-search blocks; translation prompts now sanitize external titles/descriptions before model submission.
- Added `AIO.evaluateAIActionPermission` and carried `conductAudit` through `_aioRunAIResponsePipeline`; prohibited conduct, stale/missing/REFERENCE personalized action, missing suitability, and uncalibrated probability claims fail closed.
- Added T958–T966 and WP-AI4/5 runtime-contract checks. Verification: changed-module syntax, runtime contract, and Chromium offline headless `1027/1027 PASS`; live model quality, live Pages/Worker certification, and deployment remain unverified.

## v52.78 (2026-07-14) — WP-AI3 retrieval and context compression

WP-AI3 is `VERIFIED_LOCAL`: page/unified AI prompts now classify question intent, retrieve imported research by deterministic top-k ranking, keep all research `sourceKind=REFERENCE`, and compact that block under a declared 2K–6K token budget. Live/SNAPSHOT/verified evidence blocks remain separate and are not trimmed by this change.

- Added `AIO.classifyAIQueryIntent`, `AIO.retrieveImportedResearch`, `AIO.buildAIRetrievalContext`, and `AIO.compactAIContext` in `js/aio-core.js`.
- Added deterministic relevance/tie ordering, required-evidence contract recall, REFERENCE/asOf separation, P95 input-token measurement, and a stated ±10% token-estimation target.
- Bound both per-page and unified chat retrieval to the active query; the shared response envelope carries retrieval and context-budget audits.
- Added T950–T957 and WP-AI3 runtime-contract checks. Verification: changed-module syntax, runtime contract, and Chromium headless `1018/1018 PASS`; no full viewport/accessibility/deploy suite repeated for this medium-sized context-only change.

## v52.77 (2026-07-13)
- <!-- 변경 내용을 이곳에 기록하세요 -->
- R1 7곳 v52.77

## v52.77 (2026-07-13) — WP-AI2 typed claim/evidence

AI 감사 핸드오프의 WP-AI2 typed claim/evidence 계약을 공통 AI 응답 파이프라인에 연결했다.

- `js/aio-core.js`에 `wp-ai2.claim.v1` 스키마와 claim/evidence 정규화·검증을 추가했다. 현재성 주장에는 정확히 하나의 Evidence를 요구한다.
- F&G↔VIX, NFP 10배, bp↔%, 방향 부호, USD/KRW 역전, Evidence 누락을 fail-closed로 차단하고 중첩 claims JSON을 균형 괄호 파서로 추출한다.
- per-page/unified 초기·streaming·retry 응답이 동일 `_aioRunAIResponsePipeline`에 Evidence와 `claimAudit`를 전달한다. T941~T949와 WP-AI2 runtime contract를 추가했다.
- 검증: `node --check` 4개 파일, runtime/version contract, Chromium headless `1010/1010 PASS`; 상태 `VERIFIED_LOCAL`.

## v52.76 (2026-07-13)

AI 감사 WP-AI1을 로컬 구현했다. per-page/unified 채팅, 재시도, 자동 번역, 자동 브리핑이 동일한 요청 envelope와 응답 파이프라인을 사용한다.

- `_aioCreateAIRequestObject`가 entrypoint·requestId·attempt·pipeline/validator/block-policy 버전을 기록하고, `_aioRunAIResponsePipeline`이 기존 WP-AI0 action gate를 공통 응답 경계로 재사용한다. 원문 모델 텍스트는 audit manifest에 저장하지 않으며 최근 100건만 유지한다.
- per-page/unified 채팅 retry가 동일한 completion callback과 request object를 재사용한다. streaming/final/history/chips는 동일한 gated text를 기준으로 동작한다.
- 자동 번역과 자동 브리핑도 공통 파이프라인을 통과하며, 공통 파이프라인이 없거나 공개 action 정책에 걸리면 기존 무료 번역/결정론적 브리핑 fallback으로 fail-closed 한다.
- `CHAT_CONTEXTS.briefing`을 추가해 unified briefing route의 undefined context 경로를 제거했다.
- 회귀 계약 T937–T940 및 WP-AI1 runtime contract를 추가했다.
- 검증: `node --check` 변경 JS 3개, version/runtime/structural/data-pipeline/semantic contract 통과, Chromium headless `1001/1001 PASS`, critical10 `10 routes/consoleErrors 0`, accessibility `22 routes/consoleErrors 0`, portfolio vault `PFE2-01~08 PASS`, viewport `88/88·worstOverflow 0px·jsErrors 0`, boot `FCP 1504ms·route 96ms·maxLongTask 1119ms`.
- 상태: `VERIFIED_LOCAL`; GitHub Pages/Worker live 응답, 실제 모델 출력, 공개 배포는 미검증/미실행.

## v52.75 (2026-07-13)

AI 채팅 감사 핸드오프의 1순위 WP-AI0 + 데이터 WP-0을 로컬 구현했다.

- 공개 AI 표면을 `AI 베타 · 교육/리서치 보조`로 표시하고, 기준시각·Evidence 상태·원천/원문 재확인 안내를 공통 disclosure로 추가했다.
- 임베디드/통합 채팅의 스트리밍·완료·재시도 결과에 동일한 구체 매수·매도·비중·손절·목표가 action gate를 적용했다. 차단 전 원문은 assistant history/chips에 저장하지 않는다.
- `marketAnalysisOk` 생성 성공만으로 서버 LLM 문장을 공개하지 않도록 `marketAnalysisSemanticOk`/`status: verified` 명시 게이트를 추가하고, 미검증 문장은 deterministic synthesis로 폴백한다.
- 회귀 계약 T932–T936 및 CI runtime contract를 추가했다.
- 로컬 검증: `node --check` 3개 모듈 통과, runtime contract 통과, Chromium headless `997/997 PASS`.
- 핸드오프 packet 상태: `IMPLEMENTED_LOCAL`; 실제 배포/라이브 인증 및 WP-AI1 이후 단일 파이프라인 통합은 미검증/후속 범위다.

## v52.74 (2026-07-13)

첫 접속 직후 메뉴와 페이지 전환이 수 초간 멈추던 P689를 구조적으로 수정했다. 로딩창으로 시간을 가리는 방식이 아니라 일반 사용자 부팅에서 배포·공유 전수 감사를 제거하고, 활성 페이지 핵심 상태만 우선 반영하는 점진 부팅 경로로 분리했다.

- Public Status는 일반 런타임에서 활성 페이지의 materialized Evidence와 서버 데이터 메타만 사용한다. 22개 페이지/full-surface/배포 준비도 감사는 명시적 API·`aioAudit=1`·개발자 모드에서만 실행한다.
- 현재성 가드는 활성 페이지로 scope하고 DOM read/write를 배치했다. 라이브 시세 이벤트는 debounce하며 6초/18초 document 전체 재스캔을 제거했다.
- 비차단 부팅 상태 배너(`pointer-events:none`)를 추가했고 3초에 강제 해제한다. 홈 핵심 데이터 수신 후 즉시 완료할 수 있고 지연 데이터는 백그라운드 상태로 전환한다.
- 실제 Chromium 성능 게이트 `scripts/ci-boot-interaction-check.mjs`를 CI에 연결했다. 동일 로컬/offline 조건에서 수정 전→후: load 13.96초→2.46초, 최초 signal 전환 5.89초→92ms, 최대 long task 7.67초→1.11초, FCP 1.44초.
- `PERF-BOOT-01~05` 정적 계약, syntax/runtime/structural/headless 및 Chromium 성능 예산을 회귀 게이트로 보강했다.

## v52.73 (2026-07-13)

사용자가 재확인 질문("13개 페이지는 시안 그대로 이식한거지?")에 이어 직접 지적: v52.72에서 fundamental(3f)/market-news(4b)/screener(4c) 3개를 "이미 comp와 정합적"이라며 헤더/토큰 폴리싱만 하고 넘어간 것이 동일 패턴의 반복 실수였음(기존 구현이 더 정교하다는 것은 재구축을 건너뛸 이유가 아님). 3개 페이지 전부 실제 구조 재구축 + portfolio(4a) 잔여 구섹션 3개 통합 + macro(3d) 폴드 라벨 정확화.

- **fundamental(3f)**: 시안의 "기업개요 — 정성분석" 2열 섹션이 통째로 없었던 것을 발견 — 신규 `_renderFundQualitative()`(js/aio-ui.js)로 좌측에 FMP `profile.description`(실 데이터, escHtml 처리) + 섹터/경영진/상장 행, 우측에 52주 레인지·거래량·시가총액 막대-행(시안의 매출비중 막대와 동일 시각언어, 실제 보유 데이터로 채움 — 사업부문 매출비중처럼 없는 데이터는 날조하지 않음)을 신규 렌더. `_renderFundHeader()`를 시안 구조(회사명+티커/섹터/거래소 좌, 가격+등락 우 한 줄)로 축소하고 버튼/배지/시총은 보조 줄로 압축. 성장성·수익성 미니차트를 7차트 그리드에서 신규 개요 섹션으로 이전(재무상세엔 5차트 잔류). 시안에 없는 관심종목스캔·매크로리스크레이더·시장전체실적서프라이즈 3개 클러스터를 details로 압축.
- **market-news(4b)**: 카드 우측 요소를 topicBadge(카테고리)에서 시안의 `sentWord`(호재/부담/주의/중립)로 교체, 카테고리는 메타 줄로 이동.
- **screener(4c)**: `.scr-adv-col` CSS 클래스 + `_aioScreenerToggleColumns()` 토글(js/aio-data.js) 신규 — 기본 노출 컬럼을 시안 수준(~9개: 종목/추세신뢰도/VCP셋업/3M/RSI/현재가 등)으로 압축, "전체 컬럼 보기" 클릭 시 전체 노출(Playwright 확인: 기본 14개 헤더 → 토글 후 26개). 프리셋+KPI 행 압축, 시안의 "읽는 법 + 전략 백테스트" 하단 섹션 신규 추가.
- **portfolio(4a)**: 시안에 없는 AI 운용노트 / 백테스트 Lab / (관심종목 워치리스트+자동진단+VaR·상관계수 심화리스크, 묶어서 1개) — 3개 섹션을 `<details class="aio-page-advanced-toggle">`로 압축(R:R계산기는 이전 세션에서 이미 완료). 보유 종목 테이블 자체의 위치(시안은 히어로 바로 다음, 현재는 여러 섹션 뒤)는 이번 범위에서 재정렬하지 않음 — 토큰은 이미 정합적이라 재정렬로 인한 div-불균형 리스크 대비 우선순위 낮음으로 판단, 후속 세션 후보로 남김.
- **macro(3d)**: 재확인 결과 시안 범위 밖 6개 섹션(인터커넥션맵·경제사이클·FRED차트·유가에너지·시나리오트리·경제캘린더)이 이미 v52.70에서 details 1개로 폴드 완료돼 있었음(작업 트래커의 "미착수" 기록이 낡은 정보였음 — 코드 확인으로 자기 정정). summary 라벨이 폴드 안 6개 주제 중 3개만 언급하던 것을 전체 언급으로 정정 + 본문 없는 고아 섹션 주석("SECTION 7") 1건 제거.
- **검증**: `node --check` 전체(aio-ui.js/aio-chat.js/aio-data.js) 통과, 페이지별 div/details 균형 스크립트(fundamental 143/143·3/3, portfolio 182/182·4/4, macro 298/298·1/1) 통과, `ci-headless-tests` **992/992 PASS**, `ci-control-char-check`/`ci-structural-check`/`ci-ux-default-path-check`(전체 div 4202/4202) 전부 OK. fundamental은 Playwright로 합성 실데이터(NVDA 형태) 직접 호출해 `_renderFundHeader`/`_renderFundQualitative` 렌더 확인(오프라인 테스트 환경의 외부 API 차단 한계를 우회), market-news는 실검색으로 24개 카드의 sentWord/topicBadge 렌더 확인, screener는 컬럼 토글 전후 헤더 수(14→26) 확인. `ci-critical10-human-surface-check`(10라우트 PASS, 콘솔에러 0)/`ci-portfolio-vault-e2e`(PIN/암호화 8종 전부 PASS — portfolio details 폴드가 vault 흐름을 깨지 않음 확인)/`ci-accessibility-matrix-check`(22라우트 PASS, 콘솔에러 0) 전부 PASS.

## v52.72 (2026-07-13)

사용자 재확인 후 (a) 시안 comp-compliant로 잘못 기록됐던 6개 페이지(3e~4c) 실제 재검증 + (b) 착수 전 — fxbond(3e)·fundamental(3f)·themes(3g)·portfolio(4a)·market-news(4b)·screener(4c) 전체 재작업.

- **fxbond(3e)**: 완전 재구축 필요로 판명(구 CHANGELOG v52.64의 "comp-compliant" 기록은 부정확 — 실제로는 국기 이모지 카드+SECTION A-H 레거시 구조였음). 오늘의 브리핑/10Y·JPY 3개월 추이 신규 미니차트(`loadFxBondTrendCharts()`, fetchOHLCVWithFallback 재사용)/크로스에셋 4축(달러·10Y·엔·크레딧, 기존 cam-*/carry-jpy 재사용)/주요 통화쌍 6열/스프레드+크레딧·변동성(엔캐리 게이지 포함) 2열로 재구축. 구 8카드/국가별테이블 등은 details로 보존.
- **fundamental(3f)**: 이미 시안과 구조적으로 상당히 정합(3탭·4카드 하이라이트·성장성/수익성 차트가 이미 comp와 거의 일치) — 헤더/검색바만 시안 스타일로 재구축, 나머지는 가벼운 검증만.
- **themes(3g)**: RRG를 산점도 캔버스에서 시안의 4분면 텍스트 카드로 전환(`renderRRGQuadrantCards()` 신규, 기존 `calcLiveRS()`/`classifyRRG()` 재사용) — 기존 산점도는 details로 보존. 섹터 ETF 11열 등락 + 로테이션 해석 문단 신규.
- **portfolio(4a)**: 총자산가치 히어로(serif44, 시안 구조)로 헤더 재구축, 리스크분석(Sharpe/Beta/MDD/Drift) 카드를 시안 스타일로 재배치. AI 운용노트/백테스트Lab/R:R계산기 등 시안에 없는 고급 기능은 그대로 유지(코멘트로 명시).
- **market-news(4b)**: 센티먼트 스트립을 헤더로 이전 + 시안 스타일 재구축, 필터 유지. 뉴스 카드 제목 폰트 10px→13px(가독성).
- **screener(4c)**: 기존 멀티팩터 랭킹 시스템(트레이더 프로파일·팩터/레짐·백테스트IC 3탭)이 시안보다 훨씬 정교해 축소하지 않고 헤더만 시안 스타일로 재구축.
- **부수 발견(신규 버그 다수)**: `_aioRenderCarryUnwindRisk()`(엔캐리 게이지)·`applyTechIndicators` 유사 패턴의 하드코딩 구팔레트(`#ef4444` 등)를 아이보리 토큰으로 교체 + 이모지 제거. 뉴스 카드 렌더러(`sentColor`/티커뱃지/스코어바 3곳)의 동일 계열 하드코딩 hex도 교체. **자체 발견 버그 2건**: fxbond·portfolio 재구축 도중 구간 삭제 시 매칭되는 닫는 `</div>`를 함께 삭제해버려 페이지 전체 div 불균형이 발생 — `ci-ux-default-path-check.mjs`가 즉시 포착, depth-trace로 정확한 위치 특정 후 수정(P685/P686에서 확립한 방법론 재사용). portfolio 재구축 중 리스크분석 4카드(Sharpe/Beta/MDD/Drift) 섹션 자체를 실수로 통째로 누락했다가 헤드리스 테스트(T235)가 포착해 복구.
- **미해결로 남긴 발견**: `js/aio-core.js`에서만 하드코딩 구팔레트 hex(`#00e5a0`/`#ff5b50`/`#ffa31a`/`#ef4444` 등) 83건 확인 — 이번 세션에서 실제로 만진 함수 안의 것만 그때그때 수정했고, 전수 스윕은 범위 밖(별도 세션 필요, 시각적으로는 값이 현재 토큰과 우연히 일치해 당장 눈에 띄는 문제는 아님).
- **검증**: `node --check` 전체, inline script 11블록 개별 구문검사, `ci-structural-check`/`ci-ux-default-path-check`(div 균형 4191/4191)/`ci-runtime-contract-check`/`ci-data-pipeline-contract-check` PASS, `ci-headless-tests` **992/992 PASS**. fxbond/themes/portfolio/market-news는 Playwright 실브라우저로 실데이터 렌더 확인(fxbond 신규 미니차트만 오프라인 테스트 환경 한계로 미확인 — technical 페이지와 동일한 기지의 제약).

## v52.70 (2026-07-13)

signal(2a)·briefing(2b)·breadth(3a)·sentiment(3b)에 이어 technical(3c)·macro(3d) 구조 재구축 — 이로써 comp(`AIO 리디자인.dc.html`)의 13개 마킹 화면 중 아이보리 리디자인 대상 페이지 전체(1b/2a/2b/3a~3d, +기존에 이미 comp-compliant로 확인된 fxbond/fundamental/themes/portfolio/market-news/screener)를 이번 세션에서 일괄 커버 완료.

- **technical(3c)**: 헤더/건강도 히어로(serif54 점수+SPY·QQQ·VIX 바+M7 리더십)/4카드 지표(RSI·MACD·Stochastic·ADX)/심볼 셀렉터(SPY·QQQ pill+티커 입력)/캔들+Weinstein 2열/MTF 4열을 시안 구조로 재구축. **신규 네이티브 캔들 차트**(`loadTechCandleChart()`, kr-technical의 `loadKrCandleChart()` Chart.js bar-type 패턴을 MA5/10/20/50/200 5선으로 확장) — 기존 TradingView iframe 위젯을 details로 보존하며 1차 화면은 대체. 매물대(volume profile) 히스토그램은 신규 알고리즘이 필요해 범위 밖으로 명시 제외, 표준 시간축 거래량 바로 대체. Weinstein은 시안의 수직 리스트로 전환(`ws-stage1~4` id 유지), S/R는 차트 옆 목록으로 유지(`updateSRLevels()` 무변경).
  - **핵심 버그 발견+수정**: `updateTechIndicators()`가 `#tech-indicators-live` 컨테이너 전체를 `<table>`로 `innerHTML` 갈아끼우고 있어, 새 4카드 마크업이 페이지 진입 300ms 후 통째로 파괴되고 있었음(Stochastic/ADX id는 애초에 이 함수 대상이 아니었고, RSI/MACD만 캡션 텍스트까지 뒤섞여 렌더). 외과적으로 `tech-rsi-val`/`tech-macd-val` 두 셀만 갱신하도록 재작성해 `applyTechIndicators()`(Stochastic/ADX 담당, js/aio-data.js)와 공존하게 수정.
  - CSS var 알파-접미사 버그 3건 추가 발견+수정(`classifyMarketRegime()`에서 처음 발견한 것과 동일 계열): `updateWeinsteinStage()` 활성 단계 하이라이트, `updateMTF()` 타임프레임 카드, `updateSRLevels()`의 MA200 색상 하드코딩.
- **macro(3d)**: 헤더/오늘의 거시 브리핑(기존 `generateMacroStoryline()` 재사용)/WTI·Gold 2카드(serif32 가격+등락)/금리·환율 6열/인플레이션·고용 5열/수익률곡선+원자재·사이클 2열을 시안 구조로 재구축. 기존 `data-snap`/`data-live-price`/`data-live-chg` 파이프라인과 `renderYieldCurve()` 캔버스를 전부 그대로 재사용. 구 8카드 라이브 매크로 그리드·구 인플레이션 5카드 그리드·구 수익률곡선 분석기 섹션은 동일 id 재사용으로 인한 중복을 막기 위해 삭제(렌더러 함수 무변경) — 인터커넥션 맵/경제 사이클 타임라인/FRED 12개월 차트/추가 매크로지표/글로벌 경기 체온계는 details로 보존.
- **검증(시간 압박 하 축소)**: `node --check` 전체 통과, index.html 11개 inline `<script>` 블록 개별 구문 검사 통과, `ci-structural-check`/`ci-ux-default-path-check`(div 균형 4118/4118)/`ci-runtime-contract-check`/`ci-data-pipeline-contract-check`/`ci-semantic-review-check`/`ci-accessibility-matrix-check`(22라우트, 콘솔에러 0) 전부 PASS, `ci-headless-tests` **992/992 PASS**. technical(3c)만 Playwright 실브라우저로 추가 확인(건강도/SPY·QQQ·VIX/M7/마켓폭/RSI·MACD/Weinstein/MTF 전부 실데이터 반영, QQQ pill 클릭 시 차트·라벨 전환 확인). macro(3d)는 사용자 지시에 따라 실브라우저 스크린샷 단계 생략 — 자동 게이트만으로 검증.

## v52.68 (2026-07-13)

signal(2a)·briefing(2b)·breadth(3a)에 이어 sentiment(3b) 구조 재구축. breadth와 마찬가지로 시안 마커가 전혀 없어 전면 재구축 필요.

- **F&G 히어로 + VIX 기간구조 2열 재구축**: 시안 구조(380px 히어로 | 1fr 기간구조)로 전환 — F&G는 serif 44px 큰 숫자+등급, VIX 기간구조는 4칸 그리드(VIX9D/VIX/VIX3M/VIX6M) + 스파클라인 차트 + 판정 캡션. 기존 `fg-score-big`/`vix-term-summary`/`vix-term-regime-text`(`_aioRenderVixTermRegime` 대상) 등 id 전부 유지, DOM 형태만 그 함수가 기대하는 wrapper+`<strong>` 구조에 맞춰 재배치.
- **지표 행을 시안 4카드로 축소**: HY스프레드/AAII/Put-Call은 기존 캔버스 차트+값 혼합에서 값+해석 텍스트만 남기고 차트는 details로 이동. **SKEW 카드 신규 추가**(시안엔 있으나 라이브엔 없었음) — 기존 `data-snap="skew"`/`data-live-chg="^SKEW"` 범용 패턴 재사용이라 신규 JS 불필요.
- **details 2개로 폴드**: (1) VIX 전체 히스토리 차트 + NAAIM + Investors Intelligence 차트, (2) HY/AAII/Put-Call 히스토리 캔버스 + 뉴스 감성 추이 차트 전체 섹션.
- **복합 판단**: 시안 헤딩+해설문 구조로 `sent-analysis-text` 재배치(기존 위젯 박스에서 지면식으로 전환).
- **부수 정리**: `sentiment-conclusion-bar`가 새 복합판단 섹션과 중복 — signal-conclusion-bar와 동일 패턴으로 시각만 숨김. `vix-live-label`이 실제로 VIX 상태 라벨을 표시하는 살아있는 요소였음을 확인해(첫 시도에서 실수로 숨겼던 것을 재검토 중 발견) 캡션에 노출 유지.
- **검증**: 로컬 3종(구조/UX기본경로/JS구문) PASS + 헤드리스 992/992 PASS. Playwright 실브라우저 확인 — F&G 49, VIX9D 18.80(정적)/VIX 15.03(실시간)/VIX3M 19.90(정적)/VIX6M 20.40(정적) 정직 라벨링 확인, 복합판단 문단 실데이터 반영, 페이지 에러 0건.

## v52.67 (2026-07-13)

signal(2a)·briefing(2b)에 이어 breadth(3a) 구조 재구축. 이 페이지는 briefing과 달리 시안 재구축이 전혀 안 되어 있어(v52.6x 코멘트 마커 없음) signal과 동일한 전면 재구축이 필요했음.

- **헤더/SMA 3카드/종합진단 재구축**: 시안 3a 구조로 전환 — serif 27px 타이틀 + 상단 배지, 5·20·50일선 카드(serif 36px + 얇은 바 + 전일대비, 기존 박스형 mono 대형숫자에서 전환), 종합진단(헤딩 + 2열: 4행 리스트[상승/하락비율·RSP/SPY·Weinstein·McClellan] | 해설문, 기존 3열 미니그리드에서 전환). 기존 렌더러(`breadth-*-big`/`breadth-diag-signal`/`breadth-header-badge` 등, `_aioRenderBreadthConsensus` 포함) 전부 동일 id 재사용.
- **테스트 위치 제약 대응**: T800/T873이 `#breadth-diag-signal`의 존재+상위 4개 자식 이내 위치+consensus 렌더 연동을 요구 — 시안엔 이 요소가 없어(헤더 배지가 그 역할) 숨김 호환 셸(`#vis-breadth`, page-breadth의 4번째 자식)에 보존.
- **차트 2장으로 축소**: 시안은 SPY/QQQ 추세 + 50일선 비율 추이 2장만 노출 — 기존 4장(가격/5MA/20MA/50MA) 중 2장(가격, 50MA)만 상단에 유지하고 5MA/20MA는 details로 이동.
- **부가 콘텐츠 details 폴드**: McClellan/나스닥구성주/Weinstein 카드, A-D 비율 차트, 52주 신고가/신저가, 5·20일선 차트, KPI 스트립의 "데이터소스"/"시장국면" 카드 — 시안 범위 밖이라 `<details>` 1개로 접음(삭제 아님, 렌더러 무변경).
- **부수 발견·수정**: `updateBreadthUI()`가 하드코딩 네온 hex(`#00e5a0`/`#ffa31a`/`#ff5b50`, 구 다크테마 잔재로 P1/P2 스윕 누락)와 영문 라벨("BROAD RALLY"/"NEUTRAL"/"NARROW MARKET")을 쓰고 있던 것을 토큰+한국어로 교체.
- **검증**: 로컬 3종(구조/UX기본경로/JS구문 — 인라인 11블록 포함) PASS + 헤드리스 992/992 PASS(T800/T873 위치·기능 제약 포함). Playwright 실브라우저로 헤더/배지/SMA카드/종합진단 렌더 확인 — 실데이터(32%/38%/48%, "혼조 (모순 신호 존재)" 등) 정상 반영, 차트 캔버스 존재 확인.

## v52.66 (2026-07-13)

signal(2a)에 이어 briefing(2b) 재검증. 이 페이지는 v52.63에서 이미 시장분석/행동/오늘일정 섹션이 시안 구조로 실제 재구축돼 있어(P680류 미스와 달리 진짜 구현), signal처럼 전면 재구축은 불필요 — 스팟체크로 실행. 그 과정에서 발견한 실제 버그 6건 수정.

- **비-아이보리 색상 잔존(핸드오프 §8 명시 패턴)**: `_aioRenderBriefingDigest()`가 만드는 구버전 다이제스트 카드가 하드코딩 `rgba(0,212,255,...)` 시안 그라데이션/테두리를 그대로 쓰고 있었음(P1/P2 스윕 누락). 이 카드는 v52.63에서 신설된 상세 섹션(시장분석/행동/오늘의뉴스/오늘일정)과 콘텐츠가 완전 중복이기도 해 무채 톤 전환 + 시각만 숨김(DOM/계산은 유지, signal-conclusion-bar와 동일 패턴) 처리.
- **영문 국면 배지 3곳**: `_initBriefingPage()`가 `classifyMarketRegime()`의 영문 enum(`UPTREND` 등)을 그대로 배지 텍스트로 써 "UPTREND" 노출 — 헤더 배지(`briefing-regime-badge`)와 시장 스트립 배지(`briefing-regime-badge3`) 둘 다 한국어 라벨(`rg.label`, 예: "상승 추세")로 교체.
- **날짜 라인 영문 요일**: `_aioRenderBriefingDateLine()`이 `['Sun','Mon',...]` 영문 약어를 쓰고 있어 "(Mon)"으로 노출 — 한국어 요일 배열로 교체 + "24h briefing" → 시안 문구 "24시간 브리핑"으로 통일.
- **시장 스트립 KOSPI 누락**: 시안은 SCORE/SPY/QQQ/VIX/F&amp;G/KOSPI 6항목, 라이브는 KOSPI가 빠진 5항목이었음 — 기존 `data-live-price`/`data-live-chg` 패턴 그대로 재사용해 KOSPI 추가.
- **뉴스 설명에 내부 스코어링 디버그 문자열 노출(R204 위반)**: "오늘 시장을 움직인 것" 카드가 헤드라인 뒤에 `it.selectionReason`("base+20 | source-tier3+2 | recency+12 | ...", `scripts/fetch-data.mjs`가 뉴스 랭킹용으로 생성하는 감사 문자열)을 그대로 이어붙이고 있었음. 실사용자에게 절대 노출되면 안 되는 개발자 내부 필드가 폴백 체인에 섞여 있던 것 — `it.desc`/`it.summary`만 남기고 제거.
- **"오늘 일정" 섹션이 항상 빈 안내문**: `briefing-schedule-list` 렌더러가 `AIO_MACRO_CALENDAR.upcoming`/`window._upcomingMacroEvents`를 읽는데 이 두 참조 모두 코드베이스 어디에서도 채워진 적이 없는 죽은 참조였음(항상 undefined → 항상 "아래에서 확인하세요" 안내문 폴백). 브리핑 다이제스트가 이미 쓰고 있던 올바른 계산(`AIO_MACRO_CALENDAR.releases`를 순회해 `nextRelease` 7일 이내 항목 추출)으로 교체해 실제 일정(BLS CPI/BOK 금통위 등)이 표시되도록 수정.
- **범위**: briefing(2b) 헤더/시장스트립/시장분석/행동/일정 섹션. "오늘의 주요 뉴스" 리스트는 시안의 미니멀한 hairline 리스트와 달리 훨씬 상세한 카드 포맷(중요도 점수·시장의미·확인포인트 등)을 쓰는 v16 시절 레거시 렌더러(`renderBriefingFeed`, home 등과 공유)라 구조 불일치를 확인만 하고 재작성은 범위 밖으로 이관(다음 세션, 공유 함수라 영향범위 큼).
- **검증**: 로컬 8종 PASS + 헤드리스 992/992 PASS. Playwright 실브라우저로 헤더/시장스트립/시장분석/행동/일정 전 구간 스크린샷 확인 — 국면 배지 한국어 노출, KOSPI 추가, 디제스트 카드 숨김, selectionReason 미노출, 일정 실데이터(BLS CPI 07-14 등) 전부 확인.

## v52.65 (2026-07-13)

`_context/CLAUDE-CODE-HANDOFF.md`(사용자 제공 시안 핸드오프) + `AIO 리디자인.dc.html`(사용자 제공 코프) 기준, 어제 세션에서 시작한 아이보리 리디자인을 이어서 진행. P680(홈 히어로 구조 재구축, v52.64)과 정확히 같은 근본 원인 클래스를 signal(2a)에서 확인·해소.

- **page-signal(2a) 구조 전면 재구축(P681)**: 진입점은 `feedback_comp_is_foundation_not_existing_code` 메모리의 진단 그대로 — v52.62 전역 P1/P2 스윕이 색/폰트 토큰만 교체했을 뿐 실제 DOM을 시안 markup과 대조하지 않아, 시그널 페이지의 스코어/리스크모니터/체크리스트/국면진단 섹션이 여전히 리디자인 이전 구조(박스형 카드·모노스페이스 대형숫자·uppercase 영문 라벨)로 남아있었음. 헤더(serif 27px 타이틀+무채 필 모드토글) · 스코어 히어로(60px serif + 구분선 + 판단문 + 5팩터 인라인 미니바) · 5열 헤어라인 진입 체크리스트 · 6셀 카드형 리스크 모니터 · 국면진단+트레이딩원칙(상단→하단 이동, 2열 무테두리) · 텍스트형 연계분석 링크로 시안 구조에 맞춰 재구축. 기존 렌더러(`refreshSignalDashboard`/`updateEntryChecklist`/`updateRiskMonitor`/`classifyMarketRegime`)는 동일 element id를 그대로 재사용해 무변경으로 계속 구동. 시안에 없는 콘텐츠(시장 스냅샷 카드·점수 상세+실행윈도우·포트폴리오 배분·미너비니 4단계·시나리오 전망·Exit Triggers)는 삭제 대신 신규 `<details>` 2개로 접어 밀도 축소(핸드오프 §1 원칙).
- **부수 발견·수정 3건**: (1) T303 테스트가 v52.62에서 이미 `.pill-chip`→`.is-interactive`로 교체된 홈 chip 클래스를 갱신하지 않아 `chips=0`으로 거짓 실패 중이던 것을 수정. (2) `renderStaleWarning()`이 그리드 컨테이너 첫 자식으로 배지를 삽입하는데, 새 6열 고정 그리드에서 이게 7번째 셀이 되어 RSP/SPY가 줄바꿈되던 것을 배지에 `grid-column:1/-1` 부여로 해결. (3) `classifyMarketRegime()`가 배지에 영문 코드(UPTREND)를 tier색으로 채웠는데, `color.replace(')',',0.15)')`가 `var(--data-green)` 형태 문자열에는 CSS var() fallback 문법으로 해석돼 의도한 옅은 배경 대신 불투명 원색 배경이 되는 버그가 있었음 — 한국어 라벨+항상 무채 처리로 전환해 시안 일치와 버그 해소를 동시 달성.
- **검증**: 로컬 8종(구조/버전/런타임계약/데이터파이프라인/시맨틱리뷰/UX기본경로/JS구문 — index.html 인라인 스크립트 11블록 개별 포함) PASS + 헤드리스 992/992 PASS. Chrome 확장 미연결로 로컬 정적서버+Playwright로 실제 브라우저 렌더 확인(스코어/판단문/체크리스트/리스크모니터/국면 실데이터 반영, 모드토글 클릭 동작, `<details>` 4개 전부 아코디언 동작 확인).
- **범위**: signal(2a) 1개 페이지만. 나머지 미검증 페이지(breadth/sentiment/briefing/technical/macro — v52.64 CHANGELOG 기준 fxbond/fundamental/themes/portfolio/market-news/screener 6개는 이미 별도 검증 완료로 기록되어 있음)는 후속 세션 과제로 남음. 배포/커밋 없음(로컬 작업트리 변경만).

## v52.64 (2026-07-12) - 아이보리 리디자인 전 페이지 확장 완료

시안 12개 화면(fxbond/fundamental/themes/portfolio/market-news/screener 포함) 전수 대조 + 나머지 비-시안 페이지(한국장 5개·테마상세·티커·옵션·설명서) 검증까지 완료.

- **페이지별 대조 결과**: fxbond/fundamental/themes/portfolio/market-news/screener 6개 페이지 모두 이미 시안 수준 이상으로 구현되어 있었음을 확인(예: 스크리너는 시안의 단순 프리셋 UI보다 훨씬 정교한 투자스타일 프로파일+3탭+고급필터+포지션사이저 보유, 기업분석은 시안이 요구한 개요/재무상세/외부정보 3탭 구조가 이미 정확히 일치, 테마는 시안의 정적 카드 대신 실제 인터랙티브 RRG 캔버스 차트 보유). 구조 재작성 대신 각 페이지에서 발견된 색상 버그만 수정.
- **무지개 게이지 2건 추가 발견·단색화**: 환율채권 페이지의 엔캐리 언와인드 위험도 바(green→amber→red 그라데이션 트랙 → JS가 실제 위험도에 따라 단일색 채움으로 전환) + HY 스프레드 정적 데코 바.
- **TradingView 위젯 라이트 테마 전환**: `theme=dark`·`toolbarbg=131722` 하드코딩을 `theme=light`·`toolbarbg=f7f4ee`로 교체 — 기업분석/차트기술분석 페이지에서 위젯이 로드될 때 더 이상 아이보리 페이지 안에 어두운 사각형으로 튀지 않음. (참고: 완전한 네이티브 캔들+거래량프로파일 전환은 신규 데이터 파이프라인이 필요한 별도 규모 작업으로 범위 밖 유지 — kr-technical 전환 시 사용한 `loadKrCandleChart()`를 템플릿으로 향후 진행 가능)
- **색상 감사 3~4차 라운드**: 이전 스윕이 놓친 shorthand 소수점 표기(`rgba(255,255,255,.06)`처럼 `0.` 대신 `.`만 쓴 패턴)를 전수 검색해 7건 + 장식성 청록 계열 5건 추가 수정. 전체 파일 재검사 결과 잔여 비-아이보리 색상 0건 확인.
- **이모지 잔존 발견·수정**: AI 채팅 피드백 버튼(👍/👎)이 이전 두 차례 스윕에서 누락되어 있었음 — 텍스트 라벨("도움됨"/"부정확")로 교체.
- **접근성 버그 추가 발견**: 포트폴리오 보유 테이블의 수정/삭제 버튼에 이전 이모지 제거 스크립트가 남긴 고아 variation-selector 문자(U+FE0F, 시각적으로 빈 버튼)가 있었음 — 텍스트 라벨로 교체.
- **게이트**: 로컬 9종 PASS + 헤드리스 992/992 PASS + viewport-matrix/human-surface/portfolio-vault/a11y-matrix 확인(세션 로그 참조).
- R1 7곳 v52.64

## v52.63 (2026-07-12) - 아이보리 리디자인 시안 대조 2차: 실제 comp HTML 기반 정밀화

사용자가 실제 디자인 comp 파일(`AIO 리디자인.dc.html`, 13개 화면: 1a-c/2a-b/3a-g/4a-c)을 제공 — v52.62의 텍스트 스펙 기반 작업을 comp의 정확한 구조·타이포·수치와 재대조.

- **사이드바 확인**: comp가 요구하는 종합(5)/시장분석(5)/내투자(2)/한국시장(5)/도구(3) 카테고리 구조가 이미 라이브에 정확히 일치함을 확인(별도 작업 불필요) — 리디자인 이전부터 존재하던 인프라.
- **전역 타이포그래피**: `.page-title`을 22개 페이지 공통으로 세리프(Noto Serif KR) 27px 600으로 전환(comp 전 화면 공통 패턴) — 기존 `!important` 오버라이드 2곳까지 함께 수정하지 않으면 무효였음.
- **page-briefing 신규 섹션 3개 구축**(2b 시안 기반, 기존에는 라벨 정리만 되어 있었음): "시장 분석"(리드 문단+"오늘 시장을 움직인 것" 이벤트연결 카드+2×2 서브섹션), "행동"(기존 미사용 상태였던 `AIO_ACTION_RULES.getActionPlan()` 유틸 재발견해 연결), "오늘 일정". 데이터는 `_ldSafe()`/`DATA_SNAPSHOT`/뉴스 상위 스코어 재사용, 조건 분기 기반 한국어 문장 조립(완전한 서술 생성은 범위 밖, 정직하게 문서화).
- **2차 하드코딩 색상 스윕**: 1차 스윕이 놓친 저빈도 색상 106건 추가 발견·수정(다크 배경 채움 24건, 시맨틱 green/red 27건, 장식성 잉크 수렴 55건) — TradingView placeholder 배경(#131722) 등.
- **레드 테두리 버그 수정**: 시장폭/거시경제/차트기술분석 페이지에서 중립 카드에 잘못 적용된 하드코딩 빨간 테두리(`rgba(177,58,48,...)`) 다수 발견·수정 — 배경은 중립인데 테두리만 경고색인 불일치 패턴.
- **부수 발견(pre-existing 버그)**: page-breadth의 `breadth-diag-text` span과 인접 `<b>` 태그가 굽은 따옴표(smart quotes, ”)로 감싸여 있어 `style`/`id` 속성이 깨져 있었음(`document.getElementById('breadth-diag-text')`가 매칭 실패) — 직선 따옴표로 수정. 이번 세션 리디자인과 무관한 기존 결함, 작업 중 우연히 발견.
- **동시성**: 별도 Codex 세션이 세션 중간에도 자체 Stop-hook WIP 커밋을 4회 발생시켜(`_artifacts/*` 테스트 산출물 + `debug.log`만 포함, 소스 변경 없음) 로컬 히스토리에 잡음이 섞였음 — `git reset --soft`로 해당 4개 커밋을 되돌리고 실제 소스 변경만 재커밋. `_context/INDEX.md`·`INSTITUTIONAL-DATA-READINESS-HANDOFF-2026-07-12.md`(그 세션의 별도 산출물)는 이번 커밋에서 명시적으로 제외.
- **범위 밖(정직히 기록)**: fxbond/fundamental/themes/portfolio/market-news/screener 6개 페이지는 comp의 페이지별 신규 와이어프레임(신규 탭 시스템, 벤치마크 비교 차트, RRG 4분면 재배치, 검색+리포트 헤더 재구성 등)까지는 미착수 — 전역 색상/타이포 스윕의 혜택만 받은 상태. page-technical의 TradingView iframe → 캔들+거래량프로파일 전환(comp 3c)도 미착수(kr-technical에서 이미 수행한 것과 동급 규모의 별도 엔지니어링). 후속 세션 이관.
- **게이트**: 로컬 9종 PASS + 헤드리스 992/992 PASS + viewport-matrix/human-surface/portfolio-vault/a11y-matrix 확인(세션 로그 참조).
- R1 7곳 v52.63

## v52.62 (2026-07-12) - 아이보리 리디자인 P1~P2 전체 + P3~P10 부분 적용

`C:\Users\zmfhd\Downloads\CLAUDE-CODE-HANDOFF.md`(시안 1b/2a/2b 기반) 순차 실행. 전체 재작성 없이 기존 변수명·구조 유지한 부분 패치.

- **P1(완료) — 토큰+폰트**: `:root` 전체(배경/테두리/텍스트/데이터팔레트/accent/shadow/차트/radius)를 다크 네이비→웜 아이보리로 교체. 색은 무채(잉크/페이퍼)+상승green(#22754c)+하락red(#b13a30) 2계열만 허용, cyan/magenta/purple/amber는 잉크로 수렴. Inter+JetBrains Mono → Pretendard Variable+Noto Serif KR 교체, tabular-nums 유틸 확장. 다크모드는 `body.light-theme`(구 라이트 토글, 실질 미작동 상태였음)를 `body.dark-theme`로 롤네임해 그래파이트 무채 팔레트로 재정의(JS `toggleTheme()`/복원 IIFE 동시 수정) — 기본값이 아이보리가 되며 토글 의미가 반전되므로 필요했던 변경.
  - **P1 확장 발견**: `:root` 1개만 바꿔선 반영 안 됨 — line 4462 부근에 "v51.43 visual hierarchy refresh"라는 **두 번째 `:root{...!important}` 오버라이드 블록**이 소스 순서상 항상 이겨 거의 모든 핵심 토큰(bg/border/text/accent/shadow)을 다크 네이비로 재고정하고 있었음(사이드바/톱바/컨텐츠 배경 하드코딩 포함). 이 블록도 함께 아이보리 값으로 갱신하지 않으면 P1 자체가 시각적으로 무효였음. 추가로 2703행의 더 오래된 "v4 Override" `:root!important` 블록(소스 순서상 이미 죽어있던 코드)도 혼란 방지 위해 제거.
- **P2(완료) — 컴포넌트+전역 색상 정리**: badge/status-pill/pill-chip/quality-meter/aio-btn-table(ghost·primary)/aio-card-primary/CP1~8 리스크 셀/사이드바 nav-item active 등 §4 규칙 적용. 전역 하드코딩 색 스윕: rgba 트리플 945건 + hex 190건(cyan/amber/purple/magenta/violet→잉크, green/red 계열→아이보리 green/red로 재매핑) + 잔여 white-alpha 124건(다크테마 블록 제외)을 자동화 스크립트로 치환. 이모지/픽토그램 221건 제거(방향 화살표 ↑↓→, 메뉴 ☰, 새로고침 ↻ 등 기능성 글리프는 접근성 이유로 보존 — VIX ▲/▼ up/down 색각 이상 대체 표시 포함). Chart.js 툴팁 3곳(브리핑/포트폴리오/기타) 다크 배경 잔존 수정. "무지개 quality meter" 2건 발견해 단색으로 평탄화(고정 배너 그라데이션, 매크로 페이지 "글로벌 경기 체온계" 온도계 — 5색 그라데이션 트랙 제거 + JS 동적 fill 색상도 3계열로 수렴).
  - **P2 부수 발견 버그(P678/R309)**: 이모지 일괄 제거 스크립트가 JS 문자열 리터럴 내부의 `(cond ? '✓' : '✗')` 형태 조건 마커까지 무차별 제거해, "바닥 확인 체크리스트"(매크로 페이지) 스코어링이 실제 조건과 무관하게 항상 "5/5 충족"을 반환하는 실사용 버그를 유발할 뻔했음 — 발견 즉시 텍스트 마커("통과"/"미충족")로 복원. 매매 시그널 페이지 `.ec-icon` 상태 아이콘도 동일 원인으로 텍스트 라벨 복원.
- **P3(완료) — page-home**: `home-market-heatmap`+`bloomberg-global-overview`(GLOBAL MARKETS 테이블)를 `<details>` "부가 지표"로 접어 1차 화면 밀도 축소. "GLOBAL MARKETS"/"EXPAND" 등 잔여 영문 대문자 라벨 → 한국어.
- **P4(부분) — page-signal**: 8-포인트 리스크 히트맵(CP1~8)을 `<details>` "고급"으로 접음. 숨김 DOM(테스트/렌더러 호환 셸)은 무변경. 전체 섹션 재배열(①스코어 히어로~⑤연계분석 순서 재구성)은 CLAUDE.md가 명시 경고하는 히든 DOM/테스트 의존도(T226/T816/T820 등) 리스크로 이번 세션 범위 밖 — 후속 세션 이관.
- **P5(부분) — page-briefing**: 정적 헤더/시장스트립/뉴스/과거참고 영역의 잔여 영문 라벨·하드코딩 색 정리(전역 스윕으로 자동 반영). §5가 요구하는 "시장 분석 심층 2×2 그리드 + 행동 카드 + 오늘 일정" 신규 섹션은 `#briefing-digest` 계열 JS 렌더러(`_aioRenderBriefing*`)의 출력 템플릿을 새로 설계해야 하는 별도 규모의 작업으로 판단 — 이번 세션 범위 밖, 후속 세션 이관.
- **P6~P10(전역 스윕만 반영, 페이지별 신규 레이아웃 미착수)**: breadth/sentiment/technical/macro/fxbond/fundamental/portfolio/news/screener — F&G SVG 게이지는 토큰 교체만으로 이미 무채+red+green 3계열로 자동 수렴 확인(추가 작업 불필요). 나머지 페이지의 §5 신규 와이어프레임(포트폴리오 보유종목 미니차트+S/R 주석, 캔들차트 volume profile, 3개월 기본 차트 범위 등)은 차트 렌더링 JS 로직을 직접 새로 작성해야 하는 항목이라 범위 밖 — 후속 세션 이관.
- **동시성 메모**: 이번 세션 작업 중 별도 Codex 세션이 동일 저장소에 `feat: close live portfolio and provenance slices`(c71587c) 등을 병행 커밋 — index.html 겹치는 라인 없음(버전 캐시버스터·포트폴리오 스토리지 어댑터 영역만 겹쳤으나 무충돌) 확인 후 진행.
- **게이트**: 로컬 9종 전체 PASS(syntax·version·control-char·worker-anthropic·structural·ux-default-path·runtime-contract·data-pipeline·semantic-review·workflow-compaction·skill-contract·stray-file) + 헤드리스 **992/992 PASS** + `AIO_VIEWPORT_FULL_INIT=1` viewport-matrix/human-surface/portfolio-vault/a11y-matrix 확인(상세는 세션 로그 참조).
- R1 7곳 v52.62

## v52.60 (2026-07-12) - fallback freshness contract

- **T830 freshness regression fix**: fallback/reference `DATA_SNAPSHOT` dates are no longer incorrectly required to match a separately refreshed Telegram digest. T830 now enforces chronological ordering for fallback state and close parity only for promoted snapshots; added P677/R308/QA coverage.
- **Verification**: local `992/992 PASS`; CI run `29164541698` passed validate, headless, FULL_INIT viewport, accessibility, Critical-10, Portfolio Vault, and Pages deploy; live invariant and Data Watchdog run `29173397491` also passed. Worker live response and human browser gates remain external.

## v52.61 이하 — 압축 이력 (2026-07-18 통합)

> v52.61 이하의 버전별 상세 이력은 **git 히스토리**(이 파일의 2026-07-18 이전 리비전) 참조.
> 버그 계보는 `_context/BUG-POSTMORTEM.md` 압축 원장, 검증 이력은 `_context/QA-CHECKLIST.md` §6과 대응한다.

- **v52.5~v52.61 (2026-07-04~12)**: FABLE 라이브 전수 감사 P0~P6(P602~P641) · UI/UX 심층 감사 V0~V4(P642~P649) · EF 실효성 감사 Batch 1~4(P655~P658) · Codex 종합 진단 WO-0~8(P659~P669, main 보호·프록시 강화·Vault 통합·mojibake 복구·10년 백테스트 음의 상관 실측) · H2 2차 게이트/워커 403 완화(P670대) · 접근성/뷰포트 게이트 상설화
- **v52.0~v52.4 (2026-07-03~04)**: Phase 3 완료 — 코어 모듈 defer 전환·스코어 알고리즘 aio-core 이관(바이트 불변 증명)·telegram-digest 46% 감량·computeTradingScore 검증 하네스·Pages deploy 재시도
- **v51.84~v51.99 (2026-07-01~03)**: OneDrive .git 파손 복구·서버/클라 RSI 방법론 불일치·팩터 부호/스케일 정밀화·헤드리스 스위트 CI job 상설화·30분 데이터 커밋 CI 트리거 연결
- **v51.30~v51.83 (2026-06-24~07-01)**: 전면 감사 R244~R262 — Telegram XSS·score parity·CI-gated deploy·FRED silent fail·기본 경로 UX 정리·Minervini 기술 엔진·백테스트 Lab·공개 준비도 표면
- **v50.55~v51.08 (2026-06-14~24)**: 페이지 계약·KST 정합·AI 채팅 통합 답변 파이프라인·Telegram digest 자동 소비 루프·데이터 파이프라인 계약 게이트(R222)·한국어 뉴스 rewrite
- **v50.0~v50.54 (2026-06-04~14)**: 21페이지 evidence 계약 + 배포 게이트 기반(R200~R205) · 뉴스/텍스트/캘린더 계약 · cross-page 모순 스윕(P482~P499)
- **v49.x (2026-05~06)**: AI 채팅 심층 보강(환각 HARD STOP·silent fail 정직화·CHAT_CONTEXTS 매트릭스) · 근본수정 registry 시대(THRESHOLD/SCORE_SCALES/ACTION_RULES) · fundamental 15기준 · cell-level 전수 검증
- **v31~v48.x (2026-03~05)**: 초기 구축 — 단일 HTML 터미널·뉴스 엔진·테마/RRG·포트폴리오·PWA·모듈화(aio-*.js 분리)·onclick 전수 제거·SRI

### v50.89 - semantic review and workflow compaction gate (2026-06-19) — CI 마커 보존용 원문 유지

- **Structural fix**: Added P513/R219 so audit functions, shape checks, coverage percentages, and sidebar rows can no longer stand in for semantic review.
- **New CI gate**: Added `scripts/ci-semantic-review-check.mjs` to inventory audit/readiness definitions and shape/coverage-style tests, then require R219/P513 governance hooks and direct high-risk semantic gates.
- **Runtime contract link**: Extended `scripts/ci-runtime-contract-check.mjs` so runtime/share-readiness work must keep the semantic review gate documented and runnable.
- **Workflow compaction direction**: Captured the next structural requirement: helper files and skills must be compressed, retired, or split into references instead of continuously appending long SKILL.md/checklist blocks.
- **QA loop**: Added P513-Q1..Q6 to require function -> consumer -> visible output checks for trading, AI, data/source, UX, and page redesign work.
