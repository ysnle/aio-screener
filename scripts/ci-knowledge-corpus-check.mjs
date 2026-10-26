#!/usr/bin/env node
// Knowledge corpus contract (v58.84 gate consolidation): the generated knowledge artifacts, their renderers and
// learning state. Each section below was a separate gate until v58.84; none was cited by a postmortem as the catch
// for a regression, and all read the same static knowledge corpus, so one gate runs them in order.
import { runSections } from './lib/gate-sections.mjs';

await runSections('knowledge-corpus', [
// ── section core (was ci-knowledge-core-semantic-check.mjs) ──
['core', async () => {
const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { MARKET_PRINCIPLES_CATALOG } = await import('../src/ui/pages/principles.js');
const { createClaimRegistry, createEvidenceRegistry, unresolvedEvidenceIds } = await import('../src/domain/knowledge/evidence.js');
const { EDGE_TYPES, inspectKnowledgeGraph, normalizeKnowledgeEdge, normalizeKnowledgeEdges } = await import('../src/domain/knowledge/graph.js');
const { loadKnowledgeCapabilities } = await import('../src/data/knowledge/load-capabilities.js');
const { safeExternalHref } = await import('../src/ui/knowledge/safe-external-link.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const unspecifiedEdge = normalizeKnowledgeEdge({ from: 'a', to: 'b', relation: '참고 관계' });
if (unspecifiedEdge.type !== 'RELATES_TO' || !unspecifiedEdge.inferredFields.includes('type')) fail('unknown edge relation must not imply causality');
const explicitCause = normalizeKnowledgeEdge({ from: 'a', to: 'b', relation: 'explicit reviewed cause', type: 'CAUSES' });
if (explicitCause.type !== 'CAUSES') fail('explicit causal relationship was lost');
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
assert(conceptsArtifact.concepts.length === 212, `Canonical concept count: ${conceptsArtifact.concepts.length}`);

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
  ontology: { concepts: conceptsArtifact.concepts.length, aliases: aliasesArtifact.aliases.length },
  claimDirectness: { sources: unifiedEvidence.sources.length, claims: claimRegistry.claims.length, unresolved: claimRegistry.unresolved.length, duplicates: claimRegistry.duplicates.length },
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
}],
// ── section principles-lesson-parity (was ci-principles-lesson-parity-contract-check.mjs) ──
['principles-lesson-parity', async () => {
const { spawnSync } = await import('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } = await import('node:fs');
const { isDeepStrictEqual } = await import('node:util');
const { dirname, join, resolve } = await import('node:path');
const { tmpdir } = await import('node:os');
const { fileURLToPath } = await import('node:url');

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const builderPath = 'scripts/build-principles-lessons.mjs';
const canonicalPath = 'public-data/principles/lesson-library.json';
const canonical = JSON.parse(readFileSync(join(root, canonicalPath), 'utf8'));
const canonicalD6 = canonical.lessons?.find((lesson) => lesson.id === 'D6');
const builderSource = readFileSync(join(root, builderPath), 'utf8');
const failures = [];
const checks = [];

function check(label, passed, detail = '') {
  checks.push(label);
  if (!passed) failures.push(`${label}${detail ? `: ${detail}` : ''}`);
}

check('P1303/R560/QA-DATA-47 canonical Principles library contains 112 lessons and D6',
  canonical.lessons?.length === 112 && canonicalD6?.title === '중립금리와 정책 스탠스');
check('P1303/R560/QA-DATA-47 lesson builder publishes through the shared atomic JSON writer',
  /import\s+\{\s*atomicWriteJsonSync\s*\}\s+from\s+['"]\.\/lib\/atomic-write\.mjs['"]/.test(builderSource)
    && /atomicWriteJsonSync\(outputPath,\s*artifact\)/.test(builderSource)
    && !/\bfs\.writeFileSync\s*\(|\bfs\.writeFile\s*\(/.test(builderSource));

const isolatedRoot = mkdtempSync(join(tmpdir(), 'aio-principles-lesson-parity-'));
const inputPaths = [builderPath, 'scripts/lib/atomic-write.mjs', 'scripts/lib/principles-stories.mjs', 'scripts/lib/principles-stories-a-d.mjs', 'scripts/lib/principles-stories-e-h.mjs', 'scripts/lib/principles-stories-i-k.mjs', 'scripts/lib/principles-stories-l-m.mjs', 'scripts/lib/principles-stories-n-o.mjs', 'scripts/lib/principles-worked.mjs', 'scripts/lib/principles-worked-a-h.mjs', 'scripts/lib/principles-worked-i-o.mjs', 'public-data/principles/chapters.json'];
try {
  for (const relativePath of inputPaths) {
    const target = join(isolatedRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, relativePath), target);
  }

  const outputPath = join(isolatedRoot, canonicalPath);
  const outputs = [];
  const runResults = [];
  for (let runIndex = 0; runIndex < 2; runIndex += 1) {
    const result = spawnSync(process.execPath, [join(isolatedRoot, builderPath)], {
      cwd: isolatedRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    runResults.push(result);
    if (result.status !== 0) break;
    outputs.push(readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n'));
  }

  const runFailure = runResults.find((result) => result.status !== 0);
  check('P1303/R560/QA-DATA-47 isolated builder runs succeed twice',
    runResults.length === 2 && !runFailure,
    runFailure ? String(runFailure.stderr || runFailure.stdout || `exit ${runFailure.status}`).trim() : 'second run was not reached');

  const generated = outputs.length ? JSON.parse(outputs[0]) : null;
  const generatedD6 = generated?.lessons?.find((lesson) => lesson.id === 'D6');
  check('P1303/R560/QA-DATA-47 builder output retains all 112 canonical lesson entries including D6',
    generated?.lessons?.length === 112 && generatedD6?.title === '중립금리와 정책 스탠스');
  check('P1303/R560/QA-DATA-47 builder preserves D6 content and metadata from the canonical artifact',
    Boolean(generatedD6 && canonicalD6 && isDeepStrictEqual(generatedD6, canonicalD6)));
  check('P1303/R560/QA-DATA-47 repeated isolated builder runs produce identical target bytes',
    outputs.length === 2 && outputs[0] === outputs[1]);
} finally {
  rmSync(isolatedRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

if (failures.length) {
  console.error(`Principles lesson parity contract failed (${failures.length}/${checks.length}):`);
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(`Principles lesson parity contract OK: ${checks.length} checks, 112 lessons, D6 metadata preserved, deterministic output.`);
}],
// ── section integrated-framework (was ci-integrated-framework-contract.mjs) ──
['integrated-framework', async () => {

const { default: assert } = await import('node:assert/strict');
const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const artifact = readJson('public-data/knowledge/integrated-market-ai-frameworks.json');
const concepts = readJson('public-data/knowledge/concepts.json');
const conceptIds = new Set((concepts.concepts || []).map((concept) => concept.canonicalId));
const frameworks = artifact.frameworks || [];
const required = ['definition', 'mechanism', 'observables', 'confirmation', 'invalidation', 'counterclaim', 'question', 'visualization'];

assert.equal(artifact.schemaVersion, 'integrated-market-ai-framework-pack.v1');
assert.equal(artifact.status, 'REFERENCE_ONLY');
assert.equal(artifact.publication, 'EDUCATIONAL_REFERENCE_ONLY');
assert.equal(frameworks.length, 29);
assert.equal(frameworks.filter((framework) => framework.page === 'principles').length, 12);
assert.equal(frameworks.filter((framework) => framework.page === 'atlas').length, 17);
for (const framework of frameworks) {
  for (const field of required) assert(framework[field] && (!Array.isArray(framework[field]) || framework[field].length), `${framework.id}: missing ${field}`);
  assert.equal(framework.currentClaimsAllowed, false, `${framework.id}: current claims boundary`);
  assert.equal(framework.rankingUse, 'none', `${framework.id}: ranking boundary`);
  for (const linkedConceptId of framework.linkedConceptIds || []) assert(conceptIds.has(linkedConceptId), `${framework.id}: dangling linked concept ${linkedConceptId}`);
}
assert((artifact.articles || []).every((article) => Array.isArray(article.sources) && article.sources.length === 0), 'integrated articles must not replay raw source URLs');
const serialized = JSON.stringify(artifact);
assert(!/(?:x\.com|twitter\.com|notion\.site|당신은_어떻게|nathan|Nathan)/i.test(serialized), 'user-facing integrated artifact must not replay source identity or external-post URLs');
assert.equal(artifact.datedScene?.asOf, '2026-09-12');
assert.equal(artifact.datedScene?.status, 'REFERENCE_CANDIDATE_REQUIRES_PRIMARY_RECONCILIATION');
assert.equal(artifact.integrationAudit?.find((row) => row.id === 'market-principles-curriculum')?.inventory, 112);
assert.equal(artifact.integrationAudit?.find((row) => row.id === 'ai-era-foundations')?.inventory, 48);
assert.equal(artifact.integrationAudit?.find((row) => row.id === 'structural-frameworks')?.inventory, 28);
assert.equal(artifact.integrationAudit?.find((row) => row.id === 'current-supplied-manuscript')?.checks?.rawDocumentReplay, false);
assert(read('src/ui/pages/principles.js').includes("createIntegratedFrameworkSpine"), 'Principles page must consume the integrated spine');
assert(read('src/ui/pages/atlas.js').includes("createIntegratedFrameworkSpine"), 'Atlas page must consume the integrated spine');
assert(read('src/ai/retrieval/knowledge.js').includes("integrated-frameworks"), 'AI retrieval must allow the integrated framework surface');
console.log(JSON.stringify({ status: 'PASS', frameworks: frameworks.length, principles: 12, atlas: 17, datedScene: artifact.datedScene.status, identityReplay: false, rankingMutation: false }, null, 2));
}],
// ── section ontology (was ci-knowledge-ontology-contract.mjs) ──
['ontology', async () => {

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { MARKET_PRINCIPLES_CATALOG } = await import('../src/ui/pages/principles.js');
const { NATHAN_KNOWLEDGE_CONCEPTS } = await import('../src/domain/knowledge/nathan-framework-pack.js');
const { INTEGRATED_KNOWLEDGE_CONCEPTS } = await import('../src/domain/knowledge/integrated-market-ai-framework-pack.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const conceptsArtifact = readJson('public-data/knowledge/concepts.json');
const aliasesArtifact = readJson('public-data/knowledge/aliases.json');
const taxonomy = readJson('public-data/atlas/taxonomy-node-coverage.json');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const concepts = conceptsArtifact.concepts || [];
const aliases = aliasesArtifact.aliases || [];
// v58.51: the in-memory concept registry (src/domain/knowledge/ontology.js) had no product caller and was removed; the
// artifact checks below (unique ids, live inventories, equivalence groups, alias targets) are the contract.
const expected = [
  ...MARKET_PRINCIPLES_CATALOG.nodes.map((node) => ({ surface: 'principles', legacyId: node.id })),
  ...taxonomy.nodes.map((node) => ({ surface: 'atlas', legacyId: node.nodeId })),
  ...NATHAN_KNOWLEDGE_CONCEPTS.map((concept) => ({ surface: concept.surface, legacyId: concept.legacyId })),
  ...INTEGRATED_KNOWLEDGE_CONCEPTS.map((concept) => ({ surface: concept.surface, legacyId: concept.legacyId }))
];
const expectedKeys = new Set(expected.map((item) => `${item.surface}:${item.legacyId}`));
const conceptKeys = new Set(concepts.map((item) => item.canonicalId));

assert(conceptsArtifact.schemaVersion === 'knowledge-concepts.v1', 'concepts schema version mismatch');
assert(aliasesArtifact.schemaVersion === 'knowledge-aliases.v1', 'aliases schema version mismatch');
assert(concepts.length === 212, `concept count ${concepts.length} !== 212`);
assert(new Set(concepts.map((item) => item.canonicalId)).size === concepts.length, 'duplicate canonical concept ID');
assert(expectedKeys.size === conceptKeys.size && [...expectedKeys].every((key) => conceptKeys.has(key)), 'canonical concepts drift from live source inventories');

const groupMembers = new Map();
for (const concept of concepts) {
  assert(concept.surface === concept.canonicalId.split(':')[0], `surface mismatch: ${concept.canonicalId}`);
  assert(concept.canonicalId.endsWith(`:${concept.legacyId}`), `legacy ID mismatch: ${concept.canonicalId}`);
  if (concept.equivalenceGroup) {
    const bucket = groupMembers.get(concept.equivalenceGroup) || [];
    bucket.push(concept);
    groupMembers.set(concept.equivalenceGroup, bucket);
  }
}
for (const [group, members] of groupMembers) {
  assert(members.length === 2, `${group} must contain exactly two concepts`);
  assert(new Set(members.map((item) => item.surface)).size === 2, `${group} must span Principles and Atlas`);
  assert(new Set(members.map((item) => item.legacyId)).size === 1, `${group} legacy IDs must match`);
}
for (const alias of aliases) {
  assert(Array.isArray(alias.targets) && alias.targets.length > 0, `alias has no targets: ${alias.alias}`);
  assert(alias.targets.every((target) => conceptKeys.has(target)), `alias target missing: ${alias.alias}`);
  if (alias.targets.length > 1) {
    const targets = alias.targets.map((target) => concepts.find((concept) => concept.canonicalId === target));
    const structural = targets.every((target) => target?.surface === 'nathan-frameworks');
    assert(structural ? alias.resolution === 'multi-framework' : alias.resolution === 'explicit-equivalence', `ambiguous alias is not explicit: ${alias.alias}`);
    if (!structural) assert(targets.every((target) => target?.equivalenceGroup) && new Set(targets.map((target) => target.equivalenceGroup)).size === 1, `ambiguous alias lacks shared equivalence: ${alias.alias}`);
  }
}

const report = {
  status: failures.length ? 'FAIL' : 'PASS',
  concepts: concepts.length,
  principles: expected.filter((item) => item.surface === 'principles').length,
  atlas: expected.filter((item) => item.surface === 'atlas').length,
  aliases: aliases.length,
  equivalenceGroups: groupMembers.size,
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
}],
// ── section articles (was ci-knowledge-article-contract.mjs) ──
['articles', async () => {

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const requiredArticleFields = ['intuition', 'formalModelOrRationale', 'workedExampleOrRationale', 'realEconomyChannel', 'companyChannel', 'financialStatementChannel', 'valuationChannel', 'marketChannel', 'tradingApplication', 'invalidation', 'glossary', 'claimIds'];
const lessonsBySurface = new Map([
  ['principles', readJson('public-data/principles/lesson-library.json').lessons],
  ['atlas-foundations', readJson('public-data/atlas/foundation-lessons.json').lessons]
]);
const articles = [];
for (const [surface, directory] of [['principles', 'public-data/knowledge/articles/principles'], ['atlas-foundations', 'public-data/knowledge/articles/atlas-foundations']]) {
  const files = fs.readdirSync(path.join(root, directory)).filter((file) => file.endsWith('.json')).sort();
  for (const file of files) articles.push({ surface, file, value: readJson(`${directory}/${file}`) });
}
assert(articles.length === 160, `article count ${articles.length} !== 160`);
const ids = new Set();
for (const { surface, file, value } of articles) {
  assert(value.schemaVersion === 'knowledge-article.v1', `${file}: schemaVersion`);
  assert(value.surface === surface, `${file}: surface`);
  assert(!ids.has(value.articleId), `${file}: duplicate articleId`);
  ids.add(value.articleId);
  for (const field of requiredArticleFields) assert(value.article?.[field] != null, file + ': missing article.' + field);
  const source = lessonsBySurface.get(surface).find((lesson) => lesson.id === value.lessonId);
  assert(!!source, file + ': source lesson missing');
  const short = source?.summary || {};
  assert(value.article?.intuition === short.definition, file + ': definition altered or padded');
  assert(value.article?.formalModelOrRationale?.text === short.mechanism, file + ': mechanism altered or padded');
  assert(JSON.stringify(value.article?.workedExampleOrRationale?.inputs) === JSON.stringify([short.example]), file + ': example altered or padded');
  assert(value.article?.invalidation === short.counterScenario, file + ': counter scenario altered');
  assert(value.article?.tradingApplication === short.verificationQuestion, file + ': question altered');
  assert((source?.sourceIds || []).every((id) => value.article?.sourceIds?.includes(id)), file + ': source IDs lost');
  assert(value.quality?.contentForm === 'SOURCE_SUMMARY' && value.deepArticle?.status === 'RECONSTRUCTION_REQUIRED', file + ': unreviewed depth promotion');
  assert(!value.deepArticle?.progressiveDisclosure?.includes('5-minute-core-article'), file + ': inflated reading promise');
  assert(value.publication === 'EDUCATIONAL_REFERENCE_ONLY', file + ': publication boundary');
  assert(value.authoringStatus === 'STRUCTURED_REFERENCE_DRAFT' || value.authoringStatus === 'AUTHOR_REVIEWED' || value.authoringStatus === 'PUBLISHED_REFERENCE', `${file}: invalid authoring status`);
}
const learning = readJson('public-data/knowledge/learning-graph.json');
assert(learning.nodes.length === 160, `learning node count ${learning.nodes.length} !== 160`);
assert(learning.paths.length >= 8, `learning path count ${learning.paths.length} < 8`);
const nodeIds = new Set(learning.nodes.map((node) => node.id));
for (const node of learning.nodes) {
  for (const relation of [...(node.prerequisiteIds || []), ...(node.nextIds || []), ...(node.expertRouteIds || [])]) assert(nodeIds.has(relation), `learning graph dangling relation ${node.id}->${relation}`);
  assert((node.nextIds || []).length > 0 || (node.expertRouteIds || []).length > 0, `learning graph dead end ${node.id}`);
}
for (const entry of learning.paths) for (const nodeId of entry.nodeIds || []) assert(nodeIds.has(nodeId), `learning path dangling node ${entry.id}->${nodeId}`);
const report = { status: failures.length ? 'FAIL' : 'PASS', articles: articles.length, learningNodes: learning.nodes.length, paths: learning.paths.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
}],
// ── section learning-state (was ci-knowledge-learning-state-contract.mjs) ──
['learning-state', async () => {

const { default: assert } = await import('node:assert/strict');
const { knowledgeTargetHash, navigateKnowledgeTarget, parseKnowledgeRouteState, parseKnowledgeTargetContext, serializeKnowledgeRouteState } = await import('../src/app/knowledge-route-state.js');
const { createLearningState } = await import('../src/domain/knowledge/learning-state.js');

const location = { href: 'https://aio-screener.local/?mode=graph&node=compute&path=ai&step=2#principles', pathname: '/', search: '?mode=graph&node=compute&path=ai&step=2', hash: '#principles' };
const parsed = parseKnowledgeRouteState(location);
assert.equal(parsed.mode, 'graph');
assert.equal(parsed.node, 'compute');
assert.equal(parsed.step, 2);
const serialized = serializeKnowledgeRouteState(location, { mode: 'tree', node: 'ai-era', lesson: 'A1', step: 0 });
assert.equal(serialized, '/?mode=tree&node=ai-era&step=0&lesson=A1#principles');
assert.equal(knowledgeTargetHash({ routeId: 'not-a-route', conceptId: 'x' }), '');
assert.equal(parseKnowledgeTargetContext({ root: { _aioPendingRouteHash: '#not-a-route?knowledgeNode=x' }, locationLike: location }), null);
const parsedTarget = parseKnowledgeTargetContext({ root: { _aioPendingRouteHash: '#ticker?knowledgeNode=valuation&return=%5B1%2C2%5D' }, locationLike: location });
assert.equal(parsedTarget.routeId, 'ticker');
assert.equal(parsedTarget.returnContext, null);
let shown = null;
assert.equal(navigateKnowledgeTarget({ root: { showPage: (route) => { shown = route; } }, target: { routeId: 'not-a-route' } }), false);
assert.equal(shown, null);
const store = new Map();
const storage = { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
const learning = createLearningState({ storage, now: () => '2026-08-11T00:00:00.000Z' });
learning.markViewed('principles:A1');
learning.toggleBookmark('principles:A1');
learning.setNote('principles:A1', '재방문 확인');
const snapshot = learning.snapshot();
assert.equal(snapshot.progress['principles:A1'].viewed, true);
assert.deepEqual(snapshot.bookmarks, ['principles:A1']);
assert.equal(snapshot.notes['principles:A1'].value, '재방문 확인');
assert.equal(Object.isFrozen(snapshot.progress['principles:A1']), true);
assert.equal(Object.isFrozen(snapshot.notes['principles:A1']), true);
assert.throws(() => { snapshot.progress['principles:A1'].viewed = false; }, TypeError);
learning.markViewed('__proto__');
assert.equal(Object.getPrototypeOf(learning.snapshot().progress), Object.prototype);
const reloaded = createLearningState({ storage, now: () => '2026-08-11T00:00:00.000Z' }).snapshot();
assert.equal(reloaded.progress['principles:A1'].viewed, true);
console.log(JSON.stringify({ status: 'PASS', serialized, persisted: Boolean(reloaded.notes['principles:A1']) }, null, 2));
}],
// ── section route-targets (was ci-knowledge-route-bridge-contract.mjs) ──
['route-targets', async () => {

// v58.51: the route-bridge facade (src/domain/knowledge/route-bridge.js) had no product caller and was removed. This gate now
// checks the published route-targets artifact itself against the live route registry (src/app/routes.js).
const { default: assert } = await import('node:assert/strict');
const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { isRouteId } = await import('../src/app/routes.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'public-data/knowledge/route-targets.json'), 'utf8'));
assert.equal(artifact.counts.articleTargets, 188);
assert.equal(artifact.counts.compatibilityTargets, 39);
assert.equal(artifact.targets.length, 227);
assert.equal(artifact.scenarios.length, 18);
assert.equal(artifact.scenarios.some((scenario) => /mobile|tablet|touch/i.test(String(scenario.persona || ''))), false, 'desktop-only knowledge scenarios must not restore mobile personas');
const byArticle = new Map(artifact.targets.map((target) => [target.articleId, target]));
assert.equal(byArticle.size, artifact.targets.length, 'route targets must have unique article ids');
for (const target of artifact.targets) {
  if (target.routeId) assert(isRouteId(target.routeId), `unsupported route ${target.routeId}`);
  assert(target.metric && target.timeframe, `${target.articleId}: metric/timeframe context missing`);
}
assert.equal(artifact.targets.filter((target) => target.articleId.startsWith('principles:') || target.articleId.startsWith('atlas-foundations:')).every((target) => target.status === 'ROUTE_TARGET'), true, 'all 160 primary articles must be route targets');
assert.equal(artifact.targets.filter((target) => target.articleId.startsWith('nathan-frameworks:')).length, 28, 'all Nathan framework articles must have route targets');
for (const scenario of artifact.scenarios) assert(byArticle.has(scenario.articleId), `scenario target missing ${scenario.articleId}`);
console.log(JSON.stringify({ status: 'PASS', targets: artifact.targets.length, articleTargets: artifact.counts.articleTargets, compatibilityTargets: artifact.counts.compatibilityTargets }, null, 2));
}],
// ── section renderer (was ci-knowledge-renderer-contract.mjs) ──
['renderer', async () => {

const { default: assert } = await import('node:assert/strict');
// v58.51: the evidence/graph/path/tree renderers had no product caller and were removed; lesson.js (live) and the principles
// relation-direction text stay covered here.
const { renderKnowledgeLesson } = await import('../src/ui/knowledge/lesson.js');

function documentRef() {
  return {
    createElement(tag) { return node(tag); }
  };
}
function node(tag) {
  return { tagName: tag, children: [], attributes: {}, className: '', textContent: '', append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); }, setAttribute(key, value) { this.attributes[key] = value; }, addEventListener() {}, type: '', href: '', target: '', rel: '' };
}
const documentLike = documentRef();
const article = { title: '개념', article: { intuition: '직관', formalModelOrRationale: { text: '근거' }, workedExampleOrRationale: { inputs: ['입력'], assumptions: ['가정'], steps: ['단계'], result: '결과', interpretation: '해석', failureBoundary: '경계' }, realEconomyChannel: '실물', companyChannel: '기업', financialStatementChannel: '재무', valuationChannel: '밸류', marketChannel: '시장', tradingApplication: '적용', invalidation: '무효화', glossary: [{ term: '개념', definition: '정의' }], claimIds: ['c1'], sourceIds: ['S1'] } };
assert.equal(renderKnowledgeLesson(documentLike, article).tagName, 'article');
{
  // The connected-concepts list shows which way a relation points (the map aside used to print the relation word alone).
  const principles = (await import('node:fs')).readFileSync(new URL('../src/ui/pages/principles.js', import.meta.url), 'utf8');
  assert.ok(/edge\.from === node\.id \? '→' : '←'\} \$\{edge\.relation/.test(principles), 'the connected-concepts list must show the relation direction');
}
console.log(JSON.stringify({ status: 'PASS', renderers: 1 }, null, 2));
}],
// ── section coverage (was ci-knowledge-full-corpus-coverage.mjs) ──
['coverage', async () => {

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const matrix = read('public-data/knowledge/coverage-matrix.json');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const expected = { CORE_LESSON: 112, FOUNDATION_LESSON: 48, CONCEPT_GUIDE: 60, STRUCTURAL_FRAMEWORK: 28, TAXONOMY_NODE: 95, DEEP_BRANCH: 50, DOMAIN: 19, PLAYER: 21, PRODUCT: 22 };
const ids = new Set();
assert(matrix.schemaVersion === 'knowledge-coverage-matrix.v1', 'schemaVersion');
assert(Array.isArray(matrix.units), 'units missing');
for (const [kind, count] of Object.entries(expected)) assert(matrix.units.filter((unit) => unit.kind === kind).length === count, `${kind} count mismatch`);
for (const unit of matrix.units || []) {
  assert(!ids.has(unit.unitId), `duplicate unit ${unit.unitId}`);
  ids.add(unit.unitId);
  assert(['INVENTORIED', 'RESEARCHED', 'AUTHORED', 'SEMANTIC_REVIEWED', 'BROWSER_VERIFIED', 'LIVE_VERIFIED'].includes(unit.coverageState), `${unit.unitId}: invalid coverage state`);
  assert(['RESEARCH_REQUIRED', 'RESEARCH_IN_PROGRESS', 'RESEARCHED'].includes(unit.researchStatus), `${unit.unitId}: invalid research status`);
  assert(['MISSING', 'STRUCTURED_REFERENCE_DRAFT', 'AUTHOR_REVIEWED', 'PUBLISHED_REFERENCE'].includes(unit.articleStatus), `${unit.unitId}: invalid article status`);
}
assert(matrix.counts.units === 455, `total unit count ${matrix.counts.units} !== 455`);
const report = {
  status: failures.length ? 'FAIL' : 'PASS',
  inventory: matrix.counts,
  completionBoundary: matrix.units.some((unit) => unit.coverageState === 'AUTHORED' || unit.researchStatus === 'RESEARCH_IN_PROGRESS') ? 'PARTIALLY_AUTHORED_RESEARCH_OPEN' : 'INVENTORIED_ONLY',
  openResearchUnits: (matrix.units || []).filter((unit) => unit.researchStatus !== 'RESEARCHED').length,
  authoredUnits: (matrix.units || []).filter((unit) => unit.coverageState === 'AUTHORED').length,
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
}],
// ── section web-dossier (was ci-knowledge-web-research-dossier.mjs) ──
['web-dossier', async () => {

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const matrix = read('public-data/knowledge/coverage-matrix.json');
const index = read('public-data/knowledge/research-dossiers.json');
const sources = new Set(read('public-data/knowledge/sources.json').sources.map((source) => source.id));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
assert(index.schemaVersion === 'knowledge-research-dossiers.v1', 'index schemaVersion');
assert(index.dossiers.length === matrix.units.length, `dossier count ${index.dossiers.length} !== coverage units ${matrix.units.length}`);
// v58.63 (architecture audit A22/GV01): a matching row count let one unit lose its dossier while another unit had two.
// Every coverage unit must have exactly one dossier, and every dossier must name a coverage unit.
const unitIds = new Set(matrix.units.map((unit) => unit.unitId));
const dossierUnits = index.dossiers.map((dossier) => dossier.contentUnitId);
const seenUnits = new Set();
for (const unitId of dossierUnits) {
  assert(unitIds.has(unitId), `dossier names unknown coverage unit ${unitId}`);
  assert(!seenUnits.has(unitId), `coverage unit ${unitId} has more than one dossier`);
  seenUnits.add(unitId);
}
for (const unitId of unitIds) assert(seenUnits.has(unitId), `coverage unit ${unitId} has no dossier`);
const ids = new Set();
for (const dossier of index.dossiers) {
  assert(!ids.has(dossier.dossierId), `duplicate dossier ${dossier.dossierId}`);
  ids.add(dossier.dossierId);
  for (const field of ['contentUnitId', 'researchQuestions', 'queries', 'candidateSources', 'selectedSources', 'rejectedSources', 'sourceTiers', 'claimCoverage', 'consensus', 'disagreement', 'invalidation', 'currentnessBoundary', 'q1Thesis', 'q2ParadigmShift', 'q3DisconfirmingVariable', 'q4StructuralMechanism', 'q5AdjacentImpact', 'status']) assert(dossier[field] !== undefined, `${dossier.dossierId}: missing ${field}`);
  for (const source of [...dossier.candidateSources, ...dossier.selectedSources]) if (!source.unresolved) assert(sources.has(source.sourceId), `${dossier.dossierId}: unknown source ${source.sourceId}`);
  assert(dossier.status !== 'RESEARCHED' || dossier.selectedSources.length > 0, `${dossier.dossierId}: researched without selected source`);
  assert(dossier.currentnessBoundary.includes('asOf'), `${dossier.dossierId}: missing currentness boundary`);
}
const report = {
  status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY',
  total: index.dossiers.length,
  researched: index.dossiers.filter((d) => d.status === 'RESEARCHED').length,
  inProgress: index.dossiers.filter((d) => d.status === 'RESEARCH_IN_PROGRESS').length,
  researchRequired: index.dossiers.filter((d) => d.status === 'RESEARCH_REQUIRED').length,
  completionReady: false,
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
}],
// ── section sector-depth (was ci-knowledge-sector-domain-depth.mjs) ──
['sector-depth', async () => {

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const index = read('public-data/knowledge/domain-dossiers.json');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
assert(index.dossiers.length === 19, `domain count ${index.dossiers.length} !== 19`);
const nodeIds = new Set();
const branchIds = new Set();
for (const dossier of index.dossiers) {
  assert(dossier.schemaVersion === 'knowledge-domain-dossier.v1', `${dossier.domainId}: schema`);
  assert(dossier.taxonomyNodeIds.length > 0, `${dossier.domainId}: no taxonomy nodes`);
  assert(dossier.uniqueKpis.length > 0, `${dossier.domainId}: no unique KPI/verification fields`);
  assert(dossier.bottlenecks.length > 0, `${dossier.domainId}: no bottleneck`);
  assert(dossier.valueChain.length > 0, `${dossier.domainId}: no value chain`);
  // W04-B/P1149 (C02): a verification question is not a KPI and the mechanism prose is not a
  // validated chain order. Both must stay in their own fields, the generator must not invent
  // metric definitions or economic edges, and the draft semantic-review boundary must survive.
  assert(Array.isArray(dossier.metrics) && Array.isArray(dossier.researchQuestions) && dossier.valueChainGraph && typeof dossier.valueChainGraph === 'object', `${dossier.domainId}: metrics/researchQuestions/valueChainGraph missing`);
  const questionTexts = new Set(dossier.researchQuestions.map((row) => row.question));
  assert(dossier.uniqueKpis.every((entry) => !questionTexts.has(entry)), `${dossier.domainId}: a verification question leaked into uniqueKpis`);
  assert(dossier.valueChain.every((entry) => String(entry) !== String(dossier.mechanism || '')), `${dossier.domainId}: the mechanism prose was used as a chain step`);
  assert(dossier.valueChainGraph.status === 'UNCLASSIFIED_CANDIDATE' && dossier.valueChainGraph.edges.length === 0, `${dossier.domainId}: an un-normalized chain must stay a candidate with no invented edges`);
  assert(dossier.researchQuestions.every((row) => row.question && row.verificationCondition === null), `${dossier.domainId}: research questions must be explicit and unverified`);
  assert(dossier.metrics.every((row) => row.definition === null && row.normalizationStatus === 'UNCLASSIFIED_CANDIDATE'), `${dossier.domainId}: the generator invented a metric definition`);
  assert(dossier.status === 'STRUCTURAL_REFERENCE_DRAFT' && dossier.completion.semanticReview === 'REQUIRED', `${dossier.domainId}: the draft semantic-review boundary was promoted`);
  for (const id of dossier.taxonomyNodeIds) nodeIds.add(id);
  for (const id of dossier.deepBranchIds) branchIds.add(id);
}
assert(nodeIds.size === 95, `taxonomy coverage ${nodeIds.size} !== 95`);
assert(branchIds.size === 50, `deep branch coverage ${branchIds.size} !== 50`);
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', domains: index.dossiers.length, taxonomyNodes: nodeIds.size, deepBranches: branchIds.size, completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
}],
// ── section uniqueness (was ci-knowledge-article-uniqueness.mjs) ──
['uniqueness', async () => {

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const articles = read('public-data/knowledge/articles.json').articles || [];
const expectedArticleCount = (read('public-data/principles/lesson-library.json').lessons || []).length
  + (read('public-data/atlas/foundation-lessons.json').lessons || []).length;
const failures = [];
const signatures = new Map();
for (const article of articles) {
  const seed = article.deepArticle?.uniqueDraftSeed;
  if (!seed) failures.push(`${article.articleId}: missing unique draft seed`);
  const signature = JSON.stringify(seed || {});
  signatures.set(signature, [...(signatures.get(signature) || []), article.articleId]);
  if (article.deepArticle?.status !== 'RECONSTRUCTION_REQUIRED') failures.push(`${article.articleId}: draft boundary changed without review`);
}
const collisions = [...signatures.values()].filter((ids) => ids.length > 1);
// v58.63 (architecture audit A23/GV02): an exact seed collision was counted and printed but the gate still passed. Two
// articles with one seed are the same source material; the gate the name promises fails on it (and on a count gap).
for (const ids of collisions) failures.push(`identical draft seed shared by ${ids.join(', ')}`);
if (articles.length !== expectedArticleCount) failures.push(`articles ${articles.length} !== lessons ${expectedArticleCount}`);
const report = {
  status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY',
  articles: articles.length,
  expectedArticles: expectedArticleCount,
  uniqueDraftSeeds: signatures.size,
  exactCollisions: collisions.length,
  completionReady: false,
  boundary: 'Unique draft seeds preserve source-specific authoring material; they do not certify human-reviewed article uniqueness.',
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
}],
// ── section transmission (was ci-knowledge-market-transmission.mjs) ──
['transmission', async () => {

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { runKnowledgeAuthoringNegativeFixtures, validateKnowledgeAuthoringCorpus, SOURCE_PRESERVED_STATUS, SEMANTIC_REFERENCE_STATUS } = await import('./lib/knowledge-authoring-contract.mjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const articles = read('public-data/knowledge/articles.json').articles || [];
const domains = read('public-data/knowledge/domain-dossiers.json').dossiers || [];
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const authoringContracts = new Map([
  ['principles', validateKnowledgeAuthoringCorpus({ surface: 'principles', artifact: read('public-data/principles/lesson-library.json'), articles: articles.filter((article) => article.surface === 'principles') })],
  ['atlas-foundations', validateKnowledgeAuthoringCorpus({ surface: 'atlas-foundations', artifact: read('public-data/atlas/foundation-lessons.json'), articles: articles.filter((article) => article.surface === 'atlas-foundations') })]
]);
for (const [surface, contract] of authoringContracts) for (const failure of contract.failures) failures.push(`${surface}: ${failure}`);
for (const failure of runKnowledgeAuthoringNegativeFixtures()) failures.push(`authoring contract fixture: ${failure}`);
for (const article of articles) {
  const deep = article.deepArticle;
  const authoringMode = authoringContracts.get(article.surface)?.mode;
  assert(deep && deep.dossierId, `${article.articleId}: missing deepArticle dossier`);
  assert(Array.isArray(deep?.progressiveDisclosure) && deep.progressiveDisclosure.length >= (authoringMode === SEMANTIC_REFERENCE_STATUS ? 3 : 2), `${article.articleId}: progressive disclosure`);
  assert(deep?.uniqueDraftSeed?.definition && deep?.uniqueDraftSeed?.mechanism, `${article.articleId}: unique mechanism seed`);
  assert(deep?.status === authoringMode || (authoringMode === null && deep?.status === SOURCE_PRESERVED_STATUS), `${article.articleId}: authoring depth status drifted`);
}
for (const dossier of domains) {
  const pathNodes = dossier.marketTransmission?.path || [];
  assert(pathNodes.length >= 5, `${dossier.domainId}: incomplete market transmission path`);
  assert(pathNodes.at(-1) === 'invalidation', `${dossier.domainId}: missing invalidation endpoint`);
}
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', articles: articles.length, domains: domains.length, quantitativeLabs: 'EXCLUDED_BY_PRODUCT_SCOPE', completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
}],
// ── section currentness (was ci-knowledge-currentness-separation.mjs) ──
['currentness', async () => {

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const bundles = [
  ['coverage', read('public-data/knowledge/coverage-matrix.json').units || []],
  ['research', read('public-data/knowledge/research-dossiers.json').dossiers || []],
  ['domain', read('public-data/knowledge/domain-dossiers.json').dossiers || []]
];
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
for (const [kind, items] of bundles) for (const item of items) {
  const boundary = String(item.currentnessBoundary || item.boundary || '');
  const statusText = JSON.stringify(item);
  assert(boundary.includes('REFERENCE_ONLY') || boundary.includes('reference') || kind === 'research', `${kind}:${item.unitId || item.contentUnitId || item.domainId || item.labId}: missing reference boundary`);
  assert(!/LIVE_VERIFIED/.test(statusText), `${kind}:${item.unitId || item.contentUnitId || item.domainId || item.labId}: live status in generated reference artifact`);
  assert(!/(current market|현재 시장|실시간|현재값|live value)/i.test(statusText) || boundary.length > 0, `${kind}:${item.unitId || item.contentUnitId || item.domainId || item.labId}: current claim without boundary`);
}
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', bundles: bundles.map(([kind, items]) => ({ kind, count: items.length })), quantitativeLabs: 'EXCLUDED_BY_PRODUCT_SCOPE', completionReady: false, failures }, null, 2));
if (failures.length) process.exit(1);
}],
// ── section current-observations (was ci-knowledge-current-observations-check.mjs) ──
['current-observations', async () => {

const { default: assert } = await import('node:assert/strict');
const { default: fs } = await import('node:fs');
const { validateCurrentObservationsArtifact } = await import('../src/ui/knowledge/current-observations.js');

const path = 'public-data/knowledge/current-observations.json';
const artifact = JSON.parse(fs.readFileSync(path, 'utf8'));
assert.equal(artifact.schema, 'knowledge-current-observations.v1');
assert.equal(artifact.status, 'CONNECTED_WITH_BOUNDARY');
assert.ok(artifact.boundary);
assert.ok(Array.isArray(artifact.observations) && artifact.observations.length >= 8);
assert.equal(validateCurrentObservationsArtifact(artifact), true);
assert.equal(validateCurrentObservationsArtifact(null), false);
assert.equal(validateCurrentObservationsArtifact({ observations: [{ id: 'bad' }] }), false);
const ids = new Set();
for (const row of artifact.observations) {
  assert.equal(ids.has(row.id), false, `duplicate observation id: ${row.id}`);
  ids.add(row.id);
  assert.ok(row.sourceUrl.startsWith('https://'), `${row.id} source URL must be https`);
  assert.ok(['principles', 'atlas'].every((page) => row.pageTargets.includes(page)), `${row.id} must reach both learning pages`);
  assert.ok(['reference-only', 'current-context'].includes(row.allowedUse), `${row.id} has invalid allowedUse`);
}
console.log(JSON.stringify({ status: 'PASS', observations: artifact.observations.length, pages: ['principles', 'atlas'] }, null, 2));
}],
// ── section review (was ci-knowledge-review-check.mjs) ──
['review', async () => {
// P1471–P1480 (knowledge review 2026-10-04, 1차·2차; reading standard 2026-10-05): executable negative controls for the learning
// overhaul — typed relations, corrected definitions, one concept source, unified search, analysis frames
// in a professional register, direct sources, refresh cadence and the masters style comparison.
const { readFileSync } = await import('node:fs');
const { DOMAIN_RELATIONS, RELATION_TYPES, nodeCategory, typedRelations } = await import('../src/domain/knowledge/atlas-relations.js');
const { CONCEPT_CORE, conceptAliasIndex } = await import('../src/domain/knowledge/concept-core.js');
const { COLUMN_FRAME, KEY_ISSUES, LESSONS, PATHS, lessonById } = await import('../src/domain/knowledge/learning-core.js');
const { mergeConceptCore } = await import('../src/ui/knowledge/glossary-bridge.js');
const { searchKnowledgeIndex } = await import('../src/ui/knowledge/knowledge-search.js');
const { KNOWLEDGE_CADENCE, isOverdue } = await import('../src/domain/knowledge/knowledge-cadence.js');
const { STYLE_FRAMES, groupManagersByStyle } = await import('../src/domain/masters/style-frames.js');

const fail = (message) => { throw new Error(`[knowledge-review] ${message}`); };
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// P1471: list order is not a supply chain.
const taxonomy = json('public-data/atlas/taxonomy-node-coverage.json');
const ids = new Set(taxonomy.nodes.map((node) => node.nodeId));
if (DOMAIN_RELATIONS.some((edge) => !ids.has(edge.from) || !ids.has(edge.to) || !RELATION_TYPES[edge.type])) fail('P1471 a typed relation points at an unknown node or type');
const neighbours = typedRelations(taxonomy, (id) => id);
const asic = neighbours.get('compute-asic') || [];
if (!asic.some((item) => item.id === 'compute-gpu' && item.type === 'substitute') || asic.some((item) => item.type === 'next-step' || item.type === 'supplies')) fail('P1471 GPU/ASIC/NPU must be alternatives, not production stages');
for (const [a, b] of [['resources-copper', 'resources-lithium'], ['resources-lithium', 'resources-rare-earths'], ['application-healthcare', 'application-manufacturing'], ['application-automotive', 'application-finance']]) {
  if ((neighbours.get(a) || []).some((item) => item.id === b)) fail(`P1471 parallel members ${a} and ${b} must not be linked`);
}
// P1593 (F67/F88/F90): a part names the whole it goes into; the whole lists its parts; a technology basis is not a part.
const label = (node, other) => (neighbours.get(node) || []).find((item) => item.id === other)?.label;
if (label('memory-nand', 'memory-enterprise-ssd') !== '이것이 들어가는 곳' || label('memory-enterprise-ssd', 'memory-nand') !== '구성 요소'
  || label('package-2-5d', 'package-interposer') !== '구성 요소' || label('compute-gpu', 'compute-precision') !== '성능 속성'
  || (neighbours.get('network-optical-module') || []).some((item) => item.id === 'network-silicon-photonics' && item.type === 'component')) fail('P1593 relation direction/type: part→whole labels or technology-basis typing regressed');
if (nodeCategory('accelerator') !== '기술·부품' || nodeCategory('technical') === '제품·수익모델') fail('P1471 node categories must be one consistent classification');
const atlas = read('src/ui/pages/atlas.js');
if (/domainChains/.test(atlas.slice(atlas.indexOf('function mergeTaxonomyRelationships'), atlas.indexOf('function relationList'))) || /`상류: \$\{/.test(atlas)) fail('P1471 the atlas must not derive 상류/하류 from list order');

// P1472: corrected glossary definitions and one concept source.
const glossary = read('js/aio-glossary.js');
const mustNot = [/롱=매수\(수익 무한\)/, /외국인 매수=긍정적 신호/, /PER 낮음 \+ ROE 15%↑ \+ 배당 3%↑ = 저평가 우수 기업/, /확률보다 비율이 중요/, /시장에 풀린 돈의 양/, /시장이 예상하는 미래 물가상승률\.'/, /지지선 이탈=급락/, /만기까지 보유했을 때의 총 수익률\./, /0~100\)\. 75↑ 환경 우호/, /15% 이상=우수 기업/];
for (const pattern of mustNot) if (pattern.test(glossary)) fail(`P1472 a corrected glossary claim returned: ${pattern}`);
for (const marker of ['회귀분석으로 추정한 계수', '연율 할인율', '단일 종목 ETF는', '가중평균 보통주 수', '맥컬리 듀레이션', 'IV Percentile = 최근 1년 중', '유동성 위험에 대한 보상|위험 프리미엄', '연 4회 나옵니다']) {
  if (!new RegExp(marker).test(glossary)) fail(`P1472 corrected definition missing: ${marker}`);
}
const aliasIndex = conceptAliasIndex();
for (const term of ['hbm', '포토닉스', 'roic', 'nim', '합산비율', 'ffo', '신주', '기간 프리미엄']) if (!aliasIndex.has(term)) fail(`P1472 concept core lacks ${term}`);
const legacy = [{ term: '복리 효과(Compound Interest)', cat: '배경지식', def: 'old' }];
const merged = mergeConceptCore(legacy);
if (merged.replaced !== 1 || legacy[0].def === 'old' || legacy.length !== 1 + CONCEPT_CORE.length - 1) fail('P1472 concept core must replace a legacy entry of the same concept and add the rest');

// P1474: unified search finds the surfaces that explain a term.
const index = json('public-data/knowledge/search-index.json');
for (const [query, expected] of [['HBM', 'frame:memory-optics'], ['포토닉스', 'atlas:network-silicon-photonics'], ['ROIC', 'atlas:economics-roic'], ['합산비율', 'frame:insurance']]) {
  if (!searchKnowledgeIndex(index, query).some((entry) => entry.id === expected)) fail(`P1474 search for ${query} must reach ${expected}`);
}

// P1473: frames are complete and written as research notes.
for (const lesson of LESSONS) {
  if (!lesson.issue || !lesson.answer || !(lesson.mechanism?.length >= 2) || !lesson.reverse || !(lesson.indicators?.length) || !lesson.indicators.every((item) => item.route)) fail(`P1473 frame ${lesson.id} is incomplete`);
  if (/\?$|까\?|볼까|해보세요|퀴즈|시뮬레이션/.test(`${lesson.issue} ${lesson.answer}`)) fail(`P1473 frame ${lesson.id} uses quiz/course register`);
}
if (PATHS.some((path) => path.lessons.some((id) => !lessonById(id))) || KEY_ISSUES.some((id) => !lessonById(id))) fail('P1473 tracks reference a missing frame');
const capex = lessonById('capex-roic');
if (!capex.example.steps.some((step) => /ROIC = 80 ÷ 1,000 = 8%/.test(step))) fail('P1473 capex-roic worked calculation drifted');
if (COLUMN_FRAME.corrections.length !== 6 || COLUMN_FRAME.quotes.length !== 3) fail('P1473 column corrections drifted');
const principles = read('src/ui/pages/principles.js');
const conceptsView = read('src/ui/knowledge/concepts-view.js');
if (!/!sharedRoute\.mode \|\| sharedRoute\.mode === 'frames' \? 'frames'/.test(principles) || !/\{ id: 'frames', title: '분석 노트' \}/.test(conceptsView) || /15·30·45분|잠깐 멈춰 생각해 볼 질문|호기심을 따라가는|체크포인트/.test(principles + conceptsView) || /15분 ·|30분 ·|45분 ·/.test(atlas)) fail('P1473 the library must open on 분석 노트 without course-style labels');

// P1475: lessons carry topic-matched sources; chapter-wide facts no longer land on unrelated lessons.
const library = json('public-data/principles/lesson-library.json');
const n9 = library.lessons.find((lesson) => lesson.id === 'N9');
const n7 = library.lessons.find((lesson) => lesson.id === 'N7');
if (n9.sourceScope !== 'lesson' || n9.sourceIds.includes('PS-16') || !n9.sourceIds.includes('SRC-BIS-BASEL3') || !n7.sourceIds.includes('SRC-FDA-DRUG-DEV')) fail('P1475 finance/bio lessons must cite their own regulators, not NIST/Tesla/Rocket Lab');
const l6 = json('public-data/knowledge/articles/principles/L6.json');
if (l6.article.researchEvidence.some((fact) => fact.factId === 'fact:transformer:attention' || fact.factId === 'fact:doe:pue')) fail('P1475 semiconductor process must not cite the Transformer paper or PUE');
const o2 = library.lessons.find((lesson) => lesson.id === 'O2');
if (!/1\.10 ÷ 1\.10 − 1 = 0%/.test(o2.example) || !/추가 매수가 필요 없다/.test(library.lessons.find((lesson) => lesson.id === 'G7').example)) fail('P1475 O2/G7 corrections missing');
const observations = json('public-data/knowledge/current-observations.json');
if (observations.observations.some((item) => item.nodeIds?.includes('scarcity-choice'))) fail('P1476 scarcity must not be linked to an index level');
const nathan = json('public-data/knowledge/nathan-frameworks.json');
if (nathan.articles.some((article) => article.sources.some((source) => source.title === '직접 확인된 외부 연구자료'))) fail('P1478 Nathan sources must name the post they are');

// P1477: refresh cadence by kind.
if (KNOWLEDGE_CADENCE.principle.maxAgeDays !== null || isOverdue('company-role', new Date(Date.now() - 30 * 86400000).toISOString()) || !isOverdue('production-status', new Date(Date.now() - 120 * 86400000).toISOString())) fail('P1477 cadence rules drifted');

// P1479: masters style comparison covers the catalog.
const catalog = json('public-data/masters/manager-catalog.json');
const groups = groupManagersByStyle(catalog.managers);
if ([...groups.values()].flat().length !== catalog.managers.length || STYLE_FRAMES.some((frame) => !frame.blind)) fail('P1479 every catalog manager must map to a style that states what 13F cannot show');

// Guide consistency (P1476).
const html = read('index.html');
if (/SIGNAL 점수는 시장 환경/.test(html) || /기관급 스윙트레이딩/.test(html) || /source-aware 시세/.test(html) || /3개 독립 지표/.test(html) || /금리 결정 \+ 점도표\(향후 금리 전망\) 발표/.test(html)) fail('P1476 guide still carries retired or overstated copy');

// P1480: reading standard — every lesson, AI-foundation module, industry node, domain overview and dictionary
// page carries reading text within the block/length limits, with no question outside the opening scene.
const { PRINCIPLE_STORIES, storyProblems } = await import('./lib/principles-stories.mjs');
const { FOUNDATION_STORIES, FOUNDATION_HIDDEN_MODULES } = await import('../src/domain/knowledge/foundation-stories.js');
const { INDUSTRY_NODE_STORIES, INDUSTRY_DOMAIN_STORIES } = await import('../src/domain/knowledge/industry-node-stories.js');
const { CONCEPT_STORIES } = await import('../src/domain/knowledge/concept-stories.js');
if (library.lessons.some((lesson) => !lesson.story) || Object.keys(PRINCIPLE_STORIES).length !== library.lessons.length) fail('P1480 every principles lesson needs reading text');
// v57.98: every principles lesson carries a worked-number block (inputs → steps → result → limit) within the
// reading standard, authored once in scripts/lib/principles-worked*.mjs and copied into the library.
const { PRINCIPLE_WORKED, workedProblems } = await import('./lib/principles-worked.mjs');
const workedIssues = library.lessons.flatMap((lesson) => workedProblems(lesson.id, lesson.worked));
if (workedIssues.length || library.lessons.some((lesson) => JSON.stringify(lesson.worked) !== JSON.stringify(PRINCIPLE_WORKED[lesson.id]))) fail(`v57.98 principles lesson worked-number block missing, stale or outside the standard: ${workedIssues.slice(0, 5).join('; ')}`);
const foundationIds = json('public-data/atlas/foundation-lessons.json').lessons.map((lesson) => lesson.id).filter((id) => !FOUNDATION_HIDDEN_MODULES.includes(id));
if (foundationIds.some((id) => !FOUNDATION_STORIES[id])) fail('P1480 every listed AI-foundation module needs reading text');
const domains = json('public-data/atlas/source-packets.json').taxonomyDomains;
if (domains.some((domain) => !INDUSTRY_DOMAIN_STORIES[domain.id] || domain.nodes.some((node) => !INDUSTRY_NODE_STORIES[node.id]))) fail('P1480 every industry domain and node needs reading text');
const readingProblems = [PRINCIPLE_STORIES, FOUNDATION_STORIES, INDUSTRY_NODE_STORIES, INDUSTRY_DOMAIN_STORIES].flatMap((map) => Object.entries(map).flatMap(([id, story]) => storyProblems(id, story)));
if (readingProblems.length) fail(`P1480 reading text outside the standard: ${readingProblems.slice(0, 5).join('; ')}`);
for (const concept of CONCEPT_CORE) {
  const story = CONCEPT_STORIES[concept.id];
  if (!story || ['lead', 'use', 'twist'].some((key) => !(story[key]?.length >= 60 && story[key].length <= 230)) || /[?？]/.test(story.use + story.twist)) fail(`P1480 dictionary page ${concept.id} is outside the reading standard`);
}
const allReading = JSON.stringify([PRINCIPLE_STORIES, FOUNDATION_STORIES, INDUSTRY_NODE_STORIES, INDUSTRY_DOMAIN_STORIES, CONCEPT_STORIES]);
if (/출처|검토 질문|퀴즈|해보세요|생각해 볼까/.test(allReading)) fail('P1480 reading text must not carry source notes, review questions or quiz register');

console.log(JSON.stringify({ ok: true, frames: LESSONS.length, concepts: CONCEPT_CORE.length, relations: DOMAIN_RELATIONS.length, searchEntries: index.entries.length }));
}],
]);
