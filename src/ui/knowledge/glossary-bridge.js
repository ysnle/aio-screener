// P1472/P1474: the glossary and the learning screens share one concept source, and a glossary search
// also finds the frames, lessons and industry-map nodes that explain the term.
//  1. mergeConceptCore: canonical concepts replace a legacy glossary entry of the same term/alias, or are
//     added — one definition per concept across the product.
//  2. installGlossaryBridge: after the legacy modal renders a search, append "다른 학습 영역" results from
//     public-data/knowledge/search-index.json (loaded on first search) with links that open the surface.
import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';

const normalize = (text) => String(text || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[·/,]/g, ' ').replace(/\s+/g, ' ').trim();

export function mergeConceptCore(glossary, concepts = CONCEPT_CORE) {
  if (!Array.isArray(glossary)) return { replaced: 0, added: 0 };
  let replaced = 0;
  let added = 0;
  for (const concept of concepts) {
    const names = new Set([concept.term, ...concept.aliases, ...(concept.covers || [])].map(normalize).filter(Boolean));
    const existing = glossary.find((entry) => entry && (names.has(normalize(entry.term)) || names.has(normalize(String(entry.term).replace(/\s*\(.*$/, '')))));
    // Synonyms decide which legacy entry is replaced (names above); related names only help search find it.
    const alias = [...concept.aliases, ...(concept.covers || []), ...(concept.related || [])].join(' ');
    if (existing) {
      existing.def = concept.def;
      existing.alias = [existing.alias, alias].filter(Boolean).join(' ');
      existing.conceptId = concept.id;
      replaced += 1;
    } else {
      glossary.push({ term: concept.term, cat: concept.cat, def: concept.def, alias, conceptId: concept.id });
      added += 1;
    }
  }
  return { replaced, added };
}

// Ranked matches: exact title or key > title prefix/contains > key contains > text contains.
export function searchKnowledgeIndex(index, query, limit = 8) {
  const q = normalize(query);
  if (!q || q.length < 2 || !Array.isArray(index?.entries)) return [];
  const scored = [];
  for (const entry of index.entries) {
    const title = normalize(entry.title);
    const keys = (entry.keys || []).map(normalize);
    const text = normalize(entry.text);
    let score = 0;
    if (title === q || keys.includes(q)) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (title.includes(q)) score = 60;
    else if (keys.some((key) => key.includes(q))) score = 50;
    else if (text.includes(q)) score = 20;
    if (score) scored.push({ entry, score: score + (entry.surface === 'frame' || entry.surface === 'column' ? 5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title)).slice(0, limit).map((item) => ({ ...item.entry, score: item.score }));
}

function routeUrl(root, route) {
  const params = new URLSearchParams();
  Object.entries(route.params || {}).forEach(([key, value]) => { if (value != null && value !== '') params.set(key, value); });
  const base = root?.location ? `${root.location.pathname}` : '';
  return `${base}?${params.toString()}#${route.page}`;
}

export function installGlossaryBridge({ root = globalThis, documentRef = root.document } = {}) {
  if (!documentRef || root._aioGlossaryBridgeInstalled) return;
  root._aioGlossaryBridgeInstalled = true;
  try { if (Array.isArray(root.GLOSSARY)) root._aioGlossaryConceptMerge = mergeConceptCore(root.GLOSSARY); } catch (_) { /* legacy glossary absent */ }
  let index = null;
  let loading = null;
  const load = () => {
    if (index || loading) return loading;
    const fetchFn = root.fetch?.bind(root);
    if (!fetchFn) return null;
    loading = fetchFn('./public-data/knowledge/search-index.json').then((response) => (response.ok ? response.json() : null)).then((json) => { index = json; return json; }).catch(() => null);
    return loading;
  };
  const render = () => {
    const body = documentRef.getElementById('glossary-body');
    const input = documentRef.getElementById('glossary-search');
    if (!body || !input) return;
    body.querySelector('[data-glossary-cross]')?.remove();
    const query = String(input.value || '').trim();
    if (query.length < 2) return;
    if (!index) { const pending = load(); if (pending) pending.then(() => render()); return; }
    const results = searchKnowledgeIndex(index, query);
    const box = documentRef.createElement('section');
    box.dataset.glossaryCross = 'true';
    box.style.cssText = 'padding:12px 0 4px;border-top:2px solid var(--border-subtle);margin-top:8px;';
    const head = documentRef.createElement('div');
    head.style.cssText = 'font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;';
    head.textContent = results.length ? `다른 학습 영역 · ${results.length}건` : '다른 학습 영역 · 일치 항목 없음';
    box.appendChild(head);
    for (const entry of results) {
      const row = documentRef.createElement('a');
      row.href = routeUrl(root, entry.route);
      row.dataset.glossaryCrossId = entry.id;
      row.style.cssText = 'display:block;padding:7px 0;border-bottom:1px solid var(--surface-4);text-decoration:none;color:inherit;';
      const title = documentRef.createElement('div');
      title.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-primary);';
      title.textContent = entry.title;
      const meta = documentRef.createElement('div');
      meta.style.cssText = 'font-size:11px;color:var(--text-muted);margin:2px 0;';
      meta.textContent = [entry.surfaceLabel, entry.group].filter(Boolean).join(' · ');
      const text = documentRef.createElement('div');
      text.style.cssText = 'font-size:12px;color:var(--text-secondary);line-height:1.5;';
      text.textContent = entry.text;
      row.append(title, meta, text);
      row.addEventListener('click', (event) => {
        event.preventDefault();
        if (typeof root._aioCloseGlossary === 'function') root._aioCloseGlossary();
        // Pages read their selection from the URL when they mount. A different page mounts on showPage;
        // the page already on screen is reloaded at the new URL so it re-reads the selection.
        const samePage = root.AIO?.state?.activePage === entry.route.page;
        if (samePage || typeof root.showPage !== 'function') { root.location.assign(row.href); return; }
        root.history?.pushState?.(null, '', row.href);
        root.showPage(entry.route.page);
      });
      box.appendChild(row);
    }
    body.appendChild(box);
  };
  const attach = () => {
    const body = documentRef.getElementById('glossary-body');
    if (!body || body._aioCrossObserver) return Boolean(body);
    const observer = new root.MutationObserver((records) => {
      if (records.some((record) => [...record.addedNodes].some((node) => node.dataset?.glossaryCross))) return;
      render();
    });
    observer.observe(body, { childList: true });
    body._aioCrossObserver = observer;
    return true;
  };
  if (!attach()) documentRef.addEventListener('DOMContentLoaded', attach, { once: true });
}
