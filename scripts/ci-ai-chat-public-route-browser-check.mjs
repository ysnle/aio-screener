import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_AI_CHAT_PORT || 8912);
const localBase = `http://127.0.0.1:${port}`;
const workerBase = 'https://aio-proxy.zmfhd007.workers.dev';

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[ai-chat-public-route/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(readyOnce, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
let observedRequest = null;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith(localBase)) return route.continue();
    if (url === `${workerBase}/health`) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': localBase },
        body: JSON.stringify({ schemaVersion: 'aio-worker-health.v1', ok: true, revision: 'fixture', ai: { configured: true, quotaConfigured: true, authorityReady: true, authorityJurisdiction: 'us', ready: true, maxTokens: 1500 } })
      });
    }
    if (url === `${workerBase}/anthropic`) {
      observedRequest = { headers: request.headers(), body: JSON.parse(request.postData() || '{}') };
      const plan = '[AI_ANSWER_PLAN]' + JSON.stringify({
        schemaVersion: 'answer-plan.v1',
        summary: '공용 경로의 완결된 응답입니다.',
        claims: [],
        sections: [{ title: '검증', body: '신규 브라우저에서도 Worker를 거쳐 답변을 받습니다.' }],
        citations: [],
        followUps: ['근거 범위를 설명해줘']
      }) + '[/AI_ANSWER_PLAN]';
      const body = [
        `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 12 } } })}\n\n`,
        `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: plan } })}\n\n`,
        `data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 80 } })}\n\n`,
        `data: ${JSON.stringify({ type: 'message_stop' })}\n\n`
      ].join('');
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': localBase, 'x-aio-max-tokens': '1500' }, body });
    }
    return route.abort();
  });

  await page.goto(`${localBase}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.callClaude === 'function' && typeof window._aioEnsureClaudeRoute === 'function' && typeof window.AIO_ARCH?.parseAIAnswerPlan === 'function', { timeout: 30000 });

  const result = await page.evaluate(async () => {
    localStorage.clear();
    await window.AIO.loadPublicConfig();
    const routeState = await window._aioEnsureClaudeRoute('');
    const streamed = await new Promise((resolveStream, rejectStream) => {
      window.callClaude('Answer briefly.', [{ role: 'user', content: '공용 경로 확인' }], () => {}, (raw, completion) => {
        resolveStream({ raw, completion, published: window._aioRunAIResponsePipeline(raw, { entrypoint: 'public-route-browser-fixture', streamPhase: 'complete', completion, record: false }) });
      }, rejectStream, { modelKey: 'haiku' });
    });
    const questionPlan = { currentSensitive: true, sessionEvidence: { verified: true, observedAt: '2026-08-18T13:00:00Z', status: 'open' }, researchDecision: { requirement: 'OPTIONAL' } };
    const unbound = window._aioRunAIResponsePipeline('[AI_ANSWER_PLAN]' + JSON.stringify({
      schemaVersion: 'answer-plan.v1', summary: '변동성과 위험 선호를 함께 확인해야 합니다.',
      claims: [{ type: 'metric', text: 'VIX', value: 15.2, unit: 'index', asOf: '2026-08-18T13:00:00Z', source: 'fixture', evidenceIds: ['missing-vix'], status: 'verified' }],
      sections: [{ title: '조건', body: '확인된 근거가 부족하면 정성적 조건만 유지합니다.' }], citations: [], followUps: []
    }) + '[/AI_ANSWER_PLAN]', { entrypoint: 'unbound-fixture', questionPlan, evidence: [], streamPhase: 'complete', record: false });
    const invalid = window._aioRunAIResponsePipeline('[AI_ANSWER_PLAN]' + JSON.stringify({
      schemaVersion: 'answer-plan.v1', summary: '현재 VIX는 15.2입니다', claims: [],
      sections: [{ title: '조건', body: '변동성과 위험 선호를 함께 확인해야 합니다.' }], citations: [], followUps: []
    }) + '[/AI_ANSWER_PLAN]', { entrypoint: 'invalid-fixture', questionPlan, evidence: [], streamPhase: 'complete', record: false });
    const truncated = window._aioRunAIResponsePipeline('[AI_ANSWER_PLAN]{"schemaVersion":"answer-plan.v1","summary":"공급과 수요를 함께 확인해야 합니다","claims":[]', {
      entrypoint: 'truncated-fixture', streamPhase: 'complete', completion: { stopReason: 'max_tokens', truncated: true }, record: false
    });
    const partial = window._aioRunAIResponsePipeline('[AI_ANSWER_PLAN]{"schemaVersion":"answer-plan.v1"', { entrypoint: 'partial-fixture', streamPhase: 'partial', record: false });
    return { config: window.AIO.getPublicConfig(), routeState, streamed, unbound, invalid, truncated, partial };
  });

  const failures = [];
  const assert = (label, condition) => { if (!condition) failures.push(label); };
  assert('fresh config publishes Worker', result.config?.ai?.workerUrl === workerBase && result.config?.ai?.serverMode === 'shared-worker-fallback');
  assert('fresh browser selects ready public Worker', result.routeState?.ok === true && result.routeState?.target?.source === 'public-config');
  assert('public request uses Worker cap', observedRequest?.body?.max_tokens === 1500 && !observedRequest?.headers?.['x-api-key']);
  assert('complete stream publishes useful answer', result.streamed?.published?.blocked === false && /공용 경로의 완결된 응답/.test(result.streamed.published.text) && result.streamed?.completion?.stopReason === 'end_turn');
  assert('unbound claim is removed but explanation survives', result.unbound?.blocked === false && /변동성과 위험 선호/.test(result.unbound.text) && !/15\.2/.test(result.unbound.text) && result.unbound?.limitations?.includes('answer-plan-claim-degraded'));
  assert('invalid numeric prose is removed but qualitative section survives', result.invalid?.blocked === false && /변동성과 위험 선호/.test(result.invalid.text) && !/15\.2/.test(result.invalid.text));
  assert('truncated JSON recovers prose and reports limitation', result.truncated?.blocked === false && /공급과 수요/.test(result.truncated.text) && result.truncated?.limitations?.includes('model-output-truncated'));
  assert('partial JSON never exposes control payload', result.partial?.text === 'AI 답변을 구성하고 근거를 검증하는 중…' && !/AI_ANSWER_PLAN/.test(result.partial.text));
  assert('no browser runtime errors', errors.length === 0);
  if (failures.length) throw new Error(`${failures.join(' | ')}\n${JSON.stringify({ result, observedRequest, errors }, null, 2)}`);
  console.log(JSON.stringify({ ok: true, route: result.routeState.target.source, worker: result.config.ai.workerUrl, maxTokens: observedRequest.body.max_tokens, partialClaimDegradation: true, truncatedRecovery: true, errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
