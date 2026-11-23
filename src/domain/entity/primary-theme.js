import { koreanThemeGroups } from '../market/korea/korea-participation.js';
import { themeMarketOf } from '../scenarios/theme-stage.js';

/** The theme map a symbol is read against: the Korean groups for a KRX listing, otherwise the US THEME_MAP. */
export function themeCatalogFor(symbol, { themeMap = [], krThemeMap = {}, rows = [] } = {}) {
  return themeMarketOf(String(symbol || '').toUpperCase()) === 'KR' ? koreanThemeGroups(krThemeMap || {}, rows || []) : (Array.isArray(themeMap) ? themeMap : []);
}

/** The themes that list the stock, primary first: [{ id, label, etf, subTheme }] (subTheme = its smallest sub-theme). */
export function stockThemes(themes, symbol) {
  const sym = String(symbol || '').toUpperCase();
  const has = (list) => (Array.isArray(list) ? list : []).some((ticker) => String(ticker || '').toUpperCase() === sym);
  if (!sym) return [];
  return (Array.isArray(themes) ? themes : []).filter((theme) => theme?.id && (has(theme.leaders) || (theme.subThemes || []).some((sub) => has(sub?.tickers))))
    .map((theme) => {
      const sub = (theme.subThemes || []).filter((item) => has(item?.tickers)).sort((a, b) => (a.tickers || []).length - (b.tickers || []).length)[0] || null;
      return { id: theme.id, label: theme.nameKr || theme.label || theme.id, etf: theme.etf || null, subTheme: sub?.name || null };
    });
}

export const primaryTheme = (themes, symbol) => stockThemes(themes, symbol)[0] || null;
