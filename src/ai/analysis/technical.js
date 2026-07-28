export const AI_TECHNICAL_ENGINE_VERSION = 'technical-conditions.v1';

function number(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

export function buildTechnicalConditions({ symbol = null, indicators = {}, observedAt = null, source = null } = {}) {
  const price = number(indicators.price);
  const sma20 = number(indicators.sma20);
  const sma50 = number(indicators.sma50);
  const rsi14 = number(indicators.rsi14);
  const macd = number(indicators.macd);
  const signal = number(indicators.signal);
  const conditions = [];
  if (price !== null && sma20 !== null) conditions.push({ id: 'price-vs-sma20', status: price >= sma20 ? 'above' : 'below', value: price - sma20, unit: 'price-difference' });
  if (price !== null && sma50 !== null) conditions.push({ id: 'price-vs-sma50', status: price >= sma50 ? 'above' : 'below', value: price - sma50, unit: 'price-difference' });
  if (rsi14 !== null) conditions.push({ id: 'rsi14-zone', status: rsi14 >= 70 ? 'overbought' : rsi14 <= 30 ? 'oversold' : 'neutral', value: rsi14, unit: 'rsi' });
  if (macd !== null && signal !== null) conditions.push({ id: 'macd-vs-signal', status: macd >= signal ? 'positive' : 'negative', value: macd - signal, unit: 'macd-difference' });
  return Object.freeze({
    schemaVersion: AI_TECHNICAL_ENGINE_VERSION,
    status: conditions.length ? 'ready' : 'insufficient',
    symbol,
    observedAt,
    source,
    conditions: Object.freeze(conditions),
    indicators: Object.freeze({ price, sma20, sma50, rsi14, macd, signal }),
    conclusion: conditions.length ? '기술적 조건을 관측값 기준으로 계산했습니다. 방향성·확률 예측은 포함하지 않습니다.' : '기술 지표 근거가 없어 기술적 결론을 만들지 않습니다.'
  });
}
