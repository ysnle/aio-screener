// The two rebound readings' fixed words, in one place for the screens and the AI lines.
// On the 11/23 close both read "반등 시도" — the market story on the Nasdaq-100 (+RULES.story.reboundPct off the low) and
// the follow-through count on the Nasdaq Composite (rally-attempt.js) — same words, different index, rule and base date.
// The story keeps the rebound words; the follow-through count is named by what it counts and never says 반등 시도.
// The bottom-watch tally (market-read.js bottomWatchOf) is a third reading: sell-off exhaustion and recovery checks.

/** The market story's rebound state words (src/domain/market/story/rebound.js, Nasdaq-100 closes). */
export const REBOUND_WORDS = Object.freeze({ attempt: '반등 시도', recovered: '추세 회복', failed: '반등 실패' });

/** The follow-through day count (src/domain/market/regime/rally-attempt.js, Nasdaq Composite closes and volume). */
export const FOLLOW_THROUGH_WORDS = Object.freeze({
  name: '반등 확인 신호(FTD)',
  index: '나스닥 종합',
  label: '반등 확인 신호(FTD) · 나스닥 종합',
  pending: '확인 전',
  confirmed: '확인',
  failed: '실패'
});

/**
 * The rebound's cross-market checks (src/domain/market/story/rebound-quality.js): the tally's label, its state words, each
 * check's name and mark, and the one conditional note an index-only rebound carries (no cause is asserted).
 */
export const REBOUND_QUALITY_WORDS = Object.freeze({
  label: '다른 시장 확인',
  confirmed: '뒷받침됨',
  mixed: '엇갈림',
  weak: '확인 부족',
  'index-only': '지수만 반등',
  thin: '판단 보류',
  checks: Object.freeze({ credit: '신용', dollar: '달러', volatility: '변동성', breadth: '참여 폭', crypto: '비트코인', crossAsset: '유가·금리' }),
  marks: Object.freeze({ met: '확인', unmet: '미확인', unknown: '자료 없음' }),
  indexOnlyNote: '지수만 오른 반등은 숏커버링과 구별되지 않습니다.'
});

/** The bottom-watch tally (market-read.js bottomWatchOf): exhaustion and recovery checks, not a bottom call. */
export const BOTTOM_WATCH_WORDS = Object.freeze({ label: '매도 소진·회복 조건' });
