import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { finalizePageDecision } from '../src/domain/signal/page-decision.js';
import { deriveSignalDecisionFromTradingScore } from '../src/domain/signal/trading-score.js';

// P1357: execute the production legacy builder against the native presentation.
const core = readFileSync(new URL('../js/aio-core.js', import.meta.url), 'utf8');
const start = core.indexOf('window._aioBuildPageDecision = function(pageId) {');
const end = core.indexOf('\nwindow._aioAskAiFromPageDecision', start);
assert.ok(start >= 0 && end > start, 'P1357 production decision builder exists');
let signal = deriveSignalDecisionFromTradingScore({ score: {
  total: 58, decisionEligible: false, predictiveValidation: 'not-established',
  closeBasis: { label: '9/30 미국 정규장 종가 기준' }, componentMissing: []
} });
const evidence = { sourceKind: 'UNAVAILABLE', asOf: '미수신', confidence: '35% 낮음', blockers: ['live-cut-unavailable'], marketEpoch: { status: 'BLOCKED' } };
let headerHtml = '';
const page = { querySelector: () => null, classList: { add() {} }, insertAdjacentHTML: (_position, html) => { headerHtml = html; } };
const document = { getElementById: (id) => id === 'page-signal' ? page : null };
const window = { AIO: { getPageEvidenceState: () => evidence },
  _aioFinalizePageDecision: (d) => finalizePageDecision(d, signal) };
const context = vm.createContext({ window, document,
  _aioDefaultDecision: (pageId) => ({ pageId, sourceKind: 'UNAVAILABLE', decision: '산출 보류', reasons: [], confidence: '35% 낮음', decisionBlocked: false, decisionEligible: true, predictiveValidation: 'not-established' }),
  _aioDecisionConfidence: () => '35% 낮음', _aioDecisionAsOf: () => '미수신',
  _aioDecisionEsc: (text) => String(text), _aioTruncateAtWord: (text) => String(text)
});
vm.runInContext(core.slice(start, end), context);
const rendererStart = core.indexOf('window._aioRenderPageDecisionHeader = function(pageId) {');
const rendererEnd = core.indexOf('\nwindow.AIO.getPageEvidenceCurrentnessAudit', rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, 'P1357 production renderer exists');
vm.runInContext(core.slice(rendererStart, rendererEnd), context);
let d = window._aioBuildPageDecision('signal');
assert.equal(d.referenceSummary.score, 58, 'P1357 native 58 survives a blocked live epoch');
assert.ok(d.decision.includes('58/100') && !d.decision.includes('미수신'), 'P1357 header projects the available score');
assert.equal(d.sourceKind, 'REFERENCE', 'P1357 available close data is a reference');
assert.equal(d.asOf, signal.presentation.basisLabel, 'P1357 header and native use the same close basis');
assert.ok(d.decisionBlocked && !d.decisionEligible && d.evidence.marketEpoch.status === 'BLOCKED', 'P1357 reference grants no action permission');
assert.ok(!d.confidence.includes('%'), 'P1357 uncalibrated probability is removed');
window._aioRenderPageDecisionHeader('signal');
assert.ok(headerHtml.includes('58/100') && headerHtml.includes('9/30 미국 정규장 종가 기준') && headerHtml.includes('근거 상태') && !headerHtml.includes('35%') && !headerHtml.includes('데이터: 미수신'), 'P1357 production header HTML shares score, basis and qualitative evidence');
signal = deriveSignalDecisionFromTradingScore({ score: { total: 58, partial: true, decisionEligible: false, closeBasis: { label: '9/30 미국 정규장 종가 기준' }, componentMissing: ['macro'] } });
d = window._aioBuildPageDecision('home');
assert.equal(d.referenceSummary.displayScore, '58*', 'P1357 partial reference marker is shared');
signal = deriveSignalDecisionFromTradingScore({ score: { total: null, componentMissing: ['trend'] } });
d = window._aioBuildPageDecision('signal');
assert.ok(d.referenceSummary === null && d.sourceKind === 'UNAVAILABLE' && d.decisionBlocked && !d.decisionEligible && !d.decision.includes('58'), 'P1357 missing required input clears an older score');
d = window._aioBuildPageDecision('ticker');
assert.ok(d.referenceSummary === null && d.sourceKind === 'UNAVAILABLE', 'P1357 market reference does not replace unrelated page evidence');
console.log('[page-decision-reference] PASS production builder/native parity, partial, missing, action gate and qualitative evidence');
