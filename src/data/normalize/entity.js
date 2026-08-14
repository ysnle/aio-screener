function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeEntity(raw = {}) {
  const quote = raw.quote ? {
    value: finite(raw.quote.value),
    pct: finite(raw.quote.pct),
    directionValue: finite(raw.quote.directionValue ?? raw.quote.pct),
    observedAt: raw.quote.observedAt || null,
    fetchedAt: raw.quote.fetchedAt || null,
    source: raw.quote.source || 'entity-provider',
    sourceKind: raw.quote.sourceKind || 'runtime-quote',
    revision: raw.quote.revision || null,
    changeBasis: raw.quote.changeBasis || 'unknown',
    directionCompatible: raw.quote.directionCompatible === true
  } : null;
  const history = Array.isArray(raw.history)
    ? raw.history.map((row) => ({
      time: row?.time || row?.date || null,
      open: finite(row?.open), high: finite(row?.high), low: finite(row?.low), close: finite(row?.close), volume: finite(row?.volume)
    })).filter((row) => row.time && row.close != null)
    : [];
  return Object.freeze({ id: raw.id ? String(raw.id).toUpperCase() : null, name: raw.name ? String(raw.name) : null, quote, history, fundamentals: raw.fundamentals || null, options: raw.options || null, updatedAt: raw.updatedAt || null });
}
