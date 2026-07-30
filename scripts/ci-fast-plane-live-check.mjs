import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('architecture/worker-endpoints.json', 'utf8'));
const endpoint = String(process.env.AIO_FAST_QUOTES_URL || config.fastQuotes?.baseUrl || '').replace(/\/+$/, '');
if (!/^https:\/\//i.test(endpoint)) throw new Error('[fast-plane-live] endpoint is not configured');

async function readJson(pathname) {
  const response = await fetch(`${endpoint}${pathname}`, { signal: AbortSignal.timeout(20_000), headers: { accept: 'application/json' } });
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(`[fast-plane-live] ${pathname} HTTP ${response.status}`);
  return { status: response.status, payload };
}

const health = await readJson(config.fastQuotes?.healthPath || '/health');
const quotes = await readJson(config.fastQuotes?.quotesPath || '/quotes');
const coverage = health.payload?.coverage || health.payload?.heartbeat?.coverage || {};
const required = Number(coverage.tier0Required ?? coverage.required);
const observed = Number(coverage.tier0Observed ?? coverage.observed);
if (health.payload?.ok !== true || health.status !== 200 || !Number.isFinite(required) || !Number.isFinite(observed) || observed < required) {
  throw new Error(`[fast-plane-live] health coverage is incomplete: ${JSON.stringify({ status: health.status, coverage })}`);
}
if (quotes.payload?.status !== 'published' || !quotes.payload?.revision || quotes.payload?.coverage?.tier0Observed < quotes.payload?.coverage?.tier0Required) {
  throw new Error(`[fast-plane-live] quotes payload is not a complete published snapshot: ${JSON.stringify({ status: quotes.status, payload: quotes.payload })}`);
}

console.log(JSON.stringify({
  ok: true,
  endpoint,
  healthStatus: health.status,
  quoteStatus: quotes.status,
  revision: quotes.payload.revision,
  coverage: `${observed}/${required}`,
  soak: config.evidence?.fastSoak || 'operator-required'
}));
