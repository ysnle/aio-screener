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
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installRefreshScheduler } from '../src/app/refresh-scheduler.js';

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
  globalThis[name] = (...args) => new Promise((resolve, reject) => pending.push({ resolve, reject, args, symbols: globalThis.window?._aioQuoteRequestSymbols?.slice() }));
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

// SM-04
{
  const win = freshScheduler();
  globalThis.window = win;
  win.AIO.registerLiveSymbol = (sym) => win._aioAddQuoteRequestBaseSymbol(sym); // the aio-core.js path
  win.AIO.registerLiveSymbol('REG1');
  const quotes = pendingFetcher('fetchLiveQuotes');
  const news = pendingFetcher('fetchAllNews');
  const first = win.AIO.runScheduledRefresh({ keys: ['quotes'], symbols: ['HOME1'] });
  await settle();
  const second = win.AIO.runScheduledRefresh({ keys: ['news', 'quotes'], symbols: ['COMP1'] });
  await settle();
  win.AIO.registerLiveSymbol('REG2'); // a screen registers a row while both refreshes run
  assert.deepEqual(win._aioQuoteRequestSymbols, ['REG1', 'REG2', 'HOME1', 'COMP1'], 'v59.74 SM-04: expected state')
  quotes.shift().resolve({ ok: true });
  await first;
  assert.deepEqual(win._aioQuoteRequestSymbols, ['REG1', 'REG2', 'COMP1'], 'v59.74 SM-04: the running refresh keeps its symbols');
  news.shift().resolve({ ok: true });
  await settle();
  assert.deepEqual(quotes[0].symbols, ['REG1', 'REG2', 'COMP1'], 'v59.74 SM-04: the second refresh asks for its own symbols');
  quotes.shift().resolve({ ok: true });
  await second;
  assert.deepEqual(win._aioQuoteRequestSymbols, ['REG1', 'REG2'], 'v59.74 SM-04: a finished refresh leaves only the registered symbols');
  const release = win._aioHoldQuoteRequestSymbols(['X']);
  release(); release();
  assert.deepEqual(win._aioQuoteRequestSymbols, ['REG1', 'REG2'], 'v59.74 SM-04: a release is idempotent');
  delete globalThis.window;
  pass('SM-04 overlapping refreshes hold their symbol lists independently');
}

// SM-05 — the real js/aio-data.js fetchLiveQuotes (with its group planner) run in a vm against an offline transport,
// wired to the real scheduler's retry owner, under fake timers. Names the function does not reach resolve to inert stubs.
function loadFetchLiveQuotes(win, globalsForVm) {
  const source = readFileSync(new URL('../js/aio-data.js', import.meta.url), 'utf8');
  const start = source.indexOf('function _aioPlanQuoteGroups(');
  const end = source.indexOf('function scheduleQuoteCrossSourceValidation(', start);
  assert(start >= 0 && end > start, 'v59.74 SM-05: fetchLiveQuotes and its planner are found in js/aio-data.js');
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
  vm.runInContext(`${source.slice(start, end)}\nthis.fetchLiveQuotes = fetchLiveQuotes;`, context);
  return context.fetchLiveQuotes;
}
{
  const win = freshScheduler();
  const timers = new Map();
  let seq = 0;
  const fakeSetTimeout = (fn, ms) => { seq += 1; timers.set(seq, { fn, ms }); return seq; };
  const fakeClearTimeout = (id) => { timers.delete(id); };
  const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = fakeSetTimeout; globalThis.clearTimeout = fakeClearTimeout; // the scheduler's retry owner
  try {
    const fetchLiveQuotes = loadFetchLiveQuotes(win, { setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout });
    let retries = 0;
    globalThis.fetchLiveQuotes = () => { retries += 1; return fetchLiveQuotes(); }; // what the retry timer calls
    win._aioQuoteInFlight = true;
    const coalesced = await fetchLiveQuotes(['AAPL']);
    assert.equal(coalesced.coalesced, true, 'v59.74 SM-03a: a call during a running fetch reports that it did nothing');
    assert.equal(timers.size, 0, 'v59.74 SM-03a: a coalesced call schedules nothing');
    win._aioQuoteInFlight = false;
    for (let i = 0; i < 3; i += 1) {
      const failed = await fetchLiveQuotes([]);
      assert.equal(failed.status, 'failed', 'v59.74 SM-05: an offline fetch fails');
    }
    assert.equal(timers.size, 1, 'v59.74 SM-05: three failures leave one retry pending, not three chains');
    const pending = [...timers.values()][0];
    assert.ok(pending.ms >= 15000, 'v59.74 SM-05: the retry waits its backoff');
    doc.hidden = true;
    timers.clear(); pending.fn();
    assert.equal(retries, 0, 'v59.74 SM-05: a hidden tab does not fetch on a retry timer');
    doc.hidden = false;
    await fetchLiveQuotes([]);
    assert.equal(timers.size, 1, 'v59.74 SM-05: a visible failure schedules the retry again');
    const started = fetchLiveQuotes([]); // a new fetch starts: the pending retry is cancelled at once
    assert.equal(timers.size, 0, 'v59.74 SM-05: a fetch that starts cancels the pending retry');
    await started;
    const next = [...timers.values()].at(-1);
    timers.clear(); next.fn(); await settle();
    assert.equal(retries, 1, 'v59.74 SM-05: a visible tab retries through the real fetch');
  } finally { globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClearTimeout; doc.hidden = false; }
  pass('SM-05 the real quote fetch keeps one retry, cancels it on a new fetch and skips it while hidden');
}

console.log(JSON.stringify({ ok: true, gate: 'state-machine-regression', checks }));
