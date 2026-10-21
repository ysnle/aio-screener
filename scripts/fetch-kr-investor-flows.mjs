#!/usr/bin/env node
// v58.55 개편 v2 (5n) 투자자별 순매수: daily net buying by investor type on KOSPI/KOSDAQ from the Bank of Korea's
// Economic Statistics System (ECOS) Open API, table 802Y001 주식시장(일) (operator key in Actions secret BOK_API_KEY —
// the same secret the Worker relay already uses). ECOS is a free official source whose figures may be used with the
// source named; the KRX Data Marketplace and its OPEN API were not used: the marketplace terms forbid copying or
// redistributing its data without KRX's prior permission (login-only since 2025-12), and the KRX OPEN API's free
// services (31 daily trading/index APIs) carry no investor-type trading service.
//
// The table's item codes are not hard-coded: the item list is read first and an item is used only when its own name
// says which investor (외국인 · 개인 · 기관) and which market (코스피/유가증권 · 코스닥) and that it is a 순매수 figure
// in a known unit. ECOS publishes the foreign investors' net purchase; the individual and institutional figures are
// used only if the table lists them. Values are ECOS's own numbers converted to 억원; nothing is estimated.
// Without a key, or on any fetch failure, it exits 0 and leaves the previous artifact untouched.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KR_INVESTOR_FLOWS_OUT = path.join(root, 'public-data', 'kr-investor-flows.json');
export const KR_INVESTOR_FLOWS_SCHEMA = 'kr-investor-flows.v1';
export const ECOS_STAT_CODE = '802Y001';
const API = 'https://ecos.bok.or.kr/api';
const LOOKBACK_DAYS = 70; // ~45 KRX sessions: the card draws the last 20
const UNIT_TO_EOK = Object.freeze({ '억원': 1, '백만원': 0.01, '십억원': 10, '조원': 10000 });

export const INVESTORS = Object.freeze([
  Object.freeze({ id: 'individual', label: '개인', rx: /개인/ }),
  Object.freeze({ id: 'foreign', label: '외국인', rx: /외국인/ }),
  Object.freeze({ id: 'institution', label: '기관', rx: /기관/ })
]);

const SUB_INDEX_RX = /\d{2,3}(?!\d)|대형|중형|소형|업종|섹터|스타|벤처|우량|중견|레버리지|인버스|선물|옵션|ETF|ETN|ELW|배당|지배구조|프리미어|글로벌/i;

/** One ECOS item → { market, investor, factor } or { skip: reason }. Only the item's own text decides. */
export function classifyEcosItem(item) {
  const name = String(item?.ITEM_NAME || '');
  const context = `${item?.P_ITEM_NAME || ''} ${item?.GRP_NAME || ''} ${name}`;
  if (!/순매수/.test(name) && !/순매수/.test(String(item?.P_ITEM_NAME || ''))) return { skip: 'not-net-purchase' };
  if (String(item?.CYCLE || 'D').toUpperCase() !== 'D') return { skip: 'not-daily' };
  const investors = INVESTORS.filter((inv) => inv.rx.test(context));
  if (investors.length !== 1) return { skip: investors.length ? 'investor-ambiguous' : 'investor-unnamed' };
  // v58.55 review: KOSPI200 / KOSDAQ150 / size-tier / sector items name the market too; only the market-wide figure is used.
  // (Item and parent names only: a group/table label can carry section numbers.)
  if (SUB_INDEX_RX.test(`${item?.P_ITEM_NAME || ''} ${name}`)) return { skip: 'sub-index' };
  const kosdaq = /코스닥|KOSDAQ/i.test(context);
  const kospi = /코스피|KOSPI|유가증권/i.test(context);
  if (kosdaq === kospi) return { skip: 'market-ambiguous' };
  const unit = String(item?.UNIT_NAME || '').replace(/\s+/g, '');
  const factor = UNIT_TO_EOK[unit];
  if (factor == null) return { skip: `unit-unknown:${unit || 'none'}` };
  // Fewer leftover words = closer to the plain market-wide series; buildKrInvestorFlows keeps the most general item.
  const generality = name.replace(/순매수|외국인|개인|기관|투자자|코스피|코스닥|KOSPI|KOSDAQ|유가증권|시장|금액|합계|전체|[\s()·,\-_/]/gi, '').length;
  return { market: kosdaq ? 'kosdaq' : 'kospi', investor: investors[0].id, factor, unit, generality };
}

/** ECOS StatisticSearch rows → ascending { date, value(억원) }; malformed rows are dropped, never filled. */
export function parseEcosDailyRows(rows, factor = 1) {
  const out = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const time = String(row?.TIME || '');
    if (!/^\d{8}$/.test(time)) continue;
    const date = `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}`;
    const raw = String(row?.DATA_VALUE ?? '').replace(/,/g, '').trim();
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) continue;
    out.set(date, Math.round(value * factor * 100) / 100);
  }
  return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
}

/** Items + their series → the artifact payload. */
export function buildKrInvestorFlows({ items = [], seriesByItem = {}, generatedAt = new Date().toISOString() } = {}) {
  const markets = {};
  const skipped = [];
  for (const item of Array.isArray(items) ? items : []) {
    const cls = classifyEcosItem(item);
    if (cls.skip) { if (cls.skip !== 'not-net-purchase') skipped.push({ itemCode: item?.ITEM_CODE || null, itemName: item?.ITEM_NAME || null, reason: cls.skip }); continue; }
    const series = parseEcosDailyRows(seriesByItem[item.ITEM_CODE], cls.factor);
    if (!series.length) { skipped.push({ itemCode: item.ITEM_CODE, itemName: item.ITEM_NAME, reason: 'series-empty' }); continue; }
    const market = (markets[cls.market] ||= { investors: {} });
    const held = market.investors[cls.investor];
    if (held && held.generality <= cls.generality) { skipped.push({ itemCode: item.ITEM_CODE, itemName: item.ITEM_NAME, reason: 'less-general-duplicate' }); continue; }
    if (held) skipped.push({ itemCode: held.itemCode, itemName: held.itemName, reason: 'less-general-duplicate' });
    market.investors[cls.investor] = { itemCode: String(item.ITEM_CODE), itemName: String(item.ITEM_NAME), sourceUnit: cls.unit, generality: cls.generality, series };
  }
  for (const market of Object.values(markets)) {
    for (const inv of Object.values(market.investors)) delete inv.generality;
    market.latestDate = Object.values(market.investors).map((inv) => inv.series.at(-1)?.date).filter(Boolean).sort().at(-1) || null;
  }
  const found = Object.keys(markets).length;
  return {
    schemaVersion: KR_INVESTOR_FLOWS_SCHEMA,
    generatedAt,
    status: found ? 'ok' : 'no-investor-items',
    source: '한국은행 경제통계시스템(ECOS) 802Y001 주식시장(일)',
    sourceUrl: 'https://ecos.bok.or.kr/',
    sourceKind: 'T1_OFFICIAL',
    statCode: ECOS_STAT_CODE,
    unit: '억원',
    basis: 'ECOS 게시 순매수 금액(매수 − 매도) · 한국거래소 집계를 한국은행이 게시',
    markets,
    missingInvestors: INVESTORS.filter((inv) => !Object.values(markets).some((m) => m.investors[inv.id])).map((inv) => inv.id),
    skipped: skipped.slice(0, 40)
  };
}

/** No numbers: the file exists before the first collection so the page asks for it without a 404, and says 수집 전. */
export function pendingKrInvestorFlows(reason = 'key-missing', generatedAt = new Date().toISOString()) {
  return { schemaVersion: KR_INVESTOR_FLOWS_SCHEMA, generatedAt, status: 'not-collected', reason, source: '한국은행 경제통계시스템(ECOS) 802Y001 주식시장(일)', sourceUrl: 'https://ecos.bok.or.kr/', sourceKind: 'T1_OFFICIAL', statCode: ECOS_STAT_CODE, unit: '억원', markets: {}, missingInvestors: INVESTORS.map((inv) => inv.id), skipped: [] };
}

async function writeArtifact(payload) {
  const tmp = `${KR_INVESTOR_FLOWS_OUT}.tmp`;
  await writeFile(tmp, JSON.stringify(payload));
  await rename(tmp, KR_INVESTOR_FLOWS_OUT);
}

const ymd = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)).replace(/-/g, '');

async function getJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'AIO-Screener research (GitHub Actions)' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const key = process.env.BOK_API_KEY || '';
  let previous = null;
  try { previous = JSON.parse(await readFile(KR_INVESTOR_FLOWS_OUT, 'utf8')); } catch { /* first run */ }
  if (!key) {
    // An existing file (collected data or the 수집 전 marker) stays as it is; only a missing file gets the marker.
    if (!previous) await writeArtifact(pendingKrInvestorFlows('key-missing'));
    console.log('[kr-flows] BOK_API_KEY not configured — skipping (artifact unchanged)');
    return;
  }
  const k = encodeURIComponent(key);
  const list = await getJson(`${API}/StatisticItemList/${k}/json/kr/1/1000/${ECOS_STAT_CODE}`);
  const items = list?.StatisticItemList?.row;
  if (!Array.isArray(items) || !items.length) {
    // ECOS answers errors as { RESULT: { CODE, MESSAGE } }; the code is logged, the key never is.
    console.log(`::warning::[kr-flows] ECOS item list unavailable (${list?.RESULT?.CODE || 'no rows'}) — artifact unchanged`);
    return;
  }
  const now = Date.now();
  const start = ymd(now - LOOKBACK_DAYS * 86400000); const end = ymd(now);
  const seriesByItem = {};
  for (const item of items) {
    if (classifyEcosItem(item).skip) continue;
    const payload = await getJson(`${API}/StatisticSearch/${k}/json/kr/1/200/${ECOS_STAT_CODE}/D/${start}/${end}/${encodeURIComponent(item.ITEM_CODE)}`);
    seriesByItem[item.ITEM_CODE] = payload?.StatisticSearch?.row || [];
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const payload = buildKrInvestorFlows({ items, seriesByItem });
  if (payload.status !== 'ok' && previous?.status === 'ok') {
    console.log(`::warning::[kr-flows] no investor-type item matched in ${ECOS_STAT_CODE} (${payload.skipped.length} skipped) — previous artifact kept`);
    return;
  }
  await writeArtifact(payload);
  // The chosen ECOS item per market and investor, so the first Actions run can be audited against the ECOS table.
  const summary = Object.entries(payload.markets).map(([m, v]) => `${m}@${v.latestDate}[${Object.entries(v.investors).map(([id, inv]) => `${id}=${inv.itemCode} "${inv.itemName}" (${inv.sourceUnit})`).join('; ')}]`).join(' ');
  console.log(`[kr-flows] ${payload.status} ${summary || '(none)'} · missing ${payload.missingInvestors.join(',') || 'none'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.log(`::warning::[kr-flows] ${String(error?.message || error).replace(/[A-Za-z0-9]{16,}/g, '***')} — artifact unchanged`); process.exitCode = 0; });
}
