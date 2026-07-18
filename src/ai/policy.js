import { evaluateInferredClaim } from './inference.js';

export function evaluateEvidenceUse(evidence, purpose = 'reference') {
  if (!evidence || evidence.status === 'missing' || evidence.status === 'failed') {
    return Object.freeze({ allowed: false, reason: 'evidence_unavailable', actionStrength: 'blocked' });
  }
  if (purpose === 'decision' && evidence.allowedUse !== 'decision') {
    return Object.freeze({ allowed: false, reason: 'evidence_reference_only', actionStrength: 'cautious' });
  }
  return Object.freeze({ allowed: true, reason: 'evidence_accepted', actionStrength: purpose === 'decision' ? 'bounded' : 'informational' });
}

export function evaluateClaim({ evidence, claimType = 'text', sourceClass = 'OBSERVED' } = {}) {
  const numeric = claimType === 'numeric' || claimType === 'metric';
  const inferred = String(sourceClass).toUpperCase() === 'INFERRED';
  if (numeric && inferred) return Object.freeze({ allowed: false, reason: 'inferred_numeric_claim_blocked', allowedUse: 'none' });
  const decision = evaluateEvidenceUse(evidence, numeric ? 'decision' : 'reference');
  return Object.freeze({ allowed: decision.allowed, reason: decision.reason, allowedUse: evidence?.allowedUse || 'none' });
}

export { createInferredClaim, validateInferredClaim } from './inference.js';

export function evaluateSearchClaim(claim) {
  return evaluateInferredClaim(claim);
}
