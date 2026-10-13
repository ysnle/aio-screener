#!/usr/bin/env node
// P1661: weekly producer for public-data/stress-outcomes.json — what the S&P 500 did 21 and 63 sessions after
// past days in each VIX band since 1990 (the VIX series starts 1990-01-02). Runs only in GitHub Actions
// (refresh-data daily operator slot, skipped while the artifact is under 7 days old). On any fetch failure it
// exits 0 and leaves the previous artifact untouched.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildStressOutcomes, STRESS_HORIZONS } from '../src/domain/signal/stress-outcomes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public-data', 'stress-outcomes.json');
const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const REFRESH_AFTER_MS = 7 * 86400000;
const PERIOD1 = Date.UTC(1990, 0, 1) / 1000;

async function dailyCloses(symbol) {
  const period2 = Math.floor(Date.now() / 1000);
  for (const host of HOSTS) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${PERIOD1}&period2=${period2}`;
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) continue;
      const result = (await response.json())?.chart?.result?.[0];
      const stamps = result?.timestamp;
      const closes = result?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(stamps) || !Array.isArray(closes)) continue;
      const rows = [];
      for (let i = 0; i < stamps.length; i += 1) {
        if (Number.isFinite(closes[i]) && closes[i] > 0) rows.push([new Date(stamps[i] * 1000).toISOString().slice(0, 10), closes[i]]);
      }
      if (rows.length > 1000) return rows;
    } catch { /* next host */ }
  }
  return [];
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  if (previous?.status === 'current' && Date.now() - Date.parse(previous.generatedAt || '') < REFRESH_AFTER_MS && process.env.STRESS_FORCE !== '1') {
    console.log(`[stress-outcomes] fresh (${previous.generatedAt}) — skipping`); return;
  }
  const [spx, vix] = await Promise.all([dailyCloses('^GSPC'), dailyCloses('^VIX')]);
  if (spx.length < 5000 || vix.length < 5000) { console.warn(`[stress-outcomes] insufficient history spx=${spx.length} vix=${vix.length} — artifact unchanged`); return; }
  // The latest bar may be today's unfinished session; outcomes use completed closes only.
  const today = new Date().toISOString().slice(0, 10);
  const completed = (rows) => rows.filter(([date]) => date < today);
  const table = buildStressOutcomes(completed(spx), completed(vix));
  const payload = { schemaVersion: 'stress-outcomes.v1', status: 'current', generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance 일봉 종가 (^GSPC, ^VIX)', sourceKind: 'T3_PUBLIC_DELAYED', horizons: STRESS_HORIZONS,
    returnBasis: 'S&P 500 가격 수익률(배당 제외), 거래일 기준', ...table };
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, JSON.stringify(payload));
  await rename(tmp, OUT);
  console.log(`[stress-outcomes] ${table.from}~${table.to} · ${table.days} days`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[stress-outcomes] ${error?.message || error}`); process.exitCode = 0; });
}
