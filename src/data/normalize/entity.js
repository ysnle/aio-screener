function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeEntity(raw = {}) {
  const quote = raw.quote ? { value: finite(raw.quote.value), pct: finite(raw.quote.pct), observedAt: raw.quote.observedAt || null, source: raw.quote.source || 'entity-provider' } : null;
  const history = Array.isArray(raw.history)
    ? raw.history.map((row) => ({
      time: row?.time || row?.date || null,
      open: finite(row?.open), high: finite(row?.high), low: finite(row?.low), close: finite(row?.close), volume: finite(row?.volume)
    })).filter((row) => row.time && row.close != null)
    : [];
  return Object.freeze({ id: raw.id ? String(raw.id).toUpperCase() : null, name: raw.name ? String(raw.name) : null, quote, history, fundamentals: raw.fundamentals || null, options: raw.options || null, updatedAt: raw.updatedAt || new Date().toISOString() });
}
