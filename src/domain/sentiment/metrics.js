import { RULES } from '../rules/thresholds.js';
import { finiteNumber as finite } from '../shared/number.js';

export function fearGreedBand(value) {
  const score = finite(value);
  if (score == null || score < 0 || score > 100) return Object.freeze({ score: null, label: '판정 보류', blocked: true });
  // P1534: banded on the whole number CNN publishes (25 is fear, 45 neutral, 55 neutral, 75 greed), the same edges as RULES.fearGreed.
  const published = Math.round(score);
  const { extremeFearBelow, fearBelow, greedAbove, extremeGreedAbove } = RULES.fearGreed;
  if (published < extremeFearBelow) return Object.freeze({ score, label: '극단 공포', blocked: false });
  if (published < fearBelow) return Object.freeze({ score, label: '공포', blocked: false });
  if (published <= greedAbove) return Object.freeze({ score, label: '중립', blocked: false });
  if (published <= extremeGreedAbove) return Object.freeze({ score, label: '탐욕', blocked: false });
  return Object.freeze({ score, label: '극단 탐욕', blocked: false });
}

export function vixTermStructure(values = {}) {
  const short = finite(values.vix9d);
  const spot = finite(values.vix);
  const medium = finite(values.vix3m);
  const long = finite(values.vix6m);
  if ([short, spot, medium, long].some((value) => value == null || value < 0)) {
    return Object.freeze({ regime: '판정 보류', inverted: null, blocked: true, points: Object.freeze({ short, spot, medium, long }) });
  }
  // v59.43 (X bookmark 2111332560634888446): VIX9D above VIX is a front-end inversion even while the 3- and 6-month
  // points still slope up; it was reported as 콘탱고.
  // v59.45 (R4-04): the curve is inverted on the same line every other reader uses — VIX/VIX3M at or above
  // RULES.volatility.invertedRatioAt (VIX = VIX3M already counts); a 9-day point above the rest is the front end only.
  const full = medium > 0 ? spot / medium >= RULES.volatility.invertedRatioAt : spot > 0;
  const front = !full && short > spot;
  return Object.freeze({ regime: full ? '백워데이션' : front ? '앞쪽 역전(9일물 > 30일물)' : '콘탱고', inverted: full || front, frontInverted: front, blocked: false, points: Object.freeze({ short, spot, medium, long }) });
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
