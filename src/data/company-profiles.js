// v59.43: one owner for the researched company stories (public-data/company-profiles/). The index is small and shared;
// each story (~15 KB) is fetched only when its stock page opens and kept for the tab's life.
import { refreshSharedArtifact } from './shared-artifacts.js';
import { loadJsonArtifact, stableFetcher } from './artifact-cache.js';
// The story helpers and the renderer load with the first story, not at boot (architecture/boot-budget.json).
const storyHelpers = () => import('../domain/entity/company-story.js');

export const COMPANY_PROFILE_INDEX = Object.freeze({ key: '_aioCompanyProfileIndex', url: './public-data/company-profiles/index.json', schemas: ['company-profiles-index.v1'], maxAgeMs: 12 * 60 * 60 * 1000, maxBytes: 256 * 1024 });

const storeOf = (root) => (root.__aioCompanyStories ||= { rows: {}, context: {}, inFlight: {}, failed: {} });

/** The index row for a symbol, or null when it has no researched story (or the index has not arrived). */
export function companyProfileEntry(root, symbol) {
  const id = String(symbol || '').toUpperCase();
  return (root?.[COMPANY_PROFILE_INDEX.key]?.profiles || []).find((row) => String(row?.symbol || '').toUpperCase() === id) || null;
}

/** The loaded story for a symbol, or null. */
export function companyStoryFor(root, symbol) {
  return root ? storeOf(root).rows[String(symbol || '').toUpperCase()] || null : null;
}

/** Loads the index, then this symbol's story; onChange runs once the story (or a newer index) arrives. */
export function requestCompanyStory(root, symbol, onChange) {
  const id = String(symbol || '').toUpperCase();
  if (!root || !id) return;
  refreshSharedArtifact(root, COMPANY_PROFILE_INDEX).then(({ changed }) => {
    const entry = companyProfileEntry(root, id);
    const store = storeOf(root);
    const have = store.rows[id];
    if (!entry || !entry.file) { if (changed) onChange?.(); return; }
    if ((have && have.researchedAt === entry.researchedAt) || store.inFlight[id] || Date.now() - (store.failed[id] || 0) < 60000) { if (changed) onChange?.(); return; }
    store.inFlight[id] = Promise.all([loadJsonArtifact(stableFetcher(root), `./public-data/company-profiles/${encodeURIComponent(entry.file)}`, { maxAgeMs: 0, force: true, maxBytes: 256 * 1024 }), storyHelpers()])
      .then(([payload, { isCompanyStory, companyStoryContext }]) => {
        if (!isCompanyStory(payload, id)) throw new Error('shape');
        // The AI context reads the story as text from the store, so its boot module imports none of this.
        store.rows[id] = payload; store.context[id] = companyStoryContext(payload); onChange?.();
      })
      .catch(() => { store.failed[id] = Date.now(); })
      .finally(() => { delete store.inFlight[id]; });
  }).catch(() => {});
}
