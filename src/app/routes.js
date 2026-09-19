// GENERATED FILE — do not edit by hand (P1137/R623).
// Source of truth: `var ROUTE_PAGE_IDS` in js/aio-core.js.
// Regenerate: node scripts/generate-route-registry.mjs --write
// Verify:     node scripts/generate-route-registry.mjs --check
export const ROUTE_IDS = Object.freeze([
  'home', 'signal', 'breadth', 'sentiment', 'briefing',
  'technical', 'macro', 'fxbond', 'fundamental', 'themes',
  'theme-detail', 'portfolio', 'ticker', 'market-news', 'options',
  'principles', 'masters', 'atlas', 'guide', 'screener'
]);

export function isRouteId(value) {
  return ROUTE_IDS.includes(value);
}
