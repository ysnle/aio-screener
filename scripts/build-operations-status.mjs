import { readFile, writeFile } from 'node:fs/promises';
import { createOperationsStatus, validateOperationsStatus } from '../src/data/contracts/operations.js';

export const OPERATIONS_STATUS_OUT = new URL('../public-data/operations-status.json', import.meta.url);

export async function writeOperationsStatus({ data, marketSnapshot, reconciliation, now = new Date().toISOString() } = {}) {
  const version = JSON.parse(await readFile(new URL('../version.json', import.meta.url), 'utf8'));
  const snapshot = marketSnapshot || {};
  const coverage = snapshot.coverage || { tier0Required: 0, tier0Observed: 0 };
  const durableOk = snapshot.status === 'published' && coverage.tier0Observed === coverage.tier0Required && coverage.tier0Required > 0;
  const blockers = [];
  if (!durableOk) blockers.push('durable_tier0_publish_blocked');
  blockers.push('fast_plane_cloudflare_credentials_and_soak_required');
  blockers.push('provider_rights_review_required');
  if (Number(data?.meta?.fundamentalCoveragePct || 0) < 80) blockers.push('sec_fundamentals_coverage_below_80_percent');
  const status = createOperationsStatus({
    generatedAt: now,
    appRevision: version.version,
    dataRevision: snapshot.revision || `public-data:${data?.meta?.generatedAt || 'unknown'}`,
    evidenceRevision: 'evidence-contract:v1+inferred-claim:v1+reconciliation:v1',
    overall: durableOk ? 'OPERATOR_REQUIRED' : 'BLOCKED',
    planes: {
      durable: { status: durableOk ? 'CURRENT' : 'BLOCKED', source: 'github-actions', lastSuccessfulAt: snapshot.lastSuccessfulAt || null, coverage },
      fast: { status: 'OPERATOR_REQUIRED', scheduler: 'cloudflare-cron', endpoint: 'not-configured', soak: { requiredDays: 7, observedDays: 0, targetSuccessRate: 0.99 } },
      browser: { status: 'CURRENT', source: 'static-pages+service-worker', revision: version.version }
    },
    providers: {
      yahoo: { rights: 'REVIEW_REQUIRED', use: 'reference', lastFetchAt: data?.meta?.generatedAt || null },
      fred: { rights: process.env.FRED_API_KEY ? 'REVIEW_REQUIRED' : 'OPERATOR_REQUIRED', use: 'official-series', lastFetchAt: data?.meta?.generatedAt || null },
      sec: { rights: 'REVIEW_REQUIRED', use: 'filing-evidence', coveragePct: Number(data?.meta?.fundamentalCoveragePct || 0) }
    },
    reconciliation: {
      tier0: { status: durableOk ? 'MATCH' : 'BLOCKED', artifact: snapshot.revision || null, uiEvidence: durableOk ? 'same-revision-contract' : null, observedAtComplete: durableOk },
      artifact: 'public-data/reconciliation-status.json',
      categoryCount: reconciliation?.categories?.length || 0,
      overall: reconciliation?.overall || 'BLOCKED',
      counts: reconciliation?.counts || {},
      routeCount: 17,
      rawProducerClaimGate: 'not_applicable_for_quote_plane'
    },
    routes: { supported: 17, nativeOwner: ['sentiment'], legacyOwner: 16, cutoverStatus: 'MIGRATION_IN_PROGRESS' },
    blockers
  });
  const validation = validateOperationsStatus(status);
  if (!validation.ok) throw new Error(`OPERATIONS_STATUS_INVALID:${validation.errors.join(',')}`);
  await writeFile(OPERATIONS_STATUS_OUT, `${JSON.stringify(status, null, 2)}\n`);
  return status;
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  const data = JSON.parse(await readFile(new URL('../public-data/data.json', import.meta.url), 'utf8'));
  const marketSnapshot = JSON.parse(await readFile(new URL('../public-data/market-snapshot.json', import.meta.url), 'utf8'));
  let reconciliation = null;
  try { reconciliation = JSON.parse(await readFile(new URL('../public-data/reconciliation-status.json', import.meta.url), 'utf8')); } catch (_) {}
  console.log(JSON.stringify(await writeOperationsStatus({ data, marketSnapshot, reconciliation })));
}
