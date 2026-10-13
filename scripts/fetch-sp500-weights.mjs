// S&P 500 member weights for the sector map (2026-10-13, owner: "finviz maps 같은 S&P 500 지도").
// Source: the daily holdings file of the iShares Core S&P 500 ETF (IVV), which lists every index member with
// its GICS sector and portfolio weight. Weight ≈ the member's float-adjusted share of the index, which is what
// a market map sizes by. Only ticker, name, sector and weight are kept — no per-holding price, quantity or market
// value is republished (P715: raw prices stay out of public artifacts). On any failure the previous file stays.
// Runs only in GitHub Actions (refresh-screener).
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dir}/../public-data/sp500-weights.json`;
const SOURCE_URL = 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/latest-holdings.csv';
// iShares writes share classes without the separator AIO's universe uses.
const TICKER_ALIASES = Object.freeze({ BRKB: 'BRK-B', BFB: 'BF-B' });

export function parseCsvLine(line) {
  const out = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cell); cell = ''; } else cell += ch;
  }
  out.push(cell);
  return out.map((value) => value.trim());
}

export function parseHoldings(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  const asOfLine = lines.find((line) => /^Fund Holdings as of/i.test(line));
  const asOfRaw = asOfLine ? parseCsvLine(asOfLine)[1] : null;
  const asOfDate = asOfRaw && !Number.isNaN(Date.parse(`${asOfRaw} UTC`)) ? new Date(Date.parse(`${asOfRaw} UTC`)).toISOString().slice(0, 10) : null;
  const headerIndex = lines.findIndex((line) => /^Ticker,/i.test(line));
  if (headerIndex < 0) throw new Error('holdings header row not found');
  const header = parseCsvLine(lines[headerIndex]);
  const col = (name) => header.findIndex((item) => item.toLowerCase() === name.toLowerCase());
  const [iTicker, iName, iSector, iClass, iWeight] = ['Ticker', 'Name', 'Sector', 'Asset Class', 'Weight (%)'].map(col);
  if ([iTicker, iName, iSector, iClass, iWeight].some((index) => index < 0)) throw new Error(`holdings columns changed: ${header.join('|')}`);
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || /^\W*$/.test(line)) continue;
    const cells = parseCsvLine(line);
    if (cells.length < header.length - 2) break; // footer disclaimer
    if (String(cells[iClass]).toLowerCase() !== 'equity') continue;
    const weight = Number(String(cells[iWeight]).replace(/,/g, ''));
    const raw = String(cells[iTicker]).toUpperCase().replace(/\s+/g, '');
    if (!raw || !(weight > 0)) continue;
    rows.push({ sym: TICKER_ALIASES[raw] || raw.replace('.', '-'), name: cells[iName], sector: cells[iSector], weight: Math.round(weight * 10000) / 10000 });
  }
  return { asOfDate, rows };
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(SOURCE_URL, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (aio-screener data refresh)', Accept: 'text/csv,*/*' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { asOfDate, rows } = parseHoldings(await response.text());
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    // A truncated or reshaped file must not replace a good one: the index has ~500 members summing to ~100%.
    if (rows.length < 450 || total < 90 || total > 105) throw new Error(`implausible holdings: ${rows.length} rows, ${total.toFixed(1)}% total`);
    const payload = {
      schemaVersion: 'sp500-weights.v1',
      generatedAt: new Date().toISOString(),
      asOf: asOfDate,
      source: 'iShares Core S&P 500 ETF (IVV) daily holdings',
      sourceUrl: SOURCE_URL,
      sourceKind: 'T3_PUBLIC_DELAYED',
      allowedUse: 'reference',
      basis: 'ETF portfolio weight as a proxy for the float-adjusted S&P 500 index weight; fields limited to ticker, name, GICS sector and weight',
      count: rows.length,
      totalWeight: Math.round(total * 100) / 100,
      rows: rows.sort((a, b) => b.weight - a.weight)
    };
    await atomicWriteFile(OUT, `${JSON.stringify(payload)}\n`);
    console.log(`[sp500-weights] ${rows.length} members, ${total.toFixed(2)}% total, holdings as of ${asOfDate}`);
  } catch (error) {
    console.log(`::warning::S&P 500 weights not refreshed (${error.message}); ${previous ? 'previous file kept' : 'no previous file'}`);
  } finally {
    clearTimeout(timer);
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('fetch-sp500-weights.mjs')) await main();
