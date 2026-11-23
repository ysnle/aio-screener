export function withTimeout(promise, ms, fallback, onTimeout) {
  if (!promise || typeof promise.then !== 'function') return Promise.resolve(fallback);
  const waitMs = ms == null ? 2500 : Math.max(0, Number(ms) || 0);
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      try { if (typeof onTimeout === 'function') onTimeout(); } catch (_) { /* the fallback still wins */ }
      resolve(fallback);
    }, waitMs);
  });
  return Promise.race([
    promise.then((v) => { clearTimeout(timer); return v; }).catch(() => { clearTimeout(timer); return fallback; }),
    timeoutPromise
  ]);
}
