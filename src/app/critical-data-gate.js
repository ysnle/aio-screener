// v58.80 (first-users F01): the first screens draw their verdict from data.json and history.json. On a slow line
// screener.json (~360 KB gzip) started beside them and shared the wire, so the verdict waited for a file it does not
// read. Work that only later screens need runs once both critical artifacts have arrived (or after a fallback wait);
// a screen that draws stock rows first still reads them at once.
export const ROWS_FIRST_ROUTES = Object.freeze(new Set(['screener', 'ticker', 'portfolio', 'themes']));

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
