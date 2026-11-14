// M02/A03 (Codex structure review 2026-10-12): artifacts several screens share (macro-history, breadth
// contributors) were loaded once per tab and then kept forever — `if (!root._aioMacroHistory)` skipped every later
// load, so a long-open tab mixed new closes with the first macro or breadth drilldown it ever saw. One owner decides
// when to reload: no copy yet, the copy is older than its TTL, or the server data was regenerated after the copy
// was loaded. Concurrent callers share one request; a failed load keeps the last good copy and may retry later.
import { loadJsonArtifact, stableFetcher } from './artifact-cache.js';

const stateOf = (root) => (root.__aioSharedArtifacts ||= {});
const serverGeneration = (root) => root?._serverDataMeta?.generatedAt || null;

export function sharedArtifactIsStale(root, key, { maxAgeMs, now = Date.now() } = {}) {
  const entry = stateOf(root)[key];
  if (!root[key] || !entry?.loadedAt) return true;
  if (now - entry.loadedAt > maxAgeMs) return true;
  // A copy belongs to the data.json generation it was loaded under (clocks compared only before any data.json arrived).
  const generation = serverGeneration(root);
  if (generation && entry.generation) return generation !== entry.generation;
  return (Date.parse(generation || '') || 0) > entry.loadedAt;
}

/** v58.80 (first-users bundle 3): 'ready' | 'loading' | 'failed' in the shared state words (domain/content/data-state.js). */
export function sharedArtifactState(root, key) {
  if (root?.[key]) return 'ready';
  const entry = root ? stateOf(root)[key] : null;
  return entry?.failedAt && !entry.inFlight ? 'failed' : 'loading';
}

/** The screener rows' load state, written by app/bootstrap.js startScreenerSync (v58.80 bundle 3). */
export const screenerRowsState = (root) => root?.__aioScreenerLoadState || 'loading';

/** Resolves to { payload, changed }. `changed` is true when a new copy replaced the old one. */
export function refreshSharedArtifact(root, { key, url, schemas, maxAgeMs = 60 * 60 * 1000, maxBytes = 2 * 1024 * 1024, now = Date.now() } = {}) {
  if (!root) return Promise.resolve({ payload: null, changed: false });
  const state = stateOf(root);
  const entry = (state[key] ||= { loadedAt: 0, failedAt: 0, inFlight: null });
  if (!sharedArtifactIsStale(root, key, { maxAgeMs, now })) return Promise.resolve({ payload: root[key], changed: false });
  if (entry.inFlight) return entry.inFlight;
  if (now - entry.failedAt < 60000) return Promise.resolve({ payload: root[key] || null, changed: false });
  const fetchFn = root.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') return Promise.resolve({ payload: root[key] || null, changed: false });
  // A reload carries data.json's minute token: the origin, not the CDN's ten-minute copy.
  const generation = serverGeneration(root);
  const requestUrl = root[key] ? `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(now / 60000)}` : url;
  entry.inFlight = loadJsonArtifact(stableFetcher(root), requestUrl, { maxAgeMs: 0, force: true, maxBytes })
    .then((payload) => {
      if (!schemas.includes(payload?.schemaVersion)) throw new Error('schema');
      const previous = root[key];
      if (previous?.generatedAt && payload.generatedAt && String(payload.generatedAt) < String(previous.generatedAt)) throw new Error('older copy');
      const changed = !previous || (payload.generatedAt || null) !== (previous.generatedAt || null);
      root[key] = payload;
      entry.loadedAt = Date.now();
      entry.generation = generation;
      return { payload, changed };
    })
    .catch(() => { entry.failedAt = Date.now(); return { payload: root[key] || null, changed: false }; })
    .finally(() => { entry.inFlight = null; });
  return entry.inFlight;
}
