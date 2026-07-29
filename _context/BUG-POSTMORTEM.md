---
verified_by: agent (Claude Sonnet 5) + Codex P761-P844 static implementation record
last_verified: 2026-07-27
confidence: high
latest_version: v53.58
latest_P_number: P852
next_P_number: P853
current_total_entries: 598 (P1~P837, 결번 존재 — 상세 + 압축 원장)
current_checkpoint: P852 unified ResearchPlan/evidence/session/provenance boundary closure; migration and live/provider certification remain separate operator/runtime checks
p795_entry: "Theme-detail selected-theme versus ETF/composite-base comparison now renders in #theme-detail-native-benchmark from normalized theme and benchmark quote evidence; the legacy benchmark section is fenced while theme insights stay legacy. ESM, architecture, and Chromium gates pass; local v53.30 remains uncommitted and undeployed."
p821_entry: "Home Quality now has a native fail-closed meter/score/label and the legacy Trading Score-as-Quality writer is removed because it did not implement the documented five-input model. Architecture contract and Chromium gates pass."
p822_entry: "Technical candle title/meta now come from normalized analysis input with a waiting fallback; the legacy chart retains canvas/indicator lifecycle but no longer writes those sinks. Architecture contract and Chromium gates pass."
p823_entry: "The remaining legacy theme-detail deep-analysis comparison now filters non-finite constituent percentages before comparison/formatting, and the retirement manifest is synchronized with the 17/17 native renderer ledger. Runtime and retirement contracts pass."
p824_entry: "The shared currentness sanitizer now skips native renderer-owned narrative sinks; no-live theme/carry regression tests accept the current Korean fail-closed states without allowing fabricated scores. Headless passes 1102/1102."
p825_entry: "Theme-detail keeps one summary aria-live region and removes redundant live announcements from eight subordinate native panels. UX, accessibility, and viewport gates pass."
p826_entry: "The architecture compatibility facade now replays derived theme-detail navigation through the canonical themes route, preventing the inline native detail mount from being disposed during FULL_INIT viewport traversal. Full local release verification passes, including architecture/browser and FULL_INIT 68/68."
total_entries: 593 (P1~P833, 결번 존재 — 상세 + 압축 원장)
# 2026-07-18 통합/압축: P703 이하 전 엔트리를 압축 원장(한 줄)·시대 블록으로 축약. 각 엔트리의 원문 전문(motivation/root_cause/fix/prevention/verification)은 git 히스토리(이 파일의 2026-07-18 이전 리비전)에서 열람.
# P725 = v53.7 KR 5페이지 통합(기능 작업, CHANGELOG 기록 — 버그 아님). P617~P619/P650/P670/P710/P723 등 일부 번호는 결번 또는 비버그 작업.
---

## P852 - v53.58 - unified chat and legacy evidence paths could bypass the typed research/session boundary

- **motivation**: the deep audit found that the unified chat still used a legacy web-search heuristic, both surfaces read a mutable global question plan after asynchronous preparation, and quote/snapshot provenance was dropped before compatibility and sentiment consumers evaluated freshness.
- **symptom/reproduction**: concurrent page/unified requests could bind the later plan to the earlier request; `005930.KS 오늘 어때?` was planned as a US session; an unknown session with only `observedAt` passed the response gate; a rejected first Research sub-query shifted the second query's `queryId`; FRED URLs were classified as secondary; snapshot `observedAt`/`marketState`/`venue` fields disappeared in `_liveData`; mobile controls and the GitHub Issues link were below the 24px target contract.
- **root_cause**: orchestration, research execution, response gating, storage provenance, and accessibility measurement were represented by parallel compatibility paths rather than one request-bound contract. Missing observation time was also treated as “now” by the sentiment adapter.
- **fix**: unified and per-page chat now pass an immutable `questionPlan` through the request envelope, execute the same ResearchPlan adapter, and call one source-floor gate for external/native citations before current/causal output. Market detection resolves KR aliases/indices and uses a typed runtime session schedule; unknown/unverified sessions fail closed. `_aioSetLiveData`/`PriceStore`/compatibility/sentiment preserve observation/fetch/session/venue/previous-close provenance without stamping missing values. Research partial results retain original indexes, FRED `.org` is official, and snippet depth is per result. Mobile target sizing is enforced and small targets block the accessibility matrix.
- **violated_rule**: R395/R396/R401/R402; current or causal claims must not bypass ResearchDecision/Plan, MarketSessionEvidence, or typed source evidence, and data lineage must not be inferred from ingestion time.
- **prevention**: executable AI-intelligence checks cover KR session resolution, explicit request-plan binding, shared research gate wiring, partial-result index preservation, FRED classification, provenance persistence, and missing-observation handling; accessibility CI treats any small target as a failure. Keep architecture migration explicitly `MIGRATION_IN_PROGRESS` until remaining native data/chart/narrative ownership is transferred and independently gated.
- **verification**: run the complete static, ESM, browser, route, accessibility, data-lineage, version, and live-invariant suite after the patch and after deployment. Provider keys, Worker health/quota/origin, rights review, 30-day SLO, fast-plane soak, and real-model quality remain operator/runtime gates.

## P851 - v53.57 - chat quote evidence was not normalized to the typed claim contract

- **motivation**: users saw the typed claim safety message for ordinary current quote questions even when the chat freshness preflight had a valid quote row.
- **symptom/reproduction**: the response pipeline received `after.quoteRows` with `price`, `source`, and `asOf`, while the typed validator compared `evidence.value`, `unit`, `scale`, and the exact evidence id. A model claim could therefore be valid in meaning but fail with an evidence/unit mismatch.
- **root_cause**: the freshness producer and claim validator used different evidence field names, and the prompt did not expose the exact evidence registry needed for the model to bind its claim.
- **fix**: added the shared `normalizeAIChatEvidenceRow` adapter, wired it into both freshness/evidence producers, injected one typed evidence registry into per-page and unified prompts, and preserved fail-closed handling for blocked/stale/mismatched evidence.
- **violated_rule**: R396/R402; current numeric claims remain typed and evidence-bound, but valid chat quote rows must reach the validator in the same schema.
- **prevention**: T950 verifies normalized quote rows pass a valid current claim; T951 verifies the prompt registry; T952 verifies blocked rows remain blocked.
- **verification**: `node --check` passed for core/data/chat/tests; version, structural, runtime, AI intelligence, AI reliability, and headless browser gates passed; headless result is `1105/1105 PASS`. Live provider/model output, Worker health, quota, origin, and external rights remain operator/runtime checks.

## P850 - v53.56 - Web Research and market-session readiness were conflated with provider/data presence

- **motivation**: the Web Research/data handoff required current and causal questions to be evidence-bound even when provider keys, Worker health, quotas, or source rights were unavailable.
- **symptom/reproduction**: search necessity was coupled to provider availability; multi-query results were flattened; native HTTP 200 tool errors could look successful; public market artifacts exposed `UNKNOWN` sessions; durable data rows could be mistaken for current evidence.
- **root_cause**: question policy, provider capability, source evidence, and market-session state had no single typed boundary, so a present value or configured route could be over-read as research readiness.
- **fix**: added `ResearchDecision`, `ResearchPlan`, `EvidenceDocument`/`EvidenceChunk`, and `ResearchCapability`; wired the plan into chat; preserved sub-query/source metadata; promoted native tool failures; made current claims fail closed; derived explicit market-session states; and added the 22-category data refresh audit plus session fixtures.
- **violated_rule**: R401; current/causal claims require the decision's source floors and runtime capability, while closed/delayed data must remain explicitly bounded.
- **prevention**: keep requirement decisions key-independent, keep capability readiness separate, reject snippet-only current evidence, include plan/session boundaries in search cache keys, and fail CI on published `UNKNOWN` sessions or structural data-audit failures.
- **verification**: research, AI intelligence, market snapshot, data refresh, data pipeline, runtime, and touched-module syntax contracts pass locally; live provider keys, Worker health, quota, origin, rights, and post-deploy browser checks remain operator/runtime gates.

## P849 - v53.55 - domain analysis, benchmark, and operations contracts lacked executable boundaries

- **motivation**: the intelligence rebuild requires deterministic domain calculations and explicit gates before live model/Worker certification.
- **symptom/reproduction**: sector, company, technical, macro/FX, benchmark, and operations concerns had no typed executable contract in `src/ai`.
- **root_cause**: the first AIQ-0~3 boundary stopped before domain analysis and external evaluation/operations interfaces.
- **fix**: added evidence-bounded domain engines, a registry, reproducible benchmark manifest/corpus scoring, and an operator-required canary/feedback/drift/rollback control plane.
- **violated_rule**: no domain conclusion or model-quality claim may be emitted without supplied evidence and pinned evaluation inputs.
- **prevention**: `scripts/ci-ai-intelligence-contract-check.mjs` covers AIQ-4 fixtures and explicit benchmark/operator gates; live model/Worker certification remains unchecked until external fixtures exist.
- **verification**: changed-module syntax, AI intelligence, architecture, release manifest, and release revision contracts pass locally.

## P848 - v53.55 - AI chat intelligence path bypassed typed planning and research ranking was presented as confirmation

- **motivation**: the intelligence rebuild audit found that the ESM AI contracts were not the entrypoint owner, current-sensitive questions had no typed market-session plan, and free-form model text plus post-processing could bypass the intended evidence/policy boundary.
- **symptom/reproduction**: per-page and unified chat entered the legacy prompt/provider path directly; `CONFIRMED` was emitted from a relative rank threshold; screener prompt time used browser generation time; uncalibrated scenario percentages were requested even when no calibrated model was connected.
- **root_cause**: planning, capability selection, claim validation, and renderer policy were represented by parallel contracts rather than one executable orchestration boundary.
- **fix**: added `QuestionPlan`, intent/entity/session resolution, capability planning, EvidenceGraph/causal attribution, strict `AnswerPlan/ClaimLedger` parsing/validation, deterministic rendering, guarded orchestration adapters for both chat surfaces, fail-closed current-sensitive numeric output, producer-observed screener time, and `RESEARCH_CANDIDATE` with explicit research-only use.
- **violated_rule**: current-sensitive AI output must be evidence-bound and a research-relative ranking must never be promoted into a verified recommendation.
- **prevention**: `scripts/ci-ai-intelligence-contract-check.mjs` covers seven representative questions, session unknown/open states, uncalibrated probabilities, temporal/cross-asset causal evidence, orchestrator dispatch, verdict vocabulary, and producer observation time; CI runs it in the ESM validation stage.
- **verification**: changed-module syntax, ESM unit, AI intelligence contract, AI chat reliability, inference, runtime, structural, and architecture contracts pass locally. Live provider/model-quality and post-deploy browser certification remain separate follow-up gates.

## P847 - v53.54 - server market analysis trusted untyped semantic metadata and source lineage was incomplete

- **motivation**: direct API/source/pipeline audit found that current-sensitive market prose could be treated as verified from `semanticStatus`/metadata alone, while the generated prompt read `x.price` even though the quote producer emits `regularMarketPrice`.
- **symptom/reproduction**: the deployed artifact contained `VIX 39(Fear&Greed)` and a non-informative `oneLine`, with no metric identity/value/unit/asOf/source evidence. News rows also lacked explicit content depth/event time/independence metadata, and screener validation did not report mixed revisions or field-level fundamental lineage.
- **root_cause**: producer, artifact, and browser publish gates did not share a typed evidence contract; source tier and observation lineage were partly implicit and the LLM context used a stale field name.
- **fix**: added typed market-analysis evidence construction/validation, VIX-vs-Fear&Greed and numeric/scale/causal gates, fail-closed client publication, news lineage fields, screener mixed-revision/field-coverage checks, and corrected the prompt to use `regularMarketPrice`.
- **violated_rule**: current-sensitive automated prose must be evidence-bound; source tier, content depth, event time, and artifact revision must be explicit before downstream use.
- **prevention**: CI contracts assert producer/browser/validator alignment; public artifacts without typed evidence are explicitly blocked-unverified rather than silently rendered.
- **verification**: targeted contract and syntax checks plus full local release verification are required after this patch. Real provider keys, Worker health/quota/origin, external rights, and low-spec performance remain operator-gated.

## P846 - v53.54 - deferred core compatibility exports shadowed Claude key save and route functions

- **motivation**: the deployed v53.53 site reported API-key storage/readback failure and then routed AI chat to the shared Worker even after a personal key was entered.
- **symptom/reproduction**: with the deployed script order, `js/aio-core.js` ran after the inline Claude chat block. Its `window.getApiKey(name)` replaced the Claude no-argument getter, and its `window.setApiKey(name, value)` replaced the one-argument async saver. Chromium reproduced a key physically present in `localStorage` while `saveSidebarApiKey()` received no `{ ok }` result and `getApiKey()` returned empty.
- **root_cause**: two independently named global compatibility APIs had incompatible arity and return contracts; the v53.53 `defer` ordering made the collision deterministic after page load.
- **fix**: `js/aio-core.js` now overloads the legacy exports: no-argument `getApiKey()` resolves `aio_claude_api_key`, one-argument `setApiKey(key)` delegates to `_aioSaveCredential()` and returns its Promise/readback result, while explicit provider-key calls retain their prior behavior. The AI reliability contract now guards both overloads.
- **violated_rule**: R389 credential persistence must be readback-proven; R390 route readiness must not confuse an available personal key with a missing shared Worker route.
- **prevention**: any global compatibility export that shares a name with an inline or module entrypoint must document and test its arity/return contract; adding or changing `defer`/script order requires a browser save-and-route smoke test.
- **verification**: local static server + Chromium after a fresh context: `saveSidebarApiKey()` returned `READY_PLAINTEXT`, localStorage write/readback matched, no-argument and explicit key getters matched, UI masking applied, and `_aioClaudeTarget()` selected the personal API route. AI reliability, data/pipeline, lineage, market snapshot, reconciliation, operations, semantic, static-data, inference, history-field, release-revision, and version contracts passed. Live real-key/Worker/provider-rights checks remain operator-gated.

## P845 - v53.53 - early compatibility-facade navigation could read lexical prevPage before initialization

- **motivation**: remote browser gates exposed a race in which native compatibility-facade navigation could run before the legacy script initialized its `let prevPage` binding.
- **symptom/reproduction**: Critical-10, Portfolio Vault, and all-route accessibility runs failed with `ReferenceError: Cannot access 'prevPage' before initialization` from `showPage()`.
- **root_cause**: `showPage()` and `showTicker()` directly read/write a top-level lexical shim while the ESM compatibility facade can invoke them during legacy script initialization.
- **fix**: route transitions now read the initialized `AIO.state`/window shim and write through the safe window state path, avoiding the TDZ while preserving the existing compatibility API.
- **violated_rule**: R392 requires legacy compatibility entrypoints to remain safe during module/classic-script initialization races.
- **prevention**: early route calls must not directly touch top-level lexical state whose declaration has not completed; the browser route gates remain the executable regression contract.
- **verification**: local static contracts passed `30/30`; Chromium gates passed headless `1102/1102`, viewport `68/68`, accessibility `17/17`, Critical-10 (`10` routes, `0` console errors), Portfolio Vault `PFE2-01~09`, boot interaction, architecture browser, vertical slices (`10/10`), route soak (`17 routes × 3 laps`, entity AAPL→MSFT→AAPL, browserErrors `0`), SA-02, SA-03, and SA-04. Remote CI `30266668940` passed validate, headless, viewport, human-surface, portfolio, accessibility, and Pages deployment; public `version.json` serves `v53.53`. Live provider/Worker, real-key, rights, golden-accuracy, and low-spec performance checks remain operator-gated.

## P844 - v53.52 - AI credential persistence, route readiness, and control-plane states were optimistic or conflated

- **motivation**: the handoff requires AI chat to be usable only when a real route is ready, credential persistence is proven, and scheduled analysis is not mistaken for public chat capability.
- **symptom/reproduction**: the UI could say an API key was saved before `safeLS` completed or was read back; Claude and extension keys used different storage paths; BOK/KOSIS were omitted from restore/backup inventory; the public site had no default Worker route or readiness probe; Worker quota reservations were not rolled back after failed upstream requests; operations status did not separate secret configuration, workflow wiring, last success, freshness, and licensing.
- **root_cause**: storage, authentication, connection, data freshness, and rights were represented as one optimistic “saved/available” path, while the public AI route and scheduled data plane had no shared explicit control-plane contract.
- **fix**: added the provider credential registry and readback-based `_aioSaveCredential` path, explicit storage states and provider status UI, BOK/KOSIS registry/restore/export coverage, public non-secret AI config, route readiness/error classification, Worker `/health`, effective token-cap header, quota rollback, operations readiness fields, performance targets/measurements, and `ci-ai-chat-reliability-contract-check.mjs` wired into CI.
- **violated_rule**: R389 requires one credential registry with write/readback proof and no optimistic/plaintext fallback; R390 requires explicit AI route readiness/error states; R391 requires scheduled analysis and public chat plus five operational readiness dimensions to remain separate.
- **prevention**: future credential or AI route changes must update the registry, UI status, public config/Worker health contract, operations-status artifact, and the CI reliability contract together. Real keys, Worker secrets, provider rights, and low-spec performance must remain explicitly unverified until an authorized operator run closes them.
- **verification**: local browser, provider calls, public Worker, golden corpus, and performance re-run were **not run per urgent user instruction**. The repository contains the executable static CI contract, but this turn does not claim that its remote run, live route, or model accuracy passed.

## P843 - v53.51 - route soak, operational posture, and public readiness lacked executable repository gates

- **motivation**: the masterplan requires repeated 17-route use, visual state coverage, revision invariants, SLO targets, action pinning, security headers, and an explicit beta/public decision rather than a short static CI success.
- **symptom/reproduction**: route traversal and public readiness were documented separately; workflow dependencies used mutable action tags/install semantics; no single local contract reconciled the visual-state matrix, SLO posture, security-header artifact, and public readiness decision.
- **root_cause**: operational acceptance criteria were prose-only and live/operator conditions were not explicitly separated from deterministic repository evidence.
- **fix**: added the 17-route three-lap route soak with AAPL→MSFT→AAPL entity re-entry, route/canvas/error evidence, visual-state/SLO/readiness manifests, SHA-pinned Actions, `npm ci` workflow installs, compatible `_headers`, and conservative operator-gated public-beta criteria.
- **violated_rule**: R386 requires repeated route/resource behavior to be a blocking executable gate; R387 requires operational/public claims to be revisioned, source-labelled, and explicit about operator-only certification.
- **prevention**: future public-readiness changes must update the manifests and contract script together; live headers, provider rights, 30-day SLO, and deployed revision must remain operator-required until observed from the live edge.
- **verification**: `ci-operations-contract-check.mjs` passes with 6 workflows/25 SHA-pinned actions, 17 routes, 5 states, and v53.51 revision coherence. `ci-route-soak-check.mjs` passes 17 routes × 3 laps with browserErrors 0, max canvas count 42 unchanged, and AAPL→MSFT→AAPL. Final browser boundary passes headless `1102/1102`, boot, architecture/browser `17/17`, vertical-slice browser `10/10`, viewport `68/68`, Critical-10, Vault PFE2-01~09, accessibility `17/17`, and SA-02/SA-03. The initial local snapshot made SA-04 operator-required; after the remote data refresh, SA-04 passes in CI run `30260095694`, and the public URL serves v53.51. Live edge/header enforcement, provider rights, and 30-day SLO remain operator-required.

## P842 - v53.51 - Guide copy and capability claims lacked one executable content boundary

- **motivation**: the masterplan requires “real-time”, AI, translation, RRG, Stage, sentiment, macro-causality, and action wording to match actual capability and evidence scope.
- **symptom/reproduction**: Guide and metadata language could imply live/current/automatic/AI-backed behavior beyond the source-aware runtime contract, and no machine-readable claim inventory could prevent regression.
- **root_cause**: capability status and wording constraints were distributed across prose without a versioned manifest or DOM-level audit.
- **fix**: added `wave4.capability.v1`, nine capability records with allowed wording/forbidden claims, Guide claim markers/audit, source-aware educational copy, action-checklist wording, and strict referrer metadata.
- **violated_rule**: R388 requires capability claims to be manifest-backed and to fail closed when wording exceeds the available evidence or implementation.
- **prevention**: future Guide/metadata claim changes must add a manifest row or use an existing status/mode and pass the static fixture plus Guide browser audit.
- **verification**: syntax, capability contract, architecture contract, and architecture/browser Guide assertions pass; nine capability rows and nine Guide markers audit as `pass`.

## P841 - v53.50 - ten planned page slices lacked one executable route/data/state boundary

- **motivation**: the masterplan sequences the 17 routes into ten vertical slices, but lifecycle markers, required producer intent, page completeness states, and leave/re-entry evidence were not represented by one executable contract.
- **symptom/reproduction**: route modules had native renderer markers and the legacy `AIO_PAGE_CONTRACTS` had producer requirements, but a reviewer could not verify the planned slice pairing, direct surface, blocked-network state, mobile controls, and re-entry behavior from one gate.
- **root_cause**: slice sequencing was documented in the plan only; router scopes and page completeness were not linked to that sequence.
- **fix**: added `src/app/vertical-slices.js`, exposed slice lookup/audit through `AIO_ARCH`, mounted route-scoped slice/order/required-data/state markers, and added static plus Chromium gates covering all ten slices under external-network outage conditions.
- **violated_rule**: R385 requires each vertical slice to have one lifecycle/data/renderer/chart/narrative acceptance contract and an executable route boundary.
- **prevention**: future route work must extend the registry and its acceptance gate before declaring a slice complete; route owners must remain native lifecycle-owned and page completeness must stay in the canonical contract path.
- **verification**: Wave 3 boundary verification passes for the full static workflow, headless `1102/1102`, boot interaction, architecture/browser 17-route with `browserErrors 0`, vertical-slice browser `10/10`, SA-02, SA-03, viewport `68/68`, Critical-10, Vault PFE2-01~09, and accessibility `17/17`. SA-04 remains operator-required because the checked-in public snapshot reports `fredHasKey:false` / `fredFetchOk:false`, so the FRED/HY success branch cannot be exercised locally. No commit or deployment was performed.

## P840 - v53.49 - stale SEC facts, entity-free ticker actions, and unversioned Vault ciphertext needed explicit boundaries

## P840 - v53.49 - stale SEC facts, entity-free ticker actions, and unversioned Vault ciphertext needed explicit boundaries

- **motivation**: the remediation plan requires dated SEC facts to disclose freshness, ticker narratives to require entity evidence before producing action language, and Vault ciphertext to support a stronger KDF without abandoning existing user data.
- **symptom/reproduction**: SEC reports with metrics were always labelled `current` even when the filing was historical; the ticker decision map could produce WATCH/action wording without a selected quote or market-health result; and the Vault envelope had no version marker, so future KDF changes had no safe migration path.
- **root_cause**: report availability, evidence freshness, narrative gating, and encryption compatibility were represented as implicit flags rather than versioned contracts.
- **fix**: added `sec-report.v2` current/aged/historical/unknown freshness with fail-closed decision eligibility, added a ticker entity/quote/market-health action gate, and added a v2 Vault envelope using PBKDF2-SHA256/310000 with legacy 100000-iteration decrypt plus safeLS re-encryption migration.
- **violated_rule**: R381 evidence purpose/freshness separation, R383 action narratives require entity evidence, and R384 versioned KDF migration must preserve legacy decrypt while writing only the current envelope.
- **prevention**: SEC fixtures must include recent and historical observations; ticker action tests must cover missing entity/quote/health; every future Vault envelope must carry an explicit version marker and a legacy migration fixture.
- **verification**: targeted syntax, ESM, runtime-contract, architecture-contract, and portfolio Vault Chromium checks pass; PFE2-09 proves a legacy encrypted key is decrypted and re-encrypted with the v2 header. Wave 1·2 full verification also passes headless 1102/1102, architecture/browser 17-route with browserErrors 0, FULL_INIT 68/68, Critical-10, Vault PFE2-01~09, accessibility, and SA-02/SA-03. SA-04 remains operator-required because the public snapshot reports `fredHasKey:false` and `fredFetchOk:false`.

## P839 - v53.48 - route transitions and chart/key resources could outlive their owning surface

## P839 - v53.48 - route transitions and chart/key resources could outlive their owning surface

- **motivation**: the structural remediation requires route/entity transitions to invalidate stale async work, Chart.js instances to have one bounded owner, and API-key storage to avoid an automatic plaintext IndexedDB mirror.
- **symptom/reproduction**: same-route ticker changes could reuse a mount without an entity identity, in-flight entity/screener results had no route-scope signal, chart registries were local unbounded Maps, and `_aioAutoBackupKeys` stored raw key snapshots in `aio-keys-backup`.
- **root_cause**: lifecycle scope, chart ownership, and sensitive-key backup policy were represented by separate ad-hoc paths without a shared disposal/retirement contract.
- **fix**: added abortable route scopes with `mountId`, normalized `entityId`, `isCurrent`, and disposal; passed scope signals through entity/screener providers and orchestrators; added a bounded chart registry with replacement/disposal/canvas-height ownership; retired IndexedDB open/read/write/recovery for API keys, deleted the legacy database, removed its UI entrypoint, and retained explicit JSON export/import.
- **violated_rule**: R382 requires route-owned async/chart resources to stop at scope disposal and forbids automatic plaintext API-key persistence outside the encrypted Vault or explicit user export.
- **prevention**: route modules must receive and honor `scope`, async providers must pass `signal` and guard `isCurrent`, Chart.js instances must register with the route registry, and storage contracts must statically reject the retired IDB mirror patterns.
- **verification**: W2 static contracts, syntax, headless 1102/1102, architecture/browser 17-route, FULL_INIT viewport 68/68, Critical-10, Vault PFE2-01~08, accessibility 17/17, and SA-02/SA-03 all pass. SA-04 remains operator-required because the checked-in public snapshot reports `fredHasKey:false` and `fredFetchOk:false`.

## P838 - v53.47 - reference evidence could enter Trading Score through mixed allowedUse paths

- **motivation**: the structural remediation requires reference material to remain visible for research while preventing it from contributing to live decision scores.
- **symptom/reproduction**: legacy boolean and descriptive `allowedUse` values could travel through compatibility paths without one canonical interpretation; a reference-only momentum input could therefore remain numerically present while the Trading Score model treated the row as usable.
- **root_cause**: evidence status and purpose were not enforced at a single selector boundary, and the score model accepted raw values without a decision-purpose completeness gate.
- **fix**: added fail-closed `normalizeAllowedUse`, purpose-specific display/decision/last-known selectors and completeness reporting, routed compatibility and core score inputs through decision evidence, and blocked the composite score when decision coverage is below the 80% threshold.
- **violated_rule**: R381 requires decision models to consume only normalized, fresh decision evidence and to preserve reference values outside the decision path.
- **prevention**: all new decision consumers must call `selectForDecision` or an equivalent contract, retain `allowedUse` in evidence rows, and add a fixture proving that reference-only values remain displayable but cannot affect the decision output.
- **verification**: all W1 static contracts, headless 1102/1102, architecture/browser 17-route, FULL_INIT viewport 68/68, Critical-10, Vault PFE2-01~08, accessibility 17/17, and SA-02/SA-03 gates pass. SA-04 remains operator-required because the checked-in public snapshot reports `fredHasKey:false` and `fredFetchOk:false`; no W1 code path caused that precondition failure.

## P837 - v53.46 - deploy smoke treated a freshly deployed empty KV as a Worker failure

- **motivation**: the KV-only Worker must be deployable before its first five-minute scheduled publisher run, while malformed or partial responses must remain blocking.
- **symptom/reproduction**: `Deploy fast data plane` successfully uploaded `aio-screener-data-plane`, then immediately called `/health`; propagation returned 404 and the initial empty KV state returned 503, causing the job to fail even though the deployment was live.
- **root_cause**: the smoke step required an immediate HTTP 200 with complete coverage and had no propagation retry or explicit bootstrap state.
- **fix**: added bounded endpoint propagation retries, retained hard failure for unreachable/non-200/503 responses, and accepted only the explicit `{ok:false, heartbeat:null, revision:null}` bootstrap state with an `operator_required` warning.
- **violated_rule**: R380 deploy smoke must distinguish unavailable initialization from malformed or partial runtime evidence.
- **verification**: the deployed Worker URL returned 503 with the expected empty-KV bootstrap payload after propagation; the full browser/test suite was intentionally not rerun per operator request.

## P836 - v53.45 - SEC refresh repeatedly retried failures and starved untried candidates

- **motivation**: the requested data refresh had to expand SEC coverage rather than repeatedly spending each batch on the same unavailable filings.
- **symptom/reproduction**: batch refreshes plateaued at 464/655 because failed symbols remained ahead of never-attempted symbols in the due queue; repeated runs produced no new coverage.
- **root_cause**: target selection treated all due candidates equally and did not persist a failure cooldown or prioritize candidates with no prior attempt.
- **fix**: added persisted failure timestamps, a 24-hour retry cooldown, never-failed-first ordering, and the explicit `SEC_RETRY_FAILED=1` override for deliberate manual retries. Regenerated the SEC artifact and screener output with 539/655 stored coverage.
- **violated_rule**: R379 data refresh must rotate eligible candidates and preserve unavailable states instead of fabricating values.
- **verification**: refresh output recorded 539/655 (82.3%) SEC source coverage and 539/725 (74.3%) screener display coverage; full browser/test verification was intentionally not rerun per operator instruction.

## P832 - v53.41 - fundamental page had only a summary line while the official SEC report boundary remained implicit

- **motivation**: the route ledger treated the fundamental page as native for status and one summary line, but the official SEC annual-fact identity, filing metadata, coverage, and core metric values were still only implicit in the legacy report flow.
- **symptom/reproduction**: browsing to `fundamental` could show a SEC status/summary while the visible report container remained dependent on legacy multi-source generation. Missing SEC fields had no dedicated native report state or provenance boundary.
- **root_cause**: normalized entity fundamentals preserved the raw SEC record, but no pure report projection or dedicated native child surface owned its presentation. The broad report mixed official SEC facts with FMP/Yahoo/news/chart/AI inputs.
- **fix**: added `sec-report.v2`, a finite-safe official-SEC projection for filing identity, period/submission metadata, coverage, observed metrics, and current/aged/historical freshness; rendered it with DOM-safe native nodes and explicit source/operational-use metadata. Peer/news/external sections, charts, and AI narrative remain separately legacy-owned.
- **violated_rule**: R352 single executable owner and R306 typed provenance for official regulator evidence.
- **prevention**: architecture contract/browser gates require the SEC model/version and native report markers; missing facts render as waiting/unavailable and never as inferred values.
- **verification**: JS syntax, SEC report model fixture, and architecture contract pass; browser/full release QA remain pending for the final code sequence.

## P835 - v53.44 - supplied market materials needed reusable chart, behavior, and communication protocols

- **motivation**: the prior integration preserved the framework, time series, and visual observations, but chart technique, response behavior, and answer delivery were implicit rather than reusable contracts.
- **symptom/reproduction**: a context could discuss capex, memory P, neocloud Q/capital, and breadth without consistently walking through trend/structure/retest/participation or closing with confirmation, invalidation, and next observation.
- **root_cause**: the material extraction had Q1-Q5 and invalidation fields but no explicit chart-reading protocol, behavior state machine, or communication contract.
- **fix**: added `chartReadingProtocol`, `behaviorPlaybook` (`wait`/`probe`/`hold`/`protect`), and `communicationContract` to `AIO_AI_INFRA_CYCLE_REFERENCE`, chat injection, the research digest, and the Knowledge Base. The playbook remains non-automated and user-controlled.
- **violated_rule**: R26 knowledge feedback, R219 semantic review, and the current-evidence/reference separation contract.
- **prevention**: future material integrations must convert visual technique and action logic into source-labelled, fail-closed reusable fields without promoting supplied values to live evidence.
- **verification**: syntax/runtime checks were intentionally not rerun because the operator requested commit/deploy only; version synchronization and deployment follow-up remain separate.

## P834 - v53.43 - supplied AI infrastructure materials needed a durable framework without contaminating live evidence

- **motivation**: the user supplied a market-analysis text, competing Google capex theses, memory/neocloud framework, Korea/US index notes, external links, and eight chart images and requested structured integration including time-series context.
- **symptom/reproduction**: the existing app had tactical and research-digest plumbing, but no single Q1-Q5 framework for capex timing versus reinvestment risk or for memory P versus neocloud Q/capital; raw reference figures could be mistaken for current evidence if copied into live prompts.
- **root_cause**: reference extraction, ticker memo compatibility, keyword detection, and current runtime evidence were not connected under one source-labelled contract for this material packet.
- **fix**: added `AIO_AI_INFRA_CYCLE_REFERENCE` and `_aioAIInfraCycleContext()` to the chat context path, dated reference memos for seven affected tickers, new macro/technical keywords, a digest item containing the supplied time series and eight visual observations, and a knowledge-base section. Runtime comparison reads only source-aware injected values and fails closed when absent.
- **violated_rule**: R26 knowledge feedback, R135 memo freshness, R219 semantic review, and the current-evidence/reference separation contract.
- **prevention**: future integrations must preserve `sourceKind=REFERENCE`, `asOf`, source URLs/files, visual observations, Q1-Q5 extraction, and an executable contract check; no supplied figure or chart level may enter `DATA_SNAPSHOT` as a live decision input.
- **verification**: JS/JSON syntax, runtime contract, diff check, knowledge-lint, static/data/runtime pipeline, headless 1102/1102, architecture 17-route/browserErrors 0, viewport 68/68, accessibility 17/17, critical-10 10/10, portfolio Vault PFE2-01~08, boot, and SA-02~04 pass locally for v53.43; X content and Worker live health remain explicitly unverified from this environment.

## P833 - v53.42 - fast quote deployment required an R2 subscription although KV is sufficient for the current snapshot path

- **motivation**: the operator declined R2 card registration and requested the fast quote plane to run on the Cloudflare Free/KV path.
- **symptom/reproduction**: `Deploy fast data plane` failed closed when `AIO_QUOTES_R2_BUCKET` was absent, even though the Worker reads/writes `quotes:current` and `quotes:heartbeat` in KV and its R2 operations were optional at runtime.
- **root_cause**: the deployment template and preflight treated the optional R2 durability layer as mandatory, creating an unnecessary billing/setup gate.
- **fix**: removed the R2 binding and R2 writes/fallback from the KV-only Worker, reduced the deploy preflight to `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `AIO_QUOTES_KV_ID`, and strengthened the data-plane contract to reject R2 reintroduction in this packet.
- **prevention**: keep primary KV availability, heartbeat/LKG retention, and the explicit `AIO_FAST_QUOTES_URL` smoke check as blocking contracts; add R2 only through a separately approved durability packet.
- **verification**: KV-only contract with runtime `/health` fixture, Worker syntax, workflow YAML/control-character parse, version/release/operations contracts, full headless 1102/1102, architecture browser 17-route with browserErrors 0, viewport 68/68, accessibility 17/17, critical10 10/10, Vault PFE2-01~08, boot, and SA-02~04 pass locally. Live Worker deploy, `/health` smoke, provider rights, and seven-day soak remain operator-required.

## P831 - v53.40 - portfolio summary/allocation had no single deterministic owner after Vault/table cutover

- **motivation**: P830 transferred the Vault-backed holdings table, but the portfolio summary, cash, VIX exposure, and sector allocation still had independent inline writers. The remaining surface was therefore vulnerable to last-writer drift and continued to show legacy zero placeholders when canonical values were unavailable.
- **symptom/reproduction**: `src/ui/pages/portfolio.js` owned the table while `updatePortfolioSummary()` and both position-donut paths in `index.html` continued writing the same summary/allocation ids. A portfolio with no live quote could be rendered as `0`/`0.0%` instead of an explicit unavailable state.
- **root_cause**: portfolio state normalization did not preserve daily quote percentage/sector evidence, the compatibility fallback did not expose cash, and no pure model owned the cross-card derivation. The P830 table fence did not cover the adjacent summary surface.
- **fix**: added `portfolio-surface.v1` as a finite-safe domain model; preserved daily percentage, sector, cash, and total fields through normalization/facade; added native DOM-safe rendering for holding count, P/L/day, cash, VIX exposure, and sector allocation; and fenced the corresponding legacy summary/sector writers. Risk cards, charts, AI workbench, and narrative remain explicitly legacy-owned until their own inputs and writer boundaries are reconciled.
- **violated_rule**: R352 single executable owner and R357 bounded native surface with an explicit legacy writer fence.
- **prevention**: architecture contract requires the model, native markers, and compatibility fences; Chromium requires the portfolio surface marker/model version plus native holding-count, sector, and exposure markers. Missing values remain `—`/waiting rather than fabricated zeroes.
- **verification**: JS syntax and portfolio model checks pass so far; architecture contract/browser and full release QA remain pending until the remaining code packets are complete.

## 문서 관리 원칙

- **P번호 단조 증가** — `next_P_number`부터 사용, 재사용 금지. 기능 작업은 CHANGELOG에만 기록(버그 아님).
- **필수 필드**: motivation / symptom·reproduction / root_cause / fix / violated_rule / prevention / verification.
- **3회 반복 클래스는 RULES.md 승격** (R25). 아래 "반복 버그 클래스" 표에서 재발 횟수를 추적한다.
- **압축 원장 항목의 상세**: git 히스토리 참조 (`git log --oneline -- _context/BUG-POSTMORTEM.md` → 2026-07-18 이전 리비전).
- 코드 확인 없이 추측으로 원인을 단정하지 않는다. "고쳤다" 선언은 브라우저/게이트 증거가 있어야 한다.

## P781 - v53.18 - route별 소유권과 요약 counts가 서로 다른 renderer 진척을 보고했다

- **motivation**: 아키텍처 중간 점검에서 route 17개의 실제 `rendererOwner`를 재계산해 핸드오프·운영 상태·CI 회계의 신뢰도를 확인했다.
- **symptom/reproduction**: `architecture/route-owners.json.routes`는 renderer native 13/17이었지만 같은 파일의 `counts.rendererNative`와 native/legacy 목록은 이전 10/17 상태에 머물렀다.
- **root_cause**: route 선언과 요약 counts/list를 사람이 각각 갱신했고, CI가 각 route에서 요약값을 독립 재계산하지 않았다.
- **fix**: counts/list를 현재 route 선언 순서로 동기화하고, architecture contract가 lifecycle/renderer/data/chart/narrative와 full-native 목록을 route에서 재계산해 수·구성·순서 드리프트를 blocking하도록 했다.
- **violated_rule**: R352의 실행 소유권 실측 원칙.
- **prevention**: route별 선언만 편집하고 모든 파생 요약은 CI 재계산값과 정확히 일치해야 한다.
- **verification**: architecture contract PASS(17 routes, renderer 13/17), operations status contract PASS, syntax/diff checks PASS.

## P782 - v53.18 - 새 서비스워커 활성화 뒤에도 최초 controller 버전이 화면에 고정됐다

- **motivation**: 라이브에서 앱 v53.17과 SW v53.7 불일치 경고가 장시간 유지된 원인을 캐시·등록·controller 전환 경로로 분리 진단했다.
- **symptom/reproduction**: `sw.js`는 이미 `skipWaiting()`/`clients.claim()`을 실행하지만 클라이언트는 부팅 중 현재 controller에 `GET_VERSION`을 한 번만 보내고, 이후 `controllerchange`를 관찰하지 않았다.
- **root_cause**: 실제 활성화 전환과 진단값 재조회가 분리됐고, 등록 로그도 “다음 새로고침”이라고 실제 동작과 다르게 설명했다.
- **fix**: `controllerchange`에서 SW 버전·mismatch 상태를 초기화하고 재조회하며, 등록에 `updateViaCache:'none'`/`reg.update()`를 적용하고 전환 로그를 실제 activate/claim 계약에 맞췄다.
- **violated_rule**: R5/R47의 버전·캐시 일치와 관측 가능성 원칙.
- **prevention**: 설치 버전이 아니라 현재 controller 응답만 표시하며 controller 교체를 회귀 계약으로 고정한다.
- **verification**: JS syntax, runtime contract, version contract, Chromium boot/architecture checks PASS.

## P785 - v53.20 - 기술 페이지 시장 건강도 1차 표면이 native state/renderer와 레거시 writer 경계를 갖지 못했다

- **motivation**: ARX-11 순차 전환에서 `technical` route의 가장 먼저 검증 가능한 시장 건강도 표면을 native state/renderer로 넘기고, 이후 signal toy mapping과 섞이지 않는 bounded packet을 닫는다.
- **symptom/reproduction**: `src/ui/pages/analysis.js`는 analysis 상태 마커만 기록했고, `index.html`의 `computeMarketHealth()`와 `js/aio-core.js` 초기화가 같은 기술 건강도 DOM을 직접 작성했다. 계산/상태/렌더 owner가 분리되지 않아 native 전환 시 last-writer-wins 회귀 가능성이 있었다.
- **root_cause**: 시장 건강도 계산식이 inline legacy 함수에만 존재했고, compatibility facade가 technical snapshot에 health projection을 제공하지 않았으며, native route에는 primary surface writer fence가 없었다.
- **fix**: 순수 `src/domain/market/health.js`(`market-health.v1`)를 단일 계산 owner로 추출하고 facade/bootstrap/normalize 경로에 배선했다. `analysis.js`가 11개 health primary sink를 fail-closed로 렌더하며, legacy inline/core writer는 `data-aio-technical-renderer="native"` 펜스 아래에서 동작하지 않는다. 촛대/RSI/MACD/Weinstein/MTF/내러티브는 legacy secondary로 유지했다.
- **violated_rule**: R352 단일 실행 소유권·실측 renderer ownership 원칙과 R357 native bounded-surface writer fence 원칙.
- **prevention**: 순수 model version/threshold unit gate, architecture contract의 model/fence marker, Chromium 11/11 native sink 및 `NATIVE-FENCE` 직접 회귀 assertion을 CI에 고정한다.
- **verification**: `node scripts/ci-esm-core-unit-check.mjs` PASS, `ci-architecture-contract-check.mjs` PASS(`1085/39/186/375`), `ci-architecture-browser-check.mjs` PASS(technical primary `11/11`, browserErrors `0`, 17-route round trip).

## P786 - v53.21 - signal 핵심 판정 hero가 canonical Trading Score와 별도 legacy writer 경계를 갖지 못했다

- **motivation**: P785가 technical health primary surface를 닫은 다음 ARX-11 순서에 따라 signal route의 score/decision hero를 동일 Trading Score 입력 계약 위에서 native owner로 넘기고 home·secondary widgets와 경계를 분리한다.
- **symptom/reproduction**: `normalizeAnalysis`에는 Trading Score 기반 signal envelope가 있었지만 `analysis.js`는 signal DOM을 쓰지 않았고, `index.html:refreshSignalDashboard()`가 score/decision 3개 sink를 직접 갱신했다. native 전환을 시도하면 3-band toy/action 표현과 실제 5-tier 한국어 legacy 표현이 충돌할 수 있었다.
- **root_cause**: machine-facing `WATCH/WAIT/REDUCE` envelope와 사용자-facing 5-tier decision wording이 하나의 명시적 presentation contract로 분리되지 않았고, legacy signal writer fence가 없었다.
- **fix**: `signal-presentation.v1` pure mapping을 `src/domain/signal/trading-score.js`에 추가하고 normalize state의 `signal.presentation`으로 배선했다. `analysis.js`가 `score-gauge-val`, `score-decision-badge`, `score-decision-sub` 3개를 fail-closed/native 렌더하며 `refreshSignalDashboard()`는 native marker가 있을 때 해당 3개를 건너뛴다. canvas/factor bars/execution window/risk monitor/timestamp/narrative 및 home summary는 legacy secondary로 유지했다.
- **violated_rule**: R352 단일 실행 소유권·실측 renderer ownership 원칙 및 R357 native bounded-surface writer fence 원칙.
- **prevention**: presentation model version/partial fixture, architecture contract marker, Chromium native sink `3/3`, and direct `NATIVE-FENCE` regression assertion.
- **verification**: `ci-esm-core-unit-check.mjs` PASS, `ci-architecture-contract-check.mjs` PASS(`1086/39/186/375`), `ci-architecture-browser-check.mjs` PASS(signal primary `3/3`, browserErrors `0`, 17-route round trip).

## P787 - v53.22 - home aggregate score/decision summary가 signal presentation과 별도 native writer 경계를 갖지 못했다
- **motivation**: P786 signal hero cutover 다음 ARX-11 순서에 따라 홈의 aggregate score/decision summary를 동일 canonical Trading Score presentation 위에서 native owner로 넘기고, quality meter와 상세/secondary surface는 분리한다.
- **symptom/reproduction**: home의 `analysis.js` lifecycle/state module은 이미 mounted 되었지만 `home-hero-total`, `home-hero-headline`, `home-hero-desc`, `home-trading-signal`은 `js/aio-data.js`의 legacy refresh가 직접 갱신했다. native가 같은 sink를 쓰면 last-writer-wins 경합과 signal/home wording drift가 발생할 수 있었다.
- **root_cause**: 홈 summary가 normalized `signal.presentation`을 소비하지 않고 legacy `computeTradingScore()` 및 분산된 5-band 문구를 다시 계산했으며, home route용 legacy writer fence가 없었다.
- **fix**: `analysis.js`가 canonical `signal-presentation.v1`의 score/decision/description을 네 개 home sink에 fail-closed로 렌더링하고 `data-aio-home-renderer="native"`를 표시한다. `_aioRenderHomeHero()`와 `refreshHomeDashboard()`는 native marker 아래 네 sink를 건너뛰고 factor/quality/F&G/regime/detail surface만 계속 호환 렌더링한다.
- **violated_rule**: R352 단일 실행 소유권·renderer ownership 회계, R358 canonical presentation/fence, 신규 R359 home bounded aggregate fence.
- **prevention**: unit presentation fixtures, architecture contract markers, route-owner counts, and Chromium home `4/4` plus direct `NATIVE-FENCE` assertions.
- **verification**: version/runtime/structural/architecture/unit/headless (`1102/1102`)/boot/viewport FULL_INIT (`68/68`)/accessibility/critical10/portfolio/SA-02~04 full validation PASS; architecture browser home `4/4` with browserErrors `0`; live invariant reads deployed v53.17 because no deployment occurred. Data-lineage SEC coverage and operator fast-plane/rights/deployment/soak remain external blockers.

## P784 - v53.19 - Yahoo chart caller가 shared proxy health registry를 우회해 실패 health를 학습하지 못했다

- **motivation**: SA-01 acceptance required chart-specific Yahoo proxy attempts to participate in the existing cooldown/health path rather than silently creating a separate retry surface.
- **symptom/reproduction**: the final inline `_fetchYahooChartData` built a direct proxy array and called `fetch` without `_PROXY_REGISTRY.markOk/markFail`; repeated chart failures therefore did not lower proxy health. The existing shared `fetchViaProxy` path also accepted structurally valid but non-chart payloads unless the caller supplied an acceptance predicate.
- **root_cause**: the chart caller predated the shared proxy registry and retained a private failover chain. Health accounting was centralized, but the caller was not.
- **fix**: route the chart caller through `fetchViaProxy(baseUrl, { parseJson, accept })`; mark invalid chart payloads as failures; open cooldown after three consecutive registry failures; clear failure state on valid success. Add SA-01 deterministic headless coverage plus SA-02/SA-03/SA-04 Playwright fixtures and CI wiring.
- **violated_rule**: R356 (shared proxy health path), with R352 single execution ownership reinforcement.
- **prevention**: runtime contract rejects direct chart proxy arrays and missing payload validation. The headless fixture proves three-failure cooldown, one recovery schedule, and score restoration; outage/SW/boot fixtures remain repeatable and external-success independent.
- **verification**: runtime contract PASS; headless `1102/1102 PASS`; SA-02 two runs PASS with snapshot sources `16`, reference topbar, stable failure count; SA-03 PASS with exactly one controllerchange and two version queries; SA-04 PASS with server FRED/HY calls `0` and quote requests `83/100`; final full validation remains required after documentation synchronization.

## P783 - v53.18 - 정상 기준 스냅샷이 있어도 topbar는 연결 중이었고 client proxy 실패가 중복 fanout을 만들었다

- **motivation**: same-origin Tier-0 snapshot 16/16이 발행된 상태에서도 라이브 화면이 `시세 연결 중...`과 대량 CORS/proxy 경고를 보인 원인을 데이터-plane 우선순위와 재시도 소유권으로 추적했다.
- **symptom/reproduction**: snapshot bridge는 16개 reference 값을 적용했지만 `aio:marketSnapshot`의 count/as-of를 topbar가 소비하지 않았다. Yahoo 3그룹 연속 실패 후 120그룹을 스킵해도 Stooq와 Yahoo rescue가 같은 장애 transport를 다시 호출했고, 함수 내부 backoff와 중앙 3분 scheduler가 이중 재시도를 소유했다. 서버 FRED/HY가 정상이어도 부팅 직후 브라우저 fallback이 중복 실행됐다.
- **root_cause**: durable same-origin snapshot/server artifact가 UI 준비 상태와 outage circuit의 입력이 아니었고, `aio:liveQuotes`가 snapshot projection까지 live count로 셌으며 초기 fetch 소유자가 UI와 data engine에 중복돼 있었다. 최초 수정의 브라우저 검증에서는 bridge가 `window`에만 이벤트를 발화하고 기존 PageBus는 `document`를 구독하는 EventTarget 불일치도 추가로 드러났다.
- **fix**: snapshot event에 latest observed-at/sourceKind를 넣고 `document`/`window` 소비 경계를 모두 연결해 `fb-static` 기준 시세 상태를 별도 렌더한다. live count는 `live:` provenance만 세며 core coverage가 부족하면 “일부 실시간”으로 강등한다. architecture snapshot ready를 최대 8초 기다린 뒤 client enrichment를 한 번 시작하고, proxy circuit open + snapshot 가용 시 Stooq/rescue를 생략한다. snapshot 사용 중에는 함수 내부 self-retry를 제거해 중앙 3분 scheduler만 남기고, 서버 FRED/HY 성공 시 브라우저 fallback을 생략한다.
- **violated_rule**: R341/R342의 fail-closed provenance, R352의 단일 실행 소유권.
- **prevention**: same-origin durable artifact는 초기 UI readiness의 1순위이며 client fetch는 제한된 enrichment다. reference/snapshot은 live 배지·현재 시각으로 승격하지 않고, outage의 재시도 owner는 하나만 둔다.
- **verification**: runtime/architecture contracts, JS syntax, market-snapshot contract, Chromium architecture/boot/headless checks PASS; 외부 provider 성공과 7-day soak은 operator-required로 유지.

## 반복 버그 클래스 (재발 추적 — R25 승격 원장)

| 클래스 | 대표 P | 상태/게이트 |
|--------|--------|------------|
| 진척 인플레이션 (실행 소유권 이전 없이 선언식 상태 승격 — scaffold/신규 파일 수를 완료로 오인) | P736 P740 | **R352 승격 완료** — `architecture/route-owners.json` 대조 검증(ci-retirement-contract/ci-operations-status-check), "게이트는 선언이 아니라 실측을 검증" 원칙 |
| 이중 표면·그림자 구현 드리프트 (동일 판정의 중복 구현 중 한쪽만 수정) | P276 P492 P605 P606 P625 P713 P719 P741 P745 | ci-structural(그림자 선언), "동일 지표 소비 표면 grep 전수" 원칙, **AG-DOM-WRITER 신설**(P741, native/legacy id 교집합 0). P745: sloppy-mode 함수 재대입(`name = function(){}`)이 앞선 `function name(){}` 선언을 이름만 재사용해 완전히 덮어쓰는 패턴도 "이중 구현"의 한 형태 — grep으로 동일 이름 재선언/재대입 여부를 확인할 것 |
| 생산자-소비자 파이프 단절 (인프라·필드만 만들고 소비 경로 미연결) | P239 P548 P652 P664 P721 P724 P743 | "읽기 코드 존재≠필드 존재 — 쓰기 지점 grep 실증" 원칙. P743: cross-module 브릿지 API는 "소비 측"과 "노출/필터링 측"이 분리된 별도 계약일 수 있음 — 실브라우저 게이트로 종단 간 확인 필수 |
| 관측 시점 리터럴 부패 (달력 회전·시장값 회전·데이터 상태 영구 단언) | P604 P627 P713(T884) P715('1,508') P720('5/5') P722 | R279 계열. `grep "=== '20"` 스윕, 감사 토큰에 비숫자 컨텍스트 의무 |
| fail-closed 위반 (결측·정적·합성값의 현재 판정 승격) | P635 P649 P706 P712 P713 P717 P718 | R340~R342, ci-static-data-contract 22카테고리 |
| 매매 지시·과신 라벨 발화 (정적 UI 포함) | P490 P512 P535 P714 P720 | P714 관측형 전환 + 지시 문형 grep |
| HYG 달러 가격 임계로 신용 판정 | P576 P713 P714 P726(5표면 전부 해소) | **R343 승격 완료** — `grep -E "hyg\s*[<>]"` QA §0/§4 상시 편입 |
| silent fail (실패를 삼키고 정상처럼 보임) | P352 P410 P415 P523 P546 P565 P707 | 실패 상태 명시 렌더 + lineage 게이트 |
| XSS/이스케이프 누락 | P433~P438 P558 P566 P567 | escHtml/safeHtml 스윕, runtime contract |
| 일괄 치환·스윕 부작용 (sed/이모지 제거가 코드 파괴) | PR-P135 P678 P680 | R309 — 스윕 후 빈 버튼·양쪽-빈 삼항 전수 검색 |
| init 가드·cleanup 라이프사이클 | P56 P484 P568 | QA 3B 단계, 타이머 레지스트리 |
| 인코딩/mojibake 파손 | P507계열 P583 P596 P660 | ci-control-char-check (baseline) |
| 테스트가 artifact 내용에 의존 (데이터 상태 바뀌면 CI RED) | P648 P677 P709 P720 P722 | "가용/불가용 양쪽 분기 검증" 원칙, push 전 이중 artifact 실행 |
| 자기평가 오류 ("이미 됐다" 무검증 주장) | P631 P687 P688 | "기존 확인 기록 재검증 없이 신뢰 금지" (memory/feedback) |

## 2026-07-18 전수 재검증 (통합 시점 스냅샷)

이 문서 통합 시점에 라이브 코드(v53.7, main aa696df + 최신 데이터 커밋) 기준으로 전체 게이트와 대표 재발 패턴을 재실행했다.

**게이트 (전부 PASS)**: 정적 15종(control-char·worker-anthropic·version·release-revision·data-lineage·static-data·structural·ux-default-path·runtime·data-pipeline·semantic·workflow-compaction·skill·doc-currency·knowledge-lint) · JS 문법 6모듈 · 헤드리스 1101/1101 · boot budget(route 1149ms) · critical10 10/10(consoleErrors 0) · a11y 17/17 · viewport FULL_INIT 68/68(overflow 0px·jsErrors 0) · portfolio vault E2E.
- data-lineage 최초 FAIL(data.json 13.99h)은 로컬 체크아웃이 낡았던 것 — pull 후 PASS(WARN 1건 = SEC 커버리지 91/655, 기존 외부 조건). 원격 refresh-data 크론은 매시 정상.
- data-pipeline 최초 FAIL(screener-universe drift)은 Windows CRLF 아티팩트 — 내용 diff 0, LF 재생성 후 PASS.

**표본 재발 검사 (PASS)**: 매매지시 문형 0건(안전 픽스처 제외) · `.pct||0` 0건 · alert() 0건 · SRI 3건 · T859 NFP 금요일 앵커 PASS · null-score `typeof==='number'&&isFinite` 가드 존재 · P719 `toPublicPayload`+read-back 존재 · P724 52주 필드 보존 존재 · P721 `hydrateRRGDailyHistory` 존재 · P713 `_vkospiLiveOk` 게이트 존재.

**잔존 발견 (미수정 — QA-CHECKLIST 열린 항목으로 이관)**:
1. **HYG 달러 임계 신용 판정 3함수 잔존** — `_tempLive`(index.html ~16053/16068: `hyg>88?60:...`, `vix>30&&hyg<78`), `updateRiskMonitor`(~20492: 78/75 밴드 라벨), `generateFxBondCommentary`(~21739: `hyg<75` → "안전자산 피신 권고" **처방형 문구 포함**). P576/P713/P714가 3회 수정한 클래스의 4번째 표면 — P713 스윕이 computeTradingScore/Weinstein/MTF 경로만 커버. R341 승격 및 FRED HY OAS 일원화 필요.
2. **`Number.isFinite(Number(...))` 18곳 잔존** — P715 함정 패턴(`Number(null)===0`). null 선차단·파싱 목적 사용은 안전하나 index.html 14986/14994/16379/26537 등 ~5곳은 null→0 통과 가능성 미분석(개별 판정 필요). **2026-07-20(P747) 재발**: `src/data/normalize/screener.js`의 `rank` 필드가 동일 패턴으로 null→0 오염 — src/ 신규 ESM 코드도 예외가 아님을 확인, 수정 완료.
3. **R309 양쪽-빈 삼항 1건** — js/aio-data.js:3503 `(yoy >= 0 ? '' : '')` — 이모지 스윕 잔재, 양수 부호 표기만 소실(cosmetic).

---

# 상세 엔트리 (P704~P728 · v52.89~v53.9)

## P731 - v53.11 - WebSearch inferred-claim validator가 optional range와 camelCase numeric sink를 처리하지 못했다
- **motivation**: AR-06 WebSearch claim contract를 fixture로 실행하면서 검색 결과를 숫자형 current claim으로 승격시키지 않는 경계를 blocking gate로 추가했다.
- **symptom/reproduction**: `range`가 생략된 claim이 `null.min` 접근으로 예외를 냈고, validator의 underscore 중심 정규식이 `currentValue`를 exact numeric field로 차단하지 못했다.
- **root_cause**: 선택 필드 정규화가 `undefined` 기본값만 처리했고, 금지 필드 탐지가 camelCase를 계약 키로 열거하지 않았다.
- **fix**: null-safe range normalizer와 명시적 `value/currentValue/exactValue/numericValue` 금지 키 집합을 추가했다. valid two-source/high-confidence, one-source rejection, numeric sink rejection을 CI fixture로 고정했다.
- **violated_rule**: R347의 inferred claim fail-closed contract.
- **prevention**: optional input은 null과 undefined 양쪽을 fixture로 검증하고, security/claim sink 키는 naming convention 정규식만으로 판정하지 않는다.
- **verification**: `ci-inference-contract-check.mjs`, `ci-architecture-contract-check.mjs`, Chromium architecture browser check PASS.

## P734 - v53.13 - reload 후 Portfolio Vault 잠금 화면과 RSS news backstop이 회귀했다
- **motivation**: v53.12 배포 후 실제 downstream CI에서 보호 데이터 경계와 뉴스 freshness gate를 끝까지 닫는다.
- **symptom/reproduction**: `ci-portfolio-vault-e2e.mjs`의 `PFE2-05 reload_requires_unlock`가 `false`였고, refresh run `29670423595`는 `news=0`을 발행해 후속 CI `29670464804`의 22-category news gate를 실패시켰다.
- **root_cause**: hard reload 뒤 `renderPortfolio()`가 초기 active route에서 재호출되지 않아 `isPortfolioLocked()`는 true여도 lock surface가 `display:none`으로 남았다. RSS fetch는 단일 시도와 `when:2d` provider window에만 의존했다.
- **fix**: active portfolio route의 DOMContentLoaded 초기 렌더를 보강하고, RSS fetch retry와 `when:7d` provider backstop을 추가하되 canonical 08:00 KST cycle filtering을 유지했다.
- **violated_rule**: R350.
- **prevention**: Vault E2E reload gate와 data-pipeline RSS contract를 blocking checks로 유지한다.
- **verification**: local Vault E2E 8/8 PASS, data pipeline contract PASS, `node --check scripts/fetch-data.mjs` PASS. Downstream CI/Pages evidence follows deployment.

## P735 - v53.14 - 데이터 히스토리의 공통 날짜와 LKG/AI/HY OAS 경계가 분리되지 않았다
- **motivation**: AUTOMATED-DATA-RELIABILITY-HANDOFF의 Batch 0/2/3을 실제 산출물 계약으로 닫고, 수집 실패가 기존 공식 매크로·히스토리·AI 문장을 조용히 훼손하지 않게 한다.
- **symptom/reproduction**: `history.json`은 369개 행에 숫자는 있었지만 field별 `observedAt/source/allowedUse`가 없어 미국·한국·암호화폐의 휴장일/24·7 관측을 공통 `date`로 오표기했다. 로컬 FRED 키가 없을 때 새 실행이 이전 FRED macro 값을 제거했고, HY OAS는 브라우저 fetch 성공에 의존했으며, raw marketAnalysis는 NFP 10배 단위 문장을 생성할 수 있었다.
- **root_cause**: `updateHistory()`가 행 단위 숫자만 저장하고 백필의 관측 메타를 버렸다. fetch 실패 시 FRED LKG merge가 없었고, server-data loader가 `macro.hyOAS`를 `window._hySpreadBp`로 투영하지 않았다. `genMarketAnalysis()`는 typed semantic gate 없이 raw text를 반환했다.
- **fix**: 1년 Yahoo history 백필에 field-level evidence를 보존하고 휴장일은 이전 관측값을 `carried-forward/reference-only`로 명시했다. `mergeMacroLastKnownGood()`로 누락 series를 보존하되 fetch 실패 상태를 유지하고, durable HY OAS를 server UI success path에 연결했다. `validateMarketAnalysisText()`와 `ci-history-field-time-contract-check.mjs`에 NFP 단위 fixture를 추가하고 semantic gate 통과분만 발행한다.
- **violated_rule**: R351 및 R332/R340 계열(QG-06/QG-09/QG-11/QG-12).
- **prevention**: refresh/CI에서 field-time·LKG·AI scale 계약을 blocking 실행하고, data.json `fredHasKey/fredFetchOk`와 `marketAnalysisSemanticOk`를 별도 상태로 유지한다. Fast plane, provider rights, SEC coverage는 운영자 승인 전 `OPERATOR_REQUIRED/PARTIAL`로 둔다.
- **verification**: `ci-history-field-time-contract-check` PASS(369 rows, 3535/3535 numeric fields), `ci-static-data-contract` 22/22 PASS, Tier-0 snapshot 16/16 PASS, pipeline/lineage/reconciliation/operations contracts PASS. 로컬 외부 네트워크 제한 실행은 quote coverage fail-closed로 LKG를 보존했고, 권한 승인 실행은 78/78 quotes와 history backfill을 완료했다. 7-day fast-plane soak/provider rights는 미검증.

## P736 - v53.15 - architecture scaffold가 실제 legacy 소유권 이전 없이 완료처럼 보였다
- **motivation**: 사용자가 CI/MJS와 신규 파일은 계속 늘지만 `index.html`/기존 JS의 제거가 거의 없는 점을 지적해, AR-09 진행 여부를 실행 소유권과 삭제 증거로 재판정했다.
- **symptom/reproduction**: 기존 architecture gate는 global/fetch/storage/HTML sink 카운터가 baseline과 같아도 통과했고, `operations-status.json`은 legacy renderer를 쓰는 sentiment를 native owner로 집계했다. Browser에서 router active route는 sentiment였지만 Store route는 `null`이었다. legacy `PAGES.sentiment.init`, UI badge writer, `aio-data.js`의 `window.showPage` monkeypatch가 동시에 남았고 release manifest는 v53.11에 고정돼 있었다.
- **root_cause**: 최초 구현이 observer/scaffold 존재와 실제 renderer/lifecycle ownership을 구분하지 않았다. 계약도 "증가 금지"만 검사해 legacy 부채의 감소를 요구하지 않았고, command bus dispatch와 reducer 소비를 end-to-end로 단언하지 않았다.
- **fix**: sentiment lifecycle과 fail-closed badge writer를 ESM route로 이전하고 legacy init hook·badge writer를 제거했다. data page activation은 전역 `showPage` 재정의 대신 기존 page bus 등록으로 교체해 explicit global writer를 1110→1109로 줄였다. reducer에 `route/changed`를 연결하고, compatibility facade를 legacy renderer 호출의 단일 경계로 만들었다. release parity·퇴역 패턴·burn-down 상한을 architecture gate에, router/store route·badge 결과를 Chromium gate에 추가했다. 운영 상태는 native lifecycle과 native renderer를 분리했다.
- **violated_rule**: R352 및 R73/P239의 "인프라만 추가하고 소비·소유 경로 미연결" 클래스.
- **prevention**: `ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md`의 세션 카드와 DELETE-LEDGER를 사용한다. 이후 route batch도 lifecycle/renderer/data/chart/narrative 소유권을 각각 선언하고 최소 한 legacy 경로를 삭제한다. 동일 카운터 유지로는 완료 처리하지 않으며, renderer가 legacy면 route 전체를 native로 집계하지 않는다.
- **verification**: architecture contract PASS(explicit global writes 1109, 퇴역 3패턴 부재, release revision parity), Chromium architecture PASS(router/store route=`sentiment`, `심리: 판정 보류`, 왕복 dispose/mount, browserErrors 0). 정적·데이터·보안 계약 22종, headless 1101/1101, Critical-10 10/10, a11y 17/17, viewport 68/68(overflow/tinyText/jsErrors 0), Vault 8/8도 PASS했다. 전체 AR-09는 renderer 17개와 나머지 legacy coupling이 남아 `MIGRATION_IN_PROGRESS`다.

## P738 - v53.15 - native cutover left the runtime contract gate on retired legacy markers
- **motivation**: The Pages deployment gate failed after the ARX-09~16 native route cutover was pushed.
- **symptom/reproduction**: GitHub Actions `validate` failed `ci-runtime-contract-check.mjs` on nine checks, so the dependent Pages `deploy` job was skipped.
- **root_cause**: Several runtime checks encoded legacy function declarations, inline theme-detail ownership, legacy VIX/value-slot call sites, and retired breadth markers instead of accepting the new native ESM owners. The F&G delta path also trusted `DATA_SNAPSHOT._fearGreedDelta` after a live CNN fetch instead of preserving the just-fetched `previous_close` delta.
- **fix**: Updated the runtime contract to recognize native theme/sentiment ownership and timestamped breadth evidence; added native Batch-3 regression coverage; and added a live CNN previous-day delta renderer that updates both F&G surfaces without snapshot overwrite.
- **violated_rule**: R3 postmortem requirement, R352 architecture ownership parity, and the deploy-gate contract.
- **prevention**: Every route cutover must update its structural/runtime contract in the same change, and live delta renderers must retain source-specific session state instead of rereading a stale snapshot field.
- **verification**: Targeted runtime contract and syntax checks are required before the next push; full local suite was not rerun per user instruction.

## P739 - v53.16 - deferred CI gates exposed stale cross-page projections and an inert derived route
- **motivation**: Restore the deployment gate after the runtime-contract fix exposed the next blocking browser regressions.
- **symptom/reproduction**: GitHub Actions reported `T189` F&G mismatch (`home=37`, `sent=18`), `T769` missing the `sentiment` narrative registry entry, `T879` stale VIX term text, and all four `theme-detail` viewport combinations timed out waiting for the inline detail panel.
- **root_cause**: The native sentiment route only rendered while mounted, so hidden compatibility sinks retained old text; snapshot evidence overrode explicit runtime patches; native sentiment was omitted from the legacy narrative registry; and `showPage('theme-detail')` recorded a pending theme without consuming it.
- **fix**: Added a canonical sentiment summary projection for cross-page sinks, gave explicit provider patches precedence over snapshot evidence, registered the native sentiment narrative boundary, and consumed the pending theme-detail selection by opening the canonical inline panel after route transition.
- **violated_rule**: R3 postmortem requirement, R352 native ownership parity, and the route-settle/deploy-gate contract.
- **prevention**: Every native cutover must test both active and hidden DOM projections, explicit live-patch precedence, derived-route semantic readiness, and registry completeness before Pages deployment.
- **verification**: Targeted browser probe passed for synchronized F&G/VIX blocked state, seven narrative registry entries, and `theme-detail → themes` panel activation; syntax and diff checks passed. Full local suite was not rerun per user instruction.

## P740 - v53.16 - 소유권 회계 하드코딩과 게이트 역전으로 이중 DOM writer 경합이 "17/17 native"로 은폐됨
- **motivation**: 2026-07-19 18:20~19:23 배치(`b7bce36`→`9462404`)가 ARX-09~16을 완료로 선언하고 origin/main 배포까지 마쳤으나, 신규 파일/게이트는 계속 늘어도 `index.html`/js 삭제가 거의 없다는 재지적으로 `ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md` 전수 재감사와 RM-00~06 복구 패킷 실행을 요청받았다.
- **symptom/reproduction**: `node scripts/ci-retirement-contract.mjs`·`ci-operations-status-check.mjs`는 PASS했지만, `scripts/build-operations-status.mjs:43-48`이 `nativeOwner`/`nativeRendererOwner`에 17개 route 전체를 리터럴 배열로 하드코딩하고 `legacyOwner: 0`을 고정해 게이트가 검증하는 대상 자체가 선언값이었다(`ci-retirement-contract.mjs:12`의 "17개 아니면 실패", `ci-operations-status-check.mjs:15`의 `legacyOwner + nativeRendererOwner.length === supported` 항등식도 같은 구조). 실제로는 `src/ui/pages/{analysis,entity,market,portfolio,screener}.js` thin native 모듈이 legacy가 여전히 쓰는 동일 DOM(`home-trading-signal`, `score-gauge-val`, `screener-results-body`, `pf-positions-tbody`, `live-news-feed` 5곳, `briefing-live-news-list` 6곳 등)에 경합 렌더링 중이었다 — 특히 screener 테이블은 legacy가 22컬럼 innerHTML을, native가 5컬럼 replaceChildren을 쓰고 있어 native가 이기면 테이블이 무너지는 사용자 가시 회귀였다. `ci-domain-parity-check.mjs`는 같은 fixture로 같은 함수를 두 번 호출해 비교하는 항진 게이트였다.
- **root_cause**: (1) route 소유권의 단일 소스가 코드 실측이 아니라 손으로 쓴 리터럴 배열이었다. (2) 대응 게이트들이 "선언값이 특정 형태를 만족하는가"만 검증하고 "그 선언이 실제 코드와 일치하는가"는 검증하지 않는 자기 증명 구조였다. (3) route cutover 배치가 DELETE-LEDGER 없이 legacy renderer를 남긴 채 native 모듈을 병렬 추가했다 — R352가 막으려던 패턴이 R352 제정 바로 다음 배치에서 재발했다. (4) 상위 handoff·실행계획·operations-status.json 세 문서가 서로 다른 소유권 수치(17/0, 4/13, 0/17)를 동시에 주장해 어느 것도 단독으로 신뢰할 수 없었다(F-07).
- **fix**: `architecture/route-owners.json` 신설 — 17 route × 5칸(lifecycle/renderer/data/chart/narrative) 소유권을 코드 재실측(`bootstrap.js` 모듈 배선, `PAGES` init 리터럴, contested DOM id 교차 grep)으로 채운 단일 소스. `build-operations-status.mjs`를 이 파일에서 파생하도록 재작성(하드코딩 배열 삭제, `cutoverStatus: 'MIGRATION_IN_PROGRESS'`). `architecture/retirement-manifest.json`을 `status: MIGRATION_IN_PROGRESS`·실측 `legacyRouteOwners`(15개)로 정정. `ci-retirement-contract.mjs`/`ci-operations-status-check.mjs`/`ci-architecture-contract-check.mjs`를 route-owners.json 대조 검증으로 재작성(선언 강제 제거, renderer-native route의 legacy 심볼 부재 검사 추가). `ci-domain-parity-check.mjs`→`ci-domain-module-smoke-check.mjs` 개명(ci.yml 동기화)으로 이름이 실제로 하지 않는 검증(parity)을 주장하지 않도록 정정했다(실제 parity 구현은 RM-03 별도 패킷). 상충하던 3개 문서(핸드오프 07-18/실행계획 07-19/INDEX.md)의 서술을 취소선+정정 추기로 통일(기존 줄 삭제 없음).
- **violated_rule**: R352(migration은 실행 소유권 이전으로 판정), R25(반복 클래스 추적 — "진척 인플레이션" 신규 클래스의 2번째 사례), R3(F-01~F-03이 발생 당시 즉시 postmortem되지 않음, 이번에 소급 기록).
- **prevention**: `architecture/route-owners.json`을 소유권의 유일한 소스로 고정 — 운영 상태·retirement manifest·CI 게이트가 전부 이 파일을 읽어 대조하며, 이후 어떤 상태 승격도 이 파일의 파생값으로만 이뤄진다. 반복 클래스 표에 "진척 인플레이션" 신설(위 표). RM-01에서 이번에 확정한 contested DOM id의 legacy writer 제거를 이어서 수행한다.
- **verification**: `node scripts/ci-architecture-contract-check.mjs`, `ci-retirement-contract.mjs`, `ci-operations-status-check.mjs`, `ci-domain-module-smoke-check.mjs` 전부 정직한 실측값 기준으로 PASS(`nativeRendererOwner:["sentiment","guide"]`, `legacyOwner:15`, `nativeOwner:[]`). `public-data/operations-status.json` 재생성 확인. 나머지 §8.1 게이트는 같은 세션에서 이어서 실행(세션 카드 별도 기록).

## P741 - v53.16 - RM-01: thin native page modules double-wrote legacy-owned DOM and silently blocked legacy click delegation
- **motivation**: RM-00(P740)이 소유권 회계는 정정했으나 F-03이 지목한 실제 이중 DOM writer 자체는 RM-01로 이월했다. `_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md` RM-01 절차대로 contested id 전수 재측정 후 제거를 실행했다.
- **symptom/reproduction**: `src/ui/pages/{analysis,entity,market,themes,portfolio,screener,news}.js` 7개 모듈이 legacy가 여전히 쓰는 DOM id에 native `setText`/`replaceChildren`을 걸어 두고 있었다. 전수 cross-grep 결과 analysis.js 12개 id 전부(`home-hero-*`, `home-trading-signal`, `score-gauge-val`, `score-decision-*`, `tech-*`, `health-score-display`), entity.js 13개 id 전부(`ticker-hero-*`, `ticker-m-*`, `fund-analysis-text`, `opt-pcr-val-secondary`, `ticker-candle/entry-symbol`), themes.js 3개 id 전부(`rrg-quadrant-cards`, `rrg-chart-status`, `theme-detail-title`), portfolio.js 10개 id(`pf-*`, `pf-positions-tbody`), screener.js 5개 id(`screener-*`), news.js 컨테이너 2종(`live-news-feed` 5곳·`briefing-live-news-list` 6곳 legacy writer) + 카운트 4개 id가 CONTESTED로 확인됐다. market.js는 `[data-live-price]`/`[data-live-chg]`(legacy 25곳) 및 breadth 3개 id가 CONTESTED였고, macro FRED 5개 id(`macro-fedRate` 등)는 index.html에 해당 id 자체가 존재하지 않아 계약과 무관하게 항상 no-op이었다(별개 발견 — 경합이 아니라 완전 비활성 코드). 추가로 news.js의 필터/새로고침 클릭 핸들러가 `event.stopPropagation()`을 호출해 legacy의 `data-action` 델리게이터(`filterNewsByCountry`/`setNewsSortMode`/`_aioFetchAllNewsForce` 등 `js/aio-data.js`에 실존)가 클릭을 아예 수신하지 못하게 막고 있었다 — DOM 쓰기 경합과 별개인, 숨겨진 이벤트 위임 차단 회귀. sentiment 자체도 재검증 결과 `sent-analysis-text`가 legacy의 활성 함수(`_generateSentimentAnalysis`, `js/aio-data.js:16811/16819/16825`에서 `setTimeout`으로 지연 호출 — 직접 호출문(`func()`) 검색으로는 발견되지 않는 간접 호출이라 P736/P738/P739 검증에서 누락됨)와 경합 중이었다.
- **root_cause**: 이전 route cutover 배치가 "legacy 소유 노드에 native가 쓰지 않는다"는 불변식을 세우지 않고 native 모듈을 병렬로 추가했다(F-03, R352 위반). 클릭 핸들러는 `stopPropagation`을 범용 위임 차단 목적이 아니라 "route 내부에서만 처리"용으로 넣었으나 legacy가 이미 같은 `data-action`을 전역 위임으로 처리 중인 경우까지 함께 막는 부작용을 검토하지 않았다. sentiment 검증은 `함수명()` 리터럴 호출만 grep해 `setTimeout(함수명, ms)` 형태의 간접 호출을 놓쳤다.
- **fix**: analysis/entity/market/themes/portfolio/screener/news 7개 모듈에서 legacy와 경합하는 모든 content 쓰기를 삭제하고 route dataset 스탬프(`aioArchitectureRoute`/`aioArchitectureSlice`/`aioArchitectureStatus`)만 남겼다. market.js의 macro FRED 비활성 코드도 함께 제거(같은 함수 내 경합 코드와 비경합 죽은 코드를 섞어 두지 않기 위해). news.js의 `onClick`/`onRefresh` 핸들러(및 `stopPropagation`/`preventDefault`)를 완전히 제거해 legacy data-action 위임이 다시 정상 동작하도록 복원했다. sentiment.js에서 `home-fg-score`(→ legacy 단독 소유 복원)와 `sent-analysis-text`(→ legacy의 더 정교한 캐피출레이션/디커플링/클러스터 분석이 단독 소유) 쓰기를 삭제하고, `fg-score-big`/`pc-score-big`은 legacy가 읽기 전용으로 의존하는 정당한 관계임을 확인해 유지했다. `architecture/route-owners.json`에 `domWriterIntersectionAllowlist`(읽기 전용 예외)를 신설하고 `AG-DOM-WRITER` 정적 게이트를 `ci-architecture-contract-check.mjs`에 추가(native/legacy id 교집합 0을 매 배치 강제, page-* 컨테이너 id는 구조적 앵커로 제외). `ci-architecture-browser-check.mjs`에 home 로드 후 `score-gauge-val` 정수(0~100, legacy `*` 접미 허용) 및 `home-trading-signal` 한국어 라벨 검증과 market-news/briefing의 `aioArchitectureRenderer` non-native 확인을 추가했다.
- **violated_rule**: R352, F-03(이중 DOM writer), AG-03(단일 writer 원칙), R3(즉시 postmortem 필요).
- **prevention**: `AG-DOM-WRITER`가 매 배치 native/legacy id 교집합을 강제하므로 향후 재발 시 CI가 즉시 차단한다. `route-owners.json`의 `legacySymbolsMustBeAbsent`/`domWriterIntersectionAllowlist`가 단일 소스이며, 새 예외는 반드시 근거(파일:라인)와 함께 이 파일에 먼저 기록한다. 클릭 위임을 가로채는 새 native 핸들러는 `stopPropagation` 추가 전에 동일 `data-action` 이름의 legacy 전역 함수 존재 여부를 먼저 확인한다.
- **verification**: `ci-architecture-contract-check.mjs`(AG-DOM-WRITER 포함)·`ci-retirement-contract.mjs`·`ci-operations-status-check.mjs`·`ci-architecture-browser-check.mjs`(신규 home surface·contentRoutes 검증 포함)·headless 1098/1098·critical10 10/10·a11y 17/17·knowledge-lint 0 warning 전부 PASS. `git diff --check` 클린.

## P742 - v53.16 - RM-02: store cloned full state twice per dispatch plus once per subscriber, no O(1) scaling path for screener/portfolio
- **motivation**: F-05(`ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md`)가 RM-02를 "W5(screener/portfolio slice 이관) 진입 전 필수"로 지정했다 — 846행 screener·다수 OHLCV 이력을 store로 옮기기 전에 dispatch 비용을 실측·교정해야 한다.
- **symptom/reproduction**: `src/state/store.js`의 `dispatch()`가 `clone(state)`(reducer 입력)·`clone(next)`(커밋) 2회에 더해 `listeners.forEach(listener => listener(getState()))`에서 구독자당 1회씩 `clone`을 호출했다(`structuredClone`/JSON 폴백). 1000행 screener fixture + 구독자 5개로 벤치한 결과 p95=7.49ms(300회 표본) — 60fps 프레임 예산(16.67ms)의 45%를 dispatch 하나가 소비했다. `bootstrap.js`는 `aio:liveQuotes` 1개 이벤트에 6개 독립 orchestrator(`sync()`)를 배선해 시세 틱 1건마다 최대 6회 dispatch(각각 위 clone 비용 포함)가 발생했다.
- **root_cause**: 최초 store 구현이 "구독자가 실수로 state를 mutate할 수 있다"는 우려를 매 read/write clone으로 방어했으나, 모든 reducer(`src/state/slices/*.js`)가 이미 스프레드 기반 구조 공유를 보장하므로 불필요한 방어였다. `bootstrap.js`도 orchestrator를 이벤트당 개별 등록해 동일 이벤트의 반복 발화를 조정(coalesce)하지 않았다.
- **fix**: `store.js`의 `getState()`/`dispatch()`/구독자 통지에서 clone을 전부 제거하고, `devMode` 옵션(기본 false)에서만 커밋 후 `deepFreeze`로 불변을 강제하도록 재작성(ADR-0002 부록에 `getStateUnsafe`/selectors-only 대안을 기각 사유와 함께 기록). `src/state/memoize.js` 신설(`createSelector`: 입력 참조 동등성 메모이제이션, `subscribeToSlice`: 관련 slice 참조가 바뀔 때만 리스너 호출) — `sentiment.js`에 실제로 배선해 무관한 dispatch(예: portfolio/screener)로 인한 불필요한 차트 재그리기를 제거했다. `bootstrap.js`의 `aio:liveQuotes` 6개 개별 리스너를 마이크로태스크 단위로 coalesce하는 단일 리스너 1개로 교체(같은 tick 내 반복 발화는 1회로 합쳐짐). `ci-architecture-contract-check.mjs`에 1000행 screener dispatch+notify p95 성능 게이트(5ms 예산, 구 clone 설계 회귀 시 7.49ms로 초과·확인됨) 추가.
- **violated_rule**: F-05(신설 규칙 후보 — 상태 store 클론 예산 부재), R352(W5 선행 조건 미충족 상태로 대형 slice 이관 금지).
- **prevention**: 새 성능 게이트가 매 배치 1000행 screener dispatch p95 ≤ 5ms를 강제하므로 clone 재도입 시 CI가 즉시 차단한다(구 설계는 7.49ms로 이 게이트를 실패시킴을 확인). reducer가 스프레드 기반 구조 공유를 깨는 변경(예: 직접 mutate)을 하면 `devMode` deep-freeze가 즉시 TypeError로 노출되도록 페이지/테스트 하네스에서 `devMode:true`로 실행하는 경로를 추가하는 것을 후속 과제로 남긴다(이번 배치는 기본값 false만 배선).
- **verification**: `node scripts/ci-architecture-contract-check.mjs`(perfScreenerDispatchP95Ms=0.044ms, PASS) 포함 §8.1 전체, headless 1098/1098, `ci-architecture-browser-check.mjs`(browserErrors 0, sentiment 재검증 정상), critical10 10/10, a11y 17/17, portfolio vault E2E, knowledge-lint 0 warning 전부 PASS.

## P743 - v53.16 - RM-03: computeTradingScore extraction, and exposeArchitecture's hardcoded allowlist silently dropped the new bridge function from every real browser
- **motivation**: F-11(`ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md`)가 지목한 Trading Score 3중 구현(라이브/백테스트 사본/toy 도메인)을 단일 구현으로 수렴하는 RM-03 item 1·5를 실행했다.
- **symptom/reproduction**: (1) 추출 자체: `js/aio-core.js:21671`의 `computeTradingScore`(vol/momentum/trend/breadth/macro 5서브스코어 + day모드/pcr/교차리스크/추세-시장폭다이버전스/신용/유가/뉴스 7보정, TTL 20s 캐시)를 `src/domain/signal/trading-score.js`(`computeTradingScoreModel`, 순수 함수)로 이관했다. 헤드리스로 legacy 함수를 7개 시나리오(강세/약세/데이터없음/부분결측/day모드/위험한 랠리 다이버전스/바닥 다이버전스)에서 실행해 골든 fixture(`architecture/fixtures/trading-score-golden.json`)를 생성했다. (2) **배선 버그(실사용자 영향 가능성 확인)**: `computeTradingScoreModel`을 `src/app/bootstrap.js`의 `api` 객체에 추가했으나, `src/legacy/compatibility-facade.js`의 `exposeArchitecture()`가 `window.AIO_ARCH`에 노출할 필드를 하드코딩된 명시적 목록(status/version/getState/getEvidence/getMarketSnapshot/getSentimentSummary/ingestSentiment/getAIContext/navigate/router)으로 **cherry-pick**하는 구조라는 걸 놓쳐, `computeTradingScoreModel`이 그 목록에 없어 실제 `window.AIO_ARCH`에서는 조용히 빠졌다. 결과적으로 `computeTradingScore`의 레거시 래퍼가 `window.AIO_ARCH.computeTradingScoreModel`을 찾지 못해 매 호출마다 전부-null fail-closed 폴백을 탔다 — 헤드리스 브라우저 게이트(`ci-architecture-browser-check.mjs`)의 home 화면 검증에서 `score-gauge-val`이 `"null*"`로 나타나 발견했다(골든 fixture 대조 parity 게이트는 `computeTradingScoreModel`을 직접 호출하므로 이 배선 문제를 잡지 못함 — 별도 브라우저 증거가 필요했던 이유). (3) 백테스트 수렴 중 발견한 추가 드리프트: `scripts/backtest-trading-score.mjs`가 "v52.1 그대로 복사"라 자칭했지만 실제로는 (a) trend 결측 시 라이브는 null인데 사본은 중립 50 폴백, (b) 라이브가 P714/R343로 제거한 HYG 달러가격 `hyg<76` 임계를 사본은 여전히 보유해 별도의 bp 근사와 이중 계상, (c) 라이브에 대응이 전혀 없는 aaiiBear breadth 상향 조정을 사본만 보유 — 3가지 모두 드리프트였다.
- **root_cause**: (1) 배선 버그: 새 API 필드를 소비 측(`bootstrap.js`)에만 추가하고, 노출 측(`exposeArchitecture`)의 별도 allowlist를 갱신하지 않았다 — 두 파일이 "같은 api 객체"를 공유한다고 착각했지만 실제로는 `exposeArchitecture`가 필드를 재열거하는 별도 계약이었다. (2) 백테스트 드리프트: F-11이 이미 지목한 대로, "그대로 복사"라는 주석이 있는 사본은 라이브가 v52.1에서 v53.x로 진화해도 자동으로 따라가지 않는다는 사실 자체가 원인.
- **fix**: `exposeArchitecture()`에 `computeTradingScoreModel: api.computeTradingScoreModel` 한 줄 추가. `computeTradingScore` 레거시 래퍼는 입력 수집만 유지하고 `window.AIO_ARCH.computeTradingScoreModel`을 호출하도록 재작성(모델 실패 시 전부-null fail-closed 폴백 유지, 포뮬러 사본은 만들지 않음). `backtest-trading-score.mjs`의 5개 서브스코어 함수를 삭제하고 동일 모델을 호출하도록 재작성 — trend/breadth/pcr는 라이브의 정직한 null/false 결측 처리에 맞춰 정렬(예전 중립 상수 근사 제거), hyg→hyBp 근사는 이 데이터소스 고유의 입력 변환으로 유지, aaiiBear는 완전 삭제. `backtest-trading-score-longrun.mjs`는 `reconstructScore`를 그대로 import하므로 별도 수정 없이 자동 수렴(단, 그 파일 자체의 percentile 기반 `calcTrendScoreRel` 등은 10년 다중 regime 비교를 위한 의도적으로 별개인 방법론이라 그대로 유지). `ci-domain-parity-check.mjs`(구 `ci-domain-module-smoke-check.mjs`)에 골든 fixture 대조 실 parity 검증을 추가하고 이름을 원복. `ci-runtime-contract-check.mjs`/`ci-semantic-review-check.mjs`의 "`{ total, score: total` 리터럴이 `core`에 있어야 한다" 게이트 2건이 추출로 깨진 것을 도메인 모듈을 함께 검사하도록 정정.
- **violated_rule**: R352(단일 구현 이전 시 소비측만이 아니라 노출측 계약까지 전수 갱신), F-11, AG-LEGACY(사본 삭제).
- **prevention**: 새 cross-module 브릿지 API를 추가할 때 "소비하는 곳"과 "노출/필터링하는 곳"이 분리된 계약인지 먼저 확인하고, 반드시 실브라우저 게이트(정적 golden fixture 대조만으로는 배선 문제를 못 잡음)로 종단 간 검증한다. "그대로 복사"라고 주석 단 사본은 향후 라이브 변경을 추적하지 못하므로, 그런 사본을 발견하면 그 자리에서 즉시 단일 구현으로 수렴하는 것을 표준 절차로 삼는다.
- **verification**: `node scripts/ci-domain-parity-check.mjs`(7개 골든 fixture 전부 일치) + `ci-architecture-browser-check.mjs`(수정 전 `"null*"` 재현 확인 → 수정 후 `"52*"` 정상 확인) + `ci-runtime-contract-check.mjs` + `ci-semantic-review-check.mjs` + §8.1 전체 + headless 1098/1098 전부 PASS. `node scripts/backtest-trading-score.mjs` 실행해 `public-data/score-backtest-history.json` 재생성 확인(표본 극히 작아 `statisticallyMeaningful:false` 그대로).

## P744 - v53.16 - RM-05: 3개 native page 모듈이 lifecycle dataset 마커를 빠뜨렸고(RM-01 잔여 결함), 브라우저 게이트가 이를 놓치고 있었다
- **motivation**: RM-05 item 2(`_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md`)가 요구한 "native route 전체의 A→B→A 왕복 리소스 누수 assert"를 `ci-architecture-browser-check.mjs`에 추가하는 과정에서 실제 실행해 발견했다.
- **symptom/reproduction**: 17개 route 전체를 순회하며 각 route의 `page-{route}` 요소에 `dataset.aioArchitectureRoute === route`가 설정되길 기다리는 `page.waitForFunction`이 `ticker`/`fundamental`/`options`(entity.js)·`macro`/`fxbond`/`breadth`(market.js)·`themes`/`theme-detail`(themes.js) 8개 route에서 30초 타임아웃됐다. RM-01이 이 3개 모듈에 `dataset.aioArchitectureSlice`/`aioArchitectureStatus`는 배선했지만 `aioArchitectureRoute`(lifecycle 소유 마커)는 빠뜨렸다 — analysis.js/portfolio.js/screener.js/news.js/guide.js/sentiment.js 6개 모듈만 정상 배선돼 있었다.
- **root_cause**: RM-01에서 6개 파일을 먼저 패턴화한 뒤 나머지 3개를 "같은 패턴"으로 작성하며 `aioArchitectureRoute` 한 줄을 각각 누락했다. 기존 §8.1 브라우저 게이트는 sentiment/guide/market-news/briefing/home 5개 route만 왕복해 이 3개 모듈(macro/fxbond/breadth/themes/theme-detail/ticker/fundamental/options)을 아예 방문하지 않았으므로 지금까지 발견되지 않았다.
- **fix**: entity.js·market.js·themes.js 3개 파일에 `dataset.aioArchitectureRoute = route`(mount 시)와 대응 dispose 정리(unmount 시)를 추가. 이제 17개 route 전부가 동일한 lifecycle 마커 계약을 지킨다. `ci-architecture-browser-check.mjs`에 17-route 2랩 왕복(canvas count·legacy 타이머 레지스트리 크기를 랩1 종료 시점 vs 랩2 종료 시점으로 비교 — 랩0 대비 비교는 "첫 방문 시 신규 타이머 등록"이라는 정상 동작을 오탐하므로 랩1↔랩2 비교로 설계) + `[AIO:api] <name>: warn → error` 일반화 필터(macro/fxbond 등 새로 방문한 route의 API 헬스 트래커 이관 허용) 추가. `scripts/ci-esm-core-unit-check.mjs` 신설(store/router/lifecycle/evidence-store/facade 5개 ESM 코어 모듈 격리 unit 계약, ci.yml에 배선). `architecture/route-owners.json`에 AG-DOM-WRITER 허용목록 이관 절차 명시.
- **violated_rule**: R352(패턴 반복 시에도 각 파일 전수 확인 필요), AG-RESOURCE(A→B→A 자원 누수 assert 원칙, 이번에 실질적으로 처음 다中 route에 적용됨).
- **prevention**: 새 게이트가 이제 17개 route 전부의 lifecycle 마커를 매 배치 확인하므로 동일 누락이 재발하면 즉시 차단된다. "같은 패턴으로 작성" 시에도 각 파일을 실행 경로로 한 번은 검증하는 습관 — 이번에도 3/9(entity/market/themes)에서만 누락돼 "패턴 복사가 항상 완벽하지 않다"는 근거가 하나 더 쌓였다.
- **verification**: `ci-architecture-browser-check.mjs`(17-route 2랩 canvas 42=42, 타이머 11=11, browserErrors 0) + `ci-esm-core-unit-check.mjs`(5개 모듈 전부 PASS) + §8.1 전체 + headless 1098/1098 + critical10/a11y/knowledge-lint 전부 PASS.

## P745 - v53.16 - RM-03 item 2: RRG(rsRatio/rsMomentum)·Weinstein/MTF 도메인 추출을 완료하고 F&G 합성 전제 오류를 확정했다
- **motivation**: RM-03 item 1(P743)이 `computeTradingScore`만 수렴시키고 item 2(F&G 합성→RRG→Weinstein/MTF)를 명시적으로 미착수 이월했다(`_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md` §0.1). 이번 세션은 그 이월분을 이어서 실행했다.
- **symptom/reproduction**: 세 대상을 각각 재실측하니 handoff의 원래 전제(F-11: "F&G 합성 → RRG → Weinstein/MTF, 각각 같은 패턴")와 실제 코드가 달랐다. (1) F&G: `fetchFearGreed`/`_applyFearGreedScore`(js/aio-data.js)는 CNN이 이미 계산한 합성 점수를 그대로 fetch만 할 뿐, sub-indicator(시장모멘텀·주가강도·풋콜비율·정크본드수요 등)로부터 로컬 합성하는 코드는 전수 grep(safe-haven/junk-bond/priceStrength/synthesize 키워드)으로도 0건 — "F&G 합성 추출"은 애초에 추출 대상이 존재하지 않았다. (2) RRG: `calcLiveRS`/`classifyRRG`(index.html:22474~22521)는 단일하고 명확한 실구현이었다. (3) Weinstein/MTF: `updateWeinsteinStage`/`updateMTF`가 index.html에 각각 두 벌씩 존재했다 — `function updateWeinsteinStage(){}`/`function updateMTF(){}` 선언(구 라이브 시세 기반 복합점수 모델)과, 그 뒤 sloppy-mode 재대입 `updateWeinsteinStage = function(snapshot){}`/`updateMTF = function(snapshot){}`(P712/R340이 도입한 신 OHLCV 기반 모델)가 이름을 무조건 덮어써, 구현이 앞쪽은 어떤 호출 경로로도 도달 불가능한 완전 사문(死文)이었다(전체 호출부 교차 grep으로 검증 — 두 호출부 모두 스크립트 최초 실행이 끝난 뒤에야 실행되는 이벤트 핸들러/비동기 함수 안에 있어 재대입이 항상 먼저 끝나 있었다).
- **root_cause**: 원 handoff(F-11)가 실제 코드를 라인 단위로 재확인하지 않고 세운 계획이었다 — F&G는 애초에 합성 로직이 없었고, Weinstein/MTF는 "하나의 살아있는 함수"가 아니라 "죽은 구현 + 살아있는 구현"의 쌍이었다(R340/P712가 교체할 때 이름만 재사용하고 구버전을 삭제하지 않아 sloppy-mode 재대입으로 우연히 안전했을 뿐).
- **fix**: RRG의 순수 수학(RS-Ratio/RS-Momentum 계산 + 사분면 분류)을 `src/domain/themes/rrg.js`(`computeRelativeRotation`/`classifyRRG`)로 이관하고 legacy `calcLiveRS`는 `window.AIO_ARCH.computeRelativeRotation` 호출 + fail-closed 폴백으로 축소. Weinstein의 MA-스택/스테이지 분류(`shortBull`~`stageEstimate`)를 `src/domain/technical/stage.js`(`classifyMovingAverageStructure`)로, MTF의 일간/주간/중기 추세 분류를 같은 파일의 `deriveMultiTimeframeView`로 이관 — `calcTechnicalSnapshot`(js/aio-core.js)과 `updateMTF`(index.html)는 각각 이 도메인 함수를 호출하도록 재작성(한국어 라벨·색상 매핑은 legacy에 존치, RM-03 item 1과 동일 경계). `src/app/bootstrap.js`의 `api` 객체와 `src/legacy/compatibility-facade.js`의 `exposeArchitecture()` 양쪽에 신규 함수 3개를 함께 등록(P743이 발견한 "소비측만 갱신, 노출측 allowlist 누락" 배선 버그의 재발 방지 절차를 그대로 적용). 사문화된 구 Weinstein/MTF 복합점수 함수 2벌(index.html, 총 376줄, `_spy_ath` localStorage 조회 포함)을 삭제 — burn-down: `explicitWindowWrites` 1094→1088, `directStorage` 189→187, `htmlSinks` 416→410(`architecture/baseline.json` 갱신).
- **violated_rule**: R352(추출=동일 산식 이동 — 이번엔 반대로 "새 모델이 아니라 애초에 추출 대상 없음"을 실측으로 확정), F-11(원 계획의 전제 오류), R3.
- **prevention**: 향후 "X를 추출한다"는 계획은 착수 전 반드시 grep으로 (a) 정말 그 산식이 코드에 존재하는지, (b) 이름이 겹치는 구현이 여러 벌(특히 sloppy-mode 재대입 패턴 `name = function(){}`)은 아닌지 확인한다. cross-module 브릿지 함수 추가 시 `bootstrap.js` api 객체와 `compatibility-facade.js` exposeArchitecture() 양쪽을 같은 diff에서 갱신하는 것을 표준 절차로 삼는다(P743 이후 두 번째 준수 사례).
- **verification**: `node scripts/dump-rrg-fixtures.mjs`/`dump-weinstein-mtf-fixtures.mjs`(git stash로 추출 전 커밋 상태를 일시 복원한 뒤 실행, 8개 실전 시나리오씩)로 골든 fixture를 생성하고 `ci-domain-parity-check.mjs`에 실 parity 검증을 추가 — 전부 일치. §8.1 전체(viewport FULL_INIT 68/68·browserErrors 0·canvas 42=42·timer 11=11 왕복 포함) + headless 1098/1098 + critical10/a11y/portfolio-vault-e2e/knowledge-lint 등 나머지 25종 게이트 전부 PASS.

## P746 - v53.16 - breadth 페이지의 Weinstein 요약 배지 두 곳이 리디자인 이후 어느 라이브 코드로도 갱신되지 않는 영구 플레이스홀더였다 (발견·부분 정리, 근본 수정은 이월)
- **motivation**: P745의 사문 코드 삭제 작업 중 삭제 대상의 종속성을 추적하다가 별도의 두 가지 고아 DOM 표면을 발견했다.
- **symptom/reproduction**: (1) `js/aio-ui.js`의 `updateWSAnalysis()`(breadth 페이지 전용, 20SMA 폭 기반 1-factor stage 판정)가 `document.getElementById('ws-analysis')`에 썼는데, 이 id는 실제로는 **technical 페이지**의 DOM(index.html 7480~7485대)에만 존재한다 — breadth 페이지 자체에는 `ws-analysis`/`ws-stage1~4` id가 없다. breadth 페이지가 활성일 때 이 함수가 실행돼도 breadth 페이지 사용자에게는 아무 효과가 없었고, technical 페이지가 나중에 자기 `aio:pageShown`으로 정상 값을 다시 쓸 때까지 아주 짧은 순간 잘못된 내용이 남아있을 수 있는 부작용만 있었다. (2) breadth 페이지 자신의 실제 Weinstein 표면(`breadth-stage-summary` span, "Stan Weinstein 30주선" 섹션 헤더 아래)과 technical 페이지의 옛 복합 MTF 위젯이 쓰던 `mtf-verdict-text`(정적 기본값 "분석 대기 중…")는 **P745가 삭제한 사문 코드 두 벌(구 `updateWeinsteinStage`/`updateMTF`)이 유일한 writer였다** — 즉 이 두 표면은 P745의 삭제 이전부터 이미 라이브 경로로는 절대 갱신되지 않는 영구 플레이스홀더였다(그 writer가 이미 죽어 있었으므로). P745의 삭제는 이 상태를 악화시키지 않았다(이미 도달 불가능했던 코드를 지운 것뿐)지만, 명시적으로 "고쳤다"고 오표기하지 않기 위해 별도로 기록한다.
- **root_cause**: R340/P712(Weinstein/MTF를 라이브 시세 기반 근사에서 OHLCV 기반 관측치로 교체)가 새 구현으로 함수 이름은 그대로 재사용했지만, 새 구현이 쓰는 DOM 표면(`ws-analysis`/`ws-stage1~4`, technical 페이지 전용)이 구 구현이 쓰던 DOM 표면(breadth 페이지의 `breadth-stage-summary`, technical 페이지의 `mtf-verdict-text`)과 정확히 일치하지 않았다 — 교체 당시 "이 함수가 실제로 어느 페이지의 어느 id에 쓰는가"를 전수 대조하지 않아 일부 표면이 조용히 고아가 됐다.
- **fix(이번 세션 범위)**: `updateWSAnalysis()`와 그 호출부 2곳(js/aio-ui.js의 `initBreadthPage`, index.html의 breadth `aio:liveQuotes` 분기)을 삭제 — 다른 페이지 DOM에 쓰는 부작용을 제거했다(순수 burn-down, 어떤 사용자 가시 표면도 이 삭제로 나빠지지 않음: 삭제 전에도 breadth 페이지에는 이 함수의 효과가 보이지 않았다). `breadth-stage-summary`/`mtf-verdict-text` 자체를 다시 살아있는 데이터로 채우는 작업은 **하지 않았다** — breadth 페이지에 technical 페이지와 같은 SPY 기준 Weinstein/MTF를 그대로 노출할지, 아니면 breadth 페이지 고유의 시장폭 기반 판정을 유지·재설계할지는 제품 결정이 필요해 이번 아키텍처 회계 패킷의 범위를 벗어난다고 판단했다.
- **violated_rule**: 해당 없음(신규 회귀 아님 — 발견된 상태가 사문화 이전부터 이미 고아였음). R3 취지에 따라 발견 즉시 기록.
- **prevention**: 함수 이름을 재사용하며 구현을 교체할 때(R340류 패턴), 새 구현이 실제로 쓰는 DOM id 집합과 구 구현이 쓰던 DOM id 집합을 diff로 대조해 빠지는 표면이 없는지 확인하는 절차를 권고한다.
- **verification**: `grep -n "breadth-stage-summary\|mtf-verdict-text"` — 두 id 모두 현재 코드베이스에 다른 writer가 없음을 확인(정적 기본 텍스트만 존재). `ci-architecture-browser-check.mjs`(17-route 왕복, canvas/timer 델타 0) PASS로 삭제가 새 누수나 콘솔 에러를 만들지 않았음을 확인. 남은 작업(두 표면에 무엇을 채울지 결정)은 QA-CHECKLIST 열린 백로그로 이관.

## P747 - v53.16 - ARX-03/04 재진입: 8개 domain의 command/reducer 경계는 이미 클린했고, ARX-04 "closed" 선언은 미실측이었다 — screener provider 첫 실 fetch 확보 중 rank null→0 오염 발견
- **motivation**: RM-06(2026-07-19)이 ARX 재진입점을 실행계획 §4 W2(ARX-03 commands/selectors, ARX-04 platform 채택)로 지정했고, 사용자가 2026-07-20 세션에서 착수를 명시 지시했다.
- **symptom/reproduction**: (1) ARX-03 재측정: `src/ui/pages/*.js` 8개 모듈 전수 grep 결과 `store.dispatch`/`commands.` 호출이 **0건**(전부 selector 기반 순수 렌더) — DOM→state 금지 기준을 선언이 아니라 실측으로 확인. `src/state/slices/*.js` 8개 모두 SET/CLEAR 액션 쌍이 일관되고 derived-state 중복이 없음. (2) ARX-04 재측정: 실행 계획 368행이 "ARX-02 and ARX-04 are locally closed for the new ESM slice"라고 선언했지만, `src/data/providers/*.js` 8개 전수 grep 결과 `fetch(`/`httpClient` 참조가 **0건** — 전부 `legacy.readX()`(legacy global 프로젝션)이었다. 유일한 실 fetch 선례는 provider 계층이 아니라 AR-07의 `src/data/market-snapshot-loader.js`(durable snapshot 전용, `applyMarketSnapshotToLegacy`로 legacy에 read-only/reference-only 브릿지)뿐이었다. (3) screener provider를 이 선례를 따라 `public-data/screener.json`을 `platform/http.js`로 직접 fetch하도록 재작성하는 과정에서, 기존 `src/data/normalize/screener.js`의 `rank: Number.isFinite(Number(row?.rank)) ? Number(row.rank) : null`이 `row.rank === null`일 때 `Number(null) === 0`이 `Number.isFinite`를 통과해 **`rank: null`이 `rank: 0`으로 오염**되는 것을 실브라우저 상태 덤프(`state.screener.rows[0].rank`)에서 발견했다 — P715가 이미 지목한 패턴(`Number.isFinite(Number(...))` null→0 함정)의 재발이었다.
- **root_cause**: (1)(2) 실행계획의 "closed" 선언은 RM-00이 지목한 것과 같은 유형의 미실측 서술이었다 — sentiment의 ARX-01/02 작업(F&G/HY/PutCall을 canonical evidence writer로 연결)을 "ARX-04 platform boundary is active"로 일반화했지만, 실제로는 provider 계층(fetch)이 아니라 legacy notify 경로였다. (3) `normalizeScreener`는 지금까지 smoke-test 픽스처(F-04, 실 데이터 아님)만 소비했고 그 픽스처는 `rank`가 항상 숫자이거나 `undefined`였지, 명시적 `null`을 준 적이 없어 이 결함이 한 번도 발현되지 않았다 — 내가 만든 새 provider가 정직하게 `rank: null`을 반환하면서 처음으로 이 코드 경로가 실행됐다.
- **fix**: `src/data/providers/screener.js` 재작성 — `httpClient.requestJson('./public-data/screener.json')`으로 직접 fetch, 7일 초과 staleness gate(legacy `_aioApplyServerScreener`와 동일 정책) 적용, `score`/`rank`/`sector`/`name`은 `screener.json`에 없는 필드이므로 legacy의 `_aioComputeFactorRanks` 랭킹 산식을 추측·복제하지 않고 명시적으로 null 유지(R352). `src/data/normalize/screener.js`의 `rank`/`score`를 파일에 이미 있던 `finite()` 헬퍼로 통일해 null→0 오염을 제거하고 price/rsi/ret1m/ret3m/ret6m 필드를 보존하도록 확장. `src/data/orchestrators/screener.js`를 async로 전환(fetch가 진짜 비동기가 됐으므로). `bootstrap.js`의 screener provider 배선을 `read: legacy.readScreener` → `httpClient`로 교체(additive — legacy의 자체 fetch·`SCREENER_DB` 병합·`legacy.readScreener` 자체는 삭제하지 않음, native screener 렌더가 아직 이 slice를 전혀 소비하지 않아 legacy 삭제는 이번 배치 스코프 밖).
- **violated_rule**: F-01~F-03류(미실측 완료 선언), P715 반복 클래스(`Number.isFinite(Number(...))` null→0), R352(랭킹 산식은 추측 복제 금지 — null로 정직하게 유지).
- **prevention**: "X가 closed/adopted됐다"는 서술은 재진입 세션마다 grep으로 재확인한다(이번에 실행계획 368행에 취소선 없이 정정 각주를 추가). smoke-test 픽스처만 거친 normalize 함수가 실 데이터 경로에 처음 연결될 때는 null/undefined/0 경계값을 반드시 별도로 넣어 재검증한다 — "테스트를 통과했다"가 "실 데이터로 검증했다"를 의미하지 않는다.
- **verification**: `ci-architecture-browser-check.mjs`의 실 상태 덤프로 수정 전(`rank:0` 오염 재현) → 수정 후(`rank:null`, `rowCount:846`, `rsi`/`ret1m`/`ret3m`/`ret6m` 실값 확인) 양쪽을 직접 캡처. §8.1 핵심 12개 + ci-domain-parity-check + ci-retirement-contract + ci-portfolio-vault-e2e + ci-boot-interaction + ci-ux-default-path + ci-knowledge-lint + ci-doc-currency 전부 PASS. headless 1098/1098.

## P748 - v53.16 - ARX-04 두 번째 슬라이스: entity(ticker) provider가 SEC 펀더멘털을 실 fetch — sentiment는 라이브 렌더 회귀 위험으로 보류
- **motivation**: P747(screener) 직후 사용자가 ARX-04를 다음 domain으로 확장하라고 지시했다. sentiment를 다음 대상으로 검토하던 중, screener/entity/themes는 RM-01이 native 렌더를 dataset-marker-only로 축소해 블러스트 반경이 0이었던 반면 **sentiment는 ARX-01로 이미 실제 라이브 렌더링 중**이라 데이터 소스 교체가 사용자 가시 회귀로 이어질 수 있음을 발견했다(VIX가 후보 artifact에 없고, F&G/PutCall/HY의 세밀한 provenance 라벨을 정확히 재현해야 함). 사용자에게 확인한 결과 entity(ticker/fundamental/options route)로 방향을 바꿨다 — screener와 동일하게 native 렌더 소비자가 0인 안전한 route다.
- **symptom/reproduction**: `src/data/providers/entity.js`는 `legacy.readEntity`(→ `root._fundAnalysisData`) projection만 사용했다. `root._fundAnalysisData`를 전수 grep한 결과 **`js/aio-chat.js`에서만 대입**되고 있었다 — AI 채팅이 티커 분석을 수행할 때만 채워지는 필드였고, 일반 페이지 탐색에서는 항상 `null`이었다(aio-data.js/aio-core.js 어디에도 대입 지점 없음). 즉 entity slice의 `.fundamentals`는 현재도 사실상 거의 항상 비어 있었다 — 실 fetch로 교체해도 "기존 동작을 깨는" 리스크가 없는, screener보다도 더 안전한 상황이었다.
- **root_cause**: 해당 없음(버그 수정 아님, ARX-04 신규 채택 — 이 항목은 발견·설계 근거 기록용).
- **fix**: `src/data/providers/entity.js` 재작성 — `httpClient.requestJson('./public-data/sec-fundamentals.json')`로 실 fetch(provider 수명 동안 1회 캐시, 동시 호출 시 같은 in-flight Promise 공유로 중복 fetch 방지), symbol로 조회해 `.fundamentals`를 채움. `id`/`quote`/`options`는 여전히 `legacy.readEntity` projection 유지(이번 슬라이스 범위 밖 — options는 AI 컨텍스트 수집 경로가 없어 legacy 자체도 드묾, quote는 라이브 시세 파이어호스라 별도 후속 과제). `src/data/orchestrators/entity.js`를 async로 전환. `bootstrap.js`의 entity provider 배선에 `httpClient` 추가.
- **violated_rule**: 해당 없음.
- **prevention**: ARX-04 domain 확장 순서를 정할 때 "native 렌더가 실제로 그 slice를 소비하는가"를 최우선 기준으로 삼는다(sentiment처럼 이미 라이브 렌더 중인 route는 데이터 소스 교체 자체가 사용자 가시 회귀 리스크). 후보 legacy 필드를 교체하기 전에 그 필드가 실제로 언제 채워지는지(대입 지점 전수 grep) 확인 — "필드가 존재한다"가 "항상 채워진다"를 의미하지 않는다(이번엔 반대로 유리하게 작용했지만, 반대 방향 오판도 가능했다).
- **verification**: 실 Chromium에서 `window._currentTickerId='A'`(SEC 데이터셋에 있는 심볼) 설정 후 `aio:pageShown` 발화 → `state.entity.fundamentals`에 revenue/netIncome/margin/pe 등 실값 확인. 커버되지 않는 심볼(`ZZZZNOTREAL`)은 `fundamentals:null`로 안전하게 폴백(크래시 없음) 확인. §8.1 핵심 12개(viewport FULL_INIT 68/68 포함) + ci-domain-parity-check + ci-retirement-contract + ci-portfolio-vault-e2e + ci-boot-interaction + ci-ux-default-path(3831/3831) + ci-knowledge-lint + ci-doc-currency 전부 PASS. headless 1098/1098. `ci-architecture-browser-check.mjs`(17-route 왕복) browserErrors 0.

## P749 - v53.16 - RM-03 계속: news 감성점수·리스크신호를 순수 도메인으로 추출 — Fable 어드바이저 검토 후 착수, 첫 시도에서 KST 사이클 fixture 시각 설계 결함을 스스로 발견·수정
- **motivation**: P748(entity) 이후 사용자가 "위험/복잡한 남은 작업에 대해 Fable에게 조언을 구하자"고 제안했다. `model: fable`로 general-purpose 에이전트를 read-only 어드바이저로 소환해 RM-03 잔여 7개 smoke-only 도메인 모델과 ARX-04 확장 방향을 평가받았다. Fable은 (1) sentiment ARX-04는 `market-snapshot.json`에 VIX/VIX3M이 실제로 존재함에도 세션이 이를 조사에서 놓쳤음을 지적했으나 — VIX9D/VIX6M 결측·신선도 강등·provenance 3원천 분열 때문에 결론(보류)은 그대로 유지된다고 확인했고, (2) RM-03 잔여 7개 중 news(`computeNewsSentimentScore`/`computeNewsRiskSignals`, `js/aio-data.js:12184`/`12219`)가 가장 쉽고 가치가 높다고 추천했다(trading-score의 입력이라 이미 간접 검증된 영역). 사용자가 이 추천을 승인해 착수했다.
- **symptom/reproduction**: 두 함수와 그 하위 헬퍼(`getSentimentFromText`·`filterByAge`·`filterByKst0800NewsCycle`→`_getBriefingWindowKST`, 전부 `js/aio-data.js`)를 전문 정독한 뒤 순수 함수로 옮겼다. 첫 골든 fixture 덤프에서 **자체 설계 결함을 발견**했다: `computeNewsRiskSignals`는 `filterByKst0800NewsCycle`(KST 08:00 앵커의 "완료된 직전 24시간" 창)로 필터링하는데, 초안 fixture의 `pubDate`를 `FIXED_NOW - 2h`로 설정해 그 창의 바깥(창은 대략 `[now-28h, now-4h)`)에 떨어져 있었다 — 결과적으로 geo/energy/credit/earnings 리스크 시나리오가 전부 빈 배열(`[]`)만 덤프됐다. `FIXED_NOW - 15h`로 재조정해 재덤프하니 geo(high/mid)·energy(high)·credit(high)·earnings(positive) 5개 분기가 실제로 트리거됨을 확인했다.
- **root_cause**: (1)~(2)는 버그가 아니라 어드바이저 자문의 정상 산출물(기록용). (3) fixture 설계 시 KST 08:00 앵커 창의 경계를 계산 없이 "대충 최근"으로 가정했다 — 골든 덤프 패턴은 "예측이 아니라 실측을 기록"하는 방식이라 이 결함이 파이프라인을 깨뜨리지는 않았지만(빈 배열도 유효한 실측치), 리스크 신호 분기에 대한 실질적 커버리지를 상실할 뻔했다.
- **fix**: `src/domain/news/scoring.js` 신설 — `classifyNewsTextStance`(bull/bear 키워드 스코어링)·`briefingWindowKST`·`computeNewsSentimentScore`·`computeNewsRiskSignals`를 순수 함수로 이관(`now`를 명시 매개변수로 받아 `Date.now()` 암묵 의존 제거). `js/aio-data.js`의 두 legacy 래퍼는 `newsCache` 폴백만 유지한 채 `window.AIO_ARCH`를 호출하도록 축소(P743/P745와 동일하게 `bootstrap.js` api 객체·`compatibility-facade.js` exposeArchitecture() 양쪽에 동시 등록). `scripts/dump-news-scoring-fixtures.mjs` 신설 — Playwright `addInitScript`로 브라우저의 `Date`를 고정 시각으로 오버라이드해 시간 의존 필터링을 재현 가능하게 만들고, 8개 시나리오(빈 목록·24h 초과 stale·강세·지정학+신용+에너지 복합 약세·실적시즌 긍정·중립 혼합·pubDate 결측·geo mid 경계)를 `git stash`로 추출 전 커밋 상태에서 덤프. `ci-domain-parity-check.mjs`에 실 parity 블록 추가(감성점수 7필드 + 리스크신호 배열 길이·필드별 대조).
- **violated_rule**: 해당 없음(자체 발견·자체 수정, 배포 전 커밋되지 않은 로컬 작업 중 확인됨).
- **prevention**: 시간창 기반 필터를 쓰는 golden fixture를 설계할 때는 창 경계를 직접 계산(또는 로그 출력)해 테스트 아이템의 타임스탬프가 의도한 창 안/밖에 확실히 들어가는지 먼저 확인한다 — "대충 최근/오래된"이라는 직관에 의존하지 않는다. cross-module 브릿지 함수는 bootstrap.js api 객체와 compatibility-facade.js exposeArchitecture() 양쪽에 같은 diff로 등록하는 절차를 3번째로 준수(P743/P745 패턴 고착).
- **verification**: `node scripts/dump-news-scoring-fixtures.mjs`(8 fixture, KST 창 안 타임스탬프로 재덤프 후 geo/energy/credit/earnings 신호 실트리거 확인) → `ci-domain-parity-check.mjs`(감성점수+리스크신호 8 fixture 전부 일치) PASS. §8.1 핵심 12개(viewport FULL_INIT 68/68) + ci-retirement-contract + ci-portfolio-vault-e2e + ci-boot-interaction + ci-ux-default-path(3831/3831) + ci-knowledge-lint + ci-doc-currency 전부 PASS. headless 1098/1098. `ci-architecture-browser-check.mjs` browserErrors 0.

## P750 - v53.16 - ARX-04/RM-06 재진입 계속: Fable 자문으로 orchestrator staleness race를 발견·수정하고, news ARX-04와 screener-ranking C2를 재평가했다
- **motivation**: 사용자가 "복잡하거나 위험성 있는 남은 작업은 Fable에게 자문 후 진행"을 다시 지시했다. `model: fable` read-only 어드바이저(general-purpose 에이전트)에게 (1) news ARX-04(실 fetch 전환) 설계, (2) P747/P748이 각각 미해결로 남긴 "in-flight fetch 도중 dispose 시 취소 로직 없음" 블로커의 실제 처리 방안, (3) market/macro/screener-ranking smoke-only 모델이 제품 결정 없이 착수 가능한지를 자문받았다.
- **symptom/reproduction**: Fable이 세 가지를 실측으로 정정·확인했다. (1) **news**: `public-data/data.json`의 `.news`(37건)는 legacy의 `_serverNewsBackstop`(`js/aio-data.js:5561~5564`, `_aioApplyNewsBackstop` `:6075~6081`)가 클라이언트 자체 다중소스 RSS 파이프라인이 **비었을 때만** 병합하는 서버 백스톱이며, 두 경로 모두 결국 같은 전역(`window._allNewsItems`)에 쓴다 — 즉 `src/data/providers/news.js`의 기존 `read()` 프로젝션이 이미 "그 시점 최선값"을 읽고 있어, screener/entity처럼 httpClient로 이 아티팩트를 직접 fetch해 "정본"으로 승격시키면 오히려 백스톱(37건, 서버측 큐레이션)이 클라이언트의 더 풍부한 라이브 다중소스 집계(대응 아티팩트 자체가 없음)를 밀어내는 역행이 된다고 지적했다. (2) **staleness race**: P747/P748이 "route dispose 시 fetch 취소"라고 적었던 블로커의 전제 자체가 배선과 다르다는 걸 짚었다 — `router.js`의 `dispose()`는 얇은 UI 페이지 모듈(fetch를 소유하지 않음)만 정리하고, 실제 `httpClient.requestJson()`은 provider/orchestrator가 소유하며 `bootstrap.js`가 **모든 route에 공통인** `aio:pageShown`/`aio:refresh:done`(`bootstrap.js:237-247`)에 배선한다 — 즉 route별 dispose와 무관하게 어느 페이지로 이동해도 orchestrator.sync()가 호출된다. 진짜 위험은 `screener.js` provider의 `readCurrent()`가 캐시 없이 매 호출마다 실 fetch한다는 것(entity의 `fundamentalsTablePromise` 메모이제이션과 대조) — 오래된 호출이 새 호출보다 늦게 resolve되면 최신 상태를 구 데이터로 덮어쓸 수 있다. (3) **C2**: `fetch-data.mjs:1173~1197`의 docstring을 근거로, 라이브 7팩터 vs 서버 4팩터 "불일치"가 실은 v51.91/P586에서 **의도적으로 결정**된 서브셋 검증(과거 시점 look-ahead bias·이력 데이터 부재로 size/value/quality 제외)이며 새 제품 결정이 필요한 사안이 아님을 재확인. 세션이 독립적으로 `COMP_W`(하드코딩 4개 가중치, `fetch-data.mjs:1195`)를 라이브 NEUTRAL 서브셋 재정규화값과 직접 계산 대조해 2026-07-21 기준 정확히 일치함도 확인했다(드리프트 없음, 단 하드코딩이라 향후 무통보 drift 위험은 남음 — P584/C1류).
- **root_cause**: (1)은 버그가 아니라 F-11류 계획 재확인(원 RM-06 문서의 "news 단일 아티팩트라 저위험" 메모가 그 아티팩트의 실제 위상—백스톱 vs 정본—을 검증하지 않은 채 낙관적으로 적힌 것). (2)는 실제 코드 결함이다: `createScreenerOrchestrator`/`createEntityOrchestrator`(`src/data/orchestrators/{screener,entity}.js`)의 `sync()`가 `await provider.readCurrent()` 뒤 무조건 `commands.setData(...)`를 호출해, 두 호출이 겹치면 resolve 순서가 아니라 각자의 네트워크 지연에 따라 최종 상태가 정해졌다(현재는 native screener/entity 렌더 소비자가 0이라 실사용자 영향은 없음 — RM-01 dataset-marker-only 상태). (3)은 CODE-MAP.md/handoff 문서가 "불일치"라는 부정확한 서술을 여러 세대에 걸쳐 재확인 없이 옮겨 다닌 결과(F-01급 미실측 서술의 문서 버전).
- **fix**: **news** — ARX-04 실 fetch 전환을 하지 않기로 결정하고 명시적 비착수로 기록(N/A, deferred TODO 아님) — `dataOwner: legacy` 유지, market-news/briefing의 실 renderer cutover(W3/ARX-06) 시점에 provenance 필드가 사용자 가시적으로 유용해지면 재검토. **staleness race** — `src/data/orchestrators/screener.js`·`entity.js`에 세대 카운터(generation counter) 가드 추가: `sync()`마다 `++generation`을 캡처해, resolve 시점에 자신이 여전히 최신 generation일 때만 `commands.setData(...)`를 호출(오래된 호출은 `null` 반환, 무시). `dispose()`를 신설해 영구적으로 이후 모든 resolve를 무시하도록 하고, `bootstrap.js`의 `stop()`(`:291` 부근)이 `syncScreener.dispose()`/`syncEntity.dispose()`를 호출하도록 배선. `src/platform/http.js`의 `signal: options.signal || controller.signal`(외부 signal 전달 시 내부 timeout-abort가 조용히 무력화되는 잠재 결함)은 Fable이 지적했으나 현재 아무 호출부도 `signal`을 넘기지 않아 휴면 상태 — 이번 배치에서 손대지 않고 QA-CHECKLIST에 후속 후보로만 기록. **C2** — CODE-MAP.md의 "라이브·서버 모델 불일치" 서술을 "의도적 서브셋 검증"으로 정정하고 `_aioFactorWeights`/`_aioComputeFactorRanks`/`_aioApplyServerScreener` 좌표를 재확인(15871/15947(export 16082)/15794 — 이번 세션의 `_getBriefingWindowKST` 삭제로 라인이 13줄 밀린 뒤 최종 재확인한 값, 1차 정정이 삭제보다 먼저 계산돼 있어 Fable이 재확인 중 stale 상태로 잡아냄).
- **violated_rule**: F-01~F-03류(미실측 서술의 반복), R352(orchestrator가 legacy와 다른 "승자 결정 없는 병렬 쓰기" 상태였던 것도 넓게 보면 단일 상태 원칙 위반).
- **prevention**: "N개 provider가 아직 httpClient를 안 쓴다"류의 ARX-04 확장 후보를 고를 때, 후보 아티팩트가 그 도메인의 **정본**인지 **폴백**인지부터 추적한다(fetch-data.mjs의 생성 의도 주석까지 읽을 것 — "additive/백스톱"이라는 단어가 있으면 그 아티팩트를 native의 승자로 승격시키지 않는다). "route dispose 시 취소" 같은 블로커 서술은 실제 배선(orchestrator가 route-scoped인지 app-scoped 이벤트에 물려 있는지)을 재확인한 뒤 구체화한다 — 막연한 "AbortController 필요"보다 정확한 원인(캐시 없음+동시성)을 겨냥한 수정이 더 작고 검증하기 쉬웠다. CODE-MAP 좌표를 세션 중 두 번 수정해야 했던 경우(사문 코드 삭제로 라인이 밀림) 마지막 코드 변경 이후에 좌표를 최종 재확인한다.
- **verification**: `node scripts/ci-esm-core-unit-check.mjs`에 신규 섹션(screener/entity orchestrator 각 2개 시나리오: 겹치는 호출에서 최신 결과만 반영, dispose 후 in-flight resolve 무시) 추가 — fake provider의 controllable deferred promise로 resolve 순서를 뒤집어 검증, PASS. §8.1 12개 전부 재실행 PASS(explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 카운터 1088/42/187/410 무변화 — orchestrator 변경은 DOM/global/storage/fetch-count에 영향 없는 순수 concurrency 로직). ci-domain-parity-check·ci-retirement-contract·ci-portfolio-vault-e2e(8/8)·ci-boot-interaction·ci-ux-default-path(3831/3831)·ci-doc-currency 전부 PASS. headless 1098/1098. `ci-architecture-browser-check.mjs`(17-route 왕복) browserErrors 0.

## P751 - v53.16 - `ci-knowledge-lint-check.mjs`가 git의 quoted-path 출력을 처리하지 못해 비-ASCII 파일명에서 크래시했다
- **motivation**: P750 작업 중 §8.1 확장 게이트를 전부 재실행하다가 `ci-knowledge-lint-check.mjs`가 처음으로 크래시하는 것을 발견(이전 세션들의 §8.1 실행 로그에는 이 게이트가 항상 PASS로만 기록돼 있었음 — 이 세션에서 처음 노출됨).
- **symptom/reproduction**: `ENOENT: no such file or directory, open 'C:\Projects\AIO\_context\"_context\ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19 - \353\263\265\354\202\254\353\263\270.md"'` — 경로가 `_context\`로 두 번 시작하고 중간에 리터럴 큰따옴표(`"`)와 8진 이스케이프(한글 바이트열)가 섞여 있다.
- **root_cause**: 세션 시작 전부터 존재하던 미추적 파일 `_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19 - 복사본.md`(공백+한글 파일명)가 원인. 스크립트 32행이 `git ls-files --cached --others --exclude-standard`(`-z` 없이)를 실행하는데, git의 기본 `core.quotepath` 동작은 공백·비-ASCII 바이트가 포함된 경로를 통째로 큰따옴표로 감싸고 비-ASCII 바이트를 8진 이스케이프한다(`"_context/… - \353\263\265\354\202\254\353\263\270.md"`). 스크립트의 `.map((p) => p.replace(/^_context\//, ''))`는 문자열이 `_context/`로 **바로** 시작한다고 가정하는데, 실제로는 큰따옴표가 먼저 오므로(`"_context/...`) 정규식이 매치되지 않아 원본 문자열이 그대로 남았고, 이후 Pass C의 `join('_context', file)`이 `_context/`를 또 붙여 존재하지 않는 이중 경로가 만들어져 `readFileSync`가 던졌다.
- **fix**: `execSync` 호출을 `git ls-files -z ...`(NUL 구분, 인용·이스케이프 완전히 없음)로 바꾸고 `.split('\n')` → `.split('\0')`로 교체. 재실행 결과 크래시 대신 정상적인 lint 실패로 전환됨(아래 verification) — 즉 이 수정은 "예외를 못 잡던 것을 잡게" 한 게 아니라 **경로 처리 자체가 틀려서 있지도 않은 파일을 열려고 했던 것**을 고쳤다.
- **violated_rule**: 해당 없음(신규 발견 — 이 스크립트는 R290/P653에서 도입된 뒤 비-ASCII/공백 미추적 파일이 `_context/`에 놓인 적이 없어 이 경로가 한 번도 실행되지 않았던 것으로 추정).
- **prevention**: `_context/` 등 `.md` 파일을 열거하는 스크립트에서 `git ls-files`를 쓸 때는 항상 `-z`를 기본값으로 삼는다(공백·비-ASCII 파일명은 이 리포에서 실제로 발생 가능 — 이번 파일명 자체가 예시). 문자열 접두사를 가정하는 `.replace(/^prefix\//, '')` 패턴은 그 가정이 깨질 수 있는 입력(quoting 등)을 항상 의심한다.
- **verification**: 수정 전 크래시 재현(스택트레이스 확보) → 수정 후 `node scripts/ci-knowledge-lint-check.mjs` 실행 결과 크래시 없이 "every versioned or newly-created _context/*.md file is listed in INDEX.md's document table: ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19 - 복사본.md" 단일 findings로 정상 종료 — 이 finding 자체(중복 파일을 INDEX.md에 올릴지, 삭제할지)는 사용자 소유 파일이라 별도로 QA-CHECKLIST에 미해결로 기록하고 이 P-entry에서는 스크립트 크래시만 고쳤다.

## P752 - v53.16 - P746 breadth-stage-summary를 Fable 2차 자문으로 해소: "Weinstein Stage"가 아니라 시장 참여도 분류기를 신설했다
- **motivation**: 사용자가 P746의 두 미해결 표면 중 `mtf-verdict-text`는 "같은 라이브 데이터로 배선"(구현 완료, 이 문서 상단 언급), `breadth-stage-summary`는 "breadth 고유의 시장폭 기반 판정으로 재설계"(SPY 재사용 아님)를 택했다. 후자는 실제 금융 도메인 설계가 필요해 `model: fable` read-only 어드바이저를 2차로 소환했다.
- **symptom/reproduction**: 착수 전 자체 조사에서 breadth5sma/20sma/50sma는 매일 갱신되는 "오늘 값"과 최대 1스텝 delta(`js/aio-data.js:_aioGetPrevDeltaRef`, localStorage 단일 슬롯, 브라우저별·일별 초기화)뿐이고, `public-data/history.json`에는 breadth 필드 자체가 없어 다일 이력이 전혀 없다는 제약을 확인했다. Fable에게 이 제약을 근거로 (1) "Stage" 라벨이 정직한지, (2) 오늘 스냅샷만으로 만들 수 있는 정직한 분류가 무엇인지, (3) 이번 세션 범위인지 자문받았다. Fable은 독립적으로 `architecture/reconciliation-status.json`이 이미 `categoryId: "breadth-history", status: "BLOCKED"`로 이 정확한 갭을 기록 중임을 찾아 근거를 보강했고, `updateWeinsteinStage`의 R340/P712 교체 사유(구현이 정적 시장폭을 30주 추세의 대리지표로 쓰다가 교체됐다는 그 코드 자체의 주석)를 "같은 실수를 반복하지 말라"는 직접 선례로 인용했다. 결론: **"Stage" 라벨은 부정직하다** — 추세국면 개념을 지금 데이터로 만들 수 없다. 레벨(broad/neutral/narrow, breadth20sma·50sma 임계) × 방향(rising/falling/flat, 1스텝 delta 있을 때만, ±2pp 불감대) 2축 분류를 권고했고, 기존 `classifyMovingAverageStructure`(단일 심볼 MA 스택, 입력 성격이 다름)나 `breadth-signal-val`의 RSP/SPY 비율 로직 재사용은 명시적으로 반대했다(사용자가 이미 거부한 "값싼 재사용" 옵션과 같은 실수).
- **root_cause**: 버그가 아니라 신규 설계 자문(기록용). 부수적으로 `updateBreadthBars()`(js/aio-ui.js)의 `!currentBreadth.available` 분기가 이미 `breadth-stage-summary`용 fail-closed 리셋 텍스트를 쓰고 있었던 반면(코드 존재), 성공 분기(`available===true`)에는 대응 write가 애초부터 없었다는 것도 재확인했다 — R340/P712가 구 복합점수 함수를 교체하며 새 writer를 추가하지 않은 것이 이 표면이 P745 삭제 이전부터 이미 죽어 있었던 진짜 원인(P746의 결론과 일치).
- **fix**: `src/domain/market/breadth.js` 신설 — `classifyBreadthParticipation({sma20, sma50, sma20Delta, sma5Delta})`, 순수·버전드(`breadth-participation.v1`)·`Object.freeze`. level 임계: broad(20≥60 & 50≥55) / narrow(20≤35 또는 20<50 & 50<45) / neutral. direction: sma20Delta 우선, 없으면 sma5Delta로 대체, ±2pp 불감대, delta 자체가 없으면 `null`(조작 금지). `bootstrap.js` api 객체·`compatibility-facade.js` exposeArchitecture() 양쪽에 동시 등록(P743 배선 버그 재발 방지 절차 4번째 준수). `js/aio-ui.js`의 `updateBreadthBars()` 성공 분기에 writer 추가 — `_aioGetPrevDeltaRef()`(기존 함수, 재사용)로 delta를 구해 분류기에 전달하고, level→한국어 라벨/색상(legacy 소관, R352 경계 유지: 도메인은 enum만, 라벨·색은 legacy)을 매핑. **`index.html`의 섹션 라벨 자체를 "Weinstein Stage" → "시장 참여도"로 변경**(Fable 권고 1번 반영) — 정적 placeholder도 대응 문구로 교체. `breadth-diag-text`의 "Weinstein Stage… 판정을 보류합니다" 문장도 더 이상 사실이 아니므로 정정. 부수적으로 fail-closed 리셋 경로를 `.innerHTML=`에서 `.textContent=`로 바꿔 htmlSinks가 410→409로 줄었다(요청 대상은 아니었으나 같은 파일 같은 줄을 만지는 김에 안전한 쪽으로).
- **violated_rule**: 해당 없음(신규 기능).
- **prevention**: "N번 배지가 비어있다"류 표면을 채울 때는 라벨이 암시하는 개념(여기서는 "Stage"=추세국면)이 실제로 가진 데이터로 지지되는지부터 확인한다 — 데이터가 못 미치면 라벨을 낮추는 것이 값을 지어내는 것보다 낫다. UI 텍스트(`breadthDiagText` 같은 보조 설명문)는 인접 표면의 상태 변화와 같은 diff에서 동기화한다 — 위젯만 고치고 그 위젯을 설명하는 옆 문장을 안 고치면 새로운 불일치가 생긴다.
- **verification**: `node scripts/ci-esm-core-unit-check.mjs`에 `classifyBreadthParticipation` 7개 시나리오(broad+rising/narrow+falling/narrow 콤보 분기/neutral+flat/delta 없음→direction null/sma5Delta 대체/필수입력 결측→fail-closed) 손수 작성 검증 추가, PASS. 실 Chromium 애드훅 검증(임시 스크립트, 실행 후 삭제) — `window._breadthLiveData`·`localStorage.aio_delta_prev`를 4개 시나리오(미수신/broad+rising/narrow+falling/neutral-무delta)로 직접 주입 후 `updateBreadthBars()` 호출, `breadth-stage-summary`의 텍스트·색상·`breadth-diag-text` 문장 전부 기대값과 일치 확인. §8.1 12개 전부 PASS(explicitWindowWrites/directFetch/directStorage 3개 카운터 1088/42/187 무변화, htmlSinks 410→409 — `architecture/baseline.json` 갱신). `sw.js` precache 목록에 `src/domain/market/breadth.js` 누락으로 첫 게이트 실행이 실패했던 것을 발견·수정(파일 추가 시 sw.js 동시 갱신 절차를 이번에 처음 빠뜨렸다가 게이트가 즉시 잡음). 도메인 경계 정적 검사(`ci-architecture-contract-check.mjs`의 `forbiddenByLayer.domain`)가 파일 내 주석에 있던 리터럴 "localStorage" 문자열까지 매치해 오탐을 낸 것도 발견 — 코드가 아니라 주석이었지만 정규식이 코드/주석을 구분하지 않으므로 주석 표현을 "device-persisted"로 재작성해 해소(회귀 아님, 순수 문구 조정). ci-domain-parity-check·ci-retirement-contract·ci-portfolio-vault-e2e(8/8)·ci-boot-interaction·ci-ux-default-path(3831/3831)·ci-doc-currency 전부 PASS. headless 1098/1098. `ci-architecture-browser-check.mjs`(17-route 왕복) browserErrors 0.

## P753 - v53.17 - `ci-architecture-browser-check.mjs`의 17-route 왕복 게이트가 라우팅과 무관한 15초 부팅 지연 타이머를 "누수"로 오탐했다
- **motivation**: `/deploy` 진행 중 origin/main(자동 데이터 갱신 29커밋)을 병합한 뒤 §8.1 전체를 재실행하다가, 병합 직전까지 계속 PASS였던 `ci-architecture-browser-check.mjs`가 처음으로 실패했다. push 전 마지막 검증 단계라 원인을 확정하지 않고 넘어가지 않기로 했다.
- **symptom/reproduction**: `Error: legacy timer registry grew between lap 1 and lap 2 of the full route round trip: 11 -> 12` — 3회 연속 재실행해도 매번 동일하게 재현(비결정적 flake 아님). 게이트 스크립트를 그대로 복사해 `window._aioTimerRegistry`의 실제 키 목록을 lap1/lap2 시점에 로그로 남기는 애드훅 스크립트(임시, 실행 후 삭제)로 대조한 결과 새로 나타난 키는 `dataStatus` 하나였다.
- **root_cause**: `js/aio-data.js:6630`의 `setTimeout(() => { startDataScheduler(); }, 15000)` — 부팅 후 15초 뒤 1회만 실행되는, 라우트 방문과 완전히 무관한 지연 초기화다. `startDataScheduler()` 내부(`js/aio-data.js:4295`)가 `_aioRegisterTimer('dataStatus', ...)`로 이 타이머 레지스트리에 이름을 등록한다. 게이트는 "17-route 1바퀴(lap1)를 다 돌면 그 route들이 등록하는 모든 타이머가 이미 등록됐을 것"을 전제로 lap1/lap2 신규 키 유무만으로 누수를 판정하는데, `dataStatus`는 어떤 route에도 묶여 있지 않고 순수하게 부팅 후 경과 시간(15초)에만 의존한다. 이번 세션의 병합으로 `public-data/*.json`이 커지고(자동 갱신 29건 누적) 매 라운드트립의 실측 왕복 시간이 미세하게 늘어나면서, 우연히 15초 경계가 lap1↔lap2 사이에 걸치는 타이밍이 된 것으로 판단된다(이 값 자체는 병합 전에도 잠재해 있던 레이스였고, 병합이 원인이 아니라 병합이 타이밍을 바꿔 노출시킨 것).
- **fix**: `ROUTE_IDS_FOR_ROUNDTRIP` 왕복을 시작하기 전에 `page.waitForFunction(() => window._aioTimerRegistry && 'dataStatus' in window._aioTimerRegistry, { timeout: 20000 })`를 추가 — lap1 측정 자체가 이미 "부팅이 완전히 안정된 이후" 시점이 되도록 보장한다. 게이트를 느슨하게 만든 게 아니라(카운터 비교 로직·임계값은 그대로), 애초에 "안정 상태 vs 안정 상태"를 비교하려던 의도를 실제로 충족시키는 수정이다.
- **violated_rule**: 해당 없음(신규 발견 — 이 정확한 타이밍 경계에 걸린 것은 이번이 처음으로 보인다).
- **prevention**: 왕복/누수 검증 게이트에서 "N바퀴 다 돌면 안정된다"고 가정하는 리소스가 있으면, 그 리소스가 정말 라우트에 묶여 있는지 아니면 부팅 후 고정 지연(`setTimeout(fn, 상수)`)에 묶여 있는지 코드에서 직접 확인한다 — 후자라면 왕복 시작 전에 그 리소스의 존재를 명시적으로 기다려야 왕복 시간의 자연스러운 변동(데이터 크기, 머신 성능 등)에 흔들리지 않는다.
- **verification**: 수정 전 3회 연속 재현 → 수정 후 3회 연속 PASS. §8.1 핵심 12개 전부 재실행 PASS, headless 1098/1098.

## P754 - v53.17 - Data freshness watchdog의 R290 라이브 불변식 스텝이 무관한 fast-plane 실패 뒤에서 매번 조용히 skip되고 있었다
- **motivation**: 사용자가 v53.17 배포 직후 "Data freshness watchdog" 실패 원인을 확인해달라고 요청. 표면적 로그(`operator_required: AIO_FAST_QUOTES_URL is not configured`)만 보고 "기존에 알려진 항목"이라 답했던 것을 `gh run view --json jobs`로 스텝별로 재확인.
- **symptom/reproduction**: 8개 스텝 중 "Check public-data freshness/canonical market snapshot/operations status/22-category reconciliation/LIVE site freshness"는 전부 success, "Check independent fast quote plane"만 failure(예상대로), 그런데 바로 다음 "Check LIVE standing invariants (R290)"이 **skipped**였다.
- **root_cause**: `.github/workflows/data-watchdog.yml`에 `if:` 조건이 어디에도 없어 GHA 기본 동작(앞 스텝 실패 시 뒤 스텝 자동 skip)이 그대로 적용됐다. R290 스텝 자체의 헤더 주석은 "다른 체크와 무관하게, 커밋이 ci.yml을 안 돌려도 매 스케줄마다 독립적으로 검증돼야 한다"고 명시하는데, fast-plane 스텝이 `AIO_FAST_QUOTES_URL` 미설정으로 매 스케줄마다 실패하는 한(운영자 결정 대기, 이 문제 자체는 아님) R290은 단 한 번도 실제로 실행되지 않고 있었다 — 배포 직후 캐시버스터/버전 정합성처럼 R290이 잡기로 설계된 회귀가 있어도 감지되지 않는 사각지대였다.
- **fix**: R290 스텝에 `if: ${{ !cancelled() }}`를 추가 — job이 취소되지 않는 한 앞 스텝 성공/실패와 무관하게 항상 실행되도록 복원. fast-plane 스텝 자체의 실패 판정(운영자 결정 대기 상태 보고)은 그대로 유지, R290이 검증하는 내용도 변경 없음 — 실행 여부만 고쳤다. 수동 `gh workflow run` 트리거로 R290이 실제로 success 표시되는 것을 실행 로그에서 확인.
- **violated_rule**: 해당 없음(신규 발견).
- **prevention**: 여러 스텝을 가진 워크플로에 "이 스텝은 앞 스텝과 무관하게 항상 돌아야 한다"는 주석이 있으면, 그 주석이 실제 `if:` 조건으로 뒷받침되는지 점검한다 — 주석만으로는 GHA의 기본 skip 동작을 막지 못한다. 표면적 실패 로그 한 줄만 보고 "기존에 알려진 항목"이라 답하기 전에, 사용자가 명시적으로 원인을 다시 물으면 스텝별 분해까지 확인한다.
- **verification**: 수정 전/후 모두 수동 트리거로 실제 실행 확인 — 수정 전 R290 skipped, 수정 후 R290 success(fast-plane 스텝은 여전히 예상대로 failure). §8.1 관련 없음(워크플로 파일만 변경).

## P755~P758 - v53.17 - RM-03 계속: `ci-domain-parity-check.mjs`의 잔여 smoke-only 토이 4종 중 3종을 실 legacy 산식으로 교체, 1종은 완전 퇴역
- **motivation**: 사용자가 "남은 작업 순차적으로 계속 진행"을 지시. Explore 에이전트에게 남은 5개 smoke-only 도메인 모델(market/macro/portfolio/technical/news-claim) 각각에 실제 대응하는 legacy 산식이 있는지, 있다면 그 산식이 실제로 다른 곳에서 소비되고 있는지 전수 조사를 위임했다.
- **symptom/reproduction(조사 결과)**: (1) `deriveNewsClaim`(news/claims.js) — legacy 산식 자체가 없고 실 호출처도 0곳, 이미 이전 세션에서 "대상 아님"으로 명시 이월됐던 것. (2) `deriveTechnicalModel`(technical/indicators.js) — legacy 산식 없이 독립 발명된 MA20/50 토이인데, **`src/data/normalize/analysis.js:6`에 실제로 라이브 배선돼 있었다**(다른 4개 토이와 달리 유일하게 실 소비처가 있는 경우). (3) `deriveMacroModel`(macro/model.js) — 실 호출처 0곳, 그러나 `js/aio-core.js:20746` `window.AIO.getUsTreasuryCurveEvidence()`라는 진짜 2s10s 수익률곡선 산식이 별도로 존재(다중소스 폴백 체인 포함). (4) `derivePortfolioRisk`(portfolio/risk.js) — 실 호출처 0곳, 20%/40% 구간이라는 발명된 밴드였는데 `js/aio-core.js:19628` `calcPortfolioTechnicalRisk`의 실제 10%/15%/25% concentrationPenalty 티어와 무관했다.
- **root_cause**: 토이 4종 모두 F-04가 지목한 "항진 스모크 테스트"였고, 그중 3종(technical/macro/portfolio)은 대응하는 진짜 legacy 산식이 있었음에도 그 산식과 무관하게 독자적으로 발명돼 있었다 — 추출이 아니라 창작이었다.
- **fix**: (1) `deriveNewsClaim` 삭제(순수 퇴역, R352). (2) `src/domain/technical/stage.js`에 `deriveTechnicalStageFromOhlcv` 신설 — `_calcSMA`(js/aio-core.js:18561)를 충실히 재구현한 SMA 스택 계산 + 이미 실 parity 검증된 `classifyMovingAverageStructure`를 합성(legacy `calcTechnicalSnapshot`에서 통째로 추출한 것은 아님 — 그 함수는 ATR/RSI/MACD/볼린저/VCP/피보나치까지 포괄하는 훨씬 큰 함수라 SMA 스택 부분만 분리). `normalizeAnalysis`가 이 함수를 쓰도록 재배선. 실 Chromium에서 AAPL 합성 OHLCV로 `state.analysis.technical`이 올바르게 채워지는 것 확인(symbol/status/trend/stageEstimate 전부 기대값). (3) `src/domain/macro/treasury-curve.js`에 `deriveTreasuryCurveEvidence` 신설 — `getUsTreasuryCurveEvidence`를 골든 fixture 8개(dump-macro-curve-fixtures.mjs)로 실 parity 추출, legacy는 입력 수집 후 브릿지 호출하는 얇은 래퍼로 축소. 필드별 폴백 우선순위(twoY는 snapshot 폴백이 아예 없음 등)와 `source`/`available` 판정이 모든 필드 해석 경로를 인식하지 않는다는 두 가지 비직관적 legacy 동작을 그대로 보존(정리하지 않음). (4) `src/domain/portfolio/concentration.js`에 `deriveConcentrationRisk`/`concentrationPenaltyForWeight` 신설 — `calcPortfolioTechnicalRisk`/`calcPositionTechnicalRisk`의 concentration 슬라이스만 골든 fixture 8개(dump-portfolio-concentration-fixtures.mjs)로 실 parity 추출(sellPressure/heatScore 전체는 범위 밖 — 별도 규모의 작업). legacy의 concentrationPenalty 티어 삼항식 한 줄을 브릿지 호출로 교체. 4개 파일 전부 `bootstrap.js`·`compatibility-facade.js` 양쪽에 동시 등록(P743 이후 5번째 준수).
- **violated_rule**: 해당 없음(신규 추출/퇴역).
- **prevention**: "toy 모델을 실 추출로 바꿀지 퇴역시킬지" 판단은 "실 호출처가 있는가"와 "대응 legacy 산식이 존재하는가"를 **독립적으로** 확인해야 한다 — 이번에 technical만 유일하게 둘 다 "그렇다"였고 나머지는 조합이 갈렸다(산식 있음+호출처 없음 2건, 산식 없음+호출처 없음 1건). 하나만 확인하고 판단하면 틀린다.
- **verification**: 각 추출마다 골든 fixture parity(`ci-domain-parity-check.mjs`) + rewiring 대상은 재작성 전/후 실 브라우저 덤프 비교(모든 필드 100% 일치) + §8.1 핵심 게이트 + headless 1098/1098 + `ci-architecture-browser-check.mjs`(17-route 왕복) browserErrors 0 — 4개 추출/퇴역 전부 동일 절차로 확인. `ci-architecture-contract-check.mjs`의 도메인 경계 정적 검사가 주석 내 리터럴 "window."/"document." 문자열까지 매치하는 것도 재확인(breadth.js 때와 같은 패턴, 문구만 재조정).

## P768 - v53.17 - legacy screener fetch and factor projection duplicated the native artifact owner
- **motivation**: P766 completed the canonical row-read migration and P767 repaired the native readiness/data-pipeline contract, so the remaining runtime duplicate was safe to remove.
- **symptom/reproduction**: Native `src/data/providers/screener.js` fetched and ranked the published artifact, while `_aioLoadServerData` fetched `public-data/screener.json` again and `_aioApplyServerScreener` bulk-mutated `SCREENER_DB`; freshness, breadth, and quant-audit globals could therefore be sourced from a second pipeline.
- **root_cause**: ARX-10 initially preserved the legacy fetch/projection as an additive compatibility path. After native route cutover, its remaining responsibility was metadata/breadth compatibility, but no explicit bridge existed.
- **fix**: Added `getScreenerState()` and `aio:nativeScreenerReady` to the bootstrap API, preserved artifact breadth in native provider metadata, added `_aioApplyNativeScreenerState()` as a metadata/breadth-only bridge, removed the duplicate legacy fetch and `_aioApplyServerScreener` factor-row projection, and updated runtime/data-pipeline gates to enforce the single-fetch contract.
- **violated_rule**: R352/R3/P768 — native data ownership must remove duplicate runtime producers while retaining only documented identity/memo compatibility boundaries.
- **prevention**: `ci-runtime-contract-check.mjs` fails if the legacy artifact fetch/projection returns; `ci-data-pipeline-contract-check.mjs` checks the native provider’s versioned Kalman/backtest contract; browser/headless gates exercise the native state bridge.
- **verification**: `node --check` for changed modules, runtime/data-pipeline/ESM/domain/architecture contracts PASS; architecture counters `1068/41/186/399`; Chromium 17-route round-trip `routeRoundTrip:true`, `browserErrors:0`; headless `1098/1098 PASS`; doc currency and `git diff --check` PASS.

## P767 - v53.17 - the data-pipeline gate still described a retired screener readiness surface
- **motivation**: The P766 full-gate run exposed a contract regression immediately after P765 removed the legacy readiness renderer.
- **symptom/reproduction**: `ci-data-pipeline-contract-check.mjs` failed its backtest disclosure and quant-readiness assertions because they searched the retired `js/aio-data.js` surface and an obsolete Korean label.
- **root_cause**: The native screener renderer/audit had become the owner, but the data-pipeline gate was not migrated with the route cutover.
- **fix**: Added native backtest disclosure for excluded factors/fixed regime, exposed an explicit fail-closed quant-readiness disclosure, and updated the gate to inspect `src/ui/pages/screener.js` plus the current audit contract.
- **violated_rule**: R352/R3 — a gate must verify the current owner and cannot preserve retired-surface assumptions.
- **prevention**: Route cutovers must update data-pipeline contracts in the same packet; native owner source files are now read directly by the disclosure check.
- **verification**: `node --check` for changed JS, `ci-data-pipeline-contract-check.mjs`, and `ci-doc-currency-check.mjs` PASS.

## P766 - v53.17 - non-route screener queries still bypassed the canonical native rows
- **motivation**: P764 established `AIO_ARCH.getScreenerRows()` for non-route consumers, but the final query and verification helpers still had direct `SCREENER_DB` reads.
- **symptom/reproduction**: A refreshed native screener state could differ from the rows used by natural-language screening, Maker/Checker verification, sector lookup, and recent-recommendation extraction.
- **root_cause**: The route cutover migrated the main readers but missed four helper bodies and the legacy facade's `readScreener` path.
- **fix**: Routed those consumers through `_aioGetCanonicalScreenerRows()` and made the facade prefer `AIO_ARCH.getScreenerRows()`, retaining the static DB only as the documented compatibility fallback/enrichment source.
- **violated_rule**: R352/R3 — a compatibility boundary is not complete while downstream consumers can bypass it.
- **prevention**: `ci-runtime-contract-check.mjs` now scopes the four helper bodies and fails if they reintroduce direct `SCREENER_DB` reads.
- **verification**: `node --check js/aio-data.js`, `ci-runtime-contract-check.mjs`, and `ci-esm-core-unit-check.mjs` PASS; full architecture/browser/headless gates are required before this packet is marked complete.

## P765 - v53.17 - native screener readiness node still had a legacy DOM writer after ARX-10
- **motivation**: Promoting `route-owners.json` to the measured native renderer count of 3 (guide/sentiment/screener) correctly activated the AG-DOM-WRITER check for screener.
- **symptom/reproduction**: `node scripts/ci-architecture-contract-check.mjs` failed with `native/legacy id intersection is not empty: screener-readiness-note (screener.js)`. The native page wrote the readiness note with `textContent`, while `_aioRenderQuantReadiness` in `js/aio-data.js` wrote the same node with `innerHTML` after the legacy screener fetch.
- **root_cause**: ARX-10 retired the visible screener table/action writers but missed this deferred readiness writer and its call site; the stale path stayed hidden while the route ledger still reported only two native renderers.
- **fix**: Removed the legacy readiness render function and invocation, and added `_aioRenderQuantReadiness` to `screener.legacySymbolsMustBeAbsent` so reintroduction is blocked by the architecture contract.
- **violated_rule**: R352/R3 (native ownership must move with competing writers removed and recorded).
- **prevention**: Every native renderer promotion must run AG-DOM-WRITER with the measured renderer count and inventory deferred compatibility calls, not only named table/action helpers.
- **verification**: AG-DOM-WRITER/architecture contract PASS (`1069/42/186/399`, screener dispatch p95 `0.069ms`), runtime/domain/retirement contracts PASS, 17-route browser round-trip PASS with `browserErrors: 0`, and headless `1098/1098 PASS`.

## P764 - v53.17 - ARX-16 screener compatibility consumers bypassed the canonical native read boundary
- **motivation**: The ARX-10 route cutover made native screener state authoritative for the visible route, but portfolio, ticker, fundamental, chat, watchlist, and audit helpers still read `SCREENER_DB` directly.
- **symptom/reproduction**: A later artifact refresh could update native rows while non-route summaries continued reading the legacy projection, creating two observable read paths.
- **root_cause**: The route cutover had no stable compatibility accessor for non-route consumers; deleting the legacy database was unsafe because curated memo and identity fields remain required by the data pipeline.
- **fix**: Added `AIO_ARCH.getScreenerRows()` and `_aioGetCanonicalScreenerRows()`. Migrated non-route consumers to the boundary; legacy rows only fill fields absent from the native artifact, while the legacy DB remains an explicit identity/memo and pipeline boundary.
- **violated_rule**: R352 (single executable read owner and explicit compatibility boundary).
- **prevention**: Every route cutover must inventory non-route consumers and provide a canonical read API before legacy projections are retired.
- **verification**: `ci-runtime-contract-check`, architecture counters 1071/42/186/400, syntax checks, browser round-trip, and headless 1098/1098 PASS.

## P763 - v53.17 - factor-weight regime math remained embedded in the legacy wrapper
- **motivation**: P759 extracted factor ranking but left deterministic regime/profile weight math in `_aioFactorWeights`, so native and compatibility paths did not share one pure owner.
- **symptom/reproduction**: Native ranking needed the legacy wrapper to resolve neutral/risk-on/risk-off weights even though the resolver itself had no browser side effects.
- **root_cause**: Profile storage lookup and deterministic weight calculation were coupled in one legacy function.
- **fix**: Added `src/domain/screener/factor-weights.js`; native bootstrap calls the pure resolver directly, while the legacy wrapper only resolves profile/storage inputs and bridges the result.
- **violated_rule**: R352 (deterministic model math must have one executable owner).
- **prevention**: Extract pure regime/profile math before migrating any consumer; compatibility wrappers may translate inputs but may not retain formulas.
- **verification**: ESM unit, domain parity, architecture/runtime, browser, and headless gates PASS.

## P762 - v53.17 - analysis signal still depended on the retired three-input toy model
- **motivation**: ARX-11 required the visible signal envelope to be derived from the canonical Trading Score rather than a disconnected VIX/VVIX/DXY toy mapping.
- **symptom/reproduction**: `normalizeAnalysis` imported `deriveSignalDecision` from `src/domain/signal/decision.js`, while the real Trading Score inputs were collected only by the legacy runtime.
- **root_cause**: Compatibility input collection and native analysis normalization were not threaded together.
- **fix**: `readAnalysis` now exposes `tradingScoreInputs`; normalization computes the canonical Trading Score and maps it with `deriveSignalDecisionFromTradingScore`. The retired decision module and service-worker asset were removed.
- **violated_rule**: R352/R3.
- **prevention**: Signal changes require a model-version assertion and a native-to-legacy input lineage check before retirement.
- **verification**: signal unit/parity, browser route round-trip with browserErrors 0, and headless 1098/1098 PASS.

## P761 - v53.17 - market/screener parity smoke modules had no executable product owner
- **motivation**: RM-03 parity still preserved `market/model.js` and `screener/ranking.js` even though both had no runtime callers.
- **symptom/reproduction**: Only the parity script imported the modules; the live market snapshot and factor-rank pipeline did not.
- **root_cause**: Scaffold smoke models were being mistaken for product parity evidence.
- **fix**: Deleted both modules, removed their service-worker assets and fake same-fixture parity block, and retained only executable canonical owners.
- **violated_rule**: R352/R3.
- **prevention**: A domain smoke row must list a live caller and a legacy formula inventory before it is retained.
- **verification**: symbol search, domain parity, ESM, retirement, architecture, browser, and headless gates PASS.

## P760 - v53.17 - ARX-10 native screener cutover left a legacy test/DOM ownership boundary stale
- **motivation**: P759 extracted factor ranking; the native screener could now consume canonical state, so the route’s legacy DOM writers had to be retired before ownership could be promoted.
- **symptom/reproduction**: route-owners still measured screener as legacy; legacy render/helper functions and T822 referenced the removed backtest/action surface. The first headless rerun exposed T822 as 1097/1098.
- **root_cause**: native state/renderer work and legacy retirement/test migration were staged separately; ownership ledger and a browser test still described the pre-cutover surface.
- **fix**: native provider joins artifact+universe, orchestrator ranks rows, native renderer owns the complete 22-column screen and controls, legacy DOM writers/helpers were deleted, compatibility profile/watchlist/SCREENER_DB boundaries documented, T822/runtime contract updated.
- **violated_rule**: R352/R3 (executable ownership and postmortem record must move with migration).
- **prevention**: every route cutover must update renderer/data owner ledgers, delete legacy writer/action symbols, migrate test expectations, and rerun browser + headless gates before status promotion.
- **verification**: architecture counters 1071/42/186/400; architecture/retirement/operations/runtime/domain parity/ESM unit passed; browser route round-trip passed with browserErrors 0; headless 1098/1098 PASS.

## P759 - v53.17 - RM-03 계속: `_aioComputeFactorRanks`의 legacy 단일 구현이 parity fixture만으로는 유지되지 않고 있었다
- **motivation**: P755~P758 후 남은 smoke-only 중 screener-ranking은 제품 결정이 아니라 실제 7팩터 legacy 산식 추출 대상이었다. `_aioComputeFactorRanks`(js/aio-data.js)는 실 호출부가 여러 곳이고 SCREENER_DB/chat/table 결과를 직접 변이하므로, 계산 본문을 남겨둔 채 fixture만 추가하면 R352의 단일 owner 조건을 충족하지 못한다.
- **symptom/reproduction(조사 결과)**: `src/domain/screener/factor-ranks.js`와 5개 golden fixture/실행 스크립트가 먼저 존재했지만 legacy `_aioComputeFactorRanks`가 여전히 135줄 계산 본문을 소유했고 새 pure module은 실제 브라우저 호출 경로에 연결되지 않았다. 초기 ESM unit에서 테스트 helper가 칼만 필드를 포함한 채 “칼만 데이터 없음”을 검사해 false failure도 드러났다.
- **root_cause**: legacy 함수가 hidden global(`SCREENER_DB`, `_aioServerScreener`, `_aioFactorWeights`, `window.AIO.marketState`)·행 변이·호환 전역 projection을 계산 로직과 한 함수에 섞어 두어, domain 추출과 compatibility projection의 경계가 없었다. 또한 구조 게이트는 domain 주석의 `localStorage` 문자열도 금지 패턴으로 오인한다.
- **fix**: `computeFactorRanks`를 pure domain owner로 등록하고 legacy 함수는 입력 해석·결과 projection만 수행하도록 축소. `bootstrap.js`와 `compatibility-facade.js` 양쪽 expose allowlist, `sw.js` SHELL_ASSETS를 동기화. ESM unit helper는 칼만 필드 없는 행을 별도로 만들어 inactive-factor assertion을 실제 조건과 일치시켰고, domain 주석은 구조 게이트와 충돌하지 않게 추상화했다.
- **violated_rule**: R352(추출 모듈만 추가하고 실행 가능한 legacy owner를 남기는 위험을 같은 배치에서 제거해야 함).
- **prevention**: domain extraction batch는 (1) pure module import, (2) compatibility facade exposure, (3) 실제 legacy caller rewiring, (4) SW/release asset 등록, (5) golden parity와 browser route 검증을 모두 완료하기 전 VERIFIED_LOCAL로 승격하지 않는다. domain boundary 게이트가 주석까지 검사하므로 금지 토큰을 설명문에 그대로 쓰지 않는다.
- **verification**: `ci-domain-parity-check.mjs` PASS(factor-ranks 5 fixture), `ci-esm-core-unit-check.mjs` PASS(NaN/missing/inactive/tie), architecture/retirement/runtime/release/version/static-data/knowledge-lint PASS, factor-ranks Chromium dump PASS(실제 873행), `ci-architecture-browser-check.mjs` PASS(17-route 2-lap, browserErrors 0), `ci-headless-tests.mjs` exit 0.

## P737 - v53.15 - native sentiment chart update path dereferenced an incomplete Chart instance
- **motivation**: The deferred browser gate exercised the new sentiment renderer after canonical state updates.
- **symptom/reproduction**: `ci-architecture-browser-check.mjs` raised `Cannot set properties of undefined (setting 'labels')` when a chart instance existed without a mutable `data`/dataset shape.
- **root_cause**: The renderer assumed every chart adapter exposed the full mutable Chart.js dataset contract.
- **fix**: Guard the existing chart update path and recreate/fallback when the instance is incomplete; the overall sentiment badge also remains fail-closed when VIX term structure is unavailable.
- **violated_rule**: R3 postmortem requirement and the resource/chart lifecycle contract.
- **prevention**: Chart update contracts must test both complete and incomplete adapters before mutating data.
- **verification**: Browser architecture gate rerun after the patch; remaining full-suite result is recorded in the current task handoff.

## P733 - v53.12 - refresh-data ESM summary에 CommonJS require가 남아 있었다
- **motivation**: P732 이후 workflow heredoc의 실제 실행 경로까지 검증해 자동 data commit 회귀를 닫는다.
- **symptom/reproduction**: refresh run `29668165189`는 quote 78/78 수집 후 `Pipeline status summary`에서 `ReferenceError: require is not defined`로 실패했고, watchdog run `29666589823`는 public-data stale을 보고했다.
- **root_cause**: `refresh-data.yml`가 `node --input-type=module -`로 실행하면서 `const fs = require('fs')`를 사용했다. summary 실패로 data commit 단계가 skip되었다.
- **fix**: `import fs from 'node:fs'`로 교체하고 module heredoc 내부 `require()`를 거부하는 data-pipeline contract gate를 추가했다.
- **violated_rule**: R348/R349.
- **prevention**: local workflow contract/control-character check 후 수동 refresh가 commit step까지 도달하는지 확인한다.
- **verification**: local contract/control-character checks PASS; downstream workflow evidence is recorded after deployment.

## P732 - v53.11 - data-watchdog와 refresh workflow의 ESM heredoc가 CommonJS parser/runtime에 남아 있었다
- **motivation**: AR-07 snapshot/operations/reconciliation checks를 workflow에 추가한 뒤 실제 `ci-data-pipeline-contract-check.mjs`를 실행했다.
- **symptom/reproduction**: `node - <<'NODE'` heredoc 안의 `import fs from 'node:fs'`가 local contract parser에서 `Cannot use import statement outside a module`로 실패했고, GitHub runner에서도 동일한 command shape가 실행될 수 있었다.
- **root_cause**: workflow command와 CI heredoc syntax checker가 module mode를 별도 계약으로 취급하지 않았다.
- **fix**: import를 포함한 refresh/watchdog heredoc를 `node --input-type=module -`로 통일하고, CI checker가 module heredoc를 Node `--check`로 검사하도록 수정했다.
- **violated_rule**: workflow syntax gate는 실제 실행 mode와 같은 parser를 사용해야 한다는 운영 계약.
- **prevention**: 모든 workflow heredoc는 import/top-level await 유무에 맞는 module mode를 명시하고, syntax gate가 command flag를 보존한다.
- **verification**: `ci-control-char-check.mjs`, `ci-data-pipeline-contract-check.mjs`, full `.mjs` syntax sweep PASS.

## P730 - v53.10 - Worker 보안 게이트가 PASS 출력 후 Node 프로세스를 종료하지 않았다
- **motivation**: 전체 CI 게이트를 실제 종료 code까지 확인하는 과정에서 `ci-worker-anthropic-check.mjs`가 성공 문구를 출력한 뒤에도 세션을 유지했다.
- **symptom/reproduction**: `node scripts/ci-worker-anthropic-check.mjs`가 모든 assertion PASS 문구를 출력하지만 process가 자연 종료되지 않아 CI step이 hang될 수 있었다. 외부 provider가 아니라 mock Worker 요청 뒤 남은 undici handle이 원인 후보였다.
- **root_cause**: async `main()` 성공 경로가 결과를 출력한 뒤 명시적으로 종료하지 않았고, 테스트가 만든 비동기/네트워크 리소스의 event-loop 생존을 gate가 보장하지 않았다.
- **fix**: 성공 출력 직후 `process.exit(0)`을 호출해 모든 검증이 await된 뒤 gate가 결정적으로 종료되도록 했다. 실패 경로의 `process.exit(1)`는 유지했다.
- **violated_rule**: CI/QA 실행은 PASS 문구뿐 아니라 종료 code와 종료 시점까지 검증해야 한다는 실행 gate 원칙.
- **prevention**: 모든 standalone CI contract script는 성공·실패 양쪽에서 유한 시간 안에 종료하고, 테스트 후 `exit code 0/1`을 확인한다.
- **verification**: 수정 후 동일 명령을 subprocess로 실행해 PASS 출력과 exit code 0을 확인했으며, 기존 전체 정적/브라우저 gate와 architecture gate는 계속 PASS했다.

## P729 - v53.9 - ESM 호환 observer가 legacy pageShown 이벤트를 수신하지 못했다
- **motivation**: AR-01~06 첫 ESM vertical slice를 실제 legacy shell과 연결하면서 route lifecycle 계약을 Chromium에서 검증했다.
- **symptom/reproduction**: 브라우저에서 새 `AIO_ARCH`는 부팅됐지만 `showPage('sentiment')` 후 `page-sentiment[data-aio-architecture-route]`가 생성되지 않고 `router.active()`가 비어 있었다. 새 observer가 `window`에 이벤트를 듣고, `event.detail`을 객체로만 읽는 상태에서 `document`가 발사한 문자열 detail을 놓쳤다.
- **root_cause**: legacy `_firePageShown()`은 `document.dispatchEvent(new CustomEvent('aio:pageShown', { detail: id }))`를 사용한다. 호환 facade와 lifecycle router가 실제 EventTarget과 payload shape를 계약으로 정규화하지 않아 producer-consumer event boundary가 단절됐다.
- **fix**: `src/legacy/compatibility-facade.js`가 `document`를 event target으로 선택하고, `src/app/router.js`/`src/app/bootstrap.js`가 문자열 또는 객체 detail을 모두 route ID로 정규화하도록 수정했다. `ci-architecture-browser-check.mjs`에 offline 부팅·sentiment mount·home dispose·sentiment 재진입 회귀 여정을 추가했다.
- **violated_rule**: R346(legacy event adapter는 실제 EventTarget과 payload shape를 boundary에서 정규화해야 함).
- **prevention**: 신규 compatibility adapter는 이벤트 emitter 검색(`dispatchEvent`)과 listener target을 함께 확인하고, 실제 `detail` shape를 Chromium fixture에서 검증한다. observer가 실패해도 legacy shell을 소유권자로 유지한다.
- **verification**: Playwright 로컬 서버·외부망 차단에서 `AIO_ARCH` 부팅, 결측 sentiment의 `blocked` 상태, sentiment→home→sentiment route 왕복과 dispose/mount를 확인했고 예상 밖 browser error 0건. 기존 headless 1101/1101 PASS 및 architecture contract PASS.

## P728 - v53.9 - quote batch가 종목마다 전역 DOM을 스캔하고 퇴역 KR 표가 네트워크 fanout을 남겼다
- **motivation**: 1차가 fxbond 고아 경로에 한정됐음을 명확히 한 뒤, 2차로 전체 부팅·DOM·이벤트·데이터 갱신 경로를 다시 계측했다.
- **symptom/reproduction**: `applyLiveQuotes()`는 각 quote의 `PriceStore.set()`마다 7,843-node 문서에서 lineage selector를 전수 조회한 뒤, per-symbol price/chg 반영, 전체 price/chg bulk rewrite, `applyLiveDataToDom()` 전체 bind를 연속 실행했다. 또한 v53.7 KR 전용 페이지 삭제 후에도 `fetchKrDynamicData()`가 더 이상 존재하지 않는 투자자 TOP10 표를 위해 최대 24개 Naver 종목 요청을 실행했다. 구 KR runtime audit은 삭제된 5개 DOM을 missing issue로 보고했다.
- **root_cause**: Store의 단건 안정성 로직과 batch renderer의 책임이 분리되지 않았고, 후속 canonical binder가 추가된 뒤 이전 bulk pass를 제거하지 않았다. KR 페이지 통합은 route·DOM을 제거했지만 공유 loader·audit 소비자 계약까지 수직 정리하지 못했다.
- **fix**: batch 내부 `PriceStore.set()`은 DOM annotation을 defer하고 마지막 `applyLiveDataToDom()` 1회가 공통 DOM·lineage를 소유하게 했다. 중복 bulk rewrite 2개를 삭제하고, 단건 annotation은 symbol-target selector 및 `data-live-field`를 지원하게 했다. 공유 KR loader에서 `fetchKrInvestorTop10()` 호출을 제거하고 runtime audit을 `_krCurrentSupplyEvidence`의 유효성·나이 기반으로 전환했다.
- **violated_rule**: R344의 퇴역 소비자 수직 제거 범위에 scheduler/network fanout과 runtime audit을 끝까지 포함하지 못했고, 고빈도 batch에 canonical DOM owner가 없었다.
- **prevention**: R345와 runtime contract에 batch defer·중복 bulk 부재·target lineage·퇴역 fanout 미호출·evidence audit을 고정했다. headless T383/T863도 삭제된 DOM 계약이 아니라 현재 evidence 계약을 검사한다.
- **verification**: JS 문법, 정적 15종(runtime/structural/doc-currency 포함), `git diff --check`를 통과했다(data-lineage FAIL 0, 기존 SEC 93/655=14.2% WARN 1). 로컬 Chromium은 headless 1101/1101, boot FCP 1556ms·route 1162ms·max long task 611ms, critical10 10/10, accessibility 17/17, FULL_INIT viewport 68/68을 4개 shard로 검증(overflow/tinyText/jsErrors 0), portfolio vault 8/8을 통과했다. 커밋·배포는 수행하지 않았다.

## P727 - v53.8 - 퇴역 fxbond 해설 경로가 무효 DOM 조회와 비등록 timer 폴백을 남겼다
- **motivation**: 성능·품질 우선 리팩터링에서 P726이 부수 발견으로 남긴 fxbond 고아 코드와 QC10 timer lifecycle을 실제 실행 경로 기준으로 닫았다.
- **symptom/reproduction**: `fx-dc-*`/`bond-dc-*` 8개 sink는 HTML에 없는데 `updateFxDynamicComments()`와 `generateFxBondCommentary()`가 fxbond pageShown과 `aio:liveQuotes`마다 실행됐다. pageShown은 첫 함수를 중복 호출해 진입당 무효 DOM 조회 24회, quote 갱신당 16회를 만들었다. `aio-chat.js` 알림 폴링도 registry 부재 시 이름 없는 raw `setInterval`을 생성했다.
- **root_cause**: v52.71 리디자인이 HTML만 `cam-*`/`carry-*`로 교체하고 구 함수·호출·wrapper를 수직 제거하지 않았다. `generateFxBondCommentary()` 안의 살아 있는 두 상태 배지 때문에 함수 전체가 필요한 것처럼 보였고, canonical `updateFxBondPage()`와 legacy wrapper가 병존했다. timer도 core-before-chat 로드 계약이 있는데 불필요한 fallback을 남겼다.
- **fix**: 두 고아 함수와 모든 호출·monkey-patch wrapper를 제거했다. 살아 있는 `fxbond-risk-pill`, `yc-inversion-badge`, `updateCrossAssetMatrix()` 갱신은 `updateFxBondPage()`에 직접 통합했다. 알림 polling은 `_aioRegisterTimer('alerts-check', ...)`만 사용한다.
- **violated_rule**: R341의 퇴역 경로 완전 제거와 QA QC10의 timer registry 원칙을 구현 경로 끝까지 적용하지 못했다.
- **prevention**: R344와 runtime contract에 고아 함수/DOM sink 부재, canonical updater 직접 연결, raw interval 부재를 이진 게이트로 추가했다. UI 교체 시 DOM만이 아니라 선언→호출→wrapper→event hook을 한 번에 grep한다.
- **verification**: JS 6모듈과 변경 MJS 문법, 정적 15종 게이트, 고아 함수·sink·raw interval 0건을 확인했다. 로컬 Chromium은 headless 1101/1101, boot FCP 504ms·route 153ms, critical10 10/10, accessibility 17/17, FULL_INIT viewport 68/68(overflow/tinyText/jsErrors 0), portfolio vault 8/8을 통과했다. 커밋·배포는 수행하지 않았다.

## P726 - v53.7 - HYG 달러 가격 임계 신용 판정이 5번째 표면까지 잔존했고, 그중 하나는 대상 DOM 자체가 없는 고아 코드였다

- **motivation**: 직전 QA 문서 통합 세션에서 열린 항목으로 남겨둔 "HYG 달러 가격 임계 신용 판정 3함수 잔존"(P576/P713/P714 클래스)을 실제로 수정하기 위해 재확인.
- **symptom/reproduction**: 최초 식별된 3곳(`_tempLive`/`computeEconomicTemperature`, `updateRiskMonitor`, `generateFxBondCommentary`) 수정 후 저장소 전체를 `grep -nE "hyg\s*[<>]=?\s*[0-9]{2}"`로 재스윕한 결과 4번째(`js/aio-data.js`의 `_aioRenderCarryUnwindRisk`, 엔캐리 언와인드 리스크 프록시)와 5번째(`js/aio-chat.js`의 fxbond AI 채팅 컨텍스트) 표면을 추가로 발견. 5곳 모두 수정 후 Playwright로 로컬 서버(uncommitted 워킹트리)를 직접 열어 실측한 결과, `generateFxBondCommentary()`가 쓰는 `#bond-dc-credit`/`#bond-dc-implication`/`#bond-dc-curve`/`#bond-dc-10y`/`fx-dc-*` DOM이 index.html 어디에도 존재하지 않음을 확인 — 이 함수와 형제 함수 `updateFxDynamicComments()`는 매 fxbond 페이지 진입·라이브 갱신마다 실행되지만 전부 조용히 no-op이었다.
- **root_cause**: (1) `computeTradingScore`(P576)와 Weinstein/MTF(P713)만 HY OAS로 수정되고, 동일 신용지표를 별도로 재계산하는 4개 함수(경제 온도계·Risk Monitor 위젯+Composite 서브스코어·FX/Bond 해설·엔캐리 프록시)와 AI 채팅 컨텍스트 1곳이 R25 "동일 지표 소비 표면 grep 전수" 원칙 없이 개별 수정되며 누락됨 — 매 회 "3곳 다 고쳤다"는 판단이 반복적으로 틀렸던 이유. (2) `generateFxBondCommentary()`의 대상 DOM은 v52.71 아이보리 컴프 리디자인(index.html:8826 주석 "기존 cam-*/carry-jpy 재사용")이 `bond-dc-*`/`fx-dc-*` 위젯을 `cam-*`/`carry-*` 구조로 완전히 대체하면서 HTML만 교체되고 구 JS 함수·호출부는 제거되지 않은 R341급 고아 코드 — 코드 리딩만으로는 "이중 표면이 라이브에서 어느 쪽이 이기는가"를 실제와 다르게 추론했다(둘 다 dead였음, 실측 전에는 몰랐음).
- **fix**: 5개 표면 전부 `window._hySpreadBp`(FRED HY OAS bp) 단일 소스로 전환, 임계값은 기존 Weinstein/MTF와 동일한 350/450/550bp로 통일. `generateFxBondCommentary()`의 "안전자산 피신 권고" 등 처방형 문구는 관측형으로 전환(P714 원칙). `Risk Monitor`의 `#rm-hyg-bar`는 `((650-oasBp)/400)*100` 역방향 맵으로 재계산(낮은 bp=안정=풀바 유지, 기존 시각 관례 보존). 이 과정에서 발견한 R309 잔재(`js/aio-data.js:3503`, FRED YoY 카드 "+" 부호 소실)와 `Number.isFinite(Number(x))`형 null→0 통과 취약점 18곳(그중 14곳 실버그로 판정)도 같은 세션에서 함께 닫음(각각 별도 root_cause — 상세는 이 항목 하단 병기).
- **violated_rule**: R25(이중/다중 표면 grep 전수 없이 "고쳤다" 선언 — 3회 이상 반복돼 R341 승격 대상), R341(퇴역 UI의 JS 수직 경로 미제거).
- **prevention**: HYG 관련 재발 방지는 QA-CHECKLIST에 `grep -E "hyg\s*[<>]"` 전수 스윕을 상시 항목으로 편입(완료). 코드 리딩만으로 "어느 표면이 라이브에서 이기는가"를 판단하지 않고, DOM 타겟 존재 여부를 실브라우저(Playwright, 외부망 차단+mock 데이터 주입)로 직접 확인하는 절차를 표준화 — 이번 건에서 실제로 오판을 잡아냈다.
- **verification**: JS 문법 6모듈 전체 통과, 정적 게이트 15종 전체 PASS. 로컬 Playwright(uncommitted 워킹트리, 외부망 차단)로 (a) 결측 상태에서 `온도계="—"`/`rm-hyg-status="미수신"`/`carry-hyg-risk="—"` 정상 표시, (b) `window._hySpreadBp=387`(주의 구간) 주입 후 재호출 시 `rm-hyg-status="주의"`·`rm-hyg-bar="65.75%"`(공식 검산 일치)·`temp-score="60"`(내역에 "HY OAS 387bp(50점)" 정상 표기)·`carry-verdict`에 HY OAS 반영 확인, (c) console/page error 0(net::ERR_FAILED는 의도적 외부망 차단에 의한 것). 헤드리스 `AIO.runTests()`는 이번 수정이 유발한 T765(FRED YoY 카드 텍스트 하드코딩 기대값)를 잡아내 함께 수정 — 1101/1101 PASS. 배포·커밋은 사용자 지시 전 미수행.

### 병기 — 같은 세션 부수 수정 (Number.isFinite(Number()) null→0, R309)

- **calcKrHealthScore**(index.html): 함수 3줄 위 자신의 주석("P712/R340: 결측을 0으로 중립화하지 않는다")과 직접 모순 — KOSPI/KOSDAQ pct가 null이면 `Number(null)=0`이 `isFinite` 통과해 "라이브 수신됨"으로 오판정, `kospiPct=0`이 `-1<0` 버킷에 걸려 실제로 -5점을 만들어냈다(가장 심각한 사례).
- **updateWSAnalysis**(js/aio-ui.js): `!Number.isFinite(Number(breadth))` 부정 가드가 null을 통과시켜 "판정 보류" 대신 breadth=0 취급으로 Weinstein Stage 최하단(약세) 판정과 조언 문구를 발화— 자기 자신의 에러 메시지("Stage 판정 보류")를 무력화.
- **fetchYFChart 2s10s 브릿지**(js/aio-data.js:16309): `window._live2Y` null 시 `y2=0`이 되어 `spread10y2y = y10 - 0 = 10년물 그 자체`(예: +430bp)가 스프레드로 오기록될 수 있었음 — 커브 역전 판정을 오염시킬 수 있는 경로.
- **evaluateKrThemeQuoteCoverage**(index.html): `d.pct` null인 종목을 "관측됨"으로 카운트해 커버리지 게이트(0.6/0.7 임계) 자체를 무력화할 수 있었음.
- 나머지 9곳(SR Levels, 사이클 입력 표시, evidence bundle asOf, external-source-state count/expected, breadth advances/declines 등)은 개별적으로 낮거나 중간 심각도 — 상세는 diff 참조. 4곳(`js/aio-core.js:20923`의 `valid()` 헬퍼, `js/aio-tests.js` T683/T241/T187)은 이미 `== null ||` 사전 차단이 있어 안전 — 수정 불필요로 확인 후 유지.
- **prevention**: `Number.isFinite(Number(v))` 단독 사용 금지 — `v != null && Number.isFinite(Number(v))` 또는 `typeof v === 'number' && isFinite(v)`(P715 원칙과 동일 클래스). 검출: `grep -n "Number.isFinite(Number(" index.html js/*.js` 후 인접 `!= null`/`== null` 부재 여부 개별 확인.

## P704~P724 (v52.89~v53.6) — 이하 상세 엔트리

## P724 - v53.6 - Yahoo v7 quote의 52주/거래량 확장 필드를 _liveData에 쓰는 코드가 저장소에 0곳 — 이를 1순위 소스로 읽는 UI가 영구 결측이었다

- **motivation**: P723(ticker 종목 개요 신설) 구현 중 52주 범위 행의 데이터 소스를 `_liveData[sym].fiftyTwoWeekHigh`로 배선하기 전, 이 필드가 실제로 채워지는지 전수 추적(EF-10 "fetch 없는 정적 슬롯" 재발 방지 절차).
- **symptom/reproduction**: `grep fiftyTwoWeek` 전수 — 쓰기는 `_yfBatch` 생성부(aio-data.js)의 로컬 객체뿐, `window._liveData`에 도달하는 경로 없음. fundamental 가격 포지션 카드(aio-ui.js:3021)의 "1순위: _liveData(Yahoo v7/quote)" 읽기는 항상 미스 → 항상 2순위 finnhubMetrics로 폴백(Finnhub 실패 시 카드 공백). 실브라우저 검증에서도 NVDA `_liveData`에 52주 필드 부재 확인.
- **root_cause**: `applyLiveQuotes()`가 시세를 `PriceStore.set()`(price/pct/메타만 저장)으로 넘기고, 확장 필드는 prevClose 2종만 명시 보존(v36.7)했음 — v48.6에서 52주/거래량 필드를 quote에 추가하고 소비자(fundamental 카드)까지 만들었지만 보존 단계를 빠뜨려 "생산-소비 사이 파이프 단절"이 2개월 이상 잠복.
- **fix**: `applyLiveQuotes()`의 기존 prevClose 보존 블록과 동일 패턴으로 7개 확장 필드(52주 고저·당일 고저·거래량·평균거래량 2종)를 수신 시에만 `_liveData`에 복사(합성/폴백 없음). ticker 종목 개요(P723)와 fundamental 카드가 동일 경로를 공유.
- **violated_rule**: R25 계열(인프라 추가 시 소비자까지 경로 연결) — P721(RRG)과 같은 "생산자-소비자 파이프 단절" 클래스.
- **prevention**: 새 UI가 `_liveData`의 비표준 필드를 읽을 때는 그 필드의 쓰기 지점을 grep으로 먼저 실증한다(읽기 코드의 존재는 필드 존재의 증거가 아님 — 본 건이 반례).
- **verification**: 로컬 실브라우저(Playwright)에서 ticker 종목 개요 렌더 + 헤드리스 1101/1101 PASS.

## P722 - v53.5 - v53.3/53.4 신규 테스트 3건이 "데이터 없음"을 영구 불변식으로 단언해 push 시 CI RED를 예약해 두고 있었다

- **motivation**: v53.3~v53.5 push 전 사전 검증 — 리베이스 직후 봇의 최신 data.json(quotes 77, P719 수정 전 producer 산출물) 기준으로 헤드리스를 재실행.
- **symptom/reproduction**: 로컬 artifact(quotes=[])로는 1101/1101 green이던 스위트가 봇 artifact로는 T324/T376/T786 3건 실패. 그대로 push했으면 다음 크론(P719 수정판 발행) 전까지 main CI RED 윈도우 발생 — 사용자가 보고한 "run failed 이메일"을 하루 더 만들 뻔.
- **root_cause**: 세 테스트 모두 quotes=[] 로컬 환경에서 작성되며 "그 환경에서의 관측 상태"(breadth5sma 숫자 존재 / regime available:false / ATH floor null)를 영구 불변식으로 고정 — P720(감사 리터럴 vs 실값)과 대칭인 "테스트 vs artifact 내용" 데이터 의존 클래스. 구현 함수들은 양쪽 상태 모두 올바르게 동작했고 테스트만 틀렸음.
- **fix**: 3건을 형태 불변식으로 재작성 — T324: 스키마 존재+null 또는 유효 0-100, T376: fail-closed 계약 양방향(미수신→판정 필드 null, 수신→유효 레짐+유한 점수), T786: 상수 floor 부재(null 또는 관측 유래 양수)+하드코딩 부재 검사 복원(기존 코드가 계산해놓고 버리던 t786ok 사용).
- **violated_rule**: R279 계열(관측 시점 상태를 영구 등호 단언) — 날짜(R279)·숫자 시드(P626)·이제 "결측 상태" 자체까지 3번째 변형. 규칙 승격: "테스트 불변식은 데이터 가용성 상태와 무관하게 참이어야 한다(가용/불가용 양쪽을 명시적으로 분기 검증)".
- **prevention**: artifact 내용에 의존할 수 있는 테스트는 push 전 "현재 origin artifact"와 "차기 producer 산출물 형태" 양쪽으로 돌린다(이번에 실제로 잡음). 신규 fail-closed 테스트는 available true/false 두 상태의 계약을 모두 서술한다.
- **verification**: 봇 artifact(quotes 77)와 quotes=[] 형태 양쪽에서 헤드리스 1101/1101 PASS.

## P721 - v53.5 - RRG가 세션 내 틱 누적에 의존해 모든 신규 방문자에게 영구 판정 보류였다

- **motivation**: 사용자 요청("각 페이지 핵심 정보가 나오는지 확인") — 22페이지 렌더 감사를 라이브/로컬 이중 실측한 결과 themes 페이지 RRG가 라이브에서 "사이클 판정 보류 · 근거 0/11"로 전면 공백.
- **symptom/reproduction**: 라이브 v53.2 themes 진입 시 RRG 사분면 카드·사이클 pill 전부 보류. 원인 추적: `calcLiveRS()`가 요구하는 `_priceHistory`(>20 샘플)는 `collectPriceHistory()`가 30초 틱마다 세션 내 메모리에 push하는 구조 — 새 방문자는 10분+ 체류 전까지, 리로드 시엔 다시 0부터. 사실상 전 방문자 영구 보류.
- **root_cause**: RRG는 일봉/주봉 종가 기반(13wk MA) 지표인데 데이터 소스를 세션 틱 누적으로 설계(v27.2 잔재). v52.98이 정적 RRG 시드를 제거(fail-closed)하면서 대체 실데이터 경로를 연결하지 않아 "정직한 영구 공백"이 됨 — v50.15 VKOSPI 미니차트(P641)와 동일 클래스.
- **fix**: `hydrateRRGDailyHistory()` 신설 — 기존 검증된 클라 경로(fetchViaProxy+_parseYFChartResponse, fetchSentimentHistory 패턴)로 SPY+11섹터 ETF의 실제 6개월 일봉 종가를 배치 3개 동시·배치별 점진 재렌더로 수화. `_priceHistoryDaily` 마커로 틱 push의 일봉 오염 차단(혼합 금지). `calcLiveRS`/`renderRRGQuadrantCards`의 불필요한 라이브 틱 선행 게이트를 일봉 우선으로 완화(틱 없어도 일봉으로 판정, pct는 마지막 2개 종가 파생). 실패 심볼은 채우지 않고 보류 유지(추측 금지). 부수: kr-home KOSPI/KOSDAQ 변화폭 HTML 정적 리터럴(▲200.86/▼28.05) 제거 + `data-live-kr-change` 숫자 리터럴 금지 게이트 추가(기존 62행 패턴이 속성명 불일치로 미커버).
- **violated_rule**: R25(인프라 교체 시 소비자 경로까지 연결 — v52.98이 시드 제거만 하고 실데이터 경로 미연결), 카테고리 20(정적 시장값 리터럴).
- **prevention**: fail-closed로 시드를 제거할 때는 "정직한 공백"이 영구 상태인지(대체 실데이터 경로 존재 여부)를 함께 판정한다. 클라이언트 누적 기반 시각화는 첫 방문자 관점(누적 0)에서 검증한다.
- **verification**: 로컬 실브라우저(시세 차단 환경)에서 themes 진입 → 12심볼 일봉 100개 수화 → RRG 근거 11/11, 사분면 카드 실분류 렌더 확인(exit 0). 정적 계약 게이트 22/22 + 신규 패턴 3방향 단위검증(회귀 잡힘/JS 템플릿 무시/정상 통과).

## P720 - v53.5 - critical10 감사의 맨몸 날짜 토큰이 정상 체크리스트 "5/5"와 충돌해 간헐 CI RED를 만들었다

- **motivation**: 사용자가 "run failed 이메일이 종종 온다"고 보고 — 2026-07-16 12:10Z/14:24Z CI 실패(T173) 2건을 조사.
- **symptom/reproduction**: 데이터 갱신 커밋에서만 T173이 간헐 실패 후 다음 갱신에서 자연 복구. 실패 커밋(e603a583)의 data.json/telegram-digest.json을 현재 코드에 얹어 실브라우저 재현 — signal 페이지 실행 체크리스트가 그날 5개 조건을 전부 충족해 "5/5 (충족)"을 렌더했고, `staleTokenRe`의 맨몸 `5\/5` 토큰이 이를 2026-05월 정적 잔재로 오인.
- **root_cause**: 4~5월 정적 스냅샷 잔재 검출용 토큰 중 `5/4|5/5|5/8|5/9`가 컨텍스트 없는 2문자 날짜 패턴이라 "n/5 점수" 등 정상 동적 텍스트와 구조적으로 충돌 — P715의 '1,508' 리터럴과 동일 클래스(감사 리터럴 vs 라이브 실값 충돌). 시장 상태(체크리스트 충족 수)에 따라 CI가 갈리는 간헐성.
- **fix**: 맨몸 날짜 토큰 4개 제거(감지 대상이던 정적 잔재는 v53.4 정적 데이터 계약 22카테고리가 원천 차단). 컨텍스트 있는 토큰(VIX Spot 18.36, 이란 재협상 등)은 유지. 부수: 같은 체크리스트의 시스템 발화형 판정 라벨("진입 검토 가능/진입 자제" 2곳)을 P714 정합 관측형("조건 대부분/일부 충족·미충족 다수")으로 전환.
- **violated_rule**: R25 반복(P715와 동일 클래스 3회째 — 감사 리터럴에 시장 실값과 충돌 가능한 짧은 숫자/날짜 패턴 금지를 규칙 승격 후보로).
- **prevention**: 감사용 stale 토큰은 최소 1개 비숫자 컨텍스트 단어를 포함해야 한다. 간헐 CI 실패는 "데이터 내용 의존 단언" 여부를 최우선 가설로 조사한다.
- **verification**: 실패 당시 데이터 재현 하네스에서 수정 전 issueCount 1("5/5" 매칭 문맥 실증) → 수정 후 issueCount 0. 전체 헤드리스는 배치 최종 게이트에서 확인.

## P719 - v53.5 - data.json 발행 계약(P715 quotes 스트립)이 meta 후기록 재기록에 덮여 라이브에서 무효였다

- **motivation**: REMAINING-WORK B3(배포 후 첫 크론 산출물 검증) — v53.2 배포 후 refresh-data 크론이 patched producer로 재생성한 라이브 아티팩트 3종을 curl로 대사했다.
- **symptom/reproduction**: `https://ysnle.github.io/aio-screener/public-data/data.json`(generatedAt 2026-07-17T01:12Z, 배포 훨씬 이후)에 quotes 77건이 원시 시세 그대로 발행되고 `meta.quotesPublished`는 undefined. 같은 배치의 telegram-digest(summary-only)·screener.json(price 0건)은 계약 준수 — data.json만 위반.
- **root_cause**: `fetch-data.mjs` main()이 P715 스트립을 적용한 `publicData`를 한 번 쓰고(1761행), 그 뒤 screener 상태(fmpHasKey 등)를 `data.meta`에 후기록한 다음 "재기록" 단계(1809행)에서 **스트립 안 된 원본 `data`를 그대로 다시 써서** 첫 발행을 덮어썼다. P715 구현 시 OUT에 쓰는 두 번째 write 사이트를 놓친 것 — 로컬 게이트는 producer를 실행하지 않아 잡지 못했고, 위반은 라이브 크론 첫 실행에서야 드러났다.
- **fix**: 발행 페이로드 생성을 `toPublicPayload()` 헬퍼로 일원화해 두 write 모두 경유시키고, 마지막 발행본을 디스크에서 read-back해 quotes=[]·quotesPublished:false를 단언하는 계약 검증을 main() 끝에 추가(위반 시 throw → git 커밋 전에 워크플로 fail).
- **violated_rule**: R25(같은 파일 내 이중 write 사이트 전수 확인 없이 한 곳만 패치). P712~P714의 "이중 표면 드리프트" 패턴의 producer 판 — 동일 산출물에 쓰는 모든 write 경로를 grep 전수로 닫아야 한다.
- **prevention**: 발행 계약을 바꿀 때는 해당 출력 경로(OUT 등)에 대한 write 사이트를 전수 grep하고, 가능하면 계약을 write 시점 헬퍼+read-back 단언으로 코드화해 "패치 누락"이 조용히 살아남지 못하게 한다. 다음 크론 실행 후 라이브 재확인 필요(후속 검증 항목).
- **verification**: `node --check` PASS. read-back 게이트는 다음 refresh-data 크론 실행에서 실동작(위반 재발 시 워크플로 RED). 라이브 재확인은 배포+크론 도래 후 curl로 수행 예정.

## P718 - v53.4 - 공급자 퇴역 뒤 남은 시나리오 소비자가 null 확률을 숫자로 포맷했다

- **motivation**: 정적 시나리오 확률 생산자를 제거한 뒤 실제 Chromium에서 거시 페이지를 열어, 결측 상태가 화면과 콘솔에서 안전하게 처리되는지 확인했다.
- **symptom/reproduction**: 외부 네트워크를 차단한 실제 브라우저에서 거시 페이지 진입 시 legacy `updateDynamicScenarios()`가 공급자 없는 `null` 확률에 `.toFixed()`를 호출해 콘솔 오류를 냈다. 단위 테스트는 퇴역 생산자와 정적 확률 부재만 검사해 남은 소비자 경로를 실행하지 못했다.
- **root_cause**: 정적 확률 레지스트리와 데이터 생산자는 제거했지만, 인라인 DOM 갱신 함수·호출부·빈 시나리오 DOM이 수직 경로로 함께 제거되지 않았다. 결측을 숫자로 강제 포맷하는 소비자 계약도 남아 있었다.
- **fix**: `updateDynamicScenarios()` 선언, 모든 호출, 빈 시나리오 확률 DOM을 수직 제거하고 공급자 미연결 상태는 `data-scenario-provider-state="unavailable"`로 명시했다. T1040과 정적 데이터 계약은 provider-required 정책과 퇴역 소비자 부재를 함께 검사하도록 갱신했다.
- **violated_rule**: R341의 퇴역 경로 완전 제거와 R342의 결측 숫자 포맷 금지 원칙을 생산자 쪽에만 적용하고 실제 route 소비자까지 닫지 못했다.
- **prevention**: 데이터 생산자·레지스트리를 퇴역할 때 선언→호출→DOM sink→테스트를 한 묶음으로 제거한다. provider-required 출력은 유효한 공급자 응답 전까지 숫자·확률을 렌더하지 않으며, 실제 Chromium route 검증에서 console error 0을 필수로 한다.
- **verification**: 호출·선언 잔존 0, 정적 데이터 계약 22/22, runtime/structural/semantic 계약, Chromium headless 1101/1101을 통과했다. 실제 Chromium critical-10은 10/10·consoleErrors 0, 접근성은 22/22·consoleErrors 0이었다. B1 재현, B2 직접 원인, B3 인접 소비자, B4 문서·규칙, B5 자동 회귀, B6 실제 브라우저까지 모두 닫았다. 커밋·배포는 수행하지 않았다.

## P717 - v53.4 - 정적 시드와 현재형 서술이 데이터 생산자처럼 분산되어 결측을 숨겼다

- **motivation**: 스크리너 전체 코드와 화면의 고정 수치·텍스트를 전수 조사하고, 최신화로 해결할 항목과 구조적으로 런타임화할 항목을 구분해 정리했다.
- **root_cause**: 시세·심리·거시·시장폭·RRG·시나리오·이벤트·한국시장·LLM 비용까지 서로 다른 시기에 추가된 정적 폴백과 현재형 문장이 DOM, `DATA_SNAPSHOT`, 페이지별 채팅 override, 차트 seed, 스크리너 memo에 흩어져 있었다. 공급자 실패 시 이 값들이 명시적 결측 대신 정상 데이터처럼 보였고, 테스트와 CI도 오래된 상수의 존재를 계약으로 고정했다.
- **fix**: 변동 데이터는 런타임 artifact/공급자만 허용하고 미수신은 explicit null과 `—`로 닫았다. `AIO_MANUAL_REFERENCE`에는 공식 일정·정책만 출처·기준일·reference-only 용도와 함께 남겼다. SCREENER_DB는 873개 식별자만 보관하고 signal/memo/mcap/rsi는 런타임 병합으로 제한했다. 정적 quote/FRED/RRG/감정/차트/시나리오/이벤트/현재 narrative/LLM 가격·환율 폴백과 중복 채팅 context를 제거했다. 22개 데이터 카테고리를 검사하는 `ci-static-data-contract-check.mjs`를 CI에 추가하고 스크리너 유니버스를 재생성했다.
- **violated_rule**: R340의 fail-closed 원칙이 파생 결론에는 적용됐지만, 화면 초기값·현재형 텍스트·AI context·비용표·테스트 fixture까지 하나의 데이터 표면으로 묶이지 않았다.
- **prevention**: R342로 변동 수치·현재형 서술·확률·공급자 가격은 runtime-only, 공식 수동값은 provenance 필수, 결측은 explicit unavailable로 강제한다. 22개 카테고리 계약과 DOM numeric seed 탐지, synthetic fallback 금지, identity-only screener 계약을 CI에서 차단한다.
- **verification**: 정적 데이터 계약 22/22, runtime/structural/data-lineage 계약, JS 구문 검사, Chromium headless 1101/1101을 통과했다. 스크리너 유니버스는 873건으로 재동기화됐고 live-core lineage 실패는 0건이다. SEC 비표준/해외종목 커버리지 부족은 숫자로 보완하지 않고 reference 경고로 유지했다. 커밋·배포는 수행하지 않았다.

## P716 - v53.3 - 퇴역 기능을 비활성 코드로 보존하고 테스트 번들을 공개 배포한 구조가 코드와 사이트를 함께 비대화했다

- **motivation**: 사용자 요청으로 스크리너에 들어가는 전체 코드를 검토하고 중복·불용·도달 불가 코드와 공개 배포 구성을 정리했다.
- **root_cause**: 이전 수정들이 feedback board, 구형 macro narrative, breadth history chart, legacy indicator를 완전히 제거하지 않고 `return`, inert stub, 숨김 CSS, 호환 wrapper 형태로 남겼다. 테스트도 퇴역 구현의 부재가 아니라 “호출해도 아무 일 없음”을 확인해 잔존을 정당화했다. 동시에 Pages staging이 `js/*.js`를 복사하고 service worker가 `aio-tests.js`까지 shell asset으로 캐시해 CI 전용 약 680KB 번들을 사용자에게 배포했다.
- **fix**: 퇴역 기능의 DOM·CSS·상태·함수·호출·테스트를 수직 경로 단위로 제거하고, 현재 renderer 계약에 맞춰 회귀 테스트를 갱신했다. 선언만 있고 참조가 없는 named function을 차단하는 structural gate를 추가했다. Pages manifest·CI staging·service worker를 5개 runtime script 명시 허용목록으로 통일하고 테스트 번들을 제외했다. 총 diff는 코드·배포·문서 포함 순감소 1,300줄 이상이다.
- **violated_rule**: R220의 compactness 원칙과 공개 artifact 최소화 계약이 퇴역 경로·CI 전용 자산까지 확장되지 않았다.
- **prevention**: R341에 퇴역 수직 경로 완전 제거, declaration-only function 금지, Pages runtime allowlist와 service-worker 정합을 승격했다. `ci-structural-check.mjs`와 `ci-release-revision-check.mjs`가 재유입을 차단한다.
- **verification**: JS/MJS 38개 문법 검사, 정적 계약 14개, Chromium headless 1100/1100, boot interaction, critical-10, portfolio vault 8/8, accessibility 22/22, FULL_INIT viewport 22×4=88/88(overflow 0, JS error 0)을 통과했다. 커밋·배포는 수행하지 않았다.

## P715 - v53.2 - 서버 백스톱 제거가 null 코어전 함정·오탐 리터럴·hue 결합 테스트를 연쇄로 드러냈다

- **motivation**: 사용자 결정("지인 소수 공유 준비", 8건 AskUserQuestion 확정)에 따라 TG digest 요약화·KR 정지 위젯 정리·스크리너 enum/price·data.json 시세 발행 중단·IA 재편을 일괄 실행했다.
- **root_cause**: ① `computeMarketHealth`의 fail-closed null score를 3개 소비처가 무가드 문자열화("null점") — 서버 시세 백스톱이 있는 동안은 score가 항상 유한해 잠복. ② 1차 가드를 `Number.isFinite(Number(v))`로 작성 — **`Number(null)===0`이라 null이 통과**하는 코어전 함정으로 가드가 무력(프로브 실측으로 확정). ③ critical10 감사 staleTokenRe의 `1,508` 리터럴이 과거 하드코드 검출용이었으나 라이브 USD/KRW가 1,508원을 지나는 순간 오탐(2026-07-16 실측 — 날짜핀 부패와 동족인 "시장값 회전 부패"). ④ T458이 '과열 override(≥70)' 회귀 의도를 amber 색상 hue로 검증 — 공유 팔레트가 40~69에도 amber를 쓰므로 US above20=52.5 아티팩트에서 오검출. ⑤ 하네스는 외부 요청 전면 차단+loadTests 경로인데 초기 프로브가 이를 재현하지 않아 원인 특정이 지연됨.
- **fix**: `typeof score === 'number' && isFinite(score)` 가드 3곳(ec-score/바닥 체크리스트/기술 채팅 컨텍스트), staleTokenRe에서 시장값-충돌 리터럴 제거(타깃 가드 T175 전담), T458을 override 경계 검증으로 재작성, 하네스 동일조건 프로브(route.abort+loadTests) 확립.
- **violated_rule**: R340(결측의 문자열 승격 — 이번엔 'null' 리터럴), R25(P713 날짜핀과 동족의 "외부값 회전 시 부패하는 리터럴 단언" 2번째 클래스), 신규 함정: truthy/finite 가드에서 Number() 선코어전 금지.
- **prevention**: (a) null 가능 수치의 표시 가드는 반드시 `typeof v === 'number' && isFinite(v)` — `Number.isFinite(Number(v))`는 null/''/false를 통과시킴. 검출: `grep -n "Number.isFinite(Number(" js/ index.html`. (b) 감사/테스트 리터럴에 시장 실값과 충돌 가능한 숫자 금지(가격·지수·환율 리터럴은 요소-타깃 단언으로). (c) 헤드리스 재현은 반드시 하네스 동일 조건(외부 차단·loadTests)으로.
- **verification**: 하네스 동일조건 프로브로 "null점" 2건 실측→수정→소멸 확인, 헤드리스 1100/1100 + 전 게이트 재실행(상세 CHANGELOG v53.2). TG 아티팩트 85% 축소·screener price 846행 제거·data.json quotes 0건을 validator/lineage로 확인. 배포·커밋 미수행.

## P714 - v53.1 - 정적 UI가 AI 게이트가 차단하는 매매·배분 지시를 20여 곳에서 발화하고 있었다

- **motivation**: 사용자 요청으로 최근 작업분이 아닌 시스템 전체(설계·아키텍처·알고리즘·데이터·UI/UX·운영·제품성)를 기관/펀드 관점에서 전수 진단했고, 발견 이슈 중 코드 실행 가능분을 일괄 개선했다.
- **root_cause**: ① v52.75~86에서 AI 채팅에는 "구체 매수·매도·비중·손절·목표가" 차단 게이트를 정교하게 구축했지만, 동일 문형을 발화하는 **정적 UI 표면은 게이트 범위 밖**이었다 — `AIO_ACTION_RULES`(VIX→"포지션 X%로 축소·풋옵션 헤지 필수", F&G→"역발상 매수/차익실현"), 옵션 "권장 전략", home/signal 결론 바 "선별매수·분할 진입 검토"(v52.91 라벨 완화가 이 표면을 누락), 점수 범례 "0~40=현금 확보", MTF/VIX/breadth "행동 가이드" 등. 입력(VIX/F&G 절대 밴드)의 예측력은 검증된 적 없고 유사 입력 조합(WO-2)은 음의 상관이 실측된 상태였다. ② `computeTradingScore` macro 축의 `hyg<76` 달러 고정 임계 — 같은 함수 40줄 아래 주석이 스스로 "HYG 가격은 듀레이션 오염" 이라고 설명하면서 위쪽 코드는 그대로였고, P713(Weinstein/MTF)과 동일 클래스의 마지막 잔존이었다. ③ 면책 고지가 guide `<details>`에 접혀 있어 지시형 문구 대비 실질 도달률이 0에 가까웠다. ④ typed-claim 게이트는 envelope 미제출 시 검증 자체가 스킵되는 옵트인 구조인데 사용자에게 그 구별이 표시되지 않았다.
- **fix**: 시스템 발화형 지시 20여 곳을 프레임워크 귀속 관측형으로 전환(sizePct는 데이터로만 유지·렌더 금지, 출처 귀속 교육 서술과 안전 테스트 픽스처는 보존), `hyg<76` 제거(신용은 FRED HY OAS 실측 블록으로 일원화), 첫 방문 비차단 면책 바 신설(localStorage 1회 확인), 스크리너 kalman 컬럼 (연구) 라벨, AI not-structured+현재성 수치 응답에 "자동 검증 미통과" 비차단 고지, T221 관측형 재작성.
- **violated_rule**: R340 계열(검증 안 된 입력의 판정 승격 — 이번엔 값이 아니라 '지시문'이 승격 대상이었음), R25(P713과 동일 클래스 `hyg` 임계의 3번째 표면 — Weinstein/MTF/score), WP-AI0의 경계 정의(게이트가 "AI 응답"만 대상이라 정적 UI가 사각).
- **prevention**: (a) 매매 지시 문형 게이트는 발화 주체(AI/정적)와 무관하게 적용한다 — 회귀 검출: `grep -nE "매수하세요|매도하세요|진입하세요|축소하세요|하세요.*포지션|포지션.*%.*(축소|확대)|헤지 (필수|하세요)" index.html js/*.js`(안전 픽스처·부정문 제외). (b) 달러 가격 고정 임계로 신용/스프레드를 판정하는 패턴 금지는 이제 3회 반복 — RULES 승격 요건 충족(R341 후보): `HYG.*[<>]\s*[0-9]{2}` 계열 grep을 QA에 편입. (c) 면책·공시 문구를 수정할 때는 그 공시와 모순되는 라벨이 남아있는지 결론 바/범례/가이드 전 표면을 함께 grep한다.
- **verification**: 변경 JS 5종 node --check + index.html 인라인 12블록 전수 파스 + 헤드리스 전체 + runtime/structural/ux/critical10/a11y/vault/viewport(FULL_INIT) 게이트 재실행(결과는 CHANGELOG v53.1). 배포·커밋은 별도 지시 전 미수행.

## P713 - v53.0 - fail-closed 전수 스윕이 이중 구현 표면을 놓쳤고, 날짜 하드코딩 테스트가 이벤트 당일 CI를 죽였다

- **motivation**: 사용자 요청으로 v52.73~v52.99 Codex 작업분(커밋 +7,834줄, 미커밋 +2,061줄)을 금융 전문가 관점에서 전수 리뷰했다. CHANGELOG 주장과 실제 코드의 정합성을 diff·구현 정독·게이트 실행·라이브 CI 실측으로 대조했다.
- **root_cause**: ① P712/v52.98이 "Weinstein Stage·MTF는 관측 이력 없으면 판정 보류"를 aio-core.js marketState 경로에만 적용하고, index.html의 별도 구현 `updateWeinsteinStage()`/`updateMTF()`(호출부 살아있는 라이브 경로)를 놓쳤다 — 임의 폴백(abv50=28, 20SMA=57)과 HYG 달러 고정 가격밴드($80/76/72) 신용 판정, "매수 금지! 현금이 최고의 포지션" 처방 문구가 잔존(이중 표면 드리프트 재발). ② VKOSPI 시드 주석은 "live 성공값만 current evidence로 허용"이라 선언했지만 소비처(kr-supply 배너+채팅 컨텍스트 5곳)는 게이트 없이 시드를 현재값처럼 사용. ③ T884가 '2026-07-16'을 하드코딩해 금통위 당일 캘린더 auto-advance와 충돌 — origin/main CI가 이벤트 당일 결정론적으로 RED가 됐고, runtime contract의 BOK/FOMC 날짜 핀 2건도 동일 클래스(FOMC 핀은 7/29에 부패 예정이었음). ④ 스코어 공시 "예측력 아직 검증되지 않음"은 WO-2 실측(유의한 음의 상관)을 과소 공시.
- **fix**: 두 함수 evidence-gate 교체(50SMA 폭 미수신 시 Weinstein 판정 보류·MTF 축 제외), HYG 가격밴드→FRED HY OAS(350/450/550bp) 교체+미수신 시 축 제외, 처방 문구 프레임워크 귀속형 전환, `_vkospiLiveOk` 플래그로 소비처 6곳 게이트, T884·runtime contract 날짜 핀 3건을 rot-proof 정합성 검증으로 재설계(BOK 공식 일정 7/16→8/27 반영), 스코어 공시에 음의 상관 실측 명시, 잔여 매매 권유 문구 5곳 관측형 전환, debug.log untrack.
- **violated_rule**: R340(파생 결론의 결측 대체 금지 — 이중 구현까지 전수 강제 실패), R276 계열(동일 판정의 이중 표면), R3·R25(날짜 하드코딩 단언은 P604 auto-advance 버그와 같은 "달력 회전 부패" 계열인데 테스트/계약에서 재발).
- **prevention**: (a) fail-closed 스윕은 함수 단위가 아니라 **동일 지표를 소비하는 모든 호출 표면의 grep 전수**(예: `abv50`, `hygPrice >`, `DATA_SNAPSHOT.vkospi`)로 완료를 판정한다. (b) 테스트·CI 계약에 미래 특정일을 등호로 고정하는 단언 금지 — 유효성(ISO 파싱)+표면 간 정합(등호는 소스 상수끼리만)으로 작성한다. 위반 검출: `grep -n "=== '20[0-9][0-9]-" js/aio-tests.js`. (c) 시드 정책 주석("판정에 사용 안 함")을 달 때는 소비처 grep 결과를 주석에 병기한다.
- **verification**: 워킹트리 헤드리스 1099/1100(유일 실패가 T884 당일 부패임을 실측 확인) → 수정 후 전체 재실행 + runtime contract + structural + version 게이트. BOK 2026 일정은 한국은행 공식 페이지·복수 언론으로 확인(2/26·4/10·5/28·7/16·8/27·10/22·11/26). 리뷰 도중 실제로 7/16 금통위가 열려 만장일치 2.50%→2.75% 인상(3년6개월 만)이 확정됐음을 WebSearch 복수 소스(Newspim·파이낸셜뉴스·이투데이)로 교차 확인 — DATA_SNAPSHOT 시드·currentTopic·정적 HTML 3곳·히스토리 표·이슈 카드·폴백 리터럴 4곳·KR 건강점수를 실제 결과로 동기화(이 자체가 R340 "결측/정적값의 현재 판정 승격 금지" 원칙의 정상 사례 — 값이 바뀐 즉시 소비 표면 전체를 갱신). 배포·커밋은 이 시점까지 수행하지 않았다.

## P712 - v52.99 - 결측·정적·합성 데이터가 현재 시장 판정으로 승격됐다

- **motivation**: Telegram digest 주입 여부를 넘어 22개 페이지의 모든 가시 텍스트·숫자·차트·판정 문구를 현재 시장 및 공식 원천과 비교했다.
- **root_cause**: 미국채 만기 필드가 혼용돼 `^TNX` 10년물이 2년물 슬롯을 덮었고, 일부 화면은 5년물에 계수를 곱해 2년물을 합성했다. 기술 페이지는 OHLCV 실패 시 당일 등락률로 RSI·MACD·Stage를 추정했고, 종목 차트와 시장폭 차트는 난수 시계열을 만들었다. RRG는 과거 섹터 시드, McClellan은 50일선 상회율 역산, HY OAS는 HYG 가격 임의 변환을 사용했다. 과거 일정·설문·한국 테마 촉매와 결측 수급/VKOSPI도 현재 결론으로 승격됐다.
- **fix**: 만기별 금리를 명시적 canonical curve evidence로 분리하고 2s10s는 관측 2Y·10Y로만 산출한다. 기술지표·Weinstein Stage·멀티타임프레임·ticker/breadth 차트·RRG·McClellan·HY OAS는 필요한 관측 이력이 없으면 판정 보류한다. 공식 미래 일정은 snapshot 일정에서 동적 생성하고, AAII·NAAIM·한국 촉매·수출 자료는 기준일과 reference-only 용도를 표시한다. 한국 테마·시장건강도는 coverage와 현재 수급/VKOSPI가 부족하면 점수·등급을 만들지 않는다. 후속 전수 렌더에서 발견한 엔캐리 프록시의 하드코딩 입력, 이동평균 시각 없는 시장 레짐, OHLCV 없는 라운드 지지·저항, 비정규화 RSP/SPY 집중도, 출처 없는 한국 공매도 수치도 현재 결론에서 제거하거나 보류 처리했다.
- **violated_rule**: R301/R332의 currentness·lineage gate를 개별 값에는 적용했지만, 파생 결론과 시각화가 필수 입력 결측을 중립값·정적값·합성값으로 대체하는 경로까지 강제하지 못했다.
- **prevention**: R340과 T1024~T1027·T1037~T1039·갱신 T874, runtime contract가 만기 의미 분리, 합성 금리 금지, 결측 시 엔캐리 프록시 보류, 현재 OHLCV 없는 레짐/지지저항 보류, 비정규화 가격비율의 시장폭 결론 금지를 검사한다. 페이지 전수 semantic inventory와 CI에 합성 시계열·RRG seed·HYG→OAS·과거 일정의 현재 판정 재유입 금지를 추가한다.
- **verification**: BLS CPI, BEA PCE, Fed/BOK 일정, FRED 2s10s, Cboe put/call, NAAIM 공식값과 `public-data/data.json`을 대조했다. 22개 route semantic render, runtime/data-pipeline contract, Chromium headless, 접근성 22/22 및 viewport 88/88을 통과했다. Telegram/공식 원천과 22개 페이지 비교 결과는 `_artifacts/page-content-market-audit-2026-07-15.md`에 기록한다. 배포·커밋은 수행하지 않았다.

## P711 - v52.97 - Telegram 증분 digest가 전체 관측 커버리지와 최신 narrative를 동시에 잃었다

- **motivation**: 로그인된 Telegram Web에서 Aether Japan Research, Insider Tracking, BornLupin의 최근 5일 게시물 546건을 끝까지 수집해 스크리너의 페이지·종목·채팅 반영 상태와 전수 대조했다.
- **root_cause**: `lastPostId` 증분 수집은 capped `topItems`/`broadItems`만 다음 주기로 넘겨 저점수 게시물의 ID·태그 lineage를 소실했고, `count`와 채널 count가 전체 기간이 아니라 이번 fetch/보존 pool 규모를 나타냈다. producer는 themes/catalysts/categories/pageMap을 만들지 않았고 runtime normalizer는 동적 원문을 받으면서도 2026-07-03 정적 narrative를 유지했다. 분류기는 insider/earnings/flows/healthcare/japan이 없고 티커 추출도 소수 하드코딩 목록에 갇혀 있었다. 공개 미러 전면 실패 시 full scan은 빈 digest를 쓸 수 있었다.
- **fix**: 전체 기간 경량 `observedItems`와 capped 본문 payload를 분리하고 count/fresh/text-eligible/selected/coverage 의미를 명시했다. 현재 원문 기반 narrative·22-page map을 producer와 구형-artifact runtime fallback에서 재생성한다. 5개 태그와 22-route 소비 계약, SCREENER_DB 동적 alias 사전, page coverage audit을 추가했다. 전 채널 실패 시 이전 성공 digest 본문과 `generatedAt`을 보존하고 `attemptedAt`/실패 상태만 갱신한다.
- **violated_rule**: R215의 digest→화면→스크리너→채팅 환류를 원문 배열 존재 여부로만 판단했고 R262의 self-throttle을 전체 기간 lineage와 독립적으로 설계하지 않았다. R338의 timestamp 의미 분리도 count/coverage 의미까지 확장하지 않았다.
- **prevention**: R339, T830~T831, data/runtime contract가 전체 관측 lineage, capped payload 보존률, 동적 narrative 치환, 22-page map, expanded tags/ticker aliases, 실패 시 마지막 정상 digest 보존을 검사한다.
- **verification**: Telegram Web 546건(106/345/95) 대 기존 5일 보존 원문 254건(57/122/75)을 대조했다. syntax, version/data/runtime/structural/semantic/knowledge 계약과 Chromium headless 1084/1084, 접근성 22 routes, viewport 22×4=88, portfolio E2E 8/8을 통과했다. 공개 미러 Node 재수집은 3채널 모두 네트워크 실패해 기존 정상 artifact를 복구·보존했으며 이 실패를 성공 수집으로 승격하지 않았다. 전체 결과는 `_artifacts/telegram-5d-coverage-audit-2026-07-15.md`에 기록했다.

## P709 · v52.94 · Automated refresh exposed stale fallback-parity and producer-fixture assertions

- **motivation**: The post-refresh CI run `29388582785` passed 1082/1084 headless checks but exposed two data-dependent regressions before Pages deployment: T686 treated the dated `_fallback` mirror as live parity data, and T1022 could not simulate a disconnected screener when a direct server artifact was present.
- **root_cause**: `getSnapshotFallbackConsistencyAudit()` reported numeric drift without declaring the fallback's reference-only date semantics, while `_aioProducerState()` only applied `_aioScreenerLoadState` when direct artifact metadata was absent. The test suite therefore encoded stale assumptions about both reference data and fixture isolation.
- **fix**: The snapshot audit now exposes `fallbackAsOf`, `snapshotAsOf`, `referenceOnly`, and `parityRequired`; T686 accepts zero drift or explicit dated reference-only evidence. Explicit screener load-state fixtures now override direct artifact metadata, while normal runtime behavior preserves direct metadata when no fixture status exists.
- **violated_rule**: R308 enforcement gap; promoted to R337 for fixture precedence and explicit fallback-drift semantics.
- **prevention**: Added the R308/T686 runtime contract check, updated T686/T1022, and added the QA checklist closure. The test must be rerun after artifact refresh because the failure depends on the current snapshot/fallback relationship.
- **verification**: Local `node --check` and targeted runtime contract/headless tests after the patch; final Actions CI and Pages deployment must pass before release closure.

## P708 · v52.93 · 무료 대체 계획이 실행 workflow·행 lineage·공식 Put/Call 경로 없이 부분 완료로 남음

- **motivation**: `INSTITUTIONAL-DATA-READINESS-HANDOFF-2026-07-12.md`와 `DATA-SOURCE-REPLACEMENT-PLAN-2026-07-14.md`를 v52.92 실제 코드와 대조했다. `SCREENER_ONLY` 함수는 있었지만 workflow가 없었고, 새 validator가 현재 screener row의 `observedAt` 누락을 재현했다. Cboe CDN은 실제 403이었으며 client proxy 실패가 snapshot으로 되돌아가는 구조였다.
- **root_cause**: 대체 공급자 registry와 CLI 진입점 존재를 운영 연결과 혼동했고, 계약 검사는 artifact top-level `factorObservedAt`/breadth만 확인해 row lineage를 검사하지 않았다. Put/Call은 공식 HTML에 값이 있어도 오래된 CDN JSON과 공용 proxy를 계속 주경로로 사용했다. direct-run guard 5곳도 `process.argv[1]`이 항상 있다고 가정해 정상 import 환경에서 충돌했다. 지식 린트는 git-tracked 파일만 열거해 새 문서를 커밋 전에는 잘못된 orphan으로 판정했다.
- **fix**: 6시간 `refresh-screener.yml`, publish 전 `validate-screener-artifact.mjs`, 846개 row별 observation/source/use fields, 무료 SEC bounded companyfacts artifact, Cboe official delayed server ingest, 80% fundamentals coverage gate, free-plan-only dependency states를 추가했다. direct-run guard 5곳은 빈 argv를 안전하게 처리하고, 지식 린트는 non-ignored 신규 `_context/*.md`도 양쪽 문서 표와 대조한다.
- **violated_rule**: R333의 “구현 완료 분리”를 workflow/row/publish 수준까지 실행하지 못함. R334로 승격.
- **prevention**: data-pipeline/runtime contract가 독립 workflow, SEC/Cboe fixture, row lineage, semantic validator, free-only 상태를 검사한다. knowledge lint는 staged 여부와 무관하게 신규 지식 문서와 `INDEX.md`/`_context/CLAUDE.md` 양쪽 표를 검사한다. validator grep: `rg -n "validate-screener-artifact|observedAt|research-relative-ranking-only" .github/workflows/refresh-screener.yml scripts/fetch-data.mjs scripts/validate-screener-artifact.mjs`.
- **verification**: 새 screener 실제 생성 `846/870`, validator PASS, US 706/725·KR 140/145 breadth coverage 80%+, Cboe 공식 live page `total 0.93/index 1.01/equity 0.62/asOf 2026-07-14` 파서 PASS, SEC normalization fixture PASS. SEC live collection은 monitored contact를 담은 `SEC_USER_AGENT` 미등록으로 의도적으로 미검증/차단.


## P707 - v52.92 - 외부 수집 전면 실패가 마지막 정상 data.json을 빈 산출물로 덮어썼다

- **motivation**: 전체 데이터 자동 최신화의 남은 구조 문제와 외부 의존별 대체 API를 검증하는 과정에서 로컬 수집을 실행했다.
- **root_cause**: `fetch-data.mjs`가 핵심 시세 커버리지 50% 게이트를 파일 기록 뒤에 검사했다. 네트워크가 차단되자 77/77 실패 결과를 먼저 `public-data/data.json`에 기록한 뒤 종료해 마지막 정상값 보존 원칙을 위반했다. 전체 파이프라인과 870종목 스크리너 갱신도 하나의 실행 경로라, 스크리너만 안전하게 재생성할 수 없었다.
- **fix**: 핵심 시세 커버리지 검사를 첫 `writeFile(OUT)` 앞으로 이동해 실패 시 기존 파일을 보존한다. `enrichScreener()`를 export하고 `SCREENER_ONLY=1` 직접 실행 경로를 추가했다. 외부 의존 15개 카테고리를 구현/승인/라이선스/수동 상태로 분해한 `getExternalDependencyAudit()`와 대체 계획 문서를 추가했다.
- **violated_rule**: R332의 `attemptedAt`/`lastSuccessfulAt` 분리와 마지막 정상값 보존을 producer artifact publish 단계까지 적용하지 않았다.
- **prevention**: R333, data-pipeline contract, runtime LIVE3-11~12가 쓰기 전 커버리지 게이트, 독립 스크리너 경로, 외부 공급자 상태·권리·cadence 레지스트리를 검사한다.
- **verification**: 독립 외부 수집으로 스크리너 847/870, 미국 707/725, 한국 140/145를 생성했다. 관측시각은 미국 2026-07-14T12:00:10Z, 한국 2026-07-14T00:00:00Z이며 브레드쓰 커버리지는 각각 97.5%, 96.6%다. 복구된 핵심 `data.json`은 77/77 시세, F&G 44, FRED 19, 뉴스 40을 유지한다. Browser 플러그인은 호출 중단으로 검증 수단에서 제외했다.

## P706 - v52.91 - 파일 갱신 성공과 개별 관측 최신성을 혼용해 일부 정적·실패 데이터를 현재 판단처럼 보였다

- **motivation**: 20개 사용자 표면을 실브라우저로 읽고 조작하면서 개별 데이터가 실제 외부 자동수집·갱신 이력을 갖는지, 현재 시장과 맞는지, 알고리즘 입력으로 유효한지 3차 전수 진단했다.
- **root_cause**: 공용 `generatedAt`/fetch 성공을 개별 관측시각과 같은 의미로 사용했다. 그 결과 6월 26일 시장폭이 최근 일반 fetch 시각을 빌려 점수에 들어가고, Telegram 전 채널 실패도 새 `generatedAt`을 써 성공처럼 보였으며, 한국 수급 누락 문자열은 `Number()`를 거쳐 0/매도 방향으로 렌더됐다. 브리핑은 SPY를 S&P 500으로 부르고 존재하지 않는 `chgPct`를 읽었다. 점수 백테스트가 통계적으로 유의하지 않은데도 Buy/매수 밴드가 행동 허가처럼 보였고 비밀키 실값이 password input DOM에 복원됐다.
- **fix**: 시세 producer/consumer에 `regularMarketTime`→`observedAt`, `marketState`, 거래소 시간대를 보존했다. 지표별 freshness budget과 decision-evidence gate를 적용해 미검증 breadth/PCR/AAII를 판단에서 격리했다. Telegram은 `attemptedAt`/`lastSuccessfulAt`/`collectionStatus`를 분리하고 전부 실패하면 성공시각을 유지한다. 한국 수급은 형식화 숫자만 파싱하고 누락 시 값·막대·방향 라벨·기관/프로그램 정적 표를 모두 중립화하며, 한국 지수 소스가 0.75% 이상 충돌하면 오래된 Naver 덮어쓰기를 거부한다. 브리핑은 `^GSPC.price/pct`를 사용하고, 실패한 client F&G가 최신 서버 관측값을 정적 seed로 덮지 않게 했다. 점수 표현·용어사전 기대값·API 키 DOM 보관도 바로잡았다.
- **violated_rule**: R301의 개별 currentness envelope를 F&G에만 엄격히 적용하고 다른 데이터군의 파일 freshness·관측 freshness·수집 실패 의미까지 일반화하지 않았다.
- **prevention**: R332와 LIVE3-01~10이 비밀키 DOM, TDZ, 오래된 breadth, S&P 브리핑, 한국 수급 missingness, 한국 지수 소스 충돌, Telegram 성공시각, 비예측 점수 문구, 거래 관측시각 보존, 실패한 client F&G의 서버 관측값 보존을 검사한다. 22개 데이터 범주별로 source/observed/fetched/status/decision permission을 별도 기록한다.
- **verification**: `public-data/data.json`은 2026-07-14T10:25:27Z 기준 시세 77/77, F&G 44, FRED 19개, 뉴스 40개·8소스를 기록했다. S&P 500 7,515.34(-0.79%), Nasdaq 25,873.18(-1.55%), KOSPI 6,856.83(+0.73%), KOSDAQ 783.98(-1.92%)를 당일 외부 자료와 대조했다. 로컬 Chromium 19 primary+용어사전의 데스크톱·모바일 40렌더에서 pageerror 0을 확인했다. 별도 20초 후 currentness 재검증에서 F&G 44/`cnn-via-github-actions`/VALID 유지, 한국 수급 6값 `—`, 기관·프로그램 표 미수신 상태를 확인했다. Telegram·한국 수급·FMP·breadth/PCR/AAII는 성공으로 승격하지 않고 제한 상태로 남겼다.

## P705 - v52.90 - 시안 구조 검사는 통과했지만 비동기·빈 상태·닫힌 상태의 실제 사용자 여정이 분리돼 있었다

- **motivation**: 20개 사용자 표면의 1차 전수 진단 뒤 실제 사용자가 기다리고, 펼치고, 닫고, 데이터 실패를 만나는 흐름까지 2차로 확인해 구조적 문제를 모두 개선해 달라는 요청이 있었다.
- **root_cause**: 시안 계약과 기존 T869는 초기/최종 DOM의 섹션 수와 기본 노출 밀도를 잘 검사했지만, 외부 요청이 응답하지 않는 기업 분석, 서버 캐시로만 채워진 뉴스 헤더, 잘못된 컨테이너에 놓인 더보기, 닫힌 오프스크린 AI 포커스, 포트폴리오 0건, 한국 수급 실패처럼 `loaded/empty/degraded/closed` 상태 전환의 소유권과 종료 시간을 하나의 사용자 여정으로 검증하지 않았다. 한국 종목 수급은 100+30 연쇄 요청을 허용했고 테마 메모는 최초 요약 뒤 라이브 갱신 함수가 다시 전체 문장을 주입했다.
- **fix**: 기업 분석에 8초 총 예산과 병렬·부분 성공 렌더를 적용하고 0개 소스를 완료로 표시하던 상태를 명시적 실패로 바꿨다. 뉴스 취득 경로를 `_aioUpdateNewsSummaryFromItems()`로 통합하고 더보기를 시장 뉴스 피드로 이동했다. AI 패널은 닫힘 시 `inert`/`aria-hidden`/`aria-expanded`/포커스를 함께 전환한다. 국내 테마는 5종목·260자 기본 밀도를 라이브 갱신 뒤에도 유지하고, 한국 수급은 24개 직접 요청·종목별 프록시 재순회 제거·in-flight+10분 회로·단일 실패 설명으로 바꿨다. 포트폴리오 빈 상태, 브리핑 상단 시장 동인의 영어 원문, 모바일 조작 영역도 실제 상태 기준으로 보강했다.
- **violated_rule**: R329의 최종 렌더 계약을 섹션 노출 여부 위주로 해석했고 R330의 정보 위계를 네트워크 실패·0건·오프스크린 포커스까지 확장하지 않았다.
- **prevention**: R331과 T1015~T1020, runtime contract G2가 페이지 소유권, 제한시간, 단일 뉴스 상태, AI 포커스 경계, 테마 밀도, 빈 포트폴리오, 한국 수급 요청 상한, 브리핑 제목을 함께 검사한다. 표준 정적 게이트와 별도로 로컬 Chromium에서 20개 사용자 표면의 데스크톱/모바일 및 상태 전환 여정을 실행한다.
- **verification**: 최종 변경 모듈 syntax와 정적 12게이트, runtime contract G2, 기본 경로 UX, diff whitespace를 통과했다. Chromium headless **1081/1081 PASS**, 내부 22라우트×4뷰포트 **88/88 PASS**(overflow 0px·tiny text 0·JS error 0), 접근성 22라우트, 핵심 10면, 포트폴리오 vault 8/8을 통과했다. 별도 실제 사용자 여정은 19 메뉴+용어사전의 데스크톱/모바일 **40/40면**과 14개 상태 계약을 통과했으며 pageerror 0, 기업 분석 무응답 5.3초 수렴, 뉴스 12→24개 공개, 한국 수급 실패 대상 요청 26건·중복 경고 0건을 확인했다. 부팅은 FCP 1.07초·첫 라우트 1.40초였다.

## P704 - v52.89 - 사용자 페이지 20개와 내부 QA 라우트 22개를 혼용했고 남은 7면은 시안 정보 위계가 확장되지 않았다

- **motivation**: 13개 시안면은 정리됐지만 사용설명서·용어사전·한국 5면은 긴 기존 구조가 남았고, 검증 결과의 `22 routes`를 사용자 페이지 수처럼 설명해 실제 메뉴 구조를 오해하게 했다.
- **root_cause**: 라우트 계약은 이미 19개 `NAV_ROUTE`, 2개 `DERIVED_VIEW`, 1개 `REFERENCE`, 1개 `OVERLAY`를 구분했지만 UI 개수와 QA 순회 개수를 같은 용어로 보고했다. 시안 확장도 핵심 13면에만 적용해 교육·한국 시장 표면의 밀도 계약이 없었다.
- **fix**: 19개 메뉴 페이지와 용어사전 오버레이를 20개 사용자 표면으로 명시했다. 사용설명서는 검색+장별 아코디언, 용어사전은 267개 항목의 넓은 검색 모달, 국내 테마는 3개 우선 노출+더보기, 한국 홈/매크로는 핵심과 추가 탐색 분리, 수급/기술은 중복 뉴스·페이지 내 용어 설명을 통합 제거했다.
- **violated_rule**: R329의 최종 화면 정보 위계 계약을 13면에만 한정했고, 내부 구현 용어를 사용자 정보구조 설명에 그대로 사용했다.
- **prevention**: R330과 T869가 19 primary + 2 derived + 1 reference + 1 overlay 분류와 남은 7면의 점진 공개 구조를 함께 검사한다. viewport 스크립트에도 22가 내부 QA 라우트 수임을 명시한다.
- **verification**: 남은 7면을 로컬 Chromium 1440×900·390×844로 각각 렌더링해 pageerror 0을 확인했고 용어사전 267개 항목을 검증했다. 사용설명서 기본 높이 6,727→1,079px, 한국 홈 3,262→1,168px, 한국 매크로 4,985→1,803px로 축소됐다. syntax와 11개 정적 게이트, headless **1075/1075 PASS**, 내부 22라우트×4뷰포트 **88/88 PASS**(overflow 0px, JS error 0), 접근성 22 내부 라우트, 핵심 10면, 포트폴리오 vault E2E 8/8을 통과했다.


---

# 압축 원장 (P703 이하 — 원문 전문은 git 히스토리)

## P642~P703 · v52.27~v52.88 (FABLE UI/UX → WP-AI 계약 → 시안 재구축)

- P703 · v52.88 · 정적 시안 정리가 런타임 주입·무제한 목록·기존 재배치 로직까지 제어하지 못함 (R329)
- P702 · v52.87 · 시안을 기본 구조가 아닌 기존 화면 위 장식층으로 적용 — "접어두기"를 "정리 완료"로 취급 (R328)
- P701 · v52.86 · tool mutation·데이터 권리가 registry 게이트 없이 암묵적 (WP-AI19/20)
- P700 · v52.85 · coverage bias·human 사용성 인증이 바이너리 게이트가 아니었음 (WP-AI17/18)
- P699 · v52.84 · model replay·요청 격리에 release/finalization 계약 부재 (WP-AI15/16)
- P698 · v52.83 · retrieval poisoning 품질·금융 conduct legal-review 상태 부재 (WP-AI13/14)
- P697 · v52.82 · 요청 lifecycle·금융 산술이 강제 가능한 계약이 아니었음 (WP-AI11/12, CalculationEvidence)
- P696 · v52.81 · AI 운영/벤치마크/피드백에 단일 로컬 release 계약 부재 (WP-AI8~10)
- P695 · v52.80 · 자동 발행물에 공통 publish fallback 부재 + 페이지 계약에 AI projection 부재 (WP-AI6/7)
- P694 · v52.79 · 외부 데이터·포트폴리오 AI가 action boundary를 무계약 통과 (WP-AI4/5)
- P693 · v52.78 · 연구자료 전량 주입 — intent retrieval·결정론적 context budget 부재 (WP-AI3)
- P692 · v52.77 · typed claim/evidence 검증이 공유 AI 응답 경계에 부재 (WP-AI2)
- P691 · v52.76 · AI 공개 진입점들이 공통 요청/응답 계약 없이 완료·재시도·자동 콘텐츠를 각자 처리 (WP-AI1)
- P690 · v52.75 · 응답 검증이 경고-only, 자동 시장분석이 생성 성공만으로 렌더 — 공개 안전 경계 우회
- P689 · v52.74 · 일반 방문자 부팅이 배포·공유 준비도 전체 감사를 반복 실행 — 초기 페이지 전환 수 초 정지
- P688 · v52.73 · "이미 comp-compliant, 폴리싱만" 자기평가 오류 2회째 — 3페이지 전부 실제 구조 재구축 필요(사용자 직접 지적)
- P687 · v52.72 · 6페이지 "comp-compliant" 재검증 결과 최소 3페이지 오판 + 자체 콘텐츠 소실 버그 2건
- P686 · v52.70 · macro 재구축: 여는 div 삭제/닫는 div 잔존 + 재설계가 제거한 data-snap sink를 요구하는 테스트 충돌
- P685 · v52.70 · technical 재구축: CSS-var-alpha-suffix 클래스 3건 추가 + 전체 컨테이너 치환이 신규 지표 카드를 매 로드 삭제
- P684 · v52.68 · sentiment 재구축: JS 함수의 DOM-shape 의존(wrapper+sibling strong) 보존 필요
- P683 · v52.67 · breadth는 comp 재구축이 아예 미착수였음 + 라이브 호출 UI 함수에 네온 hex·영문 라벨 잔존
- P682 · v52.66 · briefing 스팟체크에서 독립 실버그 6건 (색 스윕 누락·영문 라벨 3·디버그 문자열 노출·dead 참조로 일정 섹션 영구 공백)
- P681 · v52.65 · signal 점수/레짐 섹션이 리디자인 이전 레거시 구조 + 부수 렌더 버그 3건
- P680 · v52.64 · 이모지 제거 후 U+FE0F 고아 variation-selector가 보이지 않는 무명 버튼 생성 — R309 2번째 사례
- P679 · v52.63 · style/id 속성 안 curly quote가 page-breadth getElementById를 조용히 파괴 (기존재)
- P678 · v52.62 · 이모지 일괄 제거 스크립트가 JS 문자열 내 조건 마커를 파괴 — "바닥 확인" 항상 5/5 (R309 신설)
- P677 · v52.60 · T830이 유효한 stale fallback 스냅샷을 거부 — fallback은 방향성·명시적 degraded로 검증 (R308)
- P676 · v52.59 · H2 2차 게이트: 접근성 폰트 계약·route settle 오탐·typed provenance·공개 artifact 종결
- P675 · v52.58 · CDN 소실 시 breadth 초기화가 partial Chart stub 상태로 레지스트리 접근
- P674 · v52.57 · 서드파티 CDN 장애가 리로드 후 로컬 부팅 큐 정지 가능
- P673 · v52.56 · 노트북 차트 고유폭 + silent 외부 피드 실패가 실제 사용자 상태 은폐
- P672 · v52.55 · 만료된 이벤트 서사·입력 결측 레짐이 점수 provenance 수정 후에도 현재형으로 들림
- P671 · v52.55 · F&G 다중 currentness 경로 — 라이브 스트립과 stale 합성값 불일치, stale 값의 점수 유입 가능
- P669 · v52.54 · CODE-MAP 파일 크기 표 무재검증 드리프트(최대 484줄) — ci-doc-currency 게이트 신설 (WO-8)
- P668 · v52.53 · 전역 read/write 인벤토리: timer/chart/page 어댑터는 기존재(갭은 채택률), snapshot adapter 부재, localStorage 직접 146 vs safeLS 8 (WO-7)
- P667 · v52.52 · viewport 게이트가 FULL_INIT=0 report-only — technical SVG 라벨-값 겹침 놓침 → 배포 차단 게이트 승격 (WO-4)
- P666 · v52.51 · lowvol 서브팩터 10년/120종목 백테스트 유의미 음의 상관, composite 전 구간 무의미 (WO-3, 코드 무변경·제품 결정 보류)
- P665 · v52.50 · 스코어 vol+trend+macro(가중 55%) 10년 백테스트 통계적 유의미 음의 상관 (WO-2, 코드 무변경·제품 결정 보류)
- P664 · v52.49 · evidenceAudit: 13개 실입력 중 6개 미등록 + 등록분도 화면 미반영 — 병합 연결 (WO-6)
- P663 · v52.48 · main 브랜치 무보호 + hooks 절대경로 전체 무력화 + auto-commit 과수집 + 버전 정규식 버그 (WO-5)
- P662 · v52.47 · /anthropic 프록시가 방어 전부 우회·호출자 인증 없음·KV 미바인딩 시 캡 무제한 — 계층형 강화+fail-closed (WO-1B)
- P661 · v52.46 · 포트폴리오 "AES-256 암호화" UI 주장 거짓 + PIN 잠금 게이트가 호출부 0건 고아 함수 (WO-1A)
- P660 · v52.45 · data-watchdog.yml mojibake 파손으로 워치독 사망 + 저장소 9,639건 mojibake 발견(7,486 복구) + ci-control-char 게이트 신설 (WO-0)
- P659 · v52.44 · Worker /anthropic anycast 403 자동 재시도 — 채팅·번역·브리핑 3함수 4호출부 (B8 완화, 근본은 CF 리전 미고정)
- P658 · v52.43 · kr-supply 진짜 원인은 프록시 차단이 아니라 404(부재 엔드포인트) + BOK 금통위 날짜 자체 오류 (EF Batch 4)
- P657 · v52.42 · 라벨·번역 정직화 5건 — 시드 시각구분·수급 라벨 모순·소스명 가드·F&G 델타 소스·기준일 배지 (EF Batch 3)
- P656 · v52.41 · 라이브 재검증 결과 발견 절반이 원 진단과 다른 실제 원인·규모 (EF Batch 2)
- P655 · v52.40 · technical/breadth/briefing이 표면마다 다른 값·미래 시각·asOf 없는 서술 (EF Batch 1)
- P654 · v52.39 · 22페이지 교육 레이어(핵심 개념·근본 원리·실전 적용) 공통 부재 → AIO_PAGE_FUNDAMENTALS 신설 (R291)
- P653 · v52.38 · 운영 구조 격차 5건 — 라이브 전용 회귀 재검증 부재·실브라우저 QA 티어 비공식·knowledge-lint 무강제 등
- P652 · v52.37 · Telegram market-note·credit/funding 신호가 수집 후 일부 페이지 표면에서 누락
- P651 · v52.36 · Telegram 최신 뉴스가 페이지별 시장 본질/라이브 감시로 충분히 미연결
- P649 · v52.34 · V0/V1 "완료" 후 잔존 — 브리핑 F&G 3번째 소스 + VKOSPI 실패 UI 부재
- P648 · v52.33 · quote가 DATA_SNAPSHOT.vix만 갱신하고 _fallback.vix stale → T686 배포 차단
- P647 · v52.32 · viewport matrix가 topbar 잘림·SVG 텍스트 기하를 아직 실패시키지 못했음
- P646 · v52.31 · breadth 색상 의미가 렌더러별 분산 — 공포 32%가 비적색 게이지 가능
- P645 · v52.30 · AI 채팅 preflight가 개인키만 인정 — Worker 서버키 모드 미인식
- P644 · v52.29 · 프록시 순서에 누적 성공 증거 부재·quote 카운트 라벨 모호·중복 뉴스 카드 미게이트
- P643 · v52.28 · 프록시 HTML 차단 페이지를 JSON 성공으로 취급·KR 실패에도 대기 UI 생존·값 슬롯 typed state 부재
- P642 · v52.27 · showThemeDetail 유효 데이터 크래시(P0)·theme-detail 고아 라우트·브리핑 F&G 이중 소스·KR 캔들 냉시동 공백 (FABLE V0)

## P553~P641 · v51.82~v52.26 (전면 감사 → FABLE 라이브 감사 시대)

- P641 · v52.26 · VKOSPI 미니차트가 하드코딩 한 달 전 20포인트 배열 — localStorage 누적으로 교체
- P640 · v52.25 · kr-technical 설명문에 제거된 TradingView 잔존 문구
- P639 · v52.25 · 티커 체크리스트 "시장" 점수는 별개 지표인데 라벨 공유로 자기모순처럼 보임 — 라벨 명확화
- P638 · v52.24 · 배포 Worker가 리포 /anthropic 라우트보다 구버전 — 운영자 재배포+시크릿 추가로 당일 해소
- P637 · v52.24 · Claude 번역 실패가 기계번역(Google) 대신 일반 템플릿으로 직행
- P636 · v52.24 · KOSPI/KOSDAQ 전일종가가 미국 휴장 인접 주간 1세션 stale — Naver 파생값 sticky 우선
- P635 · v52.24 · VKOSPI 폴백 시드에 라이브와 동일한 단정 "(정상)" 라벨 → "(폴백·정상 추정)"
- P634 · v52.24 · VIX 기간구조가 live VIX vs stale 시드 VIX9D 비교 — 실제 콘탱고를 패닉 백워데이션 오판
- P633 · v52.23 · 라이브 QA: 사용자 노출 placeholder·raw 소스 라벨·페이지별 모바일 overflow
- P632 · v52.22 · 헤드리스 green이지만 report-only + full-surface 감사가 제거된 brief 기대 + 내부 구현 노출
- P631 · v52.20 · 로드맵 항목이 이미 해소돼 있었음(자기 진단 오류 정정) + VCP server/client parity 게이트 추가
- P630 · v52.20 · 헤드리스 스킵리스트 전량 해소 (899/922→922/922)
- P629 · v52.20 · 추천 다양성 "최근 반복 감점 개수" 카운터가 항상 0
- P628 · v52.20 · signal 섹션 재배치 함수가 작성 시점부터 silent dead code (parentElement 등식 불성립)
- P627 · v52.20 · 스킵리스트 8건이 전부 R279 클래스 — 시점 관측값의 영구 리터럴 단언을 구조 속성 단언으로 재작성
- P626 · v52.19 · index.html의 dead `fetchKrDynamicData` 중복 선언 삭제 + 고아 KR fetcher 5개 개별 endpoint 검증 + 그림자 선언 CI 게이트 (R280)
- P625 · v52.18 · HY 스프레드가 같은 페이지 로드에서 독립 드리프트된 하드코딩 2값 — 단일 출처 위반
- P624 · v52.18 · technical "SPY 포지셔닝" 카드 영구 기본값(3M 0.0%/RSI 50.0) — 데이터 소스 미배선
- P623 · v52.18 · 스크리너 가격 컬럼 90% "—" — 서버가 이미 가진 데이터 미사용
- P622 · v52.18 · theme-detail 브레드크럼 영구 "—" + ETF 표 NVDA "Self" 오라벨
- P621 · v52.17 · 크로스채널 중복 뉴스(같은 실화·다른 채널 라벨)가 3중 dedup 통과 — word-bag 2차 필터
- P620 · v52.16 · ticker cockpit이 포트폴리오 미보유 방문자에게 가짜 P&L 데모 데이터 노출 + 자체 폴백을 파괴하는 DOM 버그
- P616 · v52.15 · 홈 경고 pill 11개 연속 노출 → 1줄 요약+펼치기 (사용자 3안 중 확정)
- P615 · v52.14 · 모바일 390px topbar 우측 버튼 클러스터 잘림
- P614 · v52.14 · 운영자 노트에 "N일 경과" 배지 부재
- P613 · v52.14 · AI 패널 빈 상태 인사 부재 + 페이지 자동 프롬프트가 이동 후 공유 입력창에 잔류
- P612 · v52.14 · 페이지 전환마다 마우스 사용자에게 파란 포커스 링 노출
- P611 · v52.14 · PUBLIC STATUS 카드가 영문 내부 감사 로그 문자열을 방문자에게 노출
- P610 · v52.13 · kr-technical TradingView KRX 하드 브레이크 → Naver 일봉+Chart.js 자체 캔들로 대체
- P609 · v52.12 · "30분마다 자동 갱신" tooltip이 실제 크론 실발화(1~4h)와 불일치
- P608 · v52.11 · briefing 헤더 단어 중간 잘림 — 무말줄임 slice 4곳을 단어경계+'…'로
- P607 · v52.10 · briefing/signal F&G가 어디서도 할당 안 되는 전역 참조 — 영구 "—" (→ window._lastFG)
- P606 · v52.9 · themes 사이클 칩과 본문 판정이 독립 계산 — 실제 모순 발생 (단일 소스 구독)
- P605 · v52.8 · VKOSPI 실시간 fetch가 후행 로드 파일의 중복 선언에 밀려 영구 dead code — 27.00 고정 (R280)
- P604 · v52.7 · MACRO_CALENDAR auto-advance가 요일-고정 발표일(NFP)을 불가능한 요일로 밀음 (R279)
- P603 · v52.6 · 9개 표면 뉴스 번역 사각 — 페이지 스트립/브리핑이 자체 선택 항목의 번역을 미요청 (R245)
- P602 · v52.5 · workflow_run 체크아웃이 트리거 시작 커밋 고정 — 매 봇 사이클이 이전 사이클 트리 검증·배포 (R278)
- P601 · v52.4 · Pages deploy 1회 재시도 — 별개로 보이던 "Run failed" 이메일 2건의 공통 근본
- P600 · v52.3 · marketState 구독 모델 성숙도 검토 + 신규 코드 규율 R276 신설 (Phase 3 완료)
- P599 · v52.2 · computeTradingScore 검증 하네스 구축 (인프라만, 표본 부족 명시)
- P598 · v52.1 · telegram-digest 중복 items 필드 제거 (~46% 감량)
- P597 · v52.0 · 코어 모듈 4종+glossary defer 전환 완료
- P596 · v51.99 · bump-version.mjs가 매 범프마다 _context/CLAUDE.md의 히스토리 버전 참조를 조용히 파괴
- P595 · v51.99 · eager 모듈 심볼 참조 22건 가드 + CHAT_CONTEXTS 소유권 위험 수정 (defer 선행)
- P594 · v51.98 · 스코어 알고리즘 index.html→aio-core.js 이관 (바이트 수준 동작 불변 증명)
- P593 · v51.97 · FRED 확장 시 다른 방법론 지표가 기존 라벨 아래 조용히 교체
- P592 · v51.96 · /data-refresh 전수에서 독립 실드리프트 3건 적발 (기계적 숫자 갱신이면 놓쳤을 것)
- P591 · v51.95 · 30분 데이터 커밋이 CI 미트리거 — 라이브 ~19h 조용한 stale
- P590 · v51.94 · 서버 스크리너 유니버스를 JS 소스 텍스트 문자열 검색으로 추출 (취약)
- P589 · v51.92 · 진단서의 Stooq 폴백 권고가 실제로는 PoW 챌린지 차단으로 불가
- P588 · v51.91 · 900+ 브라우저 테스트 스위트에 CI job 부재 — 사람이 콘솔 열어야 회귀 발견
- P587 · v51.91 · 배당 미조정 종가로 모멘텀/추세 팩터 구조적 과소평가
- P586 · v51.91 · 백테스트 패널이 라이브 composite 검증처럼 표시 — 실제는 고정가중 4팩터 부분집합
- P585 · v51.91 · HY-spread 매핑이 아무도 읽지 않는 합성 FRED id에 기록
- P584 · v51.91 · 서버 Cutler RSI vs 클라이언트 Wilder RSI — 같은 "RSI(14)" 라벨, 다른 숫자
- P583 · v51.90 · _context/CLAUDE.md 이중 인코딩 파손 + CODE-MAP 60버전 stale
- P582 · v51.90 · OneDrive 동기화 충돌로 로컬 .git 파손 (loose objects 2.4GiB)
- P581 · v51.89 · value 팩터가 자연 스케일 상이한 3배수를 비정규화 평균 — 사실상 단일 팩터로 붕괴
- P580 · v51.89 · size 팩터 부호가 학술 SMB 정의와 정반대
- P579 · v51.88 · MACD histogram 앞 8값 isFinite(null) 함정 오염
- P578 · v51.88 · Bollinger 표준편차 분모 모집단 이탈
- P577 · v51.88 · 주봉 청킹 앞-앵커로 최신 1~4일 누락
- P576 · v51.88 · 신용 스트레스 입력이 FRED OAS 실측 대신 듀레이션 오염 HYG 근사 우선 ★반복 클래스 기점
- P575 · v51.87 · OPEX 날짜가 UTC+ 시간대에서 하루 앞당겨짐
- P574 · v51.86 · Sortino 하방편차 분모 비표준 — ~46% 과소평가
- P573 · v51.85 · 개인 FRED 키가 서드파티 CORS 프록시로 평문 전송 가능
- P572 · v51.84 · [skip ci] 데이터 커밋이 CI-gated 배포 이후 라이브 미도달
- P571 · v51.83 · TG scraper self-throttle 부재 — 30분마다 14일 전체 재탐색
- P570 · v51.83 · sentiment 같은 카드에 서로 다른 F&G 2값
- P569 · v51.83 · _aioRenderOperatorNote 3중 정의 (2개 영구 dead)
- P568 · v51.83 · breadth 캔버스 재방문마다 mouseleave 리스너 누수
- P567 · v51.83 · 전역 채팅 패널에 per-page 채팅의 DOMPurify 계층 부재
- P566 · v51.83 · 티커 최근 검색 저장 self-XSS (입력 검증·이스케이프 부재)
- P565 · v51.83 · FRED per-series 실패 완전 silent
- P564 · v51.83 · refresh-data push가 pull/rebase 없이 — 실제 race 발생 이력
- P563 · v51.83 · 오태그 뉴스가 AI 브리핑에서 조작처럼 들리는 섹터 분석 유발
- P562 · v51.83 · breadth 50SMA 큰 숫자가 자기 바/문장과 모순
- P561 · v51.83 · KR 홈 "상위 상승"에 -3.40% 종목
- P560 · v51.83 · fundamental 불가능/자기모순 재무 표시 (독립 근본원인 4건)
- P559 · v51.83 · P553 점수 불일치 클래스 signal 재발 (타이밍 아닌 모드 불일치)
- P558 · v51.83 · Telegram 피드 XSS — 외부 원문 innerHTML 원시 삽입 9페이지
- P557 · v51.82 · GitHub Pages가 CI 결과와 무관 배포 — 깨진 push가 라이브行 (build_type workflow 전환)
- P556 · v51.82 · "jsDelivr CDN 실패" 경고가 사실상 매 로드 오탐
- P555 · v51.82 · CI 33% 실패가 선행 버전 동기화 파손을 무관 커밋들이 상속한 것
- P554 · v51.82 · 홈 "핵심 뉴스"가 자기가 부스트한 항목에서 영구 [번역 대기]
- P553 · v51.82 · 홈 결론 헤더 vs 점수 게이지 숫자 불일치 (스코어 캐시 부재)

## P464~P551 · v49.101~v51.81 (evidence 계약·페이지 currentness 시대)

- P551 · v51.76 · 공개 준비도가 콘솔 감사로만 존재 — 홈 가시 표면화 (R239)
- P550 · v51.75 · 정적 `● LIVE`·rolling 48h 라벨 잔존 (R238)
- P549 · v51.74 · 페이지 currentness 과대표현 + 뉴스 윈도 라벨 드리프트 (R238)
- P548 · v51.71 · calcTechnicalSnapshot 신규 필드가 UI/AI/아티팩트 소비 경로 부분 미연결 (R235)
- P547 · v51.66 · 카테고리별 데이터 기준 시각 추적 부재 — 시간적 비일관성 노출 불가
- P546 · v51.65 · FMP 403/401 플랜 오류 silent — 밸류/퀄리티 팩터 미반영
- P545 · v51.64 · 주말 수집 시 chartPreviousClose로 주간 변동률을 일간으로 오표시
- P544 · v51.63 · DATA_SNAPSHOT *Pct에 주간 변동률 오기입
- P543 · v51.63 · 8개 지수 프로퍼티가 주석 안에 묻혀 미정의
- P535~P542 · v51.44~v51.47 · 스크리너/백테스트 정밀화 6건 — Kalman raw scale·측정노이즈 하드코딩, Bollinger 모집단 분산, stageEstimate Stage2/3 미구분, COMP_W dead key, FAILED_RETEST 미발화, Minervini 설명>계산, watchdog 48h 게이트 부재
- P534 · v51.43 · 시각 위계가 구 터미널 컨셉 잔존 (visual refresh)
- P533 · v51.42 · 라이브 기본 경로 unsafe toFixed (→ _aioSafeFixed)
- P532 · v51.40 · 운영자 노트가 첫 화면 결정 흐름 아래 매몰
- P526~P531 · v51.30 · Maker-Checker 광역 추천 누락·R1 게이트 실패, placeholder 노트·macro overflow, 모바일 폭 누수, 빈 그리드 트랙·접힘 노이즈, workflow summary 문법 파손, 뉴스 랭킹 약체 선정
- P525 · v51.30 · var _SECTOR_KEYWORDS가 const와 충돌 — chatSend 파일 전체 미실행
- P522~P524 · v51.08 · 스크리너 첫 진입 빈 테이블 · CORS 실패 시 뉴스 캐시 빈 배열 덮어쓰기 · krDynamic 스케줄러 세션 전체 silent no-op
- P513 · v50.89 · audit-only 완료 패턴이 semantic gap 은폐 → semantic review 게이트 신설 (R219)
- P514 · v50.89 · workflow helpers/skills가 append-only 메모리로 비대화 → compaction 게이트 신설 (R220)
- P515~P521 · v50.90~v50.98 · T번호 중복/dead·TG memo overlay 미갱신·source-to-consumer CI 계약 부재(P517/R222)·번역 저하·cachebuster 은폐·한국어 rewrite 표면 부재·서버 뉴스 최신순 선정
- P500~P512 · v50.55~v50.88 · 감사 정적 추정 혼재(오탐/은폐)·계약/KST/KR 카드 진실 원천 분열·scope/복합 sink 게이트·채팅 과수렴/과억제/다양성·통합 답변 계약·TG digest 소비 루프·fold 취약 선택자·runtime contract drift·notes without gates·매매 문구 과신
- P482~P499 · v50.9~v50.24 · 동기함수 .catch(silent reject)·_breadth200 폴백 오라벨·sentiment lazy-init 빈 차트·yield curve 영구 대기·themes 정적 진단 모순·스토리라인 전제 역방향·CP stale 읽기·50SMA readout 모순·미로딩 기본값 75·exit trigger 라벨 과장·F&G 페이지간 정반대 결론·breadth verdict 부호 버그·kr-technical undefined 렌더 2건·VaR 이중부호·존재하지 않는 패널 자동전송·SPX ATH 하드코딩 오표시·가상 태스크 참조 no-op
- P481 · v50.6 · breadth participation이 200일선 사유화 (5/20/50만 보는데 200 표시+로직 잔존)
- P464~P480 · v49.101~v50.4 · 근본 규칙 수립 시대 — 중앙 refresh state(R188)·페이지 프로파일 union(R189)·가시 표면 전수 freshness(R190/R193)·강제 fresh preflight(R191/R192)·DataTruthGate(R195)·교차 소스 검증(R196)·DOM 바인딩 검증(R194)·현재 시장 대조(R197~R199)·21페이지 evidence 계약+배포 게이트(R200)·뉴스/텍스트/캘린더 계약(R203~R205)

## P316~P463 · v49.57~v49.97 (AI 채팅 심층 보강·전수 감사 시대 — 시대 요약)

개별 원문은 git 히스토리 참조. 주요 계보:
- **환각 차단**: 시세 실패 시 가격 인용 HARD STOP(P406/P432), 학습 데이터 자기 인용 차단(P397), 날짜 토큰 stale 검출(P403), ABSOLUTE RULES 후처리 검증(P401), 세션 시각 헤더(P388)
- **silent fail 정직화**: dynamicTickerLookup 폴백 체인(P352/P415), chatSend silent return 5경로(P410), callClaude 실패 안내(P411), Promise.all 타임아웃(P321), QuotaExceeded(P424)
- **커버리지/레지스트리**: TICKER_NAME_REGISTRY 47→152+(P316/P339/P428), CIK_MAP 확장(P408계열), CHAT_CONTEXTS DOM 매트릭스 16 부재 발견(P400/P420), options/ticker/market-news/home 컨텍스트 누락(P319/P325/P391/P398)
- **XSS/코드 위생**: escHtml 누락 표면(P433/P434), 정규식 인젝션(P434), var hoist 충돌(P438, P311 클래스), KR 코드 다중 위치 cross-check(P441)
- **fundamental 15기준**: 9/15 학습 의존 발견(P272)→SEC/Wiki 무료 API(P273)→registry+가용성 배지(P275~P281)
- **cell-level 전수**: 구조가 아닌 "값" 정확성 검증(P451/P452), WebSearch 값 상식 검증(P453), DATA_SNAPSHOT stale 스윕(P454~P456), 본체↔_fallback drift 가드(P459), pull-only audit의 push 레이어(P461), on-enter 갱신(P463)
- **운영**: manifest.json 삭제로 SW 캐시 전체 마비(P310 CRITICAL), aio-data.js parse 실패(P311 CRITICAL), API 키 단일 저장소 위험(P312), Claude 키 미입력 silent fail(P329)

## P213~P315 · v49.22~v49.49 (근본수정 registry 시대 — 시대 요약)

- 임계값·라벨 단일 출처(THRESHOLD_REGISTRY/SCORE_SCALES, P220/P224~P228), 가중치 공개(P229), 사이클 동적화(P233), ACTION_RULES/PAGE_PURPOSE(P234~P236), 시나리오 시간 의존(P237), 지정학 단일 출처(P259)
- **메타 패턴 P239**: "인프라만 추가하고 페이지 적용 누락"(R73) — P240~P251에서 23개 항목 페이지 적용으로 상환
- 정적 콘텐츠 lifecycle(P253, Jensen 58일), KOSPI 인라인 괴리(P252), data-snap 바인딩(P258), 페이지 sequential audit 도입(P282~P293), data-action 미정의 핸들러 탐지(P291), LIVE_SYMBOLS coverage(P317/P318 2차 세트)
- ※ P316~P319는 번호 중복 2세트 존재(v49.48~49와 v49.57~58) — 당시 넘버링 실수, 본 원장에서는 병기로만 기록

## P1~P212 · v31~v49.21 (구형 포맷 시대 — 시대 요약)

구형 "BUG-N" 포맷·P41~P144 인덱스는 git 히스토리 참조. 현재도 유효한 핵심 패턴은 QA-CHECKLIST 부록 "반복 실패 방지 특별 체크"와 RULES.md에 흡수됨:
- P24 벌크 data-live-price 자식 파괴 (children.length 체크) · P25 `.pct||0` 금지 (R15) · P28 3글자 미만 키워드 오탐 (R17)
- P41~P68: v42 시대 QA 발굴 — P56 init 이중 cleanup·P57 고정 그리드 모바일 overflow·P58 applyDataSnapshot map↔HTML 역방향·P59 API 의존 전역 초기화 순서·P60 크로스페이지 공유 함수 연결·P61~P63 이벤트 후 텍스트 정합·P64 KNOWN_TICKERS 동시 등록
- P106~P110 UX 실전성 (결론 바·fb-estimated) · P126~P131 아키텍처 감사 (DOM 폴백 불일치·이벤트 중복 dispatch·prompt() 금지·스트리밍 truncation·프록시 cooldown)
- PR-P132~P138 예방적 리팩토링 — onclick 인라인 253건 제거·staleness 감지·sed 치환 범위(3회 재발)·주장-실체 불일치 Hook·canvas CSS var
- P139 scroll-chaining 전 페이지 스크롤 불가 · P140~P143 CDN SRI(R34)·setInterval ID(R9)·R15 재발·_lastFetch 키 불일치 · P144 포트폴리오 벤치마크 커버리지

### P769 — market-news primary feed owner transfer (2026-07-22)

- motivation: The native news module existed, but the primary market-news feed was still attributed to legacy ownership in the retirement and operations artifacts.
- symptom/reproduction: renderFeed() and legacy loading/error/count/progressive writers could continue targeting live-news-feed while src/ui/pages/news.js rendered the same route.
- root_cause: The earlier RM-01 DOM intersection cleanup removed native competing writes but did not complete the legacy primary-feed writer transfer or update the derived ownership artifacts.
- fix: src/ui/pages/news.js now owns the primary feed DOM from canonical news state; legacy filter/type/sort/translation paths only update explicit inputs or dispatch aio:newsSurfaceInvalidated. Removed renderFeed() and the legacy primary-feed writers; updated route, retirement, and operations ledgers.
- violated_rule: R352 / AG-DOM-WRITER — a renderer cutover must transfer the executable owner and retire all primary-container writers.
- prevention: Keep native markers, legacy-symbol absence, source-level invalidation boundaries, and Chromium route assertions in the architecture/data-pipeline/retirement gates. Briefing remains a separate next cutover.
- verification: node --check, architecture, data-pipeline, runtime, ESM, domain parity, retirement, operations, Chromium 17-route round-trip (browserErrors:0), and headless 1098/1098 PASS.

### P770 — briefing primary feed owner transfer (2026-07-22)

- motivation: P769 transferred market-news, but briefing still had multiple legacy primary-feed writers and was the remaining contested news container.
- symptom/reproduction: legacy initialization and timeout paths could write briefing-live-news-list, counts, timestamp, empty/error states, and reveal controls while the native news module was mounted.
- root_cause: briefing combined a deterministic news wall, AI fallback, digest, and cap/toggle helpers in separate legacy hooks; route lifecycle ownership had been mistaken for primary content ownership.
- fix: native news.js now renders the briefing model into the primary list with safe DOM nodes, completed 08:00 KST semantics, count/timestamp, and reveal control. Legacy render/AI/cap/toggle paths now dispatch invalidation or retain secondary narrative compatibility without primary DOM writes.
- violated_rule: R352 / AG-DOM-WRITER — complex content routes still require one primary container owner and a complete delete ledger.
- prevention: route-specific native/feed markers, legacy symbol absence, zero primary briefing IDs in legacy bundles, retirement/operations reconciliation, and Chromium assertions are required before the next route cutover.
- verification: syntax, runtime, architecture, data-pipeline, retirement, operations, Chromium briefingRenderer/native feed marker with browserErrors 0, and headless 1098/1098 PASS.

### P771 — macro primary metric surface had native/legacy last-writer risk (2026-07-22)

- motivation: ARX-07 required a real macro renderer transfer, but the route contained 41 live quote/snapshot sinks whose global legacy passes still wrote after the thin native market slice mounted.
- symptom/reproduction: a native renderer could display a macro value and then be overwritten by `applyLiveDataToDom`, `applyLiveQuotes`, `applyDataSnapshot`, FRED, BOK, or KOSIS callbacks; the risk was timing-dependent and invisible in a static route marker.
- root_cause: lifecycle ownership had been treated as renderer ownership, while quote/FRED projection remained document-global. The original macro module only stamped route metadata and did not render the existing primary metric surface.
- fix: `src/ui/pages/market.js` now renders macro primary `[data-live-price]`, `[data-live-chg]`, and FRED-backed `[data-snap]` sinks from the existing compatibility inputs. Added a native macro marker and explicit legacy-element fence across quote/snapshot/FRED/BOK/KOSIS writers. Curve/chart/event-freshness/narrative ids remain documented secondary legacy boundaries.
- violated_rule: R352 / P770 reinforcement — a native primary surface requires one executable owner and explicit fencing of every legacy writer that can reach that subtree.
- prevention: architecture/data-pipeline contracts require the native macro renderer markers and legacy fence; Chromium asserts 41 live and 46 snapshot sinks under the native marker, plus zero browser errors on the 17-route two-lap round trip.
- verification: syntax, architecture, data-pipeline, retirement, operations, Chromium (`macroRenderer:native`, `macroPrimaryRenderer:native`, browserErrors 0), runtime/ESM/domain/static/release/version/doc/knowledge contracts, and headless 1098/1098 PASS.

### P772 — fxbond primary metric surface had native/legacy last-writer risk (2026-07-22)

- motivation: ARX-07 continued the market route sequence after macro, and fxbond still exposed shared live quote and MOVE snapshot sinks under a legacy renderer while `market.js` owned only the lifecycle marker.
- symptom/reproduction: route navigation could mount the native market slice while legacy quote/snapshot passes and `applyDataSnapshot` continued rewriting fxbond `[data-live-*]` and `[data-snap="move"]` elements; chart and risk writers were separate secondary paths.
- root_cause: the shared market module was route-aware only for macro, and the legacy fence was scoped to `#page-macro`, leaving the fxbond subtree outside the single-writer boundary.
- fix: `src/ui/pages/market.js` now renders fxbond live quotes and MOVE from existing compatibility inputs, adds the native fxbond marker, and shares the guarded market-element fence. Legacy quote/snapshot passes skip native fxbond elements; risk, spread/carry narrative, and chart ids remain explicit secondary boundaries.
- violated_rule: R352 / P771 reinforcement — every native primary metric surface requires one executable owner and an explicit fence for every legacy writer reaching the same route subtree.
- prevention: architecture/data-pipeline contracts require the fxbond renderer/fence markers; Chromium asserts native fxbond live/MOVE sinks during the route sequence and the full 17-route two-lap pass.
- verification: node --check, architecture, data-pipeline, retirement, operations, Chromium fxbond native markers/live/MOVE sinks with browserErrors 0, runtime/ESM/domain/static/release/version/doc/knowledge contracts, and headless 1098/1098 PASS.

### P773 — breadth primary current-metric surface had a native/legacy writer and artifact-access gap (2026-07-22)

- motivation: ARX-07 route sequencing reached breadth after macro/fxbond, but its current 5/20/50SMA cards and advance ratio were still written by legacy snapshot/init/bar functions while the native market slice only owned lifecycle.
- symptom/reproduction: mounting the native breadth route could leave the primary cards exposed to `applyDataSnapshot`, `_aioSyncBreadth50Readout`, `updateBreadthBars`, `initBreadthPage`, or `updateBreadthUI`; the first browser probe also showed the native route rendering `—` because `AIO_ARCH` did not expose the native screener state metadata.
- root_cause: breadth primary ownership was not separated from secondary stage/diagnostic/chart paths, and the compatibility facade exported native screener rows but not the metadata state containing the timestamped breadth artifact.
- fix: `src/ui/pages/market.js` now owns the four primary current-metric sinks, prefers `AIO_ARCH.getScreenerState().metadata.breadth.segments.us`, and falls back to the legacy evidence helper only when necessary. Added the native breadth fence to snapshot/bar/init/advance writers and exposed `getScreenerState` through `src/legacy/compatibility-facade.js`.
- violated_rule: R352 / P772 reinforcement — a bounded native surface requires one executable owner, an evidence-reachable input, and explicit fencing of every legacy writer reaching the same subtree.
- prevention: route-owner, retirement, data-pipeline, and Chromium contracts assert the breadth native marker, four primary sinks, artifact-state access, and legacy fences; secondary chart/diagnostic/narrative ids remain listed until their own packet.
- verification: syntax, architecture, data-pipeline, retirement, operations, Chromium breadth values `35%/47%/55%/34.8%`, browserErrors 0, 17-route two-lap round trip, and headless 1098/1098 PASS.

### P774 — declaration-only legacy cleanup after native feed cutovers (2026-07-22)

- motivation: P769/P770 removed the live primary-feed writers, but declaration-only news/briefing/screener functions and only-dependent sparkline helpers remained in runtime files; structural CI and the briefing retirement tests still treated part of that retired surface as active.
- symptom/reproduction: `ci-structural-check.mjs` reported declaration-only named functions; the first post-cleanup headless run was `1096/1098` because T890/T940 still expected the retired `_generateAIBriefing` symbol and pipeline writer.
- root_cause: legacy caller/writer removal and declaration retirement were completed in separate passes, while tests encoded the pre-retirement presence of the briefing helper instead of the native owner boundary.
- fix: removed declaration-only news/briefing/screener functions and only-dependent sparkline blocks, removed the dead inline screener analysis helper, and updated T890/T940 to assert native briefing ownership with an absent legacy function accepted as the retired state.
- violated_rule: R352 / R3 — a completed native cutover must retire declaration-only legacy surfaces and keep structural/browser contracts aligned with the delete ledger.
- prevention: every route cutover now closes named-function declarations, dependent helpers, and test expectations in one retirement packet; structural CI and headless tests are required before the next route packet.
- verification: `node --check` for touched runtime modules, structural/control-character/architecture/data-pipeline/retirement/runtime gates, Chromium 17-route two-lap round trip with browserErrors 0 and native breadth values `35%/47%/55%/34.8%`, and headless `1098/1098 PASS`; live invariant fetch remains unverified because the deployed site was unreachable in this environment.

### P776 — theme-detail derived-route declaration retirement (2026-07-22)

- motivation: the route ledger treated `theme-detail` as a separate legacy route, but the runtime canonical contract redirects it to `themes` and opens an inline panel; an old static-page renderer declaration remained in the file without a caller.
- symptom/reproduction: repository-wide search found `renderPageThemeDetail()` with one call from `showThemeDetail()` plus a stale placeholder comment; `showPage('theme-detail')` explicitly canonicalized to `themes`, where `showThemeDetail()` owns `#theme-detail-panel`.
- root_cause: the former standalone detail page was retained after the inline-panel migration, while the inline caller still invoked its obsolete static-page renderer and route ownership was tracked at a different abstraction level.
- fix: removed the standalone `renderPageThemeDetail()` function and its inline-panel call, corrected `theme-detail` route-owner evidence to the live inline panel, and added `retiredLegacySymbolsMustBeAbsent` checks to architecture/retirement contracts.
- violated_rule: R352 / R3 — route ownership must follow executable runtime behavior, and dead compatibility declarations must not remain after their canonical route is retired.
- prevention: derived routes now require an explicit canonical redirect and live inline-writer record; dead derived-route declarations receive a dedicated absence assertion rather than being folded into native-route symbol checks.
- verification: syntax, architecture (`explicitWindowWrites/directFetch/directStorage/htmlSinks = 1080/40/186/377`), retirement, operations, doc-currency, and headless `1098/1098 PASS`; existing Chromium 17-route two-lap evidence remains `browserErrors:0`; live invariant fetch and operator rights/soak remain unverified.

### P780 — bounded portfolio readiness/status native surface (2026-07-22)

- motivation: the portfolio route had a native slice and encrypted Vault orchestration, but its page module was correctly marker-only because the holdings table, totals, prices, CRUD, risk, and chart surfaces had active legacy writers. One independent readiness/status sink could be transferred safely without touching those contested surfaces.
- symptom/reproduction: `#pf-analysis-status` remained a static "포트폴리오 등록 후 자동 계산됩니다." message even when the native portfolio slice changed; route ownership still classified the entire renderer as legacy because the previous native module's table rewrite was unsafe.
- root_cause: the earlier native portfolio renderer conflated slice availability with ownership of the full table. Its `replaceChildren()` 5-column fallback could race the legacy 9-column table, while no writer audit had isolated the status sink as an independently owned surface.
- fix: `src/ui/pages/portfolio.js` now owns only `#pf-analysis-status`, emitting fail-closed empty/unavailable state or position-count readiness text with source-kind/source-label/operational-use/observed-at lineage. It no longer rewrites the contested holdings table. Route owners/retirement/operations/browser contracts count only this bounded surface as native.
- violated_rule: R352 / P780 reinforcement — portfolio readiness may be native only as a bounded status surface; Vault consent, mutations, legacy table/totals, risk, and chart owners must remain explicit until reconciled.
- prevention: before the portfolio ARX/RM-09 cutover, inventory every CRUD, storage, quote, risk, AI, and chart writer separately; keep native readiness fail-closed and never let a status marker imply encrypted storage or full portfolio ownership.
- verification: portfolio syntax, architecture (`1081/40/186/377`), retirement, operations, runtime, data-pipeline, structural, control-character, version, doc-currency, Chromium portfolio status sink `1/1` with browserErrors `0`, 17-route resources `42→42 / 12→12`, and headless `1098/1098 PASS`; full Vault/CRUD/table/risk/chart ownership, live invariant, rights, soak, and deployment remain open.

### P779 — bounded fundamental SEC status native surface (2026-07-22)

- motivation: the fundamental route already had a native entity provider fetching normalized `sec-fundamentals.json`, but the route still exposed a static `fund-data-status` badge with no source/coverage lineage and the full report had multiple legacy asynchronous writers.
- symptom/reproduction: the browser route could load the native entity state while `#fund-data-status` remained a generic `● DATA 확인` badge; SEC coverage was only 14.1% and the full report still combined SEC/FMP/Yahoo/Finnhub data through `fundamentalSearch()` and `_renderFund*` functions.
- root_cause: the provider/normalizer boundary and the fundamental report writer boundary were not the same ownership problem. Claiming the full report native would create a partial-data and last-writer migration, while leaving the unowned availability badge implied stronger freshness than the artifact guarantees.
- fix: `src/ui/pages/entity.js` now owns only `#fund-data-status`, deriving fail-closed availability and `official-regulator`/`SEC EDGAR companyfacts` lineage from normalized fundamentals. The full report, charts, and narrative remain explicitly legacy-owned; route owners and retirement ledgers count only this bounded status surface as native.
- violated_rule: R352 / P779 reinforcement — a fundamental route may transfer an independently owned provenance/status surface only when the normalized artifact carries explicit coverage; a bounded native marker must not imply full report ownership or coverage.
- prevention: before a fundamental report cutover, reconcile SEC coverage, provider rights, async cancellation, and every `_renderFund*`/`fundamentalSearch` writer. Keep a separate status surface with source-kind and observed-at attributes until that packet is complete.
- verification: entity syntax, architecture (`1081/40/186/377`), retirement, operations, runtime, data-pipeline, structural, control-character, version, doc-currency, Chromium fundamental status sink `1/1` (`● SEC 연간 데이터`, `official-regulator`) with browserErrors `0`, 17-route resources `42→42 / 12→12`, and headless `1098/1098 PASS`; full report ownership, live invariant, rights, soak, and deployment remain open.

### P778 — bounded options replacement-metric native surface (2026-07-22)

- motivation: the options route was an explicit no-options-chain stub, but its three current replacement metrics still had no native renderer owner and the shared quote/snapshot/PCR passes could overwrite a future bounded surface.
- symptom/reproduction: `#page-options` exposed VIX, PCR, and SKEW sinks through generic `data-live-*`/`data-snap` paths; `_aioUpdatePutCallDom()` directly included `opt-pcr-val-secondary`, while `applyLiveDataToDom()` and `applyDataSnapshot()` had no options-native fence.
- root_cause: the entity compatibility projection carried only an unused legacy options blob, so the route module had no normalized VIX/PCR/SKEW evidence shape and could not claim a writer boundary without creating a last-writer race.
- fix: `compatibility-facade.readEntity()` now projects VIX/PCR/SKEW value/sourceKind/observedAt into `entity.options`; `entity.js` owns the three explicit replacement-metric IDs with reference-only lineage; shared quote/snapshot/PCR paths fence the native options subtree; the legacy direct PCR ID writer is removed. The page remains explicitly no-options-chain/reference-only.
- violated_rule: R352 / P778 reinforcement — a native bounded metric surface must transfer source/provenance with the normalized state, fence every shared writer reaching the subtree, and never imply an unavailable options-chain provider.
- prevention: every metric cutover must inventory generic attribute writers as well as direct ID writers, give the native sinks stable IDs, assert raw/native sink parity in Chromium, and keep provider/operational use visible on the DOM.
- verification: touched-module syntax, architecture (`1081/40/186/377`), retirement, operations, runtime, data-pipeline, structural, control-character, version, doc-currency, Chromium options native primary sinks `3/3` with browserErrors `0` and 17-route resources `42→42 / 12→12`, and headless `1098/1098 PASS`; options-chain/provider rights, live invariant, soak, and deployment remain operator-required.

### P777 — bounded ticker hero native surface and explicit title-ID preservation (2026-07-22)

- motivation: ARX-04 continued from the native entity provider, and the ticker route still had a legacy-owned hero even though the normalized entity state was available. The first Chromium cutover probe also exposed a shared accessibility initializer that rewrote the explicit ticker hero ID.
- symptom/reproduction: after `showTicker('AAPL')`, entity state was current and the route marker was native, but `#ticker-hero-name` was absent from the DOM while the other three primary sinks rendered. At `DOMContentLoaded`, the generic `.page-title` accessibility pass had renamed the original `ticker-hero-name` node to `page-ticker-label`.
- root_cause: native route sink identity was treated as a presentation detail by the pre-existing accessibility initializer (`title.id = pageId + '-label'`), so a stable ID required by the route contract was overwritten before the native renderer ran. The P777 cutover also needed to remove the legacy primary writes from `showTicker()` without touching secondary ticker surfaces.
- fix: `src/ui/pages/entity.js` now owns only the four bounded ticker hero sinks from normalized entity state; `showTicker()` retains secondary overview/candle/entry/P&L writes but no longer writes the primary hero. `js/aio-ui.js` now preserves an explicit `.page-title` ID and generates a fallback label only when no ID exists. Route/retirement/browser contracts assert ticker native ownership and primary sink identity.
- violated_rule: R352 / P777 reinforcement — stable native sink IDs are executable route contracts; shared accessibility/normalization passes must not rewrite them, and a bounded cutover must remove the competing primary writers while documenting secondary boundaries.
- prevention: include shared initializers in every native sink identity audit; assert both DOM presence and values in Chromium, keep the explicit-ID behavior in the headless suite, and retain an allowlisted read-only exception only for legacy consumers that read the native sink text.
- verification: `node --check` touched modules, architecture `1081/40/186/377`, retirement, operations, runtime, data-pipeline, structural, control-character, version, doc-currency, Chromium ticker primary sinks `4/4` (`AAPL / Apple Inc. / — / —`) with `browserErrors:0` and 17-route canvases/timers `42→42 / 12→12`, and headless `1098/1098 PASS`; live invariant fetch/provider rights/Cloudflare soak/deployment remain unverified.

### P775 — bounded themes RRG primary surface cutover (2026-07-22)

- motivation: `themes` had a native lifecycle scaffold but its primary RRG quadrant/rotation-read surface was still marked legacy, while the old card renderer mixed static RRG arrays with live/history reads.
- symptom/reproduction: route owners classified `themes` as legacy renderer/data/chart/narrative; `renderRRGQuadrantCards()` wrote the primary cards and rotation read, and browser evidence could not distinguish the primary surface from the secondary RRG chart/status boundary.
- root_cause: the theme state bridge exposed raw legacy arrays without a normalized view/relative-rotation model, so the native module was intentionally marker-only and legacy remained the effective DOM owner.
- fix: normalized `view`, bridged RRG items through `computeRelativeRotation` when evidence exists, implemented safe DOM rendering for the two bounded primary surfaces, routed view/history invalidation events through the native module, and retired the legacy card renderer. Chart/canvas status and `theme-detail` were left as explicit secondary boundaries.
- violated_rule: R352 / R3 — renderer ownership must follow actual writer evidence, and unavailable/static theme values must remain fail-closed rather than being promoted as current native data.
- prevention: every theme cutover must list primary versus chart/detail surfaces separately, assert the native sink count in Chromium, and keep a no-data browser case visible (`quadrantCount:0`) instead of seeding a fabricated quadrant.
- verification: syntax, architecture, retirement, operations, structural, doc-currency, Chromium 17-route two-lap (`themesRenderer:native`, primary sinks `2/2`, browserErrors `0`), and headless `1098/1098 PASS`; live invariant fetch remains unverified because the deployed site was unreachable in this environment.

### P788 — bounded theme-detail native summary and isolated legacy detail body (2026-07-26)

- motivation: `theme-detail` is a derived inline view opened from `themes`, so a safe packet must separate the selected-theme summary from the full legacy detail body rather than claim full route ownership prematurely.
- symptom/reproduction: `showThemeDetail()` previously replaced the whole `#theme-detail-panel` contents, leaving no stable child boundary for a native summary and no explicit selection event contract for the native themes slice.
- root_cause: P776 retired the unreachable static-page renderer, but the live inline panel still combined selection, summary, subtheme composition, breadth, deep-analysis narrative, and chart/data consumers in one legacy container.
- fix: added selected-detail normalization/state projection, `aio:themeDetailShown`/`aio:themeDetailClosed` events, native `#theme-detail-native-summary`, and legacy `#theme-detail-legacy-content`. The native summary uses safe DOM APIs for label/performance/source/representative leaders; the detailed body remains legacy-owned.
- violated_rule: R352 single execution ownership, R359 bounded primary-surface discipline, and R360 derived theme-detail event/child boundary.
- prevention: architecture contract checks native/legacy writer intersections; Chromium checks native summary visibility plus populated legacy body and the 17-route resource round trip; full detail/chart/data/narrative ownership remains a declared follow-up packet.
- verification: ESM unit PASS, architecture contract PASS (`1087/39/186/375`), architecture browser PASS with theme-detail summary/legacy-body evidence, `42` canvases, `12` timers, and browserErrors `0`; local v53.23 remains uncommitted and undeployed.

### P789 — bounded theme-detail composition/breadth native surface (2026-07-26)

- motivation: after P788, the derived theme-detail panel still emitted the subtheme composition and breadth readout from the large legacy `innerHTML` writer, so the native summary boundary did not cover the next independently movable surface.
- symptom/reproduction: selecting a theme populated subtheme cards and the breadth line only inside `#theme-detail-legacy-content`; the native module had no normalized quote evidence or dedicated child for this composition surface.
- root_cause: the event payload carried structural detail but not the quote snapshot, breadth result, or subtheme weights needed for a safe native render; the legacy writer also bundled the transferred composition into the same HTML string as the remaining deep narrative.
- fix: normalized `breadth`, quote evidence, and subtheme weights; extended `aio:themeDetailShown` with those fields; added safe DOM rendering in `themes.js` for `#theme-detail-native-composition`; removed the legacy subtheme/breadth DOM emission while retaining detailed leader cards and deep-analysis narrative as explicit legacy boundaries.
- violated_rule: R361 / R360 — a derived composition cutover must use an explicit event/child boundary, fail closed when quote coverage is insufficient, and fence the transferred legacy writer before claiming the bounded surface.
- prevention: every follow-up theme-detail packet must add a dedicated child, normalize its evidence shape, assert native/legacy writer intersection and visible fail-closed behavior, and keep deep narrative/chart/data ownership separate until independently reconciled.
- verification: touched-module syntax, architecture contract PASS with normalized quote/breadth fixtures, Chromium theme-detail summary/composition/legacy-body evidence, `42` canvases, `12` timers, and browserErrors `0`; local v53.24 remains uncommitted and undeployed.

### P790 — bounded theme-detail detailed-leader native surface (2026-07-26)

- motivation: after P789, the derived theme-detail panel still generated the detailed leader-card grid from the legacy HTML writer even though the selection event already carried the normalized leader quote evidence.
- symptom/reproduction: selecting a theme showed leader cards with prices and changes only inside `#theme-detail-legacy-content`; there was no dedicated native owner or fail-closed display for missing leader quotes.
- root_cause: the P788/P789 native children were intentionally scoped to summary and composition, while the legacy function kept the leader-card block bundled with the same detail string; the event payload had not yet been consumed by a leader-specific renderer.
- fix: added safe DOM rendering in `themes.js` for `#theme-detail-native-leaders`, wired selection/close/dispose lifecycle, and removed the legacy leader-card HTML block. The native cards preserve ticker navigation and show `가격 대기`/`등락률 대기` when quote evidence is absent; deep-analysis narrative remains legacy-owned.
- violated_rule: R362 / R361 — a transferred leader surface needs one native writer, explicit normalized quote evidence, and a legacy writer fence before native ownership is recorded.
- prevention: each remaining theme-detail packet must use a dedicated child and explicit event payload, assert missing-data behavior in Chromium, and keep narrative/chart/data surfaces separately declared.
- verification: touched-module syntax, architecture contract PASS, Chromium theme-detail summary/composition/leaders evidence with `11` native leader cards, `42` canvases, `12` timers, and browserErrors `0`; local v53.25 remains uncommitted and undeployed.

### P791 — bounded theme-detail temperature narrative native surface (2026-07-26)

- motivation: the first dynamic section of `_buildThemeDeepAnalysis()` still wrote the theme-temperature diagnosis from the legacy HTML string even after the native summary/composition/leader cutovers.
- symptom/reproduction: selecting a theme left temperature wording inside the legacy deep-analysis body, with no dedicated native surface or explicit unavailable-performance behavior.
- root_cause: P788-P790 intentionally stopped before dynamic narrative ownership; the event payload already contained the canonical selected-theme performance, but no native renderer consumed it for the temperature section.
- fix: added safe DOM rendering in `themes.js` for `#theme-detail-native-temperature`, removed the corresponding legacy temperature section, and kept performance-spread, breadth-health, benchmark, and remaining deep narrative sections legacy-owned.
- violated_rule: R363 / R362 — dynamic narrative must derive from normalized canonical input, fail closed when missing, and fence the exact legacy section before native ownership is recorded.
- prevention: narrative packets must identify the exact source model and section boundary, assert unavailable behavior in Chromium, and never transfer adjacent legacy narrative/chart/data surfaces implicitly.
- verification: touched-module syntax, architecture contract PASS, Chromium theme-detail summary/composition/leaders/temperature evidence with fail-closed `시세 대기`, `42` canvases, `12` timers, and browserErrors `0`; local v53.26 remains uncommitted and undeployed.

### P792 — bounded theme-detail performance-spread native surface (2026-07-26)

- motivation: the second dynamic deep-analysis section still generated leader performance spread and strongest/weakest constituent commentary in the legacy HTML writer after the native leader cards had been transferred.
- symptom/reproduction: selecting a theme left the spread narrative inside the legacy deep-analysis body, and there was no native surface that could state when fewer than two constituent changes were observed.
- root_cause: P790 owned leader cards but intentionally did not move the derived comparison narrative; the native module had the normalized quote payload but no isolated spread renderer.
- fix: added safe DOM rendering in `themes.js` for `#theme-detail-native-spread`, ranking only observed quote changes and returning `시세 대기` below the two-observation threshold; removed the legacy spread section while retaining breadth-health and later narrative sections.
- violated_rule: R364 / R363 — ranking narrative must use observed canonical evidence, fail closed with insufficient coverage, and fence the exact legacy section before native ownership is recorded.
- prevention: every derived comparison must define its minimum evidence count, keep ranking deterministic, and add a native/legacy boundary plus browser assertion before moving to the next narrative section.
- verification: touched-module syntax, architecture contract PASS, Chromium theme-detail summary/composition/leaders/temperature/spread evidence with insufficient-quote text, `42` canvases, `12` timers, and browserErrors `0`; local v53.27 remains uncommitted and undeployed.

### P793 — bounded theme-detail breadth-health native surface (2026-07-26)

- motivation: the third dynamic deep-analysis section still generated breadth-health interpretation in the legacy HTML writer after the native composition surface already exposed normalized breadth.
- symptom/reproduction: selecting a theme left the breadth-health narrative inside the legacy deep-analysis body, with no dedicated native surface or explicit unavailable-breadth behavior.
- root_cause: P789 transferred the breadth value for composition but intentionally left its interpretation bundled in `_buildThemeDeepAnalysis()`; no native renderer consumed the normalized breadth for a health classification.
- fix: added safe DOM rendering in `themes.js` for `#theme-detail-native-breadth-health`, derived from normalized `detail.breadth` with fail-closed `시세 대기` behavior; removed the legacy breadth-health section while retaining subtheme gap, benchmark, and remaining narrative sections.
- violated_rule: R365 / R364 — breadth-health narrative must use normalized canonical evidence, fail closed when coverage is missing, and fence the exact legacy section before native ownership is recorded.
- prevention: each narrative packet must identify its evidence field and threshold policy, add a dedicated native child and browser assertion, and preserve adjacent narrative/chart/data boundaries as separate work.
- verification: touched-module syntax, architecture contract PASS, Chromium theme-detail summary/composition/leaders/temperature/spread/breadth-health evidence with fail-closed text, `42` canvases, `12` timers, and browserErrors `0`; local v53.28 remains uncommitted and undeployed.

### P794 — bounded theme-detail subtheme-gap native surface (2026-07-26)

- motivation: the remaining subtheme comparison in `_buildThemeDeepAnalysis()` still generated strongest/weakest subtheme commentary from the legacy HTML writer after native composition had exposed the normalized subtheme structure.
- symptom/reproduction: selecting a theme left subtheme performance-gap wording inside the legacy deep-analysis body, with no dedicated native surface or explicit insufficient-subtheme-coverage behavior.
- root_cause: P789 transferred subtheme composition and breadth but intentionally left its derived gap narrative bundled with later legacy sections; the native module had normalized subtheme quote evidence but no dedicated comparison renderer.
- fix: added safe DOM rendering in `themes.js` for `#theme-detail-native-subtheme-gap`, ranking only observed subtheme composite performances and returning `시세 대기` below the two-subtheme threshold; removed the legacy subtheme-gap section while retaining benchmark and remaining narrative sections.
- violated_rule: R366 / R365 — subtheme-gap narrative must use normalized canonical evidence, fail closed when coverage is missing, and fence the exact legacy section before native ownership is recorded.
- prevention: every grouped comparison must define its minimum observed-group count, derive all rows from one normalized payload, add native/legacy boundary assertions, and keep adjacent benchmark/chart/data ownership separate.
- verification: touched-module syntax, architecture contract PASS, Chromium theme-detail summary/composition/leaders/temperature/spread/breadth-health/subtheme-gap evidence with insufficient-quote text, `42` canvases, `12` timers, and browserErrors `0`; local v53.29 remains uncommitted and undeployed.

### P795 — bounded theme-detail benchmark native surface (2026-07-26)

- motivation: the remaining ETF/composite-base comparison in `_buildThemeDeepAnalysis()` still emitted relative-performance commentary from the legacy HTML writer after the native theme-detail performance and quote evidence boundaries were established.
- symptom/reproduction: selecting a theme left benchmark comparison wording inside the legacy deep-analysis body, with no dedicated native surface or explicit behavior when theme or benchmark performance was unavailable.
- root_cause: P788-P794 moved the derived summary and comparison sections one at a time but intentionally left the benchmark section bundled with theme insights; normalized detail also did not yet preserve `compositeBase` for the native comparison.
- fix: added normalized `compositeBase` and event payload preservation, added safe DOM rendering in `themes.js` for `#theme-detail-native-benchmark`, and removed the legacy benchmark section. Missing theme/benchmark quote evidence returns `시세 대기`.
- violated_rule: R367 / R366 — benchmark narrative must use normalized canonical evidence, fail closed when either side is missing, and fence the exact legacy section before native ownership is recorded.
- prevention: every relative comparison must name its canonical numerator/benchmark fields, preserve all required identifiers in the normalized event payload, assert missing evidence in Chromium, and keep insight/chart/data ownership separate.
- verification: touched-module syntax, architecture contract PASS, Chromium theme-detail summary/composition/leaders/temperature/spread/breadth-health/subtheme-gap/benchmark evidence with fail-closed text, `42` canvases, `12` timers, and browserErrors `0`; local v53.30 remains uncommitted and undeployed.
