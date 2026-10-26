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
assert.equal(formatFiscalAmount(-7126000), '-712.6만 달러', 'P1627 displayed losses must retain sign and precision');
assert.equal(formatFiscalAmount(null), '자료 없음', 'P1627 missing is not a zero');
assert.equal(formatFiscalAmount(0), '0달러', 'P1627 an observed zero must remain zero');
assert.equal(formatFiscalCompact(416161e6), '4,162억 달러', 'S20 v58.80 table amounts read in the same Korean units as the paragraph');
assert.equal(formatFiscalCompact(-147.8e9), '-1,478억 달러', 'S18/S20 the sign precedes the currency');
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
assert.ok(nodes.some((node) => node.tagName === 'table' && node.textContent.includes('-713만 달러')), 'S20 render must expose an annual amount table with signed compact income');
assert.ok(nodes.some((node) => node.tagName === 'td' && node.title === '-712.6만 달러'), 'P1627/S20 the exact signed income must remain available on the cell');
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
  assert.ok(sandbox.fiscal({ ...obs, grossProfit: undefined }).split(';').every((row) => row.split(':').length === 10), 'v58.55 a record read with assets/R&D ships the two extra columns');
  // v58.75: a record read by the v58.75 normalizer also carries the seven capital columns on its latest two years only.
  assert.deepEqual(line.split(';').map((row) => row.split(':').length), [10, 17, 17], 'v58.75 the capital columns ride the latest two fiscal years only (artifact size)');
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

// ── v58.75 (persona review): capital columns → margin ladder · net cash · capital return; the last four quarters; the next
// report date; reported EPS against consensus; same-theme peers by name. Offline (fixtures only, no provider call).
{
  const { normalizeSecCompanyFacts } = await import('./fetch-sec-fundamentals.mjs');
  const read = await import('../src/domain/fundamental/analysis-read.js');
  const cards = await import('../src/ui/components/fundamental-analysis-cards.js');
  const { buildConsensusRow } = await import('./fetch-consensus-estimates.mjs');
  const { upcomingEarningsMap, upcomingCalendarDays } = await import('./fetch-earnings-calendar.mjs');
  const fy = (year, val) => ({ start: `${year}-01-01`, end: `${year}-12-31`, val, form: '10-K', fp: 'FY', fy: year + 1, filed: `${year + 1}-02-20`, accn: `0000000000-${String(year).slice(2)}-000001` });
  const inst = (year, val) => ({ end: `${year}-12-31`, val, form: '10-K', fp: 'FY', fy: year + 1, filed: `${year + 1}-02-20`, accn: `0000000000-${String(year).slice(2)}-000001` });
  const units = (rows) => ({ units: { USD: rows } });
  const base = {
    Revenues: units([fy(2023, 100e9), fy(2024, 120e9), fy(2025, 150e9)]),
    NetIncomeLoss: units([fy(2023, 10e9), fy(2024, 15e9), fy(2025, 24e9)]),
    StockholdersEquity: units([inst(2022, 45e9), inst(2023, 50e9), inst(2024, 55e9), inst(2025, 65e9)]),
    Assets: units([inst(2023, 100e9), inst(2024, 110e9), inst(2025, 130e9)]),
    LongTermDebtNoncurrent: units([inst(2024, 30e9), inst(2025, 28e9)]),
    NetCashProvidedByUsedInOperatingActivities: units([fy(2023, 12e9), fy(2024, 14e9), fy(2025, 20e9)]),
    PaymentsToAcquirePropertyPlantAndEquipment: units([fy(2023, 2e9), fy(2024, 2e9), fy(2025, 3e9)])
  };
  const capital = {
    GrossProfit: units([fy(2023, 55e9), fy(2024, 70e9), fy(2025, 90e9)]),
    OperatingIncomeLoss: units([fy(2023, 14e9), fy(2024, 20e9), fy(2025, 33e9)]),
    CashAndCashEquivalentsAtCarryingValue: units([inst(2024, 12e9), inst(2025, 15e9)]),
    MarketableSecuritiesCurrent: units([inst(2024, 8e9), inst(2025, 20e9)]),
    ShareBasedCompensation: units([fy(2024, 4e9), fy(2025, 6e9)]),
    PaymentsForRepurchaseOfCommonStock: units([fy(2024, 5e9), fy(2025, 9e9)]),
    PaymentsOfDividends: units([fy(2024, 1e9), fy(2025, 2e9)])
  };
  const obs = normalizeSecCompanyFacts('CAPX', { cik: 3, facts: { 'us-gaap': { ...base, ...capital } } }, 50, null).pit.observations;
  assert.ok(obs.grossProfit.length === 3 && obs.cash.length === 2 && obs.cash.every((row) => !row.periodStart), 'v58.75 annual gross profit and year-end cash are collected');
  assert.equal(obs.shortTermInvestments[0].concept, 'MarketableSecuritiesCurrent', 'v58.75 short-term investments fall back to the current marketable securities concept');
  const bareObs = normalizeSecCompanyFacts('BARE', { cik: 4, facts: { 'us-gaap': base } }, 50, null).pit.observations;
  assert.ok(Array.isArray(bareObs.grossProfit) && bareObs.grossProfit.length === 0 && bareObs.dividends.length === 0, 'v58.75 a filer without the items gets empty arrays (not reported)');
  const parsed = parseFiscalHistory(sandbox.fiscal(obs));
  assert.ok(parsed.at(-1).capitalChain && parsed.at(-1).grossProfit === 90e9 && parsed.at(-1).shortTermInvestments === 20e9 && !parsed[0].capitalChain, 'v58.75 the capital columns parse on the latest years');
  const margin = read.buildMarginCashRead(parsed);
  assert.equal(margin.state, 'ready');
  assert.deepEqual(margin.ladder.map((step) => Math.round(step.value)), [60, 22, 16], 'v58.75 gross 90/150, operating 33/150, net 24/150');
  assert.equal(margin.cash.net, 15e9 + 20e9 - 28e9, 'v58.75 net cash = cash + short-term investments - long-term debt');
  assert.ok(Math.abs(margin.capital.returnedShareOfFcf - (9e9 + 2e9) / 17e9 * 100) < 1e-9 && Math.abs(margin.capital.sbcRatio - 4) < 1e-9, 'v58.75 buybacks + dividends over FCF, stock compensation over revenue');
  assert.equal(read.buildMarginCashRead(parseFiscalHistory(sandbox.fiscal({ ...obs, grossProfit: undefined }))).state, 'pending', 'v58.75 a record read before the capital items waits instead of computing');
  const bareMargin = read.buildMarginCashRead(parseFiscalHistory(sandbox.fiscal(bareObs)));
  assert.ok(bareMargin.state === 'ready' && bareMargin.ladder[0].value == null && bareMargin.cash == null && bareMargin.capital.returned == null, 'v58.75 an untagged line is missing, never zero');

  // The last four quarters, only when consecutive.
  const q = (end, revenue, netIncome, derived = false) => ({ periodEnd: end, revenue, netIncome, derived });
  const run = [q('2024-09-30', 20, 2), q('2024-12-31', 22, 2), q('2025-03-31', 24, 3), q('2025-06-30', 26, 3), q('2025-09-30', 30, 4), q('2025-12-31', 32, 4, true), q('2026-03-31', 34, 5), q('2026-06-30', 36, 5)];
  const ttm = read.buildTrailingYearRead(run);
  assert.ok(ttm.revenue === 132 && ttm.netIncome === 18 && Math.abs(ttm.revenueYoy - (132 / 92 - 1) * 100) < 1e-9 && ttm.hasDerived, 'v58.75 four quarters summed against the four before them');
  assert.equal(read.buildTrailingYearRead([...run.slice(0, 6), q('2026-09-30', 36, 5)].filter((row) => row.periodEnd !== '2026-03-31')), null, 'v58.75 a gap in the last four quarters omits the line');
  assert.ok(cards.trailingYearLine(ttm).startsWith('최근 4개 분기(2026-06 분기까지)'), 'v58.75 the line names the last quarter it covers');

  // The next report: a dated calendar row, else the last report and "not scheduled" — never a projected date.
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const consensus = { asOf: new Date().toISOString(), trailing: { lastReportedAt: '8/26/2026' }, hist: '2026-07:2.22:2.09;2026-04:1.87:1.7;2026-01:1.4:1.45' };
  const scheduled = read.buildEarningsSchedule({ symbol: 'CAPX', calendar: { status: 'current-reference', upcoming: { CAPX: `${day(20)}|amc` }, earnings: [] }, consensus });
  assert.ok(scheduled.state === 'scheduled' && /거래일 후$/.test(scheduled.text) && scheduled.text.includes('장 마감 후'), 'v58.75 a dated row reads with its session count');
  const unconfirmed = read.buildEarningsSchedule({ symbol: 'CAPX', calendar: { status: 'current-reference', upcoming: {}, earnings: [{ symbol: 'CAPX', date: day(-30) }], weekEnd: day(5) }, consensus });
  assert.equal(unconfirmed.text, '직전 발표 8/26, 다음 실적 일정 미확정', 'v58.75 without a dated row the last report is stated and no date is projected');
  assert.equal(read.buildEarningsSchedule({ symbol: '005930.KS', calendar: null, consensus: null }), null, 'v58.75 Korean listings are not read from the US calendar');
  const map = upcomingEarningsMap([{ symbol: 'CAPX', date: '2026-11-19', hour: 'amc' }, { symbol: 'CAPX', date: '2026-12-01' }, { symbol: 'BRK.B', date: '2026-11-02' }, { symbol: 'OTHER', date: '2026-11-02' }], new Set(['CAPX', 'BRK-B']), '2026-10-24');
  assert.deepEqual(map, { 'BRK-B': '2026-11-02|', CAPX: '2026-11-19|amc' }, 'v58.75 the upcoming map keeps the earliest universe date per listing');
  const days = upcomingCalendarDays('2026-11-02', '2026-10-26');
  assert.ok(days[0] === '2026-11-03' && days.at(-1) === '2026-12-04' && days.every((d) => ![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())), 'v58.75 six weeks of weekdays after the week window');

  // Reported EPS against consensus: kept by the producer from the response it already reads.
  const forecast = { quarterlyForecast: { rows: ['Oct 2026', 'Jan 2027', 'Apr 2027', 'Jul 2027'].map((fiscalEnd) => ({ fiscalEnd, consensusEPSForecast: 2, highEPSForecast: 2.2, lowEPSForecast: 1.8, noOfEstimates: 9 })) } };
  const surpriseRows = [['Jul 2026', 2.22, '2.09'], ['Apr 2026', 1.87, '1.7'], ['Jan 2026', 1.57, '1.45'], ['Oct 2025', 1.24, '1.18']].map(([fiscalQtrEnd, eps, consensusForecast]) => ({ fiscalQtrEnd, eps, consensusForecast, dateReported: '8/26/2026' }));
  assert.equal(buildConsensusRow(forecast, { earningsSurpriseTable: { rows: surpriseRows } }, 'now').hist, '2026-07:2.22:2.09;2026-04:1.87:1.7;2026-01:1.57:1.45;2025-10:1.24:1.18', 'v58.75 the producer keeps each quarter\'s consensus beside the reported EPS');
  const surprise = read.buildSurpriseRead(consensus);
  assert.ok(surprise.rows[0].quarter === '2026-01' && surprise.beats === 2 && surprise.misses === 1, 'v58.75 oldest first; beats and misses counted');

  // Same-theme peers by name.
  const series = (growth) => [{ periodEnd: '2024-12-31', revenue: 100, netIncome: 10, equity: 50 }, { periodEnd: '2025-12-31', revenue: 100 + growth, netIncome: 12, equity: 60 }];
  const histories = { CAPX: series(20), PA: series(10), PB: series(5), PC: series(30), PD: series(1) };
  const themes = [{ id: 'semi', nameKr: '반도체', leaders: ['CAPX', 'PD'], subThemes: [{ name: '큰 묶음', tickers: ['CAPX', 'PA', 'PB', 'PC', 'PD', 'PX'] }, { name: '작은 묶음', tickers: ['CAPX', 'PC', 'PA'] }] }];
  const peers = read.buildThemePeers({ symbol: 'CAPX', themes, rows: [{ sym: 'PA', name: 'Peer A', pe: 30 }], seriesFor: (sym) => histories[sym] || null });
  assert.deepEqual(peers.rows.map((row) => row.sym), ['CAPX', 'PC', 'PA', 'PB', 'PD'], 'v58.75 the smallest shared sub-theme comes first, issuers without a series drop out');
  assert.equal(read.buildThemePeers({ symbol: 'CAPX', themes, seriesFor: (sym) => (sym === 'CAPX' || sym === 'PA' ? histories[sym] : null) }), null, 'v58.75 fewer than three named peers shows no table');

  // Through the real renderer.
  const v75Host = new Element('section');
  const v75Doc = { ...doc, getElementById: (id) => id === 'fund-flow' ? v75Host : id === 'fund-next' ? next : null };
  const quarterText = run.map((row) => [row.periodEnd, row.revenue, row.netIncome, row.derived ? 'd' : 'r'].join(':')).join(';');
  const v75Root = { _aioSecFiscalHistory: { CAPX: sandbox.fiscal(obs), PA: sandbox.fiscal(obs), PB: sandbox.fiscal(obs), PC: sandbox.fiscal(obs) }, _aioSecQuarterHistory: { CAPX: quarterText }, _aioSecFiscalHistoryAt: Date.now(),
    _aioGetCanonicalScreenerRows: () => [{ sym: 'CAPX', sector: 'Technology' }], THEME_MAP: themes,
    _aioConsensusEstimates: { rows: { CAPX: consensus } }, _aioEarningsCalendarArtifact: { status: 'current-reference', upcoming: { CAPX: `${day(20)}|bmo` }, earnings: [] } };
  renderFiscalRead({ documentRef: v75Doc, root: v75Root, state: { id: 'CAPX', fundamentals: null } });
  for (let tick = 0; tick < 12; tick += 1) await new Promise((resolve) => setImmediate(resolve));
  renderFiscalRead({ documentRef: v75Doc, root: v75Root, state: { id: 'CAPX', fundamentals: null } });
  const v75 = descendants(v75Host);
  for (const id of ['margin-cash', 'surprise', 'theme-peers', 'lens', 'thesis']) assert.ok(v75.some((node) => node.dataset?.analysis === id), `v58.75 재무 공시 renders the ${id} card`);
  assert.ok(v75Host.textContent.includes('최근 4개 분기(2026-06 분기까지)') && v75Host.textContent.includes('장 시작 전'), 'v58.75 the hero carries the last four quarters and the next report date');
}

// ── v58.75 (persona review): the stock lens layer — lens registry, peer facts, situations, thesis template, watch list,
// market link. Pure builders; no price instruction, probability, grade or invented number.
{
  const lens = await import('../src/domain/fundamental/stock-lens.js');
  assert.equal(lens.lensIdFor({ sic: 3674 }).id, 'semis', 'v58.75 SEC SIC 3674 selects the semiconductor lens');
  assert.equal(lens.lensIdFor({ themeIds: ['software'] }).id, 'software', 'v58.75 the AIO theme is the second lens basis');
  assert.equal(lens.lensIdFor({ sector: 'Energy' }).id, 'energy', 'v58.75 the sector is the third lens basis');
  assert.equal(lens.lensIdFor({}).id, 'general', 'v58.75 no classification falls back to the general lens');
  for (const [id, def] of Object.entries(lens.STOCK_LENSES)) {
    assert.ok(def.metrics.length >= 4 && def.metrics.length <= 6, `v58.75 lens ${id} tracks 4-6 metrics`);
    assert.ok(def.why && def.metrics.every((metric) => metric.why), `v58.75 lens ${id} explains every metric`);
  }
  const empty = lens.buildLensRead({ lens: { id: 'semis', basis: 'SEC 산업분류 SIC 3674' } });
  assert.equal(empty.known, 0, 'v58.75 an empty context fills no lens value');
  assert.ok(empty.rows.every((row) => row.value == null && row.check), 'v58.75 missing lens values say where to check instead of inventing a number');
  const filled = lens.buildLensRead({ lens: { id: 'semis', basis: 'x' }, history: [{ periodEnd: '2024-12-31', revenue: 100 }, { periodEnd: '2025-12-31', revenue: 130 }], trailing: { revenueYoy: 40 } });
  assert.ok(filled.rows.find((row) => row.id === 'revenueGrowth').value.includes('+40.0%'), 'v58.75 the lens reads the real trailing growth');

  const peerRows = [{ sym: 'SELF', self: true, growth: 40, margin: 30, roe: 35, fcfMargin: 25, fwdPe: 18, ret3m: -8 },
    ...[10, 15, 20, 25, 30].map((g, i) => ({ sym: `P${i}`, growth: g, margin: 10 + i, roe: 10 + i, fcfMargin: 8 + i, fwdPe: 25 + i, ret3m: 5 + i }))];
  const sw = lens.buildPeerStrengths(peerRows);
  assert.ok(sw.strengths.length === 3 && sw.strengths.every((fact) => fact.rank === 1), 'v58.75 three strengths are first-ranked facts');
  assert.ok(sw.weaknesses.some((fact) => fact.id === 'ret3m'), 'v58.75 the weakest relative fact becomes a weakness');
  assert.ok(sw.facts.find((fact) => fact.id === 'fwdPe').text.includes('가벼운 편'), 'v58.75 a lower forward PER is the lighter price burden');
  assert.equal(lens.buildPeerStrengths(peerRows.slice(0, 3)), null, 'v58.75 fewer than four values gives no peer fact');
  // v58.80 (first-users bundle 1): one peer group has one median, the peers' own (growth 10..30 → 20, not 22.5 with SELF).
  assert.equal(sw.facts.find((fact) => fact.id === 'growth').median, 20, 'v58.80 the peer median excludes the company itself');

  const scenario = { status: 'current', crossroads: { leadId: 'aibust', items: [{ id: 'aibust', fit: '조건 충족 3/4' }] } };
  const situation = lens.buildSituationRead({ themes: [{ id: 'semiconductor', label: '반도체' }], scenario });
  assert.ok(situation.favour.length && situation.burden.length && situation.now.includes('부담'), 'v58.75 AI capex exposure is burdened by the AI-bust branch');
  assert.equal(lens.buildSituationRead({ themes: [{ id: 'no-such-theme', label: 'x' }] }), null, 'v58.75 a theme without exposure tags shows no situation read');
  const stale = lens.buildSituationRead({ themes: [{ id: 'semiconductor', label: '반도체' }], scenario: { ...scenario, status: 'stale' } });
  assert.equal(stale.now, null, 'v58.75 a stale scenario artifact does not name a lead branch');

  const bench = [], bars = [];
  for (let i = 0; i < 200; i += 1) {
    const date = new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    const b = 100 * (1 + 0.01 * Math.sin(i));
    bench.push({ date, value: b });
    bars.push({ date, close: 50 * (1 + 0.02 * Math.sin(i)) });
  }
  assert.ok(Math.abs(lens.dailyBeta(bars, bench).value - 2) < 0.2, 'v58.75 daily beta of a doubled move is about 2');
  assert.equal(lens.dailyBeta(bars.slice(0, 60), bench), null, 'v58.75 fewer than 120 shared sessions gives no beta');

  const frame = lens.buildThesisFrame({ implied: { state: 'ready', growth: 0.12 }, trailing: { revenueYoy: 20, margin: 25 }, consensus: { fwd: { up4w: 3, down4w: 1 } },
    schedule: { text: '11/19(장 마감 후)' }, levels: { supportCandidates: [{ price: 90, pct: -5 }], resistanceCandidates: [{ price: 110, pct: 6 }] }, peerPe: { value: 20, median: 25 }, situation });
  assert.ok(frame.priced.includes('12.0%') && frame.priced.includes('+20.0%'), 'v58.75 the thesis compares the reverse-DCF growth with trailing growth');
  assert.ok(frame.conditions.length === 3 && frame.checks.length === 3 && frame.breaks.length >= 4 && frame.paths.length === 2, 'v58.75 the thesis has conditions, checks, break signals and two paths');
  const frameText = JSON.stringify(frame);
  assert.ok(!/매수가|손절|목표가|비중|확률|%\s*가능성/.test(frameText), 'v58.75 the thesis frame carries no price instruction or probability');
  assert.ok(frameText.includes('보장이 아님'), 'v58.75 price levels are framed as observation, not a guarantee');
  const bare = lens.buildThesisFrame({});
  assert.ok(bare.priced == null && bare.conditions.length === 0 && bare.checks.length === 1, 'v58.75 without data the thesis invents nothing and points to the chart level map');

  const watch = lens.buildWatchList({ schedule: { text: '11/19' }, consensus: { fwd: { up4w: 2, down4w: 0 } }, trailing: { margin: 30, priorMargin: 25 }, row: { ret3m: 7.5 }, benchmarkRet3m: 2.8,
    levels: { supportCandidates: [{ price: 90 }] }, stage: { label: '반도체', stateLabel: '동행' } });
  assert.deepEqual(watch.map((item) => item.id), ['earnings', 'revisions', 'margin', 'relative', 'levels', 'theme'], 'v58.75 the watch list keeps six named checks');
  assert.deepEqual(lens.buildWatchList({}), [], 'v58.75 an empty watch list stays empty');

  const link = lens.buildMarketLink({ regime: { available: true, overall: '다소 부담' }, scenario, themeLabel: '반도체', tags: ['aicapex', 'cyclical', 'growth'], stage: { stateLabel: '동행' } });
  assert.ok(link.text.includes("'다소 부담'") && link.text.includes('AI') && link.text.includes('부담 쪽'), 'v58.75 the market line joins the regime, lead branch and theme wind');
  assert.equal(lens.buildMarketLink({}), null, 'v58.75 no regime or scenario gives no market line');
}

console.log('[fiscal-quality] PASS P1627: signed zero line, precise same-period annual receipt, strict ROE/gap, amount table, source links, missing quarters, compact peers, pending-issuer race; v58.55 assets/R&D columns, DuPont, R&D, Sloan, reverse DCF, backfill batch, pending state; v58.75 capital columns, margin ladder, net cash, last four quarters, next report date, EPS surprise, theme peers, stock lens/peer facts/situations/thesis frame/watch list/market line. Offline; producer not executed.');
