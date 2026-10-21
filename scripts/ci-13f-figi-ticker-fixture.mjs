// v58.56 (re-audit #4): 13F ticker chips — exact CUSIP matches only. Proves, without network, the OpenFIGI answer
// classification, the cache/recheck policy, the reference-crosswalk exclusions, the source-conflict rule, the readable
// issuer names, and the page lookup used before the first Actions build has embedded `tickerExact`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyFigiResult, normalizeFigiTicker, selectQueries, mergeEntries, collectDisplayedCusips, buildFigiArtifact, FIGI_MAP_SCHEMA } from './collect-13f-figi-tickers.mjs';
import { buildReferenceTickerMap, resolveExactTicker, cleanIssuerName, isNonCommonTitle } from '../src/domain/masters/ticker-exact.js';
import { createSecurityLookup } from '../src/ui/pages/masters.js';

const common = (ticker, extra = {}) => ({ ticker, exchCode: 'US', marketSector: 'Equity', securityType2: 'Common Stock', name: 'APPLE INC', ...extra });
assert.deepEqual(classifyFigiResult({ data: [common('AAPL')] }), { s: 'EXACT', t: 'AAPL', n: 'APPLE INC' }, 'v58.56 one US common-stock ticker is exact');
assert.deepEqual(classifyFigiResult({ data: [common('AAPL'), common('AAPL', { figi: 'x2' })] }), { s: 'EXACT', t: 'AAPL', n: 'APPLE INC' }, 'v58.56 several listings of one ticker stay exact');
assert.equal(classifyFigiResult({ data: [common('AAA'), common('BBB')] }).s, 'AMBIGUOUS', 'v58.56 two tickers for one CUSIP are discarded');
assert.equal(classifyFigiResult({ data: [{ ticker: 'TSM', exchCode: 'US', marketSector: 'Equity', securityType2: 'Depositary Receipt' }] }).s, 'NOT_COMMON', 'v58.56 an ADR is not common stock');
assert.equal(classifyFigiResult({ data: [common('BRKR', { securityType2: 'Preference' })] }).s, 'NOT_COMMON', 'v58.56 a preferred share is not common stock');
assert.equal(classifyFigiResult({ data: [common('XYZ', { exchCode: 'LN' })] }).s, 'NOT_COMMON', 'v58.56 a non-US listing does not count');
assert.equal(classifyFigiResult({ warning: 'No identifier found.' }).s, 'NOT_FOUND');
assert.equal(classifyFigiResult({ error: 'Invalid idValue' }), null, 'v58.56 a job error is not cached');
assert.equal(normalizeFigiTicker('BRK/B'), 'BRK-B', 'v58.56 FIGI class separator → the app symbol form');
assert.equal(normalizeFigiTicker('AAPL US'), null);
assert.equal(classifyFigiResult({ data: [common('1234')] }).s, 'INVALID_TICKER');

const today = '2026-10-21';
const entries = { '037833100': { s: 'EXACT', t: 'AAPL', on: '2026-09-01' }, '060505104': { s: 'NOT_FOUND', on: '2026-07-01' }, '191216100': { s: 'EXACT', t: 'KO', on: '2026-05-01' } };
assert.deepEqual(selectQueries(['037833100', '060505104', '191216100', '999999999'], entries, { today, cap: 10 }), ['060505104', '191216100', '999999999'], 'v58.56 only new or expired answers are asked again');
assert.deepEqual(selectQueries(['111111111', '222222222', '333333333'], {}, { today, cap: 2 }), ['111111111', '222222222'], 'v58.56 a run is capped');
const merged = mergeEntries(entries, new Map([['999999999', { s: 'AMBIGUOUS' }], ['060505104', null]]), today);
assert.deepEqual(merged['999999999'], { s: 'AMBIGUOUS', on: today });
assert.deepEqual(merged['060505104'], entries['060505104'], 'v58.56 an errored job keeps the previous answer');
const artifact = buildFigiArtifact({ entries: merged, generatedAt: `${today}T00:00:00Z`, keyed: false, asked: 2, answered: 1, status: 'OK' });
assert.equal(artifact.schema, FIGI_MAP_SCHEMA);
assert.deepEqual(artifact.counts, { EXACT: 2, AMBIGUOUS: 1, NOT_COMMON: 0, NOT_FOUND: 1, INVALID_TICKER: 0 });

const shown = collectDisplayedCusips({ holdings: [{ cusip: '037833100' }], managers: [{ id: 'a' }] }, new Map([['a', { holdings: [{ cusipNormalized: '037833100' }, { cusip: '02079k107' }, { cusip: 'BAD' }], comparisons: [{ cusip: '191216100' }] }]]));
assert.deepEqual(shown, ['037833100', '02079K107', '191216100'], 'v58.56 displayed CUSIPs: summary first, deduplicated, malformed dropped');

const referenceMaster = JSON.parse(fs.readFileSync(new URL('../public-data/masters/security-master-reference.json', import.meta.url), 'utf8'));
const reference = buildReferenceTickerMap(referenceMaster);
assert.equal(reference.get('037833100')?.ticker, 'AAPL');
assert.equal(reference.has('02079K107'), false, 'v58.56 Alphabet class C ("filing key" → GOOGL) is not an exact mapping');
assert.equal(reference.has('464286400'), false, 'v58.56 a fund family placeholder ("ETF") is not a ticker');
assert.equal(resolveExactTicker({ titleOfClass: '6.375 PREF SER A', reference: reference.get('116794207') }), null, 'v58.56 a preferred CUSIP does not take the common ticker');
assert.equal(isNonCommonTitle('COM'), false);
assert.equal(isNonCommonTitle('CL A'), false);
assert.equal(resolveExactTicker({ titleOfClass: 'COM', reference: { ticker: 'AAPL' }, figi: { s: 'EXACT', t: 'AAPL' } }), 'AAPL');
assert.equal(resolveExactTicker({ titleOfClass: 'COM', reference: { ticker: 'GOOGL' }, figi: { s: 'EXACT', t: 'GOOG' } }), null, 'v58.56 disagreeing sources → no ticker');
assert.equal(resolveExactTicker({ titleOfClass: 'CAP STK CL C', figi: { s: 'EXACT', t: 'GOOG' } }), 'GOOG');
assert.equal(resolveExactTicker({ titleOfClass: 'COM', figi: { s: 'AMBIGUOUS' } }), null);

assert.equal(cleanIssuerName('BANK OF AMER CORP'), 'Bank of Amer Corp.', 'v58.56 readable case, standard suffix; ambiguous AMER left as filed');
assert.equal(cleanIssuerName('WESCO INTL INC'), 'Wesco International Inc.');
assert.equal(cleanIssuerName('AMAZON COM INC COM'), 'Amazon Com Inc.');
assert.equal(cleanIssuerName('SLM CORP'), 'SLM Corp.', 'v58.56 short symbols stay upper case');
assert.equal(cleanIssuerName('Alcoa Corp'), 'Alcoa Corp', 'v58.56 mixed-case names are kept as filed');
assert.equal(cleanIssuerName('AT&T INC'), 'AT&T Inc.');
assert.equal(cleanIssuerName('UNION PAC CORP'), 'Union Pacific Corp.');

const row = (cusip, issuer, titleOfClass = 'COM', extra = {}) => ({ cusipNormalized: cusip, issuer, titleOfClass, ...extra });
const before = createSecurityLookup({ holdings: [] }, referenceMaster);
assert.equal(before.tickerOf(row('060505104', 'BANK OF AMER CORP')), 'BAC', 'v58.56 before the first build: exact reference entries');
assert.equal(before.nameOf(row('060505104', 'BANK OF AMER CORP')), 'Bank of America Corp.', 'v58.56 an exact match uses the crosswalk name');
assert.equal(before.tickerOf(row('02079K107', 'ALPHABET INC', 'CAP STK CL C')), null);
assert.equal(before.tickerOf(row('999999999', 'APPLE INC')), null, 'v58.56 no match by name');
const after = createSecurityLookup({ holdings: [], tickerExactPolicy: { sources: [] } }, referenceMaster);
assert.equal(after.tickerOf(row('02079K107', 'ALPHABET INC', 'CAP STK CL C', { tickerExact: 'GOOG' })), 'GOOG', 'v58.56 builder-embedded ticker is used');
assert.equal(after.tickerOf(row('060505104', 'BANK OF AMER CORP')), null, 'v58.56 after the build, a row without tickerExact has no exact match');
assert.equal(after.tickerOf(row('1', 'X', 'COM', { tickerExact: 'not a ticker' })), null);

console.log(JSON.stringify({ ok: true, check: '13f-figi-ticker-fixture', referenceExact: reference.size }));
