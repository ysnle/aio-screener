#!/usr/bin/env node
// v59.56 (X-bookmark gap 2): Taiwan AI supply-chain monthly revenue — producer parsing (TWSE t187ap05_L field names,
// ROC months, thousand-NT$ amounts), history seeding and merge, the unchanged-data no-rewrite rule, and the read model.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTwMonthlyRevenue, mergeHistory, parseRevenueRow, pendingTwMonthlyRevenue, rocMonth, sameRevenueData, shiftMonth, TW_AI_CHAIN } from './fetch-tw-monthly-revenue.mjs';
import { buildTwRevenueView } from '../src/domain/briefing/tw-monthly-revenue.js';

const row = (code, name, cur, prev, ago, month = '11509') => ({ '出表日期': '1151017', '資料年月': month, '公司代號': code, '公司名稱': name, '產業別': '半導體業',
  '營業收入-當月營收': String(cur), '營業收入-上月營收': String(prev), '營業收入-去年當月營收': String(ago), '營業收入-上月比較增減(%)': '0', '營業收入-去年同月增減(%)': '0',
  '累計營業收入-當月累計營收': String(cur * 9), '累計營業收入-去年累計營收': String(ago * 9), '累計營業收入-前期比較增減(%)': '0', '備註': '-' });

assert.equal(rocMonth('11509'), '2026-09', 'v59.56 ROC 115/09 is 2026-09');
assert.equal(rocMonth('11513'), null, 'v59.56 month 13 is rejected');
assert.equal(shiftMonth('2026-01', -1), '2025-12', 'v59.56 month shift crosses the year');
assert.equal(shiftMonth('2026-09', -12), '2025-09', 'v59.56 twelve months back');

const tsmc = parseRevenueRow(row('2330', '台積電', 330000000, 300000000, 250000000));
assert.equal(tsmc.month, '2026-09', 'v59.56 ROC data month parsed');
assert.equal(tsmc.publishedAt, '2026-10-17', 'v59.56 ROC publish date parsed');
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
assert.ok(!sameRevenueData(artifact, { ...artifact, latestMonth: '2026-10' }), 'v59.56 a new month is a data change');

const view = buildTwRevenueView(artifact, { nowMs: Date.parse('2026-10-20T00:00:00Z') });
assert.equal(view.state, 'ok', 'v59.56 ok artifact reads ok');
assert.equal(view.reported, 5, 'v59.56 companies on an older month (6669 August) are not in the September sum');
const server = view.groups.find((g) => g.id === 'server-odm');
assert.equal(server.yoyPct, Math.round(((800000000 + 100) / (700000000 + 100) - 1) * 1000) / 10, 'v59.56 group YoY is the sum of amounts, not a median of rates');
assert.match(view.reading, /^대만 AI 공급망 5개사의 9월 매출 합계는 1년 전보다 \+\d+\.\d%이고, 5개사 중 3개사가 늘었습니다\. 가장 크게 늘어난 묶음은 /, `v59.56 face sentence (${view.reading})`);
assert.equal(view.late, false, 'v59.56 September is on time in October');
assert.equal(buildTwRevenueView(artifact, { nowMs: Date.parse('2026-11-16T00:00:00Z') }).late, true, 'v59.56 September is late after November 15');
assert.equal(buildTwRevenueView(pendingTwMonthlyRevenue()).state, 'pending', 'v59.56 not-collected marker reads pending');
assert.equal(buildTwRevenueView(null, { loadState: 'failed' }).state, 'unavailable', 'v59.56 failed fetch reads unavailable');
assert.equal(buildTwRevenueView({ ...artifact, schemaVersion: 'x' }).reason, 'schema', 'v59.56 unknown schema reads unavailable');

// The committed artifact always parses as the schema (the 수집 전 marker until the first Actions run).
const committed = JSON.parse(await readFile(new URL('../public-data/tw-monthly-revenue.json', import.meta.url), 'utf8'));
assert.equal(committed.schemaVersion, 'tw-monthly-revenue.v1', 'v59.56 committed artifact schema');
assert.ok(['ok', 'not-collected'].includes(committed.status), `v59.56 committed status ${committed.status}`);
if (committed.status === 'ok') assert.ok(committed.companies.every((c) => TW_AI_CHAIN.some((g) => g.id === c.group)), 'v59.56 committed companies belong to a chain group');
console.log('[tw-monthly-revenue-fixture] ok');
