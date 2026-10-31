// Owner 2026-10-19: the producers' adapter of the interpretation pipeline (src/domain/interpretation/
// market-interpretation.js). fetch-data (the published narrative) and build-scenario-state (scenario-state.json) build
// the regime, branches, structure flows, theme stages and market guide through this one function, from the same
// published artifacts the screens read. P28-INTERPRETATION-01: same function, not yet the same input — the browser
// adapter (src/data/selectors/interpretation.js) also passes rotationHistory (outlook sectors, flow), indexEarnings,
// calendar.releases (hand-kept release dates in js/aio-core.js), breadthSp500 and rates.dgs2AsOf, and keeps HY in
// received bp where this one rounds; stages fed only there are null here. Both use one clock (nowMs) per build.
import { buildMarketInterpretation } from '../../src/domain/interpretation/market-interpretation.js';
import { expandScreenerArtifact } from '../../src/data/screener-extended.js'; // v57.95 core row encoding

// P1635/P1685: the screen's regime inputs (credit with the 20-session HY change, rates, put/call) from the published
// market data. The browser reads the same values through src/data/selectors/market-inputs.js.
export function marketAnalysisRegimeInput(data, history = [], macroHistory = null) {
  const macro = data?.macro || {};
  const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const hy = num(macro.hyOAS);
  const hyDelta5 = num(macro.hyOASDelta5);
  // v57.50 C03: the screen's credit axis also reads the Cboe total put/call (briefing-read collectMarketInputs);
  // the narrative gets the same value and observation date, or the two surfaces judge credit on different inputs.
  const putCall = data?.putCall && !data.putCall.error ? data.putCall : null;
  const pcr = num(putCall?.totalPutCall);
  const pcrAsOf = pcr != null && /^\d{4}-\d{2}-\d{2}$/.test(String(putCall?.asOf || '')) ? putCall.asOf : null;
  return {
    history: Array.isArray(history) ? history : [],
    macroHistory: macroHistory || null,
    now: Date.now(), // M05: the narrative uses the same latest-session admission as the screen
    credit: {
      hyBp: hy == null ? null : Math.round(hy * 100), hyAsOf: macro._asOf_hyOAS || null,
      hyDelta5Bp: hyDelta5 == null ? null : Math.round(hyDelta5 * 100),
      fg: num(data?.fearGreed?.score), fgAsOf: data?.fearGreed?.asOf || null, pcr: pcrAsOf ? pcr : null, pcrAsOf, aaiiAsOf: null
    },
    rates: {
      realYield10: num(macro.realYield10), realYield10Delta5: num(macro.realYield10Delta5),
      breakeven10Delta5: num(macro.breakeven10Delta5), dgs2Delta5: num(macro.dgs2Delta5), dgs10Delta5: num(macro.dgs10Delta5),
      asOf: macro._asOf_realYield10 || macro._asOf_dgs10 || null, realAsOf: macro._asOf_realYield10 || null, breakevenAsOf: macro._asOf_breakeven10 || null
    }
  };
}

/**
 * @param {object} input
 * @param {object} input.data          public-data/data.json payload (macro, putCall, fearGreed)
 * @param {Array}  input.history       history.json rows
 * @param {object} [input.macroHistory] macro-history.json
 * @param {object} [input.calendar]    macro-calendar.json ({ schedules })
 * @param {object} [input.outcomes]    scenario-outcomes.json
 * @param {object} [input.previous]    the last scenario-state.json (keeps a tied lead)
 * @param {object} [input.screener]    screener.json (theme strength and stages); omitted → no theme stages
 * @param {object} [input.themeMaps]   { usThemes, krThemeMap, labels }
 */
export function interpretationFromArtifacts({ data = null, history = [], macroHistory = null, calendar = null, outcomes = null, previous = null, screener = null, themeMaps = null, nowMs = Date.now() } = {}) {
  const screenerRows = screener ? Object.entries(expandScreenerArtifact(screener)?.data || {}).map(([sym, row]) => ({ sym, ...row })) : null;
  return buildMarketInterpretation({
    market: { ...marketAnalysisRegimeInput(data, history, macroHistory), now: nowMs },
    macro: data?.macro || null,
    calendar: { schedules: calendar?.schedules || {} },
    outcomes, previous, screenerRows,
    themeMaps: screenerRows ? (themeMaps || { usThemes: [], krThemeMap: {}, labels: {} }) : null,
    nowMs
  });
}
