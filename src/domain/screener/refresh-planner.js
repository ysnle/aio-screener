import { createRefreshDemand, stableHash } from '../../data/contracts/screener.js';

export const REFRESH_PLANNER_VERSION = 'refresh-planner.v2';

function keyOf(demand) { return `${demand.instrumentId}|${demand.fieldGroup}|${demand.asOfBucket}`; }

function wholeNumber(value, fallback, minimum = 0) {
  return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

export function createRefreshPlanner({ now = () => Date.now(), maxAttempts = 3, baseRetryMs = 60_000, budget = {} } = {}) {
  const clock = typeof now === 'function' ? now : () => Date.now();
  const attemptLimit = wholeNumber(maxAttempts, 3, 1);
  const retryBase = wholeNumber(baseRetryMs, 60_000, 0);
  const queue = new Map();
  const attempts = new Map();
  const circuit = new Map();
  const quota = {
    maxItems: wholeNumber(budget.maxItems, 50),
    maxPerProvider: wholeNumber(budget.maxPerProvider, 25),
    used: 0,
    byProvider: new Map()
  };
  function enqueue(input) {
    const demand = createRefreshDemand(input);
    if (!demand.instrumentId || !demand.fieldGroup) return { accepted: false, reason: 'identity_missing', demand };
    const key = keyOf(demand);
    const existing = queue.get(key);
    if (existing) {
      if (demand.priority < existing.priority) queue.set(key, Object.freeze({ ...existing, priority: demand.priority, reason: demand.reason }));
      return { accepted: false, deduped: true, key, demand: queue.get(key) };
    }
    queue.set(key, demand);
    return { accepted: true, deduped: false, key, demand };
  }
  function plan({ providerId = 'unknown', market = null, limit = quota.maxItems } = {}) {
    const selected = [];
    const current = clock();
    const nowMs = Number.isFinite(current) ? current : Date.now();
    const planLimit = wholeNumber(limit, quota.maxItems);
    const providerUsed = quota.byProvider.get(providerId) || 0;
    const providerBudget = Math.max(0, quota.maxPerProvider - providerUsed);
    for (const [key, demand] of [...queue.entries()].sort((a, b) => (a[1].priority - b[1].priority) || a[0].localeCompare(b[0]))) {
      if (selected.length >= Math.min(planLimit, Math.max(0, quota.maxItems - quota.used))) break;
      if (selected.length >= providerBudget) break;
      if (['in-flight', 'blocked', 'failed'].includes(demand.status)) continue;
      if (demand.nextRetryAt && Date.parse(demand.nextRetryAt) > nowMs) continue;
      const circuitState = circuit.get(providerId);
      if (circuitState?.openUntil > nowMs) continue;
      const planned = Object.freeze({ ...demand, status: 'in-flight', providerId, market, idempotencyKey: key, plannerVersion: REFRESH_PLANNER_VERSION });
      queue.set(key, planned);
      selected.push(planned);
    }
    quota.used += selected.length;
    const byProvider = quota.byProvider.get(providerId) || 0;
    quota.byProvider.set(providerId, byProvider + selected.length);
    return Object.freeze(selected);
  }
  function acknowledge(demand, { ok = false, providerId = 'unknown', reason = null, lkgObservedAt = null } = {}) {
    const key = typeof demand === 'string' ? demand : keyOf(demand || {});
    const existing = queue.get(key);
    if (!existing) return { ok: false, reason: 'demand_not_found' };
    if (ok) {
      queue.delete(key);
      attempts.delete(key);
      circuit.delete(providerId);
      return { ok: true, key, status: 'completed' };
    }
    const count = (attempts.get(key) || existing.attempts || 0) + 1;
    attempts.set(key, count);
    const unsupported = /unsupported|rights|blocked/i.test(String(reason || ''));
    const terminal = unsupported || count >= attemptLimit;
    const current = clock();
    const nowMs = Number.isFinite(current) ? current : Date.now();
    const retryAt = terminal ? null : new Date(nowMs + retryBase * (2 ** Math.max(0, count - 1))).toISOString();
    if (terminal) queue.set(key, Object.freeze({ ...existing, attempts: count, status: unsupported ? 'blocked' : 'failed', nextRetryAt: retryAt, lkgObservedAt }));
    else queue.set(key, Object.freeze({ ...existing, attempts: count, status: 'retry', nextRetryAt: retryAt, lkgObservedAt }));
    if (!unsupported && count >= attemptLimit) circuit.set(providerId, Object.freeze({ openUntil: nowMs + retryBase * 4, reason: reason || 'retry_exhausted' }));
    return { ok: true, key, status: terminal ? (unsupported ? 'blocked' : 'failed') : 'retry', attempts: count, nextRetryAt: retryAt };
  }
  function snapshot() {
    const current = clock();
    const nowMs = Number.isFinite(current) ? current : Date.now();
    return Object.freeze({ plannerVersion: REFRESH_PLANNER_VERSION, generatedAt: new Date(nowMs).toISOString(), queued: Object.freeze([...queue.values()]), quota: Object.freeze({ maxItems: quota.maxItems, maxPerProvider: quota.maxPerProvider, used: quota.used }), circuits: Object.freeze(Object.fromEntries([...circuit.entries()].map(([provider, value]) => [provider, Object.freeze({ ...value })]))), queueHash: stableHash([...queue.values()]) });
  }
  function resetBudget() { quota.used = 0; quota.byProvider.clear(); }
  return Object.freeze({ enqueue, plan, acknowledge, snapshot, resetBudget, keyOf });
}
