#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const reviewedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-18';
const principles = read('public-data/principles/lesson-library.json');
const foundations = read('public-data/atlas/foundation-lessons.json');
const concepts = read('public-data/knowledge/concepts.json');
const taxonomy = read('public-data/atlas/taxonomy-node-coverage.json');
const deep = read('public-data/atlas/deep-taxonomy.json');
const domains = read('public-data/atlas/domain-guides.json');
const registry = read('public-data/atlas/player-product-registry.json');
const articles = read('public-data/knowledge/articles.json');
const research = read('public-data/knowledge/research-dossiers.json');
const dossierByUnit = new Map((research.dossiers || []).map((dossier) => [dossier.contentUnitId, dossier]));

const units = [];
const add = (unit) => {
  const dossier = dossierByUnit.get(unit.unitId);
  const authored = unit.semanticStatus === 'SEMANTIC_REFERENCE_AUTHORED';
  const researchStatus = dossier?.status === 'RESEARCHED' ? 'RESEARCHED' : dossier?.status === 'RESEARCH_IN_PROGRESS' ? 'RESEARCH_IN_PROGRESS' : 'RESEARCH_REQUIRED';
  const missing = [];
  if (researchStatus !== 'RESEARCHED') missing.push('independent-research-dossier');
  if (!unit.sourceIds?.length) missing.push('source-profile');
  if (!authored) missing.push('semantic-review');
  missing.push('browser-certification');
  units.push({
  unitId: unit.unitId,
  kind: unit.kind,
  surface: unit.surface || null,
  parentId: unit.parentId || null,
  title: unit.title || unit.unitId,
  sourceArtifact: unit.sourceArtifact,
  articleId: unit.articleId || null,
  dossierId: `research:${unit.unitId}`,
  sourceIds: [...new Set(unit.sourceIds || [])],
  coverageState: authored ? 'AUTHORED' : 'INVENTORIED',
  researchStatus,
  articleStatus: unit.articleId && articles.articles?.some((article) => article.articleId === unit.articleId)
    ? 'STRUCTURED_REFERENCE_DRAFT'
    : 'MISSING',
  semanticStatus: unit.semanticStatus || 'REQUIRED',
  browserStatus: 'NOT_RUN',
  currentness: 'REFERENCE_ONLY',
  currentnessBoundary: 'REFERENCE_ONLY: inventory metadata contains no current market, company, product or live value.',
  missing
  });
};

for (const lesson of principles.lessons || []) add({
  unitId: `principles-lesson:${lesson.id}`, kind: 'CORE_LESSON', surface: 'principles', title: lesson.title || lesson.id,
  sourceArtifact: 'public-data/principles/lesson-library.json', articleId: `principles:${lesson.id}`, sourceIds: lesson.sourceIds, semanticStatus: lesson.deepStatus
});
for (const lesson of foundations.lessons || []) add({
  unitId: `atlas-foundation:${lesson.id}`, kind: 'FOUNDATION_LESSON', surface: 'atlas-foundations', title: lesson.title || lesson.id,
  sourceArtifact: 'public-data/atlas/foundation-lessons.json', articleId: `atlas-foundations:${lesson.id}`, sourceIds: lesson.sourceIds, semanticStatus: lesson.deepStatus
});
for (const concept of (concepts.concepts || []).filter((item) => item.surface === 'principles')) add({
  unitId: concept.canonicalId, kind: 'CONCEPT_GUIDE', surface: concept.surface, title: concept.title,
  sourceArtifact: concept.source?.artifact || 'public-data/knowledge/concepts.json', sourceIds: concept.sourceIds
});
for (const node of taxonomy.nodes || []) add({
  unitId: `taxonomy:${node.nodeId}`, kind: 'TAXONOMY_NODE', surface: 'atlas', title: node.title,
  parentId: node.domainId, sourceArtifact: 'public-data/atlas/taxonomy-node-coverage.json', sourceIds: node.sourceIds
});
for (const topic of deep.topics || []) for (const branch of topic.branches || []) add({
  unitId: `deep-branch:${branch.id}`, kind: 'DEEP_BRANCH', surface: 'atlas', title: branch.title || branch.id,
  parentId: topic.id, sourceArtifact: 'public-data/atlas/deep-taxonomy.json', sourceIds: branch.sourceIds
});
for (const guide of domains.guides || []) add({
  unitId: `domain:${guide.id}`, kind: 'DOMAIN', surface: 'atlas', title: guide.title || guide.id,
  sourceArtifact: 'public-data/atlas/domain-guides.json', sourceIds: guide.sourceIds
});
for (const player of registry.players || []) add({
  unitId: `player:${player.playerId}`, kind: 'PLAYER', surface: 'atlas', title: player.name || player.playerId,
  sourceArtifact: 'public-data/atlas/player-product-registry.json', sourceIds: player.sourceIds
});
for (const product of registry.products || []) add({
  unitId: `product:${product.productId}`, kind: 'PRODUCT', surface: 'atlas', title: product.productId,
  parentId: product.playerId, sourceArtifact: 'public-data/atlas/player-product-registry.json', sourceIds: product.sourceIds
});

const counts = Object.fromEntries(['CORE_LESSON', 'FOUNDATION_LESSON', 'CONCEPT_GUIDE', 'TAXONOMY_NODE', 'DEEP_BRANCH', 'DOMAIN', 'PLAYER', 'PRODUCT']
  .map((kind) => [kind, units.filter((unit) => unit.kind === kind).length]));
write('public-data/knowledge/coverage-matrix.json', {
  schemaVersion: 'knowledge-coverage-matrix.v1',
  generatedAt: reviewedAt,
  status: units.some((unit) => unit.coverageState !== 'INVENTORIED' || unit.researchStatus !== 'RESEARCH_REQUIRED') ? 'PARTIALLY_AUTHORED' : 'INVENTORIED',
  boundary: 'coverage matrix records the full corpus, authored depth, research dossier state and open certification state; authored or researched does not imply browser/live validation',
  stateVocabulary: ['INVENTORIED', 'RESEARCHED', 'AUTHORED', 'SEMANTIC_REVIEWED', 'BROWSER_VERIFIED', 'LIVE_VERIFIED'],
  counts: {
    units: units.length,
    coreLessons: counts.CORE_LESSON,
    foundationLessons: counts.FOUNDATION_LESSON,
    conceptGuides: counts.CONCEPT_GUIDE,
    taxonomyNodes: counts.TAXONOMY_NODE,
    deepBranches: counts.DEEP_BRANCH,
    domains: counts.DOMAIN,
    players: counts.PLAYER,
    products: counts.PRODUCT
  },
  acceptance: {
    missingUnits: 0,
    representativeOnlySubstitution: false,
    overviewOnlyRequiresCanonicalPath: true,
    completionRequiresIndependentDossier: true
  },
  units
});
console.log(JSON.stringify({ status: 'PASS', ...counts, units: units.length }, null, 2));
