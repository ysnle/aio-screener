import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mastersDir = path.join(root, 'public-data', 'masters');
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(mastersDir, name), 'utf8'));

async function writeAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

const [holdings, historyIndex, historyRows, issuerAggregates, mastersIndex, filingDiscovery, managerPrinciples, securityMaster] = await Promise.all([
  readJson('holdings.json'),
  readJson('history-index.json'),
  readJson('history-holdings.json'),
  readJson('issuer-aggregates.json'),
  readJson('index.json'),
  readJson('filing-discovery.json'),
  readJson('manager-principles.json'),
  readJson('security-master.json')
]);

const generatedAt = holdings.generatedAt || [holdings.reviewedAt, historyIndex.reviewedAt, historyRows.reviewedAt, issuerAggregates.reviewedAt].filter(Boolean).sort().at(-1) || '1970-01-01';
const managerShards = {};
for (const manager of holdings.managers || []) {
  const descriptor = holdings.managerShards?.[manager.id] || null;
  let managerRows = (holdings.allHoldings || []).filter((row) => row.managerId === manager.id);
  let managerComparisons = (holdings.comparisons || []).filter((row) => row.managerId === manager.id);
  const file = path.join(mastersDir, 'managers', `${manager.id}.json`);
  if (!managerRows.length && descriptor?.fullRows > 0) {
    const existing = JSON.parse(await fs.readFile(file, 'utf8'));
    if (existing.managerId !== manager.id || existing.holdings?.length !== descriptor.fullRows || existing.comparisons?.length !== descriptor.comparisonRows) {
      throw new Error(`manager shard integrity mismatch for ${manager.id}: expected ${descriptor.fullRows}/${descriptor.comparisonRows}, got ${existing.holdings?.length || 0}/${existing.comparisons?.length || 0}`);
    }
    managerRows = existing.holdings;
    managerComparisons = existing.comparisons;
  } else {
    await writeAtomic(file, {
      schema: 'masters-13f-manager-rows.v1',
      sourceKind: holdings.sourceKind,
      reviewedAt: holdings.reviewedAt,
      generatedAt,
      managerId: manager.id,
      cik: manager.cik,
      latestFiling: manager.latestFiling,
      priorFiling: manager.priorFiling || null,
      verification: manager.verification,
      holdings: managerRows,
      comparisons: managerComparisons
    });
  }
  if (descriptor && (managerRows.length !== descriptor.fullRows || managerComparisons.length !== descriptor.comparisonRows)) {
    throw new Error(`manager shard descriptor drift for ${manager.id}: expected ${descriptor.fullRows}/${descriptor.comparisonRows}, got ${managerRows.length}/${managerComparisons.length}`);
  }
  managerShards[manager.id] = {
    url: `./public-data/masters/managers/${manager.id}.json`,
    fullRows: managerRows.length,
    comparisonRows: managerComparisons.length,
    reportPeriod: manager.latestFiling?.periodOfReport || manager.verification?.reportPeriod || null,
    accession: manager.latestFiling?.accession || null
  };
}

const compactManager = (manager) => ({
  id: manager.id,
  cik: manager.cik,
  status: manager.status,
  latestAvailablePeriod: manager.latestAvailablePeriod,
  collectedAt: manager.collectedAt,
  freshnessStatus: manager.freshnessStatus,
  verification: manager.verification
});
const compactHolding = (row) => ({
  managerId: row.managerId,
  reportPeriod: row.reportPeriod,
  rank: row.rank,
  issuer: row.issuer,
  titleOfClass: row.titleOfClass,
  cusip: row.cusip,
  cusipNormalized: row.cusipNormalized,
  value: row.value,
  shares: row.shares,
  shareType: row.shareType,
  putCall: row.putCall,
  priorReportPeriod: row.priorReportPeriod,
  priorValue: row.priorValue,
  priorShares: row.priorShares,
  valueDelta: row.valueDelta,
  sharesDelta: row.sharesDelta,
  action: row.action,
  actionConfidence: row.actionConfidence,
  comparisonStatus: row.comparisonStatus,
  key: row.key
});
const compactHoldings = (holdings.holdings || []).map(compactHolding);
const runtimeHoldings = {
  schema: 'masters-13f-runtime-summary.v1',
  sourceSchema: holdings.schema,
  artifactRole: 'PAGE_BOOTSTRAP',
  reviewedAt: holdings.reviewedAt,
  generatedAt,
  sourceKind: holdings.sourceKind,
  status: holdings.status,
  policy: holdings.policy,
  displayPolicy: holdings.displayPolicy,
  latestAvailablePeriod: holdings.latestAvailablePeriod,
  managers: (holdings.managers || []).map(compactManager),
  holdings: compactHoldings,
  comparisons: [],
  managerShards,
  shardIntegrityStatus: 'VERIFIED',
  shardsVerified: Object.keys(managerShards).length,
  filingDiscoverySummary: {
    status: filingDiscovery.status,
    reviewedAt: filingDiscovery.reviewedAt,
    latestAvailablePeriod: filingDiscovery.latestAvailablePeriod,
    coverage: filingDiscovery.coverage,
    notices: filingDiscovery.notices || []
  },
  enrichmentSummary: {
    officialPrinciples: (managerPrinciples.profiles || []).filter((profile) => profile.sourceUrl && profile.statedPrinciples?.length).length,
    principleProfiles: managerPrinciples.profiles?.length || 0,
    verifiedSecurityRecords: Number(securityMaster.coverage?.recordsPublished || 0),
    sectorWeightsPublished: securityMaster.coverage?.sectorWeightsPublished === true,
    securityMasterStatus: securityMaster.status || 'NOT_CONNECTED'
  },
  historySummary: {
    connectedManagers: historyIndex.connectedManagers || historyIndex.managers?.length || 0,
    totalFilerManagers: holdings.managers?.length || 0,
    historyDepthTarget: historyIndex.historyDepthTarget || 12,
    totalPeriods: historyIndex.totalPeriods || 0,
    rowImportedPeriods: historyIndex.rowImportedPeriods || 0
  },
  failedManagers: holdings.failedManagers || [],
  holdingRowsPublished: holdings.holdingRowsPublished,
  fullRowsAvailable: holdings.fullRowsAvailable,
  reconciledManagers: holdings.reconciledManagers,
  comparisonRowsPublished: compactHoldings.filter((row) => row.comparisonStatus === 'VERIFIED_PRIOR_PERIOD').length,
  comparisonRowsScope: 'COMPACT_TOP_HOLDINGS_ONLY',
  topRowsWithComparison: compactHoldings.filter((row) => row.comparisonStatus === 'VERIFIED_PRIOR_PERIOD').length,
  fullComparisonRowsAvailable: holdings.fullComparisonRowsAvailable,
  reconciledComparisons: holdings.reconciledComparisons,
  nextStep: holdings.nextStep
};
await writeAtomic(path.join(mastersDir, 'holdings-summary.json'), runtimeHoldings);

const historyManagerShards = {};
for (const manager of historyIndex.managers || []) {
  const managerId = manager.managerId;
  const rows = (historyRows.rows || []).filter((row) => row.managerId === managerId);
  const aggregates = (issuerAggregates.aggregates || []).filter((row) => row.managerId === managerId);
  const reviewQueue = (issuerAggregates.reviewQueue || []).filter((row) => row.managerId === managerId);
  const aggregateManager = (issuerAggregates.managers || []).find((row) => row.managerId === managerId) || null;
  const aggregatePreview = aggregates
    .map((record) => ({ record, latest: record.periods?.at(-1) || null }))
    .sort((a, b) => (Number(b.latest?.valueUsd) || 0) - (Number(a.latest?.valueUsd) || 0))
    .slice(0, 10)
    .map(({ record }) => record);
  const file = path.join(mastersDir, 'history', 'managers', `${managerId}.json`);
  await writeAtomic(file, {
    schema: 'masters-13f-manager-history-runtime.v1',
    sourceKind: 'SEC_EDGAR_DERIVED_RAW_ROWS',
    reviewedAt: [historyRows.reviewedAt, issuerAggregates.reviewedAt].filter(Boolean).sort().at(-1) || null,
    generatedAt,
    managerId,
    historyRows: [],
    historySummary: { rawRowsAvailable: rows.length, periodTotalsSource: 'history-index.json.managers[].periods' },
    issuerAggregates: {
      schema: issuerAggregates.schema,
      status: issuerAggregates.status,
      publication: issuerAggregates.publication,
      boundary: issuerAggregates.boundary,
      managers: aggregateManager ? [aggregateManager] : [],
      coverage: {
        aggregateRecords: aggregates.length,
        periods: aggregateManager?.periodsCovered || 0,
        reviewQueue: reviewQueue.length,
        previewRecords: aggregatePreview.length
      },
      reviewQueue: reviewQueue.slice(0, 10),
      aggregates: aggregatePreview
    }
  });
  historyManagerShards[managerId] = {
    url: `./public-data/masters/history/managers/${managerId}.json`,
    historyRows: rows.length,
    aggregateRecords: aggregates.length,
    aggregatePreviewRecords: aggregatePreview.length,
    reviewQueue: reviewQueue.length
  };
}

await writeAtomic(path.join(mastersDir, 'history-index.json'), {
  ...historyIndex,
  runtimeShardSchema: 'masters-13f-manager-history-runtime.v1',
  managerShards: historyManagerShards
});
await writeAtomic(path.join(mastersDir, 'index.json'), {
  ...mastersIndex,
  reviewedAt: holdings.reviewedAt,
  generatedAt,
  latestAvailablePeriod: holdings.latestAvailablePeriod,
  secMetadataManagers: (holdings.managers || []).length,
  rowImportPendingManagers: (holdings.failedManagers || []).length,
  verifiedFilerMetadata: (holdings.managers || []).length,
  holdingRowsPublished: holdings.holdingRowsPublished,
  fullRowsAvailable: holdings.fullRowsAvailable,
  reconciledManagers: holdings.reconciledManagers,
  comparisonRowsPublished: holdings.comparisonRowsPublished,
  fullComparisonRowsAvailable: holdings.fullComparisonRowsAvailable,
  reconciledComparisons: holdings.reconciledComparisons,
  staleReferenceManagers: (holdings.managers || []).filter((manager) => manager.freshnessStatus === 'STALE_REFERENCE').map((manager) => manager.id),
  managers: (mastersIndex.managers || []).map((manager) => {
    const connected = (holdings.managers || []).find((item) => item.id === manager.id);
    return connected ? { ...manager, status: connected.freshnessStatus === 'STALE_REFERENCE' ? 'STALE_REFERENCE' : connected.status } : manager;
  }),
  runtimeHoldingsArtifact: 'public-data/masters/holdings-summary.json',
  runtimeHoldingsBytes: Buffer.byteLength(JSON.stringify(runtimeHoldings)),
  managerShardCount: Object.keys(managerShards).length,
  historyManagerShardCount: Object.keys(historyManagerShards).length,
  generatedAt
});

console.log(JSON.stringify({
  status: 'PASS',
  runtimeHoldingsBytes: Buffer.byteLength(JSON.stringify(runtimeHoldings)),
  managerShards: Object.keys(managerShards).length,
  historyManagerShards: Object.keys(historyManagerShards).length,
  fullRowsExcludedFromBootstrap: (holdings.allHoldings || []).length,
  fullComparisonsExcludedFromBootstrap: (holdings.comparisons || []).length
}, null, 2));
