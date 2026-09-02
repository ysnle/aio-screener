const ALLOWED_ROUTE_IDS = Object.freeze(['atlas', 'principles', 'macro', 'fxbond', 'fundamental', 'themes', 'technical', 'market-news', 'screener', 'entity', 'portfolio', 'options']);
const ALLOWED_ROUTE_SET = new Set(ALLOWED_ROUTE_IDS);

// Read-only compatibility facade. Exporting the mutable Set let any consumer
// expand the navigation allowlist for every later bridge call.
export const ALLOWED_ROUTES = Object.freeze({
  size: ALLOWED_ROUTE_IDS.length,
  has: (routeId) => ALLOWED_ROUTE_SET.has(routeId),
  values: () => ALLOWED_ROUTE_IDS.values(),
  [Symbol.iterator]: () => ALLOWED_ROUTE_IDS[Symbol.iterator]()
});

function canonicalTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return null;
  const articleId = String(target.articleId || '').trim();
  if (!articleId) return null;
  return Object.freeze({
    ...target,
    articleId,
    routeId: target.routeId ? String(target.routeId) : null,
    conceptId: target.conceptId ? String(target.conceptId) : null,
    metric: target.metric ? String(target.metric) : null,
    timeframe: target.timeframe ? String(target.timeframe) : null
  });
}

function canonicalReturnContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { value: null, serialized: null };
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > 4096) return { value: null, serialized: null };
    return { value: Object.freeze(JSON.parse(serialized)), serialized };
  } catch (_) {
    return { value: null, serialized: null };
  }
}

export function createKnowledgeRouteBridge(targets = []) {
  const canonicalTargets = (Array.isArray(targets) ? targets : []).map(canonicalTarget).filter(Boolean);
  const byArticleId = new Map(canonicalTargets.map((target) => [target.articleId, target]));
  const resolve = (articleId) => byArticleId.get(String(articleId || '').trim()) || null;
  return Object.freeze({
    targets: Object.freeze([...byArticleId.values()]),
    resolve,
    buildNavigation(articleId, { returnContext = null } = {}) {
      const target = resolve(articleId);
      const normalizedReturn = canonicalReturnContext(returnContext);
      if (!target || !target.routeId || !ALLOWED_ROUTE_SET.has(target.routeId)) {
        return Object.freeze({ status: 'OVERVIEW_ONLY', articleId: String(articleId || ''), returnContext: normalizedReturn.value, url: null });
      }
      const params = new URLSearchParams();
      if (target.conceptId) params.set('knowledgeNode', target.conceptId);
      if (target.metric) params.set('metric', target.metric);
      if (target.timeframe) params.set('timeframe', target.timeframe);
      if (normalizedReturn.serialized) params.set('return', normalizedReturn.serialized);
      const query = params.toString();
      return Object.freeze({ status: 'ROUTE_TARGET', articleId: target.articleId, routeId: target.routeId, returnContext: normalizedReturn.value, url: `#${target.routeId}${query ? `?${query}` : ''}` });
    }
  });
}
