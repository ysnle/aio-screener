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

/** The bottom-watch tally (market-read.js bottomWatchOf): exhaustion and recovery checks, not a bottom call. */
export const BOTTOM_WATCH_WORDS = Object.freeze({ label: '매도 소진·회복 조건' });
