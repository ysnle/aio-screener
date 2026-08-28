/**
 * The only network entry point for new ESM code. Providers receive this
 * client; domain and UI modules never call fetch directly.
 */
export function createHttpClient({
  fetchImpl = globalThis.fetch,
  clock = { now: () => Date.now(), iso: () => new Date().toISOString() },
  defaultTimeoutMs = 8000
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('HTTP_GATEWAY_UNAVAILABLE');
  }

  async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const externalSignal = options.signal;
    let abortKind = 'timeout';
    const relayExternalAbort = () => {
      abortKind = 'external';
      try { controller.abort(externalSignal?.reason); } catch (_) { controller.abort(); }
    };
    if (externalSignal) {
      if (externalSignal.aborted) relayExternalAbort();
      else if (typeof externalSignal.addEventListener === 'function') externalSignal.addEventListener('abort', relayExternalAbort, { once: true });
    }
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : defaultTimeoutMs;
    const timeoutId = setTimeout(() => {
      abortKind = 'timeout';
      try { controller.abort('timeout'); } catch (_) { controller.abort(); }
    }, timeoutMs);
    const startedAt = clock.now();
    try {
      const response = await fetchImpl(url, {
        ...options,
        timeoutMs: undefined,
        signal: controller.signal,
        headers: { accept: 'application/json', ...(options.headers || {}) }
      });
      const data = await response.json();
      return Object.freeze({
        ok: response.ok,
        status: response.status,
        data,
        fetchedAt: clock.iso(),
        elapsedMs: Math.max(0, clock.now() - startedAt),
        error: response.ok ? null : `HTTP_${response.status}`
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        status: 0,
        data: null,
        fetchedAt: clock.iso(),
        elapsedMs: Math.max(0, clock.now() - startedAt),
        error: controller.signal.aborted
          ? (abortKind === 'external' || externalSignal?.aborted ? 'HTTP_ABORTED' : 'HTTP_TIMEOUT')
          : 'HTTP_FAILED'
      });
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal && typeof externalSignal.removeEventListener === 'function') externalSignal.removeEventListener('abort', relayExternalAbort);
    }
  }

  return Object.freeze({ requestJson });
}
