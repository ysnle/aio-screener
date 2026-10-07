// P1507 (owner materials 2026-10-07): institutional positioning in index and rate futures. A Goldman note the owner
// saved read asset managers' S&P 500 futures positioning at the 77th percentile of two years and called room for further
// selling. The same series is public: the CFTC Traders in Financial Futures report (futures only), released each Friday
// for the Tuesday before. This producer keeps three years of weekly rows for three contracts and the two groups that
// matter for direction — asset managers (pensions, mutual funds: slow, mostly long) and leveraged funds (hedge funds,
// CTAs: fast, often short) — and records where the latest net position sits in its own two-year range.
// Runs in Actions only. On failure the previous artifact is kept with its status, never replaced by an empty one.

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = `${dirname(fileURLToPath(import.meta.url))}/..`;
const OUT = `${ROOT}/public-data/cftc-positioning.json`;
const API = 'https://publicreporting.cftc.gov/resource/gpe5-46if.json';
const SOURCE_URL = 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm';
export const CONTRACTS = Object.freeze([
  { code: '13874A', id: 'es', label: 'S&P 500 E-mini' },
  { code: '209742', id: 'nq', label: '나스닥 100 E-mini' },
  { code: '043602', id: 'ty', label: '미 10년 국채 선물' }
]);
const WEEKS = 160;
const PERCENTILE_WEEKS = 104;

const num = (value) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

export function percentileOf(values, value) {
  const rows = values.filter((v) => Number.isFinite(v));
  if (rows.length < 20 || !Number.isFinite(value)) return null;
  const below = rows.filter((v) => v < value).length;
  const equal = rows.filter((v) => v === value).length;
  return Math.round(((below + equal / 2) / rows.length) * 100);
}

export function summarizeContract(contract, rawRows) {
  const rows = (Array.isArray(rawRows) ? rawRows : [])
    .map((row) => ({
      date: String(row.report_date_as_yyyy_mm_dd || '').slice(0, 10),
      oi: num(row.open_interest_all),
      am: num(row.asset_mgr_positions_long) != null && num(row.asset_mgr_positions_short) != null ? num(row.asset_mgr_positions_long) - num(row.asset_mgr_positions_short) : null,
      lev: num(row.lev_money_positions_long) != null && num(row.lev_money_positions_short) != null ? num(row.lev_money_positions_long) - num(row.lev_money_positions_short) : null
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.am != null && row.lev != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return { ...contract, status: 'empty', series: '' };
  const latest = rows[rows.length - 1];
  const window = rows.slice(-PERCENTILE_WEEKS);
  const back4 = rows.length > 4 ? rows[rows.length - 5] : null;
  return {
    ...contract,
    status: 'ok',
    latest: { date: latest.date, assetManagerNet: latest.am, leveragedNet: latest.lev, openInterest: latest.oi },
    assetManagerPercentile2y: percentileOf(window.map((row) => row.am), latest.am),
    leveragedPercentile2y: percentileOf(window.map((row) => row.lev), latest.lev),
    change4w: back4 ? { assetManagerNet: latest.am - back4.am, leveragedNet: latest.lev - back4.lev } : null,
    // date:assetManagerNet:leveragedNet:openInterest; one compact string keeps the artifact small.
    seriesFormat: 'date:am:lev:oi',
    series: rows.map((row) => `${row.date}:${row.am}:${row.lev}:${row.oi ?? ''}`).join(';')
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const attemptedAt = new Date().toISOString();
  const markets = [];
  const failures = [];
  for (const contract of CONTRACTS) {
    const query = new URLSearchParams({ $where: `cftc_contract_market_code='${contract.code}'`, $order: 'report_date_as_yyyy_mm_dd DESC', $limit: String(WEEKS) });
    try {
      markets.push(summarizeContract(contract, await fetchJson(`${API}?${query}`)));
    } catch (error) {
      failures.push(`${contract.id}: ${error.message}`);
      const kept = previous?.markets?.find((row) => row.id === contract.id);
      if (kept) markets.push({ ...kept, status: 'kept-previous' });
    }
  }
  const ok = markets.some((row) => row.status === 'ok');
  if (!ok && previous) {
    await atomicWrite({ ...previous, attemptedAt, status: 'failed-kept-previous', failures });
    console.log(`[cftc] all fetches failed; previous artifact kept (${failures.join(' | ')})`);
    return;
  }
  const artifact = {
    schemaVersion: 'aio-cftc-positioning.v1',
    generatedAt: ok ? attemptedAt : previous?.generatedAt || null,
    attemptedAt,
    status: failures.length ? 'partial' : 'ok',
    source: 'CFTC Traders in Financial Futures — futures only',
    sourceUrl: SOURCE_URL,
    cadence: 'weekly (Tuesday positions, released Friday 15:30 ET)',
    groups: { assetManager: '자산운용사 (연기금·뮤추얼펀드 등)', leveraged: '레버리지 펀드 (헤지펀드·CTA 등)' },
    percentileWeeks: PERCENTILE_WEEKS,
    markets,
    failures
  };
  await atomicWrite(artifact);
  console.log(`[cftc] wrote ${markets.length} market(s); latest ${markets.map((row) => `${row.id} ${row.latest?.date || row.status}`).join(', ')}`);
}

async function atomicWrite(value) {
  await mkdir(dirname(OUT), { recursive: true });
  const temp = `${OUT}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 1)}\n`);
  await rename(temp, OUT);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.error('[cftc] failed:', error.message); process.exitCode = 0; });
}
