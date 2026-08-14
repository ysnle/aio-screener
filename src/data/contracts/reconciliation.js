export const RECONCILIATION_STATUS = Object.freeze(['MATCH', 'PARTIAL', 'BLOCKED', 'NOT_APPLICABLE']);

export function createReconciliationStatus(input = {}) {
  return Object.freeze({
    schemaVersion: String(input.schemaVersion || 'reconciliation-status-v1'),
    generatedAt: input.generatedAt || null,
    revision: String(input.revision || 'unpublished'),
    overall: RECONCILIATION_STATUS.includes(input.overall) ? input.overall : 'BLOCKED',
    counts: Object.freeze({ ...(input.counts || {}) }),
    categories: Object.freeze(Array.isArray(input.categories) ? input.categories.map((category) => Object.freeze({ ...category })) : []),
    closure: Object.freeze({ ...(input.closure || {}) })
  });
}

export function validateReconciliationStatus(status, expectedCount = 22) {
  const errors = [];
  if (!status || typeof status !== 'object') errors.push('status_not_object');
  if (!status?.generatedAt || Number.isNaN(Date.parse(status.generatedAt))) errors.push('generatedAt_missing_or_invalid');
  if (!status?.revision || status.revision === 'unpublished') errors.push('revision_missing');
  if (!RECONCILIATION_STATUS.includes(status?.overall)) errors.push('overall_invalid');
  if (!Array.isArray(status?.categories) || status.categories.length !== expectedCount) errors.push(`category_count_invalid:${status?.categories?.length || 0}`);
  const seen = new Set();
  for (const category of status?.categories || []) {
    if (!category?.categoryId || seen.has(category.categoryId)) errors.push(`category_identity_invalid:${category?.categoryId || 'missing'}`);
    seen.add(category?.categoryId);
    if (!RECONCILIATION_STATUS.includes(category?.status)) errors.push(`category_status_invalid:${category?.categoryId || 'missing'}`);
    if (!category?.reason) errors.push(`category_reason_missing:${category?.categoryId || 'missing'}`);
    if (!category?.refresh?.cadence || !category?.refresh?.mode || !category?.refresh?.producer) errors.push(`category_refresh_contract_missing:${category?.categoryId || 'missing'}`);
    if (category?.refresh?.dailyAuditRequired !== true) errors.push(`category_daily_audit_missing:${category?.categoryId || 'missing'}`);
    if (!Array.isArray(category?.refresh?.artifacts) || category.refresh.artifacts.length === 0) errors.push(`category_artifacts_missing:${category?.categoryId || 'missing'}`);
    if (!Array.isArray(category?.refresh?.consumers) || category.refresh.consumers.length === 0) errors.push(`category_consumers_missing:${category?.categoryId || 'missing'}`);
    if (!Array.isArray(category?.origins) || category.origins.length === 0) errors.push(`category_origins_missing:${category?.categoryId || 'missing'}`);
    for (const origin of category?.origins || []) {
      if (!origin?.id || !origin?.authority || !origin?.sourceKind || !origin?.access || !origin?.url || !Array.isArray(origin?.fields) || origin.fields.length === 0) errors.push(`category_origin_invalid:${category?.categoryId || 'missing'}:${origin?.id || 'missing'}`);
    }
    if (!category?.evidence || !Number.isInteger(category.evidence.observed) || !Number.isInteger(category.evidence.required)) errors.push(`category_evidence_missing:${category?.categoryId || 'missing'}`);
    if (category?.status === 'MATCH' && category.evidence.observed < category.evidence.required) errors.push(`category_match_evidence_insufficient:${category?.categoryId || 'missing'}`);
  }
  const unresolved = (status?.categories || []).filter((category) => category.status !== 'MATCH').map((category) => category.categoryId).sort();
  const declaredUnresolved = Array.isArray(status?.closure?.unresolvedCategories) ? [...status.closure.unresolvedCategories].sort() : null;
  if (!declaredUnresolved || JSON.stringify(unresolved) !== JSON.stringify(declaredUnresolved)) errors.push('closure_unresolved_categories_drift');
  if (status?.closure?.complete === true && unresolved.length) errors.push('closure_complete_with_unresolved_categories');
  if (status?.closure?.sourceRegistry?.categoryCount !== expectedCount || status?.closure?.sourceRegistry?.dailyAuditCoverage !== expectedCount) errors.push('closure_source_registry_coverage_invalid');
  if (!Array.isArray(status?.closure?.sourceRegistry?.criticalDataGaps) || status.closure.sourceRegistry.criticalDataGaps.length === 0) errors.push('closure_critical_data_gaps_missing');
  for (const gap of status?.closure?.sourceRegistry?.criticalDataGaps || []) {
    if (!gap?.id || !gap?.priority || !gap?.status || !gap?.reason || !gap?.requiredOrigin || !gap?.allowedInterimUse) errors.push(`closure_critical_gap_invalid:${gap?.id || 'missing'}`);
    if (gap?.priority === 'P0' && gap?.status !== 'BLOCKED' && (!gap?.validationGate || !gap?.implementedScope || !gap?.remainingLimit)) errors.push(`closure_p0_gap_ungated_partial:${gap?.id || 'missing'}`);
  }
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
