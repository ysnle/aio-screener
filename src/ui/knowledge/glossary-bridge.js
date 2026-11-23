import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';
import { knowledgeRouteHref, navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { SCREEN_TERM_MARKED } from '../../domain/knowledge/screen-term-marked.js';
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
  return { ...parts, basis: figure ? [figure.kind, figure.src].filter(Boolean).join(', ') : null, screens: screensForEntry(entry), conceptId: entry?.conceptId || null };
}

function routeUrl(root, route) {
  return knowledgeRouteHref({ root, page: route.page, params: route.params || {} });
}

export function installGlossaryBridge({ root = globalThis, documentRef = root.document } = {}) {
  if (!documentRef || root._aioGlossaryBridgeInstalled) return;
  root._aioGlossaryBridgeInstalled = true;
  let arrived = null;
  const appendMarked = (glossary, entries) => {
    const key = (text) => String(text || '').toLowerCase().replace(/\s*\(.*$/, '').replace(/\s+/g, '');
    const known = new Set(glossary.map((entry) => key(entry?.term)));
    for (const entry of entries) if (!known.has(key(entry.term))) { glossary.push({ ...entry }); known.add(key(entry.term)); }
  };
  const deferred = () => import('../../domain/knowledge/deferred-screen-terms.js').then(({ DEFERRED_SCREEN_TERMS }) => DEFERRED_SCREEN_TERMS);
  root._aioGlossaryAugment = () => {
    if (!Array.isArray(root.GLOSSARY) || root._aioGlossaryAugmented) return root._aioGlossaryAugmented || Promise.resolve();
    arrived = root.GLOSSARY.map((entry) => ({ ...entry }));
    try { appendMarked(root.GLOSSARY, SCREEN_TERM_MARKED); root._aioGlossaryConceptMerge = mergeConceptCore(root.GLOSSARY); } catch (_) { /* legacy glossary absent */ }
    return (root._aioGlossaryAugmented = deferred().then((terms) => { if (!root._aioGlossaryFullDone) appendMarked(root.GLOSSARY, terms); }).catch(() => {}));
  };
  root._aioGlossaryFull = () => {
    if (!Array.isArray(root.GLOSSARY)) return Promise.resolve();
    if (root._aioGlossaryFullLoad) return root._aioGlossaryFullLoad;
    return (root._aioGlossaryFullLoad = Promise.all([import('../../domain/knowledge/screen-term-additions.js'), deferred(), root._aioGlossaryAugment()])
      .then(([{ appendScreenTerms }, terms]) => {
        if (!arrived) return;
        root.GLOSSARY.splice(0, root.GLOSSARY.length, ...arrived.map((entry) => ({ ...entry })));
        root._aioGlossaryScreenTerms = appendScreenTerms(root.GLOSSARY);
        root._aioGlossaryConceptMerge = mergeConceptCore(root.GLOSSARY);
        appendScreenTerms(root.GLOSSARY, terms);
        root._aioGlossaryFullDone = true;
      }).catch(() => {}));
  };
  root._aioGlossaryAugment();
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
}

let knowledgeLoad = null;
/** The generated knowledge index and its ranker (knowledge-search.js, bundle E): { index, search }; a failed fetch settles
 * to { index: null, search, failed: true } so the caller can say so instead of waiting. */
export function loadKnowledgeSearch(root = globalThis) {
  try { root.AIO?.loadGlossaryFull?.(); } catch (_) { /* the glossary rows are optional here */ }
  if (knowledgeLoad) return knowledgeLoad;
  // loadKnowledgeIndex(root) reads search-index.json once through the data layer and settles to an empty index on failure
  // (the command search then shows no research rows). A ranker module that did not load is a failed load that a later
  // query retries (it used to fall back to a direct fetch whose index nothing could search).
  const fetchIndex = (module) => (typeof module?.loadKnowledgeIndex === 'function'
    ? module.loadKnowledgeIndex(root)
    : Promise.reject(new Error('knowledge-search unavailable')));
  knowledgeLoad = import('./knowledge-search.js').catch(() => null).then((module) => Promise.all([
    Promise.resolve().then(() => fetchIndex(module)).then((json) => ({ json })).catch((error) => ({ error })), module
  ])).then(([loaded, module]) => {
    const search = module?.searchKnowledgeIndex || (() => []);
    if (loaded.error || !Array.isArray(loaded.json?.entries)) { knowledgeLoad = null; return { index: null, search, failed: true }; } // a retry may fetch again
    return { index: loaded.json, search, failed: false };
  });
  return knowledgeLoad;
}

/** Opens one knowledge index entry where it lives (the page re-reads its selection from the URL). */
export function openKnowledgeResult(root, entry) {
  if (!entry?.route) return;
  // A different page mounts on showPage; the page already on screen gets the new address (a hash step, popstate) and re-reads the selection.
  const samePage = root.AIO?.state?.activePage === entry.route.page;
  if (samePage || typeof root.showPage !== 'function') { root.location.assign(routeUrl(root, entry.route)); return; }
  navigateKnowledgeRoute({ root, page: entry.route.page, params: entry.route.params || {} });
}
