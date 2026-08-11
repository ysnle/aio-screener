#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKnowledgeRouteBridge, ALLOWED_ROUTES } from '../src/domain/knowledge/route-bridge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'public-data/knowledge/route-targets.json'), 'utf8'));
assert.equal(artifact.counts.articleTargets, 159);
assert.equal(artifact.counts.compatibilityTargets, 39);
assert.equal(artifact.targets.length, 198);
assert.equal(artifact.scenarios.length, 20);
const bridge = createKnowledgeRouteBridge(artifact.targets);
for (const target of artifact.targets) {
  assert.equal(bridge.resolve(target.articleId)?.articleId, target.articleId);
  if (target.routeId) assert(ALLOWED_ROUTES.has(target.routeId), `unsupported route ${target.routeId}`);
  const navigation = bridge.buildNavigation(target.articleId, { returnContext: target.returnContext });
  if (target.routeId) assert.equal(navigation.status, 'ROUTE_TARGET');
  else assert.equal(navigation.status, 'OVERVIEW_ONLY');
}
for (const scenario of artifact.scenarios) assert(bridge.resolve(scenario.articleId), `scenario target missing ${scenario.articleId}`);
console.log(JSON.stringify({ status: 'PASS', targets: artifact.targets.length, articleTargets: artifact.counts.articleTargets, compatibilityTargets: artifact.counts.compatibilityTargets, routeTargets: artifact.targets.filter((target) => target.routeId).length, overviewOnly: artifact.targets.filter((target) => !target.routeId).length, scenarios: artifact.scenarios.length }, null, 2));
