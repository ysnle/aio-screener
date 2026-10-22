import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Read-only isolated review: every evaluated production function comes from the pinned Git blob.
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const source = (path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const fn = (text, name) => {
  const re = new RegExp(`(?:export )?function ${name}\\([^]*?\\n}`, 'm');
  const hit = text.match(re);
  assert.ok(hit, name);
  return hit[0].replace(/^export /, '');
};
const portfolio = source('src/ui/components/portfolio-read.js');
const screener = source('src/ui/pages/screener.js');
const presentation = source('src/domain/screener/row-presentation.js');
const finite = (v) => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const capFilterValue = new Function('finite', 'fieldValueForPurpose', `${fn(presentation, 'capFilterValue')}; return capFilterValue;`)(finite, () => { throw Error('not used: synthetic rows have no fieldReadiness'); });
// liveRow is identity here: fixtures have no live overlay. No assertion concerns overlay semantics.
const capOrderMap = new Function('capFilterValue', 'liveRow', `${fn(screener, 'capOrderMap')}; return capOrderMap;`)(capFilterValue, (row) => row);
const sorted = [{ sym: 'SMALL', mcap: 10 }, { sym: 'LARGE', mcap: 100 }];
const capOrder = capOrderMap(sorted);
const capResult = sorted.map((row, i) => ({ symbol: row.sym, tablePosition: i + 1, displayedHash: capOrder.get(row.sym) }));
assert.deepEqual(capResult.map((r) => r.displayedHash), [2, 1]);
// The unchanged dependencies do not participate in the sector result: no stress input, and bond read is unused below.
const portfolioLens = new Function('estimateBookSensitivities', 'bondCushion', 'STRESS_MIN_WEEKS', `${fn(portfolio, 'portfolioLens')}; return portfolioLens;`)(() => { throw Error('no stress input'); }, () => ({ available: false }), 30);
const mixed = portfolioLens({ surface: { currencyState: 'declared-single', baseCurrency: 'USD', rows: [{ symbol: 'NVDA', sector: 'Technology', value: 500 }, { symbol: 'TLT', sector: 'Unclassified', value: 500 }] } });
assert.equal(mixed.topSector.pct, 50);
const stocksOnlyTechnologyPct = 100;
const nullPrice = portfolioLens({ surface: { currencyState: 'declared-single', baseCurrency: 'USD', holdingCount: 2, rows: [{ symbol: 'NVDA', sector: 'Technology', value: 500 }, { symbol: 'UNPRICED', sector: 'Health Care', value: null }] } });
assert.equal(nullPrice.holdings, 1);
// Build both statistics from the same 12 cross-sections, not independently invented IC/spread values.
// Monotonic returns give a high Spearman IC; changing their magnitude leaves IC unchanged but radically changes
// the top-minus-bottom mean's variance. Swapping adjacent ranks makes IC variance nonzero.
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const tOf = (xs) => { const m = mean(xs); return m / Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length); };
const pairs = Array.from({ length: 12 }, (_, date) => {
  const retRanks = Array.from({ length: 100 }, (_, i) => i + 1);
  for (let j = 0; j < (date % 2 ? 10 : 1); j += 1) [retRanks[j * 2], retRanks[j * 2 + 1]] = [retRanks[j * 2 + 1], retRanks[j * 2]];
  const returns = retRanks.map((r) => r * (date === 11 ? 0.1 : 0.001));
  const d2 = retRanks.reduce((sum, rank, i) => sum + (rank - i - 1) ** 2, 0);
  return { ic: 1 - 6 * d2 / (100 * (100 ** 2 - 1)), spread: mean(returns.slice(80)) - mean(returns.slice(0, 20)) };
});
const icT = tOf(pairs.map((p) => p.ic));
const spreadT = tOf(pairs.map((p) => p.spread));
const validation = source('src/ui/components/screener-validation.js');
const finiteOrNull = finite;
const readValidationState = new Function('liveScreenerModelFingerprint', 'GATE_BLOCKER_WORDS', 'finiteOrNull', 'VALIDATION_MIN_REBALANCES', 'VALIDATION_MIN_ABS_T', 'CANDIDATE_LINE', 'signedPp', `${fn(validation, 'readValidationState')}; return readValidationState;`)(() => 'same-model', {}, finiteOrNull, 12, 2, '순위는 후보', (v) => `${v.toFixed(2)}%p`);
const statisticsRead = readValidationState({ metadata: { backtest: { rebalancesCounted: 12, quantileSpreadNet: mean(pairs.map((p) => p.spread)), ic: { compositeT: icT }, modelFingerprint: 'same-model' } } });
assert.ok(icT > 2);
assert.ok(spreadT < 2);
assert.equal(statisticsRead.distinguishable, true);
assert.equal(statisticsRead.state, 'favorable');
// Account-basis proof. Execute pinned FX/cash/surface modules; same-currency fixtures never call market FX readers.
const moduleOf = (path, bindings, names) => new Function(...Object.keys(bindings), source(path).replace(/^import .*;\r?\n/gm, '').replace(/\bexport (?=(?:const|function)\b)/g, '') + `\nreturn { ${names.join(',')} };`)(...Object.values(bindings));
const fx = moduleOf('src/domain/portfolio/fx.js', {}, ['FX_LEG_MAX_AGE_MS', 'convertWithDeclaredRates', 'listingCurrency']);
const cash = moduleOf('src/domain/portfolio/cash.js', { convertWithDeclaredRates: fx.convertWithDeclaredRates, buildCloseSeries: () => { throw Error('FX history reader not reached in USD-only fixture'); }, closeBasis: () => { throw Error('FX close basis not reached'); } }, ['convertCashBalances']);
const { derivePortfolioSurface } = moduleOf('src/domain/portfolio/surface.js', { ...fx, ...cash }, ['derivePortfolioSurface']);
const account = derivePortfolioSurface({ state: { readState: 'ready', baseCurrency: 'USD', cashBalances: [{ currency: 'USD', amount: 9900 }], holdings: [{ symbol: 'NVDA', currency: 'USD', shares: 1, avgCost: 100 }] }, closeOf: () => ({ price: 100, date: '2026-10-20' }) });
assert.equal(account.positionValue, 100); assert.equal(account.cash, 9900); assert.equal(account.totalAssets, 10000); assert.equal(account.exposurePct, 1);
// The only stress dependency stub is a history schema adapter; regression, as-of matching, weekly stepping and
// current-weight portfolio construction all run unchanged from the pinned full stress-sensitivity module.
const fixtureHistory = Array.from({ length: 176 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10), spx: 100 + i * 0.1 + Math.sin(i / 5) }));
const historyMap = { NVDA: Object.fromEntries(fixtureHistory.map((r) => [r.date, r.spx])) };
const { estimateBookSensitivities } = moduleOf('src/domain/portfolio/stress-sensitivity.js', { buildCloseSeries: (history, key) => history.filter((r) => Number.isFinite(r[key])).map((r) => ({ date: r.date, value: r[key] })) }, ['estimateBookSensitivities']);
const accountLensFn = new Function('estimateBookSensitivities', 'bondCushion', 'STRESS_MIN_WEEKS', `${fn(portfolio, 'portfolioLens')}; return portfolioLens;`)(estimateBookSensitivities, () => ({ available: false }), 30);
const accountLens = accountLensFn({ surface: account, stressInput: { historyMap, commonDates: fixtureHistory.map((r) => r.date) }, history: fixtureHistory });
assert.ok(Math.abs(accountLens.beta - 1) < 1e-12);
const accountBeta = accountLens.beta * account.positionValue / account.totalAssets;
assert.ok(Math.abs(accountBeta - 0.01) < 1e-12);
const report = { ref, proofLevel: 'isolated-functions; not browser', productionSha256: { portfolio: createHash('sha256').update(portfolio).digest('hex'), screener: createHash('sha256').update(screener).digest('hex') }, capResult, mixedBondStockSector: { displayedPct: mixed.topSector.pct, actualPctOfStockPart: stocksOnlyTechnologyPct, note: 'renderPortfolioLens says 주식 평가액 but denominator includes TLT, an exact bond ETF in the pinned asset-class map' }, missingPrice: { actualHoldings: 2, lensHoldings: nullPrice.holdings, effectiveN: nullPrice.effectiveN, note: 'hero note says 평가액 있는 1종목; excluded-price count is not a separate defect' } };
report.icVsSpread = { crossSections: 12, rowsEach: 100, icT, spreadT, displayedState: statisticsRead.state, displayedDistinguishable: statisticsRead.distinguishable, note: 'same-model fingerprint stub only avoids importing unrelated model constants; IC/spread are computed from the same return rows' };
report.accountBasis = { positionValue: account.positionValue, cash: account.cash, totalAssets: account.totalAssets, exposurePct: account.exposurePct, displayedBeta: accountLens.beta, accountBetaWithConstantSameCurrencyCash: accountBeta, weeks: accountLens.betaNote, note: 'pinned derivePortfolioSurface + cash/fx + estimateBookSensitivities; history-reader schema adapter only, no FX; bond card unused stub' };
writeFileSync(new URL('./ui-delta-repro.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
