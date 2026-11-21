// The completed daily bars of one symbol, read the way the 차트 screen reads them: two years of Yahoo daily bars through
// the app's chart transport, the session still in progress left out (completedBars), and for a Korean listing that
// Yahoo returns short or empty the Naver daily series (fetchKrDailyCandles, the provider the KR quotes use). The chart
// screen, the AI's technical block and 종목's header and year line all call this, so they read the same bars.
// Route-only: the chart and the chat load it; the boot set imports chart-bars.js alone.
import { barsFromYahoo, completedBars } from './chart-bars.js';

const KR_MIN_BARS = 260;
const FRESH_MS = 5 * 60 * 1000;
const MAX_HELD = 20;
const isKr = (symbol) => /\.(KS|KQ)$/i.test(String(symbol || ''));

// One request per root, symbol and range while it is fresh: 종목's header and its year line, 기술적 분석 and the AI read
// the same bars without asking the provider again. A miss is not kept. The request carries its own abort signal and is
// cancelled only when every caller that passed a signal has aborted (a caller without one keeps it alive).
const held = new WeakMap();

function sharedRequest(root, symbol, range) {
  const keyed = root && (typeof root === 'object' || typeof root === 'function');
  const memo = (keyed && held.get(root)) || new Map();
  if (keyed && !held.has(root)) held.set(root, memo);
  const key = `${String(symbol || '').trim().toUpperCase()}|${range}`;
  const kept = memo.get(key);
  if (kept && (kept.pending || Date.now() - kept.at < FRESH_MS) && !kept.controller.signal.aborted) return kept;
  const controller = typeof AbortController === 'function' ? new AbortController() : { signal: { aborted: false }, abort() { this.signal.aborted = true; } };
  const entry = { at: Date.now(), controller, pending: true, waiting: 0, keepAlive: false, promise: null };
  let request;
  try { request = Promise.resolve(root?._aioFetchYahooChartData?.(symbol, range, '1d', { signal: controller.signal })); } catch (_) { request = Promise.resolve(null); }
  entry.promise = request.catch(() => null).then((payload) => {
    entry.pending = false;
    entry.at = Date.now();
    if (!payload && memo.get(key) === entry) memo.delete(key);
    return payload || null;
  });
  memo.delete(key);
  memo.set(key, entry);
  while (memo.size > MAX_HELD) memo.delete(memo.keys().next().value);
  return entry;
}

/** The provider payload for a symbol (the first, slow part the chart waits on with its notice). */
export function requestDailyChartPayload(root, symbol, { range = '2y', signal = null } = {}) {
  if (signal?.aborted) return Promise.resolve(null);
  const entry = sharedRequest(root, symbol, range);
  if (!signal) { entry.keepAlive = true; return entry.promise; }
  entry.waiting += 1;
  return new Promise((resolve) => {
    const stop = () => {
      entry.waiting -= 1;
      if (entry.pending && !entry.keepAlive && entry.waiting <= 0) entry.controller.abort();
      resolve(null);
    };
    signal.addEventListener?.('abort', stop, { once: true });
    entry.promise.then((payload) => { signal.removeEventListener?.('abort', stop); if (!signal.aborted) { entry.waiting -= 1; resolve(payload); } });
  });
}

/**
 * Completed daily bars from a payload, with the Naver fallback for a short Korean series.
 * @returns {Promise<{ bars: object[], droppedLive: boolean, payload: object|null }>}
 */
export async function completedDailyBars(root, symbol, payload) {
  let result = completedBars(barsFromYahoo(payload), payload);
  if (isKr(symbol) && result.bars.length < KR_MIN_BARS && typeof root?.fetchKrDailyCandles === 'function') {
    const rows = await Promise.resolve().then(() => root.fetchKrDailyCandles(symbol, 500)).catch(() => null);
    if (Array.isArray(rows) && rows.length > result.bars.length) {
      payload = { ...(payload || {}), meta: { ...(payload?.meta || {}), currency: 'KRW', exchangeTimezoneName: 'Asia/Seoul' }, transport: 'naver-fchart' };
      result = completedBars(rows.map((row) => ({ time: row.date, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume })), payload);
    }
  }
  return { ...result, payload };
}

export async function loadCompletedDailyBars(root, symbol, options = {}) {
  return completedDailyBars(root, symbol, await requestDailyChartPayload(root, symbol, options));
}
