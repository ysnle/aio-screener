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

export function selectCoverageUnit(bundle, unitId) {
  return (bundle?.coverageMatrix?.units || []).find((unit) => unit.unitId === unitId) || null;
}

export function selectResearchDossier(bundle, contentUnitId) {
  return (bundle?.researchDossiers?.dossiers || []).find((dossier) => dossier.contentUnitId === contentUnitId) || null;
}

export function selectDomainDossier(bundle, domainId) {
  return (bundle?.domainDossiers?.dossiers || []).find((dossier) => dossier.domainId === domainId) || null;
}

export function selectKnowledgeSummary(bundle, articleId) {
  const article = selectArticle(bundle, articleId);
  const learningNode = selectLearningNode(bundle, articleId);
  const routeTarget = selectRouteTarget(bundle, articleId);
  return Object.freeze({ article, learningNode, routeTarget, status: article?.authoringStatus || 'UNAVAILABLE' });
}
