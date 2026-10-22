// v58.63 architecture quality audit (_artifacts/architecture-quality-audit/): the offline counterexamples behind the
// fixed findings, each with a positive control, so a fix cannot silently regress or over-correct. Read-only, no network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractAnswerFallback } from '../src/ai/response/publication.js';
import { evaluateCondition, conditionLabel, normalizeConditions } from '../src/domain/screener/custom-conditions.js';
import { parseConditionText } from '../src/domain/screener/condition-text-parser.js';
import { measureFactorOverlap, overlapSentence } from '../src/domain/screener/factor-overlap.js';
import { runScreen, createDefaultScreenDefinitions } from '../src/domain/screener/screen-engine.js';
import { createScreenDefinition } from '../src/data/contracts/screener.js';
import { isDecisionEligibleRightsId } from '../src/data/contracts/evidence.js';
import { worstSessionMove } from '../src/domain/portfolio/kr-stress.js';
import { openSessionDatesBetween } from '../src/domain/market/market-calendar.js';
import { baseCount, climaxSigns } from '../src/domain/technical/follow-through.js';
import { buildDirection } from '../src/domain/guide/market-guide.js';
import { BRANCHES } from '../src/domain/market/macro-crossroads.js';
import { evaluateConditionalEvidence } from '../src/domain/screener/conditional-evidence.js';

const read = (row, key) => row[key] ?? null;

// SEC02: with no publishable evidence, the broken-plan fallback drops unverified current-event sentences like the plan path.
const eventText = '연준이 오늘 금리를 인하했습니다. 금리 인하는 일반적으로 성장주 할인율을 낮춥니다.';
const strict = extractAnswerFallback(eventText, true, { evidenceCount: 0 });
assert.ok(!/인하했습니다/.test(strict), 'v58.63 SEC02 fallback without evidence drops an unverified current-event sentence');
assert.ok(/할인율/.test(strict), 'v58.63 SEC02 fallback keeps the general explanation');
assert.ok(/인하했습니다/.test(extractAnswerFallback(eventText, false, { evidenceCount: 0 })), 'v58.63 SEC02 a question that is not current-sensitive keeps its text');

// A01: the CIK map entries the audit found pointing at other issuers carry the SEC company-tickers values.
const core = fs.readFileSync(new URL('../js/aio-core.js', import.meta.url), 'utf8');
const CIK = { BWXT: '0001486957', DUK: '0001326160', LUNR: '0001844452', PL: '0001836833', AFRM: '0001820953', AAOI: '0001158114', IREN: '0001878848', NXT: '0001852131', APP: '0001751008', HWM: '0000004281' };
for (const [ticker, cik] of Object.entries(CIK)) {
  const entry = core.match(new RegExp(`'${ticker}':\\s*'(\\d{10})'`));
  assert.ok(entry, `v58.63 A01 CIK map has ${ticker}`);
  assert.equal(entry[1], cik, `v58.63 A01 CIK map ${ticker} matches the SEC summary`);
}
// v58.64 (A01 class): the whole hand-kept map, not only the ten found, is read against the published SEC summary (the
// official ticker→CIK of 800+ issuers). A ticker the map deliberately keeps on its predecessor filer is listed by name.
const CIK_PREDECESSOR = new Set(['XOM']);
const mapStart = core.lastIndexOf('{', core.indexOf("'BWXT': '"));
const cikMap = Object.fromEntries([...core.slice(mapStart, core.indexOf('}', mapStart)).matchAll(/'([A-Z0-9.-]+)':\s*'(\d{10})'/g)].map((m) => [m[1], m[2]]));
const secSummary = JSON.parse(fs.readFileSync(new URL('../public-data/sec-fundamentals-summary.json', import.meta.url), 'utf8'));
const secCik = new Map((Array.isArray(secSummary.data) ? secSummary.data : Object.values(secSummary.data || {})).filter((row) => row?.symbol && row?.cik).map((row) => [String(row.symbol).toUpperCase(), row.cik]));
const cikCompared = Object.keys(cikMap).filter((ticker) => secCik.has(ticker));
assert.ok(cikCompared.length >= 100, 'v58.64 A01 the CIK map is compared against at least 100 SEC summary issuers');
const cikMismatch = cikCompared.filter((ticker) => !CIK_PREDECESSOR.has(ticker) && secCik.get(ticker) !== cikMap[ticker]);
assert.deepEqual(cikMismatch, [], 'v58.64 A01 every CIK map entry matches the SEC summary issuer (or is a named predecessor filer)');

// SCR01: a price read under NOT belongs to the calculation identity, so two price observations give two identities.
const base = createDefaultScreenDefinitions()[0];
const notPrice = createScreenDefinition({ ...base, definitionHash: undefined, screenId: 'audit-scr01', requiredFields: [],
  filtersAST: { type: 'not', child: { type: 'range', field: 'price.close', min: 1000, nullPolicy: 'unknown' } } });
const priceRow = (observedAt) => [{ sym: 'AAA', rank: 70, price: 50, priceObservedAt: observedAt }];
const runA = runScreen({ definition: notPrice, rows: priceRow('2026-10-21T20:00:00Z'), startedAt: 'x', completedAt: 'x' });
const runB = runScreen({ definition: notPrice, rows: priceRow('2026-10-22T20:00:00Z'), startedAt: 'x', completedAt: 'x' });
assert.notEqual(runA.run.calculationInputId, runB.run.calculationInputId, 'v58.63 SCR01 NOT child price read enters the calculation identity');
const rankOnly = runScreen({ definition: base, rows: priceRow('2026-10-21T20:00:00Z'), startedAt: 'x', completedAt: 'x' });
const rankOnlyLater = runScreen({ definition: base, rows: priceRow('2026-10-22T20:00:00Z'), startedAt: 'x', completedAt: 'x' });
assert.equal(rankOnly.run.calculationInputId, rankOnlyLater.run.calculationInputId, 'v58.63 SCR01 a definition without price keeps one identity');

// SCR02: constant factor columns are not "independent signals"; varying ones are still measured.
const rows = Array.from({ length: 40 }, (_, i) => ({ _z_momentum: 1, _z_trend: 1, _z_value: i, _z_quality: (i * 7) % 40 }));
const flat = measureFactorOverlap(rows, ['momentum', 'trend']);
assert.equal(flat.effective, null, 'v58.63 SCR02 two constant factors measure nothing');
assert.deepEqual(flat.constant, ['momentum', 'trend'], 'v58.63 SCR02 constant factors are named');
assert.ok(!/겹치지 않는 정보 약/.test(overlapSentence(flat)), 'v58.63 SCR02 no effective-count sentence without varying factors');
const varying = measureFactorOverlap(rows, ['momentum', 'value', 'quality']);
assert.ok(varying.effective > 1 && varying.factors.length === 2 && varying.constant.includes('momentum'), 'v58.63 SCR02 varying factors are still measured');

// SCR04: OR, an inverted direction and a won unit apply nothing; strict words keep their strictness.
assert.deepEqual(parseConditionText('PER 15 이상').unsupported, ['PER 15 이상'], 'v58.63 SCR04 inverted PER direction is reported');
assert.ok(parseConditionText('PER 15 이하 또는 ROE 20 이상').unsupported?.includes('또는'), 'v58.63 SCR04 OR is reported');
assert.deepEqual(parseConditionText('PER 15 이하'), { conditions: [{ id: 'pe-max', value: 15 }], unknown: '' }, 'v58.63 SCR04 inclusive bound parses');
const lessThan = parseConditionText('PER 15 미만').conditions[0];
assert.equal(lessThan.strict, true, 'v58.63 SCR04 미만 keeps strict');
assert.equal(evaluateCondition(lessThan, { pe: 15 }, read), false, 'v58.63 SCR04 strict bound excludes the boundary');
assert.equal(evaluateCondition({ id: 'pe-max', value: 15 }, { pe: 15 }, read), true, 'v58.63 SCR04 inclusive bound keeps the boundary');
assert.ok(/미만/.test(conditionLabel(lessThan)), 'v58.63 SCR04 strict label reads 미만');
assert.equal(normalizeConditions([{ id: 'vcp', strict: true }])[0].strict, undefined, 'v58.63 SCR04 strict only on bounded conditions');
assert.equal(evaluateCondition({ id: 'liquidity-min', value: 20, strict: true }, { dollarVolume30d: 20e6 }, read), false, 'v58.63 SCR04 strict liquidity compares in dollars');
const won = parseConditionText('거래대금 50억 이상');
assert.ok(won.unsupported?.length && !won.conditions.length, 'v58.63 a won-unit liquidity amount is reported, not read as $ millions');
assert.deepEqual(parseConditionText('거래대금 20백만 이상').conditions, [{ id: 'liquidity-min', value: 20 }], 'v58.63 dollar-million liquidity still parses');

// D5: a review-required or denied rights id is a valid id but not decision-eligible.
for (const id of ['REVIEW_REQUIRED', ' denied ', 'BLOCKED', 'revoked']) assert.equal(isDecisionEligibleRightsId(id), false, `v58.63 D5 ${id.trim()} is not decision-eligible`);
assert.equal(isDecisionEligibleRightsId('LICENSED-EOD-2026'), true, 'v58.63 D5 a licensed rights id stays eligible');

// DOMAIN #6 (kr-stress): the floor counts exact-span windows, not rows.
const sessions = openSessionDatesBetween('2025-06-02', '2026-10-20', { market: 'KR' });
const continuous = sessions.map((date, i) => ({ date, value: 3000 - (i % 30) * 5 }));
assert.ok(worstSessionMove(continuous, 20), 'v58.63 kr-stress a continuous record clears the window floor');
const gappy = Array.from({ length: 201 }, (_, i) => ({ date: sessions[Math.min(sessions.length - 1, i * 2)] || sessions.at(-1), value: 3000 - i }));
assert.equal(worstSessionMove(gappy, 20), null, 'v58.63 kr-stress a gappy record with too few exact windows is held');

// follow-through: the producer passes two years of closes; "of the year" and the 52-week low are the last 252 sessions.
const climb = [];
for (let i = 0; i < 504; i += 1) climb.push(50 + i * 0.2);
climb[100] = climb[99] * 1.3;
for (let i = 101; i < 504; i += 1) climb[i] = climb[i - 1] * 1.002;
climb[503] = climb[502] * 1.05;
const climbVolume = climb.map((_, i) => (i === 100 ? 9999 : i === 503 ? 500 : 100));
const signs = climaxSigns(climb, climbVolume);
assert.ok(signs.includes('largest-gain') && signs.includes('largest-volume'), 'v58.63 a gain or volume spike older than a year does not hide the latest one');
const bases = [];
for (let i = 0; i < 100; i += 1) bases.push(80 + i * 0.2);
for (let i = 1; i <= 20; i += 1) bases.push(100 - i * 0.5);
for (let i = 1; i <= 80; i += 1) bases.push(90 + i * 0.5);
for (let i = 0; i < 270; i += 1) bases.push(128 + (i % 2));
assert.equal(baseCount(bases).count, 1, 'v58.63 base count keeps a completed base before a new 52-week low');
for (let i = 1; i <= 6; i += 1) bases.push(128 - i * 0.5);
assert.equal(baseCount(bases).count, 0, 'v58.63 a new 52-week closing low restarts the base count');

// I02: writing one cause as more branches (same axes) does not move the guide's pick; a different-axis branch still counts.
const branchPath = (id, copy = '') => { const b = BRANCHES.find((row) => row.id === id); return { id: `${b.id}${copy}`, short: `${b.id}${copy}`, title: b.title, axes: b.axes, fit: '2/3', favored: b.favored, costly: b.costly, choices: b.choices, triggers: [] }; };
const basePick = buildDirection([branchPath('softland'), branchPath('oilshock')], []).robust;
const duplicatedPick = buildDirection([branchPath('softland'), branchPath('oilshock'), branchPath('oilshock', '-copy1'), branchPath('oilshock', '-copy2')], []).robust;
assert.equal(duplicatedPick, basePick, 'v58.64 I02 duplicating a same-axis branch does not change the pick');
const widerPick = buildDirection([branchPath('softland'), branchPath('oilshock'), branchPath('creditstress'), branchPath('reheat')], []);
assert.ok(widerPick.tally.find((row) => row.key === 'wait').favoredClusters >= 2, 'v58.64 I02 branches on different axes count as separate clusters');

// SCR05: a repeated observation is one sample unit, not a READY sample.
const sessionRow = { sessionId: 'S-1', instrumentId: 'NQ', eligible: true, success: true, sourceId: 's', sourceKind: 'T1_LICENSED', rightsId: 'r', rightsStatus: 'LICENSED', observedAt: '2026-01-05T21:00:00.000Z', outcomeEndAt: '2026-01-05T21:00:00.000Z', fetchedAt: '2026-09-11T23:00:00.000Z', availableAt: '2026-09-11T23:05:00.000Z', revisionId: 'v', watermark: '2026-01-05', timezone: 'America/New_York', calendarId: 'XNYS-regular-v1', calendarStatus: 'EXCHANGE_VERIFIED' };
const repeatedSample = evaluateConditionalEvidence({ observations: Array.from({ length: 30 }, () => sessionRow), now: '2026-09-12T00:00:00.000Z' });
assert.notEqual(repeatedSample.status, 'READY', 'v58.64 SCR05 thirty copies of one observation are not READY');

console.log('architecture audit regression fixture OK');
