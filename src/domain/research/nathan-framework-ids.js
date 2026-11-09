// The boot-time face of the Nathan | Factomind frameworks: their ids, the knowledge concept id each one is filed under
// and the analysis protocol every framework read follows. The screener setup profile, the screener reference metadata
// and the AIO facade read only these, so the frameworks themselves (nathan-frameworks.js, ~53 KB) load with the AI
// planner and the knowledge corpus. ci-esm-core-unit-check holds this list equal to the frameworks, in order.

export const NATHAN_PREVIOUS_THREADS_FRAMEWORK_IDS = Object.freeze([
  'nathan-liquidity-extremes', 'nathan-leverage-survival', 'nathan-forecast-falsifiability', 'nathan-policy-second-order',
  'nathan-etf-flow-channel', 'nathan-market-structure-execution', 'nathan-retail-flow-edge-decay', 'nathan-bubble-diagnostics',
  'nathan-crypto-fundamentals', 'nathan-tokenomics-value-link', 'nathan-counterparty-custody', 'nathan-investor-protection',
  'nathan-credit-stress-gates', 'nathan-product-monetization', 'nathan-treasury-supply-demand', 'nathan-macro-risk-asset-divergence',
  'nathan-nonbank-regulatory-arbitrage', 'nathan-etf-nav-basket-integrity', 'nathan-market-impersonal-tail-risk', 'nathan-research-provenance',
  'nathan-specialized-edge-luck', 'nathan-problem-friction-opportunity', 'nathan-analysis-workflow-clarity', 'nathan-asset-class-allocation',
  'nathan-relative-value-hedging', 'nathan-institutional-intermediation', 'nathan-valuation-price-formation', 'nathan-regulation-market-access'
]);

export const nathanConceptId = (frameworkId) => `nathan-frameworks:${frameworkId}`;

export const NATHAN_ANALYSIS_PROTOCOL = Object.freeze({
  schemaVersion: 'nathan-analysis-protocol.v1',
  sourceKind: 'REFERENCE',
  currentClaimsAllowed: false,
  rankingUse: 'none',
  stages: Object.freeze(['scope', 'mechanism', 'observables', 'confirmation', 'counter-scenario', 'currentness']),
  separation: Object.freeze(['structural reference', 'current observation', 'inference', 'action']),
  stopRules: Object.freeze([
    '현재 수치·예측·목표·방향성은 별도 LIVE/SNAPSHOT/Web Research 근거 없이는 사용하지 않는다.',
    '반증 조건과 반대 경로가 없으면 결론이 아니라 가설로 남긴다.',
    '자료의 권위·서사·인용 횟수는 사실성이나 안전성의 대체 지표로 사용하지 않는다.'
  ])
});
