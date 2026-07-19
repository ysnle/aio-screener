export const AI_RESPONSE_SCHEMA_VERSION = 'ai-response.v1';

export function createAIResponseEnvelope({ requestId = null, route = 'home', status = 'blocked', text = '', citations = [], evidenceIds = [], policy = null, model = null } = {}) {
  return Object.freeze({ schemaVersion: AI_RESPONSE_SCHEMA_VERSION, requestId, route, status, text: String(text || ''), citations: Array.isArray(citations) ? citations.filter((url) => /^https:\/\//i.test(String(url))).map(String) : [], evidenceIds: Array.isArray(evidenceIds) ? evidenceIds.map(String) : [], policy: policy || { allowed: status === 'ok' }, model: model || null, createdAt: new Date().toISOString() });
}

export function validateAIResponseEnvelope(envelope) {
  const errors = [];
  if (!envelope || envelope.schemaVersion !== AI_RESPONSE_SCHEMA_VERSION) errors.push('schema_version_invalid');
  if (!['ok', 'partial', 'blocked', 'unavailable'].includes(envelope?.status)) errors.push('status_invalid');
  if (!Array.isArray(envelope?.evidenceIds)) errors.push('evidence_ids_invalid');
  if (envelope?.status === 'ok' && !envelope.evidenceIds.length && !envelope.citations.length) errors.push('traceability_missing');
  return Object.freeze({ ok: errors.length === 0, errors });
}
