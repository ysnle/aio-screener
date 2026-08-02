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
  ['pending state', page, "status: 'PENDING'"],
  ['method-only state', page, "status: 'METHOD_ONLY'"]
]) if (!source.includes(marker)) fail(`${label} missing marker: ${marker}`);

if (!golden.routes.includes('masters') || golden.routes.length !== 20) fail('golden route does not contain the 20-route masters topology');
if (!/data-masters-content/.test(index)) fail('page markup lacks renderer mount');
if (!/13F는 전체 포트폴리오가 아님/.test(index)) fail('page must carry the 13F coverage disclosure');
if (/data-live-price|data-live-chg|targetPrice|target-price/.test(page)) fail('masters page must not promote live market or target claims');
if (/currentPrice|targetPrice|BUY|SELL/.test(page)) fail('masters page must not promote current market or trading claims');
if (/\bnoop\b/.test(page)) fail('masters detail tabs must not be noop controls');
if (!/replaceChildren/.test(page) || /innerHTML/.test(page)) fail('masters renderer must use safe DOM construction');
if (!page.includes('FILINGS_URL') || !page.includes('HOLDINGS_URL') || !page.includes('SECURITY_MASTER_URL') || !page.includes('SECURITY_MASTER_REFERENCE_URL') || !page.includes('createTopHoldingTable') || !page.includes('createFullHoldingsView') || !page.includes('createChangeLedger') || !page.includes('aioMastersHoldings') || !page.includes('aioMastersSecurityMaster') || filings.status !== 'REFERENCE_METADATA_CONNECTED') fail('SEC metadata/holdings/security-master artifacts are not connected');
if (filings.managers.length !== 8 || filings.managers.filter((manager) => manager.status === 'VERIFIED_METADATA').length !== 7) fail('SEC metadata counts drifted');
const scion = filings.managers.find((manager) => manager.id === 'scion-asset-management');
if (scion?.cik !== '0001649339' || scion.status !== 'VERIFIED_METADATA') fail('Scion filing boundary drifted');
if (holdings.status !== 'REFERENCE_ROWS_CONNECTED' || holdings.managers.length !== 7 || holdings.reconciledManagers !== 7 || holdings.holdingRowsPublished !== 68 || holdings.fullRowsAvailable !== 1248 || holdings.holdings.length !== 68 || holdings.allHoldings?.length !== 1248 || holdings.comparisonRowsPublished !== 68 || holdings.fullComparisonRowsAvailable !== 1377 || holdings.comparisons?.length !== 1377 || holdings.reconciledComparisons !== 7) fail('SEC holdings or prior-period comparison counts drifted');
if (holdings.managers.some((manager) => manager.status !== 'VERIFIED_ROWS' || !manager.verification.countReconciled)) fail('SEC cover-page reconciliation is incomplete');
if (holdings.managers.some((manager) => !manager.verification.priorReportPeriod || !manager.verification.priorCountReconciled)) fail('SEC prior-period reconciliation is incomplete');
if (holdings.holdings.some((row) => row.comparisonStatus !== 'VERIFIED_PRIOR_PERIOD' || !row.cusipNormalized || !row.action)) fail('SEC row comparison fields are incomplete');
if (mastersIndex.normalizationStatus !== 'PENDING_VERIFIED_SECURITY_MASTER' || mastersIndex.rawUniqueCusips !== 1102 || mastersIndex.rawUniqueIssuerNames !== 1122 || mastersIndex.mappedRows !== 0 || mastersIndex.securityMasterArtifact !== 'public-data/masters/security-master.json') fail('security-master normalization boundary drifted');
if (securityMaster.status !== 'REFERENCE_NORMALIZATION_PENDING' || securityMaster.sourceArtifact !== 'public-data/masters/holdings.json' || securityMaster.coverage?.rawUniqueCusips !== 1102 || securityMaster.coverage?.rawUniqueIssuerNames !== 1122 || securityMaster.coverage?.mappedRows !== 0 || securityMaster.coverage?.recordsPublished !== 0 || securityMaster.coverage?.sectorWeightsPublished !== false || securityMaster.records?.length !== 0) fail('security-master artifact boundary drifted');
if (referenceMaster.status !== 'REFERENCE_MAPPING_CONNECTED' || referenceMaster.coverage?.rawCompactRows !== 68 || referenceMaster.coverage?.verifiedTickerRows !== 0 || referenceMaster.coverage?.verifiedSectorRows !== 0 || referenceMaster.records?.length !== referenceMaster.coverage?.referenceSectorRows) fail('reference security-master mapping boundary drifted');
if (historyIndex.status !== 'FILING_HISTORY_ROWS_CONNECTED' || historyIndex.connectedManagers !== 7 || historyIndex.historyDepthTarget !== 12 || historyIndex.totalPeriods !== 84 || historyIndex.rowImportedPeriods !== 84 || historyIndex.pendingRowImportPeriods !== 0 || historyIndex.historicalRowsArtifact !== 'public-data/masters/history-holdings.json' || historyIndex.managers.some((manager) => manager.periods.length !== 12 || manager.periods.some((period) => !period.indexUrl || !period.accession || !period.periodOfReport || !period.informationTableXml || !period.rowCount || period.rowImportStatus === 'METADATA_ONLY'))) fail('13F filing history rows boundary drifted');
if (historyRows.status !== 'RAW_SEC_HISTORY_CONNECTED' || historyRows.periodsImported !== 70 || historyRows.rowsImported <= 0 || historyRows.rows?.some((row) => !row.managerId || !row.reportPeriod || !row.cusipNormalized || !row.sourceUrl)) fail('13F historical row artifact boundary drifted');
const liveManagers = filings.managers.filter((manager) => manager.status === 'VERIFIED_METADATA');
if (holdings.latestAvailablePeriod !== '2026-03-31') fail('latest connected 13F period drifted');
for (const manager of liveManagers) {
  const connected = holdings.managers.find((item) => item.id === manager.id);
  if (!connected || connected.latestAvailablePeriod !== manager.latestFiling.periodOfReport || !connected.collectedAt || !connected.freshnessStatus) fail(`freshness metadata missing for ${manager.id}`);
  if (manager.latestFiling.accession === manager.priorFiling?.accession || manager.latestFiling.periodOfReport <= (manager.priorFiling?.periodOfReport || '')) fail(`latest/prior filing ordering failed for ${manager.id}`);
  if (!manager.latestFiling.indexUrl || !manager.latestFiling.informationTableXml || !manager.latestFiling.primaryDocumentXml) fail(`latest SEC source links missing for ${manager.id}`);
}
const berkshire = filings.managers.find((manager) => manager.id === 'berkshire-hathaway');
if (berkshire?.latestFiling?.accession !== '0001193125-26-226661' || berkshire.latestFiling.periodOfReport !== '2026-03-31' || berkshire.latestFiling.filedAt !== '2026-05-15') fail('Berkshire latest SEC filing drifted');
if (scion?.freshnessStatus !== 'STALE_REFERENCE') fail('Scion freshness status must remain explicit');
if (scion?.latestAvailabilityCheck?.result !== 'NO_LATER_13F_HR_REPORTED' || scion.latestAvailabilityCheck.sourceUrl !== 'https://data.sec.gov/submissions/CIK0001649339.json') fail('Scion latest-filing availability check is missing or not tied to SEC submissions');

console.log(JSON.stringify({ ok: true, route: 'masters', profiles: 8, verifiedMetadata: 7, cikVerified: 7, reconciledManagers: holdings.reconciledManagers, holdingRowsPublished: holdings.holdingRowsPublished, fullRowsAvailable: holdings.fullRowsAvailable, reconciledComparisons: holdings.reconciledComparisons, comparisonRowsPublished: holdings.comparisonRowsPublished, fullComparisonRowsAvailable: holdings.fullComparisonRowsAvailable, latestAvailablePeriod: holdings.latestAvailablePeriod, staleReferenceManagers: holdings.managers.filter((manager) => manager.freshnessStatus === 'STALE_REFERENCE').map((manager) => manager.id), historyPeriods: historyIndex.totalPeriods, historicalRows: historyRows.rowsImported, normalizationStatus: mastersIndex.normalizationStatus, securityMasterStatus: securityMaster.status, rawUniqueCusips: mastersIndex.rawUniqueCusips, rawUniqueIssuerNames: mastersIndex.rawUniqueIssuerNames, mappedRows: mastersIndex.mappedRows, latestFilingPending: 0, methodOnly: 1, reviewedAt: '2026-08-02' }));
