import assert from 'node:assert/strict';
import { PAGE_DATA_TIMELINE_CONTRACTS, auditPageDataTimelines, evaluatePageDataTimeline } from '../src/data/contracts/page-timeline.js';

const now = Date.parse('2026-08-13T06:00:00.000Z');
const revision = 'market-revision:test';
const observedAt = new Date(now - 60 * 60 * 1000).toISOString();
const catalog = {};

for (const requirements of Object.values(PAGE_DATA_TIMELINE_CONTRACTS)) {
  for (const contract of requirements) {
    const direction = contract.direction ? {
      directionValue: 0,
      changeBasis: 'previous-regular-session-close',
      directionCompatible: true
    } : {};
    catalog[contract.id] = {
      value: 0,
      observedAt,
      source: 'contract-fixture',
      sourceKind: 'test',
      revision: contract.marketRevision ? revision : null,
      ...direction
    };
  }
}

assert.equal(Object.keys(PAGE_DATA_TIMELINE_CONTRACTS).length, 16, 'all market-sensitive desktop pages must declare field timelines');
assert.deepEqual(PAGE_DATA_TIMELINE_CONTRACTS.screener.map((item) => item.id), [
  'screener.snapshot',
  'screener.factorCoverage',
  'screener.rankingEpoch',
  'screener.visibleQuotes',
  'screener.fundamentalCoverage',
  'screener.newsCoverage'
], 'quant screener must audit artifact, factor fields, ranking epoch, visible quotes, fundamentals and news separately');
for (const [route, requirements] of Object.entries(PAGE_DATA_TIMELINE_CONTRACTS)) {
  assert.ok(requirements.length > 0, `${route}: empty timeline contract`);
  for (const contract of requirements) {
    assert.ok(contract.id && Number.isFinite(contract.maxAgeMs) && contract.maxAgeMs > 0, `${route}: invalid requirement`);
  }
}

const current = auditPageDataTimelines(catalog, { now, marketRevision: revision });
assert.equal(current.status, 'CURRENT');
assert.equal(current.pageCount, 16);
assert.equal(current.fieldCheckCount, Object.values(PAGE_DATA_TIMELINE_CONTRACTS).flat().length);

const staleCatalog = { ...catalog, 'sentiment.fearGreed': { ...catalog['sentiment.fearGreed'], observedAt: '2026-07-01T00:00:00.000Z' } };
assert.equal(evaluatePageDataTimeline('home', staleCatalog, { now, marketRevision: revision }).status, 'PARTIAL', 'stale required evidence must not masquerade as current');

const noDirectionCatalog = { ...catalog, 'market.^GSPC': { ...catalog['market.^GSPC'], directionValue: null } };
assert.equal(evaluatePageDataTimeline('signal', noDirectionCatalog, { now, marketRevision: revision }).status, 'BLOCKED', 'missing direction must fail closed');

const mixedRevisionCatalog = { ...catalog, 'market.^VIX3M': { ...catalog['market.^VIX3M'], revision: 'market-revision:other' } };
assert.equal(evaluatePageDataTimeline('sentiment', mixedRevisionCatalog, { now, marketRevision: revision }).status, 'BLOCKED', 'mixed market revisions must fail closed');

assert.equal(evaluatePageDataTimeline('fxbond', catalog, { now, marketRevision: revision }).status, 'CURRENT', 'numeric zero is valid evidence');

console.log(JSON.stringify({ ok: true, pageCount: current.pageCount, fieldCheckCount: current.fieldCheckCount, schemaVersion: current.schemaVersion }));
