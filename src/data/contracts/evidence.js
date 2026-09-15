export const EVIDENCE_STATUS = Object.freeze([
  'live',
  'fresh',
  'snapshot',
  'reference',
  'stale',
  'missing',
  'failed'
]);

import { canonicalSourceTier, isDecisionEligibleSourceKind } from './source-kind.js';

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

export function parseEvidenceTime(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && /^\d+(?:\.\d+)?$/.test(value.trim())) return numeric < 1e12 ? numeric * 1000 : numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

export function hasObservedPast(evidence, now = Date.now()) {
  const observed = parseEvidenceTime(evidence?.observedAt);
  return Number.isFinite(observed) && Number.isFinite(now) && observed <= now;
}

const INVALID_RIGHTS_IDS = new Set(['', 'UNKNOWN', 'UNSPECIFIED', 'NULL', 'NONE']);
const DECISION_QUALITY_STATUSES = new Set(['CURRENT', 'FRESH', 'LIVE', 'VERIFIED_CURRENT', 'verified_current']);

export function isValidRightsId(value) {
  const rightsId = String(value ?? '').trim();
  return !!rightsId && !INVALID_RIGHTS_IDS.has(rightsId.toUpperCase());
}

export function isDecisionQuality(quality, qualityStatus = null) {
  const status = String(quality?.status || qualityStatus || '').trim();
  const normalized = status.toUpperCase();
  if (!DECISION_QUALITY_STATUSES.has(normalized) && !DECISION_QUALITY_STATUSES.has(status)) return false;
  if (quality && typeof quality === 'object') {
    if (quality.stale === true || quality.blocked === true || quality.decisionUse === false || quality.allowedUse === false) return false;
  }
  return true;
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
  // Status/freshness describes recency only. It is never a source-rights or
  // trading authority grant; explicit source tier, rights, quality and
  // allowed-use fields are required for decision use.
  if (status === 'live' || status === 'fresh') return 'reference';
  if (status === 'snapshot' || status === 'reference' || status === 'stale') return 'reference';
  return 'none';
}

const ALLOWED_USE_RANK = Object.freeze({ none: 0, reference: 1, decision: 2 });

function immutableCopy(value, ancestors = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (ancestors.has(value)) throw new TypeError('CYCLIC_EVIDENCE_METADATA');
  ancestors.add(value);
  const copy = Array.isArray(value)
    ? value.map((child) => immutableCopy(child, ancestors))
    : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, immutableCopy(child, ancestors)]));
  ancestors.delete(value);
  return Object.freeze(copy);
}

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
  const allowedUseExplicit = input.allowedUse != null;
  const allowedUseCeilingExplicit = input.allowedUseCeiling != null;
  const requestedAllowedUse = !allowedUseExplicit ? statusAllowedUse : normalizeAllowedUse(input.allowedUse, 'none');
  // A missing ceiling is a reference ceiling. A live/fresh label must never
  // manufacture a decision ceiling.
  const allowedUseCeiling = !allowedUseCeilingExplicit ? 'reference' : normalizeAllowedUse(input.allowedUseCeiling, 'none');
  const qualityInput = input.quality && typeof input.quality === 'object' ? input.quality : null;
  const qualityStatus = String(input.qualityStatus || qualityInput?.status || input.metadata?.qualityStatus || '').trim() || null;
  const sourceKind = String(input.sourceKind || '').trim();
  const sourceTier = canonicalSourceTier(sourceKind);
  const rightsExplicit = input.rightsId != null || input.metadata?.rightsId != null;
  const evidence = {
    evidenceId: input.evidenceId || '',
    metric: String(input.metric || ''),
    value: input.value ?? null,
    unit: String(input.unit || 'unitless'),
    sourceKind,
    sourceTier,
    source: String(input.source || sourceKind || 'unknown'),
    revisionId: String(input.revisionId || input.metadata?.revision || '').trim(),
    rightsId: String(input.rightsId || input.metadata?.rightsId || '').trim(),
    observedAt: input.observedAt || null,
    collectedAt: input.collectedAt || input.fetchedAt || null,
    publishedAt: input.publishedAt || null,
    fetchedAt: input.fetchedAt || null,
    lastSuccessfulAt: input.lastSuccessfulAt || null,
    status,
    allowedUse: restrictAllowedUse(requestedAllowedUse, allowedUseCeiling),
    allowedUseCeiling,
    quality: qualityInput,
    qualityStatus,
    authorityExplicit: !!sourceKind,
    rightsExplicit,
    allowedUseExplicit,
    allowedUseCeilingExplicit,
    qualityExplicit: !!qualityInput || !!qualityStatus,
    freshnessMs: Number.isFinite(input.freshnessMs) ? input.freshnessMs : null,
    metadata: immutableCopy({ ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
      ...(unknownTime ? { temporalIssue: 'observation-time-missing-invalid-or-future', declaredStatus } : {}) })
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
  const decisionRequested = evidence?.allowedUse === 'decision';
  if (decisionRequested && (!evidence?.revisionId || ['UNPUBLISHED', 'UNKNOWN', 'NULL'].includes(String(evidence.revisionId).toUpperCase()))) errors.push('revision_id_missing_or_unpublished');
  if (decisionRequested && !isValidRightsId(evidence?.rightsId)) errors.push('rights_id_invalid');
  const sourceTier = evidence?.sourceTier || canonicalSourceTier(evidence?.sourceKind);
  if (decisionRequested && !sourceTier) errors.push('source_kind_invalid');
  if (!EVIDENCE_STATUS.includes(evidence?.status)) errors.push('status_invalid');
  if (!EVIDENCE_ALLOWED_USE.includes(evidence?.allowedUse)) errors.push('allowed_use_invalid');
  if (!EVIDENCE_ALLOWED_USE.includes(evidence?.allowedUseCeiling)) errors.push('allowed_use_ceiling_invalid');
  if (evidence?.allowedUse === 'decision') {
    if (!['live', 'fresh'].includes(evidence.status)) errors.push('decision_status_not_current');
    if (!evidence.allowedUseExplicit) errors.push('decision_use_not_explicit');
    if (!evidence.allowedUseCeilingExplicit) errors.push('decision_ceiling_not_explicit');
    if (!isDecisionEligibleSourceKind(sourceTier)) errors.push('decision_source_tier_ineligible');
    if (!isValidRightsId(evidence.rightsId) || ['REVIEW_REQUIRED', 'DENIED', 'BLOCKED', 'REVOKED'].includes(String(evidence.rightsId).toUpperCase())) errors.push('decision_rights_ineligible');
    if (!evidence.qualityExplicit || !isDecisionQuality(evidence.quality, evidence.qualityStatus)) errors.push('decision_quality_invalid');
    if (!hasObservedPast(evidence, now)) errors.push('decision_observed_time_invalid');
    const freshnessMs = Number(evidence.freshnessMs ?? evidence.metadata?.maxAgeMs);
    if (!Number.isFinite(freshnessMs) || freshnessMs <= 0) errors.push('decision_freshness_sla_missing');
    else {
      const age = now - parseEvidenceTime(evidence.observedAt);
      if (!Number.isFinite(age) || age < 0 || age > freshnessMs) errors.push('decision_freshness_sla_exceeded');
    }
  }
  if (evidence?.allowedUse !== restrictAllowedUse(evidence?.allowedUse, evidence?.allowedUseCeiling)) errors.push('allowed_use_exceeds_ceiling');
  if (evidence?.status !== 'missing' && evidence?.status !== 'failed' && evidence?.value == null) errors.push('value_missing');
  for (const field of ['observedAt', 'collectedAt', 'publishedAt', 'fetchedAt']) {
    if (evidence?.[field] != null && !Number.isFinite(parseEvidenceTime(evidence[field]))) errors.push(`${field}_invalid`);
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}

/**
 * One fail-closed evaluator shared by stores, selectors and runtime adapters.
 * It intentionally distinguishes a display/reference value from evidence that
 * is eligible for a decision: recency alone never promotes a value.
 */
export function evaluateEvidence(evidence, { purpose = 'display', now = Date.now() } = {}) {
  const value = evidence && typeof evidence === 'object' ? evidence : null;
  if (!value) return Object.freeze({ ok: false, evidence: null, errors: ['evidence_not_object'] });
  const validation = validateEvidence(value, { now });
  const errors = [...validation.errors];
  if (purpose === 'decision') {
    if (value.allowedUse !== 'decision') errors.push('decision_use_not_granted');
    if (!hasObservedPast(value, now)) errors.push('decision_observed_time_invalid');
  } else if (value.allowedUse === 'none' || value.status === 'missing' || value.status === 'failed') {
    errors.push('display_use_blocked');
  }
  return Object.freeze({ ok: errors.length === 0, evidence: value, errors: Object.freeze([...new Set(errors)]) });
}
