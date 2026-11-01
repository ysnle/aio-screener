#!/usr/bin/env node
// v59.56 (X bookmarks 11/01 follow-up 1): quarterly operating cash flow and capex for nine big-tech issuers from SEC
// EDGAR companyfacts (free, keyless; fair access needs a declared User-Agent — the same SEC_USER_AGENT variable the
// fundamentals job uses). Nine requests at a 250 ms pace per run. The year-to-date differencing and the twelve-month
// sums live in src/domain/fundamental/quarterly-cashflow.js. An issuer whose fetch fails keeps its previous row
// (marked carried), and a run where every fetch fails leaves the artifact untouched; without a User-Agent it exits 0.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { BIGTECH_CASHFLOW_SCHEMA, BIGTECH_ISSUERS, HYPERSCALERS, issuerCashflow, groupCashflow, groupCashflowSentence } from '../src/domain/fundamental/quarterly-cashflow.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BIGTECH_CASHFLOW_OUT = path.join(root, 'public-data', 'bigtech-cashflow.json');
const FACTS_URL = (cik) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`;

/** Pure: per-issuer companyfacts (or an Error) → the artifact; a failed issuer carries its previous row forward. */
export function buildBigtechCashflow({ factsBySymbol = {}, previous = null, nowMs = Date.now() } = {}) {
  const prior = new Map((previous?.issuers || []).map((row) => [row.symbol, row]));
  const issuers = BIGTECH_ISSUERS.map(({ symbol, cik, nameKo, group }) => {
    const facts = factsBySymbol[symbol];
    if (!facts || facts instanceof Error) {
      const kept = prior.get(symbol);
      return kept ? { ...kept, carried: true, lastError: String(facts?.message || 'not-fetched').slice(0, 160) }
        : { symbol, cik, nameKo, group, status: 'fetch-failed', reason: String(facts?.message || 'not-fetched').slice(0, 160), quarters: [] };
    }
    const read = issuerCashflow(facts);
    return { symbol, cik, nameKo, group, fetchedAt: new Date(nowMs).toISOString(), carried: false, ...read };
  });
  const hyperscalers = groupCashflow(issuers, HYPERSCALERS);
  return {
    schemaVersion: BIGTECH_CASHFLOW_SCHEMA,
    generatedAt: new Date(nowMs).toISOString(),
    source: 'SEC EDGAR companyfacts (10-Q/10-K, us-gaap)',
    method: '분기 = 10-Q 누계(3·6·9개월)의 차이, 4분기 = 10-K 연간 − 9개월 누계. 설비투자는 현금흐름표의 유형자산 취득(총액), 잉여현금흐름 = 영업현금흐름 − 설비투자. 회사 자체 정의(매각 대금·리스 차감 등)와 다를 수 있음.',
    unit: 'USD',
    issuers,
    hyperscalers,
    summary: groupCashflowSentence(hyperscalers)
  };
}

async function fetchFacts(cik, userAgent) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const response = await fetch(FACTS_URL(cik), { headers: { 'User-Agent': userAgent, Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' }, signal: ctrl.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

async function main() {
  const userAgent = process.env.SEC_USER_AGENT || '';
  if (!/[^\s@]+@[^\s@]+\.[^\s@]+/.test(userAgent)) {
    console.log('::notice::[bigtech-cashflow] SEC_USER_AGENT (with a contact address) is not set — artifact unchanged');
    return;
  }
  const previous = await readFile(BIGTECH_CASHFLOW_OUT, 'utf8').then(JSON.parse).catch(() => null);
  const factsBySymbol = {};
  for (const issuer of BIGTECH_ISSUERS) {
    factsBySymbol[issuer.symbol] = await fetchFacts(issuer.cik, userAgent).catch((error) => error);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const failed = Object.entries(factsBySymbol).filter(([, value]) => value instanceof Error);
  if (failed.length === BIGTECH_ISSUERS.length) {
    console.log(`::warning::[bigtech-cashflow] every companyfacts fetch failed (${failed[0][1].message}) — artifact unchanged`);
    return;
  }
  const payload = buildBigtechCashflow({ factsBySymbol, previous });
  await atomicWriteFile(BIGTECH_CASHFLOW_OUT, `${JSON.stringify(payload, null, 1)}\n`);
  for (const row of payload.issuers) {
    console.log(`[bigtech-cashflow] ${row.symbol} ${row.status}${row.carried ? ' (carried)' : ''} ttm=${row.ttm ? `${row.ttm.end} ocf=${row.ttm.ocf} capex=${row.ttm.capex}` : '-'} concepts=${row.quarters?.at(-1) ? JSON.stringify(row.quarters.at(-1).concepts) : '-'}`);
  }
  if (failed.length) console.log(`::warning::[bigtech-cashflow] ${failed.map(([symbol, error]) => `${symbol}: ${error.message}`).join('; ')} — previous rows kept`);
  console.log(`[bigtech-cashflow] ${payload.summary || 'hyperscaler total unavailable'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.log(`::warning::[bigtech-cashflow] ${String(error?.message || error)} — artifact unchanged`); process.exitCode = 0; });
}
