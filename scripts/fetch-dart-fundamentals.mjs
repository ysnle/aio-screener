#!/usr/bin/env node
// P1654 (owner 2026-10-12: fill free official data gaps): Korean listed-company fundamentals from OpenDART, the
// Financial Supervisory Service's free disclosure API (operator key in Actions secret DART_API_KEY). For each KRX
// symbol in the screener universe it records the latest annual business report's key accounts (consolidated when
// filed, otherwise separate) and the prior year for growth. Values are the filing's own figures in KRW; nothing is
// estimated. Without a key it exits 0 and leaves the previous artifact untouched.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public-data', 'kr-fundamentals.json');
const SCREENER = path.join(root, 'public-data', 'screener.json');
const API = 'https://opendart.fss.or.kr/api';
const REFRESH_AFTER_MS = 6 * 86400000;
const ACCOUNTS = Object.freeze({ revenue: ['매출액', '수익(매출액)', '영업수익'], operatingIncome: ['영업이익', '영업이익(손실)'], netIncome: ['당기순이익', '당기순이익(손실)'], assets: ['자산총계'], liabilities: ['부채총계'], equity: ['자본총계'] });

// corpCode.xml arrives as a single-entry zip; read it through the central directory (no zip dependency).
export function unzipFirstEntry(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('zip: no end of central directory');
  const cd = buffer.readUInt32LE(eocd + 16);
  if (buffer.readUInt32LE(cd) !== 0x02014b50) throw new Error('zip: bad central directory');
  const method = buffer.readUInt16LE(cd + 10);
  const size = buffer.readUInt32LE(cd + 20);
  const local = buffer.readUInt32LE(cd + 42);
  const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
  const data = buffer.subarray(start, start + size);
  return method === 0 ? data : inflateRawSync(data);
}

export function parseCorpCodes(xml) {
  const byStock = new Map();
  for (const match of String(xml).matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const field = (name) => (match[1].match(new RegExp(`<${name}>([^<]*)</${name}>`)) || [])[1]?.trim() || '';
    const stock = field('stock_code');
    if (/^\d{6}$/.test(stock)) byStock.set(stock, { corpCode: field('corp_code'), corpName: field('corp_name') });
  }
  return byStock;
}

const amount = (text) => {
  const value = Number(String(text ?? '').replace(/,/g, '').trim());
  return Number.isFinite(value) && String(text ?? '').trim() !== '' && String(text).trim() !== '-' ? value : null;
};

// One fnlttSinglAcnt response → key accounts for the current and prior fiscal year, consolidated first.
export function pickAccounts(list = []) {
  const rows = Array.isArray(list) ? list : [];
  const basis = rows.some((row) => row.fs_div === 'CFS') ? 'CFS' : 'OFS';
  const scoped = rows.filter((row) => row.fs_div === basis);
  const out = { basis, current: {}, prior: {} };
  for (const [key, names] of Object.entries(ACCOUNTS)) {
    const row = scoped.find((item) => names.includes(String(item.account_nm || '').trim()));
    out.current[key] = row ? amount(row.thstrm_amount) : null;
    out.prior[key] = row ? amount(row.frmtrm_amount) : null;
  }
  return out;
}

async function getJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'AIO-Screener research (GitHub Actions)' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// v58.82: OpenDART answers a spent daily quota (020), a bad or blocked key (010-012) or a system check (800/901) with
// HTTP 200, and every later call fails the same way, so the run stops there instead of logging hundreds of failures.
const DART_FATAL_STATUS = new Set(['010', '011', '012', '020', '800', '901']);

// v58.82: a symbol that failed for a transient reason (HTTP error, timeout, fatal status) keeps the previous run's filing,
// marked with when it was read; a symbol whose report is absent is not resurrected. A result that still holds less than
// half of the previous companies is not published — the previous artifact stays.
export function mergeWithPrevious(companies, failed, previous) {
  const merged = { ...companies };
  const prior = previous && typeof previous.companies === 'object' && previous.companies ? previous.companies : {};
  for (const row of failed) {
    if (row.reason === 'no-annual-report' || row.reason === 'corp-code-not-found' || merged[row.sym] || !prior[row.sym]) continue;
    merged[row.sym] = { ...prior[row.sym], carriedFrom: prior[row.sym].carriedFrom || previous.generatedAt || null };
  }
  const count = Object.keys(merged).length;
  const previousCount = Number(previous?.count) || 0;
  return { companies: merged, count, publish: count > 0 && count >= previousCount / 2 };
}

async function main() {
  const key = process.env.DART_API_KEY || '';
  if (!key) { console.log('[dart] DART_API_KEY not configured — skipping (artifact unchanged)'); return; }
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  if (previous?.count > 0 && previous?.generatedAt && Date.now() - Date.parse(previous.generatedAt) < REFRESH_AFTER_MS && process.env.DART_FORCE !== '1') {
    console.log(`[dart] fresh (${previous.generatedAt}) — skipping`); return;
  }
  const screener = JSON.parse(await readFile(SCREENER, 'utf8'));
  const symbols = Object.keys(screener.data || {}).filter((sym) => /^\d{6}\.K[SQ]$/.test(sym));
  const corpResponse = await fetch(`${API}/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(60000) });
  if (!corpResponse.ok) throw new Error(`corpCode HTTP ${corpResponse.status}`);
  const zip = Buffer.from(await corpResponse.arrayBuffer());
  const corps = parseCorpCodes(unzipFirstEntry(zip).toString('utf8'));
  const now = new Date();
  // An annual report for fiscal year Y is due by the end of March of Y+1. 2026-10-17 (logic audit): before April the last
  // year's report is still tried first — most large filers publish it in early-to-mid March, and starting at Y-2 kept their
  // previous year for weeks. A report not filed yet answers with no list and the year before is read.
  const latestYear = now.getUTCFullYear() - 1;
  const companies = {};
  const failed = [];
  let fatal = null;
  for (const sym of symbols) {
    if (fatal) { failed.push({ sym, reason: `stopped: DART status ${fatal}` }); continue; }
    const code = sym.slice(0, 6);
    const corp = corps.get(code);
    if (!corp) { failed.push({ sym, reason: 'corp-code-not-found' }); continue; }
    let found = null;
    for (const year of [latestYear, latestYear - 1]) {
      try {
        const payload = await getJson(`${API}/fnlttSinglAcnt.json?crtfc_key=${encodeURIComponent(key)}&corp_code=${corp.corpCode}&bsns_year=${year}&reprt_code=11011`);
        if (payload.status === '000' && Array.isArray(payload.list) && payload.list.length) { found = { year, payload }; break; }
        if (DART_FATAL_STATUS.has(String(payload.status))) { fatal = String(payload.status); failed.push({ sym, reason: `DART status ${fatal}` }); break; }
      } catch (error) { failed.push({ sym, reason: error.message }); break; }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    if (!found) { if (!failed.some((row) => row.sym === sym)) failed.push({ sym, reason: 'no-annual-report' }); continue; }
    const accounts = pickAccounts(found.payload.list);
    const receipt = found.payload.list.find((row) => row.rcept_no)?.rcept_no || null;
    companies[sym] = { corpName: corp.corpName, fiscalYear: found.year, reportCode: '11011', basis: accounts.basis, receiptNo: receipt, current: accounts.current, prior: accounts.prior };
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  const merged = mergeWithPrevious(companies, failed, previous);
  if (!merged.publish) {
    console.log(`[dart] only ${merged.count} companies (previous ${previous?.count || 0}) · failed ${failed.length}${fatal ? ` · DART status ${fatal}` : ''} — previous artifact kept`);
    return;
  }
  const payload = { schemaVersion: 'kr-fundamentals.v1', generatedAt: new Date().toISOString(), source: 'OpenDART (금융감독원 전자공시) 단일회사 주요계정', sourceKind: 'T1_OFFICIAL', unit: 'KRW', reportType: '사업보고서', count: merged.count, requested: symbols.length, failed, companies: merged.companies };
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, JSON.stringify(payload));
  await rename(tmp, OUT);
  console.log(`[dart] ${payload.count}/${symbols.length} companies · failed ${failed.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[dart] ${error?.message || error}`); process.exitCode = 0; });
}
