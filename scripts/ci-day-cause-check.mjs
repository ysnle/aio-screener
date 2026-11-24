#!/usr/bin/env node
// v60.51 (owner audit 2026-11-23, 오늘·브리핑·뉴스): on 11/23 the S&P 500 rose 4.7% and NVDA 31.5% after Jensen Huang's
// return as Nvidia CEO, yet 오늘의 핵심 said "NVIDIA +31.5% — S&P 500 지수에 +160bp만큼 영향을 줬습니다. 업종이 따르는
// 가격과 같은 방향입니다." with no cause, its three headlines were about other stories, and 뉴스's 중요 뉴스 stopped at
// 08:00 KST. This gate holds, on fixtures built here (never live public-data):
//   1. headlineCause cuts a Korean headline's cause by rule, and gives none for any other shape;
//   2. a lead stock move with a linked report says the cause in one clause and its index pull in %p; the shared thread
//      is named once in the opening; with no linked report there is no cause clause, and the driver price is named;
//   3. every figure of those sentences is a claim that holds against the ledger;
//   4. a story tied to a lead move outranks a higher-scored unrelated one, and a "CEO 복귀" headline is not blacklisted;
//   5. the important pool rolls to the newest article past the 08:00 cut;
//   6. internal bookkeeping lines are not drawn, and 오늘's stock row is titled for what it holds.
//   node scripts/ci-day-cause-check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { headlineCause } from '../src/domain/briefing/headline-cause.js';
import { buildDayAccount } from '../src/domain/briefing/day-account.js';
import { leadLinkedNews, pickImportantNews, rollingNewsPool } from '../src/domain/briefing/news-picks.js';
import { eventPreviews } from '../src/domain/briefing/event-guide.js';
import { isBlacklistedNewsText } from '../src/domain/news/selection.js';
import { saidIssues, isClaimError } from './lib/claim-validate.mjs';
import { ledgerFacts } from './lib/claim-facts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');
const failures = [];
const why = (error) => (error?.generatedMessage === false && 'actual' in error ? `${error.message}: actual ${inspect(error.actual)}, expected ${inspect(error.expected)}` : String(error?.message));
const check = (label, fn) => { try { fn(); console.log(`  ok  ${label}`); } catch (error) { failures.push(label); console.log(`  FAIL ${label}\n       ${why(error).replace(/\s+/g, ' ').slice(0, 600)}`); } };

// ── 1. The cause clause, by rule.
check('v60.51 C3 headlineCause cuts the three cause shapes and nothing else', () => {
  const cases = [
    ['황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등: 시장 마감', '황의 엔비디아 복귀'],
    ['뉴욕증시, 젠슨 황 엔비디아 CEO 재임명에 상승 출발', '젠슨 황 엔비디아 CEO 재임명'],
    ['황의 Nvidia CEO 복귀 후 미 국채 금리 상승…유럽 채권 금리는 하락', '황의 Nvidia CEO 복귀'],
    ['아시아 테크 주식, 젠슨 황의 복귀에 급등', '젠슨 황의 복귀'],
    ['테슬라 주가 오늘 급등한 이유', null], // no cause stated
    ['과거 데이터에 따르면 TSMC 실적 발표 전 주가 하락', null], // a source, not a cause
    ["코스피, '젠슨황 복귀'에 5∼6%대 급등", '젠슨황 복귀'],
    ['CrowdStrike의 439억 달러 인수에 Zscaler 주가 급등', null], // a figure is never printed outside a claim
    ['Stocks Soar as Huang’s Nvidia Return Fuels AI Bets', null] // English: not shown
  ];
  for (const [title, want] of cases) assert.equal(headlineCause(title), want, `v60.51 C3 cause of "${title}"`);
});

// ── 2–3. The day account on a fixture ledger of the 11/23 shape.
const D = '2026-11-23';
const ledger = (withReport) => {
  const facts = [
    { id: `price:spx:${D}`, kind: 'price', asset: 'spx', label: 'S&P 500', date: D, change: 4.73, z: 5, rank: 'lead', materiality: 100 },
    { id: `price:soxx:${D}`, kind: 'price', asset: 'soxx', label: '반도체(SOXX)', date: D, change: 13.63, z: 4, rank: 'lead', materiality: 95 },
    { id: `stock:NVDA:${D}`, kind: 'stock-move', subjects: ['NVDA'], label: 'NVIDIA', date: D, change: 31.48, z: 8, indexBp: 160.2, themes: ['semiconductor'], sector: 'Technology',
      rank: 'lead', materiality: 100, explainedBy: withReport ? ['subject', 'driver'] : ['driver'] },
    { id: `group:theme:semiconductor:${D}`, kind: 'group-move', group: 'theme:semiconductor', label: '반도체', date: D, change: 13.49, members: ['NVDA', 'AMD'],
      leaders: [{ sym: 'NVDA', change: 31.48 }, { sym: 'AMD', change: 20.4 }], rank: 'lead', materiality: 100, explainedBy: ['member', 'driver'] },
    { id: `stock:AAPL:${D}`, kind: 'stock-move', subjects: ['AAPL'], label: 'Apple', date: D, change: 1.9, z: 0.9, indexBp: 15.9, rank: 'major', materiality: 48, explainedBy: [] },
    ...(withReport ? [{ id: 'headline:huang', kind: 'headline', title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets: Markets Wrap', titleKo: '황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등: 시장 마감',
      at: '2026-11-23T21:11:01.000Z', date: D, subjects: ['NVDA'], rank: 'lead', materiality: 80, src: { kind: 'news', link: 'https://fixture.invalid/huang' } }] : [])
  ];
  const links = [
    ...(withReport ? [{ from: 'headline:huang', to: `stock:NVDA:${D}`, basis: 'subject' }] : []),
    { from: `price:soxx:${D}`, to: `stock:NVDA:${D}`, basis: 'driver' }, { from: `price:soxx:${D}`, to: `group:theme:semiconductor:${D}`, basis: 'driver' },
    { from: `stock:NVDA:${D}`, to: `group:theme:semiconductor:${D}`, basis: 'member' }
  ];
  const threads = [{ id: `thread:stock:NVDA:${D}`, lead: `stock:NVDA:${D}`, facts: [`stock:NVDA:${D}`, `group:theme:semiconductor:${D}`, ...(withReport ? ['headline:huang'] : [])] }];
  return { schemaVersion: 'market-day.v1', generatedAt: '2026-11-24T00:52:00.000Z', sessions: { us: D }, facts, links, threads };
};
const told = buildDayAccount(ledger(true));
const bare = buildDayAccount(ledger(false));
const nvda = (account) => account.stories.find((story) => story.id === `story:stock:NVDA:${D}`) || {};

check('v60.51 C3 a lead move with a linked report says its cause in one clause, the pull in %p', () => {
  assert.equal(nvda(told).line, '황의 엔비디아 복귀 보도. S&P 500을 1.6%p 끌어올렸습니다.', 'v60.51 C3 NVDA line');
});
check('v60.51 C3 the shared thread is named once in the opening, after the US indexes', () => {
  assert.equal(told.opening, '미국은 S&P 500 +4.7%, 반도체(SOXX) +13.6%. 황의 엔비디아 복귀 보도 뒤 반도체 업종이 함께 상승했습니다.', 'v60.51 C3 opening');
});
check('v60.51 C3 no linked report: no cause clause, no thread sentence, the driver price named with its move', () => {
  assert.equal(nvda(bare).line, 'S&P 500을 1.6%p 끌어올렸습니다. 반도체(SOXX) +13.6%와 같은 방향입니다.', 'v60.51 C3 NVDA line without a report');
  assert.equal(bare.opening, '미국은 S&P 500 +4.7%, 반도체(SOXX) +13.6%.', 'v60.51 C3 opening without a report');
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

// ── 4. Market-impact order and the blacklist.
check('v60.51 C7 a story tied to a lead move outranks a higher-scored unrelated one', () => {
  const unrelated = { title: 'Korean bond yields fall', titleKo: '국고채 금리 일제히 하락', link: 'https://fixture.invalid/kr', topic: 'kr', score: 75 };
  const huang = { title: 'Stocks Soar as Huang’s Nvidia Return Fuels AI Bets: Markets Wrap', titleKo: '황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등', link: 'https://fixture.invalid/huang', topic: 'macro', score: 70 };
  assert.equal(pickImportantNews([unrelated, huang], 1)[0]?.link, unrelated.link, 'v60.51 C7 without the ledger the score decides');
  assert.equal(pickImportantNews([unrelated, huang], 1, { linked: leadLinkedNews(ledger(true)) })[0]?.link, huang.link, 'v60.51 C7 with the ledger the linked story leads');
  assert.equal(pickImportantNews([unrelated, huang], 1, { linked: leadLinkedNews(ledger(false)) })[0]?.link, unrelated.link, 'v60.51 C7 no link, no lift');
});
check('v60.51 C7 a CEO-return headline is not dropped as entertainment', () => {
  assert.equal(isBlacklistedNewsText('Stocks Soar as Huang’s Nvidia Return Fuels AI Bets 황의 엔비디아 복귀가 AI 베팅에 불을 지피며 주가 급등'), false, 'v60.51 C7 복귀');
  assert.equal(isBlacklistedNewsText('배우 김씨 드라마 복귀'), true, 'v60.51 C7 a celebrity comeback stays out');
});

// ── 5. The rolling pool.
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

// ── 6. Bookkeeping lines and the stock row title.
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

if (failures.length) { console.error(`day-cause: ${failures.length} failed`); process.exit(1); }
console.log('day-cause: all checks passed');
