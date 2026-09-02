export const AI_RESPONSE_SCHEMA_VERSION = 'ai-response.v1';

export function createAIResponseEnvelope({ requestId = null, route = 'home', status = 'blocked', text = '', citations = [], evidenceIds = [], policy = null, model = null, now = Date.now() } = {}) {
  const createdAt = new Date(now);
  return Object.freeze({ schemaVersion: AI_RESPONSE_SCHEMA_VERSION, requestId, route, status, text: String(text || ''), citations: Object.freeze(Array.isArray(citations) ? citations.filter((url) => /^https:\/\//i.test(String(url))).map(String) : []), evidenceIds: Object.freeze(Array.isArray(evidenceIds) ? evidenceIds.map(String) : []), policy: Object.freeze(policy && typeof policy === 'object' ? { ...policy } : { allowed: status === 'ok' }), model: model || null, createdAt: Number.isNaN(createdAt.getTime()) ? null : createdAt.toISOString() });
}

export function validateAIResponseEnvelope(envelope) {
  const errors = [];
  if (!envelope || envelope.schemaVersion !== AI_RESPONSE_SCHEMA_VERSION) errors.push('schema_version_invalid');
  if (!['ok', 'partial', 'blocked', 'unavailable'].includes(envelope?.status)) errors.push('status_invalid');
  const evidenceIds = Array.isArray(envelope?.evidenceIds) ? envelope.evidenceIds : [];
  const citations = Array.isArray(envelope?.citations) ? envelope.citations : [];
  if (!Array.isArray(envelope?.evidenceIds)) errors.push('evidence_ids_invalid');
  if (!Array.isArray(envelope?.citations)) errors.push('citations_invalid');
  if (!envelope?.createdAt || Number.isNaN(Date.parse(envelope.createdAt))) errors.push('created_at_invalid');
  if (envelope?.status === 'ok' && !evidenceIds.length && !citations.length) errors.push('traceability_missing');
  return Object.freeze({ ok: errors.length === 0, errors });
}
