// v57.81: pure parts of the US exchange-listing producer (scripts/build-us-listings.mjs) — parse the Nasdaq Trader
// symbol directory, normalise symbols to the form AIO writes, join SEC CIKs, and check the publish floors.
// No network and no file writes here, so scripts/ci-us-listings-check.mjs runs the same code on a tiny canned sample.
//
// Symbol mapping (documented, exact — never fuzzy):
//   nasdaqlisted.txt `Symbol`      plain A-Z (warrants/units/rights are 5th-letter forms such as ABCDW) -> kept as is
//   otherlisted.txt `ACT Symbol`   A-Z                       -> kept as is
//                                  A-Z + "." + one letter    -> class share, dot becomes a dash (BRK.B -> BRK-B), the form
//                                                               of screener-universe.json, the Yahoo quote request and SEC
//                                  "$" (preferred), ".WS" (warrant), "#" (when issued), "+", "=", "^", multi-letter
//                                  suffixes, and single-letter suffixes whose name says unit/right/warrant -> not published
//                                  (AIO has no quote mapping for them; counted in meta.dropped)

export const US_LISTINGS_SCHEMA = 'us-listings.v1';
export const NASDAQ_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt';
export const OTHER_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
export const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
export const MIN_ROWS = 8000;
// Index members AIO's universe tags; a member missing from the official directory is a reshaped source, not a
// delisting wave. Core = S&P 500 / Nasdaq-100 / Dow; the wider US tags are listed in meta and allowed a 5% gap.
export const CORE_INDEX_TAGS = Object.freeze(['SP500', 'NASDAQ100', 'DOW', 'DOW30', 'DJIA']);
export const WIDE_INDEX_TAGS = Object.freeze(['SP400', 'NASDAQ', 'NYSE', 'RUSSELL2000', 'ETF', 'ADR']);
export const MAX_CORE_MISSES = 5;
export const MAX_WIDE_MISS_SHARE = 0.05;
// Exchange codes: Q is assigned here to nasdaqlisted rows; the rest are otherlisted.txt `Exchange` values.
// v57.81: F (NYSE Texas, e.g. ET) and M (NYSE Chicago) appeared in the first live run; an unrecognised one-letter code is
// kept under its own letter (counted in meta) instead of dropping a listed security.
export const EXCHANGE_CODES = Object.freeze({ Q: 'Nasdaq', N: 'NYSE', A: 'NYSE American', P: 'NYSE Arca', Z: 'Cboe BZX', V: 'IEX', F: 'NYSE Texas', M: 'NYSE Chicago' });
const NAME_MAX = 64;

/** Splits one pipe-delimited directory file into header-keyed records; drops the trailing "File Creation Time" line. */
export function parseSymbolDirectory(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error('empty symbol directory');
  const header = lines[0].split('|').map((cell) => cell.trim());
  let fileCreationTime = null;
  const records = [];
  for (const line of lines.slice(1)) {
    const footer = line.match(/^File Creation Time:\s*([0-9:]+)/i);
    if (footer) { fileCreationTime = footer[1]; continue; }
    const cells = line.split('|');
    records.push(Object.fromEntries(header.map((name, index) => [name, String(cells[index] ?? '').trim()])));
  }
  return { header, records, fileCreationTime };
}

/** "1015202610:02" (MMDDYYYYHH:MM, US Eastern) -> "2026-10-15". */
export function fileCreationDate(raw) {
  const match = String(raw || '').match(/^(\d{2})(\d{2})(\d{4})/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

export function cleanSecurityName(raw) {
  const name = String(raw || '')
    .replace(/\b(Common Stock|Ordinary Shares|Common Shares)\b/gi, '')
    .replace(/\s+-\s*$/, '').replace(/\s{2,}/g, ' ').trim().replace(/[\s,-]+$/, '');
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1).trimEnd()}…` : name;
}

/** Nasdaq Trader symbol -> AIO symbol, or null with the reason it is not published. */
export function normaliseListingSymbol(raw, { file, name = '' } = {}) {
  const symbol = String(raw || '').trim().toUpperCase();
  if (!symbol) return { symbol: null, reason: 'blank' };
  if (file === 'nasdaq') return /^[A-Z]{1,5}$/.test(symbol) ? { symbol } : { symbol: null, reason: 'other-form' };
  if (/^[A-Z]{1,5}$/.test(symbol)) return { symbol };
  const share = symbol.match(/^([A-Z]{1,5})\.([A-Z])$/);
  if (share) {
    if (/\b(units?|rights?|warrants?)\b/i.test(name)) return { symbol: null, reason: 'unit-right-warrant' };
    return { symbol: `${share[1]}-${share[2]}` };
  }
  if (symbol.includes('$')) return { symbol: null, reason: 'preferred' };
  if (/\.WS\b/.test(symbol)) return { symbol: null, reason: 'unit-right-warrant' };
  return { symbol: null, reason: 'other-form' };
}

const yes = (value) => String(value || '').trim().toUpperCase() === 'Y';

/** Both directory files -> sorted rows { sym, name, exch, etf }. Test issues are dropped. */
export function buildListingRows(nasdaqText, otherText) {
  const nasdaq = parseSymbolDirectory(nasdaqText);
  const other = parseSymbolDirectory(otherText);
  for (const [label, parsed, required] of [
    ['nasdaqlisted', nasdaq, ['Symbol', 'Security Name', 'Test Issue', 'ETF']],
    ['otherlisted', other, ['ACT Symbol', 'Security Name', 'Exchange', 'ETF', 'Test Issue']]
  ]) {
    const missing = required.filter((name) => !parsed.header.includes(name));
    if (missing.length) throw new Error(`${label} columns changed (missing ${missing.join(', ')}): ${parsed.header.join('|')}`);
  }
  const dropped = { testIssue: 0, duplicate: 0, preferred: 0, 'unit-right-warrant': 0, 'other-form': 0, blank: 0, unknownExchange: 0 };
  const bySymbol = new Map();
  const add = (raw, record, file, exch) => {
    if (yes(record['Test Issue'])) { dropped.testIssue += 1; return; }
    if (!/^[A-Z]$/.test(String(exch || ''))) { dropped.unknownExchange += 1; return; }
    if (!EXCHANGE_CODES[exch]) dropped.unknownExchangeKept = (dropped.unknownExchangeKept || 0) + 1;
    const { symbol, reason } = normaliseListingSymbol(raw, { file, name: record['Security Name'] });
    if (!symbol) { dropped[reason] += 1; return; }
    if (bySymbol.has(symbol)) { dropped.duplicate += 1; return; }
    bySymbol.set(symbol, { sym: symbol, name: cleanSecurityName(record['Security Name']), exch, etf: yes(record.ETF) });
  };
  for (const record of nasdaq.records) add(record.Symbol, record, 'nasdaq', 'Q');
  for (const record of other.records) add(record['ACT Symbol'], record, 'other', String(record.Exchange || '').trim().toUpperCase());
  const rows = [...bySymbol.values()].sort((a, b) => (a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0));
  return { rows, dropped, fileCreationTime: { nasdaqlisted: nasdaq.fileCreationTime, otherlisted: other.fileCreationTime } };
}

const secKey = (symbol) => String(symbol || '').trim().toUpperCase().replace(/[./]/g, '-');

/** SEC company_tickers_exchange.json ({fields, data}) -> Map(symbolKey -> 10-digit CIK). First filer per ticker wins. */
export function secCikMap(payload) {
  const fields = Array.isArray(payload?.fields) ? payload.fields : [];
  const iCik = fields.indexOf('cik');
  const iTicker = fields.indexOf('ticker');
  const iExchange = fields.indexOf('exchange');
  if (iCik < 0 || iTicker < 0 || !Array.isArray(payload?.data)) throw new Error('SEC ticker file columns changed');
  const map = new Map();
  for (const row of payload.data) {
    const key = secKey(row?.[iTicker]);
    const cik = Number(row?.[iCik]);
    if (!key || !Number.isInteger(cik) || cik <= 0 || map.has(key)) continue;
    map.set(key, { cik: String(cik).padStart(10, '0'), exchange: iExchange >= 0 ? String(row[iExchange] || '') : '' });
  }
  return map;
}

/** Adds `cik` (10-digit string or null) by exact symbol key; returns a cross-check summary for meta. */
export function joinSecCik(rows, cikMap) {
  let matched = 0;
  const out = rows.map((row) => {
    const hit = cikMap?.get(secKey(row.sym));
    if (hit) matched += 1;
    return { ...row, cik: hit ? hit.cik : null };
  });
  const listed = new Set(rows.map((row) => secKey(row.sym)));
  const secOnly = cikMap ? [...cikMap.entries()].filter(([key, value]) => /^(nasdaq|nyse|cboe)$/i.test(value.exchange) && !listed.has(key)).map(([key]) => key) : [];
  return { rows: out, summary: { matched, unmatched: rows.length - matched, secExchangeTickersNotInDirectory: secOnly.length, secOnlySample: secOnly.sort().slice(0, 20) } };
}

/** Publish floors: row count and the universe's US index members. */
export function validateListing(rows, universe = []) {
  const listed = new Set(rows.map((row) => row.sym));
  const expect = (tags) => [...new Set((Array.isArray(universe) ? universe : [])
    .filter((row) => tags.includes(String(row?.index || '').toUpperCase()))
    .map((row) => String(row?.sym || '').trim().toUpperCase())
    .filter((sym) => sym && !/\.[A-Z]{1,2}$/.test(sym)))];
  const core = expect(CORE_INDEX_TAGS);
  const wide = expect(WIDE_INDEX_TAGS);
  const coreMissing = core.filter((sym) => !listed.has(sym)).sort();
  const wideMissing = wide.filter((sym) => !listed.has(sym)).sort();
  const failures = [];
  if (rows.length <= MIN_ROWS) failures.push(`only ${rows.length} rows (floor ${MIN_ROWS})`);
  if (coreMissing.length > MAX_CORE_MISSES) failures.push(`${coreMissing.length} S&P 500/Nasdaq-100/Dow members missing (max ${MAX_CORE_MISSES}): ${coreMissing.slice(0, 20).join(', ')}`);
  if (wide.length && wideMissing.length / wide.length > MAX_WIDE_MISS_SHARE) failures.push(`${wideMissing.length}/${wide.length} other US universe symbols missing (max ${MAX_WIDE_MISS_SHARE * 100}%)`);
  return { ok: failures.length === 0, failures, coverage: { coreExpected: core.length, coreMissing, wideExpected: wide.length, wideMissing: wideMissing.slice(0, 50), wideMissingCount: wideMissing.length } };
}

/** Columnar artifact: parallel arrays keep ~12k rows small (exchange and ETF flags are one character each). */
export function buildArtifact(rows, { generatedAt, asOf, fileCreationTime, dropped, coverage, secJoin }) {
  return {
    schemaVersion: US_LISTINGS_SCHEMA,
    generatedAt,
    asOf,
    source: 'Nasdaq Trader symbol directory',
    count: rows.length,
    exchanges: EXCHANGE_CODES,
    columns: {
      sym: rows.map((row) => row.sym),
      name: rows.map((row) => row.name),
      exch: rows.map((row) => row.exch).join(''),
      etf: rows.map((row) => (row.etf ? '1' : '0')).join(''),
      cik: rows.map((row) => row.cik ?? null)
    },
    meta: { fileCreationTime, dropped, coverage, secJoin }
  };
}
