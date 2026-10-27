import { readBodyText } from '../platform/http.js';

const storesByFetch = new WeakMap();
// v57.77 perf: callers passed `root.fetch.bind(root)`, a new function on every call, so an identity-keyed store was
// always empty and `maxAgeMs` never applied. v57.77 shared one store per bound *name*; v58.64 (architecture audit M1):
// a name cannot tell two transports or test roots apart (both read 'bound fetch'), and pages that passed the unbound
// root.fetch kept a second store that a forced refresh never cleared. stableFetcher(root) hands out one bound fetch
// per root, so the store is keyed by an identity that really is the owner.
const fetchersByRoot = new WeakMap();
export function stableFetcher(root = globalThis) {
  const owner = root && typeof root.fetch === 'function' ? root : globalThis;
  const source = owner.fetch;
  if (typeof source !== 'function') return null;
  const known = fetchersByRoot.get(owner);
  if (known && known.source === source) return known.bound;
  const bound = source.bind(owner);
  fetchersByRoot.set(owner, { source, bound });
  return bound;
}

// A timer that runs this much after its due time was held by a busy page (P2108).
const LATE_TIMER_MS = 1000;

function createAbortError() {
  try { return new DOMException('Artifact request aborted', 'AbortError'); }
  catch { const error = new Error('Artifact request aborted'); error.name = 'AbortError'; return error; }
}

function existingStoreFor(fetchFn) {
  return storesByFetch.get(fetchFn);
}

function storeFor(fetchFn) {
  let store = existingStoreFor(fetchFn);
  if (!store) {
    store = { resolved: new Map(), inFlight: new Map(), hits: 0, misses: 0, shared: 0, evictions: 0 };
    storesByFetch.set(fetchFn, store);
  }
  return store;
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') throw new Error('Artifact integrity verification unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// v58.80 (first-users run-3): the body is read through readBodyText, so a slow but moving download is not cut by the
// request timeout (the 1 MB SEC summary never finished on 3G); only `stallMs` of silence ends it.
async function decodeResponse(response, { requestUrl, integrity, maxBytes, stallMs, onStall } = {}) {
  const streamed = typeof response?.body?.getReader === 'function';
  if (!integrity && !Number.isFinite(maxBytes)) return streamed ? JSON.parse(await readBodyText(response, { stallMs, onStall })) : response.json();
  const declaredBytes = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(maxBytes) && Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new Error(`Artifact byte budget exceeded: ${requestUrl} (${declaredBytes} > ${maxBytes})`);
  }
  if (!streamed && typeof response.text !== 'function') throw new Error(`Artifact text decoder unavailable: ${requestUrl}`);
  const text = streamed ? await readBodyText(response, { stallMs, onStall }) : await response.text();
  const observedBytes = new TextEncoder().encode(text).byteLength;
  if (Number.isFinite(maxBytes) && observedBytes > maxBytes) {
    throw new Error(`Artifact byte budget exceeded: ${requestUrl} (${observedBytes} > ${maxBytes})`);
  }
  if (integrity) {
    const expected = String(integrity).replace(/^sha256[:-]/i, '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Artifact integrity declaration invalid: ${requestUrl}`);
    const actual = await sha256Hex(text);
    if (actual !== expected) throw new Error(`Artifact integrity mismatch: ${requestUrl}`);
  }
  return JSON.parse(text);
}

function waitForConsumer(entry, signal) {
  if (signal?.aborted) return Promise.reject(createAbortError());
  entry.consumers += 1;
  return new Promise((resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (signal) signal.removeEventListener('abort', abort);
      entry.consumers = Math.max(0, entry.consumers - 1);
      if (!entry.settled && entry.consumers === 0) entry.controller.abort();
    };
    const abort = () => { cleanup(); reject(createAbortError()); };
    if (signal) signal.addEventListener('abort', abort, { once: true });
    entry.promise.then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); }
    );
  });
}

export function loadJsonArtifact(fetchFn, url, { signal, maxAgeMs = 15 * 60 * 1000, maxEntries = 64, timeoutMs = 15_000, stallMs = 20_000, force = false, integrity = null, maxBytes = null } = {}) {
  if (typeof fetchFn !== 'function') return Promise.reject(new Error('artifact fetch function is unavailable'));
  if (signal?.aborted) return Promise.reject(createAbortError());
  const requestUrl = String(url);
  const normalizedIntegrity = integrity ? String(integrity).replace(/^sha256[:-]/i, '').toLowerCase() : null;
  const parsedMaxBytes = Number(maxBytes);
  const normalizedMaxBytes = maxBytes != null && Number.isFinite(parsedMaxBytes) && parsedMaxBytes > 0 ? parsedMaxBytes : null;
  const constraintKey = [
    normalizedIntegrity ? `sha256=${normalizedIntegrity}` : null,
    normalizedMaxBytes != null ? `maxBytes=${normalizedMaxBytes}` : null
  ].filter(Boolean).join('&');
  const key = constraintKey ? `${requestUrl}#${constraintKey}` : requestUrl;
  const store = storeFor(fetchFn);
  const cached = store.resolved.get(key);
  if (!force && cached && Date.now() - cached.storedAt <= maxAgeMs) {
    store.hits += 1;
    store.resolved.delete(key);
    store.resolved.set(key, cached);
    if (signal?.aborted) return Promise.reject(createAbortError());
    return Promise.resolve(cached.value);
  }
  if (cached) store.resolved.delete(key);
  const shared = store.inFlight.get(key);
  if (shared && !shared.controller.signal.aborted) {
    store.shared += 1;
    return waitForConsumer(shared, signal);
  }
  store.misses += 1;
  const controller = new AbortController();
  const entry = { promise: null, controller, consumers: 0, settled: false, timer: null };
  const timeout = Math.max(100, Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : 15_000);
  let fail = null;
  const timeoutPromise = new Promise((_, reject) => {
    fail = (reason) => { controller.abort(); reject(new Error(`${reason}: ${key}`)); };
    // P2108: a deadline that fires late means the page was busy (a long task), not that the network was slow, and the
    // response may be queued behind it; give it a short grace instead of aborting a request that already arrived.
    const arm = (ms) => {
      const due = Date.now() + ms;
      entry.timer = setTimeout(() => (Date.now() - due > LATE_TIMER_MS ? arm(LATE_TIMER_MS) : fail(`Artifact timeout after ${timeout}ms`)), ms);
    };
    arm(timeout);
  });
  const fetchPromise = Promise.resolve()
    .then(() => {
      if (controller.signal.aborted) throw createAbortError();
      return fetchFn(requestUrl, { signal: controller.signal });
    })
    .then((response) => {
      if (!response?.ok) throw new Error(`Artifact ${response?.status || 'ERR'}: ${requestUrl}`);
      if (typeof response?.body?.getReader === 'function') clearTimeout(entry.timer); // headers arrived; a streamed body is bounded by stallMs
      return decodeResponse(response, { requestUrl, integrity: normalizedIntegrity, maxBytes: normalizedMaxBytes, stallMs, onStall: () => fail(`Artifact stalled for ${stallMs}ms`) });
    });
  entry.promise = Promise.race([fetchPromise, timeoutPromise])
    .then((value) => {
      if (controller.signal.aborted) throw createAbortError();
      store.resolved.set(key, { value, storedAt: Date.now() });
      const entryLimit = Math.max(1, Number.isFinite(Number(maxEntries)) ? Math.floor(Number(maxEntries)) : 64);
      while (store.resolved.size > entryLimit) {
        const oldestKey = store.resolved.keys().next().value;
        store.resolved.delete(oldestKey);
        store.evictions += 1;
      }
      return value;
    })
    .finally(() => {
      entry.settled = true;
      clearTimeout(entry.timer);
      if (store.inFlight.get(key) === entry) store.inFlight.delete(key);
    });
  store.inFlight.set(key, entry);
  return waitForConsumer(entry, signal);
}

export function clearArtifactCache(fetchFn, { abortInFlight = true } = {}) {
  if (typeof fetchFn === 'function') {
    const store = existingStoreFor(fetchFn);
    // v57.79: a manual refresh drops held entries but lets requests already in flight finish for their callers.
    if (!abortInFlight) { store?.resolved?.clear?.(); return; }
    for (const entry of store?.inFlight?.values?.() || []) entry.controller.abort();
    storesByFetch.delete(fetchFn);
  }
}

export function artifactCacheSnapshot(fetchFn) {
  const store = typeof fetchFn === 'function' ? existingStoreFor(fetchFn) : null;
  return Object.freeze(store ? {
    resolved: store.resolved.size,
    inFlight: store.inFlight.size,
    hits: store.hits,
    misses: store.misses,
    shared: store.shared,
    evictions: store.evictions
  } : { resolved: 0, inFlight: 0, hits: 0, misses: 0, shared: 0, evictions: 0 });
}
