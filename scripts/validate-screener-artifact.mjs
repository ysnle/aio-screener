import { readFile } from 'node:fs/promises';
import { expandScreenerArtifact } from '../src/data/screener-extended.js'; // v57.95 core row encoding

const path = process.argv[2] || 'public-data/screener.json';
const payload = expandScreenerArtifact(JSON.parse(await readFile(path, 'utf8')));
const errors = [];
const rows = payload && payload.data && typeof payload.data === 'object' ? Object.values(payload.data) : [];
const universe = Number(payload && payload.universe);
const ok = Number(payload && payload.ok);
const observed = payload && payload.factorObservedAt ? new Date(payload.factorObservedAt).getTime() : NaN;
const generated = payload && payload.asOf ? new Date(payload.asOf).getTime() : NaN;
const now = Date.now();
const breadth = payload && payload.breadth && payload.breadth.segments;
const contract = payload && payload.rankingContract;
const fundamentalFields = ['pe', 'pb', 'roe', 'margin', 'revGrowth'];
const observedAtSet = new Set(rows.map(row => row && row.observedAt).filter(Boolean));
const mixedRevision = observedAtSet.size > 1;
const fundamentalRows = rows.filter(row => row && fundamentalFields.some(field => Number.isFinite(Number(row[field]))));
const currentFactorRows = rows.filter(row => {
  const rowObserved = new Date(row?.observedAt || '').getTime();
  return Number.isFinite(rowObserved) && now - rowObserved >= 0 && now - rowObserved <= 4 * 86400000;
});

if (!Number.isInteger(universe) || universe < 100) errors.push('universe must be an integer >= 100');
if (!Number.isInteger(ok) || ok !== rows.length) errors.push(`ok must equal data row count (${ok} != ${rows.length})`);
if (universe > 0 && ok / universe < 0.8) errors.push(`coverage below 80% (${ok}/${universe})`);
// v59.46 R3-05: rows carried per symbol (rowsRetained) are not this run's reads — fetch coverage counts read rows plus
// rows of a market kept whole (marketRetained), so a carry cannot lift a failing run over the floor.
{
  const keptMarkets = new Set(Object.keys(payload.marketRetained && typeof payload.marketRetained === 'object' ? payload.marketRetained : {}));
  const keptRowSymbols = new Set(Object.values(payload.rowsRetained && typeof payload.rowsRetained === 'object' ? payload.rowsRetained : {}).flatMap((entry) => Array.isArray(entry?.symbols) ? entry.symbols : []));
  const carriedRows = Object.entries(payload.data || {}).filter(([sym, row]) => row?.retainedFrom && keptRowSymbols.has(sym) && !keptMarkets.has(/\.(KS|KQ)$/i.test(sym) ? 'KR' : 'US')).length;
  if (universe > 0 && (ok - carriedRows) / universe < 0.8) errors.push(`fetch coverage below 80% without carried rows (${ok - carriedRows}/${universe})`);
  const unlisted = Object.entries(payload.data || {}).filter(([sym, row]) => row?.retainedFrom && !keptRowSymbols.has(sym) && !keptMarkets.has(/\.(KS|KQ)$/i.test(sym) ? 'KR' : 'US')).map(([sym]) => sym);
  if (unlisted.length) errors.push(`carried rows without a rowsRetained/marketRetained entry: ${unlisted.slice(0, 5).join(', ')}`);
}
if (universe > 0 && currentFactorRows.length / universe < 0.8) errors.push(`current factor observation coverage below 80% (${currentFactorRows.length}/${universe})`);
if (!Number.isFinite(observed)) errors.push('factorObservedAt missing or invalid');
if (!Number.isFinite(generated)) errors.push('asOf missing or invalid');
if (Number.isFinite(generated) && (now - generated < -15 * 60 * 1000 || now - generated > 2 * 86400000)) errors.push('artifact asOf is outside the 2-day processing freshness budget');
if (Number.isFinite(observed) && (now - observed < -15 * 60 * 1000 || now - observed > 4 * 86400000)) errors.push('factorObservedAt is outside the 4-day market-session freshness budget');
if (!breadth || !breadth.all || !breadth.us || !breadth.kr) errors.push('all/us/kr breadth segments required');
for (const key of ['all', 'us', 'kr']) {
  const segment = breadth && breadth[key];
  if (!segment) continue;
  // v58.71: a market kept from the last publish (marketRetained) carries its own segment; the mixed `all` segment then
  // counts only the fetched markets, so its coverage is not judged. Every other key still needs 80%.
  const retainedMarkets = payload.marketRetained && typeof payload.marketRetained === 'object' ? Object.keys(payload.marketRetained) : [];
  if (segment.retained && !(segment.retained.from && retainedMarkets.includes(key.toUpperCase()))) errors.push(`${key} breadth is retained without a matching marketRetained entry`);
  const coverageExempt = key === 'all' && retainedMarkets.length > 0;
  if (!coverageExempt && (!Number.isFinite(Number(segment.coveragePct)) || Number(segment.coveragePct) < 80)) errors.push(`${key} breadth coverage below 80%`);
  if (!segment.observedAt || !Number.isFinite(new Date(segment.observedAt).getTime())) errors.push(`${key} breadth observedAt missing`);
}
if (!contract || contract.allowedUse !== 'research-relative-ranking-only' || contract.tradingSignal !== false) errors.push('research-only ranking contract missing');
if (payload.fundamentalCoveragePct != null && (!Number.isFinite(Number(payload.fundamentalCoveragePct)) || Number(payload.fundamentalCoveragePct) < 0 || Number(payload.fundamentalCoveragePct) > 100)) errors.push('fundamentalCoveragePct out of range');
if (mixedRevision && (!contract || contract.allowedUse !== 'research-relative-ranking-only')) errors.push('mixed observedAt revisions require research-only ranking contract');
if (fundamentalRows.some(row => !row.fundamentalSource || !row.fundamentalModel || !row.fundamentalObservedAt || !Number.isFinite(new Date(row.fundamentalObservedAt).getTime()))) errors.push('fundamental rows require source/model/observedAt lineage');
if (payload.fundamentalCount != null && Number(payload.fundamentalCount) !== fundamentalRows.length) errors.push(`fundamentalCount mismatch (${payload.fundamentalCount} != ${fundamentalRows.length})`);

// v58.56 (#6): the back-test's per-date spread arrays (사후 검증 draws one bar per rebalance) must line up with spreadDates,
// sit inside rebalanceDates, and average back to the published means. Absent arrays (artifacts before v58.56) are allowed.
const backtest = payload && payload.backtest;
if (backtest && Array.isArray(backtest.spreadDates)) {
  const dates = backtest.spreadDates;
  const series = ['quantileSpreadByDate', 'quantileSpreadNetByDate', 'topQuintileMeanByDate', 'bottomQuintileMeanByDate', 'transactionCostByDate'];
  for (const key of series) {
    if (!Array.isArray(backtest[key]) || backtest[key].length !== dates.length) errors.push(`backtest.${key} must have one value per spreadDates entry`);
    else if (backtest[key].some((value) => !Number.isFinite(Number(value)))) errors.push(`backtest.${key} has a non-finite value`);
  }
  const rebalance = new Set(Array.isArray(backtest.rebalanceDates) ? backtest.rebalanceDates : []);
  if (dates.some((date, index) => !rebalance.has(date) || (index && date <= dates[index - 1]))) errors.push('backtest.spreadDates must be ascending rebalanceDates');
  if (Number.isFinite(Number(backtest.rebalancesCounted)) && dates.length !== Number(backtest.rebalancesCounted)) errors.push(`backtest.spreadDates (${dates.length}) != rebalancesCounted (${backtest.rebalancesCounted})`);
  const mean = (key) => backtest[key].reduce((sum, value) => sum + Number(value), 0) / backtest[key].length;
  if (dates.length && Array.isArray(backtest.quantileSpreadNetByDate) && backtest.quantileSpreadNetByDate.length === dates.length && Math.abs(mean('quantileSpreadNetByDate') - Number(backtest.quantileSpreadNet)) > 0.05) errors.push('backtest.quantileSpreadNetByDate does not average to quantileSpreadNet');
  if (dates.length && Array.isArray(backtest.quantileSpreadByDate) && backtest.quantileSpreadByDate.length === dates.length && Math.abs(mean('quantileSpreadByDate') - Number(backtest.quantileSpread)) > 0.05) errors.push('backtest.quantileSpreadByDate does not average to quantileSpread');
}

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  // P715: raw per-symbol price must NOT be published (redistribution posture) - derived-only artifact.
  if (row && 'price' in row) { errors.push(`row ${i} publishes raw price (forbidden since P715)`); break; }
  if (!row || (!Number.isFinite(Number(row.ret1m)) && !Number.isFinite(Number(row.rsi)))) { errors.push(`row ${i} has no derived factors`); break; }
  if (!row.observedAt || !Number.isFinite(new Date(row.observedAt).getTime())) { errors.push(`row ${i} has invalid observedAt`); break; }
}

if (errors.length) {
  errors.forEach(error => console.error(`[screener-validator] ${error}`));
  process.exit(1);
}
const fieldCoverage = Object.fromEntries(fundamentalFields.map(field => [field, rows.filter(row => Number.isFinite(Number(row?.[field]))).length]));
console.log(`[screener-validator] PASS rows=${rows.length}/${universe} mixedRevision=${mixedRevision ? observedAtSet.size : 0} fundamentalRows=${fundamentalRows.length} fieldCoverage=${JSON.stringify(fieldCoverage)} fundamentalCoverage=${payload.fundamentalCoveragePct ?? 0}%`);
