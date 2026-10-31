// 2026-10-14 audit #5: one accessor for "which stage is this stock's theme in", shared by the stock summary, the
// company card and the screener reading so all three say exactly what 테마 시나리오 says (scenario-state.json rows).
// Theme-level only: the favoured choice belongs to the theme, never a buy/sell instruction on a single stock.
// When the per-refresh state is not current the accessor returns [] and callers render nothing (no placeholder).
import { THEME_STATES } from './analogs.js';
import { WIND_LABELS } from './exposures.js';
import { CHOICES } from '../market/macro-crossroads.js';
import { countOpenSessionsBetween, latestCompletedKrSession, latestCompletedUsSession } from '../market/market-calendar.js';
import { isIsoDay } from '../shared/session-date.js';

// v58.75 (persona review): v2 = members pooled once per theme (v58.74). scenario-state.json stamps the version it was built
// with, so a state written by the older group-median rule (crypto -25.1% there, -44.7% pooled) is never shown beside it.
// v59.45: defined here (theme-playbook.js re-exports it) so the stage reader checks the same version without an import cycle.
export const THEME_PLAYBOOK_VERSION = 'theme-playbook.v2';

// v57.81 (audit): the producer writes status 'current' (scripts/build-scenario-state.mjs) while the readers required 'ok',
// so the stage chips never rendered. One constant for the writer and every reader.
export const SCENARIO_STATE_CURRENT = 'current';
// v59.45 (P10-STATE-01): a payload that downloaded just now is not therefore current. A theme basis more than this many
// sessions behind its market's latest completed session is an old observation; a stamped other playbook version is
// another model. Fields the payload does not carry are not guessed (an unregistered calendar year is not rejected).
export const SCENARIO_BASIS_MAX_LAG = 2;
export function scenarioBasisCurrent(date, market = 'US', nowMs = Date.now()) {
  const day = String(date || '').slice(0, 10);
  if (!isIsoDay(day)) return true;
  const latest = market === 'KR' ? latestCompletedKrSession(nowMs)?.date : latestCompletedUsSession(nowMs, { requirePrevious: false })?.date;
  if (!latest) return true;
  if (day > latest) return false;
  return countOpenSessionsBetween(day, latest, market) <= SCENARIO_BASIS_MAX_LAG;
}
export function scenarioStateCurrent(scenario, { nowMs = Date.now() } = {}) {
  if (scenario?.status !== SCENARIO_STATE_CURRENT) return false;
  if (scenario.playbookVersion != null && scenario.playbookVersion !== THEME_PLAYBOOK_VERSION) return false;
  const byMarket = scenario.basis?.themeAsOfByMarket || {};
  const dated = Object.entries(byMarket).filter(([, date]) => date);
  return !dated.length || dated.some(([market, date]) => scenarioBasisCurrent(date, market, nowMs));
}

export const themeMarketOf = (symbol) => /\.K[SQ]$/i.test(String(symbol || '').trim()) ? 'KR' : 'US';

/** Short stage name ('주도 지속' …) without the parenthesised rule. */
export const themeStageName = (state) => THEME_STATES[state] ? THEME_STATES[state].split(' (')[0] : null;

/**
 * @param {object} root window-like object carrying _aioScenarioState (scenario-state.v1)
 * @param {{symbol?:string, market?:'US'|'KR', themeIds?:string[]}} options
 * @returns {Array<{id:string,label:string,state:string,stateLabel:string,wind:string|null,favoured:string[]}>}
 */
export function themeStagesFor(root, { symbol = '', market = null, themeIds = [], nowMs = Date.now() } = {}) {
  const scenario = root?._aioScenarioState;
  if (!scenarioStateCurrent(scenario, { nowMs }) || !Array.isArray(scenario.themes)) return [];
  const want = market || themeMarketOf(symbol);
  const ids = [...new Set((themeIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const out = [];
  for (const id of ids) {
    const row = scenario.themes.find((item) => item?.market === want && item?.id === id);
    if (!row || !THEME_STATES[row.state]) continue;
    // A row on an old close (its own basis, else its market's) is not today's stage.
    if (!scenarioBasisCurrent(row.basis || scenario.basis?.themeAsOfByMarket?.[want], want, nowMs)) continue;
    out.push({
      id,
      label: row.label || id,
      state: row.state,
      stateLabel: themeStageName(row.state),
      wind: WIND_LABELS[row.windLead] || null,
      favoured: (Array.isArray(row.favored) ? row.favored : []).map((key) => CHOICES[key]).filter(Boolean)
    });
  }
  return out;
}
