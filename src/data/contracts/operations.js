// P1091: NO_ROUTE is a real operational state the artifact already published
// (`ai.publicChat.status`) but never declared, so the vocabulary must name it.
export const OPERATIONS_STATUS = Object.freeze(['CURRENT', 'DEGRADED', 'BLOCKED', 'OPERATOR_REQUIRED', 'NO_ROUTE', 'UNKNOWN']);
export const RIGHTS_STATUS = Object.freeze(['VERIFIED', 'REVIEW_REQUIRED', 'OPERATOR_REQUIRED', 'UNAVAILABLE', 'UNKNOWN']);
export const OPERATIONAL_STATE_CODES = Object.freeze(['NOT_CONFIGURED', 'CONFIGURED_HEALTHY', 'CONFIGURED_BROKEN', 'STALE', 'NOT_OBSERVED', 'RIGHTS_REVIEW_REQUIRED']);
// P1173 (17 작업 단위 5): `overall`/`planes.*.status` says what an operator's pipeline is doing. It does
// not say which features a user can actually rely on right now, and it is derived from the durable plane
// alone — so a browser plane that was never observed leaves `overall` unchanged. Feature availability is
// therefore a separate axis with its own closed vocabulary.
export const FEATURE_AVAILABILITY = Object.freeze(['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN']);
// P1256 (E5 O06 / 06 O06): 도메인 receipt의 발행 상태는 수집 성공의 어휘이다 —
// "기존값 유지(NO_REFRESH_RETAINED)"는 성공이 아니며, NOT_ATTEMPTED는 결과가 아니다.
export const DOMAIN_RECEIPT_PUBLICATION_STATUS = Object.freeze(['SUCCESS', 'PARTIAL', 'NO_REFRESH_RETAINED', 'EMPTY', 'NOT_ATTEMPTED']);

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
    // P1103: RIGHTS_STATUS was declared here but never published, so the
    // `rights`/`licensedForUse` values (REVIEW_REQUIRED, OPERATOR_REQUIRED) were
    // unfalsifiable for a consumer that only had the artifact.
    rightsVocabulary: RIGHTS_STATUS,
    generatedAt: input.generatedAt || null,
    appRevision: String(input.appRevision || 'unknown'),
    dataRevision: String(input.dataRevision || 'unknown'),
    evidenceRevision: String(input.evidenceRevision || 'unknown'),
    overall: OPERATIONS_STATUS.includes(input.overall) ? input.overall : 'UNKNOWN',
    // P1173 (17 작업 단위 5): a field the contract drops is not published. The aggregate's scope and the
    // per-feature availability have to survive normalization to be readable by a consumer at all.
    overallBasis: input.overallBasis && typeof input.overallBasis === 'object'
      ? Object.freeze({
        planes: Object.freeze(Array.isArray(input.overallBasis.planes) ? input.overallBasis.planes.map(String) : []),
        excludes: Object.freeze(Array.isArray(input.overallBasis.excludes) ? input.overallBasis.excludes.map(String) : []),
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
    // P1256: 도메인 receipt의 소비 결과 — 원본 receipt의 `publication.status`는 이 표면에서
    // 선언 어휘와 겹치지 않도록 `publicationStatus`로 이름을 바꿔 실어 나른다.
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
  // P1256: 도메인 receipt의 publicationStatus도 선언 어휘로 해석 가능해야 한다.
  const domainStatuses = new Set(DOMAIN_RECEIPT_PUBLICATION_STATUS);
  for (const [domain, entry] of Object.entries(status?.domainReceipts || {})) {
    if (!domainStatuses.has(entry?.publicationStatus)) errors.push(`undeclared_domain_publication_status:${domain}`);
  }
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
