import path from 'node:path';
import { readFileSync } from 'node:fs';
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
const { createCompatibilityEventAdapter, resolveInitialRoute } = await load('src/app/bootstrap.js');
const { getVerticalSliceContract, auditVerticalSliceContracts } = await load('src/app/vertical-slices.js');
const { createResourceBag, createDeferredTaskQueue, coalesceMicrotask, createChartRegistry } = await load('src/app/lifecycle.js');
const { createEvidenceStore } = await load('src/data/evidence-store.js');
const { createLegacyFacade, exposeArchitecture } = await load('src/legacy/compatibility-facade.js');
const { createKnowledgeCapabilityBatchLoader } = await load('src/ui/knowledge/capability-loader.js');
const { renderSentimentSummaryProjection } = await load('src/ui/projections/sentiment-summary.js');
const { TICKER_CHART_RANGES, selectTickerChartWindow } = await load('src/ui/pages/entity.js');

// P1205/LC-18/LC-27: ticker range controls are one native calendar-window contract.
{
  const end = Date.parse('2026-09-24T00:00:00Z');
  const history = [400, 365, 180, 90, 30, 1].map((daysAgo) => ({
    time: new Date(end - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    close: 400 - daysAgo
  }));
  const expected = { '1m': 2, '3m': 3, '6m': 4, '1y': 5 };
  for (const [range, count] of Object.entries(expected)) {
    const view = selectTickerChartWindow(history, range);
    if (view.range !== range || view.rowCount !== count || view.days !== TICKER_CHART_RANGES[range].days) {
      fail(`ticker chart ${range}: expected ${count} rows/${TICKER_CHART_RANGES[range].days}d, got ${view.rowCount}/${view.days}d`);
    }
  }
  if (selectTickerChartWindow([], '6m').rowCount !== 0) fail('ticker chart unavailable range fabricated rows');
}

// RM-07: cross-route sentiment summary projection must not mutate unchanged
// text sinks on an unrelated/empty sentiment update.
{
  const nodes = new Map(['fg-score-big', 'fg-score-val', 'fg-rating-text', 'vix-term-regime-text'].map((id) => {
    const node = { writes: 0, _text: '' };
    Object.defineProperty(node, 'textContent', {
      get() { return node._text; },
      set(value) { node.writes += 1; node._text = value; }
    });
    return [id, node];
  }));
  const documentRef = { getElementById: (id) => nodes.get(id) || null };
  const summary = { fearGreed: { score: 42, label: '공포' }, vixTermStructure: { regime: '정상' } };
  renderSentimentSummaryProjection(documentRef, summary);
  const firstWrites = [...nodes.values()].reduce((sum, node) => sum + node.writes, 0);
  renderSentimentSummaryProjection(documentRef, summary);
  const secondWrites = [...nodes.values()].reduce((sum, node) => sum + node.writes, 0);
  if (firstWrites !== 4 || secondWrites !== firstWrites) fail(`sentiment projection: unchanged summary still mutated text sinks (${firstWrites} -> ${secondWrites})`);
}

// RM-06: legacy refresh/history producers have used both window and document
// as their event target. Native consumers must see either target exactly once,
// while two real events from the same target remain distinct.
{
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  let now = 1_000;
  let calls = 0;
  let historyCalls = 0;
  const adapter = createCompatibilityEventAdapter({ root: windowTarget, eventTarget: documentTarget, now: () => now });
  const stop = adapter.on('aio:refresh:done', () => { calls += 1; });
  const stopHistory = adapter.on('aio:historyLoaded', () => { historyCalls += 1; });
  windowTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'same-cycle' } }));
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { generatedAt: 'same-cycle', type: 'done' } }));
  if (calls !== 1) fail(`compatibility event adapter: mirrored window/document event was delivered ${calls} times`);
  windowTarget.dispatchEvent(new CustomEvent('aio:historyLoaded', { detail: { source: 'history.json', loadedAt: 'same-history-cycle' } }));
  documentTarget.dispatchEvent(new CustomEvent('aio:historyLoaded', { detail: { loadedAt: 'same-history-cycle', source: 'history.json' } }));
  if (historyCalls !== 1) fail(`compatibility event adapter: mirrored history event was delivered ${historyCalls} times`);
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'second-cycle' } }));
  windowTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { generatedAt: 'second-cycle', type: 'done' } }));
  if (calls !== 2) fail(`compatibility event adapter: document/window reverse order was delivered ${calls} times`);
  windowTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'same-target-repeat' } }));
  windowTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'same-target-repeat' } }));
  if (calls !== 4) fail(`compatibility event adapter: same-target events were incorrectly deduplicated (${calls})`);
  windowTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', payload: { revision: 'one' } } }));
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', payload: { revision: 'two' } } }));
  if (calls !== 6) fail(`compatibility event adapter: distinct nested details were incorrectly deduplicated (${calls})`);
  now += 251;
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'same-cycle' } }));
  if (calls !== 7) fail(`compatibility event adapter: expired dedupe record blocked a new event (${calls})`);
  stop();
  stopHistory();
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'after-stop' } }));
  if (calls !== 7) fail('compatibility event adapter: disposed subscription still received events');
  adapter.dispose();

  const routeRoot = {
    location: { hash: '#theme-detail?knowledgeNode=theme-7' },
    AIO_ROUTE_REGISTRY: { canonical: { 'theme-detail': 'themes' } },
    _currentThemeId: 'theme-7'
  };
  if (resolveInitialRoute({ root: routeRoot }) !== 'themes' || routeRoot._aioOpenThemeDetailOnThemes !== 'theme-7') {
    fail('initial route: theme-detail was not canonicalized with the selected theme identity');
  }
  routeRoot._aioOpenThemeDetailOnThemes = 'theme-9';
  if (resolveInitialRoute({ root: routeRoot }) !== 'themes' || routeRoot._aioOpenThemeDetailOnThemes !== 'theme-9') {
    fail('initial route: existing pending theme identity was overwritten');
  }
}

{
  const { createScreenerOrchestrator } = await load('src/data/orchestrators/screener.js');
  let published = false;
  const orchestrator = createScreenerOrchestrator({
    provider: { readCurrent: async () => { throw new DOMException('cancelled while yielding', 'AbortError'); } },
    commands: { setData: () => { published = true; } }
  });
  if (await orchestrator.sync() !== null || published) fail('screener cancellation: partial state published or abort escaped');
}

// ── shared knowledge capability loader ────────────────────────────────────────────────────────
{
  const state = { first: null, firstError: false, second: null, secondError: false };
  const dataset = {};
  let releaseFirst;
  let firstCalls = 0;
  let secondSucceeds = false;
  const firstReady = new Promise((resolve) => { releaseFirst = resolve; });
  const loader = createKnowledgeCapabilityBatchLoader({
    fetchFn: async () => null,
    state,
    dataset,
    datasetMap: { first: 'firstState', second: 'secondState' },
    validators: { second: (value) => value?.valid === true },
    loadCapabilities: async (_fetchFn, definitions) => {
      const results = {};
      for (const definition of definitions) {
        if (definition.key === 'first') {
          firstCalls += 1;
          await firstReady;
          results.first = { status: 'connected', value: { id: 'first' } };
        } else {
          const value = { valid: secondSucceeds };
          results.second = definition.validate?.(value)
            ? { status: 'connected', value }
            : { status: 'fallback', value: null };
        }
      }
      return results;
    }
  });
  const firstLoad = loader.load([{ key: 'first', url: '/first.json' }]);
  const duplicateLoad = loader.load([{ key: 'first', url: '/first.json' }]);
  releaseFirst();
  if (!await firstLoad || await duplicateLoad !== false || firstCalls !== 1 || state.first?.id !== 'first' || dataset.firstState !== 'connected') {
    fail('knowledge capability loader: overlapping group loads were not deduplicated');
  }
  if (!await loader.load([{ key: 'second', url: '/second.json' }]) || !state.secondError || dataset.secondState !== 'fallback') {
    fail('knowledge capability loader: partial failure state was not applied');
  }
  secondSucceeds = true;
  if (!await loader.load([{ key: 'second', url: '/second.json' }]) || state.secondError || state.second?.valid !== true || dataset.secondState !== 'connected') {
    fail('knowledge capability loader: failed capability could not be retried');
  }

  const disposedState = { late: null, lateError: false };
  let active = true;
  let releaseLate;
  const lateReady = new Promise((resolve) => { releaseLate = resolve; });
  const disposedLoader = createKnowledgeCapabilityBatchLoader({
    fetchFn: async () => null,
    state: disposedState,
    isActive: () => active,
    loadCapabilities: async () => { await lateReady; return { late: { status: 'connected', value: 1 } }; }
  });
  const lateLoad = disposedLoader.load([{ key: 'late', url: '/late.json' }]);
  active = false;
  releaseLate();
  if (await lateLoad !== false || disposedState.late !== null || disposedLoader.isLoading('late')) {
    fail('knowledge capability loader: disposed page accepted a late result or retained pending state');
  }
}

// P1039: repeated canonical reads reuse a defensive frozen copy; new store
// references refresh it, while non-canonical/time-dependent reads stay fresh.
{
  let native = { rows: [{ symbol: 'AAA', value: 1 }] };
  let observation = 1;
  const root = {};
  exposeArchitecture(root, { getScreenerState: () => native, getRuntimeObservationCatalog: () => ({ value: observation }) }, { immutableState: true });
  const first = root.AIO_ARCH.getScreenerState();
  if (first === native || first.rows === native.rows || !Object.isFrozen(first.rows[0])) fail('facade cache: snapshot isolation lost');
  if (root.AIO_ARCH.getScreenerState() !== first) fail('facade cache: unchanged native state recloned');
  try { first.rows[0].value = 99; } catch (_) {}
  if (native.rows[0].value !== 1) fail('facade cache: consumer mutated native input');
  native = { rows: [{ symbol: 'BBB', value: 2 }] };
  const second = root.AIO_ARCH.getScreenerState();
  if (second === first || second.rows[0].value !== 2 || first.rows[0].value !== 1) fail('facade cache: replacement or old snapshot changed');
  root.AIO_ARCH.getRuntimeObservationCatalog(); observation++;
  if (root.AIO_ARCH.getRuntimeObservationCatalog().value !== 2) fail('facade cache: temporal observation cached');
  const legacyRoot = {};
  exposeArchitecture(legacyRoot, { getState: () => native });
  legacyRoot.AIO_ARCH.getState(); native.rows[0].value = 3;
  if (legacyRoot.AIO_ARCH.getState().rows[0].value !== 3) fail('facade cache: non-canonical mutable input cached');
}

// P1035: unrelated writes must not rebuild a mounted page; every dependency and
// disposal still has to work, including a single action replacing two slices.
{
  const { subscribeToSlices } = await load('src/state/memoize.js');
  const store = createStore({ initialState: { news: {}, entity: {}, portfolio: {} }, reducer: (state, action) => ({ ...state, ...action.payload }) });
  let calls = 0;
  const stop = subscribeToSlices(store, ['entity', 'portfolio'], () => calls++);
  store.dispatch({ type: 'news', payload: { news: {} } });
  if (calls !== 0) fail('slice subscription: unrelated update rendered');
  store.dispatch({ type: 'entity', payload: { entity: {} } });
  store.dispatch({ type: 'portfolio', payload: { portfolio: {} } });
  store.dispatch({ type: 'both', payload: { entity: {}, portfolio: {} } });
  if (calls !== 3) fail('slice subscription: dependency update missed or duplicated');
  store.dispatch({ type: 'same', payload: { entity: store.getState().entity } });
  if (calls !== 3) fail('slice subscription: identical reference rendered');
  stop();
  store.dispatch({ type: 'disposed', payload: { entity: {} } });
  if (calls !== 3) fail('slice subscription: rendered after disposal');
}

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

  const mutableChild = { value: 1 };
  const preFrozenOuter = Object.freeze({ mutableChild });
  const devStore = createStore({ initialState: preFrozenOuter, reducer: state => state, devMode: true });
  if (!Object.isFrozen(devStore.getState().mutableChild)) fail('store: devMode skipped a mutable child inside a pre-frozen outer object');
  try { devStore.getState().mutableChild.value = 2; } catch (_) {}
  if (mutableChild.value !== 1) fail('store: devMode allowed nested mutation through a pre-frozen outer object');

  const listenerStore = createStore({ initialState: { count: 0 }, reducer });
  const listenerOrder = [];
  listenerStore.subscribe(() => { listenerOrder.push('throws'); throw new Error('fixture-listener-failure'); });
  listenerStore.subscribe(() => listenerOrder.push('continues'));
  let listenerFailure = null;
  try { listenerStore.dispatch({ type: 'inc' }); } catch (error) { listenerFailure = error; }
  if (!(listenerFailure instanceof AggregateError) || listenerFailure.message !== 'STORE_LISTENER_FAILED') fail('store: listener errors were not reported after notification');
  if (listenerOrder.join(',') !== 'throws,continues' || listenerStore.getState().count !== 1) fail('store: one failing listener blocked later notifications or state commit');
}

// ── domain/screener/factor-weights.js ─────────────────────────────────────────────────────────
{
  const { deriveFactorWeights } = await load('src/domain/screener/factor-weights.js');
  const neutral = deriveFactorWeights();
  if (neutral.weights.momentum !== 0.27 || neutral.weights.lowvol !== 0.16 || neutral.regimeLabel !== '중립 → 균형 가중' || neutral.adaptiveApplied) fail(`factor-weights: neutral drifted, got ${JSON.stringify(neutral)}`);
  const defensive = deriveFactorWeights({ marketState: { riskScore: 65 } });
  if (JSON.stringify(defensive.weights) !== JSON.stringify(neutral.weights) || defensive.proposedWeights.lowvol <= neutral.weights.lowvol || defensive.proposedWeights.momentum >= neutral.weights.momentum || !defensive.regimeLabel.includes('미검증 후보') || defensive.adaptiveApplied) fail(`factor-weights: unvalidated risk-off proposal changed production weights or lost diagnostics, got ${JSON.stringify(defensive)}`);
  const promoted = deriveFactorWeights({ marketState: { riskScore: 65 }, promotion: { status: 'PROMOTED', liveBacktestParity: true, reviewApproved: true } });
  if (!promoted.adaptiveApplied || promoted.weights.lowvol <= neutral.weights.lowvol || promoted.source !== 'reviewed-adaptive-promotion') fail(`factor-weights: explicitly reviewed promotion did not activate the proposal, got ${JSON.stringify(promoted)}`);
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
  if (JSON.stringify(ko.proposedWeights) !== JSON.stringify(en.proposedWeights) || ko.proposedWeights.lowvol !== 0.28 || ko.weights.lowvol !== 0.16) fail('factor-weights: equivalent Korean/English regime proposals diverged or bypassed promotion');
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

// ── W00/P1143: typed navigation — DOM elements never become entity ids ─────
// A sidebar click passes a DOM node via data-pass-el; the typed command must
// reject it to null instead of mounting a scope keyed by "[OBJECT HTMLDIVELEMENT]".
{
  const { createLifecycleRouter, createRouteRegistry, normalizeNavigationCommand } = await load('src/app/router.js');
  if (normalizeNavigationCommand({ routeId: 'ticker', args: [{}] })?.entityId !== null) fail('W00/P1143 navigation: a DOM-like arg became an entity id');
  if (normalizeNavigationCommand({ routeId: 'ticker', entityId: 'aapl' })?.entityId !== 'AAPL') fail('W00/P1143 navigation: explicit string identity was not normalized');
  if (normalizeNavigationCommand({ routeId: 'theme-detail' })?.routeId !== 'themes') fail('W00/P1143 navigation: theme-detail was not canonicalized to themes');
  if (normalizeNavigationCommand({ routeId: 'not-a-real-route' }) !== null) fail('W00/P1143 navigation: unknown route was accepted');
  const mounts = [];
  const registry = createRouteRegistry({ modules: { fundamental: { route: 'fundamental', mount: ({ scope }) => { mounts.push(scope); return () => {}; } } } });
  const target = new EventTarget();
  const router = createLifecycleRouter({ root: target, registry, context: {} });
  const handle = router.start();
  handle.transition('fundamental', { source: 'architecture-navigation', entityId: null });
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: { pageId: 'fundamental', args: [target] } }));
  if (mounts.length !== 1 || mounts[0]?.entityId !== null) fail(`W00/P1143 navigation: one click must commit one scope without DOM identity, got mounts=${mounts.length}, entityId=${mounts[0]?.entityId}`);
  handle.dispose();
}

// ── W00/P1143: one click = one commit; a scalar pageShown detail is not an entity ──
// The pre-fix path transitioned twice per click (aio:pageShown replay + facade call),
// gave the scalar page id entityId='FUNDAMENTAL', and left store.route on the previous
// route. This fixture binds the real order: legacy showPage fires aio:pageShown, then
// the typed facade commits, and only aio:navigationCommitted reports the result.
{
  const { createLifecycleRouter, createRouteRegistry } = await load('src/app/router.js');
  const buildRegistry = (mounts) => createRouteRegistry({ modules: {
    home: { route: 'home', mount: () => { mounts.push('home'); return () => {}; } },
    fundamental: { route: 'fundamental', mount: ({ scope }) => { mounts.push(`fundamental:${scope.entityId}`); return () => {}; } }
  } });

  // Event-only mode (hosts without a writable showPage global): the scalar detail is the
  // page id, so no scope may be keyed by it.
  {
    const mounts = [];
    const target = new EventTarget();
    const router = createLifecycleRouter({ root: target, registry: buildRegistry(mounts), context: {} });
    router.start();
    target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'fundamental' }));
    if (router.active() !== 'fundamental') fail('W00/P1143 navigation: event-mode pageShown did not commit the route');
    if (router.activeScope()?.entityId !== null) fail(`W00/P1143 navigation: scalar pageShown detail became entity id ${router.activeScope()?.entityId}`);
    if (mounts.join(',') !== 'fundamental:null') fail(`W00/P1143 navigation: event-mode scalar detail mounted unexpected scopes: ${mounts.join(',')}`);
    router.dispose();
  }

  // Facade-authority mode: a single click must produce exactly one mount and one commit.
  {
    const mounts = [];
    const committed = [];
    const target = new EventTarget();
    const router = createLifecycleRouter({ root: target, registry: buildRegistry(mounts), context: {} });
    target.addEventListener('aio:navigationCommitted', (event) => committed.push(event.detail));
    const handle = router.start();
    handle.transition('home', { source: 'initial-load' });
    handle.claimNavigationAuthority();
    const click = (pageId, ...args) => {
      target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: pageId }));
      const explicitEntity = args.find((arg) => typeof arg === 'string' && arg.trim()) || null;
      handle.transition(pageId, { source: 'architecture-navigation', entityId: explicitEntity });
    };
    click('fundamental', target);
    const expected = mounts.filter((entry) => entry.startsWith('fundamental'));
    if (expected.length !== 1) fail(`W00/P1143 navigation: one click mounted ${expected.length} scopes (${mounts.join(',')})`);
    if (router.active() !== 'fundamental') fail('W00/P1143 navigation: facade click did not commit the route');
    if (router.activeScope()?.entityId !== null) fail('W00/P1143 navigation: a DOM nav element became the scope entity id');
    const last = committed[committed.length - 1];
    if (last?.routeId !== 'fundamental' || last?.mountId !== 2 || last?.source !== 'architecture-navigation') fail(`W00/P1143 navigation: commit result did not report the single committed route: ${JSON.stringify(last)}`);
    handle.dispose();
  }
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
  if (router.start() !== started) fail('router: repeated start must return the existing handle without adding another pageShown listener');
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
  const newer = store.ingest({ metric: 'revisionOrder', value: 2, unit: 'score', sourceKind: 'T3_PUBLIC_DELAYED', observedAt: '2026-07-20T00:00:00Z', fetchedAt: '2026-07-20T00:01:00Z', revisionId: 'new', status: 'reference' });
  const retained = store.ingest({ metric: 'revisionOrder', value: 1, unit: 'score', sourceKind: 'T1_OFFICIAL', observedAt: '2026-07-19T00:00:00Z', fetchedAt: '2026-07-21T00:01:00Z', revisionId: 'late-old', status: 'reference' });
  if (retained !== newer || store.get('revisionOrder').value !== 2) fail('evidence-store: a late older observation replaced a newer revision');
  store.ingest({ metric: 'revisionOrder', value: null, unit: 'score', sourceKind: 'T1_OFFICIAL', observedAt: null, fetchedAt: '2026-07-22T00:00:00Z', revisionId: 'rights-revoked', rightsId: 'REVOKED', status: 'missing', allowedUse: 'none', allowedUseCeiling: 'none' });
  if (store.get('revisionOrder').rightsId !== 'REVOKED' || store.get('revisionOrder').allowedUse !== 'none') fail('evidence-store: an explicit rights revocation did not fail closed');
  const official = store.ingest({ metric: 'sourcePriority', value: 10, unit: 'score', sourceKind: 'T1_OFFICIAL', observedAt: '2026-07-20T00:00:00Z', fetchedAt: '2026-07-20T00:00:01Z', revisionId: 'official', status: 'reference' });
  const lowerPriority = store.ingest({ metric: 'sourcePriority', value: 11, unit: 'score', sourceKind: 'T3_PUBLIC_DELAYED', observedAt: '2026-07-20T00:00:00Z', fetchedAt: '2026-07-21T00:00:01Z', revisionId: 'public-later-fetch', status: 'reference' });
  if (lowerPriority !== official || store.get('sourcePriority').value !== 10) fail('evidence-store: a lower-authority source replaced an equal-epoch official observation');
  const sameEpochValid = store.ingest({ metric: 'rightsChronology', value: 10, unit: 'score', sourceKind: 'T1_OFFICIAL', observedAt: '2026-07-20T00:00:00Z', fetchedAt: '2026-07-20T00:02:00Z', revisionId: 'rights-valid', status: 'reference', rightsId: 'VERIFIED' });
  const oldBlock = store.ingest({ metric: 'rightsChronology', value: null, unit: 'score', sourceKind: 'T1_OFFICIAL', observedAt: '2026-07-20T00:00:00Z', fetchedAt: '2026-07-20T00:01:00Z', revisionId: 'rights-old-block', rightsId: 'REVOKED', allowedUse: 'none', allowedUseCeiling: 'none', status: 'missing' });
  if (oldBlock !== sameEpochValid || store.get('rightsChronology')?.value !== 10) fail('evidence-store: an older same-observation rights block overwrote newer valid evidence');
  const newBlock = store.ingest({ metric: 'rightsChronology', value: null, unit: 'score', sourceKind: 'T1_OFFICIAL', observedAt: '2026-07-20T00:00:00Z', fetchedAt: '2026-07-20T00:03:00Z', revisionId: 'rights-new-block', rightsId: 'REVOKED', allowedUse: 'none', allowedUseCeiling: 'none', status: 'missing' });
  if (newBlock?.rightsId !== 'REVOKED' || store.get('rightsChronology')?.value !== null) fail('evidence-store: a newer same-observation rights block did not replace valid evidence');
  const metadataInput = { nested: { value: 1 } };
  const metadataEvidence = store.ingest({ metric: 'immutableMetadata', value: 1, unit: 'score', sourceKind: 'T4_REFERENCE', observedAt: '2026-07-20T00:00:00Z', revisionId: 'immutable', status: 'reference', metadata: metadataInput });
  metadataInput.nested.value = 2;
  if (metadataEvidence.metadata.nested.value !== 1 || !Object.isFrozen(metadataEvidence.metadata.nested) || !Object.isFrozen(store.snapshot())) fail('evidence-store: nested metadata or snapshot projection remained mutable');
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
  const decisionObservedAt = new Date(Date.now() - 60 * 1000).toISOString();
  const evidence = {
    live: createEvidence({ metric: 'live', value: 1, status: 'live', sourceKind: 'T1_OFFICIAL', rightsId: 'VERIFIED', revisionId: 'live-revision', allowedUse: 'decision', allowedUseCeiling: 'decision', qualityStatus: 'CURRENT', quality: { status: 'CURRENT', stale: false }, freshnessMs: 4 * 86400000, observedAt: decisionObservedAt }),
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
  if (applyFreshness({ ...evidence.live, allowedUse: undefined }, { now: Date.parse('2026-07-19T00:01:00Z') }).allowedUse !== 'reference') fail('truth-boundary: omitted use manufactured a decision grant');
  const statusOnlyGrant = createEvidence({ metric: 'status-only', value: 9, status: 'live', observedAt: decisionObservedAt });
  const unknownAuthority = createEvidence({ metric: 'unknown-authority', value: 9, status: 'live', sourceKind: 'live', rightsId: 'VERIFIED', revisionId: 'r', allowedUse: 'decision', allowedUseCeiling: 'decision', qualityStatus: 'CURRENT', quality: { status: 'CURRENT' }, freshnessMs: 86400000, observedAt: decisionObservedAt });
  const expiredDecision = createEvidence({ metric: 'expired-decision', value: 9, status: 'live', sourceKind: 'T1_OFFICIAL', rightsId: 'VERIFIED', revisionId: 'r', allowedUse: 'decision', allowedUseCeiling: 'decision', qualityStatus: 'CURRENT', quality: { status: 'CURRENT' }, freshnessMs: 60 * 1000, observedAt: '2020-01-01T00:00:00Z' });
  if (statusOnlyGrant.allowedUse !== 'reference' || statusOnlyGrant.allowedUseCeiling !== 'reference' || selectForDecision(statusOnlyGrant) !== null || selectForDecision(unknownAuthority) !== null || selectForDecision(expiredDecision) !== null) fail('truth-boundary: status/freshness, unknown authority, or expired evidence manufactured a decision grant');
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
  const newsBypass = computeTradingScoreModel({ decisionEvidence: full, newsSentimentScore: 100, newsRiskSignals: [{ impact: 30 }] });
  if (newsBypass.total !== valid.total || newsBypass.newsAdjustmentApplied) fail(`truth-boundary: raw news heuristic bypassed decision evidence: ${JSON.stringify(newsBypass)}`);
  const newsReference = computeTradingScoreModel({ decisionEvidence: { ...full, newsSentimentScore: reference(100), newsRiskSignals: reference([{ impact: 30 }]) }, newsSentimentScore: 100, newsRiskSignals: [{ impact: 30 }] });
  if (newsReference.total !== valid.total || newsReference.newsAdjustmentApplied) fail(`truth-boundary: reference-only news heuristic changed a decision score: ${JSON.stringify(newsReference)}`);
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

{
  const { createSentimentProvider } = await load('src/data/providers/sentiment.js');
  const { createSentimentOrchestrator } = await load('src/data/orchestrators/sentiment.js');
  const { normalizeSentiment } = await load('src/data/normalize/sentiment.js');
  const skewObservation = { metricId: 'market.volatility.skew', instrumentId: '^SKEW', unit: 'index', value: 146.15, observedAt: '2026-09-24T12:00:00Z', fetchedAt: '2026-09-24T12:00:01Z', revisionId: 'quote-batch-skew', source: 'yahoo:^SKEW', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference', allowedUseCeiling: 'reference' };
  const normalizedSkew = normalizeSentiment({ skew: skewObservation }).skew;
  if (normalizedSkew.metricId !== skewObservation.metricId || normalizedSkew.instrumentId !== '^SKEW' || normalizedSkew.unit !== 'index' || normalizedSkew.value !== 146.15 || normalizedSkew.observedAt !== skewObservation.observedAt || normalizedSkew.revisionId !== skewObservation.revisionId) fail(`LC-20 SKEW identity drifted across native normalization: ${JSON.stringify(normalizedSkew)}`);
}
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
  // W08-A/P1147 (H01): an unavailable bar is null, not a fabricated neutral 50.
  if (unavailable.bars.spy !== null || unavailable.bars.trend !== null) fail(`market-health: unavailable dimensions must not publish fabricated neutral bars, got ${JSON.stringify(unavailable.bars)}`);
  if (bullish.status !== 'current' || (bullish.partialComponents || []).length !== 0) fail(`W08-A: fully observed components must read current, got ${JSON.stringify({ status: bullish.status, partial: bullish.partialComponents })}`);
  // The M7 denominator stays the full seven-name universe; a thin sample withholds leadership
  // instead of granting +8 "strong leadership" on a 1/1 sample.
  const thinLeadership = computeMarketHealth({ quotes: { SPY: { pct: 0 }, QQQ: { pct: 0 }, '^VIX': { price: 20 }, AAPL: { pct: 1 } }, spxMA: { 50: 500, 200: 450 } });
  if (thinLeadership.leadership.observed !== 1 || thinLeadership.leadership.expected !== 7 || thinLeadership.leadership.withheld !== true) fail(`W08-A: a 1/7 M7 sample must withhold leadership against the full denominator, got ${JSON.stringify(thinLeadership.leadership)}`);
  if (thinLeadership.status !== 'partial' || !thinLeadership.partialComponents.includes('m7-leadership')) fail(`W08-A: an insufficient M7 sample must mark the result partial, got ${JSON.stringify({ status: thinLeadership.status, partial: thinLeadership.partialComponents })}`);
  if (thinLeadership.score >= 50 + 8) fail(`W08-A: a withheld leadership sample must not raise the score, got ${thinLeadership.score}`);
  // A missing 50/200MA is an unavailable trend dimension, never a neutral 50 bar.
  const noTrend = computeMarketHealth({ quotes: { SPY: { pct: 0 }, QQQ: { pct: 0 }, '^VIX': { price: 20 } } });
  if (noTrend.bars.trend !== null || !noTrend.partialComponents.includes('spx-trend')) fail(`W08-A: a missing 50/200MA must be an unavailable trend bar, got ${JSON.stringify({ trend: noTrend.bars.trend, partial: noTrend.partialComponents })}`);
  const zeroMa = computeMarketHealth({ quotes: { SPY: { pct: 0, price: 100 }, QQQ: { pct: 0 }, '^VIX': { price: 20 } }, spxMA: { 50: 0, 200: 0 } });
  if (zeroMa.bars.trend !== null) fail('W08-A: a zero MA is missing evidence, not an observed trend');
  // A genuinely observed zero percentage stays observed (distinct from missing).
  const zeroPct = computeMarketHealth({ quotes: { SPY: { pct: 0 }, QQQ: { pct: 0 }, '^VIX': { price: 20 } } });
  if (zeroPct.bars.spy !== 50 || zeroPct.bars.qqq !== 50) fail(`W08-A: a valid 0% move must stay observed, got ${JSON.stringify({ spy: zeroPct.bars.spy, qqq: zeroPct.bars.qqq })}`);
}

// ── W08-B/P1147 (H02): the 2s10s spread names its two legs and their alignment ──────────────
{
  const { buildTreasuryCurveSpread, deriveTreasuryCurveEvidence } = await load('src/domain/macro/treasury-curve.js');
  const sameDay = buildTreasuryCurveSpread({
    twoY: 4.1, tenY: 4.3,
    legs: { twoY: { instrumentId: 'DGS2', cutId: 'curve-A', observedAt: '2026-09-18T00:00:00Z', provider: 'FRED' }, tenY: { instrumentId: 'DGS10', cutId: 'curve-A', observedAt: '2026-09-18T00:00:00Z', provider: 'U.S. Treasury' } }
  });
  if (sameDay.mode !== 'aligned-legs' || sameDay.spread !== 0.2 || sameDay.mixedDates !== false || sameDay.unit !== 'percentage-point' || sameDay.curveCutId !== 'curve-A') fail(`W08-B: same-cut legs must compute one %p spread, got ${JSON.stringify(sameDay)}`);
  if (sameDay.legs[0].instrumentId !== 'DGS2' || sameDay.legs[1].instrumentId !== 'DGS10' || sameDay.legs[0].unit !== 'percent') fail(`W08-B: each leg must keep its identity/unit, got ${JSON.stringify(sameDay.legs)}`);
  const official = buildTreasuryCurveSpread({ twoY: 4.1, tenY: 4.3, officialSpread: 0.18, officialSpreadMeta: { cutId: 'curve-B', observedAt: '2026-09-18T00:00:00Z', source: 'FRED' }, legs: { twoY: { cutId: 'curve-B', observedAt: '2026-09-18T00:00:00Z' }, tenY: { cutId: 'curve-B', observedAt: '2026-09-18T00:00:00Z' } } });
  if (official.mode !== 'official-same-date' || official.spread !== 0.18 || official.unit !== 'percentage-point') fail(`W08-B: a same-cut official %p spread must win, got ${JSON.stringify(official)}`);
  const mixed = buildTreasuryCurveSpread({
    twoY: 4.1, tenY: 4.3,
    legs: { twoY: { instrumentId: 'DGS2', cutId: 'curve-A', observedAt: '2026-09-15T00:00:00Z' }, tenY: { instrumentId: 'DGS10', cutId: 'curve-B', observedAt: '2026-09-18T20:00:00Z' } }
  });
  if (mixed.mode !== 'mixed-cut-reference' || mixed.mixedDates !== true || mixed.spread !== null || !mixed.label.includes('cut 불일치')) fail(`W08-B: differing cut IDs must block comparison, got ${JSON.stringify(mixed)}`);
  const mixedOfficial = buildTreasuryCurveSpread({ twoY: 4.1, tenY: 4.3, officialSpread: 0.18, officialSpreadMeta: { cutId: 'curve-A', observedAt: '2026-09-15T00:00:00Z' }, legs: { twoY: { cutId: 'curve-A', observedAt: '2026-09-15T00:00:00Z' }, tenY: { cutId: 'curve-B', observedAt: '2026-09-18T20:00:00Z' } } });
  if (mixedOfficial.mode !== 'mixed-cut-reference' || mixedOfficial.spread !== null || mixedOfficial.referenceSpread !== 0.18) fail(`W08-B: an official spread cannot override a conflicting 10Y cut, got ${JSON.stringify(mixedOfficial)}`);
  const unknownTime = buildTreasuryCurveSpread({ twoY: 4.1, tenY: 4.3, legs: {} });
  if (unknownTime.mode !== 'mixed-cut-reference' || unknownTime.spread !== null) fail(`W08-B: unknown cut identity must not compute a spread, got ${JSON.stringify(unknownTime)}`);
  const oneLeg = buildTreasuryCurveSpread({ twoY: 4.1, tenY: null, legs: {} });
  if (oneLeg.mode !== 'unavailable' || oneLeg.spread !== null) fail(`W08-B: a missing leg must withhold the spread, got ${JSON.stringify(oneLeg)}`);
  const inverted = buildTreasuryCurveSpread({ twoY: 4.4, tenY: 4.0, officialSpread: -0.4, officialSpreadMeta: { cutId: 'curve-C', observedAt: '2026-09-18T00:00:00Z' }, legs: { twoY: { cutId: 'curve-C', observedAt: '2026-09-18T00:00:00Z' }, tenY: { cutId: 'curve-C', observedAt: '2026-09-18T00:00:00Z' } } });
  if (inverted.spread !== -0.4 || inverted.mode !== 'official-same-date') fail(`W08-B: an inverted same-cut curve must keep its signed %p spread, got ${JSON.stringify(inverted)}`);
  const atomicCurve = deriveTreasuryCurveEvidence({ treasury: { observedAt: '2026-09-23', source: 'U.S. Treasury', values: { dgs2: 4.85, dgs10: 5.11, t10y2y: 0.26 } } });
  if (atomicCurve.spread2s10s !== 0.26 || atomicCurve.curve.curveCutId !== 'us-treasury-daily:2026-09-23' || atomicCurve.curve.unit !== 'percentage-point') fail(`W08-B: atomic Treasury cut must survive projection, got ${JSON.stringify(atomicCurve)}`);
}

// ── W09-C/P1148 (F03): one absolute-time formatting owner with a timezone ────────────────────
// `root.getAbsoluteTime` had no implementation in the repo and the fallback was '', so the news
// card silently dropped the absolute publication time and showed only a relative label.
{
  const { formatAbsoluteTime } = await load('src/ui/pages/news.js');
  const formatted = formatAbsoluteTime('2026-09-19T11:57:00.000Z', 'Asia/Seoul');
  if (!formatted || !formatted.includes('2026') || !formatted.includes('57') || !/(KST|GMT\+9)/.test(formatted)) {
    fail(`W09-C: the absolute publication time must render with its timezone, got ${JSON.stringify(formatted)}`);
  }
  if (formatAbsoluteTime('') !== '' || formatAbsoluteTime(null) !== '' || formatAbsoluteTime('not-a-date') !== '') {
    fail('W09-C: an unparseable publication time must render as empty, not a fabricated timestamp');
  }
  const utc = formatAbsoluteTime('2026-09-19T11:57:00.000Z', 'UTC');
  if (!/11:57/.test(utc)) fail(`W09-C: the UTC timezone rendering drifted, got ${JSON.stringify(utc)}`);
  const newsSource = (await import('node:fs')).readFileSync(new URL('../src/ui/pages/news.js', import.meta.url), 'utf8');
  if (!/getAbsoluteTime[\s\S]{0,80}\|\|\s*formatAbsoluteTime\(/.test(newsSource) || !/data-published-at|dataset\.publishedAt/.test(newsSource)) {
    fail('W09-C: the news card must fall back to the local formatter and keep the raw publication instant');
  }
}

// ── domain boundary missingness and immutability ─────────────────────────────────────────────
{
  const { classifyRRG, computeRelativeRotation } = await load('src/domain/themes/rrg.js');
  if (classifyRRG(null, null).quadrant !== 'unknown') fail('rrg: missing values became a Lagging quadrant');
  const invalidRotation = computeRelativeRotation({ history: Array(21).fill(NaN), benchmarkHistory: Array(21).fill(100), hasQuote: true, hasBenchmarkQuote: true });
  const alignedTail = computeRelativeRotation({ history: Array.from({ length: 21 }, (_, index) => 100 + index), benchmarkHistory: [...Array(20).fill(10), ...Array.from({ length: 21 }, (_, index) => 100 + index)], hasQuote: true, hasBenchmarkQuote: true });
  if (alignedTail.quadrant !== 'Leading' || Math.abs(alignedTail.rsRatio - 100) > 1e-9 || Math.abs(alignedTail.rsMom - 100) > 1e-9) fail(`rrg: unequal histories were not aligned on their common tail: ${JSON.stringify(alignedTail)}`);
  if (invalidRotation.quadrant !== 'unknown') fail('rrg: invalid history produced a quadrant');
  const { deriveHomeSummary } = await load('src/domain/home/summary.js');
  if (deriveHomeSummary({ sentiment: { fearGreed: NaN }, signal: { score: Infinity }, newsCount: -2 }).status !== 'unavailable') fail('home: non-finite inputs counted as available');
  const { deriveSentimentSummary } = await load('src/domain/sentiment/metrics.js');
  const sentiment = deriveSentimentSummary({ fearGreed: 101, vix9d: -1, vix: 17, vix3m: 20, vix6m: 22 });
  if (!sentiment.blocked || !Object.isFrozen(sentiment.vixTermStructure.points)) fail('sentiment: out-of-domain inputs were promoted or mutable');
  const { deriveMacroTransmissionEvidence } = await load('src/domain/macro/transmission.js');
  const macro = deriveMacroTransmissionEvidence({ treasurySupply: '' });
  if (macro.observed.issuance || !Object.isFrozen(macro) || !Object.isFrozen(macro.chain)) fail('macro: blank evidence was observed or projection remained mutable');
  const { classifyNewsTextStance, computeNewsSentimentScore, computeNewsRiskSignals } = await load('src/domain/news/scoring.js');
  if (classifyNewsTextStance('The commissioner dismissed Bullard from the panel') !== 'neut' || classifyNewsTextStance('Stocks surged after earnings beat') !== 'bull') fail('news: substring collision or valid inflection regression');
  const fixedNewsNow = Date.parse('2026-09-08T01:00:00Z');
  const newsItems = (titles) => titles.map((title) => ({ title, pubDate: '2026-09-07T12:00:00Z' }));
  if (computeNewsRiskSignals({ now: fixedNewsNow, items: newsItems(['Set your default browser', 'The story spreads online', 'Credit card rewards expand']) }).some((row) => row.type === 'credit')) fail('news: neutral words produced credit stress');
  if (!computeNewsRiskSignals({ now: fixedNewsNow, items: newsItems(['Credit spreads widen', 'Bond market default risk rises', 'Banks face credit stress']) }).some((row) => row.type === 'credit')) fail('news: explicit credit stress was lost');
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
  if (signal.modelVersion !== 'signal-from-trading-score.v1' || signal.score !== score.total || signal.action !== 'NO_ACTION' || signal.status !== 'reference-only' || signal.decisionEligible !== false || signal.predictiveValidation !== 'not-established') fail(`signal: unvalidated score must remain descriptive/reference-only, got ${JSON.stringify(signal)}`);
  if (signal.presentation?.modelVersion !== SIGNAL_PRESENTATION_MODEL_VERSION || signal.presentation?.status !== 'reference-only' || signal.presentation?.action !== 'NO_ACTION' || signal.presentation?.decisionEligible !== false || signal.presentation?.predictiveValidation !== 'not-established') fail(`signal: non-predictive presentation envelope drifted, got ${JSON.stringify(signal.presentation)}`);
  const favorable = deriveTradingScoreDecisionPresentation({ score: { total: 75, partial: false }, inputVersion: 'unit.v1' });
  if (favorable.tier !== 'reference-only' || favorable.action !== 'NO_ACTION' || favorable.decisionEligible !== false || !/예측 검증 미확립/.test(favorable.decision) || favorable.displayScore !== '75') fail(`signal: favorable condition presentation must remain descriptive, got ${JSON.stringify(favorable)}`);
  const partial = deriveTradingScoreDecisionPresentation({ score: { total: 43, partial: true, componentMissing: ['trend'] }, inputVersion: 'unit.v1' });
  if (partial.status !== 'partial' || partial.displayScore !== '43*' || partial.tier !== 'reference-only' || partial.action !== 'NO_ACTION' || partial.decisionEligible !== false) fail(`signal: partial presentation must remain descriptive/fail-closed, got ${JSON.stringify(partial)}`);
  const blocked = deriveSignalDecisionFromTradingScore({ score: computeTradingScoreModel({}), inputVersion: 'unit.v1' });
  if (blocked.status !== 'blocked' || blocked.action !== 'NO_ACTION' || blocked.score !== null || blocked.decisionEligible !== false || blocked.presentation?.status !== 'blocked' || blocked.presentation?.action !== 'NO_ACTION' || blocked.presentation?.displayScore !== '—') fail(`signal: missing score inputs must fail closed, got ${JSON.stringify(blocked)}`);
  const invalidScore = computeTradingScoreModel({ mode: 'swing', vix: -10, vvix: 0, dxy: 10, tnx: -1, oilPrice: -5, fg: 101, maCurrent: true, spx200ma: -1, spx50ma: 0, spxPrice: -10, breadthAvailable: true, breadth200: 150, pcr: -1, hyBp: -2, newsSentimentScore: 101, newsRiskSignals: [{ impact: 'bad' }] });
  if (invalidScore.total !== null || invalidScore.modelVersion !== 'trading-score.v3' || !Object.isFrozen(invalidScore) || !Object.isFrozen(invalidScore.componentMissing)) fail(`signal: out-of-domain inputs must fail closed in an immutable v3 result, got ${JSON.stringify(invalidScore)}`);
}

// ── E2/LC-26 (P1214): the signal score mode is one revision consumed by both readers ───────────
// The mode used to be cosmetic: the legacy facade hardcoded 'swing', the native reader dropped the
// mode entirely, and the UI copy promised a threshold the model never produced. This fixes the mode
// as a real calculation input with a single owner and forbids a mode-dependent decision cutoff.
{
  const signalMode = await load('src/domain/signal/mode.js');
  if (signalMode.SIGNAL_SCORE_MODES.join(',') !== 'swing,day') fail(`P1214 signal-mode: mode vocabulary drifted, got ${signalMode.SIGNAL_SCORE_MODES.join(',')}`);
  if (signalMode.normalizeSignalScoreMode('DAY') !== 'day' || signalMode.normalizeSignalScoreMode('nonsense') !== 'swing' || signalMode.normalizeSignalScoreMode(null) !== 'swing') {
    fail('P1214 signal-mode: an unknown or blank mode must normalize to the swing default');
  }
  const dayMode = signalMode.describeSignalScoreMode('day');
  const swingMode = signalMode.describeSignalScoreMode('swing');
  if (!/plus-12/.test(dayMode.volatilityAdjustment) || dayMode.volatilityAdjustment === swingMode.volatilityAdjustment) {
    fail('P1214 signal-mode: the day descriptor must name the real volatility adjustment it applies');
  }
  if (dayMode.decisionThreshold != null || swingMode.decisionThreshold != null) {
    fail('P1214 signal-mode: no mode-specific decision threshold exists; the descriptor must not invent one');
  }
  if (!/임계값/.test(dayMode.note) || !/사용하지 않습니다/.test(dayMode.note)) fail('P1214 signal-mode: the descriptor must state that no separate threshold is used');

  const { normalizeAnalysis } = await load('src/data/normalize/analysis.js');
  const swingAnalysis = normalizeAnalysis({ tradingScoreInputs: { mode: 'swing', vix: 18 } });
  const dayAnalysis = normalizeAnalysis({ tradingScoreInputs: { mode: 'day', vix: 18 } });
  if (swingAnalysis.signal.scoreMode !== 'swing' || dayAnalysis.signal.scoreMode !== 'day') fail('P1214 signal-mode: normalizeAnalysis must carry the declared mode into the signal slice');
  if (dayAnalysis.signal.presentation?.score === swingAnalysis.signal.presentation?.score) {
    fail(`P1214 signal-mode: the day mode changed only the label, not the score input (${dayAnalysis.signal.presentation?.score} == ${swingAnalysis.signal.presentation?.score})`);
  }

  const readersSource = readFileSync(path.join(root, 'src/data/runtime-readers.js'), 'utf8');
  const facade = readFileSync(path.join(root, 'src/legacy/compatibility-facade.js'), 'utf8');
  if (!/input\.mode = normalizeSignalScoreMode\(/.test(readersSource)) fail('P1214 signal-mode: the native runtime reader must thread the declared mode into the score input');
  if (!/mode: normalizeSignalScoreMode\(root\?\.AIO_ARCH/.test(facade)) fail('P1214 signal-mode: the legacy facade must read the shared mode, not hardcode swing');

  // ── QA-SIG-27 (P1263): 체크리스트 3상 집계는 모드 독립이고, 집계 결과가 자기 모드 revision을
  // 실어 나른다. 보고되지 않은 조건(ok 없음)은 대기로 센다. 제품 결정: 모드별 판정 임계값 없음.
  const summarize = signalMode.summarizeEntryChecklist;
  const threeStates = [
    { id: 'ec-vix', ok: true }, { id: 'ec-score', ok: true }, { id: 'ec-breadth', ok: false },
    { id: 'ec-streak', ok: null }, { id: 'ec-event', ok: true },
  ];
  const swingSummary = summarize(threeStates, swingMode);
  const daySummary = summarize(threeStates, dayMode);
  if (swingSummary.passed !== 3 || swingSummary.failed !== 1 || swingSummary.pending !== 1 || swingSummary.total !== 5) {
    fail(`QA-SIG-27 checklist: 3-state aggregation drifted, got ${JSON.stringify(swingSummary)}`);
  }
  if (swingSummary.label !== '일부 조건 미수신') fail(`QA-SIG-27 checklist: a pending condition must surface as 미수신, got ${swingSummary.label}`);
  if (!swingSummary.modeRevision.endsWith('.swing') || swingSummary.decisionThreshold != null) {
    fail(`QA-SIG-27 checklist: the summary must carry its mode revision and a null decision threshold, got ${JSON.stringify(swingSummary)}`);
  }
  if (swingSummary.passed !== daySummary.passed || swingSummary.failed !== daySummary.failed || swingSummary.pending !== daySummary.pending || swingSummary.label !== daySummary.label) {
    fail('QA-SIG-27 checklist: the market-health checklist is mode-independent — only the revision binding may differ');
  }
  if (daySummary.modeRevision === swingSummary.modeRevision || daySummary.decisionThreshold != null) {
    fail('QA-SIG-27 checklist: each mode revision must be bound distinctly and must not invent a decision threshold');
  }
  const allPending = summarize([{}, null, { ok: null }], 'swing');
  if (allPending.pending !== 3 || allPending.passed !== 0 || allPending.failed !== 0 || allPending.label !== '일부 조건 미수신') {
    fail(`QA-SIG-27 checklist: unreported conditions must aggregate as pending, got ${JSON.stringify(allPending)}`);
  }
  const allClear = summarize([{ ok: true }, { ok: true }, { ok: true }, { ok: true }, { ok: true }], swingMode);
  if (allClear.label !== '조건 대부분 충족' || allClear.pending !== 0) fail(`QA-SIG-27 checklist: a fully passing checklist must aggregate without a pending label, got ${JSON.stringify(allClear)}`);
  if (swingMode.checklistPolicy?.modeIndependent !== true || swingMode.checklistPolicy?.decisionThreshold != null || dayMode.checklistPolicy?.modeIndependent !== true) {
    fail('QA-SIG-27 checklist: the product decision (mode-independent, no per-mode threshold) must stay recorded on the descriptor');
  }
}

// ── E2/S-C/P1240: screener row resolution shadow comparison ────────────────────────────────────
// The legacy resolver and the facade reader both resolve screener rows, with different fallback
// chains. This harness executes BOTH on the same synthetic inputs and pins the measured divergence
// set, so a new divergence cannot appear silently. It does not declare them equivalent.
{
  const dataSource = readFileSync(path.join(root, 'js/aio-data.js'), 'utf8');
  const anchor = dataSource.indexOf('function _aioGetCanonicalScreenerRows(');
  if (anchor < 0) fail('E2/S-C: the legacy canonical screener-row resolver is missing');
  const braceStart = dataSource.indexOf('{', anchor);
  let depth = 0;
  let braceEnd = -1;
  for (let index = braceStart; index < dataSource.length; index += 1) {
    if (dataSource[index] === '{') depth += 1;
    else if (dataSource[index] === '}') { depth -= 1; if (depth === 0) { braceEnd = index + 1; break; } }
  }
  if (braceEnd < 0) fail('E2/S-C: could not extract the legacy resolver body');
  if (!/function _aioGetCanonicalScreenerRows\(root\)/.test(dataSource.slice(anchor, braceStart))) {
    fail('E2/S-C: the legacy resolver must stay root-injectable for the shadow harness');
  }
  const legacyResolve = new Function('window', `return ${dataSource.slice(anchor, braceEnd)};`)({});
  const policy = await load('src/data/screener-row-policy.js');
  const cases = [
    { id: 'published-rows', nativeRows: [{ sym: 'AAA' }], status: 'current', db: [{ sym: 'DB' }] },
    { id: 'published-empty', nativeRows: [], status: 'current', db: [{ sym: 'DB' }] },
    { id: 'unpublished-empty-db-present', nativeRows: [], status: 'unavailable', db: [{ sym: 'DB' }] },
    { id: 'unpublished-empty-db-absent', nativeRows: [], status: 'unavailable', db: null },
    { id: 'no-reader-db-present', nativeRows: null, status: null, db: [{ sym: 'DB' }] }
  ];
  const shape = (rows) => (Array.isArray(rows) ? rows : []).map((row) => row && row.sym).join(',');
  const measured = cases.map((testCase) => {
    const syntheticRoot = { AIO_ARCH: {}, _aioScreenerRows: [{ sym: 'DEAD' }] };
    if (testCase.db) syntheticRoot.SCREENER_DB = testCase.db;
    if (testCase.nativeRows !== null) syntheticRoot.AIO_ARCH.getScreenerRows = () => testCase.nativeRows;
    if (testCase.status) syntheticRoot.AIO_ARCH.getScreenerState = () => ({ status: testCase.status, rows: testCase.nativeRows || [] });
    syntheticRoot.AIO_ARCH.resolveScreenerRows = (intent) => policy.resolveScreenerRows(syntheticRoot, intent);
    return {
      id: testCase.id,
      legacy: shape(legacyResolve(syntheticRoot)),
      facade: shape(createLegacyFacade(syntheticRoot).readScreener().rows),
      evidenceOnly: shape(policy.resolveScreenerRows(syntheticRoot, policy.SCREENER_ROW_INTENT.EVIDENCE)),
      compat: shape(policy.resolveScreenerRows(syntheticRoot, policy.SCREENER_ROW_INTENT.BUNDLED_COMPAT))
    };
  });
  // The owner decision (P1241): a published-but-empty native state is authoritative for BOTH intents,
  // so the old divergence on that case is gone. The only remaining differences are the two declared
  // pre-publication compatibility reads, where the evidence reader deliberately has no substitute.
  const expected = [
    { id: 'published-rows', legacy: 'AAA', facade: 'AAA' },
    { id: 'published-empty', legacy: '', facade: '' },
    { id: 'unpublished-empty-db-present', legacy: 'DB', facade: '' },
    { id: 'unpublished-empty-db-absent', legacy: '', facade: '' },
    { id: 'no-reader-db-present', legacy: 'DB', facade: '' }
  ];
  const mismatches = expected.filter((entry, index) => {
    const actual = measured[index];
    return !actual || actual.id !== entry.id || actual.legacy !== entry.legacy || actual.facade !== entry.facade;
  });
  if (mismatches.length) {
    fail(`E2/S-C: screener row resolution moved off the declared table — ${mismatches.map((entry) => `${entry.id} legacy=${measured.find((m) => m.id === entry.id)?.legacy} facade=${measured.find((m) => m.id === entry.id)?.facade}`).join(' | ')}`);
  }
  // The retired `_aioScreenerRows` global (S-B) must be unreachable from every path.
  const deadReach = measured.filter((entry) => /DEAD/.test(`${entry.legacy},${entry.facade},${entry.evidenceOnly},${entry.compat}`));
  if (deadReach.length) fail(`E2/S-C: the retired _aioScreenerRows global is still reachable (${deadReach.map((entry) => entry.id).join(', ')})`);
  // The evidence intent must never substitute the bundled DB, and intent must not change the
  // published-empty outcome.
  const evidenceLeak = measured.filter((entry) => entry.evidenceOnly === 'DB');
  if (evidenceLeak.length) fail(`E2/S-C: the evidence intent substituted the bundled DB (${evidenceLeak.map((entry) => entry.id).join(', ')})`);
  if (measured.find((entry) => entry.id === 'published-empty').compat !== '') {
    fail('E2/S-C: a published-but-empty native state still falls back to the bundled DB');
  }
}

// ── domain/technical/stage.js: deriveTechnicalStageFromOhlcv ───────────────────────────────────
// 2026-07-21/P756: replaces the retired deriveTechnicalModel toy (src/domain/technical/
// indicators.js, had no legacy formula behind it) as normalizeAnalysis's real technical model. Not
// a legacy-dump golden fixture (there's no single legacy function this extracts from — it composes
// a faithful SMA reimplementation with the already-parity-verified classifyMovingAverageStructure),
// so hand-written expected outputs against the documented status/trend thresholds instead.
{
  const { deriveTechnicalStageFromOhlcv } = await load('src/domain/technical/stage.js');
  const barStart = Date.parse('2026-01-01T00:00:00Z');
  const bars = (n, closeFn) => Array.from({ length: n }, (_, index) => ({ close: closeFn(index), date: new Date(barStart + index * 86_400_000).toISOString() }));
  const technicalNow = barStart + 220 * 86_400_000;

  const unavailable = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: bars(1, () => 100) });
  if (unavailable.status !== 'unavailable' || unavailable.symbol !== 'SPY') fail(`technical-stage: 1 bar must be status:unavailable with an uppercased symbol, got ${JSON.stringify(unavailable)}`);

  const partial = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: bars(60, (i) => 100 + i) });
  if (partial.status !== 'partial' || partial.indicators.ma20 == null || partial.indicators.ma50 == null) fail(`technical-stage: 60 rising bars (<200) must be status:partial with ma20/ma50 present, got ${JSON.stringify(partial)}`);

  const uptrend = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: bars(220, (i) => 100 + i * 0.5), now: technicalNow });
  if (uptrend.status !== 'current' || uptrend.indicators.trend !== 'above-ma20' || uptrend.structure.stageEstimate !== 'STAGE_2_ADVANCE') fail(`technical-stage: 220 steadily rising bars must be status:current, trend:above-ma20, STAGE_2_ADVANCE, got ${JSON.stringify(uptrend)}`);

  const downtrend = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: bars(220, (i) => 210 - i * 0.5), now: technicalNow });
  if (downtrend.indicators.trend !== 'below-ma20' || downtrend.structure.stageEstimate !== 'STAGE_4_DECLINE') fail(`technical-stage: 220 steadily falling bars must be trend:below-ma20, STAGE_4_DECLINE, got ${JSON.stringify(downtrend)}`);

  const noInput = deriveTechnicalStageFromOhlcv({});
  if (noInput.status !== 'unavailable' || noInput.symbol !== null || noInput.observedCount !== 0) fail(`technical-stage: no input must fail closed to unavailable/null/0, not throw or guess, got ${JSON.stringify(noInput)}`);
  const invalidPrices = deriveTechnicalStageFromOhlcv({ symbol: 'bad', ohlcv: [{ close: -1 }, { close: 0 }, { close: 'not-a-price' }] });
  if (invalidPrices.status !== 'unavailable' || invalidPrices.observedCount !== 0) fail(`technical-stage: non-positive prices must not form a trend, got ${JSON.stringify(invalidPrices)}`);
  const brokenTailBars = bars(220, (i) => 100 + i);
  brokenTailBars[210] = { ...brokenTailBars[210], close: null };
  const brokenTail = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: brokenTailBars, now: technicalNow });
  if (brokenTail.observedCount !== 9 || brokenTail.status !== 'partial' || brokenTail.indicators.ma20 !== null) fail(`technical-stage: invalid middle bar was silently removed instead of breaking the contiguous MA window: ${JSON.stringify(brokenTail)}`);
  const undated = deriveTechnicalStageFromOhlcv({ symbol: 'spy', ohlcv: Array.from({ length: 220 }, (_, index) => ({ close: 100 + index })) });
  if (undated.status !== 'partial' || undated.freshness !== 'unknown' || undated.observedAt !== null) fail(`technical-stage: undated history was promoted to current: ${JSON.stringify(undated)}`);
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
    observedAt: '1970-01-01T00:00:00.000Z', factorObservedAt: '1970-01-01T00:00:00.000Z', factorSourceKind: 'T3_PUBLIC_DELAYED', factorAllowedUse: 'research-relative-ranking-only', factorQuality: { status: 'CURRENT', stale: false },
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

  // Missing factor evidence must be excluded then renormalized, not imputed as z=0. A row
  // with no positive-weight evidence must remain visible but stay outside the rank denominator.
  {
    const sparseRows = [1, 2, 3, 4, 5, 6].map((seed) => baseRow('SP' + seed, 'Tech', seed));
    sparseRows[0] = { ...sparseRows[0], pctSma50: null, pctSma200: null };
    const sparse = computeFactorRanks({ rows: sparseRows, weights: { momentum: 1, trend: 1, lowvol: 1, kalman: 1 }, now: 0 });
    const sparseRow = sparse.rows.find((row) => row.sym === 'SP1');
    const observedKeys = sparse.activeFactors.filter((key) => sparseRow.factorScores[key] != null);
    const observedWeight = observedKeys.reduce((sum, key) => sum + sparse.appliedFactorWeights[key], 0);
    if (!sparse.activeFactors.includes('trend') || sparseRow.factorScores.trend !== null || sparseRow['_z_trend'] !== null) fail(`factor-ranks: missing trend evidence must remain null, got ${JSON.stringify(sparseRow)}`);
    if (sparseRow._compositeZ !== null || Math.abs(sparseRow.factorCoverage - observedWeight) > 1e-9) fail(`factor-ranks: a row below the evidence floor must retain coverage but not a composite, got composite=${sparseRow._compositeZ}, coverage=${sparseRow.factorCoverage}`);
    if (sparse.ranked !== 5 || sparseRow.rank !== null || sparseRow.quantSignal !== null || sparseRow.rankingEligibility !== 'insufficient-row-factor-coverage') fail(`factor-ranks: materially sparse evidence must stay visible but leave the rank denominator, got ranked=${sparse.ranked}, rank=${sparseRow.rank}, eligibility=${sparseRow.rankingEligibility}`);

    const noEvidenceRows = [1, 2, 3, 4, 5, 6].map((seed) => baseRow('NE' + seed, 'Tech', seed));
    noEvidenceRows[0] = { ...noEvidenceRows[0], pctSma50: null, pctSma200: null };
    const noEvidence = computeFactorRanks({ rows: noEvidenceRows, weights: { trend: 1 }, now: 0 });
    const noEvidenceRow = noEvidence.rows.find((row) => row.sym === 'NE1');
    if (noEvidence.ranked !== 5 || noEvidenceRow._compositeZ !== null || noEvidenceRow.rank !== null || noEvidenceRow.quantSignal !== null) fail(`factor-ranks: no weighted evidence must be null and excluded from rank denominator, got ranked=${noEvidence.ranked}, row=${JSON.stringify(noEvidenceRow)}`);

    const staleRows = [1, 2, 3, 4, 5, 6].map((seed) => ({ ...baseRow('ST' + seed, 'Tech', seed), mcap: seed * 1e9, _mcapObservedAt: '2026-08-26', _mcapSourceKind: 'T2_LICENSED', _mcapAllowedUse: 'research-relative-ranking-only', _mcapQuality: { status: 'CURRENT', stale: false } }));
    staleRows[0]._mcapObservedAt = '2020-01-01';
    const stale = computeFactorRanks({ rows: staleRows, weights: { size: 1 }, now: Date.parse('2026-08-27') });
    const staleRow = stale.rows.find((row) => row.sym === 'ST1');
    if (stale.ranked !== 5 || staleRow._compositeZ !== null || staleRow.rank !== null || staleRow.factorScores.size !== null) fail(`factor-ranks: stale size evidence must not enter denominator, got ranked=${stale.ranked}, row=${JSON.stringify(staleRow)}`);
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

  // W07-A/P1146 (M01): an explicit weight request must not degrade into a different model.
  // quality has no fundamental lineage in baseRow, so a quality-only request is not computable.
  {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => baseRow('W' + seed, 'Tech', seed));
    const unavailableRequest = computeFactorRanks({ rows, weights: { quality: 1 }, now: 0 });
    if (unavailableRequest.rankingState !== 'unavailable' || unavailableRequest.available !== false || unavailableRequest.rankingUnavailableReason !== 'requested-factors-unavailable' || unavailableRequest.ranked !== 0) {
      fail(`W07-A: a fully-unavailable explicit request must fail closed, got ${JSON.stringify({ state: unavailableRequest.rankingState, reason: unavailableRequest.rankingUnavailableReason, ranked: unavailableRequest.ranked })}`);
    }
    const nonPositive = computeFactorRanks({ rows, weights: { momentum: 0, trend: -1, lowvol: NaN }, now: 0 });
    if (nonPositive.rankingUnavailableReason !== 'requested-weights-not-positive' || nonPositive.rankingState !== 'unavailable') {
      fail(`W07-A: a non-positive explicit request must not be promoted to equal/positive weights, got ${JSON.stringify(nonPositive.rankingUnavailableReason)}`);
    }
    // 90/10 quality/momentum: momentum is computable, but losing 90% of the request still withholds.
    const coverageBlocked = computeFactorRanks({ rows, weights: { quality: 0.9, momentum: 0.1 }, now: 0 });
    if (coverageBlocked.rankingUnavailableReason !== 'requested-factor-coverage-below-threshold' || coverageBlocked.rankingState !== 'unavailable') {
      fail(`W07-A: a 90% requested-weight loss must not renormalize onto momentum, got ${JSON.stringify(coverageBlocked.rankingUnavailableReason)}`);
    }
    const allowedPartial = computeFactorRanks({ rows, weights: { momentum: 0.9, quality: 0.1 }, now: 0 });
    if (allowedPartial.rankingState !== 'ranked' || allowedPartial.appliedFactorWeights.momentum !== 1 || allowedPartial.excludedFactorWeights.quality !== 0.1 || Math.abs(allowedPartial.requestedWeightCoveragePct - 90) > 1e-9) {
      fail(`W07-A: an allowed partial request must report requested/applied/excluded weights and lost coverage, got ${JSON.stringify({ state: allowedPartial.rankingState, applied: allowedPartial.appliedFactorWeights, excluded: allowedPartial.excludedFactorWeights, coveragePct: allowedPartial.requestedWeightCoveragePct })}`);
    }
    const modelDefault = computeFactorRanks({ rows, weights: { momentum: 0.27, trend: 0.2, lowvol: 0.16, size: 0.08, value: 0.1, quality: 0.09, kalman: 0.1 }, weightsPolicy: 'model-default', now: 0 });
    if (modelDefault.rankingState !== 'ranked' || modelDefault.weightsPolicy !== 'model-default') {
      fail(`W07-A: the versioned default model must keep renormalizing over available factors, got ${JSON.stringify(modelDefault.rankingState)}`);
    }
  }
}

// ── W07-E/P1146 (M06): monthly performance requires a contiguous monthly grid ────────────────
// A gap must never be filled, and two months must never be spliced into one monthly return sample.
{
  const { buildPortfolioBacktestLab } = await load('src/domain/portfolio/backtest.js');
  const monthKeys = (startYear, startMonth, count) => {
    const keys = [];
    for (let i = 0; i < count; i++) {
      const offset = startMonth - 1 + i;
      keys.push(`${startYear + Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}`);
    }
    return keys;
  };
  const priceMapFor = (keys) => {
    const timestamps = keys.map((key) => `${key}-28T00:00:00Z`);
    const values = keys.map((_, index) => 100 * Math.pow(1.01, index));
    const series = () => ({ timestamps: [...timestamps], adjustedCloses: [...values], backtestEligible: true, backtestPriceBasis: 'adjusted-close' });
    return { AAA: series(), SPY: series() };
  };
  const positions = [{ ticker: 'AAA', qty: 10, cost: 10 }];

  const fullKeys = monthKeys(2024, 1, 16);
  const full = buildPortfolioBacktestLab(priceMapFor(fullKeys), positions, {});
  if (!full.ok || full.settings?.monthlyGridBasis !== 'contiguous' || (full.settings?.gridGaps || []).length !== 0) {
    fail(`W07-E: a contiguous monthly grid must not be withheld, got ${JSON.stringify(full.settings || full.reason)}`);
  }

  const gapped = buildPortfolioBacktestLab(priceMapFor(fullKeys.filter((key) => key !== '2024-08')), positions, {});
  if (gapped.ok !== false || gapped.reason !== 'monthly grid has gaps and no contiguous window reaches 14 months' || gapped.gridGaps?.[0]?.missingMonths !== 1) {
    fail(`W07-E: a gapped monthly grid must withhold instead of splicing two months into one sample, got ${JSON.stringify({ ok: gapped.ok, reason: gapped.reason, gaps: gapped.gridGaps })}`);
  }

  const longGapped = buildPortfolioBacktestLab(priceMapFor(monthKeys(2024, 1, 30).filter((key) => key !== '2024-02')), positions, {});
  if (longGapped.ok !== true || longGapped.settings?.monthlyGridBasis !== 'longest-contiguous-window' || (longGapped.settings?.excludedMonths || []).join(',') !== '2024-01' || (longGapped.settings?.gridGaps || []).length !== 1) {
    fail(`W07-E: a long gapped grid must fall back to the longest contiguous window and name the exclusion, got ${JSON.stringify({ ok: longGapped.ok, settings: longGapped.settings })}`);
  }
}

// ── domain/portfolio/surface.js + domain/fundamental/sec-report.js ─────────────────────────────
// P831/P832: deterministic native secondary projections must preserve null/unavailable inputs,
// finite quote derivation, and official-SEC provenance rather than converting missing facts to 0.
// W01/P1143: sentiment ViewModel — one revision renders the P/C card and the narratives
// together. Missing P/C withholds, missing SPY never becomes 0% flat, and a missing
// trading score withholds while a valid 0 stays 0.
{
  const { deriveSentimentViewModel, putCallBand, putCallNeedlePosition, spyMoveState, tradingScoreLink } = await load('src/domain/sentiment/narrative.js');
  const observed = deriveSentimentViewModel({ values: { fearGreed: 42, vix9d: 18, vix: 17, vix3m: 20, vix6m: 22, putCall: 0.79, spyChg: 0.4, tradingScoreTotal: 55 }, evidenceByMetric: {}, revision: null, now: '2026-09-19T00:00:00Z' });
  const pcNarrative = observed.narratives.find((row) => row.claimId === 'sentiment.put-call');
  if (!/0\.79/.test(pcNarrative?.text || '') || !/균형 구간/.test(pcNarrative?.text || '') || putCallNeedlePosition(0.79) !== '중립') fail(`W01/P1143 sentiment ViewModel: 0.79 must render the same band in card and narrative, got ${JSON.stringify(pcNarrative)}`);
  const moved = deriveSentimentViewModel({ values: { fearGreed: 42, vix9d: 18, vix: 17, vix3m: 20, vix6m: 22, putCall: 1.21, spyChg: 0.4, tradingScoreTotal: 55 }, evidenceByMetric: {}, revision: null, now: '2026-09-19T00:00:00Z' });
  if (moved.revision === observed.revision || !/1\.21/.test(moved.narratives.find((row) => row.claimId === 'sentiment.put-call')?.text || '')) fail('W01/P1143 sentiment ViewModel: a new 1.21 observation must move card and narrative to one new revision');
  const missingPc = deriveSentimentViewModel({ values: { fearGreed: 42, vix9d: 18, vix: 17, vix3m: 20, vix6m: 22, putCall: null }, evidenceByMetric: {}, revision: null, now: '2026-09-19T00:00:00Z' });
  const missingPcNarrative = missingPc.narratives.find((row) => row.claimId === 'sentiment.put-call');
  if (putCallBand(null)?.blocked !== true || putCallNeedlePosition(null) !== '판정 보류' || missingPcNarrative?.status !== 'withheld') fail(`W01/P1143 sentiment ViewModel: missing P/C must withhold, got ${JSON.stringify(missingPcNarrative)}`);
  const missingSpy = deriveSentimentViewModel({ values: { fearGreed: 42, vix: 17, spyChg: null }, evidenceByMetric: {}, revision: null, now: '2026-09-19T00:00:00Z' });
  if (spyMoveState(null)?.state !== 'missing' || spyMoveState(0)?.state !== 'observed' || missingSpy.narratives.find((row) => row.claimId === 'sentiment.spy-vix-divergence')?.status !== 'withheld') fail('W01/P1143 sentiment ViewModel: missing SPY move must stay missing, never 0% flat');
  if (tradingScoreLink(null)?.state !== 'withheld' || tradingScoreLink(0)?.state !== 'observed' || tradingScoreLink(0)?.value !== 0) fail('W01/P1143 sentiment ViewModel: trading-score null must withhold while a valid 0 stays 0');
  if (!Object.isFrozen(observed) || !Object.isFrozen(observed.metrics) || !Object.isFrozen(observed.narratives)) fail('W01/P1143 sentiment ViewModel: projection must be immutable');
}
{
// ── domain/screener/setup-profile.js: reference-only setup labels fail closed ────────────────
// v53.91: setup observations and TradingView evidence are research overlays only;
// missing volume/benchmark evidence must stay visible instead of becoming a trade signal.
{
  const { deriveScreenerSetupProfile } = await load('src/domain/screener/setup-profile.js');
  const pullback = deriveScreenerSetupProfile({
    observedAt: '2026-08-09', rank: 80, ret1m: -2, ret3m: 15, ret6m: 30,
    pctSma50: -1, pctSma200: 1, rsi: 55, benchmarkRet: 5,
  });
  if (pullback.status !== 'partial' || pullback.relativeStrengthPullback !== 'candidate' || pullback.support200 !== 'near') {
    fail(`setup-profile: relative-strength pullback candidate drifted, got ${JSON.stringify(pullback)}`);
  }
  if (pullback.volumeEvidence !== 'unavailable' || pullback.allowedUse !== 'research-relative-ranking-only' || !pullback.missingEvidence.includes('RVOL')) {
    fail(`setup-profile: missing evidence must fail closed, got ${JSON.stringify(pullback)}`);
  }
  const missingBenchmark = deriveScreenerSetupProfile({ observedAt: '2026-08-09', rank: 80, ret1m: -2, ret3m: 15, ret6m: 30, pctSma50: -1, pctSma200: 1, rsi: 55 });
  if (missingBenchmark.relativeStrengthPullback !== 'unavailable' || !missingBenchmark.missingEvidence.includes('benchmark-relative-strength')) {
    fail(`setup-profile: composite rank cannot substitute for benchmark-relative strength, got ${JSON.stringify(missingBenchmark)}`);
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
  router.transition('masters');
  await flush();
  if (mastersLoads !== 2 || mastersMounts !== 1 || nodes.masters.dataset.aioRouteModuleState !== 'ready') fail('lazy-router: failed dynamic import was not retryable on route re-entry');
  router.dispose();
}

  const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
  const empty = derivePortfolioSurface({ state: { status: 'unavailable', holdings: [], cash: null }, liveData: {}, vix: null });
  if (empty.status !== 'unavailable' || empty.dailyChange !== null || empty.exposureCap !== null || empty.sectorBreakdown.length !== 0) fail(`portfolio-surface: empty input must remain unavailable, got ${JSON.stringify(empty)}`);
  const quoteNow = Date.parse('2026-09-12T15:00:00Z');
  const currentQuote = (price, extra = {}) => ({ price, observedAt: '2026-09-12T14:55:00Z', source: 'runtime-test-provider', sourceKind: 'LIVE', sourceTier: 'T2_LICENSED', rightsId: 'runtime-test-rights', revisionId: 'runtime-test-r1', allowedUse: 'decision', allowedUseCeiling: 'decision', quality: { status: 'live', freshness: 'live', timestampValid: true, ageMs: 5 * 60 * 1000, freshnessMs: 15 * 60 * 1000 }, ...extra, dailyPct: extra.dailyPct ?? extra.pct ?? null, changeBasis: extra.changeBasis || 'previous-close' });
  const live = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10, sector: 'Technology' }], cash: 50 }, liveData: { ABC: currentQuote(12, { pct: 2 }) }, vix: currentQuote(22), now: quoteNow });
  if (live.modelVersion !== 'portfolio-surface.v3' || live.positionValue !== 24 || live.totalAssets !== 74 || live.totalPnl !== 4 || live.exposureCap !== 50 || live.sectorBreakdown.length !== 2 || live.valuationState !== 'complete' || live.allowedUse !== 'reference-only' || live.decisionEligible !== false || live.snapshotFallbackBlocked !== true || live.costFallbackBlocked !== true) fail(`portfolio-surface: live/cash derivation or reference boundary drifted, got ${JSON.stringify(live)}`);
  const partial = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10 }, { symbol: 'XYZ', shares: 1, avgCost: 20 }], cash: null }, liveData: { ABC: currentQuote(12, { pct: 2 }) }, vix: currentQuote(22), now: quoteNow });
  if (partial.positionValue !== null || partial.totalPnl !== null || partial.dailyChange !== null || partial.sectorBreakdown.length !== 0) fail(`portfolio-surface: partial holdings must not sum unknown rows as zero, got ${JSON.stringify(partial)}`);
  const daily = derivePortfolioSurface({ state: { holdings: [{ symbol: 'ABC', shares: 10, avgCost: 80, price: 110, dailyPct: 10 }], cash: 0 } });
  if (daily.dailyChange !== null || daily.dailyPct !== null) fail('portfolio-surface: non-envelope dailyPct must not enter aggregate daily return');
  const missingCost = derivePortfolioSurface({ state: { holdings: [{ symbol: 'ABC', shares: 10, avgCost: null, price: 110 }], cash: 0, totals: { totalCost: 0, totalPnl: 1100, totalPnlPct: 100 } } });
  if (missingCost.totalPnl !== null || missingCost.totalPnlPct !== null) fail('portfolio-surface: unknown cost became a gain');
  const staleTotals = derivePortfolioSurface({ state: { holdings: [{ symbol: 'ABC', shares: 10, avgCost: 80, price: 100, dailyPct: 99 }], cash: 100, totals: { totalValue: 1000, totalAssets: 1100, totalCost: 800, dailyChange: 999, totalPnlPct: 25 } }, liveData: { ABC: currentQuote(200, { pct: 0 }) }, now: quoteNow });
  if (staleTotals.positionValue !== 2000 || staleTotals.totalAssets !== 2100 || staleTotals.totalPnlPct !== 150 || staleTotals.dailyChange !== 0 || Math.abs(staleTotals.sectorBreakdown.reduce((sum, row) => sum + row.pct, 0) - 100) > 1e-9) fail('portfolio-surface: stored aggregate or daily return overrode current row valuation');
  const stalePartial = derivePortfolioSurface({ state: { holdings: [{ symbol: 'ABC', shares: 10 }], cash: 100, totals: { totalValue: 1000, totalAssets: 1100 } } });
  if (stalePartial.totalAssets !== null || stalePartial.exposurePct !== null) fail('portfolio-surface: incomplete rows reused stale totals');
  const invalidPortfolio = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'BAD', shares: -2, avgCost: -10 }], cash: -5 }, liveData: { BAD: { price: 12 } }, vix: -1 });

  const unprovenRuntime = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10, price: 11 }], cash: 0 }, liveData: { ABC: { price: 99, pct: 4 }, '^VIX': { price: 40 } }, vix: { price: 40 }, now: quoteNow });
  if (unprovenRuntime.rows[0]?.price !== 11 || unprovenRuntime.rows[0]?.sourceKind !== 'portfolio-state' || unprovenRuntime.exposureCap !== null || unprovenRuntime.vix !== null) throw new Error('portfolio surface must not promote undated/source-less runtime prices or VIX');
  const staleRuntime = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10, price: 11 }], cash: 0 }, liveData: { ABC: { price: 99, observedAt: '2026-09-12T13:00:00Z', source: 'runtime-test-provider' } }, vix: { price: 40, observedAt: '2026-09-12T14:55:00Z', source: 'snapshot:last-known-good' }, now: quoteNow });
  if (staleRuntime.rows[0]?.price !== 11 || staleRuntime.sourceKind !== 'portfolio-state' || staleRuntime.exposureCap !== null) throw new Error('portfolio surface must reject stale quotes and snapshot VIX as current runtime evidence');
  if (invalidPortfolio.positionValue !== null || invalidPortfolio.cash !== null || invalidPortfolio.exposureCap !== null || invalidPortfolio.exposurePolicyStatus !== 'reference-only') fail(`portfolio-surface: invalid balances or VIX entered the portfolio projection, got ${JSON.stringify(invalidPortfolio)}`);
  // W02/P1143: cash-only reads as total=cash, partial never sums unknown rows as zero.
  const cashOnly = derivePortfolioSurface({ state: { readState: 'ready', holdingsKnown: true, holdings: [], cash: 10000, cashKnown: true }, liveData: {}, vix: null });
  if (cashOnly.modelVersion !== 'portfolio-surface.v3' || cashOnly.valuationState !== 'cash-only' || cashOnly.positionValue !== 0 || cashOnly.totalAssets !== 10000 || cashOnly.cashPct !== 100 || cashOnly.status !== 'current') fail(`W02/P1143 portfolio-surface: cash-only must read total=cash, got ${JSON.stringify(cashOnly)}`);
  const lockedCash = derivePortfolioSurface({ state: { readState: 'locked', holdings: [], cash: 10000 }, liveData: {}, vix: null });
  if (lockedCash.totalAssets === 0 || lockedCash.totalAssets === 10000 || lockedCash.valuationState !== 'unavailable') fail(`W02/P1143 portfolio-surface: locked/failed must never read as $0 or cash, got ${JSON.stringify(lockedCash)}`);
  const w02Partial = derivePortfolioSurface({ state: { readState: 'ready', holdingsKnown: true, status: 'current', holdings: [{ symbol: 'AAA', shares: 1, avgCost: 10 }, { symbol: 'BBB', shares: 1, avgCost: 10 }], cash: 100, cashKnown: true }, liveData: { AAA: currentQuote(12, { pct: 2 }) }, vix: currentQuote(22), now: quoteNow });
  if (w02Partial.valuationState !== 'partial' || w02Partial.totalAssets !== null || w02Partial.valuedHoldingCount !== 1) fail(`W02/P1143 portfolio-surface: partial must withhold totals with n/m state, got ${JSON.stringify(w02Partial)}`);
  // W02/P1143: the provider read result is the only source. An explicitly empty Vault
  // read must stay empty instead of falling back to a stored copy, a real 0 cash must
  // survive, and locked/failed reads must reach the surface without a valuation.
  const { createPortfolioProvider } = await load('src/data/providers/portfolio.js');
  const emptyRead = createPortfolioProvider({ read: () => ({ holdings: [], holdingsKnown: true, cash: 0, cashKnown: true, readState: 'ready', status: 'empty' }) }).readCurrent();
  if (!emptyRead.holdingsKnown || emptyRead.holdings.length !== 0 || emptyRead.cash !== 0 || emptyRead.readState !== 'ready') fail(`W02/P1143 portfolio-provider: an explicit empty read was not preserved, got ${JSON.stringify(emptyRead)}`);
  const lockedRead = createPortfolioProvider({ read: () => ({ holdings: [], holdingsKnown: false, cash: null, cashKnown: false, readState: 'locked', status: 'locked' }) }).readCurrent();
  const lockedSurface = derivePortfolioSurface({ state: lockedRead, liveData: {}, vix: null });
  if (lockedSurface.readState !== 'locked' || lockedSurface.totalAssets !== null) fail(`W02/P1143 portfolio-provider: locked read leaked a valuation, got ${JSON.stringify(lockedSurface)}`);

  // P1175 (11 P11-02): 통화는 합산의 단위다. 100 USD와 70000 KRW를 환산 근거 없이 더해 complete라고
  // 말하지 않는다. 반대 방향(같은 통화)은 그대로 합산되어야 하므로 검사가 판별력을 갖는다.
  const mixedCurrency = derivePortfolioSurface({
    state: { readState: 'ready', holdingsKnown: true, status: 'current', cash: 0, cashKnown: true, holdings: [
      { symbol: 'AAA', shares: 1, avgCost: 90, price: 100, currency: 'USD' },
      { symbol: 'BBB', shares: 1, avgCost: 60000, price: 70000, currency: 'KRW' }
    ] },
    liveData: {}, vix: null
  });
  if (mixedCurrency.totalAssets !== null || mixedCurrency.positionValue !== null
    || mixedCurrency.valuationState === 'complete' || mixedCurrency.currencyState !== 'mixed-without-conversion'
    || mixedCurrency.currencyBasis !== 'mixed' || mixedCurrency.baseCurrency !== null
    || mixedCurrency.declaredCurrencies.join(',') !== 'USD,KRW') {
    fail(`P1175/P11-02 portfolio-surface: mixed currencies were summed into one complete valuation, got ${JSON.stringify(mixedCurrency)}`);
  }
  if (mixedCurrency.totalPnl !== null || mixedCurrency.sectorBreakdown.length !== 0) fail(`P1175/P11-02 portfolio-surface: a mixed-currency portfolio still produced derived percentages, got ${JSON.stringify(mixedCurrency)}`);
  const singleCurrency = derivePortfolioSurface({
    state: { readState: 'ready', holdingsKnown: true, status: 'current', cash: 50, cashKnown: true, baseCurrency: 'USD', holdings: [
      { symbol: 'AAA', shares: 1, avgCost: 90, price: 100, currency: 'USD' },
      { symbol: 'BBB', shares: 2, avgCost: 10, price: 20, currency: 'USD' }
    ] },
    liveData: {}, vix: null
  });
  if (singleCurrency.totalAssets !== 190 || singleCurrency.valuationState !== 'complete'
    || singleCurrency.currencyState !== 'declared-single' || singleCurrency.baseCurrency !== 'USD') {
    fail(`P1175/P11-02 portfolio-surface: a declared single currency must still total, got ${JSON.stringify(singleCurrency)}`);
  }
  const undeclaredCurrency = derivePortfolioSurface({ state: { readState: 'ready', holdingsKnown: true, status: 'current', holdings: [{ symbol: 'AAA', shares: 1, avgCost: 90, price: 100 }], cash: 0, cashKnown: true }, liveData: {}, vix: null });
  if (undeclaredCurrency.totalAssets !== 100 || undeclaredCurrency.currencyState !== 'undeclared-single-basis-assumed' || undeclaredCurrency.baseCurrency !== null) {
    fail(`P1175/P11-02 portfolio-surface: an undeclared currency must keep single-basis behaviour and disclose the assumption, got ${JSON.stringify(undeclaredCurrency)}`);
  }
  const { normalizePortfolio } = await load('src/data/normalize/portfolio.js');
  const normalizedCurrency = normalizePortfolio({ baseCurrency: 'usd', cashCurrency: 'KRW', holdings: [{ symbol: 'AAA', shares: 1, currency: 'krw', costCurrency: 'usd' }] });
  if (normalizedCurrency.baseCurrency !== 'USD' || normalizedCurrency.cashCurrency !== 'KRW'
    || normalizedCurrency.holdings[0].currency !== 'KRW' || normalizedCurrency.holdings[0].costCurrency !== 'USD') {
    fail(`P1175/P11-02 normalize: the declared currency basis was dropped, got ${JSON.stringify(normalizedCurrency)}`);
  }
  if (normalizePortfolio({ holdings: [{ symbol: 'AAA', shares: 1 }] }).holdings[0].currency !== null) fail('P1175/P11-02 normalize: a missing currency was inferred instead of staying unknown');

  // P1176 (22 PFR01/PFR06): 목표가와 목표비중은 서로 다른 타입이다. legacy 입력은 빈 칸을 0으로
  // 직렬화했고(runtime reader의 `Number(null)===0`이 그 0을 보존), 표는 그것을 $0.00 + -100%
  // 잠재수익으로 그렸다. 0원 목표가는 의미가 없으므로 미설정이고, 0% 비중은 실제 값이다.
  const unsetTarget = normalizePortfolio({ holdings: [{ symbol: 'AAA', shares: 1, avgCost: 90, price: 100, target: 0 }] });
  if (unsetTarget.holdings[0].target !== null) fail(`P1176/PFR06 normalize: a legacy blank target (0) still read as a real price, got ${JSON.stringify(unsetTarget.holdings[0])}`);
  for (const blank of [null, undefined, NaN, '', 'abc', -5]) {
    if (normalizePortfolio({ holdings: [{ symbol: 'AAA', shares: 1, target: blank }] }).holdings[0].target !== null) fail(`P1176/PFR06 normalize: an absent/invalid price target (${String(blank)}) became a value`);
  }
  if (normalizePortfolio({ holdings: [{ symbol: 'AAA', shares: 1, target: 150 }] }).holdings[0].target !== 150) fail('P1176/PFR06 normalize: a real price target did not survive');
  const weightZero = normalizePortfolio({ holdings: [{ symbol: 'AAA', shares: 1, target: 0, targetWeight: 0 }] });
  if (weightZero.holdings[0].targetWeight !== 0 || weightZero.holdings[0].target !== null) {
    fail(`P1176/PFR01 normalize: an explicit 0% weight and an absent price target were conflated, got ${JSON.stringify(weightZero.holdings[0])}`);
  }
  if (normalizePortfolio({ holdings: [{ symbol: 'AAA', shares: 1, targetWeight: 150 }] }).holdings[0].targetWeight !== null) fail('P1176/PFR01 normalize: an out-of-range target weight became a value');

  const { createRuntimeReaders } = await load('src/data/runtime-readers.js');
  const legacyRead = createRuntimeReaders({
    root: { isPortfolioLocked: () => false, localStorage: { getItem: () => null }, getPortfolioData: () => [
      { ticker: 'AAA', qty: 1, cost: 90, target: 0 },
      { ticker: 'BBB', qty: 1, cost: 90, target: 25, targetWeight: 0 }
    ] },
    now: () => Date.parse('2026-09-22T00:00:00Z')
  }).readPortfolio();
  if (legacyRead.holdings[0]?.target !== null) fail(`P1176/PFR06 runtime-reader: Number(null)===0 resurrected the blank target, got ${JSON.stringify(legacyRead.holdings[0])}`);
  if (legacyRead.holdings[1]?.target !== 25 || legacyRead.holdings[1]?.targetWeight !== 0) {
    fail(`P1176/PFR01 runtime-reader: a real target or an explicit 0% weight was lost, got ${JSON.stringify(legacyRead.holdings[1])}`);
  }
  // P1176 (22 PFR01): 같은 값의 두 번째 read 경계 — compatibility facade도 `Number(null)===0`으로
  // 미설정을 0으로 만들고 있었다. 두 경로가 같은 값을 다르게 읽으면 소비자마다 화면이 갈린다.
  const { createLegacyFacade } = await load('src/legacy/compatibility-facade.js');
  const facadeRead = createLegacyFacade({ getPortfolioData: () => [{ ticker: 'AAA', qty: 1, cost: 90, target: 0 }, { ticker: 'BBB', qty: 1, cost: 90, target: 25 }] }, {}).readPortfolio();
  if (facadeRead.holdings[0]?.target !== null || facadeRead.holdings[1]?.target !== 25) {
    fail(`P1176/PFR01 legacy-facade: the facade resurrected a blank target while the runtime reader did not, got ${JSON.stringify(facadeRead.holdings.map((row) => [row.symbol, row.target]))}`);
  }

  // 22 단위 1 인수 fixture: 주식 100 + 현금 900의 주식 노출은 총자산 대비 10%다.
  const exposureFixture = derivePortfolioSurface({
    state: { readState: 'ready', holdingsKnown: true, holdings: [{ symbol: 'AAA', shares: 1, avgCost: 90, price: 100 }], cash: 900, cashKnown: true },
    liveData: {}, vix: null
  });
  if (exposureFixture.totalAssets !== 1000 || exposureFixture.positionValue !== 100
    || exposureFixture.exposurePct !== 10 || exposureFixture.cashPct !== 90 || exposureFixture.valuationState !== 'complete') {
    fail(`22/PFR01 portfolio-surface: equity exposure must be measured against total assets including cash, got ${JSON.stringify(exposureFixture)}`);
  }
}
// ── E3/P1181 — 23:PFR07 배분 정책 · 22:PFR08 누락 멤버 · 통화 체인 · durable ack ──────────────
// 무언 재배분(시장가치 폴백이 명시 제외를 되살림), 무환산 P&L(단위가 다른 뺄셈), 거짓 저장 완료를
// 각각 음성 fixture로 고정하고, 정상 경로(명시 100·단일 통화·persist 성공)를 양성 대조로 남긴다.
{
  const { buildPortfolioBacktestLab } = await load('src/domain/portfolio/backtest.js');
  const { createPortfolioProvider } = await load('src/data/providers/portfolio.js');
  const { normalizePortfolio } = await load('src/data/normalize/portfolio.js');
  const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');

  const e3MonthKeys = Array.from({ length: 15 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  const e3PriceMap = ({ drop = [], terminalA = null } = {}) => {
    const timestamps = e3MonthKeys.map((key) => `${key}-28T00:00:00Z`);
    const series = (fn) => ({ timestamps: [...timestamps], adjustedCloses: e3MonthKeys.map((_, index) => fn(index)), backtestEligible: true, backtestPriceBasis: 'adjusted-close' });
    const map = { AAA: series((i) => 100 + i * 10), BBB: series((i) => 100 - i), SPY: series(() => 100) };
    if (terminalA != null) map.AAA.adjustedCloses[map.AAA.adjustedCloses.length - 1] = terminalA;
    drop.forEach((ticker) => { delete map[ticker]; });
    return map;
  };
  const e3Positions = (weights) => [
    { ticker: 'AAA', qty: 1, cost: 100, ...(weights && weights[0] !== undefined ? { targetWeight: weights[0] } : {}) },
    { ticker: 'BBB', qty: 1, cost: 100, ...(weights && weights[1] !== undefined ? { targetWeight: weights[1] } : {}) }
  ];

  // [0,100] — A의 명시 제외가 결과까지 살아남는 양성 대조.
  const explicitRun = buildPortfolioBacktestLab(e3PriceMap(), e3Positions([0, 100]), {});
  if (explicitRun.ok !== true || explicitRun.settings?.targetWeightBasis !== 'explicit-target-weight'
    || explicitRun.weights?.AAA !== 0 || explicitRun.weights?.BBB !== 1) {
    fail(`P1181/23:PFR07 [0,100] must resolve as explicit with the exclusion preserved, got ${JSON.stringify({ ok: explicitRun.ok, basis: explicitRun.settings?.targetWeightBasis, weights: explicitRun.weights, reason: explicitRun.reason })}`);
  }
  // [0,0] — 합0은 현금 모드의 질문이지 폴백 트리거가 아니다. 거짓 provenance 없이 차단되어야 한다.
  const zeroRun = buildPortfolioBacktestLab(e3PriceMap(), e3Positions([0, 0]), {});
  if (zeroRun.ok !== false || zeroRun.reason !== 'explicit-zero-allocation'
    || zeroRun.allocationBlocked?.code !== 'explicit-zero-allocation' || zeroRun.targetWeightBasis !== undefined) {
    fail(`P1181/23:PFR07 [0,0] must block without a lying basis, got ${JSON.stringify({ ok: zeroRun.ok, reason: zeroRun.reason, blocked: zeroRun.allocationBlocked, basis: zeroRun.targetWeightBasis })}`);
  }
  // [0,null] — 제외(A=0)와 미지정(B)을 구분하고 미지정 멤버를 이름으로 안내한다.
  const partialRun = buildPortfolioBacktestLab(e3PriceMap(), e3Positions([0, null]), {});
  if (partialRun.ok !== false || partialRun.reason !== 'partial-allocation-unresolved'
    || !(partialRun.allocationBlocked?.unspecified || []).includes('BBB')
    || !(partialRun.warnings || []).join(' ').includes('BBB')) {
    fail(`P1181/23:PFR07 [0,null] must hold as partial with member guidance instead of renormalizing A back in, got ${JSON.stringify({ ok: partialRun.ok, reason: partialRun.reason, blocked: partialRun.allocationBlocked, warnings: partialRun.warnings })}`);
  }
  // 음수·과다합계는 비율로 눌러 정규화하지 않고 차단한다.
  const overRun = buildPortfolioBacktestLab(e3PriceMap(), e3Positions([60, 60]), {});
  if (overRun.ok !== false || overRun.reason !== 'invalid-allocation-sum') {
    fail(`P1181/23:PFR07 a sum above 100 must block, got ${JSON.stringify({ ok: overRun.ok, reason: overRun.reason })}`);
  }
  const negativeRun = buildPortfolioBacktestLab(e3PriceMap(), e3Positions([-10, 110]), {});
  if (negativeRun.ok !== false || negativeRun.allocationBlocked?.code !== 'partial-allocation-unresolved') {
    fail(`P1181/23:PFR07 a negative weight must block (its slot is not a valid declaration), got ${JSON.stringify({ ok: negativeRun.ok, reason: negativeRun.reason, blocked: negativeRun.allocationBlocked })}`);
  }
  // legacy(무게치 미입력) 폴백 — P1181 시점의 라벨은 'terminal-adjusted-close-market-value'였다.
  // E4/P1182(22:PFR01)가 종점 가격 폴백을 시작 시점 basis로 교체했으므로 라벨은 실제 실행된
  // 정책을 말해야 한다(라벨과 정책이 갈라지는 순간 이 fixture가 먼저 깨진다).
  const legacyRun = buildPortfolioBacktestLab(e3PriceMap(), e3Positions([undefined, undefined]), {});
  if (legacyRun.ok !== true || legacyRun.settings?.targetWeightBasis !== 'start-date-adjusted-close-market-value') {
    fail(`P1181/P1182/23:PFR07 the no-weight fallback must carry the policy it actually ran (start-date basis after E4), got ${JSON.stringify({ ok: legacyRun.ok, basis: legacyRun.settings?.targetWeightBasis, reason: legacyRun.reason })}`);
  }
  // 22:PFR08 — 가격 이력 없는 보유 멤버는 커버리지 공백이지 제외가 아니다.
  const missingRun = buildPortfolioBacktestLab(e3PriceMap({ drop: ['BBB'] }), e3Positions([50, 50]), {});
  if (missingRun.ok !== false || missingRun.reason !== 'member price series missing'
    || !(missingRun.allocationBlocked?.members || []).includes('BBB')
    || missingRun.weights !== undefined || missingRun.performance !== undefined) {
    fail(`P1181/22:PFR08 a missing member must block with intent preserved instead of AAA 100%, got ${JSON.stringify({ ok: missingRun.ok, reason: missingRun.reason, blocked: missingRun.allocationBlocked, weights: missingRun.weights })}`);
  }
  // P1252/BT-01 — 원가 미신고 보유(증여·스핀오프·이전 롯)는 시작 배분에서 조용히 제외되지 않는다.
  // qty>0·cost=null 멤버는 의도 목록(intendedTickers)에 남고 비중을 받는다 — 원가는 어떤 계산에도
  // 쓰이지 않고 공개 필드(missingCostMembers)로만 남는다.
  const costlessTimestamps = e3MonthKeys.map((key) => `${key}-28T00:00:00Z`);
  const costlessPriceMap = e3PriceMap();
  costlessPriceMap.CCC = {
    timestamps: [...costlessTimestamps],
    adjustedCloses: e3MonthKeys.map((_, index) => 100 + index * 10),
    backtestEligible: true, backtestPriceBasis: 'adjusted-close'
  };
  const costlessRun = buildPortfolioBacktestLab(costlessPriceMap, [
    { ticker: 'AAA', qty: 1, cost: 100 },
    { ticker: 'CCC', qty: 1, cost: null }
  ], {});
  if (costlessRun.ok !== true || !(costlessRun.intendedTickers || []).includes('CCC')
    || costlessRun.weights?.AAA !== 0.5 || costlessRun.weights?.CCC !== 0.5
    || !(costlessRun.missingCostMembers || []).includes('CCC')) {
    fail(`P1252/BT-01 a qty>0 cost=null member must stay intended and weighted instead of being silently dropped, got ${JSON.stringify({ ok: costlessRun.ok, intended: costlessRun.intendedTickers, weights: costlessRun.weights, missingCost: costlessRun.missingCostMembers, reason: costlessRun.reason })}`);
  }
  // 명시 배분의 시작 가격 불변 — 미래 종점 가격이 명시 배분을 옮기면 실패다.
  const invariantBase = buildPortfolioBacktestLab(e3PriceMap(), e3Positions([50, 50]), {});
  const invariantMoved = buildPortfolioBacktestLab(e3PriceMap({ terminalA: 99999 }), e3Positions([50, 50]), {});
  if (invariantBase.ok !== true || invariantMoved.ok !== true
    || JSON.stringify(invariantBase.weights) !== JSON.stringify(invariantMoved.weights)
    || invariantBase.performance?.startBalance !== invariantMoved.performance?.startBalance) {
    fail(`P1181/explicit-invariance: a terminal price change moved the explicit starting allocation, got ${JSON.stringify({ base: invariantBase.weights, moved: invariantMoved.weights })}`);
  }

  // ── P1247 (E3/E4): 랩의 통화축 — 통화 없는 합산 금지 ────────────────────────────────────────
  // 종전에는 비중의 분모가 `qty × 시작가`를 통화 구분 없이 더한 값이었다. KRW 멤버와 USD 멤버를 함께
  // 보유하면 그 합계는 성립하지 않는다. 선언된 관측 leg가 있으면 기준 통화로 환산하고, 없으면 보류한다.
  const { FX_LEG_MAX_AGE_MS: fxAxisMaxAgeMs } = await load('src/domain/portfolio/fx.js');
  const mixedPositions = (weights) => e3Positions(weights).map((p, index) => ({
    ...p, currency: index === 0 ? 'USD' : 'KRW', costCurrency: index === 0 ? 'USD' : 'KRW'
  }));
  const fxNow = Date.parse('2026-09-25T00:00:00Z');

  // 기준 통화 미선언 — 통화를 모르는 채 서로 다른 단위를 더하지 않는다.
  const noBaseRun = buildPortfolioBacktestLab(e3PriceMap(), mixedPositions([undefined, undefined]), { asOfMs: fxNow });
  if (noBaseRun.ok !== false || noBaseRun.reason !== 'base-currency-undeclared'
    || noBaseRun.currencyAxis?.basis !== 'mixed' || noBaseRun.weights !== undefined) {
    fail(`P1247 a mixed-currency composition without a declared base must hold, got ${JSON.stringify({ ok: noBaseRun.ok, reason: noBaseRun.reason, axis: noBaseRun.currencyAxis, weights: noBaseRun.weights })}`);
  }
  // 기준 통화 선언 + leg 없음 — 환산 근거가 없으므로 여전히 보류한다(1:1 합산 금지).
  const noLegRun = buildPortfolioBacktestLab(e3PriceMap(), mixedPositions([undefined, undefined]), { baseCurrency: 'USD', asOfMs: fxNow });
  if (noLegRun.ok !== false || noLegRun.reason !== 'fx-rate-not-declared'
    || noLegRun.allocationBlocked?.baseCurrency !== 'USD') {
    fail(`P1247 a mixed-currency composition with no declared leg must hold, got ${JSON.stringify({ ok: noLegRun.ok, reason: noLegRun.reason, blocked: noLegRun.allocationBlocked })}`);
  }
  // leg는 있으나 선언 창(72h)을 넘은 관측 — 컷 이후·만료 rate를 오늘의 환산 근거로 쓰지 않는다.
  const staleLegRun = buildPortfolioBacktestLab(e3PriceMap(), mixedPositions([undefined, undefined]), {
    baseCurrency: 'USD', asOfMs: fxNow,
    fxLegs: [{ from: 'KRW', to: 'USD', rate: 1 / 1350, observedAt: '2026-09-01T00:00:00Z' }]
  });
  if (staleLegRun.ok !== false || staleLegRun.reason !== 'fx-conversion-unavailable'
    || staleLegRun.allocationBlocked?.held?.[0]?.reason !== 'rate-stale'
    || staleLegRun.currencyAxis?.maxAgeMs !== fxAxisMaxAgeMs || staleLegRun.weights !== undefined) {
    fail(`P1247 a stale leg must hold the composition rather than convert, got ${JSON.stringify({ ok: staleLegRun.ok, reason: staleLegRun.reason, held: staleLegRun.allocationBlocked?.held, axis: staleLegRun.currencyAxis })}`);
  }
  // 양성 대조: 신선한 leg가 있으면 기준 통화로 환산한 비중을 만들고, 사용한 leg와 수익 기준을 발행한다.
  // KRW 100은 USD 100과 같지 않으므로 1:1 합산(50/50)이었다면 여기서 깨진다.
  const convertedRun = buildPortfolioBacktestLab(e3PriceMap(), mixedPositions([undefined, undefined]), {
    baseCurrency: 'USD', asOfMs: fxNow,
    fxLegs: [{ from: 'KRW', to: 'USD', rate: 1 / 1350, observedAt: '2026-09-24T00:00:00Z', source: 'test-leg' }]
  });
  if (convertedRun.ok !== true || convertedRun.currencyAxis?.applied !== true
    || convertedRun.currencyAxis?.legs?.[0]?.from !== 'KRW'
    || convertedRun.returnCurrencyBasis !== 'local-currency-weighted'
    || convertedRun.fxTranslation !== 'excluded-requires-fx-series'
    || !(convertedRun.weights?.BBB > 0) || !(convertedRun.weights?.BBB < 0.01)
    || !(convertedRun.weights?.AAA > 0.99)) {
    fail(`P1247 a fresh leg must convert the composition instead of summing KRW and USD 1:1, got ${JSON.stringify({ ok: convertedRun.ok, axis: convertedRun.currencyAxis, weights: convertedRun.weights, basis: convertedRun.returnCurrencyBasis })}`);
  }
  if (!(convertedRun.warnings || []).join(' ').includes('현지 통화')) {
    fail('P1247 a converted run must disclose that the return series is local-currency-weighted');
  }
  // P1252/BT-02 — 환산이 필요한데 멤버 통화가 미선언이면(시세·원가 통화 모두 없음) rate 1 암묵
  // 통과로 기준 통화로 눕히지 않는다 — 미확인 통화는 기준 통화(USD)라는 뜻이 아니므로 시작 배분
  // 전체를 'member-currency-undeclared'로 보류한다(추정 금지).
  const undeclaredMemberRun = buildPortfolioBacktestLab(e3PriceMap(), [
    { ticker: 'AAA', qty: 1, cost: 100, currency: 'KRW', costCurrency: 'KRW' },
    { ticker: 'BBB', qty: 1, cost: 100 }
  ], {
    baseCurrency: 'USD', asOfMs: fxNow,
    fxLegs: [{ from: 'KRW', to: 'USD', rate: 1 / 1350, observedAt: '2026-09-24T00:00:00Z', source: 'test-leg' }]
  });
  if (undeclaredMemberRun.ok !== false || undeclaredMemberRun.reason !== 'member-currency-undeclared'
    || undeclaredMemberRun.allocationBlocked?.code !== 'member-currency-undeclared'
    || !(undeclaredMemberRun.allocationBlocked?.members || []).includes('BBB')
    || undeclaredMemberRun.weights !== undefined) {
    fail(`P1252/BT-02 an undeclared member currency must hold the whole start allocation instead of silently becoming the base currency, got ${JSON.stringify({ ok: undeclaredMemberRun.ok, reason: undeclaredMemberRun.reason, blocked: undeclaredMemberRun.allocationBlocked, weights: undeclaredMemberRun.weights })}`);
  }
  // 단일 통화(선언 없음)는 종전과 같다 — 환산도, 수익 기준 변경도 없다.
  const singleRun = buildPortfolioBacktestLab(e3PriceMap(), e3Positions([50, 50]), { asOfMs: fxNow });
  if (singleRun.ok !== true || singleRun.currencyAxis?.applied !== false
    || singleRun.currencyAxis?.basis !== 'undeclared'
    || singleRun.returnCurrencyBasis !== 'single-currency' || singleRun.fxTranslation !== 'not-applicable') {
    fail(`P1247 an undeclared single-currency run must keep the existing behaviour, got ${JSON.stringify({ ok: singleRun.ok, axis: singleRun.currencyAxis, basis: singleRun.returnCurrencyBasis })}`);
  }

  // 명시 목표비중은 단위 없는 비율이므로 혼합 통화여도 환산 없이 성립한다 — 필요하지 않은 곳에서 막지 않는다.
  const explicitMixedRun = buildPortfolioBacktestLab(e3PriceMap(), mixedPositions([50, 50]), { baseCurrency: 'USD', asOfMs: fxNow });
  if (explicitMixedRun.ok !== true || explicitMixedRun.settings?.targetWeightBasis !== 'explicit-target-weight'
    || explicitMixedRun.weights?.AAA !== 0.5 || explicitMixedRun.currencyAxis?.applied !== false
    || explicitMixedRun.returnCurrencyBasis !== 'local-currency-weighted') {
    fail(`P1247 explicit target weights are unitless and must not be held for a missing leg, got ${JSON.stringify({ ok: explicitMixedRun.ok, reason: explicitMixedRun.reason, basis: explicitMixedRun.settings?.targetWeightBasis, weights: explicitMixedRun.weights, axis: explicitMixedRun.currencyAxis })}`);
  }

  // ── P1259 (QA-FX-SERIES): 기준 통화 수익률 — 월말 FX 정렬 + 두 결과의 라벨·수치 대조 ─────────
  // 같은 입력에서 현지 통화 결과와 기준 통화 결과를 함께 발행하고 라벨을 분리한다. 월말 정렬 계약:
  // 월 키의 **마지막 관측**만 쓰고(월 중간 관측 무시), 관측이 없는 달 경계는 보류한다(추정 금지).
  const fxFlat = (flat) => ({
    timestamps: e3MonthKeys.map((k) => `${k}-28T00:00:00Z`),
    adjustedCloses: e3MonthKeys.map(() => flat), backtestEligible: true, backtestPriceBasis: 'adjusted-close'
  });
  const krwFlatMap = { AAA: fxFlat(100), SPY: fxFlat(100) };
  const krwFlatPositions = [{ ticker: 'AAA', qty: 1, cost: 100, currency: 'KRW', costCurrency: 'KRW' }];
  // usdkrw: 2024-01에 1200 → 2024-02에 1320(원화 10% 절하). 2024-02 중간(14일)에 99999라는
  // 비현실 관측을 두어 월말 정렬이 그것을 쓰지 않는지 검증하고, 2024-03은 관측을 비운다.
  const fxTimestamps = e3MonthKeys.map((k, i) => (i === 2 ? null : `${k}-28T00:00:00Z`)).filter(Boolean).concat('2024-02-14T00:00:00Z');
  const fxCloses = e3MonthKeys.map((_, i) => (i === 2 ? null : 1200 + i * 120)).filter((v) => v != null).concat(99999);
  const fxOptions = {
    baseCurrency: 'USD', asOfMs: fxNow,
    fxLegs: [{ from: 'KRW', to: 'USD', rate: 1 / 1350, observedAt: '2026-09-24T00:00:00Z', source: 'test-leg' }],
    fxSeries: { usdkrw: { timestamps: fxTimestamps, closes: fxCloses } }
  };
  const fxRun = buildPortfolioBacktestLab(krwFlatMap, krwFlatPositions, fxOptions);
  const bcr = fxRun.baseCurrencyReturns || {};
  const firstMonth = (bcr.months || [])[0] || {};
  // 현지 통화 월 수익률은 평평한 가격에서 0이고, 기준 통화(USD) 결과는 환율 움직임(-9.09%)을 먹는다 —
  // 두 결과는 같은 입력에서 다른 수로 발행되어야 한다.
  const expectedKrwToUsd = (1200 / 1320) - 1;
  const month2 = (bcr.months || [])[1] || {};
  const month3 = (bcr.months || [])[2] || {};
  if (fxRun.ok !== true || fxRun.returnCurrencyBasis !== 'local-currency-weighted'
    || bcr.returnCurrencyBasis !== 'base-currency-month-end-fx' || bcr.label == null
    || bcr.returnCurrencyBasis === fxRun.returnCurrencyBasis
    || Math.abs(firstMonth.return - expectedKrwToUsd) > 1e-9
    || firstMonth.return === 0
    || (firstMonth.fxUsed || [])[0]?.value !== 1320 || (firstMonth.fxUsed || [])[0]?.observedAt !== '2024-02-28'
    || month2.return !== null || month2.held !== 'fx-month-observation-missing:2024-03'
    || month3.return !== null || month3.held !== 'fx-month-observation-missing:2024-03') {
    fail(`P1259 the base-currency series must align to month-end observations and differ from the local series, got ${JSON.stringify({ ok: fxRun.ok, local: fxRun.returnCurrencyBasis, base: bcr, first: firstMonth, m2: month2, m3: month3, expected: expectedKrwToUsd })}`);
  }
  // 월 중간 관측(99999)이 쓰였다면 첫 달 환산이 -98%대가 됐을 것이다 — 위 수치 대조가 이를 고정한다.
  // FX 시계열이 아예 없으면 기준 통화 결과를 보류하고 추정하지 않는다.
  const fxSerieslessRun = buildPortfolioBacktestLab(krwFlatMap, krwFlatPositions, {
    baseCurrency: 'USD', asOfMs: fxNow,
    fxLegs: [{ from: 'KRW', to: 'USD', rate: 1 / 1350, observedAt: '2026-09-24T00:00:00Z', source: 'test-leg' }]
  });
  if (fxSerieslessRun.baseCurrencyReturns?.status !== 'held'
    || fxSerieslessRun.baseCurrencyReturns?.reason !== 'fx-series-missing'
    || (fxSerieslessRun.baseCurrencyReturns?.months || []).length !== 0) {
    fail(`P1259 without an observed FX series the base-currency result must hold instead of estimating, got ${JSON.stringify(fxSerieslessRun.baseCurrencyReturns)}`);
  }

  // 통화 체인 reader→provider→normalize: 선언이 어느 계층에서도 지워지지 않는다.
  const readerShaped = {
    holdings: [
      { symbol: 'AAA', shares: 1, avgCost: 90, price: 110, currency: 'USD', costCurrency: 'USD', target: 150, targetWeight: 0 },
      { symbol: '005930', shares: 1, avgCost: 70000, price: 71000, currency: 'KRW', costCurrency: 'KRW' }
    ],
    holdingsKnown: true, cash: 500, cashKnown: true, baseCurrency: 'USD', cashCurrency: 'USD',
    readState: 'ready', status: 'current', updatedAt: '2026-09-23T00:00:00.000Z'
  };
  const chained = normalizePortfolio(createPortfolioProvider({ read: () => readerShaped }).readCurrent());
  if (chained.baseCurrency !== 'USD' || chained.cashCurrency !== 'USD'
    || chained.holdings[0]?.currency !== 'USD' || chained.holdings[0]?.costCurrency !== 'USD'
    || chained.holdings[0]?.target !== 150 || chained.holdings[0]?.targetWeight !== 0
    || chained.holdings[1]?.currency !== 'KRW') {
    fail(`P1181/11 P11-02 the currency chain dropped a declaration, got ${JSON.stringify({ base: chained.baseCurrency, cashCurrency: chained.cashCurrency, rows: chained.holdings.map((row) => [row.symbol, row.currency, row.costCurrency, row.target, row.targetWeight]) })}`);
  }
  // USD+KRW 선언 → 합계 보류(무환산 P&L 금지).
  const mixedSurface = derivePortfolioSurface({ state: chained, liveData: {}, vix: null });
  if (mixedSurface.currencyState !== 'mixed-without-conversion' || mixedSurface.positionValue !== null
    || mixedSurface.totalAssets !== null || mixedSurface.totalPnl !== null || mixedSurface.totalCost !== null) {
    fail(`P1181/11 P11-02 declared USD+KRW must hold every aggregate instead of summing units, got ${JSON.stringify({ currencyState: mixedSurface.currencyState, positionValue: mixedSurface.positionValue, totalAssets: mixedSurface.totalAssets, totalCost: mixedSurface.totalCost, totalPnl: mixedSurface.totalPnl })}`);
  }
  // 원가/시세 통화 불일치(단일 기준 portfolio에서도) → P&L만 보류. 대조: 일치하면 계산된다.
  const mismatchInput = {
    holdings: [{ symbol: 'AAA', shares: 1, avgCost: 90, price: 110, currency: 'USD', costCurrency: 'KRW' }],
    holdingsKnown: true, cash: 500, cashKnown: true, cashCurrency: 'USD', readState: 'ready', status: 'current'
  };
  const mismatchSurface = derivePortfolioSurface({ state: normalizePortfolio(createPortfolioProvider({ read: () => mismatchInput }).readCurrent()), liveData: {}, vix: null });
  if (mismatchSurface.costCurrencyState !== 'cost-price-mismatch-held' || mismatchSurface.totalCost !== null || mismatchSurface.totalPnl !== null) {
    fail(`P1181/11 P11-02 a KRW cost against a USD price must hold the P&L, got ${JSON.stringify({ costCurrencyState: mismatchSurface.costCurrencyState, totalCost: mismatchSurface.totalCost, totalPnl: mismatchSurface.totalPnl })}`);
  }
  const alignedInput = { ...mismatchInput, holdings: [{ ...mismatchInput.holdings[0], costCurrency: 'USD' }] };
  const alignedSurface = derivePortfolioSurface({ state: normalizePortfolio(createPortfolioProvider({ read: () => alignedInput }).readCurrent()), liveData: {}, vix: null });
  if (alignedSurface.costCurrencyState !== 'cost-declared' || alignedSurface.totalCost !== 90 || alignedSurface.totalPnl !== 20) {
    fail(`P1181/11 P11-02 an aligned cost basis must still compute (positive control), got ${JSON.stringify({ costCurrencyState: alignedSurface.costCurrencyState, totalCost: alignedSurface.totalCost, totalPnl: alignedSurface.totalPnl })}`);
  }

  // 11 P11-01 durable ack — 소스 계약: 완료 알림은 persist 결과 뒤에만 온다.
  const workspaceSource = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  if (!/return persist\.then\(/.test(workspaceSource)) fail('P1181/11 P11-01 savePortfolioData must return the durable acknowledgement');
  if (!/async function addPortfolioPosition\(/.test(workspaceSource)) fail('P1181/11 P11-01 the add path must await the acknowledgement');
  if (!/showToast\(saved\.ok|if \(saved\.ok\)/.test(workspaceSource) || !/영구 저장 실패/.test(workspaceSource)) {
    fail('P1181/11 P11-01 the completion toast must be gated on the save result with an explicit failure message');
  }

  // ── E3/P1187 — 통화 writer · import/전체삭제 ack ────────────────────────────────
  // 통화를 선언할 writer가 없으면 선언은 import로만 들어오고(11 P11-02), 통째 교체하는 수정 경로는
  // 그 선언을 지우며, 반환을 버리는 경로는 persist 거부에도 완료를 말한다(P11-01의 미커버 경로).
  const indexSource = readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!/id="pf-add-cost-currency"/.test(indexSource)) {
    fail('P1187/11 P11-02 the portfolio form must expose a cost-currency declaration input');
  }
  if (!/pf-add-cost-currency/.test(workspaceSource) || !/costCurrency, addedAt/.test(workspaceSource)) {
    fail('P1187/11 P11-02 the add path must persist the declared cost currency');
  }
  if (!/\.\.\.positions\[existing\]/.test(workspaceSource)) {
    fail('P1187 the update path must preserve non-form fields instead of replacing the position object');
  }
  if (!/await savePortfolioData\(data\)/.test(workspaceSource) || !/가져오기가 확정되지 않았습니다/.test(workspaceSource)) {
    fail('P1187/11 P11-01 the import path must gate completion on the durable acknowledgement');
  }
  if (!/await savePortfolioData\(\[\]\)/.test(workspaceSource) || !/전체 삭제가 확정되지 않았습니다/.test(workspaceSource)) {
    fail('P1187/11 P11-01 clear-all must gate confirmation on the durable acknowledgement');
  }
}
// ── E4/P1182 — 22:PFR01 시작 배분 종점 불변 · 22:PFR05 표본·꼬리 인증 보류 ·
//               22:PFR02/03/09 범위·현금·RF 선언 · 22:PFR10 구성 스냅샷 · 계좌 원장 보류 ─────────
// 미래 종점 가격이 과거(시작) 배분을 움직이면 안 되고, 선언 없는 RF·분모·꼬리 표본은 인증되지
// 않는다. 원장 없는 account TWR/MWR는 보류가 정답이다 — 없는 것을 있는 척 만들지 않는다.
{
  const { buildPortfolioBacktestLab } = await load('src/domain/portfolio/backtest.js');
  const { createCompositionSnapshot, deriveRiskEstimate, assessAccountPerformance } = await load('src/domain/portfolio/risk.js');

  const e4MonthKeys = Array.from({ length: 15 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  const e4Series = (fn) => ({
    timestamps: e4MonthKeys.map((key) => `${key}-28T00:00:00Z`),
    adjustedCloses: e4MonthKeys.map((_, index) => fn(index)),
    backtestEligible: true, backtestPriceBasis: 'adjusted-close'
  });
  const e4PriceMap = ({ terminalA = null } = {}) => {
    const map = { AAA: e4Series((i) => 100 + i * 10), BBB: e4Series((i) => 100 - i), SPY: e4Series(() => 100) };
    if (terminalA != null) map.AAA.adjustedCloses[map.AAA.adjustedCloses.length - 1] = terminalA;
    return map;
  };
  const e4Positions = [{ ticker: 'AAA', qty: 1, cost: 100 }, { ticker: 'BBB', qty: 1, cost: 100 }];

  // 22:PFR01 — 무게치 미입력 폴백의 시작 배분은 미래 종점 가격에 불변해야 한다.
  // 시작 가격이 같으므로(100/100) 50/50이어야 하고, 종점 가격을 바꿔도 배분·잔액이 그대로여야 한다.
  const startBase = buildPortfolioBacktestLab(e4PriceMap(), e4Positions, {});
  const startMoved = buildPortfolioBacktestLab(e4PriceMap({ terminalA: 99999 }), e4Positions, {});
  if (startBase.ok !== true || startBase.settings?.targetWeightBasis !== 'start-date-adjusted-close-market-value'
    || startBase.weights?.AAA !== 0.5 || startBase.weights?.BBB !== 0.5
    || JSON.stringify(startBase.weights) !== JSON.stringify(startMoved.weights)
    || startBase.performance?.startBalance !== startMoved.performance?.startBalance) {
    fail(`P1182/22:PFR01 the start allocation must derive from the first month and stay invariant to the terminal price, got ${JSON.stringify({ ok: startBase.ok, basis: startBase.settings?.targetWeightBasis, baseWeights: startBase.weights, movedWeights: startMoved.weights, baseStart: startBase.performance?.startBalance, movedStart: startMoved.performance?.startBalance })}`);
  }

  // 22:PFR05 — 13수익률(14개월)·꼬리 1개의 5% VaR/CVaR는 인증될 수 없다.
  // 표본·꼬리 수를 결과에 노출하고 certification을 held로 고정한다.
  const tailPrices = [100, 80];
  for (let i = 1; i < 13; i += 1) tailPrices.push(80 * Math.pow(1.01, i));
  const tailKeys = Array.from({ length: 14 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  const tailTimestamps = tailKeys.map((key) => `${key}-28T00:00:00Z`);
  const tailRun = buildPortfolioBacktestLab({
    AAA: { timestamps: tailTimestamps, adjustedCloses: tailPrices, backtestEligible: true, backtestPriceBasis: 'adjusted-close' },
    SPY: { timestamps: tailTimestamps, adjustedCloses: tailTimestamps.map(() => 100), backtestEligible: true, backtestPriceBasis: 'adjusted-close' }
  }, [{ ticker: 'AAA', qty: 1, cost: 100, targetWeight: 100 }], {});
  const vc = tailRun.performance?.varCertification;
  if (tailRun.ok !== true || !vc || vc.sampleN !== 13 || vc.tailN !== 1 || vc.certification !== 'held'
    || Math.abs((tailRun.performance?.historicalVar5 ?? 1) - 0.074) > 1e-9
    || Math.abs((tailRun.performance?.conditionalVar5 ?? 1) - 0.2) > 1e-9) {
    fail(`P1182/22:PFR05 a 13-return/1-tail sample must publish its facts and HOLD certification, got ${JSON.stringify({ ok: tailRun.ok, vc, var5: tailRun.performance?.historicalVar5, cvar5: tailRun.performance?.conditionalVar5 })}`);
  }

  // 22:PFR02/PFR09 — cash 50 / equity 50, equity −10%, cash 0%(명시) → 계좌 전체 −5%, 주식 부분 −10%.
  // 같은 수치가 두 scope 제목으로 나뉘고, RF 없이는 estimate가 보류를 선언한다.
  const scopeSnapshot = createCompositionSnapshot({
    members: [{ ticker: 'AAA', qty: 1, price: 50, priceObservedAt: '2026-09-23T00:00:00.000Z', priceSource: 'fixture' }],
    cash: { amount: 50, currency: 'USD' },
    asOf: '2026-09-23T00:00:00.000Z',
    weightBasis: 'whole_account',
    baseCurrency: 'USD'
  });
  const scopeInput = {
    snapshot: scopeSnapshot,
    returnsMap: { AAA: [-0.10] },
    cashReturn: { mode: 'explicit_assumption', annualRate: 0 },
    rfAnnual: null,
    exposureHistoryMode: 'current_composition_retrospective',
    rebalancePolicy: 'daily',
    sampleDates: ['2026-09-22']
  };
  const scopeEstimate = deriveRiskEstimate(scopeInput);
  if (scopeSnapshot.status !== 'ready' || scopeSnapshot.members[0]?.resolvedWeight !== 0.5 || scopeSnapshot.cashWeight !== 0.5
    || scopeEstimate.status !== 'ready'
    || Math.abs((scopeEstimate.wholeAccountReturns?.[0] ?? 1) + 0.05) > 1e-12
    || Math.abs((scopeEstimate.investedSleeveReturns?.[0] ?? 1) + 0.10) > 1e-12
    || scopeEstimate.publishedScope !== 'whole_account'
    || scopeEstimate.rf?.status !== 'not-supplied'
    || scopeEstimate.exposureHistoryMode !== 'current_composition_retrospective'
    // P1197: `rebalancePolicy`는 **적용된** 값이다 — 회고 경로는 정책을 소비하지 않으므로 null이고,
    // 선언은 `rebalancePolicyDeclared`로 따로 발행된다(소비되지 않는 선언이 정체성을 바꾸지 않는다).
    || scopeEstimate.rebalancePolicy !== null || scopeEstimate.rebalancePolicyDeclared !== 'daily'
    || scopeEstimate.rebalancePolicyApplied !== false) {
    fail(`P1182/22:PFR02/PFR09 whole-account −5% and invested-sleeve −10% must publish as distinct declared scopes, got ${JSON.stringify({ snapStatus: scopeSnapshot.status, snapWeight: scopeSnapshot.members[0]?.resolvedWeight, cashWeight: scopeSnapshot.cashWeight, est: { status: scopeEstimate.status, whole: scopeEstimate.wholeAccountReturns, sleeve: scopeEstimate.investedSleeveReturns, scope: scopeEstimate.publishedScope, rf: scopeEstimate.rf, mode: scopeEstimate.exposureHistoryMode, rebalance: scopeEstimate.rebalancePolicy } })}`);
  }
  // 같은 입력 → 같은 estimateId (replay). RF만 바꿔도 계산 입력이 갈라진다(양성 대조).
  const scopeReplay = deriveRiskEstimate(scopeInput);
  const scopeWithRf = deriveRiskEstimate({ ...scopeInput, rfAnnual: 0.03 });
  if (scopeReplay.estimateId !== scopeEstimate.estimateId || scopeWithRf.estimateId === scopeEstimate.estimateId) {
    fail(`P1182/22:PFR09 estimate identity must replay on identical inputs and split on a changed RF input, got ${JSON.stringify({ base: scopeEstimate.estimateId, replay: scopeReplay.estimateId, withRf: scopeWithRf.estimateId })}`);
  }
  // 현금 통화 미선언 → 계좌 전체 보류, 주식 부분만 게시(무언 축소 금지).
  const sleeveSnapshot = createCompositionSnapshot({
    members: [{ ticker: 'AAA', qty: 1, price: 50 }],
    cash: { amount: 50, currency: null },
    asOf: '2026-09-23T00:00:00.000Z',
    weightBasis: 'invested_sleeve',
    baseCurrency: null
  });
  const heldEstimate = deriveRiskEstimate({ ...scopeInput, snapshot: sleeveSnapshot, cashReturn: { mode: 'unresolved' } });
  if (sleeveSnapshot.status !== 'limited' || !sleeveSnapshot.issues.includes('cash-currency-unverified')
    || heldEstimate.publishedScope !== 'invested_sleeve'
    || heldEstimate.wholeAccountReturns !== null
    || heldEstimate.wholeAccountHold !== 'cash-declaration-unresolved'
    || Math.abs((heldEstimate.investedSleeveReturns?.[0] ?? 1) + 0.10) > 1e-12) {
    fail(`P1182/22:PFR02 undeclared cash must hold the whole-account view instead of vanishing into a sleeve denominator, got ${JSON.stringify({ snapStatus: sleeveSnapshot.status, issues: sleeveSnapshot.issues, scope: heldEstimate.publishedScope, whole: heldEstimate.wholeAccountReturns, hold: heldEstimate.wholeAccountHold, sleeve: heldEstimate.investedSleeveReturns })}`);
  }
  // actual_account_history는 보유 이력이 없다면 차단 — 현재 수량을 과거로 복사하지 않는다.
  const actualBlocked = deriveRiskEstimate({ ...scopeInput, exposureHistoryMode: 'actual_account_history' });
  if (actualBlocked.status !== 'blocked' || actualBlocked.code !== 'account-history-unavailable') {
    fail(`P1182/22:PFR09 an actual-account-history claim without holdings history must block, got ${JSON.stringify(actualBlocked)}`);
  }

  // 22:PFR10 — 구성 스냅샷은 입력에서 파생된 ID로 재현되고, 멤버 가격이 없으면 비중 없이 차단된다.
  const snapshotInput = {
    members: [{ ticker: 'AAA', qty: 2, price: 50, priceObservedAt: '2026-09-23T00:00:00.000Z', priceSource: 'fixture' }],
    cash: { amount: 0, currency: null },
    asOf: '2026-09-23T00:00:00.000Z',
    weightBasis: 'whole_account',
    baseCurrency: null
  };
  const snapA = createCompositionSnapshot(snapshotInput);
  const snapReplay = createCompositionSnapshot(snapshotInput);
  const snapPriceMoved = createCompositionSnapshot({
    ...snapshotInput,
    members: [{ ...snapshotInput.members[0], price: 51 }]
  });
  const snapBlocked = createCompositionSnapshot({
    ...snapshotInput,
    members: [{ ...snapshotInput.members[0], price: null }]
  });
  if (snapA.status !== 'ready' || snapA.compositionSnapshotId !== snapReplay.compositionSnapshotId
    || snapPriceMoved.compositionSnapshotId === snapA.compositionSnapshotId
    || snapA.members[0]?.resolvedWeight !== 1
    || snapBlocked.status !== 'blocked' || snapBlocked.blocked?.code !== 'member-price-missing'
    || snapBlocked.members[0]?.resolvedWeight !== undefined) {
    fail(`P1182/22:PFR10 the composition snapshot must replay on identical inputs, split on a price move, and block without a member price, got ${JSON.stringify({ a: snapA.compositionSnapshotId, replay: snapReplay.compositionSnapshotId, moved: snapPriceMoved.compositionSnapshotId, blocked: snapBlocked })}`);
  }

  // 계좌 성과 — 원장 없이 TWR/MWR를 만들지 않는다.
  const noLedger = assessAccountPerformance({ ledger: null });
  const emptyLedger = assessAccountPerformance({ ledger: { transactions: [] } });
  if (noLedger.status !== 'blocked' || noLedger.code !== 'ledger-not-available' || noLedger.twr !== null || noLedger.mwr !== null
    || emptyLedger.status !== 'blocked' || emptyLedger.code !== 'ledger-not-available') {
    fail(`P1182/account-performance without a ledger must hold TWR/MWR, got ${JSON.stringify({ noLedger, emptyLedger })}`);
  }

  // 소스 계약 — 패널의 선언·표시가 코드에 실제로 존재한다.
  // P1258: 위험 입력 조립(스냅샷·returnsMap·estimate 호출)이 src/ui/panels/portfolio-risk-input.js로
  // 분해됐다 — 계약은 코드의 새 소유자를 따라간다: 선언 기본값·추정 호출은 모듈, lineage 문구는 셸.
  const e4WorkspaceSource = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  const e4RiskInputSource = readFileSync(path.join(root, 'src/ui/panels/portfolio-risk-input.js'), 'utf8');
  if (/0\.043/.test(e4WorkspaceSource)) fail('P1182/22:PFR03 the risk panel must not carry a hidden fixed RF assumption (0.043) any more');
  if (!/RF 미입력 — 보류/.test(e4WorkspaceSource)) fail('P1182/22:PFR03 the panel must publish the withheld-RF state instead of a bare dash');
  if (!/current_composition_retrospective/.test(e4RiskInputSource) || !/legacy-risk-path/.test(e4WorkspaceSource)) {
    fail('P1182/22:PFR09 the panel must declare its exposure path and legacy-risk-path lineage');
  }
  if (!/createCompositionSnapshot/.test(e4RiskInputSource) || !/deriveRiskEstimate/.test(e4RiskInputSource) || !/_pfAssembleRiskEstimateInput/.test(e4WorkspaceSource)) {
    fail('P1182/22:PFR10 the panel must read weights through the frozen composition snapshot');
  }
  const e4HtmlSource = readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!/현재 구성 소급\(과거 적용\) 참고도/.test(e4HtmlSource) || !/선형 추정/.test(e4HtmlSource) || !/raw close/.test(e4HtmlSource)) {
    fail('P1182/22:PFR04 the benchmark chart must disclose retrospective basis, raw close and linear interpolation');
  }
  if (!/TWR\/MWR/.test(e4HtmlSource) || !/원장/.test(e4HtmlSource)) {
    fail('P1182/account-performance the risk surface must state the ledger hold before any computation runs');
  }
  if (!/교육 예시 기준/.test(e4HtmlSource)) {
    fail('P1182/22 universal Sharpe/MDD/drift rules must be labeled as education examples, not advice');
  }
}
// ── E3/E4/P1188 — 11 P11-02 계좌·현금 통화·수익률 선언 writer · 22 계좌 성과 TWR/MWR ·
//                  전략 경로(fixed_target_weight_strategy) ───────────────────────────────
// 통화·수익률은 입력이지 추정값이 아니다(빈 선언→보류). 계좌 성과는 원장·규약·평가액이 모두
// 선언될 때만 계산하고(무언 0 금지), 고정 목표비중 전략 경로는 목표비중·리밸런싱 정책을 요구한다.
{
  const { createCompositionSnapshot, deriveRiskEstimate, assessAccountPerformance } = await load('src/domain/portfolio/risk.js');
  const { readPortfolioAssumptions, normalizeCurrencyCode, normalizeAnnualRate, PORTFOLIO_ASSUMPTION_KEYS } = await load('src/data/portfolio-assumptions.js');

  // 선언 정규화 — 부재·무효는 null이고 0으로 승격되지 않는다.
  if (normalizeCurrencyCode('usd') !== 'USD' || normalizeCurrencyCode('US') !== null || normalizeCurrencyCode('') !== null
    || normalizeAnnualRate('4') !== 0.04 || normalizeAnnualRate('') !== null || normalizeAnnualRate('abc') !== null
    || normalizeAnnualRate('200') !== null) {
    fail(`P1188/11 P11-02 currency/rate declarations must normalize or stay absent, got ${JSON.stringify({ ccy: normalizeCurrencyCode('usd'), short: normalizeCurrencyCode('US'), rate: normalizeAnnualRate('4'), bad: normalizeAnnualRate('abc'), outOfRange: normalizeAnnualRate('200') })}`);
  }
  const declaredAssumptions = readPortfolioAssumptions({ getItem: (key) => ({ [PORTFOLIO_ASSUMPTION_KEYS.baseCurrency]: 'usd', [PORTFOLIO_ASSUMPTION_KEYS.cashCurrency]: 'KRW', [PORTFOLIO_ASSUMPTION_KEYS.cashReturn]: '4', [PORTFOLIO_ASSUMPTION_KEYS.riskFreeRate]: '3' })[key] });
  if (declaredAssumptions.baseCurrency !== 'USD' || declaredAssumptions.cashCurrency !== 'KRW'
    || declaredAssumptions.cashReturn !== 0.04 || declaredAssumptions.riskFreeRate !== 0.03) {
    fail(`P1188/11 P11-02 the reader must surface every declared assumption, got ${JSON.stringify(declaredAssumptions)}`);
  }
  const undeclaredAssumptions = readPortfolioAssumptions({ getItem: () => null });
  if (undeclaredAssumptions.baseCurrency !== null || undeclaredAssumptions.cashCurrency !== null
    || undeclaredAssumptions.cashReturn !== null || undeclaredAssumptions.riskFreeRate !== null) {
    fail(`P1188/11 P11-02 an empty storage must read as undeclared, never inferred, got ${JSON.stringify(undeclaredAssumptions)}`);
  }

  // 전략 경로 — 고정 목표비중. daily 리밸런싱은 매 bar 목표비중을 적용한다(+5% = 0.5·10%).
  const strategySnapshot = createCompositionSnapshot({
    members: [{ ticker: 'AAA', qty: 1, price: 100, priceObservedAt: '2026-09-24T00:00:00.000Z', priceSource: 'fixture' },
      { ticker: 'BBB', qty: 1, price: 100, priceObservedAt: '2026-09-24T00:00:00.000Z', priceSource: 'fixture' }],
    cash: { amount: 0, currency: null }, asOf: '2026-09-24T00:00:00.000Z', weightBasis: 'whole_account', baseCurrency: null
  });
  const strategyInput = {
    snapshot: strategySnapshot, targetWeights: { AAA: 0.5, BBB: 0.5 },
    exposureHistoryMode: 'fixed_target_weight_strategy', rebalancePolicy: 'daily',
    sampleDates: ['2026-09-01', '2026-09-02'], rfAnnual: null
  };
  const strategyDaily = deriveRiskEstimate({ ...strategyInput, returnsMap: { AAA: [0.10, 0.10], BBB: [0, 0] } });
  if (strategyDaily.status !== 'ready' || Math.abs(strategyDaily.investedSleeveReturns[0] - 0.05) > 1e-12
    || Math.abs(strategyDaily.investedSleeveReturns[1] - 0.05) > 1e-12
    || strategyDaily.publishedScope !== 'invested_sleeve'
    || strategyDaily.wholeAccountReturns !== null || strategyDaily.wholeAccountHold !== 'strategy-account-scope-not-declared'
    || strategyDaily.pathLineage !== 'fixed-target-weight-strategy' || strategyDaily.strategy?.targetWeights?.AAA !== 0.5) {
    fail(`P1188/fixed-target-weight-strategy a daily-rebalanced 50/50 of +10%/+0% must publish a +5% sleeve and hold the account scope, got ${JSON.stringify({ status: strategyDaily.status, sleeve: strategyDaily.investedSleeveReturns, scope: strategyDaily.publishedScope, hold: strategyDaily.wholeAccountHold, lineage: strategyDaily.pathLineage })}`);
  }
  // buy-and-hold는 가중치가 표류한다 — AAA가 2배가 되면 둘째 bar의 AAA 기여가 2/3이 된다(양성 대조).
  const strategyHold = deriveRiskEstimate({ ...strategyInput, rebalancePolicy: 'buy-and-hold', returnsMap: { AAA: [1.0, 0], BBB: [0, 0] } });
  if (strategyHold.status !== 'ready' || Math.abs(strategyHold.investedSleeveReturns[0] - 0.5) > 1e-12 || Math.abs(strategyHold.investedSleeveReturns[1]) > 1e-12) {
    fail(`P1188/fixed-target-weight-strategy buy-and-hold must drift the weights, got ${JSON.stringify(strategyHold.investedSleeveReturns)}`);
  }
  // P1200: 부분 목표비중은 이제 **현금 몫**이다(합 100% 미만 = 계좌 범위 선언). 무효는 초과 배분이다.
  const strategyPartialSum = deriveRiskEstimate({ ...strategyInput, targetWeights: { AAA: 0.5, BBB: 0.4 }, returnsMap: { AAA: [0.1, 0.1], BBB: [0, 0] } });
  const strategyOverSum = deriveRiskEstimate({ ...strategyInput, targetWeights: { AAA: 0.7, BBB: 0.5 }, returnsMap: { AAA: [0.1, 0.1], BBB: [0, 0] } });
  const strategyNoWindow = deriveRiskEstimate({ ...strategyInput, rebalancePolicy: 'monthly', sampleDates: undefined, returnsMap: { AAA: [0.1], BBB: [0] } });
  if (strategyPartialSum.status !== 'ready' || Math.abs(strategyPartialSum.strategy.cashWeight - 0.1) > 1e-9
    || strategyOverSum.status !== 'blocked' || strategyOverSum.code !== 'strategy-target-weights-invalid'
    || strategyNoWindow.status !== 'blocked' || strategyNoWindow.code !== 'strategy-rebalance-window-required') {
    fail(`P1188/P1200 a sub-100% target must read as a cash remainder, an over-allocation must block, and an unbounded periodic rebalance must block, got ${JSON.stringify({ partial: { status: strategyPartialSum.status, cash: strategyPartialSum.strategy && strategyPartialSum.strategy.cashWeight }, over: strategyOverSum.code, noWindow: strategyNoWindow.code })}`);
  }

  // 계좌 성과 — 원장·규약·평가액이 모두 선언될 때만 TWR/MWR를 계산한다.
  const ledgerCoverage = ['trades', 'deposits-withdrawals', 'dividends-splits', 'fees-taxes', 'fx', 'valuation-cuts']
    .reduce((acc, name) => ({ ...acc, [name]: true }), {});
  const ledgerBase = { currency: 'USD', dayCount: 'actual-365', flowTiming: 'end-of-period', coverage: ledgerCoverage };
  const flatPerf = assessAccountPerformance({ ledger: { ...ledgerBase, transactions: [{ date: '2026-03-01', kind: 'trade', amount: 0 }], valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2026-07-01', amount: 110 }, { date: '2027-01-01', amount: 121 }] } });
  if (flatPerf.status !== 'ready' || Math.abs(flatPerf.twr - 0.21) > 1e-9 || Math.abs(flatPerf.mwr - 0.21) > 1e-9
    || flatPerf.currency !== 'USD' || flatPerf.flowTiming !== 'end-of-period' || flatPerf.periods.length !== 2
    || flatPerf.conventions?.returnBasis !== 'time-weighted-subperiod-chain') {
    fail(`P1188/account-performance a two-period 100→110→121 ledger with no flows must publish TWR=MWR=0.21, got ${JSON.stringify({ status: flatPerf.status, twr: flatPerf.twr, mwr: flatPerf.mwr, periods: flatPerf.periods?.length, conventions: flatPerf.conventions })}`);
  }
  // 흐름 시점 규약이 TWR을 바꾼다: 같은 원장에서 end-of-period 0.10 vs start-of-period 1/15.
  const flowLedger = { ...ledgerBase, transactions: [{ date: '2026-06-30', kind: 'deposit', amount: 50 }], valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2027-01-01', amount: 160 }] };
  const flowEnd = assessAccountPerformance({ ledger: flowLedger });
  const flowStart = assessAccountPerformance({ ledger: { ...flowLedger, flowTiming: 'start-of-period' } });
  if (flowEnd.status !== 'ready' || Math.abs(flowEnd.twr - 0.10) > 1e-9 || flowEnd.mwr == null
    || flowStart.status !== 'ready' || Math.abs(flowStart.twr - 1 / 15) > 1e-9
    || Math.abs(flowEnd.twr - flowStart.twr) < 1e-6) {
    fail(`P1188/account-performance the declared flow timing must change the TWR (deposit at a boundary), got ${JSON.stringify({ end: flowEnd.twr, start: flowStart.twr, mwr: flowEnd.mwr })}`);
  }
  // 각 미선언 입력은 자기 사유로 보류한다 — 계산 불가를 0으로 만들지 않는다.
  const holds = [
    ['account-input-incomplete', { ...ledgerBase, coverage: {}, valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2026-07-01', amount: 110 }] }],
    ['account-convention-required', { ...ledgerBase, currency: null, valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2026-07-01', amount: 110 }] }],
    ['account-valuation-marks-required', { ...ledgerBase, valuations: [{ date: '2026-01-01', amount: 100 }] }],
    ['account-valuation-marks-unordered', { ...ledgerBase, valuations: [{ date: '2026-07-01', amount: 110 }, { date: '2026-01-01', amount: 100 }] }],
    ['account-ledger-kind-unrecognized', { ...ledgerBase, transactions: [{ date: '2026-03-01', kind: 'mystery', amount: 1 }], valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2026-07-01', amount: 110 }] }]
  ];
  holds.forEach(([code, ledger]) => {
    const held = assessAccountPerformance({ ledger: { transactions: [{ date: '2026-03-01', kind: 'trade', amount: 0 }], ...ledger } });
    if (held.status !== 'blocked' || held.code !== code || held.twr !== null || held.mwr !== null) {
      fail(`P1188/account-performance a declared-missing account input must hold with its own reason, expected ${code}, got ${JSON.stringify({ status: held.status, code: held.code, twr: held.twr, mwr: held.mwr })}`);
    }
  });

  // 소스 계약 — writer/reader 두 끝이 실제로 존재하고 같은 키를 쓴다(R632).
  const p1188Index = readFileSync(path.join(root, 'index.html'), 'utf8');
  ['pf-base-currency-input', 'pf-cash-currency-input', 'pf-cash-return-input', 'pf-rf-input'].forEach((id) => {
    if (!p1188Index.includes(`id="${id}"`) || !/data-on-change="_aioSavePortfolioAssumption"/.test(p1188Index)) {
      fail(`P1188/11 P11-02 the risk surface must expose the ${id} declaration input`);
    }
  });
  const p1188Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  if (!/function savePortfolioAssumption\(/.test(p1188Workspace) || !/readPortfolioAssumptionDeclarations\(\)/.test(p1188Workspace)) {
    fail('P1188/11 P11-02 the classic shell must own the assumption writer and read its own declarations');
  }
  // P1258: 위험 입력 조립이 네이티브 모듈로 분해됐다 — 선언 전달 계약은 모듈이, 셸은 브리지 배선이 소유한다.
  const p1188RiskInput = readFileSync(path.join(root, 'src/ui/panels/portfolio-risk-input.js'), 'utf8');
  if (!/cash: \{ amount: cashAmount, currency: decl\.cashCurrency \}/.test(p1188RiskInput)
    || !/baseCurrency: decl\.baseCurrency/.test(p1188RiskInput)
    || !/cashReturn: decl\.cashReturn != null/.test(p1188RiskInput)
    || !/rfAnnual: decl\.riskFreeRate/.test(p1188RiskInput)) {
    fail('P1188/11 P11-02 the risk path must pass the declared currency/return/RF instead of nulls');
  }
  if (!/cashValue: cashValue/.test(p1188Workspace) || !/declarations: declarations/.test(p1188Workspace)) {
    fail('P1188/11 P11-02 the shell must hand its declarations to the assembled risk input');
  }
  const p1188Bootstrap = readFileSync(path.join(root, 'src/app/bootstrap.js'), 'utf8');
  if (!/window\._pfPortfolioAssumptions = \{ keys: PORTFOLIO_ASSUMPTION_KEYS/.test(p1188Bootstrap)) {
    fail('P1188/11 P11-02 bootstrap must expose the shared assumption keys/normalizers to the writer');
  }
  const p1188Readers = readFileSync(path.join(root, 'src/data/runtime-readers.js'), 'utf8');
  if (!/readPortfolioAssumptions\(root\?\.localStorage\)/.test(p1188Readers)) {
    fail('P1188/11 P11-02 runtime-readers must read the declared account/cash currency');
  }
}
// ── E4/P1190 — 22:PFR05 표본 안정성 bootstrap·민감도 검증 ───────────────────────────────
// 인증은 표본이 안정적이고 추정량 선택에 둔감할 때만 준다. 부트스트랩은 표본에서 시드를
// 파생해 재현되고(시계·난수 없음), 민감도는 같은 표본에 다른 규칙을 적용한 편차를 잰다.
// 임계값은 결과와 함께 선언되며, 조이면 같은 표본이 다시 보류된다(양성 대조).
{
  const { deriveVarStability, buildPortfolioBacktestLab } = await load('src/domain/portfolio/backtest.js');
  const stableSample = Array.from({ length: 120 }, (_, i) => 0.008 + Math.sin(i / 7) * 0.02 + ((i * 37) % 11 - 5) / 500);
  stableSample[40] = -0.12;
  stableSample[41] = -0.08;
  // P1243: a time-ordered sample must declare (or be verified for) its order before the `recent-half`
  // variant is computed, so the fixture declares the chronological contract it is built with.
  const certified = deriveVarStability({ returns: stableSample, iterations: 400, order: 'chronological' });
  const certifiedReplay = deriveVarStability({ returns: stableSample, iterations: 400, order: 'chronological' });
  if (certified.status !== 'ready' || certified.certification !== 'certified' || certified.certificationReasons.length !== 0
    || certified.sampleN !== 120 || !(certified.tailN >= 3)
    || certified.bootstrap?.seed !== 'sample-derived-fnv1a' || certified.bootstrap.iterations !== 400
    || certified.bootstrap.band?.p05 == null || !(certified.bootstrap.band.p05 <= certified.bootstrap.band.median && certified.bootstrap.band.median <= certified.bootstrap.band.p95)
    || !(certified.bootstrap.relativeBand <= certified.thresholds.maxRelativeBand)
    || !(certified.sensitivity.relativeSensitivity <= certified.thresholds.maxRelativeSensitivity)
    || JSON.stringify(certified.bootstrap.band) !== JSON.stringify(certifiedReplay.bootstrap.band)
    || certified.sensitivity.variants.length !== 3
    || certified.sensitivity.recentHalfOrder !== 'declared'
    || !certified.sensitivity.variants.some((variant) => variant.id === 'leave-one-worst-out')
    || !certified.sensitivity.variants.some((variant) => variant.id === 'recent-half')
    || !certified.sensitivity.variants.some((variant) => variant.id === 'nearest-rank')) {
    fail(`P1190/22:PFR05 a stable 120-observation sample must certify with a replayed bootstrap band and three sensitivity variants, got ${JSON.stringify({ status: certified.status, cert: certified.certification, band: certified.bootstrap?.band, relBand: certified.bootstrap?.relativeBand, sens: certified.sensitivity, reasons: certified.certificationReasons })}`);
  }
  // P1243: the `recent-half` variant must not run on an unverified sample order. An undeclared order
  // withholds the variant and holds certification; dated observations upgrade it to `verified`, and a
  // non-monotonic sample is `violated`.
  const undeclaredOrder = deriveVarStability({ returns: stableSample, iterations: 400 });
  if (undeclaredOrder.sensitivity.recentHalfOrder !== 'undeclared'
    || undeclaredOrder.sensitivity.variants.some((variant) => variant.id === 'recent-half')
    || undeclaredOrder.certification !== 'held'
    || !undeclaredOrder.certificationReasons.includes('recent-half-order-undeclared')) {
    fail(`P1243 var-order: an undeclared sample order must withhold the recent-half variant, got ${JSON.stringify({ order: undeclaredOrder.sensitivity.recentHalfOrder, variants: undeclaredOrder.sensitivity.variants.map((v) => v.id), cert: undeclaredOrder.certification, reasons: undeclaredOrder.certificationReasons })}`);
  }
  const monthlyStamps = stableSample.map((_, index) => Date.UTC(2016, index, 1));
  const verifiedOrder = deriveVarStability({ returns: stableSample, iterations: 400, observedAt: monthlyStamps });
  if (verifiedOrder.sensitivity.recentHalfOrder !== 'verified'
    || !verifiedOrder.sensitivity.variants.some((variant) => variant.id === 'recent-half')) {
    fail(`P1243 var-order: a non-decreasing dated sample must verify the order, got ${JSON.stringify({ order: verifiedOrder.sensitivity.recentHalfOrder, variants: verifiedOrder.sensitivity.variants.map((v) => v.id) })}`);
  }
  const unorderedStamps = monthlyStamps.slice();
  [unorderedStamps[10], unorderedStamps[20]] = [unorderedStamps[20], unorderedStamps[10]];
  const violatedOrder = deriveVarStability({ returns: stableSample, iterations: 400, observedAt: unorderedStamps });
  if (violatedOrder.sensitivity.recentHalfOrder !== 'violated'
    || violatedOrder.sensitivity.variants.some((variant) => variant.id === 'recent-half')
    || violatedOrder.certification !== 'held'
    || !violatedOrder.certificationReasons.includes('recent-half-order-violated')) {
    fail(`P1243 var-order: a non-monotonic dated sample must fail the order contract, got ${JSON.stringify({ order: violatedOrder.sensitivity.recentHalfOrder, variants: violatedOrder.sensitivity.variants.map((v) => v.id), cert: violatedOrder.certification, reasons: violatedOrder.certificationReasons })}`);
  }
  const smallSample = deriveVarStability({ returns: [0.02, -0.01, 0.03, -0.02, 0.01, -0.05, 0.04, -0.03, 0.02, 0.01, -0.02, 0.03, -0.08], iterations: 400, order: 'chronological' });
  if (smallSample.status !== 'ready' || smallSample.certification !== 'held'
    || !smallSample.certificationReasons.includes('sample-below-declared-minimum')
    || !smallSample.certificationReasons.includes('tail-below-declared-minimum')
    || deriveVarStability({ returns: [] }).status !== 'unavailable'
    || deriveVarStability({ returns: [0.01] }).certification !== 'held') {
    fail(`P1190/22:PFR05 a 13-return/single-tail sample must hold with its declared reasons, got ${JSON.stringify({ status: smallSample.status, cert: smallSample.certification, reasons: smallSample.certificationReasons })}`);
  }
  const tightened = deriveVarStability({ returns: stableSample, iterations: 400, thresholds: { maxRelativeBand: 0.1 } });
  if (tightened.certification !== 'held' || !tightened.certificationReasons.includes('bootstrap-band-exceeds-declared-maximum')) {
    fail(`P1190/22:PFR05 tightening the declared band must re-hold the same sample, got ${JSON.stringify({ cert: tightened.certification, reasons: tightened.certificationReasons })}`);
  }
  const e4Months = Array.from({ length: 14 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  const stabilityRun = buildPortfolioBacktestLab({
    AAA: { timestamps: e4Months.map((key) => `${key}-28T00:00:00Z`), adjustedCloses: e4Months.map((_, i) => 100 + (i % 3) - 1), backtestEligible: true, backtestPriceBasis: 'adjusted-close' },
    SPY: { timestamps: e4Months.map((key) => `${key}-28T00:00:00Z`), adjustedCloses: e4Months.map(() => 100), backtestEligible: true, backtestPriceBasis: 'adjusted-close' }
  }, [{ ticker: 'AAA', qty: 1, cost: 100, targetWeight: 100 }], {});
  const stabilityCert = stabilityRun.performance?.varCertification;
  if (stabilityRun.ok !== true || stabilityCert?.certification !== 'held' || stabilityCert?.stability?.sampleN !== 13
    || !Array.isArray(stabilityCert?.stability?.certificationReasons)
    || !stabilityCert.stability.certificationReasons.includes('sample-below-declared-minimum')) {
    fail(`P1190/22:PFR05 the backtest must publish the stability facts beside the held certification, got ${JSON.stringify({ ok: stabilityRun.ok, vc: stabilityCert })}`);
  }
}
// ── E4/P1191 — 계좌 원장 입력 → TWR/MWR (writer·engine 배선) ─────────────────────────────
// 원장을 선언할 입력 경로가 없으면 엔진은 영원히 '원장 없음'으로 보류한다. 폼이 쓰는 모양의
// 원장이 그대로 계약을 통과해 TWR/MWR를 내는지, 셀렉터·패널이 그 판정을 소비하는지 고정한다.
{
  const { assessAccountPerformance } = await load('src/domain/portfolio/risk.js');
  const { LEDGER_COVERAGE_INPUTS, appendLedgerTransaction, appendLedgerValuation, ledgerCoverageState, normalizeLedger, removeLedgerEntry, setLedgerCoverage, setLedgerFlowTiming } = await load('src/data/portfolio-ledger.js');
  // 원장 계약은 브라우저 없이 단위로 검증한다 — 셸은 DOM과 Vault 쓰기만 맡는다.
  const grownTx = appendLedgerTransaction(null, { date: '2026-06-30', kind: 'deposit', amount: 50 });
  const grownV2 = appendLedgerValuation(grownTx.ledger, { date: '2027-01-01', amount: 160 });
  const grown = appendLedgerValuation(grownV2.ledger, { date: '2026-01-01', amount: 100 });
  const grownAgain = appendLedgerValuation(grown.ledger, { date: '2026-01-01', amount: 111 });
  if (grown.ok !== true || grown.ledger.transactions.length !== 1 || grown.ledger.valuations.length !== 2
    || grown.ledger.valuations.map((mark) => mark.date).join(',') !== '2026-01-01,2027-01-01'
    || grownAgain.ledger.valuations.length !== 2 || grownAgain.ledger.valuations[0].amount !== 111) {
    fail(`P1191/E4 the ledger must append, order and keep one valuation per date, got ${JSON.stringify({ grown: grown.ledger, again: grownAgain.ledger.valuations })}`);
  }
  // 형태를 잘못 넘긴 호출은 빈 원장으로 위장하지 않고 거부된다(계약 오용 감지).
  if (normalizeLedger({ ok: true, reason: null }) !== null || normalizeLedger({}) !== null) {
    fail('P1191/E4 a non-ledger object must not normalize into an empty ledger');
  }
  const badEntry = appendLedgerTransaction(null, { date: '2026-06-30', kind: 'deposit', amount: 0 });
  const badKind = appendLedgerTransaction(null, { date: '2026-06-30', kind: 'mystery', amount: 10 });
  if (badEntry.ok !== false || badEntry.reason !== 'invalid-ledger-entry' || badKind.ok !== false || badKind.reason !== 'invalid-ledger-kind') {
    fail(`P1191/E4 an unpriceable or unknown-kind ledger entry must be rejected, got ${JSON.stringify({ badEntry, badKind })}`);
  }
  // 정규화는 저장된 원장을 신뢰하지 않는다 — 날짜/금액이 없는 항목은 0으로 승격하지 않고 버린다.
  const dirty = normalizeLedger({ currency: 'usd', flowTiming: 'start-of-period', coverage: { trades: true, fx: 'yes' }, transactions: [{ date: '2026-06-30', kind: 'deposit', amount: 50 }, { date: 'nope', kind: 'deposit', amount: 10 }, { date: '2026-07-01', kind: 'withdrawal', amount: null }], valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2026-02-01' }] });
  if (dirty.currency !== 'USD' || dirty.flowTiming !== 'start-of-period' || dirty.transactions.length !== 1 || dirty.valuations.length !== 1
    || dirty.coverage.trades !== true || 'fx' in dirty.coverage || normalizeLedger([]) !== null || normalizeLedger(null) !== null) {
    fail(`P1191/E4 normalize must drop undated/unpriced entries and only declared coverage, got ${JSON.stringify(dirty)}`);
  }
  const declaredAll = LEDGER_COVERAGE_INPUTS.reduce((acc, entry) => setLedgerCoverage(acc, entry.id, true).ledger, null);
  const removed = removeLedgerEntry(declaredAll, 'transaction', 0);
  const undeclared = setLedgerCoverage(declaredAll, 'fx', false);
  const timing = setLedgerFlowTiming(declaredAll, 'start-of-period');
  if (ledgerCoverageState(declaredAll).complete !== true || ledgerCoverageState(undeclared.ledger).complete !== false
    || ledgerCoverageState(undeclared.ledger).missing.join(',') !== 'fx'
    || ledgerCoverageState(null).complete !== false || ledgerCoverageState(null).inputs.length !== LEDGER_COVERAGE_INPUTS.length
    || timing.ledger.flowTiming !== 'start-of-period'
    || setLedgerCoverage(declaredAll, 'mystery', true).ok !== false) {
    fail(`P1191/E4 the coverage declaration must be per-input and traceable, got ${JSON.stringify({ complete: ledgerCoverageState(declaredAll).complete, missing: ledgerCoverageState(undeclared.ledger).missing, timing: timing.ledger.flowTiming })}`);
  }
  if (removed.ok !== false || removed.reason !== 'invalid-ledger-index') {
    fail(`P1191/E4 removing a missing ledger entry must fail instead of silently succeeding, got ${JSON.stringify(removed)}`);
  }
  const p1191Index = readFileSync(path.join(root, 'index.html'), 'utf8');
  const p1191Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  const p1191Readers = readFileSync(path.join(root, 'src/data/runtime-readers.js'), 'utf8');
  ['pf-ledger-section', 'pf-ledger-flow-timing', 'pf-ledger-coverage', 'pf-ledger-kind', 'pf-ledger-date', 'pf-ledger-amount', 'pf-ledger-valuation-date', 'pf-ledger-valuation-amount', 'pf-ledger-list', 'pf-ledger-status'].forEach((id) => {
    if (!p1191Index.includes(`id="${id}"`)) fail(`P1191/E4 the ledger surface must expose ${id}`);
  });
  if (!/data-action="_aioAddLedgerEntry"/.test(p1191Index) || !/data-action="_aioAddLedgerValuation"/.test(p1191Index) || !/data-on-change="_aioSaveLedgerConvention"/.test(p1191Index)) {
    fail('P1191/E4 the ledger surface must wire its add/valuation/convention handlers through the delegates');
  }
  // P1199: 저장 *형태*(읽기 규칙·ack 분리)는 네이티브 모듈로 갔지만, 저장 *정책*은 셸이 계속 소유한다 —
  // safeLS ack 경로와 Vault 동기 캐시를 주입하는 주체가 셸이어야 한다.
  if (!/function getPortfolioLedger\(/.test(p1191Workspace) || !/function savePortfolioLedger\(/.test(p1191Workspace)
    || !/function _pfDeclarations\(\)/.test(p1191Workspace) || !/function _pfVaultRuntime\(\)/.test(p1191Workspace)
    || !/secureSet: function\(key, json\) \{/.test(p1191Workspace) || !/safeLS\(key, json\)/.test(p1191Workspace)
    || !/getRuntimeCache: _pfVaultRuntime/.test(p1191Workspace)
    || !/function savePortfolioLedger\(ledger\) \{ return _pfDeclarationWrite\(PF_LEDGER_KEY/.test(p1191Workspace)
    || !/window\._aioAddLedgerEntry = /.test(p1191Workspace)
    || !/window\._aioRemoveLedgerEntry = /.test(p1191Workspace) || !/window\._aioSetLedgerCoverage = /.test(p1191Workspace)
    || !/function _pfLedgerApi\(\)/.test(p1191Workspace)) {
    fail('P1191/E4 the classic shell must own the ledger writer through the Vault path, delegate the contract, and expose every handler');
  }
  if (!/window\._pfPortfolioLedger = \{/.test(readFileSync(path.join(root, 'src/app/bootstrap.js'), 'utf8'))) {
    fail('P1191/E4 bootstrap must expose the ledger contract to the shell');
  }
  if (!/ledger: accountLedger/.test(p1191Workspace) || !/status === 'ready'/.test(p1191Workspace)) {
    fail('P1191/E4 the risk path must pass the declared ledger and render the ready account performance');
  }
  if (!/clone\(root\.getPortfolioLedger\(\)\)/.test(p1191Readers)) {
    fail('P1191/E4 runtime-readers must pass the declared ledger through');
  }
  if (!/_aioBtVarCertLabel\(p\.varCertification\)/.test(p1191Workspace) || !/function _aioBtVarCertLabel\(/.test(p1191Workspace)) {
    fail('P1190/E4 the lab must render the actual VaR certification instead of a hard-coded hold label');
  }
  const uiLedger = {
    currency: 'USD',
    dayCount: 'actual-365',
    flowTiming: 'end-of-period',
    coverage: { trades: true, 'deposits-withdrawals': true, 'dividends-splits': true, 'fees-taxes': true, fx: true, 'valuation-cuts': true },
    transactions: [{ date: '2026-06-30', kind: 'deposit', amount: 50 }],
    valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2027-01-01', amount: 160 }]
  };
  const uiPerf = assessAccountPerformance({ ledger: uiLedger });
  if (uiPerf.status !== 'ready' || Math.abs(uiPerf.twr - 0.10) > 1e-9 || uiPerf.mwr == null || uiPerf.currency !== 'USD') {
    fail(`P1191/E4 the ledger shape the form writes must produce a ready account performance, got ${JSON.stringify({ status: uiPerf.status, code: uiPerf.code, twr: uiPerf.twr, mwr: uiPerf.mwr })}`);
  }
  const partialPerf = assessAccountPerformance({ ledger: { ...uiLedger, coverage: { ...uiLedger.coverage, fx: false } } });
  if (partialPerf.status !== 'blocked' || partialPerf.code !== 'account-input-incomplete') {
    fail(`P1191/E4 dropping a declared ledger input must hold the same ledger, got ${JSON.stringify({ status: partialPerf.status, code: partialPerf.code })}`);
  }
}
// ── E4/P1193 — 측정 경로·리밸런싱 정책 선언 ────────────────────────────────────────────────
// 경로와 정책도 선언 입력이다. 열거형 선언은 정규화가 기본값으로 되돌리고(모르는 값이 전략 주장이
// 되지 않게), 셸은 포지션의 목표비중(%)이 합 100%일 때만 전략 경로로 넘긴다.
{
  const { EXPOSURE_PATHS, REBALANCE_POLICIES, PORTFOLIO_ASSUMPTION_KEYS, normalizeExposurePath, normalizeRebalancePolicy, readPortfolioAssumptions } = await load('src/data/portfolio-assumptions.js');
  // P1198: 열거형도 미선언·미인식은 null이고 기본값을 지어내지 않는다(P1193의 'fallback to default'를
  // 대체). 인식 불가 여부는 read가 `unrecognized`로 발행한다 — 미선언과 구분해 말할 수 있어야 한다.
  const assumptionRead = readPortfolioAssumptions({ getItem: (key) => (key === PORTFOLIO_ASSUMPTION_KEYS.rebalancePolicy ? 'weekly' : null) });
  if (normalizeExposurePath('fixed_target_weight_strategy') !== 'fixed_target_weight_strategy'
    || normalizeExposurePath('current_composition_retrospective') !== 'current_composition_retrospective'
    || normalizeExposurePath('strategy') !== null || normalizeExposurePath(null) !== null || normalizeExposurePath('') !== null
    || normalizeRebalancePolicy('buy-and-hold') !== 'buy-and-hold' || normalizeRebalancePolicy('monthly') !== 'monthly'
    || normalizeRebalancePolicy('weekly') !== null || normalizeRebalancePolicy('') !== null || normalizeRebalancePolicy(null) !== null
    || assumptionRead.rebalancePolicy !== null || assumptionRead.unrecognized.rebalancePolicy !== true
    || assumptionRead.unrecognized.exposurePath !== false || assumptionRead.exposurePath !== null) {
    fail(`P1198 an undeclared or unrecognized enum must stay null and be reported as unrecognized, got ${JSON.stringify({ path: normalizeExposurePath('strategy'), policy: normalizeRebalancePolicy('weekly'), blank: normalizeRebalancePolicy(''), read: { policy: assumptionRead.rebalancePolicy, unrecognized: assumptionRead.unrecognized } })}`);
  }
  const p1193Index = readFileSync(path.join(root, 'index.html'), 'utf8');
  const p1193Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  if (!/id="pf-exposure-path-input"/.test(p1193Index) || !/id="pf-rebalance-policy-input"/.test(p1193Index)
    || !/value="fixed_target_weight_strategy"/.test(p1193Index) || !/value="buy-and-hold"/.test(p1193Index)) {
    fail('P1193 the risk surface must expose the exposure path and rebalance policy declarations');
  }
  // P1258: 조립이 네이티브 모듈로 분해됐다 — 경로/정책/목표비중 전달은 모듈이, lineage 표기는 셸이 소유한다.
  const p1193RiskInput = readFileSync(path.join(root, 'src/ui/panels/portfolio-risk-input.js'), 'utf8');
  if (!/exposureHistoryMode: exposurePath/.test(p1193RiskInput) || !/rebalancePolicy,/.test(p1193RiskInput)
    || !/targetWeights: strategyTargetWeights/.test(p1193RiskInput) || !/declaredWeight \/ 100/.test(p1193RiskInput)
    || !/declaredWeightSum > 100 \+ 1e-6/.test(p1193RiskInput)
    || /Math\.abs\(declaredWeightSum - 100\)/.test(p1193RiskInput)
    || !/pathLineage === 'fixed-target-weight-strategy'/.test(p1193Workspace)) {
    fail('P1193/P1200 the risk path must pass the declared path/policy and hand the target weights through, leaving the cash remainder to the engine');
  }
  const { createCompositionSnapshot, deriveRiskEstimate } = await load('src/domain/portfolio/risk.js');
  const p1193Snapshot = createCompositionSnapshot({
    members: [{ ticker: 'AAA', qty: 1, price: 100, priceObservedAt: '2026-09-24T00:00:00.000Z', priceSource: 'fixture' }],
    cash: { amount: 0, currency: null }, asOf: '2026-09-24T00:00:00.000Z', weightBasis: 'whole_account', baseCurrency: null
  });
  const p1193Input = { snapshot: p1193Snapshot, returnsMap: { AAA: [0.01, 0.02] }, exposureHistoryMode: 'fixed_target_weight_strategy', rebalancePolicy: 'daily', sampleDates: ['2026-09-01', '2026-09-02'], rfAnnual: null };
  const noWeights = deriveRiskEstimate({ ...p1193Input, targetWeights: {} });
  const withWeights = deriveRiskEstimate({ ...p1193Input, targetWeights: { AAA: 1 } });
  if (noWeights.status !== 'blocked' || noWeights.code !== 'strategy-target-weights-invalid'
    || withWeights.status !== 'ready' || withWeights.pathLineage !== 'fixed-target-weight-strategy'
    || withWeights.publishedScope !== 'invested_sleeve' || withWeights.strategy?.targetWeights?.AAA !== 1) {
    fail(`P1193 an incomplete target-weight declaration must hold the strategy path and a complete one must publish its lineage, got ${JSON.stringify({ noWeights: noWeights.code, withWeights: { status: withWeights.status, lineage: withWeights.pathLineage, scope: withWeights.publishedScope } })}`);
  }
}
// ── E3/P1194 — 선언된 FX leg로 혼합 통화 합계를 환산 ─────────────────────────────────────
// 환산은 관측 rate leg가 있을 때만 성립한다. leg가 없거나 컷 이후·창 초과면 합계를 만들지 않고,
// 사용한 leg와 실패 사유를 발행한다 — 1로 나누거나 다른 통화를 섞어 합계를 만들지 않는다.
{
  const { FX_LEG_MAX_AGE_MS, appendFxLeg, convertWithDeclaredRates, fxLegsState, normalizeFxLegs, removeFxLeg, resolveFxRate } = await load('src/domain/portfolio/fx.js');
  const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
  const now = Date.UTC(2026, 8, 24, 0, 30);
  const observedAt = new Date(now - 3 * 3600000).toISOString();
  const declared = appendFxLeg(appendFxLeg([], { from: 'usd', to: 'krw', rate: 1350, observedAt }).legs, { from: 'KRW', to: 'USD', rate: 1400, observedAt });
  const normalized = normalizeFxLegs([{ from: 'usd', to: 'US', rate: 1, observedAt }, { from: 'USD', to: 'KRW', rate: 0, observedAt }, { from: 'USD', to: 'KRW', rate: 1350, observedAt: 'nope' }, { from: 'USD', to: 'USD', rate: 1, observedAt }]);
  const stale = resolveFxRate([{ from: 'USD', to: 'KRW', rate: 1350, observedAt: new Date(now - FX_LEG_MAX_AGE_MS - 1000).toISOString() }], { from: 'KRW', to: 'USD', asOfMs: now });
  const future = resolveFxRate([{ from: 'USD', to: 'KRW', rate: 1350, observedAt: new Date(now + 60000).toISOString() }], { from: 'KRW', to: 'USD', asOfMs: now });
  const inverted = resolveFxRate([{ from: 'USD', to: 'KRW', rate: 1350, observedAt }], { from: 'KRW', to: 'USD', asOfMs: now });
  const fxChecks = [
    ['append keeps both directions', declared.ok === true && declared.legs.length === 2],
    ['normalize drops malformed legs', normalized.length === 0],
    ['stale leg rejected', stale.reason === 'rate-stale'],
    ['after-cut leg rejected', future.reason === 'rate-observed-after-cut' && future.pair === 'USD/KRW'],
    ['declared inverse is inverted', inverted.ok === true && inverted.inverted === true && Math.abs(inverted.rate - 1 / 1350) <= 1e-15],
    ['undeclared pair refused', resolveFxRate([], { from: 'KRW', to: 'USD', asOfMs: now }).reason === 'rate-not-declared'],
    ['undeclared currency refused', resolveFxRate([], { from: null, to: 'USD', asOfMs: now }).reason === 'currency-undeclared'],
    ['missing value refused', convertWithDeclaredRates({ value: null, from: 'KRW', to: 'USD', legs: [], asOfMs: now }).reason === 'value-missing'],
    ['same currency is identity', convertWithDeclaredRates({ value: 1350, from: 'USD', to: 'USD', legs: [], asOfMs: now }).value === 1350],
    ['fresh leg is usable', fxLegsState([{ from: 'USD', to: 'KRW', rate: 1350, observedAt }], { asOfMs: now }).legs[0].usable === true],
    ['missing index refused', removeFxLeg([{ from: 'USD', to: 'KRW', rate: 1350, observedAt }], 3).ok === false]
  ];
  const failedFx = fxChecks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedFx.length) {
    fail(`P1194 FX contract checks failed: ${failedFx.join(' | ')} — ${JSON.stringify({ declared: declared.legs, normalized: normalized.length, stale: stale.reason, future: future, inverted: { ok: inverted.ok, inverted: inverted.inverted, rate: inverted.rate } })}`);
  }
  const mixedHoldings = [
    { symbol: 'AAA', shares: 10, avgCost: 100, price: 150, currency: 'USD', costCurrency: 'USD', sector: 'Tech' },
    { symbol: 'BBB', shares: 10, avgCost: 10000, price: 15000, currency: 'KRW', costCurrency: 'KRW', sector: 'Health' }
  ];
  const mixedState = { readState: 'ready', holdingsKnown: true, holdings: mixedHoldings, cash: 0, cashKnown: true, baseCurrency: 'USD', cashCurrency: 'USD' };
  const heldSurface = derivePortfolioSurface({ state: mixedState, liveData: {}, now });
  const convertedSurface = derivePortfolioSurface({ state: { ...mixedState, fxLegs: [{ from: 'KRW', to: 'USD', rate: 1 / 1350, observedAt }] }, liveData: {}, now });
  if (heldSurface.currencyState !== 'mixed-without-conversion' || heldSurface.totalAssets !== null || heldSurface.conversion.applied !== false
    || convertedSurface.currencyState !== 'converted-with-declared-rates' || convertedSurface.conversion.applied !== true
    || convertedSurface.conversion.legs.length !== 1 || convertedSurface.conversion.legs[0].from !== 'KRW'
    || convertedSurface.baseCurrency !== 'USD'
    || Math.abs(convertedSurface.positionValue - (10 * 150 + 10 * 15000 / 1350)) > 1e-6
    || Math.abs(convertedSurface.totalCost - (10 * 100 + 10 * 10000 / 1350)) > 1e-6
    || Math.abs(convertedSurface.totalPnl - (convertedSurface.positionValue - convertedSurface.totalCost)) > 1e-6
    || convertedSurface.rows.find((row) => row.symbol === 'BBB').convertedFrom !== 'KRW'
    || convertedSurface.rows.find((row) => row.symbol === 'AAA').convertedFrom !== null) {
    fail(`P1194 the surface must convert with a declared pair or hold the mixed total, got ${JSON.stringify({ held: { state: heldSurface.currencyState, total: heldSurface.totalAssets }, converted: { state: convertedSurface.currencyState, applied: convertedSurface.conversion.applied, position: convertedSurface.positionValue, legs: convertedSurface.conversion.legs } })}`);
  }
  const unrelatedSurface = derivePortfolioSurface({ state: { ...mixedState, fxLegs: [{ from: 'EUR', to: 'USD', rate: 1.1, observedAt }] }, liveData: {}, now });
  if (unrelatedSurface.currencyState !== 'mixed-without-conversion' || unrelatedSurface.totalAssets !== null
    || unrelatedSurface.conversion.applied !== false
    || !unrelatedSurface.conversion.held.some((entry) => entry.pair === 'KRW/USD' && entry.reason === 'rate-not-declared')) {
    fail(`P1194 a mixed total with an unrelated declared leg must stay held and publish the missing pair, got ${JSON.stringify({ state: unrelatedSurface.currencyState, total: unrelatedSurface.totalAssets, held: unrelatedSurface.conversion.held })}`);
  }
  const p1194Readers = readFileSync(path.join(root, 'src/data/runtime-readers.js'), 'utf8');
  const p1194Provider = readFileSync(path.join(root, 'src/data/providers/portfolio.js'), 'utf8');
  const p1194Normalize = readFileSync(path.join(root, 'src/data/normalize/portfolio.js'), 'utf8');
  const p1194Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  const p1194Html = readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!/clone\(root\.getPortfolioFxLegs\(\)\)/.test(p1194Readers) || !/fxLegs: Array\.isArray\(runtime\.fxLegs\)/.test(p1194Provider)
    || !/fxLegs: Object\.freeze/.test(p1194Normalize) || !/safeLS\(key, json\)/.test(p1194Workspace)
    || !/fxLegs: Array\.isArray\(payload\.fxLegs\)/.test(readFileSync(path.join(root, 'src/state/slices/portfolio.js'), 'utf8'))
    || !/window\._aioAddFxLeg = /.test(p1194Workspace) || !/window\._aioRemoveFxLeg = /.test(p1194Workspace)
    || !/from '\.\/fx\.js'/.test(readFileSync(path.join(root, 'src/domain/portfolio/surface.js'), 'utf8'))
    || !/id="pf-fx-from"/.test(p1194Html) || !/data-action="_aioAddFxLeg"/.test(p1194Html)
    || !/converted-with-declared-rates/.test(readFileSync(path.join(root, 'src/ui/pages/portfolio.js'), 'utf8'))) {
    fail('P1194 the declared FX legs must cross reader→provider→normalize→surface and be writable from the risk surface');
  }
}
// ── P1195 — 선언 패널(원장·FX leg)의 마크업과 ack 문구는 네이티브가 소유한다 ──────────────
// 이 블록은 ratchet에서 가장 빨리 자라던 부분이었다(P1191 +201, P1194 +65). 마크업·문구를 셸에
// 두면 두 목록이 서로 어긋나고, 영구 저장 실패가 성공처럼 읽히는 것도 문구가 흩어져서였다.
{
  const { applyFxPanel, applyLedgerPanel, declarationStatus, fxLegListMarkup, ledgerListMarkup, readDeclaredFields, showDeclarationStatus } = await load('src/ui/panels/portfolio-declarations.js');
  const coverageMarkup = (await load('src/ui/panels/portfolio-declarations.js')).coverageMarkup;
  const coverage = coverageMarkup({ inputs: [{ id: 'transactions', label: '거래<x>', declared: true }, { id: 'valuations', label: '평가', declared: false }] });
  const ledgerMarkup = ledgerListMarkup({ transactions: [{ date: '2026-01-02', kind: 'withdrawal', amount: 100 }], valuations: [{ date: '2026-01-31', amount: 1000 }] });
  const fxMarkup = fxLegListMarkup({ legs: [
    { from: 'USD', to: 'KRW', rate: 1350, observedAt: '2026-09-23T21:30:00.000Z', ageMs: 3 * 3600000, usable: true },
    { from: 'EUR', to: 'USD', rate: 1.1, observedAt: '2026-09-01T00:00:00.000Z', ageMs: 500 * 3600000, usable: false }
  ] }, { maxAgeMs: 72 * 3600000 });
  const persistFail = declarationStatus({ kind: 'ledger', phase: 'persist', result: { ok: false, reason: 'persist-rejected' } });
  const invalidFx = declarationStatus({ kind: 'fx', phase: 'apply', result: { ok: false, reason: 'invalid-fx-leg' } });
  const invalidLedger = declarationStatus({ kind: 'ledger', phase: 'apply', result: { ok: false, reason: 'invalid-ledger-entry' } });
  const saved = declarationStatus({ kind: 'ledger', phase: 'persist', result: { ok: true, memoryApplied: true }, okMessage: '원장 항목을 삭제했습니다.' });
  const fakeList = { innerHTML: '' };
  const fakeInput = { value: 'USD' };
  const fakeDocument = {
    getElementById(id) {
      if (id === 'pf-fx-list') return fakeList;
      if (id === 'pf-fx-from') return fakeInput;
      if (id === 'pf-ledger-status') return { textContent: '', style: {} };
      return null;
    }
  };
  const applied = applyFxPanel({ documentRef: fakeDocument, legsState: { legs: [] }, maxAgeMs: 72 * 3600000 });
  const appliedEmpty = applyLedgerPanel({ documentRef: fakeDocument, ledger: null, coverageState: { inputs: [] } });
  const readBack = readDeclaredFields(fakeDocument, ['pf-fx-from', 'pf-fx-to']);
  const statusWritten = showDeclarationStatus({ documentRef: fakeDocument, statusId: 'pf-ledger-status', kind: 'fx', phase: 'apply', result: { ok: false, reason: 'invalid-fx-leg' } });
  const usableFxRow = fxMarkup.slice(0, fxMarkup.indexOf('opacity:0.7;'));
  const panelChecks = [
    ['coverage marks only the declared input', (coverage.match(/checked/g) || []).length === 1],
    ['coverage escapes the label', coverage.includes('거래&lt;x&gt;') && coverage.includes('data-field="transactions"')],
    ['ledger rows keep kind and index', ledgerMarkup.includes('data-arg="transaction:0"') && ledgerMarkup.includes('data-arg="valuation:0"') && ledgerMarkup.includes('출금')],
    ['empty ledger says so', ledgerListMarkup(null) === '원장 항목 없음' && ledgerListMarkup({ transactions: [], valuations: [] }) === '원장 항목 없음'],
    ['usable fx leg stays plain', usableFxRow.includes('USD→KRW') && !usableFxRow.includes('opacity:0.7;') && !usableFxRow.includes('사용 불가')],
    ['unusable fx leg names the declared budget', fxMarkup.includes('사용 불가(선언 창 72h 초과 또는 컷 이후)') && fxMarkup.includes('opacity:0.7;')],
    ['fx list indexes its remove buttons', fxMarkup.includes('data-arg="0"') && fxMarkup.includes('data-arg="1"')],
    ['persist failure never reads as success', persistFail.ok === false && persistFail.tone === 'var(--data-amber)' && persistFail.text.includes('영구 저장 실패')],
    ['persist failure must not borrow the invalid-entry wording', !persistFail.text.includes('FX leg는') && !persistFail.text.includes('날짜(YYYY-MM-DD)')],
    ['invalid fx names what is missing', invalidFx.text.includes('FX leg는 통화 2개')],
    ['invalid ledger names what is missing', invalidLedger.text.includes('원장 항목은 날짜(YYYY-MM-DD)')],
    ['a durable success keeps its message', saved.ok === true && saved.tone === 'var(--text-muted)' && saved.text === '원장 항목을 삭제했습니다.'],
    ['apply writes the list and reports it', applied === true && fakeList.innerHTML.includes('FX leg 없음')],
    ['apply without its elements reports false', appliedEmpty === false],
    ['fields read from the document', readBack['pf-fx-from'] === 'USD' && readBack['pf-fx-to'] === ''],
    ['status write lands on the element', statusWritten && statusWritten.text.includes('FX leg는')]
  ];
  const failedPanels = panelChecks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedPanels.length) fail(`P1195 declared-panel checks failed: ${failedPanels.join(' | ')}`);
  const p1195Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  const p1195Bootstrap = readFileSync(path.join(root, 'src/app/bootstrap.js'), 'utf8');
  if (/data-action="_aioRemoveLedgerEntry"/.test(p1195Workspace) || /data-action="_aioRemoveFxLeg"/.test(p1195Workspace)
    || /function _pfVaultListPersist\(options\)/.test(p1195Workspace) === false
    || !/window\._pfDeclarationPanels = \{/.test(p1195Bootstrap)
    || !/showDeclarationStatus\(\{ documentRef: document, statusId: statusId/.test(p1195Workspace)) {
    fail('P1195 the shell must keep storage and ordering while the native panel owns the markup and the acknowledgement wording');
  }
}
// ── E3/P1196 — 원가 통화 불일치도 선언된 leg로 환산하면 P&L이 성립한다 ─────────────────────
// 값은 USD, 원가는 KRW인 보유는 환산 근거가 없으면 P&L을 만들 수 없다(P1181). 근거가 선언되면
// 두 축이 같은 기준 통화가 되어 P&L이 성립하고, 원가쌍만 없으면 **P&L만** 보류한다(합계는 유지).
{
  const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
  const now = Date.UTC(2026, 8, 24, 0, 30);
  const observedAt = new Date(now - 3 * 3600000).toISOString();
  const leg = { from: 'KRW', to: 'USD', rate: 1 / 1350, observedAt };
  const mismatchHoldings = [{ symbol: 'AAA', shares: 10, avgCost: 15000, price: 200, currency: 'USD', costCurrency: 'KRW', sector: 'Tech' }];
  const mismatchState = { readState: 'ready', holdingsKnown: true, holdings: mismatchHoldings, cash: 0, cashKnown: true, baseCurrency: 'USD', cashCurrency: 'USD' };
  const held = derivePortfolioSurface({ state: mismatchState, liveData: {}, now });
  const converted = derivePortfolioSurface({ state: { ...mismatchState, fxLegs: [leg] }, liveData: {}, now });
  const convertedCost = 10 * 15000 / 1350;
  const convertedValue = 10 * 200;
  // 원가쌍이 없는 leg만 선언하면 값 합계는 만들어지되 P&L만 보류되고, 어느 쌍이 없는지 발행된다.
  const wrongLeg = derivePortfolioSurface({ state: { ...mismatchState, fxLegs: [{ from: 'EUR', to: 'USD', rate: 1.1, observedAt }] }, liveData: {}, now });
  const p1196Checks = [
    ['no basis holds the P&L and names the mismatch', held.costCurrencyState === 'cost-price-mismatch-held' && held.totalPnl === null && held.positionValue === convertedValue],
    ['declared basis converts the cost axis', converted.costCurrencyState === 'cost-price-mismatch-converted' && converted.conversion.costApplied === true],
    ['converted P&L equals value minus converted cost', Math.abs(converted.totalCost - convertedCost) < 1e-6 && Math.abs(converted.totalPnl - (convertedValue - convertedCost)) < 1e-6],
    ['converted row keeps its original cost currency', converted.rows[0].costConvertedFrom === 'KRW'],
    ['the aggregate stays single-currency', converted.currencyState === 'declared-single' && converted.conversion.applied === false],
    ['cost-only conversion still publishes its leg', converted.conversion.legs.length === 1 && converted.conversion.legs[0].from === 'KRW'],
    ['a missing cost pair holds only the P&L', wrongLeg.costCurrencyState === 'cost-price-mismatch-held' && wrongLeg.totalPnl === null && wrongLeg.totalCost === null
      && wrongLeg.conversion.costHeld.some((entry) => entry.pair === 'KRW/USD' && entry.reason === 'rate-not-declared')],
    ['cost basis conflict is judged before conversion', held.rows[0].costCurrency === 'KRW']
  ];
  const failedP1196 = p1196Checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedP1196.length) {
    fail(`P1196 cost-axis conversion checks failed: ${failedP1196.join(' | ')} — ${JSON.stringify({ held: { state: held.costCurrencyState, pnl: held.totalPnl, value: held.positionValue }, converted: { state: converted.costCurrencyState, cost: converted.totalCost, pnl: converted.totalPnl, legs: converted.conversion.legs }, wrong: { state: wrongLeg.costCurrencyState, costHeld: wrongLeg.conversion.costHeld } })}`);
  }
  if (!/cost-price-mismatch-converted/.test(readFileSync(path.join(root, 'src/ui/pages/portfolio.js'), 'utf8'))) {
    fail('P1196 the surface note must distinguish a converted cost axis from a held one');
  }
}
// ── P1197 — 소비되지 않는 선언은 요구하지도, 정체성을 바꾸지도 않는다 ─────────────────────────
// 리밸런싱 정책은 전략 경로에서만 결과를 바꾼다. 회고 경로에서 정책을 **필수**로 요구하면 사용자가
// 의미 없는 입력을 선언해야 하고, 그 값이 정체성 해시에 들어가면 같은 입력이 다른 estimateId를 받아
// 재현·비교가 깨진다(결과는 같은데 id만 다른 상태).
{
  const { createCompositionSnapshot, deriveRiskEstimate } = await load('src/domain/portfolio/risk.js');
  const p1197Series = [0.01, -0.005, 0.012, 0.003, -0.002, 0.004, 0.001, -0.001, 0.002, 0.003, 0.001, 0.002, 0.001];
  const p1197Snapshot = createCompositionSnapshot({
    members: [{ ticker: 'AAA', qty: 1, price: 100, priceObservedAt: '2026-09-23T00:00:00.000Z', priceSource: 'fixture' }],
    cash: { amount: 100, currency: 'USD' },
    asOf: '2026-09-23T00:00:00.000Z',
    weightBasis: 'whole_account',
    baseCurrency: 'USD'
  });
  const base = {
    snapshot: p1197Snapshot,
    returnsMap: { AAA: p1197Series },
    cashReturn: { mode: 'explicit_assumption', annualRate: 0.02 },
    rfAnnual: 0.03,
    exposureHistoryMode: 'current_composition_retrospective',
    targetWeights: { AAA: 1 }
  };
  const noPolicy = deriveRiskEstimate({ ...base });
  const withMonthly = deriveRiskEstimate({ ...base, rebalancePolicy: 'monthly' });
  const withQuarterly = deriveRiskEstimate({ ...base, rebalancePolicy: 'quarterly' });
  const p1197Dates = Array.from({ length: 13 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`);
  const strategyNoPolicy = deriveRiskEstimate({ ...base, exposureHistoryMode: 'fixed_target_weight_strategy' });
  const strategyMonthly = deriveRiskEstimate({ ...base, exposureHistoryMode: 'fixed_target_weight_strategy', rebalancePolicy: 'monthly', sampleDates: p1197Dates });
  const sameSeries = JSON.stringify(noPolicy.publishedReturns) === JSON.stringify(withMonthly.publishedReturns)
    && JSON.stringify(withMonthly.publishedReturns) === JSON.stringify(withQuarterly.publishedReturns);
  const p1197Checks = [
    ['retrospective path does not require a policy', noPolicy.status !== 'blocked' && noPolicy.rebalancePolicy === null && noPolicy.rebalancePolicyApplied === false],
    ['an unused policy does not change the numbers', sameSeries],
    ['an unused policy does not change the identity', noPolicy.estimateId === withMonthly.estimateId && withMonthly.estimateId === withQuarterly.estimateId],
    ['a declared-but-unused policy is still published', withMonthly.rebalancePolicyDeclared === 'monthly' && withMonthly.rebalancePolicyApplied === false],
    ['the unused policy is named in a warning', withMonthly.warnings.some((line) => line.includes('monthly') && line.includes('쓰이지 않습니다'))],
    ['the strategy path still requires a policy', strategyNoPolicy.status === 'blocked' && strategyNoPolicy.code === 'rebalance-policy-required'],
    ['the strategy path applies and hashes its policy', strategyMonthly.rebalancePolicyApplied === true && strategyMonthly.rebalancePolicy === 'monthly'
      && strategyMonthly.estimateId !== noPolicy.estimateId && strategyMonthly.strategy && strategyMonthly.strategy.targetWeightSum === 1],
    ['the strategy path keeps its own warning', strategyMonthly.warnings.some((line) => line.includes('고정 목표비중 전략 경로'))]
  ];
  const failedP1197 = p1197Checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedP1197.length) {
    fail(`P1197 policy-consumption checks failed: ${failedP1197.join(' | ')} — ${JSON.stringify({ noPolicy: { status: noPolicy.status, id: noPolicy.estimateId, applied: noPolicy.rebalancePolicyApplied }, monthly: { id: withMonthly.estimateId, declared: withMonthly.rebalancePolicyDeclared, applied: withMonthly.rebalancePolicyApplied }, strategyNo: { status: strategyNoPolicy.status, code: strategyNoPolicy.code } })}`);
  }
  if (!/선언 정책 ' \+ _escHtmlSafe\(est\.rebalancePolicyDeclared\) \+ ' 미사용/.test(readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8'))) {
    fail('P1197 the risk panel must say that a declared policy was not used on the retrospective path');
  }
}
// ── P1198 — 셸은 선언되지 않은 정책을 지어내지 않는다 ────────────────────────────────────────
// P1197이 엔진에서 선언/적용을 분리했는데, 셸이 `|| 'daily'`로 기본값을 만들면 사용자가 선언하지 않은
// 정책이 '선언'으로 게시된다 — 지어낸 선언은 선언이 아니다. 전략 경로에서 미선언이면 엔진이 보류한다.
{
  const p1198Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  const p1198RiskInput = readFileSync(path.join(root, 'src/ui/panels/portfolio-risk-input.js'), 'utf8');
  const p1198Index = readFileSync(path.join(root, 'index.html'), 'utf8');
  const p1198Checks = [
    ['the shell does not invent a policy', !/rebalancePolicy \|\| 'daily'/.test(p1198Workspace) && !/rebalancePolicy \|\| 'daily'/.test(p1198RiskInput)],
    ['the shell passes the declared value through', /const rebalancePolicy = decl\.rebalancePolicy;/.test(p1198RiskInput) && /declarations: declarations/.test(p1198Workspace)],
    ['the panel distinguishes applied / declared / undeclared', /est\.rebalancePolicyApplied \? est\.rebalancePolicy : \(est\.rebalancePolicyDeclared \? est\.rebalancePolicyDeclared \+ '\(미사용\)' : '미선언'\)/.test(p1198Workspace)],
    ['the panel never prints a raw null', !/'rebalance ' \+ est\.rebalancePolicy\b/.test(p1198Workspace)],
    ['an unrecognized declaration is deleted, not stored as a default', /if \(normalized == null\) localStorage\.removeItem\(key\);/.test(p1198Workspace)],
    ['undeclared is selectable in the surface', /<option value="">미선언 \(전략 경로에서 필요\)<\/option>/.test(p1198Index)]
  ];
  const failedP1198 = p1198Checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedP1198.length) fail(`P1198 shell policy-declaration checks failed: ${failedP1198.join(' | ')}`);
}
// ── P1199 — 선언 저장소: 메모리 반영과 영구 저장은 다른 사실이다 ──────────────────────────────
// P1191이 "영구 저장 실패 — 변경이 확정되지 않았습니다"를 만들었지만, 그 ack 계산은 ratcheted 셸
// 안에 있어 테스트되지 않았다. 이제 형태가 네이티브로 나왔으니 계약으로 고정한다: 영구 저장 실패를
// 성공으로 보고하지 않고, 암호문을 평문 선언으로 읽지 않으며, 동기 캐시가 같은 턴의 진실이다.
{
  const { ENCRYPTED_VALUE_PREFIX, createDeclarationsStore } = await load('src/data/portfolio-declarations-store.js');
  const cache = {};
  let durable = null;
  let storageWrites = 0;
  const store = createDeclarationsStore({
    getRuntimeCache: () => cache,
    getAdapter: () => null,
    getLocalStorage: () => ({ getItem: (key) => (key in durable ? durable[key] : null), setItem: (key, value) => { durable = { ...durable, [key]: value }; storageWrites += 1; } }),
    optedOut: () => false,
    secureSet: (key, json) => { durable = { ...durable, [key]: json }; storageWrites += 1; return Promise.resolve(); }
  });
  const accepted = await store.write('aio_test_ledger', { transactions: [{ amount: 1 }] });
  const readBack = store.read('aio_test_ledger');
  const stored = readBack && readBack.transactions && readBack.transactions[0];
  // 영구 저장이 거부되어도 메모리에는 남는다 — 두 사실을 분리해 보고해야 한다.
  const rejecting = createDeclarationsStore({
    getRuntimeCache: () => cache,
    optedOut: () => false,
    secureSet: () => Promise.reject(new Error('quota'))
  });
  const rejected = await rejecting.write('aio_test_fx', [{ from: 'USD', to: 'KRW' }]);
  const rejectedRead = rejecting.read('aio_test_fx');
  // 메모리 캐시가 없으면 영구 저장이 성공해도 ok가 아니다(변경이 확정되지 않았다는 뜻은 그대로다).
  const noCache = createDeclarationsStore({ getRuntimeCache: () => null, optedOut: () => false, getLocalStorage: () => null });
  const noCacheResult = await noCache.write('aio_test_x', 1);
  // 암호문은 평문 선언으로 읽지 않는다.
  const encryptedStore = createDeclarationsStore({
    getRuntimeCache: () => null,
    optedOut: () => true,
    getLocalStorage: () => ({ getItem: () => ENCRYPTED_VALUE_PREFIX + 'AAAA', setItem: () => {} })
  });
  const plainStore = createDeclarationsStore({
    getRuntimeCache: () => null,
    optedOut: () => true,
    getLocalStorage: () => ({ getItem: () => '{"ok":true}', setItem: () => {} })
  });
  const p1199Checks = [
    ['a durable write reads back the same declaration', accepted.ok === true && accepted.memoryApplied === true && stored && stored.amount === 1],
    ['a rejected durable write still reports memory applied', rejected.ok === false && rejected.memoryApplied === true && rejected.reason === 'persist-rejected'],
    ['the rejected declaration is still visible in this turn', Array.isArray(rejectedRead) && rejectedRead.length === 1],
    ['no cache means the change is never confirmed', noCacheResult.ok === false && noCacheResult.memoryApplied === false && noCacheResult.reason === 'memory-write-failed'],
    ['an encrypted value is not read as a declaration', encryptedStore.read('aio_test_ledger') === null],
    ['plaintext survives opt-out', plainStore.read('aio_test_ledger') && plainStore.read('aio_test_ledger').ok === true],
    ['an absent key reads as null', store.read('aio_test_missing') === null]
  ];
  const failedP1199 = p1199Checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedP1199.length) fail(`P1199 declaration-store checks failed: ${failedP1199.join(' | ')}`);
  const p1199Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  if (!/window\._pfDeclarationsStore = \{ create: createDeclarationsStore \}/.test(readFileSync(path.join(root, 'src/app/bootstrap.js'), 'utf8'))
    || /function _pfVaultListWrite\(/.test(p1199Workspace)
    || !/_pfDeclarationWrite\(options\.key, options\.value\)/.test(p1199Workspace)
    || !/showDeclarationStatus\(\{ documentRef: document, statusId: statusId/.test(p1199Workspace)) {
    fail('P1199 the shell must inject the storage policy into the native store instead of owning the shape');
  }
}
// ── P1200 — 전략 목표비중의 현금 몫이 계좌 범위를 선언한다 ───────────────────────────────────
// 목표비중 합이 1 미만이면 그 차액은 현금 목표비중이다 — 선언이 계좌 범위를 말한 것이므로 현금
// 수익률이 있으면 계좌 전체 보기를 만들 수 있다. 합이 1을 넘으면 선언이 성립하지 않는다.
{
  const { createCompositionSnapshot, deriveRiskEstimate } = await load('src/domain/portfolio/risk.js');
  const p1200Series = [0.02, -0.01, 0.01, 0.005, -0.004, 0.003, 0.002, -0.002, 0.004, 0.001, 0.002, 0.003, 0.001];
  const p1200Dates = p1200Series.map((_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`);
  const p1200Snapshot = createCompositionSnapshot({
    members: [{ ticker: 'AAA', qty: 1, price: 100, priceObservedAt: '2026-09-23T00:00:00.000Z', priceSource: 'fixture' }],
    cash: { amount: 0, currency: 'USD' },
    asOf: '2026-09-23T00:00:00.000Z',
    weightBasis: 'whole_account',
    baseCurrency: 'USD'
  });
  const p1200Base = {
    snapshot: p1200Snapshot,
    returnsMap: { AAA: p1200Series },
    exposureHistoryMode: 'fixed_target_weight_strategy',
    rebalancePolicy: 'daily',
    sampleDates: p1200Dates
  };
  const withCash = deriveRiskEstimate({ ...p1200Base, targetWeights: { AAA: 0.8 }, cashReturn: { mode: 'explicit_assumption', annualRate: 0.0365 } });
  const overAllocated = deriveRiskEstimate({ ...p1200Base, targetWeights: { AAA: 1.2 }, cashReturn: { mode: 'explicit_assumption', annualRate: 0.0365 } });
  const cashUnresolved = deriveRiskEstimate({ ...p1200Base, targetWeights: { AAA: 0.8 }, cashReturn: { mode: 'unresolved' } });
  const fullSleeve = deriveRiskEstimate({ ...p1200Base, targetWeights: { AAA: 1 }, cashReturn: { mode: 'explicit_assumption', annualRate: 0.0365 } });
  // 현금 수익률의 일간 환산은 모듈이 선언한 규약을 따른다: (1+연율)^(1/252)−1 (거래일 복리).
  const dailyCashRate = Math.pow(1 + 0.0365, 1 / 252) - 1;
  const expectedFirst = 0.8 * p1200Series[0] + 0.2 * dailyCashRate;
  const p1200Checks = [
    ['a cash remainder is published as the cash weight', withCash.status === 'ready' && withCash.strategy.cashWeight != null && Math.abs(withCash.strategy.cashWeight - 0.2) < 1e-9],
    ['the declared remainder opens the account scope', withCash.wholeAccountHold === null && withCash.publishedScope === 'whole_account' && withCash.cashTreatment === 'declared_strategy_cash_weight'],
    ['the account return blends sleeve and declared cash', Math.abs(withCash.wholeAccountReturns[0] - expectedFirst) < 1e-12],
    ['over-allocation is still invalid', overAllocated.status === 'blocked' && overAllocated.code === 'strategy-target-weights-invalid'],
    ['a cash remainder without a cash return holds only the account view', cashUnresolved.wholeAccountHold === 'cash-return-unresolved' && cashUnresolved.publishedScope === 'invested_sleeve' && cashUnresolved.status === 'ready'],
    ['a full sleeve keeps the previous hold', fullSleeve.strategy.cashWeight === 0 && fullSleeve.wholeAccountHold === 'strategy-account-scope-not-declared']
  ];
  const failedP1200 = p1200Checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedP1200.length) {
    fail(`P1200 strategy cash-weight checks failed: ${failedP1200.join(' | ')} — ${JSON.stringify({ withCash: { status: withCash.status, cashWeight: withCash.strategy && withCash.strategy.cashWeight, hold: withCash.wholeAccountHold, scope: withCash.publishedScope, first: withCash.wholeAccountReturns && withCash.wholeAccountReturns[0] }, over: { status: overAllocated.status, code: overAllocated.code }, unresolved: { hold: cashUnresolved.wholeAccountHold, scope: cashUnresolved.publishedScope }, full: { weight: fullSleeve.strategy && fullSleeve.strategy.cashWeight, hold: fullSleeve.wholeAccountHold } })}`);
  }
  const p1200Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  const p1200RiskInput = readFileSync(path.join(root, 'src/ui/panels/portfolio-risk-input.js'), 'utf8');
  // P1258: 합 검증은 조립 모듈이, 현금 몫 표기는 셸 패널이 소유한다.
  if (!/declaredWeightSum > 100 \+ 1e-6/.test(p1200RiskInput) || !/est\.strategy\.cashWeight > 0 \? ' · 현금 '/.test(p1200Workspace)) {
    fail('P1200 the shell must accept a sub-100% target sum and the panel must publish the cash share');
  }
}
// ── P1258 — 위험 입력 조립 분해: 조립 fixture (QA1986 verify_by) ─────────────────────────────────
// 셸에서 분리된 순수 조립이 입력 자격·returnsMap·구성 스냅샷·estimate 호출까지 한 계약에서 수행하고,
// 보류는 사유 코드로 돌려준다(문구는 셸이 고른다). 무효 입력을 조용히 제외하지 않는다.
{
  const { assembleRiskEstimateInput } = await load('src/ui/panels/portfolio-risk-input.js');
  const p1258Days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-07', '2026-09-08'];
  const p1258Series = (base) => Object.fromEntries(p1258Days.map((d, i) => [d, base * (1 + i * 0.01)]));
  const p1258Evidence = (value) => ({ value, ts: '2026-09-25T00:00:00.000Z', source: 'fixture', allowedUse: true });
  const p1258Declarations = { baseCurrency: null, cashCurrency: null, cashReturn: null, riskFreeRate: null, exposurePath: null, rebalancePolicy: null };
  const p1258Input = {
    positions: [{ ticker: 'AAA', qty: 10 }, { ticker: 'BBB', qty: 5 }],
    priceEvidenceMap: { AAA: p1258Evidence(100), BBB: p1258Evidence(50) },
    historyMap: { AAA: p1258Series(100), BBB: p1258Series(50) },
    validTickers: ['AAA', 'BBB'],
    commonDates: p1258Days,
    cashValue: 0,
    declarations: p1258Declarations,
    // 스냅샷 ID는 asOf를 포함한다 — 재현성 검사를 결정적으로 만들려면 관측 시각을 고정한다.
    nowIso: '2026-09-25T00:00:00.000Z'
  };
  const p1258Happy = assembleRiskEstimateInput(p1258Input);
  const p1258Replay = assembleRiskEstimateInput(p1258Input);
  const p1258Missing = assembleRiskEstimateInput({ ...p1258Input, priceEvidenceMap: { AAA: p1258Evidence(100), BBB: { value: null, allowedUse: false } } });
  // 'no-current-value'는 가격 결측(→ missing-current)이 아니라, 가격은 있으나 평가액이 0인 경우다.
  const p1258NoValue = assembleRiskEstimateInput({ ...p1258Input, positions: [{ ticker: 'AAA', qty: 0 }, { ticker: 'BBB', qty: 0 }] });
  const p1258ShortGrid = assembleRiskEstimateInput({ ...p1258Input, commonDates: p1258Days.slice(0, 5) });
  const p1258OverWeight = assembleRiskEstimateInput({
    ...p1258Input,
    declarations: { ...p1258Declarations, exposurePath: 'fixed_target_weight_strategy' },
    positions: [{ ticker: 'AAA', qty: 10, targetWeight: 60 }, { ticker: 'BBB', qty: 5, targetWeight: 60 }]
  });
  const p1258Ok = p1258Happy.ok === true && p1258Happy.minLen === p1258Days.length - 1
    && Array.isArray(p1258Happy.returnsMap?.AAA) && p1258Happy.returnsMap.AAA.length === p1258Days.length - 1
    && p1258Happy.snapshot?.status === 'ready' && p1258Happy.estimate?.status === 'ready'
    && p1258Happy.exposurePath === 'current_composition_retrospective'
    && p1258Happy.strategyTargetWeights === undefined
    && p1258Replay.snapshot?.compositionSnapshotId === p1258Happy.snapshot?.compositionSnapshotId;
  const p1258Holds = p1258Missing.ok === false && p1258Missing.code === 'missing-current' && (p1258Missing.tickers || []).includes('BBB')
    && p1258NoValue.ok === false && p1258NoValue.code === 'no-current-value'
    && p1258ShortGrid.ok === false && p1258ShortGrid.code === 'common-dates-insufficient';
  const p1258Over = p1258OverWeight.ok === true && p1258OverWeight.strategyTargetWeights
    && Object.keys(p1258OverWeight.strategyTargetWeights).length === 0;
  if (!p1258Ok || !p1258Holds || !p1258Over) {
    fail(`P1258 the assembled risk input must qualify, hold with codes, and refuse over-allocation, got ${JSON.stringify({ ok: { ok: p1258Happy.ok, minLen: p1258Happy.minLen, snap: p1258Happy.snapshot?.status, estimate: p1258Happy.estimate?.status, path: p1258Happy.exposurePath, weights: p1258Happy.strategyTargetWeights, replay: p1258Replay.snapshot?.compositionSnapshotId === p1258Happy.snapshot?.compositionSnapshotId }, missing: p1258Missing, noValue: p1258NoValue.code, short: p1258ShortGrid.code, over: p1258OverWeight.strategyTargetWeights })}`);
  }
}
// ── P1192 — 완료 컷 행의 previous-completed-close 경계 ──────────────────────────────────────
// 행의 완료 컷을 넘는 스탬프는 그 행에 실릴 수 없다(P1095). 값은 실제 완료 종가이므로 버리지 않고
// 직전 bar 경계로 앉히고, 그마저 컷을 넘으면 값을 싣지 않는다 — 시각만 바꾸는 위장은 금지다.
{
  const { boundPreviousCloseToCut } = await load('scripts/fetch-data.mjs');
  const cut = '2026-09-23T23:00:00.000Z';
  const quoteMap = (observedAt, previousBarOpenedAt) => ({
    '^GSPC': { observedAt: '2026-09-23T20:36:00.000Z', observationRelation: 'latest-completed-close', observedAtSource: 'provider-current' },
    'DX-Y.NYB': { observedAt, previousBarOpenedAt, observationRelation: 'previous-completed-close', observedAtSource: 'provider-previous-close' }
  });
  const bounded = { bySym: { '^GSPC': 1, 'DX-Y.NYB': 2 }, bySymQuote: quoteMap('2026-09-24T00:16:00.000Z', '2026-09-23T04:00:00.000Z') };
  const adjusted = boundPreviousCloseToCut({ ...bounded, cycleEnd: cut });
  const kept = bounded.bySymQuote['DX-Y.NYB'];
  if (adjusted.adjusted.length !== 1 || adjusted.dropped.length !== 0 || bounded.bySym['DX-Y.NYB'] !== 2
    || kept.observedAt !== '2026-09-23T04:00:00.000Z' || kept.observedAtBoundary !== 'previous-bar-open'
    || kept.observedAtCandidate !== '2026-09-24T00:16:00.000Z'
    || kept.observationRelation !== 'previous-completed-close' || kept.observedAtSource !== 'provider-previous-close'
    || !(Date.parse(kept.observedAt) <= Date.parse(cut)) || !(bounded.bySym['^GSPC'] === 1)) {
    fail(`P1192 a previous-close boundary that exceeds the row cut must fall back to the previous bar, keep the value and the previous-close relation, got ${JSON.stringify({ adjusted: adjusted.adjusted, kept, value: bounded.bySym['DX-Y.NYB'] })}`);
  }
  const droppedFixture = { bySym: { '^GSPC': 1, 'DX-Y.NYB': 2 }, bySymQuote: quoteMap('2026-09-24T00:16:00.000Z', '2026-09-23T23:30:00.000Z') };
  const droppedResult = boundPreviousCloseToCut({ ...droppedFixture, cycleEnd: cut });
  if (droppedResult.dropped.join(',') !== 'DX-Y.NYB' || droppedFixture.bySym['DX-Y.NYB'] !== null || 'DX-Y.NYB' in droppedFixture.bySymQuote) {
    fail(`P1192 a row must not carry a previous close whose candidates all fall after its cut, got ${JSON.stringify({ dropped: droppedResult.dropped, value: droppedFixture.bySym['DX-Y.NYB'] })}`);
  }
  const untouched = { bySym: { 'DX-Y.NYB': 3 }, bySymQuote: quoteMap('2026-09-23T04:00:00.000Z', '2026-09-22T04:00:00.000Z') };
  const untouchedResult = boundPreviousCloseToCut({ ...untouched, cycleEnd: cut });
  if (untouchedResult.adjusted.length !== 0 || untouchedResult.dropped.length !== 0
    || untouched.bySymQuote['DX-Y.NYB'].observedAt !== '2026-09-23T04:00:00.000Z'
    || untouched.bySymQuote['DX-Y.NYB'].observedAtBoundary !== undefined || untouched.bySym['DX-Y.NYB'] !== 3) {
    fail(`P1192 a previous close inside the cut must pass through untouched, got ${JSON.stringify({ untouched: untouchedResult, quote: untouched.bySymQuote['DX-Y.NYB'] })}`);
  }
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

// P1040: missing facts and mismatched fiscal periods remain distinct.
{
  const { finiteFact, sameFiscalPeriod } = await load('src/domain/fundamental/period.js');
  for (const value of [null, undefined, '', ' ', false, true, [], {}]) {
    if (finiteFact(value) !== null) fail('SEC missing fact coerced to a number');
  }
  if (finiteFact(-10) !== -10 || finiteFact('0') !== 0) fail('SEC valid loss or zero rejected');
  if (sameFiscalPeriod({end:'2025-12-31',start:'2025-01-01'}, {end:'2025-12-31',start:'2025-10-01'})) fail('SEC annual/quarterly period joined');
  const { selectSecFundamentalsAsOf, deriveSecReport } = await load('src/domain/fundamental/sec-report.js');
  const fact = (value, periodEnd) => ({value, periodEnd, filedAt:'2026-02-01'});
  const record = {pit:{observations:{revenue:[fact(100,'2025-12-31'),fact(50,'2023-12-31')],netIncome:[fact(10,'2024-12-31')],equity:[fact(40,'2024-12-31')]}}};
  const result = selectSecFundamentalsAsOf(record,'2026-03-01');
  if (result.revenue !== 100 || result.netIncome !== null || result.equity !== null || result.margin != null || result.revGrowth != null) fail('SEC mismatched years created ratios or annual growth');
  if (deriveSecReport({coverage:['netIncome'],netIncome:-10}).status === 'quarantined') fail('SEC loss quarantined');
}
{
  const { createLearningState } = await load('src/domain/knowledge/learning-state.js');
  const state = createLearningState({storage:{getItem:()=>null,setItem:()=>{throw new Error('quota');}}});
  const first = state.setNote('fixture','saved in memory');
  if(first.persistence !== 'memory-only' || first.notes.fixture.value !== 'saved in memory' || !Object.isFrozen(first.notes.fixture)) fail('learning storage failure or mutable snapshot');
  state.setNote('fixture','changed');
  if(first.notes.fixture.value !== 'saved in memory') fail('learning snapshot mutated retroactively');
  if(state.setNote('__proto__','unsafe').notes.__proto__?.value) fail('learning unsafe id accepted');
}
