// Rank statistics shared by the research/backtest producers.
//
// Spearman's rho is Pearson correlation over ranks. Sequential ranks plus the
// no-tie 1 - 6Σd² formula are only equivalent when every value is unique. News,
// percentile factors, and bucketed scores routinely contain ties, so use midranks
// and the Pearson form throughout. Missing values are never turned into ranks.

import { hacLagFor, neweyWestMeanStats } from './research-validation.mjs';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function midranks(values) {
  const rows = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array(values.length);
  for (let start = 0; start < rows.length;) {
    let end = start + 1;
    while (end < rows.length && rows[end].value === rows[start].value) end++;
    const averageRank = (start + 1 + end) / 2;
    for (let index = start; index < end; index++) result[rows[index].index] = averageRank;
    start = end;
  }
  return result;
}

export function percentileRank01(values) {
  const valid = values.map((value, index) => ({ value, index })).filter((row) => finite(row.value));
  const result = values.map(() => 0.5);
  if (!valid.length) return result;
  const ranks = midranks(valid.map((row) => row.value));
  const denominator = valid.length - 1;
  valid.forEach((row, index) => {
    result[row.index] = denominator > 0 ? (ranks[index] - 1) / denominator : 0.5;
  });
  return result;
}

export function spearman(xs, ys) {
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length) return null;
  const pairs = xs.map((x, index) => [x, ys[index]]).filter(([x, y]) => finite(x) && finite(y));
  const n = pairs.length;
  if (n < 3) return null;
  const rx = midranks(pairs.map(([x]) => x));
  const ry = midranks(pairs.map(([, y]) => y));
  const meanX = rx.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ry.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let index = 0; index < n; index++) {
    const dx = rx[index] - meanX;
    const dy = ry[index] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (!(denomX > 0) || !(denomY > 0)) return null;
  return numerator / Math.sqrt(denomX * denomY);
}

// Greedy count of observations whose forward windows do not overlap: each kept position starts at or after the
// previous kept position + horizon. `positions` are session indexes in ascending order.
export function nonOverlappingCount(positions, horizon) {
  const step = Math.max(1, Math.trunc(Number(horizon)) || 1);
  let count = 0;
  let next = -Infinity;
  for (const position of positions) {
    if (!finite(position) || position < next) continue;
    count += 1;
    next = position + step;
  }
  return count;
}

// Spearman rho of a score with an n-session forward return sampled every session (R1247). Consecutive rows share
// (h-1)/h of one window, so the interval uses the count of non-overlapping windows (nEff), not the row count:
// Fisher z with se = 1/sqrt(nEff - 3). `hac` is a second reading of the same rho — the mean of the standardised rank
// products with a Newey-West standard error at lag >= h-1. The IID interval is kept only as `ci95NaiveIid`.
// A pair may carry its session index as a third element; subsets with gaps (regimes) are then counted by position.
export function spearmanWithEffectiveCI(pairs, horizon = 1) {
  const step = Math.max(1, Math.trunc(Number(horizon)) || 1);
  const clean = (Array.isArray(pairs) ? pairs : [])
    .filter((pair) => Array.isArray(pair) && finite(pair[0]) && finite(pair[1]));
  const naive = spearmanWithCI(clean);
  const positioned = clean.length > 0 && clean.every((pair) => finite(pair[2]));
  const nEff = positioned ? nonOverlappingCount(clean.map((pair) => pair[2]), step) : Math.floor(clean.length / step);
  const result = { n: naive.n, nEff, rho: naive.rho, ci95: null, ci95Basis: 'fisher-z on nEff (non-overlapping windows)', ci95NaiveIid: naive.ci95, hac: null };
  if (naive.rho == null) return result;
  const rho = Math.max(-1, Math.min(1, spearman(clean.map(([x]) => x), clean.map(([, y]) => y))));
  if (nEff >= 4 && Math.abs(rho) < 1) {
    const z = Math.atanh(rho);
    const se = 1 / Math.sqrt(nEff - 3);
    result.ci95 = [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)].map((value) => Math.round(value * 1000) / 1000);
  }
  const n = clean.length;
  const standardise = (values) => {
    const ranks = midranks(values);
    const mean = ranks.reduce((sum, value) => sum + value, 0) / n;
    const sd = Math.sqrt(ranks.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n);
    return sd > 0 ? ranks.map((value) => (value - mean) / sd) : null;
  };
  const zx = standardise(clean.map(([x]) => x));
  const zy = standardise(clean.map(([, y]) => y));
  // A subset with gaps has no lag structure to correct; it keeps the nEff interval only.
  const contiguous = !positioned || clean[n - 1][2] - clean[0][2] + 1 === n;
  if (zx && zy && contiguous && nEff >= 4) {
    const stats = neweyWestMeanStats(zx.map((value, index) => value * zy[index]), hacLagFor(n, step, 1));
    result.hac = { hacSe: stats.hacSe, hacCi95: stats.hacCi95, lags: stats.lags, inference: stats.inference };
  }
  return result;
}

export function spearmanWithCI(pairs) {
  const clean = (Array.isArray(pairs) ? pairs : [])
    .filter((pair) => Array.isArray(pair) && finite(pair[0]) && finite(pair[1]));
  const n = clean.length;
  if (n < 3) return { n, rho: null, ci95: null };
  const rhoRaw = spearman(clean.map(([x]) => x), clean.map(([, y]) => y));
  if (!finite(rhoRaw)) return { n, rho: null, ci95: null };
  const rho = Math.max(-1, Math.min(1, rhoRaw));
  let ci95 = null;
  if (n >= 4 && Math.abs(rho) < 1) {
    const z = Math.atanh(rho);
    const se = 1 / Math.sqrt(n - 3);
    ci95 = [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)]
      .map((value) => Math.round(value * 1000) / 1000);
  }
  return { n, rho: Math.round(rho * 1000) / 1000, ci95 };
}
