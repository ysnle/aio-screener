// 2026-10-14 audit #5: one accessor for "which stage is this stock's theme in", shared by the stock summary, the
// company card and the screener reading so all three say exactly what 테마 갈림길 says (scenario-state.json rows).
// Theme-level only: the favoured choice belongs to the theme, never a buy/sell instruction on a single stock.
// When the per-refresh state is not 'ok' the accessor returns [] and callers render nothing (no placeholder).
import { THEME_STATES } from './analogs.js';
import { WIND_LABELS } from './exposures.js';
import { CHOICES } from '../market/macro-crossroads.js';

export const themeMarketOf = (symbol) => /\.K[SQ]$/i.test(String(symbol || '').trim()) ? 'KR' : 'US';

/** Short stage name ('주도 지속' …) without the parenthesised rule. */
export const themeStageName = (state) => THEME_STATES[state] ? THEME_STATES[state].split(' (')[0] : null;

/**
 * @param {object} root window-like object carrying _aioScenarioState (scenario-state.v1)
 * @param {{symbol?:string, market?:'US'|'KR', themeIds?:string[]}} options
 * @returns {Array<{id:string,label:string,state:string,stateLabel:string,wind:string|null,favoured:string[]}>}
 */
export function themeStagesFor(root, { symbol = '', market = null, themeIds = [] } = {}) {
  const scenario = root?._aioScenarioState;
  if (!scenario || scenario.status !== 'ok' || !Array.isArray(scenario.themes)) return [];
  const want = market || themeMarketOf(symbol);
  const ids = [...new Set((themeIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const out = [];
  for (const id of ids) {
    const row = scenario.themes.find((item) => item?.market === want && item?.id === id);
    if (!row || !THEME_STATES[row.state]) continue;
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
