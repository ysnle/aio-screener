// P1423: native ownership of the browser fetch transport (timeout + caller abort relay).
// v57.81: the P1422 FMP /api/v3 -> /stable rewrite (including the earnings-call transcript and ownership
// mappings), its payload aliasing and quota counting, and the Twelve Data credit reservation were retired.
// Personal data-provider keys left in v57.67 and their fetchers in v57.76, so no live caller produces those URLs.
export function createPersonalProviderTransport({ fetch }) {
function fetchWithTimeout(url, opts = {}, ms = 8000) {
  opts = opts || {};
  const ctrl = new AbortController();
  const externalSignal = opts.signal;
  const relayAbort = () => { try { ctrl.abort(); } catch(_) {} };
  if (externalSignal) {
    if (externalSignal.aborted) relayAbort();
    else if (typeof externalSignal.addEventListener === 'function') externalSignal.addEventListener('abort', relayAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => {
    clearTimeout(timer);
    if (externalSignal && typeof externalSignal.removeEventListener === 'function') externalSignal.removeEventListener('abort', relayAbort);
  });
}
return { fetchWithTimeout };
}
