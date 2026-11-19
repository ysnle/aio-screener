// Where each market-screen indicator's principle lives in the research library. A screen's 계산 방법 fold keeps the
// calculation and ends with one link to this address; the teaching itself is the library's (market-indicator-notes.js
// for analysis notes, the lesson library for 원리 레슨). Values are the principles route's params.
export const INDICATOR_NOTES = Object.freeze({
  trend: { mode: 'frames', node: 'trend-moving-averages' },
  breadth: { mode: 'frames', node: 'breadth-confirmation' },
  volatility: { mode: 'frames', node: 'vix-term-structure' },
  term: { mode: 'frames', node: 'vix-term-structure' },
  rates: { mode: 'frames', node: 'ten-year-discount-rate' },
  credit: { mode: 'frames', node: 'high-yield-spread' },
  commodities: { mode: 'frames', node: 'commodities-dollar-signals' },
  'commodities-fx': { mode: 'frames', node: 'commodities-dollar-signals' },
  growth: { mode: 'frames', node: 'growth-jobs-consumption' },
  inflation: { mode: 'frames', node: 'inflation-core-speed' },
  policy: { mode: 'frames', node: 'policy-rate-two-year' },
  liquidity: { mode: 'frames', node: 'net-liquidity' },
  fg: { mode: 'frames', node: 'sentiment-contrarian' },
  aaii: { mode: 'frames', node: 'sentiment-contrarian' },
  composite: { mode: 'frames', node: 'sentiment-contrarian' },
  korea: { lesson: 'O2' },
  curve: { lesson: 'E2' },
  assets: { mode: 'frames', node: 'asset-roles-dollar-gold-cash' }
});
