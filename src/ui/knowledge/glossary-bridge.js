// P1472/P1474: the glossary and the learning screens share one concept source, and a glossary search
// also finds the frames, lessons and industry-map nodes that explain the term.
//  1. mergeConceptCore: canonical concepts replace a legacy glossary entry of the same term/alias, or are
//     added — one definition per concept across the product.
//  2. installGlossaryBridge: after the legacy modal renders a search, append "다른 학습 영역" results from
//     public-data/knowledge/search-index.json (loaded on first search) with links that open the surface.
//     The ranker (knowledge-search.js) carries the learning-core notes, so it loads with the index on first
//     search instead of at boot.
import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';
import { appendScreenTerms } from '../../domain/knowledge/screen-term-additions.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { CONCEPT_SURFACES, SCREEN_TERMS, SCREEN_ROUTE_LABELS, screenRoutesFor } from '../../domain/knowledge/concept-surfaces.js';

// Shared with knowledge-search.js: one normalization for glossary merge and knowledge search.
export const normalize = (text) => String(text || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[·/,]/g, ' ').replace(/\s+/g, ' ').trim();

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

// v57.50 I18: a term that a screen measures (HY 스프레드 → 투자 심리, RSI → 차트, 시장 폭 → 시장 폭) also offers
// that screen, not only library notes. Keys: SCREEN_TERMS for market indicators, term + aliases for canonical concepts.
const CONCEPT_BY_ID = new Map(CONCEPT_CORE.map((concept) => [concept.id, concept]));
export function screenLinksForQuery(query) {
  const q = normalize(query);
  if (!q || q.length < 2) return [];
  const routes = new Map();
  for (const conceptId of Object.keys(CONCEPT_SURFACES)) {
    const screens = screenRoutesFor(conceptId).filter((route) => SCREEN_ROUTE_LABELS[route]);
    if (!screens.length) continue;
    const concept = CONCEPT_BY_ID.get(conceptId);
    const keys = (SCREEN_TERMS[conceptId] || (concept ? [concept.term, ...(concept.aliases || [])] : [])).map(normalize).filter(Boolean);
    if (!keys.some((key) => key === q || key.includes(q) || (key.length >= 3 && q.includes(key)))) continue;
    for (const route of screens) if (!routes.has(route)) routes.set(route, { route, label: SCREEN_ROUTE_LABELS[route], conceptId });
  }
  return [...routes.values()];
}

// v58.53 개편 v2 (3h): a glossary entry reads as definition → formula → limits → "이 개념이 쓰이는 화면". The parts are
// cut from the entry's own text (sentences), never written here: a sentence with "=" is the formula line, a later
// sentence that states a limit or a caution goes under 한계, the rest is the definition. A figure-source row
// (GLOSSARY_FIGURE_SOURCES) adds its condition to the limits and its source as the evidence line.
const LIMIT_WORDS = /않|아닙|아니|없습|없고|다를|달라|다릅|주의|한계|왜곡|민감|보장|빗나|착각|오해|과장|함께 봐|함께 봅|별도|단정/;
export function splitDefinition(def) {
  const sentences = String(def || '').trim().split(/(?<=[.!?])\s+(?=[^\d\s])/).filter(Boolean);
  const parts = { lead: [], formulas: [], limits: [] };
  sentences.forEach((sentence, index) => {
    if (/=/.test(sentence) && sentence.length <= 160) parts.formulas.push(sentence);
    else if (index > 0 && parts.lead.length && LIMIT_WORDS.test(sentence)) parts.limits.push(sentence);
    else parts.lead.push(sentence);
  });
  if (!parts.lead.length && parts.formulas.length) parts.lead.push(parts.formulas.shift());
  return parts;
}

export function screensForEntry(entry) {
  if (!entry) return [];
  const own = entry.conceptId ? screenRoutesFor(entry.conceptId).filter((route) => SCREEN_ROUTE_LABELS[route]).map((route) => ({ route, label: SCREEN_ROUTE_LABELS[route] })) : [];
  return own.length ? own : screenLinksForQuery(String(entry.term || '').replace(/\s*\(.*$/, '')).map(({ route, label }) => ({ route, label }));
}

export function glossaryEntryParts(entry, figureSources = null) {
  const parts = splitDefinition(entry?.def);
  const figure = figureSources?.[entry?.term] || null;
  if (figure?.cond) parts.limits.push(`수치 기준: ${figure.cond}`);
  return { ...parts, basis: figure ? [figure.kind, figure.src].filter(Boolean).join(' · ') : null, screens: screensForEntry(entry), conceptId: entry?.conceptId || null };
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
  try { if (Array.isArray(root.GLOSSARY)) { root._aioGlossaryScreenTerms = appendScreenTerms(root.GLOSSARY); root._aioGlossaryConceptMerge = mergeConceptCore(root.GLOSSARY); } } catch (_) { /* legacy glossary absent */ }
  // The classic renderer (js/aio-ui.js renderGlossaryItems) lays each entry out from these parts.
  root._aioGlossaryEntryParts = (entry) => glossaryEntryParts(entry, root.GLOSSARY_FIGURE_SOURCES || null);
  // Its "이 개념이 쓰이는 화면" buttons (data-action) close the glossary, then open the screen or the concept document.
  root._aioGlossaryOpenScreen = (route) => {
    if (typeof root._aioCloseGlossary === 'function') root._aioCloseGlossary();
    root.showPage?.(route);
  };
  root._aioGlossaryOpenConcept = (conceptId) => {
    if (typeof root._aioCloseGlossary === 'function') root._aioCloseGlossary();
    const route = { page: 'principles', params: { mode: 'concept', node: conceptId } };
    if (root.AIO?.state?.activePage === 'principles' || typeof root.showPage !== 'function') { root.location.assign(routeUrl(root, route)); return; }
    navigateKnowledgeRoute({ root, page: route.page, params: route.params });
  };
  let index = null;
  let loading = null;
  let searchIndex = () => [];
  const load = () => {
    if (index || loading) return loading;
    const fetchFn = root.fetch?.bind(root);
    if (!fetchFn) return null;
    // A failed load settles to an empty index; leaving it null re-queued render() on the settled promise forever.
    const indexJson = fetchFn('./public-data/knowledge/search-index.json').then((response) => (response.ok ? response.json() : null)).catch(() => null);
    loading = Promise.all([indexJson, import('./knowledge-search.js').catch(() => null)]).then(([json, search]) => {
      searchIndex = search?.searchKnowledgeIndex || (() => []);
      index = json && Array.isArray(json.entries) ? json : { entries: [] };
      return index;
    });
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
    const results = searchIndex(index, query);
    const screens = screenLinksForQuery(query);
    const box = documentRef.createElement('section');
    box.dataset.glossaryCross = 'true';
    box.className = 'glx-box'; // src/ui/styles/glossary-cross.css
    if (screens.length) {
      const screenRow = documentRef.createElement('div');
      screenRow.dataset.glossaryScreens = 'true';
      screenRow.className = 'glx-screens';
      screenRow.append('지금 값을 보는 화면');
      for (const screen of screens) {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'flow-next-link';
        button.dataset.glossaryScreenRoute = screen.route;
        button.textContent = `${screen.label} →`;
        button.addEventListener('click', () => {
          if (typeof root._aioCloseGlossary === 'function') root._aioCloseGlossary();
          root.showPage?.(screen.route);
        });
        screenRow.appendChild(button);
      }
      box.appendChild(screenRow);
    }
    const head = documentRef.createElement('div');
    head.className = 'glx-head';
    head.textContent = results.length ? `다른 학습 영역 · ${results.length}건` : '다른 학습 영역 · 일치 항목 없음';
    box.appendChild(head);
    for (const entry of results) {
      const row = documentRef.createElement('a');
      row.href = routeUrl(root, entry.route);
      row.dataset.glossaryCrossId = entry.id;
      row.className = 'glx-row';
      const title = documentRef.createElement('div');
      title.className = 'glx-title';
      title.textContent = entry.title;
      const meta = documentRef.createElement('div');
      meta.className = 'glx-meta';
      meta.textContent = [entry.surfaceLabel, entry.group].filter(Boolean).join(' · ');
      const text = documentRef.createElement('div');
      text.className = 'glx-text';
      text.textContent = entry.text;
      row.append(title, meta, text);
      row.addEventListener('click', (event) => {
        event.preventDefault();
        if (typeof root._aioCloseGlossary === 'function') root._aioCloseGlossary();
        // Pages read their selection from the URL when they mount. A different page mounts on showPage;
        // the page already on screen is reloaded at the new URL so it re-reads the selection.
        const samePage = root.AIO?.state?.activePage === entry.route.page;
        if (samePage || typeof root.showPage !== 'function') { root.location.assign(row.href); return; }
        // v57.50: pushState + showPage lost the selection (showPage strips the knowledge keys); keep it as the pending URL.
        navigateKnowledgeRoute({ root, page: entry.route.page, params: entry.route.params || {} });
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
