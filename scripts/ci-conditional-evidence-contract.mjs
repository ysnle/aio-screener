import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CONDITIONAL_EVIDENCE_DISCLAIMER,
  CONDITIONAL_EVIDENCE_REGISTRY,
  CONDITIONAL_EVIDENCE_VERSION,
  evaluateConditionalEvidence,
  normalizeEvidenceObservation
} from '../src/domain/screener/conditional-evidence.js';
import { classifyEvidenceLineage, EVIDENCE_LINEAGE_VERSION, normalizeEvidenceLineage } from '../src/domain/screener/evidence-lineage.js';

const screenerUi = fs.readFileSync(new URL('../src/ui/pages/screener.js', import.meta.url), 'utf8');
const screenerShell = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const now = '2026-09-12T00:00:00.000Z';
const observations = Array.from({ length: 40 }, (_, index) => {
  const year = index < 20 ? '2025' : '2026';
  const day = String((index % 20) + 1).padStart(2, '0');
  return {
    sessionId: `NQ-${year}-${day}`,
    instrumentId: 'NQ',
    eligible: true,
    success: index % 2 === 0,
    value: (index + 1) / 100,
    sourceId: 'fixture-licensed-1m',
    sourceKind: 'T1_LICENSED',
    rightsId: 'fixture-rights-1',
    rightsStatus: 'LICENSED',
    observedAt: `${year}-01-${day}T21:00:00.000Z`,
    fetchedAt: '2026-09-11T23:00:00.000Z',
    availableAt: '2026-09-11T23:05:00.000Z',
    revisionId: 'fixture-revision-1',
    watermark: `${year}-01-${day}`,
    timezone: 'America/New_York',
    calendarId: 'XNYS-regular-v1',
    calendarStatus: 'EXCHANGE_VERIFIED'
  };
});

const result = evaluateConditionalEvidence({
  observations,
  queryEcho: 'weekday = Monday AND opening_range_gap = true',
  conditionLabel: '월요일 오프닝 갭',
  recencyWindow: 20,
  now
});

assert.equal(result.version, CONDITIONAL_EVIDENCE_VERSION);
assert.equal(result.lineageVersion, EVIDENCE_LINEAGE_VERSION);
assert.equal(result.status, 'READY');
assert.equal(result.sample.trials, 40);
assert.equal(result.sample.successes, 20);
assert.equal(result.sample.estimate, 0.5);
assert.ok(result.sample.confidenceInterval.low < 0.5 && result.sample.confidenceInterval.high > 0.5);
assert.equal(result.stability.status, 'STABLE_ENOUGH');
assert.equal(result.recency.trials, 20);
assert.deepEqual(Object.keys(result.perYear), ['2025', '2026']);
assert.equal(result.distribution.count, 20);
assert.equal(result.lineage.usableRecords, 40);
assert.equal(result.decisionEligible, false);
assert.equal(result.disclaimer, CONDITIONAL_EVIDENCE_DISCLAIMER);

const future = evaluateConditionalEvidence({
  observations: [{ ...observations[0], availableAt: '2026-10-01T00:00:00.000Z' }],
  now
});
assert.equal(future.status, 'BLOCKED');
assert.ok(future.blockedReasons.includes('future_available_at'));

const lowSample = evaluateConditionalEvidence({ observations: observations.slice(0, 9), now });
assert.equal(lowSample.status, 'LOW_SAMPLE_BLOCKED');
assert.equal(lowSample.sample.estimate, null);
assert.equal(lowSample.sample.confidenceInterval, null);

const empty = evaluateConditionalEvidence({ observations: [], now });
assert.equal(empty.status, 'NO_DATA');
assert.equal(empty.observedAt, null);

const missingOutcome = evaluateConditionalEvidence({
  observations: [{ ...observations[0], success: undefined, value: undefined }],
  now,
  minSampleRefuse: 1,
  minSampleWarn: 1
});
assert.equal(missingOutcome.status, 'LOW_SAMPLE_BLOCKED');
assert.equal(missingOutcome.sample.trials, 0);
assert.equal(missingOutcome.distribution.count, 0);
assert.equal(normalizeEvidenceObservation({}).value, null);

const missingLineage = normalizeEvidenceLineage({});
assert.equal(missingLineage.observedAt, null);
assert.equal(missingLineage.observedAtMs, null);
assert.equal(missingLineage.fetchedAt, null);
assert.equal(missingLineage.availableAt, null);
const missingLineageClassification = classifyEvidenceLineage(missingLineage, { now });
assert.ok(missingLineageClassification.reasons.includes('missing_observed_at'));
assert.ok(missingLineageClassification.reasons.includes('missing_fetched_at'));
assert.ok(missingLineageClassification.reasons.includes('missing_available_at'));

const blockedLineage = classifyEvidenceLineage({ sourceId: 'fixture', observedAt: now, availableAt: now }, { now });
assert.equal(blockedLineage.status, 'BLOCKED');
assert.ok(blockedLineage.reasons.includes('missing_rights_id'));
assert.ok(CONDITIONAL_EVIDENCE_REGISTRY.gapFill.requiredInputs.includes('exchange-calendar'));
assert.match(screenerUi, /renderConditionalEvidence\(documentRef, state\?\.metadata\)/);
assert.match(screenerUi, /\['ranking', 'factors', 'backtest', 'evidence'\]/);
assert.match(screenerShell, /id="scr-tab-button-evidence"/);
assert.match(screenerShell, /id="screener-conditional-evidence-panel"/);
assert.ok(!screenerUi.includes('innerHTML'));

console.log(JSON.stringify({ status: 'PASS', version: CONDITIONAL_EVIDENCE_VERSION, lineageVersion: EVIDENCE_LINEAGE_VERSION, checks: 35 }));
