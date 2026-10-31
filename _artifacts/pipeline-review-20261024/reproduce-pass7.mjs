import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { backtestFactors } from '../../scripts/lib/factors.mjs';
import { summarizeValidation } from '../../src/ui/components/screener-validation.js';

const dates = [];
for (let d = new Date('2025-01-01T00:00:00Z'); dates.length < 300; d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10));
}
const stocks = Array.from({ length: 20 }, (_, n) => {
  const closes = dates.map((_, i) => 100 * Math.exp(i * (n + 1) / 100000) * (1 + 0.002 * Math.sin(i + n)));
  return { sym: `FIX${n}`, dates, closes, adjCloses: closes, adjustedCloseStatus: 'complete' };
});
const backtest = backtestFactors(stocks, { offsets: [63], fwdDays: 21 });
const source = fs.readFileSync('scripts/backtest-factors-longrun.mjs', 'utf8');
const start = source.indexOf('  const regimeGroups = new Map();');
const end = source.indexOf('  const regimes =', start);
assert(start >= 0 && end > start);
const sampledDates = [];
vm.runInNewContext(source.slice(start, end), {
  offsetsAsc: [63], marketSeries: dates.map(date => ({ date, spx: 100, vix: 15 })),
  classifyRegime(record) { sampledDates.push(record.date); return 'fixture'; }
});
assert.notEqual(backtest.rebalanceDates[0], sampledDates[0]);
assert.equal(dates.indexOf(sampledDates[0]) - dates.indexOf(backtest.rebalanceDates[0]), 1);

const nullSummary = summarizeValidation([
  { date: '2026-01-01', modelFingerprint: 'fixture', quantileSpreadNet: null },
  { date: '2026-01-02', modelFingerprint: 'fixture', quantileSpreadNet: '' }
]);
assert.deepEqual(nullSummary.series.map(p => p.value), [0, 0]);
const history = JSON.parse(fs.readFileSync('public-data/backtest-history.json', 'utf8'));
const actualRows = Array.isArray(history) ? history : history.history || [];
const currentMissing = actualRows.filter(row => row.quantileSpreadNet === null || row.quantileSpreadNet === '').length;
const report = { generatedAt: new Date().toISOString(), evidence: 'E2 isolated real functions and unchanged source block',
  regimeDate: { rebalanceDate: backtest.rebalanceDates[0], classifiedDate: sampledDates[0], sessionDifference: 1,
    limit: 'classifyRegime stub records the date only; no claim about actual historical regime flips' },
  nullValidationSeries: nullSummary.series,
  committedHistory: { inspectedRows: actualRows.length, nullOrBlankSpreadRows: currentMissing },
  limits: 'No external calls, producer main, browser or deployed execution. Synthetic weekday calendar is not an exchange calendar.' };
fs.writeFileSync(new URL('./pass7-reproductions.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
