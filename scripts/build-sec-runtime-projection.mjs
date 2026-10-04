import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';

const SOURCE = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const OUTPUT = new URL('../public-data/sec-fundamentals-summary.json', import.meta.url);
const MANIFEST = new URL('../public-data/sec-fundamentals-summary.manifest.json', import.meta.url);
const FISCAL = new URL('../public-data/sec-fiscal-history.json', import.meta.url);
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
// P1436 (재무 공시 redesign): the page reads a trend, not one year. A compact fiscal-year series (at most
// six full years of revenue / net income from 10-K FY facts of about twelve months, one row per period end —
// the latest filing wins) is written as its own small artifact, sec-fiscal-history.json, loaded only by the
// 재무 공시 page; the 1 MiB runtime summary stays as it was. PIT observations stay producer-side.
// P1446: the series also carries the cash chain — operating cash flow, capital spending, long-term debt —
// and the share count reported on the cover page after each fiscal year end (buybacks / dilution).
const FY_FIELDS = ['revenue', 'netIncome', 'equity', 'operatingCashFlow', 'capex', 'longTermDebt'];
const DURATION_FIELDS = new Set(['revenue', 'netIncome', 'operatingCashFlow', 'capex']);
export const FISCAL_HISTORY_FORMAT = 'periodEnd:revenue:netIncome:equity:operatingCashFlow:capex:longTermDebt:sharesMillions (USD millions)';
function fiscalHistory(observations = {}) {
  const byEnd = new Map();
  for (const field of FY_FIELDS) {
    for (const row of Array.isArray(observations[field]) ? observations[field] : []) {
      if (!/^10-K/.test(String(row?.form || '')) || !Number.isFinite(row?.value) || !row.periodEnd) continue;
      if (DURATION_FIELDS.has(field)) {
        if (row?.fiscalPeriod !== 'FY') continue;
        const days = (Date.parse(row.periodEnd) - Date.parse(row.periodStart || '')) / 86400000;
        if (!(days >= 330 && days <= 380)) continue;
      }
      const entry = byEnd.get(row.periodEnd) || { periodEnd: row.periodEnd, filedAt: {} };
      if (!entry.filedAt[field] || String(row.filedAt) > entry.filedAt[field]) { entry[field] = row.value; entry.filedAt[field] = String(row.filedAt || ''); }
      byEnd.set(row.periodEnd, entry);
    }
  }
  const shares = (Array.isArray(observations.sharesOutstanding) ? observations.sharesOutstanding : [])
    .filter((row) => Number.isFinite(row?.value) && row.periodEnd).sort((x, y) => String(x.periodEnd).localeCompare(String(y.periodEnd)));
  const sharesAfter = (end) => {
    const t = Date.parse(end);
    const hit = shares.find((row) => { const d = (Date.parse(row.periodEnd) - t) / 86400000; return d >= 0 && d <= 150; });
    return hit ? hit.value : null;
  };
  const m = (value) => (value == null ? '' : Math.round(value / 1e6));
  return [...byEnd.values()]
    .filter((entry) => entry.revenue != null || entry.netIncome != null)
    .sort((x, y) => x.periodEnd.localeCompare(y.periodEnd))
    .slice(-6)
    // One compact line per issuer (see FISCAL_HISTORY_FORMAT; empty = not reported).
    .map((entry) => [entry.periodEnd, m(entry.revenue), m(entry.netIncome), m(entry.equity), m(entry.operatingCashFlow), m(entry.capex), m(entry.longTermDebt), m(sharesAfter(entry.periodEnd))].join(':'))
    .join(';');
}
const data = Object.fromEntries(Object.entries(source.data || {}).map(([symbol, record]) => {
  const pit = record?.pit && typeof record.pit === 'object'
    ? Object.fromEntries(Object.entries(record.pit).filter(([key]) => key !== 'observations'))
    : null;
  return [symbol, { ...record, ...(pit ? { pit } : {}) }];
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
const fiscal = {
  schemaVersion: 'sec-fiscal-history.v1',
  generatedAt: source.generatedAt,
  source: source.source,
  format: FISCAL_HISTORY_FORMAT,
  allowedUse: source.allowedUse,
  data: Object.fromEntries(Object.entries(source.data || {}).map(([symbol, record]) => [symbol, fiscalHistory(record?.pit?.observations)]).filter(([, value]) => value))
};
await writeFile(new URL(`${FISCAL.pathname}.tmp`, FISCAL), `${JSON.stringify(fiscal)}
`, 'utf8');
await rename(new URL(`${FISCAL.pathname}.tmp`, FISCAL), FISCAL);
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
  // P1440: the client fetches the fiscal series only when this pointer exists (no 404 before the first run).
  fiscalHistory: { path: 'public-data/sec-fiscal-history.json', records: Object.keys(fiscal.data).length, format: FISCAL_HISTORY_FORMAT },
  generatedAt: projection.generatedAt
};
await writeAtomic(MANIFEST, manifest);
console.log(JSON.stringify({ ok: true, ...manifest }));
