import { loadJsonArtifact } from '../artifact-cache.js';

// P30-LOAD-01: the artifact cache keeps a parsed copy for 15 minutes whether or not it passed validation, so a retry
// re-read the same invalid copy and never saw the corrected file. A copy that failed validation is fetched again
// (force) — but at most once a minute per file, like the shared-artifact retry limit, so a search box that reloads
// on every key does not turn one bad file into a request per key. Only that file is refetched; other cached
// artifacts are kept.
const RETRY_AFTER_MS = 60 * 1000;
const rejectedByFetch = new WeakMap();
const rejectedFor = (fetchFn) => {
  let rejected = rejectedByFetch.get(fetchFn);
  if (!rejected) { rejected = new Map(); rejectedByFetch.set(fetchFn, rejected); }
  return rejected;
};

export async function loadKnowledgeCapabilities(fetchFn, definitions = [], { signal, now = () => Date.now() } = {}) {
  const entries = definitions.map((definition) => Object.freeze({ key: definition.key, url: definition.url, validate: definition.validate }));
  const rejected = typeof fetchFn === 'function' ? rejectedFor(fetchFn) : new Map();
  const settled = await Promise.allSettled(entries.map(async ({ url, validate }) => {
    const rejectedAt = rejected.get(url);
    const force = rejectedAt != null && now() - rejectedAt >= RETRY_AFTER_MS;
    const value = await loadJsonArtifact(fetchFn, url, { signal, force });
    if (typeof validate === 'function' && !validate(value)) {
      if (rejectedAt == null || force) rejected.set(url, now());
      throw new Error(`artifact validation failed: ${url}`);
    }
    rejected.delete(url);
    return value;
  }));
  return Object.freeze(Object.fromEntries(entries.map((entry, index) => {
    const result = settled[index];
    return [entry.key, Object.freeze(result.status === 'fulfilled'
      ? { status: 'connected', value: result.value, error: null }
      : { status: 'fallback', value: null, error: String(result.reason?.message || result.reason || 'unknown error') })];
  })));
}
