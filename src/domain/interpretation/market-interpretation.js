// Owner 2026-10-19 ("전체 구조 개편"): the one interpretation pipeline. Every surface that explains the market — 오늘,
// 시장 상태, 거시, 테마, 브리핑, the AI chat, the server narrative and scenario-state.json — reads the same stages built
// once, in one order, from one input object:
//
//   inputs → regime (six axes) → marketRead (briefing statements) → macroRead → curve (2s10s move) → events
//          → crossroads (macro branches) → scenarios (structure flows) → rows → indexEarnings
//          → groups (US theme strength) → outlook → playbook (theme stages) → guide (shared market guide) → flow
// (P28-CONTRACT-01: the execution order; INTERPRETATION_STAGES below is the older declared list the boundary gate pins.)
//
// Before this module each surface assembled the chain itself with different inputs: the browser's crossroads skipped
// the previous lead (a tie could name a different branch than the narrative), the briefing built it without the regime
// (no breadth condition), and the outlook and theme playbook grouped the screener rows two different ways. Adapters
// collect inputs (src/data/selectors/interpretation.js in the browser, scripts/lib/market-interpretation-inputs.mjs in
// the producers); stage builders are called only here (scripts/ci-interpretation-boundary-check.mjs).
//
// Pure: no DOM, no I/O. A stage that throws is recorded in `errors` and later stages see null, never a partial object.
import { buildMarketRead, buildMarketRegime } from '../briefing/market-read.js';
import { buildMacroRead } from '../macro/macro-read.js';
import { curveDynamics } from '../macro/rates-fx.js';
import { buildIndexEarnings } from '../market/index-earnings.js';
import { buildMacroCrossroads, upcomingMacroEvents } from '../market/macro-crossroads.js';
import { buildMarketScenarios } from '../market/regime-scenarios.js';
import { buildScenarioOutlook, SECTOR_ETF_LABELS, sectorRecentCheck } from '../market/scenario-outlook.js';
import { selectProducedRotation } from '../themes/produced-rotation.js';
import { buildGroupStrength } from '../themes/group-strength.js';
import { krThemeArtifactRead } from '../themes/kr-themes.js';
import { buildThemePlaybook } from '../scenarios/theme-playbook.js';
import { buildMarketGuide } from '../guide/market-guide.js';
import { fieldValueForPurpose } from '../../data/contracts/screener.js';
import { buildMarketFlow } from '../market/market-flow.js';
import { finiteNumber as finite } from '../shared/number.js';

export const INTERPRETATION_VERSION = 'market-interpretation.v1';
export const INTERPRETATION_STAGES = Object.freeze(['regime', 'marketRead', 'macroRead', 'curve', 'indexEarnings', 'crossroads', 'scenarios', 'groups', 'outlook', 'playbook', 'guide']);

const axisState = (regime, id) => regime?.axes?.find((axis) => axis.id === id)?.state || null;

// Native store rows carry typed fields behind fieldReadiness; producer rows are plain. One reading for both.
const RETURN_FIELDS = ['ret1m', 'ret3m', 'ret6m', 'pctSma50'];
export function typedScreenerRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => row?.fieldReadiness
    ? { ...row, ...Object.fromEntries(RETURN_FIELDS.map((key) => [key, finite(fieldValueForPurpose(row, `price.${key}`, 'display'))])) }
    : row);
}

/** Produced RRG rows for the sector ETFs (current session only), as the outlook reads them. */
export function outlookSectors(rotationHistory, nowMs) {
  if (!rotationHistory) return [];
  return Object.entries(SECTOR_ETF_LABELS).map(([symbol, label]) => {
    const row = selectProducedRotation(rotationHistory, symbol, nowMs);
    return row ? { symbol, label, quadrant: row.quadrant, rsRatio: row.rsRatio, rsMomentum: row.rsMomentum, ...(sectorRecentCheck(row) || {}) } : null;
  }).filter(Boolean);
}

/**
 * @param {object} input
 * @param {object} input.market        regime input: { history, credit, rates, macroHistory, breadthSp500?, now? }
 * @param {object} [input.macro]       latest macro snapshot (server macro / data.macro)
 * @param {object} [input.calendar]    { releases?, schedules? } for the upcoming official releases
 * @param {object} [input.outcomes]    scenario-outcomes.v1
 * @param {object} [input.previous]    the last published scenario-state.v1 (keeps a tied lead)
 * @param {Array}  [input.screenerRows] screener rows (theme strength, theme stages)
 * @param {object} [input.themeMaps]   { usThemes, krThemeMap, labels }
 * @param {object} [input.rotationHistory] produced sector rotation (outlook sector rows); omitted by the producers
 * @param {object} [input.indexEarnings] { weights, consensus, realYield10?, realYieldAsOf? } — S&P 500 forward earnings,
 *                 revision breadth and ERP (screener index weights + consensus; the browser has both today)
 * @param {object} [input.stages]      { playbook: false } skips a stage a caller does not read
 * @param {number} [input.nowMs]
 */
export function buildMarketInterpretation({ market = {}, macro = null, calendar = null, outcomes = null, previous = null, screenerRows = null, themeMaps = null, rotationHistory = null, indexEarnings: earningsInput = null, stages = {}, nowMs = Date.now() } = {}) {
  const errors = {};
  const stage = (name, run) => { try { return run(); } catch (error) { errors[name] = String(error?.message || error); return null; } };
  const inputs = { ...market, history: Array.isArray(market.history) ? market.history : [], now: market.now ?? nowMs };
  const regime = stage('regime', () => buildMarketRegime(inputs));
  const live = regime?.available ? regime : null;
  const marketRead = stage('marketRead', () => buildMarketRead(inputs));
  const macroRead = stage('macroRead', () => buildMacroRead({ macro, macroHistory: inputs.macroHistory || null, regime: live, history: inputs.history }));
  const breadthState = axisState(regime, 'breadth');
  // v58.32 (expertise review 1): the 2s10s move (bull/bear, steepening/flattening, un-inversion) and index earnings.
  const curve = stage('curve', () => curveDynamics(inputs.macroHistory || null));
  const events = stage('events', () => upcomingMacroEvents({ releases: calendar?.releases || {}, schedules: calendar?.schedules || {}, nowMs })) || [];
  const crossroads = stage('crossroads', () => buildMacroCrossroads({ read: macroRead ? { ...macroRead, breadthState } : macroRead, macroHistory: inputs.macroHistory || null, history: inputs.history, events, outcomes, previousLeadId: previous?.crossroads?.leadId || null }));
  const scenarios = regime ? stage('scenarios', () => buildMarketScenarios(inputs, { regime })) : null;
  // P28-CONTRACT-01: a malformed row (a throwing getter) fails this stage only, like every other stage.
  const rows = screenerRows ? stage('rows', () => typedScreenerRows(screenerRows)) : null;
  const indexEarnings = earningsInput ? stage('indexEarnings', () => buildIndexEarnings({ rows: rows || [], now: nowMs, ...earningsInput })) : null;
  const groups = rows ? stage('groups', () => buildGroupStrength({ themes: themeMaps?.usThemes || [], rows, sortKey: 'ret3m', now: nowMs }).groups || []) : null;
  // X03 (2026-10-13): "현재 주도" may name only themes measured on the latest completed session.
  const leadingThemes = (groups || []).filter((group) => group.ret3m != null && group.rankable !== false && group.current)
    .map((group) => ({ name: group.name || group.subTheme || group.id, ret3m: group.ret3m, themeId: group.themeId || null }));
  const outlook = scenarios?.available ? stage('outlook', () => buildScenarioOutlook({ scenarios, regime, sectors: outlookSectors(rotationHistory, nowMs), themes: leadingThemes })) : null;
  const playbook = rows && crossroads && stages.playbook !== false ? stage('playbook', () => buildThemePlaybook({
    usGroups: groups || [], krThemes: themeMaps?.krThemeMap ? krThemeArtifactRead({ themeMap: themeMaps.krThemeMap, rows }).themes || [] : [],
    crossroads, credit: axisState(regime, 'credit'), outcomes, labels: themeMaps?.labels || {}, history: inputs.history
  })) : null;
  const guide = regime ? stage('guide', () => buildMarketGuide({ regime, outlook, crossroads, curve, indexEarnings, nowMs })) : null;
  // v58.68 (owner 2026-10-23): where the session's money went — sectors, sub-themes, the 10-year yield and fear.
  const flow = rotationHistory ? stage('flow', () => buildMarketFlow({ rotationHistory, history: inputs.history, themes: themeMaps?.usThemes || null, rows, nowMs })) : null;
  return { version: INTERPRETATION_VERSION, asOf: regime?.asOf || null, nowMs, inputs, regime, marketRead, macroRead, curve, indexEarnings, events, crossroads, scenarios, groups, outlook, playbook, guide, flow, errors };
}
