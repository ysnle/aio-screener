export function selectConcept(bundle, conceptId) {
  return (bundle?.concepts?.concepts || bundle?.concepts || []).find((concept) => concept.canonicalId === conceptId) || null;
}

export function selectArticle(bundle, articleId) {
  return (bundle?.articles?.articles || bundle?.articles || []).find((article) => article.articleId === articleId) || null;
}

export function selectLearningNode(bundle, articleId) {
  return (bundle?.learningGraph?.nodes || []).find((node) => node.articleId === articleId || node.id === articleId) || null;
}

export function selectRouteTarget(bundle, articleId) {
  return (bundle?.routeTargets?.targets || []).find((target) => target.articleId === articleId) || null;
}

export function selectClaim(bundle, claimId) {
  return (bundle?.claims?.claims || bundle?.claims || []).find((claim) => (claim.claimId || claim.id) === claimId) || null;
}

export function selectKnowledgeSummary(bundle, articleId) {
  const article = selectArticle(bundle, articleId);
  const learningNode = selectLearningNode(bundle, articleId);
  const routeTarget = selectRouteTarget(bundle, articleId);
  return Object.freeze({ article, learningNode, routeTarget, status: article?.authoringStatus || 'UNAVAILABLE' });
}
