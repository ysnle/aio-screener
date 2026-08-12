#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const articles = read('public-data/knowledge/articles.json').articles || [];
const domains = read('public-data/knowledge/domain-dossiers.json').dossiers || [];
const labs = read('public-data/knowledge/quantitative-labs.json').labs || [];
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
for (const article of articles) {
  const deep = article.deepArticle;
  assert(deep && deep.dossierId, `${article.articleId}: missing deepArticle dossier`);
  assert(Array.isArray(deep?.progressiveDisclosure) && deep.progressiveDisclosure.length >= 3, `${article.articleId}: progressive disclosure`);
  assert(deep?.uniqueDraftSeed?.definition && deep?.uniqueDraftSeed?.mechanism, `${article.articleId}: unique mechanism seed`);
  assert(deep?.status === 'RECONSTRUCTION_REQUIRED', `${article.articleId}: promoted without reconstruction`);
}
for (const dossier of domains) {
  const pathNodes = dossier.marketTransmission?.path || [];
  assert(pathNodes.length >= 5, `${dossier.domainId}: incomplete market transmission path`);
  assert(pathNodes.at(-1) === 'invalidation', `${dossier.domainId}: missing invalidation endpoint`);
}
for (const lab of labs) {
  assert(lab.observation?.metric && lab.observation?.timeframe && lab.observation?.regime, `${lab.labId}: incomplete observation contract`);
  assert(lab.observation?.catalyst && lab.observation?.confirmation && lab.observation?.invalidation, `${lab.labId}: incomplete confirmation/invalidation contract`);
}
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', articles: articles.length, domains: domains.length, labs: labs.length, completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
