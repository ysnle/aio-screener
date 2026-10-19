// Network stub preloaded by scripts/ci-producer-dry-run.mjs (`node --import`). Yahoo chart requests get a small
// deterministic synthetic chart so the run reaches every later stage; every other host answers 404 (a definitive
// failure, so retry loops end at once and each source plane takes its fallback path). Nothing leaves the machine.
const NOW = Date.now();
const DAY = 86400;

function seed(text) {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

const BARS = { '1d': 1, '5d': 5, '1mo': 22, '3mo': 64, '6mo': 128, '1y': 252, '2y': 504, '5y': 1260, '10y': 2520, max: 2520 };

function syntheticChart(symbol, interval, range) {
  const base = 50 + (seed(symbol) % 400);
  const nowSec = Math.floor(NOW / 1000);
  const count = BARS[range] || 5;
  // Daily bars on weekdays only, oldest first, each stamped at its session open (13:30Z).
  const timestamps = [];
  for (let day = 1; timestamps.length < count; day++) {
    const stamp = interval === '60m' ? nowSec - day * 3600 : Math.floor((NOW - day * DAY * 1000) / (DAY * 1000)) * DAY + 48600;
    const weekday = new Date(stamp * 1000).getUTCDay();
    if (interval === '60m' || (weekday !== 0 && weekday !== 6)) timestamps.unshift(stamp);
  }
  const close = timestamps.map((_, index) => Number((base * (1 + Math.sin((index + seed(symbol)) / 7) * 0.03 + index * 0.0004)).toFixed(4)));
  return {
    chart: {
      result: [{
        meta: {
          symbol, currency: 'USD', exchangeName: 'DRY', fullExchangeName: 'Dry run',
          exchangeTimezoneName: 'America/New_York', gmtoffset: -14400,
          regularMarketPrice: close[close.length - 1], regularMarketTime: nowSec - 900,
          chartPreviousClose: close[0], previousClose: close[close.length - 2], marketState: 'CLOSED'
        },
        timestamp: timestamps,
        indicators: { quote: [{ open: close, high: close, low: close, close, volume: close.map(() => 1000) }], adjclose: [{ adjclose: close }] }
      }],
      error: null
    }
  };
}

globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  globalThis.__aioDryRunRequests = (globalThis.__aioDryRunRequests || 0) + 1;
  const chart = url.pathname.match(/^\/v8\/finance\/chart\/([^/]+)$/);
  if (/(^|\.)finance\.yahoo\.com$/.test(url.hostname) && chart) {
    const body = JSON.stringify(syntheticChart(decodeURIComponent(chart[1]), url.searchParams.get('interval'), url.searchParams.get('range')));
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('dry run: no network', { status: 404 });
};
