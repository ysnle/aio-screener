// the face of an indicator screen and its only three kinds of fold. The face
// is never folded — each indicator is one row: its title, a state chip (a word, so the state is not told by colour alone),
// the headline value with the distance to the next state, and at most ROW_LINES_MAX short lines under it (why it holds its
// state, what would change it). What may fold is the raw table behind the rows, the method and the data sources, each
// marked with data-fold-kind so scripts/ci-fold-kind-check.mjs can tell a permitted fold from a hidden section.
// Styles: src/ui/styles/regime-quality.css (.ind-row, .ind-fold, .ind-raw).
import { el } from './dom.js';
import { fillOnOpen } from './lazy-fold.js';

export const FOLD_KINDS = Object.freeze({ 'raw-table': '원자료 표', method: '계산 방법', sources: '데이터 출처' });
export const ROW_LINES_MAX = 2;

/**
 * One indicator row. `lines` is [[kind, text], …] (kind names the line, e.g. 'reason' or 'flip'); empty lines drop out and
 * only the first ROW_LINES_MAX are drawn. The caller adds its own class and dataset (the 시장 상태 board marks data-axis).
 */
export function indicatorRow(doc, { title = '', stateLabel = '', tone = 'neutral', value = '', distance = '', distanceTitle = '', lines = [], level = 'h3' } = {}) {
  const row = el(doc, 'article', null, 'ind-row');
  const head = el(doc, 'div', null, 'ind-row__head');
  head.append(el(doc, level, title, 'ind-row__title'), el(doc, 'span', stateLabel, `sx-chip sx-chip--sm sx-chip--${tone} ind-row__state`));
  const body = el(doc, 'div', null, 'ind-row__body');
  const figure = el(doc, 'p', null, 'ind-row__value');
  figure.append(el(doc, 'span', value || '최신 관측 없음', 'ind-row__num'));
  if (distance) {
    const dist = el(doc, 'span', distance, 'ind-row__dist');
    if (distanceTitle) dist.title = distanceTitle;
    figure.append(dist);
  }
  body.append(figure);
  for (const [kind, text] of lines.filter(([, text]) => text).slice(0, ROW_LINES_MAX)) body.append(el(doc, 'p', text, `ind-row__line is-${kind}`));
  row.append(head, body);
  return row;
}

/** Marks a fold another renderer built as one of the permitted kinds; an unknown kind is a programming error. */
export function markFold(fold, kind) {
  if (!FOLD_KINDS[kind]) throw new Error(`fold kind '${kind}' is not one of ${Object.keys(FOLD_KINDS).join(', ')}`);
  if (fold?.dataset) fold.dataset.foldKind = kind;
  return fold;
}

/**
 * A permitted fold: the summary names its kind, then what is inside. `body` is a node list, or a function that returns
 * one — then the body is built the first time the fold opens (lazy-fold.js).
 */
/** The summary of a fold: its kind first ("원자료 표"), then what it holds — so the reader knows what opening it shows. */
export function foldSummary(doc, kind, what) {
  if (!FOLD_KINDS[kind]) throw new Error(`fold kind '${kind}' is not one of ${Object.keys(FOLD_KINDS).join(', ')}`);
  const summary = el(doc, 'summary', null, 'ind-fold__summary');
  summary.append(el(doc, 'span', FOLD_KINDS[kind], 'ind-fold__kind'));
  if (what) summary.append(el(doc, 'span', what, 'ind-fold__what'));
  return summary;
}

export function kindFold(doc, kind, what, body = []) {
  const fold = markFold(el(doc, 'details', null, `ind-fold ind-fold--${kind}`), kind);
  const summary = foldSummary(doc, kind, what);
  fold.append(summary);
  if (typeof body === 'function') fillOnOpen(fold, body);
  else fold.append(...[].concat(body).filter(Boolean));
  return fold;
}

/**
 * The folds a reader opened under `host`, for a repaint that builds them again: call before the repaint, then call the
 * returned function once the new nodes are in. A fold is the same one when its summary reads the same.
 */
export function keepOpenFolds(host) {
  const open = new Set([...(host?.querySelectorAll?.('details[open] > summary') || [])].map((summary) => summary.textContent));
  return (painted = host) => {
    if (!open.size) return;
    for (const summary of painted?.querySelectorAll?.('details:not([open]) > summary') || []) if (open.has(summary.textContent)) summary.parentElement.open = true;
  };
}

/** Replaces a fold's body (everything after its summary), keeping the summary and the reader's open state. */
export function setFoldBody(fold, nodes) {
  for (const child of [...(fold?.children || [])]) if (child.tagName?.toLowerCase?.() !== 'summary') child.remove();
  fold?.append(...[].concat(nodes).filter(Boolean));
  return fold;
}

/** A two-column raw table (label, value) for the raw-table fold. */
export function rawTable(doc, rows, caption = '') {
  const table = el(doc, 'table', null, 'ind-raw');
  if (caption) table.append(el(doc, 'caption', caption, 'sr-only'));
  const body = el(doc, 'tbody');
  for (const [label, value] of rows) {
    if (value == null || value === '') continue;
    const tr = el(doc, 'tr');
    const th = el(doc, 'th', label);
    th.setAttribute('scope', 'row');
    tr.append(th, el(doc, 'td', String(value)));
    body.append(tr);
  }
  table.append(body);
  return table;
}
