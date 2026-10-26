#!/usr/bin/env node
// Entity summary and company analysis (P1624). v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('entity-summary-fixture', [
// ── section entity-summary (was ci-entity-summary-fixture.mjs) ──
['entity-summary', async () => {
// P1624: first-summary public history, identity, quote basis, race/cancellation and signed-return regression.
const { default: assert } = await import('node:assert/strict');
const { readFile } = await import('node:fs/promises');
const { normalizeSummaryChart, createSummaryHydrator } = await import('../src/domain/entity/summary-hydration.js');
const { businessProfileFor } = await import('../src/domain/entity/business-profiles.js');
const { relativeVisual } = await import('../src/ui/components/stock-read.js');

const nowMs = Date.parse('2026-10-09T18:00:00Z');
const payload = (symbol = 'AEHR') => ({ chart: { result: [{ meta: { symbol, currency: 'USD', regularMarketPrice: 84.64,
  previousClose: 87.21, chartPreviousClose: 25, regularMarketTime: nowMs / 1000 - 60,
  exchangeTimezoneName: 'America/New_York', currentTradingPeriod: { regular: { end: Date.parse('2026-10-09T20:00:00Z') / 1000 } } },
  timestamp: ['2026-10-07T13:30:00Z', '2026-10-08T13:30:00Z', '2026-10-09T13:30:00Z'].map(Date.parse).map(ms => ms / 1000),
  indicators: { quote: [{ close: [85, 87.21, 84.64], open: [84, 86, 88], high: [86, 88, 89], low: [83, 85, 84], volume: [100, 200, 300] }] } }] } });
const response = p => { const r = p.chart.result[0], q = r.indicators.quote[0]; return { meta: r.meta, timestamps: r.timestamp,
  closes: q.close, opens: q.open, highs: q.high, lows: q.low, volumes: q.volume }; };
const data = normalizeSummaryChart(payload(), 'AEHR', { nowMs });
assert.equal(data.history.length, 2, 'P1624 unfinished current daily bar must be excluded');
assert.equal(data.quote.price, 84.64, 'P1624 regular quote can coexist with completed history');
assert.equal(data.quote.currency, 'USD', 'P1624 currency retained');
assert.equal(data.quote.previousClose, 87.21, 'P1624 range-start chartPreviousClose is not previous session close');
assert.equal(data.quote.allowedUseCeiling, 'reference', 'P1624 public quote is not decision-grade');
assert.equal(normalizeSummaryChart(payload('NVDA'), 'AEHR', { nowMs }), null, 'P1624 issuer mismatch is rejected');
const noQuote = payload(); delete noQuote.chart.result[0].meta.regularMarketTime;
const fallback = normalizeSummaryChart(noQuote, 'AEHR', { nowMs });
assert.equal(fallback.quote.valueBasis, 'completed-daily-close', 'P1624 fallback identifies completed close');
assert.equal(fallback.quote.observedAt, '2026-10-08', 'P1624 collection time never replaces observation date');
assert.equal(fallback.quote.price, 87.21);
const noPrevious = payload(); delete noPrevious.chart.result[0].meta.previousClose;
assert.equal(normalizeSummaryChart(noPrevious, 'AEHR', { nowMs }).quote.previousClose, 87.21, 'P1624 previous complete dated bar can prove regular-close denominator');
noPrevious.chart.result[0].timestamp = []; noPrevious.chart.result[0].indicators.quote[0].close = [];
assert.equal(normalizeSummaryChart(noPrevious, 'AEHR', { nowMs }).quote.pct, null, 'P1624 absent previous regular close holds change');

const pending = [], applied = [];
const root = { _aioFetchYahooChartData: (id, range, interval, { signal }) => new Promise(resolve => pending.push({ id, range, interval, signal, resolve })) };
const hyd = createSummaryHydrator({ root, now: () => nowMs, onReady: item => applied.push(item.symbol) });
hyd.ensure('AEHR'); hyd.ensure('AEHR'); await Promise.resolve();
assert.equal(pending.length, 1, 'P1624 repeated renders deduplicate request');
assert.equal(pending[0].range, '1y'); assert.equal(pending[0].interval, '1d');
hyd.ensure('PLTR'); await Promise.resolve();
assert.equal(pending[0].signal.aborted, true, 'P1624 selection change aborts prior transport');
pending[0].resolve(response(payload())); pending[1].resolve(response(payload('PLTR')));
await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(applied, ['PLTR'], 'P1624 late old issuer response does not paint');
assert.equal(root._tickerHistory.PLTR.length, 2, 'P1624 summary first-load independently hydrates history');
hyd.ensure('AEHR'); await Promise.resolve();
hyd.dispose();
assert.equal(pending.at(-1).signal.aborted, true, 'P1624 route cleanup cancels request');
pending.at(-1).resolve(response(payload())); await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(applied, ['PLTR'], 'P1624 disposed route cannot paint');
const cached = createSummaryHydrator({ root, now: () => nowMs, onReady: item => applied.push(item.symbol) });
cached.ensure('PLTR'); assert.equal(pending.length, 3, 'P1624 revisit reuses bounded quote/history cache'); cached.dispose();
assert.equal(businessProfileFor('AEHR').description, null, 'P1624 example issuer never gets a special hardcoded profile');
const company = { businessProfile: { symbol: 'XYZ', description: '공식 사업 설명', sourceUrl: 'https://example.com/company' } };
assert.equal(businessProfileFor('XYZ', company).description, '공식 사업 설명', 'P1624 sourced descriptions use a universal identity contract');
assert.equal(businessProfileFor('OTHER', company).description, null, 'P1624 another issuer cannot inherit a description');
assert.equal(businessProfileFor('UNKNOWN').description, null, 'P1624 unknown business description is not invented');

function element(tag) { return { tag, childNodes: [], style: {}, append(...nodes) { this.childNodes.push(...nodes); } }; }
const visual = relativeVisual({ createElement: element }, { symbol: 'AEHR', benchmarkLabel: 'S&P 500', spans: [{ label: '1개월', stock: -9.8, bench: 2.9 }] });
const pair = visual.childNodes[1].childNodes[1];
const negative = pair.childNodes[0].childNodes[0].childNodes[0];
const positive = pair.childNodes[1].childNodes[0].childNodes[0];
assert.equal(negative.style.left, '0.00%', 'P1624 negative return starts left of common zero');
assert.equal(negative.style.width, '50.00%');
assert.equal(positive.style.left, '50.00%', 'P1624 positive return starts right of common zero');
assert.equal(positive.style.width, '14.80%', 'P1624 common scale preserves relative magnitudes');
const css = await readFile(new URL('../src/ui/styles/entity-quality.css', import.meta.url), 'utf8');
assert.match(css, /stock-return-signed-track::after[^}]*left:50%/, 'P1624 zero line belongs to signed chart only');
assert.doesNotMatch(css, /\.stock-read-bar\s*\{/, 'P1624 fiscal peer shared bars remain unchanged');
console.log('PASS P1624 entity summary: first-load history, quote currency/basis, identity, cancellation/cache and signed returns');
}],
// ── section company-analysis (was ci-company-analysis-fixture.mjs) ──
['company-analysis', async () => {
// P1624: examples are regression cases; the analysis contract is identical for every issuer.
const { default: assert } = await import('node:assert/strict');
const { buildCompanyAnalysis, companyAnalysisContext } = await import('../src/domain/entity/company-analysis.js');
const nowMs=Date.parse('2026-10-11T18:00:00Z');
const row={sym:'XYZ',name:'Example Company',market:'US',currency:'USD',factorSessionDate:'2026-10-09',ret3m:10,pctSma50:4,pctSma200:8,assetType:'stock'};
const model=buildCompanyAnalysis({symbol:'XYZ',row,rows:[row],nowMs});
assert.equal(model.business.description,null,'P1624 any issuer without sourced business text stays unavailable');
assert.equal(model.marketEvidence.relative.rank,1,'P1624 common rank compares the exact market/session');
const foreign=buildCompanyAnalysis({symbol:'OTHER',row,summary:{symbol:'XYZ',quote:{price:4,observedAt:'2026-10-09'}},fundamentals:{symbol:'XYZ',periodType:'FY',revenue:100},nowMs});
assert.equal(foreign.price.value,null,'P1624 another issuer cannot inherit the quote');
assert.equal(foreign.financial.fiscal.available,false,'P1624 another issuer cannot inherit the fiscal receipt');
const etf=buildCompanyAnalysis({symbol:'XYZ',row:{...row,instrumentRef:{assetType:'ETF'}},nowMs});
assert.equal(etf.financial.status,'not-applicable','P1624 ETF is not interpreted as a business company');
const kr=buildCompanyAnalysis({symbol:'005930.KS',row:{...row,sym:'005930.KS',market:'KR',currency:'KRW',factorSessionDate:'2026-10-08'},nowMs});
assert.equal(kr.identity.market,'KR','P1624 Korean issuer has its own market');
assert.equal(kr.financial.status,'kr-disclosure-required','P1624 US SEC data does not fill missing Korean filings');
assert.match(companyAnalysisContext(model),/내부 사업 설명 미수집.*웹검색/,'P1624 missing business evidence is explicitly passed to qualitative AI retrieval');
console.log('PASS P1624 company analysis: universal issuer contract, same-market facts, ETF/KR/missing/foreign-receipt boundaries.');
}],
]);
