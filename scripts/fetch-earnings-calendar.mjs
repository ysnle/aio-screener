// Weekly earnings + IPO calendar collector (server-side, Finnhub free tier).
// The browser earnings calendar (index.html loadEarningsCalendar) only renders
// when a user key exists. This producer fills public-data/earnings-calendar.json
// so keyless clients still see the coming week's schedule as reference data.
// Finnhub free: 60 calls/min. Ten calls per run (week + 8 single days of earnings, IPO) — no quota risk.
// Without FINNHUB_API_KEY the artifact is preserved with status operator-key-required.

import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = `${__dir}/..`;
const OUT = `${ROOT}/public-data/earnings-calendar.json`;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

const isoDay = (date) => date.toISOString().slice(0, 10);

async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// 2026-10-13 news audit N18: on a Saturday/Sunday (UTC) the window used to be the week that had just ended, so the
// weekend snapshot showed only past reports. The window starts at this week's Monday on a weekday and at the next
// Monday on a weekend, and runs seven days past that Monday (through the following Monday) so a Friday run already
// shows the start of the next week.
export function earningsCalendarWindow(now = new Date()) {
  const day = now.getUTCDay();
  const offset = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offset * 86400000);
  const end = new Date(monday.getTime() + 7 * 86400000);
  return { from: isoDay(monday), to: isoDay(end) };
}

// N19: the provider calendar omits some large issuers (ASML and TSM were absent in the week they reported). Large
// names that the window does not list are published as 'schedule unconfirmed' — never as "no report this week".
// The watch set comes only from official lists already in the repo: the top S&P 500 weights and the universe's
// ADR listings. No dates are inferred.
export const LARGE_CAP_WATCH_TOP_WEIGHTS = 30;
export function largeCapScheduleGaps(earningsRows = [], { sp500Rows = [], universeRows = [], top = LARGE_CAP_WATCH_TOP_WEIGHTS } = {}) {
  const norm = (sym) => String(sym || '').trim().toUpperCase().replace(/[.\/]/g, '-');
  const listed = new Set((Array.isArray(earningsRows) ? earningsRows : []).map((row) => norm(row?.symbol)).filter(Boolean));
  const byWeight = (Array.isArray(sp500Rows) ? sp500Rows : []).filter((row) => row?.sym && Number.isFinite(Number(row.weight)))
    .sort((a, b) => Number(b.weight) - Number(a.weight)).slice(0, top).map((row) => norm(row.sym));
  const adrs = (Array.isArray(universeRows) ? universeRows : []).filter((row) => row?.sym && row.index === 'ADR').map((row) => norm(row.sym));
  const watch = [...new Set([...byWeight, ...adrs])];
  const unconfirmed = watch.filter((sym) => !listed.has(sym));
  return {
    basis: `S&P 500 top ${top} by index weight + universe ADR listings`,
    watchCount: watch.length,
    listedCount: watch.length - unconfirmed.length,
    unconfirmed,
    semantics: 'unconfirmed = not listed in this provider window; the issuer may or may not report in it (schedule unconfirmed, not "no report").'
  };
}

export function earningsCalendarDays(from, to) {
  const days = [];
  for (let ms = Date.parse(`${from}T00:00:00Z`); ms <= Date.parse(`${to}T00:00:00Z`); ms += 86400000) days.push(isoDay(new Date(ms)));
  return days;
}
// One row per symbol and date; a later (day-query) row fills fields the week row left empty.
export function mergeEarningsRows(...lists) {
  const merged = new Map();
  for (const row of lists.flat()) {
    if (!row?.symbol || !row?.date) continue;
    const key = `${row.symbol}|${row.date}`;
    const prev = merged.get(key);
    merged.set(key, prev ? Object.fromEntries(Object.keys({ ...prev, ...row }).map((k) => [k, prev[k] ?? row[k]])) : row);
  }
  return [...merged.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.symbol).localeCompare(String(b.symbol)));
}

async function readJsonIf(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const now = new Date();
  const { from, to } = earningsCalendarWindow(now);
  if (!FINNHUB_KEY) {
    // This header always claimed the artifact is "preserved with status
    // operator-key-required", but the code returned without writing anything, so
    // the path never existed: every keyless client (including the browser
    // earnings panel's snapshot fallback) got a 404 (P1115). Publish an explicit
    // unavailable snapshot, and never overwrite a real one with it.
    if (previous && previous.status === 'current-reference') {
      console.warn('[earnings-calendar] skipped: FINNHUB_API_KEY is not configured; the published reference snapshot is preserved');
      return;
    }
    await atomicWriteFile(OUT, `${JSON.stringify({
      schemaVersion: 'earnings-calendar.v1',
      status: 'operator-key-required',
      source: 'Finnhub calendar/earnings + calendar/ipo',
      sourceUrl: 'https://finnhub.io/docs/api',
      sourceKind: 'licensed-api',
      allowedUse: 'reference-only',
      weekStart: from,
      weekEnd: to,
      generatedAt: new Date().toISOString(),
      earnings: [],
      ipos: []
    }, null, 1)}\n`);
    console.warn('[earnings-calendar] published an unavailable snapshot: FINNHUB_API_KEY is not configured');
    return;
  }
  const [weekRows, ipos] = await Promise.all([
    fetchJSON(`${FINNHUB_BASE}/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`).then((d) => (Array.isArray(d?.earningsCalendar) ? d.earningsCalendar : [])),
    fetchJSON(`${FINNHUB_BASE}/calendar/ipo?from=${from}&to=${to}&token=${FINNHUB_KEY}`).then((d) => (Array.isArray(d?.ipoCalendar) ? d.ipoCalendar : []))
  ]);
  // 2026-10-19 data audit: the week query came back with 526 rows and without INTC, KO, NOW, BA, CAT or SAP in their
  // reporting week — a capped response. One query per day (8 more calls, well inside 60/min) fills it; a failed day
  // keeps what the week query returned.
  const dayRows = [];
  for (const day of earningsCalendarDays(from, to)) {
    const rows = await fetchJSON(`${FINNHUB_BASE}/calendar/earnings?from=${day}&to=${day}&token=${FINNHUB_KEY}`)
      .then((d) => (Array.isArray(d?.earningsCalendar) ? d.earningsCalendar : [])).catch(() => []);
    dayRows.push(...rows);
  }
  const earnings = mergeEarningsRows(weekRows, dayRows);
  console.log(`[earnings-calendar] week query ${weekRows.length} rows, day queries ${dayRows.length}, merged ${earnings.length}`);
  const sp500 = await readJsonIf(`${ROOT}/public-data/sp500-weights.json`);
  const universe = await readJsonIf(`${ROOT}/public-data/screener-universe.json`);
  const payload = {
    schemaVersion: 'earnings-calendar.v1',
    status: 'current-reference',
    source: 'Finnhub calendar/earnings + calendar/ipo',
    sourceUrl: 'https://finnhub.io/docs/api',
    sourceKind: 'licensed-api',
    allowedUse: 'reference-only',
    weekStart: from,
    weekEnd: to,
    generatedAt: new Date().toISOString(),
    largeCapCoverage: largeCapScheduleGaps(earnings, { sp500Rows: sp500?.rows, universeRows: universe?.universe }),
    earnings: earnings.map((row) => ({
      symbol: row.symbol || null,
      date: row.date || null,
      hour: row.hour || null,
      epsEstimate: typeof row.epsEstimate === 'number' ? row.epsEstimate : null,
      revenueEstimate: typeof row.revenueEstimate === 'number' ? row.revenueEstimate : null,
      // P1382: after the report Finnhub returns the actuals; headline-only earnings news cites them.
      epsActual: typeof row.epsActual === 'number' ? row.epsActual : null,
      revenueActual: typeof row.revenueActual === 'number' ? row.revenueActual : null
    })),
    ipos: ipos.map((row) => ({
      symbol: row.symbol || null,
      date: row.date || null,
      name: row.name || null,
      exchange: row.exchange || null
    }))
  };
  await atomicWriteFile(OUT, `${JSON.stringify(payload, null, 1)}\n`);
  console.log(`[earnings-calendar] ${payload.earnings.length} earnings + ${payload.ipos.length} ipos (${from}~${to})`);
}

// Run only as a script, so the window/coverage helpers can be imported by checks without a provider call.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // v58.20 review B1: this optional reference calendar runs before the core screener step under `set -e`, so one Finnhub
  // timeout/429 used to stop the whole screener and SEC refresh for the cycle. The file is written only at the end, so a
  // failure keeps the previous one; it is annotated and the job goes on, like the other optional lanes (sp500-weights).
  main().catch((error) => { console.log(`::warning::earnings calendar not refreshed (${error?.message || error}); previous file kept`); });
}
