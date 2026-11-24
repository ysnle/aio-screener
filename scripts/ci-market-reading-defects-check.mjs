#!/usr/bin/env node
// v60.50 (whole audit 2026-11-23, thread market-reading-defects): fixed market sentences that did not read the current state —
// the sign of the move, the session date, what had already happened. Each assertion below failed on the v60.49 code and
// passes on the fix. Real rows from public-data/history.json through a fixed session (11/20 or 11/23) where practical;
// the market-day facts are the published 11/20 values written inline (that file is replaced every refresh).
//   node scripts/ci-market-reading-defects-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crossReadings } from '../src/domain/market/regime/cross-readings.js';
// Namespace imports: a missing export fails its own assertion instead of the whole run (so the file reports on old code too).
import * as depth from '../src/domain/market/regime/depth-readouts.js';
import * as scenarioLeadModule from '../src/domain/market/regime/scenario-lead.js';
import { buildScenarioOutlook } from '../src/domain/market/regime/scenario-outlook.js';
import { rallyAttemptRead } from '../src/domain/market/regime/rally-attempt.js';
import { chapterToday } from '../src/domain/macro/macro-chapters.js';
import * as marketCharts from '../src/domain/technical/market-charts.js';
import { describeOtherFx, renderRatesFxBoard } from '../src/ui/components/macro-board.js';
import { createFakeDocument } from './lib/fake-dom.mjs';
import { writeSectorHero } from '../src/ui/pages/themes/sectors.js';
import { readHistoryRows } from '../src/domain/market/indices/history-rows.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
let passed = 0;
const check = (label, ok, detail = '') => { if (ok) passed += 1; else failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };

const history = readHistoryRows(JSON.parse(read('public-data/history.json')));
const macroHistory = JSON.parse(read('public-data/macro-history.json'));
const through = (date) => history.filter((row) => String(row.date) <= date);
const has = (date) => history.some((row) => row.date === date);
if (!has('2026-11-20') || !has('2026-11-23')) failures.push('v60.50 fixture: public-data/history.json no longer holds the 11/20 and 11/23 rows these checks read');
const at1120 = through('2026-11-20');
// The Korea-only day: 11/23 as it stood after Seoul closed and before New York opened — KOSPI and KOSDAQ are that
// day's closes, every other field is the 11/20 close carried forward. Built here so later sessions do not change it.
const koreaOnlyDay = (() => {
  const prior = history.find((row) => row.date === '2026-11-20') || {};
  const real = history.find((row) => row.date === '2026-11-23') || {};
  const carried = Object.fromEntries(Object.entries(prior.fieldMeta || real.fieldMeta || {}).map(([field, meta]) => [field, { ...meta, observationRelation: 'carried-forward', valueBasis: 'previous-completed-close', sessionDate: '2026-11-20', observedAt: '2026-11-20T23:00:00.000Z' }]));
  return { ...prior, date: '2026-11-23', kospi: real.kospi, kosdaq: real.kosdaq, fieldMeta: { ...carried, kospi: real.fieldMeta?.kospi, kosdaq: real.fieldMeta?.kosdaq } };
})();
const at1123 = [...at1120, koreaOnlyDay];
const reading = (rows, id) => crossReadings({ history: rows, macroHistory }).find((item) => item.id === id) || null;

// Synthetic weekday rows (2026 NYSE sessions) for the branches the record does not reach.
function sessions(n, start = '2026-06-01') {
  const out = [];
  for (let t = Date.parse(`${start}T12:00:00Z`); out.length < n; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6 && !['2026-06-19', '2026-07-03', '2026-09-07'].includes(date)) out.push(date);
  }
  return out;
}
function gapRows({ spxEnd, rspEnd, breadth }) {
  const dates = sessions(80);
  return dates.map((date, i) => {
    const k = Math.max(0, i - 59) / 20; // flat for 60 sessions, then a straight move over the last 20
    return { date, spx: 100 * (1 + (spxEnd / 100) * k), rsp: 50 * (1 + (rspEnd / 100) * k), breadth50: breadth };
  });
}

// A3 — the equal-weight gap reads with the direction of both indexes, and agrees with the breadth sentence before it.
{
  const text = reading(at1120, 'trend-breadth')?.text || '';
  check('v60.50 A3: a fall of both indexes (S&P 500 -9.4%, 동일가중 -4.2%) is not read as a broadening rise', !/상승이 대형주 밖으로 넓어졌/.test(text), text);
  check('v60.50 A3: 11/20 names both 20-session moves and says the fall was heavier in large caps', /S&P 500 -9\.4%, 동일가중 -4\.2%/.test(text) && /낙폭은 대형주에서 더 컸습니다/.test(text), text);
  check('v60.50 A3: the breadth sentence no longer contradicts the cap-weight gap', !/대형주 몇 곳의 문제가 아닙니다/.test(text), text);
  const fallEqualMore = reading(gapRows({ spxEnd: -3, rspEnd: -8, breadth: 30 }), 'trend-breadth')?.text || '';
  check('v60.50 A3 mirror: equal weight falling more is not called "대형주 쏠림"', /낙폭은 대형주 밖에서 더 컸습니다/.test(fallEqualMore) && !/대형주 쏠림이 더 심해/.test(fallEqualMore), fallEqualMore);
  const riseEqualMore = reading(gapRows({ spxEnd: 2, rspEnd: 7, breadth: 50 }), 'trend-breadth')?.text || '';
  check('v60.50 A3: in a rise, equal weight ahead still reads as broadening', /상승이 대형주 밖으로 넓어졌습니다/.test(riseEqualMore), riseEqualMore);
}

// B7 — the Korea pair reads KOSPI and the won on the same date; a later KOSPI session is named apart.
{
  const korea = reading(at1123, 'korea-won');
  const text = korea?.text || '';
  check('v60.50 B7: the 11/23 KOSPI day is not paired with the won\'s 11/20 close', !/코스피 하루 -3\.3%, 원\/달러/.test(text), text);
  check('v60.50 B7: the pair is 11/20 against 11/20 and the 11/23 KOSPI move stands alone', /^11\/20 코스피 하루 -5\.2%, 원\/달러 \+0\.9%/.test(text) && /11\/23 코스피는 하루 -3\.3%/.test(text) && korea?.asOf === '2026-11-20', `${korea?.asOf} ${text}`);
}

// B9 — the Zweig figure is a 10-day exponential average and says so.
{
  const text = depth.depthReadout({ history: at1120, macroHistory })?.text || '';
  check('v60.50 B9: the Zweig EMA is named 10일 지수이동평균, not the breadth screen\'s simple 10일 평균', /상승 종목 비율 10일 지수이동평균/.test(text) && !/10일 평균이/.test(text), text.slice(0, 120));
}

// B10 — the order and its heading come from one domain owner.
{
  const { orderedScenarios, SCENARIO_ORDER_LABEL } = scenarioLeadModule;
  check('v60.50 B10: scenario-lead.js owns the list order and its heading', typeof orderedScenarios === 'function' && typeof SCENARIO_ORDER_LABEL === 'string');
  if (typeof orderedScenarios === 'function') {
    const item = (id, met, total, gate) => ({ id, title: id, met, total, known: total, gate: { met: gate }, conditions: [], fit: `${met}/${total}` });
    const model = { available: true, held: true, leadId: null, altId: null, items: [item('ungated', 2, 4, false), item('gated', 1, 4, true)] };
    const order = orderedScenarios(model).items.map((row) => row.id).join(',');
    // The 시장 상태 scenario heading is built from SCENARIO_ORDER_LABEL (macro-crossroads.js), so the label is the heading.
    check('v60.50 B10: a met core condition comes first and the heading says so', order === 'gated,ungated' && /핵심 조건/.test(SCENARIO_ORDER_LABEL), `${order} / ${SCENARIO_ORDER_LABEL}`);
  }
}

// B13 — no uncounted "반등이 자주"; the credit condition reads the credit judgement of the same close.
{
  const text = reading(at1120, 'volatility-sentiment')?.text || '';
  check('v60.50 B13: the stress-and-fear pair makes no uncounted frequency claim', !/자주/.test(text), text);
  check('v60.50 B13: on 11/20 the credit condition reads as met (HY 5거래일 widening, 부담)', /하이일드 스프레드도 부담 쪽이라.5거래일 \+\d+bp/.test(text), text);
}

// B15 — the transition's confirmation says which weakness conditions are met and which remain.
{
  const outlook = buildScenarioOutlook({
    scenarios: { available: true, held: false, asOf: '2026-11-20', scenarios: [{ id: 'expansion' }, { id: 'concentration' }, { id: 'weakness', confirmed: false }] },
    regime: { available: true, axes: [{ id: 'trend', state: 'burden' }, { id: 'breadth', state: 'neutral' }, { id: 'credit', state: 'burden' }, { id: 'volatility', state: 'burden' }],
      leadership: { state: 'broken', break: true, summary: 'SOXX 50일선 아래', met: 2, confirmations: [1, 2] } }
  });
  const posture = outlook.items?.find((row) => row.transition)?.posture || '';
  check('v60.50 B15: a confirmation already met is not written as a future condition', !/추세가 부담으로 바뀌거나/.test(posture), posture);
  check('v60.50 B15: met and remaining weakness conditions are named', /추세 부담, 신용 또는 변동성 부담은 이미 충족, 남은 조건은 시장 폭 부담입니다/.test(posture), posture);
}

// B19 — a completed session's move is labelled with its date, not 오늘.
{
  const day = { facts: [{ id: 'price:gold:2026-11-20', kind: 'price', asset: 'gold', label: '금', date: '2026-11-20', change: -4.6154, changeUnit: 'pct', unit: 'pct', z: -3.31, rank: 'lead' }], links: [] };
  const today = chapterToday(day, 'metals');
  check('v60.50 B19: the 금 -4.6% line is labelled 11/20 and says 이날, not 오늘', today?.label === '11/20' && !/오늘/.test(today?.text || ''), JSON.stringify(today));
  const movers = { facts: [{ kind: 'stock-move', rank: 'lead', date: '2026-11-20', subjects: ['NVDA'] }, { kind: 'stock-move', rank: 'major', date: '2026-11-20', subjects: ['MU'] }] };
  check('v60.50 B19: 기술적 분석 names the movers\' session', typeof marketCharts.stockGroupLabels === 'function' && marketCharts.stockGroupLabels(movers).mover === '11/20 크게 움직인 종목', String(marketCharts.stockGroupLabels?.(movers)?.mover));
}

// B22 — the session that set the low is day 1 and says so; no rebound is implied.
{
  const rally = rallyAttemptRead(at1120);
  check('v60.50 B22: 11/20 (new closing low) is not "반등 시도 1일째"', rally?.day === 1 && !/반등 시도 1일째/.test(rally?.state || ''), rally?.state);
  check('v60.50 B22: day 1 says the low was set that day', /11\/20 새 저점/.test(rally?.state || '') && /반등은 아직 없습니다/.test(rally?.plain || ''), `${rally?.state} / ${rally?.plain}`);
}

// B18 — one word for the stock–bond correlation on both screens.
{
  check('v60.50 B18: -0.06 over 60 sessions is 뚜렷한 관계 없음 at the ±0.26 band', depth.stockBondCorrelationWord?.(-0.06, 60) === '뚜렷한 관계 없음(±0.26 안은 표본 오차)');
  const doc = createFakeDocument();
  renderRatesFxBoard({ documentRef: doc, root: { _aioHistory: at1120 } });
  const assets = doc.getElementById('rates-assets').textContent;
  check('v60.50 B18: 자산군 (11/20) reads the same word and band as 시장 상태',
    assets.includes('S&P 500과 미 장기채의 최근 60거래일 상관은 -0.06 — 뚜렷한 관계 없음(±0.26 안은 표본 오차).'), assets.slice(0, 200));
}

// A4 — a currency without a live quote shows its own last close, dated.
{
  const fx = describeOtherFx({ 'EURUSD=X': { price: 1.16, observedAt: '2026-11-23T13:00:00Z' } }, at1123, Date.parse('2026-11-23T13:30:00Z'));
  const cell = (symbol) => fx.closes?.[symbol];
  check('v60.50 A4: with EUR/USD live, GBP/USD, USD/CNY and AUD/USD fall back to their 11/20 closes',
    cell('GBPUSD=X')?.value === 1.3082 && cell('GBPUSD=X')?.date === '2026-11-20' && cell('AUDUSD=X')?.value === 0.6619 && cell('CNY=X')?.date === '2026-11-20' && !cell('EURUSD=X'), JSON.stringify(fx.closes));
}

// Themes summary — 모두 when every sector moved the same way.
{
  const hero = (pcts) => {
    const nodes = { 'rrg-rotation-read': { dataset: {}, textContent: '' }, 'rrg-rotation-detail': { hidden: false, textContent: '' } };
    writeSectorHero({ getElementById: (id) => nodes[id] || null }, {}, pcts.map((pct, i) => ({ label: `S${i}`, pct })), '1주');
    return nodes['rrg-rotation-read'].textContent;
  };
  const allDown = hero(Array.from({ length: 11 }, (_, i) => -1 - i * 0.3));
  check('v60.50 themes: "11개 섹터가 대부분 내렸고" becomes 모두 when all 11 fell', /11개 섹터가 모두 내렸고/.test(allDown), allDown);
  const mostlyDown = hero([0, ...Array.from({ length: 10 }, (_, i) => -1 - i * 0.3)]);
  check('v60.50 themes: 대부분 stays when one sector was flat', /11개 섹터가 대부분 내렸고/.test(mostlyDown), mostlyDown);
}

if (failures.length) {
  console.error(`market reading defects: ${failures.length} failed, ${passed} passed`);
  for (const line of failures) console.error(`  FAIL ${line}`);
  process.exit(1);
}
console.log(`market reading defects: ${passed} checks passed`);
