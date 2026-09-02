import { readFile } from 'node:fs/promises';
import { computeFactorRanks, FACTOR_RANKS_ALLOWED_USE, FACTOR_RANKS_MODEL_VERSION } from '../src/domain/screener/factor-ranks.js';

const errors = [];
const check = (label, condition, detail) => { if (!condition) errors.push(label + (detail ? ': ' + detail : '')); };
const factor = await readFile(new URL('./backtest-factors-longrun.mjs', import.meta.url), 'utf8');
const score = await readFile(new URL('./backtest-trading-score-longrun.mjs', import.meta.url), 'utf8');
const status = JSON.parse(await readFile(new URL('../public-data/model-validation-status.json', import.meta.url), 'utf8'));
check('factor backtest has temporal reference/holdout split', /walk-forward/.test(factor) && /holdoutPeriod/.test(factor));
check('model artifact exposes IC/ICIR/hit-rate/decile/drawdown/CI metrics', ['IC', 'ICIR', 'hitRate', 'quantileSpread', 'drawdown', 'CI'].every(token => factor.includes(token) || score.includes(token)));
check('point-in-time/survivorship limitation remains explicit', /survivorshipBiasCaveat/.test(factor) && /Not resolvable without paid point-in-time/.test(factor));
check('cost/liquidity and live parity cannot silently promote the model', status.status === 'BLOCKED' && status.allowedUse === 'research-relative-ranking-only' && status.turnoverModeled === false && status.transactionCostsModeled === false && status.liquidityCapacityModeled === false && status.liveBacktestParity === false);

// RM-04: deterministic negative controls for the live cross-sectional ranker. These fixtures do
// not claim predictive validity; they prove that quality metadata and conservative fallbacks are
// present when a free/public snapshot is incomplete, duplicated, sector-missing, or contaminated
// by an extreme observation.
const rankRow = (sym, sector, seed, overrides = {}) => ({
  sym,
  sector,
  ret1m: seed,
  ret3m: seed * 0.8,
  ret6m: seed * 0.5,
  pctSma50: seed,
  pctSma200: seed * 0.6,
  vol: 20 - seed / 10,
  ...overrides
});
const rankRows = Array.from({ length: 12 }, (_, index) => rankRow(`RM${index + 1}`, index < 6 ? 'Technology' : 'Healthcare', index + 1));
const rankResult = computeFactorRanks({ rows: rankRows, inputVersion: 'research-gate-fixture.v2', now: Date.parse('2026-08-27T00:00:00Z') });
const identicalRows = Array.from({ length: 6 }, (_, index) => rankRow(`TIE${index}`, 'Technology', 5));
const tied = computeFactorRanks({ rows: identicalRows });
const reversedTies = computeFactorRanks({ rows: identicalRows.slice().reverse() });
check('identical evidence receives identical midrank independent of row order', tied.ranked === 6 && reversedTies.ranked === 6 && tied.rows.every(row => row.rank === 50)
  && reversedTies.rows.every(row => row.rank === 50));
check('factor-ranker model version and research boundary are explicit', rankResult.modelVersion === FACTOR_RANKS_MODEL_VERSION && rankResult.researchBoundary?.allowedUse === FACTOR_RANKS_ALLOWED_USE && rankResult.researchBoundary?.tradingSignal === false && rankResult.researchBoundary?.decisionEligible === false);
check('factor-ranker exposes factor coverage and confidence as diagnostics', rankResult.factorCoverage?.momentum?.coveragePct === 100 && rankResult.factorCoverage?.trend?.coveragePct === 100 && Number.isFinite(rankResult.compositeConfidence) && rankResult.confidenceMeaning && rankResult.rows.every((row) => Number.isFinite(row.confidence) && row.allowedUse === FACTOR_RANKS_ALLOWED_USE));
check('factor-ranker uses global fallback for unknown sector', (() => {
  const result = computeFactorRanks({ rows: [...rankRows.slice(0, 11), rankRow('RM-UNKNOWN', '', 99)], inputVersion: 'unknown-sector-fixture.v2', now: Date.parse('2026-08-27T00:00:00Z') });
  return result.sectorNeutrality?.unknownSectorPolicy === 'universe-fallback' && result.sectorNeutrality?.unknownRows === 1 && result.sectorNeutrality?.status === 'partial';
})());
check('factor-ranker removes duplicate or anonymous cross-sectional rows from the rank universe', (() => {
  const result = computeFactorRanks({ rows: [...rankRows, { ...rankRows[0], sym: 'rm1' }, rankRow('', 'Technology', 14)], inputVersion: 'identity-fixture.v2', now: Date.parse('2026-08-27T00:00:00Z') });
  return result.ranked === rankRows.length && result.inputAudit?.duplicateRows === 1 && result.inputAudit?.missingIdentityRows === 1;
})());
check('factor-ranker does not activate market-cap factor from future-dated observations', (() => {
  const result = computeFactorRanks({ rows: rankRows.map((row, index) => ({ ...row, mcap: index + 1, _mcapObservedAt: '2026-09-01T00:00:00Z' })), inputVersion: 'future-observation-fixture.v2', now: Date.parse('2026-08-27T00:00:00Z') });
  return !result.activeFactors.includes('size') && result.factorCoverage?.size?.active === false && result.inputAudit?.futureOrInvalidMcapDates === rankRows.length;
})());
check('factor-ranker gates sparse optional factors instead of treating missing values as neutral evidence', (() => {
  const sparse = rankRows.map((row, index) => ({ ...row, kalmanVelConf: index < 7 ? index / 10 : NaN }));
  const result = computeFactorRanks({ rows: sparse, inputVersion: 'coverage-fixture.v2', now: Date.parse('2026-08-27T00:00:00Z') });
  return !result.activeFactors.includes('kalman') && result.factorCoverage?.kalman?.coveragePct < 80 && result.inactiveFactorReasons?.kalman;
})());
check('factor-ranker reports invalid core observations without poisoning peer statistics', (() => {
  const result = computeFactorRanks({ rows: [...rankRows, rankRow('RM-NAN', 'Technology', NaN, { ret3m: NaN, ret6m: NaN })], inputVersion: 'invalid-observation-fixture.v2', now: Date.parse('2026-08-27T00:00:00Z') });
  return result.inputAudit?.invalidCoreRows === 1 && !result.rows.some((row) => row.sym === 'RM-NAN')
    && result.ranked === rankResult.ranked && JSON.stringify(result.rows) === JSON.stringify(rankResult.rows);
})());
check('factor-ranker applies MAD winsorization only for extreme outliers and exposes its use', (() => {
  const result = computeFactorRanks({ rows: rankRows.map((row, index) => index === 11 ? { ...row, ret1m: 1000, ret3m: 800 } : row), inputVersion: 'outlier-fixture.v2', now: Date.parse('2026-08-27T00:00:00Z') });
  return result.outlierDiagnostics?.byFactor?.momentum?.count >= 1 && result.outlierDiagnostics?.byFactor?.momentum?.method === 'MAD-triggered-winsorization' && result.qualityStatus === 'partial';
})());
check('factor-ranker turnover and regime stability stay diagnostic-only', (() => {
  const previous = Object.fromEntries(rankResult.rows.map((row, index) => [row.sym, index < 2 ? 100 - index : index]));
  const result = computeFactorRanks({ rows: rankRows, previousRanks: previous, previousRegimeLabel: '중립', previousWeights: { momentum: 0.27 }, regimeLabel: '위험회피', inputVersion: 'stability-fixture.v2', now: Date.parse('2026-08-27T00:00:00Z') });
  return result.turnoverStability?.status === 'observed' && Number.isFinite(result.turnoverStability.turnoverPct) && result.turnoverStability.usedForRanking === false && result.regimeStability?.status === 'transition' && result.regimeStability.usedForRanking === false;
})());

check('an active factor never lets the stale minority move peer statistics', (() => {
  const rows = rankRows.map((row, index) => ({ ...row, mcap: index + 1, pe: index + 10, roe: index + 5,
    _mcapObservedAt: index < 10 ? '2026-08-26' : '2026-07-01',
    _fundamentalObservedAt: index < 10 ? '2026-08-26' : '2025-01-01' }));
  const input = { rows, now: Date.parse('2026-08-27'), weights: { momentum: 1, size: 1, value: 1, quality: 1 } };
  const first = computeFactorRanks(input);
  const second = computeFactorRanks({ ...input, rows: rows.map((row, i) => i < 10 ? row : { ...row, mcap: 1e12, pe: 0.01, roe: -999 }) });
  return ['size', 'value', 'quality'].every(key => first.activeFactors.includes(key))
    && JSON.stringify(first.rows) === JSON.stringify(second.rows)
    && first.rows.slice(10).every(row => ['size', 'value', 'quality'].every(key => row.factorScores[key] === null && row.missingFactors.includes(key)));
})());
check('boundary ties and null previous values do not manufacture turnover', (() => {
  const result = computeFactorRanks({ rows: identicalRows.slice().reverse(), previousRanks: { ...Object.fromEntries(tied.rows.map(row => [row.sym, row.rank])), MISSING: null } });
  return result.turnoverStability.turnoverPct === 0 && result.turnoverStability.currentTopCount === 6
    && result.turnoverStability.previousTopCount === 6 && result.turnoverStability.tiePolicy === 'include-all-boundary-ties';
})());
check('symbol-only identities survive canonical ranking output', (() => {
  const result = computeFactorRanks({ rows: rankRows.map(({ sym, ...row }) => ({ ...row, symbol: ` ${sym.toLowerCase()} ` })) });
  return result.rows.length === 12 && result.rows.every((row, index) => row.sym === rankRows[index].sym);
})());

if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log('Research model contract check OK: walk-forward/holdout metrics, factor quality controls, and research-only promotion boundaries are present.');
