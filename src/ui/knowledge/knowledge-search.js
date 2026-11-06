// Knowledge search ranker shared by the glossary modal, the research library and the command search (S23).
// It reads only the generated index (public-data/knowledge/search-index.json, rebuilt by
// scripts/build-knowledge-search-index.mjs and held equal by ci-knowledge-generated-parity-check), so a search
// no longer pulls learning-core and the rest of the research modules into the route (S17~S19).
import { normalize } from './glossary-bridge.js';

export const KNOWLEDGE_INDEX_URL = './public-data/knowledge/search-index.json';

let cached = null;
// One fetch per page; a failed load settles to an empty index so callers never wait on a dead promise.
export function loadKnowledgeIndex(fetchFn = globalThis.fetch?.bind(globalThis)) {
  if (cached) return cached;
  if (typeof fetchFn !== 'function') return Promise.resolve({ entries: [] });
  cached = fetchFn(KNOWLEDGE_INDEX_URL).then((response) => (response.ok ? response.json() : null)).catch(() => null)
    .then((json) => (json && Array.isArray(json.entries) ? json : { entries: [] }));
  return cached;
}

// Ranked matches: exact title or key > title prefix/contains > key contains > text contains.
// Returns [{ id, surface, surfaceLabel, title, text, group, keys, route: { page, params }, score }].
export function searchKnowledgeIndex(index, query, limit = 8) {
  const q = normalize(query);
  if (!q || q.length < 2) return [];
  const scored = [];
  for (const entry of index?.entries || []) {
    const title = normalize(entry.title);
    const keys = (entry.keys || []).map(normalize);
    const text = normalize(entry.text);
    let score = 0;
    if (title === q || keys.includes(q)) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (title.includes(q)) score = 60;
    else if (keys.some((key) => key.includes(q))) score = 50;
    else if (text.includes(q)) score = 20;
    if (score) scored.push({ entry, score: score + (entry.surface === 'frame' || entry.surface === 'column' ? 5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title)).slice(0, limit).map((item) => ({ ...item.entry, score: item.score }));
}
