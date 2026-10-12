// P1625: listing market owns the comparison population; a US ADR is a US listing.
export const MARKET_POPULATION_POLICY = 'market-separated.v1';
export const MARKET_LABELS = Object.freeze({ US: '미국', KR: '한국' });

export function screenerMarket(row = {}) {
  const declared = String(row.instrumentRef?.market || row.market || '').toUpperCase();
  if (declared === 'US' || declared === 'KR') return declared;
  const symbol = String(row.sym || row.symbol || '').toUpperCase();
  if (/\.K[QS]$/.test(symbol) || ['KOSPI', 'KOSDAQ'].includes(String(row.index || '').toUpperCase())) return 'KR';
  return symbol ? 'US' : null;
}

export function marketRows(rows = [], market = 'US') {
  return rows.filter(row => screenerMarket(row) === market);
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

