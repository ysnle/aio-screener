// scripts/fixtures/pipeline-semantics/producers.mjs — v59.45 pipeline review regressions (producer checks owned centrally)
import assert from 'node:assert/strict';

const now = Date.parse('2026-10-25T00:00:00Z');
const yieldsFor = async (load, quarters) => {
  const { signedYields } = await load('scripts/lib/candidate-archive.mjs');
  return signedYields('X', { price: 10, shares: 1e6 }, { quarters: { X: quarters.map(([date, value]) => `${date}:1:${value}:r`).join(';') }, data: {} }, now);
};

export const cases = [
  { id: 'v59.52', name: 'scenario transitions compare the complete leader set, including entering and leaving ties without an id swap', run: async ({ load }) => {
    const { diffSnapshots } = await load('scripts/build-scenario-state.mjs');
    const items = ['a', 'b', 'c'].map((id) => ({ id, title: `Scenario ${id}`, met: 2, total: 4 }));
    const states = [[], ['a'], ['b'], ['a', 'b'], ['a', 'c']];
    const snap = (ids, reverse = false) => ({ crossroads: { leadId: (reverse ? ids.at(-1) : ids[0]) || null, altId: 'c', tiedIds: ids.length > 1 ? ids : [], items } });
    for (const before of states) for (const after of states) {
      const changes = diffSnapshots(snap(before), snap(after), 'T').filter((row) => row.kind === 'lead');
      assert.equal(changes.length, JSON.stringify(before) === JSON.stringify(after) ? 0 : 1, `${before} -> ${after}`);
      if (changes.length && after.length > 1) {
        assert.match(changes[0].text, /동률/);
        for (const id of after) assert.ok(changes[0].text.includes(`Scenario ${id}`));
      }
    }
    assert.equal(diffSnapshots(snap(['a', 'b']), snap(['b', 'a'], true), 'T').filter((row) => row.kind === 'lead').length, 0);
  } },
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
  { id: 'v59.59', name: 'collector HTTP policy: `HTTP <status>` with a status field, no retry on a definitive 4xx, retry on 5xx, deadline covers the body read', run: async ({ load }) => {
      const { fetchJsonWithDeadline, withRetry } = await load('scripts/lib/http-fetch.mjs');
      let calls = 0;
      const answering = (status) => async () => { calls += 1; return { ok: status < 400, status, json: async () => ({ ok: true }) }; };
      const retryFast = { tries: 3, delayMs: () => 0 };
      calls = 0;
      await assert.rejects(withRetry(() => fetchJsonWithDeadline('x', { fetchImpl: answering(404) }), retryFast), (error) => error.message === 'HTTP 404' && error.status === 404);
      assert.equal(calls, 1, 'a 404 is not retried');
      calls = 0;
      await assert.rejects(withRetry(() => fetchJsonWithDeadline('x', { fetchImpl: answering(503) }), retryFast), { message: 'HTTP 503' });
      assert.equal(calls, 3, 'a 503 is retried');
      calls = 0;
      await assert.rejects(withRetry(() => fetchJsonWithDeadline('x', { fetchImpl: answering(429) }), retryFast));
      assert.equal(calls, 3, 'a 429 is retried');
      const stalledBody = async (url, { signal }) => ({ ok: true, status: 200, json: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) });
      await assert.rejects(fetchJsonWithDeadline('x', { timeoutMs: 20, fetchImpl: stalledBody }), { name: 'AbortError' });
  } },
  { id: 'v59.59', name: 'a missing reading is not a zero: null quote value/change and null estimates stay missing in producers', run: async ({ load }) => {
      const { buildMarketSlotMarks } = await load('scripts/lib/market-timeline.mjs');
      const marks = buildMarketSlotMarks({ quotes: [
        { metricId: 'market.index.spx', value: null, observedAt: '2026-10-30T20:00:00Z' },
        { metricId: 'market.index.nasdaq', value: 100, changePct: null, observedAt: '2026-10-30T20:00:00Z' },
        { metricId: 'market.fx.usdkrw', value: '1400.5', changePct: '-0.2', observedAt: '2026-10-30T20:00:00Z' }
      ] });
      assert.equal(marks['market.index.spx'], undefined, 'a null value is not a 0 mark');
      assert.equal('changePct' in marks['market.index.nasdaq'], false, 'a null change is not 0%');
      assert.equal(marks['market.fx.usdkrw'].value, 1400.5);
      assert.equal(marks['market.fx.usdkrw'].changePct, -0.2);
      const { isObservedNumber } = await load('scripts/lib/refresh-continuity.mjs');
      assert.deepEqual([null, '', ' ', false, '1.5', 0].map(isObservedNumber), [false, false, false, false, true, true]);
      const { tickerCikMap } = await load('scripts/lib/sec-results-filings.mjs');
      const map = tickerCikMap({ 0: { ticker: 'AAA', cik_str: null }, 1: { ticker: 'BBB', cik_str: 320193 } });
      assert.equal(map.has('AAA'), false, 'a null CIK is not CIK 0');
      assert.equal(map.get('BBB'), 320193);
  } },
];
