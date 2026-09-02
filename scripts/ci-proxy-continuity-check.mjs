#!/usr/bin/env node
// Executes the real transport functions offline; no browser/network required.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../js/aio-data.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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
  vm.runInContext(section(source, 'const _cfWorkerUrl =', '// ═══ 1. Finnhub source-confirmed quotes') + '\nwindow.registry = _PROXY_REGISTRY;', context);
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

const canonical=harness({fetcher:async()=>new Response(JSON.stringify(chart('NVDA','1wk')))});
vm.runInContext(section(source,'async function _aioFetchYahooChartData(', '// 모듈 스코프'),canonical.context);
vm.runInContext(section(html,'async function _fetchYahooChartData(ticker,', '// Main comprehensive analysis function'),canonical.context);
const weekly=await canonical.root._fetchYahooChartData('NVDA','2y','1wk');
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
vm.runInContext(section(source, 'function vixToPercentile(', 'function vixRegime('), observations);
check(observations.vixToPercentile(30)===50, 'VIX percentile uses actual observed sample');
observations._aioHistorySeries=()=>Array.from({length:59},(_,i)=>({value:i+1}));
check(observations.vixToPercentile(30)===null, 'insufficient VIX sample never uses a fabricated distribution');
check(!source.includes('(82.5 -') && !/goldWeeklyPct\s*=/.test(section(source, 'function applyLiveQuotes(', 'function generateDynamicBriefing(')), 'quote application cannot invent HY spread or turn daily gold return into weekly return');
console.log(`Proxy continuity: ${checks} PASS (offline VM; no live/provider or browser claim)`);
