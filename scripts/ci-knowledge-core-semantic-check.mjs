import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_PRINCIPLES_CATALOG } from '../src/ui/pages/principles.js';
import { createClaimRegistry, createEvidenceRegistry, unresolvedEvidenceIds } from '../src/domain/knowledge/evidence.js';
import { EDGE_TYPES, inspectKnowledgeGraph, normalizeKnowledgeEdge, normalizeKnowledgeEdges } from '../src/domain/knowledge/graph.js';
import { loadKnowledgeCapabilities } from '../src/data/knowledge/load-capabilities.js';
import { createConceptRegistry } from '../src/domain/knowledge/ontology.js';
import { safeExternalHref } from '../src/ui/knowledge/safe-external-link.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const malformedEdge = normalizeKnowledgeEdge({ from: 'a', to: 'b', relation: 'requires', type: 'TYPO', direction: 'SIDEWAYS', conditions: 'not-an-array', sourceIds: 'PS-01' });
assert(malformedEdge.type === 'REQUIRES' && malformedEdge.direction === 'DIRECTED', `Invalid edge enums did not fail closed: ${JSON.stringify(malformedEdge)}`);
assert(malformedEdge.inferredFields.includes('type') && malformedEdge.inferredFields.includes('direction') && malformedEdge.inferredFields.includes('conditions') && malformedEdge.inferredFields.includes('sourceIds'), `Invalid edge fields were not audited: ${JSON.stringify(malformedEdge.inferredFields)}`);
assert(Object.isFrozen(EDGE_TYPES) && Array.isArray(EDGE_TYPES), 'Edge type vocabulary exposes a mutable Set');
assert(EDGE_TYPES.includes('RELATES_TO'), 'Knowledge graph lacks a non-causal navigation edge type');
let malformedEdgesRejected = false;
try { normalizeKnowledgeEdges('not-an-array'); } catch (_) { malformedEdgesRejected = true; }
assert(malformedEdgesRejected, 'Knowledge edge collection accepted a scalar input');

const principlesGraph = inspectKnowledgeGraph({
  nodeIds: MARKET_PRINCIPLES_CATALOG.nodes.map((node) => node.id),
  edges: MARKET_PRINCIPLES_CATALOG.edges
});
assert(principlesGraph.nodeCount === 60, `Principles node count: ${principlesGraph.nodeCount}`);
assert(principlesGraph.edgeCount === 71, `Principles edge count: ${principlesGraph.edgeCount}`);
assert(principlesGraph.invalidEndpoints.length === 0, `Principles invalid endpoints: ${JSON.stringify(principlesGraph.invalidEndpoints)}`);
assert(principlesGraph.components.length === 1, `Principles components: ${principlesGraph.components.map((component) => component.length).join(',')}`);
assert(principlesGraph.isolatedNodes.length === 0, `Principles isolated nodes: ${principlesGraph.isolatedNodes.join(',')}`);
assert(principlesGraph.metadataErrors.length === 0, `Principles edge metadata: ${JSON.stringify(principlesGraph.metadataErrors)}`);
assert(principlesGraph.inferredEdges.length === 0, `Principles inferred edge metadata: ${JSON.stringify(principlesGraph.inferredEdges)}`);
assert(!MARKET_PRINCIPLES_CATALOG.edges.some((edge) => edge.conditions.includes('교육용 구조 경로로 연결되며 조건은 원문 관계 설명에 따른다')), 'Generic causal fallback survived in Principles edge semantics');
const navigationEdge = MARKET_PRINCIPLES_CATALOG.edges.find((edge) => edge.from === 'defense-space' && edge.to === 'biotech-healthcare');
assert(navigationEdge?.type === 'RELATES_TO' && navigationEdge?.direction === 'BIDIRECTIONAL' && navigationEdge?.reviewStatus === 'STRUCTURAL_NAVIGATION_ONLY', `Cross-industry navigation edge overclaims causality: ${JSON.stringify(navigationEdge)}`);
assert(MARKET_PRINCIPLES_CATALOG.edges.some((edge) => edge.from === 'compute' && edge.to === 'photonic-link-economics'), 'Principles photonic edge must originate from an in-catalog concept');
assert(!MARKET_PRINCIPLES_CATALOG.edges.some((edge) => edge.from === 'network-fabric' && edge.to === 'photonic-link-economics'), 'Principles must not reference Atlas-only network-fabric');

const taxonomy = readJson('public-data/atlas/taxonomy-node-coverage.json');
const chainEdges = taxonomy.relationshipModel.domainChains.flatMap((chain) => chain.nodeIds.slice(0, -1).map((from, index) => ({
  id: `atlas-chain-${chain.domainId}-${index + 1}`,
  from,
  to: chain.nodeIds[index + 1],
  relation: 'domain value-chain sequence',
  type: 'ENABLES',
  direction: 'DIRECTED',
  kind: 'INDUSTRY',
  strength: 'CORE',
  polarity: 'CONDITIONAL',
  conditions: ['the preceding capability is available and qualified'],
  sourceIds: [],
  reviewedAt: '2026-08-10'
})));
const atlasEdges = normalizeKnowledgeEdges([...chainEdges, ...taxonomy.relationshipModel.crossDomainEdges], { kind: 'INDUSTRY', reviewedAt: '2026-08-10', reviewStatus: 'STRUCTURAL_REFERENCE_REVIEWED', sourceStatus: 'EVIDENCE_REGISTRY_REVIEWED' });
const atlasGraph = inspectKnowledgeGraph({ nodeIds: taxonomy.nodes.map((node) => node.nodeId), edges: atlasEdges });
assert(taxonomy.relationshipModel.crossDomainEdges.length === 22, `Atlas cross-domain edge count: ${taxonomy.relationshipModel.crossDomainEdges.length}`);
assert(atlasGraph.nodeCount === 95, `Atlas node count: ${atlasGraph.nodeCount}`);
assert(atlasGraph.edgeCount === 98, `Atlas edge count: ${atlasGraph.edgeCount}`);
assert(atlasGraph.invalidEndpoints.length === 0, `Atlas invalid endpoints: ${JSON.stringify(atlasGraph.invalidEndpoints)}`);
assert(atlasGraph.components.length === 1, `Atlas components: ${atlasGraph.components.map((component) => component.length).join(',')}`);
assert(atlasGraph.isolatedNodes.length === 0, `Atlas isolated nodes: ${atlasGraph.isolatedNodes.join(',')}`);
assert(atlasGraph.metadataErrors.length === 0, `Atlas edge metadata: ${JSON.stringify(atlasGraph.metadataErrors)}`);
assert(atlasGraph.inferredEdges.length === 0, `Atlas inferred edge metadata: ${JSON.stringify(atlasGraph.inferredEdges)}`);
for (const edge of taxonomy.relationshipModel.crossDomainEdges) {
  for (const field of ['id', 'from', 'to', 'relation', 'type', 'direction', 'kind', 'strength', 'polarity', 'reviewedAt']) assert(Boolean(edge[field]), `Atlas edge ${edge.id || `${edge.from}->${edge.to}`} missing ${field}`);
  assert(Array.isArray(edge.conditions) && edge.conditions.length > 0, `Atlas edge ${edge.id} missing conditions`);
  assert(Array.isArray(edge.sourceIds) && edge.sourceIds.length > 0, `Atlas edge ${edge.id} missing sourceIds`);
}

const research = readJson('public-data/atlas/source-packets.json');
const registry = readJson('public-data/atlas/player-product-registry.json');
const foundationLessons = readJson('public-data/atlas/foundation-lessons.json');
const domainPackets = readJson('public-data/atlas/domain-source-packets.json');
const knowledgeSources = readJson('public-data/knowledge/sources.json');
const evidence = createEvidenceRegistry(knowledgeSources, research, registry, foundationLessons, domainPackets);
const referencedSourceIds = [
  ...taxonomy.relationshipModel.crossDomainEdges.flatMap((edge) => edge.sourceIds || []),
  ...registry.players.flatMap((player) => player.sourceIds || []),
  ...registry.products.flatMap((product) => product.sourceIds || []),
  ...foundationLessons.lessons.flatMap((lesson) => lesson.sourceIds || [])
];
const unresolvedSources = unresolvedEvidenceIds(evidence, referencedSourceIds);
assert(evidence.conflicts.length === 0, `Evidence registry conflicts: ${JSON.stringify(evidence.conflicts)}`);
assert(unresolvedSources.length === 0, `Unresolved evidence IDs: ${unresolvedSources.join(',')}`);
assert([...new Set(referencedSourceIds)].every((sourceId) => evidence.resolve(sourceId)?.url), 'Every referenced evidence ID must resolve to a URL');
const primaryResearchSource = evidence.resolve('PS-01');
assert(primaryResearchSource?.publishedAt === '2026-06-04', 'Evidence view model must preserve source publication date');
assert(primaryResearchSource?.verification === 'opened_primary_source', 'Evidence view model must preserve source verification');
assert(Boolean(primaryResearchSource?.scope), 'Evidence view model must preserve source scope');
assert(!('byId' in evidence), 'Evidence registry must not expose its mutable Map index');
assert(safeExternalHref('https://www.sec.gov/Archives/test')?.startsWith('https://www.sec.gov/'), 'HTTPS source URL must be allowed');
for (const unsafeUrl of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'not a url', '']) assert(safeExternalHref(unsafeUrl) === null, `Unsafe URL must be rejected: ${unsafeUrl}`);

const samsungHbm = registry.products.find((product) => product.productId === 'samsung-hbm-family');
const ibmQuantum = registry.products.find((product) => product.productId === 'ibm-quantum-platform');
assert(samsungHbm?.taxonomyNodeIds.includes('memory-dram-hbm'), 'Samsung HBM must map to memory-dram-hbm');
assert(samsungHbm?.taxonomyNodeIds.includes('package-3d-stacking'), 'Samsung HBM must map to package-3d-stacking');
assert(!samsungHbm?.taxonomyNodeIds.includes('foundry-process-node'), 'Samsung HBM must not map to foundry-process-node');
assert(ibmQuantum?.taxonomyNodeIds.length === 1 && ibmQuantum.taxonomyNodeIds[0] === 'future-quantum', 'IBM Quantum must map only to future-quantum');

const capabilities = await loadKnowledgeCapabilities(async (url) => ({
  ok: url !== '/missing.json',
  status: url === '/missing.json' ? 404 : 200,
  async json() { return { url }; }
}), [{ key: 'available', url: '/available.json' }, { key: 'missing', url: '/missing.json' }]);
assert(capabilities.available.status === 'connected' && capabilities.available.value?.url === '/available.json', 'Capability loader must preserve a successful artifact');
assert(capabilities.missing.status === 'fallback' && capabilities.missing.value === null, 'Capability loader must isolate a failed artifact');
const invalidCapability = await loadKnowledgeCapabilities(async () => ({ ok: true, status: 200, async json() { return { wrong: true }; } }), [{ key: 'validated', url: '/invalid.json', validate: (value) => value?.expected === true }]);
assert(invalidCapability.validated.status === 'fallback' && invalidCapability.validated.value === null, 'Capability loader must fail closed on invalid artifact schema');

const conceptsArtifact = readJson('public-data/knowledge/concepts.json');
const aliasesArtifact = readJson('public-data/knowledge/aliases.json');
const ontology = createConceptRegistry(conceptsArtifact.concepts, aliasesArtifact.aliases);
assert(conceptsArtifact.concepts.length === 155, `Canonical concept count: ${conceptsArtifact.concepts.length}`);
assert(ontology.errors.length === 0, `Ontology errors: ${JSON.stringify(ontology.errors)}`);
assert(ontology.resolve('defense-autonomy').length === 2, 'Cross-page duplicate legacy ID must resolve through explicit equivalence');
assert(!('byId' in ontology), 'Ontology registry must not expose its mutable Map index');
const mutableConcept = { canonicalId: 'fixture:mutable', title: 'before' };
const immutableOntology = createConceptRegistry([mutableConcept], [{ alias: 'fixture:mutable', targets: ['fixture:mutable'] }]);
mutableConcept.title = 'after';
assert(immutableOntology.resolve('fixture:mutable')[0]?.title === 'before' && Object.isFrozen(immutableOntology.resolve('fixture:mutable')[0]), 'Ontology registry must isolate and freeze caller-owned concept objects');

const knowledgeClaims = readJson('public-data/knowledge/claims.json');
const unifiedEvidence = createEvidenceRegistry(knowledgeSources);
const claimRegistry = createClaimRegistry(knowledgeClaims.claims, unifiedEvidence);
assert(unifiedEvidence.conflicts.length === 0, `Unified evidence conflicts: ${JSON.stringify(unifiedEvidence.conflicts)}`);
assert(claimRegistry.duplicates.length === 0, `Duplicate claim IDs: ${claimRegistry.duplicates.join(',')}`);
assert(claimRegistry.unresolved.length === 0, `Unresolved claim sources: ${JSON.stringify(claimRegistry.unresolved)}`);
assert(!('byId' in claimRegistry), 'Claim registry must not expose its mutable Map index');
const malformedClaimSources = createClaimRegistry([{ claimId: 'fixture:claim', sourceIds: 'PS-01' }], unifiedEvidence).resolve('fixture:claim');
assert(malformedClaimSources?.sourceIds.length === 0, 'Claim registry must reject scalar sourceIds instead of splitting them into characters');
for (const claim of claimRegistry.claims) {
  if (claim.directness === 'DIRECT') {
    assert(claim.sourceIds.length > 0, `DIRECT claim has no source: ${claim.claimId}`);
    assert(claim.sourceIds.every((sourceId) => !['CONTEXT', 'DISCOVERY'].includes(unifiedEvidence.resolve(sourceId)?.sourceRole)), `DIRECT claim uses broad/discovery source: ${claim.claimId}`);
    assert(claim.publication !== 'CURRENT', `DIRECT educational claim cannot be CURRENT: ${claim.claimId}`);
  }
}

const report = {
  status: failures.length ? 'FAIL' : 'PASS',
  principles: { nodes: principlesGraph.nodeCount, edges: principlesGraph.edgeCount, components: principlesGraph.components.map((component) => component.length), isolated: principlesGraph.isolatedNodes.length },
  atlas: { nodes: atlasGraph.nodeCount, edges: atlasGraph.edgeCount, components: atlasGraph.components.map((component) => component.length), isolated: atlasGraph.isolatedNodes.length },
  evidence: { registered: evidence.sources.length, referenced: new Set(referencedSourceIds).size, unresolved: unresolvedSources.length, conflicts: evidence.conflicts.length },
  capabilityIsolation: { available: capabilities.available.status, missing: capabilities.missing.status },
  ontology: { concepts: conceptsArtifact.concepts.length, aliases: aliasesArtifact.aliases.length, registryErrors: ontology.errors.length },
  claimDirectness: { sources: unifiedEvidence.sources.length, claims: claimRegistry.claims.length, unresolved: claimRegistry.unresolved.length, duplicates: claimRegistry.duplicates.length },
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
