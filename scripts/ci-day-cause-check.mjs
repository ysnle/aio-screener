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
import { newsStoryLinks } from '../src/domain/briefing/news-story-link.js';
import { renderTickerContext } from '../src/ui/components/ticker-context.js';
import { holdingCauseRow } from '../src/ui/components/portfolio-move-cause.js';
import { holdingMoveFacts } from '../src/domain/portfolio/holding-moves.js';
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

check('v60.59 포트폴리오 a held stock\'s ledger move carries the report about it as 움직인 이유, by the 종목 header\'s rule', () => {
  const rows = [{ title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets', titleKo: HUANG, pubDate: '2026-11-23T21:11:01Z', tier: 1, score: 81, link: 'https://fixture.invalid/huang' }];
  const day = ledger(true);
  const held = ['NVDA', 'AAPL', 'MSFT']; // fixture holdings, never real ones
  const moves = holdingMoveFacts(day, held);
  assert.deepEqual([...moves.keys()], ['NVDA', 'AAPL'], 'v60.59 holding moves only for holdings the ledger moved');
  const doc = fakeDocument([]);
  const line = holdingCauseRow(doc, { _serverNewsIntraday: rows }, null, { symbol: 'NVDA', move: moves.get('NVDA'), colSpan: 10 });
  assert.ok(line, 'v60.59 holding cause row drawn');
  const text = line.textContent.replace(/\s+/g, ' ').trim();
  assert.match(text, /^움직인 이유 11\/23 \+31\.5% 11\/24 06:11 황의 엔비디아 복귀가/, 'v60.59 holding cause line: label, move, dated report');
  assert.equal(holdingCauseRow(doc, { _serverNewsIntraday: rows }, null, { symbol: 'AAPL', move: moves.get('AAPL'), colSpan: 10 }), null, 'v60.59 holding cause no report about the move, no line');
  assert.equal(holdingMoveFacts(day, []).size, 0, 'v60.59 holding cause no holding, nothing');
  assert.equal(holdingMoveFacts({ ...day, sessions: { us: '2026-11-24' } }, held).size, 0, 'v60.59 holding cause another session\'s move is not the basis session\'s');
  // One definition: the cause-line helpers live in move-news.js only.
  assert.equal(/export function (?:moveNewsList|companyMoveRow|symbolNames)\b/.test(source('src/ui/components/market-timeline.js')), false, 'v60.59 move-news helpers left market-timeline.js');
  assert.match(source('src/ui/pages/portfolio.js'), /holdingCauseRow\(/, 'v60.59 포트폴리오 draws holdingCauseRow');
  assert.equal(/console\.|localStorage|sessionStorage/.test(source('src/ui/components/portfolio-move-cause.js') + source('src/domain/portfolio/holding-moves.js')), false, 'v60.59 holding cause writes nothing about holdings');
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

// ── 6. A card's tie to the day's story (뉴스): the moves its headline is linked to.
check('v60.57 news-story-link a subject link names the move; a topic-only link names none', () => {
  const links = newsStoryLinks(ledger(true));
  const huang = { title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets: Markets Wrap', link: 'https://fixture.invalid/huang' };
  assert.deepEqual(links(huang)?.moves.map((move) => move.said.text), ['NVIDIA +31.5%'], 'v60.57 news-story-link subject link');
  assert.equal(links(huang).moves[0].said.claims[0].asOf, D, 'v60.57 news-story-link the move is dated to its session');
  const topical = ledger(true, [{ id: 'headline:chips', kind: 'headline', date: D, title: 'Chip stocks in focus', src: { kind: 'news', link: 'https://fixture.invalid/chips' } }]);
  topical.links.push({ from: 'headline:chips', to: `group:theme:semiconductor:${D}`, basis: 'topic' });
  assert.equal(newsStoryLinks(topical)({ title: 'Chip stocks in focus', link: 'https://fixture.invalid/chips' }), null, 'v60.57 news-story-link topic-only link');
});
check('v60.57 news-story-link two moves in materiality order, at most two', () => {
  const day = ledger(true);
  day.links.push(...[`price:soxx:${D}`, `group:theme:semiconductor:${D}`, `stock:AAPL:${D}`].map((to) => ({ from: 'headline:huang', to, basis: 'member' })));
  const moves = newsStoryLinks(day)({ title: 'x', link: 'https://fixture.invalid/huang' }).moves;
  assert.deepEqual(moves.map((move) => move.id), [`stock:NVDA:${D}`, `group:theme:semiconductor:${D}`], 'v60.57 news-story-link order and cap');
  assert.equal(moves[1].said.text, '반도체 +13.5%', 'v60.57 news-story-link group median');
  const errors = moves.flatMap((move) => saidIssues(move.said, ledgerFacts(day)).filter(isClaimError).map((issue) => `${issue.check}: ${issue.message}`));
  assert.deepEqual(errors, [], 'v60.57 news-story-link every move figure holds against the ledger');
  const rate = { id: `price:dgs10:${D}`, kind: 'price', asset: 'dgs10', label: '미 10년물', date: D, change: -7.4, unit: 'bp', changeUnit: 'bp', rank: 'major', materiality: 40 };
  const withRate = ledger(true, [rate]);
  withRate.links.push({ from: 'headline:yonhap', to: rate.id, basis: 'subject' });
  assert.deepEqual(newsStoryLinks(withRate)({ title: '뉴욕증시, 젠슨 황 엔비디아 CEO 재임명에 상승 출발' }).moves.map((move) => move.said.text), ['NVIDIA +31.5%', '미 10년물 -7bp'], 'v60.57 news-story-link a rate moves in bp');
});
check('v60.57 news-story-link no ledger, no tie', () => {
  const any = { title: 'Micron jumps as HBM prices climb', link: 'https://fixture.invalid/mu' };
  assert.equal(newsStoryLinks(null)(any), null, 'v60.57 news-story-link no day');
  assert.equal(newsStoryLinks(ledger(false))(any), null, 'v60.57 news-story-link an article the ledger does not link');
});
check('v60.61 news-story-link an unlinked article with one resolved issuer ties to that issuer\'s own move', () => {
  const links = newsStoryLinks(ledger(false));
  const any = { title: 'Apple supplier talks continue', link: 'https://fixture.invalid/aapl' };
  assert.deepEqual(links(any, { issuers: ['AAPL'] })?.moves.map((move) => move.said.text), ['Apple +1.9%'], 'v60.61 news-story-link one issuer');
  assert.equal(links(any, { issuers: ['AAPL', 'NVDA'] }), null, 'v60.61 news-story-link two issuers name no single subject');
  assert.equal(links(any, { issuers: ['MSFT'] }), null, 'v60.61 news-story-link an issuer without a move');
  const huang = { title: 'x', link: 'https://fixture.invalid/huang' };
  assert.deepEqual(newsStoryLinks(ledger(true))(huang, { issuers: ['AAPL'] })?.moves.map((move) => move.said.text), ['NVIDIA +31.5%'], 'v60.61 news-story-link the ledger link wins over the card issuer');
});
check('v60.57 news-story-link leadLinkedNews keeps its behaviour on the shared matcher', () => {
  const linked = leadLinkedNews(ledger(true));
  assert.equal(linked({ title: 'x', link: 'https://fixture.invalid/huang?utm=1' }), true, 'v60.57 news-story-link link match ignores the query');
  assert.equal(linked({ title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets: Markets Wrap' }), true, 'v60.57 news-story-link title match');
  assert.equal(linked({ storyArticles: [{ title: 'other' }, { link: 'https://fixture.invalid/yonhap' }] }), true, 'v60.57 news-story-link any grouped article');
  assert.equal(linked({ title: 'Intel, Meta among AI stocks hedge funds are buying - Goldman' }), false, 'v60.57 news-story-link an unlinked headline');
  assert.equal(leadLinkedNews(ledger(false))({ title: '', link: '' }), false, 'v60.57 news-story-link no keys');
});

check('v60.59 local-venue: a local market\'s price report (MCX gold rate, Nikkei close) takes no topic link to a global asset\'s move; a global gold headline still does', async () => {
  const { buildMarketDay, LOCAL_VENUE_REPORT } = await import('../src/domain/market/day/facts.js');
  const days = []; for (let d = Date.parse('2026-08-03T12:00:00Z'); days.length < 70; d += 86400000) { const day = new Date(d); if (![0, 6].includes(day.getUTCDay())) days.push(day.toISOString().slice(0, 10)); }
  const history = days.map((date, i) => ({ date, gold: i === 69 ? 4000 * 0.95 : 4000 + (i % 2 ? 5 : -5), fieldMeta: { gold: { sessionDate: date } } }));
  const nowMs = Date.parse(`${days[69]}T22:00:00Z`);
  const at = new Date(nowMs - 3600000).toISOString();
  const day = buildMarketDay({ history, screener: { factorSessionDateByMarket: { US: days[69] }, data: {} }, nowMs, news: [
    { title: 'Gold rate outlook for tomorrow: MCX gold drops 1.29%; will prices fall further?', pubDate: at, topic: 'fxbond', score: 40, tier: 3, link: 'mcx' },
    { title: 'Nikkei Rises 1.3%, Led by Chip, Metals Stocks', pubDate: at, topic: 'macro', score: 40, tier: 1, link: 'nikkei' },
    { title: 'Gold slides as dollar steadies after Fed minutes', pubDate: at, topic: 'macro', score: 40, tier: 1, link: 'global' }] });
  const gold = day.facts.find((fact) => fact.id === `price:gold:${days[69]}`);
  const headline = (link) => day.facts.find((fact) => fact.kind === 'headline' && fact.src?.link === link);
  const linkedTo = (fact) => day.links.filter((link) => link.from === fact?.id).map((link) => link.to);
  assert.ok(gold && ['lead', 'major'].includes(gold.rank), 'v60.59 local-venue: the fixture gold move is material');
  assert.deepEqual(linkedTo(headline('mcx')), [], 'v60.59 local-venue: the MCX gold-rate report is not a cause of gold\'s move');
  assert.deepEqual(linkedTo(headline('nikkei')), [], 'v60.59 local-venue: a Tokyo index report is not either');
  assert.ok(linkedTo(headline('global')).includes(gold.id), 'v60.59 local-venue: a global gold headline keeps its topic link');
  assert.ok(headline('mcx').materiality < headline('global').materiality && headline('mcx').rank === 'context', 'v60.59 local-venue: the local report is not raised to the move\'s share');
  assert.ok(!LOCAL_VENUE_REPORT.test('Asian Stocks Set for Gains After Late US Rebound') && !LOCAL_VENUE_REPORT.test('Fed worries driving market selloff, not AI'), 'v60.59 local-venue: a market-wide headline is not a local report');
});

// ── 브리핑 as one report (owner 2026-11-26): the timeline face, the assembled figures and the one-paragraph rule.
check('v60.59 briefing-report: 움직인 것 is a timeline — rank on the left, why on its own indented line, the lead report on the face', () => {
  const brief = fakeDocument(['briefing-day', 'briefing-day-title', 'briefing-day-opening', 'briefing-day-stories', 'briefing-day-folds']);
  renderBriefingDay({ documentRef: brief, root: { [MARKET_DAY.key]: ledger(true), [EVENT_BRIEFS.key]: { briefs: [] }, [INDEX_LONGRUN.key]: {} } });
  const items = brief.byId['briefing-day-stories'].children;
  assert.ok(items.length > 0 && items.every((item) => /br-timeline__item/.test(item.className)), 'v60.59 briefing-report timeline items');
  const lead = items.find((item) => /is-lead/.test(item.className));
  assert.match(lead.children[0].textContent, /핵심/, 'v60.59 briefing-report the lead story names its rank on the left');
  const why = lead.children[1].children.find((node) => node.className === 'br-timeline__why');
  assert.ok(!why || /^→ /.test(why._text), 'v60.59 briefing-report the why line is its own indented line');
});
check('v60.59 briefing-report: the hero is the S&P 500 move or nothing; the headline marks the claim\'s own word; absent lines are left out', async () => {
  const { reportHero, reportHeadline, reportLines, finePrint, weekRows, weekFriday } = await import('../src/domain/briefing/briefing-report.js');
  const { claim, say } = await import('../src/domain/shared/claim.js');
  assert.equal(reportHero({ available: true, rows: { spx: { asOf: D, label: 'S&P 500', moves: {} } } }, []), null, 'v60.59 briefing-report no S&P move, no hero (never 0)');
  const hero = reportHero({ available: true, rows: { spx: { asOf: D, label: 'S&P 500', moves: { 1: 4.73 } }, ndx: { asOf: '2026-11-20', label: '나스닥 100', moves: { 1: 6 } } } }, []);
  assert.equal(hero.text, '+4.7%', 'v60.59 briefing-report hero figure');
  assert.deepEqual(hero.subs, [], 'v60.59 briefing-report a leader of another session is not a sub-figure');
  const stage = claim({ subject: 'spx', measure: 'fromRecordHigh', word: 'correction', asOf: D, figures: [{ value: -12, unit: 'pct', basis: 'fromRecordHigh', label: '시장 전체' }] });
  const lede = say('시장 전체는 {st.word}에 그쳐, 쏠림이 되돌려지는 하락입니다.', { st: stage });
  const headline = reportHeadline({ available: true, lines: [{ id: 'lede', label: '', said: lede }] });
  assert.equal(headline.text.slice(...headline.accent), '조정', 'v60.59 briefing-report the accent is the claim word');
  assert.equal(reportHeadline({ available: false }), null, 'v60.59 briefing-report no opening, no headline');
  const lines = reportLines({ opening: { available: true, lines: [{ id: 'diagnosis', label: '쏠림 되돌림', said: { text: '격차가 줄면 다시 판단.', claims: [] } }] }, nextEvent: null, checks: [] });
  assert.deepEqual(lines.map((line) => [line.id, line.key, !!line.tint]), [['flip', '쏠림 되돌림', true]], 'v60.59 briefing-report only the lines with data');
  const tiles = finePrint({ history: [], asOf: D });
  assert.equal(tiles.length, 8, 'v60.59 briefing-report eight fine-print figures');
  assert.ok(tiles.every((tile) => tile.value === null), 'v60.59 briefing-report a missing figure is null, printed as the missing mark');
  const week = weekRows({ history: [], schedule: [{ kind: 'macro', label: 'PCE', atMs: Date.parse('2026-11-26T13:30:00Z') }], asOf: '2026-11-25' });
  assert.deepEqual(week.rows.map((row) => [row.date, row.kind]), [['2026-11-23', 'session'], ['2026-11-24', 'session'], ['2026-11-25', 'session'], ['2026-11-26', 'closed'], ['2026-11-27', 'ahead']], 'v60.59 briefing-report Monday to Friday of the basis week, the holiday named');
  assert.ok(week.rows.slice(0, 3).every((row) => row.move === null), 'v60.59 briefing-report a session without closes has no move');
  assert.equal(weekFriday('2026-11-25'), '2026-11-27', 'v60.59 briefing-report the week ends on its Friday');
  const quiet = reportLines({ opening: { available: true, lines: [] }, lead: { title: 'NVIDIA -3.9%', line: 'S&P 500을 0.24%p 끌어내렸습니다.' } });
  assert.deepEqual(quiet.map((line) => [line.id, line.key]), [['led', '주도한 것']], 'v60.59 briefing-report a quiet session takes the ledger lead story');
  const glossed = finePrint({ history: [{ date: '2026-11-24', vix: 20 }, { date: '2026-11-25', vix: 28.3 }], asOf: '2026-11-25', cross: [{ id: 'credit', word: '부담' }] });
  assert.match(glossed.find((tile) => tile.id === 'vix').gloss, /^변동성 경계 구간, 1일 \+8\.3pt$/, 'v60.59 briefing-report the VIX band word leads its gloss');
  assert.ok(!/구간|부담/.test(glossed.find((tile) => tile.id === 'wti').gloss || ''), 'v60.59 briefing-report a figure without a fixed word keeps only its change');
});
check('v60.59 briefing-report: one centred column; the AI paragraph and the rule-built reading are never stacked; the gated ids stay', () => {
  const css = source('src/ui/styles/briefing-report.css');
  const html = source('index.html');
  assert.match(css, /#page-briefing \.briefing-report \{ max-width: 720px; margin: 0 auto;/, 'v60.59 briefing-report one centred column');
  assert.match(css, /\.br-prose:has\(> \.br-prose__ai:not\(\[hidden\]\)\) > \.br-prose__rule \{ display: none; \}/, 'v60.59 briefing-report not both stacked');
  assert.match(source('src/ui/styles/responsive.css'), /@import url\('\.\/briefing-report\.css'\)/, 'v60.59 briefing-report stylesheet loaded');
  for (const id of ['briefing-read', 'briefing-read-headline', 'briefing-ai-analysis', 'briefing-day', 'briefing-day-stories', 'briefing-sector-moves', 'briefing-drivers', 'briefing-driver-rows', 'briefing-check-list', 'briefing-schedule', 'briefing-schedule-rows', 'briefing-next']) {
    assert.ok(html.includes(`id="${id}"`), `v60.59 briefing-report keeps #${id}`);
  }
  assert.ok(html.indexOf('id="briefing-read"') < html.indexOf('id="briefing-schedule"'), 'v60.59 briefing-report the reading precedes the schedule');
});

await Promise.all(pending);
if (failures.length) { console.error(`day-cause: ${failures.length} failed`); process.exit(1); }
console.log('day-cause: all checks passed');
