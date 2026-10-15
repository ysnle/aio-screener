// v57.81: every US exchange-listed symbol (Nasdaq, NYSE, NYSE American, NYSE Arca, Cboe BZX, IEX) for exact-match
// symbol checks in the portfolio entry box and the ticker page (owner: "전체 상장 목록 … 최소 나스닥, S&P 500,
// 다우존스, 러셀2000"). Source: the official Nasdaq Trader symbol directory (nasdaqlisted.txt + otherlisted.txt),
// joined to SEC company_tickers_exchange.json for the CIK by exact symbol. Only symbol, security name, exchange code,
// ETF flag and CIK are published — no prices.
//
// Runs only in GitHub Actions (refresh-screener.yml, daily: a copy younger than 20h is kept). A failed fetch, a
// reshaped file, or a list that misses the floors in scripts/lib/us-listings.mjs keeps the previous artifact.
// The SEC join needs SEC_USER_AGENT (the repository variable the SEC lane uses); without it, cik stays null.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import {
  NASDAQ_LISTED_URL, OTHER_LISTED_URL, SEC_TICKERS_URL, buildArtifact, buildListingRows, fileCreationDate,
  joinSecCik, secCikMap, validateListing
} from './lib/us-listings.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public-data', 'us-listings.json');
const UNIVERSE = join(ROOT, 'public-data', 'screener-universe.json');
const FRESH_MS = 20 * 60 * 60 * 1000;

async function fetchText(url, headers, tries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers });
      if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < tries) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

async function main() {
  const previous = await readJson(OUT);
  const previousAt = Date.parse(previous?.generatedAt || '') || 0;
  if (process.env.US_LISTINGS_FORCE !== '1' && previousAt && Date.now() - previousAt < FRESH_MS) {
    console.log(`[us-listings] fresh (${previous.generatedAt}) — skipping`);
    return;
  }
  try {
    const directoryHeaders = { 'User-Agent': 'aio-screener data refresh (GitHub Actions)', Accept: 'text/plain,*/*' };
    const [nasdaqText, otherText] = await Promise.all([fetchText(NASDAQ_LISTED_URL, directoryHeaders), fetchText(OTHER_LISTED_URL, directoryHeaders)]);
    const { rows, dropped, fileCreationTime } = buildListingRows(nasdaqText, otherText);

    let joined = rows.map((row) => ({ ...row, cik: null }));
    let secJoin = { status: 'skipped', reason: 'SEC_USER_AGENT not set' };
    const secAgent = String(process.env.SEC_USER_AGENT || '').trim();
    if (secAgent) {
      try {
        const payload = JSON.parse(await fetchText(SEC_TICKERS_URL, { 'User-Agent': secAgent, Accept: 'application/json' }));
        const result = joinSecCik(rows, secCikMap(payload));
        joined = result.rows;
        secJoin = { status: 'joined', ...result.summary };
      } catch (error) {
        secJoin = { status: 'failed', reason: String(error?.message || error).slice(0, 200) };
        console.log(`::warning::us-listings SEC CIK join failed (${secJoin.reason}); cik stays null this cycle`);
      }
    } else {
      console.log('::notice::SEC_USER_AGENT is not set — us-listings publishes without CIKs');
    }

    const universe = (await readJson(UNIVERSE))?.universe || [];
    const check = validateListing(joined, universe);
    if (!check.ok) throw new Error(`floors not met: ${check.failures.join('; ')}`);
    const asOf = fileCreationDate(fileCreationTime.otherlisted) || fileCreationDate(fileCreationTime.nasdaqlisted) || new Date().toISOString().slice(0, 10);
    const artifact = buildArtifact(joined, { generatedAt: new Date().toISOString(), asOf, fileCreationTime, dropped, coverage: check.coverage, secJoin });
    const body = `${JSON.stringify(artifact)}\n`;
    await atomicWriteFile(OUT, body);
    console.log(`[us-listings] ${joined.length} symbols as of ${asOf} · ${Buffer.byteLength(body).toLocaleString('en-US')} bytes · core misses ${check.coverage.coreMissing.length} · SEC ${secJoin.status}${secJoin.matched != null ? ` ${secJoin.matched} CIKs` : ''}`);
  } catch (error) {
    console.log(`::warning::US listings not refreshed (${error?.message || error}); ${previous ? 'previous file kept' : 'no previous file'}`);
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/build-us-listings.mjs')) await main();
