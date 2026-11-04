#!/usr/bin/env node
// Korea market participation and investor flows. v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
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
// v58.55 개편 v2 (5n) 투자자별 순매수; v59.70 (R6(b)) the Naver investor trend: parser on recorded responses, closed days,
// a format change, the incremental merge, the stale guard (previous numbers kept, R5 lowers the use) and the read model.
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { parseNaverTrend, buildKrInvestorFlows, pendingKrInvestorFlows, sessionsToRead, naverTrendUrl, readSessions, KR_INVESTOR_FLOWS_SCHEMA, KR_FLOW_KEEP_SESSIONS } = await import('./fetch-kr-investor-flows.mjs');
const { buildKrInvestorFlowView, formatEok } = await import('../src/domain/market/kr-investor-flows.js');
const recorded = JSON.parse(readFileSync(new URL('./fixtures/kr-investor-flows/naver-trend-responses.json', import.meta.url), 'utf8'));

assert.deepEqual(parseNaverTrend(recorded['kospi-20261103'], '2026-11-03'), { date: '2026-11-03', individual: 16388, foreign: -15086, institution: -4941 }, 'v59.70 a Naver trend row parses to 억원 for all three investor types');
assert.equal(parseNaverTrend(recorded['closed-20261101'], '2026-11-01'), null, 'v59.70 a closed day (all zeros) is no session, not a zero flow');
assert.match(parseNaverTrend(recorded['changed-20261103'], '2026-11-03').error, /^field:/, 'v59.70 a renamed field is a format change, never read as zero');
assert.match(parseNaverTrend(recorded['html-error'], '2026-11-03').error, /not-an-object/, 'v59.70 an HTML error page is rejected');
assert.match(parseNaverTrend(recorded['kospi-20261030'], '2026-11-03').error, /^bizdate:/, 'v59.70 a response for another date is rejected');
assert.equal(naverTrendUrl('kosdaq', '20261103'), 'https://m.stock.naver.com/api/index/KOSDAQ/trend?bizdate=20261103', 'v59.70 R6b the Naver trend URL per market and session');

// The request layer on recorded responses: one bad market response is an error line, the other market still reads.
{
  const fetchImpl = async (url) => {
    const date = url.slice(-8);
    const body = /KOSPI/.test(url) ? recorded[`kospi-${date}`] : recorded['changed-20261103'];
    return { ok: !!body, status: body ? 200 : 404, json: async () => body };
  };
  const { rowsByMarket, errors } = await readSessions(['2026-10-30', '2026-11-03'], fetchImpl, { pauseMs: 0 });
  assert.equal(rowsByMarket.kospi.length, 2, 'v59.70 both KOSPI sessions read');
  assert.equal(rowsByMarket.kosdaq.length, 0, 'v59.70 a changed KOSDAQ format reads nothing');
  assert.ok(errors.every((line) => /^kosdaq /.test(line)) && errors.length === 2, `v59.70 each rejected response is named (${errors.join('; ')})`);
}

const dates = [];
for (let t = Date.UTC(2026, 8, 1); dates.length < 30; t += 86400000) { const d = new Date(t); if (d.getUTCDay() % 6) dates.push(d.toISOString().slice(0, 10)); }
const rowsOf = (fn) => dates.map((date, i) => ({ date, individual: -fn(i) - 100, foreign: fn(i), institution: 100 }));
const payload = buildKrInvestorFlows({ rowsByMarket: { kospi: rowsOf((i) => (i % 2 ? -1 : 1) * 1000 - 200), kosdaq: rowsOf((i) => 500 + i) }, generatedAt: '2026-10-20T00:00:00Z' });
assert.equal(payload.schemaVersion, KR_INVESTOR_FLOWS_SCHEMA);
assert.equal(payload.status, 'ok');
assert.equal(payload.allowedUse, 'decision-with-daily-delay', 'v59.70 a current artifact keeps its declared use');
assert.deepEqual(Object.keys(payload.markets).sort(), ['kosdaq', 'kospi']);
assert.deepEqual(Object.keys(payload.markets.kospi.investors), ['individual', 'foreign', 'institution'], 'v59.70 개인·외국인·기관 are all published');
assert.deepEqual(payload.missingInvestors, [], 'v59.70 no investor type is missing');

// Incremental: a later run merges new sessions into the published series and replaces a re-read date.
{
  const next = buildKrInvestorFlows({ rowsByMarket: { kospi: [{ date: dates.at(-1), individual: 1, foreign: 2, institution: 3 }] }, previous: payload, generatedAt: '2026-10-21T00:00:00Z' });
  assert.equal(next.markets.kospi.investors.foreign.series.length, 30, 'v59.70 the merge keeps the earlier sessions');
  assert.equal(next.markets.kospi.investors.foreign.series.at(-1).value, 2, 'v59.70 a re-read session replaces the earlier value');
  assert.equal(next.markets.kosdaq.investors.foreign.series.length, 30, 'v59.70 a market not read this run keeps its series');
  const long = buildKrInvestorFlows({ rowsByMarket: { kospi: Array.from({ length: 60 }, (_, i) => ({ date: `2026-0${i < 30 ? 7 : 8}-${String((i % 30) + 1).padStart(2, '0')}`, individual: 1, foreign: 1, institution: 1 })) } });
  assert.equal(long.markets.kospi.investors.foreign.series.length, KR_FLOW_KEEP_SESSIONS, 'v59.70 the series is bounded');
}
// The guard: nothing parsed keeps the previous numbers as stale, and R5 lowers the use to reference.
{
  const stale = buildKrInvestorFlows({ rowsByMarket: { kospi: [], kosdaq: [] }, previous: payload, errors: ['kospi 2026-11-03: field:personalValue'], generatedAt: '2026-10-22T00:00:00Z' });
  assert.equal(stale.status, 'stale', 'v59.70 a run that parsed nothing marks the kept numbers stale');
  assert.equal(stale.markets.kospi.investors.foreign.series.length, 30, 'v59.70 the previous numbers are kept');
  assert.equal(stale.allowedUse, 'reference-only', 'v59.70 R5: a stale artifact is reference, not decision');
  assert.equal(stale.staleReason, 'kospi 2026-11-03: field:personalValue', 'v59.70 R6b a stale artifact names the failed read');
  const recovered = buildKrInvestorFlows({ rowsByMarket: { kospi: [{ date: dates.at(-1), individual: 1, foreign: 2, institution: 3 }] }, previous: stale });
  assert.equal(recovered.status, 'ok', 'v59.70 the next good read is current again');
  assert.equal(recovered.allowedUse, 'decision-with-daily-delay', 'v59.70 R5 is recomputed: a recovered source returns to its declared use');
  const staleView = buildKrInvestorFlowView(stale, { nowMs: Date.parse(`${dates.at(-1)}T09:00:00Z`) });
  assert.equal(staleView.state, 'ok', 'v59.70 a stale artifact is still drawn');
  assert.ok(staleView.sourceStale && staleView.markets.every((m) => m.stale), 'v59.70 and every market reads 지연');
  assert.equal(buildKrInvestorFlows({ rowsByMarket: {} }).status, 'unavailable', 'v59.70 no previous and nothing read → no numbers');
}
// Which sessions a run reads: the missing ones and the last two again; today only after 18:00 KST.
{
  const prev = buildKrInvestorFlows({ rowsByMarket: { kospi: [{ date: '2026-10-29', individual: 1, foreign: 1, institution: 1 }, { date: '2026-10-30', individual: 1, foreign: 1, institution: 1 }] } });
  const before = sessionsToRead(prev, Date.parse('2026-11-03T08:00:00Z')); // 17:00 KST
  assert.ok(!before.includes('2026-11-03') && before.includes('2026-11-02') && before.includes('2026-10-30') && !before.includes('2026-10-29') && !before.includes('2026-11-01'), `v59.70 before 18:00 KST today is not read; held sessions are not re-read except the last two (${before.slice(-4).join(',')})`);
  assert.ok(sessionsToRead(prev, Date.parse('2026-11-03T09:30:00Z')).includes('2026-11-03'), 'v59.70 after 18:00 KST today is read');
}

const nowMs = Date.parse(`${dates.at(-1)}T09:00:00Z`);
const view = buildKrInvestorFlowView(payload, { nowMs });
assert.equal(view.state, 'ok');
assert.equal(view.sourceChip, 'Naver Finance', 'v59.70 R6b the view carries the source for the chip hover');
const kospi = view.markets.find((m) => m.id === 'kospi');
assert.equal(kospi.date, dates.at(-1));
assert.equal(kospi.rows.length, 3, 'v59.70 개인·외국인·기관 are drawn');
assert.equal(kospi.trends.find((t) => t.id === 'foreign').points.length, 20, 'v58.55 the trend is the last 20 sessions');
assert.equal(kospi.trends.find((t) => t.id === 'foreign').sum5, -2000, 'v58.55 5-session sum');
assert.deepEqual(view.missing, [], 'v59.70 R6b individual, foreign and institution are all published');
assert.equal(kospi.stale, false);
assert.equal(buildKrInvestorFlowView(payload, { nowMs: nowMs + 9 * 86400000 }).markets[0].stale, true, 'v58.55 an old session is marked 지연');
assert.equal(buildKrInvestorFlowView(null).state, 'loading', 'v58.55 review: no file yet reads as loading, not 수집 전');
assert.deepEqual(buildKrInvestorFlowView(null, { loadState: 'failed' }), { state: 'unavailable', reason: 'fetch-failed' }, 'v58.55 review: a failed fetch is its own state');
{
  const pending = pendingKrInvestorFlows('awaiting-first-collection', '2026-10-20T00:00:00Z');
  assert.equal(buildKrInvestorFlowView(pending).state, 'pending', 'v58.55 the 수집 전 marker carries no numbers and reads as pending');
  assert.ok(!JSON.stringify(pending).match(/"value"/), 'v58.55 the marker has no values');
}
assert.equal(formatEok(-17716), '-1.8조', 'P1593 family (v58.74 ASCII minus): a net sell reads -1.8조');
assert.equal(formatEok(5485), '+5,485억');
console.log('PASS v59.70 KR investor flows: Naver parser on recorded responses, closed days, format guard, merge, stale ceiling, read model.');
}],
]);
