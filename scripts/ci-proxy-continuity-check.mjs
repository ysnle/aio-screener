#!/usr/bin/env node
// Executes the real transport functions offline; no browser/network required.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../js/aio-data.js', import.meta.url), 'utf8');
// v59.22: the relay transport moved to src/data/providers/proxy-transport.js; the harness runs its installer.
const transport = readFileSync(new URL('../src/data/providers/proxy-transport.js', import.meta.url), 'utf8').replace('export function installProxyTransport', 'function installProxyTransport');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// P1132/R619: the inline Yahoo chart helper moved from index.html's block F into js/aio-ui.js.
const ui = readFileSync(new URL('../js/aio-ui.js', import.meta.url), 'utf8');
const section = (text, a, b) => {
  const start = text.indexOf(a), end = text.indexOf(b, start);
  assert(start >= 0 && end > start, `Missing boundary ${a}`);
  return text.slice(start, end);
};
let checks = 0;
function check(value, name) { assert(value, name); checks++; console.log(`PASS ${name}`); }
function harness({ fetcher, personal = '', clock = Date.now() } = {}) {
  const store = new Map(), calls = [], events = new Map();
  let now = clock;
  const root = {
    URL, Response, AbortController, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return now; } },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    T: { COOLDOWN: 60000, FETCH_TIMEOUT:100 }, _aioLog() {},
    _getApiKey: () => personal,
    AIO_PUBLIC_CONFIG: { marketData:{ workerUrl:'https://owned.example' } },
    addEventListener: (type, callback) => events.set(type, callback),
    localStorage: { getItem:key=>store.get(key)||null, setItem:(key,value)=>store.set(key,value), removeItem:key=>store.delete(key), key:i=>[...store.keys()][i], get length(){return store.size;} },
    fetch: async (...args) => { calls.push(args); return fetcher ? fetcher(...args) : new Response('unavailable', {status:503}); }
  };
  root.window = root;
  const context = vm.createContext(root);
  vm.runInContext(transport + '\ninstallProxyTransport(window);\nwindow.registry = window._PROXY_REGISTRY;', context);
  return { root, context, store, calls, events, advance:ms=>{now+=ms;} };
}
const chart = (symbol='NVDA', interval='1d') => ({chart:{result:[{meta:{symbol,dataGranularity:interval,regularMarketPrice:124,regularMarketTime:1787918400},timestamp:[1787918400],indicators:{quote:[{open:[123],high:[125],low:[122],close:[124],volume:[100]}]}}]}});
const url = (symbol='NVDA', interval='1d', range='1y') => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
const h = harness();
const urls = [url(), url('AAPL'), url('SPY'), url('NVDA','1mo','5y'), url('^GSPC'), url('005930.KS'), url('NVDA','1d','5y')];
check(new Set(urls.map(h.root._aioProxyCacheKey)).size === urls.length, 'ticker, interval, range and encoded symbol cache identities never collide');
const oldKey = u=>'aio_proxy_cache_'+Buffer.from(u.slice(0,150),'binary').toString('base64').replace(/[^A-Za-z0-9]/g,'').substring(0,64);
check(oldKey(url()) === oldKey(url('AAPL')), 'negative control reproduces the retired cross-ticker collision');
h.store.set(oldKey(url()), JSON.stringify({body:JSON.stringify(chart()),ts:Date.now()}));
check(h.root._aioProxyReadCache(url('AAPL')) === null, 'ambiguous legacy cache is never migrated or trusted');
h.root.registry.list = [];
h.root._aioProxyWriteCache({schema:2,url:url(),body:JSON.stringify(chart()),collectedAt:h.root.Date.now(),provider:'fixture'});
await assert.rejects(h.root.fetchViaProxy(url(),{parseJson:true}),/연결 실패/);
checks++; console.log('PASS live consumers do not silently receive stale cache');
const cached = await h.root.fetchViaProxy(url(),{parseJson:true,allowStale:true});
check(cached.chart.result[0].meta.symbol==='NVDA' && cached._aioTransport.stale && cached._aioTransport.collectedAt===h.root.Date.now(), 'explicit research fallback keeps identity, original collection time and per-response stale provenance');
await assert.rejects(h.root.fetchViaProxy(url('AAPL'),{parseJson:true,allowStale:true}));
checks++; console.log('PASS AAPL request cannot retrieve NVDA cache');
h.store.set(h.root._aioProxyCacheKey(url('AAPL')), JSON.stringify({schema:2,url:url('AAPL'),body:JSON.stringify(chart()),collectedAt:h.root.Date.now(),provider:'fixture'}));
await assert.rejects(h.root.fetchViaProxy(url('AAPL'),{parseJson:true,allowStale:true}));
checks++; console.log('PASS payload identity is checked even with a corrupted exact-key cache');
h.advance(21600001);
check(h.root._aioProxyReadCache(url())===null,'expired cache is not usable');
h.advance(-21600002);
check(h.root._aioProxyReadCache(url())===null,'future-dated cache is not usable');

const good = harness({fetcher:async()=>new Response(JSON.stringify({contents:JSON.stringify(chart())}),{headers:{'Content-Type':'application/json'}})});
const result = await good.root.fetchViaProxy(url(),{parseJson:true});
check(good.calls.length===1 && good.calls[0][0].startsWith('https://owned.example?url='), 'fresh browser uses configured data Worker first');
check(result.chart.result[0].meta.symbol==='NVDA' && !result._aioTransport.stale, 'wrapped network JSON is normalized with network provenance');
good.root.registry.list=[];
const normalized = await good.root.fetchViaProxy(url(),{parseJson:true,allowStale:true});
check(normalized.chart.result && !normalized.contents, 'cached wrapper is normalized identically to network response');
for (let i=0;i<40;i++) good.root._aioProxyWriteCache({schema:2,url:`https://example.org/${i}`,body:'ok',collectedAt:Date.now(),provider:'fixture'});
check([...good.store.keys()].filter(key=>key.startsWith('aio_proxy_v2_')).length<=32,'cache retention is bounded');
const wrong = harness({fetcher:async()=>new Response(JSON.stringify(chart('SPY')))});
await assert.rejects(wrong.root.fetchViaProxy(url('AAPL'),{parseJson:true}));
check(wrong.store.size===0,'wrong-symbol upstream payload never enters cache');
const wrongInterval = harness({fetcher:async()=>new Response(JSON.stringify(chart('NVDA','1d')))});
await assert.rejects(wrongInterval.root.fetchViaProxy(url('NVDA','1mo'),{parseJson:true}));
check(wrongInterval.store.size===0,'wrong-interval upstream payload never enters cache');
const xml = '<rss><channel><item><title>fixture</title></item></channel></rss>';
const rss = harness({fetcher:async()=>new Response(JSON.stringify({contents:xml}))});
check(await rss.root.fetchViaProxy('https://example.org/feed.xml',{parseText:true})===xml,'RSS wrappers are unwrapped by the same transport');
const malformed = harness({fetcher:async()=>new Response('<html>blocked</html>')});
await assert.rejects(malformed.root.fetchViaProxy(url(),{parseJson:true}));
check(malformed.store.size===0,'HTML block pages never enter the JSON cache');

const b = harness();
const reg=b.root.registry, proxy=reg.list[0];
for(let i=0;i<10;i++) reg.markFail(proxy.id,'fixture',url());
const bucket=reg.state(proxy,url());
check(bucket.cooldownLevel===1 && bucket.retryAt===b.root.Date.now()+60000,'concurrent failure burst opens one cooldown, not eight accumulating timers');
check(!reg.getActive(url()).includes(proxy) && reg.getActive('https://fred.stlouisfed.org/graph.csv').includes(proxy),'one upstream outage cannot disable unrelated upstreams');
b.advance(60000);
check(reg.claim(proxy,url()) && !reg.claim(proxy,url()),'half-open recovery allows exactly one probe');
reg.markFail(proxy.id,'fixture',url());
check(bucket.cooldownLevel===2 && bucket.retryAt===b.root.Date.now()+120000,'failed probe advances backoff once');
b.advance(120000); reg.claim(proxy,url()); reg.markOk(proxy.id,url());
check(!bucket.disabled && bucket.cooldownLevel===0 && bucket.retryAt===0,'successful probe fully closes the circuit');
reg.markFail(proxy.id,429,url(),300000);
check(bucket.retryAt===b.root.Date.now()+300000,'Retry-After is respected');
reg.init();
check(reg.state(reg.list[0],url()).retryAt===bucket.retryAt,'configuration reload preserves health for an unchanged endpoint');
for(let i=0;i<8;i++) check(reg.getRotated('https://example.org/')[0].id==='cf-worker',`owned route remains first on lookup ${i+1}`);
const missing = harness({fetcher:async()=>new Response('',{status:404})});
await assert.rejects(missing.root.fetchViaProxy(url(),{parseJson:true}));
check(missing.root.registry.list.every(p=>missing.root.registry.state(p,url()).fails===0),'missing ticker does not poison relay health');
// P1758: a definitive upstream answer relayed by the Worker ends the chain; only a relay fault reaches a public relay.
check(missing.calls.length===1 && missing.calls[0][0].startsWith('https://owned.example?url='), 'P1758 a Worker-relayed upstream 404 never fans out to public relays');
const verdict = harness({fetcher:async()=>new Response(JSON.stringify(chart('SPY')))});
await assert.rejects(verdict.root.fetchViaProxy(url('AAPL'),{parseJson:true}),{code:'UPSTREAM_REJECTED'});
check(verdict.calls.length===1 && verdict.root.registry.state(verdict.root.registry.list[0],url('AAPL')).fails===0, 'P1758 a wrong-identity JSON answer from the Worker stops the chain without marking the Worker failed');
const fault = harness({fetcher:async(u)=>u.startsWith('https://owned.example') ? new Response('',{status:503}) : new Response(JSON.stringify(chart()))});
check((await fault.root.fetchViaProxy(url(),{parseJson:true}))._aioTransport.provider==='allorigins-raw' && fault.calls.length===2, 'P1758 a Worker 503 still falls back to exactly one public relay');
const krData1758 = readFileSync(new URL('../js/aio-kr-data.js', import.meta.url), 'utf8');
const core1758 = readFileSync(new URL('../js/aio-core.js', import.meta.url), 'utf8');
const quotes1758 = section(source, 'async function fetchLiveQuotes(', 'function scheduleQuoteCrossSourceValidation(');
check(/v7\/finance\/spark\?symbols=/.test(quotes1758) && /i \+= 20\)/.test(quotes1758) && !/yahoo\.com\/v7\/finance\/quote/.test(quotes1758) && /function _yfQuoteFromMeta\(/.test(quotes1758), 'P1758 quote polling batches 20 symbols per spark request through the relay chain (v7/quote needs a crumb and 401s)');
check(quotes1758.indexOf('const _PRICE_RULES') < quotes1758.indexOf('await _yfBatchFetch('), 'P1758 the batch runs after the price rules it validates against are initialised');
check(!/codetabs\.com|allorigins\.win|corsproxy\.io|proxy\.cors\.sh|Promise\.any/.test(section(krData1758, 'async function dynamicTickerLookup(', '// 한국 종목: siseJson 폴백')) && !/corsproxy\.io\/\?'|allorigins\.win\/raw\?url='/.test(core1758), 'P1758 ticker lookup and SEC submissions use the relay chain, not a public-relay race or list');

const controller=new AbortController();
const cancel=harness({fetcher:async(_,options)=>new Promise((resolve,reject)=>{
  options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('cancel'),{name:'AbortError'})),{once:true});
  controller.abort();
})});
await assert.rejects(cancel.root.fetchViaProxy(url(),{parseJson:true,signal:controller.signal}),{name:'AbortError'});
check(cancel.root.registry.list.every(p=>cancel.root.registry.state(p,url()).fails===0),'caller cancellation is not a provider failure');
const privateRequest=harness();
await assert.rejects(privateRequest.root.fetchViaProxy('https://example.org/api?api_key=fixture-secret',{parseJson:true}),{code:'PRIVATE_ROUTE_REQUIRED'});
check(privateRequest.calls.length===0 && privateRequest.store.size===0,'credential-bearing requests never reach public relays or persistent cache');

// P1756: the client mirror of the Worker allowlist must equal ALLOWED_DOMAINS, and a host outside it never reaches
// the shared Worker (it answered 403 to every client RSS feed host), while a Worker the user owns is still tried.
const worker = readFileSync(new URL('../cloudflare-worker-proxy.js', import.meta.url), 'utf8');
const workerHosts = [...section(worker, 'const ALLOWED_DOMAINS = [', '];').matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
const clientHosts = [...vm.runInContext('_AIO_SHARED_WORKER_HOSTS', h.context)].sort();
check(workerHosts.length > 20 && JSON.stringify(workerHosts) === JSON.stringify(clientHosts), 'P1756 client shared-Worker host mirror equals the Worker ALLOWED_DOMAINS');
// v57.81: retired personal-key and dead-fallback providers have no browser path through the Worker, so neither list relays them.
const retiredRelayHosts = ['www.alphavantage.co', 'api.twelvedata.com', 'finnhub.io', 'api.stlouisfed.org', 'financialmodelingprep.com', 'newsdata.io', 'stooq.com', 'www.stooq.com', 'nitter.net'];
check(retiredRelayHosts.every((host) => !workerHosts.includes(host) && !h.root._aioSharedWorkerRelays('https://' + host + '/x')), 'v57.81 retired provider hosts are out of the Worker allowlist and its client mirror'); // text-pin-ok: retirement absence
check(h.root._aioSharedWorkerRelays('https://query1.finance.yahoo.com/v8/finance/chart/NVDA') && h.root._aioSharedWorkerRelays('https://sub.rsshub.app/x')
  && !h.root._aioSharedWorkerRelays('https://feeds.a.dj.com/rss/RSSMarketsMain.xml') && !h.root._aioSharedWorkerRelays('https://notrsshub.app/x'), 'P1756 allowlist matching is exact host or subdomain');
const feedXml = '<rss><channel><item><title>fixture feed headline</title></item></channel></rss>';
const shared = harness({fetcher:async()=>new Response(feedXml)});
check(await shared.root.fetchViaProxy('https://feeds.a.dj.com/rss/RSSMarketsMain.xml',{parseText:true})===feedXml
  && shared.calls.every(([u])=>!u.startsWith('https://owned.example')), 'P1756 a feed host outside the allowlist goes straight past the shared Worker');
const owned = harness({personal:'https://mine.example', fetcher:async()=>new Response(feedXml)});
await owned.root.fetchViaProxy('https://feeds.a.dj.com/rss/RSSMarketsMain.xml',{parseText:true});
check(owned.calls[0][0].startsWith('https://mine.example?url='), 'P1756 a Worker the user owns is still tried for any host');
// P1756: the browser RSS run is skipped while data.json news is fresh (< 2 h) — the screens render that bundle either way.
const fresh = vm.createContext({ Date, isFinite, window:{}, DATA_APIS:{ finnhub:{ key:()=>'' } }, _getApiKey:()=>'' });
vm.runInContext(section(source, 'function _aioServerNewsFresh()', 'async function fetchAllNews('), fresh);
const freshAt = (ms) => { fresh.window._serverNewsBackstop=[{title:'x'}]; fresh.window._serverDataMeta={generatedAt:new Date(Date.now()-ms).toISOString()}; return fresh._aioServerNewsFresh(); };
check(freshAt(30*60000) && !freshAt(3*3600000) && (fresh.window._serverNewsBackstop=[], !fresh._aioServerNewsFresh()), 'P1756 server news is fresh only when present and generated under 2 hours ago');
const fetchAll = section(source, 'async function fetchAllNews(', '// P1601: retain distinct articles');
// v57.76: the personal Finnhub/NewsData merge was removed, so a fresh server bundle always ends the run at the top.
check(/if \(_serverNewsFresh\) \{[\s\S]{0,480}return;/.test(fetchAll) && /if \(forceRefresh && typeof showToast === 'function'\) showToast\('뉴스는 서버가 /.test(fetchAll) && !/_aioPersonalNewsKeys|fetchFinnhubNewsFormatted|fetchNewsDataIO/.test(fetchAll), 'P1756 fetchAllNews skips the feed fan-out while server news is fresh; v57.76 no personal-key news merge remains');
const pagesSource = readFileSync(new URL('../js/aio-pages.js', import.meta.url), 'utf8');
const krDataSource = readFileSync(new URL('../js/aio-kr-data.js', import.meta.url), 'utf8');
check(![source, pagesSource, krDataSource].some((text) => /stooq\.com\/q\//.test(text)) && !/_stooqCross/.test(source), 'P1756 Stooq (404 on every symbol) is out of the quote, cross-check, sector and ticker-detail fallbacks');
check(/var _aioFetchYahooChartDataDirect = _aioFetchYahooChartData;/.test(source) && /window\._aioFetchYahooChartData = _aioChartDataForScreen;/.test(source)
  && /window\._fetchYahooChartData = _aioFetchYahooChartDataDirect;/.test(source), 'P1756 the chart-screen fetch wrapper calls the captured producer, never itself');
check(!/financialmodelingprep\.com|data-logo-fallback/.test(pagesSource), 'v57.81 the earnings card hotlinks no third-party logo image'); // text-pin-ok: retirement absence

const canonical=harness({fetcher:async()=>new Response(JSON.stringify(chart('NVDA','1wk')))});
vm.runInContext(section(source,'async function _aioFetchYahooChartData(', '// 모듈 스코프'),canonical.context);
// P1132/R619: the inline delegation wrapper from index.html's block F was deleted (it was always
// shadowed by aio-data.js's window assignment). The canonical producer above is the only transport.
const weekly=await canonical.root._aioFetchYahooChartData('NVDA','2y','1wk');
check(weekly.symbol==='NVDA' && weekly.interval==='1wk' && weekly.meta.regularMarketTime===1787918400,'inline chart delegates to the canonical identity/timeframe/observation producer');
check(!source.includes('const YF_PROXIES') && !source.includes('const orderedProxies'), 'quote path has no independent relay retry loop');
const observations = vm.createContext({});
vm.runInContext(section(source, 'function _aioNormalizeAtomicQuote(', 'function applyLiveQuotes('), observations);
const q = {symbol:'AAA',regularMarketPrice:100,regularMarketChange:null,regularMarketChangePercent:null};
const unknown = observations._aioNormalizeAtomicQuote(q, Date.now());
check(unknown.regularMarketChange===null && unknown.regularMarketChangePercent===null, 'missing change is not zero');
const zero = observations._aioNormalizeAtomicQuote({...q,regularMarketChange:0,regularMarketChangePercent:0},Date.now());
check(zero.regularMarketChange===0 && zero.regularMarketChangePercent===0, 'observed zero survives normalization');
const oldQuote={...q,_source:'live:yahoo-v7-batch',regularMarketTime:1787918000};
const newQuote={...q,_source:'live:yahoo-proxy',regularMarketTime:1787918400,regularMarketPrice:102};
check(observations._aioSelectAtomicQuotes([oldQuote,newQuote],Date.now())[0].regularMarketPrice===102, 'newer observation wins over preferred older provider');
check(observations._aioSelectAtomicQuotes([newQuote,{...q,fetchedAt:new Date().toISOString()}],Date.now())[0].regularMarketPrice===102, 'collection time cannot displace a real observation');
vm.runInContext(section(source, 'function _aioPlanQuoteGroups(', 'async function fetchLiveQuotes('), observations);
const groups=observations._aioPlanQuoteGroups(['NVDA','NVDA','BRK-B','<bad>'],['^GSPC','KRW=X']);
check(groups.flat().join(',')==='NVDA,BRK-B,^GSPC,KRW=X' && groups.every(group=>group.length<=5), 'request-owned quote scope deduplicates and validates symbols without hidden catalogue fanout');
observations.window=observations;
observations._aioHistorySeries=()=>Array.from({length:60},(_,i)=>({value:i+1}));
vm.runInContext(section(source, 'function _aioVixPercentile(', 'function vixRegime('), observations);
check(observations._aioVixPercentile(30)===50, 'P1753 VIX percentile uses actual observed sample');
observations._aioHistorySeries=()=>Array.from({length:59},(_,i)=>({value:i+1}));
check(observations._aioVixPercentile(30)===null, 'P1753 insufficient VIX sample never uses a fabricated distribution');
check(!/function vixToPercentile\(/.test(source), 'P1753 the retired vixToPercentile compatibility wrapper stays gone');
check(!source.includes('(82.5 -') && !/goldWeeklyPct\s*=/.test(section(source, 'function applyLiveQuotes(', 'function updateScreenerFromLiveData(')), 'quote application cannot invent HY spread or turn daily gold return into weekly return');
console.log(`Proxy continuity: ${checks} PASS (offline VM; no live/provider or browser claim)`);
