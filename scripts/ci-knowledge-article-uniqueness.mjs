#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const articles = read('public-data/knowledge/articles.json').articles || [];
const expectedArticleCount = (read('public-data/principles/lesson-library.json').lessons || []).length
  + (read('public-data/atlas/foundation-lessons.json').lessons || []).length;
const failures = [];
const signatures = new Map();
for (const article of articles) {
  const seed = article.deepArticle?.uniqueDraftSeed;
  if (!seed) failures.push(`${article.articleId}: missing unique draft seed`);
  const signature = JSON.stringify(seed || {});
  signatures.set(signature, [...(signatures.get(signature) || []), article.articleId]);
  if (article.deepArticle?.status !== 'RECONSTRUCTION_REQUIRED') failures.push(`${article.articleId}: draft boundary changed without review`);
}
const collisions = [...signatures.values()].filter((ids) => ids.length > 1);
const report = {
  status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY',
  articles: articles.length,
  expectedArticles: expectedArticleCount,
  uniqueDraftSeeds: signatures.size,
  exactCollisions: collisions.length,
  completionReady: false,
  boundary: 'Unique draft seeds preserve source-specific authoring material; they do not certify human-reviewed article uniqueness.',
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length || articles.length !== expectedArticleCount) process.exit(1);
