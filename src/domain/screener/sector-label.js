export const SECTOR_KEY_ALIAS = Object.freeze({
  'Consumer Cyclical': 'Consumer', 'Consumer Discretionary': 'Consumer', 'Financial Services': 'Financials',
  'Basic Materials': 'Materials', 'Health Care': 'Healthcare', 'Information Technology': 'Technology',
  Communication: 'Communication Services', 'Consumer Staples': 'Consumer Defensive'
});
export function normalizeSectorKey(sector) {
  const key = String(sector ?? '').trim();
  return SECTOR_KEY_ALIAS[key] || key || null;
}

// V13: labels are keyed by the canonical sector key only; aliases fold through normalizeSectorKey.
const SECTOR_KO = Object.freeze({ Technology: '기술', Financials: '금융', Energy: '에너지', Healthcare: '헬스케어', Industrials: '산업재', Consumer: '경기소비재', 'Consumer Defensive': '필수소비재', 'Real Estate': '부동산', Materials: '소재', Utilities: '유틸리티', 'Communication Services': '통신', ETF: 'ETF(여러 업종 묶음)' });

export function sectorLabel(sector) {
  return SECTOR_KO[normalizeSectorKey(sector)] || sector || '분류 없음';
}
