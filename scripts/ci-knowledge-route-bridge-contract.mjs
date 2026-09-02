#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKnowledgeRouteBridge, ALLOWED_ROUTES } from '../src/domain/knowledge/route-bridge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'public-data/knowledge/route-targets.json'), 'utf8'));
assert.equal(artifact.counts.articleTargets, 160);
assert.equal(artifact.counts.compatibilityTargets, 39);
assert.equal(artifact.targets.length, 199);
assert.equal(artifact.scenarios.length, 18);
assert.equal(artifact.scenarios.some((scenario) => /mobile|tablet|touch/i.test(String(scenario.persona || ''))), false, 'desktop-only knowledge scenarios must not restore mobile personas');
const bridge = createKnowledgeRouteBridge(artifact.targets);
for (const target of artifact.targets) {
  assert.equal(bridge.resolve(target.articleId)?.articleId, target.articleId);
  if (target.routeId) assert(ALLOWED_ROUTES.has(target.routeId), `unsupported route ${target.routeId}`);
  assert(target.metric && target.timeframe, `${target.articleId}: metric/timeframe context missing`);
  const navigation = bridge.buildNavigation(target.articleId, { returnContext: target.returnContext });
  if (target.routeId) {
    assert.equal(navigation.status, 'ROUTE_TARGET');
    const [routeId, query = ''] = navigation.url.slice(1).split('?');
    const params = new URLSearchParams(query);
    assert.equal(routeId, target.routeId, `${target.articleId}: hash route mismatch`);
    assert.equal(params.get('metric'), target.metric, `${target.articleId}: metric context mismatch`);
    assert.equal(params.get('timeframe'), target.timeframe, `${target.articleId}: timeframe context mismatch`);
    assert.deepEqual(JSON.parse(params.get('return')), target.returnContext, `${target.articleId}: return context mismatch`);
  }
  else assert.equal(navigation.status, 'OVERVIEW_ONLY');
}
assert.equal(artifact.targets.filter((target) => target.articleId.startsWith('principles:') || target.articleId.startsWith('atlas-foundations:')).every((target) => target.status === 'ROUTE_TARGET'), true, 'all 160 primary articles must have a professional route target');
for (const scenario of artifact.scenarios) assert(bridge.resolve(scenario.articleId), `scenario target missing ${scenario.articleId}`);
const mutableTarget = { articleId: 'fixture:immutable', routeId: 'atlas', metric: 'before', timeframe: 'daily' };
const immutableBridge = createKnowledgeRouteBridge([mutableTarget]);
mutableTarget.metric = 'after';
assert.equal(immutableBridge.resolve('fixture:immutable').metric, 'before', 'bridge targets must not retain caller mutation');
const cycle = {}; cycle.self = cycle;
assert.doesNotThrow(() => immutableBridge.buildNavigation('fixture:immutable', { returnContext: cycle }));
assert.equal(new URLSearchParams(immutableBridge.buildNavigation('fixture:immutable', { returnContext: cycle }).url.split('?')[1]).has('return'), false, 'cyclic return context must fail closed');
assert.equal(createKnowledgeRouteBridge('invalid').targets.length, 0, 'scalar target collections must fail closed');
console.log(JSON.stringify({ status: 'PASS', targets: artifact.targets.length, articleTargets: artifact.counts.articleTargets, compatibilityTargets: artifact.counts.compatibilityTargets, routeTargets: artifact.targets.filter((target) => target.routeId).length, overviewOnly: artifact.targets.filter((target) => !target.routeId).length, scenarios: artifact.scenarios.length }, null, 2));
