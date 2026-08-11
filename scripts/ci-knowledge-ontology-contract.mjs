#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_PRINCIPLES_CATALOG } from '../src/ui/pages/principles.js';
import { createConceptRegistry } from '../src/domain/knowledge/ontology.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const conceptsArtifact = readJson('public-data/knowledge/concepts.json');
const aliasesArtifact = readJson('public-data/knowledge/aliases.json');
const taxonomy = readJson('public-data/atlas/taxonomy-node-coverage.json');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const concepts = conceptsArtifact.concepts || [];
const aliases = aliasesArtifact.aliases || [];
const registry = createConceptRegistry(concepts, aliases);
const expected = [
  ...MARKET_PRINCIPLES_CATALOG.nodes.map((node) => ({ surface: 'principles', legacyId: node.id })),
  ...taxonomy.nodes.map((node) => ({ surface: 'atlas', legacyId: node.nodeId }))
];
const expectedKeys = new Set(expected.map((item) => `${item.surface}:${item.legacyId}`));
const conceptKeys = new Set(concepts.map((item) => item.canonicalId));

assert(conceptsArtifact.schemaVersion === 'knowledge-concepts.v1', 'concepts schema version mismatch');
assert(aliasesArtifact.schemaVersion === 'knowledge-aliases.v1', 'aliases schema version mismatch');
assert(concepts.length === 155, `concept count ${concepts.length} !== 155`);
assert(new Set(concepts.map((item) => item.canonicalId)).size === concepts.length, 'duplicate canonical concept ID');
assert(expectedKeys.size === conceptKeys.size && [...expectedKeys].every((key) => conceptKeys.has(key)), 'canonical concepts drift from live source inventories');
assert(registry.errors.length === 0, `ontology registry errors: ${JSON.stringify(registry.errors)}`);
assert(registry.concepts.length === concepts.length, 'registry concept count mismatch');

const groupMembers = new Map();
for (const concept of concepts) {
  assert(concept.surface === concept.canonicalId.split(':')[0], `surface mismatch: ${concept.canonicalId}`);
  assert(concept.canonicalId.endsWith(`:${concept.legacyId}`), `legacy ID mismatch: ${concept.canonicalId}`);
  if (concept.equivalenceGroup) {
    const bucket = groupMembers.get(concept.equivalenceGroup) || [];
    bucket.push(concept);
    groupMembers.set(concept.equivalenceGroup, bucket);
  }
}
for (const [group, members] of groupMembers) {
  assert(members.length === 2, `${group} must contain exactly two concepts`);
  assert(new Set(members.map((item) => item.surface)).size === 2, `${group} must span Principles and Atlas`);
  assert(new Set(members.map((item) => item.legacyId)).size === 1, `${group} legacy IDs must match`);
}
for (const alias of aliases) {
  assert(Array.isArray(alias.targets) && alias.targets.length > 0, `alias has no targets: ${alias.alias}`);
  assert(alias.targets.every((target) => conceptKeys.has(target)), `alias target missing: ${alias.alias}`);
  if (alias.targets.length > 1) {
    const targets = alias.targets.map((target) => concepts.find((concept) => concept.canonicalId === target));
    assert(alias.resolution === 'explicit-equivalence', `ambiguous alias is not explicit: ${alias.alias}`);
    assert(targets.every((target) => target?.equivalenceGroup) && new Set(targets.map((target) => target.equivalenceGroup)).size === 1, `ambiguous alias lacks shared equivalence: ${alias.alias}`);
  }
}
for (const concept of concepts) {
  const resolved = registry.resolve(concept.canonicalId);
  assert(resolved.length === 1 && resolved[0].canonicalId === concept.canonicalId, `canonical alias does not resolve: ${concept.canonicalId}`);
}

const report = {
  status: failures.length ? 'FAIL' : 'PASS',
  concepts: concepts.length,
  principles: expected.filter((item) => item.surface === 'principles').length,
  atlas: expected.filter((item) => item.surface === 'atlas').length,
  aliases: aliases.length,
  equivalenceGroups: groupMembers.size,
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
