import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMarketSnapshot, TIER_0_INSTRUMENTS, validateMarketSnapshot, tier0Coverage } from '../src/data/contracts/market-snapshot.js';
import { buildMarketSnapshot, deriveMarketSession } from './build-market-snapshot.mjs';
import { isLatestUsRegularClose } from '../src/ai/time/market-session.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const fail = (message) => { throw new Error(`[market-snapshot-contract] ${message}`); };

for (const absent of [null, undefined, '', false]) {
  const quote = createMarketSnapshot({ quotes: [{ symbol: '^GSPC', price: 100, previousClose: absent, delayedByMs: absent }] }).quotes[0];
  if (quote.changeBasis !== 'unknown' || quote.delayedByMs !== null) fail('missing baseline/delay was promoted to observed evidence');
}
const zeroDelay = createMarketSnapshot({ quotes: [{ symbol: '^GSPC', price: 100, previousClose: 99, delayedByMs: 0 }] }).quotes[0];
if (zeroDelay.changeBasis !== 'provider-previous-value' || zeroDelay.delayedByMs !== 0) fail('observed baseline/explicit zero delay was lost');

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
  ['BTC-USD', '2026-07-28T01:00:00.000Z', '2026-07-28T03:00:00.000Z', 'DELAYED_IN_SESSION'],
  ['BTC-USD', '2026-07-28T04:00:01.000Z', '2026-07-28T03:00:00.000Z', 'SOURCE_UNAVAILABLE']
];
for (const [instrumentId, observedAt, now, expected, providerSession] of sessionFixtures) {
  const actual = deriveMarketSession({ instrumentId, observedAt, providerSession, now: Date.parse(now) });
  if (actual !== expected) fail(`${instrumentId} session fixture expected ${expected}, got ${actual}`);
}

const attemptedAt = '2026-07-18T00:00:00.000Z';
// P1045: elapsed wall time is not a substitute for a completed session date.
const closeFixtures = [
  ['^GSPC', '2026-09-04T20:00:00Z', '2026-09-07T01:30:00Z', true],
  ['^GSPC', '2026-09-04T20:00:00Z', '2026-09-07T16:00:00Z', true],
  ['^GSPC', '2026-09-04T20:00:00Z', '2026-09-08T13:29:00Z', true],
  ['^GSPC', '2026-09-04T20:00:00Z', '2026-09-08T13:30:00Z', false],
  ['^GSPC', '2026-09-03T20:00:00Z', '2026-09-07T16:00:00Z', false],
  ['^GSPC', '2026-09-04T14:00:00Z', '2026-09-07T16:00:00Z', false],
  ['^TNX', '2026-09-04T18:59:54Z', '2026-09-07T16:00:00Z', true],
  ['^GSPC', '2026-11-27T18:00:00Z', '2026-11-29T16:00:00Z', true],
  ['^GSPC', '2026-11-27T16:00:00Z', '2026-11-29T16:00:00Z', false],
  ['^GSPC', '2026-03-06T21:00:00Z', '2026-03-09T13:29:00Z', true],
  ['^GSPC', '2026-03-06T21:00:00Z', '2026-03-09T13:30:00Z', false],
  ['^GSPC', '2026-12-31T21:00:00Z', '2027-01-02T12:00:00Z', false],
  ['BTC-USD', '2026-09-04T20:00:00Z', '2026-09-07T16:00:00Z', false],
  ['^KS11', '2026-09-04T06:30:00Z', '2026-09-07T16:00:00Z', false],
  ['^GSPC', '2026-09-08T20:00:00Z', '2026-09-07T16:00:00Z', false]
];
for (const [instrumentId, observedAt, asOf, expected] of closeFixtures) {
  const now = Date.parse(asOf);
  if (isLatestUsRegularClose({ instrumentId, observedAt, now }) !== expected) fail(`calendar close fixture: ${instrumentId} ${observedAt} at ${asOf}`);
  if (expected) {
    const result = buildMarketSnapshot({ quotes: [{ symbol: instrumentId, value: 100, observedAt, marketState: 'REGULAR' }], now, attemptedAt: asOf });
    const row = result.snapshot.quotes[0];
    if (row?.quality !== 'CLOSED_CURRENT' || row?.session !== 'MARKET_CLOSED') fail('latest completed close did not survive producer quality gate');
  }
}
const fixtureQuotes = TIER_0_INSTRUMENTS.map((instrument, index) => ({
  symbol: instrument.instrumentId,
  regularMarketPrice: index + 100,
  regularMarketChangePercent: index / 10,
  regularMarketPreviousClose: index + 99,
  observedAt: attemptedAt,
  fetchedAt: attemptedAt,
  marketSession: 'CLOSED',
  _source: 'fixture',
  sourceTier: index === 0 ? 'public-api-plan' : 'public-information-service'
}));
const fixture = buildMarketSnapshot({ quotes: fixtureQuotes, attemptedAt, source: 'fixture', now: Date.parse(attemptedAt) });
if (!fixture.complete || !validateMarketSnapshot(fixture.snapshot).ok) fail('complete fixture did not publish');
if (fixture.snapshot.quotes[0].sourceKind !== 'public-api-plan') fail('provider source kind was overwritten by the snapshot builder');
if (fixture.snapshot.quotes.some((row) => row.valueBasis !== 'provider-current-value')) fail('current quote value was mislabeled as its previous-value change basis');
const incomplete = buildMarketSnapshot({ quotes: fixtureQuotes.slice(1), attemptedAt, source: 'fixture', now: Date.parse(attemptedAt) });
if (incomplete.complete || incomplete.snapshot.status !== 'failed') fail('incomplete fixture was not fail-closed');
const staleAttemptedAt = '2026-07-28T12:00:00.000Z';
const stale = buildMarketSnapshot({ quotes: fixtureQuotes, attemptedAt: staleAttemptedAt, source: 'fixture', now: Date.parse(staleAttemptedAt) });
if (stale.complete || stale.snapshot.status !== 'failed' || !stale.snapshot.quotes.every((row) => row.quality === 'STALE')) fail('stale Tier-0 rows were promoted by a fresh build timestamp');
if (!stale.snapshot.errors.some((error) => error.startsWith('tier0_quality:'))) fail('stale publish failure omitted row-level quality evidence');
const futureObservedAt = '2026-07-18T01:00:01.000Z';
const futureQuotes = fixtureQuotes.map((row) => ({ ...row, observedAt: futureObservedAt, fetchedAt: attemptedAt }));
const future = buildMarketSnapshot({ quotes: futureQuotes, attemptedAt, source: 'fixture', now: Date.parse(attemptedAt) });
if (future.complete || !future.snapshot.quotes.every((row) => row.quality === 'QUARANTINED' && row.session === 'SOURCE_UNAVAILABLE')) fail('future Tier-0 observations were not quarantined');
const missingObservation = buildMarketSnapshot({ quotes: fixtureQuotes.map((row, index) => index === 0 ? { ...row, observedAt: null } : row), attemptedAt, source: 'fixture', now: Date.parse(attemptedAt) });
if (missingObservation.complete || missingObservation.coverage.observed !== TIER_0_INSTRUMENTS.length - 1) fail('missing observation time did not fail closed as incomplete coverage');

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
  fixture: { complete: fixture.complete, incompleteStatus: incomplete.snapshot.status, staleStatus: stale.snapshot.status, futureStatus: future.snapshot.status },
  loader: pathToFileURL(path.join(root, 'src/data/market-snapshot-loader.js')).href
}));
