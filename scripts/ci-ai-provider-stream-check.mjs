// Isolated transport fixtures; no API key or external network is used.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8');
const start = source.indexOf('async function callClaude(');
const end = source.indexOf('// ── 스크리너 함수', start);
assert(start >= 0 && end > start);
// P1245 (05 A05): callClaude records native citations and research tool errors in the per-request
// stream store, so this isolated transport context must execute the real store rather than a stub
// that can drift from it. The fixture passes no requestId, so the store returns no record and the
// transport assertions below are unchanged.
const storeStart = source.indexOf('var _AIO_AI_REQUEST_STREAM_LIMIT');
const storeEnd = source.indexOf('// P897: the ESM evidence module', storeStart);
assert(storeStart >= 0 && storeEnd > storeStart);
const encode = value => new TextEncoder().encode(value);
const event = value => 'data: ' + JSON.stringify(value) + '\n\n';
const text = event({ type: 'response.output_text.delta', delta: 'verified' });
const terminal = 'data: ' + JSON.stringify({ type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 12, input_tokens_details: { cached_tokens: 4 }, output_tokens: 8 } } });
let assertions = 0;
for (const serverKey of [true]) {
  for (const kind of ['complete', 'provider-error', 'premature-eof', 'invalid-event', 'incomplete', 'filtered', 'response-failed', 'citations', 'error-body-timeout', 'caller-abort']) {
    const deadlines = new Map();
    const result = { done: [], errors: [], cancelled: 0 };
    const caller = new AbortController();
    const context = {
      console: { log() {}, warn() {} }, AbortController, TextDecoder, performance,
      setTimeout(callback, delay) { const id = {}; deadlines.set(id, { callback, delay }); return id; },
      clearTimeout(id) { deadlines.delete(id); },
      getApiKey: () => 'fixture-only',
      getModelConfig: () => ({ id: 'gpt-6-luna', label: 'fixture', reasoningEffort: 'none' }),
      _aioEnsureClaudeRoute: async () => ({ ok: true, target: { url: 'https://fixture.invalid', serverKey } }),
      _aioThrowIfChatAborted(signal) { if (signal?.aborted) throw signal.reason; },
      _aioLinkChatAbortSignal(signal, controller) { const cancel = () => controller.abort(); signal.addEventListener('abort', cancel); return () => signal.removeEventListener('abort', cancel); },
      _aioChatError: error => ({ displayMessage: error.message }),
      _aioAppToken: () => '',
      _aioFetchClaudeWithRetry: async (_url, options) => {
        const bodyJson = JSON.parse(options.body);
        assert.equal(bodyJson.model, 'gpt-6-luna'); assert.equal(bodyJson.store, false);
        assert.equal(bodyJson.reasoning.effort, 'none'); assert.equal(bodyJson.max_output_tokens, 4000);
        assert.equal(bodyJson.input[0].role, 'user'); assert.equal(bodyJson.instructions, 'fixture');
        assert.equal(options.headers['X-AIO-Idempotency-Key'], 'fixture-stream-' + kind);
        assert(!bodyJson.tools); assert(!options.headers['x-api-key']); assert(!options.headers.Authorization);
        if (kind === 'error-body-timeout' || kind === 'caller-abort') {
          return {
            status: 500, ok: false,
            text: () => new Promise((_resolve, reject) => {
              options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
              if (kind === 'caller-abort') caller.abort();
              else for (const entry of [...deadlines.values()]) if (entry.delay === 30000) entry.callback();
            }),
          };
        }
        const body = kind === 'complete' ? text + terminal
          : kind === 'citations' ? text + event({ type: 'response.output_text.annotation.added', annotation: { type: 'url_citation', url: 'https://sec.gov/fixture', title: 'SEC' } }) + event({ type: 'response.output_text.annotation.added', annotation: { type: 'url_citation', url: 'javascript:alert(1)' } }) + terminal
          : kind === 'response-failed' ? text + event({ type: 'response.failed', response: { error: { message: 'provider failed' } } })
          : kind === 'filtered' ? text + event({ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'content_filter' } } })
          : kind === 'incomplete' ? text + event({ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } })
          : kind === 'provider-error' ? text + event({ type: 'error', error: { message: 'fixture overloaded' } })
          : kind === 'invalid-event' ? text + 'data: {broken}\n\n' : text;
        return new Response(new ReadableStream({ start(controller) {
          // Deliberately split the payload and leave the terminal line without LF.
          controller.enqueue(encode(body.slice(0, 17)));
          controller.enqueue(encode(body.slice(17)));
          controller.close();
        } }));
      },
    };
    context.window = context;
    context._lastClaudeUsage = { input_tokens: 99999 };
    vm.createContext(context);
    vm.runInContext(source.slice(storeStart, storeEnd) + '\n' + source.slice(start, end), context);
    await context.callClaude('fixture', [{ role: 'user', content: 'test' }], () => {},
      (...args) => result.done.push(args), error => result.errors.push(error),
      { signal: caller.signal, requestId: 'fixture-stream-' + kind, onCancel() { result.cancelled++; } });
    if (kind === 'complete' || kind === 'citations') {
      assert.equal(result.done.length, 1);
      assert.equal(result.done[0][0], 'verified');
      assert.equal(context._lastClaudeUsage.input_tokens, 12, 'prior request usage must not leak');
      assert.equal(context._lastClaudeUsage.output_tokens, 8);
      assert.equal(result.errors.length, 0);
      if (kind === 'citations') {
        const citations = context._aioAIRequestStream('fixture-stream-' + kind).citations;
        assert.equal(citations.length, 1); assert.equal(citations[0].url, 'https://sec.gov/fixture');
        assert.equal(citations[0].requestId, 'fixture-stream-citations');
      }
    } else if (kind === 'incomplete' || kind === 'filtered') {
      assert.equal(result.done.length, 1); assert.equal(result.done[0][1].truncated, true);
      assert.equal(result.done[0][1].stopReason, kind === 'filtered' ? 'incomplete' : 'max_output_tokens'); assert.equal(result.errors.length, 0);
    } else if (kind === 'caller-abort') {
      assert.equal(result.cancelled, 1);
      assert.equal(result.errors.length, 0);
      assert.equal(result.done.length, 0);
    } else {
      assert.equal(result.done.length, 0, kind + ' cannot complete successfully');
      assert.equal(result.errors.length, 1, kind + ' must report failure');
      assert.equal(result.cancelled, 0, 'timeout is not user cancellation');
      // P1421: a Responses failure must remain attached to its owning request.
      if (kind === 'provider-error' || kind === 'response-failed') {
        assert.equal(context._aioAIRequestStream('fixture-stream-' + kind).researchError,
          kind === 'provider-error' ? 'fixture overloaded' : 'provider failed');
      }
    }
    assert.equal(deadlines.size, 0, kind + ' must clean timers');
    assertions++;
  }
}
console.log('AI provider stream check OK: ' + assertions + ' isolated Responses Worker transport scenarios.');
