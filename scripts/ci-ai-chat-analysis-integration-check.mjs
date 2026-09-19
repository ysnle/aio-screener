import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createAIAnswerOrchestrator } from '../src/ai/orchestrator/answer-orchestrator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Keep source-slice contracts independent of the checkout's CRLF/LF mode.
// The assertion is about wiring and evidence semantics, not line endings.
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
const chat = read('js/aio-chat.js');
const html = read('index.html');

const helperStart = chat.indexOf('function _aioBuildChatAnalysisContext(');
const helperEnd = chat.indexOf('\n\n// 2026-08-30 supplied-materials', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'production helper slice is present');

const boundaryKinds = [];
const sandbox = {
  window: {
    AIO_ARCH: null,
    AIO: {
      normalizeAIChatEvidenceRow(row) { return { ...row }; },
      buildAIUntrustedBlock(kind, payload) {
        boundaryKinds.push(kind);
        return `[AIO UNTRUSTED DATA START kind=${kind}]\n${String(payload)}\n[AIO UNTRUSTED DATA END kind=${kind}]`;
      }
    }
  }
};
vm.runInNewContext(chat.slice(helperStart, helperEnd), sandbox, { filename: 'js/aio-chat.js#analysis-helper' });
assert.equal(typeof sandbox.window._aioBuildChatAnalysisContext, 'function', 'helper is exposed on window');

const evidenceStart = chat.indexOf('function _aioAIClaimEvidenceId(');
const evidenceEnd = chat.indexOf('function _aioHasCurrentNumericContent(', evidenceStart);
assert.ok(evidenceStart >= 0 && evidenceEnd > evidenceStart, 'production evidence collector slice is present');
vm.runInNewContext(chat.slice(evidenceStart, evidenceEnd), sandbox, { filename: 'js/aio-chat.js#claim-evidence' });
const duplicateEvidence = {
  evidenceId: 'fixture:duplicate', metric: 'price-change-pct', entity: 'NVDA', value: -2,
  unit: '%', scale: 'raw', asOf: '2026-09-08T20:00:00Z', source: 'fixture-exchange', status: 'verified'
};
const repeated = sandbox._aioCollectAIClaimEvidence({ evidence: [duplicateEvidence, { ...duplicateEvidence }] });
assert.equal(repeated.length, 1, 'identical evidence rows remain deduplicated');
assert.equal(repeated[0].status, 'verified');
const conflicting = sandbox._aioCollectAIClaimEvidence({ evidence: [duplicateEvidence, { ...duplicateEvidence, value: 2 }] });
assert.equal(conflicting.length, 1, 'conflicting evidence IDs remain a single registry row');
assert.equal(conflicting[0].status, 'conflict', 'conflicting evidence is rejected by publish status');
assert.equal(sandbox._aioEvidenceCanPublish({ ...duplicateEvidence, asOf: new Date(Date.now() + 86400000).toISOString() }), false, 'future observations are not publishable');

const now = new Date('2026-09-08T21:00:00Z');
const period = { start: '2026-09-07T20:00:00Z', end: '2026-09-08T20:00:00Z' };
const assertion = {
  entityId: 'NVDA',
  metricId: 'price-change-pct',
  timeframe: 'session',
  period,
  unit: '%',
  direction: 'down'
};
const evidence = {
  ...assertion,
  value: -2,
  observedAt: period.end,
  evidenceId: 'fixture:nvda-session-change',
  source: 'fixture-exchange',
  // Matching premise fixtures must carry the same explicit grants as a
  // production current/decision observation.  Freshness or `verified` alone
  // is intentionally insufficient under the strict evidence contract.
  sourceKind: 'T1_OFFICIAL',
  revisionId: 'fixture-revision-20260908-nvda-session-change',
  rightsId: 'fixture-exchange-public-rights',
  status: 'verified',
  allowedUse: 'decision',
  allowedUseCeiling: 'decision',
  claimUse: 'current',
  currentClaim: true,
  freshnessStatus: 'current',
  freshnessMs: 24 * 60 * 60 * 1000,
  qualityStatus: 'CURRENT',
  quality: { status: 'CURRENT', stale: false, blocked: false, decisionUse: true }
};
const orchestrator = createAIAnswerOrchestrator({ root: sandbox.window, now: () => now });
sandbox.window.AIO_ARCH = { getAIOrchestrator: () => orchestrator };

const plan = orchestrator.plan({
  query: '오늘 NVDA 하락 중인데 왜 그래?',
  route: 'home',
  now,
  premiseAssertions: [assertion],
  premisePeriod: period
});
const verified = sandbox.window._aioBuildChatAnalysisContext(plan, [evidence]);
assert.equal(verified.questionPlan.premise.status, 'VERIFIED', 'matching evidence verifies the premise');
assert.match(verified.context, /DOMAIN_ANALYSIS|AIO UNTRUSTED DATA START kind=DOMAIN_ANALYSIS/, 'domain context is quarantined');
assert.equal(verified.audit.premiseStatus, 'VERIFIED');
assert.deepEqual(verified.audit.requestedPeriod, period, 'explicit plan period is forwarded');

const missing = sandbox.window._aioBuildChatAnalysisContext(plan, []);
assert.equal(missing.questionPlan.premise.status, 'UNVERIFIED', 'missing evidence is delivered as unverified');
assert.match(missing.context, /premise\.status=UNVERIFIED/, 'unverified status is visible in the context');

const oppositePlan = orchestrator.plan({
  query: '오늘 NVDA 상승 중인데 왜 그래?',
  route: 'home',
  now,
  premiseAssertions: [{ ...assertion, direction: 'up' }],
  premisePeriod: period
});
const opposite = sandbox.window._aioBuildChatAnalysisContext(oppositePlan, [evidence]);
assert.equal(opposite.questionPlan.premise.status, 'CONTRADICTED', 'opposite observed direction is delivered');
assert.match(opposite.context, /premise\.status=CONTRADICTED/, 'contradicted status is visible in the context');

const noPeriodPlan = orchestrator.plan({
  query: '오늘 NVDA 하락 중인데 왜 그래?',
  route: 'home',
  now
});
const numericOnlyQuote = sandbox.window._aioBuildChatAnalysisContext(noPeriodPlan, [{
  entityId: 'NVDA', metricId: 'price-change-pct', timeframe: 'session', unit: '%', value: -2,
  observedAt: period.end, evidenceId: 'fixture:numeric-only', source: 'fixture-exchange', sourceKind: 'exchange', status: 'verified'
}]);
assert.equal(numericOnlyQuote.questionPlan.premise.status, 'UNVERIFIED', 'numeric quote cannot infer a requested period');
assert.equal(numericOnlyQuote.audit.requestedPeriod, null, 'numeric quote cannot create a requested period');

assert.ok(/_pageClaimEvidence[\s\S]{0,900}_aioBuildChatAnalysisContext/.test(chat), 'per-page chat calls the shared helper after evidence collection');
assert.ok(/_pageAnalysisSlice\.questionPlan/.test(chat) && /systemPrompt \+= _pageAnalysisSlice\.context/.test(chat), 'per-page chat adopts the updated plan and context');
// P1131/R619: the unified chat surface moved from index.html's inline block G into js/aio-chat.js.
// All three assertions below follow the code there — including the chip markup, which is emitted by
// _aiDefaultChips (also block G) rather than authored in the shell. The gate caught that assumption
// when it failed on the stale index.html read.
assert.ok(/_uniClaimEvidence[\s\S]{0,900}_aioBuildChatAnalysisContext/.test(chat), 'unified chat calls the shared helper after evidence collection');
assert.ok(/_uniAnalysisSlice\.questionPlan/.test(chat) && /sysPrompt \+= _uniAnalysisSlice\.context/.test(chat), 'unified chat adopts the updated plan and context');
assert.ok(/premise-['"] \+ premiseStatus\.toLowerCase\(\)/.test(chat) && /CONTRADICTED/.test(chat), 'pipeline adds premise limitations without a blanket block');
assert.ok(/_aioAIClaimEvidenceTuple/.test(chat) && /status: 'conflict'/.test(chat), 'claim registry marks conflicting tuples explicitly');
assert.ok((chat.match(/<button type="button" class="ai-chip"/g) || []).length >= 2 && !/<div class="ai-chip"/.test(chat), 'unified chat chips are keyboard-activatable buttons');
assert.ok(/function aiChipClick\(el\)[\s\S]{0,220}chatSendUnified\(\)/.test(chat), 'keyboard chip activation retains the unified send path');
assert.ok(boundaryKinds.filter(kind => kind === 'DOMAIN_ANALYSIS').length >= 4, 'all analysis contexts use the untrusted boundary');

console.log('PASS ai-chat-analysis-integration: production helper, orchestrator premise states, period safety, both chat surfaces and limitation pipeline');
