// 기술적 분석 verdicts: the line a close last crossed (attempt, acceptance, failure, support turned resistance, false
// break), the five US indexes against their prior swing highs and lows, the index card's verdict set from the slot's own
// function, the oversold bounce, the follow-through under distribution and the leaders after it, the crash-day event
// table's non-overlapping cases, and the one fact table the life cycle, the checklist and the style lenses read.
// Facts in, fixed state word out.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export default async function run({ load, fail }) {
  const ok = (cond, msg) => { if (!cond) fail(msg); };
  const { boundaryState, crossConfirmation, bounceRead, crashDayEvents, INDEX_READ_RULES } = await load('src/domain/technical/index-read.js');
  const { barsChartReading } = await load('src/domain/technical/market-charts.js');
  const { analyzeChart } = await load('src/domain/technical/chart-analysis.js');
  const { leaderConfirmation } = await load('src/domain/market/regime/rally-attempt.js');
  const { setupFacts, setupLifecycle, breakoutChecklist } = await load('src/domain/technical/setup-coach.js');
  const { strategyLenses } = await load('src/domain/technical/chart-strategies.js');
  const { resolveMarketCalendarSession } = await load('src/domain/market/session/market-calendar.js');

  // 1. The line: a resistance at 100 over a 10-session window.
  const flat = Array(12).fill(98);
  const state = (tail) => boundaryState([...flat, ...tail], 100)?.state ?? null;
  ok(state([101, 102]) === 'attempt', `a close over a resistance with no pullback is a breakout attempt: ${state([101, 102])}`);
  ok(state([101, 103, 102]) === 'accepted', 'a down close that stays over the line accepts the breakout');
  ok(state([101, 103, 99]) === 'failed', 'a close back under the line after crossing it is a failed breakout');
  ok(![[101, 102, 101.5, 104], [101, 100.5, 102]].some((tail) => state(tail) === 'failed'), 'a series that never closed back under the line is never a failed breakout');
  const high = Array(12).fill(103);
  const support = (tail) => boundaryState([...high, ...tail], 100)?.state ?? null;
  ok(support([99, 97, 98]) === 'flipped', 'a rebound that stays under a broken support turns it into resistance');
  ok(support([99, 101]) === 'false-break', 'a close back over a broken support is a false break');
  ok(support([99, 98]) === 'breakdown', 'a support crossed down with no rebound yet is a breakdown');
  ok(state(Array(5).fill(99)) === null, 'no crossing, no state');

  // 2. Cross confirmation on five indexes: only one past its prior swing high is a divergence, not a confirmation.
  const days = [];
  for (let t = Date.parse('2026-01-05T12:00:00Z'); days.length < 120; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') days.push(date);
  }
  // A wave with a swing high at session 90 (value 110) and a swing low at session 100 (value 95); the last close is set.
  const wave = (last) => days.map((_, i) => (i === days.length - 1 ? last : i === 90 ? 110 : i === 100 ? 95 : 100 + (i % 2)));
  const historyOf = (lasts) => days.map((date, i) => Object.fromEntries([['date', date], ...Object.entries(lasts).map(([field, last]) => [field, wave(last)[i]])]));
  const fields = ['spx', 'ndx', 'dow', 'rut', 'rsp'];
  const split = crossConfirmation(historyOf(Object.fromEntries(fields.map((field) => [field, field === 'ndx' ? 112 : 100]))));
  ok(split?.state === 'split' && split.above.length === 1, `one index over its prior swing high is 미확인 괴리: ${split?.state} ${split?.above}`);
  const all = crossConfirmation(historyOf(Object.fromEntries(fields.map((field) => [field, 112]))));
  ok(all?.state === 'up' && all.word === '상승 확인', `all five over their prior swing highs confirm: ${all?.state}`);
  const down = crossConfirmation(historyOf(Object.fromEntries(fields.map((field) => [field, 90]))));
  ok(down?.state === 'down' && down.rows.filter((row) => row.weakest).length === 1, 'all under their prior swing lows confirm a decline, one row marked weakest');

  // 3. The index card reads the slot's function: one extension multiple and one stage for the same bars.
  const bars = Array.from({ length: 320 }, (_, i) => {
    const close = 100 + i * 0.2 + Math.sin(i / 5) * 2;
    return { time: new Date(Date.parse('2025-06-02T12:00:00Z') + i * 86400000).toISOString().slice(0, 10), open: close - 0.3, high: close + 1, low: close - 1, close, volume: 1e6 + (i % 7) * 1e5 };
  });
  const card = barsChartReading({ bars, field: 'spx', label: 'S&P 500', symbol: 'SPY', history: [] });
  const slot = analyzeChart(bars);
  ok(card?.extension === slot.adrFrom50 && card.stage?.stage === slot.weinstein?.stage, `the card and the slot say one extension and one stage: ${card?.extension} / ${slot.adrFrom50}`);
  ok(card.cells.some(([label]) => label === '50일선 대비 변동폭 배수') && card.cells.some(([label]) => label === '위 확인 가격'), 'the card carries the extension cell and the conditional prices');

  // 4. An oversold bounce: a big up day under a falling 10-day line on less volume.
  const falling = Array.from({ length: 20 }, (_, i) => ({ time: `d${i}`, close: 100 - i * 1.5, volume: 2e6 }));
  const bounce = (volume) => bounceRead([...falling, { time: 'd20', close: falling.at(-1).close * 1.03, volume }]);
  ok(bounce(1e6)?.state === 'oversold', `a 3% day under a falling 10-day line on lighter volume is 과매도 반등: ${bounce(1e6)?.state}`);
  ok(bounce(3e6)?.state === 'pending', 'the same day on heavier volume is not an oversold bounce');
  ok(bounceRead([...falling, { time: 'd20', close: falling.at(-1).close * 1.005, volume: 1e6 }]) === null, 'a small up day is no bounce reading');

  // 5. A follow-through under distribution: the Nasdaq card tags it; without heavy distribution it does not.
  const sessions = bars.map((bar) => bar.time);
  const rallyRows = (confirmed) => sessions.map((date, i) => {
    const k = i - (sessions.length - 8);
    if (k < 0) return { date, rallyPhase: 0 };
    return { date, nasdaq: 100 + k, rallyPhase: confirmed && k >= 5 ? 2 : 1, rallyDay: k, followThroughDay: confirmed && k === 5 ? 1 : 0 };
  });
  const heavyBars = bars.map((bar, i) => (i < bars.length - 25 ? bar : { ...bar, close: bars[bars.length - 26].close * (1 - 0.003 * (i - bars.length + 26)) * (i % 2 ? 1.001 : 1), volume: 1e6 * (1 + (i - bars.length + 26) * 0.05) }));
  const tagged = barsChartReading({ bars: heavyBars, field: 'ndx', label: '나스닥100', symbol: 'QQQ', history: rallyRows(true) });
  ok(tagged.volume?.heavy === true && tagged.tags.includes('분배 우세 중 FTD'), `a follow-through with distribution days at the warning line carries 분배 우세 중 FTD: ${tagged.volume?.distribution?.count} ${tagged.tags}`);
  const noFtd = barsChartReading({ bars: heavyBars, field: 'ndx', label: '나스닥100', symbol: 'QQQ', history: rallyRows(false) });
  ok(!noFtd.tags.includes('분배 우세 중 FTD'), 'without a follow-through there is no follow-through tag');

  // 6. Leaders after a follow-through: counted from per-session columns; missing columns are not zero.
  const rally = { phase: 'confirmed', ftdDate: '2026-11-10', since: 3 };
  const rowsWith = (values) => ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((date, i) => ({ date, rallyPhase: 2, ...(values ? { setupBreakouts: values[i], setupBreakoutsFailed: 0 } : {}) }));
  ok(leaderConfirmation({ phase: 'attempt' }, { history: rowsWith([1, 1, 1, 1]) }) === null, 'no follow-through, no leader reading');
  ok(leaderConfirmation(rally, { history: rowsWith(null) })?.state === 'waiting', 'without the per-session columns the state waits, never counts zero');
  ok(leaderConfirmation(rally, { history: rowsWith([0, 0, 0, 0]) })?.state === 'pending', 'no breakout yet inside the window is pending');
  ok(leaderConfirmation({ ...rally, since: 20 }, { history: rowsWith([0, 0, 0, 0]) })?.state === 'weak', 'no breakout once the window has passed is a weak follow-through');
  ok(leaderConfirmation(rally, { history: rowsWith([0, 2, 0, 1]) })?.breakouts === 3, 'breakouts are summed per session since the follow-through');

  // 7. Crash days: cases at least the 60-session window apart; under ten complete cases only the count.
  const closes = [];
  for (let i = 0; i < 300; i += 1) closes.push(100);
  closes.push(88); for (let i = 0; i < 29; i += 1) closes.push(89); closes.push(84); for (let i = 0; i < 70; i += 1) closes.push(85);
  const crash = crashDayEvents(closes.map((value, i) => ({ date: `s${i}`, value })));
  ok(crash.count === 1 && crash.cases[0].date === 's300', `two crash days 30 sessions apart are one non-overlapping case: ${crash.count}`);
  ok(crash.summary === null && crash.cases[0].reBreak === true, 'under ten complete cases the table has no shares; the case records its re-break');
  ok(INDEX_READ_RULES.crash.horizon === 60 && INDEX_READ_RULES.crash.dropPct === 5, 'the event rule is the post\'s -5% day and 60-session window');

  // 8. One fact table: the checklist, the style lens and the life cycle read the same drying and pivot facts.
  const analysis = { ...slot, dryUp: 0.79 };
  const facts = setupFacts(analysis);
  const checklist = breakoutChecklist(analysis, { facts });
  const lens = strategyLenses(analysis, null, { rsi: 50 })[0];
  ok(facts.dryUp.dry === true && checklist.items.find((item) => item.id === 'dryup').met === true && lens.conditions.find(([label]) => /마름/.test(label))[1] === true,
    'drying at 79% is one fact the checklist and the breakout lens both read as met');
  const pivotBars = [...Array(12).fill(98), 101, 103, 102].map((close, i) => ({ close }));
  const accepted = setupLifecycle({ available: true, state: 'none', brokeOut: true, pivot: 100, last: { close: 102 }, bars: pivotBars, breakoutIndex: null, vcp: { contractions: [], valid: true } },
    { ...setupFacts({ available: true, pivot: 100, vcp: { valid: true }, bars: pivotBars, templateChecks: [] }) });
  ok(accepted?.stage === 'follow' && accepted.boundary?.state === 'accepted', `a pullback held over the pivot is the follow-through stage, read off the same line state: ${accepted?.stage}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  await run({ root, load: (rel) => import(pathToFileURL(path.join(root, rel)).href), fail: (msg) => { throw new Error(msg); } });
  console.log('unit-cases technical: PASS');
}
