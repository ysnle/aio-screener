// The fixed words of the researched reference block. One place, so the face, the stock line and the AI fact lines say
// the same thing about what these rows are.
export const RESEARCH_WORDS = Object.freeze({
  kicker: '조사 자료 · 기준일 각 행',
  stale: '갱신 전',
  // The quiet mark on a researched row printed among automated ones (the AI funding chain).
  mark: '조사',
  forecast: '전망',
  prior: '이전',
  since: '대비',
  sources: '조사 출처',
  checked: '마지막 확인',
  factLead: '조사 자료',
  // The AI input says what kind of number this is, so a reading never treats it as a live quote or a score input.
  factBasis: '사람이 공개 자료에서 확인한 값, 행마다 기준일, 점수에 넣지 않음'
});
