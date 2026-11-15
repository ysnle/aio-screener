// The long-history scoring only the weekly producer runs
// (scripts/build-scenario-outcomes.mjs) — aligning closes, the case month's policy rate and the theme-stage outcomes.
// The browser reads the published records through analogs.js (definitions, frequencyText, pastEvidence) and keeps
// analogOutcome there for its own-record fallback; nothing here is reachable from the boot entry.
import { finiteNumber as finite } from '../shared/number.js';
import { OUTCOME_STAMPS } from './outcome-stamps.js';
import { OUTCOME_BANDS, THEME_OUTCOME_HORIZON, THEME_STAGE_RULE, THEME_STATES, analogScan, baseRate, quantile, summarise, themeStateOf } from './analogs.js';

// "What being wrong cost" is the deepest close inside the outcome window against the case's own close; a case counts
// as a drawdown case at DRAWDOWN_PCT or more. The same window over every testable session is the base.
export const DRAWDOWN_PCT = 5;
/** Deepest close in (i, i + horizon] against close i, in % (0 when no later close is lower). */
export function windowDrawdown(values, i, horizon) {
  let low = 0;
  for (let j = i + 1; j <= i + horizon && j < values.length; j += 1) low = Math.min(low, (values[j] / values[i] - 1) * 100);
  return low;
}

const ascending = (values) => [...values].sort((a, b) => a - b);
const round1 = (value) => (value == null ? null : Math.round(value * 10) / 10);
/**
 * summarise() plus the decision-frame fields. `drawdowns` (per case, same order as outcomes) add the drawdown count at
 * DRAWDOWN_PCT and the median deepest close; `base` ({ outcomes, drawdowns } over every testable session) adds the same
 * quartiles and drawdown share for an ordinary day; `cash` (per-case cash return over the horizon) adds its median.
 * Absent inputs add nothing.
 */
export function summariseOutcomes(outcomes, meta, { drawdowns = null, base = null, cash = null } = {}) {
  const out = summarise(outcomes, meta);
  if (drawdowns?.length === outcomes.length && outcomes.length) Object.assign(out, { dd5: drawdowns.filter((value) => value <= -DRAWDOWN_PCT).length, mddMedian: round1(quantile(ascending(drawdowns), 0.5)) });
  if (base?.outcomes?.length) {
    const b = ascending(base.outcomes);
    Object.assign(out, { baseP25: round1(quantile(b, 0.25)), baseMedian: round1(quantile(b, 0.5)), baseP75: round1(quantile(b, 0.75)) });
    if (base.drawdowns?.length === base.outcomes.length) Object.assign(out, { baseDd5Pct: Math.round(base.drawdowns.filter((value) => value <= -DRAWDOWN_PCT).length / base.drawdowns.length * 100), baseMddMedian: round1(quantile(ascending(base.drawdowns), 0.5)) });
  }
  if (cash?.length) Object.assign(out, { cashMedian: Math.round(quantile(ascending(cash), 0.5) * 100) / 100, cashN: cash.length });
  return out;
}

/** A branch analog on the long record with the decision-frame fields (the same scan as analogs.js analogOutcome). */
export function analogOutcomeHistory(rows, analog, options = {}) {
  const scan = analogScan(rows, analog, options);
  if (!scan) return null;
  const { list, horizon } = scan;
  const closes = list.map((row) => row.spx);
  const cash = scan.cases.filter((i) => finite(list[i].cash) != null).map((i) => list[i].cash * horizon / 252);
  return summariseOutcomes(scan.cases.map(scan.ret), scan.meta, {
    drawdowns: scan.cases.map((i) => windowDrawdown(closes, i, horizon)),
    base: { outcomes: scan.base.map(scan.ret), drawdowns: scan.base.map((i) => windowDrawdown(closes, i, horizon)) }, cash });
}

/** Align closes by date: { spx: [[date, value]], tnx: [...] } → [{ date, spx, tnx, ... }] on the S&P dates. */
export function alignCloses(seriesByField) {
  const maps = Object.fromEntries(Object.entries(seriesByField || {}).map(([field, rows]) => [field, new Map((rows || []).map(([date, value]) => [date, value]))]));
  const base = seriesByField?.spx || [];
  return base.map(([date, spx]) => {
    const row = { date, spx };
    for (const [field, map] of Object.entries(maps)) if (field !== 'spx' && map.has(date)) row[field] = map.get(date);
    return row;
  });
}

/** rows [{ date }] ← a monthly rate ([['YYYY-MM', annual %]]) as row.cash: the month's average, an approximation of the day's rate. */
export function attachMonthlyRate(rows, observations) {
  const byMonth = new Map((observations || []).filter((row) => Array.isArray(row) && finite(row[1]) != null).map(([month, value]) => [String(month).slice(0, 7), value]));
  if (!byMonth.size) return rows;
  for (const row of rows || []) { const value = byMonth.get(String(row?.date || '').slice(0, 7)); if (value != null) row.cash = value; }
  return rows;
}

/**
 * Past stages of a proxy ETF and what followed. With `benchmark` ([[date, close]], ^GSPC) the stage is the live rule —
 * 6-month and 1-month returns less the index's with the same bands, and the ETF's own 6-month return for 상대 방어 —
 * and meta.basis is 'relative-banded'; without it the old absolute sign rule stays and basis is 'absolute' (the screen
 * then does not compare it with the live stage).
 */
export function themeStateOutcomes(closes, { horizon = 63, benchmark = null, benchmarkField = 'spx' } = {}) {
  const list = (closes || []).filter(([, value]) => finite(value) > 0);
  const bench = Array.isArray(benchmark) && benchmark.length ? new Map(benchmark.filter(([, v]) => finite(v) > 0)) : null;
  const buckets = Object.fromEntries(Object.keys(THEME_STATES).map((state) => [state, []])); // 'fading' stays empty here
  const next = Object.fromEntries(Object.keys(THEME_STATES).map((state) => [state, 0]));
  let baseN = 0, baseUp = 0;
  // The base rate counts the same sessions a stage can be read on — with a benchmark, only those
  // where the index has all three closes (a stretch before the index existed is not part of either sample).
  // A stage read against the index is scored against it too: the outcome is the proxy's return less the benchmark's
  // over the same horizon ('excess'), and "up" means it beat the index. The proxy's own return kept the market's drift
  // (SMH rose on 67% of all days), which the stage does not claim. Without a benchmark the outcome stays the own return.
  const testable = (i) => !bench || !!(bench.get(list[i - 126][0]) && bench.get(list[i - 21][0]) && bench.get(list[i][0]) && bench.get(list[i + horizon][0]));
  const outcome = (i) => (list[i + horizon][1] / list[i][1] - 1) * 100 - (bench ? (bench.get(list[i + horizon][0]) / bench.get(list[i][0]) - 1) * 100 : 0);
  // The drawdown is the proxy's own price path (what a holder saw), not the excess over the index.
  const closesOnly = list.map(([, value]) => value);
  const drawdowns = Object.fromEntries(Object.keys(THEME_STATES).map((state) => [state, []]));
  const base = { outcomes: [], drawdowns: [] };
  let firstTestable = null, lastTestable = null;
  for (let i = 126; i + horizon < list.length; i += 1) {
    if (!testable(i)) continue;
    baseN += 1; if (outcome(i) > 0) baseUp += 1;
    base.outcomes.push(outcome(i)); base.drawdowns.push(windowDrawdown(closesOnly, i, horizon));
    if (firstTestable == null) firstTestable = i;
    lastTestable = i;
  }
  for (let i = 126; i + horizon < list.length; i += 1) {
    const trendAbs = (list[i][1] / list[i - 126][1] - 1) * 100;
    const recentAbs = (list[i][1] / list[i - 21][1] - 1) * 100;
    let state;
    if (bench) {
      if (!testable(i)) continue;
      const b0 = bench.get(list[i - 126][0]), b1 = bench.get(list[i - 21][0]), b2 = bench.get(list[i][0]);
      state = themeStateOf(trendAbs - (b2 / b0 - 1) * 100, recentAbs - (b2 / b1 - 1) * 100, { band: OUTCOME_BANDS.trend, recentBand: OUTCOME_BANDS.recent, absolute: trendAbs });
    } else state = themeStateOf(trendAbs, recentAbs);
    if (!state || i < next[state]) continue; // non-overlapping within each state
    buckets[state].push(outcome(i));
    drawdowns[state].push(windowDrawdown(closesOnly, i, horizon));
    next[state] = i + horizon;
  }
  const meta = { from: list[0]?.[0] || null, to: list[list.length - 1]?.[0] || null, horizon, basis: bench ? 'relative-banded' : 'absolute', ...(bench ? { outcome: 'excess' } : {}), ...baseRate(baseUp, baseN),
    ...(bench ? { testableFrom: firstTestable == null ? null : list[firstTestable][0], testableTo: lastTestable == null ? null : list[lastTestable][0] } : {}) };
  return { ...Object.fromEntries(Object.entries(buckets).map(([state, values]) => [state, summariseOutcomes(values, meta, { drawdowns: drawdowns[state], base })])), basis: meta.basis,
    ...(bench ? { rule: THEME_STAGE_RULE, benchmark: benchmarkField, fingerprint: horizon === THEME_OUTCOME_HORIZON ? OUTCOME_STAMPS.themeStage : null } : {}) };
}
