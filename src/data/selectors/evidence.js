import { evaluateEvidence, normalizeAllowedUse, restrictAllowedUse } from '../contracts/evidence.js';

function entriesOf(source) {
  if (source instanceof Map) return [...source.entries()];
  if (Array.isArray(source)) return source.map((value, index) => [value?.metric || value?.evidenceId || String(index), value]);
  if (source && typeof source === 'object') return Object.entries(source);
  return [];
}

function readEvidence(source, metric) {
  if (!metric) return null;
  if (source instanceof Map) return source.get(metric) || null;
  if (Array.isArray(source)) return source.find((entry) => entry?.metric === metric || entry?.evidenceId === metric) || null;
  return source && typeof source === 'object' ? source[metric] || null : null;
}

function normalized(evidence) {
  if (!evidence || typeof evidence !== 'object') return null;
  const requestedUse = normalizeAllowedUse(evidence.allowedUse, 'none');
  const allowedUseCeiling = normalizeAllowedUse(evidence.allowedUseCeiling, requestedUse === 'reference' ? 'reference' : 'none');
  return {
    ...evidence,
    allowedUseCeiling,
    // Missing grants are not inferred from status, freshness, source labels,
    // or a legacy boolean. The contract creator may supply an explicit grant.
    allowedUse: restrictAllowedUse(requestedUse, allowedUseCeiling)
  };
}

/** Return evidence that may be displayed, including reference-only values. */
export function selectForDisplay(source, metric) {
  const value = normalized(metric ? readEvidence(source, metric) : source);
  if (!value || value.allowedUse === 'none' || value.status === 'missing' || value.status === 'failed') return null;
  if (value.value == null || (typeof value.value === 'number' && !Number.isFinite(value.value))) return null;
  return value;
}

/** Return only current decision evidence. Reference/LKG values never pass. */
export function selectForDecision(source, metric, { now = Date.now() } = {}) {
  const value = normalized(metric ? readEvidence(source, metric) : source);
  if (!value || !evaluateEvidence(value, { purpose: 'decision', now }).ok) return null;
  if (value.value == null || (typeof value.value === 'number' && !Number.isFinite(value.value))) return null;
  return value;
}

/** Return the last known value only for an explicitly non-decision context. */
export function selectLastKnown(source, metric) {
  const value = selectForDisplay(source, metric);
  if (!value || value.value == null) return null;
  return value;
}

export function selectCompleteness(source, requiredMetrics = [], purpose = 'decision') {
  const required = [...new Set((requiredMetrics || []).map(String).filter(Boolean))];
  const rows = required.map((metric) => {
    const evidence = purpose === 'decision'
      ? selectForDecision(source, metric)
      : selectForDisplay(source, metric);
    const raw = normalized(readEvidence(source, metric));
    return { metric, evidence, status: raw?.status || 'missing', allowedUse: raw?.allowedUse || 'none', ok: !!evidence };
  });
  const available = rows.filter((row) => row.ok).length;
  return Object.freeze({ required: required.length, available, missing: rows.filter((row) => !row.ok).map((row) => row.metric), coveragePct: required.length ? (available / required.length) * 100 : 100, rows });
}

export function selectEvidenceMap(source, purpose = 'display') {
  const selector = purpose === 'decision' ? selectForDecision : selectForDisplay;
  return Object.fromEntries(entriesOf(source).map(([metric]) => [metric, selector(source, metric)]));
}
