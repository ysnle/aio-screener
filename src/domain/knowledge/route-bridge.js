const ALLOWED_ROUTES = new Set(['atlas', 'principles', 'macro', 'fxbond', 'fundamental', 'themes', 'technical', 'market-news', 'screener', 'entity', 'portfolio', 'options']);

export function createKnowledgeRouteBridge(targets = []) {
  const byArticleId = new Map(targets.map((target) => [target.articleId, target]));
  const resolve = (articleId) => byArticleId.get(articleId) || null;
  return Object.freeze({
    targets: Object.freeze([...byArticleId.values()]),
    resolve,
    buildNavigation(articleId, { returnContext = null, location = '/' } = {}) {
      const target = resolve(articleId);
      if (!target || !target.routeId || !ALLOWED_ROUTES.has(target.routeId)) return Object.freeze({ status: 'OVERVIEW_ONLY', articleId, returnContext, url: null });
      const params = new URLSearchParams();
      if (target.conceptId) params.set('knowledgeNode', target.conceptId);
      if (target.metric) params.set('metric', target.metric);
      if (target.timeframe) params.set('timeframe', target.timeframe);
      if (returnContext) params.set('return', JSON.stringify(returnContext));
      const query = params.toString();
      return Object.freeze({ status: 'ROUTE_TARGET', articleId, routeId: target.routeId, url: `#${target.routeId}${query ? `?${query}` : ''}` });
    }
  });
}

export { ALLOWED_ROUTES };
