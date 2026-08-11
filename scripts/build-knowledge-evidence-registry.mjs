#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const writeJson = (relativePath, value) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const reviewedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-11';
const principles = readJson('public-data/principles/lesson-library.json');
const research = readJson('public-data/atlas/source-packets.json');
const registry = readJson('public-data/atlas/player-product-registry.json');
const foundations = readJson('public-data/atlas/foundation-lessons.json');
const domainPackets = readJson('public-data/atlas/domain-source-packets.json');
const domainClaims = readJson('public-data/atlas/domain-claim-ledger.json');

const sourcesById = new Map();
const conflicts = [];
function addSource(source, namespace, defaultRole) {
  const id = String(source?.id || '').trim();
  if (!id) return;
  const normalized = {
    id,
    namespace,
    publisher: source.publisher || source.sourceName || id,
    title: source.title || source.publisher || id,
    url: source.url || source.sourceUrl || null,
    publishedAt: source.publishedAt || null,
    scope: source.scope || null,
    sourceRole: source.sourceRole || source.role || defaultRole,
    allowedUse: 'REFERENCE_ONLY',
    reviewedAt: source.reviewedAt || reviewedAt
  };
  const existing = sourcesById.get(id);
  if (existing && existing.url && normalized.url && existing.url !== normalized.url) {
    conflicts.push({ id, existing, incoming: normalized });
    return;
  }
  if (!existing || (!existing.url && normalized.url)) sourcesById.set(id, normalized);
}

for (const source of principles.sources || []) addSource(source, 'MP', 'CONTEXT');
for (const source of research.sources || []) addSource(source, 'PS', 'PRIMARY_REFERENCE');
for (const source of registry.sources || []) addSource(source, 'PP', 'ENTITY_REFERENCE');
for (const source of foundations.sourceCatalog || []) addSource(source, 'FND', 'FOUNDATION_REFERENCE');
for (const packet of domainPackets.packets || []) for (const source of packet.sources || []) addSource(source, 'AT', 'PRIMARY_REFERENCE');

const sourceIds = new Set(sourcesById.keys());
const claims = [];
function addClaim(claim) {
  const id = String(claim?.claimId || claim?.id || '').trim();
  if (!id) return;
  const sourceIdsForClaim = [...new Set(claim.sourceIds || claim.evidence || [])];
  claims.push({
    claimId: id,
    surface: claim.surface || 'atlas',
    entityId: claim.entityId || claim.nodeId || claim.domainId || null,
    claimType: claim.claimType || 'EDUCATIONAL_REFERENCE',
    statement: claim.statement || claim.summary || '',
    status: claim.status || 'REVIEW_REQUIRED',
    directness: claim.directness || 'REVIEW_REQUIRED',
    sourceIds: sourceIdsForClaim,
    asOf: claim.asOf || null,
    reviewedAt: claim.reviewedAt || reviewedAt,
    publication: 'EDUCATIONAL_REFERENCE_ONLY',
    invalidation: claim.invalidation || '직접 출처·기준일·반대 근거를 다시 확인하기 전 현재 사실로 승격하지 않는다.'
  });
}

for (const lesson of principles.lessons || []) addClaim({
  claimId: `principles-lesson-${lesson.id}`,
  surface: 'principles',
  entityId: lesson.id,
  claimType: 'EDUCATIONAL_REFERENCE',
  statement: `${lesson.definition} ${lesson.mechanism}`,
  status: 'REFERENCE',
  directness: 'CONTEXT',
  sourceIds: lesson.sourceIds
});
for (const lesson of foundations.lessons || []) addClaim({
  claimId: `atlas-foundation-${lesson.id}`,
  surface: 'atlas',
  entityId: lesson.id,
  claimType: 'EDUCATIONAL_REFERENCE',
  statement: `${lesson.definition} ${lesson.mechanism}`,
  status: 'REFERENCE',
  directness: lesson.sourceIds?.length ? 'CONTEXT' : 'UNSUPPORTED',
  sourceIds: lesson.sourceIds
});
for (const claim of research.claims || []) addClaim({ ...claim, surface: 'atlas', directness: 'DISCOVERY' });
for (const claim of domainClaims.claims || []) addClaim({ ...claim, surface: 'atlas', directness: 'REVIEW_REQUIRED' });
for (const player of registry.players || []) addClaim({
  claimId: `player-role-${player.playerId}`,
  surface: 'atlas',
  entityId: player.playerId,
  claimType: 'ENTITY_RELATION',
  statement: `${player.name} is represented as ${player.roleIds?.join(', ') || 'an industry participant'}.`,
  status: 'STRUCTURAL_REFERENCE_ONLY',
  directness: 'STRUCTURAL',
  sourceIds: player.sourceIds
});
for (const product of registry.products || []) addClaim({
  claimId: `product-taxonomy-${product.productId}`,
  surface: 'atlas',
  entityId: product.productId,
  claimType: 'ENTITY_TAXONOMY_RELATION',
  statement: `${product.productId} is structurally mapped to ${product.taxonomyNodeIds?.join(', ') || 'no taxonomy node'}.`,
  status: 'STRUCTURAL_REFERENCE_ONLY',
  directness: 'STRUCTURAL',
  sourceIds: product.sourceIds
});

const unresolved = claims.flatMap((claim) => claim.sourceIds.filter((sourceId) => !sourceIds.has(sourceId)).map((sourceId) => ({ claimId: claim.claimId, sourceId })));
writeJson('public-data/knowledge/sources.json', {
  schemaVersion: 'knowledge-sources.v1',
  generatedAt: reviewedAt,
  status: 'CANONICAL_REFERENCE_REGISTRY',
  sourceRolePolicy: {
    DIRECT: 'claim-specific primary support with scope and date; not inferred from publisher prestige',
    CONTEXT: 'background or educational context; cannot support a current/product claim alone',
    DISCOVERY: 'lead generation only; requires independent claim support',
    STRUCTURAL: 'taxonomy/entity relationship reference; not a current operating claim'
  },
  counts: { sources: sourcesById.size, conflicts: conflicts.length },
  sources: [...sourcesById.values()].sort((left, right) => left.id.localeCompare(right.id))
});
writeJson('public-data/knowledge/claims.json', {
  schemaVersion: 'knowledge-claims.v1',
  generatedAt: reviewedAt,
  status: 'CANONICAL_REFERENCE_CLAIM_LEDGER',
  directnessPolicy: 'DIRECT is reserved for claim-specific primary support; CONTEXT/DISCOVERY/STRUCTURAL/REVIEW_REQUIRED cannot be promoted to DIRECT.',
  counts: { claims: claims.length, unresolvedSourceReferences: unresolved.length },
  claims
});
console.log(JSON.stringify({ status: conflicts.length || unresolved.length ? 'FAIL' : 'PASS', sources: sourcesById.size, claims: claims.length, conflicts: conflicts.length, unresolved: unresolved.length }, null, 2));
if (conflicts.length || unresolved.length) process.exit(1);
