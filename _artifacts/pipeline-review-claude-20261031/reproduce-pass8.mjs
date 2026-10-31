// Parent-only review fixtures; no network or product writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { memberRoles, themeCriteria } from '../../src/domain/scenarios/theme-criteria.js';
import { buildScreenerRead } from '../../src/domain/screener/screener-read.js';
import { priceHistoryFromRows, priceFactorRow } from '../../src/domain/screener/price-factors.js';
const members = [
  { sym: 'A', row: { ret1m: 5, ret3m: 10, pctSma50: 2, adrPct: 2, ret5d: 1, pctFrom52wHigh: -5 } },
  { sym: 'B', row: { ret1m: null, ret3m: null, pctSma50: 2, adrPct: 2, ret5d: null } },
  { sym: 'C', row: { ret1m: null, ret3m: null, pctSma50: 2, adrPct: 2, ret5d: null } }
];
const roles = memberRoles(members);
const heat = themeCriteria({ row: {}, members }).items.find(item => item.id === 'heat');
assert.equal(roles.measured, true);
assert.equal(roles.roles.get('A').role, 'leader');
assert.equal(heat.met, true);
const rows = Array.from({ length: 50 }, (_, i) => ({ sym: `F${i}`, sector: 'Technology', screenRank: i + 1,
  pctSma50: i === 0 ? 10 : null, adrPct: i === 0 ? 2 : null, ret5d: i === 0 ? -10 : null }));
const read = buildScreenerRead({ rows });
const health = read.points.find(item => item.id === 'health');
assert(health.text.includes('100%'));
const dates = [];
for (let d = new Date('2026-01-01T00:00:00Z'); dates.length < 80; d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10));
}
const complete = dates.map((date, i) => ({ date, observedAt: `${date}T14:30:00Z`, close: i === 78 ? 200 : 100,
  adjClose: i === 78 ? 200 : 100, high: i === 78 ? 201 : 101, low: i === 78 ? 199 : 99, volume: 1000 }));
const benchmark = new Map([['us', new Map(dates.slice(-9).map(date => [date, -1]))]]);
const makeRow = (input, gaps) => priceFactorRow(priceHistoryFromRows('FIX', input, {
  nullCloseDates: gaps, nowMs: Date.parse('2026-06-01'), providerMeta: { currency: 'USD' }
}), { computedAt: '2026-06-01T00:00:00Z', indexReturns: benchmark });
const full = makeRow(complete, []);
const gapped = makeRow(complete.filter((_, i) => i !== 78), [dates[78]]);
assert.equal(gapped.ret1d, null);
assert.equal(gapped.downDayCount, 8);
assert.equal(gapped.downDayHoldPct, 100);
assert.equal(full.downDayHoldPct, 89);
const result = { generatedAt: new Date().toISOString(), evidence: 'E2 actual pure functions, parent execution',
  themeMinimumCoverage: { suppliedRows: 3, measuredReturnRows: 1, measured: roles.measured, role: roles.roles.get('A'), heat },
  screenerDenominator: { topCount: read.topCount, observedRows: 1, health },
  resilienceGap: { gapDate: dates[78], fullHoldPct: full.downDayHoldPct, gappedRet1d: gapped.ret1d, gappedHoldPct: gapped.downDayHoldPct, gappedCount: gapped.downDayCount },
  limits: 'Synthetic fixtures; no occurrence-frequency or live-browser claim. Weekday dates are not an exchange calendar.' };
fs.writeFileSync(new URL('./pass8-reproductions.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
