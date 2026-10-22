import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { AIOQuotaDurableObject } from '../../../../cloudflare-worker-proxy.js';
const source = fs.readFileSync('js/aio-workspace.js', 'utf8');
const begin = source.indexOf('function addToWatchlist(ticker, note) {');
const end = source.indexOf('\nfunction removeFromWatchlist', begin);
let activeId = 'A';
let lists = [{ id: 'A', tickers: [] }, { id: 'B', tickers: [] }];
let resolveSymbol;
const lookup = new Promise((resolve) => { resolveSymbol = resolve; });
const context = {
  window: { _aioAcceptSymbol: () => lookup },
  getActiveWatchlistId: () => activeId,
  getWatchlists: () => structuredClone(lists),
  saveWatchlists: (value) => { lists = value; },
  showToast: () => {}, document: { getElementById: () => null }, renderWatchlistContent: () => {}
};
vm.createContext(context);
vm.runInContext(source.slice(begin, end), context);
context.addToWatchlist('UFPT', '원래 A 목록');
activeId = 'B';
resolveSymbol({ ok: true, id: 'UFPT' });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(lists[0].tickers.length, 0);
assert.equal(lists[1].tickers[0].sym, 'UFPT');
console.log('REPRODUCED watchlist async target drift: requested list A, persisted list B (deferred symbol UFPT)');
let saved;
let tail = Promise.resolve();
const state = {storage: {get: async () => saved, put: async (_,value) => { saved = structuredClone(value); }}, blockConcurrencyWhile: (fn) => {const run=tail.then(fn);tail=run.catch(()=>{});return run;}};
const quota = new AIOQuotaDurableObject(state, {});
const dayKey = 'claude:' + new Date().toISOString().slice(0,10);
const base = {dayKey, cap: 1000, monthlyCapMicroUsd: 20000000, clientKey: 'a'.repeat(32), clientCap: 1000, reservationMicroUsd: 270000};
const results = await Promise.all(Array.from({length: 100}, (_, i) => quota.mutateQuota('reserve', {...base, requestId: 'fixture-' + i})));
assert.equal(results.filter(r => r.reserved).length, 3);
assert.equal(quota.counts.months[dayKey.slice(7,14)], 810000);
await quota.mutateQuota('start', {...base, requestId:'fixture-0'});
await quota.mutateQuota('settle', {...base, requestId:'fixture-0', chargeMicroUsd:10000});
assert.equal(quota.counts.clientSpend[dayKey][base.clientKey],550000);
await quota.mutateQuota('release', {...base, requestId:'fixture-1'});
assert.equal(quota.counts.clientSpend[dayKey][base.clientKey],280000);
const retained = await quota.mutateQuota('release', {...base,requestId:'fixture-0'});
assert.equal(retained.retained,true);
console.log('PASS Worker class fixture: 100 concurrent admissions bounded; settle/release refund; started spend retained');
import { assessServerCycle, readReconciliationState } from '../../../../src/data/server-data.js';
import { applyServerMacro } from '../../../../src/data/server-macro.js';
import { verifyServerMarketAnalysis } from '../../../../src/data/server-market-analysis.js';
import { screenerLoadState } from '../../../../src/data/page-completeness.js';
const now = Date.parse('2026-10-19T00:00:00Z');
const complete = {generatedAt:'2026-10-18T23:00:00Z',cycleStatus:'PUBLISHED',marketSnapshotPublished:true,marketSnapshotCoverage:{tier0Required:2,tier0Observed:2},failedSymbols:[]};
assert.equal(assessServerCycle(complete,now).eligible,true);
assert.equal(assessServerCycle({...complete,generatedAt:'2026-10-19T01:00:00Z'},now).eligible,false);
assert.equal(assessServerCycle({...complete,cycleStatus:'FAILED'},now).eligible,false);
assert.equal(readReconciliationState({schemaVersion:'reconciliation-status-v2',categories:Array(22).fill({}),closure:{sourceRevision:'old'}},'new',now).status,'stale');
const snapshot={_fieldTs:{}};
applyServerMacro({data:{meta:{},macro:{cpi:8,_bls:{series:{cpi:{seasonalAdjustment:'SA',status:'ok'}},values:{blsCpiYoY:8}}}},snapshot,evidence:{}});
assert.equal(snapshot.cpi,undefined);
assert.equal(verifyServerMarketAnalysis({full:'unverified prose'}).analysis,null);
assert.equal(screenerLoadState({status:'current',metadata:{backtest:{},universeFreshnessStatus:'stale'}}).status,'partial');
console.log('PASS native boundary fixture: future/failed cycle rejected; revision mismatch stale; SA CPI not promoted; unverified prose withheld; stale screener partial');
