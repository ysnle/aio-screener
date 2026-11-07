#!/usr/bin/env node
// v59.74 (state-machine audit, 2026-11-07): regression cases for the invalid states and transitions recorded in
// _context/STATE-MACHINES.md. Each case drives the real code (the scheduler module, and the quote functions cut out of
// js/aio-data.js) through the trail that reached the bad state before the fix, and names the finding it guards.
//
//   SM-03a  a coalesced fetch (already running for another caller) was recorded as a fresh success
//   SM-03b  a caller cancel (route change) was recorded as a provider failure with a retry count and a warning
//   SM-03c  a fetch that finished after its timeout or cancel had its outcome dropped
//   SM-04   overlapping refreshes dropped a running refresh's symbols and restored a finished one's list for good
//   SM-05   each failed quote fetch added its own retry chain, and the chains fetched while the tab was hidden
//   SM-04b   a quote request made while a fetch ran got "coalesced" back and its symbols were never fetched
// SM-03a/04/04b/05 are tested at the interface of src/data/quote-demand.js, the module that now owns those transitions.
//   SM-07   a page refresh dropped or cancelled before it finished still held its 30s stamp, so a quick return skipped it
//   SM-08   moving to another AI screen while an answer kept running turned 전송 back on
//   SM-13   a read still pending could be evicted from the 40-entry cache, so asking again fetched twice
//   SM-15   two server-data loads could overlap, and the older response could land after the newer one
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installRefreshScheduler } from '../src/app/refresh-scheduler.js';
import { createOnDemandSymbolReader } from '../src/data/on-demand-symbol.js';
import { installServerDataLoader } from '../src/data/server-data-loader.js';
import { createQuoteDemand } from '../src/data/quote-demand.js';

let checks = 0;
const pass = (name) => { checks += 1; console.log(`PASS ${name}`); };
const settle = async () => { for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setImmediate(resolve)); };

// ── Scheduler harness: real module, stub fetchers whose promises the case resolves. ──────────────────────────────
const FETCHERS = ['fetchLiveQuotes', 'fetchAllNews', 'fetchSentimentHistory', 'fetchBreadthData', 'fetchAllFredData', 'fetchHYSpread', 'autoUpdateMA', 'fetchKrDynamicData', 'fetchFearGreed', 'fetchPutCall'];
const warnings = [];
const doc = { hidden: false, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
const globals = { document: doc, T: { COOLDOWN: 60000 }, updateDataStatus() {}, _aioRegisterTimer: () => 0, showDataError: (label, message) => warnings.push(`${label}: ${message}`) };
for (const name of FETCHERS) globals[name] = async () => ({ ok: true });
for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
const realLog = console.log;

function freshScheduler() {
  const win = { AIO: {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  console.log = () => {};
  try { installRefreshScheduler(win); } finally { console.log = realLog; }
  warnings.length = 0;
  return win;
}
function pendingFetcher(name) {
  const pending = [];
  globalThis[name] = (...args) => new Promise((resolve, reject) => pending.push({ resolve, reject, args }));
  return pending;
}

// SM-03a
{
  const win = freshScheduler();
  const cfg = win.REFRESH_SCHEDULE.quotes;
  cfg._status = 'failed'; cfg._lastErr = 'earlier failure'; cfg._failureReason = 'earlier failure'; cfg._lastOk = 0;
  globalThis.fetchLiveQuotes = async () => ({ ok: false, skipped: true, updated: false, coalesced: true, error: 'quote fetch already in flight' });
  const result = await win._runScheduledTask('quotes', cfg, true, {});
  assert.equal(result.ok, false, 'v59.74 SM-03a: expected state'); assert.equal(result.coalesced, true, 'v59.74 SM-03a: expected state')
  assert.equal(cfg._lastOk, 0, 'v59.74 SM-03a: a coalesced run must not stamp a success time');
  assert.equal(cfg._status, 'failed', 'v59.74 SM-03a: a coalesced run leaves the earlier status');
  assert.equal(cfg._lastErr, 'earlier failure', 'v59.74 SM-03a: the earlier error stays');
  assert.equal(cfg._inFlight, false, 'v59.74 SM-03a: expected state')
  pass('SM-03a coalesced fetch is neither a success nor a failure');
}

// SM-03b + SM-03c (cancel)
{
  const win = freshScheduler();
  const cfg = win.REFRESH_SCHEDULE.quotes;
  const earlier = Date.now() - 600000;
  cfg._status = 'loaded'; cfg._lastOk = earlier; cfg.retryCount = 0;
  const pending = pendingFetcher('fetchLiveQuotes');
  const controller = new AbortController();
  const run = win.AIO.runScheduledRefresh({ keys: ['quotes'], pageId: 'home', signal: controller.signal });
  await settle();
  controller.abort('route-changed');
  const result = await run;
  assert.equal(result.results[0].ok, false, 'v59.74 SM-03b: expected state')
  assert.equal(result.status, 'ok', 'v59.74 SM-03b: a cancelled refresh is not a warning');
  assert.equal(cfg._status, 'loaded', 'v59.74 SM-03b: a cancel restores the status the task had');
  assert.equal(cfg.retryCount, 0, 'v59.74 SM-03b: a cancel is not a provider failure');
  assert.deepEqual(warnings, [], 'v59.74 SM-03b: a cancel shows no failure warning');
  assert.equal(cfg._inFlight, true, 'v59.74 SM-03b: the task owns the slot until its fetch settles');
  assert.equal((await win._runScheduledTask('quotes', cfg, false, {})).error, 'scheduler task already in flight', 'v59.74 SM-03b: no second run while the fetch is pending');
  pending.shift().resolve({ ok: true });
  await settle();
  assert.equal(cfg._inFlight, false, 'v59.74 SM-03b: expected state')
  assert.ok(cfg._lastOk > earlier, 'v59.74 SM-03b: the fetch that finished after the cancel is recorded');
  assert.equal(cfg._status, 'loaded', 'v59.74 SM-03c: the late success sets loaded');
  pass('SM-03b/c caller cancel is not a failure and the late outcome is kept');
}

// SM-03c (timeout)
{
  const win = freshScheduler();
  const cfg = win.REFRESH_SCHEDULE.news;
  cfg.timeoutMs = 3000;
  const pending = pendingFetcher('fetchAllNews');
  const realSetTimeout = globalThis.setTimeout;
  const timers = [];
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  let result;
  try {
    const run = win._runScheduledTask('news', cfg, false, {});
    await settle();
    timers.find((timer) => timer.ms === 3000).fn();
    result = await run;
  } finally { globalThis.setTimeout = realSetTimeout; }
  assert.equal(result.ok, false, 'v59.74 SM-03c: expected state'); assert.equal(cfg._status, 'failed', 'v59.74 SM-03c: the timeout is recorded as a failure'); assert.equal(cfg.retryCount, 1, 'v59.74 SM-03c: expected state')
  pending.shift().resolve({ ok: true });
  await settle();
  assert.equal(cfg._status, 'loaded', 'v59.74 SM-03c: a fetch that arrives after the timeout is recorded');
  assert.equal(cfg.retryCount, 0, 'v59.74 SM-03c: expected state')
  assert.ok(cfg._lastOk > 0, 'v59.74 SM-03c: expected state')
  pass('SM-03c fetch finishing after its timeout is recorded');
}

// SM-03a/04/04b/05 — the quote demand (src/data/quote-demand.js), tested at its interface with an injected provider fetch
// and fake timers. Each case is the trail that reached the bad state before the demand owned these transitions.
function demandHarness({ hidden = false } = {}) {
  const fetches = [];
  const outcomes = [];
  const timers = new Map();
  let seq = 0;
  const env = { hidden };
  const demand = createQuoteDemand({
    fetchQuotes: (symbols, attempt) => new Promise((resolve) => fetches.push({ symbols, attempt, resolve })),
    onOutcome: (outcome) => outcomes.push(outcome),
    isHidden: () => env.hidden,
    timers: { setTimeout: (fn, ms) => { seq += 1; timers.set(seq, { fn, ms }); return seq; }, clearTimeout: (id) => timers.delete(id) },
    base: ['REG1']
  });
  return { demand, fetches, outcomes, timers, env };
}
// SM-03a + SM-04b: a request during a fetch is never "did nothing": covered symbols join, new ones are fetched next.
{
  const { demand, fetches, outcomes } = demandHarness();
  const first = demand.request(['HOME1']);
  await settle();
  const joined = demand.request(['home1']);
  assert.equal(joined, first, 'v59.74 SM-03a: a request the running fetch covers joins it');
  const repair = demand.request(['MISS1']);
  const repair2 = demand.request(['MISS2', 'HOME1']);
  assert.equal(repair2, repair, 'v59.74 SM-04b: requests with new symbols share one follow-up fetch');
  assert.equal(fetches.length, 1, 'v59.74 SM-03a: one provider fetch at a time');
  fetches[0].resolve({ ok: true, updated: true, status: 'loaded' });
  assert.equal((await first).ok, true, 'v59.74 SM-03a: the joined caller gets the real outcome');
  await settle();
  assert.equal(fetches.length, 2, 'v59.74 SM-04b: the queued symbols are fetched right after');
  assert.deepEqual(fetches[1].symbols.sort(), ['MISS1', 'MISS2', 'REG1'], 'v59.74 SM-04b: the follow-up asks for the symbols the running fetch did not read');
  fetches[1].resolve({ ok: true, updated: true, status: 'loaded' });
  assert.equal((await repair).ok, true, 'v59.74 SM-04b: the repair caller waits for the fetch that has its symbols');
  assert.equal(outcomes.length, 2, 'v59.74 SM-03a: every fetch outcome is recorded once');
  pass('SM-03a/04b a request during a fetch joins it or is fetched next, never dropped');
}
// SM-04: registered symbols join every fetch, including ones registered while a fetch runs; nothing is restored later.
{
  const { demand, fetches } = demandHarness();
  const first = demand.request(['A']);
  await settle();
  demand.register('reg2');
  const second = demand.request(['B']);
  fetches[0].resolve({ ok: true });
  await first; await settle();
  assert.deepEqual(fetches[1].symbols.sort(), ['B', 'REG1', 'REG2'], 'v59.74 SM-04: the next fetch has the registered symbols and its own, not the finished one');
  fetches[1].resolve({ ok: true }); await second;
  demand.request(); await settle();
  assert.deepEqual(fetches[2].symbols.sort(), ['REG1', 'REG2'], 'v59.74 SM-04: a finished request leaves only the registered symbols');
  fetches[2].resolve({ ok: true });
  pass('SM-04 symbol lists of overlapping requests stay independent');
}
// SM-05: one retry pending, a new fetch cancels it, a hidden tab skips it, the backoff count reaches the provider.
{
  const { demand, fetches, timers, env } = demandHarness();
  for (let i = 0; i < 3; i += 1) {
    const run = demand.request();
    await settle();
    assert.equal(fetches.at(-1).attempt.failures, i, 'v59.74 SM-05: the provider sees the failures in a row for its backoff');
    fetches.at(-1).resolve({ ok: false, status: 'failed', retryAfterMs: 15000 * 2 ** i });
    await run;
  }
  assert.equal(timers.size, 1, 'v59.74 SM-05: three failures leave one retry pending, not three chains');
  assert.equal([...timers.values()][0].ms, 60000, 'v59.74 SM-05: the pending retry is the latest backoff');
  const started = demand.request(); // a fetch from anywhere starts: the pending retry is cancelled at once
  assert.equal(timers.size, 0, 'v59.74 SM-05: a fetch that starts cancels the pending retry');
  await settle(); fetches.at(-1).resolve({ ok: false, retryAfterMs: 1000 }); await started;
  env.hidden = true;
  const pending = [...timers.values()][0]; timers.clear(); pending.fn(); await settle();
  assert.equal(fetches.length, 4, 'v59.74 SM-05: a hidden tab does not fetch on a retry timer');
  env.hidden = false;
  demand.request(); await settle();
  fetches.at(-1).resolve({ ok: false, retryAfterMs: 1000 }); await settle();
  const visible = [...timers.values()][0]; timers.clear(); visible.fn(); await settle();
  assert.equal(fetches.length, 6, 'v59.74 SM-05: a visible tab retries once');
  fetches.at(-1).resolve({ ok: true }); await settle();
  assert.equal(demand.state().failures, 0, 'v59.74 SM-05: a success resets the failure count');
  assert.equal(timers.size, 0, 'v59.74 SM-05: a success leaves no retry');
  pass('SM-05 the quote demand keeps one retry, cancels it on a new fetch and skips it while hidden');
}
// The real provider fetch (js/aio-data.js) offline: it reports a retry from the failure count it was given, and the
// scheduler records an outcome from a caller that never went through it.
function loadProviderFetch(win, globalsForVm) {
  const source = readFileSync(new URL('../js/aio-data.js', import.meta.url), 'utf8');
  const start = source.indexOf('function _aioPlanQuoteGroups(');
  const end = source.indexOf('function scheduleQuoteCrossSourceValidation(', start);
  assert(start >= 0 && end > start, 'v59.74 SM-05: the provider fetch and its planner are found in js/aio-data.js');
  const inert = () => new Proxy(function () {}, { apply: () => undefined, get: (_, key) => (key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : inert()) });
  const own = {
    console: { log() {}, warn() {}, error() {} }, Promise, Date, Math, JSON, Object, Array, Set, Map, String, Number, Boolean, Error, RegExp,
    isFinite, isNaN, parseFloat, parseInt, encodeURIComponent, window: win, document: doc,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    fetchWithTimeout: async () => { throw new Error('offline'); }, fetchViaProxy: async () => { throw new Error('offline'); },
    fetchKrNaverQuotes: async () => [], LIVE_SYMBOLS: ['SPY'], _aioMarketSnapshotMeta: null, ...globalsForVm
  };
  const context = vm.createContext(new Proxy(own, {
    has: () => true,
    get: (target, key) => (key in target ? target[key] : key === Symbol.unscopables ? undefined : key in win ? win[key] : inert())
  }));
  vm.runInContext(`${source.slice(start, end)}\nthis._aioFetchLiveQuotesOnce = _aioFetchLiveQuotesOnce;`, context);
  return context._aioFetchLiveQuotesOnce;
}
{
  const win = freshScheduler();
  const provider = loadProviderFetch(win, {});
  const first = await provider([], { failures: 0 });
  const third = await provider([], { failures: 2 });
  assert.deepEqual([first.ok, first.retryAfterMs, third.retryAfterMs], [false, 15000, 60000], 'v59.74 SM-05: the provider backs off from the failure count it is given');
  win._aioFetchLiveQuotesOnce = async () => ({ ok: true, updated: true, status: 'loaded', count: 3 });
  const cfg = win.REFRESH_SCHEDULE.quotes;
  cfg._lastOk = 0; cfg._status = 'failed';
  await win.fetchLiveQuotes(['AAPL']); // a screen's direct call, outside the scheduler
  assert.ok(cfg._lastOk > 0 && cfg._status === 'loaded', 'v59.74 SM-03a: a quote fetch from any caller is recorded on the quotes task');
  pass('SM-05 the real provider reports its retry, and outcomes from any caller reach the quotes task');
}

// SM-07 — the real page on-enter refresh under fake timers; runScheduledRefresh is a stub that never settles.
{
  const win = freshScheduler();
  const calls = [];
  let active = 'home';
  win.AIO.getActivePage = () => active;
  win.AIO.runScheduledRefresh = (request) => { calls.push(request); return new Promise(() => {}); };
  globalThis._aioBootPhase = { quoteReady: true };
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { timers.push(fn); return timers.length; };
  try {
    const flush = () => { while (timers.length) timers.shift()(); };
    win._aioRefreshPageData('home');
    active = 'breadth'; win._aioRefreshPageData('breadth'); // leaves before the home run started
    flush();
    assert.equal(calls.length, 1, 'v59.74 SM-07: the dropped home run never starts');
    assert.equal(calls[0].pageId, 'breadth', 'v59.74 SM-07: expected state');
    active = 'home'; win._aioRefreshPageData('home'); flush(); // back within 30s, the breadth run still running
    const back = calls.at(-1);
    assert.equal(back.pageId, 'home', 'v59.74 SM-07: returning within 30s starts a home refresh');
    assert.ok(back.keys.includes('quotes') && back.keys.includes('news'), `v59.74 SM-07: the dropped and the cancelled run gave their stamps back: ${back.keys}`);
    assert.equal(back.signal.aborted, false, 'v59.74 SM-07: expected state');
    win._aioRefreshPageData('home'); flush(); // a same-screen re-entry supersedes the run and still refreshes
    assert.ok(calls.at(-1).keys.includes('quotes'), 'v59.74 SM-07: a superseded run gives its stamps back');
    assert.equal(back.signal.aborted, true, 'v59.74 SM-07: expected state');
  } finally { globalThis.setTimeout = realSetTimeout; }
  pass('SM-07 a page refresh that never ran or was cancelled does not block the next entry');
}

// SM-08 — the real request lifecycle and panel context switch cut out of js/aio-chat.js, with one shared conversation
// state (what src/ui/components/chat-sessions.js installs).
{
  const source = readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8');
  const cut = (from, to) => { const a = source.indexOf(from), b = source.indexOf(to, a); assert(a >= 0 && b > a, `v59.74 SM-08: ${from} is found in js/aio-chat.js`); return source.slice(a, b); };
  const button = { disabled: false, textContent: '전송', setAttribute() {}, removeAttribute() {} };
  const input = { disabled: false, value: '' };
  const shared = { messages: [], streaming: false, _chatSendEntered: 0, _requestEpoch: 0, _activeRequest: null, _retryCount: 0 };
  const own = {
    window: {}, AbortController, Date, String, Object, Array, Math, Promise,
    document: { getElementById: (id) => (id === 'ai-panel-btn' ? button : id === 'ai-panel-inp' ? input : null), createElement: () => ({}) },
    CHAT_CONTEXTS: { home: { title: '오늘' }, macro: { title: '매크로' } }, _aiDefaultChips: {}
  };
  own.window = own;
  const inert = () => new Proxy(function () {}, { apply: () => undefined, get: (_, key) => (key === 'then' ? undefined : inert()) });
  const context = vm.createContext(new Proxy(own, { has: () => true, get: (target, key) => (key in target ? target[key] : key === Symbol.unscopables ? undefined : inert()) }));
  vm.runInContext(`${cut('const chatState = {};', "if (typeof window !== 'undefined') {")}
var _aiCurrentCtx = 'home'; var _aiCtxMap = { home: 'home', macro: 'macro' };
${cut('function updateAIPanelContext(', 'function _aioSyncQuestionCount(')}
getChatState = function () { return this.__shared; }.bind(this);
this._aioKeepRunningAnswer = function (from, to) { return !!(from && to && this.__shared._activeRequest); }.bind(this);`, Object.assign(context, { __shared: shared }));
  const run = context._aioBeginChatRequest('home', '질문', { entrypoint: 'unified-chat', buttonId: 'ai-panel-btn', idleLabel: '전송' });
  assert.equal(button.disabled, true, 'v59.74 SM-08: a running answer holds 전송');
  context.updateAIPanelContext('macro');
  assert.equal(shared._activeRequest, run, 'v59.74 SM-08: the answer keeps running across screens');
  assert.equal(button.disabled, true, 'v59.74 SM-08: moving to another AI screen keeps 전송 off while the answer runs');
  assert.equal(input.disabled, false, 'v59.74 SM-08: the box stays open for the next question');
  context._aioReleaseChatRequest(run);
  assert.equal(button.disabled, false, 'v59.74 SM-08: the finished answer gives 전송 back');
  context.updateAIPanelContext('home');
  assert.equal(button.disabled, false, 'v59.74 SM-08: an idle panel has 전송 on');
  pass('SM-08 a kept-running answer keeps the send button off on every AI screen');
}

// SM-13 — the real on-demand reader: a pending read keeps its cache slot while 40 settled reads pass it.
{
  let pendingListing = null;
  let listChecks = 0;
  const reader = createOnDemandSymbolReader({
    fetchChart: async () => null,
    universeRows: () => [{ sym: 'SPY' }],
    isListed: (id) => { listChecks += id === 'PEND' ? 1 : 0; return id === 'PEND' ? new Promise((resolve) => { pendingListing = resolve; }) : { listed: false }; }
  });
  const first = reader.load('PEND');
  await settle();
  for (let i = 0; i < 45; i += 1) await reader.load(`F${i}`);
  assert.ok(reader.stats().entries <= 41, `v59.74 SM-13: the cache stays bounded: ${reader.stats().entries}`);
  const again = reader.load('PEND');
  assert.equal(again, first, 'v59.74 SM-13: asking again joins the pending read');
  assert.equal(listChecks, 1, 'v59.74 SM-13: no duplicate read for a pending symbol');
  pendingListing({ listed: false });
  assert.equal((await again).status, 'not-listed', 'v59.74 SM-13: expected state');
  assert.ok(reader.stats().entries <= 40, `v59.74 SM-13: settled entries are trimmed back to the bound: ${reader.stats().entries}`);
  pass('SM-13 a pending on-demand read is not evicted');
}

// SM-15 — the real server-data loader: a second load while one runs joins it instead of racing it.
{
  const fetches = [];
  const win = { addEventListener() {}, dispatchEvent() {}, _aioFetchServerData: () => new Promise((resolve) => fetches.push(resolve)) };
  installServerDataLoader(win);
  const a = win._aioLoadServerData();
  const b = win._aioLoadServerData();
  await settle();
  assert.equal(fetches.length, 1, 'v59.74 SM-15: a load during a load joins it (one fetch for both callers)');
  fetches[0]({ ok: false, reason: 'offline' });
  assert.deepEqual([await a, await b], [false, false], 'v59.74 SM-15: both callers get the one outcome');
  const c = win._aioLoadServerData();
  await settle();
  assert.equal(fetches.length, 2, 'v59.74 SM-15: a load after the last one finished starts its own');
  fetches[1]({ ok: false, reason: 'offline' }); await c;
  pass('SM-15 server-data loads run one at a time');
}

// v59.74 SM-04b (integration review): the demand is the page's fetchLiveQuotes only if nothing replaces it later. A v20
// wrapper in js/aio-ui.js reassigned it at DOMContentLoaded, called it with no symbols and returned undefined.
{
  const { readdirSync } = await import('node:fs');
  const files = [...readdirSync(new URL('../js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`), 'index.html'];
  const offenders = files.filter((file) => /(?:^|[^.\w])(?:window\.)?fetchLiveQuotes\s*=(?!=)/m.test(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')));
  assert.deepEqual(offenders, [], 'v59.74 SM-04b: fetchLiveQuotes is assigned only by src/data/quote-demand.js');
  pass('SM-04b no legacy script replaces the quote demand seam');
}

console.log(JSON.stringify({ ok: true, gate: 'state-machine-regression', checks }));
