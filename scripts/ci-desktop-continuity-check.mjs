#!/usr/bin/env node
// Offline renderer contracts, not browser/user-experience certification.
// v59.48: the native pages are mounted through their exported factories against scripts/lib/fake-dom.mjs, instead of
// slicing function bodies out of src/ui/pages/*.js into a vm (a helper moving behind an import broke every slice).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { ROUTE_IDS } from '../src/app/routes.js';
import { createStore } from '../src/state/store.js';
import { createScreenDefinition } from '../src/data/contracts/screener.js';
import { computeTradingScoreModel, deriveTradingScoreDecisionPresentation } from '../src/domain/signal/trading-score.js';
import { sortRows, visibleRank, vcpStageLabel, createScreenerPage } from '../src/ui/pages/screener.js';
import { createMarketSlicePage } from '../src/ui/pages/market.js';
import { createAnalysisPage } from '../src/ui/pages/analysis.js';
import { createEntityPage } from '../src/ui/pages/entity.js';
import { deriveQuotePresentation } from '../src/domain/market/quote-presentation.js';
import { readNumber } from '../src/domain/shared/number.js';
import { createFakeDocument, fakeEvent, shellIds } from './lib/fake-dom.mjs';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const owners = JSON.parse(read('architecture/route-owners.json')).routes;
assert.deepEqual(Object.keys(owners).sort(), [...ROUTE_IDS].sort());
for (const route of ROUTE_IDS) {
  const modulePath = owners[route].nativeModule.split(' ')[0];
  assert(existsSync(new URL(`../${modulePath}`, import.meta.url)), `${route}: missing module`);
}
const source = read('src/ui/pages/market.js');
// The 금리·환율 route renders the page's live-quote cells on mount and on every aio:liveQuotes.
const price = { node: null }, pct = { node: null };
const marketDoc = createFakeDocument({ queryAll: (element, selector) => {
  if (element.id !== 'page-fxbond') return undefined;
  if (selector === '[data-live-price]') return [price.node];
  if (selector === '[data-live-chg],[data-live-pct]') return [pct.node];
  return [];
} });
price.node = marketDoc.createElement('span'); price.node.setAttribute('data-live-price', 'AAA');
pct.node = marketDoc.createElement('span'); pct.node.setAttribute('data-live-pct', 'AAA');
const marketRoot = { fetch: () => Promise.reject(new Error('offline gate')), _liveData: {} };
createMarketSlicePage({ root: marketRoot, documentRef: marketDoc, route: 'fxbond' }).mount();
const renderQuotes = (root) => { marketRoot._liveData = root._liveData; marketDoc.dispatchEvent(fakeEvent('aio:liveQuotes')); };
renderQuotes({ _liveData: { AAA: { price: 100, pct: null, source: 'snapshot', observedAt: '2026-08-28' } } });
assert.equal(price.node.textContent, '100.00'); assert.equal(pct.node.textContent, '—');
assert.equal(price.node.attrs.get('data-source-kind'), 'reference');
assert.equal(price.node.attrs.get('data-as-of'), '2026-08-28');
renderQuotes({ _liveData: {} });
assert.equal(price.node.textContent, '—'); assert(!price.node.attrs.has('data-as-of'));
assert.equal(price.node.attrs.get('data-operational-use'), 'blocked');
renderQuotes({ _liveData: { AAA: { price: 101, pct: 0, source: 'live:yahoo', observedAt: '2026-08-29' } } });
assert.equal(pct.node.textContent, '0.00%', 'v58.74 a zero change carries no sign'); assert.equal(price.node.attrs.get('data-operational-use'), 'reference-only');
// W03-B/P1145: display state follows the envelope's declared quality, not the source
// label. A "live" source carrying a stale envelope must never read as observed, and a
// declared-current envelope must promote even a snapshot-labelled source.
assert.equal(price.node.attrs.get('data-quote-state'), 'stale-reference');
renderQuotes({ _liveData: { AAA: { price: 101, pct: 1, source: 'live:yahoo', observedAt: '2026-08-29', quoteEnvelope: { price: 101, pct: 1, source: 'live:yahoo', observedAt: '2026-08-29', fetchedAt: '2026-09-01T00:00:00Z', quality: 'STALE', changeBasis: 'previous-close' } } } });
assert.equal(price.node.attrs.get('data-quote-state'), 'stale-reference');
assert.equal(price.node.attrs.get('data-source-kind'), 'reference');
renderQuotes({ _liveData: { AAA: { price: 101, pct: 1, source: 'snapshot', observedAt: '2026-08-29', quoteEnvelope: { price: 101, pct: 1, source: 'snapshot', observedAt: '2026-08-29', fetchedAt: '2026-09-01T00:00:00Z', quality: 'CURRENT', changeBasis: 'previous-close' } } } });
assert.equal(price.node.attrs.get('data-quote-state'), 'current');
assert.equal(price.node.attrs.get('data-source-kind'), 'observed');
assert.equal(price.node.attrs.get('data-change-coherent'), 'true');
// An unknown previous-close basis is not a coherent change; the receipt time must not
// freshen the older observation.
renderQuotes({ _liveData: { AAA: { price: 101, pct: 1, source: 'live:yahoo', observedAt: '2026-08-29', fetchedAt: '2026-09-10T00:00:00Z' } } });
assert.equal(pct.node.attrs.get('data-change-coherent'), 'false');
assert.equal(pct.node.attrs.get('data-observed-at'), '2026-08-29');
assert.equal(pct.node.attrs.get('data-fetched-at'), '2026-09-10T00:00:00Z');
assert(deriveQuotePresentation({ quoteEnvelope: { price: 5, quality: 'CURRENT' } }).displayState === 'current');
assert(deriveQuotePresentation({ price: 5, quality: 'UNAVAILABLE' }).displayState === 'stale-reference');
// An envelope/raw price disagreement is disputed, not a coherent quote.
assert(deriveQuotePresentation({ price: 9, quoteEnvelope: { price: 5, quality: 'CURRENT' } }).displayState === 'disputed');
for (const value of [null, '', undefined, false]) assert.equal(readNumber(value), null); // the page's finite is the shared reader
assert(source.includes('renderMacro(documentRef, root, page)') && source.includes('renderMacroBoard({ documentRef, root })')); // P1425
assert(!source.includes('renderMacroTransmissionLens')); // P1426: lens retired; macro-board.js renders through documentRef only
assert(!/\bdocument\.createElement/.test(read('src/ui/components/macro-board.js')));
const themes = read('src/ui/pages/themes.js');
assert(!/비중 유지|진입 후보|익절 검토|회피/.test(themes)); // v58.76: the AI-infrastructure lens is retired
assert(themes.includes('appendUnclassified()'));
assert(read('src/ui/pages/principles.js').includes('principles-graph-node-list principles-sr-only'));
assert(!read('src/app/bootstrap.js').includes('mountDesktopResearchFlow'));

// P1010: user-visible ranks, totals and navigation must consume the same truth.
const rows = [
  { sym: 'UNKNOWN', rank: 100, screenStatus: 'unavailable', ret1m: null },
  { sym: 'B', rank: 60, screenStatus: 'passed', ret1m: -2 },
  { sym: 'A', rank: 90, screenStatus: 'passed', ret1m: 0 },
  { sym: 'REJECTED', rank: 99, screenStatus: 'rejected', ret1m: null }
];
assert.equal(visibleRank(rows[0]), null);
assert.equal(vcpStageLabel('near_pivot'), '피벗 근접');
assert.equal(vcpStageLabel('not_stage2'), '이동평균 배열 미충족');
assert.equal(vcpStageLabel('unknown'), '관측');
// v57.81 (analysis audit 2026-10-15): 031980.KQ read "피벗 돌파" on a -12.5% day (rvol 1.65). A breakout needs a close
// through the pivot (a close at or below it in the last five sessions) on an up day; a heavy-volume down close above it
// is 'pivot_down'.
{
  const { _calcVCPServer } = await import('../src/domain/screener/price-factors.js');
  const { detectContractions } = await import('../src/domain/technical/definitions.js');
  // v57.84 (owner decision): the producer's pivot is the chart detector's — the last high of a valid contraction run — so
  // the base is a real VCP (pullbacks 15% → 8% → 4% after an uptrend), not a flat plateau whose latest swing high was the
  // old pivot.
  const base = [];
  let level = 50;
  for (let i = 0; i < 220; i += 1) base.push(level *= 1.004);
  const top = level;
  for (const [a, b] of [[1.0, 0.85], [0.85, 0.96], [0.96, 0.883], [0.883, 0.955], [0.955, 0.917], [0.917, 0.95]]) for (let k = 1; k <= 8; k += 1) base.push(top * (a + (b - a) * k / 8));
  const shape = (close) => ({ high: close * 1.004, low: close * 0.996, close });
  const pivot = detectContractions(base.map(shape)).pivot;
  assert.ok(detectContractions(base.map(shape)).valid && pivot > 0, 'v57.84 the fixture base is a valid contraction run');
  const bars = (tail) => {
    const rows = [...base.map(shape), ...tail.map((bar) => ({ ...shape(bar.close * pivot), ...(bar.high ? { high: bar.high * pivot } : {}), ...(bar.low ? { low: bar.low * pivot } : {}) }))];
    const volumes = rows.map((_, i) => (i === rows.length - 1 ? 1650 : 1000));
    return _calcVCPServer(rows.map((row) => row.close), rows.map((row) => row.high), rows.map((row) => row.low), volumes);
  };
  const real = bars([{ close: 0.99 }, { close: 0.993 }, { close: 0.996 }, { close: 0.998 }, { close: 1.0 }, { close: 1.02, high: 1.024, low: 1.0 }]);
  assert.equal(real?.pivotLevel, pivot, 'v57.84 the producer pivot is the chart detector pivot');
  assert.equal(real?.vcpStage, 'breakout', `v57.81 clean: a close through the pivot on an up day stays a breakout (${JSON.stringify(real)})`);
  const fall = bars([{ close: 1.01 }, { close: 1.015 }, { close: 1.02 }, { close: 1.02 }, { close: 1.02 }, { close: 1.005, high: 1.022, low: 1.0 }]);
  assert.notEqual(fall?.vcpStage, 'breakout', 'v57.81 a heavy-volume down day above the pivot is not 피벗 돌파');
  assert.equal(fall?.vcpStage, 'pivot_down', `v57.81 a heavy-volume down close above the pivot reads pivot_down (${JSON.stringify(fall)})`);
  assert.equal(vcpStageLabel('pivot_down'), '피벗 위 하락(거래량 증가)');
  assert.equal(vcpStageLabel('breakout'), '피벗 돌파');
}
assert.deepEqual(sortRows(rows, 'rank', false).map((row) => row.sym), ['A', 'B', 'UNKNOWN', 'REJECTED']);
assert.deepEqual(sortRows(rows, 'rank', true).map((row) => row.sym), ['B', 'A', 'UNKNOWN', 'REJECTED']);
assert.deepEqual(sortRows(rows, 'ret1m', true).map((row) => row.sym), ['B', 'A', 'UNKNOWN', 'REJECTED']);
assert.deepEqual(sortRows(rows, 'ret1m', false).map((row) => row.sym), ['A', 'B', 'UNKNOWN', 'REJECTED']);
assert.deepEqual(rows.map((row) => row.sym), ['UNKNOWN', 'B', 'A', 'REJECTED'], 'sorting must not mutate the canonical rows');
const priced = [{ sym: 'LIVE', currency: 'USD', valuationPrice: 50 }, { sym: 'CLOSE', currency: 'USD', valuationPrice: 900, factorSessionDate: '2026-10-13' }, { sym: 'NONE', currency: 'USD' }];
assert.deepEqual(sortRows(priced, 'price', false, () => ({ LIVE: { price: 100 } })).map((row) => row.sym), ['CLOSE', 'LIVE', 'NONE'], 'v57.54 review: price sorts on the shown price — live, else the dated completed close');
const emptyPresentation = deriveTradingScoreDecisionPresentation({ score: computeTradingScoreModel({}) });
assert.equal(emptyPresentation.displayScore, '—');
assert.equal(emptyPresentation.components.length, 5);
assert(emptyPresentation.components.every((row) => row.contribution === null));
const zeroPresentation = deriveTradingScoreDecisionPresentation({ score: { total: 0, volScore: 0 } });
assert.equal(zeroPresentation.components[0].contribution, 0, 'observed zero survives');

// One fake document for the home and ticker checks; every id exists on first use, as the slices' stub did.
const documentRef = createFakeDocument();
const nodes = documentRef.nodes;
// P1392: the home card is the six-axis regime summary; without close history it waits instead of
// inventing a state (the retired score summary asserted the same fail-closed behaviour).
const { renderHomeRegime } = await import(new URL('../src/ui/components/market-regime.js', import.meta.url));
renderHomeRegime({ documentRef, root: { _aioHistory: [], DATA_SNAPSHOT: {} } });
// P1619: an unavailable Nasdaq-100 cannot borrow the Nasdaq Composite close.
// v59.51 (content audit): the KPI strip's NQ fallback cell (home-kpi-nq-fallback) is retired; the 나스닥 100 close fallback
// now lives in the index strip card (closeFallback(history, INDEX_STRIP[1])), which reads only the ndx series.
const { closeFallback, INDEX_STRIP } = await import(new URL('../src/ui/components/home-index-strip.js', import.meta.url));
assert.equal(INDEX_STRIP[1].close, 'ndx', 'v59.51 (content audit): P1619 the 나스닥 100 card falls back to the ndx close');
assert.equal(closeFallback([{ date: '2026-10-09', spx: 7800, nasdaq: 27366 }], INDEX_STRIP[1]), null, 'v59.51 (content audit): P1619 no NDX history means no Composite fallback');
const ndxFallback = closeFallback([{ date: '2026-10-08', spx: 7790, nasdaq: 27300, ndx: 30800 }, { date: '2026-10-09', spx: 7800, nasdaq: 27366, ndx: 31000 }], INDEX_STRIP[1]);
assert.equal(ndxFallback?.value, 31000, 'v59.51 (content audit): P1619 NDX close is the matching cash fallback');
assert.notEqual(ndxFallback?.value, 27366, 'v59.51 (content audit): P1619 Composite value never enters the 나스닥 100 card');
renderHomeRegime({ documentRef, root: { _aioHistory: [], DATA_SNAPSHOT: {} } });
assert.equal(nodes.get('home-hero-total').textContent, '판정 대기');
assert(!/양호|부담/.test(nodes.get('home-hero-components').textContent), 'missing history cannot display axis states');
// The home Fear & Greed card: the mounted home page reads sentiment from the store and the completed close from history.
const setState = (state, action) => (action.type === 'test:set' ? { ...state, ...action.patch } : state);
const homeStore = createStore({ initialState: { sentiment: { values: {} } }, reducer: setState });
const homeRoot = { fetch: () => Promise.reject(new Error('offline gate')), _aioHistory: [], DATA_SNAPSHOT: {}, _liveData: {} };
createAnalysisPage({ root: homeRoot, documentRef, store: homeStore, route: 'home' }).mount();
const renderHomeFearGreed = ({ sentimentValues, history = [] }) => {
  homeRoot._aioHistory = history;
  homeStore.dispatch({ type: 'test:set', patch: { sentiment: { values: { ...sentimentValues } } } });
};
renderHomeFearGreed({ sentimentValues: { fearGreed: 54 } });
assert.equal(nodes.get('home-fg-label').textContent, '중립');
renderHomeFearGreed({ sentimentValues: { fearGreed: null } });
assert.equal(nodes.get('home-fg-score').textContent, '—');
assert.equal(nodes.get('home-fg-label').textContent, '미수신');
// T09/T11: the completed-close value wins over the intraday one, and label/colour share one band (24.6 rounds to 25 = 공포).
renderHomeFearGreed({ sentimentValues: { fearGreed: 60 }, history: [{ date: '2026-10-12', spx: 7800, fg: 24.6 }] });
assert.equal(nodes.get('home-fg-score').textContent, '25');
assert.equal(nodes.get('home-fg-label').textContent, '공포');
assert.equal(nodes.get('home-fg-score').style.color, 'var(--data-amber)');
assert.equal(nodes.get('home-fg-score').getAttribute('data-observed-at'), '2026-10-12');
renderHomeFearGreed({ sentimentValues: { fearGreed: 70 } });
assert.equal(nodes.get('home-fg-score').style.color, 'var(--data-green)', 'T11 greed uses the theme token, not #86efac');
// Late snapshot hydration reaches visible home: aio:serverDataLoaded alone (no store change) repaints the card.
homeRoot._aioHistory = [{ date: '2026-10-12', spx: 7800, fg: 24.6 }];
documentRef.dispatchEvent(fakeEvent('aio:serverDataLoaded'));
assert.equal(nodes.get('home-fg-score').textContent, '25', 'late snapshot hydration reaches visible home');

// The ticker page's navigation: mounted once, re-rendered on aio:refresh:done after the entry route changes.
const entityRoot = { fetch: () => Promise.reject(new Error('offline gate')), _liveData: {}, AIO: { state: {} }, _currentTickerId: 'NVDA' };
createEntityPage({ root: entityRoot, documentRef, store: homeStore, route: 'ticker' }).mount();
const renderTickerNavigation = (symbol, tickerReturnRoute) => {
  entityRoot._currentTickerId = symbol;
  entityRoot.AIO.state = tickerReturnRoute === undefined ? {} : { tickerReturnRoute };
  documentRef.dispatchEvent(fakeEvent('aio:refresh:done'));
};
for (const route of ['screener', 'themes', 'portfolio', 'technical', 'fundamental']) {
  renderTickerNavigation('NVDA', route);
  assert.equal(nodes.get('ticker-back-btn-main').getAttribute('data-arg'), route);
  const backName = nodes.get('ticker-back-btn-main').getAttribute('aria-label');
  assert(backName.includes(nodes.get('ticker-back-btn-main').textContent.replace(/^←\s*/, '')) && !backName.includes('←'), 'v57.61 accessible name contains the visible origin and does not read the arrow');
  assert.equal(nodes.get('ticker-breadcrumb-main').getAttribute('aria-label'), nodes.get('ticker-breadcrumb-main').textContent);
  assert.equal(nodes.get('ticker-fundamental-link').textContent, 'NVDA SEC 재무 보기');
  assert.equal(nodes.get('ticker-fundamental-link').disabled, false);
}
renderTickerNavigation('', undefined);
assert.equal(nodes.get('ticker-fundamental-link').disabled, true);
renderTickerNavigation('NVDA', 'javascript:bad');
// P1599 (S01): an unknown or unsafe entry route never becomes a link target, and no fake origin is named — the back button hides.
assert.notEqual(nodes.get('ticker-back-btn-main').getAttribute('data-arg'), 'javascript:bad');
assert.equal(nodes.get('ticker-back-btn-main').hidden, true, 'no recorded entry route hides the back button');

// js/aio-data.js is a classic script (not ESM); its helper still runs in a vm until the legacy-script harness exists.
const uiContext = vm.createContext({});
const dataSource = read('js/aio-data.js');
vm.runInContext(dataSource.slice(dataSource.indexOf('function _aioLiveNum('), dataSource.indexOf('window._aioLiveNum =')), uiContext);
for (const missing of [null, undefined, '', ' ', false, true, NaN]) assert.equal(uiContext._aioLiveNum(missing), null);
assert.equal(uiContext._aioLiveNum('0'), 0);
assert.equal(uiContext._aioLiveNum('42.5'), 42.5);
assert(!dataSource.includes('function _aioRenderHomeHero'), 'duplicate home score implementation retired');
assert(!dataSource.includes("getElementById('home-fg-label')"), 'legacy sentiment label writer retired');
assert(!read('index.html').includes('risk-composite-val'), 'static/fabricated composite retired');
assert(!read('index.html').includes('rm-vixstr-status'), 'unobserved futures structure card retired');
assert(!read('index.html').includes('var rollCost = vxxPct - vixDailyPct'), 'ETP/spot return difference is not roll cost');
assert(!read('index.html').includes('opt-term-vxx-spread'), 'dead option writer retired');
assert(!read('index.html').includes('id="ticker-m-mcap"') && !read('index.html').includes('id="ticker-action-btn"'), 'dead financial/action panels retired');
assert(!read('js/aio-core.js').includes('_tickerGapIds'), 'dead panel writer retired with its DOM');
assert(!read('src/app/bootstrap.js').includes('screener:return-context'), 'write-only storage retired');

const screenerSource = read('src/ui/pages/screener.js');
// The screener page mounted on the shell's ids, so its create-if-missing paths run as they do in the browser.
const KRW_CAP = { value: 200000000000000, currency: 'KRW', source: 'fixture', observedAt: '2026-08-31' };
const screenerStore = createStore({ initialState: { screener: { rows: [...rows,
  { sym: 'KRCAP', mcap: null, nativeMarketCap: { ...KRW_CAP, rightsId: 'REVIEW_REQUIRED' } },
  { sym: 'BLKCAP', mcap: null, nativeMarketCap: { value: KRW_CAP.value, currency: 'KRW', rightsId: 'BLOCKED' } }] } } });
const screenerDoc = createFakeDocument({ ids: shellIds(read('index.html')) });
const screenerRoot = { fetch: () => Promise.reject(new Error('offline gate')), _liveData: {} };
const runs = [];
createScreenerPage({ documentRef: screenerDoc, store: screenerStore, root: screenerRoot, readLiveData: () => ({}),
  workbench: { run: async (definition) => { runs.push(definition); return null; },
    getDefaultScreens: () => [{ definition: createScreenDefinition({ screenId: 'builder', filtersAST: { type: 'and', children: [{ type: 'range', field: 'price.ret3m', min: 0 }] } }) }] } }).mount();
const screenerPage = screenerDoc.getElementById('page-screener');
const pressAction = (action, argument) => {
  const button = screenerDoc.createElement('button');
  button.dataset.aioScreenerAction = action;
  if (argument !== undefined) button.dataset.aioScreenerArg = argument;
  screenerPage.append(button);
  screenerPage.dispatchEvent({ ...fakeEvent('click'), target: button });
  button.remove();
};
screenerRoot._aioAddScreenerCompare('A');
screenerRoot._aioAddScreenerCompare('B');
const compareList = screenerDoc.getElementById('scr-compare-list');
const compareTable = compareList.children[0];
assert.equal(compareTable.getAttribute('aria-label'), '선택 종목 비교');
// P1599 (F08): a metric with no value for any compared stock is listed once under the table instead of as an empty row.
const prunedNote = compareList.children[1];
const prunedCount = prunedNote ? String(prunedNote.textContent || '').split(':').pop().split(/, | · /).filter((item) => item.trim()).length : 0;
assert(compareTable.children[1].children.length >= 1, 'comparison contains actual metric rows, not only ticker chips');
assert.equal(compareTable.children[1].children.length + prunedCount, 8, 'every compared metric is either a row or named in the pruned note');
assert(compareTable.textContent.includes('90') && compareTable.textContent.includes('60'));
// The 위험 column view shows 시총; a KRW cap without a USD conversion keeps its basis note, a BLOCKED one shows nothing.
pressAction('column-preset', 'risk');
const resultRows = screenerDoc.getElementById('screener-results-body').children;
const rowFor = (symbol) => resultRows.find((tr) => tr.textContent.includes(symbol));
const capColumn = rowFor('KRCAP').children.findIndex((td) => td.textContent.includes('KRW 200.0T'));
assert(capColumn >= 0, 'P1599 the KRW-cap row renders its native cap in the 시총 column');
const nativeCapCell = rowFor('KRCAP').children[capColumn];
assert.equal(nativeCapCell.textContent, 'KRW 200.0T, 참고', 'P1599 v58.73 the native cap cell keeps its basis note (comma separator, owner 2026-10-23)');
assert([nativeCapCell, ...nativeCapCell.children].some((node) => String(node.title || '').includes('USD 환산값이 없어')), 'P1599 the native cap names why it is not used in USD filters');
assert.equal(rowFor('BLKCAP').children[capColumn].textContent, '—');
assert(!screenerSource.includes('scr-position-sizer') && !read('index.html').includes('id="scr-position-sizer"'), 'unreachable USD-only position sizing panel retired instead of relabelling KRW prices');
assert(screenerSource.includes('row?.focus?.({ preventScroll: true })') && screenerSource.includes('content.scrollTop = view.scrollTop'));
assert(screenerSource.includes('const focusedSymbol = body.contains(focusedRow)') && screenerSource.includes('(action || row)?.focus({ preventScroll: true })'), 'quote rerender preserves the selected row/action focus');
// The visual builder: running unchanged controls twice yields one definition; removing the condition keeps the preset.
screenerDoc.getElementById('scr-rsi-min').value = '52';
pressAction('screen-run-visual');
pressAction('screen-run-visual');
assert.equal(runs.length, 2, 'P1625 each visual run reaches the workbench');
assert(runs[0].filtersAST.children.some((node) => node.origin === 'visual-builder' && node.field === 'price.rsi14' && node.min === 52), 'P1625 the RSI control enters the run definition');
assert.equal(runs[1].definitionHash, runs[0].definitionHash, 'running unchanged visual controls cannot append duplicate AST nodes');
screenerDoc.getElementById('scr-rsi-min').value = '';
pressAction('screen-run-visual');
const presetNodes = (definition) => definition.filtersAST.children.filter((node) => node?.origin !== 'visual-builder' && node?.origin !== 'market-scope');
const removed = runs[2].filtersAST.children;
assert(!removed.some((node) => node.origin === 'visual-builder'), 'P1625 removed visual condition leaves no visual node');
assert.deepEqual(presetNodes(runs[2]), presetNodes(runs[0]), 'P1625 removed visual condition leaves the preset intact');
assert.equal(removed.length, 2, 'P1625 removed visual condition leaves preset and explicit market scope intact');
assert.equal(removed[0].field, 'price.ret3m');
assert.deepEqual(removed.filter((node) => node.origin === 'market-scope').map((node) => node.values), [['US']], 'P1625 removed visual condition leaves the explicit market scope intact');
console.log(`Desktop continuity PASS: ${ROUTE_IDS.length} module references; canonical breakdown, sentiment reset, null/zero, rank sorting, origin navigation, comparison, visual-condition idempotence and retirement controls. Offline only.`);
