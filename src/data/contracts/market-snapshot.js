import { canonicalSourceTier } from './source-kind.js';

export const MARKET_SNAPSHOT_STATUS = Object.freeze(['published', 'partial', 'failed', 'unavailable']);
// W03-C/P1183: 관측값 종류(value kind)는 registry가 선언하는 의미 축이다. quote가 공급한
// 종류는 registry 정본과 대조해 거부하고, 덮어쓰거나 alias하지 않는다.
export const QUOTE_VALUE_KINDS = Object.freeze(['index', 'rate', 'fx', 'price']);
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
  { instrumentId: '^GSPC', metricId: 'market.index.spx', unit: 'index', valueKind: 'index' },
  { instrumentId: '^IXIC', metricId: 'market.index.nasdaq', unit: 'index', valueKind: 'index' },
  { instrumentId: '^DJI', metricId: 'market.index.dow', unit: 'index', valueKind: 'index' },
  { instrumentId: '^RUT', metricId: 'market.index.russell2000', unit: 'index', valueKind: 'index' },
  { instrumentId: '^VIX', metricId: 'market.volatility.vix', unit: 'index', valueKind: 'index' },
  { instrumentId: '^VIX3M', metricId: 'market.volatility.vix3m', unit: 'index', valueKind: 'index' },
  { instrumentId: '^KS11', metricId: 'market.index.kospi', unit: 'index', valueKind: 'index' },
  { instrumentId: '^KQ11', metricId: 'market.index.kosdaq', unit: 'index', valueKind: 'index' },
  { instrumentId: 'KRW=X', metricId: 'market.fx.usdkrw', unit: 'KRW/USD', valueKind: 'fx' },
  { instrumentId: '^TNX', metricId: 'market.rates.us10y', unit: 'percent', valueKind: 'rate' },
  { instrumentId: '^IRX', metricId: 'market.rates.us13w', unit: 'percent', valueKind: 'rate' },
  { instrumentId: 'DX-Y.NYB', metricId: 'market.fx.dxy', unit: 'index', valueKind: 'index' },
  { instrumentId: 'CL=F', metricId: 'market.commodity.wti', unit: 'USD/barrel', valueKind: 'price' },
  { instrumentId: 'GC=F', metricId: 'market.commodity.gold', unit: 'USD/oz', valueKind: 'price' },
  { instrumentId: 'BTC-USD', metricId: 'market.crypto.btc', unit: 'USD', valueKind: 'price' },
  { instrumentId: 'ETH-USD', metricId: 'market.crypto.eth', unit: 'USD', valueKind: 'price' }
]);

export const QUOTE_IDENTITIES = Object.freeze([
  ...TIER_0_INSTRUMENTS,
  { instrumentId: '^SKEW', metricId: 'market.volatility.skew', unit: 'index', valueKind: 'index' }
]);

export const TIER_0_REQUIRED = TIER_0_INSTRUMENTS.length;

const INSTRUMENT_BY_ID = new Map(TIER_0_INSTRUMENTS.map((row) => [row.instrumentId, row]));

/**
 * P1183: the registry is itself the identity 정본, so it validates itself before
 * any quote is compared against it. A duplicated or malformed registry row would
 * otherwise silently weaken every downstream metric/unit/valueKind comparison —
 * quote-side checks cannot see a contradiction the 정본 itself declares.
 */
export function validateInstrumentRegistry(instruments = TIER_0_INSTRUMENTS) {
  const errors = [];
  if (!Array.isArray(instruments) || instruments.length === 0) {
    return Object.freeze({ ok: false, errors: Object.freeze(['registry_empty']) });
  }
  const seenInstruments = new Set();
  const seenMetrics = new Set();
  for (const row of instruments) {
    const instrumentId = String(row?.instrumentId || '');
    const metricId = String(row?.metricId || '');
    const unit = String(row?.unit || '');
    const valueKind = String(row?.valueKind || '');
    if (!instrumentId) errors.push('registry_instrument_id_missing');
    if (!metricId) errors.push(`registry_metric_id_missing:${instrumentId || 'unknown'}`);
    else if (!/^market\.[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(metricId)) errors.push(`registry_metric_id_malformed:${metricId}`);
    if (!unit) errors.push(`registry_unit_missing:${instrumentId || 'unknown'}`);
    if (!QUOTE_VALUE_KINDS.includes(valueKind)) errors.push(`registry_value_kind_invalid:${instrumentId || 'unknown'}:${valueKind}`);
    if (instrumentId) {
      if (seenInstruments.has(instrumentId)) errors.push(`registry_instrument_duplicate:${instrumentId}`);
      seenInstruments.add(instrumentId);
    }
    if (metricId) {
      if (seenMetrics.has(metricId)) errors.push(`registry_metric_duplicate:${metricId}`);
      seenMetrics.add(metricId);
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

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
  // R24-02/P1178: record how the metric identity was resolved. The registry
  // fallback exists so a producer that omits metricId still round-trips the
  // registry's own value, but a published quote must be *supplied* — silent
  // derivation cannot stand in for an explicitly declared metric, and it must
  // never paper over a supplied value that contradicts the registry (the
  // validator rejects that mismatch instead of repairing it here).
  const suppliedMetricId = quote.metricId == null || String(quote.metricId).trim() === '' || typeof quote.metricId === 'boolean' ? '' : String(quote.metricId);
  // W03-C/P1183: valueKind도 metricId와 같은 identity 축이다 — 공급분은 registry와
  // 대조해 거부하고(정규화가 모순을 감추지 않음), 부재 시에만 registry에서 파생한다.
  const suppliedValueKind = quote.valueKind == null || String(quote.valueKind).trim() === '' || typeof quote.valueKind === 'boolean' ? '' : String(quote.valueKind);
  const normalized = {
    evidenceId: String(quote.evidenceId || ''),
    metricId: suppliedMetricId || instrument?.metricId || '',
    metricIdBasis: suppliedMetricId ? 'supplied' : (instrument?.metricId ? 'registry-derived' : 'missing'),
    valueKind: suppliedValueKind || instrument?.valueKind || '',
    valueKindBasis: suppliedValueKind ? 'supplied' : (instrument?.valueKind ? 'registry-derived' : 'missing'),
    instrumentId: String(quote.instrumentId || quote.symbol || ''),
    value,
    previousValue,
    changePct: changePct == null ? null : Number(changePct),
    unit: String(quote.unit || instrument?.unit || 'unitless'),
    // P1183: source/sourceKind의 'unknown'/'provider' 기본값이 존재 검사를 공허하게 만들었다
    // (정규화가 빈 입력을 사실상의 값으로 승격). 빈 입력은 빈 채로 남겨 validator가 잡는다.
    source: String(quote.source || ''),
    sourceKind: String(quote.sourceKind || ''),
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
  // P1183: validate the 정본 before trusting the comparisons it feeds. A corrupted
  // registry (duplicate metric, malformed id, undeclared valueKind) fails closed
  // here instead of laundering its own errors into "coverage matched".
  const registryCheck = validateInstrumentRegistry(options.instruments || TIER_0_INSTRUMENTS);
  for (const registryError of registryCheck.errors) errors.push(`registry_invalid:${registryError}`);
  if (snapshot?.status === 'published') {
    if (!audit.declaredMatchesMeasured) errors.push('published_declared_coverage_mismatch');
    if (audit.measured.required <= 0 || audit.measured.observed < audit.measured.required) errors.push('published_coverage_below_100_percent');
    if (audit.missing.length) errors.push(`published_tier0_missing:${audit.missing.join('|')}`);
    if (audit.duplicates.length) errors.push(`published_tier0_duplicate:${audit.duplicates.join('|')}`);
    if (audit.unknown.length) errors.push(`published_instrument_unknown:${audit.unknown.join('|')}`);
    if (audit.unitMismatches.length) errors.push(`published_unit_mismatch:${audit.unitMismatches.map((row) => row.instrumentId).join('|')}`);
    if (audit.metricMismatches.length) errors.push(`published_metric_mismatch:${audit.metricMismatches.map((row) => row.instrumentId).join('|')}`);
    if (audit.valueKindMismatches.length) errors.push(`published_value_kind_mismatch:${audit.valueKindMismatches.map((row) => row.instrumentId).join('|')}`);
  }
  const seen = new Set();
  for (const quote of snapshot?.quotes || []) {
    if (seen.has(quote?.instrumentId)) errors.push(`quote_duplicate_instrument:${quote.instrumentId}`);
    seen.add(quote?.instrumentId);
    for (const field of ['evidenceId', 'metricId', 'instrumentId', 'unit', 'source', 'sourceKind', 'observedAt', 'fetchedAt', 'quality']) {
      if (!quote?.[field]) errors.push(`quote_${field}_missing`);
    }
    // R24-02/P1178: a quote may carry the right instrument and unit while naming a
    // different metric entirely. The registry row is the identity contract, so an
    // explicitly supplied metricId that disagrees is rejected — never repaired by
    // the registry fallback, which only applies when the field is absent.
    const registryRow = audit.registry.get(String(quote?.instrumentId || quote?.symbol || ''));
    if (registryRow && quote?.metricId && String(quote.metricId) !== String(registryRow.metricId)) {
      errors.push(`quote_metric_mismatch:${quote.instrumentId}:${quote.metricId}!=${registryRow.metricId}`);
    }
    // W03-C/P1183: valueKind is the same identity axis. Only a *supplied* kind can
    // contradict the registry (a missing kind is derived with its basis recorded);
    // a contradiction is rejected, never aliased into the expected kind.
    if (registryRow?.valueKind && quote?.valueKind && String(quote.valueKind) !== String(registryRow.valueKind)) {
      errors.push(`quote_value_kind_mismatch:${quote.instrumentId}:${quote.valueKind}!=${registryRow.valueKind}`);
    }
    // W03-C/P1183: sourceKind must resolve through the canonical tier vocabulary
    // (source-kind.js) — an invented provider string fails closed instead of
    // quietly standing in for an evidence authority it never declared.
    if (quote?.sourceKind && canonicalSourceTier(quote.sourceKind) === null) {
      errors.push(`quote_source_kind_unrecognized:${quote.instrumentId}:${quote.sourceKind}`);
    }
    // No registry row declares permission to derive a missing metricId, so a
    // published quote whose identity came from the fallback is isolated rather
    // than accepted: producers already copy metricId from the same registry.
    if (snapshot?.status === 'published' && quote?.metricIdBasis === 'registry-derived') {
      errors.push(`quote_metric_id_registry_derived:${quote.instrumentId}`);
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
  const metricMismatches = [];
  const valueKindMismatches = [];
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
    // R24-02/P1178: identity is (instrumentId, metricId, unit). A quote whose
    // metricId contradicts the registry does not count toward coverage even when
    // its unit happens to match, so a swapped metric can never round up coverage.
    const metricId = String(quote?.metricId || '');
    if (metricId !== String(entry.metricId)) {
      metricMismatches.push(Object.freeze({ instrumentId, expected: entry.metricId, actual: metricId }));
      continue;
    }
    // W03-C/P1183: valueKind joins the identity tuple. A missing kind derives from
    // the registry row (raw artifacts predating the field keep counting); a kind
    // that contradicts the registry is excluded from coverage like a wrong metric.
    if (entry.valueKind && String(quote?.valueKind || entry.valueKind) !== entry.valueKind) {
      valueKindMismatches.push(Object.freeze({ instrumentId, expected: entry.valueKind, actual: String(quote?.valueKind || '') }));
      continue;
    }
    matched.add(instrumentId);
  }
  for (const row of instruments) if (!matched.has(String(row.instrumentId))) missing.push(String(row.instrumentId));
  const measured = Object.freeze({ required: registry.size, observed: matched.size, ratio: registry.size ? matched.size / registry.size : 0 });
  const declared = normalizeCoverage(snapshot?.coverage);
  const tier1Complete = declared.tier1Required === 0 || declared.tier1Observed >= declared.tier1Required;
  return Object.freeze({
    ok: missing.length === 0 && duplicates.length === 0 && unknown.length === 0 && unitMismatches.length === 0 && metricMismatches.length === 0 && valueKindMismatches.length === 0 && declared.tier0Required === measured.required && declared.tier0Observed === measured.observed,
    measured,
    declared,
    declaredMatchesMeasured: declared.tier0Required === measured.required && declared.tier0Observed === measured.observed,
    tier1: Object.freeze({ required: declared.tier1Required, observed: declared.tier1Observed, complete: tier1Complete }),
    missing: Object.freeze(missing),
    duplicates: Object.freeze(duplicates),
    unknown: Object.freeze(unknown),
    unitMismatches: Object.freeze(unitMismatches),
    metricMismatches: Object.freeze(metricMismatches),
    valueKindMismatches: Object.freeze(valueKindMismatches),
    registry
  });
}

export function tier0Coverage(quotes = []) {
  return auditMarketSnapshotCoverage({ quotes }).measured;
}
