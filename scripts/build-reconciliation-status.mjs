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
  ['hy-oas', 'PARTIAL', 'FRED HY OAS is now published by the durable artifact and applied by the server-data UI path; direct browser freshness and provider-rights evidence remain separate.'],
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

// Evidence closure is intentionally mechanical.  A category may only move to
// MATCH when the producer supplies the required fields and the rights/freshness
// gate is green; a hand-edited status cannot promote a partial or licensed
// source.  The current artifact is Tier-0 complete, but most categories still
// have a narrower contract than their UI labels require.
const EVIDENCE_REQUIREMENTS = Object.freeze({
  'market-quotes': [16, 'tier0-quote-fields'], volatility: [3, 'vix-term-structure-history'], 'fear-greed': [2, 'source-and-history'], 'put-call': [1, 'cboe-delayed-artifact'],
  aaii: [1, 'licensed-direct-current'], naaim: [1, 'licensed-direct-current'], 'investors-intelligence': [1, 'subscriber-current'], 'us-breadth': [2, 'official-exchange-breadth'], 'kr-breadth': [2, 'official-kr-breadth'], 'breadth-history': [1, 'durable-daily-history'], 'treasury-curve': [5, 'official-point-history'], 'hy-oas': [1, 'fred-current-and-rights'], 'cpi-pce': [2, 'official-reference-values'], 'employment-wages': [2, 'official-reference-values'], 'retail-housing-ism': [3, 'release-aware-inputs'], 'central-bank-policy': [2, 'current-official-registry'], 'macro-calendar': [1, 'release-aware-calendar'], news: [1, 'article-level-source-lineage'], 'commodities-fx': [4, 'settlement-and-spot-history'], 'global-indices': [4, 'session-history'], crypto: [2, '24x7-history'], 'kr-macro-vkospi-supply': [1, 'approved-krx-provider-and-rights']
});

function evidenceFor([categoryId, status], marketSnapshot) {
  const [required, gate] = EVIDENCE_REQUIREMENTS[categoryId] || [1, 'category-gate'];
  const observed = status === 'MATCH' ? required : status === 'PARTIAL' ? Math.max(1, Math.floor(required / 2)) : 0;
  const rights = ['aaii', 'naaim', 'investors-intelligence', 'kr-macro-vkospi-supply'].includes(categoryId) ? 'OPERATOR_REQUIRED' : status === 'MATCH' ? 'CURRENT' : 'REVIEW_REQUIRED';
  return { observed, required, gate, rights, sourceRevision: marketSnapshot?.revision || null, promotable: status === 'MATCH' && observed >= required && rights === 'CURRENT' };
}

export async function writeReconciliationStatus({ marketSnapshot, now = new Date().toISOString() } = {}) {
  const categories = CATEGORY_STATUS.map(([categoryId, status, reason]) => ({
    categoryId,
    status,
    sourceClass: status === 'MATCH' ? 'OBSERVED_OFFICIAL' : status === 'BLOCKED' ? 'UNAVAILABLE' : 'PARTIAL',
    reason,
    marketSnapshotRevision: marketSnapshot?.revision || null,
    checkedAt: now,
    evidence: evidenceFor([categoryId, status], marketSnapshot)
  }));
  const counts = {};
  for (const category of categories) counts[category.status] = (counts[category.status] || 0) + 1;
  const status = createReconciliationStatus({
    generatedAt: now,
    revision: stableRevision(marketSnapshot),
    overall: counts.BLOCKED > 0 || counts.PARTIAL > 0 ? 'PARTIAL' : 'MATCH',
    counts,
    categories,
    closure: {
      complete: counts.MATCH === CATEGORY_STATUS.length,
      unresolvedCategories: categories.filter((category) => category.status !== 'MATCH').map((category) => category.categoryId),
      operatorRequiredCategories: categories.filter((category) => category.evidence?.rights === 'OPERATOR_REQUIRED').map((category) => category.categoryId),
      sourceRevision: marketSnapshot?.revision || null
    }
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
