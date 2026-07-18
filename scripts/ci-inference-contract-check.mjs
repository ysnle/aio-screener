import { createInferredClaim, evaluateInferredClaim, validateInferredClaim } from '../src/ai/inference.js';

const claim = createInferredClaim({
  metricId: 'market.risk',
  direction: 'BULLISH',
  confidence: 'HIGH',
  sourceUrls: ['https://example.com/one', 'https://example.com/two'],
  observedWindow: { start: '2026-07-17T00:00:00Z', end: '2026-07-18T00:00:00Z' }
});
const valid = validateInferredClaim(claim);
if (!valid.ok || !evaluateInferredClaim(claim).allowed) throw new Error(`[inference-contract] valid claim rejected: ${valid.errors.join(',')}`);
const highOneSource = createInferredClaim({ ...claim, confidence: 'HIGH', sourceUrls: ['https://example.com/one'], sourceCount: 1 });
if (validateInferredClaim(highOneSource).ok) throw new Error('[inference-contract] high confidence accepted with one source');
if (validateInferredClaim({ ...claim, value: 42 }).ok) throw new Error('[inference-contract] exact numeric search value accepted');
console.log(JSON.stringify({ ok: true, schemaVersion: claim.schemaVersion, sourceCount: claim.sourceCount, highConfidenceRequires: 2 }));
