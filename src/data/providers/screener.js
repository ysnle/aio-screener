// ARX-04 first slice: this provider owns a real fetch (via the platform httpClient gateway)
// instead of projecting legacy's `SCREENER_DB` global. It intentionally does not replicate
// `_aioComputeFactorRanks`' ranking algorithm (js/aio-data.js) — that stays the single
// implementation there (R352) — so `score`/`rank`/`sector`/`name` are left null/empty here; only
// the raw per-symbol factor fields that `public-data/screener.json` itself carries are surfaced.
export function createScreenerProvider({ httpClient, url = './public-data/screener.json', clock = { iso: () => new Date().toISOString() } } = {}) {
  if (!httpClient || typeof httpClient.requestJson !== 'function') throw new Error('SCREENER_HTTP_CLIENT_INVALID');
  const STALE_AFTER_DAYS = 7; // matches legacy _aioApplyServerScreener's freshness gate

  return Object.freeze({
    async readCurrent() {
      const response = await httpClient.requestJson(url, { cache: 'no-store' });
      const unavailable = (revision = null) => Object.freeze({ rows: [], filters: {}, revision, status: 'unavailable', updatedAt: clock.iso() });
      if (!response.ok || !response.data || typeof response.data !== 'object') return unavailable();

      const sd = response.data;
      const asOfMs = sd.asOf ? new Date(sd.asOf).getTime() : 0;
      const ageDays = asOfMs ? (Date.now() - asOfMs) / 86400000 : Infinity;
      if (!sd.data || typeof sd.data !== 'object' || ageDays > STALE_AFTER_DAYS) return unavailable(sd.asOf || null);

      const rows = Object.entries(sd.data).map(([symbol, factors]) => ({
        symbol: String(symbol || '').toUpperCase(),
        name: '',
        score: null,
        rank: null,
        sector: null,
        source: 'screener-artifact',
        price: typeof factors?.price === 'number' ? factors.price : null,
        rsi: typeof factors?.rsi === 'number' ? factors.rsi : null,
        ret1m: typeof factors?.ret1m === 'number' ? factors.ret1m : null,
        ret3m: typeof factors?.ret3m === 'number' ? factors.ret3m : null,
        ret6m: typeof factors?.ret6m === 'number' ? factors.ret6m : null
      })).filter((row) => row.symbol);

      return Object.freeze({ rows, filters: {}, revision: sd.asOf || null, status: rows.length ? 'current' : 'unavailable', updatedAt: sd.asOf || clock.iso() });
    }
  });
}
