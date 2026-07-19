function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeEntity(raw = {}) {
  const quote = raw.quote ? { value: finite(raw.quote.value), pct: finite(raw.quote.pct), observedAt: raw.quote.observedAt || null, source: raw.quote.source || 'entity-provider' } : null;
  return Object.freeze({ id: raw.id ? String(raw.id).toUpperCase() : null, quote, fundamentals: raw.fundamentals || null, options: raw.options || null, updatedAt: raw.updatedAt || new Date().toISOString() });
}
