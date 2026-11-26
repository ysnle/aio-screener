// Which lines of the market story (market-story.js buildMarketOpening) each screen's AI reading reads beside its own
// figures (scripts/lib/screen-reading.mjs `story`). 오늘 and 시장 상태 show and read the whole opening and are not listed.
const lines = (...ids) => Object.freeze(ids);
export const SCREEN_STORY = Object.freeze({
  breadth: lines('session', 'split'),
  macro: lines('session', 'rates'),
  sentiment: lines('session', 'volatility'),
  fxbond: lines('rates', 'dollar'),
  themes: lines('session', 'gathered', 'spread', 'split'),
  korea: lines('session', 'spread'),
  charts: lines('session', 'spread')
});

// What each screen shows of the story on its face (ui/components/story-tie.js): ONE line answering that screen's own
// question, the first of its list that has text — 'tie' is the screen's own sentence (screen-tie.js: its verdict beside
// the session's shape), any other id an opening line the screen owns (테마와 섹터 owns where the move gathered). The full
// reading lives on 오늘 and 시장 상태; a screen with none of its lines today shows the session's one-line summary and a
// link to 오늘, never the paragraph.
export const SCREEN_FACE = Object.freeze({
  breadth: lines('tie'),
  macro: lines('tie'),
  sentiment: lines('tie'),
  fxbond: lines('tie'),
  themes: lines('gathered', 'tie'),
  korea: lines('tie'),
  charts: lines('tie')
});

/**
 * The one face line of `screen`: { line: { id, label, said }, summary } — `summary` true when it is the session's one-line
 * summary (the caller adds the link to 오늘). null without an opening or any text.
 * @param {string} screen one of SCREEN_FACE's keys
 * @param {{opening?: object|null, tie?: {said: {text: string}}|null}} input `tie`: screen-tie.js screenTieOf's result
 */
export function screenFaceLine(screen, { opening = null, tie = null } = {}) {
  if (!opening?.available) return null;
  for (const id of SCREEN_FACE[screen] || []) {
    const line = id === 'tie' ? (tie?.said?.text ? { id: 'tie', label: '', said: tie.said } : null)
      : opening.lines?.find((row) => row.id === id && row.said?.text) || null;
    if (line) return { line, summary: false };
  }
  const moves = opening.session?.moves;
  return moves?.text ? { line: { id: 'summary', label: '', said: moves }, summary: true } : null;
}
