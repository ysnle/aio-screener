import { readNumber as finite } from '../shared/number.js';
// P1416 (owner request 2026-10-03, open-source comparison): participation signals beyond the
// moving-average ratios. Definitions follow their public sources, checked against the
// xang1234/stock-screener breadth formulas (revision 3, Apache-2.0) — reimplemented here, not copied:
//   · 4% movers (StockBee): adjusted daily return ≥ +4% / ≤ -4% on volume above the prior session
//     and at least 100,000 shares.
//   · 52-week new high / low: the split/dividend-adjusted high (low) exceeds the highest high
//     (lowest low) of the prior sessions. A one-year download holds about 251 sessions, so a session
//     needs at least NEW_HIGH_LOW_MIN_PRIOR prior sessions; earlier sessions stay unknown.
//   · % above the 40-day average (Worden's T2108 family).
//   · Distribution day (O'Neil/IBD): the index closes down ≥ 0.2% on volume above the prior
//     session; the count covers the latest 25 sessions.
// Every count carries its own eligible denominator; a missing input is unknown, never a zero.

export const BREADTH_SIGNAL_MODEL_VERSION = 'breadth-signals.v3';
// v58.68 (owner 2026-10-23): a 52-week low missed the sell-off the owner saw — on 10/22 30 of ~900 names made a
// 52-week closing low but 189 a 20-session one (semis 41 of 65). Recent closing lows (adjusted close below every
// close of the prior 20 / 63 sessions, all finite) are counted beside the 52-week count.
export const RECENT_LOW_WINDOWS = Object.freeze([20, 63]);
export const MOVER_THRESHOLD = 0.04;
export const MOVER_MIN_VOLUME = 100000;
export const NEW_HIGH_LOW_MIN_PRIOR = 240;
export const NEW_HIGH_LOW_WINDOW = 251;
export const DISTRIBUTION_DROP = -0.002;
export const DISTRIBUTION_WINDOW = 25;
// Audit 2026-10-17 (owner D8): IBD retires a distribution day once the index closes this share above that day's close.
export const DISTRIBUTION_RALLY_EXPIRY = 0.05;


/**
 * Per-session signals for one symbol.
 * @param {{ closes?: number[], adjCloses: number[], highs?: number[], lows?: number[], volumes?: number[] }} series
 * @returns {Array<{ mover: 'up'|'down'|null, moverEligible: boolean, change: number|null, newHigh: boolean, newLow: boolean, highLowEligible: boolean, above40: boolean, above40Eligible: boolean, low20: boolean, low20Eligible: boolean, low63: boolean, low63Eligible: boolean }>}
 */
export function evaluateSymbolSignals({ closes = [], adjCloses = [], highs = [], lows = [], volumes = [] } = {}) {
  const n = adjCloses.length;
  const adj = adjCloses.map(finite);
  const raw = closes.map(finite);
  // Adjust the intraday range by the same factor as the close, so a split is not a new low.
  const factor = (i) => (adj[i] != null && raw[i] != null && raw[i] > 0 ? adj[i] / raw[i] : null);
  const adjHigh = highs.map((value, i) => (finite(value) != null && factor(i) != null ? finite(value) * factor(i) : null));
  const adjLow = lows.map((value, i) => (finite(value) != null && factor(i) != null ? finite(value) * factor(i) : null));
  const out = [];
  let sum40 = 0;
  let count40 = 0;
  for (let i = 0; i < n; i += 1) {
    // 40-day simple average of adjusted closes ending at i (requires 40 finite values).
    if (adj[i] != null) { sum40 += adj[i]; count40 += 1; }
    if (i >= 40 && adj[i - 40] != null) { sum40 -= adj[i - 40]; count40 -= 1; }
    const above40Eligible = i >= 39 && count40 === 40;
    const row = { mover: null, moverEligible: false, change: null, newHigh: false, newLow: false, highLowEligible: false, above40: false, above40Eligible,
      low20: false, low20Eligible: false, low63: false, low63Eligible: false };
    for (const window of RECENT_LOW_WINDOWS) {
      if (i < window || adj[i] == null) continue;
      let lowest = Infinity;
      let complete = true;
      for (let j = i - window; j < i; j += 1) { if (adj[j] == null) { complete = false; break; } if (adj[j] < lowest) lowest = adj[j]; }
      if (!complete) continue;
      row[`low${window}Eligible`] = true;
      row[`low${window}`] = adj[i] < lowest;
    }
    if (above40Eligible) row.above40 = adj[i] > sum40 / 40;
    if (i > 0 && adj[i] != null && adj[i - 1] != null && adj[i - 1] > 0) {
      row.change = adj[i] / adj[i - 1] - 1;
      const volume = finite(volumes[i]);
      const prior = finite(volumes[i - 1]);
      row.moverEligible = volume != null && prior != null;
      if (row.moverEligible && volume >= MOVER_MIN_VOLUME && volume > prior) {
        if (row.change >= MOVER_THRESHOLD - 1e-12) row.mover = 'up';
        else if (row.change <= -MOVER_THRESHOLD + 1e-12) row.mover = 'down';
      }
    }
    if (i >= NEW_HIGH_LOW_MIN_PRIOR && adjHigh[i] != null && adjLow[i] != null) {
      const start = Math.max(0, i - NEW_HIGH_LOW_WINDOW);
      let priorHigh = -Infinity;
      let priorLow = Infinity;
      let complete = true;
      for (let j = start; j < i; j += 1) {
        if (adjHigh[j] == null || adjLow[j] == null) { complete = false; break; }
        if (adjHigh[j] > priorHigh) priorHigh = adjHigh[j];
        if (adjLow[j] < priorLow) priorLow = adjLow[j];
      }
      if (complete) {
        row.highLowEligible = true;
        row.newHigh = adjHigh[i] > priorHigh;
        row.newLow = adjLow[i] < priorLow;
      }
    }
    out.push(row);
  }
  return out;
}

/**
 * Distribution days of an index for each session (count over the latest DISTRIBUTION_WINDOW sessions). A day stops
 * counting once a later close, up to that session, stands DISTRIBUTION_RALLY_EXPIRY (5%) above its own close — the
 * IBD rule; without it a sharp rally kept its old selling days on the count for five weeks.
 * @param {Array<{ date: string, close: number, volume: number }>} bars ascending
 * @returns {Array<{ date: string, distribution: boolean|null, count: number|null }>}
 */
export function distributionDaySeries(bars = []) {
  const flags = bars.map((bar, i) => {
    if (i === 0) return null;
    const close = finite(bar?.close);
    const prevClose = finite(bars[i - 1]?.close);
    const volume = finite(bar?.volume);
    const prevVolume = finite(bars[i - 1]?.volume);
    if (close == null || prevClose == null || !(prevClose > 0) || volume == null || prevVolume == null || !(volume > 0)) return null;
    return close / prevClose - 1 <= DISTRIBUTION_DROP + 1e-12 && volume > prevVolume;
  });
  return bars.map((bar, i) => {
    if (i + 1 < DISTRIBUTION_WINDOW + 1) return { date: bar.date, distribution: flags[i], count: null };
    const from = i + 1 - DISTRIBUTION_WINDOW;
    const span = flags.slice(from, i + 1);
    if (span.some((flag) => flag == null)) return { date: bar.date, distribution: flags[i], count: null };
    let count = 0, highest = -Infinity;
    // Walk back from the session so `highest` is the best close after each candidate day, up to session i.
    for (let j = i; j >= from; j -= 1) {
      if (flags[j] && !(highest >= finite(bars[j].close) * (1 + DISTRIBUTION_RALLY_EXPIRY))) count += 1;
      highest = Math.max(highest, finite(bars[j].close) ?? -Infinity);
    }
    return { date: bar.date, distribution: flags[i], count };
  });
}
