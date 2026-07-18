import { readFile, writeFile } from 'node:fs/promises';
import { createReconciliationStatus, validateReconciliationStatus } from '../src/data/contracts/reconciliation.js';

export const RECONCILIATION_STATUS_OUT = new URL('../public-data/reconciliation-status.json', import.meta.url);

const CATEGORY_STATUS = Object.freeze([
  ['market-quotes', 'PARTIAL', 'Tier 0 snapshot is complete; broader quote universe and field-level source reconciliation remain separate.'],
  ['volatility', 'PARTIAL', 'VIX/VIX3M are in Tier 0; VVIX and long-term term-structure history are not fully reconciled.'],
  ['fear-greed', 'PARTIAL', 'Latest score is present in the durable artifact; source and historical coverage are not fully reconciled.'],
  ['put-call', 'MATCH', 'Cboe delayed artifact is retained with as-of metadata.'],
  ['aaii', 'BLOCKED', 'Licensed/current direct value is unavailable; exact search-derived percentages are forbidden.'],
  ['naaim', 'BLOCKED', 'Licensed/current direct value is unavailable; only bounded inference may be used.'],
  ['investors-intelligence', 'BLOCKED', 'Licensed/current direct value is unavailable; subscriber data must not be synthesized.'],
  ['us-breadth', 'PARTIAL', 'AIO universe breadth is available, but official exchange breadth is a different source contract.'],
  ['kr-breadth', 'PARTIAL', 'Korean breadth is available from the AIO universe; field-level historical reconciliation is pending.'],
  ['breadth-history', 'BLOCKED', 'Daily breadth history and McClellan A/D producer are not yet durable.'],
  ['treasury-curve', 'PARTIAL', 'Official series and runtime curve are present, but all series point-level reconciliation is pending.'],
  ['hy-oas', 'BLOCKED', 'FRED HY OAS server ingest is not yet in the published UI success path.'],
  ['cpi-pce', 'MATCH', 'BLS/BEA reference values are represented in the current data contract.'],
  ['employment-wages', 'MATCH', 'Employment and wage reference values are represented with official-source metadata.'],
  ['retail-housing-ism', 'PARTIAL', 'Retail/housing inputs exist; ISM release-aware direct adapter is not complete.'],
  ['central-bank-policy', 'PARTIAL', 'Official reference registry exists; current statement/rate point-level reconciliation is pending.'],
  ['macro-calendar', 'PARTIAL', 'Release calendar is explicit, but automatic release-aware ingestion is not complete.'],
  ['news', 'PARTIAL', 'News artifact has source metadata; full article-level source and translation reconciliation is pending.'],
  ['commodities-fx', 'PARTIAL', 'Tier 0 commodities/FX are present; settlement-vs-spot and full history reconciliation is pending.'],
  ['global-indices', 'PARTIAL', 'Global index snapshot is present; broader historical and session reconciliation is pending.'],
  ['crypto', 'PARTIAL', 'Crypto quotes are available with observed/fetched timestamps; full 24/7 history reconciliation is pending.'],
  ['kr-macro-vkospi-supply', 'BLOCKED', 'Approved KRX/Koscom provider and VKOSPI rights are unresolved; unavailable must remain explicit.']
]);

function stableRevision(snapshot) {
  return `reconciliation:${snapshot?.revision || 'no-market-snapshot'}:${CATEGORY_STATUS.length}`;
}

export async function writeReconciliationStatus({ marketSnapshot, now = new Date().toISOString() } = {}) {
  const categories = CATEGORY_STATUS.map(([categoryId, status, reason]) => ({
    categoryId,
    status,
    sourceClass: status === 'MATCH' ? 'OBSERVED_OFFICIAL' : status === 'BLOCKED' ? 'UNAVAILABLE' : 'PARTIAL',
    reason,
    marketSnapshotRevision: marketSnapshot?.revision || null,
    checkedAt: now
  }));
  const counts = {};
  for (const category of categories) counts[category.status] = (counts[category.status] || 0) + 1;
  const status = createReconciliationStatus({
    generatedAt: now,
    revision: stableRevision(marketSnapshot),
    overall: counts.BLOCKED > 0 || counts.PARTIAL > 0 ? 'PARTIAL' : 'MATCH',
    counts,
    categories
  });
  const validation = validateReconciliationStatus(status);
  if (!validation.ok) throw new Error(`RECONCILIATION_STATUS_INVALID:${validation.errors.join(',')}`);
  await writeFile(RECONCILIATION_STATUS_OUT, `${JSON.stringify(status, null, 2)}\n`);
  return status;
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  const snapshot = JSON.parse(await readFile(new URL('../public-data/market-snapshot.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(await writeReconciliationStatus({ marketSnapshot: snapshot })));
}
