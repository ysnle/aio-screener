// Expect cases for the market-wide lean (owner 2026-10-26): what the 오늘 screen and the AI context print for each
// evidence mix. Scenarios mirror the v58.81 unit checks in ci-esm-core-unit-check.mjs; this file shows the whole text.
export const suite = { name: 'market-lean', source: 'src/domain/market/regime/market-lean.js' };

import { stressOutcomesFingerprint } from '../../../src/domain/scenarios/outcome-fingerprints.js';

// Stamped with the live definition, as the weekly producer writes it; an unstamped record is read as absent.
const stress = { fingerprint: stressOutcomesFingerprint(), all: { 21: { hitRate: 64 } }, bands: [{ id: 'normal', horizons: { 21: { hitRate: 63.4, nEff: 136 } } }, { id: 'stress', horizons: { 21: { hitRate: 80, nEff: 60 } } }] };
const regime = (favorable, burden, asOf = null) => ({ available: true, asOf, counts: { favorable, neutral: 6 - favorable - burden, burden } });
const temperature = (state, asOf, retained = []) => ({ retained, markets: { spx: { state, asOf, outcomes: { [state]: { h21: { n: 60, hitRate: 85 } }, all: { h21: { hitRate: 64 } } } } } });

const verdict = (buy, defend) => ({ marketLean: { ruleVersion: 'market-lean.v1', horizon: 21, status: buy && defend ? 'PASS' : buy || defend ? 'PARTIAL' : 'FAIL', directions: { buy, defend },
  span: { from: '2008-03-17', to: '2026-11-13' }, axesReconstructed: ['trend', 'volatility', 'rates', 'commodities'], frequencies: { 2: { rate: 72, base: 65, n: 40 }, 1: { rate: 70, base: 65, n: 45 }, 0: { rate: 66, base: 65, n: 120 }, [-1]: { rate: 55, base: 65, n: 40 }, [-2]: { rate: 50, base: 65, n: 31 } } } });

const print = (lean) => !lean?.available ? '(없음)' : [
  `label: ${lean.label}`,
  ...(lean.frequency ? [`frequency: ${lean.frequency}`] : []),
  ...(lean.basis ? [`basis: ${lean.basis}`] : []),
  `read: ${lean.read ?? ''}`,
  ...(lean.flip ? [`flip: ${lean.flip}`] : []),
  ...lean.items.map((item) => `- [${item.id} vote=${item.vote ?? 0}] ${item.label}: ${item.text}`)
].join('\n');

export default async function cases({ load }) {
  const { buildMarketLean, renderMarketLeanContext } = await load(suite.source);
  const scenarios = [
    ['burden-3-count-only', { regime: regime(0, 3), stress, vix: 19.2 }],
    ['burden-1-no-lean', { regime: regime(1, 2), stress, vix: 19.2 }],
    ['stress-from-another-definition-held-out', { regime: regime(0, 3), stress: { ...stress, fingerprint: 'stress-outcomes:older' }, vix: 19.2 }],
    ['vix-33-pooled-band-does-not-vote', { regime: regime(1, 1), stress, vix: 33 }],
    ['cold-temperature-against-burden-mixed', { regime: regime(0, 3, '2026-10-23'), stress, vix: 33, temperature: temperature('cold', '2026-10-23') }],
    ['cold-temperature-with-favorable-buy', { regime: regime(3, 0, '2026-10-23'), stress, vix: 33, temperature: temperature('cold', '2026-10-23') }],
    ['retained-temperature-held-out', { regime: regime(1, 1, '2026-10-23'), temperature: temperature('cold', '2026-10-23', ['spx']) }],
    ['older-temperature-held-out', { regime: regime(1, 1, '2026-10-23'), temperature: temperature('cold', '2026-10-16') }],
    ['no-inputs', {}],
    // Under a published lean verdict (model-validation-status.json marketLean): the direction word appears only for a
    // direction the backtest passed, with its past frequency; the rows above have no verdict and show the counts.
    ['verdict-pass-burden-3', { regime: regime(0, 3), stress, vix: 19.2, validation: verdict(true, true) }],
    ['verdict-pass-favorable-temperature', { regime: regime(3, 0, '2026-10-23'), stress, vix: 33, temperature: temperature('cold', '2026-10-23'), validation: verdict(true, true) }],
    ['verdict-buy-only-burden-3', { regime: regime(0, 3), stress, vix: 19.2, validation: verdict(true, false) }],
    ['verdict-fail-favorable-3', { regime: regime(3, 0), stress, vix: 19.2, validation: verdict(false, false) }]
  ];
  const out = scenarios.map(([name, input]) => {
    const model = buildMarketLean(input);
    return { name, input, output: `미국\n${print(model.us)}\n\n한국\n${print(model.kr)}` };
  });
  const aiInput = scenarios[0][1];
  out.push({ name: 'ai-context-burden-3', input: aiInput, output: renderMarketLeanContext(buildMarketLean(aiInput)) || '(빈 문자열)' });
  return out;
}
