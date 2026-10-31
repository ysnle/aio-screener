// scripts/fixtures/pipeline-semantics/producers.mjs — v59.45 pipeline review regressions (producer checks owned centrally)
import assert from 'node:assert/strict';

const now = Date.parse('2026-10-25T00:00:00Z');
const yieldsFor = async (load, quarters) => {
  const { signedYields } = await load('scripts/lib/candidate-archive.mjs');
  return signedYields('X', { price: 10, shares: 1e6 }, { quarters: { X: quarters.map(([date, value]) => `${date}:1:${value}:r`).join(';') }, data: {} }, now);
};

export const cases = [
  { id: 'RUN6-TIE-01', name: 'a lead swap between two tied branches is not logged as a scenario change; leaving the tie is', run: async ({ load }) => {
      const { diffSnapshots } = await load('scripts/build-scenario-state.mjs');
      const items = [{ id: 'aibust', title: 'AI 투자 꺾임 — x', met: 3, total: 4 }, { id: 'oilshock', title: '유가 충격 — y', met: 3, total: 4 }];
      const snap = (leadId, tiedIds) => ({ crossroads: { leadId, altId: null, tiedIds, items } });
      assert.ok(!diffSnapshots(snap('aibust', ['aibust', 'oilshock']), snap('oilshock', ['aibust', 'oilshock']), 'T').some((row) => row.kind === 'lead'));
      assert.ok(diffSnapshots(snap('aibust', ['aibust', 'oilshock']), snap('oilshock', []), 'T').some((row) => row.kind === 'lead'));
  } },
  { id: 'P4-DATA-09', name: 'an empty quarterly net income leaves the TTM earnings yield missing, not 0', run: async ({ load }) => {
      const out = await yieldsFor(load, [['2025-12-31', -1], ['2026-03-31', -1], ['2026-06-30', -1], ['2026-09-30', '']]);
      assert.equal(out.earningsYieldTtm, null);
  } },
  { id: 'P4-DATA-09', name: 'four non-consecutive quarters are not a trailing year', run: async ({ load }) => {
      const out = await yieldsFor(load, [['2025-06-30', 1], ['2025-12-31', 1], ['2026-03-31', 1], ['2026-06-30', 1]]);
      assert.equal(out.earningsYieldTtm, null);
      const ok = await yieldsFor(load, [['2025-09-30', 1], ['2025-12-31', 1], ['2026-03-31', 1], ['2026-06-30', 1]]);
      assert.equal(ok.earningsYieldTtm, 0.4);
  } },
  { id: 'P4-DATA-10', name: 'a stale BLS collection does not pass the employment current-release check', run: async ({ load }) => {
      const { buildReconciliationStatus } = await load('scripts/build-reconciliation-status.mjs');
      const series = (status) => ({ status, series: Object.fromEntries(['unemployment', 'nonfarmPayroll', 'averageHourlyEarnings'].map((key) => [key, { value: 1, observedAt: '2026-09-01' }])) });
      const category = (status) => buildReconciliationStatus({ now: new Date(now).toISOString(), data: { macro: { _bls: series(status) } } }).categories.find((row) => row.categoryId === 'employment-wages');
      assert.notEqual(category('stale').status, 'MATCH');
      assert.equal(category('cached-fresh').status, 'MATCH');
  } },
  { id: 'R3-05', name: 'an unfetched US name keeps its recent row with its own close date; a row older than 7 days is not carried', run: async ({ load }) => {
      const { retainUnfetchedRows } = await load('scripts/producer/screener.mjs');
      const { encodeScreenerArtifact, expandScreenerArtifact } = await load('src/data/screener-extended.js');
      const data = { AAPL: { factorSessionDate: '2026-10-30', ret1m: 2 } };
      const previous = { asOf: '2026-10-29T22:00:00Z', data: { MSFT: { factorSessionDate: '2026-10-29', ret1m: 1 }, OLD: { factorSessionDate: '2026-10-20', ret1m: 9, retainedFrom: '2026-10-21T22:00:00Z' }, '005930.KS': { factorSessionDate: '2026-10-30' } } };
      const kept = retainUnfetchedRows({ data, syms: ['AAPL', 'MSFT', 'OLD', '005930.KS'], previous, market: 'US', sessionDate: '2026-10-30' });
      assert.deepEqual(kept.symbols, ['MSFT']);
      assert.equal(data.MSFT.retainedFrom, '2026-10-29T22:00:00Z');
      assert.equal(data.MSFT.factorSessionDate, '2026-10-29');
      assert.equal(data.OLD, undefined);
      assert.equal(data['005930.KS'], undefined);
      assert.equal(retainUnfetchedRows({ data: {}, syms: ['MSFT'], previous, sessionDate: null }), null);
      const round = expandScreenerArtifact(encodeScreenerArtifact({ asOf: 'x', data }));
      assert.equal(round.data.MSFT.retainedFrom, '2026-10-29T22:00:00Z');
  } },
];
