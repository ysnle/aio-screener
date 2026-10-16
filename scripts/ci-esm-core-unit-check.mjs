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
const { TICKER_CHART_RANGES, selectTickerChartWindow } = await load('src/ui/pages/entity.js');

// P1355: generated version alignment never restamps market data or live Worker observations.
{
  const { alignGeneratedVersion, GENERATED_VERSION_FILES } = await load('scripts/lib/align-generated-version.mjs');
  const revision = 'market-snapshot:2026-10-01T00:34:01Z:fixture';
  const docs = Object.fromEntries(GENERATED_VERSION_FILES.map((path) => [path, { appRevision: 'v56.83', workerRevision: 'sw:v56.83', dataRevision: revision, generatedAt: '2026-10-01T00:34:01Z', planes: { browser: { revision: 'v56.83' } }, health: { sourceSha: 'a'.repeat(40), revision: 'v56.83' } }]));
  const aligned = alignGeneratedVersion(docs, { version: 'v56.87', snapshotRevision: revision });
  if (Object.values(aligned).some((doc) => doc.appRevision !== 'v56.87' || doc.generatedAt !== docs[GENERATED_VERSION_FILES[0]].generatedAt || doc.health.revision !== 'v56.83' || doc.dataRevision !== revision) || docs[GENERATED_VERSION_FILES[0]].appRevision !== 'v56.83') fail('P1355 alignment mutated data/live identity or source documents');
  if (aligned['public-data/operations-status.json'].planes.browser.revision !== 'v56.87') fail('P1355 actual nested browser metadata was not aligned');
  for (const extra of [{ dataRevision: 'market-snapshot:other' }, { appRevision: 'v57.01' }]) {
    let refused = false;
    try { alignGeneratedVersion({ ...docs, [GENERATED_VERSION_FILES[0]]: { ...docs[GENERATED_VERSION_FILES[0]], ...extra } }, { version: 'v56.87', snapshotRevision: revision }); } catch (_) { refused = true; }
    if (!refused) fail('P1355 mixed producer batch or newer revision was accepted');
  }
}

// P1359: original and translated text decode once at the normalization boundary.
{
  const { normalizeNews } = await load('src/data/normalize/news.js');
  const item = normalizeNews({ items: [{ title: '&#036;NBIS &amp;#036;DOUBLE', ko_title: '&#036;NBIS 한글 &amp;#036;DOUBLE', ko_summary: '&#60;script&#62;문자열' }] }).items[0];
  if (item.title !== '$NBIS &#036;DOUBLE' || item.ko_title !== '$NBIS 한글 &#036;DOUBLE' || item.ko_summary !== '<script>문자열') fail('P1359 translated/original text decoding boundary');
}

// P1358: durable derived rotation drives the native provider without exposing raw prices.
{
  const { selectProducedRotation } = await load('src/domain/themes/produced-rotation.js');
  const { createThemesProvider } = await load('src/data/providers/themes.js');
  const now = Date.parse('2026-10-01T00:34:00Z');
  const artifact = { schemaVersion: 'rotation-history.v1', modelVersion: 'rrg.v2', benchmark: 'SPY', timeframe: '1d', priceBasis: 'adjusted-close', sourceKind: 'T3_PUBLIC_DELAYED', allowedUseCeiling: 'reference', decisionUse: false, latestCompletedSession: '2026-09-30', items: { XLK: { status: 'CURRENT', sessionDate: '2026-09-30', observedAt: '2026-09-30T20:00:00Z', fetchedAt: '2026-10-01T00:33:00Z', rsRatio: 101, rsMomentum: 102, quadrant: 'Leading', dailyPct: 1.2, weeklyPct: 3.5, alignedSessionCount: 60, performanceBasis: 'adjusted-close-total-return' } } };
  if (!selectProducedRotation(artifact, 'XLK', now)) fail('P1358 coherent producer rotation was lost');
  // P1366: an absent 1/5-session return keeps the valid coordinates; a non-numeric return does not.
  const partialReturn = selectProducedRotation({ ...artifact, items: { XLK: { ...artifact.items.XLK, dailyPct: null, weeklyPct: null } } }, 'XLK', now);
  if (!partialReturn || partialReturn.rsRatio !== 101 || partialReturn.dailyPct !== null) fail('P1366 missing optional return discarded valid RRG coordinates');
  const partialItem = createThemesProvider({ readRotationHistory: () => ({ ...artifact, items: { XLK: { ...artifact.items.XLK, dailyPct: null } } }), readDefinitions: () => ({ sectors: [{ sym: 'XLK', name: '기술' }] }), now: () => now }).readCurrent().items[0];
  if (partialItem.rsRatio !== 101 || partialItem.pct !== null || partialItem.directionCompatible !== false) fail('P1366 provider claimed a direction without a daily return');
  for (const extra of [{ quadrant: 'Lagging' }, { sessionDate: '2026-09-29' }, { rsRatio: NaN }, { fetchedAt: null }, { alignedSessionCount: 2 }, { dailyPct: '1.2' }, { weeklyPct: NaN }]) {
    if (selectProducedRotation({ ...artifact, items: { XLK: { ...artifact.items.XLK, ...extra } } }, 'XLK', now)) fail('P1358 invalid producer rotation was promoted');
  }
  const provider = createThemesProvider({ readRotationHistory: () => artifact, readDefinitions: () => ({ sectors: [{ sym: 'XLK', name: '기술' }] }), now: () => now });
  const item = provider.readCurrent().items[0];
  if (item.rsRatio !== 101 || item.pct !== 1.2 || item.weeklyPct !== 3.5 || item.price !== null || item.changeBasis !== 'adjusted-close-total-return') fail('P1358 provider bypassed durable rotation or fabricated a raw price');
}

// P1357's reference-observation selector had no runtime caller and was deleted (v57.55 review cleanup, R675).
// P1727: the briefing decision-summary model (no product consumer since the briefing read replaced it) was deleted.

// P1353: refuse unsupported paid search before incrementing counters; personal-key cost stays separate.
{
  const { preparePaidWebSearch } = await load('src/ai/policies/budget.js');
  const state = {};
  let refused = false, counters = 0;
  try { preparePaidWebSearch({ serverKey: true, state, bumpCounter: () => counters++ }); } catch (error) { refused = /월 예산.*유료 웹 검색/.test(error.message); }
  if (!refused || state._aioWebSearchStats || counters !== 0) fail('P1353 shared paid search must fail before request/statistics');
  preparePaidWebSearch({ serverKey: true, health: { ai: { paidWebSearchEnabled: true } }, state, bumpCounter: () => counters++, now: 1000 });
  if (state._aioWebSearchStats.calls !== 1 || counters !== 0) fail('P1608 shared search diagnostics must not consume a personal allowance');
}

// P1352: the production legacy model describes inputs, not an inferred economic expansion/recession.
{
  const core = readFileSync(path.join(root, 'js/aio-core.js'), 'utf8');
  const source = core.match(/window\.AIO\.getCycleFromMacro = function\(macro\) \{[\s\S]*?\n\};/)[0];
  const window = { AIO: { getCurrentBreadthEvidence: () => ({ available: false }) } };
  const finite = (value) => typeof value === 'number' || typeof value === 'string' && value.trim() ? Number.isFinite(Number(value)) ? Number(value) : null : null;
  const model = new Function('window', '_aioStrictFinite', `${source}; return window.AIO.getCycleFromMacro;`)(window, finite);
  const formatterSource = core.match(/window\._aioSafeFixed = function\(v, decimals, fallback\) \{[\s\S]*?\n\};/)[0];
  const formatter = new Function('window', '_aioStrictFinite', `${formatterSource}; return window._aioSafeFixed;`)(window, finite);
  for (const value of [null, undefined, '', ' ', true, false, {}, NaN, Infinity]) {
    if (formatter(value, 2, '미수신') !== '미수신') fail('P1354 missing observation formatted as a numeric value');
  }
  if (formatter(0, 2, '—') !== '0.00' || formatter('1.25', 2, '—') !== '1.25') fail('P1354 formatter rejected real zero/numeric string');
  for (const vix of [16, 30, 35]) {
    const result = model({ vix, breadth50: 35, yield2s10s: -0.3, spxTrend: 'down' });
    if (!['환경 양호', '지표 혼재', '환경 약화'].includes(result.phase) || /경기위치|침체 선행|확장 국면/.test(result.rationale.join(' '))) fail('P1352 market inputs promoted to economic-cycle assertion');
  }
  for (const breadth50 of [true, '', ' ', {}, null]) {
    if (model({ vix: 18, breadth50, spxTrend: 'up' }).score !== null) fail('P1352 invalid breadth produced a score');
  }
}

// P1350: incomplete valuation evidence must not turn into 0% or -100% in AI context.
{
  const { redactPortfolioForAI } = await load('src/storage/financial-security.js');
  const now = Date.parse('2026-09-30T13:00:00Z');
  const positions = [{ ticker: 'AAPL', qty: 2, cost: 100, costCurrency: 'USD' }, { ticker: 'MSFT', qty: 1, cost: 200, costCurrency: 'USD' }];
  const quote = (price) => ({ price, currency: 'USD', observedAt: '2026-09-30T12:00:00Z' });
  const full = redactPortfolioForAI(positions, { now, liveData: { AAPL: quote(150), MSFT: quote(300) } });
  if (full.some((row) => row.allocationPct !== 50 || row.returnPct !== 50)) fail('P1350 full homogeneous valuation fixture');
  for (const price of [null, '', ' ', true, Infinity, {}]) {
    const result = redactPortfolioForAI(positions, { now, liveData: { AAPL: quote(150), MSFT: quote(price) } });
    if (result.some((row) => row.allocationPct !== null) || result[1].returnPct !== null) fail('P1350 incomplete valuation fabricated allocation/return');
  }
  for (const extra of [{ currency: '' }, { currency: 'KRW' }, { observedAt: null, fetchedAt: quote(150).observedAt }, { observedAt: '2026-10-01T12:00:00Z' }, { observedAt: '2026-09-29T12:00:00Z' }, { stale: true }]) {
    const result = redactPortfolioForAI(positions, { now, liveData: { AAPL: quote(150), MSFT: { ...quote(300), ...extra } } });
    if (result.some((row) => row.allocationPct !== null)) fail(`P1350 incoherent valuation evidence: ${JSON.stringify(extra)}`);
  }
  const { buildPortfolioBackup, parsePortfolioBackup } = await load('src/data/portfolio-backup.js');
  const watchlists = [{ id: 'both', name: '양시장', tickers: [{ sym: 'NVDA', note: '메모', addedAt: 100 }, { sym: '005930.KS', note: '한국', addedAt: 200 }] }];
  const round = parsePortfolioBackup(JSON.stringify(buildPortfolioBackup({ watchlists, activeWatchlistId: 'both' })));
  if (!round.ok || JSON.stringify(round.contents.watchlists) !== JSON.stringify(watchlists)) fail('P1350 actual watchlist object round trip loses metadata');
}

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

// RM-07 -> v57.79: the cross-route sentiment summary projection painted four ids no page creates (R705 dead-id
// scan), so it was removed with its module; bootstrap's sentiment sync must not bring a projection writer back.
{
  const bootstrapSource = readFileSync(path.join(root, 'src/app/bootstrap.js'), 'utf8');
  if (/renderSentimentSummaryProjection|ui\/projections\/sentiment-summary/.test(bootstrapSource)) fail('v57.79 retired sentiment summary projection returned to bootstrap'); // text-pin-ok: retirement absence
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
  // P1408: document original → window mirror → document update (same detail, inside the window) delivers twice.
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'p1408' } }));
  windowTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'p1408' } }));
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'p1408' } }));
  if (calls !== 6) fail(`P1408 a suppressed mirror must not swallow the next genuine update (${calls})`);
  windowTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', payload: { revision: 'one' } } }));
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', payload: { revision: 'two' } } }));
  if (calls !== 8) fail(`compatibility event adapter: distinct nested details were incorrectly deduplicated (${calls})`);
  now += 251;
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'same-cycle' } }));
  if (calls !== 9) fail(`compatibility event adapter: expired dedupe record blocked a new event (${calls})`);
  stop();
  stopHistory();
  documentTarget.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { type: 'done', generatedAt: 'after-stop' } }));
  if (calls !== 9) fail('compatibility event adapter: disposed subscription still received events');
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

// P1755: a dot-path state read snapshots only the selected branch. It stays frozen and isolated, is
// reused while that branch's reference is unchanged (even when unrelated slices change), refreshes when
// the branch is replaced, and never disturbs the full-state snapshot cache.
{
  const score = { total: 61, parts: [1, 2] };
  let state = { analysis: { tradingScore: score, signal: { presentation: { description: 'close basis' } } }, screener: { rows: [{ v: 1 }] } };
  const root = {};
  exposeArchitecture(root, { getState: () => state }, { immutableState: true });
  const fullBefore = root.AIO_ARCH.getState();
  const a = root.AIO_ARCH.getState('analysis.tradingScore');
  if (a === score || !Object.isFrozen(a) || !Object.isFrozen(a.parts) || a.total !== 61) fail('P1755 facade path read: snapshot isolation lost');
  try { a.parts[0] = 9; } catch (_) {}
  if (score.parts[0] !== 1) fail('P1755 facade path read: consumer mutated native branch');
  state = { ...state, screener: { rows: [{ v: 2 }] } };
  if (root.AIO_ARCH.getState('analysis.tradingScore') !== a) fail('P1755 facade path read: unrelated slice change recloned the branch');
  if (root.AIO_ARCH.getState('analysis.signal.presentation.description') !== 'close basis') fail('P1755 facade path read: primitive leaf not returned');
  if (root.AIO_ARCH.getState('analysis.missing.deeper') !== undefined) fail('P1755 facade path read: missing branch did not read as undefined');
  const fullAfter = root.AIO_ARCH.getState();
  if (fullAfter === fullBefore || fullAfter.screener.rows[0].v !== 2) fail('P1755 facade path read: full-state snapshot cache disturbed');
  state = { ...state, analysis: { ...state.analysis, tradingScore: { total: 62, parts: [] } } };
  const b = root.AIO_ARCH.getState('analysis.tradingScore');
  if (b === a || b.total !== 62 || a.total !== 61) fail('P1755 facade path read: replaced branch not refreshed');
  const plainRoot = {};
  exposeArchitecture(plainRoot, { getState: () => state });
  const plain = plainRoot.AIO_ARCH.getState('analysis.tradingScore');
  if (plain.total !== 62 || !Object.isFrozen(plain) || plain === state.analysis.tradingScore) fail('P1755 facade path read: non-canonical path read not snapshotted');
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
  // P1408: a 503 with an HTML body keeps its status; a 200 with an unparseable body is a parse failure.
  const htmlError = await createHttpClient({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => { throw new SyntaxError('Unexpected token <'); } }) }).requestJson('fixture');
  const badBody = await createHttpClient({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } }) }).requestJson('fixture');
  if (htmlError.status !== 503 || htmlError.error !== 'HTTP_503' || badBody.ok || badBody.status !== 200 || badBody.error !== 'HTTP_PARSE_FAILED') fail(`P1408 http status lost: ${JSON.stringify([htmlError.status, htmlError.error, badBody.error])}`);
  // P1409: unparseable valuation times and mixed horizons are not comparable.
  const { createReturnObservation, assertComparableReturns } = await load('src/domain/screener/return-contract.js');
  const obs = (start, end) => ({ kind: 'price', adjustment: 'split', currency: 'USD', startValuationAt: start, endValuationAt: end, value: 0.1 });
  if (createReturnObservation(obs('nonsense', 'nope')).ok) fail('P1409 unparseable valuation times accepted');
  if (assertComparableReturns([obs('2026-08-30', '2026-09-30'), obs('2020-09-30', '2026-09-30')]).comparable) fail('P1409 one-month and six-year returns treated as comparable');
  if (!assertComparableReturns([obs('2026-08-29', '2026-09-30'), obs('2026-08-30', '2026-09-30')]).comparable) fail('P1409 same-horizon returns refused');
  // P1407: mixed-currency risk weights are valued in one base currency or held.
  const { assembleRiskEstimateInput } = await load('src/ui/panels/portfolio-risk-input.js');
  const riskDates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-28', '2026-09-29'];
  const riskHist = (base) => Object.fromEntries(riskDates.map((d, i) => [d, base * (1 + 0.01 * Math.sin(i))]));
  const riskEv = (value) => ({ allowedUse: true, value, ts: Date.parse('2026-09-30T00:00:00Z') });
  const riskBase = { positions: [{ ticker: 'AAPL', qty: 1 }, { ticker: '005930.KS', qty: 1 }], priceEvidenceMap: { AAPL: riskEv(100), '005930.KS': riskEv(100000) }, historyMap: { AAPL: riskHist(100), '005930.KS': riskHist(100000) }, validTickers: ['AAPL', '005930.KS'], commonDates: riskDates, cashValue: 0, nowIso: '2026-09-30T00:00:00Z' };
  const unconverted = assembleRiskEstimateInput({ ...riskBase, declarations: { baseCurrency: 'USD' } });
  const converted = assembleRiskEstimateInput({ ...riskBase, declarations: { baseCurrency: 'USD' }, fxLegs: [{ from: 'USD', to: 'KRW', rate: 1400, observedAt: '2026-09-29T12:00:00Z' }] });
  if (unconverted.ok || unconverted.code !== 'currency-unconverted' || !converted.ok || Math.round(converted.snapshot.equityValue) !== 171) fail(`P1407 mixed-currency risk weights: ${unconverted.code} ${converted.snapshot?.equityValue}`);
  const { formatMoney } = await load('src/ui/pages/portfolio.js');
  if (formatMoney(100000, 'KRW') !== '₩100,000' || formatMoney(100, 'USD') !== '$100') fail('P1407 portfolio totals must carry their currency');
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
  const { createLifecycleRouter, createRouteRegistry, normalizeNavigationCommand, parseRouteDeepLink } = await load('src/app/router.js');
  const pathLink = parseRouteDeepLink('#ticker/nvda');
  if (pathLink?.routeId !== 'ticker' || pathLink.entityId !== 'NVDA' || parseRouteDeepLink('#ticker?sym=AAPL')?.entityId !== 'AAPL' || parseRouteDeepLink('#ticker/<x>')?.entityId !== null) fail(`v57.54 a path-style #ticker/NVDA link opens that company (it was a blank page), got ${JSON.stringify(pathLink)}`);
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

// ── E0/P1278: a same-route re-commit carries the committed view state ───────────────────────
// The old branch returned after the marker restore and silently dropped the payload, so a
// view change on the same route/entity (tab, filter, anchor intent) was invisible to the
// store and to every consumer of the commit result. The re-commit must move the committed
// view state and publish it — without remounting and without noise when nothing changed.
{
  const { createLifecycleRouter, createRouteRegistry } = await load('src/app/router.js');
  const mounts = [];
  const committed = [];
  const target = new EventTarget();
  const registry = createRouteRegistry({ modules: { breadth: { route: 'breadth', mount: () => { mounts.push('breadth'); return () => {}; } } } });
  const router = createLifecycleRouter({ root: target, registry, context: {} });
  target.addEventListener('aio:navigationCommitted', (event) => committed.push(event.detail));
  router.start();
  router.transition('breadth', { source: 'initial-load' });
  if (router.activeViewState() !== null) fail('P1278 router: a commit without a view state published one');
  if (committed[0]?.viewState !== null || committed[0]?.recommit !== false) fail(`P1278 router: the initial commit result lost its view-state field: ${JSON.stringify(committed[0])}`);
  router.transition('breadth', { source: 'architecture-navigation' });
  if (mounts.length !== 1 || committed.length !== 1) fail(`P1278 router: an unchanged same-route re-commit must stay a no-op, got mounts=${mounts.length}, commits=${committed.length}`);
  const viewA = Object.freeze({ tab: 'sma50' });
  if (router.transition('breadth', { source: 'architecture-navigation', viewState: viewA }) !== true) fail('P1278 router: a view-state re-commit was rejected');
  const recommit = committed[committed.length - 1];
  if (committed.length !== 2 || recommit?.recommit !== true || recommit?.viewState !== viewA || recommit?.mountId !== 1 || recommit?.routeId !== 'breadth') fail(`P1278 router: the view-state re-commit did not publish the same mount with its new view state: ${JSON.stringify(recommit)}`);
  if (router.activeViewState() !== viewA) fail('P1278 router: activeViewState() did not follow the re-commit');
  if (mounts.length !== 1) fail('P1278 router: a view-state re-commit remounted the route');
  router.transition('breadth', { source: 'architecture-navigation', viewState: viewA });
  if (committed.length !== 2) fail('P1278 router: re-committing the identical view state published duplicate commits');
  const viewB = Object.freeze({ tab: 'sma5' });
  router.transition('breadth', { source: 'architecture-navigation', viewState: viewB });
  if (router.activeViewState() !== viewB || committed.length !== 3) fail('P1278 router: a second view state on the same mount did not move the committed view identity');
  router.transition('home', { source: 'architecture-navigation' });
  if (router.activeViewState() !== null) fail('P1278 router: a real transition did not reset the committed view state');
  router.dispose();
  if (router.activeViewState() !== null) fail('P1278 router: dispose() kept a committed view state');
}

// ── E0/P1279: a failed commit must not leave the shell on an unmounted page ─────────────────
// The legacy side effect runs before the router commits, and the router clears its active
// state when a mount throws. Without a rollback the user saw a page whose router never
// committed it. The facade now re-commits the previous route through the same typed boundary
// and publishes aio:navigationFailed; the failure is never a split surface.
{
  const { createLifecycleRouter, createRouteRegistry } = await load('src/app/router.js');
  const { createLegacyFacade } = await load('src/legacy/compatibility-facade.js');
  const shown = [];
  const events = new EventTarget();
  const root = { document: events, showPage(pageId) { shown.push(pageId); return true; } };
  const registry = createRouteRegistry({ modules: {
    home: { route: 'home', mount: () => () => {} },
    macro: { route: 'macro', mount: () => { throw new Error('fixture-mount-failure'); } }
  } });
  const router = createLifecycleRouter({ root: events, registry, context: {} });
  router.start();
  router.transition('home', { source: 'initial-load' });
  const failed = [];
  events.addEventListener('aio:navigationFailed', (event) => failed.push(event.detail));
  const legacy = createLegacyFacade(root, events);
  const navigation = legacy.installNavigation(router);
  if (!navigation.installed) fail('P1279 facade: navigation facade did not install over the callable showPage');
  const result = root.showPage('macro');
  if (result !== false) fail('P1279 facade: a failed commit reported the legacy show result as success');
  if (shown.join(',') !== 'macro,home') fail(`P1279 facade: the shell was not rolled back to the committed route, shown=${shown.join(',')}`);
  if (router.active() !== 'home') fail(`P1279 facade: the router did not re-commit the previous route, active=${router.active()}`);
  if (failed.length !== 1 || failed[0]?.routeId !== 'macro' || failed[0]?.rolledBack !== true) fail(`P1279 facade: the failed commit was not observable: ${JSON.stringify(failed)}`);
  navigation.restore();
  router.dispose();
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
  if (!audit.ok || audit.sliceCount !== 12 || audit.coveredRoutes.length !== ROUTE_IDS.length) fail(`vertical-slices: registry coverage drifted: ${JSON.stringify(audit)}`);
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
  // P1388 (v4): the risk-appetite axis reads put/call + HY; reference-only values must not drive it.
  const blocked = computeTradingScoreModel({ decisionEvidence: { ...full, pcr: reference(1), hyBp: reference(300) } });
  if (blocked.total !== null || !blocked.decisionBlocked || !blocked.componentMissing.includes('momentum')) fail(`truth-boundary: reference put/call + HY must not drive Trading Score: ${JSON.stringify(blocked)}`);
  const fgIgnored = computeTradingScoreModel({ decisionEvidence: { ...full, fg: decision(5) } });
  if (fgIgnored.total !== valid.total) fail(`P1388: F&G must not enter the composite (it already contains VIX and put/call): ${fgIgnored.total} vs ${valid.total}`);
  const newsBypass = computeTradingScoreModel({ decisionEvidence: full, newsSentimentScore: 100, newsRiskSignals: [{ impact: 30 }] });
  if (newsBypass.total !== valid.total || newsBypass.newsAdjustmentApplied) fail(`truth-boundary: raw news heuristic bypassed decision evidence: ${JSON.stringify(newsBypass)}`);
  const newsReference = computeTradingScoreModel({ decisionEvidence: { ...full, newsSentimentScore: reference(100), newsRiskSignals: reference([{ impact: 30 }]) }, newsSentimentScore: 100, newsRiskSignals: [{ impact: 30 }] });
  if (newsReference.total !== valid.total || newsReference.newsAdjustmentApplied) fail(`truth-boundary: reference-only news heuristic changed a decision score: ${JSON.stringify(newsReference)}`);
  // P1554: the risk-appetite axis averages put/call and the HY spread; with one reading missing the axis is one reading standing in
  // for two, so the score is partial (asterisk) even though the axis counts as present.
  const { pcr: _droppedPcr, ...withoutPcr } = full;
  const onePart = computeTradingScoreModel({ decisionEvidence: withoutPcr });
  if (valid.partial !== false || onePart.total == null || onePart.partial !== true || onePart.componentMissing.includes('momentum')) fail(`P1554: a single appetite reading must make the score partial without dropping the axis: ${JSON.stringify({ valid: valid.partial, onePart: onePart.partial, missing: onePart.componentMissing })}`);
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

// P1348: use the shipped compatibility registry, not a fixture alias map.
{
  const source = readFileSync(path.join(root, 'js/aio-core.js'), 'utf8');
  const begin = source.indexOf('window.AIO_ROUTE_REGISTRY =');
  const end = source.indexOf('window.AIO_ROUTE_REGISTRY.classes.NAV_ROUTE', begin);
  const shipped = {};
  new Function('window', source.slice(begin, end))(shipped);
  const committed = [];
  const aliasRoot = { AIO_ROUTE_REGISTRY: shipped.AIO_ROUTE_REGISTRY, showPage: () => true };
  const facade = createLegacyFacade(aliasRoot, new EventTarget());
  const navigation = facade.installNavigation({ transition: (route) => { committed.push(route); return true; } });
  for (const alias of ['chart', 'news', 'help', 'options']) aliasRoot.showPage(alias);
  navigation.restore();
  if (committed.join(',') !== 'technical,market-news,guide,sentiment'
    || shipped.AIO_ROUTE_REGISTRY.canonical['theme-detail'] !== 'themes') fail('P1348: shipped aliases disagreed with native navigation');
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
      SPY: { pct: 1.5, price: 550 }, '^GSPC': { price: 550 } /* v57.84: index level, same unit as spxMA */, QQQ: { pct: 1.2, price: 480 }, '^VIX': { price: 14 },
      AAPL: { pct: 1 }, MSFT: { pct: 1 }, GOOGL: { pct: 1 }, AMZN: { pct: 1 }, NVDA: { pct: 1 }, META: { pct: 1 }, TSLA: { pct: 1 },
      XLK: { pct: 1 }, XLF: { pct: 1 }, XLE: { pct: 1 }, XLV: { pct: 1 }, XLI: { pct: 1 }, XLY: { pct: 1 }
    },
    spxMA: { 50: 500, 200: 450 },
    spxATH: 560
  });
  if (!bullish.available || bullish.score !== 100 || bullish.grade !== 'A+' || bullish.bars.trend !== 85 || bullish.inputs.leaderTotal !== 7) fail(`market-health: bullish thresholds drifted, got ${JSON.stringify(bullish)}`);
  const defensive = computeMarketHealth({ quotes: { SPY: { pct: -2, price: 400 }, '^GSPC': { price: 400 }, QQQ: { pct: -2 }, '^VIX': { price: 35 } }, spxMA: { 50: 450, 200: 500 } });
  if (!defensive.available || defensive.score !== 4 || defensive.grade !== 'F' || defensive.regime !== '극심한 약세') fail(`market-health: defensive thresholds drifted, got ${JSON.stringify(defensive)}`);
  const neutral = computeMarketHealth({ quotes: { SPY: { pct: 0 }, QQQ: { pct: 0 }, '^VIX': { price: 20 } } });
  // v57.50 C13: VIX 20 sits in the RULES.volatility 통상 범위 (18-25, no points), so 50 - 4 (QQQ flat) = 46.
  if (!neutral.available || neutral.score !== 46 || neutral.grade !== 'C' || !neutral.details.some((line) => /VIX 20\.0 통상 범위/.test(line)) || neutral.bars.spy !== 50 || neutral.bars.qqq !== 50) fail(`market-health: neutral baseline drifted, got ${JSON.stringify(neutral)}`);
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
  // P1537 (audit H07): the article list follows the country/topic/type controls; the channel list below it never does.
  // Both scopes are stated, and the channel note is true for every control state (it used to be silent when only the
  // 텔레그램 type chip narrowed the articles).
  const { describeNewsScope } = await load('src/ui/pages/news.js');
  // v57.77: the type tabs left — the 텔레그램 chip is countryFilter 'tg', and 기업 is the 'company' topic.
  const none = describeNewsScope({ countryFilter: 'all', topicFilter: 'all' });
  const country = describeNewsScope({ countryFilter: 'kr', topicFilter: 'all' });
  const topic = describeNewsScope({ countryFilter: 'all', topicFilter: 'company' });
  const channelChip = describeNewsScope({ countryFilter: 'tg', topicFilter: 'all' });
  if (!none || none.articles !== '필터 없음' || none.channel !== '') fail(`P1537 no controls: articles read 필터 없음 and the channel note stays empty, got ${JSON.stringify(none)}`);
  if (describeNewsScope({ countryFilter: 'all', topicFilter: 'all', typeTab: 'company' }).articles !== '필터 없음') fail('v57.77 a stray retired typeTab key is not a filter');
  if (country.articles !== '필터 적용' || topic.articles !== '필터 적용' || channelChip.articles !== '필터 적용') fail('P1537 any country or topic control (including 텔레그램 and 기업) makes the article scope read 필터 적용');
  if (!/국가·주제 필터와 무관/.test(country.channel) || country.channel !== topic.channel || country.channel !== channelChip.channel) fail(`P1537 the channel note must state it ignores the country/topic filter whenever a control is active, got ${JSON.stringify([country.channel, topic.channel, channelChip.channel])}`);
  if (describeNewsScope(null).articles !== '필터 없음' || describeNewsScope(undefined).channel !== '') fail('P1537 missing controls read as no filter');
  // v57.77: 뉴스 ends with 이어서 볼 곳 like every other screen — 브리핑 then 시장 상태; 한국 opens the Korea board.
  const { newsFlow } = await load('src/domain/market/page-flow.js');
  const plainNext = newsFlow().next;
  const krNext = newsFlow({ countryFilter: 'kr' }).next;
  if (plainNext.map((item) => item.route).join(',') !== 'briefing,signal' || plainNext.some((item) => !item.label || !item.why)) fail(`v57.77 newsFlow links 브리핑 then 시장 상태 with a reason each, got ${JSON.stringify(plainNext)}`);
  if (krNext[1]?.route !== 'signal' || krNext[1]?.ctx?.anchor !== 'regime-board-kr' || plainNext[1]?.ctx) fail(`v57.77 newsFlow opens the 한국 board only under the 한국 filter, got ${JSON.stringify(krNext)}`);
  const newsSource = (await import('node:fs')).readFileSync(new URL('../src/ui/pages/news.js', import.meta.url), 'utf8');
  if (!/getAbsoluteTime[\s\S]{0,80}\|\|\s*formatAbsoluteTime\(/.test(newsSource) || !/data-published-at|dataset\.publishedAt/.test(newsSource)) {
    fail('W09-C: the news card must fall back to the local formatter and keep the raw publication instant');
  }
}

// ── domain boundary missingness and immutability ─────────────────────────────────────────────
{
  const { classifyRRG, computeRelativeRotation } = await load('src/domain/themes/rrg.js');
  if (classifyRRG(null, null).quadrant !== 'unknown') fail('rrg: missing values became a Lagging quadrant');
  // P1591: fixtures follow RRG_MIN_SESSIONS (30) — the same minimum the themes copy states.
  const invalidRotation = computeRelativeRotation({ history: Array(31).fill(NaN), benchmarkHistory: Array(31).fill(100), hasQuote: true, hasBenchmarkQuote: true });
  const alignedTail = computeRelativeRotation({ history: Array.from({ length: 31 }, (_, index) => 100 + index), benchmarkHistory: [...Array(20).fill(10), ...Array.from({ length: 31 }, (_, index) => 100 + index)], hasQuote: true, hasBenchmarkQuote: true });
  if (alignedTail.quadrant !== 'Leading' || Math.abs(alignedTail.rsRatio - 100) > 1e-9 || Math.abs(alignedTail.rsMom - 100) > 1e-9) fail(`rrg: unequal histories were not aligned on their common tail: ${JSON.stringify(alignedTail)}`);
  if (invalidRotation.quadrant !== 'unknown') fail('rrg: invalid history produced a quadrant');
  const shortRotation = computeRelativeRotation({ history: Array.from({ length: 29 }, (_, index) => 100 + index), benchmarkHistory: Array(29).fill(100), hasQuote: true, hasBenchmarkQuote: true });
  if (shortRotation.quadrant !== 'unknown' || shortRotation.reason !== 'relative_history_lt_30') fail(`P1591 rrg: fewer than 30 aligned sessions must stay unclassified, got ${JSON.stringify(shortRotation)}`);
  // Expert review M09: the scatter axes span every plotted sector (10/12: XLI 92.9 … XLE 107.9) and keep the 100 baseline inside.
  const { rrgAxisDomain } = await load('src/domain/themes/rrg.js');
  const rrgPoints = [{ rsRatio: 92.92, rsMomentum: 92.09 }, { rsRatio: 107.91, rsMomentum: 105.65 }, { rsRatio: 102.41, rsMomentum: 106.99 }, { rsRatio: 93.11, rsMomentum: 93.45 }];
  const rrgAxes = rrgAxisDomain(rrgPoints);
  if (rrgPoints.some((p) => p.rsRatio <= rrgAxes.x.min || p.rsRatio >= rrgAxes.x.max || p.rsMomentum <= rrgAxes.y.min || p.rsMomentum >= rrgAxes.y.max) || rrgAxes.x.ticks.length < 3 || !(rrgAxes.x.min < 100 && rrgAxes.x.max > 100)) fail(`M09 rrg axes must contain every point and the 100 baseline: ${JSON.stringify(rrgAxes)}`);
  const nearAxes = rrgAxisDomain([{ rsRatio: 101, rsMomentum: 101.2 }]);
  if (!(nearAxes.x.min < 100 && nearAxes.y.min < 100)) fail('M09 rrg axes must include the 100 baseline even when every point is above it');
  const { deriveHomeSummary } = await load('src/domain/home/summary.js');
  if (deriveHomeSummary({ sentiment: { fearGreed: NaN }, signal: { score: Infinity }, newsCount: -2 }).status !== 'unavailable') fail('home: non-finite inputs counted as available');
  const { deriveSentimentSummary } = await load('src/domain/sentiment/metrics.js');
  const sentiment = deriveSentimentSummary({ fearGreed: 101, vix9d: -1, vix: 17, vix3m: 20, vix6m: 22 });
  if (!sentiment.blocked || !Object.isFrozen(sentiment.vixTermStructure.points)) fail('sentiment: out-of-domain inputs were promoted or mutable');
  // P1426: the transmission lens was retired; the macro read's direction helpers are pure and checked here.
  const { sahmGap, annualised3m, yoySeries } = await load('src/domain/macro/macro-read.js');
  const months = (values) => values.map((value, index) => ({ date: new Date(Date.UTC(2025, index, 1)).toISOString().slice(0, 10), value }));
  const sahm = sahmGap(months([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4.4, 4.6, 4.8]));
  if (!sahm || Math.abs(sahm.value - 0.6) > 1e-9) fail('macro: Sahm gap is not the 3-month average minus the prior 12-month low');
  if (Math.abs(annualised3m(months([100, 100, 100, 101])).value - (1.01 ** 4 - 1) * 100) > 1e-9) fail('macro: the 3-month pace is not annualised');
  if (yoySeries(months(Array(13).fill(0))).length !== 0) fail('macro: a zero base produced a year-over-year rate');
  const { classifyNewsTextStance, computeNewsSentimentScore, computeNewsRiskSignals, deriveNewsSummary, MIN_NEWS_ANALYSIS_SAMPLE, NEWS_SCORING_MODEL_VERSION, normalizeNewsSentimentHistory } = await load('src/domain/news/scoring.js');
  if (classifyNewsTextStance('The commissioner dismissed Bullard from the panel') !== 'neut' || classifyNewsTextStance('Stocks surged after earnings beat') !== 'bull') fail('news: substring collision or valid inflection regression');
  const fixedNewsNow = Date.parse('2026-09-08T01:00:00Z');
  const newsItems = (titles) => titles.map((title) => ({ title, desc: 'The full article body provides more than enough reviewed context to support article-level analysis.', pubDate: '2026-09-07T12:00:00Z' }));
  if (computeNewsRiskSignals({ now: fixedNewsNow, items: newsItems(['Set your default browser', 'The story spreads online', 'Credit card rewards expand']) }).some((row) => row.type === 'credit')) fail('news: neutral words produced credit stress');
  if (!computeNewsRiskSignals({ now: fixedNewsNow, items: newsItems([
    'Credit spreads widen',
    'Bond market default risk rises',
    'Banks face credit stress',
    'Corporate debt distress deepens',
    'Lenders report borrower defaults'
  ]) }).some((row) => row.type === 'credit')) fail('news: explicit credit stress was lost');
  if (computeNewsSentimentScore({ items: 'bad' }).total !== 0 || computeNewsSentimentScore({ items: [{ pubDate: '2026-01-01' }], now: NaN }).label !== '데이터 부족' || computeNewsRiskSignals({ items: 'bad' }).length !== 0) fail('news: malformed collection/time did not fail closed');
  const longNewsBody = 'The published article contains enough source text to ground a summary and sentiment classification.';
  const thinBullishNews = { title: 'Stocks surge rally beat expectations', desc: longNewsBody, pubDate: '2026-09-07T12:00:00Z' };
  const thinSample = computeNewsSentimentScore({ items: [thinBullishNews], now: fixedNewsNow });
  const thinSummary = deriveNewsSummary({ items: [thinBullishNews], now: fixedNewsNow });
  const fiveArticleSample = computeNewsSentimentScore({ items: newsItems([
    'Stocks surge rally beat expectations',
    'Shares surge rally beat forecasts',
    'Markets surge rally beat estimates',
    'Firms surge rally beat projections',
    'Funds surge rally beat consensus'
  ]), now: fixedNewsNow });
  const thinRiskItems = newsItems([
    'Energy prices crash plunge amid crisis',
    'Energy stocks collapse during trade war',
    'Energy market crash deepens amid conflict',
    'Energy exports plunge amid sanctions'
  ]).map((item) => ({ ...item, topic: 'energy', topicSource: 'article', topicReviewRequired: false }));
  if (MIN_NEWS_ANALYSIS_SAMPLE !== 5
    || thinSample.total !== 1 || thinSample.score !== null || thinSample.label !== '표본 부족'
    || thinSummary.score !== null || thinSummary.label !== '표본 부족' || thinSummary.sampleSufficient !== false
    || computeNewsRiskSignals({ items: thinRiskItems, now: fixedNewsNow }).length !== 0
    || fiveArticleSample.total !== MIN_NEWS_ANALYSIS_SAMPLE || !fiveArticleSample.sampleSufficient || fiveArticleSample.score !== 100) {
    fail('P1284/R633: sentiment and risk outputs must hold below five eligible articles and publish from a sufficient bullish sample');
  }
  const oldNewsHistoryPoint = { time: '09:00', score: 100, bull: 1, bear: 0 };
  const thinNewsHistoryPoint = { ...oldNewsHistoryPoint, eligibleCount: 1, sampleSufficient: true, modelVersion: NEWS_SCORING_MODEL_VERSION };
  const wrongModelHistoryPoint = { ...thinNewsHistoryPoint, eligibleCount: 5, modelVersion: 'news-scoring.v1' };
  const validNewsHistoryPoint = { ...thinNewsHistoryPoint, eligibleCount: 5 };
  const normalizedNewsHistory = normalizeNewsSentimentHistory([oldNewsHistoryPoint, thinNewsHistoryPoint, wrongModelHistoryPoint, validNewsHistoryPoint]);
  if (normalizedNewsHistory.length !== 1 || normalizedNewsHistory[0] !== validNewsHistoryPoint
    || normalizeNewsSentimentHistory([validNewsHistoryPoint], 0).length !== 1) {
    fail('P1285/R635: persisted news charts must discard legacy, below-minimum, and wrong-model scores while retaining a sufficient current-model point');
  }
  const legacyNewsSource = readFileSync(path.join(root, 'js/aio-data.js'), 'utf8');
  const newsBootstrapSource = readFileSync(path.join(root, 'src/app/bootstrap.js'), 'utf8');
  const legacyCoreNewsSource = readFileSync(path.join(root, 'js/aio-core.js'), 'utf8');
  const legacyFacadeNewsSource = readFileSync(path.join(root, 'src/legacy/compatibility-facade.js'), 'utf8');
  // v57.78: the loop audit (getAutonomousLoopAudit) moved to the on-demand QA bundle.
  const legacyQaAuditNewsSource = readFileSync(path.join(root, 'js/aio-qa-audits.js'), 'utf8');
  const legacyScoreFallback = legacyNewsSource.match(/function computeNewsSentimentScore\(items\) \{[\s\S]*?\n\}/)?.[0] || '';
  if (!/if \(!_bucketScore \|\| _bucketScore\.sampleSufficient !== true \|\| Number\(_bucketScore\.total\) < _minNewsSample \|\| _bucketScore\.score == null\) continue/.test(legacyNewsSource)
    || !/if \(ns && ns\.sampleSufficient === true && Number\(ns\.total\) >= _minNewsSample && ns\.score != null && Number\.isFinite\(Number\(ns\.score\)\)\) \{\s*_nsh\.push/.test(legacyNewsSource)
    || !/_normalizeNewsHistory\(window\._newsSentimentHistory\)/.test(legacyNewsSource)
    || !/normalizeNewsSentimentHistory/.test(newsBootstrapSource)
    || !/MIN_NEWS_ANALYSIS_SAMPLE/.test(newsBootstrapSource)
    || !/MIN_NEWS_ANALYSIS_SAMPLE:\s*api\.MIN_NEWS_ANALYSIS_SAMPLE/.test(legacyFacadeNewsSource)
    || !/score: null,[\s\S]*?sampleSufficient: false/.test(legacyScoreFallback)
    || /score:\s*50/.test(legacyScoreFallback)) {
    fail('P1285/R635: legacy news fallback and chart persistence must require the current sufficient-sample contract, including rehydrated history');
  }
  if (!/configuredMinNewsSample = Number\(window\.AIO_ARCH && window\.AIO_ARCH\.MIN_NEWS_ANALYSIS_SAMPLE\)/.test(legacyCoreNewsSource)
    || !/if \(!minNewsSampleReady \|\| total < minNewsSample\)/.test(legacyCoreNewsSource)
    || !/sentimentScore: null, bull: null, bear: null, warn: null, neut: null,[\s\S]*?sampleSufficient: false/.test(legacyCoreNewsSource)
    || !/newsSignal\.sampleSufficient === true/.test(legacyCoreNewsSource)
    || !/newsSignal\.sentimentScore === 'number' && Number\.isFinite\(newsSignal\.sentimentScore\)/.test(legacyCoreNewsSource)
    || !/ns\.sampleSufficient === true && ns\.decisionEligible === true && Number\(ns\.total\) >= minNewsSample[\s\S]*?typeof ns\.sentimentScore === 'number' && Number\.isFinite\(ns\.sentimentScore\)/.test(legacyCoreNewsSource)
    || !/sig\.sampleSufficient === true && Number\(sig\.total\) >= minNewsSample[\s\S]*?typeof sig\.sentimentScore === 'number' && Number\.isFinite\(sig\.sentimentScore\)/.test(legacyQaAuditNewsSource)
    || !/stages\.signal = \{ ok: !!signalSampleSufficient/.test(legacyQaAuditNewsSource)) {
    fail('P1288/R638: the legacy news aggregate, market-state consumer, action-plan consumer, and loop audit must fail closed below the shared minimum sample');
  }
  const { exposeArchitecture } = await load('src/legacy/compatibility-facade.js');
  const exposedNewsThreshold = {};
  exposeArchitecture(exposedNewsThreshold, { MIN_NEWS_ANALYSIS_SAMPLE });
  if (exposedNewsThreshold.AIO_ARCH?.MIN_NEWS_ANALYSIS_SAMPLE !== MIN_NEWS_ANALYSIS_SAMPLE) {
    fail('P1288/R638: the bootstrap minimum-news threshold did not cross the legacy AIO_ARCH facade used by aio-core');
  }
  const nativeNewsSource = readFileSync(path.join(root, 'src/ui/pages/news.js'), 'utf8');
  // P1672: the keyword sentiment strip left with P1391, so the native news page shows no sentiment score at all.
  if (/news-sent-score|news-risk-label/.test(nativeNewsSource)) {
    fail('P1284/R633: the native news summary must not display a keyword sentiment score');
  }
  const headlineOnly = { title: 'Markets crash and plunge', desc: longNewsBody, pubDate: '2026-09-07T12:00:00Z', contentDepth: 'summary', verificationStatus: 'headline-only' };
  if (computeNewsSentimentScore({ items: [headlineOnly], now: fixedNewsNow }).total !== 0) fail('LC-32/P1268: verificationStatus headline-only remained sentiment evidence when contentDepth disagreed');
  const feedTopicRows = newsItems([
    'Energy prices crash and plunge after crisis',
    'Energy stocks collapse amid trade war',
    'Energy market crash deepens amid conflict',
    'Energy exports plunge amid sanctions',
    'Energy contracts collapse during military conflict'
  ])
    .map((item) => ({ ...item, topic: 'energy', topicSource: 'feed-query', topicReviewRequired: true }));
  const reviewedTopicRows = feedTopicRows.map((item) => ({ ...item, topicSource: 'article', topicReviewRequired: false }));
  if (computeNewsRiskSignals({ now: fixedNewsNow, items: feedTopicRows }).some((row) => row.type === 'energy')) fail('LC-31/P1268: feed-query topic produced an article-topic risk signal before review');
  if (!computeNewsRiskSignals({ now: fixedNewsNow, items: reviewedTopicRows }).some((row) => row.type === 'energy')) fail('LC-31/P1268: reviewed article topic stopped producing a supported risk signal');
  const completedCycle = deriveNewsSummary({
    items: newsItems([
      'A neutral verified market update',
      'A neutral verified market update two',
      'A neutral verified market update three',
      'A neutral verified market update four',
      'A neutral verified market update five'
    ]).map((item) => ({ ...item, pubDate: '2026-09-07T00:00:00Z', source: 'Reuters' })),
    now: fixedNewsNow,
    windowStart: '2026-09-06T23:00:00Z',
    windowEnd: '2026-09-07T23:00:00Z'
  });
  if (completedCycle.analyzedCount !== 5 || completedCycle.score !== 50 || completedCycle.sourceCount !== 1 || completedCycle.sampleSufficient !== true) fail('LC-07/P1268: the displayed score/count/source projection diverged from the same completed-cycle items');
  const noEvidenceSummary = deriveNewsSummary({ items: [], now: fixedNewsNow });
  if (noEvidenceSummary.score !== null || noEvidenceSummary.label !== '분석 보류' || computeNewsSentimentScore({ items: [], now: fixedNewsNow }).score !== 50) fail('LC-93/P1268: a producer baseline score of 50 leaked as an observed empty-sample score');
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
  // P1536 (owner decision, agent-recommended): a position that declares a cached or reference quote is withheld, never weighted
  // with that price and never given a concentration penalty; the legacy wrapper already refuses it, so the model now agrees.
  const quoteMix = deriveConcentrationRisk({
    positions: [
      { ticker: 'LIVE', shares: 10, price: 100, quoteSourceKind: 'live-quote' },
      { ticker: 'CACHED', shares: 10, price: 100, quoteSourceKind: 'cached-close' },
      { ticker: 'REF', shares: 10, price: 100, allowedUse: 'reference' },
      { ticker: 'EXPLICIT', value: 5000, quoteSourceKind: 'portfolio-state' },
      { ticker: 'DECISION', shares: 10, price: 100, currentQuoteAllowedUse: true },
      { ticker: 'UNLABELED', shares: 10, price: 100 }
    ]
  });
  const quoteStatus = Object.fromEntries(quoteMix.items.map((item) => [item.ticker, item.status + (item.reason ? `:${item.reason}` : '')]));
  if (quoteStatus.CACHED !== 'data-insufficient:quote-not-decision-grade' || quoteStatus.REF !== 'data-insufficient:quote-not-decision-grade' || quoteStatus.EXPLICIT !== 'data-insufficient:quote-not-decision-grade') fail(`P1536 a declared non-decision quote must be withheld: ${JSON.stringify(quoteStatus)}`);
  if (quoteStatus.LIVE !== 'ok' || quoteStatus.DECISION !== 'ok' || quoteStatus.UNLABELED !== 'ok') fail(`P1536 live, decision-grade and unlabeled positions keep their weights: ${JSON.stringify(quoteStatus)}`);
  if (quoteMix.totalValue !== 3000 || quoteMix.heldItems.length !== 3) fail(`P1536 withheld positions must stay out of the denominator and be listed as held: total ${quoteMix.totalValue}, held ${quoteMix.heldItems.length}`);
  if (quoteMix.items.filter((item) => item.status !== 'ok').some((item) => item.weightPct !== null || item.concentrationPenalty !== 0)) fail('P1536 a withheld position must publish neither a weight nor a penalty');
  // P1561: weights over a denominator that leaves positions out are a partial result and say so; a complete or explicit-total set is current.
  if (quoteMix.status !== 'partial' || !quoteMix.issues.includes('held-positions-excluded-from-denominator') || quoteMix.weightBasis !== 'priced-positions-only') fail(`P1561 withheld positions outside the denominator must make the result partial: ${JSON.stringify({ status: quoteMix.status, issues: quoteMix.issues, basis: quoteMix.weightBasis })}`);
  const allPriced = deriveConcentrationRisk({ positions: [{ ticker: 'A', shares: 1, price: 100, quoteSourceKind: 'live-quote' }, { ticker: 'B', shares: 1, price: 100, quoteSourceKind: 'live-quote' }] });
  const heldWithTotal = deriveConcentrationRisk({ positions: [{ ticker: 'A', shares: 1, price: 100, quoteSourceKind: 'live-quote' }, { ticker: 'B', shares: 1, price: 100, quoteSourceKind: 'cached-close' }], totalValue: 400 });
  if (allPriced.status !== 'current' || allPriced.issues.length || heldWithTotal.status !== 'current') fail('P1561 a fully priced set and a set with an explicit total stay current');
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
  // P1349: a reference score needs completed-close evidence, not real-time decision-grade inputs.
  if (blocked.presentation?.decision !== '점수 보류 — 확정 종가 근거 부족' || !/확정 종가 기준의 필수 근거/.test(blocked.presentation?.description || '') || /실시간·검증된 입력/.test(blocked.presentation?.description || '')) fail(`P1349: blocked presentation contradicts the close-basis reference policy ${JSON.stringify(blocked.presentation)}`);
  // ── P1328/R670: the reference score is computed on the latest completed US regular close ──
  {
    const { resolveCloseBasis, evaluateCloseBasisInput, describeCloseBasis } = await load('src/domain/signal/close-basis.js');
    const now = Date.parse('2026-09-29T01:50:00Z'); // Tue 10:50 KST, US closed after Mon 9/28
    const basis = resolveCloseBasis(now);
    if (basis?.date !== '2026-09-28' || basis.previousDate !== '2026-09-25' || new Date(basis.closeMs).toISOString() !== '2026-09-28T20:00:00.000Z' || basis.inSession) fail(`close basis: wrong latest session ${JSON.stringify(basis)} (P1328)`);
    if (describeCloseBasis(basis) !== '9/28 미국 정규장 종가 기준') fail('close basis: label drifted (P1328)');
    const verdict = (key, observedAt) => evaluateCloseBasisInput({ key, value: 1, observedAt, valueBasis: 'latest-completed-close', basis, nowMs: now }).ok;
    const expectations = [['spxPrice', '2026-09-28T20:00:00Z', true], ['tnx', '2026-09-28T18:59:52Z', true], ['dxy', '2026-09-29T01:48:32Z', false], ['spxPrice', '2026-09-28T15:00:00Z', false], ['fg', '2026-09-28T23:59:50Z', true], ['pcr', '2026-09-25', true], ['pcr', '2026-09-24', false], ['hyBp', null, false]];
    for (const [key, observedAt, expected] of expectations) if (verdict(key, observedAt) !== expected) fail(`close basis: ${key} @ ${observedAt} expected ${expected} (P1328)`);
    // P1345: the next session and continuous-market post-close values are not the prior US close.
    const intradayNow = Date.parse('2026-09-30T14:00:00Z');
    const priorBasis = resolveCloseBasis(intradayNow);
    if (evaluateCloseBasisInput({ key: 'spxPrice', value: 7777, observedAt: '2026-09-30T13:55:00Z', basis: priorBasis, nowMs: intradayNow }).ok
      || evaluateCloseBasisInput({ key: 'dxy', value: 101, observedAt: '2026-09-29T23:30:00Z', session: 'DELAYED_IN_SESSION', valueBasis: 'provider-current-value', basis: priorBasis, nowMs: intradayNow }).ok
      || describeCloseBasis(priorBasis) !== '9/29 미국 정규장 종가 기준') fail('P1345: live values changed the fixed completed-close basis');
    if (!evaluateCloseBasisInput({ key: 'spxPrice', value: 500, observedAt: '2026-09-28T20:36:11Z', session: 'MARKET_CLOSED', valueBasis: 'provider-current-value', basis, nowMs: now }).ok) fail('P1345: provider-confirmed closed SPX was rejected');
    if (evaluateCloseBasisInput({ key: 'pcr', value: 1, observedAt: '2026-02-30', basis: { date: '2026-03-02', previousDate: '2026-02-27' }, nowMs: Date.parse('2026-03-03T00:00Z') }).ok) fail('P1349: impossible calendar date was normalized into valid evidence');
    if (evaluateCloseBasisInput({ key: 'spxPrice', value: 500, observedAt: '2026-09-28', session: 'CURRENT_SESSION', valueBasis: 'latest-completed-close', basis, nowMs: now }).ok
      || evaluateCloseBasisInput({ key: 'spxPrice', value: true, observedAt: '2026-09-28T20:00:00Z', basis, nowMs: now }).ok) fail('P1345: contradictory session or nonnumeric close accepted');
    if (resolveCloseBasis(Date.parse('2026-09-07T15:00:00Z'))?.date !== '2026-09-04') fail('close basis: Labor Day must fall back to the prior session (P1328)');
    if (new Date(resolveCloseBasis(Date.parse('2026-11-27T19:00:00Z')).closeMs).toISOString() !== '2026-11-27T18:00:00.000Z') fail('close basis: half-day close must be 13:00 ET (P1328)');
    if (resolveCloseBasis(Date.parse('2031-03-03T15:00:00Z')) !== null) fail('close basis: unknown calendar year must fail closed (P1328)');
    const closeEv = (value) => ({ value, status: 'session_close', allowedUse: 'close-basis' });
    const closed = computeTradingScoreModel({ mode: 'swing', decisionEvidence: { vix: closeEv(16), dxy: closeEv(101), tnx: closeEv(4.2), fg: closeEv(34), pcr: closeEv(0.8), spxPrice: closeEv(500), spx50ma: closeEv(480), spx200ma: closeEv(450) }, closeBasis: { ...basis, label: describeCloseBasis(basis) }, decisionEligible: true, predictiveValidation: 'established' });
    if (closed.total == null || closed.closeBasis?.label !== '9/28 미국 정규장 종가 기준' || closed.decisionEligible !== false || !closed.componentMissing.includes('breadth') || closed.componentMissing.includes('macro')) fail(`close basis: score must compute on the close basis, stay non-decision and not need VVIX ${JSON.stringify({ total: closed.total, basis: closed.closeBasis, eligible: closed.decisionEligible, missing: closed.componentMissing })} (P1328)`);
    const snapshotOnly = computeTradingScoreModel({ decisionEvidence: { vix: { value: 16, status: 'snapshot', allowedUse: 'reference' } } });
    if (snapshotOnly.volScore !== null) fail('close basis: a reference/snapshot value without the close-basis marker must stay out (P1328)');
    const presentation = deriveTradingScoreDecisionPresentation({ score: closed });
    if (!/9\/28 미국 정규장 종가 기준/.test(presentation.description) || /neutral|caution|favorable|constructive|defensive/.test(presentation.decision)) fail(`close basis: presentation must name the basis in Korean ${JSON.stringify(presentation)} (P1328)`);
  }
  // ── P1326/R671: one quote-currentness vocabulary from observation times + the US calendar ──
  {
    const { describeQuoteCurrentness } = await load('src/domain/market/quote-currentness.js');
    const at = (iso) => Date.parse(iso);
    const inSession = { date: '2026-09-28', closeMs: at('2026-09-28T20:00:00Z'), previousDate: '2026-09-25', inSession: true };
    const closedSession = { ...inSession, inSession: false };
    const obs = (iso) => [{ symbol: '^GSPC', observedMs: at(iso) }, { symbol: 'KRW=X', observedMs: at(iso) }];
    const cases = [
      [obs('2026-09-29T14:55:00Z'), at('2026-09-29T15:00:00Z'), inSession, 'live', 'LIVE'],
      [obs('2026-09-29T14:20:00Z'), at('2026-09-29T15:00:00Z'), inSession, 'delayed', '지연'],
      [obs('2026-09-29T11:00:00Z'), at('2026-09-29T15:00:00Z'), inSession, 'stale', '지난 시세'],
      [obs('2026-09-28T20:15:00Z'), at('2026-09-29T02:00:00Z'), closedSession, 'close', '종가'],
      [obs('2026-09-26T05:00:00Z'), at('2026-09-29T02:00:00Z'), closedSession, 'stale', '지난 시세'],
      [[{ symbol: 'KRW=X', observedMs: at('2026-09-29T01:00:00Z') }], at('2026-09-29T02:00:00Z'), closedSession, 'none', '미수신']
    ];
    for (const [observations, nowMs, session, state, badge] of cases) {
      const out = describeQuoteCurrentness({ observations, nowMs, session });
      if (out.state !== state || out.badge !== badge || !out.detail || !out.title) fail(`quote currentness: expected ${state}/${badge}, got ${JSON.stringify(out)} (P1326/R671)`);
    }
  }
  // ── P1339: SPX 50/200 MAs derive from completed daily history when the live chart is absent ──
  {
    const { spxMovingAveragesFromHistory } = await load('src/domain/market/moving-average.js');
    const rows = Array.from({ length: 200 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10), spx: i < 150 ? 100 : 200 }));
    const ma = spxMovingAveragesFromHistory([...rows].reverse().concat([{ date: 'bad', spx: 1e9 }, { date: '2027-01-01', spx: null }]));
    if (!ma || ma[50] !== 200 || ma[200] !== 125 || ma.asOf !== rows[199].date) fail(`moving average: expected 200/125 on sorted valid closes, got ${JSON.stringify(ma)} (P1339)`);
    if (spxMovingAveragesFromHistory(rows.slice(1)) !== null || spxMovingAveragesFromHistory(null) !== null) fail('moving average: fewer than 200 closes must not produce a 200-day MA (P1339)');
    if (spxMovingAveragesFromHistory([...rows, rows[199]], { asOf: rows[198].date }) !== null
      || spxMovingAveragesFromHistory([...rows.slice(0,199), { ...rows[199], fieldMeta: { spx: { valueBasis: 'provider-current-value' } } }]) !== null) fail('P1345: duplicate/future/partial closes were counted in the MA');
    const provenanceRows = rows.map((row) => ({ ...row, fieldMeta: { spx: { observedAt: row.date, observationRelation: 'latest-completed-close' } } }));
    const proven = spxMovingAveragesFromHistory([...provenanceRows, { date: '2027-01-01', spx: 1e9, fieldMeta: { spx: { observationRelation: 'carried-forward' } } }]);
    if (proven?.[200] !== 125 || proven.asOf !== rows[199].date) fail('P1345: completed historical relation rejected or carried-forward bar counted');
    // P1349: different collection buckets must not count the same observed session twice.
    const duplicateBucket = { ...provenanceRows[198], date: rows[199].date };
    if (spxMovingAveragesFromHistory([...provenanceRows.slice(0, 199), duplicateBucket]) !== null) fail('P1349: weekend collection inflated the number of MA sessions');
    const repeated = spxMovingAveragesFromHistory([...provenanceRows, { ...provenanceRows[198], date: '2026-09-20' }]);
    if (repeated?.[200] !== 125 || repeated.asOf !== rows[199].date) fail('P1349: collection bucket changed the observation endpoint or moving average');
    for (const invalid of [true, Infinity, {}, '', ' ']) {
      if (spxMovingAveragesFromHistory([...rows.slice(0, 199), { ...rows[199], spx: invalid }]) !== null) fail('P1349: nonnumeric close entered the moving average');
    }
    if (spxMovingAveragesFromHistory([...provenanceRows, { ...provenanceRows[199], spx: 999 }]) !== null
      || spxMovingAveragesFromHistory([...provenanceRows.slice(0,199), { ...provenanceRows[199], fieldMeta: { spx: { observationRelation: 'latest-completed-close', observedAt: '2026-99-99' } } }]) !== null) fail('P1349: conflicting or unparseable sessions entered the MA');
    const laterBucket = { ...provenanceRows[199], date: '2026-09-20' };
    if (spxMovingAveragesFromHistory([...provenanceRows.slice(0,199), laterBucket], { asOf: rows[199].date })?.[200] !== 125) fail('P1349: collection cutoff discarded an eligible observed close');
    if (spxMovingAveragesFromHistory([{ date: '2025-12-31', spx: 100 }, ...provenanceRows, { ...provenanceRows[198], spx: 999 }]) !== null
      || spxMovingAveragesFromHistory([...provenanceRows.slice(0,199), { ...provenanceRows[199], fieldMeta: { spx: { observedAt: '2026-09-31T13:30:00Z', valueBasis: 'latest-completed-close' } } }]) !== null) fail('P1349: conflict/rollover gap was filled with an older observation');
  }
  // P1345: current SPX cannot launder an undated/stale live-chart MA.
  {
    const { createRuntimeReaders } = await load('src/data/runtime-readers.js');
    const nowMs = Date.parse('2026-09-30T02:00:00Z');
    const root = { _spxMA: { 50: 100, 200: 90 }, _spxMATs: Date.parse('2026-01-01'), _spxMASource: 'old-live-chart',
      AIO: { getTradingDecisionInputEvidence: () => ({ rows: [{ id: 'spx-price', value: 500, observedAt: '2026-09-29T20:00:00Z', valueBasis: 'latest-completed-close' }] }) } };
    const input = createRuntimeReaders({ root, now: () => nowMs }).readTradingScoreInputs();
    if (input.spxPrice !== 500 || input.spx50ma !== null || input.spx200ma !== null || input.decisionEvidence.spx50ma.allowedUse !== 'none') fail('P1345: stale/undated MA entered the reference score');
    const active = createRuntimeReaders({ root: { _liveData: { '^GSPC': { marketState: 'REGULAR', quoteEnvelope: { price: 500, observedAt: '2026-09-29T19:55:00Z', valueBasis: 'provider-current-value' } } } }, now: () => nowMs }).readTradingScoreInputs();
    const unproven = createRuntimeReaders({ root: { _liveData: { '^GSPC': { quoteEnvelope: { price: 500, observedAt: '2026-09-29T20:00:00Z' } } } }, now: () => nowMs }).readTradingScoreInputs();
    if (active.spxPrice !== null || unproven.spxPrice !== null) fail('P1349: active or unproven near-close tick was promoted to a completed close');
    const proven = createRuntimeReaders({ root: { _liveData: { '^GSPC': { marketState: 'CLOSED', quoteEnvelope: { price: '500', observedAt: '2026-09-29T20:00:00Z', valueBasis: 'latest-completed-close' } } } }, now: () => nowMs }).readTradingScoreInputs();
    if (proven.spxPrice !== 500 || typeof proven.decisionEvidence.spxPrice.value !== 'number') fail('P1349: valid completed close did not normalize its numeric type');
  }
  // P1346/QA-UX-11: the briefing decision-summary assertions retired with the module (P1727, zero product consumers).
  {
    const completeBase = computeTradingScoreModel({ vix: 18, pcr: 1, dxy: 100, tnx: 3.5, maCurrent: true, spxPrice: 500, spx50ma: 480, spx200ma: 450, breadthAvailable: true, breadth200: 60 });
    if (completeBase.componentCoveragePct !== 100 || completeBase.missingOptionalInputs.length !== 3
      || !/보조 입력 미수신/.test(deriveTradingScoreDecisionPresentation({ score: completeBase }).description)) fail('P1349: base-axis coverage hid missing optional risk observations');
  }
  // v57.55 review (S2-F3): an earnings line attaches only to a results story about that company.
  {
    const { earningsContextForHeadline } = await load('src/domain/news/earnings-context.js');
    const opts = { earnings: [{ symbol: 'BAC', date: '2026-10-14', hour: 'bmo', epsEstimate: 1.16 }, { symbol: 'MU', date: '2026-10-13', hour: 'amc', epsEstimate: 2, epsActual: 2.2 }], names: { BAC: 'Bank of America Corporation', MU: 'Micron Technology, Inc.' }, nowMs: Date.parse('2026-10-14T00:00:00Z') };
    const pick = (title) => earningsContextForHeadline(title, opts)?.symbol || null;
    if (pick('S&P 500 futures quiet as investors await big bank earnings') || pick('Bank of America raises Taiwan Semiconductor target price ahead of earnings') || pick('Micron beats on AI memory') !== 'MU' || pick('Bank of America earnings preview') !== 'BAC') fail('v57.55 review: earnings context must need the full name or ticker, a results word, and not an analyst action');
  }
  // v57.55 review (E1-03): a quarterly trend is named only when the last two steps agree.
  {
    const { buildQuarterRead } = await load('src/domain/fundamental/quarter-read.js');
    const q = (end, revenue) => ({ periodEnd: end, revenue, netIncome: 1 });
    const uneven = buildQuarterRead([q('2024-03-31', 100), q('2024-06-30', 100), q('2024-09-30', 100), q('2025-03-31', 55), q('2025-06-30', 70), q('2025-09-30', 360)].concat([q('2025-12-31', 1), q('2024-12-31', 1)]));
    const slowing = buildQuarterRead([q('2024-03-31', 100), q('2024-06-30', 100), q('2024-09-30', 100), q('2025-03-31', 160), q('2025-06-30', 140), q('2025-09-30', 120)]);
    if (/빨라졌다/.test(uneven.headline) || !/느려졌다/.test(slowing.headline)) fail(`v57.55 review: quarterly trend wording must follow the last two YoY steps, got "${uneven.headline}" / "${slowing.headline}"`);
  }
  // ── P1339: company names resolve exactly; ticker-shaped input is never rewritten through an alias ──
  {
    const { resolveRegisteredName, searchCandidates, isKnownSymbol } = await load('src/domain/ticker/resolve-name.js');
    const picks = searchCandidates('삼성', { entries: { '005930.KS': { kr: '삼성전자' } }, krStockDb: { '006400': { name: '삼성SDI' }, '005930': { name: '삼성전자' } } });
    if (picks.map((row) => row.symbol).join(',') !== '005930.KS,006400.KS' || searchCandidates('삼', {}).length || isKnownSymbol('NVDAA', { entries: { NVDA: {} } }) || !isKnownSymbol('nvda', { entries: { NVDA: {} } })) fail(`v57.54 review: a partial name lists candidates to pick (deduplicated, never auto-opened) and an unregistered ticker is recognised as unknown, got ${JSON.stringify(picks)}`);
    const entries = { GOOGL: { en: 'Alphabet', kr: '알파벳', alt: ['google', 'goog'] }, NVDA: { en: 'NVIDIA', kr: '엔비디아', alt: ['nvidia'] }, WDAY: { en: 'Workday', alt: ['hr'] }, '000660.KS': { en: 'SK hynix', kr: 'SK하이닉스', alt: ['sk hynix'] } };
    const cases = [['GOOG', null], ['HR', null], ['googl', 'GOOGL'], ['google', 'GOOGL'], ['Alphabet', 'GOOGL'], ['엔비디아', 'NVDA'], ['nvidia', 'NVDA'], ['sk hynix', '000660.KS'], ['', null], ['삼성전자', null]];
    for (const [input, expected] of cases) {
      const got = resolveRegisteredName(input, entries);
      if (got !== expected) fail(`ticker name resolution: ${JSON.stringify(input)} expected ${expected}, got ${got} (P1339, no ticker guessing)`);
    }
    // v57.81: the portfolio box shares the ticker-route owner. A newly listed universe symbol (SPCX) is accepted by exact match;
    // a near-miss ticker is never rewritten; a nickname resolves only when the registry carries it.
    const { resolveHoldingInput } = await load('src/domain/ticker/resolve-name.js');
    const universe = [{ sym: 'SPCX' }, { sym: 'NVDA' }];
    const withAlias = { SPCX: { en: 'SpaceX', kr: '스페이스X', alt: ['spacex', '스엑'] } };
    const holdingCases = [
      ['spcx', {}, 'SPCX', true, null],
      ['SPCXX', withAlias, 'SPCXX', false, null],
      ['SPACEX', withAlias, 'SPACEX', false, null],
      ['스엑', withAlias, 'SPCX', true, '스엑'],
      ['스엑', {}, '스엑', false, null],
      ['SPCK', withAlias, 'SPCK', false, null]
    ];
    for (const [input, entries, symbol, known, resolvedFrom] of holdingCases) {
      const got = resolveHoldingInput(input, { entries, universe });
      if (got.symbol !== symbol || got.known !== known || got.resolvedFrom !== resolvedFrom) fail(`v57.81 portfolio symbol: ${JSON.stringify(input)} expected ${symbol}/${known}/${resolvedFrom}, got ${JSON.stringify(got)} (exact match only, no fuzzy rewrite)`);
    }
  }
  // ── P1327/R672: Korean theme names and membership have one owner ──
  {
    const { KR_THEME_LABELS, krThemesForSymbol, krCodeOf } = await load('src/domain/themes/kr-themes.js');
    const map = { semi: [{ code: '005930' }, { code: '000660' }], bio: [{ code: '207940' }], defense: [{ code: '012450' }] };
    const hits = krThemesForSymbol('005930.KS', map);
    if (hits.length !== 1 || hits[0].id !== 'semi' || hits[0].label !== '반도체 / HBM' || krThemesForSymbol('AAPL', map).length || krCodeOf('035720.KQ') !== '035720') fail(`kr themes: membership lookup drifted ${JSON.stringify(hits)} (P1327/R672)`);
    const krData = readFileSync(path.resolve(root, 'js/aio-kr-data.js'), 'utf8');
    const mapBody = krData.slice(krData.indexOf('var KR_THEME_MAP = {'), krData.indexOf('\n};', krData.indexOf('var KR_THEME_MAP = {')));
    const ids = [...mapBody.matchAll(/^\s*'([a-z0-9_-]+)':\s*\[/gm)].map((match) => match[1]);
    const unlabeled = ids.filter((id) => !KR_THEME_LABELS[id]);
    if (!ids.length || unlabeled.length) fail(`kr themes: every KR_THEME_MAP id needs a label, missing ${unlabeled.join(',')} (P1327/R672)`);
    if (!/var CN=window\.AIO_KR_THEME_LABELS/.test(krData) || /var CN=\{'defense'/.test(krData)) fail('kr themes: the theme detail must read the single label owner (P1327/R672)');
  }
  const invalidScore = computeTradingScoreModel({ mode: 'swing', vix: -10, vvix: 0, dxy: 10, tnx: -1, oilPrice: -5, fg: 101, maCurrent: true, spx200ma: -1, spx50ma: 0, spxPrice: -10, breadthAvailable: true, breadth200: 150, pcr: -1, hyBp: -2, newsSentimentScore: 101, newsRiskSignals: [{ impact: 'bad' }] });
  {
    // v57.83 trading-score.v5 (R707): within ±1% of the 50-day line the trend component is 59 (between above 68 and
    // below 50); 1% clear above is 68, 2% above 82.
    const trendAt = (gapPct) => computeTradingScoreModel({ mode: 'swing', maCurrent: true, spx50ma: 5000, spx200ma: 4800, spxPrice: 5000 * (1 + gapPct / 100) }).trendScore;
    const got = [0.15, -0.5, 1.0, 1.5, 2.5, -1.5].map(trendAt);
    if (JSON.stringify(got) !== JSON.stringify([59, 59, 68, 68, 82, 50])) fail(`v57.83 the trend component keeps the 1% buffer around the 50-day line, got ${JSON.stringify(got)}`);
  }
  if (invalidScore.total !== null || invalidScore.modelVersion !== 'trading-score.v5' || !Object.isFrozen(invalidScore) || !Object.isFrozen(invalidScore.componentMissing)) fail(`signal: out-of-domain inputs must fail closed in an immutable v4 result, got ${JSON.stringify(invalidScore)}`);
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
  // P1338: the facade's third score-input copy was deleted; the legacy wrapper reads the one native path.
  const legacyCore = readFileSync(path.join(root, 'js/aio-core.js'), 'utf8');
  if (/readTradingScoreInputs|runtimeEvidenceStatus/.test(facade) || !/_aioReadTradingScoreInputs/.test(legacyCore)) fail('P1214/P1338 signal-mode: the legacy score must read the shared native inputs (mode included), not its own copy');

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

  // P1553: a percentile needs peers. Four fully-observed rows plus one row under the 80% evidence floor pass the input guard
  // (five rows with a return) but leave four rankable rows; they used to be spread over 0..100, now they keep a null rank.
  // Five comparable rows are still ranked.
  {
    const partial = (sym) => ({ sym, sector: 'Tech', ret1m: 1, ret3m: 1, observedAt: '1970-01-01T00:00:00.000Z', factorObservedAt: '1970-01-01T00:00:00.000Z', factorSourceKind: 'T3_PUBLIC_DELAYED', factorAllowedUse: 'research-relative-ranking-only', factorQuality: { status: 'CURRENT', stale: false } });
    const four = computeFactorRanks({ rows: [1, 2, 3, 4].map((seed) => baseRow('F' + seed, 'Tech', seed)).concat(partial('P1')), now: 0 });
    const five = computeFactorRanks({ rows: [1, 2, 3, 4, 5].map((seed) => baseRow('F' + seed, 'Tech', seed)).concat(partial('P1')), now: 0 });
    if (!(four.rows || []).every((row) => row.rank == null)) fail('factor-ranks P1553: four rankable rows must keep a null rank (no percentile without five peers)');
    const rankedFive = (five.rows || []).filter((row) => row.rank != null);
    if (rankedFive.length !== 5 || rankedFive.some((row) => row.rank < 0 || row.rank > 100)) fail('factor-ranks P1553: five comparable rows must all be ranked');
  }

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
  if (climax.climaxRisk !== 'watch' || climax.stretch200 !== true || climax.label !== '과열 정점 주의') {
    fail(`setup-profile: 200SMA stretch/climax label drifted, got ${JSON.stringify(climax)}`);
  }

  const empty = deriveScreenerSetupProfile({});
  if (empty.status !== 'unavailable' || empty.label !== '관찰' || empty.relativeStrengthPullback !== 'unavailable') {
    fail(`setup-profile: empty row must remain unavailable, got ${JSON.stringify(empty)}`);
  }

  // 2026-10-13 expert review S04/S13/S14/S09: no per-row tag for an input nobody publishes, no provider name
  // in a visible tag, an observed band instead of a chase warning, and one shared extension band table.
  const { EXTENSION_BANDS, extensionStateFor } = await load('src/domain/screener/setup-profile.js');
  const stretched = deriveScreenerSetupProfile({ observedAt: '2026-08-09', rank: 70, ret1m: 5, ret3m: 20, pctSma50: 40, adrPct: 5, pctSma200: 30, rsi: 60 });
  if (stretched.tags.some((tag) => /거래량 확인 필요|TradingView|추격/.test(tag)) || !stretched.tags.includes('50일선 확장 7배 이상(참고 구간)')) fail(`S04/S13/S14 setup tags drifted, got ${JSON.stringify(stretched.tags)}`);
  if (!winner.tags.includes('승자 필터 통과(가격·ADR·유동성·EMA)')) fail(`S13 winner tag must name the checks without the provider, got ${JSON.stringify(winner.tags)}`);
  if (EXTENSION_BANDS.nearBase !== 2 || extensionStateFor(3.8) !== 'normal' || extensionStateFor(2) !== 'near-base' || extensionStateFor(7) !== 'stretched') fail('S09 extension bands drifted');

  // S09/S02/S07: the stock summary reads the same bands, judges RSI on the shown digits, and names a lagging factor session.
  const { buildStockRead } = await load('src/domain/entity/stock-read.js');
  const summary = buildStockRead({ symbol: '005930.KS', row: { name: 'KR fixture', pctSma50: 11.4, adrPct: 3, pctSma200: 14, rsi: 69.94, pctFrom52wLow: 50, pctFrom52wHigh: -10 }, sessionLag: { session: '2026-10-08', latest: '2026-10-12', sessions: 1 } });
  const ext = summary.points.find((point) => point.id === 'extension')?.text || '';
  const rsiText = summary.points.find((point) => point.id === 'rsi')?.text || '';
  if (/기준선 가까이에 있는 상태/.test(ext) || !/3\.8배/.test(ext)) fail(`S09 stock summary must not call 3.8x near the line, got ${ext}`);
  if (!/RSI 69\.9/.test(rsiText) || /과열도 과매도도 아닌/.test(rsiText)) fail(`S02 RSI 69.9 must be shown with its digit and not read as neutral, got ${rsiText}`);
  if (!/^1거래일 전 종가 기준\(10\/8\)/.test(summary.headline)) fail(`S07 lagging factor session must lead the headline, got ${summary.headline}`);
  // v57.54: a rank outside its own denominator (KR "890/239") is a mixed row set and is not shown; Korean sector name in the handoff.
  const mixedRank = buildStockRead({ symbol: '005930.KS', row: { name: 'KR fixture', sector: 'Technology', screenRank: 890 }, universeSize: 239 });
  const inRange = buildStockRead({ symbol: '005930.KS', row: { name: 'KR fixture', sector: 'Technology', screenRank: 188 }, universeSize: 239 });
  if (mixedRank.ranking || mixedRank.points.some((point) => point.id === 'rank')) fail('v57.54 rank above its denominator must not be shown');
  if (!/가격 흐름 순위 188\/239/.test(inRange.points.find((point) => point.id === 'rank')?.text || '')) fail('v57.54 in-range market rank must be shown on its own denominator');
  if (!/같은 섹터\(기술\)/.test(inRange.next.find((step) => step.route === 'screener')?.why || '')) fail('v57.54 screener handoff must use the Korean sector name');
  const { benchmarkRowFor } = await load('src/domain/market/benchmarks.js');
  const benchHistory = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-12'].map((date, index) => ({ date, kospi: 100 + index }));
  if (benchmarkRowFor('005930.KS', benchHistory, { through: '2026-10-08' }).asOf !== '2026-10-08' || benchmarkRowFor('005930.KS', benchHistory).asOf !== '2026-10-12') fail('S07 benchmark must cut at the factor session when asked');

  // v57.81 (analysis audit 2026-10-15, screener + stock): trend labels pass ADR buffers (technical/bands.js), the why-drawer
  // has model-level contrary evidence, the MA stack reads the close first, and one validation count basis. Rows are the
  // audit's 10/14 closes.
  const bands = await load('src/domain/technical/bands.js');
  const { entryTiming } = await load('src/ui/pages/screener.js');
  const pointOf = (read, id) => read.points.find((point) => point.id === id);
  const muRead = buildStockRead({ symbol: 'MU', row: { name: 'MU', pctSma50: -6.94, pctSma200: 28.48, adrPct: 3.82, ret5d: -15.97, rsi: 36.3 } });
  if (pointOf(muRead, 'extension')?.tone !== 'burden' || bands.extensionBand(-1.8) !== 'below') fail(`v57.81 MU -6.9% under the 50-day line must not be favourable, got ${JSON.stringify(pointOf(muRead, 'extension'))}`);
  if (pointOf(muRead, 'rsi')?.tone !== 'neutral') fail('v57.81 RSI between 30 and 70 is neutral, not favourable');
  const pyplRead = buildStockRead({ symbol: 'PYPL', row: { name: 'PYPL', pctSma50: 0.01, pctSma200: 12.55, adrPct: 2.29, ret5d: 2.09 } });
  if (!/^50일선 부근/.test(pyplRead.headline) || pointOf(pyplRead, 'trend')?.tone !== 'neutral' || pointOf(pyplRead, 'extension')?.tone === 'favorable') fail(`v57.81 PYPL +0.01% must read 50일선 부근, got ${pyplRead.headline}`);
  const mrvlRow = { sym: 'MRVL', name: 'MRVL', rank: 81, pctSma20: -4.1, pctSma50: 2.18, pctSma200: 40.72, adrPct: 5.11, ret5d: -13.82, ret1d: -8.73, ret1m: 10.66, rsi: 44.5 };
  const mrvlRead = buildStockRead({ symbol: 'MRVL', row: mrvlRow });
  if (/상승 추세/.test(mrvlRead.headline) || entryTiming(mrvlRow)[0] === '상위권·추세 양호') fail(`v57.81 MRVL after -13.8% in five sessions must not read 상승 추세 / 추세 양호, got ${mrvlRead.headline} / ${entryTiming(mrvlRow)[0]}`);
  const shaken = buildStockRead({ symbol: 'HPE', row: { name: 'HPE', pctSma50: 6.74, pctSma200: 63.71, adrPct: 5.02, ret5d: -12.46 } });
  if (pointOf(shaken, 'trend')?.tone === 'favorable' || /^상승 추세 ·/.test(shaken.headline)) fail(`v57.81 a five-session break past two daily ranges demotes 상승 추세, got ${shaken.headline}`);
  const krRow = { sym: '315640.KQ', name: 'KR fixture', rank: 66, pctSma50: 12, pctSma200: -29.63, adrPct: 4, ret5d: 1, ret1m: 7.25, rsi: 50 };
  if (entryTiming(krRow)[1] === 'entry-ready') fail('v57.81 a price under its 200-day line is not entry-ready');
  if (entryTiming({ ...krRow, pctSma200: 10, pctSma50: null })[1] === 'entry-ready') fail('v57.81 a null 50-day distance must fail the entry-ready label');
  if (!bands.modelContraryEvidence(mrvlRow).hits.some((hit) => /최근 5거래일 -13\.8%/.test(hit))) fail(`v57.81 why-drawer contrary evidence must list MRVL's five-session drop, got ${JSON.stringify(bands.modelContraryEvidence(mrvlRow))}`);
  if (!bands.modelContraryEvidence({ pctSma50: 1 }).unchecked.includes('RSI')) fail('v57.81 a missing input is listed as not checked, never as clear');
  const cleanRow = { sym: 'CLEAN', name: 'clean', rank: 80, pctSma20: 2, pctSma50: 6, pctSma200: 15, adrPct: 2, ret5d: 1.5, ret1m: 4, rsi: 55 };
  const cleanRead = buildStockRead({ symbol: 'CLEAN', row: cleanRow });
  if (!/^상승 추세/.test(cleanRead.headline) || pointOf(cleanRead, 'trend')?.tone !== 'favorable' || entryTiming(cleanRow)[1] !== 'entry-ready' || bands.modelContraryEvidence(cleanRow).hits.length) fail(`v57.81 a stock 3 ADR above its 50-day line, above its 200-day line with a positive week stays 상승 추세 and entry-ready, got ${cleanRead.headline} / ${entryTiming(cleanRow)}`);
  const etfRead = buildStockRead({ symbol: 'SPY', row: { name: 'SPY', sector: 'ETF', pctSma50: 3, pctSma200: 7, adrPct: 0.7, ret5d: 0.5 }, regime: { available: true, overall: '혼조', axes: [{ id: 'breadth', state: 'burden' }], counts: { burden: 1 } } });
  if (/상승 추세 종목에 속합니다/.test(pointOf(etfRead, 'market')?.text || '')) fail('v57.81 an ETF is not one of the few up-trend stocks');
  // RRG: a ratio inside the themes' neutral band is 경계, and a last week against the quadrant withholds the favourable tone.
  const rs = (end) => Array.from({ length: 40 }, (_, index) => ({ value: 100 + (index < 35 ? index * 0.05 : 1.75 + (index - 34) * end) }));
  const sectorRead = (item) => pointOf(buildStockRead({ symbol: 'NVDA', row: { name: 'NVDA', sector: 'Technology', pctSma50: 6, pctSma200: 15, adrPct: 2, ret5d: 1 }, rotation: { XLK: { quadrant: 'Leading', sessionDate: '2026-10-14', ...item } } }), 'sector');
  if (sectorRead({ rsRatio: 100.33, rsMomentum: 102, relativeStrength: rs(0.05) })?.tone !== 'neutral' || !/기준선 부근/.test(sectorRead({ rsRatio: 100.33, rsMomentum: 102, relativeStrength: rs(0.05) })?.text || '')) fail('v57.81 an RS-Ratio within the neutral band is 기준선 부근 (v57.91 wording; was 경계), not 선도');
  const reversed = sectorRead({ rsRatio: 104, rsMomentum: 102, relativeStrength: rs(-0.9) });
  if (reversed?.tone !== 'neutral' || !/최근 5거래일 상대강도 -/.test(reversed?.text || '')) fail(`v57.81 a Leading sector whose last five sessions fell is not favourable, got ${JSON.stringify(reversed)}`);
  if (sectorRead({ rsRatio: 104, rsMomentum: 102, relativeStrength: rs(0.05) })?.tone !== 'favorable') fail('v57.81 a clear Leading sector still reads favourable');
  // MA stack: the close is read against the 20- and 50-day lines before the stack (DELL closed 9.1% under its 20-day line).
  const stage = await load('src/domain/technical/stage.js');
  const stack = { sma5: 590, sma10: 585, sma20: 580, sma50: 540, sma100: 500, sma200: 420, sma50Prior: 530 };
  const pulled = stage.classifyMovingAverageStructure({ ...stack, lastClose: 560 });
  const broken = stage.classifyMovingAverageStructure({ ...stack, lastClose: 527 });
  const bearStack = stage.classifyMovingAverageStructure({ sma5: 400, sma10: 410, sma20: 420, sma50: 450, sma100: 480, sma200: 520, sma50Prior: 460, lastClose: 390 });
  if (pulled.trendState === 'UPTREND' || /정배열/.test(stage.MA_STRUCTURE_LABELS[pulled.stageEstimate] || '') || broken.trendState !== 'TREND_DAMAGED' || !/역배열/.test(stage.MA_STRUCTURE_LABELS[bearStack.stageEstimate] || '')
    || Object.values({ pulled, broken, bearStack }).some((s) => !stage.MA_STRUCTURE_LABELS[s.stageEstimate])) fail(`v57.81 MA stack must read the close first and every stage must have one label, got ${pulled.stageEstimate}/${broken.stageEstimate}/${bearStack.stageEstimate}`);
  const dropBars = Array.from({ length: 220 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, 1) + index * 86400000).toISOString().slice(0, 10), close: index < 219 ? 100 + index * 0.5 : (100 + 218 * 0.5) * 0.97 }));
  const dellLike = stage.deriveTechnicalStageFromOhlcv({ symbol: 'dell', ohlcv: dropBars, now: Date.UTC(2026, 7, 9) });
  // One validation count basis (net of cost) for the screener read, the stock read and the 과거 검증 tab.
  const { summarizeValidation: summarizeForBasis } = await load('src/ui/components/screener-validation.js');
  const basisSummary = summarizeForBasis([{ date: '2026-10-15', n: 1138, dates: 6, quantileSpreadNet: -1.83, hitRate: 50, netHitRate: 33.3, ic: { composite: -0.005 } }]);
  const { buildScreenerRead } = await load('src/domain/screener/screener-read.js');
  const basisRows = Array.from({ length: 25 }, (_, index) => ({ sym: `R${index}`, sector: 'Technology', screenRank: index + 1, pctSma50: 5, adrPct: 2, ret5d: index < 3 ? -6 : 1, factorScores: { trend: 70 } }));
  const basisRead = buildScreenerRead({ rows: basisRows, validation: { ...basisSummary, modelMatch: true } });
  if (basisSummary.wins !== 2 || basisSummary.winsBasis !== 'net' || !/비용 후 2회/.test(basisRead.headline)) fail(`v57.81 one validation count basis (net) must be named, got ${basisRead.headline}`);
  const health = basisRead.points.find((point) => point.id === 'health');
  if (health?.tone !== 'neutral' || !/추세 팩터/.test(health.text) || !/하루 평균 변동폭의 2배 넘게 하락/.test(health.text)) fail(`v57.81 상위권 추세 is neutral, names the trend factor and the five-session drawdown share, got ${JSON.stringify(health)}`);
  // The fiscal headline carries its FY; an annual filing past the longest 10-K deadline after the next FY end is flagged.
  const { buildFiscalRead: fiscalForHero } = await load('src/domain/fundamental/fiscal-read.js');
  const fyHistory = [{ periodEnd: '2024-06-30', revenue: 10e9, netIncome: 1e9, equity: 8e9 }, { periodEnd: '2025-06-30', revenue: 12e9, netIncome: 1.3e9, equity: 9e9 }];
  const overdueHero = fiscalForHero({ symbol: 'OLD', row: { factorSessionDate: '2026-10-14' }, fundamentals: { symbol: 'OLD', fiscalHistory: fyHistory } });
  const onTimeHero = fiscalForHero({ symbol: 'OLD', row: { factorSessionDate: '2026-08-14' }, fundamentals: { symbol: 'OLD', fiscalHistory: fyHistory } });
  if (!/^FY2025 매출 \+20\.0%/.test(overdueHero.headline || '') || !/다음 연간 공시 예정 지남/.test(overdueHero.headline) || /예정 지남/.test(onTimeHero.headline || '')) fail(`v57.81 fiscal hero FY / overdue flag drifted, got ${overdueHero.headline} | ${onTimeHero.headline}`);
  const flatMargin = fiscalForHero({ symbol: 'FLAT', fundamentals: { symbol: 'FLAT', fiscalHistory: [{ periodEnd: '2024-12-31', revenue: 10e9, netIncome: 1e9 }, { periodEnd: '2025-12-31', revenue: 10.1e9, netIncome: 1.02e9 }] } });
  if (flatMargin.points.some((point) => (point.id === 'margin' || point.id === 'growth') && point.tone !== 'neutral')) fail('v57.81 a change inside the ±2 flat band reads neutral');
  const oneRevision = (await load('src/domain/fundamental/consensus-read.js')).buildConsensusPoint({ valuationPrice: 226.32, factorSessionDate: '2026-10-12' }, { asOf: '2026-10-13T22:00:00Z', fwd: { from: '2026-10', to: '2027-07', eps: 11.91, minEstimates: 11, up4w: 1, down4w: 0 }, trailing: { eps: 6.9 } }, { now: Date.parse('2026-10-14T00:00:00Z') });
  if (oneRevision?.tone !== 'neutral') fail('v57.81 a margin of one revision is not a consensus direction');
  if (!dellLike.structure.fullBull ||dellLike.indicators.trend === 'above-ma20' || dellLike.indicators.current >= dellLike.indicators.ma20 || dellLike.structure.stageEstimate === 'STAGE_2_ADVANCE') fail(`v57.81 a close under the 20-day line is not above-ma20 nor 정배열, got ${JSON.stringify(dellLike.indicators)} ${dellLike.structure.stageEstimate}`);

  // S11: the company headline keeps the return only (the factor rank above has a different denominator).
  const { buildCompanyAnalysis } = await load('src/domain/entity/company-analysis.js');
  const peerRows = ['AAA', 'BBB', 'CCC'].map((sym, index) => ({ sym, name: sym, factorSessionDate: '2026-10-09', ret3m: 10 - index }));
  const company = buildCompanyAnalysis({ symbol: 'BBB', row: peerRows[1], rows: peerRows, nowMs: Date.parse('2026-10-13T12:00:00Z') });
  if (/번째/.test(company.headline || '')) fail(`S11 company headline must not carry a second rank, got ${company.headline}`);
  // v57.54: a KR theme group whose only sub-theme carries its own name reads once ("반도체 / HBM · 반도체 / HBM").
  const krThemed = buildCompanyAnalysis({ symbol: 'BBB', row: peerRows[1], rows: peerRows, nowMs: Date.parse('2026-10-13T12:00:00Z'), themes: [{ id: 'kr-hbm', nameKr: '반도체 / HBM', subThemes: [{ name: '반도체 / HBM', tickers: ['BBB'] }] }, { id: 'kr-hbm', nameKr: '반도체 / HBM', subThemes: [{ name: '반도체 / HBM', tickers: ['BBB'] }] }] });
  if (krThemed.associations.length !== 1 || krThemed.associations[0].subThemes.length) fail(`v57.54 duplicate theme chip, got ${JSON.stringify(krThemed.associations)}`);

  // S06/S18/S19: PER names its fiscal year and months since; losses read with the sign first; negative ROE says why.
  const { buildFiscalRead, formatUsdShort } = await load('src/domain/fundamental/fiscal-read.js');
  if (formatUsdShort(-147.8e9) !== '−$147.8B' || formatUsdShort(416.2e9) !== '$416.2B') fail(`S18 signed USD format drifted: ${formatUsdShort(-147.8e9)}`);
  const per = buildFiscalRead({ symbol: 'AAPL', row: { pe: 45, factorSessionDate: '2026-10-12' }, fundamentals: { symbol: 'AAPL', fiscalHistory: [{ periodEnd: '2024-09-28', revenue: 391e9, netIncome: 93.7e9, equity: 57e9 }, { periodEnd: '2025-09-27', revenue: 416e9, netIncome: 112e9, equity: 74e9 }] } });
  const earnings = per.points.find((point) => point.id === 'earnings')?.text || '';
  // 2026-10-14 audit #2: basis reads "FY2025 순이익 기준 · 2025-09 마감 · 경과 n개월"; four newer quarters add a labelled second figure.
  if (!/PER 45\.0배\(FY2025 순이익 기준 · 2025-09 마감 · 경과 12개월\)/.test(earnings)) fail(`S06 PER must name its fiscal-year basis and age, got ${earnings}`);
  if (/최근 4개 분기/.test(earnings)) fail(`audit #2 no trailing-quarter PER without newer quarters, got ${earnings}`);
  const perTtm = buildFiscalRead({ symbol: 'AAPL', row: { pe: 45, factorSessionDate: '2026-10-12' }, quarters: [['2025-12-27', 30e9], ['2026-03-28', 25e9], ['2026-06-27', 24e9], ['2025-09-27', 28e9]].map(([periodEnd, netIncome]) => ({ periodEnd, netIncome, revenue: netIncome * 4 })), fundamentals: { symbol: 'AAPL', fiscalHistory: [{ periodEnd: '2024-09-28', revenue: 391e9, netIncome: 93.7e9, equity: 57e9 }, { periodEnd: '2025-09-27', revenue: 416e9, netIncome: 112e9, equity: 74e9 }] } }).points.find((point) => point.id === 'earnings')?.text || '';
  if (!/PER 약 47\.1배\(최근 4개 분기 합 · 2026-06 분기까지\) · FY2025 기준 45\.0배\(FY2025 순이익 기준[^)]*\)/.test(perTtm)) fail(`audit #2 / v57.54: the trailing four-quarter PER leads and the FY PER sits beside it, labelled, got ${perTtm}`);
  const loss = buildFiscalRead({ symbol: 'LOSS', fundamentals: { symbol: 'LOSS', fiscalHistory: [{ periodEnd: '2024-12-31', revenue: 10e9, netIncome: 1e9, equity: 10e9 }, { periodEnd: '2025-12-31', revenue: 9e9, netIncome: -2e9, equity: 8e9 }] } });
  if (!/순손실로 자본이 줄어든 해/.test(loss.points.find((point) => point.id === 'roe')?.text || '')) fail('S19 negative ROE must be read as a loss year');

  // S01: value/quality freshness is the provider's 456-day fiscal-period rule — a filing 12 months old is current.
  const period = await load('src/domain/fundamental/period.js');
  const providerModule = await load('src/data/providers/screener.js');
  if (period.FUNDAMENTAL_MAX_PERIOD_AGE_DAYS !== 456 || providerModule.FUNDAMENTAL_MAX_PERIOD_AGE_DAYS !== 456 || providerModule.fundamentalPeriodTooOld !== period.fundamentalPeriodTooOld) fail('S01 provider and ranker must share one fundamental period rule');
  const { computeFactorRanks: rankS01 } = await load('src/domain/screener/factor-ranks.js');
  const fundamentalRow = (index, periodEnd) => ({ sym: `F${index}`, sector: 'Tech', ret1m: index, ret3m: index * 0.8, ret6m: index * 0.5, pctSma50: index, pctSma200: index * 0.6, vol: 20 - index,
    observedAt: '2026-10-12T13:30:00.000Z', factorObservedAt: '2026-10-12T13:30:00.000Z', factorSessionDate: '2026-10-12', factorSourceKind: 'T3_PUBLIC_DELAYED', factorAllowedUse: 'research-relative-ranking-only', factorQuality: { status: 'CURRENT', stale: false },
    pe: 10 + index, pb: 1 + index / 10, roe: 10 + index, margin: 5 + index, revGrowth: index,
    _fundamentalObservedAt: '2025-10-31T14:01:26.000Z', _fundamentalPeriodEnd: periodEnd, _fundamentalSourceKind: 'T1_OFFICIAL', _fundamentalAllowedUse: 'research-relative-ranking-only', _fundamentalQuality: { status: 'CURRENT', stale: false } });
  const fresh = rankS01({ rows: Array.from({ length: 8 }, (_, i) => fundamentalRow(i + 1, '2025-09-27')), now: Date.parse('2026-10-13T06:00:00Z') });
  const old = rankS01({ rows: Array.from({ length: 8 }, (_, i) => fundamentalRow(i + 1, '2025-06-30')), now: Date.parse('2026-10-13T06:00:00Z') });
  if (!fresh.activeFactors.includes('value') || !fresh.activeFactors.includes('quality')) fail(`S01 a fiscal period 380 days before the session must keep value/quality active, got ${JSON.stringify(fresh.activeFactors)}`);
  if (old.activeFactors.includes('value') || !/456일/.test(old.inactiveFactorReasons.value || '')) fail(`S01 a fiscal period 469 days old must be held with the 456-day reason, got ${JSON.stringify(old.inactiveFactorReasons)}`);

  // S01/S03/S04/S16 UI: a profile under the 80% computable floor is measured; structure-class aliases are retired.
  const screenerPage = await load('src/ui/pages/screener.js');
  const coverage = { momentum: { active: true }, trend: { active: true }, lowvol: { active: true }, kalman: { active: true }, size: { active: false }, value: { active: false }, quality: { active: false } };
  const swing = screenerPage.profileComputability({ momentum: 0.30, trend: 0.28, lowvol: 0.12, size: 0.07, value: 0.07, quality: 0.07, kalman: 0.09 }, coverage);
  if (!swing || swing.available !== false || swing.pct !== 79 || swing.missing.join(',') !== 'size,value,quality') fail(`S01 swing profile computability drifted, got ${JSON.stringify(swing)}`);
  if (screenerPage.SCREENER_COLUMN_REGISTRY.some((column) => column.key === 'signal')) fail('S03 the always-null structure-class column must be retired');
  const optionDoc = (() => {
    const options = ['', 'WINNER', 'RSPULLBACK'].map((value) => ({ value, textContent: value || '전체', dataset: {}, disabled: false }));
    const nodes = { 'scr-cap': { value: 'MEGA', hidden: false }, 'scr-setup': { value: 'WINNER', options } };
    return { getElementById: (id) => nodes[id] || null, querySelectorAll: () => [], nodes };
  })();
  screenerPage.syncScreenerControlAvailability(optionDoc, { rows: [{ sym: '005930.KS', setupProfile: { winnerFilter: 'unavailable', relativeStrengthPullback: 'not-confirmed' } }], listingMarket: 'KR' });
  if (optionDoc.nodes['scr-cap'].hidden !== true || optionDoc.nodes['scr-cap'].value !== '' || optionDoc.nodes['scr-setup'].options[1].disabled !== true || !/자료 미발행/.test(optionDoc.nodes['scr-setup'].options[1].textContent) || optionDoc.nodes['scr-setup'].options[2].disabled !== false || optionDoc.nodes['scr-setup'].value !== '') fail('S04/S16 controls without published input must be disabled or hidden with the reason');

  // S04: a US row compares its 3-month return with SPY from the same artifact session; KR stays unavailable.
  const spyArtifact = { asOf: '2026-10-13T04:07:00.000Z', factorObservedAt: '2026-10-12T13:30:00.000Z', data: {
    SPY: { ret3m: 3.75, factorSessionDate: '2026-10-12' }, AAA: { ret3m: 10, factorSessionDate: '2026-10-12' }, OLD: { ret3m: 5, factorSessionDate: '2026-10-09' }, '005930.KS': { ret3m: -17, factorSessionDate: '2026-10-08' } } };
  const spyProvider = providerModule.createScreenerProvider({ httpClient: { requestJson: async (url) => url.includes('screener.json') ? { ok: true, data: spyArtifact } : { ok: false, error: 'HTTP_404' } }, clock: { now: () => Date.parse('2026-10-13T06:00:00Z') }, yieldImpl: async () => {} });
  const spyRows = (await spyProvider.readCurrent()).rows;
  const byBench = Object.fromEntries(spyRows.map((row) => [row.sym, row.benchmarkRet]));
  if (byBench.AAA !== 3.75 || byBench.OLD !== null || byBench['005930.KS'] !== null || byBench.SPY !== null) fail(`S04 SPY benchmark must apply only to same-session US rows, got ${JSON.stringify(byBench)}`);

  // v57.54: Forward PER — close over next-four-quarter consensus EPS; growth on the same adjusted basis; stale or
  // missing consensus shows nothing; a big expected jump carries the cyclical-peak caution; never a score input.
  const consensus = await load('src/domain/fundamental/consensus-read.js');
  const consensusNow = Date.parse('2026-10-14T00:00:00Z');
  const consensusRow = { asOf: '2026-10-13T22:00:00Z', fwd: { from: '2026-10', to: '2027-07', eps: 11.91, hi: 13.11, lo: 11, minEstimates: 11, up4w: 2, down4w: 0 }, trailing: { from: '2025-10', to: '2026-07', eps: 6.9 } };
  const consensusPoint = consensus.buildConsensusPoint({ valuationPrice: 226.32, factorSessionDate: '2026-10-12' }, consensusRow, { now: consensusNow });
  if (!consensusPoint || Math.abs(consensusPoint.fwdPe - 19.0) > 0.05 || Math.abs(consensusPoint.trailingPe - 32.8) > 0.05 || Math.round(consensusPoint.growth) !== 73
    || !/^Forward PER 약 19\.0배 · 직전 4개 분기 조정 기준 32\.8배 · 예상 이익 \+73% — 종가 \$226\.32\(2026-10-12\)/.test(consensusPoint.text) || !/정점 근처/.test(consensusPoint.text) || !/점수에는 쓰지 않습니다/.test(consensusPoint.text) || consensusPoint.tone !== 'favorable') fail(`v57.54 forward PER reading drifted: ${JSON.stringify(consensusPoint)}`);
  if (consensus.consensusView({ valuationPrice: 226.32 }, { ...consensusRow, asOf: '2026-09-01T00:00:00Z' }, { now: consensusNow }) !== null
    || consensus.consensusView({}, consensusRow, { now: consensusNow }) !== null || consensus.consensusView({ valuationPrice: 10 }, { unavailable: true }, { now: consensusNow }) !== null) fail('v57.54 stale, priceless or unavailable consensus must read as nothing');
  const lossView = consensus.consensusView({ valuationPrice: 10, factorSessionDate: '2026-10-12' }, { ...consensusRow, fwd: { ...consensusRow.fwd, eps: -0.4 } }, { now: consensusNow });
  if (!lossView || lossView.fwdPe !== null) fail('v57.54 an expected loss has no forward PER');
  // v57.83 codex audit F29: a stale close beside a fresh consensus builds no "current" Forward PER.
  if (consensus.consensusView({ valuationPrice: 226.32, factorSessionDate: '2020-01-02' }, consensusRow, { now: consensusNow }) !== null
    || !consensus.consensusView({ valuationPrice: 226.32, factorSessionDate: '2026-10-12' }, consensusRow, { now: consensusNow })) fail('v57.83 the consensus view checks the close date as well as the estimate date');
  if (consensus.consensusView({ valuationPrice: 226.32 }, consensusRow, { now: consensusNow }) !== null) fail('v57.84 an undated close fails closed (no Forward PER without its close date)');
  const { buildConsensusRow, nextConsensusRow } = await load('scripts/fetch-consensus-estimates.mjs');
  const goodRow = { asOf: '2026-10-01T00:00:00Z', fwd: { eps: 4 } };
  if (nextConsensusRow(goodRow, null, '2026-10-14T00:00:00Z') !== goodRow
    || !nextConsensusRow(goodRow, null, '2026-10-30T00:00:00Z').unavailable || !nextConsensusRow(undefined, null, '2026-10-14T00:00:00Z').unavailable
    || nextConsensusRow(goodRow, { asOf: 'x' }, '2026-10-14T00:00:00Z').asOf !== 'x') fail('v57.54 an empty consensus answer keeps a good row inside 21 days instead of hiding it for 14');
  const builtRow = buildConsensusRow({ quarterlyForecast: { rows: ['Jul 2026', 'Oct 2026', 'Jan 2027', 'Apr 2027', 'Jul 2027'].map((fiscalEnd, i) => ({ fiscalEnd, consensusEPSForecast: 1 + i, highEPSForecast: 2 + i, lowEPSForecast: i, noOfEstimates: 5, up: 1, down: 0 })) } },
    { earningsSurpriseTable: { rows: ['Jul 2026', 'Apr 2026', 'Jan 2026', 'Oct 2025'].map((fiscalQtrEnd) => ({ fiscalQtrEnd, eps: 1, dateReported: '8/26/2026' })) } }, 'now');
  if (builtRow?.fwd?.from !== '2026-10' || builtRow.fwd.eps !== 14 || builtRow.trailing.eps !== 4 || builtRow.fwd.up4w !== 4) fail(`v57.54 a forecast row already reported is not "ahead", got ${JSON.stringify(builtRow)}`);
  // 2026-10-14: never-fetched symbols go by index weight, then 30-session dollar volume, before older rows.
  const { pickBatch, consensusPriority } = await load('scripts/fetch-consensus-estimates.mjs');
  const consensusPriorityMap = consensusPriority({ indexWeights: { columns: ['sym', 'sector', 'weight', 'name'], rows: [['MSFT', 'IT', 6.1, 'Microsoft'], ['AAPL', 'IT', 6.5, 'Apple']] },
    data: { AAPL: { dollarVolume30d: 1e10, dollarVolumeCurrency: 'USD' }, ZZZ: { dollarVolume30d: 5e9, dollarVolumeCurrency: 'USD' }, AAA: { dollarVolume30d: 1e6, dollarVolumeCurrency: 'USD' } } });
  const pickNow = Date.parse('2026-10-14T00:00:00Z');
  const picked = pickBatch(['AAA', 'OLD', 'ZZZ', 'MSFT', 'AAPL'], { OLD: { asOf: '2026-09-01T00:00:00Z' } }, pickNow, 5, consensusPriorityMap);
  if (picked.join(',') !== 'AAPL,MSFT,ZZZ,AAA,OLD' || pickBatch(['B', 'A'], {}, pickNow, 2).join(',') !== 'A,B') fail(`consensus batch must order first-time symbols by weight then dollar volume, got ${picked.join(',')}`);

  // v57.54 (owner image 3): per-market price temperature — five three-year ranks side by side, an extreme spell only
  // when three components sit in the same decile, no average (D02); US markets first; the producer never ranks an
  // intraday print and fills an empty provider close from the exchange series.
  const temp = await load('src/domain/sentiment/market-temperature.js');
  const tempDates = [];
  for (let t = Date.UTC(2020, 0, 1); tempDates.length < 1300; t += 86400000) { const day = new Date(t).getUTCDay(); if (day && day < 6) tempDates.push(new Date(t).toISOString().slice(0, 10)); }
  const wave = (i) => 100 * Math.exp(i * 0.0004) * (1 + 0.01 * Math.sin(i / 7) + 0.006 * Math.sin(i / 3.1));
  const selloff = tempDates.map((date, i) => [date, i < 1285 ? wave(i) : wave(1284) * (1 - 0.018 * (i - 1284))]);
  const cold = temp.buildMarketTemperature(selloff);
  if (!cold || cold.state !== 'cold' || cold.cold < 3 || cold.streak < 1 || cold.components.length !== 5 || cold.history.length !== 504 || !cold.outcomes.all?.h63?.n || !('h21' in cold.outcomes.cold)) fail(`v57.54 a sharp selloff after a steady rise must read as a cold spell with outcomes, got ${JSON.stringify(cold && { state: cold.state, cold: cold.cold, streak: cold.streak })}`);
  if ('score' in cold || 'average' in cold || cold.components.some((row) => !(row.score >= 0 && row.score <= 100))) fail('v57.54 D02: the temperature carries component ranks, never an averaged score');
  if (temp.buildMarketTemperature(selloff.slice(0, 400)) !== null) fail('v57.54 fewer than two years of closes is not ranked');
  if (temp.TEMPERATURE_MARKETS.slice(0, 2).some((market) => market.region !== 'us') || temp.TEMPERATURE_MARKETS.findIndex((market) => market.id === 'kospi') < 2) fail('v57.54 US markets lead the temperature list; Korea and Japan follow');
  const { mergeSessions } = await load('scripts/build-market-temperature.mjs');
  const merged = mergeSessions([['2026-10-12', 6384.24], ['2026-10-13', null], ['2026-10-14', 6123.29]], [['2026-10-13', 6035.35]], 'kospi', Date.parse('2026-10-14T03:00:00Z'));
  if (JSON.stringify(merged.rows) !== JSON.stringify([['2026-10-12', 6384.24], ['2026-10-13', 6035.35]]) || merged.gaps.length) fail(`v57.54 the exchange close fills the empty provider session and today's intraday KOSPI print is not a close, got ${JSON.stringify(merged)}`);
  const gapped = mergeSessions([['2026-10-09', 69030.92], ['2026-10-13', null]], [], 'nikkei', Date.parse('2026-10-14T03:00:00Z'));
  if (gapped.rows.length !== 1 || gapped.gaps[0] !== '2026-10-13') fail(`v57.54 a session still empty after reconciliation is dropped and listed, got ${JSON.stringify(gapped)}`);
  const tempUi = await load('src/ui/components/market-temperature.js');
  const spans = tempUi.extremeSpans([['2026-01-01', 1, 3, 0], ['2026-01-02', 1, 4, 0], ['2026-01-05', 1, 0, 0], ['2026-01-06', 1, 0, 3]]);
  if (JSON.stringify(spans) !== JSON.stringify([{ start: '2026-01-01', end: '2026-01-02', tone: 'cold' }, { start: '2026-01-06', end: '2026-01-06', tone: 'hot' }])) fail(`v57.54 extreme spans group consecutive sessions by tone, got ${JSON.stringify(spans)}`);
  const evidence = tempUi.temperatureEvidence({ label: '코스피', from: '1999-01-05', state: 'cold', outcomes: { cold: { h63: { n: 39, mean: 5.6, se: 2.5, hitRate: 67, p10: -11.8 } }, all: { h63: { n: 6800, mean: 3.1, se: 1.25, hitRate: 60 } } } });
  if (!/1999년 이후 강한 냉각 구간이 시작된 첫날 중 서로 겹치지 않는 39번/.test(evidence) || !/두 범위가 겹쳐 평균 차이는 구별되지 않습니다/.test(evidence) || /예측은 아닙니다/.test(evidence)) fail(`v57.54/v57.84 the past-spell line (overlap verdict carries the caveat; the boilerplate 예측 sentence is gone) names n, the ± range and whether it clears the baseline, got ${evidence}`);
  const staleIds = tempUi.staleMarketIds({ retained: ['kosdaq'] }, [{ id: 'spx', asOf: '2026-10-13' }, { id: 'kosdaq', asOf: '2026-10-13' }, { id: 'nikkei', asOf: '2026-10-02' }, { id: 'kospi', asOf: '2026-10-09' }]);
  if ([...staleIds].sort().join(',') !== 'kosdaq,nikkei') fail(`v57.54 a retained market or one more than a week behind is stale and leaves the "now" lead, got ${[...staleIds]}`);
  // v57.83 codex audit F05 + R706: under 10 non-overlapping windows no average; 10-29 carries the small-sample note;
  // every kept 63-session window starts at least 63 sessions after the previous one.
  const tempEv = (n) => tempUi.temperatureEvidence({ label: 'x', from: '2000', state: 'hot', outcomes: { hot: { h63: { n, mean: 1, se: 1, hitRate: 50, p10: -5 } }, all: { h63: { n: 4000, mean: 2, se: 1, hitRate: 60 } } } });
  if (!/9번뿐/.test(tempEv(9)) || /평균 \+/.test(tempEv(9)) || !/작은 표본/.test(tempEv(10)) || !/작은 표본/.test(tempEv(29)) || /작은 표본/.test(tempEv(30))) fail(`v57.83 the temperature evidence follows R706 at n 9/10/29/30, got ${[9, 10, 29, 30].map(tempEv).join(' | ')}`);
  {
    const spikes = tempDates.map((date, i) => [date, wave(i) * (i > 700 && i % 40 < 3 ? 0.9 : 1)]);
    const spiky = temp.buildMarketTemperature(spikes);
    const h63 = spiky?.outcomes?.cold?.h63;
    if (!h63 || h63.nonOverlapping !== true || !(h63.spells >= h63.n)) fail(`v57.83 temperature outcomes keep only starts a full horizon apart, got ${JSON.stringify(h63)}`);
  }
  // v57.54: the 2026-10-14 packet — three frames reach the lessons and the claim ledger; dated claims carry a verification state.
  const packet = await load('src/domain/research/packet-20261014.js');
  const learning = await load('src/domain/knowledge/learning-core.js');
  if (packet.PACKET_20261014_FRAMES.some((frame) => !learning.lessonById(frame.id)) || packet.PACKET_20261014_CLAIMS.length !== 3) fail('v57.54 packet frames must be lessons and claims');
  const checks = packet.PACKET_20261014_SOURCES.flatMap((row) => row.checks);
  if (packet.PACKET_20261014_SOURCES.length !== 16 || !checks.length || checks.some((check) => !['VERIFIED', 'CONSISTENT', 'UNVERIFIED'].includes(check.state) || !check.basis)) fail('v57.54 every dated claim in the packet carries a verification state and its basis');
  // v57.74: the 2026-10-15 crash-day note — three frames become lessons on a learning path; a misattributed figure stays UNVERIFIED.
  const packet15 = await load('src/domain/research/packet-20261015.js');
  const onPath = new Set(learning.PATHS.flatMap((path) => path.lessons));
  if (packet15.PACKET_20261015_FRAMES.some((frame) => !learning.lessonById(frame.id) || !onPath.has(frame.id)) || packet15.PACKET_20261015_CLAIMS.length !== 3) fail('v57.74 crash-day frames must be lessons on a path and claims');
  const checks15 = packet15.PACKET_20261015_SOURCES.flatMap((row) => row.checks);
  if (checks15.some((check) => !['VERIFIED', 'CONSISTENT', 'UNVERIFIED'].includes(check.state) || !check.basis) || checks15.find((check) => /Gartner/.test(check.claim))?.state !== 'UNVERIFIED') fail('v57.74 the crash-day drivers carry verification states; the misattributed Gartner figure stays unverified');
  // v57.75: chat retrieval finds the crash-day frames from a Korean question with particles ("연준이", "거품이").
  {
    const retrieval = await load('src/ai/retrieval/knowledge.js');
    const supplied = await load('src/domain/research/supplied-materials.js');
    const index = retrieval.createAIKnowledgeIndex([], { suppliedMaterials: supplied.SUPPLIED_MATERIALS_REFERENCE });
    const top = (query) => retrieval.retrieveAIKnowledge(index, query).matches[0]?.articleId;
    if (top('AI 거품이 터지면 연준이 돈을 풀어서 받쳐줄까?') !== 'supplied-material:claim-20261015-policy-floor-limits'
      || top('AI 투자 회수 언제 되나') !== 'supplied-material:claim-20261015-ai-capex-payback') fail('v57.75 chat retrieval must reach the crash-day frames through Korean particles and frame titles');
    // v57.87: the full X-bookmark read — every frame is a lesson on a path and a claim; the audit adds up; chat reaches the new frames.
    const packet16 = await load('src/domain/research/packet-20261016-x-bookmarks.js');
    const audit = packet16.PACKET_20261016_AUDIT;
    const ids16 = new Set(packet16.PACKET_20261016_SOURCES.map((row) => row.id));
    if (packet16.PACKET_20261016_FRAMES.length !== 19 || packet16.PACKET_20261016_FRAMES.some((frame) => !learning.lessonById(frame.id) || !onPath.has(frame.id) || frame.sourceRefs.some((id) => !ids16.has(id)))
      || packet16.PACKET_20261016_CLAIMS.length !== 19 || !supplied.SUPPLIED_MATERIALS_REFERENCE.claimLedger.claims.some((claim) => claim.id === 'claim-20261016-reserve-buffer-regime')) fail('v57.87 bookmark frames must be lessons on a path, cite listed sources and reach the claim ledger');
    const checks16 = packet16.PACKET_20261016_SOURCES.flatMap((row) => row.checks);
    if (audit.fetched + audit.fetchErrors !== audit.bookmarks || Object.values(audit.repoState).reduce((a, b) => a + b, 0) !== audit.analyzed || audit.analyzed + audit.nonInvestment !== audit.bookmarks
      || checks16.some((row) => !['VERIFIED', 'CONSISTENT', 'UNVERIFIED'].includes(row.state) || !row.basis)) fail('v57.87 the bookmark audit must add up and every dated claim carries a verification state');
    const follow16 = audit.itemFollowUp;
    if (!follow16 || follow16.reflected + follow16.partial + follow16.proposed + follow16.declined !== follow16.items || packet16.PACKET_20261016_SOURCES.length !== 63 + follow16.sourcesAdded
      || new Set(packet16.PACKET_20261016_SOURCES.map((row) => row.id)).size !== packet16.PACKET_20261016_SOURCES.length) fail('v57.91 the bookmark item pass must add up and its added sources stay unique');
    if (top('역레포가 바닥이면 TGA가 준비금을 줄이나') !== 'supplied-material:claim-20261016-reserve-buffer-regime' || top('사모신용 환매 대기열') !== 'supplied-material:claim-20261016-private-credit-redemption'
      || top('구리랑 광학 중에 뭐가 이겨') !== 'supplied-material:claim-20261016-interconnect-distance-time') fail('v57.87 chat retrieval must reach the bookmark frames');
  }

  // S12: the Korean filing button opens a receipt only when one is published; otherwise the DART search.
  const fiscalUi = await load('src/ui/components/fiscal-read.js');
  if (fiscalUi.dartLinkHref({ receiptNo: '20250311001085' }) !== 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250311001085' || fiscalUi.dartLinkHref(null) !== 'https://dart.fss.or.kr/dsab007/main.do') fail('S12 DART link format drifted');
  if (fiscalUi.formatFiscalCompact(416161e6) !== '$416.2B' || fiscalUi.formatFiscalCompact(-7126000) !== '−$7.1M') fail('S20 fiscal table must use B/T units');
}

// ── domain/technical/follow-through.js (v57.87) ─────────────────────────────────────────────
{
  const ft = await load('src/domain/technical/follow-through.js');
  const conditions = await load('src/domain/screener/custom-conditions.js');
  const presentation = await load('src/domain/screener/row-presentation.js');
  // Pocket pivot: the last up close on more volume than any down close in the 10 sessions before it.
  const pcl = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 ? -1 : 1));
  const pvol = Array.from({ length: 30 }, () => 100);
  pcl[29] = pcl[28] + 2; pvol[29] = 150;
  const pocket = ft.pocketPivotAgo(pcl, pvol);
  if (pocket.ago !== 0 || !(pocket.count >= 1) || ft.pocketPivotAgo(pcl.slice(0, 15), pvol.slice(0, 15)).ago !== null) fail(`v57.87 pocket pivot must read the last session and stay null on short history, got ${JSON.stringify(pocket)}`);
  pvol[29] = 90;
  if (ft.pocketPivotAgo(pcl, pvol).ago === 0) fail('v57.87 an up close on lighter volume than the largest down close is not a pocket pivot');
  // Heavy down days (v57.88): a 1%+ lower close on volume above the stock's own 50-session average. Shallow drops
  // and light-volume drops do not count; the index rule (0.2%, more than the prior session) was too loose for stocks.
  const hcl = [100];
  const hvol = [100];
  const step = (pct, vol) => { hcl.push(hcl[hcl.length - 1] * (1 + pct / 100)); hvol.push(vol); };
  for (let i = 0; i < 59; i += 1) step(0, 100);
  for (let i = 0; i < 5; i += 1) step(-1.5, 150);
  for (let i = 0; i < 3; i += 1) step(-0.5, 150);
  for (let i = 0; i < 2; i += 1) step(-2, 90);
  for (let i = 0; i < 15; i += 1) step(0.2, 100);
  if (ft.heavyDownDays(hcl, hvol) !== 5 || ft.heavyDownDays(hcl.slice(-60), hvol.slice(-60)) !== null) fail(`v57.88 heavy down days must count 1%+ drops above the 50-session average volume only, got ${ft.heavyDownDays(hcl, hvol)}`);
  // Base number: a 10% pullback for 20 sessions then a new high = base 1; a second 9% pullback still open = base 2 forming.
  const series = [];
  for (let i = 0; i < 160; i += 1) series.push(100 + i * 0.3125);
  for (let i = 1; i <= 20; i += 1) series.push(150 - i * 0.75);
  for (let i = 1; i <= 40; i += 1) series.push(135 + i * 0.625);
  for (let i = 1; i <= 25; i += 1) series.push(160 - i * 0.6);
  const base = ft.baseCount(series);
  if (base?.count !== 2 || base.forming !== true || !(base.depthPct > 8) || ft.baseCount(series.slice(0, 100)) !== null) fail(`v57.87 base count must count completed and forming bases, got ${JSON.stringify(base)}`);
  // v57.88: a close below the completed base's low (135) means the base failed — the count restarts.
  const failed = series.slice(0, -25);
  for (let i = 1; i <= 25; i += 1) failed.push(160 - i * 1.2);
  if (ft.baseCount(failed)?.count !== 0) fail(`v57.88 a close below the last completed base low must restart the base count, got ${JSON.stringify(ft.baseCount(failed))}`);
  // Climax: a run from 50 with nine up closes in the last ten and the year's largest gain at the end.
  const run = Array.from({ length: 250 }, (_, i) => 50 + i * 0.25);
  run[249] = run[248] * 1.08;
  const runVol = Array.from({ length: 250 }, (_, i) => (i === 249 ? 1000 : 100));
  const signs = ft.climaxSigns(run, runVol);
  if (!['run-up-days', 'largest-gain', 'largest-volume'].every((sign) => signs.includes(sign)) || ft.climaxSigns(Array(250).fill(10), Array(250).fill(1)).length !== 0) fail(`v57.87 climax signs drifted, got ${JSON.stringify(signs)}`);
  // Down-day resilience against the index on matched dates only.
  const dates = Array.from({ length: 61 }, (_, i) => `2026-07-${String(i).padStart(2, '0')}`);
  const index = new Map(dates.slice(1).map((date, i) => [date, i % 2 ? -1 : 0.5]));
  const stock = dates.map((_, i) => 100 + (i % 2 ? 0.2 : 0));
  const resilience = ft.downDayResilience(dates, stock, index);
  if (!resilience || resilience.days !== 30 || resilience.holdRatePct !== 100 || ft.downDayResilience(dates, stock, new Map()) !== null) fail(`v57.87 down-day resilience must compare matched index down days, got ${JSON.stringify(resilience)}`);
  // Conditions: missing data is not a pass; an empty climax list is.
  const read = (row, key) => row[key] ?? null;
  const judge = (id, row, value) => conditions.evaluateCondition({ id, value }, row, read);
  if (judge('no-climax', { climaxSigns: [] }) !== true || judge('no-climax', { climaxSigns: ['stretch-200'] }) !== false || judge('no-climax', {}) !== null
    || judge('early-base', { baseCount: 0 }, 2) !== false || judge('early-base', { baseCount: 2 }, 2) !== true || judge('pocket-pivot', { pocketPivots10: 0 }) !== false
    || judge('not-extended', { pctSma50: 12, adrPct: 2 }, 4) !== false || judge('not-extended', { pctSma50: 6, adrPct: 2 }, 4) !== true || judge('down-day-hold', { downDayHoldPct: 65 }, 60) !== true) fail('v57.87 follow-through conditions misjudge a row');
  // v57.88 (review): far below the 50-day line is not "before extension"; the sentence parser must not invert or misread.
  if (judge('not-extended', { pctSma50: -25, adrPct: 2 }, 4) !== false || judge('not-extended', { pctSma50: -1.5, adrPct: 2 }, 4) !== true) fail('v57.88 not-extended must keep the 50-day 부근 floor');
  const parsedFollow = (text) => JSON.stringify(conditions.parseConditionText(text));
  if (parsedFollow('거래량 실린 하락일 3일 이하') !== '{"conditions":[{"id":"few-heavy-down","value":3}],"unknown":""}'
    || /not-extended/.test(parsedFollow('확장 전체에서 VCP')) || !/"adr-min","value":3/.test(parsedFollow('변동폭 3% 넘게'))) fail('v57.88 follow-through sentence rules misread a phrase');
  const summary = presentation.followThroughSummary({ baseCount: 2, baseForming: true, baseDepthPct: 9.4, pocketPivotAgo: 3, downDayHoldPct: 70, downDayCount: 20, downDayExcessPp: 0.6, heavyDownDays25: 2, climaxSigns: ['largest-gain'] });
  if (summary.text !== '베이스 2번째(형성 중) · 포켓 피벗 3일 전 · 하락일 버팀 70% · 클라이맥스 징후 1' || presentation.followThroughSummary({}).text !== '—' || /매수|매도|진입|손절|목표/.test(summary.title)) fail(`v57.87 follow-through summary drifted, got ${summary.text}`);
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
    factory: (module) => module.createMastersPage(),
    retryDelaysMs: [] // the automatic retry (v57.55) is exercised below; this case checks the fail-closed state
  });
  // v57.55 review: a transient import failure (429) is retried automatically before the route reads 'failed'.
  {
    let flakyLoads = 0;
    const flaky = createLazyPage({ route: 'breadth', loader: async () => { flakyLoads += 1; if (flakyLoads < 3) throw new Error('429'); return { page: { mount: () => () => {} } }; }, factory: (module) => module.page, retryDelaysMs: [1, 1] });
    const flakyNode = { dataset: {}, querySelector: () => null, prepend() {} };
    flaky.mount({ documentRef: { getElementById: (id) => (id === 'page-breadth' ? flakyNode : null), createElement: () => ({ dataset: {}, setAttribute() {} }) } });
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (flakyLoads !== 3 || flakyNode.dataset.aioRouteModuleState !== 'ready') fail(`lazy-router: a transient import failure must be retried before failing, got ${flakyLoads}/${flakyNode.dataset.aioRouteModuleState}`);
  }
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
  if (empty.status !== 'unavailable' || empty.dailyChange !== null || 'exposureCap' in empty || empty.sectorBreakdown.length !== 0) fail(`portfolio-surface: empty input must remain unavailable, got ${JSON.stringify(empty)}`);
  const quoteNow = Date.parse('2026-09-12T15:00:00Z');
  const currentQuote = (price, extra = {}) => ({ price, observedAt: '2026-09-12T14:55:00Z', source: 'runtime-test-provider', sourceKind: 'LIVE', sourceTier: 'T2_LICENSED', rightsId: 'runtime-test-rights', revisionId: 'runtime-test-r1', allowedUse: 'decision', allowedUseCeiling: 'decision', quality: { status: 'live', freshness: 'live', timestampValid: true, ageMs: 5 * 60 * 1000, freshnessMs: 15 * 60 * 1000 }, ...extra, dailyPct: extra.dailyPct ?? extra.pct ?? null, changeBasis: extra.changeBasis || 'previous-close' });
  const live = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10, sector: 'Technology' }], cash: 50 }, liveData: { ABC: currentQuote(12, { pct: 2 }) }, vix: currentQuote(22), now: quoteNow });
  if (live.modelVersion !== 'portfolio-surface.v3' || live.positionValue !== 24 || live.totalAssets !== 74 || live.totalPnl !== 4 || 'exposureCap' in live ||live.sectorBreakdown.length !== 2 || live.valuationState !== 'complete' || live.allowedUse !== 'reference-only' || live.decisionEligible !== false || live.snapshotFallbackBlocked !== true || live.costFallbackBlocked !== true) fail(`portfolio-surface: live/cash derivation or reference boundary drifted, got ${JSON.stringify(live)}`);
  const partial = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10 }, { symbol: 'XYZ', shares: 1, avgCost: 20 }], cash: null }, liveData: { ABC: currentQuote(12, { pct: 2 }) }, vix: currentQuote(22), now: quoteNow });
  if (partial.positionValue !== null || partial.totalPnl !== null || partial.dailyChange !== null || partial.sectorBreakdown.length !== 0) fail(`portfolio-surface: partial holdings must not sum unknown rows as zero, got ${JSON.stringify(partial)}`);
  const closed = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10 }, { symbol: 'XYZ', shares: 1, avgCost: 20 }], cash: 0 }, liveData: { ABC: currentQuote(12, { pct: 2 }) }, vix: null, now: quoteNow, closeOf: (symbol) => (symbol === 'XYZ' ? { price: 25, date: '2026-10-13' } : { price: 99, date: '2026-10-13' }) });
  if (closed.valuationState !== 'complete' || closed.positionValue !== 49 || closed.closeValuedCount !== 1 || closed.closeDate !== '2026-10-13' || closed.rows[0].price !== 12 || closed.rows[1].sourceKind !== 'completed-close' || closed.decisionEligible === true) fail(`v57.54 review: a holding without a live quote is valued at the dated completed close (live still wins), got ${JSON.stringify({ state: closed.valuationState, value: closed.positionValue, n: closed.closeValuedCount })}`);
  // v57.58 (KRX holdings): a ~20-minute delayed public KRX quote values a Korean holding as a delayed reference; a
  // quote older than 72 h, or a snapshot source, still does not; a published close keeps priority.
  const krxQuote = (minutesAgo, source = 'live:yahoo-proxy') => ({ price: 160100, currency: 'KRW', source, sourceKind: 'LIVE', stale: true, observedAt: new Date(quoteNow - minutesAgo * 60000).toISOString() });
  const krx = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: '105560.KS', shares: 3, avgCost: 150000 }], cash: 0 }, liveData: { '105560.KS': krxQuote(20) }, vix: null, now: quoteNow });
  if (krx.rows[0].value !== 480300 || krx.rows[0].sourceKind !== 'delayed-reference-quote' || krx.delayedValuedCount !== 1 || krx.decisionEligible === true) fail(`v57.58: a delayed KRX quote values the holding as a delayed reference, got ${JSON.stringify({ value: krx.rows[0].value, kind: krx.rows[0].sourceKind })}`);
  const krxOld = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: '105560.KS', shares: 3, avgCost: 150000 }], cash: 0 }, liveData: { '105560.KS': krxQuote(73 * 60) }, vix: null, now: quoteNow });
  const krxSnap = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: '105560.KS', shares: 3, avgCost: 150000 }], cash: 0 }, liveData: { '105560.KS': krxQuote(20, 'snapshot:data.json') }, vix: null, now: quoteNow });
  const krxClose = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'XYZ', shares: 1, avgCost: 20 }], cash: 0 }, liveData: { XYZ: krxQuote(20) }, vix: null, now: quoteNow, closeOf: () => ({ price: 25, date: '2026-10-13' }) });
  if (krxOld.rows[0].value != null || krxSnap.rows[0].value != null || krxClose.rows[0].sourceKind !== 'completed-close') fail('v57.58: an old or snapshot quote must not value a holding, and a completed close keeps priority over a delayed quote');
  // v57.58 custom screener conditions: sentence parsing, MA order from distances, missing data never passes.
  const custom = await load('src/domain/screener/custom-conditions.js');
  const parsedCustom = custom.parseConditionText('5/10/20 정배열이면서 신고가 종목, PER 20 이하 반도체');
  if (parsedCustom.conditions.map((item) => item.id).sort().join() !== 'ma-short,new-high,pe-max' || parsedCustom.unknown !== '반도체') fail(`v57.58: custom condition parser, got ${JSON.stringify(parsedCustom)}`);
  const screenWords = custom.parseConditionText('52주 신고가 · 50일선 200일선 정배열');
  if (screenWords.unknown || screenWords.conditions.map((item) => item.id).sort().join() !== 'ma-long,new-high' || custom.normalizeConditions([{ id: 'pe-max', value: '' }])[0].value !== 20) fail(`v57.58: the screen's own words parse fully and an emptied threshold returns to its default, got ${JSON.stringify(screenWords)}`);
  const readRaw = (row, key) => row[key] ?? null;
  const stacked = { pctSma5: 1, pctSma10: 2, pctSma20: 3, pctFromCloseHigh52w: 0, pe: 15 };
  if (!custom.matchesConditions(stacked, parsedCustom.conditions, readRaw)
    || custom.matchesConditions({ ...stacked, pctSma10: 0.5 }, parsedCustom.conditions, readRaw)
    || custom.matchesConditions({ ...stacked, pe: null }, parsedCustom.conditions, readRaw)
    || custom.matchesConditions({ ...stacked, pe: -5 }, parsedCustom.conditions, readRaw)) fail('v57.58: custom conditions must require the MA order, a positive PER under the cap and present data');
  const vcpOnly = [{ id: 'vcp' }];
  const usable = custom.availableConditionIds([{ vcpStage: 'base', pe: null }], readRaw);
  if (!custom.matchesConditions({ vcpStage: 'contracting' }, vcpOnly, readRaw) || !custom.matchesConditions({ vcpStage: 'near_pivot' }, vcpOnly, readRaw)
    || custom.matchesConditions({ vcpStage: 'near_pivot', vcpShrinking: false }, vcpOnly, readRaw) || custom.matchesConditions({ vcpStage: 'breakout' }, vcpOnly, readRaw)
    || custom.matchesConditions({ vcpStage: 'near_pivot', vcpContractions: 1, vcpShrinking: null }, vcpOnly, readRaw)
    || !custom.matchesConditions({ vcpStage: 'near_pivot', vcpContractions: 3, vcpShrinking: true }, vcpOnly, readRaw)
    || custom.matchesConditions({ vcpStage: 'near_pivot', vcpContractions: 3, vcpShrinking: false }, vcpOnly, (await load('src/ui/pages/screener.js')).customRead)
    || !usable.has('vcp') || usable.has('pe-max')) fail('v57.59: VCP 수렴 needs contraction (near pivot only while still shrinking) and a market without a field greys that condition out');
  // v57.58 (live review 4f): the long-history position is the share of months at or below the latest one.
  const { longHistoryRows } = await load('src/domain/macro/long-history.js');
  const months = Array.from({ length: 200 }, (_, index) => [`${1990 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`, index < 199 ? index : 49.5]);
  const [longRow] = longHistoryRows({ series: { vix: { label: 'VIX', unit: 'index', observations: months } } });
  if (!longRow || longRow.percentile !== 26 || longRow.max.value !== 198 || longRow.min.value !== 0 || longHistoryRows({ series: { vix: { observations: months.slice(0, 50) } } }).length !== 0) fail(`v57.58: long-history position, got ${JSON.stringify(longRow && { p: longRow.percentile, max: longRow.max, min: longRow.min })}`);
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
  if (unprovenRuntime.rows[0]?.price !== 11 || unprovenRuntime.rows[0]?.sourceKind !== 'portfolio-state' ||unprovenRuntime.vix !== null) throw new Error('portfolio surface must not promote undated/source-less runtime prices or VIX');
  const staleRuntime = derivePortfolioSurface({ state: { status: 'current', holdings: [{ symbol: 'ABC', shares: 2, avgCost: 10, price: 11 }], cash: 0 }, liveData: { ABC: { price: 99, observedAt: '2026-09-12T13:00:00Z', source: 'runtime-test-provider' } }, vix: { price: 40, observedAt: '2026-09-12T14:55:00Z', source: 'snapshot:last-known-good' }, now: quoteNow });
  if (staleRuntime.rows[0]?.price !== 11 || staleRuntime.sourceKind !== 'portfolio-state') throw new Error('portfolio surface must reject stale quotes and snapshot VIX as current runtime evidence');
  if (invalidPortfolio.positionValue !== null || invalidPortfolio.cash !== null ||invalidPortfolio.exposurePolicyStatus !== 'reference-only') fail(`portfolio-surface: invalid balances or VIX entered the portfolio projection, got ${JSON.stringify(invalidPortfolio)}`);
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

  // E0/P1280 (P-A/P-E): the facade no longer keeps a second Vault mapping — one reader owns it
  // and the two surfaces must be byte-identical for the same host, including the fields the old
  // facade copy dropped (targetWeight, declared currencies, ledger, fxLegs, readState, locked).
  // A dead `getPortfolioState` host branch must no longer change any answer either.
  const shadowRoot = { isPortfolioLocked: () => false, localStorage: { getItem: () => null }, getPortfolioData: () => [
    { ticker: 'AAA', qty: 1, cost: 90, target: 0 },
    { ticker: 'BBB', qty: 1, cost: 90, target: 25, targetWeight: 0, sector: 'Tech', currency: 'KRW', costCurrency: 'KRW' }
  ] };
  const facadeShadow = createLegacyFacade(shadowRoot, {}).readPortfolio();
  const runtimeShadow = createRuntimeReaders({ root: shadowRoot }).readPortfolio();
  if (JSON.stringify(facadeShadow) !== JSON.stringify(runtimeShadow)) {
    fail(`P1280 portfolio-reader: the facade and the runtime reader drifted for one host, facade=${JSON.stringify(facadeShadow)} runtime=${JSON.stringify(runtimeShadow)}`);
  }
  if (facadeShadow.holdings[1]?.targetWeight !== 0 || facadeShadow.holdings[1]?.currency !== 'KRW' || facadeShadow.holdings[1]?.costCurrency !== 'KRW') {
    fail(`P1280 portfolio-reader: the shared reader dropped the declared weight or currency, got ${JSON.stringify(facadeShadow.holdings[1])}`);
  }
  if (facadeShadow.readState !== 'ready' || facadeShadow.holdingsKnown !== true || facadeShadow.cashKnown !== false || facadeShadow.totals !== null) {
    fail(`P1280 portfolio-reader: the shared reader lost read-state honesty or re-adopted a second totals owner: ${JSON.stringify({ readState: facadeShadow.readState, holdingsKnown: facadeShadow.holdingsKnown, cashKnown: facadeShadow.cashKnown, totals: facadeShadow.totals })}`);
  }
  const lockedShadow = createLegacyFacade({ isPortfolioLocked: () => true, getPortfolioData: () => [{ ticker: 'AAA', qty: 1, cost: 90 }] }, {}).readPortfolio();
  if (lockedShadow.readState !== 'locked' || lockedShadow.holdingsKnown !== false || lockedShadow.holdings.length !== 0) {
    fail(`P1280 portfolio-reader: a locked Vault leaked holdings through the facade surface: ${JSON.stringify(lockedShadow)}`);
  }
  if (createLegacyFacade({ getPortfolioData: () => [] }, {}).readPortfolio().status !== 'empty') fail('P1280 portfolio-reader: the empty portfolio lost its status');

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
  // P1316: the import path now restores a full backup bundle; the positions write is `c.positions`.
  if (!/await savePortfolioData\((?:data|c\.positions)\)/.test(workspaceSource) || !/가져오기가 확정되지 않았습니다/.test(workspaceSource)) {
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
  if (!/지금 구성을 과거에도 들고 있었다고 가정한 참고 그래프/.test(e4HtmlSource) || !/단순 추정/.test(e4HtmlSource) || !/배당·분할 미반영/.test(e4HtmlSource)) {
    fail('P1182/22:PFR04 the benchmark chart must disclose retrospective basis, raw close and linear interpolation');
  }
  if (!/TWR\/MWR/.test(e4HtmlSource) || !/원장/.test(e4HtmlSource)) {
    fail('P1182/account-performance the risk surface must state the ledger hold before any computation runs');
  }
  // v57.77: the writerless Sharpe/Beta/MDD/drift example cards (and their "예시 기준" labels) were retired with #pf-risk-section.
  if (/id="pf-sharpe-val"|id="pf-mdd-val"|id="pf-drift-val"|id="pf-analysis-dashboard"/.test(e4HtmlSource)) { // text-pin-ok: retirement absence
    fail('P1182/22 v57.77 the writerless Sharpe/MDD/drift example cards must stay retired');
  }
}
// ── E3/E4/P1188 — 11 P11-02 계좌·현금 통화·수익률 선언 writer · 22 계좌 성과 TWR/MWR ·
//                  전략 경로(fixed_target_weight_strategy) ───────────────────────────────
// 통화·수익률은 입력이지 추정값이 아니다(빈 선언→보류). 계좌 성과는 원장·규약·평가액이 모두
// 선언될 때만 계산하고(무언 0 금지), 목표 비중 유지 전략 경로는 목표비중·리밸런싱 정책을 요구한다.
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
  // v57.83 codex audit F04: MWR uses the TWR cash-flow window — a first-day deposit under start-of-period and a last-day
  // deposit under end-of-period both read TWR = MWR = 10% (it was TWR 10% / MWR 120%).
  {
    const oneYear = (flowTiming, date, from, to) => assessAccountPerformance({ ledger: { ...ledgerBase, flowTiming, transactions: [{ date, kind: 'deposit', amount: 100 }], valuations: [{ date: '2025-01-01', amount: from }, { date: '2026-01-01', amount: to }] } });
    const firstDay = oneYear('start-of-period', '2025-01-01', 100, 220);
    const lastDay = oneYear('end-of-period', '2026-01-01', 100, 210);
    if (![firstDay, lastDay].every((r) => r.status === 'ready' && Math.abs(r.twr - 0.10) < 1e-9 && Math.abs(r.mwr - 0.10) < 1e-6)) {
      fail(`v57.83 account-performance boundary flows must give TWR = MWR, got ${JSON.stringify([firstDay, lastDay].map((r) => ({ twr: r.twr, mwr: r.mwr })))}`);
    }
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
  // v57.81: the cash-currency field is retired — each cash balance carries its own currency (src/data/portfolio-cash.js).
  if (p1188Index.includes('id="pf-cash-currency-input"')) fail('v57.81 the retired cash-currency declaration field came back'); // text-pin-ok: retirement absence
  ['pf-base-currency-input', 'pf-cash-return-input', 'pf-rf-input'].forEach((id) => {
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
  if (!/cash: \{ amount: cashAmount, currency: cashCurrency \}/.test(p1188RiskInput) // v57.81: cash converted into the base, or unresolved
    || !/const baseCurrency = String\(decl0\.baseCurrency \|\| ''\)/.test(p1188RiskInput) // P1407: declared base wins, then the single shared price currency
    || !/cashReturn: decl\.cashReturn != null/.test(p1188RiskInput)
    || !/rfAnnual: decl\.riskFreeRate/.test(p1188RiskInput)) {
    fail('P1188/11 P11-02 the risk path must pass the declared currency/return/RF instead of nulls');
  }
  if (!/cashValue: cashValue/.test(p1188Workspace) || !/declarations: declarations/.test(p1188Workspace)) {
    fail('P1188/11 P11-02 the shell must hand its declarations to the assembled risk input');
  }
  const p1188Bootstrap = readFileSync(path.join(root, 'src/app/compatibility-globals.js'), 'utf8'); // v57.62: window.* bridge moved out of bootstrap
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
  if (!/window\._pfPortfolioLedger = \{/.test(readFileSync(path.join(root, 'src/app/compatibility-globals.js'), 'utf8'))) { // v57.62
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
  // v57.84 P1864: the app's own USD/KRW close fills a missing USD<->KRW leg (labelled app-close); a declared leg still
  // wins, and a pair the app has no close for (JPY) stays held.
  const appFx = { rate: 1400, date: '2026-10-15', label: 'USD/KRW 10/15 종가' };
  const appSurface = derivePortfolioSurface({ state: mixedState, liveData: {}, now, cashFx: appFx });
  const declaredWins = derivePortfolioSurface({ state: { ...mixedState, fxLegs: [{ from: 'KRW', to: 'USD', rate: 1 / 1350, observedAt }] }, liveData: {}, now, cashFx: appFx });
  const jpySurface = derivePortfolioSurface({ state: { ...mixedState, holdings: mixedHoldings.map((row) => row.symbol === 'BBB' ? { ...row, currency: 'JPY', costCurrency: 'JPY' } : row) }, liveData: {}, now, cashFx: appFx });
  if (appSurface.currencyState !== 'converted-with-declared-rates' || appSurface.conversion.legs[0]?.source !== 'app-close'
    || Math.abs(appSurface.positionValue - (10 * 150 + 10 * 15000 / 1400)) > 1e-6
    || declaredWins.conversion.legs.some((leg) => leg.source === 'app-close') || Math.abs(declaredWins.positionValue - (10 * 150 + 10 * 15000 / 1350)) > 1e-6
    || jpySurface.currencyState !== 'mixed-without-conversion' || jpySurface.totalAssets !== null) {
    fail(`v57.84 P1864 app USD/KRW close fallback: ${JSON.stringify({ app: { state: appSurface.currencyState, legs: appSurface.conversion.legs, value: appSurface.positionValue }, declared: declaredWins.positionValue, jpy: jpySurface.currencyState })}`);
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
    ['empty ledger says so', ledgerListMarkup(null) === '입출금 기록 없음' && ledgerListMarkup({ transactions: [], valuations: [] }) === '입출금 기록 없음'],
    ['usable fx leg stays plain', usableFxRow.includes('USD→KRW') && !usableFxRow.includes('opacity:0.7;') && !usableFxRow.includes('사용 불가')],
    ['unusable fx leg names the declared budget', fxMarkup.includes('지금은 쓰지 않음(입력한 지 72시간이 지났거나 기준 시각 이후 관측)') && fxMarkup.includes('opacity:0.7;')],
    ['fx list indexes its remove buttons', fxMarkup.includes('data-arg="0"') && fxMarkup.includes('data-arg="1"')],
    ['persist failure never reads as success', persistFail.ok === false && persistFail.tone === 'var(--data-amber)' && persistFail.text.includes('영구 저장 실패')],
    ['persist failure must not borrow the invalid-entry wording', !persistFail.text.includes('FX leg는') && !persistFail.text.includes('날짜(YYYY-MM-DD)')],
    ['invalid fx names what is missing', invalidFx.text.includes('FX leg는 통화 2개')],
    ['invalid ledger names what is missing', invalidLedger.text.includes('원장 항목은 날짜(YYYY-MM-DD)')],
    ['a durable success keeps its message', saved.ok === true && saved.tone === 'var(--text-muted)' && saved.text === '원장 항목을 삭제했습니다.'],
    ['apply writes the list and reports it', applied === true && fakeList.innerHTML.includes('입력한 환율 없음')],
    ['apply without its elements reports false', appliedEmpty === false],
    ['fields read from the document', readBack['pf-fx-from'] === 'USD' && readBack['pf-fx-to'] === ''],
    ['status write lands on the element', statusWritten && statusWritten.text.includes('FX leg는')]
  ];
  const failedPanels = panelChecks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedPanels.length) fail(`P1195 declared-panel checks failed: ${failedPanels.join(' | ')}`);
  const p1195Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  const p1195Bootstrap = readFileSync(path.join(root, 'src/app/compatibility-globals.js'), 'utf8'); // v57.62
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
    ['the strategy path keeps its own warning', strategyMonthly.warnings.some((line) => line.includes('목표 비중 유지 전략 경로'))]
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
    ['undeclared is selectable in the surface', /<option value="">선택 안 함 \(목표 비중 유지 방식에서 필요\)<\/option>/.test(p1198Index)]
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
  if (!/window\._pfDeclarationsStore = \{ create: createDeclarationsStore \}/.test(readFileSync(path.join(root, 'src/app/compatibility-globals.js'), 'utf8')) // v57.62
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
// 행의 완료 컷을 넘는 스탬프는 그 행에 실릴 수 없다(P1095). 값은 실제 확정 종가이므로 버리지 않고
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

// P1345: a late canonical close must re-derive analysis with or without a bridge.
{
  const { createAIOArchitecture } = await load('src/app/bootstrap.js');
  const { createMarketSnapshot, validateMarketSnapshot, TIER_0_INSTRUMENTS } = await load('src/data/contracts/market-snapshot.js');
  const { createRuntimeReaders } = await load('src/data/runtime-readers.js');
  const { computeTradingScoreModel } = await load('src/domain/signal/trading-score.js');
  const now = Date.parse('2026-09-30T02:00:00Z');
  const observedAt = '2026-09-29T20:00:00Z';
  const values = { '^GSPC': 7670, '^VIX': 16, '^TNX': 4.2, 'DX-Y.NYB': 101, 'CL=F': 70 };
  const snapshot = createMarketSnapshot({ status: 'published', revision: 'P1345-late-close', generatedAt: observedAt,
    attemptedAt: observedAt, lastSuccessfulAt: observedAt, source: 'P1345-fixture',
    coverage: { required: TIER_0_INSTRUMENTS.length, observed: TIER_0_INSTRUMENTS.length },
    quotes: TIER_0_INSTRUMENTS.map((identity) => ({ ...identity, value: values[identity.instrumentId] ?? 100,
      observedAt, fetchedAt: observedAt, source: 'P1345-fixture', sourceKind: 'T3_PUBLIC_DELAYED',
      session: 'MARKET_CLOSED', quality: 'CLOSED_CURRENT', valueBasis: 'regular-session-close', changePct: 0 })) });
  const validation = validateMarketSnapshot(snapshot);
  if (!validation.ok) fail(`P1345: invalid late-close fixture ${validation.errors.join('|')}`);
  for (const withBridge of [true, false]) {
    const runtimeRoot = new EventTarget();
    const timers = new Map();
    let nextTimer = 0;
    let resolveFetch;
    Object.assign(runtimeRoot, { location: { hash: '#home' }, visibilityState: 'visible',
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], _liveData: {},
      _aioHistory: Array.from({ length: 200 }, (_, i) => ({ date: new Date(Date.parse('2026-09-29T00:00:00Z') - (199-i)*86400000).toISOString().slice(0,10), spx: 7000 })),
      setTimeout: (task, delay) => { const id = ++nextTimer; timers.set(id, { task, delay }); return id; },
      clearTimeout: (id) => timers.delete(id),
      AIO: { getTradingDecisionInputEvidence: () => ({ rows: [['dxy-dollar',101],['tnx-yield',4.2],['fg-sentiment',34],['pcr-putcall',0.9]]
        .map(([id,value]) => ({ id, value, observedAt, source: 'P1345-fixture' })) }) } });
    runtimeRoot.document = runtimeRoot;
    if (withBridge) runtimeRoot._aioSetLiveData = (symbol, quote) => { runtimeRoot._liveData[symbol] = quote; return true; };
    const architecture = createAIOArchitecture({ root: runtimeRoot, documentRef: runtimeRoot, now: () => now,
      fetchImpl: () => new Promise((resolve) => { resolveFetch = resolve; }) });
    const stop = architecture.start();
    try {
      const before = architecture.getState().analysis.signal.score;
      await Promise.resolve();
      if (typeof resolveFetch !== 'function') fail('P1345: canonical snapshot fetch did not start');
      resolveFetch({ ok: true, status: 200, json: async () => snapshot });
      const loaded = await stop.ready;
      const after = architecture.getState().analysis.signal.score;
      const expected = computeTradingScoreModel(createRuntimeReaders({ root: runtimeRoot, now: () => now }).readTradingScoreInputs()).total;
      runtimeRoot.computeTradingScore = () => ({ total: 99 }); // P1357: stale legacy cache must not feed sentiment.
      if (createRuntimeReaders({ root: runtimeRoot, now: () => now }).readSentiment().tradingScoreTotal !== expected) fail('P1357 sentiment must derive the canonical current inputs before analysis sync');
      runtimeRoot.computeTradingScore = () => ({ total: 99 }); // P1357: stale legacy cache must not feed sentiment.
      if (createRuntimeReaders({ root: runtimeRoot, now: () => now }).readSentiment().tradingScoreTotal !== expected) fail('P1357 sentiment must derive the canonical current inputs before analysis sync');
      if (before !== null || loaded.ok !== true || typeof after !== 'number' || !Number.isFinite(after) || after !== expected)
        fail(`P1345: late close left analysis stale ${JSON.stringify({ withBridge, before, after, expected, ok: loaded.ok })}`);
    } finally { stop(); }
    if (timers.size) fail('P1345: late snapshot fixture leaked startup timers');
  }
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

// ── P1389/P1390: briefing connected read + schedule ─────────────────────────────────────────
{
  const { buildMarketRead, buildCloseSeries } = await load('src/domain/briefing/market-read.js');
  const { buildBriefingSchedule } = await load('src/domain/briefing/schedule.js');
  const day = (i) => new Date(Date.UTC(2026, 6, 1) + i * 86400000).toISOString().slice(0, 10);
  const rows = Array.from({ length: 260 }, (_, i) => ({ date: day(i), spx: 7000 + i * 3, tnx: i === 10 ? 0 : 4.6 + i * 0.0025 + (i > 254 ? (i - 254) * 0.04 : 0), breadth50: 26, vix: 16, gold: 4400 - i, nasdaq: 26000 + i * 4 }));
  const last = day(259);
  const read = buildMarketRead({ history: rows, credit: { hyBp: 308, hyAsOf: last, fg: 28, fgAsOf: last, hyDelta5Bp: null } });
  const ids = read.statements.map((row) => row.id);
  if (!read.available || !ids.includes('narrow-rally') || !ids.includes('fear-without-credit-stress')) fail(`P1389 briefing read missed cross-asset statements: ${ids}`);
  if (buildCloseSeries(rows, 'tnx').some((point) => point.value === 0)) fail('P1389 a zero yield is a producer gap, not a close');
  if (/HY 5일/.test(read.statements.find((row) => row.id === 'fear-without-credit-stress').text)) fail('P1389 a missing HY change must not print as 0bp');
  if (ids.some((id) => ['real-yield-led', 'breakeven-led', 'bear-steepening', 'bear-flattening'].includes(id))) fail('P1390 rate decomposition must stay silent without FRED inputs');
  const decomposed = buildMarketRead({ history: rows, credit: { hyBp: 308, hyAsOf: last, fg: 28, fgAsOf: last }, rates: { asOf: last, realYield10Delta5: 0.14, breakeven10Delta5: 0.03, dgs2Delta5: -0.02, dgs10Delta5: 0.17 } }).statements.map((row) => row.id);
  if (!decomposed.includes('real-yield-led') || !decomposed.includes('bear-steepening')) fail(`P1390 rate decomposition rules did not fire: ${decomposed}`);
  const texts = [read.headline, ...read.points.map((row) => row.text), ...read.drivers.flatMap((row) => row.reads.map((statement) => statement.text))];
  if (!read.headline || new Set(texts).size !== texts.length) fail('P1389 a statement must appear once on the page');
  // v57.77: a driver card for an asset the move chart draws carries only its level; the archived fact keeps the moves.
  const cardValues = Object.fromEntries(read.drivers.flatMap((row) => row.values));
  const chartedLabels = read.moves.map((row) => row.label);
  if (!chartedLabels.includes('S&P 500') || !chartedLabels.includes('미 10년물') || chartedLabels.some((label) => /1일|5일/.test(cardValues[label] || ''))) fail(`v57.77 driver cards must not repeat the chart's 1-day/5-day moves: ${JSON.stringify(cardValues)}`);
  if (!/^[\d,.]+$/.test(cardValues['S&P 500'] || '')) fail(`v57.77 the S&P 500 card shows only its level: ${cardValues['S&P 500']}`);
  if (!/^[\d.]+%$/.test(cardValues['미 10년물'] || '')) fail(`v57.77 the 10-year card shows only its yield: ${cardValues['미 10년물']}`);
  const archived = Object.fromEntries(read.facts.map((fact) => [fact.label, fact.value]));
  if (!/\(1일 .*, 5일 .*\)/.test(archived['S&P 500'] || '') || !/^[\d.]+% \(1일 [^)]*bp, 5일 [^)]*bp\)$/.test(archived['미 10년물'] || '')) fail(`v57.77 archived facts keep the level with its moves (bp for the 10-year): ${JSON.stringify(archived)}`);

  // P1399: one basis, missing is not a reading, stale inputs are excluded, observation apart from interpretation.
  const { buildMarketRegime, alignInput } = await load('src/domain/briefing/market-read.js');
  const { buildSentimentModel } = await load('src/ui/components/sentiment-board.js');
  const sparse = buildMarketRegime({ history: [{ date: '2026-09-30', spx: 6600, wti: 70 }] });
  if (sparse.overall !== '판정 보류' || sparse.axes.find((row) => row.id === 'commodities').state === 'favorable') fail(`P1399 one S&P and one WTI value produced a verdict: ${sparse.overall}`);
  if (!/^(양호|다소|중립|부담|방어|경계|혼조|대체로)/.test(buildMarketRegime({ history: rows, credit: { hyBp: 308, hyAsOf: last } }).overall)) fail('P1399 a full history must still produce a verdict');
  if (buildSentimentModel({}).synthesis.includes('치우치지 않은')) fail('P1399 no sentiment input must not read as balanced');
  if (/신용 스프레드.*(악화|경계)/.test(buildSentimentModel({ credit: { fg: 20, fgAsOf: '2026-09-30' }, history: [{ date: '2026-09-30', spx: 6600 }] }).synthesis)) fail('P1399 F&G alone must not claim credit stress');
  {
    // v57.77: 시장 폭 / 투자 심리 providers live in the page's 데이터 출처 fold (phones cannot hover), the card notes are one
    // line with the edges in the fold (rules), the always-null aaiiNote is gone, and each breadth group names a lead chart.
    const { PAGE_SOURCES } = await load('src/ui/components/page-sources.js');
    const { RULES } = await load('src/domain/rules/thresholds.js');
    const { BREADTH_GROUPS, buildBreadthCards } = await load('src/ui/components/breadth-board.js');
    if (!PAGE_SOURCES.breadth?.length || !PAGE_SOURCES.sentiment?.length) fail('v57.77 breadth and sentiment need a 데이터 출처 entry');
    const model = buildSentimentModel({});
    if ('aaiiNote' in model) fail('v57.77 the always-null sentiment aaiiNote must stay retired');
    if (model.cards.some((card) => card.source)) fail('v57.77 sentiment cards must not carry hover-only providers');
    for (const id of ['hy', 'composite']) {
      const card = model.cards.find((row) => row.id === id);
      if (!card || !card.rules || card.note.length > 90 || /\d{3}bp/.test(card.note)) fail(`v57.77 ${id} note must be one short line with the thresholds in rules: ${card?.note}`);
    }
    if (!model.cards.find((row) => row.id === 'hy').rules.includes(`${RULES.credit.stressAtBp}bp`)) fail('v57.77 HY rules must state the shared stress edge');
    const breadthIds = new Set(buildBreadthCards([]).map((card) => card.id));
    if (BREADTH_GROUPS.map((group) => group.lead).join(',') !== 'b50,hl,spx' || BREADTH_GROUPS.some((group) => !breadthIds.has(group.lead))) fail('v57.77 breadth group leads must be b50, hl, spx');
    if (buildBreadthCards([]).some((card) => card.source)) fail('v57.77 breadth cards must not carry hover-only conventions');
  }
  const intraday = [...rows, { date: day(260), breadth50: 80, fieldMeta: { breadth50: { observedAt: `${day(260)}T13:30:00.000Z` } } }];
  if (buildMarketRead({ history: intraday }).drivers[0].values.some(([label, value]) => label === '50일선 위 종목' && value === '80%')) fail('P1399 an observation after the S&P 500 close basis must be dropped');
  const staleHy = buildMarketRegime({ history: rows, credit: { hyBp: 300, hyAsOf: day(240), hyDelta5Bp: -3 } }).axes.find((row) => row.id === 'credit');
  if (staleHy.state !== 'unknown' || !/판정에서 제외/.test(staleHy.read)) fail(`P1399 a stale HY reading must be excluded: ${staleHy.state}`);
  if (alignInput('2026-09-29', '2026-09-30').status !== 'lagged' || alignInput('2026-10-01T13:51:11Z', '2026-09-30').status !== 'ahead' || alignInput('2026-09-30T00:00:00.000Z', '2026-09-30').status !== 'aligned') fail('P1399 input alignment states wrong');
  const smallcap = buildMarketRead({ history: rows.map((row, i) => ({ ...row, rut: 2400 - i * 4 })), credit: { hyBp: 300, hyAsOf: last, hyDelta5Bp: -2 } }).statements.find((row) => row.id === 'smallcap-lags');
  if (!smallcap || /원인은/.test(smallcap.text) || !/그럴듯한 설명/.test(smallcap.reading || '')) fail('P1399 an interpretation must be worded as a hypothesis apart from the observation');
  const { isSessionComplete } = await import('./fetch-data.mjs');
  {
    // v57.55 review: headlines are translated once in Actions — last run's translation reused, only new English titles
    // asked, a reply that is not a matching Korean list leaves titleKo unset.
    const { translateHeadlines } = await import('./fetch-data.mjs');
    const items = [{ title: 'Fed holds rates' }, { title: 'Oil jumps 5%' }, { title: '코스피 급반등' }];
    let asked = null;
    const done = await translateHeadlines(items, { previous: [{ title: 'Fed holds rates', titleKo: '연준 금리 동결' }], request: async (prompt) => { asked = prompt; return { text: '["유가 5% 급등"]' }; } });
    const bad = [{ title: 'Gold rises' }];
    await translateHeadlines(bad, { request: async () => ({ text: '["Gold rises"]' }) });
    if (items[0].titleKo !== '연준 금리 동결' || items[1].titleKo !== '유가 5% 급등' || items[2].titleKo || done.reused !== 1 || done.translated !== 1 || /Fed holds/.test(asked) || bad[0].titleKo) fail(`v57.55 review: headline translation reuse/new/guard wrong ${JSON.stringify({ items, done, bad })}`);
  }
  if (isSessionComplete('2026-10-01', 'us', Date.parse('2026-10-01T13:52:00Z')) || !isSessionComplete('2026-10-01', 'us', Date.parse('2026-10-01T20:30:00Z')) || !isSessionComplete('2026-09-30', 'us', Date.parse('2026-10-01T13:52:00Z'))) fail('P1399 an in-session bar must not count as a completed close');
  const nowMs = Date.parse('2026-10-02T01:00:00Z');
  const schedule = buildBriefingSchedule({ releases: { 'us-nfp': { nextRelease: '2026-10-02' }, 'us-cpi': { nextRelease: '2026-10-14' } }, snapshot: { nfp: 162, unemployment: 4.1 }, nowMs,
    earnings: [{ symbol: 'NKE', date: '2026-10-05', hour: 'amc', epsEstimate: 0.44 }, { symbol: 'TINY', date: '2026-10-05', hour: 'amc' }], names: { NKE: 'Nike' } });
  if (schedule.length !== 2 || schedule[0].when !== '10/2(금) 21:30 KST' || !/직전 \+16\.2만 명/.test(schedule[0].last) || schedule[1].label !== 'Nike (NKE) 실적') fail(`P1389 briefing schedule wrong: ${JSON.stringify(schedule)}`);
  // P1501: rule-derived market-structure dates (FOMC minutes, KRX expiry, exchange holidays).
  const week = buildBriefingSchedule({ fomcDecisions: ['2026-09-16', '2026-10-28'], nowMs: Date.parse('2026-10-06T12:00:00+09:00'), days: 7 });
  const labels = week.map((row) => `${row.when} ${row.label}`);
  if (labels.join('|') !== '10/8(목) 03:00 KST FOMC 의사록 (9/16 회의)|10/8(목) 15:20 KST 한국 옵션 만기|10/9(금) 09:00 KST 한국 증시 휴장 (한글날)') fail(`P1501 structure events wrong: ${JSON.stringify(labels)}`);
  const december = buildBriefingSchedule({ fomcDecisions: [], nowMs: Date.parse('2026-12-07T00:00:00Z'), days: 14 }).map((row) => row.label);
  if (!december.includes('한국 선물·옵션 동시 만기') || !december.includes('미국 지수 선물·옵션 분기 만기')) fail(`P1501 quarterly expiry missing: ${JSON.stringify(december)}`);
}

// ── P1416: breadth signals — 4% movers, 52-week highs/lows, 40-day ratio, distribution days ────
{
  const { evaluateSymbolSignals, distributionDaySeries } = await load('src/domain/market/breadth-signals.js');
  const n = 260;
  const closes = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 9) * 5);
  closes[n - 1] = closes[n - 2] * 1.05; // +5% last session
  const volumes = closes.map((_, i) => (i === n - 1 ? 900000 : 500000));
  const highs = closes.map((c, i) => (i === n - 1 ? 130 : c * 1.01));
  const lows = closes.map((c) => c * 0.99);
  const signals = evaluateSymbolSignals({ closes, adjCloses: closes, highs, lows, volumes });
  const last = signals[n - 1];
  if (last.mover !== 'up' || !last.highLowEligible || !last.newHigh || last.newLow || !last.above40Eligible) fail(`P1416 last-session signals wrong: ${JSON.stringify(last)}`);
  if (signals[100].highLowEligible) fail('P1416 a session without ~1 year of prior bars must not count as a 52-week high/low');
  const quiet = evaluateSymbolSignals({ closes, adjCloses: closes, highs, lows, volumes: volumes.map(() => 500000) });
  if (quiet[n - 1].mover !== null) fail('P1416 a 4% move without rising volume is not a StockBee mover');
  const noVolume = evaluateSymbolSignals({ closes, adjCloses: closes, highs, lows, volumes: [] });
  if (noVolume[n - 1].moverEligible) fail('P1416 missing volume must be unknown, not a zero count');
  // A 2:1 split (raw halves, adjusted continuous) is not a 52-week low.
  const raw = closes.map((c, i) => (i >= n - 5 ? c / 2 : c));
  const split = evaluateSymbolSignals({ closes: raw, adjCloses: closes, highs: highs.map((h, i) => (i >= n - 5 ? h / 2 : h)), lows: lows.map((l, i) => (i >= n - 5 ? l / 2 : l)), volumes });
  if (split[n - 2].newLow) fail('P1416 a split must not register as a 52-week low');
  const bars = Array.from({ length: 40 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, close: 100 - (i % 3 === 0 ? i * 0.5 : 0), volume: 1000 + i * 10 }));
  const dist = distributionDaySeries(bars);
  if (dist[10].count !== null || !Number.isInteger(dist[39].count) || dist[39].count < 1) fail(`P1416 distribution count wrong: ${JSON.stringify(dist.slice(-2))}`);
  const { computeScreenerBreadthHistory } = await import('./fetch-data.mjs');
  const dates = Array.from({ length: n }, (_, i) => new Date(Date.UTC(2025, 8, 1) + i * 86400000).toISOString().slice(0, 10));
  const rows = computeScreenerBreadthHistory(['AAA'], [{ sym: 'AAA', dates, closes, adjCloses: closes, highs, lows, volumes }], 252, Date.parse('2027-01-01T00:00:00Z'));
  const point = rows[rows.length - 1].us;
  if (point.breadthUp4 !== 1 || point.breadthNewHighs !== 1 || point.contributors.up4[0][0] !== 'AAA' || point.breadth40 == null) fail(`P1416 producer aggregation wrong: ${JSON.stringify({ up4: point.breadthUp4, nh: point.breadthNewHighs, b40: point.breadth40 })}`);
}

// ── P1417: sub-theme relative strength — medians, exclusion, direction (no composite rating) ──
{
  const { buildGroupStrength, median } = await load('src/domain/themes/group-strength.js');
  if (median([3, 1, 2]) !== 2 || median([1, 2, 3, 4]) !== 2.5 || median([null]) !== null) fail('P1417 median wrong');
  const themes = [{ id: 't1', nameKr: '테마1', subThemes: [{ name: 'A', tickers: ['A1', 'A2', 'A3'] }, { name: 'B', tickers: ['B1', 'B2', 'B3'] }, { name: 'C', tickers: ['C1', 'C2'] }] }];
  const row = (sym, ret1m, ret3m) => ({ sym, ret1m, ret3m, ret6m: ret3m, pctSma50: ret1m, factorSessionDate: '2026-10-09' });
  const rows = [row('A1', 10, 5), row('A2', 12, 6), row('A3', 8, 4), row('B1', -5, 30), row('B2', -4, 28), row('B3', -6, 25), row('C1', 1, 1), row('C2', 1, 1)];
  const model = buildGroupStrength({ themes, rows, sortKey: 'ret3m', benchmark: { ret3m: 2, asOf: '2026-10-09' } });
  const [first, second] = model.groups;
  if (model.groups.length !== 2 || model.excluded[0]?.name !== 'C') fail('P1417 a sub-theme with fewer than 3 priced members must be excluded');
  if (first.name !== 'B' || first.ret3m !== 28 || first.vsBenchmark !== 26 || second.name !== 'A') fail(`P1417 ranking by median wrong: ${JSON.stringify(model.groups.map((g) => [g.name, g.ret3m]))}`);
  if (/score|rating|grade/i.test(Object.keys(first).join(','))) fail('P1417 group strength must not publish a composite rating');
  if (model.themes.t1.members !== 8) fail('P1417 theme-level summary must count each member once');
  // P1620: all listed constituents remain visible even when a return is missing.
  const listed = buildGroupStrength({ themes: [{ ...themes[0], subThemes: [{ name: 'A', tickers: ['A1', 'A2', 'A3', 'A4', 'A1'] }] }], rows });
  if (listed.groups[0].constituents.length !== 4 || listed.groups[0].constituents[3].included || listed.groups[0].members !== 3) fail('P1620 missing returns must not hide listed members or enter the ranking denominator');
  // P1622: intra-theme ranks depend on the selected window, preserve ties and missingness.
  const comparison = buildGroupStrength({ themes: [{ ...themes[0], subThemes: [{ name: 'A', tickers: ['A1', 'A2', 'A3', 'A4'] }] }], rows: [row('A1', 10, 5), row('A2', 12, 5), row('A3', 8, 4)], benchmark: { ret3m: 2, asOf: '2026-10-09' } }).groups[0];
  if (comparison.rankedMembers.map((member) => member.rank).join(',') !== '1,1,3,' || comparison.rankedMembers[0].vsBenchmark !== 3) fail('P1622 tied leaders and a missing return must not receive arbitrary ranks');
  const shortWindow = buildGroupStrength({ themes: [{ ...themes[0], subThemes: [{ name: 'A', tickers: ['A1', 'A2', 'A3', 'A4'] }] }], rows, sortKey: 'ret1m' }).groups[0];
  if (shortWindow.rankedMembers[0].sym !== 'A2') fail('P1622 intra-theme leader must change with the selected return window');
  const mismatched = buildGroupStrength({ themes, rows, benchmark: { ret3m: 2, asOf: '2026-10-02' } }).groups[0];
  if (mismatched.vsBenchmark != null || mismatched.rankedMembers.some(member => member.vsBenchmark != null)) fail('P1623 different close dates must hold S&P comparisons');
  const mixed = buildGroupStrength({ themes, rows: rows.map(item => item.sym === 'A1' ? { ...item, factorSessionDate: '2026-10-02' } : item) }).groups.find(group => group.name === 'A');
  if (mixed.ret3m != null || mixed.rank != null || mixed.rankedMembers.some(member => member.rank != null)) fail('P1623 mixed close dates must hold group medians and intra-theme ranks');
  const unknown = buildGroupStrength({ themes, rows: rows.map(item => ({ ...item, factorSessionDate: null })) }).groups[0];
  if (unknown.ret3m != null || unknown.rankedMembers.some(member => member.rank != null)) fail('P1623 missing close dates cannot certify relative strength');
  // Expert review M15: one member on an older close is held out of the theme-level value (and counted), not the whole theme.
  const lagged = buildGroupStrength({ themes, rows: rows.map(item => item.sym === 'A1' ? { ...item, factorSessionDate: '2026-10-08' } : item) }).themes.t1;
  if (lagged.value == null || lagged.members !== 7 || lagged.excluded !== 1 || lagged.basis !== '2026-10-09') fail(`M15 a theme summary must drop the older-close member and keep its median: ${JSON.stringify(lagged)}`);
  // M10/M20: the AI capex power layer never links the oil-and-gas energy theme; provider names stay off the body text.
  const { AI_CAPEX_FLOW, AI_BOTTLENECK_LEAD_TIMES } = await load('src/domain/themes/ai-capex-flow.js');
  const power = AI_CAPEX_FLOW.layers.find((layer) => layer.id === 'power');
  if (power.themes.includes('energy') || !power.groups?.includes('industrials:전력장비/그리드')) fail('M10 the power layer must link utilities and the power-equipment sub-theme, not the energy theme');
  const capexSource = readFileSync(path.join(root, 'src/ui/components/theme-strength.js'), 'utf8');
  if (!AI_CAPEX_FLOW.asOf || !AI_BOTTLENECK_LEAD_TIMES.asOf || /el\(doc, 'p', `[^`]*\$\{AI_(CAPEX_FLOW|BOTTLENECK_LEAD_TIMES)\.source\}/.test(capexSource)) fail('M20 the capex body must show the date and keep the provider in the hover title');
  // v57.79: the split is a dated, published reference (source kept in AI_CAPEX_FLOW.source), never labelled as an AIO estimate.
  if (!/\d{4}/.test(AI_CAPEX_FLOW.source) || /추정 배분/.test(capexSource)) fail('v57.79 the AI capex split must be a cited, dated reference'); // text-pin-ok: retirement absence
  // v57.79: lineage metadata stays in data-aio-lineage; value-basis.js turns any `title` into a visible reader card.
  if (/el\.title\s*=\s*sym\s*\+/.test(readFileSync(path.join(root, 'js/aio-core.js'), 'utf8'))) fail('v57.79 annotateLiveDataSinks must not write lineage into title'); // text-pin-ok: retirement absence
}

// P1620/P1621: same-session breadth facts, zero events and question-selected prompt parity.
{
  const { buildBreadthSnapshot } = await load('src/domain/market/breadth-snapshot.js');
  const { buildMarketContentContext } = await load('src/ai/context/market-content.js');
  const history = [{ date: '2026-10-09', spx: 7800, advanceRatio: .639, breadthNewHighs: 24, breadthNewLows: 13, breadth50: 34.7, breadth200: 49.9 }, { date: '2026-10-10', spx: null, breadth50: 99 }];
  const snap = buildBreadthSnapshot(history);
  if (snap.asOf !== '2026-10-09' || snap.cards.length !== 4 || snap.cards[0].second !== '하락 36.1%' || snap.cards[2].share !== 34.7) fail('P1620 weekend/future observations must not enter a common close snapshot');
  if (buildBreadthSnapshot([{ date: '2026-10-09', spx: 7800, breadthNewHighs: 0, breadthNewLows: 0 }]).cards[0]?.share !== null) fail('P1620 zero high/low events must not invent a percentage');
  if (buildBreadthSnapshot([]).cards.length) fail('P1620 missing breadth must remain absent');
  {
    // v57.54: the screener lane lags the S&P 500 close by hours; the previous session shows, labelled, never mixed.
    const lag = buildBreadthSnapshot([{ date: '2026-10-12', spx: 7807, breadth50: 35.7 }, { date: '2026-10-13', spx: 7805 }]);
    if (lag.asOf !== '2026-10-12' || lag.laggingFrom !== '2026-10-13' || !lag.cards.some((card) => card.id === 'breadth50')) fail('v57.54 lagging breadth must show the previous session with laggingFrom, got ' + JSON.stringify(lag));
    const stale = buildBreadthSnapshot([{ date: '2026-10-01', spx: 7700, breadth50: 40 }, { date: '2026-10-13', spx: 7805 }]);
    if (stale.cards.length) fail('v57.54 breadth older than the previous session must stay absent');
  }
  const prompt = buildMarketContentContext({ query: '신고가와 시장 폭', history });
  if (!prompt.includes('신고가 24개') || !prompt.includes('34.7%') || prompt.includes('99.0%')) fail('P1621 chat breadth facts must match the same completed-session UI model');
  if (buildMarketContentContext({ query: '안녕', history })) fail('P1621 unrelated questions must not inject extra market facts');
  const { homeParticipationSeries } = await load('src/ui/components/home-kpi-trend.js');
  const low = [{ date: '2026-10-09', spx: 7800, breadth50: .5 }];
  if (homeParticipationSeries(low).b50[0]?.value !== .5 || buildBreadthSnapshot(low).cards[0]?.share !== .5) fail('P1623 sub-one percent breadth must retain the same percent unit in chart and snapshot');
  // P1729: the AI scenario context reads the screen's inputs (credit, rates, macro history), not history alone.
  const { buildQuestionDomainContext } = await load('src/ai/context/market-content.js');
  const marketSource = readFileSync(path.join(root, 'src/ai/context/market-content.js'), 'utf8');
  if (!/renderMarketScenarioContext\(collectMarketInputs\(root\)\)/.test(marketSource) || /renderMarketScenarioContext\(\{\s*history\s*:/.test(marketSource)) fail('P1729 the AI scenario context must be built from collectMarketInputs(root)');
  if (typeof buildQuestionDomainContext !== 'function') fail('P1729 buildQuestionDomainContext export missing');
}

// P1728: a Korean quote's change comes from the verified previous KRX close (2026-10-13: the provider's previous close
// was one session behind after the 10/9 holiday — ^KQ11 -6.19% against -1.43%, 005930 -6.59% against -5.58%).
{
  const vm = await import('node:vm');
  const dataSource = readFileSync(path.join(root, 'js/aio-data.js'), 'utf8');
  const block = dataSource.slice(dataSource.indexOf('var _AIO_KR_INDEX_FIELD'), dataSource.indexOf('function applyLiveQuotes(quotes) {'));
  const history = [
    { date: '2026-10-08', kosdaq: 892.27, kospi: 6625.93, fieldMeta: { kosdaq: { observedAt: '2026-10-08T00:00:00.000Z' } } },
    { date: '2026-10-09', kosdaq: 892.27, kospi: 6625.93, fieldMeta: { kosdaq: { observedAt: '2026-10-08T11:05:40.000Z' } } },
    { date: '2026-10-11', kosdaq: 892.27, kospi: 6625.93, fieldMeta: { kosdaq: { observedAt: '2026-10-08T11:05:40.000Z' } } },
    { date: '2026-10-12', kosdaq: 849.19, kospi: 6384.24, fieldMeta: { kosdaq: { observedAt: '2026-10-12T00:00:00.000Z' } } },
    { date: '2026-10-13', kosdaq: 837.03, kospi: 6035.35, fieldMeta: { kosdaq: { observedAt: '2026-10-13T06:32:50.000Z', valueBasis: 'latest-completed-close' } } }];
  const rows = [{ sym: '005930.KS', ret1d: -5.58, factorSessionDate: '2026-10-13' }];
  const win = { _aioHistory: history, addEventListener() {} };
  const ctx = { window: win, document: { addEventListener() {} }, _aioGetCanonicalScreenerRows: () => rows, applyLiveQuotes() {} };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  const verify = win._aioVerifyKrQuoteChange;
  const kq = verify({ symbol: '^KQ11', _source: 'live:yahoo-proxy', _atomicObservedAt: '2026-10-13T06:32:50.000Z', regularMarketPreviousClose: 892.27 }, 837.03, -6.19);
  if (!kq || kq.status !== 'corrected' || Math.abs(kq.pct + 1.432) > 0.01 || kq.prevClose !== 849.19 || kq.basisDate !== '2026-10-12') fail(`P1728 ^KQ11 must be recomputed from the verified 10/12 close: ${JSON.stringify(kq)}`);
  const samsung = verify({ symbol: '005930.KS', _source: 'live:yahoo-proxy', _atomicObservedAt: '2026-10-13T06:30:12.000Z', regularMarketPreviousClose: 250500 }, 234000, -6.59);
  if (!samsung || samsung.pct !== -5.58 || samsung.basis !== 'screener-reconciled-session-change') fail(`P1728 005930 must use the reconciled same-session change: ${JSON.stringify(samsung)}`);
  const nextDay = verify({ symbol: '005930.KS', _source: 'live:yahoo-proxy', _atomicObservedAt: '2026-10-14T02:00:00.000Z', regularMarketPreviousClose: 250500 }, 236000, -5.8);
  if (!nextDay || nextDay.pct !== null || nextDay.basis !== 'kr-previous-close-unverified') fail(`P1728 a KR change with no verified basis must be withheld: ${JSON.stringify(nextDay)}`);
  win._aioHistory = history.slice(0, 3);
  const stale = verify({ symbol: '^KQ11', _source: 'live:yahoo-proxy', _atomicObservedAt: '2026-10-13T06:32:50.000Z', regularMarketPreviousClose: 892.27 }, 837.03, -6.19);
  if (!stale || stale.status !== 'unverified') fail('P1728 a history that stops before the previous day must not verify the change');
  if (verify({ symbol: '^KQ11', _source: 'live:naver' }, 837, -1.4) !== null || verify({ symbol: 'NVDA' }, 100, 1) !== null) fail('P1728 KRX-origin and non-KR quotes pass through unchanged');
  win._aioHistory = history;
  const read = win._aioKrIndexCloseRead('kosdaq', history);
  if (!read || read.date !== '2026-10-13' || read.prevDate !== '2026-10-12' || Math.abs(read.pct + 1.432) > 0.01) fail(`P1729 the AI header KR close read must name both sessions: ${JSON.stringify(read)}`);
  const chatSource = readFileSync(path.join(root, 'js/aio-chat.js'), 'utf8');
  if (!/_aioKrIndexCloseRead\('kospi'/.test(chatSource) || !/고른 상승·소수 종목 주도·동반 약세/.test(chatSource) || !/_aioKrVerifiedDayChange\(t, _lastBarDate/.test(chatSource)) fail('P1728/P1729 the chat header and technical block must use the verified KR change and the three flows');
}

// P1730: the provisional post-08:00 news slot — after the bundle end, not already in the bundle, newest first, at most six.
{
  const { selectIntradayNews } = await load('src/domain/news/stories.js');
  const end = Date.parse('2026-10-12T23:00:00Z');
  const row = (minutes, title, link) => ({ title, link, source: 'Wire', publishedAt: new Date(end + minutes * 60000).toISOString() });
  const rows = [row(-5, 'before cut', 'https://a/1'), row(30, 'kept one', 'https://a/2'), row(60, 'in bundle', 'https://a/3?utm=x'),
    row(90, 'dup title', 'https://a/4'), ...Array.from({ length: 8 }, (_, i) => row(100 + i, `extra ${i}`, `https://b/${i}`))];
  const canonical = [{ title: 'other', link: 'https://a/3' }, { title: 'Dup  Title', link: 'https://c/9' }];
  const picked = selectIntradayNews(rows, { cycleEndMs: end, canonical, nowMs: end + 6 * 3600000 });
  if (picked.length !== 6 || picked.some((item) => ['before cut', 'in bundle', 'dup title'].includes(item.title)) || picked[0].title !== 'extra 7') fail(`P1730 intraday slot selection wrong: ${picked.map((item) => item.title).join(',')}`);
  if (selectIntradayNews(rows, { cycleEndMs: NaN }).length || selectIntradayNews(null, { cycleEndMs: end }).length) fail('P1730 no bundle end or no rows must hide the slot');
  const newsPage = readFileSync(path.join(root, 'src/ui/pages/news.js'), 'utf8');
  if (!/08:00 이후 속보 · 잠정/.test(newsPage) || !/한국장 시간대 기사는 속보 칸에, 정식 묶음은 다음 08:00 수집본/.test(newsPage)) fail('P1730 the news screen must label the slot and the post-close header');
}

// ── P1418: portfolio 점검 — published-default verdicts only, hidden currency mix detected ─────
{
  const { derivePortfolioChecks } = await load('src/domain/portfolio/checks.js');
  const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
  const surface = { currencyState: 'declared-single', baseCurrency: 'USD', totalAssets: 1100, positionValue: 1000, rows: [
    { symbol: 'AAA', value: 600, currency: 'USD', sector: 'Technology' }, { symbol: 'BBB', value: 300, currency: 'USD', sector: 'Technology' }, { symbol: 'CCC', value: 100, currency: 'USD', sector: 'Energy' }, { symbol: 'DDD', value: null, currency: 'USD' }] };
  const result = derivePortfolioChecks({ surface, assetTypeOf: () => '개별 주식' });
  const byId = Object.fromEntries(result.checks.map((check) => [check.id, check]));
  if (result.excluded !== 1 || byId['single-holding'].status !== 'attention' || !/AAA 60\.0%/.test(byId['single-holding'].value)) fail(`P1418 single-holding check wrong: ${JSON.stringify(byId['single-holding'])}`);
  if (byId['single-currency'].status !== 'info' || byId.region.status !== 'info' || byId.fees.status !== 'unknown') fail('P1418 only rules with a published default may carry a verdict');
  if (derivePortfolioChecks({ surface: { ...surface, currencyState: 'mixed-without-conversion' } }).status !== 'unavailable') fail('P1418 an unconverted currency mix must hold the checks');
  // v57.55 review (B4-F4/F5): entered cash is read from surface.cash, and a mostly-unpriced book holds the concentration verdict.
  const sparse = derivePortfolioChecks({ surface: { currencyState: 'declared-single', baseCurrency: 'USD', totalAssets: null, positionValue: null, cash: 5000, rows: [{ symbol: 'QQQ', value: 900, currency: 'USD' }, { symbol: 'TSLA', value: null }, { symbol: '105560', value: null }] } });
  const sparseById = Object.fromEntries(sparse.checks.map((check) => [check.id, check]));
  if (sparseById['single-holding'].value !== '판정 보류' || sparseById['single-holding'].status !== 'unknown' || sparseById.cash.value !== '비중 보류') fail(`v57.55 review: unpriced holdings must hold the concentration verdict and entered cash must not read '미입력', got ${JSON.stringify([sparseById['single-holding'], sparseById.cash])}`);
  // Undeclared US + Korean holdings are a hidden mix: held, not summed as one unit.
  const hidden = derivePortfolioSurface({ state: { readState: 'ready', holdingsKnown: true, status: 'current', cash: 0, cashKnown: true, holdings: [{ symbol: 'AAPL', shares: 1, price: 100 }, { symbol: '005930.KS', shares: 1, price: 100000 }] }, liveData: {}, vix: null });
  if (hidden.totalAssets === 100100 || hidden.currencyState !== 'mixed-without-conversion') fail(`P1418 undeclared USD + KRW holdings were summed: ${hidden.totalAssets} ${hidden.currencyState}`);
}

// ── P1419: screener position instead of a letter grade; post-hoc validation summary ─────────
{
  const { rankGrade } = await load('src/ui/pages/screener.js');
  if (rankGrade(85) !== '상위 15%' || rankGrade(100) !== '상위 1%' || rankGrade(null) !== null || /^[A-F]$/.test(String(rankGrade(90)))) fail('P1419 the rank cell must show the percentile position, not a letter grade');
  const { summarizeValidation } = await load('src/ui/components/screener-validation.js');
  const sample = summarizeValidation([{ date: '2026-09-30', n: 800, dates: 6, quantileSpreadNet: 1.2, netHitRate: 66.7, transactionCostPct: 0.2, ic: { composite: 0.05 } }, { date: '2026-10-01', n: 845, dates: 6, quantileSpreadNet: -3.27, netHitRate: 33.3, transactionCostPct: 0.23, ic: { composite: -0.039 } }], { status: 'BLOCKED', predictiveValidation: 'not-established' });
  if (sample.wins !== 2 || sample.tone !== 'neutral' || sample.distinguishable !== false || !/아직 우연과 구별 안 됨\(표본 6회\)/.test(sample.undecided) || sample.series.length !== 2 || !/생존 편향/.test(sample.validation)) fail(`P1419/D11 a 6-rebalance record without |t|>=2 must read as undecided, not 뒤처짐: ${JSON.stringify(sample)}`);
  const decided = summarizeValidation([{ date: '2026-10-01', n: 845, dates: 12, quantileSpreadNet: -3.27, netHitRate: 25, transactionCostPct: 0.23, ic: { composite: -0.039, compositeT: -2.4 } }], null);
  if (decided.tone !== 'burden' || decided.distinguishable !== true) fail(`D11 12 rebalances with |t|>=2 keep the sign verdict: ${JSON.stringify(decided)}`);
  if (summarizeValidation([], null).available) fail('P1419 no history must not read as a result');
}

// ── P1449: stored validation rows must prove they were produced by the live model ───────────
{
  const { summarizeValidation } = await load('src/ui/components/screener-validation.js');
  const { buildScreenerModelFingerprint, renormalizedWeightsOver } = await load('src/domain/screener/model-fingerprint.js');
  const { MODEL_DEFAULT_WEIGHTS } = await load('src/domain/screener/factor-weights.js');
  // The canonical renormalization over the backtest's computable factors is pinned so a second
  // weights vector cannot drift in silently (the 37.0/27.4/21.9/13.7 vs 39.0/28.0/22.0/11.0 split).
  const renormed = renormalizedWeightsOver(MODEL_DEFAULT_WEIGHTS);
  if (JSON.stringify(renormed) !== JSON.stringify({ momentum: 0.3699, trend: 0.274, lowvol: 0.2192, kalman: 0.137 })) {
    fail(`P1449 the model-default renormalization shifted: ${JSON.stringify(renormed)}`);
  }
  const live = buildScreenerModelFingerprint();
  const matchRow = { date: '2026-10-01', n: 845, dates: 6, quantileSpreadNet: 1.2, netHitRate: 66.7, transactionCostPct: 0.2, ic: { composite: 0.05 }, modelFingerprint: live };
  if (summarizeValidation([matchRow], { status: 'BLOCKED' }).modelMatch !== true) fail('P1449 a same-fingerprint record must read as the live ranking validation');
  const stale = summarizeValidation([matchRow], { status: 'BLOCKED' });
  if (!/같은 순위를|앞섰습니다|아직 구별 불가|우연과 구별 안 됨/.test(stale.verdict)) fail('P1449 a matched record keeps the performance claim');
  const mismatchRow = { ...matchRow, modelFingerprint: buildScreenerModelFingerprint({ weights: { momentum: 0.39, trend: 0.28, lowvol: 0.22, kalman: 0.11 } }) };
  const mismatch = summarizeValidation([mismatchRow], { status: 'BLOCKED' });
  if (mismatch.modelMatch !== false || !/다른 이전 모델|모델 지문/.test(mismatch.verdict)) fail(`P1449 a mismatching fingerprint must read as a different-model disclosure: ${JSON.stringify(mismatch)}`);
  const legacyRow = { date: '2026-10-01', n: 845, dates: 6, quantileSpreadNet: 1.2, netHitRate: 66.7, transactionCostPct: 0.2, ic: { composite: 0.05 } };
  const legacy = summarizeValidation([legacyRow], { status: 'BLOCKED' });
  if (legacy.modelMatch !== false || !/다른 이전 모델|모델 지문/.test(legacy.verdict)) fail('P1449 a pre-fingerprint record must read as a different-model disclosure');
}

// ── v57.77: one validation view — #screener-validation adds the history curve and decision rule to the 과거 검증 tab,
// never a second verdict/summary fold ──────────────────────────────────────────────────────
{
  const { renderScreenerValidation, summarizeValidation } = await load('src/ui/components/screener-validation.js');
  const node = (tag) => ({ tag, children: [], className: '', textContent: '', dataset: {}, append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = [...kids]; } });
  const host = node('section');
  const doc = { getElementById: (id) => id === 'screener-validation' ? host : null, createElement: node };
  const history = [{ date: '2026-10-01', n: 845, dates: 6, quantileSpreadNet: -1.8, netHitRate: 33.3, transactionCostPct: 0.4, ic: { composite: -0.005 } }];
  renderScreenerValidation({ documentRef: doc, root: { _aioScreenerBacktestHistory: history, _aioModelValidationStatus: { status: 'BLOCKED' } } });
  const tags = host.children.map((child) => child.tag);
  const text = host.children.map((child) => child.textContent).join(' ');
  const verdict = summarizeValidation(history, { status: 'BLOCKED' }).verdict;
  if (tags.includes('details') || tags.includes('summary') || text.includes(verdict) || !/판정은 기록이 12회 이상/.test(text) || host.dataset.aioScreenerValidationRenderer !== 'native') {
    fail(`v57.77 the validation block must add only the curve and decision rule, not repeat the 과거 검증 verdict: ${JSON.stringify({ tags, text })}`);
  }
}

// ── P1397: chart analysis — VCP run, pivot, state (no grade) ─────────────────────────────────
{
  const { analyzeChart, detectContractions } = await load('src/domain/technical/chart-analysis.js');
  // Uptrend, then a base whose pullbacks shrink 15% → 8% → 4% with the close just under the last high.
  const path = [];
  let p = 100;
  for (let i = 0; i < 220; i++) path.push(p *= 1.004);
  const legs = [[1.0, 0.85], [0.85, 0.96], [0.96, 0.883], [0.883, 0.955], [0.955, 0.917], [0.917, 0.95]];
  const top = p;
  for (const [a, b] of legs) for (let k = 1; k <= 8; k++) path.push(top * (a + (b - a) * k / 8));
  const bars = path.map((close, i) => ({ time: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10), open: close * 0.999, high: close * 1.004, low: close * 0.996, close, volume: 1e6 }));
  const vcp = detectContractions(bars);
  if (!vcp.valid || vcp.contractions.length < 3 || !(vcp.contractions[0].depth > vcp.contractions[vcp.contractions.length - 1].depth)) fail(`P1397 VCP run not detected: ${JSON.stringify(vcp.contractions.map((row) => row.depth.toFixed(1)))}`);
  const result = analyzeChart(bars);
  if (!result.available || !['setup', 'none', 'extended', 'breakout', 'failed', 'downtrend'].includes(result.state) || /등급|grade/i.test(JSON.stringify(result.evidence))) fail(`P1397 chart analysis contract: ${result.state}`);
  if (!result.evidence.some(([label]) => label === '미너비니 템플릿(변형: 6개월 S&P 초과)') || !result.evidence.some(([label]) => label === '마지막 수축 저점') || result.evidence.some(([label]) => /무효화/.test(label))) fail('P1397/S14 evidence rows missing or carry instruction wording');
  if (analyzeChart(bars.slice(0, 40)).available) fail('P1397 fewer than 60 bars must not be analysed');
  // v57.84 (owner decision): the screener producer finds the same contractions and the same pivot as the chart.
  const { _calcVCPServer } = await load('src/domain/screener/price-factors.js');
  const server = _calcVCPServer(bars.map((bar) => bar.close), bars.map((bar) => bar.high), bars.map((bar) => bar.low), bars.map((bar) => bar.volume));
  if (server.pivotLevel !== result.pivot || server.contractionCount !== result.vcp.contractions.length || server.isShrinking !== result.vcp.valid) fail(`v57.84 producer VCP must equal the chart detector: ${JSON.stringify({ server: [server.pivotLevel, server.contractionCount, server.isShrinking], chart: [result.pivot, result.vcp.contractions.length, result.vcp.valid] })}`);
  const flat = bars.slice(0, 220);
  const flatServer = _calcVCPServer(flat.map((bar) => bar.close), flat.map((bar) => bar.high), flat.map((bar) => bar.low), flat.map((bar) => bar.volume));
  if (flatServer.pivotLevel !== null || ['near_pivot', 'breakout', 'pivot_down'].includes(flatServer.vcpStage)) fail(`v57.84 no valid contraction run, no pivot state: ${JSON.stringify(flatServer)}`);
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
  const { selectSecFundamentalsAsOf, deriveSecReport, reconcileSecEquity } = await load('src/domain/fundamental/sec-report.js');
  const fact = (value, periodEnd) => ({value, periodEnd, filedAt:'2026-02-01'});
  const record = {pit:{observations:{revenue:[fact(100,'2025-12-31'),fact(50,'2023-12-31')],netIncome:[fact(10,'2024-12-31')],equity:[fact(40,'2024-12-31')]}}};
  const result = selectSecFundamentalsAsOf(record,'2026-03-01');
  if (result.revenue !== 100 || result.netIncome !== null || result.equity !== null || result.margin != null || result.revGrowth != null) fail('SEC mismatched years created ratios or annual growth');
  if (deriveSecReport({coverage:['netIncome'],netIncome:-10}).status === 'quarantined') fail('SEC loss quarantined');
  // P1402: Agilent FY2025 — the NCI-inclusive tag carried accumulated OCI (-$226M) beside $6,741M parent equity.
  const eqRow = (value, concept) => ({ field: 'equity', value, periodEnd: '2025-10-31', accession: 'acc-1', acceptedAt: '2025-12-19T23:00:46Z', concept });
  const agilent = { symbol: 'A', observedAt: '2025-10-31', accession: 'acc-1', revenue: 6948e6, netIncome: 1303e6, equity: -226e6, coverage: ['revenue', 'netIncome', 'equity'],
    pit: { observations: { revenue: [{ value: 6948e6, periodStart: '2024-11-01', periodEnd: '2025-10-31', acceptedAt: '2025-12-19T23:00:46Z' }], equity: [eqRow(-226e6, 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'), eqRow(6741e6, 'StockholdersEquity')] } } };
  const agReport = deriveSecReport(agilent);
  const agEquity = agReport.metrics.find((row) => row.key === 'equity')?.value;
  // P1591/S07: the card no longer repeats an end-of-year ROE; the reconciled record still carries it.
  if (agEquity !== 6741e6 || reconcileSecEquity(agilent).roe !== 19.3 || agReport.metrics.some((row) => row.key === 'roe')) fail(`P1402 parent equity must replace a conflicting NCI-inclusive tag: ${agEquity}`);
  if (selectSecFundamentalsAsOf(agilent, '2026-01-01').equity !== 6741e6) fail('P1402 point-in-time equity must prefer the parent concept');
  // P1449: the shipped projection strips PIT observations, so the reconcile must have run on
  // the builder side; reconcile must be idempotent and must survive an observations-less shape.
  const shippedShape = { ...agilent, equity: 6741e6, equityConcept: 'StockholdersEquity', pit: { status: 'present', observationCount: 2, acceptedTimeCount: 2 } };
  const shippedReport = deriveSecReport(shippedShape);
  if (shippedReport.metrics.find((row) => row.key === 'equity')?.value !== 6741e6) fail('P1449 a reconciled record stripped of PIT observations must keep the parent equity');
  if (JSON.stringify(reconcileSecEquity(shippedShape)) !== JSON.stringify(shippedShape)) fail('P1449 reconcile must be a no-op on an already-reconciled records-shape');
  if (reconcileSecEquity(agilent) === agilent) fail('P1449 reconcile must repair the pre-fix shipped record');
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
// ── P1316/R661 — 전체 개인 데이터 백업: 모든 섹션이 한 묶음으로 왕복하고 구형 배열도 받는다 ─────────
// 포지션만 내보내던 export는 원장·FX·현금·가정·일지·관심목록을 기기 변경·주소 이전 때 조용히 잃었다.
{
  const { BACKUP_FORMAT, BACKUP_VERSION, buildPortfolioBackup, parsePortfolioBackup, describeBackupCounts } = await load('src/data/portfolio-backup.js');
  const { normalizeLedger } = await load('src/data/portfolio-ledger.js');
  const { normalizeFxLegs } = await load('src/domain/portfolio/fx.js');
  const { normalizeCurrencyCode, normalizeAnnualRate, normalizeExposurePath, normalizeRebalancePolicy } = await load('src/data/portfolio-assumptions.js');
  const deps = {
    normalizeLedger, normalizeFxLegs,
    assumptionKinds: { baseCurrency: 'currency', cashCurrency: 'currency', cashReturn: 'rate', riskFreeRate: 'rate', exposurePath: 'path', rebalancePolicy: 'policy' },
    assumptionNormalizers: { currency: normalizeCurrencyCode, rate: normalizeAnnualRate, path: normalizeExposurePath, policy: normalizeRebalancePolicy }
  };
  const snapshot = {
    positions: [{ ticker: 'nvda', qty: '3', cost: '120.5', costCurrency: 'USD' }, { ticker: '005930.KS', qty: 10, cost: 70000, costCurrency: 'KRW' }],
    ledger: { currency: 'KRW', transactions: [{ date: '2026-09-01', kind: 'deposit', amount: 1000000 }], valuations: [{ date: '2026-09-27', amount: 1050000 }] },
    fxLegs: [{ from: 'USD', to: 'KRW', rate: 1390.5, observedAt: '2026-09-27T06:00:00Z' }],
    cash: '250000',
    assumptions: { baseCurrency: 'krw', cashReturn: '3.1', rebalancePolicy: 'monthly', riskFreeRate: 'bogus' },
    journal: [{ ts: 1790000000000, date: '2026-09-20T00:00:00Z', note: '추세 확인 후 분할 매수', tickers: ['NVDA'] }],
    watchlists: [{ id: 'wl_1', name: '반도체', tickers: ['nvda', '<script>'], createdAt: 1 }],
    activeWatchlistId: 'wl_1'
  };
  const bundle = buildPortfolioBackup(snapshot, { exportedAt: '2026-09-28T12:00:00Z', appVersion: 'v56.77', origin: 'https://example.test' });
  const round = parsePortfolioBackup(JSON.stringify(bundle), deps);
  const legacy = parsePortfolioBackup(JSON.stringify([{ ticker: 'aapl', qty: 1, cost: 150 }, { ticker: 'bad ticker!', qty: 1 }]), deps);
  const c = round.contents || {};
  const p1316Checks = [
    ['bundle declares format and version', bundle.format === BACKUP_FORMAT && bundle.version === BACKUP_VERSION && bundle.counts.total > 0],
    ['bundle round-trips as a bundle', round.ok === true && round.kind === 'bundle'],
    ['positions keep both markets and normalize ticker/number', c.positions?.length === 2 && c.positions[0].ticker === 'NVDA' && c.positions[0].qty === 3 && c.positions[1].ticker === '005930.KS'],
    ['ledger survives through its own normalizer', c.ledger && c.ledger.transactions.length === 1 && c.ledger.currency === 'KRW'],
    ['fx legs survive through their own normalizer', c.fxLegs?.length === 1 && c.fxLegs[0].rate === 1390.5],
    ['cash, journal and watchlists survive', c.cash === '250000' && c.journal?.length === 1 && c.watchlists?.length === 1 && c.activeWatchlistId === 'wl_1'],
    ['invalid watchlist ticker is dropped (P1350)', c.watchlists?.[0].tickers.length === 1 && c.watchlists[0].tickers[0].sym === 'NVDA'],
    ['valid assumptions restore; invalid ones are not resurrected', c.assumptions?.baseCurrency === 'KRW' && c.assumptions.cashReturn === '3.1' && c.assumptions.rebalancePolicy === 'monthly' && !('riskFreeRate' in c.assumptions)],
    ['legacy positions array still imports positions only', legacy.ok === true && legacy.kind === 'positions' && legacy.contents.positions.length === 1 && legacy.contents.positions[0].ticker === 'AAPL' && !('ledger' in legacy.contents)],
    ['unknown format, future version and empty inputs are refused', parsePortfolioBackup('{"format":"other"}', deps).ok === false
      && parsePortfolioBackup(JSON.stringify({ ...bundle, version: 2 }), deps).reason === 'unsupported-version'
      && parsePortfolioBackup('[]', deps).ok === false && parsePortfolioBackup('not json', deps).reason === 'invalid-json'
      && parsePortfolioBackup(JSON.stringify(buildPortfolioBackup({})), deps).reason === 'empty-bundle'],
    ['counts are described for the confirm dialog', /포지션 2/.test(describeBackupCounts(round.counts)) && /관심목록 1/.test(describeBackupCounts(round.counts))]
  ];
  const failedP1316 = p1316Checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedP1316.length) fail(`P1316 portfolio backup checks failed: ${failedP1316.join(' | ')}`);
  const p1316Workspace = readFileSync(path.join(root, 'js/aio-workspace.js'), 'utf8');
  const p1316Bootstrap = readFileSync(path.join(root, 'src/app/compatibility-globals.js'), 'utf8'); // v57.62
  if (!/window\._pfPortfolioBackup = \{/.test(p1316Bootstrap)
    || !/api\.build\(_pfBackupSnapshot\(\)/.test(p1316Workspace)
    || !/getPortfolioLedger\(\), fxLegs: getPortfolioFxLegs\(\)/.test(p1316Workspace)
    || !/PIN 잠금을 해제한 뒤 내보내세요/.test(p1316Workspace)
    || !/savePortfolioLedger\(c\.ledger\), savePortfolioFxLegs\(c\.fxLegs\)/.test(p1316Workspace)
    || !/영구 저장 실패 — 가져오기가 확정되지 않았습니다/.test(p1316Workspace)) {
    fail('P1316 the shell must export every personal section through the native bundle, refuse locked data and ack every restored section');
  }
}
// ── P1317~P1320 — 한국 종목 상세·참고 시총·셀별 stale 소음·툴팁 위치 (v56.78) ─────────────────────
{
  const { normalizeTickerInput, tickerDisplayName } = await load('src/domain/entity/ticker-symbol.js');
  const krStockDb = { '005930': { name: '삼성전자' }, '000660': { name: 'SK하이닉스' }, '247540': { name: '에코프로비엠' }, '005935': { name: '삼성전자우' } };
  const krToYahoo = (code) => code + (code === '247540' ? '.KQ' : '.KS');
  const n = (value) => normalizeTickerInput(value, { krStockDb, krToYahoo });
  const { referenceMarketCapFrom } = await load('src/data/providers/screener.js');
  const { capFilterValue, describeStaleDates } = await load('src/ui/pages/screener.js');
  const { placeTooltipBody } = await load('src/ui/components/term-tooltip.js');
  const nvdaRef = referenceMarketCapFrom({ pePrice: 225.07, valuationSharesOutstanding: 24.3e9, dollarVolume30d: 27.1e9, pePriceBasis: 'adjusted-close', valuationSharesObservedAt: '2026-02-20' }, 'USD');
  const pkgScaleError = referenceMarketCapFrom({ pePrice: 237.18, valuationSharesOutstanding: 89.2e9, dollarVolume30d: 1.3e8 }, 'USD');
  const placedLeft = placeTooltipBody({ left: 4, width: 15, top: 400, bottom: 415 }, { width: 260, height: 60 }, { width: 1024, height: 768 });
  const placedTop = placeTooltipBody({ left: 500, width: 15, top: 20, bottom: 35 }, { width: 260, height: 60 }, { width: 1024, height: 768 });
  const placedNarrow = placeTooltipBody({ left: 300, width: 15, top: 400, bottom: 415 }, { width: 260, height: 60 }, { width: 320, height: 640 });
  const p1317Checks = [
    ['P1317 a bare KRX code resolves to its exchange symbol', n('005930') === '005930.KS' && n('247540') === '247540.KQ'],
    ['P1317 an explicit suffix is kept as declared', n('005930.ks') === '005930.KS'],
    ['P1317 an exact Korean name resolves; spaces are ignored', n('삼성전자') === '005930.KS' && n('SK 하이닉스') === '000660.KS'],
    ['P1317 an ambiguous partial name is never guessed', n('삼성') === '삼성'.toUpperCase()],
    ['P1345 even a unique Korean company-name prefix is never guessed', n('에코프로') === '에코프로' && n('SK하이') === 'SK하이'.toUpperCase()],
    ['P1317 US tickers are unchanged', n(' nvda ') === 'NVDA' && n('BRK.B') === 'BRK.B'],
    ['v57.55 review (8p): a class share takes the listed dash spelling only when that form is listed', normalizeTickerInput('brk.b', { isListed: (sym) => sym === 'BRK-B' }) === 'BRK-B' && normalizeTickerInput('BRK/B', { isListed: (sym) => sym === 'BRK-B' }) === 'BRK-B' && normalizeTickerInput('ABC.D', { isListed: () => false }) === 'ABC.D'],
    ['P1317 display name comes from the KR registry only', tickerDisplayName('005930.KS', { krStockDb }) === '삼성전자' && tickerDisplayName('NVDA', { krStockDb }) === null],
    ['P1318 SEC shares x artifact close gives a USD reference cap', nvdaRef && nvdaRef.billions > 5000 && nvdaRef.allowedUse === 'reference-only'],
    ['P1318 implausible turnover (share-scale error) stays unknown', pkgScaleError === null],
    ['P1318 non-USD or missing inputs stay unknown', referenceMarketCapFrom({ pePrice: 1, valuationSharesOutstanding: 1e9, dollarVolume30d: 1e7 }, 'KRW') === null && referenceMarketCapFrom({}, 'USD') === null],
    ['P1318 the size bucket prefers the live cap, then the reference cap, never zero', capFilterValue({ mcap: 120 }) === 120 && capFilterValue({ mcap: null, referenceMarketCap: { billions: 45.5 } }) === 45.5 && capFilterValue({}) === null],
    ['P1319 stale dates are stated once per table', describeStaleDates(['2026-09-25', '2026-09-25']).includes('2026-09-25 기준') && describeStaleDates(['2026-09-24', '2026-09-25']).includes('2026-09-24 ~ 2026-09-25') && describeStaleDates([]) === ''],
    ['P1320 a tooltip near the left edge is kept inside the viewport', placedLeft.left >= 8 && placedLeft.left + placedLeft.width <= 1024 - 8],
    ['P1320 a tooltip without room above opens below its icon', placedTop.top >= 35],
    ['P1320 a tooltip is narrowed to fit a narrow window', placedNarrow.width <= 320 - 16 && placedNarrow.left >= 8]
  ];
  const failedP1317 = p1317Checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failedP1317.length) fail(`P1317~P1320 checks failed: ${failedP1317.join(' | ')}`);
  const p1317Core = readFileSync(path.join(root, 'js/aio-core.js'), 'utf8');
  const p1317Boot = readFileSync(path.join(root, 'src/app/bootstrap.js'), 'utf8');
  if (!/window\._aioNormalizeTickerInput\(tkr\)/.test(p1317Core) || !/window\._aioTickerDisplayName\(tkr\)/.test(p1317Core)
    || !/requestSelectedTickerQuote/.test(p1317Boot) || !/installTermTooltips\(documentRef/.test(p1317Boot)) {
    fail('P1317/P1320 showTicker must normalize through the native module, request a missing quote, and install term tooltips');
  }
}

// P1527: the home KPI trend and 시장 상태 draw the same "20거래일" series; both stop at the S&P 500's last completed close.
// Observed 2026-10-08: the home included a pre-market 10-year-yield row dated after the basis (+45bp, 09/09 to 10/08) while
// 시장 상태 read +47bp (09/08 to 10/07).
{
  const { trendPoints } = await load('src/ui/components/home-kpi-trend.js');
  const { buildCloseSeries, closeBasis } = await load('src/domain/briefing/market-read.js');
  const history = [];
  const cursor = new Date(Date.UTC(2026, 8, 8));
  while (history.length < 22) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const date = cursor.toISOString().slice(0, 10);
      const meta = { observedAt: `${date}T20:00:00Z` };
      history.push({ date, spx: 5000 + history.length, tnx: 4 + history.length * 0.01, fieldMeta: { spx: meta, tnx: meta } });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const basis = history[history.length - 1].date;
  history.push({ date: '2026-10-08', tnx: 5.5, fieldMeta: { tnx: { observedAt: '2026-10-08T13:16:05Z' } } });
  if (closeBasis(history) !== basis) fail('P1527 fixture: the close basis must be the last S&P 500 close');
  const home = trendPoints(history, 'tnx');
  const market = buildCloseSeries(history, 'tnx', { through: basis }).slice(-21);
  if (home.length !== 21 || JSON.stringify(home) !== JSON.stringify(market)) fail('P1527 the home trend must be the same 20-session series 시장 상태 uses');
  if (home.some((point) => point.date > basis)) fail('P1527 the home trend must not include a row dated after the common close basis');
  if (JSON.stringify(trendPoints(history, 'spx')) !== JSON.stringify(buildCloseSeries(history, 'spx', { through: basis }).slice(-21))) fail('P1527 the home S&P 500 trend must match the shared series');
}

// P1528 (audit H17): a real yield (TIPS) and a breakeven observed on different days must not be compared. The briefing holds
// them apart; the macro transmission chain used to draw "1주 +Nbp" and a "실질금리 우위" sentence from both regardless.
{
  const { buildMacroRead } = await load('src/domain/macro/macro-read.js');
  const base = { breakeven10Delta5: 0.08, realYield10Delta5: 0.2, dgs2: 4.1, fedTargetLower: 3.75, fedTargetUpper: 4.0 };
  const chainOf = (asOf) => buildMacroRead({ macro: { ...base, ...asOf }, rateFx: { tnx20: 30 } }).chain;
  const breakevenOf = (chain) => chain.nodes.find((node) => node.id === 'breakeven').value;
  const split = chainOf({ _asOf_realYield10: '2026-10-06', _asOf_breakeven10: '2026-10-07' });
  const same = chainOf({ _asOf_realYield10: '2026-10-07', _asOf_breakeven10: '2026-10-07' });
  const unknown = chainOf({});
  if (breakevenOf(split) !== '기준일이 달라 보류') fail('P1528 the chain must hold the breakeven move when the real-yield and breakeven dates differ');
  if (split.links.some((link) => /실질금리 우위/.test(link))) fail('P1528 the chain must not claim real-yield dominance across different observation dates');
  if (breakevenOf(same) !== '5거래일 +8bp' || !same.links.some((link) => /실질금리 우위/.test(link))) fail('P1528 same-day real yield and breakeven must still be compared');
  if (breakevenOf(unknown) !== '5거래일 +8bp') fail('P1528 without observation dates the chain keeps its previous reading');
}

// P1529: the trend chart labelled every month, so once a range grew the widest label ("26년 1월") sat on top of the
// preceding "12월" (browser-viewport failed on the macro route at every width). Labels are now thinned by available spacing.
{
  const { createTrendChart } = await load('src/ui/components/trend-chart.js');
  const makeNode = (tag) => ({ tag, attrs: {}, children: [], style: {}, textContent: '', className: '', setAttribute(key, value) { this.attrs[key] = String(value); }, append(...kids) { this.children.push(...kids); }, appendChild(kid) { this.children.push(kid); return kid; }, addEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 520, height: 210 }; } });
  const doc = { createElement: makeNode, createElementNS: (ns, tag) => makeNode(tag) };
  const walk = (node, out = []) => { out.push(node); (node.children || []).forEach((kid) => walk(kid, out)); return out; };
  for (const months of [3, 6, 9, 12, 14, 16, 18, 24, 36, 60]) {
    const series = [];
    const cursor = new Date(Date.UTC(2026, 9, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() - months);
    for (let i = 0; i <= months * 4; i += 1) { series.push({ date: cursor.toISOString().slice(0, 10), value: 100 + (i % 17) }); cursor.setUTCDate(cursor.getUTCDate() + 7); }
    const chart = createTrendChart(doc, { series: series.filter((point) => point.date <= '2026-10-07'), label: 'x' });
    const labels = walk(chart).filter((node) => node.tag === 'text' && node.attrs['text-anchor'] === 'middle' && Number(node.attrs.y) === 202).map((node) => ({ x: Number(node.attrs.x), text: node.textContent }));
    if (labels.length < 1) fail(`P1529 a ${months}-month chart must keep at least one month label`);
    for (let i = 1; i < labels.length; i += 1) {
      const wide = [labels[i - 1], labels[i]].some((label) => /년/.test(label.text));
      if (labels[i].x - labels[i - 1].x < (wide ? 40 : 28)) fail(`P1529 month labels overlap on a ${months}-month range: ${labels[i - 1].text} and ${labels[i].text}`);
    }
    const januaries = walk(chart).filter((node) => node.tag === 'text' && /년 1월$/.test(node.textContent || '')).length;
    const januaryTicks = labels.filter((label) => /년 1월$/.test(label.text)).length;
    if (januaryTicks !== januaries) fail('P1529 internal: january count');
  }
}

// v57.77: the 한국 차트·기술 분석 KOSPI/KOSDAQ cards printed "N단계 · 확도 NN%", a setup state and English MACD/BB boxes from
// a live fetch. They now read completed KRX closes only: 50-/200-day position in Korean and three computed-fact lines.
{
  const { krIndexTrendFacts, krIndexPositionText, krIndexReading, renderKrIndexTrends } = await load('src/ui/components/kr-index-trend.js');
  const { isCloseSessionDate } = await load('src/domain/briefing/market-read.js');
  const dates = [];
  const cursor = new Date(Date.UTC(2025, 6, 1));
  while (dates.length < 230) { const date = cursor.toISOString().slice(0, 10); if (isCloseSessionDate(date, 'KR')) dates.push(date); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  const rising = dates.map((date, i) => ({ date, kospi: 2500 + i * 10 }));
  const up = krIndexTrendFacts(rising, 'kospi');
  if (krIndexPositionText(up) !== '50일선 위 · 200일선 위' || up.cross !== '위') fail(`v57.77 a rising KOSPI must read 50일선 위 · 200일선 위: ${krIndexPositionText(up)}`);
  const lines = krIndexReading(up, '코스피');
  if (lines.length !== 3 || lines.some((line) => /단계|확도|등급|셋업|Stage|MACD|Signal|Histogram|Upper|Lower|%B|52W|Gap/.test(line))) fail(`v57.77 the KR index reading is three fact lines without grades or English labels: ${lines.join(' / ')}`);
  const falling = rising.map((row, i) => i >= 170 ? { ...row, kospi: 4200 - (i - 170) * 30 } : row);
  if (krIndexPositionText(krIndexTrendFacts(falling, 'kospi')) !== '50일선 아래 · 200일선 아래') fail('v57.77 a falling KOSPI must read 50일선 아래 · 200일선 아래');
  if (krIndexPositionText(krIndexTrendFacts(rising.slice(0, 30), 'kospi')) !== '50일선 계산 전 · 200일선 계산 전') fail('v57.77 averages without enough closes are withheld, not estimated');
  if (krIndexTrendFacts(rising, 'kospi', { through: dates[199] })?.date !== dates[199]) fail('v57.77 the KR card stops at the completed KRX session');
  const makeNode = (tag) => ({ tag, attrs: {}, children: [], style: {}, dataset: {}, textContent: '', className: '', setAttribute(key, value) { this.attrs[key] = String(value); }, append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = kids; }, addEventListener() {} });
  const hosts = { 'kr-kospi-tech-result': makeNode('section'), 'kr-kosdaq-tech-result': makeNode('section') };
  const doc = { createElement: makeNode, createElementNS: (ns, tag) => makeNode(tag), getElementById: (id) => hosts[id] || null };
  const now = Date.parse(`${dates.at(-1)}T09:00:00Z`);
  const drawn = renderKrIndexTrends({ documentRef: doc, root: { _aioHistory: rising }, now });
  const walk = (node, out = []) => { out.push(node); (node.children || []).forEach((kid) => walk(kid, out)); return out; };
  const kospiNodes = walk(hosts['kr-kospi-tech-result']);
  if (drawn !== 1 || !kospiNodes.some((node) => node.tag === 'svg') || !kospiNodes.some((node) => node.textContent === '50일선 위 · 200일선 위')) fail('v57.77 the KOSPI card draws one close chart and its 50-/200-day position');
  if (hosts['kr-kosdaq-tech-result'].style.display !== 'none') fail('v57.77 a KOSDAQ card without close history stays hidden');
  const first = hosts['kr-kospi-tech-result'].children;
  renderKrIndexTrends({ documentRef: doc, root: { _aioHistory: rising }, now });
  if (hosts['kr-kospi-tech-result'].children !== first) fail('v57.77 the KR card redraws only when the last close changes');
}

// P1586: self-computed sentiment composite — withholds below four components, ranks each against its own
// trailing year, labels the stand-in junk-bond basis, and never borrows CNN's value.
{
  const { computeCompositeFearGreed } = await import(pathToFileURL(path.join(root, 'src/domain/sentiment/composite-fear-greed.js')).href);
  const day = (i) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
  const rising = Array.from({ length: 300 }, (_, i) => ({ date: day(i), spx: 5000 + i * 5, vix: 20 - i * 0.02, advanceRatio: 0.5 + Math.sin(i / 9) * 0.1 + i * 0.0004, fg: 99 }));
  // P1644 (M03): the spread series must reach the price basis (within two sessions) to count as current.
  const hy = { series: { hyOas: { observations: Array.from({ length: 300 }, (_, i) => [day(i), 4 - i * 0.004]) } } };
  const thin = computeCompositeFearGreed({ history: rising.slice(0, 80), macroHistory: null });
  if (thin.spread !== null || thin.status !== 'withheld') fail(`P1586 composite must withhold below four ready components: ${JSON.stringify({ spread: thin.spread, ready: thin.componentsReady })}`);
  const full = computeCompositeFearGreed({ history: rising, macroHistory: hy });
  const rank = (id) => full.components.find((c) => c.id === id)?.score;
  if (full.componentsReady !== 4 || !(rank('volatility') >= 65) || !(rank('junkBond') >= 65)) fail(`P1586 falling VIX and spreads must rank on the greed side: ${JSON.stringify(full.components.map((c) => [c.id, c.score]))}`);
  if (!/대체/.test(full.components.find((c) => c.id === 'junkBond').basis)) fail('P1586 the HY-only junk-bond stand-in must say so');
  if (full.components.some((c) => c.raw === 99)) fail('P1586 composite must not read the CNN fg column');
  // v57.50 D02: no averaged 0-100 score and no 공포~탐욕 band; the lowest and highest component are named instead.
  if ('score' in full || 'band' in full || !full.spread || full.spread.low.score > full.spread.high.score || full.spread.gap !== Math.round((full.spread.high.score - full.spread.low.score) * 10) / 10) fail(`v57.50 D02 composite must expose the component spread, not a score or band: ${JSON.stringify({ spread: full.spread, score: full.score, band: full.band })}`);
}
// P1592: Korean particles follow the spoken final syllable of an interpolated word (F72 '스프레드을 본다').
{
  const { withObjectParticle, withTopicParticle, withDirectionParticle } = await load('src/domain/content/korean-particle.js');
  const cases = [[withObjectParticle, '스프레드', '스프레드를'], [withObjectParticle, '전망 3.1%', '전망 3.1%를'], [withObjectParticle, '재고', '재고를'], [withObjectParticle, 'HBM', 'HBM을'], [withObjectParticle, '범위', '범위를'], [withObjectParticle, '웨이퍼당 비트', '웨이퍼당 비트를'], [withObjectParticle, '수율', '수율을'],
    [withTopicParticle, 'NVDA', 'NVDA는'], [withTopicParticle, 'Warren Buffett', 'Warren Buffett은'], [withTopicParticle, '최소 백분위', '최소 백분위는'], [withDirectionParticle, 'AI 가치사슬', 'AI 가치사슬로'], [withDirectionParticle, '반도체 공정', '반도체 공정으로'], [withDirectionParticle, '서울', '서울로']];
  for (const [fn, word, expected] of cases) if (fn(word) !== expected) fail(`P1592 particle: ${word} -> ${fn(word)} (expected ${expected})`);
}
// P1592 (F62): each column chapter links to its own existing analysis notes — not one shared list of four.
{
  const { COLUMN_FRAME_LINKS, lessonById } = await load('src/domain/knowledge/learning-core.js');
  const journey = JSON.parse((await import('node:fs')).readFileSync(path.join(root, 'public-data/principles/narrative-journey.json'), 'utf8'));
  const chapterIds = journey.parts.flatMap((part) => part.chapters.map((chapter) => chapter.id));
  const missing = chapterIds.filter((id) => !(COLUMN_FRAME_LINKS[id] || []).length);
  const dangling = Object.values(COLUMN_FRAME_LINKS).flat().filter((id) => !lessonById(id));
  const signatures = new Set(Object.values(COLUMN_FRAME_LINKS).map((ids) => ids.join('|')));
  if (missing.length || dangling.length || signatures.size < chapterIds.length - 1) fail(`P1592 column note links must cover every chapter with existing, chapter-specific notes: ${JSON.stringify({ missing, dangling, distinct: signatures.size })}`);
}
// P1668: concurrent screener reads share one in-flight artifact fetch; a later refresh fetches again,
// and a read whose caller aborted is not reused by the next caller.
{
  const { createScreenerProvider } = await load('src/data/providers/screener.js');
  let calls = 0;
  const gates = [];
  const httpClient = { requestJson: (url, { signal } = {}) => { calls++; return new Promise((resolve) => gates.push(() => resolve(signal?.aborted ? { ok: false, error: 'HTTP_ABORTED' } : { ok: false, status: 404, data: null }))); } };
  const provider = createScreenerProvider({ httpClient, yieldImpl: () => Promise.resolve() });
  const flush = async () => { while (gates.length) gates.shift()(); await new Promise((resolve) => setTimeout(resolve, 0)); };
  const first = provider.readCurrent();
  const second = provider.readCurrent();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flush();
  await Promise.all([first, second]);
  if (calls !== 3) fail(`P1668 two concurrent screener reads must share one artifact fetch (3 requests), saw ${calls}`);
  const third = provider.readCurrent();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flush();
  await third;
  if (calls !== 6) fail(`P1668 a later refresh must fetch again, saw ${calls} requests`);
  const controller = new AbortController();
  const aborted = provider.readCurrent({ signal: controller.signal }).catch(() => null);
  controller.abort();
  const after = provider.readCurrent();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flush();
  await Promise.all([aborted, after]);
  if (calls !== 12) fail(`P1668 a read must not reuse a fetch whose caller aborted, saw ${calls} requests`);
}
// P1686: the normalizer keeps the one/five-session returns the map's 1일/1주 tabs read (it dropped them, so the
// tabs stayed disabled on the deployed site even after the producer published ret1d/ret5d).
{
  const { normalizeScreener } = await load('src/data/normalize/screener.js');
  const normalized = normalizeScreener({ rows: [{ sym: 'AAPL', ret1d: 1.29, ret5d: 2.43, ret1m: 2.62 }] });
  const row = (normalized.rows || [])[0] || {};
  if (row.ret1d !== 1.29 || row.ret5d !== 2.43) fail('P1686 normalizeScreener must keep ret1d/ret5d for the map tabs');
}
// P1679/P1681: S&P 500 map domain — tiles stay inside the canvas, the fallback names what is missing, a member on an
// older close is greyed and kept out of the averages, and a tab is enabled only by the members' own returns.
{
  const { buildSectorMap, layoutSectorMap, squarify } = await load('src/domain/market/sector-map.js');
  const tiles = squarify([{ value: 6 }, { value: 6 }, { value: 4 }, { value: 3 }, { value: 2 }, { value: 2 }, { value: 1 }], { x: 0, y: 0, w: 600, h: 400 });
  if (tiles.length !== 7 || tiles.some((t) => t.x < -1e-6 || t.y < -1e-6 || t.x + t.w > 600 + 1e-6 || t.y + t.h > 400 + 1e-6)) fail('P1679 squarify tiles must stay inside the rectangle');
  const sectors = ['Technology', 'Financial Services', 'Healthcare', 'Energy'];
  const members = Array.from({ length: 40 }, (_, i) => ({ sym: `S${i}`, name: `S${i}`, index: 'SP500', sector: sectors[i % 4], _valuationPePrice: 100, _valuationSharesOutstanding: 1e9 * (i + 1), dollarVolume30d: 1e9 * (i + 1) * 100 * 0.005, ret1m: i % 2 ? 2 : -1, factorSessionDate: i === 39 ? '2026-10-08' : '2026-10-09' }));
  members.push({ sym: 'MEGA', index: 'SP500', sector: 'Technology', _valuationPePrice: 100, ret1m: 50, factorSessionDate: '2026-10-09' });
  members.push({ sym: '005930.KS', index: 'KOSPI', sector: 'Technology', ret1d: 1 });
  const map = buildSectorMap({ rows: members, period: 'ret1m', expectedSession: '2026-10-09' });
  if (!map.available || map.sizeBasis !== 'shares-times-close' || !map.missingNames.includes('MEGA') || !/MEGA/.test(map.lead)) fail('P1679 the fallback map must name the member it could not size');
  if (map.staleCount !== 1 || !/회색/.test(map.lead) || map.sectors.flatMap((s) => s.members).find((m) => m.sym === 'S39')?.ret !== null) fail('P1681 a member on an older close must be greyed and left out of the averages');
  if (map.periods.ret1d !== false || map.periods.ret1m !== true) fail('P1681 a Korean row ret1d must not enable the S&P 500 map 1일 tab');
  const laid = layoutSectorMap(map, 960, 520);
  if (laid.tiles.length !== map.drawn || laid.tiles.some((t) => t.x + t.w > 960 + 1e-6 || t.y + t.h > 520 + 1e-6)) fail('P1679 every drawn member must get one tile inside the map');
  // Expert review M02: averages weight each member by its START-of-window size, w0 ∝ w_now / (1 + r). A member that
  // doubled to half the index started at a third of it: (25×100 + 50×0) / 75 = +33.3%, not today's-weight +50%.
  const weightRows = [{ sym: 'BIG', sector: 'Information Technology', weight: 50, name: 'BIG' }, ...Array.from({ length: 449 }, (_, i) => ({ sym: `W${i}`, sector: i % 2 ? 'Financials' : 'Energy', weight: 50 / 449, name: `W${i}` }))];
  const weightMembers = weightRows.map((item) => ({ sym: item.sym, name: item.name, index: 'SP500', ret3m: item.sym === 'BIG' ? 100 : 0, ret1d: item.sym === 'BIG' ? 100 : 0, factorSessionDate: '2026-10-12' }));
  weightMembers.push({ sym: 'SPY', ret3m: 33.3, ret1d: 50, factorSessionDate: '2026-10-12' });
  const startWeighted = buildSectorMap({ rows: weightMembers, weights: { asOf: '2026-10-12', rows: weightRows }, period: 'ret3m', expectedSession: '2026-10-12' });
  if (Math.abs(startWeighted.weightedReturn - 100 / 3) > 1e-6 || startWeighted.weightBasis !== 'period-start' || /SPY/.test(startWeighted.lead)) fail(`M02 the map average must use start-of-window weights: ${startWeighted.weightedReturn}`);
  // Holdings dated before the close are already the 1일 window's start weights — no back-out there.
  const dayMap = buildSectorMap({ rows: weightMembers, weights: { asOf: '2026-10-09', rows: weightRows }, period: 'ret1d', expectedSession: '2026-10-12' });
  if (Math.abs(dayMap.weightedReturn - 50) > 1e-6) fail(`M02 the 1일 map must weight by holdings dated at the window start: ${dayMap.weightedReturn}`);
  // A gap to the index's own return is stated beside the average, not hidden.
  const gapMap = buildSectorMap({ rows: weightMembers.map((row) => (row.sym === 'SPY' ? { ...row, ret3m: 20 } : row)), weights: { asOf: '2026-10-12', rows: weightRows }, period: 'ret3m', expectedSession: '2026-10-12' });
  if (gapMap.benchmarkReturn !== 20 || !/SPY \+20\.0%/.test(gapMap.lead)) fail(`M02 a gap to SPY must be stated in the lead: ${gapMap.lead}`);
  // M21: share classes are one issuer in the top 10; the sector table counts over members with a return; the lead
  // carries the equal-weight average; no "소수 대형주가 끌었습니다" verdict.
  const classRows = [...weightRows.slice(0, 448), { sym: 'GOOGL', sector: 'Communication', weight: 0.06, name: 'ALPHABET CLASS A' }, { sym: 'GOOG', sector: 'Communication', weight: 0.06, name: 'ALPHABET CLASS C' }];
  const classMembers = [...weightMembers.filter((row) => row.sym !== 'W447' && row.sym !== 'W446'), { sym: 'GOOGL', index: 'SP500', ret3m: 5, factorSessionDate: '2026-10-12' }];
  const classMap = buildSectorMap({ rows: classMembers, weights: { asOf: '2026-10-12', rows: classRows }, period: 'ret3m', expectedSession: '2026-10-12' });
  if (!classMap.top10Issuers.includes('GOOGL·GOOG') || classMap.top10Issuers.length !== 10) fail(`M21 GOOGL and GOOG must be one issuer in the top 10: ${classMap.top10Issuers}`);
  const comm = classMap.sectors.find((sector) => sector.sector === 'Communication');
  if (comm.count !== 2 || comm.withRet !== 1) fail('M21 the sector table denominator must be the members with a return');
  if (!/같은 비중을 두면 평균/.test(classMap.lead) || /끌었습니다/.test(classMap.lead)) fail(`M21 the concentration sentence must carry the equal-weight average: ${classMap.lead}`);
  // M07: the map follows the app-wide colour rule (rising green, falling red).
  const mapCss = readFileSync(path.join(root, 'src/ui/styles/regime-quality.css'), 'utf8');
  if (!/\.sector-map \.is-u3 \{ background: #1f7048/.test(mapCss) || !/\.sector-map \.is-d3 \{ background: #b8302a/.test(mapCss) || /오르면 빨강/.test(readFileSync(path.join(root, 'src/ui/components/sector-map.js'), 'utf8'))) fail('M07 the S&P 500 map must colour rises green and falls red');
}
// P1518: shared request/event/router lifecycle ownership under adversarial scheduling.
// T01/T02/T05/T19/T04/T15 (expert review v57.48, 2026-10-13): the shared close series keeps one value per session of the
// field's own market. A Sunday-evening FX/oil tick was a "close" (20 rows = ~16 sessions, basis chip 10/11(일), won 20일
// -2.57% vs weekdays +0.13% -> 환율 축 '양호'); the credit axis ignored a 20-session HY widening.
{
  const { buildCloseSeries, alignMarketInputs, buildMarketRegime, hyDelta20Bp } = await load('src/domain/briefing/market-read.js');
  const { formatPayrollChange, buildBriefingSchedule } = await load('src/domain/briefing/schedule.js');
  const { openSessionDatesBetween } = await load('src/domain/market/market-calendar.js');
  const sessions = openSessionDatesBetween('2026-01-30', '2026-10-12', { market: 'US' });
  const history = sessions.map((date, i) => ({ date, spx: 6000 + i, usdkrw: 1400, kospi: 3000 + i,
    fieldMeta: { spx: { observedAt: `${date}T20:10:00Z` }, usdkrw: { observedAt: `${date}T20:10:00Z` } } }));
  // Sunday-evening 24h ticks (NY 19:00) far below the weekday level, plus a US-holiday tick.
  const sundays = [];
  for (const row of history) {
    const sunday = new Date(Date.parse(`${row.date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
    if (new Date(`${sunday}T12:00:00Z`).getUTCDay() === 0) sundays.push(sunday);
  }
  for (const sunday of sundays) history.push({ date: sunday, usdkrw: 1300, fieldMeta: { usdkrw: { observedAt: `${sunday}T23:00:00Z` } } });
  history.push({ date: '2026-09-07', usdkrw: 1300, fieldMeta: { usdkrw: { observedAt: '2026-09-07T15:00:00Z' } } });
  const krw = buildCloseSeries(history, 'usdkrw');
  if (krw.some((point) => [0, 6].includes(new Date(`${point.date}T12:00:00Z`).getUTCDay()) || point.date === '2026-09-07' || point.value !== 1400)) fail('T01 a weekend or US-holiday tick must not become a close of a US-basis field');
  if (buildCloseSeries(history, 'usdkrw', { market: null }).length !== krw.length + sundays.length + 1) fail('T01 market:null keeps every observation (24/7 fields)');
  const aligned = alignMarketInputs({ history, now: Date.parse(`${sessions.at(-1)}T23:00:00Z`) });
  if (aligned.s.usdkrw?.date !== sessions.at(-1) || aligned.s.usdkrw.d20 !== 1400 || aligned.s.usdkrw.d20Date !== sessions.at(-21)) fail(`T01 the won 20일 must start 20 sessions back on a weekday close: ${JSON.stringify(aligned.s.usdkrw && { date: aligned.s.usdkrw.date, d20: aligned.s.usdkrw.d20, from: aligned.s.usdkrw.d20Date })}`);
  const fx = buildMarketRegime({ history, now: Date.parse(`${sessions.at(-1)}T23:00:00Z`) }).axes.find((axis) => axis.id === 'korea');
  if (fx?.state !== 'neutral') fail(`T01 a flat weekday won must not read as 원화 강세·양호 (got ${fx?.state})`);
  // v57.75 (10/15 crash): a 20-day won strength that turned weak on the last session holds the verdict at neutral.
  {
    // v57.81: the won must move across the window (the 20-session mean agrees), not only on the last two closes.
    const glide = sessions.slice(-20, -1);
    const withLast = (prev, last) => history.map((row) => glide.includes(row.date) ? { ...row, usdkrw: 1400 - (1400 - prev) * (glide.indexOf(row.date) + 1) / glide.length } : row.date === sessions.at(-1) ? { ...row, usdkrw: last } : row);
    const axisFor = (prev, last) => buildMarketRegime({ history: withLast(prev, last), now: Date.parse(`${sessions.at(-1)}T23:00:00Z`) }).axes.find((axis) => axis.id === 'korea');
    const strong = axisFor(1345, 1340), turned = axisFor(1340, 1360);
    if (strong?.state !== 'favorable' || turned?.state !== 'neutral' || !/약세로 돌아섰/.test(turned?.read || JSON.stringify(turned))) fail(`v57.75 a won that turned weak on the last session must not stay 양호 (got ${strong?.state}/${turned?.state})`);
  }
  // T01: "20일" counts sessions; a gappy series (no Friday bars) still finds the point at least 20 sessions back.
  const gappy = history.filter((row) => !(row.usdkrw === 1400 && new Date(`${row.date}T12:00:00Z`).getUTCDay() === 5));
  const gap = alignMarketInputs({ history: gappy.map((row) => row.date === sessions.at(-1) ? row : row), now: Date.parse(`${sessions.at(-1)}T23:00:00Z`) }).s.usdkrw;
  if (!gap || gap.d20 == null) fail('T01 a series missing one weekday a week keeps a session-counted 20-day change');
  // T19: a Korean field is checked against the KRX calendar (10/5, 10/9 closed), not the US one.
  const krHistory = sessions.map((date, i) => ({ date, spx: 6000 + i, kospi: 3000 + i, fieldMeta: { kospi: { observedAt: `${date}T06:30:00Z` } } }))
    .filter((row) => !['2026-10-05', '2026-10-09', '2026-09-24', '2026-09-25'].includes(row.date));
  const kr = alignMarketInputs({ history: krHistory, now: Date.parse(`${sessions.at(-1)}T09:00:00Z`) }).s.kospi;
  if (!kr || kr.d20 == null) fail('T19 KRX holidays must not withhold the KOSPI 20-day change');
  // T05: +45bp over 20 sessions keeps the credit axis at 중립 at best and the read names the 20-day change.
  const hyObs = sessions.slice(-30).map((date, i) => [date, i < 9 ? 2.7 : 2.7 + (i - 9) * 0.0215]);
  const macroHistory = { series: { hyOas: { observations: hyObs } } };
  const hy20 = hyDelta20Bp(macroHistory, sessions.at(-1));
  if (!hy20 || Math.round(hy20.value) !== 43) fail(`T05 hyDelta20Bp must be the 20-session change in bp: ${JSON.stringify(hy20)}`);
  const credit = { hyBp: 315, hyDelta5Bp: -9, hyAsOf: sessions.at(-1) };
  const creditAxis = (extra) => buildMarketRegime({ history, credit, now: Date.parse(`${sessions.at(-1)}T23:00:00Z`), ...extra }).axes.find((axis) => axis.id === 'credit');
  if (creditAxis({}).state !== 'favorable') fail('T05 fixture: without the 20-day change the old favorable rule still applies');
  const widened = creditAxis({ macroHistory });
  if (widened.state !== 'neutral' || !/20거래일 동안 \+43bp/.test(widened.read) || !widened.evidence.some(([, value]) => /20거래일 \+43bp/.test(value))) fail(`T05 a 20-session widening keeps credit at 중립 with the change named: ${widened.state} ${widened.read}`);
  // T04: a payroll loss is signed once and shown in 만 명.
  if (formatPayrollChange(-15) !== '-1.5만 명' || formatPayrollChange(29) !== '+2.9만 명' || formatPayrollChange(null) !== null) fail('T04 payroll change format');
  const nfp = buildBriefingSchedule({ releases: { 'us-nfp': { nextRelease: '2026-10-02' } }, snapshot: { nfp: -15, unemployment: 4.3 }, nowMs: Date.parse('2026-10-02T01:00:00Z') });
  if (/\+-/.test(nfp[0]?.last || '') || !/직전 -1\.5만 명/.test(nfp[0]?.last || '')) fail(`T04 negative payrolls printed as "+-": ${nfp[0]?.last}`);
  // T15: no provider name or '미제공' in the earnings line; the provider goes to the hover title.
  const earn = buildBriefingSchedule({ nowMs: Date.parse('2026-10-09T00:00:00Z'), names: { NVDA: 'NVIDIA' }, earningsMeta: { source: 'Finnhub calendar/earnings' },
    earnings: [{ symbol: 'NVDA', date: '2026-10-09', hour: 'amc', epsEstimate: 1 }] });
  if (/Finnhub|미제공/.test(earn[0]?.last || '') || !/Finnhub/.test(earn[0]?.sourceTitle || '')) fail(`T15 earnings line must keep provider names in the hover: ${JSON.stringify(earn[0])}`);
}

// v57.79 (UI review): page titles follow one rule. The breadcrumb is <sidebar hub label>/<tab label> (a hub with one
// visible tab shows its label alone); the page <h1> is the tab label on a multi-tab hub and the hub label on a single-tab hub.
{
  const { ROUTE_HUBS } = await load('src/ui/navigation/route-hubs.js');
  const { RESEARCH_PAGES } = await load('src/ui/knowledge/research-shell.js');
  const core = readFileSync(path.join(root, 'js/aio-core.js'), 'utf8');
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const body = /var breadcrumbMap = \{([\s\S]*?)\n\};/.exec(core)?.[1];
  if (!body) fail('v57.79 breadcrumbMap literal not found in js/aio-core.js');
  const breadcrumbs = Function(`return {${body}};`)();
  const staticH1 = (id) => {
    const at = html.indexOf(`id="page-${id}"`);
    if (at < 0) return null;
    const end = html.indexOf('<div class="page"', at + 1);
    return /<h1 class="page-title"[^>]*>([^<]+)<\/h1>/.exec(html.slice(at, end < 0 ? undefined : end))?.[1]?.trim() ?? null;
  };
  for (const hub of ROUTE_HUBS) {
    const tabs = hub.routes.filter((route) => route.tab !== false);
    for (const route of tabs) {
      const expected = tabs.length > 1 ? [hub.label, route.label] : [hub.label];
      if (JSON.stringify(breadcrumbs[route.id]) !== JSON.stringify(expected)) fail(`v57.79 breadcrumb for ${route.id} must be ${expected.join('/')}, got ${JSON.stringify(breadcrumbs[route.id])}`);
      const title = tabs.length > 1 ? route.label : hub.label;
      const research = RESEARCH_PAGES.find((page) => page.route === route.id);
      const h1 = research ? research.title : staticH1(route.id);
      if (route.id !== 'ticker' && h1 !== title) fail(`v57.79 ${route.id} page title must be "${title}", got "${h1}"`); // 요약: the h1 names the selected company
    }
  }
}

// v57.79 (UI review): the home 코스피 chip names its basis and never shows an unlabeled number that conflicts with the
// last KRX close; the close tiles carry a "지금" line only when a quote is newer than the compared US close.
{
  const { koreaQuoteChip, liveSinceClose } = await load('src/ui/components/daily-loop.js');
  {
    // v57.83 codex audit F25/F26: more than eight names says the count and the way to the rest; an empty schedule says
    // "없습니다" only when the calendars were read.
    const dailySrc = readFileSync(path.join(root, 'src/ui/components/daily-loop.js'), 'utf8');
    if (!/전체 \$\{model\.names\.length\}개 중 8개 표시/.test(dailySrc) || !/scr-watchlist-only/.test(dailySrc)) fail('v57.83 the home name list names its total and links to the watchlist'); // text-pin-ok: renderDailyLoop needs a full document and store; the browser check exercises the button
    if (!/발표 일정 자료를 아직 받지 못했습니다/.test(dailySrc) || !/실적 발표 일정은 아직 받는 중입니다/.test(dailySrc)) fail('v57.83 the home schedule keeps not-received apart from none'); // text-pin-ok: renderer copy without a test document; browser check covers the empty states
  }
  const closes = [{ date: '2026-10-13', value: 6035 }, { date: '2026-10-14', value: 6008.81 }];
  const session = { price: 5498.42, pct: -8.494, observedAt: '2026-10-15T05:35:00.000Z', regularMarketPreviousClose: 6008.81, marketState: 'DELAYED_IN_SESSION' };
  const live = koreaQuoteChip({ live: session, closes });
  if (live?.basis !== 'live' || live.date !== '2026-10-15' || live.time !== '14:35' || !live.delayed) fail(`v57.79 a newer KRX quote whose previous close matches the close series is shown with its KST time: ${JSON.stringify(live)}`);
  const older = koreaQuoteChip({ live: { ...session, observedAt: '2026-10-13T05:35:00.000Z' }, closes });
  if (older?.basis !== 'close' || older.reason !== 'live-older' || older.date !== '2026-10-14') fail(`v57.79 a quote older than the last close falls back to that close with its date: ${JSON.stringify(older)}`);
  const disagree = koreaQuoteChip({ live: { ...session, regularMarketPreviousClose: 5500 }, closes });
  if (disagree?.basis !== 'close' || disagree.reason !== 'live-disagrees') fail(`v57.79 a quote whose previous close is >5% off the close series shows the close: ${JSON.stringify(disagree)}`);
  if (koreaQuoteChip({ live: null, closes: [] }) !== null) fail('v57.79 with neither a quote nor a close the 코스피 chip hides');
  if (liveSinceClose('wti', { price: 94.38, pct: -0.75, observedAt: '2026-10-15T05:35:00Z' }, '2026-10-14')?.text !== '지금 94.38 -0.75%') fail('v57.79 a WTI quote after the 10/14 US close adds a 지금 line');
  if (liveSinceClose('vix', { price: 16.87, pct: 10.48, observedAt: '2026-10-14T20:15:00Z' }, '2026-10-14') !== null) fail('v57.79 a quote taken at the compared close adds no 지금 line');
  if (liveSinceClose('tnx', { price: 5.19, pct: -0.5, observedAt: '2026-10-15T14:00:00Z' }, '2026-10-14')?.text !== '지금 5.19% -3bp') fail('v57.79 the 10-year 지금 line moves in basis points');
  if (liveSinceClose('wti', { price: 94.38, pct: -0.75, observedAt: '2026-10-15T05:35:00Z' }, '2026-10-14', 92.5)?.text !== '지금 94.38 +2.03%') fail('v57.86 the 지금 change is measured from the tile close, not the provider previous close');
  if (liveSinceClose('tnx', { price: 5.19, pct: -0.5, observedAt: '2026-10-15T14:00:00Z' }, '2026-10-14', 5.15)?.text !== '지금 5.19% +4bp') fail('v57.86 the 10-year 지금 line moves from the tile close in basis points');
}

// v57.81: history.json held one session under two row dates. Rows before v57.70 stamp a previous close with a bar
// boundary and no sessionDate; the 10/14 23:21Z run's WTI 94.14 (the 10/13 close) read as a 10/14 value beside the
// 10/15 row's real 10/14 close 95.09, and the 10/12 DXY close sat on both 10/12 and 10/13.
{
  const { buildCloseSeries } = await load('src/domain/briefing/market-read.js');
  const { buildDailyChanges } = await load('src/domain/briefing/daily-diff.js');
  const { historyFieldSessionDate, inferPreviousCloseSession } = await load('src/domain/market/history-session.js');
  const prev = (observedAt, fetchedAt, extra = {}) => ({ observedAt, fetchedAt, valueBasis: 'previous-completed-close', observationRelation: 'previous-completed-close', observedAtSource: 'provider-previous-close', ...extra });
  const spxMeta = (date) => ({ observedAt: `${date}T20:30:00Z`, valueBasis: 'latest-completed-close', observationRelation: 'latest-completed-close' });
  const rows = [
    { date: '2026-10-12', spx: 7807.24, dxy: 102.58, wti: 91.85, fieldMeta: { spx: spxMeta('2026-10-12'), dxy: { observedAt: '2026-10-12T04:00:00Z', observationRelation: 'latest-completed-close' }, wti: prev('2026-10-09T04:00:00Z', '2026-10-12T19:23:21Z') } },
    { date: '2026-10-13', spx: 7805.45, dxy: 102.58, wti: 93.74, fieldMeta: { spx: spxMeta('2026-10-13'), dxy: prev('2026-10-13T04:00:00Z', '2026-10-13T23:51:06Z'), wti: prev('2026-10-13T04:00:00Z', '2026-10-13T23:51:06Z') } },
    { date: '2026-10-14', spx: 7718.94, dxy: 102.18, wti: 94.14, fieldMeta: { spx: spxMeta('2026-10-14'), dxy: prev('2026-10-14T04:00:00Z', '2026-10-14T23:21:26Z'), wti: prev('2026-10-14T04:00:00Z', '2026-10-14T23:21:26Z') } },
    { date: '2026-10-15', spx: 7718.94, dxy: 102.55, wti: 95.09, fieldMeta: { spx: { ...spxMeta('2026-10-14'), observationRelation: 'carried-forward', carriedFrom: '2026-10-14' }, dxy: prev('2026-10-14T04:00:00Z', '2026-10-15T07:51:34Z', { sessionDate: '2026-10-14' }), wti: prev('2026-10-14T04:00:00Z', '2026-10-15T07:51:34Z', { sessionDate: '2026-10-14' }) } },
  ];
  // The same bar-boundary stamp names two sessions: whether a newer bar had opened by the fetch decides which.
  if (inferPreviousCloseSession(rows[2].fieldMeta.wti, 'wti') !== '2026-10-13' || inferPreviousCloseSession({ ...rows[3].fieldMeta.wti, sessionDate: null }, 'wti') !== '2026-10-14'
    || historyFieldSessionDate(rows[0].fieldMeta.wti, 'wti') !== '2026-10-09' || historyFieldSessionDate(rows[3].fieldMeta.spx, 'spx') !== null) fail('v57.81 a previous close is dated by its bar boundary and fetch time; a held copy has no session of its own');
  // Duplicate-session rows collapse to one session.
  const wti = buildCloseSeries(rows, 'wti');
  if (JSON.stringify(wti) !== JSON.stringify([{ date: '2026-10-09', value: 91.85 }, { date: '2026-10-12', value: 93.74 }, { date: '2026-10-13', value: 94.14 }, { date: '2026-10-14', value: 95.09 }])) fail(`v57.81 one WTI value per session (the 10/14 row holds the 10/13 close): ${JSON.stringify(wti)}`);
  const dxy = buildCloseSeries(rows, 'dxy');
  if (dxy.filter((point) => point.value === 102.58).length !== 1 || dxy.find((point) => point.date === '2026-10-13')?.value !== 102.18) fail(`v57.81 the repeated 10/12 DXY close collapses to one session: ${JSON.stringify(dxy)}`);
  // A held value is not a change, and the 1-day change compares the previous distinct session.
  const spx = buildCloseSeries(rows, 'spx');
  if (spx.length !== 3 || spx.at(-1).date !== '2026-10-14') fail(`v57.81 a held (carried-forward) S&P 500 copy is not a session: ${JSON.stringify(spx)}`);
  const diff = buildDailyChanges(rows, { now: Date.parse('2026-10-15T08:00:00Z') });
  const move = (key) => diff.moves.find((item) => item.key === key)?.value;
  if (diff.date !== '2026-10-14' || diff.prevDate !== '2026-10-13' || Math.abs(move('wti') - (95.09 / 94.14 - 1) * 100) > 1e-9 || Math.abs(move('dxy') - (102.55 / 102.18 - 1) * 100) > 1e-9) fail(`v57.81 the 1-day change uses the previous distinct session (WTI 94.14 -> 95.09, DXY 102.18 -> 102.55): ${JSON.stringify(diff.moves)}`);
}

// v57.81 (owner 2026-10-15): cash is one balance per currency (원화·달러). A legacy single value migrates by a pure read,
// the legacy copy is dropped only after the new key reads back, totals convert with the app's published USD/KRW close
// (or a declared rate) with its date, and with no rate the total is held — never estimated. Backups old and new round-trip.
{
  const { readCashBalances, writeCashBalances, setCashBalance, legacyCashCurrency, PORTFOLIO_CASH_KEY, LEGACY_CASH_KEY } = await load('src/data/portfolio-cash.js');
  const { appUsdKrwClose, convertCashBalances } = await load('src/domain/portfolio/cash.js');
  const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
  const { buildPortfolioBackup, parsePortfolioBackup, describeBackupCounts } = await load('src/data/portfolio-backup.js');
  const memory = (initial = {}, { failWrite = false, mangle = false } = {}) => {
    const values = new Map(Object.entries(initial));
    return { writes: 0, getItem: (k) => (values.has(k) ? values.get(k) : null), setItem(k, v) { this.writes++; if (failWrite) throw new Error('quota'); values.set(k, mangle ? `${v} ` : String(v)); }, removeItem(k) { this.writes++; values.delete(k); }, dump: () => Object.fromEntries(values) };
  };
  // Migration: the legacy value keeps its declared currency (then the base, then USD); reading never writes and is stable.
  const legacy = memory({ [LEGACY_CASH_KEY]: '5000', aio_portfolio_cash_currency: 'KRW' });
  const first = readCashBalances(legacy);
  const second = readCashBalances(legacy);
  if (first.source !== 'legacy-single' || JSON.stringify(first.balances) !== '[{"currency":"KRW","amount":5000}]' || legacy.writes !== 0 || JSON.stringify(first) !== JSON.stringify(second)) fail(`v57.81 a legacy single cash value must read as one KRW balance without a write, twice the same: ${JSON.stringify({ first, writes: legacy.writes })}`);
  if (readCashBalances(memory({ [LEGACY_CASH_KEY]: '700', aio_portfolio_base_currency: 'krw' })).balances[0]?.currency !== 'KRW'
    || readCashBalances(memory({ [LEGACY_CASH_KEY]: '700' })).balances[0]?.currency !== 'USD' || legacyCashCurrency({}) !== 'USD') fail('v57.81 an undeclared legacy cash value takes the base currency, else USD (the unit the screen printed)');
  if (readCashBalances(memory({})).known !== false || readCashBalances(memory({ [PORTFOLIO_CASH_KEY]: '[]' })).known !== true) fail('v57.81 never-entered cash and cleared cash must stay distinct');
  const next = setCashBalance(first.balances, 'usd', '1200');
  const ack = writeCashBalances(legacy, next);
  const after = legacy.dump();
  if (!ack.ok || after[PORTFOLIO_CASH_KEY] !== '[{"currency":"KRW","amount":5000},{"currency":"USD","amount":1200}]' || LEGACY_CASH_KEY in after || readCashBalances(legacy).source !== 'balances') fail(`v57.81 the new model must save both balances and only then drop the legacy copy: ${JSON.stringify(after)}`);
  for (const [label, store] of [['write failure', memory({ [LEGACY_CASH_KEY]: '5000' }, { failWrite: true })], ['readback mismatch', memory({ [LEGACY_CASH_KEY]: '5000' }, { mangle: true })]]) {
    const failed = writeCashBalances(store, next);
    if (failed.ok || store.getItem(LEGACY_CASH_KEY) !== '5000') fail(`v57.81 a ${label} must keep the legacy cash copy: ${JSON.stringify(store.dump())}`);
  }
  if (JSON.stringify(setCashBalance(next, 'KRW', '')) !== '[{"currency":"USD","amount":1200}]') fail('v57.81 a blank box removes only its own currency');
  // Totals with and without FX.
  const history = [{ date: '2026-10-13', spx: 6000, usdkrw: 1340 }, { date: '2026-10-14', spx: 6010, usdkrw: 1350 }];
  const now = Date.parse('2026-10-15T03:00:00Z');
  const fx = appUsdKrwClose(history, { now });
  if (fx?.rate !== 1350 || fx.label !== 'USD/KRW 10/14 종가 기준' || appUsdKrwClose(history, { now: Date.parse('2026-11-30T00:00:00Z') }) !== null || appUsdKrwClose([], { now }) !== null) fail(`v57.81 the app USD/KRW close carries its date and a stale or missing close is refused: ${JSON.stringify(fx)}`);
  const state = { readState: 'ready', holdingsKnown: true, status: 'current', baseCurrency: 'USD', cashKnown: true, cashBalances: [{ currency: 'KRW', amount: 1350000 }, { currency: 'USD', amount: 500 }], holdings: [{ symbol: 'AAA', shares: 10, avgCost: 90, price: 100, currency: 'USD' }] };
  const withFx = derivePortfolioSurface({ state, liveData: {}, now, cashFx: fx });
  if (withFx.cash !== 1500 || withFx.totalAssets !== 2500 || withFx.cashPct !== 60 || withFx.currencyState !== 'declared-single' || withFx.cashConversion.basisLabel !== 'USD/KRW 10/14 종가 기준' || withFx.cashConversion.appRate !== 1350 || withFx.cashBalances.length !== 2) fail(`v57.81 KRW+USD cash must total in the base with the app close named: ${JSON.stringify({ cash: withFx.cash, total: withFx.totalAssets, conv: withFx.cashConversion })}`);
  const noFx = derivePortfolioSurface({ state, liveData: {}, now, cashFx: null });
  if (noFx.cash !== null || noFx.totalAssets !== null || noFx.cashHeld !== true || noFx.cashConversion.held.join() !== 'KRW' || noFx.positionValue !== 1000 || noFx.cashBalances.map((row) => row.amount).join() !== '1350000,500') fail(`v57.81 without a rate the cash total is held (never estimated) and each balance is kept: ${JSON.stringify({ cash: noFx.cash, total: noFx.totalAssets, held: noFx.cashConversion })}`);
  const declaredLeg = derivePortfolioSurface({ state: { ...state, fxLegs: [{ from: 'USD', to: 'KRW', rate: 1500, observedAt: '2026-10-14T20:00:00Z' }] }, liveData: {}, now, cashFx: fx });
  if (declaredLeg.cash !== 1400 || declaredLeg.cashConversion.basisLabel !== '선언 환율 기준') fail(`v57.81 a rate the user declared wins over the app close: ${JSON.stringify(declaredLeg.cashConversion)}`);
  const cashOnly = derivePortfolioSurface({ state: { ...state, baseCurrency: null, holdings: [] }, liveData: {}, now, cashFx: null });
  if (cashOnly.valuationState !== 'cash-only' || cashOnly.totalAssets !== null || !cashOnly.cashHeld) fail(`v57.81 two-currency cash with no rate stays a cash-only portfolio with the total held: ${JSON.stringify({ state: cashOnly.valuationState, total: cashOnly.totalAssets })}`);
  if (convertCashBalances({ balances: [{ currency: 'EUR', amount: 10 }], target: 'USD', appFx: fx }).ok !== false) fail('v57.81 the app close converts USD/KRW only; another pair without a declared rate is held');
  // Backup: the new bundle carries the balances; a pre-v57.81 bundle's single cash becomes one balance in its declared unit.
  const deps = { assumptionKinds: { baseCurrency: 'currency', cashCurrency: 'currency' }, assumptionNormalizers: { currency: (v) => (/^[A-Za-z]{3}$/.test(String(v || '').trim()) ? String(v).trim().toUpperCase() : null) } };
  const bundle = buildPortfolioBackup({ positions: [{ ticker: 'AAA', qty: 1, cost: 1 }], cashBalances: next }, { exportedAt: '2026-10-15T00:00:00Z' });
  const round = parsePortfolioBackup(JSON.stringify(bundle), deps);
  const old = parsePortfolioBackup(JSON.stringify({ format: 'aio-backup', version: 1, contents: { cash: '250000', assumptions: { cashCurrency: 'usd' } } }), deps);
  const none = parsePortfolioBackup(JSON.stringify({ format: 'aio-backup', version: 1, contents: { positions: [{ ticker: 'AAA', qty: 1, cost: 1 }] } }), deps);
  if (JSON.stringify(round.contents?.cashBalances) !== JSON.stringify(next) || !/현금 2개 통화/.test(describeBackupCounts(round.counts))
    || JSON.stringify(old.contents?.cashBalances) !== '[{"currency":"USD","amount":250000}]' || none.contents?.cashBalances !== null) fail(`v57.81 backup cash round-trip failed: ${JSON.stringify({ round: round.contents?.cashBalances, old: old.contents?.cashBalances, none: none.contents?.cashBalances })}`);
}

// v57.81 (owner 2026-10-15): a US listing outside the screener universe is read on demand with the producer's own
// functions and placed against the published universe by the same ranking model; missing inputs stay missing, an
// unlisted symbol is never fetched, two symbols load at a time and a symbol is read once per session.
{
  const pf = await load('src/domain/screener/price-factors.js');
  const secNorm = await load('src/domain/fundamental/sec-normalize.js');
  const { secFundamentalRowFields } = await load('src/domain/fundamental/sec-row-fields.js');
  const producer = await load('scripts/fetch-data.mjs');
  const factorsLib = await load('scripts/lib/factors.mjs');
  const producerMath = await load('scripts/lib/producer-math.mjs');
  const secProducer = await load('scripts/fetch-sec-fundamentals.mjs');
  const od = await load('src/data/on-demand-symbol.js');
  const { computeFactorRanks } = await load('src/domain/screener/factor-ranks.js');
  const { buildOutOfUniverseRead, OUT_OF_UNIVERSE_TITLE } = await load('src/domain/entity/out-of-universe-read.js');
  const fx = await load('scripts/lib/out-of-universe-fixtures.mjs');
  // One implementation: the producer's exports are the browser module's own function objects.
  for (const [label, a, b] of [['deriveFactorQuality', producer.deriveFactorQuality, pf.deriveFactorQuality], ['isSessionComplete', producer.isSessionComplete, pf.isSessionComplete],
    ['closesToFactors', factorsLib.closesToFactors, pf.closesToFactors], ['_calcVCPServer', factorsLib._calcVCPServer, pf._calcVCPServer], ['round', producerMath.round, pf.round],
    ['normalizeSecCompanyFacts', secProducer.normalizeSecCompanyFacts, secNorm.normalizeSecCompanyFacts]]) if (!a || a !== b) fail(`v57.81 producer ${label} must be the shared src function`);
  const producerText = readFileSync(path.join(root, 'scripts/fetch-data.mjs'), 'utf8');
  for (const call of ['dailyRowsFromYahooChart(res', 'priceHistoryFromRows(sym, fetched', 'priceFactorRow(r, { computedAt, fxSeries, indexReturns })', 'secFundamentalRowFields(row,']) if (!producerText.includes(call)) fail(`v57.81 the producer must build rows through ${call}`);
  const nowMs = Date.parse('2026-10-15T12:00:00Z');
  const computedAt = new Date(nowMs).toISOString();
  // The on-demand raw row equals the producer path run on the same chart.
  const chart = fx.chartFixture('UFPT', { nowMs, name: 'UFP Technologies' }).chart.result[0];
  const built = od.buildOnDemandArtifactRow('UFPT', chart, { nowMs });
  const fetched = pf.dailyRowsFromYahooChart(chart, { fetchedAt: computedAt });
  const direct = pf.priceFactorRow(pf.priceHistoryFromRows('UFPT', fetched, { providerMeta: fetched.meta, nullCloseDates: fetched.nullCloseDates, market: 'us', nowMs }), { computedAt });
  if (!built.raw || JSON.stringify(built.raw) !== JSON.stringify(direct)) fail('v57.81 the on-demand factor row must equal the producer factor row for the same chart');
  // A synthetic published universe (same session) built through the same provider normalization.
  const peers = [];
  for (let i = 0; i < 24; i += 1) {
    const sym = `PEER${String.fromCharCode(65 + i)}`;
    const cik = String(1000 + i).padStart(10, '0');
    // Peers carry annual filings so the quality family is active in the universe (above the 80% coverage floor).
    const raw = od.buildOnDemandArtifactRow(sym, fx.chartFixture(sym, { nowMs, drift: -0.0012 + i * 0.0001, wave: 0.02 + (i % 5) * 0.02, start: 20 + i }).chart.result[0],
      { nowMs, secFacts: fx.companyFactsFixture({ cik, name: sym, revenue: [500e6 + i * 10e6, 520e6 + i * 25e6], netIncome: [40e6 + i * 2e6, 45e6 + i * 3e6], shares: 30e6 + i * 1e6 }), secSubmissions: fx.submissionsFixture({ cik, name: sym, ticker: sym }) }).raw;
    peers.push(await od.canonicalOnDemandRow(sym, raw, { name: sym, computedAt, now: () => nowMs }));
  }
  if (peers.some((row) => !row)) fail('v57.81 fixture peers must normalize');
  const calls = { chart: [], json: [] };
  const listing = { UFPT: { listed: true, name: 'UFP Technologies', exchange: 'Q', etf: false, asOf: '2026-10-15', cik: '0000914156' }, HALO: { listed: true, name: 'Halozyme', exchange: 'Q', etf: false, asOf: '2026-10-15' } };
  const charts = { UFPT: chart, HALO: fx.chartFixture('HALO', { nowMs, drift: 0.0004 }).chart.result[0] };
  const toTransport = (result) => ({ meta: result.meta, timestamps: result.timestamp, closes: result.indicators.quote[0].close, highs: result.indicators.quote[0].high, lows: result.indicators.quote[0].low, volumes: result.indicators.quote[0].volume, adjCloses: result.indicators.adjclose[0].adjclose });
  const reader = od.createOnDemandSymbolReader({
    fetchChart: async (id) => { calls.chart.push(id); return charts[id] ? toTransport(charts[id]) : null; },
    fetchJson: async (url) => { calls.json.push(url); return /companyfacts/.test(url) ? fx.companyFactsFixture({ cik: '0000914156', name: 'UFP Technologies' }) : fx.submissionsFixture({ cik: '0000914156', name: 'UFP Technologies', ticker: 'UFPT' }); },
    isListed: async (id) => listing[id] || { listed: false, directoryAvailable: true },
    universeRows: () => peers, rankInputs: () => ({ fundamentalCoveragePct: 0, fmpOk: false }), now: () => nowMs
  });
  const ufpt = await reader.load('UFPT');
  if (ufpt?.status !== 'ready' || ufpt.secStatus !== 'ready' || !(ufpt.row.roe > 0) || ufpt.row.identitySource !== 'on-demand:us-listing') fail(`v57.81 a listed symbol with a CIK reads chart and SEC facts: ${JSON.stringify({ status: ufpt?.status, sec: ufpt?.secStatus })}`);
  if (!calls.json.every((url) => url.startsWith('https://data.sec.gov/'))) fail(`v57.81 SEC reads stay on the allowlisted data.sec.gov host: ${calls.json.join(' ')}`);
  // v57.83 (owner 2026-10-16): the SEC SIC code (fixture 3089 Plastics Products) becomes the row's sector and industry,
  // named as a classification; an unmapped or missing code stays null.
  {
    const sic = await load('src/domain/fundamental/sic-sector.js');
    if (ufpt.row.sector !== 'Materials' || !/SIC 3089/.test(ufpt.row.industry || '') || ufpt.classification?.sic !== '3089') fail(`v57.83 the on-demand row carries the SEC SIC sector: ${JSON.stringify({ sector: ufpt.row.sector, industry: ufpt.row.industry })}`);
    if (sic.sectorFromSic('3674') !== 'Technology' || sic.sectorFromSic('2834') !== 'Healthcare' || sic.sectorFromSic('6798') !== 'Real Estate' || sic.sectorFromSic('6770') !== null || sic.sectorFromSic('9995') !== null || sic.sectorFromSic('') !== null) fail('v57.83 SIC to sector keeps the documented mapping and leaves unmapped codes null');
  }
  const expected = computeFactorRanks({ rows: [...peers, ufpt.row], fundamentalCoveragePct: 0, fmpOk: false, now: nowMs, inputVersion: `${od.ON_DEMAND_MODEL_VERSION}:UFPT` }).rows.find((row) => row.sym === 'UFPT');
  if (!ufpt.placement?.available || ufpt.placement.rank !== expected?.rank || ufpt.placement.ranked !== peers.length + 1) fail(`v57.81 the placement must be the ranking model's own rank over universe + candidate: ${ufpt.placement?.rank} vs ${expected?.rank}`);
  if (ufpt.row.screenRank != null || ufpt.lastClose?.date !== ufpt.sessionDate) fail('v57.81 an on-demand row carries no published screen rank and its close keeps its session date');
  // No CIK: fundamentals stay missing (never estimated) and the read says which inputs were missing.
  const halo = await reader.load('HALO');
  if (halo?.status !== 'ready' || halo.secStatus !== 'no-cik' || halo.sec !== null) fail(`v57.81 a listing without a CIK reads no filing: ${halo?.secStatus}`);
  if (['pe', 'pb', 'roe', 'margin', 'revGrowth', 'mcap'].some((key) => halo.row[key] != null)) fail('v57.81 missing fundamentals must stay null on the on-demand row');
  const quality = halo.placement.inputs.find((input) => input.key === 'quality');
  if (!ufpt.placement.inputs.find((input) => input.key === 'quality')?.usable) fail('v57.81 fixture: the CIK-bearing candidate uses the active quality family');
  if (!quality || !quality.active || quality.usable || quality.present.length || quality.missing.length !== 3) fail(`v57.81 the quality input must be reported missing: ${JSON.stringify(quality)}`);
  const read = buildOutOfUniverseRead(halo);
  if (read.title !== OUT_OF_UNIVERSE_TITLE || read.inputs.find((input) => input.key === 'quality')?.status !== '빠짐' || !read.lines.some((line) => /요청 시 계산/.test(line))) fail('v57.81 the read labels its placement as on-demand and lists the missing inputs');
  if (calls.json.length !== 2) fail(`v57.81 only the CIK-bearing listing reads SEC (2 calls), got ${calls.json.length}`);
  // Session cache: a second ask is the same record without another fetch; unlisted and in-universe symbols never fetch.
  const before = calls.chart.length;
  if ((await reader.load('UFPT')) !== ufpt || reader.peek('UFPT') !== ufpt) fail('v57.81 a ready record is reused for the session');
  if ((await reader.load('ZZZZ'))?.status !== 'not-listed' || (await reader.load('PEERA'))?.status !== 'in-universe' || calls.chart.length !== before) fail('v57.81 unlisted / in-universe symbols must not fetch a chart');
  if (od.onDemandEligibleSymbol('005930.KS') !== null || od.onDemandEligibleSymbol('BTC-USD') !== null) fail('v57.81 KRX codes and crypto pairs are not on-demand US listings');
  // Two at a time.
  let active = 0, peak = 0;
  const slow = od.createOnDemandSymbolReader({ fetchChart: async () => { active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 5)); active -= 1; return null; },
    isListed: async () => ({ listed: true }), universeRows: () => peers, now: () => nowMs });
  const results = await Promise.all(['AAA', 'BBB', 'CCC', 'DDD', 'EEE'].map((sym) => slow.load(sym)));
  if (peak > od.ON_DEMAND_MAX_CONCURRENT || od.ON_DEMAND_MAX_CONCURRENT !== 2 || results.some((record) => record?.status !== 'unavailable' || record.reason !== 'chart-unavailable')) fail(`v57.81 on-demand reads run at most two at once (peak ${peak}) and a failed chart is unavailable, not estimated`);
  if (typeof secFundamentalRowFields !== 'function') fail('v57.81 the SEC row-field builder is shared');
}

// v57.81: a 5-session move ranked 2nd lowest of 252 rounded to 0% and read as 최저 (KOSPI -18.4% on 10/15; 7/30 was -21.2%).
{
  const { recordPercentile, recordSide } = await load('src/domain/briefing/market-read.js');
  const series = Array.from({ length: 252 }, (_, i) => ({ date: `d${i}`, value: i === 10 ? -21.2 : i === 251 ? -18.4 : (i % 17) - 5 }));
  const second = recordPercentile(series);
  if (recordSide(second) === '최저' || second.lowest !== false || recordSide(second) !== '하위 1% 이내(252거래일 중 2번째로 낮음)') fail(`v57.81 the second-lowest of 252 is not 최저: ${JSON.stringify(second)} ${recordSide(second)}`);
  const lowest = recordPercentile(series.map((point, i) => (i === 10 ? { ...point, value: 0 } : point)));
  if (recordSide(lowest) !== '최저') fail(`v57.81 the lowest of 252 still reads 최저: ${JSON.stringify(lowest)}`);
}

await import('./fixtures/architecture-lifecycle-regressions.mjs');

// v57.81 (거시 analysis audit, group X): the shared macro signal rules — dead zone, PCE·CPI direction, one Brent/WTI rule,
// the shared 4-week window and the sentiment record rank.
{
  const ms = await load('src/domain/macro/macro-signals.js');
  // Dead zone: +2bp against a 7.9bp spread of 20-session changes (band 0.5 sd = 3.95bp) is not a move.
  if (ms.bandDirection(0.02, 0.5 * 0.079) !== 'flat' || ms.bandDirection(0.2, 0.5 * 0.079) !== 'up' || ms.bandDirection(-0.05, 0.0395) !== 'down') fail('v57.81 a change counts only past 0.5 sd of its own n-period changes');
  if (ms.bandDirection(0.001, null) !== 'up' || ms.bandDirection(null, 0.1) !== null) fail('v57.81 without a band the sign decides; without a value there is no direction');
  const wave = Array.from({ length: 300 }, (_, i) => ({ date: `d${String(i).padStart(3, '0')}`, value: 2.3 + 0.05 * Math.sin(i / 4) }));
  const band = ms.changeBand(wave, 20);
  if (!band || !(band.sd > 0) || Math.abs(band.band - band.sd * 0.5) > 1e-12 || band.samples !== 252) fail(`v57.81 changeBand is 0.5 sd over one year of 20-observation changes: ${JSON.stringify(band)}`);
  if (ms.changeBand(wave.slice(0, 30), 20) !== null) fail('v57.81 fewer than 20 changes give no band');
  // PCE slowing (8월 2.05 vs 3.01) and CPI re-accelerating (9월 3.41 vs 2.57) is 엇갈림 with both months named.
  const mixed = ms.inflationDirection({ pce: { pace: 2.05, yoy: 3.01, date: '2026-08-01' }, cpi: { pace: 3.41, yoy: 2.57, date: '2026-09-01' } });
  if (mixed.state !== 'mixed' || mixed.dir !== null || mixed.label !== '엇갈림' || !/근원 PCE\(8월\) 둔화/.test(mixed.text) || !/근원 CPI\(9월\) 재가속/.test(mixed.text) || !mixed.anyUp) fail(`v57.81 PCE slowing with CPI re-accelerating is 엇갈림: ${JSON.stringify(mixed)}`);
  if (ms.inflationDirection({ pce: { pace: 2.0, yoy: 3.0 }, cpi: { pace: 2.0, yoy: 2.8 } }).dir !== 'down') fail('v57.81 both measures slowing past the step is 둔화');
  if (ms.inflationDirection({ pce: { pace: 3.6, yoy: 3.0 }, cpi: { pace: 2.9, yoy: 2.8 } }).state !== 'flat') fail('v57.81 one measure past the step and the other flat is held, not a direction');
  if (ms.inflationDirection({ pce: { pace: 2.5, yoy: 3.0 } }).dir !== 'down' || ms.inflationDirection({}).state !== 'unknown') fail('v57.81 one published measure decides alone; none is unknown');
  // One Brent/WTI rule.
  const base = { basis: 'futures', abnormal: false, diverges: false };
  if (!ms.oilDivergence({ ...base, brent20: 0.2, wti20: -7.2 }).held) fail('v57.81 Brent +0.2% beside WTI −7.2% holds the WTI read');
  if (ms.oilDivergence({ ...base, brent20: -1, wti20: -8 }).kind !== 'unconfirmed') fail('v57.81 a WTI fall Brent does not follow by half is unconfirmed');
  if (ms.oilDivergence({ ...base, brent20: -6, wti20: -8 }).held || ms.oilDivergence({ ...base, basis: 'spot', brent20: 5, wti20: -8 }).held) fail('v57.81 a confirmed move, or a spot Brent, does not hold the WTI read');
  if (!ms.oilDivergence({ abnormal: true }).held) fail('v57.81 an abnormal same-day gap holds every oil read');
  const day = (i) => new Date(Date.UTC(2026, 0, 2) + i * 86400000).toISOString().slice(0, 10);
  const wti = Array.from({ length: 60 }, (_, i) => ({ date: day(i), value: i < 39 ? 100 : 100 * (1 - 0.072 * (i - 39) / 20) }));
  const brent = wti.map((row, i) => ({ date: row.date, value: i < 39 ? 103.4 : 103.4 * (1 + 0.002 * (i - 39) / 20) }));
  const fromSeries = ms.brentWtiFromSeries({ brent, wti });
  if (!fromSeries?.held || Math.abs(fromSeries.wti20 + 7.2) > 0.01 || !(fromSeries.spread > 10) || Math.abs(fromSeries.spread20Back - 3.4) > 0.01) fail(`v57.81 brentWtiFromSeries (the helper market-read wires) holds the 10/14 pair: ${JSON.stringify(fromSeries)}`);
  // Shared 4-week window on a weekly series (a session count read one week).
  const weekly = Array.from({ length: 10 }, (_, i) => ({ date: new Date(Date.UTC(2026, 6, 3) + i * 7 * 86400000).toISOString().slice(0, 10), value: -0.6 + 0.0125 * i }));
  if (Math.abs(ms.changeOverDays(weekly, 28).value - 0.05) > 1e-9) fail('v57.81 changeOverDays reads the 4-week change of a weekly series');
  // Survey rebased on its own record, with its month.
  const survey = Array.from({ length: 36 }, (_, i) => ({ date: `${2023 + Math.floor((i + 9) / 12)}-${String(((i + 9) % 12) + 1).padStart(2, '0')}-01`, value: 50 + (i % 10) }));
  const rank = ms.sentimentRank(survey);
  if (!rank || rank.month !== `${Number(survey.at(-1).date.slice(5, 7))}월` || !(rank.percentile >= 0 && rank.percentile <= 100)) fail(`v57.81 sentimentRank names the month and a percentile: ${JSON.stringify(rank)}`);
  if (ms.sentimentRank(survey.slice(-10)).percentile !== null) fail('v57.81 fewer than 24 releases give no percentile');
}
