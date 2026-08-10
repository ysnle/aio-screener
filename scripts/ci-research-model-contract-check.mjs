import { readFile } from 'node:fs/promises';

const errors = [];
const check = (label, condition, detail) => { if (!condition) errors.push(label + (detail ? ': ' + detail : '')); };
const factor = await readFile(new URL('./backtest-factors-longrun.mjs', import.meta.url), 'utf8');
const score = await readFile(new URL('./backtest-trading-score-longrun.mjs', import.meta.url), 'utf8');
const status = JSON.parse(await readFile(new URL('../public-data/model-validation-status.json', import.meta.url), 'utf8'));
check('factor backtest has temporal reference/holdout split', /walk-forward/.test(factor) && /holdoutPeriod/.test(factor));
check('model artifact exposes IC/ICIR/hit-rate/decile/drawdown/CI metrics', ['IC', 'ICIR', 'hitRate', 'quantileSpread', 'drawdown', 'CI'].every(token => factor.includes(token) || score.includes(token)));
check('point-in-time/survivorship limitation remains explicit', /survivorshipBiasCaveat/.test(factor) && /Not resolvable without paid point-in-time/.test(factor));
check('cost/liquidity and live parity cannot silently promote the model', status.status === 'BLOCKED' && status.allowedUse === 'research-relative-ranking-only' && status.turnoverModeled === false && status.transactionCostsModeled === false && status.liquidityCapacityModeled === false && status.liveBacktestParity === false);

if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log('Research model contract check OK: walk-forward/holdout metrics are present and promotion remains blocked without PIT/cost/liquidity/parity evidence.');
