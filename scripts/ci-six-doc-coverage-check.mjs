import fs from 'node:fs';
import path from 'node:path';
import { validateKnowledgeAuthoringCorpus, SOURCE_PRESERVED_STATUS, SEMANTIC_REFERENCE_STATUS } from './lib/knowledge-authoring-contract.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');

const sourceDocs = [
  '_context/AI-ERA-INDUSTRY-ATLAS-RESEARCH-SPEC-2026-08-01.md',
  '_context/AI-ERA-DEEP-TAXONOMY-PLAYER-PRODUCT-SPEC-2026-08-01.md',
  '_context/MARKET-PRINCIPLES-PAGE-DESIGN-HANDOFF-2026-08-01.md',
  '_context/AI-ERA-FOUNDATIONS-CURRICULUM-2026-08-01.md',
  '_context/MARKET-PRINCIPLES-KNOWLEDGE-GRAPH-UX-SPEC-2026-08-01.md',
  '_context/MASTERS-PORTFOLIO-13F-PAGE-DESIGN-HANDOFF-2026-08-01.md'
];

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
const count = (text, pattern) => text.match(pattern)?.length || 0;

const principlesChapters = json('public-data/principles/chapters.json');
const atlasIndex = json('public-data/atlas/index.json');
const research = json('public-data/atlas/source-packets.json');
const foundations = json('public-data/atlas/foundations.json');
const foundationLessons = json('public-data/atlas/foundation-lessons.json');
const atlasDomainGuides = json('public-data/atlas/domain-guides.json');
const atlasDomainPackets = json('public-data/atlas/domain-source-packets.json');
const atlasDomainClaims = json('public-data/atlas/domain-claim-ledger.json');
const atlasTaxonomyCoverage = json('public-data/atlas/taxonomy-node-coverage.json');
const telegramReference = json('public-data/telegram-digest.json');
const playerProduct = json('public-data/atlas/player-product-registry.json');
const playerProductCurrentness = json('public-data/atlas/player-product-currentness.json');
const mastersHoldings = json('public-data/masters/holdings.json');
const mastersFilings = json('public-data/masters/filings.json');
const mastersSecurityMaster = json('public-data/masters/security-master.json');
const mastersReferenceMaster = json('public-data/masters/security-master-reference.json');
const mastersHistoryIndex = json('public-data/masters/history-index.json');
const mastersHistoryRows = json('public-data/masters/history-holdings.json');
const principlesLessonLibrary = json('public-data/principles/lesson-library.json');
const principlesNodeGuides = json('public-data/principles/node-guides.json');
const knowledgeArticles = json('public-data/knowledge/articles.json');
const authoringContracts = {
  principles: validateKnowledgeAuthoringCorpus({ surface: 'principles', artifact: principlesLessonLibrary, articles: (knowledgeArticles.articles || []).filter((article) => article.surface === 'principles') }),
  atlas: validateKnowledgeAuthoringCorpus({ surface: 'atlas-foundations', artifact: foundationLessons, articles: (knowledgeArticles.articles || []).filter((article) => article.surface === 'atlas-foundations') })
};

// S17 (D8): the concept-map catalog lives in content/research/principles/catalog.json.
const principlesCatalogParts = JSON.parse(read('content/research/principles/catalog.json')).parts;
const catalogCount = (key) => principlesCatalogParts.reduce((sum, part) => sum + part[key].length, 0);
const principlesNodes = catalogCount('nodes');
const principlesLessons = catalogCount('lessons');
const principlesPaths = catalogCount('paths');
const principlesEdges = catalogCount('edges');

// v59.97: the 13F artifacts are rewritten every quarter when managers file, so the gate checks that each published
// count agrees with the rows it describes instead of pinning one quarter's numbers (an extra holdings row used to fail
// every data release).
const uniqueCount = (rows, pick) => new Set((rows || []).map(pick).filter(Boolean)).size;
function mastersCountConsistency({ holdings, securityMaster, historyIndex, historyRows }) {
  const allHoldings = holdings.allHoldings || [];
  const comparisons = holdings.comparisons || [];
  const historyPeriodKeys = new Set((historyRows.rows || []).map((row) => `${row.managerId}|${row.reportPeriod}`));
  return [
    { check: 'v59.97 masters full holdings rows are present and match their embedded count', pass: allHoldings.length > 0 && holdings.embeddedFullRowsAvailable === allHoldings.length },
    { check: 'v59.97 masters full comparison rows are present and match their embedded count', pass: comparisons.length > 0 && holdings.embeddedFullComparisonRowsAvailable === comparisons.length },
    { check: 'v59.97 masters security master is connected fail-closed and its unique CUSIP/issuer counts match the holdings rows', pass: securityMaster.status === 'REFERENCE_NORMALIZATION_PENDING'
      && securityMaster.coverage?.rawUniqueCusips > 0 && securityMaster.coverage.rawUniqueCusips === uniqueCount(allHoldings, (row) => row.cusipNormalized || row.cusip)
      && securityMaster.coverage?.rawUniqueIssuerNames > 0 && securityMaster.coverage.rawUniqueIssuerNames === uniqueCount(allHoldings, (row) => row.issuer)
      && securityMaster.coverage?.mappedRows === 0 && securityMaster.records?.length === 0 },
    { check: 'v59.97 masters filing history covers connected managers x depth target and imported periods match the stored rows', pass: historyIndex.status === 'FILING_HISTORY_ROWS_CONNECTED'
      && historyIndex.connectedManagers === 7 && historyIndex.historyDepthTarget === 12
      && historyIndex.totalPeriods === historyIndex.connectedManagers * historyIndex.historyDepthTarget
      && historyIndex.rowImportedPeriods === historyIndex.totalPeriods && historyIndex.pendingRowImportPeriods === 0
      && historyRows.status === 'RAW_SEC_HISTORY_CONNECTED'
      && historyRows.periodsImported > 0 && historyRows.periodsImported <= historyIndex.totalPeriods && historyRows.periodsImported === historyPeriodKeys.size
      && historyRows.rowsImported > 0 && historyRows.rowsImported === (historyRows.rows || []).length }
  ];
}

// v59.97 replay: one extra holdings row with every count that describes it updated passes; the same row with the
// embedded count left stale fails.
function mastersCountSelfTest() {
  const base = {
    holdings: { allHoldings: [{ cusip: 'A1', cusipNormalized: 'A1', issuer: 'ALPHA' }], comparisons: [{ key: 'c1' }], embeddedFullRowsAvailable: 1, embeddedFullComparisonRowsAvailable: 1 },
    securityMaster: { status: 'REFERENCE_NORMALIZATION_PENDING', coverage: { rawUniqueCusips: 1, rawUniqueIssuerNames: 1, mappedRows: 0 }, records: [] },
    historyIndex: { status: 'FILING_HISTORY_ROWS_CONNECTED', connectedManagers: 7, historyDepthTarget: 12, totalPeriods: 84, rowImportedPeriods: 84, pendingRowImportPeriods: 0 },
    historyRows: { status: 'RAW_SEC_HISTORY_CONNECTED', periodsImported: 1, rowsImported: 1, rows: [{ managerId: 'm', reportPeriod: '2026-09-30' }] }
  };
  const extraRow = { cusip: 'B2', cusipNormalized: 'B2', issuer: 'BETA' };
  const consistent = { ...base,
    holdings: { ...base.holdings, allHoldings: [...base.holdings.allHoldings, extraRow], embeddedFullRowsAvailable: 2 },
    securityMaster: { ...base.securityMaster, coverage: { ...base.securityMaster.coverage, rawUniqueCusips: 2, rawUniqueIssuerNames: 2 } } };
  const stale = { ...consistent, holdings: { ...consistent.holdings, embeddedFullRowsAvailable: 1 } };
  const allPass = (input) => mastersCountConsistency(input).every((item) => item.pass);
  return [
    { check: 'v59.97 replay: an extra 13F holdings row with its counts updated passes', pass: allPass(base) && allPass(consistent) },
    { check: 'v59.97 replay: an extra 13F holdings row with a stale embedded count fails', pass: !allPass(stale) }
  ];
}

const checks = [
  ...sourceDocs.map((file) => ({ check: `source exists: ${file}`, pass: fs.existsSync(path.join(root, file)) })),
  { check: 'atlas taxonomy node count is 95', pass: atlasIndex.taxonomyNodes === 95 },
  { check: 'atlas foundation module count is 48', pass: atlasIndex.foundationModules === 48 && foundations.moduleIndex.length === 48 },
  { check: 'atlas authored foundation lessons are 48 and source-linked', pass: atlasIndex.foundationLessonArtifact === 'public-data/atlas/foundation-lessons.json' && atlasIndex.authoredFoundationLessons === 48 && foundationLessons.lessons.length === 48 && Object.keys(foundationLessons.sourceCoverage || {}).length === 18 && foundationLessons.sourceCatalog?.length === 5 && foundationLessons.lessons.every((lesson) => [...new Set([...(lesson.sourceIds || []), ...(foundationLessons.sourceCoverage?.[lesson.id] || [])])].length > 0) && foundationLessons.shortFormStatus === 'AUTHORED_REFERENCE_CONNECTED' && [SOURCE_PRESERVED_STATUS, SEMANTIC_REFERENCE_STATUS].includes(foundationLessons.longFormStatus) && authoringContracts.atlas.mode === foundationLessons.longFormStatus },
  { check: 'atlas authored domain guides are 19 and connected', pass: atlasIndex.domainGuideArtifact === 'public-data/atlas/domain-guides.json' && atlasIndex.domainGuides === 19 && atlasDomainGuides.status === 'REFERENCE_CONNECTED' && atlasDomainGuides.guides.length === 19 },
  { check: 'atlas domain source packets are 19 and connected', pass: atlasIndex.domainSourcePacketArtifact === 'public-data/atlas/domain-source-packets.json' && atlasIndex.domainSourcePackets === 19 && atlasDomainPackets.status === 'REFERENCE_CONNECTED' && atlasDomainPackets.packets.length === 19 && atlasDomainPackets.packets.every((packet) => packet.sources?.length === 3) },
  { check: 'atlas domain structural claim ledger is 57 and current claims remain zero', pass: atlasIndex.domainClaimLedgerArtifact === 'public-data/atlas/domain-claim-ledger.json' && atlasIndex.domainStructuralClaims === 57 && atlasIndex.domainCurrentClaims === 0 && atlasDomainClaims.claims.length === 57 && atlasDomainClaims.counts?.currentClaims === 0 },
  { check: 'atlas taxonomy node coverage is 95 with connected relationships', pass: atlasIndex.taxonomyNodeCoverageArtifact === 'public-data/atlas/taxonomy-node-coverage.json' && atlasIndex.taxonomyNodeCoverage === 95 && atlasTaxonomyCoverage.nodes.length === 95 && atlasTaxonomyCoverage.coverage?.currentClaims === 0 && atlasTaxonomyCoverage.relationshipModel?.status === 'STRUCTURAL_RELATIONSHIPS_CONNECTED' && atlasTaxonomyCoverage.relationshipModel.domainChains.length === 19 && atlasTaxonomyCoverage.relationshipModel.domainChains.reduce((sum, chain) => sum + (chain.nodeIds?.length || 0), 0) === 95 && atlasTaxonomyCoverage.relationshipModel.crossDomainEdges.length === 22 },
  { check: 'telegram digest contains all 4 requested channels with explicit partial-failure lineage', pass:
      atlasIndex.telegramReferenceArtifact === 'public-data/telegram-digest.json' && atlasIndex.telegramReferenceChannels === 4 &&
      telegramReference.channels.length === 4 && telegramReference.sourceCatalog?.length === 4 &&
      telegramReference.sourceCatalog.every((source) => telegramReference.channels.some((row) => row.channel === source.channel)) &&
      (telegramReference.collectionStatus === 'failed' ||
       (telegramReference.collectionStatus === 'ok' && telegramReference.successfulChannelCount === 4) ||
       (telegramReference.collectionStatus === 'partial' && telegramReference.successfulChannelCount > 0 && telegramReference.successfulChannelCount < 4 &&
        telegramReference.channels.filter((row) => row.error).length === 4 - telegramReference.successfulChannelCount)) },
  { check: 'atlas evidence registry is 23 sources/14 claims/7 edges', pass: atlasIndex.primarySources === 23 && atlasIndex.evidenceClaims === 14 && research.sources.length === 23 && research.claims.length === 14 && research.edges.length === 7 },
  { check: 'atlas player/product reference registry is 21/22/23', pass: atlasIndex.referencePlayers === 21 && atlasIndex.referenceProducts === 22 && atlasIndex.referenceSources === 23 && playerProduct.players.length === 21 && playerProduct.products.length === 22 && playerProduct.sources.length === 23 },
  { check: 'atlas player/product currentness overlay is 21/22', pass: atlasIndex.playerProductCurrentnessArtifact === 'public-data/atlas/player-product-currentness.json' && playerProductCurrentness.players.length === 21 && playerProductCurrentness.products.length === 22 && playerProductCurrentness.products.every((item) => item.productionStatus && item.asOf) },
  { check: 'principles node count matches current catalog', pass: principlesNodes === 60 },
  { check: 'principles lesson count matches current authored catalog', pass: principlesLessons === 39 },
  { check: 'principles path count matches current catalog', pass: principlesPaths === 8 },
  { check: 'principles edge count matches current catalog', pass: principlesEdges === 71 },
  { check: 'principles authored A~O chapter artifact is connected', pass: principlesChapters.status === 'REFERENCE_CONNECTED' && principlesChapters.publication === 'EDUCATIONAL_REFERENCE_ONLY' && principlesChapters.chapters.length === 15 },
  { check: 'principles A~O lesson library is 112 and fully sourced', pass: principlesLessonLibrary.status === 'REFERENCE_CONNECTED' && principlesLessonLibrary.lessons.length === 112 && principlesLessonLibrary.lessons.every((lesson) => lesson.sourceIds?.length && lesson.diagram && lesson.verificationQuestion) },
  { check: 'knowledge article authoring mode preserves source reference or enforces semantic depth', pass: authoringContracts.principles.failures.length === 0 && authoringContracts.atlas.failures.length === 0 },
  { check: 'principles node guide knowledge base is 60 and individually authored', pass: principlesNodeGuides.status === 'AUTHORED_REFERENCE_CONNECTED' && principlesNodeGuides.publication === 'EDUCATIONAL_REFERENCE_ONLY' && principlesNodeGuides.nodes.length === 60 && new Set(principlesNodeGuides.nodes.map((node) => node.id)).size === 60 && principlesNodeGuides.nodes.every((node) => ['definition', 'intuition', 'mechanism', 'kpi', 'connection', 'risk'].every((field) => node[field])) },
  ...['definition', 'mechanism', 'example', 'counterScenario', 'verificationQuestion', 'diagram'].map((field) => ({ check: `principles ${field} text is unique per lesson`, pass: new Set(principlesLessonLibrary.lessons.map((lesson) => lesson[field])).size === principlesLessonLibrary.lessons.length })),
  // v59.70: the latest 13F period moves forward every quarter (2026-06-30 -> 2026-09-30 on 11/06), so the check
  // follows the data: a past quarter-end that equals the newest period any manager reports.
  { check: 'masters latest available period is a past quarter-end equal to the newest manager period', pass: /^\d{4}-(03-31|06-30|09-30|12-31)$/.test(String(mastersFilings.latestAvailablePeriod || '')) && Date.parse(mastersFilings.latestAvailablePeriod) <= Date.now() && mastersFilings.latestAvailablePeriod === (mastersFilings.managers || []).map((item) => item.latestAvailablePeriod).filter(Boolean).sort().at(-1) },
  { check: 'masters filings contain stale Scion reference', pass: mastersFilings.managers?.some((item) => item.id === 'scion-asset-management' && item.freshnessStatus === 'STALE_REFERENCE') },
  { check: 'masters reference mapping is explicitly non-verified', pass: mastersReferenceMaster.status === 'REFERENCE_MAPPING_CONNECTED' && mastersReferenceMaster.coverage?.verifiedTickerRows === 0 && mastersReferenceMaster.coverage?.verifiedSectorRows === 0 && mastersReferenceMaster.records?.length === mastersReferenceMaster.coverage?.referenceSectorRows },
  ...mastersCountConsistency({ holdings: mastersHoldings, securityMaster: mastersSecurityMaster, historyIndex: mastersHistoryIndex, historyRows: mastersHistoryRows }),
  ...mastersCountSelfTest()
];

const failed = checks.filter((item) => !item.pass);
const incomplete = [
  'Industry Atlas primary evidence ledger for every current numeric, product-generation and production-state claim; structural relationships and reference ledger are connected',
  'Deep taxonomy verified player/product enrichment beyond the 20 representative role/product families; structural node coverage is connected',
  'Masters verified security master, corporate-action review, sector mapping and issuer-level multi-quarter aggregation; raw SEC multi-quarter rows are connected'
];

console.log(JSON.stringify({
  status: failed.length ? 'FAIL' : strict ? 'INCOMPLETE' : 'PASS_WITH_REMAINING_SCOPE',
  strict,
  observed: { principlesNodes, principlesLessons, principlesPaths, principlesEdges, principlesAuthoredChapters: principlesChapters.chapters.length, principlesLessonLibrary: principlesLessonLibrary.lessons.length, principlesNodeGuides: principlesNodeGuides.nodes.length, atlasPrimarySources: research.sources.length, atlasEvidenceClaims: research.claims.length, atlasCandidateEdges: research.edges.length, atlasFoundationLessons: foundationLessons.lessons.length, atlasFoundationSourceCoverage: foundationLessons.lessons.filter((lesson) => [...new Set([...(lesson.sourceIds || []), ...(foundationLessons.sourceCoverage?.[lesson.id] || [])])].length > 0).length, atlasDomainGuides: atlasDomainGuides.guides.length, atlasDomainPackets: atlasDomainPackets.packets.length, atlasDomainStructuralClaims: atlasDomainClaims.claims.length, atlasTaxonomyCoverage: atlasTaxonomyCoverage.nodes.length, taxonomyRelationshipEdges: atlasIndex.taxonomyRelationshipEdges, telegramChannels: telegramReference.channels.length, telegramObservedLineage: telegramReference.retainedItemCount, atlasReferencePlayers: playerProduct.players.length, atlasReferenceProducts: playerProduct.products.length, atlasReferenceSources: playerProduct.sources.length, atlasCurrentnessProducts: playerProductCurrentness.products.length, mastersSecurityMasterStatus: mastersSecurityMaster.status, mastersSecurityMasterRecords: mastersSecurityMaster.records.length, mastersReferenceMappings: mastersReferenceMaster.records.length, mastersHistoryManagers: mastersHistoryIndex.connectedManagers, mastersHistoryPeriods: mastersHistoryIndex.totalPeriods, mastersHistoryRows: mastersHistoryRows.rowsImported },
  verifiedChecks: checks.length - failed.length,
  failedChecks: failed,
  remainingScope: incomplete
}, null, 2));

if (failed.length || strict) process.exitCode = 1;
