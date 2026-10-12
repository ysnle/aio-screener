// 2026-10-05 owner decision: 리서치 라이브러리 — one skeleton for the three research pages
// (개념·분석 프레임, 산업·밸류체인, 운용사·13F): a header with the page name, one line on what the page
// answers and one search across every research surface; below it 목차 · 본문 · 연결 in three columns.
// The skeleton owns layout and search only; each page fills the three columns with its own content.
import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';
import { searchKnowledgeIndex } from './glossary-bridge.js';
import { createStorageGateway } from '../../platform/storage.js';

export const RESEARCH_PAGES = Object.freeze([
  { route: 'principles', title: '개념·분석 프레임', summary: '쟁점별 분석 노트, 개념 정의, 원리 레슨, 칼럼' },
  { route: 'atlas', title: '산업·밸류체인', summary: '산업 분야별 구조와 관계, 기업 역할, AI 기초' },
  { route: 'masters', title: '운용사·13F', summary: '운용 방식별 비교와 분기 보유 변화' }
]);

const STYLE = `
.rl-shell{--rl-gap:22px;color:var(--text-primary)}
.rl-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,420px);gap:18px;align-items:end;padding:4px 0 16px;border-bottom:1px solid var(--border-subtle);margin-bottom:18px}
.rl-kicker{font-size:11px;letter-spacing:.08em;color:var(--text-muted);margin:0 0 6px}
.rl-title{font-family:var(--font-display);font-size:24px;font-weight:600;line-height:1.25;margin:0}
.rl-sub{font-size:13px;color:var(--text-secondary);margin:6px 0 0}
.rl-pages{display:flex;gap:16px;margin:10px 0 0}
.rl-page-link{border:0;background:none;padding:0 0 3px;font-size:12px;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent}
.rl-page-link.is-current{color:var(--text-primary);font-weight:700;border-bottom-color:var(--accent)}
.rl-search{position:relative}
.rl-search input{width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border-subtle);border-radius:4px;background:var(--surface-1);font-size:13px;color:var(--text-primary)}
.rl-search input:focus{outline:2px solid var(--accent);outline-offset:1px}
.rl-results{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 4px);background:var(--bg-card, #fbf9f5);border:1px solid var(--border-subtle);border-radius:4px;box-shadow:0 8px 24px rgba(33,29,22,.12);max-height:420px;overflow:auto}
.rl-results[hidden]{display:none}
.rl-result{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border-subtle);background:none;padding:8px 12px;cursor:pointer}
.rl-result:hover,.rl-result:focus{background:var(--surface-2)}
.rl-result-title{font-size:13px;font-weight:600;color:var(--text-primary)}
.rl-result-meta{font-size:11px;color:var(--text-muted);margin-top:1px}
.rl-result-summary{padding:6px 12px;border-bottom:1px solid var(--border-subtle);margin:0}
.rl-result-text{font-size:12px;color:var(--text-secondary);margin-top:2px;line-height:1.45}
.rl-grid{display:grid;grid-template-columns:minmax(200px,236px) minmax(0,1fr) minmax(240px,300px);gap:var(--rl-gap);align-items:start}
.rl-nav{position:sticky;top:12px;max-height:calc(100vh - 140px);overflow:auto;padding-right:6px}
.rl-aside{position:sticky;top:12px;max-height:calc(100vh - 140px);overflow:auto}
.rl-main{min-width:0}
.rl-nav-group{margin:0 0 16px}
.rl-nav-title{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--text-secondary);margin:0 0 4px;display:flex;justify-content:space-between}
.rl-nav-title span{font-weight:400;color:var(--text-muted)}
.rl-nav-item{display:block;width:100%;text-align:left;border:0;border-left:2px solid transparent;background:none;padding:5px 8px;font-size:13px;line-height:1.4;color:var(--text-secondary);cursor:pointer}
.rl-nav-item:hover{background:var(--surface-2)}
.rl-nav-switch{display:flex;flex-direction:column;gap:2px;margin:0 0 14px;padding:0 0 10px;border-bottom:1px solid var(--border-subtle)}
.rl-nav-group:empty{display:none}
.rl-nav-group-head{font-weight:700;color:var(--text-primary);font-size:13px;padding:7px 8px;border-left:0}
.rl-nav-group-head[aria-expanded="true"]{border-left:2px solid var(--accent);background:var(--accent-soft)}
.rl-pager{display:flex;justify-content:space-between;gap:12px;margin:22px 0 0;padding-top:12px;border-top:1px solid var(--border-subtle)}
.rl-pager .rl-nav-item{width:auto;border:0}
.rl-nav-item.is-active,.rl-nav-item[aria-pressed="true"],.rl-nav-item[aria-current="true"]{border-left-color:var(--accent);color:var(--text-primary);font-weight:700;background:var(--accent-soft)}
.rl-nav-sub{padding-left:12px}
.rl-nav-meta{display:block;font-size:11px;font-weight:400;color:var(--text-muted);line-height:1.35;margin-top:1px}
.rl-doc-kicker{font-size:11px;color:var(--text-muted);margin:0 0 4px;letter-spacing:.02em}
.rl-doc-title{font-family:var(--font-display);font-size:20px;font-weight:600;margin:0 0 10px;line-height:1.35}
.rl-doc-lead{font-size:14px;line-height:1.65;margin:0 0 14px;padding:10px 12px;border-left:3px solid var(--accent);background:var(--surface-1)}
.rl-h{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--text-secondary);margin:18px 0 6px}
.rl-copy{font-size:13px;line-height:1.65;color:var(--text-secondary);margin:0 0 8px}
.rl-aside-block{border-top:1px solid var(--border-subtle);padding:10px 0 6px}
.rl-aside-block:first-child{border-top:0;padding-top:0}
.rl-aside-title{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--text-secondary);margin:0 0 6px}
.rl-link{display:block;width:100%;text-align:left;border:0;background:none;padding:3px 0;font-size:13px;color:var(--text-primary);cursor:pointer;text-decoration:underline;text-underline-offset:2px;line-height:1.45}
.rl-note{font-size:12px;color:var(--text-muted);line-height:1.5;margin:6px 0 0}
.rl-chip{display:inline-block;font-size:11px;padding:2px 7px;margin:0 4px 4px 0;border:1px solid var(--border-subtle);border-radius:3px;color:var(--text-secondary)}
.rl-chip.is-on{border-color:var(--accent);color:var(--text-primary);font-weight:700}
.rl-main .af-root .af-shell{grid-template-columns:minmax(0,1fr)}
.rl-main .af-root .af-nav,.rl-main .af-root .af-side{display:none}
.rl-shelf{margin:0 0 18px;border-bottom:1px solid var(--border-subtle);padding-bottom:12px}
.rl-shelf>summary{font-size:12px;font-weight:700;color:var(--text-secondary);cursor:pointer;margin-bottom:8px}
.rl-shelf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
.rl-shelf-card{display:flex;flex-direction:column;gap:6px;text-align:left;border:1px solid var(--border-subtle);border-radius:6px;background:var(--surface-1);padding:10px 10px 8px;cursor:pointer;font:inherit;color:var(--text-primary)}
.rl-shelf-card:hover,.rl-shelf-card:focus-visible{border-color:var(--accent)}
.rl-shelf-name{font-size:13px;font-weight:700}
.rl-shelf-meta{font-size:11px;color:var(--text-muted)}
.rl-shelf-spines{display:flex;align-items:flex-end;gap:2px;height:44px;border-bottom:3px solid var(--border)}
.rl-shelf-spines span{flex:1 1 0;min-width:2px;max-width:7px;border-radius:1px 1px 0 0}
@media (max-width: 1366px){.rl-grid{grid-template-columns:minmax(180px,200px) minmax(0,1fr) minmax(220px,240px)}}
`;

export function ensureResearchStyle(doc) {
  if (!doc?.head || doc.getElementById('aio-research-shell-style')) return;
  const style = doc.createElement('style');
  style.id = 'aio-research-shell-style';
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

export function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

let indexPromise = null;
function loadIndex(root) {
  if (!indexPromise) {
    const fetchFn = root?.fetch?.bind(root);
    indexPromise = fetchFn ? fetchFn('./public-data/knowledge/search-index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null);
  }
  return indexPromise;
}

const normalize = (text) => String(text || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
// Codex browser audit H52: concepts were listed first regardless of fit, so the note whose title is
// "…ROIC" sat below four loosely related concepts in a scrolled box. Concepts are scored on the same
// scale as the index (exact name 100 · title 60 · synonym/covered term 50 · related 15) and merged.
function conceptMatches(query, limit = 6) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored = [];
  for (const concept of CONCEPT_CORE) {
    const title = normalize(concept.term);
    const names = [...concept.aliases, ...(concept.covers || [])].map(normalize);
    let score = 0;
    if (title === q || names.includes(q)) score = 100;
    else if (title.includes(q)) score = 60;
    else if (names.some((name) => name.includes(q))) score = 50;
    else if ([...(concept.related || []), ...(concept.contrast || [])].some((name) => normalize(name).includes(q))) score = 15;
    if (score) scored.push({ concept, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
    .map(({ concept, score }) => ({ id: `concept:${concept.id}`, surface: 'concept', surfaceLabel: '개념', group: concept.cat, title: concept.term, text: concept.def.slice(0, 120), score, route: { page: 'principles', params: { mode: 'concept', node: concept.id } } }));
}
const SURFACE_ORDER = ['frame', 'column', 'concept', 'principles-lesson', 'principles-node', 'atlas-node', 'atlas-foundation', 'manager'];

export function routeHref(root, route) {
  const params = new URLSearchParams();
  Object.entries(route?.params || {}).forEach(([key, value]) => { if (value != null && value !== '') params.set(key, value); });
  return `${root?.location?.pathname || ''}?${params.toString()}#${route.page}`;
}

// Navigate to a research surface. The current page handles its own params without a reload.
export function openResearchRoute(root, route, { currentPage, onLocal } = {}) {
  if (!route?.page) return;
  if (route.page === currentPage && typeof onLocal === 'function') { onLocal(route.params || {}); return; }
  root.history?.pushState?.(null, '', routeHref(root, route));
  if (typeof root.showPage === 'function') root.showPage(route.page);
  else root.location.assign(routeHref(root, route));
}

export function createResearchShell(doc, { root = globalThis, route, lead = null, onLocal = null } = {}) {
  ensureResearchStyle(doc);
  const page = RESEARCH_PAGES.find((item) => item.route === route) || RESEARCH_PAGES[0];
  const shell = el(doc, 'section', 'rl-shell');
  shell.dataset.researchPage = route;
  const head = el(doc, 'header', 'rl-head');
  const titleBox = el(doc, 'div');
  const pages = el(doc, 'nav', 'rl-pages');
  pages.setAttribute('aria-label', '리서치 라이브러리 페이지');
  for (const item of RESEARCH_PAGES) {
    const link = el(doc, 'button', `rl-page-link${item.route === route ? ' is-current' : ''}`, item.title);
    link.type = 'button';
    link.setAttribute('aria-current', item.route === route ? 'page' : 'false');
    link.addEventListener('click', () => { if (item.route !== route) openResearchRoute(root, { page: item.route, params: {} }); });
    pages.appendChild(link);
  }
  // The hub tab bar above already switches pages and the breadcrumb names the hub; the shell header
  // carries only the page title, what it answers and the search.
  void pages;
  titleBox.append(el(doc, 'h1', 'rl-title', page.title), el(doc, 'p', 'rl-sub', lead || page.summary));
  const search = el(doc, 'div', 'rl-search');
  const input = el(doc, 'input');
  input.type = 'search';
  input.placeholder = '노트·칼럼·개념·레슨·산업·운용사 검색 (예: ROIC, HBM, 합산비율)';
  input.setAttribute('aria-label', '리서치 라이브러리 통합 검색');
  const results = el(doc, 'div', 'rl-results');
  results.hidden = true;
  results.setAttribute('role', 'listbox');
  const run = async () => {
    const query = input.value.trim();
    if (query.length < 2) { results.hidden = true; results.replaceChildren(); return; }
    const index = await loadIndex(root);
    if (input.value.trim() !== query) return;
    const pool = [...conceptMatches(query), ...searchKnowledgeIndex(index, query, 40)];
    const rank = (item) => { const at = SURFACE_ORDER.indexOf(item.surface); return at < 0 ? SURFACE_ORDER.length : at; };
    const items = pool.sort((a, b) => (b.score || 0) - (a.score || 0) || rank(a) - rank(b)).slice(0, 12);
    results.replaceChildren();
    if (!items.length) results.appendChild(el(doc, 'div', 'rl-result', '일치하는 항목이 없습니다.'));
    else {
      const counts = new Map();
      pool.forEach((item) => counts.set(item.surfaceLabel, (counts.get(item.surfaceLabel) || 0) + 1));
      results.appendChild(el(doc, 'div', 'rl-result-meta rl-result-summary', `찾은 범위 · ${[...counts].map(([label, n]) => `${label} ${n}`).join(' · ')}${pool.length > items.length ? ` — 상위 ${items.length}개 표시` : ''}`));
    }
    for (const item of items) {
      const row = el(doc, 'button', 'rl-result');
      row.type = 'button';
      row.setAttribute('role', 'option');
      row.dataset.researchResult = item.id;
      row.append(el(doc, 'div', 'rl-result-title', item.title), el(doc, 'div', 'rl-result-meta', [item.surfaceLabel, item.group].filter(Boolean).join(' · ')), el(doc, 'div', 'rl-result-text', item.text));
      row.addEventListener('click', () => { results.hidden = true; input.value = ''; openResearchRoute(root, item.route, { currentPage: route, onLocal }); });
      results.appendChild(row);
    }
    results.hidden = false;
  };
  let timer = null;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Escape') { results.hidden = true; input.blur(); } });
  input.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 180));
  search.append(input, results);
  head.append(titleBox, search);
  const grid = el(doc, 'div', 'rl-grid');
  const nav = el(doc, 'nav', 'rl-nav');
  nav.setAttribute('aria-label', `${page.title} 목차`);
  const main = el(doc, 'div', 'rl-main');
  const aside = el(doc, 'aside', 'rl-aside');
  aside.setAttribute('aria-label', '연결');
  grid.append(nav, main, aside);
  // P1642 (owner reference 2026-10-12, a "read later" list turned into a library): the collections as
  // shelves — each spine is one document, its height its length, its tint its topic group.
  const shelf = el(doc, 'details', 'rl-shelf');
  const prefs = createStorageGateway({ prefix: 'aio' });
  const shelfPref = prefs.get('research_shelf');
  shelf.open = shelfPref ? shelfPref === 'open' : !root?.location?.search?.includes('node=');
  shelf.addEventListener('toggle', () => { prefs.set('research_shelf', shelf.open ? 'open' : 'closed'); });
  const shelfTitle = el(doc, 'summary', null, '서가 · 컬렉션 불러오는 중');
  const shelfGrid = el(doc, 'div', 'rl-shelf-grid');
  shelf.append(shelfTitle, shelfGrid);
  loadIndex(root).then((index) => renderShelf(doc, root, { shelfTitle, shelfGrid, entries: index?.entries || [], currentPage: route, onLocal }));
  shell.append(head, shelf, grid);
  revealActiveNav(nav); // runs after this task, once the view has filled the TOC
  return { shell, nav, main, aside, input };
}

// P1592 (F75): the TOC is its own scroll box; after a render, bring the selected entry into it so the
// reader sees where the open document sits (a lesson deep in a 52-item list stayed off-screen).
export function revealActiveNav(nav) {
  const view = nav?.ownerDocument?.defaultView;
  const reveal = () => {
    const active = nav?.querySelector?.('.rl-nav-item[aria-pressed="true"], .rl-nav-item.is-active');
    if (!active || !(nav.scrollHeight > nav.clientHeight)) return;
    const top = active.offsetTop; // .rl-nav is sticky, so it is the offset parent
    if (top < nav.scrollTop || top + active.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = Math.max(0, top - nav.clientHeight / 3);
  };
  // A timer, not requestAnimationFrame: it also runs in a background tab, after the view has attached the shell.
  if (typeof view?.setTimeout === 'function') view.setTimeout(reveal, 0); else reveal();
}

export function navGroup(doc, title, count = null) {
  const group = el(doc, 'div', 'rl-nav-group');
  const head = el(doc, 'p', 'rl-nav-title', title);
  if (count != null) head.appendChild(el(doc, 'span', null, String(count)));
  group.appendChild(head);
  return group;
}

export function asideBlock(doc, title) {
  const block = el(doc, 'div', 'rl-aside-block');
  block.appendChild(el(doc, 'p', 'rl-aside-title', title));
  return block;
}

const SHELF_TINTS = ['#8a6f4e', '#5b7a8c', '#7c6a92', '#5f8a6e', '#9a6158', '#6d7b4f', '#4f6f9a', '#8c7a3e'];
function tintFor(group) { let h = 0; for (const ch of String(group || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return SHELF_TINTS[h % SHELF_TINTS.length]; }

function renderShelf(doc, root, { shelfTitle, shelfGrid, entries, currentPage, onLocal }) {
  const bySurface = new Map();
  for (const entry of entries) {
    if (!entry?.route?.page) continue;
    const key = entry.surfaceLabel || entry.surface;
    if (!bySurface.has(key)) bySurface.set(key, []);
    bySurface.get(key).push(entry);
  }
  const rank = (surface) => { const at = SURFACE_ORDER.indexOf(surface); return at < 0 ? SURFACE_ORDER.length : at; };
  const collections = [...bySurface].sort((a, b) => rank(a[1][0].surface) - rank(b[1][0].surface));
  if (!collections.length) { shelfTitle.textContent = '서가'; return; }
  shelfTitle.textContent = `서가 · ${collections.length}개 컬렉션 · ${entries.length}편`;
  shelfGrid.replaceChildren(...collections.map(([label, items]) => {
    const card = el(doc, 'button', 'rl-shelf-card');
    card.type = 'button';
    card.dataset.shelf = items[0].surface;
    const groups = new Set(items.map((item) => item.group).filter(Boolean));
    const spines = el(doc, 'div', 'rl-shelf-spines');
    spines.setAttribute('aria-hidden', 'true');
    const step = Math.max(1, Math.ceil(items.length / 40));
    const lengths = items.map((item) => String(item.text || '').length);
    const longest = Math.max(1, ...lengths);
    items.filter((_, i) => i % step === 0).forEach((item) => {
      const spine = el(doc, 'span');
      spine.style.height = `${Math.round(38 + 62 * String(item.text || '').length / longest)}%`;
      spine.style.background = tintFor(item.group);
      spines.append(spine);
    });
    card.append(spines, el(doc, 'span', 'rl-shelf-name', label), el(doc, 'span', 'rl-shelf-meta', `${items.length}편${groups.size ? ` · 주제 ${groups.size}개` : ''}`));
    card.title = `${label} — 첫 문서부터 열기`;
    card.addEventListener('click', () => openResearchRoute(root, items[0].route, { currentPage, onLocal }));
    return card;
  }));
}
