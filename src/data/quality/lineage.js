export const LINEAGE_STATES = Object.freeze(['MATCH', 'PARTIAL', 'BLOCKED', 'NOT_APPLICABLE']);

export function createLineageRecord(input = {}) {
  return Object.freeze({
    metricId: String(input.metricId || ''),
    evidenceId: String(input.evidenceId || ''),
    source: String(input.source || ''),
    sourceKind: String(input.sourceKind || ''),
    observedAt: input.observedAt || null,
    fetchedAt: input.fetchedAt || null,
    unit: String(input.unit || ''),
    state: LINEAGE_STATES.includes(input.state) ? input.state : 'BLOCKED',
    note: String(input.note || '')
  });
}

export function validateLineageRecord(record) {
  const errors = [];
  if (!record?.metricId) errors.push('metric_id_missing');
  if (!record?.evidenceId) errors.push('evidence_id_missing');
  if (!record?.source) errors.push('source_missing');
  if (!record?.sourceKind) errors.push('source_kind_missing');
  if (!record?.unit) errors.push('unit_missing');
  if (!LINEAGE_STATES.includes(record?.state)) errors.push('state_invalid');
  for (const field of ['observedAt', 'fetchedAt']) {
    if (record?.[field] != null && Number.isNaN(Date.parse(record[field]))) errors.push(`${field}_invalid`);
  }
  if (record?.state === 'MATCH') {
    if (!record.observedAt) errors.push('observedAt_missing');
    if (!record.fetchedAt) errors.push('fetchedAt_missing');
  }
  const observedMs = Date.parse(record?.observedAt || '');
  const fetchedMs = Date.parse(record?.fetchedAt || '');
  if (Number.isFinite(observedMs) && Number.isFinite(fetchedMs) && fetchedMs < observedMs) errors.push('fetchedAt_before_observedAt');
  return Object.freeze({ ok: errors.length === 0, errors });
}
