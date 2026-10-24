// v58.55 개편 v2 (5n) 투자자별 순매수: ECOS item discovery by the item's own name (no hard-coded or guessed codes), unit
// conversion to 억원, the artifact, and the read model (latest session, 20-session trend, missing investor types named).
import assert from 'node:assert/strict';
import { classifyEcosItem, parseEcosDailyRows, buildKrInvestorFlows, pendingKrInvestorFlows, KR_INVESTOR_FLOWS_SCHEMA } from './fetch-kr-investor-flows.mjs';
import { buildKrInvestorFlowView, formatEok } from '../src/domain/market/kr-investor-flows.js';

// ECOS StatisticItemList-shaped rows (codes here are fixture codes, not ECOS's).
const items = [
  { ITEM_CODE: 'A1', ITEM_NAME: 'KOSPI지수', CYCLE: 'D', UNIT_NAME: '1980.01.04=100' },
  { ITEM_CODE: 'A2', ITEM_NAME: '외국인 순매수(유가증권시장)', CYCLE: 'D', UNIT_NAME: '억원' },
  { ITEM_CODE: 'A3', ITEM_NAME: '외국인 순매수(코스닥시장)', CYCLE: 'D', UNIT_NAME: '백만원' },
  { ITEM_CODE: 'A4', ITEM_NAME: '외국인 순매수 수량', CYCLE: 'D', UNIT_NAME: '천주', P_ITEM_NAME: '유가증권시장' },
  { ITEM_CODE: 'A5', ITEM_NAME: '외국인 순매수', CYCLE: 'D', UNIT_NAME: '억원' },
  { ITEM_CODE: 'A6', ITEM_NAME: '외국인 순매수(유가증권시장)', CYCLE: 'M', UNIT_NAME: '억원' }
];
assert.deepEqual(classifyEcosItem(items[1]), { market: 'kospi', investor: 'foreign', factor: 1, unit: '억원', generality: 0 }, 'v58.55 KOSPI foreign net purchase is recognised by its name');
assert.equal(classifyEcosItem(items[2]).market, 'kosdaq', 'v58.55 KOSDAQ by name');
assert.equal(classifyEcosItem(items[2]).factor, 0.01, 'v58.55 백만원 converts to 억원');
assert.equal(classifyEcosItem(items[0]).skip, 'not-net-purchase', 'v58.55 index level is not a flow');
assert.match(classifyEcosItem(items[3]).skip, /^unit-unknown/, 'v58.55 a share-count item is not read as won');
assert.equal(classifyEcosItem(items[4]).skip, 'market-ambiguous', 'v58.55 an item that does not name its market is not assigned one');
assert.equal(classifyEcosItem(items[5]).skip, 'not-daily', 'v58.55 a monthly item is not a daily series');
for (const name of ['외국인 순매수(KOSPI200)', '외국인 순매수(코스피 대형주)', '외국인 순매수(코스닥150)', '외국인 순매수(유가증권시장 업종)']) {
  assert.equal(classifyEcosItem({ ITEM_CODE: 'S', ITEM_NAME: name, CYCLE: 'D', UNIT_NAME: '억원' }).skip, 'sub-index', `v58.55 review: ${name} is a sub-index, not the market-wide figure`);
}
{
  const both = buildKrInvestorFlows({ items: [
    { ITEM_CODE: 'B1', ITEM_NAME: '외국인 순매수(유가증권시장 거래소 집계분)', CYCLE: 'D', UNIT_NAME: '억원' },
    { ITEM_CODE: 'B2', ITEM_NAME: '외국인 순매수(유가증권시장)', CYCLE: 'D', UNIT_NAME: '억원' },
    { ITEM_CODE: 'B3', ITEM_NAME: '외국인 순매수(KOSPI200)', CYCLE: 'D', UNIT_NAME: '억원' }],
  seriesByItem: { B1: [{ TIME: '20261020', DATA_VALUE: '1' }], B2: [{ TIME: '20261020', DATA_VALUE: '2' }], B3: [{ TIME: '20261020', DATA_VALUE: '3' }] } });
  assert.equal(both.markets.kospi.investors.foreign.itemCode, 'B2', 'v58.55 review: the market-wide item wins over a qualified duplicate, whatever the order');
  assert.ok(!('generality' in both.markets.kospi.investors.foreign), 'v58.55 the ranking field is not published');
}

const dates = [];
for (let t = Date.UTC(2026, 8, 1); dates.length < 30; t += 86400000) { const d = new Date(t); if (d.getUTCDay() % 6) dates.push(d.toISOString().slice(0, 10)); }
const rows = (fn) => dates.map((date, i) => ({ TIME: date.replace(/-/g, ''), DATA_VALUE: String(fn(i)) }));
const parsed = parseEcosDailyRows([...rows((i) => i * 10), { TIME: '2026-09', DATA_VALUE: '1' }, { TIME: '20260930', DATA_VALUE: '' }], 1);
assert.equal(parsed.length, 30, 'v58.55 malformed and empty rows are dropped, not filled');
const payload = buildKrInvestorFlows({ items, seriesByItem: { A2: rows((i) => (i % 2 ? -1 : 1) * 1000 - 200), A3: rows((i) => 50000 + i) }, generatedAt: '2026-10-20T00:00:00Z' });
assert.equal(payload.schemaVersion, KR_INVESTOR_FLOWS_SCHEMA);
assert.equal(payload.status, 'ok');
assert.deepEqual(Object.keys(payload.markets).sort(), ['kosdaq', 'kospi']);
assert.equal(payload.markets.kosdaq.investors.foreign.series.at(-1).value, 500.29, 'v58.55 백만원 values become 억원');
assert.deepEqual(payload.missingInvestors, ['individual', 'institution'], 'v58.55 investor types the source does not publish are listed as missing');
assert.equal(buildKrInvestorFlows({ items: items.slice(0, 1) }).status, 'no-investor-items', 'v58.55 no matching item → no numbers');

const nowMs = Date.parse(`${dates.at(-1)}T09:00:00Z`);
const view = buildKrInvestorFlowView(payload, { nowMs });
assert.equal(view.state, 'ok');
const kospi = view.markets.find((m) => m.id === 'kospi');
assert.equal(kospi.date, dates.at(-1));
assert.equal(kospi.rows.length, 1, 'v58.55 only the published investor type is drawn');
assert.equal(kospi.trends[0].points.length, 20, 'v58.55 the trend is the last 20 sessions');
assert.equal(kospi.trends[0].sum5, -2000, `v58.55 5-session sum (${kospi.trends[0].sum5})`);
assert.deepEqual(view.missing, ['개인', '기관']);
assert.equal(kospi.stale, false);
assert.equal(buildKrInvestorFlowView(payload, { nowMs: nowMs + 9 * 86400000 }).markets[0].stale, true, 'v58.55 an old session is marked 지연');
assert.equal(buildKrInvestorFlowView(null).state, 'loading', 'v58.55 review: no file yet reads as loading, not 수집 전');
assert.deepEqual(buildKrInvestorFlowView(null, { loadState: 'failed' }), { state: 'unavailable', reason: 'fetch-failed' }, 'v58.55 review: a failed fetch is its own state');
{
  const pending = pendingKrInvestorFlows('key-missing', '2026-10-20T00:00:00Z');
  assert.equal(buildKrInvestorFlowView(pending).state, 'pending', 'v58.55 the 수집 전 marker carries no numbers and reads as pending');
  assert.ok(!JSON.stringify(pending).match(/"value"/), 'v58.55 the marker has no values');
}
assert.equal(formatEok(-17716), '-1.8조', 'P1593 family (v58.74 ASCII minus): a net sell reads -1.8조');
assert.equal(formatEok(5485), '+5,485억');
console.log('PASS v58.55 KR investor flows: ECOS item discovery by name, unit conversion, artifact, read model.');
