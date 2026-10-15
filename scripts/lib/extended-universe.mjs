// v57.81: membership of the extended screener universe — Russell 2000 members (the iShares IWM daily holdings file,
// the fund that tracks the index) and Nasdaq-listed common stocks (the Nasdaq Trader symbol directory). Pure parsers
// and the merge/floor/retain rule live here so the CI gate exercises them on canned samples without the network.
import { parseCsvLine } from '../fetch-sp500-weights.mjs';
import { normalizeSectorKey } from '../../src/domain/entity/stock-read.js';
import { EXTENDED_UNIVERSE_SCHEMA, MEMBERSHIP_TAGS } from '../../src/data/screener-extended.js';

export const IWM_HOLDINGS_URLS = Object.freeze([
  'https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/1467271812596.ajax?fileType=csv&fileName=IWM_holdings&dataType=fund',
  'https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/latest-holdings.csv'
]);
export const NASDAQ_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt';
export const OTHER_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
// A short or reshaped file must never replace a good membership list: the index has ~1,950-2,000 members and Nasdaq
// lists ~3,000+ common stocks. Below these floors the source is treated as failed and the previous rows are kept.
export const MEMBERSHIP_FLOORS = Object.freeze({ r2000: 1800, nasdaq: 2500 });

// Nasdaq Trader documents the security description after the issuer name ("Issuer - Warrant", "Issuer - Units",
// "Issuer - Rights", "... Series A Preferred Stock", "... Notes due 2029"). Only the description is matched, so an
// issuer called "Unit Corporation" or "Rights Holdings" is not dropped by its name.
export const NASDAQ_NON_COMMON_DESCRIPTION = /\b(?:warrants?|units?|rights?|preferred|preference shares?|notes?(?: due)?|debentures?|subordinated|trust preferred|perpetual|contingent value|cvr)\b/i;
// Fifth-character identifiers from the Nasdaq symbology (W warrant, R rights, U units) — used only when the
// description does not itself name a common/ordinary/depositary share.
const FIFTH_CHARACTER_NON_COMMON = /^[A-Z]{4}[WRU]$/;
const COMMON_DESCRIPTION = /\b(?:common|ordinary|class [a-z]\b|american depositary|depositary shares? \(|shares of beneficial interest|common shares?)/i;

export function securityDescription(name) {
  const text = String(name || '').trim();
  const index = text.lastIndexOf(' - ');
  return index >= 0 ? text.slice(index + 3).trim() : text;
}

export function issuerName(name) {
  const text = String(name || '').trim();
  const index = text.lastIndexOf(' - ');
  return (index >= 0 ? text.slice(0, index) : text).trim();
}

// Pipe-delimited directory files end with "File Creation Time: mmddyyyyhh:mm|||...". Returns rows keyed by header.
export function parsePipeDirectory(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error('empty directory file');
  const header = lines[0].split('|').map((cell) => cell.trim());
  const rows = [];
  let fileCreatedAt = null;
  for (const line of lines.slice(1)) {
    if (/^File Creation Time:/i.test(line)) {
      const match = line.match(/File Creation Time:\s*(\d{2})(\d{2})(\d{4})(\d{2}):(\d{2})/i);
      if (match) fileCreatedAt = `${match[3]}-${match[1]}-${match[2]}T${match[4]}:${match[5]}`;
      continue;
    }
    const cells = line.split('|');
    if (cells.length < header.length - 1) continue;
    rows.push(Object.fromEntries(header.map((key, index) => [key, String(cells[index] ?? '').trim()])));
  }
  return { header, rows, fileCreatedAt };
}

// Nasdaq-listed common stocks: ETF=N, Test Issue=N, NextShares≠Y, and not a warrant, unit, right, preferred or note.
// Financial Status (D deficient, E delinquent, Q bankrupt and combinations) is recorded, not used to drop a row: the
// security is still listed and traded on Nasdaq, which is the owner's membership rule. The code travels with the
// row so a reader can see it.
export function isNasdaqCommonStock(row) {
  const sym = String(row?.Symbol || '').trim().toUpperCase();
  if (!sym || !/^[A-Z][A-Z0-9]{0,5}$/.test(sym)) return false;
  if (String(row['Test Issue'] || '').toUpperCase() === 'Y') return false;
  if (String(row.ETF || '').toUpperCase() === 'Y') return false;
  if (String(row.NextShares || '').toUpperCase() === 'Y') return false;
  const description = securityDescription(row['Security Name']);
  if (NASDAQ_NON_COMMON_DESCRIPTION.test(description)) return false;
  if (FIFTH_CHARACTER_NON_COMMON.test(sym) && !COMMON_DESCRIPTION.test(description)) return false;
  return true;
}

export function parseNasdaqListed(text) {
  const { header, rows, fileCreatedAt } = parsePipeDirectory(text);
  for (const column of ['Symbol', 'Security Name', 'Test Issue', 'ETF']) {
    if (!header.includes(column)) throw new Error(`nasdaqlisted columns changed: ${header.join('|')}`);
  }
  const common = rows.filter(isNasdaqCommonStock).map((row) => ({
    sym: row.Symbol.toUpperCase(),
    name: issuerName(row['Security Name']),
    exchange: 'NASDAQ',
    marketCategory: row['Market Category'] || null,
    financialStatus: row['Financial Status'] && row['Financial Status'] !== 'N' ? row['Financial Status'] : null
  }));
  return { fileCreatedAt, listed: rows.length, rows: common };
}

// otherlisted.txt maps NYSE/NYSE American/Cboe listings; only used to resolve iShares' compact share-class tickers
// ("MOGA" → "MOG-A") and to name the exchange of a Russell member listed outside Nasdaq.
const OTHER_EXCHANGE = Object.freeze({ A: 'NYSE American', N: 'NYSE', P: 'NYSE Arca', Z: 'Cboe BZX', V: 'IEX' });
export function parseOtherListed(text) {
  const { header, rows, fileCreatedAt } = parsePipeDirectory(text);
  if (!header.includes('ACT Symbol') || !header.includes('Exchange')) throw new Error(`otherlisted columns changed: ${header.join('|')}`);
  return {
    fileCreatedAt,
    rows: rows.filter((row) => String(row['Test Issue'] || '').toUpperCase() !== 'Y').map((row) => ({
      sym: String(row['ACT Symbol'] || '').toUpperCase().replace(/\./g, '-'),
      name: issuerName(row['Security Name']),
      exchange: OTHER_EXCHANGE[row.Exchange] || row.Exchange || null,
      etf: String(row.ETF || '').toUpperCase() === 'Y'
    })).filter((row) => row.sym)
  };
}

const compactTicker = (sym) => String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// iShares writes share classes without a separator and sometimes with a space or dot; resolve through the listing
// directories (exact first, then compact form). An unresolved ticker keeps its own form.
export function resolveListedSymbol(raw, listingBySym, listingByCompact) {
  const sym = String(raw || '').toUpperCase().replace(/\s+/g, '').replace(/\./g, '-');
  if (!sym) return null;
  if (listingBySym.has(sym)) return sym;
  const compact = listingByCompact.get(compactTicker(sym));
  return compact || sym;
}

export function parseIwmHoldings(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  const asOfLine = lines.find((line) => /^Fund Holdings as of/i.test(line));
  const asOfRaw = asOfLine ? parseCsvLine(asOfLine)[1] : null;
  const asOf = asOfRaw && !Number.isNaN(Date.parse(`${asOfRaw} UTC`)) ? new Date(Date.parse(`${asOfRaw} UTC`)).toISOString().slice(0, 10) : null;
  const headerIndex = lines.findIndex((line) => /^Ticker,/i.test(line));
  if (headerIndex < 0) throw new Error('IWM holdings header row not found');
  const header = parseCsvLine(lines[headerIndex]);
  const col = (name) => header.findIndex((item) => item.toLowerCase() === name.toLowerCase());
  const [iTicker, iName, iSector, iClass] = ['Ticker', 'Name', 'Sector', 'Asset Class'].map(col);
  const iExchange = col('Exchange');
  if ([iTicker, iName, iSector, iClass].some((index) => index < 0)) throw new Error(`IWM holdings columns changed: ${header.join('|')}`);
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || /^\W*$/.test(line)) continue;
    const cells = parseCsvLine(line);
    if (cells.length < header.length - 2) break; // footer disclaimer
    // Equity rows only: cash, futures and money-market sweep rows are the fund's plumbing, not index members.
    if (String(cells[iClass]).trim().toLowerCase() !== 'equity') continue;
    const exchange = iExchange >= 0 ? String(cells[iExchange] || '').trim() : '';
    // A delisted holding kept for a pending distribution (rights, CVRs) is reported with no market.
    if (/no market|unlisted/i.test(exchange)) continue;
    const ticker = String(cells[iTicker] || '').trim();
    if (!ticker || ticker === '-') continue;
    rows.push({ ticker, name: String(cells[iName] || '').trim(), sector: normalizeSectorKey(cells[iSector]) || null, exchange: exchange || null });
  }
  return { asOf, rows };
}

function sourceEntry(status, extra = {}) {
  return { status, ...extra };
}

// Merge rule: each source is CURRENT when its fresh fetch parsed at or above the floor; otherwise the previous run's
// rows for that source are kept (RETAINED, with the previous as-of) and the reason is recorded. A source with neither
// is UNAVAILABLE. Core symbols are not repeated in the extended list; their tags go to coreMembership.
export function buildExtendedUniverse({ iwm = null, iwmError = null, nasdaq = null, nasdaqError = null, other = null, previous = null, coreSymbols = [], now = new Date().toISOString(), floors = MEMBERSHIP_FLOORS } = {}) {
  const core = new Set((coreSymbols || []).map((sym) => String(sym).toUpperCase()));
  const previousRows = Array.isArray(previous?.universe) ? previous.universe : [];
  const previousCore = previous?.coreMembership && typeof previous.coreMembership === 'object' ? previous.coreMembership : {};
  const previousSources = previous?.meta?.sources || {};
  const listingBySym = new Map();
  for (const row of other?.rows || []) listingBySym.set(row.sym, row);
  for (const row of nasdaq?.rows || []) listingBySym.set(row.sym, { ...row, etf: false });
  const listingByCompact = new Map([...listingBySym.keys()].map((sym) => [compactTicker(sym), sym]));

  const previousMembers = (tag) => {
    const out = new Map();
    for (const row of previousRows) if ((row.membership || []).includes(tag)) out.set(row.sym, row);
    for (const [sym, tags] of Object.entries(previousCore)) if ((tags || []).includes(tag)) out.set(sym, { sym });
    return out;
  };

  // Russell 2000
  let r2000 = new Map();
  let r2000Source;
  const iwmRows = Array.isArray(iwm?.rows) ? iwm.rows : [];
  if (!iwmError && iwmRows.length >= floors.r2000) {
    for (const row of iwmRows) {
      const sym = resolveListedSymbol(row.ticker, listingBySym, listingByCompact);
      if (!sym || r2000.has(sym)) continue;
      const listing = listingBySym.get(sym);
      r2000.set(sym, { sym, name: row.name || listing?.name || sym, sector: row.sector || null, exchange: listing?.exchange || row.exchange || null });
    }
    r2000Source = sourceEntry('CURRENT', { asOf: iwm.asOf || null, fetchedAt: now, rows: r2000.size, floor: floors.r2000 });
  } else {
    r2000 = previousMembers(MEMBERSHIP_TAGS.R2000);
    const reason = iwmError ? String(iwmError) : `parsed ${iwmRows.length} equity rows, below the ${floors.r2000} floor`;
    r2000Source = sourceEntry(r2000.size ? 'RETAINED' : 'UNAVAILABLE', { asOf: previousSources.r2000?.asOf || null, fetchedAt: previousSources.r2000?.fetchedAt || null, rows: r2000.size, floor: floors.r2000, reason });
  }

  // Nasdaq-listed common stocks
  let nasdaqRows = new Map();
  let nasdaqSource;
  const nasdaqParsed = Array.isArray(nasdaq?.rows) ? nasdaq.rows : [];
  if (!nasdaqError && nasdaqParsed.length >= floors.nasdaq) {
    for (const row of nasdaqParsed) nasdaqRows.set(row.sym, row);
    nasdaqSource = sourceEntry('CURRENT', { asOf: nasdaq.fileCreatedAt || null, fetchedAt: now, rows: nasdaqRows.size, listed: nasdaq.listed ?? null, floor: floors.nasdaq });
  } else {
    nasdaqRows = previousMembers(MEMBERSHIP_TAGS.NASDAQ);
    const reason = nasdaqError ? String(nasdaqError) : `parsed ${nasdaqParsed.length} common stocks, below the ${floors.nasdaq} floor`;
    nasdaqSource = sourceEntry(nasdaqRows.size ? 'RETAINED' : 'UNAVAILABLE', { asOf: previousSources.nasdaq?.asOf || null, fetchedAt: previousSources.nasdaq?.fetchedAt || null, rows: nasdaqRows.size, floor: floors.nasdaq, reason });
  }

  const previousBySym = new Map(previousRows.map((row) => [row.sym, row]));
  const universe = [];
  const coreMembership = {};
  for (const sym of [...new Set([...r2000.keys(), ...nasdaqRows.keys()])].sort()) {
    const membership = [
      ...(r2000.has(sym) ? [MEMBERSHIP_TAGS.R2000] : []),
      ...(nasdaqRows.has(sym) ? [MEMBERSHIP_TAGS.NASDAQ] : [])
    ];
    if (core.has(sym)) { coreMembership[sym] = membership; continue; }
    const russell = r2000.get(sym) || {};
    const listed = nasdaqRows.get(sym) || {};
    const prior = previousBySym.get(sym) || {};
    universe.push({
      sym,
      name: russell.name || listed.name || prior.name || sym,
      // GICS sector from the fund file (mapped to the screener's sector keys); a Nasdaq-only listing has none.
      sector: russell.sector || prior.sector || null,
      index: membership[0],
      membership,
      exchange: listed.exchange || russell.exchange || prior.exchange || null,
      ...(listed.financialStatus ? { nasdaqFinancialStatus: listed.financialStatus } : {})
    });
  }
  const anyUsable = [r2000Source, nasdaqSource].some((source) => source.status !== 'UNAVAILABLE');
  return {
    usable: anyUsable,
    payload: {
      schemaVersion: EXTENDED_UNIVERSE_SCHEMA,
      generatedAt: now,
      source: 'iShares Russell 2000 ETF (IWM) daily holdings + Nasdaq Trader symbol directory',
      sourceKind: 'T3_PUBLIC_DELAYED',
      allowedUse: 'reference',
      meta: {
        sources: { r2000: r2000Source, nasdaq: nasdaqSource },
        floors,
        policy: {
          r2000: 'equity rows of the IWM holdings file; cash, futures and unlisted rows dropped',
          nasdaq: 'nasdaqlisted.txt with ETF=N, Test Issue=N, NextShares≠Y; warrants, units, rights, preferreds and notes dropped by security description (fifth-character W/R/U as a secondary rule); Financial Status codes recorded, not dropped',
          retain: 'a source below its floor or failing to fetch keeps the previous run\'s rows for that source',
          core: 'symbols already in public-data/screener-universe.json stay in the core artifact; their tags are in coreMembership'
        },
        counts: {
          r2000: r2000.size,
          nasdaqCommon: nasdaqRows.size,
          union: universe.length + Object.keys(coreMembership).length,
          inCore: Object.keys(coreMembership).length,
          extended: universe.length
        }
      },
      coreMembership,
      universe
    }
  };
}
