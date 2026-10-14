// v57.54: one owner for the consensus estimates artifact, shared by the stock page and the screener column.
import { refreshSharedArtifact } from './shared-artifacts.js';

export const CONSENSUS_KEY = '_aioConsensusEstimates';

/** Loads (or reuses) the artifact; onChange runs only when a new copy replaced the old one. */
export function requestConsensusEstimates(root, onChange) {
  return refreshSharedArtifact(root, { key: CONSENSUS_KEY, url: './public-data/consensus-estimates.json', schemas: ['consensus-estimates.v1'], maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 1024 * 1024 })
    .then(({ changed }) => { if (changed) onChange?.(); })
    .catch(() => {});
}

export function consensusRowFor(root, symbol) {
  return root?.[CONSENSUS_KEY]?.rows?.[String(symbol || '').toUpperCase()] || null;
}
