// Owner 2026-10-19 ("전체 구조 개편"): market concepts that more than one engine judges are defined once here, so the
// structure outlook, the theme stages, the 테마 rotation reading and the guide cannot disagree on what a word means.

/**
 * "신용 안정": only the shared credit axis reading favourable (v57.50 D01). A neutral axis — e.g. HY +45bp over 20
 * sessions — is not stable. null when the axis is unknown.
 */
export const creditStable = (credit) => (credit == null || credit === 'unknown' ? null : credit === 'favorable');

/**
 * Defensive sector ETFs: health care, staples, utilities — demand that holds up in a slowdown. Real estate (XLRE) is
 * left out: it trades on the rate path (cap rates, refinancing), so it leads when long yields fall, not when the
 * market turns defensive. The 테마 rotation reading counted it while the structure outlook did not (2026-10-19).
 */
export const DEFENSIVE_SECTORS = Object.freeze(new Set(['XLV', 'XLP', 'XLU']));
export const SECTOR_ETF_LABELS = Object.freeze({
  XLK: '기술', XLC: '통신', XLY: '경기소비재', XLF: '금융', XLI: '산업재', XLB: '소재', XLE: '에너지',
  XLV: '헬스케어', XLP: '필수소비재', XLU: '유틸리티', XLRE: '부동산'
});
export const isDefensiveSector = (symbol) => DEFENSIVE_SECTORS.has(String(symbol || '').toUpperCase());
