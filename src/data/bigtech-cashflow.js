// One reader for the big-tech cash-flow artifact's group total. The file's own clock (generatedAt) is when its content
// last changed: quarterly filings stay the same for weeks and the publisher keeps the published bytes on a run that
// only moved the timestamp, so an age limit on that clock hid a healthy file ten days after the last filing. Whether the
// producer is alive is the freshness ledger's question (data/freshness.js); the artifact's clock is only the fallback
// while the ledger has not loaded.
import { BIGTECH_CASHFLOW } from './artifact-registry.js';
import { readArtifactFreshness } from './freshness.js';
import { unchangedArtifactUsable } from './contracts/artifact-freshness.js';

export const BIGTECH_OWN_CLOCK_MAX_AGE_MS = 10 * 86400000;

/** The hyperscalers' twelve-month total (quarterly-cashflow.js groupCashflow), or null when missing or stale. */
export function bigtechGroupFor(root, { now = Date.now() } = {}) {
  const payload = root?.[BIGTECH_CASHFLOW.key];
  if (!payload?.hyperscalers) return null;
  const { state } = readArtifactFreshness('bigtech-cashflow.json', { root, now });
  return unchangedArtifactUsable(state, payload.generatedAt, now, BIGTECH_OWN_CLOCK_MAX_AGE_MS) ? payload.hyperscalers : null;
}
