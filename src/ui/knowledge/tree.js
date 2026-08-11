function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function renderKnowledgeTree(documentRef, sections = [], { selectedId = '', onSelect = () => {} } = {}) {
  const root = element(documentRef, 'div', 'knowledge-tree');
  for (const section of sections) {
    const group = element(documentRef, 'section', 'knowledge-tree-section');
    group.appendChild(element(documentRef, 'h4', 'knowledge-tree-title', section.title));
    const list = element(documentRef, 'div', 'knowledge-tree-items');
    for (const node of section.nodes || []) {
      const button = element(documentRef, 'button', `knowledge-tree-item${node.id === selectedId ? ' is-selected' : ''}`, node.title);
      button.type = 'button';
      button.setAttribute('aria-pressed', node.id === selectedId ? 'true' : 'false');
      button.addEventListener('click', () => onSelect(node.id));
      list.appendChild(button);
    }
    group.appendChild(list);
    root.appendChild(group);
  }
  return root;
}
