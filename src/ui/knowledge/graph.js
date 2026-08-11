function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function renderKnowledgeGraphTextAlternative(documentRef, nodes = [], edges = []) {
  const root = element(documentRef, 'section', 'knowledge-graph-text-alternative');
  root.setAttribute('aria-label', '지식 그래프 텍스트 관계 설명');
  root.appendChild(element(documentRef, 'h4', 'knowledge-graph-title', '관계 텍스트 목록'));
  const list = element(documentRef, 'ul', 'knowledge-graph-list');
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    const from = byId.get(edge.from)?.title || edge.from;
    const to = byId.get(edge.to)?.title || edge.to;
    list.appendChild(element(documentRef, 'li', 'knowledge-graph-item', `${from} → ${to} · ${edge.type || edge.relation || '관계'}`));
  }
  root.appendChild(list);
  return root;
}
