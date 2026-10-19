// Knowledge search ranker shared by the glossary modal and the research library. It folds the canonical
// learning-core notes into the generated search index (P1606: notes stay searchable before the Actions index
// rebuild), so it imports learning-core statically; the glossary loads this module on its first search.
import { LESSONS, PATHS } from '../../domain/knowledge/learning-core.js';
import { normalize } from './glossary-bridge.js';

// Ranked matches: exact title or key > title prefix/contains > key contains > text contains.
export function searchKnowledgeIndex(index, query, limit = 8) {
  const q = normalize(query);
  if (!q || q.length < 2) return [];
  // P1606: canonical local notes remain searchable before the Actions index rebuild.
  const entries = new Map((index?.entries || []).map((entry) => [entry.id, entry]));
  for (const lesson of LESSONS) {
    const id = `frame:${lesson.id}`, previous = entries.get(id);
    entries.set(id, { ...previous, id, surface: 'frame', surfaceLabel: '분석 노트', title: lesson.issue, text: lesson.answer.slice(0, 240), group: PATHS.find((path) => path.id === lesson.path)?.title || null, keys: [...new Set([...(previous?.keys || []), lesson.title, ...(lesson.concepts || [])])], route: { page: 'principles', params: { mode: 'frames', node: lesson.id } } });
  }
  const scored = [];
  for (const entry of entries.values()) {
    const title = normalize(entry.title);
    const keys = (entry.keys || []).map(normalize);
    const text = normalize(entry.text);
    let score = 0;
    if (title === q || keys.includes(q)) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (title.includes(q)) score = 60;
    else if (keys.some((key) => key.includes(q))) score = 50;
    else if (text.includes(q)) score = 20;
    if (score) scored.push({ entry, score: score + (entry.surface === 'frame' || entry.surface === 'column' ? 5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title)).slice(0, limit).map((item) => ({ ...item.entry, score: item.score }));
}
