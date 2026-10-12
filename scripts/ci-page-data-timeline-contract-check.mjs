import assert from 'node:assert/strict';
import { PAGE_DATA_TIMELINE_CONTRACTS, auditPageDataTimelines, evaluatePageDataTimeline, expectedCycleEnd } from '../src/data/contracts/page-timeline.js';
import { ROUTE_IDS } from '../src/app/routes.js';

// A04: the expected set is derived from the active route registry, not a fixed count. Reference routes
// (research and guide) carry no market timeline; every other active route must declare one.
const REFERENCE_ROUTES = new Set(['principles', 'masters', 'atlas', 'guide']);
const expectedRoutes = ROUTE_IDS.filter((route) => !REFERENCE_ROUTES.has(route)).sort();

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

assert.deepEqual(Object.keys(PAGE_DATA_TIMELINE_CONTRACTS).sort(), expectedRoutes, 'every active market-sensitive route (and no retired route) declares a field timeline');
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
assert.equal(current.pageCount, expectedRoutes.length);
assert.equal(current.fieldCheckCount, Object.values(PAGE_DATA_TIMELINE_CONTRACTS).flat().length);

const staleCatalog = { ...catalog, 'sentiment.fearGreed': { ...catalog['sentiment.fearGreed'], observedAt: '2026-07-01T00:00:00.000Z' } };
assert.equal(evaluatePageDataTimeline('home', staleCatalog, { now, marketRevision: revision }).status, 'PARTIAL', 'stale required evidence must not masquerade as current');

const noDirectionCatalog = { ...catalog, 'market.^GSPC': { ...catalog['market.^GSPC'], directionValue: null } };
assert.equal(evaluatePageDataTimeline('signal', noDirectionCatalog, { now, marketRevision: revision }).status, 'BLOCKED', 'missing direction must fail closed');

const mixedRevisionCatalog = { ...catalog, 'market.^VIX3M': { ...catalog['market.^VIX3M'], revision: 'market-revision:other' } };
assert.equal(evaluatePageDataTimeline('sentiment', mixedRevisionCatalog, { now, marketRevision: revision }).status, 'BLOCKED', 'mixed market revisions must fail closed');

assert.equal(evaluatePageDataTimeline('fxbond', catalog, { now, marketRevision: revision }).status, 'CURRENT', 'numeric zero is valid evidence');

console.log(JSON.stringify({ ok: true, pageCount: current.pageCount, fieldCheckCount: current.fieldCheckCount, schemaVersion: current.schemaVersion }));

// A02: a news cycle older than the latest 08:00 KST boundary (plus 3h grace) is stale even inside 30 hours.
{
  const at = Date.parse('2026-10-12T03:00:00Z'); // 12:00 KST: today's 08:00 KST cycle (10-11T23:00Z) is due
  assert.equal(new Date(expectedCycleEnd(at)).toISOString(), '2026-10-11T23:00:00.000Z');
  const newsCatalog = { ...catalog, 'news.completedCycle': { ...catalog['news.completedCycle'], observedAt: '2026-10-10T23:00:00Z' } };
  const check = evaluatePageDataTimeline('market-news', newsCatalog, { now: at, marketRevision: revision }).checks.find((row) => row.id === 'news.completedCycle');
  assert.equal(check.status, 'STALE', 'A02: yesterday\'s cycle is not current after today\'s boundary');
  const early = Date.parse('2026-10-11T23:30:00Z'); // 08:30 KST: inside the grace period yesterday's cycle still counts
  const earlyCheck = evaluatePageDataTimeline('market-news', newsCatalog, { now: early, marketRevision: revision }).checks.find((row) => row.id === 'news.completedCycle');
  assert.equal(earlyCheck.status, 'PASS');
}
console.log('page timeline: news cycle admission PASS');
