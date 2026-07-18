function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  return JSON.parse(JSON.stringify(value));
}

function readLegacy(root) {
  const live = root?._liveData || {};
  const snapshot = root?.DATA_SNAPSHOT || {};
  const canonicalFg = typeof root?.AIO?.getCanonicalMetric === 'function' ? root.AIO.getCanonicalMetric('fg') : null;
  const fg = finite(canonicalFg?.value) ?? finite(root?._lastFG) ?? finite(snapshot.fg);
  const quote = (symbol) => finite(live[symbol]?.price);
  return Object.freeze({
    fearGreed: fg,
    vix9d: quote('^VIX9D'),
    vix: quote('^VIX'),
    vix3m: quote('^VIX3M'),
    vix6m: quote('^VIX6M'),
    now: new Date().toISOString()
  });
}

export function createLegacyFacade(root = globalThis, eventTarget = root?.document || root) {
  return Object.freeze({
    readSentiment: () => readLegacy(root),
    readRoute: () => root?.AIO?.state?.activePage || null,
    readVersion: () => root?.APP_VERSION || root?.AIO?.APP_VERSION || null,
    on: (eventName, listener) => {
      if (typeof eventTarget?.addEventListener !== 'function') return () => {};
      eventTarget.addEventListener(eventName, listener);
      return () => eventTarget.removeEventListener(eventName, listener);
    }
  });
}

export function exposeArchitecture(root, api) {
  if (!root || !api) return;
  Object.defineProperty(root, 'AIO_ARCH', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      status: 'MIGRATION_IN_PROGRESS',
      version: api.version,
      getState: api.getState,
      getEvidence: api.getEvidence,
      getSentimentSummary: api.getSentimentSummary,
      getAIContext: api.getAIContext,
      router: api.router
    })
  });
}
