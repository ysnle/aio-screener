const storesByFetch = new WeakMap();

function createAbortError() {
  try { return new DOMException('Artifact request aborted', 'AbortError'); }
  catch { const error = new Error('Artifact request aborted'); error.name = 'AbortError'; return error; }
}

function storeFor(fetchFn) {
  let store = storesByFetch.get(fetchFn);
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

async function decodeResponse(response, { requestUrl, integrity, maxBytes } = {}) {
  if (!integrity && !Number.isFinite(maxBytes)) return response.json();
  const declaredBytes = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(maxBytes) && Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new Error(`Artifact byte budget exceeded: ${requestUrl} (${declaredBytes} > ${maxBytes})`);
  }
  if (typeof response.text !== 'function') throw new Error(`Artifact text decoder unavailable: ${requestUrl}`);
  const text = await response.text();
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

export function loadJsonArtifact(fetchFn, url, { signal, maxAgeMs = 15 * 60 * 1000, maxEntries = 64, timeoutMs = 15_000, force = false, integrity = null, maxBytes = null } = {}) {
  if (typeof fetchFn !== 'function') return Promise.reject(new Error('artifact fetch function is unavailable'));
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
  if (shared) {
    store.shared += 1;
    return waitForConsumer(shared, signal);
  }
  store.misses += 1;
  const controller = new AbortController();
  const entry = { promise: null, controller, consumers: 0, settled: false, timer: null };
  const timeout = Math.max(100, Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : 15_000);
  const timeoutPromise = new Promise((_, reject) => {
    entry.timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Artifact timeout after ${timeout}ms: ${key}`));
    }, timeout);
  });
  const fetchPromise = Promise.resolve()
    .then(() => fetchFn(requestUrl, { signal: controller.signal }))
    .then((response) => {
      if (!response?.ok) throw new Error(`Artifact ${response?.status || 'ERR'}: ${requestUrl}`);
      return decodeResponse(response, { requestUrl, integrity: normalizedIntegrity, maxBytes: normalizedMaxBytes });
    });
  entry.promise = Promise.race([fetchPromise, timeoutPromise])
    .then((value) => {
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
      store.inFlight.delete(key);
    });
  store.inFlight.set(key, entry);
  return waitForConsumer(entry, signal);
}

export function clearArtifactCache(fetchFn) {
  if (typeof fetchFn === 'function') {
    const store = storesByFetch.get(fetchFn);
    for (const entry of store?.inFlight?.values?.() || []) entry.controller.abort();
    storesByFetch.delete(fetchFn);
  }
}

export function artifactCacheSnapshot(fetchFn) {
  const store = typeof fetchFn === 'function' ? storesByFetch.get(fetchFn) : null;
  return Object.freeze(store ? {
    resolved: store.resolved.size,
    inFlight: store.inFlight.size,
    hits: store.hits,
    misses: store.misses,
    shared: store.shared,
    evictions: store.evictions
  } : { resolved: 0, inFlight: 0, hits: 0, misses: 0, shared: 0, evictions: 0 });
}
