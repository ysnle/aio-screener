import { RULES } from '../../rules/thresholds.js';
import { finiteNumber as finite } from '../../shared/number.js';

export function fearGreedBand(value) {
  const score = finite(value);
  if (score == null || score < 0 || score > 100) return Object.freeze({ score: null, label: '판정 보류', blocked: true });
  const published = Math.round(score);
  const { extremeFearBelow, fearBelow, greedAbove, extremeGreedAbove } = RULES.fearGreed;
  if (published < extremeFearBelow) return Object.freeze({ score, label: '극단 공포', blocked: false });
  if (published < fearBelow) return Object.freeze({ score, label: '공포', blocked: false });
  if (published <= greedAbove) return Object.freeze({ score, label: '중립', blocked: false });
  if (published <= extremeGreedAbove) return Object.freeze({ score, label: '탐욕', blocked: false });
  return Object.freeze({ score, label: '극단 탐욕', blocked: false });
}

/**
 * The one VIX term-structure judgement (volatility-state.js reads it for every screen). `state`: 'inverted' (VIX at or over
 * the 3-month VIX), 'front' (under it, the 9-day VIX over VIX), 'flat' (VIX ÷ 3-month at or over the calm line) or
 * 'normal'. Without a 9-day close the front leg is unknown (frontInverted null) and the ratio still decides.
 */
export function vixTermStructure(values = {}) {
  const short = finite(values.vix9d);
  const spot = finite(values.vix);
  const medium = finite(values.vix3m);
  const long = finite(values.vix6m);
  const points = Object.freeze({ short, spot, medium, long });
  if ([spot, medium].some((value) => value == null || value < 0) || [short, long].some((value) => value != null && value < 0)) {
    return Object.freeze({ regime: '판정 보류', state: null, ratio: null, inverted: null, blocked: true, points });
  }
  const V = RULES.volatility;
  const ratio = medium > 0 ? spot / medium : null;
  const full = ratio != null ? ratio >= V.invertedRatioAt : spot > 0;
  const front = full || short == null ? (full ? false : null) : short > spot;
  const state = full ? 'inverted' : front ? 'front' : ratio != null && ratio >= V.calmRatioBelow ? 'flat' : 'normal';
  return Object.freeze({ regime: full ? '백워데이션' : front ? '앞쪽 역전(9일물 > 30일물)' : '콘탱고', state, ratio, inverted: full || !!front, frontInverted: front, blocked: false, points });
}

export function deriveSentimentSummary({ fearGreed, vix9d, vix, vix3m, vix6m } = {}) {
  const fg = fearGreedBand(fearGreed);
  const term = vixTermStructure({ vix9d, vix, vix3m, vix6m });
  return Object.freeze({
    fearGreed: fg,
    vixTermStructure: term,
    blocked: fg.blocked || term.blocked,
    state: fg.blocked || term.blocked ? '판정 보류' : `${fg.label}, ${term.regime}`
  });
}
