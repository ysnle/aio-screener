import { randomUUID } from 'node:crypto';
import { HEADLINE_GLOSSARY_PAIRS } from '../../src/domain/briefing/headline-terms.js';

// v59.74: the free Workers AI path gets the same market glossary as the shared-model prompt.
const HEADLINE_TRANSLATE_GLOSSARY = HEADLINE_GLOSSARY_PAIRS.map(([en, ko]) => `${en} → ${ko}`).join(', ');

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

// ---- request profiles ---------------------------------------------------------------------------------------------
// v59.59 (AI lane refactor): every producer request to the shared Worker is one of three shapes. The token ceilings and
// reasoning effort used to be literals at each call site (requestSharedAnalysis, the event-brief jsonBody, the search
// builder), so the cost bound of a lane could only be read by opening its file. They live here once; a lane names
// its profile and the purpose its request is logged under.
export const SHARED_AI_PROFILES = Object.freeze({
  // Plain Korean prose checked by a deterministic validator afterwards (market reading, translation fallback, slot summary).
  analysis: Object.freeze({ maxOutputTokens: 1500, effort: 'none' }),
  // A JSON-schema answer over a fetched primary source (earnings release, FOMC statement, press-conference transcript).
  structured: Object.freeze({ maxOutputTokens: 2500, effort: 'low' }),
  // One bounded hosted search on an official/report domain list (Worker admission: worker/openai-budget.mjs).
  search: Object.freeze({ maxOutputTokens: 1200, effort: 'low', maxToolCalls: 1 })
});

// Every purpose prefix a producer logs (the X-AIO-Idempotency-Key label and meta.aiUsage / brief.ai rows), with its
// profile and owner. A per-symbol purpose ("event-brief-earnings-NVT") is matched by its prefix.
export const SHARED_AI_PURPOSES = Object.freeze({
  'market-analysis': { profile: 'analysis', owner: 'scripts/producer/market-narrative.mjs' },
  'headline-translation': { profile: 'analysis', owner: 'scripts/producer/market-narrative.mjs' },
  'slot-summary': { profile: 'analysis', owner: 'scripts/lib/market-timeline.mjs' },
  'event-brief-earnings': { profile: 'structured', owner: 'scripts/fetch-event-briefs.mjs' },
  'event-brief-fomc-statement': { profile: 'structured', owner: 'scripts/fetch-event-briefs.mjs' },
  'event-brief-fomc-transcript': { profile: 'structured', owner: 'scripts/fetch-event-briefs.mjs' },
  'event-brief-fomc-presser': { profile: 'search', owner: 'scripts/fetch-event-briefs.mjs' },
  'event-brief-call': { profile: 'search', owner: 'scripts/fetch-event-briefs.mjs' },
  'event-brief-reasons': { profile: 'search', owner: 'scripts/fetch-event-briefs.mjs' },
  'official-ref': { profile: 'search', owner: 'scripts/lib/web-reference-verify.mjs' }
});
export function sharedAiPurpose(purpose) {
  const label = String(purpose || '');
  const key = Object.keys(SHARED_AI_PURPOSES).filter((prefix) => label === prefix || label.startsWith(`${prefix}-`)).sort((a, b) => b.length - a.length)[0];
  return key ? { key, ...SHARED_AI_PURPOSES[key] } : null;
}

const jsonSchemaFormat = (schemaName, schema) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(schemaName || '')) || !schema || typeof schema !== 'object') throw new Error('json schema required');
  return { format: { type: 'json_schema', name: schemaName, schema, strict: true } };
};

/** A text (or, with schemaName/schema, a JSON-schema) request body without tools. */
export function buildSharedTextBody(prompt, { profile = 'analysis', maxOutputTokens, schemaName, schema } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('prompt required');
  const base = SHARED_AI_PROFILES[profile];
  if (!base || profile === 'search') throw new Error(`text profile required: ${profile}`);
  return { model: SHARED_AI_MODEL, input: [{ role: 'user', content: prompt }],
    max_output_tokens: maxOutputTokens || base.maxOutputTokens, reasoning: { effort: base.effort }, store: false, stream: false,
    ...(schemaName || schema ? { text: jsonSchemaFormat(schemaName, schema) } : {}) };
}

// P1734: one bounded hosted-search request for the official-reference lane. The body mirrors the Worker
// admission contract (worker/openai-budget.mjs): exactly one web_search tool, search_context_size 'low',
// return_token_budget 'default', an explicit official allowed_domains filter, and at most two tool calls.
// The answer is only a candidate; scripts/lib/web-reference-verify.mjs publishes nothing it cannot find on
// the official page itself.
const SEARCH_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/;
export function buildSharedWebSearchBody(prompt, { allowedDomains, schemaName, schema, maxToolCalls = SHARED_AI_PROFILES.search.maxToolCalls, maxOutputTokens = SHARED_AI_PROFILES.search.maxOutputTokens } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('search prompt required');
  if (!Array.isArray(allowedDomains) || !allowedDomains.length || allowedDomains.length > 10
    || allowedDomains.some(domain => typeof domain !== 'string' || !SEARCH_DOMAIN.test(domain))) throw new Error('official allowed_domains required');
  const text = jsonSchemaFormat(schemaName, schema);
  if (![1, 2].includes(maxToolCalls)) throw new Error('max_tool_calls must be 1 or 2');
  return { model: SHARED_AI_MODEL, input: [{ role: 'user', content: prompt }],
    tools: [{ type: 'web_search', search_context_size: 'low', return_token_budget: 'default', filters: { allowed_domains: [...allowedDomains] } }],
    tool_choice: 'required', max_tool_calls: maxToolCalls, max_output_tokens: maxOutputTokens,
    reasoning: { effort: SHARED_AI_PROFILES.search.effort }, store: false, stream: false, text };
}

/** Token and search counts of one Responses payload (counts only; never model text). */
export function sharedAiUsage(payload) {
  return { inputTokens: Number(payload?.usage?.input_tokens) || 0, outputTokens: Number(payload?.usage?.output_tokens) || 0,
    searchCalls: Array.isArray(payload?.output) ? payload.output.filter((item) => item?.type === 'web_search_call').length : 0 };
}

// ---- transport -------------------------------------------------------------------------------------------------------
// v59.59: the one POST to the Worker's /openai route. requestSharedAnalysis, requestSharedWebSearch and the event-brief
// producer each carried their own copy (headers, abort timer, idempotency key, error mapping); the event-brief copy keyed
// requests by Date.now() and no run attempt. `purpose` labels the idempotency key so the Worker's request log tells the
// lanes apart, and a fresh UUID per actual request prevents replaying a spent reservation.
// The Worker's hosted-search deadline is 120 s (cloudflare-worker-proxy.js openAiDeadlineMs); search callers wait 125 s, just
// past that bound, so the Worker deadline answers first and the client receives its response.
export const SHARED_AI_TIMEOUT_MS = Object.freeze({ analysis: 30000, search: 125000 });
const keyPart = (value, fallback, pattern, max) => String(value || '').replace(pattern, '').slice(0, max) || fallback;
export function sharedAiIdempotencyKey(purpose, env = process.env) {
  const label = keyPart(purpose, 'shared-ai', /[^a-zA-Z0-9-]/g, 40);
  const run = keyPart(env.GITHUB_RUN_ID, 'local-fixture', /[^a-zA-Z0-9-]/g, 40);
  const attempt = keyPart(env.GITHUB_RUN_ATTEMPT, '1', /[^0-9]/g, 8);
  return `${label}-${run}-${attempt}-${randomUUID()}`;
}

/** Posts one budgeted body. Returns { payload } or { payload: null, reason } with a short reason code. */
export async function postSharedAi(body, { env = process.env, fetchImpl = fetch, timeoutMs = SHARED_AI_TIMEOUT_MS.analysis, purpose = 'shared-ai' } = {}) {
  const config = resolveSharedAiConfig(env);
  if (!config) return { payload: null, reason: 'shared-ai-not-configured' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIO-Automation-Token': config.token, 'X-AIO-Idempotency-Key': sharedAiIdempotencyKey(purpose, env) },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) return { payload: null, reason: `provider-http-${response.status}` };
    return { payload: await response.json(), reason: null };
  } catch (error) {
    return { payload: null, reason: error?.name === 'AbortError' || error?.name === 'TimeoutError' ? 'provider-timeout' : 'provider-error' };
  } finally { clearTimeout(timeout); }
}

/** Completed text of one request, with its token usage when the provider answered. */
export async function requestSharedText(body, options = {}) {
  const { payload, reason } = await postSharedAi(body, options);
  if (!payload) return { text: null, reason };
  const text = extractCompletedResponseText(payload);
  return { text, reason: text ? null : 'provider-response-incomplete', usage: sharedAiUsage(payload) };
}

/** Parses a JSON-schema answer: { json, usage } or { reason, usage }. */
export function parseSharedJsonPayload(payload) {
  const text = extractCompletedResponseText(payload);
  const usage = sharedAiUsage(payload);
  if (!text) return { reason: 'provider-response-incomplete', usage };
  try { return { json: JSON.parse(text), usage }; } catch { return { reason: 'provider-json-invalid', usage }; }
}

export async function requestSharedJson(body, { timeoutMs = body?.tools ? SHARED_AI_TIMEOUT_MS.search : SHARED_AI_TIMEOUT_MS.analysis, ...options } = {}) {
  const { payload, reason } = await postSharedAi(body, { timeoutMs, ...options });
  return payload ? parseSharedJsonPayload(payload) : { reason };
}

export async function requestSharedAnalysis(prompt, { purpose = 'market-analysis', timeoutMs = SHARED_AI_TIMEOUT_MS.analysis, ...options } = {}) {
  let body;
  try { body = buildSharedTextBody(prompt, { profile: 'analysis' }); } catch { return { text: null, reason: 'analysis-request-invalid' }; }
  return requestSharedText(body, { purpose, timeoutMs, ...options });
}

export async function requestSharedWebSearch(prompt, { env = process.env, fetchImpl = fetch, timeoutMs = SHARED_AI_TIMEOUT_MS.search, purpose = 'official-ref', ...options } = {}) {
  if (!resolveSharedAiConfig(env)) return { text: null, reason: 'shared-ai-not-configured' };
  let body;
  try { body = buildSharedWebSearchBody(prompt, options); } catch { return { text: null, reason: 'search-request-invalid' }; }
  return requestSharedText(body, { env, fetchImpl, timeoutMs, purpose });
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
        body: JSON.stringify({ titles: chunk, glossary: HEADLINE_TRANSLATE_GLOSSARY }),
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
