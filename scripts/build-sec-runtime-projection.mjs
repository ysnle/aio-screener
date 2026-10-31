import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { reconcileSecRecord } from '../src/domain/fundamental/sec-report.js';
// The pure fiscal-year and quarterly series (P1436/P1446/P1627) live in a module a gate can import; this script reads
// the producer-only ledger and writes public-data at top level.
import { fiscalHistory, quarterlyHistory, FISCAL_HISTORY_FORMAT, QUARTER_FORMAT } from './lib/sec-fiscal-history.mjs';
export { compactFiscalMillions, quarterlyHistory, QUARTER_FORMAT, FISCAL_HISTORY_FORMAT, CAPITAL_YEARS } from './lib/sec-fiscal-history.mjs';
import { compactSecRecords, SEC_RECORD_DEFAULTS_POLICY } from '../src/data/contracts/sec-projection.js';

const SOURCE = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const OUTPUT = new URL('../public-data/sec-fundamentals-summary.json', import.meta.url);
const MANIFEST = new URL('../public-data/sec-fundamentals-summary.manifest.json', import.meta.url);
const FISCAL = new URL('../public-data/sec-fiscal-history.json', import.meta.url);
const canonicalText = (value) => value.replace(/\r\n?/g, '\n');
const sha256 = (value) => createHash('sha256').update(canonicalText(value)).digest('hex');
const canonicalBytes = (value) => Buffer.byteLength(canonicalText(value));

// P1470 (bound): the header stays pretty-printed; an object's `data` block serializes compactly
// via a one-shot placeholder so the 1 MiB public page bound keeps real headroom as the P1446-era
// records grow. Atomicity is preserved (temp file + rename, P1049).
async function writeAtomic(url, value) {
  const hasData = Object.hasOwn(value || {}, 'data');
  const serial = hasData ? { ...value, data: '@@DATA@@' } : value;
  const header = JSON.stringify(serial, null, 2).replace('"@@DATA@@"', () => JSON.stringify(value.data));
  const text = `${header}\n`;
  const temporary = new URL(`${url.pathname}.tmp`, url);
  await writeFile(temporary, text, 'utf8');
  await rename(temporary, url);
  return text;
}

// P1757: the canonical ledger is producer-only (data-store branch); a checkout without it cannot rebuild the projection.
const sourceText = await readFile(SOURCE, 'utf8').catch((error) => {
  if (error?.code === 'ENOENT') throw new Error('P1757: public-data/sec-fundamentals.json is absent; restore it first with `node scripts/sec-fundamentals-store.mjs restore`');
  throw error;
});
const source = JSON.parse(sourceText);
const usdReport = (record) => !record?.reportingCurrency || record.reportingCurrency === 'USD';
export const ISSUER_SIC_FORMAT = 'sic|SEC description (submissions sic / sicDescription)';
// Only issuers the projection ships; a code without a 3-4 digit SIC is left out.
export function issuerSicMap(issuerSic = {}, data = {}) {
  return Object.fromEntries(Object.entries(issuerSic || {}).filter(([symbol, row]) => data?.[symbol] && /^\d{3,4}$/.test(String(row?.sic || '')))
    .map(([symbol, row]) => [symbol, `${row.sic}|${String(row.description || '').replace(/[|;]/g, ' ').trim()}`]));
}
// P1449: the page projection is the shipped path. reconcileSecEquity (P1402) repairs top-level
// equity when the same filing carries a parent-company StockholdersEquity row, so the repair must
// happen here — the PIT observations that the page-side reconcile needs are stripped below.
// P1470: the 1 MiB public page bound is kept. Per-record basis fields that a consumer derives
// are trimmed when they are uniform with the artifact header — the projection's own header
// carries the same declaration, and the consumers' fallback constants equal it (deriveSecReport:
// source fallback 'SEC EDGAR companyfacts'). Fields whose consumer fallback differs from the
// per-record value (sourceTier T1_OFFICIAL, periodType used by the report, allowedUse scoping)
// are intentionally NOT trimmed, so no record silently loses its own declared basis.
const data = Object.fromEntries(Object.entries(source.data || {}).map(([symbol, record]) => {
  // 2026-10-13 F03/F05: the same revenue/shares heal the producer and the screener merge apply (idempotent).
  const reconciled = reconcileSecRecord(record); // + 2026-10-17 D1/D2/D7 earnings basis
  if (reconciled && reconciled.equityConcept === 'StockholdersEquity') delete reconciled.equityConcept; // restates the projection policy; conflict evidence stays
  delete reconciled.source; // uniform: equals the artifact header every record
  delete reconciled.model; // uniform: sec-fy-normalized-v2; unused by the page render
  // P1632: producer-side availability/PIT audit fields have no page consumer and pushed the projection
  // past its 1 MiB bound (1,055,257 B), failing the whole screener/SEC lane. The canonical artifact keeps them.
  for (const field of ['operandAvailability', 'derivedAvailability', 'accessionByField', 'transportFetchedAt', 'availabilityModel', 'reportRecency', 'normalizerVersion', 'revenueConcept', 'revenueHealedFrom']) delete reconciled[field];
  // 2026-10-21: natural growth reached 1,052,183 B and failed two screener runs. availableAt equals acceptedAt in
  // 832/837 records; it is dropped only then, and the entity provider restores it from acceptedAt on load.
  if (reconciled.availableAt && reconciled.availableAt === reconciled.acceptedAt) delete reconciled.availableAt;
  // 2026-10-17 (logic audit D1/D2): the page needs the P/E numerator's basis and end, not its audit fields (1 MiB bound);
  // an average-equity ROE is implied by equityPrior.
  if (reconciled.peEarnings) {
    const { basis, through, value, concept } = reconciled.peEarnings;
    reconciled.peEarnings = { basis, through, value, ...(concept === 'common' ? { concept } : {}) };
  }
  if (reconciled.roeBasis === 'average-equity' && reconciled.equityPrior != null) delete reconciled.roeBasis;
  // N20 (2026-10-13): recent filings ship as compact "filedAt|form|items|accession" strings (1 MiB bound).
  if (Array.isArray(reconciled.recentFilings)) {
    reconciled.recentFilings = reconciled.recentFilings.map((filing) => [filing.filedAt, filing.form, (filing.items || []).join(','), filing.accession].join('|'));
    if (!reconciled.recentFilings.length) delete reconciled.recentFilings;
  }
  const pit = reconciled?.pit && typeof reconciled.pit === 'object'
    ? Object.fromEntries(Object.entries(reconciled.pit).filter(([key]) => key !== 'observations'))
    : null;
  return [symbol, { ...reconciled, ...(pit ? { pit } : {}) }];
}));
// v59.47: uniform per-record values are stated once (src/data/contracts/sec-projection.js); readers expand them.
const { recordDefaults, data: compactData } = compactSecRecords(data);
const projection = {
  schemaVersion: 'sec-fundamentals-runtime-summary.v1',
  sourceSchemaVersion: source.schemaVersion,
  artifactRole: 'BOUNDED_PAGE_PROJECTION',
  projectionPolicy: 'Latest normalized annual facts reconciled for parent-company equity (P1402/P1449) plus PIT coverage counters; append-only PIT observations remain producer-side and are not shipped on the interactive path. Per-record uniform source/model restated by this header are trimmed; data serializes compactly (1 MiB bound headroom, P1470).',
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
  recordDefaultsPolicy: SEC_RECORD_DEFAULTS_POLICY,
  recordDefaults,
  data: compactData
};
const projectionText = await writeAtomic(OUTPUT, projection);
const fiscal = {
  schemaVersion: 'sec-fiscal-history.v1',
  generatedAt: source.generatedAt,
  source: source.source,
  format: FISCAL_HISTORY_FORMAT,
  precision: { amountUnit: 'USD million', decimalPlaces: 3, roundingUnitUsd: 1000, sharesUnit: 'million shares', roundingUnitShares: 1000 },
  allowedUse: source.allowedUse,
  // v6 (2026-10-16): the series are USD millions, so a non-USD report (TSM TWD, ASML EUR) is left out rather than relabelled.
  data: Object.fromEntries(Object.entries(source.data || {}).filter(([, record]) => usdReport(record)).map(([symbol, record]) => [symbol, fiscalHistory(record?.pit?.observations)]).filter(([, value]) => value)),
  quarterFormat: QUARTER_FORMAT,
  quarters: Object.fromEntries(Object.entries(source.data || {}).filter(([, record]) => usdReport(record)).map(([symbol, record]) => [symbol, quarterlyHistory(record?.pit?.observations)]).filter(([, value]) => value)),
  // v58.75 (persona review): the issuer's SEC industry classification for the company card's '사업·분류 근거' (~40 KB).
  issuerSicFormat: ISSUER_SIC_FORMAT,
  issuerSic: issuerSicMap(source.issuerSic, source.data)
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
