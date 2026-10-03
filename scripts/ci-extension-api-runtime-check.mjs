// P1422: execute the real optional-provider callers with fixtures, never paid/live APIs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPersonalProviderTransport, _aioFmpStableUrls } from '../src/data/providers/personal-transport.js';
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
vm.runInContext(slice(chat, 'var _QUOTA_LIMITS =', '// SEC EDGAR XBRL'), context);
context._aioFmpStableUrls = _aioFmpStableUrls;
context.window._aioPersonalProviderTransport = createPersonalProviderTransport({ fetch: (...args) => context.fetch(...args), localStorage: context.localStorage, _isQuotaExceeded: (...args) => context._isQuotaExceeded(...args), _bumpApiCounter: (...args) => context._bumpApiCounter(...args), _QUOTA_LIMITS: context._QUOTA_LIMITS });
vm.runInContext(slice(data, 'function fetchWithTimeout(', '// ── v30.11 Task 11:'), context);
let dispatched = [];
context.fetch = async (url, options) => { dispatched.push({ url: String(url), options }); return Response.json([{ symbol: 'AAPL', marketCap: 12, priceToEarningsRatioTTM: 4 }]); };
const result = await context.fetchWithTimeout('https://financialmodelingprep.com/api/v3/ratios-ttm/AAPL?apikey=fixture-key');
assert.equal(new URL(dispatched[0].url).pathname, '/stable/ratios-ttm', 'P1422 legacy FMP callers use current endpoint');
assert.equal(new URL(dispatched[0].url).searchParams.get('symbol'), 'AAPL', 'P1422 ticker identity is preserved');
assert.equal((await result.json())[0].peRatioTTM, 4, 'P1422 documented ratio rename preserves its value');
assert.equal(JSON.parse(context.localStorage.getItem('aio_quota_fmp')).count, 1, 'P1422 FMP attempt counts once');
await context.fetchWithTimeout('public-data/data.json');
assert.equal(dispatched.length, 2, 'P1422 relative non-provider requests still work');
context.localStorage.setItem('aio_quota_fmp', JSON.stringify({ date: new Date().toISOString().slice(0,10), count: 250 }));
assert.equal(await context._fmpFetch('v3/profile/AAPL'), null, 'P1422 FMP local exhausted quota blocks helper');
assert.equal((await context.fetchWithTimeout('https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=x')).status, 429, 'P1422 direct FMP call also obeys quota');
assert.equal(dispatched.length, 2, 'P1422 no exhausted FMP upstream dispatch');
assert.equal((await context.fetchWithTimeout('https://financialmodelingprep.com/api/v3/institutional-holder/AAPL?apikey=x')).status, 422, 'P1422 missing ownership date is not guessed');
context.localStorage.store.clear();
await context.fetchWithTimeout('https://financialmodelingprep.com/api/v3/profile/AAPL,MSFT?apikey=x');
assert.equal(dispatched.length, 4, 'P1422 multi-profile uses supported single-symbol contracts');
assert.equal(JSON.parse(context.localStorage.getItem('aio_quota_fmp')).count, 2, 'P1422 batch counter counts actual dispatches');
context.fetch = async () => Response.json({ 'Error Message': 'plan unavailable' });
assert.equal((await context.fetchWithTimeout('https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=x')).status, 502, 'P1422 HTTP 200 provider error is not a data success');
for (const endpoint of ['income-statement','balance-sheet-statement','cash-flow-statement','ratios','key-metrics','key-metrics-ttm','financial-growth','key-executives','enterprise-values','analyst-estimates','price-target-consensus','discounted-cash-flow','earnings-surprises']) {
  const urls = context._aioFmpStableUrls('https://financialmodelingprep.com/api/v3/' + endpoint + '/MSFT?period=quarter&limit=3&apikey=fixture');
  assert.equal(urls.length, 1, 'P1422 core FMP contract maps: ' + endpoint);
  assert.equal(new URL(urls[0]).searchParams.get('period'), 'quarter', 'P1422 caller reporting period survives mapping');
  assert.equal(new URL(urls[0]).searchParams.get('symbol'), 'MSFT', 'P1422 caller ticker survives mapping');
}

vm.runInContext(slice(data, 'function _aioSetFredRelayConsent(', '// P715:'), context);
context.DATA_APIS = { fred: { key: () => 'personal-fred-fixture-key', base: 'https://api.stlouisfed.org/fred/series/observations' }, twelveData: { key: () => 'td-fixture-key', base: 'https://api.twelvedata.com' } };
vm.runInContext(slice(data, 'async function fetchFredSeries(', '// v47.11: 5개 시리즈'), context);
let relayCalls = [];
context._aioRelayUrl = () => 'https://worker.fixture/relay?provider=fred&series_id=UNRATE';
context._aioRelayFetch = async (url, ms, key) => { relayCalls.push({ url, key }); return Response.json({ observations: [{ value:'4.0', date:'2026-10-01' }] }); };
context.fetchWithTimeout = async () => { throw new Error('fixture CORS unavailable'); };
assert.equal(await context.fetchFredSeries('UNRATE'), null, 'P1422 existing personal keys are not silently sent to the operator');
assert.equal(relayCalls.length, 0, 'P1422 shared personal-key relay requires opt-in');
context._aioSetFredRelayConsent({ checked: true });
assert.equal((await context.fetchFredSeries('UNRATE'))[0].value, '4.0', 'P1422 consented personal query succeeds');
assert.equal(relayCalls[0].key, 'personal-fred-fixture-key', 'P1422 own key is used');
context.DATA_APIS.fred.key = () => '';
assert.equal(await context.fetchFredSeries('UNRATE'), null, 'P1422 missing personal key does not borrow the operator key');
assert.equal(relayCalls.length, 1, 'P1422 no keyless relay dispatch');

vm.runInContext(slice(data, 'function _aioReserveTwelveCredits(', '// v47.10: fetchChartData'), context);
context.localStorage.store.clear();
let tdCalls = 0;
context.fetchWithTimeout = async () => { tdCalls++; return Response.json({ data: [{ rsi: { values: [1] } }] }); };
await context.fetchTechnicalIndicators('AAPL');
assert.equal(JSON.parse(context.localStorage.getItem('aio_quota_twelveData')).count, 6, 'P1422 six batched indicators reserve six weighted credits');
context.localStorage.store.clear();
context.fetchWithTimeout = async () => { tdCalls++; return new Response('', { status: 429 }); };
const before = tdCalls;
await context.fetchTechnicalIndicators('AAPL');
assert.equal(tdCalls - before, 1, 'P1422 provider quota refusal does not trigger six more attempts');
context.localStorage.setItem('aio_quota_twelveData', JSON.stringify({ date: new Date().toISOString().slice(0,10), count: 798 }));
const prior = tdCalls;
await context.fetchTechnicalIndicators('AAPL');
assert.equal(tdCalls, prior, 'P1422 insufficient batch credit prevents dispatch');
assert.equal(JSON.parse(context.localStorage.getItem('aio_quota_twelveData')).count, 798, 'P1422 no reservation for a known undispatched batch');

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
vm.runInContext(slice(data, 'async function fetchNewsDataIO(', '// ═══ 6c.'), context);
context._getApiKey = () => 'news-fixture';
context.fetchWithTimeout = async () => Response.json({ status:'success', results:[{ title:'Fixture NewsData delayed news headline', pubDate:'2026-10-01 12:00:00' }] });
assert.equal((await context.fetchNewsDataIO())[0].providerDelayPolicy, 'plan-dependent-free-12h', 'P1422 NewsData cannot silently claim zero delivery delay');

assert(!/<input[^>]+(?:claude-api-key|openai-api-key|aio_perplexity_key_input)/.test(shell), 'P1422 public UI has no personal AI-key input');
const rssPosition = shell.indexOf('id="rss2json-api-key"');
assert(rssPosition > shell.indexOf('<details class="sidebar-connection-settings"'), 'P1422 RSS personal input is outside operator-only quota area');
assert(shell.includes('공용 연결로 내 FRED 키 조회 허용'), 'P1422 FRED key transfer has visible user consent');
// P1424: migration holds must not advertise a perpetual in-flight health check.
context.window.AIO = { getPublicConfig: () => ({ ai: { routeStatus: 'DISABLED' } }) };
vm.runInContext(slice(ui, 'function getLLMRouteReadiness(', '// P1070/R592:'), context);
assert.equal(context.getLLMRouteReadiness().label, '공용 연결 준비 중', 'P1424 held AI route has an explicit user status');
assert.equal(context.getLLMRouteReadiness().ready, false, 'P1424 held AI route never advertises capacity');
vm.runInContext(slice(chat, 'function _aioClaudeTarget(', 'window._aioClaudeTarget ='), context);
assert.equal(context._aioClaudeTarget(), null, 'P1424 disabled public configuration also blocks the generation transport');
console.log('Extension API runtime PASS: FMP stable/quota/error, personal FRED consent, weighted Twelve Data, RSS priority/fallback, visible personal settings.');
