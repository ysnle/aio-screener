#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createKnowledgeRepository } from '../src/data/knowledge/repository.js';
import { selectKnowledgeSummary } from '../src/domain/knowledge/selectors.js';

const fixtures = {
  '/public-data/knowledge/concepts.json': { concepts: [{ canonicalId: 'principles:A1' }] },
  '/public-data/knowledge/aliases.json': { aliases: [] },
  '/public-data/knowledge/sources.json': { sources: [] },
  '/public-data/knowledge/claims.json': { claims: [] },
  '/public-data/knowledge/articles.json': { articles: [{ articleId: 'principles:A1', authoringStatus: 'STRUCTURED_REFERENCE_DRAFT' }] },
  '/public-data/knowledge/learning-graph.json': { nodes: [{ id: 'principles:A1', articleId: 'principles:A1' }] },
  '/public-data/knowledge/route-targets.json': { targets: [{ articleId: 'principles:A1', routeId: null }] },
  '/public-data/knowledge/coverage-matrix.json': { units: [{ unitId: 'principles:A1' }] },
  '/public-data/knowledge/research-dossiers.json': { dossiers: [{ contentUnitId: 'principles:A1' }] },
  '/public-data/knowledge/domain-dossiers.json': { dossiers: [] },
  '/public-data/knowledge/quantitative-labs.json': { labs: [] }
};
const repository = await createKnowledgeRepository(async (url) => ({
  ok: url !== './public-data/knowledge/claims.json',
  status: url.endsWith('claims.json') ? 503 : 200,
  async json() { return fixtures[url.replace(/^\./, '')] || {}; }
}));
assert.equal(repository.status('concepts'), 'connected');
assert.equal(repository.status('claims'), 'fallback');
assert.equal(repository.get('claims'), null);
const summary = selectKnowledgeSummary(repository.values, 'principles:A1');
assert.equal(summary.status, 'STRUCTURED_REFERENCE_DRAFT');
assert.equal(summary.learningNode.id, 'principles:A1');
assert.equal(summary.routeTarget.articleId, 'principles:A1');
assert.equal(repository.status('coverageMatrix'), 'connected');
assert.equal(repository.status('researchDossiers'), 'connected');
assert.equal(repository.status('domainDossiers'), 'connected');
assert.equal(repository.status('quantitativeLabs'), 'connected');
console.log(JSON.stringify({ status: 'PASS', connected: Object.values(repository.capabilities).filter((item) => item.status === 'connected').length, fallback: Object.values(repository.capabilities).filter((item) => item.status === 'fallback').length }, null, 2));
