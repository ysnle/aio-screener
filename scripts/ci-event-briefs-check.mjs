#!/usr/bin/env node
// v59.42 (owner audit 2026-10-28): the event-brief producer on fixtures. A figure the fetched source does not contain is
// dropped, a quote that is not in the source drops its item, a call or press-conference point with an invented figure
// or an off-list source is dropped, the DART table is parsed without AI, the estimate comparison and the AI cost are
// recorded, a different company's DART filing is not used, and the producer refuses to write public-data outside Actions.
import assert from 'node:assert/strict';
// Each comparison below sits inside a check() whose label cites the release; the label is the assertion's evidence.
const { equal: eq, deepEqual: same, ok, match: like } = assert;
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEventBriefs, fixtureSources } from './fetch-event-briefs.mjs';
import { earningsContextLines, earningsContextSignature, cashflowContextLines } from './producer/earnings-context.mjs';
import { buildBigtechCashflow } from './fetch-bigtech-cashflow.mjs';
import { issuerCashflow, quartersSpanned, HYPERSCALERS } from '../src/domain/fundamental/quarterly-cashflow.js';
import { recentBriefs, latestBriefFor, numberTokens, verifyQuotedItems, unverifiedNumbers, sourceNumberSet, EVENT_BRIEFS_SCHEMA } from '../src/domain/briefing/event-briefs.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = resolve(root, 'scripts/fixtures/event-briefs');
const failures = [];
const check = (name, fn) => { try { fn(); } catch (error) { failures.push(`${name}: ${error.message}`); } };

const sources = await fixtureSources(fixtureDir);
const base = { sources, fomcDecisions: sources.manifest.macroCalendar['us-fomc'], earningsRows: sources.manifest.earnings, earningsSource: 'Finnhub' };
const nowMs = Date.parse(sources.manifest.now);
const first = await buildEventBriefs({ ...base, previous: null, nowMs });
const byId = Object.fromEntries(first.briefs.map((brief) => [brief.id, brief]));
const msft = byId['earnings-MSFT-0000950170-26-900001'];
const fomc = byId['fomc-2026-10-28'];
const hynix = byId['earnings-000660.KS-20261028800036'];

check('v59.42 schema and one brief per event', () => {
  eq(first.schemaVersion, EVENT_BRIEFS_SCHEMA);
  ok(msft && fomc && hynix, `briefs: ${Object.keys(byId)}`);
  eq(first.briefs.filter((brief) => brief.symbol === 'MSFT').length, 1, 'the Item 5.07 8-K is not a results filing');
  ok(!first.briefs.some((brief) => brief.symbol === '005930.KS'), 'a filing under another corp code is not used for 삼성전자');
});

check('v59.42 figures not in the source are dropped', () => {
  const values = msft.figures.map((figure) => figure.value);
  same(values, ['$92.9 billion', '$4.95']);
  ok(msft.dropped.some((drop) => drop.reason === 'number-not-in-source' && drop.numbers.includes('42.1')));
  ok(!fomc.figures.some((figure) => /4\.25/.test(figure.value)));
  ok(fomc.dropped.some((drop) => drop.reason === 'quote-not-in-source'));
  ok(!fomc.watch.some((line) => /0\.5/.test(line)), 'a watch line with an invented figure is dropped');
});

check('v59.42 estimate comparison uses the calendar estimate', () => {
  const revenue = msft.figures.find((figure) => figure.metric === 'revenue');
  const eps = msft.figures.find((figure) => figure.metric === 'eps_diluted');
  eq(revenue.estimate.surprisePct, 0.4);
  eq(eps.estimate.surprisePct, 2.8);
});

check('v59.42 call and press-conference points keep only checked figures and allowed sources', () => {
  same(msft.callPoints.points.map((point) => point.text), ['Azure 수요가 공급 능력을 계속 넘는다고 설명']);
  eq(msft.callPoints.basis, 'news-report');
  eq(fomc.callPoints.points.length, 1);
  ok(fomc.callPoints.dropped.some((drop) => drop.reason === 'url-not-allowed'));
  ok(fomc.callPoints.dropped.some((drop) => drop.reason === 'number-not-in-source'));
  eq(msft.checkText, undefined, 'the release text leaves the artifact once the call summary is settled');
});

check('v59.42 DART table parsed without AI', () => {
  same(hynix.figures.map((figure) => [figure.label, figure.value]), [['매출액', '104.62조원'], ['영업이익', '83.33조원'], ['당기순이익', '39.78조원']]);
  like(hynix.figures[0].text, /전분기 대비 \+31\.9%/);
  eq(hynix.ai.length, 0);
  eq(hynix.callPoints, undefined, 'the call summary waits about two hours after the filing is first seen');
});

const later = await buildEventBriefs({ ...base, previous: first, nowMs: nowMs + 3 * 3600000 });
const hynixLater = later.briefs.find((brief) => brief.id === hynix.id);
check('v59.42 Korean call points checked against the filing and its unit conversion', () => {
  const texts = hynixLater.callPoints.points.map((point) => point.text);
  ok(texts.includes('3분기 매출 104.62조원으로 사상 최대'), texts.join(' | '));
  ok(!texts.some((text) => /90조원/.test(text)));
  eq(hynixLater.checkText, undefined);
  eq(later.briefs.find((brief) => brief.id === msft.id).ai.length, msft.ai.length, 'a settled brief does not call the AI again');
});

// The Fed's transcript appears later: the report-based press-conference summary is replaced on the transcript basis.
sources.manifest.fedTranscript = { 20261028: 'fed-presconf-20261028.synthetic.txt' };
const withTranscript = await buildEventBriefs({ ...base, previous: later, nowMs: nowMs + 4 * 3600000 });
const fomcTranscript = withTranscript.briefs.find((brief) => brief.id === fomc.id);
check('v59.42 press conference moves to the transcript basis', () => {
  eq(fomc.callPoints.basis, 'news-report');
  eq(fomcTranscript.callPoints.basis, 'transcript');
  eq(fomcTranscript.callPoints.preliminary, true);
  eq(fomcTranscript.callPoints.points.length, 2, JSON.stringify(fomcTranscript.callPoints.points));
  like(fomcTranscript.callPoints.transcriptUrl, /FOMCpresconf20261028\.pdf$/);
});
const again = await buildEventBriefs({ ...base, previous: withTranscript, nowMs: nowMs + 5 * 3600000 });
check('v59.42 a preliminary transcript is not summarised twice', () => {
  eq(again.briefs.find((brief) => brief.id === fomc.id).ai.length, fomcTranscript.ai.length);
});

check('v59.42 AI cost recorded per brief and per month', () => {
  ok(msft.ai.every((entry) => entry.estimatedUsd > 0 && entry.at));
  ok(first.costLedger.estimatedUsd > 0 && first.costLedger.estimatedUsd < 0.2, String(first.costLedger.estimatedUsd));
});

const early = await buildEventBriefs({ ...base, previous: null, nowMs: Date.parse('2026-10-28T17:30:00Z') });
check('v59.42 no FOMC brief before 14:00 ET', () => ok(!early.briefs.some((brief) => brief.kind === 'fomc')));

check('v59.42 selectors for 오늘 and 종목', () => {
  same(recentBriefs(first, { nowMs }).map((brief) => brief.id).sort(), [fomc.id, hynix.id, msft.id].sort());
  eq(latestBriefFor(first, 'msft', { nowMs })?.id, msft.id);
  eq(recentBriefs({ ...first, schemaVersion: 'other' }, { nowMs }).length, 0);
});

check('v59.42 number tokens skip quarter ordinals', () => {
  same(numberTokens('3분기 Q3 FY2026 매출 104.62조, +32%'), ['104.62', '32']);
  eq(verifyQuotedItems([{ label: 'x', value: '$1', text: '', quote: 'not here' }], 'source').kept.length, 0);
});

check('v59.56 period labels are not figures, amounts that look like years still are', () => {
  same(numberTokens('2026년 4분기 매출 $1,315 million, Q1 2027 EPS $52.60, 3Q 2026 $65,237, 최근 12개월 $42.4 billion, 첫 9개월 $15.32 billion'), ['1315', '52.60', '65237', '42.4', '15.32']);
  same(numberTokens('$2026 million, 2,026억 원, 2026 million units'), ['2026', '2026', '2026']);
  const fcf = 'Free cash flow decreased to an outflow of $42.4 billion for the trailing twelve months.';
  eq(verifyQuotedItems([{ label: '잉여현금흐름', value: 'an outflow of $42.4 billion', text: '최근 12개월 기준 유출', quote: fcf }], fcf).kept.length, 1);
  const guide = 'Forecasting fourth-quarter 2026 gross margin of 37.1%.';
  eq(verifyQuotedItems([{ label: '4분기 매출총이익률', value: '37.1%', text: '2026년 4분기 전망.', quote: guide }], guide).kept.length, 1);
});

check('v59.56 a Korean-unit dollar amount matches its billion form, a won amount does not', () => {
  const numbers = sourceNumberSet('Capital expenditures of about $220 billion; operating income between $28.5 billion and $33.5 billion.');
  same(unverifiedNumbers('현금 자본지출을 약 2,200억 달러로 예상', numbers), []);
  same(unverifiedNumbers('영업이익 가이던스는 285억~335억 달러', numbers), []);
  same(unverifiedNumbers('설비투자 2,200억 원', numbers), ['2200']);
});

check('v59.42 the producer does not write public-data outside Actions', () => {
  const run = spawnSync(process.execPath, ['scripts/fetch-event-briefs.mjs'], { cwd: root, env: { ...process.env, GITHUB_ACTIONS: '' }, encoding: 'utf8' });
  eq(run.status, 2, run.stderr);
});

// v59.42: the earnings calendar's second source — a results 8-K in the 45 days before the window settles 'unconfirmed'.
const { applyReportedFilings } = await import('./fetch-earnings-calendar.mjs');
check('v59.42 a name that already reported leaves the unconfirmed list with its filing', () => {
  const out = applyReportedFilings({ unconfirmed: ['META', 'NVDA', 'TSM'] }, {
    META: [{ form: '8-K', items: '2.02,9.01', filingDate: '2026-10-21', accession: 'a' }, { form: '8-K', items: '5.07', filingDate: '2026-10-25', accession: 'b' }],
    NVDA: [{ form: '8-K', items: '2.02', filingDate: '2026-08-27', accession: 'c' }]
  }, { from: '2026-10-26' });
  same(out.unconfirmed, ['NVDA', 'TSM']);
  same(out.recentlyReported, [{ symbol: 'META', date: '2026-10-21', source: 'SEC EDGAR 8-K Item 2.02', accession: 'a' }]);
  like(out.unconfirmedReasons.NVDA, /no results 8-K/);
  like(out.unconfirmedReasons.TSM, /foreign issuer/);
});

// v59.70 (lens plan step 1): an estimate keeps the first run that saw it and the last run that saw it before an actual.
const { stampEstimateSeen } = await import('./fetch-earnings-calendar.mjs');
check('v59.70 estimate first/last seen times survive rewrites and stop at the report', () => {
  const t1 = '2026-11-01T00:00:00.000Z', t2 = '2026-11-02T00:00:00.000Z', t3 = '2026-11-03T00:00:00.000Z';
  const pre = { symbol: 'AAA', date: '2026-11-02', epsEstimate: 1, revenueEstimate: 10, epsActual: null, revenueActual: null };
  const r1 = stampEstimateSeen([pre], [], t1)[0];
  const r2 = stampEstimateSeen([pre], [r1], t2)[0];
  const r3 = stampEstimateSeen([{ ...pre, epsActual: 1.2 }], [r2], t3)[0];
  const revised = stampEstimateSeen([{ ...pre, epsEstimate: 1.1 }], [r2], t3)[0];
  const late = stampEstimateSeen([{ ...pre, epsActual: 1.2 }], [], t3)[0];
  same([r2.estimateFirstSeenAt, r2.estimateLastSeenAt, r3.estimateFirstSeenAt, r3.estimateLastSeenAt, revised.estimateFirstSeenAt, late.estimateLastSeenAt], [t1, t2, t1, t2, t3, null]);
});

// v59.42: KOSPI weight proxies — common stocks only (no preferred, no ETF), the share at the previous close.
const { buildKrIndexWeights } = await import('./fetch-kr-index-weights.mjs');
const { readFileSync } = await import('node:fs');
check('v59.42 KR weights: common stocks at the previous close', () => {
  const sample = JSON.parse(readFileSync(resolve(fixtureDir, 'naver-market-value.sample.json'), 'utf8'));
  const out = buildKrIndexWeights(sample, '2026-10-29T08:00:00Z').markets.KOSPI;
  eq(out.count, 11);
  ok(!out.rows.some((row) => row.code === '005935' || row.code === '069500'));
  const caps = sample.KOSPI.filter((row) => row.stockEndType === 'stock' && /0$/.test(row.itemCode)).map((row) => Number(row.marketValueRaw) / (1 + Number(row.fluctuationsRatio) / 100));
  eq(out.rows[0].weightPct, Math.round((caps[0] / caps.reduce((a, b) => a + b, 0)) * 10000) / 100);
  eq(out.asOf, '2026-10-29');
});

// v59.44 (owner 2026-10-29): news by weight — tiers, the price after the report, Samsung's 조원 table, Korean headlines.
const { homeBriefTiers, briefTier, releaseSession, earningsReaction, reactionText, briefHeadline, parseDartPreliminaryResults, formatKrw } = await import('../src/domain/briefing/event-briefs.js');
const { extendedMovers } = await import('./fetch-event-briefs.mjs');
check('v59.44 tiers: FOMC and the core movers in full, others one line, the rest folded', () => {
  eq(briefTier({ kind: 'fomc' }), 1);
  eq(briefTier({ kind: 'earnings', symbol: 'AMZN' }), 1);
  eq(briefTier({ kind: 'earnings', symbol: 'NOW' }), 2);
  eq(briefTier({ kind: 'earnings', symbol: 'INTC', tier: 2 }), 2);
  const at = (hours) => new Date(nowMs - hours * 3600000).toISOString();
  const art = { schemaVersion: EVENT_BRIEFS_SCHEMA, briefs: [
    { id: 'a', kind: 'earnings', symbol: 'AMZN', status: 'complete', publishedAt: at(2) },
    { id: 'i', kind: 'earnings', symbol: 'INTC', tier: 2, status: 'complete', publishedAt: at(3) },
    { id: 'p', kind: 'earnings', symbol: 'PLTR', tier: 2, status: 'pending', publishedAt: at(3) },
    { id: 'm', kind: 'earnings', symbol: 'META', status: 'complete', publishedAt: at(24 * 8) },
    { id: 'o', kind: 'earnings', symbol: 'ORCL', status: 'complete', publishedAt: at(24 * 40) }] };
  const tiers = homeBriefTiers(art, { nowMs });
  same([tiers.core.map((b) => b.id), tiers.notable.map((b) => b.id), tiers.rest.map((b) => b.id), tiers.restTotal], [['a'], ['i'], ['m'], 1]);
  const busy = homeBriefTiers(art, { nowMs, coreLimit: 0 });
  same(busy.notable.map((b) => b.id), ['a', 'i'], 'a tier-1 report past the card limit stays on the face ahead of tier 2');
  // v59.44 (first live earnings week): FOMC, then core names and 15%+ moves newest first, then the bigger move; 8 lines.
  const mv = (id, symbol, pct, hours) => ({ id, kind: 'earnings', symbol, tier: 2, layer: 'chips-compute', status: 'complete', publishedAt: at(hours), reaction: { basis: 'close', firstPct: pct } });
  const week = { schemaVersion: EVENT_BRIEFS_SCHEMA, briefs: [mv('x1', 'XA', -9, 1), mv('x3', 'XC', -12, 3), mv('x2', 'XB', -21, 5), { id: 'am', kind: 'earnings', symbol: 'AMZN', status: 'complete', publishedAt: at(30) },
    { id: 'fo', kind: 'fomc', status: 'complete', publishedAt: at(40) }, ...Array.from({ length: 12 }, (_, i) => mv(`s${i}`, `S${i}`, 2, 2 + i))] };
  const ranked = homeBriefTiers(week, { nowMs, coreLimit: 3 });
  same([ranked.core.map((b) => b.id), ranked.notable.length, ranked.notable.slice(0, 2).map((b) => b.id), ranked.restTotal], [['fo', 'x2', 'am'], 8, ['x3', 'x1'], 6]);
});
check('v59.44 the session a report trades in', () => {
  same(releaseSession('2026-10-28T20:04:44Z'), { releaseDate: '2026-10-28', afterClose: true });
  same(releaseSession('2026-10-29T11:00:00Z'), { releaseDate: '2026-10-29', afterClose: false });
  same(releaseSession('2026-10-28T00:00:00+09:00', { market: 'KR', dateOnly: true }), { releaseDate: '2026-10-28', afterClose: false });
});
check('v59.44 closes after the report, and the latest trade until a session has closed on it', () => {
  const bars = [{ date: '2026-10-27', close: 100 }, { date: '2026-10-28', close: 110 }, { date: '2026-10-29', close: 99 }, { date: '2026-10-30', close: 104.5 }];
  const after = earningsReaction(bars, { releaseDate: '2026-10-28', afterClose: true });
  same([after.baseClose, after.firstPct, after.latestPct, after.sessions, after.settled], [110, -10, -5, 2, false]);
  eq(reactionText(after), '발표 후 첫 거래일 -10.0%, 2거래일 누적 -5.0%');
  const before = earningsReaction(bars, { releaseDate: '2026-10-28', afterClose: false });
  eq(before.firstPct, 10, 'a pre-market report trades the same day');
  const release = Date.parse('2026-10-29T20:05:00Z');
  const ext = earningsReaction(bars.slice(0, 3), { releaseDate: '2026-10-29', afterClose: true }, { extended: { price: 78.21, atMs: release + 3600000 }, releaseMs: release });
  same([ext.basis, ext.extendedPct, ext.sessions], ['latest-trade', -21, 0]);
  eq(reactionText(ext), '발표 후 최근 체결가 -21.0%(직전 종가 대비)');
  eq(earningsReaction(bars.slice(0, 3), { releaseDate: '2026-10-29', afterClose: true }, { extended: { price: 80, atMs: release - 60000 }, releaseMs: release }), null, 'a trade from before the release is not its reaction');
});
check('v59.44 the path after the first day from the third session (X bookmarks 10/30, 3-day rule)', () => {
  eq(reactionText({ basis: 'close', firstPct: -12.6, latestPct: -16.0, sessions: 3 }), '발표 후 첫 거래일 -12.6%, 3거래일 누적 -16.0%, 첫날 뒤에도 더 내림');
  eq(reactionText({ basis: 'close', firstPct: -12.6, latestPct: -8.0, sessions: 4 }), '발표 후 첫 거래일 -12.6%, 4거래일 누적 -8.0%, 첫날 낙폭 일부 되돌림');
  eq(reactionText({ basis: 'close', firstPct: 9.0, latestPct: 9.5, sessions: 3 }), '발표 후 첫 거래일 +9.0%, 3거래일 누적 +9.5%', 'under a point of change says nothing');
  eq(reactionText({ basis: 'close', firstPct: -12.6, latestPct: -16.0, sessions: 2 }), '발표 후 첫 거래일 -12.6%, 2거래일 누적 -16.0%', 'two sessions are too early');
});
const { assembleEarningsSections, EARNINGS_SCHEMA } = await import('./fetch-event-briefs.mjs');
check('v59.44 capex and free cash flow survive the cap of six figures (X bookmarks 10/30, the market priced cash)', () => {
  const lines = ['Revenue $10 billion', 'EPS $1.10', 'Operating income $3 billion', 'Net income $2 billion', 'Operating margin 30%', 'Gross margin 60%', 'Capital expenditures $5 billion', 'Free cash flow $-1 billion'];
  const metrics = ['revenue', 'eps_diluted', 'operating_income', 'net_income', 'margin', 'margin', 'capex', 'free_cash_flow'];
  const figures = lines.map((line, i) => ({ metric: metrics[i], label: line.split(' $')[0].split(' 3')[0], value: (line.match(/-?\$?-?[\d.]+%?(?: billion)?/) || [''])[0], text: '', quote: line }));
  const out = assembleEarningsSections({ figures, segments: [], guidance: [], watch: [] }, lines.join('. '));
  eq(out.figures.length, 6);
  same(out.figures.slice(-2).map((figure) => figure.metric), ['capex', 'free_cash_flow']);
  ok(EARNINGS_SCHEMA.properties.figures.items.properties.metric.enum.includes('free_cash_flow'), 'the schema names the cash metrics');
});
check('v59.44 Samsung files its table in 조원 with decimals (P2136)', () => {
  const text = '1. 연결실적내용 단위 : 조원, % 구분 당기실적 전기실적 전기대비 전년동기실적 전년동기대비 (26.3Q) (26.2Q) 증감율(%) 흑자적자전환여부 (25.3Q) 증감율(%) 흑자적자전환여부 매출액 당해실적 195.25 171.50 13.85 - 86.06 126.88 - 누계실적 500.63 - - - 239.77 108.80 - 영업이익 당해실적 107.44 89.49 20.06 - 12.17 783.11 - 실적기간 당기실적 2026-07-01 ~ 2026-09-30';
  const parsed = parseDartPreliminaryResults(text);
  same([parsed.unitLabel, parsed.quarter, parsed.accounts.revenue.current, parsed.accounts.operatingIncome.yoyPct], ['조원', '2026년 3분기', 195.25, 783.11]);
  eq(formatKrw(parsed.accounts.revenue.current, parsed.unit), '195.25조원');
});
check('v59.44 a headline is Korean and not the bare label (P2137)', () => {
  const figures = [{ metric: 'revenue', label: '매출', value: '$127.6 billion' }];
  eq(briefHeadline('Alphabet Announces Third Quarter 2026 Results', { nameKo: '알파벳', figures }), '알파벳 실적: 매출 $127.6 billion');
  eq(briefHeadline('마이크로소프트 실적 발표', { nameKo: '마이크로소프트', figures }), '마이크로소프트 실적: 매출 $127.6 billion');
  eq(briefHeadline('클라우드 성장 가속', { nameKo: '아마존', figures }), '클라우드 성장 가속');
  eq(briefHeadline('', { nameKo: '아마존', figures: [] }), '아마존 실적 발표');
});
check('v59.44 the story names join as tier-2 movers with their Korean names', () => {
  const index = { profiles: [{ symbol: 'INTC', name: 'Intel Corporation' }, { symbol: 'MSFT', name: 'Microsoft' }, { symbol: '005930.KS', name: '삼성전자' }, { symbol: 'CRDO', name: 'Credo Technology Group Holding Ltd' }] };
  const movers = extendedMovers(index, "    'INTC':  { en: 'Intel',            kr: '인텔',         alt: ['intel'] },");
  same(movers.map((m) => [m.sym, m.nameKo, m.tier, m.extended]), [['INTC', '인텔', 2, true], ['CRDO', 'Credo Technology', 2, true]]);
});
const { recentMacroReleases } = await import('../src/domain/briefing/macro-releases.js');
check('v59.44 a monthly release of the last two days leads 오늘', () => {
  const macro = { pce: 3.6, _asOf_pce: '2026-09-01', _freshness_pce: 'observed', pceDelta: 0.2, corePce: 3.1, _asOf_corePce: '2026-09-01', _freshness_corePce: 'observed', cpi: 3.7, _asOf_cpi: '2026-09-01', _freshness_cpi: 'observed' };
  const schedules = { 'us-pce': ['2026-09-30', '2026-10-29', '2026-11-25'], 'us-cpi': ['2026-10-14', '2026-11-10'] };
  const rows = recentMacroReleases({ macro, schedules }, { nowMs: Date.parse('2026-10-30T01:00:00Z') });
  same(rows.map((row) => [row.id, row.date, row.next, row.items.map((item) => item.valueText)]), [['us-pce', '2026-10-29', '2026-11-25', ['3.6%', '3.1%']]]);
  eq(recentMacroReleases({ macro, schedules }, { nowMs: Date.parse('2026-11-02T01:00:00Z') }).length, 0, 'two days later the release has moved to 거시');
});
const { epsComparisonBasis } = await import('../src/domain/briefing/event-briefs.js');
check('P2138 a GAAP-labelled EPS is not compared with the adjusted consensus (v59.48: epsComparisonBasis)', () => {
  const eps = (label, text, value = '$1.00') => ({ metric: 'eps_diluted', label, text, value });
  eq(epsComparisonBasis(eps('희석 주당순이익, GAAP', '3분기 GAAP 희석 주당순이익.')), null);
  eq(epsComparisonBasis(eps('희석 주당순이익, non-GAAP', ''))?.basis, 'adjusted');
  eq(epsComparisonBasis(eps('희석 EPS', '보통주 주주 귀속 순이익 기준'))?.basis, 'reported');
  eq(epsComparisonBasis(eps('희석 주당순이익, GAAP', '조정 전 기준')), null, "'조정 전' is the unadjusted figure");
});
const storyMover = [{ sym: 'INTC', tier: 2, extended: true, nameKo: '인텔', irDomains: [] }];
const watched = await buildEventBriefs({ ...base, previous: null, nowMs, earningsRows: [{ symbol: 'INTC', date: sources.manifest.now.slice(0, 10) }], extended: storyMover });
const rolled = await buildEventBriefs({ ...base, previous: watched, nowMs: nowMs + 2 * 86400000, earningsRows: [], extended: storyMover });
check('v59.44 a story name stays watched after the calendar rolls to the next week', () => {
  ok(watched.reportWatch?.INTC, JSON.stringify(watched.reportWatch));
  eq(rolled.reportWatch?.INTC, watched.reportWatch.INTC);
});
const gaapStored = { schemaVersion: EVENT_BRIEFS_SCHEMA, briefs: [{ id: 'n', kind: 'earnings', symbol: 'NOW', nameKo: '서비스나우', status: 'complete', publishedAt: new Date(nowMs).toISOString(), headline: '서비스나우, 구독 매출 성장',
  figures: [{ metric: 'eps_diluted', label: '희석 주당순이익, GAAP', value: '$0.27', text: '', estimate: { surprisePct: -73.9 } }] }] };
const gaapRepaired = (await buildEventBriefs({ ...base, previous: gaapStored, nowMs })).briefs.find((row) => row.id === 'n');
check('P2138 a stored GAAP comparison is removed on the next run', () => eq(gaapRepaired.figures[0].estimate, undefined));
check('v59.44 weight from the AI chain and the move, not the index weight', () => {
  const at = { kind: 'earnings', tier: 2, layer: 'chips-compute' };
  eq(briefTier({ ...at, symbol: 'INTC', reaction: { basis: 'latest-trade', extendedPct: -21 } }), 1, 'an AI-chain name that moved 8% or more is a card');
  eq(briefTier({ ...at, symbol: 'SNDK', layer: 'memory', reaction: { basis: 'close', firstPct: -5.3 } }), 2);
  eq(briefTier({ ...at, symbol: 'JPM', layer: 'ai-adopter', reaction: { basis: 'close', firstPct: -9 } }), 3, 'outside the AI chain the report is folded');
  eq(briefTier({ kind: 'earnings', symbol: 'MU', reaction: { basis: 'close', firstPct: 9 } }), 1, 'a listed mover moves up the same way');
});
const { provisionalBrief } = await import('./fetch-event-briefs.mjs');
const intcRow = { symbol: 'INTC', date: sources.manifest.now.slice(0, 10), hour: 'amc', epsEstimate: 0.3996, revenueEstimate: 16781909631, epsActual: 0.52, revenueActual: 16513000000 };
const withProvisional = await buildEventBriefs({ ...base, previous: null, nowMs: nowMs + 2 * 3600000, earningsRows: [...base.earningsRows, intcRow], extended: storyMover });
check('v59.44 a reported name shows from the calendar before its filing is summarised', () => {
  const brief = withProvisional.briefs.find((row) => row.symbol === 'INTC');
  same([brief?.status, brief?.basis, brief?.figures?.map((figure) => [figure.value, figure.estimate?.surprisePct])], ['provisional', 'provider', [['$16.51 billion', -1.6], ['$0.52', 30.1]]]);
  ok(!withProvisional.briefs.some((row) => row.id.startsWith('calendar-MSFT')), 'a name with a summarised filing gets no provisional entry');
  eq(provisionalBrief({ ...intcRow, hour: 'bmo' }, storyMover[0]).publishedAt.slice(11, 16), '11:00', 'before the open is 07:00 ET');
});
const { recentMacroReleases: macroDue } = await import('../src/domain/briefing/macro-releases.js');
check('v59.44 a release day is listed even before the figures arrive', () => {
  const rows = macroDue({ macro: { cpi: 3.7, _asOf_cpi: '2026-09-01', _freshness_cpi: 'observed' }, schedules: { 'us-cpi': ['2026-10-14', '2026-11-10'] } }, { nowMs: Date.parse('2026-11-10T14:30:00Z') });
  same(rows.map((row) => [row.id, row.date, !!row.pending]), [['us-cpi', '2026-11-10', true]]);
  eq(macroDue({ macro: {}, schedules: { 'us-cpi': ['2026-11-10'] } }, { nowMs: Date.parse('2026-11-10T12:00:00Z') }).length, 0, 'not before 08:30 ET');
});
const { aiChainFlow } = await import('../src/domain/briefing/ai-chain-flow.js');
check('v59.44 the AI chain by group: US members, median, weakest first', () => {
  const themes = [{ id: 'semiconductor', subThemes: [{ name: '메모리', tickers: ['MU', 'SNDK', 'WDC', '000660.KS'] }, { name: '두 종목', tickers: ['A', 'B'] }] }, { id: 'ai_infra', subThemes: [{ name: '네오클라우드', tickers: ['CRWV', 'NBIS', 'IREN'] }] }, { id: 'staples', subThemes: [{ name: '음료', tickers: ['KO', 'PEP', 'MNST'] }] }];
  const r = (sym, ret1d, ret1m) => ({ sym, ret1d, ret1m });
  const flow = aiChainFlow({ themes, rows: [r('MU', -5, -12), r('SNDK', -5.3, -23.6), r('WDC', -1, -8), r('000660.KS', 13, 40), r('CRWV', -5, -30), r('NBIS', -5.7, -27), r('IREN', -4, -20), r('KO', 1, 3), r('PEP', 1, 3), r('MNST', 1, 3), r('A', 1, 1), r('B', 1, 1)] });
  same(flow.groups.map((group) => [group.name, group.ret1d, group.ret1m]), [['네오클라우드', -5, -27], ['메모리', -5, -12]]);
  like(flow.reading, /2개 묶음이 지난 거래일과 한 달 모두 내렸습니다/); // v59.55: every group down on both windows reads as one clause
});
sources.manifest.ai['reasons-MSFT'] = { status: 'completed', model: 'gpt-6-luna', usage: { input_tokens: 3000, output_tokens: 200 }, output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ reasons: [
  { text: 'Azure 성장이 기대에 못 미쳤다는 보도', url: 'https://www.cnbc.com/msft-q1' }, { text: '설비투자 $150 billion 전망', url: 'https://www.cnbc.com/msft-capex' }, { text: '블로그 추측', url: 'https://example.com/x' }] }) }] }] };
sources.manifest.prices = { MSFT: { bars: [{ date: '2026-10-27', close: 500 }, { date: '2026-10-28', close: 510 }], extended: { price: 525.3, atMs: Date.parse('2026-10-28T21:30:00Z') } } };
const withPrices = await buildEventBriefs({ ...base, previous: first, nowMs: nowMs + 3600000 });
check('v59.44 the producer records the price after the report', () => {
  const brief = withPrices.briefs.find((row) => row.id === msft.id);
  same([brief.reaction?.basis, brief.reaction?.extendedPct, brief.tier], ['latest-trade', 3, 1]);
  // Why it moved: reported reasons on allowed sources only, without unchecked numbers.
  same(brief.reasons?.points?.map((point) => point.text), ['Azure 성장이 기대에 못 미쳤다는 보도']);
  same([brief.reasons?.done, brief.reasons?.basis, brief.reasons?.dropped?.map((drop) => drop.reason).sort()], [true, 'news-report', ['number-not-in-source', 'url-not-allowed']]);
  eq(brief.reasons?.direction, 1);
});
const { REACTION_REPORT_DOMAINS, isNoReasonText, onReportDomain } = await import('../src/domain/briefing/event-briefs.js');
check('v59.44 live run: English release titles and raw thousands are rebuilt; "not found" is not a reason', () => {
  const figures = [{ metric: 'revenue', label: '매출', value: '$11.0 billion' }];
  eq(briefHeadline('샌디스크, Fiscal First Quarter 2027 실적 발표', { nameKo: '샌디스크', figures }), '샌디스크 실적: 매출 $11.0 billion');
  eq(briefHeadline('디지털리얼티, 3분기 매출 $1,902,418천 보고', { nameKo: '디지털리얼티', figures }), '디지털리얼티 실적: 매출 $11.0 billion');
  eq(briefHeadline('마이크로소프트, Azure 성장 39%', { nameKo: '마이크로소프트', figures }), '마이크로소프트, Azure 성장 39%', 'one English word stays');
  eq(isNoReasonText('기대와의 차이가 하락을 이끌었다고 확인할 근거는 찾지 못했습니다.'), true);
  eq(isNoReasonText('4분기 매출 전망이 기대에 못 미쳤다는 보도'), false);
  ok(REACTION_REPORT_DOMAINS.length <= 10 && !REACTION_REPORT_DOMAINS.some((domain) => /aboutamazon|intc|ir\./.test(domain)), 'ten open domains, no company IR');
});
const junkStored = { ...withPrices, briefs: withPrices.briefs.map((row) => (row.id === msft.id ? { ...row, reasons: { ...row.reasons, points: [{ text: '이유를 확인할 근거는 찾지 못했습니다.', url: 'https://www.cnbc.com/x' }], done: true } } : row)) };
const junkCleaned = await buildEventBriefs({ ...base, previous: junkStored, nowMs: nowMs + 2 * 3600000 });
check('v59.44 a stored "not found" line is dropped and the reasons are searched again', () => {
  const brief = junkCleaned.briefs.find((row) => row.id === msft.id);
  same([brief.reasons.points.map((point) => point.text), brief.reasons.attempts], [['Azure 성장이 기대에 못 미쳤다는 보도'], 2]);
});
const irStored = { ...withPrices, briefs: withPrices.briefs.map((row) => (row.id === msft.id ? { ...row, reasons: { ...row.reasons, points: [{ text: '회사 자료는 가이던스 미달이 하락 원인이었다고 확인해 주지는 않습니다.', url: 'https://investor.example.com/q3' }, { text: '클라우드 매출 성장이 둔화했다는 보도', url: 'https://www.bloomberg.com/x' }], done: true } } : row)) };
const irCleaned = await buildEventBriefs({ ...base, previous: irStored, nowMs: nowMs + 2 * 3600000 });
check('v59.44 (P2140) a stored reason from a company IR page or an outlet off the list is dropped and searched again', () => {
  eq(isNoReasonText('회사 자료는 가이던스 미달이 하락 원인이었다고 확인해 주지는 않습니다.'), true);
  ok(onReportDomain('https://finance.yahoo.com/markets/x') && onReportDomain('https://sg.finance.yahoo.com/news/x') && !onReportDomain('https://ir.aboutamazon.com/x') && !onReportDomain('https://www.bloomberg.com/x') && !onReportDomain('not a url'));
  same(irCleaned.briefs.find((row) => row.id === msft.id).reasons.points.map((point) => point.text), ['Azure 성장이 기대에 못 미쳤다는 보도']);
});
// After hours up, first session down: the reasons are searched once more for the move now shown.
sources.manifest.prices = { MSFT: { bars: [{ date: '2026-10-27', close: 500 }, { date: '2026-10-28', close: 510 }, { date: '2026-10-29', close: 495 }] } };
const reversedRun = await buildEventBriefs({ ...base, previous: withPrices, nowMs: Date.parse('2026-10-29T22:00:00Z') });
const reversedAgain = await buildEventBriefs({ ...base, previous: reversedRun, nowMs: Date.parse('2026-10-29T22:30:00Z') });
check('v59.44 a reversed move gets its reasons searched once more, not every run', () => {
  const brief = reversedRun.briefs.find((row) => row.id === msft.id);
  same([brief.reaction?.basis, brief.reaction?.firstPct, brief.reasons?.direction, brief.reasons?.redone, brief.reasons?.attempts], ['close', -2.9, -1, true, 2]);
  eq(reversedAgain.briefs.find((row) => row.id === msft.id).reasons.attempts, 2);
});
// A provisional stored by an earlier run is replaced when the filing is summarised (one report, one entry).
const storedProvisional = { ...first, briefs: [...first.briefs.filter((row) => row.symbol !== 'MSFT'), provisionalBrief({ symbol: 'MSFT', date: '2026-10-28', hour: 'amc', revenueActual: 1e11, revenueEstimate: 1e11 }, { sym: 'MSFT', tier: 1, nameKo: '마이크로소프트' })] };
const replaced = await buildEventBriefs({ ...base, previous: storedProvisional, nowMs });
check('v59.44 a stored provisional gives way to the summarised filing', () => {
  same(replaced.briefs.filter((row) => row.symbol === 'MSFT').map((row) => row.id), [msft.id]);
});
sources.manifest.prices = { INTC: { bars: [{ date: '2026-10-27', close: 40 }, { date: '2026-10-28', close: 36.8 }] } };
const noHour = await buildEventBriefs({ ...base, previous: null, nowMs: nowMs + 2 * 3600000, earningsRows: [...base.earningsRows, { ...intcRow, hour: '' }], extended: storyMover });
check('v59.44 a report with no hour is not timed against a session', () => {
  eq(provisionalBrief({ ...intcRow, hour: null }, storyMover[0]).timing, 'unknown');
  eq(provisionalBrief(intcRow, storyMover[0]).timing, undefined);
  const brief = noHour.briefs.find((row) => row.symbol === 'INTC');
  same([brief?.status, brief?.reaction], ['provisional', undefined]);
});
// A story name that files on 6-K (ASML): its results 6-K is summarised; another 6-K is skipped.
Object.assign(sources.manifest.secTickers, { ASML: 937966 });
sources.manifest.secFilings['937966'] = [{ accession: 'asml-6k-results', form: '6-K', items: '', filingDate: '2026-10-28', acceptedAt: '2026-10-28T05:00:00.000Z' },
  { accession: 'asml-6k-other', form: '6-K', items: '', filingDate: '2026-10-27', acceptedAt: '2026-10-27T05:00:00.000Z' }];
Object.assign(sources.manifest.secExhibits, { 'asml-6k-results': 'msft-ex991.synthetic.txt', 'asml-6k-other': 'fed-statement-20261028.synthetic.txt' });
sources.manifest.ai['earnings-ASML'] = sources.manifest.ai['earnings-MSFT'];
const foreign = await buildEventBriefs({ ...base, previous: null, nowMs, earningsRows: [{ symbol: 'ASML', date: '2026-10-28' }], extended: [{ sym: 'ASML', tier: 2, extended: true, layer: 'semicap-foundry', nameKo: 'ASML', irDomains: [] }] });
check('v59.44 a story name filing on 6-K is matched on its results 6-K only', () => {
  same(foreign.briefs.filter((row) => row.symbol === 'ASML').map((row) => [row.id, row.source?.title]), [['earnings-ASML-asml-6k-results', 'SEC 6-K EX-99.1']]);
});

// v59.56: the market reading is handed the reports whose sessions closed on its US close (the 10/30 reading never saw them).
check('v59.56 earnings context: the close\'s own reports and leaders first, figures and reasons from the brief', () => {
  const brief = (symbol, firstDate, latestPct, extra = {}) => ({ kind: 'earnings', symbol, nameKo: symbol, eventDate: '2026-10-29', reaction: { basis: 'close', firstDate, latestDate: '2026-10-30', latestPct, sessions: firstDate === '2026-10-30' ? 1 : 2 }, ...extra });
  const briefs = { briefs: [
    brief('NOW', '2026-10-29', -30.0),
    brief('INTC', '2026-10-30', -28.6, { figures: [{ metric: 'revenue', label: '매출', value: '$16.5 billion', estimate: { surprisePct: -1.7, basis: 'provider-consensus-reference' } }], guidance: [{ label: '4분기 매출', value: '$15.0 billion to $16.0 billion' }], reasons: { points: [{ text: '다음 분기 전망이 예상에 못 미쳤다.' }] } }),
    brief('AMZN', '2026-10-30', -1.4),
    brief('XYZ', '2026-10-30', 2.0),
    { ...brief('OLD', '2026-10-28', -9), reaction: { basis: 'close', firstDate: '2026-10-28', latestDate: '2026-10-29', latestPct: -9, sessions: 2 } }
  ] };
  const lines = earningsContextLines(briefs, '2026-10-30').split('\n');
  same(lines.map((line) => line.slice(2, line.indexOf('('))), ['AMZN', 'INTC', 'NOW']);
  ok(lines[1].includes('10/30 종가 -28.6%(발표 후 첫 거래일)') && lines[1].includes('매출 $16.5 billion(시장 추정 대비 -1.7%)') && lines[1].includes('4분기 매출 전망 $15.0 billion to $16.0 billion') && lines[1].includes('보도된 이유: 다음 분기'));
  ok(lines[2].includes('발표 후 2거래일 누적'));
  eq(earningsContextSignature(briefs, '2026-10-30'), '2026-10-30:AMZN-1,INTC-29,NOW-30');
  eq(earningsContextLines(briefs, null), '');
});

// v59.56 (X bookmarks 11/01 follow-up 1): SEC cash-flow statements are year-to-date; a quarter is the difference of two
// year-to-date values with the same start and the fourth quarter is the 10-K year minus nine months.
const B = 1e9;
const ENDS = ['03-31', '06-30', '09-30', '12-31'];
function ytdRows(quarterValues, { years = [2024, 2025, 2026], start = (y) => `${y}-01-01`, end = (y, q) => `${y}-${ENDS[q]}` } = {}) {
  const rows = []; let i = 0;
  for (const y of years) {
    let cum = 0;
    for (let q = 0; q < 4 && i < quarterValues.length; q += 1) {
      cum += quarterValues[i++];
      rows.push({ start: start(y), end: end(y, q), val: cum, form: q === 3 ? '10-K' : '10-Q', fp: q === 3 ? 'FY' : `Q${q + 1}`, fy: y, filed: `${q === 3 ? y + 1 : y}-${q === 3 ? '01-30' : ENDS[q].slice(0, 2) + '-28'}`, accn: `a-${y}-${q}` });
    }
  }
  return rows;
}
const companyFacts = (ocfQ, capexQ, { capexConcept = 'PaymentsToAcquirePropertyPlantAndEquipment', extraOcf = [], ...opts } = {}) => ({ facts: { 'us-gaap': {
  NetCashProvidedByUsedInOperatingActivities: { units: { USD: [...ytdRows(ocfQ, opts), ...extraOcf] } },
  [capexConcept]: { units: { USD: ytdRows(capexQ, opts) } } } } });
const ocfQ = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((x) => x * B);
const capexQ = [5, 5, 6, 6, 7, 8, 9, 10, 11, 12, 13].map((x) => x * B);

check('v59.56 quarterly cash flow: year-to-date differences, Q4 from the 10-K, twelve months and a year earlier', () => {
  const read = issuerCashflow(companyFacts(ocfQ, capexQ));
  eq(read.status, 'ok');
  same(read.quarters.slice(-4).map((q) => [q.end, q.ocf / B, q.capex / B, q.basis]), [['2025-12-31', 17, 10, 'fy-minus-9m'], ['2026-03-31', 18, 11, 'reported'], ['2026-06-30', 19, 12, 'ytd-difference'], ['2026-09-30', 20, 13, 'ytd-difference']]);
  same([read.ttm.start, read.ttm.end, read.ttm.ocf / B, read.ttm.capex / B, read.ttm.fcf / B], ['2025-10-01', '2026-09-30', 74, 46, 28]);
  same([read.ttmYearAgo.end, read.ttmYearAgo.capex / B], ['2025-09-30', 30]);
  eq(read.capexYoyPct, 53.3);
  // 52/53-week years: 91 and 98 days are quarters, 371 days a year; 120 days is none of them.
  same([quartersSpanned('2025-09-28', '2025-12-27'), quartersSpanned('2025-09-28', '2026-01-03'), quartersSpanned('2024-09-29', '2025-10-04'), quartersSpanned('2026-01-01', '2026-04-30')], [1, 1, 4, null]);
});

check('v59.56 quarterly cash flow: a restated comparative wins, a missing link leaves the twelve months out, tags switch', () => {
  const restated = { start: '2026-01-01', end: '2026-06-30', val: 39 * B, form: '10-Q', fp: 'Q3', fy: 2026, filed: '2026-10-28', accn: 'later' };
  eq(issuerCashflow(companyFacts(ocfQ, capexQ, { extraOcf: [restated] })).quarters.find((q) => q.end === '2026-06-30').ocf, 39 * B - 18 * B);
  // No nine-month value for 2026 → Q3 2026 has no quarter, so the last four are not consecutive.
  const gap = companyFacts(ocfQ, capexQ);
  gap.facts['us-gaap'].NetCashProvidedByUsedInOperatingActivities.units.USD = gap.facts['us-gaap'].NetCashProvidedByUsedInOperatingActivities.units.USD.filter((row) => row.end !== '2026-09-30');
  const gapRead = issuerCashflow(gap);
  eq(gapRead.quarters.at(-1).end, '2026-06-30'); eq(gapRead.ttm.end, '2026-06-30');
  eq(issuerCashflow(companyFacts(ocfQ, capexQ, { capexConcept: 'PaymentsToAcquireProductiveAssets' })).ttm.capex, 46 * B);
  eq(issuerCashflow({ facts: { 'us-gaap': {} } }).status, 'no-cashflow-facts');
  // A 20-F or an 8-K exhibit is not a periodic cash-flow statement here.
  const foreign = companyFacts(ocfQ, capexQ); for (const row of foreign.facts['us-gaap'].NetCashProvidedByUsedInOperatingActivities.units.USD) row.form = '20-F';
  eq(issuerCashflow(foreign).status, 'no-cashflow-facts');
});

check('v59.56 big-tech cash flow artifact: hyperscaler total only when all five are in, a failed fetch keeps the previous row', () => {
  const nowMs = Date.parse('2026-11-01T00:00:00Z');
  const all = Object.fromEntries(HYPERSCALERS.map((symbol) => [symbol, companyFacts(ocfQ, capexQ)]));
  const first = buildBigtechCashflow({ factsBySymbol: all, nowMs });
  same([first.hyperscalers.complete, first.hyperscalers.capex / B, first.hyperscalers.ocf / B, first.hyperscalers.capexToOcfPct], [true, 230, 370, 62.2]);
  like(first.summary, /^빅테크 5개사\(MSFT·GOOGL·AMZN·META·ORCL\) 최근 4분기 합계 설비투자 \$230\.0B ÷ 영업현금흐름 \$370\.0B = 62\.2%, 잉여현금흐름 \$140\.0B — 1년 전 51\.7%, 설비투자 \+53\.3%$/);
  const second = buildBigtechCashflow({ factsBySymbol: { ...all, AMZN: new Error('HTTP 503') }, previous: first, nowMs: nowMs + 3600000 });
  const amzn = second.issuers.find((row) => row.symbol === 'AMZN');
  same([amzn.carried, amzn.lastError, amzn.ttm.capex / B, second.hyperscalers.complete], [true, 'HTTP 503', 46, true]);
  const cold = buildBigtechCashflow({ factsBySymbol: { ...all, ORCL: new Error('HTTP 404') }, nowMs });
  same([cold.hyperscalers.complete, cold.hyperscalers.missing, cold.summary], [false, ['ORCL'], '']);
});

check('v59.56 cash-flow lane in the reading: the group line always, an issuer line only for the night\'s reporter, stale data dropped', () => {
  const nowMs = Date.parse('2026-10-31T00:00:00Z');
  const cashflow = buildBigtechCashflow({ factsBySymbol: Object.fromEntries(HYPERSCALERS.map((symbol) => [symbol, companyFacts(ocfQ, capexQ)])), nowMs });
  const briefs = { briefs: [{ kind: 'earnings', symbol: 'AMZN', nameKo: '아마존', eventDate: '2026-10-29', reaction: { basis: 'close', firstDate: '2026-10-30', latestDate: '2026-10-30', latestPct: -1.4, sessions: 1 } }] };
  const lines = cashflowContextLines(cashflow, briefs, '2026-10-30', { nowMs }).split('\n');
  eq(lines.length, 2);
  like(lines[0], /^- 빅테크 5개사/);
  like(lines[1], /^- AMZN\(아마존\) 2026\.09 분기까지 최근 4분기 영업현금흐름 \$74\.0B · 설비투자 \$46\.0B · 잉여현금흐름 \$28\.0B/);
  eq(cashflowContextLines(cashflow, { briefs: [] }, '2026-10-30', { nowMs }).split('\n').length, 1);
  eq(cashflowContextLines(cashflow, briefs, '2026-10-30', { nowMs: nowMs + 11 * 86400000 }), '');
  eq(cashflowContextLines(null, briefs, '2026-10-30', { nowMs }), '');
});

// v59.59 (feature audit 2026-11-02, CCJ): a foreign issuer's home-currency release is not compared with the USD consensus.
{
  const { statedReportingCurrency, consensusComparable } = await import('../src/domain/briefing/event-briefs.js');
  check('v59.59 reporting currency: a stated Canadian basis or NT$ amounts are not USD; US$ amounts are; an 8-K is compared as before', () => {
    eq(statedReportingCurrency('All dollar amounts are expressed in Canadian dollars unless otherwise stated. Revenue 619'), 'other');
    eq(statedReportingCurrency('(in millions of U.S. dollars) Revenue 500'), 'USD');
    eq(statedReportingCurrency('net revenue NT$989.9 billion, NT$12, US$33.1 billion'), 'other');
    eq(statedReportingCurrency('net sales US$242.1 million, US$1.2, gross US$0.5'), 'USD');
    eq(consensusComparable({ form: 'SEC 6-K EX-99.1', currency: 'other' }), false);
    eq(consensusComparable({ form: 'SEC 6-K EX-99.1', currency: null }), false);
    eq(consensusComparable({ form: 'SEC 6-K EX-99.1', currency: 'USD' }), true);
    eq(consensusComparable({ form: 'SEC 8-K EX-99.1', currency: null }), true, 'an 8-K mentioning the euro as an exposure keeps its comparison');
  });
  const stored = { id: 'earnings-CCJ-0001193125-26-439858', kind: 'earnings', status: 'complete', basis: 'primary-source', symbol: 'CCJ', nameKo: '카메코', tier: 2, eventDate: '2026-10-30',
    publishedAt: '2026-10-30T11:00:00.000Z', headline: '카메코 3분기 매출 6.19억', details: [], guidance: [], watch: [], dropped: [], ai: [],
    figures: [{ metric: 'revenue', label: '3분기 매출', value: '$619 million', text: '', estimate: { value: 725149094, surprisePct: -14.6, source: 'Finnhub', basis: 'provider-consensus-reference' } }],
    source: { kind: 'T1_OFFICIAL', title: 'SEC 6-K EX-99.1', url: 'https://www.sec.gov/x', accession: '0001193125-26-439858' } };
  const rerun = await buildEventBriefs({ ...base, previous: { ...first, briefs: [...first.briefs, stored] }, nowMs });
  check('v59.59 a stored foreign-issuer brief loses the USD consensus comparison (CCJ C$619M read −14.6% against a USD estimate)', () => {
    const ccj = rerun.briefs.find((brief) => brief.id === stored.id);
    ok(ccj, 'the stored brief is kept');
    eq(ccj.figures[0].estimate, undefined);
    ok(rerun.briefs.find((brief) => brief.id === msft.id)?.figures.some((figure) => figure.estimate), 'a domestic 8-K keeps its comparison');
  });
}

// v59.70 (refactor step 2): the calendar's same-basis actual reaches the brief's estimate, so the briefing line, the
// reaction read and 오늘 (market-day facts, the same calendar row) print one surprise per report.
{
  const { figureSurprise } = await import('../src/domain/briefing/event-briefs.js');
  const row = { ...base.earningsRows[0], epsActual: 4.9, revenueActual: 93000000000 };
  const stamped = await buildEventBriefs({ ...base, previous: first, nowMs, earningsRows: [row] });
  check('v59.70 provider actual stamped on the stored estimate and read by figureSurprise', () => {
    const brief = stamped.briefs.find((candidate) => candidate.id === msft.id);
    const compared = (brief?.figures || []).filter((figure) => figure.estimate);
    ok(compared.length, 'the MSFT brief keeps its comparisons');
    for (const figure of compared) {
      const want = figure.metric === 'revenue' ? row.revenueActual : row.epsActual;
      eq(figure.estimate.providerActual, want, `${figure.metric} providerActual`);
      const read = figureSurprise(figure, brief.figures);
      if (read) eq(read.pct, Math.round(((want - figure.estimate.value) / Math.abs(figure.estimate.value)) * 1000) / 10, `${figure.metric} pct`);
    }
    ok(!first.briefs.find((candidate) => candidate.id === msft.id).figures.some((figure) => figure.estimate?.providerActual != null), 'no actual, nothing stamped');
  });
}

// v59.59 (AI lane refactor): every brief request goes through the shared transport with its lane's registered profile, and
// every prompt carries the shared writing rules (합니다체, Korean names, no value repeated in the text).
{
  const { SHARED_AI_PROFILES, sharedAiPurpose, requestSharedJson } = await import('./lib/ai-shared-analysis.mjs');
  const { FORMAL_ENDING, PROMPT_RULES } = await import('./lib/ai-prompt-rules.mjs');
  const recorded = await fixtureSources(fixtureDir);
  const bodies = [];
  const replay = recorded.ai.bind(recorded);
  recorded.ai = async (body, purpose) => { bodies.push({ purpose, body }); return replay(body, purpose); };
  const fixtureBase = { sources: recorded, fomcDecisions: recorded.manifest.macroCalendar['us-fomc'], earningsRows: recorded.manifest.earnings, earningsSource: 'Finnhub' };
  const firstRun = await buildEventBriefs({ ...fixtureBase, previous: null, nowMs });
  await buildEventBriefs({ ...fixtureBase, previous: firstRun, nowMs: nowMs + 3 * 3600000 });
  check('v59.59 each event-brief request is a registered purpose and uses its profile (token ceiling, effort, search bound)', () => {
    ok(bodies.length >= 4, `requests: ${bodies.map((row) => row.purpose)}`);
    for (const { purpose, body } of bodies) {
      const entry = sharedAiPurpose(`event-brief-${purpose}`);
      ok(entry, `unregistered purpose event-brief-${purpose}`);
      const profile = SHARED_AI_PROFILES[entry.profile];
      eq(body.reasoning.effort, profile.effort, purpose);
      eq(body.store, false, purpose);
      eq(Boolean(body.tools), entry.profile === 'search', purpose);
      if (entry.profile === 'structured') eq(body.max_output_tokens, profile.maxOutputTokens, purpose);
      else ok(body.max_tool_calls >= 1 && body.max_tool_calls <= 2 && body.max_output_tokens <= 1500, purpose);
      ok(body.text?.format?.type === 'json_schema' && body.text.format.strict === true, `${purpose}: strict JSON schema`);
    }
  });
  check('v59.59 brief prompts state the sentence ending, the no-trade rule, and (structured) Korean names and no repeated value', () => {
    for (const { purpose, body } of bodies) {
      const prompt = body.input[0].content;
      ok(prompt.includes(FORMAL_ENDING), `${purpose}: ending rule`);
      ok(prompt.includes(PROMPT_RULES.noTradeInstruction), `${purpose}: no-trade rule`);
      if (!body.tools) {
        ok(prompt.includes(PROMPT_RULES.koreanNames), `${purpose}: Korean names`);
        like(prompt, /text에는 value에 쓴 숫자를 다시 쓰거나 다른 단위로 바꿔 쓰지 않는다/, `${purpose}: no repeated value`);
      }
    }
  });
  const sent = [];
  const env = { AIO_AUTOMATION_TOKEN: 'x'.repeat(40), AI_PROXY_URL: 'https://fixture.workers.dev', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '2' };
  const payload = { status: 'completed', model: 'gpt-6-luna', usage: { input_tokens: 900, output_tokens: 120 },
    output: [{ type: 'web_search_call' }, { type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: '{"reasons":[]}' }] }] };
  const answer = await requestSharedJson(bodies[0].body, { env, purpose: 'event-brief-reasons-NVT', fetchImpl: async (url, init) => { sent.push(init); return new Response(JSON.stringify(payload), { status: 200 }); } });
  const failed = await requestSharedJson(bodies[0].body, { env, purpose: 'event-brief-reasons-NVT', fetchImpl: async () => new Response('{}', { status: 503 }) });
  check('v59.59 the event-brief transport keys each request by lane, run and attempt, and returns the usage counts', () => {
    like(sent[0].headers['X-AIO-Idempotency-Key'], /^event-brief-reasons-NVT-42-2-[0-9a-f-]{36}$/);
    eq(sent[0].redirect, 'error');
    same(answer, { json: { reasons: [] }, usage: { inputTokens: 900, outputTokens: 120, searchCalls: 1 } });
    same(failed, { reason: 'provider-http-503' });
  });
}

// v59.85: the KR weight refresh is due once per KRX session (calendar), not once per KST date — a weekend or holiday
// run keeps the published copy instead of refetching every 20 minutes and rewriting generatedAt.
{
  const { krWeightsDue } = await import('./fetch-kr-index-weights.mjs');
  const due = (iso, asOf) => krWeightsDue({ nowMs: Date.parse(iso), previousAsOf: asOf, hasPrevious: true }).due;
  check('v59.85 KR weights: Sunday after a Friday session is not due', () => eq(due('2026-11-08T14:00:00Z', '2026-11-06'), false));
  check('v59.85 KR weights: Monday 15:50 KST waits for the 16:10 publication', () => eq(due('2026-11-09T06:50:00Z', '2026-11-06'), false));
  check('v59.85 KR weights: Monday 16:15 KST is due', () => eq(due('2026-11-09T07:15:00Z', '2026-11-06'), true));
  check('v59.85 KR weights: a missed session is caught up before the next open', () => eq(due('2026-11-08T23:30:00Z', '2026-11-05'), true));
  check('v59.85 KR weights: the same session is not refetched', () => eq(due('2026-11-09T09:00:00Z', '2026-11-09'), false));
  check('v59.85 KR weights: a missed session is not caught up while the next one trades', () => eq(due('2026-11-10T01:00:00Z', '2026-11-06'), false));
}

if (failures.length) {
  console.error(`[event-briefs] ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('[event-briefs] ok');
