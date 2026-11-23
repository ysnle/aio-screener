import { buildCloseSeries, sessionPointBack } from '../session/close-series.js';
import { MARKET_WINDOWS } from '../session/market-windows.js';

const WINDOWS = Object.freeze({ ret1m: MARKET_WINDOWS.month, ret3m: MARKET_WINDOWS.quarter, ret6m: MARKET_WINDOWS.half });

export function benchmarkOf(symbol) {
  const text = String(symbol || '').toUpperCase();
  if (text.endsWith('.KQ')) return { id: 'kosdaq', label: '코스닥', field: 'kosdaq', market: 'KR' };
  if (text.endsWith('.KS')) return { id: 'kospi', label: '코스피', field: 'kospi', market: 'KR' };
  return { id: 'spx', label: 'S&P 500', field: 'spx', market: 'US' };
}

export function indexReturns(history = [], field, { through = null, market = 'US' } = {}) {
  const series = buildCloseSeries(history, field, { through });
  const last = series[series.length - 1];
  const out = {};
  for (const [key, sessions] of Object.entries(WINDOWS)) {
    const then = sessionPointBack(series, sessions, market);
    out[key] = last && then && then.value > 0 ? (last.value / then.value - 1) * 100 : null;
  }
  return out;
}

export function benchmarkRowFor(symbol, history = [], { through = null } = {}) {
  const bench = benchmarkOf(symbol);
  const series = buildCloseSeries(history, bench.field, { through });
  return { ...indexReturns(history, bench.field, { through, market: bench.market }), asOf: series.at(-1)?.date || null, label: bench.label, id: bench.id, market: bench.market };
}
