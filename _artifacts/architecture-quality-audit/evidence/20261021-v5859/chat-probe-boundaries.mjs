import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const path = 'js/aio-chat.js';
const bytes = execFileSync('git', ['show', `${ref}:${path}`], { maxBuffer: 2e6 });
const lines = bytes.toString('utf8').split('\n');
const source = (a, b) => lines.slice(a - 1, b).join('\n');
const context = vm.createContext({ console, AbortController, Date, Intl, URL, Map, Set });
context.window = context;
context.AIO = {};
vm.runInContext(source(12, 23) + '\n' + source(480, 566), context);

// Execute the production completion call's exact argument object, without a DOM or a model request.
context._uniDoneResult = { evidence: [], closeBasisDates: ['2026-10-20'], otherPublishedClaims: 0 };
context.ctxId = 'home';
context.detectedTickers = [];
context._uniFreshPreflight = null;
context._publicGate = { limitations: [] };
context._bubbleParent = {};
context._aioAppendAIPublicDisclosure = (_parent, meta) => { context.observedDisclosure = context._aioBuildAIResponseDisclosure(meta); };
vm.runInContext(source(6043, 6043), context);
const actualDisclosure = context.observedDisclosure;
const correctedDisclosure = context._aioBuildAIResponseDisclosure({ ...context._uniDoneResult, freshness: null });
assert.equal(actualDisclosure.status, '확인 필요');
assert.equal(actualDisclosure.asOf, '미확인');
assert.equal(correctedDisclosure.status, '종가 기준 근거');
assert.equal(correctedDisclosure.asOf, '2026-10-20 종가');

const directiveText = 'NVDA를 지금 매수하세요 그리고 손절하지 마세요.';
const directive = context._aioApplyAIActionGate(directiveText, {});
const directiveControl = context._aioApplyAIActionGate('NVDA를 지금 매수하세요.', {});
assert.equal(directive.text, directiveText);
assert.equal(directive.reasons.length, 0);
assert.equal(directiveControl.replacedSentences, 1);
const englishDirective = context._aioApplyAIActionGate('You should buy NVDA now.', {});
assert.equal(englishDirective.text, 'You should buy NVDA now.');
const conductSource = execFileSync('git', ['show', `${ref}:src/ai/policy/conduct.js`], { encoding: 'utf8' });
const conductModule = await import('data:text/javascript;base64,' + Buffer.from(conductSource).toString('base64'));
context.AIO_ARCH = { classifyAIConduct: conductModule.classifyAIConduct };
context._AIO_AI_CONDUCT_VERSION = 'probe-version-does-not-affect-decision';
const coreLines = execFileSync('git', ['show', `${ref}:js/aio-core.js`], { encoding: 'utf8', maxBuffer: 2e6 }).split('\n');
vm.runInContext(coreLines.slice(5060, 5136).join('\n'), context);
const downstreamConduct = context.AIO.evaluateAIActionPermission({ query: 'NVDA 전망을 설명해줘', text: directive.text, evidence: [] });
assert.equal(downstreamConduct.blocked, false);
assert.equal(downstreamConduct.actionLike, true);

// Real route/task functions; every transport is a local stub. Virtual milliseconds are scaled 100:1.
context.setTimeout = (fn, ms) => setTimeout(fn, ms / 100);
context.clearTimeout = clearTimeout;
context._aioWorkerHealthCache = {};
context._aioWorkerHealthInFlight = {};
context._aioClaudeTarget = () => ({ workerUrl: 'mock://worker', healthUrl: 'mock://worker/health', serverKey: true });
context._aioAppToken = () => 'mock';
context._aioSetChatRuntimeState = (key, value) => (context[key] = value);
context.AIO.describeSharedConnection = () => ({ ok: true, reason: 'READY' });
let fetchCalls = 0;
context.fetch = async () => {
  fetchCalls++;
  await new Promise(resolve => setTimeout(resolve, 85));
  return { ok: true, json: async () => ({ ai: { ready: true } }) };
};
vm.runInContext(source(1468, 1511) + '\n' + source(1844, 1892), context);
let healthError = null;
try { await context._aioEnsureClaudeRoute(''); } catch (error) { healthError = { name: error.name, code: error.code, message: error.message }; }
assert.equal(healthError?.code, 'RESEARCH_TIMEOUT');
await new Promise(resolve => setTimeout(resolve, 30));
assert.equal(context._aioWorkerHealthCache['mock://worker']?.ok, true);
assert.equal(fetchCalls, 1);
// The real unified route-error branch releases (aborts) before checking whether it should show the failure.
context.document = { getElementById: () => null };
vm.runInContext(source(1458, 1462) + '\n' + source(1573, 1592), context);
const run = { ctxId: 'home', epoch: 1, controller: new AbortController() };
const state = context.getChatState('home');
state._activeRequest = run;
state._requestEpoch = 1;
context._uniSignal = run.controller.signal;
context._isCurrentUnifiedRun = () => true;
context._releaseUnifiedRun = () => context._aioReleaseChatRequest(run);
let routeErrorNotices = 0;
context._appendAIMsg = () => { routeErrorNotices++; };
vm.runInContext(source(5530, 5533), context);
assert.equal(context._uniSignal.aborted, true);
assert.equal(routeErrorNotices, 0);

const report = {
  ref, path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  evidenceLevel: 'isolated-production-functions; transport and DOM boundary stubbed; no browser/live/paid evidence',
  disclosure: { actual: actualDisclosure, withReturnedFields: correctedDisclosure },
  directives: { unfiltered: directive, positiveControl: directiveControl, englishUnfiltered: englishDirective, downstreamConduct },
  health: { configuredInnerTimeoutMs: 12000, actualAwaitTimeoutMs: 7500, simulatedResponseMs: 8500, observedError: healthError, laterHealthResult: context._aioWorkerHealthCache['mock://worker'], fetchCalls, routeErrorNotices },
  externalCalls: 0, paidCalls: 0
};
writeFileSync(new URL('./chat-probe-boundaries.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ sha256: report.sha256, bytes: report.bytes, disclosure: actualDisclosure.status, directivePreserved: directive.text === directiveText, healthError, laterHealthOk: true, externalCalls: 0, paidCalls: 0 }));
