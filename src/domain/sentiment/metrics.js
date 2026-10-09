import { RULES } from '../rules/thresholds.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

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
  const inverted = short > long || spot > medium;
  return Object.freeze({ regime: inverted ? '백워데이션' : '콘탱고', inverted, blocked: false, points: Object.freeze({ short, spot, medium, long }) });
}

export function deriveSentimentSummary({ fearGreed, vix9d, vix, vix3m, vix6m } = {}) {
  const fg = fearGreedBand(fearGreed);
  const term = vixTermStructure({ vix9d, vix, vix3m, vix6m });
  return Object.freeze({
    fearGreed: fg,
    vixTermStructure: term,
    blocked: fg.blocked || term.blocked,
    state: fg.blocked || term.blocked ? '판정 보류' : `${fg.label} · ${term.regime}`
  });
}
