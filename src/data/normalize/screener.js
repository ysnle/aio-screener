function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

export function normalizeScreener(raw = {}) {
  const rows = Array.isArray(raw.rows) ? raw.rows.map((row) => ({
    symbol: String(row?.symbol || row?.sym || '').toUpperCase(),
    name: row?.name || row?.company || '',
    score: finite(row?.score),
    rank: finite(row?.rank),
    sector: row?.sector || null,
    source: row?.source || 'screener-artifact',
    price: finite(row?.price),
    rsi: finite(row?.rsi),
    ret1m: finite(row?.ret1m),
    ret3m: finite(row?.ret3m),
    ret6m: finite(row?.ret6m)
  })).filter((row) => row.symbol) : [];
  return Object.freeze({ rows, filters: raw.filters || {}, revision: raw.revision || null, status: raw.status || (rows.length ? 'current' : 'unavailable'), updatedAt: raw.updatedAt || new Date().toISOString() });
}
