// 2026-10-05 owner decision: 리서치 라이브러리 — one skeleton for the three research pages
// (개념·분석, 산업 지도, 대가 보유 종목): a header with the page name, one line on what the page
// answers and one search across every research surface; below it 목차 · 본문 · 연결 in three columns.
// The skeleton owns layout and search only; each page fills the three columns with its own content.
import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';
import { searchKnowledgeIndex } from './glossary-bridge.js';
import { createStorageGateway } from '../../platform/storage.js';
import { createAppKnowledgeLearningState } from '../../app/knowledge-learning-state.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { refreshSharedArtifact, SCENARIO_STATE } from '../../data/shared-artifacts.js';

// v57.55 review (2e, beginner panel): two ways in before the 400-book shelf — the start of the column series (written as a
// sequence from money to the stock market) and the notes that match the next release the 오늘/거시 screens are waiting for.
const EVENT_TOPICS = Object.freeze([
  [/cpi|pce|ppi|물가/i, ['물가', '디스인플레이션', '금리']],
  [/fomc|연준|금리 결정/i, ['정책금리', '금리', '채권']],
  [/고용|nfp|jobs|실업/i, ['고용', '실업', '경기']],
  [/ism|gdp|소매|retail/i, ['경기', '성장', '매출']]
]);
export function readingPicks(entries, scenario) {
  const docs = (entries || []).filter((entry) => entry?.route?.page && entry.title);
  const first = docs.filter((entry) => entry.surface === 'column').slice(0, 5);
  const event = scenario?.crossroads?.nextEvent;
  const topics = event ? (EVENT_TOPICS.find(([pattern]) => pattern.test(`${event.id} ${event.name}`))?.[1] || []) : [];
  const today = topics.length ? docs.filter((entry) => topics.some((word) => String(entry.title).includes(word))).slice(0, 4) : [];
  return { first, today, eventLabel: event?.name || null };
}

export const RESEARCH_PAGES = Object.freeze([
  { route: 'principles', title: '개념·분석', summary: '쟁점별 분석 노트, 개념 정의, 원리 레슨, 칼럼' },
  { route: 'atlas', title: '산업 지도', summary: '산업 분야별 구조와 관계, 기업 역할, AI 기초' },
  { route: 'masters', title: '대가 보유 종목', summary: '운용 방식별 비교와 분기 보유 변화' }
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
.rl-shelf{margin:0 0 22px;padding:0 0 16px;border-bottom:1px solid var(--border-subtle)}
.rl-shelf>summary{list-style:none;cursor:pointer;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 14px;padding:2px 0 14px}
.rl-shelf>summary::-webkit-details-marker{display:none}
.rl-shelf-name{font-family:var(--font-display);font-size:22px;font-weight:600;letter-spacing:-.01em;color:var(--text-primary)}
.rl-shelf-stats{font-size:12.5px;color:var(--text-secondary);font-variant-numeric:tabular-nums}
.rl-shelf-stats b{font-weight:700;color:var(--text-primary)}
.rl-shelf-toggle{margin-left:auto;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border-subtle)}
.rl-picks{display:grid;gap:8px;margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--border)}.rl-picks-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}.rl-picks-label{font-size:12px;font-weight:700;color:var(--text-secondary);margin-right:4px}.rl-picks-item{font:inherit;font-size:13px;min-height:28px;padding:3px 10px;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);color:var(--text-primary);cursor:pointer;text-align:left}.rl-picks-item:hover{border-color:var(--text-primary)}
.rl-shelf-tools{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 18px;margin:0 0 6px}
.rl-shelf-chips{display:flex;flex-wrap:wrap;gap:6px}
.rl-shelf-legend{margin:0 0 2px;font-size:12px;color:var(--text-muted)}
.rl-shelf-legend[hidden]{display:none}
.rl-shelf-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border-subtle);border-radius:999px;background:var(--bg-card,#fbf9f5);padding:5px 12px 5px 10px;font:inherit;font-size:12.5px;color:var(--text-secondary);cursor:pointer;min-height:30px;transition:border-color .15s ease,background-color .15s ease}
.rl-shelf-chip i{width:9px;height:9px;border-radius:2px;background:var(--chip-tone,var(--text-muted));flex:none}
.rl-shelf-chip span{font-size:11.5px;color:var(--text-muted);font-variant-numeric:tabular-nums}
.rl-shelf-chip:hover{border-color:var(--text-muted)}
.rl-shelf-chip[aria-pressed="true"]{background:var(--text-primary);border-color:var(--text-primary);color:var(--bg-card,#fbf9f5);font-weight:700}
.rl-shelf-chip[aria-pressed="true"] span{color:inherit;opacity:.72}
.rl-shelf-sort{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border-subtle)}
.rl-shelf-sort-label{font-size:11.5px;color:var(--text-muted);padding:0 6px 0 5px}
.rl-shelf-seg{border:0;background:none;border-radius:6px;padding:4px 10px;font:inherit;font-size:12px;color:var(--text-secondary);cursor:pointer;min-height:26px}
.rl-shelf-seg[aria-pressed="true"]{background:var(--bg-card,#fbf9f5);color:var(--text-primary);font-weight:700;box-shadow:0 1px 2px rgba(33,29,22,.14)}
.rl-shelf-chip:focus-visible,.rl-shelf-seg:focus-visible,.rl-spine:focus-visible,.rl-shelf-btn:focus-visible,.rl-shelf-more:focus-visible,.rl-book-close:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.rl-shelf-stage{position:relative}
.rl-shelf-tier{display:flex;align-items:flex-end;gap:2px;padding:22px 12px 0;min-height:236px}
.rl-shelf-plank{height:13px;margin:0 0 20px;border-radius:2px 2px 4px 4px;background:linear-gradient(180deg,var(--rl-plank-top,#ded1ba) 0,var(--rl-plank,#c9b797) 70%,var(--rl-plank-edge,#b29f7e) 100%);box-shadow:0 7px 12px -7px rgba(33,29,22,.5)}
body.dark-theme .rl-shelf-plank{--rl-plank-top:#45403a;--rl-plank:#36322c;--rl-plank-edge:#2a2722}
.rl-shelf-gap{flex:0 0 16px}
.rl-spine{position:relative;flex:0 0 auto;border:0;padding:0;margin:0;border-radius:3px 3px 1px 1px;color:var(--ink,#f6f1e7);font:inherit;cursor:pointer;background-color:var(--tone);background-image:linear-gradient(90deg,rgba(255,255,255,.16) 0,rgba(255,255,255,.05) 11%,rgba(0,0,0,0) 38%,rgba(0,0,0,.07) 76%,rgba(0,0,0,.28) 100%);box-shadow:1px 0 0 rgba(0,0,0,.16);transition:transform .2s cubic-bezier(.2,.7,.3,1),box-shadow .2s ease}
.rl-spine::before,.rl-spine::after{content:"";position:absolute;left:5px;right:5px;height:4px;border-top:1px solid currentColor;border-bottom:1px solid currentColor;opacity:.38}
.rl-spine::before{top:10px}
.rl-spine::after{bottom:10px}
.rl-spine-title{position:absolute;top:24px;bottom:24px;left:0;right:0;display:flex;justify-content:center}
.rl-spine-title span{writing-mode:vertical-rl;font-family:var(--font-display);font-size:12px;font-weight:600;line-height:1.38;letter-spacing:.02em;max-height:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.rl-spine-ribbon{position:absolute;top:-2px;right:5px;width:7px;height:22px;background:#efe1bd;clip-path:polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)}
.rl-spine:hover,.rl-spine:focus-visible{transform:translateY(-10px);box-shadow:0 12px 14px -9px rgba(33,29,22,.55)}
.rl-spine[aria-current="true"]{transform:translateY(-16px);box-shadow:0 14px 18px -9px rgba(33,29,22,.6)}
.rl-shelf-more{display:block;margin:-6px auto 4px;border:1px solid var(--border-subtle);border-radius:999px;background:var(--bg-card,#fbf9f5);padding:6px 16px;font:inherit;font-size:12px;color:var(--text-secondary);cursor:pointer;min-height:32px}
.rl-shelf-tip{position:absolute;z-index:5;pointer-events:none;max-width:280px;padding:8px 11px;border-radius:6px;background:#211d16;color:#f7f4ee;font-size:12.5px;line-height:1.45;box-shadow:0 10px 24px rgba(0,0,0,.24)}
.rl-shelf-tip small{display:block;margin-top:3px;font-size:11px;color:#d6cdbd}
.rl-shelf-tip[hidden]{display:none}
body.dark-theme .rl-shelf-tip{background:#f0f0ed;color:#1b1d20}
body.dark-theme .rl-shelf-tip small{color:#4d4a44}
.rl-book{display:grid;grid-template-columns:210px minmax(0,1fr);margin:6px 0 4px;border:1px solid var(--border-subtle);border-radius:10px;background:var(--bg-card,#fbf9f5);overflow:hidden;box-shadow:0 14px 34px -20px rgba(33,29,22,.5)}
.rl-book[hidden]{display:none}
.rl-book-cover{display:flex;flex-direction:column;justify-content:space-between;gap:16px;padding:20px 18px 16px;color:#f6f1e7;background-color:var(--tone);background-image:radial-gradient(rgba(246,241,231,.12) 1px,transparent 1.5px),linear-gradient(90deg,rgba(0,0,0,.24),rgba(0,0,0,0) 9%);background-size:10px 10px,100% 100%}
.rl-book-plate{border:1px solid rgba(246,241,231,.55);border-radius:4px;padding:16px 12px 14px;text-align:center;background:rgba(0,0,0,.14)}
.rl-book-plate small{display:block;font-size:10.5px;letter-spacing:.16em;opacity:.88}
.rl-book-plate i{display:block;width:34px;height:1px;margin:10px auto;background:rgba(246,241,231,.6)}
.rl-book-plate strong{display:block;font-family:var(--font-display);font-size:15px;font-weight:600;line-height:1.45}
.rl-book-cover-foot{font-size:11.5px;line-height:1.4;opacity:.9}
.rl-book-body{position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;padding:18px 22px 18px 20px}
.rl-book-tags{display:flex;flex-wrap:wrap;gap:6px;padding-right:34px}
.rl-book-tag{font-size:11px;padding:2px 9px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border-subtle);color:var(--text-secondary)}
.rl-book-body h3{font-family:var(--font-display);font-size:19px;font-weight:600;line-height:1.42;margin:0;color:var(--text-primary)}
.rl-book-body p{margin:0;font-size:13.5px;line-height:1.72;color:var(--text-secondary)}
.rl-book-status{font-size:12px;color:var(--text-muted)}
.rl-book-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:6px}
.rl-book-close{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;border-radius:6px;background:none;color:var(--text-muted);font:inherit;font-size:20px;line-height:1;cursor:pointer}
.rl-book-close:hover{background:var(--surface-2);color:var(--text-primary)}
.rl-shelf-btn{border:1px solid var(--border-subtle);border-radius:6px;background:var(--bg-card,#fbf9f5);padding:8px 16px;font:inherit;font-size:12.5px;color:var(--text-primary);cursor:pointer;white-space:nowrap;min-height:36px}
.rl-shelf-btn:hover{border-color:var(--text-muted)}
.rl-shelf-btn.is-primary{background:var(--text-primary);border-color:var(--text-primary);color:var(--bg-card,#fbf9f5);font-weight:700}
.rl-ask-selection{position:fixed;z-index:60;border:1px solid var(--text-primary);border-radius:6px;background:var(--text-primary);color:var(--bg-card,#fbf9f5);padding:7px 12px;font:inherit;font-size:12px;font-weight:700;box-shadow:0 8px 20px rgba(33,29,22,.25);cursor:pointer;min-height:32px}
.rl-ask-selection[hidden]{display:none}
@media (max-width: 720px){.rl-shelf-chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -12px;padding:0 12px 4px}.rl-shelf-chips::-webkit-scrollbar{display:none}.rl-shelf-chip{flex:none}.rl-book{grid-template-columns:minmax(0,1fr)}.rl-book-cover{flex-direction:row;align-items:center;padding:14px}.rl-book-plate{flex:1}.rl-book-cover-foot{display:none}.rl-shelf-tier{min-height:216px;padding:20px 6px 0}.rl-shelf-name{font-size:20px}}
@media (prefers-reduced-motion: reduce){.rl-spine,.rl-shelf-chip{transition:none}.rl-spine:hover,.rl-spine:focus-visible,.rl-spine[aria-current="true"]{transform:none}}
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
  // v57.50: pushState + showPage lost the selection (showPage strips the knowledge keys); the pending route URL keeps it.
  if (typeof root.showPage === 'function') navigateKnowledgeRoute({ root, page: route.page, params: route.params || {} });
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
  input.placeholder = '궁금한 단어 검색 (예: ROIC, HBM)';
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
  // P1642 (owner reference 2026-10-12, a "read later" list turned into a library) and P1674 (owner
  // 2026-10-13, the same library on video): every document is a spine on a shelf — the title runs down
  // the spine, the tint is its topic group, a light band marks what this browser has opened. Chips pick
  // the collection, a spine opens a card with the excerpt, and the card opens the document or asks AI.
  const shelf = el(doc, 'details', 'rl-shelf');
  const prefs = createStorageGateway({ prefix: 'aio' });
  const shelfPref = prefs.get('research_shelf');
  // X17 (2026-10-13): browsing and reading are different moments. With no document chosen the shelf is the
  // way in (remembered open/closed); once a document is open the text comes first and the shelf folds to its
  // one-line summary — on a phone it otherwise pushed the chosen document several screens down.
  // P1681: the graph view (mode=graph&node=…) is browsing, not reading — it keeps the shelf.
  const locationQuery = String(root?.location?.search || '');
  // 2026-10-14 audit: on a phone the shelf starts folded unless the reader opened it before. A bare mode=frames is not
  // a chosen document (mount rewrites a fresh #principles to it), so the shelf stays the way in there.
  const documentOpen = /[?&](?:node|chapter|lesson|domain|manager)=/.test(locationQuery) && !/[?&]mode=graph(?:&|$)/.test(locationQuery);
  let narrowView = false;
  try { narrowView = Boolean(root?.matchMedia?.('(max-width: 720px)')?.matches); } catch (_) { narrowView = false; }
  shelf.open = documentOpen ? false : shelfPref ? shelfPref === 'open' : !narrowView;
  shelf.addEventListener('toggle', () => { if (!documentOpen) prefs.set('research_shelf', shelf.open ? 'open' : 'closed'); });
  const shelfTitle = el(doc, 'summary', null, '서가 · 컬렉션 불러오는 중');
  const shelfBody = el(doc, 'div', 'rl-shelf-body');
  shelf.append(shelfTitle, shelfBody);
  loadIndex(root).then((index) => renderShelf(doc, root, { shelfTitle, shelfBody, prefs, entries: index?.entries || [], currentPage: route, onLocal }));
  shell.append(head, shelf, grid);
  attachSelectionAsk(doc, root, main, route);
  revealActiveNav(nav); // runs after this task, once the view has filled the TOC
  return { shell, nav, main, aside, input };
}

// The one top AI panel answers every question (owner 2026-10-12): fill its input and leave sending to the
// reader, so nothing here spends the shared AI budget by itself.
export function askLibraryAi(root, prompt, context = 'principles') {
  const doc = root?.document;
  if (!doc || !prompt) return false;
  try { if (typeof root.updateAIPanelContext === 'function') root.updateAIPanelContext(context); } catch (_) { /* context label is optional */ }
  const panel = doc.getElementById('ai-panel');
  if (panel && !panel.classList.contains('open') && typeof root.toggleAIPanel === 'function') root.toggleAIPanel();
  const fill = () => {
    const input = doc.getElementById('ai-panel-inp');
    if (!input) return;
    input.value = prompt;
    input.dispatchEvent(new root.Event('input', { bubbles: true }));
    input.focus();
  };
  if (typeof root.setTimeout === 'function') root.setTimeout(fill, 120); else fill();
  return true;
}

// Gloss-style reading: select a passage in the open document and ask about it.
function attachSelectionAsk(doc, root, main, route) {
  const view = doc.defaultView || root;
  const button = el(doc, 'button', 'rl-ask-selection', '선택한 문장 AI에게 묻기');
  button.type = 'button';
  button.hidden = true;
  let passage = '';
  const hide = () => {
    button.hidden = true; passage = '';
    // A re-rendered page builds a new shell; the old one drops its listener and button.
    if (!main.isConnected) { view.removeEventListener?.('scroll', hide); button.remove(); }
  };
  const place = () => {
    const selection = view.getSelection?.();
    const text = String(selection?.toString() || '').replace(/\s+/g, ' ').trim();
    if (!selection || selection.rangeCount === 0 || text.length < 6 || text.length > 600 || !main.contains(selection.anchorNode)) { hide(); return; }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) { hide(); return; }
    passage = text;
    if (!button.isConnected) { doc.querySelectorAll('.rl-ask-selection').forEach((node) => node.remove()); doc.body.appendChild(button); }
    button.hidden = false;
    const width = button.offsetWidth || 180;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), (view.innerWidth || 800) - width - 8);
    const below = rect.bottom + 8 + 36 < (view.innerHeight || 600);
    button.style.left = `${Math.round(left)}px`;
    button.style.top = `${Math.round(below ? rect.bottom + 8 : Math.max(8, rect.top - 44))}px`;
  };
  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(place, 160); };
  main.addEventListener('mouseup', schedule);
  main.addEventListener('keyup', schedule);
  main.addEventListener('touchend', schedule);
  view.addEventListener?.('scroll', hide, { passive: true });
  button.addEventListener('mousedown', (event) => event.preventDefault()); // keep the selection while clicking
  button.addEventListener('click', () => {
    const title = main.querySelector('.rl-doc-title, h1, h2, h3')?.textContent?.trim() || '이 글';
    const quoted = passage.length > 400 ? `${passage.slice(0, 400)}…` : passage;
    askLibraryAi(root, `「${title}」에서 이 문장을 쉬운 말로 풀어 설명하고, 이 주장이 성립하지 않을 조건도 알려줘. 문장: "${quoted}"`, route);
    view.getSelection?.()?.removeAllRanges?.();
    hide();
  });
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

// One hue family per collection; topic groups step through its bindings (deep, mid, pale, deep with a
// shifted hue) so a collection reads as one set with visible topics. Deep bindings carry a light title
// (lightness at most 34%), pale ones a dark title (lightness at least 80%); both stay above 4.5:1.
const COLLECTION_HUES = Object.freeze({
  frame: [252, 30], column: [352, 34], 'principles-lesson': [150, 26], 'principles-node': [210, 30],
  'atlas-node': [30, 34], 'atlas-foundation': [182, 32], manager: [36, 10]
});
const hashOf = (text) => { let h = 0; for (const ch of String(text || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
function toneFor(entry, groupIndex = 0, { deep = false } = {}) {
  const [hue, sat] = COLLECTION_HUES[entry.surface] || [28, 18];
  const jitter = (hashOf(entry.id) % 3) - 1;
  const variant = deep ? groupIndex % 2 * 3 : groupIndex % 4;
  if (variant === 2) return { bg: `hsl(${hue + jitter * 3} ${Math.min(48, sat + 14)}% ${84 + jitter}%)`, ink: '#2a2620' };
  const shift = variant === 3 ? 14 : 0;
  const light = variant === 1 ? 31 : 25;
  return { bg: `hsl(${hue + shift + jitter * 4} ${sat}% ${light + jitter * 2}%)`, ink: '#f6f1e7' };
}
const collectionTone = (surface) => { const [hue, sat] = COLLECTION_HUES[surface] || [28, 18]; return `hsl(${hue} ${sat}% 34%)`; };

const SHELF_SORTS = Object.freeze([['topic', '주제'], ['title', '제목'], ['unread', '안 읽은 글']]);
const SHELF_ROWS = 3;
const READ_KEY = 'research_read';
const READ_LIMIT = 600;
// Older pages record opened documents in the learning state under their own ids; count those as read too.
const LEGACY_VIEWED = Object.freeze({
  frame: (id) => `principles-frame:${id}`,
  'principles-lesson': (id) => `principles:${id}`,
  'principles-node': (id) => `principles-node:${id}`,
  'atlas-node': (id) => `atlas-node:${id}`
});
let shelfCollection = null; // a collection the reader picked this session; otherwise the open document's

function readIds(prefs) {
  try {
    const list = JSON.parse(prefs.get(READ_KEY) || '[]');
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []);
  } catch (_) {
    return new Set();
  }
}
function markRead(prefs, id) {
  const ids = readIds(prefs);
  if (!ids.has(id)) { ids.add(id); prefs.set(READ_KEY, JSON.stringify([...ids].slice(-READ_LIMIT))); }
  return ids;
}
function legacyViewed(root) {
  try { return createAppKnowledgeLearningState(root).snapshot().progress || {}; } catch (_) { return {}; }
}
// The document the page has open, from the same URL params the search index routes to.
function openEntry(entries, page, search) {
  const params = new URLSearchParams(search || '');
  return entries
    .filter((entry) => entry.route?.page === page && Object.keys(entry.route.params || {}).length
      && Object.entries(entry.route.params).every(([key, value]) => params.get(key) === String(value)))
    .sort((a, b) => Object.keys(b.route.params).length - Object.keys(a.route.params).length)[0] || null;
}
// The spine shows the main title (before " — ") in one column, cut from the end with "…" so its start stays readable;
// the full title is the spine's accessible name and its hover/focus tip. v57.79 (UI review): a two-column title broke
// mid-phrase and the second column read as a stray fragment ("의 구분", "전이", "감소"). Size follows that text and a
// stable per-document variation, and encodes nothing else.
function spineShape(entry) {
  const chars = [...String(entry.title).split(' — ')[0].trim()];
  const perColumn = Math.min(15, Math.max(8, chars.length));
  const shown = chars.length > perColumn ? `${chars.slice(0, perColumn - 1).join('').trimEnd()}…` : chars.join('');
  const h = hashOf(entry.id);
  return { shown, width: 40 + (h % 4) * 4, height: Math.round(48 + perColumn * 12.5 + (h % 5) * 3) };
}

function renderShelf(doc, root, { shelfTitle, shelfBody, prefs, entries, currentPage, onLocal }) {
  const docs = entries.filter((entry) => entry?.route?.page && entry.title);
  if (!docs.length) { shelfTitle.textContent = '서가'; return; }
  const view = doc.defaultView || root;
  const open = openEntry(docs, currentPage, root?.location?.search);
  let read = open ? markRead(prefs, open.id) : readIds(prefs);
  const legacy = legacyViewed(root);
  const isRead = (entry) => read.has(entry.id)
    || Boolean(LEGACY_VIEWED[entry.surface] && legacy[LEGACY_VIEWED[entry.surface](String(entry.id).split(':').slice(1).join(':'))]?.viewed);
  const rank = (surface) => { const at = SURFACE_ORDER.indexOf(surface); return at < 0 ? SURFACE_ORDER.length : at; };
  const bySurface = new Map();
  for (const entry of docs) {
    if (!bySurface.has(entry.surface)) bySurface.set(entry.surface, { surface: entry.surface, label: entry.surfaceLabel || entry.surface, items: [], groups: [] });
    const collection = bySurface.get(entry.surface);
    collection.items.push(entry);
    if (entry.group && !collection.groups.includes(entry.group)) collection.groups.push(entry.group);
  }
  const collections = [...bySurface.values()].sort((a, b) => rank(a.surface) - rank(b.surface));
  const groupCount = new Set(docs.map((entry) => `${entry.surface}/${entry.group}`)).size;
  const toneOf = (entry, options) => toneFor(entry, Math.max(0, bySurface.get(entry.surface).groups.indexOf(entry.group)), options);
  const pageDefault = collections.find((collection) => collection.items[0].route.page === currentPage);
  let active = shelfCollection === 'all' || collections.some((collection) => collection.surface === shelfCollection)
    ? shelfCollection : (open?.surface || pageDefault?.surface || collections[0].surface);
  const savedSort = prefs.get('research_shelf_sort');
  let sort = SHELF_SORTS.some(([key]) => key === savedSort) ? savedSort : 'topic';
  let selected = open;
  let expanded = false;

  const tools = el(doc, 'div', 'rl-shelf-tools');
  const chips = el(doc, 'div', 'rl-shelf-chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', '컬렉션');
  const sorts = el(doc, 'div', 'rl-shelf-sort');
  sorts.setAttribute('role', 'group');
  sorts.setAttribute('aria-label', '정렬');
  // 2026-10-14 audit: the spine shade is the topic group inside a collection; say so once next to the chips.
  // Shades repeat across distant groups, so the line names neighbouring spines and shows only in topic order.
  const legend = el(doc, 'p', 'rl-shelf-legend', '같은 색 묶음 = 같은 주제');
  tools.append(chips, sorts);
  const stage = el(doc, 'div', 'rl-shelf-stage');
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', '책장 — 화살표 키로 이동, Enter로 책 펼치기');
  const tip = el(doc, 'div', 'rl-shelf-tip');
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');
  const book = el(doc, 'section', 'rl-book');
  book.hidden = true;
  book.setAttribute('aria-live', 'polite');
  const picks = el(doc, 'div', 'rl-picks');
  const drawPicks = () => {
    const chosen = readingPicks(docs, root?.[SCENARIO_STATE.key]);
    const rows = [['처음이라면', chosen.first], [chosen.eventLabel ? `다음 발표(${chosen.eventLabel.replace(/\s*\(.*\)\s*$/, '')})와 이어지는 글` : null, chosen.today]].filter(([label, items]) => label && items.length);
    picks.replaceChildren(...rows.map(([label, items]) => {
      const row = el(doc, 'div', 'rl-picks-row');
      row.append(el(doc, 'span', 'rl-picks-label', label), ...items.map((entry) => {
        const go = el(doc, 'button', 'rl-picks-item', entry.title);
        go.type = 'button';
        go.addEventListener('click', () => openResearchRoute(root, entry.route, { currentPage, onLocal }));
        return go;
      }));
      return row;
    }));
    picks.hidden = !rows.length;
  };
  drawPicks();
  refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed) drawPicks(); }).catch(() => {});
  shelfBody.replaceChildren(picks, tools, legend, stage, book);

  const stat = (value, unit) => { const span = el(doc, 'span'); span.append(el(doc, 'b', null, String(value)), doc.createTextNode(unit)); return span; };
  const updateTitle = () => {
    const done = docs.filter(isRead).length;
    const stats = el(doc, 'span', 'rl-shelf-stats');
    const parts = [stat(docs.length, '편'), stat(collections.length, '개 컬렉션'), stat(groupCount, '개 주제')];
    if (done) parts.push(stat(done, '편 읽음'));
    parts.forEach((part, index) => { if (index) stats.appendChild(doc.createTextNode(' · ')); stats.appendChild(part); });
    const toggle = el(doc, 'span', 'rl-shelf-toggle', shelfBody.parentElement?.open === false ? '펼치기' : '접기');
    shelfTitle.replaceChildren(el(doc, 'span', 'rl-shelf-name', '서가'), stats, toggle);
  };
  shelfBody.parentElement?.addEventListener('toggle', () => { updateTitle(); if (shelfBody.parentElement.open) drawShelf(); });

  const drawTools = () => {
    chips.replaceChildren(...[{ surface: 'all', label: '전체', items: docs }, ...collections].map((collection) => {
      const button = el(doc, 'button', 'rl-shelf-chip');
      button.type = 'button';
      if (collection.surface !== 'all') { const swatch = el(doc, 'i'); swatch.style.setProperty('--chip-tone', collectionTone(collection.surface)); button.appendChild(swatch); }
      button.append(doc.createTextNode(collection.label), el(doc, 'span', null, String(collection.items.length)));
      button.setAttribute('aria-pressed', collection.surface === active ? 'true' : 'false');
      button.addEventListener('click', () => { active = collection.surface; shelfCollection = active; expanded = false; drawTools(); drawShelf(); });
      return button;
    }));
    const label = el(doc, 'span', 'rl-shelf-sort-label', '정렬');
    label.setAttribute('aria-hidden', 'true');
    sorts.replaceChildren(label, ...SHELF_SORTS.map(([key, text]) => {
      const button = el(doc, 'button', 'rl-shelf-seg', text);
      button.type = 'button';
      button.setAttribute('aria-pressed', key === sort ? 'true' : 'false');
      button.addEventListener('click', () => { sort = key; prefs.set('research_shelf_sort', key); drawTools(); drawShelf(); });
      return button;
    }));
  };
  const visible = () => {
    const list = [...(active === 'all' ? docs : bySurface.get(active)?.items || [])];
    if (sort === 'title') return list.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    if (sort === 'unread') return list.sort((a, b) => Number(isRead(a)) - Number(isRead(b)));
    // Topic order keeps each collection's authored order inside a group (Array.sort is stable).
    return list.sort((a, b) => rank(a.surface) - rank(b.surface) || String(a.group || '').localeCompare(String(b.group || ''), 'ko'));
  };
  const spines = () => [...stage.querySelectorAll('.rl-spine')];
  const showTip = (spine, entry) => {
    tip.replaceChildren(doc.createTextNode(entry.title), el(doc, 'small', null, [entry.surfaceLabel, entry.group ? `주제 ${entry.group}` : null, isRead(entry) ? '읽음' : null].filter(Boolean).join(' · ')));
    tip.hidden = false;
    const s = spine.getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    const width = tip.offsetWidth;
    tip.style.left = `${Math.round(Math.min(Math.max(0, s.left - box.left + s.width / 2 - width / 2), box.width - width))}px`;
    tip.style.top = `${Math.round(s.top - box.top - tip.offsetHeight - 8)}px`;
  };
  const hideTip = () => { tip.hidden = true; };
  const openBook = (entry) => {
    selected = entry;
    for (const spine of spines()) spine.setAttribute('aria-current', spine.dataset.entry === entry.id ? 'true' : 'false');
    const tone = toneOf(entry, { deep: true }).bg; // the cover always takes a deep binding under its light lettering
    const cover = el(doc, 'div', 'rl-book-cover');
    cover.style.setProperty('--tone', tone);
    const plate = el(doc, 'div', 'rl-book-plate');
    plate.append(el(doc, 'small', null, '리서치 라이브러리'), el(doc, 'i'), el(doc, 'strong', null, entry.surfaceLabel || '문서'));
    cover.append(plate, el(doc, 'span', 'rl-book-cover-foot', entry.group || ''));
    const body = el(doc, 'div', 'rl-book-body');
    const tags = el(doc, 'div', 'rl-book-tags');
    [entry.surfaceLabel, entry.group].filter(Boolean).forEach((tag) => tags.appendChild(el(doc, 'span', 'rl-book-tag', tag)));
    const close = el(doc, 'button', 'rl-book-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '책 닫기');
    close.addEventListener('click', () => {
      book.hidden = true;
      const spine = spines().find((node) => node.dataset.entry === entry.id);
      spine?.focus();
    });
    const actions = el(doc, 'div', 'rl-book-actions');
    const openButton = el(doc, 'button', 'rl-shelf-btn is-primary', '읽기');
    openButton.type = 'button';
    openButton.addEventListener('click', () => {
      read = markRead(prefs, entry.id);
      openResearchRoute(root, entry.route, { currentPage, onLocal });
    });
    const askButton = el(doc, 'button', 'rl-shelf-btn', 'AI에게 이 글 묻기');
    askButton.type = 'button';
    askButton.addEventListener('click', () => askLibraryAi(root,
      `「${entry.title}」(${entry.surfaceLabel || '리서치 라이브러리'})의 핵심 논리를 3~5줄로 정리하고, 이 관점이 틀릴 수 있는 조건과 함께 확인할 지표를 알려줘.`, currentPage));
    actions.append(openButton, askButton);
    body.append(tags, close, el(doc, 'h3', null, entry.title), el(doc, 'p', null, entry.text || ''),
      el(doc, 'span', 'rl-book-status', isRead(entry) ? '이 브라우저에서 읽은 글' : '아직 열지 않은 글'), actions);
    book.replaceChildren(cover, body);
    book.hidden = false;
    const rect = book.getBoundingClientRect();
    if (rect.bottom > (view.innerHeight || 0) && typeof book.scrollIntoView === 'function') book.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const makeSpine = (entry) => {
    const shape = spineShape(entry);
    const spine = el(doc, 'button', 'rl-spine');
    spine.type = 'button';
    spine.dataset.entry = entry.id;
    const tone = toneOf(entry);
    spine.style.setProperty('--tone', tone.bg);
    spine.style.setProperty('--ink', tone.ink);
    spine.style.width = `${shape.width}px`;
    spine.style.height = `${shape.height}px`;
    const title = el(doc, 'span', 'rl-spine-title');
    title.appendChild(el(doc, 'span', null, shape.shown));
    spine.appendChild(title);
    if (isRead(entry)) { spine.classList.add('is-read'); spine.appendChild(el(doc, 'span', 'rl-spine-ribbon')); }
    spine.setAttribute('aria-label', `${entry.title} — ${[entry.surfaceLabel, entry.group ? `주제 ${entry.group}` : null].filter(Boolean).join(' · ')}${isRead(entry) ? ' · 읽음' : ''}`);
    spine.setAttribute('aria-current', selected?.id === entry.id ? 'true' : 'false');
    spine.tabIndex = -1;
    spine.addEventListener('click', () => openBook(entry));
    spine.addEventListener('pointerenter', () => showTip(spine, entry));
    spine.addEventListener('pointerleave', hideTip);
    spine.addEventListener('focus', () => showTip(spine, entry));
    spine.addEventListener('blur', hideTip);
    return { node: spine, width: shape.width };
  };
  // Pack the spines into shelf tiers that fit the stage width; the first three tiers show until the
  // reader asks for the rest.
  let packedWidth = 0;
  const drawShelf = () => {
    hideTip();
    const list = visible();
    legend.hidden = sort !== 'topic';
    const width = Math.max(260, (stage.clientWidth || 880) - 24);
    packedWidth = stage.clientWidth;
    const tiers = [[]];
    let used = 0;
    let lastGroup = null;
    for (const entry of list) {
      const spine = makeSpine(entry);
      const gap = sort === 'topic' && lastGroup !== null && entry.group !== lastGroup ? 16 : 0;
      if (used + gap + spine.width > width && tiers.at(-1).length) { tiers.push([]); used = 0; }
      else if (gap) { const spacer = el(doc, 'span', 'rl-shelf-gap'); spacer.setAttribute('aria-hidden', 'true'); tiers.at(-1).push(spacer); used += gap; }
      tiers.at(-1).push(spine.node);
      used += spine.width + 2;
      lastGroup = entry.group;
    }
    const selectedTier = tiers.findIndex((tier) => tier.some((node) => node.dataset?.entry === selected?.id));
    const limit = expanded ? tiers.length : Math.max(SHELF_ROWS, selectedTier + 1);
    const nodes = [];
    tiers.slice(0, limit).forEach((tier) => {
      const row = el(doc, 'div', 'rl-shelf-tier');
      row.append(...tier);
      const plank = el(doc, 'div', 'rl-shelf-plank');
      plank.setAttribute('aria-hidden', 'true');
      nodes.push(row, plank);
    });
    if (tiers.length > limit) {
      const hiddenCount = tiers.slice(limit).reduce((sum, tier) => sum + tier.filter((node) => node.dataset?.entry).length, 0);
      const more = el(doc, 'button', 'rl-shelf-more', `${hiddenCount}편 더 보기`);
      more.type = 'button';
      more.addEventListener('click', () => { expanded = true; drawShelf(); });
      nodes.push(more);
    }
    stage.replaceChildren(...nodes, tip);
    const all = spines();
    const current = all.find((spine) => spine.dataset.entry === selected?.id) || all[0];
    if (current) current.tabIndex = 0;
    if (selected && !list.includes(selected)) book.hidden = true;
    updateTitle();
  };
  stage.addEventListener('keydown', (event) => {
    const all = spines();
    const at = all.indexOf(doc.activeElement);
    if (at < 0) return;
    if (event.key === 'Escape') { book.hidden = true; return; }
    const next = event.key === 'ArrowRight' ? at + 1 : event.key === 'ArrowLeft' ? at - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? all.length - 1 : null;
    if (next == null || !all[next]) return;
    event.preventDefault();
    all[at].tabIndex = -1;
    all[next].tabIndex = 0;
    all[next].focus();
  });
  if (typeof view.ResizeObserver === 'function') {
    let timer = null;
    const observer = new view.ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!stage.isConnected) { observer.disconnect(); return; }
        if (Math.abs(stage.clientWidth - packedWidth) > 40) drawShelf();
      }, 150);
    });
    observer.observe(stage);
  }
  drawTools();
  drawShelf();
}
