#!/usr/bin/env node
// v57.54: producer for public-data/market-temperature.json — per-market price temperature (src/domain/sentiment/
// market-temperature.js) for KOSPI, KOSDAQ, S&P 500, Nasdaq Composite and Nikkei 225 from long daily closes.
// Runs only in GitHub Actions (refresh-data, every full refresh, skipped while the artifact is under 4 hours old).
// A session counts only after its market has closed (fetch-data isSessionComplete), so an intraday Seoul/Tokyo print is
// never ranked as a close. Yahoo lists some KRX sessions with an empty close (2026-10-13) — for KOSPI/KOSDAQ the exchange
// daily series fetch-data already reconciles stock closes with (KR_EXCHANGE_CLOSE_SOURCE) replaces and fills the last
// ~100 sessions. A session still empty after that is dropped and listed in the market's gaps, never carried forward.
// On any fetch failure the market keeps its previous body; with no market at all the artifact is left unchanged.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { isSessionComplete, parseKrDailySeries } from './fetch-data.mjs';
import { MARKET_TEMPERATURE_SCHEMA, TEMPERATURE_MARKETS, TEMPERATURE_RULES, buildMarketTemperature } from '../src/domain/sentiment/market-temperature.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public-data', 'market-temperature.json');
const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const REFRESH_AFTER_MS = 4 * 3600000;
const PERIOD1 = Date.UTC(1990, 0, 1) / 1000;
const SEGMENT = { kospi: 'kr', kosdaq: 'kr', nikkei: 'jp', spx: 'us', nasdaq: 'us' };
const KR_EXCHANGE_SYMBOL = { kospi: 'KOSPI', kosdaq: 'KOSDAQ' };
const EXCHANGE_LOOKBACK_DAYS = 150;

async function chartRows(symbol, query) {
  for (const host of HOSTS) {
    try {
      // v58.77 (pipeline audit DATA-04): a provider that never answers must not hold the refresh job (Naver below has 12 s).
      const response = await fetch(`${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&${query}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) continue;
      const result = (await response.json())?.chart?.result?.[0];
      const stamps = result?.timestamp, closes = result?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(stamps) || !Array.isArray(closes)) continue;
      // Yahoo stamps each session at its local open; the exchange-local date is the stamp shifted by the gmtoffset.
      const offset = Number(result?.meta?.gmtoffset) || 0;
      const rows = stamps.map((stamp, i) => [new Date((stamp + offset) * 1000).toISOString().slice(0, 10), Number.isFinite(closes[i]) && closes[i] > 0 ? closes[i] : null]);
      // An empty last bar whose session the quote block says has printed its regular close (TLT 2026-10-13) takes that close.
      const meta = result?.meta || {};
      const last = rows.at(-1);
      if (last && last[1] == null && Number.isFinite(meta.regularMarketPrice) && meta.regularMarketPrice > 0 && Number.isFinite(meta.regularMarketTime)
        && new Date((meta.regularMarketTime + offset) * 1000).toISOString().slice(0, 10) === last[0]) last[1] = meta.regularMarketPrice;
      return rows;
    } catch { /* next host */ }
  }
  return [];
}

// The decades-long request sometimes lists a recent session with an empty close that a short-range request has
// (KRX and Tokyo on 2026-10-13); the short range fills those dates and nothing else.
async function dailyCloses(symbol) {
  const rows = await chartRows(symbol, `period1=${PERIOD1}&period2=${Math.floor(Date.now() / 1000)}`);
  if (rows.filter((row) => row[1] != null).length < TEMPERATURE_RULES.minRankSample + 252) return [];
  const recent = new Map((await chartRows(symbol, 'range=3mo')).filter((row) => row[1] != null));
  return rows.map(([date, close]) => [date, close ?? recent.get(date) ?? null]);
}

async function krExchangeCloses(marketId) {
  const symbol = KR_EXCHANGE_SYMBOL[marketId];
  if (!symbol) return [];
  const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
  try {
    const url = `https://api.finance.naver.com/siseJson.naver?symbol=${symbol}&requestType=1&startTime=${ymd(Date.now() - EXCHANGE_LOOKBACK_DAYS * 86400000)}&endTime=${ymd(Date.now() + 86400000)}&timeframe=day`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
    return response.ok ? parseKrDailySeries(await response.text()).map((row) => [row.date, row.close]) : [];
  } catch { return []; }
}

/** Pure: provider rows (close may be null) + exchange rows → completed sessions, oldest first, and the dates still empty. */
export function mergeSessions(rows, exchangeRows, marketId, nowMs = Date.now()) {
  const byDate = new Map();
  for (const [date, close] of rows) byDate.set(date, close);
  for (const [date, close] of exchangeRows) if (Number.isFinite(close) && close > 0) byDate.set(date, close);
  const segment = SEGMENT[marketId] || 'us';
  const sessions = [...byDate].filter(([date]) => isSessionComplete(date, segment, nowMs)).sort((a, b) => a[0].localeCompare(b[0]));
  const recentFrom = sessions.length > 100 ? sessions[sessions.length - 100][0] : '';
  return { rows: sessions.filter(([, close]) => close != null), gaps: sessions.filter(([date, close]) => close == null && date >= recentFrom).map(([date]) => date) };
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  if (previous?.status === 'current' && Date.now() - Date.parse(previous.generatedAt || '') < REFRESH_AFTER_MS && process.env.MARKET_TEMPERATURE_FORCE !== '1') {
    console.log(`[market-temperature] fresh (${previous.generatedAt}) — skipping`); return;
  }
  const markets = {};
  const failed = [];
  for (const market of TEMPERATURE_MARKETS) {
    const { rows, gaps } = mergeSessions(await dailyCloses(market.symbol), await krExchangeCloses(market.id), market.id);
    const body = buildMarketTemperature(rows);
    if (body) markets[market.id] = { label: market.label, symbol: market.symbol, region: market.region, ...body, gaps };
    else if (previous?.markets?.[market.id]) { markets[market.id] = previous.markets[market.id]; failed.push(market.id); }
    else failed.push(market.id);
  }
  if (!Object.keys(markets).length || failed.length === TEMPERATURE_MARKETS.length) { console.warn('[market-temperature] no market fetched — artifact unchanged'); return; }
  const payload = {
    schemaVersion: MARKET_TEMPERATURE_SCHEMA, status: 'current', generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance 일봉 종가 (^GSPC, ^IXIC, ^KS11, ^KQ11, ^N225) · 코스피·코스닥 최근 종가는 거래소 일봉으로 보정', sourceKind: 'T3_PUBLIC_DELAYED', sourceLabel: '장기 일봉 기록',
    allowedUse: 'reference', rules: TEMPERATURE_RULES, retained: failed,
    returnBasis: '가격 수익률(배당 제외), 거래일 기준 · 극단 구간의 첫날만 표본(21거래일 안의 재진입은 같은 구간)', markets
  };
  await atomicWriteFile(OUT, JSON.stringify(payload));
  console.log(`[market-temperature] ${Object.entries(markets).map(([id, m]) => `${id} ${m.asOf} ${m.state}${m.state !== 'none' ? `(${m.streak})` : ''}`).join(' · ')}${failed.length ? ` · retained ${failed.join(',')}` : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[market-temperature] ${error?.message || error}`); process.exitCode = 0; });
}
