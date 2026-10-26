// P1422: execute the real optional-provider callers with fixtures, never paid/live APIs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as personalTransport from '../src/data/providers/personal-transport.js';
import { installSharedRoute } from '../src/data/providers/shared-ai-transport.js';
const { createPersonalProviderTransport } = personalTransport;
const data = readFileSync('js/aio-data.js', 'utf8');
const chat = readFileSync('js/aio-chat.js', 'utf8');
const shell = readFileSync('index.html', 'utf8');
const ui = readFileSync('js/aio-ui.js', 'utf8');
const slice = (text, start, end) => {
  const a = text.indexOf(start), b = text.indexOf(end, a);
  assert(a >= 0 && b > a, 'P1422 fixture executes a current function boundary');
  return text.slice(a, b);
};
const context = vm.createContext({ URL, Response, AbortController, Date, console,
  window: {}, T: { COOLDOWN: 1 }, setTimeout, clearTimeout, _aioLog() {},
  _getApiKey: () => 'fixture-personal-key', _aioAppToken: () => '',
  localStorage: { store: new Map(), getItem(k) { return this.store.get(k) || null; }, setItem(k,v) { this.store.set(k,v); } }
});
// v57.81: the P1422 FMP /stable rewrite, payload aliasing, quota counting and Twelve Data credit reservation were
// retired from the transport (no live caller produces those URLs); it keeps only the timeout and caller-abort relay.
context.window._aioPersonalProviderTransport = createPersonalProviderTransport({ fetch: (...args) => context.fetch(...args) });
vm.runInContext(slice(data, 'function fetchWithTimeout(', '// ── v30.11 Task 11:'), context);
assert(!('_aioFmpStableUrls' in personalTransport) && !('_aioNormalizeFmpStable' in personalTransport) && !('reserveTwelveCredits' in context.window._aioPersonalProviderTransport), 'v57.81 the transport exports no FMP mapping or Twelve Data reservation'); // text-pin-ok: retirement absence
let dispatched = [];
context.fetch = async (url, options) => { dispatched.push({ url: String(url), options }); return Response.json({ ok: true }); };
await context.fetchWithTimeout('public-data/data.json');
assert.equal(dispatched.length, 1, 'P1422 relative non-provider requests still work');
assert.equal(dispatched[0].url, 'public-data/data.json', 'v57.81 the transport dispatches the caller URL unchanged');
assert(dispatched[0].options.signal && dispatched[0].options.signal.aborted === false, 'v57.81 the transport attaches its own timeout signal');
{
  const caller = new AbortController();
  let seen = null;
  context.fetch = async (url, options) => { seen = options.signal; caller.abort(); return Response.json({}); };
  await context.fetchWithTimeout('public-data/data.json', { signal: caller.signal });
  assert.equal(seen && seen.aborted, true, 'v57.81 a caller abort reaches the dispatched request');
}
// v57.76: the personal-key FMP/Finnhub fetchers (_fmpFetch, sector compare, deep compare, fundamental report, ticker
// chat blocks) were removed from aio-chat.
assert(!/_fmpFetch|_getApiKey\('aio_(?:fmp|finnhub)_key'\)|financialmodelingprep\.com\/api|finnhub\.io\/api|fetchFinnhub[A-Za-z]*\(|fetchFMP(?:Segments|EarningsCallTranscript)\(/.test(chat), 'v57.76 no personal FMP/Finnhub fetch remains in aio-chat'); // text-pin-ok: asserts removed code is absent

// v57.76: the personal-key FRED query (fetchFredSeries + opt-in relay consent + X-AIO-Provider-Key header), the Twelve Data
// indicator/OHLCV fetchers and the Finnhub WebSocket were removed from aio-data with the retired personal keys. The relay
// helper keeps only the shared app token, and BOK/KOSIS keep their operator-key relay path.
assert(!/function fetchFredSeries\(|function _aioFredRelayConsent\(|aio_fred_relay_consent|X-AIO-Provider-Key/.test(data), 'v57.76 no personal-key FRED query or provider-key relay header remains in aio-data'); // text-pin-ok: asserts removed code is absent
assert(!/function fetchTechnicalIndicators\(|function fetchOHLCV\(|function _aioReserveTwelveCredits\(|https:\/\/api\.twelvedata\.com|initFinnhubWebSocket|wss:\/\/ws\.finnhub\.io/.test(data), 'v57.76 no personal Twelve Data or Finnhub WebSocket path remains in aio-data'); // text-pin-ok: asserts removed code is absent
assert(!/_getApiKey\('aio_(?:bok|kosis|rss2json|newsdata|av|td|fred|finnhub|fmp)_key'\)/.test(data), 'v57.76 aio-data reads no retired personal data key (BOK/KOSIS keep the operator-key relay)'); // text-pin-ok: asserts removed code is absent

context._rssIsSkipped = () => false; context._rssMarkOk = () => {}; context._rssMarkFail = () => {};
context._rss2jsonFailed = 0; context._cfWorkerUrl = () => 'https://worker.fixture';
context.DOMParser = class { parseFromString() { return { querySelectorAll: () => [{ querySelector: selector => ({ textContent: selector === 'title' ? 'Fixture market news headline' : 'fixture' }) }] }; } };
vm.runInContext(slice(data, 'async function fetchOneFeed(', '// ── 텔레그램 메시지에서 원문'), context);
let order = [];
context.fetchViaProxy = async () => { order.push('worker'); return '<rss>' + 'x'.repeat(100) + '</rss>'; };
context.fetchWithTimeout = async url => { order.push(url); return Response.json({ status:'ok', items:[{ title:'Fixture RSS conversion headline' }] }); };
await context.fetchOneFeed({ name:'fixture', url:'https://feed.fixture/rss' });
assert.deepEqual(order, ['worker'], 'P1422 shared Worker RSS succeeds without conversion quota');
order = []; context.fetchViaProxy = async () => { order.push('worker'); throw new Error('fixture worker unavailable'); };
context._getApiKey = () => '';
await context.fetchOneFeed({ name:'fixture', url:'https://feed.fixture/rss' });
assert.equal(order[0], 'worker', 'P1422 Worker precedes fallback');
assert.equal(new URL(order[1]).searchParams.has('count'), false, 'P1422 keyless rss2json uses supported default count');
assert.equal(new URL(order[1]).searchParams.has('api_key'), false, 'P1422 keyless rss2json sends no credential');
// v57.76: the personal NewsData.io and Finnhub news fetchers (and their merge into fetchAllNews) were removed.
assert(!/function fetchNewsDataIO\(|function fetchFinnhub[A-Za-z]*\(|newsdata\.io\/api|_aioPersonalNewsKeys/.test(data), 'v57.76 no personal NewsData/Finnhub news fetcher remains in aio-data'); // text-pin-ok: asserts removed code is absent

assert(!/<input[^>]+(?:claude-api-key|openai-api-key|aio_perplexity_key_input)/.test(shell), 'P1422 public UI has no personal AI-key input');
// v57.67 (owner 2026-10-15): personal data-provider keys are retired; the shell asks for none and the getter never
// returns a stored one, so every path runs on the operator's Actions artifacts or Worker relay.
assert(!/<input[^>]+id="(?:rss2json-api-key|aio_(?:av|finnhub|fred|td|fmp|newsdata|bok|kosis)_key_input)"/.test(shell) && !shell.includes('aio-fred-relay-consent'), 'v57.67 public UI has no personal data-key input'); // text-pin-ok: asserts an input is absent from the shell
{
  const coreSource = readFileSync('js/aio-core.js', 'utf8');
  const keyContext = { _AioVault: { _keyRuntime: { aio_finnhub_key: 'stored', aio_fmp_key: 'stored', aio_cf_worker_url: 'https://worker.fixture' }, getStorage: () => ({ getItem: () => 'stored' }) } };
  vm.createContext(keyContext);
  vm.runInContext(slice(coreSource, 'function _aioIsRetiredDataKey(', '// 마이그레이션: 평문 → 암호화'), keyContext);
  assert(['aio_rss2json_key', 'aio_av_key', 'aio_finnhub_key', 'aio_fred_key', 'aio_td_key', 'aio_fmp_key', 'aio_newsdata_key', 'aio_bok_key', 'aio_kosis_key'].every((key) => keyContext._getApiKey(key) === '')
    && keyContext._getApiKey('aio_cf_worker_url') === 'https://worker.fixture', 'v57.67 retired personal data keys are never read; the self-proxy URL still is');
  assert.equal((await keyContext._aioSaveCredential('aio_fmp_key', 'personal-fixture')).state, 'SERVER_ONLY_DATA', 'v57.67 retired personal data keys cannot be saved again');
  // v57.75: two side doors read retired keys past the getter — DATA_APIS key() via safeLSGetSync and the Vault restore
  // filling the runtime cache. Both now go through the retired-key guard.
  const dataSource = readFileSync('js/aio-data.js', 'utf8');
  assert(!/safeLSGetSync\('aio_(?:av|td|fred|finnhub|fmp|newsdata|bok|kosis|rss2json)_key'\)/.test(dataSource), 'v57.75 DATA_APIS reads provider keys only through _getApiKey'); // text-pin-ok: asserts a bypass call is absent
  const restoreContext = { _AioVault: { _generation: 1, _keyRuntime: {}, lock() {} }, document: { getElementById: () => null }, console: { log() {} }, _aioLog() {},
    safeLSGet: async (key) => (key === 'aio_cf_worker_url' ? 'https://worker.fixture' : 'stored-secret'), _restoreDecryptedPortfolio: async () => {} };
  vm.createContext(restoreContext);
  vm.runInContext(slice(coreSource, 'function _aioIsRetiredDataKey(', '\n'), restoreContext);
  vm.runInContext(slice(coreSource, 'async function _restoreDecryptedKeys(', '\n}\n') + '\n}', restoreContext);
  await restoreContext._restoreDecryptedKeys();
  assert.deepEqual(Object.keys(restoreContext._AioVault._keyRuntime), ['aio_cf_worker_url'], 'v57.75 Vault restore loads no retired personal key into the runtime cache');
  // v57.79: the provider registry (status, backup, import) lists only the self-proxy URL, and boot deletes the
  // stored values of the retired personal keys.
  const registryContext = { window: {}, _AioVault: { _keyRuntime: {}, getStorage: () => ({ getItem: () => '' }) }, safeLSGetSync: () => 'stored' };
  vm.createContext(registryContext);
  vm.runInContext(slice(coreSource, 'var _AIO_PROVIDER_REGISTRY = [', '\nvar _AIO_PROVIDER_BY_KEY'), registryContext);
  vm.runInContext(slice(coreSource, 'window._aioCollectKeySnapshot = function', '\n};\n') + '\n};', registryContext);
  assert.deepEqual(Object.keys(registryContext.window._aioCollectKeySnapshot()), ['aio_cf_worker_url'], 'v57.79 key backup holds only the live self-proxy credential');
  const boot = readFileSync('src/app/bootstrap.js', 'utf8');
  const retiredKeys = ['aio_claude_api_key', 'aio_rss2json_key', 'aio_av_key', 'aio_finnhub_key', 'aio_fred_key', 'aio_td_key', 'aio_fmp_key', 'aio_newsdata_key', 'aio_bok_key', 'aio_kosis_key'];
  const cleanup = boot.slice(boot.indexOf('// v57.79: the personal data-provider keys'), boot.indexOf('const stopConnectionPanel'));
  assert(retiredKeys.every((key) => cleanup.includes(`'${key}'`)) && cleanup.includes('removeItem(key)'), 'v57.79 boot deletes the stored retired personal keys');
}
// P1424: migration holds must not advertise a perpetual in-flight health check.
context.window.AIO = { getPublicConfig: () => ({ ai: { routeStatus: 'DISABLED' } }) };
vm.runInContext(slice(ui, 'function getLLMRouteReadiness(', '// P1070/R592:'), context);
assert.equal(context.getLLMRouteReadiness().label, '공용 연결 준비 중', 'P1424 held AI route has an explicit user status');
assert.equal(context.getLLMRouteReadiness().ready, false, 'P1424 held AI route never advertises capacity');
installSharedRoute(context.window); // v59.11: the route target moved from js/aio-chat.js to the shared transport module
assert.equal(context.window._aioClaudeTarget(), null, 'P1424 disabled public configuration also blocks the generation transport');
console.log('Extension API runtime PASS: plain timeout/abort transport (v57.81), RSS priority/fallback, retired personal data keys and their removed fetchers.');
