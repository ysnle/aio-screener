// Expect cases for the market-wide lean (owner 2026-10-26): what the 오늘 screen and the AI context print for each
// evidence mix. Scenarios mirror the v58.81 unit checks in ci-esm-core-unit-check.mjs; this file shows the whole text.
export const suite = { name: 'market-lean', source: 'src/domain/market/market-lean.js' };

const stress = { all: { 21: { hitRate: 64 } }, bands: [{ id: 'normal', horizons: { 21: { hitRate: 63.4, nEff: 136 } } }, { id: 'stress', horizons: { 21: { hitRate: 80, nEff: 60 } } }] };
const regime = (favorable, burden, asOf = null) => ({ available: true, asOf, counts: { favorable, neutral: 6 - favorable - burden, burden } });
const temperature = (state, asOf, retained = []) => ({ retained, markets: { spx: { state, asOf, outcomes: { [state]: { h21: { n: 60, hitRate: 85 } }, all: { h21: { hitRate: 64 } } } } } });

const print = (lean) => !lean?.available ? '(없음)' : [
  `label: ${lean.label}`,
  `read: ${lean.read ?? ''}`,
  ...(lean.flip ? [`flip: ${lean.flip}`] : []),
  ...(lean.choices ? [`choices: ${lean.choices.join(' / ')}`] : []),
  ...lean.items.map((item) => `- [${item.id} vote=${item.vote ?? 0}] ${item.label}: ${item.text}`)
].join('\n');

export default async function cases({ load }) {
  const { buildMarketLean, renderMarketLeanContext } = await load(suite.source);
  const scenarios = [
    ['burden-3-count-only', { regime: regime(0, 3), stress, vix: 19.2 }],
    ['burden-1-no-lean', { regime: regime(1, 2), stress, vix: 19.2 }],
    ['vix-33-pooled-band-does-not-vote', { regime: regime(1, 1), stress, vix: 33 }],
    ['cold-temperature-against-burden-mixed', { regime: regime(0, 3, '2026-10-23'), stress, vix: 33, temperature: temperature('cold', '2026-10-23') }],
    ['cold-temperature-with-favorable-buy', { regime: regime(3, 0, '2026-10-23'), stress, vix: 33, temperature: temperature('cold', '2026-10-23') }],
    ['retained-temperature-held-out', { regime: regime(1, 1, '2026-10-23'), temperature: temperature('cold', '2026-10-23', ['spx']) }],
    ['older-temperature-held-out', { regime: regime(1, 1, '2026-10-23'), temperature: temperature('cold', '2026-10-16') }],
    ['no-inputs', {}]
  ];
  const out = scenarios.map(([name, input]) => {
    const model = buildMarketLean(input);
    return { name, input, output: `미국\n${print(model.us)}\n\n한국\n${print(model.kr)}` };
  });
  const aiInput = scenarios[0][1];
  out.push({ name: 'ai-context-burden-3', input: aiInput, output: renderMarketLeanContext(buildMarketLean(aiInput)) || '(빈 문자열)' });
  return out;
}
