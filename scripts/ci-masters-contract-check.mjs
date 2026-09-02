import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { throw new Error(`[masters-contract] ${message}`); };

const index = read('index.html');
const core = read('js/aio-core.js');
const routes = read('src/app/routes.js');
const slices = read('src/app/vertical-slices.js');
const bootstrap = read('src/app/bootstrap.js');
const page = read('src/ui/pages/masters.js');
const worker = read('sw.js');
const golden = JSON.parse(read('architecture/golden-routes.json'));
const mastersIndex = JSON.parse(read('public-data/masters/index.json'));
const filings = JSON.parse(read('public-data/masters/filings.json'));
const holdings = JSON.parse(read('public-data/masters/holdings.json'));
const runtimeHoldings = JSON.parse(read('public-data/masters/holdings-summary.json'));
const securityMaster = JSON.parse(read('public-data/masters/security-master.json'));
const referenceMaster = JSON.parse(read('public-data/masters/security-master-reference.json'));
const tickerIndexReference = JSON.parse(read('public-data/masters/ticker-index-reference.json'));
const historyIndex = JSON.parse(read('public-data/masters/history-index.json'));
const historyRows = JSON.parse(read('public-data/masters/history-holdings.json'));
const issuerAggregates = JSON.parse(read('public-data/masters/issuer-aggregates.json'));
const managerCatalog = JSON.parse(read('public-data/masters/manager-catalog.json'));
const rowPreviews = JSON.parse(read('public-data/masters/manager-row-previews.json'));
const filingDiscovery = JSON.parse(read('public-data/masters/filing-discovery.json'));
const managerPrinciples = JSON.parse(read('public-data/masters/manager-principles.json'));

for (const [label, source, marker] of [
  ['route registry', routes, "'masters'"],
  ['vertical slice', slices, 'vs12-masters'],
  ['bootstrap import', bootstrap, "../ui/pages/masters.js"],
  ['route dynamic import', bootstrap, "loader: () => import('../ui/pages/masters.js')"],
  ['bootstrap mount', bootstrap, 'createMastersPage({ root, documentRef })'],
  ['page DOM', index, 'id="page-masters"'],
  ['navigation', index, 'data-arg="masters"'],
  ['service worker', worker, "'./src/ui/pages/masters.js'"],
  ['native page factory', page, 'export function createMastersPage'],
  ['SEC source boundary', page, 'SEC EDGAR'],
  ['reference sector mapping', page, 'createReferenceSectorView'],
  ['reference ticker lookup page', page, 'TICKER_INDEX_REFERENCE_URL'],
  ['reference ticker lookup renderer', page, 'createTickerLookup'],
  ['reference ticker lookup boundary', page, 'mastersTickerLookup'],
  ['reference ticker lookup', core, 'ticker-index-reference.json'],
  ['filing history', page, 'HISTORY_INDEX_URL'],
  ['manager history shards', page, 'managerShards'],
  ['issuer aggregate renderer', page, 'createIssuerAggregateView'],
  ['manager catalog', page, 'MANAGER_CATALOG_URL'],
  ['manager catalog state', page, 'aioMastersCatalog'],
  ['row preview artifact', page, 'ROW_PREVIEWS_URL'],
  ['row preview state', page, 'aioMastersPreviews'],
  ['row preview renderer', page, 'createRowPreviewView'],
  ['filing discovery artifact', page, 'FILING_DISCOVERY_URL'],
  ['manager row shards', page, 'managerShards'],
  ['manager principles artifact', page, 'MANAGER_PRINCIPLES_URL'],
  ['capability error isolation', page, 'Promise.allSettled'],
  ['route abort signal', page, 'scope?.signal'],
  ['shared artifact cache', page, 'loadJsonArtifact'],
  ['pending state', page, "status: 'PENDING'"]
]) if (!source.includes(marker)) fail(`${label} missing marker: ${marker}`);

if (/^import\s+\{[^\n]*createMastersPage[^\n]*from\s+['"]\.\.\/ui\/pages\/masters\.js['"]/m.test(bootstrap)) fail('masters page returned to the initial static module graph');

if (!golden.routes.includes('masters') || golden.routes.length !== 20) fail('golden route does not contain the 20-route masters topology');
if (!/data-masters-content/.test(index)) fail('page markup lacks renderer mount');
if (!/13F는 전체 포트폴리오가 아님/.test(index) || /재검산된 경우에만 전체 포트폴리오로 표시/.test(index)) fail('page must carry the bounded 13F coverage disclosure without calling it the complete portfolio');
if (/data-live-price|data-live-chg|targetPrice|target-price/.test(page)) fail('masters page must not promote live market or target claims');
if (/currentPrice|targetPrice|BUY|SELL/.test(page)) fail('masters page must not promote current market or trading claims');
if (/\bnoop\b/.test(page)) fail('masters detail tabs must not be noop controls');
if (!/replaceChildren/.test(page) || /innerHTML/.test(page)) fail('masters renderer must use safe DOM construction');
if (!page.includes('FILINGS_URL') || !page.includes('HOLDINGS_URL') || !page.includes('SECURITY_MASTER_URL') || !page.includes('SECURITY_MASTER_REFERENCE_URL') || !page.includes('createTopHoldingTable') || !page.includes('createFullHoldingsView') || !page.includes('createChangeLedger') || !page.includes('createValueReconciliationNotice') || !page.includes('aioMastersHoldings') || !page.includes('aioMastersSecurityMaster') || !/^REFERENCE_METADATA_(?:CONNECTED|CURRENT|PARTIAL)$/.test(filings.status)) fail('SEC metadata/holdings/security-master artifacts are not connected');
if (![8, 38].includes(filings.managers.length) || filings.managers.filter((manager) => manager.cik).length < 7) fail('SEC metadata counts drifted');
if (filingDiscovery.schema !== 'masters-sec-filing-discovery.v2' || filingDiscovery.coverage?.filerProfiles !== 37 || filingDiscovery.coverage.discovered + filingDiscovery.coverage.blocked !== 37 || filingDiscovery.coverage.ownershipEvents == null || filingDiscovery.coverage.ownershipManagers == null) fail('SEC 13F/13D/G filing discovery coverage is incomplete');
if (filingDiscovery.status === 'CURRENT' && (filingDiscovery.coverage.discovered !== 37 || filingDiscovery.coverage.blocked !== 0 || filingDiscovery.managers.some((manager) => manager.status !== 'DISCOVERED' || !manager.latestSubmission?.accession || !manager.latestHoldings?.accession))) fail('current SEC filing discovery lacks all 37 filer accessions');
if (filingDiscovery.status === 'BLOCKED' && (filingDiscovery.coverage.blocked !== 37 || filingDiscovery.managers.some((manager) => manager.status !== 'BLOCKED' || !manager.reason))) fail('blocked SEC filing discovery is not explicit');
if (!['CURRENT', 'BLOCKED', 'PARTIAL'].includes(filingDiscovery.status)) fail('SEC filing discovery status is invalid');
if (!page.includes('createOwnershipEvents') || !page.includes('13D/G는 특정 발행인에 대한 실질 소유권 공시')) fail('Schedule 13D/G ownership-event boundary is not connected to Masters');
if (managerPrinciples.schema !== 'masters-manager-principles.v1' || !managerPrinciples.profiles?.some((profile) => profile.managerId === 'mark-minervini' && profile.statedPrinciples?.length >= 4 && profile.sourceUrl) || !page.includes('createPrinciplesView') || !page.includes('createInvestorCompareView')) fail('investment-principles or investor-comparison surface is incomplete');
const filerIds = new Set(managerCatalog.managers.filter((manager) => manager.type !== 'METHOD_ONLY').map((manager) => manager.id));
const fullManagers = holdings.managers.filter((manager) => filerIds.has(manager.id) && Number(manager.verification?.fullRowCount) > 0);
const fullIds = new Set(fullManagers.map((manager) => manager.id));
const currentFullManagers = fullManagers.filter((manager) => manager.freshnessStatus === 'CURRENT_REFERENCE' && manager.verification?.reportPeriod === holdings.latestAvailablePeriod);
const staleFullManagers = fullManagers.filter((manager) => !currentFullManagers.includes(manager));
const previewOnlyIds = new Set(rowPreviews.managers.map((manager) => manager.managerId).filter((managerId) => filerIds.has(managerId) && !fullIds.has(managerId)));
const metadataOnlyIds = [...filerIds].filter((managerId) => !fullIds.has(managerId) && !previewOnlyIds.has(managerId));
const methodOnlyProfiles = managerCatalog.managers.filter((manager) => manager.type === 'METHOD_ONLY');
const officialPrinciples = managerPrinciples.profiles.filter((profile) => profile.sourceUrl && profile.statedPrinciples?.length);
const currentClassification = {
  currentFull: currentFullManagers.length,
  staleFull: staleFullManagers.length,
  previewOnly: previewOnlyIds.size,
  metadataOnly: metadataOnlyIds.length,
  methodOnly: methodOnlyProfiles.length,
  latestPeriodMissing: filerIds.size - currentFullManagers.length,
  officialPrinciples: officialPrinciples.length,
  verifiedSecurityRecords: Number(securityMaster.coverage?.recordsPublished || 0)
};
if (currentClassification.currentFull + currentClassification.staleFull + currentClassification.previewOnly + currentClassification.metadataOnly !== filerIds.size || currentClassification.latestPeriodMissing !== filerIds.size - currentClassification.currentFull || currentClassification.methodOnly !== 1) fail(`current user-visible coverage partition is inconsistent: ${JSON.stringify(currentClassification)}`);
if (filingDiscovery.status !== 'CURRENT' || filingDiscovery.coverage.discovered !== filerIds.size || filingDiscovery.coverage.blocked !== 0 || filingDiscovery.coverage.holdingsRowsCurrent !== holdings.reconciledManagers || filingDiscovery.coverage.holdingsRowsPending !== filerIds.size - holdings.reconciledManagers) fail('current discovery/row artifact reconciliation is incomplete');
if (/aioMastersData\s*=\s*['"]connected['"]/.test(page) || !page.includes('coverageSummary.state') || !page.includes('discoveryComplete && rowCoverageComplete && enrichmentComplete') || !page.includes('mastersEnrichmentState')) fail('aioMastersData can still overstate discovery/row/enrichment coverage as complete');
if (!page.includes('masters-compare-period-mismatch') || !page.includes('row.reportPeriod === commonPeriod') || !page.includes("'행 확인 필요'")) fail('mixed-period comparison or unknown-row fail-closed contract is missing');
for (const marker of ['masters-coverage-classification', 'masters-latest-quarter-boundary', 'masters-discovery-boundary', 'masters-enrichment-boundary', '최신 전체 행', '지연 전체 행', '원문 미리보기만', '메타데이터만', '공식 투자 원칙 원고', '검증 issuer·ticker·sector master']) {
  if (!page.includes(marker)) fail(`user-visible Masters coverage boundary missing: ${marker}`);
}
if (!page.includes('repository 변수 설정 존재 여부와 같은 뜻이 아닙니다') || page.includes('SEC 공정접근 연락 정보가 설정된 온라인 수집 전까지')) fail('SEC discovery UI still conflates artifact execution with repository variable configuration');
const scion = filings.managers.find((manager) => manager.id === 'scion-asset-management');
if (scion?.cik !== '0001649339' || scion.status !== 'VERIFIED_ROWS') fail('Scion filing boundary drifted');
if (!/^REFERENCE_ROWS_(?:CONNECTED|PARTIAL)$/.test(holdings.status) || holdings.managers.length < 7 || holdings.reconciledManagers < 7 || holdings.holdingRowsPublished !== holdings.holdings.length || holdings.fullRowsAvailable < 1290 || holdings.allHoldings?.length < 1290 || holdings.comparisonRowsPublished > holdings.holdingRowsPublished || holdings.fullComparisonRowsAvailable < 1387 || holdings.comparisons?.length < 1387 || holdings.reconciledComparisons < 7) fail('SEC holdings or prior-period comparison counts drifted');
if (runtimeHoldings.schema !== 'masters-13f-runtime-summary.v1' || runtimeHoldings.artifactRole !== 'PAGE_BOOTSTRAP' || runtimeHoldings.allHoldings || runtimeHoldings.fullRowsAvailable !== holdings.fullRowsAvailable || Object.keys(runtimeHoldings.managerShards || {}).length !== holdings.managers.length || runtimeHoldings.shardIntegrityStatus !== 'VERIFIED' || runtimeHoldings.shardsVerified !== holdings.managers.length || runtimeHoldings.comparisonRowsPublished !== runtimeHoldings.topRowsWithComparison || runtimeHoldings.comparisonRowsScope !== 'COMPACT_TOP_HOLDINGS_ONLY' || runtimeHoldings.fullComparisonRowsAvailable !== holdings.fullComparisonRowsAvailable || runtimeHoldings.managerProjectionPolicy?.artifactRole !== 'BOUNDED_WEB_PROJECTION' || runtimeHoldings.managerProjectionPolicy?.rowLimitPerCollection !== 200 || runtimeHoldings.managerProjectionPolicy?.maxBytes !== 512 * 1024 || runtimeHoldings.managerProjectionPolicy?.fullRowStore !== 'BULK_OBJECT_STORAGE_REQUIRED' || Buffer.byteLength(JSON.stringify(runtimeHoldings)) > 280 * 1024 || !page.includes("holdings-summary.json") || !page.includes('integrity: descriptor.sha256') || !page.includes('bounded 웹 투영')) fail('Masters runtime summary does not enforce the verified-shard, bounded projection, integrity, and initial payload budget');
if (page.includes("history-holdings.json") || page.includes("issuer-aggregates.json")) fail('Masters browser consumer must not request monolithic history or issuer artifacts');
if (holdings.managerShards) {
  for (const [managerId, descriptor] of Object.entries(holdings.managerShards)) {
    if (!descriptor.url || descriptor.fullRows <= 0 || descriptor.comparisonRows < 0 || !descriptor.accession) fail(`manager row shard descriptor incomplete for ${managerId}`);
    const shardFile = descriptor.url.replace(/^\.\//, '');
    if (!fs.existsSync(path.join(root, shardFile))) fail(`manager row shard missing for ${managerId}`);
    const shard = JSON.parse(read(shardFile));
    if (shard.managerId !== managerId || shard.latestFiling?.accession !== descriptor.accession || shard.holdings?.length !== descriptor.fullRows || shard.comparisons?.length !== descriptor.comparisonRows) fail(`manager row shard content drift for ${managerId}: declared ${descriptor.fullRows}/${descriptor.comparisonRows}, actual ${shard.holdings?.length || 0}/${shard.comparisons?.length || 0}`);
  }
  if (holdings.fullRowsAvailable < holdings.embeddedFullRowsAvailable || holdings.fullComparisonRowsAvailable < holdings.embeddedFullComparisonRowsAvailable) fail('manager shard totals are below embedded totals');
}
for (const [managerId, descriptor] of Object.entries(runtimeHoldings.managerShards || {})) {
  if (descriptor.artifactRole !== 'BOUNDED_WEB_PROJECTION' || !/^\.\/public-data\/objects\/masters\/[a-f0-9]{64}\.json$/.test(descriptor.url) || descriptor.sha256 !== descriptor.url.match(/([a-f0-9]{64})\.json$/)?.[1] || descriptor.bytes > 512 * 1024 || descriptor.projectionRows > 200 || descriptor.comparisonProjectionRows > 200 || descriptor.fullRows < descriptor.projectionRows || descriptor.comparisonRows < descriptor.comparisonProjectionRows) fail(`bounded projection descriptor invalid for ${managerId}`);
  const shardFile = descriptor.url.replace(/^\.\//, '');
  const shardText = read(shardFile);
  const shard = JSON.parse(shardText);
  if (createHash('sha256').update(shardText).digest('hex') !== descriptor.sha256 || Buffer.byteLength(shardText) !== descriptor.bytes) fail(`bounded projection digest/bytes drift for ${managerId}`);
  if (shard.managerId !== managerId || shard.artifactRole !== descriptor.artifactRole || shard.latestFiling?.accession !== descriptor.accession || shard.holdings?.length !== descriptor.projectionRows || shard.comparisons?.length !== descriptor.comparisonProjectionRows || shard.fullRowsAvailable !== descriptor.fullRows || shard.fullComparisonsAvailable !== descriptor.comparisonRows) fail(`bounded projection content drift for ${managerId}`);
}
if (Object.keys(historyIndex.managerShards || {}).length !== historyIndex.managers.length || historyIndex.managers.length !== historyIndex.connectedManagers) fail('manager history runtime shard coverage is incomplete');
for (const descriptor of Object.values(historyIndex.managerShards || {})) {
  const shardFile = descriptor.url.replace(/^\.\//, '');
  const absolute = path.join(root, shardFile);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 100 * 1024) fail(`manager history shard missing or over 100KB: ${descriptor.url}`);
}
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
if (mastersIndex.fullComparisonRowsAvailable !== holdings.fullComparisonRowsAvailable || mastersIndex.comparisonRowsPublished !== holdings.comparisonRowsPublished || mastersIndex.reconciledComparisons !== holdings.reconciledComparisons) fail('masters index comparison metadata drifted from the holdings artifact');
if (mastersIndex.rowPreviewArtifact !== 'public-data/masters/manager-row-previews.json' || mastersIndex.rowPreviewStatus !== 'SEC_ROW_PREVIEW_CONNECTED' || mastersIndex.rowPreviewManagers !== 5 || mastersIndex.previewRows !== 55) fail('masters index row-preview metadata drifted');
if (securityMaster.status !== 'REFERENCE_NORMALIZATION_PENDING' || securityMaster.sourceArtifact !== 'public-data/masters/holdings.json' || securityMaster.coverage?.rawUniqueCusips !== rawUniqueCusips || securityMaster.coverage?.rawUniqueIssuerNames !== rawUniqueIssuerNames || securityMaster.coverage?.mappedRows !== 0 || securityMaster.coverage?.recordsPublished !== 0 || securityMaster.coverage?.sectorWeightsPublished !== false || securityMaster.records?.length !== 0) fail('security-master artifact boundary drifted');
if (issuerAggregates.schema !== 'masters-13f-issuer-aggregates.v1' || issuerAggregates.status !== 'RAW_CUSIP_MULTI_QUARTER_CONNECTED' || issuerAggregates.coverage?.inputRows <= 0 || issuerAggregates.coverage?.aggregateRecords !== issuerAggregates.aggregates?.length || issuerAggregates.coverage?.tickerPublished !== 0 || issuerAggregates.coverage?.sectorPublished !== 0 || issuerAggregates.aggregates?.some((record) => !record.managerId || !record.cusipNormalized || !record.periods?.length || record.tickerStatus !== 'NOT_PUBLISHED' || record.sectorStatus !== 'NOT_PUBLISHED' || record.corporateActionStatus !== 'REVIEW_REQUIRED')) fail('issuer aggregate artifact boundary drifted');
if (referenceMaster.status !== 'REFERENCE_MAPPING_CONNECTED' || referenceMaster.coverage?.rawCompactRows !== 68 || referenceMaster.coverage?.verifiedTickerRows !== 0 || referenceMaster.coverage?.verifiedSectorRows !== 0 || referenceMaster.records?.length !== referenceMaster.coverage?.referenceSectorRows) fail('reference security-master mapping boundary drifted');
const referenceTickerByCusip = new Map((referenceMaster.records || []).filter((record) => record.cusipNormalized && record.tickerReference).map((record) => [record.cusipNormalized, record]));
const expectedReferenceTickerMatches = (holdings.allHoldings || []).filter((row) => referenceTickerByCusip.has(row.cusipNormalized || row.cusip)).length;
if (tickerIndexReference.schema !== 'masters-13f-reference-ticker-index.v1' || tickerIndexReference.artifactRole !== 'REFERENCE_ONLY_TICKER_LOOKUP' || tickerIndexReference.sourceKind !== 'SEC_EDGAR_DERIVED_REFERENCE' || tickerIndexReference.status !== 'REFERENCE_ONLY' || tickerIndexReference.coverage?.sourceCurrentRows !== holdings.allHoldings.length || tickerIndexReference.coverage?.matchedCurrentRows !== expectedReferenceTickerMatches || tickerIndexReference.coverage?.unmappedCurrentRows !== holdings.allHoldings.length - expectedReferenceTickerMatches || tickerIndexReference.coverage?.verifiedTickerRows !== 0 || tickerIndexReference.coverage?.sectorWeightsPublished !== false || tickerIndexReference.records?.length !== tickerIndexReference.coverage?.referenceTickerCount || !tickerIndexReference.policy.includes('Absence') || !tickerIndexReference.boundary.includes('unverified')) fail('reference-only 13F ticker index boundary or coverage drifted');
if (tickerIndexReference.records?.some((record) => !record.tickerReference || record.mappingStatus !== 'REFERENCE_ONLY' || !record.rows?.length || record.rows.some((row) => !row.managerId || !row.reportPeriod || !row.cusip || row.sourceUrl == null))) fail('reference-only 13F ticker index rows are incomplete');
if (mastersIndex.tickerIndexArtifact !== 'public-data/masters/ticker-index-reference.json' || mastersIndex.tickerIndexStatus !== 'REFERENCE_ONLY' || mastersIndex.tickerIndexReferenceCount !== tickerIndexReference.records.length || mastersIndex.tickerIndexMatchedRows !== expectedReferenceTickerMatches) fail('masters index does not expose the reference-only 13F ticker index metadata');
if (!core.includes('mappingStatus') || !core.includes('reference-rows-found') || !core.includes('reference-mapping-not-found') || !core.includes('tickerReference is not SEC-provided')) fail('13F chat reverse lookup lacks explicit reference-only/missing-mapping boundaries');
if (historyIndex.status !== 'FILING_HISTORY_ROWS_CONNECTED' || historyIndex.connectedManagers !== 7 || historyIndex.historyDepthTarget !== 12 || historyIndex.totalPeriods !== 84 || historyIndex.rowImportedPeriods !== 84 || historyIndex.pendingRowImportPeriods !== 0 || historyIndex.historicalRowsArtifact !== 'public-data/masters/history-holdings.json' || historyIndex.managers.some((manager) => manager.periods.length !== 12 || manager.periods.some((period) => !period.indexUrl || !period.accession || !period.periodOfReport || !period.informationTableXml || !period.rowCount || period.rowImportStatus === 'METADATA_ONLY'))) fail('13F filing history rows boundary drifted');
if (historyRows.status !== 'RAW_SEC_HISTORY_CONNECTED' || historyRows.periodsImported !== 70 || historyRows.rowsImported <= 0 || historyRows.rows?.some((row) => !row.managerId || !row.reportPeriod || !row.cusipNormalized || !row.sourceUrl)) fail('13F historical row artifact boundary drifted');
const liveManagers = filings.managers.filter((manager) => manager.cik);
if (holdings.latestAvailablePeriod !== '2026-06-30') fail('latest connected 13F period drifted');
for (const manager of liveManagers) {
  const connected = holdings.managers.find((item) => item.id === manager.id);
  const historyManager = historyIndex.managers.find((item) => item.managerId === manager.id);
  const adjacentPrior = historyManager?.periods
    ?.map((period) => period.periodOfReport)
    .filter((period) => period < manager.latestFiling.periodOfReport)
    .sort()
    .at(-1) || manager.priorFiling?.periodOfReport;
  if (!connected || connected.latestAvailablePeriod !== manager.latestFiling.periodOfReport || !connected.collectedAt || !connected.freshnessStatus) fail(`freshness metadata missing for ${manager.id}`);
  if (manager.latestFiling.accession === manager.priorFiling?.accession || manager.latestFiling.periodOfReport <= (manager.priorFiling?.periodOfReport || '')) fail(`latest/prior filing ordering failed for ${manager.id}`);
  if (!adjacentPrior || manager.priorFiling?.periodOfReport !== adjacentPrior || connected.verification?.priorReportPeriod !== adjacentPrior) fail(`comparison skipped the adjacent filing period for ${manager.id}`);
  if (!manager.latestFiling.indexUrl || !manager.latestFiling.informationTableXml || !manager.latestFiling.primaryDocumentXml) fail(`latest SEC source links missing for ${manager.id}`);
}
const berkshire = filings.managers.find((manager) => manager.id === 'berkshire-hathaway');
if (berkshire?.latestFiling?.accession !== '0001193125-26-352200' || berkshire.latestFiling.periodOfReport !== '2026-06-30' || berkshire.latestFiling.filedAt !== '2026-08-14') fail('Berkshire latest SEC filing drifted');
if (scion?.freshnessStatus !== 'STALE_REFERENCE') fail('Scion freshness status must remain explicit');
if (scion?.latestAvailabilityCheck?.result !== 'LATEST_13F_HOLDINGS_REPORTED' || scion.latestAvailabilityCheck.sourceUrl !== 'https://data.sec.gov/submissions/CIK0001649339.json') fail('Scion latest-filing availability check is missing or not tied to SEC submissions');
if (managerCatalog.schema !== 'masters-13f-manager-catalog.v1' || managerCatalog.status !== 'METADATA_AND_DISCOVERY_SEPARATED') fail('manager catalog schema/status drifted');
if (managerCatalog.managers.length !== 38 || new Set(managerCatalog.managers.map((manager) => manager.id)).size !== 38) fail('priority manager catalog must contain 38 unique profiles');
if (managerCatalog.coverage?.priorityManagerCount !== 38 || managerCatalog.coverage?.secFilerProfiles !== 37 || managerCatalog.coverage?.methodOnlyProfiles !== 1 || managerCatalog.coverage?.secMetadataVerified !== 37 || managerCatalog.coverage?.verifiedRowsConnected !== 37 || managerCatalog.coverage?.rowImportPending !== 0 || managerCatalog.coverage?.discoveryLeads !== 8 || managerCatalog.coverage?.telegramDiscoveryLeads !== 7 || managerCatalog.coverage?.xSearchStatus !== 'UNREADABLE_BY_BROWSER_TOOL') fail('manager catalog coverage counts drifted');
if (managerCatalog.coverage?.rowPreviewManagers !== 5 || managerCatalog.coverage?.previewRows !== 55 || managerCatalog.coverage?.previewArtifact !== 'public-data/masters/manager-row-previews.json') fail('manager catalog row-preview coverage drifted');
if (managerCatalog.managers.filter((manager) => manager.status === 'VERIFIED_METADATA').length !== 0 || managerCatalog.managers.filter((manager) => manager.status === 'VERIFIED_ROWS').length !== 37) fail('manager catalog verification tiers drifted');
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

 console.log(JSON.stringify({ ok: true, route: 'masters', profiles: managerCatalog.managers.length, verifiedMetadata: managerCatalog.coverage.secMetadataVerified, cikVerified: managerCatalog.coverage.secMetadataVerified, reconciledManagers: holdings.reconciledManagers, holdingRowsPublished: holdings.holdingRowsPublished, fullRowsAvailable: holdings.fullRowsAvailable, rowPreviewManagers: rowPreviews.coverage.previewManagerCount, previewRows: rowPreviews.coverage.previewRowCount, reconciledComparisons: holdings.reconciledComparisons, comparisonRowsPublished: holdings.comparisonRowsPublished, fullComparisonRowsAvailable: holdings.fullComparisonRowsAvailable, latestAvailablePeriod: holdings.latestAvailablePeriod, currentClassification, staleReferenceManagers: holdings.managers.filter((manager) => manager.freshnessStatus === 'STALE_REFERENCE').map((manager) => manager.id), historyPeriods: historyIndex.totalPeriods, historicalRows: historyRows.rowsImported, normalizationStatus: mastersIndex.normalizationStatus, securityMasterStatus: securityMaster.status, rawUniqueCusips: mastersIndex.rawUniqueCusips, rawUniqueIssuerNames: mastersIndex.rawUniqueIssuerNames, mappedRows: mastersIndex.mappedRows, latestFilingPending: managerCatalog.coverage.rowImportPending, discoveryLeads: managerCatalog.coverage.discoveryLeads, methodOnly: methodOnly.length, reviewedAt: mastersIndex.reviewedAt }));
