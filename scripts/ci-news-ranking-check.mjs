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

// 5b. The day's large stock moves are searched by company and seated on top of the bundle, one headline per company.
check('v60.57 movers: a headline naming the day\'s mover takes a seat beyond the bundle, one per company', () => {
  const row = (title, i, extra = {}) => ({ title, link: `https://e.test/m${i}`, source: `Pub${i}`, tier: 2, score: 80 - i * 0.5, topicHits: 2, subjectHits: 2, topic: 'macro', country: 'us',
    ts: at('2026-11-20T20:00:00Z') - i * 60000, eventTime: new Date(at('2026-11-20T20:00:00Z') - i * 60000).toISOString(), ...extra });
  // Five more unrelated headlines than the bundle holds (no shared word, so no two read as one event or one topic).
  const word = (n) => [...n.toString(26)].map((c) => String.fromCharCode(97 + parseInt(c, 26))).join('');
  const general = Array.from({ length: ns.NEWS_BUNDLE_SIZE + 5 }, (_, i) => row([0, 1, 2, 3, 4].map((k) => `q${word(20000 + i * 5 + k)}`).join(' '), i));
  const mover = (title, sym, i) => row(title, 200 + i, { score: 30, topicHits: 1, subjectHits: 1, topic: 'equity', feedSource: ns.NEWS_MOVER_FEED, mover: sym });
  const movers = [mover('Micron plunges fourteen percent as memory prices crack', 'MU', 1), mover('Micron shares sink again on DRAM contract cuts', 'MU', 2), mover('Analog Devices tumbles after weak industrial orders', 'ADI', 3)];
  const base = ns.selectNewsBundle(general.map((item) => ({ ...item })), []).out;
  const { out } = ns.selectNewsBundle([...general.map((item) => ({ ...item })), ...movers], []);
  assert.equal(base.length, ns.NEWS_BUNDLE_SIZE, `v60.57 movers: without movers the bundle is full (${base.length})`);
  assert.equal(out.length, ns.NEWS_BUNDLE_SIZE + 2, `v60.57 movers: two companies, two seats on top (${out.length})`);
  assert.deepEqual(out.filter((r) => r.mover).map((r) => r.mover).sort(), ['ADI', 'MU'], 'v60.57 movers: one headline per company, tagged with it');
  assert.equal(out.filter((r) => !r.mover).length, ns.NEWS_BUNDLE_SIZE, 'v60.57 movers: no other topic loses a seat');
  const day = { sessions: { us: '2026-11-20' }, facts: [
    { kind: 'stock-move', date: '2026-11-20', rank: 'major', materiality: 70, subjects: ['MU'], label: 'Micron Technology' },
    { kind: 'stock-move', date: '2026-11-20', rank: 'lead', materiality: 95, subjects: ['NVDA'], label: 'NVIDIA' },
    { kind: 'stock-move', date: '2026-11-20', rank: 'minor', materiality: 20, subjects: ['XYZ'], label: 'Small Co' },
    { kind: 'stock-move', date: '2026-11-19', rank: 'lead', materiality: 99, subjects: ['OLD'], label: 'Yesterday Inc' },
    { kind: 'group-move', date: '2026-11-20', rank: 'lead', materiality: 90, label: '반도체' }] };
  assert.deepEqual(ns.newsMoversOf(day).map((m) => m.sym), ['NVDA', 'MU'], 'v60.57 movers: the latest session\'s lead and major stock moves, largest first');
  assert.deepEqual(ns.newsMoversOf(null), [], 'v60.57 movers: no ledger, no searches');
  const eligible = Array.from({ length: 768 }, (_, i) => `S${i}`);
  const plan = ns.planTickerNewsTargets(eligible, 0, { movers: ['S700', 'S3', 'S701', 'NOT-LISTED'] });
  assert.deepEqual([plan.targets.length, plan.movers, plan.targets.slice(-2)], [ns.TICKER_NEWS_RUN_CAP + 2, 2, ['S700', 'S701']], 'v60.57 movers: a mover outside this run\'s rotation is fetched now, on top of the cap');
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
// 8. The 뉴스 filter panel (src/domain/news/feed-filter.js) and the card's one extracted fact (article-facts.js).
['feed-filter', async () => {
const ff = await import('../src/domain/news/feed-filter.js');
const af = await import('../src/domain/news/article-facts.js');
const controls = await import('../src/ui/components/news-controls.js');
const article = (id, extra = {}) => ({ newsId: id, link: `https://e.test/${id}`, title: `Headline ${id}`, source: 'Reuters', country: 'us', topic: 'macro', pubDate: '2026-11-25T20:00:00Z', ...extra });
const items = [
  article('a1', { title: 'Nvidia slides as memory prices fall', topic: 'semi', issuers: ['NVDA'] }),
  article('a2', { title: 'Fed holds rates, Powell signals patience', issuers: [] }),
  article('a3', { title: '삼성전자 HBM 공급 확대', country: 'kr', topic: 'kr', issuers: ['005930'] }),
  article('a4', { title: 'Oil climbs on OPEC supply cut', country: 'global', topic: 'energy', issuers: [] }),
  article('a5', { title: 'Nvidia results beat estimates', topic: 'earnings', issuers: ['NVDA'], fact: { kind: '수치', text: 'x' } }),
  article('a6', { title: 'Unclassified line', country: 'xx', topic: 'general', issuers: [] })
];
const rows = ff.describeFeedRows(items, { read: (item) => ({ title: item.title, issuers: item.issuers, fact: item.fact || null }), mine: new Set(['005930']), keyOf: (item) => item.newsId });
check('v60.59 feed rows read region, topic group and entities from the article and the page\'s issuer reading', () => {
  assert.deepEqual(rows.map((row) => row.region), ['us', 'us', 'kr', 'global', 'us', ''], 'v60.59 regions');
  assert.deepEqual(rows.map((row) => row.topic), ['semi', 'macro', 'equity', 'energy', 'earnings', ''], 'v60.59 topic groups (general belongs to none)');
  assert.ok(rows[0].entityKeys.has('T:NVDA') && rows[0].entityKeys.has('K:memory'), 'v60.59 a ticker and a keyword entity');
  assert.ok(rows[1].entityKeys.has('K:fed') && !rows[1].entityKeys.has('K:ai'), 'v60.59 keywords go through the whole-word rule ("said" is not AI)');
  assert.equal(rows[2].mine, true, 'v60.59 a held symbol marks the row as 내 종목');
  assert.equal(ff.topicGroupFor('geo'), 'policy', 'v60.59 a handed-over row topic opens its group');
  assert.equal(ff.topicGroupFor('nope'), '', 'v60.59 an unknown topic opens nothing');
});
check('v60.59 every chip counts what pressing it would show; a row adds up to its 전체 chip; empty chips are hidden', () => {
  const facets = ff.feedFacets(rows, { topic: 'semi' });
  const region = Object.fromEntries(facets.region.map((chip) => [chip.key, chip.count]));
  assert.equal(region.all, 1, 'v60.59 with 반도체·AI pressed, the region row counts one article');
  assert.ok(!('kr' in region) && !('asia' in region), 'v60.59 a region with no article under the other choices is hidden');
  const topic = Object.fromEntries(ff.feedFacets(rows, {}).topic.map((chip) => [chip.key, chip.count]));
  assert.equal(topic.all, 6, 'v60.59 topic 전체 is every row');
  assert.equal(topic.semi + topic.macro + topic.equity + topic.energy + topic.earnings, 5, 'v60.59 the groups add up to 전체 less the unclassified row');
  const pressedEmpty = ff.feedFacets(rows, { region: 'eu' }).region.find((chip) => chip.key === 'eu');
  assert.ok(pressedEmpty && pressedEmpty.pressed && pressedEmpty.count === 0, 'v60.59 a pressed chip stays at 0 so it can be released');
  const entity = ff.feedFacets(rows, {}).entity;
  assert.equal(entity[1].key, 'T:NVDA', 'v60.59 the most-named entity leads the entity row');
  assert.equal(entity[1].count, 2, 'v60.59 NVDA is named by two articles');
  assert.ok(ff.feedFacets(rows, {}, { entityLimit: 2 }).entity.length === 3, 'v60.59 the entity row keeps the top N plus 전체');
});
check('v60.59 the filter narrows by every row at once; search reads title, source and entity; 수치 있음 keeps figure facts', () => {
  assert.deepEqual(ff.applyFeedFilter(rows, { entity: 'T:NVDA' }).map((row) => row.key), ['a1', 'a5'], 'v60.59 entity');
  assert.deepEqual(ff.applyFeedFilter(rows, { entity: 'T:NVDA', topic: 'earnings' }).map((row) => row.key), ['a5'], 'v60.59 entity and topic');
  assert.deepEqual(ff.applyFeedFilter(rows, { figure: true }).map((row) => row.key), ['a5'], 'v60.59 수치 있음');
  assert.deepEqual(ff.applyFeedFilter(rows, { query: 'opec' }).map((row) => row.key), ['a4'], 'v60.59 search by title word');
  assert.equal(ff.applyFeedFilter(rows, { query: 'reuters nvda' }).length, 2, 'v60.59 search words all match (source and entity)');
  assert.deepEqual(ff.applyFeedFilter(rows, { mine: true }).map((row) => row.key), ['a3'], 'v60.59 내 종목');
  assert.equal(ff.applyFeedFilter(rows, { region: 7, topic: null }).length, 6, 'v60.59 a malformed choice reads as no filter');
  assert.deepEqual(ff.feedTiles(rows), { articles: 6, withFact: 1, withFigure: 1 }, 'v60.59 tiles: articles, joined facts, figures');
});
check('v60.59 a card\'s fact is joined from published extractions only: brief, ledger move, next report; no join, no line', () => {
  const nowMs = at('2026-11-26T00:00:00Z');
  const briefs = { schemaVersion: 'event-briefs.v1', briefs: [
    { id: 'b1', symbol: 'DE', status: 'complete', publishedAt: '2026-11-25T11:00:00Z', headline: '디어 4분기 순이익 10억5100만 달러', figures: [{ label: 'EPS', value: '$ 3.89' }] },
    { id: 'b2', symbol: 'AMD', status: 'complete', publishedAt: '2026-11-25T11:00:00Z', headline: 'AMD 3분기 사상 최대 매출', figures: [] },
    { id: 'b3', symbol: 'MU', status: 'complete', publishedAt: '2026-11-20T11:00:00Z', headline: '마이크론 실적', figures: [{ label: 'EPS', value: '$1' }] }
  ] };
  const day = { facts: [
    { id: 'stock:NVDA:2026-11-25', kind: 'stock-move', label: 'NVIDIA', change: -3.91, materiality: 70, date: '2026-11-25', subjects: ['NVDA'] },
    { id: 'headline:h1', kind: 'headline', title: 'Nvidia slides', src: { link: 'https://e.test/n1' } }
  ], links: [{ from: 'headline:h1', to: 'stock:NVDA:2026-11-25', basis: 'subject' }] };
  const calendar = { earnings: [], upcoming: { CRM: '2026-12-02|amc' } };
  const read = af.articleFactReader({ day, briefs, calendar, nowMs });
  const pub = '2026-11-25T14:00:00Z';
  assert.equal(read(article('d1', { pubDate: pub }), { issuers: ['DE'] })?.kind, '수치', 'v60.59 a release brief with figures is 수치');
  assert.equal(read(article('d2', { pubDate: pub }), { issuers: ['AMD'] })?.kind, '보도', 'v60.59 a brief that kept only its headline is 보도');
  assert.equal(read(article('d3', { pubDate: pub }), { issuers: ['MU'] }), null, 'v60.59 a brief five days before the article is not its fact');
  const move = read(article('n1', { title: 'Nvidia slides', pubDate: pub }), { issuers: ['NVDA'] });
  assert.ok(move?.kind === '수치' && move.text.startsWith('관련 움직임 NVIDIA'), `v60.59 a ledger-linked move is 수치 (${move?.text})`);
  const next = read(article('c1', { pubDate: pub }), { issuers: ['CRM'] });
  assert.ok(next?.kind === '일정' && next.text.startsWith('CRM 실적 발표 12/2'), `v60.59 the issuer's next report is 일정 (${next?.text})`);
  assert.equal(read(article('z1', { pubDate: pub }), { issuers: [] }), null, 'v60.59 no join, no fact line');
});
check('v60.59 the panel state keeps known keys of the right type, and a reset leaves the sort', () => {
  controls.setNewsFeedFilter({ entityFilter: 'T:NVDA', figureOnly: true, query: 'fed', sortMode: 'score', bogus: 1, mineOnly: 'yes' });
  const set = controls.getNewsSurfaceControls();
  assert.ok(set.entityFilter === 'T:NVDA' && set.figureOnly === true && set.query === 'fed' && set.mineOnly === false && !('bogus' in set), 'v60.59 set');
  const reset = controls.resetNewsFeedFilter();
  assert.ok(reset.entityFilter === 'all' && reset.figureOnly === false && reset.query === '' && reset.sortMode === 'score', 'v60.59 reset keeps the sort');
  controls.setNewsFeedFilter({ sortMode: 'time' });
});
report();
console.log('[news-ranking] ok: feed filter counts, narrowing and joined facts');
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
