import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeMacroLastKnownGood, validateMarketAnalysisText } from './fetch-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const fail = (message) => { throw new Error(`[history-field-time-contract] ${message}`); };

const history = readJson('public-data/history.json');
if (!Array.isArray(history) || history.length < 2) fail('history.json must contain at least two rows');
const fields = ['spx', 'nasdaq', 'dow', 'rut', 'vix', 'vvix', 'tnx', 'dxy', 'wti', 'gold', 'kospi', 'kosdaq', 'btc'];
const errors = [];
let observedFieldCount = 0;
let numericFieldCount = 0;

for (const [index, row] of history.entries()) {
  if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) {
    errors.push(`row ${index}: date must be YYYY-MM-DD`);
    continue;
  }
  for (const field of fields) {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) continue;
    numericFieldCount++;
    const meta = row.fieldMeta?.[field];
    if (!meta || !meta.observedAt || !meta.fetchedAt || !meta.lastSuccessfulAt || !meta.source || !meta.sourceKind || !meta.allowedUse) {
      errors.push(`row ${row.date} field ${field}: incomplete fieldMeta`);
      continue;
    }
    if (!Number.isFinite(Date.parse(meta.observedAt)) || !Number.isFinite(Date.parse(meta.fetchedAt)) || !Number.isFinite(Date.parse(meta.lastSuccessfulAt))) {
      errors.push(`row ${row.date} field ${field}: unparseable timestamp`);
      continue;
    }
    const bucketEnd = Date.parse(`${row.date}T23:59:59.999Z`);
    if (Date.parse(meta.observedAt) > bucketEnd) {
      errors.push(`row ${row.date} field ${field}: observedAt is after the stored date bucket`);
      continue;
    }
    observedFieldCount++;
  }
}

if (numericFieldCount === 0 || observedFieldCount !== numericFieldCount) {
  fail(`${errors.slice(0, 8).join('; ') || 'no numeric fields with complete field-level evidence'}`);
}

const data = readJson('public-data/data.json');
const lkg = mergeMacroLastKnownGood({ _source: 'fred:no-key', _failedSeries: ['pce'] }, { cpi: 3.5, _asOf_cpi: '2026-06-01', hyOAS: 2.71 });
if (lkg.cpi !== 3.5 || lkg.hyOAS !== 2.71 || !lkg._failedSeries.includes('pce')) fail(`macro LKG merge fixture failed: ${JSON.stringify(lkg)}`);
const nfp = Number(data.macro?.nfp);
if (Number.isFinite(nfp)) {
  const good = validateMarketAnalysisText(`NFP ${nfp}천명`, data);
  const bad = validateMarketAnalysisText(`NFP ${nfp}만명`, data);
  if (!good.ok || bad.ok || !bad.issues.includes('nfp-scale-mismatch')) {
    fail(`NFP semantic fixture failed: good=${JSON.stringify(good)} bad=${JSON.stringify(bad)}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  rows: history.length,
  numericFields: numericFieldCount,
  fieldEvidence: observedFieldCount,
  nfpScaleGate: Number.isFinite(nfp) ? 'PASS' : 'SKIPPED_NO_NFP'
}));
