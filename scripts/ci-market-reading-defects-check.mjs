#!/usr/bin/env node
// v60.50 (whole audit 2026-11-23, thread market-reading-defects): fixed market sentences that did not read the current state —
// the sign of the move, the session date, what had already happened. Each assertion below failed on the v60.49 code and
// passes on the fix. Real rows frozen from public-data/history.json and macro-history.json through 11/23 (v60.51,
// scripts/fixtures/reading-defects/market-rows.json); the market-day facts are the published 11/20 values written inline.
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

// v60.51 (check-fixtures): these are rule assertions, so they read history and macro-history rows frozen from the
// 2026-11-24 artifacts through 11/23 (scripts/fixtures/reading-defects/market-rows.json). v60.50 read the live files: the
// HY spread moved 352→376bp and the 11/23 row filled in within hours, and the rolling 14-month window would have dropped
// the early rows the 20/50/200-session reads stand on.
const FROZEN = JSON.parse(read('scripts/fixtures/reading-defects/market-rows.json'));
const history = readHistoryRows(FROZEN.history);
const macroHistory = FROZEN.macroHistory;
const through = (date) => history.filter((row) => String(row.date) <= date);
const has = (date) => history.some((row) => row.date === date);
if (!has('2026-11-20') || !has('2026-11-23')) failures.push('v60.51 fixture: market-rows.json does not hold the 11/20 and 11/23 rows these checks read');
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
  // Exact again on the frozen rows (11/20 HY 3.76, five sessions after 3.23 on 11/13).
  check('v60.50 B13: on 11/20 the credit condition reads as met (HY 5거래일 +53bp, 부담)', /하이일드 스프레드도 부담 쪽이라\(5거래일 \+53bp, 20거래일 \+38bp\)/.test(text), text);
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

// B22 — the session that set the low says so; no rebound is implied. v60.52 (owner 2026-11-24): the low is day 0, the
// count starts the next session.
{
  const rally = rallyAttemptRead(at1120);
  check('v60.50 B22: 11/20 (new closing low) is not "반등 시도 1일째"', rally?.day === 0 && !/반등 시도 1일째/.test(rally?.state || ''), rally?.state);
  check('v60.50 B22: the low day says the low was set that day', /^11\/20 새 저점 — 반등 일수는 다음 거래일부터$/.test(rally?.state || '') && /반등은 아직 없습니다/.test(rally?.plain || ''), `${rally?.state} / ${rally?.plain}`);
}

// v60.52 rally count (owner 2026-11-24): day 1 is the session after the low. Low close 11/20, 11/26 holiday: 11/23 day 1,
// 11/24 day 2, 11/25 day 3, 11/27 day 4 — the earliest follow-through. The v1 count reached day 4 on 11/25.
{
  const { rallyAttemptSeries, RALLY_COUNT_MODEL } = await import('../src/domain/market/regime/rally-attempt.js');
  const warm = Array.from({ length: 70 }, (_, i) => ({ date: new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10), close: 100, volume: 1000 }));
  const tail = [['2026-11-18', 96, 1000], ['2026-11-19', 94, 1000], ['2026-11-20', 90, 1000], ['2026-11-23', 91, 1000], ['2026-11-24', 91.5, 1000], ['2026-11-25', 93.4, 2000], ['2026-11-27', 95.3, 3000]]
    .map(([date, close, volume]) => ({ date, close, volume }));
  const series = rallyAttemptSeries([...warm, ...tail]);
  const on = (date) => series.find((point) => point.date === date);
  check('v60.52 rally count: 11/20 low is day 0, 11/23 day 1, 11/27 day 4', [on('2026-11-20')?.day, on('2026-11-23')?.day, on('2026-11-25')?.day, on('2026-11-27')?.day].join() === '0,1,3,4', JSON.stringify(tail.map((bar) => on(bar.date)?.day)));
  check('v60.52 rally count: +2.08% on rising volume on 11/25 (day 3) is not a follow-through; 11/27 (day 4) is',
    on('2026-11-25')?.followThrough === false && on('2026-11-27')?.followThrough === true, JSON.stringify([on('2026-11-25'), on('2026-11-27')]));
  const stamped = (model) => through('2026-11-23').map((row) => (row.rallyPhase == null ? row : { ...row, fieldMeta: { ...(row.fieldMeta || {}), rallyPhase: { ...(row.fieldMeta?.rallyPhase || {}), model } } }));
  check('v60.52 rally count: rows counted under another definition are withheld until the producer rewrites them',
    rallyAttemptRead(stamped(undefined)) === null && rallyAttemptRead(stamped('rally-attempt.v1')) === null && rallyAttemptRead(stamped(RALLY_COUNT_MODEL))?.day === 1,
    JSON.stringify(rallyAttemptRead(stamped(RALLY_COUNT_MODEL))?.state));
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

// v60.52 rebound terms — on 11/23 the story (나스닥 100, +5% off the low) and the follow-through count (나스닥 종합)
// both read "반등 시도". The count is named by what it counts, states its base low and rule on the face, names the story's
// index beside it when both are present, and says when its volume test compared an early-close session.
{
  const strip = await import('../src/ui/components/distribution-strip.js');
  const words = await import('../src/domain/content/rebound-words.js').catch(() => ({}));
  const rally = rallyAttemptRead(through('2026-11-23'));
  const faceOf = (rebound) => { const doc = createFakeDocument(); const part = strip.rallyAttemptStrip(doc, through('2026-11-23'), '2026-11-23', { rebound }); return part?.textContent || ''; };
  const story = { word: '반등 시도', low: { date: '2026-11-20', value: 25029 } };
  const withStory = faceOf(story), alone = faceOf(null);
  check('v60.52 rebound terms: the follow-through count never says 반등 시도', rally && !/반등 시도/.test(`${rally.state} ${rally.plain} ${rally.rule}`) && !/반등 시도/.test(alone), `${rally?.state} / ${alone}`);
  check('v60.52 rebound terms: label names the signal and the index', alone.startsWith('반등 확인 신호(FTD) · 나스닥 종합') && words.FOLLOW_THROUGH_WORDS?.label === '반등 확인 신호(FTD) · 나스닥 종합', alone);
  check('v60.52 rebound terms: 11/23 state counts from the session after the low', rally?.state === '저점(11/20) 뒤 1일째, 확인 전', rally?.state);
  check('v60.52 rebound terms: the face states the base low and the rule in one line',
    /저점 11\/20\(종가 22,617\.73\) 다음 거래일을 1일째로 세어 4일째부터 하루 \+1\.25% 이상·거래량 전일보다 많으면 확인/.test(alone), alone);
  check('v60.52 rebound terms: with the story present, one line names both indexes and that they can disagree',
    /시장 해석의 '반등 시도'는 나스닥 100 11\/20 저점 기준, 이 신호는 나스닥 종합 저점\(11\/20\) 뒤 1일째 — 지수와 규칙이 달라 엇갈릴 수 있습니다\./.test(withStory), withStory);
  check('v60.52 rebound terms: no relation line without the story', !/시장 해석의/.test(alone), alone);
  // Early close (NYSE half day 11/27): the tested session or the one before it.
  const row = (date, day, phase = 1) => ({ date, nasdaq: 100 + day, rallyPhase: phase, rallyDay: day, followThroughDay: 0 });
  const rows = [row('2026-11-19', 0), row('2026-11-20', 1), row('2026-11-23', 2), row('2026-11-24', 3), row('2026-11-25', 4), row('2026-11-27', 5), row('2026-11-30', 6)];
  const at = (date) => rallyAttemptRead(rows, { through: date });
  check('v60.52 rebound terms: an early-close session in the volume test is flagged (tested 11/27, or 11/30 against 11/27), not 11/25',
    at('2026-11-27')?.shortSession === '2026-11-27' && at('2026-11-30')?.shortSession === '2026-11-27' && at('2026-11-25')?.shortSession === null,
    JSON.stringify([at('2026-11-27')?.shortSession, at('2026-11-30')?.shortSession, at('2026-11-25')?.shortSession]));
  const shortFace = strip.rallyAttemptStrip(createFakeDocument(), rows, '2026-11-27')?.textContent || '';
  check('v60.52 rebound terms: the strip says the comparison is against a shortened session', /11\/27 조기 폐장 — 거래량 비교가 짧은 거래일 기준입니다\./.test(shortFace), shortFace);
  const chart = marketCharts.indexVolumeRead(through('2026-11-23'), 'ndx')?.text || '';
  check('v60.52 rebound terms: 기술적 분석 volume line uses the same words', chart === '거래량: 반등 확인 신호(FTD) · 나스닥 종합 저점(11/20) 뒤 1일째, 확인 전', chart);
  // "바닥 확인" promised a confirmed bottom; no screen or AI line builder says it any more (research notes and glossary aliases aside).
  const said = ['src/domain/market/regime/rally-attempt.js', 'src/ui/components/distribution-strip.js', 'src/domain/market/story/market-story.js', 'src/ui/components/market-story.js',
    'src/domain/technical/market-charts.js', 'src/domain/briefing/market-read.js', 'src/ui/components/sentiment-board.js', 'src/domain/guide/lessons.js']
    .filter((file) => /바닥 확인/.test(read(file).split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n')));
  check('v60.52 rebound terms: no 바닥 확인 in the rebound and bottom-watch text builders', said.length === 0, said.join(', '));
}

if (failures.length) {
  console.error(`market reading defects: ${failures.length} failed, ${passed} passed`);
  for (const line of failures) console.error(`  FAIL ${line}`);
  process.exit(1);
}
console.log(`market reading defects: ${passed} checks passed`);
