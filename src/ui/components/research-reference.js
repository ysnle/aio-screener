// The researched reference rows (domain/research/reference.js) as one compact block: a kicker that says these are
// researched values with their own dates, then one row per figure — label, value, change against its prior, date, the
// one-phrase meaning — and a 데이터 출처 fold with each source and the last check day. The block sits beside the
// automated data it explains and never feeds a score; a reader with no current row gets nothing (no empty frame).
import { el } from './dom.js';
import { foldSummary, markFold } from './indicator-face.js';
import { RESEARCH_WORDS } from '../../domain/research/words.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { researchReferenceView } from '../../data/research-reference.js';

function rowNode(doc, row) {
  const li = el(doc, 'li', null, 'research-ref__row');
  li.dataset.research = row.id;
  const head = el(doc, 'span', null, 'research-ref__label');
  head.append(doc.createTextNode(row.period ? `${row.label} ${row.period}` : row.label));
  if (row.forecast) head.append(doc.createTextNode(' '), el(doc, 'span', RESEARCH_WORDS.forecast, 'research-ref__tag is-forecast'));
  const value = el(doc, 'strong', row.value.text, 'research-ref__value');
  const date = el(doc, 'span', row.date.text, 'research-ref__date');
  li.append(head, doc.createTextNode(' '), value);
  if (row.change.text) li.append(doc.createTextNode(' · '), el(doc, 'span', row.change.text, 'research-ref__change'));
  if (row.record) li.append(doc.createTextNode(' · '), el(doc, 'span', row.record, 'research-ref__record'));
  li.append(doc.createTextNode(' · '), date);
  if (row.stale) li.append(doc.createTextNode(' '), el(doc, 'span', RESEARCH_WORDS.stale, 'research-ref__tag is-stale'));
  if (row.note) li.append(doc.createTextNode(' — '), el(doc, 'span', row.note, 'research-ref__note'));
  return li;
}

function sourcesFold(doc, view) {
  if (!view.sources.length) return null;
  const fold = markFold(el(doc, 'details', null, 'ind-fold ind-fold--sources research-ref__sources'), 'sources');
  fold.append(foldSummary(doc, 'sources', RESEARCH_WORDS.sources));
  const list = el(doc, 'ul', null, 'research-ref__source-list');
  for (const source of view.sources) {
    const li = el(doc, 'li');
    const link = el(doc, 'a', source.name);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    li.append(link);
    list.append(li);
  }
  fold.append(list);
  if (view.checkedAt) fold.append(el(doc, 'p', `${RESEARCH_WORDS.checked} ${shortDate(view.checkedAt)}`, 'ai-chain__member-list'));
  if (view.method) fold.append(el(doc, 'p', view.method, 'ai-chain__member-list'));
  return fold;
}

/**
 * The block for a read model (researchReference / researchReferenceView), or null without a current row. `id` keeps one
 * block per place, `titles` prints each group's title above its rows (when more than one group shares the block).
 */
export function researchReferenceBlock(doc, view, { id = null, titles = view?.groups?.length > 1 } = {}) {
  if (!doc || view?.state !== 'ok') return null;
  const box = el(doc, 'div', null, 'research-ref');
  if (id) box.id = id;
  box.append(el(doc, 'p', RESEARCH_WORDS.kicker, 'event-brief__sub research-ref__kicker'));
  for (const group of view.groups) {
    if (titles) box.append(el(doc, 'p', group.title, 'research-ref__group'));
    const list = el(doc, 'ul', null, 'research-ref__rows');
    list.setAttribute('aria-label', `${group.title}, ${RESEARCH_WORDS.kicker}`);
    for (const row of group.rows) list.append(rowNode(doc, row));
    box.append(list);
  }
  const fold = sourcesFold(doc, view);
  if (fold) box.append(fold);
  return box;
}

/**
 * A titled section of its own after `anchor` (투자 심리's fund flows and positioning), removed while no row is current.
 * The caller requests the artifact and repaints on arrival.
 */
export function paintResearchSection(doc, root, { id, title, groups, anchor }) {
  if (!doc || !anchor) return null;
  const block = researchReferenceBlock(doc, researchReferenceView(root, { groups }), { titles: false });
  let section = doc.getElementById(id);
  if (!block) { section?.remove(); return null; }
  if (!section) {
    section = el(doc, 'section', null, 'briefing-block research-ref-section');
    section.id = id;
    section.setAttribute('aria-labelledby', `${id}-title`);
    anchor.insertAdjacentElement('afterend', section);
  }
  const heading = el(doc, 'h2', title, 'briefing-h2');
  heading.id = `${id}-title`;
  section.replaceChildren(heading, block);
  return section;
}

/** A stable key of what the block would show, for callers that skip a repaint when nothing changed. */
export const researchSignature = (view) => (view?.state === 'ok' ? view.rows.map((row) => `${row.id}:${row.asOf}:${row.value.text}:${row.stale ? 1 : 0}`).join('|') : String(view?.state || ''));
