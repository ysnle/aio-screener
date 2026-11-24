#!/usr/bin/env node
// v60.51 (owner audit 2026-11-23, 오늘·브리핑·뉴스): on 11/23 the S&P 500 rose 4.7% and NVDA 31.5% after Jensen Huang's
// return as Nvidia CEO, yet 오늘의 핵심 said "NVIDIA +31.5% — S&P 500 지수에 +160bp만큼 영향을 줬습니다. 업종이 따르는
// 가격과 같은 방향입니다." with no report beside it, its three headlines were about other stories, and 뉴스's 중요 뉴스
// stopped at 08:00 KST. This gate holds, on fixtures built here (never live public-data):
//   1. a lead move's line states its index pull in %p; with linked reports its top one (the ledger's order: tier, score,
//      materiality) stands as written on the face of 오늘 and 브리핑; with none, the driver price is named instead;
//   2. every figure of those lines is a claim that holds against the ledger;
//   3. a story tied to a lead move outranks a higher-scored unrelated one; "CEO 복귀" is not entertainment, a celebrity
//      comeback still is;
//   4. the important pool rolls to the newest article past the 08:00 cut;
//   5. internal bookkeeping lines are not drawn, and 오늘's stock row is titled for what it holds.
//   node scripts/ci-day-cause-check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { buildDayAccount, byReportOrder } from '../src/domain/briefing/day-account.js';
import { leadLinkedNews, pickImportantNews, reportAboutMove, rollingNewsPool } from '../src/domain/briefing/news-picks.js';
import { renderTickerContext } from '../src/ui/components/ticker-context.js';
import { eventPreviews } from '../src/domain/briefing/event-guide.js';
import { isBlacklistedNewsText } from '../src/domain/news/selection.js';
import { renderHomeDay } from '../src/ui/components/home-day.js';
import { renderBriefingDay } from '../src/ui/components/briefing-day.js';
import { EVENT_BRIEFS, INDEX_LONGRUN, MARKET_DAY } from '../src/data/artifact-registry.js';
import { saidIssues, isClaimError } from './lib/claim-validate.mjs';
import { cleanNewsTitle, stripTranslatedColumnLabel } from './lib/news-selection.mjs';
import { headlineForTranslation, translateHeadlines } from './producer/market-narrative.mjs';
import { ledgerFacts } from './lib/claim-facts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');
const failures = [];
const why = (error) => (error?.generatedMessage === false && 'actual' in error ? `${error.message}: actual ${inspect(error.actual)}, expected ${inspect(error.expected)}` : String(error?.message));
const pending = [];
const failed = (label, error) => { failures.push(label); console.log(`  FAIL ${label}\n       ${why(error).replace(/\s+/g, ' ').slice(0, 600)}`); };
const check = (label, fn) => {
  try {
    const result = fn();
    if (result?.then) pending.push(result.then(() => console.log(`  ok  ${label}`), (error) => failed(label, error)));
    else console.log(`  ok  ${label}`);
  } catch (error) { failed(label, error); }
};

// A minimal DOM: enough for the two components to render their faces into text (details/summary included).
function fakeDocument(ids) {
  const node = (tag) => ({
    tag, children: [], className: '', title: '', hidden: false, id: '', dataset: {}, style: { setProperty() {} }, _text: '',
    setAttribute() {}, append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = kids; },
    after() {}, remove() {}, querySelector: () => null,
    set textContent(value) { this._text = String(value); this.children = []; },
    get textContent() { return this._text + this.children.map((kid) => kid.textContent).join(' '); }
  });
  const byId = Object.fromEntries(ids.map((id) => [id, node('section')]));
  return { createElement: node, getElementById: (id) => byId[id] || null, byId };
}
// The face is what is not inside a <details> fold.
const faceText = (n) => (n.tag === 'details' ? '' : n._text + ' ' + n.children.map(faceText).join(' '));

// ── 1–2. The day account on a fixture ledger of the 11/23 shape.
const D = '2026-11-23';
const ledger = (withReports, extra = []) => {
  const report = (id, extra) => ({ id, kind: 'headline', date: D, subjects: ['NVDA'], rank: 'lead', materiality: 80, ...extra });
  const facts = [
    { id: `price:spx:${D}`, kind: 'price', asset: 'spx', label: 'S&P 500', date: D, change: 4.73, z: 5, rank: 'lead', materiality: 100 },
    { id: `price:soxx:${D}`, kind: 'price', asset: 'soxx', label: '반도체(SOXX)', date: D, change: 13.63, z: 4, rank: 'lead', materiality: 95 },
    { id: `stock:NVDA:${D}`, kind: 'stock-move', subjects: ['NVDA'], label: 'NVIDIA', date: D, change: 31.48, z: 8, indexBp: 160.2, themes: ['semiconductor'], sector: 'Technology',
      rank: 'lead', materiality: 100, explainedBy: withReports ? ['subject', 'driver'] : ['driver'] },
    { id: `group:theme:semiconductor:${D}`, kind: 'group-move', group: 'theme:semiconductor', label: '반도체', date: D, change: 13.49, members: ['NVDA', 'AMD', 'INTC'],
      leaders: [{ sym: 'NVDA', change: 31.48 }, { sym: 'AMD', change: 20.4 }], rank: 'lead', materiality: 100, explainedBy: ['member', 'driver'] },
    { id: `stock:AAPL:${D}`, kind: 'stock-move', subjects: ['AAPL'], label: 'Apple', date: D, change: 1.9, z: 0.9, indexBp: 15.9, rank: 'major', materiality: 48, explainedBy: [] },
    // Three linked reports, listed out of the ledger's order: a company memo (unrated), a tier-2 wire with the higher
    // score, and the tier-1 wrap, which is the one shown.
    ...(withReports ? [
      report('memo:NVDA:0', { title: 'Nvidia shares jump', titleKo: '엔비디아 주가 급등', at: '2026-11-23T15:00:00.000Z', tier: null, score: null, materiality: 90, src: { kind: 'company-news' } }),
      report('headline:yonhap', { title: '뉴욕증시, 젠슨 황 엔비디아 CEO 재임명에 상승 출발', at: '2026-11-23T14:45:32.000Z', tier: 2, score: 90, src: { kind: 'news', link: 'https://fixture.invalid/yonhap' } }),
      report('headline:huang', { title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets: Markets Wrap', titleKo: '황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등: 시장 마감',
        at: '2026-11-23T21:11:01.000Z', tier: 1, score: 81, src: { kind: 'news', link: 'https://fixture.invalid/huang' } }),
      // A tier-1 report naming a member that did not lead the group, with no word for the move.
      report('headline:intc', { subjects: ['INTC'], title: 'Intel, Meta among AI stocks hedge funds are buying - Goldman', titleKo: '헤지펀드가 매수하는 AI 주식에 Intel, Meta 포함 - Goldman',
        at: '2026-11-23T16:00:00.000Z', tier: 1, score: 95, src: { kind: 'news' } })
    ] : []),
    ...extra
  ];
  const links = [
    ...(withReports ? ['memo:NVDA:0', 'headline:yonhap', 'headline:huang'].map((from) => ({ from, to: `stock:NVDA:${D}`, basis: 'subject' })) : []),
    { from: `price:soxx:${D}`, to: `stock:NVDA:${D}`, basis: 'driver' }, { from: `price:soxx:${D}`, to: `group:theme:semiconductor:${D}`, basis: 'driver' },
    { from: `stock:NVDA:${D}`, to: `group:theme:semiconductor:${D}`, basis: 'member' }
  ];
  return { schemaVersion: 'market-day.v1', generatedAt: '2026-11-24T00:52:00.000Z', sessions: { us: D }, facts, links,
    threads: [{ id: `thread:stock:NVDA:${D}`, lead: `stock:NVDA:${D}`, facts: [`stock:NVDA:${D}`, `group:theme:semiconductor:${D}`] }] };
};
const told = buildDayAccount(ledger(true));
const bare = buildDayAccount(ledger(false));
const nvda = (account) => account.stories.find((story) => story.id === `story:stock:NVDA:${D}`) || {};
const HUANG = '황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등: 시장 마감';

check('v60.51 C3 a lead move states its pull in %p and carries its top linked report as written', () => {
  assert.equal(nvda(told).line, 'S&P 500을 1.6%p 끌어올렸습니다.', 'v60.51 C3 NVDA line');
  assert.equal(nvda(told).report?.title, HUANG, 'v60.51 C3 NVDA top report');
  assert.deepEqual(nvda(told).evidence.map((row) => row.title), [HUANG, '뉴욕증시, 젠슨 황 엔비디아 CEO 재임명에 상승 출발', '엔비디아 주가 급등'], 'v60.51 C3 report order');
});
check('v60.51 C3 the report order is the ledger\'s: tier first, then score, then materiality', () => {
  const rows = [{ id: 'a', tier: 2, score: 95 }, { id: 'b', tier: 1, score: 60 }, { id: 'c', tier: null, score: 99, materiality: 99 }, { id: 'd', tier: 1, score: 70 }];
  assert.deepEqual([...rows].sort(byReportOrder).map((row) => row.id), ['d', 'b', 'a', 'c'], 'v60.51 C3 byReportOrder');
});
check('v60.51 C3 no linked report: no report line, the driver price named with its move', () => {
  assert.equal(nvda(bare).line, 'S&P 500을 1.6%p 끌어올렸습니다. 반도체(SOXX) +13.6%와 같은 방향입니다.', 'v60.51 C3 NVDA line without a report');
  assert.equal(nvda(bare).report, null, 'v60.51 C3 no report');
  assert.equal(told.stories.find((story) => story.rank !== 'lead')?.report ?? null, null, 'v60.51 C3 only a lead story carries a face report');
});
check('v60.51 C3 a group shows a report only when it is about the group\'s move', () => {
  const semis = (account) => account.stories.find((story) => story.id === `story:group:theme:semiconductor:${D}`) || {};
  // The member report with no move word stays folded; the lead stock's report is the lead stock's line: no group line.
  assert.equal(semis(told).report, null, 'v60.51 C3 반도체 shows no unrelated report');
  const amd = (id, at, titleKo) => ({ id, kind: 'headline', date: at.slice(0, 10), subjects: ['AMD'], rank: 'major', materiality: 40, title: 'AMD shares', titleKo, at, tier: 1, score: 90, src: { kind: 'news' } });
  const withLeader = buildDayAccount(ledger(true, [amd('headline:amd-old', '2026-11-19T15:00:00.000Z', 'AMD 주가 급등, 지난주 랠리'), amd('headline:amd', '2026-11-23T18:00:00.000Z', 'AMD 주가 급등')]));
  assert.equal(semis(withLeader).report?.title, 'AMD 주가 급등', 'v60.51 C3 a leader\'s report inside the session window');
  assert.equal(nvda(withLeader).report?.title, HUANG, 'v60.51 C3 NVDA keeps its own');
});
check('v60.51 C1 no internal wording and no bp-of-index unit in any story', () => {
  const text = [told, bare].flatMap((account) => [account.opening, ...[...account.stories, ...account.more].flatMap((story) => [story.title, story.line, ...story.why])]).join(' ');
  assert.equal(/업종이 따르는 가격|bp만큼|지수에 [+-]?\d+bp/.test(text), false, `v60.51 C1 wording ${text}`);
});
check('v60.51 C3 every figure of the told account is a claim that holds against the ledger', () => {
  const facts = ledgerFacts(ledger(true));
  const parts = [{ text: told.opening, claims: told.claims.opening }, ...[...told.stories, ...told.more].map((story) => ({ text: [story.title, story.line, ...story.why].join(' '), claims: story.claims }))];
  const errors = parts.flatMap((part) => saidIssues(part, facts).filter(isClaimError).map((issue) => `${issue.check}: ${issue.message}`));
  assert.deepEqual(errors, [], 'v60.51 C3 claim errors');
});
check('v60.51 C3 오늘 and 브리핑 show the lead report on the face, not folded', () => {
  const home = fakeDocument(['home-day']);
  renderHomeDay({ documentRef: home, root: { [MARKET_DAY.key]: ledger(true) } });
  assert.match(faceText(home.byId['home-day']), /관련 보도: 황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등/, 'v60.51 C3 오늘 face');
  const brief = fakeDocument(['briefing-day', 'briefing-day-title', 'briefing-day-opening', 'briefing-day-stories', 'briefing-day-folds']);
  renderBriefingDay({ documentRef: brief, root: { [MARKET_DAY.key]: ledger(true), [EVENT_BRIEFS.key]: { briefs: [] }, [INDEX_LONGRUN.key]: {} } });
  const stories = brief.byId['briefing-day-stories'];
  assert.match(faceText(stories), /관련 보도: 황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등/, 'v60.51 C3 브리핑 face');
  assert.match(stories.textContent, /다른 보도 2건/, 'v60.51 C3 브리핑 folds the other reports');
});

check('v60.51 C3 an outlet column label leaves the headline and its stored translation, a colon inside stays', () => {
  const wrap = 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets: Markets Wrap';
  assert.equal(cleanNewsTitle(`${wrap} - Bloomberg.com`, 'Bloomberg.com'), 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets', 'v60.51 C3 bundle title');
  assert.equal(headlineForTranslation(wrap), 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets', 'v60.51 C3 sent for translation');
  assert.equal(stripTranslatedColumnLabel(wrap, `${HUANG}`), '황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등', 'v60.51 C3 stored translation');
  assert.equal(stripTranslatedColumnLabel('뉴욕증시 동향: 시장 마감', '뉴욕증시 동향: 시장 마감'), '뉴욕증시 동향: 시장 마감', 'v60.51 C3 a Korean original keeps its words');
  assert.equal(cleanNewsTitle('Fed: Rates on hold as inflation cools', ''), 'Fed: Rates on hold as inflation cools', 'v60.51 C3 a colon inside stays');
});
check('v60.51 C3 a stored translation is reused under the cleaned title without the label', async () => {
  const items = [{ title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets' }];
  const run = await translateHeadlines(items, { previous: [{ title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets: Markets Wrap', titleKo: HUANG }] });
  assert.equal(run.reused, 1, 'v60.51 C3 reused');
  assert.equal(items[0].titleKo, '황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등', 'v60.51 C3 reused translation');
});

// ── 2b. One rule for the report of a move: the 종목 header uses the same one as 오늘·브리핑.
check('v60.51 the 종목 header shows a report only when it is about the move, and the move either way', () => {
  const rows = [
    { title: 'Bessent says US is demanding answers on Nvidia chip sales to China', titleKo: '베선트, 미국이 Nvidia의 중국 칩 판매와 관련해 답변을 요구하고 있다고 밝혀', pubDate: '2026-11-22T17:53:00Z', tier: 1, score: 90, link: 'https://fixture.invalid/bessent' },
    { title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets', titleKo: '황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등', pubDate: '2026-11-23T21:11:01Z', tier: 1, score: 81, link: 'https://fixture.invalid/huang' },
    { title: 'Micron sets date for its quarterly report', titleKo: '마이크론, 분기 실적 발표일 공개', pubDate: '2026-11-23T13:00:00Z', tier: 1, score: 70, link: 'https://fixture.invalid/mu' }
  ];
  const header = (symbol, name, ret1d) => {
    const doc = fakeDocument([]);
    const host = doc.createElement('div');
    renderTickerContext(doc, host, { root: { _serverNewsIntraday: rows }, store: null, symbol, name, row: { factorSessionDate: D, ret1d } });
    return host.textContent.replace(/\s+/g, ' ').trim();
  };
  const nv = header('NVDA', 'NVIDIA', 31.48);
  assert.match(nv, /11\/23 \+31\.5%/, 'v60.51 NVDA move');
  assert.match(nv, /황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등/, 'v60.51 NVDA report about the move');
  assert.equal(/베선트/.test(nv), false, 'v60.51 a report that states no move is not the move\'s report');
  assert.equal(header('MU', 'Micron Technology', 19.04), '11/23 +19.0%', 'v60.51 MU: the move prints, no report line');
  assert.equal(reportAboutMove({ title: 'Nvidia shares fall', at: '2026-11-23T18:00:00Z' }, { session: D, change: null })?.recap, false, 'v60.51 unknown move, before the close');
  assert.equal(reportAboutMove({ title: 'Nvidia shares fall', at: '2026-11-23T22:00:00Z' }, { session: D, change: null }), null, 'v60.51 unknown move, after the close');
});

// ── 3. Market-impact order and the blacklist.
check('v60.51 C7 a story tied to a lead move outranks a higher-scored unrelated one', () => {
  const unrelated = { title: 'Korean bond yields fall', titleKo: '국고채 금리 일제히 하락', link: 'https://fixture.invalid/kr', topic: 'kr', score: 75 };
  const huang = { title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets: Markets Wrap', titleKo: '황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등', link: 'https://fixture.invalid/huang', topic: 'macro', score: 70 };
  assert.equal(pickImportantNews([unrelated, huang], 1)[0]?.link, unrelated.link, 'v60.51 C7 without the ledger the score decides');
  assert.equal(pickImportantNews([unrelated, huang], 1, { linked: leadLinkedNews(ledger(true)) })[0]?.link, huang.link, 'v60.51 C7 with the ledger the linked story leads');
  assert.equal(pickImportantNews([unrelated, huang], 1, { linked: leadLinkedNews(ledger(false)) })[0]?.link, unrelated.link, 'v60.51 C7 no link, no lift');
});
check('v60.51 C7 a CEO-return headline is not dropped as entertainment; a celebrity comeback still is', () => {
  assert.equal(isBlacklistedNewsText('Stocks Soar as Huang’s Nvidia Return Fuels AI Bets 황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등'), false, 'v60.51 C7 CEO 복귀');
  assert.equal(isBlacklistedNewsText('코스피 5000선 복귀… SK하이닉스 4%대 상승'), false, 'v60.51 C7 index level 복귀');
  assert.equal(isBlacklistedNewsText('배우 김씨 드라마 복귀'), true, 'v60.51 C7 actor comeback');
  assert.equal(isBlacklistedNewsText('걸그룹 컴백, 3년 만에 무대 복귀'), true, 'v60.51 C7 idol comeback');
});

// ── 4. The rolling pool.
check('v60.51 D1 importance rolls past the 08:00 cut to the newest article', () => {
  const bundle = [
    { title: 'morning wrap', link: 'https://fixture.invalid/a', topic: 'macro', score: 70, pubDate: 'Mon, 23 Nov 2026 01:30:00 GMT' },
    { title: 'old story', link: 'https://fixture.invalid/b', topic: 'geo', score: 60, pubDate: 'Sun, 22 Nov 2026 23:10:00 GMT' }
  ];
  const later = [{ title: 'evening futures rebound', link: 'https://fixture.invalid/c', topic: 'macro', score: 80, publishedAt: '2026-11-23T23:40:00.000Z', provisional: true }];
  const pool = rollingNewsPool(bundle, later);
  assert.deepEqual(pool.map((row) => row.link), ['https://fixture.invalid/a', 'https://fixture.invalid/c'], 'v60.51 D1 the 24 hours before the newest article');
  assert.equal(pickImportantNews(pool, 2)[0]?.link, 'https://fixture.invalid/c', 'v60.51 D1 the evening story is ranked');
  assert.equal(pool.find((row) => row.link.endsWith('/c'))?.pubDate, '2026-11-23T23:40:00.000Z', 'v60.51 D1 a later row carries its time as pubDate');
});
check('v60.51 D1 the 뉴스 shell no longer says the list stops at 08:00', () => {
  assert.equal(/id="news-window-label">24시간 · 08:00 KST</.test(source('index.html')), false, 'v60.51 D1 news subtitle');
});

// ── 5. Bookkeeping lines and the stock row title.
check('v60.51 C6 브리핑 draws no "이유가 확인되지 않은" heading and no fact count', () => {
  const day = source('src/ui/components/briefing-day.js');
  assert.equal(/이유가 확인되지 않은|확인한 발표·기사/.test(day), false, 'v60.51 C6 briefing-day.js');
});
check('v60.51 C6 a macro preview does not say the consensus is not collected', () => {
  const nowMs = Date.parse('2026-11-24T00:00:00Z');
  const previews = eventPreviews({ xr: { events: [{ id: 'us-pce', name: 'PCE', when: '11/26', atMs: nowMs + 2 * 86400000 }], items: [] }, schedule: [{ kind: 'macro', id: 'macro:us-pce:2026-11-26', last: '지난 발표 2.8%' }], nowMs });
  assert.deepEqual(previews[0]?.expect, ['지난 발표 2.8%'], 'v60.51 C6 PCE expect');
});
check('v60.51 C2 오늘\'s stock row is titled for its material moves, not "크게 움직인"', () => {
  const home = source('src/ui/components/home-day.js');
  assert.equal(/'크게 움직인 종목'/.test(home) || !/'주요 종목', 'home-day__stocks-label'/.test(home), false, 'v60.51 C2 home-day.js label');
});

await Promise.all(pending);
if (failures.length) { console.error(`day-cause: ${failures.length} failed`); process.exit(1); }
console.log('day-cause: all checks passed');
