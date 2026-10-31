// v59.43: one owner for the researched company stories (public-data/company-profiles/). The index is small and shared;
// each story (~15 KB) is fetched only when its stock page opens and kept for the tab's life.
import { refreshSharedArtifact } from './shared-artifacts.js';
import { loadJsonArtifact, stableFetcher } from './artifact-cache.js';
// The story helpers and the renderer load with the first story, not at boot (architecture/boot-budget.json).
const storyHelpers = () => import('../domain/entity/company-story.js');

export const COMPANY_PROFILE_INDEX = Object.freeze({ key: '_aioCompanyProfileIndex', url: './public-data/company-profiles/index.json', schemas: ['company-profiles-index.v1'], maxAgeMs: 12 * 60 * 60 * 1000, maxBytes: 256 * 1024 });

const storeOf = (root) => { const store = (root.__aioCompanyStories ||= { rows: {}, context: {}, inFlight: {}, failed: {} }); store.entries ||= {}; return store; };

/** The index row for a symbol, or null when it has no researched story (or the index has not arrived). */
export function companyProfileEntry(root, symbol) {
  const id = String(symbol || '').toUpperCase();
  return (root?.[COMPANY_PROFILE_INDEX.key]?.profiles || []).find((row) => String(row?.symbol || '').toUpperCase() === id) || null;
}

/** The loaded story for a symbol, or null. */
export function companyStoryFor(root, symbol) {
  return root ? storeOf(root).rows[String(symbol || '').toUpperCase()] || null : null;
}

/** True when a loaded story is the one the index row describes (research date, period, content hash when present). */
export function storyMatchesEntry(story, entry, read = null) {
  if (!story || !entry) return false;
  if (story.researchedAt !== entry.researchedAt) return false;
  if (read && (read.period !== entry.period || read.file !== entry.file)) return false;
  return entry.contentHash == null || read?.contentHash === entry.contentHash;
}

/** Loads the index, then this symbol's story; onChange runs once the story (or a newer index) arrives. */
export function requestCompanyStory(root, symbol, onChange) {
  const id = String(symbol || '').toUpperCase();
  if (!root || !id) return;
  refreshSharedArtifact(root, COMPANY_PROFILE_INDEX).then(({ changed }) => {
    const entry = companyProfileEntry(root, id);
    const store = storeOf(root);
    const have = store.rows[id];
    // v59.45 (pipeline review P25-STORY-02): a story withdrawn from the index leaves the store (and the AI context) too,
    // and a kept story must match the index row's research date, period and — once the index carries it — content hash;
    // the research date alone did not see a same-day correction.
    if (!entry || !entry.file) { if (store.rows[id]) { delete store.rows[id]; delete store.context[id]; delete store.entries[id]; onChange?.(); } else if (changed) onChange?.(); return; }
    if ((have && storyMatchesEntry(have, entry, store.entries[id])) || store.inFlight[id] || Date.now() - (store.failed[id] || 0) < 60000) { if (changed) onChange?.(); return; }
    store.inFlight[id] = Promise.all([loadJsonArtifact(stableFetcher(root), `./public-data/company-profiles/${encodeURIComponent(entry.file)}`, { maxAgeMs: 0, force: true, maxBytes: 256 * 1024 }), storyHelpers()])
      .then(([payload, { isCompanyStory, companyStoryContext }]) => {
        if (!isCompanyStory(payload, id)) throw new Error('shape');
        // The AI context reads the story as text from the store, so its boot module imports none of this.
        // The index row it was read against travels with it; a newer index arriving mid-read is checked on the next call.
        store.rows[id] = payload; store.entries[id] = { ...entry }; store.context[id] = companyStoryContext(payload); onChange?.();
      })
      .catch(() => { store.failed[id] = Date.now(); })
      .finally(() => { delete store.inFlight[id]; });
  }).catch(() => {});
}
