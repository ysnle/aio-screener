#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const artifact = readJson('public-data/knowledge/integrated-market-ai-frameworks.json');
const concepts = readJson('public-data/knowledge/concepts.json');
const conceptIds = new Set((concepts.concepts || []).map((concept) => concept.canonicalId));
const frameworks = artifact.frameworks || [];
const required = ['definition', 'mechanism', 'observables', 'confirmation', 'invalidation', 'counterclaim', 'question', 'visualization'];

assert.equal(artifact.schemaVersion, 'integrated-market-ai-framework-pack.v1');
assert.equal(artifact.status, 'REFERENCE_ONLY');
assert.equal(artifact.publication, 'EDUCATIONAL_REFERENCE_ONLY');
assert.equal(frameworks.length, 29);
assert.equal(frameworks.filter((framework) => framework.page === 'principles').length, 12);
assert.equal(frameworks.filter((framework) => framework.page === 'atlas').length, 17);
for (const framework of frameworks) {
  for (const field of required) assert(framework[field] && (!Array.isArray(framework[field]) || framework[field].length), `${framework.id}: missing ${field}`);
  assert.equal(framework.currentClaimsAllowed, false, `${framework.id}: current claims boundary`);
  assert.equal(framework.rankingUse, 'none', `${framework.id}: ranking boundary`);
  for (const linkedConceptId of framework.linkedConceptIds || []) assert(conceptIds.has(linkedConceptId), `${framework.id}: dangling linked concept ${linkedConceptId}`);
}
assert((artifact.articles || []).every((article) => Array.isArray(article.sources) && article.sources.length === 0), 'integrated articles must not replay raw source URLs');
const serialized = JSON.stringify(artifact);
assert(!/(?:x\.com|twitter\.com|notion\.site|당신은_어떻게|nathan|Nathan)/i.test(serialized), 'user-facing integrated artifact must not replay source identity or external-post URLs');
assert.equal(artifact.datedScene?.asOf, '2026-09-12');
assert.equal(artifact.datedScene?.status, 'REFERENCE_CANDIDATE_REQUIRES_PRIMARY_RECONCILIATION');
assert.equal(artifact.integrationAudit?.find((row) => row.id === 'market-principles-curriculum')?.inventory, 112);
assert.equal(artifact.integrationAudit?.find((row) => row.id === 'ai-era-foundations')?.inventory, 48);
assert.equal(artifact.integrationAudit?.find((row) => row.id === 'structural-frameworks')?.inventory, 28);
assert.equal(artifact.integrationAudit?.find((row) => row.id === 'current-supplied-manuscript')?.checks?.rawDocumentReplay, false);
assert(read('src/ui/pages/principles.js').includes("createIntegratedFrameworkSpine"), 'Principles page must consume the integrated spine');
assert(read('src/ui/pages/atlas.js').includes("createIntegratedFrameworkSpine"), 'Atlas page must consume the integrated spine');
assert(read('src/ai/retrieval/knowledge.js').includes("integrated-frameworks"), 'AI retrieval must allow the integrated framework surface');
console.log(JSON.stringify({ status: 'PASS', frameworks: frameworks.length, principles: 12, atlas: 17, datedScene: artifact.datedScene.status, identityReplay: false, rankingMutation: false }, null, 2));
