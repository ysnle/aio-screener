// The tool rounds of one chat request (js/aio-chat.js callSharedAi drives them): which function calls a completed
// response asked for, the request fields of each round, the input items appended for the next request, and running a
// round's calls in parallel within the per-request limits. Pure apart from running the tools.
import { runTool, toolDefinitions, toolStatusLine, toolsPromptBlock, offerTools } from './registry.js';

/** At most two tool rounds and six calls per request; each call has eight seconds. */
export const TOOL_LOOP_LIMITS = Object.freeze({ rounds: 2, calls: 6, callTimeoutMs: 8000, inputItems: 64 });
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * The function calls of a finished response: the completed response's `output` array is the record; the items seen in
 * `response.output_item.done` events stand in only when it carries no output.
 */
export function functionCallsOf(response, streamedItems = []) {
  const output = Array.isArray(response?.output) && response.output.length ? response.output : (Array.isArray(streamedItems) ? streamedItems : []);
  return output.filter((item) => item && item.type === 'function_call');
}

/** A call the Worker and the runner can both take: a call id, a function name and a string of arguments. */
export function isWellFormedCall(item) {
  return !!item && item.type === 'function_call' && typeof item.call_id === 'string' && item.call_id.length > 0 && item.call_id.length <= 256
    && typeof item.name === 'string' && IDENTIFIER.test(item.name) && typeof item.arguments === 'string';
}

/**
 * The model's call as an input item: call id, name and arguments as returned. The output item's own id (fc_…) is left
 * out: with store:false the Worker cannot send back the reasoning item that id belongs to, and the provider refuses a
 * function-call item named by id without its reasoning item; matched by call_id alone it is plain input.
 */
export function callInputItem(item) {
  const out = { type: 'function_call', call_id: item.call_id, name: item.name, arguments: item.arguments };
  if (item.status === 'completed') out.status = 'completed';
  return out;
}

/** The hosted tools of a body (the web_search tool attachNativeSearch added): they travel beside the functions. */
export function hostedToolsOf(body) {
  return Array.isArray(body?.tools) ? body.tools.filter((tool) => tool && tool.type !== 'function') : [];
}

/**
 * The tool fields of a request: the hosted tools first, then the data functions. The first request keeps a forced search
 * ('required'); later rounds are 'auto'; the last allowed request sets tool_choice 'none' so the model must answer.
 */
export function toolRequestFields({ final = false, hosted = [], choice = 'auto' } = {}) {
  return { tools: [...hosted, ...toolDefinitions()], tool_choice: final ? 'none' : choice, parallel_tool_calls: true };
}

/**
 * The next request's input: the earlier input, the model's calls and one output per call. When the Worker's item limit
 * would be passed, the oldest conversation messages leave first (never the last question or a tool item).
 */
export function appendToolItems(input, calls, outputs, { maxItems = TOOL_LOOP_LIMITS.inputItems } = {}) {
  const next = [...(Array.isArray(input) ? input : []), ...calls.map(callInputItem), ...outputs];
  const isMessage = (item) => item && item.type !== 'function_call' && item.type !== 'function_call_output';
  while (next.length > maxItems && next.filter(isMessage).length > 1) next.splice(next.findIndex(isMessage), 1);
  return next;
}

const abortError = () => { try { return new DOMException('The chat request was cancelled.', 'AbortError'); } catch (_) { const error = new Error('The chat request was cancelled.'); error.name = 'AbortError'; return error; } };

function bounded(promise, ms) {
  let timer = null;
  return Promise.race([promise, new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false, text: '자료 요청이 시간 안에 끝나지 않아 이 자료는 없습니다.', entities: [] }), ms); })])
    .finally(() => clearTimeout(timer));
}

function untilAborted(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  let onAbort = null;
  return Promise.race([promise, new Promise((_, reject) => { onAbort = () => reject(abortError()); signal.addEventListener('abort', onAbort, { once: true }); })])
    .finally(() => signal.removeEventListener('abort', onAbort));
}

/**
 * Runs one round's calls in parallel. Calls past the request's remaining budget are not run; each gets an output saying
 * the limit was reached. Rejects with an AbortError when `signal` aborts. Resolves to
 * { outputs: function_call_output items, results: [{ name, ok, text, entities }], used: calls run so far }.
 */
export async function runToolCalls(calls, { root = globalThis, now = Date.now(), used = 0, signal = null, limits = TOOL_LOOP_LIMITS, run = runTool } = {}) {
  const room = Math.max(0, limits.calls - used);
  const results = await untilAborted(Promise.all(calls.map((call, index) => (index < room
    ? bounded(Promise.resolve().then(() => run(call.name, call.arguments, { root, now, signal })).catch(() => ({ ok: false, text: '자료를 읽는 중 오류가 나서 이 자료는 없습니다.', entities: [] })), limits.callTimeoutMs)
    : Promise.resolve({ ok: false, text: `이 질문의 자료 요청 한도(${limits.calls}건)를 넘어 실행하지 않았습니다. 지금 있는 자료로 답하세요.`, entities: [] })))), signal);
  return {
    outputs: calls.map((call, index) => ({ type: 'function_call_output', call_id: call.call_id, output: String(results[index]?.text || '') })),
    results: calls.map((call, index) => ({ name: call.name, ok: results[index]?.ok === true, text: String(results[index]?.text || ''), entities: results[index]?.entities || [] })),
    used: used + Math.min(calls.length, room)
  };
}

/**
 * The tool loop of one chat request, driven by callSharedAi (js/aio-chat.js). `body` is the next request's body: the
 * plain body with the tools attached, each round's follow-up, or the plain body again after the one fallback.
 * `observe(evt)` reads each stream event of a round (`beginRound()` resets it); `hidingText()` is true once the round
 * announced a call, so its text is not shown. `advance(stopReason)` resolves true when another request is needed — the
 * round's calls ran (hooks.onStatus before, hooks.onResults after) or a malformed call took the fallback — and false when
 * the answer is final. `refused(status)` takes the fallback for a refused tools request. Rejects with an AbortError when
 * `signal` aborts while the calls run. When the plain body carries hosted search, every request keeps it beside the
 * functions: the provider runs the search calls inside a response (the Worker caps them per request), the client runs the
 * function calls, and the round and call limits count function calls only.
 */
export function createToolSession(plainBody, hooks = {}, { root = globalThis, signal = null, fit = null, limits = TOOL_LOOP_LIMITS,
  run = (calls, options) => runToolCalls(calls, { ...options, root, limits }) } = {}) {
  const hosted = hostedToolsOf(plainBody);
  let body = { ...plainBody, ...toolRequestFields({ hosted, choice: plainBody?.tool_choice === 'required' ? 'required' : 'auto' }) };
  let rounds = 0, used = 0, fellBack = false, completed = null, streamed = [], hiding = false;
  const fallback = () => { if (fellBack) return false; fellBack = true; body = plainBody; return true; };
  const hook = (name, value) => { try { if (typeof hooks?.[name] === 'function') hooks[name](value); } catch (_) { /* a closed panel */ } };
  return {
    get body() { return body; },
    get rounds() { return rounds; },
    get calls() { return used; },
    keySuffix: () => (fellBack ? ':plain' : rounds ? `:r${rounds}` : ''),
    // Only a refusal that is about the tools is worth one request without them; any other 400 is the caller's error.
    refused: (status, detail = '') => status === 400 && /\b(?:tools?|functions?|web_search|search|schema)\b|(?<![가-힣])(?:웹검색|검색|도구)/i.test(String(detail)) && fallback(),
    beginRound() { completed = null; streamed = []; hiding = false; },
    observe(evt) {
      if ((evt?.type === 'response.output_item.added' || evt?.type === 'response.output_item.done') && evt.item?.type === 'function_call') {
        hiding = true;
        if (evt.type === 'response.output_item.done') streamed.push(evt.item);
      } else if (evt?.type === 'response.completed') completed = evt.response || null;
    },
    hidingText: () => hiding,
    async advance(stopReason) {
      if (fellBack || stopReason !== 'end_turn' || body.tool_choice === 'none') return false;
      const asked = functionCallsOf(completed, streamed);
      if (!asked.length) return false;
      if (!asked.every(isWellFormedCall)) return fallback();
      hook('onStatus', toolStatusLine(asked, root));
      const ran = await run(asked, { used, signal });
      if (signal?.aborted) throw signal.reason || abortError();
      used = ran.used;
      rounds += 1;
      hook('onResults', ran.results);
      const input = appendToolItems(body.input, asked, ran.outputs);
      body = { ...body, ...(typeof fit === 'function' ? { instructions: fit(input) } : {}), input, ...toolRequestFields({ hosted, final: rounds >= limits.rounds || used >= limits.calls }) };
      return true;
    }
  };
}

/** The reference text with the successful tool texts ahead of it (so the reference figure limit never drops them). */
export function withToolReference(results, referenceText = '') {
  const found = (Array.isArray(results) ? results : []).filter((result) => result?.ok && result.text).map((result) => result.text);
  return found.length ? `${found.join('\n\n')}\n\n${referenceText || ''}` : referenceText || '';
}

/** The chat-facing kit (window.AIO.chatTools) bound to the page root. */
export function chatToolKit(root = globalThis) {
  return Object.freeze({
    limits: TOOL_LOOP_LIMITS,
    offer: (turn) => offerTools(turn),
    promptBlock: (options) => toolsPromptBlock(options),
    reference: (results, referenceText) => withToolReference(results, referenceText),
    session: (plainBody, hooks, options = {}) => createToolSession(plainBody, hooks, { ...options, root })
  });
}
