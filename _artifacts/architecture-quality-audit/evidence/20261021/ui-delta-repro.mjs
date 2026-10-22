import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const REF = 'd36bb256ddf60468d6c7a134628053c5796be6be';
const read = (path) => execFileSync('git', ['show', `${REF}:${path}`], { encoding: 'utf8', maxBuffer: 20e6 });
const urls = new Map();
async function load(path) {
  if (!urls.has(path)) {
    let source = read(path);
    for (const match of [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
      if (!match[1].startsWith('.')) continue;
      const target = new URL(match[1], `file:///${path}`).pathname.slice(1);
      await load(target);
      source = source.replace(match[0], `from '${urls.get(target)}'`);
    }
    urls.set(path, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  return import(urls.get(path));
}
const domain = await load('src/domain/portfolio/trade-journal.js');
const { derivePortfolioSurface } = await load('src/domain/portfolio/surface.js');
const panel = read('src/ui/panels/portfolio-trade-journal.js');
const bookOf = vm.runInNewContext(`(${panel.slice(panel.indexOf('function bookOf('), panel.indexOf('\nfunction renderDynamic'))})`);
const missing = derivePortfolioSurface({ state: { readState: 'ready', holdings: [{ symbol: 'MSFT', shares: 1, avgCost: 100 }, { symbol: 'NVDA', shares: 1, avgCost: 100 }] } });
const missingMirror = domain.rulesMirror({ minCashPct: 20, maxPositions: 1 }, bookOf(missing));
assert.equal(missing.cashPct, null);
assert.equal(missing.holdingCount, 2);
assert.equal(missingMirror.find((r) => r.id === 'min-cash').text, '지금 현금 0.0%');
assert.equal(missingMirror.find((r) => r.id === 'max-positions').ok, true);
console.log('CONFIRMED missing-data mirror:', JSON.stringify({ holdingCount: missing.holdingCount, cashPct: missing.cashPct, mirror: missingMirror }));
const mixed = derivePortfolioSurface({ state: { readState: 'ready', holdings: [{ symbol: 'MSFT', shares: 1, avgCost: 140000, costCurrency: 'KRW' }] }, closeOf: () => ({ price: 100, date: '2026-10-20' }) });
const mixedMirror = domain.rulesMirror({ stopLossPct: 10 }, bookOf(mixed));
assert.equal(mixed.totalPnlPct, null);
assert.equal(mixed.costCurrencyState, 'cost-price-mismatch-held');
assert.equal(mixedMirror[0].ok, false);
assert.ok(mixedMirror[0].text.includes('-99.9%'));
console.log('CONFIRMED incompatible-currency mirror:', JSON.stringify({ totalPnlPct: mixed.totalPnlPct, costCurrencyState: mixed.costCurrencyState, mirror: mixedMirror }));
const { buildPortfolioBackup, parsePortfolioBackup } = await load('src/data/portfolio-backup.js');
const journal = domain.normalizeJournal({ trades: [{ symbol: 'MSFT', date: '2026-10-20', side: 'buy', qty: 1, price: 100 }], rules: { maxPositions: 5 } });
const restored = parsePortfolioBackup(JSON.stringify(buildPortfolioBackup({ trades: journal })));
assert.equal(restored.ok, true);
assert.deepEqual(restored.contents.trades, journal);
console.log('PASS normalized trade journal + rules backup roundtrip');
