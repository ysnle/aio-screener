#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const requiredArticleFields = ['intuition', 'formalModelOrRationale', 'workedExampleOrRationale', 'realEconomyChannel', 'companyChannel', 'financialStatementChannel', 'valuationChannel', 'marketChannel', 'tradingApplication', 'invalidation', 'glossary', 'claimIds'];
const lessonsBySurface = new Map([
  ['principles', readJson('public-data/principles/lesson-library.json').lessons],
  ['atlas-foundations', readJson('public-data/atlas/foundation-lessons.json').lessons]
]);
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
  for (const field of requiredArticleFields) assert(value.article?.[field] != null, file + ': missing article.' + field);
  const source = lessonsBySurface.get(surface).find((lesson) => lesson.id === value.lessonId);
  assert(!!source, file + ': source lesson missing');
  const short = source?.summary || {};
  assert(value.article?.intuition === short.definition, file + ': definition altered or padded');
  assert(value.article?.formalModelOrRationale?.text === short.mechanism, file + ': mechanism altered or padded');
  assert(JSON.stringify(value.article?.workedExampleOrRationale?.inputs) === JSON.stringify([short.example]), file + ': example altered or padded');
  assert(value.article?.invalidation === short.counterScenario, file + ': counter scenario altered');
  assert(value.article?.tradingApplication === short.verificationQuestion, file + ': question altered');
  assert((source?.sourceIds || []).every((id) => value.article?.sourceIds?.includes(id)), file + ': source IDs lost');
  assert(value.quality?.contentForm === 'SOURCE_SUMMARY' && value.deepArticle?.status === 'RECONSTRUCTION_REQUIRED', file + ': unreviewed depth promotion');
  assert(!value.deepArticle?.progressiveDisclosure?.includes('5-minute-core-article'), file + ': inflated reading promise');
  assert(value.publication === 'EDUCATIONAL_REFERENCE_ONLY', file + ': publication boundary');
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
