import fs from 'node:fs';

const screener = JSON.parse(fs.readFileSync('C:/Projects/AIO/public-data/screener.json', 'utf8'));
const entries = Object.entries(screener.data || {});
console.log('ticker keys:', entries.length);

const [, sample] = entries[0] || [];
console.log('\nfirst entry keys:', Object.keys(sample || {}).join(','));
console.log('first entry sample:', JSON.stringify(sample, null, 1).slice(0, 1200));

let withRef = 0, withPrice = 0, withCurrency = 0, withFieldReadiness = 0;
const currencies = new Map();
for (const [, row] of entries) {
  if (row?.instrumentRef) withRef++;
  if (row?.price != null) withPrice++;
  const cur = row?.instrumentRef?.currency ?? row?.currency ?? null;
  if (cur) withCurrency++;
  currencies.set(String(cur), (currencies.get(String(cur)) || 0) + 1);
  if (row?.fieldReadiness) withFieldReadiness++;
}
console.log('\nwith instrumentRef:', withRef, '| with price:', withPrice, '| with currency:', withCurrency, '| with fieldReadiness:', withFieldReadiness);
console.log('currency distribution:', JSON.stringify([...currencies.entries()].slice(0, 10)));

console.log('\nfirst 12 tickers with currency/price:', JSON.stringify(entries.slice(0, 12).map(([sym, row]) => ({ sym, currency: row?.instrumentRef?.currency ?? row?.currency ?? null, price: row?.price ?? null })), null, 1));
