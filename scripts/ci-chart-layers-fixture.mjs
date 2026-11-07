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
const regimes = trendRegimes(waveBars);
assert.deepEqual(regimes.segments.map((s) => s.dir), ['up', 'down'], 'v59.74 trend areas: one up run, then one down run');
assert.equal(regimes.current, 'down', 'v59.74 the latest bar is in the down run');
const blip = trendRegimes(waveBars.map((b, i) => (i === 120 ? { ...b, close: 60 } : b)));
assert.equal(blip.segments.filter((s) => s.dir === 'up').length, 1, 'v59.74 a one-bar break does not split the up run (3-bar confirmation)');

// Divergence: price lower low with RSI higher low is bullish.
const divBars = [];
const path = [...Array.from({ length: 40 }, (_, i) => 200 - i * 2), ...Array.from({ length: 12 }, (_, i) => 120 + i * 3), ...Array.from({ length: 14 }, (_, i) => 156 - i * 2.8), ...Array.from({ length: 20 }, (_, i) => 118 + i * 2)];
path.forEach((c, i) => divBars.push({ time: `d${String(i).padStart(3, '0')}`, open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 1 }));
const divs = rsiDivergences(divBars, rsiSeriesWilder(divBars.map((b) => b.close)));
assert.ok(divs.some((d) => d.kind === 'bullish' && d.priceTo < d.priceFrom && d.rsiTo > d.rsiFrom), 'v59.74 bullish divergence found');

// Fibonacci: measured from the later extreme.
const fib = fibonacciLevels(waveBars);
assert.equal(fib.direction, 'down', 'v59.74 the low came after the high: the down move');
close(fib.levels.find((l) => l.ratio === 0.5).price, (fib.high + fib.low) / 2, 1e-9, 'v59.74 50% retracement is the midpoint');
assert.equal(fib.levels.find((l) => l.ratio === 0).price, fib.low, 'v59.74 0% is the low for a down move');
assert.equal(fibonacciLevels(waveBars.slice(0, 150)).levels[0].price, fibonacciLevels(waveBars.slice(0, 150)).high, 'v59.74 0% is the high for an up move');

// Squeeze: a quiet stretch after a volatile one.
const sq = squeezeSpans(bollingerSeries([...Array.from({ length: 200 }, (_, i) => 100 + 8 * Math.sin(i)), ...Array.from({ length: 40 }, (_, i) => 100 + 0.1 * Math.sin(i))]).width);
assert.ok(sq.length >= 1 && sq.at(-1).to >= 230, 'v59.74 the quiet stretch is a squeeze');

// Coverage (owner 2026-11-07, no stock left out): every interval and a short history keep the base tier.
const short = Array.from({ length: 12 }, (_, i) => ({ time: 1_700_000_000 + i * 300, open: 10 + i, high: 11 + i, low: 9 + i, close: 10.5 + i, volume: i === 3 ? null : 100 }));
const shortLayers = buildChartLayers(short);
assert.equal(shortLayers.available, true, 'v59.74 twelve 5-minute bars still draw the base tier');
assert.equal(shortLayers.ma[5].filter((v) => v != null).length, 8, 'v59.74 the moving averages that fit are drawn');
assert.equal(buildChartLayers([{ time: 't', open: 1, high: 1, low: 1, close: 1 }]).available, false, 'v59.74 one bar is not a chart');
const gappy = waveBars.slice(-130).map((b, i) => (i % 20 === 0 ? { ...b, volume: null } : b));
assert.equal(chartVolumeProfile(gappy).available, true, 'v59.74 a few missing volumes (≥90% coverage) still draw the profile');
assert.equal(chartVolumeProfile(gappy).coveredSessions, 130 - 7, 'v59.74 bars without volume are left out of the profile');
assert.equal(chartVolumeProfile(waveBars.slice(-130).map((b, i) => (i % 3 ? b : { ...b, volume: null }))).available, false, 'v59.74 missing volume is not invented (E08)');

// The read is short chips (owner 2026-11-07: no excess text).
const layers = buildChartLayers(waveBars);
const chips = layerFacts(layers, resolveLayers({ rsi: true, macd: true, divergence: true, fib: true, bands: true }), layers.bars, (v) => v.toFixed(2));
assert.ok(chips.length >= 6 && chips.every((c) => c.text.length <= 18 && ['up', 'down', 'neutral'].includes(c.tone)), `v59.74 chips are short: ${chips.map((c) => c.text).join(' | ')}`);
console.log(`chart-layers fixture: ok (${chips.length} chips)`);
