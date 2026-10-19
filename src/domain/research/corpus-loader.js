// The supplied-materials corpus (source packets, claim ledger text, X-bookmark packets, ~400 KB) is reference material
// for the AI answer path and the knowledge views, never for first paint. It loads through this single memoized
// dynamic import so the deploy bundle emits it as its own chunk; boot-time consumers read ./reference-index.js.
let pending = null;

export function loadResearchCorpus() {
  if (!pending) {
    pending = import('./supplied-materials.js').catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
