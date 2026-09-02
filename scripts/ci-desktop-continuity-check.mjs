#!/usr/bin/env node
// Offline renderer contracts, not browser/user-experience certification.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { ROUTE_IDS } from '../src/app/routes.js';
import { computeTradingScoreModel, deriveTradingScoreDecisionPresentation } from '../src/domain/signal/trading-score.js';
import { sortRows, visibleRank, vcpStageLabel } from '../src/ui/pages/screener.js';
import { SCREENER_FIELD_REGISTRY, fieldValueForPurpose, createScreenDefinition } from '../src/data/contracts/screener.js';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const owners = JSON.parse(read('architecture/route-owners.json')).routes;
assert.deepEqual(Object.keys(owners).sort(), [...ROUTE_IDS].sort());
for (const route of ROUTE_IDS) {
  const modulePath = owners[route].nativeModule.split(' ')[0];
  assert(existsSync(new URL(`../${modulePath}`, import.meta.url)), `${route}: missing module`);
}
const source = read('src/ui/pages/market.js');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function finite('), source.indexOf('const SNAPSHOT_ALIASES')), context);
const node = () => ({ textContent: 'old', attrs: new Map(), children: [], classList: { remove() {}, toggle() {} },
  getAttribute(key) { return this.attrs.get(key); }, setAttribute(key, value) { this.attrs.set(key, value); }, removeAttribute(key) { this.attrs.delete(key); } });
const price = node(), pct = node(); price.attrs.set('data-live-price', 'AAA'); pct.attrs.set('data-live-pct', 'AAA');
const page = { querySelectorAll: (selector) => selector === '[data-live-price]' ? [price] : [pct] };
context.renderLiveQuotes({ _liveData: { AAA: { price: 100, pct: null, source: 'snapshot', observedAt: '2026-08-28' } } }, page);
assert.equal(price.textContent, '100.00'); assert.equal(pct.textContent, '—');
assert.equal(price.attrs.get('data-source-kind'), 'reference');
assert.equal(price.attrs.get('data-as-of'), '2026-08-28');
context.renderLiveQuotes({ _liveData: {} }, page);
assert.equal(price.textContent, '—'); assert(!price.attrs.has('data-as-of'));
assert.equal(price.attrs.get('data-operational-use'), 'blocked');
context.renderLiveQuotes({ _liveData: { AAA: { price: 101, pct: 0, source: 'live:yahoo', observedAt: '2026-08-29' } } }, page);
assert.equal(pct.textContent, '+0.00%'); assert.equal(price.attrs.get('data-operational-use'), 'reference-only');
for (const value of [null, '', undefined, false]) assert.equal(context.finite(value), null);
assert(source.includes('renderMacro(documentRef, root, page, charts)'));
assert(source.includes('renderMacroTransmissionLens(documentRef, root, page)'));
assert(!/function renderMacroTransmissionLens[\s\S]*document\.createElement/.test(source));
const themes = read('src/ui/pages/themes.js');
assert(!/비중 유지|진입 후보|익절 검토|회피/.test(themes));
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
assert.equal(vcpStageLabel('not_stage2'), '추세 조건 미충족');
assert.equal(vcpStageLabel('unknown'), '관측');
assert.deepEqual(sortRows(rows, 'rank', false).map((row) => row.sym), ['A', 'B', 'UNKNOWN', 'REJECTED']);
assert.deepEqual(sortRows(rows, 'rank', true).map((row) => row.sym), ['B', 'A', 'UNKNOWN', 'REJECTED']);
assert.deepEqual(sortRows(rows, 'ret1m', true).map((row) => row.sym), ['B', 'A', 'UNKNOWN', 'REJECTED']);
assert.deepEqual(sortRows(rows, 'ret1m', false).map((row) => row.sym), ['A', 'B', 'UNKNOWN', 'REJECTED']);
assert.deepEqual(rows.map((row) => row.sym), ['UNKNOWN', 'B', 'A', 'REJECTED'], 'sorting must not mutate the canonical rows');
const emptyPresentation = deriveTradingScoreDecisionPresentation({ score: computeTradingScoreModel({}) });
assert.equal(emptyPresentation.displayScore, '—');
assert.equal(emptyPresentation.components.length, 5);
assert(emptyPresentation.components.every((row) => row.contribution === null));
const zeroPresentation = deriveTradingScoreDecisionPresentation({ score: { total: 0, volScore: 0 } });
assert.equal(zeroPresentation.components[0].contribution, 0, 'observed zero survives');

function domNode(tagName = 'div') {
  let value = '';
  return { tagName, nodeType: 1, style: {}, dataset: {}, children: [], attrs: new Map(),
    classList: { remove() {}, add() {}, toggle() {} },
    get textContent() { return value + this.children.map((child) => child.textContent).join(''); },
    set textContent(text) { value = String(text); this.children = []; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { value = ''; this.children = children; },
    setAttribute(key, text) { this.attrs.set(key, String(text)); },
    getAttribute(key) { return this.attrs.get(key); },
    removeAttribute(key) { this.attrs.delete(key); },
    addEventListener() {}, querySelector() { return null; }
  };
}
const nodes = new Map();
const documentRef = {
  createElement: domNode,
  getElementById(id) { if (!nodes.has(id)) nodes.set(id, domNode()); return nodes.get(id); },
  querySelector(selector) { return this.getElementById(selector.match(/id="([^"]+)"/)?.[1] || selector); }
};
const analysisSource = read('src/ui/pages/analysis.js');
const uiContext = vm.createContext({ documentRef });
vm.runInContext(analysisSource.slice(analysisSource.indexOf('function finite('), analysisSource.indexOf('function renderTechnicalHealth(')), uiContext);
uiContext.renderHomeSummary({ documentRef, signal: { presentation: emptyPresentation } });
assert.equal(nodes.get('home-hero-total').textContent, '—');
assert(!nodes.get('home-hero-components').textContent.includes('0 /'), 'missing components cannot display zero');
uiContext.renderHomeFearGreed({ documentRef, sentimentValues: { fearGreed: 54 } });
assert.equal(nodes.get('home-fg-label').textContent, '중립');
uiContext.renderHomeFearGreed({ documentRef, sentimentValues: { fearGreed: null } });
assert.equal(nodes.get('home-fg-score').textContent, '—');
assert.equal(nodes.get('home-fg-label').textContent, '미수신');

const entitySource = read('src/ui/pages/entity.js');
vm.runInContext(entitySource.slice(entitySource.indexOf('function tickerElement('), entitySource.indexOf('function renderTickerActivity(')) + entitySource.slice(entitySource.indexOf('function renderTickerNavigation('), entitySource.indexOf('function renderTickerChart(')), uiContext);
for (const route of ['screener', 'themes', 'portfolio', 'technical', 'fundamental']) {
  uiContext.renderTickerNavigation(documentRef, { id: 'NVDA' }, { AIO: { state: { tickerReturnRoute: route } } });
  assert.equal(nodes.get('ticker-back-btn-main').getAttribute('data-arg'), route);
  assert.equal(nodes.get('ticker-back-btn-main').getAttribute('aria-label'), nodes.get('ticker-back-btn-main').textContent, 'accessible name follows visible origin');
  assert.equal(nodes.get('ticker-breadcrumb-main').getAttribute('aria-label'), nodes.get('ticker-breadcrumb-main').textContent);
  assert.equal(nodes.get('ticker-fundamental-link').textContent, 'NVDA SEC 재무 보기');
  assert.equal(nodes.get('ticker-fundamental-link').disabled, false);
}
uiContext.renderTickerNavigation(documentRef, {}, {});
assert.equal(nodes.get('ticker-fundamental-link').disabled, true);
uiContext.renderTickerNavigation(documentRef, { id: 'NVDA' }, { AIO: { state: { tickerReturnRoute: 'javascript:bad' } } });
assert.equal(nodes.get('ticker-back-btn-main').getAttribute('data-arg'), 'fundamental');

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
assert(analysisSource.includes("'aio:serverDataLoaded', renderNow"), 'late snapshot hydration reaches visible home');

const screenerSource = read('src/ui/pages/screener.js');
const compareContext = vm.createContext({
  documentRef, compareSymbols: new Set(['A', 'B']), activeRows: rows,
  SCREENER_FIELD_REGISTRY, fieldValueForPurpose, createScreenDefinition,
  liveReader: () => ({}), tickerHandler: () => {}
});
vm.runInContext(screenerSource.replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '') + '\n' +
  screenerSource.slice(screenerSource.indexOf('const renderCompareTray ='), screenerSource.indexOf('const saveCurrentScreen =')) + '\nrenderCompareTray();', compareContext);
const compareTable = nodes.get('scr-compare-list').children[0];
assert.equal(compareTable.getAttribute('aria-label'), '선택 종목 비교');
assert.equal(compareTable.children[1].children.length, 8, 'comparison contains actual metric rows, not only ticker chips');
assert(compareTable.textContent.includes('90') && compareTable.textContent.includes('60'));
vm.runInContext("nativeCapCell = createColumnContent(documentRef, { mcap:null, nativeMarketCap:{ value:200000000000000, currency:'KRW', source:'fixture', observedAt:'2026-08-31', rightsId:'REVIEW_REQUIRED' } }, 'mcap', { readLiveData:()=>({}) }); blockedCapCell = createColumnContent(documentRef, { mcap:null, nativeMarketCap:{ value:200000000000000, currency:'KRW', rightsId:'BLOCKED' } }, 'mcap', { readLiveData:()=>({}) });", compareContext);
assert.equal(compareContext.nativeCapCell.textContent, 'KRW 200.0T · 참고');
assert(compareContext.nativeCapCell.title.includes('USD 환산값이 없어'));
assert.equal(compareContext.blockedCapCell, '—');
assert(!screenerSource.includes('scr-position-sizer') && !read('index.html').includes('id="scr-position-sizer"'), 'unreachable USD-only position sizing panel retired instead of relabelling KRW prices');
assert(screenerSource.includes('row?.focus?.({ preventScroll: true })') && screenerSource.includes('content.scrollTop = view.scrollTop'));
assert(screenerSource.includes('const focusedSymbol = body.contains(focusedRow)') && screenerSource.includes('(action || row)?.focus({ preventScroll: true })'), 'quote rerender preserves the selected row/action focus');
const builderContext = vm.createContext({
  activeDefinition: createScreenDefinition({ screenId: 'builder', filtersAST: { type: 'and', children: [{ type: 'range', field: 'price.ret3m', min: 0 }] } }),
  readBuilderConditions: () => [{ field: 'rsi', value: '52' }], createScreenDefinition
});
vm.runInContext(screenerSource.slice(screenerSource.indexOf('const buildVisualDefinition ='), screenerSource.indexOf('const setProfileButtons =')) + '\nactiveDefinition = buildVisualDefinition();', builderContext);
const firstHash = builderContext.activeDefinition.definitionHash;
vm.runInContext('activeDefinition = buildVisualDefinition();', builderContext);
assert.equal(builderContext.activeDefinition.definitionHash, firstHash, 'running unchanged visual controls cannot append duplicate AST nodes');
builderContext.readBuilderConditions = () => [];
vm.runInContext('activeDefinition = buildVisualDefinition();', builderContext);
assert.equal(builderContext.activeDefinition.filtersAST.children.length, 1, 'removed visual condition leaves the independent preset condition intact');
assert.equal(builderContext.activeDefinition.filtersAST.children[0].field, 'price.ret3m');
console.log(`Desktop continuity PASS: ${ROUTE_IDS.length} module references; canonical breakdown, sentiment reset, null/zero, rank sorting, origin navigation, comparison, visual-condition idempotence and retirement controls. Offline only.`);
