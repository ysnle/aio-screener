/**
 * The only network entry point for new ESM code. Providers receive this
 * client; domain and UI modules never call fetch directly.
 */

// v58.80 (first-users run-3): the request timeout covered the whole body, so on slow 3G (50 KB/s) screener.json
// (397 KB gzip) was aborted at exactly 8 s every time and restarted from zero. The timeout now bounds the wait for
// the response headers; the body may take as long as bytes keep arriving, and is cut only after `stallMs` of silence.
// Silence is measured across every streamed body: on a throttled link one large download can starve the others for
// tens of seconds (screener-universe.json got no byte for 19 s beside screener.json), which is a busy link, not a dead one.
let networkProgressAt = 0;
export async function readBodyText(response, { stallMs = 20_000, onStall } = {}) {
  const reader = response?.body?.getReader?.();
  if (!reader) return response.text();
  const decoder = new TextDecoder();
  let text = '';
  let timer = null;
  let ownProgressAt = Date.now();
  const check = () => {
    const idle = Date.now() - Math.max(ownProgressAt, networkProgressAt);
    if (idle < stallMs) { timer = setTimeout(check, stallMs - idle); return; }
    onStall?.();
    reader.cancel().catch(() => {});
  };
  try {
    timer = setTimeout(check, stallMs);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      ownProgressAt = networkProgressAt = Date.now();
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    clearTimeout(timer);
  }
}

export function createHttpClient({
  fetchImpl = globalThis.fetch,
  clock = { now: () => Date.now(), iso: () => new Date().toISOString() },
  defaultTimeoutMs = 8000,
  bodyStallMs = 20_000
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('HTTP_GATEWAY_UNAVAILABLE');
  }

  async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const externalSignal = options.signal;
    let abortKind = 'timeout';
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(new Error('HTTP_REQUEST_ABORTED'));
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const relayExternalAbort = () => {
      if (controller.signal.aborted) return;
      abortKind = 'external';
      try { controller.abort(externalSignal?.reason); } catch (_) { controller.abort(); }
    };
    if (externalSignal) {
      if (externalSignal.aborted) relayExternalAbort();
      else if (typeof externalSignal.addEventListener === 'function') externalSignal.addEventListener('abort', relayExternalAbort, { once: true });
    }
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : defaultTimeoutMs;
    const abortForTimeout = () => {
      if (controller.signal.aborted) return;
      abortKind = 'timeout';
      try { controller.abort('timeout'); } catch (_) { controller.abort(); }
    };
    const timeoutId = setTimeout(abortForTimeout, timeoutMs);
    const startedAt = clock.now();
    try {
      const operation = Promise.resolve().then(async () => {
        if (controller.signal.aborted) throw new Error('HTTP_REQUEST_ABORTED');
        const headers = new Headers(options.headers);
        if (!headers.has('accept')) headers.set('accept', 'application/json');
        const response = await fetchImpl(url, {
          ...options,
          timeoutMs: undefined,
          signal: controller.signal,
          headers
        });
        // P1408: the HTTP status survives a body that is not JSON (a 503 HTML error page used to
        // become status 0 / HTTP_FAILED, indistinguishable from a dropped connection).
        // A streamed body hands its deadline to the stall timer; a body without a stream keeps the request deadline.
        const streamed = typeof response?.body?.getReader === 'function';
        if (streamed) clearTimeout(timeoutId);
        let data = null;
        let parseFailed = false;
        try {
          data = streamed
            ? JSON.parse(await readBodyText(response, { stallMs: bodyStallMs, onStall: abortForTimeout }))
            : await response.json();
        } catch (_) { parseFailed = true; }
        return { response, data, parseFailed };
      });
      const { response, data, parseFailed } = await Promise.race([operation, aborted]);
      return Object.freeze({
        ok: response.ok && !parseFailed,
        status: response.status,
        data,
        fetchedAt: clock.iso(),
        elapsedMs: Math.max(0, clock.now() - startedAt),
        error: !response.ok ? `HTTP_${response.status}` : parseFailed ? 'HTTP_PARSE_FAILED' : null
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        status: 0,
        data: null,
        fetchedAt: clock.iso(),
        elapsedMs: Math.max(0, clock.now() - startedAt),
        error: controller.signal.aborted
          ? (abortKind === 'external' ? 'HTTP_ABORTED' : 'HTTP_TIMEOUT')
          : 'HTTP_FAILED'
      });
    } finally {
      clearTimeout(timeoutId);
      controller.signal.removeEventListener('abort', onAbort);
      if (externalSignal && typeof externalSignal.removeEventListener === 'function') externalSignal.removeEventListener('abort', relayExternalAbort);
    }
  }

  return Object.freeze({ requestJson });
}
