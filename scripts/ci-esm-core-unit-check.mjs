import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// RM-05 item 3: minimal isolated unit contracts for the new ESM core (store/router/lifecycle/
// evidence-store/facade). ci-architecture-contract-check.mjs already exercises these together in
// realistic wiring (route modules, providers, orchestrators); this file tests each module's OWN
// contract in isolation, independent of any specific route or provider, so a regression in one
// module's basic behavior is traceable without the noise of the full integration fixture.
// 2026-07-21 (Fable-advisor review, ARX-04 follow-up): added the screener/entity orchestrators'
// generation-counter staleness guard here too — it's a core correctness contract (not route- or
// provider-specific: it's tested against fake providers) of exactly the kind this file exists for.
// 2026-07-22/ARX-11: signal now consumes the extracted trading-score model; its score-to-action
// envelope is covered below so the retired three-input toy cannot return as a parallel owner.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { throw new Error(`[esm-core-unit] ${message}`); };
const load = (rel) => import(pathToFileURL(path.join(root, rel)));

const { createStore } = await load('src/state/store.js');
const { createLazyPage, createRouteRegistry, createLifecycleRouter } = await load('src/app/router.js');
const { ROUTE_IDS } = await load('src/app/routes.js');
const { getVerticalSliceContract, auditVerticalSliceContracts } = await load('src/app/vertical-slices.js');
const { createResourceBag, createDeferredTaskQueue, coalesceMicrotask, createChartRegistry } = await load('src/app/lifecycle.js');
const { createEvidenceStore } = await load('src/data/evidence-store.js');
const { createLegacyFacade, exposeArchitecture } = await load('src/legacy/compatibility-facade.js');

// ── store.js ─────────────────────────────────────────────────────────────────────────────────
{
  const reducer = (state, action) => action.type === 'inc' ? { count: state.count + 1 } : state;
  const store = createStore({ initialState: { count: 0 }, reducer });
  if (store.getState().count !== 0) fail('store: initial state not applied');
  let seen = [];
  const unsubscribe = store.subscribe((state, action) => seen.push([state.count, action.type]));
  store.dispatch({ type: 'inc' });
  store.dispatch({ type: 'inc' });
  if (store.getState().count !== 2) fail('store: dispatch did not accumulate through reducer');
  if (seen.length !== 2 || seen[1][0] !== 2 || seen[1][1] !== 'inc') fail('store: subscriber was not notified with post-dispatch state and the triggering action');
  unsubscribe();
  store.dispatch({ type: 'inc' });
  if (seen.length !== 2) fail('store: unsubscribe did not stop further notifications');
  let threw = false;
  try { store.dispatch({ type: 123 }); } catch (_) { threw = true; }
  if (!threw) fail('store: dispatch accepted an action with a non-string type');
  threw = false;
  try { store.dispatch(null); } catch (_) { threw = true; }
  if (!threw) fail('store: dispatch accepted a null action');
  const throwingStore = createStore({ initialState: {}, reducer: () => undefined });
  threw = false;
  try { throwingStore.dispatch({ type: 'x' }); } catch (_) { threw = true; }
  if (!threw) fail('store: dispatch did not reject a reducer that returned undefined');
  threw = false;
  try { store.subscribe('not-a-function'); } catch (_) { threw = true; }
  if (!threw) fail('store: subscribe accepted a non-function listener');
}

// ── domain/screener/factor-weights.js ─────────────────────────────────────────────────────────
{
  const { deriveFactorWeights } = await load('src/domain/screener/factor-weights.js');
  const neutral = deriveFactorWeights();
  if (neutral.weights.momentum !== 0.27 || neutral.weights.lowvol !== 0.16 || neutral.regimeLabel !== '중립 → 균형 가중') fail(`factor-weights: neutral drifted, got ${JSON.stringify(neutral)}`);
  const defensive = deriveFactorWeights({ marketState: { riskScore: 65 } });
  if (defensive.weights.lowvol <= neutral.weights.lowvol || defensive.weights.momentum >= neutral.weights.momentum || !defensive.regimeLabel.includes('위험회피')) fail(`factor-weights: risk-off tilt missing, got ${JSON.stringify(defensive)}`);
  const profile = deriveFactorWeights({ profile: { label: '테스트', desc: '직접 가중', weights: { momentum: 2, trend: 1 } } });
  if (Math.abs(profile.weights.momentum - (2 / 3)) > 1e-12 || profile.weights.trend !== (1 / 3) || !profile.regimeLabel.includes('테스트')) fail(`factor-weights: profile normalization drifted, got ${JSON.stringify(profile)}`);
}

// ── lifecycle.js (createResourceBag) ────────────────────────────────────────────────────────
// P1019/P1020: failure must not poison caches, requests or regime inputs.
{
  const { createSelector } = await load('src/state/memoize.js');
  let throwing = false, calls = 0;
  const select = createSelector([value => value], value => { calls++; if (throwing) throw new Error('fixture'); return value * 2; });
  select(2); throwing = true;
  try { select(3); } catch (_) {}
  throwing = false;
  if (select(3) !== 6 || calls !== 3) fail('selector: failed compute poisoned the last successful input/result pair');
  const { deriveFactorWeights } = await load('src/domain/screener/factor-weights.js');
  const ko = deriveFactorWeights({ marketState: { riskScore: NaN, fgZone: '공포' } });
  const en = deriveFactorWeights({ marketState: { fgZone: 'extreme fear' } });
  if (JSON.stringify(ko.weights) !== JSON.stringify(en.weights) || ko.weights.lowvol !== 0.28) fail('factor-weights: equivalent Korean/English regime labels diverged');
  for (const weights of [{ momentum: NaN }, { momentum: -1 }, { momentum: 0 }, { constructor: 1 }, { momentum: '1' }]) {
    let rejected = false;
    try { deriveFactorWeights({ profile: { weights } }); } catch (_) { rejected = true; }
    if (!rejected) fail('factor-weights: invalid profile was accepted');
  }
  const { createHttpClient } = await load('src/platform/http.js');
  let requestCount = 0, received;
  const client = createHttpClient({ fetchImpl: async (_, init) => { requestCount++; received = new Headers(init.headers); return { ok: true, status: 200, json: async () => ({ value: 1 }) }; } });
  for (const headers of [new Headers({ 'x-test': 'kept' }), [['x-test', 'kept']], { 'x-test': 'kept' }]) {
    if (!(await client.requestJson('fixture', { headers })).ok || received.get('x-test') !== 'kept') fail('http: header input lost');
  }
  const controller = new AbortController(); controller.abort();
  if ((await client.requestJson('fixture', { signal: controller.signal })).error !== 'HTTP_ABORTED' || requestCount !== 3) fail('http: pre-aborted request invoked transport');
  let complete;
  const timeout = createHttpClient({ defaultTimeoutMs: 5, fetchImpl: () => new Promise(resolve => { complete = resolve; }) }).requestJson('fixture');
  const timed = await Promise.race([timeout, new Promise(resolve => setTimeout(() => resolve(null), 150))]);
  complete({ ok: true, status: 200, json: async () => ({}) });
  if (timed?.error !== 'HTTP_TIMEOUT' || (await timeout).ok) fail('http: ignored abort published late success or never settled');
  const bodyTimeout = await createHttpClient({ defaultTimeoutMs: 5, fetchImpl: async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }) }).requestJson('fixture');
  if (bodyTimeout.error !== 'HTTP_TIMEOUT') fail('http: deadline excludes JSON body wait');
}

{
  const order = [];
  const bag = createResourceBag();
  bag.add(() => order.push('first'));
  bag.add(() => order.push('second'));
  bag.add(() => order.push('third'));
  if (bag.size() !== 3) fail('lifecycle: size() did not reflect 3 registered disposers');
  bag.dispose();
  if (order.join(',') !== 'third,second,first') fail(`lifecycle: disposers did not run in reverse registration order: ${order.join(',')}`);
  if (bag.size() !== 0) fail('lifecycle: size() did not reset to 0 after dispose');
  let secondDisposeThrew = false;
  try { bag.dispose(); } catch (_) { secondDisposeThrew = true; }
  if (secondDisposeThrew) fail('lifecycle: a second dispose() call must be a safe no-op, not throw');
  let calledImmediately = false;
  const postDisposeUnsubscribe = bag.add(() => { calledImmediately = true; });
  if (!calledImmediately) fail('lifecycle: adding a disposer after dispose() must invoke it immediately (resource must not be silently kept alive)');
  if (typeof postDisposeUnsubscribe !== 'function') fail('lifecycle: add() must always return a function, even post-dispose');
  const throwingBag = createResourceBag();
  throwingBag.add(() => { throw new Error('disposer boom'); });
  let disposeOfThrowingBagThrew = false;
  try { throwingBag.dispose(); } catch (_) { disposeOfThrowingBagThrew = true; }
  if (disposeOfThrowingBagThrew) fail('lifecycle: one disposer throwing must not stop dispose() or propagate (other resources must still be released)');
}

// ── lifecycle.js (createDeferredTaskQueue) ───────────────────────────────────────────────────
{
  let nextId = 0;
  const pending = new Map();
  const queue = createDeferredTaskQueue({
    setTimeoutImpl: (task, delay) => {
      const id = ++nextId;
      pending.set(id, { task, delay });
      return id;
    },
    clearTimeoutImpl: (id) => pending.delete(id)
  });
  let calls = 0;
  queue.defer(() => { calls++; }, 2300);
  queue.defer(() => { calls++; }, 0);
  if (queue.size() !== 2 || pending.size !== 2) fail('lifecycle: deferred queue did not retain both pending tasks');
  queue.stop();
  if (!queue.stopped || queue.size() !== 0 || pending.size !== 0) fail('lifecycle: stop() did not cancel and release pending tasks');
  if (queue.defer(() => { calls++; }, 0) !== null) fail('lifecycle: stopped queue accepted new work');
  if (calls !== 0) fail('lifecycle: stopped queue executed a cancelled task');
  queue.stop();
}

// ── lifecycle.js (coalesceMicrotask) ─────────────────────────────────────────────────────────
{
  const pending = [];
  const calls = [];
  let active = true;
  const coalesced = coalesceMicrotask((value) => calls.push(value), {
    isActive: () => active,
    queueMicrotaskImpl: (task) => pending.push(task)
  });
  coalesced('first');
  coalesced('latest');
  if (pending.length !== 1 || calls.length !== 0) fail('lifecycle: same-tick calls were not coalesced');
  pending.shift()();
  if (calls.join(',') !== 'latest') fail('lifecycle: coalescer did not keep the trailing arguments');
  coalesced('after-stop');
  active = false;
  pending.shift()();
  if (calls.length !== 1) fail('lifecycle: inactive coalescer published after stop');
}

// ── lifecycle.js (route-owned chart registry) ────────────────────────────────────────────────
{
  const canvas = { style: { maxHeight: '' }, dataset: {} };
  let firstDestroyed = 0;
  let secondDestroyed = 0;
  const registry = createChartRegistry({ maxCanvasHeight: 320 });
  registry.set('trend', { chart: { destroy: () => { firstDestroyed += 1; } }, canvas });
  if (registry.size() !== 1 || canvas.style.maxHeight !== '320px' || canvas.dataset.aioChartRegistry !== 'trend') fail('chart-registry: first chart was not registered and bounded');
  registry.set('trend', { chart: { destroy: () => { secondDestroyed += 1; } }, canvas });
  if (firstDestroyed !== 1 || registry.size() !== 1) fail('chart-registry: replacing a chart did not destroy the previous instance exactly once');
  registry.dispose();
  if (secondDestroyed !== 1 || registry.size() !== 0 || canvas.style.maxHeight !== '' || canvas.dataset.aioChartRegistry) fail('chart-registry: dispose did not destroy, clear, and restore the canvas ownership marker');
}

// ── router.js ────────────────────────────────────────────────────────────────────────────────
{
  const mountLog = [];
  const disposeLog = [];
  const scopeLog = [];
  const makePage = (route) => ({
    route,
    mount: ({ scope }) => { scopeLog.push(scope); mountLog.push(route); return () => disposeLog.push(route); }
  });
  const registry = createRouteRegistry({ modules: { home: makePage('home'), signal: makePage('signal'), ticker: makePage('ticker') } });
  if (typeof registry.home?.mount !== 'function') fail('router: createRouteRegistry did not wire the provided home module');
  if (typeof registry.guide?.mount !== 'function') fail('router: createRouteRegistry did not fall back to a default page for an unprovided registered route id');
  const target = new EventTarget();
  const router = createLifecycleRouter({ root: target, registry, context: {} });
  const started = router.start();
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'home' }));
  if (started.active() !== 'home' || mountLog.join(',') !== 'home') fail('router: pageShown event did not transition into the home route');
  if (scopeLog[0]?.sliceId !== 'vs01-home-signal' || !scopeLog[0]?.requiredData.includes('quotes')) fail('router: home scope did not expose its vertical slice contract');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'home' }));
  if (mountLog.join(',') !== 'home') fail('router: transitioning to the already-active route must be a no-op, not remount');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'signal' }));
  if (started.active() !== 'signal' || disposeLog.join(',') !== 'home' || mountLog.join(',') !== 'home,signal') fail('router: transitioning away must dispose the previous route before mounting the next');
  const signalScope = scopeLog[1];
  if (!signalScope || signalScope.mountId !== 2 || signalScope.routeId !== 'signal' || signalScope.isCurrent() !== true) fail('router: active route scope did not expose route identity/currentness');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: { pageId: 'ticker', args: ['nvda'] } }));
  const firstTickerScope = scopeLog[2];
  if (firstTickerScope?.entityId !== 'NVDA' || !signalScope.signal?.aborted || signalScope.isCurrent()) fail('router: route transition did not abort and invalidate the previous scope or normalize entity identity');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: { pageId: 'ticker', args: ['msft'] } }));
  const secondTickerScope = scopeLog[3];
  if (secondTickerScope?.entityId !== 'MSFT' || secondTickerScope?.sliceId !== 'vs02-technical-ticker' || !firstTickerScope.signal?.aborted || firstTickerScope.isCurrent() || mountLog.join(',') !== 'home,signal,ticker,ticker') fail('router: ticker/entity scope did not remount for a changed entity');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: { pageId: 'ticker', args: ['msft'] } }));
  if (scopeLog.length !== 4) fail('router: identical route/entity transition must remain a no-op');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'not-a-real-route' }));
  if (started.active() !== 'ticker') fail('router: an unknown route id must not change the active route');
  started.dispose();
  if (disposeLog.join(',') !== 'home,signal,ticker,ticker') fail('router: router.dispose() must dispose the currently active route');
  if (started.active() !== null) fail('router: active() must be null after dispose()');
  if (started.transition('home') !== false || mountLog.join(',') !== 'home,signal,ticker,ticker') fail('router: disposed router accepted a late transition');
  let restartThrew = false;
  try { router.start(); } catch (_) { restartThrew = true; }
  if (!restartThrew) fail('router: disposed router restarted and could republish route state');
  let missingRootThrew = false;
  try { createLifecycleRouter({ root: null, registry }); } catch (_) { missingRootThrew = true; }
  if (!missingRootThrew) fail('router: createLifecycleRouter accepted a root with no addEventListener');
}

// ── evidence-store.js ────────────────────────────────────────────────────────────────────────
{
  const store = createEvidenceStore();
  if (store.get('fearGreed') !== null) fail('evidence-store: get() on an empty store must return null, not undefined/throw');
  const evidence = store.ingest({ metric: 'fearGreed', value: 40, unit: 'score', sourceKind: 'fixture', observedAt: '2026-07-19T00:00:00Z', fetchedAt: '2026-07-19T00:00:01Z', status: 'live' });
  if (store.get('fearGreed')?.evidenceId !== evidence.evidenceId) fail('evidence-store: ingest then get did not round-trip the same evidence');
  if (Object.keys(store.snapshot()).length !== 1) fail('evidence-store: snapshot() did not reflect the single ingested entry');
  let invalidThrew = false;
  try { store.ingest({ status: 'live', value: null }); } catch (_) { invalidThrew = true; }
  if (!invalidThrew) fail('evidence-store: ingest accepted an evidence input with no metric and no value on a status that requires one');
  store.clear();
  if (store.get('fearGreed') !== null || Object.keys(store.snapshot()).length !== 0) fail('evidence-store: clear() did not empty the store');
}

// ── W1-01/W1-02: one allowedUse enum and decision-only selectors ─────────────────────────────
{
  const { createEvidence, normalizeAllowedUse, restrictAllowedUse } = await load('src/data/contracts/evidence.js');
  const { applyFreshness } = await load('src/data/quality/freshness.js');
  const { selectForDecision, selectForDisplay, selectLastKnown, selectCompleteness } = await load('src/data/selectors/evidence.js');
  if (normalizeAllowedUse(true) !== 'decision' || normalizeAllowedUse('reference-only') !== 'reference' || normalizeAllowedUse('unknown-provider-state') !== 'none') {
    fail('truth-boundary: legacy allowedUse aliases must normalize to decision/reference/none and unknown values must fail closed');
  }
  if (restrictAllowedUse('decision', 'reference') !== 'reference' || restrictAllowedUse('fresh', 'none') !== 'none') {
    fail('truth-boundary: allowed-use restriction must choose the most restrictive policy');
  }
  const referenceCurrent = applyFreshness({ metric: 'reference-current', value: 7, status: 'live', allowedUse: 'reference', allowedUseCeiling: 'reference', observedAt: '2026-07-19T00:00:00Z' }, { now: Date.parse('2026-07-19T00:01:00Z') });
  const impossiblePromotion = createEvidence({ metric: 'snapshot-promote', value: 8, status: 'snapshot', allowedUse: 'decision' });
  if (referenceCurrent.status !== 'fresh' || referenceCurrent.allowedUse !== 'reference' || impossiblePromotion.allowedUse !== 'reference') {
    fail(`truth-boundary: freshness/status promoted restricted evidence: ${JSON.stringify({ referenceCurrent, impossiblePromotion })}`);
  }
  const evidence = {
    live: createEvidence({ metric: 'live', value: 1, status: 'live', allowedUse: true, observedAt: '2026-07-19T00:00:00Z' }),
    snapshot: createEvidence({ metric: 'snapshot', value: 2, status: 'snapshot', allowedUse: 'reference-only' }),
    stale: createEvidence({ metric: 'stale', value: 3, status: 'stale', allowedUse: 'reference' }),
    missing: createEvidence({ metric: 'missing', value: null, status: 'missing', allowedUse: false })
  };
  if (selectForDecision(evidence, 'live')?.value !== 1 || selectForDecision(evidence, 'snapshot') !== null || selectForDecision(evidence, 'stale') !== null) {
    fail('truth-boundary: decision selector admitted reference/stale evidence');
  }
  if (selectForDisplay(evidence, 'snapshot')?.value !== 2 || selectLastKnown(evidence, 'stale')?.value !== 3) {
    fail('truth-boundary: display/LKG selectors did not preserve reference evidence');
  }
  for (const use of ['not-for-decision', 'current-unverified', 'reference-blocked', 'research-unavailable', 'fresh']) {
    if (normalizeAllowedUse(use) !== 'none') fail(`truth-boundary: descriptive or negated policy granted use: ${use}`);
  }
  const undated = createEvidence({ metric: 'undated', value: 42, status: 'fresh', allowedUse: 'decision' });
  if (selectForDisplay(undated)?.value !== 42 || selectForDecision(undated) !== null || undated.status !== 'reference') fail('truth-boundary: undated data must remain visible as reference without decision promotion');
  const future = { metric: 'future', value: 42, status: 'fresh', allowedUse: 'decision', observedAt: '2036-01-01T00:00:00Z' };
  if (selectForDecision(future, undefined, { now: Date.parse('2026-08-31T00:00:00Z') }) !== null) fail('truth-boundary: direct selector admitted a future observation');
  const blocked = { ...evidence.live, allowedUseCeiling: 'none' };
  if (selectForDisplay(blocked) || selectForDecision(blocked) || selectLastKnown(blocked)) fail('truth-boundary: selector bypassed a blocked ceiling');
  const missingTime = applyFreshness({ metric: 'undated', value: 42, status: 'live', allowedUse: 'decision' });
  if (selectForDisplay(missingTime)?.value !== 42 || selectForDecision(missingTime)) fail('truth-boundary: freshness erased undated reference data or promoted it');
  if (applyFreshness(future, { now: Date.parse('2026-08-31T00:00:00Z') }).status !== 'stale') fail('truth-boundary: future date became age zero/fresh');
  if (applyFreshness({ ...evidence.live, allowedUse: undefined }, { now: Date.parse('2026-07-19T00:01:00Z') }).allowedUse !== 'decision') fail('truth-boundary: omitted use lost the valid status default');
  const completeness = selectCompleteness(evidence, ['live', 'snapshot', 'missing']);
  if (completeness.available !== 1 || Math.abs(completeness.coveragePct - (100 / 3)) > 1e-9 || completeness.missing.join(',') !== 'snapshot,missing') {
    fail(`truth-boundary: completeness contract drifted: ${JSON.stringify(completeness)}`);
  }
}

// ── vertical-slices.js ───────────────────────────────────────────────────────────────────────
{
  const audit = auditVerticalSliceContracts(ROUTE_IDS);
  if (!audit.ok || audit.sliceCount !== 13 || audit.coveredRoutes.length !== ROUTE_IDS.length) fail(`vertical-slices: registry coverage drifted: ${JSON.stringify(audit)}`);
  if (getVerticalSliceContract('page-theme-detail')?.id !== 'vs04-themes-detail' || getVerticalSliceContract('missing')) fail('vertical-slices: route lookup did not normalize page ids or reject unknown routes');
}

// ── W1-03: Trading Score reference input must fail closed ───────────────────────────────────
{
  const { computeTradingScoreModel } = await load('src/domain/signal/trading-score.js');
  const decision = (value) => ({ value, status: 'live', allowedUse: 'decision' });
  const reference = (value) => ({ value, status: 'snapshot', allowedUse: 'reference' });
  const full = { vix: decision(18), vvix: decision(90), dxy: decision(100), tnx: decision(3.5), oilPrice: decision(80), fg: decision(50), spx200ma: decision(450), spx50ma: decision(480), spxPrice: decision(500), breadth200: decision(60), pcr: decision(1), hyBp: decision(300) };
  const valid = computeTradingScoreModel({ decisionEvidence: full });
  if (valid.total == null || valid.decisionBlocked || valid.componentCoveragePct !== 100) fail(`truth-boundary: full decision evidence should produce a current score: ${JSON.stringify(valid)}`);
  const blocked = computeTradingScoreModel({ decisionEvidence: { ...full, fg: reference(50) } });
  if (blocked.total !== null || !blocked.decisionBlocked || !blocked.componentMissing.includes('momentum')) fail(`truth-boundary: reference F&G must not drive Trading Score: ${JSON.stringify(blocked)}`);
}

// ── compatibility-facade.js ──────────────────────────────────────────────────────────────────
{
  const facade = createLegacyFacade({}, new EventTarget());
  const emptySentiment = facade.readSentiment();
  if (emptySentiment.fearGreed !== null || emptySentiment.fearGreedSourceKind !== 'unavailable') fail('facade: readSentiment on an empty root must report fail-closed unavailable, not throw or guess a value');
  const withData = createLegacyFacade({ _liveData: { '^VIX': { price: 17.5 } } }, new EventTarget());
  if (withData.readSentiment().vix !== 17.5) fail('facade: readSentiment did not read a present _liveData quote');
  const withAaii = createLegacyFacade({ DATA_SNAPSHOT: { aaiiBear: 39.9, aaiiBull: 35.5, _fieldTs: { aaii: '2026-08-19' } } }, new EventTarget()).readSentiment();
  if (withAaii.aaiiBear !== 39.9 || withAaii.aaiiBull !== 35.5 || withAaii.aaiiObservedAt !== '2026-08-19') fail('facade: AAII values and observation date must reach the native sentiment evidence path together');
  let navigateCalls = 0;
  const rootWithShowPage = { showPage: (id) => { navigateCalls += 1; return id; } };
  const navFacade = createLegacyFacade(rootWithShowPage, new EventTarget());
  const fakeRouter = { transition: () => true };
  const nav = navFacade.installNavigation(fakeRouter);
  if (!nav.installed) fail('facade: installNavigation did not report installed:true over a real showPage function');
  rootWithShowPage.showPage('sentiment');
  if (navigateCalls !== 1) fail('facade: installNavigation must still call through to the original showPage');
  nav.restore();
  if (rootWithShowPage.showPage.__aioArchitectureNavigation) fail('facade: restore() did not remove the navigation wrapper marker');
  const doubleInstall = navFacade.installNavigation(fakeRouter);
  if (!doubleInstall.installed) fail('facade: re-installing navigation after restore() should succeed again');
  const fakeRoot = {};
  exposeArchitecture(fakeRoot, { version: 'test.v1', getState: () => ({}) });
  if (fakeRoot.AIO_ARCH?.version !== 'test.v1' || fakeRoot.AIO_ARCH?.status !== 'MIGRATION_IN_PROGRESS') fail('facade: exposeArchitecture did not expose the expected fields onto root.AIO_ARCH');
}

// ── data/orchestrators/screener.js ──────────────────────────────────────────────────────────
{
  const { createScreenerOrchestrator } = await load('src/data/orchestrators/screener.js');
  const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

  {
    const calls = [];
    const commands = { setData: (payload) => calls.push(payload) };
    const pending = [];
    const provider = { readCurrent: () => { const d = deferred(); pending.push(d); return d.promise; } };
    const orchestrator = createScreenerOrchestrator({ provider, commands });
    const first = orchestrator.sync();
    const second = orchestrator.sync();
    if (pending.length !== 2) fail('screener orchestrator: two overlapping sync() calls did not each invoke provider.readCurrent()');
    pending[1].resolve({ rows: [{ symbol: 'NEW', score: 2 }], status: 'current', updatedAt: 'second' });
    const secondResult = await second;
    if (!secondResult || calls.length !== 1 || calls[0].rows[0].symbol !== 'NEW') fail('screener orchestrator: the newer sync() call did not apply its result');
    pending[0].resolve({ rows: [{ symbol: 'OLD', score: 1 }], status: 'current', updatedAt: 'first' });
    const firstResult = await first;
    if (firstResult !== null) fail('screener orchestrator: an older sync() call resolving after a newer one must return null (superseded), not its normalized data');
    if (calls.length !== 1 || calls[0].rows[0].symbol !== 'NEW') fail('screener orchestrator: a stale older resolution must not overwrite the newer applied state');
  }
  {
    const calls = [];
    const commands = { setData: (payload) => calls.push(payload) };
    const d = deferred();
    const provider = { readCurrent: () => d.promise };
    const orchestrator = createScreenerOrchestrator({ provider, commands });
    const inFlight = orchestrator.sync();
    orchestrator.dispose();
    d.resolve({ rows: [{ symbol: 'AFTER-DISPOSE', score: 1 }], status: 'current', updatedAt: 'x' });
    const result = await inFlight;
    if (result !== null || calls.length !== 0) fail('screener orchestrator: dispose() did not suppress an in-flight resolution');
  }
}

// ── data/orchestrators/entity.js ────────────────────────────────────────────────────────────
{
  const { createEntityOrchestrator } = await load('src/data/orchestrators/entity.js');
  const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

  {
    const calls = [];
    const commands = { setData: (payload) => calls.push(payload) };
    const pending = [];
    const provider = { readCurrent: () => { const d = deferred(); pending.push(d); return d.promise; } };
    const orchestrator = createEntityOrchestrator({ provider, commands });
    const first = orchestrator.sync();
    const second = orchestrator.sync();
    if (pending.length !== 2) fail('entity orchestrator: two overlapping sync() calls did not each invoke provider.readCurrent()');
    pending[1].resolve({ id: 'NEW', updatedAt: 'second' });
    const secondResult = await second;
    if (!secondResult || calls.length !== 1 || calls[0].id !== 'NEW') fail('entity orchestrator: the newer sync() call did not apply its result');
    pending[0].resolve({ id: 'OLD', updatedAt: 'first' });
    const firstResult = await first;
    if (firstResult !== null) fail('entity orchestrator: an older sync() call resolving after a newer one must return null (superseded)');
    if (calls.length !== 1 || calls[0].id !== 'NEW') fail('entity orchestrator: a stale older resolution must not overwrite the newer applied state');
  }
  {
    const calls = [];
    const commands = { setData: (payload) => calls.push(payload) };
    const d = deferred();
    const provider = { readCurrent: () => d.promise };
    const orchestrator = createEntityOrchestrator({ provider, commands });
    const inFlight = orchestrator.sync();
    orchestrator.dispose();
    d.resolve({ id: 'AFTER-DISPOSE', updatedAt: 'x' });
    const result = await inFlight;
    if (result !== null || calls.length !== 0) fail('entity orchestrator: dispose() did not suppress an in-flight resolution');
  }
}

// ── domain/market/breadth.js ────────────────────────────────────────────────────────────────
// Not a legacy extraction (no prior implementation existed for this classifier — P746 follow-up,
// Fable-advisor design, 2026-07-21), so there is no legacy golden fixture to dump/compare against
// the way ci-domain-parity-check.mjs verifies trading-score/RRG/Weinstein-MTF/news-scoring. Hand-
// written expected outputs against the documented thresholds instead, same as this file's other
// sections.
{
  const { classifyBreadthParticipation } = await load('src/domain/market/breadth.js');
  const broad = classifyBreadthParticipation({ sma20: 65, sma50: 60, sma20Delta: 3 });
  if (!broad.available || broad.level !== 'broad' || broad.direction !== 'rising') fail(`breadth: 65/60 sma20/50 with +3pp delta should classify broad+rising, got ${JSON.stringify(broad)}`);
  const narrow = classifyBreadthParticipation({ sma20: 30, sma50: 40, sma20Delta: -5 });
  if (!narrow.available || narrow.level !== 'narrow' || narrow.direction !== 'falling') fail(`breadth: sma20=30 (<=35) with -5pp delta should classify narrow+falling, got ${JSON.stringify(narrow)}`);
  const narrowByCombo = classifyBreadthParticipation({ sma20: 45, sma50: 40 });
  if (!narrowByCombo.available || narrowByCombo.level !== 'narrow') fail(`breadth: sma20=45(<50) and sma50=40(<45) should classify narrow via the combo branch, got ${JSON.stringify(narrowByCombo)}`);
  const neutralFlat = classifyBreadthParticipation({ sma20: 50, sma50: 50, sma20Delta: 0.5 });
  if (!neutralFlat.available || neutralFlat.level !== 'neutral' || neutralFlat.direction !== 'flat') fail(`breadth: 50/50 with +0.5pp (within +-2pp band) should classify neutral+flat, got ${JSON.stringify(neutralFlat)}`);
  const noDelta = classifyBreadthParticipation({ sma20: 50, sma50: 50 });
  if (!noDelta.available || noDelta.direction !== null) fail(`breadth: no delta input must yield direction:null, not a fabricated value — got ${JSON.stringify(noDelta)}`);
  const tiebreak = classifyBreadthParticipation({ sma20: 50, sma50: 50, sma5Delta: 4 });
  if (tiebreak.direction !== 'rising') fail(`breadth: sma5Delta must be used as a fallback direction signal when sma20Delta is absent, got ${JSON.stringify(tiebreak)}`);
  const unavailable = classifyBreadthParticipation({ sma20: null, sma50: 60 });
  if (unavailable.available !== false || unavailable.level !== null) fail(`breadth: a missing required input (sma20) must fail closed to available:false, not guess a level — got ${JSON.stringify(unavailable)}`);
  if (classifyBreadthParticipation({ sma20: 120, sma50: -1 }).available !== false) fail('breadth: percentages outside 0..100 must fail closed');
}

// ── domain/market/health.js (P785: technical primary surface model) ─────────────────────────
{
  const { computeMarketHealth, MARKET_HEALTH_MODEL_VERSION } = await load('src/domain/market/health.js');
  const unavailable = computeMarketHealth({ quotes: { SPY: { pct: 1 }, QQQ: { pct: 1 } } });
  if (unavailable.available || unavailable.modelVersion !== MARKET_HEALTH_MODEL_VERSION || unavailable.score !== null || !unavailable.missing.includes('VIX')) fail(`market-health: missing VIX must fail closed, got ${JSON.stringify(unavailable)}`);
  const bullish = computeMarketHealth({
    quotes: {
      SPY: { pct: 1.5, price: 550 }, QQQ: { pct: 1.2, price: 480 }, '^VIX': { price: 14 },
      AAPL: { pct: 1 }, MSFT: { pct: 1 }, GOOGL: { pct: 1 }, AMZN: { pct: 1 }, NVDA: { pct: 1 }, META: { pct: 1 }, TSLA: { pct: 1 },
      XLK: { pct: 1 }, XLF: { pct: 1 }, XLE: { pct: 1 }, XLV: { pct: 1 }, XLI: { pct: 1 }, XLY: { pct: 1 }
    },
    spxMA: { 50: 500, 200: 450 },
    spxATH: 560
  });
  if (!bullish.available || bullish.score !== 100 || bullish.grade !== 'A+' || bullish.bars.trend !== 85 || bullish.inputs.leaderTotal !== 7) fail(`market-health: bullish thresholds drifted, got ${JSON.stringify(bullish)}`);
  const defensive = computeMarketHealth({ quotes: { SPY: { pct: -2, price: 400 }, QQQ: { pct: -2 }, '^VIX': { price: 35 } }, spxMA: { 50: 450, 200: 500 } });
  if (!defensive.available || defensive.score !== 4 || defensive.grade !== 'F' || defensive.regime !== '극심한 약세') fail(`market-health: defensive thresholds drifted, got ${JSON.stringify(defensive)}`);
  const neutral = computeMarketHealth({ quotes: { SPY: { pct: 0 }, QQQ: { pct: 0 }, '^VIX': { price: 20 } } });
  if (!neutral.available || neutral.score !== 42 || neutral.grade !== 'C' || neutral.bars.spy !== 50 || neutral.bars.qqq !== 50) fail(`market-health: neutral baseline drifted, got ${JSON.stringify(neutral)}`);
  const invalidOptional = computeMarketHealth({ quotes: { SPY: { pct: 0 }, QQQ: { pct: 0 }, '^VIX': { price: 20 }, AAPL: { pct: null }, XLK: { pct: 'bad' } } });
  if (invalidOptional.inputs.leaderTotal !== 0 || invalidOptional.inputs.sectorTotal !== 0) fail('market-health: invalid optional quotes were counted as declining observations');
  if (computeMarketHealth({ quotes: { SPY: { pct: 0 }, QQQ: { pct: 0 }, '^VIX': { price: -1 } } }).available) fail('market-health: impossible negative VIX was accepted');
}

// ── domain boundary missingness and immutability ─────────────────────────────────────────────
{
  const { classifyRRG, computeRelativeRotation } = await load('src/domain/themes/rrg.js');
  if (classifyRRG(null, null).quadrant !== 'unknown') fail('rrg: missing values became a Lagging quadrant');
  const invalidRotation = computeRelativeRotation({ history: Array(21).fill(NaN), benchmarkHistory: Array(21).fill(100), hasQuote: true, hasBenchmarkQuote: true });
  if (invalidRotation.quadrant !== 'unknown') fail('rrg: invalid history produced a quadrant');
  const { deriveHomeSummary } = await load('src/domain/home/summary.js');
  if (deriveHomeSummary({ sentiment: { fearGreed: NaN }, signal: { score: Infinity }, newsCount: -2 }).status !== 'unavailable') fail('home: non-finite inputs counted as available');
  const { deriveSentimentSummary } = await load('src/domain/sentiment/metrics.js');
  const sentiment = deriveSentimentSummary({ fearGreed: 101, vix9d: -1, vix: 17, vix3m: 20, vix6m: 22 });
  if (!sentiment.blocked || !Object.isFrozen(sentiment.vixTermStructure.points)) fail('sentiment: out-of-domain inputs were promoted or mutable');
  const { deriveMacroTransmissionEvidence } = await load('src/domain/macro/transmission.js');
  const macro = deriveMacroTransmissionEvidence({ treasurySupply: '' });
  if (macro.observed.issuance || !Object.isFrozen(macro) || !Object.isFrozen(macro.chain)) fail('macro: blank evidence was observed or projection remained mutable');
  const { computeNewsSentimentScore, computeNewsRiskSignals } = await load('src/domain/news/scoring.js');
  if (computeNewsSentimentScore({ items: 'bad' }).total !== 0 || computeNewsSentimentScore({ items: [{ pubDate: '2026-01-01' }], now: NaN }).label !== '데이터 부족' || computeNewsRiskSignals({ items: 'bad' }).length !== 0) fail('news: malformed collection/time did not fail closed');
  const { deriveConcentrationRisk, concentrationPenaltyForWeight } = await load('src/domain/portfolio/concentration.js');
  const concentration = deriveConcentrationRisk({ positions: [{ ticker: 'BAD', value: -100, qty: -2, price: -5 }] });
  if (concentration.totalValue < 0 || concentrationPenaltyForWeight(-10) !== 0) fail('portfolio: negative holding inputs produced risk weight');
  const shareOnlyConcentration = deriveConcentrationRisk({
    positions: [
      { ticker: 'AAA', shares: 2, currentPrice: 50 },
      { ticker: 'BBB', shares: 1, currentPrice: 100 }
    ]
  });
  if (shareOnlyConcentration.modelVersion !== 'portfolio-concentration.v2') fail('portfolio: unified valuation must advertise the v2 contract');
  if (shareOnlyConcentration.totalValue !== 200 || shareOnlyConcentration.items.some((item) => item.weightPct !== 50)) fail('portfolio: total and holding weights used different valuation formulas');
}

// ── domain/signal/trading-score.js: signal envelope ──────────────────────────────────────────
{
  const { computeTradingScoreModel, deriveSignalDecisionFromTradingScore, deriveTradingScoreDecisionPresentation, SIGNAL_PRESENTATION_MODEL_VERSION } = await load('src/domain/signal/trading-score.js');
  const score = computeTradingScoreModel({ mode: 'swing', vix: 18, vvix: 90, dxy: 100, tnx: 3.5, oilPrice: 80, fg: 50, maCurrent: true, spx200ma: 450, spx50ma: 480, spxPrice: 500, breadthAvailable: true, breadth200: 60, pcr: 1, hyBp: 300, newsSentimentScore: 50, newsRiskSignals: [] });
  const signal = deriveSignalDecisionFromTradingScore({ score, inputVersion: 'unit.v1' });
  if (signal.modelVersion !== 'signal-from-trading-score.v1' || signal.score !== score.total || signal.action !== 'WATCH' || signal.status !== 'current') fail(`signal: canonical trading-score mapping drifted, got ${JSON.stringify(signal)}`);
  if (signal.presentation?.modelVersion !== SIGNAL_PRESENTATION_MODEL_VERSION || signal.presentation?.status !== 'current' || signal.presentation?.action !== 'WATCH') fail(`signal: presentation envelope missing or drifted, got ${JSON.stringify(signal.presentation)}`);
  const favorable = deriveTradingScoreDecisionPresentation({ score: { total: 75, partial: false }, inputVersion: 'unit.v1' });
  if (favorable.tier !== 'favorable' || favorable.decision !== '환경 우호 — 종목별 근거 별도 확인' || favorable.displayScore !== '75') fail(`signal: favorable five-tier presentation drifted, got ${JSON.stringify(favorable)}`);
  const partial = deriveTradingScoreDecisionPresentation({ score: { total: 43, partial: true, componentMissing: ['trend'] }, inputVersion: 'unit.v1' });
  if (partial.status !== 'partial' || partial.displayScore !== '43*' || partial.tier !== 'partial') fail(`signal: partial presentation must remain fail-closed/annotated, got ${JSON.stringify(partial)}`);
  const blocked = deriveSignalDecisionFromTradingScore({ score: computeTradingScoreModel({}), inputVersion: 'unit.v1' });
  if (blocked.status !== 'blocked' || blocked.action !== 'WAIT' || blocked.score !== null || blocked.presentation?.status !== 'blocked' || blocked.presentation?.displayScore !== '—') fail(`signal: missing score inputs must fail closed, got ${JSON.stringify(blocked)}`);
  const invalidScore = computeTradingScoreModel({ mode: 'swing', vix: -10, vvix: 0, dxy: 10, tnx: -1, oilPrice: -5, fg: 101, maCurrent: true, spx200ma: -1, spx50ma: 0, spxPrice: -10, breadthAvailable: true, breadth200: 150, pcr: -1, hyBp: -2, newsSentimentScore: 101, newsRiskSignals: [{ impact: 'bad' }] });
  if (invalidScore.total !== null || invalidScore.modelVersion !== 'trading-score.v2' || !Object.isFrozen(invalidScore) || !Object.isFrozen(invalidScore.componentMissing)) fail(`signal: out-of-domain inputs must fail closed in an immutable v2 result, got ${JSON.stringify(invalidScore)}`);
}

// ── domain/technical/stage.js: deriveTechnicalStageFromOhlcv ───────────────────────────────────
// 2026-07-21/P756: replaces the retired deriveTechnicalModel toy (src/domain/technical/
// indicators.js, had no legacy formula behind it) as normalizeAnalysis's real technical model. Not
// a legacy-dump golden fixture (there's no single legacy function this extracts from — it composes
// a faithful SMA reimplementation with the already-parity-verified classifyMovingAverageStructure),
// so hand-written expected outputs against the documented status/trend thresholds instead.
{
  const { deriveTechnicalStageFromOhlcv } = await load('src/domain/technical/stage.js');
  const bars = (n, closeFn) => Array.from({ length: n }, (_, index) => ({ close: closeFn(index) }));

  const unavailable = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: bars(1, () => 100) });
  if (unavailable.status !== 'unavailable' || unavailable.symbol !== 'SPY') fail(`technical-stage: 1 bar must be status:unavailable with an uppercased symbol, got ${JSON.stringify(unavailable)}`);

  const partial = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: bars(60, (i) => 100 + i) });
  if (partial.status !== 'partial' || partial.indicators.ma20 == null || partial.indicators.ma50 == null) fail(`technical-stage: 60 rising bars (<200) must be status:partial with ma20/ma50 present, got ${JSON.stringify(partial)}`);

  const uptrend = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: bars(220, (i) => 100 + i * 0.5) });
  if (uptrend.status !== 'current' || uptrend.indicators.trend !== 'above-ma20' || uptrend.structure.stageEstimate !== 'STAGE_2_ADVANCE') fail(`technical-stage: 220 steadily rising bars must be status:current, trend:above-ma20, STAGE_2_ADVANCE, got ${JSON.stringify(uptrend)}`);

  const downtrend = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: bars(220, (i) => 210 - i * 0.5) });
  if (downtrend.indicators.trend !== 'below-ma20' || downtrend.structure.stageEstimate !== 'STAGE_4_DECLINE') fail(`technical-stage: 220 steadily falling bars must be trend:below-ma20, STAGE_4_DECLINE, got ${JSON.stringify(downtrend)}`);

  const noInput = deriveTechnicalStageFromOhlcv({});
  if (noInput.status !== 'unavailable' || noInput.symbol !== null || noInput.observedCount !== 0) fail(`technical-stage: no input must fail closed to unavailable/null/0, not throw or guess, got ${JSON.stringify(noInput)}`);
  const invalidPrices = deriveTechnicalStageFromOhlcv({ symbol: 'bad', ohlcv: [{ close: -1 }, { close: 0 }, { close: 'not-a-price' }] });
  if (invalidPrices.status !== 'unavailable' || invalidPrices.observedCount !== 0) fail(`technical-stage: non-positive prices must not form a trend, got ${JSON.stringify(invalidPrices)}`);
}

// ── domain/screener/factor-ranks.js: computeFactorRanks NaN/missing/tie handling ───────────────
// 2026-07-21/P759: the golden-fixture parity in ci-domain-parity-check.mjs cannot exercise genuine
// NaN inputs — NaN silently becomes JSON `null` (typeof 'object') across the fixture file's
// save/reload round trip, which would corrupt the very eligibility check this is meant to test.
// Verified here instead as direct in-memory assertions (no serialization involved), alongside two
// other legacy subtleties Fable's design review flagged: sparse factorScores/_z_* keys, and stable
// (no-tiebreaker) sort ordering for exactly-tied composite scores.
{
  const { computeFactorRanks } = await load('src/domain/screener/factor-ranks.js');
  const baseRow = (sym, sector, seed, includeKalman = true) => ({
    sym, sector, ret1m: seed, ret3m: seed * 0.8, ret6m: seed * 0.5, pctSma50: seed, pctSma200: seed * 0.6, vol: 20 - seed,
    ...(includeKalman ? { kalmanVelConf: seed / 10 } : {})
  });

  // NaN is an invalid observation: keep it in the input audit, outside the rank denominator.
  {
    const cleanRows = [1, 2, 3, 4, 5, 6].map((seed) => baseRow('S' + seed, 'Tech', seed));
    const withNaN = [...cleanRows, { sym: 'NANROW', sector: 'Tech', ret1m: NaN, ret3m: NaN, ret6m: NaN, pctSma50: NaN, pctSma200: NaN, vol: NaN, kalmanVelConf: NaN }];
    const withoutNaN = computeFactorRanks({ rows: cleanRows, now: 0 });
    const withNaNResult = computeFactorRanks({ rows: withNaN, now: 0 });
    if (withNaNResult.ranked !== 6 || withNaNResult.inputAudit.invalidCoreRows !== 1) fail(`factor-ranks: NaN must be audited outside the rank universe, got ranked=${withNaNResult.ranked}`);
    const nanRowResult = withNaNResult.rows.find((r) => r.sym === 'NANROW');
    if (nanRowResult || JSON.stringify(withNaNResult.rows) !== JSON.stringify(withoutNaN.rows)) fail('factor-ranks: invalid rows must not receive ranks or change peer percentiles');
    const s1Before = withoutNaN.rows.find((r) => r.sym === 'S1');
    const s1After = withNaNResult.rows.find((r) => r.sym === 'S1');
    if (Math.abs(s1Before._compositeZ - s1After._compositeZ) > 1e-9) fail(`factor-ranks: adding a NaN row must not change other rows' z-scores (stats collection must exclude it) — S1 _compositeZ ${s1Before._compositeZ} vs ${s1After._compositeZ}`);
  }

  // A row with neither ret1m nor ret3m present must be excluded entirely (not just zeroed).
  {
    const rows = [1, 2, 3, 4, 5].map((seed) => baseRow('S' + seed, 'Tech', seed));
    rows.push({ sym: 'NOELIGIBLE', sector: 'Tech', vol: 10 });
    const result = computeFactorRanks({ rows, now: 0 });
    if (result.ranked !== 5 || result.rows.some((r) => r.sym === 'NOELIGIBLE')) fail(`factor-ranks: a row with no ret1m/ret3m must be excluded from items entirely, got ranked=${result.ranked}, syms=${JSON.stringify(result.rows.map((r) => r.sym))}`);
  }

  // Fewer than 5 eligible rows must fail closed to available:false (matches legacy's early return).
  {
    const result = computeFactorRanks({ rows: [1, 2, 3].map((seed) => baseRow('S' + seed, 'Tech', seed)), now: 0 });
    if (result.available !== false || result.ranked !== 0) fail(`factor-ranks: fewer than 5 eligible rows must fail closed, got ${JSON.stringify(result)}`);
  }

  // Inactive factors (fundamentals below coverage threshold, no value/quality/kalman data at all)
  // must be entirely ABSENT from factorScores/activeFactors, not present with a null/0 placeholder.
  {
    const result = computeFactorRanks({ rows: [1, 2, 3, 4, 5, 6].map((seed) => baseRow('S' + seed, 'Tech', seed, false)), fundamentalCoveragePct: 0, fmpOk: false, now: 0 });
    if (result.activeFactors.includes('value') || result.activeFactors.includes('quality') || result.activeFactors.includes('kalman')) fail(`factor-ranks: value/quality/kalman must be inactive with no fundamental/kalman data, got activeFactors=${JSON.stringify(result.activeFactors)}`);
    if ('value' in result.rows[0].factorScores || 'quality' in result.rows[0].factorScores) fail(`factor-ranks: inactive factor keys must be entirely absent from factorScores (sparse), not present as null/0 — got ${JSON.stringify(result.rows[0].factorScores)}`);
  }

  // Exactly-tied composite scores must keep the input array's order (stable sort, no tiebreaker).
  {
    const tiedRows = [1, 2, 3, 4, 5, 6].map((seed) => baseRow('S' + seed, 'Tech', seed));
    const identicalPair = [{ ...tiedRows[0], sym: 'TIE_A' }, { ...tiedRows[0], sym: 'TIE_B' }];
    const result = computeFactorRanks({ rows: [...tiedRows.slice(1), ...identicalPair], now: 0 });
    const tieA = result.rows.find((r) => r.sym === 'TIE_A');
    const tieB = result.rows.find((r) => r.sym === 'TIE_B');
    if (tieA._compositeZ !== tieB._compositeZ) fail(`factor-ranks: test setup expected identical composite scores for the tie check, got ${tieA._compositeZ} vs ${tieB._compositeZ}`);
    if (tieA.rank !== tieB.rank) fail(`factor-ranks: equal composites must receive equal midranks, got ranks ${tieA.rank}/${tieB.rank}`);
  }
}

// ── domain/portfolio/surface.js + domain/fundamental/sec-report.js ─────────────────────────────
// P831/P832: deterministic native secondary projections must preserve null/unavailable inputs,
// finite quote derivation, and official-SEC provenance rather than converting missing facts to 0.
{
// ── domain/screener/setup-profile.js: reference-only setup labels fail closed ────────────────
// v53.91: setup observations and TradingView evidence are research overlays only;
// missing volume/benchmark evidence must stay visible instead of becoming a trade signal.
{
  const { deriveScreenerSetupProfile } = await load('src/domain/screener/setup-profile.js');
  const pullback = deriveScreenerSetupProfile({
    observedAt: '2026-08-09', rank: 80, ret1m: -2, ret3m: 15, ret6m: 30,
    pctSma50: -1, pctSma200: 1, rsi: 55,
  });
  if (pullback.status !== 'partial' || pullback.relativeStrengthPullback !== 'candidate' || pullback.support200 !== 'near') {
    fail(`setup-profile: relative-strength pullback candidate drifted, got ${JSON.stringify(pullback)}`);
  }
  if (pullback.volumeEvidence !== 'unavailable' || pullback.allowedUse !== 'research-relative-ranking-only' || !pullback.missingEvidence.includes('RVOL')) {
    fail(`setup-profile: missing evidence must fail closed, got ${JSON.stringify(pullback)}`);
  }

  const winner = deriveScreenerSetupProfile({
    observedAt: '2026-08-09', rank: 80, ret1m: 2, ret3m: 15, ret6m: 30,
    pctSma50: 8, pctSma200: 25, rsi: 62, rvol20: 1.8,
    price: 100, adrPct: 5.2, pctFrom52wLow: 85, dollarVolume30d: 20_000_000,
    dollarVolume: 8_000_000, ema8: 102, ema21: 98, ema60: 90,
    benchmarkRet: 1, instrumentRef: { currency: 'USD' }
  });
  if (winner.winnerFilter !== 'candidate' || winner.winnerChecks.ema8Above21 !== true) {
    fail(`setup-profile: TradingView winner evidence should pass complete fixture, got ${JSON.stringify(winner)}`);
  }
  const winnerMissing = deriveScreenerSetupProfile({ observedAt: '2026-08-09', price: 100 });
  if (winnerMissing.winnerFilter !== 'unavailable' || winnerMissing.winnerChecks.priceAbove1 !== null || !winnerMissing.missingEvidence.includes('winner-filter:adrAtLeast4_5')) {
    fail(`setup-profile: TradingView winner evidence must fail closed on missing fields, got ${JSON.stringify(winnerMissing)}`);
  }

  const climax = deriveScreenerSetupProfile({
    observedAt: '2026-08-09', rank: 90, ret1m: 10, ret3m: 20,
    pctSma50: 20, pctSma200: 72, rsi: 76,
  });
  if (climax.climaxRisk !== 'watch' || climax.stretch200 !== true || climax.label !== '클라이맥스 관찰') {
    fail(`setup-profile: 200SMA stretch/climax label drifted, got ${JSON.stringify(climax)}`);
  }

  const empty = deriveScreenerSetupProfile({});
  if (empty.status !== 'unavailable' || empty.label !== '관찰' || empty.relativeStrengthPullback !== 'unavailable') {
    fail(`setup-profile: empty row must remain unavailable, got ${JSON.stringify(empty)}`);
  }

}

// ── data/providers/entity.js ─────────────────────────────────────────────────────────────────
{
  const { createEntityProvider } = await load('src/data/providers/entity.js');
  let requests = 0;
  const provider = createEntityProvider({
    read: () => ({ id: 'AAPL' }),
    fundamentalWatchlist: ['MSFT', 'MISSING'],
    httpClient: {
      requestJson: async () => {
        requests += 1;
        if (requests === 1) return { ok: false, error: 'HTTP_ABORTED' };
        return {
          ok: true,
          data: {
            generatedAt: '2026-07-28T10:00:00Z',
            source: 'SEC EDGAR companyfacts',
            model: 'sec-fy-normalized-v2',
            data: {
              AAPL: { symbol: 'AAPL', observedAt: '2026-07-28', revenue: 100 },
              MSFT: { symbol: 'MSFT', observedAt: '2026-06-30', revenue: 200 }
            }
          }
        };
      }
    },
    now: () => Date.parse('2026-07-28T12:00:00Z')
  });
  const failed = await provider.readCurrent();
  const retried = await provider.readCurrent();
  if (failed.fundamentals !== null || requests !== 2 || retried.fundamentals?.revenue !== 100) {
    fail(`entity provider: transient empty response was cached instead of retried: ${JSON.stringify({ requests, failed: failed.fundamentals, retried: retried.fundamentals })}`);
  }
  if (retried.fundamentalsWatchlist?.length !== 1 || retried.fundamentalsWatchlist[0]?.symbol !== 'MSFT'
    || retried.fundamentalsMeta?.model !== 'sec-fy-normalized-v2') {
    fail(`entity provider: bounded SEC watchlist projection or metadata drifted: ${JSON.stringify({ rows: retried.fundamentalsWatchlist, meta: retried.fundamentalsMeta })}`);
  }
}

// ── router.js (route-dynamic-import lifecycle) ──────────────────────────────────────────────
{
  const makeNode = () => {
    let errorMarker = null;
    return {
      dataset: {},
      querySelector: (selector) => selector === '[data-aio-route-module-error]' ? errorMarker : null,
      prepend: (node) => { errorMarker = node; }
    };
  };
  const nodes = { guide: makeNode(), masters: makeNode(), signal: makeNode() };
  const documentRef = {
    getElementById: (id) => nodes[id.replace('page-', '')] || null,
    createElement: () => ({
      dataset: {},
      className: '',
      textContent: '',
      setAttribute() {},
      remove() {}
    })
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  let resolveGuide;
  let guideLoads = 0;
  let guideMounts = 0;
  let guideDisposes = 0;
  const guide = createLazyPage({
    route: 'guide',
    loader: () => {
      guideLoads += 1;
      return new Promise((resolve) => { resolveGuide = resolve; });
    },
    factory: (module) => module.createGuidePage()
  });
  let mastersLoads = 0;
  let mastersMounts = 0;
  const masters = createLazyPage({
    route: 'masters',
    loader: async () => {
      mastersLoads += 1;
      if (mastersLoads === 1) throw new Error('fixture-load-failure');
      return { createMastersPage: () => ({ mount: () => { mastersMounts += 1; } }) };
    },
    factory: (module) => module.createMastersPage()
  });
  const target = new EventTarget();
  const registry = createRouteRegistry({ modules: {
    guide,
    masters,
    signal: { mount: () => () => {} }
  } });
  const router = createLifecycleRouter({ root: target, registry, context: { documentRef } });

  router.transition('guide');
  await Promise.resolve();
  router.transition('signal');
  resolveGuide({ createGuidePage: () => ({
    mount: () => { guideMounts += 1; return () => { guideDisposes += 1; }; }
  }) });
  await flush();
  if (guideMounts !== 0) fail('lazy-router: a module resolved after route disposal mounted stale UI');
  router.transition('guide');
  await flush();
  if (guideLoads !== 1 || guideMounts !== 1 || nodes.guide.dataset.aioRouteModuleState !== 'ready') fail('lazy-router: successful module was not cached and mounted on re-entry');
  router.transition('signal');
  if (guideDisposes !== 1) fail('lazy-router: loaded page disposer was not owned by the route scope');

  router.transition('masters');
  await flush();
  if (mastersLoads !== 1 || nodes.masters.dataset.aioRouteModuleState !== 'failed') fail('lazy-router: load failure did not expose a fail-closed route state');
  router.transition('signal');
  router.transition('masters');
  await flush();
  if (mastersLoads !== 2 || mastersMounts !== 1 || nodes.masters.dataset.aioRouteModuleState !== 'ready') fail('lazy-router: failed dynamic import was not retryable on route re-entry');
  router.dispose();
}

  const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
  const empty = derivePortfolioSurface({ state: { status: 'unavailable', holdings: [], cash: null }, liveData: {}, vix: null });
  if (empty.status !== 'unavailable' || empty.dailyChange !== null || empty.exposureCap !== null || empty.sectorBreakdown.length !== 0) fail(`portfolio-surface: empty input must remain unavailable, got ${JSON.stringify(empty)}`);
  const live = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10, sector: 'Technology' }], cash: 50 }, liveData: { ABC: { price: 12, pct: 2 } }, vix: 22 });
  if (live.modelVersion !== 'portfolio-surface.v1' || live.positionValue !== 24 || live.totalAssets !== 74 || live.totalPnl !== 4 || live.exposureCap !== 50 || live.sectorBreakdown.length !== 2) fail(`portfolio-surface: live/cash derivation drifted, got ${JSON.stringify(live)}`);
  const partial = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10 }, { symbol: 'XYZ', shares: 1, avgCost: 20 }], cash: null }, liveData: { ABC: { price: 12, pct: 2 } }, vix: 22 });
  if (partial.positionValue !== null || partial.totalPnl !== null || partial.dailyChange !== null || partial.sectorBreakdown.length !== 0) fail(`portfolio-surface: partial holdings must not sum unknown rows as zero, got ${JSON.stringify(partial)}`);
  const invalidPortfolio = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'BAD', shares: -2, avgCost: -10 }], cash: -5 }, liveData: { BAD: { price: 12 } }, vix: -1 });
  if (invalidPortfolio.positionValue !== null || invalidPortfolio.cash !== null || invalidPortfolio.exposureCap !== null || invalidPortfolio.exposurePolicyStatus !== 'reference-only') fail(`portfolio-surface: invalid balances or VIX entered the portfolio projection, got ${JSON.stringify(invalidPortfolio)}`);
}
{
  const { deriveSecReport } = await load('src/domain/fundamental/sec-report.js');
  const report = deriveSecReport({ symbol: 'AAPL', entityName: 'Apple', form: '10-K', coverage: ['revenue', 'margin', 'pe'], revenue: 100, margin: 25, pe: 30, sourceTier: 'official-regulator' });
  if (report.modelVersion !== 'sec-report.v3' || report.status !== 'current' || report.metrics.length !== 3 || report.sourceKind !== 'official-regulator' || report.freshness.state !== 'unknown' || report.decisionEligible !== false || report.pointInTime.status !== 'unavailable') fail(`sec-report: complete official record drifted, got ${JSON.stringify(report)}`);
  const producerAnomaly = deriveSecReport({ symbol: 'AAPL', coverage: ['revenue', 'unknown'], revenue: 100, anomaly: true, anomalies: [] });
  if (producerAnomaly.status !== 'quarantined' || !producerAnomaly.anomalies.includes('producer-flagged-anomaly') || producerAnomaly.coverage.includes('unknown')) fail(`sec-report: producer anomaly or unknown coverage escaped quarantine, got ${JSON.stringify(producerAnomaly)}`);
  const pitReport = deriveSecReport({ symbol: 'AAPL', form: '10-K/A', acceptedAt: '2026-08-01T20:30:00Z', coverage: ['revenue'], revenue: 100, pit: { status: 'accepted-time', observationCount: 4, acceptedTimeCount: 4 } });
  if (pitReport.pointInTime.status !== 'accepted-time' || pitReport.pointInTime.observationCount !== 4 || pitReport.pointInTime.acceptedTimeCount !== 4 || pitReport.filingMetadata.acceptedAt !== '2026-08-01T20:30:00Z') fail(`sec-report: PIT metadata contract drifted, got ${JSON.stringify(pitReport)}`);
  const missing = deriveSecReport({ coverage: ['revenue'], revenue: null });
  if (missing.status !== 'unavailable' || missing.metrics.length !== 0) fail(`sec-report: null fact must remain unavailable, got ${JSON.stringify(missing)}`);
  const recent = deriveSecReport({ symbol: 'NVDA', coverage: ['revenue'], revenue: 10, observedAt: new Date().toISOString(), allowedUse: 'decision' });
  if (recent.freshness.state !== 'current' || recent.decisionEligible !== true) fail(`sec-report: current filing freshness drifted, got ${JSON.stringify(recent)}`);
  const old = deriveSecReport({ symbol: 'NVDA', coverage: ['revenue'], revenue: 10, observedAt: '2022-01-01', allowedUse: 'decision' });
  if (old.freshness.state !== 'historical' || old.freshness.ageDays == null || old.decisionEligible !== false) fail(`sec-report: historical filing must fail closed, got ${JSON.stringify(old)}`);
}
{
  const { selectAiInferenceProxies } = await load('src/domain/ai/inference-efficiency.js');
  const proxies = selectAiInferenceProxies({ NVDA: { pct: 2.5, provider: 'unstamped-provider', observedAt: '2026-08-31' } });
  if (!Object.isFrozen(proxies) || !Object.isFrozen(proxies[0]) || proxies[0].sourceKind !== 'REFERENCE' || proxies[0].observedAt !== '2026-08-31') fail(`ai-inference: an unstamped provider was promoted to LIVE or projection stayed mutable, got ${JSON.stringify(proxies[0])}`);
}

// ── bootstrap.js (stop cancels late startup publication) ─────────────────────────────────────
{
  const { createAIOArchitecture } = await load('src/app/bootstrap.js');
  const runtimeRoot = new EventTarget();
  const timers = new Map();
  let nextTimer = 0;
  let resolveFetch;
  runtimeRoot.setTimeout = (task, delay) => {
    const id = ++nextTimer;
    timers.set(id, { task, delay });
    return id;
  };
  runtimeRoot.clearTimeout = (id) => timers.delete(id);
  runtimeRoot.location = { hash: '#home' };
  runtimeRoot.document = runtimeRoot;
  runtimeRoot.visibilityState = 'visible';
  runtimeRoot.getElementById = () => null;
  runtimeRoot.querySelector = () => null;
  runtimeRoot.querySelectorAll = () => [];
  const fetchImpl = () => new Promise((resolve) => { resolveFetch = resolve; });
  const architecture = createAIOArchitecture({ runtimeRoot, root: runtimeRoot, documentRef: runtimeRoot, now: () => Date.parse('2026-09-01T00:00:00Z'), fetchImpl });
  let lateSnapshotEvents = 0;
  runtimeRoot.addEventListener('aio:marketSnapshot', () => { lateSnapshotEvents += 1; });
  const stop = architecture.start();
  const beforeStop = architecture.getState().marketSnapshot;
  stop();
  stop();
  await Promise.resolve();
  resolveFetch({ ok: true, status: 200, json: async () => ({ schemaVersion: 'market-snapshot.v1', status: 'published', revision: 'late-fixture', generatedAt: '2026-09-01T00:00:00Z', quotes: [] }) });
  await stop.ready;
  await Promise.resolve();
  for (const { task } of [...timers.values()]) task();
  await Promise.resolve();
  if (architecture.getState().marketSnapshot !== beforeStop || lateSnapshotEvents !== 0 || timers.size !== 0) {
    fail(`bootstrap: stop allowed late startup publication: ${JSON.stringify({ lateSnapshotEvents, pendingTimers: timers.size })}`);
  }
}

console.log(JSON.stringify({ ok: true, modules: ['store', 'lifecycle', 'router', 'evidence-store', 'compatibility-facade', 'orchestrators/screener', 'orchestrators/entity', 'domain/market/breadth', 'domain/technical/stage:deriveTechnicalStageFromOhlcv', 'domain/screener/factor-ranks:computeFactorRanks', 'domain/screener/setup-profile:deriveScreenerSetupProfile', 'domain/portfolio/surface', 'domain/fundamental/sec-report', 'bootstrap:stop-lifecycle'] }));
