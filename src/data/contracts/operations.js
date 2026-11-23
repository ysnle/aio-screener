export const OPERATIONS_STATUS = Object.freeze(['CURRENT', 'DEGRADED', 'BLOCKED', 'OPERATOR_REQUIRED', 'NO_ROUTE', 'UNKNOWN']);
export const RIGHTS_STATUS = Object.freeze(['VERIFIED', 'REVIEW_REQUIRED', 'OPERATOR_REQUIRED', 'UNAVAILABLE', 'UNKNOWN']);
export const OPERATIONAL_STATE_CODES = Object.freeze(['NOT_CONFIGURED', 'CONFIGURED_HEALTHY', 'CONFIGURED_BROKEN', 'STALE', 'NOT_OBSERVED', 'RIGHTS_REVIEW_REQUIRED']);
export const FEATURE_AVAILABILITY = Object.freeze(['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN']);
export const DOMAIN_RECEIPT_PUBLICATION_STATUS = Object.freeze(['SUCCESS', 'PARTIAL', 'NO_REFRESH_RETAINED', 'EMPTY', 'NOT_ATTEMPTED']);

export function createOperationsStatus(input = {}) {
  return Object.freeze({
    schemaVersion: String(input.schemaVersion || 'operations-status-v1'),
    statusVocabulary: OPERATIONS_STATUS,
    statusCodeVocabulary: OPERATIONAL_STATE_CODES,
    rightsVocabulary: RIGHTS_STATUS,
    generatedAt: input.generatedAt || null,
    appRevision: String(input.appRevision || 'unknown'),
    dataRevision: String(input.dataRevision || 'unknown'),
    evidenceRevision: String(input.evidenceRevision || 'unknown'),
    overall: OPERATIONS_STATUS.includes(input.overall) ? input.overall : 'UNKNOWN',
    overallBasis: input.overallBasis && typeof input.overallBasis === 'object'
      ? Object.freeze({
        planes: Object.freeze(Array.isArray(input.overallBasis.planes) ? input.overallBasis.planes.map(String) : []),
        excludes: Object.freeze(Array.isArray(input.overallBasis.excludes) ? input.overallBasis.excludes.map(String) : []),
        ...(input.overallBasis.includesBlockers === true ? { includesBlockers: true } : {}),
        note: input.overallBasis.note ? String(input.overallBasis.note) : null
      })
      : Object.freeze({ planes: Object.freeze([]), excludes: Object.freeze([]), note: null }),
    featureAvailability: input.featureAvailability && typeof input.featureAvailability === 'object'
      ? Object.freeze(Object.fromEntries(Object.entries(input.featureAvailability).map(([feature, entry]) => [String(feature), Object.freeze({
        availability: FEATURE_AVAILABILITY.includes(entry?.availability) ? entry.availability : 'UNKNOWN',
        asOf: entry?.asOf ? String(entry.asOf) : null,
        missingReason: entry?.missingReason ? String(entry.missingReason) : null,
        sources: Object.freeze(Array.isArray(entry?.sources) ? entry.sources.map(String) : [])
      })])))
      : Object.freeze({}),
    domainReceipts: input.domainReceipts && typeof input.domainReceipts === 'object'
      ? Object.freeze(Object.fromEntries(Object.entries(input.domainReceipts).map(([domain, entry]) => [String(domain), Object.freeze({
        publicationStatus: DOMAIN_RECEIPT_PUBLICATION_STATUS.includes(entry?.publicationStatus) ? entry.publicationStatus : 'NOT_ATTEMPTED',
        userCopy: entry?.userCopy ? String(entry.userCopy) : null,
        lastSuccessfulObservation: entry?.lastSuccessfulObservation ? String(entry.lastSuccessfulObservation) : null,
        counts: entry?.counts && typeof entry.counts === 'object'
          ? Object.freeze({
            eligible: Number(entry.counts.eligible) || 0,
            attempted: Number(entry.counts.attempted) || 0,
            updated: Number(entry.counts.updated) || 0,
            retained: Number(entry.counts.retained) || 0
          })
          : null
      })])))
      : Object.freeze({}),
    planes: input.planes && typeof input.planes === 'object' ? Object.freeze({ ...input.planes }) : Object.freeze({}),
    ai: input.ai && typeof input.ai === 'object' ? Object.freeze({ ...input.ai }) : Object.freeze({}),
    providers: input.providers && typeof input.providers === 'object' ? Object.freeze({ ...input.providers }) : Object.freeze({}),
    reconciliation: input.reconciliation && typeof input.reconciliation === 'object' ? Object.freeze({ ...input.reconciliation }) : Object.freeze({}),
    // No `routes` field: route ownership is code state (architecture/route-owners.json), not published data.
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
  // A declaration a consumer cannot see is not a declaration: if the artifact
  // ships the rights vocabulary it must be complete.
  if (status?.rightsVocabulary && (!Array.isArray(status.rightsVocabulary) || !RIGHTS_STATUS.every(code => status.rightsVocabulary.includes(code)))) {
    errors.push('rights_vocabulary_incomplete');
  }
  const statusCodes = new Set(OPERATIONAL_STATE_CODES);
  const statuses = new Set(OPERATIONS_STATUS);
  const rights = new Set(RIGHTS_STATUS);
  const availabilities = new Set(FEATURE_AVAILABILITY);
  const readinessKeys = new Set(['secretConfigured', 'workflowWired', 'lastCallSucceeded', 'dataCurrent']);
  const surface = { overall: status?.overall, planes: status?.planes, ai: status?.ai, providers: status?.providers, featureAvailability: status?.featureAvailability };
  const walk = (node, path) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') {
        if (key === 'status' && !statuses.has(value)) errors.push(`undeclared_status:${path}`);
        if (key === 'statusCode' && !statusCodes.has(value)) errors.push(`undeclared_status_code:${path}`);
        if ((key === 'rights' || key === 'licensedForUse') && !rights.has(value)) errors.push(`undeclared_rights:${path}`);
        if (key === 'availability' && !availabilities.has(value)) errors.push(`undeclared_availability:${path}`);
        if (readinessKeys.has(key) && !statuses.has(value)) errors.push(`undeclared_readiness:${path}`);
      }
      walk(value, `${path}.${key}`);
    }
  };
  walk(surface, 'operations');
  const domainStatuses = new Set(DOMAIN_RECEIPT_PUBLICATION_STATUS);
  for (const [domain, entry] of Object.entries(status?.domainReceipts || {})) {
    if (!domainStatuses.has(entry?.publicationStatus)) errors.push(`undeclared_domain_publication_status:${domain}`);
  }
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
