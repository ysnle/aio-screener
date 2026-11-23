#!/usr/bin/env node
// v60.50 (owner 2026-11-23, _artifacts/whole-audit-20261123/FINDINGS.md "판정 규칙 네 곳 재설계안", audit B14 · D2 · D4 · B11):
// three judgement rules whose verdict was narrower than the question the screen asks. Each assertion below fails on the
// v60.49 code and passes on the redesign. Fixtures only (synthetic closes and releases), never the published data.
//   1. 시장 폭: the level verdict keeps its rule; the domain adds its speed ("중립 · 빠르게 악화") for every surface.
//   2. 매크로: the quadrant's verdict line states level, speed, growth and policy (never a bare '보류'); the inflation speed
//      and 유가와 달러 hold a state inside a hold band (shared/latch.js) and mark '경계' near the flip.
//   3. 가이드: the counted branches are the lead and those with the core condition and half their conditions met; the
//      first 기울일 쪽 line follows the lead, a differing cross-branch choice is said apart, and the alternative scenario
//      is the next by fit with its own tag.
//   node scripts/ci-judgement-rule-redesign-check.mjs
import { createFakeDocument } from './lib/fake-dom.mjs';
import { renderBreadthBoard } from '../src/ui/components/breadth-board.js';
import { renderRegimePage } from '../src/ui/components/market-regime.js';
import { renderMacroBoard } from '../src/ui/components/macro-board.js';
// Namespace imports: a missing export fails its own assertion instead of the whole run (so the file reports on old code too).
import * as marketRead from '../src/domain/briefing/market-read.js';
import * as macroRead from '../src/domain/macro/macro-read.js';
import * as macroSignals from '../src/domain/macro/macro-signals.js';
import * as guideModule from '../src/domain/guide/market-guide.js';
import * as crossroadsModule from '../src/domain/market/regime/macro-crossroads.js';
import { isCloseSessionDate } from '../src/domain/market/session/close-series.js';
import { buildScreenPacket } from './lib/screen-reading.mjs';

const descendants = (node, out = []) => { if (!node) return out; out.push(node); for (const child of node.children || []) descendants(child, out); return out; };
const failures = [];
let passed = 0;
const check = (label, ok, detail = '') => { if (ok) passed += 1; else failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const attempt = (label, fn) => { try { return fn(); } catch (error) { failures.push(`${label}: threw ${error.message}`); return null; } };

// US close sessions ending 2026-11-20 (the exchange calendar decides the holidays).
const SESSIONS = (() => {
  const out = [];
  for (let t = Date.parse('2026-11-20T12:00:00Z'); out.length < 320; t -= 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (isCloseSessionDate(date, 'US')) out.unshift(date);
  }
  return out;
})();
const N = SESSIONS.length;
const NOW = Date.parse('2026-11-21T03:00:00Z');
const regimeOf = (rows) => attempt('regime', () => marketRead.buildMarketRegime({ history: rows, now: NOW }));
const axisOf = (regime, id) => regime?.axes?.find((row) => row.id === id) || null;

// ---- 1. 시장 폭: level verdict plus speed -------------------------------------------------------------------------------
{
  // 50-day ratio wobbling ±1pp, then the last five sessions move 15pp; the 200-day ratio sits at 52 (neither line).
  const rows = (start, end) => SESSIONS.map((date, i) => ({ date, spx: 6000 + 20 * Math.sin(i / 9),
    breadth50: i < N - 6 ? start + Math.sin(i / 2) : start + ((end - start) * (i - (N - 6))) / 5, breadth200: 52 }));
  const falling = regimeOf(rows(58, 43));
  const flat = regimeOf(rows(50, 50));
  const rising = regimeOf(rows(43, 58));
  const b = axisOf(falling, 'breadth');
  check('v60.50 B14: a 15pp five-session fall to 43% reads "중립 · 빠르게 악화" (level verdict kept, speed beside it)', b?.state === 'neutral' && b?.verdictLabel === '중립 · 빠르게 악화', `${b?.state} / ${b?.verdictLabel}`);
  check('v60.50 B14: a move inside the typical five-session change carries no speed word', axisOf(flat, 'breadth')?.verdictLabel === '중립', axisOf(flat, 'breadth')?.verdictLabel);
  check('v60.50 B14: the mirror rise reads "중립 · 빠르게 개선"', axisOf(rising, 'breadth')?.verdictLabel === '중립 · 빠르게 개선', axisOf(rising, 'breadth')?.verdictLabel);
  check('v60.50 B14: the speed word changes neither the axis count nor the overall label', falling?.counts && JSON.stringify(falling.counts) === JSON.stringify(flat?.counts) && falling.overall === flat?.overall, `${JSON.stringify(falling?.counts)} vs ${JSON.stringify(flat?.counts)}`);
  const speed = attempt('breadthSpeedOf', () => marketRead.breadthSpeedOf(rows(58, 43).map((row) => ({ date: row.date, value: row.breadth50 }))));
  check('v60.50 B14: one domain function (breadthSpeedOf) owns the speed', speed?.dir === 'down' && speed.change < -14 && speed.typical > 0, JSON.stringify(speed));
  const packet = falling ? attempt('packet', () => buildScreenPacket('breadth', { regime: falling })) : null;
  check('v60.50 B14: the AI reading of 시장 폭 receives the same verdict with its speed', (packet?.lines || []).some((line) => line.startsWith('시장 폭: 중립 · 빠르게 악화')), (packet?.lines || []).join(' | ').slice(0, 200));
  // The two screens, mounted on the same closes, print the domain label as it is (no UI-side speed word or rule).
  const breadthDoc = createFakeDocument();
  attempt('renderBreadthBoard', () => renderBreadthBoard({ documentRef: breadthDoc, root: { _aioHistory: rows(58, 43) } }));
  const signalDoc = createFakeDocument();
  attempt('renderRegimePage', () => renderRegimePage({ documentRef: signalDoc, root: { _aioHistory: rows(58, 43) } }));
  const signalRow = signalDoc.getElementById('regime-board').children.find((node) => node.dataset?.axis === 'breadth');
  const signalState = signalRow ? descendants(signalRow).find((node) => node.classList?.contains('ind-row__state'))?.textContent : null;
  check('v60.50 B14: the 시장 폭 headline and the 시장 상태 row show the domain verdict label',
    breadthDoc.getElementById('breadth-state').textContent === b?.verdictLabel && signalState === b?.verdictLabel, `${breadthDoc.getElementById('breadth-state').textContent} / ${signalState}`);
}

// ---- 2. 매크로: verdict line, hold band, 경계 ------------------------------------------------------------------------------
{
  const months = (count, end = '2026-10') => Array.from({ length: count }, (_, i) => {
    const [y, m] = end.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1)).toISOString().slice(0, 10);
  });
  const index = (dates, rate) => dates.map((date, i) => [date, 100 * (1 + rate / 100) ** (i / 12)]);
  const dates = months(30);
  const mh = { schemaVersion: 'macro-history.v1', series: Object.fromEntries(Object.entries({
    corePceIndex: index(dates, 3.1), coreCpiIndex: index(dates, 2.6),
    unemployment: dates.map((date) => [date, 4.1]), payrolls: dates.map((date, i) => [date, 150000 + 150 * i]),
    fedTargetUpper: [['2026-03-18', 3.75], ['2026-09-17', 4]]
  }).map(([key, observations]) => [key, { observations }])) };
  const quadrant = attempt('buildMacroRead', () => macroRead.buildMacroRead({ macro: { corePce: 3.1 }, macroHistory: mh }))?.regime;
  check('v60.50 D4: a held quadrant still says the level, the growth direction and the policy cycle; 보류 is only the speed',
    quadrant?.available === false && quadrant?.verdict === '물가 목표 위 · 속도 보류, 성장 견조, 연준 인상 국면', `${quadrant?.available} / ${quadrant?.verdict}`);
  const macroDoc = createFakeDocument();
  attempt('renderMacroBoard', () => renderMacroBoard({ documentRef: macroDoc, root: { _aioServerMacro: { corePce: 3.1 }, _aioMacroHistory: mh, _aioHistory: [] } }));
  const macroHead = descendants(macroDoc.getElementById('macro-regime'));
  const macroLabel = macroHead.find((node) => node.classList?.contains('macro-regime-label'))?.textContent;
  check('v60.50 D4: the 매크로 head draws the domain verdict line; the UI-built 판정 사유 sentence left',
    macroLabel === quadrant?.verdict && !macroHead.some((node) => node.classList?.contains('is-reason')), macroLabel);

  const dir = (pce) => attempt('inflationDirection', () => macroSignals.inflationDirection({ pce }));
  const held = dir({ pace: 3.4, yoy: 3.0, date: '2026-10-01', margins: [{ date: '2026-08-01', margin: 0.6 }, { date: '2026-09-01', margin: 0.45 }] });
  check('v60.50 D4: a speed that crossed +0.5pp holds 상승 at +0.4pp (hold band to 0.25pp)', held?.pce?.dir === 'up' && held.state === 'up', JSON.stringify(held?.pce));
  const released = dir({ pace: 3.2, yoy: 3.0, date: '2026-10-01', margins: [{ date: '2026-08-01', margin: 0.6 }, { date: '2026-09-01', margin: 0.45 }] });
  check('v60.50 D4: the hold ends once the margin is back inside 0.25pp', released?.pce?.dir === 'flat', JSON.stringify(released?.pce));
  const edge = dir({ pace: 3.02, yoy: 2.6, date: '2026-10-01' });
  check('v60.50 D4: a margin 0.08pp short of the 0.5pp line is 경계', edge?.pce?.dir === 'flat' && edge.edge === true, JSON.stringify(edge?.pce));

  // 유가와 달러: the dollar's 20-session rise reached +2.6% (부담) two sessions ago and is +1.5% now — inside the old
  // entry line (중립 on v60.49), outside the 1.5% exit line, so 부담 holds.
  const base = N - 23;
  const dxy = (i) => (i <= base ? 100 : i <= N - 3 ? 100 + (2.6 * (i - base)) / 20 : i === N - 2 ? 102.2 : 101.8);
  const rows = SESSIONS.map((date, i) => ({ date, spx: 6000 + 20 * Math.sin(i / 9), breadth50: 50, breadth200: 52, wti: i === 100 ? 60 : i === 110 ? 80 : 70, dxy: dxy(i) }));
  const before = axisOf(regimeOf(rows.slice(0, N - 2)), 'commodities');
  const c = axisOf(regimeOf(rows), 'commodities');
  check('v60.50 D2 fixture: the +2.6% dollar session reads 부담', before?.state === 'burden', before?.state);
  check('v60.50 D2: 유가와 달러 holds 부담 inside the hold band (the dollar back to +1.5%, under the +2.5% entry line)',
    c?.state === 'burden' && /부담 유지/.test(String(c?.evidence?.find(([label]) => label === marketRead.AXIS_REASON_LABEL)?.[1] || '')), `${c?.state} / ${JSON.stringify(c?.evidence?.at(-1))}`);
  check('v60.50 D2: the held verdict less than a typical day from its exit line reads "부담 · 경계"',
    c?.verdictLabel === '부담 · 경계' && c?.flipDistance?.towardLabel === '중립', `${c?.verdictLabel} / ${c?.flipDistance?.label}`);
}

// ---- 3. 가이드: lead and tally agree ----------------------------------------------------------------------------------------
{
  const item = (id, met, favored, costly, axes, gate = true) => ({ id, title: `${id.toUpperCase()} — x`, gate: { met: gate }, known: 4, met, total: 4, fit: `조건 충족 ${met}/4`,
    favored, costly, choices: Object.fromEntries(favored.map((key) => [key, `${id} 쪽 비용 비교 문장`])), impact: {}, triggers: [], axes, conditions: [] });
  const crossroads = { available: true, held: false, asOf: '2026-11-20', leadId: 'a', altId: 'd', tiedIds: [], events: [], nextEvent: null, items: [
    item('a', 3, ['stage'], ['defend'], ['growth']), item('b', 1, ['hold'], ['stage'], ['rates']), item('c', 1, ['hold'], ['stage'], ['credit']), item('d', 2, ['hold'], ['stage'], ['oil'])] };
  const regime = { available: true, asOf: '2026-11-20', overall: '혼조', counts: { favorable: 2, neutral: 2, burden: 2, unknown: 0 }, axes: [] };
  const guide = attempt('buildMarketGuide', () => guideModule.buildMarketGuide({ regime, crossroads, nowMs: NOW }));
  const name = (key) => guideModule.choiceName(key);
  const live = (guide?.direction?.live || []).map((p) => p.id).join(',');
  check('v60.50 B11: the tally counts the lead and branches with the core condition and half their conditions (1/4 branches out)', live === 'a,d', live);
  const pursue = guide?.stance?.pursue || [];
  check('v60.50 B11: the first 기울일 쪽 line is the lead\'s own lower-cost choice', pursue[0] === `${name('stage')}: a 쪽 비용 비교 문장`, pursue[0]);
  check('v60.50 B11: a cross-branch choice that differs from the lead is said apart', pursue.some((line) => line.includes(`'${name('hold')}'`) && /선두와 다름/.test(line)), pursue.join(' | '));
  const avoid = guide?.stance?.avoid || [];
  check('v60.50 B11: a 피할 쪽 line on a choice the lead favours says so', avoid.some((line) => line.startsWith(`'${name('stage')}' — 선두 'A'에서는 비용이 작지만`)), avoid.join(' | '));
  check('v60.50 B11: no "가장 많이 꼽힙니다" wording remains', !/가장 많이 꼽|가장 많이 적힌/.test(JSON.stringify(guide || {})));
  check('v60.50 B11: the guide headline follows the lead and names the differing cross-branch choice', /선두에서 비용이 작은 쪽은 '분할 접근', 시나리오 전체로는 '보유 유지'/.test(guide?.headline || ''), guide?.headline);

  // The alternative: the next branch by fit, tagged when its core condition is not met (v60.49 skipped it for a gated 1/4).
  const oct14 = { oil20: 15, oilVsYear: 21, oilSurging: true, oilHeld: false, wtiPosition: 0.9, breakeven20: 0.02, sentimentRank: { value: 51.7, date: '2026-08-01', month: '8월', percentile: 13 },
    commodities: 'burden', dxy20: 2.23, krw20: -1.6, lean: 'hike', pricing: 0.95, tnx20: 0.18, termPremium20: 0.2, curve2s10s20: 0.15, realYield20: 0.26,
    policy: { upper: 4, change: 0.25, changeDate: '2026-09-17', bill: null }, hy20: 40, cccGap20: 1.5, nfci4: 0.051, credit: 'neutral',
    bands: { breakeven20: 0.5 * 0.079, tnx20: 0.1, termPremium20: 0.05, curve2s10s20: 0.07, realYield20: 0.06, hy20: 12, cccGap20: 0.5, nfci4: 0.015 } };
  const model = attempt('buildMacroCrossroads', () => crossroadsModule.buildMacroCrossroads({ signals: oct14 }));
  const alt = model?.items?.find((row) => row.id === model.altId);
  check('v60.50 B11: the alternative is the next branch by fit and carries its core-condition tag',
    model?.leadId === 'oilshock' && alt && alt.met / alt.total === 0.5 && model.altTag === '핵심 조건 확인 불가' && /대안 시나리오: '신용 경색'\(조건 충족 2\/4, 확인 가능 3개, 핵심 조건 확인 불가\)/.test(model.headline), `${model?.leadId} / ${model?.altId} / ${model?.altTag} / ${model?.headline}`);
}

if (failures.length) {
  console.error(`judgement rule redesign: ${failures.length} failed, ${passed} passed`);
  for (const line of failures) console.error(`  FAIL ${line}`);
  process.exit(1);
}
console.log(`judgement rule redesign: ${passed} checks passed`);
