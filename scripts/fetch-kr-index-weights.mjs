#!/usr/bin/env node
// v59.42 (owner audit 2026-10-28): KOSPI/KOSDAQ index-weight proxies for the 오늘 '한국 고유 요인' line, which names the
// largest contributors (weight × one-day return). KRX's own constituent download needs a login, so the weights come from
// Naver Finance's market-value ranking (KRX prices redistributed): every common stock of the market is read to get the
// total, preferred shares (codes not ending in 0) are left out, and only the top names' weight shares are published —
// no raw market caps. The weight is the share at the PREVIOUS close (cap / (1 + day's return)), the base an index
// contribution uses. Runs in .github/workflows/event-briefs.yml after the KRX close; locally only with --fixture.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public-data/kr-index-weights.json');
export const KR_INDEX_WEIGHTS_SCHEMA = 'kr-index-weights.v1';
const TOP = { KOSPI: 30, KOSDAQ: 20 };
const PAGE_SIZE = 100;
const MAX_PAGES = 40;

const num = (value) => { const n = Number(String(value ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const kstDate = (iso) => { const ms = Date.parse(iso || ''); return Number.isFinite(ms) ? new Date(ms + 9 * 3600000).toISOString().slice(0, 10) : null; };

/** One market's rows → { asOf, count, rows: top N { code, name, weightPct, ret1dPct } }. */
export function marketWeights(stocks, top) {
  const common = stocks.filter((row) => row?.stockEndType === 'stock' && /^\d{5}0$/.test(String(row.itemCode || '')))
    .map((row) => {
      const cap = num(row.marketValueRaw);
      const ret = num(row.fluctuationsRatio);
      return cap > 0 && ret != null && ret > -100 ? { code: row.itemCode, name: String(row.stockName || '').trim(), cap, prevCap: cap / (1 + ret / 100), ret, tradedAt: row.localTradedAt } : null;
    }).filter(Boolean);
  const total = common.reduce((sum, row) => sum + row.prevCap, 0);
  if (!(total > 0)) return null;
  const asOf = common.map((row) => kstDate(row.tradedAt)).filter(Boolean).sort().at(-1) || null;
  const rows = [...common].sort((a, b) => b.prevCap - a.prevCap).slice(0, top)
    .map((row) => ({ code: row.code, name: row.name, weightPct: Math.round((row.prevCap / total) * 10000) / 100, ret1dPct: row.ret }));
  return { asOf, count: common.length, rows };
}

async function fetchMarket(market, fetchImpl) {
  const stocks = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetchImpl(`https://m.stock.naver.com/api/stocks/marketValue/${market}?page=${page}&pageSize=${PAGE_SIZE}`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener/1.0)' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`${market} page ${page}: HTTP ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload?.stocks) ? payload.stocks : [];
    stocks.push(...rows);
    if (rows.length < PAGE_SIZE || stocks.length >= Number(payload?.totalCount || 0)) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  return stocks;
}

export function buildKrIndexWeights(byMarket, nowIso) {
  const markets = {};
  for (const [market, stocks] of Object.entries(byMarket)) { const built = marketWeights(stocks, TOP[market]); if (built) markets[market] = built; }
  return {
    schemaVersion: KR_INDEX_WEIGHTS_SCHEMA,
    generatedAt: nowIso,
    producer: 'scripts/fetch-kr-index-weights.mjs',
    source: 'Naver Finance market-value ranking (KRX prices)',
    sourceKind: 'T3_PUBLIC_DELAYED',
    allowedUse: 'reference',
    basis: 'Common-stock market-cap share at the previous close (preferred shares excluded) — a proxy for the index weight, not the official KRX weight. Top names only.',
    markets
  };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const fixture = arg('--fixture');
  const outPath = arg('--out') ? resolve(arg('--out')) : OUT;
  if (process.env.GITHUB_ACTIONS !== 'true' && (!fixture || outPath === OUT)) {
    console.error('[kr-index-weights] producers run only in GitHub Actions; locally pass --fixture <file> --out <file>');
    process.exit(2);
  }
  const nowIso = new Date().toISOString();
  // Due once per KRX session: after 16:10 KST, and only when the published copy is from an earlier session.
  if (!fixture) {
    const kst = new Date(Date.now() + 9 * 3600000);
    const previous = JSON.parse(await readFile(OUT, 'utf8').catch(() => 'null'));
    if (kst.getUTCHours() * 60 + kst.getUTCMinutes() < 16 * 60 + 10 && previous) { console.log('[kr-index-weights] before 16:10 KST; kept'); return; }
    if (previous?.markets?.KOSPI?.asOf === kst.toISOString().slice(0, 10)) { console.log('[kr-index-weights] current session already published'); return; }
  }
  const byMarket = fixture ? JSON.parse(await readFile(resolve(fixture), 'utf8'))
    : { KOSPI: await fetchMarket('KOSPI', fetch), KOSDAQ: await fetchMarket('KOSDAQ', fetch) };
  const artifact = buildKrIndexWeights(byMarket, nowIso);
  if (!artifact.markets.KOSPI) throw new Error('no KOSPI rows');
  await atomicWriteFile(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[kr-index-weights] KOSPI ${artifact.markets.KOSPI.asOf} ${artifact.markets.KOSPI.count} common stocks; KOSDAQ ${artifact.markets.KOSDAQ?.count ?? 0}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[kr-index-weights] failed: ${error?.message || error}`); process.exit(1); });
}
