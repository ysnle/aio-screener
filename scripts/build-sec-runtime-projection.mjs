import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { reconcileSecRecord, bestRevenueRowsByPeriod } from '../src/domain/fundamental/sec-report.js';
import { anchorConcept, anchorConceptRows, discreteQuarterSeries, SEC_FIELD_CONCEPT_PREFERENCE } from '../src/domain/fundamental/sec-earnings.js';

const SOURCE = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const OUTPUT = new URL('../public-data/sec-fundamentals-summary.json', import.meta.url);
const MANIFEST = new URL('../public-data/sec-fundamentals-summary.manifest.json', import.meta.url);
const FISCAL = new URL('../public-data/sec-fiscal-history.json', import.meta.url);
const canonicalText = (value) => value.replace(/\r\n?/g, '\n');
const sha256 = (value) => createHash('sha256').update(canonicalText(value)).digest('hex');
const canonicalBytes = (value) => Buffer.byteLength(canonicalText(value));

// P1627: whole-million rounding turned small profits/losses into zero and made the
// fiscal timeline disagree with the exact annual receipt. Preserve USD thousands
// in compact USD-million fields (and 1,000 shares in million-share fields).
export function compactFiscalMillions(value) {
  return value == null || !Number.isFinite(value) ? '' : Math.round(value / 1e3) / 1e3;
}

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

// Codex review 2026-10-05 (분기 추이): the last eight fiscal quarters of revenue and net income. Discrete
// three-month facts are used as filed (latest filing wins per period end). A fourth quarter is derived
// only when the fiscal year total and exactly three discrete quarters inside it exist, and is flagged 'd'.
export const QUARTER_FORMAT = 'periodEnd:revenue:netIncome:basis (USD millions; basis r=reported, d=derived FY−Q1..Q3)';
export function quarterlyHistory(observations = {}) {
  const quarters = new Map();
  for (const [field, qField, fyField] of [['revenue', 'revenueQ', 'revenue'], ['netIncome', 'netIncomeQ', 'netIncome']]) {
    // 2026-10-13 F05: revenue rows are reduced to one per period by the shared concept rule first.
    // 2026-10-17 (logic audit D6): net income keeps the concept of its latest quarter (the derived fourth quarter
    // nets a fiscal year of that same concept); another concept fills only a quarter it never reported.
    const anchor = field === 'netIncome' ? anchorConcept(observations[qField], SEC_FIELD_CONCEPT_PREFERENCE.netIncome) : null;
    const pref = anchor ? [anchor, ...SEC_FIELD_CONCEPT_PREFERENCE.netIncome] : SEC_FIELD_CONCEPT_PREFERENCE.netIncome;
    const quarterRows = field === 'revenue' ? bestRevenueRowsByPeriod(observations[qField]) : anchorConceptRows(observations[qField], pref);
    const annualRows = field === 'revenue' ? bestRevenueRowsByPeriod(observations[fyField]) : anchorConceptRows(observations[fyField], pref);
    for (const row of discreteQuarterSeries(quarterRows, annualRows)) {
      const q = quarters.get(row.periodEnd) || { periodEnd: row.periodEnd, derived: false };
      q[field] = row.value;
      if (row.derived) q.derived = true;
      quarters.set(row.periodEnd, q);
    }
  }
  const m = compactFiscalMillions;
  const rows = [...quarters.values()].filter((q) => q.revenue != null || q.netIncome != null).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)).slice(-8);
  return rows.length >= 2 ? rows.map((q) => [q.periodEnd, m(q.revenue), m(q.netIncome), q.derived ? 'd' : 'r'].join(':')).join(';') : null;
}

// P1757: the canonical ledger is producer-only (data-store branch); a checkout without it cannot rebuild the projection.
const sourceText = await readFile(SOURCE, 'utf8').catch((error) => {
  if (error?.code === 'ENOENT') throw new Error('P1757: public-data/sec-fundamentals.json is absent; restore it first with `node scripts/sec-fundamentals-store.mjs restore`');
  throw error;
});
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
const usdReport = (record) => !record?.reportingCurrency || record.reportingCurrency === 'USD';
function fiscalHistory(observations = {}) {
  const byEnd = new Map();
  for (const field of FY_FIELDS) {
    // 2026-10-13 F05: one revenue row per period by the shared concept rule (a REIT's customer-contract subtotal
    // no longer wins a same-filing tie against total revenues).
    const fieldRows = (field === 'revenue' ? bestRevenueRowsByPeriod(observations.revenue) : Array.isArray(observations[field]) ? observations[field] : []).filter((row) => {
      // P1627: the source also collects annual foreign-issuer 20-F/40-F facts.
      // Dropping their form here left ARM/BABA/NBIS/MNDY on a one-year fallback.
      if (!/^(10-K|20-F|40-F)(\/A)?$/.test(String(row?.form || '')) || !Number.isFinite(row?.value) || !row.periodEnd) return false;
      if (!DURATION_FIELDS.has(field)) return true;
      const days = (Date.parse(row.periodEnd) - Date.parse(row.periodStart || '')) / 86400000;
      return row?.fiscalPeriod === 'FY' && days >= 330 && days <= 380;
    });
    // 2026-10-17 (logic audit D6): one concept per series — the concept of the latest year — so a year-over-year read
    // never compares LongTermDebt with LongTermDebtNoncurrent or NetIncomeLoss with ProfitLoss. Equity keeps its
    // parent-first rank (P1449) and revenue its per-period rule (F05).
    const anchored = SEC_FIELD_CONCEPT_PREFERENCE[field] ? anchorConceptRows(fieldRows, SEC_FIELD_CONCEPT_PREFERENCE[field]) : fieldRows;
    for (const row of anchored) {
      const entry = byEnd.get(row.periodEnd) || { periodEnd: row.periodEnd, filedAt: {}, conceptRank: {} };
      const rowRank = row.concept === 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest' ? 1 : 0;
      const storedFiledAt = entry.filedAt[field];
      const storedRank = entry.conceptRank[field];
      // P1449: the ROE / P-B denominators need a parent-company equity series. A later
      // filing can carry only the NCI-inclusive total for a period whose parent row was
      // already filed (Agilent FY2025 did this for FY2023/FY2024 with its AOCI value),
      // so parent equity must outrank the NCI tagging across filings, not just within
      // one filing; among equal ranks the latest filedAt wins.
      let take = !storedFiledAt;
      if (field === 'equity') {
        if (storedRank != null && rowRank < storedRank) take = true;
        else if (storedRank === rowRank && String(row.filedAt) > storedFiledAt) take = true;
      } else {
        take = take || String(row.filedAt) > storedFiledAt;
      }
      if (take) {
        entry[field] = row.value; entry.filedAt[field] = String(row.filedAt || ''); entry.conceptRank[field] = rowRank;
      }
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
  const m = compactFiscalMillions;
  return [...byEnd.values()]
    .filter((entry) => entry.revenue != null || entry.netIncome != null)
    .sort((x, y) => x.periodEnd.localeCompare(y.periodEnd))
    .slice(-6)
    // One compact line per issuer (see FISCAL_HISTORY_FORMAT; empty = not reported).
    .map((entry) => [entry.periodEnd, m(entry.revenue), m(entry.netIncome), m(entry.equity), m(entry.operatingCashFlow), m(entry.capex), m(entry.longTermDebt), m(sharesAfter(entry.periodEnd))].join(':'))
    .join(';');
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
  data
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
  quarters: Object.fromEntries(Object.entries(source.data || {}).filter(([, record]) => usdReport(record)).map(([symbol, record]) => [symbol, quarterlyHistory(record?.pit?.observations)]).filter(([, value]) => value))
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
