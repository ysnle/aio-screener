import fs from 'node:fs';
import path from 'node:path';

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

const principlesSource = read('src/ui/pages/principles.js');
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

const principlesNodes = count(principlesSource, /Object\.freeze\(\{ id: '[^']+', type:/g);
const principlesLessons = count(principlesSource, /Object\.freeze\(\{ id: '[^']+', title: '[^']+', level:/g);
const principlesPaths = count(principlesSource, /Object\.freeze\(\{ id: '[^']+', title: '[^']+', description:/g);
const principlesEdges = count(principlesSource, /Object\.freeze\(\{ from: '[^']+', to:/g);

const checks = [
  ...sourceDocs.map((file) => ({ check: `source exists: ${file}`, pass: fs.existsSync(path.join(root, file)) })),
  { check: 'atlas taxonomy node count is 95', pass: atlasIndex.taxonomyNodes === 95 },
  { check: 'atlas foundation module count is 48', pass: atlasIndex.foundationModules === 48 && foundations.moduleIndex.length === 48 },
  { check: 'atlas authored foundation lessons are 48 and source-linked', pass: atlasIndex.foundationLessonArtifact === 'public-data/atlas/foundation-lessons.json' && atlasIndex.authoredFoundationLessons === 48 && foundationLessons.lessons.length === 48 && Object.keys(foundationLessons.sourceCoverage || {}).length === 18 && foundationLessons.sourceCatalog?.length === 5 && foundationLessons.lessons.every((lesson) => [...new Set([...(lesson.sourceIds || []), ...(foundationLessons.sourceCoverage?.[lesson.id] || [])])].length > 0) && foundationLessons.shortFormStatus === 'AUTHORED_REFERENCE_CONNECTED' && foundationLessons.longFormStatus === 'AUTHORED_REFERENCE_CONNECTED' },
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
  { check: 'principles node guide knowledge base is 60 and individually authored', pass: principlesNodeGuides.status === 'AUTHORED_REFERENCE_CONNECTED' && principlesNodeGuides.publication === 'EDUCATIONAL_REFERENCE_ONLY' && principlesNodeGuides.nodes.length === 60 && new Set(principlesNodeGuides.nodes.map((node) => node.id)).size === 60 && principlesNodeGuides.nodes.every((node) => ['definition', 'intuition', 'mechanism', 'kpi', 'connection', 'risk'].every((field) => node[field])) },
  ...['definition', 'mechanism', 'example', 'counterScenario', 'verificationQuestion', 'diagram'].map((field) => ({ check: `principles ${field} text is unique per lesson`, pass: new Set(principlesLessonLibrary.lessons.map((lesson) => lesson[field])).size === principlesLessonLibrary.lessons.length })),
  { check: 'masters full holdings count is 1290', pass: mastersHoldings.allHoldings?.length === 1290 },
  { check: 'masters full comparison count is 1387', pass: mastersHoldings.comparisons?.length === 1387 },
  { check: 'masters latest available period is 2026-06-30', pass: mastersFilings.latestAvailablePeriod === '2026-06-30' },
  { check: 'masters filings contain stale Scion reference', pass: mastersFilings.managers?.some((item) => item.id === 'scion-asset-management' && item.freshnessStatus === 'STALE_REFERENCE') },
  { check: 'masters security master artifact is connected fail-closed', pass: mastersSecurityMaster.status === 'REFERENCE_NORMALIZATION_PENDING' && mastersSecurityMaster.coverage?.rawUniqueCusips === 1130 && mastersSecurityMaster.coverage?.rawUniqueIssuerNames === 1161 && mastersSecurityMaster.coverage?.mappedRows === 0 && mastersSecurityMaster.records?.length === 0 }
  ,{ check: 'masters reference mapping is explicitly non-verified', pass: mastersReferenceMaster.status === 'REFERENCE_MAPPING_CONNECTED' && mastersReferenceMaster.coverage?.verifiedTickerRows === 0 && mastersReferenceMaster.coverage?.verifiedSectorRows === 0 && mastersReferenceMaster.records?.length === mastersReferenceMaster.coverage?.referenceSectorRows }
  ,{ check: 'masters filing history rows are 7 managers x 12 periods', pass: mastersHistoryIndex.status === 'FILING_HISTORY_ROWS_CONNECTED' && mastersHistoryIndex.connectedManagers === 7 && mastersHistoryIndex.historyDepthTarget === 12 && mastersHistoryIndex.totalPeriods === 84 && mastersHistoryIndex.rowImportedPeriods === 84 && mastersHistoryIndex.pendingRowImportPeriods === 0 && mastersHistoryRows.status === 'RAW_SEC_HISTORY_CONNECTED' && mastersHistoryRows.periodsImported === 70 && mastersHistoryRows.rowsImported > 0 }
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
