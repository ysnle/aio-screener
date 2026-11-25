// GICS sector names as the index holdings file writes them → the labels the rest of AIO uses. A vocabulary table on
// its own so a sentence that only names a sector does not load the sector map's model with it.
export const GICS_KO = Object.freeze({ 'Information Technology': '기술', Communication: '통신', 'Communication Services': '통신', 'Consumer Discretionary': '경기소비재',
  'Consumer Staples': '필수소비재', 'Health Care': '헬스케어', Financials: '금융', Industrials: '산업재', Energy: '에너지', Utilities: '유틸리티', Materials: '소재', 'Real Estate': '부동산' });
