export const AI_PREMISE_VERSION = 'premise-evidence.v1';

const METRICS = Object.freeze({ 'price-change-pct': '%', 'price-change': null });
const OBSERVED_SOURCE_KINDS = new Set(['exchange', 'market-data', 'quote-provider', 'official', 'primary', 'verified-current', 'live']);
function timestamp(value) { return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null; }
function period(value) {
  const start = timestamp(value?.start), end = timestamp(value?.end);
  return start !== null && end !== null && start < end ? { start, end } : null;
}

/** Compare an explicit directional assertion only with the same observed tuple.
 * A price level, proxy, missing period, or inferred timeframe is not a return.
 */
export function evaluateDirectionalPremise(assertion = {}, evidence = [], { now = new Date() } = {}) {
  const requestedPeriod = period(assertion.period);
  const nowMs = new Date(now).getTime();
  const reasons = [];
  if (!assertion.entityId) reasons.push('entity-unresolved');
  if (!Object.hasOwn(METRICS, assertion.metricId || '')) reasons.push('metric-unsupported');
  if (!['up', 'down'].includes(assertion.direction)) reasons.push('direction-ambiguous');
  if (!assertion.timeframe || assertion.timeframe === 'unspecified') reasons.push('timeframe-unspecified');
  if (!requestedPeriod) reasons.push('period-unavailable');
  if (!assertion.unit || (METRICS[assertion.metricId] && assertion.unit !== METRICS[assertion.metricId])) reasons.push('unit-invalid');
  if (!Number.isFinite(nowMs) || (requestedPeriod && requestedPeriod.end > nowMs)) reasons.push('period-not-observed');
  const base = { schemaVersion: AI_PREMISE_VERSION, ...assertion,
    period: assertion.period && typeof assertion.period === 'object'
      ? Object.freeze({ start: assertion.period.start, end: assertion.period.end }) : null };
  const result = (status, observedDirection = null, ids = []) => Object.freeze({ ...base, status, observedDirection, evidenceIds: Object.freeze(ids), reasons: Object.freeze(reasons) });
  if (reasons.length) return result('UNVERIFIED');
  const candidates = (Array.isArray(evidence) ? evidence : []).filter((row) => {
    const rowPeriod = period(row?.period);
    return row && row.entityId === assertion.entityId && row.metricId === assertion.metricId && row.unit === assertion.unit &&
      row.timeframe === assertion.timeframe && rowPeriod?.start === requestedPeriod.start && rowPeriod?.end === requestedPeriod.end;
  });
  const usable = candidates.filter((row) => {
    const at = timestamp(row.observedAt);
    return typeof row.value === 'number' && Number.isFinite(row.value) &&
      (row.metricId !== 'price-change-pct' || row.value >= -100) &&
      typeof row.evidenceId === 'string' && row.evidenceId.trim() && typeof row.source === 'string' && row.source.trim() &&
      ['verified', 'current'].includes(String(row.status).toLowerCase()) &&
      OBSERVED_SOURCE_KINDS.has(String(row.sourceKind || '').trim().toLowerCase()) &&
      at !== null && at >= requestedPeriod.end && at <= nowMs;
  });
  if (!usable.length) { reasons.push(candidates.length ? 'matching-evidence-invalid' : 'matching-evidence-unavailable'); return result('UNVERIFIED'); }
  const directions = new Set(usable.map((row) => row.value > 0 ? 'up' : row.value < 0 ? 'down' : 'flat'));
  const ids = [...new Set(usable.map((row) => row.evidenceId))];
  if (directions.size !== 1) { reasons.push('conflicting-observations'); return result('CONFLICT', null, ids); }
  const observed = [...directions][0];
  if (observed !== assertion.direction) reasons.push(observed === 'flat' ? 'observed-no-change' : 'opposite-direction');
  return result(observed === assertion.direction ? 'VERIFIED' : 'CONTRADICTED', observed, ids);
}

export function createQuestionPremise({ query = '', entities = {}, timeframe = 'unspecified', currentSensitive = false, assertions = null, evidence = [], requestedPeriod = null, now = new Date() } = {}) {
  const text = String(query);
  let requested = Array.isArray(assertions) ? assertions : [];
  if (!Array.isArray(assertions)) {
    const up = /상승|오르|올랐|rising|rose|\bup\b/i.test(text);
    const down = /하락|내리|내렸|떨어|falling|fell|\bdown\b/i.test(text);
    // Questions about hypothetical/future moves do not assert an observation.
    if ((up || down) && !/할까|오를까|내릴까|만약|한다면|하면|전망|예상|\bif\b|\bwill\b/i.test(text)) {
      const resolved = Array.isArray(entities.entities) ? entities.entities : [];
      const proxyOrOtherMetric = /반도체|소프트웨어|섹터|sector|semiconductor|software|금리|환율|매출|이익|수익률|거래량|물가|실업|yield|revenue|volume/i.test(text);
      requested = [{ text: text.slice(0, 160), entityId: resolved.length === 1 && !proxyOrOtherMetric ? resolved[0].symbol : null,
        metricId: proxyOrOtherMetric ? null : 'price-change-pct', unit: '%', direction: up && down ? null : up ? 'up' : 'down', timeframe, period: requestedPeriod }];
    }
  }
  const rows = requested.map((assertion) => evaluateDirectionalPremise(assertion, evidence, { now }));
  const status = !rows.length ? 'NONE' : rows.some((row) => row.status === 'CONFLICT') ? 'CONFLICT'
    : rows.some((row) => row.status === 'CONTRADICTED') ? 'CONTRADICTED'
    : rows.every((row) => row.status === 'VERIFIED') ? 'VERIFIED' : 'UNVERIFIED';
  return Object.freeze({ schemaVersion: AI_PREMISE_VERSION, status, assertions: Object.freeze(rows), currentSensitive });
}
