// ARX-04: fundamentals now come from a real fetch (public-data/sec-fundamentals.json via the
// platform httpClient gateway) instead of legacy's `_fundAnalysisData` global, which in practice
// is only ever populated by the AI-chat ticker-analysis flow (js/aio-chat.js) and stays null for
// ordinary page browsing — this fetch is a strict improvement, not a behavior change, for the
// entity route's fundamentals field. id/quote/options still come from the injected `read`
// callback (legacy projection) — those are out of scope for this slice (see session card).
function latestObservedAt(values = []) {
  const times = values.map((value) => Date.parse(value || '')).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

function lastHistoryObservedAt(history = []) {
  const row = Array.isArray(history) && history.length ? history[history.length - 1] || {} : {};
  return row.observedAt || row.date || row.time || row.timestamp || null;
}

export function createEntityProvider({ read = () => ({}), httpClient, fundamentalsUrl = './public-data/sec-fundamentals.json', now = () => Date.now(), cacheTtlMs = 30 * 60 * 1000 } = {}) {
  let fundamentalsTablePromise = null; // TTL cache: long-lived tabs re-read the server artifact after refresh.
  let fundamentalsLoadedAt = 0;

  function loadFundamentalsTable({ signal } = {}) {
    if (fundamentalsTablePromise && now() - fundamentalsLoadedAt < cacheTtlMs) return fundamentalsTablePromise;
    if (!httpClient || typeof httpClient.requestJson !== 'function') return (fundamentalsTablePromise = Promise.resolve({}));
    fundamentalsLoadedAt = now();
    fundamentalsTablePromise = httpClient.requestJson(fundamentalsUrl, { cache: 'no-store', signal }).then((response) => {
      return response.ok && response.data && typeof response.data.data === 'object' ? response.data.data : {};
    }).catch((error) => {
      fundamentalsTablePromise = null;
      fundamentalsLoadedAt = 0;
      throw error;
    });
    return fundamentalsTablePromise;
  }

  return Object.freeze({
    async readCurrent({ signal } = {}) {
      const value = read() || {};
      const id = value.id ? String(value.id).toUpperCase() : null;
      const table = await loadFundamentalsTable({ signal });
      const fetchedFundamentals = id && table[id] ? { ...table[id] } : null;
      const fundamentals = fetchedFundamentals || value.fundamentals || null;
      const history = Array.isArray(value.history) ? value.history : [];
      return Object.freeze({
        id,
        name: value.name || id,
        quote: value.quote || null,
        history,
        fundamentals,
        options: value.options || null,
        updatedAt: latestObservedAt([
          value.quote?.observedAt,
          lastHistoryObservedAt(history),
          fundamentals?.observedAt,
          fundamentals?.filedAt,
          value.options?.vix?.observedAt,
          value.options?.pcr?.observedAt,
          value.options?.skew?.observedAt
        ])
      });
    }
  });
}
