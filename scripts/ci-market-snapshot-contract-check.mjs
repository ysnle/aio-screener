import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMarketSnapshot, TIER_0_INSTRUMENTS, validateMarketSnapshot, tier0Coverage } from '../src/data/contracts/market-snapshot.js';
import { buildMarketSnapshot, deriveMarketSession } from './build-market-snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const fail = (message) => { throw new Error(`[market-snapshot-contract] ${message}`); };

const published = readJson('public-data/market-snapshot.json');
const validation = validateMarketSnapshot(published);
if (!validation.ok) fail(`published artifact invalid: ${validation.errors.join(',')}`);
if (published.status !== 'published') fail(`published artifact is ${published.status}`);
const coverage = tier0Coverage(published.quotes);
if (coverage.observed !== coverage.required) fail(`Tier 0 coverage ${coverage.observed}/${coverage.required}`);
if (published.coverage?.tier0Observed !== coverage.observed) fail('coverage sidecar does not match quote rows');
if (published.quotes.length !== TIER_0_INSTRUMENTS.length) fail('bounded artifact must contain exactly the Tier 0 allowlist');
if (published.quotes.some((quote) => !quote.session || quote.session === 'UNKNOWN')) fail('published artifact contains unknown market session');

const sessionFixtures = [
  ['^GSPC', '2026-07-28T22:00:00.000Z', '2026-07-28T22:05:00.000Z', 'MARKET_CLOSED'],
  ['^GSPC', '2026-07-31T20:00:00.000Z', '2026-08-01T05:53:00.000Z', 'MARKET_CLOSED'],
  ['^GSPC', '2026-07-31T20:00:00.000Z', '2026-08-01T05:53:00.000Z', 'MARKET_CLOSED', 'REGULAR'],
  ['^KS11', '2026-07-28T01:55:00.000Z', '2026-07-28T02:00:00.000Z', 'CURRENT_SESSION'],
  ['KRW=X', '2026-07-28T01:59:00.000Z', '2026-07-28T02:00:00.000Z', 'CURRENT_SESSION'],
  ['BTC-USD', '2026-07-28T01:00:00.000Z', '2026-07-28T03:00:00.000Z', 'DELAYED_IN_SESSION']
];
for (const [instrumentId, observedAt, now, expected, providerSession] of sessionFixtures) {
  const actual = deriveMarketSession({ instrumentId, observedAt, providerSession, now: Date.parse(now) });
  if (actual !== expected) fail(`${instrumentId} session fixture expected ${expected}, got ${actual}`);
}

const attemptedAt = '2026-07-18T00:00:00.000Z';
const fixtureQuotes = TIER_0_INSTRUMENTS.map((instrument, index) => ({
  symbol: instrument.instrumentId,
  regularMarketPrice: index + 100,
  regularMarketChangePercent: index / 10,
  regularMarketPreviousClose: index + 99,
  observedAt: attemptedAt,
  fetchedAt: attemptedAt,
  marketSession: 'CLOSED',
  _source: 'fixture'
}));
const fixture = buildMarketSnapshot({ quotes: fixtureQuotes, attemptedAt, source: 'fixture' });
if (!fixture.complete || !validateMarketSnapshot(fixture.snapshot).ok) fail('complete fixture did not publish');
const incomplete = buildMarketSnapshot({ quotes: fixtureQuotes.slice(1), attemptedAt, source: 'fixture' });
if (incomplete.complete || incomplete.snapshot.status !== 'failed') fail('incomplete fixture was not fail-closed');

const loaderSource = fs.readFileSync(path.join(root, 'src/data/market-snapshot-loader.js'), 'utf8');
if (!loaderSource.includes('snapshot_not_published') || !loaderSource.includes('validateMarketSnapshot')) fail('browser loader lacks fail-closed validation');
const bridgeSource = fs.readFileSync(path.join(root, 'src/legacy/market-snapshot-bridge.js'), 'utf8');
if (!bridgeSource.includes("policyKey: 'static_snapshot'") || !bridgeSource.includes('market-snapshot-fallback')) fail('legacy bridge does not preserve snapshot provenance');
const refresh = fs.readFileSync(path.join(root, '.github/workflows/refresh-data.yml'), 'utf8');
if (!refresh.includes('public-data/market-snapshot.json') || !refresh.includes('market-snapshot-status.json')) fail('refresh workflow does not publish snapshot artifacts');

console.log(JSON.stringify({
  ok: true,
  revision: published.revision,
  status: published.status,
  tier0: coverage,
  fixture: { complete: fixture.complete, incompleteStatus: incomplete.snapshot.status },
  loader: pathToFileURL(path.join(root, 'src/data/market-snapshot-loader.js')).href
}));
