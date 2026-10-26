// P1447 (review 2026-10-04): a stock is compared with its own market — KRX listings with the KOSPI /
// KOSDAQ, US listings with the S&P 500 — over the same 1/3/6-month windows (21/63/126 completed sessions).
// Index returns come from the completed-close history (price index, no dividends); the screener's stock
// returns use adjusted closes (dividends included), so a dividend payer gains ~0.5-1%/quarter in comparison.
import { buildCloseSeries, sessionPointBack } from './close-series.js';
import { MARKET_WINDOWS } from './market-windows.js';

const WINDOWS = Object.freeze({ ret1m: MARKET_WINDOWS.month, ret3m: MARKET_WINDOWS.quarter, ret6m: MARKET_WINDOWS.half });

export function benchmarkOf(symbol) {
  const text = String(symbol || '').toUpperCase();
  if (text.endsWith('.KQ')) return { id: 'kosdaq', label: '코스닥', field: 'kosdaq', market: 'KR' };
  if (text.endsWith('.KS')) return { id: 'kospi', label: '코스피', field: 'kospi', market: 'KR' };
  return { id: 'spx', label: 'S&P 500', field: 'spx', market: 'US' };
}

// v58.20 review C1: "63 sessions back" is 63 sessions, not 63 rows. history.json can skip days (P1428), and counting rows
// then compared the stock's 63-bar return with a longer index window (6.50% true vs 7.57% with 10 missing days). The base
// point is found the way every other "n거래일" figure is (sessionPointBack); too many missing days withhold the return.
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

// One benchmark row for a symbol: the market's index returns, labelled. 2026-10-13 review S07: `through` cuts the
// index at the stock's own factor session, so a 10/08 KR factor row is compared with the 10/08 KOSPI close
// instead of dropping the comparison because the index already reached 10/12.
export function benchmarkRowFor(symbol, history = [], { through = null } = {}) {
  const bench = benchmarkOf(symbol);
  const series = buildCloseSeries(history, bench.field, { through });
  return { ...indexReturns(history, bench.field, { through, market: bench.market }), asOf: series.at(-1)?.date || null, label: bench.label, id: bench.id, market: bench.market };
}
