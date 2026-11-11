// v59.70 (S16, PLAN 2026-11-04): 포트폴리오 ① — the current holdings against the S&P 500 over the last year, from the
// screener's published closes instead of the old per-holding Yahoo calls behind a 새로고침 button (js/aio-ui.js
// updateBenchmarkChart, deleted). Each holding's return over 1·5·21·63·126·252 sessions (ret1d … ret12m, adjusted
// closes) gives what today's book was worth that many sessions ago: B(h) = Σ V_i / (1 + r_i(h)) over Σ V_i, V_i the
// holding's value now in the base currency and r_i its return in that currency (listing return × currency move). SPY's row gives the index on the same basis (dividends included). The
// chart starts at the longest window that at least 80% of the book's value can read; holdings without it are left
// out and their share is named. Pure: rows in, points out. Not an account return (the composition is held fixed).
import { finiteNumber as finite } from '../shared/number.js';

export const BENCHMARK_WINDOWS = Object.freeze([
  Object.freeze({ key: 'ret12m', sessions: 252, label: '1년' }),
  Object.freeze({ key: 'ret6m', sessions: 126, label: '6개월' }),
  Object.freeze({ key: 'ret3m', sessions: 63, label: '3개월' }),
  Object.freeze({ key: 'ret1m', sessions: 21, label: '1개월' }),
  Object.freeze({ key: 'ret5d', sessions: 5, label: '5거래일' }),
  Object.freeze({ key: 'ret1d', sessions: 1, label: '1일' })
]);
export const BENCHMARK_MIN_COVERAGE = 0.8;


/**
 * @param {object} input
 * @param {Array<{symbol:string,value:number}>} input.holdings  surface rows (value in one currency)
 * @param {(symbol:string, key:string) => number|null} input.returnOf  a holding's return in % over a window key
 * @param {(key:string) => number|null} input.indexReturnOf  SPY's return in % over a window key
 * @param {(sessions:number) => string|null} input.dateOf  the session date `sessions` back from the basis close
 * @param {string|null} [input.asOf]  the basis close date
 * @param {(symbol:string, key:string) => number|null} [input.fxReturnOf]  the % move of the holding's listing currency
 *   into the base currency over a window key; absent means every holding is in the base currency (0). A holding whose
 *   FX return is missing for a window cannot read that window.
 */
export function buildBenchmarkTrend({ holdings = [], returnOf, indexReturnOf, dateOf, asOf = null, fxReturnOf = null } = {}) {
  const book = new Map();
  for (const row of Array.isArray(holdings) ? holdings : []) {
    const value = finite(Number(row?.value));
    const symbol = String(row?.symbol || '').toUpperCase();
    if (!symbol || !(value > 0)) continue;
    book.set(symbol, (book.get(symbol) || 0) + value);
  }
  const total = [...book.values()].reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return { available: false, reason: 'empty' };
  if (!asOf || typeof returnOf !== 'function' || typeof indexReturnOf !== 'function' || typeof dateOf !== 'function') return { available: false, reason: 'loading' };
  // A holding's return in the base currency: its listing-currency return compounded with the currency move.
  const fxOf = (symbol, key) => (typeof fxReturnOf === 'function' ? finite(fxReturnOf(symbol, key)) : 0);
  const baseReturnOf = (symbol, key) => {
    const local = finite(returnOf(symbol, key));
    const fx = fxOf(symbol, key);
    if (local == null || fx == null) return null;
    return fx === 0 ? local : ((1 + local / 100) * (1 + fx / 100) - 1) * 100;
  };
  // The longest window that 80% of the value can read, with every shorter window too (one fixed set of holdings).
  let chosen = null;
  for (let start = 0; start < BENCHMARK_WINDOWS.length && !chosen; start += 1) {
    const windows = BENCHMARK_WINDOWS.slice(start);
    if (windows.some((span) => finite(indexReturnOf(span.key)) == null || !dateOf(span.sessions))) continue;
    const covered = [...book].filter(([symbol]) => windows.every((span) => { const r = baseReturnOf(symbol, span.key); return r != null && r > -100; }));
    const coveredValue = covered.reduce((sum, [, value]) => sum + value, 0);
    if (coveredValue / total >= BENCHMARK_MIN_COVERAGE) chosen = { windows, covered, coveredValue };
  }
  if (!chosen) return { available: false, reason: 'coverage' };
  const { windows, covered, coveredValue } = chosen;
  // Value of today's book `h` sessions ago relative to now, and the index the same way.
  const bookThen = (key) => covered.reduce((sum, [symbol, value]) => sum + value / (1 + baseReturnOf(symbol, key) / 100), 0) / coveredValue;
  const indexThen = (key) => 1 / (1 + indexReturnOf(key) / 100);
  const stops = [...windows.map((span) => ({ date: dateOf(span.sessions), label: span.label, book: bookThen(span.key), index: indexThen(span.key) })), { date: asOf, label: '현재', book: 1, index: 1 }]
    .filter((stop, index, list) => !list.slice(0, index).some((other) => other.date === stop.date));
  const base = stops[0];
  const points = stops.map((stop) => ({ date: stop.date, label: stop.label, bookPct: (stop.book / base.book - 1) * 100, indexPct: (stop.index / base.index - 1) * 100 }));
  const last = points.at(-1);
  return {
    available: true, asOf, from: base.date, window: windows[0].label, points,
    bookPct: last.bookPct, indexPct: last.indexPct, gapPp: last.bookPct - last.indexPct,
    coveredShare: coveredValue / total, holdings: book.size, coveredHoldings: covered.length,
    missing: [...book.keys()].filter((symbol) => !covered.some(([held]) => held === symbol))
  };
}
