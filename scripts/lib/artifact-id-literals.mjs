// v59.87 (ADR-0003 S2): the artifact ids a source file names through src/data/artifact-registry.js — artifactUrl('id'),
// loadArtifact(root, 'id') and the registry's own shared('id', …) descriptors. The runtime reader scans
// (ci-artifact-refresh-path-check, ci-data-boundary-fixture) read these beside the older 'public-data/<file>' literals.
const ID_CALL = /\b(?:artifactUrl|shared)\(\s*'([a-z0-9][a-z0-9./-]*\.json)'|\bloadArtifact\(\s*[^,()]+(?:\([^()]*\))?\s*,\s*'([a-z0-9][a-z0-9./-]*\.json)'/g;

/** Every artifact id (path under public-data/) the text passes to the registry. */
export function artifactIdLiterals(text) {
  return [...String(text).matchAll(ID_CALL)].map((match) => match[1] || match[2]);
}
