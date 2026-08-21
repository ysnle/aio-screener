import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { throw new Error(`[masters-contract] ${message}`); };

const index = read('index.html');
const routes = read('src/app/routes.js');
const slices = read('src/app/vertical-slices.js');
const bootstrap = read('src/app/bootstrap.js');
const page = read('src/ui/pages/masters.js');
const worker = read('sw.js');
const golden = JSON.parse(read('architecture/golden-routes.json'));
const mastersIndex = JSON.parse(read('public-data/masters/index.json'));
const filings = JSON.parse(read('public-data/masters/filings.json'));
const holdings = JSON.parse(read('public-data/masters/holdings.json'));
const securityMaster = JSON.parse(read('public-data/masters/security-master.json'));
const referenceMaster = JSON.parse(read('public-data/masters/security-master-reference.json'));
const historyIndex = JSON.parse(read('public-data/masters/history-index.json'));
const historyRows = JSON.parse(read('public-data/masters/history-holdings.json'));
const issuerAggregates = JSON.parse(read('public-data/masters/issuer-aggregates.json'));
const managerCatalog = JSON.parse(read('public-data/masters/manager-catalog.json'));
const rowPreviews = JSON.parse(read('public-data/masters/manager-row-previews.json'));

for (const [label, source, marker] of [
  ['route registry', routes, "'masters'"],
  ['vertical slice', slices, 'vs12-masters'],
  ['bootstrap import', bootstrap, "../ui/pages/masters.js"],
  ['bootstrap mount', bootstrap, 'createMastersPage({ root, documentRef })'],
  ['page DOM', index, 'id="page-masters"'],
  ['navigation', index, 'data-arg="masters"'],
  ['service worker', worker, "'./src/ui/pages/masters.js'"],
  ['native page factory', page, 'export function createMastersPage'],
  ['SEC source boundary', page, 'SEC EDGAR'],
  ['reference sector mapping', page, 'createReferenceSectorView'],
  ['filing history', page, 'HISTORY_INDEX_URL'],
  ['filing history rows', page, 'HISTORY_HOLDINGS_URL'],
  ['issuer aggregate artifact', page, 'ISSUER_AGGREGATES_URL'],
  ['issuer aggregate renderer', page, 'createIssuerAggregateView'],
  ['manager catalog', page, 'MANAGER_CATALOG_URL'],
  ['manager catalog state', page, 'aioMastersCatalog'],
  ['row preview artifact', page, 'ROW_PREVIEWS_URL'],
  ['row preview state', page, 'aioMastersPreviews'],
  ['row preview renderer', page, 'createRowPreviewView'],
  ['pending state', page, "status: 'PENDING'"]
]) if (!source.includes(marker)) fail(`${label} missing marker: ${marker}`);

if (!golden.routes.includes('masters') || golden.routes.length !== 20) fail('golden route does not contain the 20-route masters topology');
if (!/data-masters-content/.test(index)) fail('page markup lacks renderer mount');
if (!/13F는 전체 포트폴리오가 아님/.test(index)) fail('page must carry the 13F coverage disclosure');
if (/data-live-price|data-live-chg|targetPrice|target-price/.test(page)) fail('masters page must not promote live market or target claims');
if (/currentPrice|targetPrice|BUY|SELL/.test(page)) fail('masters page must not promote current market or trading claims');
if (/\bnoop\b/.test(page)) fail('masters detail tabs must not be noop controls');
if (!/replaceChildren/.test(page) || /innerHTML/.test(page)) fail('masters renderer must use safe DOM construction');
if (!page.includes('FILINGS_URL') || !page.includes('HOLDINGS_URL') || !page.includes('SECURITY_MASTER_URL') || !page.includes('SECURITY_MASTER_REFERENCE_URL') || !page.includes('createTopHoldingTable') || !page.includes('createFullHoldingsView') || !page.includes('createChangeLedger') || !page.includes('createValueReconciliationNotice') || !page.includes('aioMastersHoldings') || !page.includes('aioMastersSecurityMaster') || filings.status !== 'REFERENCE_METADATA_CONNECTED') fail('SEC metadata/holdings/security-master artifacts are not connected');
if (filings.managers.length !== 8 || filings.managers.filter((manager) => manager.status === 'VERIFIED_METADATA').length !== 7) fail('SEC metadata counts drifted');
const scion = filings.managers.find((manager) => manager.id === 'scion-asset-management');
if (scion?.cik !== '0001649339' || scion.status !== 'VERIFIED_METADATA') fail('Scion filing boundary drifted');
if (holdings.status !== 'REFERENCE_ROWS_CONNECTED' || holdings.managers.length !== 7 || holdings.reconciledManagers !== 7 || holdings.holdingRowsPublished !== 68 || holdings.fullRowsAvailable !== 1290 || holdings.holdings.length !== 68 || holdings.allHoldings?.length !== 1290 || holdings.comparisonRowsPublished !== 68 || holdings.fullComparisonRowsAvailable !== 1387 || holdings.comparisons?.length !== 1387 || holdings.reconciledComparisons !== 7) fail('SEC holdings or prior-period comparison counts drifted');
if (holdings.managers.some((manager) => manager.status !== 'VERIFIED_ROWS' || !manager.verification.countReconciled)) fail('SEC cover-page reconciliation is incomplete');
for (const manager of holdings.managers) {
  const verification = manager.verification;
  const coverTotal = verification.cover?.tableValueTotal;
  const parsedTotal = verification.parsedValueTotal;
  const delta = Number(parsedTotal) - Number(coverTotal);
  const expectedStatus = delta === 0 ? 'EXACT' : Math.abs(delta) <= 1 ? 'EXCEPTION_DISCLOSED' : 'MISMATCH';
  if (!Number.isFinite(Number(coverTotal)) || !Number.isFinite(Number(parsedTotal)) || verification.valueDelta !== delta || verification.valueReconciliationStatus !== expectedStatus) fail(`SEC value reconciliation is incomplete for ${manager.id}`);
  if (expectedStatus === 'MISMATCH' && !page.includes('총액 기반 해석을 보류')) fail(`SEC cover total mismatch lacks a fail-closed UI boundary for ${manager.id}`);
}
if (holdings.managers.some((manager) => !manager.verification.priorReportPeriod || !manager.verification.priorCountReconciled)) fail('SEC prior-period reconciliation is incomplete');
if (holdings.holdings.some((row) => row.comparisonStatus !== 'VERIFIED_PRIOR_PERIOD' || !row.cusipNormalized || !row.action)) fail('SEC row comparison fields are incomplete');
const rawUniqueCusips = new Set((holdings.allHoldings || []).map((row) => row.cusipNormalized || row.cusip).filter(Boolean)).size;
const rawUniqueIssuerNames = new Set((holdings.allHoldings || []).map((row) => row.issuer).filter(Boolean)).size;
if (mastersIndex.normalizationStatus !== 'PENDING_VERIFIED_SECURITY_MASTER' || mastersIndex.rawUniqueCusips !== rawUniqueCusips || mastersIndex.rawUniqueIssuerNames !== rawUniqueIssuerNames || mastersIndex.mappedRows !== 0 || mastersIndex.securityMasterArtifact !== 'public-data/masters/security-master.json') fail('security-master normalization boundary drifted');
if (mastersIndex.issuerAggregateArtifact !== 'public-data/masters/issuer-aggregates.json' || mastersIndex.issuerAggregateStatus !== 'RAW_CUSIP_MULTI_QUARTER_CONNECTED' || mastersIndex.issuerAggregateRecords !== issuerAggregates.coverage?.aggregateRecords || mastersIndex.issuerAggregateReviewQueue !== issuerAggregates.coverage?.reviewQueue) fail('issuer aggregate index metadata drifted');
if (mastersIndex.fullComparisonRowsAvailable !== holdings.comparisons.length || mastersIndex.comparisonRowsPublished !== holdings.comparisonRowsPublished || mastersIndex.reconciledComparisons !== holdings.reconciledComparisons) fail('masters index comparison metadata drifted from the holdings artifact');
if (mastersIndex.rowPreviewArtifact !== 'public-data/masters/manager-row-previews.json' || mastersIndex.rowPreviewStatus !== 'SEC_ROW_PREVIEW_CONNECTED' || mastersIndex.rowPreviewManagers !== 5 || mastersIndex.previewRows !== 55) fail('masters index row-preview metadata drifted');
if (securityMaster.status !== 'REFERENCE_NORMALIZATION_PENDING' || securityMaster.sourceArtifact !== 'public-data/masters/holdings.json' || securityMaster.coverage?.rawUniqueCusips !== rawUniqueCusips || securityMaster.coverage?.rawUniqueIssuerNames !== rawUniqueIssuerNames || securityMaster.coverage?.mappedRows !== 0 || securityMaster.coverage?.recordsPublished !== 0 || securityMaster.coverage?.sectorWeightsPublished !== false || securityMaster.records?.length !== 0) fail('security-master artifact boundary drifted');
if (issuerAggregates.schema !== 'masters-13f-issuer-aggregates.v1' || issuerAggregates.status !== 'RAW_CUSIP_MULTI_QUARTER_CONNECTED' || issuerAggregates.coverage?.inputRows <= 0 || issuerAggregates.coverage?.aggregateRecords !== issuerAggregates.aggregates?.length || issuerAggregates.coverage?.tickerPublished !== 0 || issuerAggregates.coverage?.sectorPublished !== 0 || issuerAggregates.aggregates?.some((record) => !record.managerId || !record.cusipNormalized || !record.periods?.length || record.tickerStatus !== 'NOT_PUBLISHED' || record.sectorStatus !== 'NOT_PUBLISHED' || record.corporateActionStatus !== 'REVIEW_REQUIRED')) fail('issuer aggregate artifact boundary drifted');
if (referenceMaster.status !== 'REFERENCE_MAPPING_CONNECTED' || referenceMaster.coverage?.rawCompactRows !== 68 || referenceMaster.coverage?.verifiedTickerRows !== 0 || referenceMaster.coverage?.verifiedSectorRows !== 0 || referenceMaster.records?.length !== referenceMaster.coverage?.referenceSectorRows) fail('reference security-master mapping boundary drifted');
if (historyIndex.status !== 'FILING_HISTORY_ROWS_CONNECTED' || historyIndex.connectedManagers !== 7 || historyIndex.historyDepthTarget !== 12 || historyIndex.totalPeriods !== 84 || historyIndex.rowImportedPeriods !== 84 || historyIndex.pendingRowImportPeriods !== 0 || historyIndex.historicalRowsArtifact !== 'public-data/masters/history-holdings.json' || historyIndex.managers.some((manager) => manager.periods.length !== 12 || manager.periods.some((period) => !period.indexUrl || !period.accession || !period.periodOfReport || !period.informationTableXml || !period.rowCount || period.rowImportStatus === 'METADATA_ONLY'))) fail('13F filing history rows boundary drifted');
if (historyRows.status !== 'RAW_SEC_HISTORY_CONNECTED' || historyRows.periodsImported !== 70 || historyRows.rowsImported <= 0 || historyRows.rows?.some((row) => !row.managerId || !row.reportPeriod || !row.cusipNormalized || !row.sourceUrl)) fail('13F historical row artifact boundary drifted');
const liveManagers = filings.managers.filter((manager) => manager.status === 'VERIFIED_METADATA');
if (holdings.latestAvailablePeriod !== '2026-06-30') fail('latest connected 13F period drifted');
for (const manager of liveManagers) {
  const connected = holdings.managers.find((item) => item.id === manager.id);
  const historyManager = historyIndex.managers.find((item) => item.managerId === manager.id);
  const adjacentPrior = historyManager?.periods
    ?.map((period) => period.periodOfReport)
    .filter((period) => period < manager.latestFiling.periodOfReport)
    .sort()
    .at(-1);
  if (!connected || connected.latestAvailablePeriod !== manager.latestFiling.periodOfReport || !connected.collectedAt || !connected.freshnessStatus) fail(`freshness metadata missing for ${manager.id}`);
  if (manager.latestFiling.accession === manager.priorFiling?.accession || manager.latestFiling.periodOfReport <= (manager.priorFiling?.periodOfReport || '')) fail(`latest/prior filing ordering failed for ${manager.id}`);
  if (!adjacentPrior || manager.priorFiling?.periodOfReport !== adjacentPrior || connected.verification?.priorReportPeriod !== adjacentPrior) fail(`comparison skipped the adjacent filing period for ${manager.id}`);
  if (!manager.latestFiling.indexUrl || !manager.latestFiling.informationTableXml || !manager.latestFiling.primaryDocumentXml) fail(`latest SEC source links missing for ${manager.id}`);
}
const berkshire = filings.managers.find((manager) => manager.id === 'berkshire-hathaway');
if (berkshire?.latestFiling?.accession !== '0001193125-26-352200' || berkshire.latestFiling.periodOfReport !== '2026-06-30' || berkshire.latestFiling.filedAt !== '2026-08-14') fail('Berkshire latest SEC filing drifted');
if (scion?.freshnessStatus !== 'STALE_REFERENCE') fail('Scion freshness status must remain explicit');
if (scion?.latestAvailabilityCheck?.result !== 'NO_LATER_13F_HR_REPORTED' || scion.latestAvailabilityCheck.sourceUrl !== 'https://data.sec.gov/submissions/CIK0001649339.json') fail('Scion latest-filing availability check is missing or not tied to SEC submissions');
if (managerCatalog.schema !== 'masters-13f-manager-catalog.v1' || managerCatalog.status !== 'METADATA_AND_DISCOVERY_SEPARATED') fail('manager catalog schema/status drifted');
if (managerCatalog.managers.length !== 38 || new Set(managerCatalog.managers.map((manager) => manager.id)).size !== 38) fail('priority manager catalog must contain 38 unique profiles');
if (managerCatalog.coverage?.priorityManagerCount !== 38 || managerCatalog.coverage?.secFilerProfiles !== 37 || managerCatalog.coverage?.methodOnlyProfiles !== 1 || managerCatalog.coverage?.secMetadataVerified !== 30 || managerCatalog.coverage?.verifiedRowsConnected !== 7 || managerCatalog.coverage?.rowImportPending !== 30 || managerCatalog.coverage?.discoveryLeads !== 8 || managerCatalog.coverage?.telegramDiscoveryLeads !== 7 || managerCatalog.coverage?.xSearchStatus !== 'UNREADABLE_BY_BROWSER_TOOL') fail('manager catalog coverage counts drifted');
if (managerCatalog.coverage?.rowPreviewManagers !== 5 || managerCatalog.coverage?.previewRows !== 55 || managerCatalog.coverage?.previewArtifact !== 'public-data/masters/manager-row-previews.json') fail('manager catalog row-preview coverage drifted');
if (managerCatalog.managers.filter((manager) => manager.status === 'VERIFIED_METADATA').length !== 30 || managerCatalog.managers.filter((manager) => manager.status === 'VERIFIED_ROWS').length !== 6) fail('manager catalog verification tiers drifted');
const methodOnly = managerCatalog.managers.filter((manager) => manager.status === 'METHOD_ONLY');
if (methodOnly.length !== 1 || methodOnly[0].id !== 'mark-minervini' || methodOnly[0].type !== 'METHOD_ONLY' || methodOnly[0].cik || methodOnly[0].latestFiling || methodOnly[0].rowStatus || !methodOnly[0].profileBoundary) fail('method-only Mark Minervini boundary drifted');
if (managerCatalog.managers.some((manager) => manager.audienceTier !== 'BEGINNER_CORE' || !manager.managerCategory || !manager.scaleTier || !manager.scaleBasis || !manager.scaleMetric?.label || !manager.operator?.names?.length || !manager.operator?.roles?.length || !manager.strategyProfile?.approach || !manager.strategyProfile?.horizon || !manager.strategyProfile?.riskStyle || !manager.teachingUse)) fail('beginner-core operator, scale, and strategy metadata is incomplete');
if (managerCatalog.managers.filter((manager) => manager.scaleMetric?.value != null).some((manager) => !manager.scaleMetric.unit || !manager.scaleMetric.asOf || !manager.scaleMetric.sourceUrl || !manager.scaleMetric.basis)) fail('quantified scale metadata lacks unit, date, source, or 13F boundary');
if (managerCatalog.managers.some((manager) => ['lone-pine-capital', 'coatue-management', 'akre-capital-management', 'altimeter-capital-management'].includes(manager.id))) fail('retired non-core profiles remain in the beginner catalog');
if (managerCatalog.managers.filter((manager) => manager.status === 'VERIFIED_METADATA').some((manager) => !manager.cik || !manager.latestFiling?.indexUrl || !manager.latestFiling?.informationTableXml || manager.rowStatus !== 'PENDING_SEC_ROW_IMPORT')) fail('metadata-only manager lacks SEC evidence or row boundary');
if (managerCatalog.managers.some((manager) => manager.cik && manager.cik.length !== 10)) fail('manager CIK must remain zero-padded 10 digits');
if (managerCatalog.discoveryLeads.length !== 8 || managerCatalog.discoveryLeads.some((lead) => !lead.url || !lead.sourceKind || !lead.status || lead.status === 'VERIFIED_ROWS' || lead.status === 'VERIFIED_METADATA')) fail('discovery lead separation is incomplete');
if (rowPreviews.schema !== 'masters-13f-row-previews.v1' || rowPreviews.sourceKind !== 'SEC_EDGAR' || rowPreviews.status !== 'SEC_ROW_PREVIEW_CONNECTED' || rowPreviews.rowImportStatus !== 'PENDING_FULL_RECONCILIATION') fail('row preview schema/status drifted');
if (rowPreviews.managers.length !== 5 || rowPreviews.coverage?.previewManagerCount !== 5 || rowPreviews.coverage?.previewRowCount !== 55 || rowPreviews.coverage?.fullRowCountKnown !== false) fail('row preview coverage counts drifted');
if (rowPreviews.managers.some((manager) => !manager.managerId || !manager.cik || manager.cik.length !== 10 || manager.reportPeriod !== '2026-03-31' || !manager.accession || !manager.sourceUrl || manager.rows.length !== manager.rowCountPreview || manager.rows.some((row) => !row.issuer || !row.cusip || !Number.isFinite(row.value) || !Number.isFinite(row.shares) || !row.shareType))) fail('row preview evidence fields are incomplete');
if (rowPreviews.managers.some((manager) => ['berkshire-hathaway', 'duquesne-family-office', 'fisher-asset-management', 'pershing-square', 'appaloosa-management', 'baupost-group', 'scion-asset-management'].includes(manager.managerId))) fail('row previews must not duplicate the connected holdings artifact managers');

 console.log(JSON.stringify({ ok: true, route: 'masters', profiles: managerCatalog.managers.length, verifiedMetadata: managerCatalog.coverage.secMetadataVerified, cikVerified: managerCatalog.coverage.secMetadataVerified, reconciledManagers: holdings.reconciledManagers, holdingRowsPublished: holdings.holdingRowsPublished, fullRowsAvailable: holdings.fullRowsAvailable, rowPreviewManagers: rowPreviews.coverage.previewManagerCount, previewRows: rowPreviews.coverage.previewRowCount, reconciledComparisons: holdings.reconciledComparisons, comparisonRowsPublished: holdings.comparisonRowsPublished, fullComparisonRowsAvailable: holdings.fullComparisonRowsAvailable, latestAvailablePeriod: holdings.latestAvailablePeriod, staleReferenceManagers: holdings.managers.filter((manager) => manager.freshnessStatus === 'STALE_REFERENCE').map((manager) => manager.id), historyPeriods: historyIndex.totalPeriods, historicalRows: historyRows.rowsImported, normalizationStatus: mastersIndex.normalizationStatus, securityMasterStatus: securityMaster.status, rawUniqueCusips: mastersIndex.rawUniqueCusips, rawUniqueIssuerNames: mastersIndex.rawUniqueIssuerNames, mappedRows: mastersIndex.mappedRows, latestFilingPending: managerCatalog.coverage.rowImportPending, discoveryLeads: managerCatalog.coverage.discoveryLeads, methodOnly: methodOnly.length, reviewedAt: mastersIndex.reviewedAt }));
