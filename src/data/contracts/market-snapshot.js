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
  const derivedBasis = previousValue != null && String(previousValue).trim() !== '' && typeof previousValue !== 'boolean' && Number.isFinite(Number(previousValue)) ? 'provider-previous-value' : 'unknown';
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
    changeBasis: String(quote.changeBasis || derivedBasis),
    valueBasis: String(quote.valueBasis || 'provider-current-value'),
    allowedUse: String(quote.allowedUse || 'reference'),
    delayedByMs: quote.delayedByMs != null && String(quote.delayedByMs).trim() !== '' && typeof quote.delayedByMs !== 'boolean' && Number.isFinite(Number(quote.delayedByMs)) && Number(quote.delayedByMs) >= 0 ? Number(quote.delayedByMs) : null,
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

export function validateMarketSnapshot(snapshot, options = {}) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') errors.push('snapshot_not_object');
  if (!MARKET_SNAPSHOT_STATUS.includes(snapshot?.status)) errors.push('status_invalid');
  if (!snapshot?.attemptedAt || Number.isNaN(Date.parse(snapshot.attemptedAt))) errors.push('attemptedAt_missing_or_invalid');
  if (snapshot?.status === 'published' && (!snapshot.lastSuccessfulAt || Number.isNaN(Date.parse(snapshot.lastSuccessfulAt)))) {
    errors.push('lastSuccessfulAt_required_for_publish');
  }
  // W03-A/P1145: publishing is accepted from the MEASURED instrument set, not the
  // coverage numbers the payload reports about itself. A snapshot cannot pass by
  // declaring 16/16 while shipping fewer, duplicate, unknown, or wrong-unit quotes.
  const audit = auditMarketSnapshotCoverage(snapshot, options);
  if (snapshot?.status === 'published') {
    if (!audit.declaredMatchesMeasured) errors.push('published_declared_coverage_mismatch');
    if (audit.measured.required <= 0 || audit.measured.observed < audit.measured.required) errors.push('published_coverage_below_100_percent');
    if (audit.missing.length) errors.push(`published_tier0_missing:${audit.missing.join('|')}`);
    if (audit.duplicates.length) errors.push(`published_tier0_duplicate:${audit.duplicates.join('|')}`);
    if (audit.unknown.length) errors.push(`published_instrument_unknown:${audit.unknown.join('|')}`);
    if (audit.unitMismatches.length) errors.push(`published_unit_mismatch:${audit.unitMismatches.map((row) => row.instrumentId).join('|')}`);
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
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)], audit });
}

/**
 * Pure coverage audit shared by the producer and the loader. It recomputes the
 * required instrument set from the registry instead of trusting declared counts.
 * A symbol alias cannot round a duplicate into coverage, and a unit mismatch is
 * never repaired here by an implicit numeric conversion — the mismatched quote is
 * reported with its expected and actual unit so the caller can decide.
 */
export function auditMarketSnapshotCoverage(snapshot, { instruments = TIER_0_INSTRUMENTS } = {}) {
  const registry = new Map((Array.isArray(instruments) ? instruments : []).map((row) => [String(row.instrumentId), row]));
  const quotes = Array.isArray(snapshot?.quotes) ? snapshot.quotes : [];
  const counts = new Map();
  const matched = new Set();
  const missing = [];
  const duplicates = [];
  const unknown = [];
  const unitMismatches = [];
  for (const quote of quotes) {
    const instrumentId = String(quote?.instrumentId || quote?.symbol || '');
    const entry = registry.get(instrumentId);
    if (!entry) { unknown.push(instrumentId); continue; }
    const count = (counts.get(instrumentId) || 0) + 1;
    counts.set(instrumentId, count);
    if (count > 1) { duplicates.push(instrumentId); matched.delete(instrumentId); continue; }
    const unit = String(quote?.unit || '');
    if (!unit || (entry.unit && unit !== entry.unit)) {
      unitMismatches.push(Object.freeze({ instrumentId, expected: entry.unit, actual: unit }));
      continue;
    }
    matched.add(instrumentId);
  }
  for (const row of instruments) if (!matched.has(String(row.instrumentId))) missing.push(String(row.instrumentId));
  const measured = Object.freeze({ required: registry.size, observed: matched.size, ratio: registry.size ? matched.size / registry.size : 0 });
  const declared = normalizeCoverage(snapshot?.coverage);
  const tier1Complete = declared.tier1Required === 0 || declared.tier1Observed >= declared.tier1Required;
  return Object.freeze({
    ok: missing.length === 0 && duplicates.length === 0 && unknown.length === 0 && unitMismatches.length === 0 && declared.tier0Required === measured.required && declared.tier0Observed === measured.observed,
    measured,
    declared,
    declaredMatchesMeasured: declared.tier0Required === measured.required && declared.tier0Observed === measured.observed,
    tier1: Object.freeze({ required: declared.tier1Required, observed: declared.tier1Observed, complete: tier1Complete }),
    missing: Object.freeze(missing),
    duplicates: Object.freeze(duplicates),
    unknown: Object.freeze(unknown),
    unitMismatches: Object.freeze(unitMismatches)
  });
}

export function tier0Coverage(quotes = []) {
  return auditMarketSnapshotCoverage({ quotes }).measured;
}
