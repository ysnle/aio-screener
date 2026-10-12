// M02/A03 (Codex structure review 2026-10-12): artifacts several screens share (macro-history, breadth
// contributors) were loaded once per tab and then kept forever — `if (!root._aioMacroHistory)` skipped every later
// load, so a long-open tab mixed new closes with the first macro or breadth drilldown it ever saw. One owner decides
// when to reload: no copy yet, the copy is older than its TTL, or the server data was regenerated after the copy
// was loaded. Concurrent callers share one request; a failed load keeps the last good copy and may retry later.
import { loadJsonArtifact } from './artifact-cache.js';

const stateOf = (root) => (root.__aioSharedArtifacts ||= {});

export function sharedArtifactIsStale(root, key, { maxAgeMs, now = Date.now() } = {}) {
  const entry = stateOf(root)[key];
  if (!root[key] || !entry?.loadedAt) return true;
  if (now - entry.loadedAt > maxAgeMs) return true;
  const serverAt = Date.parse(root?._serverDataMeta?.generatedAt || '') || 0;
  return serverAt > entry.loadedAt;
}

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
  entry.inFlight = loadJsonArtifact(fetchFn.bind(root), url, { maxAgeMs: 0, force: true, maxBytes })
    .then((payload) => {
      if (!schemas.includes(payload?.schemaVersion)) throw new Error('schema');
      const previous = root[key];
      const changed = !previous || (payload.generatedAt || null) !== (previous.generatedAt || null);
      root[key] = payload;
      entry.loadedAt = Date.now();
      return { payload, changed };
    })
    .catch(() => { entry.failedAt = Date.now(); return { payload: root[key] || null, changed: false }; })
    .finally(() => { entry.inFlight = null; });
  return entry.inFlight;
}

export const MACRO_HISTORY = Object.freeze({ key: '_aioMacroHistory', url: './public-data/macro-history.json', schemas: ['macro-history.v1'], maxAgeMs: 60 * 60 * 1000 });
export const BREADTH_CONTRIBUTORS = Object.freeze({ key: '_aioBreadthContributors', url: './public-data/breadth-contributors.json', schemas: ['breadth-contributors.v1', 'breadth-contributors.v2'], maxAgeMs: 30 * 60 * 1000, maxBytes: 1024 * 1024 });
