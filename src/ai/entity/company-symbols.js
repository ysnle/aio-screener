// Which resolved entities of a question plan are companies: a verified US/KR listing that is not an index (^…) or a
// topic proxy. Kept apart from the question planner so the chat ticker resolver and the evidence binding read it
// without loading the planner (intent taxonomy, research plan) at boot.

// Sector/index topic words resolve to proxy symbols (반도체 → SOXX, owner 2026-11-04); they are topics, not a named company.
export const CHAT_TOPIC_PROXIES = new Set(['SOXX', 'SMH', 'IGV', 'DX-Y.NYB']);

export function companyEntitySymbols(questionPlan, limit = 5) {
  const list = questionPlan?.entities?.entities || [];
  return [...new Set(list.filter((entity) => entity && entity.verified && (entity.market === 'US' || entity.market === 'KR')
    && !String(entity.symbol).startsWith('^') && !CHAT_TOPIC_PROXIES.has(entity.symbol)).map((entity) => String(entity.symbol)))].slice(0, limit);
}
