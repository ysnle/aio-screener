// ARX-04/P977: fundamentals come from the bounded current-facts projection via the
// platform httpClient gateway) instead of legacy's `_fundAnalysisData` global, which in practice
// is only ever populated by the AI-chat ticker-analysis flow (js/aio-chat.js) and stays null for
// ordinary page browsing — this fetch is a strict improvement, not a behavior change, for the
// entity route's fundamentals field. id/quote/options still come from the injected `read`
// callback (legacy projection) — those are out of scope for this slice (see session card).
const DEFAULT_FUNDAMENTAL_WATCHLIST = Object.freeze(['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO']);

function latestObservedAt(values = []) {
  const times = values.map((value) => Date.parse(value || '')).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

function lastHistoryObservedAt(history = []) {
  const row = Array.isArray(history) && history.length ? history[history.length - 1] || {} : {};
  return row.observedAt || row.date || row.time || row.timestamp || null;
}

export function createEntityProvider({ read = () => ({}), httpClient, fundamentalsUrl = './public-data/sec-fundamentals-summary.json', fundamentalWatchlist = DEFAULT_FUNDAMENTAL_WATCHLIST, now = () => Date.now(), cacheTtlMs = 30 * 60 * 1000 } = {}) {
  let fundamentalsTablePromise = null; // TTL cache: long-lived tabs re-read the server artifact after refresh.
  let fundamentalsLoadedAt = 0;

  function loadFundamentalsTable({ signal } = {}) {
    if (fundamentalsTablePromise && now() - fundamentalsLoadedAt < cacheTtlMs) return fundamentalsTablePromise;
    if (!httpClient || typeof httpClient.requestJson !== 'function') return (fundamentalsTablePromise = Promise.resolve({ table: {}, meta: null }));
    fundamentalsLoadedAt = now();
    fundamentalsTablePromise = httpClient.requestJson(fundamentalsUrl, { cache: 'no-store', signal }).then((response) => {
      if (response.ok && response.data && response.data.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data)) {
        return {
          table: response.data.data,
          meta: Object.freeze({
            generatedAt: response.data.generatedAt || null,
            source: response.data.source || 'SEC EDGAR companyfacts',
            sourceUrl: response.data.sourceUrl || null,
            sourceTier: response.data.sourceTier || 'official-regulator',
            model: response.data.model || null,
            eligible: Number.isFinite(response.data.eligible) ? response.data.eligible : null,
            stored: Number.isFinite(response.data.stored) ? response.data.stored : null
          })
        };
      }
      // HTTP_ABORTED/timeout/non-2xx and malformed payloads are transient load
      // outcomes, not a valid empty fundamentals artifact. Clear immediately so
      // the next route sync can retry instead of pinning `{}` for the full TTL.
      fundamentalsTablePromise = null;
      fundamentalsLoadedAt = 0;
      return { table: {}, meta: null };
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
      const projection = await loadFundamentalsTable({ signal });
      const table = projection?.table || {};
      const fetchedFundamentals = id && table[id] ? { ...table[id] } : null;
      const fundamentals = fetchedFundamentals || value.fundamentals || null;
      const fundamentalsWatchlist = [...new Set((Array.isArray(fundamentalWatchlist) ? fundamentalWatchlist : DEFAULT_FUNDAMENTAL_WATCHLIST)
        .map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean))]
        .map((symbol) => table[symbol] ? { ...table[symbol] } : null)
        .filter(Boolean);
      const history = Array.isArray(value.history) ? value.history : [];
      return Object.freeze({
        id,
        name: value.name || id,
        quote: value.quote || null,
        history,
        fundamentals,
        fundamentalsWatchlist,
        fundamentalsMeta: projection?.meta || null,
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
