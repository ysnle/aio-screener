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
const { createRouteRegistry, createLifecycleRouter } = await load('src/app/router.js');
const { createResourceBag } = await load('src/app/lifecycle.js');
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

// ── router.js ────────────────────────────────────────────────────────────────────────────────
{
  const mountLog = [];
  const disposeLog = [];
  const makePage = (route) => ({
    route,
    mount: () => { mountLog.push(route); return () => disposeLog.push(route); }
  });
  const registry = createRouteRegistry({ modules: { home: makePage('home'), signal: makePage('signal') } });
  if (typeof registry.home?.mount !== 'function') fail('router: createRouteRegistry did not wire the provided home module');
  if (typeof registry.guide?.mount !== 'function') fail('router: createRouteRegistry did not fall back to a default page for an unprovided registered route id');
  const target = new EventTarget();
  const router = createLifecycleRouter({ root: target, registry, context: {} });
  const started = router.start();
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'home' }));
  if (started.active() !== 'home' || mountLog.join(',') !== 'home') fail('router: pageShown event did not transition into the home route');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'home' }));
  if (mountLog.join(',') !== 'home') fail('router: transitioning to the already-active route must be a no-op, not remount');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'signal' }));
  if (started.active() !== 'signal' || disposeLog.join(',') !== 'home' || mountLog.join(',') !== 'home,signal') fail('router: transitioning away must dispose the previous route before mounting the next');
  target.dispatchEvent(new CustomEvent('aio:pageShown', { detail: 'not-a-real-route' }));
  if (started.active() !== 'signal') fail('router: an unknown route id must not change the active route');
  started.dispose();
  if (disposeLog.join(',') !== 'home,signal') fail('router: router.dispose() must dispose the currently active route');
  if (started.active() !== null) fail('router: active() must be null after dispose()');
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

// ── compatibility-facade.js ──────────────────────────────────────────────────────────────────
{
  const facade = createLegacyFacade({}, new EventTarget());
  const emptySentiment = facade.readSentiment();
  if (emptySentiment.fearGreed !== null || emptySentiment.fearGreedSourceKind !== 'unavailable') fail('facade: readSentiment on an empty root must report fail-closed unavailable, not throw or guess a value');
  const withData = createLegacyFacade({ _liveData: { '^VIX': { price: 17.5 } } }, new EventTarget());
  if (withData.readSentiment().vix !== 17.5) fail('facade: readSentiment did not read a present _liveData quote');
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
}

// ── domain/signal/trading-score.js: signal envelope ──────────────────────────────────────────
{
  const { computeTradingScoreModel, deriveSignalDecisionFromTradingScore } = await load('src/domain/signal/trading-score.js');
  const score = computeTradingScoreModel({ mode: 'swing', vix: 18, vvix: 90, dxy: 100, tnx: 3.5, oilPrice: 80, fg: 50, maCurrent: true, spx200ma: 450, spx50ma: 480, spxPrice: 500, breadthAvailable: true, breadth200: 60, pcr: 1, hyBp: 300, newsSentimentScore: 50, newsRiskSignals: [] });
  const signal = deriveSignalDecisionFromTradingScore({ score, inputVersion: 'unit.v1' });
  if (signal.modelVersion !== 'signal-from-trading-score.v1' || signal.score !== score.total || signal.action !== 'WATCH' || signal.status !== 'current') fail(`signal: canonical trading-score mapping drifted, got ${JSON.stringify(signal)}`);
  const blocked = deriveSignalDecisionFromTradingScore({ score: computeTradingScoreModel({}), inputVersion: 'unit.v1' });
  if (blocked.status !== 'blocked' || blocked.action !== 'WAIT' || blocked.score !== null) fail(`signal: missing score inputs must fail closed, got ${JSON.stringify(blocked)}`);
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

  // NaN row must count as eligible (has a typeof 'number' ret1m/ret3m, even though the value
  // itself is NaN) but must not corrupt the sector's mean/stddev used for the OTHER rows' z-scores.
  {
    const cleanRows = [1, 2, 3, 4, 5, 6].map((seed) => baseRow('S' + seed, 'Tech', seed));
    const withNaN = [...cleanRows, { sym: 'NANROW', sector: 'Tech', ret1m: NaN, ret3m: NaN, ret6m: NaN, pctSma50: NaN, pctSma200: NaN, vol: NaN, kalmanVelConf: NaN }];
    const withoutNaN = computeFactorRanks({ rows: cleanRows, now: 0 });
    const withNaNResult = computeFactorRanks({ rows: withNaN, now: 0 });
    if (withNaNResult.ranked !== 7) fail(`factor-ranks: a NaN-valued row must still count as eligible (typeof NaN === 'number'), got ranked=${withNaNResult.ranked}`);
    const nanRowResult = withNaNResult.rows.find((r) => r.sym === 'NANROW');
    if (!nanRowResult || nanRowResult._z_momentum !== 0) fail(`factor-ranks: a NaN row's own z-score must be winz-guarded to 0, not NaN, got ${JSON.stringify(nanRowResult)}`);
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
    if (tieA.rank > tieB.rank) fail(`factor-ranks: tied rows must keep input order (TIE_A before TIE_B) via a stable sort with no added tiebreaker, got ranks ${tieA.rank}/${tieB.rank}`);
  }
}

console.log(JSON.stringify({ ok: true, modules: ['store', 'lifecycle', 'router', 'evidence-store', 'compatibility-facade', 'orchestrators/screener', 'orchestrators/entity', 'domain/market/breadth', 'domain/technical/stage:deriveTechnicalStageFromOhlcv', 'domain/screener/factor-ranks:computeFactorRanks'] }));
