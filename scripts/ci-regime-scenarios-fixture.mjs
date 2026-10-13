// P1628: offline regime condition/series/venue-date contracts. No provider calls or producer execution.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMarketRegime } from '../src/domain/briefing/market-read.js';
import { buildMarketScenarios, buildRegimeAxisHistory, renderMarketScenarioContext, buildKoreaIndexSeries, buildKoreaRegimeObservations } from '../src/domain/market/regime-scenarios.js';
import { resolveMarketCalendarSession } from '../src/domain/market/market-calendar.js';
import { renderRegimePage } from '../src/ui/components/market-regime.js';

const dates = [];
for (let instant = Date.parse('2025-10-01T12:00:00Z'); instant <= Date.parse('2026-10-08T12:00:00Z'); instant += 86400000) {
  const current = new Date(instant), date = current.toISOString().slice(0, 10), weekday = current.getUTCDay();
  if (weekday !== 0 && weekday !== 6 && resolveMarketCalendarSession({ market: 'US', date }).status !== 'closed') dates.push(date);
}
const history = dates.map((date, index) => ({ date, spx: 6000 + index * 6, nasdaq: 22000 + index * 20, vix: 14, vix3m: 17,
  breadth50: 65, breadth200: 68, advanceRatio: .58, tnx: 4.1, wti: 80, dxy: 100, gold: 2000 }));
const asOf = history.at(-1).date;
const input = { history, credit: { hyBp: 300, hyAsOf: asOf, hyDelta5Bp: -10, pcr: .9, pcrAsOf: asOf },
  rates: { asOf, realAsOf: asOf, breakevenAsOf: asOf, realYield10: 1.8, realYield10Delta5: -.03, breakeven10Delta5: .01 } };
const macroHistory = { schemaVersion: 'macro-history.v1', series: {
  hyOas: { observations: dates.map(date => [date, 3]) }, realYield10: { observations: dates.map(date => [date, 1.8]) }, breakeven10: { observations: dates.map(date => [date, 2.3]) }
} };
const regime = buildMarketRegime(input);
assert.equal(regime.axes.find(row => row.id === 'trend').state, 'favorable', 'P1628 fixture must exercise a genuine computed upward regime');
let model = buildMarketScenarios(input, { regime });
assert.equal(model.scenarios.find(item => item.id === 'expansion').confirmed, true, 'P1628 broad participation with trend and non-stressed credit/volatility must identify the expansion conditions');
assert.equal(model.scenarios.filter(item => item.confirmed).length, 1, 'P1628 observed conditions must not confirm conflicting paths at once');
const narrow = { ...input, history: history.map(row => ({ ...row, breadth50: 35, breadth200: 38 })) };
model = buildMarketScenarios(narrow);
assert.equal(model.scenarios.find(item => item.id === 'concentration').confirmed, true, 'P1628 favorable index with narrow participation and calm risk must identify concentration');
assert.ok(model.scenarios.find(item => item.id === 'concentration').interpretation.includes('기여도를 확인'), 'P1628 narrow breadth must not claim measured mega-cap contribution');
const weak = { ...input, history: history.map((row, index) => ({ ...row, spx: 9000 - index * 10, breadth50: 30, breadth200: 35, vix: 30, vix3m: 25 })), credit: { ...input.credit, hyBp: 480, hyDelta5Bp: 35 } };
assert.equal(buildMarketScenarios(weak).scenarios.find(item => item.id === 'weakness').confirmed, true, 'P1628 simultaneous trend/breadth and credit-volatility stress must identify weakness');
for (const partial of [{ ...input, history: history.map(row => ({ ...row, breadth200: null })) }, { ...input, credit: { ...input.credit, hyDelta5Bp: null } },
  { ...input, history: history.map(row => ({ ...row, vix3m: null })) }, { ...input, credit: { ...input.credit, hyAsOf: '2026-08-01' } }]) {
  const held = buildMarketScenarios(partial);
  assert.equal(held.held, true, 'P1628 incomplete/stale evidence must hold scenario affiliation');
  assert.ok(held.scenarios.every(item => !item.confirmed && item.status === '판단 보류'), 'P1628 a missing input must never be silently read as calm');
}
assert.equal(buildMarketScenarios({ history: [] }).available, false, 'P1628 no completed-close history means no scenario narrative');
const charts = buildRegimeAxisHistory(input, { regime, macroHistory });
assert.equal(Object.keys(charts.axes).filter(id => id !== 'korea').length, 6, 'P1628 six US axes must each have a chart definition');
assert.equal(charts.axes.credit[0].series.at(-1).value, 300, 'P1628 FRED HY percent must convert exactly to bp');
assert.equal(charts.axes.volatility.find(item => item.id === 'vix-term').series.at(-1).value, 14 / 17, 'P1628 term structure must use same-date VIX/VIX3M');
assert.equal(buildRegimeAxisHistory(input).axes.credit.length, 0, 'P1628 a missing HY history must hide its plot, never draw a placeholder number');
const future = { ...macroHistory, series: { ...macroHistory.series, hyOas: { observations: [...macroHistory.series.hyOas.observations, ['2026-10-12', 99]] } } };
assert.equal(buildRegimeAxisHistory(input, { macroHistory: future }).axes.credit[0].series.at(-1).value, 300, 'P1628 a later macro observation must not enter the US completed-close chart');
const context = renderMarketScenarioContext(narrow);
assert.ok(context.includes(`${asOf} 완료`) && context.includes('집중 유지 (현재 조건 부합)'), 'P1628 AI context must carry the exact screen model and completed observation date');

const krNow = Date.parse('2026-10-12T00:00:00Z');
const krHistory = [
  { date: '2026-10-07', kospi: 6500, kosdaq: 880, usdkrw: 1335 },
  { date: '2026-10-08', kospi: 6625.93, kosdaq: 892.27, usdkrw: 1342.99 },
  { date: '2026-10-09', kospi: 99999, kosdaq: 999, usdkrw: 1340.02 },
  { date: '2026-10-10', kospi: 6625.93, kosdaq: 892.27, fieldMeta: { kospi: { observedAt: '2026-10-08T11:05:40Z' }, kosdaq: { observedAt: '2026-10-08T11:05:40Z' } } },
  { date: '2026-10-11', kospi: 6625.93, kosdaq: 892.27, fieldMeta: { kospi: { observedAt: '2026-10-08T11:05:40Z' }, kosdaq: { observedAt: '2026-10-08T11:05:40Z' } } }
];
const kr = buildKoreaRegimeObservations({ history: krHistory }, { nowMs: krNow, through: '2026-10-09' });
assert.equal(kr.cards.find(item => item.id === 'kospi').asOf, '2026-10-08', 'P1628 a Korean holiday/weekend carry-forward must retain its actual KRX observation date');
assert.equal(kr.cards.find(item => item.id === 'kospi').last, 6625.93, 'P1628 holiday fake current value must not enter the KR market view');
assert.equal(kr.cards.find(item => item.id === 'kospi').series.length, 2, 'P1628 repeated weekend copies must not add fake Korean trading sessions');
assert.equal(kr.cards.find(item => item.id === 'usdkrw').asOf, '2026-10-09', 'P1628 FX observations keep their own date rather than masquerading as the Korean close');
assert.equal(buildKoreaIndexSeries([{ date: '2026-10-07', kospi: 5, fieldMeta: { kospi: { observedAt: '2026-10-07T16:00:00Z' } } }], 'kospi', { nowMs: krNow })[0].date, '2026-10-08', 'P1628 Korean index timestamps must use KST rather than the US day');

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.className = ''; this._text = ''; this.style = {}; this.classList = { add: (...names) => { this.className += ` ${names.join(' ')}`; }, contains: name => this.className.split(' ').includes(name) }; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(' '); }
  append(...nodes) { this.children.push(...nodes); nodes.forEach(node => { node.parentElement = this; }); }
  replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(type, listener) { this.listeners ||= {}; this.listeners[type] = listener; }
  querySelector(selector) { return descendants(this).find(node => selector === '[data-aio-regime-scenarios]' && node.dataset.aioRegimeScenarios) || null; }
  insertAdjacentElement(_, node) { this.parentElement?.append(node); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
}
function descendants(node) { return node.children.flatMap(child => [child, ...descendants(child)]); }
const page = new Element('main'); page.className = 'page active';
const ids = new Map([['page-signal', page]]);
for (const id of ['regime-basis', 'regime-overall', 'regime-counts', 'regime-headline', 'regime-conflicts', 'regime-board', 'regime-board-kr', 'regime-next']) { const element = new Element('div'); ids.set(id, element); page.append(element); }
const doc = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag), createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; }, getElementById: id => ids.get(id) || null };
const root = { _aioHistory: input.history, _aioMacroHistory: macroHistory, DATA_SNAPSHOT: { hySpread: 300, _hySpreadDelta5Bp: -10, pcr: .9, realYield10: 1.8,
  _fieldTs: { hySpread: asOf, pcr: asOf, macro_realYield10: asOf, macro_breakeven10: asOf } } };
renderRegimePage({ documentRef: doc, root });
assert.equal(ids.get('regime-board').children.length, 6, 'P1628 US regime board must preserve six distinct axis cards');
assert.equal(descendants(ids.get('regime-board')).filter(node => node.tagName === 'svg').length, 6, 'P1628 each populated axis must actually render a labelled history chart');
const breadthCard = ids.get('regime-board').children.find(card => card.dataset.axis === 'breadth');
const selectors = descendants(breadthCard).filter(node => node.tagName === 'button');
selectors[1].listeners.click();
assert.equal(descendants(breadthCard).find(node => node.className === 'regime-axis-plot').dataset.historySeries, 'breadth200', 'P1628 switching SMA50/200 must render the chosen actual series');
assert.equal(selectors[1].attributes['aria-pressed'], 'true', 'P1628 chart selection must expose its active state');
assert.equal(descendants(page).filter(node => node.dataset.scenario).length, 3, 'P1628 screen must show the three model-backed conditional paths');
const css = readFileSync(new URL('../src/ui/styles/regime-quality.css', import.meta.url), 'utf8');
assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') && css.includes('@media (max-width: 900px)'), 'P1628 six-axis layout must fill desktop in two columns and stack compact screens');
// P1723-P1727 (2026-10-13 market responsiveness): a rare KOSPI day reaches the briefing lead and the axis reads without
// changing any US axis state; KRX-session daily change; mixed-date FX chip; WTI 5-session rebound; one credit rule.
{
  const { buildMarketRead, koreaMoveRecord } = await import('../src/domain/briefing/market-read.js');
  const { buildDailyChanges } = await import('../src/domain/briefing/daily-diff.js');
  const { briefingFlow } = await import('../src/domain/market/page-flow.js');
  const { brentWtiCheck } = await import('../src/domain/macro/liquidity-growth.js');
  const { buildScenarioOutlook } = await import('../src/domain/market/scenario-outlook.js');
  const now = Date.parse('2026-10-13T09:00:00Z');
  const open = (market, date) => resolveMarketCalendarSession({ market, date }).status === 'open';
  const build = (shock) => {
    const rows = []; let k = 3000;
    for (let t = Date.parse('2025-08-01T12:00:00Z'), i = 0; t <= Date.parse('2026-10-13T12:00:00Z'); t += 86400000, i += 1) {
      const date = new Date(t).toISOString().slice(0, 10), us = open('US', date) && date <= '2026-10-12', krOpen = open('KR', date);
      if (!us && !krOpen) continue;
      const row = { date };
      if (us) Object.assign(row, { spx: 6000 + i, nasdaq: 22000 + i * 3, vix: 14, vix3m: 17, breadth50: 65, breadth200: 68, tnx: 4.1, wti: 92, dxy: 100, gold: 2000, usdkrw: 1350 + (i % 3) * 0.5 });
      if (krOpen) { k = shock && date === '2026-10-13' ? k * 0.94 : k * (1 + ((i % 5) - 2) * 0.004); row.kospi = k; }
      rows.push(row);
    }
    const usRows = rows.filter((row) => row.spx != null);
    // WTI 92 twenty sessions back, 80 five sessions back, 84 now: 20일 -8.7%, 최근 5일 +5.0%.
    usRows.slice(-21).forEach((row, j, list) => { const back = list.length - 1 - j; row.wti = back <= 4 ? 84 - back : 80 + (back - 5) * 12 / 15; });
    return rows;
  };
  const rows = build(true);
  const calm = build(false);
  const record = koreaMoveRecord(rows, { now });
  assert.ok(record?.date === '2026-10-13' && record.extreme && record.tail1 <= 2, `P1723 a -6% KRX day is at the edge of its own one-year record (${JSON.stringify(record)})`);
  const read = buildMarketRead({ history: rows, now });
  const korea = read.statements.find((row) => row.id === 'korea-relative');
  assert.ok(korea && read.statements.slice(0, 4).includes(korea) && korea.weight >= 76, `P1723 the rare Korean move enters the four-sentence lead (${JSON.stringify(read.statements.map((row) => [row.id, row.weight]))})`);
  assert.ok(/코스피 10\/13 -6\.0%/.test(korea.text) && /직전 미국장\(10\/12\)/.test(korea.text) && /최근 \d+거래일 기록에서 하루 최저/.test(korea.text), `P1723 one sentence names the KRX and US dates and the record position (${korea.text})`);
  assert.ok(/원\/달러 10\/12까지 5거래일 [+-]\d\.\d%\(보합권\)/.test(korea.text), `P1725/P1727 the won carries its own date and a ±0.5% move is 보합권 (${korea.text})`);
  assert.ok(!read.statements.some((row) => row.id === 'korea-day'), 'P1723 the 1-day and 5-day Korean sentences are one sentence');
  const regime = buildMarketRegime({ history: rows, now });
  const regimeCalm = buildMarketRegime({ history: calm, now });
  assert.deepEqual(regime.axes.map((row) => row.state), regimeCalm.axes.map((row) => row.state), 'P1723 a Korean shock never changes a US axis state');
  assert.ok(['trend', 'volatility'].every((id) => regime.axes.find((row) => row.id === id).read.includes('단, 한국은 10/13 코스피 -6.0%')), 'P1723 trend and volatility readings name the rare Korean move');
  assert.ok(!regimeCalm.axes.find((row) => row.id === 'trend').read.includes('단, 한국은'), 'P1723 an ordinary Korean day adds nothing to the US axis readings');
  const fxAxis = regime.axes.find((row) => row.id === 'korea');
  assert.ok(fxAxis.basisStatus === 'mixed' && fxAxis.basis === '10/12~10/13' && fxAxis.evidence.find(([label]) => label === '코스피')[1].endsWith('· 10/13'), `P1725 the won/KOSPI card shows each value's own date (${JSON.stringify(fxAxis)})`);
  const oil = regime.axes.find((row) => row.id === 'commodities');
  assert.ok(/WTI","84\.00달러 \(20일 -8\.7% · 최근 5일 \+5\.0% 반등\)/.test(JSON.stringify(oil.evidence)) && /최근 5일 \+5\.0% 반등했습니다\(판정은 20일 기준\)/.test(oil.read), `P1726 a 5-session WTI rebound is named beside the 20-session fall (${JSON.stringify(oil)})`);
  assert.equal(oil.state, regimeCalm.axes.find((row) => row.id === 'commodities').state, 'P1726 the oil wording never changes the axis state');
  const daily = buildDailyChanges(rows, { now });
  const kospiMove = daily.moves.find((move) => move.key === 'kospi');
  assert.ok(kospiMove?.market === 'KR' && kospiMove.from === '2026-10-12' && kospiMove.to === '2026-10-13' && Math.abs(kospiMove.value + 6) < 1e-9 && daily.big.includes('kospi'), `P1724 KOSPI compares its own previous KRX session (${JSON.stringify(daily)})`);
  const flow = briefingFlow({ read }).next;
  assert.ok(flow[0].route === 'signal' && flow[0].ctx?.anchor === 'regime-board-kr' && flow.some((item) => item.route === 'market-news' && item.ctx?.country === 'kr'), `P1727 the Korean lead continues to the 한국 시장 참고 board first, then Korean news (${JSON.stringify(flow)})`);
  const withBrent = rows.map((row) => (row.wti != null ? { ...row, brent: row.wti + 30 } : row));
  const brent = brentWtiCheck(null, withBrent);
  assert.ok(brent.basis === 'futures' && brent.abnormal && /보류/.test(brent.sentence) && !/20거래일 기준 브렌트/.test(brent.sentence), `P1726 an abnormal Brent-WTI futures gap holds the spread reading (${brent.sentence})`);
  const spot = brentWtiCheck({ series: { brent: { observations: rows.filter((row) => row.wti != null).slice(-25).map((row) => [row.date, 120]) } } }, rows);
  assert.ok(spot.basis === 'spot' && spot.spread == null && spot.diverges === false, `P1726 FRED spot Brent is not compared with the WTI future (${JSON.stringify(spot)})`);
  // P1727: scenario confirmation and the outlook count use one credit rule (creditState favorable).
  const neutralCredit = { ...narrow, credit: { ...narrow.credit, hyDelta20Bp: 45 } };
  const neutralRegime = buildMarketRegime(neutralCredit);
  const scenarios = buildMarketScenarios(neutralCredit, { regime: neutralRegime });
  const outlook = buildScenarioOutlook({ scenarios, regime: neutralRegime });
  assert.equal(neutralRegime.axes.find((row) => row.id === 'credit').state, 'neutral', 'P1727 fixture: a 20-session widening makes credit neutral');
  assert.ok(scenarios.scenarios.find((item) => item.id === 'concentration').confirmed === false && outlook.items.find((item) => item.id === 'concentration').met === 3, 'P1727 a neutral credit axis neither confirms 집중 유지 nor counts as 신용 안정');
}
console.log('[regime-scenarios] PASS P1628: six actual charts, conditional recovery/concentration/weakness, missing/stale holds, units/date bounds, KR holiday/KST separation, chart selection; P1723-P1727 Korean shock lead/axis notes, KRX daily change, mixed-date chip, WTI rebound, Brent hold, one credit rule. Offline.');
