#!/usr/bin/env node
// Service worker cache policy and the reference-curriculum offline boundary. v58.84 gate consolidation: the sections below were separate gates until v58.84. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('service-worker-cache-policy', [
// ── section cache-policy (was ci-service-worker-cache-policy-check.mjs) ──
['cache-policy', async () => {
const { default: fs } = await import('node:fs');

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

// P1410: behaviour, not text — run the real fetch handler over an in-memory CacheStorage. A copy
// cached under one minute's `?t=` must still answer the next minute's request when the network fails.
{
  const vm = await import('node:vm');
  const stores = new Map();
  const keyOf = (input) => (typeof input === 'string' ? input : input.url);
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return { put: async (req, res) => { store.set(keyOf(req), res.clone()); }, match: async (req) => store.get(keyOf(req))?.clone(), keys: async () => [...store.keys()].map((url) => new Request(url)), delete: async (req) => store.delete(keyOf(req)) };
    },
    async match(req) { for (const store of stores.values()) { const hit = store.get(keyOf(req)); if (hit) return hit.clone(); } return undefined; },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  const handlers = {};
  let online = true;
  const origin = 'https://example.test';
  const self = { addEventListener: (type, fn) => { handlers[type] = fn; }, registration: { scope: `${origin}/aio/` }, location: { origin }, clients: { claim: async () => {} }, skipWaiting: async () => {} };
  const fetchImpl = async () => { if (!online) throw new TypeError('offline'); return new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  vm.runInNewContext(source, { self, caches, fetch: fetchImpl, Request, Response, Headers, URL, console, setTimeout, Date });
  const dispatch = async (url) => {
    let responded; const pending = [];
    handlers.fetch({ request: new Request(url), respondWith: (p) => { responded = p; }, waitUntil: (p) => pending.push(p) });
    const response = await responded;
    await Promise.all(pending);
    return response;
  };
  const first = await dispatch(`${origin}/aio/public-data/data.json?t=100`);
  online = false;
  const sameMinute = await dispatch(`${origin}/aio/public-data/data.json?t=100`);
  const nextMinute = await dispatch(`${origin}/aio/public-data/data.json?t=101`);
  const dataKeys = [...(stores.get([...stores.keys()].find((name) => /data/i.test(name))) || new Map()).keys()];
  if (first.status !== 200 || sameMinute.status !== 200 || nextMinute.status !== 200) fail(`P1410 offline fallback lost across cache-busters: ${first.status}/${sameMinute.status}/${nextMinute.status}`);
  if (dataKeys.some((key) => /[?&]t=/.test(key))) fail(`P1410 data cache keyed by the cache-buster: ${dataKeys.join(', ')}`);
}

// v57.61 (perf): an unchanged 200 (same ETag) is not copied into DATA_CACHE again while the cached copy is
// younger than half its TTL; a changed ETag is. Purge is throttled, not removed.
{
  const vm = await import('node:vm');
  const store = new Map(); let puts = 0;
  const keyOf = (input) => (typeof input === 'string' ? input : input.url);
  const cache = { put: async (req, res) => { puts += 1; store.set(keyOf(req), res.clone()); }, match: async (req) => store.get(keyOf(req))?.clone(), keys: async () => [...store.keys()].map((url) => new Request(url)), delete: async (req) => store.delete(keyOf(req)) };
  const caches = { open: async () => cache, match: async (req) => store.get(keyOf(req))?.clone(), keys: async () => [], delete: async () => true };
  const handlers = {}; let etag = '"a"';
  const origin = 'https://example.test';
  const self = { addEventListener: (type, fn) => { handlers[type] = fn; }, registration: { scope: `${origin}/aio/` }, location: { origin }, clients: { claim: async () => {} }, skipWaiting: async () => {} };
  const fetchImpl = async () => new Response('{"ok":1}', { status: 200, headers: { 'content-type': 'application/json', etag } });
  vm.runInNewContext(source, { self, caches, fetch: fetchImpl, Request, Response, Headers, URL, console, setTimeout, Date });
  const dispatch = async (url) => {
    let responded; const pending = [];
    handlers.fetch({ request: new Request(url), respondWith: (p) => { responded = p; }, waitUntil: (p) => pending.push(p) });
    const response = await responded; await response.text(); await Promise.all(pending);
  };
  const url = `${origin}/aio/public-data/data.json`;
  await dispatch(url); await dispatch(url);
  if (puts !== 1) fail(`v57.61 an unchanged (same ETag) data response was re-copied into DATA_CACHE: ${puts} puts`);
  etag = '"b"'; await dispatch(url);
  if (puts !== 2) fail(`v57.61 a changed ETag did not refresh DATA_CACHE: ${puts} puts`);
  if (!/PURGE_INTERVAL_MS/.test(source) || !/maybePurgeExpiredData\(c\)/.test(source)) fail('v57.61 DATA_CACHE purge is no longer throttled');
}

// P1755: behaviour of the shell branch. A classic script carrying THIS worker's ?v= is served
// cache-first from this version's shell cache; any other ?v= and every unversioned shell asset go
// to the network with HTTP revalidation ('no-cache', never 'no-store'); a version bump renames the
// shell cache, activation deletes the old one, and the new worker re-fetches the versioned script.
{
  const vm = await import('node:vm');
  const run = (workerSource, stores, fetchLog, online) => {
    const keyOf = (input) => (typeof input === 'string' ? input : input.url);
    const caches = {
      async open(name) {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name);
        return { put: async (req, res) => { store.set(keyOf(req), res.clone()); }, match: async (req) => store.get(keyOf(req))?.clone(), keys: async () => [...store.keys()].map((url) => new Request(url)), delete: async (req) => store.delete(keyOf(req)), addAll: async () => {} };
      },
      async match(req) { for (const store of stores.values()) { const hit = store.get(keyOf(req)); if (hit) return hit.clone(); } return undefined; },
      async keys() { return [...stores.keys()]; },
      async delete(name) { return stores.delete(name); }
    };
    const handlers = {};
    const origin = 'https://example.test';
    const self = { addEventListener: (type, fn) => { handlers[type] = fn; }, registration: { scope: `${origin}/aio/` }, location: { origin }, clients: { claim: async () => {} }, skipWaiting: async () => {} };
    const fetchImpl = async (req, init) => {
      if (!online.value) throw new TypeError('offline');
      fetchLog.push({ url: keyOf(req), cache: init?.cache || 'default' });
      return new Response(`body ${fetchLog.length}`, { status: 200, headers: { 'content-type': 'text/javascript' } });
    };
    vm.runInNewContext(workerSource, { self, caches, fetch: fetchImpl, Request, Response, Headers, URL, console, setTimeout, Date });
    const dispatch = async (url) => {
      let responded; const pending = [];
      handlers.fetch({ request: new Request(url), respondWith: (p) => { responded = p; }, waitUntil: (p) => pending.push(p) });
      const response = await responded;
      await Promise.all(pending);
      return { status: response.status, text: await response.text() };
    };
    const activate = async () => { let done; handlers.activate({ waitUntil: (p) => { done = p; } }); await done; };
    return { dispatch, activate };
  };
  const swVersion = source.match(/const SW_VERSION = '(v?[^']+)'/)?.[1];
  if (!swVersion) fail('P1755 SW_VERSION not found');
  const assetVersion = swVersion.replace(/^v/, '');
  const base = 'https://example.test/aio';
  const stores = new Map(); const log = []; const online = { value: true };
  const sw = run(source, stores, log, online);
  const versioned = `${base}/js/aio-core.js?v=${assetVersion}`;
  const first = await sw.dispatch(versioned);
  const second = await sw.dispatch(versioned);
  if (first.status !== 200 || second.text !== first.text || log.filter((entry) => entry.url === versioned).length !== 1) fail('P1755 a current-version classic script is not served cache-first after the first fetch');
  online.value = false;
  if ((await sw.dispatch(versioned)).text !== first.text) fail('P1755 a cached current-version classic script is unavailable offline');
  online.value = true;
  const otherVersion = `${base}/js/aio-core.js?v=0.0`;
  await sw.dispatch(otherVersion); await sw.dispatch(otherVersion);
  if (log.filter((entry) => entry.url === otherVersion).length !== 2) fail('P1755 a classic script with a different ?v= was served cache-first');
  for (const url of [`${base}/index.html`, `${base}/version.json`, `${base}/src/app/bootstrap.js`, `${base}/src/domain/news/stories.js`]) {
    await sw.dispatch(url); await sw.dispatch(url);
    const hits = log.filter((entry) => entry.url === url);
    if (hits.length !== 2) fail(`P1755 an unversioned shell asset is not network-first: ${url}`);
    if (hits.some((entry) => entry.cache !== 'no-cache')) fail(`P1755 an unversioned shell asset is not revalidated with cache:'no-cache': ${url} ${hits.map((entry) => entry.cache).join(',')}`);
  }
  online.value = false;
  if ((await sw.dispatch(`${base}/src/domain/news/stories.js`)).status !== 200) fail('P1755 unversioned shell module lost its offline cache fallback');
  online.value = true;
  // Version bump: a new worker (new SW_VERSION, same ?v= rewritten by bump-version) must not reuse the old cache.
  const bumped = source.replace(`const SW_VERSION = '${swVersion}'`, `const SW_VERSION = '${swVersion}9'`);
  if (bumped === source) fail('P1755 could not derive a bumped worker for the invalidation check');
  const oldShell = [...stores.keys()].find((name) => name.startsWith('aio-shell-'));
  const sw2 = run(bumped, stores, log, online);
  await sw2.activate();
  if (stores.has(oldShell)) fail('P1755 a version bump did not delete the previous versioned shell cache');
  const bumpedUrl = `${base}/js/aio-core.js?v=${assetVersion}9`;
  const before = log.length;
  const fresh = await sw2.dispatch(bumpedUrl);
  if (log.length !== before + 1 || fresh.text === first.text) fail('P1755 the bumped worker served a versioned script without fetching it');
  const staleAfterBump = await sw2.dispatch(versioned);
  if (log.length !== before + 2 || staleAfterBump.text === first.text) fail('P1755 the bumped worker served the previous version cache-first');
  // v57.54 review: a code change shipped under the SAME version must still reach returning readers.
  const rehashed = source.replace("const SW_CODE_HASH = 'local';", "const SW_CODE_HASH = 'c0ffee000001';");
  if (rehashed === source) fail('v57.54 sw.js has no SW_CODE_HASH placeholder for the deploy-time code hash');
  const sameVersionShell = [...stores.keys()].find((name) => name.startsWith('aio-shell-'));
  const sw3 = run(rehashed, stores, log, online);
  await sw3.activate();
  if (stores.has(sameVersionShell)) fail('v57.54 a new code hash under the same version did not retire the previous shell cache');
  const beforeHash = log.length;
  await sw3.dispatch(`${base}/js/aio-core.js?v=${assetVersion}9`);
  if (log.length !== beforeHash + 1) fail('v57.54 a new code hash served a same-version script from the old cache');
}
const deployYml = fs.readFileSync('.github/workflows/pages-deploy.yml', 'utf8');
if (!/code_hash=.*find index\.html js src -type f/.test(deployYml) || !/s\/\^const SW_CODE_HASH = 'local';\$\//.test(deployYml)) fail('v57.54 pages-deploy no longer stamps the shipped-code hash into sw.js');

console.log(`Service-worker cache policy OK: ${critical.length} critical assets; ${routedPaths.length} routed artifacts all have a client consumer; ${CORE_DATA_ARTIFACTS.length} consumed core artifacts are age-bounded with their own TTL; route modules are request-driven.`);
}],
// ── section reference-curriculum (was ci-reference-curriculum-contract-check.mjs) ──
['reference-curriculum', async () => {
const { readFileSync } = await import('node:fs');
const { dirname, join } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const artifact = JSON.parse(read('public-data/principles/reference-curriculum.json'));
const routes = new Set(JSON.parse(read('architecture/golden-routes.json')).routes || []);
const renderer = read('src/ui/knowledge/reference-curriculum.js');
const page = read('src/ui/pages/principles.js');
const chat = read('js/aio-chat.js');
const glossary = read('js/aio-glossary.js');
const serviceWorker = read('sw.js');
const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };

check('schema/status/publication boundary', artifact.schemaVersion === 'market-learning-curriculum.v1' && artifact.status === 'REFERENCE_CONNECTED' && artifact.publication === 'EDUCATIONAL_REFERENCE_ONLY');
check('boundary excludes securities, prices, targets, forecasts and instructions', /특정 종목/.test(artifact.boundary) && /가격/.test(artifact.boundary) && /목표가/.test(artifact.boundary) && /전망/.test(artifact.boundary) && /매매 지시/.test(artifact.boundary));
check('six-step decision loop is stable', JSON.stringify((artifact.decisionLoop || []).map((item) => item.id)) === JSON.stringify(['claim', 'evidence', 'response', 'exposure', 'invalidation', 'journal']));
check('0~10 stage sequence is complete', artifact.stages?.length === 11 && artifact.stages.every((stage, index) => stage.number === index && stage.id === `stage-${String(index).padStart(2, '0')}`));

const sources = new Map((artifact.sourceNotes || []).map((source) => [source.id, source]));
check('nine unique public article sources', sources.size === 9 && [...sources.values()].every((source) => /^https:\/\/x\.com\/blazingbees\/status\/\d+$/.test(source.url)));
const lessons = (artifact.stages || []).flatMap((stage) => stage.lessons || []);
check('every stage has questions and lessons', artifact.stages?.every((stage) => stage.questions?.length >= 2 && stage.lessons?.length >= 1));
check('every lesson has observable framework/mechanism/invalidation', lessons.every((lesson) => lesson.id && lesson.title && lesson.framework && lesson.mechanism && lesson.invalidation));
check('every lesson source resolves', lessons.every((lesson) => lesson.sourceIds?.length && lesson.sourceIds.every((sourceId) => sources.has(sourceId))));
check('every route bridge resolves and carries metric/timeframe', lessons.every((lesson) => routes.has(lesson.routeTarget?.routeId) && lesson.routeTarget?.metric && lesson.routeTarget?.timeframe));

const forbiddenKeys = new Set(['price', 'targetPrice', 'forecast', 'brokerTiming', 'leverageThreshold', 'signal', 'ticker', 'symbol', 'recommendation']);
const keyStack = [artifact];
let forbiddenKey = null;
while (keyStack.length && !forbiddenKey) {
  const value = keyStack.pop();
  if (!value || typeof value !== 'object') continue;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) { forbiddenKey = key; break; }
    keyStack.push(child);
  }
}
check('artifact has no live/trade payload fields', forbiddenKey === null);

check('renderer uses safe text and external-link boundaries', /textContent/.test(renderer) && /applySafeExternalLink/.test(renderer) && !/innerHTML/.test(renderer));
check('renderer exposes tab and selection semantics', /role', 'tablist'/.test(renderer) && /role', 'tab'/.test(renderer) && /aria-selected/.test(renderer) && /aria-pressed/.test(renderer));
check('renderer route bridge delegates navigation', /onNavigate\(lesson\.routeTarget\)/.test(renderer));
check('page lazy-loads and reports curriculum capability', /REFERENCE_CURRICULUM_URL/.test(page) && /ensureLibraryCapabilities/.test(page) && /aioPrinciplesReferenceCurriculum/.test(page) && /activeReferenceStageId/.test(page));
// P1111 removed the service worker's 184-entry runtime registry (no reader, 11
// entries pointing at files that no longer existed). Offline ownership of a
// runtime module is granted by the request-driven shell rule, not by an
// enumeration entry, so the guarantee this check protects is that `/js` and
// `/src` requests are runtime-cached.
check('service worker owns the renderer module', /RUNTIME_SHELL_PATH_RE/.test(serviceWorker) && /isRuntimeShell/.test(serviceWorker) && serviceWorker.includes('(?:js|src)'));
check('chat context keeps the framework in REFERENCE lane', /AIO_MARKET_LEARNING_REFERENCE/.test(chat) && /sourceKind:\s*'REFERENCE'/.test(chat) && /가설 → 증거 → 시장 반응 → 포지션 크기 → 무효화 → 복기/.test(chat) && /never as live market data or a trade instruction/.test(chat));
check('glossary contains the integrated educational vocabulary', ['예측보다 대응', '논점 무효화', '주도주', '에코챔버', '지수 바스켓', '반대매매'].every((term) => glossary.includes(term)));

if (errors.length) {
  console.error('Reference curriculum contract failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, stages: artifact.stages.length, lessons: lessons.length, sources: sources.size, routes: new Set(lessons.map((lesson) => lesson.routeTarget.routeId)).size, publication: artifact.publication }));
}],
]);
