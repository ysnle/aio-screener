// Local-first conditional evidence contract inspired by the supplied Edge
// Stats architecture.  This module is intentionally computation-only: data
// adapters, licensed providers and session calendars belong to producers.
import {
  classifyEvidenceLineage,
  normalizeEvidenceLineage,
  summarizeEvidenceLineage,
  EVIDENCE_LINEAGE_VERSION
} from './evidence-lineage.js';

export const CONDITIONAL_EVIDENCE_VERSION = 'conditional-evidence.v2';
export const CONDITIONAL_EVIDENCE_DISCLAIMER = '과거 조건부 빈도이며 예측이나 투자조언이 아닙니다.';

export const CONDITIONAL_EVIDENCE_REGISTRY = Object.freeze({
  gapFill: Object.freeze({
    id: 'gap-fill',
    label: '갭 충족·회귀',
    conditionFields: Object.freeze(['sessionType', 'gapDirection', 'gapSize', 'weekday']),
    outcomeFields: Object.freeze(['filledWithinSessions', 'fillTime', 'maxAdverseExcursion']),
    requiredInputs: Object.freeze(['one-minute-bars', 'exchange-calendar', 'session-features'])
  }),
  openingRange: Object.freeze({
    id: 'opening-range',
    label: '오프닝 레인지 돌파',
    conditionFields: Object.freeze(['sessionType', 'openingRangeMinutes', 'breakDirection', 'weekday']),
    outcomeFields: Object.freeze(['followThrough', 'closeAcceptance', 'maxExcursion']),
    requiredInputs: Object.freeze(['one-minute-bars', 'exchange-calendar', 'session-features'])
  }),
  seasonality: Object.freeze({
    id: 'seasonality',
    label: '세션 계절성',
    conditionFields: Object.freeze(['weekday', 'month', 'sessionNumber', 'regime']),
    outcomeFields: Object.freeze(['returnWindow', 'rangeExpansion', 'direction']),
    requiredInputs: Object.freeze(['one-minute-or-daily-bars', 'exchange-calendar', 'point-in-time-availability'])
  })
});

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestampMs(value) {
  if (value == null || value === '') return null;
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateYear(value) {
  const ms = timestampMs(value);
  return ms == null ? null : String(new Date(ms).getUTCFullYear());
}

function wilsonInterval(successes, trials, z = 1.959963984540054) {
  const n = finite(trials);
  const k = finite(successes);
  if (n == null || k == null || n <= 0 || k < 0 || k > n) return null;
  const p = k / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) / n) + (z2 / (4 * n * n)));
  return Object.freeze({
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    method: 'wilson-95',
    confidence: 0.95
  });
}

function quantile(values, probability) {
  if (!values.length) return null;
  const index = (values.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}

function distribution(values = []) {
  const sorted = values.map(finite).filter((value) => value != null).sort((a, b) => a - b);
  return Object.freeze({
    count: sorted.length,
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9)
  });
}

function safePredicate(predicate, row, fallback) {
  try { return Boolean(predicate(row)); } catch { return fallback; }
}

function rateSummary(rows, successPredicate, { minSampleRefuse = 10, minSampleWarn = 30 } = {}) {
  const trials = rows.length;
  const successes = rows.reduce((sum, row) => sum + (safePredicate(successPredicate, row, false) ? 1 : 0), 0);
  const estimate = trials >= minSampleRefuse ? successes / trials : null;
  return Object.freeze({
    trials,
    successes,
    estimate,
    confidenceInterval: trials >= minSampleRefuse ? wilsonInterval(successes, trials) : null,
    status: trials < minSampleRefuse ? 'REFUSE' : trials < minSampleWarn ? 'WARN' : 'READY'
  });
}

function intervalsOverlap(first, second) {
  if (!first?.confidenceInterval || !second?.confidenceInterval) return null;
  return first.confidenceInterval.low <= second.confidenceInterval.high
    && second.confidenceInterval.low <= first.confidenceInterval.high;
}

function normalizeObservation(row = {}) {
  const lineage = normalizeEvidenceLineage({
    sourceId: row.sourceId || row.source,
    sourceKind: row.sourceKind,
    rightsId: row.rightsId,
    rightsStatus: row.rightsStatus || row.dataRights,
    observedAt: row.observedAt,
    fetchedAt: row.fetchedAt,
    availableAt: row.availableAt,
    revisionId: row.revisionId || row.revision,
    watermark: row.watermark,
    timezone: row.timezone,
    calendarId: row.calendarId,
    calendarStatus: row.calendarStatus,
    provisional: row.provisional
  });
  const featureKeys = [
    'sessionType', 'weekday', 'month', 'sessionNumber', 'regime',
    'gapDirection', 'gapSize', 'openingRangeMinutes', 'breakDirection',
    'filledWithinSessions', 'fillTime', 'maxAdverseExcursion',
    'followThrough', 'closeAcceptance', 'maxExcursion', 'returnWindow',
    'rangeExpansion', 'direction'
  ];
  const features = Object.fromEntries(featureKeys
    .filter((key) => Object.hasOwn(row, key))
    .map((key) => [key, row[key]]));
  if (row.features && typeof row.features === 'object' && !Array.isArray(row.features)) features.features = { ...row.features };
  if (row.conditions && typeof row.conditions === 'object' && !Array.isArray(row.conditions)) features.conditions = { ...row.conditions };
  if (row.outcome && typeof row.outcome === 'object' && !Array.isArray(row.outcome)) features.outcome = { ...row.outcome };
  return Object.freeze({
    ...features,
    attributes: Object.freeze({ ...features }),
    sessionId: clean(row.sessionId || row.session || '') || null,
    instrumentId: clean(row.instrumentId || row.symbol || row.ticker || '') || null,
    eligible: row.eligible === true,
    success: typeof row.success === 'boolean' ? row.success : null,
    value: finite(row.value),
    observedAt: lineage.observedAt,
    lineage
  });
}

export function normalizeEvidenceObservation(row = {}) {
  return normalizeObservation(row);
}

function aggregatePerYear(rows, successPredicate, options) {
  const buckets = new Map();
  rows.forEach((row) => {
    const year = dateYear(row.observedAt) || 'UNKNOWN';
    if (!buckets.has(year)) buckets.set(year, []);
    buckets.get(year).push(row);
  });
  return Object.freeze(Object.fromEntries([...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, bucket]) => [year, rateSummary(bucket, successPredicate, options)])));
}

export function evaluateConditionalEvidence({
  observations = [],
  eligible = (row) => row?.eligible === true && typeof row?.success === 'boolean',
  success = (row) => row?.success === true,
  value = (row) => row?.value,
  queryEcho = '',
  conditionLabel = '',
  sourceId = null,
  observedAt = null,
  dataRights = 'UNKNOWN',
  calendarStatus = 'UNKNOWN',
  minSampleWarn = 30,
  minSampleRefuse = 10,
  recencyWindow = 250,
  now = Date.now()
} = {}) {
  const options = {
    minSampleWarn: Math.max(1, Number(minSampleWarn) || 30),
    minSampleRefuse: Math.max(1, Number(minSampleRefuse) || 10)
  };
  const rawRows = Array.isArray(observations) ? observations : [];
  const normalizedRows = rawRows.map(normalizeObservation);
  const lineageResults = normalizedRows.map((row) => classifyEvidenceLineage({
    ...row.lineage,
    sourceId: row.lineage.sourceId || sourceId,
    rightsStatus: row.lineage.rightsStatus === 'UNKNOWN' ? dataRights : row.lineage.rightsStatus,
    calendarStatus: row.lineage.calendarStatus === 'UNKNOWN' ? calendarStatus : row.lineage.calendarStatus
  }, { now, requireRights: true, requireCalendar: true }));
  const usableRows = normalizedRows
    .map((row, index) => ({ row, lineage: lineageResults[index] }))
    .filter(({ lineage }) => lineage.status === 'CURRENT_CANDIDATE')
    .sort((a, b) => (a.row.lineage.observedAtMs || 0) - (b.row.lineage.observedAtMs || 0))
    .map(({ row }) => row);
  const eligibleRows = usableRows.filter((row) => safePredicate(eligible, row, false));
  const successRows = eligibleRows.filter((row) => safePredicate(success, row, false));
  const full = rateSummary(eligibleRows, success, options);
  const midpoint = Math.ceil(eligibleRows.length / 2);
  const firstHalf = rateSummary(eligibleRows.slice(0, midpoint), success, options);
  const secondHalf = rateSummary(eligibleRows.slice(midpoint), success, options);
  const stability = Object.freeze({
    firstHalf,
    secondHalf,
    intervalOverlap: intervalsOverlap(firstHalf, secondHalf),
    status: firstHalf.estimate == null || secondHalf.estimate == null
      ? 'UNAVAILABLE'
      : intervalsOverlap(firstHalf, secondHalf) ? 'STABLE_ENOUGH' : 'UNSTABLE'
  });
  const recentRows = eligibleRows.slice(-Math.max(1, Number(recencyWindow) || 250));
  const recency = rateSummary(recentRows, success, options);
  const perYear = aggregatePerYear(eligibleRows, success, options);
  const values = successRows.map((row) => value(row));
  const lineage = summarizeEvidenceLineage(lineageResults);
  const blockedReasons = lineage.blockedReasons;
  const status = !rawRows.length
    ? 'NO_DATA'
    : !usableRows.length
      ? 'BLOCKED'
      : full.trials < options.minSampleRefuse
        ? 'LOW_SAMPLE_BLOCKED'
        : full.trials < options.minSampleWarn
          ? 'LOW_SAMPLE'
          : 'READY';
  return Object.freeze({
    version: CONDITIONAL_EVIDENCE_VERSION,
    lineageVersion: EVIDENCE_LINEAGE_VERSION,
    status,
    decisionEligible: false,
    allowedUse: 'research-relative-ranking-only',
    conditionLabel: clean(conditionLabel) || '조건부 증거',
    queryEcho: clean(queryEcho),
    sourceId: clean(sourceId || '') || null,
    observedAt: timestampMs(observedAt) == null ? null : new Date(timestampMs(observedAt)).toISOString(),
    sample: full,
    stability,
    recency,
    perYear,
    distribution: distribution(values),
    lineage,
    blockedReasons: Object.freeze([...blockedReasons]),
    excludedObservationCount: Math.max(0, normalizedRows.length - usableRows.length),
    lastObservedAt: usableRows.at(-1)?.observedAt || null,
    disclaimer: CONDITIONAL_EVIDENCE_DISCLAIMER
  });
}
