// One non-streaming request to the shared Worker's /openai route for a per-subject reading (src/ai/reading/subject-reading.js).
// The same route, app token, model, body limit and monthly ledger as the chat (src/ui/chat/panel.js callSharedAi through
// src/data/providers/shared-ai-transport.js); a reading is one short answer, so it waits for the completed response
// instead of streaming. No retry here: an interrupted paid response may already be billed.
import { AI_WORKER_CONTRACT } from '../../domain/ai/worker-contract.js';
import { extractCompletedResponseText, sharedAiUsage } from '../../domain/ai/responses-payload.js';

export const READING_REQUEST = Object.freeze({ maxOutputTokens: 1500, effort: 'low', timeoutMs: 65000 });

/** The Worker's route state as the chat reads it: { ok, url, budgetState } or { ok: false, reason }. */
export async function readingRoute(root) {
  if (typeof root?._aioEnsureClaudeRoute !== 'function') return { ok: false, reason: 'no-route' };
  let state = null;
  try { state = await root._aioEnsureClaudeRoute(null); } catch (_) { state = null; }
  if (!state?.ok || !state.target?.url) return { ok: false, reason: state?.reason === 'NO_ROUTE' ? 'no-route' : 'route-not-ready' };
  return { ok: true, url: state.target.url, budgetState: state.health?.ai?.budgetState || 'unknown' };
}

/** { text, reason, usage, status } for one prompt. `purpose` labels the idempotency key in the Worker's request log. */
export async function requestSharedReading(root, prompt, { purpose = 'subject-reading', fetchImpl = null, signal = null } = {}) {
  const route = await readingRoute(root);
  if (!route.ok) return { text: null, reason: route.reason, usage: null, status: 0 };
  const body = {
    model: AI_WORKER_CONTRACT.model, instructions: '', input: [{ role: 'user', content: String(prompt || '') }],
    max_output_tokens: READING_REQUEST.maxOutputTokens, reasoning: { effort: READING_REQUEST.effort }, store: false, stream: false
  };
  const payload = JSON.stringify(body);
  if (new TextEncoder().encode(payload).length > AI_WORKER_CONTRACT.clientBodyTargetBytes) return { text: null, reason: 'prompt-too-large', usage: null, status: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READING_REQUEST.timeoutMs);
  signal?.addEventListener?.('abort', () => controller.abort(), { once: true });
  const headers = { 'Content-Type': 'application/json' };
  headers[AI_WORKER_CONTRACT.headers.appToken] = typeof root?._aioAppToken === 'function' ? root._aioAppToken() : '';
  headers[AI_WORKER_CONTRACT.headers.idempotencyKey] = `${purpose}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const response = await (fetchImpl || root.fetch.bind(root))(route.url, { method: 'POST', headers, body: payload, signal: controller.signal, credentials: 'omit', redirect: 'error' });
    if (!response.ok) return { text: null, reason: response.status === 429 ? 'rate-limit' : response.status === 402 ? 'budget' : `provider-http-${response.status}`, usage: null, status: response.status };
    const json = await response.json();
    const text = extractCompletedResponseText(json);
    return { text, reason: text ? null : 'provider-response-incomplete', usage: sharedAiUsage(json), status: response.status };
  } catch (error) {
    return { text: null, reason: error?.name === 'AbortError' ? 'provider-timeout' : 'provider-error', usage: null, status: 0 };
  } finally { clearTimeout(timer); }
}
