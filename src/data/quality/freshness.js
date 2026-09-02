import { allowedUseForStatus, restrictAllowedUse } from '../contracts/evidence.js';
import { selectForDecision, selectForDisplay } from '../selectors/evidence.js';

export function classifyFreshness({ observedAt, now = Date.now(), maxAgeMs = 86_400_000 } = {}) {
  if (!observedAt || Number.isNaN(Date.parse(observedAt))) return 'missing';
  const age = now - Date.parse(observedAt);
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) return 'stale';
  if (age <= maxAgeMs) return 'fresh';
  return 'stale';
}

export function applyFreshness(evidence, { now = Date.now(), maxAgeMs = 86_400_000 } = {}) {
  const freshness = classifyFreshness({ observedAt: evidence?.observedAt, now, maxAgeMs });
  const status = evidence?.status === 'missing' || evidence?.status === 'failed'
    ? evidence.status
    : freshness === 'missing' && evidence?.value != null ? 'reference' : freshness;
  const age = evidence?.observedAt ? now - Date.parse(evidence.observedAt) : NaN;
  return Object.freeze({
    ...evidence,
    status,
    allowedUse: restrictAllowedUse(evidence?.allowedUse ?? allowedUseForStatus(evidence?.status), evidence?.allowedUseCeiling ?? 'decision', allowedUseForStatus(status)),
    freshnessMs: Number.isFinite(age) && age >= 0 ? age : null
  });
}

export function canUseEvidence(evidence, purpose = 'reference') {
  return !!(purpose === 'decision' ? selectForDecision(evidence) : selectForDisplay(evidence));
}
