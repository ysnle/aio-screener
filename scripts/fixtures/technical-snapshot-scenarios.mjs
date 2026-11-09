// v59.88 (ADR-0003 S6): deterministic OHLCV inputs for the technical-engine golden fixture
// (scripts/dump-technical-snapshot-fixtures.mjs) and its parity check (scripts/ci-domain-parity-check.mjs).
// Pure arithmetic only — no Math.random — so a re-dump from the same revision reproduces the file byte for byte.

function series(n, closeAt, { range = 0.02, volumeAt = (i) => 1_000_000 + (i % 7) * 50_000, gapAt = () => 0, missingHL = () => false } = {}) {
  const out = [];
  let prevClose = closeAt(0);
  for (let i = 0; i < n; i++) {
    const close = Math.round(closeAt(i) * 100) / 100;
    const open = Math.round((prevClose * (1 + gapAt(i))) * 100) / 100;
    const swing = Math.max(close, open) * range * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.7)));
    const bar = { time: `2026-${String(1 + Math.floor(i / 28) % 12).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, open, close, volume: volumeAt(i) };
    if (!missingHL(i)) { bar.high = Math.round((Math.max(open, close) + swing * 0.5) * 100) / 100; bar.low = Math.round((Math.min(open, close) - swing * 0.5) * 100) / 100; }
    out.push(bar);
    prevClose = close;
  }
  return out;
}

const climax = (() => {
  const bars = series(140, (i) => 100 * Math.pow(1.006, i) + 3 * Math.sin(i / 4));
  const last = bars[bars.length - 1], prev = bars[bars.length - 2];
  // +8% day on 4x volume that closes in the lower half of its range.
  bars[bars.length - 1] = { ...last, open: prev.close * 1.05, high: prev.close * 1.12, low: prev.close * 1.02, close: prev.close * 1.08, volume: 5_000_000 };
  return bars;
})();

export const TECHNICAL_SNAPSHOT_SCENARIOS = Object.freeze([
  { name: 'insufficient_15', ohlcv: series(15, (i) => 50 + i) },
  { name: 'short_25_uptrend', ohlcv: series(25, (i) => 50 + i * 0.4) },
  { name: 'weekly_63_not_multiple_of_5', ohlcv: series(63, (i) => 80 + i * 0.3 + 2 * Math.sin(i / 3)) },
  { name: 'vcp_like_130', ohlcv: series(130, (i) => 100 + i * 0.25 + (10 - i / 13) * Math.sin(i / 5), { range: 0.03 - 0.0002 * 0 }) },
  { name: 'downtrend_220', ohlcv: series(220, (i) => 210 - i * 0.5 + 4 * Math.sin(i / 6)) },
  { name: 'uptrend_261', ohlcv: series(261, (i) => 40 * Math.pow(1.004, i) + 1.5 * Math.cos(i / 3)) },
  { name: 'choppy_200', ohlcv: series(200, (i) => 100 + 8 * Math.sin(i / 7) + 3 * Math.sin(i / 2.3)) },
  { name: 'climax_day_140', ohlcv: climax },
  { name: 'missing_high_low_120', ohlcv: series(120, (i) => 60 + i * 0.2, { missingHL: (i) => i % 9 === 0 }) },
  { name: 'flat_80', ohlcv: series(80, () => 100, { range: 0 }) },
  { name: 'zero_volume_70', ohlcv: series(70, (i) => 30 + Math.sin(i / 4), { volumeAt: () => 0 }) },
  { name: 'gappy_150', ohlcv: series(150, (i) => 70 + i * 0.1 + 6 * Math.sin(i / 9), { gapAt: (i) => (i % 17 === 0 ? 0.03 : i % 23 === 0 ? -0.025 : 0) }) },
  { name: 'dirty_rows_90', ohlcv: [null, { close: 'x' }, { close: -1 }, ...series(90, (i) => 20 + i * 0.05)] }
]);

const hot = TECHNICAL_SNAPSHOT_SCENARIOS.find((s) => s.name === 'climax_day_140').ohlcv;
const calm = TECHNICAL_SNAPSHOT_SCENARIOS.find((s) => s.name === 'uptrend_261').ohlcv;
const down = TECHNICAL_SNAPSHOT_SCENARIOS.find((s) => s.name === 'downtrend_220').ohlcv;

export const POSITION_RISK_SCENARIOS = Object.freeze([
  { name: 'live_quotes_three', context: { totalValue: 30_000 }, positions: [
    { ticker: 'NVDA', qty: 10, cost: 100, price: 1500, quoteSourceKind: 'live-quote', ohlcv: hot },
    { ticker: 'aapl', qty: 20, cost: 50, price: 450, allowedUse: 'decision', ohlcv: calm },
    { ticker: 'XOM', shares: 30, avgCost: 120, currentPrice: 200, currentQuoteAllowedUse: true, ohlcv: down }
  ] },
  { name: 'cached_quote_is_not_exposure', context: { totalValue: 15_000 }, positions: [
    { ticker: 'NVDA', qty: 10, cost: 100, price: 1500, quoteSourceKind: 'cached-close', ohlcv: hot }
  ] },
  { name: 'no_snapshot', context: { totalValue: 10_000 }, positions: [{ ticker: 'MSFT', qty: 5, cost: 300, price: 400, priceSource: 'live-quote', ohlcv: [] }] },
  { name: 'declared_value_wins', context: {}, positions: [
    { ticker: 'TSLA', qty: 3, cost: 200, price: 250, value: 900, valueSource: 'live-quote', quoteSourceKind: 'live-quote', ohlcv: calm },
    { ticker: 'AMD', qty: 4, cost: 90, price: 150, quoteSourceKind: 'live-quote', ohlcv: down }
  ] },
  { name: 'missing_total', context: {}, positions: [{ ticker: 'META', qty: 2, cost: 300, ohlcv: calm }] }
]);
