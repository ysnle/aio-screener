import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const atlas = read('src/ui/pages/atlas.js');
const index = read('index.html');
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
const telegramReference = JSON.parse(read('public-data/telegram-reference-window.json'));
const playerProduct = JSON.parse(read('public-data/atlas/player-product-registry.json'));
const currentness = JSON.parse(read('public-data/atlas/player-product-currentness.json'));
const errors = [];
const required = [
  ['route', routes.includes("'atlas'")],
  ['slice', slices.includes("vs13-atlas")],
  ['bootstrap import', bootstrap.includes("createAtlasPage")],
  ['bootstrap mount', bootstrap.includes("modules.atlas")],
  ['index page', index.includes('id="page-atlas"')],
  ['index content sink', index.includes('data-atlas-content')],
  ['factory', atlas.includes('export function createAtlasPage')],
  ['reference-connected state', atlas.includes("DESIGN_ONLY") && data.status === 'REFERENCE_CONNECTED' && data.researchArtifact === 'public-data/atlas/source-packets.json'],
  ['telegram discovery boundary', atlas.includes('discovery only') && data.telegram.role === 'DISCOVERY'],
  ['player/product reference registry', atlas.includes('PLAYER_PRODUCT_URL') && atlas.includes('createPlayerProductView') && data.playerProductArtifact === 'public-data/atlas/player-product-registry.json' && playerProduct.status === 'ROLE_REFERENCE_ONLY'],
  ['source-linked player/product references', atlas.includes('createReferenceSourceLinks') && atlas.includes('atlas-reference-source-link')],
  ['no current promotion', atlas.includes('publishedCurrentClaims') || data.publishedCurrentClaims === 0],
  ['domain source packets', atlas.includes('DOMAIN_PACKETS_URL') && atlas.includes('domainPackets') && data.domainSourcePacketArtifact === 'public-data/atlas/domain-source-packets.json'],
  ['domain claim ledger', atlas.includes('DOMAIN_CLAIMS_URL') && atlas.includes('claimLedger') && data.domainClaimLedgerArtifact === 'public-data/atlas/domain-claim-ledger.json'],
  ['taxonomy node coverage', atlas.includes('TAXONOMY_COVERAGE_URL') && atlas.includes('nodeCoverage') && data.taxonomyNodeCoverageArtifact === 'public-data/atlas/taxonomy-node-coverage.json'],
  ['deep taxonomy', atlas.includes('DEEP_TAXONOMY_URL') && atlas.includes('createDeepTaxonomyView') && data.deepTaxonomyArtifact === 'public-data/atlas/deep-taxonomy.json'],
  ['telegram reference window', atlas.includes('TELEGRAM_REFERENCE_URL') && atlas.includes('createTelegramReferenceView') && data.telegramReferenceArtifact === 'public-data/telegram-reference-window.json'],
  ['player/product currentness overlay', atlas.includes('PLAYER_PRODUCT_CURRENTNESS_URL') && atlas.includes('mergePlayerProductCurrentness') && data.playerProductCurrentnessArtifact === 'public-data/atlas/player-product-currentness.json'],
  ['safe dom', atlas.includes('replaceChildren') && !atlas.includes('innerHTML')]
];
required.forEach(([label, ok]) => { if (!ok) errors.push(label); });
if (data.packets !== 11 || data.reviewedNodes !== 0 || data.candidateNodes !== 12 || data.taxonomyDomains !== 19 || data.taxonomyNodes !== 95 || data.evidenceClaims !== 14 || data.primarySources !== 23 || data.foundationLayers !== 7 || data.foundationModules !== 48) errors.push('reference data counts');
if (!atlas.includes('createResearchView') || !atlas.includes('RESEARCH_URL') || !atlas.includes('createCurriculumView') || !atlas.includes('FOUNDATIONS_URL') || !atlas.includes('FOUNDATIONS_LESSONS_URL') || !atlas.includes('DOMAIN_GUIDES_URL') || !atlas.includes('createDomainGuide') || !atlas.includes('atlas-module-authored') || !atlas.includes('atlas-domain-guide')) errors.push('research view connection');
if (!atlas.includes('ATLAS_CONCEPT_GUIDES') || !atlas.includes('createTaxonomyGuide') || !atlas.includes('FOUNDATION_TRACK_DISPLAY') || !atlas.includes('FOUNDATION_TEACHING_FRAME') || !atlas.includes('atlas-module-visualization') || !atlas.includes('TELEGRAM_DISCOVERY_BOUNDARY')) errors.push('user-facing atlas explanations or discovery boundary');
if (foundations.status !== 'REFERENCE_CONNECTED' || foundations.layers.length !== 7 || foundations.moduleIndex.length !== 48 || foundations.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || foundations.lessonContract?.visualizationStatus !== 'CONCEPT_FRAME_CONNECTED' || foundations.lessonContract?.shortFormStatus !== 'AUTHORED_REFERENCE_CONNECTED' || foundations.lessonContract?.shortFormArtifact !== 'public-data/atlas/foundation-lessons.json' || foundations.lessonContract?.longFormStatus !== 'AUTHORED_REFERENCE_CONNECTED') errors.push('curriculum artifact counts or publication boundary');
if (data.foundationLessonArtifact !== 'public-data/atlas/foundation-lessons.json' || data.authoredFoundationLessons !== 48 || foundationLessons.status !== 'REFERENCE_CONNECTED' || foundationLessons.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || foundationLessons.shortFormStatus !== 'AUTHORED_REFERENCE_CONNECTED' || foundationLessons.longFormStatus !== 'AUTHORED_REFERENCE_CONNECTED' || foundationLessons.lessons.length !== 48 || foundationLessons.authoringContract?.coverage !== '48/48 modules have an authored definition, mechanism, example, failure boundary, question, visualization and source linkage where a primary reference is available') errors.push('authored foundation lesson artifact counts or publication boundary');
if (data.domainGuideArtifact !== 'public-data/atlas/domain-guides.json' || data.domainGuides !== 19 || domainGuides.status !== 'REFERENCE_CONNECTED' || domainGuides.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || domainGuides.guides.length !== 19) errors.push('domain guide artifact counts or publication boundary');
if (data.domainSourcePacketArtifact !== 'public-data/atlas/domain-source-packets.json' || data.domainSourcePackets !== 19 || domainPackets.status !== 'REFERENCE_CONNECTED' || domainPackets.packets.length !== 19 || domainPackets.packets.some((packet) => packet.sources?.length !== 3 || !packet.reviewedAt)) errors.push('domain source packet coverage');
if (data.domainClaimLedgerArtifact !== 'public-data/atlas/domain-claim-ledger.json' || data.domainStructuralClaims !== 57 || data.domainCurrentClaims !== 0 || domainClaims.status !== 'REFERENCE_CONNECTED' || domainClaims.claims.length !== 57 || domainClaims.counts?.currentClaims !== 0 || domainClaims.claims.some((claim) => claim.status !== 'PARTIAL' || claim.asOf !== null || claim.sourceIds?.length !== 3)) errors.push('domain claim ledger coverage');
if (data.taxonomyNodeCoverageArtifact !== 'public-data/atlas/taxonomy-node-coverage.json' || data.taxonomyNodeCoverage !== 95 || taxonomyCoverage.status !== 'STRUCTURAL_COVERAGE_CONNECTED' || taxonomyCoverage.coverage?.nodes !== 95 || taxonomyCoverage.nodes.length !== 95 || taxonomyCoverage.coverage?.currentClaims !== 0 || taxonomyCoverage.nodes.some((node) => !node.roleReference || !node.productFamilyReference || !node.verificationQuestion || node.currentClaims !== 0)) errors.push('taxonomy node coverage');
const deepBranchCount = deepTaxonomy.topics.reduce((sum, topic) => sum + (topic.branches?.length || 0), 0);
const deepAnchorIds = new Set(deepTaxonomy.topics.flatMap((topic) => topic.anchorNodeIds || []));
const deepCorpus = JSON.stringify(deepTaxonomy);
const requiredDeepConcepts = ['3nm', '2nm', '18A', 'DUV', 'EUV', 'High-NA', '유리기판', 'Photonics', 'Open Weights', 'HBM', 'CXL', 'AIDC', 'World Model', 'Artemis'];
if (data.deepTaxonomyTopics !== 10 || data.deepTaxonomyBranches !== 50 || data.deepTaxonomyAnchors !== 56 || deepTaxonomy.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || deepTaxonomy.topics.length !== 10 || deepBranchCount !== 50 || deepAnchorIds.size !== 56 || deepTaxonomy.topics.some((topic) => !topic.title || !topic.relation || !topic.why || !topic.anchorNodeIds?.length || !topic.branches?.length || topic.branches.some((branch) => !branch.title || !branch.summary || !branch.mechanism || !branch.observe || !branch.caution || !branch.children?.length)) || requiredDeepConcepts.some((concept) => !deepCorpus.includes(concept))) errors.push('deep taxonomy coverage');
if (data.telegramReferenceArtifact !== 'public-data/telegram-reference-window.json' || data.telegramReferenceChannels !== 5 || data.telegramObservedLineage !== 813 || telegramReference.status !== 'REFERENCE_ONLY' || telegramReference.channels.length !== 5 || telegramReference.promotedClaims !== 0 || telegramReference.channels.some((channel) => !channel.url || !channel.status)) errors.push('telegram reference coverage');
if (data.referencePlayers !== 20 || data.referenceProducts !== 20 || data.referenceSources !== 20 || playerProduct.players.length !== 20 || playerProduct.products.length !== 20 || playerProduct.sources.length !== 20 || playerProduct.publication !== 'EDUCATIONAL_REFERENCE_ONLY') errors.push('player/product registry counts or publication boundary');
if (data.playerProductCurrentnessArtifact !== 'public-data/atlas/player-product-currentness.json' || data.currentnessPlayers !== 20 || data.currentnessProducts !== 20 || currentness.status !== 'REFERENCE_CURRENTNESS_CONNECTED' || currentness.players.length !== 20 || currentness.products.length !== 20 || currentness.products.some((product) => !product.productionStatus || !product.asOf || !product.statusBasis)) errors.push('player/product currentness coverage');
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
const invalidFoundationLessons = [];
for (const lesson of foundationLessons.lessons) {
  if (!foundationModuleIdSet.has(lesson.id)) invalidFoundationLessons.push(`lesson:${lesson.id}:not-in-module-index`);
  for (const field of foundations.lessonContract.requiredFields || []) if (typeof lesson[field] !== 'string' || !lesson[field].trim()) invalidFoundationLessons.push(`lesson:${lesson.id}:field:${field}`);
  for (const nodeId of lesson.relatedAtlasNodeIds || []) if (!taxonomyNodeIdSet.has(nodeId)) invalidFoundationLessons.push(`lesson:${lesson.id}:node:${nodeId}`);
  for (const sourceId of lesson.sourceIds || []) if (!researchSourceIdSet.has(sourceId)) invalidFoundationLessons.push(`lesson:${lesson.id}:source:${sourceId}`);
}
for (const moduleId of foundationModuleIdSet) if (!foundationLessonIdSet.has(moduleId)) invalidFoundationLessons.push(`module:${moduleId}:missing-lesson`);
if (invalidFoundationLessons.length) errors.push(`authored foundation lessons invalid: ${invalidFoundationLessons.join(',')}`);
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
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, route: 'atlas', packets: data.packets, candidateNodes: data.candidateNodes, taxonomyDomains: data.taxonomyDomains, taxonomyNodes: data.taxonomyNodes, deepTopics: data.deepTaxonomyTopics, deepBranches: data.deepTaxonomyBranches, deepAnchors: data.deepTaxonomyAnchors, evidenceClaims: data.evidenceClaims, primarySources: data.primarySources, status: data.status, reviewedAt: data.reviewedAt }));
