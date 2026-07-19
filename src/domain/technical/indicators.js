export const TECHNICAL_MODEL_VERSION = 'technical.v1';

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

function average(values) {
  const usable = values.map(Number).filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

export function deriveTechnicalModel({ symbol = null, ohlcv = [], inputVersion = 'unknown' } = {}) {
  const closes = Array.isArray(ohlcv) ? ohlcv.map((point) => finite(Number(point?.close))).filter((value) => value != null) : [];
  const current = closes.at(-1) ?? null;
  const previous = closes.at(-2) ?? null;
  const ma20 = closes.length >= 20 ? average(closes.slice(-20)) : null;
  const ma50 = closes.length >= 50 ? average(closes.slice(-50)) : null;
  const changePct = current != null && previous ? ((current - previous) / previous) * 100 : null;
  const status = closes.length >= 2 ? (closes.length >= 50 ? 'current' : 'partial') : 'unavailable';
  return Object.freeze({ modelVersion: TECHNICAL_MODEL_VERSION, inputVersion, symbol: symbol ? String(symbol).toUpperCase() : null, status, indicators: { current, changePct, ma20, ma50, trend: ma20 == null || current == null ? 'unknown' : current >= ma20 ? 'above-ma20' : 'below-ma20' }, observedCount: closes.length });
}
