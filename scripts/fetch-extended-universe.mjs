// v57.81: refreshes public-data/screener-extended-universe.json — every Russell 2000 member and every Nasdaq-listed
// common stock outside the core universe, with membership tags. Runs only in GitHub Actions (refresh-screener,
// extended job). Each source failing or falling below its floor keeps the previous run's rows (scripts/lib/
// extended-universe.mjs); when neither source and no previous file is usable the file is left as it is.
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import {
  IWM_HOLDINGS_URLS, NASDAQ_LISTED_URL, OTHER_LISTED_URL, buildExtendedUniverse, parseIwmHoldings, parseNasdaqListed, parseOtherListed
} from './lib/extended-universe.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
export const EXTENDED_UNIVERSE_OUT = `${__dir}/../public-data/screener-extended-universe.json`;
const CORE_UNIVERSE = `${__dir}/../public-data/screener-universe.json`;

async function fetchText(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (aio-screener data refresh)', Accept: 'text/csv,text/plain,*/*' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

export async function refreshExtendedUniverse({ now = new Date().toISOString() } = {}) {
  const previous = await readJson(EXTENDED_UNIVERSE_OUT);
  const coreSymbols = ((await readJson(CORE_UNIVERSE))?.universe || []).map((row) => row?.sym).filter(Boolean);
  let iwm = null; let iwmError = null;
  for (const url of IWM_HOLDINGS_URLS) {
    try { iwm = parseIwmHoldings(await fetchText(url)); iwmError = null; if (iwm.rows.length) break; }
    catch (error) { iwmError = `${url.split('?')[0]}: ${error.message}`; }
  }
  let nasdaq = null; let nasdaqError = null;
  try { nasdaq = parseNasdaqListed(await fetchText(NASDAQ_LISTED_URL)); } catch (error) { nasdaqError = error.message; }
  let other = null;
  try { other = parseOtherListed(await fetchText(OTHER_LISTED_URL)); } catch (error) { console.log(`::notice::otherlisted.txt unavailable (${error.message}); Russell share-class tickers keep the fund's own form`); }
  const { usable, payload } = buildExtendedUniverse({ iwm, iwmError, nasdaq, nasdaqError, other, previous, coreSymbols, now });
  for (const [id, source] of Object.entries(payload.meta.sources)) {
    if (source.status !== 'CURRENT') console.log(`::warning::extended universe ${id} ${source.status} (${source.reason || 'no reason'}); ${source.rows} rows`);
  }
  if (!usable) {
    console.log('::warning::extended universe: no source usable and no previous file — nothing written');
    return { written: false, payload };
  }
  await atomicWriteFile(EXTENDED_UNIVERSE_OUT, `${JSON.stringify(payload)}\n`);
  console.log(`[extended-universe] r2000=${payload.meta.counts.r2000} nasdaqCommon=${payload.meta.counts.nasdaqCommon} extended=${payload.meta.counts.extended} inCore=${payload.meta.counts.inCore}`);
  return { written: true, payload };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/fetch-extended-universe.mjs')) {
  await refreshExtendedUniverse();
}
