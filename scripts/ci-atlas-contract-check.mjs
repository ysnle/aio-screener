import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const atlas = read('src/ui/pages/atlas.js');
const principles = read('src/ui/pages/principles.js');
const index = read('index.html');
const core = read('js/aio-core.js');
const routes = read('src/app/routes.js');
const slices = read('src/app/vertical-slices.js');
const bootstrap = read('src/app/bootstrap.js');
const data = JSON.parse(read('public-data/atlas/index.json'));
const research = JSON.parse(read('public-data/atlas/source-packets.json'));
const foundations = JSON.parse(read('public-data/atlas/foundations.json'));
const foundationLessons = JSON.parse(read('public-data/atlas/foundation-lessons.json'));
const domainGuides = JSON.parse(read('public-data/atlas/domain-guides.json'));
const domainPackets = JSON.parse(read('public-data/atlas/domain-source-packets.json'));
const domainClaims = JSON.parse(read('public-data/atlas/domain-claim-ledger.json'));
const taxonomyCoverage = JSON.parse(read('public-data/atlas/taxonomy-node-coverage.json'));
const deepTaxonomy = JSON.parse(read('public-data/atlas/deep-taxonomy.json'));
const telegramReference = JSON.parse(read('public-data/telegram-digest.json'));
const playerProduct = JSON.parse(read('public-data/atlas/player-product-registry.json'));
const currentness = JSON.parse(read('public-data/atlas/player-product-currentness.json'));
const currentEvidenceLedger = JSON.parse(read('public-data/atlas/current-evidence-ledger.json'));
const relationshipGuides = JSON.parse(read('public-data/knowledge/relationship-guides.json'));
const knowledgeSources = JSON.parse(read('public-data/knowledge/sources.json'));
const errors = [];
const required = [
  ['route', routes.includes("'atlas'")],
  ['slice', slices.includes("vs13-atlas")],
  ['bootstrap import', bootstrap.includes("createAtlasPage")],
  ['bootstrap mount', bootstrap.includes("modules.atlas")],
  ['index page', index.includes('id="page-atlas"')],
  ['index content sink', index.includes('data-atlas-content')],
  ['Korean knowledge-map name', index.includes('>AI 시대 지식 지도</') && index.includes('AI 산업과 자본을 읽는 지도') && core.includes("label: 'AI 시대 지식 지도'") && principles.includes("routeLabel: 'AI 시대 지식 지도 열기'") && atlas.includes("'AI 시대 지식 지도 검색'") && !index.includes('>AI Era Atlas</') && !core.includes("label: 'AI Era Atlas'")],
  ['factory', atlas.includes('export function createAtlasPage')],
  ['reference-connected state', atlas.includes("DESIGN_ONLY") && data.status === 'REFERENCE_CONNECTED' && data.researchArtifact === 'public-data/atlas/source-packets.json'],
  ['telegram discovery boundary', atlas.includes('discovery only') && data.telegram.role === 'DISCOVERY'],
  ['player/product reference registry', atlas.includes('PLAYER_PRODUCT_URL') && atlas.includes('createPlayerProductView') && data.playerProductArtifact === 'public-data/atlas/player-product-registry.json' && playerProduct.status === 'ROLE_REFERENCE_ONLY'],
  ['unified source-linked player/product references', atlas.includes('createReferenceSourceLinks') && atlas.includes('createEvidenceRegistry') && atlas.includes('evidenceById') && atlas.includes('atlas-reference-source-link')],
  ['capability-level artifact loading', atlas.includes('loadKnowledgeCapabilities') && !atlas.includes('Promise.all([')],
  ['no current promotion', atlas.includes('publishedCurrentClaims') || data.publishedCurrentClaims === 0],
  ['domain source packets', atlas.includes('DOMAIN_PACKETS_URL') && atlas.includes('domainPackets') && data.domainSourcePacketArtifact === 'public-data/atlas/domain-source-packets.json'],
  ['domain claim ledger', atlas.includes('DOMAIN_CLAIMS_URL') && atlas.includes('claimLedger') && data.domainClaimLedgerArtifact === 'public-data/atlas/domain-claim-ledger.json'],
  ['taxonomy node coverage', atlas.includes('TAXONOMY_COVERAGE_URL') && atlas.includes('nodeCoverage') && data.taxonomyNodeCoverageArtifact === 'public-data/atlas/taxonomy-node-coverage.json'],
  ['deep taxonomy', atlas.includes('DEEP_TAXONOMY_URL') && atlas.includes('createDeepTaxonomyView') && data.deepTaxonomyArtifact === 'public-data/atlas/deep-taxonomy.json'],
  ['telegram discovery digest', atlas.includes('TELEGRAM_REFERENCE_URL') && atlas.includes('createTelegramReferenceView') && data.telegramReferenceArtifact === 'public-data/telegram-digest.json' && atlas.includes('sourceCatalog')],
  ['player/product currentness overlay', atlas.includes('PLAYER_PRODUCT_CURRENTNESS_URL') && atlas.includes('mergePlayerProductCurrentness') && data.playerProductCurrentnessArtifact === 'public-data/atlas/player-product-currentness.json'],
  ['dated primary evidence ledger', atlas.includes('CURRENT_EVIDENCE_LEDGER_URL') && atlas.includes('createCurrentEvidenceLedgerView') && data.currentEvidenceLedgerArtifact === 'public-data/atlas/current-evidence-ledger.json'],
  ['relationship guide consumer', atlas.includes('KNOWLEDGE_RELATIONSHIP_GUIDES_URL') && atlas.includes('createRelationshipGuidesView') && atlas.includes("['relationships', '관계 지도']") && data.relationshipGuideArtifact === 'public-data/knowledge/relationship-guides.json'],
  ['safe dom', atlas.includes('replaceChildren') && !atlas.includes('innerHTML')]
];
required.forEach(([label, ok]) => { if (!ok) errors.push(label); });
if (data.packets !== 11 || data.reviewedNodes !== 0 || data.candidateNodes !== 12 || data.taxonomyDomains !== 19 || data.taxonomyNodes !== 95 || data.evidenceClaims !== 14 || data.primarySources !== 23 || data.foundationLayers !== 7 || data.foundationModules !== 48) errors.push('reference data counts');
if (!atlas.includes('createResearchView') || !atlas.includes('RESEARCH_URL') || !atlas.includes('createCurriculumView') || !atlas.includes('FOUNDATIONS_URL') || !atlas.includes('FOUNDATIONS_LESSONS_URL') || !atlas.includes('DOMAIN_GUIDES_URL') || !atlas.includes('createDomainGuide') || !atlas.includes('atlas-module-authored') || !atlas.includes('atlas-domain-guide')) errors.push('research view connection');
if (!atlas.includes('ATLAS_CONCEPT_GUIDES') || !atlas.includes('createTaxonomyGuide') || !atlas.includes('FOUNDATION_TRACK_DISPLAY') || !atlas.includes('FOUNDATION_TEACHING_FRAME') || !atlas.includes('atlas-module-story') || !atlas.includes('atlas-module-application') || !atlas.includes('atlas-module-visualization') || !atlas.includes('atlas-module-exploration') || !atlas.includes('TELEGRAM_DISCOVERY_BOUNDARY') || !atlas.includes("F0: { title: '문제·학습·시스템의 공통 언어'" ) || !atlas.includes('AI를 이해하는 7단계')) errors.push('user-facing atlas explanations, complete foundation layers, or discovery boundary');
if (foundations.status !== 'REFERENCE_CONNECTED' || foundations.layers.length !== 7 || foundations.moduleIndex.length !== 48 || foundations.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || foundations.lessonContract?.visualizationStatus !== 'CONCEPT_FRAME_CONNECTED' || foundations.lessonContract?.shortFormStatus !== 'AUTHORED_REFERENCE_CONNECTED' || foundations.lessonContract?.shortFormArtifact !== 'public-data/atlas/foundation-lessons.json' || foundations.lessonContract?.longFormStatus !== 'AUTHORED_REFERENCE_CONNECTED') errors.push('curriculum artifact counts or publication boundary');
if (data.foundationLessonArtifact !== 'public-data/atlas/foundation-lessons.json' || data.authoredFoundationLessons !== 48 || foundationLessons.status !== 'REFERENCE_CONNECTED' || foundationLessons.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || foundationLessons.shortFormStatus !== 'AUTHORED_REFERENCE_CONNECTED' || foundationLessons.longFormStatus !== 'AUTHORED_REFERENCE_CONNECTED' || foundationLessons.lessons.length !== 48 || foundationLessons.authoringContract?.coverage !== '48/48 modules have an authored definition, mechanism, example, failure boundary, question, visualization and direct sourceIds linkage; sourceCoverage remains a compatibility audit map' || Object.keys(foundationLessons.sourceCoverage || {}).length !== 18 || foundationLessons.sourceCatalog?.length !== 5) errors.push('authored foundation lesson artifact counts or publication boundary');
if (foundationLessons.deepFormStatus !== 'SEMANTIC_REFERENCE_AUTHORED' || foundationLessons.lessons.some((lesson) => lesson.deepStatus !== 'SEMANTIC_REFERENCE_AUTHORED' || !lesson.title || !lesson.summary?.definition || !lesson.formalModel?.variables?.length || !lesson.workedExample?.inputs?.length || !lesson.workedExample?.steps?.length || !lesson.workedExample?.result || !lesson.workedExample?.failureBoundary || !lesson.realEconomyChannel || !lesson.companyChannel || !lesson.financialStatementChannel || !lesson.valuationChannel || !lesson.marketChannel || !lesson.tradingApplication || !lesson.invalidation || !lesson.glossary?.length || !lesson.claimIds?.length)) errors.push('foundation semantic depth fields or structured worked examples are incomplete');
if (data.domainGuideArtifact !== 'public-data/atlas/domain-guides.json' || data.domainGuides !== 19 || domainGuides.status !== 'REFERENCE_CONNECTED' || domainGuides.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || domainGuides.guides.length !== 19) errors.push('domain guide artifact counts or publication boundary');
if (data.domainSourcePacketArtifact !== 'public-data/atlas/domain-source-packets.json' || data.domainSourcePackets !== 19 || domainPackets.status !== 'REFERENCE_CONNECTED' || domainPackets.packets.length !== 19 || domainPackets.packets.some((packet) => packet.sources?.length !== 3 || !packet.reviewedAt)) errors.push('domain source packet coverage');
if (data.domainClaimLedgerArtifact !== 'public-data/atlas/domain-claim-ledger.json' || data.domainStructuralClaims !== 57 || data.domainCurrentClaims !== 0 || domainClaims.status !== 'REFERENCE_CONNECTED' || domainClaims.claims.length !== 57 || domainClaims.counts?.currentClaims !== 0 || domainClaims.claims.some((claim) => claim.status !== 'PARTIAL' || claim.asOf !== null || claim.sourceIds?.length !== 3)) errors.push('domain claim ledger coverage');
if (data.taxonomyNodeCoverageArtifact !== 'public-data/atlas/taxonomy-node-coverage.json' || data.taxonomyNodeCoverage !== 95 || taxonomyCoverage.status !== 'STRUCTURAL_COVERAGE_CONNECTED' || taxonomyCoverage.coverage?.nodes !== 95 || taxonomyCoverage.nodes.length !== 95 || taxonomyCoverage.coverage?.currentClaims !== 0 || taxonomyCoverage.nodes.some((node) => !node.roleReference || !node.productFamilyReference || !node.verificationQuestion || node.currentClaims !== 0) || taxonomyCoverage.relationshipModel?.status !== 'STRUCTURAL_RELATIONSHIPS_CONNECTED' || taxonomyCoverage.relationshipModel?.domainChains?.length !== 19 || taxonomyCoverage.relationshipModel?.domainChains?.reduce((sum, chain) => sum + (chain.nodeIds?.length || 0), 0) !== 95 || taxonomyCoverage.relationshipModel?.crossDomainEdges?.length !== 22 || taxonomyCoverage.relationshipModel.crossDomainEdges.some((edge) => !edge.id || !edge.type || !edge.direction || !edge.kind || !edge.strength || !edge.polarity || !edge.reviewedAt || !edge.conditions?.length || !edge.sourceIds?.length) || data.taxonomyRelationshipEdges !== 98) errors.push('taxonomy node coverage or relationship model');
const atlasSourceIds = new Set([...(knowledgeSources.sources || []), ...(research.sources || []), ...(playerProduct.sources || [])].map((source) => source.id));
const atlasPlayerIds = new Set((playerProduct.players || []).map((player) => player.playerId));
const atlasProductIds = new Set((playerProduct.products || []).map((product) => product.productId));
const invalidConnectedTaxonomyNodes = taxonomyCoverage.nodes.filter((node) => !(node.upstream?.length || node.downstream?.length));
const invalidFlowBoundaryNodes = taxonomyCoverage.nodes.filter((node) => !['ROOT', 'LEAF', 'BRIDGE'].includes(node.flowPosition) || !node.flowBoundary);
const unresolvedTaxonomySources = taxonomyCoverage.nodes.flatMap((node) => (node.sourceIds || []).filter((sourceId) => !atlasSourceIds.has(sourceId)).map((sourceId) => `${node.nodeId}:${sourceId}`));
const invalidRepresentativeMappings = taxonomyCoverage.nodes.filter((node) => {
  const hasRepresentative = Boolean(node.representativePlayerIds?.length || node.representativeProductIds?.length);
  if (!hasRepresentative) return node.representativeMappingStatus !== 'NOT_YET_VERIFIED' || !node.representativeMappingBoundary;
  return node.representativeMappingStatus !== 'REFERENCE_MAPPED'
    || !node.representativeMappingBoundary
    || node.representativePlayerIds.some((playerId) => !atlasPlayerIds.has(playerId))
    || node.representativeProductIds.some((productId) => !atlasProductIds.has(productId));
});
if (invalidConnectedTaxonomyNodes.length || invalidFlowBoundaryNodes.length || unresolvedTaxonomySources.length || invalidRepresentativeMappings.length) errors.push(`taxonomy reconciliation integrity: disconnected=${invalidConnectedTaxonomyNodes.length}, invalidFlowBoundary=${invalidFlowBoundaryNodes.length}, unresolvedSources=${unresolvedTaxonomySources.length}, invalidRepresentatives=${invalidRepresentativeMappings.length}`);
const unresolvedDomainClaimSources = domainClaims.claims.flatMap((claim) => (claim.sourceIds || []).filter((sourceId) => !atlasSourceIds.has(sourceId)).map((sourceId) => `${claim.id}:${sourceId}`));
if (domainClaims.claims.some((claim) => claim.currentnessPolicy !== 'NOT_APPLICABLE_STRUCTURAL_REFERENCE') || unresolvedDomainClaimSources.length) errors.push(`domain structural-claim integrity: currentness=${domainClaims.claims.filter((claim) => claim.currentnessPolicy !== 'NOT_APPLICABLE_STRUCTURAL_REFERENCE').length}, unresolvedSources=${unresolvedDomainClaimSources.length}`);
if (!atlas.includes('atlas-taxonomy-structural-boundary') || !atlas.includes('연구 수량 미확인 · 구조 참고 화면') || atlas.includes('source seed')) errors.push('taxonomy failure boundary or internal-id presentation contract');
const deepBranchCount = deepTaxonomy.topics.reduce((sum, topic) => sum + (topic.branches?.length || 0), 0);
const deepAnchorIds = new Set(deepTaxonomy.topics.flatMap((topic) => topic.anchorNodeIds || []));
const deepCorpus = JSON.stringify(deepTaxonomy);
const requiredDeepConcepts = ['3nm', '2nm', '18A', 'DUV', 'EUV', 'High-NA', '유리기판', 'Photonics', 'Open Weights', 'HBM', 'CXL', 'AIDC', 'World Model', 'Artemis'];
if (data.deepTaxonomyTopics !== 10 || data.deepTaxonomyBranches !== 50 || data.deepTaxonomyAnchors !== 56 || deepTaxonomy.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || deepTaxonomy.topics.length !== 10 || deepBranchCount !== 50 || deepAnchorIds.size !== 56 || deepTaxonomy.topics.some((topic) => !topic.title || !topic.relation || !topic.why || !topic.anchorNodeIds?.length || !topic.branches?.length || topic.branches.some((branch) => !branch.title || !branch.summary || !branch.mechanism || !branch.observe || !branch.caution || !branch.children?.length)) || requiredDeepConcepts.some((concept) => !deepCorpus.includes(concept))) errors.push('deep taxonomy coverage');
const telegramLineageCount = telegramReference.retainedItemCount ?? telegramReference.observedItems?.length ?? null;
const telegramChannelCount = telegramReference.channels?.length ?? 0;
const telegramErrorCount = telegramReference.channels?.filter((channel) => channel.error).length ?? 0;
const telegramCatalogMatchesChannels = telegramReference.sourceCatalog?.length === 4
  && telegramReference.sourceCatalog.every((source) => telegramReference.channels?.some((channel) => channel.channel === source.channel));
const telegramCollectionBoundary = telegramReference.collectionStatus === 'failed'
  || (telegramReference.collectionStatus === 'ok' && telegramReference.successfulChannelCount === 4 && telegramErrorCount === 0)
  || (telegramReference.collectionStatus === 'partial'
    && telegramReference.successfulChannelCount > 0
    && telegramReference.successfulChannelCount < 4
    && telegramErrorCount === 4 - telegramReference.successfulChannelCount);
if (data.telegramReferenceArtifact !== 'public-data/telegram-digest.json' || data.telegramReferenceChannels !== 4 || data.telegramObservedLineage !== telegramLineageCount || !telegramCollectionBoundary || telegramChannelCount !== 4 || !telegramCatalogMatchesChannels || telegramReference.channels.some((channel) => !channel.channel || channel.error === undefined)) errors.push('telegram discovery coverage');
if (data.referencePlayers !== 21 || data.referenceProducts !== 22 || data.referenceSources !== 23 || playerProduct.players.length !== 21 || playerProduct.products.length !== 22 || playerProduct.sources.length !== 23 || playerProduct.publication !== 'EDUCATIONAL_REFERENCE_ONLY') errors.push('player/product registry counts or publication boundary');
if (data.playerProductCurrentnessArtifact !== 'public-data/atlas/player-product-currentness.json' || data.currentnessPlayers !== 21 || data.currentnessProducts !== 22 || currentness.status !== 'REFERENCE_CURRENTNESS_CONNECTED' || currentness.players.length !== 21 || currentness.products.length !== 22 || currentness.products.some((product) => !product.productionStatus || !product.asOf || !product.statusBasis) || currentness.freshnessStatus !== 'STALE_REFERENCE_REVIEW_REQUIRED' || currentness.freshnessPolicy?.referenceReviewWindowDays !== 7 || currentness.freshnessPolicy?.staleReferenceRows !== 40 || currentness.coverage?.officialCheckedRows !== 43 || currentness.coverage?.currentNumericClaims !== 0 || currentness.coverage?.productionVolumeClaims !== 0 || currentness.coverage?.generationSpecificVerifiedClaims !== 0 || currentness.coverage?.financialClaims !== 0 || !atlas.includes('atlasCurrentnessBoundary') || !atlas.includes('최신성 검증 경계')) errors.push('player/product currentness coverage or freshness boundary');
if (data.currentEvidenceLedgerArtifact !== 'public-data/atlas/current-evidence-ledger.json' || data.currentEvidenceLedgerStatus !== 'DATED_PRIMARY_REFERENCE_LEDGER_CONNECTED' || data.currentEvidenceEntries !== currentEvidenceLedger.coverage?.entries || currentEvidenceLedger.status !== 'DATED_PRIMARY_REFERENCE_LEDGER_CONNECTED' || currentEvidenceLedger.coverage?.currentOperationalClaimsPublished !== 0 || currentEvidenceLedger.entries?.some((entry) => !entry.sourceId || !entry.url || !entry.asOf || !entry.statement || entry.directness !== 'DIRECT_FOR_STATED_SCOPE')) errors.push('dated primary evidence ledger boundary');
const relationshipNodeCount = (relationshipGuides.guides || []).reduce((sum, guide) => sum + (guide.nodes?.length || 0), 0);
const relationshipEdgeCount = (relationshipGuides.guides || []).reduce((sum, guide) => sum + (guide.edges?.length || 0), 0);
const relationshipSourceIds = new Set((knowledgeSources.sources || []).map((source) => source.id));
const invalidRelationshipGuides = [];
for (const guide of relationshipGuides.guides || []) {
  const nodeIds = new Set((guide.nodes || []).map((node) => node.id));
  if (!guide.id || !guide.title || !guide.summary || !guide.asOf || !guide.groups?.length || !guide.nodes?.length || !guide.edges?.length) invalidRelationshipGuides.push(`guide:${guide.id || 'missing'}:shape`);
  for (const sourceId of guide.sourceIds || []) if (!relationshipSourceIds.has(sourceId)) invalidRelationshipGuides.push(`guide:${guide.id}:source:${sourceId}`);
  for (const node of guide.nodes || []) if (!node.id || !node.group || !node.label || !node.definition || !node.importance || !node.mechanism || !node.metrics?.length || !node.invalidation) invalidRelationshipGuides.push(`guide:${guide.id}:node:${node.id || 'missing'}`);
  for (const edge of guide.edges || []) if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || !edge.type || !edge.label || !['structural', 'conditional', 'claim'].includes(edge.criticality)) invalidRelationshipGuides.push(`guide:${guide.id}:edge:${edge.from}->${edge.to}`);
}
if (data.relationshipGuides !== 5 || data.relationshipNodes !== 35 || data.relationshipEdges !== 31 || relationshipGuides.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || relationshipGuides.guides.length !== 5 || relationshipNodeCount !== 35 || relationshipEdgeCount !== 31 || invalidRelationshipGuides.length) errors.push(`relationship guide coverage${invalidRelationshipGuides.length ? `: ${invalidRelationshipGuides.join(',')}` : ''}`);
const relationshipNode = (guideId, nodeId) => relationshipGuides.guides.find((guide) => guide.id === guideId)?.nodes?.find((node) => node.id === nodeId);
const relationshipDepthChecks = [
  ['r-star estimation', relationshipNode('neutral-rate-policy-gap', 'rstar')?.mechanism?.includes('Kalman filter') && relationshipNode('neutral-rate-policy-gap', 'rstar')?.metrics?.includes('data vintage·모형 버전')],
  ['KV capacity model', relationshipNode('nand-inference-fcf', 'kv-cache')?.mechanism?.includes('KV heads') && relationshipNode('nand-inference-fcf', 'kv-cache')?.metrics?.includes('bytes/token·active tokens')],
  ['FCF bridge', relationshipNode('nand-inference-fcf', 'financial-targets')?.metrics?.includes('OCF-to-FCF bridge')],
  ['supply-chain recovery', relationshipNode('semiconductor-supply-network', 'equipment-materials')?.metrics?.includes('time-to-recover')],
  ['data-center denominator', relationshipNode('ai-datacenter-gigawatt-to-token', 'thermal')?.mechanism?.includes('PUE =')],
  ['CPO link budget', relationshipNode('cpo-supply-map', 'inp-laser')?.metrics?.includes('optical link budget')]
];
for (const [name, ok] of relationshipDepthChecks) if (!ok) errors.push(`relationship academic depth: ${name}`);
const hasGuide = (id) => atlas.includes(`'${id}': { definition`) || atlas.includes(`  ${id}: { definition`);
const taxonomyNodeIds = research.taxonomyDomains.flatMap((domain) => domain.nodes || []).map((node) => node.id);
const missingTaxonomyGuides = taxonomyNodeIds.filter((id) => !hasGuide(id));
const missingFoundationLessons = foundations.moduleIndex.map((module) => module.id).filter((id) => !hasGuide(id));
if (missingTaxonomyGuides.length) errors.push(`taxonomy guide coverage missing: ${missingTaxonomyGuides.join(',')}`);
if (missingFoundationLessons.length) errors.push(`foundation lesson coverage missing: ${missingFoundationLessons.join(',')}`);
const researchSourceIdSet = new Set((research.sources || []).map((source) => source.id));
const researchClaimIdSet = new Set((research.claims || []).map((claim) => claim.id));
const researchNodeIdSet = new Set((research.nodes || []).map((node) => node.id));
const invalidResearchEdges = [];
for (const packet of research.packets || []) {
  for (const sourceId of packet.sourceIds || []) if (!researchSourceIdSet.has(sourceId)) invalidResearchEdges.push(`packet:${packet.id}:source:${sourceId}`);
  for (const claimId of packet.claimIds || []) if (!researchClaimIdSet.has(claimId)) invalidResearchEdges.push(`packet:${packet.id}:claim:${claimId}`);
}
for (const claim of research.claims || []) for (const sourceId of claim.evidence || []) if (!researchSourceIdSet.has(sourceId)) invalidResearchEdges.push(`claim:${claim.id}:source:${sourceId}`);
for (const node of research.nodes || []) for (const sourceId of node.evidence || []) if (!researchSourceIdSet.has(sourceId)) invalidResearchEdges.push(`node:${node.id}:source:${sourceId}`);
for (const edge of research.edges || []) {
  if (!researchNodeIdSet.has(edge.from)) invalidResearchEdges.push(`edge:${edge.from}:missing-from`);
  if (!researchNodeIdSet.has(edge.to)) invalidResearchEdges.push(`edge:${edge.to}:missing-to`);
  for (const claimId of edge.evidence || []) if (!researchClaimIdSet.has(claimId)) invalidResearchEdges.push(`edge:${edge.from}->${edge.to}:claim:${claimId}`);
}
if (invalidResearchEdges.length) errors.push(`research packet edges invalid: ${invalidResearchEdges.join(',')}`);
const playerProductSourceIds = new Set(playerProduct.sources.map((source) => source.id));
const researchSourceIds = new Set((research.sources || []).map((source) => source.id));
const validSourceIds = new Set([...playerProductSourceIds, ...researchSourceIds]);
const taxonomyNodeIdSet = new Set(taxonomyNodeIds);
for (const nodeId of deepAnchorIds) if (!taxonomyNodeIdSet.has(nodeId)) errors.push(`deep taxonomy anchor missing: ${nodeId}`);
const foundationModuleIdSet = new Set(foundations.moduleIndex.map((module) => module.id));
const foundationLessonIdSet = new Set(foundationLessons.lessons.map((lesson) => lesson.id));
const foundationSourceIdSet = new Set([...researchSourceIdSet, ...(foundationLessons.sourceCatalog || []).map((source) => source.id), ...(knowledgeSources.sources || []).map((source) => source.id)]);
const foundationSourceCoverage = foundationLessons.sourceCoverage || {};
const invalidFoundationLessons = [];
for (const lesson of foundationLessons.lessons) {
  if (!foundationModuleIdSet.has(lesson.id)) invalidFoundationLessons.push(`lesson:${lesson.id}:not-in-module-index`);
  for (const field of foundations.lessonContract.requiredFields || []) if (typeof lesson[field] !== 'string' || !lesson[field].trim()) invalidFoundationLessons.push(`lesson:${lesson.id}:field:${field}`);
  if (!Array.isArray(lesson.sourceIds) || lesson.sourceIds.length === 0) invalidFoundationLessons.push(`lesson:${lesson.id}:missing-authored-sourceIds`);
  for (const nodeId of lesson.relatedAtlasNodeIds || []) if (!taxonomyNodeIdSet.has(nodeId)) invalidFoundationLessons.push(`lesson:${lesson.id}:node:${nodeId}`);
  for (const sourceId of [...new Set([...(lesson.sourceIds || []), ...(foundationSourceCoverage[lesson.id] || [])])]) if (!foundationSourceIdSet.has(sourceId)) invalidFoundationLessons.push(`lesson:${lesson.id}:source:${sourceId}`);
}
for (const moduleId of foundationModuleIdSet) if (!foundationLessonIdSet.has(moduleId)) invalidFoundationLessons.push(`module:${moduleId}:missing-lesson`);
if (invalidFoundationLessons.length) errors.push(`authored foundation lessons invalid: ${invalidFoundationLessons.join(',')}`);
if (foundationLessons.lessons.filter((lesson) => [...new Set([...(lesson.sourceIds || []), ...(foundationSourceCoverage[lesson.id] || [])])].length > 0).length !== 48) errors.push('foundation lesson source coverage incomplete');
const taxonomyDomainIdSet = new Set((research.taxonomyDomains || []).map((domain) => domain.id));
const invalidDomainGuides = [];
for (const guide of domainGuides.guides) {
  if (!taxonomyDomainIdSet.has(guide.id)) invalidDomainGuides.push(`guide:${guide.id}:not-in-taxonomy`);
  for (const field of ['definition', 'mechanism', 'unit', 'bottleneck', 'verificationQuestion', 'sourceName', 'sourceUrl']) if (typeof guide[field] !== 'string' || !guide[field].trim()) invalidDomainGuides.push(`guide:${guide.id}:field:${field}`);
  for (const nodeId of guide.nodeIds || []) if (!taxonomyNodeIdSet.has(nodeId)) invalidDomainGuides.push(`guide:${guide.id}:node:${nodeId}`);
}
if (invalidDomainGuides.length) errors.push(`domain guides invalid: ${invalidDomainGuides.join(',')}`);
const playerIds = new Set(playerProduct.players.map((player) => player.playerId));
const invalidReferenceEdges = [];
for (const player of playerProduct.players) {
  for (const sourceId of player.sourceIds || []) if (!validSourceIds.has(sourceId)) invalidReferenceEdges.push(`player:${player.playerId}:source:${sourceId}`);
  for (const nodeId of player.taxonomyNodeIds || []) if (!taxonomyNodeIdSet.has(nodeId)) invalidReferenceEdges.push(`player:${player.playerId}:node:${nodeId}`);
  if (player.asOf !== null) invalidReferenceEdges.push(`player:${player.playerId}:asOf`);
}
for (const product of playerProduct.products) {
  for (const sourceId of product.sourceIds || []) if (!validSourceIds.has(sourceId)) invalidReferenceEdges.push(`product:${product.productId}:source:${sourceId}`);
  for (const nodeId of product.taxonomyNodeIds || []) if (!taxonomyNodeIdSet.has(nodeId)) invalidReferenceEdges.push(`product:${product.productId}:node:${nodeId}`);
  if (!playerIds.has(product.playerId)) invalidReferenceEdges.push(`product:${product.productId}:player:${product.playerId}`);
  if (product.productionStatus !== null || product.asOf !== null) invalidReferenceEdges.push(`product:${product.productId}:currentness`);
}
if (invalidReferenceEdges.length) errors.push(`player/product reference edges invalid: ${invalidReferenceEdges.join(',')}`);
if (!atlas.includes('article identity mismatch') || !atlas.includes('validateCurrentObservationsArtifact') || !atlas.includes('applySafeExternalLink')) errors.push('atlas runtime artifact identity/schema/URL safety gates are missing');
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, route: 'atlas', packets: data.packets, candidateNodes: data.candidateNodes, taxonomyDomains: data.taxonomyDomains, taxonomyNodes: data.taxonomyNodes, deepTopics: data.deepTaxonomyTopics, deepBranches: data.deepTaxonomyBranches, deepAnchors: data.deepTaxonomyAnchors, evidenceClaims: data.evidenceClaims, primarySources: data.primarySources, status: data.status, reviewedAt: data.reviewedAt }));
