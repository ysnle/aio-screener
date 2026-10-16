// P1626: observed conditional levels, daily-volume conservation and no invented coverage.
import assert from 'node:assert/strict';
import { buildVolumeByPrice, buildChartScenarios } from '../src/domain/technical/chart-scenarios.js';
import { analyzeChart, chartReading } from '../src/domain/technical/chart-analysis.js';
import { buildQuestionDomainContext } from '../src/ai/context/market-content.js';
const bars = Array.from({ length: 130 }, (_, index) => ({ time: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10), open: 100 + index / 10, low: 99 + index / 10, high: 102 + index / 10, close: 101 + index / 10, volume: 1000 + index }));
const profile = buildVolumeByPrice(bars);
assert.equal(profile.available, true, 'P1626 observed daily volume has a declared approximate distribution');
assert.ok(Math.abs(profile.bins.reduce((sum, bin) => sum + bin.volume, 0) - profile.totalVolume) < 1e-7, 'P1626 price bins conserve daily total volume');
assert.equal(buildVolumeByPrice(bars.map((bar, index) => index === 50 ? { ...bar, volume: null } : bar)).available, false, 'P1626 missing volume cannot become an invented profile');
assert.equal(buildVolumeByPrice(bars.slice(0, 10)).available, false, 'P1626 short coverage holds the volume profile');
const analysis = analyzeChart(bars, { benchmarkLabel: 'KOSPI' });
const scenarios = buildChartScenarios(analysis);
assert.equal(scenarios.scenarios.length, 3, 'P1626 exposes recovery, range and weakness conditions');
assert.ok(scenarios.support < analysis.last.close && scenarios.resistance >= analysis.last.close, 'P1626 directional levels come from actual price extremes');
assert.equal(scenarios.asOf, bars.at(-1).time, 'P1626 conditional scenarios preserve completed bar basis');
assert.equal(buildChartScenarios({ available: false }).available, false, 'P1626 absent bars do not generate scenarios');
assert.equal(analyzeChart(bars.slice(0, 60)).ret6, null, 'P1626 fewer than 127 bars is not a six-month return');
const read = chartReading({ ...analysis, state: 'failed', rs: 2 });
assert.ok(read.why.includes('KOSPI') && !read.headline.includes('매물이 남아'), 'P1626 own-market benchmark and observable failed-breakout description');
const root = { __aioStockChartAnalysis: { symbol: 'AEHR', analysis } };
assert.match(buildQuestionDomainContext({ ctxId: 'home', query: 'AEHR 차트 시나리오', root }), /AEHR 완료 일봉/, 'P1626 matching issuer uses the same chart evidence in AI context');
assert.doesNotMatch(buildQuestionDomainContext({ ctxId: 'technical', query: 'PLTR 차트 시나리오', root }), /AEHR 완료 일봉/, 'P1626 another issuer never inherits the cached chart evidence');
assert.doesNotMatch(buildQuestionDomainContext({ ctxId: 'technical', query: '005930 차트 분석', root }), /AEHR 완료 일봉/, 'P1626 bare Korean issuer code cannot inherit US analysis');
assert.match(buildQuestionDomainContext({ ctxId: 'technical', query: 'RSI와 매물대 설명', root }), /AEHR 완료 일봉/, 'P1626 indicator names are not issuer identifiers');

// v57.84 (technical definitions): the chart, the screener producer, the summary and the themes screen read one definition.
{
  const defs = await import('../src/domain/technical/definitions.js');
  const { closesToFactors, _calcSetupScreenFields, _calcVCPServer } = await import('../src/domain/screener/price-factors.js');
  const { extensionStateFor: profileState, EXTENSION_BANDS } = await import('../src/domain/screener/setup-profile.js');
  const { adrMultiple } = await import('../src/domain/technical/bands.js');
  const { RULES } = await import('../src/domain/rules/thresholds.js');
  let level = 50;
  const year = Array.from({ length: 300 }, (_, i) => { const open = level * (1 + (i % 7 === 0 ? 0.03 : 0)); level = open * (1 + Math.sin(i / 11) * 0.012 + 0.0025); return { time: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), open, high: Math.max(open, level) * 1.012, low: Math.min(open, level) * 0.988, close: level, volume: 1e6 + (i % 5) * 1e5 }; });
  const col = (rows, key) => rows.map((bar) => bar[key]);
  const chart = analyzeChart(year);
  const factors = closesToFactors(col(year, 'close'));
  const setup = _calcSetupScreenFields(col(year, 'close'), col(year, 'close'), col(year, 'high'), col(year, 'low'), col(year, 'volume'));
  assert.ok(Math.abs(chart.adrPct - setup.adrPct) < 0.01, 'v57.84 chart ADR = producer adrPct (one definition)');
  assert.equal(chart.adrFrom50, defs.extensionMultiple(factors.pctSma50, setup.adrPct), 'v57.84 chart 50-day multiple = screener/summary multiple on the same bars');
  assert.equal(adrMultiple(factors.pctSma50, setup.adrPct), chart.adrFrom50, 'v57.84 bands.adrMultiple is the definitions multiple');
  assert.equal(EXTENSION_BANDS, RULES.technical.extension, 'v57.84 extension bands are the RULES constant');
  for (const m of [-3, 0, 1.9, 2, 3.9, 4, 6.9, 7, 12, null]) assert.equal(profileState(m), defs.extensionStateFor(m), `v57.84 one extension state for ${m}`);
  // Wilder ATR (legacy _calcATR) — not a 14-session simple mean.
  const tr = defs.trueRanges(year).slice(1);
  let wilder = tr.slice(0, 14).reduce((a, b) => a + b, 0) / 14; for (let k = 14; k < tr.length; k++) wilder = (wilder * 13 + tr[k]) / 14;
  assert.ok(Math.abs(chart.atr14 - wilder) < 1e-9, 'v57.84 chart ATR is Wilder ATR(14)');
  // A record shorter than 252 sessions is never a 52-week range, on the chart or in the producer.
  const short = year.slice(-220);
  const shortSetup = _calcSetupScreenFields(col(short, 'close'), col(short, 'close'), col(short, 'high'), col(short, 'low'), col(short, 'volume'));
  assert.equal(shortSetup.pctFrom52wHigh, null, 'v57.84 producer: 220 sessions publish no 52-week high distance');
  assert.equal(shortSetup.pctFrom52wLow, null, 'v57.84 producer: 220 sessions publish no 52-week low distance');
  assert.equal(closesToFactors(col(year.slice(-251), 'close')).pctFromCloseHigh52w, null, 'v57.84 producer: 251 closes are not a 52-week closing high');
  assert.equal(analyzeChart(short).rangeLabel, '최근 220거래일', 'v57.84 chart names the shorter record');
  assert.equal(_calcVCPServer(col(short, 'close'), col(short, 'high'), col(short, 'low'), col(short, 'volume')).vcpStage, 'not_stage2', 'v57.84 the stage-2 gate cannot pass on an unknown 52-week high');
  assert.ok(setup.pctFrom52wHigh != null && Math.abs(setup.pctFrom52wHigh - Math.round(chart.fromHigh * 10) / 10) <= 0.1, 'v57.84 producer and chart 52-week high distance agree');
  // A missing low is unknown, not a full-height bar.
  assert.equal(defs.adrPctOf([10, 10], [null, 9], [10, 10], 20), 10, 'v57.84 a missing low is skipped in ADR');
  // Weinstein stage: one function, the chart's reading.
  const weekly = defs.weeklyCloses(year).map((row) => row.close);
  assert.equal(chart.weinstein.stage, defs.weinsteinStage(weekly).stage, 'v57.84 chart Weinstein = definitions.weinsteinStage');
  assert.equal(defs.weinsteinStage(Array.from({ length: 40 }, (_, i) => 100 + i)).stage, 2, 'v57.84 rising 30-week line with price above = stage 2');
  assert.equal(defs.weinsteinStage(Array.from({ length: 40 }, (_, i) => 200 - i * 2)).stage, 4, 'v57.84 falling 30-week line with price below = stage 4');
  assert.ok(chart.evidence.some(([label, text]) => label === '50일선 대비 일평균 변동폭 배수' && text.includes(`ADR${RULES.technical.adrPeriod}`)), 'v57.84 the chart row names its unit');
}
{
  // RRG: the reader's banded zone uses the producer's quadrant boundaries; one set of words and readings.
  const { classifyRRG, RRG_QUADRANT_WORDS, RRG_QUADRANT_READS } = await import('../src/domain/themes/rrg.js');
  const { rrgZone, rrgRecentReading } = await import('../src/domain/themes/recent-check.js');
  for (const r of [95, 99.5, 100, 100.5, 105]) for (const m of [95, 99.5, 100, 100.5, 105]) assert.equal(rrgZone(r, m).quadrant, classifyRRG(r, m).quadrant, `v57.84 zone quadrant = classifyRRG (${r},${m})`);
  const series = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 0.3);
  assert.equal(rrgRecentReading({ rsRatio: 104, rsMomentum: 103 }, null).opposed, null, 'v57.84 a missing relative-strength series fails closed');
  assert.equal(rrgRecentReading({ rsRatio: 104, rsMomentum: 103 }, series).opposed, false, 'v57.84 a quiet week does not oppose the quadrant');
  const fell = [...series.slice(0, 55), 99, 97, 95, 93, 90];
  assert.equal(rrgRecentReading({ rsRatio: 104, rsMomentum: 103 }, fell).opposed, true, 'v57.84 a five-session break beyond twice the usual move opposes 선도');
  // v57.84 (owner decision 3-3): own-noise band and hysteresis from the produced trail.
  const { rrgNoiseBands, rrgSettledQuadrant, RRG_BAND_MIN, RRG_BAND_MAX } = await import('../src/domain/themes/recent-check.js');
  const trailOf = (pairs) => pairs.map(([r, m], i) => ({ sessionDate: `2026-09-${String(10 + i).padStart(2, '0')}`, rsRatio: r, rsMomentum: m }));
  const held = trailOf([...Array.from({ length: 14 }, (_, i) => [104 + (i % 2) * 0.4, 103 + (i % 3) * 0.5]), [101, 102], [100.2, 101.4], [99.6, 101.2], [99.8, 101.5], [99.7, 101.3], [99.6, 101.4]]);
  const bands = rrgNoiseBands(held);
  assert.ok(bands.ratio >= RRG_BAND_MIN && bands.ratio <= RRG_BAND_MAX && bands.momentum >= RRG_BAND_MIN && bands.momentum <= RRG_BAND_MAX, 'v57.84 the band is the trail own 5-session move, clamped');
  assert.equal(rrgZone(99.6, 101.4).quadrant, 'Improving', 'v57.84 without a trail the raw point decides (fixed band)');
  const settledHeld = rrgZone(99.6, 101.4, { trail: held });
  assert.equal(settledHeld.raw, 'Improving', 'v57.84 the raw quadrant is kept beside the settled one');
  assert.ok(settledHeld.hysteresis && (settledHeld.border || settledHeld.quadrant === 'Leading'), `v57.84 a dip just under 100 after a long Leading run does not flip to Improving (${JSON.stringify(settledHeld)})`);
  const crossed = trailOf([...Array.from({ length: 14 }, (_, i) => [104 + (i % 2) * 0.4, 103 + (i % 3) * 0.5]), [101, 102], [99, 101], [97, 100.8], [96, 101], [95.5, 101.2], [95, 101.1]]);
  assert.equal(rrgSettledQuadrant({ rsRatio: 95, rsMomentum: 101.1, trail: crossed }), 'Improving', 'v57.84 a move well past the band does change the quadrant');
  assert.equal(rrgSettledQuadrant({ rsRatio: 104, rsMomentum: 103 }), 'Leading', 'v57.84 rows without a trail keep the fixed-band reading');
  const { buildStockRead } = await import('../src/domain/entity/stock-read.js');
  const stock = buildStockRead({ symbol: 'AAPL', row: { symbol: 'AAPL', sector: 'Technology', pctSma50: 3, pctSma200: 8, adrPct: 2, ret5d: 1 }, rotation: { XLK: { quadrant: 'Lagging', rsRatio: 96, rsMomentum: 97, relativeStrength: series } } });
  const sector = stock.points.find((point) => point.id === 'sector');
  assert.ok(!sector || !/선도|개선|약화/.test(sector.text.replace(RRG_QUADRANT_WORDS.Lagging, '')), 'v57.84 stock summary quadrant word from RRG_QUADRANT_WORDS');
  assert.ok(Object.keys(RRG_QUADRANT_READS).every((key) => RRG_QUADRANT_WORDS[key]), 'v57.84 one reading per quadrant word');
}
console.log('PASS P1626: conditional chart readings, declared daily volume distribution and period/market integrity (offline).');
