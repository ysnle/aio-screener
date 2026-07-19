export function normalizeScreener(raw = {}) {
  const rows = Array.isArray(raw.rows) ? raw.rows.map((row) => ({
    symbol: String(row?.symbol || row?.sym || '').toUpperCase(),
    name: row?.name || row?.company || '',
    score: typeof row?.score === 'number' ? row.score : null,
    rank: Number.isFinite(Number(row?.rank)) ? Number(row.rank) : null,
    sector: row?.sector || null,
    source: row?.source || 'screener-artifact'
  })).filter((row) => row.symbol) : [];
  return Object.freeze({ rows, filters: raw.filters || {}, revision: raw.revision || null, status: raw.status || (rows.length ? 'current' : 'unavailable'), updatedAt: raw.updatedAt || new Date().toISOString() });
}
