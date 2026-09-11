import assert from 'node:assert/strict';
import { createAIAnswerOrchestrator } from '../src/ai/orchestrator/answer-orchestrator.js';

const ai = createAIAnswerOrchestrator({ now: () => new Date('2026-09-10T12:00:00Z') });
const plan = (intent) => ({ intent: { primary: intent }, entities: { entities: [{ symbol: 'NVDA' }] } });
const row = (metric, value, extra = {}) => ({ evidenceId: `test:${metric}`, metric, entity: 'NVDA', value, unit: 'USD', asOf: '2026-09-10T10:00:00Z', source: 'fixture-provider', sourceKind: 'LIVE', status: 'verified', scale: 'raw', ...extra });
const run = (intent, evidence) => ai.buildAnalysisContext(plan(intent), { evidence });
const company = run('ENTITY_ANALYSIS', [row('price', 100)]);
assert.equal(company.result.facts[0].value, 100);
assert.equal(company.result.quality.score, null);
assert.equal(company.result.valuation.percentile, null);
assert.equal(company.audit.currentClaimEligible, false);
assert.match(company.context, /reference-only/);
const conditions = run('TECHNICAL_ANALYSIS', [row('price', 100), row('sma20', 90)]);
assert.equal(conditions.result.conditions[0].value, 10);
assert.equal(conditions.result.conditions[0].status, 'above');
assert.equal(run('TECHNICAL_ANALYSIS', [row('price', 100), row('sma20', 90, { asOf: '2026-09-09T10:00:00Z' })]).result.status, 'insufficient');
assert.equal(run('TECHNICAL_ANALYSIS', [row('price', 100), row('sma20', 90, { unit: 'KRW' })]).result.status, 'insufficient');
assert.equal(run('ENTITY_FACT', [row('price', 100, { entity: undefined, entityId: 'NVDA' })]).result.facts[0].value, 100);
for (const bad of [{ sourceKind: 'IMAGINARY' }, { status: 'stale' }, { asOf: null }, { unit: '' }, { value: '100' }, { scale: 'million' }, { asOf: '2026-09-11T10:00:00Z' }]) {
  assert.equal(run('ENTITY_FACT', [row('price', 100, bad)]).result.status, 'insufficient');
}
const conflict = run('ENTITY_FACT', [row('price', 100), row('price', 101, { evidenceId: 'other' })]);
assert.equal(conflict.result.status, 'insufficient');
assert.equal(conflict.audit.rejected.length, 2);
for (const mutation of [{ entity: 'AAPL' }, { metric: 'revenue' }, { value: 101 }, { asOf: '2026-09-09T10:00:00Z' }, { unit: 'KRW' }]) {
  const result = run('ENTITY_FACT', [row('price', 100), row('price', 100, mutation)]);
  assert.equal(result.result.status, 'insufficient');
  assert.equal(result.audit.rejected.filter((r) => r.reason === 'evidence-id-conflict').length, 2);
}
for (const intent of ['MARKET_CAUSAL', 'SECTOR_ANALYSIS']) assert.equal(run(intent, [row('price', 100)]).result.status, 'insufficient');
const fx = run('FX_ANALYSIS', [row('market.fx.usdkrw', 1350, { entity: 'KRW=X', unit: 'KRW/USD' })]);
assert.equal(fx.result.status, 'partial');
assert.equal(fx.result.fx['KRW=X:market.fx.usdkrw'].value, 1350);
assert.deepEqual(fx.result.transmissionEdges, []);
assert.equal(run('EDUCATION', []).context, '');
const original = { ...plan('ENTITY_FACT'), query: 'NVDA', currentSensitive: true };
const enriched = ai.withPremiseEvidence(original, { evidence: [] });
assert.ok(enriched.premise);
assert.equal(original.premise, undefined);
assert.ok(Object.isFrozen(enriched));
console.log('PASS AI analysis evidence adapter: typed mapping, conflicts, time/unit isolation, missing-input boundaries, premise API');
