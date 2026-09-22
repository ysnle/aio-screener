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
if (/Promise\.allSettled/.test(installBlock)) fail('install path hides partial failures');
// P1111: a hand-maintained "published runtime registry" sat next to the install
// path — 187 entries, no reader anywhere in the repository, 11 of them pointing at
// files that no longer existed — and this assertion was the only thing that
// referenced it. The registry was removed; the reintroduction guard stays.
if (/PUBLISHED_RUNTIME_ASSETS/.test(source)) fail('the removed published-runtime registry returned to the service worker');
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

// P1112: a cache pattern that names an artifact no client fetches describes a
// cache that never fills — dead configuration that reads as a guarantee. Every
// published artifact named by the cache routing tables must be referenced by a
// client bundle. The reverse gap (artifacts the client does read but the tables
// do not route) is deliberately not asserted here: widening the cache changes
// offline behaviour and needs its own browser evidence.
const routingTables = [
  source.slice(source.indexOf('const DATA_URL_PATTERNS'), source.indexOf('const REFERENCE_URL_PATTERNS')),
  source.slice(source.indexOf('const REFERENCE_URL_PATTERNS'), source.indexOf('// 민감 URL 패턴'))
].join('\n');
const publishedPaths = new Set();
const collect = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { collect(full); continue; }
    if (entry.name.endsWith('.json')) publishedPaths.add(full.replace(/^public-data\//, '').replace(/\.json$/, ''));
  }
};
collect('public-data');
const clientSources = [];
const collectClient = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { collectClient(full); continue; }
    if (/\.(js|html)$/.test(entry.name)) clientSources.push(fs.readFileSync(full, 'utf8'));
  }
};
collectClient('js');
collectClient('src');
clientSources.push(fs.readFileSync('index.html', 'utf8'));
const clientText = clientSources.join('\n');
// The consumer must reference the artifact PATH. Matching a bare name is not
// evidence: `operations-status` appears in a client bundle as the schema string
// `operations-status-v1`, which made an earlier form of this assertion pass while
// the routing table named a file no client ever fetched.
const routedPaths = [...new Set([...routingTables.matchAll(/[a-z0-9][a-z0-9/_-]{3,}/g)].map((match) => match[0]))]
  .filter((token) => publishedPaths.has(token));
const orphanRoutes = routedPaths.filter((name) => !clientText.includes(`public-data/${name}.json`) && !clientText.includes(`./public-data/${name}.json`));
if (orphanRoutes.length) fail(`cache routing names artifacts no client fetches: ${orphanRoutes.join(', ')}`);

// P1173 (06 O03 / W06-C): the reverse gap used to be deliberately unasserted — the
// artifacts every client reads (`data`, `history`, `screener`, the screener universe,
// the model-validation status, the telegram digest) were outside every routing table,
// so a network failure had no last-good path at all. They are now routed through the
// same network-first + age-bounded fallback as other data, with their own TTL, so both
// directions are asserted: routed artifacts have consumers, and consumed core data has
// a route.
const CORE_DATA_ARTIFACTS = ['data', 'history', 'screener', 'screener-universe', 'model-validation-status', 'telegram-digest'];
const coreTable = source.slice(source.indexOf('const CORE_DATA_URL_PATTERNS'), source.indexOf('// 교육·원문 reference artifact'));
if (!coreTable.includes('CORE_DATA_URL_PATTERNS')) fail('core data routing table not found');
// The patterns are written with escaped slashes, so compare against a flattened copy.
const coreTableFlat = coreTable.replace(/\\/g, '');
const unroutedConsumed = CORE_DATA_ARTIFACTS.filter((name) => {
  const path = `public-data/${name}.json`;
  if (!clientText.includes(path) && !clientText.includes(`./${path}`)) return false;
  return !coreTableFlat.includes(`/public-data/${name}.json`);
});
if (unroutedConsumed.length) fail(`client-consumed core data has no offline route: ${unroutedConsumed.join(', ')}`);
if (!/const CORE_DATA_CACHE_TTL = \d+/.test(source)) fail('core data has no declared TTL of its own');
// A model input and a quote must not share one TTL, or "how old may this be served" has
// a single answer for two different meanings.
if (/var ttl = isReference \? REFERENCE_CACHE_TTL : isNews \? NEWS_CACHE_TTL : DATA_CACHE_TTL;/.test(source)) fail('core data silently shares the quote TTL');
if (!/var ttl = isReference \? REFERENCE_CACHE_TTL : isCoreData \? CORE_DATA_CACHE_TTL : isNews \? NEWS_CACHE_TTL : DATA_CACHE_TTL;/.test(source)) fail('core data is not on the declared TTL path');
// The added branch must not become a way around the age bound.
if (!/isData \|\| isNews \|\| isReference \|\| isCoreData/.test(source)) fail('core data does not enter the age-bounded data branch');
// Discriminating opposite direction: the data tables must not capture the shell.
if (coreTableFlat.split('/public-data/').length - 1 !== CORE_DATA_ARTIFACTS.length) {
  fail(`core data table must name exactly ${CORE_DATA_ARTIFACTS.length} public-data artifacts`);
}
if (CORE_DATA_ARTIFACTS.some((name) => !coreTableFlat.includes(`/public-data/${name}.json`))) {
  fail(`core data table does not match: ${CORE_DATA_ARTIFACTS.filter((name) => !coreTableFlat.includes(`/public-data/${name}.json`)).join(', ')}`);
}
if (/javascript|index\.html|aio-core\.js|sw\.js/.test(coreTable)) fail('the core data table must not route shell assets');

console.log(`Service-worker cache policy OK: ${critical.length} critical assets; ${routedPaths.length} routed artifacts all have a client consumer; ${CORE_DATA_ARTIFACTS.length} consumed core artifacts are age-bounded with their own TTL; route modules are request-driven.`);
