export function askRow(doc, questions) {
  const list = (questions || []).filter((item) => Array.isArray(item) && item[0] && item[1]);
  if (!doc || !list.length) return null;
  const node = doc.createElement('template');
  node.className = 'aio-ask-questions';
  node.dataset.questions = JSON.stringify(list);
  return node;
}

/** The active screen's declared questions, in page order, each label once. */
export function pageQuestions(doc, limit = 4) {
  const page = doc?.querySelector?.('.page.active');
  if (!page) return [];
  const seen = new Set();
  const out = [];
  for (const node of page.querySelectorAll('template.aio-ask-questions')) {
    let list = [];
    try { list = JSON.parse(node.dataset.questions || '[]'); } catch (_) { list = []; }
    for (const [label, question] of list) {
      if (seen.has(label)) continue;
      seen.add(label);
      out.push([label, question]);
    }
  }
  return out.slice(0, limit);
}
