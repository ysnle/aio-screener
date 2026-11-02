// HTTP helpers shared by scripts/fetch-data.mjs and its split-out source modules (v57.62).
// One definition of the bot User-Agent, the JSON retry policy (P1547) and the RSS/HTML text fetch.
// 2026-11-02: the deadline/error/retry mechanics live in ./http-fetch.mjs, shared with the standalone collectors.
import { fetchJsonWithDeadline, fetchTextWithDeadline, withRetry } from './http-fetch.mjs';

export const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener-bot/1.0)' };

// P1547: the deadline covers the body read, and a definitive 4xx (not 408/429) is returned to the caller instead of
// being retried against the same provider.
export function fetchJSON(url, opts = {}, tries = 3) {
  return withRetry(() => fetchJsonWithDeadline(url, { timeoutMs: 12000, init: { headers: UA, ...opts } }), { tries });
}

// RSS/HTML 텍스트 fetch — 단일 시도, JSON API와 달리 retry 불요(피드별 실패는 호출자가 무시).
export function _fetchRss(url, timeoutMs) {
  return fetchTextWithDeadline(url, { timeoutMs: timeoutMs || 12000, init: { headers: UA } });
}

// P734: Google News RSS can transiently serve a cached window with no items in
// the completed 08:00 KST cycle. Retry the feed and then broaden only the
// provider query window; the caller still filters every item back to the
// canonical 24-hour cycle, so stale articles are never promoted as current.
export function _fetchRssWithRetry(url, timeoutMs, attempts = 2) {
  return withRetry(() => _fetchRss(url, timeoutMs), { tries: attempts, delayMs: (attempt) => 350 * (attempt + 1), retryable: () => true });
}
