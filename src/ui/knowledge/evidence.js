function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function renderKnowledgeEvidence(documentRef, sourceIds = [], registry = null) {
  const root = element(documentRef, 'section', 'knowledge-evidence');
  root.appendChild(element(documentRef, 'h5', 'knowledge-evidence-title', '근거와 직접성'));
  const list = element(documentRef, 'ul', 'knowledge-evidence-list');
  for (const sourceId of sourceIds) {
    const source = registry?.resolve?.(sourceId) || registry?.byId?.get?.(sourceId);
    const item = element(documentRef, 'li', 'knowledge-evidence-item');
    if (!source?.url) item.appendChild(element(documentRef, 'span', 'knowledge-evidence-unresolved', `${sourceId} · 확인 필요`));
    else {
      const link = element(documentRef, 'a', 'knowledge-evidence-link', `${sourceId} · ${source.title}`);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link, element(documentRef, 'span', 'knowledge-evidence-role', ` · ${source.sourceRole || 'REFERENCE'}`));
    }
    list.appendChild(item);
  }
  if (!sourceIds.length) list.appendChild(element(documentRef, 'li', 'knowledge-evidence-unresolved', '직접 연결된 출처 없음 · 현재 주장으로 승격하지 않음'));
  root.appendChild(list);
  return root;
}
