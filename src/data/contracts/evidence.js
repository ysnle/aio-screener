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
    fetchedAt: input.fetchedAt || null,
    lastSuccessfulAt: input.lastSuccessfulAt || null,
    status,
    allowedUse: input.allowedUse || allowedUseForStatus(status),
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
  for (const field of ['observedAt', 'fetchedAt']) {
    if (evidence?.[field] != null && Number.isNaN(Date.parse(evidence[field]))) errors.push(`${field}_invalid`);
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}
