export const EVIDENCE_STATUS = Object.freeze([
  'live',
  'fresh',
  'snapshot',
  'reference',
  'stale',
  'missing',
  'failed'
]);

export const EVIDENCE_ALLOWED_USE = Object.freeze(['decision', 'reference', 'none']);

const ALLOWED_USE_ALIASES = new Map([
  ['decision', 'decision'],
  ['true', 'decision'],
  ['trading', 'decision'],
  ['verified-current-only', 'decision'],
  ['current-with-session-and-delay-gate', 'decision'],
  ['decision-with-daily-delay', 'decision'],
  ['reference', 'reference'],
  ['reference-only', 'reference'],
  ['reference-only-unless-promoted-by-evidence', 'reference'],
  ['reference-until-freshness-gate', 'reference'],
  ['research/reference', 'reference'],
  ['research-history', 'reference'],
  ['research-relative-ranking-only', 'reference'],
  ['false', 'reference'],
  ['none', 'none'],
  ['blocked', 'none'],
  ['unavailable', 'none'],
  ['null', 'none']
]);

/**
 * Normalize the historical boolean/descriptive forms used by the legacy
 * shell into the three-value evidence contract. Unknown values fail closed.
 * Adapters should call this before creating or exposing evidence; selectors
 * can therefore rely on a single enum instead of interpreting provider text.
 */
export function normalizeAllowedUse(value, fallback = 'none') {
  if (EVIDENCE_ALLOWED_USE.includes(value)) return value;
  if (typeof value === 'boolean') return value ? 'decision' : 'reference';
  const key = String(value ?? '').trim().toLowerCase();
  if (ALLOWED_USE_ALIASES.has(key)) return ALLOWED_USE_ALIASES.get(key);
  if (/^reference(?:-|\s|$)|^research(?:-|\/|\s|$)/.test(key)) return 'reference';
  if (/none|blocked|missing|unavailable|failed|invalid/.test(key)) return 'none';
  if (/decision|trading|current|live|fresh/.test(key)) return 'decision';
  return EVIDENCE_ALLOWED_USE.includes(fallback) ? fallback : 'none';
}

function stableHash(value) {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function allowedUseForStatus(status) {
  if (status === 'live' || status === 'fresh') return 'decision';
  if (status === 'snapshot' || status === 'reference' || status === 'stale') return 'reference';
  return 'none';
}

export function createEvidence(input = {}) {
  const status = EVIDENCE_STATUS.includes(input.status) ? input.status : (input.value == null ? 'missing' : 'reference');
  const evidence = {
    evidenceId: input.evidenceId || '',
    metric: String(input.metric || ''),
    value: input.value ?? null,
    unit: String(input.unit || 'unitless'),
    sourceKind: String(input.sourceKind || 'unknown'),
    source: String(input.source || input.sourceKind || 'unknown'),
    observedAt: input.observedAt || null,
    collectedAt: input.collectedAt || input.fetchedAt || null,
    publishedAt: input.publishedAt || null,
    fetchedAt: input.fetchedAt || null,
    lastSuccessfulAt: input.lastSuccessfulAt || null,
    status,
    allowedUse: normalizeAllowedUse(input.allowedUse, allowedUseForStatus(status)),
    freshnessMs: Number.isFinite(input.freshnessMs) ? input.freshnessMs : null,
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {}
  };
  evidence.evidenceId = evidence.evidenceId || `${evidence.metric}:${stableHash({
    value: evidence.value,
    observedAt: evidence.observedAt,
    sourceKind: evidence.sourceKind
  })}`;
  return Object.freeze(evidence);
}

export function validateEvidence(evidence) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object') errors.push('evidence_not_object');
  if (!evidence?.evidenceId) errors.push('evidence_id_missing');
  if (!evidence?.metric) errors.push('metric_missing');
  if (!EVIDENCE_STATUS.includes(evidence?.status)) errors.push('status_invalid');
  if (!EVIDENCE_ALLOWED_USE.includes(evidence?.allowedUse)) errors.push('allowed_use_invalid');
  if (evidence?.status !== 'missing' && evidence?.status !== 'failed' && evidence?.value == null) errors.push('value_missing');
  for (const field of ['observedAt', 'collectedAt', 'publishedAt', 'fetchedAt']) {
    if (evidence?.[field] != null && Number.isNaN(Date.parse(evidence[field]))) errors.push(`${field}_invalid`);
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}
