export const SEC_REPORT_MODEL_VERSION = 'sec-report.v3';
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
  if (input.anomaly === true) anomalies.push('producer-flagged-anomaly');
  if (Array.isArray(input.anomalies)) anomalies.push(...input.anomalies.map((value) => String(value || '').trim()).filter(Boolean));
  return [...new Set(anomalies)];
}

function observationEffectiveAt(row) {
  return row?.acceptedAt || row?.effectiveAt || row?.filedAt || null;
}

function selectObservationAsOf(rows, asOfMs, periodEnd = null) {
  const eligible = (Array.isArray(rows) ? rows : []).filter((row) => {
    const effectiveMs = Date.parse(observationEffectiveAt(row) || '');
    return Number.isFinite(effectiveMs) && effectiveMs <= asOfMs && finite(row?.value) != null && (!periodEnd || row.periodEnd === periodEnd);
  });
  eligible.sort((a, b) => String(b.periodEnd || '').localeCompare(String(a.periodEnd || '')) || Date.parse(observationEffectiveAt(b)) - Date.parse(observationEffectiveAt(a)));
  return eligible[0] || null;
}

// Reconstructs only what the SEC artifact says was public by `asOf`. Price-based
// ratios are emitted only when the caller supplies a contemporaneous price;
// current prices are never projected backward into a historical filing cut.
export function selectSecFundamentalsAsOf(record = {}, asOf, { priceAsOf = null } = {}) {
  const asOfMs = Date.parse(asOf || '');
  const observations = record?.pit?.observations || {};
  if (!Number.isFinite(asOfMs) || !observations || typeof observations !== 'object') return null;
  const revenue = selectObservationAsOf(observations.revenue, asOfMs);
  if (!revenue) return null;
  const netIncome = selectObservationAsOf(observations.netIncome, asOfMs, revenue.periodEnd)
    || selectObservationAsOf(observations.netIncome, asOfMs);
  if (!netIncome) return null;
  const equity = selectObservationAsOf(observations.equity, asOfMs, revenue.periodEnd)
    || selectObservationAsOf(observations.equity, asOfMs);
  const shares = selectObservationAsOf(observations.sharesOutstanding, asOfMs, revenue.periodEnd)
    || selectObservationAsOf(observations.sharesOutstanding, asOfMs);
  const priorRevenue = (Array.isArray(observations.revenue) ? observations.revenue : [])
    .filter((row) => row?.periodEnd && row.periodEnd < revenue.periodEnd && Date.parse(observationEffectiveAt(row) || '') <= asOfMs && finite(row.value) != null)
    .sort((a, b) => String(b.periodEnd).localeCompare(String(a.periodEnd)) || Date.parse(observationEffectiveAt(b)) - Date.parse(observationEffectiveAt(a)))[0] || null;
  const result = {
    symbol: record.symbol || null,
    cik: record.cik || null,
    entityName: record.entityName || null,
    source: record.source || 'SEC EDGAR companyfacts',
    sourceTier: record.sourceTier || 'official-regulator',
    model: 'sec-pit-asof-v1',
    periodType: 'FY',
    observedAt: revenue.periodEnd,
    filedAt: revenue.filedAt || null,
    acceptedAt: revenue.acceptedAt || null,
    effectiveAt: observationEffectiveAt(revenue),
    asOf: new Date(asOfMs).toISOString(),
    form: revenue.form || null,
    accession: revenue.accession || null,
    revenue: finite(revenue.value),
    netIncome: finite(netIncome.value),
    equity: finite(equity?.value),
    sharesOutstanding: finite(shares?.value),
    coverage: ['revenue', 'netIncome'],
    pointInTimeStatus: revenue.acceptedAt ? 'accepted-time' : 'filed-date-only'
  };
  if (priorRevenue && finite(priorRevenue.value) > 0) result.revGrowth = Math.round((result.revenue / finite(priorRevenue.value) - 1) * 1000) / 10;
  if (result.revenue !== 0) result.margin = Math.round(result.netIncome / result.revenue * 1000) / 10;
  if (result.equity > 0) result.roe = Math.round(result.netIncome / result.equity * 1000) / 10;
  const price = finite(priceAsOf);
  const marketCap = price > 0 && result.sharesOutstanding > 0 ? price * result.sharesOutstanding : null;
  if (marketCap && result.netIncome > 0) result.pe = Math.round(marketCap / result.netIncome * 100) / 100;
  if (marketCap && result.equity > 0) result.pb = Math.round(marketCap / result.equity * 100) / 100;
  ['equity', 'sharesOutstanding', 'revGrowth', 'margin', 'roe', 'pe', 'pb'].forEach((key) => {
    if (finite(result[key]) != null) result.coverage.push(key);
  });
  result.coverage = Object.freeze(result.coverage);
  return Object.freeze(result);
}

export function deriveSecReport(fundamentals = null) {
  const input = fundamentals && typeof fundamentals === 'object' ? fundamentals : {};
  const knownMetrics = new Set(METRIC_DEFINITIONS.map(([key]) => key));
  const coverage = Array.isArray(input.coverage) ? input.coverage.filter((field) => typeof field === 'string' && knownMetrics.has(field)) : [];
  const metrics = METRIC_DEFINITIONS
    .filter(([key]) => coverage.includes(key) && finite(input[key]) != null)
    .map(([key, label, unit]) => Object.freeze({ key, label, unit, value: finite(input[key]) }));
  const anomalies = detectAnomalies(input, metrics);
  const notApplicable = input.notApplicable === true || input.applicability === 'not-applicable';
  const classification = notApplicable ? 'not-applicable' : metrics.length > 0 ? 'current' : 'missing';
  const status = notApplicable ? 'not-applicable' : anomalies.length ? 'quarantined' : metrics.length > 0 ? 'current' : 'unavailable';
  const observedAt = input.observedAt || null;
  const freshness = classifyFreshness(observedAt);
  const pit = input?.pit && typeof input.pit === 'object' ? input.pit : null;
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
    filingMetadata: Object.freeze({ form: input.form || null, cik: input.cik || null, accession: input.accession || null, filedAt: input.filedAt || null, acceptedAt: input.acceptedAt || null }),
    pointInTime: Object.freeze({
      status: pit?.status || 'unavailable',
      observationCount: Math.max(0, finite(pit?.observationCount) || 0),
      acceptedTimeCount: Math.max(0, finite(pit?.acceptedTimeCount) || 0)
    }),
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
