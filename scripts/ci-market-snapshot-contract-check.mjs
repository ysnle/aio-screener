import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMarketSnapshot, TIER_0_INSTRUMENTS, validateInstrumentRegistry, validateMarketSnapshot, tier0Coverage } from '../src/data/contracts/market-snapshot.js';
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
// R24-02/P1178: metric identity is part of the registry contract. Instrument,
// unit, and value can all look plausible while the quote names a different
// metric entirely, so the validator must reject the mismatch instead of
// letting normalizeQuote's registry fallback hide it — and a swapped pair can
// never count as coverage.
tamperCase('R24-02/P1178 metricId changed to a foreign metric', (candidate) => { candidate.quotes[0].metricId = 'wrong.metric.id'; }, 'quote_metric_mismatch');
tamperCase('R24-02/P1178 metricId removed', (candidate) => { delete candidate.quotes[0].metricId; }, 'quote_metric_id_registry_derived');
{
  const candidate = JSON.parse(JSON.stringify(tamperBase));
  const firstMetric = candidate.quotes[0].metricId;
  const secondMetric = candidate.quotes[1].metricId;
  candidate.quotes[0].metricId = secondMetric;
  candidate.quotes[1].metricId = firstMetric;
  const result = validateMarketSnapshot(createMarketSnapshot(candidate));
  if (result.ok) fail('R24-02/P1178 swapped metricIds were accepted');
  if (result.audit.metricMismatches.length !== 2) fail(`R24-02/P1178 swapped metricIds produced ${result.audit.metricMismatches.length} mismatches, expected 2`);
  if (result.audit.measured.observed !== TIER_0_INSTRUMENTS.length - 2) fail('R24-02/P1178 a swapped metric still counted toward coverage');
}
{
  // Positive control: a quote that legitimately omits metricId round-trips the
  // registry value with an explicit derivation marker, and non-published
  // snapshots tolerate it — only a published identity may not be derived.
  const derived = createMarketSnapshot({ status: 'unavailable', quotes: [{ symbol: '^GSPC', price: 100, observedAt: attemptedAt, fetchedAt: attemptedAt }] }).quotes[0];
  if (derived.metricId !== 'market.index.spx' || derived.metricIdBasis !== 'registry-derived') fail(`R24-02/P1178 registry round-trip broken: ${derived.metricId}/${derived.metricIdBasis}`);
  const supplied = createMarketSnapshot({ quotes: [{ symbol: '^GSPC', metricId: 'market.index.spx', price: 100 }] }).quotes[0];
  if (supplied.metricIdBasis !== 'supplied') fail('R24-02/P1178 a supplied metricId was not recorded as supplied');
  const publishedDerived = JSON.parse(JSON.stringify(tamperBase));
  delete publishedDerived.quotes[0].metricId;
  const result = validateMarketSnapshot(createMarketSnapshot(publishedDerived));
  if (result.ok || !result.errors.some((error) => error.startsWith('quote_metric_id_registry_derived:'))) {
    fail(`R24-02/P1178 a published quote with derived metric identity was not isolated: ${result.errors.join(',')}`);
  }
}
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
// W03-C/P1183: the quote identity tuple is (instrumentId, metricId, unit, valueKind)
// and the source fields are evidence claims, not cosmetic labels. Normalization used to
// fill 'unknown'/'provider' defaults for a missing source/sourceKind — which made the
// existence loop vacuous — and the registry itself was never validated, so a duplicated
// or malformed 정본 row silently weakened every comparison made against it.
tamperCase('P1183 source removed', (candidate) => { delete candidate.quotes[0].source; }, 'quote_source_missing');
tamperCase('P1183 sourceKind removed', (candidate) => { delete candidate.quotes[0].sourceKind; }, 'quote_sourceKind_missing');
tamperCase('P1183 invented sourceKind', (candidate) => { candidate.quotes[0].sourceKind = 'invented-provider-tier'; }, 'quote_source_kind_unrecognized');
tamperCase('P1183 valueKind contradicts the registry', (candidate) => { candidate.quotes[0].valueKind = 'rate'; }, 'quote_value_kind_mismatch');
{
  const candidate = JSON.parse(JSON.stringify(tamperBase));
  candidate.quotes[0].valueKind = 'price';
  const result = validateMarketSnapshot(createMarketSnapshot(candidate));
  if (result.audit.valueKindMismatches.length !== 1) fail(`P1183 a foreign valueKind produced ${result.audit.valueKindMismatches.length} mismatches, expected 1`);
  if (result.audit.measured.observed !== TIER_0_INSTRUMENTS.length - 1) fail('P1183 a foreign valueKind still counted toward coverage');
}
{
  // Positive controls: artifacts predating valueKind keep counting (kind derived from
  // the registry), a supplied kind is recorded as supplied, and a missing source is
  // left missing instead of being promoted to 'unknown'/'provider'.
  const derived = createMarketSnapshot({ status: 'unavailable', quotes: [{ symbol: '^GSPC', price: 100, observedAt: attemptedAt, fetchedAt: attemptedAt }] }).quotes[0];
  if (derived.valueKind !== 'index' || derived.valueKindBasis !== 'registry-derived') fail(`P1183 valueKind round-trip broken: ${derived.valueKind}/${derived.valueKindBasis}`);
  const supplied = createMarketSnapshot({ quotes: [{ symbol: '^GSPC', valueKind: 'index', price: 100 }] }).quotes[0];
  if (supplied.valueKindBasis !== 'supplied') fail('P1183 a supplied valueKind was not recorded as supplied');
  const stripped = published.quotes.map(({ valueKind, ...row }) => row);
  const strippedCoverage = tier0Coverage(stripped);
  if (strippedCoverage.observed !== strippedCoverage.required) fail('P1183 a pre-valueKind artifact was excluded from coverage instead of deriving the kind from the registry');
  if (derived.source !== '' || derived.sourceKind !== '') fail(`P1183 a missing source was promoted to a value: ${derived.source}/${derived.sourceKind}`);
}
{
  // P1183: the registry validates itself first. A duplicated metric or an undeclared
  // valueKind in the 정본 cannot be laundered by quotes that match it.
  if (!validateInstrumentRegistry(TIER_0_INSTRUMENTS).ok) fail('P1183 the shipped Tier-0 registry does not validate');
  const duplicateMetric = TIER_0_INSTRUMENTS.map((row, index) => index === 1 ? { ...row, metricId: TIER_0_INSTRUMENTS[0].metricId } : row);
  const malformedMetric = TIER_0_INSTRUMENTS.map((row, index) => index === 0 ? { ...row, metricId: 'Market.Index.SPX' } : row);
  const badKind = TIER_0_INSTRUMENTS.map((row, index) => index === 0 ? { ...row, valueKind: 'banana' } : row);
  const duplicateInstrument = [...TIER_0_INSTRUMENTS.slice(0, TIER_0_INSTRUMENTS.length - 1), { ...TIER_0_INSTRUMENTS[0] }];
  for (const [label, instruments, expected] of [
    ['duplicate metricId', duplicateMetric, 'registry_metric_duplicate'],
    ['malformed metricId', malformedMetric, 'registry_metric_id_malformed'],
    ['undeclared valueKind', badKind, 'registry_value_kind_invalid'],
    ['duplicate instrumentId', duplicateInstrument, 'registry_instrument_duplicate']
  ]) {
    const result = validateMarketSnapshot(createMarketSnapshot(tamperBase), { instruments });
    if (result.ok || !result.errors.some((error) => error.startsWith('registry_invalid:') && error.includes(expected))) {
      fail(`P1183 a corrupted registry (${label}) was accepted: ${result.errors.join(',')}`);
    }
  }
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
  const badMetricPayload = JSON.parse(JSON.stringify(tamperBase));
  badMetricPayload.quotes[0].metricId = 'wrong.metric.id';
  const badMetric = await createMarketSnapshotLoader({ httpClient: responseFor(badMetricPayload) }).load();
  if (badMetric.ok || !String(badMetric.error).includes('quote_metric_mismatch')) fail(`R24-02/P1178: the loader accepted a foreign metricId: ${JSON.stringify(badMetric)}`);
  const badKindPayload = JSON.parse(JSON.stringify(tamperBase));
  badKindPayload.quotes[0].valueKind = 'rate';
  const badKind = await createMarketSnapshotLoader({ httpClient: responseFor(badKindPayload) }).load();
  if (badKind.ok || !String(badKind.error).includes('quote_value_kind_mismatch')) fail(`W03-C/P1183: the loader accepted a foreign valueKind: ${JSON.stringify(badKind)}`);
  const badSourcePayload = JSON.parse(JSON.stringify(tamperBase));
  delete badSourcePayload.quotes[0].source;
  const badSource = await createMarketSnapshotLoader({ httpClient: responseFor(badSourcePayload) }).load();
  if (badSource.ok || !String(badSource.error).includes('quote_source_missing')) fail(`W03-C/P1183: the loader accepted a quote with no source: ${JSON.stringify(badSource)}`);
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
