// Expertise review 2026-10-19 (redesign): the stress panel multiplied hand-picked sector constants (Tech −0.8% for a
// +100bp rate shock), so its numbers had nothing behind them. A risk desk estimates each book's sensitivity from its own
// return history. This module regresses the book's weekly return — today's weights applied to each holding's
// adjusted closes — on one factor at a time over the same weeks:
//   equity  each holding's home index (S&P 500 for US listings, KOSPI for .KS/.KQ), blended by weight;
//   rate    the change in the 10-year Treasury yield (bp);
//   oil     the WTI front-month change (%);
//   krw     the USD/KRW change (%; positive = weaker won).
// One factor at a time on purpose: a "rate +100bp" scenario wants the total association (a rate rise usually moves
// equities too), not a partial effect holding the market fixed. Weekly (5-session) steps from the end of the book's
// common dates: Korean and US closes on the same calendar date are ~16 hours apart, which daily pairs understate.
// A shock is the weekly relationship scaled linearly — an extrapolation the label states, never a forecast.
import { buildCloseSeries } from '../market/close-series.js';

export const STRESS_MIN_WEEKS = 30; // below this the slope's error band is too wide to print a figure
const STEP = 5;
const MAX_FACTOR_LAG_DAYS = 4; // a factor value on or before the holding date, at most this many calendar days earlier

export const STRESS_FACTORS = Object.freeze({
  equity: Object.freeze({ label: '보유 시장 지수', unit: '%' }),
  rate: Object.freeze({ label: '미 10년물 금리', unit: 'bp' }),
  oil: Object.freeze({ label: 'WTI 유가', unit: '%' }),
  krw: Object.freeze({ label: '원/달러 환율', unit: '%' })
});

const isKr = (sym) => /\.(KS|KQ)$/i.test(String(sym || ''));

function asOfLookup(series) {
  const points = (Array.isArray(series) ? series : []).filter((p) => p?.date && Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
  return (date) => {
    let lo = 0; let hi = points.length - 1; let hit = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (points[mid].date <= date) { hit = points[mid]; lo = mid + 1; } else hi = mid - 1; }
    return hit && (Date.parse(date) - Date.parse(hit.date)) <= MAX_FACTOR_LAG_DAYS * 86400000 ? hit.value : null;
  };
}

/** Ordinary least squares of y on one x: slope, its standard error, R² and n. Null below STRESS_MIN_WEEKS pairs. */
export function regressOne(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  if (n < STRESS_MIN_WEEKS) return null;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxx = 0; let sxy = 0; let syy = 0;
  for (const [x, y] of pairs) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
  if (!(sxx > 0)) return null;
  const beta = sxy / sxx;
  const rss = Math.max(0, syy - beta * sxy);
  const se = Math.sqrt(rss / (n - 2) / sxx);
  return { beta, se, r2: syy > 0 ? 1 - rss / syy : null, n };
}

/**
 * @param {{ historyMap: Record<string, Record<string, number>>, commonDates: string[], weights: Record<string, number>, history: object[] }} input
 *   historyMap: adjusted closes by date per holding (local currency); weights: current base-currency weights summing to 1.
 */
export function estimateBookSensitivities({ historyMap = {}, commonDates = [], weights = {}, history = [] } = {}) {
  const dates = [...(Array.isArray(commonDates) ? commonDates : [])].sort();
  const syms = Object.keys(weights).filter((sym) => weights[sym] > 0 && historyMap[sym]);
  const covered = syms.reduce((s, sym) => s + weights[sym], 0);
  if (!syms.length || covered < 0.8) return { available: false, reason: 'weights-uncovered', covered };
  const marks = [];
  for (let k = dates.length - 1; k >= 0; k -= STEP) marks.unshift(dates[k]);
  if (marks.length - 1 < STRESS_MIN_WEEKS) return { available: false, reason: 'weeks-insufficient', weeks: Math.max(0, marks.length - 1) };
  const at = {
    spx: asOfLookup(buildCloseSeries(history, 'spx')),
    kospi: asOfLookup(buildCloseSeries(history, 'kospi')),
    tnx: asOfLookup(buildCloseSeries(history, 'tnx')),
    wti: asOfLookup(buildCloseSeries(history, 'wti')),
    usdkrw: asOfLookup(buildCloseSeries(history, 'usdkrw'))
  };
  const pct = (fn, a, b) => { const x = fn(a); const y = fn(b); return x > 0 && y > 0 ? (y / x - 1) * 100 : null; };
  const book = []; const factors = { equity: [], rate: [], oil: [], krw: [] };
  for (let i = 1; i < marks.length; i += 1) {
    const a = marks[i - 1]; const b = marks[i];
    let ret = 0; let eq = 0; let ok = true;
    for (const sym of syms) {
      const pa = historyMap[sym][a]; const pb = historyMap[sym][b];
      const idx = pct(isKr(sym) ? at.kospi : at.spx, a, b);
      if (!(pa > 0) || !(pb > 0) || idx == null) { ok = false; break; }
      ret += (weights[sym] / covered) * (pb / pa - 1) * 100;
      eq += (weights[sym] / covered) * idx;
    }
    if (!ok) continue;
    const ta = at.tnx(a); const tb = at.tnx(b);
    book.push(ret);
    factors.equity.push(eq);
    factors.rate.push(ta != null && tb != null ? (tb - ta) * 100 : null);
    factors.oil.push(pct(at.wti, a, b));
    factors.krw.push(pct(at.usdkrw, a, b));
  }
  const fits = Object.fromEntries(Object.keys(factors).map((key) => [key, regressOne(factors[key], book)]));
  return { available: true, weeks: book.length, from: marks[0], to: marks[marks.length - 1], covered, fits };
}

/** A scenario's book move (%) with a 95% band from the slope's standard error; `distinct` is false when the band spans 0. */
export function scenarioImpact(fit, shock) {
  if (!fit || !Number.isFinite(shock)) return null;
  const mid = fit.beta * shock;
  const half = 1.96 * fit.se * Math.abs(shock);
  return { mid, low: mid - half, high: mid + half, distinct: Math.abs(mid) > half, r2: fit.r2, n: fit.n, beta: fit.beta };
}

/**
 * Translation effect of a won move on holdings priced in another currency than the base (fraction of book, %).
 * USD/KRW +x%: a KRW-based book gains x% on its USD holdings; a USD-based book loses x/(1+x) on its KRW holdings.
 */
export function krwTranslationPct({ weights = {}, baseCurrency = null, shockPct = 10 } = {}) {
  const base = String(baseCurrency || '').toUpperCase();
  if (base !== 'KRW' && base !== 'USD') return null;
  let total = 0;
  for (const [sym, w] of Object.entries(weights)) {
    if (base === 'KRW' && !isKr(sym)) total += w * shockPct;
    if (base === 'USD' && isKr(sym)) total += w * ((1 / (1 + shockPct / 100)) - 1) * 100;
  }
  return total;
}
