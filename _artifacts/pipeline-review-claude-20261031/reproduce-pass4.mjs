// Audit only: pure consumer import, read-only published artifact scan.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { signedYields } from '../../scripts/lib/candidate-archive.mjs';
import { buildReconciliationStatus } from '../../scripts/build-reconciliation-status.mjs';
const now = Date.parse('2026-10-25T00:00:00Z');
const dates = ['2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'];
const run = values => signedYields('X', { price: 10, shares: 1e6 }, {
  quarters: { X: dates.map((date, i) => `${date}:1:${values[i]}:r`).join(';') }, data: {}
}, now);
const partialMissing = run([-1, -1, -1, '']);
const allMissing = run(['', '', '', '']);
assert.equal(partialMissing.earningsYieldTtm, -0.3);
assert.equal(allMissing.earningsYieldTtm, 0);
const fiscal = JSON.parse(fs.readFileSync('public-data/sec-fiscal-history.json', 'utf8'));
const candidates = Object.entries(fiscal.quarters || {}).flatMap(([sym, compact]) => {
  const rows = compact.split(';').filter(Boolean).slice(-4).map(row => row.split(':'));
  if (rows.length !== 4 || !rows.some(row => row[2] === '')) return [];
  return [{ sym, rows, outputWithFixtureValuation: signedYields(sym, { price: 10, shares: 1e6 }, fiscal, now) }];
});
const employment = buildReconciliationStatus({ now: new Date(now).toISOString(), data: { macro: { _bls: {
  status: 'stale', series: Object.fromEntries(['unemployment', 'nonfarmPayroll', 'averageHourlyEarnings']
    .map(key => [key, { value: 1, observedAt: '2000-01-01' }]))
} } } }).categories.find(row => row.categoryId === 'employment-wages');
assert.equal(employment.status, 'MATCH');
assert.equal(employment.evidence.promotable, false);
const result = { evidence: 'actual pure functions; no producer/network/product writes; fixture valuation is not an observed market valuation',
  partialMissing, allMissing, publishedEmptyQuarterCandidates: candidates.length, candidates, employment };
fs.writeFileSync(new URL('./pass4-reproductions.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ partialMissing, allMissing, publishedEmptyQuarterCandidates: candidates.length, employment }));
