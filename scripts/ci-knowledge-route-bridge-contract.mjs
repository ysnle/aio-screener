#!/usr/bin/env node

// v58.51: the route-bridge facade (src/domain/knowledge/route-bridge.js) had no product caller and was removed. This gate now
// checks the published route-targets artifact itself against the live route registry (src/app/routes.js).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRouteId } from '../src/app/routes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'public-data/knowledge/route-targets.json'), 'utf8'));
assert.equal(artifact.counts.articleTargets, 188);
assert.equal(artifact.counts.compatibilityTargets, 39);
assert.equal(artifact.targets.length, 227);
assert.equal(artifact.scenarios.length, 18);
assert.equal(artifact.scenarios.some((scenario) => /mobile|tablet|touch/i.test(String(scenario.persona || ''))), false, 'desktop-only knowledge scenarios must not restore mobile personas');
const byArticle = new Map(artifact.targets.map((target) => [target.articleId, target]));
assert.equal(byArticle.size, artifact.targets.length, 'route targets must have unique article ids');
for (const target of artifact.targets) {
  if (target.routeId) assert(isRouteId(target.routeId), `unsupported route ${target.routeId}`);
  assert(target.metric && target.timeframe, `${target.articleId}: metric/timeframe context missing`);
}
assert.equal(artifact.targets.filter((target) => target.articleId.startsWith('principles:') || target.articleId.startsWith('atlas-foundations:')).every((target) => target.status === 'ROUTE_TARGET'), true, 'all 160 primary articles must be route targets');
assert.equal(artifact.targets.filter((target) => target.articleId.startsWith('nathan-frameworks:')).length, 28, 'all Nathan framework articles must have route targets');
for (const scenario of artifact.scenarios) assert(byArticle.has(scenario.articleId), `scenario target missing ${scenario.articleId}`);
console.log(JSON.stringify({ status: 'PASS', targets: artifact.targets.length, articleTargets: artifact.counts.articleTargets, compatibilityTargets: artifact.counts.compatibilityTargets }, null, 2));
