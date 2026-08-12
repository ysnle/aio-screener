#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const matrix = read('public-data/knowledge/coverage-matrix.json');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const expected = { CORE_LESSON: 111, FOUNDATION_LESSON: 48, CONCEPT_GUIDE: 60, TAXONOMY_NODE: 95, DEEP_BRANCH: 50, DOMAIN: 19, PLAYER: 20, PRODUCT: 20 };
const ids = new Set();
assert(matrix.schemaVersion === 'knowledge-coverage-matrix.v1', 'schemaVersion');
assert(Array.isArray(matrix.units), 'units missing');
for (const [kind, count] of Object.entries(expected)) assert(matrix.units.filter((unit) => unit.kind === kind).length === count, `${kind} count mismatch`);
for (const unit of matrix.units || []) {
  assert(!ids.has(unit.unitId), `duplicate unit ${unit.unitId}`);
  ids.add(unit.unitId);
  assert(['INVENTORIED', 'RESEARCHED', 'AUTHORED', 'SEMANTIC_REVIEWED', 'BROWSER_VERIFIED', 'LIVE_VERIFIED'].includes(unit.coverageState), `${unit.unitId}: invalid coverage state`);
  assert(['RESEARCH_REQUIRED', 'RESEARCH_IN_PROGRESS', 'RESEARCHED'].includes(unit.researchStatus), `${unit.unitId}: invalid research status`);
  assert(['MISSING', 'STRUCTURED_REFERENCE_DRAFT', 'AUTHOR_REVIEWED', 'PUBLISHED_REFERENCE'].includes(unit.articleStatus), `${unit.unitId}: invalid article status`);
}
assert(matrix.counts.units === 423, `total unit count ${matrix.counts.units} !== 423`);
const report = {
  status: failures.length ? 'FAIL' : 'PASS',
  inventory: matrix.counts,
  completionBoundary: 'INVENTORIED_ONLY',
  openResearchUnits: (matrix.units || []).filter((unit) => unit.researchStatus !== 'RESEARCHED').length,
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
