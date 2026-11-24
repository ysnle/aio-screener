// v60.50 (owner-approved screener rank redesign, audit 2026-11-23 D5): MU read percentile 100 and led the 종목 landing's
// 백분위 상위 list the day it closed 23% under its 200-day line after a 23.6% five-session fall, on a P/E of 7.9 at a
// 63.8% net margin (its prior five fiscal years: median 21.2%). Checked on the real rows (frozen from the 2026-11-23
// artifacts so a data refresh cannot move them) with AAPL and KO as controls that must not change:
//   (a) top-pick-gate.js — a row under its 200-day line or in a five-session break stays ranked and listed, shows its
//       contrary-check count beside the percentile, and is not offered on the 백분위 상위 list;
//   (b) peak-earnings.js — a P/E on a margin at least twice the company's prior fiscal-year median (positive, 3+ years,
//       5+ points above it) is one more model contrary check (technical/bands.js modelContraryEvidence). It is a
//       disclosure: the ranking model stays factor-ranks.v10 and scores the P/E; leaving it out of the score waits for a
//       research-backtest run. The screener producer publishes the norm per row (marginPriorFyMedian / marginPriorFyYears).
// Offline, no browser, no producer run. Fails on the v60.49 code (the modules, the check and the fields do not exist there).
import { readFileSync } from 'node:fs';
import { createFakeDocument } from './lib/fake-dom.mjs';

const checks = [];
const failures = [];
const check = async (name, fn) => { try { await fn(); checks.push(name); } catch (error) { failures.push(`${name}: ${String(error?.message || error).split('\n')[0]}`); } };
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const load = async (path) => import(new URL(`../${path}`, import.meta.url));

// Frozen from public-data/screener.json (asOf 2026-11-23T08:25Z, US session 2026-11-20) and sec-fiscal-history.json
// (periodEnd:revenue:netIncome, USD millions).
const FROZEN = Object.freeze({
  MU: { sym: 'MU', name: 'Micron Technology', sector: 'Technology', rank: 100, ret5d: -23.62, adrPct: 6.8, pctSma20: -24.42, pctSma50: -34.83, pctSma200: -23.05, rsi: 29.5,
    pe: 7.92, pb: 4.86, margin: 63.8, roe: 88.3, _marginThrough: '2026-09-03',
    history: '2021-09-02:27705:5861;2022-09-01:30758:8687;2023-08-31:15540:-5833;2024-08-29:25111:778;2025-08-28:37378:8539;2026-09-03:133188:84969' },
  AAPL: { sym: 'AAPL', name: 'Apple', sector: 'Technology', rank: 98, ret5d: -3.85, adrPct: 2.25, pctSma20: -1.42, pctSma50: 0.22, pctSma200: 12.97, rsi: 46.6,
    pe: 37.66, pb: 44.41, margin: 27.6, roe: 142.3, _marginThrough: '2026-09-26',
    history: '2021-09-25:365817:94680;2022-09-24:394328:99803;2023-09-30:383285:96995;2024-09-28:391035:93736;2025-09-27:416161:112010;2026-09-26:478834:132175' },
  KO: { sym: 'KO', name: 'Coca-Cola', sector: 'Consumer Defensive', rank: 98, ret5d: -2.28, adrPct: 1.68, pctSma20: 1.19, pctSma50: 5.65, pctSma200: 15.62, rsi: 58,
    pe: 28.52, pb: 11.16, margin: 28.7, roe: 46, _marginThrough: '2026-10-02',
    history: '2020-12-31:33014:7747;2021-12-31:38655:9771;2022-12-31:43004:9542;2023-12-31:45754:10714;2024-12-31:47061:10631;2025-12-31:47941:13107' }
});
const parseHistory = (text) => text.split(';').map((part) => part.split(':')).map(([periodEnd, revenue, netIncome]) => ({ periodEnd, revenue: Number(revenue), netIncome: Number(netIncome) }));
const frozenRow = (sym) => { const { history, ...row } = FROZEN[sym]; return { ...row, screenStatus: 'passed', market: 'US' }; };
const norms = {};
const normedRow = (sym) => ({ ...frozenRow(sym), _marginPriorFyMedian: norms[sym].median, _marginPriorFyYears: norms[sym].years });

let gateModule = null;
let peakModule = null;
await check('v60.50 the domain owns the top-pick gate and the peak-earnings fact', async () => {
  gateModule = await load('src/domain/screener/top-pick-gate.js');
  peakModule = await load('src/domain/screener/peak-earnings.js');
  expect(typeof gateModule.topPickGate === 'function' && typeof gateModule.topRankedPicks === 'function', 'top-pick-gate.js exports topPickGate and topRankedPicks');
  expect(typeof peakModule.peakEarningsPe === 'function' && typeof peakModule.priorFiscalMarginNorm === 'function', 'peak-earnings.js exports peakEarningsPe and priorFiscalMarginNorm');
});

// ── (b) the peak-earnings fact ───────────────────────────────────────────────────────────────────────────────────
await check('v60.50 the prior fiscal-year margin norm: MU 21.2% over 5 years, AAPL 25.3%, KO 23.4%', () => {
  for (const sym of Object.keys(FROZEN)) norms[sym] = peakModule.priorFiscalMarginNorm(parseHistory(FROZEN[sym].history), FROZEN[sym]._marginThrough);
  expect(norms.MU?.median === 21.2 && norms.MU.years === 5, `MU norm ${JSON.stringify(norms.MU)}`);
  expect(norms.AAPL?.median === 25.3 && norms.AAPL.years === 5, `AAPL norm ${JSON.stringify(norms.AAPL)}`);
  expect(norms.KO?.median === 23.4 && norms.KO.years === 5, `KO norm ${JSON.stringify(norms.KO)} (FY2025 overlaps the TTM through 2026-10-02 and is left out)`);
});

await check('v60.50 MU\'s P/E sits on a peak margin (3.0x its own median, stated with the numbers); AAPL and KO do not', () => {
  const note = peakModule.peakEarningsNote(normedRow('MU'));
  expect(peakModule.peakEarningsPe(normedRow('MU')).peak === true, 'MU peak');
  expect(note === 'PER 7.9배의 순이익률 63.8%가 이전 5개 회계연도 중앙값 21.2%의 3.0배 — 낮은 PER이 이익 정점일 수 있음', `MU note: ${note}`);
  expect(!/뺐|제외|빼고/.test(note), 'the note discloses; it does not say the P/E was left out');
  for (const sym of ['AAPL', 'KO']) expect(!peakModule.peakEarningsPe(normedRow(sym)).peak && peakModule.peakEarningsNote(normedRow(sym)) === '', `${sym} control is not a peak`);
  expect(!peakModule.peakEarningsPe({ ...normedRow('MU'), _marginPriorFyYears: 2 }).peak, 'fewer than 3 prior years never flags');
  expect(!peakModule.peakEarningsPe({ ...normedRow('MU'), _marginPriorFyMedian: -5 }).peak, 'a loss-making norm never flags');
  expect(!peakModule.peakEarningsPe({ pe: 20, margin: 2.5, _marginPriorFyMedian: 1, _marginPriorFyYears: 5 }).peak, 'a 1.5-point rise on a thin margin is under the 5-point floor');
  const unpublished = peakModule.peakEarningsPe(frozenRow('MU'));
  expect(!unpublished.peak && unpublished.checked === false, 'a row with a P/E but no published norm is not checked (never reads as clear)');
});

await check('v60.50 one contrary list: modelContraryEvidence carries the peak line for MU (6 hits) and names it unchecked without the norm', async () => {
  const { modelContraryEvidence } = await load('src/domain/technical/bands.js');
  const withNorm = modelContraryEvidence(normedRow('MU'));
  expect(withNorm.hits.length === 6 && withNorm.hits.includes(peakModule.peakEarningsNote(normedRow('MU'))), `MU hits: ${withNorm.hits.join(' | ')}`);
  const without = modelContraryEvidence(frozenRow('MU'));
  expect(without.hits.length === 5 && without.unchecked.includes('이익 정점 PER'), `MU without the norm: ${JSON.stringify(without)}`);
  for (const sym of ['AAPL', 'KO']) expect(!modelContraryEvidence(normedRow(sym)).hits.some((hit) => /이익 정점/.test(hit)), `${sym} has no peak line`);
});

// ── (a) trend gate ───────────────────────────────────────────────────────────────────────────────────────────────
await check('v60.50 MU (under the 200-day line, five-session break) is held from top picks with 6 contrary checks; AAPL and KO are not', () => {
  const mu = gateModule.topPickGate(normedRow('MU'));
  expect(mu.held && mu.reasons.join() === 'below-200,five-session-break', `MU gate: ${JSON.stringify(mu)}`);
  expect(mu.contraryCount === 6, `MU trips 20/50/200-day lines, the five-session break, RSI 29.5 and the peak P/E: ${mu.contraryCount}`);
  for (const sym of ['AAPL', 'KO']) {
    const gate = gateModule.topPickGate(normedRow(sym));
    expect(!gate.held && gate.reasons.length === 0, `${sym} control is offered: ${JSON.stringify(gate)}`);
  }
  // The peak P/E is a disclosure, never a hold: a row in an up-trend with a peak margin stays offered.
  const upTrendPeak = gateModule.topPickGate({ ...normedRow('MU'), pctSma20: 3, pctSma50: 5, pctSma200: 10, ret5d: 1, rsi: 55 });
  expect(!upTrendPeak.held && upTrendPeak.contraryCount === 1, `peak margin alone does not hold: ${JSON.stringify(upTrendPeak)}`);
  expect(gateModule.topPickGate({ ...normedRow('AAPL'), pctSma200: null }).reasons.includes('unchecked'), 'a missing 200-day reading never clears the gate');
});

await check('v60.50 the 종목 landing 백분위 상위 list leaves MU out and keeps AAPL and KO', async () => {
  const { buildTickerStart } = await load('src/ui/components/ticker-start.js');
  const top = buildTickerStart({ rows: ['MU', 'AAPL', 'KO'].map(normedRow), limit: 5 }).top.map((row) => row.symbol);
  expect(JSON.stringify(top) === '["AAPL","KO"]', `top list ${JSON.stringify(top)} (v60.49 listed MU first)`);
});

await check('v60.50 the list row shows the contrary count beside MU\'s percentile and nothing beside AAPL\'s', async () => {
  const { createColumnContent } = await load('src/ui/pages/screener/table.js');
  const doc = createFakeDocument();
  const textOf = (node) => String(node?.textContent ?? '') + (node?.children || []).map(textOf).join('');
  const mu = textOf(createColumnContent(doc, normedRow('MU'), 'rank'));
  const aapl = textOf(createColumnContent(doc, normedRow('AAPL'), 'rank'));
  expect(/100/.test(mu) && /반대 조건 6/.test(mu), `MU rank cell: ${mu}`);
  expect(/98/.test(aapl) && !/반대 조건/.test(aapl), `AAPL rank cell: ${aapl}`);
});

// v60.51 (check-fixtures): the cross-section is frozen (eight normalized screener rows, 2026-11-24, in
// scripts/fixtures/reading-defects/stock-rows.json). v60.50 ranked the live screener.json, so the rule's verdict hung on
// whether the latest refresh had computed ranks at all (918 rows held between the close and the refresh).
await check('v60.50 the ranking model is unchanged (factor-ranks.v10): the norm fields move no score on the cross-section', async () => {
  const [{ normalizeScreener }, { calculationRow }, { computeFactorRanks, FACTOR_RANKS_MODEL_VERSION }] = await Promise.all([
    load('src/data/normalize/screener.js'), load('src/data/contracts/screener.js'), load('src/domain/screener/factor-ranks.js')]);
  expect(FACTOR_RANKS_MODEL_VERSION === 'factor-ranks.v10', `the model version stays v10 until a research backtest: ${FACTOR_RANKS_MODEL_VERSION}`);
  const frozen = JSON.parse(readFileSync(new URL('./fixtures/reading-defects/stock-rows.json', import.meta.url), 'utf8'));
  const now = Date.parse(frozen.frozenFrom.screenerAsOf) + 60_000;
  const base = Object.values(frozen.screenerRows).map(calculationRow);
  const withNorms = base.map((row) => (norms[row.sym] ? { ...row, _marginPriorFyMedian: norms[row.sym].median, _marginPriorFyYears: norms[row.sym].years } : row));
  const rank = (rows) => computeFactorRanks({ rows, now, fundamentalCoveragePct: 90.3, fmpOk: false }).rows;
  const scores = (rows) => JSON.stringify(rows.map((row) => [row.sym, row.rank, row.factorScores]));
  const ranked = rank(base).find((row) => row.sym === 'MU');
  expect(ranked && Number.isFinite(ranked.rank) && Object.keys(ranked.factorScores || {}).length > 0, `the frozen cross-section ranks MU with factor scores, so a norm that moved a score would show: ${JSON.stringify(ranked && [ranked.rank, ranked.factorScores])}`);
  expect(scores(rank(base)) === scores(rank(withNorms)), 'ranks and factor scores are identical with and without the norm fields');
  const [carried] = normalizeScreener({ rows: [{ sym: 'MU', _marginPriorFyMedian: 21.2, _marginPriorFyYears: 5 }] }).rows;
  expect(carried._marginPriorFyMedian === 21.2 && carried._marginPriorFyYears === 5, `normalize keeps the norm fields: ${JSON.stringify([carried._marginPriorFyMedian, carried._marginPriorFyYears])}`);
});

// ── producer fixture (no run): the norm from the ledger's PIT observations, carried into the factor row ─────────────
await check('v60.50 the screener producer derives marginPriorFyMedian / marginPriorFyYears from the ledger and merges them with the margin', async () => {
  const { secMarginPriorNormOf, mergeSecIntoFactorRows } = await load('scripts/producer/screener.mjs');
  const fy = (field, end, millions) => ({ field, value: millions * 1e6, periodStart: new Date(Date.parse(end) - 364 * 86400000).toISOString().slice(0, 10), periodEnd: end, filedAt: end, form: '10-K', fiscalPeriod: 'FY', concept: field === 'revenue' ? 'Revenues' : 'NetIncomeLoss' });
  const years = parseHistory(FROZEN.MU.history);
  const record = { pit: { observations: { revenue: years.map((y) => fy('revenue', y.periodEnd, y.revenue)), netIncome: years.map((y) => fy('netIncome', y.periodEnd, y.netIncome)) } } };
  const norm = secMarginPriorNormOf(record, '2026-09-03');
  expect(norm?.median === 21.2 && norm.years === 5, `producer norm from MU's ledger years: ${JSON.stringify(norm)}`);
  expect(secMarginPriorNormOf({ pit: { observationsDropped: 'extended-ledger-compact' } }, '2026-09-03') === null, 'the compact extended ledger carries no norm');
  const data = { MU: { sym: 'MU' }, KO: { sym: 'KO', margin: 28.7 } };
  mergeSecIntoFactorRows(data, {
    MU: { margin: 63.8, marginBasis: 'ttm', marginThrough: '2026-09-03', marginPriorFyMedian: 21.2, marginPriorFyYears: 5 },
    KO: { margin: 30, marginPriorFyMedian: 23.4, marginPriorFyYears: 5 }
  });
  expect(data.MU.marginPriorFyMedian === 21.2 && data.MU.marginPriorFyYears === 5, `merged MU row: ${JSON.stringify(data.MU)}`);
  expect(data.KO.marginPriorFyMedian === undefined, 'a row whose margin came from another source does not take the SEC norm');
});

if (failures.length) { console.error(`FAIL screener-rank-redesign (${failures.length})\n${failures.join('\n')}`); process.exit(1); }
console.log(JSON.stringify({ status: 'PASS', gate: 'screener-rank-redesign', checks }, null, 2));
process.exit(0);
