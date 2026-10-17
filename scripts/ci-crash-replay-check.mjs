// v57.83 (owner 2026-10-16): replay past crash windows through the judgement modules and check that every day's reading
// makes sense at that time — the check that would have caught "S&P 500 0.15% above the 50-day line reads 양호" before a
// new rule shipped. Windows: the 2022 bear market, the August 2024 carry unwind, the April 2025 tariff shock, and the real
// 2026 windows (February-March, July, and the week of 10/12-15) from public-data/history.json + macro-history.json.
//
// The repository keeps no daily S&P 500 / VIX / HY record before 2025-08, and producers never run locally, so the three
// historical windows are anchor replays: published closes on the dates below (S&P 500, VIX; HY OAS rounded to 10bp —
// approximate, used only where the reading is far past a line) joined by a seeded random path that hits every anchor
// exactly. The assertions therefore test the rules against the shape of each crash, not tick-for-tick history.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMarketRegime } from '../src/domain/briefing/market-read.js';
import { computeTradingScoreModel } from '../src/domain/signal/trading-score.js';
import { buildMarketTemperature } from '../src/domain/sentiment/market-temperature.js';
import { openSessionDatesBetween } from '../src/domain/market/market-calendar.js';
import { RULES } from '../src/domain/rules/thresholds.js';

// [date, S&P 500 close, VIX close, HY OAS bp]
const WINDOWS = [
  {
    id: '2022-bear', label: '2022년 하락장',
    anchors: [
      ['2021-11-01', 4613.67, 16.41, 290], ['2022-01-03', 4796.56, 16.60, 310], ['2022-03-08', 4170.70, 35.13, 400],
      ['2022-03-29', 4631.60, 18.90, 340], ['2022-06-16', 3666.77, 32.95, 530], ['2022-07-05', 3831.39, 27.54, 580],
      ['2022-08-16', 4305.20, 19.69, 420], ['2022-10-12', 3577.03, 33.57, 520], ['2022-12-30', 3839.50, 21.67, 480]
    ],
    checks: [
      { date: '2022-01-03', expect: { trend: 'favorable' }, why: '고점 직전은 상승 추세 — 검사가 늘 부정만 하는지 확인' },
      { date: '2022-06-16', expect: { trend: 'burden', volatility: 'burden', credit: 'burden' }, scoreBelow: 40 },
      { date: '2022-08-16', notExpect: { trend: 'favorable' }, why: '200일선 아래 반등은 양호가 아님' },
      { date: '2022-10-12', expect: { trend: 'burden', volatility: 'burden', credit: 'burden' }, scoreBelow: 40, temperatureNot: 'hot' }
    ]
  },
  {
    id: '2024-08', label: '2024년 8월 엔캐리 청산',
    anchors: [
      ['2024-05-01', 5018.39, 15.39, 320], ['2024-07-16', 5667.20, 13.19, 300], ['2024-07-24', 5427.13, 18.04, 305],
      ['2024-07-29', 5463.54, 16.60, 315], ['2024-08-02', 5346.56, 23.39, 340], ['2024-08-05', 5186.33, 38.57, 370],
      ['2024-08-07', 5199.50, 27.85, 360], ['2024-08-16', 5554.25, 14.80, 320]
    ],
    checks: [
      { date: '2024-08-05', expect: { volatility: 'burden', credit: 'burden' }, notExpect: { trend: 'favorable' }, scoreDropFrom: ['2024-07-16', 20], temperatureNot: 'hot' },
      { date: '2024-08-16', notExpect: { volatility: 'burden' }, why: 'VIX가 2주 만에 14.8로 내려오면 변동성 부담을 풀어야 함' }
    ]
  },
  {
    id: '2025-04', label: '2025년 4월 관세 충격',
    anchors: [
      ['2024-12-02', 6047.15, 13.34, 270], ['2025-02-19', 6144.15, 15.27, 260], ['2025-03-13', 5521.52, 24.66, 330],
      ['2025-03-25', 5776.65, 17.48, 310], ['2025-04-02', 5670.97, 21.51, 340], ['2025-04-04', 5074.08, 45.31, 420],
      ['2025-04-08', 4982.77, 52.33, 450], ['2025-04-09', 5456.90, 33.62, 400], ['2025-04-21', 5158.20, 33.82, 420],
      ['2025-05-02', 5686.67, 22.68, 360]
    ],
    checks: [
      { date: '2025-04-08', expect: { trend: 'burden', volatility: 'burden', credit: 'burden' }, scoreBelow: 35, temperatureNot: 'hot' },
      { date: '2025-04-09', expect: { trend: 'burden', volatility: 'burden' }, scoreBelow: 45, why: '하루 +9.5% 반등은 추세·변동성 판정을 뒤집지 않음' },
      { date: '2025-04-21', expect: { trend: 'burden', volatility: 'burden' } }
    ]
  }
];

// Seeded path: log-linear between anchors plus mean-reverting noise (AR(1), phi 0.9) pinned to zero at both anchors, whose
// daily step scales with VIX. A random walk over the 800-session lead-in wandered ±10% and put the 200-day line anywhere.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (rand) => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
const shiftDate = (iso, days) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const LEAD_IN_SESSIONS = 800; // the temperature ranks need 504+ sessions and the regime a 200-day line

function replayRows(window, seed) {
  const rand = mulberry32(seed);
  const first = window.anchors[0];
  const leadDates = openSessionDatesBetween(shiftDate(first[0], -Math.ceil(LEAD_IN_SESSIONS * 1.5)), first[0], { includeEnd: false, maxDays: 2000 }).slice(-LEAD_IN_SESSIONS);
  // Calm lead-in (synthetic): 10% a year into the first anchor, VIX 15, HY flat at the first anchor.
  const lead = [[leadDates[0], first[1] / 1.1 ** (LEAD_IN_SESSIONS / 252), 15, first[3]]];
  const anchors = [...lead, ...window.anchors];
  const rows = [];
  for (let k = 0; k + 1 < anchors.length; k += 1) {
    const [fromDate, fromSpx, fromVix, fromHy] = anchors[k];
    const [toDate, toSpx, toVix, toHy] = anchors[k + 1];
    const dates = [fromDate, ...openSessionDatesBetween(fromDate, toDate, { includeEnd: true, maxDays: 2000 })];
    const steps = dates.length - 1;
    const walk = [0], vixWalk = [0];
    for (let i = 1; i <= steps; i += 1) {
      const vixNow = fromVix + (toVix - fromVix) * (i / steps);
      walk.push(0.9 * walk[i - 1] + gauss(rand) * (vixNow / 100) / Math.sqrt(252) * 0.6);
      vixWalk.push(0.9 * vixWalk[i - 1] + gauss(rand) * 0.04);
    }
    for (let i = k === 0 ? 0 : 1; i <= steps; i += 1) {
      const f = i / steps;
      const bridge = walk[i] - f * walk[steps];
      const vixBridge = vixWalk[i] - f * vixWalk[steps];
      rows.push({
        date: dates[i],
        spx: Math.exp(Math.log(fromSpx) + f * (Math.log(toSpx) - Math.log(fromSpx)) + bridge),
        vix: Math.max(9, (fromVix + f * (toVix - fromVix)) * Math.exp(vixBridge)),
        hy: fromHy + f * (toHy - fromHy)
      });
    }
  }
  for (const [date, spx, vix] of window.anchors) {
    const row = rows.find((r) => r.date === date);
    assert.ok(row && Math.abs(row.spx - spx) < 1e-6 && Math.abs(row.vix - vix) < 1e-6, `${window.id}: path hits anchor ${date}`);
  }
  return rows;
}

const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;
function readAt(rows, i) {
  const history = rows.slice(0, i + 1).map(({ date, spx, vix }) => ({ date, spx, vix }));
  const row = rows[i];
  const at = (k) => rows[Math.max(0, i - k)].hy;
  const credit = { hyBp: row.hy, hyDelta5Bp: row.hy - at(5), hyDelta20Bp: row.hy - at(20), hyAsOf: row.date };
  const regime = buildMarketRegime({ history, credit, rates: {}, now: Date.parse(`${row.date}T22:00:00Z`) });
  const states = Object.fromEntries(regime.axes.map((axis) => [axis.id, axis.state]));
  const closes = rows.slice(0, i + 1).map((r) => r.spx);
  const ma50 = closes.length >= 50 ? mean(closes.slice(-50)) : null;
  const ma200 = closes.length >= 200 ? mean(closes.slice(-200)) : null;
  const score = computeTradingScoreModel({ mode: 'swing', vix: row.vix, spxPrice: row.spx, spx50ma: ma50, spx200ma: ma200, maCurrent: ma50 != null && ma200 != null, hyBp: row.hy, breadthAvailable: false });
  return { date: row.date, row, states, ma50, ma200, score };
}

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const summary = [];

for (const [w, window] of WINDOWS.entries()) {
  const rows = replayRows(window, 20261016 + w);
  const start = rows.findIndex((r) => r.date === window.anchors[1][0]);
  const reads = new Map();
  // Whipsaw is counted as reversals between the two outer readings (양호 <-> 부담; 중립 is the ±1% testing band, where a
  // day-to-day 양호/중립 change is the owner's rule, not noise) against reversals of a bare close-vs-50-day sign.
  let regimeFlips = 0, naiveFlips = 0, lastOuter = null, lastSide = null, lastTrend = null;
  for (let i = start; i < rows.length; i += 1) {
    const read = readAt(rows, i);
    reads.set(read.date, { ...read, index: i });
    const { row, states, ma50, ma200, score } = read;
    const where = `${window.id} ${row.date}`;
    // Day-by-day invariants: the published rules hold on every replayed session, not only on the checked dates.
    // Audit 2026-10-17 (owner D2): 양호 is entered at +bufferPct and held down to the 50-day line (+holdAbovePct).
    if (states.trend === 'favorable') check(row.spx >= ma50 * (1 + RULES.trend.holdAbovePct / 100) && ma50 > ma200, `${where}: 추세 양호인데 50일선 위·50>200 조건이 아님`);
    if (states.trend === 'favorable' && lastTrend !== 'favorable') check(row.spx >= ma50 * (1 + RULES.trend.bufferPct / 100), `${where}: 50일선+${RULES.trend.bufferPct}% 아래에서 추세 양호로 진입`);
    lastTrend = states.trend;
    if (row.spx < ma200 * (1 - RULES.trend.bufferPct / 100)) check(states.trend === 'burden', `${where}: 200일선 -${RULES.trend.bufferPct}% 아래인데 추세가 ${states.trend}`);
    if (row.spx < ma200) check(states.trend !== 'favorable', `${where}: 200일선 아래인데 추세 양호`);
    if (row.vix >= RULES.volatility.stressAt) check(states.volatility === 'burden', `${where}: VIX ${row.vix.toFixed(1)}인데 변동성이 ${states.volatility}`);
    if (row.vix >= RULES.volatility.calmBelow) check(states.volatility !== 'favorable', `${where}: VIX ${row.vix.toFixed(1)}(18 이상)인데 변동성 양호`);
    if (row.hy >= RULES.credit.stressAtBp) check(states.credit === 'burden', `${where}: HY ${row.hy.toFixed(0)}bp인데 신용이 ${states.credit}`);
    if (row.vix >= 30) check(score.score != null && score.score <= 50, `${where}: VIX ${row.vix.toFixed(1)}인데 매매 점수 ${score.score}`);
    if (row.spx < ma200) check(score.trendScore != null && score.trendScore <= 32, `${where}: 200일선 아래인데 추세 점수 ${score.trendScore}`);
    // Whipsaw: the buffered trend axis may not reverse more often than a bare close-vs-50-day sign does.
    if (states.trend === 'favorable' || states.trend === 'burden') {
      if (lastOuter && states.trend !== lastOuter) regimeFlips += 1;
      lastOuter = states.trend;
    }
    const side = row.spx >= ma50;
    if (lastSide != null && side !== lastSide) naiveFlips += 1;
    lastSide = side;
  }
  check(regimeFlips <= naiveFlips, `${window.id}: 양호·부담 사이 전환 ${regimeFlips}회가 단순 50일선 교차 ${naiveFlips}회보다 많음 (여유 구간 무력화)`);

  for (const spec of window.checks) {
    const read = reads.get(spec.date);
    assert.ok(read, `${window.id}: ${spec.date} is a replayed session`);
    const where = `${window.id} ${spec.date}${spec.why ? ` (${spec.why})` : ''}`;
    for (const [axis, state] of Object.entries(spec.expect || {})) check(read.states[axis] === state, `${where}: ${axis} 기대 ${state}, 실제 ${read.states[axis]}`);
    for (const [axis, state] of Object.entries(spec.notExpect || {})) check(read.states[axis] !== state, `${where}: ${axis}가 ${state}이면 안 됨`);
    if (spec.scoreBelow != null) check(read.score.score != null && read.score.score < spec.scoreBelow, `${where}: 매매 점수 ${read.score.score} (기대 < ${spec.scoreBelow})`);
    if (spec.scoreDropFrom) {
      const [fromDate, drop] = spec.scoreDropFrom;
      const before = reads.get(fromDate)?.score.score;
      check(before != null && read.score.score != null && before - read.score.score >= drop, `${where}: 매매 점수 ${before} -> ${read.score.score} (기대 하락 ${drop}점 이상)`);
    }
    if (spec.temperatureNot) {
      const temperature = buildMarketTemperature(rows.slice(0, read.index + 1).map((r) => [r.date, r.spx]));
      check(temperature && temperature.state !== spec.temperatureNot, `${where}: 시장 온도 ${temperature?.state}`);
      const range = temperature?.components.find((c) => c.id === 'range')?.score;
      check(range != null && range <= 20, `${where}: 급락일 52주 범위 순위 ${range} (기대 20 이하)`);
    }
    summary.push(`${spec.date} ${Object.entries(read.states).filter(([id]) => ['trend', 'volatility', 'credit'].includes(id)).map(([id, s]) => `${id}:${s}`).join(' ')} score:${read.score.score}`);
  }
  summary.push(`${window.id}: outer changes regime ${regimeFlips} / close-vs-50 ${naiveFlips}`);
}

// Real 2026 windows, replayed day by day from the published history.json + macro-history.json (no synthetic path).
// - 2026-02..03: S&P 500 -9.1%, Nasdaq-100 -11.8%, VIX 31 on 3/27. history.json starts 2025-08-22, so the 200-day line —
//   and with it the trend axis — is not computable from this file before 2026-06; the replay says so instead of guessing.
// - 2026-07: the S&P 500 fell at most 4.5% while the Nasdaq-100 (the leadership proxy; SMH is reference-only) fell
//   11.3% from 6/2 to 7/29 (owner 2026-10-16: "지수는 덜 빠져도 AI·반도체는 많이 빠졌다"). A leadership
//   state of 'holding' then told the AI packet "주도 영역 이탈: 아니오".
// - 2026-10-12..15: the v57.81 rule changes came from this week (0.15% over the 50-day line and VIX 16.87 after +11.9%
//   in five sessions both read 양호 on 10/14).
{
  const history = JSON.parse(readFileSync(new URL('../public-data/history.json', import.meta.url), 'utf8'));
  const rows = Array.isArray(history) ? history : history.rows || [];
  const macroHistory = JSON.parse(readFileSync(new URL('../public-data/macro-history.json', import.meta.url), 'utf8'));
  const hy = macroHistory.series?.hyOas?.observations || [];
  const realAt = (date) => {
    const hist = rows.filter((row) => row.date <= date);
    if (!hist.length || hist.at(-1).date !== date) return null;
    const obs = hy.filter((o) => o[0] <= date);
    const last = obs.at(-1), five = obs.at(-6);
    const credit = last && five ? { hyBp: last[1] * 100, hyDelta5Bp: (last[1] - five[1]) * 100, hyAsOf: last[0] } : {};
    const regime = buildMarketRegime({ history: hist, credit, rates: {}, macroHistory, now: Date.parse(`${date}T22:00:00Z`) });
    return { date, row: hist.at(-1), credit, regime, states: Object.fromEntries(regime.axes.map((axis) => [axis.id, axis.state])), leadership: regime.leadership || {} };
  };
  const sessions = (from, to) => rows.filter((row) => row.date >= from && row.date <= to && Number.isFinite(row.spx) && Number.isFinite(row.ndx)).map((row) => row.date);
  const need = (date, label) => { const read = realAt(date); if (!read) failures.push(`${label} ${date}: history.json has no close`); return read; };
  const line = (read, extra = '') => `${read.date} ${['trend', 'breadth', 'volatility', 'credit'].map((id) => `${id}:${read.states[id]}`).join(' ')} leaders:${read.leadership.state}${extra}`;

  // Day-by-day invariants over all three windows.
  for (const [label, from, to] of [['2026-02~03', '2026-01-27', '2026-04-09'], ['2026-07', '2026-06-29', '2026-08-07'], ['2026-10', '2026-10-12', '2026-10-15']]) {
    let previous = null;
    for (const date of sessions(from, to)) {
      const read = realAt(date);
      const { row, states, leadership, credit } = read;
      const where = `${label} ${date}`;
      if (Number.isFinite(row.vix) && row.vix >= RULES.volatility.stressAt && states.volatility !== 'unknown') check(states.volatility === 'burden', `${where}: VIX ${row.vix}인데 변동성 ${states.volatility}`);
      if (credit.hyBp >= RULES.credit.stressAtBp && states.credit !== 'unknown') check(states.credit === 'burden', `${where}: HY ${credit.hyBp.toFixed(0)}bp인데 신용 ${states.credit}`);
      // A leadership proxy clearly under its 50-day line is never 'holding' (v57.83).
      if (leadership.belowMa50) check(leadership.state !== 'holding', `${where}: 나스닥 100이 50일선 아래(${leadership.summary})인데 주도 영역 유지`);
      if (leadership.state === 'break') check(leadership.proxyWeak === true, `${where}: 주도주 약세 없이 이탈 판정`);
      // v57.94: a break holds while the proxy stays weak (7/23 이탈 -> 7/24 약세 -> 7/29 이탈 was single-session counts).
      if (previous?.break && leadership.proxyWeak) check(leadership.break, `${where}: 전날 이탈·나스닥 100 약세 지속인데 ${leadership.state} (${leadership.summary})`);
      previous = leadership;
    }
  }

  // 2026-02..03 bottom (3/27: S&P 500 -8.7% from its high, Nasdaq-100 -11.4%, VIX 31).
  const mar27 = need('2026-03-27', '2026-02~03');
  if (mar27) {
    check(!['trend', 'breadth', 'volatility'].some((id) => mar27.states[id] === 'favorable'), `2026-03-27: 급락일에 양호 판정 ${line(mar27)}`);
    check(mar27.states.volatility === 'burden' && mar27.states.breadth === 'burden', `2026-03-27: 변동성·시장 폭 부담이어야 함 ${line(mar27)}`);
    check(mar27.leadership.state !== 'holding', `2026-03-27: 나스닥 100 -11.4%인데 주도 영역 유지`);
    summary.push(line(mar27, mar27.states.trend === 'unknown' ? ' (추세: history.json 200거래일 미만)' : ''));
  }
  // 2026-07: the AI/semis decline under a steady index.
  for (const date of ['2026-07-28', '2026-07-29']) {
    const read = need(date, '2026-07');
    if (!read) continue;
    check(read.leadership.state === 'weak' || read.leadership.state === 'break', `${date}: 나스닥 100 1년 고점 대비 ${read.leadership.offHigh?.toFixed(1)}%인데 주도 영역 ${read.leadership.state}`);
    check(read.regime.conflicts.some((text) => /주도주 약세|주도 영역이 꺾이는/.test(text)), `${date}: 엇갈리는 신호에 주도주 약세가 없음`);
    if (date === '2026-07-29') check(read.states.trend !== 'favorable', `${date}: S&P 500 50일선 -2.0%인데 추세 양호`);
    summary.push(line(read, ` ndx/high:${read.leadership.offHigh?.toFixed(1)}%`));
  }
  // v57.94: with the 5-session confirmation window the July break read from 7/17 (Nasdaq-100 -4.1% in five sessions, 상승
  // 종목 32% that day and 분배일 6 on 7/13). Audit 2026-10-17 (owner D1): the advance confirmation is the 5-session mean, so
  // one weak session no longer confirms; the break reads from 7/23 and holds through 8/3; 8/4 regains the 50-day line.
  for (const date of sessions('2026-07-23', '2026-08-03')) {
    const read = realAt(date);
    check(read.leadership.break, `${date}: 7월 주도주 하락 구간인데 주도 영역 ${read.leadership.state} (${read.leadership.summary})`);
  }
  const aug4 = need('2026-08-04', '2026-07');
  if (aug4) check(!aug4.leadership.break, `2026-08-04: 나스닥 100이 50일선을 되찾았는데 이탈 유지 (${aug4.leadership.summary})`);
  // 2026-08-06: Nasdaq-100 at its 50-day line (-0.0%) in a +4.5% week — inside the 1% buffer, not a break.
  const aug6 = need('2026-08-06', '2026-07');
  if (aug6) { check(!aug6.leadership.break, `2026-08-06: 50일선 ±1% 안 반등 주간에 주도 영역 이탈 (${aug6.leadership.summary})`); summary.push(line(aug6)); }

  // SMH (semiconductors) joined history.json in v57.83. Report-only: no judgement reads it — v57.94 compared it as a second
  // proxy and it read 이탈 through the +8% rebound week of 8/5~8/10 — so its drawdown is evidence for the owner, not a gate.
  for (const [label, from, to] of [['2026-02~03', '2026-01-02', '2026-04-09'], ['2026-07', '2026-06-01', '2026-08-07']]) {
    const smh = rows.filter((row) => row.date >= from && row.date <= to && Number.isFinite(row.smh));
    if (smh.length < 20) { summary.push(`${label} SMH: 기록 없음 (다음 갱신 때 1년 백필)`); continue; }
    let peak = smh[0], worst = { dd: 0 };
    for (const row of smh) { if (row.smh > peak.smh) peak = row; const dd = (row.smh / peak.smh - 1) * 100; if (dd < worst.dd) worst = { dd, from: peak.date, to: row.date }; }
    summary.push(`${label} SMH 최대 낙폭 ${worst.dd.toFixed(1)}% (${worst.from} -> ${worst.to}), 그날 주도 영역 ${realAt(worst.to)?.leadership.state ?? '-'}`);
  }

  for (const date of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']) {
    const read = need(date, '2026-10');
    if (!read) continue;
    if (date === '2026-10-14') {
      check(read.states.trend !== 'favorable', `2026-10-14: 50일선과 0.15% 차이·주도주 하락인데 추세 ${read.states.trend}`);
      check(read.states.volatility !== 'favorable', `2026-10-14: VIX 16.87(5일 +11.9%)인데 변동성 ${read.states.volatility}`);
    }
    // HY +55bp over 20 sessions was the largest widening of the year: 부담 by the record rule all week (F06).
    check(read.states.credit === 'burden', `2026-10 ${date}: 20거래일 HY 확대가 1년 최대인데 신용 ${read.states.credit}`);
    summary.push(line(read));
  }
}

if (process.argv.includes('--verbose')) console.log(summary.join('\n'));
if (failures.length) {
  console.error(`crash replay: FAIL (${failures.length})\n- ${failures.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}
console.log(`crash replay check: PASS (${WINDOWS.length} synthetic-stress anchor windows + 3 observed 2026 windows, ${summary.length} readings) — regression/consistency only, not predictive validation (R708)`);
