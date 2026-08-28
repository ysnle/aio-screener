import { allowedUseForStatus, restrictAllowedUse } from '../contracts/evidence.js';

export function classifyFreshness({ observedAt, now = Date.now(), maxAgeMs = 86_400_000 } = {}) {
  if (!observedAt || Number.isNaN(Date.parse(observedAt))) return 'missing';
  const age = Math.max(0, now - Date.parse(observedAt));
  if (age <= maxAgeMs) return 'fresh';
  return 'stale';
}

export function applyFreshness(evidence, { now = Date.now(), maxAgeMs = 86_400_000 } = {}) {
  const status = evidence?.status === 'missing' || evidence?.status === 'failed'
    ? evidence.status
    : classifyFreshness({ observedAt: evidence?.observedAt, now, maxAgeMs });
  return Object.freeze({
    ...evidence,
    status,
    allowedUse: restrictAllowedUse(evidence?.allowedUse ?? 'none', evidence?.allowedUseCeiling ?? 'decision', allowedUseForStatus(status)),
    freshnessMs: evidence?.observedAt ? Math.max(0, now - Date.parse(evidence.observedAt)) : null
  });
}

export function canUseEvidence(evidence, purpose = 'reference') {
  if (!evidence || evidence.status === 'missing' || evidence.status === 'failed') return false;
  if (purpose === 'decision') return evidence.allowedUse === 'decision' && (evidence.status === 'live' || evidence.status === 'fresh');
  return evidence.allowedUse === 'decision' || evidence.allowedUse === 'reference';
}
