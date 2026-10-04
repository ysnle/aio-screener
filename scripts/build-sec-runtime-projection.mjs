import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';

const SOURCE = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const OUTPUT = new URL('../public-data/sec-fundamentals-summary.json', import.meta.url);
const MANIFEST = new URL('../public-data/sec-fundamentals-summary.manifest.json', import.meta.url);
const canonicalText = (value) => value.replace(/\r\n?/g, '\n');
const sha256 = (value) => createHash('sha256').update(canonicalText(value)).digest('hex');
const canonicalBytes = (value) => Buffer.byteLength(canonicalText(value));

async function writeAtomic(url, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = new URL(`${url.pathname}.tmp`, url);
  await writeFile(temporary, text, 'utf8');
  await rename(temporary, url);
  return text;
}

const sourceText = await readFile(SOURCE, 'utf8');
const source = JSON.parse(sourceText);
// P1436 (재무 공시 redesign): the page reads a trend, not one year. Ship a compact fiscal-year series
// (at most six full years of revenue / net income / equity from 10-K FY facts of about twelve months,
// one row per period end — the latest filing wins) next to the latest facts; the append-only PIT
// observations themselves stay producer-side.
const FY_FIELDS = ['revenue', 'netIncome', 'equity'];
function fiscalHistory(observations = {}) {
  const byEnd = new Map();
  for (const field of FY_FIELDS) {
    for (const row of Array.isArray(observations[field]) ? observations[field] : []) {
      if (row?.fiscalPeriod !== 'FY' || !/^10-K/.test(String(row?.form || '')) || !Number.isFinite(row?.value) || !row.periodEnd) continue;
      if (field !== 'equity') {
        const days = (Date.parse(row.periodEnd) - Date.parse(row.periodStart || '')) / 86400000;
        if (!(days >= 330 && days <= 380)) continue;
      }
      const entry = byEnd.get(row.periodEnd) || { periodEnd: row.periodEnd, filedAt: {} };
      if (!entry.filedAt[field] || String(row.filedAt) > entry.filedAt[field]) { entry[field] = row.value; entry.filedAt[field] = String(row.filedAt || ''); }
      byEnd.set(row.periodEnd, entry);
    }
  }
  return [...byEnd.values()]
    .filter((entry) => entry.revenue != null || entry.netIncome != null)
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
    .slice(-6)
    .map(({ periodEnd, revenue = null, netIncome = null, equity = null }) => ({ periodEnd, revenue, netIncome, equity }));
}
const data = Object.fromEntries(Object.entries(source.data || {}).map(([symbol, record]) => {
  const pit = record?.pit && typeof record.pit === 'object'
    ? Object.fromEntries(Object.entries(record.pit).filter(([key]) => key !== 'observations'))
    : null;
  const history = fiscalHistory(record?.pit?.observations);
  return [symbol, { ...record, ...(pit ? { pit } : {}), ...(history.length ? { fiscalHistory: history } : {}) }];
}));
const projection = {
  schemaVersion: 'sec-fundamentals-runtime-summary.v1',
  sourceSchemaVersion: source.schemaVersion,
  artifactRole: 'BOUNDED_PAGE_PROJECTION',
  projectionPolicy: 'Latest normalized annual facts plus PIT coverage counters; append-only PIT observations remain producer-side and are not shipped on the interactive path.',
  generatedAt: source.generatedAt,
  source: source.source,
  sourceUrl: source.sourceUrl,
  licenseClass: source.licenseClass,
  allowedUse: source.allowedUse,
  model: source.model,
  eligible: source.eligible,
  stored: source.stored,
  // P1169 (17 작업 단위 1 / 06 O06): the domain receipt is small and is the only place the runtime
  // consumer can tell "this batch updated rows" from "the file was rewritten", so it is forwarded
  // instead of being dropped with the failure ledger.
  domainReceipt: source.domainReceipt || null,
  data
};
const projectionText = await writeAtomic(OUTPUT, projection);
const manifest = {
  schemaVersion: 'runtime-projection-manifest.v1',
  logicalArtifact: 'public-data/sec-fundamentals.json',
  runtimeArtifact: 'public-data/sec-fundamentals-summary.json',
  artifactRole: projection.artifactRole,
  sourceSha256: sha256(sourceText),
  runtimeSha256: sha256(projectionText),
  sourceBytes: canonicalBytes(sourceText),
  runtimeBytes: canonicalBytes(projectionText),
  records: Object.keys(data).length,
  generatedAt: projection.generatedAt
};
await writeAtomic(MANIFEST, manifest);
console.log(JSON.stringify({ ok: true, ...manifest }));
