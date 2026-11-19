import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { INDICATOR_NOTES } from '../../domain/content/indicator-notes.js';

// The one line a market screen's 계산 방법 fold ends with: the indicator's principle note in the research library
// (src/domain/content/indicator-notes.js). The screen keeps the calculation; the library owns the teaching.
export function principleLink(doc, root, id, label) {
  const params = INDICATOR_NOTES[id];
  if (!doc || !params) return null;
  const link = doc.createElement('button');
  link.type = 'button'; link.className = 'flow-next-link';
  link.textContent = `${label} 원리 글 →`;
  link.dataset.aioPrinciple = params.node || params.lesson;
  link.addEventListener('click', () => navigateKnowledgeRoute({ root, page: 'principles', params }));
  return link;
}
