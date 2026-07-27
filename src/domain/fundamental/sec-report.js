export const SEC_REPORT_MODEL_VERSION = 'sec-report.v1';

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

export function deriveSecReport(fundamentals = null) {
  const input = fundamentals && typeof fundamentals === 'object' ? fundamentals : {};
  const coverage = Array.isArray(input.coverage) ? input.coverage.filter((field) => typeof field === 'string') : [];
  const metrics = METRIC_DEFINITIONS
    .filter(([key]) => coverage.includes(key) && finite(input[key]) != null)
    .map(([key, label, unit]) => Object.freeze({ key, label, unit, value: finite(input[key]) }));
  const status = metrics.length > 0 ? 'current' : 'unavailable';
  return Object.freeze({
    modelVersion: SEC_REPORT_MODEL_VERSION,
    status,
    symbol: input.symbol ? String(input.symbol).toUpperCase() : null,
    entityName: input.entityName ? String(input.entityName) : null,
    form: input.form ? String(input.form) : null,
    cik: input.cik ? String(input.cik) : null,
    accession: input.accession ? String(input.accession) : null,
    periodType: input.periodType ? String(input.periodType) : null,
    observedAt: input.observedAt || null,
    filedAt: input.filedAt || null,
    fetchedAt: input.fetchedAt || null,
    source: input.source || 'SEC EDGAR companyfacts',
    sourceKind: input.sourceTier || 'official-regulator',
    allowedUse: input.allowedUse || 'research/reference',
    coverage: Object.freeze([...new Set(coverage)]),
    metrics: Object.freeze(metrics)
  });
}
