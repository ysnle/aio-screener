export const AI_CONTEXT_SCHEMA_VERSION = 'ai-context.v1';

export function createAIContextManifest({ route = 'home', evidence = [], claims = [], dataRevision = null, inputVersion = null } = {}) {
  return Object.freeze({ schemaVersion: AI_CONTEXT_SCHEMA_VERSION, route, dataRevision, inputVersion, evidence: evidence.map((entry) => ({ evidenceId: entry.evidenceId, metric: entry.metric, value: entry.value, unit: entry.unit, observedAt: entry.observedAt, source: entry.source, status: entry.status })), claims: claims.map((claim) => ({ claimId: claim.claimId, sourceUrls: claim.sourceUrls || [], allowedUse: claim.allowedUse || 'reference' })) });
}
