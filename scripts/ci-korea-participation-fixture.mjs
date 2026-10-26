#!/usr/bin/env node
// Korea market participation and investor flows. v58.84 gate consolidation: the sections below were separate gates until v58.84. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('korea-participation-fixture', [
// ── section korea-participation (was ci-korea-participation-fixture.mjs) ──
['korea-participation', async () => {
// P1628: Korean sessions, sample denominators, currency-independent participation and missingness.
const { default: assert } = await import('node:assert/strict');
const { buildKoreaParticipation } = await import('../src/domain/market/korea-participation.js');
const rows=[{sym:'005930.KS',factorSessionDate:'2026-10-08',pctSma50:3,pctSma200:-2,ret1m:2,ret3m:6},
 {sym:'000660.KS',factorSessionDate:'2026-10-08',pctSma50:-3,pctSma200:2,ret1m:4,ret3m:10},
 {sym:'NVDA',factorSessionDate:'2026-10-09',pctSma50:20,ret3m:90},
 {sym:'042700.KS',factorSessionDate:'2026-10-09',pctSma50:20,ret3m:90}];
const model=buildKoreaParticipation({rows,nowMs:Date.parse('2026-10-11T18:00:00Z')});
assert.equal(model.date,'2026-10-08','P1628 Hangul holiday cannot be a Korean completed close');
assert.equal(model.observed,2,'P1628 US and invalid-session Korean rows are excluded');
assert.equal(model.breadth50.pct,50,'P1628 missing/cross-market rows cannot change Korean denominator');
assert.equal(model.returns.ret3m,8,'P1628 Korean returns use the same session sample');
assert.equal(buildKoreaParticipation({rows:[],nowMs:Date.parse('2026-10-11T18:00:00Z')}).available,false,'P1628 absent Korean rows generate no market numbers');
assert.ok(model.missing.includes('외국인·기관 순매수'),'P1628 FX direction is not invented institutional flow');
// P1723: the index day beside the same-session sample median, and the largest-traded names beside an equal-weight median.
{
  const { heavyweightLine } = await import('../src/domain/themes/group-strength.js');
  const sample = Array.from({ length: 30 }, (_, i) => ({ sym: `${String(100000 + i)}.KS`, factorSessionDate: '2026-10-13', pctSma50: i % 2 ? 1 : -1, pctSma200: 1, ret1m: 15, ret3m: 20,
    ret1d: i < 2 ? -9 : i < 8 ? -4 : -1, ret5d: -6, dollarVolume30d: i < 2 ? 5e9 : i === 2 ? 1e9 : 1e7 }));
  sample[0].ret1m = -18; sample[1].ret1m = -12; sample[2].ret1m = 1;
  const themes = { semi: sample.slice(0, 8).map((row) => ({ code: row.sym.slice(0, 6) })) };
  const shock = buildKoreaParticipation({ rows: sample, themes, nowMs: Date.parse('2026-10-13T09:00:00Z'), index: { date: '2026-10-13', d1: -5.46, d5: -13.8 } });
  assert.equal(shock.session.ret1d, -1, 'P1723 the sample 1-day median comes from the same session');
  assert.equal(shock.session.down3, 8, 'P1723 members down 3% or more are counted');
  // v57.81: every member fell, so the spread is read first; the size gap still names the large caps (pin "몰린 것으로 보입니다" -> "더 몰렸습니다").
  assert.match(shock.session.text, /^코스피 10\/13 -5\.5% vs AIO 추적 종목\(한국\) 30개 하루 수익률 중앙값 -1\.0%.*표본 전반으로 번진 하락입니다 — 지수 하락 폭이 표본 중앙값보다 훨씬 커 시가총액이 큰 종목에 하락이 더 몰렸습니다\. 5거래일은 지수 -13\.8%, 표본 중앙값 -6\.0%로, /, `P1723 index vs sample sentence (${shock.session.text})`);
  const other = buildKoreaParticipation({ rows: sample, themes, nowMs: Date.parse('2026-10-13T09:00:00Z'), index: { date: '2026-10-12', d1: -3 } });
  assert.ok(!/코스피/.test(other.session.text), 'P1723 an index close from another session is never set against the sample');
  const semi = shock.groups.find((group) => group.themeId === 'semi');
  const line = heavyweightLine(semi);
  assert.ok(/거래대금 상위 3종목의 1개월 수익률 중앙값은 -12\.0%/.test(line) && /동일가중 테마 중앙값 \+15\.0%와 방향이 반대입니다/.test(line), `P1723 the largest-traded names are not hidden by the median (${line})`);
}
// v57.81 (analysis audit 2026-10-15): data of the 10/15 KRX close — KOSPI -7.57% (5 sessions -18.4%), 221 of 239 sampled
// names down, 175 of them by 3% or more; KOSDAQ -7.65%.
{
  const now = Date.parse('2026-10-15T09:00:00Z');
  const wide = [...Array.from({ length: 175 }, () => -7), ...Array.from({ length: 46 }, () => -1), ...Array.from({ length: 18 }, () => 1)]
    .map((ret1d, i) => ({ sym: `${String(200000 + i)}.KS`, factorSessionDate: '2026-10-15', pctSma50: -5, pctSma200: -3, ret1m: -12, ret3m: -9, ret1d, ret5d: ret1d < 0 ? -13 : 2 }));
  const spread = buildKoreaParticipation({ rows: wide, nowMs: now, index: { date: '2026-10-15', d1: -7.57, d5: -18.4 } });
  assert.match(spread.session.text, /표본의 92%가 내려 표본 전반으로 번진 하락입니다/, `v57.81 the 92%-falling sample reads 표본 전반으로 번진 하락 (${spread.session.text})`);
  assert.match(spread.session.text, /5거래일은 지수 -18\.4%, 표본 중앙값 -13\.0%로, 표본의 92%가 내려 표본 전반으로 번진 하락입니다 — 지수 하락 폭이 표본 중앙값보다 훨씬 커/, `v57.81 the 5-session gap is read by the same rules (${spread.session.text})`);
  // v57.88 (screen audit): the 10/16 up day — KOSPI +2.0% against a +4.6% sample median, 90% of the sample up. The gap is
  // read with the index direction, and an up day counts the up side.
  const rebound = buildKoreaParticipation({ rows: wide.map((row, i) => ({ ...row, factorSessionDate: '2026-10-16', ret1d: i < 215 ? 4.6 : -1, ret5d: 1 })), nowMs: Date.parse('2026-10-16T09:00:00Z'), index: { date: '2026-10-16', d1: 2.0, d5: 0.5 } });
  assert.ok(/덜 오르고 중소형 종목이 더 올랐습니다/.test(rebound.session.text) && !/하락이/.test(rebound.session.text) && /\(\+3% 이상 215개, 상승 215개\)/.test(rebound.session.text), `v57.88 an up day must not read as a large-cap decline (${rebound.session.text})`);
  const mixed = buildKoreaParticipation({ rows: wide.map((row, i) => ({ ...row, ret1d: i % 2 ? -0.5 : 0.5, ret5d: i % 2 ? -1 : 1 })), nowMs: now, index: { date: '2026-10-15', d1: -0.4, d5: -0.2 } });
  assert.ok(!/번진/.test(mixed.session.text), `v57.81 clean: a split day is not called a spread move (${mixed.session.text})`);

  // KOSPI/KOSDAQ closes: a calm record, then the 10/15 week.
  const { isCloseSessionDate } = await import('../src/domain/briefing/market-read.js');
  const dates = [];
  for (let cursor = Date.UTC(2025, 8, 1); dates.length < 300; cursor += 86400000) { const date = new Date(cursor).toISOString().slice(0, 10); if (date > '2026-10-15') break; if (isCloseSessionDate(date, 'KR')) dates.push(date); }
  const calm = dates.map((date, i) => 3000 + (i % 7) * 12);
  const n = dates.length;
  const week = [0.97, 0.96, 0.95, 0.98];
  let level = calm[n - 6];
  for (let k = 0; k < 4; k += 1) { level *= week[k]; calm[n - 5 + k] = level; }
  calm[n - 1] = calm[n - 6] * (1 - 0.184);
  const krHistory = dates.map((date, i) => ({ date, kospi: calm[i], kosdaq: calm[i] / 4 }));
  const { buildKoreaRegimeObservations } = await import('../src/domain/market/regime-scenarios.js');
  const { krIndexTrendFacts, krIndexReading } = await import('../src/ui/components/kr-index-trend.js');
  const cards = buildKoreaRegimeObservations({ history: krHistory }, { nowMs: now }).cards;
  const kospiCard = cards.find((card) => card.id === 'kospi');
  assert.match(kospiCard.read, /^최근 20거래일\(한국\) [-+]\d+\.\d%, 하루 -\d+\.\d%, 5거래일 -18\.4%\(최근 \d+거래일 기록에서 하루 (최저|하위 \d+%)·5거래일 최저/, `v57.81 the 시장 상태 KR card shows the 1-day move and its record position (${kospiCard.read})`);
  assert.match(cards.find((card) => card.id === 'kosdaq').read, /하루 -\d+\.\d%, 5거래일 -18\.4%\(최근 \d+거래일 기록에서/, 'v57.81 KOSDAQ reads the same record rule');
  const chartLine = krIndexReading(krIndexTrendFacts(krHistory, 'kospi', { through: '2026-10-15', now }), '코스피')[0];
  assert.match(chartLine, /하루 -\d+\.\d%, 5거래일 -18\.4%, 20거래일 [-+]\d+\.\d%\. 최근 \d+거래일 기록에서 하루 (최저|하위 \d+%)·5거래일 최저입니다\.$/, `v57.81 the chart-tab KR card shows the same record and the same month window (${chartLine})`);
  const quiet = krHistory.slice(0, n - 5);
  const quietLine = krIndexReading(krIndexTrendFacts(quiet, 'kospi', { now: Date.parse(`${quiet.at(-1).date}T09:00:00Z`) }), '코스피')[0];
  assert.ok(!/기록에서/.test(quietLine), `v57.81 clean: an ordinary day names no record position (${quietLine})`);

  // Stress: the KOSPI's own worst 5/20-session moves, only above the R706 floor.
  const { krIndexStressRows } = await import('../src/domain/portfolio/kr-stress.js');
  const stress = krIndexStressRows(krHistory, { now });
  assert.equal(stress.length, 2, 'v57.81 the KR stress rows exist (5 and 20 sessions)');
  assert.ok(Math.abs(stress[0].pct - -18.4) < 0.01 && stress[0].sessions === 5 && /코스피 기록상 최악 5거래일/.test(stress[0].name), `v57.81 the 5-session row is the record's worst move (${JSON.stringify(stress[0])})`);
  assert.deepEqual(krIndexStressRows(krHistory.slice(-40), { now }), [], 'v57.81 below ten non-overlapping windows no stress row is offered (R706)');

  // close.kosdaq: typed AI evidence on its own KRX session beside the US basis.
  const { buildCloseBasisEvidence } = await import('../src/ai/context/close-basis-evidence.js');
  const usDates = []; for (let cursor = Date.UTC(2026, 6, 1); ; cursor += 86400000) { const date = new Date(cursor).toISOString().slice(0, 10); if (date > '2026-10-14') break; if (isCloseSessionDate(date, 'US')) usDates.push(date); }
  const byDate = new Map(krHistory.slice(-60).map((row) => [row.date, { ...row, kosdaq: row.date === '2026-10-15' ? 760.82 : row.date === dates[n - 2] ? 760.82 / (1 - 0.0765) : row.kosdaq }]));
  for (const [i, date] of usDates.entries()) byDate.set(date, { ...(byDate.get(date) || { date }), spx: 6000 + i });
  const evidence = buildCloseBasisEvidence({ history: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), credit: {}, rates: {}, now: Date.parse('2026-10-15T12:00:00Z') });
  const kosdaq = evidence.find((row) => row.metric === 'close.kosdaq');
  const kosdaq1d = evidence.find((row) => row.metric === 'close.kosdaq.chg1d');
  assert.ok(kosdaq?.value === 760.82 && kosdaq.asOf === '2026-10-15' && kosdaq.market === 'KR' && kosdaq1d?.value === -7.65, `v57.81 close.kosdaq is present with its 1-day change (${JSON.stringify([kosdaq, kosdaq1d])})`);
}
console.log('PASS P1628 Korean completed-session participation and honest unavailable source boundaries; P1723 index vs sample day and largest-traded names; v57.81 spread reading, KR index card record, KOSPI stress row, close.kosdaq.');
}],
// ── section kr-investor-flows (was ci-kr-investor-flows-fixture.mjs) ──
['kr-investor-flows', async () => {
// v58.55 개편 v2 (5n) 투자자별 순매수: ECOS item discovery by the item's own name (no hard-coded or guessed codes), unit
// conversion to 억원, the artifact, and the read model (latest session, 20-session trend, missing investor types named).
const { default: assert } = await import('node:assert/strict');
const { classifyEcosItem, parseEcosDailyRows, buildKrInvestorFlows, pendingKrInvestorFlows, KR_INVESTOR_FLOWS_SCHEMA } = await import('./fetch-kr-investor-flows.mjs');
const { buildKrInvestorFlowView, formatEok } = await import('../src/domain/market/kr-investor-flows.js');

// ECOS StatisticItemList-shaped rows (codes here are fixture codes, not ECOS's).
const items = [
  { ITEM_CODE: 'A1', ITEM_NAME: 'KOSPI지수', CYCLE: 'D', UNIT_NAME: '1980.01.04=100' },
  { ITEM_CODE: 'A2', ITEM_NAME: '외국인 순매수(유가증권시장)', CYCLE: 'D', UNIT_NAME: '억원' },
  { ITEM_CODE: 'A3', ITEM_NAME: '외국인 순매수(코스닥시장)', CYCLE: 'D', UNIT_NAME: '백만원' },
  { ITEM_CODE: 'A4', ITEM_NAME: '외국인 순매수 수량', CYCLE: 'D', UNIT_NAME: '천주', P_ITEM_NAME: '유가증권시장' },
  { ITEM_CODE: 'A5', ITEM_NAME: '외국인 순매수', CYCLE: 'D', UNIT_NAME: '억원' },
  { ITEM_CODE: 'A6', ITEM_NAME: '외국인 순매수(유가증권시장)', CYCLE: 'M', UNIT_NAME: '억원' }
];
assert.deepEqual(classifyEcosItem(items[1]), { market: 'kospi', investor: 'foreign', factor: 1, unit: '억원', generality: 0 }, 'v58.55 KOSPI foreign net purchase is recognised by its name');
assert.equal(classifyEcosItem(items[2]).market, 'kosdaq', 'v58.55 KOSDAQ by name');
assert.equal(classifyEcosItem(items[2]).factor, 0.01, 'v58.55 백만원 converts to 억원');
assert.equal(classifyEcosItem(items[0]).skip, 'not-net-purchase', 'v58.55 index level is not a flow');
assert.match(classifyEcosItem(items[3]).skip, /^unit-unknown/, 'v58.55 a share-count item is not read as won');
assert.equal(classifyEcosItem(items[4]).skip, 'market-ambiguous', 'v58.55 an item that does not name its market is not assigned one');
assert.equal(classifyEcosItem(items[5]).skip, 'not-daily', 'v58.55 a monthly item is not a daily series');
for (const name of ['외국인 순매수(KOSPI200)', '외국인 순매수(코스피 대형주)', '외국인 순매수(코스닥150)', '외국인 순매수(유가증권시장 업종)']) {
  assert.equal(classifyEcosItem({ ITEM_CODE: 'S', ITEM_NAME: name, CYCLE: 'D', UNIT_NAME: '억원' }).skip, 'sub-index', `v58.55 review: ${name} is a sub-index, not the market-wide figure`);
}
{
  const both = buildKrInvestorFlows({ items: [
    { ITEM_CODE: 'B1', ITEM_NAME: '외국인 순매수(유가증권시장 거래소 집계분)', CYCLE: 'D', UNIT_NAME: '억원' },
    { ITEM_CODE: 'B2', ITEM_NAME: '외국인 순매수(유가증권시장)', CYCLE: 'D', UNIT_NAME: '억원' },
    { ITEM_CODE: 'B3', ITEM_NAME: '외국인 순매수(KOSPI200)', CYCLE: 'D', UNIT_NAME: '억원' }],
  seriesByItem: { B1: [{ TIME: '20261020', DATA_VALUE: '1' }], B2: [{ TIME: '20261020', DATA_VALUE: '2' }], B3: [{ TIME: '20261020', DATA_VALUE: '3' }] } });
  assert.equal(both.markets.kospi.investors.foreign.itemCode, 'B2', 'v58.55 review: the market-wide item wins over a qualified duplicate, whatever the order');
  assert.ok(!('generality' in both.markets.kospi.investors.foreign), 'v58.55 the ranking field is not published');
}

const dates = [];
for (let t = Date.UTC(2026, 8, 1); dates.length < 30; t += 86400000) { const d = new Date(t); if (d.getUTCDay() % 6) dates.push(d.toISOString().slice(0, 10)); }
const rows = (fn) => dates.map((date, i) => ({ TIME: date.replace(/-/g, ''), DATA_VALUE: String(fn(i)) }));
const parsed = parseEcosDailyRows([...rows((i) => i * 10), { TIME: '2026-09', DATA_VALUE: '1' }, { TIME: '20260930', DATA_VALUE: '' }], 1);
assert.equal(parsed.length, 30, 'v58.55 malformed and empty rows are dropped, not filled');
const payload = buildKrInvestorFlows({ items, seriesByItem: { A2: rows((i) => (i % 2 ? -1 : 1) * 1000 - 200), A3: rows((i) => 50000 + i) }, generatedAt: '2026-10-20T00:00:00Z' });
assert.equal(payload.schemaVersion, KR_INVESTOR_FLOWS_SCHEMA);
assert.equal(payload.status, 'ok');
assert.deepEqual(Object.keys(payload.markets).sort(), ['kosdaq', 'kospi']);
assert.equal(payload.markets.kosdaq.investors.foreign.series.at(-1).value, 500.29, 'v58.55 백만원 values become 억원');
assert.deepEqual(payload.missingInvestors, ['individual', 'institution'], 'v58.55 investor types the source does not publish are listed as missing');
assert.equal(buildKrInvestorFlows({ items: items.slice(0, 1) }).status, 'no-investor-items', 'v58.55 no matching item → no numbers');

const nowMs = Date.parse(`${dates.at(-1)}T09:00:00Z`);
const view = buildKrInvestorFlowView(payload, { nowMs });
assert.equal(view.state, 'ok');
const kospi = view.markets.find((m) => m.id === 'kospi');
assert.equal(kospi.date, dates.at(-1));
assert.equal(kospi.rows.length, 1, 'v58.55 only the published investor type is drawn');
assert.equal(kospi.trends[0].points.length, 20, 'v58.55 the trend is the last 20 sessions');
assert.equal(kospi.trends[0].sum5, -2000, `v58.55 5-session sum (${kospi.trends[0].sum5})`);
assert.deepEqual(view.missing, ['개인', '기관']);
assert.equal(kospi.stale, false);
assert.equal(buildKrInvestorFlowView(payload, { nowMs: nowMs + 9 * 86400000 }).markets[0].stale, true, 'v58.55 an old session is marked 지연');
assert.equal(buildKrInvestorFlowView(null).state, 'loading', 'v58.55 review: no file yet reads as loading, not 수집 전');
assert.deepEqual(buildKrInvestorFlowView(null, { loadState: 'failed' }), { state: 'unavailable', reason: 'fetch-failed' }, 'v58.55 review: a failed fetch is its own state');
{
  const pending = pendingKrInvestorFlows('key-missing', '2026-10-20T00:00:00Z');
  assert.equal(buildKrInvestorFlowView(pending).state, 'pending', 'v58.55 the 수집 전 marker carries no numbers and reads as pending');
  assert.ok(!JSON.stringify(pending).match(/"value"/), 'v58.55 the marker has no values');
}
assert.equal(formatEok(-17716), '-1.8조', 'P1593 family (v58.74 ASCII minus): a net sell reads -1.8조');
assert.equal(formatEok(5485), '+5,485억');
console.log('PASS v58.55 KR investor flows: ECOS item discovery by name, unit conversion, artifact, read model.');
}],
]);
