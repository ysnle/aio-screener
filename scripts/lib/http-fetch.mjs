// One HTTP request policy for every data collector (2026-11-02 pipeline refactor).
// Before this module, eleven collectors (scripts/fetch-*.mjs and scripts/lib/producer-http.mjs) each wrote their own
// "fetch with a deadline": some cleared the timer before the body was read (a stalled body then hung the job), some used
// AbortSignal.timeout, and the HTTP error text and status field differed. The rules here are the ones P1547 settled on:
//   - the deadline covers the body read, not only the headers;
//   - a non-2xx answer throws an Error whose message is exactly `HTTP <status>` (artifacts and logs keep that text)
//     and whose `status` field carries the code;
//   - a definitive 4xx (anything but 408/429) is not retried against the same provider.
// Callers keep their own headers: SEC needs a contact User-Agent, several providers answer only a browser-like one.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function httpStatusError(status) {
  const error = new Error(`HTTP ${status}`);
  error.status = status;
  return error;
}

/** A 4xx other than 408 (timeout) and 429 (rate limit) will answer the same way on a retry. */
export function isDefinitiveClientError(error) {
  const status = Number(error?.status);
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/**
 * fetch(url) under a deadline that also covers reading the body with `read(response)`.
 * `init` is passed to fetch as is (headers, method, body); `fetchImpl` lets fixtures inject a fake transport.
 */
export async function fetchWithDeadline(url, { timeoutMs = 12000, init = {}, fetchImpl = fetch, read = (response) => response } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, ...init });
    if (!response.ok) throw httpStatusError(response.status);
    return await read(response);
  } finally {
    clearTimeout(timer);
  }
}

export const fetchJsonWithDeadline = (url, options = {}) => fetchWithDeadline(url, { ...options, read: (response) => response.json() });
export const fetchTextWithDeadline = (url, options = {}) => fetchWithDeadline(url, { ...options, read: (response) => response.text() });

/**
 * Run `task(attempt)` up to `tries` times. Waits `delayMs(attempt)` between tries and stops early when
 * `retryable(error)` says the next try cannot answer differently. The last error is rethrown.
 */
export async function withRetry(task, { tries = 3, delayMs = (attempt) => 600 * (attempt + 1), retryable = (error) => !isDefinitiveClientError(error) } = {}) {
  let lastError;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (!retryable(error) || attempt + 1 >= tries) break;
      await sleep(delayMs(attempt));
    }
  }
  throw lastError;
}
