import { THEME_STATES } from './analogs.js';
import { WIND_LABELS } from './exposures.js';
import { CHOICES } from '../market/regime/macro-crossroads.js';
import { countOpenSessionsBetween, latestCompletedSession } from '../market/session/market-calendar.js';
import { isIsoDay } from '../shared/session-date.js';

export const THEME_PLAYBOOK_VERSION = 'theme-playbook.v3';

export const SCENARIO_STATE_CURRENT = 'current';
export const SCENARIO_BASIS_MAX_LAG = 2;
export function scenarioBasisCurrent(date, market = 'US', nowMs = Date.now()) {
  const day = String(date || '').slice(0, 10);
  if (!isIsoDay(day)) return true;
  const latest = latestCompletedSession(market, nowMs)?.date;
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
