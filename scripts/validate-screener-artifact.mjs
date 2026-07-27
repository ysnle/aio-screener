import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'public-data/screener.json';
const payload = JSON.parse(await readFile(path, 'utf8'));
const errors = [];
const rows = payload && payload.data && typeof payload.data === 'object' ? Object.values(payload.data) : [];
const universe = Number(payload && payload.universe);
const ok = Number(payload && payload.ok);
const observed = payload && payload.factorObservedAt ? new Date(payload.factorObservedAt).getTime() : NaN;
const breadth = payload && payload.breadth && payload.breadth.segments;
const contract = payload && payload.rankingContract;
const fundamentalFields = ['pe', 'pb', 'roe', 'margin', 'revGrowth'];
const observedAtSet = new Set(rows.map(row => row && row.observedAt).filter(Boolean));
const mixedRevision = observedAtSet.size > 1;
const fundamentalRows = rows.filter(row => row && fundamentalFields.some(field => Number.isFinite(Number(row[field]))));

if (!Number.isInteger(universe) || universe < 100) errors.push('universe must be an integer >= 100');
if (!Number.isInteger(ok) || ok !== rows.length) errors.push(`ok must equal data row count (${ok} != ${rows.length})`);
if (universe > 0 && ok / universe < 0.8) errors.push(`coverage below 80% (${ok}/${universe})`);
if (!Number.isFinite(observed)) errors.push('factorObservedAt missing or invalid');
if (!breadth || !breadth.all || !breadth.us || !breadth.kr) errors.push('all/us/kr breadth segments required');
for (const key of ['all', 'us', 'kr']) {
  const segment = breadth && breadth[key];
  if (!segment) continue;
  if (!Number.isFinite(Number(segment.coveragePct)) || Number(segment.coveragePct) < 80) errors.push(`${key} breadth coverage below 80%`);
  if (!segment.observedAt || !Number.isFinite(new Date(segment.observedAt).getTime())) errors.push(`${key} breadth observedAt missing`);
}
if (!contract || contract.allowedUse !== 'research-relative-ranking-only' || contract.tradingSignal !== false) errors.push('research-only ranking contract missing');
if (payload.fundamentalCoveragePct != null && (!Number.isFinite(Number(payload.fundamentalCoveragePct)) || Number(payload.fundamentalCoveragePct) < 0 || Number(payload.fundamentalCoveragePct) > 100)) errors.push('fundamentalCoveragePct out of range');
if (mixedRevision && (!contract || contract.allowedUse !== 'research-relative-ranking-only')) errors.push('mixed observedAt revisions require research-only ranking contract');
if (fundamentalRows.some(row => !row.fundamentalSource || !row.fundamentalModel || !row.fundamentalObservedAt || !Number.isFinite(new Date(row.fundamentalObservedAt).getTime()))) errors.push('fundamental rows require source/model/observedAt lineage');
if (payload.fundamentalCount != null && Number(payload.fundamentalCount) !== fundamentalRows.length) errors.push(`fundamentalCount mismatch (${payload.fundamentalCount} != ${fundamentalRows.length})`);

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
