#!/usr/bin/env node
// v59.57 (X bookmarks 11/02, MrMarket89 10/27 follow-up): US Treasury note and bond auction results from TreasuryDirect's
// public auction query (keyless; two requests per run). The comparison with the same tenor's previous six auctions and
// the sentence live in src/domain/macro/treasury-auctions.js. A failed fetch leaves the artifact untouched (the previous
// rows stay); the job never fails the refresh.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { fetchJsonWithDeadline } from './lib/http-fetch.mjs';
import { buildTreasuryAuctions } from '../src/domain/macro/treasury-auctions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TREASURY_AUCTIONS_OUT = path.join(root, 'public-data', 'treasury-auctions.json');
const URL_FOR = (type) => `https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&type=${type}&days=400`;

async function fetchType(type) {
  const body = await fetchJsonWithDeadline(URL_FOR(type), { timeoutMs: 30000, init: { headers: { Accept: 'application/json', 'User-Agent': 'aio-screener (github.com/ysnle/aio-screener)' } } });
  if (!Array.isArray(body)) throw new Error('not an array');
  return body;
}

async function main() {
  const results = await Promise.all(['Note', 'Bond'].map((type) => fetchType(type).catch((error) => error)));
  const failed = results.filter((value) => value instanceof Error);
  if (failed.length === results.length) {
    console.log(`::warning::[treasury-auctions] every TreasuryDirect request failed (${failed[0].message}) — artifact unchanged`);
    return;
  }
  const previous = await readFile(TREASURY_AUCTIONS_OUT, 'utf8').then(JSON.parse).catch(() => null);
  const payload = buildTreasuryAuctions(results.filter(Array.isArray).flat());
  if (!payload.rows.length) {
    console.log('::warning::[treasury-auctions] no priced note or bond in the response — artifact unchanged');
    return;
  }
  // A one-type failure keeps the other type's previous rows (a bond outage must not erase the 20- and 30-year record).
  if (failed.length && previous?.rows?.length) {
    const kept = previous.rows.filter((row) => !payload.rows.some((fresh) => fresh.tenor === row.tenor));
    if (kept.length) Object.assign(payload, { rows: [...payload.rows, ...kept].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.tenor - b.tenor)), carried: kept.length });
    console.log(`::warning::[treasury-auctions] ${failed[0].message} — ${kept.length} previous rows kept`);
  }
  await atomicWriteFile(TREASURY_AUCTIONS_OUT, `${JSON.stringify(payload, null, 1)}\n`);
  console.log(`[treasury-auctions] ok rows=${payload.rows.length} latest=${payload.latestAuction} ${payload.summary}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.log(`::warning::[treasury-auctions] ${String(error?.message || error)} — artifact unchanged`); process.exitCode = 0; });
}
