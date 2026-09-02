export const AI_CONTEXT_SCHEMA_VERSION = 'ai-context.v1';

export function createAIContextManifest({ route = 'home', evidence = [], claims = [], dataRevision = null, inputVersion = null } = {}) {
  const evidenceRows = (Array.isArray(evidence) ? evidence : []).map((entry) => Object.freeze({ evidenceId: entry?.evidenceId, metric: entry?.metric, value: entry?.value, unit: entry?.unit, observedAt: entry?.observedAt, source: entry?.source, status: entry?.status }));
  const claimRows = (Array.isArray(claims) ? claims : []).map((claim) => Object.freeze({ claimId: claim?.claimId, sourceUrls: Object.freeze(Array.isArray(claim?.sourceUrls) ? [...claim.sourceUrls] : []), allowedUse: claim?.allowedUse || 'reference' }));
  return Object.freeze({ schemaVersion: AI_CONTEXT_SCHEMA_VERSION, route, dataRevision, inputVersion, evidence: Object.freeze(evidenceRows), claims: Object.freeze(claimRows) });
}
