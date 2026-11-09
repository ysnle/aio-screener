// The completed daily bars of one symbol, read the way the 차트 screen reads them: two years of Yahoo daily bars through
// the app's chart transport, the session still in progress left out (completedBars), and for a Korean listing that
// Yahoo returns short or empty the Naver daily series (fetchKrDailyCandles, the provider the KR quotes use). The chart
// screen and the AI's technical block both call this, so the AI reads the bars the chart draws.
// Route-only: the chart and the chat load it; the boot set imports chart-bars.js alone.
import { barsFromYahoo, completedBars } from './chart-bars.js';

const KR_MIN_BARS = 260;
const isKr = (symbol) => /\.(KS|KQ)$/i.test(String(symbol || ''));

/** The provider payload for a symbol (the first, slow part the chart waits on with its notice). */
export function requestDailyChartPayload(root, symbol, { range = '2y', signal = null } = {}) {
  return Promise.resolve().then(() => root?._aioFetchYahooChartData?.(symbol, range, '1d', signal ? { signal } : undefined)).catch(() => null);
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
