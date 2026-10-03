import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
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
const observedRequests = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith(localBase) && new URL(url).pathname === '/public-config.json') {
      const config = JSON.parse(readFileSync(resolve(root, 'public-config.json'), 'utf8'));
      // P1421: fixture readiness is independent of the held deployment state.
      config.ai = { ...config.ai, workerUrl: workerBase, provider: 'openai', model: 'gpt-6-luna', serverMode: 'shared-worker-only', chatPolicy: 'shared-worker-only', routeStatus: 'PUBLISHED' };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) });
    }
    if (url.startsWith(localBase)) return route.continue();
    if (url === `${workerBase}/health`) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': localBase },
        body: JSON.stringify({ schemaVersion: 'aio-worker-health.v1', ok: true, revision: 'fixture', ai: { configured: true, quotaConfigured: true, authorityReady: true, authorityJurisdiction: 'us', ready: true, provider: 'openai', model: 'gpt-6-luna', maxTokens: 1500 } })
      });
    }
    if (url === `${workerBase}/openai`) {
      const requestBody = JSON.parse(request.postData() || '{}');
      observedRequests.push({ headers: request.headers(), body: requestBody });
      if (requestBody.stream === false) {
        const translated = JSON.stringify([{ idx: 1, title: '공용 번역 연결 확인', desc: '수집된 자료의 번역입니다.', summary: '번역 응답을 확인했습니다.', tickers: [] }]);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'completed', model: 'gpt-6-luna', output: [{ type: 'message', content: [{ type: 'output_text', text: translated }] }], usage: { input_tokens: 10, output_tokens: 20 } }) });
      }
      const plan = '[AI_ANSWER_PLAN]' + JSON.stringify({
        schemaVersion: 'answer-plan.v1',
        summary: '공용 경로의 완결된 응답입니다.',
        claims: [],
        sections: [{ title: '검증', body: '신규 브라우저에서도 Worker를 거쳐 답변을 받습니다.' }],
        citations: [],
        followUps: ['근거 범위를 설명해줘']
      }) + '[/AI_ANSWER_PLAN]';
      const body = [
        `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: plan })}\n\n`,
        `data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 12, output_tokens: 80 } } })}\n\n`
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
    const config = window.AIO.getPublicConfig();
    const routeDisabled = !config?.ai?.workerUrl;
    const streamed = routeDisabled ? null : await new Promise((resolveStream, rejectStream) => {
      window.callClaude('Answer briefly.', [{ role: 'user', content: '공용 경로 확인' }], () => {}, (raw, completion) => {
        resolveStream({ raw, completion, published: window._aioRunAIResponsePipeline(raw, { entrypoint: 'public-route-browser-fixture', streamPhase: 'complete', completion, record: false }) });
      }, rejectStream, { modelKey: 'luna' });
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
    return { config, routeState, routeDisabled, streamed, unbound, invalid, truncated, partial };
  });

  await page.waitForFunction(() => typeof autoTranslateNews === 'function' && !_translationInProgress);
  const queuedTranslation = await page.evaluate(async () => {
    // P1421: execute the actual producer consumer with an offline response fixture.
    const item = { title: 'Luna transport fixture unique news', source: 'fixture', desc: '' };
    _aioBootPhase.translationReady = true;
    // P1423: simulate an active batch and exercise the actual handoff path.
    _translationInProgress = true;
    await autoTranslateNews([item]);
    const queued = _translationDeferredItems.has(_tcKey(item.title));
    _translationInProgress = false;
    _aioReleaseDeferredNewsTranslation();
    return queued;
  });
  // P1423: another background batch may own the route while this item queues.
  await page.waitForFunction(() => _translationCache.has(_tcKey('Luna transport fixture unique news')), { timeout: 30000 });
  const translation = await page.evaluate(() => _translationCache.get(_tcKey('Luna transport fixture unique news'))?.ko_title);
  const failures = [];
  const assert = (label, condition) => { if (!condition) failures.push(label); };
  assert('P1423: concurrent translation preserves the requested item', queuedTranslation === true);
  // P1421: translation must share the same authority and expose no provider key.
  assert('shared Luna translation reaches completed JSON', translation === '공용 번역 연결 확인');
  const translationRequest = observedRequests.find(candidate => candidate.body?.stream === false && JSON.stringify(candidate.body.input).includes('Luna transport fixture unique news'));
  assert('translation uses shared Responses caps and idempotency', translationRequest?.body?.model === 'gpt-6-luna' && translationRequest?.body?.max_output_tokens === 1500 && translationRequest?.headers?.['x-aio-idempotency-key'] && !translationRequest?.headers?.authorization);
  const publicRequest = observedRequests.find((candidate) => JSON.stringify(candidate.body?.input || '').includes('공용 경로 확인'))
    || observedRequests.find((candidate) => candidate.body?.max_output_tokens === 1500)
    || observedRequests[0]
    || null;
  if (result.routeDisabled) {
    assert('disabled route is explicit and personal-key-only', result.config?.ai?.routeStatus === 'DISABLED'
      && result.config?.ai?.routeReason
      && result.config?.ai?.routeEvidence?.status === 'OPERATOR_REQUIRED'
      && result.config?.ai?.serverMode === 'shared-worker-only'
      && result.config?.ai?.chatPolicy === 'shared-worker-only');
    assert('fresh browser reports no public Worker route', result.routeState?.ok === false && result.routeState?.reason === 'NO_ROUTE');
    assert('disabled route does not issue a public Worker request', observedRequests.length === 0);
  } else {
    assert('fresh config publishes Worker', result.config?.ai?.workerUrl === workerBase && result.config?.ai?.serverMode === 'shared-worker-only');
    assert('fresh browser selects ready public Worker', result.routeState?.ok === true && result.routeState?.target?.source === 'public-config');
    assert('P1421: browser has no personal AI entry', !await page.locator('#sidebar-api-key').count() && !await page.locator('#aio_perplexity_key_input').count());
    assert('public request uses Worker cap', publicRequest?.body?.max_output_tokens === 1500 && !publicRequest?.headers?.['x-api-key']);
    assert('complete stream publishes useful answer', result.streamed?.published?.blocked === false && /공용 경로의 완결된 응답/.test(result.streamed.published.text) && result.streamed?.completion?.stopReason === 'end_turn');
  }
  assert('unbound claim is removed but explanation survives', result.unbound?.blocked === false && /변동성과 위험 선호/.test(result.unbound.text) && !/15\.2/.test(result.unbound.text) && result.unbound?.limitations?.includes('answer-plan-claim-degraded'));
  assert('invalid numeric prose is removed but qualitative section survives', result.invalid?.blocked === false && /변동성과 위험 선호/.test(result.invalid.text) && !/15\.2/.test(result.invalid.text));
  assert('truncated JSON recovers prose and reports limitation', result.truncated?.blocked === false && /공급과 수요/.test(result.truncated.text) && result.truncated?.limitations?.includes('model-output-truncated'));
  assert('partial JSON never exposes control payload', result.partial?.text === 'AI 답변을 구성하고 근거를 검증하는 중…' && !/AI_ANSWER_PLAN/.test(result.partial.text));
  assert('no browser runtime errors', errors.length === 0);
  if (failures.length) throw new Error(`${failures.join(' | ')}\n${JSON.stringify({ result, publicRequest, observedRequests, errors }, null, 2)}`);
  console.log(JSON.stringify({ ok: true, route: result.routeDisabled ? 'disabled' : result.routeState.target.source, worker: result.config.ai.workerUrl, maxTokens: publicRequest?.body?.max_output_tokens || null, workerRequestCount: observedRequests.length, partialClaimDegradation: true, truncatedRecovery: true, errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
