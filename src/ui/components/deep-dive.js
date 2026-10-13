// P1660: one renderer for the teaching fold ("더 깊이 보기 · 원리와 읽는 법") used across pages. The content is
// static domain text (src/domain/content/axis-deep-dives.js); `extra` nodes (today's remaining numbers, next
// checks) go after the teaching blocks and before the links to the page that goes deeper.
export function deepDiveFold(doc, root, title, deep, extra = []) {
  if (!doc || (!deep && !extra.length)) return null;
  const node = (tag, text, className) => { const item = doc.createElement(tag); if (text != null) item.textContent = text; if (className) item.className = className; return item; };
  const details = node('details', null, 'regime-axis-details regime-axis-deep');
  details.append(node('summary', `${title ? `${title} ` : ''}더 깊이 보기 · 원리와 읽는 법`));
  for (const [heading, text] of deep?.blocks || []) details.append(node('h4', heading), node('p', text));
  details.append(...extra.filter(Boolean));
  for (const [route, label] of deep?.related || []) {
    const link = node('button', `${label} →`, 'flow-next-link');
    link.type = 'button';
    link.addEventListener('click', () => root?.showPage?.(route));
    details.append(link);
  }
  return details;
}
