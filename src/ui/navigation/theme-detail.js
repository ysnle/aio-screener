// One opener for a theme link. A KRX listing's theme ids come from KR_THEME_MAP and open the Korean theme detail;
// every other id opens the US THEME_MAP detail. Routing by id alone sent a Korean stock's theme links to
// showThemeDetail, which opened the US theme where the ids collide (defense, crypto, quantum, space) and did
// nothing for the rest.
import { themeMarketOf } from '../../domain/scenarios/theme-stage.js';

export function openThemeDetail(root, themeId, { symbol = '', market = null } = {}) {
  if ((market || themeMarketOf(symbol)) === 'KR') {
    return typeof root?.openKrThemeDetail === 'function' ? root.openKrThemeDetail(themeId) !== false : false;
  }
  if (typeof root?.showThemeDetail !== 'function') return false;
  root.showThemeDetail(themeId);
  return true;
}
