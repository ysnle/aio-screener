import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';

const CONCEPT_TERMS = new Map(CONCEPT_CORE.map((concept) => [concept.id, concept.term]));

// P1660: one renderer for the teaching fold ("더 깊이 보기 · 원리와 읽는 법") used across pages. The content is
// static domain text (src/domain/content/axis-deep-dives.js); `extra` nodes (today's remaining numbers, next
// checks) go after the teaching blocks and before the links to the page that goes deeper.
// v57.50 I17: a fold that teaches a canonical concept (deep.conceptId, a CONCEPT_CORE id) ends with the link to
// that concept's note in the research library, so the fold is not a dead end that only leads to other screens.
export function deepDiveFold(doc, root, title, deep, extra = []) {
  if (!doc || (!deep && !extra.length)) return null;
  const node = (tag, text, className) => { const item = doc.createElement(tag); if (text != null) item.textContent = text; if (className) item.className = className; return item; };
  const details = node('details', null, 'regime-axis-details regime-axis-deep');
  details.append(node('summary', `${title ? `${title} ` : ''}더 깊이 보기 · 원리와 읽는 법`));
  for (const [heading, text] of deep?.blocks || []) details.append(node('h4', heading), node('p', text));
  details.append(...extra.filter(Boolean), ...deepDiveLinks(doc, root, deep));
  return details;
}

// v58.53 개편 v2: the fold's onward links on their own, for layouts that spread the teaching blocks into cards
// (시장 상태 axis rows) and still end with the page that goes deeper and the concept note.
export function deepDiveLinks(doc, root, deep) {
  if (!doc || !deep) return [];
  const links = [];
  for (const [route, label] of deep.related || []) {
    const link = doc.createElement('button');
    link.textContent = `${label} →`; link.className = 'flow-next-link'; link.type = 'button';
    link.addEventListener('click', () => root?.showPage?.(route));
    links.push(link);
  }
  const conceptTerm = deep.conceptId ? CONCEPT_TERMS.get(deep.conceptId) : null;
  if (conceptTerm) {
    const link = doc.createElement('button');
    link.textContent = `개념 노트 · ${conceptTerm} →`; link.className = 'flow-next-link'; link.type = 'button';
    link.dataset.aioConceptId = deep.conceptId;
    link.addEventListener('click', () => navigateKnowledgeRoute({ root, page: 'principles', params: { mode: 'concept', node: deep.conceptId } }));
    links.push(link);
  }
  return links;
}
