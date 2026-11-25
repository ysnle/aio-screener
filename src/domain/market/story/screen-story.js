// Which lines of the market story (market-story.js buildMarketOpening) each screen reads beside its own figures. One
// registry for both readers: the screen's fixed tie (ui/components/story-tie.js) and its AI reading's packet
// (scripts/lib/screen-reading.mjs), so the sentence on the screen and the reading under it stand on the same lines.
// 오늘 and 시장 상태 show the whole opening and are not listed.
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
