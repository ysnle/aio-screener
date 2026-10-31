// Audit-only synthetic fixtures; no producers or external requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateConditionalEvidence } from '../../src/domain/screener/conditional-evidence.js';
import { computeFactorRanks } from '../../src/domain/screener/factor-ranks.js';
const now = '2026-09-12T00:00:00.000Z';
const observations = Array.from({ length: 30 }, (_, i) => ({
  instrumentId: `FIXTURE-${i}`, sessionId: '2026-01-05', eligible: true, success: true,
  sourceId: 'fixture', sourceKind: 'T1_LICENSED', rightsId: 'fixture', rightsStatus: 'LICENSED',
  observedAt: '2026-01-05T21:00:00Z', fetchedAt: '2026-09-11T21:00:00Z',
  availableAt: '2026-09-11T22:00:00Z', revisionId: 'fixture', watermark: '2026-01-05',
  timezone: 'America/New_York', calendarId: 'fixture', calendarStatus: 'EXCHANGE_VERIFIED',
  outcomeEndAt: '2027-01-05T21:00:00Z'
}));
const future = evaluateConditionalEvidence({ observations, now });
const reversed = evaluateConditionalEvidence({ observations: observations.map(row => ({ ...row, outcomeEndAt: '2025-01-05T21:00:00Z' })), now });
assert.equal(future.status, 'READY');
assert.equal(reversed.status, 'READY');
const rows = Array.from({ length: 6 }, (_, i) => ({
  sym: `F${i}`, sector: 'Technology', ret1m: i + 1, ret3m: i + 1, ret6m: i + 1,
  pctSma50: i + 1, pctSma200: i + 1, vol: i === 5 ? null : 20 + i,
  factorObservedAt: '2026-08-26T00:00:00Z', observedAt: '2026-08-26T00:00:00Z',
  factorSourceKind: 'T3_PUBLIC_DELAYED', factorAllowedUse: 'research-relative-ranking-only',
  factorQuality: { status: 'CURRENT', stale: false, decisionUse: false },
  rank: 99, quantSignal: 'old fixture rank'
}));
const input = { rows, weights: { momentum: 0.5, lowvol: 0.5 }, weightsPolicy: 'explicit', now: Date.parse('2026-08-27T00:00:00Z') };
const dirty = computeFactorRanks(input).rows.find(row => row.sym === 'F5');
const clean = computeFactorRanks({ ...input, rows: rows.map(({ rank, quantSignal, ...row }) => row) }).rows.find(row => row.sym === 'F5');
assert.equal(dirty.rankingEligibility, 'insufficient-row-factor-coverage');
assert.equal(dirty.rank, 99);
assert.equal(clean.rank, null);
const result = { generatedAt: new Date().toISOString(), evidenceLevel: 'E2 isolated domain functions',
  limits: 'Synthetic fixtures, not browser failures. Production evaluator caller and prior-rank active input impact not established.',
  futureOutcome: { status: future.status, sample: future.sample, independence: future.independence },
  reversedOutcome: { status: reversed.status, sample: reversed.sample }, retainedRank: { dirty, clean } };
fs.writeFileSync(new URL('./pass6-reproductions.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ futureOutcome: future.status, reversedOutcome: reversed.status, insufficientCoverageRank: dirty.rank, cleanInputRank: clean.rank }));
