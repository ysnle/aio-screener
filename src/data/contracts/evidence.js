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
  // Descriptive text (including negations such as not-for-decision) is not
  // authority to use a value. Only explicit compatibility aliases may grant use.
  return !key && EVIDENCE_ALLOWED_USE.includes(fallback) ? fallback : 'none';
}

export function hasObservedPast(evidence, now = Date.now()) {
  const observed = evidence?.observedAt ? Date.parse(evidence.observedAt) : NaN;
  return Number.isFinite(observed) && Number.isFinite(now) && observed <= now;
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

const ALLOWED_USE_RANK = Object.freeze({ none: 0, reference: 1, decision: 2 });

/**
 * Return the most restrictive use in the supplied chain. Freshness and a
 * successful fetch may downgrade evidence, but must never promote a provider
 * or rights ceiling from reference to decision use.
 */
export function restrictAllowedUse(...values) {
  const normalized = values
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => normalizeAllowedUse(value, 'none'));
  if (!normalized.length) return 'none';
  return normalized.reduce((current, value) => ALLOWED_USE_RANK[value] < ALLOWED_USE_RANK[current] ? value : current, 'decision');
}

export function createEvidence(input = {}, { now = Date.now() } = {}) {
  const declaredStatus = EVIDENCE_STATUS.includes(input.status) ? input.status : (input.value == null ? 'missing' : 'reference');
  const unknownTime = ['live', 'fresh'].includes(declaredStatus) && !hasObservedPast(input, now);
  const status = unknownTime ? 'reference' : declaredStatus;
  const statusAllowedUse = allowedUseForStatus(status);
  const requestedAllowedUse = input.allowedUse == null ? statusAllowedUse : normalizeAllowedUse(input.allowedUse, 'none');
  const allowedUseCeiling = input.allowedUseCeiling == null ? 'decision' : normalizeAllowedUse(input.allowedUseCeiling, 'none');
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
    allowedUse: restrictAllowedUse(statusAllowedUse, requestedAllowedUse, allowedUseCeiling),
    allowedUseCeiling,
    freshnessMs: Number.isFinite(input.freshnessMs) ? input.freshnessMs : null,
    metadata: { ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
      ...(unknownTime ? { temporalIssue: 'observation-time-missing-invalid-or-future', declaredStatus } : {}) }
  };
  evidence.evidenceId = evidence.evidenceId || `${evidence.metric}:${stableHash({
    value: evidence.value,
    observedAt: evidence.observedAt,
    sourceKind: evidence.sourceKind
  })}`;
  return Object.freeze(evidence);
}

export function validateEvidence(evidence, { now = Date.now() } = {}) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object') errors.push('evidence_not_object');
  if (!evidence?.evidenceId) errors.push('evidence_id_missing');
  if (!evidence?.metric) errors.push('metric_missing');
  if (!EVIDENCE_STATUS.includes(evidence?.status)) errors.push('status_invalid');
  if (!EVIDENCE_ALLOWED_USE.includes(evidence?.allowedUse)) errors.push('allowed_use_invalid');
  if (!EVIDENCE_ALLOWED_USE.includes(evidence?.allowedUseCeiling)) errors.push('allowed_use_ceiling_invalid');
  if (evidence?.allowedUse === 'decision' && !hasObservedPast(evidence, now)) errors.push('decision_observed_time_invalid');
  if (evidence?.allowedUse !== restrictAllowedUse(evidence?.allowedUse, evidence?.allowedUseCeiling, allowedUseForStatus(evidence?.status))) errors.push('allowed_use_exceeds_ceiling');
  if (evidence?.status !== 'missing' && evidence?.status !== 'failed' && evidence?.value == null) errors.push('value_missing');
  for (const field of ['observedAt', 'collectedAt', 'publishedAt', 'fetchedAt']) {
    if (evidence?.[field] != null && Number.isNaN(Date.parse(evidence[field]))) errors.push(`${field}_invalid`);
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}
