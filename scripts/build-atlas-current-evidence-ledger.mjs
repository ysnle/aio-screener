#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewedAt = process.env.ATLAS_EVIDENCE_DATE || '2026-08-18';
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const writeJson = (file, value) => atomicWriteJsonSync(path.join(root, file), value);

const facts = readJson('public-data/knowledge/research-facts.json').facts || [];
const sourceRegistry = new Map((readJson('public-data/knowledge/sources.json').sources || []).map((source) => [source.id, source]));
const entries = facts
  .map((fact) => {
    const source = sourceRegistry.get(fact.sourceId);
    if (!source?.url || !fact.statement || !fact.asOf) return null;
    const statement = String(fact.statement);
    const lower = statement.toLowerCase();
    const claimType = /\d|percent|margin|revenue|target|contract|generation|product|capacity|shipment|yield|volume|price|cost/.test(lower)
      ? 'DATED_PRIMARY_REFERENCE_WITH_NUMERIC_OR_PRODUCT_CONTEXT'
      : 'DATED_PRIMARY_STRUCTURAL_REFERENCE';
    const caution = /target|forecast|roadmap|option|announced|presents|stated/.test(lower)
      ? 'Company or research statement; do not treat as realized current operating fact without an independent as-of confirmation.'
      : 'Direct source supports the stated definition or mechanism only; do not extend beyond its scope.';
    return {
      evidenceId: `atlas-current-evidence:${fact.factId}`,
      factId: fact.factId,
      sourceId: fact.sourceId,
      publisher: source.publisher,
      title: source.title,
      url: source.url,
      asOf: fact.asOf,
      statement,
      scope: fact.scope,
      invalidation: fact.invalidation,
      claimType,
      directness: 'DIRECT_FOR_STATED_SCOPE',
      verificationStatus: 'PRIMARY_SOURCE_REGISTERED_REVIEWED',
      caution,
      publication: 'EDUCATIONAL_REFERENCE_ONLY'
    };
  })
  .filter(Boolean)
  .sort((a, b) => `${b.asOf}|${a.evidenceId}`.localeCompare(`${a.asOf}|${b.evidenceId}`));

writeJson('public-data/atlas/current-evidence-ledger.json', {
  schemaVersion: 'ai-era-current-evidence-ledger.v1',
  reviewedAt,
  status: 'DATED_PRIMARY_REFERENCE_LEDGER_CONNECTED',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  coverage: {
    entries: entries.length,
    sources: new Set(entries.map((entry) => entry.sourceId)).size,
    datedEntries: entries.filter((entry) => entry.asOf).length,
    numericOrProductContextEntries: entries.filter((entry) => entry.claimType.includes('NUMERIC_OR_PRODUCT')).length,
    currentOperationalClaimsPublished: 0,
    productionVolumeClaimsPublished: 0,
    financialClaimsPublished: 0
  },
  boundary: 'This ledger records dated primary-source statements and their scope. It does not promote vendor targets, product status, shipment, yield, revenue, market share or production volume into current operational claims; those require a separate as-of confirmation and independent review.',
  entries
});

console.log(JSON.stringify({ status: 'PASS', reviewedAt, entries: entries.length, sources: new Set(entries.map((entry) => entry.sourceId)).size }, null, 2));
