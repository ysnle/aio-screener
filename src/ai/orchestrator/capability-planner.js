export const AI_CAPABILITY_PLAN_VERSION = 'capability-plan.v1';

const TOOL_BY_EVIDENCE = Object.freeze({
  'market-session': 'marketSession', 'market-snapshot': 'market', 'sector-constituents': 'sector', breadth: 'sector',
  'entity-quote': 'entity', fundamentals: 'entity', filing: 'entity', technical: 'technical', macro: 'macro',
  'fx-quote': 'market', rates: 'macro', 'cross-asset': 'macro', screener: 'screener', news: 'news',
  portfolio: 'portfolio', 'portfolio-consent': 'portfolio'
});

export function createCapabilityPlan(questionPlan = {}) {
  const required = [...new Set((questionPlan.requiredTools || questionPlan.requiredEvidence || []).map((item) => TOOL_BY_EVIDENCE[item] || item))];
  const readOnly = required.filter((tool) => tool !== 'portfolio' || questionPlan.suitabilityRequired !== true);
  const blocked = questionPlan.suitabilityRequired === true && !questionPlan.actionPermission?.allowed ? ['portfolio-action'] : [];
  return Object.freeze({
    schemaVersion: AI_CAPABILITY_PLAN_VERSION,
    queryId: questionPlan.queryId || null,
    requiredTools: Object.freeze(required),
    readOnlyTools: Object.freeze(readOnly),
    blockedCapabilities: Object.freeze(blocked),
    status: blocked.length ? 'clarification-required' : 'ready'
  });
}
