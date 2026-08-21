#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const requiredArticleFields = ['intuition', 'formalModelOrRationale', 'workedExampleOrRationale', 'realEconomyChannel', 'companyChannel', 'financialStatementChannel', 'valuationChannel', 'marketChannel', 'tradingApplication', 'invalidation', 'glossary', 'claimIds'];
const workedFields = ['inputs', 'assumptions', 'steps', 'result', 'interpretation', 'failureBoundary'];
const articles = [];
for (const [surface, directory] of [['principles', 'public-data/knowledge/articles/principles'], ['atlas-foundations', 'public-data/knowledge/articles/atlas-foundations']]) {
  const files = fs.readdirSync(path.join(root, directory)).filter((file) => file.endsWith('.json')).sort();
  for (const file of files) articles.push({ surface, file, value: readJson(`${directory}/${file}`) });
}
assert(articles.length === 160, `article count ${articles.length} !== 160`);
const ids = new Set();
for (const { surface, file, value } of articles) {
  assert(value.schemaVersion === 'knowledge-article.v1', `${file}: schemaVersion`);
  assert(value.surface === surface, `${file}: surface`);
  assert(!ids.has(value.articleId), `${file}: duplicate articleId`);
  ids.add(value.articleId);
  for (const field of requiredArticleFields) assert(value.article?.[field] != null && (typeof value.article[field] !== 'string' || value.article[field].trim()), `${file}: missing article.${field}`);
  for (const field of workedFields) assert(value.article?.workedExampleOrRationale?.[field] != null && (typeof value.article.workedExampleOrRationale[field] !== 'string' || value.article.workedExampleOrRationale[field].trim()), `${file}: missing workedExample.${field}`);
  assert(value.publication === 'EDUCATIONAL_REFERENCE_ONLY', `${file}: publication boundary`);
  assert(value.quality?.coreTextCharacters >= 1200, `${file}: core text floor`);
  assert(value.authoringStatus === 'STRUCTURED_REFERENCE_DRAFT' || value.authoringStatus === 'AUTHOR_REVIEWED' || value.authoringStatus === 'PUBLISHED_REFERENCE', `${file}: invalid authoring status`);
}
const learning = readJson('public-data/knowledge/learning-graph.json');
assert(learning.nodes.length === 160, `learning node count ${learning.nodes.length} !== 160`);
assert(learning.paths.length >= 8, `learning path count ${learning.paths.length} < 8`);
const nodeIds = new Set(learning.nodes.map((node) => node.id));
for (const node of learning.nodes) {
  for (const relation of [...(node.prerequisiteIds || []), ...(node.nextIds || []), ...(node.expertRouteIds || [])]) assert(nodeIds.has(relation), `learning graph dangling relation ${node.id}->${relation}`);
  assert((node.nextIds || []).length > 0 || (node.expertRouteIds || []).length > 0, `learning graph dead end ${node.id}`);
}
for (const entry of learning.paths) for (const nodeId of entry.nodeIds || []) assert(nodeIds.has(nodeId), `learning path dangling node ${entry.id}->${nodeId}`);
const report = { status: failures.length ? 'FAIL' : 'PASS', articles: articles.length, learningNodes: learning.nodes.length, paths: learning.paths.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
