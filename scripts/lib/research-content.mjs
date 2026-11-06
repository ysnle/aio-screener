// S17~S19 (D8): research prose lives once, in content/research/*.json. This module turns those sources into the
// shapes the screens and builders use, so the page, the knowledge builders and the CI gates read the same thing.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeKnowledgeEdges } from '../../src/domain/knowledge/graph.js';
import { PRINCIPLE_EDGE_SEMANTICS } from '../../src/domain/knowledge/principles-edge-semantics.js';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));

export const PRINCIPLES_CATALOG_SOURCE = 'content/research/principles/catalog.json';
export const PRINCIPLES_CATALOG_ARTIFACT = 'public-data/principles/catalog.json';
export const ATLAS_COPY_SOURCE = 'content/research/atlas/page-copy.json';
export const ATLAS_COPY_ARTIFACT = 'public-data/atlas/page-copy.json';

// Same composition the page used to run at import time: parts in order, reviewedAt stamped on nodes and lessons,
// edges normalised with the generated edge semantics.
export function composePrinciplesCatalog(source, edgeSemantics = PRINCIPLE_EDGE_SEMANTICS) {
  const parts = source.parts || [];
  const all = (key) => parts.flatMap((part) => part[key] || []);
  const reviewedAt = source.reviewedAt;
  return {
    schemaVersion: 'principles-catalog.v1',
    reviewedAt,
    boundary: source.boundary,
    nodes: all('nodes').map((node) => ({ ...node, reviewedAt })),
    edges: JSON.parse(JSON.stringify(normalizeKnowledgeEdges(all('edges'), { kind: 'PRINCIPLE', reviewedAt, edgeSemantics }))),
    lessons: all('lessons').map((lesson) => ({ ...lesson, reviewedAt })),
    paths: all('paths')
  };
}

// The atlas source keeps every table the page used to define; only the two the screen reads are published.
// The other six (packet plan, track and level copy) had no reader anywhere and stay in the source only.
export const ATLAS_PUBLISHED_TABLES = Object.freeze(['FOUNDATION_LAYER_DISPLAY', 'ATLAS_CONCEPT_GUIDES']);
export const atlasPageCopy = (source) => ({
  schemaVersion: 'atlas-page-copy.v1',
  reviewedAt: source.reviewedAt,
  boundary: source.boundary,
  ...Object.fromEntries(ATLAS_PUBLISHED_TABLES.map((name) => [name, source[name]]))
});

export const INDUSTRY_STORIES_SOURCE = 'content/research/atlas/industry-stories.json';
export const INDUSTRY_STORIES_ARTIFACT = 'public-data/atlas/industry-stories.json';
export const CONCEPT_STORIES_SOURCE = 'content/research/principles/concept-stories.json';
export const CONCEPT_STORIES_ARTIFACT = 'public-data/principles/concept-stories.json';

export const readPrinciplesCatalogSource = () => composePrinciplesCatalog(readJson(PRINCIPLES_CATALOG_SOURCE));
export const readAtlasCopySource = () => readJson(ATLAS_COPY_SOURCE);

// 산업 지도 reading text: three authoring parts merged in order (a duplicate id across parts throws), plus the
// 19 domain overviews.
export function readIndustryStories() {
  const source = readJson(INDUSTRY_STORIES_SOURCE);
  const nodes = {};
  for (const part of source.nodeStoryParts) {
    for (const [id, story] of Object.entries(part.stories)) {
      if (nodes[id]) throw new Error(`INDUSTRY_STORY_DUPLICATE ${id}`);
      nodes[id] = story;
    }
  }
  return { boundary: source.boundary, INDUSTRY_NODE_STORIES: nodes, INDUSTRY_DOMAIN_STORIES: source.domainStories };
}
export const readConceptStories = () => readJson(CONCEPT_STORIES_SOURCE).stories;

// Every generated research artifact: [path, value]. build-research-content writes them; the CI gate compares.
export function researchContentArtifacts() {
  const industry = readIndustryStories();
  const concepts = readJson(CONCEPT_STORIES_SOURCE);
  return [
    [PRINCIPLES_CATALOG_ARTIFACT, readPrinciplesCatalogSource()],
    [ATLAS_COPY_ARTIFACT, atlasPageCopy(readAtlasCopySource())],
    [INDUSTRY_STORIES_ARTIFACT, { schemaVersion: 'industry-stories.v1', boundary: industry.boundary, nodes: industry.INDUSTRY_NODE_STORIES, domains: industry.INDUSTRY_DOMAIN_STORIES }],
    [CONCEPT_STORIES_ARTIFACT, { schemaVersion: 'concept-stories.v1', boundary: concepts.boundary, stories: concepts.stories }]
  ];
}
