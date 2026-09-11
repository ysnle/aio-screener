// Isolated transport fixtures; no API key or external network is used.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8');
const start = source.indexOf('async function callClaude(');
const end = source.indexOf('// ── 스크리너 함수', start);
assert(start >= 0 && end > start);
const encode = value => new TextEncoder().encode(value);
const event = value => 'data: ' + JSON.stringify(value) + '\n\n';
const text = event({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'verified' } });
const terminal = 'data: ' + JSON.stringify({ type: 'message_stop' });
let assertions = 0;
for (const serverKey of [false, true]) {
  for (const kind of ['complete', 'provider-error', 'premature-eof', 'invalid-event', 'error-body-timeout', 'caller-abort']) {
    const deadlines = new Map();
    const result = { done: [], errors: [], cancelled: 0 };
    const caller = new AbortController();
    const context = {
      console: { log() {}, warn() {} }, AbortController, TextDecoder, performance,
      setTimeout(callback, delay) { const id = {}; deadlines.set(id, { callback, delay }); return id; },
      clearTimeout(id) { deadlines.delete(id); },
      getApiKey: () => 'fixture-only',
      getModelConfig: () => ({ id: 'fixture', label: 'fixture' }),
      _aioEnsureClaudeRoute: async () => ({ ok: true, target: { url: 'https://fixture.invalid', serverKey } }),
      _aioThrowIfChatAborted(signal) { if (signal?.aborted) throw signal.reason; },
      _aioLinkChatAbortSignal(signal, controller) { const cancel = () => controller.abort(); signal.addEventListener('abort', cancel); return () => signal.removeEventListener('abort', cancel); },
      _aioChatError: error => ({ displayMessage: error.message }),
      _aioAppToken: () => '',
      _aioFetchClaudeWithRetry: async (_url, options) => {
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
    vm.runInContext(source.slice(start, end), context);
    await context.callClaude('fixture', [{ role: 'user', content: 'test' }], () => {},
      (...args) => result.done.push(args), error => result.errors.push(error),
      { signal: caller.signal, onCancel() { result.cancelled++; } });
    if (kind === 'complete') {
      assert.equal(result.done.length, 1);
      assert.equal(result.done[0][0], 'verified');
      assert.equal(context._lastClaudeUsage, null, 'prior request usage must not leak');
      assert.equal(result.errors.length, 0);
    } else if (kind === 'caller-abort') {
      assert.equal(result.cancelled, 1);
      assert.equal(result.errors.length, 0);
      assert.equal(result.done.length, 0);
    } else {
      assert.equal(result.done.length, 0, kind + ' cannot complete successfully');
      assert.equal(result.errors.length, 1, kind + ' must report failure');
      assert.equal(result.cancelled, 0, 'timeout is not user cancellation');
    }
    assert.equal(deadlines.size, 0, kind + ' must clean timers');
    assertions++;
  }
}
console.log('AI provider stream check OK: ' + assertions + ' isolated direct/Worker transport scenarios.');
