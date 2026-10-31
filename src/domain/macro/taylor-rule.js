// v58.55 (개편 v2 3e): the Taylor-rule reference beside the 거시 rate strip. Taylor (1993):
//   rule rate = r* + π + 0.5·(π − 2) + 0.5·(output gap)
// π is core PCE year over year (the FOMC's 2% measure) and the output gap comes from Okun's law, gap ≈ -2 × (u − u*), with
// u* = CBO's natural rate of unemployment (FRED NROU, quarterly). r* (the neutral real rate) is an assumption, not an
// observation, so the reader picks 0.5% or 1.0% and the model also returns the rule across both. The result is a reference
// point the policy rate is compared with — it never says what the Fed should or will do.
import { seriesOf, yoySeries } from './macro-read.js';
import { readNumber as finite } from '../shared/number.js';

// v58.56 (re-audit #14): the default r* is no longer a fixed pick but the FOMC's own dated estimate — the Summary of Economic
// Projections' longer-run federal funds rate median (FRED FEDTARMDLR, one observation per SEP release) minus the 2% inflation
// target. 0.5% and 1.0% stay as the alternatives a reader can switch to in the formula fold. Without a collected SEP value
// the rule falls back to 0.5% and says so.
export const TAYLOR_R_STAR_OPTIONS = Object.freeze([0.5, 1.0]);
export const TAYLOR_R_STAR_SEP = 'sep';
// SEP is published four times a year (Mar/Jun/Sep/Dec); a median older than ~4 months means a release was missed.
export const TAYLOR_SEP_MAX_AGE_DAYS = 120;
export const TAYLOR_INFLATION_TARGET = 2;
export const OKUN_COEFFICIENT = 2;
const NEAR_PP = 0.25; // within one usual 25bp step the policy rate reads as "near" the rule
// Round-2 review (v58.55): inputs from different periods describe no single moment. PCE lags UNRATE by one month and NROU is
// dated at its quarter's first month, so up to 3 months apart is the normal release pattern; more means a feed fell behind.
export const TAYLOR_MAX_INPUT_SPREAD_MONTHS = 3;
const monthIndex = (date) => { const [y, m] = String(date).split('-').map(Number); return y * 12 + (m - 1); };


function ruleRate(rStar, inflation, gap) {
  return rStar + inflation + 0.5 * (inflation - TAYLOR_INFLATION_TARGET) + 0.5 * gap;
}

/**
 * @param {object} input
 * @param {object} [input.macroHistory] macro-history.json (corePceIndex, unemployment, naturalUnemployment)
 * @param {object} [input.macro] data.json macro (fedTargetLower/Upper and their date)
 * @param {number|string} [input.rStar] 'sep' / omitted (FOMC SEP longer-run median − 2%), or one of TAYLOR_R_STAR_OPTIONS
 * @param {number} [input.nowMs] clock for the SEP age check
 */
export function sepNeutral(macroHistory, nowMs = Date.now()) {
  const row = seriesOf(macroHistory, 'sepLongRunFedFunds').at(-1) || null;
  if (!row || !(row.value > 0 && row.value < 10)) return null;
  const ageDays = (nowMs - Date.parse(`${row.date}T00:00:00Z`)) / 86400000;
  return {
    date: row.date,
    longRun: row.value,
    rStar: Math.round((row.value - TAYLOR_INFLATION_TARGET) * 1000) / 1000,
    old: Number.isFinite(ageDays) && ageDays > TAYLOR_SEP_MAX_AGE_DAYS,
    stale: macroHistory?.series?.sepLongRunFedFunds?.stale === true
  };
}

export function taylorRule({ macroHistory = null, macro = null, rStar = null, nowMs = Date.now() } = {}) {
  const sep = sepNeutral(macroHistory, nowMs);
  // No explicit choice (or 'sep') → the SEP-implied r* when collected, else the first fixed option.
  const fixed = rStar != null && TAYLOR_R_STAR_OPTIONS.includes(Number(rStar)) ? Number(rStar) : null;
  const rStarSource = fixed == null && sep ? TAYLOR_R_STAR_SEP : 'assumed';
  const r = fixed ?? (sep ? sep.rStar : TAYLOR_R_STAR_OPTIONS[0]);
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
  // A series the producer kept from an earlier run (FRED failed this time) is marked stale in the artifact.
  const staleSeries = ['corePceIndex', 'unemployment', 'naturalUnemployment'].filter((field) => macroHistory?.series?.[field]?.stale === true);
  const dated = [inflation, unemployment, natural].filter(Boolean).map((row) => monthIndex(row.date));
  const spreadMonths = dated.length >= 2 ? Math.max(...dated) - Math.min(...dated) : 0;
  const stale = staleSeries.length > 0 || spreadMonths > TAYLOR_MAX_INPUT_SPREAD_MONTHS;
  const base = { rStar: r, rStarSource, sep, inflation, unemployment, natural, target, missing, stale, staleSeries, spreadMonths };
  if (!inflation || !unemployment || !natural) return { ...base, available: false };
  const unemploymentGap = unemployment.value - natural.value;
  const outputGap = -OKUN_COEFFICIENT * unemploymentGap;
  const rule = ruleRate(r, inflation.value, outputGap);
  const [lo, hi] = TAYLOR_R_STAR_OPTIONS.map((option) => ruleRate(option, inflation.value, outputGap));
  const sepRule = sep ? ruleRate(sep.rStar, inflation.value, outputGap) : null;
  const diff = target ? target.mid - rule : null;
  const stance = diff == null ? null : Math.abs(diff) < NEAR_PP ? 'near' : diff > 0 ? 'tighter' : 'looser';
  return { ...base, available: true, unemploymentGap, outputGap, rule, range: { lo, hi }, sepRule, diff, stance };
}
