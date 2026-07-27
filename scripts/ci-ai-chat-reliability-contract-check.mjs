// AI chat reliability contract. This is a static gate for the shared
// credential/route/control-plane invariants; it does not call a provider.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };

const core = read('js/aio-core.js');
const chat = read('js/aio-chat.js');
const data = read('js/aio-data.js');
const html = read('index.html');
const worker = read('cloudflare-worker-proxy.js');
const config = json('public-config.json');
const operations = json('public-data/operations-status.json');

for (const key of ['aio_claude_api_key', 'aio_rss2json_key', 'aio_bok_key', 'aio_kosis_key']) {
  check(`provider registry includes ${key}`, core.includes(`credentialKey: '${key}'`));
  check(`sensitive key set includes ${key}`, core.includes(`'${key}'`));
}
check('safeLS returns a write result', core.includes('return { ok: true, key: key, removed: false'));
check('safeLS throws on write failure', /async function safeLS\([\s\S]{0,1800}throw e;/.test(core));
check('credential save performs readback', core.includes('persistence_readback_mismatch') && core.includes('safeLSGet(lsKey, \'\')'));
check('credential save has no plaintext fallback', !/safeLS[\s\S]{0,120}localStorage\.setItem\(lsKey/.test(core));
check('sidebar save waits for result', html.includes('const result = await setApiKey(key);') && html.includes('if (!result || !result.ok)'));
check('legacy getApiKey overload preserves Claude no-arg route', core.includes("var keyName = (name == null || name === '') ? 'aio_claude_api_key' : name") && core.includes("_AioVault._claudeKeyRuntime"));
check('legacy setApiKey overload returns credential result', core.includes("if (arguments.length < 2)") && core.includes("_aioSaveCredential('aio_claude_api_key'") && core.includes("Promise.resolve({ ok: false, state: 'KEYSTORE_UNAVAILABLE' })"));
check('route readiness is explicit', chat.includes("reason: 'NO_ROUTE'") && chat.includes('WORKER_NOT_READY'));
check('public config is personal-key default', config.schemaVersion === 'ai-public-config.v1' && config.ai?.workerUrl === null && config.ai?.serverMode === 'explicit-opt-in');
check('server market prose requires typed evidence before client publish', data.includes('_serverMarketMetricEvidenceValid') && data.includes('metric-evidence-required') && data.includes('_serverMarketSemanticContract'));
check('Worker exposes health readiness', worker.includes("_u.pathname === '/health'") && worker.includes("schemaVersion: 'aio-worker-health.v1'") && worker.includes('ai: { configured'));
check('Worker rolls back failed quota reservations', worker.includes('releaseAnthropicQuota') && worker.includes('quotaReserved'));
check('Worker exposes effective token cap', worker.includes("'X-AIO-Max-Tokens'"));
check('operations status separates scheduled analysis and public chat', operations.ai?.scheduledAnalysis && operations.ai?.publicChat?.scheduledAnalysisDoesNotImplyChat === true);
check('operations status separates five readiness fields', ['secretConfigured', 'workflowWired', 'lastCallSucceeded', 'dataCurrent', 'licensedForUse'].every(field => read('public-data/operations-status.json').includes(`"${field}"`)));

if (errors.length) {
  console.error(`AI chat reliability contract failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log('AI chat reliability contract OK');
