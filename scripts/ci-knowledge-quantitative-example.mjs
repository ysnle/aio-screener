#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log(JSON.stringify({ status: 'EXCLUDED_BY_PRODUCT_SCOPE', reason: '퀴즈·연습문제·교육용 정량 랩은 사용자 요청 범위 밖입니다.' }, null, 2));
process.exit(0);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'public-data/knowledge/quantitative-labs.json'), 'utf8'));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
assert(index.labs.length === 15, `lab count ${index.labs.length} !== 15`);
const ids = new Set();
for (const lab of index.labs) {
  assert(!ids.has(lab.labId), `${lab.labId}: duplicate id`); ids.add(lab.labId);
  assert(lab.schemaVersion === 'knowledge-quantitative-lab.v1', `${lab.labId}: schema`);
  assert(typeof lab.formula === 'string' && lab.formula.length > 0, `${lab.labId}: formula`);
  assert(lab.variables.length >= 2, `${lab.labId}: variables`);
  assert(lab.assumptions.length >= 1, `${lab.labId}: assumptions`);
  assert(Array.isArray(lab.workedExample.steps) && lab.workedExample.steps.length >= 2, `${lab.labId}: steps`);
  assert(typeof lab.workedExample.result === 'number', `${lab.labId}: deterministic numeric result`);
  assert(lab.observation.metric && lab.observation.invalidation && lab.observation.missingOrStaleBoundary, `${lab.labId}: observation boundary`);
  assert(lab.status === 'EDUCATIONAL_LAB_DRAFT', `${lab.labId}: status promoted without review`);
  assert(lab.currentnessBoundary.includes('REFERENCE_ONLY'), `${lab.labId}: currentness boundary`);
}
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', labs: index.labs.length, completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
