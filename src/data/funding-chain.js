// One owner for the AI funding chain's inputs: the big-tech cash-flow file, the macro history and the hand-researched
// reference. The 테마 chain, the pointers on 매크로 and the chat tool all read the same three copies through here, so a
// figure the screen shows and a figure the chat quotes come from one read.
import { refreshSharedArtifact, sharedArtifactState } from './shared-artifacts.js';
import { BIGTECH_CASHFLOW, MACRO_HISTORY, RESEARCH_REFERENCE } from './artifact-registry.js';
import { bigtechGroupFor } from './bigtech-cashflow.js';
import { requestResearchReference } from './research-reference.js';

/** Asks for the three artifacts (joined with any request in flight); onChange runs when a new copy lands. */
export function requestFundingChainInputs(root, onChange) {
  requestResearchReference(root, onChange);
  for (const artifact of [BIGTECH_CASHFLOW, MACRO_HISTORY]) refreshSharedArtifact(root, artifact).then(({ changed } = {}) => { if (changed) onChange?.(); }).catch(() => {});
}

/** Resolves once each artifact has loaded or failed; a failed one is simply absent from the inputs. */
export function loadFundingChainInputs(root) {
  return Promise.all([RESEARCH_REFERENCE, BIGTECH_CASHFLOW, MACRO_HISTORY].map((artifact) => refreshSharedArtifact(root, artifact).catch(() => null)));
}

/** The copies in hand, shaped as aiFundingChain's input. `nowMs` comes from the caller's clock. */
export function fundingChainInputs(root, { nowMs }) {
  return {
    // The cash-flow file only while its reader judges it usable (a dead producer's quarters are not today's figures).
    cashflow: bigtechGroupFor(root, { now: nowMs }) ? root[BIGTECH_CASHFLOW.key] : null,
    macroHistory: root?.[MACRO_HISTORY.key] || null,
    research: root?.[RESEARCH_REFERENCE.key] || null,
    researchLoadState: sharedArtifactState(root, RESEARCH_REFERENCE.key) === 'failed' ? 'failed' : 'loading',
    nowMs
  };
}
