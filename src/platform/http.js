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
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : defaultTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
    const startedAt = clock.now();
    try {
      const response = await fetchImpl(url, {
        ...options,
        timeoutMs: undefined,
        signal: options.signal || controller.signal,
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
        error: error && error.name === 'AbortError' ? 'HTTP_TIMEOUT' : 'HTTP_FAILED'
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return Object.freeze({ requestJson });
}
