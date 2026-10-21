// v58.55 (개편 v2 3e): the Taylor-rule reference beside the 거시 rate strip. Taylor (1993):
//   rule rate = r* + π + 0.5·(π − 2) + 0.5·(output gap)
// π is core PCE year over year (the FOMC's 2% measure) and the output gap comes from Okun's law, gap ≈ −2 × (u − u*), with
// u* = CBO's natural rate of unemployment (FRED NROU, quarterly). r* (the neutral real rate) is an assumption, not an
// observation, so the reader picks 0.5% or 1.0% and the model also returns the rule across both. The result is a reference
// point the policy rate is compared with — it never says what the Fed should or will do.
import { seriesOf, yoySeries } from './macro-read.js';

export const TAYLOR_R_STAR_OPTIONS = Object.freeze([0.5, 1.0]);
export const TAYLOR_INFLATION_TARGET = 2;
export const OKUN_COEFFICIENT = 2;
const NEAR_PP = 0.25; // within one usual 25bp step the policy rate reads as "near" the rule

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

function ruleRate(rStar, inflation, gap) {
  return rStar + inflation + 0.5 * (inflation - TAYLOR_INFLATION_TARGET) + 0.5 * gap;
}

/**
 * @param {object} input
 * @param {object} [input.macroHistory] macro-history.json (corePceIndex, unemployment, naturalUnemployment)
 * @param {object} [input.macro] data.json macro (fedTargetLower/Upper and their date)
 * @param {number} [input.rStar] assumed neutral real rate, one of TAYLOR_R_STAR_OPTIONS
 */
export function taylorRule({ macroHistory = null, macro = null, rStar = TAYLOR_R_STAR_OPTIONS[0] } = {}) {
  const r = TAYLOR_R_STAR_OPTIONS.includes(Number(rStar)) ? Number(rStar) : TAYLOR_R_STAR_OPTIONS[0];
  const inflation = yoySeries(seriesOf(macroHistory, 'corePceIndex')).at(-1) || null;
  const unemployment = seriesOf(macroHistory, 'unemployment').at(-1) || null;
  // The CBO estimate for the quarter the unemployment reading falls in (the latest quarter on or before that month).
  const nrouRows = seriesOf(macroHistory, 'naturalUnemployment');
  const natural = unemployment ? nrouRows.filter((row) => row.date <= unemployment.date).at(-1) || null : nrouRows.at(-1) || null;
  const upper = finite(macro?.fedTargetUpper);
  const lower = finite(macro?.fedTargetLower);
  const target = upper != null && lower != null && lower <= upper
    ? { lower, upper, mid: (lower + upper) / 2, asOf: macro?._asOf_fedTargetUpper || null }
    : null;
  const missing = [
    inflation ? null : 'corePce',
    unemployment ? null : 'unemployment',
    natural ? null : 'naturalUnemployment',
    target ? null : 'target'
  ].filter(Boolean);
  const base = { rStar: r, inflation, unemployment, natural, target, missing };
  if (!inflation || !unemployment || !natural) return { ...base, available: false };
  const unemploymentGap = unemployment.value - natural.value;
  const outputGap = -OKUN_COEFFICIENT * unemploymentGap;
  const rule = ruleRate(r, inflation.value, outputGap);
  const [lo, hi] = TAYLOR_R_STAR_OPTIONS.map((option) => ruleRate(option, inflation.value, outputGap));
  const diff = target ? target.mid - rule : null;
  const stance = diff == null ? null : Math.abs(diff) < NEAR_PP ? 'near' : diff > 0 ? 'tighter' : 'looser';
  return { ...base, available: true, unemploymentGap, outputGap, rule, range: { lo, hi }, diff, stance };
}
