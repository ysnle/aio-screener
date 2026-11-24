// Offline regime condition/series/venue-date contracts. No provider calls or producer execution.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AXIS_KOREA_LABEL, AXIS_REASON_LABEL, buildMarketRegime, bp } from '../src/domain/briefing/market-read.js';
import { buildMarketScenarios, buildRegimeAxisHistory, renderMarketScenarioContext, buildKoreaIndexSeries, buildKoreaRegimeObservations } from '../src/domain/market/regime/regime-scenarios.js';
import { resolveMarketCalendarSession } from '../src/domain/market/session/market-calendar.js';
import { renderRegimePage } from '../src/ui/components/market-regime.js';
import { showCrossroadsSection } from '../src/ui/components/macro-crossroads.js';
import { renderMarketStructure } from '../src/ui/components/market-structure.js';
import { marketInterpretation } from '../src/data/selectors/interpretation.js';

const dates = [];
for (let instant = Date.parse('2025-10-01T12:00:00Z'); instant <= Date.parse('2026-10-08T12:00:00Z'); instant += 86400000) {
  const current = new Date(instant), date = current.toISOString().slice(0, 10), weekday = current.getUTCDay();
  if (weekday !== 0 && weekday !== 6 && resolveMarketCalendarSession({ market: 'US', date }).status !== 'closed') dates.push(date);
}
// SOXX is the leadership proxy 소수 종목 주도 now needs (a missing proxy is 확인 불가, never holding).
const history = dates.map((date, index) => ({ date, spx: 6000 + index * 6, nasdaq: 22000 + index * 20, ndx: 20000 + index * 20, soxx: 250 + index * 0.4, vix: 14, vix3m: 17,
  breadth50: 65, breadth200: 68, advanceRatio: .58, tnx: 4.1, wti: 80, dxy: 100, gold: 2000 }));
const asOf = history.at(-1).date;
const input = { history, credit: { hyBp: 300, hyAsOf: asOf, hyDelta5Bp: -10, pcr: .9, pcrAsOf: asOf },
  rates: { asOf, realAsOf: asOf, breakevenAsOf: asOf, realYield10: 1.8, realYield10Delta5: -.03, breakeven10Delta5: .01 } };
const macroHistory = { schemaVersion: 'macro-history.v1', series: {
  hyOas: { observations: dates.map(date => [date, 3]) }, realYield10: { observations: dates.map(date => [date, 1.8]) }, breakeven10: { observations: dates.map(date => [date, 2.3]) }
} };
const regime = buildMarketRegime(input);
// A yield difference in bp is exact to 0.01bp, so the rates latch's +10bp exit is not tripped by 9.9999bp.
assert.ok(bp(5.10, 5.00) === 10 && bp(4.30, 4.20) === 10 && bp(5.00, 5.10) === -10 && bp(null, 5) === null, `P1926 bp(5.10, 5.00) must be exactly 10 (got ${bp(5.10, 5.00)})`);
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
assert.ok(context.includes(`${asOf} 확정`) && context.includes('소수 종목 주도 (현재 조건 충족)'), 'P1628 AI context must carry the exact screen model and completed observation date');

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
for (const id of ['regime-basis', 'regime-overall', 'regime-counts', 'regime-counter', 'regime-conflicts', 'regime-board', 'regime-history', 'regime-history-host', 'regime-board-kr', 'regime-next']) { const element = new Element('div'); ids.set(id, element); page.append(element); }
const doc = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag), createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; }, getElementById: id => ids.get(id) || null };
const root = { _aioHistory: input.history, _aioMacroHistory: macroHistory, DATA_SNAPSHOT: { hySpread: 300, _hySpreadDelta5Bp: -10, pcr: .9, realYield10: 1.8,
  _fieldTs: { hySpread: asOf, pcr: asOf, macro_realYield10: asOf, macro_breakeven10: asOf } } };
renderRegimePage({ documentRef: doc, root });
assert.equal(ids.get('regime-board').children.length, 6, 'P1628 US regime board must preserve six distinct axis cards');
// v60.31 (안 A): the rows are never folded — no <details> in a row, at most two lines under each value — and every populated
// axis's dated chart is one pick away in the 지표 추이 card (one plot at a time).
assert.ok(ids.get('regime-board').children.every(card => card.tagName === 'article' && !descendants(card).some(node => node.tagName === 'details') && descendants(card).filter(node => String(node.className).includes('ind-row__line')).length <= 2), 'v60.31 an indicator row has no fold and at most two lines');
const historyHost = ids.get('regime-history-host');
const axisPicks = descendants(historyHost).filter(node => node.tagName === 'button' && node.dataset.axis);
assert.deepEqual(['trend', 'breadth', 'volatility', 'credit', 'rates', 'commodities'].filter(id => !axisPicks.some(node => node.dataset.axis === id)), [], 'P1628 each populated axis must offer its dated chart');
for (const pick of axisPicks) {
  pick.listeners.click();
  const plot = descendants(historyHost).find(node => node.className === 'regime-history-plot');
  assert.ok(plot.dataset.axis === pick.dataset.axis && descendants(plot).some(node => node.tagName === 'svg') && pick.attributes['aria-pressed'] === 'true', `P1628 each populated axis must actually render a labelled history chart (${pick.dataset.axis})`);
}
axisPicks.find(node => node.dataset.axis === 'breadth').listeners.click();
const breadthPlot = descendants(historyHost).find(node => node.className === 'regime-history-plot');
const selectors = descendants(breadthPlot).filter(node => node.tagName === 'button');
selectors[1].listeners.click();
assert.equal(descendants(breadthPlot).find(node => node.className === 'regime-axis-plot').dataset.historySeries, 'breadth200', 'P1628 switching SMA50/200 must render the chosen actual series');
assert.equal(selectors[1].attributes['aria-pressed'], 'true', 'P1628 chart selection must expose its active state');
// Every axis's evidence rows and flip rule are in the one raw-table fold (data-fold-kind), one group per axis.
const rawFold = descendants(page).find(node => node.id === 'regime-raw');
assert.ok(rawFold?.tagName === 'details' && rawFold.dataset.foldKind === 'raw-table' && ['trend', 'breadth', 'volatility', 'credit', 'rates', 'commodities'].every(id => descendants(rawFold).some(node => node.dataset.rawAxis === id)), 'v60.31 the raw-table fold holds one group per axis');
// The three model-backed flows are 시장 폭's (market-structure.js), after that page's verdict; 시장 상태 draws none.
{
  const breadthPage = new Element('main');
  const anchor = new Element('section');
  breadthPage.append(anchor);
  const breadthDoc = { ...doc, getElementById: () => null };
  const section = renderMarketStructure({ documentRef: breadthDoc, root, interpretation: marketInterpretation(root), anchor });
  assert.ok(breadthPage.children[1] === section && section.id === 'regime-structure' && descendants(section).filter(node => node.dataset.scenario).length === 3, 'P1628 · the three model-backed conditional paths render on 시장 폭 after its verdict');
  assert.ok(descendants(section).some(node => node.tagName === 'details' && node.dataset.foldKind === 'method'), 'v60.36 the flows keep their one method fold');
  assert.equal(descendants(page).filter(node => node.dataset.scenario).length, 0, 'v60.36 the flows are not drawn on 시장 상태 any more');
}
// 시장 상태 reads current state then links once to 거시 for the branches by release (no compact branch block), and
// the VIX-only past-outcome table is a fold inside the volatility card, not a separate unbridged section.
assert.ok(!descendants(page).some(node => node.id === 'signal-crossroads' || String(node.className).includes('xr-compact')), 'v57.76 시장 상태 no longer repeats the 거시 branch block');
// The other screens' link (테마's '시나리오의 근거') still opens the owning view in place.
assert.ok(!descendants(page).some(node => node.tagName === 'button' && node.textContent === '다음 발표별 시나리오 전체'), 'v60.35 no separate link line to the scenarios');
{
  const shown = [];
  root.showPage = (route) => shown.push(route);
  root._aioShowPageView = (pageId, view) => shown.push([pageId, view]);
  showCrossroadsSection({ getElementById: (id) => (id === 'page-signal' ? { classList: { contains: () => true } } : null) }, root);
  assert.deepEqual(shown, [['page-signal', 'story']], 'v60.23 the scenario link activates the owning story view without navigating away');
  delete root.showPage;
  delete root._aioShowPageView;
}
const stressFolds = descendants(page).filter(node => node.id === 'regime-stress-outcomes');
assert.ok(stressFolds.length === 1 && stressFolds[0].tagName === 'details' && stressFolds[0].dataset.foldKind === 'raw-table', 'v57.76 · v60.31 the VIX past-outcome table is one raw-table fold beside the indicators');
const css = readFileSync(new URL('../src/ui/styles/regime-quality.css', import.meta.url), 'utf8');
assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') && css.includes('@media (max-width: 900px)'), 'P1628 six-axis layout must fill desktop in two columns and stack compact screens');
// P1723-P1727 (2026-10-13 market responsiveness): a rare KOSPI day reaches the briefing lead and the axis reads without
// changing any US axis state; KRX-session daily change; mixed-date FX chip; WTI 5-session rebound; one credit rule.
{
  const { buildMarketRead, koreaMoveRecord } = await import('../src/domain/briefing/market-read.js');
  const { briefingFlow } = await import('../src/domain/market/story/page-flow.js');
  const { brentWtiCheck } = await import('../src/domain/macro/liquidity-growth.js');
  const { buildScenarioOutlook } = await import('../src/domain/market/regime/scenario-outlook.js');
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
  assert.ok(/원\/달러 10\/12까지 5거래일 [+-]?\d\.\d%\(보합권\)/.test(korea.text), `P1725/P1727 the won carries its own date and a ±0.5% move is 보합권 (v58.74: 0.0% carries no sign) (${korea.text})`);
  assert.ok(!read.statements.some((row) => row.id === 'korea-day'), 'P1723 the 1-day and 5-day Korean sentences are one sentence');
  const regime = buildMarketRegime({ history: rows, now });
  const regimeCalm = buildMarketRegime({ history: calm, now });
  assert.deepEqual(regime.axes.map((row) => row.state), regimeCalm.axes.map((row) => row.state), 'P1723 a Korean shock never changes a US axis state');
  // The note was printed twice on adjacent axis cards; it now rides the volatility axis only.
  // The note is an evidence row (AXIS_KOREA_LABEL), not a sentence appended to the reading.
  const krRow = (reg, id) => reg.axes.find((row) => row.id === id).evidence.find(([label]) => label === AXIS_KOREA_LABEL)?.[1] || '';
  assert.ok(krRow(regime, 'volatility').startsWith('10/13 코스피 -6.0%') && !krRow(regime, 'trend'), 'P1723/P1746 (v60.31 row) the rare Korean move is named once, on the volatility axis');
  assert.ok(!krRow(regimeCalm, 'volatility') && !krRow(regimeCalm, 'trend'), 'P1723 (v60.31 row) an ordinary Korean day adds nothing to the US axes');
  const fxAxis = regime.axes.find((row) => row.id === 'korea');
  assert.ok(fxAxis.basisStatus === 'mixed' && fxAxis.basis === '10/12~10/13' && fxAxis.evidence.find(([label]) => label === '코스피')[1].endsWith(', 10/13'), `P1725 the won/KOSPI card shows each value's own date (${JSON.stringify(fxAxis)})`);
  const oil = regime.axes.find((row) => row.id === 'commodities');
  assert.ok(/WTI","84\.00달러 \(20일 -8\.7%, 최근 5일 \+5\.0% 반등\)/.test(JSON.stringify(oil.evidence)), `P1726 a 5-session WTI rebound is named beside the 20-session fall (${JSON.stringify(oil)})`);
  assert.equal(oil.state, regimeCalm.axes.find((row) => row.id === 'commodities').state, 'P1726 the oil wording never changes the axis state');
  const flow = briefingFlow({ read }).next;
  assert.ok(flow[0].route === 'signal' && flow[0].ctx?.anchor === 'regime-board-kr' && flow.some((item) => item.route === 'market-news' && item.ctx?.country === 'kr'), `P1727 the Korean lead continues to the 한국 시장 board first, then Korean news (${JSON.stringify(flow)})`);
  const withBrent = rows.map((row) => (row.wti != null ? { ...row, brent: row.wti + 30 } : row));
  const brent = brentWtiCheck(null, withBrent);
  assert.ok(brent.basis === 'futures' && brent.abnormal && /보류/.test(brent.sentence) && !/20거래일 기준 브렌트/.test(brent.sentence), `P1726 an abnormal Brent-WTI futures gap holds the spread reading (${brent.sentence})`);
  const spot = brentWtiCheck({ series: { brent: { observations: rows.filter((row) => row.wti != null).slice(-25).map((row) => [row.date, 120]) } } }, rows);
  assert.ok(spot.basis === 'spot' && spot.spread == null && spot.diverges === false, `P1726 FRED spot Brent is not compared with the WTI future (${JSON.stringify(spot)})`);
  // Scenario confirmation and the outlook count use one credit rule (creditState favorable).
  const neutralCredit = { ...narrow, credit: { ...narrow.credit, hyDelta20Bp: 45 } };
  const neutralRegime = buildMarketRegime(neutralCredit);
  const scenarios = buildMarketScenarios(neutralCredit, { regime: neutralRegime });
  const outlook = buildScenarioOutlook({ scenarios, regime: neutralRegime });
  assert.equal(neutralRegime.axes.find((row) => row.id === 'credit').state, 'neutral', 'P1727 fixture: a 20-session widening makes credit neutral');
  assert.ok(scenarios.scenarios.find((item) => item.id === 'concentration').confirmed === false && outlook.items.find((item) => item.id === 'concentration').met === 4 && outlook.items.find((item) => item.id === 'concentration').total === 5, 'P1727 (v57.81: 5th check 주도 영역 유지) a neutral credit axis neither confirms 소수 종목 주도 nor counts as 신용 안정');
}
{
  // Verdict rules — the rates speed leg, the volatility latch with a level floor on the spike leg, and the
  // overall label as a function of the net count.
  const { overallLabel, buildMarketRead } = await import('../src/domain/briefing/market-read.js');
  const axisOf = (rows, id) => buildMarketRegime({ ...input, history: rows }).axes.find((row) => row.id === id);
  // The leg that holds a state is the 판정 사유 row (fixed vocabulary), not a sentence.
  const reasonOf = (axis) => axis?.evidence?.find(([label]) => label === AXIS_REASON_LABEL)?.[1] || '';
  // `path` is laid on the last sessions so that path[step] is the latest close; earlier sessions keep `before`.
  const laid = (field, path, step, before, extra = {}) => history.map((row, index) => {
    const at = step - (history.length - 1 - index);
    return { ...row, ...extra, [field]: at >= 0 ? path[at] : typeof before === 'function' ? before(index) : before };
  });
  // Rates: a year high at 4.50, a slide to 3.85, then +28bp in five sessions — the 20-session change is small and the
  // level is mid-range, so only the five-session leg can read it.
  const slide = Array.from({ length: 15 }, (_, k) => 4.1 - 0.25 * (k + 1) / 15);
  const jump = [1, 2, 3, 4, 5].map((k) => Number((3.85 + 0.056 * k).toFixed(3)));
  const ratePath = [...slide, ...jump, ...Array(6).fill(jump.at(-1))];
  const ratesAt = (step) => axisOf(laid('tnx', ratePath, step, (index) => index < 100 ? 4.5 : 4.1), 'rates');
  const shock = ratesAt(19), shockHeld = ratesAt(22), shockOver = ratesAt(25);
  assert.ok(shock.state === 'burden' && shock.shock?.now === true && /^5거래일 급등 \(/.test(reasonOf(shock)) && /5거래일 \+28bp/.test(JSON.stringify(shock.evidence)) && /5거래일 상승이 \+10bp 아래로 줄면/.test(shock.flip) && /\+15bp 이상이면 부담/.test(JSON.stringify(shock.evidence)),
    `v60.16 (v60.31 reason row) a five-session +28bp rise is 부담 on a small 20-session change and names its leg: ${shock.state} ${reasonOf(shock)} | ${shock.flip}`);
  assert.ok(shock.flipDistance?.toward === 'neutral' && shock.flipDistance.value === -18, `v60.16 the speed leg's exit is the nearest flip (5 sessions ago +10bp): ${JSON.stringify(shock.flipDistance)}`);
  assert.ok(shockHeld.state === 'burden' && shockHeld.shock?.now === false && /^5거래일 급등 부담 유지 \(\d+\/\d+부터\)$/.test(reasonOf(shockHeld)), `v60.16 (v60.31 reason row) the speed leg holds until the rise is under +10bp: ${shockHeld.state} ${reasonOf(shockHeld)}`);
  assert.ok(shockOver.state === 'neutral' && shockOver.shock === null && /5거래일 \+15bp 이상\(자체 기록 상위 5%\)/.test(shockOver.flip) && /1년 범위 90% 이상에서 5일 상승/.test(shockOver.flip), `v60.16 the speed leg releases and the 중립 flip names all three legs: ${shockOver.state} ${shockOver.flip}`);
  // The rates axis reports the leg that decided it, and the 매크로 headline, chain node, chain
  // sentence and legend render from that one object — a 5-session +29bp 부담 was headed '10년물 20거래일 +5bp'.
  {
    const { buildMacroRead } = await import('../src/domain/macro/macro-read.js');
    const shockRows = laid('tnx', ratePath, 19, (index) => index < 100 ? 4.5 : 4.1);
    const regime = buildMarketRegime({ ...input, history: shockRows });
    const rates = regime.axes.find((row) => row.id === 'rates');
    assert.ok(rates.decidedBy?.leg === 'speed' && rates.decidedBy.d5 === rates.shock.d5 && rates.decidedBy.line === rates.shock.enterBp && rates.decidedBy.held === false,
      `v60.18 the rates verdict returns the leg that decided it: ${JSON.stringify(rates.decidedBy)}`);
    const read = buildMacroRead({ regime, history: shockRows });
    const tile = read.axes.find((row) => row.id === 'rates');
    const chain = (await import('../src/domain/macro/macro-chain.js')).buildMacroChain({ regime, history: shockRows });
    const node = chain.nodes.find((row) => row.id === 'rates');
    const d5 = `+${Math.round(rates.shock.d5)}bp`;
    assert.ok(tile.state === 'burden' && tile.headline === `10년물 5거래일 ${d5}` && /5거래일 변화/.test(tile.gauge?.label || ''),
      `v60.18 the 매크로 rates headline names the 5-session leg that decided 부담: ${tile.headline} | ${tile.gauge?.label}`);
    assert.ok(node.value === `5거래일 ${d5}` && node.dir === 'up' && chain.links.some((line) => line.startsWith(`10년물 5거래일 ${d5}(20거래일 `)),
      `v60.18 the chain node and its sentence read the same leg: ${node.value} ${node.dir} | ${chain.links.join(' / ')}`);
    assert.ok(new RegExp(`10년물 20일 ±25bp 또는 5거래일 \\+${Math.round(rates.decidedBy.shockAt)}bp 이상`).test(chain.legend),
      `v60.18 the chain legend names the 5-session leg, not only the 20-session rule: ${chain.legend}`);
    const calm = buildMacroRead({ regime: buildMarketRegime({ ...input, history: laid('tnx', ratePath, 25, (index) => index < 100 ? 4.5 : 4.1) }), history: shockRows });
    assert.ok(/^10년물 20거래일 /.test(calm.axes.find((row) => row.id === 'rates').headline || ''), 'v60.18 a 중립 rates tile still reads the 20-session change');
  }
  const heldRange = axisOf(laid('tnx', [4.5, 4.52, 4.54, 4.56, 4.58, 4.6, 4.59, 4.58, 4.57, 4.56], 9, 4.3), 'rates');
  assert.ok(heldRange.state === 'burden' && /1년 범위 90% 이상에서는 5일 상승이 멈추고/.test(heldRange.flip), `v60.16 the 부담 flip names the range-position leg: ${heldRange.flip}`);
  // Volatility: +39% in five sessions to 19.5 is under the floor; to 21 it is 부담 and holds while the spike is not unwound.
  const calmBase = { vix3m: 23 };
  const volAt = (path, step) => axisOf(laid('vix', path, step, 14, calmBase), 'volatility');
  const lowSpike = volAt([15, 16, 17, 19, 19.5], 4);
  assert.ok(lowSpike.state === 'neutral' && /^5거래일 급등, 수준은 급등 기준 아래/.test(reasonOf(lowSpike)), `v60.16 (v60.31 reason row) a five-session spike that ends under VIX 20 is not 부담: ${lowSpike.state} ${reasonOf(lowSpike)}`);
  const spikePath = [15, 16, 17, 19, 21, 19.5, 19.4];
  const [spikeOn, spikeHeld, spikeOff] = [4, 5, 6].map((step) => volAt(spikePath, step));
  assert.ok(spikeOn.state === 'burden' && /^5거래일 급등, 급등 기준 수준 이상/.test(reasonOf(spikeOn)), `v60.16 (v60.31 reason row) a five-session spike at or above VIX 20 is 부담: ${spikeOn.state} ${reasonOf(spikeOn)}`);
  assert.ok(spikeHeld.state === 'burden' && /^부담 유지\(해제 조건 미충족\) \(\d+\/\d+부터\)$/.test(reasonOf(spikeHeld)) && /VIX 20 미만/.test(spikeHeld.flip), `v60.16 (v60.31 reason row) 부담 holds at 19.5 while the five-session rise is still +25%: ${spikeHeld.state} ${reasonOf(spikeHeld)}`);
  assert.equal(spikeOff.state, 'neutral', 'v60.16 the volatility 부담 lets go once VIX is under 20 and the spike is unwound');
  const marketRead = readFileSync(new URL('../src/domain/briefing/market-read.js', import.meta.url), 'utf8');
  assert.ok(!/vix5 >= 25\b/.test(marketRead) && !/VIX 25 이상 — 경계/.test(marketRead), 'v60.16 the volatility read takes its lines from RULES.volatility, not literals');
  // Overall label: equal net counts read the same; a confirmed break is one 부담, a held-over one is not.
  const holding = { state: 'holding' }, confirmed = { state: 'break', break: true, held: false }, heldOver = { state: 'break', break: true, held: true };
  const label = (favorable, burden, leadership = holding) => overallLabel(favorable, burden, leadership).overall;
  assert.deepEqual([label(2, 4), label(4, 2), label(0, 3), label(3, 0), label(1, 2), label(3, 3), label(4, 1)], ['다소 부담', '다소 양호', '부담 우세', '양호 우세', '혼조', '혼조', '양호 우세'], 'v60.16 the overall label is a function of the net count');
  for (let favorable = 0; favorable <= 6; favorable += 1) for (let burden = 0; burden + favorable <= 6; burden += 1) {
    const mirror = { '부담 우세': '양호 우세', '다소 부담': '다소 양호', '혼조': '혼조', '다소 양호': '다소 부담', '양호 우세': '부담 우세' };
    assert.equal(label(favorable, burden), mirror[label(burden, favorable)], `v60.16 the overall label is symmetric at ${favorable}/${burden}`);
  }
  assert.deepEqual([label(1, 2, confirmed), label(1, 2, heldOver), label(1, 3, confirmed), label(4, 1, heldOver), label(4, 0, confirmed), label(4, 1, { state: 'weak' })], ['다소 부담', '혼조', '부담 우세', '혼조', '혼조', '혼조'],
    'v60.16 a confirmed leadership break counts as one 부담; weak or broken leaders still cap a favourable label at 혼조');
  // Briefing: a week's rate dip inside a 20-session rise is not read as rates supporting stocks.
  const dipRead = (before) => buildMarketRead({ ...input, history: laid('tnx', [4.3, 4.3, 4.3, 4.3, 4.3, 4.28, 4.26, 4.24, 4.22, 4.2], 9, before) }).statements.find((row) => row.id === 'rates-down-stocks-up')?.reading;
  assert.ok(/20거래일로는 금리가 \+10bp라/.test(dipRead(4.1)) && dipRead(4.3) === '금리 하락이 주가를 받치는 모습입니다.', `v60.16 rates-down-stocks-up checks the 20-session direction: ${dipRead(4.1)} | ${dipRead(4.3)}`);
}
console.log('[regime-scenarios] PASS P1628: six actual charts, conditional recovery/concentration/weakness, missing/stale holds, units/date bounds, KR holiday/KST separation, chart selection; P1723-P1727 Korean shock lead/axis notes, KRX daily change, mixed-date chip, WTI rebound, Brent hold, one credit rule. Offline.');
