import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { throw new Error(`[data-plane-contract] ${message}`); };

const worker = read('worker/data-plane.js');
const wrangler = read('worker/wrangler.example.toml');
const workflow = read('.github/workflows/deploy-data-plane.yml');
const watchdog = read('.github/workflows/data-watchdog.yml');

for (const token of ['scheduled', 'publishQuotes', 'AIO_QUOTES_KV', 'AIO_QUOTES_BUCKET', "'quotes:current'", "'quotes:heartbeat'", 'validateMarketSnapshot', 'tier0Coverage']) {
  if (!worker.includes(token)) fail(`Worker missing ${token}`);
}
for (const token of ['*/5 * * * *', 'AIO_QUOTES_KV_ID', 'AIO_QUOTES_R2_BUCKET']) if (!wrangler.includes(token)) fail(`wrangler example missing ${token}`);
for (const token of ['workflow_dispatch', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'AIO_QUOTES_KV_ID', 'AIO_QUOTES_R2_BUCKET', 'wrangler']) if (!workflow.includes(token)) fail(`deploy workflow missing ${token}`);
for (const token of ['market-snapshot.json', 'market-snapshot-status.json']) if (!watchdog.includes(token)) fail(`watchdog missing ${token}`);
if (/git\s+push/.test(worker)) fail('Worker must not mutate repository state');
if (!/retainedRevision|last-known-good|lastKnownGood/i.test(worker)) fail('Worker does not expose LKG retention');

console.log(JSON.stringify({ ok: true, worker: 'cron+kv+r2', qg: ['QG-01', 'QG-06', 'QG-08'], deploy: 'manual-preflight' }));
