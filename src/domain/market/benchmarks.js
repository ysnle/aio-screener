// P1447 (review 2026-10-04): a stock is compared with its own market — KRX listings with the KOSPI /
// KOSDAQ, US listings with the S&P 500 — over the same 1/3/6-month windows (21/63/126 completed sessions).
// Index returns come from the completed-close history (price index, no dividends); the screener's stock
// returns use adjusted closes (dividends included), so a dividend payer gains ~0.5-1%/quarter in comparison.
import { buildCloseSeries } from '../briefing/market-read.js';

const WINDOWS = Object.freeze({ ret1m: 21, ret3m: 63, ret6m: 126 });

export function benchmarkOf(symbol) {
  const text = String(symbol || '').toUpperCase();
  if (text.endsWith('.KQ')) return { id: 'kosdaq', label: '코스닥', field: 'kosdaq', market: 'KR' };
  if (text.endsWith('.KS')) return { id: 'kospi', label: '코스피', field: 'kospi', market: 'KR' };
  return { id: 'spx', label: 'S&P 500', field: 'spx', market: 'US' };
}

export function indexReturns(history = [], field, { through = null } = {}) {
  const series = buildCloseSeries(history, field, { through });
  const last = series[series.length - 1];
  const out = {};
  for (const [key, sessions] of Object.entries(WINDOWS)) {
    const then = series.length > sessions ? series[series.length - 1 - sessions] : null;
    out[key] = last && then && then.value > 0 ? (last.value / then.value - 1) * 100 : null;
  }
  return out;
}

// One benchmark row for a symbol: the market's index returns, labelled. 2026-10-13 review S07: `through` cuts the
// index at the stock's own factor session, so a 10/08 KR factor row is compared with the 10/08 KOSPI close
// instead of dropping the comparison because the index already reached 10/12.
export function benchmarkRowFor(symbol, history = [], { through = null } = {}) {
  const bench = benchmarkOf(symbol);
  const series = buildCloseSeries(history, bench.field, { through });
  return { ...indexReturns(history, bench.field, { through }), asOf: series.at(-1)?.date || null, label: bench.label, id: bench.id, market: bench.market };
}
