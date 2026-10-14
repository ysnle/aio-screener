// HTTP helpers shared by scripts/fetch-data.mjs and its split-out source modules (v57.62).
// One definition of the bot User-Agent, the JSON retry policy (P1547) and the RSS/HTML text fetch.

export const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener-bot/1.0)' };

export async function fetchJSON(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    // P1547: the deadline covers the body read (cleared only after r.json()), and a definitive 4xx
    // (not 408/429) is returned to the caller instead of being retried against the same provider.
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { headers: UA, signal: ctrl.signal, ...opts });
      if (!r.ok) {
        const err = new Error('HTTP ' + r.status);
        err.status = r.status;
        throw err;
      }
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) break;
      await new Promise(res => setTimeout(res, 600 * (i + 1)));
    } finally {
      clearTimeout(to);
    }
  }
  throw lastErr;
}

// RSS/HTML 텍스트 fetch — 단일 시도, JSON API와 달리 retry 불요(피드별 실패는 호출자가 무시).
export async function _fetchRss(url, timeoutMs) {
  timeoutMs = timeoutMs || 12000;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(to); }
}

// P734: Google News RSS can transiently serve a cached window with no items in
// the completed 08:00 KST cycle. Retry the feed and then broaden only the
// provider query window; the caller still filters every item back to the
// canonical 24-hour cycle, so stale articles are never promoted as current.
export async function _fetchRssWithRetry(url, timeoutMs, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await _fetchRss(url, timeoutMs); }
    catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}
