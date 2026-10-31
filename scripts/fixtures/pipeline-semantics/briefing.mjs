// scripts/fixtures/pipeline-semantics/briefing.mjs — v59.45 pipeline review regressions (briefing, news, earnings/FOMC briefs, schedule)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const NOW = Date.parse('2026-10-30T00:00:00Z');
const DAY = 86400000;

export const cases = [
  // ---- PASS20: news production, selection, verification ---------------------------------------------------------------
  { id: 'P20-VERIFY-01', name: '루머로 판정된 기사는 요약이 있어도 AI 입력 자격을 얻지 않는다', run: async ({ load }) => {
      const { normalizeNewsItem, NEWS_SURFACE_CONTRACTS } = await load('src/domain/news/selection.js');
      const row = { title: 'Market chatter: chip acquisition rumor', summary: 'A speculative acquisition report with no official confirmation or named source for the proposed transaction.', source: 'Reuters', tier: 1, pubDate: '2026-10-29T23:30:00Z' };
      const out = normalizeNewsItem('briefing', row, NEWS_SURFACE_CONTRACTS.briefing, NOW, null);
      assert.equal(out.verificationStatus, 'unverified');
      assert.equal(out.eligibleForAi, false);
      const labelled = normalizeNewsItem('briefing', { ...row, title: 'Chip deal talks continue', verification: 'unconfirmed' }, NEWS_SURFACE_CONTRACTS.briefing, NOW, null);
      assert.equal(labelled.eligibleForAi, false, 'the producer label unconfirmed is honoured');
  } },
  { id: 'P20-TIME-01', name: '미래에 끝나는 서버 주기와 미래 게시 기사는 AI 입력이 아니다', run: async ({ load }) => {
      const { buildNewsSurfaceModel } = await load('src/domain/news/selection.js');
      const row = { title: 'Federal Reserve policy announcement', summary: 'A long enough summary of the policy announcement for the analysis gate to read it.', source: 'Reuters', tier: 1, score: 99, topic: 'macro',
        pubDate: '2026-10-31T01:00:00Z', _serverBackstop: true, newsCyclePolicy: 'kst-0800-completed-24h', newsCycleStart: '2026-10-31T00:00:00Z', newsCycleEnd: '2026-11-01T00:00:00Z' };
      const model = buildNewsSurfaceModel('briefing', [row], { nowMs: NOW, windowStart: NOW - DAY, windowEnd: NOW });
      assert.equal(model.aiItems.length, 0);
  } },
  { id: 'P20-CACHE-01', name: '점수 캐시는 시간이 지나면 신선도 점수를 다시 계산하고 제외 표시를 남기지 않는다', run: async ({ load }) => {
      const { scoreItem } = await load('src/domain/news/selection.js');
      const cache = new Map();
      const news = { title: 'Federal Reserve inflation outlook', source: 'Reuters', tier: 1, pubDate: '2026-10-29T23:30:00Z', desc: 'Federal Reserve rate policy and inflation' };
      scoreItem({ ...news }, { cache, now: () => NOW });
      const agedCached = scoreItem({ ...news }, { cache, now: () => NOW + 5 * DAY });
      const agedFresh = scoreItem({ ...news }, { now: () => NOW + 5 * DAY });
      assert.equal(agedCached, agedFresh);
      const reused = { ...news, _blacklisted: true };
      scoreItem(reused, { now: () => NOW });
      assert.notEqual(reused._blacklisted, true, 'a re-scored row that passes is not left excluded');
  } },
  { id: 'P20-REVISION-01', name: '같은 URL의 정정은 장중 슬롯에, 반대 방향 정정은 08:00 묶음에 남는다', run: async ({ load }) => {
      const { selectIntradayNews } = await load('src/domain/news/stories.js');
      const canonical = [{ title: 'Chip company revenue jumps', link: 'https://example.test/article', pubDate: '2026-10-29T20:00:00Z' }];
      const revision = { title: 'Correction: chip company revenue fell', link: 'https://example.test/article', pubDate: '2026-10-29T23:30:00Z', correctionOf: 'original' };
      assert.equal(selectIntradayNews([revision], { canonical, cycleEndMs: NOW - 3600000, nowMs: NOW }).length, 1);
      const { selectNewsBundle } = await load('scripts/lib/news-selection.mjs');
      const rows = ['Company reports quarterly revenue rose 50%', 'Correction: Company reports quarterly revenue fell 50%'].map((title, i) => ({ title, link: `https://example.test/${i}`, source: i ? 'Bloomberg' : 'Reuters', tier: 1, score: 100 - i, ts: NOW - 1800000 + i * 1000, pubDate: '2026-10-29T23:30:00Z', topic: 'equity', topicHits: 2 }));
      const { out } = selectNewsBundle(rows, []);
      assert.equal(out.length, 2);
      assert.equal(out.find((row) => /Correction/.test(row.title))?.revisionType, 'correction');
  } },
  { id: 'P20-TEXT-01', name: '부정문은 신용 위험 신호가 아니고, 감성은 자격을 준 본문을 읽는다', run: async ({ load }) => {
      const { computeNewsRiskSignals, computeNewsSentimentScore } = await load('src/domain/news/scoring.js');
      const rows = Array.from({ length: 5 }, (_, i) => ({ title: `Bank reports no credit stress or default risk ${i}`, summary: 'The bank reports stable credit conditions with no evidence of a deterioration in its portfolio.', pubDate: '2026-10-29T23:30:00Z' }));
      const risk = computeNewsRiskSignals({ items: rows, now: NOW, windowStart: '2026-10-29T00:00:00Z', windowEnd: '2026-10-30T00:00:00Z' });
      assert(!risk.some((signal) => signal.type === 'credit'));
      const real = rows.map((row, i) => ({ ...row, title: `Bank lender defaults on loans ${i}` }));
      assert(computeNewsRiskSignals({ items: real, now: NOW, windowStart: '2026-10-29T00:00:00Z', windowEnd: '2026-10-30T00:00:00Z' }).some((signal) => signal.type === 'credit'), 'an actual default still counts');
      const body = Array.from({ length: 5 }, (_, i) => ({ title: `Company update ${i}`, summary: 'Earnings surge and rally as shares soar to record high on strong recovery.', pubDate: '2026-10-29T23:30:00Z' }));
      assert.notEqual(computeNewsSentimentScore({ items: body, now: NOW }).score, 50);
  } },
  { id: 'P20-TIER-01', name: '출처 이름 일부에 FT가 들어 있어도 1등급이 아니다', run: async ({ load }) => {
      const { newsSourceTier } = await load('src/domain/news/selection.js');
      assert.equal(newsSourceTier({ source: 'Software News' }), 3);
      assert.equal(newsSourceTier({ source: 'FT' }), 1);
      assert.equal(newsSourceTier({ source: 'Financial Times' }), 1);
      assert.equal(newsSourceTier({ source: 'Software News', tier: 2 }), 2, 'an explicit tier wins');
  } },
  { id: 'P20-ISSUER-01', name: 'BRK는 $BRK.B 제목에 맞지 않는다(문장 끝 마침표는 허용)', run: async ({ load }) => {
      const { companyMatcher } = await load('src/domain/briefing/news-picks.js');
      assert.equal(companyMatcher('BRK', '').test('$BRK.B earnings'), false);
      assert.equal(companyMatcher('NVDA', '').test('Shares of $NVDA.'), true);
      const { tickerNewsHeadlineNamesIssuer } = await load('scripts/lib/news-selection.mjs');
      assert.equal(tickerNewsHeadlineNamesIssuer('$BRK.B earnings rise', 'BRK', ''), null);
  } },
  { id: 'P20-LINEAGE-01', name: '수집 시각보다 미래인 게시 시각은 관측일을 끌어올리지 않는다', run: async ({ load }) => {
      const { deriveTickerNewsLineage } = await load('scripts/lib/news-selection.mjs');
      const out = deriveTickerNewsLineage([{ ts: NOW - 3600000, pubDate: '2099-01-01T00:00:00Z' }], new Date(NOW).toISOString());
      assert.equal(out.newsObservedAt, new Date(NOW - 3600000).toISOString());
  } },
  { id: 'P20-INTRADAY-NOW-01', name: '장중 선택은 수집 실행 시각을 쓴다', run: async () => {
      const text = readFileSync(new URL('../../lib/news-selection.mjs', import.meta.url), 'utf8');
      assert.match(text, /selectNewsIntraday\(intradayCandidates, \{ cycleEndMs: cycle\.endMs, nowMs,/);
  } },
  { id: 'R2-02', name: '채널 slug 문자열을 가진 행도 채널 필터에 남는다', run: async () => {
      const text = readFileSync(new URL('../../../src/domain/news/selection.js', import.meta.url), 'utf8');
      assert.doesNotMatch(text, /_tgChannel === true/);
  } },

  // ---- PASS21: earnings / FOMC briefs ------------------------------------------------------------------------------------
  { id: 'P21-NUMBER-01', name: '단위나 방향이 인용문과 다른 항목은 숫자가 같아도 버린다', run: async ({ load }) => {
      const { verifyQuotedItems } = await load('src/domain/briefing/event-briefs.js');
      const source = 'Revenue declined 5 percent to $5 million. Revenue was $92.9 billion and increased 18%.';
      const unit = verifyQuotedItems([{ label: '매출', value: '$5 billion', text: '', quote: 'Revenue declined 5 percent to $5 million.' }], source);
      assert.equal(unit.kept.length, 0);
      const direction = verifyQuotedItems([{ label: '매출', value: '$5 million', text: '매출이 5% 증가', quote: 'Revenue declined 5 percent to $5 million.' }], source);
      assert.equal(direction.kept.length, 0);
      const good = verifyQuotedItems([{ label: '매출', value: '$92.9 billion', text: '18% 증가', quote: 'Revenue was $92.9 billion and increased 18%.' }], source);
      assert.equal(good.kept.length, 1, 'a faithful item stays');
  } },
  { id: 'P21-AMOUNT-01', name: '범위·단위 없는 표 숫자는 하나의 금액으로 비교하지 않는다', run: async ({ load }) => {
      const { parseUsdAmount, parseUsdPerShare } = await load('src/domain/briefing/event-briefs.js');
      assert.equal(parseUsdAmount('$5 million to $6 million'), null);
      assert.equal(parseUsdAmount('$1,902,418'), null);
      assert.equal(parseUsdAmount('$12.1B'), 12.1e9);
      assert.equal(parseUsdAmount('$5 bn'), 5e9);
      assert.equal(parseUsdAmount('$ 18,085 million'), 18085e6);
      assert.equal(parseUsdPerShare('$(0.12)'), -0.12);
      assert.equal(parseUsdPerShare('$1.10 to $1.20'), null);
  } },
  { id: 'P21-EPS-01', name: '인용문이 GAAP을 밝히면 라벨이 생략돼도 조정 예상치와 비교하지 않는다', run: async ({ load }) => {
      const { assembleEarningsSections } = await load('scripts/fetch-event-briefs.mjs');
      const source = 'GAAP diluted EPS was $2.';
      const out = assembleEarningsSections({ figures: [{ metric: 'eps_diluted', label: '희석 EPS', value: '$2', text: '', quote: 'GAAP diluted EPS was $2.' }] }, source, { epsEstimate: 4 });
      assert.equal(out.figures[0].estimate, undefined);
  } },
  { id: 'P21-PROVISIONAL-01', name: '제공처 실적 수치가 바뀌면 잠정 요약도 최신 값으로 바뀐다', run: async ({ load }) => {
      const { buildEventBriefs } = await load('scripts/fetch-event-briefs.mjs');
      const sources = { secReason: 'fixture-no-sec', dartList: async () => [], ai: async () => { throw Error('Unexpected AI call'); } };
      const args = { sources, nowMs: NOW, earningsRows: [{ symbol: 'NVDA', date: '2026-10-29', hour: 'amc', revenueActual: 1e9, epsActual: 1 }], extended: [] };
      const first = await buildEventBriefs(args);
      const second = await buildEventBriefs({ ...args, previous: first, earningsRows: [{ ...args.earningsRows[0], revenueActual: '2000000000', epsActual: 2 }] });
      assert.equal(second.briefs[0].figures[0].value, '$2.00 billion');
      const future = await buildEventBriefs({ ...args, earningsRows: [{ ...args.earningsRows[0], date: '2026-11-20' }] });
      assert.equal(future.briefs.length, 0, 'a future calendar date with actuals is not a report');
  } },
  { id: 'P21-WORKFLOW-01', name: '가격 반응이 그대로면 다시 확인해도 checkedAt이 바뀌지 않는다', run: async ({ load }) => {
      const { buildEventBriefs } = await load('scripts/fetch-event-briefs.mjs');
      const bars = [{ date: '2026-10-28', close: 100 }, { date: '2026-10-29', close: 101 }, { date: '2026-10-30', close: 95 }];
      const sources = { secReason: 'fixture-no-sec', dartList: async () => [], ai: async () => ({ reason: 'fixture-no-ai' }), prices: async () => ({ bars, extended: null }) };
      const args = { sources, nowMs: Date.parse('2026-10-31T02:00:00Z'), earningsRows: [{ symbol: 'NVDA', date: '2026-10-29', hour: 'amc', revenueActual: 1e9, epsActual: 1 }], extended: [] };
      const first = await buildEventBriefs(args);
      const second = await buildEventBriefs({ ...args, previous: first, nowMs: args.nowMs + 20 * 60000 });
      assert.ok(first.briefs[0].reaction, 'the reaction is measured');
      assert.equal(second.briefs[0].reaction.checkedAt, first.briefs[0].reaction.checkedAt);
  } },
  { id: 'P21-TIME-01', name: '종목 화면은 미래·대기 요약을 고르지 않고, 날짜만 있는 공시는 그 날짜로 읽는다', run: async ({ load }) => {
      const { latestBriefFor, EVENT_BRIEFS_SCHEMA, releaseSession } = await load('src/domain/briefing/event-briefs.js');
      assert.equal(latestBriefFor({ schemaVersion: EVENT_BRIEFS_SCHEMA, briefs: [{ symbol: 'TEST', status: 'pending', publishedAt: '2099-01-01T00:00:00Z' }] }, 'TEST', { nowMs: NOW }), null);
      assert.equal(releaseSession('2026-10-29T00:00:00Z', { dateOnly: true }).releaseDate, '2026-10-29');
      // 11/27 closes at 13:00 ET: a 14:00 ET release is after that day's close.
      assert.equal(releaseSession('2026-11-27T19:00:00Z').afterClose, true);
  } },
  { id: 'P21-CHAIN-01', name: '공급망 묶음은 표시한 거래일에 측정된 종목만 중앙값에 넣는다', run: async ({ load }) => {
      const { aiChainFlow } = await load('src/domain/briefing/ai-chain-flow.js');
      const row = (sym, date) => ({ sym, ret1d: -1, ret1m: -5, factorSessionDate: date });
      const themes = [{ id: 'semiconductor', subThemes: [{ name: '메모리', tickers: ['A', 'B', 'C', 'D'] }] }];
      const rows = [row('A', '2026-10-29'), row('B', '2026-10-29'), row('C', '2026-10-22'), row('D', '2026-10-22')];
      assert.equal(aiChainFlow({ themes, rows, session: '2026-10-29' }).groups.length, 0, 'two measured of four is under the minimum');
      const group = aiChainFlow({ themes, rows: rows.map((r) => ({ ...r, factorSessionDate: '2026-10-29' })), session: '2026-10-29' }).groups[0];
      assert.deepEqual([group.measured, group.listed], [4, 4]);
  } },
  { id: 'P21-ATTRIBUTION-01', name: '지수 기여 종목 옆 루머 제목은 미확인으로 표시한다', run: async ({ load }) => {
      const { datedItemFor } = await load('src/domain/market/move-attribution.js');
      const item = datedItemFor({ sym: 'NVDA', name: 'Nvidia' }, { sessionCloseMs: NOW, news: [{ title: 'Nvidia rumored to buy a startup', pubDate: new Date(NOW - 3600000).toISOString() }] });
      assert.match(item.text, /^\[미확인\]/);
  } },

  // ---- PASS26: daily diff, my names, schedule, event guide ---------------------------------------------------------------
  { id: 'P26-NAMES-01', name: '이동평균이 없는 종목은 50일선 위로 세지 않는다', run: async ({ load }) => {
      const { buildMyNames } = await load('src/domain/briefing/daily-diff.js');
      const out = buildMyNames({ symbols: ['A', 'B'], rows: [{ sym: 'A', rsi: 80 }, { sym: 'B', rsi: 80 }], breadthState: 'burden' });
      assert.doesNotMatch(out.summary, /대부분은 아직 50일선 위/);
      const zero = buildMyNames({ symbols: ['A'], rows: [{ sym: 'A', pctSma50: 0 }] });
      assert.doesNotMatch(zero.names[0].notes.join(' '), /50일선 위\(/, 'exactly on the line is not above it');
  } },
  { id: 'P26-NAMES-02', name: '확인 안 된 당일 등락은 정렬 순서도 바꾸지 않는다', run: async ({ load }) => {
      const { buildMyNames } = await load('src/domain/briefing/daily-diff.js');
      const out = buildMyNames({ symbols: ['A', 'B'], live: { A: { pct: 100 }, B: { pct: 2 } } });
      assert.equal(out.names[0].daySignalled, false);
      assert.deepEqual(out.names.map((row) => row.symbol), ['A', 'B'], 'ties fall back to the symbol, not the unverified move');
      const flipped = buildMyNames({ symbols: ['A', 'B'], live: { A: { pct: 2 }, B: { pct: 100 } } });
      assert.deepEqual(flipped.names.map((row) => row.symbol), ['A', 'B']);
  } },
  { id: 'P26-EVENT-01', name: '실적 반응·미리보기는 일정과 같은 DST·휴장 달력을 쓴다', run: async ({ load }) => {
      const { earningsReactionCases, eventPreviews } = await load('src/domain/briefing/event-guide.js');
      const { buildBriefingSchedule } = await load('src/domain/briefing/schedule.js');
      const signals = [{ kind: 'earnings', ticker: 'TEST', post: '1', revenue: 'beat', eps: 'beat' }];
      const winter = earningsReactionCases({ signals, posts: [{ id: '1', datetime: '2026-12-01T14:00:00Z' }], rows: [{ sym: 'TEST', factorSessionDate: '2026-12-01', ret1d: -3 }], session: '2026-12-01' });
      assert.equal(winter.length, 1, '09:00 ET in winter is before the 09:30 open');
      // 11/27 follows the Thanksgiving holiday: the previous open is 11/25, so a post on 11/26 is in the window.
      const holiday = earningsReactionCases({ signals, posts: [{ id: '1', datetime: '2026-11-26T15:00:00Z' }], rows: [{ sym: 'TEST', factorSessionDate: '2026-11-27', ret1d: -3 }], session: '2026-11-27' });
      assert.equal(holiday.length, 1);
      const row = { symbol: 'TEST', date: '2026-12-01', hour: 'bmo', indexWeight: 1, epsEstimate: 1 };
      const nowMs = Date.parse('2026-12-01T18:30:00Z');
      assert.equal(eventPreviews({ earnings: [row], names: { TEST: 'Test' }, nowMs }).length, buildBriefingSchedule({ earnings: [row], names: { TEST: 'Test' }, nowMs }).length);
  } },
  { id: 'P26-NULL-01', name: '없는 실적·반응·매출은 0이나 수신으로 바뀌지 않는다', run: async ({ load }) => {
      const { earningsReactionCases } = await load('src/domain/briefing/event-guide.js');
      const { buildBriefingSchedule, formatUsdRevenue } = await load('src/domain/briefing/schedule.js');
      const signals = [{ kind: 'earnings', ticker: 'TEST', post: '1', revenue: 'beat', eps: 'beat' }];
      assert.equal(earningsReactionCases({ signals, posts: [{ id: '1', datetime: '2026-10-29T12:00:00Z' }], rows: [{ sym: 'TEST', factorSessionDate: '2026-10-29', ret1d: null }], session: '2026-10-29' }).length, 0);
      const empty = buildBriefingSchedule({ earnings: [{ symbol: 'TEST', date: '2026-10-30', hour: 'bmo', epsActual: '' }], names: { TEST: 'Test' }, nowMs: Date.parse('2026-10-30T10:00:00Z') });
      assert.notEqual(empty[0].status, 'received');
      assert.doesNotMatch(String(empty[0].last || ''), /EPS 0\.00/);
      const revenueOnly = buildBriefingSchedule({ earnings: [{ symbol: 'TEST', date: '2026-10-30', hour: 'bmo', revenueActual: 5e9 }], names: { TEST: 'Test' }, nowMs: Date.parse('2026-10-30T10:00:00Z') });
      assert.equal(revenueOnly[0].status, 'received');
      assert.equal(formatUsdRevenue(Infinity), null);
  } },
  { id: 'P26-WEEK-01', name: '같은 실적 행이 두 번 와도 한 건으로 센다', run: async ({ load }) => {
      const { buildEarningsWeek } = await load('src/domain/briefing/event-guide.js');
      const week = buildEarningsWeek({ earnings: [{ symbol: 'TEST', date: '2026-10-30', hour: 'bmo' }, { symbol: 'TEST', date: '2026-10-30', hour: 'bmo' }, { symbol: 'TEST', date: '2026-10-30', hour: 'unknown', revenueActual: 1e9 }] });
      assert.equal(week.total, 1);
      assert.equal(week.days[0].sessions[0].rows[0].reported, true, 'the row with the revenue actual wins');
      assert.equal(week.days[0].sessions[0].key, 'bmo', 'and keeps the known session');
  } },
  { id: 'P26-CHECKS-01', name: '결과가 이미 들어온 일정은 오늘 확인할 일정이 아니다', run: async ({ load }) => {
      const { todayChecks } = await load('src/domain/briefing/event-guide.js');
      const rows = todayChecks({ schedule: [{ kind: 'earnings', atMs: NOW + 3600000, passed: false, status: 'received', when: '10/30', label: 'A 실적' }], nowMs: NOW });
      assert.equal(rows.filter((row) => row.kind === 'event').length, 0);
  } },
  { id: 'P26-PULSE-01', name: '축 개수가 없으면 부담 0·양호 0으로 쓰지 않는다', run: async ({ load }) => {
      const { regimePulse } = await load('src/domain/briefing/regime-pulse.js');
      assert.doesNotMatch(regimePulse({ available: true, overall: '부담 우세', asOf: '2026-10-29' }).label, /부담 0/);
  } },
  { id: 'P26-REGISTRY-01', name: '일정 레지스트리는 중복 id와 미래 검토일을 오류로 본다', run: async ({ load }) => {
      const { scheduledEventProblems } = await load('src/domain/briefing/scheduled-events.js');
      const event = { id: 'x', atKst: '2026-11-04T09:00:00+09:00', source: 'law', reviewedAt: '2026-12-01', expiresAt: '2026-11-10' };
      const problems = scheduledEventProblems({ nowMs: NOW, registry: [event, { ...event, reviewedAt: '2026-10-01' }] });
      assert(problems.some((p) => /future/.test(p.reason)));
      assert(problems.some((p) => /duplicate/.test(p.reason)));
  } },
  { id: 'P26-DIFF-01', name: '두 거래일 모두 읽힌 축이 없으면 "판정이 그대로"라고 쓰지 않는다', run: async ({ load }) => {
      const { buildDailyChanges } = await load('src/domain/briefing/daily-diff.js');
      const out = buildDailyChanges([{ date: '2026-10-28', spx: 6000 }, { date: '2026-10-29', spx: 6010 }], { now: NOW });
      assert.equal(out.comparableAxes, 0);
      assert.doesNotMatch(out.headline, /판정이 그대로|판정은 그대로/);
  } },

  // ---- R1/R3: reviewer follow-ups ------------------------------------------------------------------------------------------
  { id: 'R1-05', name: '0.0%로 표시되는 이동 막대는 하락 색이 아니다', run: async () => {
      const text = readFileSync(new URL('../../../src/ui/components/briefing-read.js', import.meta.url), 'utf8');
      assert.match(text, /directionOf\(value, 1\)/);
      assert.doesNotMatch(text, /value >= 0 \? 'is-up' : 'is-down'/);
  } },
  { id: 'R3-01', name: '서사 주제 정규식은 단어 일부(유가증권·시즌이란·spike·abundant·exciting)에 걸리지 않는다', run: async ({ load }) => {
      const { NARRATIVE_THEMES } = await load('scripts/lib/narrative-context.mjs');
      const theme = (id) => NARRATIVE_THEMES.find((row) => row.id === id).re;
      assert.equal(theme('oil-geopolitics').test('유가증권시장 외국인 순매수'), false);
      assert.equal(theme('oil-geopolitics').test('실적 시즌이란 결국 기대치 싸움'), false);
      assert.equal(theme('oil-geopolitics').test('이란 제재 강화'), true);
      assert.equal(theme('private-credit').test('XYZ shares spike'), false);
      assert.equal(theme('sovereign-debt').test('ABC sees abundant demand'), false);
      assert.equal(theme('sovereign-debt').test('German Bunds sell off'), true);
  } },
  { id: 'R3-02', name: '삼성전자는 삼성전기가 아니고, 소문자 micron·amazon은 회사가 아니다', run: async ({ load }) => {
      const { matchTickers } = await load('scripts/lib/telegram-tickers.mjs');
      assert.deepEqual(matchTickers('Samsung Electronics 3Q results beat'), ['005930.KS']);
      assert.deepEqual(matchTickers('micron-scale packaging; amazon rainforest'), []);
      assert.deepEqual(matchTickers('Micron beats estimates').includes('MU'), true);
  } },
  { id: 'R3-03', name: '증권사 없이 같은 날 다른 목표가 글 두 개는 합쳐지지 않는다', run: async ({ load }) => {
      const { extractAnalystActions, mergeSignals, buildUniverseIndex } = await load('scripts/lib/telegram-signals.mjs');
      const universe = buildUniverseIndex([{ sym: 'NVDA', name: 'NVIDIA' }]);
      const a = extractAnalystActions('$NVDA 목표가 $200 → $250 상향', { universe, date: '2026-10-30', postId: 'a/1' });
      const b = extractAnalystActions('$NVDA 목표가 $180 → $220 상향', { universe, date: '2026-10-30', postId: 'b/2' });
      assert.equal(mergeSignals([], [...a, ...b]).length, 2);
      const relay = extractAnalystActions('$NVDA 목표가 $200 → $250 상향', { universe, date: '2026-10-30', postId: 'c/3' });
      assert.equal(mergeSignals([], [...a, ...relay]).length, 1, 'a relay of the same prices is one action');
  } },
];
