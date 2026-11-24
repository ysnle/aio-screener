#!/usr/bin/env node
// The server news bundle ranks by what an article is about and which session it
// covers, publishes in rank order, keeps topic floors as reserved capacity instead of first turn, and carries the closed
// intraday slot into the next 08:00 bundle. Unit cases use headlines from the committed bundles of 11/09-11/14.
// NEWS_SELECTION_MODULE=<file url> runs the same cases against another copy of scripts/lib/news-selection.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSections } from './lib/gate-sections.mjs';

const moduleUrl = process.env.NEWS_SELECTION_MODULE || new URL('./lib/news-selection.mjs', import.meta.url).href;
const ns = await import(moduleUrl);
const failures = [];
const check = (name, fn) => { try { fn(); } catch (error) { failures.push(`${name}: ${error.message.split('\n')[0]}`); } };
const at = (iso) => Date.parse(iso);
const scored = (row) => { const item = { ...row, ts: at(row.at) }; Object.assign(item, ns.scoreServerNewsItem(item)); return item; };
const report = () => {
  const failed = failures.splice(0);
  if (!failed.length) return;
  console.error(`[news-ranking] FAIL ${failed.length}:\n - ${failed.join('\n - ')}`);
  process.exit(1);
};

// 1-6 are unit cases on headline fixtures (code); 7 checks the committed bundle and also runs in a data run.
await runSections('news-ranking', [
['ranking-rules', async () => {

// 1. A tier-3 page that names one subject and broad market words is not news (11/14 a3c588ace, 거시 floor seat).
check('v60.18 a retail FX-rate page does not pass as a two-subject tier-3 headline', () => {
  const pakistan = scored({ title: 'Dollar rate in Pakistan today, Saturday 14 November: Rs277.00 (NBP), open market Rs279.50', link: 'https://e.test/pk', source: 'Investify', at: '2026-11-14T05:00:00Z', topic: 'fxbond', country: 'global', feedSource: 'Google News - FX/Bonds', scoringNowMs: at('2026-11-14T23:00:00Z') });
  assert.equal(pakistan.subjectHits, 1, 'v60.18 one subject (the dollar); "market" is context');
  const { out } = ns.selectNewsBundle([pakistan], []);
  assert.equal(out.length, 0, 'v60.18 the FX floor does not seat it');
});

// 2. Keyword stacking: on the CPI day (b49aa1f38) a single-name analyst note outranked the market story by 15-25 points.
check('v60.18 the CPI-day market story outranks a single-name note that names more keywords', () => {
  const nowMs = at('2026-11-10T23:00:00Z');
  const schedules = { 'us-cpi': ['2026-11-10'] };
  const note = scored({ title: 'Nvidia Stock Falls as Citi Trims Price Target Ahead of Earnings', source: 'Yahoo Finance', at: '2026-11-10T17:30:00Z', country: 'us', scoringNowMs: nowMs, scheduleDates: schedules });
  const kr = scored({ title: "물가·연준 '빅스텝' 우려에 뉴욕증시 하락…나스닥 0.7%↓(종합)", source: '연합뉴스', at: '2026-11-10T22:26:00Z', country: 'kr', topic: 'kr', scoringNowMs: nowMs, scheduleDates: schedules });
  const yields = scored({ title: 'Stocks fall as the 10-year Treasury yield nears 5% mark', source: 'MarketWatch', at: '2026-11-10T21:42:00Z', country: 'us', scoringNowMs: nowMs, scheduleDates: schedules });
  assert.ok(kr.score > note.score, `v60.18 KR CPI story ${kr.score} > note ${note.score}`);
  assert.ok(yields.score > note.score, `v60.18 10-year story ${yields.score} > note ${note.score}`);
  assert.match(kr.selectionReason, /scheduled-us-cpi\+/, 'v60.18 the release scheduled for the day is named in the reason');
  const unscheduled = scored({ title: "물가·연준 '빅스텝' 우려에 뉴욕증시 하락…나스닥 0.7%↓(종합)", source: '연합뉴스', at: '2026-11-10T22:26:00Z', country: 'kr', topic: 'kr', scoringNowMs: nowMs, scheduleDates: { 'us-cpi': ['2026-12-10'] } });
  assert.doesNotMatch(unscheduled.selectionReason, /scheduled-/, 'v60.18 no bonus on a day without the release');
});

// 3. Recency is the session the article covers, New York and Seoul clocks, daylight time included.
check('v60.18 recency follows the latest completed session, not hours before the cut', () => {
  const r = ns.newsSessionRecency;
  assert.equal(typeof r, 'function', 'v60.18 the recency rank is exported');
  const cut = at('2026-11-10T23:00:00Z');
  assert.deepEqual(['2026-11-10T22:26:00Z', '2026-11-10T17:30:00Z', '2026-11-10T13:30:00Z', '2026-11-09T18:00:00Z'].map((iso) => r(at(iso), cut, 'us')), [18, 15, 10, 4], 'v60.18 recency ranks follow the US session');
  const summerCut = at('2026-07-15T23:00:00Z');
  assert.deepEqual(['2026-07-15T20:30:00Z', '2026-07-15T19:30:00Z'].map((iso) => r(at(iso), summerCut, 'us')), [18, 15], 'v60.18 the 20:00Z close in daylight time');
  assert.deepEqual(['2026-11-10T07:00:00Z', '2026-11-10T03:00:00Z'].map((iso) => r(at(iso), cut, 'kr')), [18, 15], 'v60.18 the Korean close at 06:30Z');
});

// 4. Floors are reserved seats, not first turn (11/09 7564d42d6: gold/crude floor rows filled `oil` before the session wrap).
check('v60.18 topic floors do not use the entity caps ahead of a higher-ranked session wrap', () => {
  const row = (title, topic, score, i) => ({ title, link: `https://e.test/f${i}`, source: `Pub${i}`, tier: 1, score, topicHits: 2, subjectHits: 2, topic, ts: at('2026-11-09T20:00:00Z') - i * 60000, eventTime: new Date(at('2026-11-09T20:00:00Z') - i * 60000).toISOString() });
  const pool = [
    row('Wall St jumps as oil slide cools inflation worries; Nvidia slumps', 'macro', 90, 0),
    row('Gold, silver advance as crude oil retreats on diplomacy', 'fxbond', 60, 1),
    row('Bullion firms while Brent oil slips toward eighty dollars', 'fxbond', 58, 2),
    row('Yen gains as oil importers cheer cheaper barrels', 'fxbond', 56, 3),
    row('Refiners cut runs as heating oil spreads narrow', 'energy', 54, 4),
  ];
  const { out } = ns.selectNewsBundle(pool, []);
  assert.ok(out.some((r) => /^Wall St jumps/.test(r.title)), 'v60.18 the wrap is seated');
  assert.equal(out[0].title.slice(0, 13), 'Wall St jumps', 'v60.18 and published first');
});

// 5. Published order is rank order; the reserved Korean seats decide entry only.
check('v60.18 the bundle is published in rank order', () => {
  const row = (title, topic, score, i, country = 'us') => ({ title, link: `https://e.test/o${i}`, source: `Pub${i}`, tier: 2, score, topicHits: 2, subjectHits: 2, topic, country, ts: at('2026-11-11T20:00:00Z') - i * 60000, eventTime: new Date(at('2026-11-11T20:00:00Z') - i * 60000).toISOString() });
  const { out } = ns.selectNewsBundle([row('CoreWeave sparks AI cloud stock rally', 'semi', 78, 1)], [row('코스피 2.60%·코스닥 5.62% 동반 급등', 'kr', 64, 2, 'kr')]);
  assert.deepEqual(out.map((r) => r.score), [78, 64], 'v60.18 the floors keep their scores');
});

// 6. The intraday slot's rows are candidates of the bundle that closes over them (11/09 22:24Z 9b0d25ee4 → 23:24Z 7564d42d6).
check('v60.18 the closed intraday slot is carried into the next 08:00 bundle', () => {
  assert.equal(typeof ns.carriedIntradayCandidates, 'function', 'v60.18 the intraday carry is exported');
  const cycle = ns.getKst0800NewsCycle(at('2026-11-09T23:24:00Z'));
  const rows = [
    { title: 'Wall St jumps as oil slide cools inflation worries; Nvidia slumps', link: 'https://e.test/i1', source: 'Reuters', publishedAt: '2026-11-09T21:01:00.000Z', topic: 'macro', market: 'us', tier: 1 },
    { title: 'Previous-cycle headline', link: 'https://e.test/i2', source: 'Reuters', publishedAt: '2026-11-08T21:01:00.000Z', topic: 'macro', market: 'us', tier: 1 },
  ];
  assert.deepEqual(ns.carriedIntradayCandidates(rows, cycle).map((r) => r.link), ['https://e.test/i1'], 'v60.18 only the current intraday row is carried');
  const planes = readFileSync(new URL('./producer/source-planes.mjs', import.meta.url), 'utf8');
  assert.match(planes, /carryIntraday: prior\.newsIntraday/, 'v60.18 the news plane passes the previous intraday slot');
  assert.match(planes, /newsIntraday: previous && Array\.isArray\(previous\.newsIntraday\)/, 'v60.18 and reads it from the previous data.json');
});

report();
console.log('[news-ranking] ok: subject-based score, session recency, scheduled releases, reserved floors and the carried intraday slot');
}, 'code'],
// 7. The committed bundle, once cut under this rule: rank order, and no tier-3 row on one subject outside the Korean seats.
['published-bundle', async () => {
const data = JSON.parse(readFileSync(new URL('../public-data/data.json', import.meta.url), 'utf8'));
if (data?.meta?.newsRankingRule && data.meta.newsRankingRule === ns.NEWS_RANKING_RULE) {
  check('v60.18 public-data news is in rank order and every tier-3 row names two subjects', () => {
    const news = Array.isArray(data.news) ? data.news : [];
    news.forEach((row, i) => { if (i) assert.ok(Number(news[i - 1].score) >= Number(row.score), `v60.18 row ${i} ${row.score} after ${news[i - 1].score}`); });
    for (const row of news.filter((r) => Number(r.tier) >= 3 && r.topic !== 'kr')) {
      const item = { title: row.title, source: row.source, ts: Date.parse(row.eventTime || ''), topic: row.topic, country: row.country, scoringNowMs: Date.parse(row.newsCycleEnd || '') };
      ns.scoreServerNewsItem(item);
      assert.ok(item.subjectHits >= 2, `v60.18 ${row.title.slice(0, 60)} has ${item.subjectHits} subject(s)`);
    }
  });
} else {
  console.log(`[news-ranking] public-data/data.json was cut under ${data?.meta?.newsRankingRule || 'the previous rule'}; the artifact check starts with the first refresh under ${ns.NEWS_RANKING_RULE || 'v60.18'}.`);
}

report();
console.log('[news-ranking] ok: published bundle rank order');
}, 'data'],
]);
