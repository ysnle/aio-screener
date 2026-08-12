#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const index = read('public-data/knowledge/domain-dossiers.json');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
assert(index.dossiers.length === 19, `domain count ${index.dossiers.length} !== 19`);
const nodeIds = new Set();
const branchIds = new Set();
for (const dossier of index.dossiers) {
  assert(dossier.schemaVersion === 'knowledge-domain-dossier.v1', `${dossier.domainId}: schema`);
  assert(dossier.taxonomyNodeIds.length > 0, `${dossier.domainId}: no taxonomy nodes`);
  assert(dossier.uniqueKpis.length > 0, `${dossier.domainId}: no unique KPI/verification fields`);
  assert(dossier.bottlenecks.length > 0, `${dossier.domainId}: no bottleneck`);
  assert(dossier.valueChain.length > 0, `${dossier.domainId}: no value chain`);
  for (const id of dossier.taxonomyNodeIds) nodeIds.add(id);
  for (const id of dossier.deepBranchIds) branchIds.add(id);
}
assert(nodeIds.size === 95, `taxonomy coverage ${nodeIds.size} !== 95`);
assert(branchIds.size === 50, `deep branch coverage ${branchIds.size} !== 50`);
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', domains: index.dossiers.length, taxonomyNodes: nodeIds.size, deepBranches: branchIds.size, completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
