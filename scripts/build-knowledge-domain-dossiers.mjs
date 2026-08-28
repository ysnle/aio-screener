#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => {
  const target = path.join(root, file);
  atomicWriteJsonSync(target, value);
};
const generatedAt = process.env.KNOWLEDGE_RESEARCH_DATE || '2026-08-12';
const guides = read('public-data/atlas/domain-guides.json').guides || [];
const packets = read('public-data/atlas/domain-source-packets.json').packets || [];
const nodes = read('public-data/atlas/taxonomy-node-coverage.json').nodes || [];
const topics = read('public-data/atlas/deep-taxonomy.json').topics || [];
const registry = read('public-data/atlas/player-product-registry.json');
const packetByDomain = new Map(packets.map((packet) => [packet.domainId, packet]));
const branchesByNode = new Map();
for (const topic of topics) for (const branch of topic.branches || []) for (const nodeId of topic.anchorNodeIds || []) branchesByNode.set(nodeId, [...(branchesByNode.get(nodeId) || []), branch]);
const safeFile = (id) => id.replace(/[^a-zA-Z0-9._-]+/g, '_');
const dossiers = guides.map((guide) => {
  const domainId = guide.id;
  const domainNodes = nodes.filter((node) => node.domainId === domainId);
  const nodeIds = new Set(domainNodes.map((node) => node.nodeId));
  const branchIds = [...new Set(domainNodes.flatMap((node) => (branchesByNode.get(node.nodeId) || []).map((branch) => branch.id)))];
  const playerIds = (registry.players || []).filter((player) => (player.taxonomyNodeIds || []).some((nodeId) => nodeIds.has(nodeId))).map((player) => player.playerId);
  const productIds = (registry.products || []).filter((product) => (product.taxonomyNodeIds || []).some((nodeId) => nodeIds.has(nodeId))).map((product) => product.productId);
  const packet = packetByDomain.get(domainId);
  const sourceIds = [...new Set([...(guide.sourceIds || []), ...(packet?.sources || []).map((source) => source.id)])];
  const dossier = {
    schemaVersion: 'knowledge-domain-dossier.v1',
    generatedAt,
    dossierId: `domain-dossier:${domainId}`,
    domainId,
    title: guide.title || domainId,
    definition: guide.definition || null,
    mechanism: guide.mechanism || null,
    unit: guide.unit || null,
    bottlenecks: [guide.bottleneck || 'Domain-specific bottleneck requires source review.'],
    uniqueKpis: [...new Set([guide.unit, ...(guide.kpis || []), ...domainNodes.map((node) => node.verificationQuestion).filter(Boolean)])].filter(Boolean),
    valueChain: [guide.mechanism, ...domainNodes.map((node) => node.title).filter(Boolean)].filter(Boolean),
    taxonomyNodeIds: domainNodes.map((node) => node.nodeId),
    deepBranchIds: branchIds,
    playerIds,
    productIds,
    sourceIds,
    researchQuestions: packet?.evidenceQuestions || [guide.verificationQuestion].filter(Boolean),
    marketTransmission: { status: 'RESEARCH_REQUIRED', path: ['physical/economic input', 'industry bottleneck', 'company/product evidence', 'financial statement', 'valuation/market observation', 'invalidation'] },
    currentnessBoundary: 'REFERENCE_ONLY: no current revenue, shipment, yield, production, market-share or investment claim is implied by this structural dossier.',
    status: 'STRUCTURAL_REFERENCE_DRAFT',
    completion: { coverage: 'INVENTORIED', research: 'REQUIRED', semanticReview: 'REQUIRED', browser: 'NOT_RUN', live: 'NOT_RUN' }
  };
  write(`public-data/knowledge/domain-dossiers/${safeFile(domainId)}.json`, dossier);
  return dossier;
});
write('public-data/knowledge/domain-dossiers.json', {
  schemaVersion: 'knowledge-domain-dossiers.v1',
  generatedAt,
  status: 'STRUCTURAL_REFERENCE_DRAFT',
  boundary: 'Domain dossiers preserve complete structural coverage and unique KPI/bottleneck/value-chain fields; independent research and semantic review remain required.',
  counts: { domains: dossiers.length, taxonomyNodes: dossiers.reduce((sum, dossier) => sum + dossier.taxonomyNodeIds.length, 0), deepBranches: dossiers.reduce((sum, dossier) => sum + dossier.deepBranchIds.length, 0) },
  dossiers
});
console.log(JSON.stringify({ status: 'PASS_WITH_BOUNDARY', domains: dossiers.length, taxonomyNodes: dossiers.reduce((sum, dossier) => sum + dossier.taxonomyNodeIds.length, 0), deepBranches: dossiers.reduce((sum, dossier) => sum + dossier.deepBranchIds.length, 0) }, null, 2));
