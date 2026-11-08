// v59.74 (owner 2026-11-07, chart redesign): the chart's base tier and opt-in studies (src/domain/technical/chart-layers.js).
// Formulas are pinned to an independent reference (technicalindicators 3.1.0, MIT — values computed once and copied here;
// the package is not a dependency), and every bar interval and short history keeps the base tier.
import assert from 'node:assert/strict';
import {
  CHART_LAYERS, DEFAULT_LAYERS, resolveLayers, rsiSeriesWilder, macdSeries, bollingerSeries, trendRegimes, rsiDivergences,
  fibonacciLevels, maAlignment, buildChartLayers, layerFacts, chartVolumeProfile, squeezeSpans, BASE_MA
} from '../src/domain/technical/chart-layers.js';
import { rsiWilder, smaSeries, emaSeries } from '../src/domain/technical/definitions.js';

const close = (v, ref, eps, msg) => assert.ok(Math.abs(v - ref) <= eps, `v59.74 reference parity — ${msg}: ${v} vs ${ref}`);

// Reference series: 100 + 10·sin(i/7) + 0.2·i, 120 values.
const closes = Array.from({ length: 120 }, (_, i) => 100 + 10 * Math.sin(i / 7) + i * 0.2);
close(rsiSeriesWilder(closes).at(-1), 23.96, 0.005, 'v59.74 Wilder RSI 14 matches the reference (rounded to 2 dp there)');
assert.equal(rsiSeriesWilder(closes).at(-1), rsiWilder(closes), 'v59.74 the RSI pane and the RSI card (definitions.rsiWilder) are one number');
const m = macdSeries(closes);
close(m.line.at(-1), -1.8905779680999473, 1e-9, 'v59.74 MACD line = EMA12 − EMA26');
close(m.signal.at(-1), -0.4345419503258681, 1e-9, 'v59.74 MACD signal = EMA9 of the line, seeded at its first value');
close(m.hist.at(-1), -1.4560360177740792, 1e-9, 'v59.74 MACD histogram = line − signal');
const bb = bollingerSeries(closes);
close(bb.mid.at(-1), 122.35120620621869, 1e-9, 'v59.74 Bollinger middle = SMA20');
close(bb.upper.at(-1), 133.46151065345813, 1e-9, 'v59.74 Bollinger upper = SMA20 + 2·population SD');
close(bb.lower.at(-1), 111.24090175897925, 1e-9, 'v59.74 Bollinger lower = SMA20 − 2·population SD');
close(emaSeries(closes, 21).at(-1), 119.740376, 1e-6, 'v59.74 EMA 21 (added moving average) matches the reference');
assert.equal(rsiSeriesWilder(Array.from({ length: 30 }, (_, i) => 10 + i)).at(-1), 100, 'v59.74 RSI of a series with no losses is 100');
assert.equal(rsiSeriesWilder(Array.from({ length: 30 }, () => 10)).at(-1), 50, 'v59.74 RSI of a flat series is 50, not 100');
assert.ok(macdSeries(Array.from({ length: 60 }, () => 50)).hist.at(-1) === 0, 'v59.74 MACD of a flat series is 0');

// Layer registry: the base tier starts on, everything else off; the only added moving average is EMA 8·21 (owner 2026-11-07).
assert.deepEqual(CHART_LAYERS.filter((l) => l.tier === 'base').map((l) => l.id), ['ma', 'profile', 'trend'], 'v59.74 base tier');
assert.deepEqual(CHART_LAYERS.filter((l) => l.tier === 'ma').map((l) => l.id), ['ema821'], 'v59.74 one added moving-average set');
for (const id of ['rsi', 'macd', 'divergence', 'fib', 'bands', 'vcp', 'signals', 'rs', 'levels', 'ema821']) assert.equal(DEFAULT_LAYERS[id], false, `v59.74 ${id} is opt-in`);
assert.deepEqual(resolveLayers({ rsi: true, ma: 'yes', bogus: true }), { ...DEFAULT_LAYERS, rsi: true }, 'v59.74 stored preferences: booleans for known layers only');
assert.deepEqual([...BASE_MA], [5, 10, 20, 50, 100, 200], 'v59.74 base moving averages 5·10·20·50·100·200');

// Alignment: short 5 > 10 > 20, mid/long 20 > 50 > 200.
const rising = Array.from({ length: 260 }, (_, i) => 50 + i);
const up = maAlignment(Object.fromEntries(BASE_MA.map((p) => [p, smaSeries(rising, p)])), rising.at(-1));
assert.equal(up.short, 'up', 'v59.74 rising: 5 > 10 > 20'); assert.equal(up.long, 'up', 'v59.74 rising: 20 > 50 > 200'); assert.equal(up.full, 'up', 'v59.74 rising: 20 > 50 > 100 > 200');
assert.match(up.text, /단기 5·10·20 정배열.*중장기 20·50·200 정배열\(100선 포함\)/, 'v59.74 alignment sentence');
const falling = rising.slice().reverse();
const down = maAlignment(Object.fromEntries(BASE_MA.map((p) => [p, smaSeries(falling, p)])), falling.at(-1));
assert.equal(down.shortLabel, '역배열', 'v59.74 falling: short 역배열'); assert.equal(down.longLabel, '역배열', 'v59.74 falling: long 역배열');
assert.equal(maAlignment(Object.fromEntries(BASE_MA.map((p) => [p, smaSeries(rising.slice(0, 100), p)])), 149).long, null, 'v59.74 fewer than 200 bars leaves the long order uncomputed');

// Trend areas: a confirmed run needs 3 bars; a rise then a fall paints an up segment followed by a down segment.
const wave = [...Array.from({ length: 150 }, (_, i) => 100 + i), ...Array.from({ length: 150 }, (_, i) => 249 - i * 1.2)];
const waveBars = wave.map((c, i) => ({ time: `2025-${String(1 + Math.floor(i / 28) % 12).padStart(2, '0')}-${String(1 + i % 28).padStart(2, '0')}`, open: c, high: c + 1, low: c - 1, close: c, volume: 1000 }));
// v59.85: the areas follow the canonical trend (bands.js classifyTrend through trend-state.js), which needs the 200-bar line.
const longWave = [...Array.from({ length: 320 }, (_, i) => 100 + i * 0.5), ...Array.from({ length: 260 }, (_, i) => 260 - i * 0.6)];
const longBars = longWave.map((c, i) => ({ time: `t${String(i).padStart(4, '0')}`, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1000 }));
const regimes = trendRegimes(longBars);
assert.deepEqual(regimes.segments.map((s) => s.dir), ['up', 'down'], `v59.85 trend areas: one up run, then one down run: ${JSON.stringify(regimes.segments)}`);
assert.equal(regimes.current, 'down', 'v59.85 the latest bar is in the down run');
assert.equal(regimes.trend.label, '하락 추세', 'v59.85 the chip word is the screener word for the same numbers');
const blip = trendRegimes(longBars.map((b, i) => (i === 280 ? { ...b, close: b.close * 0.8, low: b.close * 0.8 } : b)));
assert.equal(blip.segments.filter((s) => s.dir === 'up').length, 1, 'v59.85 a one-bar break does not split the up run (3-bar confirmation)');
assert.equal(trendRegimes(longBars.slice(0, 150)).trend, null, 'v59.85 under 200 bars the trend is held (no word), as the screener holds a row without pctSma200');
{
  const { bufferedTrend } = await import('../src/domain/technical/bands.js');
  const { trendOfBars } = await import('../src/domain/technical/trend-state.js');
  // The same numbers through the screener row and through the bars give one state.
  const bars = longBars.slice(0, 400), closes = bars.map((b) => b.close);
  const sma = (n) => closes.slice(-n).reduce((a, b) => a + b, 0) / n;
  const row = { pctSma50: (closes.at(-1) / sma(50) - 1) * 100, pctSma200: (closes.at(-1) / sma(200) - 1) * 100, adrPct: bars.slice(-20).reduce((a, b) => a + (b.high - b.low) / b.close * 100, 0) / 20, ret5d: (closes.at(-1) / closes.at(-6) - 1) * 100 };
  assert.equal(trendOfBars(bars).label, bufferedTrend(row).label, 'v59.85 chart bars and the screener row read one trend word');
  const cross = await import('../src/domain/technical/bands.js');
  assert.equal(cross.classifyTrend({ s50: -6, s200: -2, positionOnly: true }).label, '추세 이탈', 'v59.85 below both lines with the 50-day still over the 200-day is 추세 이탈 (phase of down)');
  assert.equal(cross.classifyTrend({ s50: -6, s200: -2, positionOnly: true }).id, 'down', 'v59.85 the phase keeps the id, so id readers are unchanged');
  assert.equal(cross.classifyTrend({ s50: 6, s200: 2, positionOnly: true }).label, '회복 시도', 'v59.85 above both with the 50-day still under the 200-day is 회복 시도');
}

// v59.85 a weekly or intraday series names its own unit: 50·200-week lines are 주선, intraday lines 봉선 — never 일선.
{
  const { trendOfBars, barUnit } = await import('../src/domain/technical/trend-state.js');
  const weekly = Array.from({ length: 300 }, (_, i) => ({ time: new Date(Date.UTC(2020, 0, 6 + 7 * i)).toISOString().slice(0, 10), open: 100 + i, high: 103 + i, low: 98 + i, close: 100 + i }));
  assert.equal(barUnit(weekly), 'week', 'v59.85 weekly dates read as a weekly series');
  const w = trendOfBars(weekly);
  assert.ok(/50주선/.test(w.text) && !/일선|거래일|일평균/.test(`${w.label} ${w.text}`), `v59.85 weekly trend speaks in 주선: ${w.text}`);
  const nearW = trendOfBars(weekly.map((b, i) => (i === 299 ? { ...b, close: b.close * 0.94 } : b)));
  assert.ok(!/일선|거래일|일평균/.test(`${nearW.label} ${nearW.text}`), `v59.85 every weekly state avoids day words: ${nearW.label} ${nearW.text}`);
  const hourly = longBars.map((b, i) => ({ ...b, time: 1_700_000_000 + i * 3600 }));
  const h = trendOfBars(hourly);
  assert.ok(/봉선/.test(h.text) && !/일선|거래일|일평균/.test(`${h.label} ${h.text}`), `v59.85 intraday trend speaks in 봉선: ${h.text}`);
  const { bufferedTrend } = await import('../src/domain/technical/bands.js');
  assert.match(bufferedTrend({ pctSma50: 5, pctSma200: 9, adrPct: 2, ret5d: 1 }).text, /50일선/, 'v59.85 the screener row keeps its daily words');
}

// v59.85 relative volume: daily = last ÷ the previous 50 bars' average; intraday = last ÷ the same clock slot's average
// over the previous 10 sessions, so an opening bar is not compared with lunchtime bars.
{
  const { relativeVolume, volumeAverageSeries } = await import('../src/domain/technical/chart-layers.js');
  const daily = Array.from({ length: 60 }, (_, i) => ({ time: `d${i}`, open: 10, high: 11, low: 9, close: 10, volume: i === 59 ? 3000 : 1000 }));
  assert.equal(relativeVolume(daily).ratio, 3, 'v59.85 daily RVOL = last ÷ prior-50 average (the last bar excluded)');
  const day0 = Date.UTC(2026, 9, 1, 13, 30) / 1000;
  const intraday = [];
  for (let d = 0; d < 12; d++) for (let k = 0; k < 7; k++) intraday.push({ time: day0 + d * 86400 + k * 3600, open: 10, high: 11, low: 9, close: 10, volume: k === 0 ? 5000 : 500 });
  intraday.push({ time: day0 + 12 * 86400, open: 10, high: 11, low: 9, close: 10, volume: 5000 });
  const r = relativeVolume(intraday);
  assert.equal(r.basis, 'time-of-day', 'v59.85 intraday RVOL compares the same clock slot');
  assert.equal(r.ratio, 1, 'v59.85 a heavy opening bar against heavy opening bars is 1×, not 10×');
  const fiveMin = [];
  for (let d = 0; d < 4; d++) for (let k = 0; k < 78; k++) fiveMin.push({ time: day0 + d * 86400 + k * 300, open: 10, high: 11, low: 9, close: 10, volume: 1000 });
  fiveMin.push({ time: day0 + 4 * 86400, open: 10, high: 11, low: 9, close: 10, volume: 2000 });
  assert.equal(relativeVolume(fiveMin)?.ratio, 2, 'v59.85 the 5-minute chart (five sessions, four before today) still has an RVOL');
  assert.equal(relativeVolume(daily.map((b, i) => (i === 59 ? { ...b, volume: null } : b))), null, 'v59.85 no RVOL without the last bar\'s volume');
  assert.equal(volumeAverageSeries(daily).values.at(-2), 1000, 'v59.85 the volume average line is the 50-bar mean');
}

// The read is short chips (owner 2026-11-07: no excess text).
const layers = buildChartLayers(waveBars);
const chips = layerFacts(layers, resolveLayers({ rsi: true, macd: true, divergence: true, fib: true, bands: true }), layers.bars, (v) => v.toFixed(2));
assert.ok(chips.length >= 6 && chips.every((c) => c.text.length <= 18 && ['up', 'down', 'neutral'].includes(c.tone)), `v59.74 chips are short: ${chips.map((c) => c.text).join(' | ')}`);
console.log(`chart-layers fixture: ok (${chips.length} chips)`);
