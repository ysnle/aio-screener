// Weekly earnings + IPO calendar collector (server-side, Finnhub free tier).
// The browser earnings calendar (index.html loadEarningsCalendar) only renders
// when a user key exists. This producer fills public-data/earnings-calendar.json
// so keyless clients still see the coming week's schedule as reference data.
// Finnhub free: 60 calls/min. Two calls per run (earnings + IPO) — no quota risk.
// Without FINNHUB_API_KEY the artifact is preserved with status operator-key-required.

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
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

async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, value);
  await rename(temp, path);
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const now = new Date();
  const monday = new Date(now.getTime() + ((1 - (now.getUTCDay() || 7)) * 86400000));
  const friday = new Date(monday.getTime() + 4 * 86400000);
  const from = isoDay(monday);
  const to = isoDay(friday);
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
    await atomicWrite(OUT, `${JSON.stringify({
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
  const [earnings, ipos] = await Promise.all([
    fetchJSON(`${FINNHUB_BASE}/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`).then((d) => (Array.isArray(d?.earningsCalendar) ? d.earningsCalendar : [])),
    fetchJSON(`${FINNHUB_BASE}/calendar/ipo?from=${from}&to=${to}&token=${FINNHUB_KEY}`).then((d) => (Array.isArray(d?.ipoCalendar) ? d.ipoCalendar : []))
  ]);
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
    earnings: earnings.map((row) => ({
      symbol: row.symbol || null,
      date: row.date || null,
      hour: row.hour || null,
      epsEstimate: typeof row.epsEstimate === 'number' ? row.epsEstimate : null,
      revenueEstimate: typeof row.revenueEstimate === 'number' ? row.revenueEstimate : null
    })),
    ipos: ipos.map((row) => ({
      symbol: row.symbol || null,
      date: row.date || null,
      name: row.name || null,
      exchange: row.exchange || null
    }))
  };
  await atomicWrite(OUT, `${JSON.stringify(payload, null, 1)}\n`);
  console.log(`[earnings-calendar] ${payload.earnings.length} earnings + ${payload.ipos.length} ipos (${from}~${to})`);
}

main().catch((error) => { console.error('[earnings-calendar] failed:', error?.message || error); process.exit(1); });
