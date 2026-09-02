export const INFERENCE_DIRECTIONS = Object.freeze(['BULLISH', 'BEARISH', 'MIXED', 'NEUTRAL', 'UNKNOWN']);
export const INFERENCE_CONFIDENCE = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);

function text(value, fallback = '') {
  return value == null ? fallback : String(value).trim();
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function urls(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((url) => text(url)).filter((url) => /^https:\/\//i.test(url)))];
}

function observedWindow(value = {}) {
  const start = text(value.start || value.from || value.observedFrom, '');
  const end = text(value.end || value.to || value.observedTo, '');
  const normalizedStart = start && !Number.isNaN(Date.parse(start)) ? new Date(start).toISOString() : null;
  const normalizedEnd = end && !Number.isNaN(Date.parse(end)) ? new Date(end).toISOString() : null;
  if (normalizedStart && normalizedEnd && Date.parse(normalizedEnd) < Date.parse(normalizedStart)) return Object.freeze({ start: null, end: null });
  return Object.freeze({ start: normalizedStart, end: normalizedEnd });
}

function range(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const min = finite(value.min);
  const max = finite(value.max);
  if ((min == null && max == null) || (min != null && max != null && min > max)) return null;
  return Object.freeze({ min, max, unit: text(value.unit, 'unknown') });
}

// Search-derived claims deliberately have no exact/current numeric value field.
// Direction and bounded ranges are explanatory context only; they never become
// decision evidence without an independent provider-backed Evidence envelope.
export function createInferredClaim(input = {}) {
  const sourceUrls = urls(input.sourceUrls || input.sources);
  const requestedSourceCount = input.sourceCount ?? sourceUrls.length;
  const sourceCount = Number.isInteger(requestedSourceCount) && requestedSourceCount >= 0 ? requestedSourceCount : 0;
  const confidence = INFERENCE_CONFIDENCE.includes(String(input.confidence).toUpperCase())
    ? String(input.confidence).toUpperCase()
    : 'LOW';
  return Object.freeze({
    schemaVersion: 'inferred-claim-v1',
    claimId: text(input.claimId, `inferred:${text(input.metricId, 'claim')}:${Date.now()}`),
    metricId: text(input.metricId, 'unknown'),
    direction: INFERENCE_DIRECTIONS.includes(String(input.direction).toUpperCase()) ? String(input.direction).toUpperCase() : 'UNKNOWN',
    range: range(input.range),
    confidence,
    sourceCount,
    sourceUrls: Object.freeze(sourceUrls),
    observedWindow: observedWindow(input.observedWindow || input.window),
    sourceKind: 'web-search',
    allowedUse: 'reference',
    claimClass: 'INFERRED'
  });
}

export function validateInferredClaim(claim) {
  const errors = [];
  if (!claim || typeof claim !== 'object') errors.push('claim_not_object');
  if (claim?.schemaVersion !== 'inferred-claim-v1') errors.push('schema_version_invalid');
  if (!claim?.claimId || !claim?.metricId) errors.push('identity_missing');
  if (!INFERENCE_DIRECTIONS.includes(claim?.direction)) errors.push('direction_invalid');
  if (!INFERENCE_CONFIDENCE.includes(claim?.confidence)) errors.push('confidence_invalid');
  if (!Number.isInteger(claim?.sourceCount) || claim.sourceCount < 1) errors.push('source_count_invalid');
  if (!Array.isArray(claim?.sourceUrls) || claim.sourceUrls.length < 1) errors.push('source_urls_missing');
  if (claim?.sourceUrls?.some((url) => !/^https:\/\//i.test(url))) errors.push('source_url_invalid');
  if (claim?.confidence === 'HIGH' && claim.sourceCount < 2) errors.push('high_confidence_requires_two_sources');
  if (claim?.sourceCount < claim?.sourceUrls?.length) errors.push('source_count_below_url_count');
  if (claim?.sourceKind !== 'web-search' || claim?.allowedUse !== 'reference' || claim?.claimClass !== 'INFERRED') errors.push('inference_provenance_invalid');
  const forbiddenNumericKeys = new Set(['value', 'current', 'currentvalue', 'exact', 'exactvalue', 'numeric', 'numericvalue']);
  if (claim && Object.keys(claim).some((key) => forbiddenNumericKeys.has(String(key).toLowerCase()))) errors.push('exact_numeric_search_value_forbidden');
  if (claim?.range && (claim.range.min == null && claim.range.max == null)) errors.push('range_empty');
  if (claim?.range && claim.range.min != null && claim.range.max != null && claim.range.min > claim.range.max) errors.push('range_order_invalid');
  if (claim?.observedWindow?.start && claim?.observedWindow?.end && Date.parse(claim.observedWindow.end) < Date.parse(claim.observedWindow.start)) errors.push('observed_window_order_invalid');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]) });
}

export function evaluateInferredClaim(claim) {
  const validation = validateInferredClaim(claim);
  if (!validation.ok) return Object.freeze({ allowed: false, reason: validation.errors[0], allowedUse: 'none', actionStrength: 'blocked' });
  return Object.freeze({ allowed: true, reason: 'search_context_reference_only', allowedUse: 'reference', actionStrength: 'informational' });
}
