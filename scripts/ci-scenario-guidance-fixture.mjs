import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMarketRegime, movingAverageStructure } from '../src/domain/briefing/market-read.js';
import { buildMarketScenarios } from '../src/domain/market/regime-scenarios.js';
import { buildScenarioOutlook, renderScenarioOutlookContext } from '../src/domain/market/scenario-outlook.js';
import { CHART_INTERVALS, intervalBars, intervalSpec, intervalStructure } from '../src/ui/components/stock-chart.js';
import { buildMarketAnalysisRegimeContext } from './fetch-data.mjs';
import { liveCurrentObservations } from '../src/ui/knowledge/current-observations.js';

// P1633: short (close>5>10>20) and long (20>50>100>200) moving-average order.
assert.equal(movingAverageStructure({ value: 110, ma5: 108, ma10: 106, ma20: 104, ma50: 100, ma100: 96, ma200: 90 }).shortLabel, '정배열');
assert.equal(movingAverageStructure({ value: 80, ma5: 84, ma10: 88, ma20: 92, ma50: 96, ma100: 100, ma200: 104 }).longLabel, '역배열');

const history = JSON.parse(readFileSync(new URL('../public-data/history.json', import.meta.url), 'utf8'));
const rows = Array.isArray(history) ? history : history.rows || [];
const input = { history: rows, credit: { hyBp: 315, hyDelta5Bp: -9 }, rates: {} };
const regime = buildMarketRegime(input);
assert.ok(regime.available, 'P1633: regime builds from the published history');
const breadth = regime.axes.find((axis) => axis.id === 'breadth');
assert.ok(breadth.evidence.some(([label]) => /20일선 위 종목/.test(label)), 'P1633: breadth shows the 20-day participation next to 50/200');
const trend = regime.axes.find((axis) => axis.id === 'trend');
assert.ok(trend.evidence.some(([label]) => /단기 추세/.test(label)) && trend.evidence.some(([label]) => /장기 추세/.test(label)), 'P1633: trend shows short and long order');

// P1633: each path carries a likelihood from met conditions, posture, opportunity, check/caution/ignore.
const scenarios = buildMarketScenarios(input, { regime });
const outlook = buildScenarioOutlook({ scenarios, regime, sectors: [{ symbol: 'XLK', label: '기술', quadrant: 'Leading' }, { symbol: 'XLV', label: '헬스케어', quadrant: 'Improving' }], themes: [{ name: '광통신', ret3m: 40 }] });
assert.ok(outlook.available && outlook.items.length === 3);
for (const item of outlook.items) {
  assert.ok(['높음', '중간', '낮음', '판단 보류'].includes(item.likelihood), 'likelihood is a count-based label');
  assert.ok(item.posture && item.opportunity && item.check.length && item.caution.length && item.ignore.length, `P1633: ${item.id} has posture, opportunity, check, caution, ignore`);
  assert.doesNotMatch(`${item.posture} ${item.opportunity}`, /\d+(?:\.\d+)?\s*%\s*(?:확률|가능성)|매수하세요|매도하세요|목표가/, 'no probability percentages or trade instructions');
}
assert.match(renderScenarioOutlookContext(outlook), /매매 지시/, 'AI context restates the no-instruction boundary');

// P1634: eight intervals; 4-hour bars combine at most four 1-hour bars of one exchange day.
assert.deepEqual(CHART_INTERVALS.map((spec) => spec.id), ['5m', '15m', '30m', '1h', '4h', '1d', '1wk', '1mo']);
assert.ok(CHART_INTERVALS.every((spec) => spec.interval !== '60m'), 'P1634: the relay rejects 60m; 1h is used');
const start = Date.UTC(2026, 9, 5, 13, 30) / 1000;
const payload = { timestamps: [], opens: [], highs: [], lows: [], closes: [], volumes: [], meta: { exchangeTimezoneName: 'America/New_York' } };
for (let day = 0; day < 2; day += 1) for (let hour = 0; hour < 7; hour += 1) {
  payload.timestamps.push(start + day * 86400 + hour * 3600); payload.opens.push(10 + hour); payload.highs.push(11 + hour); payload.lows.push(9 + hour); payload.closes.push(10.5 + hour); payload.volumes.push(100);
}
const four = intervalBars(payload, intervalSpec('4h'));
assert.equal(four.length, 4, 'P1634: 7 hourly bars a day -> 2 four-hour bars a day');
assert.deepEqual([four[0].open, four[0].high, four[0].low, four[0].close, four[0].volume], [10, 14, 9, 13.5, 400]);
const hourly = intervalBars(payload, intervalSpec('1h'));
assert.equal(new Date(hourly[0].time * 1000).toISOString().slice(11, 16), '09:30', 'P1634: intraday time is exchange-local wall time');
assert.equal(intervalStructure(hourly).long, null, 'P1634: too few bars leaves the long order uncomputed');

// P1635: the server narrative receives the same regime and scenario reading as the screen.
const data = { macro: { hyOAS: 3.15, hyOASDelta5: -0.09 }, fearGreed: { score: 45 } };
const context = buildMarketAnalysisRegimeContext(data, rows);
assert.match(context, /종합:/, 'P1635: regime summary present');
assert.match(context, /개연성/, 'P1635: scenario likelihood present');

// P1636: research-page observations that the site refreshes are replaced by the latest values.
const artifact = { observations: [
  { id: 'market-spx-20260814', label: 'S&P 500 종가', value: 1, displayValue: '1', unit: 'index', observedAt: '2026-08-14', sourceId: 'x', sourceKind: 'PUBLIC_INFORMATION_SERVICE', allowedUse: 'reference-only', pageTargets: ['principles'] },
  { id: 'sndk-target', label: 'target', value: 50, displayValue: '50%', unit: 'percent', observedAt: '2026-08-13', sourceId: 'y', sourceKind: 'COMPANY_IR_FORWARD_LOOKING', allowedUse: 'reference-only', pageTargets: ['principles'] }
] };
const live = liveCurrentObservations(artifact, { _aioHistory: [{ date: '2026-10-09', spx: 7811.54 }], DATA_SNAPSHOT: {} });
assert.equal(live.observations[0].value, 7811.54, 'P1636: market rows follow the latest close');
assert.equal(live.observations[0].live, true);
assert.equal(live.observations[1].value, 50, 'P1636: dated company targets stay dated references');

console.log('scenario guidance fixture: PASS');

// P1637: regime radar — one-year positions, today vs 5/20 sessions, no composite.
const { buildRegimeRadar } = await import('../src/domain/market/regime-radar.js');
const macroHistory = JSON.parse(readFileSync(new URL('../public-data/macro-history.json', import.meta.url), 'utf8'));
const radar = buildRegimeRadar({ history: rows }, { macroHistory });
assert.ok(radar.available && radar.axes.length === 6, 'P1637: six radar axes');
assert.ok(radar.axes.every((axis) => axis.now == null || (axis.now >= 0 && axis.now <= 100)), 'P1637: positions are 0-100');
assert.equal(radar.dates.length, 3, 'P1637: today, 5 and 20 sessions ago');
assert.ok(!('composite' in radar) && !('score' in radar), 'P1637: no composite score');

// P1638: CCC minus B gap from rating-tier OAS.
const { buildRegimeAxisHistory } = await import('../src/domain/market/regime-scenarios.js');
const tierMacro = { series: { cccOas: { observations: rows.slice(-130).map((row) => [row.date, 12]) }, bOas: { observations: rows.slice(-130).map((row) => [row.date, 3]) } } };
const tiers = buildRegimeAxisHistory({ history: rows, credit: {}, rates: {} }, { macroHistory: tierMacro });
const gap = tiers.axes.credit.find((item) => item.id === 'ccc-b');
assert.ok(gap && gap.series.every((point) => point.value === 900), 'P1638: CCC-B gap in bp');
assert.match(readFileSync(new URL('./fetch-data.mjs', import.meta.url), 'utf8'), /cccOas:\s+\{ id: 'BAMLH0A3HYC'/, 'P1638: producer requests the CCC series');

// P1639: chart evidence adds ATR extension, distance from the 52-week low and the 5/20 EMA order.
const { analyzeChart } = await import('../src/domain/technical/chart-analysis.js');
let level = 100; const daily = [];
for (let i = 0; i < 300; i += 1) { const open = level; level *= 1 + Math.sin(i / 9) * 0.01 + 0.002; daily.push({ time: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10), open, high: Math.max(open, level) * 1.01, low: Math.min(open, level) * 0.99, close: level, volume: 1e6 }); }
const labels = analyzeChart(daily).evidence.map(([label]) => label);
for (const label of ['50일선 대비 ATR 배수', '5일·20일 EMA']) assert.ok(labels.includes(label), `P1639: ${label}`);
assert.ok(labels.some((label) => /저점 대비/.test(label)), 'P1639: distance from the low');

// P1641: sector moves come only from current produced rotation rows.
const { sectorMoves } = await import('../src/ui/components/sector-moves.js');
const rotation = { latestCompletedSession: '2026-10-09', items: { XLK: { status: 'CURRENT', symbol: 'XLK', sessionDate: '2026-10-09', dailyPct: 0.5, quadrant: 'Leading' }, XLU: { status: 'CURRENT', symbol: 'XLU', sessionDate: '2026-10-09', dailyPct: -1.2, quadrant: 'Lagging' } } };
// M13 (Codex review): the old fixture's rows failed the strict selector and an empty result passed. Use a
// schema-valid artifact and assert the exact rows, then a stale row that must be left out.
const { latestCompletedUsSession } = await import('../src/domain/market/market-calendar.js');
const fixtureNow = Date.parse('2026-10-10T12:00:00Z');
const session = latestCompletedUsSession(fixtureNow - 5 * 60000);
const rrgRow = (symbol, dailyPct, rsRatio, rsMomentum, quadrant, sessionDate = session.date) => ({ status: 'CURRENT', symbol, sessionDate, dailyPct, weeklyPct: dailyPct * 2, rsRatio, rsMomentum, quadrant, alignedSessionCount: 60, observedAt: new Date(session.closeMs).toISOString(), fetchedAt: '2026-10-10T01:00:00Z' });
const validRotation = { schemaVersion: 'rotation-history.v1', modelVersion: 'rrg.v2', benchmark: 'SPY', timeframe: '1d', priceBasis: 'adjusted-close', decisionUse: false, allowedUseCeiling: 'reference', latestCompletedSession: session.date,
  items: { XLK: rrgRow('XLK', 0.5, 101, 101, 'Leading'), XLU: rrgRow('XLU', -1.2, 99, 99, 'Lagging'), XLE: rrgRow('XLE', 1.4, 99, 101, 'Improving'), XLF: { ...rrgRow('XLF', 3, 101, 99, 'Weakening'), status: 'STALE' } } };
const moves = sectorMoves(validRotation, fixtureNow);
assert.deepEqual(moves.rows.map((row) => row.symbol), ['XLE', 'XLK', 'XLU'], 'P1641/M13: exact current rows, strongest first; the stale XLF row is left out');
assert.equal(moves.session, session.date);
assert.equal(sectorMoves(rotation, fixtureNow).rows.length, 0, 'M13: a non-schema artifact yields no rows');

console.log('scenario guidance fixture (radar, credit tiers, chart evidence, sectors): PASS');

// P1643: the basis card dates every explained number; a date-only basis reads as that session's close.
const { basisAge } = await import('../src/ui/components/value-basis.js');
const age = basisAge('2026-10-09', Date.parse('2026-10-12T06:00:00Z'));
assert.equal(age.label, '2026-10-09 기준');
assert.equal(age.age, '최신 거래일', 'U03: a date-only basis is aged in sessions against the latest completed one');
assert.equal(basisAge('2026-10-05', Date.parse('2026-10-12T06:00:00Z')).stale, true, 'U02: more than two sessions behind reads as 갱신 지연');
assert.equal(basisAge('2026-10-12T03:00:00Z', Date.parse('2026-10-12T06:30:00Z')).age, '3시간 전');
assert.match(basisAge('2026-10-12T03:00:00Z', Date.parse('2026-10-12T06:30:00Z')).label, /KST/, 'U03: timestamps carry their zone');
assert.equal(basisAge('', 0), null);
const bootstrapSource = readFileSync(new URL('../src/app/bootstrap.js', import.meta.url), 'utf8');
assert.match(bootstrapSource, /installValueBasis\(documentRef/, 'P1643: the basis card is installed at boot');
console.log('scenario guidance fixture (basis card): PASS');
