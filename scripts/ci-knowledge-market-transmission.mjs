#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runKnowledgeAuthoringNegativeFixtures, validateKnowledgeAuthoringCorpus, SOURCE_PRESERVED_STATUS, SEMANTIC_REFERENCE_STATUS } from './lib/knowledge-authoring-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const articles = read('public-data/knowledge/articles.json').articles || [];
const domains = read('public-data/knowledge/domain-dossiers.json').dossiers || [];
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const authoringContracts = new Map([
  ['principles', validateKnowledgeAuthoringCorpus({ surface: 'principles', artifact: read('public-data/principles/lesson-library.json'), articles: articles.filter((article) => article.surface === 'principles') })],
  ['atlas-foundations', validateKnowledgeAuthoringCorpus({ surface: 'atlas-foundations', artifact: read('public-data/atlas/foundation-lessons.json'), articles: articles.filter((article) => article.surface === 'atlas-foundations') })]
]);
for (const [surface, contract] of authoringContracts) for (const failure of contract.failures) failures.push(`${surface}: ${failure}`);
for (const failure of runKnowledgeAuthoringNegativeFixtures()) failures.push(`authoring contract fixture: ${failure}`);
for (const article of articles) {
  const deep = article.deepArticle;
  const authoringMode = authoringContracts.get(article.surface)?.mode;
  assert(deep && deep.dossierId, `${article.articleId}: missing deepArticle dossier`);
  assert(Array.isArray(deep?.progressiveDisclosure) && deep.progressiveDisclosure.length >= (authoringMode === SEMANTIC_REFERENCE_STATUS ? 3 : 2), `${article.articleId}: progressive disclosure`);
  assert(deep?.uniqueDraftSeed?.definition && deep?.uniqueDraftSeed?.mechanism, `${article.articleId}: unique mechanism seed`);
  assert(deep?.status === authoringMode || (authoringMode === null && deep?.status === SOURCE_PRESERVED_STATUS), `${article.articleId}: authoring depth status drifted`);
}
for (const dossier of domains) {
  const pathNodes = dossier.marketTransmission?.path || [];
  assert(pathNodes.length >= 5, `${dossier.domainId}: incomplete market transmission path`);
  assert(pathNodes.at(-1) === 'invalidation', `${dossier.domainId}: missing invalidation endpoint`);
}
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', articles: articles.length, domains: domains.length, quantitativeLabs: 'EXCLUDED_BY_PRODUCT_SCOPE', completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
