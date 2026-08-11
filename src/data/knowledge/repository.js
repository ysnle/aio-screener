import { loadKnowledgeCapabilities } from './load-capabilities.js';

export const KNOWLEDGE_CAPABILITY_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'concepts', url: './public-data/knowledge/concepts.json' }),
  Object.freeze({ key: 'aliases', url: './public-data/knowledge/aliases.json' }),
  Object.freeze({ key: 'sources', url: './public-data/knowledge/sources.json' }),
  Object.freeze({ key: 'claims', url: './public-data/knowledge/claims.json' }),
  Object.freeze({ key: 'articles', url: './public-data/knowledge/articles.json' }),
  Object.freeze({ key: 'learningGraph', url: './public-data/knowledge/learning-graph.json' }),
  Object.freeze({ key: 'routeTargets', url: './public-data/knowledge/route-targets.json' })
]);

export async function createKnowledgeRepository(fetchFn, definitions = KNOWLEDGE_CAPABILITY_DEFINITIONS) {
  const capabilities = await loadKnowledgeCapabilities(fetchFn, definitions);
  const values = Object.fromEntries(Object.entries(capabilities).map(([key, result]) => [key, result.value]));
  return Object.freeze({
    capabilities: Object.freeze(capabilities),
    values: Object.freeze(values),
    status(key) { return capabilities[key]?.status || 'fallback'; },
    get(key) { return capabilities[key]?.value || null; }
  });
}
