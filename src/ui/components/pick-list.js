// One list of rows a reader picks from, and the chosen row's detail under it (beside it on a wide screen) — the
// scenario map (macro-crossroads.js) and the stories (market-narratives.js). The rows are pressed buttons in one roving
// group (behaviors/roving.js); the detail slot announces politely. Only a reader's pick is kept across repaints: the
// wrapper carries it in data-picked, and a caller passes it back as `picked`; the default is the first row.
import { el } from './dom.js';

/**
 * @param {object} spec
 * @param {Array<{id: string}>} spec.items rows, in order
 * @param {string|null} [spec.picked] the reader's earlier pick (wrapper.dataset.picked)
 * @param {string} spec.label the group's accessible name
 * @param {string} spec.key the dataset key each row button carries its id in (data-branch, data-story)
 * @param {{wrap: string, list: string, pick: string, detail: string}} spec.classes
 * @param {(item: object, button: HTMLElement) => Node[]} spec.row the row button's children
 * @param {(item: object) => Node} spec.detail the chosen row's detail
 */
export function pickList(doc, { items, picked = null, label, key, classes, row, detail }) {
  const wrap = el(doc, 'div', null, classes.wrap);
  if (!items.length) return wrap;
  const pickId = items.some((item) => item.id === picked) ? picked : items[0].id;
  const list = el(doc, 'div', null, classes.list);
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', label);
  list.dataset.roving = '';
  const slot = el(doc, 'div', null, classes.detail);
  slot.setAttribute('aria-live', 'polite');
  const show = (id) => {
    for (const button of list.children) button.setAttribute('aria-pressed', String(button.dataset[key] === id));
    slot.replaceChildren(detail(items.find((item) => item.id === id)));
  };
  if (pickId === picked) wrap.dataset.picked = picked;
  for (const item of items) {
    const button = el(doc, 'button', null, classes.pick);
    button.type = 'button';
    button.dataset[key] = item.id;
    button.append(...row(item, button));
    button.addEventListener('click', () => { show(item.id); wrap.dataset.picked = item.id; });
    list.append(button);
  }
  wrap.append(list, slot);
  show(pickId);
  return wrap;
}
