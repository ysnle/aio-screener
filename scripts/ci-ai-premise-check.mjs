import assert from 'node:assert/strict';
import { evaluateDirectionalPremise, createQuestionPremise } from '../src/ai/orchestrator/premise.js';
import { createQuestionPlan } from '../src/ai/orchestrator/question-planner.js';

const now = new Date('2026-09-08T21:00:00Z');
const period = { start: '2026-09-07T20:00:00Z', end: '2026-09-08T20:00:00Z' };
const assertion = { entityId: 'NVDA', metricId: 'price-change-pct', unit: '%', timeframe: 'session', period, direction: 'down' };
const row = { ...assertion, value: -2, observedAt: period.end, source: 'fixture-exchange', sourceKind: 'exchange', evidenceId: 'fixture:nvda-change', status: 'verified' };
const evaluate = (rows, overrides = {}) => evaluateDirectionalPremise({ ...assertion, ...overrides }, rows, { now });
assert.equal(evaluate([]).status, 'UNVERIFIED');
assert.equal(evaluate([row]).status, 'VERIFIED');
assert.equal(evaluate([{ ...row, value: 2 }]).status, 'CONTRADICTED');
assert.equal(evaluate([{ ...row, value: 0 }]).observedDirection, 'flat');
assert.equal(evaluate([{ ...row, value: 0 }]).status, 'CONTRADICTED');
assert.equal(evaluate([row, { ...row, evidenceId: 'other', value: 2 }]).status, 'CONFLICT');
for (const value of [NaN, Infinity, -Infinity, '-2', null, -101]) assert.equal(evaluate([{ ...row, value }]).status, 'UNVERIFIED');
for (const patch of [
  { entityId: 'AMD' }, { metricId: 'price' }, { unit: 'USD' }, { timeframe: 'week' },
  { period: { ...period, start: '2026-09-06T20:00:00Z' } }, { period: null },
  { observedAt: 'invalid' }, { observedAt: '2026-09-09T00:00:00Z' },
  { observedAt: period.start }, { status: 'stale' }, { sourceKind: 'REFERENCE' },
  { sourceKind: '' }, { sourceKind: null }, { sourceKind: undefined }, { sourceKind: 'made-up-provider' },
  { evidenceId: '' }, { source: '' }
]) assert.equal(evaluate([{ ...row, ...patch }]).status, 'UNVERIFIED', JSON.stringify(patch));
assert.equal(evaluate([row], { timeframe: 'unspecified' }).status, 'UNVERIFIED');
assert.equal(evaluate([row], { period: null }).status, 'UNVERIFIED');
assert.equal(evaluate([row], { metricId: 'price' }).status, 'UNVERIFIED');
const mutablePeriod = { ...period };
const defensiveResult = evaluate([row], { period: mutablePeriod });
mutablePeriod.end = '2030-01-01T00:00:00Z';
assert.equal(defensiveResult.period.end, period.end);
assert.ok(Object.isFrozen(defensiveResult.period));
assert.throws(() => { defensiveResult.period.start = '2030-01-01T00:00:00Z'; }, TypeError);
const inputs = { now, root: {}, premiseEvidence: [row], premisePeriod: period };
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 NVDA 하락 중인데 왜 그래?' }).premise.status, 'VERIFIED');
assert.equal(createQuestionPlan({ ...inputs, query: '지금 NVDA 하락 중인데 왜 그래?' }).premise.status, 'UNVERIFIED');
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 NVDA 상승 중인데 왜 그래?' }).premise.status, 'CONTRADICTED');
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 반도체 하락 중인데 왜 그래?', premiseEvidence: [{ ...row, entityId: 'SMH' }] }).premise.status, 'UNVERIFIED');
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 NVDA와 AMD 하락 중인데 왜 그래?' }).premise.status, 'UNVERIFIED');
assert.equal(createQuestionPlan({ ...inputs, query: 'NVDA가 하락하면 어떻게 해?' }).premise.status, 'NONE');
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 NVDA 상승 하락 이유' }).premise.status, 'UNVERIFIED');
assert.equal(createQuestionPremise({ query: '오늘 시장은?', assertions: [assertion], evidence: [row], now }).status, 'VERIFIED');
console.log('PASS ai-premise: observed direction, zero, conflict, tuple identity, malformed evidence, unknown timeframe, proxy and planner integration');
