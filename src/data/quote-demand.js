// v59.74 (state-machine audit, deepening): the one owner of live quote requests. 12 call sites used to call the provider
// fetch directly, with coalescing, symbols, retry and status spread over five globals; a call made during a fetch lost
// its symbols (SM-04b). Interface: request(symbols?) -> Promise<result>, register(symbol), state(). Invariants: one fetch
// at a time; covered symbols join it, new ones share one follow-up fetch; registered symbols join every fetch; at most one
// retry, cancelled by any fetch and skipped while hidden; every outcome reaches onOutcome. `fetchQuotes(symbols,
// { failures })` is injected (js/aio-data.js in the page, an offline stand-in in the gate) and reports `retryAfterMs`.
const norm = (list) => (Array.isArray(list) ? list : [])
  .map((sym) => String(sym || '').trim().toUpperCase())
  .filter(Boolean);

export function createQuoteDemand({ fetchQuotes, onOutcome = () => {}, isHidden = () => false, timers = globalThis, base = [] } = {}) {
  const registered = new Set(norm(base));
  let running = null; // { symbols, promise }
  let queued = null; // { symbols, promise, resolve }
  let retryTimer = null;
  let failures = 0;

  const cancelRetry = () => { if (retryTimer != null) timers.clearTimeout(retryTimer); retryTimer = null; };
  const settle = (result) => {
    const outcome = result && typeof result === 'object' ? result : { ok: false, updated: false, status: 'failed', error: 'quote fetch returned no result' };
    failures = outcome.ok ? 0 : failures + 1;
    if (!outcome.ok && Number(outcome.retryAfterMs) > 0) { // start() already cancelled any earlier retry
      retryTimer = timers.setTimeout(() => { retryTimer = null; if (!isHidden()) request(); }, Number(outcome.retryAfterMs));
    }
    try { onOutcome(outcome); } catch (_) {}
    return outcome;
  };
  function start(symbols) {
    cancelRetry();
    const want = new Set([...symbols, ...registered]);
    const run = { symbols: want };
    run.promise = Promise.resolve()
      .then(() => fetchQuotes([...want], { failures }))
      .catch((error) => ({ ok: false, updated: false, status: 'failed', error: 'quote fetch threw: ' + (error && error.message || error) }))
      .then(settle)
      .finally(() => {
        running = null;
        if (queued) {
          const next = queued;
          queued = null;
          start([...next.symbols]).then(next.resolve);
        }
      });
    running = run;
    return run.promise;
  }
  function request(symbols) {
    const want = norm(symbols);
    if (!running) return start(want);
    const missing = want.filter((sym) => !running.symbols.has(sym));
    if (!missing.length) return running.promise;
    if (!queued) {
      queued = { symbols: new Set() };
      queued.promise = new Promise((resolve) => { queued.resolve = resolve; });
    }
    missing.forEach((sym) => queued.symbols.add(sym));
    return queued.promise;
  }
  return Object.freeze({
    request,
    register(symbol) { norm([symbol]).forEach((sym) => registered.add(sym)); },
    state() {
      return { running: !!running, queued: queued ? [...queued.symbols] : [], retryPending: retryTimer != null, failures, registered: [...registered] };
    }
  });
}

// fetchLiveQuotes keeps its name and signature as the seam; the demand sits behind it.
export function installQuoteDemand(root = globalThis, { onOutcome = () => {} } = {}) {
  if (root.__aioQuoteDemand) return root.__aioQuoteDemand;
  const demand = createQuoteDemand({
    fetchQuotes: (symbols, attempt) => (typeof root._aioFetchLiveQuotesOnce === 'function'
      ? root._aioFetchLiveQuotesOnce(symbols, attempt)
      : { ok: false, updated: false, status: 'failed', error: 'quote provider not loaded' }),
    onOutcome,
    isHidden: () => !!root.document?.hidden,
    timers: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
    base: root._aioQuoteRequestSymbols // AIO.registerLiveSymbol's buffer from before this install
  });
  delete root._aioQuoteRequestSymbols;
  root.__aioQuoteDemand = demand;
  root.fetchLiveQuotes = (symbols) => demand.request(symbols);
  return demand;
}
