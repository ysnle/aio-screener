#!/usr/bin/env node
// P1421: changing a model must not leave an unmetered paid-AI path behind.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { derivePublicAiConfig, reuseWorkerHealthEvidence } from './build-operations-status.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const check = (name, passed) => { if (!passed) failures.push(name); };
function sources(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sources(path) : /\.(?:js|mjs|yml)$/.test(path) ? [path] : [];
  });
}
const production = [
  ...sources('js'), ...sources('src'), ...sources('.github/workflows'),
  'scripts/fetch-data.mjs', 'scripts/lib/ai-shared-analysis.mjs'
];
for (const path of production) {
  const text = read(path);
  check(`P1421 ${path}: retired AI provider cannot receive production calls`, !/api\.anthropic\.com|api\.perplexity\.ai|ANTHROPIC_API_KEY/.test(text));
  check(`P1421 ${path}: OpenAI calls must go through the metered Worker`, !/api\.openai\.com/.test(text));
}
const worker = read('cloudflare-worker-proxy.js');
const { classifyWorkerDeployChanges } = await import('./worker-deploy-impact.mjs');
for (const path of ['worker/openai-budget.mjs', 'worker/openai-usage.mjs']) {
  check(`P1421 ${path}: deploy impact includes imported pricing and receipt code`, classifyWorkerDeployChanges([path]).aiProxy === true);
}
check('P1421 one canonical OpenAI upstream exists in the Worker', (worker.match(/https:\/\/api\.openai\.com\/v1\/responses/g) || []).length === 1);
check('P1421 retired Anthropic upstream is absent', !worker.includes('api.anthropic.com'));
const actions = read('.github/workflows/refresh-data.yml');
check('P1421 Actions receives automation authentication rather than a provider key', actions.includes('AIO_AUTOMATION_TOKEN') && !actions.includes('OPENAI_API_KEY'));
const config = JSON.parse(read('public-config.json'));
check('P1421 public AI configuration cannot fall back to a personal key', config.ai?.chatPolicy === 'shared-worker-only' && config.ai?.serverMode === 'shared-worker-only' && config.ai?.provider === 'openai' && config.ai?.model === 'gpt-6-luna');

// P1421: real producer functions are imported without running a data refresh.
const now = '2026-10-03T01:00:00.000Z';
const endpoint = 'https://worker.example';
const evidence = { proxyAiProvider: 'openai', proxyAiModel: 'gpt-6-luna', proxyHealthStatus: 200, proxyHealthObserved: now, proxyObservationStatus: 'SUCCESS' };
const derive = options => derivePublicAiConfig({}, { workerEndpoint: endpoint, appRevision: 'fixture', now, proxyHealthy: true, proxyEvidence: evidence, ...options });
assert.equal(derive({}).ai.routeStatus, 'PUBLISHED', 'P1421 matching OpenAI health can publish a route');
for (const incompatible of [{}, { ...evidence, proxyAiProvider: 'anthropic' }, { ...evidence, proxyAiModel: 'another-model' }]) {
  const held = derive({ proxyEvidence: incompatible });
  assert.equal(held.ai.routeStatus, 'DISABLED', 'P1421 another provider cannot certify migration');
  assert.equal(held.ai.chatPolicy, 'shared-worker-only', 'P1421 failure cannot enable an unmetered key');
}
const offline = derive({ proxyHealthy: false, proxyEvidence: { proxyObservationStatus: 'FAILED' } });
assert.equal(offline.ai.routeReason, 'WORKER_HEALTH_UNAVAILABLE', 'P1421 failure evidence is retained');
assert.equal(offline.marketData.workerUrl, endpoint, 'P1421 AI migration cannot disable independent data relay');
const carried = reuseWorkerHealthEvidence({ ai: { publicChat: { health: { provider: 'openai', model: 'gpt-6-luna', observedAt: now, statusCode: 200 } } } }, now);
assert.equal(carried.proxyAiProvider, 'openai', 'P1421 cached health retains provider identity');
assert.equal(carried.proxyAiModel, 'gpt-6-luna', 'P1421 cached health retains model identity');
if (failures.length) {
  console.error(`AI budget scope failed:\n${failures.map(value => ` - ${value}`).join('\n')}`);
  process.exit(1);
}
console.log(`P1421 AI budget scope: ${production.length} production sources and provider migration fixtures passed.`);
