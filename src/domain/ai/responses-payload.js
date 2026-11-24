// One reading of a completed Responses payload from the shared Worker, for the producers (scripts/lib/ai-shared-analysis.mjs)
// and the browser's non-streaming readings (src/data/providers/shared-reading-request.js). Pure.
import { AI_MODEL } from './worker-contract.js';

/** The assistant's text of a completed response from the shared model, or null (incomplete, refused, another model). */
export function extractCompletedResponseText(payload) {
  if (payload?.status !== 'completed' || payload.error || payload.incomplete_details
      || !(payload.model === AI_MODEL || new RegExp(`^${AI_MODEL}-\\d{4}-\\d{2}-\\d{2}$`).test(payload.model || '')) || !Array.isArray(payload.output)) return null;
  const messages = payload.output.filter(item => item?.type === 'message');
  if (!messages.length || messages.some(item => item.status !== 'completed' || item.role !== 'assistant')) return null;
  if (messages.some(item => !Array.isArray(item.content) || item.content.some(part => part?.type === 'refusal'))) return null;
  const text = messages.flatMap(item => item.content)
    .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text).join('\n').trim();
  return text || null;
}

/** Token usage and hosted-search calls of one response. */
export function sharedAiUsage(payload) {
  return { inputTokens: Number(payload?.usage?.input_tokens) || 0, outputTokens: Number(payload?.usage?.output_tokens) || 0,
    searchCalls: Array.isArray(payload?.output) ? payload.output.filter((item) => item?.type === 'web_search_call').length : 0 };
}
