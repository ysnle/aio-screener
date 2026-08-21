#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCurrentObservationsArtifact } from '../src/ui/knowledge/current-observations.js';

const path = 'public-data/knowledge/current-observations.json';
const artifact = JSON.parse(fs.readFileSync(path, 'utf8'));
assert.equal(artifact.schema, 'knowledge-current-observations.v1');
assert.equal(artifact.status, 'CONNECTED_WITH_BOUNDARY');
assert.ok(artifact.boundary);
assert.ok(Array.isArray(artifact.observations) && artifact.observations.length >= 8);
assert.equal(validateCurrentObservationsArtifact(artifact), true);
const ids = new Set();
for (const row of artifact.observations) {
  assert.equal(ids.has(row.id), false, `duplicate observation id: ${row.id}`);
  ids.add(row.id);
  assert.ok(row.sourceUrl.startsWith('https://'), `${row.id} source URL must be https`);
  assert.ok(['principles', 'atlas'].every((page) => row.pageTargets.includes(page)), `${row.id} must reach both learning pages`);
  assert.ok(['reference-only', 'current-context'].includes(row.allowedUse), `${row.id} has invalid allowedUse`);
}
console.log(JSON.stringify({ status: 'PASS', observations: artifact.observations.length, pages: ['principles', 'atlas'] }, null, 2));
