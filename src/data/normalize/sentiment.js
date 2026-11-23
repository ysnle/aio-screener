import { finiteNumber as finite } from '../../domain/shared/number.js';
import { countOpenSessionsBetween, dateInTimezone, dateOnly, latestCompletedUsSession } from '../../domain/market/session/market-calendar.js';
import { isIsoDay } from '../../domain/shared/session-date.js';
const SENTIMENT_FIELDS = Object.freeze([
  { metric: 'fearGreed', unit: 'score', sourceKind: 'legacy-runtime', observedAt: 'fearGreedObservedAt', maxAgeMs: 172_800_000, maxUsSessions: 0 },
  { metric: 'vix9d', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix9dObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vixObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix3m', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix3mObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix6m', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix6mObservedAt', maxAgeMs: 120_000 },
  { metric: 'hySpread', unit: 'bp', sourceKind: 'legacy-projection', observedAt: 'hySpreadDate', maxAgeMs: 172_800_000, maxUsSessions: 1 },
  { metric: 'aaiiBear', unit: 'percent', sourceKind: 'snapshot', observedAt: 'aaiiObservedAt', maxAgeMs: null },
  { metric: 'aaiiBull', unit: 'percent', sourceKind: 'snapshot', observedAt: 'aaiiObservedAt', maxAgeMs: null }
]);

function nullPreserving(value) {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeSentiment(raw = {}) {
  const result = { ...raw };
  for (const field of SENTIMENT_FIELDS) result[field.metric] = finite(raw[field.metric]);
  result.spyChg = nullPreserving(raw.spyChg);
  result.tradingScoreTotal = nullPreserving(raw.tradingScoreTotal);
  const skew = raw.skew && typeof raw.skew === 'object' ? raw.skew : {};
  result.skew = Object.freeze({
    ...skew,
    metricId: skew.metricId || 'market.volatility.skew',
    instrumentId: skew.instrumentId || '^SKEW',
    unit: skew.unit || 'index',
    value: finite(skew.value)
  });
  return Object.freeze(result);
}

export function sentimentMaxAgeMs(field, observedAt, nowMs = Date.now()) {
  const base = field?.maxAgeMs || 86_400_000;
  if (field?.maxUsSessions == null || observedAt == null) return base;
  const text = String(observedAt);
  const dateOnlyText = isIsoDay(text);
  const observedMs = dateOnlyText ? Date.parse(`${text}T00:00:00Z`) : Date.parse(text);
  const from = dateOnlyText ? dateOnly(text) : dateInTimezone(observedMs, 'America/New_York');
  const completed = latestCompletedUsSession(nowMs, { requirePrevious: false });
  if (!Number.isFinite(observedMs) || !from || !completed) return base;
  return countOpenSessionsBetween(from, completed.date, 'US') <= field.maxUsSessions ? Math.max(base, nowMs - observedMs) : base;
}

export function sentimentFieldDefinitions() {
  return SENTIMENT_FIELDS;
}
