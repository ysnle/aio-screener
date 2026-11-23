export const CORE_READ_SETTLED_STATES = Object.freeze(new Set(['ready', 'failed', 'empty']));
export function coreReadsSettled(root) {
  const history = Boolean(root?._aioHistoryMeta || (root?._aioHistory || []).length) || CORE_READ_SETTLED_STATES.has(root?.__aioHistoryLoadState);
  const server = Boolean(root?._serverDataMeta) || CORE_READ_SETTLED_STATES.has(root?.__aioServerDataLoadState);
  return history && server;
}
export const ROWS_FIRST_ROUTES = Object.freeze(new Set(['screener', 'ticker', 'portfolio', 'themes', 'breadth']));

export function createCriticalDataGate({ isReady, subscribe, schedule, fallbackMs = 20000 } = {}) {
  let open = false;
  const waiting = [];
  const release = () => {
    if (open) return;
    open = true;
    for (const task of waiting.splice(0)) {
      try {
        const result = task();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (_) { /* a waiting task never blocks the others */ }
    }
  };
  const check = () => { if (!open && isReady?.()) release(); };
  const unsubscribe = typeof subscribe === 'function' ? subscribe(check) : null;
  if (typeof schedule === 'function') schedule(release, fallbackMs);
  check();
  return {
    get open() { return open; },
    // Runs now when the gate is open or the caller says the current screen needs it; otherwise queues it once.
    run(task, { now = false } = {}) {
      if (open || now) return task();
      if (!waiting.includes(task)) waiting.push(task);
      return null;
    },
    dispose() {
      try { unsubscribe?.(); } catch (_) {}
      waiting.length = 0;
    }
  };
}
