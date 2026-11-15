// The 리스크 지표 panel's numbers from one risk estimate: loss boundaries (VaR), the mean loss beyond the 95% boundary
// (CVaR, with deriveVarStability's own certificate), Sharpe, drawdown, the correlation matrix and each holding's share
// of the book's variance. Pure: the estimate and the member return series in, read-outs out — no score, no instruction.
//
// A Korean and a US close on one calendar date are about 16 hours apart, so day-by-day pairing understates how the two
// move together (S&P 500–KOSPI: 0.16 on daily returns, 0.47 on 5-session returns over the same year) and with it the
// book's volatility and VaR. A book that holds both markets is therefore measured on non-overlapping 5-session returns —
// every figure on the panel, one basis — and the result says so. A single-market book stays on daily returns.
import { _calcPortfolioVaR, _calcSharpe, _calcMaxDrawdown, _calcCorrelationMatrix, deriveVarStability, _statMean } from './return-stats.js';
import { listingRegion } from './fx.js';

export const MIXED_MARKET_SESSIONS = 5;
// Under this many 5-session returns a correlation cell is not a number worth printing.
export const MIXED_MARKET_MIN_PAIRS = 8;
const TRADING_DAYS = 252;

/** Non-overlapping compounded returns over `size` sessions, ending on the latest session (older leftovers are dropped). */
export function blockReturns(returns, size) {
  const list = Array.isArray(returns) ? returns : [];
  if (!(size > 1)) return list.slice();
  const out = [];
  for (let end = list.length; end - size >= 0; end -= size) {
    let growth = 1;
    for (let i = end - size; i < end; i += 1) growth *= 1 + list[i];
    out.unshift(growth - 1);
  }
  return out;
}

/**
 * Each holding's share of the book's variance at fixed weights: w_i · cov(r_i, r_p) / var(r_p), which sums to 100%.
 * @param {Array<{ticker:string, weight:number}>} weights  shares of the invested part (sum 1)
 * @param {Record<string, number[]>} seriesByTicker  equal-length return series
 */
export function riskContributions(weights, seriesByTicker) {
  const members = (Array.isArray(weights) ? weights : []).filter((item) => item.weight > 0 && Array.isArray(seriesByTicker?.[item.ticker]));
  const n = members.length ? seriesByTicker[members[0].ticker].length : 0;
  if (members.length < 2 || n < 3 || members.some((item) => seriesByTicker[item.ticker].length !== n)) return null;
  const book = [];
  for (let t = 0; t < n; t += 1) book.push(members.reduce((sum, item) => sum + item.weight * seriesByTicker[item.ticker][t], 0));
  const bookMean = _statMean(book);
  const variance = book.reduce((sum, value) => sum + (value - bookMean) ** 2, 0);
  if (!(variance > 0)) return null;
  return members.map((item) => {
    const series = seriesByTicker[item.ticker];
    const mean = _statMean(series);
    let cov = 0;
    for (let t = 0; t < n; t += 1) cov += (series[t] - mean) * (book[t] - bookMean);
    return { ticker: item.ticker, weightPct: item.weight * 100, contributionPct: item.weight * cov / variance * 100 };
  }).sort((a, b) => b.contributionPct - a.contributionPct);
}

/**
 * @param {object} input
 * @param {{publishedReturns:number[]}} input.estimate  the ready risk estimate (risk.js deriveRiskEstimate)
 * @param {{members:Array<{ticker:string, marketValue:number}>}} [input.snapshot]  its composition snapshot (weights)
 * @param {Record<string, number[]>} input.returnsMap  each holding's daily returns over the estimate's sample
 * @param {number|null} [input.rfAnnual]
 */
export function buildRiskReadout({ estimate, snapshot = null, returnsMap = {}, rfAnnual = null } = {}) {
  const daily = Array.isArray(estimate?.publishedReturns) ? estimate.publishedReturns : [];
  const tickers = Object.keys(returnsMap || {});
  // Listings in different regions close at different hours (fx.js listingRegion reads the exchange suffix).
  const mixedMarket = new Set(tickers.map(listingRegion)).size > 1;
  const sessions = mixedMarket ? MIXED_MARKET_SESSIONS : 1;
  const series = blockReturns(daily, sessions);
  const memberSeries = Object.fromEntries(tickers.map((ticker) => [ticker, blockReturns(returnsMap[ticker], sessions)]));
  // The series is in time order by construction (sample dates ascending), so the recent-half check may run.
  const stability = deriveVarStability({ returns: series, order: 'chronological' });
  const corr = tickers.length >= 2 ? _calcCorrelationMatrix(memberSeries) : null;
  if (corr && mixedMarket && series.length < MIXED_MARKET_MIN_PAIRS) corr.matrix = corr.matrix.map((row, i) => row.map((cell, j) => (i === j ? cell : null)));
  const value = new Map();
  for (const member of snapshot?.members || []) if (member.marketValue > 0) value.set(member.ticker, (value.get(member.ticker) || 0) + member.marketValue);
  const invested = [...value.values()].reduce((sum, amount) => sum + amount, 0);
  const tail = stability.status === 'ready' && series.length >= 10 ? stability : null;
  return {
    sessions, mixedMarket, n: series.length, dailyN: daily.length,
    var95: _calcPortfolioVaR(series, 0.95),
    var99: _calcPortfolioVaR(series, 0.99),
    cvar95: tail ? tail.point.cvar : null,
    cvarTailN: tail ? tail.tailN : null,
    cvarCertified: !!tail && tail.cvarCertification === 'certified',
    sharpe: _calcSharpe(series, rfAnnual, TRADING_DAYS / sessions),
    // The drawdown is read on the daily path: it spans many sessions, where a one-session offset between markets is small.
    mddRes: _calcMaxDrawdown(daily),
    corr: corr ? { tickers: corr.tickers, matrix: corr.matrix, sessions, n: series.length } : null,
    contributions: invested > 0 ? riskContributions([...value].map(([ticker, amount]) => ({ ticker, weight: amount / invested })), memberSeries) : null
  };
}
