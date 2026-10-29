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
import { recentBriefs, latestBriefFor, numberTokens, verifyQuotedItems, EVENT_BRIEFS_SCHEMA } from '../src/domain/briefing/event-briefs.js';

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

if (failures.length) {
  console.error(`[event-briefs] ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('[event-briefs] ok');
