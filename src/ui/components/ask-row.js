// v59.56: one 'AI에게 묻기' row for every screen. v59.68 (owner 2026-11-03, "simple design … cut secondary labels"): the
// questions no longer draw a row under each section. A screen declares them as an inert <template> (no text on the page),
// and the one top AI panel shows the active screen's questions as its chips when it opens (ui/panels/ask-panel.js).
// Questions are [label, question] pairs built from the screen's own read; empty or null entries are skipped.
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
