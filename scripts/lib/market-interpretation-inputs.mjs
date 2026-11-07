// Owner 2026-10-19: the producers' adapter of the interpretation pipeline (src/domain/interpretation/
// market-interpretation.js). fetch-data (the published narrative) and build-scenario-state (scenario-state.json) build
// the regime, branches, structure flows, theme stages and market guide through this one function, from the same
// published artifacts the screens read. v59.70 (data audit R8): the input itself is now assembled by the shared builder
// (src/domain/interpretation/inputs.js) the browser adapter uses, so the producers also pass the sector rotation
// (data.json rotationHistory), the S&P 500 breadth segment and index weights (screener.json) and consensus EPS
// (consensus-estimates.json). What only the browser has: the hand-kept release names (AIO_MACRO_CALENDAR.releases in
// js/aio-core.js) and a fresher HY read from its own FRED fetch.
import { buildMarketInterpretation } from '../../src/domain/interpretation/market-interpretation.js';
import { indexEarningsInput, interpretationInput, regimeMarketInput } from '../../src/domain/interpretation/inputs.js';
import { expandScreenerArtifact } from '../../src/data/screener-extended.js'; // v57.95 core row encoding
import { readHistoryRows } from '../../src/domain/market/history-rows.js';

// P1635/P1685: the screen's regime inputs (credit with the 20-session HY change, rates) from the published
// market data. The browser reads the same values through src/data/selectors/market-inputs.js.
export function marketAnalysisRegimeInput(data, history = [], macroHistory = null, { screener = null, nowMs = Date.now() } = {}) {
  // v59.70: accept the published history.v2 payload as well as v1 rows (a raw v2 object read as rows gave an empty regime).
  return regimeMarketInput({ macro: data?.macro || null, fearGreed: data?.fearGreed || null, history: readHistoryRows(history), macroHistory,
    breadthSp500: screener?.breadth?.segments?.sp500 || null, nowMs }); // M05: the narrative uses the same latest-session admission as the screen
}

/**
 * @param {object} input
 * @param {object} input.data          public-data/data.json payload (macro, fearGreed, rotationHistory)
 * @param {Array}  input.history       history.json rows
 * @param {object} [input.macroHistory] macro-history.json
 * @param {object} [input.calendar]    macro-calendar.json ({ schedules })
 * @param {object} [input.outcomes]    scenario-outcomes.json
 * @param {object} [input.previous]    the last scenario-state.json (keeps a tied lead)
 * @param {object} [input.screener]    screener.json (theme strength and stages, S&P 500 breadth, index weights); omitted → none
 * @param {object} [input.themeMaps]   { usThemes, krThemeMap, labels }
 * @param {object} [input.consensus]   consensus-estimates.json (index-earnings stage; needs `screener` for the weights)
 */
// The expanded rows of one screener artifact are built once (the narrative producer reads the same object per call).
const SCREENER_ROWS = new WeakMap();
function screenerRowsOf(screener) {
  if (!SCREENER_ROWS.has(screener)) SCREENER_ROWS.set(screener, Object.entries(expandScreenerArtifact(screener)?.data || {}).map(([sym, row]) => ({ sym, ...row })));
  return SCREENER_ROWS.get(screener);
}

export function interpretationFromArtifacts({ data = null, history = [], macroHistory = null, calendar = null, outcomes = null, previous = null, screener = null, themeMaps = null, consensus = null, nowMs = Date.now() } = {}) {
  const screenerRows = screener ? screenerRowsOf(screener) : null;
  const weights = screener?.indexWeights || null;
  return buildMarketInterpretation(interpretationInput({
    market: marketAnalysisRegimeInput(data, history, macroHistory, { screener, nowMs }),
    macro: data?.macro || null,
    calendar: { schedules: calendar?.schedules || {} },
    outcomes, previous, screenerRows, themeMaps,
    rotationHistory: data?.rotationHistory || null,
    indexEarnings: weights ? indexEarningsInput({ weights, consensus, macro: data?.macro || null }) : null,
    nowMs
  }));
}
