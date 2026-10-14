// v57.54 (owner 2026-10-14: "PER을 향후 4개 분기 FWD로"): analyst consensus EPS for the next four fiscal quarters,
// with the last four reported quarters on the same (adjusted) basis, for the US screener universe.
// Source: the public JSON behind nasdaq.com's earnings-forecast and earnings-surprise pages (Zacks consensus).
// It is public best-effort data: allowedUse stays 'reference', it never enters a score, and every row keeps its
// own asOf. Consensus EPS excludes one-off items, so it is compared only with reported EPS on the same basis.
// R262 self-throttle: each run refreshes at most CONSENSUS_BATCH_LIMIT symbols, oldest rows first — the artifact
// itself is the cursor — and stops after a run of consecutive failures (blocked), keeping every previous row.
// Runs only in GitHub Actions (refresh-screener).
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = `${__dir}/..`;
const OUT = `${ROOT}/public-data/consensus-estimates.json`;
const BASE = 'https://api.nasdaq.com/api';
const BATCH_LIMIT = Math.max(1, Number(process.env.CONSENSUS_BATCH_LIMIT) || 240);
const PAUSE_MS = 350;
const MAX_CONSECUTIVE_FAILURES = 8;
// A symbol with no published forecast (ETF, thin coverage) is asked again only after this many days.
const NO_COVERAGE_RETRY_DAYS = 14;
const DAY_MS = 86400000;
// Same window the reader uses (src/domain/fundamental/consensus-read.js CONSENSUS_MAX_AGE_DAYS).
const KEEP_GOOD_ROW_DAYS = 21;
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

const num = (value) => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value));
// 'Oct 2026' -> '2026-10'
export function fiscalMonth(label) {
  const match = /^([A-Z][a-z]{2})\s+(\d{4})$/.exec(String(label || '').trim());
  return match && MONTHS[match[1]] ? `${match[2]}-${String(MONTHS[match[1]]).padStart(2, '0')}` : null;
}
export const nasdaqSymbol = (sym) => String(sym || '').toUpperCase().replace(/-/g, '.');

// Builds one row from the two payloads; returns null when either side cannot give four quarters.
export function buildConsensusRow(forecast, surprise, asOf) {
  const reported = (surprise?.earningsSurpriseTable?.rows || [])
    .map((row) => ({ fe: fiscalMonth(row.fiscalQtrEnd), eps: num(row.eps), reportedAt: row.dateReported || null }))
    .filter((row) => row.fe && row.eps != null)
    .sort((a, b) => b.fe.localeCompare(a.fe));
  const lastReported = reported[0]?.fe || null;
  // A quarter already reported can linger as the first forecast row for a day; it is not "ahead".
  const ahead = (forecast?.quarterlyForecast?.rows || [])
    .map((row) => ({ fe: fiscalMonth(row.fiscalEnd), eps: num(row.consensusEPSForecast), hi: num(row.highEPSForecast), lo: num(row.lowEPSForecast), n: num(row.noOfEstimates), up: num(row.up) || 0, down: num(row.down) || 0 }))
    .filter((row) => row.fe && row.eps != null && (!lastReported || row.fe > lastReported))
    .sort((a, b) => a.fe.localeCompare(b.fe))
    .slice(0, 4);
  if (ahead.length < 4 || reported.length < 4) return null;
  const sum = (rows, key) => Math.round(rows.reduce((total, row) => total + row[key], 0) * 1000) / 1000;
  const trailing = reported.slice(0, 4);
  return {
    asOf,
    fwd: { from: ahead[0].fe, to: ahead[3].fe, eps: sum(ahead, 'eps'), hi: ahead.every((r) => r.hi != null) ? sum(ahead, 'hi') : null, lo: ahead.every((r) => r.lo != null) ? sum(ahead, 'lo') : null,
      minEstimates: Math.min(...ahead.map((r) => r.n ?? 0)), up4w: ahead.reduce((t, r) => t + r.up, 0), down4w: ahead.reduce((t, r) => t + r.down, 0) },
    trailing: { from: trailing[3].fe, to: trailing[0].fe, eps: sum(trailing, 'eps'), lastReportedAt: trailing[0].reportedAt }
  };
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; aio-screener research)', Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  return body?.data ?? null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// v57.54 review: an empty answer (200 with data:null, or only the just-reported quarter ahead) must not wipe a
// good row and hide it for NO_COVERAGE_RETRY_DAYS; keep the previous row until the reader's age limit expires it.
export function nextConsensusRow(previousRow, row, asOf) {
  if (row) return row;
  const prevAt = Date.parse(previousRow?.asOf || '');
  if (previousRow && !previousRow.unavailable && Number.isFinite(prevAt) && Date.parse(asOf) - prevAt <= KEEP_GOOD_ROW_DAYS * DAY_MS) return previousRow;
  return { unavailable: true, checkedAt: asOf };
}

export function pickBatch(symbols, previousRows, now, limit) {
  const age = (sym) => {
    const row = previousRows[sym];
    if (!row) return Infinity;
    const at = Date.parse(row.asOf || row.checkedAt || '');
    if (!Number.isFinite(at)) return Infinity;
    if (row.unavailable && now - at < NO_COVERAGE_RETRY_DAYS * DAY_MS) return -1;
    return now - at;
  };
  return symbols.map((sym) => ({ sym, age: age(sym) })).filter((item) => item.age >= 0)
    .sort((a, b) => b.age - a.age || a.sym.localeCompare(b.sym)).slice(0, limit).map((item) => item.sym);
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const universe = JSON.parse(await readFile(`${ROOT}/public-data/screener-universe.json`, 'utf8'));
  const symbols = [...new Set((universe.universe || []).map((row) => String(row.sym || '').toUpperCase()).filter((sym) => sym && !/\.K[SQ]$/.test(sym)))];
  const rows = {};
  const keep = new Set(symbols);
  for (const [sym, row] of Object.entries(previous?.rows || {})) if (keep.has(sym)) rows[sym] = row;
  const now = Date.now();
  const batch = pickBatch(symbols, rows, now, BATCH_LIMIT);
  let refreshed = 0; let unavailable = 0; let kept = 0; let failed = 0; let consecutive = 0; let blocked = false;
  for (const sym of batch) {
    const code = encodeURIComponent(nasdaqSymbol(sym));
    try {
      const forecast = await getJson(`${BASE}/analyst/${code}/earnings-forecast`);
      await sleep(PAUSE_MS);
      const surprise = forecast?.quarterlyForecast ? await getJson(`${BASE}/company/${code}/earnings-surprise`) : null;
      const asOf = new Date().toISOString();
      const row = buildConsensusRow(forecast, surprise, asOf);
      const next = nextConsensusRow(rows[sym], row, asOf);
      if (row) refreshed += 1; else if (next.unavailable) unavailable += 1; else kept += 1;
      rows[sym] = next;
      consecutive = 0;
    } catch (error) {
      failed += 1; consecutive += 1;
      if (consecutive >= MAX_CONSECUTIVE_FAILURES) { blocked = true; console.warn(`::warning::consensus estimates: ${consecutive} consecutive failures (last: ${error.message}); stopping and keeping previous rows`); break; }
    }
    await sleep(PAUSE_MS);
  }
  const covered = Object.values(rows).filter((row) => row && !row.unavailable).length;
  if (!previous && covered === 0) { console.warn('::warning::consensus estimates: no row collected and no previous file; nothing written'); return; }
  const payload = {
    schemaVersion: 'consensus-estimates.v1',
    status: blocked ? 'partial-blocked' : 'current',
    generatedAt: new Date().toISOString(),
    source: 'Nasdaq earnings forecast / earnings surprise (Zacks consensus)',
    sourceUrl: 'https://www.nasdaq.com/market-activity/stocks',
    sourceKind: 'public-web-json',
    allowedUse: 'reference',
    basis: 'adjusted-eps-consensus',
    note: '향후 4개 분기 컨센서스 EPS 합과 같은 기준(조정 EPS)의 직전 4개 분기 실적 합. 점수에 쓰지 않는 참고값.',
    coverage: { universeUs: symbols.length, covered, unavailable: Object.values(rows).filter((row) => row?.unavailable).length, refreshedThisRun: refreshed, keptThisRun: kept, failedThisRun: failed },
    rows
  };
  await atomicWriteFile(OUT, `${JSON.stringify(payload)}\n`);
  console.log(`[consensus] batch=${batch.length} refreshed=${refreshed} kept=${kept} unavailable=${unavailable} failed=${failed} covered=${covered}/${symbols.length}${blocked ? ' BLOCKED' : ''}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.warn(`::warning::consensus estimates failed: ${error.message}; previous file kept`); });
}
