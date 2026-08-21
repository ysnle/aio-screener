#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const bundles = [
  ['coverage', read('public-data/knowledge/coverage-matrix.json').units || []],
  ['research', read('public-data/knowledge/research-dossiers.json').dossiers || []],
  ['domain', read('public-data/knowledge/domain-dossiers.json').dossiers || []]
];
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
for (const [kind, items] of bundles) for (const item of items) {
  const boundary = String(item.currentnessBoundary || item.boundary || '');
  const statusText = JSON.stringify(item);
  assert(boundary.includes('REFERENCE_ONLY') || boundary.includes('reference') || kind === 'research', `${kind}:${item.unitId || item.contentUnitId || item.domainId || item.labId}: missing reference boundary`);
  assert(!/LIVE_VERIFIED/.test(statusText), `${kind}:${item.unitId || item.contentUnitId || item.domainId || item.labId}: live status in generated reference artifact`);
  assert(!/(current market|현재 시장|실시간|현재값|live value)/i.test(statusText) || boundary.length > 0, `${kind}:${item.unitId || item.contentUnitId || item.domainId || item.labId}: current claim without boundary`);
}
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', bundles: bundles.map(([kind, items]) => ({ kind, count: items.length })), quantitativeLabs: 'EXCLUDED_BY_PRODUCT_SCOPE', completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
