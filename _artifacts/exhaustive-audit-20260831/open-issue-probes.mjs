// Regression probes for defects reproduced earlier in this audit. A true
// `reproduced` value means the defect has returned.
import fs from 'node:fs';
import { createSelector } from '../../src/state/memoize.js';
import { deriveFactorWeights } from '../../src/domain/screener/factor-weights.js';
import { createHttpClient } from '../../src/platform/http.js';
import { createRuntimeReaders } from '../../src/data/runtime-readers.js';
import { createScreenerProvider } from '../../src/data/providers/screener.js';
const findings = [];
const neutral = deriveFactorWeights();
const korean = deriveFactorWeights({ marketState: { fgZone: '공포' } });
const english = deriveFactorWeights({ marketState: { fgZone: 'extreme fear' } });
findings.push({ id: 'A10', behavior: 'Korean fear diverges from the equivalent English regime', reproduced: korean.weights.lowvol === neutral.weights.lowvol && english.weights.lowvol > neutral.weights.lowvol, neutral: neutral.weights.lowvol, korean: korean.weights.lowvol, english: english.weights.lowvol });
let shouldThrow = false, calls = 0;
const selector = createSelector([value => value], value => { calls++; if (shouldThrow) throw new Error('fixture-compute-error'); return value * 2; });
selector(2); shouldThrow = true;
try { selector(3); } catch (_) {}
shouldThrow = false;
const repeated = selector(3);
findings.push({ id: 'A12', behavior: 'retry after compute exception returns cached previous-input result', reproduced: repeated === 4 && calls === 2, expected: 6, actual: repeated, calls });
let headers;
await createHttpClient({ fetchImpl: async (_, init) => { headers = new Headers(init.headers); return { ok: true, status: 200, json: async () => ({}) }; } }).requestJson('https://fixture.invalid', { headers: new Headers({ 'x-fixture': 'present' }) });
findings.push({ id: 'A11', behavior: 'Headers input silently loses custom header', reproduced: !headers.has('x-fixture') });
let complete;
const client = createHttpClient({ defaultTimeoutMs: 5, fetchImpl: () => new Promise(resolve => { complete = resolve; }) });
const request = client.requestJson('https://fixture.invalid');
const deadline = await Promise.race([request.then(() => 'settled'), new Promise(resolve => setTimeout(() => resolve('still-pending'), 30))]);
complete({ ok: true, status: 200, json: async () => ({}) });
const late = await request;
findings.push({ id: 'A11', behavior: 'abort-ignoring transport remains pending past timeout and later publishes success', reproduced: deadline === 'still-pending' && late.ok, deadline, lateOk: late.ok });
const runtime = createRuntimeReaders({ root: { AIO: { getCanonicalMetric: () => ({ value: null, source: 'empty-canonical', observedAt: '2026-08-31T00:00:00Z' }) }, DATA_SNAPSHOT: { fg: 42, _snapshotDate: '2026-08-01' }, _liveData: { '^VIX': { price: 20, source: 'snapshot:fixture', observedAt: '2026-08-01' } } } });
const sentiment = runtime.readSentiment();
findings.push({ id: 'A02', behavior: 'snapshot fallback value carries empty canonical source/date', reproduced: sentiment.fearGreed === 42 && sentiment.fearGreedSource === 'empty-canonical', value: sentiment.fearGreed, source: sentiment.fearGreedSource, date: sentiment.fearGreedObservedAt });
findings.push({ id: 'A02', behavior: 'options quote overrides snapshot source kind to live', reproduced: runtime.readEntity().options.vix.sourceKind === 'live' });
const fixtureTime = '2026-08-31T00:00:00Z';
const provider = createScreenerProvider({
  clock: { now: () => Date.parse(fixtureTime) },
  readLiveData: () => ({ '005930.KS': { price: 70000, marketCap: 200e12, currency: 'KRW', observedAt: fixtureTime, source: 'fixture-KRW' } }),
  httpClient: { requestJson: async url => ({ ok: true, data: url.includes('screener-universe') ? { meta: { currentness: 'CURRENT', lastBulkUpdate: fixtureTime }, universe: [{ sym: '005930.KS', name: 'Fixture', index: 'KOSPI' }] } : { asOf: fixtureTime, factorObservedAt: fixtureTime, data: { '005930.KS': { price: 70000, dollarVolume30d: 20e9 } } } }) }
});
const row = (await provider.readCurrent()).rows[0];
const cap = row.fieldObservations.find(item => item.fieldId === 'valuation.marketCap');
findings.push({ id: 'A01', behavior: 'KRW market cap is published as a populated USD-billions observation without conversion', reproduced: row.instrumentRef.currency === 'KRW' && cap.unit === 'USD_bn' && cap.value === 200000, currency: row.instrumentRef.currency, capUnit: cap.unit, capValue: cap.value, nativeMarketCap: row.nativeMarketCap });
const reproduced = findings.filter(item => item.reproduced);
const report = { at: new Date().toISOString(), boundary: 'Offline regression fixtures only; not provider/data/live measurements', status: reproduced.length ? 'FAIL' : 'PASS', reproduced: reproduced.length, findings };
fs.writeFileSync('_artifacts/exhaustive-audit-20260831/open-issue-probes.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (reproduced.length) process.exitCode = 1;
