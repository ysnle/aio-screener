import { finiteNumber as finite } from '../../domain/shared/number.js';
import { MARKET_CALENDAR_REGISTRY, countOpenSessionsBetween, dateInTimezone, dateOnly } from '../../domain/market/market-calendar.js';
const SENTIMENT_FIELDS = Object.freeze([
  { metric: 'fearGreed', unit: 'score', sourceKind: 'legacy-runtime', observedAt: 'fearGreedObservedAt', maxAgeMs: 172_800_000, maxUsSessions: 1 },
  { metric: 'vix9d', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix9dObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vixObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix3m', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix3mObservedAt', maxAgeMs: 120_000 },
  { metric: 'vix6m', unit: 'index', sourceKind: 'legacy-runtime', observedAt: 'vix6mObservedAt', maxAgeMs: 120_000 },
  { metric: 'putCall', unit: 'ratio', sourceKind: 'legacy-projection', observedAt: 'putCallObservedAt', maxAgeMs: 172_800_000, maxUsSessions: 1 },
  { metric: 'hySpread', unit: 'bp', sourceKind: 'legacy-projection', observedAt: 'hySpreadDate', maxAgeMs: 172_800_000, maxUsSessions: 2 },
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
  result.vixHistory = Array.isArray(raw.vixHistory)
    ? raw.vixHistory.map((point) => ({ date: point?.date || null, value: finite(point?.value) })).filter((point) => point.value != null)
    : [];
  return Object.freeze(result);
}

// v58.82: a daily value is stale once a newer session's value should exist, not after a flat 48h — Friday's close read
// as stale from Sunday afternoon ET, and a Thursday-dated FRED spread (published a business day later) from early Saturday.
// maxUsSessions counts NYSE sessions after the observation's ET date; the 48h bound stays the floor, and a date outside
// the registered calendar keeps it alone.
export function sentimentMaxAgeMs(field, observedAt, nowMs = Date.now()) {
  const base = field?.maxAgeMs || 86_400_000;
  if (!field?.maxUsSessions || observedAt == null) return base;
  const text = String(observedAt);
  const observedMs = /^\d{4}-\d{2}-\d{2}$/.test(text) ? Date.parse(`${text}T00:00:00Z`) : Date.parse(text);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(text) ? dateOnly(text) : dateInTimezone(observedMs, 'America/New_York');
  const to = dateInTimezone(nowMs, 'America/New_York');
  if (!Number.isFinite(observedMs) || !from || !to || !MARKET_CALENDAR_REGISTRY.NYSE[from.slice(0, 4)] || !MARKET_CALENDAR_REGISTRY.NYSE[to.slice(0, 4)]) return base;
  return countOpenSessionsBetween(from, to, 'US') <= field.maxUsSessions ? Math.max(base, nowMs - observedMs) : base;
}

export function sentimentFieldDefinitions() {
  return SENTIMENT_FIELDS;
}
