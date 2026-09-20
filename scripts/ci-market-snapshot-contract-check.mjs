import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMarketSnapshot, TIER_0_INSTRUMENTS, validateMarketSnapshot, tier0Coverage } from '../src/data/contracts/market-snapshot.js';
import { createMarketSnapshotLoader } from '../src/data/market-snapshot-loader.js';
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

// W03-A/P1145: publishing is accepted from the MEASURED required set, not the
// payload's self-reported coverage. Each tamper must be rejected, a duplicate can
// never round up declared coverage, and optional Tier-1 gaps must not become a
// Tier-0 failure.
const tamperBase = readJson('public-data/market-snapshot.json');
const tamperCase = (label, mutate, expectedError) => {
  const candidate = JSON.parse(JSON.stringify(tamperBase));
  mutate(candidate);
  const result = validateMarketSnapshot(createMarketSnapshot(candidate));
  if (result.ok) fail(`W03-A tamper "${label}" was accepted`);
  if (expectedError && !result.errors.some((error) => error.includes(expectedError))) fail(`W03-A tamper "${label}" lacked ${expectedError}: ${result.errors.join(',')}`);
};
tamperCase('quotes removed', (candidate) => { candidate.quotes = []; }, 'published_coverage_below_100_percent');
tamperCase('first instrument removed', (candidate) => { candidate.quotes = candidate.quotes.slice(1); }, 'published_tier0_missing');
tamperCase('unit changed', (candidate) => { candidate.quotes[0].unit = 'WRONG_UNIT'; }, 'published_unit_mismatch');
tamperCase('duplicate instrument', (candidate) => { candidate.quotes[1] = { ...candidate.quotes[0] }; }, 'published_tier0_duplicate');
tamperCase('unknown instrument', (candidate) => { candidate.quotes[0].instrumentId = 'NOT-IN-REGISTRY'; }, 'published_instrument_unknown');
tamperCase('declared over ship', (candidate) => { candidate.coverage = { ...candidate.coverage, required: 17, tier0Required: 17 }; }, 'published_declared_coverage_mismatch');
{
  const candidate = JSON.parse(JSON.stringify(tamperBase));
  candidate.quotes[1] = { ...candidate.quotes[0], evidenceId: 'duplicate:two' };
  const audit = validateMarketSnapshot(createMarketSnapshot(candidate)).audit;
  if (audit.measured.observed !== TIER_0_INSTRUMENTS.length - 2 || !audit.duplicates.includes(candidate.quotes[0].instrumentId)) fail('W03-A: a duplicate instrument was counted as distinct coverage');
}
{
  const candidate = JSON.parse(JSON.stringify(tamperBase));
  candidate.coverage = { ...candidate.coverage, tier1Required: 4, tier1Observed: 1 };
  const result = validateMarketSnapshot(createMarketSnapshot(candidate));
  if (!result.ok || result.audit.tier1.complete !== false || result.audit.declaredMatchesMeasured !== true) fail(`W03-A: an optional Tier-1 gap was folded into Tier-0 acceptance: ${JSON.stringify(result)}`);
}
// The loader must accept the published artifact and refuse a tampered one, so a
// bad payload can never replace the consumer's last-good snapshot.
{
  const responseFor = (payload) => ({ requestJson: async () => ({ ok: true, data: payload }) });
  const good = await createMarketSnapshotLoader({ httpClient: responseFor(readJson('public-data/market-snapshot.json')) }).load();
  if (!good.ok) fail('W03-A: the loader rejected the published artifact');
  const badPayload = JSON.parse(JSON.stringify(tamperBase));
  badPayload.quotes[0].unit = 'WRONG_UNIT';
  const bad = await createMarketSnapshotLoader({ httpClient: responseFor(badPayload) }).load();
  if (bad.ok || !String(bad.error).includes('published_unit_mismatch')) fail(`W03-A: the loader accepted a tampered artifact: ${JSON.stringify(bad)}`);
}

const loaderSource = fs.readFileSync(path.join(root, 'src/data/market-snapshot-loader.js'), 'utf8');
if (!loaderSource.includes('snapshot_not_published') || !loaderSource.includes('validateMarketSnapshot')) fail('browser loader lacks fail-closed validation');

// P1160: a venue that is CONFIRMED closed must not be judged by a 24h "daily session" age. A Friday
// close read on a Sunday is ~46h old, so every Korean index and every FX/futures/commodity
// instrument was classified STALE_UNEXPECTED, the Tier-0 quality gate failed, and
// public-data/market-snapshot.json stopped publishing for the whole weekend — the site then served
// an even older snapshot. US instruments escaped only because isLatestUsRegularClose returns before
// any age check; that asymmetry was the bug, not a policy.
{
  const sunday = Date.parse('2026-09-20T11:00:00Z');
  const fridayClose = new Date('2026-09-18T21:29:48Z').toISOString();
  const freshCrypto = new Date(sunday - 30_000).toISOString();

  // Every confirmed-closed venue keeps the closed label, whatever hint the provider sends.
  for (const instrumentId of ['^KS11', '^KQ11', 'DX-Y.NYB', 'CL=F', 'GC=F']) {
    for (const providerSession of ['REGULAR', 'CLOSED', null]) {
      const session = deriveMarketSession({ instrumentId, observedAt: fridayClose, providerSession, now: sunday });
      if (session !== 'MARKET_CLOSED') fail(`P1160 ${instrumentId} (${providerSession}) on a weekend-closed venue resolved to ${session}`);
    }
  }

  // The outcome that actually decides publication. A session-only assertion would not have caught
  // the second 24h cap in quoteQuality, which mapped MARKET_CLOSED to STALE and blocked the publish
  // anyway — so this asserts the built snapshot, not the intermediate label.
  for (const providerSession of ['REGULAR', 'CLOSED', null]) {
    const quotes = TIER_0_INSTRUMENTS.map((instrument) => ({
      symbol: instrument.instrumentId,
      value: 100,
      observedAt: /-USD$/.test(instrument.instrumentId) ? freshCrypto : fridayClose,
      marketSession: providerSession || undefined,
      regularMarketPreviousClose: 99
    }));
    const built = buildMarketSnapshot({ quotes, attemptedAt: new Date(sunday).toISOString(), now: sunday, source: 'weekend-fixture' });
    if (!built.complete || built.snapshot.quality?.gate !== 'QG-01_PASS' || built.snapshot.errors.length) {
      fail(`P1160 a Sunday snapshot (${providerSession}) did not publish: ${JSON.stringify(built.snapshot.errors)}`);
    }
  }

  // Bounds, not bypasses: a genuinely stale point must stay unexpected, and the closed-venue window
  // does not cover a 24/7 instrument.
  const ancient = new Date(sunday - 10 * 24 * 60 * 60 * 1000).toISOString();
  for (const instrumentId of ['CL=F', '^KS11']) {
    if (deriveMarketSession({ instrumentId, observedAt: ancient, providerSession: 'REGULAR', now: sunday }) !== 'STALE_UNEXPECTED') fail(`P1160 ${instrumentId} accepted a 10-day-old observation as a closed venue`);
  }
  const btc = deriveMarketSession({ instrumentId: 'BTC-USD', observedAt: fridayClose, providerSession: 'REGULAR', now: sunday });
  if (btc !== 'STALE_UNEXPECTED') fail(`P1160 BTC-USD accepted a 2-day-old observation: ${btc}`);
}
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
