#!/usr/bin/env node
// v59.70 (S16/L6, PLAN perf-legacy 2026-11-04): 포트폴리오's first screen is three native sections — ① 지금 구성과 S&P 500
// (the shared trend chart, from the published closes), ② 보유 종목, ③ 노출 (one stacked bar) — and the page folds into
// three: 기록, 점검, 설정. The old benchmark chart (js/aio-ui.js updateBenchmarkChart: Yahoo per holding behind 새로고침)
// and calculateRR are gone, and js/aio-ui.js writes no portfolio id beyond the two it still owns.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => { try { return readFileSync(join(root, file), 'utf8'); } catch { return ''; } };
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };

const html = read('index.html');
const start = html.indexOf('<div class="page" id="page-portfolio">');
const end = html.indexOf('<div class="page" id="page-ticker"', start);
const block = start >= 0 && end > start ? html.slice(start, end) : '';
check('v59.70 portfolio block found in index.html', !!block);
const ui = read('js/aio-ui.js');

// 1. The client-side Yahoo benchmark and the legacy plan check are gone: js/aio-ui.js, run in a sandbox, defines neither.
const legacy = (() => {
  const stub = () => new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub() });
  const sandbox = { console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout() {}, setInterval() {}, clearTimeout() {}, clearInterval() {}, addEventListener() {}, removeEventListener() {}, document: stub(), navigator: stub(), localStorage: stub(), sessionStorage: stub(), location: stub() };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  try { vm.runInNewContext(ui, sandbox, { filename: 'js/aio-ui.js' }); } catch { /* top-level wiring past the definitions may throw in the sandbox */ }
  return sandbox;
})();
check('v59.70 js/aio-ui.js loads in the sandbox', typeof legacy.renderPortfolioTechnicalRisk === 'function');
check('v59.70 js/aio-ui.js no longer defines updateBenchmarkChart (Yahoo per holding behind 새로고침)', typeof legacy.updateBenchmarkChart === 'undefined');
check('v59.70 js/aio-ui.js no longer defines calculateRR', typeof legacy.calculateRR === 'undefined');
check('v59.70 the page has no 새로고침 benchmark button or calculateRR action', !/data-action="(updateBenchmarkChart|calculateRR)"/.test(block));

// 2. js/aio-ui.js writes no portfolio id except the two listed in route-owners legacyWriterEvidence.
const ids = new Set([...block.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
const ALLOWED = new Set(['pf-technical-risk', 'pf-total-value', 'pf-total-pnl']);
const touched = [...new Set([...ui.matchAll(/getElementById\('([^']+)'\)|querySelector(?:All)?\('#([\w-]+)/g)].map((match) => match[1] || match[2]))]
  .filter((id) => ids.has(id) || /^(rr-|pf-benchmark)/.test(id));
const extra = touched.filter((id) => !ALLOWED.has(id));
check('v59.70 js/aio-ui.js writes no portfolio id beyond pf-technical-risk and the hero aria-live hook', extra.length === 0, extra.join(', '));
// 'pf-total-value'/'pf-total-pnl' are read from an array literal, not getElementById('…'); list them in the evidence.
const owners = JSON.parse(read('architecture/route-owners.json'));
const portfolio = owners.routes?.portfolio || {};
check('v59.70 route-owners: portfolio chartOwner is native', portfolio.chartOwner === 'native');
check('v59.70 route-owners: chartNativeRoutes include portfolio', (owners.counts?.chartNativeRoutes || []).includes('portfolio') && owners.counts?.chartNative === (owners.counts?.chartNativeRoutes || []).length);
check('v59.70 route-owners: the remaining aio-ui portfolio writers are named', (portfolio.legacyWriterEvidence || []).some((line) => /renderPortfolioTechnicalRisk/.test(line)));

// 3. Three first-screen sections, each with its visual; the chart and the bar are native components.
const firstIds = ['pf-value-trend', 'pf-holdings-table-section', 'pf-exposure-bar'];
const positions = firstIds.map((id) => block.indexOf(`id="${id}"`));
check('v59.70 first screen: ① chart, ② holdings, ③ exposure in that order', positions.every((at) => at > 0) && positions[0] < positions[1] && positions[1] < positions[2], positions.join(','));
check('v59.70 ② holdings table stays in the first screen', /id="pf-positions-tbody"/.test(block));


// 4. Exactly three folds on the page body, titled 기록 · 점검 · 설정; no other static fold outside the entry form.
const folds = [...block.matchAll(/<details[^>]*data-pf-fold="(\w+)"[^>]*>\s*<summary>([^<]+)<\/summary>/g)].map((match) => [match[1], match[2]]);
check('v59.70 three folds: 기록, 점검, 설정', folds.length === 3 && folds.map(([, title]) => title.split(' — ')[0]).join(',') === '기록,점검,설정', JSON.stringify(folds));
const otherDetails = (block.match(/<details\b/g) || []).length - folds.length - (block.match(/<details class="pf-entry-optional">/g) || []).length;
check('v59.70 no other fold in the page body (the add form\'s optional fields excepted)', otherDetails === 0, String(otherDetails));

// 5. The pure model: a book that doubled while the index rose 10% over the year reads +100% vs +10%.
const load = async (file) => { try { return await import(pathToFileURL(join(root, file)).href); } catch { return {}; } };
const { buildBenchmarkTrend = () => ({}) } = await load('src/domain/portfolio/benchmark-trend.js');
const returns = { AAA: { ret12m: 100, ret6m: 50, ret3m: 20, ret1m: 10, ret5d: 2, ret1d: 1 }, BBB: { ret12m: null, ret6m: 10, ret3m: 5, ret1m: 2, ret5d: 1, ret1d: 0 } };
const index = { ret12m: 10, ret6m: 5, ret3m: 3, ret1m: 1, ret5d: 0.5, ret1d: 0.1 };
const dates = { 252: '2025-11-03', 126: '2026-05-04', 63: '2026-08-03', 21: '2026-10-03', 5: '2026-10-27', 1: '2026-11-02' };
const full = buildBenchmarkTrend({ holdings: [{ symbol: 'AAA', value: 900 }, { symbol: 'BBB', value: 100 }], returnOf: (symbol, key) => returns[symbol][key], indexReturnOf: (key) => index[key], dateOf: (n) => dates[n], asOf: '2026-11-03' });
check('v59.70 model: the 1-year window reads the 90% of value that has it, names the rest', full.available && full.window === '1년' && Math.abs(full.bookPct - 100) < 1e-9 && Math.abs(full.indexPct - 10) < 1e-9 && full.missing.join() === 'BBB' && Math.abs(full.coveredShare - 0.9) < 1e-9 && full.points.length === 7, JSON.stringify({ window: full.window, book: full.bookPct, index: full.indexPct, missing: full.missing }));
const thin = buildBenchmarkTrend({ holdings: [{ symbol: 'AAA', value: 100 }, { symbol: 'BBB', value: 900 }], returnOf: (symbol, key) => returns[symbol][key], indexReturnOf: (key) => index[key], dateOf: (n) => dates[n], asOf: '2026-11-03' });
check('v59.70 model: under 80% coverage the chart starts at the longest window all of the book can read', thin.available && thin.window === '6개월' && thin.missing.length === 0, JSON.stringify({ window: thin.window }));
check('v59.70 model: no holdings is the empty state, missing inputs the loading state', buildBenchmarkTrend({ holdings: [] }).reason === 'empty' && buildBenchmarkTrend({ holdings: [{ symbol: 'AAA', value: 1 }] }).reason === 'loading');

// 5b. The component models: ① holds on mixed currency and waits for data; ③ splits the book by sector.
const { portfolioValueTrend = () => ({}) } = await load('src/ui/components/portfolio-value-trend.js');
const fetchCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (...args) => { fetchCalls.push(args); return Promise.reject(new Error('offline')); };
check('v59.70 ① holds a mixed-currency book and waits while the closes are missing', portfolioValueTrend({ surface: { currencyState: 'mixed-without-conversion', rows: [] }, rowOf: () => null }).reason === 'currency' && portfolioValueTrend({ surface: { rows: [{ symbol: 'AAA', value: 1 }] }, rowOf: () => null }).reason === 'loading');
check('v59.70 ① and the model read no network', fetchCalls.length === 0, String(fetchCalls.length));
globalThis.fetch = realFetch;
const { portfolioExposure = () => ({}) } = await load('src/ui/components/portfolio-exposure-bar.js');
const sectors = ['Tech', 'Tech', 'Energy', 'Health', 'Utilities', 'Materials', 'Industrials', 'ETF'];
const exp = portfolioExposure({ surface: { rows: sectors.map((sector, i) => ({ symbol: `S${i}`, sector, value: i === 0 ? 300 : 100 })) } });
check('v59.70 ③ five sectors and 기타, largest holding and sector named', exp.available && exp.segments?.length === 6 && exp.segments.at(-1).label === '기타' && exp.topSymbol === 'S0' && exp.topSector?.label === 'Tech' && Math.abs(exp.topSector.pct - 40) < 1e-9 && Math.abs(exp.segments.reduce((sum, row) => sum + row.pct, 0) - 100) < 1e-9, JSON.stringify(exp));
check('v59.70 ③ an empty book draws no bar', portfolioExposure({ surface: { rows: [] } }).reason === 'empty');

// 6. The plan check keeps its refusal rules (P2071) in the native module.
const { planCheckLines = () => ({}) } = await load('src/ui/components/portfolio-plan-check.js');
const plan = planCheckLines({ entry: 100, stop: 90, target: 130, amount: 1000, total: 10000 });
check('v59.70 plan check: risk -10.0%, reward 3.00배, loss 1.0% of capital', plan.lines?.[0]?.includes('-10.0%') && plan.lines?.[1]?.includes('3.00배') && plan.lines?.[2]?.includes('전체 자본의 1.0%'), JSON.stringify(plan));
check('v59.70 plan check: a stop above entry and a 1e20 amount are refused', !!planCheckLines({ entry: 100, stop: 110 }).refused && !!planCheckLines({ entry: 100, stop: 90, amount: 1e20 }).refused);

if (failures.length) {
  console.error(`Portfolio native chart check FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Portfolio native chart check OK: native ① chart, three first-screen sections, three folds, no aio-ui benchmark/plan writers.');
