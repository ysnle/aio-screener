// v57.54: one owner for the consensus estimates artifact, shared by the stock page and the screener column.
import { refreshSharedArtifact } from './shared-artifacts.js';
import { CONSENSUS_ESTIMATES } from './artifact-registry.js';

export const CONSENSUS_KEY = CONSENSUS_ESTIMATES.key;

/** Loads (or reuses) the artifact; onChange runs only when a new copy replaced the old one. */
export function requestConsensusEstimates(root, onChange) {
  return refreshSharedArtifact(root, CONSENSUS_ESTIMATES)
    .then(({ changed }) => { if (changed) onChange?.(); })
    .catch(() => {});
}

export function consensusRowFor(root, symbol) {
  return root?.[CONSENSUS_KEY]?.rows?.[String(symbol || '').toUpperCase()] || null;
}
