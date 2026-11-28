// 종목 현금 사슬 and its one-owner readings: the free-cash change split into operating cash and capex
// (src/domain/fundamental/cash-chain.js fcfBridge), dilution against growth (dilutionRead), the cash runway of a loss-maker
// burning cash (runwayRead), the 이익의 질 card rows that carry them, the business lens reading the collected quarter-end
// inventory, the four-week revisions owned by 이 주가가 반영하는 것 (priced-in.js) alone, and one table of holding and
// breaking readings on 쟁점과 전망. Facts in, fixed state word out.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export default async function run({ load, fail }) {
  const ok = (cond, msg) => { if (!cond) fail(msg); };
  const chain = await load('src/domain/fundamental/cash-chain.js');
  const { buildEarningsQuality } = await load('src/domain/fundamental/earnings-quality.js');
  const year = (periodEnd, more) => ({ periodEnd, revenue: 1000, netIncome: 100, equity: 500, ...more });

  // C1: a capex cut at least as large as the improvement is the cut's; an operating-cash rise larger than the cut is not.
  const cut = chain.fcfBridge([year('2024-12-31', { operatingCashFlow: 100, capex: 50 }), year('2025-12-31', { operatingCashFlow: 95, capex: 20 })], 'T');
  ok(cut?.state === 'capex-cut' && cut.fcfChange === 25 && cut.capexChange === -30, `C1 capex cut 30 ≥ improvement 25 reads capex-cut: ${JSON.stringify(cut && { state: cut.state, d: cut.fcfChange })}`);
  const grew = chain.fcfBridge([year('2024-12-31', { operatingCashFlow: 100, capex: 50 }), year('2025-12-31', { operatingCashFlow: 140, capex: 45 })], 'T');
  ok(grew?.state === 'operating', `C1 operating cash +40 against a cut of 5 is not a capex cut: ${grew?.state}`);
  ok(chain.fcfBridge([year('2022-12-31', { operatingCashFlow: 100, capex: 50 }), year('2025-12-31', { operatingCashFlow: 95, capex: 20 })], 'T') === null, 'C1 two non-adjacent fiscal years are not a year-over-year split');

  // C2: shares outrunning revenue (revenue per share falling) is dilution outpacing growth.
  const diluted = chain.dilutionRead([year('2023-12-31', { revenue: 100, shares: 100 }), year('2025-12-31', { revenue: 120, shares: 150 })], 'T');
  ok(diluted?.state === 'outpaced' && diluted.label === '희석이 성장보다 빠름' && diluted.perShareCagr < 0, `C2 shares +50% over revenue +20% reads 희석이 성장보다 빠름: ${diluted?.state}`);
  const heavy = chain.dilutionRead([year('2023-12-31', { revenue: 100, shares: 100 }), year('2025-12-31', { revenue: 200, shares: 125 })], 'T');
  ok(heavy?.state === 'heavy' && heavy.sharesCagr > chain.CASH_CHAIN.heavyDilutionPct, `C2 shares +11.8%/yr past the 5% line is weighed even with revenue per share up: ${heavy?.state}`);

  // C3: no runway line without a cash burn or without a cash figure; with both, cash ÷ burn in years.
  const burning = year('2025-12-31', { netIncome: -50, operatingCashFlow: -30, capex: 20, cash: 150, shortTermInvestments: 50 });
  const runway = chain.runwayRead([burning], 'T');
  ok(runway && Math.abs(runway.years - 4) < 1e-9 && runway.burn === 50, `C3 (150 + 50) ÷ 50 burn = 4 years: ${runway?.years}`);
  ok(chain.runwayRead([{ ...burning, operatingCashFlow: 80 }], 'T') === null, 'C3 a positive free cash flow has no runway line');
  ok(chain.runwayRead([{ ...burning, cash: null }], 'T') === null, 'C3 a missing cash figure drops the line instead of reading 0');

  // The 이익의 질 card carries the chain rows; the one-year share row it had is gone (the dilution row owns the share count).
  const rows = buildEarningsQuality({ symbol: 'T', history: [year('2024-12-31', { operatingCashFlow: -20, capex: 10, shares: 100, netIncome: -40 }), { ...burning, shares: 110 }] }).rows;
  const ids = rows.map((row) => row.id);
  ok(['fcf-bridge', 'shares', 'runway'].every((id) => ids.includes(id)), `the card carries the bridge, dilution and runway rows: ${ids}`);
  ok(!rows.some((row) => row.name === '주식 수 변화 (1년)'), 'the one-year share row is gone');
  const { buildFiscalRead } = await load('src/domain/fundamental/fiscal-read.js');
  const fiscal = buildFiscalRead({ symbol: 'T', fundamentals: { symbol: 'T', fiscalHistory: [year('2021-12-31', { shares: 100 }), year('2025-12-31', { shares: 90 })] } });
  ok(!fiscal.points.some((point) => point.id === 'shares'), 'the share count is read once (the card), not again in the 공시가 말하는 것 list');

  // C5: the lens inventory row reads the collected quarter-end inventory instead of '미확인'.
  const { buildLensRead, buildThesisFrame, buildWatchList, STOCK_LENSES } = await load('src/domain/fundamental/stock-lens.js');
  const { buildWorkingCapitalRead, parseQuarterHistory } = await load('src/domain/fundamental/quarter-read.js');
  const quarters = parseQuarterHistory('2025-06-30:100:10::40:30;2025-09-30:110:11::60:31');
  const lens = buildLensRead({ lens: { id: 'consumer' }, history: [year('2025-12-31', {})], workingCapital: buildWorkingCapitalRead(quarters, { symbol: 'T' }) });
  const inventory = lens.rows.find((row) => row.id === 'inventory');
  ok(inventory?.check == null && /\+50\.0%/.test(inventory?.value || '') && inventory.trend === '매출보다 빠름', `C5 inventory +50% vs sales +10% is read, not 미확인: ${JSON.stringify(inventory)}`);

  // The four-week revisions are 이 주가가 반영하는 것's: no lens row, no watch item, no count in the thesis conditions.
  ok(!Object.values(STOCK_LENSES).some((def) => def.metrics.some((metric) => metric.id === 'revisions')), 'no lens lists the revisions row');
  const consensus = { fwd: { up4w: 7, down4w: 1 } };
  ok(!buildWatchList({ consensus, schedule: { text: '11/19' } }).some((item) => item.id === 'revisions'), 'the watch list has no revisions item');
  const { PRICED_IN_STATES } = await load('src/domain/fundamental/priced-in.js');
  const frame = buildThesisFrame({ implied: { state: 'ready', growth: 0.1 }, consensus, schedule: { text: '11/19' }, pricedIn: { label: PRICED_IN_STATES.ahead } });
  ok(!/4주 상향|하향 \d/.test(JSON.stringify(frame)), `the thesis does not count revisions: ${frame.conditions}`);
  const rule = frame.rules?.find((item) => item.id === 'priced-in');
  ok(rule?.breaks.includes(PRICED_IN_STATES.confirmed) && rule.holds.includes(PRICED_IN_STATES.ahead), `the revision rule reads the priced-in state: ${JSON.stringify(rule)}`);
  ok(frame.rules.every((item) => item.holds && item.breaks) && frame.rules.find((item) => item.id === 'growth')?.check === '실적: 11/19', 'each number rule pairs its holding and breaking reading with its check');

  // C4: 재무 공시 draws no thesis card; 쟁점과 전망 draws one table with the researched rows and the number rules.
  const cards = await load('src/ui/components/stock-lens-cards.js');
  ok(!('thesisCard' in cards), 'the 재무 공시 thesis card is gone');
  const { createFakeDocument } = await load('scripts/lib/fake-dom.mjs');
  const { renderCompanyOverview } = await load('src/ui/components/company-overview.js');
  const doc = createFakeDocument();
  const outlookHost = doc.createElement('section');
  const story = { debate: { question: 'Q', bull: { text: 'bull' }, bear: { text: 'bear' }, decides: [{ when: '2026-12-01', what: 'report' }] }, watch: { confirms: ['c'], breaks: ['b'] } };
  renderCompanyOverview(doc, doc.createElement('div'), { symbol: 'T', story, profile: { name: 'T' }, place: { capital: [] }, money: { rows: [] }, thesis: frame, outlookHost });
  const walk = (node, out = []) => { out.push(node); for (const child of node.children || []) walk(child, out); return out; };
  const nodes = walk(outlookHost);
  const tables = nodes.filter((node) => String(node.className || '').includes('co-verdicts__table'));
  const bodyRows = nodes.filter((node) => String(node.tagName || node.nodeName || '').toLowerCase() === 'tr' && node.parentElement && String(node.parentElement.tagName || '').toLowerCase() === 'tbody');
  ok(tables.length === 1, `쟁점과 전망 has one holds/breaks table: ${tables.length}`);
  ok(bodyRows.length === 2 + frame.rules.length + frame.paths.length, `the table holds the issue, the signals and every number rule: ${bodyRows.length}`);
  ok(!/어긋나고 있다는 신호|틀렸다는 신호/.test(outlookHost.textContent), 'no second break list beside the table');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  await run({ root, load: (rel) => import(pathToFileURL(path.join(root, rel)).href), fail: (msg) => { throw new Error(msg); } });
  console.log('unit-cases company-cash: PASS');
}
