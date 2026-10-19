import { randomUUID } from 'node:crypto';

export const SHARED_AI_MODEL = 'gpt-6-luna';

// Actions carries only a Worker credential. The provider key never leaves the Worker.
export function resolveSharedAiConfig(env = process.env) {
  const token = env.AIO_AUTOMATION_TOKEN;
  if (typeof token !== 'string' || token.length < 32 || /[\r\n]/.test(token)) return null;
  try {
    const url = new URL(env.AI_PROXY_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/$/, '') + '/openai';
    return { url: url.href, token };
  } catch { return null; }
}

export function extractCompletedResponseText(payload) {
  if (payload?.status !== 'completed' || payload.error || payload.incomplete_details
      || !(payload.model === SHARED_AI_MODEL || /^gpt-6-luna-\d{4}-\d{2}-\d{2}$/.test(payload.model || '')) || !Array.isArray(payload.output)) return null;
  const messages = payload.output.filter(item => item?.type === 'message');
  if (!messages.length || messages.some(item => item.status !== 'completed' || item.role !== 'assistant')) return null;
  if (messages.some(item => !Array.isArray(item.content) || item.content.some(part => part?.type === 'refusal'))) return null;
  const text = messages.flatMap(item => item.content)
    .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text).join('\n').trim();
  return text || null;
}

// `purpose` labels the idempotency key so the Worker's request log tells the market reading, the translation fallback and
// the slot summary apart (all three used to be sent as market-analysis-*).
export async function requestSharedAnalysis(prompt, { env = process.env, fetchImpl = fetch, timeoutMs = 30000, purpose = 'market-analysis' } = {}) {
  const config = resolveSharedAiConfig(env);
  if (!config) return { text: null, reason: 'shared-ai-not-configured' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const run = String(env.GITHUB_RUN_ID || 'local-fixture').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
    const attempt = String(env.GITHUB_RUN_ATTEMPT || '1').replace(/[^0-9]/g, '').slice(0, 8);
    const label = String(purpose).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40) || 'market-analysis';
    // A fresh reservation for every actual request prevents replaying a spent reservation.
    const response = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIO-Automation-Token': config.token,
        'X-AIO-Idempotency-Key': `${label}-${run}-${attempt}-${randomUUID()}` },
      body: JSON.stringify({ model: SHARED_AI_MODEL, input: [{ role: 'user', content: prompt }],
        max_output_tokens: 1500, reasoning: { effort: 'none' }, store: false, stream: false }),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) return { text: null, reason: `provider-http-${response.status}` };
    const text = extractCompletedResponseText(await response.json());
    return { text, reason: text ? null : 'provider-response-incomplete' };
  } catch (error) {
    return { text: null, reason: error?.name === 'AbortError' ? 'provider-timeout' : 'provider-error' };
  } finally { clearTimeout(timeout); }
}

// P1734: one bounded hosted-search request for the official-reference lane. The body mirrors the Worker
// admission contract (worker/openai-budget.mjs): exactly one web_search tool, search_context_size 'low',
// return_token_budget 'default', an explicit official allowed_domains filter, and at most two tool calls.
// The answer is only a candidate; scripts/lib/web-reference-verify.mjs publishes nothing it cannot find on
// the official page itself.
const SEARCH_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/;
export function buildSharedWebSearchBody(prompt, { allowedDomains, schemaName, schema, maxToolCalls = 1, maxOutputTokens = 1200 } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('search prompt required');
  if (!Array.isArray(allowedDomains) || !allowedDomains.length || allowedDomains.length > 10
    || allowedDomains.some(domain => typeof domain !== 'string' || !SEARCH_DOMAIN.test(domain))) throw new Error('official allowed_domains required');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(schemaName || '')) || !schema || typeof schema !== 'object') throw new Error('json schema required');
  if (![1, 2].includes(maxToolCalls)) throw new Error('max_tool_calls must be 1 or 2');
  return { model: SHARED_AI_MODEL, input: [{ role: 'user', content: prompt }],
    tools: [{ type: 'web_search', search_context_size: 'low', return_token_budget: 'default', filters: { allowed_domains: [...allowedDomains] } }],
    tool_choice: 'required', max_tool_calls: maxToolCalls, max_output_tokens: maxOutputTokens,
    reasoning: { effort: 'low' }, store: false, stream: false,
    text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } } };
}

// The Worker's hosted-search deadline is 120 s (cloudflare-worker-proxy.js openAiDeadlineMs). The old 90 s
// client wait abandoned searches the Worker was still completing (and charging); 115 s keeps the client inside
// the Worker bound while covering those completions.
export async function requestSharedWebSearch(prompt, { env = process.env, fetchImpl = fetch, timeoutMs = 125000, purpose = 'official-reference', ...options } = {}) {
  const config = resolveSharedAiConfig(env);
  if (!config) return { text: null, reason: 'shared-ai-not-configured' };
  let body;
  try { body = buildSharedWebSearchBody(prompt, options); } catch { return { text: null, reason: 'search-request-invalid' }; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const run = String(env.GITHUB_RUN_ID || 'local-fixture').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
    const attempt = String(env.GITHUB_RUN_ATTEMPT || '1').replace(/[^0-9]/g, '').slice(0, 8);
    const label = String(purpose).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40) || 'official-reference';
    const response = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIO-Automation-Token': config.token,
        'X-AIO-Idempotency-Key': `${label}-${run}-${attempt}-${randomUUID()}` },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) return { text: null, reason: `provider-http-${response.status}` };
    const text = extractCompletedResponseText(await response.json());
    return { text, reason: text ? null : 'provider-response-incomplete' };
  } catch (error) {
    return { text: null, reason: error?.name === 'AbortError' ? 'provider-timeout' : 'provider-error' };
  } finally { clearTimeout(timeout); }
}

// 2026-10-14: headline translation on the Worker's Workers AI binding (free daily allowance). Returns the translated
// strings, or null with a reason — the caller then uses the shared OpenAI path, so a missing binding costs nothing.
// v57.61: the Worker accepts at most 20 titles per call (WORKERS_AI_TRANSLATE_MAX_TITLES), so larger lists go in
// sequential chunks; any failed chunk fails the whole list (the caller then uses one shared-model request). The
// reason carries the Worker's short error code only — never model output — because it lands in Actions logs.
export const WORKERS_AI_TRANSLATE_CHUNK = 20;
export async function requestWorkersAiTranslation(titles, { env = process.env, fetchImpl = fetch, timeoutMs = 45000 } = {}) {
  const config = resolveSharedAiConfig(env);
  if (!config) return { translations: null, reason: 'shared-ai-not-configured' };
  const list = Array.isArray(titles) ? titles : [];
  const translations = [];
  let model = null;
  for (let start = 0; start < list.length; start += WORKERS_AI_TRANSLATE_CHUNK) {
    const chunk = list.slice(start, start + WORKERS_AI_TRANSLATE_CHUNK);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(config.url.replace(/\/openai$/, '/workers-ai/translate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AIO-Automation-Token': config.token },
        body: JSON.stringify({ titles: chunk }),
        signal: controller.signal,
        redirect: 'error',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body?.translations) || body.translations.length !== chunk.length) {
        const code = typeof body?.error === 'string' && /^[a-z0-9:-]{1,48}$/.test(body.error) ? `-${body.error}` : '';
        return { translations: null, reason: `workers-ai-http-${response.status}${code}` };
      }
      translations.push(...body.translations);
      model = model || body.model || null;
    } catch (error) {
      return { translations: null, reason: error?.name === 'AbortError' ? 'workers-ai-timeout' : 'workers-ai-error' };
    } finally { clearTimeout(timeout); }
  }
  return { translations, model, reason: null };
}
