// v59.70 (ui-states): stand-in for src/data/freshness.js (aio-freshness.v1, actions-reliability branch, not merged yet).
// Same signature; always 'unknown', so a badge draws only its basis session until the real reader replaces this import
// in src/ui/components/freshness-badge.js at integration.
export function readArtifactFreshness(_file) {
  return { state: 'unknown', producedAt: null, checkedAt: null, basisSession: { US: null, KR: null }, workflow: null };
}
