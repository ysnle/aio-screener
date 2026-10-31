// v58.79 (owner 2026-10-25, "전문 차트 작도가 자동으로 안 되는거야?"): the drawings a chartist adds by hand, made by fixed rules
// so two readers get the same line — a trendline through two confirmed swing points that no close has broken since, and
// the volume-weighted average price anchored at a dated event (Brian Shannon's anchored VWAP). Pattern names (head and
// shoulders, wedges) and Fibonacci ratios stay out: they depend on the reader and carry no tested rule. Pure functions on
// completed daily bars — no DOM, no network; nothing here is an entry, stop or target (R724).
import { swingPoints } from './price-levels.js';
import { adrPctOf } from './definitions.js';
import { RULES } from '../rules/thresholds.js';
import { finiteNumber as finite } from '../shared/number.js';

export const DRAWING_RULES = Object.freeze({
  swingSpan: 5, // a swing point is the extreme of 5 bars on each side, as on the price-level map
  lookback: 252, // pivots are read over the last year
  recentPivots: 6, // pairs are formed from the newest six pivots of each kind
  minSpan: 10, // the two pivots are at least 10 sessions apart
  touchAdr: 0.25, // a bar touches the line when its low (high) comes within a quarter ADR of it
  breakAdr: 0.25, // a close more than a quarter ADR through the line breaks it
  confirmTouches: 3 // two pivots define a line; a third touch confirms it
});


function bestLine(bars, pivots, side, rules, adrPrice) {
  const last = bars.length - 1;
  const recent = pivots.slice(-rules.recentPivots);
  const tol = adrPrice * rules.touchAdr, brk = adrPrice * rules.breakAdr;
  let best = null;
  for (let a = 0; a < recent.length; a++) {
    for (let b = a + 1; b < recent.length; b++) {
      const i = recent[a], j = recent[b];
      if (j - i < rules.minSpan) continue;
      const p1 = side === 'support' ? bars[i].low : bars[i].high, p2 = side === 'support' ? bars[j].low : bars[j].high;
      // Support rises (higher lows), resistance falls (lower highs).
      if (side === 'support' ? !(p2 > p1) : !(p2 < p1)) continue;
      const slope = (p2 - p1) / (j - i);
      const at = (k) => p1 + slope * (k - i);
      let broken = false, touches = 0;
      for (let k = i; k <= last; k++) {
        const line = at(k);
        if (k > i && (side === 'support' ? bars[k].close < line - brk : bars[k].close > line + brk)) { broken = true; break; }
        if (side === 'support' ? Math.abs(bars[k].low - line) <= tol : Math.abs(bars[k].high - line) <= tol) touches += 1;
      }
      if (broken || at(last) <= 0) continue;
      // More touches first, then the line anchored on the newer pivot.
      if (!best || touches > best.touches || (touches === best.touches && j > best.to.index)) {
        best = { side, from: { index: i, price: p1 }, to: { index: j, price: p2 }, slopePerBar: slope, touches, value: at(last) };
      }
    }
  }
  if (!best) return null;
  const close = bars[last].close;
  return { ...best, status: best.touches >= rules.confirmTouches ? 'confirmed' : 'tentative', distancePct: (best.value / close - 1) * 100,
    slopePctPerWeek: best.slopePerBar * 5 / close * 100 };
}

/** The best unbroken rising support line and falling resistance line, each through two confirmed swing points. */
export function ruleTrendLines(bars, rules = DRAWING_RULES) {
  const list = Array.isArray(bars) ? bars.filter((bar) => finite(bar?.high) != null && finite(bar?.low) != null && finite(bar?.close) != null) : [];
  if (list.length < rules.swingSpan * 2 + rules.minSpan + 1) return { available: false, support: null, resistance: null };
  const adrPct = adrPctOf(list.map((bar) => bar.high), list.map((bar) => bar.low), list.map((bar) => bar.close));
  if (!(adrPct > 0)) return { available: false, support: null, resistance: null };
  const adrPrice = list.at(-1).close * adrPct / 100;
  const { highs, lows } = swingPoints(list, Math.max(0, list.length - rules.lookback), rules.swingSpan);
  return { available: true, adrPct, support: bestLine(list, lows, 'support', rules, adrPrice), resistance: bestLine(list, highs, 'resistance', rules, adrPrice), rules };
}

/** Volume-weighted average of the typical price ((H+L+C)/3) from the anchor bar to each later bar; null before the anchor. */
export function anchoredVwap(bars, anchorIndex) {
  const list = Array.isArray(bars) ? bars : [];
  if (!(anchorIndex >= 0 && anchorIndex < list.length)) return null;
  let pv = 0, vol = 0;
  const values = list.map((bar, k) => {
    if (k < anchorIndex) return null;
    const volume = finite(bar?.volume);
    // v59.45 P24-VWAP-01: a bar without a volume figure repeated the last VWAP as if nothing traded. It is a gap in the
    // line (null) and leaves the sum; a reported 0 (a halted session) still carries the value.
    if (k > anchorIndex && volume == null) return null;
    if (volume > 0 && finite(bar.high) != null && finite(bar.low) != null && finite(bar.close) != null) { pv += (bar.high + bar.low + bar.close) / 3 * volume; vol += volume; }
    return vol > 0 ? pv / vol : null;
  });
  return values.some((value) => value != null) ? values : null;
}

/** Dated anchors: the 52-week high, the lowest low of the last six months, and the largest opening gap of the last quarter. */
export function vwapAnchors(bars) {
  const list = Array.isArray(bars) ? bars : [];
  const last = list.length - 1;
  if (last < 20 || !list.some((bar) => finite(bar?.volume) > 0)) return [];
  const pick = (from, better) => { let best = -1; for (let k = Math.max(0, from); k <= last; k++) if (best < 0 || better(list[k], list[best])) best = k; return best; };
  const out = [];
  // v59.45 P24-VWAP-01: the anchor names the span actually loaded — 60 bars read "52주 고점" while the chart's own range
  // said "최근 60거래일". A year needs RULES fullYearSessions bars, six months 126.
  const span = last + 1;
  const high = pick(last - 251, (a, b) => a.high > b.high);
  if (high >= 0 && high < last - 1) out.push({ id: 'high52', label: span >= RULES.technical.fullYearSessions ? '52주 고점' : `최근 ${Math.min(span, 252)}거래일 고점`, short: '고점', index: high });
  const low = pick(last - 125, (a, b) => a.low < b.low);
  if (low >= 0 && low < last - 1) out.push({ id: 'low6m', label: span >= 126 ? '6개월 저점' : `최근 ${span}거래일 저점`, short: '저점', index: low });
  let gap = -1, gapPct = 0;
  for (let k = Math.max(1, last - 62); k <= last; k++) {
    const pct = list[k - 1].close > 0 ? Math.abs(list[k].open / list[k - 1].close - 1) * 100 : 0;
    if (pct > gapPct) { gap = k; gapPct = pct; }
  }
  if (gap > 0 && gapPct >= 2 && gap < last && !out.some((row) => row.index === gap)) out.push({ id: 'gap', label: `최근 갭(${list[gap].open > list[gap - 1].close ? '+' : '-'}${gapPct.toFixed(1)}%)`, short: '갭', index: gap });
  return out;
}

/** The mapped level nearest to a price the user drew, with the distance in % and in average daily ranges. */
export function nearestMappedLevel(map, price) {
  if (!map?.available || !(price > 0)) return null;
  const levels = [...(map.above || []), ...(map.below || [])];
  if (!levels.length) return null;
  const level = levels.reduce((best, row) => (Math.abs(row.price - price) < Math.abs(best.price - price) ? row : best));
  const pct = (price / level.price - 1) * 100;
  return { level, pct, adrMultiple: map.adrPct > 0 ? Math.abs(pct) / map.adrPct : null, vsClose: (price / map.close - 1) * 100 };
}
