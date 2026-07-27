// ARX-04: fundamentals now come from a real fetch (public-data/sec-fundamentals.json via the
// platform httpClient gateway) instead of legacy's `_fundAnalysisData` global, which in practice
// is only ever populated by the AI-chat ticker-analysis flow (js/aio-chat.js) and stays null for
// ordinary page browsing — this fetch is a strict improvement, not a behavior change, for the
// entity route's fundamentals field. id/quote/options still come from the injected `read`
// callback (legacy projection) — those are out of scope for this slice (see session card).
export function createEntityProvider({ read = () => ({}), httpClient, fundamentalsUrl = './public-data/sec-fundamentals.json' } = {}) {
  let fundamentalsTablePromise = null; // fetched once per provider lifetime; sec-fundamentals.json refreshes daily server-side

  function loadFundamentalsTable({ signal } = {}) {
    if (fundamentalsTablePromise) return fundamentalsTablePromise;
    if (!httpClient || typeof httpClient.requestJson !== 'function') return (fundamentalsTablePromise = Promise.resolve({}));
    fundamentalsTablePromise = httpClient.requestJson(fundamentalsUrl, { cache: 'no-store', signal }).then((response) => {
      return response.ok && response.data && typeof response.data.data === 'object' ? response.data.data : {};
    });
    return fundamentalsTablePromise;
  }

  return Object.freeze({
    async readCurrent({ signal } = {}) {
      const value = read() || {};
      const id = value.id ? String(value.id).toUpperCase() : null;
      const table = await loadFundamentalsTable({ signal });
      const fetchedFundamentals = id && table[id] ? { ...table[id] } : null;
      return Object.freeze({
        id,
        name: value.name || id,
        quote: value.quote || null,
        fundamentals: fetchedFundamentals || value.fundamentals || null,
        options: value.options || null,
        updatedAt: value.updatedAt || new Date().toISOString()
      });
    }
  });
}
