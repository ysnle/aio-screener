// Rank statistics shared by the research/backtest producers.
//
// Spearman's rho is Pearson correlation over ranks. Sequential ranks plus the
// no-tie 1 - 6Σd² formula are only equivalent when every value is unique. News,
// percentile factors, and bucketed scores routinely contain ties, so use midranks
// and the Pearson form throughout. Missing values are never turned into ranks.

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
