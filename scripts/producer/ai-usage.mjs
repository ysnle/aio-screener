// Per-run AI usage receipt (pipeline redesign, 2026-10-19). The run makes up to three kinds of model request — the
// market reading (one call plus one validator retry), headline translation (Workers AI first, the shared model as the
// fallback) and the six-hour slot summary — and each step published only its own outcome field, so a run's request
// count and why a step called, reused or skipped were not visible in one place. Every requester the producer hands to
// those steps is wrapped here; meta.aiUsage publishes counts and short reason codes only (never prompt or model text).
import { requestSharedAnalysis, requestWorkersAiTranslation, resolveSharedAiConfig } from '../lib/ai-shared-analysis.mjs';

export const AI_USAGE_SCHEMA = 'aio-pipeline-ai-usage.v1';
const REASON = /^[a-z0-9:-]{1,64}$/;

export function createAiUsage({ env = process.env, fetchImpl = undefined } = {}) {
  const configured = !!resolveSharedAiConfig(env);
  const steps = {};
  const step = (purpose) => (steps[purpose] ||= { requests: 0, ok: 0, failures: {} });
  const count = (purpose, ok, reason, usage = null) => {
    const row = step(purpose);
    row.requests += 1;
    // v59.59: token counts per step (the provider's usage block; counts only). Input tokens per request is the cost
    // metric the AI-context work is judged by (OpenAI usage baseline 2026-10-26: ~2.5k -> ~11.7k per request).
    if (usage) {
      row.inputTokens = (row.inputTokens || 0) + (Number(usage.inputTokens) || 0);
      row.outputTokens = (row.outputTokens || 0) + (Number(usage.outputTokens) || 0);
    }
    if (ok) row.ok += 1;
    else { const code = REASON.test(String(reason || '')) ? reason : 'unknown'; row.failures[code] = (row.failures[code] || 0) + 1; }
  };
  // Returns null when the Worker is not configured, so each step keeps its own "not configured" path.
  const shared = (purpose) => (configured ? async (prompt) => {
    const result = await requestSharedAnalysis(prompt, { env, purpose, ...(fetchImpl ? { fetchImpl } : {}) });
    count(purpose, !!result?.text, result?.reason, result?.usage || null);
    return result;
  } : null);
  const workersTranslate = (purpose) => (configured ? async (titles) => {
    const result = await requestWorkersAiTranslation(titles, { env });
    count(`${purpose}:workers-ai`, Array.isArray(result?.translations), result?.reason);
    return result;
  } : null);
  // A step that decided without a request (reused, not due, not configured) records that outcome too.
  const note = (purpose, outcome) => { const row = step(purpose); row.outcome = REASON.test(String(outcome || '')) ? outcome : 'unknown'; };
  const receipt = () => {
    const purposes = Object.fromEntries(Object.entries(steps).sort(([a], [b]) => a.localeCompare(b)));
    const sharedRequests = Object.entries(purposes).filter(([purpose]) => !purpose.endsWith(':workers-ai')).reduce((sum, [, row]) => sum + row.requests, 0);
    const workersAiRequests = Object.entries(purposes).filter(([purpose]) => purpose.endsWith(':workers-ai')).reduce((sum, [, row]) => sum + row.requests, 0);
    const inputTokens = Object.values(purposes).reduce((sum, row) => sum + (row.inputTokens || 0), 0);
    const outputTokens = Object.values(purposes).reduce((sum, row) => sum + (row.outputTokens || 0), 0);
    return { schemaVersion: AI_USAGE_SCHEMA, configured, sharedRequests, workersAiRequests, inputTokens, outputTokens, purposes };
  };
  return { configured, shared, workersTranslate, note, receipt };
}

// What the market-reading step did this run, from its result and its request count.
export function marketAnalysisOutcome(analysis, usageRow) {
  const requests = usageRow?.requests || 0;
  if (!analysis) return 'analysis-unavailable';
  if (analysis.status === 'verified') {
    if (analysis.retained) return 'retained-previous';
    return requests ? (requests > 1 ? 'verified-after-retry' : 'verified') : 'reused';
  }
  return requests ? 'blocked' : (REASON.test(String(analysis.reason || '')) ? analysis.reason : 'blocked');
}
