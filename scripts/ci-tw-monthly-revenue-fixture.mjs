#!/usr/bin/env node
// v59.56 (X-bookmark gap 2): Taiwan AI supply-chain monthly revenue — producer parsing (TWSE t187ap05_L field names,
// ROC months, thousand-NT$ amounts), history seeding and merge, the unchanged-data no-rewrite rule, and the read model.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTwMonthlyRevenue, mergeHistory, parseRevenueRow, pendingTwMonthlyRevenue, rocMonth, shiftMonth, TW_AI_CHAIN } from './fetch-tw-monthly-revenue.mjs';
import { ARTIFACT_FRESHNESS, sameExceptVolatile } from '../src/data/contracts/artifact-freshness.js';
const sameRevenueData = (a, b) => sameExceptVolatile(a, b, ARTIFACT_FRESHNESS['tw-monthly-revenue.json'].volatileKeys);
import { buildTwRevenueView, twRevenueLine } from '../src/domain/briefing/tw-monthly-revenue.js';
import { runSections } from './lib/gate-sections.mjs';
import { aiDemandRead, aiDemandFactLine, CAPEX_STRETCH_PCT } from '../src/domain/briefing/ai-demand-read.js';
import { bigtechGroupFor } from '../src/data/bigtech-cashflow.js';

const row = (code, name, cur, prev, ago, month = '11509') => ({ '出表日期': '1151017', '資料年月': month, '公司代號': code, '公司名稱': name, '產業別': '半導體業',
  '營業收入-當月營收': String(cur), '營業收入-上月營收': String(prev), '營業收入-去年當月營收': String(ago), '營業收入-上月比較增減(%)': '0', '營業收入-去年同月增減(%)': '0',
  '累計營業收入-當月累計營收': String(cur * 9), '累計營業收入-去年累計營收': String(ago * 9), '累計營業收入-前期比較增減(%)': '0', '備註': '-' });

// The producer and read model run on fixtures (code); the committed artifact's schema also runs in a data run.
await runSections('tw-monthly-revenue-fixture', [
['producer', async () => {
assert.equal(rocMonth('11509'), '2026-09', 'v59.56 ROC 115/09 is 2026-09');
assert.equal(rocMonth('11513'), null, 'v59.56 month 13 is rejected');
assert.equal(shiftMonth('2026-01', -1), '2025-12', 'v59.56 month shift crosses the year');
assert.equal(shiftMonth('2026-09', -12), '2025-09', 'v59.56 twelve months back');

const tsmc = parseRevenueRow(row('2330', '台積電', 330000000, 300000000, 250000000));
assert.equal(tsmc.month, '2026-09', 'v59.56 ROC data month parsed');
// 出表日期 is the MOPS table's generation date, not the company's filing date — stored as tableDate.
assert.equal(tsmc.tableDate, '2026-10-17', 'v60.46 ROC table date (出表日期) parsed as tableDate');
assert.equal('publishedAt' in tsmc, false, 'v60.46 the table date is not stored as a publication date');
assert.equal(tsmc.yoyPct, 32, 'v59.56 YoY computed from the source amounts');
assert.equal(tsmc.momPct, 10, 'v59.56 month-on-month from source amounts');
assert.equal(tsmc.note, null, 'v59.56 "-" note is empty');
assert.equal(parseRevenueRow({ ...row('2330', '台積電', 1, 1, 1), '營業收入-當月營收': '' }), null, 'v59.56 unreadable current amount drops the row');

const history = mergeHistory([{ month: '2025-08', revenue: 1 }, { month: '2026-09', revenue: 999 }], tsmc);
assert.deepEqual(history.map((p) => p.month), ['2025-08', '2025-09', '2026-08', '2026-09'], 'v59.56 source months seed the history');
assert.equal(history.at(-1).revenue, 330000000, 'v59.56 this run wins over the stored month');

const rows = [row('2330', '台積電', 330000000, 300000000, 250000000), row('2454', '聯發科', 40000000, 42000000, 40000000), row('3711', '日月光投控', 60000000, 55000000, 50000000),
  row('2317', '鴻海', 800000000, 700000000, 700000000), row('6669', '緯穎', 30000000, 28000000, 20000000, '11508'), row('9999', '他社', 1, 1, 1), row('2382', '別名', 100, 100, 100)];
const artifact = buildTwMonthlyRevenue({ rows, generatedAt: '2026-11-01T00:00:00Z' });
assert.equal(artifact.status, 'ok', 'v59.56 chain rows give an ok artifact');
assert.equal(artifact.latestMonth, '2026-09', 'v59.56 latest month is the newest company month');
assert.ok(!artifact.companies.some((c) => c.code === '9999'), 'v59.56 codes outside the chain list are not kept');
assert.deepEqual(artifact.renamed, ['2382:別名'], 'v59.56 a source name that no longer matches is reported');
const listed = TW_AI_CHAIN.reduce((n, g) => n + g.members.length, 0);
assert.equal(artifact.companies.length + artifact.missing.length, listed, 'v59.56 every listed code is either collected or missing');
assert.ok(sameRevenueData(artifact, { ...artifact, generatedAt: 'later' }), 'v59.56 only generatedAt differs → unchanged');
assert.ok(ARTIFACT_FRESHNESS['tw-monthly-revenue.json'].skipUnchanged, 'v60.57 tw-liveness: the publisher, not the producer, keeps an unchanged file (the row then records that the fetch ran)');
assert.ok(!sameRevenueData(artifact, { ...artifact, latestMonth: '2026-10' }), 'v59.56 a new month is a data change');

const view = buildTwRevenueView(artifact, { nowMs: Date.parse('2026-10-20T00:00:00Z') });
assert.equal(view.state, 'ok', 'v59.56 ok artifact reads ok');
assert.equal(view.reported, 5, 'v59.56 companies on an older month (6669 August) are not in the September sum');
const server = view.groups.find((g) => g.id === 'server-odm');
assert.equal(server.yoyPct, Math.round(((800000000 + 100) / (700000000 + 100) - 1) * 1000) / 10, 'v59.56 group YoY is the sum of amounts, not a median of rates');
assert.match(view.reading, /^대만 AI 공급망 5개사의 9월 매출 합계는 1년 전보다 \+\d+\.\d%이고, 5개사 중 3개사가 늘었습니다\. 가장 크게 늘어난 묶음은 /, `v59.56 face sentence (${view.reading})`);
// All or none of the companies rising is said as such, not "16개사 중 16개사".
const withYoy = (yoyPct) => buildTwRevenueView({ ...artifact, companies: artifact.companies.map((c) => ({ ...c, yoyPct })) }, { nowMs: Date.parse('2026-10-20T00:00:00Z') }).reading;
assert.match(withYoy(5), /이고, 5개사 모두 늘었습니다\./, `v60.28 every company up reads 모두 (${withYoy(5)})`);
assert.match(withYoy(-5), /이고, 늘어난 회사는 없습니다\./, `v60.28 no company up reads 없습니다 (${withYoy(-5)})`);
assert.ok(!/(\d+)개사 중 \1개사/.test(withYoy(5)), 'v60.28 no "N개사 중 N개사"');
assert.equal(view.late, false, 'v59.56 September is on time in October');
assert.equal(buildTwRevenueView(artifact, { nowMs: Date.parse('2026-11-16T00:00:00Z') }).late, true, 'v59.56 September is late after November 15');
assert.equal(buildTwRevenueView(pendingTwMonthlyRevenue()).state, 'pending', 'v59.56 not-collected marker reads pending');
assert.equal(buildTwRevenueView(null, { loadState: 'failed' }).state, 'unavailable', 'v59.56 failed fetch reads unavailable');
assert.equal(buildTwRevenueView({ ...artifact, schemaVersion: 'x' }).reason, 'schema', 'v59.56 unknown schema reads unavailable');

// A company the source left out keeps its previous record (marked carried) instead of losing its history.
const months12 = (end) => Array.from({ length: 12 }, (_, i) => ({ month: shiftMonth(end, i - 11), revenue: 1000 + i }));
const prevArtifact = buildTwMonthlyRevenue({ rows: [row('2330', '台積電', 300, 290, 250, '11508'), row('2454', '聯發科', 40, 42, 40, '11508')], generatedAt: '2026-10-01T00:00:00Z' });
prevArtifact.companies = prevArtifact.companies.map((c) => ({ ...c, history: months12('2026-08') }));
const carriedRun = buildTwMonthlyRevenue({ rows: [row('2330', '台積電', 330, 300, 250)], previous: prevArtifact, generatedAt: '2026-11-01T00:00:00Z' });
const prev2454 = prevArtifact.companies.find((c) => c.code === '2454');
const kept2454 = carriedRun.companies.find((c) => c.code === '2454');
const fresh2330 = carriedRun.companies.find((c) => c.code === '2330');
assert.equal(carriedRun.status, 'ok', 'v59.94 a run with one parsed company stays ok');
assert.ok(kept2454, 'v59.94 a company missing from the source rows is kept from the previous artifact');
assert.deepEqual(kept2454, { ...prev2454, carried: true }, 'v59.94 the kept company equals its previous record plus carried');
assert.equal(kept2454.month, '2026-08', 'v59.94 the kept company keeps its own older month');
assert.ok(carriedRun.missing.includes('2454'), 'v59.94 a carried company is still listed as missing');
assert.equal(fresh2330.history.length, 13, 'v59.94 the parsed company extends its 12-month history');
assert.equal('carried' in fresh2330, false, 'v59.94 a company parsed from this run carries no flag');
assert.equal(carriedRun.latestMonth, '2026-09', 'v59.94 latestMonth comes from the parsed company');
const carriedView = buildTwRevenueView(carriedRun, { nowMs: Date.parse('2026-10-20T00:00:00Z') });
assert.equal(carriedView.month, '2026-09', 'v59.94 the view reads the parsed month as latest');
assert.equal(carriedView.reported, 1, 'v59.94 a carried company on an older month is not in the latest-month sum');
assert.match(carriedView.reading, /합계는 1년 전보다 \+\d+\.\d%입니다\./, `v60.28 one company states only the total (${carriedView.reading})`);
const recarried = buildTwMonthlyRevenue({ rows: [row('2330', '台積電', 330, 300, 250)], previous: carriedRun, generatedAt: '2026-11-02T00:00:00Z' });
assert.ok(sameRevenueData(recarried, carriedRun), 'v59.94 re-carrying the same records compares unchanged');
// A record or artifact written before the rename (publishedAt) is carried and read as its table date.
const legacy = { ...prevArtifact, publishedAt: '2026-09-17', tableDate: undefined, companies: prevArtifact.companies.map(({ tableDate, ...c }) => ({ ...c, publishedAt: '2026-09-17' })) };
const fromLegacy = buildTwMonthlyRevenue({ rows: [row('2330', '台積電', 330, 300, 250)], previous: legacy, generatedAt: '2026-11-05T00:00:00Z' }).companies.find((c) => c.code === '2454');
assert.equal(fromLegacy.tableDate, '2026-09-17', 'v60.46 a carried pre-rename record keeps its date as tableDate');
assert.equal('publishedAt' in fromLegacy, false, 'v60.46 a carried pre-rename record drops the publishedAt name');
assert.equal(buildTwRevenueView(legacy, { nowMs: Date.parse('2026-09-20T00:00:00Z') }).tableDate, '2026-09-17', 'v60.46 the view reads a pre-rename artifact date as its table date');
const backAgain = buildTwMonthlyRevenue({ rows: [row('2330', '台積電', 330, 300, 250), row('2454', '聯發科', 45, 40, 40)], previous: carriedRun, generatedAt: '2026-11-03T00:00:00Z' });
assert.equal('carried' in backAgain.companies.find((c) => c.code === '2454'), false, 'v59.94 a returning company drops the carried flag');
assert.equal(backAgain.companies.find((c) => c.code === '2454').history.length, 13, 'v59.94 a returning company keeps its accumulated history');
const allCarried = buildTwMonthlyRevenue({ rows: [row('9999', '他社', 1, 1, 1)], previous: carriedRun, generatedAt: '2026-11-04T00:00:00Z' });
assert.equal(allCarried.status, 'no-companies', 'v59.94 a run with no parsed company leaves the artifact unchanged');

}, 'code'],
// Orders against prices: Taiwan's revenue and the hyperscalers' spending set beside the US chain's one-month prices.
['demand-read', async () => {
const flow = (down, total = 4) => ({ groups: Array.from({ length: total }, (_, i) => ({ name: `g${i}` })), down1m: down });
const tw = (yoy) => ({ state: 'ok', month: '2026-10', totalYoy: yoy });
const capex = (yoy, ratio, was = 64) => ({ complete: true, members: ['A', 'B', 'C', 'D', 'E'], capexYoyPct: yoy, capexToOcfPct: ratio, yearAgo: { capexToOcfPct: was }, endRange: ['2026-08-31', '2026-09-30'] });
const fell = aiDemandRead({ flow: flow(4), tw: tw(62.3), capex: capex(93.5, 95.5), session: '2026-11-24' });
assert.equal(fell.side, 'priceOnly', 'v60.57 demand-read: orders up, prices down');
assert.equal(fell.said.text, '주문 쪽은 대만 공급망 10월 매출 1년 전보다 +62.3%, 빅테크 5개사 설비투자 1년 전보다 +93.5%이고, 주가는 묶음 모두 한 달 새 내렸습니다. 주문이 줄었다는 숫자는 아직 없고, 내린 것은 주가입니다. 다만 설비투자가 영업현금흐름의 95.5%까지 올라와(1년 전 64%), 이 속도를 이어갈 돈이 남는지가 다음 쟁점입니다.', 'v60.57 demand-read: the sentence');
assert.ok(fell.said.claims.length >= 4 && fell.said.claims.every((item) => item.figures.length), 'v60.57 demand-read: every figure is a claim');
const partly = aiDemandRead({ flow: flow(3), tw: tw(10), capex: capex(20, CAPEX_STRETCH_PCT - 1) });
assert.match(partly.said.text, /주가는 4개 묶음 중 3개가 한 달 새 내렸습니다/, 'v60.57 demand-read: a partial fall keeps the count');
assert.equal(partly.stretched, false, 'v60.57 demand-read: spending under the line has no funding clause');
assert.doesNotMatch(partly.said.text, /다만/, 'v60.57 demand-read: no funding clause under the line');
assert.equal(aiDemandRead({ flow: flow(1), tw: tw(10), capex: capex(20, 50) }).side, 'together', 'v60.57 demand-read: orders and prices the same way');
assert.equal(aiDemandRead({ flow: flow(4), tw: tw(-3), capex: capex(20, 50) }).side, 'ordersTurn', 'v60.57 demand-read: a falling order figure turns the reading');
const twOnly = aiDemandRead({ flow: flow(4), tw: tw(62.3), capex: { ...capex(93.5, 95.5), complete: false } });
assert.doesNotMatch(twOnly.said.text, /빅테크|다만/, 'v60.57 demand-read: an incomplete group total is left out');
assert.equal(aiDemandRead({ flow: flow(4), tw: { state: 'loading' }, capex: null }), null, 'v60.57 demand-read: no order figure, no line');
assert.equal(aiDemandRead({ flow: { groups: [] }, tw: tw(1), capex: capex(1, 1) }), null, 'v60.57 demand-read: no price side, no line');
assert.match(aiDemandFactLine(fell), /^AI 공급망 주문 대 주가\(.*원인 단정 아님\): 주문 쪽은/, 'v60.57 demand-read: the AI fact line');
assert.equal(aiDemandFactLine(null), '', 'v60.57 demand-read: no read, no fact line');
// The group total is read on the ledger's liveness, not on the content clock a quiet quarter leaves weeks old.
const now = Date.parse('2026-11-25T12:00:00Z');
const payload = { generatedAt: '2026-11-15T07:16:51.919Z', hyperscalers: capex(93.5, 95.5) };
const ledger = (checkedAt) => ({ _aioBigtechCashflow: payload, _aioFreshness_refresh_screener_yml: { artifacts: { 'bigtech-cashflow.json': { producedAt: payload.generatedAt, checkedAt, expectedEveryMinutes: 360, staleAfterMinutes: 5760 } } } });
assert.equal(bigtechGroupFor(ledger('2026-11-25T09:17:00Z'), { now }), payload.hyperscalers, 'v60.57 cashflow-reader: content ten days old, confirmed this morning, is shown');
assert.equal(bigtechGroupFor(ledger('2026-11-10T09:17:00Z'), { now }), null, 'v60.57 cashflow-reader: a producer silent past the stale line hides it');
assert.equal(bigtechGroupFor({ _aioBigtechCashflow: payload }, { now }), null, 'v60.57 cashflow-reader: without a ledger the own clock decides (past ten days)');
assert.equal(bigtechGroupFor({ _aioBigtechCashflow: payload }, { now: Date.parse('2026-11-20T00:00:00Z') }), payload.hyperscalers, 'v60.57 cashflow-reader: without a ledger a recent own clock passes');
assert.equal(bigtechGroupFor({}, { now }), null, 'v60.57 cashflow-reader: no file');
}, 'code'],
// 종목: a US listing reads its Taiwan company's month only through a name both files hold (company-aliases TSM → TSMC).
['stock-line', async () => {
const company = (code, nameKo, extra = {}) => ({ code, nameKo, month: '2026-10', revenue: 586890319, prevMonth: 511857399, yearAgo: 367473051, momPct: 14.7, yoyPct: 59.7, group: 'foundry-design', ...extra });
const file = { schemaVersion: 'tw-monthly-revenue.v1', status: 'ok', latestMonth: '2026-10', tableDate: '2026-11-17', companies: [company('2330', 'TSMC'), company('3711', 'ASE', { momPct: null })] };
assert.equal(twRevenueLine(file, 'TSM')?.text, '대만 월 매출 2026년 10월 5,869억 대만달러, 전월 대비 +14.7%, 1년 전 대비 +59.7%', 'v60.59 tw-stock-line TSM reads TSMC with its month');
assert.equal(twRevenueLine(file, 'tsm')?.code, '2330', 'v60.59 tw-stock-line symbol case');
assert.equal(twRevenueLine(file, 'ASX')?.text, '대만 월 매출 2026년 10월 5,869억 대만달러, 1년 전 대비 +59.7%', 'v60.59 tw-stock-line a missing change is left out, never 0');
assert.equal(twRevenueLine(file, 'NVDA'), null, 'v60.59 tw-stock-line a listing with no Taiwan company has no line');
assert.equal(twRevenueLine({ ...file, status: 'not-collected' }, 'TSM'), null, 'v60.59 tw-stock-line the 수집 전 marker has no line');
assert.equal(twRevenueLine(null, 'TSM'), null, 'v60.59 tw-stock-line no file');
const entity = await readFile(new URL('../src/ui/pages/entity.js', import.meta.url), 'utf8');
assert.match(entity, /twRevenueLine\(/, 'v60.59 tw-stock-line the 종목 overview reads the line');
}, 'code'],
// The committed artifact always parses as the schema (the 수집 전 marker until the first Actions run).
['committed-artifact', async () => {
const committed = JSON.parse(await readFile(new URL('../public-data/tw-monthly-revenue.json', import.meta.url), 'utf8'));
assert.equal(committed.schemaVersion, 'tw-monthly-revenue.v1', 'v59.56 committed artifact schema');
assert.ok(['ok', 'not-collected'].includes(committed.status), `v59.56 committed status ${committed.status}`);
if (committed.status === 'ok') assert.ok(committed.companies.every((c) => TW_AI_CHAIN.some((g) => g.id === c.group)), 'v59.56 committed companies belong to a chain group');
}, 'data'],
]);
console.log('[tw-monthly-revenue-fixture] ok');
