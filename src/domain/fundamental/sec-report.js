export const SEC_REPORT_MODEL_VERSION = 'sec-report.v2';
export const SEC_FRESHNESS_POLICY = Object.freeze({
  currentMaxAgeDays: 400,
  agedMaxAgeDays: 730,
  futureSkewDays: 2
});

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const METRIC_DEFINITIONS = Object.freeze([
  ['revenue', 'Revenue', 'currency'],
  ['netIncome', 'Net income', 'currency'],
  ['equity', 'Equity', 'currency'],
  ['sharesOutstanding', 'Shares outstanding', 'shares'],
  ['revGrowth', 'Revenue growth', 'percent'],
  ['margin', 'Net margin', 'percent'],
  ['roe', 'ROE', 'percent'],
  ['pe', 'P/E', 'multiple'],
  ['pb', 'P/B', 'multiple']
]);

function classifyFreshness(observedAt, now = Date.now()) {
  const observedMs = observedAt ? Date.parse(String(observedAt)) : NaN;
  if (!Number.isFinite(observedMs)) return Object.freeze({ state: 'unknown', ageDays: null, decisionEligible: false });
  const ageDays = Math.floor((now - observedMs) / 86400000);
  if (ageDays < -SEC_FRESHNESS_POLICY.futureSkewDays) return Object.freeze({ state: 'unknown', ageDays: null, decisionEligible: false });
  if (ageDays <= SEC_FRESHNESS_POLICY.currentMaxAgeDays) return Object.freeze({ state: 'current', ageDays: Math.max(0, ageDays), decisionEligible: true });
  if (ageDays <= SEC_FRESHNESS_POLICY.agedMaxAgeDays) return Object.freeze({ state: 'aged', ageDays, decisionEligible: false });
  return Object.freeze({ state: 'historical', ageDays, decisionEligible: false });
}

function detectAnomalies(input, metrics) {
  const anomalies = [];
  metrics.forEach(metric => {
    if (['revenue', 'netIncome', 'equity'].includes(metric.key) && metric.value < 0) anomalies.push(`${metric.key}:negative`);
    if (['margin', 'roe'].includes(metric.key) && Math.abs(metric.value) > 1000) anomalies.push(`${metric.key}:outlier`);
    if (metric.key === 'revGrowth' && metric.value < -100) anomalies.push('revGrowth:below-minus-100');
  });
  if (input.anomaly === true || (Array.isArray(input.anomalies) && input.anomalies.length)) anomalies.push(...(input.anomalies || ['producer-flagged-anomaly']));
  return [...new Set(anomalies)];
}

export function deriveSecReport(fundamentals = null) {
  const input = fundamentals && typeof fundamentals === 'object' ? fundamentals : {};
  const coverage = Array.isArray(input.coverage) ? input.coverage.filter((field) => typeof field === 'string') : [];
  const metrics = METRIC_DEFINITIONS
    .filter(([key]) => coverage.includes(key) && finite(input[key]) != null)
    .map(([key, label, unit]) => Object.freeze({ key, label, unit, value: finite(input[key]) }));
  const anomalies = detectAnomalies(input, metrics);
  const notApplicable = input.notApplicable === true || input.applicability === 'not-applicable';
  const classification = notApplicable ? 'not-applicable' : metrics.length > 0 ? 'current' : 'missing';
  const status = notApplicable ? 'not-applicable' : anomalies.length ? 'quarantined' : metrics.length > 0 ? 'current' : 'unavailable';
  const observedAt = input.observedAt || null;
  const freshness = classifyFreshness(observedAt);
  return Object.freeze({
    modelVersion: SEC_REPORT_MODEL_VERSION,
    status,
    classification,
    anomalyStatus: anomalies.length ? 'quarantined' : 'none',
    anomalies: Object.freeze(anomalies),
    symbol: input.symbol ? String(input.symbol).toUpperCase() : null,
    entityName: input.entityName ? String(input.entityName) : null,
    form: input.form ? String(input.form) : null,
    cik: input.cik ? String(input.cik) : null,
    accession: input.accession ? String(input.accession) : null,
    periodType: input.periodType ? String(input.periodType) : null,
    observedAt,
    filedAt: input.filedAt || null,
    fetchedAt: input.fetchedAt || null,
    filingMetadata: Object.freeze({ form: input.form || null, cik: input.cik || null, accession: input.accession || null, filedAt: input.filedAt || null }),
    source: input.source || 'SEC EDGAR companyfacts',
    sourceKind: input.sourceTier || 'official-regulator',
    allowedUse: input.allowedUse || 'research/reference',
    freshness,
    decisionEligible: status === 'current' && freshness.decisionEligible === true && input.allowedUse === 'decision',
    coverage: Object.freeze([...new Set(coverage)]),
    metrics: Object.freeze(anomalies.length ? [] : metrics),
    quarantinedMetrics: Object.freeze(anomalies.length ? metrics : [])
  });
}
