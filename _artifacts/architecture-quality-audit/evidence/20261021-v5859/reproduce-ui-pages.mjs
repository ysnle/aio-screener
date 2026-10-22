// Audit-only: run current module bodies with instrumented DOM nodes, no browser/network.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const workspace = path.resolve(import.meta.dirname, '../..');
async function expose(file, names = []) {
  const absolute = path.join(workspace, file);
  const source = fs.readFileSync(absolute, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,
    (_, quote, relative) => `from ${quote}${pathToFileURL(path.resolve(path.dirname(absolute), relative)).href}${quote}`);
  return import(`data:text/javascript;base64,${Buffer.from(`${source}\nexport { ${names.join(', ')} };`).toString('base64')}`);
}
class Node {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.style = { setProperty() {} }; this.attributes = {}; this._text = ''; this.classList = { add() {}, remove() {}, contains() { return false; }, toggle() {} }; }
  append(...nodes) { for (const node of nodes) { this.children.push(node); if (node && typeof node === 'object') node.parentElement = this; } }
  appendChild(node) { this.append(node); return node; }
  insertBefore(node) { this.children.unshift(node); node.parentElement = this; }
  replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return this._text + this.children.map(n => n?.textContent ?? n ?? '').join(''); }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key]; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener() {}
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  remove() {}
}
const doc = { createElement: tag => new Node(tag), createDocumentFragment: () => new Node('fragment'), createTextNode: text => Object.assign(new Node('text'), { textContent: text }), getElementById: () => null, querySelectorAll: () => [], body: new Node('body') };
const root = { location: { search: '?lesson=D6', pathname: '/' }, addEventListener() {}, removeEventListener() {} };
doc.defaultView = root;
const { renderConceptsPage } = await expose('src/ui/knowledge/concepts-view.js');
const library = JSON.parse(fs.readFileSync(path.join(workspace, 'public-data/principles/lesson-library.json'), 'utf8'));
const shell = renderConceptsPage(doc, { root, state: { view: 'lesson', openGroup: 'lesson', lessonId: 'D6' }, data: { lessons: library.lessons, lessonChapters: [], lessonSources: library.sources }, onLocal() {} });
assert.equal(shell.textContent.includes('먼저 알아둘 레슨'), false);
console.log(JSON.stringify({ case: 'D6 prerequisites', declared: library.lessons.find(l => l.id === 'D6').prerequisites, renderedPrerequisiteHeading: shell.textContent.includes('먼저 알아둘 레슨') }));

const { renderTickerActivity } = await expose('src/ui/pages/entity.js', ['renderTickerActivity']);
const hero = new Node();
const activityDoc = { querySelector: selector => selector === '[id="ticker-hero-value"]' ? hero : null };
const holding = { symbol: 'AAPL', shares: 1, avgCost: 140000, costCurrency: 'KRW', currency: 'USD' };
renderTickerActivity(activityDoc, { _liveData: {} }, { id: 'AAPL', quote: { value: 100, currency: 'USD' } }, { holdings: [holding] });
assert.match(hero.textContent, /139,900/);
console.log(JSON.stringify({ case: 'cross-currency ticker pnl', holding, quoteUsd: 100, displayed: hero.textContent, mathematicallyValidWithoutFx: false }));

// Execute the page's exact renderRead closure with a renderer spy and real domain read.
const screenerSource = fs.readFileSync(path.join(workspace, 'src/ui/pages/screener.js'), 'utf8');
const start = screenerSource.indexOf('      const renderRead = () => {');
const end = screenerSource.indexOf('      // 2026-10-14 audit #5: theme stage rows', start);
assert(start >= 0 && end > start);
const { buildScreenerRead } = await import(pathToFileURL(path.join(workspace, 'src/domain/screener/screener-read.js')));
let rows = Array.from({ length: 50 }, (_, i) => ({ sym: `S${i}`, screenRank: i + 1, sector: 'Technology', pctSma50: 5, adrPct: 2, pctFrom52wHigh: -1 }));
const oldHealth = buildScreenerRead({ rows }).points.find(p => p.id === 'health').text;
const emitted = [];
const makeRead = new Function('documentRef', 'store', 'root', 'scopedRows', 'selectScreenerState', 'selectedValue', 'renderScreenerRead', 'withThemeStages',
  `let readSignature = '';\n${screenerSource.slice(start, end)}\nreturn renderRead;`);
const runRead = makeRead({ getElementById: () => null }, { getState: () => ({ rows }) }, {}, value => value, value => value, () => 'US', args => emitted.push(buildScreenerRead(args)), (_, value) => value);
runRead();
rows = rows.map((row, i) => i >= 5 && i < 10 ? { ...row, pctSma50: -5, pctFrom52wHigh: -20 } : row);
const newHealth = buildScreenerRead({ rows }).points.find(p => p.id === 'health').text;
runRead();
assert.notEqual(oldHealth, newHealth);
assert.equal(emitted.length, 1);
console.log(JSON.stringify({ case: 'screener read invalidation', publishedRowSets: 2, renderCount: emitted.length, previousHealth: oldHealth, updatedDomainHealth: newHealth }));

// The exact atlas callbacks plus legacy showPage history block used by the facade.
const atlasSource = fs.readFileSync(path.join(workspace, 'src/ui/pages/atlas.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(workspace, 'js/aio-core.js'), 'utf8');
const historyStart = legacySource.indexOf("    var _pendingRouteHash = window._aioPendingRouteHash || '';");
const historyEnd = legacySource.indexOf('  } catch(e) { /* sandboxed iframe', historyStart);
const legacyHistory = new Function('window', 'location', 'history', 'id', '_aioInPopstate', legacySource.slice(historyStart, historyEnd));
const { parseKnowledgeRouteState } = await import(pathToFileURL(path.join(workspace, 'src/app/knowledge-route-state.js')));
for (const [name, wanted] of [['onFrame', 'memory-optics'], ['onConcept', 'hbm']]) {
  let url = new URL('https://example.test/aio/?mode=taxonomy&node=memory-dram-hbm#atlas');
  const history = { state: { page: 'atlas' }, pushState(state, _, href) { this.state = state; url = new URL(href, url); }, replaceState(state, _, href) { this.state = state; url = new URL(href, url); } };
  const mockRoot = { history, get location() { return url; } };
  const callbackSource = atlasSource.split('\n').find(line => line.trimStart().startsWith(`${name}: `)).trim().replace(new RegExp(`^${name}: `), '').replace(/,\s*$/, '');
  const callback = new Function('root', 'route', `return (${callbackSource});`)(mockRoot, id => legacyHistory(mockRoot, url, history, id, false));
  callback(wanted);
  const parsed = parseKnowledgeRouteState(url);
  assert.equal(parsed.node, null);
  assert.equal(parsed.mode, null);
  console.log(JSON.stringify({ case: `atlas ${name} navigation`, selected: wanted, finalUrl: url.href, parsedMode: parsed.mode, parsedNode: parsed.node }));
}

