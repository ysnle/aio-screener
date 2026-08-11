function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function renderKnowledgePath(documentRef, path, nodes = [], { activeIndex = 0, onSelect = () => {} } = {}) {
  const root = element(documentRef, 'nav', 'knowledge-path');
  root.setAttribute('aria-label', path?.title || '학습 경로');
  const list = element(documentRef, 'ol', 'knowledge-path-list');
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const [index, nodeId] of (path?.nodeIds || []).entries()) {
    const node = byId.get(nodeId);
    const button = element(documentRef, 'button', `knowledge-path-step${index === activeIndex ? ' is-active' : ''}`, node?.title || nodeId);
    button.type = 'button';
    button.setAttribute('aria-current', index === activeIndex ? 'step' : 'false');
    button.addEventListener('click', () => onSelect(index));
    const item = element(documentRef, 'li', 'knowledge-path-item');
    item.appendChild(button);
    list.appendChild(item);
  }
  root.appendChild(list);
  return root;
}
