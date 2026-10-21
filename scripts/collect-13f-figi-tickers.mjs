#!/usr/bin/env node
// v58.56 (re-audit #4): CUSIP → ticker for the 13F rows the Masters page shows, from OpenFIGI's free mapping API.
// Runs only inside the refresh-data 13F chain (GitHub Actions, run_full_13f); never run locally.
//
//   POST https://api.openfigi.com/v3/mapping  [{ idType: 'ID_CUSIP', idValue, exchCode: 'US' }, …]
//
// Rules (no ticker guessing):
//   - only results on a US exchange (exchCode US), marketSector Equity, securityType2 "Common Stock" count;
//   - one distinct ticker → EXACT; several → AMBIGUOUS (discarded); none of that kind → NOT_COMMON; no hit → NOT_FOUND;
//   - FIGI's class separator "BRK/B" is written in the app's form "BRK-B"; any other shape is discarded.
// The cache (public-data/masters/cusip-ticker-map.json) keeps every answer with its date, so later runs ask only
// for new CUSIPs and re-ask old answers after RECHECK_DAYS. OPENFIGI_API_KEY (repository secret) is optional: it
// raises the batch size and rate limit. Any network/API failure ends the run cleanly (exit 0) and keeps the cache;
// the runtime builder then simply has fewer exact tickers.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { writeJsonIfSemanticallyChanged } from './lib/13f-semantic-hash.mjs';
import { readManagerRows } from './lib/masters-manager-store.mjs';

export const FIGI_MAP_SCHEMA = 'masters-cusip-ticker-map.v1';
export const OPENFIGI_URL = 'https://api.openfigi.com/v3/mapping';
export const PROJECTION_ROW_LIMIT = 200; // same bound as build-masters-runtime-artifacts.mjs
export const RECHECK_DAYS = Object.freeze({ EXACT: 120, AMBIGUOUS: 60, NOT_COMMON: 120, NOT_FOUND: 60, INVALID_TICKER: 60 });
const CUSIP_RE = /^[0-9A-Z]{8}[0-9]$/;
const FIGI_TICKER_RE = /^[A-Z]{1,5}(?:[/.-][A-Z]{1,2})?$/;

/** FIGI ticker → the app's symbol form, or null when it is not a plain listed-share symbol. */
export function normalizeFigiTicker(raw) {
  const ticker = String(raw || '').trim().toUpperCase();
  if (!FIGI_TICKER_RE.test(ticker)) return null;
  return ticker.replace(/[/.]/, '-');
}

/** One mapping-job result → a cache entry ({ s, t?, n? }), or null for a job error (not cached; asked again next run). */
export function classifyFigiResult(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.error) return null;
  const data = Array.isArray(result.data) ? result.data : [];
  if (!data.length) return { s: 'NOT_FOUND' };
  const common = data.filter((item) => item?.exchCode === 'US' && item?.marketSector === 'Equity' && item?.securityType2 === 'Common Stock');
  if (!common.length) return { s: 'NOT_COMMON' };
  const tickers = [...new Set(common.map((item) => String(item.ticker || '').trim().toUpperCase()).filter(Boolean))];
  if (tickers.length !== 1) return { s: 'AMBIGUOUS' };
  const ticker = normalizeFigiTicker(tickers[0]);
  if (!ticker) return { s: 'INVALID_TICKER' };
  const names = [...new Set(common.map((item) => String(item.name || '').trim()).filter(Boolean))];
  return { s: 'EXACT', t: ticker, ...(names.length === 1 ? { n: names[0] } : {}) };
}

/** The CUSIPs the page can show: every manager's top rows (summary) and its bounded projection rows. */
export function collectDisplayedCusips(holdings, rowsByManager = new Map()) {
  const ordered = [];
  const seen = new Set();
  const add = (row) => {
    const cusip = String(row?.cusipNormalized || row?.cusip || '').trim().toUpperCase();
    if (CUSIP_RE.test(cusip) && !seen.has(cusip)) { seen.add(cusip); ordered.push(cusip); }
  };
  (holdings?.holdings || []).forEach(add);
  for (const manager of holdings?.managers || []) {
    const rows = rowsByManager.get(manager.id) || { holdings: [], comparisons: [] };
    (rows.holdings || []).slice(0, PROJECTION_ROW_LIMIT).forEach(add);
    (rows.comparisons || []).slice(0, PROJECTION_ROW_LIMIT).forEach(add);
  }
  return ordered;
}

function dayDiff(fromIso, today) {
  const from = Date.parse(`${String(fromIso || '').slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(from) && Number.isFinite(to) ? Math.floor((to - from) / 86400000) : Infinity;
}

/** CUSIPs to ask this run: never asked, or older than their recheck window; capped. */
export function selectQueries(cusips, entries = {}, { today, cap }) {
  return cusips.filter((cusip) => {
    const entry = entries[cusip];
    if (!entry) return true;
    return dayDiff(entry.on, today) >= (RECHECK_DAYS[entry.s] ?? 60);
  }).slice(0, cap);
}

export function mergeEntries(entries = {}, answers = new Map(), today) {
  const next = { ...entries };
  for (const [cusip, entry] of answers) if (entry) next[cusip] = { ...entry, on: today };
  return Object.fromEntries(Object.keys(next).sort().map((key) => [key, next[key]]));
}

export function buildFigiArtifact({ entries, generatedAt, keyed, asked, answered, status }) {
  const counts = { EXACT: 0, AMBIGUOUS: 0, NOT_COMMON: 0, NOT_FOUND: 0, INVALID_TICKER: 0 };
  Object.values(entries).forEach((entry) => { if (entry?.s in counts) counts[entry.s] += 1; });
  return {
    schema: FIGI_MAP_SCHEMA,
    artifactRole: 'CUSIP_TICKER_CACHE',
    source: 'OpenFIGI /v3/mapping (idType ID_CUSIP, exchCode US)',
    sourceUrl: 'https://www.openfigi.com/api',
    generatedAt,
    status,
    policy: 'A CUSIP gets a ticker only when OpenFIGI returns exactly one US-exchange common-stock ticker for it. Ambiguous, non-common and missing answers are kept as such and never shown as tickers. The runtime builder also drops a ticker that disagrees with the reference crosswalk.',
    lastRun: { apiKey: keyed, asked, answered },
    counts,
    entries
  };
}

async function postJobs(jobs, apiKey) {
  const response = await fetch(OPENFIGI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-OPENFIGI-APIKEY': apiKey } : {}) },
    body: JSON.stringify(jobs),
    signal: AbortSignal.timeout(30_000)
  });
  if (response.status === 429) { const error = new Error('rate limited'); error.rateLimited = true; throw error; }
  if (!response.ok) throw new Error(`OpenFIGI HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body) || body.length !== jobs.length) throw new Error('OpenFIGI response does not match the jobs sent');
  return body;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const mastersDir = path.join(root, 'public-data', 'masters');
  const outFile = path.join(mastersDir, 'cusip-ticker-map.json');
  if (process.env.AIO_OPENFIGI === 'off') { console.log(JSON.stringify({ status: 'SKIPPED', reason: 'AIO_OPENFIGI=off' })); return; }
  const apiKey = String(process.env.OPENFIGI_API_KEY || '').trim();
  // Published limits: without a key 25 requests/min and 10 jobs per request; with a key 25 requests/6 s and 100 jobs.
  const batchSize = apiKey ? 100 : 10;
  const pauseMs = apiKey ? 300 : 2600;
  const cap = apiKey ? 5000 : 1000;
  const today = new Date().toISOString().slice(0, 10);

  const holdings = JSON.parse(await fs.readFile(path.join(mastersDir, 'holdings.json'), 'utf8'));
  let previous = null;
  try { previous = JSON.parse(await fs.readFile(outFile, 'utf8')); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const entries = previous?.schema === FIGI_MAP_SCHEMA ? previous.entries || {} : {};

  const rowsByManager = new Map();
  for (const manager of holdings.managers || []) {
    const embedded = (holdings.allHoldings || []).filter((row) => row.managerId === manager.id);
    if (embedded.length) { rowsByManager.set(manager.id, { holdings: embedded, comparisons: (holdings.comparisons || []).filter((row) => row.managerId === manager.id) }); continue; }
    try { rowsByManager.set(manager.id, await readManagerRows(path.join(mastersDir, 'managers'), manager.id)); } catch { /* manager without a row store: its summary rows are still collected */ }
  }
  const cusips = collectDisplayedCusips(holdings, rowsByManager);
  const queries = selectQueries(cusips, entries, { today, cap });
  const answers = new Map();
  let status = 'OK';
  for (let index = 0; index < queries.length; index += batchSize) {
    const batch = queries.slice(index, index + batchSize);
    let results;
    try {
      results = await postJobs(batch.map((cusip) => ({ idType: 'ID_CUSIP', idValue: cusip, exchCode: 'US' })), apiKey);
    } catch (error) {
      if (error.rateLimited && !answers.has('__retried')) { answers.set('__retried', null); await sleep(61_000); index -= batchSize; continue; }
      status = answers.size ? 'PARTIAL' : 'SKIPPED';
      console.log(`::warning::OpenFIGI mapping stopped (${error.message}); keeping ${answers.size} new answers and the previous cache.`);
      break;
    }
    batch.forEach((cusip, position) => answers.set(cusip, classifyFigiResult(results[position])));
    if (index + batchSize < queries.length) await sleep(pauseMs);
  }
  answers.delete('__retried');
  const answered = [...answers.values()].filter(Boolean).length;
  if (!answered) { console.log(JSON.stringify({ status, asked: queries.length, answered, cached: Object.keys(entries).length })); return; }
  const merged = mergeEntries(entries, answers, today);
  const artifact = buildFigiArtifact({ entries: merged, generatedAt: new Date().toISOString(), keyed: Boolean(apiKey), asked: queries.length, answered, status });
  await writeJsonIfSemanticallyChanged(outFile, artifact, { writer: atomicWriteFile });
  console.log(JSON.stringify({ status, displayedCusips: cusips.length, asked: queries.length, answered, counts: artifact.counts }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // A broken collector must not stop the 13F chain: the runtime builder works without this cache.
    console.log(`::warning::OpenFIGI CUSIP mapping skipped: ${error?.message || error}`);
  });
}
