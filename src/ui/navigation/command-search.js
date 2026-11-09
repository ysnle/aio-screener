// v59.70 (wave2-f S23, owner D4 2026-11-04): one command search replaces the four search boxes (종목 #ticker-direct-search,
// 도움말 #guide-search-input, 용어 사전 #glossary-search and Ctrl+K's "focus whatever box is on screen"). Ctrl/⌘K, the
// topbar 검색 button, the 종목 page's search button, the hub's 종목 고르기 and the glossary's 검색 open it; the screener's
// 표에서 찾기 stays a table filter (focused with "/", screen-shortcuts.js).
//
// Results come in four groups, each from the one owner of that data:
//   종목   — the name registry and the KRX list (searchCandidates), the official US listing by name (us-listings.js,
//           loaded on the first Latin query) and the typed symbol itself. A typed symbol is checked against the listing
//           before it opens (_aioAcceptSymbol); one that is not listed is refused, never guessed (no ticker inference).
//   화면   — ROUTE_HUBS, named as the menu names them (routeLabel).
//   용어   — the glossary registry (root.GLOSSARY), then the generated knowledge index (knowledge-search.js, bundle E)
//           for research notes, lessons and map nodes.
//   도움말 — the guide's paragraphs (guide.js findGuideMatches), loaded on first use.
// The dialog (#aio-command-search, COMMAND_SEARCH_MARKUP below) is added to the page on first use: a native modal
// <dialog>, so focus stays inside, Esc closes and focus returns to the opener. Keys: ↑/↓ move, Enter opens (not while a
// Korean syllable is still composing), Esc closes. The module loads lazily (src/app/compatibility-globals.js).

import { ROUTE_HUBS, routeLabel } from './route-hubs.js';
import { searchCandidates } from '../../domain/instruments/resolve-name.js';
import { loadKnowledgeSearch, normalize, openKnowledgeResult } from '../knowledge/glossary-bridge.js';
import { renderDataState } from '../components/data-state.js';

export const COMMAND_SCOPES = Object.freeze([
  Object.freeze({ id: 'all', label: '전체' }),
  Object.freeze({ id: 'stock', label: '종목' }),
  Object.freeze({ id: 'screen', label: '화면' }),
  Object.freeze({ id: 'term', label: '용어' }),
  Object.freeze({ id: 'guide', label: '도움말' })
]);
// The only search box besides the screener's 표에서 찾기 (#scr-text-search); scripts/ci-search-surface-contract.mjs counts both.
export const COMMAND_SEARCH_MARKUP = `<div class="aio-cmd__panel">
  <div class="aio-cmd__bar">
    <input id="aio-command-input" class="aio-cmd__input" type="search" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="aio-command-results" aria-label="종목, 화면, 용어 검색" placeholder="종목, 화면, 용어" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
    <button type="button" class="aio-cmd__close" data-cmd-close aria-label="검색 닫기">닫기</button>
  </div>
  <div class="aio-cmd__scopes" role="group" aria-label="검색 범위"><!--scopes--></div>
  <div id="aio-command-results" class="aio-cmd__results" role="listbox" aria-label="검색 결과"></div>
  <div class="aio-cmd__foot"><span id="aio-command-status" class="aio-cmd__status" role="status" aria-live="polite"></span><span class="aio-cmd__keys" aria-hidden="true">↑↓ 이동, Enter 열기, Esc 닫기</span></div>
</div>`;

/** Adds the dialog to the page once (before the scroll-top button, as a direct child of body). */
export function ensureCommandDialog(documentRef) {
  const found = documentRef?.getElementById?.('aio-command-search');
  if (found || !documentRef?.body) return found || null;
  const node = documentRef.createElement('dialog');
  node.id = 'aio-command-search';
  node.className = 'aio-cmd';
  node.setAttribute('aria-label', '명령 검색');
  node.innerHTML = COMMAND_SEARCH_MARKUP.replace('<!--scopes-->', COMMAND_SCOPES.map((entry, at) => `<button type="button" class="aio-cmd__scope" data-cmd-scope="${entry.id}" aria-pressed="${at === 0}">${entry.label}</button>`).join(''));
  documentRef.body.append(node);
  return node;
}

const GROUP_LIMIT = Object.freeze({ stock: 6, screen: 5, term: 6, research: 4, guide: 4 });
const SYMBOL_SHAPE = /^(?:[A-Za-z][A-Za-z0-9.\-]{0,9}|\d{6}(?:\.K[SQ])?)$/;

/** Every screen a reader can open from the menu: { route, label, keys } (theme-detail is the themes panel, not a screen). */
export function screenEntries(hubs = ROUTE_HUBS) {
  return hubs.flatMap((hub) => hub.routes.filter((route) => route.tab !== false).map((route) => ({
    route: route.id, label: routeLabel(route.id) || hub.label, keys: [hub.label, route.label].map(normalize)
  })));
}

/** Screens whose name contains the query; an empty query lists each hub's first screen (quick navigation). */
export function matchScreens(query, hubs = ROUTE_HUBS) {
  const q = normalize(query);
  const all = screenEntries(hubs);
  if (!q) return hubs.map((hub) => all.find((entry) => hub.routes.some((route) => route.id === entry.route))).filter(Boolean);
  const score = (entry) => { const label = normalize(entry.label); return label === q || entry.keys.includes(q) ? 3 : label.startsWith(q) || entry.keys.some((key) => key.startsWith(q)) ? 2 : label.includes(q) || entry.keys.some((key) => key.includes(q)) ? 1 : 0; };
  return all.map((entry) => ({ entry, rank: score(entry) })).filter((row) => row.rank).sort((a, b) => b.rank - a.rank).map((row) => row.entry);
}

/** Glossary terms: the term itself, then terms starting with the query, containing it, an alias, then the definition. */
export function matchTerms(query, glossary = [], limit = GROUP_LIMIT.term) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const rank = (entry) => {
    const term = normalize(entry.term); const alias = normalize(entry.alias);
    if (term === q || term.replace(/\s*\(.*$/, '') === q) return 5;
    if (term.startsWith(q)) return 4;
    if (term.includes(q)) return 3;
    if (alias && alias.includes(q)) return 2;
    return normalize(entry.def).includes(q) ? 1 : 0;
  };
  return (Array.isArray(glossary) ? glossary : []).map((entry) => ({ entry, rank: rank(entry) })).filter((row) => row.rank)
    .sort((a, b) => b.rank - a.rank || String(a.entry.term).length - String(b.entry.term).length).slice(0, limit).map((row) => row.entry);
}

/**
 * v59.70 (re-review N4): how well a query matches a row's names — 3 the whole name or one of its words ('HY' in
 * 'HY 스프레드'), 2 a word that starts with it ('hy' → 'hynix'), 1 contained, 0 none.
 */
export function matchStrength(query, names = []) {
  const q = normalize(query);
  if (!q) return 0;
  let best = 0;
  for (const raw of names) {
    const name = normalize(raw);
    if (!name) continue;
    const words = name.split(/[^a-z0-9가-힣]+/).filter(Boolean);
    const level = name === q || words.includes(q) ? 3 : words.some((word) => word.startsWith(q)) ? 2 : name.includes(q) ? 1 : 0;
    if (level > best) best = level;
  }
  return best;
}

/**
 * Orders the 종목, 화면 and 용어 groups (in place) by their best match, and each group's rows the same way, so an exact
 * English abbreviation ('HY' → 용어 'HY 스프레드') leads partial romanized stock names (SK hynix, Hyundai) and is the first
 * row Enter opens. Equal strength keeps the default order (종목, 화면, 용어); 리서치 and 도움말 stay after them.
 */
export function orderByMatch(query, groups, { entries = {} } = {}) {
  const namesOf = (item) => item.kind === 'stock'
    ? [item.label, item.symbol, String(item.symbol || '').replace(/\.K[SQ]$/, ''), entries?.[item.symbol]?.en, entries?.[item.symbol]?.kr, ...(entries?.[item.symbol]?.alt || [])]
    : item.kind === 'term' ? [item.term, String(item.term || '').replace(/\s*\(.*$/, ''), ...String(item.alias || '').split(/\s{2,}|,/)]
      : item.kind === 'typed' ? [] : [item.label];
  const strength = new Map();
  for (const group of groups) {
    if (!['stock', 'screen', 'term'].includes(group.id)) continue;
    const scored = group.items.map((item, at) => ({ item, at, level: matchStrength(query, namesOf(item)) }));
    // a typed-symbol row stays first in its group (it is the reader's own text); the rest follow their match
    scored.sort((a, b) => (b.item.kind === 'typed') - (a.item.kind === 'typed') || b.level - a.level || a.at - b.at);
    group.items = scored.map((row) => row.item);
    strength.set(group, Math.max(0, ...scored.map((row) => row.level)));
  }
  const lead = groups.filter((group) => strength.has(group));
  const order = new Map(lead.map((group, at) => [group, at]));
  lead.sort((a, b) => strength.get(b) - strength.get(a) || order.get(a) - order.get(b));
  let k = 0;
  groups.forEach((group, at) => { if (strength.has(group)) groups[at] = lead[k++]; });
  return groups;
}

/** The typed text as a symbol to check, when it looks like one and no candidate already is it. */
export function typedSymbol(query, candidates = []) {
  const text = String(query || '').trim();
  if (!SYMBOL_SHAPE.test(text)) return null;
  const symbol = text.toUpperCase();
  return candidates.some((pick) => String(pick.symbol).toUpperCase() === symbol || String(pick.symbol).toUpperCase().replace(/\.K[SQ]$/, '') === symbol) ? null : symbol;
}

// The definition's first sentence (to its period: "…국채보다 높은…" must not stop at 보다); the row ellipsises the rest.
const firstSentence = (text) => String(text || '').split(/(?<=[.?!])\s/)[0].slice(0, 120);

export function createCommandSearch({ root = globalThis, documentRef = root?.document } = {}) {
  const dialog = () => documentRef?.getElementById?.('aio-command-search');
  const input = () => documentRef?.getElementById?.('aio-command-input');
  const list = () => documentRef?.getElementById?.('aio-command-results');
  const status = () => documentRef?.getElementById?.('aio-command-status');
  let scope = 'all';
  let options = [];
  let active = -1;
  let seq = 0;
  let timer = null;
  let opener = null;
  let painted = null; // the query the list shows

  const registry = () => ({ entries: root.AIO_TICKER_NAME_REGISTRY?.entries, krStockDb: root.KR_STOCK_DB, krToYahoo: root.krTickerToYahoo });
  const universe = () => new Set((typeof root._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []).map((row) => String(row?.sym || row?.symbol || '').toUpperCase()).filter(Boolean));
  const activeRoute = () => String((typeof root.AIO?.getActivePage === 'function' && root.AIO.getActivePage()) || documentRef?.querySelector?.('.page.active')?.id || '').replace(/^page-/, '');
  const say = (text) => { const node = status(); if (node) node.textContent = text || ''; };

  function close() {
    const node = dialog();
    if (node?.open) node.close();
  }

  function openStock(symbol) {
    const origin = activeRoute();
    opener = null;
    close();
    root.showTicker?.(symbol);
    // 차트 and 재무 공시 keep their tab: the subject changes, the reader stays where they were.
    if ((origin === 'technical' || origin === 'fundamental') && typeof root.showPage === 'function') root.showPage(origin);
  }

  async function chooseTyped(option) {
    const typed = option.symbol;
    const check = root._aioAcceptSymbol;
    if (typeof check !== 'function') { openStock(typed); return; }
    option.node?.setAttribute('aria-busy', 'true');
    say(`${typed} 상장 목록 확인 중`);
    const result = await Promise.resolve(check(typed)).catch(() => null);
    option.node?.removeAttribute('aria-busy');
    if (result && (result.ok || result.reason === 'listing-unavailable')) { openStock(String(result.id || typed).toUpperCase()); return; }
    // No guessing: a symbol neither AIO nor the official listing knows is refused where it was typed.
    option.node?.setAttribute('aria-disabled', 'true');
    say(`${typed}: 미국 상장 목록과 AIO 종목 목록에 없는 기호입니다.`);
  }

  function choose(index = active) {
    const option = options[index];
    if (!option || option.node?.getAttribute('aria-disabled') === 'true') return;
    if (option.kind === 'typed') { chooseTyped(option); return; }
    opener = null; // the opened screen or entry takes focus; the dialog's close event fires after it and must not pull it back
    close();
    if (option.kind === 'stock') openStock(option.symbol);
    else if (option.kind === 'screen') root.showPage?.(option.route);
    else if (option.kind === 'term') root.openGlossary?.(option.term);
    else if (option.kind === 'research') { if (option.entry.glossaryTerm) root.openGlossary?.(option.entry.glossaryTerm); else openKnowledgeResult(root, option.entry); }
    else if (option.kind === 'guide') { root.showPage?.('guide'); root.setTimeout?.(() => option.jump?.(option.id), 120); }
  }

  function setActive(index) {
    if (!options.length) { active = -1; input()?.removeAttribute('aria-activedescendant'); return; }
    active = (index + options.length) % options.length;
    options.forEach((option, at) => option.node?.setAttribute('aria-selected', String(at === active)));
    const node = options[active].node;
    input()?.setAttribute('aria-activedescendant', node.id);
    node.scrollIntoView?.({ block: 'nearest' });
  }

  function optionNode(option, at) {
    const node = documentRef.createElement('div');
    node.id = `aio-cmd-opt-${at}`;
    node.className = 'aio-cmd__option';
    node.setAttribute('role', 'option');
    node.setAttribute('aria-selected', 'false');
    node.dataset.kind = option.kind;
    const label = documentRef.createElement('span');
    label.className = 'aio-cmd__label';
    label.textContent = option.label;
    node.append(label);
    if (option.meta) { const meta = documentRef.createElement('span'); meta.className = 'aio-cmd__meta'; meta.textContent = option.meta; node.append(meta); }
    node.addEventListener('mousemove', () => { if (active !== at) setActive(at); });
    node.addEventListener('click', () => { setActive(at); choose(at); });
    option.node = node;
    return node;
  }

  // One group: a title, its options, or its own loading / error line (renderDataState) while its source loads.
  function groupNode(id, title) {
    const group = documentRef.createElement('div');
    group.className = 'aio-cmd__group';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', `aio-cmd-group-${id}`);
    group.dataset.group = id;
    const head = documentRef.createElement('div');
    head.className = 'aio-cmd__group-title';
    head.id = `aio-cmd-group-${id}`;
    head.textContent = title;
    group.append(head);
    return group;
  }

  function paint(groups) {
    const host = list();
    if (!host) return;
    options = [];
    const nodes = [];
    for (const group of groups) {
      if (!group.items.length && !group.pending && !group.failed) continue;
      const box = groupNode(group.id, group.title);
      for (const item of group.items) box.append(optionNode(item, options.push(item) - 1));
      if (group.pending || group.failed) {
        const slot = documentRef.createElement('div');
        slot.className = 'aio-cmd__slot';
        box.append(slot);
        renderDataState(slot, group.failed ? { state: 'error', text: group.failed, onRetry: () => run(input()?.value || '') } : { state: 'loading', lines: 2, timeoutMs: 15000, timeoutText: `${group.title} 목록을 받지 못했습니다.` });
      }
      nodes.push(box);
    }
    const query = String(input()?.value || '').trim();
    if (!nodes.length) {
      const slot = documentRef.createElement('div');
      slot.className = 'aio-cmd__slot';
      nodes.push(slot);
      const within = scope === 'all' ? '' : ` ${COMMAND_SCOPES.find((entry) => entry.id === scope)?.label}`;
      renderDataState(slot, { state: 'empty', text: query ? `‘${query.slice(0, 40)}’${within} 검색 결과가 없습니다.` : '종목, 화면, 용어를 입력합니다.' });
    }
    host.replaceChildren(...nodes);
    input()?.setAttribute('aria-expanded', String(options.length > 0));
    setActive(options.length ? 0 : -1);
    if (!groups.some((group) => group.pending)) say(options.length ? `${options.length}건` : '');
  }

  async function run(raw) {
    const query = String(raw || '').trim();
    const mine = ++seq;
    const want = (group) => scope === 'all' || scope === group || (scope === 'term' && group === 'research');
    const groups = [];
    // 종목 (US first: registry and listing; KRX names are in the same registry search).
    const stock = { id: 'stock', title: '종목', items: [] };
    if (want('stock') && query.length >= 1) {
      const picks = searchCandidates(query, { ...registry(), limit: GROUP_LIMIT.stock });
      const typed = typedSymbol(query, picks);
      if (typed) stock.items.push({ kind: 'typed', symbol: typed, label: typed, meta: '기호로 열기' });
      stock.items.push(...picks.map((pick) => ({ kind: 'stock', symbol: pick.symbol, label: pick.label, meta: pick.symbol })));
      stock.pending = query.length >= 3 && /[A-Za-z]/.test(query) && stock.items.length < GROUP_LIMIT.stock;
    }
    groups.push(stock);
    const screen = { id: 'screen', title: '화면', items: want('screen') ? matchScreens(query).slice(0, query ? GROUP_LIMIT.screen : 9).map((entry) => ({ kind: 'screen', route: entry.route, label: entry.label, meta: '' })) : [] };
    if (scope === 'all' && !query) screen.items = []; // an empty box in 전체 shows the hint, not the menu twice
    groups.push(screen);
    const term = { id: 'term', title: '용어', items: want('term') ? matchTerms(query, root.GLOSSARY).map((entry) => ({ kind: 'term', term: entry.term, alias: entry.alias, label: entry.term, meta: firstSentence(entry.def) })) : [] };
    groups.push(term);
    const research = { id: 'research', title: '리서치', items: [], pending: want('research') && query.length >= 2 };
    groups.push(research);
    const guide = { id: 'guide', title: '도움말', items: [], pending: want('guide') && query.length >= 2 };
    groups.push(guide);
    painted = query;
    orderByMatch(query, groups, registry());
    paint(groups);
    if (!groups.some((group) => group.pending)) return groups;
    say('찾는 중');
    const tasks = [];
    if (stock.pending) tasks.push(import('../../data/us-listings.js').then(async (module) => {
      const index = await module.loadUsListings();
      if (!index) throw new Error('listing');
      const extra = module.searchUsListingNames(index, query, { limit: GROUP_LIMIT.stock - stock.items.length, exclude: stock.items.map((item) => item.symbol), prefer: universe() });
      stock.items.push(...extra.map((pick) => ({ kind: 'stock', symbol: pick.symbol, label: pick.label, meta: [pick.symbol, pick.exchange].filter(Boolean).join(', ') })));
      stock.pending = false;
    }).catch(() => { stock.pending = false; stock.failed = stock.items.length ? '' : '미국 상장 목록을 받지 못했습니다.'; }));
    if (research.pending) tasks.push(loadKnowledgeSearch(root).then(({ index, search, failed }) => {
      research.pending = false;
      if (failed) { research.failed = '리서치 색인을 받지 못했습니다.'; return; }
      const terms = new Set(term.items.map((item) => normalize(item.term)));
      research.items = search(index, query, GROUP_LIMIT.research + 2).filter((entry) => !(entry.glossaryTerm && terms.has(normalize(entry.glossaryTerm)))).slice(0, GROUP_LIMIT.research)
        .map((entry) => ({ kind: 'research', entry, label: entry.title, meta: [entry.surfaceLabel, entry.group].filter(Boolean).join(', ') }));
    }));
    if (guide.pending) tasks.push(import('../pages/guide.js').then((module) => {
      guide.pending = false;
      guide.items = module.findGuideMatches(documentRef, query, GROUP_LIMIT.guide).map((match) => ({ kind: 'guide', id: match.id, jump: (id) => module.jumpToGuide(documentRef, id), label: match.label, meta: match.text }));
    }).catch(() => { guide.pending = false; guide.failed = '도움말을 불러오지 못했습니다.'; }));
    await Promise.all(tasks.map((task) => task.catch(() => {})));
    if (mine !== seq || !dialog()?.open) return groups; // a newer query or a closed dialog owns the list now
    const keep = options[active]?.label;
    orderByMatch(query, groups, registry());
    paint(groups);
    if (keep) { const at = options.findIndex((option) => option.label === keep); if (at > 0) setActive(at); }
    return groups;
  }

  function setScope(next) {
    scope = COMMAND_SCOPES.some((entry) => entry.id === next) ? next : 'all';
    documentRef.querySelectorAll('#aio-command-search [data-cmd-scope]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.cmdScope === scope)));
    const field = input();
    if (field) field.placeholder = { stock: '회사 이름이나 기호 (예: 애플, NVDA)', screen: '화면 이름 (예: 시장 폭)', term: '용어 (예: 하이일드)', guide: '도움말 (예: 판정 기준)' }[scope] || '종목, 화면, 용어';
  }

  function open(request = {}) {
    try { root.AIO?.loadGlossaryFull?.(); } catch (_) { /* 용어 rows fill in once it lands */ }
    const node = dialog();
    const field = input();
    if (!node || !field) return false;
    const { scope: wanted = 'all', query = '', note = '' } = typeof request === 'string' ? { scope: request } : (request || {});
    if (!node.open) {
      const focused = documentRef.activeElement;
      opener = focused && focused !== documentRef.body ? focused : null;
      if (typeof node.showModal === 'function') node.showModal(); else node.setAttribute('open', '');
    }
    setScope(wanted);
    field.value = String(query || '');
    run(field.value).then(() => { if (note) say(note); });
    field.focus();
    field.select?.();
    return true;
  }

  function install() {
    const node = ensureCommandDialog(documentRef);
    const field = input();
    if (!node || !field || node._aioCommandBound) return Boolean(node);
    node._aioCommandBound = true;
    field.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(field.value), 90); });
    field.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive(active + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(active - 1); }
      else if (event.key === 'Enter') {
        // A Korean syllable still composing ends with this Enter; only the next one opens (iOS and Windows IME).
        if (event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        clearTimeout(timer);
        // Typed and Enter inside the debounce: the list still shows the previous query, so paint this one first (the
        // synchronous groups paint before run's first await) and open its first row.
        if (String(field.value).trim() !== painted) { run(field.value); choose(0); } else choose();
      }
    });
    node.querySelectorAll('[data-cmd-scope]').forEach((button) => button.addEventListener('click', () => { setScope(button.dataset.cmdScope); run(field.value); field.focus(); }));
    node.querySelectorAll('[data-cmd-close]').forEach((button) => button.addEventListener('click', close));
    // A press on the backdrop (the dialog element itself, outside the panel) closes it.
    node.addEventListener('click', (event) => { if (event.target === node) close(); });
    node.addEventListener('close', () => {
      clearTimeout(timer); seq += 1; options = []; active = -1; painted = null;
      field.setAttribute('aria-expanded', 'false');
      field.removeAttribute('aria-activedescendant');
      const back = opener; opener = null;
      if (back && documentRef.contains(back) && !back.disabled) { try { back.focus(); } catch (_) { /* detached */ } }
    });
    return true;
  }

  return { open, close, install, run, isOpen: () => Boolean(dialog()?.open), get scope() { return scope; } };
}

/** Installs the command search and its window names (data-action targets, the keyboard handler, the AI panel). */
export function installCommandSearch({ root = globalThis, documentRef = root?.document } = {}) {
  if (!root || root._aioCommandSearch) return root?._aioCommandSearch || null;
  const search = createCommandSearch({ root, documentRef });
  const bind = () => search.install();
  if (!bind() && documentRef?.addEventListener) documentRef.addEventListener('DOMContentLoaded', bind, { once: true });
  root._aioCommandSearch = search;
  // Like the loader in compatibility-globals.js, it answers with a promise of the search (truthy for the key handler).
  root._aioOpenCommandSearch = (request) => { bind(); search.open(request); return Promise.resolve(search); };
  root._aioCommandSearchIsOpen = () => search.isOpen();
  return search;
}
