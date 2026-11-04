#!/usr/bin/env node
// v59.70 (wave2-f S23, owner D4 2026-11-04): the shell has one search box. The four boxes (종목 #ticker-direct-search,
// 도움말 #guide-search-input, 용어 사전 #glossary-search, Ctrl+K focusing whichever was on screen) became the command
// search (#aio-command-input, src/ui/navigation/command-search.js); the screener's 표에서 찾기 (#scr-text-search) stays a
// table filter. This gate fails when a fifth search input appears in the static shell or a retired one comes back, when
// two shell key bindings share one key, and when Ctrl/⌘K or "/" stop doing what the D4 decision says.
// `--html <file>` checks another copy of index.html (the old shell fails: 4 search inputs).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = process.argv.indexOf('--html');
const htmlPath = at > 0 ? process.argv[at + 1] : join(repo, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const search = await import('../src/ui/navigation/command-search.js');
// The command search's dialog is built from COMMAND_SEARCH_MARKUP on first use; its inputs count with the static shell's.
const dialogMarkup = search.COMMAND_SEARCH_MARKUP || '';
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`); };

// 1. Search inputs in the static shell: type=search, a search role or a search-labelled text box.
const ALLOWED = ['aio-command-input', 'scr-text-search'];
const RETIRED = ['ticker-direct-search', 'guide-search-input', 'glossary-search', 'ticker-suggest', 'guide-search-result'];
const searchInputs = [];
for (const match of (html + dialogMarkup).matchAll(/<input\b[^>]*>/gi)) {
  const tag = match[0];
  const attr = (name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1] || '';
  const label = `${attr('aria-label')} ${attr('placeholder')}`;
  if (/^search$/i.test(attr('type')) || /search/i.test(attr('role')) || /search/i.test(attr('id')) || /검색/.test(label)) searchInputs.push(attr('id') || tag.slice(0, 60));
}
check('v59.70 the shell (static markup and the command dialog) has exactly the command search and the screener table filter as search inputs', searchInputs.length === ALLOWED.length && ALLOWED.every((id) => searchInputs.includes(id)), `found ${searchInputs.length}: ${searchInputs.join(', ')}`);
for (const id of RETIRED) check(`v59.70 retired search element #${id} stays out of the shell`, !new RegExp(`id="${id}"`).test(html));
{
  // Build the dialog on a minimal document and read what the module made (behaviour, not source text).
  const made = [];
  const fakeDocument = { getElementById: () => null, body: { append: (node) => made.push(node) }, createElement: (tag) => ({ tag, attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }) };
  const node = search.ensureCommandDialog(fakeDocument);
  const markup = node?.innerHTML || '';
  check('v59.70 the command search is a modal dialog with a combobox, scope buttons and a listbox', node?.tag === 'dialog' && node.id === 'aio-command-search' && made.length === 1
    && /id="aio-command-input"[^>]*role="combobox"/.test(markup) && /id="aio-command-results"[^>]*role="listbox"/.test(markup) && /id="aio-command-status"[^>]*role="status"/.test(markup)
    && search.COMMAND_SCOPES.every((scope) => markup.includes(`data-cmd-scope="${scope.id}"`)));
}
for (const [id, scope] of [['ticker-search-open', 'stock'], ['guide-search-open', 'guide'], ['glossary-search-open', 'term']]) {
  check(`v59.70 #${id} opens the command search's ${scope} scope`, new RegExp(`id="${id}"[^>]*data-action="_aioOpenCommandSearch"[^>]*data-arg="${scope}"`).test(html));
}
check('v59.70 the topbar 검색 button opens the command search', /id="topbar-search-btn"[^>]*data-action="_aioOpenCommandSearch"/.test(html));

// 2. Runtime sources: nothing reads the retired boxes; scripts and the AI panel reach search through the module.
const sources = ['src/app/compatibility-globals.js', 'src/ui/navigation/screen-shortcuts.js', 'src/ui/navigation/route-hubs.js', 'src/ui/pages/guide.js', 'src/ui/knowledge/glossary-modal.js', 'src/ui/knowledge/glossary-bridge.js', 'src/ui/components/term-marks.js'];
for (const file of sources) {
  const text = readFileSync(join(repo, file), 'utf8');
  const hit = RETIRED.find((id) => new RegExp(`['"#]${id}['"]`).test(text) || text.includes(`getElementById('${id}')`));
  check(`v59.70 ${file} reads no retired search box`, !hit, hit);
}

// 3. Shortcuts: one action per key and modifier; Ctrl/⌘K → command search (inside inputs too); "/" → table filter.
const shortcuts = await import('../src/ui/navigation/screen-shortcuts.js');
const bindings = shortcuts.SHELL_KEY_BINDINGS || [];
const seen = new Map();
for (const row of bindings) {
  const combo = `${row.mod || 'none'}+${String(row.key).toLowerCase()}`;
  check(`v59.70 shortcut ${combo} has one action`, !seen.has(combo), `${seen.get(combo)} / ${row.action}`);
  seen.set(combo, row.action);
}
check('v59.70 the binding table names Ctrl+K, ⌘K and "/" as D4 says', bindings.some((r) => r.key === 'k' && r.mod === 'ctrl' && r.action === 'command-search' && r.inInput) && bindings.some((r) => r.key === 'k' && r.mod === 'meta' && r.action === 'command-search') && bindings.some((r) => r.key === '/' && r.action === 'table-filter'));
check('v59.70 the screen number keys are in the binding table', shortcuts.SCREEN_SHORTCUTS.every((s) => bindings.some((r) => r.key === s.key && r.action === `screen:${s.route}`)));
const browserReserved = ['ctrl+r', 'meta+r', 'ctrl+f', 'meta+f', 'ctrl+l', 'meta+l', 'ctrl+t', 'meta+t', 'ctrl+w', 'meta+w'];
check('v59.70 no shell binding takes a browser key (reload, find, address bar, tab)', ![...seen.keys()].some((combo) => browserReserved.includes(combo)), [...seen.keys()].filter((combo) => browserReserved.includes(combo)).join(', '));
{
  let opened = 0; let focused = false; let open = false;
  const filter = { offsetParent: {}, focus() { focused = true; } };
  const documentRef = { querySelector: (sel) => (sel === '.page.active #scr-text-search' ? filter : null), getElementById: () => null };
  const root = { _aioOpenCommandSearch: () => { opened += 1; return true; }, _aioCommandSearchIsOpen: () => open };
  const help = { open() {}, close() {}, isOpen: () => false };
  const press = (event) => shortcuts.handleShortcutKey({ preventDefault() {}, target: { tagName: 'BODY' }, ...event }, { root, documentRef, help });
  const inInput = press({ key: 'k', ctrlKey: true, target: { tagName: 'INPUT' } });
  const slash = press({ key: '/' });
  filter.offsetParent = null;
  const slashElsewhere = press({ key: '/' });
  const composing = press({ key: 'k', ctrlKey: true, isComposing: true });
  open = true;
  const whileOpen = press({ key: '2' });
  check('v59.70 Ctrl+K opens the command search inside an input', inInput === 'command-search');
  check('v59.70 "/" focuses the screener table filter, and opens the command search where there is none', slash === 'table-filter' && focused && slashElsewhere === 'command-search' && opened === 2);
  check('v59.70 a composing (IME) key and keys while the command search is open do nothing in the shell', composing === null && whileOpen === null);
}

// 4. The module's pure parts: screens from the menu table, glossary ranking, no symbol guessing.
check('v59.70 시장 폭 finds the breadth screen first', search.matchScreens('시장 폭')[0]?.route === 'breadth', JSON.stringify(search.matchScreens('시장 폭')[0]));
check('v59.70 the glossary ranks the term itself first', search.matchTerms('PER', [{ term: 'PEG', def: 'PER을 성장률로 나눈 값' }, { term: 'PER (주가수익비율)', def: '주가 ÷ 주당순이익' }])[0]?.term === 'PER (주가수익비율)');
check('v59.70 a typed symbol is offered only when no candidate is already it', search.typedSymbol('nvda', [{ symbol: 'NVDA' }]) === null && search.typedSymbol('ZZZZQ', []) === 'ZZZZQ' && search.typedSymbol('애플 주식', []) === null && search.typedSymbol('005930', [{ symbol: '005930.KS' }]) === null);

if (failures.length) {
  console.error(`Search surface contract FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Search surface contract OK: ${searchInputs.length} search inputs (${searchInputs.join(', ')}), ${bindings.length} shell key bindings without conflict.`);
