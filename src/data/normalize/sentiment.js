const SENTIMENT_FIELDS = Object.freeze([
  { metric: 'fearGreed', unit: 'score', sourceKind: 'legacy-runtime', observedAt: 'fearGreedObservedAt', maxAgeMs: 172_800_000 },
  { metric: 'vix9d', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix9dObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vixObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix3m', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix3mObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix6m', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix6mObservedAt', maxAgeMs: 120_000 },
  { metric: 'putCall', unit: 'ratio', sourceKind: 'legacy-projection', observedAt: 'putCallObservedAt', maxAgeMs: 172_800_000 },
  { metric: 'hySpread', unit: 'bp', sourceKind: 'legacy-projection', observedAt: 'hySpreadDate', maxAgeMs: 172_800_000 },
  { metric: 'aaiiBear', unit: 'percent', sourceKind: 'snapshot', observedAt: 'aaiiObservedAt', maxAgeMs: null },
  { metric: 'aaiiBull', unit: 'percent', sourceKind: 'snapshot', observedAt: 'aaiiObservedAt', maxAgeMs: null }
]);

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeSentiment(raw = {}) {
  const result = { ...raw };
  for (const field of SENTIMENT_FIELDS) result[field.metric] = finite(raw[field.metric]);
  result.vixHistory = Array.isArray(raw.vixHistory)
    ? raw.vixHistory.map((point) => ({ date: point?.date || null, value: finite(point?.value) })).filter((point) => point.value != null)
    : [];
  return Object.freeze(result);
}

export function sentimentFieldDefinitions() {
  return SENTIMENT_FIELDS;
}
