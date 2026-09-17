// P1091: NO_ROUTE is a real operational state the artifact already published
// (`ai.publicChat.status`) but never declared, so the vocabulary must name it.
export const OPERATIONS_STATUS = Object.freeze(['CURRENT', 'DEGRADED', 'BLOCKED', 'OPERATOR_REQUIRED', 'NO_ROUTE', 'UNKNOWN']);
export const RIGHTS_STATUS = Object.freeze(['VERIFIED', 'REVIEW_REQUIRED', 'OPERATOR_REQUIRED', 'UNAVAILABLE', 'UNKNOWN']);
export const OPERATIONAL_STATE_CODES = Object.freeze(['NOT_CONFIGURED', 'CONFIGURED_HEALTHY', 'CONFIGURED_BROKEN', 'STALE', 'RIGHTS_REVIEW_REQUIRED']);

export function createOperationsStatus(input = {}) {
  return Object.freeze({
    schemaVersion: String(input.schemaVersion || 'operations-status-v1'),
    // P1091: this field used to publish OPERATIONAL_STATE_CODES under the name
    // `statusVocabulary`, so the declared vocabulary and the values actually used
    // for `overall`/`planes.*.status` had zero overlap and no consumer could
    // interpret them. `status` and `statusCode` are two different axes and now
    // declare two differently named vocabularies.
    statusVocabulary: OPERATIONS_STATUS,
    statusCodeVocabulary: OPERATIONAL_STATE_CODES,
    generatedAt: input.generatedAt || null,
    appRevision: String(input.appRevision || 'unknown'),
    dataRevision: String(input.dataRevision || 'unknown'),
    evidenceRevision: String(input.evidenceRevision || 'unknown'),
    overall: OPERATIONS_STATUS.includes(input.overall) ? input.overall : 'UNKNOWN',
    planes: input.planes && typeof input.planes === 'object' ? Object.freeze({ ...input.planes }) : Object.freeze({}),
    ai: input.ai && typeof input.ai === 'object' ? Object.freeze({ ...input.ai }) : Object.freeze({}),
    providers: input.providers && typeof input.providers === 'object' ? Object.freeze({ ...input.providers }) : Object.freeze({}),
    reconciliation: input.reconciliation && typeof input.reconciliation === 'object' ? Object.freeze({ ...input.reconciliation }) : Object.freeze({}),
    routes: input.routes && typeof input.routes === 'object' ? Object.freeze({ ...input.routes }) : Object.freeze({}),
    blockers: Object.freeze(Array.isArray(input.blockers) ? input.blockers.map(String) : [])
  });
}

export function validateOperationsStatus(status) {
  const errors = [];
  if (!status || typeof status !== 'object') errors.push('status_not_object');
  if (!status?.generatedAt || Number.isNaN(Date.parse(status.generatedAt))) errors.push('generatedAt_missing_or_invalid');
  for (const field of ['appRevision', 'dataRevision', 'evidenceRevision']) if (!status?.[field] || status[field] === 'unknown') errors.push(`${field}_missing`);
  if (!OPERATIONS_STATUS.includes(status?.overall)) errors.push('overall_invalid');
  if (!status?.planes?.durable?.status) errors.push('durable_plane_missing');
  if (!status?.planes?.fast?.status) errors.push('fast_plane_missing');
  if (!status?.providers || Object.keys(status.providers).length === 0) errors.push('providers_missing');
  if (status?.reconciliation?.categoryCount !== 22) errors.push('reconciliation_category_count_invalid');
  if (!Array.isArray(status?.statusVocabulary) || !OPERATIONS_STATUS.every(code => status.statusVocabulary.includes(code))) errors.push('status_vocabulary_missing');
  if (!Array.isArray(status?.statusCodeVocabulary) || !OPERATIONAL_STATE_CODES.every(code => status.statusCodeVocabulary.includes(code))) errors.push('status_code_vocabulary_missing');

  // Every published `status` value must be interpretable with the vocabulary the
  // same artifact declares. Walk the operational surface rather than trusting the
  // top-level field alone.
  const statusCodes = new Set(OPERATIONAL_STATE_CODES);
  const statuses = new Set(OPERATIONS_STATUS);
  const surface = { overall: status?.overall, planes: status?.planes, ai: status?.ai };
  const walk = (node, path) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'status' && typeof value === 'string' && !statuses.has(value)) errors.push(`undeclared_status:${path}`);
      if (key === 'statusCode' && typeof value === 'string' && !statusCodes.has(value)) errors.push(`undeclared_status_code:${path}`);
      walk(value, `${path}.${key}`);
    }
  };
  walk(surface, 'operations');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
