// P1431: the two connective pieces every analysis page uses — a section lead (what this section
// adds to the page's conclusion) and "이어서 볼 곳" (where the same reading continues, and why).
import { setResearchHandoff } from '../../app/research-handoff.js';

export function sectionLead(doc, text) {
  const node = doc.createElement('p');
  node.className = 'flow-lead';
  node.textContent = text || '';
  return node;
}

export function renderNextSteps(doc, host, items = []) {
  if (!host) return null;
  host.replaceChildren();
  host.hidden = !items.length;
  if (!items.length) return host;
  host.classList.add('flow-next');
  const head = doc.createElement('h2');
  head.className = 'flow-next-title';
  head.textContent = '이어서 볼 곳';
  const list = doc.createElement('ul');
  list.className = 'flow-next-list';
  const root = doc?.defaultView || globalThis;
  for (const item of items) {
    const li = doc.createElement('li');
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'flow-next-link';
    button.dataset.action = item.action || 'showPage';
    button.dataset.arg = item.arg || item.route;
    button.textContent = `${item.label} →`;
    // P1449: a link that names its own 조사 맥락 (종목·검색어·질문) carries it as a typed
    // handoff the destination route consumes once — not as the previous screen's leftovers.
    if (item.ctx && item.route) {
      button.dataset.hasCtx = '1';
      button.addEventListener('click', () => {
        setResearchHandoff({ root, routeId: item.route, context: item.ctx, label: item.label });
      });
    }
    const why = doc.createElement('span');
    why.className = 'flow-next-why';
    why.textContent = item.why || '';
    li.append(button, why);
    list.append(li);
  }
  host.append(head, list);
  return host;
}
