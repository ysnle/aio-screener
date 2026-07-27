export const OPERATIONS_STATUS = Object.freeze(['CURRENT', 'DEGRADED', 'BLOCKED', 'OPERATOR_REQUIRED', 'UNKNOWN']);
export const RIGHTS_STATUS = Object.freeze(['VERIFIED', 'REVIEW_REQUIRED', 'OPERATOR_REQUIRED', 'UNAVAILABLE', 'UNKNOWN']);

export function createOperationsStatus(input = {}) {
  return Object.freeze({
    schemaVersion: String(input.schemaVersion || 'operations-status-v1'),
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
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
