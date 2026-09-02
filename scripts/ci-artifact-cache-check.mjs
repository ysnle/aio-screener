import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { artifactCacheSnapshot, clearArtifactCache, loadJsonArtifact } from '../src/data/artifact-cache.js';

let calls = 0;
let release;
const fetchFn = async (url) => {
  calls += 1;
  await new Promise((resolve) => { release = resolve; });
  return { ok: true, json: async () => ({ url, calls }) };
};

const abortController = new AbortController();
const abortedConsumer = loadJsonArtifact(fetchFn, './shared.json', { signal: abortController.signal });
const survivingConsumer = loadJsonArtifact(fetchFn, './shared.json');
await Promise.resolve();
assert.equal(calls, 1, 'concurrent consumers must share one network request');
abortController.abort();
await assert.rejects(abortedConsumer, (error) => error?.name === 'AbortError', 'consumer abort must reject only that consumer');
release();
const first = await survivingConsumer;
assert.deepEqual(first, { url: './shared.json', calls: 1 });

const cached = await loadJsonArtifact(fetchFn, './shared.json');
assert.equal(cached, first, 'a fresh resolved artifact must reuse the cached object');
assert.equal(calls, 1, 'cache hit must not issue another request');
assert.deepEqual(artifactCacheSnapshot(fetchFn), { resolved: 1, inFlight: 0, hits: 1, misses: 1, shared: 1, evictions: 0 });

let isolatedCalls = 0;
const isolatedFetch = async (url) => {
  isolatedCalls += 1;
  return { ok: true, json: async () => ({ url, isolatedCalls }) };
};
await loadJsonArtifact(isolatedFetch, './shared.json');
assert.equal(isolatedCalls, 1, 'different fetch functions must have isolated stores');
for (let index = 0; index < 5; index += 1) await loadJsonArtifact(isolatedFetch, `./bounded-${index}.json`, { maxEntries: 3 });
assert.deepEqual(artifactCacheSnapshot(isolatedFetch), { resolved: 3, inFlight: 0, hits: 0, misses: 6, shared: 0, evictions: 3 }, 'resolved cache must remain LRU-bounded during long sessions');
clearArtifactCache(fetchFn);
assert.deepEqual(artifactCacheSnapshot(fetchFn), { resolved: 0, inFlight: 0, hits: 0, misses: 0, shared: 0, evictions: 0 });

let timeoutAborted = false;
const neverFetch = (_url, { signal } = {}) => new Promise((_resolve, reject) => {
  signal?.addEventListener('abort', () => { timeoutAborted = true; reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
});
await assert.rejects(loadJsonArtifact(neverFetch, './never.json', { timeoutMs: 100 }), /Artifact timeout/);
assert.equal(timeoutAborted, true, 'timeout must abort the underlying request');
assert.equal(artifactCacheSnapshot(neverFetch).inFlight, 0, 'timed-out request must leave no in-flight entry');

let allConsumersAborted = false;
const abortableFetch = (_url, { signal } = {}) => new Promise((_resolve, reject) => {
  signal?.addEventListener('abort', () => { allConsumersAborted = true; reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
});
const firstAbort = new AbortController();
const secondAbort = new AbortController();
const firstPending = loadJsonArtifact(abortableFetch, './all-abort.json', { signal: firstAbort.signal });
const secondPending = loadJsonArtifact(abortableFetch, './all-abort.json', { signal: secondAbort.signal });
firstAbort.abort();
await assert.rejects(firstPending, (error) => error?.name === 'AbortError');
assert.equal(allConsumersAborted, false, 'one aborted consumer must not cancel a survivor');
secondAbort.abort();
await assert.rejects(secondPending, (error) => error?.name === 'AbortError');
await Promise.resolve();
assert.equal(allConsumersAborted, true, 'underlying request must abort after the last consumer leaves');

const protectedText = JSON.stringify({ scope: 'bounded-projection', rows: [1, 2, 3] });
const protectedDigest = createHash('sha256').update(protectedText).digest('hex');
const protectedFetch = async () => ({ ok: true, headers: { get: () => String(Buffer.byteLength(protectedText)) }, text: async () => protectedText });
assert.deepEqual(await loadJsonArtifact(protectedFetch, './protected.json', { integrity: protectedDigest, maxBytes: 1024 }), JSON.parse(protectedText), 'content-addressed artifact must pass byte and digest verification');
clearArtifactCache(protectedFetch);
await assert.rejects(loadJsonArtifact(protectedFetch, './protected.json', { integrity: '0'.repeat(64), maxBytes: 1024 }), /integrity mismatch/, 'digest mismatch must fail closed');
clearArtifactCache(protectedFetch);
await assert.rejects(loadJsonArtifact(protectedFetch, './protected.json', { integrity: protectedDigest, maxBytes: 8 }), /byte budget exceeded/, 'oversized artifact must fail before publication into the cache');

let constraintCalls = 0;
const constraintFetch = async () => {
  constraintCalls += 1;
  return { ok: true, headers: { get: () => String(Buffer.byteLength(protectedText)) }, text: async () => protectedText };
};
assert.deepEqual(await loadJsonArtifact(constraintFetch, './constraint-key.json', { integrity: protectedDigest, maxBytes: 1024 }), JSON.parse(protectedText));
await assert.rejects(
  loadJsonArtifact(constraintFetch, './constraint-key.json', { integrity: protectedDigest, maxBytes: 8 }),
  /byte budget exceeded/,
  'a stricter byte budget must not reuse a value cached under a looser constraint'
);
assert.equal(constraintCalls, 2, 'maxBytes must participate in the artifact cache key');

const preAborted = new AbortController();
preAborted.abort();
let preAbortedCalls = 0;
await assert.rejects(loadJsonArtifact(async () => { preAbortedCalls += 1; throw new Error('must not fetch'); }, './pre-aborted.json', { signal: preAborted.signal }), { name: 'AbortError' });
assert.equal(preAbortedCalls, 0, 'already-aborted consumers must not start orphan requests');
const completions = [];
const ignoresAbort = () => new Promise(resolve => completions.push(resolve));
const oldController = new AbortController();
const oldPending = loadJsonArtifact(ignoresAbort, './retry.json', { signal: oldController.signal });
await Promise.resolve();
oldController.abort();
await assert.rejects(oldPending, { name: 'AbortError' });
const newPending = loadJsonArtifact(ignoresAbort, './retry.json');
await Promise.resolve();
assert.equal(completions.length, 2, 'a replacement consumer must not join an already-aborted request');
completions[0]({ ok: true, json: async () => ({ revision: 'old' }) });
await new Promise(resolve => setImmediate(resolve));
assert.equal(artifactCacheSnapshot(ignoresAbort).inFlight, 1, 'old cleanup must not delete the replacement request');
assert.equal(artifactCacheSnapshot(ignoresAbort).resolved, 0, 'an aborted late response must not populate the cache');
completions[1]({ ok: true, json: async () => ({ revision: 'new' }) });
assert.deepEqual(await newPending, { revision: 'new' });
assert.deepEqual(await loadJsonArtifact(ignoresAbort, './retry.json'), { revision: 'new' });

console.log(JSON.stringify({ ok: true, calls, isolatedCalls, timeoutAborted, allConsumersAborted, integrity: true, byteBudget: true, constraintCalls, abortedRetryIsolation: true, contract: 'artifact-cache.v4' }));
