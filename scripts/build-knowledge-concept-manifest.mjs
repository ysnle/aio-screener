#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_PRINCIPLES_CATALOG } from '../src/ui/pages/principles.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const writeJson = (relativePath, value) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const generatedAt = process.env.KNOWLEDGE_MANIFEST_DATE || '2026-08-11';
const taxonomy = readJson('public-data/atlas/taxonomy-node-coverage.json');
const principles = MARKET_PRINCIPLES_CATALOG.nodes;
const atlas = taxonomy.nodes;
const overlap = new Set(principles.map((node) => node.id).filter((id) => atlas.some((node) => node.nodeId === id)));

function concept(surface, node, source) {
  const legacyId = surface === 'principles' ? node.id : node.nodeId;
  const canonicalId = `${surface}:${legacyId}`;
  const equivalenceGroup = overlap.has(legacyId) ? `equivalence:${legacyId}` : null;
  return {
    canonicalId,
    legacyId,
    surface,
    equivalenceGroup,
    title: node.title,
    kind: surface === 'principles' ? node.type : node.kind,
    layer: node.layer || null,
    domainId: node.domainId || null,
    status: 'CANONICAL_REFERENCE',
    source: {
      artifact: source.artifact,
      locator: source.locator,
      field: surface === 'principles' ? 'nodes[].id' : 'nodes[].nodeId'
    },
    sourceIds: [...new Set(node.sourceIds || [])]
  };
}

const concepts = [
  ...principles.map((node) => concept('principles', node, { artifact: 'src/ui/pages/principles.js', locator: 'MARKET_PRINCIPLES_CATALOG.nodes' })),
  ...atlas.map((node) => concept('atlas', node, { artifact: 'public-data/atlas/taxonomy-node-coverage.json', locator: 'nodes' }))
];
const conceptsByLegacyId = new Map();
for (const item of concepts) {
  const bucket = conceptsByLegacyId.get(item.legacyId) || [];
  bucket.push(item.canonicalId);
  conceptsByLegacyId.set(item.legacyId, bucket);
}

const aliases = [];
for (const item of concepts) {
  aliases.push({ alias: item.canonicalId, targets: [item.canonicalId], kind: 'CANONICAL_ID', resolution: 'unique' });
  aliases.push({ alias: `${item.surface}/${item.legacyId}`, targets: [item.canonicalId], kind: 'NAMESPACE_ID', resolution: 'unique' });
}
for (const [legacyId, targets] of [...conceptsByLegacyId.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  aliases.push({
    alias: legacyId,
    targets,
    kind: 'LEGACY_ID',
    resolution: targets.length === 1 ? 'unique' : 'explicit-equivalence'
  });
}

writeJson('public-data/knowledge/concepts.json', {
  schemaVersion: 'knowledge-concepts.v1',
  generatedAt,
  status: 'CANONICAL_REFERENCE_MANIFEST',
  compatibility: 'legacy page IDs remain valid only through aliases.json',
  counts: { concepts: concepts.length, principles: principles.length, atlas: atlas.length, equivalenceGroups: overlap.size },
  concepts
});
writeJson('public-data/knowledge/aliases.json', {
  schemaVersion: 'knowledge-aliases.v1',
  generatedAt,
  status: 'CANONICAL_REFERENCE_MANIFEST',
  aliases
});
console.log(JSON.stringify({ status: 'PASS', concepts: concepts.length, principles: principles.length, atlas: atlas.length, equivalenceGroups: overlap.size }, null, 2));
