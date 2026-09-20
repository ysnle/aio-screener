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
  // W04-B/P1149 (C02): a verification question is not a KPI and the mechanism prose is not a
  // validated chain order. Both must stay in their own fields, the generator must not invent
  // metric definitions or economic edges, and the draft semantic-review boundary must survive.
  assert(Array.isArray(dossier.metrics) && Array.isArray(dossier.researchQuestions) && dossier.valueChainGraph && typeof dossier.valueChainGraph === 'object', `${dossier.domainId}: metrics/researchQuestions/valueChainGraph missing`);
  const questionTexts = new Set(dossier.researchQuestions.map((row) => row.question));
  assert(dossier.uniqueKpis.every((entry) => !questionTexts.has(entry)), `${dossier.domainId}: a verification question leaked into uniqueKpis`);
  assert(dossier.valueChain.every((entry) => String(entry) !== String(dossier.mechanism || '')), `${dossier.domainId}: the mechanism prose was used as a chain step`);
  assert(dossier.valueChainGraph.status === 'UNCLASSIFIED_CANDIDATE' && dossier.valueChainGraph.edges.length === 0, `${dossier.domainId}: an un-normalized chain must stay a candidate with no invented edges`);
  assert(dossier.researchQuestions.every((row) => row.question && row.verificationCondition === null), `${dossier.domainId}: research questions must be explicit and unverified`);
  assert(dossier.metrics.every((row) => row.definition === null && row.normalizationStatus === 'UNCLASSIFIED_CANDIDATE'), `${dossier.domainId}: the generator invented a metric definition`);
  assert(dossier.status === 'STRUCTURAL_REFERENCE_DRAFT' && dossier.completion.semanticReview === 'REQUIRED', `${dossier.domainId}: the draft semantic-review boundary was promoted`);
  for (const id of dossier.taxonomyNodeIds) nodeIds.add(id);
  for (const id of dossier.deepBranchIds) branchIds.add(id);
}
assert(nodeIds.size === 95, `taxonomy coverage ${nodeIds.size} !== 95`);
assert(branchIds.size === 50, `deep branch coverage ${branchIds.size} !== 50`);
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', domains: index.dossiers.length, taxonomyNodes: nodeIds.size, deepBranches: branchIds.size, completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
