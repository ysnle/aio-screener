#!/usr/bin/env node
// v59.56 (X-bookmark gap 2, 2026-11-01): Taiwan's AI supply chain reports revenue every month (by the 10th, under
// TWSE/MOPS rules), about a month before the US quarterly results it feeds. This reads the Taiwan Stock Exchange's free
// OpenAPI dataset t187ap05_L (上市公司每月營業收入彙總表 — the MOPS monthly-revenue table for listed companies; no key,
// no cost) and keeps a fixed list of listed AI supply-chain companies. Every number is the source's own amount in
// thousand NT$ (仟元); percentages are computed from those amounts, never estimated. The source carries the current
// month, the previous month and the same month a year ago, so each run also seeds those months into a per-company
// history that later runs extend (24 months kept).
//
// Companies are named by their TWSE stock code (no ticker guessing): the source's own 公司名稱 is stored and a code
// whose name no longer starts with the expected one is logged. OTC (TPEx) names such as Aspeed are not included yet:
// the TPEx OpenAPI schema has not been verified from a run. Without network, or on any fetch/shape failure, it exits 0
// and leaves the previous artifact untouched. A run whose data equals the previous artifact's does not rewrite it, so
// the monthly series does not commit every six hours.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { fetchJsonWithDeadline } from './lib/http-fetch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TW_REVENUE_OUT = path.join(root, 'public-data', 'tw-monthly-revenue.json');
export const TW_REVENUE_SCHEMA = 'tw-monthly-revenue.v1';
export const TW_REVENUE_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L';
const SOURCE = '대만증권거래소(TWSE) OpenAPI t187ap05_L · 상장회사 월매출(MOPS 신고)';
const HISTORY_MONTHS = 24;

// Groups follow the chain from chip to rack. `expect` is the start of the source's 公司名稱, checked on every run.
export const TW_AI_CHAIN = Object.freeze([
  Object.freeze({ id: 'foundry-design', name: '파운드리·칩 설계', members: [['2330', '台積電', 'TSMC'], ['2454', '聯發科', '미디어텍'], ['3661', '世芯', '알칩'], ['3443', '創意', 'GUC']] }),
  Object.freeze({ id: 'packaging-test', name: '패키징·테스트', members: [['3711', '日月光', 'ASE'], ['2449', '京元', 'KYEC']] }),
  Object.freeze({ id: 'substrate-pcb', name: '기판·PCB·소재', members: [['3037', '欣興', '유니마이크론'], ['2368', '金像', '골드서킷'], ['2383', '台光', 'EMC']] }),
  Object.freeze({ id: 'server-odm', name: 'AI 서버 조립', members: [['2317', '鴻海', '폭스콘'], ['2382', '廣達', '콴타'], ['3231', '緯創', '위스트론'], ['6669', '緯穎', '위윈']] }),
  Object.freeze({ id: 'power-cooling-network', name: '전력·냉각·네트워크', members: [['2308', '台達', '델타'], ['3017', '奇鋐', 'AVC'], ['2345', '智邦', '액톤']] })
]);

const amount = (value) => {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  return Number(raw);
};
const pct = (now, before) => (now == null || before == null || before <= 0 ? null : Math.round((now / before - 1) * 1000) / 10);

/** ROC year-month "11509" → "2026-09"; anything else → null. */
export function rocMonth(value) {
  const m = /^(\d{2,3})(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${Number(m[1]) + 1911}-${m[2]}`;
}
/** ROC date "1151017" → "2026-10-17"; anything else → null. */
export function rocDate(value) {
  const m = /^(\d{2,3})(\d{2})(\d{2})$/.exec(String(value || '').trim());
  return m ? `${Number(m[1]) + 1911}-${m[2]}-${m[3]}` : null;
}
/** "2026-09" shifted by n months. */
export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** One source row → the company record, or null when its month or current amount is unreadable. */
export function parseRevenueRow(row) {
  const month = rocMonth(row?.['資料年月']);
  const revenue = amount(row?.['營業收入-當月營收']);
  if (!month || revenue == null) return null;
  const prevMonth = amount(row['營業收入-上月營收']);
  const yearAgo = amount(row['營業收入-去年當月營收']);
  const ytd = amount(row['累計營業收入-當月累計營收']);
  const ytdPrior = amount(row['累計營業收入-去年累計營收']);
  const note = String(row['備註'] ?? '').trim();
  return { code: String(row['公司代號'] || '').trim(), sourceName: String(row['公司名稱'] || '').trim(), industry: String(row['產業別'] || '').trim() || null,
    month, publishedAt: rocDate(row['出表日期']), revenue, prevMonth, yearAgo, momPct: pct(revenue, prevMonth), yoyPct: pct(revenue, yearAgo),
    ytd, ytdPrior, ytdYoyPct: pct(ytd, ytdPrior), note: note && note !== '-' ? note : null };
}

/** Previous history ∪ this run's three source months (this run wins), newest HISTORY_MONTHS kept, ascending. */
export function mergeHistory(previous = [], record) {
  const byMonth = new Map((Array.isArray(previous) ? previous : []).filter((p) => /^\d{4}-\d{2}$/.test(p?.month) && Number.isFinite(p?.revenue)).map((p) => [p.month, p.revenue]));
  if (record.yearAgo != null) byMonth.set(shiftMonth(record.month, -12), record.yearAgo);
  if (record.prevMonth != null) byMonth.set(shiftMonth(record.month, -1), record.prevMonth);
  byMonth.set(record.month, record.revenue);
  return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-HISTORY_MONTHS).map(([month, revenue]) => ({ month, revenue }));
}

/** Source rows + the previous artifact → the artifact payload. */
export function buildTwMonthlyRevenue({ rows = [], previous = null, generatedAt = new Date().toISOString() } = {}) {
  const byCode = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row?.['公司代號'] || '').trim(), row]));
  const prevByCode = new Map((previous?.companies || []).map((c) => [c.code, c]));
  const companies = []; const missing = []; const renamed = [];
  for (const group of TW_AI_CHAIN) {
    for (const [code, expect, nameKo] of group.members) {
      const record = byCode.has(code) ? parseRevenueRow(byCode.get(code)) : null;
      if (!record) { missing.push(code); continue; }
      if (!record.sourceName.startsWith(expect)) renamed.push(`${code}:${record.sourceName}`);
      companies.push({ ...record, nameKo, group: group.id, history: mergeHistory(prevByCode.get(code)?.history, record) });
    }
  }
  const months = companies.map((c) => c.month).sort();
  return {
    schemaVersion: TW_REVENUE_SCHEMA, generatedAt, status: companies.length ? 'ok' : 'no-companies', source: SOURCE, sourceUrl: TW_REVENUE_URL, sourceKind: 'T1_OFFICIAL',
    unit: '천 대만달러(仟元)', basis: '회사가 MOPS에 신고한 월 매출 금액. 증감률은 원천 금액으로 계산',
    latestMonth: months.at(-1) || null, publishedAt: companies.map((c) => c.publishedAt).filter(Boolean).sort().at(-1) || null,
    groups: TW_AI_CHAIN.map((g) => ({ id: g.id, name: g.name, codes: g.members.map(([code]) => code) })),
    companies, missing, renamed
  };
}

/** No numbers: the file exists before the first collection so the page asks for it without a 404. */
export function pendingTwMonthlyRevenue(reason = 'awaiting-first-collection', generatedAt = new Date().toISOString()) {
  return { schemaVersion: TW_REVENUE_SCHEMA, generatedAt, status: 'not-collected', reason, source: SOURCE, sourceUrl: TW_REVENUE_URL, sourceKind: 'T1_OFFICIAL', unit: '천 대만달러(仟元)',
    latestMonth: null, publishedAt: null, groups: TW_AI_CHAIN.map((g) => ({ id: g.id, name: g.name, codes: g.members.map(([code]) => code) })), companies: [], missing: [], renamed: [] };
}

/** True when the two artifacts carry the same companies and numbers (generatedAt aside). */
export function sameRevenueData(a, b) {
  const strip = (x) => JSON.stringify({ ...(x || {}), generatedAt: null });
  return !!a && !!b && strip(a) === strip(b);
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(TW_REVENUE_OUT, 'utf8')); } catch { /* first run */ }
  const rows = await fetchJsonWithDeadline(TW_REVENUE_URL, { timeoutMs: 30000, init: { headers: { 'User-Agent': 'AIO-Screener research (GitHub Actions)', Accept: 'application/json' } } });
  if (!Array.isArray(rows) || !rows.length) throw new Error('empty dataset');
  const payload = buildTwMonthlyRevenue({ rows, previous: previous?.status === 'ok' ? previous : null });
  if (payload.status !== 'ok') {
    console.log(`::warning::[tw-revenue] none of the ${TW_AI_CHAIN.reduce((n, g) => n + g.members.length, 0)} codes found in ${rows.length} rows — artifact unchanged`);
    return;
  }
  if (payload.renamed.length) console.log(`::warning::[tw-revenue] source name changed: ${payload.renamed.join(', ')}`);
  if (sameRevenueData(payload, previous)) { console.log(`[tw-revenue] unchanged (${payload.latestMonth}) — not rewritten`); return; }
  await atomicWriteFile(TW_REVENUE_OUT, JSON.stringify(payload));
  console.log(`[tw-revenue] ok ${payload.latestMonth} · ${payload.companies.length} companies · missing ${payload.missing.join(',') || 'none'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.log(`::warning::[tw-revenue] ${String(error?.message || error)} — artifact unchanged`); process.exitCode = 0; });
}
