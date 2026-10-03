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

export async function requestSharedAnalysis(prompt, { env = process.env, fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  const config = resolveSharedAiConfig(env);
  if (!config) return { text: null, reason: 'shared-ai-not-configured' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const run = String(env.GITHUB_RUN_ID || 'local-fixture').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
    const attempt = String(env.GITHUB_RUN_ATTEMPT || '1').replace(/[^0-9]/g, '').slice(0, 8);
    // A fresh reservation for every actual request prevents replaying a spent reservation.
    const response = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIO-Automation-Token': config.token,
        'X-AIO-Idempotency-Key': `market-analysis-${run}-${attempt}-${randomUUID()}` },
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
