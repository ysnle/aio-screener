// Weekly earnings + IPO calendar collector (server-side, Finnhub free tier).
// The browser earnings calendar (index.html loadEarningsCalendar) only renders
// when a user key exists. This producer fills public-data/earnings-calendar.json
// so keyless clients still see the coming week's schedule as reference data.
// Finnhub free: 60 calls/min. Eleven calls per run (week + 9 single days of earnings, IPO), then ~25 paced weekday calls
// for the next weeks' universe dates (v58.75, ~1.1 s apart) — inside the quota.
// Without FINNHUB_API_KEY the artifact is preserved with status operator-key-required.

import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { createSecClient, requireSecUserAgent } from './lib/sec-edgar.mjs';
import { SEC_TICKERS_URL, submissionsUrl, tickerCikMap, filingRowsWithItems, isResultsFiling } from './lib/sec-results-filings.mjs';
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

// v59.42 (owner audit 2026-10-28): META read 'unconfirmed' in the week after it had reported. A second free official
// source settles the gap: an 8-K with Item 2.02 (Results of Operations) on EDGAR in the 45 days before the window means
// the quarter is already out, so the name moves to `recentlyReported` with that filing. The rest stay unconfirmed with
// the reason. Foreign issuers file 6-K without item numbers, so they are not settled this way.
export const RECENT_REPORT_DAYS = 45;
export function applyReportedFilings(coverage, filingsBySymbol = {}, { from, days = RECENT_REPORT_DAYS } = {}) {
  const since = Date.parse(`${from}T00:00:00Z`) - days * 86400000;
  const recentlyReported = [];
  const unconfirmedReasons = {};
  for (const sym of coverage.unconfirmed) {
    const rows = filingsBySymbol[sym];
    const filing = Array.isArray(rows) ? rows.filter((row) => isResultsFiling(row) && Date.parse(row.filingDate) >= since).sort((a, b) => String(b.filingDate).localeCompare(String(a.filingDate)))[0] : null;
    if (filing) recentlyReported.push({ symbol: sym, date: filing.filingDate, source: 'SEC EDGAR 8-K Item 2.02', accession: filing.accession });
    else unconfirmedReasons[sym] = Array.isArray(rows) ? 'not in the provider window and no results 8-K in the last 45 days: the date is not announced yet or the provider missed it'
      : 'not in the provider window; no SEC check (foreign issuer or no CIK)';
  }
  const reported = new Set(recentlyReported.map((row) => row.symbol));
  return { ...coverage, unconfirmed: coverage.unconfirmed.filter((sym) => !reported.has(sym)), recentlyReported, unconfirmedReasons,
    secCheck: { source: 'SEC EDGAR submissions (8-K Item 2.02)', lookbackDays: days } };
}

async function withSecReportedCheck(coverage, { from }) {
  let userAgent;
  try { userAgent = requireSecUserAgent(); } catch { return { ...coverage, secCheck: { status: 'operator_configuration_required: SEC_USER_AGENT' } }; }
  try {
    const sec = createSecClient({ userAgent });
    const ciks = tickerCikMap(await sec.json(SEC_TICKERS_URL));
    const filingsBySymbol = {};
    for (const sym of coverage.unconfirmed) {
      const cik = ciks.get(sym) || ciks.get(sym.replace(/-/g, '.'));
      if (cik) filingsBySymbol[sym] = filingRowsWithItems(await sec.json(submissionsUrl(cik)));
    }
    return applyReportedFilings(coverage, filingsBySymbol, { from });
  } catch (error) {
    console.log(`::warning::earnings calendar SEC check skipped (${error?.message || error})`);
    return { ...coverage, secCheck: { status: 'error' } };
  }
}

// v58.75 (persona review): the stock page asks "when is the next report?" and the week window answered only for names
// reporting in the next 8 days. The same endpoint takes any from/to range (the week and day queries above already use it),
// so the weekdays after the week window up to UPCOMING_WEEKS weeks from its Monday are read one day at a time (the week
// query was found capped) — ~25 more calls paced under Finnhub's 60/min free limit — and only universe listings are kept,
// as one compact map { SYM: "YYYY-MM-DD|hour" } (earliest date from the window start), ~15 KB. A day that fails is listed in
// upcomingGaps, so a missing symbol never reads as "no report". No date is inferred.
export const UPCOMING_WEEKS = 6;
export const UPCOMING_PAUSE_MS = 1100;
export function upcomingCalendarDays(weekEnd, monday, weeks = UPCOMING_WEEKS) {
  const end = isoDay(new Date(Date.parse(`${monday}T00:00:00Z`) + (weeks * 7 - 1) * 86400000));
  const start = isoDay(new Date(Date.parse(`${weekEnd}T00:00:00Z`) + 86400000));
  return start <= end ? earningsCalendarDays(start, end).filter((day) => ![0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())) : [];
}
export function upcomingEarningsMap(rows = [], universe = null, from = '') {
  const norm = (sym) => String(sym || '').trim().toUpperCase().replace(/[./]/g, '-');
  const keep = universe instanceof Set ? universe : null;
  const map = {};
  for (const row of [...(Array.isArray(rows) ? rows : [])].sort((a, b) => String(a?.date).localeCompare(String(b?.date)))) {
    const sym = norm(row?.symbol);
    const date = String(row?.date || '');
    if (!sym || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < from || map[sym] || (keep && !keep.has(sym))) continue;
    map[sym] = `${date}|${['bmo', 'amc', 'dmh'].includes(row?.hour) ? row.hour : ''}`;
  }
  return map;
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
    // v58.71 (pipeline audit): a failed IPO call no longer throws away the earnings week with it.
    fetchJSON(`${FINNHUB_BASE}/calendar/ipo?from=${from}&to=${to}&token=${FINNHUB_KEY}`).then((d) => (Array.isArray(d?.ipoCalendar) ? d.ipoCalendar : [])).catch(() => [])
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
  // v58.75 (persona review): the weeks after this window, one weekday per call, paced; universe listings only.
  const upcomingDays = upcomingCalendarDays(to, from);
  const upcomingRows = [];
  const upcomingGaps = [];
  for (const day of upcomingDays) {
    await new Promise((done) => setTimeout(done, UPCOMING_PAUSE_MS));
    const rows = await fetchJSON(`${FINNHUB_BASE}/calendar/earnings?from=${day}&to=${day}&token=${FINNHUB_KEY}`)
      .then((d) => (Array.isArray(d?.earningsCalendar) ? d.earningsCalendar : null)).catch(() => null);
    if (rows) upcomingRows.push(...rows); else upcomingGaps.push(day);
  }
  const universeSymbols = new Set((Array.isArray(universe?.universe) ? universe.universe : []).map((row) => String(row?.sym || '').trim().toUpperCase().replace(/[./]/g, '-')).filter((sym) => sym && !/-(KS|KQ|T|TW)$/.test(sym)));
  const upcoming = upcomingEarningsMap([...earnings, ...upcomingRows], universeSymbols.size ? universeSymbols : null, isoDay(now));
  console.log(`[earnings-calendar] upcoming ${upcomingDays.length} day queries (${upcomingGaps.length} failed), ${Object.keys(upcoming).length} universe listings dated`);
  // v58.52: S&P 500 weight per row so the briefing schedule keeps the market-moving reports (META, TSLA, NFLX) when a
  // single session carries dozens of names; the screen used to keep the first six by clock time and name.
  const indexWeightOf = new Map((Array.isArray(sp500?.rows) ? sp500.rows : []).filter((r) => r?.sym && Number.isFinite(Number(r.weight))).map((r) => [r.sym, Number(r.weight)]));
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
    largeCapCoverage: await withSecReportedCheck(largeCapScheduleGaps(earnings, { sp500Rows: sp500?.rows, universeRows: universe?.universe }), { from }),
    upcomingWindow: { from: isoDay(now), to: upcomingDays.at(-1) || to, weeks: UPCOMING_WEEKS, scope: 'screener universe (US listings)', format: 'SYM: date|hour (bmo before open, amc after close, dmh during hours, empty unknown)' },
    upcomingGaps,
    upcoming,
    earnings: earnings.map((row) => ({
      symbol: row.symbol || null,
      date: row.date || null,
      hour: row.hour || null,
      epsEstimate: typeof row.epsEstimate === 'number' ? row.epsEstimate : null,
      revenueEstimate: typeof row.revenueEstimate === 'number' ? row.revenueEstimate : null,
      indexWeight: indexWeightOf.has(row.symbol) ? indexWeightOf.get(row.symbol) : null,
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
