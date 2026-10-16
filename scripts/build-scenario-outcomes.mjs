#!/usr/bin/env node
// P1743: weekly producer for public-data/scenario-outcomes.json — the "past frequency" evidence line on decades of daily
// closes instead of AIO's own ~1-year record.
//   branches — for every macro branch analog (src/domain/scenarios/analogs.js BRANCH_ANALOGS): what the S&P 500 did
//              20 and 63 sessions after past, non-overlapping episodes of the same market move.
//   themes   — for every theme with a published proxy ETF (THEME_MAP .etf, else exposures.js THEME_PROXY_ETF): what the
//              ETF did over the next 63 sessions after past days in each stage (주도 지속 / 추세 속 조정 / 반등 / 약세).
// Runs only in GitHub Actions (refresh-data operator slot, skipped while the artifact is under 7 days old). On any
// fetch failure it keeps the previous artifact. Adding a branch analog or a theme proxy needs no change here.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { BRANCH_ANALOGS, analogOutcome, alignCloses, themeStateOutcomes } from '../src/domain/scenarios/analogs.js';
import { THEME_PROXY_ETF } from '../src/domain/scenarios/exposures.js';
import { loadThemeMaps } from './build-scenario-state.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public-data', 'scenario-outcomes.json');
export const SCENARIO_OUTCOMES_SCHEMA = 'scenario-outcomes.v1';
const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const REFRESH_AFTER_MS = 7 * 86400000;
const PERIOD1 = Date.UTC(1990, 0, 1) / 1000;
const MARKET = { spx: '^GSPC', tnx: '^TNX', vix: '^VIX', wti: 'CL=F', dxy: 'DX-Y.NYB' };

async function dailyCloses(symbol, minRows = 500) {
  const period2 = Math.floor(Date.now() / 1000);
  for (const host of HOSTS) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${PERIOD1}&period2=${period2}`;
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) continue;
      const result = (await response.json())?.chart?.result?.[0];
      const stamps = result?.timestamp, closes = result?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(stamps) || !Array.isArray(closes)) continue;
      const rows = [];
      for (let i = 0; i < stamps.length; i += 1) if (Number.isFinite(closes[i]) && closes[i] > 0) rows.push([new Date(stamps[i] * 1000).toISOString().slice(0, 10), closes[i]]);
      if (rows.length >= minRows) return rows;
    } catch { /* next host */ }
  }
  return [];
}

/** Pure: closes by field/symbol → the artifact body (tested by ci-scenario-guidance-fixture). */
export function buildScenarioOutcomes({ market = {}, proxies = {}, themeProxy = {} } = {}) {
  const rows = alignCloses(market);
  // ^TNX quotes the 10-year yield ×10 before 2005-ish on some feeds; values above 20 are rescaled to percent.
  for (const row of rows) if (row.tnx != null && row.tnx > 20) row.tnx /= 10;
  const branches = {};
  for (const [id, analog] of Object.entries(BRANCH_ANALOGS)) {
    const h20 = analogOutcome(rows, analog, { horizon: 20 });
    if (!h20) continue;
    const h63 = analogOutcome(rows, analog, { horizon: 63 });
    branches[id] = { ...h20, h63: h63 ? { n: h63.n, up: h63.up, median: h63.median, p25: h63.p25, p75: h63.p75, horizon: 63 } : null, label: analog.label };
  }
  const themes = {};
  for (const [themeId, symbol] of Object.entries(themeProxy)) {
    const closes = proxies[symbol];
    if (!closes?.length) continue;
    // v57.84 (owner decision): past stages on the live rule — returns less ^GSPC with the same bands (basis 'relative-banded').
    themes[themeId] = { symbol, ...themeStateOutcomes(closes, { horizon: 63, benchmark: market.spx || null }) };
  }
  return { branches, themes, from: rows[0]?.date || null, to: rows.at(-1)?.date || null };
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  if (previous?.status === 'current' && Date.now() - Date.parse(previous.generatedAt || '') < REFRESH_AFTER_MS && process.env.SCENARIO_OUTCOMES_FORCE !== '1') {
    console.log(`[scenario-outcomes] fresh (${previous.generatedAt}) — skipping`); return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const completed = (rows) => rows.filter(([date]) => date < today);
  const market = Object.fromEntries(await Promise.all(Object.entries(MARKET).map(async ([field, symbol]) => [field, completed(await dailyCloses(symbol, field === 'wti' ? 2000 : 5000))])));
  if (market.spx.length < 5000 || market.tnx.length < 5000) { console.warn(`[scenario-outcomes] insufficient history spx=${market.spx.length} tnx=${market.tnx.length} — artifact unchanged`); return; }
  const { usThemes } = loadThemeMaps(ROOT);
  const themeProxy = { ...THEME_PROXY_ETF, ...Object.fromEntries(usThemes.filter((theme) => theme?.etf).map((theme) => [theme.id, theme.etf])) };
  const proxies = {};
  for (const symbol of new Set(Object.values(themeProxy))) proxies[symbol] = completed(await dailyCloses(symbol, 300));
  const body = buildScenarioOutcomes({ market, proxies, themeProxy });
  const payload = { schemaVersion: SCENARIO_OUTCOMES_SCHEMA, status: 'current', generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance 일봉 종가 (^GSPC, ^TNX, ^VIX, CL=F, DX-Y.NYB, 테마 대표 ETF)', sourceKind: 'T3_PUBLIC_DELAYED', sourceLabel: '장기 일봉 기록',
    returnBasis: '가격 수익률(배당 제외), 거래일 기준 · 겹치지 않는 표본', ...body };
  await atomicWriteFile(OUT, JSON.stringify(payload));
  console.log(`[scenario-outcomes] ${body.from}~${body.to} · branches ${Object.keys(body.branches).length} · themes ${Object.keys(body.themes).length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[scenario-outcomes] ${error?.message || error}`); process.exitCode = 0; });
}
