#!/usr/bin/env node
// Weekly producer for public-data/index-longrun.json — how large the current market fall is against long history.
// history.json starts 2025-09-30, so a screen could not say "the largest weekly fall since March 2020" or set a drawdown
// beside 2020 and 2022 without hard-coding it. This fetches daily closes as far back as Yahoo serves them for the S&P 500,
// Nasdaq-100, Philadelphia Semiconductor index and KOSPI (the history.json fields spx, ndx, sox, kospi) through
// the history producer's own helper (scripts/producer/quotes.mjs fetchHistory), and publishes only the derived tables
// (src/domain/market/indices/long-run.js): drawdown episodes of 10%+, 1/5/20-session tail moves, the running high.
// Runs only in GitHub Actions (refresh-data daily lane; weekly by design — skipped while the artifact is under 7 days old
// and its definition matches the code). An index whose fetch fails keeps its previous body; when none can be fetched the
// artifact is left unchanged. Exit code is always 0 (an auxiliary lane must not stop the market data commit).
//   --out=<path>  write there instead of public-data/index-longrun.json (a local proof run writes to a scratch path)
//   --force       rebuild even while the published copy is fresh (also INDEX_LONGRUN_FORCE=1)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { fetchHistory } from './producer/quotes.mjs';
import { INDEX_LONGRUN_SCHEMA, LONGRUN_DEFINITION, summarizeIndexHistory } from '../src/domain/market/indices/long-run.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'public-data', 'index-longrun.json');
const REFRESH_AFTER_MS = 7 * 86400000;
// Yahoo's chart answers range=max with monthly bars; a 100-year range is the longest that still returns daily bars.
const RANGE = '100y';
// field (history.json) → symbol, and the fewest sessions that count as long history (a short answer keeps the old body).
export const LONGRUN_INDEXES = Object.freeze({
  spx: { symbol: '^GSPC', minSessions: 20000 },
  // The Nasdaq-100 (daily from 1985-10), not the Composite: the opening and the diagnosis read the Nasdaq-100, and a screen
  // that names one Nasdaq compares it with its own history (owner 2026-11-23, one Nasdaq on the face).
  ndx: { symbol: '^NDX', minSessions: 9000 },
  sox: { symbol: '^SOX', minSessions: 7000 },
  kospi: { symbol: '^KS11', minSessions: 6000 },
});

const sameDefinition = (a) => JSON.stringify(a || null) === JSON.stringify(LONGRUN_DEFINITION);

export function skipRebuild(previous, nowMs = Date.now()) {
  return previous?.status === 'current' && previous.schemaVersion === INDEX_LONGRUN_SCHEMA && sameDefinition(previous.definition)
    && Object.keys(LONGRUN_INDEXES).every((id) => previous.indexes?.[id]) && nowMs - Date.parse(previous.generatedAt || '') < REFRESH_AFTER_MS;
}

/** Pure: closes by field → the artifact's `indexes` (previous bodies fill a field whose fetch failed). */
export function buildIndexes(closesByField, previous = null) {
  const keepPrevious = previous && previous.schemaVersion === INDEX_LONGRUN_SCHEMA && sameDefinition(previous.definition);
  const indexes = {};
  for (const [id, { symbol, minSessions }] of Object.entries(LONGRUN_INDEXES)) {
    const closes = closesByField[id] || [];
    const body = closes.length >= minSessions ? summarizeIndexHistory(closes) : null;
    if (body) indexes[id] = { symbol, ...body };
    else if (keepPrevious && previous.indexes?.[id]) indexes[id] = previous.indexes[id];
  }
  return indexes;
}

async function main() {
  const outArg = process.argv.find((arg) => arg.startsWith('--out='));
  const out = outArg ? path.resolve(outArg.slice(6)) : DEFAULT_OUT;
  let previous = null;
  try { previous = JSON.parse(await readFile(out, 'utf8')); } catch { /* first run */ }
  if (skipRebuild(previous) && !process.argv.includes('--force') && process.env.INDEX_LONGRUN_FORCE !== '1') {
    console.log(`[index-longrun] fresh (${previous.generatedAt}) — skipping`); return;
  }
  // The latest bar may be today's unfinished session; the tables use completed closes only.
  const today = new Date().toISOString().slice(0, 10);
  const closesByField = {};
  const counts = [];
  for (const [id, { symbol }] of Object.entries(LONGRUN_INDEXES)) {
    const rows = await fetchHistory(symbol, RANGE);
    const daily = rows.length && rows.every((row) => row.timeframe === '1d');
    closesByField[id] = daily ? rows.filter((row) => row.date < today).map((row) => [row.date, row.close]) : [];
    counts.push(`${id}=${closesByField[id].length}${daily || !rows.length ? '' : `(${rows[0]?.timeframe} bars refused)`}`);
  }
  const indexes = buildIndexes(closesByField, previous);
  if (!Object.keys(indexes).length) { console.warn(`[index-longrun] no long daily history (${counts.join(' ')}) — artifact unchanged`); return; }
  const payload = {
    schemaVersion: INDEX_LONGRUN_SCHEMA, status: 'current', generatedAt: new Date().toISOString(), definition: LONGRUN_DEFINITION,
    source: 'Yahoo Finance 일봉 종가 (^GSPC, ^NDX, ^SOX, ^KS11)', sourceKind: 'T3_PUBLIC_DELAYED', sourceLabel: '장기 일봉 기록',
    basis: 'close', returnBasis: '지수 종가(배당 제외, 가격 지수), 거래일 기준', indexes,
  };
  await atomicWriteFile(out, JSON.stringify(payload));
  console.log(`[index-longrun] ${Object.entries(indexes).map(([id, body]) => `${id} ${body.from}~${body.through} (${body.sessions})`).join(' · ')} · fetched ${counts.join(' ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[index-longrun] ${error?.message || error}`); process.exitCode = 0; });
}
