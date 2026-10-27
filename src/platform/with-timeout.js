// v49.58 P321 R107: a promise that settles with `fallback` after `ms` (default 2.5 s) instead of hanging; a rejection
// also settles with the fallback. onTimeout runs when the bound fires (callers abort their request there). Moved
// unchanged from js/aio-chat.js (roadmap item 11, layer 1 채팅); window._withTimeout keeps the legacy name.
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
