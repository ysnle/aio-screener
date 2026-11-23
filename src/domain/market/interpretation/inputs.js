import { readNumber } from '../../shared/number.js';

/**
 * The regime input (`market`) from the published macro block and the sentiment records.
 * Browser-only overrides (a fresher HY read, the canonical F&G metric) are passed as `credit` fields and win when set.
 */
export function regimeMarketInput({ macro = null, fearGreed = null, history = [], macroHistory = null, breadthSp500 = null, aaii = null, credit = {}, rates = {}, nowMs = Date.now() } = {}) {
  const m = macro || {};
  const hy = readNumber(m.hyOAS);
  const hyDelta5 = readNumber(m.hyOASDelta5);
  const fg = readNumber(fearGreed?.score);
  const pick = (override, fallback) => (override !== undefined && override !== null ? override : fallback);
  // The weekly AAII survey (data.json marketSurveys.aaii; the browser's DATA_SNAPSHOT copy): a reference input of the
  // 투자 심리 screen only, never a regime axis.
  const aaiiBear = readNumber(aaii?.bearish);
  return {
    history: Array.isArray(history) ? history : [],
    macroHistory: macroHistory || null,
    now: nowMs,
    breadthSp500: breadthSp500 || null,
    aaii: aaiiBear == null ? null : { bullish: readNumber(aaii.bullish), bearish: aaiiBear, observedAt: aaii.observedAt || null },
    credit: {
      hyBp: pick(credit.hyBp, hy == null ? null : Math.round(hy * 100)),
      hyAsOf: pick(credit.hyAsOf, m._asOf_hyOAS || null),
      hyDelta5Bp: pick(credit.hyDelta5Bp, hyDelta5 == null ? null : Math.round(hyDelta5 * 100)),
      fg: pick(credit.fg, fg),
      fgAsOf: pick(credit.fgAsOf, fg != null ? fearGreed?.asOf || null : null),
      aaiiAsOf: pick(credit.aaiiAsOf, aaiiBear == null ? null : aaii.observedAt || null)
    },
    rates: {
      realYield10: pick(rates.realYield10, readNumber(m.realYield10)),
      realYield10Delta5: pick(rates.realYield10Delta5, readNumber(m.realYield10Delta5)),
      breakeven10Delta5: pick(rates.breakeven10Delta5, readNumber(m.breakeven10Delta5)),
      dgs2Delta5: pick(rates.dgs2Delta5, readNumber(m.dgs2Delta5)),
      dgs10Delta5: pick(rates.dgs10Delta5, readNumber(m.dgs10Delta5)),
      asOf: pick(rates.asOf, m._asOf_realYield10 || m._asOf_dgs10 || null),
      realAsOf: pick(rates.realAsOf, m._asOf_realYield10 || null),
      breakevenAsOf: pick(rates.breakevenAsOf, m._asOf_breakeven10 || null),
      dgs2AsOf: pick(rates.dgs2AsOf, m._asOf_dgs2 || null)
    }
  };
}

/** S&P 500 weights (screener indexWeights), consensus EPS and the 10y real yield for the index-earnings stage. */
export function indexEarningsInput({ weights = null, consensus = null, macro = null } = {}) {
  const m = macro || {};
  return {
    weights: weights && Array.isArray(weights.rows) ? weights : null,
    consensus: consensus || null,
    realYield10: readNumber(m.realYield10),
    realYieldAsOf: m._asOf_realYield10 || null
  };
}

/** The full buildMarketInterpretation() input. Every adapter returns exactly this. */
export function interpretationInput({ market, macro = null, calendar = null, outcomes = null, previous = null, screenerRows = null, themeMaps = null, rotationHistory = null, indexEarnings = null, nowMs = Date.now() } = {}) {
  return {
    market: { ...(market || regimeMarketInput({ macro, nowMs })), now: nowMs },
    macro: macro || null,
    calendar: { releases: calendar?.releases || {}, schedules: calendar?.schedules || {} },
    outcomes: outcomes || null,
    previous: previous || null,
    screenerRows: Array.isArray(screenerRows) ? screenerRows : null,
    themeMaps: Array.isArray(screenerRows) ? (themeMaps || { usThemes: [], krThemeMap: {}, labels: {} }) : null,
    rotationHistory: rotationHistory || null,
    indexEarnings: indexEarnings || null,
    nowMs
  };
}
