export const ROUTE_IDS = Object.freeze([
  'home', 'signal', 'breadth', 'sentiment', 'briefing', 'technical',
  'macro', 'fxbond', 'themes', 'theme-detail', 'ticker', 'fundamental',
  'options', 'portfolio', 'market-news', 'screener', 'guide'
]);

export function isRouteId(value) {
  return ROUTE_IDS.includes(value);
}
