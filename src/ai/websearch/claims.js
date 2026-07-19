import { createInferredClaim, validateInferredClaim } from '../inference.js';

export function createSearchClaim(input = {}) {
  const claim = createInferredClaim(input);
  const validation = validateInferredClaim(claim);
  return Object.freeze({ claim, validation, status: validation.ok ? 'reference-only' : 'blocked' });
}
