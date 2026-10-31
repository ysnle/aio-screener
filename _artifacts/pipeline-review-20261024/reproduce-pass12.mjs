import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createResearchPlan } from '../../src/ai/research/plan.js';
import { evaluateResearchEvidenceFloor } from '../../src/ai/research/evidence.js';

const decision = { requirement: 'REQUIRED', sourcePolicyId: 'company-primary', currentSensitive: true,
  maxResearchBudget: 2, minimumIndependentSources: 1, minimumPrimarySources: 1, decidedAt: '2026-10-28T12:00:00Z' };
const questionPlan = { queryId: 'audit-q', query: 'AAPL latest earnings', market: 'US',
  entities: { entities: [{ symbol: 'AAPL', verified: true, market: 'US' }] }, researchDecision: decision };
questionPlan.researchPlan = createResearchPlan({ questionPlan, decision, now: decision.decidedAt });
const citation = { url: 'https://www.nasdaq.com/articles/audit-fixture', queryId: 'audit-q', publishedAt: '2026-10-28T10:00:00Z' };
const nasdaq = evaluateResearchEvidenceFloor({ questionPlan, nativeCitations: [citation] });
assert(questionPlan.researchPlan.subQueries[0].sourcePolicy.secondary.domains.includes('nasdaq.com'));
assert.equal(nasdaq.primarySourceCount, 1);
assert.equal(nasdaq.currentClaimsAllowed, true);

const mixedPlan = { ...questionPlan, researchPlan: { ...questionPlan.researchPlan,
  stopConditions: { minimumIndependentSources: 2, minimumPrimarySources: 1 } } };
const mixed = evaluateResearchEvidenceFloor({ questionPlan: mixedPlan, nativeCitations: [
  { url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', publishedAt: '2026-10-28T10:00:00Z' },
  { url: 'https://www.reuters.com/audit-fixture', publishedAt: '2026-10-28T10:00:00Z' }
] });
assert.equal(mixed.bindingVerified, true);
assert.equal(mixed.independentSourceCount, 2);
assert.equal(mixed.currentClaimsAllowed, true);

const wrongEntity = evaluateResearchEvidenceFloor({ questionPlan, nativeCitations: [
  { url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', entity: 'MSFT', publishedAt: '2026-10-28T10:00:00Z' }
] });
const explicitEntityControl = evaluateResearchEvidenceFloor({ questionPlan, entity: 'AAPL', nativeCitations: [
  { url: 'https://www.sec.gov/audit-fixture', queryId: 'audit-q', entity: 'MSFT', publishedAt: '2026-10-28T10:00:00Z' }
] });
assert.equal(wrongEntity.currentClaimsAllowed, true);
assert.equal(explicitEntityControl.evidenceBinding.status, 'MISMATCHED_ENTITY');
assert.equal(explicitEntityControl.currentClaimsAllowed, false);
const report = { generatedAt: new Date().toISOString(), network: false, nasdaq, mixed, wrongEntity, explicitEntityControl };
fs.writeFileSync(new URL('./pass12-reproductions.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ assertions: 'passed', nasdaqPrimary: nasdaq.primarySourceCount,
  mixedBinding: mixed.bindingVerified, wrongEntityAllowed: wrongEntity.currentClaimsAllowed, control: explicitEntityControl.evidenceBinding.status }));
