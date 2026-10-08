// P1518: adversarial schedules exercise ownership rather than renderer details.
import assert from 'node:assert/strict';
import { createLifecycleRouter, createRouteRegistry, createLazyPage } from '../../src/app/router.js';
import { createCompatibilityEventAdapter } from '../../src/app/compatibility-events.js';
import { createEntityProvider } from '../../src/data/providers/entity.js';
import { createEntityOrchestrator } from '../../src/data/orchestrators/entity.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
for (const lazy of [false, true]) {
  const target = new EventTarget();
  const committed = [];
  const released = [];
  target.addEventListener('aio:navigationCommitted', event => committed.push(event.detail.routeId));
  let router;
  const home = { mount() { router.transition('signal'); return () => released.push('home'); } };
  router = createLifecycleRouter({ root: target, registry: createRouteRegistry({ modules: {
    home: lazy ? createLazyPage({ route: 'home', loader: async () => home, factory: page => page }) : home,
    signal: { mount: () => () => released.push('signal') }
  } }) });
  router.transition('home');
  await tick();
  assert.equal(router.active(), 'signal', 'P1518 newer transition owns active state');
  assert.deepEqual(committed, lazy ? ['home', 'signal'] : ['signal'], 'P1518 obsolete synchronous mount cannot commit');
  assert.deepEqual(released, ['home'], 'P1518 displaced mount releases its late disposer');
  router.dispose();
  assert.deepEqual(released, ['home', 'signal'], 'P1518 newer disposer survives');
}

for (const mode of ['cleanup-navigation', 'mount-throw', 'mount-dispose']) {
  const target = new EventTarget();
  const released = [];
  let router;
  router = createLifecycleRouter({ root: target, registry: createRouteRegistry({ modules: {
    home: { mount() {
      if (mode === 'mount-throw') { router.transition('signal'); throw new Error('old-mount'); }
      if (mode === 'mount-dispose') router.dispose();
      return () => { released.push('home'); if (mode === 'cleanup-navigation') router.transition('signal'); };
    } },
    signal: { mount: () => () => released.push('signal') },
    breadth: { mount: () => { throw new Error('obsolete mount must not execute'); } }
  } }) });
  if (mode === 'mount-throw') assert.throws(() => router.transition('home'), /old-mount/, 'P1518 original error remains visible');
  else router.transition('home');
  if (mode === 'cleanup-navigation') assert.equal(router.transition('breadth'), false, 'P1518 cleanup navigation supersedes outer transition');
  assert.equal(router.active(), mode === 'mount-dispose' ? null : 'signal', 'P1518 obsolete cleanup cannot reset newer route');
  router.dispose();
  assert.deepEqual(released, mode === 'mount-dispose' ? ['home'] : mode === 'mount-throw' ? ['signal'] : ['home', 'signal'], 'P1518 all surviving resources released once');
}

{
  const root = new EventTarget();
  const errors = [];
  const calls = [];
  const events = createCompatibilityEventAdapter({ root, onError: error => errors.push(error.message) });
  events.on('refresh', () => { throw new Error('sync-consumer'); });
  events.on('refresh', async () => { throw new Error('async-consumer'); });
  events.on('refresh', () => calls.push('healthy'));
  root.dispatchEvent(new Event('refresh'));
  await tick();
  assert.deepEqual(calls, ['healthy'], 'P1518 failed consumer does not block siblings');
  assert.deepEqual(errors.sort(), ['async-consumer', 'sync-consumer'], 'P1518 sync and async errors are observable');
  events.dispose();
  root.dispatchEvent(new Event('refresh'));
  assert.equal(calls.length, 1, 'P1518 disposed bridge has no remaining consumers');
}

{
  // P1526: a listener removed during a dispatch is not called, as with a native EventTarget.
  const root = new EventTarget();
  const calls = [];
  const events = createCompatibilityEventAdapter({ root });
  let removeSecond;
  events.on('refresh', () => { calls.push('first'); removeSecond(); });
  removeSecond = events.on('refresh', () => calls.push('second'));
  root.dispatchEvent(new Event('refresh'));
  assert.deepEqual(calls, ['first'], 'P1526 a listener removed mid-dispatch is not called');
  root.dispatchEvent(new Event('refresh'));
  assert.deepEqual(calls, ['first', 'first'], 'P1526 a removed listener stays removed');
  events.dispose();
}

{
  // P1526: details that differ only in Date, Map or Set values are different logical events; a plain duplicate still collapses.
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  const count = (detailForWindow, detailForDocument) => {
    let deliveries = 0;
    const events = createCompatibilityEventAdapter({ root: windowTarget, eventTarget: documentTarget, now: () => 1000 });
    events.on('refresh', () => { deliveries += 1; });
    windowTarget.dispatchEvent(new CustomEvent('refresh', { detail: detailForWindow }));
    documentTarget.dispatchEvent(new CustomEvent('refresh', { detail: detailForDocument }));
    events.dispose();
    return deliveries;
  };
  assert.equal(count({ at: new Date(1) }, { at: new Date(2) }), 2, 'P1526 different Date details are not merged');
  assert.equal(count({ at: new Date(1) }, { at: new Date(1) }), 1, 'P1526 an identical Date detail from both targets is one event');
  assert.equal(count({ ids: new Set([1]) }, { ids: new Set([2]) }), 2, 'P1526 different Set details are not merged');
  assert.equal(count({ by: new Map([['a', 1]]) }, { by: new Map([['a', 2]]) }), 2, 'P1526 different Map details are not merged');
  assert.equal(count({ symbol: 'AAPL' }, { symbol: 'AAPL' }), 1, 'P1526 a plain identical detail from both targets is still one event');
  assert.equal(count({ symbol: 'AAPL' }, { symbol: 'MSFT' }), 2, 'P1526 different plain details are two events');
}

{
  let now = 0;
  let symbol = 'AAPL';
  const requests = [];
  const provider = createEntityProvider({ read: () => ({ id: symbol }), now: () => now, cacheTtlMs: 50,
    httpClient: { requestJson: (url, options) => new Promise(resolve => requests.push({ options, resolve })) }
  });
  const committed = [];
  const orchestrator = createEntityOrchestrator({ provider, commands: { setData: data => committed.push(data) } });
  const old = new AbortController();
  const first = orchestrator.sync({ scope: { signal: old.signal, isCurrent: () => !old.signal.aborted } });
  await tick();
  symbol = 'MSFT';
  const second = orchestrator.sync({ scope: { isCurrent: () => true } });
  old.abort();
  now = 100; // A slow response must not age an unsettled entry out of single-flight.
  const third = provider.readCurrent();
  assert.equal(requests.length, 1, 'P1518 shared request survives route cancellation and elapsed TTL');
  assert.equal(requests[0].options.signal, undefined, 'P1518 route cannot own shared transport');
  requests[0].resolve({ ok: true, data: { data: { AAPL: { symbol: 'AAPL' }, MSFT: { symbol: 'MSFT', revenue: 42 } } } });
  await Promise.all([first, second, third]);
  assert.equal(committed.length, 1, 'P1518 obsolete generation never publishes');
  assert.equal(committed[0].id, 'MSFT', 'P1518 latest entity remains selected');
  assert.equal(committed[0].fundamentals.revenue, 42, 'P1518 cancelled predecessor cannot empty latest fundamentals');
  now = 149;
  await provider.readCurrent();
  assert.equal(requests.length, 1, 'P1518 TTL starts at successful completion');
  now = 150;
  const expired = provider.readCurrent();
  await tick();
  assert.equal(requests.length, 2, 'P1518 TTL expiration refetches');
  requests[1].resolve({ ok: false, error: 'HTTP_TIMEOUT' });
  await expired;
  const retry = provider.readCurrent();
  await tick();
  assert.equal(requests.length, 3, 'P1518 failure is never cached as a valid empty artifact');
  requests[2].resolve({ ok: true, data: { data: {} } });
  await retry;
}
