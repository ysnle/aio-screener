// v60.26: the screener page states only what its rows support — the overall rank, the P/B basis, why a market has no
// rank, a condition whose source is still loading, and the new exclusion / close / volume-basis fields. Each block mounts
// the real page (scripts/lib/fake-dom.mjs) or calls the domain module the page reads; offline, no browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeDocument, shellIds } from './lib/fake-dom.mjs';
import { createStore } from '../src/state/store.js';
import { createScreenerPage, liveRow, SCREENER_COLUMN_REGISTRY } from '../src/ui/pages/screener.js';
import { FACTOR_LABELS } from '../src/domain/screener/row-presentation.js';
import { computeFactorRanks } from '../src/domain/screener/factor-ranks.js';
import { createScreenerOrchestrator } from '../src/data/orchestrators/screener.js';
import { conditionSourceStates, sourcedConditionIdsFor } from '../src/ui/pages/screener/model.js';
import { SOURCED_CONDITION_IDS, conditionSource } from '../src/domain/screener/custom-conditions.js';
import { backtestFactorCoverage } from '../src/domain/screener/model-fingerprint.js';
import { MODEL_DEFAULT_WEIGHTS } from '../src/domain/screener/factor-weights.js';
import { excludedFactorsText } from '../src/ui/pages/screener/validation-tab.js';
import { summarizeValidation } from '../src/ui/components/screener-validation.js';
import { createTrendChart } from '../src/ui/components/trend-chart.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const checks = [];
const failures = [];
// Every check runs and reports, so one failure does not hide the others.
const check = (name, fn) => { try { fn(); checks.push(name); } catch (error) { failures.push(`${name}: ${error.message.split('\n')[0]}`); } };

// A US cross-section large enough that the rounded 0–100 percentile ties (about two rows per value at 250 rows).
const US_ROWS = 250;
const fixtureRow = (index, market = 'US') => {
  const seed = (index * 37) % US_ROWS; // a scrambled order, so input order is not the composite order
  return {
    sym: market === 'KR' ? `K${String(index).padStart(5, '0')}.KS` : `U${index}`, market, sector: ['Technology', 'Industrials', 'Health Care'][index % 3],
    ret1m: seed / 10, ret3m: seed / 5, ret6m: seed / 3, ret12m: seed / 2, pctSma50: seed / 20, pctSma200: seed / 10, vol: 10 + seed / 25, rsi: 40 + (seed % 30),
    kalmanVel: seed / 1000, kalmanVelConf: 1, kalmanScale: 'log_pct_day',
    factorSessionDate: '2026-11-16', factorObservedAt: '2026-11-16T14:30:00Z', factorTimeBasis: 'bar-start', factorBarCompleteness: 'completed-sessions-only',
    factorSourceKind: 'T3_PUBLIC_DELAYED', factorAllowedUse: 'research-relative-ranking-only', factorQuality: { status: 'CURRENT', stale: false }
  };
};
const now = Date.parse('2026-11-17T12:00:00Z'); // after the 11/16 US close, before the 11/17 one
let published = null;
const inputRows = [...Array.from({ length: US_ROWS }, (_, i) => fixtureRow(i)), ...Array.from({ length: 30 }, (_, i) => fixtureRow(i, 'KR'))];
// The provider's readiness envelope is not part of this fixture, so the ranker reads the raw factor rows; the
// orchestrator's own assembly (merge, overall rank, screen run) is what is under test.
const orchestrator = createScreenerOrchestrator({
  provider: { readCurrent: async () => ({ rows: inputRows }) },
  commands: { setData: (value) => { published = value; } },
  ranker: () => computeFactorRanks({ rows: inputRows, now }), rankingContext: () => ({ now }), yieldImpl: () => Promise.resolve()
});
await orchestrator.sync();

// ── Defect 1: the overall rank is the ordinal by the unrounded composite inside the row's market ──────────────────
check('v60.26 overall rank = position by the unrounded composite within the market, ties shared', () => {
  for (const market of ['US', 'KR']) {
    const rows = published.rows.filter((row) => (market === 'KR') === row.sym.endsWith('.KS'));
    const ranked = rows.filter((row) => Number.isFinite(row._compositeZ) && Number.isFinite(row.rank));
    assert.ok(ranked.length >= 20, `v60.26 fixture ranks the ${market} cross-section (${ranked.length})`);
    const wrong = ranked.filter((row) => row.overallRank !== ranked.filter((other) => other._compositeZ > row._compositeZ).length + 1);
    assert.deepEqual(wrong.map((row) => [row.sym, row.overallRank, row.screenRank]), [], `v60.26 every ${market} overallRank is 1 + the count of higher composites`);
  }
  // The rounded percentile makes the old ordinal (screenRank of the pipeline screen) share ranks the composite separates.
  const us = published.rows.filter((row) => !row.sym.endsWith('.KS'));
  assert.ok(new Set(us.map((row) => row.overallRank).filter(Number.isFinite)).size > new Set(us.map((row) => row.rank).filter(Number.isFinite)).size, 'v60.26 the overall rank separates rows the rounded percentile ties');
});

const presetRows = published.rows.map((row) => ({ ...row }));
// A preset's own order: the reverse of the overall one, so a column that reads screenRank shows the wrong number.
const usSorted = presetRows.filter((row) => Number.isFinite(row._compositeZ) && Number.isFinite(row.rank) && !row.sym.endsWith('.KS')).sort((a, b) => a._compositeZ - b._compositeZ);
usSorted.forEach((row, index) => { row.screenRank = index + 1; row.screenStatus = 'passed'; });
// One ranked row the pipeline screen could not judge (FDXF on 11/16: a missing 200-day distance) has no screenRank but
// keeps its overall rank; the header used to count screenRank rows (820) while 821 rows had a rank.
usSorted[1].screenRank = null;
const store = createStore({ initialState: { screener: { status: 'ready', rows: presetRows, metadata: { ...published.metadata, factorSessionDateByMarket: { US: '2026-11-16', KR: '2026-01-05' }, asOf: '2026-11-17T00:00:00Z' } } } });
const doc = createFakeDocument({ ids: shellIds(html) });
const root = { fetch: () => Promise.reject(new Error('offline gate')), _liveData: {} };
createScreenerPage({ documentRef: doc, store, root, readLiveData: () => ({}), workbench: { run: async () => null, getDefaultScreens: () => [] } }).mount();
const kicker = () => String(doc.getElementById('scr-kicker-counts').textContent || '');
// The cells of the column labelled 전체 순위 (td data-label, the phone card label), whatever key the registry gives it.
const rankCells = () => [...doc.getElementById('screener-results-body').children]
  .map((tr) => [tr.dataset?.aioScreenerTicker, (tr.children || []).find((td) => td.dataset?.label === '전체 순위')])
  .filter(([sym, td]) => sym && td);

check('v60.26 the 전체 순위 column shows the overall rank, not the active screen order', () => {
  const cells = rankCells();
  assert.ok(cells.length > 0, 'v60.26 the default view renders a 전체 순위 column');
  const bySym = new Map(presetRows.map((row) => [row.sym, row]));
  const mismatch = cells.map(([sym, td]) => [sym, String(td.textContent || ''), String(bySym.get(sym).overallRank ?? '—')]).filter(([, shown, want]) => shown !== want);
  assert.deepEqual(mismatch, [], 'v60.26 every 전체 순위 cell equals the row overallRank (a preset screenRank never leaks into it)');
});

check('v60.26 header ranked count = rows carrying an overall rank', () => {
  const usRanked = presetRows.filter((row) => !row.sym.endsWith('.KS') && Number.isFinite(row._compositeZ) && Number.isFinite(row.rank)).length;
  assert.match(kicker(), new RegExp(`, ${usRanked}종목 순위$`), `v60.26 kicker '${kicker()}' quotes ${usRanked}`);
});

// ── Defect 2: P/B wording follows the data (latest filed balance sheet, quarter included) ──────────────────────────
check('v60.26 P/B basis copy names the latest filed balance sheet, not the fiscal year', () => {
  const pbHint = SCREENER_COLUMN_REGISTRY.find((column) => column.key === 'pb')?.hint || '';
  for (const [where, textValue] of [['밸류 factor description', FACTOR_LABELS.value.description], ['PBR column hint', pbHint]]) {
    assert.doesNotMatch(textValue, /PBR[^—]*(연간\(FY\)|최근 회계연도)|자기자본\(SEC 공시, 최근 회계연도\)/, `v60.26 ${where} must not call PBR equity annual: ${textValue}`);
    assert.match(textValue, /분기 포함/, `v60.26 ${where} says a quarter is included: ${textValue}`);
  }
});

// ── Defect 3a: a market with no rank because its close is behind says so ─────────────────────────────────────────
check('v60.26 a market whose factor session is behind says why it has no rank', () => {
  const krRows = presetRows.filter((row) => row.sym.endsWith('.KS')).map((row) => ({ ...row, rank: null, _compositeZ: null, overallRank: null, screenRank: null, screenStatus: 'passed' })); // as on 2026-11-18: rows pass the screen, none ranked
  const krStore = createStore({ initialState: { screener: { status: 'ready', rows: krRows, metadata: { factorSessionDateByMarket: { KR: '2026-01-05' }, asOf: '2026-01-06T00:00:00Z', ranking: { byMarket: { KR: { available: false, ranked: 0, rankingUnavailableReason: 'no factor meets the minimum cross-sectional coverage threshold' } } } } } } });
  const krDoc = createFakeDocument({ ids: shellIds(html) });
  krDoc.getElementById('scr-passed-only').checked = true;
  krDoc.getElementById('scr-min-rank').value = '50'; // a rank condition: nothing can pass while no row is ranked
  createScreenerPage({ documentRef: krDoc, store: krStore, root: { fetch: () => Promise.reject(new Error('offline')), _liveData: {}, _aioScreenerListingMarket: 'KR' }, readLiveData: () => ({}), workbench: { run: async () => null, getDefaultScreens: () => [] } }).mount();
  // v60.30: the header says why once (its close stamp names the market and date); the table says it short.
  assert.ok(String(krDoc.getElementById('scr-kicker-counts').textContent || '').includes('순위 보류(최신 거래일 종가 대기)'), `v60.26 KR kicker names the held rank: '${krDoc.getElementById('scr-kicker-counts').textContent}'`);
  const body = krDoc.getElementById('screener-results-body');
  if (!body.querySelector('[data-aio-screener-ticker]')) assert.ok(String(body.textContent || '').includes('순위 보류 — 최신 거래일 종가가 들어오면 순위를 매깁니다'), `v60.26 the empty table names the held rank: '${body.textContent}'`);
});

// ── v60.30: with no rank in the selected market the list shows unranked, and the reason is said once per place ──────
check('v60.30 an unranked market shows its whole list unranked under the default 조건 통과만, with one short notice', () => {
  // As on 2026-11-18: 한국 rows not passed (the screen needs a rank) and none ranked; 조건 통과만 is on by default.
  const krRows = presetRows.filter((row) => row.sym.endsWith('.KS')).map((row) => ({ ...row, rank: null, _compositeZ: null, overallRank: null, screenRank: null, screenStatus: 'unavailable' }));
  const krStore = createStore({ initialState: { screener: { status: 'ready', rows: krRows, metadata: { factorSessionDateByMarket: { KR: '2026-01-05' }, asOf: '2026-01-06T00:00:00Z', ranking: { byMarket: { KR: { available: false, ranked: 0 } } } } } } });
  const krDoc = createFakeDocument({ ids: shellIds(html) });
  krDoc.getElementById('scr-passed-only').checked = true;
  createScreenerPage({ documentRef: krDoc, store: krStore, root: { fetch: () => Promise.reject(new Error('offline')), _liveData: {}, _aioScreenerListingMarket: 'KR' }, readLiveData: () => ({}), workbench: { run: async () => null, getDefaultScreens: () => [] } }).mount();
  const shown = [...krDoc.getElementById('screener-results-body').children].filter((tr) => tr.dataset?.aioScreenerTicker);
  assert.ok(shown.length > 0, `v60.30 the unranked market's rows are listed (${shown.length})`);
  assert.equal(krDoc.getElementById('scr-passed-only').checked, true, 'v60.30 the user\'s 조건 통과만 choice is kept for when ranks return');
  const rankText = shown.map((tr) => String((tr.children || []).find((td) => td.dataset?.label === '전체 순위')?.textContent || '')).filter((value) => /\d/.test(value));
  assert.deepEqual(rankText, [], 'v60.30 rank cells stay empty');
  const kicker = String(krDoc.getElementById('scr-kicker-counts').textContent || '');
  assert.doesNotMatch(kicker, /한국|01\/05|(?<!\d)(\d+)종목 중 \1종목/, `v60.30 the kicker does not repeat the close stamp or an equal count: '${kicker}'`);
  const host = krDoc.getElementById('scr-table-status');
  const status = String(host.textContent || '');
  // The line has a desktop and a phone form (one shown per width); each says it once.
  const full = String(host.querySelector('.scr-status-full')?.textContent || '');
  assert.equal((full.match(/순위 보류/g) || []).length, 1, `v60.30 the table notice says it once: '${full}'`);
  assert.doesNotMatch(status, /통과 종목만 보기/, 'v60.30 no way back to a passed set that does not exist');
});

// v60.30: the inspector's factor rows carry the name and the score; what a factor measures is a line in the fold.
check('v60.30 the inspector puts the factor definition in the fold, not glued to the factor label', () => {
  const source = readFileSync(new URL('../src/ui/pages/screener/inspector.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /sx-factor__desc/, 'v60.30 no description span inside the factor label');
  assert.match(source, /definitionLines\.push\x28/, 'v60.30 definitions are collected for the fold (P2674)'); // \x28 is '(': an unpaired \( reads as an open call to the assertion-trace scanner
  assert.match(source, /for \(const line of \[\.\.\.definitionLines, \.\.\.evidenceLines\]\)/, 'v60.30 the fold lists the definitions');
});

// ── Defect 3b: a condition whose source is loading shows loading, not 0 ──────────────────────────────────────────
check('v60.26 a cash condition reads loading while the fiscal history is on the way', () => {
  const cashDoc = createFakeDocument({ ids: shellIds(html) });
  cashDoc.getElementById('scr-custom-conditions').value = JSON.stringify([{ id: 'fcf-margin-min', value: 10 }]);
  const cashRoot = { fetch: () => new Promise(() => {}), _liveData: {} }; // the history never arrives in this gate
  createScreenerPage({ documentRef: cashDoc, store, root: cashRoot, readLiveData: () => ({}), workbench: { run: async () => null, getDefaultScreens: () => [] } }).mount();
  const count = String(cashDoc.getElementById('screener-result-count').textContent || '');
  assert.notEqual(count, '0', 'v60.26 the result count is not 0 while the cash metrics load');
  assert.match(count, /불러오는 중/, `v60.26 the result count says loading: '${count}'`);
  const body = cashDoc.getElementById('screener-results-body');
  assert.doesNotMatch(String(body.textContent || ''), /조건에 맞는 종목이 없습니다/, 'v60.26 no empty-state verdict while loading');
  assert.equal(body.querySelector('[data-scr-state]')?.dataset?.scrState, 'loading', 'v60.26 the table cell is in the loading state');
});

// The Forward PER condition reads the lazily loaded consensus file: it waits the same way, keyed by its declared source,
// and a failed read ends the wait with a reason instead of staying 'loading'.
check('v60.26 every condition with a declared source reads loading while it loads and states the failure when it failed', () => {
  const fwdDoc = createFakeDocument({ ids: shellIds(html) });
  fwdDoc.getElementById('scr-custom-conditions').value = JSON.stringify([{ id: 'fwdpe-max', value: 25 }]);
  createScreenerPage({ documentRef: fwdDoc, store, root: { fetch: () => new Promise(() => {}), _liveData: {} }, readLiveData: () => ({}), workbench: { run: async () => null, getDefaultScreens: () => [] } }).mount();
  assert.match(String(fwdDoc.getElementById('screener-result-count').textContent || ''), /불러오는 중/, 'v60.26 the Forward PER count says loading while the consensus file loads');
  const states = conditionSourceStates({ __aioSharedArtifacts: { _aioConsensusEstimates: { failedAt: 1, inFlight: null } }, _aioSecFiscalHistoryFailed: true }, [{ id: 'fwdpe-max' }, { id: 'fcf-margin-min' }, { id: 'pe-max' }]);
  assert.deepEqual([...states.keys()], ['fwdpe-max', 'fcf-margin-min'], 'v60.26 only conditions that declare a source have a source state');
  assert.ok([...states.values()].every((item) => item.state === 'failed' && /받지 못했습니다/.test(item.reason || '')), `v60.26 a failed source ends the wait with a reason: ${JSON.stringify([...states.values()])}`);
  assert.deepEqual(sourcedConditionIdsFor('US'), SOURCED_CONDITION_IDS.filter((id) => conditionSource(id)), 'v60.26 every sourced condition is offered for the market its source covers');
});

// 사후 검증: the lead sentence names the price factors the backtest re-ranks and the live weight it leaves out, the
// excluded-factor reasons are Korean, and the trend chart labels one date basis without repeats.
check('v60.26 the 사후 검증 parity sentence, exclusion reasons and trend dates say what the backtest measured', () => {
  const coverage = backtestFactorCoverage(MODEL_DEFAULT_WEIGHTS);
  assert.deepEqual(coverage.covered, ['momentum', 'trend', 'lowvol', 'kalman'], 'v60.26 the backtest covers the four price factors');
  assert.deepEqual(coverage.excluded, ['value', 'quality'], 'v60.26 value and quality are the weighted factors left out');
  assert.equal(Math.round(coverage.excludedShare * 100), 40, 'v60.26 they carry 40% of the default weight');
  const fromCodes = excludedFactorsText({ excludedFactors: ['size', 'value', 'quality'] });
  const fromSentences = excludedFactorsText({ modelParity: { notValidated: ['size (no historical shares outstanding)', 'value / quality (no point-in-time fundamentals)'] } });
  assert.equal(fromCodes, '규모(과거 발행주식 수 자료 없음), 밸류·퀄리티(과거 시점의 재무 자료 없음)', `v60.26 exclusion reasons in Korean: '${fromCodes}'`);
  assert.equal(fromSentences, fromCodes, 'v60.26 an English-only record maps to the same Korean reasons');
  assert.doesNotMatch(excludedFactorsText({ modelParity: { notValidated: ['beta (not modelled)'] } }), /[A-Za-z]/, 'v60.26 an unknown reason falls back to Korean');
  const rows = [
    { date: '2026-11-15', session: '2026-11-13', modelFingerprint: 'M', quantileSpreadNet: 0.08, dates: 11 },
    { date: '2026-11-16', session: '2026-11-14', modelFingerprint: 'M', quantileSpreadNet: 0.24, dates: 11 }
  ];
  assert.deepEqual(summarizeValidation(rows).series.map((point) => point.date), ['2026-11-13', '2026-11-14'], 'v60.26 rows that carry the measured session are plotted by it');
  const legacy = summarizeValidation(rows.map(({ session: _s, ...row }) => row));
  assert.ok(legacy.seriesBasis === 'run' && legacy.series.length === 2, 'v60.26 rows without it are plotted by run day, said so');
  const chartDoc = createFakeDocument({ ids: [] });
  const svg = createTrendChart(chartDoc, { series: legacy.series, format: (value) => `${value}` });
  const labels = [];
  const walk = (node) => { if (node?.getAttribute?.('class') === 'trend-chart-axis' && /\//.test(String(node.textContent || ''))) labels.push(String(node.textContent)); (node?.children || []).forEach(walk); };
  walk(svg);
  assert.equal(new Set(labels).size, labels.length, `v60.26 no repeated x label: ${labels.join(', ')}`);
});

// ── Defect 4: new optional fields (pinned exclusion, sessionClose, provisional volume) ──────────────────────────────
check('v60.26 a pinned exclusion is named on the rank cell and in the 순위 밖 counts', () => {
  const pinnedRows = presetRows.map((row, index) => (index === 0 ? { ...row, rank: null, _compositeZ: null, overallRank: null, screenRank: null, rankingEligibility: 'population-excluded', populationExclusion: 'pinned', screenStatus: 'passed' } : row));
  const pinnedDoc = createFakeDocument({ ids: shellIds(html) });
  pinnedDoc.getElementById('scr-text-search').value = pinnedRows[0].sym;
  createScreenerPage({ documentRef: pinnedDoc, store: createStore({ initialState: { screener: { status: 'ready', rows: pinnedRows, metadata: published.metadata } } }), root: { fetch: () => Promise.reject(new Error('offline')), _liveData: {} }, readLiveData: () => ({}), workbench: { run: async () => null, getDefaultScreens: () => [] } }).mount();
  const note = String(pinnedDoc.getElementById('scr-population-excluded')?.querySelector('p')?.textContent || '');
  assert.match(note, /가격 고정 1/, `v60.26 the 순위 밖 note counts the pinned row: '${note}'`);
  const titles = [];
  const walk = (node) => { if (node?.title) titles.push(String(node.title)); (node?.children || []).forEach(walk); };
  walk(pinnedDoc.getElementById('screener-results-body'));
  assert.ok(titles.some((title) => title.includes('인수 진행 등으로 가격이 고정돼 순위에서 제외')), 'v60.26 the rank cell hover names the pinned price');
});

check('v60.26 sessionClose fills the price when no live quote or valuation close exists, dated by the factor session', () => {
  const shown = liveRow({ sym: 'NEW', currency: 'USD', sessionClose: 41.5, factorSessionDate: '2026-11-16' }, () => ({}));
  assert.equal(shown.price, 41.5, 'v60.26 the session close is the price');
  assert.equal(shown.priceCloseDate, '2026-11-16', 'v60.26 the price is dated by the factor session');
  assert.equal(liveRow({ sym: 'OLD', currency: 'USD', factorSessionDate: '2026-11-16' }, () => ({})).price ?? null, null, 'v60.26 without sessionClose nothing changes');
});

check('v60.26 the data-basis fold says the newest US session volume is provisional', () => {
  const note = String(doc.getElementById('screener-readiness-note').textContent || '');
  assert.match(note, /가장 최근 거래일의 거래량은 자료 제공처의 잠정치/, `v60.26 readiness note: '${note}'`);
});

// ── v60.27: rendered rows with no price ask the one quote owner; an off-hours answer is a dated close ─────────────────
// Rows with no live quote, no valuation close and no artifact price (ETFs and rows without SEC share data on 2026-11-18).
// The injected owner records each request and answers when the gate says so.
{
  const quoteRows = presetRows.filter((row) => !row.sym.endsWith('.KS')).map((row) => ({ ...row, currency: 'USD' }));
  const requests = [];
  let answer = null;
  const quoteRoot = {
    fetch: () => Promise.reject(new Error('offline')), _liveData: {}, _aioBootPhase: { quoteReady: true },
    AIO: { registerLiveSymbol: () => true },
    __aioQuoteDemand: { request: (symbols) => { requests.push([...symbols]); return new Promise((resolve) => { answer = resolve; }); }, register() {}, state: () => ({ running: false, queued: [], retryPending: false, failures: 0, registered: [] }) }
  };
  const quoteDoc = createFakeDocument({ ids: shellIds(html) });
  quoteDoc.getElementById('scr-passed-only').checked = false;
  createScreenerPage({ documentRef: quoteDoc, store: createStore({ initialState: { screener: { status: 'ready', rows: quoteRows, metadata: published.metadata } } }), root: quoteRoot, readLiveData: () => quoteRoot._liveData, workbench: { run: async () => null, getDefaultScreens: () => [] } }).mount();
  const rendered = () => [...quoteDoc.getElementById('screener-results-body').children].map((tr) => [tr.dataset?.aioScreenerTicker, (tr.children || []).find((td) => td.dataset?.columnKey === 'price')]).filter(([sym, td]) => sym && td);
  const firstView = rendered().map(([sym]) => sym);
  const settle = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
  check('v60.27 the page asks the quote owner for exactly the rendered rows without a price, bounded, and shows them loading', () => {
    assert.ok(firstView.length > 0 && firstView.length <= 20, `v60.27 the fixture renders a first page of rows (${firstView.length})`);
    assert.deepEqual(requests, [firstView], `v60.27 one request for the rendered unpriced rows: ${JSON.stringify(requests)}`);
    assert.ok(rendered().every(([, td]) => td.querySelector('[data-quote-state="loading"]')), 'v60.27 every requested price cell reads loading while the request is in flight');
  });
  // Off-hours (11/18 KST): one symbol answers with the 11/17 regular close (16:00:01 ET), one with an in-session tick
  // (13:30 ET), the rest are missing from the answer.
  const [closeSym, liveSym] = firstView;
  quoteRoot._liveData[closeSym] = { price: 50, observedAt: '2026-11-17T21:00:01.000Z', source: 'live:test' };
  quoteRoot._liveData[liveSym] = { price: 60, observedAt: '2026-11-17T18:30:00.000Z', source: 'live:test' };
  answer?.({ ok: true, updated: true, status: 'partial' });
  await settle();
  check('v60.27 an off-hours answer is the dated close, an in-session one is live, a missing one ends in a dash', () => {
    const cells = new Map(rendered());
    const closeCell = cells.get(closeSym);
    assert.equal(closeCell?.querySelector('.scr-close-note')?.dataset?.closeDay, '11/17', `v60.27 ${closeSym} reads as the 11/17 close`);
    assert.equal(closeCell?.querySelector('[data-quote-freshness]'), null, `v60.27 ${closeSym} is not shown as a live quote`);
    const liveCell = cells.get(liveSym);
    assert.equal(liveCell?.querySelector('[data-quote-freshness]')?.dataset?.quoteFreshness, 'observed', `v60.27 ${liveSym} is shown as an observed live quote`);
    assert.equal(liveCell?.querySelector('.scr-close-note'), null, `v60.27 ${liveSym} carries no close date`);
    const failed = firstView.slice(2).map((sym) => cells.get(sym));
    assert.ok(failed.length && failed.every((td) => String(td.textContent || '') === '—' && td.querySelector('[data-quote-state="failed"]')), 'v60.27 a symbol the answer did not carry ends in a dash with the failed reason');
    assert.ok(failed.every((td) => /받지 못했습니다/.test(String(td.querySelector('[data-quote-state="failed"]')?.title || ''))), 'v60.27 the dash says the quote was not received');
    assert.equal(liveRow(quoteRows.find((row) => row.sym === closeSym), () => quoteRoot._liveData).priceCloseDate, '2026-11-17', 'v60.27 the row model dates the off-hours quote by its own session');
  });
  check('v60.27 a re-render does not ask again for failed or priced rows, and a new rendered page asks only for its own rows', () => {
    const page = quoteDoc.getElementById('page-screener');
    const more = quoteDoc.createElement('button'); // the shell's 더 보기 button (the fake document builds ids only)
    more.dataset.aioScreenerAction = 'load-more';
    page.appendChild(more);
    page.dispatchEvent({ type: 'click', target: more, preventDefault() {}, stopPropagation() {} });
    const added = rendered().map(([sym]) => sym).filter((sym) => !firstView.includes(sym));
    assert.ok(added.length > 0, 'v60.27 load-more renders new rows');
    assert.equal(requests.length, 2, `v60.27 one more request after load-more: ${JSON.stringify(requests)}`);
    assert.deepEqual(requests[1], added.slice(0, 20), 'v60.27 the second request carries only the newly rendered unpriced rows');
  });
}

// ── v60.28: one time basis per row, and the dividend yield ───────────────────────────────────────────────────────────
// The producer now publishes marginBasis/revGrowthBasis ('ttm' | 'fy') with their end dates and the dividend facts; the
// page names each figure's period on hover and in the inspector. The published artifact before v60.28 has none of these
// fields, so a row without them must read as the fiscal year.
{
  const presentation = await import('../src/domain/screener/row-presentation.js');
  const { createColumnContent } = await import('../src/ui/pages/screener/table.js');
  const { normalizeScreener } = await import('../src/data/normalize/screener.js');
  const { keyMetricsLine } = await import('../src/ui/components/company-analysis.js');
  const base = { sym: 'AVGO', pe: 61.2, _valuationPeEarningsBasis: 'ttm', _valuationPeEarningsThrough: '2026-08-02', _fundamentalPeriodEnd: '2025-11-02', _fundamentalFiledAt: '2025-12-18', roe: 30.1 };
  const ttmRow = { ...base, margin: 42.9, revGrowth: 48.7, _marginBasis: 'ttm', _marginThrough: '2026-08-02', _revGrowthBasis: 'ttm', _revGrowthThrough: '2026-08-02' };
  const oldRow = { ...base, sym: 'IONQ', pe: 38, margin: -392.6, revGrowth: 201.9 }; // the artifact as published before v60.28
  check('v60.28 the filing cells name their period on hover: four quarters for a TTM margin/growth, the fiscal year for ROE and for a row without a basis', () => {
    const doc = createFakeDocument();
    const title = (row, key) => String(createColumnContent(doc, row, key)?.title || '');
    assert.match(title(ttmRow, 'margin'), /^최근 4개 분기\(2026-08 분기까지\) 합 기준$/, 'v60.28 TTM margin title');
    assert.match(title(ttmRow, 'revGrowth'), /최근 4개 분기\(2026-08 분기까지\) 합 기준, 직전 4개 분기 대비/, 'v60.28 TTM growth title');
    assert.match(title(ttmRow, 'roe'), /FY2025 기준/, 'v60.28 ROE beside TTM figures is labelled FY');
    assert.match(title(oldRow, 'margin'), /회계기간 종료 2025-11-02.*FY2025 기준/, 'v60.28 a row without a basis reads as the fiscal year');
  });
  check('v60.28 the inspector says in one line when the P/E (four quarters) and the margin (fiscal year) disagree in sign, and lists each period on hover', () => {
    assert.equal(presentation.filingBasisMismatch(oldRow), 'PER은 최근 4개 분기(2026-08 분기까지) 흑자 기준, 순이익률은 FY2025 적자', 'v60.28 row basis and dividend text (1)');
    assert.equal(presentation.filingBasisMismatch(ttmRow), null, 'v60.28 one basis, no line');
    assert.equal(presentation.filingBasisMismatch({ ...base, pe: null, _valuationPeLoss: true, margin: 5 }), '최근 4개 분기(2026-08 분기까지) 순손실로 PER 없음, 순이익률은 FY2025 흑자', 'v60.28 row basis and dividend text (2)');
    assert.equal(presentation.filingBasisSummary(ttmRow), 'PER 최근 4개 분기(2026-08 분기까지), 순이익률 최근 4개 분기(2026-08 분기까지), 매출 성장 최근 4개 분기(2026-08 분기까지)(직전 4개 분기 대비), ROE FY2025', 'v60.28 row basis and dividend text (3)');
    assert.match(presentation.FACTOR_LABELS.quality.description, /ROE는 최근 연간\(FY\), 순이익률은 최근 4개 분기/, 'v60.28 the quality factor names both bases');
  });
  check('v60.28 the dividend yield is one short token on the inspector and the ticker header line, absent without dividend facts', () => {
    const paid = { dividendTtm: 1.3, dividendYieldPct: 2.134, dividendCount12m: 4, dividendLastExDate: '2026-10-20', dividendBasis: 'yahoo-chart-events-ex-date' };
    assert.equal(presentation.dividendYieldText(paid), '배당수익률 2.1%(최근 12개월)', 'v60.28 row basis and dividend text (4)');
    assert.equal(presentation.dividendYieldText({ dividendTtm: 0, dividendYieldPct: 0, dividendCount12m: 0, dividendBasis: 'yahoo-chart-events-ex-date' }), '배당 없음(최근 12개월)', 'v60.28 row basis and dividend text (5)');
    assert.equal(presentation.dividendYieldText(oldRow), null, 'v60.28 the pre-v60.28 artifact shows no dividend token');
    const line = keyMetricsLine({ ...base, ...paid, factorSessionDate: '2026-11-16' }, null, [], '2026-11-17');
    assert.match(line || '', /최근 4개 분기 PER .*, 배당수익률 2\.1%\(최근 12개월\)/, `v60.28 the token follows PER: ${line}`);
    assert.doesNotMatch(keyMetricsLine({ ...base, factorSessionDate: '2026-11-16' }, null, [], '2026-11-17') || '', /배당/, 'v60.28 no token without the facts');
  });
  check('v60.28 the normalized screener row keeps the basis and dividend fields the page reads', () => {
    const [row] = normalizeScreener({ rows: [{ sym: 'AVGO', margin: 42.9, _marginBasis: 'ttm', _marginThrough: '2026-08-02', _revGrowthBasis: 'ttm', _revGrowthThrough: '2026-08-02', dividendTtm: 1.3, dividendYieldPct: 2.13, dividendLastExDate: '2026-10-20', dividendCount12m: 4, dividendBasis: 'yahoo-chart-events-ex-date' }] }).rows;
    assert.deepEqual([row._marginBasis, row._marginThrough, row._revGrowthBasis, row.dividendYieldPct, row.dividendCount12m, row.dividendBasis], ['ttm', '2026-08-02', 'ttm', 2.13, 4, 'yahoo-chart-events-ex-date'], 'v60.28 row basis and dividend text (6)');
  });
}

if (failures.length) { console.error(`FAIL screener-presentation (${failures.length})\n${failures.join('\n')}`); process.exit(1); }
console.log(JSON.stringify({ status: 'PASS', gate: 'screener-presentation', checks }, null, 2));
process.exit(0);
