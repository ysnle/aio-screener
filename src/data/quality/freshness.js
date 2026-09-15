import { allowedUseForStatus, parseEvidenceTime, restrictAllowedUse } from '../contracts/evidence.js';
import { selectForDecision, selectForDisplay } from '../selectors/evidence.js';

export function classifyFreshness({ observedAt, now = Date.now(), maxAgeMs = 86_400_000 } = {}) {
  const observedMs = parseEvidenceTime(observedAt);
  if (!Number.isFinite(observedMs)) return 'missing';
  const age = now - observedMs;
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) return 'stale';
  if (age <= maxAgeMs) return 'fresh';
  return 'stale';
}

export function applyFreshness(evidence, { now = Date.now(), maxAgeMs = 86_400_000 } = {}) {
  const freshness = classifyFreshness({ observedAt: evidence?.observedAt, now, maxAgeMs });
  const status = evidence?.status === 'missing' || evidence?.status === 'failed'
    ? evidence.status
    : freshness === 'missing' && evidence?.value != null ? 'reference' : freshness;
  const observedMs = parseEvidenceTime(evidence?.observedAt);
  const age = Number.isFinite(observedMs) ? now - observedMs : NaN;
  return Object.freeze({
    ...evidence,
    status,
    // Freshness is a recency label, never a missing authority grant. A
    // producer must explicitly supply a decision ceiling for decision use.
    allowedUse: restrictAllowedUse(evidence?.allowedUse ?? allowedUseForStatus(evidence?.status), evidence?.allowedUseCeiling ?? 'reference', allowedUseForStatus(status)),
    freshnessMs: Number.isFinite(age) && age >= 0 ? age : null
  });
}

export function canUseEvidence(evidence, purpose = 'reference') {
  return !!(purpose === 'decision' ? selectForDecision(evidence) : selectForDisplay(evidence));
}
