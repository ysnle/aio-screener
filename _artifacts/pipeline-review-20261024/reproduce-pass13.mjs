import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScreenerAiContext, runScreenerQuery } from '../../src/ai/context/screener-query.js';
const kr = buildScreenerAiContext('반도체 후보', [], {
  rows: [{ sym: '005930.KS', name: '삼성전자', sector: '반도체', mcap: 300, rsi: 50, rank: 60 }],
  live: { '005930.KS': { price: 70000, pct: 1, currency: 'KRW', observedAt: '2026-10-27T06:30:00Z' } },
  rankAsOf: '2026-10-27'
});
assert(kr.prompt.includes('가격 $70000.00'));
assert.equal(kr.result.rows[0].currency, undefined);
const smallCap = runScreenerQuery('소형주 후보', { rows: [
  { sym: 'MISSING', mcap: null }, { sym: 'ZERO', mcap: 0 },
  { sym: 'SMALL', mcap: 2 }, { sym: 'LARGE', mcap: 100 }
] });
assert.deepEqual(new Set(smallCap.rows.map(row => row.sym)), new Set(['MISSING', 'ZERO', 'SMALL']));
const rsiBelow = runScreenerQuery('rsi 30 미만', { rows: [{ sym: 'AT', rsi: 30 }, { sym: 'BELOW', rsi: 29 }] });
assert(rsiBelow.rows.some(row => row.sym === 'AT'));
fs.writeFileSync(new URL('./pass13-reproductions.json', import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), network: false, kr, smallCap, rsiBelow }, null, 2) + '\n');
console.log('PASS: KRW formatted as USD; unknown cap selected as small; strict RSI boundary included');
