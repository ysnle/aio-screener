import fs from 'node:fs';

const source = fs.readFileSync('sw.js', 'utf8');
const fail = (message) => { throw new Error(`[sw-cache-policy] ${message}`); };
const block = source.match(/const CRITICAL_SHELL_ASSETS = \[([\s\S]*?)\n\];/)?.[1] || '';
const critical = [...block.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
if (!critical.length || critical.length > 12) fail(`critical precache count must be 1..12, got ${critical.length}`);
if (critical.some((asset) => /^https?:\/\//.test(asset))) fail('external CDN assets must not block service-worker install');
for (const required of ['./', './index.html', './version.json', './src/app/bootstrap.js']) {
  if (!critical.includes(required)) fail(`critical asset missing: ${required}`);
}
const installBlock = source.slice(source.indexOf("self.addEventListener('install'"), source.indexOf("self.addEventListener('activate'"));
if (!/cache\.addAll\(CRITICAL_SHELL_ASSETS\)/.test(installBlock)) fail('critical assets are not installed atomically');
if (/Promise\.allSettled|PUBLISHED_RUNTIME_ASSETS/.test(installBlock)) fail('install path still fans out to the full runtime registry or hides partial failures');
if (!/RUNTIME_SHELL_PATH_RE/.test(source) || !/isRuntimeShell/.test(source)) fail('requested js/src modules are not runtime cached');

// P1086: TTL was enforced only by purge-on-write, so the network-failure fallback
// returned `caches.match(...)` regardless of age and an offline client could be
// served arbitrarily old market data as if it were current. The read path must
// bound the age itself and must not silently return an expired entry.
const dataFallback = source.slice(source.indexOf('const isData = DATA_URL_PATTERNS'));
if (!dataFallback) fail('data cache branch not found');
if (!/cachedWithinMaxAge\(request, isReference\)/.test(dataFallback)) fail('data/news/reference fallback does not apply the maximum-age bound');
if (!/if \(entry\.stale\) return staleResponse\(/.test(dataFallback)) fail('data fallback can still return an expired cache entry');
if (!/STALE_MAX_AGE_MULTIPLIER/.test(source)) fail('data/news cache fallback has no maximum-age multiplier');
if (!/REFERENCE_MAX_AGE_MS/.test(source)) fail('reference cache fallback has no absolute maximum age');
if (!/_stale:\s*true/.test(source)) fail('a stale cache response is indistinguishable from a current one');
if (!/x-cache-time/.test(source) || !/x-cache-ttl/.test(source)) fail('cache entries do not carry the timestamp/ttl headers the age bound needs');

console.log(`Service-worker cache policy OK: ${critical.length} critical assets; route modules are request-driven.`);
