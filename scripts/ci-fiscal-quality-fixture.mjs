// P1627: offline signed-chart, period, precision and missing-data regression contracts.
// Does not import or execute the data producer, fetch a provider, or write artifacts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseFiscalHistory, renderFiscalRead, fiscalBarGeometry, formatFiscalAmount, formatFiscalCompact } from '../src/ui/components/fiscal-read.js';
import { buildFiscalRead, reconcileFiscalHistory } from '../src/domain/fundamental/fiscal-read.js';
import { fiscalMetrics, buildPeerRead } from '../src/domain/fundamental/peer-read.js';

const fixture = { symbol: 'AEHR', cik: '0001040470', accession: '0001654954-26-006919', periodType: 'FY', observedAt: '2026-05-29', filedAt: '2026-07-27',
  revenue: 50001000, netIncome: -7126000, equity: 219511000, revGrowth: -15.2, roe: -3.2, sharesOutstanding: 32620450, sharesObservedAt: '2026-07-20' };
const compact = '2025-05-30:59:-4:123::::30;2026-05-29:50:-7:220::::33';
const history = parseFiscalHistory(compact);
const read = buildFiscalRead({ symbol: 'AEHR', fundamentals: { ...fixture, fiscalHistory: history } });
assert.equal(read.latest.netIncome, fixture.netIncome, 'P1627 exact annual loss must replace rounded millions');
assert.equal(read.latest.revenue, fixture.revenue, 'P1627 exact annual revenue must match receipt');
assert.equal(read.lastGrowth, -15.2, 'P1627 headline growth must use the matching annual receipt');
assert.equal(read.roeBasis, '평균 자기자본 기준', 'P1627 average equity ROE must keep its own labelled basis');
assert.ok(Math.abs(read.roe - fixture.netIncome / ((fixture.equity + 123e6) / 2) * 100) < 1e-12, 'P1627 ROE must use two matching annual year-ends');
assert.equal(fiscalMetrics(read.history).growth, -15.2, 'P1627 peer and lead growth must share the same annual receipt');
assert.equal(history[1].netIncome, -7e6, 'P1627 reconciliation must not mutate the public history input');
for (const changed of [{ symbol: 'NVDA' }, { observedAt: '2026-08-29', periodType: 'Q' }, { observedAt: '2025-05-30' }]) {
  assert.equal(reconcileFiscalHistory(history, { ...fixture, ...changed }, 'AEHR')[1].netIncome, -7e6, 'P1627 a different issuer or period must never overwrite the annual loss');
}
assert.equal(reconcileFiscalHistory(history, { ...fixture, operatingCashFlow: null }, 'AEHR')[1].operatingCashFlow, null, 'P1627 missing cash flow must remain missing');
assert.equal(formatFiscalAmount(-7126000), '−$7.126M', 'P1627 displayed losses must retain sign and precision');
assert.equal(formatFiscalAmount(null), '자료 없음', 'P1627 missing is not a zero');
assert.equal(formatFiscalAmount(0), '$0M', 'P1627 an observed zero must remain zero');
assert.equal(formatFiscalCompact(416161e6), '$416.2B', 'S20 table amounts read in billions like the paragraph');
assert.equal(formatFiscalCompact(-147.8e9), '−$147.8B', 'S18/S20 the sign precedes the currency');
assert.equal(formatFiscalCompact(null), '자료 없음', 'S20 missing is not a zero');

const scale = fiscalBarGeometry([66e6, 33e6, 50e6, -7e6, 0, null]);
const loss = scale.rect(-7e6); const gain = scale.rect(33e6);
assert.equal(loss.top, scale.baseline, 'P1627 loss must start at the shared zero line');
assert.ok(loss.top + loss.height <= 100 + 1e-12, 'P1627 loss must extend down within the chart');
assert.ok(Math.abs(gain.top + gain.height - scale.baseline) < 1e-12, 'P1627 positive bars must end at the same zero line');
assert.equal(scale.rect(0).height, 0, 'P1627 a zero must not get a fake minimum bar');
assert.equal(scale.rect(null), null, 'P1627 a missing fact must not create a bar');
const gapRead = buildFiscalRead({ symbol: 'TEST', fundamentals: { fiscalHistory: [{ periodEnd: '2023-01-01', revenue: 10, equity: 10, netIncome: 1 }, { periodEnd: '2025-01-01', revenue: 20, equity: 20, netIncome: 2 }] } });
assert.equal(gapRead.lastGrowth, null, 'P1627 two-year gap cannot be called annual revenue growth');
assert.equal(gapRead.roe, null, 'P1627 missing prior annual equity cannot become average annual ROE');
assert.equal(fiscalMetrics(gapRead.history).growth, null, 'P1627 peers must hold the same missing annual growth interval as the lead');
assert.equal(fiscalMetrics(gapRead.history).roe, null, 'P1627 peers must not call equity two years apart average annual ROE');
assert.equal(buildFiscalRead({ symbol: 'AEHR', fundamentals: { ...fixture, symbol: 'NVDA' } }).available, false, 'P1627 a foreign issuer scalar cannot become the selected issuer one-year fallback');
assert.equal(buildFiscalRead({ symbol: 'AEHR', fundamentals: { ...fixture, periodType: 'Q' } }).available, false, 'P1627 a quarter receipt cannot become a one-year fallback');
assert.equal(buildFiscalRead({ symbol: 'AEHR', fundamentals: { ...fixture, periodType: 'TTM' } }).available, false, 'P1627 rolling twelve-month facts cannot masquerade as a filed fiscal year');
const cashSeries = [
  { periodEnd: '2024-12-31', revenue: 100, netIncome: 10, equity: 100, operatingCashFlow: 20, capex: 2 },
  { periodEnd: '2025-12-31', revenue: 110, netIncome: 12, equity: 120, operatingCashFlow: 30, capex: 3 }
];
const financialPeers = buildPeerRead({ symbol: 'OWN', sector: 'Financial Services', peers: ['P1', 'P2', 'P3', 'P4', 'P5'], seriesFor: () => cashSeries });
const financialFcf = financialPeers.rows.find(row => row.id === 'fcfMargin');
assert.equal(financialFcf.percentile, null, 'P1627 financial-sector OCF/capex arithmetic must not imply a higher-is-better FCF rank');
assert.equal(financialFcf.higherIs, null, 'P1627 held financial FCF must not retain a quality direction');
assert.equal(financialFcf.reason, 'financial-cash-flow-not-comparable', 'P1627 held FCF must name its economic-definition boundary');
assert.ok(financialPeers.summary.includes('예금·대출') && financialPeers.summary.includes('순위는 보류'), 'P1627 the existing peer-summary surface must explain financial FCF withholding');
assert.ok(financialPeers.rows.filter(row => row.id !== 'fcfMargin').every(row => row.percentile != null), 'P1627 holding financial FCF must preserve the other comparable filed metrics');
const industrialPeers = buildPeerRead({ symbol: 'OWN', sector: 'Industrials', peers: ['P1', 'P2', 'P3', 'P4', 'P5'], seriesFor: () => cashSeries });
assert.equal(industrialPeers.rows.find(row => row.id === 'fcfMargin').percentile, 50, 'P1627 industrial FCF peer percentiles must remain available');

// Extract only the actual pure producer function; the producer has top-level file writes.
const producer = readFileSync(new URL('./build-sec-runtime-projection.mjs', import.meta.url), 'utf8');
const compactFunction = producer.match(/export function compactFiscalMillions\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(compactFunction, 'P1627 producer must expose a bounded pure precision contract');
const sandbox = {}; vm.createContext(sandbox);
vm.runInContext(compactFunction.replace('export ', '') + '\nthis.convert = compactFiscalMillions;', sandbox);
assert.equal(sandbox.convert(50001000), 50.001, 'P1627 producer must retain USD thousands in revenue');
assert.equal(sandbox.convert(-7126000), -7.126, 'P1627 producer must retain signed USD thousands in income');
assert.equal(sandbox.convert(400000), 0.4, 'P1627 a sub-million profit must not disappear into zero');
assert.equal(sandbox.convert(null), '', 'P1627 producer must not turn missing into zero');
assert.equal((producer.match(/const m = compactFiscalMillions;/g) || []).length, 2, 'P1627 annual and quarterly history must use the same precision');
const fiscalSourceStart = producer.indexOf('const FY_FIELDS =');
const fiscalSourceEnd = producer.indexOf('// P1449: the page projection', fiscalSourceStart);
assert.ok(fiscalSourceStart >= 0 && fiscalSourceEnd > fiscalSourceStart, 'P1627 pure fiscal projection boundary must be identifiable without running the producer');
// P1708: fiscal history picks revenue with the shared domain rule; the sandbox receives the same import.
sandbox.bestRevenueRowsByPeriod = (await import('../src/domain/fundamental/sec-report.js')).bestRevenueRowsByPeriod;
// P1910 (v57.99, audit D6): one concept per series — the same shared anchor the producer imports.
Object.assign(sandbox, await import('../src/domain/fundamental/sec-earnings.js'));
vm.runInContext(producer.slice(fiscalSourceStart, fiscalSourceEnd).replace(/^export /gm, '') + '\nthis.fiscal = fiscalHistory;', sandbox);
for (const form of ['10-K', '20-F', '40-F', '20-F/A']) {
  const year = { form, periodStart: '2025-01-01', periodEnd: '2025-12-31', fiscalPeriod: 'FY', filedAt: '2026-03-01' };
  assert.ok(sandbox.fiscal({ revenue: [{ ...year, value: 50001000 }], netIncome: [{ ...year, value: -7126000 }] }).includes('50.001:-7.126'), 'P1627 every supported annual filing form must preserve its signed precise history');
}
assert.equal(sandbox.fiscal({ revenue: [{ form: '10-Q', periodStart: '2025-01-01', periodEnd: '2025-03-31', fiscalPeriod: 'Q1', filedAt: '2025-05-01', value: 20e6 }] }), '', 'P1627 quarterly facts must not be inserted into annual history');

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.className = ''; this._text = ''; this.style = { setProperty: (key, value) => { this.style[key] = value; } }; this.classList = { add: (...names) => { this.className += ` ${names.join(' ')}`; } }; }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(' '); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this._text = ''; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelector(tag) { return descendants(this).find((child) => child.tagName === tag) || null; }
  addEventListener() {}
}
function descendants(node) { return node.children.flatMap((child) => [child, ...descendants(child)]); }
const host = new Element('section'); const next = new Element('nav');
const doc = { createElement: (tag) => new Element(tag), createTextNode: (text) => { const node = new Element('#text'); node.textContent = text; return node; }, getElementById: (id) => id === 'fund-flow' ? host : id === 'fund-next' ? next : null };
// v58.64 (M1): this root already holds a fresh history. Without the timestamp it fell back to the real fetch, whose
// late failure repainted AEHR over the race below once roots stopped sharing one name-keyed artifact store.
const root = { _aioSecFiscalHistory: { AEHR: compact }, _aioSecFiscalHistoryAt: Date.now(), _aioSecQuarterHistory: {}, _aioGetCanonicalScreenerRows: () => [{ sym: 'AEHR', sector: 'Technology' }] };
renderFiscalRead({ documentRef: doc, root, state: { id: 'AEHR', fundamentals: fixture } });
const nodes = descendants(host);
// 2026-10-13 review S20: the table reads in B/T/M units like the paragraph; the exact signed amount stays in the cell title.
assert.ok(nodes.some((node) => node.tagName === 'table' && node.textContent.includes('−$7.1M')), 'S20 render must expose an annual amount table with signed compact income');
assert.ok(nodes.some((node) => node.tagName === 'td' && node.title === '−$7.126M'), 'P1627/S20 the exact signed income must remain available on the cell');
assert.ok(host.textContent.includes('분기 실적 자료 없음'), 'P1627 annual data must not masquerade as recent quarter data');
assert.ok(host.textContent.includes('과거 기록의 표시 정밀도'), 'P1627 old whole-million history must disclose approximation');
assert.ok(nodes.some((node) => node.tagName === 'a' && node.href.includes('/1040470/')), 'P1627 annual absence/reading must have a safe exact filing link');
assert.ok(nodes.some((node) => node.tagName === 'a' && node.href.includes('CIK=1040470')), 'P1627 missing quarters must link to actual SEC filing list');
assert.ok(!host.textContent.includes('약 1주'), 'P1627 incomplete collection must not promise an unsupported completion time');
const lossBars = nodes.filter((node) => node.className.includes('fiscal-bar ') && node.className.includes('is-loss'));
assert.equal(lossBars.length, 2, 'P1627 both annual losses must be drawn');
assert.ok(lossBars.every((bar) => parseFloat(bar.style.top) > 0 && parseFloat(bar.style.height) > 0), 'P1627 actual rendered loss bars must extend below the zero line');
const css = readFileSync(new URL('../src/ui/styles/fiscal-quality.css', import.meta.url), 'utf8');
assert.ok(css.includes('.fiscal-peers .stock-read-bar-row { display: grid; grid-template-columns: minmax(0, 1fr);'), 'P1627 compact peer rows must stack rather than collide');
assert.ok(css.includes('var(--accent)') && css.includes('var(--text-primary)'), 'P1627 financial surfaces must use semantic dark/light colors');

// P1627: complete a shared history read after the user already changed issuers.
let resolveHistory;
const response = (value) => ({ ok: true, headers: { get: () => null }, text: async () => JSON.stringify(value) });
const waiting = new Promise((resolve) => { resolveHistory = resolve; });
const raceRoot = { _aioGetCanonicalScreenerRows: () => [], fetch: (url) => String(url).includes('manifest')
  ? Promise.resolve(response({ fiscalHistory: { path: 'public-data/sec-fiscal-history.json' } })) : waiting };
renderFiscalRead({ documentRef: doc, root: raceRoot, state: { id: 'AEHR', fundamentals: fixture } });
renderFiscalRead({ documentRef: doc, root: raceRoot, state: { id: 'NVDA', fundamentals: { ...fixture, symbol: 'NVDA', revenue: 100e6, netIncome: 20e6 } } });
resolveHistory(response({ data: { AEHR: compact, NVDA: compact }, quarters: {} }));
for (let tick = 0; tick < 12; tick += 1) await new Promise((resolve) => setImmediate(resolve));
assert.ok(host.textContent.includes('NVDA —'), 'P1627 the completed pending history read must render the last selected issuer');
assert.ok(!host.textContent.includes('AEHR —'), 'P1627 the earlier pending issuer must not repaint the current screen');

// ── v58.55: total assets + R&D collection → fiscal history columns → DuPont / R&D / Sloan / reverse DCF ─────────────
{
  const { normalizeSecCompanyFacts } = await import('./fetch-sec-fundamentals.mjs');
  const { selectSecBatch } = await import('./fetch-sec-fundamentals.mjs');
  const { buildDupontRead, buildRdRead, buildAccrualRead, impliedGrowth, dcfValue, reverseDcfInputs, assetChainState } = await import('../src/domain/fundamental/analysis-read.js');
  const fy = (year, val, extra = {}) => ({ start: `${year}-01-01`, end: `${year}-12-31`, val, form: '10-K', fp: 'FY', fy: year + 1, filed: `${year + 1}-02-20`, accn: `0000000000-${String(year).slice(2)}-000001`, ...extra });
  const inst = (year, val) => ({ end: `${year}-12-31`, val, form: '10-K', fp: 'FY', fy: year + 1, filed: `${year + 1}-02-20`, accn: `0000000000-${String(year).slice(2)}-000001` });
  const units = (rows) => ({ units: { USD: rows } });
  const companyFacts = { cik: 1, facts: { 'us-gaap': {
    Revenues: units([fy(2023, 100e9), fy(2024, 120e9), fy(2025, 150e9)]),
    NetIncomeLoss: units([fy(2023, 10e9), fy(2024, 15e9), fy(2025, 24e9)]),
    StockholdersEquity: units([inst(2022, 45e9), inst(2023, 50e9), inst(2024, 55e9), inst(2025, 65e9)]),
    Assets: units([inst(2022, 95e9), inst(2023, 100e9), inst(2024, 110e9), inst(2025, 130e9)]),
    ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost: units([fy(2023, 8e9), fy(2024, 9e9), fy(2025, 12e9)]),
    NetCashProvidedByUsedInOperatingActivities: units([fy(2023, 12e9), fy(2024, 14e9), fy(2025, 20e9)]),
    PaymentsToAcquirePropertyPlantAndEquipment: units([fy(2023, 2e9), fy(2024, 2e9), fy(2025, 3e9)])
  } } };
  const record = normalizeSecCompanyFacts('ACME', companyFacts, 50, null);
  const obs = record.pit.observations;
  assert.equal(obs.totalAssets.length, 4, 'v58.55 every annual year-end total assets fact must be kept for averages');
  assert.ok(obs.researchAndDevelopment.every((row) => row.concept === 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost') && obs.researchAndDevelopment.length === 3, 'v58.55 the R&D alternate concept must be collected when the plain one is absent');
  const bare = normalizeSecCompanyFacts('BARE', { cik: 2, facts: { 'us-gaap': { Revenues: companyFacts.facts['us-gaap'].Revenues, NetIncomeLoss: companyFacts.facts['us-gaap'].NetIncomeLoss, StockholdersEquity: companyFacts.facts['us-gaap'].StockholdersEquity } } }, 50, null);
  assert.ok(Array.isArray(bare.pit.observations.totalAssets) && bare.pit.observations.researchAndDevelopment.length === 0, 'v58.55 a filer without the items gets empty arrays (not reported), not missing ones (not yet collected)');
  const line = sandbox.fiscal(obs);
  const legacy = sandbox.fiscal({ ...obs, totalAssets: undefined, researchAndDevelopment: undefined });
  assert.ok(line.split(';').every((row) => row.split(':').length === 10), 'v58.55 a record read with assets/R&D ships the two extra columns');
  assert.ok(legacy.split(';').every((row) => row.split(':').length === 8), 'v58.55 a record written before keeps the 8-column row (= not yet collected)');
  const parsed = parseFiscalHistory(line);
  assert.equal(parsed.at(-1).totalAssets, 130e9, 'v58.55 total assets parse from USD millions');
  assert.equal(parsed.at(-1).researchAndDevelopment, 12e9, 'v58.55 R&D parses from USD millions');
  assert.equal(assetChainState(parseFiscalHistory(legacy)), 'pending', 'v58.55 an 8-column history reads as pending collection');
  assert.equal(assetChainState(parsed), 'collected', 'v58.55 a 10-column history reads as collected');
  assert.equal(parseFiscalHistory(sandbox.fiscal(bare.pit.observations)).at(-1).researchAndDevelopment, null, 'v58.55 an empty R&D cell is missing, never zero');

  const dupont = buildDupontRead(parsed);
  assert.equal(dupont.state, 'ready');
  assert.equal(dupont.basis, 'average', 'v58.55 both years have prior year-ends, so DuPont uses average assets and equity');
  const [prev, now] = dupont.columns;
  assert.ok(Math.abs(now.roe - 24e9 / ((65e9 + 55e9) / 2)) < 1e-12, 'v58.55 margin x turnover x leverage equals NI / average equity');
  assert.ok(Math.abs(prev.turnover - 120e9 / 105e9) < 1e-12, 'v58.55 the prior year uses its own average assets');
  const logs = ['margin', 'turnover', 'leverage'].map((id) => Math.abs(Math.log(now[id] / prev[id])));
  assert.equal(dupont.driver, ['margin', 'turnover', 'leverage'][logs.indexOf(Math.max(...logs))], 'v58.55 the named driver is the factor with the largest log change');
  assert.equal(buildDupontRead(parseFiscalHistory(legacy)).state, 'pending', 'v58.55 DuPont waits for collection instead of computing without assets');
  assert.equal(buildDupontRead(parsed.map((year) => ({ ...year, equity: -1e9 }))).state, 'negative-equity', 'v58.55 negative equity is not decomposed');

  const rd = buildRdRead(parsed);
  assert.ok(rd.state === 'ready' && Math.abs(rd.latest.ratio - 0.08) < 1e-12 && rd.years.length === 3, 'v58.55 R&D / revenue per filed year');
  assert.equal(buildRdRead(parseFiscalHistory(sandbox.fiscal(bare.pit.observations))).state, 'unreported', 'v58.55 a filer without R&D reads as not reported');

  const accrual = buildAccrualRead(parsed);
  assert.ok(Math.abs(accrual.latest.ratio - (24e9 - 20e9) / ((130e9 + 110e9) / 2)) < 1e-12 && accrual.latest.basis === 'average', 'v58.55 Sloan accrual = (NI - OCF) / average total assets');

  const solved = impliedGrowth({ fcf: 17e9, marketValue: 600e9, discountRate: 0.09, terminalGrowth: 0.025 });
  assert.equal(solved.state, 'ready');
  assert.ok(Math.abs(dcfValue(17e9, solved.growth, 0.09, 0.025) - 600e9) / 600e9 < 1e-9, 'v58.55 the implied growth reproduces the market value');
  assert.ok(impliedGrowth({ fcf: 17e9, marketValue: 600e9, discountRate: 0.095, terminalGrowth: 0.025 }).growth > solved.growth, 'v58.55 a higher discount rate needs more growth');
  assert.equal(impliedGrowth({ fcf: 1e6, marketValue: 600e12, discountRate: 0.09, terminalGrowth: 0.025 }).state, 'above-range', 'v58.55 an unreachable growth is a range state, not a number');
  const close = { value: 50, date: '2026-10-19' };
  const facts = { sharesOutstanding: 12e9, sharesObservedAt: '2026-02-10' };
  assert.equal(reverseDcfInputs({ history: parsed, fundamentals: facts, close }).fcf, 17e9, 'v58.55 FCF = latest OCF - capex');
  assert.equal(reverseDcfInputs({ history: parsed.map((year) => ({ ...year, capex: 30e9 })), fundamentals: facts, close }).state, 'fcf-negative', 'v58.55 FCF <= 0 is not solved');
  assert.equal(reverseDcfInputs({ history: parsed, fundamentals: {}, close }).state, 'missing', 'v58.55 no verified share count, no market value');
  assert.equal(reverseDcfInputs({ history: parsed, fundamentals: facts, close: { value: 50 } }).state, 'missing', 'v58.55 an undated price is not used');
  assert.equal(reverseDcfInputs({ history: parsed, fundamentals: facts, close, financial: true }).state, 'financial', 'v58.55 lending financials are not valued on FCF');
  // v58.55 review: an old fiscal year or a far share count is 'stale', never solved against today's close (B: FY2010).
  const at = Date.parse('2026-10-21T00:00:00Z');
  const fy2010 = parsed.map((year, i) => ({ ...year, periodEnd: `${2008 + i}-12-31` }));
  assert.equal(reverseDcfInputs({ history: fy2010, fundamentals: { sharesOutstanding: 1e9, sharesObservedAt: '2011-02-10' }, close, nowMs: at }).state, 'stale', 'v58.55 a fiscal year past the 456-day rule is not valued');
  assert.equal(reverseDcfInputs({ history: parsed, fundamentals: { ...facts, quality: { stale: true } }, close, nowMs: at }).state, 'stale', 'v58.55 a record the SEC read flags stale is not valued');
  assert.equal(reverseDcfInputs({ history: parsed, fundamentals: { ...facts, sharesObservedAt: '2023-01-05' }, close, nowMs: at }).state, 'stale', 'v58.55 a share count far from the fiscal year end is not priced');
  assert.equal(reverseDcfInputs({ history: parsed, fundamentals: facts, close, nowMs: at }).state, 'ready');
  assert.equal(buildDupontRead(fy2010, { nowMs: at }).state, 'stale', 'v58.55 DuPont holds an old fiscal year');
  const priorNegative = parsed.map((year) => (year.periodEnd.startsWith('2024') ? { ...year, equity: -5e9 } : year));
  const alone = buildDupontRead(priorNegative, { nowMs: at });
  assert.ok(alone.state === 'ready' && alone.columns.length === 1 && alone.columns[0].basis === 'year-end', 'v58.55 a prior year with negative equity is dropped and the latest year stands alone');
  assert.ok(buildDupontRead(parsed, { nowMs: at }).columns.every((c) => c.basis === 'average'), 'v58.55 each column names its own basis');

  // Scheduler: the extra backfill slots take only records due for the new observation arrays.
  const nowMs = Date.parse('2026-10-20T00:00:00Z');
  const recent = '2026-10-10T00:00:00Z';
  const due = [
    ...Array.from({ length: 30 }, (_, i) => ({ symbol: `B${i}`, fetchedAt: recent, assetChainMissing: true, normalizerOutdated: true })),
    { symbol: 'FAIL', fetchedAt: recent, assetChainMissing: true, priorFailure: { status: 'TRANSIENT_PROVIDER_FAILURE' } },
    { symbol: 'NEW', fetchedAt: null }
  ];
  const batch = selectSecBatch(due, 24, 48, nowMs);
  assert.equal(batch.length, 30, 'v58.55 24 regular + 6 remaining backfill-only records; failures and new issuers never ride the extra slots');
  assert.ok(!batch.some((row) => row.symbol === 'FAIL' || row.symbol === 'NEW'), 'v58.55 the extra slots exclude failures and never-fetched issuers');
  assert.equal(selectSecBatch(due, 24, 0, nowMs).length, 24, 'v58.55 without extra slots the batch stays at its limit');

  // Rendering: pending (8 columns) and collected (10 columns) through the real renderers.
  const { dupontCard, rdCard } = await import('../src/ui/components/fundamental-analysis-cards.js');
  const pendingDupont = dupontCard(doc, parseFiscalHistory(legacy));
  assert.equal(pendingDupont.dataset.state, 'pending', 'v58.55 an uncollected issuer renders the pending state');
  assert.ok(!descendants(pendingDupont).some((node) => node.className.includes('v2-dupont-eq')), 'v58.55 a pending card draws no factor values');
  assert.equal(dupontCard(doc, parsed).dataset.state, 'ready');
  assert.equal(rdCard(doc, parseFiscalHistory(sandbox.fiscal(bare.pit.observations))).dataset.state, 'unreported', 'v58.55 no R&D line renders as not reported');
  const fiscalHost = new Element('section');
  const fiscalDoc = { ...doc, getElementById: (id) => id === 'fund-flow' ? fiscalHost : id === 'fund-next' ? next : null };
  renderFiscalRead({ documentRef: fiscalDoc, root: { _aioSecFiscalHistory: { ACME: line }, _aioSecQuarterHistory: {}, _aioSecFiscalHistoryAt: Date.now(), _aioGetCanonicalScreenerRows: () => [{ sym: 'ACME', sector: 'Technology' }] }, state: { id: 'ACME', fundamentals: null } });
  assert.ok(descendants(fiscalHost).some((node) => node.dataset?.analysis === 'rd' && node.dataset.state === 'ready'), 'v58.55 재무 공시 renders the R&D card from the collected series');
}

console.log('[fiscal-quality] PASS P1627: signed zero line, precise same-period annual receipt, strict ROE/gap, amount table, source links, missing quarters, compact peers, pending-issuer race; v58.55 assets/R&D columns, DuPont, R&D, Sloan, reverse DCF, backfill batch, pending state. Offline; producer not executed.');
