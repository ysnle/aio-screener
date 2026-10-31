// Audit-only pure function calls and an extracted, unchanged collector mapping.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { normalizeSecCompanyFacts } from '../../src/domain/fundamental/sec-normalize.js';
import { parseSecStatements } from '../../src/domain/fundamental/sec-statements.js';
import { buildExtendedUniverse, parseNasdaqListed } from '../../scripts/lib/extended-universe.mjs';
import { composeAmendmentChain } from '../../scripts/lib/13f-compose.mjs';
import { rawHoldingRow } from '../../scripts/lib/masters-raw-rows.mjs';
const fy = val => ({ start: '2025-01-01', end: '2025-12-31', val, form: '10-K', fp: 'FY', filed: '2026-02-10', accn: '0000000001-26-000001' });
const amount = val => ({ units: { USD: [fy(val)] } });
const facts = { cik: 1, facts: { 'us-gaap': { InterestIncomeExpenseNet: amount(80), NoninterestIncome: amount(20), NetIncomeLoss: amount(10), StockholdersEquity: { units: { USD: [{ ...fy(100), start: undefined }] } } } } };
const normalized = normalizeSecCompanyFacts('X', facts, null);
const panel = parseSecStatements(facts, { symbol: 'X' });
assert.equal(normalized.revenue, 100);
assert.deepEqual(panel.revenue, []);
const nasdaq = parseNasdaqListed('Symbol|Security Name|Test Issue|ETF|Financial Status\nTEST|Test - Common Stock|N|N|N\n');
const extended = buildExtendedUniverse({ nasdaq, previous: { universe: [{ sym: 'TEST', membership: ['NASDAQ'], nasdaqFinancialStatus: 'D' }] }, floors: { nasdaq: 1, r2000: 1 }, now: '2026-10-26T00:00:00Z' });
assert.equal(extended.payload.meta.sources.nasdaq.status, 'CURRENT');
assert.equal(extended.payload.universe[0].nasdaqFinancialStatus, 'D');
const filing = (accession, isAmendment, filedAt) => ({ accession, form: isAmendment ? '13F-HR/A' : '13F-HR', isAmendment, periodOfReport: '2026-06-30', filedAt, informationTableHtml: `https://fixture.invalid/${accession}` });
const original = filing('original', false, '2026-08-01');
const added = filing('added', true, '2026-08-02');
const composed = composeAmendmentChain([
  { filing: original, cover: {}, rows: [{ cusip: '000000001', value: 1, shares: 1 }] },
  { filing: added, cover: { amendmentType: 'NEW HOLDINGS' }, rows: [{ cusip: '000000002', value: 2, shares: 2 }] }
]);
const source = fs.readFileSync('scripts/collect-13f-reference.mjs', 'utf8');
const start = source.indexOf('  const fullRows = rows.map(');
const end = source.indexOf('  const comparisonRecords =', start);
assert.ok(start >= 0 && end > start);
const sandbox = { rows: composed.rows, filing: added, manager: { id: 'fixture', cik: '1' }, rawHoldingRow, comparisonKey: row => row.cusip, normalizeCusip: value => value };
vm.runInNewContext(source.slice(start, end) + '\nglobalThis.mappedRows = fullRows;', sandbox);
assert.equal(composed.rowProvenance[0].accession, 'original');
assert.equal(sandbox.mappedRows[0].sourceUrl, added.informationTableHtml);
const result = { level: 'E2 isolated actual functions; no network/producer/product writes; collector mapping extracted unchanged, unrelated key helpers stubbed',
  bankRevenue: { normalizedRevenue: normalized.revenue, normalizedMargin: normalized.margin, panelRevenue: panel.revenue },
  financialStatusRecovery: { parsedStatus: nasdaq.rows[0].financialStatus, source: extended.payload.meta.sources.nasdaq.status, output: extended.payload.universe[0] },
  amendmentProvenance: { provenance: composed.rowProvenance, mappedRows: sandbox.mappedRows, expectedOriginalUrl: original.informationTableHtml } };
fs.writeFileSync(new URL('./pass5-reproductions.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
