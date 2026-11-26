// The fixed words the 브리핑 report's renderers print: a sub-heading, the next-check keyword, the story ranks, the day
// state words and the missing marks. The section titles are static in the shell (index.html #page-briefing).
export const BRIEFING_REPORT_WORDS = Object.freeze({
  sections: Object.freeze({ more: '그 밖에 움직인 것' }),
  lines: Object.freeze({ led: '주도한 것', next: '다음 확인' }),
  // A story's rank on the market-day ledger (day-account.js), printed beside its weight bar.
  rank: Object.freeze({ lead: '핵심', major: '주요', minor: '보조' }),
  // A session's direction and, when the move is graded against its own volatility, its size (move-size.js).
  day: Object.freeze({ up: '상승', down: '하락', flat: '보합', closed: '휴장', ahead: '예정', missing: '종가 없음' }),
  size: Object.freeze({ small: '소폭', large: '큰 폭' }),
  missing: '—',
  missingGloss: '값 없음'
});
