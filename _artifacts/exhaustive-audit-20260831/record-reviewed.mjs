// Explicit review decisions from source reads/diffs in this audit session.
// No parser/test/graph result grants entries automatically.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const dir = '_artifacts/exhaustive-audit-20260831';
const files = {
  'src/data/contracts/evidence.js': 'All lines; P1013 aliases, time, ceilings. IDs are noncryptographic; nested metadata is not fully immutable.',
  'src/data/selectors/evidence.js': 'All lines; P1013 display/calculation and explicit ceilings, null/finite values. Completeness is cardinality only.',
  'src/data/quality/freshness.js': 'All lines; past-only clocks, missing versus undated reference, delegated usage selector.',
  'src/data/contracts/screener.js': 'All lines; field readiness, immutable definitions, structural validation, run accounting and distinct gross/net outcome fields. Open: broader unit semantics and descriptive-only definition knobs; this schema is research-only and does not establish predictive validity.',
  'src/data/providers/screener.js': 'All lines; independent identity/factor failure, one live snapshot per call, explicit currency compatibility and observation recency. Native market cap remains reference-only and never becomes USD; missing MIC/asset/currency stay missing. Open: current generated artifact predates currency fields, and registry-quality instrument identity remains upstream work.',
  'src/data/orchestrators/screener.js': 'All lines; generation and scope, masked ranker input, selective rank output merge preserving original observations, setup model and state. Automatic sync history is not an outcome collector.',
  'src/data/normalize/screener.js': 'All lines; explicit numeric projection and copied source fields. Shallow nested metadata remains; caller-owned noncanonical arrays are not a separate validation boundary.',
  'src/app/commands/screener.js': 'All lines; action construction. Interaction update time is not provider observation time.',
  'src/state/slices/screener.js': 'All lines; spread reducer and array bounds. Nested immutable convention required.',
  'src/domain/screener/saved-screens.js': 'All lines; P1014 pre-migration validation, import/share size and forward-version rejection. Direct migration API still normalizes input and is not itself an untrusted import validator.',
  'src/domain/screener/screen-engine.js': 'All lines; filter truth table, required readiness, compatible ranking units, snapshot/run/explanations, default definitions and canonical replay. Replay uses captured ranked rows, not the original historical upstream response or a recomputed factor model.',
  'src/domain/screener/factor-ranks.js': 'All lines; P1015 row freshness before samples, invalid core denominator, missing factor scores, robust clipping, peer grouping and tie-aware turnover. Remaining missing contribution uses zero z with explicit coverage; not predictive certification.',
  'src/domain/screener/factor-weights.js': 'All lines; Korean/English labels, finite risk and finite nonnegative profile validation now fail closed. Sparse profiles are normalized only after at least one valid weight; economic weight policy remains unvalidated by outcomes.',
  'src/domain/screener/setup-profile.js': 'All lines; null propagation and reference-only labels. USD price threshold is evaluated only for explicit USD instruments; no benchmark-relative evidence is synthesized.',
  'src/platform/http.js': 'All lines; Headers/array/object inputs preserved, pre-abort avoids transport, and independent request/body deadlines settle even when transport ignores AbortSignal. This normalizes local behavior but does not certify provider availability.',
  'src/platform/clock.js': 'All lines; injected clock contract, invalid clock throws explicitly.',
  'src/platform/storage.js': 'All lines; P1016 getter access protected and explicit null injection preserved; storage failure is returned, not silently reported as persistence.',
  'src/platform/sanitizer.js': 'All lines; default text escaping, injected HTML sanitizer trust boundary. Runtime-unreachable foundation, not active DOM certification.',
  'src/platform/telemetry.js': 'All lines; bounded array with default settings, shallow fields. Invalid maxEntries is not validated; runtime-unreachable.',
  'src/storage/repository.js': 'All lines; P1016 raw injection, same-version validation, future version preservation. Runtime-unreachable foundation.',
  'src/storage/migrations.js': 'All lines; P1016 explicit missing step/version bounds. Runtime-unreachable foundation.',
  'src/storage/screener-runs.js': 'All lines; IndexedDB transaction completion, bounded sequences, retry and blocked-open cleanup. list/put read all retained input records; performance follow-up.',
  'src/data/artifact-cache.js': 'All lines; P1016 abort/retry identity, deadline and integrity/size constraints. Cached objects intentionally share references; byte limit is checked after body materialization.',
  'src/app/lifecycle.js': 'All lines; disposer/chart ownership plus cancellable deferred-task queue and trailing-argument microtask coalescer. Stop is idempotent, cancels pending timers and prevents post-stop publication; already-running external work still needs its producer guard.',
  'src/state/store.js': 'All lines; reducer validation, synchronous listeners, optional freeze. Open: pre-frozen outer object skips nested freeze; throwing listener prevents later subscribers.',
  'src/state/memoize.js': 'All lines; cache inputs/results commit only after successful compute, so throw/retry cannot return an older result. Initial subscribe callback still precedes subscription by contract.',
  'src/data/evidence-store.js': 'All lines; Map last-write wins per metric, validation. No observation/revision ordering or multi-source reconciliation.',
  'src/ui/pages/screener.js': 'All lines; display/calculation separation, frozen runs, service injection, condition state, comparison and lifecycle. Native-currency market cap is labelled reference-only and blocked amounts are hidden. The unreachable USD-only position sizing UI was retired. Open: nonnumeric table filters are not saved in run AST and entry timing retains descriptive heuristics.',
  'src/app/bootstrap.js': 'All lines; provider/service/router/event wiring, frozen screener run archive, cancellable startup queue and post-stop snapshot/microtask guards. Global legacy producers remain compatibility dependencies; external transports are allowed to finish but cannot publish after stop.',
  'src/app/router.js': 'All lines; route scope abort/disposal, lazy import retry, vertical-slice ownership and entity remount identity. Disposed routers now reject restart/transition and lazy errors use a guarded CustomEvent constructor.',
  'src/app/routes.js': 'All lines; the canonical 20-route allowlist and exact membership check.',
  'src/app/vertical-slices.js': 'All lines; 13 ordered slices cover all 20 routes once with shared acceptance and immutable route/data arrays. Acceptance labels are declared policy and do not themselves prove browser behavior.',
  'src/app/knowledge-learning-state.js': 'All lines; browser storage injection only; domain learning state owns validation and persistence.',
  'src/app/knowledge-route-state.js': 'All lines; URL/query/hash parsing and serialization, explicit route allowlisting and fail-closed return-context parsing. It still bridges the legacy showPage/pending-hash boundary.',
  'src/legacy/compatibility-facade.js': 'All lines; facade/navigation restoration and API surface, P1013 canonical empty screener read. Remaining legacy numeric/data producers are not retired by wrapper extraction.',
  'src/data/runtime-readers.js': 'All lines; projection/catalog and decision boundary. Fear/Greed and put/call choose whole observations atomically, preserve zero and sourceKind, and recover when canonical getters throw. Open: observation coverage is not a complete quality/rights decision and portfolio numeric coercion remains a separate boundary.',
  'src/ai/time/market-session.js': 'All lines; open: impossible date acceptance and calendar object existence are not actual market-session/holiday lookup.',
  'scripts/ci-desktop-continuity-check.mjs': 'All lines; actual contract injection and rendered state assertions, P1017 builder idempotence. Offline VM only; final PASS follows final assertion.',
  'scripts/ci-screener-auto-refresh-browser-check.mjs': 'All lines; real controls, frozen input and persistent replay. Controlled artifact-relative clock; separate stale fixture. Does not certify wall-clock upstream currentness.',
  'scripts/ci-doc-currency-check.mjs': 'All lines; informational legacy map checks now distinguish declared historical size table. Generated current-state/workspace gates own current size validity.',
  'scripts/ci-atlas-browser-check.mjs': 'All lines; actual Chromium exercises learner state, retry, route history, taxonomy, player/product search, relationship evidence, responsive layouts, Telegram status semantics, failure fallback and route CTA. The gate now checks positive and contradictory status copy and emits direct state for failures; it remains local desktop evidence rather than live-provider or mobile/touch certification.',
  'src/ai/analysis/causal.js': 'All lines; causal candidates, alternatives and cross-asset corroboration now share the same bounded time window and require explicit usable source kind plus evidence identity. This remains conditional attribution, not proof of causality.',
  'src/ai/analysis/company.js': 'All lines; quality, percentile and fact inputs reject coercible blanks/booleans/out-of-domain values and nested projections are immutable. The score is a supplied-input summary, not a validated valuation model.',
  'src/ai/analysis/macro-fx.js': 'All lines; null objects fail closed, transmission edges require source/time/evidence/provenance and projections are immutable. Edge direction remains caller-supplied rather than empirically established.',
  'src/ai/analysis/registry.js': 'All lines; one intent-to-domain dispatch table with an explicit not-applicable fallback. Comparison/options/screening use other product paths and are intentionally not synthesized here.',
  'src/ai/analysis/sector.js': 'All lines; strict numeric constituent returns and traceability-complete ready state with immutable leader/laggard rows. Three rows are only a structural readiness floor, not representative sector coverage.',
  'src/ai/analysis/technical.js': 'All lines; positive prices/MAs, bounded RSI, strict finite MACD inputs and traceability-aware partial status. Conditions are classifications and do not forecast direction or probability.',
  'src/ai/context-builder.js': 'All lines; scalar metric/retriever results fail closed and evidence/policy projections are immutable. Context completeness still depends on the supplied evidence store.',
  'src/ai/context/manifest.js': 'All lines; malformed evidence/claim collections are isolated and rows/source URL arrays are immutable. The manifest records provenance fields but does not independently verify them.',
  'src/ai/entity/resolver.js': 'All lines; ticker/alias resolution, finance acronym exclusions, KR/US identity and unresolved-term filtering. Resolved Korean aliases no longer reappear as unresolved; permissive unregistered uppercase tickers remain a deliberate discovery fallback.',
  'src/ai/inference.js': 'All lines; inferred search claims remain reference-only, require HTTPS sources, ordered ranges/windows and integral source counts. They cannot publish exact current numeric values or become decision evidence.',
  'src/ai/intent/taxonomy.js': 'All lines; composite intent scoring, currentness, action vocabulary and personalized/executable action separation. Regex routing is deterministic and regression-covered but not a learned semantic classifier.',
  'src/ai/orchestrator/answer-orchestrator.js': 'All lines; planning, pre-provider action block, research validation, domain analysis and knowledge facade. Audit snapshots are immutable and runner errors use bounded codes; legacy UI/provider paths remain adapters.',
  'src/ai/orchestrator/capability-planner.js': 'All lines; evidence requirements map to read-only tools and personalized portfolio action is blocked before provider dispatch. Declared readiness does not probe live tool availability.',
  'src/ai/orchestrator/question-planner.js': 'All lines; composite evidence, safe clock, research/conduct/action plans and market-session wiring. Mixed KR/US questions now stay MIXED with no false single-market verified session.',
  'src/ai/policy.js': 'All lines; missing/failed/unavailable/invalid/rejected/stale/unknown evidence is unusable and decision use also requires explicit status plus decision ceiling. It consumes upstream status and does not calculate freshness itself.',
  'src/ai/policy/conduct.js': 'All lines; prohibited operational conduct, conditional leverage and jurisdiction-scoped legal/tax analysis. Mixed educational wording can no longer bypass a prohibited execution request; regex policy still needs corpus monitoring.',
  'src/ai/policy/suitability.js': 'All lines; personalized/executable actions require suitability and current evidence while educational discussion remains available. The policy returns immutable reasons and does not collect a profile.',
  'src/ai/research/capability.js': 'All lines; provider route/auth/tool/quota/origin readiness remains separate from ordinary chat and invalid clocks fall back to an explicit epoch. This is a declared capability envelope, not a health probe.',
  'src/ai/research/decision.js': 'All lines; question-only current/causal/domain research requirement, source floors, freshness SLO and opt-out failure mode. Invalid clocks are deterministic; regex classification does not guarantee retrieval quality.',
  'src/ai/research/evidence.js': 'All lines; HTTPS canonicalization, spoof-safe authority tiers, rights/content-depth exclusions, citation binding and distinct external/native evidence floors. Malformed source floors cannot degrade to zero; native citations still rely on the native search tool having inspected the cited content.',
  'src/ai/research/plan.js': 'All lines; current-date queries, domain policy, recency, counter-hypothesis and bounded integer budgets. Query plans describe collection intent and do not prove any result was returned.',
  'src/ai/response/claim-ledger.js': 'All lines; numeric/current traceability, probability calibration, per-claim valid counts, immutable nested rows and bounded JSON parse errors. Structured plans can remain partially publishable while unsafe claims are removed downstream.',
  'src/ai/response/renderer.js': 'All lines; renders only nonblocked claims and HTTP(S) citation URLs, omitting invalid citation-only sections. It is a text projection and assumes upstream claim validation.',
  'src/ai/retrieval/evidence.js': 'All lines; scalar metric requests fail closed and retrieved rows/arrays are immutable. Evidence-store quality remains upstream.',
  'src/ai/retrieval/knowledge.js': 'All lines; bounded reference-only indexing/retrieval, malformed collection isolation, cancellable retryable loading and bounded errors. Lexical ranking is educational context only and does not verify article source claims.',
  'src/ai/eval/benchmark.js': 'All lines; benchmark manifest keeps missing cost as unknown and reports reproducibility only when every pinned version exists. Test/architecture scaffold, not connected model evaluation or user-answer accuracy evidence.',
  'src/ai/evidence/graph.js': 'All lines; normalized frozen nodes/edges and completeness accepts explicit type or metricId. Runtime chat does not consume this graph, so it is a staged contract rather than current citation enforcement.',
  'src/ai/operations/control-plane.js': 'All lines; bounded event ledger protects trusted type/time from payload override. In-memory test scaffold only; no durable canary, feedback, drift or rollback operation is connected.',
  'src/ai/provider/adapter.js': 'All lines; thrown and aborted requests return bounded error codes without leaking provider detail. It is not wired to the deployed chat provider path.',
  'src/ai/response/envelope.js': 'All lines; injected time, frozen arrays/policy, safe malformed-array validation and traceability gate. It is not the deployed chat response envelope.',
  'src/ai/websearch/claims.js': 'All lines; delegates inferred-claim validation and keeps valid search claims reference-only. It does not perform search or establish source freshness.',
  'src/data/contracts/operations.js': 'All lines; operational status vocabulary and required planes/providers/reconciliation validation. Nested status payloads are only shallow-frozen and the 22-category cardinality is duplicated rather than derived.',
  'src/data/contracts/reconciliation.js': 'All lines; category identity/status/origin/evidence/closure and critical-gap validation. It validates published operational metadata, not the truth of upstream observations; nested closure data is shallow-frozen.',
  'src/data/contracts/revision.js': 'All lines; app/data/evidence revisions and generatedAt are now all required. The contract identifies builds but is not a cryptographic artifact signature.',
  'src/data/contracts/source-registry.js': 'All lines; 22 categories describe origins, access, cadence, rights ceilings and explicit professional gaps. Registry presence does not collect data or prove latest values.',
  'src/data/quality/lineage.js': 'All lines; matched records now require sourceKind and both timestamps, reject invalid dates and fetched-before-observed ordering. Record-to-artifact binding remains identifier-based.',
  'src/data/knowledge/repository.js': 'All lines; capability failures remain isolated and quantitativeLabs is deliberately excluded by product scope. Repository assembly is a loader boundary, not source verification.',
  'src/domain/knowledge/evidence.js': 'All lines; source/claim registries keep Map indexes private, freeze projections, normalize claim source arrays and preserve conflict/unresolved ledgers. Nested caller claim fields outside normalized sourceIds remain shallow.',
  'src/domain/knowledge/ontology.js': 'All lines; canonical concepts and error rows are isolated/frozen and mutable Map indexes remain private. Alias resolution stays closure-backed; semantic equivalence still depends on curated input.',
  'src/domain/knowledge/route-bridge.js': 'All lines; immutable target copies, private route allowlist and bounded/cycle-safe return-context serialization. Duplicate article IDs still resolve last-write-wins by the curated artifact contract.',
  'src/domain/knowledge/selectors.js': 'All lines; small pure selectors for connected repository capabilities. Removed obsolete quantitativeLabs selector because that capability was intentionally excluded.',
  'src/domain/knowledge/graph.js': 'All lines; enum/array validation, immutable diagnostic projections and explicit non-causal RELATES_TO navigation semantics. Edge review/source metadata still depends on curated producer input.',
  'src/domain/knowledge/learning-state.js': 'All lines; malformed persisted collections are sanitized, nested snapshot entries are frozen and reserved object keys rejected. Storage failure is non-fatal and intentionally leaves the in-memory update active.',
  'src/domain/knowledge/principles-edge-semantics.js': 'All generated lines and all 71 records reviewed through the generator/profile and catalog endpoint comparison. Seventeen cross-industry navigation links are now RELATES_TO/BIDIRECTIONAL rather than generic CAUSES; all rows/arrays are frozen and source evidence remains explicitly pending.',
  'scripts/build-principles-edge-semantics.mjs': 'All lines; every catalog relation must map to an explicit causal profile or the declared navigation relation set, otherwise generation fails. Removed duplicate rows pass and made endpoint-key versus order-ID behavior explicit.',
  'src/domain/screener/provider-capability.js': 'All lines; provider selection and observation reconciliation require matching instrument/field/unit and compatible observation epochs. Catalog still declares several staged providers not connected to production collectors.',
  'src/domain/screener/regime.js': 'All lines; injected/replay time validation and future prior observations cannot lock hysteresis. Volatility score direction remains semantically ambiguous and auto-weight promotion stays disabled.',
  'src/domain/screener/pit-validation.js': 'All lines; point-in-time availability, universe validity, costs/liquidity, definition parity and promotion review remain fail closed. Malformed as-of dates and mutable error/blocker arrays are corrected; no production PIT collector is connected.',
  'src/domain/screener/refresh-planner.js': 'All lines; demand identity/deduplication, provider/global budgets, in-flight state, retry/backoff and circuit behavior. Numeric configuration and plan limits are now bounded so NaN cannot bypass quotas; the planner is still runtime-unconnected foundation.',
  'src/domain/screener/outcome-ledger.js': 'All lines; immutable canonical records, trading-session horizon lookup and endpoint-only drawdown boundary. Gross rawReturn and cost-adjusted netReturn are now distinct, with explicit migration of the prior mislabelled persisted shape; no production outcome collector is connected.',
  'src/domain/market/breadth.js': 'All lines; AIO-universe participation level/direction only, never exchange-wide breadth or a Weinstein stage. Required percentages now reject values outside 0..100; economic thresholds remain heuristic and unvalidated by outcomes.',
  'src/domain/market/health.js': 'All lines; VIX, index trend, leadership and optional breadth inputs retain explicit missingness. Negative/impossible core values block and malformed optional rows no longer count as declines; the weighted health score remains a reference heuristic, not a forecast.',
  'src/domain/macro/transmission.js': 'All lines; qualitative transmission-chain observation and gap projection. Blank evidence no longer counts as observed and nested results are immutable; the module has no timestamp/source proof for its qualitative inputs and must remain reference-only.',
  'src/domain/macro/treasury-curve.js': 'All lines; exact legacy fallback/parity for curve points and 2s10s. The legacy source/available labels do not recognize every raw fallback, so computed values can remain partially sourced/unavailable; retained as disclosed provenance debt rather than falsely relabelled current.',
  'src/domain/news/scoring.js': 'All lines; dated-window keyword sentiment and bounded risk categories. Scalar collections and invalid clocks fail closed and outputs are immutable; keyword substring weights are disclosed reference heuristics, not outcome-validated sentiment.',
  'src/domain/content/capability-manifest.js': 'All lines; visible capability claims are checked against declared evidence and scalar claim shapes fail closed. Output rows are immutable, but manifest declaration still does not prove runtime capability without its separate gate.',
  'src/domain/portfolio/concentration.js': 'All lines; 10/15/25 concentration tiers and immutable holding projections. v2 unifies inferred total and holding valuation so shares/currentPrice positions cannot create weights above 100%; this domain API remains a future native consumer.',
  'src/domain/portfolio/surface.js': 'All lines; partial holdings preserve missing totals, invalid negative balances are rejected and VIX exposure policy is explicitly reference-only. The fixed exposure ladder is a heuristic and the UI no longer issues a direct reduction command from it.',
  'src/domain/themes/rrg.js': 'All lines; relative-strength/momentum history and quadrant projection. Nonpositive/malformed pairs fail closed instead of fabricating Lagging; thresholds and window remain legacy parity heuristics, not predictive certification.',
  'src/domain/sentiment/metrics.js': 'All lines; Fear and Greed plus VIX term-structure projection with nested immutability. Values outside defined domains block; source recency/rights must still be established upstream.',
  'src/domain/home/summary.js': 'All lines; finite-only availability aggregation for home cards and nonnegative news count. It summarizes other domain outputs and does not create independent evidence.',
  'src/domain/signal/trading-score.js': 'All lines; the canonical five-component environment score, decision envelope and presentation. v2 validates every numeric domain, bounds news adjustments, freezes evidence/results and fails closed below coverage; weights and thresholds retain legacy parity and lack outcome validation.',
  'src/domain/fundamental/sec-report.js': 'All lines; SEC filing freshness, anomaly quarantine and accepted/filed-time PIT selection. Producer anomaly flags can no longer disappear behind an empty array, unknown coverage is removed and nested coverage/counts are bounded; annual-fact coverage is not a complete company model.',
  'src/domain/technical/stage.js': 'All lines; legacy MA-stack/MTF parity plus OHLCV stage composition. Nonpositive prices and malformed MA inputs fail closed; stage labels are deterministic classifications and not entry forecasts.',
  'src/domain/ai/inference-efficiency.js': 'All lines; reference-only inference architecture, workload, supply-chain and ecosystem taxonomy. Proxy rows are immutable and an unstamped provider can no longer be labelled LIVE merely because it has a name; dated price facts still require upstream quote evidence.',
  'src/domain/research/supplied-materials.js': 'All lines; 13 time-series lenses, 10 research sections and route mappings are consistently reference-only with explicit invalidation boundaries. Several source packets record partial/blocked access, so this file is a durable research map rather than verified current market evidence.',
  'src/state/selectors/market.js': 'All lines; pure null-safe market selectors. Kept as state contract and CI/runtime dependency, not duplicate market calculation.',
  'src/storage/vault.js': 'All lines; consent is insufficient without an explicitly encrypted-at-rest repository. No encrypted implementation is connected, so the vault correctly remains disabled.',
  'src/ui/knowledge/evidence.js': 'All lines; safe DOM-only source projection now uses the registry resolve API without mutable index fallback. Shared renderer is covered by CI but not mounted by current route pages.',
  'src/ui/knowledge/graph.js': 'All lines; accessible text alternative with DOM textContent. Test/future shared renderer, currently not mounted.',
  'src/ui/knowledge/path.js': 'All lines; accessible ordered path controls and callback. Test/future shared renderer, currently not mounted.',
  'src/ui/knowledge/tree.js': 'All lines; accessible pressed-state tree controls and callback. Test/future shared renderer, currently not mounted.',
  'src/state/slices/analysis.js': 'All lines; bounded analysis replacement/clear reducer. Nested model objects follow producer immutability and are not cloned.',
  'src/state/slices/entity.js': 'All lines; entity rows and top-level objects are copied on replacement. Nested fundamentals/options structures remain producer-owned.',
  'src/state/slices/market.js': 'All lines; quote/metric maps are replaced per sync and timestamps preserved. Normalized quote entries are frozen upstream.',
  'src/state/slices/news.js': 'All lines; news item objects are now copied rather than sharing caller-owned rows; explicit status/revision/freshness metadata retained.',
  'src/state/slices/portfolio.js': 'All lines; holdings and totals are copied, numeric cash remains null when unavailable, and clear resets privacy state.',
  'src/state/slices/sentiment.js': 'All lines; canonical values replacement and revision/time metadata. Values also retain provider metadata keys by current contract.',
  'src/state/slices/themes.js': 'All lines; explicit null clears stale selection/detail while omitted fields preserve current items. Incoming items/detail are copied.',
  'src/state/selectors/analysis.js': 'All lines; pure null-safe analysis projections.',
  'src/state/selectors/entity.js': 'All lines; pure entity projections with null missingness.',
  'src/state/selectors/news.js': 'All lines; array/status projections fail closed to empty/unavailable.',
  'src/state/selectors/portfolio.js': 'All lines; portfolio projections preserve null totals and opt-in default.',
  'src/state/selectors/screener.js': 'All lines; exposes the bounded workbench projection without recomputing results.',
  'src/state/selectors/sentiment.js': 'All lines; preserves numeric zero with nullish selection and delegates summary calculation to the domain model.',
  'src/state/selectors/themes.js': 'All lines; pure theme collection/selection projections.',
  'src/app/commands/analysis.js': 'All lines; validated store command wrapper only.',
  'src/app/commands/entity.js': 'All lines; validated store command wrapper only.',
  'src/app/commands/market.js': 'All lines; validated store command wrapper only.',
  'src/app/commands/news.js': 'All lines; validated store command wrapper only.',
  'src/app/commands/portfolio.js': 'All lines; validated store command wrapper only.',
  'src/app/commands/sentiment.js': 'All lines; validated store command wrapper only.',
  'src/app/commands/themes.js': 'All lines; validated store command wrapper only.',
  'src/data/providers/analysis.js': 'All lines; shallow immutable adapter around injected analysis read.',
  'src/data/providers/sentiment.js': 'All lines; injected current read with timestamp default. Nested values rely on downstream normalization.',
  'src/data/providers/news.js': 'All lines; item/meta projection, latest event time and checkedAt. Malformed item/time inputs now fail closed instead of throwing.',
  'src/data/providers/market.js': 'All lines; map/time projection only; it does not establish quote validity.',
  'src/data/providers/themes.js': 'All lines; quote epoch/change-basis guards, rotation inputs, selected-theme aggregate and membership projection. Curated membership and computed composite remain reference semantics.',
  'src/data/providers/entity.js': 'All lines; abort-aware fundamentals artifact TTL/retry and entity projection. Quote/options still originate from legacy injected reads.',
  'src/data/providers/portfolio.js': 'All lines; repository preference plus runtime quote overlay. Stored holdings identity and live price/value are merged by symbol; encrypted repository remains unavailable.',
  'src/data/orchestrators/analysis.js': 'All lines; normalize then command sync.',
  'src/data/orchestrators/sentiment.js': 'All lines; per-field snapshot fallback, freshness/evidence ingest and state publication. It still bridges legacy runtime inputs.',
  'src/data/orchestrators/news.js': 'All lines; schedule/fetch staleness projection and metadata publication. Uses elapsed-hour policy rather than market-session rules.',
  'src/data/orchestrators/market.js': 'All lines; normalize then command sync.',
  'src/data/orchestrators/themes.js': 'All lines; normalize then command sync.',
  'src/data/orchestrators/entity.js': 'All lines; generation/scope guards prevent late entity overwrites and dispose blocks publication.',
  'src/data/orchestrators/portfolio.js': 'All lines; normalize then command sync.',
  'src/data/normalize/analysis.js': 'All lines; delegates technical/signal/home calculation to domain owners and accepts only the current trading-score.v2 envelope. Older score shapes are recomputed instead of silently reused.',
  'src/data/normalize/sentiment.js': 'All lines; finite metric projection and explicit field catalog; metadata is retained for evidence assembly.',
  'src/data/normalize/news.js': 'All lines; text/numeric normalization with frozen item projections. Source URLs are data only and require safe rendering at the UI boundary.',
  'src/data/normalize/market.js': 'All lines; finite quote/metric projection and frozen quote rows. Missing change basis cannot become direction-compatible.',
  'src/data/normalize/themes.js': 'All lines; finite theme/detail/quote projection and frozen rows/nested collections. Membership remains curated reference data.',
  'src/data/normalize/entity.js': 'All lines; finite quote/OHLCV projection with frozen rows and bounded copies of fundamentals/options.',
  'src/data/normalize/portfolio.js': 'All lines; null/blank financial numbers remain null instead of Number(null)=0, positive price/value policy, and frozen holdings/totals projection.'
};
const ledger = `${dir}/reviews.jsonl`;
const existing = fs.readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const entries = [];
for (const [path, note] of Object.entries(files)) {
  const bytes = fs.readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (existing.some(row => row.type === 'current-lines' && row.path === path && row.sha256 === sha256 && row.note === note)) continue;
  const text = bytes.toString('utf8');
  entries.push({ type: 'current-lines', at: new Date().toISOString(), path, sha256, ranges: [[1, text.split('\n').length - Number(text.endsWith('\n'))]], verdict: 'reviewed-findings-recorded-not-defect-free', note });
}
const rangeReviews = [{
  path: 'scripts/fetch-data.mjs',
  ranges: [[2059, 2111]],
  note: 'Reviewed the complete _enrichPriceFactors function: producer-side Yahoo suffix mapping now persists explicit currency beside price, market-cap and derived liquidity. The surrounding producer and network pipeline are not credited by this range.'
}, {
  path: 'src/ui/pages/portfolio.js',
  ranges: [[115, 131]],
  note: 'Reviewed the portfolio summary exposure rendering path. The fixed VIX ladder is explicitly reference-only in the domain result and the visible suffix now says reference-limit exceeded rather than issuing a direct reduce command. No credit is granted for the rest of this page module.'
}, {
  path: 'src/ui/pages/atlas.js',
  ranges: [[1, 527], [609, 800], [892, 1347], [1349, 1696]],
  note: 'Reviewed imports/contracts, route and evidence helpers, research/current-evidence/Telegram projection, curriculum flow, taxonomy/player/product/domain/relationship renderers, route state, capability lifecycle and all event/load paths. P1027-P1029 fix private source resolution, canonical collection status copy and taxonomyNodeIds-backed entity search. Static concept-guide catalog rows 528-608 and 801-891 are not credited by this entry.'
}];
for (const review of rangeReviews) {
  const bytes = fs.readFileSync(review.path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (existing.some(row => row.type === 'current-lines' && row.path === review.path && row.sha256 === sha256 && row.note === review.note)) continue;
  entries.push({ type: 'current-lines', at: new Date().toISOString(), path: review.path, sha256, ranges: review.ranges, verdict: 'reviewed-findings-recorded-not-defect-free', note: review.note });
}
const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
const shellReviews = new Set(['c0301b62', 'e96f9ac9', 'c0588361', 'e5f9b8da', '19fe9c60', 'a154cb96', '4a4e92ad', 'e751ded8', '374ea9ff', '3f785f5e', 'dfbfad5c', 'e1903078', 'b3b0fba5']);
const shellNote = path => path.includes('auto-commit') ? 'Entire source/diff reviewed: add-all originally; snapshot narrowed only newly dirty paths but fallback add-all and pre-staged unrelated entries remained. Removed in current tree; historical script never executed.'
  : path.includes('check-version') ? 'Entire source/diff reviewed: multi-digit version regex repair was valid; missing extraction still skipped validation and APP_VERSION source path drifted. Removed in current tree.'
    : path.includes('session-start') ? 'Entire source reviewed: records path status only, cannot distinguish content changes in an already-dirty path. Current hash baseline supersedes it.'
      : 'Entire source reviewed: grep/path checks are heuristic (shell/text syntax, path normalization and string-count boundaries). Removed hook is historical, not a current safety gate.';
for (const commit of manifest.commits) for (const change of commit.changes) {
  const shell = change.path.includes('/hooks/') && change.path.endsWith('.sh') && [change.before, change.after].every(blob => /^0+$/.test(blob) || shellReviews.has(blob.slice(0, 8)));
  const hotfix = commit.sha.startsWith('bd0bea2') && change.path === 'js/aio-data.js';
  if (!shell && !hotfix) continue;
  if (existing.some(row => row.type === 'history-transition' && row.commit === commit.sha && row.path === change.path && row.before === change.before && row.after === change.after)) continue;
  entries.push({ type: 'history-transition', at: new Date().toISOString(), commit: commit.sha, ...change, semanticReview: 'reviewed', note: shell ? shellNote(change.path) : 'Entire changed hunk and function declaration context reviewed; redundant var ld removal repairs the const/var parse conflict, agrees with P311 and R98/R169. No credit for other changed files or complete commit.' });
}
const reviewedHistoryPaths = new Set([
  'src/ai/analysis/causal.js',
  'src/ai/analysis/company.js',
  'src/ai/analysis/macro-fx.js',
  'src/ai/analysis/registry.js',
  'src/ai/analysis/sector.js',
  'src/ai/analysis/technical.js',
  'src/ai/context-builder.js',
  'src/ai/context/manifest.js',
  'src/ai/entity/resolver.js',
  'src/ai/inference.js',
  'src/ai/intent/taxonomy.js',
  'src/ai/orchestrator/answer-orchestrator.js',
  'src/ai/orchestrator/capability-planner.js',
  'src/ai/orchestrator/question-planner.js',
  'src/ai/policy.js',
  'src/ai/policy/conduct.js',
  'src/ai/policy/suitability.js',
  'src/ai/research/capability.js',
  'src/ai/research/decision.js',
  'src/ai/research/evidence.js',
  'src/ai/research/plan.js',
  'src/ai/response/claim-ledger.js',
  'src/ai/response/renderer.js',
  'src/ai/retrieval/evidence.js',
  'src/ai/retrieval/knowledge.js',
  'src/ai/eval/benchmark.js',
  'src/ai/evidence/graph.js',
  'src/ai/operations/control-plane.js',
  'src/ai/provider/adapter.js',
  'src/ai/response/envelope.js',
  'src/ai/websearch/claims.js',
  'src/app/knowledge-learning-state.js',
  'src/app/knowledge-route-state.js',
  'src/app/lifecycle.js',
  'src/app/router.js',
  'src/app/routes.js',
  'src/app/vertical-slices.js',
  'src/data/contracts/operations.js',
  'src/data/contracts/reconciliation.js',
  'src/data/contracts/revision.js',
  'src/data/contracts/source-registry.js',
  'src/data/knowledge/repository.js',
  'src/data/quality/lineage.js',
  'src/domain/knowledge/ontology.js',
  'src/domain/knowledge/graph.js',
  'src/domain/knowledge/learning-state.js',
  'src/domain/knowledge/principles-edge-semantics.js',
  'src/domain/knowledge/route-bridge.js',
  'src/domain/knowledge/selectors.js',
  'src/domain/screener/provider-capability.js',
  'src/domain/screener/regime.js',
  'src/domain/screener/pit-validation.js',
  'src/domain/screener/refresh-planner.js',
  'src/domain/screener/outcome-ledger.js',
  'src/domain/market/breadth.js',
  'src/domain/market/health.js',
  'src/domain/macro/transmission.js',
  'src/domain/macro/treasury-curve.js',
  'src/domain/news/scoring.js',
  'src/domain/content/capability-manifest.js',
  'src/domain/portfolio/concentration.js',
  'src/domain/portfolio/surface.js',
  'src/domain/themes/rrg.js',
  'src/domain/sentiment/metrics.js',
  'src/domain/home/summary.js',
  'src/domain/signal/trading-score.js',
  'src/domain/fundamental/sec-report.js',
  'src/domain/technical/stage.js',
  'src/domain/ai/inference-efficiency.js',
  'src/state/selectors/market.js',
  'src/storage/vault.js',
  'src/ui/knowledge/evidence.js',
  'src/ui/knowledge/graph.js',
  'src/ui/knowledge/path.js',
  'src/ui/knowledge/tree.js',
  'src/ui/pages/legacy-observer.js',
  'src/app/commands/analysis.js',
  'src/app/commands/entity.js',
  'src/app/commands/market.js',
  'src/app/commands/news.js',
  'src/app/commands/portfolio.js',
  'src/app/commands/screener.js',
  'src/app/commands/sentiment.js',
  'src/app/commands/themes.js',
  'src/state/slices/analysis.js',
  'src/state/slices/entity.js',
  'src/state/slices/market.js',
  'src/state/slices/news.js',
  'src/state/slices/portfolio.js',
  'src/state/slices/screener.js',
  'src/state/slices/sentiment.js',
  'src/state/slices/themes.js',
  'src/state/selectors/analysis.js',
  'src/state/selectors/entity.js',
  'src/state/selectors/news.js',
  'src/state/selectors/portfolio.js',
  'src/state/selectors/screener.js',
  'src/state/selectors/sentiment.js',
  'src/state/selectors/themes.js',
  'src/data/providers/analysis.js',
  'src/data/providers/market.js',
  'src/data/providers/news.js',
  'src/data/providers/portfolio.js',
  'src/data/providers/sentiment.js',
  'src/data/orchestrators/analysis.js',
  'src/data/orchestrators/entity.js',
  'src/data/orchestrators/market.js',
  'src/data/orchestrators/news.js',
  'src/data/orchestrators/portfolio.js',
  'src/data/orchestrators/sentiment.js',
  'src/data/orchestrators/themes.js',
  'src/data/normalize/analysis.js',
  'src/data/normalize/entity.js',
  'src/data/normalize/market.js',
  'src/data/normalize/news.js',
  'src/data/normalize/portfolio.js',
  'src/data/normalize/sentiment.js',
  'scripts/build-principles-edge-semantics.mjs'
]);
const historyNotes = {
  'src/ai/analysis/causal.js': 'The complete historical addition was reviewed. Its original time filter was sound for primary candidates, but alternatives returned to the unfiltered original list and object identity changed during copying; the working tree makes one traceable bounded candidate set authoritative.',
  'src/ai/analysis/company.js': 'The complete historical addition was reviewed. Number coercion and shallow nested rows were present from inception; the working tree retains the supplied-input design while rejecting missing and out-of-domain values.',
  'src/ai/analysis/sector.js': 'The complete historical addition was reviewed. A row-count-only ready state and Number coercion were inherited unchanged; the working tree requires traceability for ready and strict numeric observations.',
  'src/ai/analysis/technical.js': 'The complete historical addition was reviewed. It was intentionally a nonforecast condition classifier, but coercible missing values and impossible RSI/prices could become conditions until the working-tree boundary fix.',
  'src/ai/context-builder.js': 'Every historical transition was reviewed. The original store projection later gained a manifest and retriever injection; the working tree closes scalar collection and nested immutability gaps without adding another context path.',
  'src/ai/entity/resolver.js': 'Every historical transition was reviewed. KR aliases and finance acronym exclusions were coherent additions. The initial symbol-keyed unresolved filter could not recognize resolved aliases; the working tree records immutable entities and removes matched aliases from unresolved terms.',
  'src/ai/inference.js': 'The complete historical addition was reviewed. It correctly prohibited exact current search values from inception; the working tree closes malformed source-count, reversed range/window and insecure URL acceptance gaps.',
  'src/ai/intent/taxonomy.js': 'Every historical transition was reviewed. The taxonomy evolved from route-weighted keyword matching to composite intents/currentness and finally separate action vocabulary versus personalized execution. Current mixed-market handling is fixed in the planner, while the regex corpus remains the accuracy boundary.',
  'src/ai/orchestrator/answer-orchestrator.js': 'Every historical transition was reviewed. Research, safety, provider action blocking and knowledge retrieval were added through the same facade. The working tree preserves that architecture while freezing audit records and bounding runner errors.',
  'src/ai/orchestrator/question-planner.js': 'Every historical transition was reviewed. Research and runtime session evidence were layered onto the original planner, then composite intent and suitability separation repaired broad preblocking. The working tree adds deterministic clocks and explicit mixed-market state.',
  'src/ai/policy/conduct.js': 'The complete historical addition was reviewed. Scoped education/legal analysis was intentional, but the educational token could override an otherwise operational prohibited request; the working tree blocks the mixed instruction while preserving pure education.',
  'src/ai/research/evidence.js': 'Every historical transition was reviewed. Source authority spoofing was fixed and a canonical external/native evidence floor was added. Later normalization excluded ineligible documents; the working tree additionally makes malformed stop floors fail closed and bounds nested projections.',
  'src/ai/research/decision.js': 'Every historical transition was reviewed. Current/causal research was separated from capability, then snapshot eligibility and finance-domain coverage reduced unnecessary web dependency. The working tree preserves that choice and makes time/diagnostic output deterministic.',
  'src/ai/research/plan.js': 'The complete historical addition was reviewed. Dynamic dates, source policies and counter-hypothesis queries were present from inception; the working tree freezes query rows and prevents malformed budgets from widening or bypassing the plan.',
  'src/ai/response/claim-ledger.js': 'Every historical transition was reviewed. Claims progressed from all-required to prose-aware optional ledgers and partial-plan degradation. The original error-count arithmetic could undercount valid claims and parsed nested payloads stayed mutable; both are corrected in the working tree.',
  'src/ai/retrieval/knowledge.js': 'The complete committed addition and current retry/cancellation changes were reviewed. The reference-only boundary was explicit from inception; the working tree hardens malformed arrays, integer budgets, loader availability and error disclosure.',
  'src/data/contracts/source-registry.js': 'Every unique blob transition for this file was reviewed. The registry evolved from unavailable/licensed placeholders to explicit public-reference origins, publisher/subscriber labels, rights ceilings and gap contracts. These are metadata and operational constraints, not evidence that values were collected or current.',
  'src/data/knowledge/repository.js': 'Every unique blob transition for this file was reviewed. quantitativeLabs was deliberately removed/excluded by product scope while relationship guides/current observations were added on another branch; the current repository preserves that intent.',
  'src/domain/knowledge/selectors.js': 'Every unique blob transition for this file was reviewed alongside repository capability changes. The obsolete quantitativeLabs selector was leftover API surface after the capability was deliberately excluded.',
  'src/storage/vault.js': 'Every unique blob transition for this file was reviewed. The original consent-only plaintext wrapper was replaced by an explicit encrypted-at-rest capability requirement; current disabled state is safer than claiming a connected Vault.',
  'src/ui/pages/legacy-observer.js': 'The complete historical addition was reviewed. It was a small legacy route observer later superseded by native lifecycle ownership; current working deletion removes an unreachable file and is separately tested by the retirement contract.',
  'src/data/contracts/operations.js': 'Every unique blob transition was reviewed. The file grew from a basic status envelope to explicit operational states and provider/reconciliation checks; hardcoded category cardinality remains a drift risk.',
  'src/data/contracts/reconciliation.js': 'Every unique blob transition was reviewed. Validation expanded to category refresh/origin/evidence closure and critical gaps; it remains an operational metadata validator rather than source-truth verification.'
  ,'src/data/normalize/portfolio.js': 'Every unique blob transition was reviewed. Numeric projection grew with portfolio fields and later preserved missing price/value, but null/blank coercion existed from the initial implementation until P1022 corrected it in the working tree.'
  ,'src/state/slices/themes.js': 'Every unique blob transition was reviewed. selectedDetail was appended using truthy fallback, which made explicit null unable to clear old state until P1022.'
  ,'src/data/orchestrators/entity.js': 'Every unique blob transition was reviewed. The synchronous writer became awaitable, then gained generation, dispose and route-scope guards to prevent late entity overwrite; the progression is coherent and remains in current code.'
  ,'src/app/router.js': 'Every unique blob transition was reviewed. The minimal route switcher gained route-owned abort scopes, vertical-slice metadata and retryable lazy modules; P1023 closes the remaining post-dispose transition path in the working tree.'
  ,'src/app/lifecycle.js': 'Every unique blob transition was reviewed. Resource bags were extended with route-owned chart cleanup; P1023 adds the missing application timer/microtask lifecycle in the working tree.'
  ,'src/domain/knowledge/graph.js': 'Every unique blob transition was reviewed. Inferred metadata was added after the initial graph; the working tree now rejects invalid enum/collection inputs and distinguishes non-causal navigation edges.'
  ,'src/domain/knowledge/learning-state.js': 'Every unique blob transition was reviewed. Retrieval logging was deliberately removed from browser learning state, but nested stored objects remained mutable until the working-tree correction.'
  ,'src/domain/knowledge/principles-edge-semantics.js': 'The sole historical generated addition was reviewed record-by-record with its builder. Seventeen then-unmapped cross-industry relations received generic CAUSES metadata; the working tree regenerates them as explicit navigation-only relations.'
  ,'scripts/build-principles-edge-semantics.mjs': 'Every unique blob transition was reviewed. Atomic writing was a valid durability improvement; the original generic CAUSES fallback and duplicate rows pass are removed in the working tree.'
  ,'src/domain/screener/pit-validation.js': 'Every unique blob transition was reviewed. The initial checklist-like validator gained finite cost/liquidity checks and deliberately disabled automatic promotion; the working tree adds run-level time validation and immutable diagnostics. It is still not connected to a production PIT collector.'
  ,'src/domain/screener/refresh-planner.js': 'The sole historical addition was reviewed. It introduced the intended queue/dedupe/backoff/circuit design, but malformed numeric limits could bypass the global quota until the working-tree correction.'
  ,'src/domain/screener/outcome-ledger.js': 'Every unique blob transition was reviewed. Calendar-day horizon and endpoint drawdown fabrication were already removed, but the original field assignment stored net return under rawReturn through all revisions; the working tree introduces a migrated gross/net contract.'
  ,'src/domain/market/breadth.js': 'Every unique blob transition was reviewed. The model was intentionally designed as AIO-universe participation rather than exchange breadth, then updated for durable same-universe history. The working tree adds the missing 0..100 input domain guard.'
  ,'src/domain/portfolio/concentration.js': 'The complete historical extraction was reviewed. It deliberately preserved different total and holding valuation fallbacks for parity; the working-tree v2 removes that inherited defect while preserving valid golden fixtures.'
  ,'src/domain/portfolio/surface.js': 'Every unique blob transition was reviewed. Partial aggregation bugs were incrementally fixed, but negative holdings and an imperative fixed-VIX exposure label remained until the working-tree correction.'
  ,'src/domain/signal/trading-score.js': 'Every unique blob transition was reviewed. A valuable extraction removed a drifting backtest copy and later added evidence coverage gates, but trusted caller clamping, mutable output and unbounded news impacts remained implicit. v2 enforces those boundaries while retaining valid golden parity.'
  ,'src/domain/fundamental/sec-report.js': 'Every unique blob transition was reviewed. The report grew from a metric list to freshness, quarantine and accepted-time PIT reconstruction. An empty anomalies array could still erase a boolean producer anomaly until the working-tree correction.'
  ,'src/domain/technical/stage.js': 'Every unique blob transition was reviewed. The original MA-stack parity extraction and later OHLCV composition are coherent; the working tree adds the missing positive-price boundary without changing valid parity.'
  ,'src/domain/ai/inference-efficiency.js': 'The complete committed addition was reviewed. It was explicitly reference-only, but its proxy helper inferred LIVE from a provider/source label alone; the working tree preserves the taxonomy while requiring an explicit source kind for LIVE.'
};
for (const commit of manifest.commits) for (const change of commit.changes) {
  if (!reviewedHistoryPaths.has(change.path)) continue;
  if (existing.some(row => row.type === 'history-transition' && row.commit === commit.sha && row.path === change.path && row.before === change.before && row.after === change.after)) continue;
  if (entries.some(row => row.type === 'history-transition' && row.commit === commit.sha && row.path === change.path && row.before === change.before && row.after === change.after)) continue;
  entries.push({ type: 'history-transition', at: new Date().toISOString(), commit: commit.sha, ...change, semanticReview: 'reviewed', note: historyNotes[change.path] || 'The complete added blob or changed hunk, its immediate file context and the current successor were reviewed. This credits only this exact transition; it does not certify the rest of the commit or the runtime feature.' });
}
fs.appendFileSync(ledger, entries.map(row=>JSON.stringify(row)).join('\n') + (entries.length ? '\n' : ''));
console.log(JSON.stringify({ recorded: entries.length, currentFiles: Object.keys(files).length }));
