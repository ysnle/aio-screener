#!/usr/bin/env node
// v58.55 개편 v2 (5n) 투자자별 순매수: daily net buying by investor type (개인 · 외국인 · 기관) on KOSPI/KOSDAQ.
// v59.70 (owner 2026-11-04, R6(b) "Naver로 교체"): the source moved from the Bank of Korea ECOS 802Y001 table — which
// publishes the foreign investors' figure only — to Naver Finance's index investor trend (KRX figures redistributed, the
// same request layer as scripts/fetch-kr-index-weights.mjs), which gives all three. One request per market per KRX
// session (bizdate=YYYYMMDD, 억원); only sessions missing from the published series are read, plus the last two again.
// Values are Naver's own numbers; nothing is estimated. A closed day answers all zeros and is not a session.
// Format guard: a response that does not parse, or a run that reads no session at all, keeps the previous artifact and
// marks it status 'stale' (the R5 rule then lowers its use to reference). Runs in Actions only; locally with --fixture.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { openSessionDatesBetween } from '../src/domain/market/market-calendar.js';
import { degradeAllowedUseOnStatus } from '../src/data/contracts/evidence.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KR_INVESTOR_FLOWS_OUT = path.join(root, 'public-data', 'kr-investor-flows.json');
export const KR_INVESTOR_FLOWS_SCHEMA = 'kr-investor-flows.v1';
export const KR_FLOW_KEEP_SESSIONS = 45; // the card draws the last 20; the 20-session sum needs a full window
const LOOKBACK_DAYS = 70;
const REREAD_SESSIONS = 2; // Naver can revise the latest sessions after the close
const FINAL_AFTER_KST_MIN = 18 * 60; // today's session is read only after 18:00 KST (the figures move until then)
const SOURCE = Object.freeze({
  source: 'Naver Finance 투자자별 매매동향 (한국거래소 집계)',
  sourceUrl: 'https://m.stock.naver.com/',
  sourceKind: 'T3_PUBLIC_DELAYED',
  unit: '억원',
  basis: '거래일별 순매수 금액(매수 − 매도), 코스피·코스닥 시장 전체. 한국거래소 집계를 Naver Finance가 게시',
  allowedUse: 'decision-with-daily-delay'
});

export const MARKETS = Object.freeze({ kospi: 'KOSPI', kosdaq: 'KOSDAQ' });
export const INVESTORS = Object.freeze([
  Object.freeze({ id: 'individual', label: '개인', key: 'personalValue' }),
  Object.freeze({ id: 'foreign', label: '외국인', key: 'foreignValue' }),
  Object.freeze({ id: 'institution', label: '기관', key: 'institutionalValue' })
]);

export const naverTrendUrl = (market, ymd) => `https://m.stock.naver.com/api/index/${MARKETS[market]}/trend?bizdate=${ymd}`;
const ymdOf = (date) => String(date).replace(/-/g, '');
const kstNow = (ms) => new Date(ms + 9 * 3600000);

const amount = (value) => {
  const raw = String(value ?? '').replace(/[,\s]/g, '');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return null;
  return Number(raw);
};

/**
 * One Naver trend response → { date, individual, foreign, institution } (억원), null for a closed day (all zeros), or
 * { error } when the payload is not the expected shape (a format change, not a closed day).
 */
export function parseNaverTrend(payload, expectedDate) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'not-an-object' };
  if (String(payload.bizdate || '') !== ymdOf(expectedDate)) return { error: `bizdate:${payload.bizdate ?? 'missing'}` };
  const row = { date: expectedDate };
  for (const inv of INVESTORS) {
    const value = amount(payload[inv.key]);
    if (value == null) return { error: `field:${inv.key}` };
    row[inv.id] = value;
  }
  return INVESTORS.every((inv) => row[inv.id] === 0) ? null : row;
}

/** The sessions to read this run: missing from the published series, plus the last REREAD_SESSIONS again. */
export function sessionsToRead(previous, nowMs) {
  const kst = kstNow(nowMs);
  const today = kst.toISOString().slice(0, 10);
  const from = new Date(nowMs - LOOKBACK_DAYS * 86400000 + 9 * 3600000).toISOString().slice(0, 10);
  const todayFinal = kst.getUTCHours() * 60 + kst.getUTCMinutes() >= FINAL_AFTER_KST_MIN;
  const sessions = openSessionDatesBetween(from, today, { market: 'KR' }).filter((date) => date < today || todayFinal);
  const have = new Set(Object.values(previous?.markets || {}).flatMap((m) => (m?.investors?.foreign?.series || []).map((p) => p.date)));
  const reread = new Set(sessions.slice(-REREAD_SESSIONS));
  return sessions.filter((date) => !have.has(date) || reread.has(date)).slice(-KR_FLOW_KEEP_SESSIONS);
}

/** Merged rows per market (new rows replace the same date) → the artifact payload. */
export function buildKrInvestorFlows({ rowsByMarket = {}, previous = null, errors = [], generatedAt = new Date().toISOString() } = {}) {
  const markets = {};
  let read = 0;
  for (const market of Object.keys(MARKETS)) {
    const byDate = new Map();
    const prior = previous?.markets?.[market]?.investors || {};
    for (const inv of INVESTORS) for (const point of prior[inv.id]?.series || []) {
      if (!byDate.has(point.date)) byDate.set(point.date, { date: point.date });
      byDate.get(point.date)[inv.id] = point.value;
    }
    for (const row of rowsByMarket[market] || []) { byDate.set(row.date, row); read += 1; }
    const dates = [...byDate.keys()].sort().slice(-KR_FLOW_KEEP_SESSIONS);
    if (!dates.length) continue;
    const investors = {};
    for (const inv of INVESTORS) {
      const series = dates.map((date) => byDate.get(date)).filter((row) => Number.isFinite(row?.[inv.id])).map((row) => ({ date: row.date, value: row[inv.id] }));
      if (series.length) investors[inv.id] = { label: inv.label, sourceUnit: '억원', series };
    }
    markets[market] = { investors, latestDate: dates.at(-1) };
  }
  const found = Object.keys(markets).length > 0;
  // The guard: nothing read this run (format change, every request failed) keeps the previous numbers as stale.
  const status = read > 0 ? 'ok' : found ? 'stale' : 'unavailable';
  return degradeAllowedUseOnStatus({
    schemaVersion: KR_INVESTOR_FLOWS_SCHEMA,
    generatedAt,
    status,
    ...SOURCE,
    ...(status === 'stale' ? { staleSince: previous?.staleSince || previous?.generatedAt || null, staleReason: errors[0] || 'no-session-read' } : {}),
    markets,
    missingInvestors: INVESTORS.filter((inv) => !Object.values(markets).some((m) => m.investors[inv.id])).map((inv) => inv.id),
    errors: errors.slice(0, 10)
  });
}

/** No numbers: the file exists before the first collection so the page asks for it without a 404, and says 수집 전. */
export function pendingKrInvestorFlows(reason = 'awaiting-first-collection', generatedAt = new Date().toISOString()) {
  return { schemaVersion: KR_INVESTOR_FLOWS_SCHEMA, generatedAt, status: 'not-collected', reason, ...SOURCE, markets: {}, missingInvestors: INVESTORS.map((inv) => inv.id), errors: [] };
}

/** Read every due session through `fetchImpl` (the kr-index-weights request layer: same header and timeout). */
export async function readSessions(dates, fetchImpl, { pauseMs = 250 } = {}) {
  const rowsByMarket = {}; const errors = [];
  for (const market of Object.keys(MARKETS)) {
    rowsByMarket[market] = [];
    for (const date of dates) {
      try {
        const response = await fetchImpl(naverTrendUrl(market, ymdOf(date)), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener/1.0)' }, signal: AbortSignal.timeout(20000) });
        if (!response.ok) { errors.push(`${market} ${date}: HTTP ${response.status}`); continue; }
        const parsed = parseNaverTrend(await response.json().catch(() => null), date);
        if (parsed?.error) errors.push(`${market} ${date}: ${parsed.error}`);
        else if (parsed) rowsByMarket[market].push(parsed);
      } catch (error) { errors.push(`${market} ${date}: ${error?.name || 'error'}`); }
      if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
  return { rowsByMarket, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const fixture = arg('--fixture');
  const outPath = arg('--out') ? path.resolve(arg('--out')) : KR_INVESTOR_FLOWS_OUT;
  if (process.env.GITHUB_ACTIONS !== 'true' && (!fixture || outPath === KR_INVESTOR_FLOWS_OUT)) {
    console.error('[kr-flows] producers run only in GitHub Actions; locally pass --fixture <file> --out <file>');
    process.exit(2);
  }
  let previous = null;
  try { previous = JSON.parse(await readFile(KR_INVESTOR_FLOWS_OUT, 'utf8')); } catch { /* first run */ }
  // Only a Naver-era artifact with numbers is merged into (the ECOS-era file was the 수집 전 marker).
  if (!(previous?.schemaVersion === KR_INVESTOR_FLOWS_SCHEMA && String(previous.sourceUrl || '').includes('naver') && Object.keys(previous.markets || {}).length)) previous = null;
  const nowMs = Date.now();
  const dates = sessionsToRead(previous, nowMs);
  const { rowsByMarket, errors } = fixture ? JSON.parse(await readFile(path.resolve(fixture), 'utf8')) : await readSessions(dates, fetch);
  const payload = buildKrInvestorFlows({ rowsByMarket, previous, errors, generatedAt: new Date(nowMs).toISOString() });
  if (payload.status === 'unavailable') {
    if (!previous) await atomicWriteFile(outPath, JSON.stringify(pendingKrInvestorFlows('first-collection-failed')));
    console.log(`::warning::[kr-flows] no session read (${errors[0] || 'none due'}) — artifact unchanged`);
    return;
  }
  await atomicWriteFile(outPath, JSON.stringify(payload));
  const summary = Object.entries(payload.markets).map(([m, v]) => `${m}@${v.latestDate}[${Object.keys(v.investors).join(',')}]`).join(' ');
  console.log(`[kr-flows] ${payload.status} ${summary} · read ${dates.length} session(s) · ${errors.length} error(s)`);
  if (payload.status === 'stale') console.log(`::warning::[kr-flows] nothing parsed (${payload.staleReason}) — previous numbers kept as stale`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.log(`::warning::[kr-flows] ${String(error?.message || error)} — artifact unchanged`); process.exitCode = 0; });
}
