import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
const writeJson = async (relativePath, value) => fs.writeFile(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const taxonomyPath = 'public-data/atlas/taxonomy-node-coverage.json';
const claimsPath = 'public-data/atlas/domain-claim-ledger.json';
const [taxonomy, domainPackets, registry, claims] = await Promise.all([
  readJson(taxonomyPath),
  readJson('public-data/atlas/domain-source-packets.json'),
  readJson('public-data/atlas/player-product-registry.json'),
  readJson(claimsPath)
]);

const upstream = new Map((taxonomy.nodes || []).map((node) => [node.nodeId, new Set()]));
const downstream = new Map((taxonomy.nodes || []).map((node) => [node.nodeId, new Set()]));
const addEdge = (from, to) => {
  if (!upstream.has(from) || !upstream.has(to) || from === to) return;
  downstream.get(from).add(to);
  upstream.get(to).add(from);
};
for (const chain of taxonomy.relationshipModel?.domainChains || []) {
  for (let index = 0; index < (chain.nodeIds || []).length - 1; index += 1) addEdge(chain.nodeIds[index], chain.nodeIds[index + 1]);
}
for (const edge of taxonomy.relationshipModel?.crossDomainEdges || []) addEdge(edge.from, edge.to);

const sourceIdsByDomain = new Map((domainPackets.packets || []).map((packet) => [packet.domainId, (packet.sources || []).map((source) => source.id)]));
const playerIdsByNode = new Map();
const productIdsByNode = new Map();
for (const player of registry.players || []) for (const nodeId of player.taxonomyNodeIds || []) {
  if (!playerIdsByNode.has(nodeId)) playerIdsByNode.set(nodeId, []);
  playerIdsByNode.get(nodeId).push(player.playerId);
}
for (const product of registry.products || []) for (const nodeId of product.taxonomyNodeIds || []) {
  if (!productIdsByNode.has(nodeId)) productIdsByNode.set(nodeId, []);
  productIdsByNode.get(nodeId).push(product.productId);
}

taxonomy.nodes = (taxonomy.nodes || []).map((node) => {
  const playerIds = [...new Set(playerIdsByNode.get(node.nodeId) || [])].sort();
  const productIds = [...new Set(productIdsByNode.get(node.nodeId) || [])].sort();
  const upstreamIds = [...upstream.get(node.nodeId)].sort();
  const downstreamIds = [...downstream.get(node.nodeId)].sort();
  const flowPosition = upstreamIds.length === 0 && downstreamIds.length > 0
    ? 'ROOT'
    : upstreamIds.length > 0 && downstreamIds.length === 0
      ? 'LEAF'
      : upstreamIds.length > 0 && downstreamIds.length > 0
        ? 'BRIDGE'
        : 'ISOLATED';
  const flowBoundary = flowPosition === 'ROOT'
    ? '이 구조도에서 앞선 노드를 생략한 출발점이며, 실제 산업 전체의 절대적 시작이라는 뜻은 아닙니다.'
    : flowPosition === 'LEAF'
      ? '이 구조도에서 다음 노드를 생략한 도착점이며, 가치사슬과 경제 효과가 여기서 끝난다는 뜻은 아닙니다.'
      : flowPosition === 'BRIDGE'
        ? '앞선 투입을 받아 다음 단계로 전달하는 연결 지점입니다.'
        : '검증된 연결이 없어 공개 구조 설명에 사용하지 않습니다.';
  return {
    ...node,
    upstream: upstreamIds,
    downstream: downstreamIds,
    flowPosition,
    flowBoundary,
    representativePlayerIds: playerIds,
    representativeProductIds: productIds,
    representativeMappingStatus: playerIds.length || productIds.length ? 'REFERENCE_MAPPED' : 'NOT_YET_VERIFIED',
    representativeMappingBoundary: playerIds.length || productIds.length
      ? 'Reference identity mapping only; no current production, revenue, market-share or valuation claim.'
      : 'No verified representative company/product mapping is published for this structural node.',
    sourceIds: [...new Set(sourceIdsByDomain.get(node.domainId) || [])]
  };
});
taxonomy.revision = `${new Date().toISOString().slice(0, 10)}-source-and-relationship-reconciled`;

claims.claims = (claims.claims || []).map((claim) => ({
  ...claim,
  currentnessPolicy: claim.claimType === 'STRUCTURAL_REFERENCE' && claim.asOf == null
    ? 'NOT_APPLICABLE_STRUCTURAL_REFERENCE'
    : claim.asOf ? 'DATED_OBSERVATION' : 'CURRENTNESS_REQUIRED_BEFORE_PUBLICATION'
}));

await Promise.all([writeJson(taxonomyPath, taxonomy), writeJson(claimsPath, claims)]);
console.log(JSON.stringify({
  ok: true,
  nodes: taxonomy.nodes.length,
  connectedNodes: taxonomy.nodes.filter((node) => node.upstream.length || node.downstream.length).length,
  resolvedSourceIds: new Set(taxonomy.nodes.flatMap((node) => node.sourceIds)).size,
  representativeMapped: taxonomy.nodes.filter((node) => node.representativeMappingStatus === 'REFERENCE_MAPPED').length,
  structuralClaims: claims.claims.filter((claim) => claim.currentnessPolicy === 'NOT_APPLICABLE_STRUCTURAL_REFERENCE').length
}));
