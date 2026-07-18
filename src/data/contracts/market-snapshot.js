export const MARKET_SNAPSHOT_STATUS = Object.freeze(['published', 'partial', 'failed', 'unavailable']);

export function createMarketSnapshot(input = {}) {
  const coverage = input.coverage && typeof input.coverage === 'object' ? { ...input.coverage } : { required: 0, observed: 0 };
  return Object.freeze({
    schemaVersion: String(input.schemaVersion || 'market-snapshot-v1'),
    status: MARKET_SNAPSHOT_STATUS.includes(input.status) ? input.status : 'unavailable',
    generatedAt: input.generatedAt || null,
    attemptedAt: input.attemptedAt || null,
    lastSuccessfulAt: input.lastSuccessfulAt || null,
    source: String(input.source || 'unknown'),
    coverage,
    quotes: Array.isArray(input.quotes) ? input.quotes.map((quote) => Object.freeze({ ...quote })) : []
  });
}

export function validateMarketSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') errors.push('snapshot_not_object');
  if (!MARKET_SNAPSHOT_STATUS.includes(snapshot?.status)) errors.push('status_invalid');
  if (!snapshot?.attemptedAt || Number.isNaN(Date.parse(snapshot.attemptedAt))) errors.push('attemptedAt_missing_or_invalid');
  if (snapshot?.status === 'published' && (!snapshot.lastSuccessfulAt || Number.isNaN(Date.parse(snapshot.lastSuccessfulAt)))) errors.push('lastSuccessfulAt_required_for_publish');
  const required = Number(snapshot?.coverage?.required || 0);
  const observed = Number(snapshot?.coverage?.observed || 0);
  if (snapshot?.status === 'published' && (required <= 0 || observed < required)) errors.push('published_coverage_below_100_percent');
  for (const quote of snapshot?.quotes || []) {
    for (const field of ['metricId', 'instrumentId', 'unit', 'source', 'observedAt', 'fetchedAt']) {
      if (!quote?.[field]) errors.push(`quote_${field}_missing`);
    }
    if (typeof quote?.value !== 'number' || !Number.isFinite(quote.value)) errors.push('quote_value_invalid');
    for (const field of ['observedAt', 'fetchedAt']) {
      if (quote?.[field] && Number.isNaN(Date.parse(quote[field]))) errors.push(`quote_${field}_invalid`);
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
