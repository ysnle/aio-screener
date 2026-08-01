export const MARKET_SNAPSHOT_STATUS = Object.freeze(['published', 'partial', 'failed', 'unavailable']);
export const MARKET_QUALITY_STATUS = Object.freeze([
  'CURRENT',
  'CLOSED_CURRENT',
  'DELAYED',
  'STALE',
  'QUARANTINED',
  'UNAVAILABLE'
]);

// Tier 0 is intentionally bounded. It is the minimum set required for a
// server-side fallback; the broader browser quote universe remains separate.
export const TIER_0_INSTRUMENTS = Object.freeze([
  { instrumentId: '^GSPC', metricId: 'market.index.spx', unit: 'index' },
  { instrumentId: '^IXIC', metricId: 'market.index.nasdaq', unit: 'index' },
  { instrumentId: '^DJI', metricId: 'market.index.dow', unit: 'index' },
  { instrumentId: '^RUT', metricId: 'market.index.russell2000', unit: 'index' },
  { instrumentId: '^VIX', metricId: 'market.volatility.vix', unit: 'index' },
  { instrumentId: '^VIX3M', metricId: 'market.volatility.vix3m', unit: 'index' },
  { instrumentId: '^KS11', metricId: 'market.index.kospi', unit: 'index' },
  { instrumentId: '^KQ11', metricId: 'market.index.kosdaq', unit: 'index' },
  { instrumentId: 'KRW=X', metricId: 'market.fx.usdkrw', unit: 'KRW/USD' },
  { instrumentId: '^TNX', metricId: 'market.rates.us10y', unit: 'percent' },
  { instrumentId: '^IRX', metricId: 'market.rates.us13w', unit: 'percent' },
  { instrumentId: 'DX-Y.NYB', metricId: 'market.fx.dxy', unit: 'index' },
  { instrumentId: 'CL=F', metricId: 'market.commodity.wti', unit: 'USD/barrel' },
  { instrumentId: 'GC=F', metricId: 'market.commodity.gold', unit: 'USD/oz' },
  { instrumentId: 'BTC-USD', metricId: 'market.crypto.btc', unit: 'USD' },
  { instrumentId: 'ETH-USD', metricId: 'market.crypto.eth', unit: 'USD' }
]);

export const TIER_0_REQUIRED = TIER_0_INSTRUMENTS.length;

const INSTRUMENT_BY_ID = new Map(TIER_0_INSTRUMENTS.map((row) => [row.instrumentId, row]));

function asIso(value) {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function normalizeCoverage(coverage = {}) {
  const required = Number(coverage.required ?? coverage.tier0Required ?? TIER_0_REQUIRED);
  const observed = Number(coverage.observed ?? coverage.tier0Observed ?? 0);
  const tier0Required = Number(coverage.tier0Required ?? required);
  const tier0Observed = Number(coverage.tier0Observed ?? observed);
  const tier1Required = Number(coverage.tier1Required ?? 0);
  const tier1Observed = Number(coverage.tier1Observed ?? 0);
  return Object.freeze({
    required: Number.isFinite(required) ? required : 0,
    observed: Number.isFinite(observed) ? observed : 0,
    tier0Required: Number.isFinite(tier0Required) ? tier0Required : 0,
    tier0Observed: Number.isFinite(tier0Observed) ? tier0Observed : 0,
    tier1Required: Number.isFinite(tier1Required) ? tier1Required : 0,
    tier1Observed: Number.isFinite(tier1Observed) ? tier1Observed : 0
  });
}

function normalizeQuote(quote = {}) {
  const instrument = INSTRUMENT_BY_ID.get(String(quote.instrumentId || quote.symbol || ''));
  const value = Number(quote.value ?? quote.price ?? quote.regularMarketPrice);
  const changePct = quote.changePct ?? quote.pct ?? quote.regularMarketChangePercent;
  const previousValue = quote.previousValue ?? quote.previousClose ?? quote.regularMarketPreviousClose ?? null;
  const derivedBasis = Number.isFinite(Number(previousValue)) ? 'provider-previous-value' : 'unknown';
  const normalized = {
    evidenceId: String(quote.evidenceId || ''),
    metricId: String(quote.metricId || instrument?.metricId || ''),
    instrumentId: String(quote.instrumentId || quote.symbol || ''),
    value,
    previousValue,
    changePct: changePct == null ? null : Number(changePct),
    unit: String(quote.unit || instrument?.unit || 'unitless'),
    source: String(quote.source || 'unknown'),
    sourceKind: String(quote.sourceKind || 'provider'),
    observedAt: asIso(quote.observedAt),
    fetchedAt: asIso(quote.fetchedAt),
    lastSuccessfulAt: asIso(quote.lastSuccessfulAt || quote.observedAt || quote.fetchedAt),
    session: String(quote.session || quote.marketSession || 'UNKNOWN'),
    quality: MARKET_QUALITY_STATUS.includes(quote.quality) ? quote.quality : 'UNAVAILABLE',
    changeBasis: String(quote.changeBasis || quote.valueBasis || derivedBasis),
    valueBasis: String(quote.valueBasis || quote.changeBasis || derivedBasis),
    allowedUse: String(quote.allowedUse || 'reference'),
    delayedByMs: Number.isFinite(Number(quote.delayedByMs)) ? Number(quote.delayedByMs) : null,
    venue: quote.venue || quote.fullExchangeName || null
  };
  normalized.evidenceId = normalized.evidenceId || `${normalized.metricId}:${normalized.observedAt || 'missing'}`;
  return Object.freeze(normalized);
}

export function createMarketSnapshot(input = {}) {
  const coverage = normalizeCoverage(input.coverage);
  const quotes = Array.isArray(input.quotes) ? input.quotes.map(normalizeQuote) : [];
  return Object.freeze({
    schemaVersion: String(input.schemaVersion || 'market-snapshot-v2'),
    status: MARKET_SNAPSHOT_STATUS.includes(input.status) ? input.status : 'unavailable',
    revision: String(input.revision || 'unpublished'),
    generatedAt: asIso(input.generatedAt),
    attemptedAt: asIso(input.attemptedAt),
    lastSuccessfulAt: asIso(input.lastSuccessfulAt),
    source: String(input.source || 'unknown'),
    coverage,
    quality: input.quality && typeof input.quality === 'object' ? Object.freeze({ ...input.quality }) : Object.freeze({}),
    errors: Array.isArray(input.errors) ? Object.freeze(input.errors.map(String)) : Object.freeze([]),
    quotes: Object.freeze(quotes)
  });
}

export function validateMarketSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') errors.push('snapshot_not_object');
  if (!MARKET_SNAPSHOT_STATUS.includes(snapshot?.status)) errors.push('status_invalid');
  if (!snapshot?.attemptedAt || Number.isNaN(Date.parse(snapshot.attemptedAt))) errors.push('attemptedAt_missing_or_invalid');
  if (snapshot?.status === 'published' && (!snapshot.lastSuccessfulAt || Number.isNaN(Date.parse(snapshot.lastSuccessfulAt)))) {
    errors.push('lastSuccessfulAt_required_for_publish');
  }
  const required = Number(snapshot?.coverage?.required || 0);
  const observed = Number(snapshot?.coverage?.observed || 0);
  const tier0Required = Number(snapshot?.coverage?.tier0Required ?? required);
  const tier0Observed = Number(snapshot?.coverage?.tier0Observed ?? observed);
  if (snapshot?.status === 'published' && (required <= 0 || observed < required || tier0Required <= 0 || tier0Observed < tier0Required)) {
    errors.push('published_coverage_below_100_percent');
  }
  const seen = new Set();
  for (const quote of snapshot?.quotes || []) {
    if (seen.has(quote?.instrumentId)) errors.push(`quote_duplicate_instrument:${quote.instrumentId}`);
    seen.add(quote?.instrumentId);
    for (const field of ['evidenceId', 'metricId', 'instrumentId', 'unit', 'source', 'observedAt', 'fetchedAt', 'quality']) {
      if (!quote?.[field]) errors.push(`quote_${field}_missing`);
    }
    if (typeof quote?.value !== 'number' || !Number.isFinite(quote.value) || quote.value <= 0) errors.push('quote_value_invalid');
    if (quote?.changePct != null && (typeof quote.changePct !== 'number' || !Number.isFinite(quote.changePct))) errors.push('quote_change_pct_invalid');
    if (!MARKET_QUALITY_STATUS.includes(quote?.quality)) errors.push('quote_quality_invalid');
    for (const field of ['observedAt', 'fetchedAt', 'lastSuccessfulAt']) {
      if (quote?.[field] && Number.isNaN(Date.parse(quote[field]))) errors.push(`quote_${field}_invalid`);
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}

export function tier0Coverage(quotes = []) {
  const available = new Set((Array.isArray(quotes) ? quotes : []).map((quote) => String(quote?.instrumentId || quote?.symbol || '')));
  const observed = TIER_0_INSTRUMENTS.filter((row) => available.has(row.instrumentId)).length;
  return Object.freeze({ required: TIER_0_REQUIRED, observed, ratio: observed / TIER_0_REQUIRED });
}
