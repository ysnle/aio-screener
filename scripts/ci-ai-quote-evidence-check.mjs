import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const core = read('js/aio-core.js');
const data = read('js/aio-data.js');
const chat = read('js/aio-chat.js');

const helperStart = core.indexOf('var _AIO_CLAIM_SCHEMA_VERSION');
const helperEnd = core.indexOf('function _aioClaimEvidenceList', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'quote evidence helper slice is present');

const sandbox = {
  window: { AIO: {} },
  console,
  Date,
  Number,
  String,
  Object,
  Array,
  Math,
  isFinite,
  URL
};
vm.runInNewContext(core.slice(helperStart, helperEnd), sandbox, { filename: 'js/aio-core.js#quote-evidence' });
const AIO = sandbox.window.AIO;
assert.equal(typeof AIO.buildAIQuoteEvidenceRow, 'function', 'canonical quote evidence helper is exposed');
assert.equal(typeof AIO.normalizeAIChatEvidenceRow, 'function', 'chat evidence normalizer remains exposed');

const normalizeBlock = core.slice(core.indexOf('window.AIO.normalizeAIChatEvidenceRow'), core.indexOf('function _aioClaimEvidenceList'));
assert.doesNotMatch(normalizeBlock, /input\.fetchedAt\s*\|\|\s*input\.generatedAt/, 'chat normalization cannot use fetch/generation time as observation');
assert.doesNotMatch(normalizeBlock, /input\.sourceTs/, 'chat normalization cannot substitute a source/collection timestamp for observation');
assert.doesNotMatch(normalizeBlock, /source\s*\?\s*['"]LIVE['"]/, 'arbitrary source cannot be promoted to LIVE');
assert.match(core, /window\.AIO\.buildAIQuoteEvidenceRow\s*=\s*function/, 'shared quote evidence producer exists');
assert.match(core.slice(core.indexOf('window.AIO.getChatEvidenceContext')), /buildAIQuoteEvidenceRow/, 'chat evidence context consumes the shared producer');

const freshnessStart = data.indexOf('window.AIO.getChatAnswerFreshnessAudit');
const freshnessEnd = data.indexOf('window.AIO.ensureFreshChatAnswerData', freshnessStart);
assert.ok(freshnessStart >= 0 && freshnessEnd > freshnessStart, 'freshness audit slice is present');
const freshness = data.slice(freshnessStart, freshnessEnd);
assert.match(freshness, /buildAIQuoteEvidenceRow/, 'freshness audit consumes the shared producer');
assert.doesNotMatch(freshness, /_aioTickerQuoteAgeMs\(t\)/, 'freshness age is based on quote observation, not fetch cache age');

const producerStart = data.indexOf('function _aioNormalizeAtomicQuote');
const producerEnd = data.indexOf('function _aioAtomicSourceRank', producerStart);
const producer = data.slice(producerStart, producerEnd);
assert.match(producer, /_atomicObservedAt/, 'atomic producer preserves observation timestamp');
const applyStart = data.indexOf('function applyLiveQuotes');
const applyEnd = data.indexOf('function ', data.indexOf('window._dataSource[q.symbol]', applyStart));
const apply = data.slice(applyStart, applyEnd > applyStart ? applyEnd : applyStart + 24000);
assert.match(apply, /quoteEnvelope:\s*\{[\s\S]{0,1000}price:\s*price/, 'live quote envelope preserves price');
assert.match(apply, /quoteEnvelope:\s*\{[\s\S]{0,1200}observedAt:\s*q\._atomicObservedAt/, 'live quote envelope preserves observation time');
assert.match(apply, /quoteEnvelope:\s*\{[\s\S]{0,1400}currency:\s*_quoteCurrency/, 'live quote envelope preserves upstream currency');
assert.match(apply, /quoteEnvelope:\s*\{[\s\S]{0,1400}unit:\s*_quoteUnit/, 'live quote envelope preserves quote unit');

const observedAt = new Date(Date.now() - 30 * 1000).toISOString();
const truth = { status: 'verified', decisionUse: true, issues: [], warnings: [] };
const quote = {
  ticker: 'AAPL',
  price: 197.25,
  currency: 'USD',
  quoteEnvelope: {
    revision: 'fixture-revision',
    source: 'live:yahoo-v7-batch',
    price: 197.25,
    currency: 'USD',
    unit: 'USD',
    observedAt,
    fetchedAt: new Date().toISOString()
  }
};
const contextRow = AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth });
const freshnessRow = AIO.buildAIQuoteEvidenceRow('AAPL', { ...quote, source: 'ignored-legacy-source' }, { truth });
const tuple = row => [row.evidenceId, row.metric, row.entity, row.value, row.unit, row.currency, row.asOf, row.source, row.sourceKind];
assert.deepEqual(tuple(contextRow), tuple(freshnessRow), 'both consumers produce one coherent evidence tuple');
assert.equal(contextRow.status, 'verified');
assert.equal(contextRow.decisionUse, true);
assert.equal(contextRow.metric, 'price');
assert.equal(contextRow.entity, 'AAPL');
assert.equal(contextRow.asOf, observedAt);
assert.equal(contextRow.sourceKind, 'LIVE');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth: { status: 'unknown', decisionUse: true } }).status, 'blocked');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth: { status: 'stale', decisionUse: true } }).status, 'blocked');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', { ...quote, observedAt: new Date(Date.now() - 600000).toISOString() }, { truth }).status, 'blocked');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth, source: 'spoof', sourceKind: 'SNAPSHOT' }).source, contextRow.source);

const noObservation = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  quoteEnvelope: { source: 'live:yahoo', currency: 'USD', unit: 'USD', fetchedAt: new Date().toISOString(), generatedAt: new Date().toISOString() }
}, { truth });
assert.equal(noObservation.status, 'blocked');
assert.equal(noObservation.asOf, null);
assert.ok(noObservation.blockers.includes('observation-missing'));

const noSource = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  source: 'live:yahoo',
  quoteEnvelope: { price: 197.25, observedAt, currency: 'USD', unit: 'USD' }
}, { truth });
assert.equal(noSource.status, 'blocked');
assert.equal(noSource.sourceKind, 'UNKNOWN');
assert.ok(noSource.blockers.includes('source-missing'));

const noCurrency = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  currency: 'USD',
  quoteEnvelope: { price: 197.25, observedAt, source: 'live:yahoo' }
}, { truth });
assert.equal(noCurrency.status, 'blocked');
assert.equal(noCurrency.currency, 'UNKNOWN');
assert.equal(noCurrency.unit, 'UNKNOWN');
assert.ok(noCurrency.blockers.includes('currency-missing'));
assert.ok(noCurrency.blockers.includes('unit-missing'));

const arbitrarySource = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  quoteEnvelope: { price: 197.25, observedAt, source: 'provider-claimed-live', currency: 'USD', unit: 'USD' }
}, { truth });
assert.equal(arbitrarySource.sourceKind, 'UNKNOWN');
assert.equal(arbitrarySource.status, 'blocked');

const mismatchedPrice = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  quoteEnvelope: { price: 198.25, observedAt, source: 'live:yahoo', currency: 'USD', unit: 'USD' }
}, { truth });
assert.equal(mismatchedPrice.status, 'blocked');
assert.ok(mismatchedPrice.blockers.includes('price-envelope-mismatch'));

const truthMismatch = AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth: { status: 'verified', decisionUse: false } });
assert.equal(truthMismatch.status, 'blocked');
assert.equal(truthMismatch.decisionUse, false);

const normalizedMissing = AIO.normalizeAIChatEvidenceRow({
  ticker: 'AAPL', price: 197.25, source: 'live:yahoo', asOf: observedAt, truthStatus: 'verified', status: 'ok'
});
assert.equal(normalizedMissing.status, 'blocked', 'normalizer fails closed when quote currency/unit is absent');
assert.equal(normalizedMissing.asOf, observedAt);
const normalizedFetchedOnly = AIO.normalizeAIChatEvidenceRow({
  ticker: 'AAPL', price: 197.25, source: 'live:yahoo', sourceTs: observedAt, fetchedAt: observedAt, currency: 'USD', unit: 'USD', truthStatus: 'verified'
});
assert.equal(normalizedFetchedOnly.asOf, null, 'fetchedAt cannot become quote observation');
assert.equal(normalizedFetchedOnly.status, 'blocked');
const normalizedArbitrary = AIO.normalizeAIChatEvidenceRow({
  ticker: 'AAPL', price: 197.25, source: 'provider-claimed-live', asOf: observedAt, currency: 'USD', unit: 'USD', truthStatus: 'verified'
});
assert.equal(normalizedArbitrary.sourceKind, 'UNKNOWN');
assert.equal(normalizedArbitrary.status, 'blocked');

const evidenceStart = chat.indexOf('function _aioAIClaimEvidenceId(');
const evidenceEnd = chat.indexOf('function _aioHasCurrentNumericContent(', evidenceStart);
assert.ok(evidenceStart >= 0 && evidenceEnd > evidenceStart, 'claim evidence collector slice is present');
sandbox.window.AIO.normalizeAIChatEvidenceRow = row => ({ ...row });
vm.runInNewContext(chat.slice(evidenceStart, evidenceEnd), sandbox, { filename: 'js/aio-chat.js#quote-evidence-conflict' });
const duplicateConflict = sandbox._aioCollectAIClaimEvidence({ evidence: [contextRow, { ...contextRow, value: 198.25 }] });
assert.equal(duplicateConflict.length, 1, 'duplicate quote evidence IDs collapse to one registry row');
assert.equal(duplicateConflict[0].status, 'conflict', 'conflicting duplicate quote tuples are rejected');

console.log('PASS ai-quote-evidence: shared envelope tuple, observation/source/currency fail-closed rules, sibling consumer parity and duplicate conflict rejection');
