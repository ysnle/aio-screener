import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeMacroLastKnownGood, parseBeaPceHtml, validateMarketAnalysisText } from './fetch-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const readText = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { throw new Error(`[history-field-time-contract] ${message}`); };

const history = readJson('public-data/history.json');
if (!Array.isArray(history) || history.length < 2) fail('history.json must contain at least two rows');
const fields = ['spx', 'nasdaq', 'dow', 'rut', 'vix', 'vvix', 'tnx', 'dxy', 'wti', 'gold', 'kospi', 'kosdaq', 'btc'];
const errors = [];
const fetchDataSource = readText('scripts/fetch-data.mjs');
if (!/regularMarketPreviousCloseObservedAt:[\s\S]{0,260}closeBars\[closeBars\.length - 1\]\.timestamp/.test(fetchDataSource)) {
  errors.push('fetch-data: previous completed close must use the current daily bar opening boundary, not the previous bar opening time');
}
let observedFieldCount = 0;
let numericFieldCount = 0;
let previousDate = null;
const ranges = {
  spx:[500,50000], nasdaq:[500,100000], dow:[2000,150000], rut:[100,10000],
  vix:[5,200], vvix:[20,400], tnx:[0,20], dxy:[50,200], wti:[1,400],
  gold:[100,20000], kospi:[300,20000], kosdaq:[100,5000], btc:[1000,2000000]
};

for (const [index, row] of history.entries()) {
  if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) {
    errors.push(`row ${index}: date must be YYYY-MM-DD`);
    continue;
  }
  if (previousDate && row.date <= previousDate) errors.push(`row ${row.date}: dates must be unique and strictly increasing`);
  previousDate = row.date;
  for (const field of fields) {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) continue;
    numericFieldCount++;
    const allowed = ranges[field];
    if (allowed && (row[field] < allowed[0] || row[field] > allowed[1])) {
      errors.push(`row ${row.date} field ${field}: value ${row[field]} outside plausibility range ${allowed.join('..')}`);
    }
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

const latest = history[history.length - 1];
if (latest?.seriesMode !== 'completed-market-cut' || !latest?.cycleEnd || !latest?.marketSnapshotRevision) {
  errors.push(`latest row ${latest?.date || 'missing'}: completed-market-cut metadata missing`);
}
for (const field of fields) {
  if (!Number.isFinite(latest?.[field])) continue;
  const meta = latest.fieldMeta?.[field] || {};
  if (meta.marketSession !== 'COMPLETED' || !['previous-completed-close','latest-completed-close'].includes(meta.valueBasis)) {
    errors.push(`latest row ${latest.date} field ${field}: session/valueBasis is not a completed close`);
  }
  if (['CURRENT_SESSION','DELAYED_IN_SESSION'].includes(meta.observedMarketSession) && meta.valueBasis !== 'previous-completed-close') {
    errors.push(`latest row ${latest.date} field ${field}: in-session observation promoted as daily close`);
  }
}

const snapshot = readJson('public-data/market-snapshot.json');
const snapshotMap = new Map((snapshot.quotes || []).map((row) => [row.instrumentId, row]));
const fieldSymbols = {
  spx:'^GSPC', nasdaq:'^IXIC', dow:'^DJI', rut:'^RUT', vix:'^VIX', tnx:'^TNX',
  dxy:'DX-Y.NYB', wti:'CL=F', gold:'GC=F', kospi:'^KS11', kosdaq:'^KQ11', btc:'BTC-USD'
};
for (const [field, symbol] of Object.entries(fieldSymbols)) {
  const quote = snapshotMap.get(symbol);
  if (!quote || !Number.isFinite(latest?.[field])) continue;
  const expected = ['CURRENT_SESSION','DELAYED_IN_SESSION'].includes(quote.session) ? Number(quote.previousValue) : Number(quote.value);
  if (Number.isFinite(expected) && Math.abs(Number(latest[field]) - expected) > 0.02) {
    errors.push(`latest row ${latest.date} field ${field}: ${latest[field]} != ${symbol} completed value ${expected} (${quote.session})`);
  }
}

if (numericFieldCount === 0 || observedFieldCount !== numericFieldCount) {
  fail(`${errors.slice(0, 8).join('; ') || 'no numeric fields with complete field-level evidence'}`);
}
if (errors.length) fail(errors.slice(0, 12).join('; '));

const data = readJson('public-data/data.json');
const beaFixture = parseBeaPceHtml(`
  <h1>Personal Income and Outlays, June 2026</h1>
  <p>EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Thursday, July 30, 2026</p>
  <p>From the preceding month, the PCE price index for June decreased 0.1 percent.
  Excluding food and energy, the PCE price index increased 0.1 percent.</p>
  <p>From the same month one year ago, the PCE price index for June increased 3.7 percent.
  Excluding food and energy, the PCE price index increased 3.3 percent from one year ago.</p>
  <p>Next release: August 26, 2026, at 8:30 a.m. EDT</p>
`, 'https://www.bea.gov/news/fixture', '2026-07-31T00:00:00Z');
if (beaFixture.values.pce !== 3.7 || beaFixture.values.corePce !== 3.3 || beaFixture.values.pceMoM !== -0.1 || beaFixture.observedAt !== '2026-06-01') {
  fail(`BEA PCE parser fixture failed: ${JSON.stringify(beaFixture)}`);
}
const lkg = mergeMacroLastKnownGood(
  { _source: 'fred:no-key', _failedSeries: ['pce'] },
  { cpi: 3.5, _asOf_cpi: '2026-06-01', _source_cpi: 'fred-official-primary', hyOAS: 2.71, _source_hyOAS: 'fred-official-public-csv' }
);
if (lkg.cpi !== 3.5 || lkg.hyOAS !== 2.71 || !lkg._failedSeries.includes('pce')
  || lkg._source_cpi !== 'last-known-good' || lkg._source_hyOAS !== 'last-known-good'
  || lkg._originSource_cpi !== 'fred-official-primary' || lkg._freshness_cpi !== 'stale-reference') {
  fail(`macro LKG merge fixture failed: ${JSON.stringify(lkg)}`);
}
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
  latestSeriesMode: latest.seriesMode,
  completedCloseFields: fields.filter((field) => Number.isFinite(latest?.[field])).length,
  nfpScaleGate: Number.isFinite(nfp) ? 'PASS' : 'SKIPPED_NO_NFP'
}));
