// scripts/fixtures/pipeline-semantics/research-scripts.mjs — v59.45 pipeline review regressions (research backtests)
import assert from 'node:assert/strict';

export const cases = [
  { id: 'P7-BT-01', name: 'a long-run regime label reads the adopted rebalance date, not the next session', run: async ({ load }) => {
      const { groupRebalanceDatesByRegime } = await load('scripts/backtest-factors-longrun.mjs');
      const series = [
        { date: '2025-11-26', spx: 100, vix: 15 },
        { date: '2025-11-27', spx: 100, vix: 15 },
        { date: '2025-11-28', spx: 100, vix: 30 },
      ];
      const { groups, unmatched } = groupRebalanceDatesByRegime(['2025-11-27', '2025-11-29'], series);
      const labels = [...groups.keys()];
      assert.equal(labels.length, 1);
      assert.match(labels[0], /^low-vol_/, 'the 11/27 rebalance uses the 11/27 VIX, not the 11/28 spike');
      assert.deepEqual(unmatched, ['2025-11-29'], 'a date missing from the market series is held out, not shifted');
  } },
  { id: 'P9-BT-01', name: 'the relativization variant differs from the current-model baseline only by threshold units', run: async ({ load }) => {
      const { reconstructRelativeScore, percentileLevel } = await load('scripts/backtest-trading-score-longrun.mjs');
      const { reconstructScore } = await load('scripts/backtest-trading-score.mjs');
      const ma = { spxPrice: 95, spx50ma: 90, spx200ma: 100, hyg: 79 };
      const p = { vixP: 0.5, dxyP: 0.5, tnxP: 0.5, vvixP: 0.5, wtiP: 0.5 };
      const rel = reconstructRelativeScore({ ...p, ...ma });
      const base = reconstructScore({ vix: percentileLevel('vix', 0.5), fg: 45, dxy: percentileLevel('dxy', 0.5), tnx: percentileLevel('tnx', 0.5), wti: percentileLevel('wti', 0.5), vvix: percentileLevel('vvix', 0.5), mode: 'default', ...ma });
      assert.equal(rel.total, base.total, 'same band levels → same score: trend, risk appetite and breadth follow the current model');
      assert.equal(rel.trendScore, base.trendScore);
      assert.equal(percentileLevel('vix', 0.97), 40);
      assert.ok(percentileLevel('dxy', 0.85) > 107 && percentileLevel('dxy', 0.85) <= 110);
      assert.equal(reconstructRelativeScore({ ...p, vixP: null, ...ma }), null, 'warm-up stays unjudged');
  } },
];
