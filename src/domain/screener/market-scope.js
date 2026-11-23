import { listingMarketOfSymbol } from '../market/session/session-time.js';

export const MARKET_POPULATION_POLICY = 'market-separated.v1';
export const MARKET_LABELS = Object.freeze({ US: '미국', KR: '한국' });

/**
 * Where a row is listed: 'US', 'KR' or 'INTL' (Tokyo, Taiwan), or null without a symbol. The one answer for every count:
 * a market's population (its universe size, its ranking cross-section, every "미국 N종목") is the rows listed there.
 */
export function listingMarket(row = {}) {
  const declared = [row.instrumentRef?.market, row.market, row.listingMarket].map((value) => String(value || '').toUpperCase());
  const symbol = String(row.sym || row.symbol || '').toUpperCase();
  if (declared.includes('KR') || /\.K[QS]$/.test(symbol) || ['KOSPI', 'KOSDAQ'].includes(String(row.index || '').toUpperCase())) return 'KR';
  if (declared.includes('INTL') || (symbol && listingMarketOfSymbol(symbol) === 'INTL')) return 'INTL';
  if (declared.includes('US') || symbol) return 'US';
  return null;
}

/** The list a row is shown in: KR, else US — an overseas listing is shown in the US list with its listing and currency. */
export function screenerMarket(row = {}) {
  const market = listingMarket(row);
  return market === 'INTL' ? 'US' : market;
}

/** The rows shown in a market's list (overseas listings included in the US list). */
export function marketRows(rows = [], market = 'US') {
  return rows.filter(row => screenerMarket(row) === market);
}

/** A market's population — the rows listed there; overseas listings are outside every market's population. */
export function marketPopulation(rows = [], market = 'US') {
  return (Array.isArray(rows) ? rows : []).filter((row) => listingMarket(row) === market);
}

export function marketRankingMetadata(metadata = {}, market = 'US') {
  return metadata.ranking?.byMarket?.[market] || metadata.ranking || {};
}

export function formatScreenerPrice(value, currency) {
  if (!Number.isFinite(value)) return '—';
  if (currency === 'KRW') return `₩${Math.round(value).toLocaleString('en-US')}`;
  const number = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // One price notation across screener, entity and chart: currency sign first, like ₩ above.
  if (currency === 'USD') return `$${number}`;
  return `${number}${currency ? ` ${currency}` : ' (통화 미확인)'}`;
}
