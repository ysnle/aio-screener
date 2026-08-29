#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'public-data', 'knowledge', name), 'utf8'));
const articlesBundle = read('articles.json');
const conceptsBundle = read('concepts.json');
const aliasesBundle = read('aliases.json');
const sourcesBundle = read('sources.json');
const routeTargetsBundle = read('route-targets.json');
const compact = (value, limit) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`;
};
const stopWords = new Set(['and', 'the', 'for', 'with', 'from', 'into', 'system', 'systems', 'market', '시장', '기업', '분석', '설명', '대한']);
const words = (value) => [...new Set(String(value || '').toLowerCase().match(/[0-9a-z가-힣]{2,}/g) || [])].filter((word) => !stopWords.has(word));
const sourcesById = new Map((sourcesBundle.sources || []).map((source) => [source.id, source]));
const targetsByArticle = new Map((routeTargetsBundle.targets || []).filter((target) => target.articleId).map((target) => [target.articleId, target]));
const aliasesByTarget = new Map();
for (const entry of aliasesBundle.aliases || []) {
  if (entry.resolution !== 'unique') continue;
  for (const target of entry.targets || []) aliasesByTarget.set(target, [...(aliasesByTarget.get(target) || []), entry.alias]);
}

const outputArticles = (articlesBundle.articles || []).map((article) => {
  const haystack = `${article.title} ${Object.values(article.summary || {}).join(' ')}`.toLowerCase();
  const articleWords = words(`${article.title} ${article.summary?.definition} ${article.summary?.mechanism}`);
  const concepts = (conceptsBundle.concepts || []).map((concept) => {
    if (concept.surface !== article.surface && !(article.surface === 'atlas-foundations' && concept.surface === 'atlas')) return false;
    const titleWords = words(concept.title);
    const overlap = titleWords.filter((word) => haystack.includes(word)).length;
    return overlap ? { concept, score: overlap / Math.max(1, titleWords.length) + overlap } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.concept.canonicalId.localeCompare(b.concept.canonicalId)).slice(0, 6).map((row) => row.concept);
  const candidateSourceIds = [...new Set([...(article.article?.sourceIds || []), ...concepts.flatMap((concept) => concept.sourceIds || [])])];
  const sourceRows = candidateSourceIds.map((id) => sourcesById.get(id)).filter(Boolean).map((source) => {
    const sourceWords = words(`${source.title || ''} ${source.scope || ''}`);
    const overlap = sourceWords.filter((word) => articleWords.includes(word)).length;
    return { source, overlap };
  }).filter((row) => row.overlap > 0).sort((a, b) => b.overlap - a.overlap || a.source.id.localeCompare(b.source.id)).slice(0, 2).map((row) => row.source);
  const target = targetsByArticle.get(article.articleId) || null;
  const route = article.surface === 'principles' ? 'principles' : 'atlas';
  const conceptAliases = concepts.flatMap((concept) => aliasesByTarget.get(concept.canonicalId) || []);
  return {
    articleId: article.articleId,
    lessonId: article.lessonId,
    conceptIds: concepts.map((concept) => concept.canonicalId),
    surface: article.surface,
    title: article.title,
    authoringStatus: article.authoringStatus,
    publication: article.publication,
    reviewedAt: article.reviewedAt,
    keywords: [...new Set([article.title, ...concepts.map((concept) => concept.title), ...conceptAliases])].filter(Boolean).slice(0, 18),
    route: {
      routeId: route,
      deepLink: `?lesson=${encodeURIComponent(article.lessonId)}#${route}`,
      verificationRouteId: target?.routeId || null,
      verificationLabel: target?.routeLabel || null,
      metric: target?.metric || null,
      timeframe: target?.timeframe || null
    },
    sources: sourceRows.map((source) => ({
      id: source.id,
      publisher: source.publisher || null,
      title: source.title || null,
      url: /^https:\/\//i.test(source.url || '') ? source.url : null,
      allowedUse: source.allowedUse || 'REFERENCE_ONLY',
      directness: 'CANDIDATE_REVIEW_REQUIRED'
    })),
    summary: {
      definition: compact(article.summary?.definition, 620),
      mechanism: compact(article.summary?.mechanism, 720),
      example: compact(article.summary?.example, 440),
      counterScenario: compact(article.summary?.counterScenario, 440),
      visualization: compact(article.summary?.visualization, 220)
    }
  };
});

atomicWriteJsonSync(path.join(root, 'public-data', 'knowledge', 'ai-retrieval-index.json'), {
  schemaVersion: 'ai-knowledge-retrieval-index.v1',
  generatedAt: [articlesBundle.generatedAt, conceptsBundle.generatedAt, sourcesBundle.generatedAt, routeTargetsBundle.generatedAt].filter(Boolean).sort().at(-1),
  status: 'REFERENCE_ONLY',
  boundary: 'Compact AI retrieval index for Market Principles and AI Era Knowledge Map. Current claims and trade decisions require separate live evidence.',
  counts: {
    total: outputArticles.length,
    principles: outputArticles.filter((article) => article.surface === 'principles').length,
    atlasFoundations: outputArticles.filter((article) => article.surface === 'atlas-foundations').length,
    withConcepts: outputArticles.filter((article) => article.conceptIds.length).length,
    withSources: outputArticles.filter((article) => article.sources.length).length,
    withRouteTargets: outputArticles.filter((article) => article.route.verificationRouteId).length
  },
  articles: outputArticles
});

console.log(JSON.stringify({ status: 'PASS', ...outputArticles.reduce((acc, article) => ({ total: acc.total + 1, concepts: acc.concepts + article.conceptIds.length, sources: acc.sources + article.sources.length }), { total: 0, concepts: 0, sources: 0 }) }, null, 2));
