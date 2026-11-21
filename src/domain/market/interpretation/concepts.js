// Owner 2026-10-19 ("전체 구조 개편"): market concepts that more than one engine judges are defined once here, so the
// structure outlook, the theme stages, the 테마 rotation reading and the guide cannot disagree on what a word means.

/**
 * The one name of each judged axis, by id: 시장 상태's axes and watch rows, its radar, 매크로's factors (rates, credit and
 * commodities are the same rows), the 매크로 chapters on the same concept, the guide and every link that names an axis read
 * the label here. The detail a longer name once carried lives in that row's own text: rates' link says 할인율, credit's
 * 공포·탐욕 (참고) row is the risk-appetite reference, growth's link says 고용과 소비.
 */
export const AXIS_LABELS = Object.freeze({
  trend: '추세', breadth: '시장 폭', volatility: '변동성', rates: '금리', credit: '신용', commodities: '유가와 달러',
  korea: '환율 (원, 엔)', growth: '성장', inflation: '물가', policy: '통화정책', sentiment: '심리', leadership: 'AI·반도체 집중'
});
/** The state words of every axis. 확인 불가: the state could not be computed (no or stale observation). */
export const STATE_LABELS = Object.freeze({ favorable: '양호', neutral: '중립', burden: '부담', unknown: '확인 불가' });
/** The six US 시장 상태 axes in their screen order, as one joined name list ("추세·시장 폭·…"). */
export const US_AXIS_IDS = Object.freeze(['trend', 'breadth', 'volatility', 'rates', 'credit', 'commodities']);
export const axisNames = (ids = US_AXIS_IDS, joiner = '·') => ids.map((id) => AXIS_LABELS[id]).join(joiner);

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
