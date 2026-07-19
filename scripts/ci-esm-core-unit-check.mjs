import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// RM-05 item 3: minimal isolated unit contracts for the new ESM core (store/router/lifecycle/
// evidence-store/facade). ci-architecture-contract-check.mjs already exercises these together in
// realistic wiring (route modules, providers, orchestrators); this file tests each module's OWN
// contract in isolation, independent of any specific route or provider, so a regression in one
// module's basic behavior is traceable without the noise of the full integration fixture.
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

console.log(JSON.stringify({ ok: true, modules: ['store', 'lifecycle', 'router', 'evidence-store', 'compatibility-facade'] }));
